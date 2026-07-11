import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { createEpochGameCore } from "../lib/epoch/gameCore.ts";
import { MAX_PARTY_RUN_MEMBERS } from "../lib/epoch/combatSettlementRules.ts";
import { createMaintenanceRuntime } from "../lib/epoch/maintenanceRuntime.ts";
import { createSequentialEpochIdFactory, type EpochClock, type EpochPartyRole } from "../lib/epoch/protocol.ts";
import { anomalyEventTemplateCatalog } from "../lib/epoch/runtime.ts";
import { commandResult, publicProjection } from "../lib/epoch/runtimePublicProjectionRules.ts";
import {
  epochMaintenanceConfigFromEnv,
  runEpochMaintenanceTick,
  startEpochMaintenanceScheduler,
} from "../lib/maintenance.ts";
import { createAgentWorldRuntime } from "../lib/mcpTools.ts";

function mutableClock(initialIso: string) {
  let current = new Date(initialIso);
  const clock: EpochClock = () => new Date(current);
  return {
    clock,
    now: () => new Date(current),
    set: (iso: string) => {
      current = new Date(iso);
    },
  };
}

function recoveryCode(explorerId: string, localSecret: string) {
  return Buffer.from(JSON.stringify({ explorerId, localSecret }), "utf8").toString("base64");
}

function explorerSecretHash(explorerId: string, localSecret: string) {
  return `sha256:${createHash("sha256").update(`${explorerId}:${localSecret}`).digest("hex")}`;
}

function maintenanceIdSegmentForTest(value: string) {
  return value.replace(/[^a-zA-Z0-9_.:-]/g, "_");
}

function issueRuntimeIdentity(
  runtime: ReturnType<typeof createAgentWorldRuntime>,
  explorerId: string,
  identityName: string,
) {
  const localSecret = `${explorerId}_secret`;
  const recovery = recoveryCode(explorerId, localSecret);
  const issued = runtime.epochIdentity({
    explorerId,
    recoveryCode: recovery,
    identityName,
    idempotencyKey: `${explorerId}:identity`,
  });
  assert.ok("value" in issued);
  return {
    agentId: issued.value.agentId,
    recovery,
  };
}

function createMaturePartyRun(
  runtime: ReturnType<typeof createAgentWorldRuntime>,
  input: {
    readonly key: string;
    readonly title: string;
    readonly objective: string;
    readonly regionId: string;
  },
) {
  const leader = issueRuntimeIdentity(runtime, `explorer_${input.key}_leader`, `${input.title} 队长`);
  const created = runtime.epochCreatePartyRun({
    leaderAgentId: leader.agentId,
    regionId: input.regionId,
    title: input.title,
    objective: input.objective,
    recoveryCode: leader.recovery,
    idempotencyKey: `${input.key}:party:create`,
  });
  assert.ok("value" in created);
  const partyRunId = created.value.partyRunId;
  const roles: readonly EpochPartyRole[] = ["vanguard", "scout", "support"];
  assert.equal(roles.length + 1, MAX_PARTY_RUN_MEMBERS);
  roles.forEach((participantRole, index) => {
    const member = issueRuntimeIdentity(
      runtime,
      `explorer_${input.key}_member_${index + 1}`,
      `${input.title} 成员 ${index + 1}`,
    );
    const joined = runtime.epochJoinPartyRun({
      partyRunId,
      agentId: member.agentId,
      participantRole,
      recoveryCode: member.recovery,
      idempotencyKey: `${input.key}:party:join:${index + 1}`,
    });
    assert.ok("value" in joined);
  });
  return partyRunId;
}

test("epoch maintenance config is opt-in outside production and reads bounded intervals from env", () => {
  assert.equal(epochMaintenanceConfigFromEnv({}).enabled, false);

  const config = epochMaintenanceConfigFromEnv({
    AGENT_SERVER_MAINTENANCE_ENABLED: "true",
    AGENT_SERVER_MAINTENANCE_INTERVAL_MS: "5000",
    AGENT_SERVER_MAINTENANCE_NPC_REGION_ID: "region_gray_harbor",
    AGENT_SERVER_MAINTENANCE_NPC_LIMIT: "3",
    AGENT_SERVER_MAINTENANCE_MARKET_MAX_AGE_SECONDS: "30",
    AGENT_SERVER_MAINTENANCE_MARKET_LIMIT: "7",
    AGENT_SERVER_MAINTENANCE_DIRECT_TRADE_MAX_AGE_SECONDS: "45",
    AGENT_SERVER_MAINTENANCE_DIRECT_TRADE_LIMIT: "8",
    AGENT_SERVER_MAINTENANCE_RESOURCE_NODE_REGION_IDS: "region_gray_harbor, region_salt_gate",
    AGENT_SERVER_MAINTENANCE_RESOURCE_NODE_LIMIT: "2",
    AGENT_SERVER_MAINTENANCE_RESOURCE_NODE_SETTLEMENT_LIMIT: "4",
    AGENT_SERVER_MAINTENANCE_ANOMALY_REGION_IDS: "region_gray_harbor",
    AGENT_SERVER_MAINTENANCE_ANOMALY_LIMIT: "1",
    AGENT_SERVER_MAINTENANCE_ANOMALY_TEMPLATE_KEY: "obsidian_wyrm_boss",
    AGENT_SERVER_MAINTENANCE_SEASON_REGION_IDS: "region_gray_harbor, region_salt_gate",
    AGENT_SERVER_MAINTENANCE_SEASON_LIMIT: "2",
    AGENT_SERVER_MAINTENANCE_SEASON_KEY: "gray_harbor_faction_season",
    AGENT_SERVER_MAINTENANCE_SEASON_SETTLEMENT_LIMIT: "4",
    AGENT_SERVER_MAINTENANCE_PARTY_RUN_SETTLEMENT_LIMIT: "3",
    AGENT_SERVER_MAINTENANCE_SERVER_HOSTED_JOB_LIMIT: "6",
    AGENT_SERVER_MAINTENANCE_REGION_CONTROL_DECAY_LIMIT: "5",
    AGENT_SERVER_MAINTENANCE_REGION_CONTROL_DECAY_AMOUNT: "2",
    AGENT_SERVER_MAINTENANCE_REGION_CONTROL_DECAY_MIN_AGE_SECONDS: "86400",
    AGENT_SERVER_MAINTENANCE_RUN_ON_START: "true",
    AGENT_SERVER_OPERATOR_KEY: "maintenance-operator-key",
  });

  assert.equal(config.enabled, true);
  assert.equal(config.intervalMs, 5_000);
  assert.equal(config.npcRegionId, "region_gray_harbor");
  assert.equal(config.npcLimit, 3);
  assert.equal(config.marketMaxAgeSeconds, 30);
  assert.equal(config.marketLimit, 7);
  assert.equal(config.directTradeMaxAgeSeconds, 45);
  assert.equal(config.directTradeLimit, 8);
  assert.deepEqual(config.resourceNodeRegionIds, ["region_gray_harbor", "region_salt_gate"]);
  assert.equal(config.resourceNodeLimit, 2);
  assert.equal(config.resourceNodeSettlementLimit, 4);
  assert.deepEqual(config.anomalyRegionIds, ["region_gray_harbor"]);
  assert.equal(config.anomalyLimit, 1);
  assert.equal(config.anomalyTemplateKey, "obsidian_wyrm_boss");
  assert.deepEqual(config.seasonRegionIds, ["region_gray_harbor", "region_salt_gate"]);
  assert.equal(config.seasonLimit, 2);
  assert.equal(config.seasonKey, "gray_harbor_faction_season");
  assert.equal(config.seasonSettlementLimit, 4);
  assert.equal(config.partyRunSettlementLimit, 3);
  assert.equal(config.serverHostedJobLimit, 6);
  assert.equal(config.regionControlDecayLimit, 5);
  assert.equal(config.regionControlDecayAmount, 2);
  assert.equal(config.regionControlDecayMinAgeSeconds, 86_400);
  assert.equal(config.runOnStart, true);
  assert.equal(config.operatorKey, "maintenance-operator-key");
});

