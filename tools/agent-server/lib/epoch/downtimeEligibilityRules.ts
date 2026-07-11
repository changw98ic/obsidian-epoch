import type {
  EpochDowntimeMode,
  EpochResourceId,
} from "./protocol.ts";

export const DOWNTIME_REGION_SAFETY_LEVELS = [
  "hazardous",
  "unstable",
  "guarded",
  "secure",
] as const;

export type DowntimeRegionSafetyLevel = typeof DOWNTIME_REGION_SAFETY_LEVELS[number];
export type DowntimeCustodyStatus = "free" | "imprisoned";
export type DowntimeSnapshotCustodyStatus = DowntimeCustodyStatus | "unknown";
export type DowntimeSnapshotIdentityStatus = "active" | "archived" | "missing";
export type DowntimeSnapshotRegionSafety = DowntimeRegionSafetyLevel | "unknown";

export const DEFAULT_DOWNTIME_SET_COOLDOWN_SECONDS = 5 * 60;
export const DEFAULT_DOWNTIME_CLAIM_COOLDOWN_SECONDS = 5 * 60;

export interface DowntimePreparationRequirement {
  readonly resourceId: EpochResourceId;
  readonly minimumBalance: number;
}

export interface DowntimeModeEligibilityPolicy {
  readonly minimumSafety: DowntimeRegionSafetyLevel;
  readonly preparation: readonly DowntimePreparationRequirement[];
}

export const DOWNTIME_MODE_ELIGIBILITY_POLICIES: Record<EpochDowntimeMode, DowntimeModeEligibilityPolicy> = {
  meditation: {
    minimumSafety: "unstable",
    preparation: [],
  },
  cultivation: {
    minimumSafety: "guarded",
    preparation: [{ resourceId: "aether", minimumBalance: 1 }],
  },
  training: {
    minimumSafety: "unstable",
    preparation: [{ resourceId: "stamina", minimumBalance: 1 }],
  },
  resting: {
    minimumSafety: "hazardous",
    preparation: [],
  },
  slacking: {
    minimumSafety: "unstable",
    preparation: [],
  },
  travel: {
    minimumSafety: "guarded",
    preparation: [{ resourceId: "stamina", minimumBalance: 2 }],
  },
  steward: {
    minimumSafety: "secure",
    preparation: [{ resourceId: "coin", minimumBalance: 5 }],
  },
  socialize: {
    minimumSafety: "guarded",
    preparation: [{ resourceId: "focus", minimumBalance: 1 }],
  },
};

export const DOWNTIME_ELIGIBILITY_ERROR_CODES = [
  "downtime_identity_not_found",
  "downtime_identity_inactive",
  "downtime_imprisonment_state_unknown",
  "downtime_agent_imprisoned",
  "downtime_active_turn_card",
  "downtime_active_hosted_session",
  "downtime_open_party_run",
  "downtime_not_active",
  "downtime_region_projection_mismatch",
  "downtime_region_safety_unknown",
  "downtime_region_safety_insufficient",
  "downtime_preparation_resource_insufficient",
  "downtime_set_rate_limited",
  "downtime_claim_rate_limited",
  "downtime_server_time_invalid",
  "downtime_projection_time_invalid",
] as const;

export type DowntimeEligibilityErrorCode = typeof DOWNTIME_ELIGIBILITY_ERROR_CODES[number];

export interface DowntimeEligibilityIdentityProjection {
  readonly status: "active" | "archived";
}

export interface DowntimeEligibilityStateProjection {
  readonly mode: EpochDowntimeMode;
  readonly regionId: string;
  readonly startedAt: string;
  readonly active: boolean;
  readonly lastClaimedAt?: string;
}

export interface DowntimeEligibilityTurnCardProjection {
  readonly agentId: string;
  readonly status: "open" | "resolved";
}

export interface DowntimeEligibilityHostedSessionProjection {
  readonly agentId: string;
  readonly status: "active" | "completed";
}

export interface DowntimeEligibilityPartyMemberProjection {
  readonly agentId: string;
}

export interface DowntimeEligibilityPartyRunProjection {
  readonly leaderAgentId: string;
  readonly status: "open" | "settled";
  readonly members: readonly DowntimeEligibilityPartyMemberProjection[];
}

