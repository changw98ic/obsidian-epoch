import assert from "node:assert/strict";
import test from "node:test";

import type {
  CausalEffectV1,
  CausalWorldEventV1,
  CausalRootReason,
} from "../lib/epoch/causalContracts.ts";
import { CAUSAL_EVENT_SCHEMA_VERSION } from "../lib/epoch/causalContracts.ts";
import {
  validateCausalInvariantRules,
  causalParentGraphHasCycle,
} from "../lib/epoch/causalInvariantRules.ts";
import type {
  CausalInvariantPolicy,
  CausalInvariantValidationInput,
  CausalEventReference,
  CausalStreamExpectation,
} from "../lib/epoch/causalInvariantRules.ts";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const HASH_A = "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const;
const HASH_B = "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as const;
const HASH_C = "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc" as const;
const HASH_D = "sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd" as const;

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function effectFixture(overrides: Partial<CausalEffectV1> = {}): CausalEffectV1 {
  return {
    effectId: "effect_1",
    effectType: "state_transition",
    targetRef: {
      entityType: "entity",
      entityId: "entity_1",
    },
    operation: "update",
    after: {
      stateMachineId: "sm_1",
      fromState: "a",
      toState: "b",
      transitionId: "t_1",
      reasonCode: "test",
    },
    sourceEventIds: ["event_1"],
    authorizationRefs: ["auth:system"],
    ...overrides,
  } as CausalEffectV1;
}

function eventFixture(overrides: Partial<CausalWorldEventV1> = {}): CausalWorldEventV1 {
  return {
    eventId: "event_1",
    eventType: "state_changed",
    schemaVersion: CAUSAL_EVENT_SCHEMA_VERSION,
    registryVersion: "1",
    registryHash: HASH_A,
    worldId: "world_1",
    namespace: "world",
    stream: {
      streamType: "world",
      streamId: "world_1",
      streamVersion: 1,
    },
    occurredAtWorldMinute: 10,
    recordedAt: "2026-07-20T00:00:00.000Z",
    actorRefs: [
      { actorType: "system", actorId: "clock" },
    ],
    subjectRefs: [
      { entityType: "entity", entityId: "entity_1" },
    ],
    regionRefs: [],
    command: {
      commandId: "command_1",
      commandType: "world_clock.advance",
      idempotencyKey: "idem_1",
      inputHash: HASH_B,
    },
    causality: {
      causalParentEventIds: ["parent_1"],
      rootPressureIds: [],
    },
    authorizationRefs: ["auth:system"],
    evidenceRefs: [],
    visibilityPolicyRef: "visibility:public",
    versions: {
      rulesetVersion: "ruleset_1",
      contentVersion: "content_1",
      adjudicatorVersion: "adjudicator_1",
    },
    determinism: {
      algorithmId: "deterministic",
      algorithmVersion: "1",
    },
    payload: {},
    effects: [effectFixture()],
    proof: {
      payloadHash: HASH_C,
      effectsHash: HASH_D,
      eventHash: HASH_A,
    },
    ...overrides,
  };
}

function knownParent(
  parentId: string,
  overrides: Partial<CausalEventReference> = {},
): CausalEventReference {
  return {
    eventId: parentId,
    worldId: "world_1",
    occurredAtWorldMinute: 5,
    ...overrides,
  };
}

function emptyPolicy(): CausalInvariantPolicy {
  return {};
}

function input(overrides: {
  readonly event?: Partial<CausalWorldEventV1>;
  readonly knownEvents?: Readonly<Record<string, CausalEventReference>>;
  readonly policy?: CausalInvariantPolicy;
  readonly stream?: CausalStreamExpectation;
} = {}): CausalInvariantValidationInput {
  return {
    event: eventFixture(overrides.event ?? {}),
    knownEvents: overrides.knownEvents ?? { parent_1: knownParent("parent_1") },
    policy: overrides.policy ?? emptyPolicy(),
    stream: overrides.stream,
  };
}

