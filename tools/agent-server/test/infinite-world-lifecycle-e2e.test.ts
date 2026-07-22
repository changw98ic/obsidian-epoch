import assert from "node:assert/strict";
import test from "node:test";

import { createCausalWorldSnapshot } from "../lib/epoch/causalWorldSnapshot.ts";
import {
  createInfiniteWorldRuntime,
  type InfiniteWorldCommandType,
  type InfiniteWorldCommandV1,
} from "../lib/epoch/infiniteWorldRuntime.ts";

const WORLD_ID = "world_lifecycle_e2e";
const NOW = "2026-07-20T00:00:00.000Z";
const ACTOR = { actorType: "system", actorId: "lifecycle_e2e" } as const;

function runtime(overrides: Partial<Parameters<typeof createInfiniteWorldRuntime>[0]> = {}) {
  let nextId = 0;
  return createInfiniteWorldRuntime({
    worldId: WORLD_ID,
    initialSnapshot: createCausalWorldSnapshot({ worldId: WORLD_ID }),
    now: () => NOW,
    nowMs: () => 20,
    idFactory: (kind) => `${kind}_${String(++nextId).padStart(4, "0")}`,
    ...overrides,
  });
}

function command(
  commandType: InfiniteWorldCommandType,
  payload: Record<string, unknown>,
  idempotencyKey: string,
  requestedWorldMinute: number,
  streamVersion = 1,
  streamType: "world" | "identity" = "world",
): InfiniteWorldCommandV1 {
  return {
    commandType,
    commandId: `cmd_${idempotencyKey}`,
    worldId: WORLD_ID,
    actor: ACTOR,
    submittedAt: NOW,
    requestedWorldMinute,
    idempotencyKey,
    expectedStreamVersions: [{ streamType, streamId: "lifecycle", expectedVersion: streamVersion }],
    authorizationRefs: ["auth:lifecycle"],
    payload: {
      streamId: "lifecycle",
      ...payload,
    },
  } as InfiniteWorldCommandV1;
}

test("resource production lifecycle commits through runtime, snapshots, and replay", async () => {
  const world = runtime();
  await world.execute(command("resource_node_register", {
    input: {
      nodeId: "node_iron_e2e",
      resourceKey: "iron_ore",
      resourceClass: "material",
      unit: "minor_unit",
      capacity: "10",
      remainingUnits: "10",
      yieldPerWorkUnit: "5",
      workerSlots: 1,
      worldTime: 1,
    },
  }, "register_node", 1, 1));
  await world.execute(command("resource_production_assign", {
    input: {
      assignmentId: "assignment_iron_e2e",
      nodeId: "node_iron_e2e",
      workerRef: "worker:one",
      targetAccountRef: "account:foundry",
      workUnits: "1",
      worldTime: 2,
      sourceEventIds: ["event:work_order"],
      authorizationRefs: ["auth:lifecycle"],
    },
  }, "assign_node", 2, 2));
  const first = await world.execute(command("resource_produce", {
    nodeId: "node_iron_e2e",
    resourceKey: "iron_ore",
    targetAccountRef: "account:foundry",
    sourceEventIds: ["event:first_shift"],
  }, "produce_first", 3, 3));
  const secondCommand = command("resource_produce", {
    nodeId: "node_iron_e2e",
    resourceKey: "iron_ore",
    targetAccountRef: "account:foundry",
    sourceEventIds: ["event:second_shift"],
  }, "produce_second", 4, 4);
  const second = await world.execute(secondCommand);
  const replayed = await world.execute(secondCommand);

  assert.equal(first.event.eventType, "resource_production_committed");
  assert.equal(second.event.payload.producedUnits, "5");
  assert.equal(replayed.replayed, true);
  assert.equal(world.snapshot().domains.resourceProductionNodes[0]?.remainingUnits, "0");
  assert.equal(world.snapshot().domains.resourceProductionNodes[0]?.depletedAtWorldTime, 4);
  assert.equal(world.snapshot().balances.byAccount["resource_node_inventory:node_iron_e2e"]?.["iron_ore:minor_unit"], "0");
  assert.equal(world.snapshot().balances.byAccount["account:foundry"]?.["iron_ore:minor_unit"], "10");

  await assert.rejects(
    () => world.execute(command("resource_produce", {
      nodeId: "node_iron_e2e",
      resourceKey: "iron_ore",
      targetAccountRef: "account:foundry",
      sourceEventIds: ["event:third_shift"],
    }, "produce_third", 5, 5)),
    /CAUSAL_SCHEMA_INVALID/,
  );

  const restored = runtime({ initialEvents: world.events() });
  assert.deepEqual(restored.snapshot().domains.resourceProductionNodes, world.snapshot().domains.resourceProductionNodes);
  assert.deepEqual(restored.snapshot().balances.byAccount, world.snapshot().balances.byAccount);
});