export interface DowntimeEligibilityAgentStatusProjection {
  readonly custodyStatus: DowntimeCustodyStatus;
}

export interface DowntimeEligibilityRegionSafetyProjection {
  readonly level: DowntimeRegionSafetyLevel;
}

export interface DowntimeEligibilityProjection {
  readonly identities: Readonly<Record<string, DowntimeEligibilityIdentityProjection | undefined>>;
  readonly resourceBalances: Readonly<Record<string, Partial<Record<EpochResourceId, number>> | undefined>>;
  readonly downtime: Readonly<Record<string, DowntimeEligibilityStateProjection | undefined>>;
  readonly turnCards: Readonly<Record<string, DowntimeEligibilityTurnCardProjection | undefined>>;
  readonly hostedSessions: Readonly<Record<string, DowntimeEligibilityHostedSessionProjection | undefined>>;
  readonly partyRuns: Readonly<Record<string, DowntimeEligibilityPartyRunProjection | undefined>>;
  readonly downtimeAgentStatuses: Readonly<Record<string, DowntimeEligibilityAgentStatusProjection | undefined>>;
  readonly regionSafetyStates: Readonly<Record<string, DowntimeEligibilityRegionSafetyProjection | undefined>>;
}

export interface DowntimeEligibilitySnapshot {
  readonly agentId: string;
  readonly identityStatus: DowntimeSnapshotIdentityStatus;
  readonly custodyStatus: DowntimeSnapshotCustodyStatus;
  readonly regionId: string;
  readonly regionSafety: DowntimeSnapshotRegionSafety;
  readonly resourceBalances: Readonly<Partial<Record<EpochResourceId, number>>>;
  readonly openTurnCardIds: readonly string[];
  readonly activeHostedSessionIds: readonly string[];
  readonly openPartyRunIds: readonly string[];
  readonly downtime?: DowntimeEligibilityStateProjection;
}

export interface BuildDowntimeEligibilitySnapshotInput {
  readonly projection: DowntimeEligibilityProjection;
  readonly agentId: string;
  readonly regionId: string;
}

export interface BuildDowntimeClaimEligibilitySnapshotInput {
  readonly projection: DowntimeEligibilityProjection;
  readonly agentId: string;
}

export interface EvaluateDowntimeSetEligibilityInput {
  readonly snapshot: DowntimeEligibilitySnapshot;
  readonly mode: EpochDowntimeMode;
  readonly serverNow: string;
}

export interface EvaluateDowntimeClaimEligibilityInput {
  readonly snapshot: DowntimeEligibilitySnapshot;
  readonly serverNow: string;
}

export interface EvaluateDowntimeTickEligibilityInput {
  readonly snapshot: DowntimeEligibilitySnapshot;
}

export interface DowntimeEligibilityAllowed {
  readonly eligible: true;
}

export interface DowntimeEligibilityDenied {
  readonly eligible: false;
  readonly code: DowntimeEligibilityErrorCode;
  readonly blockingId?: string;
  readonly retryAt?: string;
  readonly actualSafety?: DowntimeRegionSafetyLevel;
  readonly requiredSafety?: DowntimeRegionSafetyLevel;
  readonly resourceId?: EpochResourceId;
  readonly actualBalance?: number;
  readonly requiredBalance?: number;
}

export type DowntimeEligibilityResult = DowntimeEligibilityAllowed | DowntimeEligibilityDenied;

const ALLOWED: DowntimeEligibilityAllowed = { eligible: true };

function sortedMatchingIds<T>(
  records: Readonly<Record<string, T | undefined>>,
  predicate: (record: T) => boolean,
): readonly string[] {
  return Object.entries(records)
    .filter((entry): entry is [string, T] => Boolean(entry[1]) && predicate(entry[1] as T))
    .map(([id]) => id)
    .sort();
}

