import { createHash } from "node:crypto";

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function recordArray(value: unknown): UnknownRecord[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function recordValue(value: unknown): UnknownRecord {
  return isRecord(value) ? value : {};
}

function numberValue(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function publicClaimPreview(value: unknown) {
  return recordArray(value).map((claim) => ({
    subject: stringValue(claim.subject),
    predicate: stringValue(claim.predicate),
    object: stringValue(claim.object),
  })).filter((claim) => claim.subject && claim.predicate && claim.object);
}

function publicRunArchiveEntry(run: UnknownRecord) {
  const failurePublication = recordValue(run.failurePublication);
  const isFailedReport = numberValue(run.score) < 60 || (
    run.worldImpact === "none" && Boolean(stringValue(failurePublication.selectedMode))
  );
  if (isFailedReport) {
    if (failurePublication.publicArchive !== true) return undefined;
    const redacted: UnknownRecord = {
      ...run,
      failurePublication,
    };
    delete redacted.explorerId;
    delete redacted.agentId;
    if (failurePublication.selectedMode === "anonymous_public") {
      return {
        ...redacted,
        anonymous: true,
      };
    }
    if (failurePublication.selectedMode === "claim_only") {
      return {
        ...redacted,
        claimPreview: publicClaimPreview(run.claimPreview),
      };
    }
    return redacted;
  }
  return run.visibility === "public" || run.worldImpact === "review_candidate" ? { ...run } : undefined;
}

function publicRuns(runs: readonly UnknownRecord[] = []) {
  return runs.map(publicRunArchiveEntry).filter(isRecord);
}

function quickReactionPolicy() {
  return {
    allowedEffects: ["sorting", "attention"],
    forbiddenEffects: ["claim_status", "truth_adjudication"],
    claimStatusEffect: "none",
    claimStatusInputs: ["evidence", "review_record", "authorized_reassessment"],
  };
}

const DISPUTE_ABUSE_WINDOW_MS = 10 * 60 * 1_000;
const DISPUTE_REACTIONS = new Set([
  "refute",
  "challenge",
  "needs_evidence",
  "untrusted",
  "不可信",
  "驳议",
  "反证",
]);

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isDisputeReaction(value: unknown) {
  const reaction = stringValue(value).toLocaleLowerCase("zh-CN");
  return DISPUTE_REACTIONS.has(reaction);
}

function recentDisputeReactions(records: readonly UnknownRecord[], nowMs: number) {
  return records.filter((record) => {
    if (!isDisputeReaction(record.reaction)) return false;
    const updatedAtMs = Date.parse(stringValue(record.updatedAt));
    return Number.isFinite(updatedAtMs) && nowMs - updatedAtMs <= DISPUTE_ABUSE_WINDOW_MS;
  });
}

function disputeAbuseFlagsFor(record: UnknownRecord, previousRecords: readonly UnknownRecord[], nowMs: number) {
  if (!isDisputeReaction(record.reaction)) return [];
  const records = recentDisputeReactions([...previousRecords, record], nowMs);
  const actor = stringValue(record.explorerId);
  const targetExplorer = stringValue(record.againstExplorerId);
  const targetId = stringValue(record.targetId);
  const groupId = stringValue(record.groupId);
  const flags = new Set<string>();

  if (actor && targetExplorer && records.some((candidate) =>
    stringValue(candidate.explorerId) === targetExplorer
    && stringValue(candidate.againstExplorerId) === actor)) {
    flags.add("bidirectional_retaliation");
  }

  if (actor && targetExplorer) {
    const burstTargets = new Set(records
      .filter((candidate) =>
        stringValue(candidate.explorerId) === actor
        && stringValue(candidate.againstExplorerId) === targetExplorer)
      .map((candidate) => stringValue(candidate.targetId))
      .filter(Boolean));
    if (burstTargets.size >= 3) flags.add("short_burst_objections");
  }

  if (groupId && (targetId || targetExplorer)) {
    const groupActors = new Set(records
      .filter((candidate) =>
        stringValue(candidate.groupId) === groupId
        && (stringValue(candidate.targetId) === targetId || stringValue(candidate.againstExplorerId) === targetExplorer))
      .map((candidate) => stringValue(candidate.explorerId))
      .filter(Boolean));
    if (groupActors.size >= 3) flags.add("group_pile_on");
  }

  return [...flags];
}

function id(prefix: string, parts: readonly unknown[]) {
  return `${prefix}_${createHash("sha256").update(parts.join("\u001f")).digest("hex").slice(0, 16)}`;
}

function buildSourceGraph({ claims, conflicts, factions, runs }: {
  readonly claims: readonly UnknownRecord[];
  readonly conflicts: readonly UnknownRecord[];
  readonly factions: readonly UnknownRecord[];
  readonly runs: readonly UnknownRecord[];
}) {
  const nodes: UnknownRecord[] = [];
  const edges: UnknownRecord[] = [];
  const seen = new Set<string>();
  function addNode(node: UnknownRecord) {
    if (typeof node.id !== "string") return;
    if (seen.has(node.id)) return;
    seen.add(node.id);
    nodes.push(node);
  }

  for (const run of publicRuns(runs)) {
    addNode({ id: run.runTicket, type: "run", label: run.runTicket, score: run.score });
  }
  for (const claim of claims) {
    addNode({ id: claim.claimId, type: "claim", label: `${claim.subject}:${claim.predicate}` });
    for (const source of recordArray(claim.sources)) {
      addNode({ id: source.runTicket, type: "run", label: source.runTicket });
      edges.push({ from: source.runTicket, to: claim.claimId, type: "evidences" });
    }
  }
  for (const conflict of conflicts) {
    addNode({ id: conflict.conflictId, type: "conflict", label: conflict.status });
    for (const claimId of Array.isArray(conflict.claimIds) ? conflict.claimIds : []) {
      edges.push({ from: claimId, to: conflict.conflictId, type: "conflicts" });
    }
  }
  for (const faction of factions) {
    addNode({ id: faction.factionId, type: "faction", label: faction.name });
    for (const source of recordArray(faction.sources)) {
      addNode({ id: source.runTicket, type: "run", label: source.runTicket });
      edges.push({ from: source.runTicket, to: faction.factionId, type: "founds" });
    }
    for (const reference of recordArray(faction.references)) {
      addNode({ id: reference.runTicket, type: "run", label: reference.runTicket });
      edges.push({ from: reference.runTicket, to: faction.factionId, type: "references" });
    }
  }
  return { nodes, edges };
}

export function buildPublicWorldView({
  loreState = { claims: [], conflicts: [] },
  factionState = { factions: [] },
  runs = [],
}: {
  readonly loreState?: UnknownRecord;
  readonly factionState?: UnknownRecord;
  readonly runs?: readonly UnknownRecord[];
}) {
  const claims = recordArray(loreState.claims);
  const conflicts = recordArray(loreState.conflicts);
  const factions = recordArray(factionState.factions);
  const archive = publicRuns(runs).map((run) => ({ ...run }));
  const claimDetails = Object.fromEntries(claims.map((claim) => [
    claim.claimId,
    {
      ...claim,
      conflicts: conflicts.filter((conflict) => Array.isArray(conflict.claimIds) && conflict.claimIds.includes(claim.claimId)),
    },
  ]));
  const conflictDetails = Object.fromEntries(conflicts.map((conflict) => [
    conflict.conflictId,
    {
      ...conflict,
      claims: (Array.isArray(conflict.claimIds) ? conflict.claimIds : [])
        .map((claimId) => claimDetails[String(claimId)])
        .filter(Boolean),
    },
  ]));
  const factionDetails = Object.fromEntries(factions.map((faction) => [faction.factionId, { ...faction }]));

  return {
    summary: {
      canonicalClaims: claims.filter((claim) => claim.status === "canonical").length,
      disputedClaims: claims.filter((claim) => claim.status === "disputed").length,
      openConflicts: conflicts.filter((conflict) => conflict.status === "open").length,
      acceptedFactions: factions.filter((faction) => faction.status === "accepted").length,
      archiveRuns: archive.length,
    },
    claims: claims.map((claim) => ({
      claimId: claim.claimId,
      status: claim.status,
      subject: claim.subject,
      predicate: claim.predicate,
      object: claim.object,
      sourceCount: recordArray(claim.sources).length,
    })),
    conflicts: conflicts.map((conflict) => ({
      conflictId: conflict.conflictId,
      status: conflict.status,
      claimCount: Array.isArray(conflict.claimIds) ? conflict.claimIds.length : 0,
    })),
    factions: factions.map((faction) => ({
      factionId: faction.factionId,
      name: faction.name,
      status: faction.status,
      supporterCount: recordArray(faction.supporters).length,
      referenceCount: recordArray(faction.references).length,
    })),
    archive,
    claimDetails,
    conflictDetails,
    factionDetails,
    sourceGraph: buildSourceGraph({ claims, conflicts, factions, runs }),
  };
}

export function createCommunityLedger(options: UnknownRecord = {}) {
  const reactions = new Map<string, UnknownRecord>();
  const comments = recordArray(options.comments).map((comment) => ({ ...comment }));
  const flags = recordArray(options.flags).map((flag) => ({ ...flag }));

  for (const reaction of recordArray(options.reactions)) {
    if (reaction?.targetType && reaction?.targetId && reaction?.explorerId) {
      reactions.set(`${reaction.targetType}:${reaction.targetId}:${reaction.explorerId}`, { ...reaction });
    }
  }

  function react({ targetType, targetId, explorerId, reaction, againstExplorerId, groupId }: UnknownRecord) {
    const key = `${targetType}:${targetId}:${explorerId}`;
    const updatedAt = new Date().toISOString();
    const record = {
      targetType,
      targetId,
      explorerId,
      ...(againstExplorerId ? { againstExplorerId } : {}),
      ...(groupId ? { groupId } : {}),
      reaction,
      visibility: "visible",
      reviewStatus: "none",
      disputeAbuseFlags: [] as string[],
      updatedAt,
    };
    const disputeAbuseFlags = disputeAbuseFlagsFor(record, Array.from(reactions.values()), Date.parse(updatedAt));
    if (disputeAbuseFlags.length) {
      record.visibility = "hidden_pending_review";
      record.reviewStatus = "queued";
      record.disputeAbuseFlags = disputeAbuseFlags;
      flags.push({
        flagId: id("flag", [targetType, targetId, explorerId, disputeAbuseFlags.join(","), String(flags.length)]),
        targetType,
        targetId,
        explorerId,
        reason: `dispute_abuse:${disputeAbuseFlags.join("+")}`,
        status: "queued",
        disputeAbuseFlags,
        createdAt: updatedAt,
      });
    }
    reactions.set(key, record);
    return { status: "recorded", ...record, reactionPolicy: quickReactionPolicy() };
  }

  function comment({ targetType, targetId, explorerId, body }: UnknownRecord) {
    const commentId = id("comment", [targetType, targetId, explorerId, body, String(comments.length)]);
    const record = {
      commentId,
      targetType,
      targetId,
      explorerId,
      body: String(body || "").trim().slice(0, 600),
      status: "visible",
      createdAt: new Date().toISOString(),
    };
    comments.push(record);
    return { ...record };
  }

  function flag({ targetType, targetId, explorerId, reason }: UnknownRecord) {
    const record = {
      flagId: id("flag", [targetType, targetId, explorerId, reason, String(flags.length)]),
      targetType,
      targetId,
      explorerId,
      reason,
      status: "queued",
      createdAt: new Date().toISOString(),
    };
    flags.push(record);
    return { ...record };
  }

  function threadFor(targetId: unknown) {
    const targetReactions = Array.from(reactions.values()).filter((reaction) => reaction.targetId === targetId);
    const reactionCounts: Record<string, number> = {};
    for (const reaction of targetReactions) {
      const reactionKey = String(reaction.reaction || "unknown");
      reactionCounts[reactionKey] = (reactionCounts[reactionKey] || 0) + 1;
    }
    const attentionScore = Object.values(reactionCounts).reduce((total, count) => total + count, 0);
    const hiddenReactions = targetReactions.filter((reaction) => reaction.visibility === "hidden_pending_review");
    const disputeAbuseFlagCounts: Record<string, number> = {};
    for (const reaction of hiddenReactions) {
      for (const flag of Array.isArray(reaction.disputeAbuseFlags) ? reaction.disputeAbuseFlags : []) {
        const flagKey = String(flag);
        disputeAbuseFlagCounts[flagKey] = (disputeAbuseFlagCounts[flagKey] || 0) + 1;
      }
    }
    return {
      targetId,
      reactions: targetReactions.map((reaction) => ({ ...reaction })),
      reactionCounts,
      reactionPolicy: quickReactionPolicy(),
      sortSignals: {
        attentionScore,
        reactionCounts: { ...reactionCounts },
      },
      disputeAbuseSummary: {
        hiddenReactions: hiddenReactions.length,
        queuedForReview: hiddenReactions.length > 0,
        flags: disputeAbuseFlagCounts,
      },
      comments: comments.filter((comment) => comment.targetId === targetId && comment.status === "visible").map((item) => ({ ...item })),
    };
  }

  return {
    react,
    comment,
    flag,
    threadFor,
    moderationQueue: () => flags.filter((flagItem) => flagItem.status === "queued").map((flagItem) => ({ ...flagItem })),
    state: () => ({
      reactions: Array.from(reactions.values()).map((reaction) => ({ ...reaction })),
      comments: comments.map((comment) => ({ ...comment })),
      flags: flags.map((flagItem) => ({ ...flagItem })),
    }),
  };
}
