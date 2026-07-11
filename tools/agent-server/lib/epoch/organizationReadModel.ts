import type {
  EpochEvent,
} from "./events.ts";
import type {
  EpochOrganization,
  EpochOrganizationBudget,
  EpochOrganizationMembership,
  EpochOrganizationPoliticsRecord,
  EpochOrganizationUpgrade,
  EpochProjection,
} from "./gameCore.ts";
import {
  normalizeTrustClass,
  type EpochResourceId,
  type EpochTrustClass,
} from "./protocol.ts";

type EpochOrganizationTreasuryChangedEvent = Extract<EpochEvent, { readonly eventType: "organization_treasury_changed" }>;

export interface EpochOrganizationTreasuryLedgerEntry {
  readonly ledgerId: string;
  readonly organizationId: string;
  readonly organizationName: string;
  readonly regionId: string;
  readonly resourceId: EpochResourceId;
  readonly amountDelta: number;
  readonly balanceAfter: number;
  readonly reason: string;
  readonly sourceEventIds: readonly string[];
  readonly sourceEventId: string;
  readonly sourceEventType: "organization_treasury_changed";
  readonly actorAgentId?: string;
  readonly trustClass: EpochTrustClass;
  readonly recordedAt: string;
}

export interface EpochOrganizationInfluenceScore {
  readonly total: number;
  readonly threshold: number;
  readonly memberScore: number;
  readonly resourceScore: number;
  readonly armedScore: number;
  readonly territoryScore: number;
  readonly diplomacyScore: number;
  readonly supernaturalScore: number;
  readonly factionReviewRequired: boolean;
  readonly reviewReason: string;
}

export interface EpochOrganizationView extends EpochOrganization {
  readonly standing: number;
  readonly treasury: Partial<Record<EpochResourceId, number>>;
  readonly upgradeKeys: readonly EpochOrganizationUpgrade["upgradeKey"][];
  readonly upgrades: readonly EpochOrganizationUpgrade[];
  readonly budgets: readonly EpochOrganizationBudget[];
  readonly treasuryLedger: readonly EpochOrganizationTreasuryLedgerEntry[];
  readonly influenceScore: EpochOrganizationInfluenceScore;
}

const ORGANIZATION_INFLUENCE_REVIEW_THRESHOLD = 8;

export function isOrganizationTreasuryChangedEvent(event: EpochEvent): event is EpochOrganizationTreasuryChangedEvent {
  return event.eventType === "organization_treasury_changed";
}

export function diplomacyView(
  projection: EpochProjection,
  input: { regionId?: string; agentId?: string; status?: string } = {},
) {
  const diplomacyIds = input.regionId
    ? projection.diplomacyIdsByRegion[input.regionId] || []
    : input.agentId
      ? projection.diplomacyIdsByAgent[input.agentId] || []
      : Object.keys(projection.diplomacyRecords);
  return diplomacyIds
    .map((diplomacyId) => projection.diplomacyRecords[diplomacyId])
    .filter(Boolean)
    .filter((diplomacy) => !input.agentId || diplomacy.sourceAgentId === input.agentId || diplomacy.targetAgentId === input.agentId)
    .filter((diplomacy) => !input.status || diplomacy.status === input.status)
    .sort((left, right) => right.proposedAt.localeCompare(left.proposedAt) || left.diplomacyId.localeCompare(right.diplomacyId));
}

export function organizationInfluenceScore(input: {
  readonly projection: EpochProjection;
  readonly organization: EpochOrganization;
  readonly treasury: Partial<Record<EpochResourceId, number>>;
  readonly upgrades: readonly EpochOrganizationUpgrade[];
  readonly standing: number;
}): EpochOrganizationInfluenceScore {
  const memberScore = (input.organization.memberNpcIds.length + input.organization.memberAgentIds.length) * 2;
  const treasuryTotal = Object.values(input.treasury).reduce((total, amount) => total + Number(amount || 0), 0);
  const resourceScore = Math.min(6, Math.floor(treasuryTotal / 10));
  const armedScore = input.upgrades.some((upgrade) => upgrade.upgradeKey === "training_hall") ? 3 : 0;
  const territoryScore = Math.min(4, Math.max(0, input.standing));
  const diplomacyScore = Math.min(6, diplomacyView(input.projection, { regionId: input.organization.regionId })
    .filter((diplomacy) =>
      input.organization.memberAgentIds.includes(diplomacy.sourceAgentId)
      || input.organization.memberAgentIds.includes(diplomacy.targetAgentId))
    .length * 2);
  const supernaturalScore = Math.min(6, Math.floor((Number(input.treasury.aether || 0) + Number(input.treasury.legend || 0) * 2) / 5));
  const total = memberScore + resourceScore + armedScore + territoryScore + diplomacyScore + supernaturalScore;
  const factionReviewRequired = total >= ORGANIZATION_INFLUENCE_REVIEW_THRESHOLD;
  const reviewDrivers = [
    memberScore >= ORGANIZATION_INFLUENCE_REVIEW_THRESHOLD ? "成员规模" : "",
    resourceScore >= 3 ? "资源" : "",
    armedScore > 0 ? "武装" : "",
    territoryScore > 0 ? "领地" : "",
    diplomacyScore > 0 ? "外交" : "",
    supernaturalScore > 0 ? "超凡能力" : "",
  ].filter(Boolean);
  return {
    total,
    threshold: ORGANIZATION_INFLUENCE_REVIEW_THRESHOLD,
    memberScore,
    resourceScore,
    armedScore,
    territoryScore,
    diplomacyScore,
    supernaturalScore,
    factionReviewRequired,
    reviewReason: factionReviewRequired
      ? `${reviewDrivers.join("、") || "综合影响"}超过普通小团体阈值，进入阵营候选审档。`
      : "影响力低于阵营候选阈值，仍按普通小团体展示。",
  };
}

