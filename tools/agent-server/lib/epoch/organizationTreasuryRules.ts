import {
  type EpochEvent,
  type OrganizationCreatedPayload,
  type OrganizationBudgetProposedPayload,
  type OrganizationBudgetResolvedPayload,
  type OrganizationBudgetVoteRecordedPayload,
  type OrganizationMembershipChangedPayload,
  type OrganizationPoliticsRecordedPayload,
  type ResourceSpentPayload,
  type OrganizationTreasuryChangedPayload,
  type OrganizationUpgradePurchasedPayload,
} from "./events.ts";
import {
  assertNonEmptyString,
  stableKey,
  type EpochIdFactory,
  type EpochOrganizationBudgetResolution,
  type EpochOrganizationBudgetStatus,
  type EpochOrganizationPoliticsKind,
  type EpochResourceId,
} from "./protocol.ts";
import type { EpochEventFactory } from "./eventFactory.ts";
import { resourceSpentEvent } from "./resourceLedgerEvents.ts";

export type EpochOrganizationUpgradeKey = "training_hall";
export type EpochOrganizationMembershipStatus = "active" | "left";

export interface EpochOrganizationUpgradeCatalogEntry {
  readonly upgradeKey: EpochOrganizationUpgradeKey;
  readonly title: string;
  readonly description: string;
  readonly costResourceId: EpochResourceId;
  readonly costAmount: number;
}

export interface OrganizationTreasuryBalanceProjection {
  readonly organizationTreasuryBalances: Readonly<Record<string, Partial<Record<EpochResourceId, number>>>>;
}

export interface OrganizationMembershipForRules {
  readonly membershipId: string;
  readonly organizationId: string;
  readonly memberType: string;
  readonly agentId?: string;
  readonly explorerId?: string;
  readonly regionId: string;
  readonly status: string;
}

export interface OrganizationUpgradeForRules {
  readonly upgradeId: string;
  readonly organizationId: string;
  readonly regionId: string;
  readonly upgradeKey: EpochOrganizationUpgradeKey | string;
}

export interface OrganizationMembershipProjectionForRules<
  TMembership extends OrganizationMembershipForRules = OrganizationMembershipForRules,
  TUpgrade extends OrganizationUpgradeForRules = OrganizationUpgradeForRules,
> {
  readonly organizationMembershipIdsByOrganization: Readonly<Record<string, readonly string[]>>;
  readonly organizationMembershipIdsByAgent: Readonly<Record<string, readonly string[]>>;
  readonly organizationMemberships: Readonly<Record<string, TMembership | undefined>>;
  readonly organizationUpgradeIdsByOrganization: Readonly<Record<string, readonly string[]>>;
  readonly organizationUpgrades: Readonly<Record<string, TUpgrade | undefined>>;
}

export interface OrganizationPoliticsTickSelectionInput {
  readonly limit?: number;
  readonly regionId?: string;
}

export interface OrganizationPoliticsTickTargetLike {
  readonly organizationId: string;
  readonly displayName?: string;
  readonly regionId: string;
}

export interface OrganizationPoliticsTickMembershipLike {
  readonly membershipId: string;
  readonly memberType?: string;
  readonly npcId?: string;
  readonly status?: string;
  readonly recordedAt: string;
  readonly sourceEventIds?: readonly string[];
}

export interface OrganizationPoliticsTickNpcLike {
  readonly npcId: string;
  readonly displayName: string;
}

export interface OrganizationPoliticsTickCareerLike {
  readonly careerId: string;
  readonly organizationId?: string;
  readonly recordedAt: string;
  readonly sourceEventIds?: readonly string[];
}

export interface OrganizationPoliticsTickPlanInput<
  TMembership extends OrganizationPoliticsTickMembershipLike,
  TNpc extends OrganizationPoliticsTickNpcLike,
  TCareer extends OrganizationPoliticsTickCareerLike,
> {
  readonly organizationId: string;
  readonly membershipIds: readonly string[];
  readonly membershipsById: Readonly<Record<string, TMembership | undefined>>;
  readonly npcsById: Readonly<Record<string, TNpc | undefined>>;
  readonly careerIdsByNpc: Readonly<Record<string, readonly string[] | undefined>>;
  readonly careersById: Readonly<Record<string, TCareer | undefined>>;
  readonly politicsIds: readonly string[];
  readonly standingBefore: number;
}

export interface OrganizationPoliticsTickPlan<
  TMembership extends OrganizationPoliticsTickMembershipLike,
  TNpc extends OrganizationPoliticsTickNpcLike,
  TCareer extends OrganizationPoliticsTickCareerLike,
> {
  readonly membership: TMembership;
  readonly npc: TNpc;
  readonly counterpartyMembership?: TMembership;
  readonly counterpartyNpc?: TNpc;
  readonly career?: TCareer;
  readonly sourceEventIds: readonly string[];
  readonly templateIndex: number;
  readonly politicsKind: EpochOrganizationPoliticsKind;
  readonly standingBefore: number;
}

export interface OrganizationBudgetForRules {
  readonly budgetId: string;
  readonly organizationId: string;
  readonly organizationName: string;
  readonly regionId: string;
  readonly proposedByExplorerId: string;
  readonly resourceId: EpochResourceId;
  readonly amount: number;
  readonly approvalThreshold?: number;
  readonly rejectionThreshold?: number;
  readonly approvalCount?: number;
  readonly rejectionCount?: number;
  readonly sourceEventIds: readonly string[];
}

