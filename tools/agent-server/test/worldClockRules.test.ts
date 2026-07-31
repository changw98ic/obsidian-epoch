import assert from "node:assert/strict";
import test from "node:test";

import { epochEventsForPersistence } from "../lib/epoch/runtimePublicProjectionRules.ts";
import { createAgentWorldMcpRuntime } from "../lib/mcpTools.ts";
import { createAgentWorldRuntime } from "../lib/mcpRuntimeCore.ts";
import { createSequentialEpochIdFactory } from "../lib/epoch/protocol.ts";
import { loadDefaultWorldContentRegistry } from "../lib/epoch/worldContentRegistry.ts";
import {
  createEpochWorldClockRuntime,
  EPOCH_WORLD_CLOCK_RULE_VERSION,
  EPOCH_WORLD_CLOCK_SPEED_RATIO,
  EPOCH_TIMELINE_CYCLE_REAL_MINUTES,
  EPOCH_TIMELINE_CYCLE_WORLD_MINUTES,
  epochTimelineCycleState,
  projectEpochWorldClock,
  type CreateEpochWorldClockRuntimeOptions,
} from "../lib/epoch/worldClockRules.ts";

function mutableServerClock(start = "2026-07-15T12:00:00.000Z") {
  let nowMs = Date.parse(start);
  return {
    nowReal: () => new Date(nowMs).toISOString(),
    advanceWorldMinutes: (worldMinutes: number) => {
      nowMs += Math.ceil(worldMinutes * 60_000 / EPOCH_WORLD_CLOCK_SPEED_RATIO);
    },
  };
}

function fixture(initialEvents: CreateEpochWorldClockRuntimeOptions["initialEvents"] = []) {
  let sequence = 0;
  return createEpochWorldClockRuntime({
    initialEvents,
    idFactory: (kind) => `${kind}_clock_test_${++sequence}`,
    nowReal: () => "2026-07-15T12:00:00.000Z",
  });
}

test("world clock starts at black-calendar minute zero and exposes the 60-year cycle", () => {
  const clock = fixture();
  assert.equal(clock.status().initialized, false);
  assert.equal(clock.status().worldMinute, 0);
  assert.equal(clock.status().worldTime, "2026-01-01T00:00:00.000Z");
  assert.equal(clock.status().displayTime, "黑曜历1年初火月1日00:00");
  assert.equal(clock.status().speedRatio, 1_440);
  assert.equal(EPOCH_TIMELINE_CYCLE_REAL_MINUTES, 15 * 24 * 60);
  assert.equal(EPOCH_TIMELINE_CYCLE_WORLD_MINUTES, 60 * 360 * 24 * 60);
  assert.equal(epochTimelineCycleState(EPOCH_TIMELINE_CYCLE_WORLD_MINUTES).index, 2);
  assert.equal(clock.status().ruleVersion, EPOCH_WORLD_CLOCK_RULE_VERSION);
});

test("one real server minute derives exactly one black-calendar day", () => {
  const serverClock = mutableServerClock();
  const clock = createEpochWorldClockRuntime({ nowReal: serverClock.nowReal });
  serverClock.advanceWorldMinutes(1_440);
  const synchronized = clock.sync({
    reason: "one_real_minute_probe",
    processedDomains: ["world_simulation"],
    idempotencyKey: "one-real-minute-probe",
  });
  assert.equal(synchronized.clock.worldMinute, 1_440);
  assert.equal(synchronized.clock.persistedWorldMinute, 1_440);
  assert.equal(synchronized.clock.displayTime, "黑曜历1年初火月2日00:00");
  assert.equal(synchronized.clock.pendingCatchUpWorldMinutes, 0);
});