test("epoch maintenance config is mandatory and operator-authorized in production", () => {
  assert.throws(
    () => epochMaintenanceConfigFromEnv({ NODE_ENV: "production" }),
    /AGENT_SERVER_MAINTENANCE_ENABLED/,
  );
  assert.throws(
    () => epochMaintenanceConfigFromEnv({
      NODE_ENV: "production",
      AGENT_SERVER_MAINTENANCE_ENABLED: "1",
    }),
    /AGENT_SERVER_OPERATOR_KEY/,
  );

  const config = epochMaintenanceConfigFromEnv({
    NODE_ENV: "production",
    AGENT_SERVER_MAINTENANCE_ENABLED: "1",
    AGENT_SERVER_OPERATOR_KEY: "production-maintenance-key",
  });
  assert.equal(config.enabled, true);
  assert.equal(config.npcLimit, 5);
  assert.equal(config.marketLimit, 50);
  assert.equal(config.operatorKey, "production-maintenance-key");
});

test("epoch maintenance config canonicalizes visible world-map region ids", () => {
  const config = epochMaintenanceConfigFromEnv({
    AGENT_SERVER_MAINTENANCE_NPC_REGION_ID: "region:棱镜水域",
    AGENT_SERVER_MAINTENANCE_RESOURCE_NODE_REGION_IDS: "region:棱镜水域, region_prism_waters, region:轨道教堂",
    AGENT_SERVER_MAINTENANCE_ANOMALY_REGION_IDS: "region:棱镜水域, region:轨道教堂",
    AGENT_SERVER_MAINTENANCE_SEASON_REGION_IDS: "region:轨道教堂, region_orbital_cathedral",
  });

  assert.equal(config.npcRegionId, "region_prism_waters");
  assert.deepEqual(config.resourceNodeRegionIds, ["region_prism_waters", "region_orbital_cathedral"]);
  assert.deepEqual(config.anomalyRegionIds, ["region_prism_waters", "region_orbital_cathedral"]);
  assert.deepEqual(config.seasonRegionIds, ["region_orbital_cathedral"]);
});

test("epoch maintenance tick processes queued server-hosted jobs through operator authority", async () => {
  const time = mutableClock("2026-06-25T00:00:00.000Z");
  const runtime = createAgentWorldRuntime({
    epoch: {
      clock: time.clock,
      idFactory: createSequentialEpochIdFactory("maintenance_server_jobs"),
      operatorKey: "maintenance-server-jobs-key",
    },
  });
  const persisted: { fileName: string; record: unknown }[] = [];
  const persistJsonl = async (fileName: string, record: unknown) => {
    persisted.push({ fileName, record });
  };
  const recovery = recoveryCode("explorer_maintenance_server_jobs", "local_maintenance_server_jobs_secret");
  const identity = runtime.epochIdentity({
    explorerId: "explorer_maintenance_server_jobs",
    recoveryCode: recovery,
    identityName: "维护托管队列身份",
    idempotencyKey: "identity-maintenance-server-jobs-1",
  });
  assert.ok("value" in identity);
  const agentId = identity.value.agentId;
  for (const suffix of ["one", "two"]) {
    const queued = runtime.epochQueueServerHostedAction({
      operatorKey: "maintenance-server-jobs-key",
      agentId,
      regionId: "region_gray_harbor",
      mandate: `维护 tick 托管观察 ${suffix}`,
      optionKey: "observe",
      visibleText: `维护 tick 准备执行第 ${suffix} 次权威观察。`,
      idempotencyKey: `queue-maintenance-server-job-${suffix}`,
    });
    assert.equal(queued.value.status, "queued");
  }
  const config = {
    enabled: true,
    intervalMs: 5_000,
    npcLimit: 1,
    marketMaxAgeSeconds: 30,
    marketLimit: 1,
    resourceNodeRegionIds: [],
    resourceNodeLimit: 0,
    serverHostedJobLimit: 1,
    runOnStart: false,
    operatorKey: "maintenance-server-jobs-key",
  };

  const summary = await runEpochMaintenanceTick({
    runtime,
    persistJsonl,
    now: time.now,
    config,
  });

  assert.equal(summary.serverHostedJobs.completed, 1);
  assert.equal(summary.serverHostedJobs.skipped, 0);
  assert.ok(summary.serverHostedJobs.events >= 1);
  assert.equal(runtime.epochServerHostedJobs({
    operatorKey: "maintenance-server-jobs-key",
    agentId,
    status: "queued",
  }).jobs.length, 1);
  assert.equal(runtime.epochServerHostedJobs({
    operatorKey: "maintenance-server-jobs-key",
    agentId,
    status: "completed",
  }).jobs.length, 1);
  assert.ok(persisted.some((entry) => ((entry.record as { event?: { eventType?: string } }).event?.eventType) === "server_hosted_job_completed"));
});

test("server-hosted jobs skip cleanly when their queued option is no longer legal", () => {
  const time = mutableClock("2026-06-25T00:00:00.000Z");
  const runtime = createAgentWorldRuntime({
    epoch: {
      clock: time.clock,
      idFactory: createSequentialEpochIdFactory("maintenance_stale_job"),
      operatorKey: "maintenance-stale-job-key",
      defaultLifetime: 10,
    },
  });
  const recovery = recoveryCode("explorer_maintenance_stale_job", "local_maintenance_stale_job_secret");
  const identity = runtime.epochIdentity({
    explorerId: "explorer_maintenance_stale_job",
    recoveryCode: recovery,
    identityName: "过期托管队列身份",
    idempotencyKey: "identity-maintenance-stale-job-1",
  });
  assert.ok("value" in identity);
  const agentId = identity.value.agentId;

  const queued = runtime.epochQueueServerHostedAction({
    operatorKey: "maintenance-stale-job-key",
    agentId,
    regionId: "region_gray_harbor",
    mandate: "稍后执行的高风险托管作业",
    optionKey: "anomaly",
    visibleText: "旧队列准备稍后接触异常。",
    idempotencyKey: "queue-maintenance-stale-job-1",
  });
  assert.equal(queued.value.status, "queued");

  for (const index of [1, 2]) {
    const run = runtime.epochRunServerHostedAction({
      operatorKey: "maintenance-stale-job-key",
      agentId,
      regionId: "region_gray_harbor",
      mandate: `即时高风险托管 ${index}`,
      optionKey: "anomaly",
      visibleText: `即时消耗第 ${index} 次高风险额度。`,
      idempotencyKey: `run-maintenance-stale-job-risk-${index}`,
    });
    assert.equal(run.value.action.risk, "high");
  }

  const skipped = runtime.epochRunServerHostedJob({
    operatorKey: "maintenance-stale-job-key",
    jobId: queued.value.jobId,
    idempotencyKey: "run-maintenance-stale-job-1",
  });

  assert.equal(skipped.value.job.status, "skipped");
  assert.equal(skipped.value.job.skipReason, "action_option_unavailable");
  assert.equal(skipped.value.run, undefined);
  assert.ok(skipped.events.some((event: { eventType: string }) => event.eventType === "server_hosted_job_skipped"));
  assert.equal(runtime.epochServerHostedJobs({
    operatorKey: "maintenance-stale-job-key",
    agentId,
    status: "queued",
  }).jobs.length, 0);
  assert.equal(runtime.epochServerHostedJobs({
    operatorKey: "maintenance-stale-job-key",
    agentId,
    status: "skipped",
  }).jobs.length, 1);
});

