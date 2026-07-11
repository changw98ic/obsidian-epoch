import { stableKey, type EpochResourceId } from "./protocol.ts";

export const CONTRACT_MARKET_TYPES = [
  "scouting",
  "evidence",
  "protection",
  "bounty",
  "counter_bounty",
] as const;

export type ContractMarketType = typeof CONTRACT_MARKET_TYPES[number];

export const CONTRACT_MARKET_STATUSES = [
  "open",
  "accepted",
  "submitted",
  "completed",
  "rejected",
  "cancelled",
  "expired",
] as const;

export type ContractMarketStatus = typeof CONTRACT_MARKET_STATUSES[number];

export const CONTRACT_MARKET_RISK_FLAGS = [
  "high_value_contract",
  "repeat_opponent_contract",
] as const;

export type ContractMarketRiskFlag = typeof CONTRACT_MARKET_RISK_FLAGS[number];

export const CONTRACT_MARKET_HIGH_VALUE_THRESHOLD = 1_000;
export const CONTRACT_MARKET_REPEAT_OPPONENT_THRESHOLD = 2;
export const CONTRACT_MARKET_REPEAT_OPPONENT_WINDOW_SECONDS = 7 * 24 * 60 * 60;

export type ContractMarketNpcFamilyRole =
  | "none"
  | "child"
  | "partner"
  | "parent"
  | "sibling"
  | "dependent";

export type ContractMarketTarget =
  | {
    readonly kind: "agent";
    readonly agentId: string;
    readonly explorerId: string;
  }
  | {
    readonly kind: "npc";
    readonly npcId: string;
    readonly traits: readonly string[];
    readonly familyRole?: ContractMarketNpcFamilyRole;
    readonly householdIds?: readonly string[];
  }
  | {
    readonly kind: "region";
    readonly regionId: string;
  };

export interface ContractMarketReward {
  readonly resourceId: EpochResourceId;
  readonly amount: number;
}

export interface ContractMarketSourceBounty {
  readonly bountyId: string;
  readonly regionId: string;
  readonly sponsorAgentId: string;
  readonly sponsorExplorerId: string;
  readonly target: ContractMarketTarget;
  readonly status: "open" | "claimed" | "cancelled" | "expired";
}

export interface ContractMarketHistoryRecord {
  readonly contractId: string;
  readonly contractType: ContractMarketType;
  readonly creatorExplorerId: string;
  readonly contractorExplorerId?: string;
  readonly target?: ContractMarketTarget;
  readonly status: ContractMarketStatus;
  readonly createdAt: string;
}

export interface ContractMarketSubmission {
  readonly summary: string;
  readonly sourceEventIds: readonly string[];
  readonly submittedAt: string;
}

export interface ContractMarketAdjudication {
  readonly decisionId: string;
  readonly resolution: "approved" | "rejected";
  readonly reason: string;
  readonly sourceEventIds: readonly string[];
  readonly adjudicatedBy: string;
  readonly adjudicatedAt: string;
}

export interface ContractMarketEscrow {
  readonly status: "locked" | "released" | "refunded";
  readonly reward: ContractMarketReward;
  readonly sponsorAgentId: string;
  readonly sponsorExplorerId: string;
  readonly lockedAt: string;
  readonly recipientAgentId?: string;
  readonly recipientExplorerId?: string;
  readonly settledAt?: string;
  readonly settlementReason?: "completed" | "rejected" | "cancelled" | "expired";
}

export interface ContractMarketContract {
  readonly contractId: string;
  readonly contractType: ContractMarketType;
  readonly regionId: string;
  readonly creatorAgentId: string;
  readonly creatorExplorerId: string;
  readonly title: string;
  readonly description: string;
  readonly reward: ContractMarketReward;
  readonly target?: ContractMarketTarget;
  readonly sourceBountyId?: string;
  readonly status: ContractMarketStatus;
  readonly riskFlags: readonly ContractMarketRiskFlag[];
  readonly riskScore: number;
  readonly escrow: ContractMarketEscrow;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly contractorAgentId?: string;
  readonly contractorExplorerId?: string;
  readonly acceptedAt?: string;
  readonly submission?: ContractMarketSubmission;
  readonly adjudication?: ContractMarketAdjudication;
  readonly completedAt?: string;
  readonly rejectedAt?: string;
  readonly cancelledAt?: string;
  readonly expiredAt?: string;
}

export interface ContractMarketProjection {
  readonly contracts: Readonly<Record<string, ContractMarketContract | undefined>>;
}