test("life profile create, advance, world tick scheduling, snapshot restore, and resource invariant failure", async () => {
  const world = runtime();
  await world.execute(command("life_profile_create", {
    profileId: "profile_life_e2e",
    input: lifeProfileInput({ food: 6, water: 6, money: 1000, skill_material: 8, employerMoney: 10_000 }),
  }, "life_create", 0, 1, "identity"));
  const createdSnapshot = world.snapshot();
  const advanced = await world.execute(command("life_profile_advance", {
    profileId: "profile_life_e2e",
    toWorldMinute: 1_440,
  }, "life_advance_day", 1_440, 2, "identity"));

  const state = world.snapshot().domains.lifeProfiles[0]!.state;
  assert.equal(advanced.event.eventType, "life_profile_advanced");
  assert.ok(state.resourceDeltas.some((delta) => delta.reason === "wage"));
  assert.ok(state.resourceDeltas.some((delta) => delta.reason === "tuition"));
  assert.ok(state.resourceDeltas.some((delta) => delta.reason === "study_material"));
  assert.ok(state.resourceDeltas.some((delta) => delta.reason === "eat"));
  assert.ok(state.resourceDeltas.some((delta) => delta.reason === "drink"));
  assert.ok((state.actors[0]?.skills[0]?.progressBps || 0) > 0);
  assert.ok(state.consequences.some((item) => item.kind === "resource_shortage" || item.kind === "debt"));
  assert.equal(world.snapshot().balances.byAccount["household:life:resources"]?.["food:portion"], String(state.households[0]?.resources.food));
  assert.equal(world.snapshot().balances.byAccount["household:life:resources"]?.["water:liter"], String(state.households[0]?.resources.water));

  const restored = runtime({ initialEvents: world.events() });
  assert.deepEqual(restored.snapshot().domains.lifeProfiles, world.snapshot().domains.lifeProfiles);
  assert.deepEqual(restored.snapshot().balances.byAccount, world.snapshot().balances.byAccount);

  const scheduled = runtime({
    initialSnapshot: createCausalWorldSnapshot({
      worldId: WORLD_ID,
      balances: { byAccount: world.snapshot().balances.byAccount },
      domains: world.snapshot().domains,
    }),
  });
  await scheduled.execute(command("world_tick", { currentWorldMinute: 1_440, targetWorldMinute: 1_500 }, "world_tick_life", 1_500, 1));
  assert.equal(scheduled.snapshot().domains.lifeProfiles[0]?.state.worldMinute, 1_500);

  const broken = runtime({
    initialSnapshot: createCausalWorldSnapshot({
      worldId: WORLD_ID,
      domains: {
        resourceProductionNodes: [],
        resourceProductionAssignments: [],
        lifeProfiles: createdSnapshot.domains.lifeProfiles,
      },
    }),
  });
  await assert.rejects(
    () => broken.execute(command("life_profile_advance", { profileId: "profile_life_e2e", toWorldMinute: 360 }, "life_broken_balances", 360, 1, "identity")),
    /NEGATIVE_BALANCE/,
  );
});

function lifeProfileInput(options: {
  readonly food: number;
  readonly water: number;
  readonly money: number;
  readonly skill_material: number;
  readonly employerMoney: number;
}) {
  return {
    worldMinute: 0,
    actors: [{
      actorRef: "actor:life",
      householdRef: "life",
      body: { hunger: 2000, thirst: 2000, fatigue: 6000, stress: 1000, health: 8500 },
      mind: { stress: 1000, mood: 7000, belonging: 6000, purpose: 5000 },
      work: {
        employerAccountRef: "employer:life",
        wagePerWorldMinute: 2,
        schedule: [{ startMinuteOfDay: 9 * 60, endMinuteOfDay: 17 * 60 }],
      },
      study: {
        schoolAccountRef: "school:life",
        skillRef: "skill:ledger",
        progressBpsPerWorldMinute: 4,
        tuitionPerWorldMinute: 1,
        materialPerWorldMinute: 0.05,
        schedule: [{ startMinuteOfDay: 19 * 60, endMinuteOfDay: 21 * 60 }],
      },
      sleep: { schedule: [{ startMinuteOfDay: 23 * 60, endMinuteOfDay: 7 * 60 }] },
    }],
    households: [{
      householdRef: "life",
      resourceAccountRef: "household:life:resources",
      resources: {
        money: options.money,
        food: options.food,
        water: options.water,
        skill_material: options.skill_material,
      },
    }],
    externalAccounts: {
      "employer:life": { money: options.employerMoney },
      "school:life": {},
    },
  };
}
