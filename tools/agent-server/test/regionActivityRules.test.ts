import assert from "node:assert/strict";
import test from "node:test";

import {
  addRegionActivitiesForEventRegions,
  addRegionActivity,
  addRegionActivityForEvent,
  type EpochRegionActivity,
} from "../lib/epoch/regionActivityRules.ts";

const baseActivity = {
  kind: "market",
  agentId: "agent_alpha",
  title: "市场订单",
  summary: "发布市场订单。",
  occurredAt: "2026-07-07T01:00:00.000Z",
  sourceEventType: "market_order_created",
} as const;

test("region activity rules add activities and dedupe per-region ids", () => {
  const activities: Record<string, EpochRegionActivity> = {};
  const idsByRegion: Record<string, string[]> = {
    region_gray_harbor: ["activity_existing"],
  };
  const activity: EpochRegionActivity = {
    ...baseActivity,
    activityId: "activity_existing",
    regionId: "region_gray_harbor",
    sourceEventId: "event_existing",
  };

  addRegionActivity(activities, idsByRegion, activity);
  addRegionActivity(activities, idsByRegion, activity);

  assert.deepEqual(activities, {
    activity_existing: activity,
  });
  assert.deepEqual(idsByRegion, {
    region_gray_harbor: ["activity_existing"],
  });
});

test("region activity rules derive activity and source ids from source events", () => {
  const activities: Record<string, EpochRegionActivity> = {};
  const idsByRegion: Record<string, string[]> = {};

  addRegionActivityForEvent(activities, idsByRegion, { eventId: "event_market" }, {
    ...baseActivity,
    regionId: "region_gray_harbor",
  });

  assert.deepEqual(activities.event_market, {
    ...baseActivity,
    activityId: "event_market",
    regionId: "region_gray_harbor",
    sourceEventId: "event_market",
  });
  assert.deepEqual(idsByRegion.region_gray_harbor, ["event_market"]);
});

test("region activity rules fan out one source event across unique regions", () => {
  const activities: Record<string, EpochRegionActivity> = {};
  const idsByRegion: Record<string, string[]> = {};

  addRegionActivitiesForEventRegions(
    activities,
    idsByRegion,
    { eventId: "event_season" },
    ["region_gray_harbor", "region_gray_harbor", "region_salt_gate"],
    {
      kind: "season",
      agentId: "agent_alpha",
      title: "赛季推进",
      summary: "赛季贡献被记录。",
      occurredAt: "2026-07-07T01:00:00.000Z",
      sourceEventType: "season_contribution_recorded",
    },
  );

  assert.deepEqual(Object.keys(activities).sort(), [
    "event_season:region_gray_harbor",
    "event_season:region_salt_gate",
  ]);
  assert.deepEqual(idsByRegion, {
    region_gray_harbor: ["event_season:region_gray_harbor"],
    region_salt_gate: ["event_season:region_salt_gate"],
  });
});
