import assert from "node:assert/strict";
import test from "node:test";

import {
  ANOMALY_FOCUS_SCORE,
  OBJECTIVE_SCORE_WEIGHT,
  anomalyEventContestFocusSpendPayload,
  anomalyEventContestPayload,
  anomalyEventResolutionInfluencePayload,
  anomalyEventResolutionOutcome,
  anomalyEventResolutionPayload,
  anomalyEventResolutionRewardGrantPayload,
  anomalyEventResolutionTracePayload,
  anomalyScoreDelta,
  anomalyEventSpawnedPayload,
  assertAnomalySeverity,
  contestedObjectiveContributionPayload,
  contestedObjectiveContributionSpendPayload,
  contestedObjectiveCreatedPayload,
  contestedObjectiveSettlementInfluencePayload,
  contestedObjectiveSettlementPayload,
  contestedObjectiveSettlementRewardGrantPayload,
  contestedObjectiveSettlementTracePayload,
  normalizeAnomalyMedia,
  normalizeAnomalyReward,
  normalizeObjectiveReward,
  objectiveScoreDelta,
  openAnomalyEventForRegion,
  planAnomalyEventSpawnEvents,
  planAnomalyEventContestEvents,
  planAnomalyEventResolutionEvents,
  planContestedObjectiveCreationEvents,
  planContestedObjectiveContributionEvents,
  planContestedObjectiveSettlementEvents,
  projectAnomalyEventSpawn,
  projectAnomalyEventContest,
  projectAnomalyEventResolution,
  projectContestedObjectiveCreation,
  projectContestedObjectiveContribution,
  projectContestedObjectiveSettlement,
  requireActiveObjective,
  requireAnomalyEvent,
  requireObjective,
  requireOpenAnomalyEvent,
} from "../lib/epoch/encounterRules.ts";
import { eventFactory } from "../lib/epoch/eventFactory.ts";
import { createSequentialEpochIdFactory } from "../lib/epoch/protocol.ts";

test("encounter rules normalize objective and anomaly rewards with scoped error labels", () => {
  assert.deepEqual(normalizeObjectiveReward({
    resourceId: "focus",
    amount: 2,
    reason: "objective_complete",
  }), {
    resourceId: "focus",
    amount: 2,
    reason: "objective_complete",
  });
  assert.deepEqual(normalizeAnomalyReward({
    resourceId: "aether",
    amount: 3,
    reason: "anomaly_resolved",
  }), {
    resourceId: "aether",
    amount: 3,
    reason: "anomaly_resolved",
  });

  assert.throws(() => normalizeObjectiveReward({
    resourceId: "focus",
    amount: 0,
    reason: "objective_complete",
  }), /objective_reward_amount/);
  assert.throws(() => normalizeAnomalyReward({
    resourceId: "aether",
    amount: 0,
    reason: "anomaly_resolved",
  }), /anomaly_reward_amount/);
});

test("encounter rules plan contested objective created payloads", () => {
  const reward = {
    resourceId: "legend" as const,
    amount: 1,
    reason: "objective_complete",
  };

  assert.deepEqual(contestedObjectiveCreatedPayload({
    objectiveId: "objective_1",
    regionId: "region_gray_harbor",
    title: "守住灰港钟楼",
    description: "  ",
    resourceId: "aether",
    targetScore: 12,
    mode: "contribution",
    reward,
    createdAt: "2026-07-07T07:00:00.000Z",
  }), {
    objectiveId: "objective_1",
    regionId: "region_gray_harbor",
    title: "守住灰港钟楼",
    description: "区域公共目标",
    resourceId: "aether",
    targetScore: 12,
    mode: "contribution",
    reward,
    createdAt: "2026-07-07T07:00:00.000Z",
  });
});

test("encounter rules plan contested objective creation event sequences", () => {
  const idFactory = createSequentialEpochIdFactory("objective_creation");
  const createdAt = "2026-07-07T07:00:00.000Z";
  const reward = {
    resourceId: "legend" as const,
    amount: 1,
    reason: "objective_complete",
  };
  const events = planContestedObjectiveCreationEvents({
    objectiveId: "objective_1",
    regionId: "region_gray_harbor",
    title: "守住灰港钟楼",
    description: "抵御夜潮",
    resourceId: "aether",
    targetScore: 12,
    mode: "contribution",
    reward,
    createdAt,
    makeEvent: eventFactory(() => new Date(createdAt), idFactory, {
      actorExplorerId: "system",
      trustClass: "system_worker" as const,
      causationId: "objective_created",
      correlationId: "corr_objective_created",
    }),
  });

  assert.deepEqual(events.map((event) => event.eventType), ["contested_objective_created"]);
  const created = events[0];
  assert.ok(created);
  assert.equal(created.eventType, "contested_objective_created");
  if (created.eventType !== "contested_objective_created") throw new Error("expected_objective_created_event");
  assert.equal(created.aggregateType, "objective");
  assert.equal(created.aggregateId, "objective_1");
  assert.deepEqual(created.payload, {
    objectiveId: "objective_1",
    regionId: "region_gray_harbor",
    title: "守住灰港钟楼",
    description: "抵御夜潮",
    resourceId: "aether",
    targetScore: 12,
    mode: "contribution",
    reward,
    createdAt,
  });

  const projectedObjective = {
    objectiveId: "objective_1",
    status: "active",
    marker: "created",
  } as const;
  assert.equal(projectContestedObjectiveCreation({
    events,
    projection: {
      contestedObjectives: {
        objective_1: projectedObjective,
      },
    },
  }), projectedObjective);
  assert.throws(() => projectContestedObjectiveCreation({
    events: [],
    projection: {
      contestedObjectives: {
        objective_1: projectedObjective,
      },
    },
  }), /contested_objective_created_event_missing/);
  assert.throws(() => projectContestedObjectiveCreation({
    events,
    projection: {
      contestedObjectives: {},
    },
  }), /objective_projection_failed/);
});