export function buildDowntimeEligibilitySnapshot(
  input: BuildDowntimeEligibilitySnapshotInput,
): DowntimeEligibilitySnapshot {
  const identity = input.projection.identities[input.agentId];
  const agentStatus = input.projection.downtimeAgentStatuses[input.agentId];
  const safety = input.projection.regionSafetyStates[input.regionId];
  const resourceBalances = input.projection.resourceBalances[input.agentId] || {};

  return {
    agentId: input.agentId,
    identityStatus: identity?.status || "missing",
    custodyStatus: agentStatus?.custodyStatus || "unknown",
    regionId: input.regionId,
    regionSafety: safety?.level || "unknown",
    resourceBalances: { ...resourceBalances },
    openTurnCardIds: sortedMatchingIds(
      input.projection.turnCards,
      (card) => card.agentId === input.agentId && card.status === "open",
    ),
    activeHostedSessionIds: sortedMatchingIds(
      input.projection.hostedSessions,
      (session) => session.agentId === input.agentId && session.status === "active",
    ),
    openPartyRunIds: sortedMatchingIds(
      input.projection.partyRuns,
      (partyRun) => partyRun.status === "open" && (
        partyRun.leaderAgentId === input.agentId
        || partyRun.members.some((member) => member.agentId === input.agentId)
      ),
    ),
    downtime: input.projection.downtime[input.agentId],
  };
}

export function buildDowntimeClaimEligibilitySnapshot(
  input: BuildDowntimeClaimEligibilitySnapshotInput,
): DowntimeEligibilitySnapshot {
  return buildDowntimeEligibilitySnapshot({
    projection: input.projection,
    agentId: input.agentId,
    regionId: input.projection.downtime[input.agentId]?.regionId || "",
  });
}

function denied(
  code: DowntimeEligibilityErrorCode,
  details: Omit<DowntimeEligibilityDenied, "eligible" | "code"> = {},
): DowntimeEligibilityDenied {
  return { eligible: false, code, ...details };
}

function commonEligibility(snapshot: DowntimeEligibilitySnapshot): DowntimeEligibilityResult {
  if (snapshot.identityStatus === "missing") {
    return denied("downtime_identity_not_found");
  }
  if (snapshot.identityStatus !== "active") {
    return denied("downtime_identity_inactive");
  }
  if (snapshot.custodyStatus === "unknown") {
    return denied("downtime_imprisonment_state_unknown");
  }
  if (snapshot.custodyStatus === "imprisoned") {
    return denied("downtime_agent_imprisoned");
  }
  const openTurnCardId = snapshot.openTurnCardIds[0];
  if (openTurnCardId) {
    return denied("downtime_active_turn_card", { blockingId: openTurnCardId });
  }
  const activeHostedSessionId = snapshot.activeHostedSessionIds[0];
  if (activeHostedSessionId) {
    return denied("downtime_active_hosted_session", { blockingId: activeHostedSessionId });
  }
  const openPartyRunId = snapshot.openPartyRunIds[0];
  if (openPartyRunId) {
    return denied("downtime_open_party_run", { blockingId: openPartyRunId });
  }
  return ALLOWED;
}

const SAFETY_RANK: Record<DowntimeRegionSafetyLevel, number> = {
  hazardous: 0,
  unstable: 1,
  guarded: 2,
  secure: 3,
};

function modeEligibility(
  snapshot: DowntimeEligibilitySnapshot,
  mode: EpochDowntimeMode,
): DowntimeEligibilityResult {
  const policy = DOWNTIME_MODE_ELIGIBILITY_POLICIES[mode];
  if (snapshot.regionSafety === "unknown") {
    return denied("downtime_region_safety_unknown", {
      requiredSafety: policy.minimumSafety,
    });
  }
  if (SAFETY_RANK[snapshot.regionSafety] < SAFETY_RANK[policy.minimumSafety]) {
    return denied("downtime_region_safety_insufficient", {
      actualSafety: snapshot.regionSafety,
      requiredSafety: policy.minimumSafety,
    });
  }
  for (const requirement of policy.preparation) {
    const actualBalance = snapshot.resourceBalances[requirement.resourceId] || 0;
    if (actualBalance < requirement.minimumBalance) {
      return denied("downtime_preparation_resource_insufficient", {
        resourceId: requirement.resourceId,
        actualBalance,
        requiredBalance: requirement.minimumBalance,
      });
    }
  }
  return ALLOWED;
}