function codes(errors: readonly { readonly code: string }[]): readonly string[] {
  return errors.map((e) => e.code);
}

// ---------------------------------------------------------------------------
// validateCausalInvariantRules
// ---------------------------------------------------------------------------

test("validateCausalInvariantRules: stream version mismatch produces STREAM_VERSION_CONFLICT", () => {
  const errors = validateCausalInvariantRules(input({
    stream: {
      streamType: "world",
      streamId: "world_1",
      expectedNextVersion: 5, // event has streamVersion 1
    },
  }));
  assert.ok(codes(errors).includes("STREAM_VERSION_CONFLICT"));
});

test("validateCausalInvariantRules: world time conflict produces STREAM_VERSION_CONFLICT", () => {
  const errors = validateCausalInvariantRules(input({
    event: eventFixture({ occurredAtWorldMinute: 3 }),
    stream: {
      streamType: "world",
      streamId: "world_1",
      expectedNextVersion: 1,
      latestWorldMinute: 10, // event occurred at 3 < 10
    },
  }));
  assert.ok(codes(errors).includes("STREAM_VERSION_CONFLICT"));
});

test("validateCausalInvariantRules: missing parent produces CAUSAL_PARENT_MISSING", () => {
  const errors = validateCausalInvariantRules(input({
    event: eventFixture({
      causality: {
        causalParentEventIds: ["missing_parent"],
        rootPressureIds: [],
      },
    }),
    knownEvents: {}, // no known events
  }));
  assert.ok(codes(errors).includes("CAUSAL_PARENT_MISSING"));
});

test("validateCausalInvariantRules: parent from different world produces CAUSAL_PARENT_MISSING", () => {
  const errors = validateCausalInvariantRules(input({
    knownEvents: {
      parent_1: knownParent("parent_1", { worldId: "other_world" }),
    },
  }));
  assert.ok(codes(errors).includes("CAUSAL_PARENT_MISSING"));
});

test("validateCausalInvariantRules: parent that is a future event produces CAUSAL_PARENT_MISSING", () => {
  const errors = validateCausalInvariantRules(input({
    knownEvents: {
      parent_1: knownParent("parent_1", { occurredAtWorldMinute: 99 }),
    },
  }));
  assert.ok(codes(errors).includes("CAUSAL_PARENT_MISSING"));
});

test("validateCausalInvariantRules: cycle A -> B -> A produces CAUSAL_CYCLE_DETECTED", () => {
  // event_1 has parent parent_A; parent_A has parent parent_B; parent_B has parent parent_A
  const known: Record<string, CausalEventReference> = {
    parent_A: {
      eventId: "parent_A",
      worldId: "world_1",
      occurredAtWorldMinute: 3,
      causality: { causalParentEventIds: ["parent_B"] },
    },
    parent_B: {
      eventId: "parent_B",
      worldId: "world_1",
      occurredAtWorldMinute: 2,
      causality: { causalParentEventIds: ["parent_A"] },
    },
  };
  const errors = validateCausalInvariantRules(input({
    event: eventFixture({
      eventId: "event_1",
      causality: {
        causalParentEventIds: ["parent_A"],
        rootPressureIds: [],
      },
    }),
    knownEvents: known,
  }));
  assert.ok(codes(errors).includes("CAUSAL_CYCLE_DETECTED"));
});

test("validateCausalInvariantRules: self-reference produces CAUSAL_CYCLE_DETECTED", () => {
  const errors = validateCausalInvariantRules(input({
    event: eventFixture({
      eventId: "event_self",
      causality: {
        causalParentEventIds: ["event_self"],
        rootPressureIds: [],
      },
    }),
    knownEvents: {},
  }));
  assert.ok(codes(errors).includes("CAUSAL_CYCLE_DETECTED"));
});