export interface ContractMarketCreateRequest {
  readonly contractId: string;
  readonly contractType: ContractMarketType;
  readonly regionId: string;
  readonly creatorAgentId: string;
  readonly creatorExplorerId: string;
  readonly title: string;
  readonly description: string;
  readonly reward: ContractMarketReward;
  readonly target?: ContractMarketTarget;
  readonly sourceBountyId?: string;
  readonly createdAt: string;
  readonly expiresAt: string;
}

export interface PlanContractMarketCreationInput extends ContractMarketCreateRequest {
  readonly sponsorBalanceBefore: number;
  readonly sourceBounty?: ContractMarketSourceBounty;
  readonly history?: readonly ContractMarketHistoryRecord[];
  readonly highValueThreshold?: number;
}

export interface ContractMarketAcceptRequest {
  readonly contractId: string;
  readonly contractorAgentId: string;
  readonly contractorExplorerId: string;
  readonly acceptedAt: string;
}

export interface PlanContractMarketAcceptanceInput extends ContractMarketAcceptRequest {
  readonly contract: ContractMarketContract;
  readonly history?: readonly ContractMarketHistoryRecord[];
}

export interface ContractMarketSubmitRequest {
  readonly contractId: string;
  readonly contractorAgentId: string;
  readonly contractorExplorerId: string;
  readonly summary: string;
  readonly sourceEventIds?: readonly string[];
  readonly submittedAt: string;
}

export interface PlanContractMarketSubmissionInput extends ContractMarketSubmitRequest {
  readonly contract: ContractMarketContract;
  readonly canonicalSourceEventIds: readonly string[];
}

export interface ContractMarketServerAuthority {
  readonly kind: "server";
  readonly actorId: string;
  readonly decisionId: string;
}

export interface PlanServerContractAdjudicationInput {
  readonly contract: ContractMarketContract;
  readonly authority: ContractMarketServerAuthority;
  readonly resolution: "approved" | "rejected";
  readonly reason: string;
  readonly sourceEventIds: readonly string[];
  readonly canonicalSourceEventIds: readonly string[];
  readonly recipientBalanceBefore: number;
  readonly adjudicatedAt: string;
}

export interface PlanContractMarketCancellationInput {
  readonly contract: ContractMarketContract;
  readonly requesterExplorerId: string;
  readonly sponsorBalanceBefore: number;
  readonly cancelledAt: string;
}

export interface PlanContractMarketExpiryInput {
  readonly contract: ContractMarketContract;
  readonly sponsorBalanceBefore: number;
  readonly expiredAt: string;
}

export interface ContractRewardEscrowLockedPayload {
  readonly contractId: string;
  readonly sponsorAgentId: string;
  readonly sponsorExplorerId: string;
  readonly reward: ContractMarketReward;
  readonly balanceAfter: number;
  readonly lockedAt: string;
}

export interface ContractCreatedPayload extends ContractMarketCreateRequest {
  readonly riskFlags: readonly ContractMarketRiskFlag[];
  readonly riskScore: number;
}

export interface ContractAcceptedPayload {
  readonly contractId: string;
  readonly contractorAgentId: string;
  readonly contractorExplorerId: string;
  readonly riskFlags: readonly ContractMarketRiskFlag[];
  readonly riskScore: number;
  readonly acceptedAt: string;
}

export interface ContractSubmittedPayload {
  readonly contractId: string;
  readonly contractorAgentId: string;
  readonly contractorExplorerId: string;
  readonly summary: string;
  readonly sourceEventIds: readonly string[];
  readonly submittedAt: string;
}

export interface ContractServerAdjudicatedPayload {
  readonly contractId: string;
  readonly decisionId: string;
  readonly resolution: "approved" | "rejected";
  readonly reason: string;
  readonly sourceEventIds: readonly string[];
  readonly adjudicatedBy: string;
  readonly adjudicatedAt: string;
}

export interface ContractRewardEscrowReleasedPayload {
  readonly contractId: string;
  readonly decisionId: string;
  readonly recipientAgentId: string;
  readonly recipientExplorerId: string;
  readonly reward: ContractMarketReward;
  readonly balanceAfter: number;
  readonly releasedAt: string;
}

export interface ContractRewardEscrowRefundedPayload {
  readonly contractId: string;
  readonly sponsorAgentId: string;
  readonly sponsorExplorerId: string;
  readonly reward: ContractMarketReward;
  readonly balanceAfter: number;
  readonly reason: "rejected" | "cancelled" | "expired";
  readonly refundedAt: string;
}

export interface ContractCompletedPayload {
  readonly contractId: string;
  readonly decisionId: string;
  readonly completedAt: string;
}

