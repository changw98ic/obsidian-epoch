import assert from "node:assert/strict";
import test from "node:test";

import {
  RESOURCE_NODE_SPAWN_COOLDOWN_SECONDS,
  RESOURCE_NODE_STAMINA_SCORE,
  latestResourceNodeSettlementAt,
  openResourceNodeForRegion,
  planResourceNodeContestEvents,
  planResourceNodeSettlementEvents,
  planResourceNodeSpawnEvents,
  projectResourceNodeContest,
  projectResourceNodeSettlement,
  projectResourceNodeSpawn,
  requireOpenResourceNode,
  requireResourceNode,
  resourceNodeBaseScoreDelta,
  resourceNodeContestPayload,
  resourceNodeContestStaminaSpendPayload,
  resourceNodeEquipmentBonus,
  resourceNodeSettlementInfluencePayload,
  resourceNodeSettlementPayload,
  resourceNodeSettlementRewardGrantPayload,
  resourceNodeSettlementTracePayload,
  resourceNodeSpawnCooldownRemainingSeconds,
  resourceNodeSpawnedPayload,
} from "../lib/epoch/resourceNodeRules.ts";
import { eventFactory } from "../lib/epoch/eventFactory.ts";
import { createSequentialEpochIdFactory } from "../lib/epoch/protocol.ts";

test("resource node rules calculate stamina score from the shared multiplier", () => {
  assert.equal(RESOURCE_NODE_STAMINA_SCORE, 2);
  assert.equal(resourceNodeBaseScoreDelta(3), 6);
});

test("resource node rules report remaining spawn cooldown in seconds", () => {
  assert.equal(RESOURCE_NODE_SPAWN_COOLDOWN_SECONDS, 60 * 60);
  assert.equal(resourceNodeSpawnCooldownRemainingSeconds("2026-07-06T02:00:00.000Z", undefined), 0);
  assert.equal(
    resourceNodeSpawnCooldownRemainingSeconds("2026-07-06T01:30:00.000Z", "2026-07-06T01:00:00.000Z"),
    30 * 60,
  );
  assert.equal(
    resourceNodeSpawnCooldownRemainingSeconds("2026-07-06T02:30:00.000Z", "2026-07-06T01:00:00.000Z"),
    0,
  );
});

test("resource node rules read resource node projection state", () => {
  const projection = {
    resourceNodes: {
      node_closed_old: {
        status: "settled",
        settledAt: "2026-07-07T01:00:00.000Z",
        marker: "old",
      },
      node_open: {
        status: "open",
        marker: "open",
      },
      node_closed_new: {
        status: "settled",
        settledAt: "2026-07-07T03:00:00.000Z",
        marker: "new",
      },
    },
    resourceNodeIdsByRegion: {
      region_gray_harbor: ["node_closed_old", "missing", "node_open", "node_closed_new"],
      region_empty: [],
    },
  } as const;

  assert.equal(requireResourceNode(projection, "node_open").marker, "open");
  assert.equal(requireOpenResourceNode(projection, "node_open").marker, "open");
  assert.throws(() => requireResourceNode(projection, "missing"), /resource_node_not_found/);
  assert.throws(() => requireOpenResourceNode(projection, "node_closed_old"), /resource_node_not_open/);
  assert.equal(openResourceNodeForRegion(projection, "region_gray_harbor")?.marker, "open");
  assert.equal(openResourceNodeForRegion(projection, "region_empty"), undefined);
  assert.equal(latestResourceNodeSettlementAt(projection, "region_gray_harbor"), "2026-07-07T03:00:00.000Z");
  assert.equal(latestResourceNodeSettlementAt(projection, "region_empty"), undefined);
});

test("resource node rules count only unique bound equipment effects", () => {
  const bonus = resourceNodeEquipmentBonus({
    inventoryItemIdsByAgent: {
      agent_a: ["item_bound_field_1", "item_bound_field_2", "item_unbound_band", "item_bound_band"],
    },
    inventoryItems: {
      item_bound_field_1: {
        itemId: "item_bound_field_1",
        itemKey: "crafted:field-kit",
        bound: true,
      },
      item_bound_field_2: {
        itemId: "item_bound_field_2",
        itemKey: "crafted:field-kit",
        bound: true,
      },
      item_unbound_band: {
        itemId: "item_unbound_band",
        itemKey: "crafted:training-band",
        bound: false,
      },
      item_bound_band: {
        itemId: "item_bound_band",
        itemKey: "crafted:training-band",
        bound: true,
      },
    },
  }, "agent_a");

  assert.equal(bonus.equipmentScoreBonus, 3);
  assert.deepEqual(bonus.equipmentItemIds, ["item_bound_field_1", "item_bound_band"]);
});

