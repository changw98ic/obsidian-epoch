import assert from "node:assert/strict";
import test from "node:test";

import { eventFactory } from "../lib/epoch/eventFactory.ts";
import {
  downtimeClaimedPayload,
  downtimeDiaryEntry,
  downtimeRewardGrantPayload,
  downtimeSetPayload,
  downtimeTickLimit,
  downtimeTickResolvedPayload,
  normalizeDowntimeRegionId,
  planDowntimeClaimEvents,
  planDowntimeSetEvents,
  planDowntimeTickEvents,
  projectDowntimeState,
  projectDowntimeTickResult,
  selectDowntimeTickAgentIds,
} from "../lib/epoch/downtimeRules.ts";
import { createSequentialEpochIdFactory, type EpochServerReward } from "../lib/epoch/protocol.ts";

const rewards: readonly EpochServerReward[] = [{ resourceId: "focus", amount: 2, reason: "downtime_meditation" }];

test("downtime rules plan set payloads", () => {
  assert.deepEqual(downtimeSetPayload({
    mode: "travel",
    regionId: " region_salt_gate ",
    startedAt: "2026-07-07T03:00:00.000Z",
  }), {
    mode: "travel",
    regionId: "region_salt_gate",
    startedAt: "2026-07-07T03:00:00.000Z",
  });
});

test("downtime rules plan set event sequences and project state", () => {
  const startedAt = "2026-07-07T03:00:00.000Z";
  const idFactory = createSequentialEpochIdFactory("test");
  const makeEvent = eventFactory(() => new Date(startedAt), idFactory, {
    actorExplorerId: "explorer_1",
    trustClass: "user_verified_web",
  });
  const events = planDowntimeSetEvents({
    agentId: "agent_1",
    mode: "travel",
    regionId: " region_salt_gate ",
    startedAt,
    makeEvent,
  });

  assert.deepEqual(events.map((event) => event.eventType), ["downtime_set"]);
  const setEvent = events[0];
  assert.ok(setEvent);
  assert.equal(setEvent.aggregateId, "agent_1");
  assert.equal(setEvent.agentId, "agent_1");
  assert.equal(setEvent.eventType, "downtime_set");
  if (setEvent.eventType !== "downtime_set") throw new Error("expected_downtime_set_event");
  assert.equal(setEvent.payload.regionId, "region_salt_gate");
  const projected = { agentId: "agent_1", active: true };
  assert.deepEqual(projectDowntimeState({
    events,
    projection: {
      downtime: {
        agent_1: projected,
      },
    },
  }), projected);
});

test("downtime rules normalize regions and plan claim/tick payloads", () => {
  assert.equal(normalizeDowntimeRegionId(" 灰港 "), "灰港");
  assert.equal(normalizeDowntimeRegionId(""), "region_gray_harbor");

  assert.deepEqual(downtimeRewardGrantPayload({
    agentId: "agent_1",
    reward: { resourceId: "focus", amount: 2, reason: "downtime_meditation" },
    balanceBefore: 5,
  }), {
    resourceId: "focus",
    amount: 2,
    reason: "downtime_meditation",
    balanceAfter: 7,
    accountRef: "agent:agent_1",
    assetKey: "resource:focus",
    unit: "unit",
    quantityMinor: "200",
  });

  assert.deepEqual(downtimeClaimedPayload({
    mode: "meditation",
    regionId: " region_gray_harbor ",
    startedAt: "2026-07-05T00:00:00.000Z",
    claimedAt: "2026-07-05T00:10:00.000Z",
    maxDowntimeSeconds: 500,
  }), {
    mode: "meditation",
    regionId: "region_gray_harbor",
    startedAt: "2026-07-05T00:00:00.000Z",
    claimedAt: "2026-07-05T00:10:00.000Z",
    elapsedSeconds: 500,
    capped: true,
    rewards: [{ resourceId: "focus", amount: 1, reason: "downtime_meditation" }],
    diaryEntry: {
      title: "静心冥想",
      summary: "领取结算：在静室里整理心绪，持续8分钟，focus+1，已触达托管上限。",
    },
  });

  assert.deepEqual(downtimeTickResolvedPayload({
    mode: "training",
    regionId: "region_gray_harbor",
    startedAt: "2026-07-05T00:00:00.000Z",
    tickedAt: "2026-07-05T00:15:00.000Z",
    maxDowntimeSeconds: 3600,
  }), {
    mode: "training",
    regionId: "region_gray_harbor",
    startedAt: "2026-07-05T00:00:00.000Z",
    tickedAt: "2026-07-05T00:15:00.000Z",
    elapsedSeconds: 900,
    capped: false,
    rewards: [{ resourceId: "stamina", amount: 3, reason: "downtime_tick_training" }],
    diaryEntry: {
      title: "体能训练",
      summary: "服务器巡检：完成了一轮基础体能训练，持续15分钟，stamina+3。",
    },
  });
});