export interface ContractRejectedPayload {
  readonly contractId: string;
  readonly decisionId: string;
  readonly reason: string;
  readonly rejectedAt: string;
}

export interface ContractCancelledPayload {
  readonly contractId: string;
  readonly cancelledByExplorerId: string;
  readonly cancelledAt: string;
}

export interface ContractExpiredPayload {
  readonly contractId: string;
  readonly expiredAt: string;
}

export interface ContractMarketEventPayloadMap {
  readonly contract_reward_escrow_locked: ContractRewardEscrowLockedPayload;
  readonly contract_created: ContractCreatedPayload;
  readonly contract_accepted: ContractAcceptedPayload;
  readonly contract_submitted: ContractSubmittedPayload;
  readonly contract_server_adjudicated: ContractServerAdjudicatedPayload;
  readonly contract_reward_escrow_released: ContractRewardEscrowReleasedPayload;
  readonly contract_reward_escrow_refunded: ContractRewardEscrowRefundedPayload;
  readonly contract_completed: ContractCompletedPayload;
  readonly contract_rejected: ContractRejectedPayload;
  readonly contract_cancelled: ContractCancelledPayload;
  readonly contract_expired: ContractExpiredPayload;
}

export type ContractMarketEventType = keyof ContractMarketEventPayloadMap;

export type ContractMarketPlannedEventOf<TType extends ContractMarketEventType> = {
  readonly eventType: TType;
  readonly aggregateType: "contract";
  readonly aggregateId: string;
  readonly agentId: string;
  readonly payload: ContractMarketEventPayloadMap[TType];
};

export type ContractMarketPlannedEvent = {
  [TType in ContractMarketEventType]: ContractMarketPlannedEventOf<TType>;
}[ContractMarketEventType];

export type ContractMarketProjectableEvent = {
  [TType in ContractMarketEventType]: ContractMarketPlannedEventOf<TType> & {
    readonly eventId: string;
  };
}[ContractMarketEventType];

export interface ContractMarketRiskAssessment {
  readonly flags: readonly ContractMarketRiskFlag[];
  readonly score: number;
}

export interface ContractMarketExpirySelectionInput {
  readonly expiredAt: string;
  readonly limit?: number;
}

function plannedEvent<TType extends ContractMarketEventType>(
  eventType: TType,
  contractId: string,
  agentId: string,
  payload: ContractMarketEventPayloadMap[TType],
): ContractMarketPlannedEventOf<TType> {
  return {
    eventType,
    aggregateType: "contract",
    aggregateId: contractId,
    agentId,
    payload,
  };
}

function requiredString(value: string, errorCode: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(errorCode);
  return normalized;
}

function timestamp(value: string, errorCode: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(errorCode);
  return parsed;
}

function positiveReward(reward: ContractMarketReward): ContractMarketReward {
  if (!Number.isSafeInteger(reward.amount) || reward.amount <= 0) {
    throw new Error("contract_reward_amount_invalid");
  }
  return reward;
}

function normalizedSourceEventIds(
  sourceEventIds: readonly string[] | undefined,
  required: boolean,
): readonly string[] {
  const normalized = [...new Set((sourceEventIds || []).map((eventId) => eventId.trim()).filter(Boolean))];
  if (required && normalized.length === 0) throw new Error("contract_source_event_ids_required");
  return normalized;
}

function assertCanonicalSourceEventIds(
  sourceEventIds: readonly string[],
  canonicalSourceEventIds: readonly string[],
): void {
  const canonical = new Set(canonicalSourceEventIds);
  for (const eventId of sourceEventIds) {
    if (!canonical.has(eventId)) throw new Error("contract_source_event_not_canonical");
  }
}

function targetKey(target: ContractMarketTarget | undefined): string | undefined {
  if (!target) return undefined;
  if (target.kind === "agent") return `agent:${target.agentId}:${target.explorerId}`;
  if (target.kind === "npc") return `npc:${target.npcId}`;
  return `region:${target.regionId}`;
}

function sameTarget(left: ContractMarketTarget | undefined, right: ContractMarketTarget | undefined): boolean {
  return targetKey(left) !== undefined && targetKey(left) === targetKey(right);
}

function isRecent(createdAt: string, evaluatedAt: string): boolean {
  const elapsedSeconds = Math.floor((timestamp(evaluatedAt, "contract_risk_time_invalid")
    - timestamp(createdAt, "contract_history_time_invalid")) / 1_000);
  return elapsedSeconds >= 0 && elapsedSeconds <= CONTRACT_MARKET_REPEAT_OPPONENT_WINDOW_SECONDS;
}

