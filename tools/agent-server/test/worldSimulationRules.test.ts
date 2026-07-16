import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { epochEventsForPersistence } from "../lib/epoch/runtimePublicProjectionRules.ts";
import { loadDefaultWorldContentRegistry } from "../lib/epoch/worldContentRegistry.ts";
import type { WorldContentRegistry } from "../lib/epoch/worldContentRegistry.ts";
import {
  createEpochWorldSimulationRuntime,
  EPOCH_WORLD_COMMODITY_IDS,
  EPOCH_WORLD_FLOW_SHIPMENT_SAMPLE_LIMIT,
  projectEpochWorldSimulation,
  worldSimulationView,
} from "../lib/epoch/worldSimulationRules.ts";

function fixtureWithRegistry(
  registry: WorldContentRegistry,
  initialEvents: Readonly<ReturnType<ReturnType<typeof createEpochWorldSimulationRuntime>["events"]>> = [],
  checkpointInterval = 96,
) {
  let sequence = 0;
  return createEpochWorldSimulationRuntime({
    registry,
    initialEvents,
    idFactory: (kind) => `${kind}_world_simulation_test_${++sequence}`,
    nowReal: () => "2026-07-15T12:00:00.000Z",
    checkpointInterval,
  });
}

function fixture(
  initialEvents: Readonly<ReturnType<ReturnType<typeof createEpochWorldSimulationRuntime>["events"]>> = [],
  checkpointInterval = 96,
) {
  return fixtureWithRegistry(loadDefaultWorldContentRegistry(), initialEvents, checkpointInterval);
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) =>
      `${JSON.stringify(key)}:${stableJson(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function legacySnapshotWithoutEmbeddedWorldTables(
  snapshot: ReturnType<ReturnType<typeof createEpochWorldSimulationRuntime>["status"]>,
) {
  const {
    routes: _routes,
    conflicts: _conflicts,
    stateHash: _stateHash,
    lastEventId: _lastEventId,
    lastAdvancedAt: _lastAdvancedAt,
    ...legacy
  } = snapshot;
  return {
    ...legacy,
    stateHash: `sha256:${createHash("sha256").update(stableJson(legacy)).digest("hex")}`,
  } as unknown as typeof snapshot;
}

function materialState(
  snapshot: ReturnType<ReturnType<typeof createEpochWorldSimulationRuntime>["status"]>,
) {
  const {
    version: _version,
    stateHash: _stateHash,
    lastEventId: _lastEventId,
    lastAdvancedAt: _lastAdvancedAt,
    ...state
  } = snapshot;
  return state;
}

test("compiled faction baselines preserve the published institution population", () => {
  const registry = loadDefaultWorldContentRegistry();
  const wanji = registry.factions.find((faction) => faction.id === "faction_wanji_talisman");
  const blackBook = registry.factions.find((faction) => faction.id === "faction_black_book");
  const consortium = registry.factions.find((faction) => faction.id === "faction_cyber_industrial_consortium");
  assert.deepEqual(
    wanji && [wanji.coreMemberBaseline, wanji.affiliatedPopulationBaseline],
    [2_400, 6_000],
  );
  assert.equal(blackBook?.coreMemberBaseline, 600);
  assert.equal(consortium?.coreMemberBaseline, 80_000);
});

test("WorldTick initializes material ledgers and conserves commodities and coin", () => {
  const runtime = fixture();
  const advanced = runtime.advance({
    fromWorldMinute: 0,
    toWorldMinute: 1_440,
    sourceClockEventId: "event_clock_day_1",
    sourceEventIds: ["event_maintenance_day_1"],
    signals: { regions: [] },
    idempotencyKey: "simulation-day-1",
  });
  assert.deepEqual(advanced.events.map((event) => event.eventType), [
    "world_simulation_initialized",
    "world_simulation_advanced",
  ]);
  assert.equal(advanced.simulation.regions.length, 25);
  assert.equal(advanced.simulation.factions.length, 18);
  assert.equal(advanced.simulation.worldMinute, 1_440);
  assert.ok(advanced.simulation.shipments.length > 0);
  assert.ok((advanced.flows?.departedShipmentCount || 0) > 0);
  assert.equal(advanced.flows?.departedShipments.length, EPOCH_WORLD_FLOW_SHIPMENT_SAMPLE_LIMIT);
  assert.equal(advanced.flows?.shipmentSamplesTruncated, true);
  assert.ok((advanced.flows?.tradeCoinTransferred || 0) > 0);
  const initialized = advanced.events[0];
  assert.equal(initialized?.eventType, "world_simulation_initialized");
  if (initialized?.eventType !== "world_simulation_initialized") return;
  for (const commodityId of EPOCH_WORLD_COMMODITY_IDS) {
    assert.equal(
      advanced.simulation.commodityTotals[commodityId],
      initialized.payload.snapshot.commodityTotals[commodityId]
        + (advanced.flows?.produced[commodityId] || 0)
        - (advanced.flows?.consumed[commodityId] || 0)
        - (advanced.flows?.lost[commodityId] || 0),
    );
  }
  assert.match(advanced.flows?.departedShipmentsHash || "", /^sha256:[a-f0-9]{64}$/u);
  const initialRegionCoin = initialized.payload.snapshot.regions.reduce(
    (total, region) => total + region.treasuryCoin,
    0,
  );
  assert.equal(
    advanced.simulation.regions.reduce((total, region) => total + region.treasuryCoin, 0),
    initialRegionCoin
      - (advanced.flows?.factionTaxCoinTransferred || 0)
      + (advanced.flows?.factionSubsidyCoinTransferred || 0),
  );
  assert.ok((advanced.flows?.factionTaxCoinTransferred || 0) >= 0);
  assert.ok((advanced.flows?.factionSubsidyCoinTransferred || 0) >= 0);
  assert.equal(
    advanced.simulation.factions.reduce((total, faction) => total + faction.treasuryCoin, 0),
    initialized.payload.snapshot.factions.reduce((total, faction) => total + faction.treasuryCoin, 0)
      + (advanced.flows?.factionTaxCoinTransferred || 0)
      - (advanced.flows?.factionSubsidyCoinTransferred || 0),
  );
  assert.equal(advanced.simulation.totalCoin, initialized.payload.snapshot.totalCoin);
  assert.equal(epochEventsForPersistence(advanced).length, 2);
});

test("shipments take route time, conflict consumes supplies without declaring a random war, and replay is exact", () => {
  const runtime = fixture();
  const first = runtime.advance({
    fromWorldMinute: 0,
    toWorldMinute: 1_440,
    sourceClockEventId: "event_clock_day_1",
    signals: { regions: [] },
    idempotencyKey: "simulation-day-1",
  });
  assert.ok(first.simulation.shipments.every((shipment) =>
    shipment.arrivesWorldMinute > shipment.departedWorldMinute));
  const second = runtime.advance({
    fromWorldMinute: 1_440,
    toWorldMinute: 2_880,
    sourceClockEventId: "event_clock_day_2",
    signals: {
      regions: [{
        regionId: "region_forest",
        controllerFactionId: "faction_hundred_forms",
        conflictFactionIds: ["faction_hundred_forms", "faction_ash_alchemy"],
        contestedResourceNodes: 2,
      }],
    },
    idempotencyKey: "simulation-day-2",
  });
  assert.ok((second.flows?.arrivedShipmentCount || 0) > 0);
  const forest = second.simulation.regions.find((region) => region.regionId === "region_forest");
  assert.ok((forest?.conflictPressureBps || 0) >= 7_000);
  assert.equal(
    second.simulation.factions.find((faction) => faction.factionId === "faction_hundred_forms")?.status,
    "conflict_engaged",
  );
  assert.ok(second.simulation.factions.every((faction) => !Object.hasOwn(faction, "warDeclared")));

  const duplicate = runtime.advance({
    fromWorldMinute: 1_440,
    toWorldMinute: 2_880,
    sourceClockEventId: "event_clock_day_2",
    signals: {
      regions: [{
        regionId: "region_forest",
        controllerFactionId: "faction_hundred_forms",
        conflictFactionIds: ["faction_ash_alchemy", "faction_hundred_forms"],
        contestedResourceNodes: 2,
      }],
    },
    idempotencyKey: "simulation-day-2",
  });
  assert.equal(duplicate.duplicate, true);
  assert.equal(duplicate.events.length, 0);
  assert.equal(duplicate.simulation.stateHash, second.simulation.stateHash);

  const restored = fixture(runtime.events());
  assert.deepEqual(restored.status(), second.simulation);
  assert.deepEqual(
    projectEpochWorldSimulation(runtime.events(), loadDefaultWorldContentRegistry()),
    second.simulation,
  );
});

test("structured server evidence escalates hostilities into war and resolves after evidence decays", () => {
  const runtime = fixture();
  runtime.advance({
    fromWorldMinute: 0,
    toWorldMinute: 1_440,
    sourceClockEventId: "event_clock_conflict_baseline",
    signals: { regions: [] },
    idempotencyKey: "simulation-conflict-baseline",
  });
  const conflictSignal = {
    regions: [{
      regionId: "region_forest",
      conflictEvidence: [{
        evidenceId: "region-control-contest-forest",
        cause: "region_control_contest" as const,
        factionIds: ["faction_ash_alchemy", "faction_hundred_forms"],
        pressureBps: 6_000,
      }],
    }],
  };
  const hostilities = runtime.advance({
    fromWorldMinute: 1_440,
    toWorldMinute: 2_880,
    sourceClockEventId: "event_clock_conflict_hostilities",
    signals: conflictSignal,
    idempotencyKey: "simulation-conflict-hostilities",
  });
  assert.equal(hostilities.simulation.conflicts.length, 1);
  assert.equal(hostilities.simulation.conflicts[0]?.phase, "war");
  assert.equal(hostilities.simulation.conflicts[0]?.intensityBps, 9_000);
  assert.deepEqual(hostilities.simulation.conflicts[0]?.causes, ["region_control_contest"]);

  const war = runtime.advance({
    fromWorldMinute: 2_880,
    toWorldMinute: 4_320,
    sourceClockEventId: "event_clock_conflict_war",
    signals: conflictSignal,
    idempotencyKey: "simulation-conflict-war",
  });
  assert.equal(war.simulation.conflicts[0]?.phase, "war");
  assert.equal(war.simulation.conflicts[0]?.intensityBps, 10_000);
  assert.equal(
    war.simulation.factions.find((faction) => faction.factionId === "faction_hundred_forms")?.status,
    "conflict_engaged",
  );

  const resolved = runtime.advance({
    fromWorldMinute: 4_320,
    toWorldMinute: 18_720,
    sourceClockEventId: "event_clock_conflict_decay",
    signals: { regions: [] },
    idempotencyKey: "simulation-conflict-decay",
  });
  assert.equal(resolved.simulation.conflicts.length, 0);
  assert.ok(resolved.flows && !resolved.flows.conflictRegionIds.includes("region_forest"));
});

test("WorldTick persists deterministic deltas and emits full snapshots only at checkpoint boundaries", () => {
  const runtime = fixture([], 3);
  const first = runtime.advance({
    fromWorldMinute: 0,
    toWorldMinute: 60,
    sourceClockEventId: "event_clock_incremental_1",
    signals: { regions: [] },
    idempotencyKey: "simulation-incremental-1",
  });
  const firstAdvanced = first.events.find((event) => event.eventType === "world_simulation_advanced");
  const initialized = first.events.find((event) => event.eventType === "world_simulation_initialized");
  assert.ok(firstAdvanced && initialized);
  if (firstAdvanced?.eventType !== "world_simulation_advanced"
    || initialized?.eventType !== "world_simulation_initialized") return;
  assert.equal(firstAdvanced.payload.checkpoint, false);
  assert.equal(firstAdvanced.payload.snapshot, undefined);
  assert.ok(firstAdvanced.payload.signals);
  assert.equal(firstAdvanced.payload.nextStateHash, first.simulation.stateHash);
  assert.ok(JSON.stringify(firstAdvanced).length < JSON.stringify(initialized).length / 2);

  const second = runtime.advance({
    fromWorldMinute: 60,
    toWorldMinute: 120,
    sourceClockEventId: "event_clock_incremental_2",
    signals: { regions: [] },
    idempotencyKey: "simulation-incremental-2",
  });
  const checkpoint = second.events.find((event) => event.eventType === "world_simulation_advanced");
  assert.equal(checkpoint?.eventType, "world_simulation_advanced");
  if (checkpoint?.eventType !== "world_simulation_advanced") return;
  assert.equal(checkpoint.payload.checkpoint, true);
  assert.equal(checkpoint.payload.snapshot?.stateHash, second.simulation.stateHash);
  assert.deepEqual(fixture(runtime.events(), 3).status(), second.simulation);

  const tamperedEvents = structuredClone(runtime.events());
  const tampered = tamperedEvents.find((event) =>
    event.eventType === "world_simulation_advanced" && event.payload.signals);
  assert.equal(tampered?.eventType, "world_simulation_advanced");
  if (tampered?.eventType !== "world_simulation_advanced" || !tampered.payload.signals) return;
  Object.assign(tampered.payload, {
    signals: {
      regions: [{
        regionId: "region_forest",
        conflictFactionIds: ["faction_ash_alchemy", "faction_hundred_forms"],
        conflictEvidence: [{
          evidenceId: "tampered-conflict-evidence",
          cause: "raid",
          factionIds: ["faction_ash_alchemy", "faction_hundred_forms"],
          pressureBps: 10_000,
        }],
        anomalyPressureBps: 10_000,
        contestedResourceNodes: 0,
        openMarketOrders: 0,
        civicSupportBps: 0,
      }],
    },
  });
  assert.throws(
    () => projectEpochWorldSimulation(tamperedEvents, loadDefaultWorldContentRegistry()),
    /world_simulation_event_command_hash_invalid/u,
  );
});

test("canonical material state is invariant to command partitioning and keeps flow events bounded", () => {
  const signals = {
    regions: [{
      regionId: "region_forest",
      controllerFactionId: "faction_hundred_forms",
      conflictEvidence: [{
        evidenceId: "partition-invariant-resource-contest",
        cause: "resource_contest" as const,
        factionIds: ["faction_ash_alchemy", "faction_hundred_forms"],
        pressureBps: 5_500,
      }],
      anomalyPressureBps: 250,
      contestedResourceNodes: 2,
      openMarketOrders: 12,
      civicSupportBps: 800,
    }],
  };
  const singleRuntime = fixture();
  const single = singleRuntime.advance({
    fromWorldMinute: 0,
    toWorldMinute: 1_440,
    sourceClockEventId: "event_clock_partition_single",
    signals,
    idempotencyKey: "simulation-partition-single",
  });
  const partitionedRuntime = fixture();
  for (let fromWorldMinute = 0; fromWorldMinute < 1_440; fromWorldMinute += 15) {
    partitionedRuntime.advance({
      fromWorldMinute,
      toWorldMinute: fromWorldMinute + 15,
      sourceClockEventId: `event_clock_partition_${fromWorldMinute}`,
      signals,
      idempotencyKey: `simulation-partition-${fromWorldMinute}`,
    });
  }
  assert.deepEqual(materialState(partitionedRuntime.status()), materialState(single.simulation));
  assert.equal(single.simulation.materializedWorldMinute, 1_440);
  assert.ok((single.flows?.departedShipmentCount || 0) > EPOCH_WORLD_FLOW_SHIPMENT_SAMPLE_LIMIT);
  assert.equal(single.flows?.departedShipments.length, EPOCH_WORLD_FLOW_SHIPMENT_SAMPLE_LIMIT);
  assert.equal(single.flows?.shipmentSamplesTruncated, true);
  const advancedEvent = single.events.find((event) => event.eventType === "world_simulation_advanced");
  assert.ok(advancedEvent && JSON.stringify(advancedEvent.payload.flows).length < 50_000);
  assert.equal(advancedEvent?.eventType === "world_simulation_advanced"
    && advancedEvent.payload.checkpoint, true);
  assert.deepEqual(fixture(partitionedRuntime.events()).status(), partitionedRuntime.status());
});

test("sub-quantum clock advances retain an explicit materialization cursor", () => {
  const direct = fixture().advance({
    fromWorldMinute: 0,
    toWorldMinute: 15,
    sourceClockEventId: "event_clock_quantum_direct",
    signals: { regions: [] },
    idempotencyKey: "simulation-quantum-direct",
  }).simulation;
  const splitRuntime = fixture();
  const residual = splitRuntime.advance({
    fromWorldMinute: 0,
    toWorldMinute: 7,
    sourceClockEventId: "event_clock_quantum_residual",
    signals: { regions: [] },
    idempotencyKey: "simulation-quantum-residual",
  }).simulation;
  assert.equal(residual.worldMinute, 7);
  assert.equal(residual.materializedWorldMinute, 0);
  assert.equal(worldSimulationView(residual).pendingMaterializationWorldMinutes, 7);
  const settled = splitRuntime.advance({
    fromWorldMinute: 7,
    toWorldMinute: 15,
    sourceClockEventId: "event_clock_quantum_settle",
    signals: { regions: [] },
    idempotencyKey: "simulation-quantum-settle",
  }).simulation;
  assert.deepEqual(materialState(settled), materialState(direct));
  assert.equal(settled.materializedWorldMinute, 15);
});

test("maximum bounded WorldTick settles thirty game days with a periodic checkpoint and exact replay", () => {
  const runtime = fixture();
  const result = runtime.advance({
    fromWorldMinute: 0,
    toWorldMinute: 30 * 24 * 60,
    sourceClockEventId: "event_clock_maximum_bounded_tick",
    signals: { regions: [] },
    idempotencyKey: "simulation-maximum-bounded-tick",
  });
  assert.equal(result.simulation.worldMinute, 43_200);
  assert.equal(result.simulation.materializedWorldMinute, 43_200);
  assert.ok(result.simulation.regions.every((region) =>
    EPOCH_WORLD_COMMODITY_IDS.every((commodityId) => region.stocks[commodityId] >= 0)));
  assert.ok((result.flows?.departedShipmentCount || 0) >= result.flows!.departedShipments.length);
  assert.ok(result.flows!.departedShipments.length <= EPOCH_WORLD_FLOW_SHIPMENT_SAMPLE_LIMIT);
  assert.ok(JSON.stringify(result.flows).length < 50_000);
  const advancedEvent = result.events.find((event) => event.eventType === "world_simulation_advanced");
  assert.equal(advancedEvent?.eventType === "world_simulation_advanced"
    && advancedEvent.payload.checkpoint, true);
  assert.equal(advancedEvent?.eventType === "world_simulation_advanced"
    && advancedEvent.payload.snapshot?.stateHash, result.simulation.stateHash);
  assert.deepEqual(
    projectEpochWorldSimulation(runtime.events(), loadDefaultWorldContentRegistry()),
    result.simulation,
  );
});

test("canonical open market orders moderate price extremes without minting currency", () => {
  const withoutMarket = fixture().advance({
    fromWorldMinute: 0,
    toWorldMinute: 1_440,
    sourceClockEventId: "event_clock_market_control",
    signals: { regions: [] },
    idempotencyKey: "simulation-market-control",
  }).simulation;
  const regionId = withoutMarket.regions[0]?.regionId;
  assert.ok(regionId);

  const withMarket = fixture().advance({
    fromWorldMinute: 0,
    toWorldMinute: 1_440,
    sourceClockEventId: "event_clock_market_liquidity",
    signals: { regions: [{ regionId, openMarketOrders: 20 }] },
    idempotencyKey: "simulation-market-liquidity",
  }).simulation;
  const controlRegion = withoutMarket.regions.find((region) => region.regionId === regionId);
  const marketRegion = withMarket.regions.find((region) => region.regionId === regionId);
  assert.ok(controlRegion && marketRegion);
  const basePrices = {
    food: 1_000,
    water: 400,
    medicine: 4_000,
    materials: 1_800,
    fuel: 2_200,
    aether: 10_000,
  } as const;
  assert.ok(EPOCH_WORLD_COMMODITY_IDS.some((commodityId) =>
    Math.abs(marketRegion.priceMilliCoin[commodityId] - basePrices[commodityId])
      < Math.abs(controlRegion.priceMilliCoin[commodityId] - basePrices[commodityId])));
  assert.equal(withMarket.totalCoin, withoutMarket.totalCoin);
});

test("recent server-settled Journey service improves shared regional indicators without minting assets", () => {
  const control = fixture().advance({
    fromWorldMinute: 0,
    toWorldMinute: 1_440,
    sourceClockEventId: "event_clock_journey_impact_control",
    signals: { regions: [] },
    idempotencyKey: "simulation-journey-impact-control",
  }).simulation;
  const regionId = "region_quantum_laboratory";
  const supported = fixture().advance({
    fromWorldMinute: 0,
    toWorldMinute: 1_440,
    sourceClockEventId: "event_clock_journey_impact_supported",
    signals: { regions: [{ regionId, civicSupportBps: 2_000 }] },
    idempotencyKey: "simulation-journey-impact-supported",
  }).simulation;
  const controlRegion = control.regions.find((region) => region.regionId === regionId);
  const supportedRegion = supported.regions.find((region) => region.regionId === regionId);
  assert.ok(controlRegion && supportedRegion);
  assert.ok(supportedRegion.publicHealthBps > controlRegion.publicHealthBps);
  assert.ok(supportedRegion.securityBps > controlRegion.securityBps);
  assert.ok(supportedRegion.unrestBps < controlRegion.unrestBps);
  assert.deepEqual(supported.commodityTotals, control.commodityTotals);
  assert.equal(supported.totalCoin, control.totalCoin);
});

test("historical state remains readable after a content release but new ticks require an explicit migration", () => {
  const original = fixture();
  const advanced = original.advance({
    fromWorldMinute: 0,
    toWorldMinute: 15,
    sourceClockEventId: "event_clock_before_content_release",
    signals: { regions: [] },
    idempotencyKey: "simulation-before-content-release",
  });
  const currentRegistry = loadDefaultWorldContentRegistry();
  const nextRegistry = {
    ...currentRegistry,
    sourceHash: `sha256:${"f".repeat(64)}` as `sha256:${string}`,
  };
  const restored = createEpochWorldSimulationRuntime({
    registry: nextRegistry,
    initialEvents: original.events(),
  });
  assert.equal(restored.status().stateHash, advanced.simulation.stateHash);
  assert.equal(restored.status().worldContentSourceHash, currentRegistry.sourceHash);
  assert.throws(() => restored.advance({
    fromWorldMinute: 15,
    toWorldMinute: 30,
    sourceClockEventId: "event_clock_after_content_release",
    signals: { regions: [] },
    idempotencyKey: "simulation-after-content-release",
  }), /world_simulation_content_migration_required/u);
});

test("pre-route and pre-conflict snapshots remain readable and migrate without clearing event history", () => {
  const originalRegistry = loadDefaultWorldContentRegistry();
  const original = fixtureWithRegistry(originalRegistry);
  const advanced = original.advance({
    fromWorldMinute: 0,
    toWorldMinute: 60,
    sourceClockEventId: "event_clock_legacy_snapshot",
    signals: { regions: [] },
    idempotencyKey: "simulation-legacy-snapshot",
  });
  const initializedEvent = advanced.events.find((event) => event.eventType === "world_simulation_initialized");
  const advancedEvent = advanced.events.find((event) => event.eventType === "world_simulation_advanced");
  assert.equal(initializedEvent?.eventType, "world_simulation_initialized");
  assert.equal(advancedEvent?.eventType, "world_simulation_advanced");
  if (initializedEvent?.eventType !== "world_simulation_initialized"
    || advancedEvent?.eventType !== "world_simulation_advanced") return;
  const legacyInitialized = legacySnapshotWithoutEmbeddedWorldTables(initializedEvent.payload.snapshot);
  const legacyAdvanced = legacySnapshotWithoutEmbeddedWorldTables(advanced.simulation);
  const legacyEvents = [{
    ...initializedEvent,
    payload: {
      ...initializedEvent.payload,
      ruleVersion: "world-simulation.v1",
      snapshot: legacyInitialized,
    },
  }, {
    ...advancedEvent,
    payload: {
      ...advancedEvent.payload,
      ruleVersion: "world-simulation.v1",
      previousStateHash: legacyInitialized.stateHash,
      signals: undefined,
      snapshot: legacyAdvanced,
    },
  }] as typeof advanced.events;
  const nextRegistry: WorldContentRegistry = {
    ...originalRegistry,
    sourceHash: `sha256:${"b".repeat(64)}`,
  };
  const restored = fixtureWithRegistry(nextRegistry, legacyEvents);
  assert.equal(restored.status().worldMinute, 60);
  assert.equal(restored.status().worldContentSourceHash, originalRegistry.sourceHash);
  const migrated = restored.migrateContent({ idempotencyKey: "simulation-legacy-content-migration" });
  assert.equal(migrated.simulation.worldContentSourceHash, nextRegistry.sourceHash);
  assert.equal(migrated.simulation.routes.length, nextRegistry.routes.length);
  assert.deepEqual(migrated.simulation.conflicts, []);
});

test("content migration audits genesis resources and permits deterministic ticks on the new release", () => {
  const originalRegistry = loadDefaultWorldContentRegistry();
  const original = fixtureWithRegistry(originalRegistry);
  const before = original.advance({
    fromWorldMinute: 0,
    toWorldMinute: 60,
    sourceClockEventId: "event_clock_before_additive_migration",
    signals: { regions: [] },
    idempotencyKey: "simulation-before-additive-migration",
  }).simulation;
  const sourcePlace = originalRegistry.places[0]!;
  const sourceFaction = originalRegistry.factions[0]!;
  const newPlace = {
    ...sourcePlace,
    id: "region_migration_new",
    label: "迁移新城",
    jurisdictionIds: ["faction_migration_new"],
  } as const;
  const newFaction = {
    ...sourceFaction,
    id: "faction_migration_new",
    label: "迁移新势力",
    coreMemberBaseline: 120,
    affiliatedPopulationBaseline: 360,
  } as const;
  const nextRegistry: WorldContentRegistry = {
    ...originalRegistry,
    sourceHash: `sha256:${"e".repeat(64)}`,
    places: [...originalRegistry.places, newPlace],
    factions: [...originalRegistry.factions, newFaction],
    routes: [...originalRegistry.routes, {
      id: "route_migration_new",
      from: originalRegistry.places[1]!.id,
      to: newPlace.id,
      mode: ["road"],
      baseMinutes: 90,
      bidirectional: true,
    }],
    counts: {
      ...originalRegistry.counts,
      places: originalRegistry.counts.places + 1,
      factions: originalRegistry.counts.factions + 1,
      routes: originalRegistry.counts.routes + 1,
    },
  };
  const runtime = fixtureWithRegistry(nextRegistry, original.events());
  const migrated = runtime.migrateContent({
    idempotencyKey: "simulation-additive-content-migration",
  });
  assert.equal(migrated.events[0]?.eventType, "world_simulation_content_migrated");
  assert.equal(migrated.simulation.worldContentSourceHash, nextRegistry.sourceHash);
  assert.equal(migrated.simulation.regions.length, before.regions.length + 1);
  assert.equal(migrated.simulation.factions.length, before.factions.length + 1);
  assert.ok(migrated.genesisCoinDelta > 0);
  for (const commodityId of EPOCH_WORLD_COMMODITY_IDS) {
    assert.equal(
      migrated.simulation.commodityTotals[commodityId] - before.commodityTotals[commodityId],
      migrated.genesisCommodityDelta[commodityId],
    );
    assert.ok(migrated.genesisReserveDelta[commodityId] >= 0);
  }
  assert.equal(migrated.simulation.totalCoin - before.totalCoin, migrated.genesisCoinDelta);

  const duplicate = runtime.migrateContent({
    idempotencyKey: "simulation-additive-content-migration",
  });
  assert.equal(duplicate.duplicate, true);
  assert.equal(duplicate.events.length, 0);
  const after = runtime.advance({
    fromWorldMinute: 60,
    toWorldMinute: 120,
    sourceClockEventId: "event_clock_after_additive_migration",
    signals: { regions: [] },
    idempotencyKey: "simulation-after-additive-migration",
  });
  assert.equal(after.simulation.worldMinute, 120);
  assert.deepEqual(fixtureWithRegistry(nextRegistry, runtime.events()).status(), after.simulation);
});

test("content migration fails closed on removals and preserves ledgers through explicit successors", () => {
  const originalRegistry = loadDefaultWorldContentRegistry();
  const original = fixtureWithRegistry(originalRegistry);
  const before = original.advance({
    fromWorldMinute: 0,
    toWorldMinute: 1_440,
    sourceClockEventId: "event_clock_before_replacement_migration",
    signals: { regions: [] },
    idempotencyKey: "simulation-before-replacement-migration",
  }).simulation;
  const removedRegionId = originalRegistry.places[0]!.id;
  const targetRegionId = originalRegistry.places[1]!.id;
  const removedFactionId = originalRegistry.factions[0]!.id;
  const targetFactionId = originalRegistry.factions[1]!.id;
  const nextRegistry: WorldContentRegistry = {
    ...originalRegistry,
    sourceHash: `sha256:${"d".repeat(64)}`,
    places: originalRegistry.places.filter((place) => place.id !== removedRegionId),
    factions: originalRegistry.factions.filter((faction) => faction.id !== removedFactionId),
    routes: originalRegistry.routes.filter((route) =>
      route.from !== removedRegionId && route.to !== removedRegionId),
    counts: {
      ...originalRegistry.counts,
      places: originalRegistry.counts.places - 1,
      factions: originalRegistry.counts.factions - 1,
      routes: originalRegistry.routes.filter((route) =>
        route.from !== removedRegionId && route.to !== removedRegionId).length,
    },
  };
  const runtime = fixtureWithRegistry(nextRegistry, original.events());
  assert.throws(() => runtime.migrateContent({
    idempotencyKey: "simulation-replacement-migration-missing-successors",
  }), /world_simulation_(?:region|faction)_successor_required/u);
  const beforeReserves = before.regions.reduce((totals, region) => {
    for (const commodityId of EPOCH_WORLD_COMMODITY_IDS) totals[commodityId] += region.reserves[commodityId];
    return totals;
  }, { food: 0, water: 0, medicine: 0, materials: 0, fuel: 0, aether: 0 });
  const migrated = runtime.migrateContent({
    regionSuccessors: { [removedRegionId]: targetRegionId },
    factionSuccessors: { [removedFactionId]: targetFactionId },
    idempotencyKey: "simulation-replacement-migration",
  });
  assert.equal(migrated.genesisCoinDelta, 0);
  assert.deepEqual(migrated.genesisCommodityDelta, {
    food: 0, water: 0, medicine: 0, materials: 0, fuel: 0, aether: 0,
  });
  assert.deepEqual(migrated.genesisReserveDelta, migrated.genesisCommodityDelta);
  assert.equal(migrated.simulation.totalCoin, before.totalCoin);
  assert.ok(!migrated.simulation.regions.some((region) => region.regionId === removedRegionId));
  assert.ok(!migrated.simulation.factions.some((faction) => faction.factionId === removedFactionId));
  const afterReserves = migrated.simulation.regions.reduce((totals, region) => {
    for (const commodityId of EPOCH_WORLD_COMMODITY_IDS) totals[commodityId] += region.reserves[commodityId];
    return totals;
  }, { food: 0, water: 0, medicine: 0, materials: 0, fuel: 0, aether: 0 });
  assert.deepEqual(afterReserves, beforeReserves);
  assert.deepEqual(
    projectEpochWorldSimulation(runtime.events(), nextRegistry),
    migrated.simulation,
  );
});