test("downtime rules plan claim and tick event sequences", () => {
  const idFactory = createSequentialEpochIdFactory("test");
  const claimedAt = "2026-07-07T04:00:00.000Z";
  const makeClaimEvent = eventFactory(() => new Date(claimedAt), idFactory, {
    actorExplorerId: "explorer_1",
    trustClass: "user_verified_web",
  });
  const claimEvents = planDowntimeClaimEvents({
    agentId: "agent_1",
    downtime: {
      mode: "meditation",
      regionId: "region_gray_harbor",
      startedAt: "2026-07-07T03:50:00.000Z",
    },
    claimedAt,
    maxDowntimeSeconds: 3600,
    balanceBefore: (plannedGrantEvents) => 5 + plannedGrantEvents.length,
    makeEvent: makeClaimEvent,
  });

  assert.deepEqual(claimEvents.map((event) => event.eventType), [
    "downtime_claimed",
    "resource_granted",
  ]);
  const claimGrant = claimEvents[1];
  assert.ok(claimGrant);
  assert.equal(claimGrant.eventType, "resource_granted");
  if (claimGrant.eventType !== "resource_granted") throw new Error("expected_claim_reward_event");
  assert.equal(claimGrant.payload.balanceAfter, 7);
  const claimedProjection = { agentId: "agent_1", active: false };
  assert.deepEqual(projectDowntimeState({
    events: claimEvents,
    projection: {
      downtime: {
        agent_1: claimedProjection,
      },
    },
  }), claimedProjection);

  const tickedAt = "2026-07-07T05:00:00.000Z";
  const makeTickEvent = eventFactory(() => new Date(tickedAt), idFactory, {
    actorExplorerId: "operator_1",
    trustClass: "system_worker",
  });
  const tickEvents = planDowntimeTickEvents({
    targets: [{
      agentId: "agent_2",
      downtime: {
        mode: "training",
        regionId: "region_gray_harbor",
        startedAt: "2026-07-07T04:45:00.000Z",
      },
    }],
    tickedAt,
    maxDowntimeSeconds: 3600,
    balanceBefore: (plannedGrantEvents) => 10 + plannedGrantEvents.length,
    makeEvent: makeTickEvent,
  });

  assert.deepEqual(tickEvents.map((event) => event.eventType), [
    "downtime_tick_resolved",
    "resource_granted",
  ]);
  const tickGrant = tickEvents[1];
  assert.ok(tickGrant);
  assert.equal(tickGrant.eventType, "resource_granted");
  if (tickGrant.eventType !== "resource_granted") throw new Error("expected_tick_reward_event");
  assert.equal(tickGrant.payload.balanceAfter, 13);
  assert.deepEqual(projectDowntimeTickResult({
    agentIds: ["agent_2"],
    tickedAt,
    projection: {
      downtime: {
        agent_2: {
          agentId: "agent_2",
          active: true,
        },
      },
    },
  }), {
    tickedAt,
    updated: [{
      agentId: "agent_2",
      active: true,
    }],
  });
});

test("downtime rules build canonical diary entries for claimed downtime", () => {
  const entry = downtimeDiaryEntry({
    diaryId: "event_1",
    agentId: "agent_1",
    mode: "meditation",
    regionId: "region_gray_harbor",
    phase: "claim",
    elapsedSeconds: 600,
    capped: false,
    rewards,
    occurredAt: "2026-07-05T14:18:00.000Z",
    sourceEventId: "event_1",
  });

  assert.deepEqual(entry, {
    diaryId: "event_1",
    agentId: "agent_1",
    mode: "meditation",
    regionId: "region_gray_harbor",
    phase: "claim",
    title: "静心冥想",
    summary: "领取结算：在静室里整理心绪，持续10分钟，focus+2。",
    elapsedSeconds: 600,
    capped: false,
    rewards,
    occurredAt: "2026-07-05T14:18:00.000Z",
    sourceEventId: "event_1",
    sourceEventType: "downtime_claimed",
  });
});

test("downtime rules preserve persisted diary copy for tick projection", () => {
  const entry = downtimeDiaryEntry({
    diaryId: "event_2",
    agentId: "agent_1",
    mode: "training",
    regionId: "region_gray_harbor",
    phase: "tick",
    elapsedSeconds: 900,
    capped: true,
    rewards: [{ resourceId: "stamina", amount: 3, reason: "downtime_tick_training" }],
    occurredAt: "2026-07-05T15:18:00.000Z",
    sourceEventId: "event_2",
    diaryEntry: {
      title: "训练巡检",
      summary: "服务器已经记录过的巡检文案。",
    },
  });

  assert.equal(entry.title, "训练巡检");
  assert.equal(entry.summary, "服务器已经记录过的巡检文案。");
  assert.equal(entry.sourceEventType, "downtime_tick_resolved");
});

test("downtime rules select tick target agent ids", () => {
  assert.equal(downtimeTickLimit(undefined), 25);
  assert.equal(downtimeTickLimit(0), 25);
  assert.equal(downtimeTickLimit(-5), 1);
  assert.equal(downtimeTickLimit(2.8), 2);
  assert.equal(downtimeTickLimit(200), 100);
  assert.deepEqual(
    selectDowntimeTickAgentIds({
      agent_c: { active: true },
      agent_a: { active: true },
      agent_b: { active: false },
    }, 2),
    ["agent_a", "agent_b"],
  );
});