export interface OrganizationCreatedPayloadInput {
  readonly organizationId: string;
  readonly organizationName: string;
  readonly regionId: string;
  readonly reason?: string;
  readonly sourceEventIds?: readonly string[];
  readonly recordedAt: string;
}

export interface OrganizationMembershipChangedPayloadInput {
  readonly membershipId: string;
  readonly organizationId: string;
  readonly organizationName: string;
  readonly memberType?: "npc" | "agent";
  readonly npcId?: string;
  readonly agentId?: string;
  readonly explorerId?: string;
  readonly regionId: string;
  readonly role: string;
  readonly status: string;
  readonly sourceEventIds?: readonly string[];
  readonly recordedAt: string;
}

export interface OrganizationCreatedEventsInput extends OrganizationCreatedPayloadInput {
  readonly makeEvent: EpochEventFactory;
}

export interface OrganizationMembershipChangedEventsInput extends OrganizationMembershipChangedPayloadInput {
  readonly makeEvent: EpochEventFactory;
  readonly eventAgentId?: string;
}

export interface OrganizationBudgetProposedPayloadInput {
  readonly budgetId: string;
  readonly organizationId: string;
  readonly organizationName: string;
  readonly regionId: string;
  readonly proposedByAgentId: string;
  readonly proposedByExplorerId: string;
  readonly title: string;
  readonly description?: string;
  readonly resourceId: EpochResourceId;
  readonly amount: number;
  readonly sourceEventIds: readonly string[];
  readonly proposedAt: string;
}

export interface OrganizationBudgetProposedEventsInput extends OrganizationBudgetProposedPayloadInput {
  readonly makeEvent: EpochEventFactory;
}

export interface OrganizationBudgetVotePayloadInput {
  readonly voteId: string;
  readonly budget: OrganizationBudgetForRules;
  readonly decision: EpochOrganizationBudgetResolution;
  readonly voterAgentId: string;
  readonly voterExplorerId: string;
  readonly voterRole: string;
  readonly note?: string;
  readonly votedAt: string;
}

export interface OrganizationBudgetTreasuryPayloadInput {
  readonly treasuryEventId: string;
  readonly budget: OrganizationBudgetForRules;
  readonly balanceAfter: number;
  readonly sourceEventIds: readonly string[];
  readonly recordedAt: string;
}

export interface OrganizationBudgetResolvedPayloadInput {
  readonly budget: OrganizationBudgetForRules;
  readonly resolution: EpochOrganizationBudgetResolution;
  readonly resolvedByAgentId: string;
  readonly resolvedByExplorerId: string;
  readonly note?: string;
  readonly treasuryEventId?: string;
  readonly sourceEventIds: readonly string[];
  readonly resolvedAt: string;
}

export interface OrganizationBudgetResolutionEventsInput {
  readonly makeEvent: EpochEventFactory;
  readonly idFactory: EpochIdFactory;
  readonly budget: OrganizationBudgetForRules;
  readonly resolution: EpochOrganizationBudgetResolution;
  readonly resolvedByAgentId: string;
  readonly resolvedByExplorerId: string;
  readonly resolverRole: string;
  readonly note?: string;
  readonly treasuryBalanceBefore?: number;
  readonly resolvedAt: string;
}

export interface OrganizationTreasuryContributionPayloadInput {
  readonly treasuryEventId: string;
  readonly organizationId: string;
  readonly organizationName: string;
  readonly regionId: string;
  readonly resourceId: EpochResourceId;
  readonly amount: number;
  readonly balanceAfter: number;
  readonly contributingAgentId: string;
  readonly sourceEventIds: readonly string[];
  readonly recordedAt: string;
}

export interface OrganizationTreasuryContributionSpendPayloadInput {
  readonly agentId: string;
  readonly organizationId: string;
  readonly resourceId: EpochResourceId;
  readonly amount: number;
  readonly memberBalanceBefore: number;
}

export interface OrganizationTreasuryContributionEventsInput {
  readonly makeEvent: EpochEventFactory;
  readonly treasuryEventId: string;
  readonly organizationId: string;
  readonly organizationName: string;
  readonly regionId: string;
  readonly resourceId: EpochResourceId;
  readonly amount: number;
  readonly memberBalanceBefore: number;
  readonly treasuryBalanceBefore: number;
  readonly contributingAgentId: string;
  readonly contributedAt: string;
}

export interface OrganizationPoliticsRecordedPayloadInput {
  readonly politicsId: string;
  readonly organizationId: string;
  readonly organizationName: string;
  readonly regionId: string;
  readonly npcId: string;
  readonly npcName: string;
  readonly counterpartyNpcId?: string;
  readonly counterpartyName?: string;
  readonly templateIndex: number;
  readonly standingBefore: number;
  readonly sourceEventIds: readonly string[];
  readonly recordedAt: string;
}

export interface OrganizationPoliticsTickProjectionLike {
  readonly organizationMembershipIdsByOrganization: Readonly<Record<string, readonly string[] | undefined>>;
  readonly organizationMemberships: Readonly<Record<string, OrganizationPoliticsTickMembershipLike | undefined>>;
  readonly npcs: Readonly<Record<string, OrganizationPoliticsTickNpcLike | undefined>>;
  readonly npcCareerIdsByNpc: Readonly<Record<string, readonly string[] | undefined>>;
  readonly npcCareerRecords: Readonly<Record<string, OrganizationPoliticsTickCareerLike | undefined>>;
  readonly organizationPoliticsIdsByOrganization: Readonly<Record<string, readonly string[] | undefined>>;
  readonly organizationPolitics: Readonly<Record<string, unknown>>;
  readonly organizationPoliticalStandingByOrganization: Readonly<Record<string, number | undefined>>;
}