function riskScore(flags: readonly ContractMarketRiskFlag[]): number {
  return flags.reduce((score, flag) => score + (flag === "high_value_contract" ? 2 : 1), 0);
}

function mergeRiskFlags(...groups: readonly (readonly ContractMarketRiskFlag[])[]): readonly ContractMarketRiskFlag[] {
  return [...new Set(groups.flat())];
}

export function isProtectedFamilyNpcTarget(target: ContractMarketTarget | undefined): boolean {
  if (!target || target.kind !== "npc") return false;
  const traits = new Set(target.traits.map((trait) => stableKey(trait)));
  return traits.has("child")
    || traits.has("family")
    || traits.has("dependent")
    || (target.familyRole !== undefined && target.familyRole !== "none")
    || Boolean(target.householdIds?.length);
}

export function assertContractTargetAllowed(
  contractType: ContractMarketType,
  target: ContractMarketTarget | undefined,
): void {
  if (contractType === "scouting" && target?.kind !== "region") {
    throw new Error("scouting_contract_region_target_required");
  }
  if ((contractType === "bounty" || contractType === "counter_bounty") && !target) {
    throw new Error("contract_harvest_target_required");
  }
  if ((contractType === "bounty" || contractType === "counter_bounty") && target?.kind === "region") {
    throw new Error("contract_harvest_target_invalid");
  }
  if ((contractType === "bounty" || contractType === "counter_bounty") && isProtectedFamilyNpcTarget(target)) {
    throw new Error("contract_family_npc_target_protected");
  }
}

export function assertContractSourceBountyBinding(input: {
  readonly contractType: ContractMarketType;
  readonly regionId: string;
  readonly target?: ContractMarketTarget;
  readonly sourceBountyId?: string;
  readonly sourceBounty?: ContractMarketSourceBounty;
}): void {
  if (input.contractType !== "protection" && input.contractType !== "counter_bounty") return;
  if (!input.target) throw new Error("contract_source_bounty_target_required");
  if (!input.sourceBountyId || !input.sourceBounty || input.sourceBounty.bountyId !== input.sourceBountyId) {
    throw new Error("contract_source_bounty_required");
  }
  if (input.sourceBounty.status !== "open") throw new Error("contract_source_bounty_not_open");
  if (input.sourceBounty.regionId !== input.regionId) throw new Error("contract_source_bounty_region_mismatch");
  if (input.contractType === "protection" && !sameTarget(input.target, input.sourceBounty.target)) {
    throw new Error("protection_contract_target_mismatch");
  }
  if (input.contractType === "counter_bounty") {
    const expectedTarget: ContractMarketTarget = {
      kind: "agent",
      agentId: input.sourceBounty.sponsorAgentId,
      explorerId: input.sourceBounty.sponsorExplorerId,
    };
    if (!sameTarget(input.target, expectedTarget)) throw new Error("counter_bounty_target_mismatch");
  }
}

export function contractMarketCreationRisk(input: {
  readonly reward: ContractMarketReward;
  readonly creatorExplorerId: string;
  readonly target?: ContractMarketTarget;
  readonly evaluatedAt: string;
  readonly history?: readonly ContractMarketHistoryRecord[];
  readonly highValueThreshold?: number;
}): ContractMarketRiskAssessment {
  const flags: ContractMarketRiskFlag[] = [];
  const highValueThreshold = Math.max(1, input.highValueThreshold || CONTRACT_MARKET_HIGH_VALUE_THRESHOLD);
  if (input.reward.amount >= highValueThreshold) flags.push("high_value_contract");
  const currentTargetKey = targetKey(input.target);
  if (currentTargetKey) {
    const repeatCount = (input.history || []).filter((record) =>
      record.creatorExplorerId === input.creatorExplorerId
      && targetKey(record.target) === currentTargetKey
      && isRecent(record.createdAt, input.evaluatedAt)).length;
    if (repeatCount >= CONTRACT_MARKET_REPEAT_OPPONENT_THRESHOLD) flags.push("repeat_opponent_contract");
  }
  return { flags, score: riskScore(flags) };
}

