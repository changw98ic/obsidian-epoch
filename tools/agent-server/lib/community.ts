import { createHash } from "node:crypto";

type UnknownRecord = Record<string, unknown>;

export type CommunityAbuseContextInput = {
  readonly targetType: string;
  readonly targetId: string;
  readonly explorerId: string;
};

export type CommunityAbuseContext = {
  readonly againstExplorerId?: string;
  readonly groupId?: string;
};

export type CommunityAbuseContextResolver = (
  input: CommunityAbuseContextInput,
) => CommunityAbuseContext | undefined;

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

/**
 * Community writes deliberately accept a small, closed set of public object
 * types.  The ledger is also used directly by tests and by the MCP runtime,
 * so validation lives here rather than only in an HTTP adapter.
 */
export const COMMUNITY_TARGET_TYPES = ["claim", "conflict", "faction", "run", "comment"] as const;
const COMMUNITY_TARGET_TYPE_SET = new Set<string>(COMMUNITY_TARGET_TYPES);
const COMMUNITY_MAX_TARGET_ID_LENGTH = 128;
const COMMUNITY_MAX_REACTION_LENGTH = 64;
const COMMUNITY_MAX_REASON_LENGTH = 240;
const COMMUNITY_MAX_COMMENT_LENGTH = 600;
const COMMUNITY_MAX_IDEMPOTENCY_KEY_LENGTH = 128;
const COMMUNITY_MAX_OPERATOR_NOTE_LENGTH = 600;
const COMMUNITY_DEFAULT_RATE_WINDOW_MS = 60 * 1_000;
const COMMUNITY_DEFAULT_RATE_MAX_ACTIONS = 30;
const COMMUNITY_DEFAULT_IDEMPOTENCY_ENTRIES = 2_000;

export class CommunityRateLimitError extends Error {
  readonly code = "community_rate_limited";
  readonly retryAfterMs: number;
  readonly retryAt: string;

