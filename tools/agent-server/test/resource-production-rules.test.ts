import assert from "node:assert/strict";
import test from "node:test";

import { validateCausalResourceRules } from "../lib/epoch/causalResourceRules.ts";
import {
  applyResourceProductionProposal,
  assignResourceProduction,
  emptyResourceProductionRegistry,
  produceResource,
  registerResourceProductionNode,
  replenishResourceNode,
  resourceNodeInventoryAccountRef,
  resourceProductionBalanceSnapshot,
  type ResourceProductionAssignment,
  type ResourceProductionRegistry,
} from "../lib/epoch/resourceProductionRules.ts";
import {
  CAUSAL_EVENT_SCHEMA_VERSION,
  CausalValidationError,
  type CausalActorRef,
  type CausalWorldEventV1,
} from "../lib/epoch/causalContracts.ts";

const ACTOR: CausalActorRef = { actorType: "system", actorId: "resource_production_rules_test" };
const HASH = `sha256:${"0".repeat(64)}` as const;

function registry(): ResourceProductionRegistry {
  return registerResourceProductionNode(emptyResourceProductionRegistry(), {
    nodeId: "node_iron_1",
    resourceKey: "iron_ore",
    resourceClass: "material",
    unit: "minor_unit",
    capacity: "100",
    remainingUnits: "100",
    yieldPerWorkUnit: "5",
    workerSlots: 2,
    worldTime: 10,
  });
}

function assignment(overrides: Partial<ResourceProductionAssignment> = {}): ResourceProductionAssignment {
  return assignResourceProduction(registry(), {
    assignmentId: overrides.assignmentId || "assignment_a",
    nodeId: overrides.nodeId || "node_iron_1",
    workerRef: overrides.workerRef || "worker:a",
    targetAccountRef: overrides.targetAccountRef || "account:foundry",
    workUnits: overrides.workUnits || "3",
    worldTime: overrides.assignedAtWorldTime || 12,
    sourceEventIds: overrides.sourceEventIds || ["event_assignment_a"],
    authorizationRefs: overrides.authorizationRefs || ["auth:mine"],
  });
}

test("resource production registers explicit finite node inventory", () => {
  const state = registry();
  assert.deepEqual(state.nodes.node_iron_1, {
    nodeId: "node_iron_1",
    resourceKey: "iron_ore",
    resourceClass: "material",
    unit: "minor_unit",
    capacity: "100",
    remainingUnits: "100",
    yieldPerWorkUnit: "5",
    workerSlots: 2,
    registeredAtWorldTime: 10,
    depletedAtWorldTime: undefined,
  });
  assert.equal(resourceNodeInventoryAccountRef("node_iron_1"), "resource_node_inventory:node_iron_1");
  assert.throws(() => registerResourceProductionNode(state, {
    nodeId: "node_iron_1",
    resourceKey: "iron_ore",
    resourceClass: "material",
    unit: "minor_unit",
    capacity: "100",
    yieldPerWorkUnit: "5",
    workerSlots: 2,
    worldTime: 10,
  }), CausalValidationError);
});

test("resource production deterministically assigns workers to a node", () => {
  assert.deepEqual(assignment(), assignment());
  assert.throws(() => assignResourceProduction(registry(), {
    assignmentId: "bad",
    nodeId: "node_iron_1",
    workerRef: "worker:a",
    targetAccountRef: "account:foundry",
    workUnits: "0",
    worldTime: 12,
    sourceEventIds: ["event_assignment_bad"],
  }), CausalValidationError);
});