test("validateCausalInvariantRules: root event with valid rootReason produces no errors", () => {
  const errors = validateCausalInvariantRules(input({
    event: eventFixture({
      causality: {
        causalParentEventIds: [],
        rootPressureIds: [],
        rootReason: "world_genesis",
      },
    }),
    knownEvents: {},
    policy: {
      rootEventTypes: ["state_changed"],
    },
  }));
  assert.deepEqual(codes(errors), []);
});

test("validateCausalInvariantRules: non-root event with rootReason produces ROOT_REASON_DENIED", () => {
  const errors = validateCausalInvariantRules(input({
    event: eventFixture({
      causality: {
        causalParentEventIds: ["parent_1"],
        rootPressureIds: [],
        rootReason: "world_genesis",
      },
    }),
    knownEvents: {
      parent_1: knownParent("parent_1"),
    },
  }));
  assert.ok(codes(errors).includes("ROOT_REASON_DENIED"));
});

test("validateCausalInvariantRules: requires root pressure but has none produces ROOT_PRESSURE_REQUIRED", () => {
  const errors = validateCausalInvariantRules(input({
    event: eventFixture({
      eventType: "pressured_event",
      causality: {
        causalParentEventIds: ["parent_1"],
        rootPressureIds: [],
      },
    }),
    policy: {
      eventTypeRequiresRootPressure: ["pressured_event"],
    },
  }));
  assert.ok(codes(errors).includes("ROOT_PRESSURE_REQUIRED"));
});

test("validateCausalInvariantRules: effect with no sourceEventIds produces ORPHAN_EFFECT", () => {
  const errors = validateCausalInvariantRules(input({
    event: eventFixture({
      effects: [effectFixture({ sourceEventIds: [] })],
    }),
  }));
  assert.ok(codes(errors).includes("ORPHAN_EFFECT"));
});

test("validateCausalInvariantRules: valid event with parent and effect produces no errors", () => {
  const errors = validateCausalInvariantRules(input({
    event: eventFixture({
      causality: {
        causalParentEventIds: ["parent_1"],
        rootPressureIds: [],
      },
      effects: [effectFixture({ sourceEventIds: ["parent_1"] })],
    }),
    knownEvents: {
      parent_1: knownParent("parent_1"),
    },
  }));
  assert.deepEqual(codes(errors), []);
});

test("validateCausalInvariantRules: stream matches expected produces no stream error", () => {
  const errors = validateCausalInvariantRules(input({
    event: eventFixture({
      stream: {
        streamType: "world",
        streamId: "world_1",
        streamVersion: 3,
      },
    }),
    stream: {
      streamType: "world",
      streamId: "world_1",
      expectedNextVersion: 3,
      latestWorldMinute: 10,
    },
  }));
  const streamErrors = errors.filter((e) => e.code === "STREAM_VERSION_CONFLICT");
  assert.deepEqual(streamErrors.length, 0);
});

test("validateCausalInvariantRules: empty effects without allowEmptyEffectsForEventTypes produces ORPHAN_EFFECT", () => {
  const errors = validateCausalInvariantRules(input({
    event: eventFixture({ effects: [] }),
  }));
  assert.ok(codes(errors).includes("ORPHAN_EFFECT"));
});

test("validateCausalInvariantRules: empty effects with allowEmptyEffectsForEventTypes produces no ORPHAN_EFFECT", () => {
  const errors = validateCausalInvariantRules(input({
    event: eventFixture({ effects: [] }),
    policy: {
      allowEmptyEffectsForEventTypes: ["state_changed"],
    },
  }));
  assert.ok(!codes(errors).includes("ORPHAN_EFFECT"));
});

test("validateCausalInvariantRules: root event denied when eventType not in rootEventTypes produces CAUSAL_PARENT_MISSING", () => {
  const errors = validateCausalInvariantRules(input({
    event: eventFixture({
      causality: {
        causalParentEventIds: [],
        rootPressureIds: [],
        rootReason: "world_genesis",
      },
    }),
    knownEvents: {},
    policy: {
      rootEventTypes: ["other_type"], // "state_changed" not allowed
    },
  }));
  assert.ok(codes(errors).includes("CAUSAL_PARENT_MISSING"));
});