test("bounded WorldTick initializes, advances, persists and replays", () => {
  const clock = fixture();
  const advanced = clock.advance({
    elapsedWorldMinutes: 90,
    reason: "journey_action:calibrate_experiment",
    processedDomains: ["journey", "needs"],
    sourceEventIds: ["event_hosted_action_1"],
    idempotencyKey: "clock-advance-1",
  });
  assert.equal(advanced.duplicate, false);
  assert.equal(advanced.events.length, 2);
  assert.deepEqual(advanced.events.map((event) => event.eventType), [
    "world_clock_initialized",
    "world_clock_advanced",
  ]);
  assert.equal(advanced.clock.worldMinute, 90);
  assert.equal(advanced.clock.displayTime, "黑曜历1年初火月1日01:30");
  assert.equal(epochEventsForPersistence(advanced).length, 2);

  const restored = fixture(advanced.events);
  assert.deepEqual(restored.status(), advanced.clock);
  assert.equal(projectEpochWorldClock(advanced.events).worldMinute, advanced.clock.worldMinute);
});

test("WorldTick idempotency blocks duplicate time and conflicting reuse", () => {
  const clock = fixture();
  const input = {
    elapsedWorldMinutes: 15,
    reason: "maintenance_tick",
    processedDomains: ["economy"],
    idempotencyKey: "clock-idempotent",
  } as const;
  clock.advance(input);
  clock.advance({
    elapsedWorldMinutes: 30,
    reason: "later_tick",
    processedDomains: ["economy"],
    idempotencyKey: "clock-later",
  });
  const duplicate = clock.advance(input);
  assert.equal(duplicate.duplicate, true);
  assert.equal(duplicate.events.length, 0);
  assert.equal(duplicate.clock.worldMinute, 15);
  assert.equal(clock.status().worldMinute, 45);
  const restored = fixture(clock.events());
  assert.equal(restored.advance(input).clock.worldMinute, 15);
  assert.equal(restored.status().worldMinute, 45);
  assert.throws(() => clock.advance({ ...input, elapsedWorldMinutes: 30 }), /idempotency_key_conflict/u);
});

test("WorldTick rejects unbounded or causally empty advances", () => {
  const clock = fixture();
  assert.throws(() => clock.advance({
    elapsedWorldMinutes: 0,
    reason: "invalid",
    processedDomains: ["journey"],
    idempotencyKey: "invalid-zero",
  }), /world_clock_elapsed_minutes_invalid/u);
  assert.throws(() => clock.advance({
    elapsedWorldMinutes: 15,
    reason: "invalid",
    processedDomains: [],
    idempotencyKey: "invalid-domain",
  }), /world_clock_processed_domains_required/u);
});

test("agent runtime exposes, authorizes and restores the canonical world clock", () => {
  let sequence = 0;
  const serverClock = mutableServerClock();
  const options = {
    epoch: { operatorKey: "world-clock-operator" },
    worldClock: {
      idFactory: (kind: "event" | "command" | "correlation" | "aggregate") =>
        `${kind}_runtime_clock_${++sequence}`,
      nowReal: serverClock.nowReal,
    },
  };
  const runtime = createAgentWorldRuntime(options);
  assert.equal(runtime.epochWorldClock().worldMinute, 0);
  assert.throws(() => runtime.epochAdvanceWorldClock({
    operatorKey: "wrong",
    elapsedWorldMinutes: 30,
    reason: "test",
    processedDomains: ["journey"],
    idempotencyKey: "runtime-clock-unauthorized",
  }), /operator_key_required/u);

  serverClock.advanceWorldMinutes(30);
  const advanced = runtime.epochAdvanceWorldClock({
    operatorKey: "world-clock-operator",
    elapsedWorldMinutes: 43_200,
    reason: "test_runtime_tick",
    processedDomains: ["journey", "needs"],
    idempotencyKey: "runtime-clock-advance",
  });
  const events = epochEventsForPersistence(advanced);
  assert.equal(events.length, 4);
  assert.equal(runtime.epochWorldClock().worldMinute, 30);
  const clockAdvancedEvent = events.find((event) => event.eventType === "world_clock_advanced");
  assert.deepEqual(
    runtime.epochEvents({ eventType: "world_clock_advanced" }).events.map((event) => event.eventId),
    [clockAdvancedEvent?.eventId],
  );

  const restored = createAgentWorldRuntime({ ...options, epochEvents: events });
  assert.equal(restored.epochWorldClock().worldMinute, 30);
  assert.equal(restored.epochWorldClock().displayTime, "黑曜历1年初火月1日00:30");
  assert.equal(restored.epochWorldState().worldMinute, 30);
  assert.equal(restored.epochWorldState().counts.regions, 25);
});

