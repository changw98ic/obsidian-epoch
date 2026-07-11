import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";
import type { EpochProjection } from "../lib/epoch/gameCore.ts";

const modulePath = new URL("../lib/epoch/encounterReadModel.ts", import.meta.url);

function projectionFixture(): EpochProjection {
  return {
    contestedObjectives: {
      objective_low: {
        objectiveId: "objective_low",
        regionId: "region_gray_harbor",
        title: "低分目标",
        description: "低分仍开放。",
        resourceId: "focus",
        targetScore: 6,
        reward: { resourceId: "legend", amount: 1, reason: "objective_reward" },
        createdAt: "2026-07-07T01:00:00.000Z",
        status: "active",
        totalScore: 2,
        leaderboard: [],
      },
      objective_high: {
        objectiveId: "objective_high",
        regionId: "region_gray_harbor",
        title: "高分目标",
        description: "高分排前。",
        resourceId: "focus",
        targetScore: 6,
        reward: { resourceId: "legend", amount: 1, reason: "objective_reward" },
        createdAt: "2026-07-07T02:00:00.000Z",
        status: "active",
        totalScore: 9,
        leaderboard: [],
      },
      objective_done: {
        objectiveId: "objective_done",
        regionId: "region_gray_harbor",
        title: "已结算目标",
        description: "已结算排后。",
        resourceId: "focus",
        targetScore: 6,
        reward: { resourceId: "legend", amount: 1, reason: "objective_reward" },
        createdAt: "2026-07-07T03:00:00.000Z",
        status: "settled",
        totalScore: 99,
        leaderboard: [],
        settledAt: "2026-07-07T04:00:00.000Z",
      },
      objective_other_region: {
        objectiveId: "objective_other_region",
        regionId: "region_other",
        title: "他区目标",
        description: "不应进入灰港过滤。",
        resourceId: "focus",
        targetScore: 6,
        reward: { resourceId: "legend", amount: 1, reason: "objective_reward" },
        createdAt: "2026-07-07T01:00:00.000Z",
        status: "active",
        totalScore: 100,
        leaderboard: [],
      },
    },
    objectiveIdsByRegion: {
      region_gray_harbor: ["objective_low", "objective_high", "objective_done"],
      region_other: ["objective_other_region"],
    },
    resourceNodes: {
      node_open_agent: {
        nodeId: "node_open_agent",
        regionId: "region_gray_harbor",
        title: "代理人参与节点",
        description: "应按分数排前。",
        resourceId: "coin",
        reward: { resourceId: "coin", amount: 2, reason: "resource_node_reward" },
        spawnedAt: "2026-07-07T02:00:00.000Z",
        status: "open",
        totalScore: 6,
        leaderboard: [{ agentId: "agent_a", explorerId: "explorer_a", staminaSpent: 2, score: 6 }],
      },
      node_open_other: {
        nodeId: "node_open_other",
        regionId: "region_gray_harbor",
        title: "他人节点",
        description: "agent 过滤时应排除。",
        resourceId: "coin",
        reward: { resourceId: "coin", amount: 2, reason: "resource_node_reward" },
        spawnedAt: "2026-07-07T03:00:00.000Z",
        status: "open",
        totalScore: 8,
        leaderboard: [{ agentId: "agent_b", explorerId: "explorer_b", staminaSpent: 2, score: 8 }],
      },
      node_settled: {
        nodeId: "node_settled",
        regionId: "region_gray_harbor",
        title: "已结算节点",
        description: "已结算排后。",
        resourceId: "coin",
        reward: { resourceId: "coin", amount: 2, reason: "resource_node_reward" },
        spawnedAt: "2026-07-07T04:00:00.000Z",
        status: "settled",
        totalScore: 50,
        leaderboard: [{ agentId: "agent_a", explorerId: "explorer_a", staminaSpent: 2, score: 50 }],
        settledAt: "2026-07-07T05:00:00.000Z",
      },
    },
    resourceNodeIdsByRegion: {
      region_gray_harbor: ["node_open_agent", "node_open_other", "node_settled"],
    },
    anomalyEvents: {
      anomaly_open_agent: {
        anomalyId: "anomaly_open_agent",
        regionId: "region_gray_harbor",
        title: "代理人异常",
        description: "开放且代理人参与。",
        severity: "major",
        targetScore: 8,
        reward: { resourceId: "aether", amount: 2, reason: "anomaly_reward" },
        lifetimeRisk: 1,
        spawnedAt: "2026-07-07T02:00:00.000Z",
        status: "open",
        totalScore: 5,
        leaderboard: [{ agentId: "agent_a", explorerId: "explorer_a", focusSpent: 1, score: 5 }],
      },
      anomaly_open_other: {
        anomalyId: "anomaly_open_other",
        regionId: "region_gray_harbor",
        title: "他人异常",
        description: "agent 过滤时应排除。",
        severity: "minor",
        targetScore: 8,
        reward: { resourceId: "aether", amount: 2, reason: "anomaly_reward" },
        lifetimeRisk: 1,
        spawnedAt: "2026-07-07T03:00:00.000Z",
        status: "open",
        totalScore: 7,
        leaderboard: [{ agentId: "agent_b", explorerId: "explorer_b", focusSpent: 1, score: 7 }],
      },
      anomaly_resolved: {
        anomalyId: "anomaly_resolved",
        regionId: "region_gray_harbor",
        title: "已解决异常",
        description: "已解决排后。",
        severity: "minor",
        targetScore: 8,
        reward: { resourceId: "aether", amount: 2, reason: "anomaly_reward" },
        lifetimeRisk: 1,
        spawnedAt: "2026-07-07T04:00:00.000Z",
        status: "resolved",
        totalScore: 99,
        leaderboard: [{ agentId: "agent_a", explorerId: "explorer_a", focusSpent: 1, score: 99 }],
        resolvedAt: "2026-07-07T05:00:00.000Z",
      },
    },
    anomalyEventIdsByRegion: {
      region_gray_harbor: ["anomaly_open_agent", "anomaly_open_other", "anomaly_resolved"],
    },
  } as unknown as EpochProjection;
}