test("encounter rules calculate contested objective contribution payloads", () => {
  assert.equal(OBJECTIVE_SCORE_WEIGHT.aether, 4);
  assert.equal(objectiveScoreDelta("aether", 3), 12);
  assert.deepEqual(contestedObjectiveContributionSpendPayload({
    agentId: "agent_alpha",
    objectiveId: "objective_1",
    resourceId: "aether",
    amount: 3,
    balanceBefore: 8,
  }), {
    resourceId: "aether",
    amount: 3,
    reason: "objective_contribution:objective_1",
    balanceAfter: 5,
    accountRef: "agent:agent_alpha",
    assetKey: "resource:aether",
    unit: "unit",
    quantityMinor: "300",
  });

  assert.deepEqual(contestedObjectiveContributionPayload({
    objectiveId: "objective_1",
    agentId: "agent_alpha",
    explorerId: "explorer_alpha",
    resourceId: "aether",
    amount: 3,
    previousScore: 5,
    totalScore: 11,
  }), {
    objectiveId: "objective_1",
    agentId: "agent_alpha",
    explorerId: "explorer_alpha",
    resourceId: "aether",
    amount: 3,
    scoreDelta: 12,
    agentScoreAfter: 17,
    totalScoreAfter: 23,
  });
});

test("encounter rules plan contested objective contribution event sequences", () => {
  const idFactory = createSequentialEpochIdFactory("objective_contribution");
  const contributedAt = "2026-07-07T07:05:00.000Z";
  const events = planContestedObjectiveContributionEvents({
    objectiveId: "objective_1",
    agentId: "agent_alpha",
    explorerId: "explorer_alpha",
    resourceId: "aether",
    amount: 3,
    previousScore: 5,
    totalScore: 11,
    balanceBefore: 8,
    makeEvent: eventFactory(() => new Date(contributedAt), idFactory, {
      actorExplorerId: "explorer_alpha",
      trustClass: "user_verified_web" as const,
      causationId: "objective_contribution",
      correlationId: "corr_objective_contribution",
    }),
  });

  assert.deepEqual(events.map((event) => event.eventType), [
    "resource_spent",
    "contested_objective_contributed",
  ]);
  const spent = events[0];
  assert.ok(spent);
  assert.equal(spent.eventType, "resource_spent");
  if (spent.eventType !== "resource_spent") throw new Error("expected_resource_spent_event");
  assert.equal(spent.aggregateType, "resource_account");
  assert.equal(spent.aggregateId, "agent_alpha");
  assert.equal(spent.agentId, "agent_alpha");
  assert.deepEqual(spent.payload, {
    resourceId: "aether",
    amount: 3,
    reason: "objective_contribution:objective_1",
    balanceAfter: 5,
    accountRef: "agent:agent_alpha",
    assetKey: "resource:aether",
    unit: "unit",
    quantityMinor: "300",
  });

  const contributed = events[1];
  assert.ok(contributed);
  assert.equal(contributed.eventType, "contested_objective_contributed");
  if (contributed.eventType !== "contested_objective_contributed") {
    throw new Error("expected_objective_contributed_event");
  }
  assert.equal(contributed.aggregateType, "objective");
  assert.equal(contributed.aggregateId, "objective_1");
  assert.equal(contributed.agentId, "agent_alpha");
  assert.deepEqual(contributed.payload, {
    objectiveId: "objective_1",
    agentId: "agent_alpha",
    explorerId: "explorer_alpha",
    resourceId: "aether",
    amount: 3,
    scoreDelta: 12,
    agentScoreAfter: 17,
    totalScoreAfter: 23,
  });

  const projectedObjective = {
    objectiveId: "objective_1",
    status: "active",
    marker: "contributed",
  } as const;
  assert.equal(projectContestedObjectiveContribution({
    events,
    projection: {
      contestedObjectives: {
        objective_1: projectedObjective,
      },
    },
  }), projectedObjective);
  assert.throws(() => projectContestedObjectiveContribution({
    events: [spent],
    projection: {
      contestedObjectives: {
        objective_1: projectedObjective,
      },
    },
  }), /contested_objective_contributed_event_missing/);
  assert.throws(() => projectContestedObjectiveContribution({
    events,
    projection: {
      contestedObjectives: {},
    },
  }), /objective_projection_failed/);
});

