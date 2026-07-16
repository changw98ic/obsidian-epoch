import {
  currentBalance,
  type ResourceBalanceProjection,
} from "./resourceRules.ts";
import type { EpochEvent } from "./events.ts";

export const IDENTITY_LEGEND_PER_EXTRA_SLOT = 3;
export const IDENTITY_LEVEL_FOR_EXTRA_SLOT = 5;
export const IDENTITY_REGION_FACTION_RANK_FOR_EXTRA_SLOT = 2;
export const IDENTITY_SPECIAL_SERVER_EVENTS_PER_EXTRA_SLOT = 1;
export const MAX_ACTIVE_IDENTITY_SLOTS = 3;

export type EpochIdentitySlotEntitlementSource =
  | "legend"
  | "level"
  | "legacyAchievement"
  | "regionFactionRank"
  | "specialServerEvent";

export interface EpochIdentitySlotEntitlementEvidence {
  readonly source: EpochIdentitySlotEntitlementSource;
  readonly value: number;
  readonly threshold: number;
  readonly unlockCount: number;
  readonly sourceEventIds: readonly string[];
}

export interface EpochIdentitySlotEntitlementBreakdown {
  readonly legend: EpochIdentitySlotEntitlementEvidence;
  readonly level: EpochIdentitySlotEntitlementEvidence;
  readonly legacyAchievement: EpochIdentitySlotEntitlementEvidence;
  readonly regionFactionRank: EpochIdentitySlotEntitlementEvidence;
  readonly specialServerEvent: EpochIdentitySlotEntitlementEvidence;
  readonly totalUnlockCount: number;
  readonly appliedUnlockCount: number;
}

export interface EpochIdentitySlotState {
  readonly explorerId: string;
  readonly active: number;
  readonly max: number;
  readonly available: number;
  readonly legend: number;
  readonly legendPerSlot: number;
  readonly nextUnlockLegend?: number;
  readonly legendToNextSlot: number;
  readonly capped: boolean;
  readonly entitlementBreakdown: EpochIdentitySlotEntitlementBreakdown;
}

export interface IdentityForSlotRules {
  readonly status: string;
}

export interface IdentityProjectionForRules<TIdentity extends IdentityForSlotRules = IdentityForSlotRules> {
  readonly identities: Readonly<Record<string, TIdentity | undefined>>;
}

export interface IdentitySlotProjectionForRules<TIdentity extends IdentityForSlotRules = IdentityForSlotRules>
  extends ResourceBalanceProjection {
  readonly lineage: Readonly<Record<string, readonly string[]>>;
  readonly identities: Readonly<Record<string, TIdentity | undefined>>;
  readonly events?: readonly EpochEvent[];
}

function uniqueEventIds(events: readonly EpochEvent[], predicate: (event: EpochEvent) => boolean): readonly string[] {
  return [...new Set(events.filter(predicate).map((event) => event.eventId))];
}

function eventBelongsToExplorer(
  event: EpochEvent,
  explorerId: string,
  identityIds: ReadonlySet<string>,
): boolean {
  return event.actorExplorerId === explorerId
    || (event.agentId !== undefined && identityIds.has(event.agentId));
}

function isLevelMilestone(
  event: EpochEvent,
  explorerId: string,
  identityIds: ReadonlySet<string>,
): boolean {
  switch (event.eventType) {
    case "turn_resolved":
    case "hosted_action_recorded":
      return eventBelongsToExplorer(event, explorerId, identityIds) && event.payload.nonEvidence !== true;
    case "bounty_claimed":
      return event.payload.claimantExplorerId === explorerId;
    case "race_commission_completed":
      return event.payload.explorerId === explorerId;
    case "contested_objective_settled":
    case "resource_node_settled":
    case "anomaly_event_resolved":
      return event.payload.winnerExplorerId === explorerId;
    case "party_run_settled":
      return event.payload.memberResults.some((member) =>
        member.explorerId === explorerId && member.score > 0);
    case "raid_resolved":
      return event.payload.outcome === "attacker_won"
        ? event.payload.attackerExplorerId === explorerId
        : event.payload.defenderExplorerId === explorerId;
    case "season_objective_completed":
      return event.payload.completedByExplorerId === explorerId;
    default:
      return false;
  }
}