export function contractMarketAcceptanceRisk(input: {
  readonly contract: ContractMarketContract;
  readonly contractorExplorerId: string;
  readonly acceptedAt: string;
  readonly history?: readonly ContractMarketHistoryRecord[];
}): ContractMarketRiskAssessment {
  const repeatCount = (input.history || []).filter((record) => {
    const samePair = record.creatorExplorerId === input.contract.creatorExplorerId
      && record.contractorExplorerId === input.contractorExplorerId;
    const reversePair = record.creatorExplorerId === input.contractorExplorerId
      && record.contractorExplorerId === input.contract.creatorExplorerId;
    return (samePair || reversePair) && isRecent(record.createdAt, input.acceptedAt);
  }).length;
  const acceptanceFlags: readonly ContractMarketRiskFlag[] = repeatCount >= CONTRACT_MARKET_REPEAT_OPPONENT_THRESHOLD
    ? ["repeat_opponent_contract"]
    : [];
  const flags = mergeRiskFlags(input.contract.riskFlags, acceptanceFlags);
  return { flags, score: riskScore(flags) };
}

export function planContractMarketCreation(
  input: PlanContractMarketCreationInput,
): readonly ContractMarketPlannedEvent[] {
  requiredString(input.contractId, "contract_id_required");
  requiredString(input.regionId, "contract_region_id_required");
  requiredString(input.creatorAgentId, "contract_creator_agent_id_required");
  requiredString(input.creatorExplorerId, "contract_creator_explorer_id_required");
  requiredString(input.title, "contract_title_required");
  requiredString(input.description, "contract_description_required");
  const reward = positiveReward(input.reward);
  if (input.sponsorBalanceBefore < reward.amount) throw new Error("contract_reward_balance_insufficient");
  const createdTime = timestamp(input.createdAt, "contract_created_at_invalid");
  if (timestamp(input.expiresAt, "contract_expires_at_invalid") <= createdTime) {
    throw new Error("contract_expiry_must_follow_creation");
  }
  assertContractTargetAllowed(input.contractType, input.target);
  assertContractSourceBountyBinding(input);
  const risk = contractMarketCreationRisk({
    reward,
    creatorExplorerId: input.creatorExplorerId,
    target: input.target,
    evaluatedAt: input.createdAt,
    history: input.history,
    highValueThreshold: input.highValueThreshold,
  });
  const lockedPayload: ContractRewardEscrowLockedPayload = {
    contractId: input.contractId,
    sponsorAgentId: input.creatorAgentId,
    sponsorExplorerId: input.creatorExplorerId,
    reward,
    balanceAfter: input.sponsorBalanceBefore - reward.amount,
    lockedAt: input.createdAt,
  };
  const createdPayload: ContractCreatedPayload = {
    contractId: input.contractId,
    contractType: input.contractType,
    regionId: input.regionId,
    creatorAgentId: input.creatorAgentId,
    creatorExplorerId: input.creatorExplorerId,
    title: input.title.trim(),
    description: input.description.trim(),
    reward,
    target: input.target,
    sourceBountyId: input.sourceBountyId,
    createdAt: input.createdAt,
    expiresAt: input.expiresAt,
    riskFlags: risk.flags,
    riskScore: risk.score,
  };
  return [
    plannedEvent("contract_reward_escrow_locked", input.contractId, input.creatorAgentId, lockedPayload),
    plannedEvent("contract_created", input.contractId, input.creatorAgentId, createdPayload),
  ];
}

export function planContractMarketAcceptance(
  input: PlanContractMarketAcceptanceInput,
): readonly ContractMarketPlannedEvent[] {
  assertContractStatus(input.contract, "open");
  if (input.contract.contractId !== input.contractId) throw new Error("contract_id_mismatch");
  if (input.contract.creatorExplorerId === input.contractorExplorerId) {
    throw new Error("contract_self_dealing_forbidden");
  }
  if (timestamp(input.acceptedAt, "contract_accepted_at_invalid") >= timestamp(
    input.contract.expiresAt,
    "contract_expires_at_invalid",
  )) throw new Error("contract_expired");
  const risk = contractMarketAcceptanceRisk({
    contract: input.contract,
    contractorExplorerId: input.contractorExplorerId,
    acceptedAt: input.acceptedAt,
    history: input.history,
  });
  const payload: ContractAcceptedPayload = {
    contractId: input.contract.contractId,
    contractorAgentId: requiredString(input.contractorAgentId, "contractor_agent_id_required"),
    contractorExplorerId: requiredString(input.contractorExplorerId, "contractor_explorer_id_required"),
    riskFlags: risk.flags,
    riskScore: risk.score,
    acceptedAt: input.acceptedAt,
  };
  return [plannedEvent("contract_accepted", input.contract.contractId, payload.contractorAgentId, payload)];
}

