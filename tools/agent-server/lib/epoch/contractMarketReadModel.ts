import type {
  ContractMarketContract,
  ContractMarketProjection,
  ContractMarketRiskFlag,
  ContractMarketStatus,
  ContractMarketTarget,
  ContractMarketType,
} from "./contractMarketRules.ts";
import type { EpochResourceId } from "./protocol.ts";

export interface ContractMarketReadInput {
  readonly regionId?: string;
  readonly agentId?: string;
  readonly contractType?: ContractMarketType;
  readonly status?: ContractMarketStatus;
  readonly limit?: number;
}

export type ContractMarketPublicTarget =
  | { readonly kind: "agent"; readonly agentId: string }
  | { readonly kind: "npc"; readonly npcId: string }
  | { readonly kind: "region"; readonly regionId: string };

export interface ContractMarketAuditLink {
  readonly eventId: string;
  readonly audit: string;
}

export interface ContractMarketContractView {
  readonly contractId: string;
  readonly contractType: ContractMarketType;
  readonly regionId: string;
  readonly creatorAgentId: string;
  readonly contractorAgentId?: string;
  readonly title: string;
  readonly description: string;
  readonly reward: ContractMarketContract["reward"];
  readonly target?: ContractMarketPublicTarget;
  readonly sourceBountyId?: string;
  readonly status: ContractMarketStatus;
  readonly riskFlags: readonly ContractMarketRiskFlag[];
  readonly riskScore: number;
  readonly reviewRequired: boolean;
  readonly escrow: {
    readonly status: ContractMarketContract["escrow"]["status"];
    readonly reward: ContractMarketContract["reward"];
    readonly settlementReason?: ContractMarketContract["escrow"]["settlementReason"];
    readonly settledAt?: string;
  };
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly acceptedAt?: string;
  readonly submission?: {
    readonly summary: string;
    readonly submittedAt: string;
    readonly sourceEvents: readonly ContractMarketAuditLink[];
  };
  readonly adjudication?: {
    readonly decisionId: string;
    readonly resolution: "approved" | "rejected";
    readonly reason: string;
    readonly sourceEvents: readonly ContractMarketAuditLink[];
    readonly adjudicatedAt: string;
  };
  readonly completedAt?: string;
  readonly rejectedAt?: string;
  readonly cancelledAt?: string;
  readonly expiredAt?: string;
  readonly publicPages: {
    readonly contract: string;
    readonly audit: string;
    readonly region: string;
    readonly creator: string;
    readonly contractor?: string;
    readonly sourceBounty?: string;
  };
}

export interface ContractMarketBoardView {
  readonly total: number;
  readonly truncated: boolean;
  readonly limit: number;
  readonly contracts: readonly ContractMarketContractView[];
}

export interface ContractMarketSummaryView {
  readonly regionId?: string;
  readonly totalContracts: number;
  readonly byType: Readonly<Record<ContractMarketType, number>>;
  readonly byStatus: Readonly<Record<ContractMarketStatus, number>>;
  readonly escrowCounts: {
    readonly locked: number;
    readonly released: number;
    readonly refunded: number;
  };
  readonly lockedRewardTotals: Partial<Record<EpochResourceId, number>>;
  readonly releasedRewardTotals: Partial<Record<EpochResourceId, number>>;
  readonly refundedRewardTotals: Partial<Record<EpochResourceId, number>>;
  readonly riskFlaggedContracts: number;
  readonly latestActivityAt?: string;
}

function boundedLimit(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) return 25;
  return Math.max(1, Math.min(Math.trunc(value), 100));
}

function publicTarget(target: ContractMarketTarget | undefined): ContractMarketPublicTarget | undefined {
  if (!target) return undefined;
  if (target.kind === "agent") return { kind: "agent", agentId: target.agentId };
  if (target.kind === "npc") return { kind: "npc", npcId: target.npcId };
  return { kind: "region", regionId: target.regionId };
}

function auditLinks(sourceEventIds: readonly string[]): readonly ContractMarketAuditLink[] {
  return sourceEventIds.map((eventId) => ({
    eventId,
    audit: `/epoch/audit/${encodeURIComponent(eventId)}`,
  }));
}

function activityAt(contract: ContractMarketContract): string {
  return contract.completedAt
    || contract.rejectedAt
    || contract.cancelledAt
    || contract.expiredAt
    || contract.adjudication?.adjudicatedAt
    || contract.submission?.submittedAt
    || contract.acceptedAt
    || contract.createdAt;
}

function activeStatusScore(status: ContractMarketStatus): number {
  if (status === "submitted") return 0;
  if (status === "accepted") return 1;
  if (status === "open") return 2;
  return 3;
}