test("encounter rules read contested objective projection state", () => {
  const projection = {
    contestedObjectives: {
      objective_active: { status: "active", marker: "active" },
      objective_settled: { status: "settled", marker: "settled" },
    },
  };

  assert.equal(requireObjective(projection, "objective_active").marker, "active");
  assert.equal(requireActiveObjective(projection, "objective_active").marker, "active");
  assert.throws(() => requireObjective(projection, "missing"), /contested_objective_not_found/);
  assert.throws(() => requireActiveObjective(projection, "objective_settled"), /contested_objective_settled/);
});

test("encounter rules plan contested objective settlement payloads", () => {
  const reward = {
    resourceId: "legend" as const,
    amount: 1,
    reason: "objective_complete",
  };

  assert.deepEqual(contestedObjectiveSettlementRewardGrantPayload({
    agentId: "agent_alpha",
    reward,
    winnerRewardBalanceBefore: 6,
  }), {
    resourceId: "legend",
    amount: 1,
    reason: "objective_complete",
    balanceAfter: 7,
    accountRef: "agent:agent_alpha",
    assetKey: "resource:legend",
    unit: "unit",
    quantityMinor: "100",
  });

  assert.deepEqual(contestedObjectiveSettlementPayload({
    objectiveId: "objective_1",
    settledAt: "2026-07-06T04:00:00.000Z",
    winner: {
      agentId: "agent_alpha",
      explorerId: "explorer_alpha",
      score: 17,
    },
    reward,
  }), {
    objectiveId: "objective_1",
    settledAt: "2026-07-06T04:00:00.000Z",
    winnerAgentId: "agent_alpha",
    winnerExplorerId: "explorer_alpha",
    winningScore: 17,
    reward,
  });

  assert.deepEqual(contestedObjectiveSettlementPayload({
    objectiveId: "objective_empty",
    settledAt: "2026-07-06T04:00:00.000Z",
    reward,
  }), {
    objectiveId: "objective_empty",
    settledAt: "2026-07-06T04:00:00.000Z",
    winnerAgentId: undefined,
    winnerExplorerId: undefined,
    winningScore: 0,
    reward: undefined,
  });
});

test("encounter rules plan contested objective influence and trace payloads", () => {
  const winner = {
    agentId: "agent_alpha",
    explorerId: "explorer_alpha",
    score: 17,
  };

  assert.deepEqual(contestedObjectiveSettlementInfluencePayload({
    influenceId: "influence_1",
    regionId: "region_gray_harbor",
    objectiveId: "objective_1",
    winner,
    currentInfluenceScore: 8,
    sourceEventId: "event_settled",
    changedAt: "2026-07-06T04:00:00.000Z",
  }), {
    influenceId: "influence_1",
    regionId: "region_gray_harbor",
    agentId: "agent_alpha",
    explorerId: "explorer_alpha",
    influenceDelta: 17,
    influenceScoreAfter: 25,
    reason: "objective_settlement:objective_1",
    sourceEventId: "event_settled",
    sourceEventType: "contested_objective_settled",
    sourceAggregateId: "objective_1",
    changedAt: "2026-07-06T04:00:00.000Z",
  });

  assert.deepEqual(contestedObjectiveSettlementTracePayload({
    traceId: "trace_1",
    regionId: "region_gray_harbor",
    objectiveId: "objective_1",
    objectiveTitle: "守住灰港钟楼",
    winner,
    leaderboard: [
      winner,
      { agentId: "agent_beta", explorerId: "explorer_beta", score: 9 },
      { agentId: "agent_alpha", explorerId: "explorer_alpha", score: 5 },
    ],
    settledEventId: "event_settled",
    influenceEventId: "event_influence",
    influenceId: "influence_1",
    parentTraceId: "trace_parent",
    createdAt: "2026-07-06T04:00:00.000Z",
  }), {
    traceId: "trace_1",
    regionId: "region_gray_harbor",
    title: "守住灰港钟楼结算",
    summary: "agent_alpha 在 守住灰港钟楼 中以 17 分胜出。",
    sourceEventType: "contested_objective_settled",
    sourceEventIds: ["event_settled", "event_influence"],
    sourceAggregateId: "objective_1",
    relatedInfluenceIds: ["influence_1"],
    participantAgentIds: ["agent_alpha", "agent_beta"],
    participantExplorerIds: ["explorer_alpha", "explorer_beta"],
    parentTraceId: "trace_parent",
    createdAt: "2026-07-06T04:00:00.000Z",
  });
});