test("server anomaly template catalog contains a hand-authored boss rotation", () => {
  const catalog = anomalyEventTemplateCatalog();
  const bossTemplates = catalog.filter((template) => template.key.endsWith("_boss"));

  assert.ok(catalog.some((template) => template.key === "obsidian_wyrm_boss"));
  assert.ok(bossTemplates.length >= 4);
  assert.ok(bossTemplates.every((template) => template.severity === "major" || template.severity === "cataclysm"));
  assert.ok(bossTemplates.every((template) => template.targetScore >= 18));
  assert.equal(new Set(bossTemplates.map((template) => template.title)).size, bossTemplates.length);
  assert.ok(bossTemplates.every((template) => {
    const variants = (template as { narrativeVariants?: readonly string[] }).narrativeVariants || [];
    return variants.length >= 3 && new Set(variants).size === variants.length;
  }));
  assert.ok(bossTemplates.every((template) => {
    const media = (template as {
      media?: {
        variantLabel?: string;
        scenePrompt?: string;
        palette?: readonly string[];
        accentColor?: string;
        dangerColor?: string;
        sigil?: string;
        publicAlt?: string;
      };
    }).media;
    return Boolean(
      media
      && typeof media.variantLabel === "string"
      && typeof media.scenePrompt === "string"
      && media.palette
      && media.palette.length >= 3
      && typeof media.accentColor === "string"
      && typeof media.dangerColor === "string"
      && typeof media.sigil === "string"
      && typeof media.publicAlt === "string",
    );
  }));
});

test("epoch maintenance tick rotates through server-owned boss templates when none is pinned", async () => {
  const time = mutableClock("2026-06-25T00:00:00.000Z");
  const runtime = createAgentWorldRuntime({
    epoch: {
      clock: time.clock,
      idFactory: createSequentialEpochIdFactory("maintenance_boss_rotation"),
      operatorKey: "maintenance-boss-rotation-key",
    },
  });
  const bossTitles = new Set(anomalyEventTemplateCatalog()
    .filter((template) => template.key.endsWith("_boss"))
    .map((template) => template.title));
  const config = {
    enabled: true,
    intervalMs: 5_000,
    npcLimit: 1,
    marketMaxAgeSeconds: 30,
    marketLimit: 1,
    resourceNodeRegionIds: [],
    resourceNodeLimit: 0,
    anomalyRegionIds: ["region_gray_harbor", "region_salt_gate", "region_glass_archive"],
    anomalyLimit: 3,
    runOnStart: false,
    operatorKey: "maintenance-boss-rotation-key",
  };

  const summary = await runEpochMaintenanceTick({
    runtime,
    now: time.now,
    config,
  });
  const spawned = runtime.epochAnomalies({ status: "open" }).anomalies;
  const titles = spawned.map((anomaly) => anomaly.title);

  assert.equal(summary.anomalies.spawned, 3);
  assert.equal(summary.anomalies.skipped, 0);
  assert.equal(spawned.length, 3);
  assert.ok(titles.every((title) => bossTitles.has(title)));
  assert.ok(new Set(titles).size >= 2);
});

test("epoch maintenance tick applies deterministic server-owned boss narrative variants", async () => {
  const time = mutableClock("2026-06-25T00:00:00.000Z");
  const runtime = createAgentWorldRuntime({
    epoch: {
      clock: time.clock,
      idFactory: createSequentialEpochIdFactory("maintenance_boss_variant"),
      operatorKey: "maintenance-boss-variant-key",
    },
  });
  const config = {
    enabled: true,
    intervalMs: 5_000,
    npcLimit: 1,
    marketMaxAgeSeconds: 30,
    marketLimit: 1,
    resourceNodeRegionIds: [],
    resourceNodeLimit: 0,
    anomalyRegionIds: ["region_gray_harbor", "region_salt_gate", "region_glass_archive"],
    anomalyLimit: 3,
    anomalyTemplateKey: "obsidian_wyrm_boss",
    runOnStart: false,
    operatorKey: "maintenance-boss-variant-key",
  };

  const summary = await runEpochMaintenanceTick({
    runtime,
    now: time.now,
    config,
  });
  const spawned = runtime.epochAnomalies({ status: "open" }).anomalies;
  const descriptions = spawned.map((anomaly) => anomaly.description);

  assert.equal(summary.anomalies.spawned, 3);
  assert.ok(spawned.every((anomaly) => anomaly.title === "黑曜裂隙兽"));
  assert.equal(new Set(descriptions).size >= 2, true);
});

test("epoch maintenance tick spawns anomaly chains from server templates and skips blocked regions", async () => {
  const time = mutableClock("2026-06-25T00:00:00.000Z");
  const runtime = createAgentWorldRuntime({
    epoch: {
      clock: time.clock,
      idFactory: createSequentialEpochIdFactory("maintenance_anomaly"),
      operatorKey: "maintenance-anomaly-key",
    },
  });
  const persisted: { fileName: string; record: unknown }[] = [];
  const persistJsonl = async (fileName: string, record: unknown) => {
    persisted.push({ fileName, record });
  };
  const config = {
    enabled: true,
    intervalMs: 5_000,
    npcLimit: 1,
    marketMaxAgeSeconds: 30,
    marketLimit: 1,
    resourceNodeRegionIds: [],
    resourceNodeLimit: 0,
    anomalyRegionIds: ["region_gray_harbor"],
    anomalyLimit: 1,
    anomalyTemplateKey: "obsidian_wyrm_boss",
    runOnStart: false,
    operatorKey: "maintenance-anomaly-key",
  };

  const first = await runEpochMaintenanceTick({
    runtime,
    persistJsonl,
    now: time.now,
    config,
  });

  assert.equal(first.anomalies.spawned, 1);
  assert.equal(first.anomalies.skipped, 0);
  assert.equal(first.anomalies.events, 2);
  assert.equal(first.persistedEvents, 2);
  assert.ok(persisted.some((entry) => ((entry.record as { event?: { eventType?: string } }).event?.eventType) === "anomaly_event_spawned"));
  assert.ok(persisted.some((entry) => ((entry.record as { event?: { eventType?: string } }).event?.eventType) === "region_news_generated"));
  const firstAnomaly = runtime.epochAnomalies({ regionId: "region_gray_harbor" }).anomalies[0];
  assert.equal(firstAnomaly.status, "open");
  assert.equal(firstAnomaly.title, "黑曜裂隙兽");
  assert.equal(firstAnomaly.targetScore, 18);
  assert.equal(firstAnomaly.lifetimeRisk, 3);
  assert.equal(firstAnomaly.media?.variantLabel, "黑曜潮线");
  assert.ok(firstAnomaly.media?.palette.includes("#0f172a"));
  assert.match(firstAnomaly.media?.scenePrompt || "", /obsidian rift beast/i);
  const bossNews = runtime.epochRegionInfo({ regionId: "region_gray_harbor" }).news[0];
  assert.equal(bossNews.sourceEventIds.length, 1);
  assert.match(bossNews.headline, /黑曜裂隙兽/);
  assert.match(bossNews.body, /灰港/);
  assert.doesNotMatch(bossNews.body, /region_/);

  time.set("2026-06-25T00:05:00.000Z");
  const blockedByOpenAnomaly = await runEpochMaintenanceTick({
    runtime,
    persistJsonl,
    now: time.now,
    config,
  });
  assert.equal(blockedByOpenAnomaly.anomalies.spawned, 0);
  assert.equal(blockedByOpenAnomaly.anomalies.skipped, 1);
  assert.equal(blockedByOpenAnomaly.anomalies.events, 0);
});

