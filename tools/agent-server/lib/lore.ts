import { createHash } from "node:crypto";
import { createEpochOperationSwitchRegistry, type EpochOperationSwitchRegistry } from "./operationSwitches.ts";

type UnknownRecord = Record<string, unknown>;

interface NormalizedClaim {
  readonly subject: string;
  readonly predicate: string;
  readonly object: string;
  readonly evidence: string;
}

export type PublicClaimStatus =
  | "candidate"
  | "rumor"
  | "canonical"
  | "disputed"
  | "inscribed"
  | "rejected"
  | "hidden";

interface ClaimStatusHistoryEntry {
  readonly fromStatus: string | null;
  readonly toStatus: string;
  readonly reason: string;
  readonly manualApprovalId?: string;
  readonly canonAdoptionEventId?: string;
  readonly changedAt: string;
}

interface PublicClaim extends NormalizedClaim {
  readonly claimId: string;
  status: string;
  readonly exactKey: string;
  readonly conflictKey: string;
  readonly sources: UnknownRecord[];
  statusHistory: ClaimStatusHistoryEntry[];
}

interface LoreConflict {
  readonly conflictId: string;
  readonly status: string;
  readonly key: string;
  readonly claimIds: string[];
}

interface LoreAdmissionDecision {
  readonly status: string;
  readonly reason?: string;
  readonly claimId?: string;
  readonly claim?: NormalizedClaim;
  readonly reward?: UnknownRecord | null;
  readonly conflict?: LoreConflict;
}

interface LowRiskRumorAdmission {
  readonly explorerId: string;
  readonly runTicket?: string;
  readonly claimId: string;
  readonly admittedAt: string;
  readonly dateKey: string;
  readonly weekKey: string;
}

const LOW_RISK_RUMOR_DAILY_CAP = 1;
const LOW_RISK_RUMOR_WEEKLY_CAP = 3;

const CLAIM_STATUS_TRANSITIONS: Readonly<Record<PublicClaimStatus, readonly PublicClaimStatus[]>> = {
  candidate: ["rumor", "disputed", "rejected"],
  rumor: ["candidate", "disputed", "rejected"],
  disputed: ["canonical", "rejected", "hidden"],
  canonical: ["inscribed", "disputed", "hidden"],
  inscribed: ["hidden"],
  rejected: ["candidate", "hidden"],
  hidden: [],
};

export function claimStatusTransitionTable() {
  return Object.fromEntries(
    Object.entries(CLAIM_STATUS_TRANSITIONS).map(([status, next]) => [status, [...next]]),
  );
}

export function isClaimStatusTransitionAllowed(fromStatus: string, toStatus: string) {
  const allowed = CLAIM_STATUS_TRANSITIONS[fromStatus as PublicClaimStatus];
  return Boolean(allowed?.includes(toStatus as PublicClaimStatus));
}

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function recordArray(value: unknown): UnknownRecord[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function compactText(value: unknown) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function normalizeKeyPart(value: unknown) {
  return compactText(value).toLocaleLowerCase("zh-CN");
}

function sourceSubmittedAt(source: UnknownRecord) {
  const value = compactText(source.submittedAt) || compactText(source.createdAt) || compactText(source.settledAt);
  const date = value ? new Date(value) : new Date();
  return Number.isFinite(date.getTime()) ? date.toISOString() : new Date().toISOString();
}

function dateKeyFromIso(iso: string) {
  return iso.slice(0, 10);
}

function weekKeyFromIso(iso: string) {
  const date = new Date(iso);
  const safeDate = Number.isFinite(date.getTime()) ? date : new Date();
  const utcDate = new Date(Date.UTC(safeDate.getUTCFullYear(), safeDate.getUTCMonth(), safeDate.getUTCDate()));
  const utcDay = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() - utcDay + 1);
  return utcDate.toISOString().slice(0, 10);
}

function isLowRiskSource(source: UnknownRecord) {
  const risk = normalizeKeyPart(
    source.riskLevel || source.risk || source.risk_level || source.riskTier || source.commissionRisk,
  );
  const compactRisk = risk.replace(/[\s_-]+/g, "");
  return compactRisk === "low" || compactRisk === "lowrisk" || risk === "低" || risk === "低风险";
}