test("coordinated WorldTick rolls both aggregates back when canonical batch ingestion fails", () => {
  const serverClock = mutableServerClock();
  const runtime = createAgentWorldRuntime({
    epoch: { operatorKey: "world-clock-atomic-operator" },
    worldClock: {
      idFactory: () => "event_world_tick_collision",
      nowReal: serverClock.nowReal,
    },
  });
  serverClock.advanceWorldMinutes(15);
  assert.throws(() => runtime.epochAdvanceWorldClock({
    operatorKey: "world-clock-atomic-operator",
    elapsedWorldMinutes: 15,
    reason: "atomicity_failure_probe",
    processedDomains: ["economy"],
    idempotencyKey: "runtime-clock-atomicity",
  }), /epoch_event_id_conflict:event_world_tick_collision/u);
  assert.equal(runtime.epochWorldClock().initialized, false);
  assert.equal(runtime.epochWorldClock().worldMinute, 15);
  assert.equal(runtime.epochWorldClock().persistedWorldMinute, 0);
  assert.equal(runtime.epochWorldClock().pendingCatchUpWorldMinutes, 15);
  assert.equal(runtime.epochWorldState().initialized, false);
  assert.equal(runtime.epochWorldState().worldMinute, 0);
  assert.equal(runtime.epochEvents({ eventType: "world_clock_advanced" }).events.length, 0);
  assert.equal(runtime.epochEvents({ eventType: "world_simulation_advanced" }).events.length, 0);
});

test("content migration rolls the simulation aggregate back when canonical ingestion fails", () => {
  const serverClock = mutableServerClock();
  const base = createAgentWorldRuntime({
    epoch: { operatorKey: "migration-atomic-operator" },
    worldClock: { nowReal: serverClock.nowReal },
  });
  serverClock.advanceWorldMinutes(15);
  const advanced = base.epochAdvanceWorldClock({
    operatorKey: "migration-atomic-operator",
    elapsedWorldMinutes: 15,
    reason: "migration_atomicity_baseline",
    processedDomains: ["world_simulation"],
    idempotencyKey: "migration-atomicity-baseline",
  });
  const events = epochEventsForPersistence(advanced);
  const collisionEventId = events[0]?.eventId;
  assert.ok(collisionEventId);
  const nextRegistry = {
    ...loadDefaultWorldContentRegistry(),
    sourceHash: `sha256:${"a".repeat(64)}` as `sha256:${string}`,
  };
  const runtime = createAgentWorldRuntime({
    epoch: { operatorKey: "migration-atomic-operator" },
    epochEvents: events,
    worldContentRegistry: nextRegistry,
    worldSimulation: { idFactory: () => collisionEventId },
  });
  const before = runtime.epochWorldState();
  assert.throws(() => runtime.epochMigrateWorldContent({
    operatorKey: "migration-atomic-operator",
    idempotencyKey: "migration-atomicity-failure",
  }), /epoch_event_id_conflict/u);
  const after = runtime.epochWorldState();
  assert.equal(after.stateHash, before.stateHash);
  assert.equal(after.worldContentSourceHash, before.worldContentSourceHash);
  assert.equal(
    runtime.epochEvents({ eventType: "world_simulation_content_migrated" }).events.length,
    0,
  );
});

test("world overview and region info expose the same compiled authority snapshot", () => {
  const runtime = createAgentWorldRuntime();
  const overview = runtime.epochWorldOverview();
  assert.ok("counts" in overview.worldContent);
  assert.equal(overview.worldContent.counts?.places, 25);
  assert.equal(overview.worldContent.counts?.rules, 21);
  const content = runtime.epochWorldContent({ collection: "places", id: "region_reflective_city" });
  assert.equal(content.total, 1);
  const region = runtime.epochRegionInfo({ regionId: "region_reflective_city" }) as ReturnType<typeof runtime.epochRegionInfo> & {
    readonly canonicalContent?: { readonly place: { readonly id: string } };
    readonly worldContentSourceHash?: string;
  };
  assert.equal(region.canonicalContent?.place.id, "region_reflective_city");
  assert.equal(region.worldContentSourceHash, overview.worldContent.sourceHash);
});