test("encounter read model sorts objectives by open status and score", async () => {
  assert.ok(existsSync(modulePath), "encounterReadModel.ts should own objective/resource/anomaly projections");
  const readModel = await import("../lib/epoch/encounterReadModel.ts");
  const projection = projectionFixture();

  assert.deepEqual(
    readModel.objectivesView(projection, { regionId: "region_gray_harbor" }).map((objective) => objective.objectiveId),
    ["objective_high", "objective_low", "objective_done"],
  );
});

test("encounter read model filters resource nodes by agent and status", async () => {
  assert.ok(existsSync(modulePath), "encounterReadModel.ts should own resource-node projections");
  const readModel = await import("../lib/epoch/encounterReadModel.ts");
  const projection = projectionFixture();

  assert.deepEqual(
    readModel.resourceNodesView(projection, { regionId: "region_gray_harbor", agentId: "agent_a" }).map((node) => node.nodeId),
    ["node_open_agent", "node_settled"],
  );
  assert.deepEqual(
    readModel.resourceNodesView(projection, { regionId: "region_gray_harbor", status: "open" }).map((node) => node.nodeId),
    ["node_open_other", "node_open_agent"],
  );
});

test("encounter read model filters anomalies by agent and status", async () => {
  assert.ok(existsSync(modulePath), "encounterReadModel.ts should own anomaly projections");
  const readModel = await import("../lib/epoch/encounterReadModel.ts");
  const projection = projectionFixture();

  assert.deepEqual(
    readModel.anomaliesView(projection, { regionId: "region_gray_harbor", agentId: "agent_a" }).map((anomaly) => anomaly.anomalyId),
    ["anomaly_open_agent", "anomaly_resolved"],
  );
  assert.deepEqual(
    readModel.anomaliesView(projection, { regionId: "region_gray_harbor", status: "open" }).map((anomaly) => anomaly.anomalyId),
    ["anomaly_open_other", "anomaly_open_agent"],
  );
});