test("resource node rules plan spawned payloads", () => {
  const reward = {
    resourceId: "aether" as const,
    amount: 2,
    reason: "resource_node_settlement",
  };

  assert.deepEqual(resourceNodeSpawnedPayload({
    nodeId: "node_1",
    regionId: "region_gray_harbor",
    title: "灰港灵质露点",
    description: "  ",
    resourceId: "aether",
    reward,
    spawnedAt: "2026-07-07T07:20:00.000Z",
  }), {
    nodeId: "node_1",
    regionId: "region_gray_harbor",
    title: "灰港灵质露点",
    description: "区域资源点",
    resourceId: "aether",
    reward,
    spawnedAt: "2026-07-07T07:20:00.000Z",
  });
});

test("resource node rules plan spawn event sequences", () => {
  const idFactory = createSequentialEpochIdFactory("resource_node_spawn");
  const spawnedAt = "2026-07-07T07:20:00.000Z";
  const reward = {
    resourceId: "aether" as const,
    amount: 2,
    reason: "resource_node_settlement",
  };
  const events = planResourceNodeSpawnEvents({
    nodeId: "node_1",
    regionId: "region_gray_harbor",
    title: "灰港灵质露点",
    description: "灰港钟塔下的灵质露点",
    resourceId: "aether",
    reward,
    spawnedAt,
    makeEvent: eventFactory(() => new Date(spawnedAt), idFactory, {
      actorExplorerId: "system",
      trustClass: "system_worker" as const,
      causationId: "resource_node_spawn",
      correlationId: "corr_resource_node_spawn",
    }),
  });

  assert.deepEqual(events.map((event) => event.eventType), ["resource_node_spawned"]);
  const spawned = events[0];
  assert.ok(spawned);
  assert.equal(spawned.eventType, "resource_node_spawned");
  if (spawned.eventType !== "resource_node_spawned") throw new Error("expected_resource_node_spawned_event");
  assert.equal(spawned.aggregateType, "resource_node");
  assert.equal(spawned.aggregateId, "node_1");
  assert.deepEqual(spawned.payload, {
    nodeId: "node_1",
    regionId: "region_gray_harbor",
    title: "灰港灵质露点",
    description: "灰港钟塔下的灵质露点",
    resourceId: "aether",
    reward,
    spawnedAt,
  });

  const projectedNode = {
    nodeId: "node_1",
    status: "open",
    marker: "spawned",
  } as const;
  assert.equal(projectResourceNodeSpawn({
    events,
    projection: {
      resourceNodes: {
        node_1: projectedNode,
      },
    },
  }), projectedNode);
  assert.throws(() => projectResourceNodeSpawn({
    events: [],
    projection: {
      resourceNodes: {
        node_1: projectedNode,
      },
    },
  }), /resource_node_spawned_event_missing/);
  assert.throws(() => projectResourceNodeSpawn({
    events,
    projection: {
      resourceNodes: {},
    },
  }), /resource_node_projection_failed/);
});

test("resource node rules plan contest payload scoring", () => {
  assert.deepEqual(resourceNodeContestStaminaSpendPayload({
    agentId: "agent_scout",
    nodeId: "node_1",
    staminaSpent: 2,
    staminaBalanceBefore: 9,
  }), {
    resourceId: "stamina",
    amount: 2,
    reason: "resource_node_contest:node_1",
    balanceAfter: 7,
    accountRef: "agent:agent_scout",
    assetKey: "resource:stamina",
    unit: "unit",
    quantityMinor: "200",
  });

  assert.deepEqual(resourceNodeContestPayload({
    nodeId: "node_1",
    agentId: "agent_scout",
    explorerId: "explorer_scout",
    staminaSpent: 2,
    previousScore: 5,
    totalScore: 9,
    equipmentScoreBonus: 3,
    equipmentItemIds: ["item_bound_field_1", "item_bound_band"],
    contestedAt: "2026-07-06T02:00:00.000Z",
  }), {
    nodeId: "node_1",
    agentId: "agent_scout",
    explorerId: "explorer_scout",
    staminaSpent: 2,
    baseScoreDelta: 4,
    equipmentScoreBonus: 3,
    equipmentItemIds: ["item_bound_field_1", "item_bound_band"],
    scoreDelta: 7,
    agentScoreAfter: 12,
    totalScoreAfter: 16,
    contestedAt: "2026-07-06T02:00:00.000Z",
  });
});