test("epoch maintenance tick spawns resource nodes through server rules and skips blocked regions", async () => {
  const time = mutableClock("2026-06-25T00:00:00.000Z");
  const runtime = createAgentWorldRuntime({
    epoch: {
      clock: time.clock,
      idFactory: createSequentialEpochIdFactory("maintenance_node"),
      operatorKey: "maintenance-node-key",
    },
  });
  const persisted: { fileName: string; record: unknown }[] = [];
  const persistJsonl = async (fileName: string, record: unknown) => {
    persisted.push({ fileName, record });
  };
  const config = {
    enabled: true,
    intervalMs: 5_000,
    npcLimit: 1,
    marketMaxAgeSeconds: 30,
    marketLimit: 1,
    resourceNodeRegionIds: ["region_gray_harbor"],
    resourceNodeLimit: 1,
    runOnStart: false,
    operatorKey: "maintenance-node-key",
  };

  const first = await runEpochMaintenanceTick({
    runtime,
    persistJsonl,
    now: time.now,
    config,
  });

  assert.equal(first.resourceNodes.spawned, 1);
  assert.equal(first.resourceNodes.skipped, 0);
  assert.equal(first.resourceNodes.events, 1);
  assert.equal(first.persistedEvents, 1);
  assert.ok(persisted.some((entry) => ((entry.record as { event?: { eventType?: string } }).event?.eventType) === "resource_node_spawned"));
  const firstNode = runtime.epochResourceNodes({ regionId: "region_gray_harbor" }).nodes[0];
  assert.equal(firstNode.status, "open");

  time.set("2026-06-25T00:05:00.000Z");
  const blockedByOpenNode = await runEpochMaintenanceTick({
    runtime,
    persistJsonl,
    now: time.now,
    config,
  });
  assert.equal(blockedByOpenNode.resourceNodes.spawned, 0);
  assert.equal(blockedByOpenNode.resourceNodes.skipped, 1);
  assert.equal(blockedByOpenNode.resourceNodes.events, 0);
  assert.equal(blockedByOpenNode.persistedEvents, 0);

  runtime.epochSettleResourceNode({
    operatorKey: "maintenance-node-key",
    nodeId: firstNode.nodeId,
    idempotencyKey: "maintenance-node-settle-1",
  });
  time.set("2026-06-25T00:06:00.000Z");
  const blockedByCooldown = await runEpochMaintenanceTick({
    runtime,
    persistJsonl,
    now: time.now,
    config,
  });
  assert.equal(blockedByCooldown.resourceNodes.spawned, 0);
  assert.equal(blockedByCooldown.resourceNodes.skipped, 1);
  assert.equal(blockedByCooldown.resourceNodes.events, 0);

  time.set("2026-06-25T01:06:01.000Z");
  const afterCooldown = await runEpochMaintenanceTick({
    runtime,
    persistJsonl,
    now: time.now,
    config,
  });
  assert.equal(afterCooldown.resourceNodes.spawned, 1);
  assert.equal(afterCooldown.resourceNodes.skipped, 0);
  assert.equal(afterCooldown.resourceNodes.events, 1);
  const nextNode = runtime.epochResourceNodes({ regionId: "region_gray_harbor", status: "open" }).nodes[0];
  assert.notEqual(nextNode.nodeId, firstNode.nodeId);
});

test("epoch maintenance tick settles contested resource nodes through canonical events", async () => {
  const time = mutableClock("2026-06-25T00:00:00.000Z");
  const runtime = createAgentWorldRuntime({
    epoch: {
      clock: time.clock,
      idFactory: createSequentialEpochIdFactory("maintenance_node_settle"),
      operatorKey: "maintenance-node-settle-key",
    },
  });
  const persisted: { fileName: string; record: unknown }[] = [];
  const persistJsonl = async (fileName: string, record: unknown) => {
    persisted.push({ fileName, record });
  };
  const config = {
    enabled: true,
    intervalMs: 5_000,
    npcLimit: 1,
    marketMaxAgeSeconds: 30,
    marketLimit: 1,
    resourceNodeRegionIds: ["region_gray_harbor"],
    resourceNodeLimit: 1,
    resourceNodeSettlementLimit: 2,
    runOnStart: false,
    operatorKey: "maintenance-node-settle-key",
  };

  const recovery = recoveryCode("explorer_resource_node_settle", "node-secret");
  const issued = runtime.epochIdentity({
    explorerId: "explorer_resource_node_settle",
    identityName: "资源点巡礼者",
    recoveryCode: recovery,
    idempotencyKey: "resource-node-settle-identity",
  });
  assert.ok("value" in issued);
  const agentId = issued.value.agentId;
  runtime.epochSetDowntime({
    agentId,
    mode: "resting",
    recoveryCode: recovery,
    idempotencyKey: "resource-node-settle-downtime",
  });
  time.set("2026-06-25T00:10:01.000Z");
  runtime.epochClaimDowntime({
    agentId,
    recoveryCode: recovery,
    idempotencyKey: "resource-node-settle-claim",
  });

  const first = await runEpochMaintenanceTick({
    runtime,
    persistJsonl,
    now: time.now,
    config,
  });
  assert.equal(first.resourceNodes.spawned, 1);
  assert.equal(first.resourceNodes.settled, 0);
  const firstNode = runtime.epochResourceNodes({ regionId: "region_gray_harbor" }).nodes[0];
  assert.equal(firstNode.status, "open");

  runtime.epochContestResourceNode({
    nodeId: firstNode.nodeId,
    agentId,
    staminaSpent: 2,
    recoveryCode: recovery,
    idempotencyKey: "resource-node-settle-contest",
  });

  time.set("2026-06-25T00:20:00.000Z");
  const settled = await runEpochMaintenanceTick({
    runtime,
    persistJsonl,
    now: time.now,
    config: {
      ...config,
      resourceNodeLimit: 0,
    },
  });

  assert.equal(settled.resourceNodes.spawned, 0);
  assert.equal(settled.resourceNodes.settled, 1);
  assert.ok(persisted.some((entry) => ((entry.record as { event?: { eventType?: string } }).event?.eventType) === "resource_node_settled"));
  assert.ok(persisted.some((entry) => ((entry.record as { event?: { eventType?: string } }).event?.eventType) === "region_news_generated"));
  assert.ok(persisted.some((entry) => ((entry.record as { event?: { eventType?: string } }).event?.eventType) === "region_influence_changed"));
  assert.equal(runtime.epochResourceNodes({ regionId: "region_gray_harbor" }).nodes[0].status, "settled");
  assert.equal(runtime.epochProgress({ agentId }).resources.aether, 2);
  assert.match(runtime.epochProgress({ agentId }).claimableLegendNews[0].headline, /资源点完成争夺结算/);
});