export interface PlanOrganizationPoliticsTickEventsInput<TProjection extends OrganizationPoliticsTickProjectionLike> {
  readonly current: TProjection;
  readonly selectedOrganizations: readonly OrganizationPoliticsTickTargetLike[];
  readonly tickedAt: string;
  readonly idFactory: EpochIdFactory;
  readonly makeEvent: EpochEventFactory;
  readonly applyEvents: (projection: TProjection, events: readonly EpochEvent[]) => TProjection;
}

type ProjectionRecordValue<TRecord> = TRecord extends Readonly<Record<string, infer TValue>>
  ? NonNullable<TValue>
  : never;

export interface ProjectOrganizationPoliticsTickResultInput<TProjection extends OrganizationPoliticsTickProjectionLike> {
  readonly tickedAt: string;
  readonly events: readonly EpochEvent[];
  readonly projection: TProjection;
}

export interface ProjectedOrganizationPoliticsTickResult<TProjection extends OrganizationPoliticsTickProjectionLike> {
  readonly tickedAt: string;
  readonly politics: readonly ProjectionRecordValue<TProjection["organizationPolitics"]>[];
}

export interface OrganizationUpgradeTreasurySpendPayloadInput {
  readonly treasuryEventId: string;
  readonly organizationId: string;
  readonly organizationName: string;
  readonly regionId: string;
  readonly catalogEntry: EpochOrganizationUpgradeCatalogEntry;
  readonly balanceAfter: number;
  readonly sourceEventIds: readonly string[];
  readonly recordedAt: string;
}

export interface OrganizationUpgradePurchasedPayloadInput {
  readonly upgradeId: string;
  readonly organizationId: string;
  readonly organizationName: string;
  readonly regionId: string;
  readonly catalogEntry: EpochOrganizationUpgradeCatalogEntry;
  readonly purchasedByAgentId: string;
  readonly purchasedByExplorerId: string;
  readonly sourceEventIds: readonly string[];
  readonly purchasedAt: string;
}

export interface OrganizationUpgradePurchaseEventsInput {
  readonly makeEvent: EpochEventFactory;
  readonly idFactory: EpochIdFactory;
  readonly organizationId: string;
  readonly organizationName: string;
  readonly regionId: string;
  readonly catalogEntry: EpochOrganizationUpgradeCatalogEntry;
  readonly treasuryBalanceBefore: number;
  readonly sourceEventIds: readonly string[];
  readonly purchasedByAgentId: string;
  readonly purchasedByExplorerId: string;
  readonly purchasedAt: string;
}

export const EPOCH_ORGANIZATION_UPGRADE_CATALOG: readonly EpochOrganizationUpgradeCatalogEntry[] = [
  {
    upgradeKey: "training_hall",
    title: "训练厅",
    description: "成员在组织内共享基础训练设施，参与本区域赛季贡献时由服务器额外计算 +1 赛季分。",
    costResourceId: "legend",
    costAmount: 2,
  },
];

const ORGANIZATION_MEMBERSHIP_ROLES = new Set([
  "member",
  "scout",
  "vanguard",
  "support",
  "artisan",
  "scribe",
  "clerk",
]);

const ORGANIZATION_GOVERNANCE_ROLES = new Set([
  "vanguard",
  "scribe",
  "clerk",
]);

const ORGANIZATION_HIGH_VALUE_BUDGET_AMOUNT = 5;

const ORGANIZATION_POLITICS_TEMPLATES: readonly {
  readonly kind: EpochOrganizationPoliticsKind;
  readonly standingDelta: number;
  readonly title: (organizationName: string) => string;
  readonly summary: (npcName: string, organizationName: string, counterpartyName?: string) => string;
}[] = [
  {
    kind: "promotion",
    standingDelta: 2,
    title: (organizationName) => `${organizationName} 记录一次任命`,
    summary: (npcName, organizationName) => `${organizationName} 将 ${npcName} 列入新的职责序列，组织声望稳步上升。`,
  },
  {
    kind: "patronage",
    standingDelta: 1,
    title: (organizationName) => `${organizationName} 建立庇护链`,
    summary: (npcName, organizationName, counterpartyName) =>
      `${npcName} 在 ${organizationName} 内获得${counterpartyName ? ` ${counterpartyName} 的` : ""}庇护，短期秩序增强。`,
  },
  {
    kind: "rivalry",
    standingDelta: -1,
    title: (organizationName) => `${organizationName} 出现派系摩擦`,
    summary: (npcName, organizationName, counterpartyName) =>
      `${npcName}${counterpartyName ? ` 与 ${counterpartyName}` : ""} 在 ${organizationName} 内产生路线分歧。`,
  },
  {
    kind: "scandal",
    standingDelta: -2,
    title: (organizationName) => `${organizationName} 传出账册风波`,
    summary: (npcName, organizationName) => `${npcName} 牵连进 ${organizationName} 的账册质疑，组织信任受到折损。`,
  },
  {
    kind: "reform",
    standingDelta: 1,
    title: (organizationName) => `${organizationName} 调整内部章程`,
    summary: (npcName, organizationName) => `${npcName} 推动 ${organizationName} 进行一次温和改革，派系关系被重新校准。`,
  },
];

function organizationPoliticsTemplate(index: number) {
  return ORGANIZATION_POLITICS_TEMPLATES[index % ORGANIZATION_POLITICS_TEMPLATES.length];
}

export function organizationPoliticsKindForIndex(index: number): EpochOrganizationPoliticsKind {
  return organizationPoliticsTemplate(index).kind;
}