test("MCP exposes canonical content and operator-gated WorldTick tools", async () => {
  const serverClock = mutableServerClock();
  const mcp = createAgentWorldMcpRuntime({
    epoch: { operatorKey: "mcp-clock-operator" },
    worldClock: { nowReal: serverClock.nowReal },
  });
  const names = mcp.listTools().map((tool) => tool.name);
  assert.ok(names.includes("obsidian_epoch.world_clock"));
  assert.ok(names.includes("obsidian_epoch.world_state"));
  assert.ok(names.includes("obsidian_epoch.world_content"));
  assert.ok(names.includes("obsidian_epoch.advance_world_clock"));
  assert.ok(names.includes("obsidian_epoch.migrate_world_content"));

  const contentResult = await mcp.callTool("obsidian_epoch.world_content", {
    collection: "systems",
    id: "system_cultivation",
  });
  const content = JSON.parse(contentResult.content[0]?.text || "null") as {
    readonly total: number;
    readonly items: readonly { readonly id: string }[];
  };
  assert.equal(content.total, 1);
  assert.equal(content.items[0]?.id, "system_cultivation");

  serverClock.advanceWorldMinutes(60);
  const advanceResult = await mcp.callTool("obsidian_epoch.advance_world_clock", {
    operatorKey: "mcp-clock-operator",
    elapsedWorldMinutes: 60,
    reason: "mcp_test_tick",
    processedDomains: ["economy"],
    idempotencyKey: "mcp-clock-tick-1",
  });
  const advanced = JSON.parse(advanceResult.content[0]?.text || "null") as {
    readonly clock: { readonly worldMinute: number };
  };
  assert.equal(advanced.clock.worldMinute, 60);
  assert.deepEqual(advanceResult.events.map((event) => event.eventType), [
    "world_clock_initialized",
    "world_clock_advanced",
    "world_simulation_initialized",
    "world_simulation_advanced",
  ]);
  const worldStateResult = await mcp.callTool("obsidian_epoch.world_state", {
    regionId: "region_reflective_city",
    includeShipments: true,
  });
  const worldState = JSON.parse(worldStateResult.content[0]?.text || "null") as {
    readonly initialized: boolean;
    readonly regions: readonly { readonly regionId: string }[];
  };
  assert.equal(worldState.initialized, true);
  assert.equal(worldState.regions[0]?.regionId, "region_reflective_city");

  const nextRegistry = {
    ...loadDefaultWorldContentRegistry(),
    sourceHash: `sha256:${"c".repeat(64)}` as `sha256:${string}`,
  };
  const migratingMcp = createAgentWorldMcpRuntime({
    epoch: { operatorKey: "mcp-clock-operator" },
    epochEvents: advanceResult.events,
    worldContentRegistry: nextRegistry,
  });
  await assert.rejects(() => migratingMcp.callTool("obsidian_epoch.migrate_world_content", {
    operatorKey: "wrong",
    idempotencyKey: "mcp-content-migration-unauthorized",
  }), /operator_key_required/u);
  const migrationResult = await migratingMcp.callTool("obsidian_epoch.migrate_world_content", {
    operatorKey: "mcp-clock-operator",
    idempotencyKey: "mcp-content-migration-1",
  });
  const migration = JSON.parse(migrationResult.content[0]?.text || "null") as {
    readonly simulation: { readonly worldContentSourceHash: string };
    readonly duplicate: boolean;
  };
  assert.equal(migration.duplicate, false);
  assert.equal(migration.simulation.worldContentSourceHash, nextRegistry.sourceHash);
  assert.deepEqual(migrationResult.events.map((event) => event.eventType), [
    "world_simulation_content_migrated",
  ]);
});