test("epoch maintenance tick settles mature party runs in createdAt order through canonical settlement", async () => {
  const time = mutableClock("2026-06-25T00:00:00.000Z");
  const runtime = createAgentWorldRuntime({
    epoch: {
      clock: time.clock,
      idFactory: createSequentialEpochIdFactory("maintenance_party_run_settle"),
      operatorKey: "maintenance-party-run-key",
    },
  });
  const persisted: { fileName: string; record: unknown }[] = [];
  const persistJsonl = async (fileName: string, record: unknown) => {
    persisted.push({ fileName, record });
  };
  const config = {
    enabled: true,
    intervalMs: 5_000,
    npcLimit: 1,
    marketMaxAgeSeconds: 30,
    marketLimit: 1,
    resourceNodeRegionIds: [],
    resourceNodeLimit: 0,
    partyRunSettlementLimit: 1,
    runOnStart: false,
    operatorKey: "maintenance-party-run-key",
  };

  const olderPartyRunId = createMaturePartyRun(runtime, {
    key: "maintenance_party_older",
    title: "先发维护小队",
    objective: "验证维护按创建时间先结算。",
    regionId: "region_gray_harbor",
  });
  time.set("2026-06-25T00:01:00.000Z");
  const newerPartyRunId = createMaturePartyRun(runtime, {
    key: "maintenance_party_newer",
    title: "后发维护小队",
    objective: "验证后创建小队等待下一轮。",
    regionId: "region_gray_harbor",
  });

  time.set("2026-06-25T00:05:00.000Z");
  const first = await runEpochMaintenanceTick({
    runtime,
    persistJsonl,
    now: time.now,
    config,
  });

  assert.equal(first.partyRuns?.settled, 1);
  assert.equal(first.partyRuns?.skipped, 0);
  assert.ok((first.partyRuns?.events || 0) >= 1);
  assert.equal(runtime.epochPartyRuns({ status: "settled" }).partyRuns[0].partyRunId, olderPartyRunId);
  assert.equal(runtime.epochPartyRuns({ status: "open" }).partyRuns[0].partyRunId, newerPartyRunId);
  assert.ok(persisted.some((entry) =>
    ((entry.record as { event?: { eventType?: string } }).event?.eventType) === "party_run_settled"));
  assert.ok(persisted.some((entry) =>
    ((entry.record as { event?: { eventType?: string } }).event?.eventType) === "resource_granted"));
  assert.ok(persisted.some((entry) =>
    ((entry.record as { event?: { eventType?: string } }).event?.eventType) === "region_influence_changed"));
  assert.ok(persisted.some((entry) =>
    ((entry.record as { event?: { eventType?: string } }).event?.eventType) === "trace_created"));
  assert.ok(persisted.some((entry) =>
    ((entry.record as { event?: { eventType?: string } }).event?.eventType) === "region_news_generated"));
  const firstSettlementKey = persisted
    .map((entry) => (entry.record as { event?: { eventType?: string; idempotencyKey?: string } }).event)
    .find((event) => event?.eventType === "party_run_settled")?.idempotencyKey;
  assert.equal(
    firstSettlementKey,
    `maintenance:2026-06-25T00:05:00.000Z:party-run-settle:${maintenanceIdSegmentForTest(olderPartyRunId)}`,
  );

  time.set("2026-06-25T00:06:00.000Z");
  const second = await runEpochMaintenanceTick({
    runtime,
    persistJsonl,
    now: time.now,
    config,
  });

  assert.equal(second.partyRuns?.settled, 1);
  assert.equal(runtime.epochPartyRuns({ status: "settled" }).partyRuns.length, 2);
  const settlementKeys = persisted
    .map((entry) => (entry.record as { event?: { eventType?: string; idempotencyKey?: string } }).event)
    .filter((event): event is { eventType: string; idempotencyKey?: string } =>
      event?.eventType === "party_run_settled")
    .map((event) => event.idempotencyKey);
  assert.deepEqual(settlementKeys, [
    `maintenance:2026-06-25T00:05:00.000Z:party-run-settle:${maintenanceIdSegmentForTest(olderPartyRunId)}`,
    `maintenance:2026-06-25T00:06:00.000Z:party-run-settle:${maintenanceIdSegmentForTest(newerPartyRunId)}`,
  ]);

  const overview = runtime.epochOperatorOverview({
    operatorKey: "maintenance-party-run-key",
  });
  assert.equal(overview.maintenance.counts.partyRunsSettled, 2);
  assert.equal(overview.maintenance.health.workers.partyRunSettle.eventCount, 2);
  assert.equal(overview.maintenance.health.workers.partyRunSettle.status, "ok");
});

test("epoch maintenance runtime delegates mature party settlement through its canonical callback", () => {
  const time = mutableClock("2026-06-25T00:00:00.000Z");
  const core = createEpochGameCore({
    clock: time.clock,
    idFactory: createSequentialEpochIdFactory("maintenance_runtime_party_run"),
  });
  const context = (actorExplorerId: string, idempotencyKey: string) => ({
    actorExplorerId,
    trustClass: "untrusted_client" as const,
    idempotencyKey,
    causationId: idempotencyKey,
    correlationId: "maintenance-runtime-party-run",
  });
  const systemContext = (idempotencyKey: string) => ({
    actorExplorerId: "system",
    trustClass: "system_worker" as const,
    idempotencyKey,
    causationId: idempotencyKey,
    correlationId: "maintenance-runtime-party-run",
  });
  const issue = (explorerId: string, identityName: string) => {
    const issued = core.issueIdentity({
      explorerId,
      explorerSecretHash: explorerSecretHash(explorerId, `${explorerId}_secret`),
      identityName,
    }, context(explorerId, `${explorerId}:identity`));
    return issued.value;
  };
  const leader = issue("explorer_runtime_party_leader", "运行时维护小队队长");
  const created = core.createPartyRun({
    leaderAgentId: leader.agentId,
    regionId: "region_gray_harbor",
    title: "运行时维护小队",
    objective: "验证维护运行时通过回调结算。",
  }, context(leader.explorerId, "runtime-party:create"));
  const roles: readonly EpochPartyRole[] = ["vanguard", "scout", "support"];
  roles.forEach((participantRole, index) => {
    const member = issue(`explorer_runtime_party_member_${index + 1}`, `运行时维护成员 ${index + 1}`);
    core.joinPartyRun({
      partyRunId: created.value.partyRunId,
      agentId: member.agentId,
      participantRole,
    }, context(member.explorerId, `runtime-party:join:${index + 1}`));
  });

  const maintenanceRuntime = createMaintenanceRuntime({
    assertOperatorKey: () => undefined,
    idempotentlyWithSubject: (_scope, _input, _subject, run) => run(),
    clock: time.now,
    project: () => core.project(),
    publicProjection,
    maintenanceContext: (_input, idempotencyKey) => systemContext(idempotencyKey),
    appendRegionNewsForServerEvent: (result) => result,
    anomalyEventInputFromTemplate: () => {
      throw new Error("unexpected_anomaly_template");
    },
    seasonTemplate: () => ({
      seasonKey: "maintenance_runtime_unused",
      template: {
        title: "未使用维护赛季",
        description: "未使用",
        factionIds: ["gray_watch"],
        resourceId: "aether",
        targetScore: 10,
        reward: { resourceId: "coin", amount: 1, reason: "unused" },
        objectives: [],
      },
    }),
    toRuntimeResult: commandResult,
    tickNpcLifecycle: (input, commandContext) => core.tickNpcLifecycle(input, commandContext),
    tickOrganizationPolitics: (input, commandContext) => core.tickOrganizationPolitics(input, commandContext),
    tickMarketExpiry: (input, commandContext) => core.tickMarketExpiry(input, commandContext),
    tickDirectTradeExpiry: (input, commandContext) => core.tickDirectTradeExpiry(input, commandContext),
    createResourceNode: (input, commandContext) => core.createResourceNode(input, commandContext),
    settleResourceNode: (input, commandContext) => core.settleResourceNode(input, commandContext),
    createAnomalyEvent: (input, commandContext) => core.createAnomalyEvent(input, commandContext),
    createSeasonCampaign: (input, commandContext) => core.createSeasonCampaign(input, commandContext),
    settleSeasonCampaign: (input, commandContext) => core.settleSeasonCampaign(input, commandContext),
    decayRegionControls: (input, commandContext) => core.decayRegionControls(input, commandContext),
    decayAbuseScores: (input, commandContext) => core.decayAbuseScores(input, commandContext),
    runServerHostedJob: () => ({
      value: undefined,
      events: [],
      projection: publicProjection(core.project()),
    }),
    settlePartyRun: (input, commandContext) => core.settlePartyRun(input, commandContext),
  });

  const result = maintenanceRuntime.run({
    idempotencyKey: "runtime-party-maintenance",
    npcLimit: 1,
    marketLimit: 1,
    directTradeLimit: 1,
    partyRunSettlementLimit: 1,
    resourceNodeSettlementLimit: 0,
    seasonSettlementLimit: 0,
    serverHostedJobLimit: 0,
    regionControlDecayLimit: 0,
    abuseDecayLimit: 0,
  });

  assert.equal(result.value.partyRuns.settled, 1);
  assert.equal(result.value.partyRuns.skipped, 0);
  assert.ok(result.events.some((event) => event.eventType === "party_run_settled"));
  assert.ok(result.events.some((event) => event.eventType === "resource_granted"));
  assert.equal(core.project().partyRuns[created.value.partyRunId]?.status, "settled");
  assert.equal(
    result.events.find((event) => event.eventType === "party_run_settled")?.idempotencyKey,
    `maintenance:maintenance_runtime-party-maintenance:party-run-settle:${maintenanceIdSegmentForTest(created.value.partyRunId)}`,
  );
});