test("resource production creates zero-sum node inventory transfer with full provenance", () => {
  const first = assignment();
  const second = assignment({
    assignmentId: "assignment_b",
    workerRef: "worker:b",
    workUnits: "2",
    sourceEventIds: ["event_assignment_b", "event_assignment_a"],
    authorizationRefs: ["auth:mine:b"],
  });
  const proposal = produceResource({
    registry: registry(),
    assignments: [second, first],
    nodeId: "node_iron_1",
    resourceKey: "iron_ore",
    targetAccountRef: "account:foundry",
    worldTime: 20,
    sourceEventIds: ["event_tick_20"],
    authorizationRefs: ["auth:tick"],
  });

  assert.equal(proposal.producedUnits, "25");
  assert.equal(proposal.workUnitsApplied, "5");
  assert.equal(proposal.node.remainingUnits, "75");
  assert.equal(proposal.node.depletedAtWorldTime, undefined);
  assert.deepEqual(proposal.assignmentIds, ["assignment_a", "assignment_b"]);
  assert.deepEqual(proposal.workerRefs, ["worker:a", "worker:b"]);
  assert.deepEqual(proposal.sourceEventIds, ["event_assignment_a", "event_assignment_b", "event_tick_20"]);
  assert.deepEqual(proposal.effects[0]?.sourceEventIds, proposal.sourceEventIds);
  assert.deepEqual(proposal.effects[0]?.authorizationRefs, ["auth:mine", "auth:mine:b", "auth:tick"]);
  assert.deepEqual(proposal.effects[0]?.after.entries, [
    { accountRef: "resource_node_inventory:node_iron_1", quantityMinor: "-25" },
    { accountRef: "account:foundry", quantityMinor: "25" },
  ]);

  const validationErrors = validateCausalResourceRules({
    event: eventFor(proposal.effects),
    policy: {
      allowedCreationSourceRefs: [],
      allowedDestructionSinkRefs: [],
    },
    balances: {
      balances: resourceProductionBalanceSnapshot(registry()),
    },
  });
  assert.deepEqual(validationErrors, []);
});

test("resource production replay is deterministic for identical inputs", () => {
  const state = registry();
  const assignments = [
    assignment({ assignmentId: "assignment_b", workerRef: "worker:b", sourceEventIds: ["event_assignment_b"] }),
    assignment({ assignmentId: "assignment_a", workerRef: "worker:a", sourceEventIds: ["event_assignment_a"] }),
  ];
  assert.deepEqual(
    produceResource({
      registry: state,
      assignments,
      nodeId: "node_iron_1",
      resourceKey: "iron_ore",
      targetAccountRef: "account:foundry",
      worldTime: 20,
      sourceEventIds: ["event_tick_20"],
    }),
    produceResource({
      registry: state,
      assignments: [...assignments].reverse(),
      nodeId: "node_iron_1",
      resourceKey: "iron_ore",
      targetAccountRef: "account:foundry",
      worldTime: 20,
      sourceEventIds: ["event_tick_20"],
    }),
  );
});

test("resource production never overproduces and records depletion world time", () => {
  const state = registerResourceProductionNode(emptyResourceProductionRegistry(), {
    nodeId: "node_low",
    resourceKey: "iron_ore",
    resourceClass: "material",
    unit: "minor_unit",
    capacity: "9",
    remainingUnits: "7",
    yieldPerWorkUnit: "5",
    workerSlots: 1,
    worldTime: 1,
  });
  const assigned = assignResourceProduction(state, {
    assignmentId: "assignment_low",
    nodeId: "node_low",
    workerRef: "worker:a",
    targetAccountRef: "account:foundry",
    workUnits: "2",
    worldTime: 2,
    sourceEventIds: ["event_assignment_low"],
  });

  const proposal = produceResource({
    registry: state,
    assignments: [assigned],
    nodeId: "node_low",
    resourceKey: "iron_ore",
    targetAccountRef: "account:foundry",
    worldTime: 3,
  });

  assert.equal(proposal.producedUnits, "7");
  assert.equal(proposal.node.remainingUnits, "0");
  assert.equal(proposal.node.depletedAtWorldTime, 3);
  const depleted = applyResourceProductionProposal(state, proposal);
  assert.throws(() => produceResource({
    registry: depleted,
    assignments: [assigned],
    nodeId: "node_low",
    resourceKey: "iron_ore",
    targetAccountRef: "account:foundry",
    worldTime: 4,
  }), CausalValidationError);
});