test("resource node rules plan contest event sequences", () => {
  const idFactory = createSequentialEpochIdFactory("resource_node_contest");
  const contestedAt = "2026-07-06T02:00:00.000Z";
  const events = planResourceNodeContestEvents({
    nodeId: "node_1",
    agentId: "agent_scout",
    explorerId: "explorer_scout",
    staminaSpent: 2,
    staminaBalanceBefore: 9,
    previousScore: 5,
    totalScore: 9,
    equipmentScoreBonus: 3,
    equipmentItemIds: ["item_bound_field_1", "item_bound_band"],
    contestedAt,
    makeEvent: eventFactory(() => new Date(contestedAt), idFactory, {
      actorExplorerId: "explorer_scout",
      trustClass: "user_verified_web" as const,
      causationId: "resource_node_contest",
      correlationId: "corr_resource_node_contest",
    }),
  });

  assert.deepEqual(events.map((event) => event.eventType), [
    "resource_spent",
    "resource_node_contested",
  ]);
  const spent = events[0];
  assert.ok(spent);
  assert.equal(spent.eventType, "resource_spent");
  if (spent.eventType !== "resource_spent") throw new Error("expected_resource_spent_event");
  assert.equal(spent.aggregateType, "resource_account");
  assert.equal(spent.aggregateId, "agent_scout");
  assert.equal(spent.agentId, "agent_scout");
  assert.deepEqual(spent.payload, {
    resourceId: "stamina",
    amount: 2,
    reason: "resource_node_contest:node_1",
    balanceAfter: 7,
    accountRef: "agent:agent_scout",
    assetKey: "resource:stamina",
    unit: "unit",
    quantityMinor: "200",
  });

  const contested = events[1];
  assert.ok(contested);
  assert.equal(contested.eventType, "resource_node_contested");
  if (contested.eventType !== "resource_node_contested") throw new Error("expected_resource_node_contested_event");
  assert.equal(contested.aggregateType, "resource_node");
  assert.equal(contested.aggregateId, "node_1");
  assert.equal(contested.agentId, "agent_scout");
  assert.deepEqual(contested.payload, {
    nodeId: "node_1",
    agentId: "agent_scout",
    explorerId: "explorer_scout",
    staminaSpent: 2,
    baseScoreDelta: 4,
    equipmentScoreBonus: 3,
    equipmentItemIds: ["item_bound_field_1", "item_bound_band"],
    scoreDelta: 7,
    agentScoreAfter: 12,
    totalScoreAfter: 16,
    contestedAt,
  });

  const projectedNode = {
    nodeId: "node_1",
    status: "open",
    marker: "contested",
  } as const;
  assert.equal(projectResourceNodeContest({
    events,
    projection: {
      resourceNodes: {
        node_1: projectedNode,
      },
    },
  }), projectedNode);
  assert.throws(() => projectResourceNodeContest({
    events: [spent],
    projection: {
      resourceNodes: {
        node_1: projectedNode,
      },
    },
  }), /resource_node_contested_event_missing/);
  assert.throws(() => projectResourceNodeContest({
    events,
    projection: {
      resourceNodes: {},
    },
  }), /resource_node_projection_failed/);
});