test("epoch maintenance tick advances NPC lifecycle and expires stale market orders through canonical events", async () => {
  const time = mutableClock("2026-06-25T00:00:00.000Z");
  const runtime = createAgentWorldRuntime({
    epoch: {
      clock: time.clock,
      idFactory: createSequentialEpochIdFactory("maintenance_tick"),
      operatorKey: "maintenance-market-expiry-key",
    },
  });
  const persisted: { fileName: string; record: unknown }[] = [];
  const persistJsonl = async (fileName: string, record: unknown) => {
    persisted.push({ fileName, record });
  };
  const sellerRecoveryCode = recoveryCode("explorer_maintenance_seller", "local_maintenance_secret");

  const identity = runtime.epochIdentity({
    explorerId: "explorer_maintenance_seller",
    recoveryCode: sellerRecoveryCode,
    identityName: "维护卖家",
    idempotencyKey: "maintenance-identity-1",
  });
  assert.ok("value" in identity);
  const agentId = identity.value.agentId;
  runtime.epochNpcNote({
    agentId,
    explorerId: "explorer_maintenance_seller",
    recoveryCode: sellerRecoveryCode,
    displayName: "Maintenance Clerk",
    regionId: "region_maintenance",
    traits: ["scheduled"],
    idempotencyKey: "maintenance-npc-1",
  });
  runtime.epochSetDowntime({
    agentId,
    mode: "meditation",
    recoveryCode: sellerRecoveryCode,
    idempotencyKey: "maintenance-downtime-1",
  });
  time.set("2026-06-25T00:10:01.000Z");
  runtime.epochClaimDowntime({
    agentId,
    recoveryCode: sellerRecoveryCode,
    idempotencyKey: "maintenance-claim-1",
  });
  runtime.epochCreateMarketOrder({
    sellerAgentId: agentId,
    sellResourceId: "focus",
    sellAmount: 1,
    priceResourceId: "coin",
    priceAmount: 5,
    recoveryCode: sellerRecoveryCode,
    idempotencyKey: "maintenance-order-1",
  });

  time.set("2026-06-25T00:12:00.000Z");
  const summary = await runEpochMaintenanceTick({
    runtime,
    persistJsonl,
    now: time.now,
    config: {
      enabled: true,
      intervalMs: 5_000,
      npcRegionId: "region_maintenance",
      npcLimit: 2,
      marketMaxAgeSeconds: 30,
      marketLimit: 5,
      resourceNodeRegionIds: [],
      resourceNodeLimit: 0,
      runOnStart: false,
      operatorKey: "maintenance-market-expiry-key",
    },
  });

  assert.ok(summary.npc.events >= 10);
  assert.equal(summary.market.events, 2);
  assert.equal(summary.persistedEvents, summary.npc.events + summary.market.events);
  assert.ok(persisted.every((entry) => entry.fileName === "epoch-events.jsonl"));
  assert.ok(persisted.some((entry) => ((entry.record as { event?: { eventType?: string } }).event?.eventType) === "npc_lifecycle_recorded"));
  assert.ok(persisted.some((entry) => ((entry.record as { event?: { eventType?: string } }).event?.eventType) === "npc_asset_changed"));
  assert.ok(persisted.some((entry) => ((entry.record as { event?: { eventType?: string } }).event?.eventType) === "npc_relationship_recorded"));
  assert.ok(persisted.some((entry) => ((entry.record as { event?: { payload?: { kind?: string } } }).event?.payload?.kind) === "mentor"));
  assert.ok(persisted.some((entry) => ((entry.record as { event?: { payload?: { kind?: string } } }).event?.payload?.kind) === "creditor"));
  assert.ok(persisted.some((entry) => ((entry.record as { event?: { eventType?: string } }).event?.eventType) === "market_order_expired"));
  assert.equal(runtime.epochRegionInfo({ regionId: "region_maintenance" }).npcs[0].lifecycle.length, 1);
  assert.equal(runtime.epochMarket({ status: "expired" }).orders[0].status, "expired");
});