function stableId(prefix: string, parts: readonly unknown[]) {
  const hash = createHash("sha256")
    .update(parts.map((part) => normalizeKeyPart(part)).join("\u001f"))
    .digest("hex")
    .slice(0, 16);
  return `${prefix}_${hash}`;
}

export function normalizeClaim(rawClaim: UnknownRecord = {}): NormalizedClaim {
  return {
    subject: compactText(rawClaim.subject),
    predicate: compactText(rawClaim.predicate),
    object: compactText(rawClaim.object),
    evidence: compactText(rawClaim.evidence),
  };
}

export function exactClaimKey(claim: Pick<NormalizedClaim, "subject" | "predicate" | "object">) {
  return [claim.subject, claim.predicate, claim.object].map(normalizeKeyPart).join("|");
}

export function conflictKey(claim: Pick<NormalizedClaim, "subject" | "predicate">) {
  return [claim.subject, claim.predicate].map(normalizeKeyPart).join("|");
}

export function extractCandidateClaims(run: UnknownRecord = {}): NormalizedClaim[] {
  const claims: NormalizedClaim[] = [];
  for (const claim of recordArray(run.candidateClaims)) {
    claims.push(normalizeClaim(claim));
  }
  for (const event of recordArray(run.events)) {
    if (isRecord(event.claim)) {
      claims.push(normalizeClaim({
        ...event.claim,
        evidence: event.claim.evidence || event.evidence || event.outcome || event.visibleText,
      }));
    }
  }
  return claims;
}

function sourceRecord(source: UnknownRecord, claim: NormalizedClaim): UnknownRecord {
  return {
    runTicket: source.runTicket,
    runId: source.runId || source.runTicket,
    explorerId: source.explorerId,
    agentId: source.agentId,
    score: source.score,
    evidence: claim.evidence,
  };
}

function publicClaimFrom(claim: NormalizedClaim, source: UnknownRecord, status: string): PublicClaim {
  const claimId = stableId("claim", [claim.subject, claim.predicate, claim.object]);
  return {
    claimId,
    status,
    subject: claim.subject,
    predicate: claim.predicate,
    object: claim.object,
    evidence: claim.evidence,
    exactKey: exactClaimKey(claim),
    conflictKey: conflictKey(claim),
    sources: [sourceRecord(source, claim)],
    statusHistory: [{
      fromStatus: null,
      toStatus: status,
      reason: "admitted",
      changedAt: new Date().toISOString(),
    }],
  };
}