test("validateCausalInvariantRules: rootReasonDenied on root with wrong reason", () => {
  const errors = validateCausalInvariantRules(input({
    event: eventFixture({
      causality: {
        causalParentEventIds: [],
        rootPressureIds: [],
        rootReason: "external_clock",
      },
    }),
    knownEvents: {},
    policy: {
      rootEventTypes: ["state_changed"],
      rootReasonsByEventType: {
        state_changed: ["world_genesis"], // only world_genesis allowed
      },
    },
  }));
  assert.ok(codes(errors).includes("ROOT_REASON_DENIED"));
});

// ---------------------------------------------------------------------------
// causalParentGraphHasCycle
// ---------------------------------------------------------------------------

test("causalParentGraphHasCycle: no cycle in linear chain", () => {
  const known: Record<string, CausalEventReference> = {
    a: { eventId: "a", worldId: "w", occurredAtWorldMinute: 1, causality: { causalParentEventIds: ["b"] } },
    b: { eventId: "b", worldId: "w", occurredAtWorldMinute: 2, causality: { causalParentEventIds: ["c"] } },
    c: { eventId: "c", worldId: "w", occurredAtWorldMinute: 3, causality: { causalParentEventIds: [] } },
  };
  assert.equal(causalParentGraphHasCycle("x", ["a"], known), false);
});

test("causalParentGraphHasCycle: detects A -> B -> A cycle", () => {
  const known: Record<string, CausalEventReference> = {
    a: { eventId: "a", worldId: "w", occurredAtWorldMinute: 1, causality: { causalParentEventIds: ["b"] } },
    b: { eventId: "b", worldId: "w", occurredAtWorldMinute: 2, causality: { causalParentEventIds: ["a"] } },
  };
  assert.equal(causalParentGraphHasCycle("x", ["a"], known), true);
});

test("causalParentGraphHasCycle: detects direct self-loop", () => {
  const known: Record<string, CausalEventReference> = {
    a: { eventId: "a", worldId: "w", occurredAtWorldMinute: 1, causality: { causalParentEventIds: ["a"] } },
  };
  assert.equal(causalParentGraphHasCycle("x", ["a"], known), true);
});

test("causalParentGraphHasCycle: handles missing parent gracefully (no crash, no false positive)", () => {
  const known: Record<string, CausalEventReference> = {};
  assert.equal(causalParentGraphHasCycle("x", ["missing"], known), false);
});

test("causalParentGraphHasCycle: empty parent list returns false", () => {
  assert.equal(causalParentGraphHasCycle("x", [], {}), false);
});

test("causalParentGraphHasCycle: deep chain without cycle returns false", () => {
  const known: Record<string, CausalEventReference> = {};
  for (let i = 0; i < 20; i++) {
    const parents = i < 19 ? [`n${i + 1}`] : [];
    known[`n${i}`] = { eventId: `n${i}`, worldId: "w", occurredAtWorldMinute: i, causality: { causalParentEventIds: parents } };
  }
  assert.equal(causalParentGraphHasCycle("x", ["n0"], known), false);
});

test("causalParentGraphHasCycle: diamond graph without cycle returns false", () => {
  // x -> a, x -> b, a -> c, b -> c  (diamond, no cycle)
  const known: Record<string, CausalEventReference> = {
    a: { eventId: "a", worldId: "w", occurredAtWorldMinute: 1, causality: { causalParentEventIds: ["c"] } },
    b: { eventId: "b", worldId: "w", occurredAtWorldMinute: 1, causality: { causalParentEventIds: ["c"] } },
    c: { eventId: "c", worldId: "w", occurredAtWorldMinute: 2, causality: { causalParentEventIds: [] } },
  };
  assert.equal(causalParentGraphHasCycle("x", ["a", "b"], known), false);
});