export function organizationPoliticsTickLimit(value: number | undefined): number {
  return Math.max(1, Math.min(Number(value || 10), 100));
}

export function selectOrganizationPoliticsTickTargets<TOrganization extends OrganizationPoliticsTickTargetLike>(
  organizationsById: Readonly<Record<string, TOrganization>>,
  input: OrganizationPoliticsTickSelectionInput,
): readonly TOrganization[] {
  const limit = organizationPoliticsTickLimit(input.limit);
  const regionId = input.regionId?.trim();
  return Object.values(organizationsById)
    .filter((organization) => !regionId || organization.regionId === regionId)
    .sort((left, right) => left.organizationId.localeCompare(right.organizationId))
    .slice(0, limit);
}

function uniqueValues(values: readonly string[]): string[] {
  return values.filter((value, index) => value && values.indexOf(value) === index);
}

export function organizationPoliticsTickPlan<
  TMembership extends OrganizationPoliticsTickMembershipLike,
  TNpc extends OrganizationPoliticsTickNpcLike,
  TCareer extends OrganizationPoliticsTickCareerLike,
>(
  input: OrganizationPoliticsTickPlanInput<TMembership, TNpc, TCareer>,
): OrganizationPoliticsTickPlan<TMembership, TNpc, TCareer> | undefined {
  const memberships = input.membershipIds
    .map((membershipId) => input.membershipsById[membershipId])
    .filter((membership): membership is TMembership =>
      membership !== undefined
      && membership.memberType === "npc"
      && typeof membership.npcId === "string"
      && membership.status === "active")
    .sort((left, right) => left.recordedAt.localeCompare(right.recordedAt) || left.membershipId.localeCompare(right.membershipId));
  const membership = memberships[0];
  if (!membership || !membership.npcId) return undefined;
  const npc = input.npcsById[membership.npcId];
  if (!npc) return undefined;
  const counterpartyMembership = memberships.find((candidate) => candidate.npcId !== membership.npcId);
  const counterpartyNpc = counterpartyMembership?.npcId ? input.npcsById[counterpartyMembership.npcId] : undefined;
  const career = (input.careerIdsByNpc[membership.npcId] || [])
    .map((careerId) => input.careersById[careerId])
    .filter((candidate): candidate is TCareer => Boolean(candidate))
    .filter((candidate) => candidate.organizationId === input.organizationId)
    .sort((left, right) => right.recordedAt.localeCompare(left.recordedAt) || left.careerId.localeCompare(right.careerId))[0];
  const sourceEventIds = uniqueValues([
    ...(membership.sourceEventIds || []),
    ...(career?.sourceEventIds || []),
  ]);
  if (sourceEventIds.length === 0) return undefined;
  const templateIndex = input.politicsIds.length;
  return {
    membership,
    npc,
    counterpartyMembership,
    counterpartyNpc,
    career,
    sourceEventIds,
    templateIndex,
    politicsKind: organizationPoliticsKindForIndex(templateIndex),
    standingBefore: input.standingBefore,
  };
}

export function currentOrganizationTreasuryBalance(
  projection: OrganizationTreasuryBalanceProjection,
  organizationId: string,
  resourceId: EpochResourceId,
): number {
  return projection.organizationTreasuryBalances[organizationId]?.[resourceId] || 0;
}

export function assertOrganizationBudgetResolution(value: unknown): EpochOrganizationBudgetResolution {
  if (value === "approved" || value === "rejected") return value;
  throw new Error("organization_budget_resolution_invalid");
}

export function assertOrganizationMembershipRole(value: string | undefined): string {
  const role = (value?.trim() || "member").toLowerCase().replace(/\s+/g, "_");
  if (!ORGANIZATION_MEMBERSHIP_ROLES.has(role)) throw new Error("organization_membership_role_invalid");
  return role;
}

export function assertOrganizationMembershipStatus(value: string | undefined): EpochOrganizationMembershipStatus {
  const status = value?.trim() || "active";
  if (status !== "active" && status !== "left") throw new Error("organization_membership_status_invalid");
  return status;
}

export function activeAgentOrganizationMembership<TMembership extends OrganizationMembershipForRules>(
  projection: OrganizationMembershipProjectionForRules<TMembership>,
  organizationId: string,
  agentId: string,
): (TMembership & { readonly agentId: string }) | undefined {
  return (projection.organizationMembershipIdsByOrganization[organizationId] || [])
    .map((membershipId) => projection.organizationMemberships[membershipId])
    .find((membership): membership is TMembership & { readonly agentId: string } => {
      if (!membership) return false;
      return membership.memberType === "agent"
        && membership.agentId === agentId
        && membership.status === "active";
    });
}

export function activeOrganizationMembershipForExplorer<TMembership extends OrganizationMembershipForRules>(
  projection: OrganizationMembershipProjectionForRules<TMembership>,
  organizationId: string,
  explorerId: string,
): (TMembership & { readonly agentId: string; readonly explorerId: string }) | undefined {
  return (projection.organizationMembershipIdsByOrganization[organizationId] || [])
    .map((membershipId) => projection.organizationMemberships[membershipId])
    .find((membership): membership is TMembership & { readonly agentId: string; readonly explorerId: string } => {
      if (!membership) return false;
      return membership.memberType === "agent"
        && typeof membership.agentId === "string"
        && membership.explorerId === explorerId
        && membership.status === "active";
    });
}

export function activeOrganizationUpgradeIdsForAgentSeason<
  TMembership extends OrganizationMembershipForRules,
  TUpgrade extends OrganizationUpgradeForRules,