function parsedTimestamp(value: string): number | undefined {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function cooldownEligibility(input: {
  readonly serverNow: string;
  readonly sourceTime?: string;
  readonly cooldownSeconds: number;
  readonly rateLimitCode: "downtime_set_rate_limited" | "downtime_claim_rate_limited";
}): DowntimeEligibilityResult {
  const nowMs = parsedTimestamp(input.serverNow);
  if (nowMs === undefined) return denied("downtime_server_time_invalid");
  if (!input.sourceTime) return ALLOWED;
  const sourceMs = parsedTimestamp(input.sourceTime);
  if (sourceMs === undefined) return denied("downtime_projection_time_invalid");
  const retryAtMs = sourceMs + input.cooldownSeconds * 1_000;
  if (nowMs < retryAtMs) {
    return denied(input.rateLimitCode, {
      retryAt: new Date(retryAtMs).toISOString(),
    });
  }
  return ALLOWED;
}

function latestDowntimeMutationTime(
  downtime: DowntimeEligibilityStateProjection | undefined,
): string | undefined {
  if (!downtime) return undefined;
  if (!downtime.lastClaimedAt) return downtime.startedAt;
  const startedAtMs = parsedTimestamp(downtime.startedAt);
  const claimedAtMs = parsedTimestamp(downtime.lastClaimedAt);
  if (startedAtMs === undefined || claimedAtMs === undefined) {
    return downtime.lastClaimedAt;
  }
  return claimedAtMs >= startedAtMs ? downtime.lastClaimedAt : downtime.startedAt;
}

export function evaluateDowntimeSetEligibility(
  input: EvaluateDowntimeSetEligibilityInput,
): DowntimeEligibilityResult {
  const common = commonEligibility(input.snapshot);
  if (!common.eligible) return common;
  const mode = modeEligibility(input.snapshot, input.mode);
  if (!mode.eligible) return mode;
  return cooldownEligibility({
    serverNow: input.serverNow,
    sourceTime: latestDowntimeMutationTime(input.snapshot.downtime),
    cooldownSeconds: DEFAULT_DOWNTIME_SET_COOLDOWN_SECONDS,
    rateLimitCode: "downtime_set_rate_limited",
  });
}

export function evaluateDowntimeClaimEligibility(
  input: EvaluateDowntimeClaimEligibilityInput,
): DowntimeEligibilityResult {
  const common = commonEligibility(input.snapshot);
  if (!common.eligible) return common;
  const downtime = input.snapshot.downtime;
  if (!downtime?.active) return denied("downtime_not_active");
  if (input.snapshot.regionId !== downtime.regionId) {
    return denied("downtime_region_projection_mismatch");
  }
  const mode = modeEligibility(input.snapshot, downtime.mode);
  if (!mode.eligible) return mode;
  return cooldownEligibility({
    serverNow: input.serverNow,
    sourceTime: downtime.startedAt,
    cooldownSeconds: DEFAULT_DOWNTIME_CLAIM_COOLDOWN_SECONDS,
    rateLimitCode: "downtime_claim_rate_limited",
  });
}

export function evaluateDowntimeTickEligibility(
  input: EvaluateDowntimeTickEligibilityInput,
): DowntimeEligibilityResult {
  const common = commonEligibility(input.snapshot);
  if (!common.eligible) return common;
  const downtime = input.snapshot.downtime;
  if (!downtime?.active) return denied("downtime_not_active");
  if (input.snapshot.regionId !== downtime.regionId) {
    return denied("downtime_region_projection_mismatch");
  }
  return modeEligibility(input.snapshot, downtime.mode);
}

function requireEligibility(result: DowntimeEligibilityResult): void {
  if (!result.eligible) throw new Error(result.code);
}

export function requireDowntimeSetEligibility(input: EvaluateDowntimeSetEligibilityInput): void {
  requireEligibility(evaluateDowntimeSetEligibility(input));
}

export function requireDowntimeClaimEligibility(input: EvaluateDowntimeClaimEligibilityInput): void {
  requireEligibility(evaluateDowntimeClaimEligibility(input));
}

export function requireDowntimeTickEligibility(input: EvaluateDowntimeTickEligibilityInput): void {
  requireEligibility(evaluateDowntimeTickEligibility(input));
}