test("encounter rules plan contested objective settlement event sequences", () => {
  const idFactory = createSequentialEpochIdFactory("objective_settlement");
  const settledAt = "2026-07-06T04:00:00.000Z";
  const reward = {
    resourceId: "legend" as const,
    amount: 1,
    reason: "objective_complete",
  };
  const winner = {
    agentId: "agent_alpha",
    explorerId: "explorer_alpha",
    score: 17,
  };
  const events = planContestedObjectiveSettlementEvents({
    objectiveId: "objective_1",
    regionId: "region_gray_harbor",
    objectiveTitle: "守住灰港钟楼",
    leaderboard: [
      winner,
      { agentId: "agent_beta", explorerId: "explorer_beta", score: 9 },
      { agentId: "agent_alpha", explorerId: "explorer_alpha", score: 5 },
    ],
    reward,
    settledAt,
    winnerRewardBalanceBefore: 6,
    winnerInfluenceScoreBefore: 8,
    parentTraceId: "trace_parent",
    idFactory,
    makeEvent: eventFactory(() => new Date(settledAt), idFactory, {
      actorExplorerId: "system",
      trustClass: "system_worker" as const,
      causationId: "objective_settlement",
      correlationId: "corr_objective_settlement",
    }),
  });

  assert.deepEqual(events.map((event) => event.eventType), [
    "contested_objective_settled",
    "resource_granted",
    "region_influence_changed",
    "trace_created",
  ]);
  const settled = events[0];
  assert.ok(settled);
  assert.equal(settled.eventType, "contested_objective_settled");
  if (settled.eventType !== "contested_objective_settled") throw new Error("expected_objective_settled_event");
  assert.equal(settled.aggregateType, "objective");
  assert.deepEqual(settled.payload, {
    objectiveId: "objective_1",
    settledAt,
    winnerAgentId: "agent_alpha",
    winnerExplorerId: "explorer_alpha",
    winningScore: 17,
    reward,
  });

  const granted = events[1];
  assert.ok(granted);
  assert.equal(granted.eventType, "resource_granted");
  if (granted.eventType !== "resource_granted") throw new Error("expected_resource_granted_event");
  assert.equal(granted.aggregateType, "resource_account");
  assert.equal(granted.aggregateId, "agent_alpha");
  assert.deepEqual(granted.payload, {
    resourceId: "legend",
    amount: 1,
    reason: "objective_complete",
    balanceAfter: 7,
    accountRef: "agent:agent_alpha",
    assetKey: "resource:legend",
    unit: "unit",
    quantityMinor: "100",
  });

  const influence = events[2];
  assert.ok(influence);
  assert.equal(influence.eventType, "region_influence_changed");
  if (influence.eventType !== "region_influence_changed") throw new Error("expected_region_influence_event");
  assert.equal(influence.aggregateType, "region");
  assert.equal(influence.aggregateId, "region_gray_harbor");
  assert.equal(influence.payload.sourceEventId, settled.eventId);
  assert.equal(influence.payload.influenceScoreAfter, 25);

  const trace = events[3];
  assert.ok(trace);
  assert.equal(trace.eventType, "trace_created");
  if (trace.eventType !== "trace_created") throw new Error("expected_trace_created_event");
  assert.equal(trace.aggregateType, "trace");
  assert.deepEqual(trace.payload.sourceEventIds, [settled.eventId, influence.eventId]);
  assert.deepEqual(trace.payload.participantAgentIds, ["agent_alpha", "agent_beta"]);
  assert.equal(trace.payload.parentTraceId, "trace_parent");

  const projectedObjective = {
    objectiveId: "objective_1",
    status: "settled",
    marker: "settled",
  } as const;
  assert.equal(projectContestedObjectiveSettlement({
    events,
    projection: {
      contestedObjectives: {
        objective_1: projectedObjective,
      },
    },
  }), projectedObjective);
  assert.throws(() => projectContestedObjectiveSettlement({
    events: events.slice(1),
    projection: {
      contestedObjectives: {
        objective_1: projectedObjective,
      },
    },
  }), /contested_objective_settled_event_missing/);
  assert.throws(() => projectContestedObjectiveSettlement({
    events,
    projection: {
      contestedObjectives: {},
    },
  }), /objective_projection_failed/);

  const emptyEvents = planContestedObjectiveSettlementEvents({
    objectiveId: "objective_empty",
    regionId: "region_gray_harbor",
    objectiveTitle: "无人目标",
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
  assert.deepEqual(emptyEvents.map((event) => event.eventType), ["contested_objective_settled"]);
  const emptySettled = emptyEvents[0];
  assert.ok(emptySettled);
  assert.equal(emptySettled.eventType, "contested_objective_settled");
  if (emptySettled.eventType !== "contested_objective_settled") {
    throw new Error("expected_empty_objective_settled_event");
  }
  assert.equal(emptySettled.payload.reward, undefined);
});

test("encounter rules accept only known anomaly severities", () => {
  assert.equal(assertAnomalySeverity("minor"), "minor");
  assert.equal(assertAnomalySeverity("major"), "major");
  assert.equal(assertAnomalySeverity("cataclysm"), "cataclysm");
  assert.throws(() => assertAnomalySeverity("legendary"), /invalid_anomaly_severity/);
});

test("encounter rules calculate anomaly focus contest score", () => {
  assert.equal(ANOMALY_FOCUS_SCORE, 3);
  assert.equal(anomalyScoreDelta(4), 12);
});

test("encounter rules read anomaly projection state", () => {
  const projection = {
    anomalyEvents: {
      anomaly_open: { status: "open", marker: "open" },
      anomaly_resolved: { status: "resolved", marker: "resolved" },
    },
    anomalyEventIdsByRegion: {
      region_gray_harbor: ["anomaly_resolved", "anomaly_open"],
      region_empty: [],
    },
  };

  assert.equal(requireAnomalyEvent(projection, "anomaly_open").marker, "open");
  assert.equal(requireOpenAnomalyEvent(projection, "anomaly_open").marker, "open");
  assert.throws(() => requireAnomalyEvent(projection, "missing"), /anomaly_event_not_found/);
  assert.throws(() => requireOpenAnomalyEvent(projection, "anomaly_resolved"), /anomaly_event_not_open/);
  assert.equal(openAnomalyEventForRegion(projection, "region_gray_harbor")?.marker, "open");
  assert.equal(openAnomalyEventForRegion(projection, "region_empty"), undefined);
});

test("encounter rules plan anomaly spawned payloads", () => {
  const reward = {
    resourceId: "aether" as const,
    amount: 2,
    reason: "anomaly_contained",
  };
  const media = {
    variantLabel: "黑曜裂隙",
    scenePrompt: "灰港灯塔下的黑曜裂隙",
    palette: ["#101820", "#d9a441", "#52d6ff"],
    accentColor: "#d9a441",
    dangerColor: "#ff5252",
    sigil: "裂",
    publicAlt: "黑曜裂隙在灰港灯塔下张开",
  };

  assert.deepEqual(anomalyEventSpawnedPayload({
    anomalyId: "anomaly_1",
    regionId: "region_gray_harbor",
    sourceSeasonId: "season_1",
    title: "灰港低阶裂隙",
    description: "  ",
    media,
    severity: "major",
    targetScore: 9,
    reward,
    lifetimeRisk: 2,
    spawnedAt: "2026-07-07T07:10:00.000Z",
  }), {
    anomalyId: "anomaly_1",
    regionId: "region_gray_harbor",
    sourceSeasonId: "season_1",
    title: "灰港低阶裂隙",
    description: "区域异常链",
    media,
    severity: "major",
    targetScore: 9,
    reward,
    lifetimeRisk: 2,
    spawnedAt: "2026-07-07T07:10:00.000Z",
  });

  assert.equal(anomalyEventSpawnedPayload({
    anomalyId: "anomaly_2",
    regionId: "region_gray_harbor",
    title: "无媒体异常",
    severity: "minor",
    targetScore: 4,
    reward,
    lifetimeRisk: 1,
    spawnedAt: "2026-07-07T07:11:00.000Z",
  }).media, undefined);
});

test("encounter rules plan anomaly spawn event sequences", () => {
  const idFactory = createSequentialEpochIdFactory("anomaly_spawn");
  const spawnedAt = "2026-07-07T07:10:00.000Z";
  const reward = {
    resourceId: "aether" as const,
    amount: 2,
    reason: "anomaly_contained",
  };
  const media = {
    variantLabel: "黑曜裂隙",
    scenePrompt: "灰港灯塔下的黑曜裂隙",
    palette: ["#101820", "#d9a441", "#52d6ff"],
    accentColor: "#d9a441",
    dangerColor: "#ff5252",
    sigil: "裂",
    publicAlt: "黑曜裂隙在灰港灯塔下张开",
  };
  const events = planAnomalyEventSpawnEvents({
    anomalyId: "anomaly_1",
    regionId: "region_gray_harbor",
    sourceSeasonId: "season_1",
    title: "灰港低阶裂隙",
    description: "抵御裂隙外溢",
    media,
    severity: "major",
    targetScore: 9,
    reward,
    lifetimeRisk: 2,
    spawnedAt,
    makeEvent: eventFactory(() => new Date(spawnedAt), idFactory, {
      actorExplorerId: "server",
      trustClass: "system_worker" as const,
      causationId: "anomaly_spawn",
      correlationId: "corr_anomaly_spawn",
    }),
  });

  assert.deepEqual(events.map((event) => event.eventType), ["anomaly_event_spawned"]);
  const spawned = events[0];
  assert.ok(spawned);
  assert.equal(spawned.eventType, "anomaly_event_spawned");
  if (spawned.eventType !== "anomaly_event_spawned") {
    throw new Error("expected_anomaly_event_spawned_event");
  }
  assert.equal(spawned.aggregateType, "anomaly_event");
  assert.equal(spawned.aggregateId, "anomaly_1");
  assert.deepEqual(spawned.payload, {
    anomalyId: "anomaly_1",
    regionId: "region_gray_harbor",
    sourceSeasonId: "season_1",
    title: "灰港低阶裂隙",
    description: "抵御裂隙外溢",
    media,
    severity: "major",
    targetScore: 9,
    reward,
    lifetimeRisk: 2,
    spawnedAt,
  });

  const projectedAnomaly = {
    anomalyId: "anomaly_1",
    status: "open",
    marker: "spawned",
  } as const;
  assert.equal(projectAnomalyEventSpawn({
    events,
    projection: {
      anomalyEvents: {
        anomaly_1: projectedAnomaly,
      },
    },
  }), projectedAnomaly);
  assert.throws(() => projectAnomalyEventSpawn({
    events: [],
    projection: {
      anomalyEvents: {
        anomaly_1: projectedAnomaly,
      },
    },
  }), /anomaly_event_spawned_event_missing/);
  assert.throws(() => projectAnomalyEventSpawn({
    events,
    projection: {
      anomalyEvents: {},
    },
  }), /anomaly_projection_failed/);
});

test("encounter rules plan anomaly contest payloads", () => {
  assert.deepEqual(anomalyEventContestFocusSpendPayload({
    agentId: "agent_seer",
    anomalyId: "anomaly_1",
    focusSpent: 2,
    focusBalanceBefore: 7,
  }), {
    resourceId: "focus",
    amount: 2,
    reason: "anomaly_event_contest:anomaly_1",
    balanceAfter: 5,
    accountRef: "agent:agent_seer",
    assetKey: "resource:focus",
    unit: "unit",
    quantityMinor: "200",
  });

  assert.deepEqual(anomalyEventContestPayload({
    anomalyId: "anomaly_1",
    agentId: "agent_seer",
    explorerId: "explorer_seer",
    focusSpent: 2,
    previousScore: 3,
    totalScore: 8,
    contestedAt: "2026-07-06T05:00:00.000Z",
  }), {
    anomalyId: "anomaly_1",
    agentId: "agent_seer",
    explorerId: "explorer_seer",
    focusSpent: 2,
    scoreDelta: 6,
    agentScoreAfter: 9,
    totalScoreAfter: 14,
    contestedAt: "2026-07-06T05:00:00.000Z",
  });
});

test("encounter rules plan anomaly contest event sequences", () => {
  const idFactory = createSequentialEpochIdFactory("anomaly_contest");
  const contestedAt = "2026-07-06T05:00:00.000Z";
  const events = planAnomalyEventContestEvents({
    anomalyId: "anomaly_1",
    agentId: "agent_seer",
    explorerId: "explorer_seer",
    focusSpent: 2,
    focusBalanceBefore: 7,
    previousScore: 3,
    totalScore: 8,
    contestedAt,
    makeEvent: eventFactory(() => new Date(contestedAt), idFactory, {
      actorExplorerId: "explorer_seer",
      trustClass: "user_verified_web" as const,
      causationId: "anomaly_contest",
      correlationId: "corr_anomaly_contest",
    }),
  });

  assert.deepEqual(events.map((event) => event.eventType), [
    "resource_spent",
    "anomaly_event_contested",
  ]);
  const spent = events[0];
  assert.ok(spent);
  assert.equal(spent.eventType, "resource_spent");
  if (spent.eventType !== "resource_spent") throw new Error("expected_resource_spent_event");
  assert.equal(spent.aggregateType, "resource_account");
  assert.equal(spent.aggregateId, "agent_seer");
  assert.equal(spent.agentId, "agent_seer");
  assert.deepEqual(spent.payload, {
    resourceId: "focus",
    amount: 2,
    reason: "anomaly_event_contest:anomaly_1",
    balanceAfter: 5,
    accountRef: "agent:agent_seer",
    assetKey: "resource:focus",
    unit: "unit",
    quantityMinor: "200",
  });

  const contested = events[1];
  assert.ok(contested);
  assert.equal(contested.eventType, "anomaly_event_contested");
  if (contested.eventType !== "anomaly_event_contested") {
    throw new Error("expected_anomaly_event_contested_event");
  }
  assert.equal(contested.aggregateType, "anomaly_event");
  assert.equal(contested.aggregateId, "anomaly_1");
  assert.equal(contested.agentId, "agent_seer");
  assert.deepEqual(contested.payload, {
    anomalyId: "anomaly_1",
    agentId: "agent_seer",
    explorerId: "explorer_seer",
    focusSpent: 2,
    scoreDelta: 6,
    agentScoreAfter: 9,
    totalScoreAfter: 14,
    contestedAt,
  });

  const projectedAnomaly = {
    anomalyId: "anomaly_1",
    status: "open",
    marker: "contested",
  } as const;
  assert.equal(projectAnomalyEventContest({
    events,
    projection: {
      anomalyEvents: {
        anomaly_1: projectedAnomaly,
      },
    },
  }), projectedAnomaly);
  assert.throws(() => projectAnomalyEventContest({
    events: [spent],
    projection: {
      anomalyEvents: {
        anomaly_1: projectedAnomaly,
      },
    },
  }), /anomaly_event_contested_event_missing/);
  assert.throws(() => projectAnomalyEventContest({
    events,
    projection: {
      anomalyEvents: {},
    },
  }), /anomaly_projection_failed/);
});

test("encounter rules plan anomaly resolution payloads", () => {
  const winner = {
    agentId: "agent_seer",
    explorerId: "explorer_seer",
    score: 9,
  };
  const reward = {
    resourceId: "aether" as const,
    amount: 2,
    reason: "anomaly_contained",
  };

  assert.deepEqual(anomalyEventResolutionRewardGrantPayload({
    agentId: "agent_seer",
    reward,
    winnerRewardBalanceBefore: 4,
  }), {
    resourceId: "aether",
    amount: 2,
    reason: "anomaly_contained",
    balanceAfter: 6,
    accountRef: "agent:agent_seer",
    assetKey: "resource:aether",
    unit: "unit",
    quantityMinor: "200",
  });

  assert.equal(anomalyEventResolutionOutcome({
    winner,
    totalScore: 9,
    targetScore: 6,
  }), "contained");
  assert.equal(anomalyEventResolutionOutcome({
    winner,
    totalScore: 5,
    targetScore: 6,
  }), "escaped");

  assert.deepEqual(anomalyEventResolutionPayload({
    anomalyId: "anomaly_1",
    resolvedAt: "2026-07-06T06:00:00.000Z",
    winner,
    totalScore: 9,
    targetScore: 6,
    reward,
    lifetimeRisk: 1,
  }), {
    anomalyId: "anomaly_1",
    resolvedAt: "2026-07-06T06:00:00.000Z",
    outcome: "contained",
    winnerAgentId: "agent_seer",
    winnerExplorerId: "explorer_seer",
    winningScore: 9,
    reward,
    lifetimeRisk: 1,
  });

  assert.deepEqual(anomalyEventResolutionPayload({
    anomalyId: "anomaly_escape",
    resolvedAt: "2026-07-06T06:00:00.000Z",
    winner,
    totalScore: 5,
    targetScore: 6,
    reward,
    lifetimeRisk: 2,
  }), {
    anomalyId: "anomaly_escape",
    resolvedAt: "2026-07-06T06:00:00.000Z",
    outcome: "escaped",
    winnerAgentId: undefined,
    winnerExplorerId: undefined,
    winningScore: 9,
    reward: undefined,
    lifetimeRisk: 2,
  });
});

test("encounter rules plan anomaly resolution influence and trace payloads", () => {
  const winner = {
    agentId: "agent_seer",
    explorerId: "explorer_seer",
    score: 9,
  };

  assert.deepEqual(anomalyEventResolutionInfluencePayload({
    influenceId: "influence_1",
    regionId: "region_gray_harbor",
    anomalyId: "anomaly_1",
    winner,
    currentInfluenceScore: 4,
    sourceEventId: "event_resolved",
    changedAt: "2026-07-06T06:00:00.000Z",
  }), {
    influenceId: "influence_1",
    regionId: "region_gray_harbor",
    agentId: "agent_seer",
    explorerId: "explorer_seer",
    influenceDelta: 9,
    influenceScoreAfter: 13,
    reason: "anomaly_event_resolution:anomaly_1",
    sourceEventId: "event_resolved",
    sourceEventType: "anomaly_event_resolved",
    sourceAggregateId: "anomaly_1",
    changedAt: "2026-07-06T06:00:00.000Z",
  });

  assert.deepEqual(anomalyEventResolutionTracePayload({
    traceId: "trace_1",
    regionId: "region_gray_harbor",
    anomalyId: "anomaly_1",
    anomalyTitle: "灰港低阶裂隙",
    winner,
    leaderboard: [
      winner,
      { agentId: "agent_rival", explorerId: "explorer_rival", score: 3 },
      { agentId: "agent_seer", explorerId: "explorer_seer", score: 1 },
    ],
    resolvedEventId: "event_resolved",
    influenceEventId: "event_influence",
    influenceId: "influence_1",
    parentTraceId: "trace_parent",
    createdAt: "2026-07-06T06:00:00.000Z",
  }), {
    traceId: "trace_1",
    regionId: "region_gray_harbor",
    title: "灰港低阶裂隙结算",
    summary: "agent_seer 在 灰港低阶裂隙 中以 9 分完成异常压制。",
    sourceEventType: "anomaly_event_resolved",
    sourceEventIds: ["event_resolved", "event_influence"],
    sourceAggregateId: "anomaly_1",
    relatedInfluenceIds: ["influence_1"],
    participantAgentIds: ["agent_seer", "agent_rival"],
    participantExplorerIds: ["explorer_seer", "explorer_rival"],
    parentTraceId: "trace_parent",
    createdAt: "2026-07-06T06:00:00.000Z",
  });
});

test("encounter rules plan anomaly resolution event sequences", () => {
  const idFactory = createSequentialEpochIdFactory("anomaly_resolution");
  const resolvedAt = "2026-07-06T06:00:00.000Z";
  const winner = {
    agentId: "agent_seer",
    explorerId: "explorer_seer",
    score: 9,
  };
  const reward = {
    resourceId: "aether" as const,
    amount: 2,
    reason: "anomaly_contained",
  };
  const sideEffectCheckpoints: string[][] = [];
  const events = planAnomalyEventResolutionEvents({
    anomalyId: "anomaly_1",
    regionId: "region_gray_harbor",
    anomalyTitle: "灰港低阶裂隙",
    leaderboard: [
      winner,
      { agentId: "agent_rival", explorerId: "explorer_rival", score: 3 },
      { agentId: "agent_seer", explorerId: "explorer_seer", score: 1 },
    ],
    totalScore: 9,
    targetScore: 6,
    reward,
    lifetimeRisk: 1,
    resolvedAt,
    winnerRewardBalanceBefore: 4,
    winnerInfluenceScoreBefore: 4,
    parentTraceId: "trace_parent",
    idFactory,
    makeEvent: eventFactory(() => new Date(resolvedAt), idFactory, {
      actorExplorerId: "system",
      trustClass: "system_worker" as const,
      causationId: "anomaly_resolution",
      correlationId: "corr_anomaly_resolution",
    }),
    planWinnerSideEffects: ({ eventsSoFar }) => {
      sideEffectCheckpoints.push(eventsSoFar.map((event) => event.eventType));
      return [];
    },
  });

  assert.deepEqual(events.map((event) => event.eventType), [
    "anomaly_event_resolved",
    "resource_granted",
    "region_influence_changed",
    "trace_created",
  ]);
  assert.deepEqual(sideEffectCheckpoints, [[
    "anomaly_event_resolved",
    "resource_granted",
  ]]);
  const resolved = events[0];
  assert.ok(resolved);
  assert.equal(resolved.eventType, "anomaly_event_resolved");
  if (resolved.eventType !== "anomaly_event_resolved") throw new Error("expected_anomaly_resolved_event");
  assert.equal(resolved.aggregateType, "anomaly_event");
  assert.deepEqual(resolved.payload, {
    anomalyId: "anomaly_1",
    resolvedAt,
    outcome: "contained",
    winnerAgentId: "agent_seer",
    winnerExplorerId: "explorer_seer",
    winningScore: 9,
    reward,
    lifetimeRisk: 1,
  });

  const granted = events[1];
  assert.ok(granted);
  assert.equal(granted.eventType, "resource_granted");
  if (granted.eventType !== "resource_granted") throw new Error("expected_resource_granted_event");
  assert.equal(granted.aggregateType, "resource_account");
  assert.equal(granted.aggregateId, "agent_seer");
  assert.deepEqual(granted.payload, {
    resourceId: "aether",
    amount: 2,
    reason: "anomaly_contained",
    balanceAfter: 6,
    accountRef: "agent:agent_seer",
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
  assert.equal(influence.payload.sourceEventId, resolved.eventId);
  assert.equal(influence.payload.influenceScoreAfter, 13);

  const trace = events[3];
  assert.ok(trace);
  assert.equal(trace.eventType, "trace_created");
  if (trace.eventType !== "trace_created") throw new Error("expected_trace_created_event");
  assert.equal(trace.aggregateType, "trace");
  assert.deepEqual(trace.payload.sourceEventIds, [resolved.eventId, influence.eventId]);
  assert.deepEqual(trace.payload.participantAgentIds, ["agent_seer", "agent_rival"]);
  assert.equal(trace.payload.parentTraceId, "trace_parent");

  const projectedAnomaly = {
    anomalyId: "anomaly_1",
    status: "resolved",
    marker: "resolved",
  } as const;
  assert.equal(projectAnomalyEventResolution({
    events,
    projection: {
      anomalyEvents: {
        anomaly_1: projectedAnomaly,
      },
    },
  }), projectedAnomaly);
  assert.throws(() => projectAnomalyEventResolution({
    events: events.slice(1),
    projection: {
      anomalyEvents: {
        anomaly_1: projectedAnomaly,
      },
    },
  }), /anomaly_event_resolved_event_missing/);
  assert.throws(() => projectAnomalyEventResolution({
    events,
    projection: {
      anomalyEvents: {},
    },
  }), /anomaly_projection_failed/);

  const escapedEvents = planAnomalyEventResolutionEvents({
    anomalyId: "anomaly_escape",
    regionId: "region_gray_harbor",
    anomalyTitle: "失控裂隙",
    leaderboard: [winner],
    totalScore: 5,
    targetScore: 6,
    reward,
    lifetimeRisk: 2,
    resolvedAt,
    winnerRewardBalanceBefore: 0,
    winnerInfluenceScoreBefore: 0,
    idFactory,
    makeEvent: eventFactory(() => new Date(resolvedAt), idFactory, {
      actorExplorerId: "system",
      trustClass: "system_worker" as const,
    }),
  });
  assert.deepEqual(escapedEvents.map((event) => event.eventType), ["anomaly_event_resolved"]);
  const escapedResolved = escapedEvents[0];
  assert.ok(escapedResolved);
  assert.equal(escapedResolved.eventType, "anomaly_event_resolved");
  if (escapedResolved.eventType !== "anomaly_event_resolved") throw new Error("expected_escaped_anomaly_resolved_event");
  assert.equal(escapedResolved.payload.reward, undefined);
});

test("encounter rules normalize anomaly media and reject underspecified palettes", () => {
  assert.equal(normalizeAnomalyMedia(undefined), undefined);
  assert.deepEqual(normalizeAnomalyMedia({
    variantLabel: "黑曜裂隙",
    scenePrompt: "灰港灯塔下的黑曜裂隙",
    palette: ["#101820", "#d9a441", "#52d6ff"],
    accentColor: "#d9a441",
    dangerColor: "#ff5252",
    sigil: "裂",
    publicAlt: "黑曜裂隙在灰港灯塔下张开",
    assetPath: "/epoch/anomaly.png",
    imageUrl: "https://example.test/anomaly.png",
    imageSha256: "sha256:abc",
  }), {
    variantLabel: "黑曜裂隙",
    scenePrompt: "灰港灯塔下的黑曜裂隙",
    palette: ["#101820", "#d9a441", "#52d6ff"],
    accentColor: "#d9a441",
    dangerColor: "#ff5252",
    sigil: "裂",
    publicAlt: "黑曜裂隙在灰港灯塔下张开",
    assetPath: "/epoch/anomaly.png",
    imageUrl: "https://example.test/anomaly.png",
    imageSha256: "sha256:abc",
  });

  assert.throws(() => normalizeAnomalyMedia({
    variantLabel: "黑曜裂隙",
    scenePrompt: "灰港灯塔下的黑曜裂隙",
    palette: ["#101820", "#d9a441"],
    accentColor: "#d9a441",
    dangerColor: "#ff5252",
    sigil: "裂",
    publicAlt: "黑曜裂隙在灰港灯塔下张开",
  }), /anomaly_media_palette_too_small/);
});