test("resource node rules plan settled payload with or without a winner", () => {
  const reward = {
    resourceId: "aether" as const,
    amount: 2,
    reason: "resource_node_settlement",
  };

  assert.deepEqual(resourceNodeSettlementRewardGrantPayload({
    agentId: "agent_scout",
    reward,
    winnerRewardBalanceBefore: 4,
  }), {
    resourceId: "aether",
    amount: 2,
    reason: "resource_node_settlement",
    balanceAfter: 6,
    accountRef: "agent:agent_scout",
    assetKey: "resource:aether",
    unit: "unit",
    quantityMinor: "200",
  });

  assert.deepEqual(resourceNodeSettlementPayload({
    nodeId: "node_1",
    settledAt: "2026-07-06T03:00:00.000Z",
    winner: {
      agentId: "agent_scout",
      explorerId: "explorer_scout",
      score: 12,
    },
    reward,
  }), {
    nodeId: "node_1",
    settledAt: "2026-07-06T03:00:00.000Z",
    winnerAgentId: "agent_scout",
    winnerExplorerId: "explorer_scout",
    winningScore: 12,
    reward,
  });

  assert.deepEqual(resourceNodeSettlementPayload({
    nodeId: "node_empty",
    settledAt: "2026-07-06T03:00:00.000Z",
    reward,
  }), {
    nodeId: "node_empty",
    settledAt: "2026-07-06T03:00:00.000Z",
    winnerAgentId: undefined,
    winnerExplorerId: undefined,
    winningScore: 0,
    reward: undefined,
  });
});

test("resource node rules plan settlement event sequences", () => {
  const idFactory = createSequentialEpochIdFactory("resource_node_settlement");
  const settledAt = "2026-07-06T03:00:00.000Z";
  const reward = {
    resourceId: "aether" as const,
    amount: 2,
    reason: "resource_node_settlement",
  };
  const winner = {
    agentId: "agent_scout",
    explorerId: "explorer_scout",
    score: 12,
  };
  const events = planResourceNodeSettlementEvents({
    nodeId: "node_1",
    regionId: "region_gray_harbor",
    nodeTitle: "灰港灵质露点",
    leaderboard: [
      winner,
      { agentId: "agent_rival", explorerId: "explorer_rival", score: 8 },
      { agentId: "agent_scout", explorerId: "explorer_scout", score: 3 },
    ],
    reward,
    settledAt,
    winnerRewardBalanceBefore: 4,
    winnerInfluenceScoreBefore: 5,
    parentTraceId: "trace_parent",
    idFactory,
    makeEvent: eventFactory(() => new Date(settledAt), idFactory, {
      actorExplorerId: "system",
      trustClass: "system_worker" as const,
      causationId: "resource_node_settlement",
      correlationId: "corr_resource_node_settlement",
    }),
  });

  assert.deepEqual(events.map((event) => event.eventType), [
    "resource_node_settled",
    "resource_granted",
    "region_influence_changed",
    "trace_created",
  ]);
  const settled = events[0];
  assert.ok(settled);
  assert.equal(settled.eventType, "resource_node_settled");
  if (settled.eventType !== "resource_node_settled") throw new Error("expected_resource_node_settled_event");
  assert.equal(settled.aggregateType, "resource_node");
  assert.deepEqual(settled.payload, {
    nodeId: "node_1",
    settledAt,
    winnerAgentId: "agent_scout",
    winnerExplorerId: "explorer_scout",
    winningScore: 12,
    reward,
  });

  const granted = events[1];
  assert.ok(granted);
  assert.equal(granted.eventType, "resource_granted");
  if (granted.eventType !== "resource_granted") throw new Error("expected_resource_granted_event");
  assert.equal(granted.aggregateType, "resource_account");
  assert.equal(granted.aggregateId, "agent_scout");
  assert.deepEqual(granted.payload, {
    resourceId: "aether",
    amount: 2,
    reason: "resource_node_settlement",
    balanceAfter: 6,
    accountRef: "agent:agent_scout",
    assetKey: "resource:aether",
    unit: "unit",
    quantityMinor: "200",
  });

  const influence = events[2];
  assert.ok(influence);
  assert.equal(influence.eventType, "region_influence_changed");
  if (influence.eventType !== "region_influence_changed") throw new Error("expected_region_influence_event");
  assert.equal(influence.aggregateType, "region");
  assert.equal(influence.aggregateId, "region_gray_harbor");
  assert.equal(influence.payload.sourceEventId, settled.eventId);
  assert.equal(influence.payload.influenceScoreAfter, 17);

  const trace = events[3];
  assert.ok(trace);
  assert.equal(trace.eventType, "trace_created");
  if (trace.eventType !== "trace_created") throw new Error("expected_trace_created_event");
  assert.equal(trace.aggregateType, "trace");
  assert.deepEqual(trace.payload.sourceEventIds, [settled.eventId, influence.eventId]);
  assert.deepEqual(trace.payload.participantAgentIds, ["agent_scout", "agent_rival"]);
  assert.equal(trace.payload.parentTraceId, "trace_parent");

  const projectedNode = {
    nodeId: "node_1",
    status: "settled",
    marker: "settled",
  } as const;
  assert.equal(projectResourceNodeSettlement({
    events,
    projection: {
      resourceNodes: {
        node_1: projectedNode,
      },
    },
  }), projectedNode);
  assert.throws(() => projectResourceNodeSettlement({
    events: events.slice(1),
    projection: {
      resourceNodes: {
        node_1: projectedNode,
      },
    },
  }), /resource_node_settled_event_missing/);
  assert.throws(() => projectResourceNodeSettlement({
    events,
    projection: {
      resourceNodes: {},
    },
  }), /resource_node_projection_failed/);

  const emptyEvents = planResourceNodeSettlementEvents({
    nodeId: "node_empty",
    regionId: "region_gray_harbor",
    nodeTitle: "无人露点",
    leaderboard: [],
    reward,
    settledAt,
    winnerRewardBalanceBefore: 0,
    winnerInfluenceScoreBefore: 0,
    idFactory,
    makeEvent: eventFactory(() => new Date(settledAt), idFactory, {
      actorExplorerId: "system",
      trustClass: "system_worker" as const,
    }),
  });
  assert.deepEqual(emptyEvents.map((event) => event.eventType), ["resource_node_settled"]);
  const emptySettled = emptyEvents[0];
  assert.ok(emptySettled);
  assert.equal(emptySettled.eventType, "resource_node_settled");
  if (emptySettled.eventType !== "resource_node_settled") {
    throw new Error("expected_empty_resource_node_settled_event");
  }
  assert.equal(emptySettled.payload.reward, undefined);
});