export function contractMarketContractView(contract: ContractMarketContract): ContractMarketContractView {
  return {
    contractId: contract.contractId,
    contractType: contract.contractType,
    regionId: contract.regionId,
    creatorAgentId: contract.creatorAgentId,
    contractorAgentId: contract.contractorAgentId,
    title: contract.title,
    description: contract.description,
    reward: contract.reward,
    target: publicTarget(contract.target),
    sourceBountyId: contract.sourceBountyId,
    status: contract.status,
    riskFlags: contract.riskFlags,
    riskScore: contract.riskScore,
    reviewRequired: contract.riskScore > 0,
    escrow: {
      status: contract.escrow.status,
      reward: contract.escrow.reward,
      settlementReason: contract.escrow.settlementReason,
      settledAt: contract.escrow.settledAt,
    },
    createdAt: contract.createdAt,
    expiresAt: contract.expiresAt,
    acceptedAt: contract.acceptedAt,
    submission: contract.submission
      ? {
        summary: contract.submission.summary,
        submittedAt: contract.submission.submittedAt,
        sourceEvents: auditLinks(contract.submission.sourceEventIds),
      }
      : undefined,
    adjudication: contract.adjudication
      ? {
        decisionId: contract.adjudication.decisionId,
        resolution: contract.adjudication.resolution,
        reason: contract.adjudication.reason,
        sourceEvents: auditLinks(contract.adjudication.sourceEventIds),
        adjudicatedAt: contract.adjudication.adjudicatedAt,
      }
      : undefined,
    completedAt: contract.completedAt,
    rejectedAt: contract.rejectedAt,
    cancelledAt: contract.cancelledAt,
    expiredAt: contract.expiredAt,
    publicPages: {
      contract: `/epoch/contract/${encodeURIComponent(contract.contractId)}`,
      audit: `/epoch/audit?aggregateId=${encodeURIComponent(contract.contractId)}`,
      region: `/epoch/region/${encodeURIComponent(contract.regionId)}`,
      creator: `/epoch/agent/${encodeURIComponent(contract.creatorAgentId)}`,
      contractor: contract.contractorAgentId
        ? `/epoch/agent/${encodeURIComponent(contract.contractorAgentId)}`
        : undefined,
      sourceBounty: contract.sourceBountyId
        ? `/epoch/bounty/${encodeURIComponent(contract.sourceBountyId)}`
        : undefined,
    },
  };
}

function contractMatches(contract: ContractMarketContract, input: ContractMarketReadInput): boolean {
  const targetAgentId = contract.target?.kind === "agent" ? contract.target.agentId : undefined;
  return (!input.regionId || contract.regionId === input.regionId)
    && (!input.agentId
      || contract.creatorAgentId === input.agentId
      || contract.contractorAgentId === input.agentId
      || targetAgentId === input.agentId)
    && (!input.contractType || contract.contractType === input.contractType)
    && (!input.status || contract.status === input.status);
}

export function contractMarketBoardView(
  projection: ContractMarketProjection,
  input: ContractMarketReadInput = {},
): ContractMarketBoardView {
  const limit = boundedLimit(input.limit);
  const matching = Object.values(projection.contracts)
    .filter((contract): contract is ContractMarketContract => Boolean(contract))
    .filter((contract) => contractMatches(contract, input))
    .sort((left, right) => activeStatusScore(left.status) - activeStatusScore(right.status)
      || activityAt(right).localeCompare(activityAt(left))
      || left.contractId.localeCompare(right.contractId));
  return {
    total: matching.length,
    truncated: matching.length > limit,
    limit,
    contracts: matching.slice(0, limit).map(contractMarketContractView),
  };
}

function emptyTypeCounts(): Record<ContractMarketType, number> {
  return {
    scouting: 0,
    evidence: 0,
    protection: 0,
    bounty: 0,
    counter_bounty: 0,
  };
}

function emptyStatusCounts(): Record<ContractMarketStatus, number> {
  return {
    open: 0,
    accepted: 0,
    submitted: 0,
    completed: 0,
    rejected: 0,
    cancelled: 0,
    expired: 0,
  };
}

function addReward(
  totals: Partial<Record<EpochResourceId, number>>,
  contract: ContractMarketContract,
): void {
  totals[contract.reward.resourceId] = (totals[contract.reward.resourceId] || 0) + contract.reward.amount;
}

export function contractMarketSummaryView(
  projection: ContractMarketProjection,
  input: { readonly regionId?: string } = {},
): ContractMarketSummaryView {
  const contracts = Object.values(projection.contracts)
    .filter((contract): contract is ContractMarketContract => Boolean(contract))
    .filter((contract) => !input.regionId || contract.regionId === input.regionId);
  const byType = emptyTypeCounts();
  const byStatus = emptyStatusCounts();
  const escrowCounts = { locked: 0, released: 0, refunded: 0 };
  const lockedRewardTotals: Partial<Record<EpochResourceId, number>> = {};
  const releasedRewardTotals: Partial<Record<EpochResourceId, number>> = {};
  const refundedRewardTotals: Partial<Record<EpochResourceId, number>> = {};
  let latestActivityAt: string | undefined;
  for (const contract of contracts) {
    byType[contract.contractType] += 1;
    byStatus[contract.status] += 1;
    escrowCounts[contract.escrow.status] += 1;
    if (contract.escrow.status === "locked") addReward(lockedRewardTotals, contract);
    if (contract.escrow.status === "released") addReward(releasedRewardTotals, contract);
    if (contract.escrow.status === "refunded") addReward(refundedRewardTotals, contract);
    const currentActivityAt = activityAt(contract);
    if (!latestActivityAt || currentActivityAt.localeCompare(latestActivityAt) > 0) {
      latestActivityAt = currentActivityAt;
    }
  }
  return {
    regionId: input.regionId,
    totalContracts: contracts.length,
    byType,
    byStatus,
    escrowCounts,
    lockedRewardTotals,
    releasedRewardTotals,
    refundedRewardTotals,
    riskFlaggedContracts: contracts.filter((contract) => contract.riskScore > 0).length,
    latestActivityAt,
  };
}