>(
  projection: OrganizationMembershipProjectionForRules<TMembership, TUpgrade>,
  agentId: string,
  seasonRegionIds: readonly string[],
  upgradeKey: EpochOrganizationUpgradeKey,
): readonly string[] {
  const seasonRegionSet = new Set(seasonRegionIds);
  const upgradeIds = (projection.organizationMembershipIdsByAgent[agentId] || [])
    .map((membershipId) => projection.organizationMemberships[membershipId])
    .filter((membership): membership is TMembership & { readonly agentId: string } => {
      if (!membership) return false;
      return membership.memberType === "agent"
        && membership.agentId === agentId
        && membership.status === "active"
        && seasonRegionSet.has(membership.regionId);
    })
    .flatMap((membership) => (projection.organizationUpgradeIdsByOrganization[membership.organizationId] || [])
      .map((organizationUpgradeId) => projection.organizationUpgrades[organizationUpgradeId])
      .filter((upgrade): upgrade is TUpgrade => {
        if (!upgrade) return false;
        return upgrade.upgradeKey === upgradeKey
          && seasonRegionSet.has(upgrade.regionId);
      })
      .map((upgrade) => upgrade.upgradeId))
    .sort((left, right) => left.localeCompare(right));
  return uniqueValues(upgradeIds).slice(0, 1);
}

export function isOrganizationGovernanceRole(role: string): boolean {
  return ORGANIZATION_GOVERNANCE_ROLES.has(role);
}

export function organizationBudgetApprovalThreshold(amount: number): number {
  return amount >= ORGANIZATION_HIGH_VALUE_BUDGET_AMOUNT ? 2 : 1;
}

export function organizationBudgetRejectionThreshold(amount: number): number {
  return organizationBudgetApprovalThreshold(amount);
}

export function organizationBudgetApprovalCountAfter(
  budget: OrganizationBudgetForRules,
  decision: EpochOrganizationBudgetResolution,
): number {
  return (budget.approvalCount ?? 0) + (decision === "approved" ? 1 : 0);
}

export function organizationBudgetRejectionCountAfter(
  budget: OrganizationBudgetForRules,
  decision: EpochOrganizationBudgetResolution,
): number {
  return (budget.rejectionCount ?? 0) + (decision === "rejected" ? 1 : 0);
}

export function organizationBudgetRequiresVoteRecord(budget: OrganizationBudgetForRules): boolean {
  return organizationBudgetApprovalThresholdForBudget(budget) > 1
    || organizationBudgetRejectionThresholdForBudget(budget) > 1;
}

export function organizationBudgetDecisionStillPending(
  budget: OrganizationBudgetForRules,
  decision: EpochOrganizationBudgetResolution,
): boolean {
  return (decision === "approved" && organizationBudgetApprovalCountAfter(budget, decision) < organizationBudgetApprovalThresholdForBudget(budget))
    || (decision === "rejected" && organizationBudgetRejectionCountAfter(budget, decision) < organizationBudgetRejectionThresholdForBudget(budget));
}

export function organizationBudgetApprovalThresholdForBudget(budget: OrganizationBudgetForRules): number {
  return budget.approvalThreshold ?? organizationBudgetApprovalThreshold(budget.amount);
}

export function organizationBudgetRejectionThresholdForBudget(budget: OrganizationBudgetForRules): number {
  return budget.rejectionThreshold ?? organizationBudgetRejectionThreshold(budget.amount);
}

export function organizationBudgetProposedPayload(
  input: OrganizationBudgetProposedPayloadInput,
): OrganizationBudgetProposedPayload {
  return {
    budgetId: input.budgetId,
    organizationId: input.organizationId,
    organizationName: input.organizationName,
    regionId: input.regionId,
    proposedByAgentId: input.proposedByAgentId,
    proposedByExplorerId: input.proposedByExplorerId,
    title: input.title,
    description: input.description,
    resourceId: input.resourceId,
    amount: input.amount,
    status: "proposed" satisfies EpochOrganizationBudgetStatus,
    approvalThreshold: organizationBudgetApprovalThreshold(input.amount),
    rejectionThreshold: organizationBudgetRejectionThreshold(input.amount),
    sourceEventIds: input.sourceEventIds,
    proposedAt: input.proposedAt,
  };
}

export function planOrganizationBudgetProposedEvents(
  input: OrganizationBudgetProposedEventsInput,
): readonly EpochEvent[] {
  const proposed = input.makeEvent("organization_budget_proposed", input.budgetId, organizationBudgetProposedPayload(input), {
    aggregateType: "organization",
    agentId: input.proposedByAgentId,
  });
  return [proposed];
}

export function organizationCreatedPayload(input: OrganizationCreatedPayloadInput): OrganizationCreatedPayload {
  return {
    organizationId: input.organizationId,
    organizationName: input.organizationName,
    regionId: input.regionId,
    reason: input.reason?.trim() || "operator_created",
    sourceEventIds: input.sourceEventIds || [],
    recordedAt: input.recordedAt,
  };
}

export function organizationMembershipChangedPayload(
  input: OrganizationMembershipChangedPayloadInput,
): OrganizationMembershipChangedPayload {
  return {
    membershipId: input.membershipId,
    organizationId: input.organizationId,
    organizationName: input.organizationName,
    ...(input.memberType ? { memberType: input.memberType } : {}),
    ...(input.npcId ? { npcId: input.npcId } : {}),
    ...(input.agentId ? { agentId: input.agentId } : {}),
    ...(input.explorerId ? { explorerId: input.explorerId } : {}),
    regionId: input.regionId,
    role: input.role,
    status: input.status,
    sourceEventIds: input.sourceEventIds || [],
    recordedAt: input.recordedAt,
  };
}