test("canonical faction campaigns feed explicit conflict evidence without title keyword inference", () => {
  const serverClock = mutableServerClock();
  const runtime = createAgentWorldRuntime({
    epoch: { operatorKey: "canonical-conflict-operator" },
    worldClock: { nowReal: serverClock.nowReal },
  });
  runtime.epochSeedSeason({
    operatorKey: "canonical-conflict-operator",
    regionId: "region_forest",
    factionIds: ["faction_ash_alchemy", "faction_hundred_forms"],
    idempotencyKey: "canonical-conflict-season",
  });
  serverClock.advanceWorldMinutes(1_440);
  const advanced = runtime.epochAdvanceWorldClock({
    operatorKey: "canonical-conflict-operator",
    elapsedWorldMinutes: 1_440,
    reason: "canonical_conflict_campaign_tick",
    processedDomains: ["factions", "world_events"],
    idempotencyKey: "canonical-conflict-world-tick",
  });
  const conflict = advanced.worldSimulation.conflicts.find((candidate) =>
    candidate.regionId === "region_forest");
  assert.ok(conflict);
  assert.deepEqual(conflict.factionIds, ["faction_ash_alchemy", "faction_hundred_forms"]);
  assert.deepEqual(conflict.causes, ["faction_campaign"]);
  assert.equal(conflict.phase, "tension");
});

test("canonical game time drives and replays agent and NPC needs plus life goals", () => {
  let sequence = 0;
  const serverClock = mutableServerClock();
  const options = {
    epoch: {
      operatorKey: "actor-needs-operator",
      idFactory: createSequentialEpochIdFactory("actor_needs_clock"),
      clock: () => new Date("2026-07-15T12:00:00.000Z"),
    },
    worldClock: {
      idFactory: (kind: string) => `${kind}_actor_needs_clock_${++sequence}`,
      nowReal: serverClock.nowReal,
    },
  };
  const runtime = createAgentWorldRuntime(options);
  const explorerId = "explorer_actor_needs_clock";
  const recoveryCode = Buffer.from(JSON.stringify({
    explorerId,
    localSecret: "actor-needs-secret",
  }), "utf8").toString("base64");
  const issued = runtime.epochIdentity({
    explorerId,
    recoveryCode,
    identityName: "量子实验室见习研究员",
    idempotencyKey: "actor-needs-identity",
  }) as ReturnType<typeof runtime.epochIdentity> & {
    readonly value: { readonly agentId: string };
  };
  const agentId = issued.value.agentId;
  const noted = runtime.epochNpcNote({
    agentId,
    recoveryCode,
    displayName: "白塔实验记录员",
    regionId: "region_quantum_laboratory",
    traits: ["研究", "记录"],
    idempotencyKey: "actor-needs-npc",
  }) as ReturnType<typeof runtime.epochNpcNote> & {
    readonly value: { readonly npcId: string };
  };
  const npcId = noted.value.npcId;

  const initialBriefing = runtime.epochAgentBriefing({ agentId, recoveryCode });
  assert.equal(initialBriefing.needs?.lastWorldMinute, 0);
  assert.equal(initialBriefing.lifeGoal?.category, "learning");
  serverClock.advanceWorldMinutes(1_440);
  const advanced = runtime.epochAdvanceWorldClock({
    operatorKey: "actor-needs-operator",
    elapsedWorldMinutes: 1_440,
    reason: "actor_needs_daily_cycle",
    processedDomains: ["needs", "economy", "npc_lifecycle"],
    idempotencyKey: "actor-needs-day-one",
  });
  const clockEvent = advanced.events.find((event) => event.eventType === "world_clock_advanced");
  assert.ok(clockEvent);

  const briefing = runtime.epochAgentBriefing({ agentId, recoveryCode });
  assert.equal(briefing.needs?.lastWorldMinute, 1_440);
  assert.equal(briefing.needs?.sourceEventId, clockEvent.eventId);
  assert.equal(briefing.needs?.recentActions.length, 6);
  assert.ok((briefing.lifeGoal?.progressBps || 0) > 0);
  assert.equal(briefing.lifeGoal?.updatedWorldMinute, 1_440);
  const npcInfo = runtime.epochNpcInfo({ npcId });
  assert.equal(npcInfo.npc?.needs?.lastWorldMinute, 1_440);
  assert.equal(npcInfo.npc?.needs?.sourceEventId, clockEvent.eventId);
  assert.equal(npcInfo.npc?.lifeGoal?.category, "learning");
  assert.ok((npcInfo.npc?.lifeGoal?.progressBps || 0) > 0);

  const persistedEvents = [
    ...epochEventsForPersistence(issued),
    ...epochEventsForPersistence(noted),
    ...epochEventsForPersistence(advanced),
  ];
  const restored = createAgentWorldRuntime({ ...options, epochEvents: persistedEvents });
  assert.deepEqual(restored.epochAgentBriefing({ agentId, recoveryCode }).needs, briefing.needs);
  assert.deepEqual(restored.epochAgentBriefing({ agentId, recoveryCode }).lifeGoal, briefing.lifeGoal);
  assert.deepEqual(restored.epochNpcInfo({ npcId }).npc?.needs, npcInfo.npc?.needs);
  assert.deepEqual(restored.epochNpcInfo({ npcId }).npc?.lifeGoal, npcInfo.npc?.lifeGoal);
});

