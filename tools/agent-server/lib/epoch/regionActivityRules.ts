export type EpochRegionActivityKind =
  | "anomaly"
  | "downtime"
  | "objective"
  | "resource_node"
  | "bounty"
  | "party_run"
  | "raid"
  | "retaliation"
  | "revolt"
  | "diplomacy"
  | "organization_politics"
  | "season"
  | "market"
  | "journey";

export type EpochRegionActivitySourceEventType =
  | "downtime_tick_resolved"
  | "downtime_claimed"
  | "contested_objective_created"
  | "contested_objective_contributed"
  | "race_commission_completed"
  | "contested_objective_settled"
  | "resource_node_spawned"
  | "resource_node_contested"
  | "resource_node_settled"
  | "anomaly_event_spawned"
  | "anomaly_event_contested"
  | "anomaly_event_resolved"
  | "bounty_created"
  | "bounty_claimed"
  | "party_run_created"
  | "party_invite_updated"
  | "party_join_requested"
  | "party_join_request_resolved"
  | "party_member_joined"
  | "party_run_settled"
  | "raid_resolved"
  | "retaliation_opportunity_created"
  | "retaliation_resolved"
  | "region_revolt_resolved"
  | "diplomacy_proposed"
  | "diplomacy_responded"
  | "organization_politics_recorded"
  | "organization_created"
  | "organization_prestige_changed"
  | "organization_treasury_changed"
  | "organization_budget_proposed"
  | "organization_budget_vote_recorded"
  | "organization_budget_resolved"
  | "organization_upgrade_purchased"
  | "market_order_created"
  | "market_order_filled"
  | "market_order_cancelled"
  | "market_order_expired"
  | "direct_trade_created"
  | "direct_trade_accepted"
  | "direct_trade_cancelled"
  | "direct_trade_expired"
  | "season_campaign_created"
  | "season_started"
  | "season_objective_created"
  | "season_contribution_recorded"
  | "season_objective_completed"
  | "season_campaign_resolved"
  | "season_resolved"
  | "hosted_action_recorded"
  | "journey_world_solidified";

export interface EpochRegionActivity {
  readonly activityId: string;
  readonly regionId: string;
  readonly kind: EpochRegionActivityKind;
  readonly agentId: string;
  readonly title: string;
  readonly summary: string;
  readonly occurredAt: string;
  readonly sourceEventId: string;
  readonly sourceEventType: EpochRegionActivitySourceEventType;
}

export interface RegionActivitySourceEventForRules {
  readonly eventId: string;
}

export function addRegionActivity(
  regionActivities: Record<string, EpochRegionActivity>,
  regionActivityIdsByRegion: Record<string, string[]>,
  activity: EpochRegionActivity,
): void {
  regionActivities[activity.activityId] = activity;
  regionActivityIdsByRegion[activity.regionId] = [
    ...(regionActivityIdsByRegion[activity.regionId] || []),
    activity.activityId,
  ].filter((activityId, index, activityIds) => activityIds.indexOf(activityId) === index);
}

export function addRegionActivityForEvent(
  regionActivities: Record<string, EpochRegionActivity>,
  regionActivityIdsByRegion: Record<string, string[]>,
  event: RegionActivitySourceEventForRules,
  activity: Omit<EpochRegionActivity, "activityId" | "sourceEventId">,
): void {
  addRegionActivity(regionActivities, regionActivityIdsByRegion, {
    ...activity,
    activityId: event.eventId,
    sourceEventId: event.eventId,
  });
}

export function addRegionActivitiesForEventRegions(
  regionActivities: Record<string, EpochRegionActivity>,
  regionActivityIdsByRegion: Record<string, string[]>,
  event: RegionActivitySourceEventForRules,
  regionIds: readonly string[],
  activity: Omit<EpochRegionActivity, "activityId" | "regionId" | "sourceEventId">,
): void {
  for (const regionId of uniqueValues(regionIds)) {
    addRegionActivity(regionActivities, regionActivityIdsByRegion, {
      ...activity,
      activityId: `${event.eventId}:${regionId}`,
      regionId,
      sourceEventId: event.eventId,
    });
  }
}

function uniqueValues(values: readonly string[]): string[] {
  return [...new Set(values)];
}