export function planOrganizationCreatedEvents(input: OrganizationCreatedEventsInput): readonly EpochEvent[] {
  const created = input.makeEvent("organization_created", input.organizationId, organizationCreatedPayload(input), {
    aggregateType: "organization",
    agentId: "system",
  });
  return [created];
}

export function planOrganizationMembershipChangedEvents(
  input: OrganizationMembershipChangedEventsInput,
): readonly EpochEvent[] {
  const changed = input.makeEvent(
    "organization_membership_changed",
    input.membershipId,
    organizationMembershipChangedPayload(input),
    {
      aggregateType: "organization",
      agentId: input.eventAgentId || input.agentId || input.npcId || "system",
    },
  );
  return [changed];
}

export function organizationBudgetVotePayload(
  input: OrganizationBudgetVotePayloadInput,
): OrganizationBudgetVoteRecordedPayload {
  return {
    voteId: input.voteId,
    budgetId: input.budget.budgetId,
    organizationId: input.budget.organizationId,
    organizationName: input.budget.organizationName,
    regionId: input.budget.regionId,
    resourceId: input.budget.resourceId,
    amount: input.budget.amount,
    decision: input.decision,
    voterAgentId: input.voterAgentId,
    voterExplorerId: input.voterExplorerId,
    voterRole: input.voterRole,
    approvalCount: organizationBudgetApprovalCountAfter(input.budget, input.decision),
    rejectionCount: organizationBudgetRejectionCountAfter(input.budget, input.decision),
    approvalThreshold: organizationBudgetApprovalThresholdForBudget(input.budget),
    rejectionThreshold: organizationBudgetRejectionThresholdForBudget(input.budget),
    note: input.note,
    sourceEventIds: input.budget.sourceEventIds,
    votedAt: input.votedAt,
  };
}

export function organizationBudgetTreasurySpendPayload(
  input: OrganizationBudgetTreasuryPayloadInput,
): OrganizationTreasuryChangedPayload {
  return {
    treasuryEventId: input.treasuryEventId,
    organizationId: input.budget.organizationId,
    organizationName: input.budget.organizationName,
    regionId: input.budget.regionId,
    resourceId: input.budget.resourceId,
    amountDelta: -input.budget.amount,
    balanceAfter: input.balanceAfter,
    reason: `organization_budget:${input.budget.budgetId}`,
    sourceEventIds: input.sourceEventIds,
    recordedAt: input.recordedAt,
  };
}

export function organizationBudgetResolvedPayload(
  input: OrganizationBudgetResolvedPayloadInput,
): OrganizationBudgetResolvedPayload {
  return {
    budgetId: input.budget.budgetId,
    organizationId: input.budget.organizationId,
    organizationName: input.budget.organizationName,
    regionId: input.budget.regionId,
    resourceId: input.budget.resourceId,
    amount: input.budget.amount,
    resolution: input.resolution,
    resolvedByAgentId: input.resolvedByAgentId,
    resolvedByExplorerId: input.resolvedByExplorerId,
    note: input.note,
    treasuryEventId: input.treasuryEventId,
    sourceEventIds: input.sourceEventIds,
    resolvedAt: input.resolvedAt,
  };
}

export function planOrganizationBudgetResolutionEvents(
  input: OrganizationBudgetResolutionEventsInput,
): readonly EpochEvent[] {
  const nextEvents: EpochEvent[] = [];
  let treasuryEventId: string | undefined;
  let sourceEventIds: readonly string[] = input.budget.sourceEventIds;
  const requiresVoteRecord = organizationBudgetRequiresVoteRecord(input.budget);

  if (requiresVoteRecord) {
    const voteId = input.idFactory(
      "organization_politics",
      `${input.budget.organizationId}:budget:${input.budget.budgetId}:vote:${input.resolvedByAgentId}`,
    );
    const votePayload = organizationBudgetVotePayload({
      voteId,
      budget: input.budget,
      decision: input.resolution,
      voterAgentId: input.resolvedByAgentId,
      voterExplorerId: input.resolvedByExplorerId,
      voterRole: input.resolverRole,
      note: input.note,
      votedAt: input.resolvedAt,
    });
    const voteRecorded = input.makeEvent("organization_budget_vote_recorded", voteId, votePayload, {
      aggregateType: "organization",
      agentId: input.resolvedByAgentId,
    });
    nextEvents.push(voteRecorded);
    if (organizationBudgetDecisionStillPending(input.budget, input.resolution)) {
      return nextEvents;
    }
  }

  if (input.resolution === "approved") {
    if (typeof input.treasuryBalanceBefore !== "number") {
      throw new Error("organization_budget_treasury_balance_required");
    }
    treasuryEventId = input.idFactory(
      "organization_politics",
      `${input.budget.organizationId}:budget:${input.budget.budgetId}:treasury`,
    );
    const treasuryPayload = organizationBudgetTreasurySpendPayload({
      treasuryEventId,
      budget: input.budget,
      balanceAfter: input.treasuryBalanceBefore - input.budget.amount,
      sourceEventIds: nextEvents.length > 0 ? nextEvents.map((event) => event.eventId) : input.budget.sourceEventIds,
      recordedAt: input.resolvedAt,
    });
    const treasuryChanged = input.makeEvent("organization_treasury_changed", treasuryEventId, treasuryPayload, {
      aggregateType: "organization",
      agentId: input.resolvedByAgentId,
    });
    nextEvents.push(treasuryChanged);
    sourceEventIds = [treasuryChanged.eventId];
  } else if (nextEvents.length > 0) {
    sourceEventIds = nextEvents.map((event) => event.eventId);
  }

  const resolvedPayload = organizationBudgetResolvedPayload({
    budget: input.budget,
    resolution: input.resolution,
    resolvedByAgentId: input.resolvedByAgentId,
    resolvedByExplorerId: input.resolvedByExplorerId,
    note: input.note,
    treasuryEventId,
    sourceEventIds,
    resolvedAt: input.resolvedAt,
  });
  const resolved = input.makeEvent("organization_budget_resolved", input.budget.budgetId, resolvedPayload, {
    aggregateType: "organization",
    agentId: input.resolvedByAgentId,
  });
  nextEvents.push(resolved);
  return nextEvents;
}