test("resource node rules plan settlement influence and trace payloads", () => {
  const winner = {
    agentId: "agent_scout",
    explorerId: "explorer_scout",
    score: 12,
  };

  assert.deepEqual(resourceNodeSettlementInfluencePayload({
    influenceId: "influence_1",
    regionId: "region_gray_harbor",
    nodeId: "node_1",
    winner,
    currentInfluenceScore: 5,
    sourceEventId: "event_settled",
    changedAt: "2026-07-06T03:00:00.000Z",
  }), {
    influenceId: "influence_1",
    regionId: "region_gray_harbor",
    agentId: "agent_scout",
    explorerId: "explorer_scout",
    influenceDelta: 12,
    influenceScoreAfter: 17,
    reason: "resource_node_settlement:node_1",
    sourceEventId: "event_settled",
    sourceEventType: "resource_node_settled",
    sourceAggregateId: "node_1",
    changedAt: "2026-07-06T03:00:00.000Z",
  });

  assert.deepEqual(resourceNodeSettlementTracePayload({
    traceId: "trace_1",
    regionId: "region_gray_harbor",
    nodeId: "node_1",
    nodeTitle: "灰港灵质露点",
    winner,
    leaderboard: [
      winner,
      { agentId: "agent_rival", explorerId: "explorer_rival", score: 8 },
      { agentId: "agent_scout", explorerId: "explorer_scout", score: 3 },
    ],
    settledEventId: "event_settled",
    influenceEventId: "event_influence",
    influenceId: "influence_1",
    parentTraceId: "trace_parent",
    createdAt: "2026-07-06T03:00:00.000Z",
  }), {
    traceId: "trace_1",
    regionId: "region_gray_harbor",
    title: "灰港灵质露点结算",
    summary: "agent_scout 在 灰港灵质露点 中以 12 分取得资源点。",
    sourceEventType: "resource_node_settled",
    sourceEventIds: ["event_settled", "event_influence"],
    sourceAggregateId: "node_1",
    relatedInfluenceIds: ["influence_1"],
    participantAgentIds: ["agent_scout", "agent_rival"],
    participantExplorerIds: ["explorer_scout", "explorer_rival"],
    parentTraceId: "trace_parent",
    createdAt: "2026-07-06T03:00:00.000Z",
  });
});
