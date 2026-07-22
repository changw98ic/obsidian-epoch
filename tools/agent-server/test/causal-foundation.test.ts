import assert from "node:assert/strict";
import test from "node:test";

import type {
  CausalEffectV1,
  CausalWorldEventV1,
  CommandIntentV1,
} from "../lib/epoch/causalContracts.ts";
import {
  CAUSAL_COMMAND_SCHEMA_VERSION,
  CAUSAL_EVENT_SCHEMA_VERSION,
  assertCausalWorldEventV1,
  assertCommandIntentV1,
} from "../lib/epoch/causalContracts.ts";
import {
  causalCanonicalJson,
  causalCanonicalJsonHash,
} from "../lib/epoch/causalCanonicalJson.ts";
import {
  causalSchemaRegistryHash,
  findCausalEventPolicy,
  findCausalSchema,
  getCausalSchema,
  parseCausalEventPolicy,
} from "../lib/epoch/causalSchemaRegistry.ts";
import { validateCausalResourceRules } from "../lib/epoch/causalResourceRules.ts";
import { validateCausalInvariantRules } from "../lib/epoch/causalInvariantRules.ts";
import {
  assertCausalIdempotencyReplay,
  causalInputHash,
  committedCausalManifest,
} from "../lib/epoch/causalIdempotencyRules.ts";

const HASH_A = "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const;
const HASH_B = "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as const;
const HASH_C = "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc" as const;
const HASH_D = "sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd" as const;

function commandFixture(overrides: Partial<CommandIntentV1> = {}): CommandIntentV1 {
  return {
    commandId: "command_1",
    commandType: "world_clock.advance",
    commandSchemaVersion: CAUSAL_COMMAND_SCHEMA_VERSION,
    worldId: "world_1",
    namespace: "world",
    actor: {
      actorType: "system",
      actorId: "clock",
    },
    submittedAt: "2026-07-20T00:00:00.000Z",
    requestedWorldMinute: 10,
    idempotencyKey: "idem_1",
    expectedStreamVersions: [
      {
        streamType: "world",
        streamId: "world_1",
        expectedVersion: 0,
      },
    ],
    authorizationRefs: ["auth:system"],
    causalParentEventIds: [],
    rootPressureIds: [],
    rootReason: "external_clock",
    payload: {
      minutes: 1,
    },
    ...overrides,
  };
}

function resourceLedgerEffect(
  entries: readonly { readonly accountRef: string; readonly quantityMinor: string }[],
  overrides: Partial<CausalEffectV1> = {},
): CausalEffectV1 {
  return {
    effectId: "effect_resource_1",
    effectType: "resource_ledger",
    targetRef: {
      entityType: "resource_account",
      entityId: "account_a",
    },
    operation: "transfer",
    after: {
      resourceKey: "coin",
      resourceClass: "currency",
      unit: "minor",
      entries,
    },
    sourceEventIds: ["parent_1"],
    authorizationRefs: ["auth:system"],
    ...overrides,
  } as CausalEffectV1;
}

function resourceLedgerAfter(
  entries: readonly { readonly accountRef: string; readonly quantityMinor: string }[],
  refs: {
    readonly creationSourceRef?: string;
    readonly destructionSinkRef?: string;
  } = {},
) {
  return {
    resourceKey: "coin",
    resourceClass: "currency",
    unit: "minor",
    entries,
    ...refs,
  };
}