test("a mirror Journey objective stays isolated from the shared world before main-line solidification", async () => {
  const serverClock = mutableServerClock();
  const mcp = createAgentWorldMcpRuntime({
    epoch: {
      operatorKey: "journey-world-impact-operator",
      idFactory: createSequentialEpochIdFactory("journey_world_impact_clock"),
      clock: () => new Date("2026-07-15T12:00:00.000Z"),
    },
    worldClock: { nowReal: serverClock.nowReal },
  });
  const explorerId = "explorer_journey_world_impact_clock";
  const recoveryCode = Buffer.from(JSON.stringify({
    explorerId,
    localSecret: "journey-world-impact-secret",
  }), "utf8").toString("base64");
  const identityResult = await mcp.callTool("obsidian_epoch.identity", {
    explorerId,
    recoveryCode,
    identityName: "实验室协作员",
    idempotencyKey: "journey-world-impact-identity",
  });
  const identity = JSON.parse(identityResult.content[0]?.text || "null") as {
    readonly value: { readonly agentId: string };
  };
  const preparedResult = await mcp.callTool("obsidian_epoch.prepare_journey", {
    agentId: identity.value.agentId,
    destinationRegionId: "region_quantum_laboratory",
    taskType: "辅助完成一次实验",
    recoveryCode,
    idempotencyKey: "journey-world-impact-prepare",
  });
  const prepared = JSON.parse(preparedResult.content[0]?.text || "null") as {
    readonly journey: { readonly journeyId: string; readonly version: number };
  };
  serverClock.advanceWorldMinutes(8 * 60);
  const startedResult = await mcp.callTool("obsidian_epoch.start_journey", {
    journeyId: prepared.journey.journeyId,
    expectedVersion: prepared.journey.version,
    taskGenerationMode: "server_fallback",
    recoveryCode,
    idempotencyKey: "journey-world-impact-start",
  });
  const started = JSON.parse(startedResult.content[0]?.text || "null") as {
    readonly journey: {
      readonly journeyId: string;
      readonly version: number;
      readonly worldSlice: { readonly authority: string; readonly sliceHash: string };
    };
  };
  assert.equal(started.journey.worldSlice.authority, "server_world_simulation");
  assert.match(started.journey.worldSlice.sliceHash, /^sha256:[0-9a-f]{64}$/u);
  const simulationEventCountAfterStart = mcp.runtime.epochEvents({
    eventType: "world_simulation_advanced",
    limit: 100,
  }).events.length;
  const proposedResult = await mcp.callTool("obsidian_epoch.propose_journey_step", {
    journeyId: started.journey.journeyId,
    expectedVersion: started.journey.version,
    recoveryCode,
    idempotencyKey: "journey-world-impact-propose",
  });
  const proposed = JSON.parse(proposedResult.content[0]?.text || "null") as {
    readonly proposal: {
      readonly episode: { readonly episodeId: string };
      readonly expectedVersion: number;
      readonly sceneContract: {
        readonly sceneId: string;
        readonly actionOptions: readonly {
          readonly actionOptionId: string;
          readonly signature: string;
          readonly risk: "low" | "medium" | "high";
        }[];
      };
    };
  };
  const selected = proposed.proposal.sceneContract.actionOptions.find((option) => option.risk === "low")
    ?? proposed.proposal.sceneContract.actionOptions[0];
  assert.ok(selected);
  await mcp.callTool("obsidian_epoch.commit_journey_action", {
    journeyId: started.journey.journeyId,
    sceneId: proposed.proposal.sceneContract.sceneId,
    episodeId: proposed.proposal.episode.episodeId,
    expectedVersion: proposed.proposal.expectedVersion,
    actionOptionId: selected.actionOptionId,
    signature: selected.signature,
    recoveryCode,
    idempotencyKey: "journey-world-impact-commit",
  });

  const simulationEvents = mcp.runtime.epochEvents({
    eventType: "world_simulation_advanced",
    limit: 100,
  }).events;
  assert.equal(simulationEvents.length, simulationEventCountAfterStart);
  const regionInfo = mcp.runtime.epochRegionInfo({ regionId: "region_quantum_laboratory" });
  const impact = regionInfo.influenceChanges.find((change) =>
    change.reason.startsWith(`journey_objective:${started.journey.journeyId}:`));
  assert.equal(impact, undefined);
  assert.equal(mcp.runtime.epochEvents({
    eventType: "journey_world_solidified",
    limit: 100,
  }).events.length, 0);
});