function levelEvidence(
  events: readonly EpochEvent[],
  explorerId: string,
  identityIds: ReadonlySet<string>,
): EpochIdentitySlotEntitlementEvidence {
  const identitySourceEventIds = uniqueEventIds(
    events,
    (event) => event.eventType === "identity_issued"
      && event.payload.explorerId === explorerId,
  );
  const milestoneEventIds = uniqueEventIds(
    events,
    (event) => isLevelMilestone(event, explorerId, identityIds),
  );
  const sourceEventIds = [...new Set([...identitySourceEventIds, ...milestoneEventIds])];
  const value = identitySourceEventIds.length === 0 ? 0 : 1 + milestoneEventIds.length;
  return {
    source: "level",
    value,
    threshold: IDENTITY_LEVEL_FOR_EXTRA_SLOT,
    unlockCount: value < IDENTITY_LEVEL_FOR_EXTRA_SLOT
      ? 0
      : 1 + Math.floor(
        (value - IDENTITY_LEVEL_FOR_EXTRA_SLOT) / (IDENTITY_LEVEL_FOR_EXTRA_SLOT - 1),
      ),
    sourceEventIds,
  };
}

function legacyAchievementEvidence(
  events: readonly EpochEvent[],
  explorerId: string,
): EpochIdentitySlotEntitlementEvidence {
  const sourceEventIds = uniqueEventIds(
    events,
    (event) => event.eventType === "legend_awarded"
      && event.payload.explorerId === explorerId,
  );
  const sourceEventIdSet = new Set(sourceEventIds);
  const countedEventIds = new Set<string>();
  const value = events.reduce((total, event) => {
    if (event.eventType !== "legend_awarded"
      || !sourceEventIdSet.has(event.eventId)
      || countedEventIds.has(event.eventId)) return total;
    countedEventIds.add(event.eventId);
    return total + event.payload.amount;
  }, 0);
  return {
    source: "legacyAchievement",
    value,
    threshold: IDENTITY_LEGEND_PER_EXTRA_SLOT,
    unlockCount: Math.floor(value / IDENTITY_LEGEND_PER_EXTRA_SLOT),
    sourceEventIds,
  };
}

function regionFactionRankEvidence(
  events: readonly EpochEvent[],
  explorerId: string,
): EpochIdentitySlotEntitlementEvidence {
  let value = 0;
  const sourceEventIds = uniqueEventIds(events, (event) => {
    if (event.eventType === "season_contribution_recorded"
      && event.payload.explorerId === explorerId) {
      value = Math.max(value, 1);
      return true;
    }
    if ((event.eventType === "season_objective_completed"
        && event.payload.completedByExplorerId === explorerId)
      || (event.eventType === "season_resolved"
        && event.payload.winnerExplorerId === explorerId)) {
      value = Math.max(value, 2);
      return true;
    }
    if (event.eventType === "region_control_changed"
      && event.payload.claimingExplorerId === explorerId) {
      value = Math.max(value, 3);
      return true;
    }
    return false;
  });
  return {
    source: "regionFactionRank",
    value,
    threshold: IDENTITY_REGION_FACTION_RANK_FOR_EXTRA_SLOT,
    unlockCount: Math.max(0, value - IDENTITY_REGION_FACTION_RANK_FOR_EXTRA_SLOT + 1),
    sourceEventIds,
  };
}

function specialServerEventEvidence(
  events: readonly EpochEvent[],
  explorerId: string,
): EpochIdentitySlotEntitlementEvidence {
  const sourceEventIds = uniqueEventIds(events, (event) => {
    switch (event.eventType) {
      case "race_commission_completed":
        return event.payload.explorerId === explorerId && event.payload.place === 1;
      case "anomaly_event_resolved":
      case "season_resolved":
        return event.payload.winnerExplorerId === explorerId;
      case "region_monument_built":
        return event.payload.winnerExplorerId === explorerId;
      default:
        return false;
    }
  });
  return {
    source: "specialServerEvent",
    value: sourceEventIds.length,
    threshold: IDENTITY_SPECIAL_SERVER_EVENTS_PER_EXTRA_SLOT,
    unlockCount: Math.floor(sourceEventIds.length / IDENTITY_SPECIAL_SERVER_EVENTS_PER_EXTRA_SLOT),
    sourceEventIds,
  };
}