export function createLoreLedger(
  initialState: UnknownRecord = {},
  options: { readonly operationSwitches?: EpochOperationSwitchRegistry } = {},
) {
  const operationSwitches = options.operationSwitches || createEpochOperationSwitchRegistry({ switches: [] });
  const claims: PublicClaim[] = recordArray(initialState.claims).map((claim) => ({
    ...claim,
    sources: recordArray(claim.sources).map((source) => ({ ...source })),
    statusHistory: recordArray(claim.statusHistory).map((entry) => ({
      fromStatus: typeof entry.fromStatus === "string" ? entry.fromStatus : null,
      toStatus: compactText(entry.toStatus),
      reason: compactText(entry.reason),
      manualApprovalId: compactText(entry.manualApprovalId) || undefined,
      canonAdoptionEventId: compactText(entry.canonAdoptionEventId) || undefined,
      changedAt: compactText(entry.changedAt) || new Date().toISOString(),
    })),
  })) as unknown as PublicClaim[];
  const conflicts: LoreConflict[] = recordArray(initialState.conflicts).map((conflict) => ({
    ...conflict,
    claimIds: Array.isArray(conflict.claimIds) ? conflict.claimIds.map(String) : [],
  })) as unknown as LoreConflict[];
  const sourceRewards: UnknownRecord[] = recordArray(initialState.sourceRewards).map((reward) => ({ ...reward }));
  const lowRiskRumorAdmissions: LowRiskRumorAdmission[] = recordArray(initialState.lowRiskRumorAdmissions)
    .map((entry) => ({
      explorerId: compactText(entry.explorerId),
      runTicket: compactText(entry.runTicket) || undefined,
      claimId: compactText(entry.claimId),
      admittedAt: compactText(entry.admittedAt) || sourceSubmittedAt(entry),
      dateKey: compactText(entry.dateKey) || dateKeyFromIso(sourceSubmittedAt(entry)),
      weekKey: compactText(entry.weekKey) || weekKeyFromIso(sourceSubmittedAt(entry)),
    }))
    .filter((entry) => entry.explorerId && entry.claimId && entry.dateKey && entry.weekKey);

  function findExact(claim: NormalizedClaim) {
    const key = exactClaimKey(claim);
    return claims.find((item) => item.exactKey === key);
  }

  function findConflict(claim: NormalizedClaim) {
    const key = conflictKey(claim);
    return claims.find((item) => item.conflictKey === key && item.exactKey !== exactClaimKey(claim));
  }

  function cloneSourceReward(reward: UnknownRecord) {
    return {
      ...reward,
      ...(Array.isArray(reward.supportingExplorerIds)
        ? { supportingExplorerIds: reward.supportingExplorerIds.map(String) }
        : {}),
      ...(Array.isArray(reward.riskFlags)
        ? { riskFlags: reward.riskFlags.map(String) }
        : {}),
    };
  }

  function lowRiskRumorGate(source: UnknownRecord) {
    const lowRisk = isLowRiskSource(source);
    const explorerId = compactText(source.explorerId);
    const admittedAt = sourceSubmittedAt(source);
    const dateKey = dateKeyFromIso(admittedAt);
    const weekKey = weekKeyFromIso(admittedAt);
    if (!lowRisk || !explorerId) return { lowRisk, capped: false, explorerId, admittedAt, dateKey, weekKey };

    const explorerAdmissions = lowRiskRumorAdmissions.filter((entry) => entry.explorerId === explorerId);
    if (explorerAdmissions.filter((entry) => entry.dateKey === dateKey).length >= LOW_RISK_RUMOR_DAILY_CAP) {
      return {
        lowRisk,
        capped: true,
        reason: "low_risk_rumor_daily_cap",
        explorerId,
        admittedAt,
        dateKey,
        weekKey,
      };
    }
    if (explorerAdmissions.filter((entry) => entry.weekKey === weekKey).length >= LOW_RISK_RUMOR_WEEKLY_CAP) {
      return {
        lowRisk,
        capped: true,
        reason: "low_risk_rumor_weekly_cap",
        explorerId,
        admittedAt,
        dateKey,
        weekKey,
      };
    }

    return { lowRisk, capped: false, explorerId, admittedAt, dateKey, weekKey };
  }

  function recordLowRiskRumorAdmission(
    source: UnknownRecord,
    claimId: string,
    gate: ReturnType<typeof lowRiskRumorGate>,
  ) {
    if (!gate.lowRisk || gate.capped || !gate.explorerId) return;
    lowRiskRumorAdmissions.push({
      explorerId: gate.explorerId,
      runTicket: compactText(source.runTicket) || undefined,
      claimId,
      admittedAt: gate.admittedAt,
      dateKey: gate.dateKey,
      weekKey: gate.weekKey,
    });
  }

  function sourceRewardSupportingExplorerIds(reward: UnknownRecord) {
    return Array.isArray(reward.supportingExplorerIds)
      ? reward.supportingExplorerIds.map(String)
      : compactText(reward.fromExplorerId)
        ? [compactText(reward.fromExplorerId)]
        : [];
  }

  function mutualSourceRewardLoops(rewardedExplorerId: string, fromExplorerId: string) {
    return sourceRewards.filter((reward) =>
      compactText(reward.rewardedExplorerId) === fromExplorerId
      && sourceRewardSupportingExplorerIds(reward).includes(rewardedExplorerId));
  }

  function markMutualSourceRewardLoop(reward: UnknownRecord) {
    const riskFlags = Array.isArray(reward.riskFlags) ? reward.riskFlags.map(String) : [];
    reward.status = "delayed_review";
    reward.points = 0;
    reward.pendingPoints = Math.max(1, Number(reward.pendingPoints || 1));
    reward.delayReason = "mutual_source_reward_loop";
    reward.riskFlags = riskFlags.includes("mutual_source_reward_loop")
      ? riskFlags
      : [...riskFlags, "mutual_source_reward_loop"];
    return reward;
  }

  function createPendingSourceReward(existingClaim: PublicClaim, source: UnknownRecord, fromExplorerId: string) {
    return {
      claimId: existingClaim.claimId,
      rewardedExplorerId: compactText(existingClaim.sources[0]?.explorerId),
      fromExplorerId,
      reason: "claim_reused",
      status: "pending",
      points: 0,
      pendingPoints: 1,
      runTicket: source.runTicket,
      supportingExplorerIds: [fromExplorerId],
    };
  }

  function addSourceReward(existingClaim: PublicClaim, source: UnknownRecord) {
    const originalSource = existingClaim.sources[0];
    const rewardedExplorerId = compactText(originalSource?.explorerId);
    const fromExplorerId = compactText(source.explorerId);
    if (!rewardedExplorerId || !fromExplorerId || rewardedExplorerId === fromExplorerId) return null;
    const gate = operationSwitches.gate({
      action: "source_reward",
      rewardType: "claim_reuse",
      commissionType: compactText(source.commissionType) || undefined,
      chapterId: compactText(source.chapterId) || undefined,
      locationId: compactText(source.locationId) || undefined,
      factionId: compactText(source.factionId) || undefined,
      riskLevel: compactText(source.riskLevel) || undefined,
    });
    if (gate.paused) return null;

    const existingReward = sourceRewards.find((reward) =>
      reward.claimId === existingClaim.claimId && reward.rewardedExplorerId === rewardedExplorerId);
    const mutualLoopRewards = mutualSourceRewardLoops(rewardedExplorerId, fromExplorerId);
    if (mutualLoopRewards.length) {
      mutualLoopRewards.forEach(markMutualSourceRewardLoop);
      if (existingReward) {
        const supportingExplorerIds = sourceRewardSupportingExplorerIds(existingReward);
        if (!supportingExplorerIds.includes(fromExplorerId)) {
          existingReward.supportingExplorerIds = [...supportingExplorerIds, fromExplorerId];
        }
        return cloneSourceReward(markMutualSourceRewardLoop(existingReward));
      }
      const reward = markMutualSourceRewardLoop(createPendingSourceReward(existingClaim, source, fromExplorerId));
      sourceRewards.push(reward);
      return cloneSourceReward(reward);
    }
    if (existingReward) {
      const supportingExplorerIds = sourceRewardSupportingExplorerIds(existingReward);
      if (supportingExplorerIds.includes(fromExplorerId)) return null;
      const nextSupportingExplorerIds = [...supportingExplorerIds, fromExplorerId];
      existingReward.supportingExplorerIds = nextSupportingExplorerIds;
      if (existingReward.status === "pending") {
        existingReward.status = "released";
        existingReward.points = Math.max(1, Number(existingReward.pendingPoints || 1));
        existingReward.releasedByExplorerId = fromExplorerId;
        existingReward.releasedByRunTicket = source.runTicket;
        existingReward.releaseReason = "second_independent_reuse";
        return cloneSourceReward(existingReward);
      }
      return null;
    }

    const reward = createPendingSourceReward(existingClaim, source, fromExplorerId);
    sourceRewards.push(reward);
    return cloneSourceReward(reward);
  }

  function addConflict(existingClaim: PublicClaim, disputedClaim: PublicClaim) {
    const conflictId = stableId("conflict", [existingClaim.conflictKey, existingClaim.claimId, disputedClaim.claimId]);
    const conflict = {
      conflictId,
      status: "open",
      key: existingClaim.conflictKey,
      claimIds: [existingClaim.claimId, disputedClaim.claimId],
    };
    conflicts.push(conflict);
    return conflict;
  }

  function cloneClaim(claim: PublicClaim) {
    return {
      ...claim,
      sources: claim.sources.map((item) => ({ ...item })),
      statusHistory: claim.statusHistory.map((entry) => ({ ...entry })),
    };
  }

  function transitionClaimStatus(input: UnknownRecord = {}) {
    const claimId = compactText(input.claimId);
    const toStatus = compactText(input.status);
    const claim = claims.find((item) => item.claimId === claimId);
    if (!claim) throw new Error("claim_not_found");
    if (!toStatus) throw new Error("claim_status_required");
    if (claim.status === toStatus) return cloneClaim(claim);

    const manualApprovalId = compactText(input.manualApprovalId);
    const canonAdoptionEventId = compactText(input.canonAdoptionEventId);
    const hasOverride = Boolean(manualApprovalId || canonAdoptionEventId);
    if (!isClaimStatusTransitionAllowed(claim.status, toStatus) && !hasOverride) {
      throw new Error("claim_status_transition_invalid");
    }

    const changedAt = compactText(input.changedAt) || new Date().toISOString();
    claim.statusHistory.push({
      fromStatus: claim.status,
      toStatus,
      reason: compactText(input.reason) || (hasOverride ? "approved_status_override" : "allowed_status_transition"),
      manualApprovalId: manualApprovalId || undefined,
      canonAdoptionEventId: canonAdoptionEventId || undefined,
      changedAt,
    });
    claim.status = toStatus;
    return cloneClaim(claim);
  }

  function admitRunClaims({ source = {}, run = {} }: { readonly source?: UnknownRecord; readonly run?: UnknownRecord }) {
    const candidateClaims = extractCandidateClaims(run);
    const decisions: LoreAdmissionDecision[] = [];
    let consumedSlots = 0;
    const claimSlots = Math.max(0, Number(source.claimSlots || 0));

    for (const claim of candidateClaims) {
      if (!claim.subject || !claim.predicate || !claim.object) {
        decisions.push({ status: "rejected", reason: "claim_incomplete", claim });
        continue;
      }

      const lowRiskGate = lowRiskRumorGate(source);
      const existing = findExact(claim);
      if (existing) {
        existing.sources.push(sourceRecord(source, claim));
        if (lowRiskGate.capped) {
          decisions.push({
            status: "evidence_supplement",
            reason: lowRiskGate.reason,
            claimId: existing.claimId,
            claim,
            reward: null,
          });
          continue;
        }
        const reward = addSourceReward(existing, source);
        recordLowRiskRumorAdmission(source, existing.claimId, lowRiskGate);
        decisions.push({ status: "duplicate", claimId: existing.claimId, claim, reward });
        continue;
      }

      if (lowRiskGate.capped) {
        decisions.push({ status: "personal_sealed", reason: lowRiskGate.reason, claim });
        continue;
      }

      if (consumedSlots >= claimSlots) {
        decisions.push({ status: "shadow", reason: "claim_slot_limit", claim });
        continue;
      }

      const conflicting = findConflict(claim);
      const status = lowRiskGate.lowRisk ? "rumor" : conflicting ? "disputed" : "canonical";
      const admitted = publicClaimFrom(claim, source, status);
      claims.push(admitted);
      consumedSlots += 1;
      recordLowRiskRumorAdmission(source, admitted.claimId, lowRiskGate);

      if (conflicting) {
        const conflict = addConflict(conflicting, admitted);
        decisions.push({ status, claimId: admitted.claimId, claim, conflict });
      } else {
        decisions.push({ status, claimId: admitted.claimId, claim });
      }
    }

    return {
      decisions,
      accepted: decisions.filter((decision) => ["canonical", "disputed", "duplicate", "rumor"].includes(decision.status)),
    };
  }

  return {
    admitRunClaims,
    transitionClaimStatus,
    state: () => ({
      claims: claims.map(cloneClaim),
      conflicts: conflicts.map((conflict) => ({ ...conflict, claimIds: [...conflict.claimIds] })),
      sourceRewards: sourceRewards.map(cloneSourceReward),
      lowRiskRumorAdmissions: lowRiskRumorAdmissions.map((entry) => ({ ...entry })),
    }),
  };
}