test("mirror Journey timestamps are randomized inside persisted history and carry a macro slice", async () => {
  let worldClockSequence = 0;
  const serverClock = mutableServerClock();
  const mcp = createAgentWorldMcpRuntime({
    epoch: {
      idFactory: createSequentialEpochIdFactory("authoritative_journey_clock"),
      clock: () => new Date("2026-07-15T12:00:00.000Z"),
    },
    worldClock: {
      idFactory: (kind: string) => `${kind}_journey_clock_${++worldClockSequence}`,
      nowReal: serverClock.nowReal,
    },
    journey: {
      now: () => "2026-07-15T12:00:00.000Z",
    },
  });
  const explorerId = "explorer_authoritative_world_clock";
  const recoveryCode = Buffer.from(JSON.stringify({ explorerId, localSecret: "world-clock-secret" }), "utf8")
    .toString("base64");
  const identityResult = await mcp.callTool("obsidian_epoch.identity", {
    explorerId,
    recoveryCode,
    identityName: "时序巡行者",
    idempotencyKey: "world-clock-identity",
  });
  const identity = JSON.parse(identityResult.content[0]?.text || "null") as {
    readonly value: { readonly agentId: string };
  };
  const preparedResult = await mcp.callTool("obsidian_epoch.prepare_journey", {
    agentId: identity.value.agentId,
    destinationRegionId: "region_quantum_laboratory",
    mandate: { objective: "协助完成一次相位实验", priorities: ["experiment_safety"] },
    recoveryCode,
    idempotencyKey: "world-clock-prepare",
  });
  const prepared = JSON.parse(preparedResult.content[0]?.text || "null") as {
    readonly journey: { readonly journeyId: string; readonly version: number };
  };
  serverClock.advanceWorldMinutes(1_440);
  const startedResult = await mcp.callTool("obsidian_epoch.start_journey", {
    journeyId: prepared.journey.journeyId,
    expectedVersion: prepared.journey.version,
    recoveryCode,
    idempotencyKey: "world-clock-start",
  });
  const started = JSON.parse(startedResult.content[0]?.text || "null") as {
    readonly journey: {
      readonly worldMode: "mirror";
      readonly startedAtWorldTime: string;
      readonly dueAtWorldTime: string;
      readonly worldSlice: { readonly authority: string; readonly sliceHash: string };
    };
  };
  const mirrorStartOffsetMs = Date.parse(started.journey.startedAtWorldTime) - Date.parse("2026-01-01T00:00:00.000Z");
  const mirrorDurationMs = Date.parse(started.journey.dueAtWorldTime) - Date.parse(started.journey.startedAtWorldTime);
  assert.equal(started.journey.worldMode, "mirror");
  assert.ok(mirrorStartOffsetMs >= 0 && mirrorStartOffsetMs < 24 * 60 * 60 * 1_000);
  assert.ok(Date.parse(started.journey.dueAtWorldTime) <= Date.parse("2026-01-02T00:00:00.000Z"));
  assert.equal(mirrorStartOffsetMs % (15 * 60 * 1_000), 0);
  assert.ok(mirrorDurationMs >= 45 * 60 * 1_000 && mirrorDurationMs <= 12 * 60 * 60 * 1_000);
  assert.equal(mirrorDurationMs % (15 * 60 * 1_000), 0);
  assert.notEqual(started.journey.startedAtWorldTime, "2026-07-15T12:00:00.000Z");
  assert.equal(started.journey.worldSlice.authority, "server_world_simulation");
  assert.match(started.journey.worldSlice.sliceHash, /^sha256:[0-9a-f]{64}$/u);
  assert.equal(startedResult.events.some((event) => event.eventType === "world_clock_advanced"), true);
  assert.equal(mcp.runtime.epochEvents({ eventType: "world_simulation_advanced", limit: 100 }).events.length, 1);

  const clockResult = await mcp.callTool("obsidian_epoch.world_clock", {});
  const clock = JSON.parse(clockResult.content[0]?.text || "null") as { readonly worldMinute: number };
  assert.equal(clock.worldMinute, 1_440);
});