export function planContractMarketSubmission(
  input: PlanContractMarketSubmissionInput,
): readonly ContractMarketPlannedEvent[] {
  assertContractStatus(input.contract, "accepted");
  if (input.contract.contractId !== input.contractId) throw new Error("contract_id_mismatch");
  if (input.contract.contractorAgentId !== input.contractorAgentId
    || input.contract.contractorExplorerId !== input.contractorExplorerId) {
    throw new Error("contract_contractor_mismatch");
  }
  if (timestamp(input.submittedAt, "contract_submitted_at_invalid") >= timestamp(
    input.contract.expiresAt,
    "contract_expires_at_invalid",
  )) throw new Error("contract_expired");
  const sourceEventIds = normalizedSourceEventIds(
    input.sourceEventIds,
    input.contract.contractType === "evidence",
  );
  assertCanonicalSourceEventIds(sourceEventIds, input.canonicalSourceEventIds);
  const payload: ContractSubmittedPayload = {
    contractId: input.contract.contractId,
    contractorAgentId: input.contractorAgentId,
    contractorExplorerId: input.contractorExplorerId,
    summary: requiredString(input.summary, "contract_submission_summary_required"),
    sourceEventIds,
    submittedAt: input.submittedAt,
  };
  return [plannedEvent("contract_submitted", input.contract.contractId, input.contractorAgentId, payload)];
}

export function planServerContractAdjudication(
  input: PlanServerContractAdjudicationInput,
): readonly ContractMarketPlannedEvent[] {
  assertContractStatus(input.contract, "submitted");
  if (input.authority.kind !== "server") throw new Error("contract_server_authority_required");
  const sourceEventIds = normalizedSourceEventIds(input.sourceEventIds, true);
  assertCanonicalSourceEventIds(sourceEventIds, input.canonicalSourceEventIds);
  const adjudicationPayload: ContractServerAdjudicatedPayload = {
    contractId: input.contract.contractId,
    decisionId: requiredString(input.authority.decisionId, "contract_decision_id_required"),
    resolution: input.resolution,
    reason: requiredString(input.reason, "contract_adjudication_reason_required"),
    sourceEventIds,
    adjudicatedBy: requiredString(input.authority.actorId, "contract_adjudicator_required"),
    adjudicatedAt: input.adjudicatedAt,
  };
  const adjudicated = plannedEvent(
    "contract_server_adjudicated",
    input.contract.contractId,
    input.contract.contractorAgentId || input.contract.creatorAgentId,
    adjudicationPayload,
  );
  if (input.resolution === "approved") {
    if (!input.contract.contractorAgentId || !input.contract.contractorExplorerId) {
      throw new Error("contract_contractor_missing");
    }
    const releasedPayload: ContractRewardEscrowReleasedPayload = {
      contractId: input.contract.contractId,
      decisionId: input.authority.decisionId,
      recipientAgentId: input.contract.contractorAgentId,
      recipientExplorerId: input.contract.contractorExplorerId,
      reward: input.contract.reward,
      balanceAfter: input.recipientBalanceBefore + input.contract.reward.amount,
      releasedAt: input.adjudicatedAt,
    };
    const completedPayload: ContractCompletedPayload = {
      contractId: input.contract.contractId,
      decisionId: input.authority.decisionId,
      completedAt: input.adjudicatedAt,
    };
    return [
      adjudicated,
      plannedEvent(
        "contract_reward_escrow_released",
        input.contract.contractId,
        input.contract.contractorAgentId,
        releasedPayload,
      ),
      plannedEvent(
        "contract_completed",
        input.contract.contractId,
        input.contract.contractorAgentId,
        completedPayload,
      ),
    ];
  }
  const refundedPayload = contractEscrowRefundPayload(
    input.contract,
    input.recipientBalanceBefore,
    "rejected",
    input.adjudicatedAt,
  );
  const rejectedPayload: ContractRejectedPayload = {
    contractId: input.contract.contractId,
    decisionId: input.authority.decisionId,
    reason: input.reason.trim(),
    rejectedAt: input.adjudicatedAt,
  };
  return [
    adjudicated,
    plannedEvent(
      "contract_reward_escrow_refunded",
      input.contract.contractId,
      input.contract.creatorAgentId,
      refundedPayload,
    ),
    plannedEvent("contract_rejected", input.contract.contractId, input.contract.creatorAgentId, rejectedPayload),
  ];
}

export function contractEscrowRefundPayload(
  contract: ContractMarketContract,
  sponsorBalanceBefore: number,
  reason: ContractRewardEscrowRefundedPayload["reason"],
  refundedAt: string,
): ContractRewardEscrowRefundedPayload {
  if (contract.escrow.status !== "locked") throw new Error("contract_escrow_not_locked");
  return {
    contractId: contract.contractId,
    sponsorAgentId: contract.creatorAgentId,
    sponsorExplorerId: contract.creatorExplorerId,
    reward: contract.reward,
    balanceAfter: sponsorBalanceBefore + contract.reward.amount,
    reason,
    refundedAt,
  };
}