  constructor(retryAfterMs: number, retryAt: string) {
    super("community_rate_limited");
    this.name = "CommunityRateLimitError";
    this.retryAfterMs = retryAfterMs;
    this.retryAt = retryAt;
  }
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function positiveIntegerValue(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

function safeDate(now: unknown) {
  const date = now instanceof Date ? now : new Date(String(now));
  return Number.isFinite(date.getTime()) ? date : new Date();
}

function communityField(value: unknown, field: string, maxLength: number) {
  if (typeof value !== "string") throw new Error(`community_${field}_required`);
  const normalized = value.trim();
  if (!normalized) throw new Error(`community_${field}_required`);
  if (normalized.length > maxLength) throw new Error(`community_${field}_too_long`);
  if (/[\u0000-\u001f\u007f]/u.test(normalized)) throw new Error(`community_${field}_invalid`);
  return normalized;
}

function optionalCommunityField(value: unknown, field: string, maxLength: number) {
  if (value === undefined || value === null || value === "") return undefined;
  return communityField(value, field, maxLength);
}

function communityTargetType(value: unknown) {
  const targetType = communityField(value, "target_type", 32).toLocaleLowerCase("en-US");
  if (!COMMUNITY_TARGET_TYPE_SET.has(targetType)) throw new Error("community_target_type_invalid");
  return targetType;
}

function idempotencyKey(input: UnknownRecord, fingerprint: string) {
  const explicit = optionalCommunityField(input.idempotencyKey, "idempotency_key", COMMUNITY_MAX_IDEMPOTENCY_KEY_LENGTH);
  return explicit ? `explicit:${explicit}` : `derived:${fingerprint}`;
}

function publicCommunityRecord(record: UnknownRecord) {
  const publicRecord = { ...record };
  delete publicRecord.idempotentReplay;
  delete publicRecord._communityIdempotencyKey;
  delete publicRecord._communityIdempotencyFingerprint;
  return publicRecord;
}

/**
 * Mutation responses may be returned directly by HTTP/MCP adapters. Keep
 * detector relationship context and moderation reason codes operator-only;
 * the ledger state and moderation queue retain the authoritative evidence.
 */
export function publicCommunityMutationResult(value: unknown) {
  const publicRecord = publicCommunityRecord(recordValue(value));
  delete publicRecord.againstExplorerId;
  delete publicRecord.groupId;
  delete publicRecord.disputeAbuseFlags;
  delete publicRecord.reviewStatus;
  return publicRecord;
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
  const abuseContextResolver = typeof options.resolveAbuseContext === "function"
    ? options.resolveAbuseContext as CommunityAbuseContextResolver
    : undefined;
  const rateLimitOptions = recordValue(options.rateLimit);
  const rateWindowMs = positiveIntegerValue(rateLimitOptions.windowMs, COMMUNITY_DEFAULT_RATE_WINDOW_MS);
  const rateMaxActions = positiveIntegerValue(rateLimitOptions.maxActions, COMMUNITY_DEFAULT_RATE_MAX_ACTIONS);
  const idempotencyEntryLimit = positiveIntegerValue(
    rateLimitOptions.idempotencyEntries,
    COMMUNITY_DEFAULT_IDEMPOTENCY_ENTRIES,
  );
  const clock = typeof options.now === "function" ? options.now as () => Date : () => new Date();
  const rateBuckets = new Map<string, number[]>();
  const idempotencyRecords = new Map<string, { readonly fingerprint: string; readonly record: UnknownRecord }>();

  for (const reaction of recordArray(options.reactions)) {
    if (reaction?.targetType && reaction?.targetId && reaction?.explorerId) {
      reactions.set(`${reaction.targetType}:${reaction.targetId}:${reaction.explorerId}`, { ...reaction });
    }
  }

  function nowDate() {
    return safeDate(clock());
  }

  function rememberIdempotency(key: string, fingerprint: string, record: UnknownRecord) {
    idempotencyRecords.set(key, { fingerprint, record: { ...record } });
    while (idempotencyRecords.size > idempotencyEntryLimit) {
      const oldest = idempotencyRecords.keys().next().value;
      if (typeof oldest !== "string") break;
      idempotencyRecords.delete(oldest);
    }
  }

  function replayIdempotency(key: string, fingerprint: string) {
    const stored = idempotencyRecords.get(key);
    if (!stored) return undefined;
    if (stored.fingerprint !== fingerprint) throw new Error("community_idempotency_conflict");
    return { ...publicCommunityRecord(stored.record), idempotentReplay: true };
  }

  function hydrateIdempotency(action: "reaction" | "comment" | "flag", record: UnknownRecord) {
    const actor = stringValue(record.explorerId);
    if (!actor) return;
    const fingerprint = stringValue(record._communityIdempotencyFingerprint) || (
      action === "reaction"
        ? [stringValue(record.targetType), stringValue(record.targetId), actor, stringValue(record.reaction)].join("\u001f")
        : [stringValue(record.targetType), stringValue(record.targetId), actor, stringValue(action === "comment" ? record.body : record.reason)].join("\u001f")
    );
    const key = stringValue(record._communityIdempotencyKey) || `derived:${fingerprint}`;
    rememberIdempotency(`${action}:${actor}:${key}`, fingerprint, record);
  }

  function reserveRate(actors: readonly string[], nowMs: number) {
    const keys = [...new Set(actors.filter(Boolean))];
    const recentByActor = keys.map((actor) => ({
      actor,
      recent: (rateBuckets.get(actor) || []).filter((timestamp) => timestamp > nowMs - rateWindowMs),
    }));
    const limited = recentByActor.find(({ recent }) => recent.length >= rateMaxActions);
    if (limited) {
      const retryAtMs = Math.min(...limited.recent) + rateWindowMs;
      const retryAfterMs = Math.max(1, retryAtMs - nowMs);
      for (const { actor, recent } of recentByActor) rateBuckets.set(actor, recent);
      throw new CommunityRateLimitError(retryAfterMs, new Date(retryAtMs).toISOString());
    }
    for (const { actor, recent } of recentByActor) {
      recent.push(nowMs);
      rateBuckets.set(actor, recent);
    }
  }

  function validatedActor(input: UnknownRecord) {
    const actor = communityField(input.explorerId, "explorer_id", COMMUNITY_MAX_TARGET_ID_LENGTH);
    const tokenId = optionalCommunityField(input.tokenId, "token_id", COMMUNITY_MAX_TARGET_ID_LENGTH);
    // Keep both server-derived scopes: a token bucket limits one credential,
    // while an explorer bucket prevents rotating credentials from bypassing
    // the same community write budget.
    return { actor, tokenId, rateActors: tokenId ? [actor, tokenId] : [actor] };
  }

  function applyTargetDisposition(targetType: string, targetId: string, action: "restore" | "hide") {
    if (targetType === "comment") {
      const comment = comments.find((candidate) => candidate.commentId === targetId);
      if (comment) comment.status = action === "hide" ? "hidden" : "visible";
      return;
    }
    for (const reaction of reactions.values()) {
      if (reaction.targetType !== targetType || reaction.targetId !== targetId) continue;
      reaction.visibility = action === "hide" ? "hidden" : "visible";
      reaction.reviewStatus = action === "hide" ? "operator_hidden" : "none";
    }
  }

  function appendDisputeFlag(record: UnknownRecord, disputeAbuseFlags: readonly string[], createdAt: string) {
    const targetType = stringValue(record.targetType);
    const targetId = stringValue(record.targetId);
    const explorerId = stringValue(record.explorerId);
    const flagId = id("flag", [targetType, targetId, explorerId, disputeAbuseFlags.join(",")]);
    if (flags.some((candidate) => candidate.flagId === flagId)) return;
    flags.push({
      flagId,
      targetType,
      targetId,
      explorerId,
      reason: `dispute_abuse:${disputeAbuseFlags.join("+")}`,
      status: "queued",
      disputeAbuseFlags: [...disputeAbuseFlags],
      createdAt,
    });
  }

  for (const reaction of reactions.values()) hydrateIdempotency("reaction", reaction);
  for (const comment of comments) hydrateIdempotency("comment", comment);
  for (const flag of flags) hydrateIdempotency("flag", flag);

  function react(input: UnknownRecord) {
    const normalizedTargetType = communityTargetType(input.targetType);
    const normalizedTargetId = communityField(input.targetId, "target_id", COMMUNITY_MAX_TARGET_ID_LENGTH);
    const { actor, rateActors } = validatedActor(input);
    const normalizedReaction = communityField(input.reaction, "reaction", COMMUNITY_MAX_REACTION_LENGTH);
    // Once a resolver is configured, relationship and group context comes
    // exclusively from that server-owned callback. Public adapters may still
    // pass untrusted fields for backwards compatibility, but they are ignored
    // before abuse detection.
    const abuseContext = abuseContextResolver
      ? abuseContextResolver({
          targetType: normalizedTargetType,
          targetId: normalizedTargetId,
          explorerId: actor,
        }) || {}
      : input;
    const normalizedAgainstExplorerId = optionalCommunityField(
      abuseContext.againstExplorerId,
      "against_explorer_id",
      COMMUNITY_MAX_TARGET_ID_LENGTH,
    );
    const normalizedGroupId = optionalCommunityField(abuseContext.groupId, "group_id", COMMUNITY_MAX_TARGET_ID_LENGTH);
    const key = `${normalizedTargetType}:${normalizedTargetId}:${actor}`;
    const fingerprint = [normalizedTargetType, normalizedTargetId, actor, normalizedReaction].join("\u001f");
    const replayKey = idempotencyKey(input, fingerprint);
    const replay = replayIdempotency(`reaction:${actor}:${replayKey}`, fingerprint);
    if (replay) return { ...replay, reactionPolicy: quickReactionPolicy() };
    const existing = reactions.get(key);
    if (existing && existing.reaction === normalizedReaction) {
      rememberIdempotency(`reaction:${actor}:${replayKey}`, fingerprint, existing);
      return { status: "recorded", ...publicCommunityRecord(existing), idempotentReplay: true, reactionPolicy: quickReactionPolicy() };
    }
    const updatedAt = nowDate().toISOString();
    reserveRate(rateActors, Date.parse(updatedAt));
    const record = {
      targetType: normalizedTargetType,
      targetId: normalizedTargetId,
      explorerId: actor,
      ...(normalizedAgainstExplorerId ? { againstExplorerId: normalizedAgainstExplorerId } : {}),
      ...(normalizedGroupId ? { groupId: normalizedGroupId } : {}),
      reaction: normalizedReaction,
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
      appendDisputeFlag(record, disputeAbuseFlags, updatedAt);
    }
    const storedRecord = {
      ...record,
      _communityIdempotencyKey: replayKey,
      _communityIdempotencyFingerprint: fingerprint,
    };
    reactions.set(key, storedRecord);
    rememberIdempotency(`reaction:${actor}:${replayKey}`, fingerprint, storedRecord);
    return { status: "recorded", ...publicCommunityRecord(record), reactionPolicy: quickReactionPolicy() };
  }

  function comment(input: UnknownRecord) {
    const normalizedTargetType = communityTargetType(input.targetType);
    const normalizedTargetId = communityField(input.targetId, "target_id", COMMUNITY_MAX_TARGET_ID_LENGTH);
    const { actor, rateActors } = validatedActor(input);
    const normalizedBody = communityField(input.body, "body", COMMUNITY_MAX_COMMENT_LENGTH);
    const fingerprint = [normalizedTargetType, normalizedTargetId, actor, normalizedBody].join("\u001f");
    const replayKey = idempotencyKey(input, fingerprint);
    const key = `comment:${actor}:${replayKey}`;
    const replay = replayIdempotency(key, fingerprint);
    if (replay) return replay;
    reserveRate(rateActors, nowDate().getTime());
    const commentId = id("comment", [normalizedTargetType, normalizedTargetId, actor, normalizedBody, replayKey]);
    const existing = comments.find((candidate) => candidate.commentId === commentId);
    if (existing) {
      rememberIdempotency(key, fingerprint, existing);
      return { ...publicCommunityRecord(existing), idempotentReplay: true };
    }
    const record = {
      commentId,
      targetType: normalizedTargetType,
      targetId: normalizedTargetId,
      explorerId: actor,
      body: normalizedBody,
      status: "visible",
      createdAt: nowDate().toISOString(),
    };
    const storedRecord = {
      ...record,
      _communityIdempotencyKey: replayKey,
      _communityIdempotencyFingerprint: fingerprint,
    };
    comments.push(storedRecord);
    rememberIdempotency(key, fingerprint, storedRecord);
    return publicCommunityRecord(record);
  }

  function flag(input: UnknownRecord) {
    const normalizedTargetType = communityTargetType(input.targetType);
    const normalizedTargetId = communityField(input.targetId, "target_id", COMMUNITY_MAX_TARGET_ID_LENGTH);
    const { actor, rateActors } = validatedActor(input);
    const normalizedReason = communityField(input.reason, "reason", COMMUNITY_MAX_REASON_LENGTH);
    const fingerprint = [normalizedTargetType, normalizedTargetId, actor, normalizedReason].join("\u001f");
    const replayKey = idempotencyKey(input, fingerprint);
    const key = `flag:${actor}:${replayKey}`;
    const replay = replayIdempotency(key, fingerprint);
    if (replay) return replay;
    reserveRate(rateActors, nowDate().getTime());
    const flagId = id("flag", [normalizedTargetType, normalizedTargetId, actor, normalizedReason, replayKey]);
    const existing = flags.find((candidate) => candidate.flagId === flagId);
    if (existing) {
      rememberIdempotency(key, fingerprint, existing);
      return { ...publicCommunityRecord(existing), idempotentReplay: true };
    }
    const record = {
      flagId,
      targetType: normalizedTargetType,
      targetId: normalizedTargetId,
      explorerId: actor,
      reason: normalizedReason,
      status: "queued",
      createdAt: nowDate().toISOString(),
    };
    const storedRecord = {
      ...record,
      _communityIdempotencyKey: replayKey,
      _communityIdempotencyFingerprint: fingerprint,
    };
    flags.push(storedRecord);
    rememberIdempotency(key, fingerprint, storedRecord);
    return publicCommunityRecord(record);
  }

  function moderate(input: UnknownRecord) {
    const flagId = communityField(input.flagId, "flag_id", COMMUNITY_MAX_TARGET_ID_LENGTH);
    const actionValue = stringValue(input.action || input.resolution).toLocaleLowerCase("en-US");
    if (actionValue !== "resolve" && actionValue !== "restore" && actionValue !== "hide") {
      throw new Error("community_moderation_action_invalid");
    }
    const desiredStatus = actionValue === "resolve"
      ? "resolved"
      : actionValue === "hide"
        ? "hidden"
        : "restored";
    const index = flags.findIndex((candidate) => candidate.flagId === flagId);
    if (index < 0) throw new Error("community_moderation_item_not_found");
    const current = flags[index];
    if (current.status === desiredStatus) {
      return { ...publicCommunityRecord(current), idempotentReplay: true };
    }
    const note = optionalCommunityField(input.note, "moderation_note", COMMUNITY_MAX_OPERATOR_NOTE_LENGTH);
    if (actionValue === "hide" || actionValue === "restore") {
      applyTargetDisposition(
        communityTargetType(current.targetType),
        communityField(current.targetId, "target_id", COMMUNITY_MAX_TARGET_ID_LENGTH),
        actionValue,
      );
    }
    const updated = {
      ...current,
      status: desiredStatus,
      resolution: actionValue,
      ...(note ? { note } : {}),
      resolvedAt: nowDate().toISOString(),
    };
    flags[index] = updated;
    return publicCommunityRecord(updated);
  }

  function threadFor(targetId: unknown) {
    const targetReactions = Array.from(reactions.values()).filter((reaction) => reaction.targetId === targetId);
    const visibleReactions = targetReactions.filter((reaction) =>
      reaction.visibility !== "hidden_pending_review" && reaction.visibility !== "hidden");
    const publicReactions = visibleReactions.map((reaction) => {
      const publicRecord = publicCommunityRecord(reaction);
      delete publicRecord.againstExplorerId;
      delete publicRecord.groupId;
      delete publicRecord.disputeAbuseFlags;
      delete publicRecord.reviewStatus;
      return publicRecord;
    });
    const reactionCounts: Record<string, number> = {};
    for (const reaction of visibleReactions) {
      const reactionKey = String(reaction.reaction || "unknown");
      reactionCounts[reactionKey] = (reactionCounts[reactionKey] || 0) + 1;
    }
    const attentionScore = Object.values(reactionCounts).reduce((total, count) => total + count, 0);
    return {
      targetId,
      reactions: publicReactions,
      reactionCounts,
      reactionPolicy: quickReactionPolicy(),
      sortSignals: {
        attentionScore,
        reactionCounts: { ...reactionCounts },
      },
      comments: comments
        .filter((comment) => comment.targetId === targetId && comment.status === "visible")
        .map((item) => publicCommunityRecord(item)),
    };
  }

  return {
    react,
    comment,
    flag,
    moderate,
    threadFor,
    moderationQueue: () => flags
      .filter((flagItem) => flagItem.status === "queued")
      .map((flagItem) => publicCommunityRecord(flagItem)),
    state: () => ({
      reactions: Array.from(reactions.values()).map((reaction) => ({ ...reaction })),
      comments: comments.map((comment) => ({ ...comment })),
      flags: flags.map((flagItem) => ({ ...flagItem })),
    }),
  };
}