function eventFixture(overrides: Partial<CausalWorldEventV1> = {}): CausalWorldEventV1 {
  return {
    eventId: "event_1",
    eventType: "resource_granted",
    schemaVersion: CAUSAL_EVENT_SCHEMA_VERSION,
    registryVersion: "1",
    registryHash: HASH_A,
    worldId: "world_1",
    namespace: "world",
    stream: {
      streamType: "resource_account",
      streamId: "account_a",
      streamVersion: 1,
    },
    occurredAtWorldMinute: 10,
    recordedAt: "2026-07-20T00:00:00.000Z",
    actorRefs: [
      {
        actorType: "system",
        actorId: "clock",
      },
    ],
    subjectRefs: [
      {
        entityType: "resource_account",
        entityId: "account_a",
      },
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
    effects: [
      resourceLedgerEffect([
        { accountRef: "account_a", quantityMinor: "-1" },
        { accountRef: "account_b", quantityMinor: "1" },
      ]),
    ],
    proof: {
      payloadHash: HASH_C,
      effectsHash: HASH_D,
      eventHash: HASH_A,
    },
    ...overrides,
  };
}

function codes(errors: readonly { readonly code: string }[]): readonly string[] {
  return errors.map((error) => error.code);
}

test("canonical json sorts object keys recursively", () => {
  assert.equal(
    causalCanonicalJson({
      z: 1,
      a: {
        y: true,
        b: "two",
      },
    }),
    "{\"a\":{\"b\":\"two\",\"y\":true},\"z\":1}",
  );
});

test("canonical json preserves array order", () => {
  assert.equal(
    causalCanonicalJson({
      items: [{ b: 2, a: 1 }, ["second", "first"]],
    }),
    "{\"items\":[{\"a\":1,\"b\":2},[\"second\",\"first\"]]}",
  );
});

test("canonical json hash is stable for equivalent key order", () => {
  const left = causalCanonicalJsonHash({ b: 2, a: { d: 4, c: 3 } });
  const right = causalCanonicalJsonHash({ a: { c: 3, d: 4 }, b: 2 });

  assert.match(left, /^sha256:[a-f0-9]{64}$/);
  assert.equal(left, right);
});

test("canonical json rejects non-finite numbers", () => {
  assert.throws(
    () => causalCanonicalJson({ value: Number.NaN }),
    /causal_canonical_json_non_finite_number:\$\.value/,
  );
  assert.throws(
    () => causalCanonicalJson([Number.POSITIVE_INFINITY]),
    /causal_canonical_json_non_finite_number:\$\[0\]/,
  );
});

test("command assertion accepts a minimum valid command intent", () => {
  const command = assertCommandIntentV1(commandFixture());

  assert.equal(command.commandSchemaVersion, CAUSAL_COMMAND_SCHEMA_VERSION);
  assert.equal(command.commandId, "command_1");
  assert.equal(command.actor.actorType, "system");
});

test("event assertion accepts a minimum valid causal world event", () => {
  const event = assertCausalWorldEventV1(eventFixture());

  assert.equal(event.schemaVersion, CAUSAL_EVENT_SCHEMA_VERSION);
  assert.equal(event.eventId, "event_1");
  assert.equal(event.proof.eventHash, HASH_A);
});

test("schema registry returns known active schemas and policies", () => {
  assert.equal(getCausalSchema("causal.event.epoch.v1").status, "active");
  assert.equal(findCausalSchema("causal.enforcement.phase0.v1")?.family, "enforcement");
  assert.equal(parseCausalEventPolicy("resource_granted").eventSchemaId, "causal.event.epoch.v1");
  assert.equal(findCausalEventPolicy("resource_spent")?.status, "active");
});

test("schema registry rejects unknown schemas and policies", () => {
  assert.throws(
    () => getCausalSchema("causal.missing.v1"),
    /causal_schema_unknown:causal\.missing\.v1/,
  );
  assert.throws(
    () => parseCausalEventPolicy("missing_event_type"),
    /causal_event_policy_unknown:missing_event_type/,
  );
});

test("schema registry hash is deterministic", () => {
  const left = causalSchemaRegistryHash();
  const right = causalSchemaRegistryHash();

  assert.match(left, /^sha256:[a-f0-9]{64}$/);
  assert.equal(left, right);
});

test("resource rules accept balanced transfers without source or sink", () => {
  const errors = validateCausalResourceRules({
    event: eventFixture(),
    policy: {},
    balances: {
      balances: {
        account_a: { "coin:minor": "5" },
      },
    },
  });

  assert.deepEqual(errors, []);
});

test("resource rules accept positive ledger totals from allowed creation sources", () => {
  const errors = validateCausalResourceRules({
    event: eventFixture({
      effects: [
        resourceLedgerEffect(
          [{ accountRef: "account_a", quantityMinor: "5" }],
          {
            after: resourceLedgerAfter(
              [{ accountRef: "account_a", quantityMinor: "5" }],
              {
                creationSourceRef: "source:quest",
              },
            ),
          },
        ),
      ],
    }),
    policy: {
      allowedCreationSourceRefs: ["source:quest"],
    },
  });

  assert.deepEqual(errors, []);
});

test("resource rules reject positive ledger totals from disallowed creation sources", () => {
  const errors = validateCausalResourceRules({
    event: eventFixture({
      effects: [
        resourceLedgerEffect(
          [{ accountRef: "account_a", quantityMinor: "5" }],
          {
            after: resourceLedgerAfter(
              [{ accountRef: "account_a", quantityMinor: "5" }],
              {
                creationSourceRef: "source:quest",
              },
            ),
          },
        ),
      ],
    }),
    policy: {
      allowedCreationSourceRefs: ["source:admin"],
    },
  });
  assert.deepEqual(codes(errors), ["RESOURCE_SOURCE_DENIED"]);
});

test("resource rules accept negative ledger totals to allowed destruction sinks", () => {
  const errors = validateCausalResourceRules({
    event: eventFixture({
      effects: [
        resourceLedgerEffect(
          [{ accountRef: "account_a", quantityMinor: "-5" }],
          {
            after: resourceLedgerAfter(
              [{ accountRef: "account_a", quantityMinor: "-5" }],
              {
                destructionSinkRef: "sink:repair",
              },
            ),
          },
        ),
      ],
    }),
    policy: {
      allowedDestructionSinkRefs: ["sink:repair"],
    },
    balances: {
      balances: {
        account_a: { "coin:minor": "5" },
      },
    },
  });

  assert.deepEqual(errors, []);
});

test("resource rules reject negative ledger totals to disallowed destruction sinks", () => {
  const errors = validateCausalResourceRules({
    event: eventFixture({
      effects: [
        resourceLedgerEffect(
          [{ accountRef: "account_a", quantityMinor: "-5" }],
          {
            after: resourceLedgerAfter(
              [{ accountRef: "account_a", quantityMinor: "-5" }],
              {
                destructionSinkRef: "sink:repair",
              },
            ),
          },
        ),
      ],
    }),
    policy: {
      allowedDestructionSinkRefs: ["sink:admin"],
    },
    balances: {
      balances: {
        account_a: { "coin:minor": "5" },
      },
    },
  });

  assert.deepEqual(codes(errors), ["RESOURCE_SINK_DENIED"]);
});

test("resource rules reject negative resulting balances", () => {
  const errors = validateCausalResourceRules({
    event: eventFixture({
      effects: [
        resourceLedgerEffect([
          { accountRef: "account_a", quantityMinor: "-7" },
          { accountRef: "account_b", quantityMinor: "7" },
        ]),
      ],
    }),
    policy: {},
    balances: {
      balances: {
        account_a: { "coin:minor": "5" },
      },
    },
  });

  assert.deepEqual(codes(errors), ["NEGATIVE_BALANCE"]);
  assert.equal(errors[0]?.retryable, true);
});

test("invariant rules allow authorized root events without parents", () => {
  const event = eventFixture({
    eventType: "world_clock_initialized",
    causality: {
      causalParentEventIds: [],
      rootPressureIds: [],
      rootReason: "world_genesis",
    },
    effects: [
      resourceLedgerEffect(
        [{ accountRef: "account_a", quantityMinor: "0" }],
        { sourceEventIds: ["event_1"] },
      ),
    ],
  });

  assert.deepEqual(validateCausalInvariantRules({
    event,
    knownEvents: {},
    policy: {
      rootEventTypes: ["world_clock_initialized"],
      rootReasonsByEventType: {
        world_clock_initialized: ["world_genesis"],
      },
    },
  }), []);
});

test("invariant rules reject missing causal parents", () => {
  const errors = validateCausalInvariantRules({
    event: eventFixture(),
    knownEvents: {},
    policy: {},
  });

  assert.deepEqual(codes(errors), ["CAUSAL_PARENT_MISSING"]);
  assert.equal(errors[0]?.retryable, true);
});

test("invariant rules reject orphan effect sources", () => {
  const errors = validateCausalInvariantRules({
    event: eventFixture({
      effects: [
        resourceLedgerEffect(
          [
            { accountRef: "account_a", quantityMinor: "-1" },
            { accountRef: "account_b", quantityMinor: "1" },
          ],
          { sourceEventIds: ["unrelated_event"] },
        ),
      ],
    }),
    knownEvents: {
      parent_1: {
        eventId: "parent_1",
        worldId: "world_1",
        occurredAtWorldMinute: 9,
      },
    },
    policy: {},
  });

  assert.deepEqual(codes(errors), ["ORPHAN_EFFECT"]);
});

test("invariant rules reject stream version conflicts", () => {
  const errors = validateCausalInvariantRules({
    event: eventFixture(),
    knownEvents: {
      parent_1: {
        eventId: "parent_1",
        worldId: "world_1",
        occurredAtWorldMinute: 9,
      },
    },
    policy: {},
    stream: {
      streamType: "resource_account",
      streamId: "account_a",
      expectedNextVersion: 2,
      latestWorldMinute: 10,
    },
  });

  assert.deepEqual(codes(errors), ["STREAM_VERSION_CONFLICT"]);
});

test("idempotency rules replay the same scoped input", () => {
  const input = {
    worldId: "world_1",
    commandType: "resource.grant",
    actorRef: "player_identity:explorer_1",
    idempotencyKey: "idem_1",
    input: {
      b: 2,
      a: {
        value: 1,
        omitted: undefined,
      },
    },
  };
  const existing = committedCausalManifest({
    ...input,
    eventIds: ["event_1"],
  });

  assert.equal(causalInputHash(input.input), causalInputHash({ a: { value: 1 }, b: 2 }));
  assert.equal(assertCausalIdempotencyReplay(existing, {
    ...input,
    input: { a: { value: 1 }, b: 2 },
  }), existing);
});

test("idempotency rules reject conflicting input for the same scope", () => {
  const existing = committedCausalManifest({
    worldId: "world_1",
    commandType: "resource.grant",
    actorRef: "player_identity:explorer_1",
    idempotencyKey: "idem_1",
    input: { amount: 1 },
    eventIds: ["event_1"],
  });

  assert.throws(() => assertCausalIdempotencyReplay(existing, {
    worldId: "world_1",
    commandType: "resource.grant",
    actorRef: "player_identity:explorer_1",
    idempotencyKey: "idem_1",
    input: { amount: 2 },
  }), /causal_idempotency_conflict/);
});