export function planContractMarketCancellation(
  input: PlanContractMarketCancellationInput,
): readonly ContractMarketPlannedEvent[] {
  assertContractStatus(input.contract, "open");
  if (input.requesterExplorerId !== input.contract.creatorExplorerId) throw new Error("contract_cancel_owner_required");
  const refund = contractEscrowRefundPayload(
    input.contract,
    input.sponsorBalanceBefore,
    "cancelled",
    input.cancelledAt,
  );
  const cancelled: ContractCancelledPayload = {
    contractId: input.contract.contractId,
    cancelledByExplorerId: input.requesterExplorerId,
    cancelledAt: input.cancelledAt,
  };
  return [
    plannedEvent("contract_reward_escrow_refunded", input.contract.contractId, input.contract.creatorAgentId, refund),
    plannedEvent("contract_cancelled", input.contract.contractId, input.contract.creatorAgentId, cancelled),
  ];
}

export function planContractMarketExpiry(
  input: PlanContractMarketExpiryInput,
): readonly ContractMarketPlannedEvent[] {
  if (input.contract.status !== "open" && input.contract.status !== "accepted") {
    throw new Error("contract_not_expirable");
  }
  if (timestamp(input.expiredAt, "contract_expired_at_invalid") < timestamp(
    input.contract.expiresAt,
    "contract_expires_at_invalid",
  )) throw new Error("contract_not_expired");
  const refund = contractEscrowRefundPayload(
    input.contract,
    input.sponsorBalanceBefore,
    "expired",
    input.expiredAt,
  );
  const expired: ContractExpiredPayload = {
    contractId: input.contract.contractId,
    expiredAt: input.expiredAt,
  };
  return [
    plannedEvent("contract_reward_escrow_refunded", input.contract.contractId, input.contract.creatorAgentId, refund),
    plannedEvent("contract_expired", input.contract.contractId, input.contract.creatorAgentId, expired),
  ];
}

export function selectExpirableContractMarketContracts(
  contracts: Readonly<Record<string, ContractMarketContract | undefined>>,
  input: ContractMarketExpirySelectionInput,
): readonly ContractMarketContract[] {
  const expiredTime = timestamp(input.expiredAt, "contract_expired_at_invalid");
  const limit = Math.max(1, Math.min(Math.trunc(input.limit || 25), 100));
  return Object.values(contracts)
    .filter((contract): contract is ContractMarketContract => Boolean(contract))
    .filter((contract) => contract.status === "open" || contract.status === "accepted")
    .filter((contract) => timestamp(contract.expiresAt, "contract_expires_at_invalid") <= expiredTime)
    .sort((left, right) => left.expiresAt.localeCompare(right.expiresAt)
      || left.contractId.localeCompare(right.contractId))
    .slice(0, limit);
}

export function requireContractMarketContract(
  projection: ContractMarketProjection,
  contractId: string,
): ContractMarketContract {
  const contract = projection.contracts[contractId];
  if (!contract) throw new Error("contract_not_found");
  return contract;
}

export function assertContractStatus(
  contract: Pick<ContractMarketContract, "status">,
  expected: ContractMarketStatus,
): void {
  if (contract.status !== expected) throw new Error(`contract_status_${expected}_required`);
}

function replaceContract(
  projection: ContractMarketProjection,
  contract: ContractMarketContract,
): ContractMarketProjection {
  return {
    ...projection,
    contracts: {
      ...projection.contracts,
      [contract.contractId]: contract,
    },
  };
}

function projectedContractFromCreated(payload: ContractCreatedPayload): ContractMarketContract {
  return {
    contractId: payload.contractId,
    contractType: payload.contractType,
    regionId: payload.regionId,
    creatorAgentId: payload.creatorAgentId,
    creatorExplorerId: payload.creatorExplorerId,
    title: payload.title,
    description: payload.description,
    reward: payload.reward,
    target: payload.target,
    sourceBountyId: payload.sourceBountyId,
    status: "open",
    riskFlags: payload.riskFlags,
    riskScore: payload.riskScore,
    escrow: {
      status: "locked",
      reward: payload.reward,
      sponsorAgentId: payload.creatorAgentId,
      sponsorExplorerId: payload.creatorExplorerId,
      lockedAt: payload.createdAt,
    },
    createdAt: payload.createdAt,
    expiresAt: payload.expiresAt,
  };
}