export function organizationTreasuryContributionPayload(
  input: OrganizationTreasuryContributionPayloadInput,
): OrganizationTreasuryChangedPayload {
  return {
    treasuryEventId: input.treasuryEventId,
    organizationId: input.organizationId,
    organizationName: input.organizationName,
    regionId: input.regionId,
    resourceId: input.resourceId,
    amountDelta: input.amount,
    balanceAfter: input.balanceAfter,
    reason: `organization_contribution:${input.contributingAgentId}`,
    sourceEventIds: input.sourceEventIds,
    recordedAt: input.recordedAt,
  };
}

export function organizationTreasuryContributionSpendPayload(
  input: OrganizationTreasuryContributionSpendPayloadInput,
): ResourceSpentPayload {
  return {
    resourceId: input.resourceId,
    amount: input.amount,
    reason: `organization_treasury_contribution:${input.organizationId}`,
    balanceAfter: input.memberBalanceBefore - input.amount,
    accountRef: `agent:${input.agentId}`,
    assetKey: `resource:${input.resourceId}`,
    unit: "unit",
    quantityMinor: (BigInt(input.amount) * 100n).toString(),
  };
}

export function planOrganizationTreasuryContributionEvents(
  input: OrganizationTreasuryContributionEventsInput,
): readonly EpochEvent[] {
  const spent = resourceSpentEvent(input.makeEvent, input.contributingAgentId, organizationTreasuryContributionSpendPayload({
    agentId: input.contributingAgentId,
    organizationId: input.organizationId,
    resourceId: input.resourceId,
    amount: input.amount,
    memberBalanceBefore: input.memberBalanceBefore,
  }));
  const treasuryPayload = organizationTreasuryContributionPayload({
    treasuryEventId: input.treasuryEventId,
    organizationId: input.organizationId,
    organizationName: input.organizationName,
    regionId: input.regionId,
    resourceId: input.resourceId,
    amount: input.amount,
    balanceAfter: input.treasuryBalanceBefore + input.amount,
    contributingAgentId: input.contributingAgentId,
    sourceEventIds: [spent.eventId],
    recordedAt: input.contributedAt,
  });
  const treasuryChanged = input.makeEvent("organization_treasury_changed", input.treasuryEventId, treasuryPayload, {
    aggregateType: "organization",
    agentId: input.contributingAgentId,
  });
  return [spent, treasuryChanged];
}

export function organizationPoliticsRecordedPayload(
  input: OrganizationPoliticsRecordedPayloadInput,
): OrganizationPoliticsRecordedPayload {
  const template = organizationPoliticsTemplate(input.templateIndex);
  const standingAfter = input.standingBefore + template.standingDelta;
  return {
    politicsId: input.politicsId,
    organizationId: input.organizationId,
    organizationName: input.organizationName,
    regionId: input.regionId,
    npcId: input.npcId,
    counterpartyNpcId: input.counterpartyNpcId,
    kind: template.kind,
    title: template.title(input.organizationName),
    summary: template.summary(input.npcName, input.organizationName, input.counterpartyName),
    standingDelta: template.standingDelta,
    standingAfter,
    sourceEventIds: input.sourceEventIds,
    recordedAt: input.recordedAt,
  };
}

export function planOrganizationPoliticsTickEvents<TProjection extends OrganizationPoliticsTickProjectionLike>(
  input: PlanOrganizationPoliticsTickEventsInput<TProjection>,
): readonly EpochEvent[] {
  const { applyEvents, current, idFactory, makeEvent, selectedOrganizations, tickedAt } = input;
  const nextEvents: EpochEvent[] = [];

  for (const organization of selectedOrganizations) {
    const interimProjection = applyEvents(current, nextEvents);
    const plan = organizationPoliticsTickPlan({
      organizationId: organization.organizationId,
      membershipIds: interimProjection.organizationMembershipIdsByOrganization[organization.organizationId] || [],
      membershipsById: interimProjection.organizationMemberships,
      npcsById: interimProjection.npcs,
      careerIdsByNpc: interimProjection.npcCareerIdsByNpc,
      careersById: interimProjection.npcCareerRecords,
      politicsIds: interimProjection.organizationPoliticsIdsByOrganization[organization.organizationId] || [],
      standingBefore: interimProjection.organizationPoliticalStandingByOrganization[organization.organizationId] || 0,
    });
    if (!plan?.membership.npcId) continue;
    const npcId = plan.membership.npcId;
    const politicsKindSeed = `${organization.organizationId}:${npcId}:${plan.politicsKind}:${plan.templateIndex}:${tickedAt}`;
    const politicsId = idFactory("organization_politics", politicsKindSeed);
    const payload = organizationPoliticsRecordedPayload({
      politicsId,
      organizationId: organization.organizationId,
      organizationName: organization.displayName || organization.organizationId,
      regionId: organization.regionId,
      npcId,
      counterpartyNpcId: plan.counterpartyMembership?.npcId,
      npcName: plan.npc.displayName,
      counterpartyName: plan.counterpartyNpc?.displayName,
      templateIndex: plan.templateIndex,
      standingBefore: plan.standingBefore,
      sourceEventIds: plan.sourceEventIds,
      recordedAt: tickedAt,
    });
    nextEvents.push(makeEvent("organization_politics_recorded", politicsId, payload, {
      aggregateType: "organization_politics",
    }));
  }

  return nextEvents;
}