test("the server freezes the historical macro slice before client task generation", async () => {
  const serverClock = mutableServerClock();
  const runtime = createAgentWorldRuntime({
    epoch: {
      idFactory: createSequentialEpochIdFactory("journey_generation_slice"),
      clock: () => new Date("2026-07-15T12:00:00.000Z"),
    },
    worldClock: { nowReal: serverClock.nowReal },
    journey: { now: () => "2026-07-15T12:00:00.000Z" },
  });
  const explorerId = "explorer_journey_generation_slice";
  const recoveryCode = Buffer.from(JSON.stringify({ explorerId, localSecret: "generation-slice-secret" }), "utf8")
    .toString("base64");
  const identity = runtime.epochIdentity({
    explorerId,
    recoveryCode,
    identityName: "历史切片校验员",
    idempotencyKey: "generation-slice-identity",
  }) as ReturnType<typeof runtime.epochIdentity> & { readonly value: { readonly agentId: string } };
  const prepared = await runtime.epochPrepareJourney({
    agentId: identity.value.agentId,
    destinationRegionId: "region_quantum_laboratory",
    taskType: "辅助完成一次实验",
    recoveryCode,
    idempotencyKey: "generation-slice-prepare",
  });
  serverClock.advanceWorldMinutes(1_440);
  const reserved = runtime.epochReserveJourneyWorldWindow({
    journeyId: prepared.journey.journeyId,
    expectedVersion: prepared.journey.version,
    recoveryCode,
    idempotencyKey: "generation-slice-start",
  });
  const context = runtime.epochJourneyTaskGenerationContext({
    journeyId: prepared.journey.journeyId,
    expectedVersion: reserved.journey.version,
    recoveryCode,
  });

  assert.equal(reserved.journey.mirrorWindow?.authority, "server_world_clock");
  assert.equal(reserved.journey.worldSlice?.authority, "server_world_simulation");
  assert.deepEqual(context.mirrorWindow, reserved.journey.mirrorWindow);
  assert.deepEqual(context.worldSlice, reserved.journey.worldSlice);
  assert.match(context.worldSlice?.sliceHash || "", /^sha256:[0-9a-f]{64}$/u);
  const started = runtime.epochStartJourneyAgentNative({
    journeyId: prepared.journey.journeyId,
    expectedVersion: reserved.journey.version,
    taskGenerationMode: "server_fallback",
    recoveryCode,
    idempotencyKey: "generation-slice-start-after-reserve",
  });
  assert.deepEqual(started.journey.mirrorWindow, reserved.journey.mirrorWindow);
  assert.deepEqual(started.journey.worldSlice, reserved.journey.worldSlice);
});