export function projectContractMarketEvent(
  projection: ContractMarketProjection,
  event: ContractMarketProjectableEvent,
): ContractMarketProjection {
  if (event.eventType === "contract_reward_escrow_locked") return projection;
  if (event.eventType === "contract_created") {
    if (projection.contracts[event.payload.contractId]) throw new Error("contract_already_exists");
    return replaceContract(projection, projectedContractFromCreated(event.payload));
  }
  const contract = requireContractMarketContract(projection, event.payload.contractId);
  if (event.eventType === "contract_accepted") {
    assertContractStatus(contract, "open");
    return replaceContract(projection, {
      ...contract,
      status: "accepted",
      contractorAgentId: event.payload.contractorAgentId,
      contractorExplorerId: event.payload.contractorExplorerId,
      acceptedAt: event.payload.acceptedAt,
      riskFlags: event.payload.riskFlags,
      riskScore: event.payload.riskScore,
    });
  }
  if (event.eventType === "contract_submitted") {
    assertContractStatus(contract, "accepted");
    return replaceContract(projection, {
      ...contract,
      status: "submitted",
      submission: {
        summary: event.payload.summary,
        sourceEventIds: event.payload.sourceEventIds,
        submittedAt: event.payload.submittedAt,
      },
    });
  }
  if (event.eventType === "contract_server_adjudicated") {
    assertContractStatus(contract, "submitted");
    return replaceContract(projection, {
      ...contract,
      adjudication: {
        decisionId: event.payload.decisionId,
        resolution: event.payload.resolution,
        reason: event.payload.reason,
        sourceEventIds: event.payload.sourceEventIds,
        adjudicatedBy: event.payload.adjudicatedBy,
        adjudicatedAt: event.payload.adjudicatedAt,
      },
    });
  }
  if (event.eventType === "contract_reward_escrow_released") {
    if (contract.status !== "submitted" || contract.adjudication?.resolution !== "approved") {
      throw new Error("contract_approved_adjudication_required");
    }
    return replaceContract(projection, {
      ...contract,
      escrow: {
        ...contract.escrow,
        status: "released",
        recipientAgentId: event.payload.recipientAgentId,
        recipientExplorerId: event.payload.recipientExplorerId,
        settledAt: event.payload.releasedAt,
        settlementReason: "completed",
      },
    });
  }
  if (event.eventType === "contract_reward_escrow_refunded") {
    if (contract.escrow.status !== "locked") throw new Error("contract_escrow_not_locked");
    return replaceContract(projection, {
      ...contract,
      escrow: {
        ...contract.escrow,
        status: "refunded",
        recipientAgentId: event.payload.sponsorAgentId,
        recipientExplorerId: event.payload.sponsorExplorerId,
        settledAt: event.payload.refundedAt,
        settlementReason: event.payload.reason,
      },
    });
  }
  if (event.eventType === "contract_completed") {
    if (contract.status !== "submitted"
      || contract.adjudication?.resolution !== "approved"
      || contract.adjudication.decisionId !== event.payload.decisionId
      || contract.escrow.status !== "released") {
      throw new Error("contract_completion_not_authorized");
    }
    return replaceContract(projection, { ...contract, status: "completed", completedAt: event.payload.completedAt });
  }
  if (event.eventType === "contract_rejected") {
    if (contract.status !== "submitted"
      || contract.adjudication?.resolution !== "rejected"
      || contract.adjudication.decisionId !== event.payload.decisionId
      || contract.escrow.status !== "refunded") {
      throw new Error("contract_rejection_not_authorized");
    }
    return replaceContract(projection, { ...contract, status: "rejected", rejectedAt: event.payload.rejectedAt });
  }
  if (event.eventType === "contract_cancelled") {
    if (contract.status !== "open" || contract.escrow.status !== "refunded") {
      throw new Error("contract_cancellation_not_authorized");
    }
    return replaceContract(projection, { ...contract, status: "cancelled", cancelledAt: event.payload.cancelledAt });
  }
  if (event.eventType === "contract_expired") {
    if ((contract.status !== "open" && contract.status !== "accepted") || contract.escrow.status !== "refunded") {
      throw new Error("contract_expiry_not_authorized");
    }
    return replaceContract(projection, { ...contract, status: "expired", expiredAt: event.payload.expiredAt });
  }
  return projection;
}

export function projectContractMarketEvents(
  projection: ContractMarketProjection,
  events: readonly ContractMarketProjectableEvent[],
): ContractMarketProjection {
  return events.reduce(projectContractMarketEvent, projection);
}