test("resource production rejects worker slot, resource key, target, world time, and provenance violations", () => {
  assert.throws(() => produceResource({
    registry: registry(),
    assignments: [
      assignment({ assignmentId: "a", workerRef: "worker:a" }),
      assignment({ assignmentId: "b", workerRef: "worker:b" }),
      assignment({ assignmentId: "c", workerRef: "worker:c" }),
    ],
    nodeId: "node_iron_1",
    resourceKey: "iron_ore",
    targetAccountRef: "account:foundry",
    worldTime: 20,
  }), CausalValidationError);
  assert.throws(() => produceResource({
    registry: registry(),
    assignments: [assignment()],
    nodeId: "node_iron_1",
    resourceKey: "copper_ore",
    targetAccountRef: "account:foundry",
    worldTime: 20,
  }), CausalValidationError);
  assert.throws(() => produceResource({
    registry: registry(),
    assignments: [assignment({ targetAccountRef: "account:other" })],
    nodeId: "node_iron_1",
    resourceKey: "iron_ore",
    targetAccountRef: "account:foundry",
    worldTime: 20,
  }), CausalValidationError);
  assert.throws(() => produceResource({
    registry: registry(),
    assignments: [assignment()],
    nodeId: "node_iron_1",
    resourceKey: "iron_ore",
    targetAccountRef: "account:foundry",
    worldTime: 9,
  }), CausalValidationError);
  assert.throws(() => assignResourceProduction(registry(), {
    assignmentId: "missing_source",
    nodeId: "node_iron_1",
    workerRef: "worker:a",
    targetAccountRef: "account:foundry",
    workUnits: "1",
    worldTime: 12,
    sourceEventIds: [],
  }), CausalValidationError);
});

test("resource production replenishes without exceeding capacity and clears depletion", () => {
  const depleted = registerResourceProductionNode(emptyResourceProductionRegistry(), {
    nodeId: "node_depleted",
    resourceKey: "iron_ore",
    resourceClass: "material",
    unit: "minor_unit",
    capacity: "10",
    remainingUnits: "0",
    yieldPerWorkUnit: "1",
    workerSlots: 1,
    worldTime: 5,
  });
  assert.equal(depleted.nodes.node_depleted?.depletedAtWorldTime, 5);

  const replenished = replenishResourceNode({
    registry: depleted,
    nodeId: "node_depleted",
    amount: "25",
    worldTime: 6,
  });
  assert.equal(replenished.nodes.node_depleted?.remainingUnits, "10");
  assert.equal(replenished.nodes.node_depleted?.depletedAtWorldTime, undefined);
  assert.throws(() => registerResourceProductionNode(emptyResourceProductionRegistry(), {
    nodeId: "bad_capacity",
    resourceKey: "iron_ore",
    resourceClass: "material",
    unit: "minor_unit",
    capacity: "10",
    remainingUnits: "11",
    yieldPerWorkUnit: "1",
    workerSlots: 1,
    worldTime: 1,
  }), CausalValidationError);
});

function eventFor(effects: CausalWorldEventV1["effects"]): CausalWorldEventV1 {
  return {
    eventId: "event_production",
    eventType: "resource_node_produced",
    schemaVersion: CAUSAL_EVENT_SCHEMA_VERSION,
    registryVersion: "test",
    registryHash: HASH,
    worldId: "world_resource_production_test",
    namespace: "world",
    stream: { streamType: "resource_node", streamId: "node_iron_1", streamVersion: 1 },
    occurredAtWorldMinute: 20,
    recordedAt: "2026-07-20T00:00:00.000Z",
    actorRefs: [ACTOR],
    subjectRefs: [{ entityType: "resource_node", entityId: "node_iron_1" }],
    regionRefs: [],
    command: {
      commandId: "cmd_produce",
      commandType: "resource_node_produce",
      idempotencyKey: "idem_produce",
      inputHash: HASH,
    },
    causality: {
      causalParentEventIds: ["event_assignment_a"],
      rootPressureIds: [],
    },
    authorizationRefs: ["auth:mine"],
    evidenceRefs: [],
    visibilityPolicyRef: "test",
    versions: {
      rulesetVersion: "test",
      contentVersion: "test",
      adjudicatorVersion: "test",
    },
    determinism: {
      algorithmId: "resource_production_rules_test",
      algorithmVersion: "1",
    },
    payload: {},
    effects,
    proof: {
      payloadHash: HASH,
      effectsHash: HASH,
      eventHash: HASH,
    },
  };
}