function aggregateIdsForEventType(
  events: readonly EpochEvent[],
  eventType: EpochEvent["eventType"],
): readonly string[] {
  return events
    .filter((event) => event.eventType === eventType)
    .map((event) => event.aggregateId);
}

function projectionValues<TRecord extends Readonly<Record<string, unknown>>>(
  ids: readonly string[],
  records: TRecord,
): readonly ProjectionRecordValue<TRecord>[] {
  const values: ProjectionRecordValue<TRecord>[] = [];
  for (const id of ids) {
    const value = records[id] as ProjectionRecordValue<TRecord> | undefined;
    if (value !== undefined) values.push(value);
  }
  return values;
}

export function projectOrganizationPoliticsTickResult<TProjection extends OrganizationPoliticsTickProjectionLike>(
  input: ProjectOrganizationPoliticsTickResultInput<TProjection>,
): ProjectedOrganizationPoliticsTickResult<TProjection> {
  type Result = ProjectedOrganizationPoliticsTickResult<TProjection>;
  return {
    tickedAt: input.tickedAt,
    politics: projectionValues(
      aggregateIdsForEventType(input.events, "organization_politics_recorded"),
      input.projection.organizationPolitics,
    ) as Result["politics"],
  };
}

export function organizationUpgradeTreasurySpendPayload(
  input: OrganizationUpgradeTreasurySpendPayloadInput,
): OrganizationTreasuryChangedPayload {
  return {
    treasuryEventId: input.treasuryEventId,
    organizationId: input.organizationId,
    organizationName: input.organizationName,
    regionId: input.regionId,
    resourceId: input.catalogEntry.costResourceId,
    amountDelta: -input.catalogEntry.costAmount,
    balanceAfter: input.balanceAfter,
    reason: `organization_upgrade:${input.catalogEntry.upgradeKey}`,
    sourceEventIds: input.sourceEventIds,
    recordedAt: input.recordedAt,
  };
}

export function organizationUpgradePurchasedPayload(
  input: OrganizationUpgradePurchasedPayloadInput,
): OrganizationUpgradePurchasedPayload {
  return {
    upgradeId: input.upgradeId,
    organizationId: input.organizationId,
    organizationName: input.organizationName,
    regionId: input.regionId,
    upgradeKey: input.catalogEntry.upgradeKey,
    title: input.catalogEntry.title,
    description: input.catalogEntry.description,
    purchasedByAgentId: input.purchasedByAgentId,
    purchasedByExplorerId: input.purchasedByExplorerId,
    costResourceId: input.catalogEntry.costResourceId,
    costAmount: input.catalogEntry.costAmount,
    sourceEventIds: input.sourceEventIds,
    purchasedAt: input.purchasedAt,
  };
}

export function planOrganizationUpgradePurchaseEvents(
  input: OrganizationUpgradePurchaseEventsInput,
): readonly EpochEvent[] {
  const treasuryEventId = input.idFactory(
    "organization_politics",
    `${input.organizationId}:upgrade:${input.catalogEntry.upgradeKey}:treasury`,
  );
  const treasuryPayload = organizationUpgradeTreasurySpendPayload({
    treasuryEventId,
    organizationId: input.organizationId,
    organizationName: input.organizationName,
    regionId: input.regionId,
    catalogEntry: input.catalogEntry,
    balanceAfter: input.treasuryBalanceBefore - input.catalogEntry.costAmount,
    sourceEventIds: input.sourceEventIds,
    recordedAt: input.purchasedAt,
  });
  const treasuryChanged = input.makeEvent("organization_treasury_changed", treasuryEventId, treasuryPayload, {
    aggregateType: "organization",
    agentId: input.purchasedByAgentId,
  });
  const upgradeId = input.idFactory(
    "organization_politics",
    `${input.organizationId}:${input.catalogEntry.upgradeKey}:upgrade`,
  );
  const upgradePayload = organizationUpgradePurchasedPayload({
    upgradeId,
    organizationId: input.organizationId,
    organizationName: input.organizationName,
    regionId: input.regionId,
    catalogEntry: input.catalogEntry,
    purchasedByAgentId: input.purchasedByAgentId,
    purchasedByExplorerId: input.purchasedByExplorerId,
    sourceEventIds: [treasuryChanged.eventId],
    purchasedAt: input.purchasedAt,
  });
  const purchased = input.makeEvent("organization_upgrade_purchased", upgradeId, upgradePayload, {
    aggregateType: "organization",
    agentId: input.purchasedByAgentId,
  });
  return [treasuryChanged, purchased];
}

export function requireOrganizationUpgradeCatalogEntry(upgradeKey: string): EpochOrganizationUpgradeCatalogEntry {
  const normalized = stableKey(assertNonEmptyString(upgradeKey, "organization_upgrade_key"));
  const entry = EPOCH_ORGANIZATION_UPGRADE_CATALOG.find((candidate) => candidate.upgradeKey === normalized);
  if (!entry) throw new Error("organization_upgrade_not_found");
  return entry;
}