function entitlementBreakdown(
  projection: IdentitySlotProjectionForRules,
  explorerId: string,
  identityIds: readonly string[],
): EpochIdentitySlotEntitlementBreakdown {
  const events = projection.events || [];
  const identityIdSet = new Set(identityIds);
  const legendSourceEventIds = uniqueEventIds(events, (event) => (
    event.eventType === "resource_granted"
    && identityIdSet.has(event.aggregateId)
    && event.payload.resourceId === "legend"
  ));
  const projectedLegendValue = identityIds.reduce(
    (total, agentId) => total + currentBalance(projection, agentId, "legend"),
    0,
  );
  const legendValue = legendSourceEventIds.length ? projectedLegendValue : 0;
  const legend: EpochIdentitySlotEntitlementEvidence = {
    source: "legend",
    value: legendValue,
    threshold: IDENTITY_LEGEND_PER_EXTRA_SLOT,
    unlockCount: Math.floor(legendValue / IDENTITY_LEGEND_PER_EXTRA_SLOT),
    sourceEventIds: legendSourceEventIds,
  };
  const level = levelEvidence(events, explorerId, identityIdSet);
  const legacyAchievement = legacyAchievementEvidence(events, explorerId);
  const regionFactionRank = regionFactionRankEvidence(events, explorerId);
  const specialServerEvent = specialServerEventEvidence(events, explorerId);
  const totalUnlockCount = Math.max(legend.unlockCount, legacyAchievement.unlockCount)
    + level.unlockCount
    + regionFactionRank.unlockCount
    + specialServerEvent.unlockCount;
  return {
    legend,
    level,
    legacyAchievement,
    regionFactionRank,
    specialServerEvent,
    totalUnlockCount,
    appliedUnlockCount: Math.min(MAX_ACTIVE_IDENTITY_SLOTS - 1, totalUnlockCount),
  };
}

export function explorerIdentityIds(
  projection: Pick<IdentitySlotProjectionForRules, "lineage">,
  explorerId: string,
): readonly string[] {
  return projection.lineage[explorerId] || [];
}

export function explorerLegend(
  projection: Pick<IdentitySlotProjectionForRules, "lineage" | "resourceBalances">,
  explorerId: string,
): number {
  return explorerIdentityIds(projection, explorerId)
    .reduce((total, agentId) => total + currentBalance(projection, agentId, "legend"), 0);
}

export function identitySlotsForExplorer(
  projection: IdentitySlotProjectionForRules,
  explorerId: string,
): EpochIdentitySlotState {
  const identityIds = explorerIdentityIds(projection, explorerId);
  const active = identityIds
    .map((agentId) => projection.identities[agentId])
    .filter((identity) => identity?.status === "active").length;
  const legend = explorerLegend(projection, explorerId);
  const breakdown = entitlementBreakdown(projection, explorerId, identityIds);
  const max = 1 + breakdown.appliedUnlockCount;
  const capped = max >= MAX_ACTIVE_IDENTITY_SLOTS;
  const legendEvidence = breakdown.legend;
  const nextUnlockLegend = capped
    ? undefined
    : (legendEvidence.unlockCount + 1) * IDENTITY_LEGEND_PER_EXTRA_SLOT;
  return {
    explorerId,
    active,
    max,
    available: Math.max(0, max - active),
    legend,
    legendPerSlot: IDENTITY_LEGEND_PER_EXTRA_SLOT,
    nextUnlockLegend,
    legendToNextSlot: nextUnlockLegend === undefined
      ? 0
      : Math.max(0, nextUnlockLegend - legendEvidence.value),
    capped,
    entitlementBreakdown: breakdown,
  };
}

export function requireIdentitySlot(
  projection: IdentitySlotProjectionForRules,
  explorerId: string,
): EpochIdentitySlotState {
  const slots = identitySlotsForExplorer(projection, explorerId);
  if (slots.available <= 0) throw new Error("identity_slot_limit_reached");
  return slots;
}

export function requireIdentity<TIdentity extends IdentityForSlotRules>(
  projection: IdentityProjectionForRules<TIdentity>,
  agentId: string,
): TIdentity {
  const identity = projection.identities[agentId];
  if (!identity) throw new Error("agent_identity_not_found");
  return identity;
}

export function requireActiveIdentity<TIdentity extends IdentityForSlotRules>(
  projection: IdentityProjectionForRules<TIdentity>,
  agentId: string,
): TIdentity {
  const identity = requireIdentity(projection, agentId);
  if (identity.status !== "active") throw new Error("agent_identity_archived");
  return identity;
}