test("epoch maintenance tick expires stale direct trades through canonical events", async () => {
  const time = mutableClock("2026-06-25T00:00:00.000Z");
  const proposerSecret = "local_maintenance_direct_trade_proposer_secret";
  const counterpartySecret = "local_maintenance_direct_trade_counterparty_secret";
  const proposerExplorerId = "explorer_maintenance_direct_trade_proposer";
  const counterpartyExplorerId = "explorer_maintenance_direct_trade_counterparty";
  const seedCore = createEpochGameCore({
    clock: time.clock,
    idFactory: createSequentialEpochIdFactory("maintenance_direct_trade_seed"),
  });
  const proposer = seedCore.issueIdentity({
    explorerId: proposerExplorerId,
    explorerSecretHash: explorerSecretHash(proposerExplorerId, proposerSecret),
    identityName: "维护直交易发起者",
  }, {
    actorExplorerId: proposerExplorerId,
    trustClass: "untrusted_client" as const,
    causationId: "maintenance_direct_trade_proposer_issue",
    correlationId: "maintenance_direct_trade",
  });
  const counterparty = seedCore.issueIdentity({
    explorerId: counterpartyExplorerId,
    explorerSecretHash: explorerSecretHash(counterpartyExplorerId, counterpartySecret),
    identityName: "维护直交易接受者",
  }, {
    actorExplorerId: counterpartyExplorerId,
    trustClass: "untrusted_client" as const,
    causationId: "maintenance_direct_trade_counterparty_issue",
    correlationId: "maintenance_direct_trade",
  });
  seedCore.grantResource({
    agentId: proposer.value.agentId,
    resourceId: "aether",
    amount: 4,
    reason: "maintenance_direct_trade_seed",
  }, {
    actorExplorerId: "system",
    trustClass: "system_worker" as const,
    causationId: "maintenance_direct_trade_aether_seed",
    correlationId: "maintenance_direct_trade",
  });
  const runtime = createAgentWorldRuntime({
    epochEvents: [...seedCore.project().events],
    epoch: {
      clock: time.clock,
      idFactory: createSequentialEpochIdFactory("maintenance_direct_trade_runtime"),
      operatorKey: "maintenance-direct-trade-expiry-key",
    },
  });
  const persisted: { fileName: string; record: unknown }[] = [];
  const persistJsonl = async (fileName: string, record: unknown) => {
    persisted.push({ fileName, record });
  };

  const created = runtime.epochCreateDirectTrade({
    proposerAgentId: proposer.value.agentId,
    counterpartyAgentId: counterparty.value.agentId,
    regionId: "region_gray_harbor",
    offerResourceId: "aether",
    offerAmount: 2,
    requestResourceId: "coin",
    requestAmount: 7,
    recoveryCode: recoveryCode(proposerExplorerId, proposerSecret),
    idempotencyKey: "maintenance-create-direct-trade-1",
  });
  assert.equal(created.value.status, "open");
  assert.equal(runtime.epochProgress({ agentId: proposer.value.agentId }).resources.aether, 2);

  time.set("2026-06-25T00:02:00.000Z");
  const summary = await runEpochMaintenanceTick({
    runtime,
    persistJsonl,
    now: time.now,
    config: {
      enabled: true,
      intervalMs: 5_000,
      npcLimit: 1,
      marketMaxAgeSeconds: 60,
      marketLimit: 1,
      directTradeMaxAgeSeconds: 60,
      directTradeLimit: 5,
      resourceNodeRegionIds: [],
      resourceNodeLimit: 0,
      runOnStart: false,
      operatorKey: "maintenance-direct-trade-expiry-key",
    },
  });

  assert.equal(summary.market.events, 2);
  assert.equal(summary.persistedEvents, 2);
  assert.ok(persisted.every((entry) => entry.fileName === "epoch-events.jsonl"));
  assert.ok(persisted.some((entry) => ((entry.record as { event?: { eventType?: string } }).event?.eventType) === "resource_granted"));
  assert.ok(persisted.some((entry) => ((entry.record as { event?: { eventType?: string } }).event?.eventType) === "direct_trade_expired"));
  assert.equal(runtime.epochDirectTrades({ status: "expired" }).trades[0].tradeId, created.value.tradeId);
  assert.equal(runtime.epochProgress({ agentId: proposer.value.agentId }).resources.aether, 4);
});

test("epoch maintenance tick starts and settles mature seasons through canonical events", async () => {
  const time = mutableClock("2026-06-25T00:00:00.000Z");
  const runtime = createAgentWorldRuntime({
    epoch: {
      clock: time.clock,
      idFactory: createSequentialEpochIdFactory("maintenance_season"),
      operatorKey: "maintenance-season-key",
    },
  });
  const persisted: { fileName: string; record: unknown }[] = [];
  const persistJsonl = async (fileName: string, record: unknown) => {
    persisted.push({ fileName, record });
  };
  const recovery = recoveryCode("explorer_maintenance_season", "local_maintenance_season_secret");
  const identity = runtime.epochIdentity({
    explorerId: "explorer_maintenance_season",
    recoveryCode: recovery,
    identityName: "维护赛季巡礼者",
    idempotencyKey: "maintenance-season-identity-1",
  });
  assert.ok("value" in identity);
  runtime.epochSetDowntime({
    agentId: identity.value.agentId,
    mode: "slacking",
    recoveryCode: recovery,
    idempotencyKey: "maintenance-season-downtime-1",
  });
  time.set("2026-06-25T03:15:01.000Z");
  runtime.epochClaimDowntime({
    agentId: identity.value.agentId,
    recoveryCode: recovery,
    idempotencyKey: "maintenance-season-claim-1",
  });

  const baseConfig = {
    enabled: true,
    intervalMs: 5_000,
    npcRegionId: "region_without_maintenance_npc",
    npcLimit: 1,
    marketMaxAgeSeconds: 30,
    marketLimit: 1,
    resourceNodeRegionIds: [],
    resourceNodeLimit: 0,
    anomalyRegionIds: [],
    anomalyLimit: 0,
    runOnStart: false,
    operatorKey: "maintenance-season-key",
  };
  const started = await runEpochMaintenanceTick({
    runtime,
    persistJsonl,
    now: time.now,
    config: {
      ...baseConfig,
      seasonRegionIds: ["region_gray_harbor"],
      seasonLimit: 1,
      seasonKey: "gray_harbor_faction_season",
      seasonSettlementLimit: 0,
    },
  });
  assert.equal(started.seasons.started, 1);
  assert.equal(started.seasons.settled, 0);
  assert.ok(persisted.some((entry) => ((entry.record as { event?: { eventType?: string } }).event?.eventType) === "season_campaign_created"));
  const season = runtime.epochSeasons({ regionId: "region_gray_harbor" }).seasons[0];
  assert.equal(season.status, "active");

  const contributed = runtime.epochContributeSeason({
    seasonId: season.seasonId,
    agentId: identity.value.agentId,
    factionId: "gray_watch",
    amount: 12,
    recoveryCode: recovery,
    idempotencyKey: "maintenance-season-contribute-1",
  });
  assert.equal(contributed.value.totalScore, 12);

  time.set("2026-06-25T04:00:00.000Z");
  const settled = await runEpochMaintenanceTick({
    runtime,
    persistJsonl,
    now: time.now,
    config: {
      ...baseConfig,
      seasonRegionIds: [],
      seasonLimit: 0,
      seasonSettlementLimit: 3,
    },
  });
  assert.equal(settled.seasons.started, 0);
  assert.equal(settled.seasons.settled, 1);
  assert.ok(persisted.some((entry) => ((entry.record as { event?: { eventType?: string } }).event?.eventType) === "season_campaign_resolved"));
  assert.ok(persisted.some((entry) => ((entry.record as { event?: { eventType?: string } }).event?.eventType) === "season_resolved"));
  assert.equal(runtime.epochSeasons({ regionId: "region_gray_harbor" }).seasons[0].status, "resolved");
});