export function organizationMembershipsView(
  projection: EpochProjection,
  input: { regionId?: string; npcId?: string; agentId?: string; organizationId?: string } = {},
): readonly EpochOrganizationMembership[] {
  const membershipIds = input.organizationId
    ? projection.organizationMembershipIdsByOrganization[input.organizationId] || []
    : input.npcId
    ? projection.organizationMembershipIdsByNpc[input.npcId] || []
    : input.agentId
      ? projection.organizationMembershipIdsByAgent[input.agentId] || []
      : input.regionId
        ? projection.organizationMembershipIdsByRegion[input.regionId] || []
        : Object.keys(projection.organizationMemberships);
  return membershipIds
    .map((membershipId) => projection.organizationMemberships[membershipId])
    .filter(Boolean)
    .sort((left, right) => right.recordedAt.localeCompare(left.recordedAt) || left.membershipId.localeCompare(right.membershipId));
}

function treasuryLedgerForOrganization(
  projection: EpochProjection,
  organizationId: string,
): readonly EpochOrganizationTreasuryLedgerEntry[] {
  return projection.events
    .filter(isOrganizationTreasuryChangedEvent)
    .filter((event) => event.payload.organizationId === organizationId)
    .map((event): EpochOrganizationTreasuryLedgerEntry => ({
      ledgerId: event.payload.treasuryEventId,
      organizationId: event.payload.organizationId,
      organizationName: event.payload.organizationName,
      regionId: event.payload.regionId,
      resourceId: event.payload.resourceId,
      amountDelta: event.payload.amountDelta,
      balanceAfter: event.payload.balanceAfter,
      reason: event.payload.reason,
      sourceEventIds: event.payload.sourceEventIds,
      sourceEventId: event.eventId,
      sourceEventType: "organization_treasury_changed",
      actorAgentId: event.agentId,
      trustClass: normalizeTrustClass(event.trustClass),
      recordedAt: event.payload.recordedAt,
    }))
    .sort((left, right) => right.recordedAt.localeCompare(left.recordedAt) || right.sourceEventId.localeCompare(left.sourceEventId))
    .slice(0, 20);
}

export function organizationsView(
  projection: EpochProjection,
  input: { regionId?: string; npcId?: string; agentId?: string; organizationId?: string } = {},
): readonly EpochOrganizationView[] {
  const memberships = organizationMembershipsView(projection, input);
  const organizationIds = input.organizationId
    ? [input.organizationId]
    : input.npcId
    ? memberships.map((membership) => membership.organizationId)
    : input.agentId
      ? memberships.map((membership) => membership.organizationId)
      : input.regionId
        ? Object.values(projection.organizations).filter((organization) => organization.regionId === input.regionId).map((organization) => organization.organizationId)
        : Object.keys(projection.organizations);
  return organizationIds
    .map((organizationId) => projection.organizations[organizationId])
    .filter(Boolean)
    .filter((organization, index, organizations) =>
      organizations.findIndex((candidate) => candidate.organizationId === organization.organizationId) === index)
    .map((organization) => {
      const standing = projection.organizationPoliticalStandingByOrganization[organization.organizationId] || 0;
      const treasury = { ...(projection.organizationTreasuryBalances[organization.organizationId] || {}) };
      const upgradeKeys = (projection.organizationUpgradeIdsByOrganization[organization.organizationId] || [])
        .map((upgradeId) => projection.organizationUpgrades[upgradeId]?.upgradeKey)
        .filter((upgradeKey): upgradeKey is EpochOrganizationUpgrade["upgradeKey"] => Boolean(upgradeKey));
      const upgrades = (projection.organizationUpgradeIdsByOrganization[organization.organizationId] || [])
        .map((upgradeId) => projection.organizationUpgrades[upgradeId])
        .filter((upgrade): upgrade is EpochOrganizationUpgrade => Boolean(upgrade));
      const budgets = (projection.organizationBudgetIdsByOrganization[organization.organizationId] || [])
        .map((budgetId) => projection.organizationBudgets[budgetId])
        .filter((budget): budget is EpochOrganizationBudget => Boolean(budget))
        .sort((left, right) => right.proposedAt.localeCompare(left.proposedAt) || left.budgetId.localeCompare(right.budgetId));
      return {
        ...organization,
        standing,
        treasury,
        upgradeKeys,
        upgrades,
        budgets,
        treasuryLedger: treasuryLedgerForOrganization(projection, organization.organizationId),
        influenceScore: organizationInfluenceScore({ projection, organization, treasury, upgrades, standing }),
      };
    })
    .sort((left, right) => left.displayName.localeCompare(right.displayName) || left.organizationId.localeCompare(right.organizationId));
}

export function organizationPoliticsView(
  projection: EpochProjection,
  input: { regionId?: string; npcId?: string; organizationId?: string } = {},
): readonly EpochOrganizationPoliticsRecord[] {
  const politicsIds = input.npcId
    ? projection.organizationPoliticsIdsByNpc[input.npcId] || []
    : input.organizationId
      ? projection.organizationPoliticsIdsByOrganization[input.organizationId] || []
      : input.regionId
        ? projection.organizationPoliticsIdsByRegion[input.regionId] || []
        : Object.keys(projection.organizationPolitics);
  return politicsIds
    .map((politicsId) => projection.organizationPolitics[politicsId])
    .filter(Boolean)
    .filter((politics, index, politicsRecords) =>
      politicsRecords.findIndex((candidate) => candidate.politicsId === politics.politicsId) === index)
    .sort((left, right) => right.recordedAt.localeCompare(left.recordedAt) || left.politicsId.localeCompare(right.politicsId));
}