test("epoch maintenance tick decays stale region control through scheduled config", async () => {
  const time = mutableClock("2026-06-25T00:00:00.000Z");
  const runtime = createAgentWorldRuntime({
    epoch: {
      clock: time.clock,
      idFactory: createSequentialEpochIdFactory("maintenance_region_control_decay"),
      operatorKey: "maintenance-region-control-decay-key",
    },
  });
  const persisted: { fileName: string; record: unknown }[] = [];
  const persistJsonl = async (fileName: string, record: unknown) => {
    persisted.push({ fileName, record });
  };
  const recovery = recoveryCode("explorer_maintenance_region_control_decay", "local_maintenance_region_control_decay_secret");
  const identity = runtime.epochIdentity({
    explorerId: "explorer_maintenance_region_control_decay",
    recoveryCode: recovery,
    identityName: "维护控制衰减巡礼者",
    idempotencyKey: "maintenance-region-control-decay-identity-1",
  });
  assert.ok("value" in identity);
  runtime.epochSetDowntime({
    agentId: identity.value.agentId,
    mode: "slacking",
    recoveryCode: recovery,
    idempotencyKey: "maintenance-region-control-decay-downtime-1",
  });
  time.set("2026-06-25T03:15:01.000Z");
  runtime.epochClaimDowntime({
    agentId: identity.value.agentId,
    recoveryCode: recovery,
    idempotencyKey: "maintenance-region-control-decay-claim-1",
  });

  const baseConfig = {
    enabled: true,
    intervalMs: 5_000,
    npcRegionId: "region_without_maintenance_npc",
    npcLimit: 1,
    marketMaxAgeSeconds: 30,
    marketLimit: 1,
    resourceNodeRegionIds: [],
    resourceNodeLimit: 0,
    anomalyRegionIds: [],
    anomalyLimit: 0,
    runOnStart: false,
    operatorKey: "maintenance-region-control-decay-key",
  };
  const started = await runEpochMaintenanceTick({
    runtime,
    persistJsonl,
    now: time.now,
    config: {
      ...baseConfig,
      seasonRegionIds: ["region_gray_harbor"],
      seasonLimit: 1,
      seasonKey: "gray_harbor_faction_season",
      seasonSettlementLimit: 0,
    },
  });
  assert.equal(started.seasons.started, 1);
  const season = runtime.epochSeasons({ regionId: "region_gray_harbor" }).seasons[0];
  assert.equal(season.status, "active");

  const contributed = runtime.epochContributeSeason({
    seasonId: season.seasonId,
    agentId: identity.value.agentId,
    factionId: "gray_watch",
    amount: 12,
    recoveryCode: recovery,
    idempotencyKey: "maintenance-region-control-decay-contribute-1",
  });
  assert.equal(contributed.value.totalScore, 12);

  time.set("2026-06-25T04:00:00.000Z");
  const settled = await runEpochMaintenanceTick({
    runtime,
    persistJsonl,
    now: time.now,
    config: {
      ...baseConfig,
      seasonRegionIds: [],
      seasonLimit: 0,
      seasonSettlementLimit: 3,
    },
  });
  assert.equal(settled.seasons.settled, 1);
  const controlBeforeDecay = runtime.epochRegionInfo({ regionId: "region_gray_harbor" }).regionControl;
  assert.equal(controlBeforeDecay?.controllingFactionId, "gray_watch");
  assert.equal(controlBeforeDecay?.controlScore, 12);

  time.set("2026-06-27T04:00:00.000Z");
  const decayed = await runEpochMaintenanceTick({
    runtime,
    persistJsonl,
    now: time.now,
    config: {
      ...baseConfig,
      seasonRegionIds: [],
      seasonLimit: 0,
      seasonSettlementLimit: 0,
      regionControlDecayLimit: 5,
      regionControlDecayAmount: 2,
      regionControlDecayMinAgeSeconds: 24 * 60 * 60,
    },
  });

  assert.equal(decayed.regionControls.decayed, 1);
  assert.equal(decayed.regionControls.events, 1);
  assert.ok(persisted.some((entry) => ((entry.record as { event?: { eventType?: string } }).event?.eventType) === "region_control_decayed"));
  const controlAfterDecay = runtime.epochRegionInfo({ regionId: "region_gray_harbor" }).regionControl;
  assert.equal(controlAfterDecay?.controllingFactionId, "gray_watch");
  assert.equal(controlAfterDecay?.controlScore, 10);
  assert.equal(controlAfterDecay?.controlMargin, 10);
});

test("epoch maintenance scheduler registers no timer unless enabled", () => {
  let scheduled = 0;
  const runtime = createAgentWorldRuntime();
  const disabled = startEpochMaintenanceScheduler({
    runtime,
    config: { ...epochMaintenanceConfigFromEnv({}), enabled: false },
    setIntervalFn: () => {
      scheduled += 1;
      return 1;
    },
    clearIntervalFn: () => undefined,
  });

  assert.equal(disabled.enabled, false);
  assert.equal(scheduled, 0);

  const enabled = startEpochMaintenanceScheduler({
    runtime,
    config: {
      enabled: true,
      intervalMs: 10_000,
      npcLimit: 1,
      marketMaxAgeSeconds: 60,
      marketLimit: 1,
      resourceNodeRegionIds: [],
      resourceNodeLimit: 0,
      runOnStart: false,
    },
    setIntervalFn: (_handler, intervalMs) => {
      scheduled += intervalMs;
      return 2;
    },
    clearIntervalFn: () => undefined,
  });

  assert.equal(enabled.enabled, true);
  assert.equal(scheduled, 10_000);
  enabled.stop();
});

test("epoch maintenance scheduler exposes live status for deployment health", async () => {
  let scheduled = 0;
  const time = mutableClock("2026-06-25T00:00:00.000Z");
  const runtime = createAgentWorldRuntime({
    epoch: {
      clock: time.clock,
      idFactory: createSequentialEpochIdFactory("maintenance_status"),
      operatorKey: "maintenance-status-key",
    },
  });
  const scheduler = startEpochMaintenanceScheduler({
    runtime,
    now: time.now,
    config: {
      enabled: true,
      intervalMs: 10_000,
      npcLimit: 1,
      marketMaxAgeSeconds: 60,
      marketLimit: 1,
      resourceNodeRegionIds: [],
      resourceNodeLimit: 0,
      runOnStart: false,
      operatorKey: "maintenance-status-key",
    },
    setIntervalFn: (_handler, intervalMs) => {
      scheduled += intervalMs;
      return 3;
    },
    clearIntervalFn: () => undefined,
  });

  assert.equal(scheduler.status().enabled, true);
  assert.equal(scheduler.status().intervalMs, 10_000);
  assert.equal(scheduler.status().inFlight, false);
  assert.equal(scheduler.status().lastSuccessAt, undefined);
  assert.equal(scheduled, 10_000);

  const summary = await scheduler.runOnce();
  const status = scheduler.status();
  assert.equal(status.lastStartedAt, "2026-06-25T00:00:00.000Z");
  assert.equal(status.lastFinishedAt, "2026-06-25T00:00:00.000Z");
  assert.equal(status.lastSuccessAt, "2026-06-25T00:00:00.000Z");
  assert.equal(status.lastErrorAt, undefined);
  assert.equal(status.lastError, undefined);
  assert.equal(status.lastSummary?.tickId, summary.tickId);
  assert.equal(status.lastSummary?.persistedEvents, 0);
  scheduler.stop();
});

test("epoch maintenance scheduler records the last deployment-visible error", async () => {
  const time = mutableClock("2026-06-25T00:00:00.000Z");
  const runtime = createAgentWorldRuntime();
  const scheduler = startEpochMaintenanceScheduler({
    runtime,
    now: time.now,
    config: {
      enabled: true,
      intervalMs: 10_000,
      npcLimit: 1,
      marketMaxAgeSeconds: 60,
      marketLimit: 1,
      resourceNodeRegionIds: ["region_gray_harbor"],
      resourceNodeLimit: 1,
      runOnStart: false,
    },
    setIntervalFn: () => 4,
    clearIntervalFn: () => undefined,
  });

  await assert.rejects(() => scheduler.runOnce(), /operator_key_required/);
  const status = scheduler.status();
  assert.equal(status.lastStartedAt, "2026-06-25T00:00:00.000Z");
  assert.equal(status.lastFinishedAt, "2026-06-25T00:00:00.000Z");
  assert.equal(status.lastSuccessAt, undefined);
  assert.equal(status.lastErrorAt, "2026-06-25T00:00:00.000Z");
  assert.equal(status.lastError, "operator_key_required");
  assert.equal(status.inFlight, false);
  scheduler.stop();
});
