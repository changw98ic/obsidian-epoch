import assert from "node:assert/strict";
import test from "node:test";

import {
  assertCausalWorldEventRecordedPayload,
  causalWorldEventFromEpochEvent,
  causalWorldEventToEpochEvent,
  epochEventToCausalView,
} from "../lib/epoch/causalEpochAdapter.ts";
import type {
  CausalEffectV1,
  CausalWorldEventV1,
} from "../lib/epoch/causalContracts.ts";
import {
  CAUSAL_EVENT_SCHEMA_VERSION,
} from "../lib/epoch/causalContracts.ts";
import { createEpochGameCore, projectEpochEvents } from "../lib/epoch/gameCore.ts";
import { assertEpochEvent, type EpochEvent } from "../lib/epoch/events.ts";
import { createSequentialEpochIdFactory, type EpochClock, type EpochCommandContext } from "../lib/epoch/protocol.ts";
import { createEpochRuntime } from "../lib/epoch/runtime.ts";

const HASH_A = "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const;
const HASH_B = "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as const;
const HASH_C = "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc" as const;
const HASH_D = "sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd" as const;
const HASH_E = "sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee" as const;

const serverContext: EpochCommandContext = {
  actorExplorerId: "system",
  trustClass: "system_worker",
  causationId: "cmd_system",
  correlationId: "corr_system",
};

function fixedClock(iso: string): EpochClock {
  return () => new Date(iso);
}

function resourceLedgerEffect(effectId = "effect_resource_1"): CausalEffectV1 {
  return {
    effectId,
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
      entries: [
        { accountRef: "account_a", quantityMinor: "1" },
      ],
    },
    sourceEventIds: [],
    authorizationRefs: ["auth:system"],
  };
}

function eventFixture(overrides: Partial<CausalWorldEventV1> = {}): CausalWorldEventV1 {
  return {
    eventId: "causal_event_1",
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
      { actorType: "player_identity", actorId: "agent_1" },
      { actorType: "system", actorId: "clock" },
    ],
    subjectRefs: [
      { entityType: "resource_account", entityId: "account_a" },
    ],
    regionRefs: ["region_gray_harbor"],
    command: {
      commandId: "command_1",
      commandType: "resource.grant",
      idempotencyKey: "idem_1",
      inputHash: HASH_B,
    },
    causality: {
      causalParentEventIds: [],
      rootPressureIds: [],
      rootReason: "external_verified_input",
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
    payload: {
      a: "first",
      b: "second",
    },
    effects: [
      resourceLedgerEffect(),
    ],
    proof: {
      payloadHash: HASH_C,
      effectsHash: HASH_D,
      eventHash: HASH_E,
    },
    ...overrides,
  };
}

function eventIds(events: readonly CausalWorldEventV1[]): readonly string[] {
  return events.map((event) => event.eventId);
}

function legacyEpochEvent(): EpochEvent {
  return {
    eventId: "legacy_event_1",
    eventType: "resource_granted",
    aggregateType: "resource_account",
    aggregateId: "agent_legacy",
    actorExplorerId: "explorer_legacy",
    agentId: "agent_legacy",
    trustClass: "system_worker",
    causationId: "legacy_cause",
    correlationId: "legacy_corr",
    idempotencyKey: "legacy_idem",
    createdAt: "2026-07-20T00:00:00.000Z",
    payload: {
      agentId: "agent_legacy",
      resourceId: "legend",
      amount: 1,
      reason: "legacy_fixture",
      grantedAt: "2026-07-20T00:00:00.000Z",
    },
  };
}

test("CausalWorldEventV1 converts to a causal_world_event_recorded envelope", () => {
  const causalEvent = eventFixture();

  const epochEvent = causalWorldEventToEpochEvent(causalEvent);

  assert.equal(epochEvent.eventId, "causal_event_1");
  assert.equal(epochEvent.eventType, "causal_world_event_recorded");
  assert.equal(epochEvent.aggregateType, "world_simulation");
  assert.equal(epochEvent.aggregateId, "world_1:resource_account:account_a");
  assert.equal(epochEvent.actorExplorerId, "agent_1");
  assert.equal(epochEvent.agentId, "agent_1");
  assert.equal(epochEvent.causationId, "command_1");
  assert.equal(epochEvent.correlationId, "idem_1");
  assert.equal(epochEvent.payload.causalEvent, causalEvent);
});

test("causal_world_event_recorded envelope converts back without loss", () => {
  const causalEvent = eventFixture();

  const roundTripped = causalWorldEventFromEpochEvent(causalWorldEventToEpochEvent(causalEvent));

  assert.deepEqual(roundTripped, causalEvent);
});

test("payload assertion rejects a causal_world_event_recorded envelope with a bad schema", () => {
  const epochEvent = causalWorldEventToEpochEvent(eventFixture());

  assert.throws(
    () => assertCausalWorldEventRecordedPayload({
      ...epochEvent.payload,
      schemaVersion: "9.9.9",
    }),
    /causal_world_event_payload_schema_version_invalid/,
  );
});

test("EpochEvent runtime assertion rejects a causal_world_event_recorded event with a bad causal schema", () => {
  const epochEvent = causalWorldEventToEpochEvent(eventFixture());

  assert.throws(
    () => assertEpochEvent({
      ...epochEvent,
      payload: {
        ...epochEvent.payload,
        causalEvent: {
          ...epochEvent.payload.causalEvent,
          schemaVersion: "9.9.9",
        },
      },
    }),
    /CAUSAL_SCHEMA_INVALID/,
  );
});

test("runtime does not expose raw causal world event ingest", () => {
  const runtime = createEpochRuntime();
  const malicious = eventFixture({
    eventId: "malicious_resource_ledger",
    proof: {
      payloadHash: HASH_A,
      effectsHash: HASH_B,
      eventHash: HASH_C,
    },
  });

  assert.equal("ingestCausalWorldEvents" in runtime, false);
  assert.equal(typeof (runtime as { readonly ingestCausalWorldEvents?: unknown }).ingestCausalWorldEvents, "undefined");
  assert.deepEqual(runtime.causalWorldEvents({ eventType: malicious.eventType }).events, []);
});

test("gameCore raw causal world event ingest rejects malicious resource ledger events", () => {
  const core = createEpochGameCore();
  const malicious = eventFixture({
    eventId: "malicious_resource_ledger",
    proof: {
      payloadHash: HASH_A,
      effectsHash: HASH_B,
      eventHash: HASH_C,
    },
  });

  assert.throws(
    () => core.ingestCausalWorldEvents([malicious]),
    /causal_world_event_direct_ingest_forbidden/,
  );
  assert.equal(core.events().length, 0);
});

test("generic ingestCanonicalEvents rejects causal_world_event_recorded envelopes", () => {
  const core = createEpochGameCore();
  const malicious = causalWorldEventToEpochEvent(eventFixture({
    eventId: "malicious_resource_ledger_envelope",
    proof: {
      payloadHash: HASH_A,
      effectsHash: HASH_B,
      eventHash: HASH_C,
    },
  }));

  assert.throws(
    () => core.ingestCanonicalEvents([malicious]),
    /causal_world_event_canonical_ingest_forbidden/,
  );
  assert.equal(core.events().length, 0);
});

test("runtime generic ingestCanonicalEvents rejects wrapped causal_world_event_recorded envelopes", () => {
  const runtime = createEpochRuntime();
  const malicious = causalWorldEventToEpochEvent(eventFixture({
    eventId: "malicious_runtime_resource_ledger_envelope",
    proof: {
      payloadHash: HASH_A,
      effectsHash: HASH_B,
      eventHash: HASH_C,
    },
  }));

  assert.throws(
    () => runtime.ingestCanonicalEvents([malicious]),
    /causal_world_event_canonical_ingest_forbidden/,
  );
  assert.deepEqual(runtime.causalWorldEvents({ eventType: "resource_granted" }).events, []);
});

test("runtime.causalWorldEvents filters by eventType", () => {
  const runtime = createEpochRuntime({
    initialEvents: [
      causalWorldEventToEpochEvent(eventFixture({ eventId: "causal_event_resource", eventType: "resource_granted" })),
      causalWorldEventToEpochEvent(eventFixture({ eventId: "causal_event_clock", eventType: "world_clock_advanced" })),
    ],
  });

  assert.deepEqual(eventIds(runtime.causalWorldEvents({ eventType: "resource_granted" }).events), ["causal_event_resource"]);
});

test("runtime.causalWorldEvents filters by worldId", () => {
  const runtime = createEpochRuntime({
    initialEvents: [
      causalWorldEventToEpochEvent(eventFixture({ eventId: "causal_event_world_1", worldId: "world_1" })),
      causalWorldEventToEpochEvent(eventFixture({ eventId: "causal_event_world_2", worldId: "world_2" })),
    ],
  });

  assert.deepEqual(eventIds(runtime.causalWorldEvents({ worldId: "world_2" }).events), ["causal_event_world_2"]);
});

test("runtime.causalWorldEvents filters by namespace", () => {
  const runtime = createEpochRuntime({
    initialEvents: [
      causalWorldEventToEpochEvent(eventFixture({ eventId: "causal_event_world", namespace: "world" })),
      causalWorldEventToEpochEvent(eventFixture({ eventId: "causal_event_identity", namespace: "identity" })),
    ],
  });

  assert.deepEqual(eventIds(runtime.causalWorldEvents({ namespace: "identity" }).events), ["causal_event_identity"]);
});

test("runtime.causalWorldEvents filters by agentId", () => {
  const runtime = createEpochRuntime({
    initialEvents: [
      causalWorldEventToEpochEvent(eventFixture({ eventId: "causal_event_agent_1" })),
      causalWorldEventToEpochEvent(eventFixture({
        eventId: "causal_event_agent_2",
        actorRefs: [{ actorType: "player_identity", actorId: "agent_2" }],
      })),
    ],
  });

  assert.deepEqual(eventIds(runtime.causalWorldEvents({ agentId: "agent_2" }).events), ["causal_event_agent_2"]);
});

test("runtime.causalWorldEvents filters by explorerId", () => {
  const runtime = createEpochRuntime({
    initialEvents: [
      causalWorldEventToEpochEvent(eventFixture({ eventId: "causal_event_explorer_1" })),
      causalWorldEventToEpochEvent(eventFixture({
        eventId: "causal_event_explorer_2",
        actorRefs: [{ actorType: "system", actorId: "explorer_2" }],
      })),
    ],
  });

  assert.deepEqual(eventIds(runtime.causalWorldEvents({ explorerId: "explorer_2" }).events), ["causal_event_explorer_2"]);
});

test("runtime.causalWorldEvents filters by actorRef", () => {
  const runtime = createEpochRuntime({
    initialEvents: [
      causalWorldEventToEpochEvent(eventFixture({ eventId: "causal_event_actor_1" })),
      causalWorldEventToEpochEvent(eventFixture({
        eventId: "causal_event_actor_2",
        actorRefs: [{ actorType: "npc", actorId: "npc_2" }],
      })),
    ],
  });

  assert.deepEqual(eventIds(runtime.causalWorldEvents({ actorRef: "npc:npc_2" }).events), ["causal_event_actor_2"]);
});

test("runtime.causalWorldEvents filters by subjectRef", () => {
  const runtime = createEpochRuntime({
    initialEvents: [
      causalWorldEventToEpochEvent(eventFixture({ eventId: "causal_event_subject_1" })),
      causalWorldEventToEpochEvent(eventFixture({
        eventId: "causal_event_subject_2",
        subjectRefs: [{ entityType: "region", entityId: "region_red_gate" }],
      })),
    ],
  });

  assert.deepEqual(eventIds(runtime.causalWorldEvents({ subjectRef: "region:region_red_gate" }).events), ["causal_event_subject_2"]);
});

test("runtime.causalWorldEvents filters by regionId", () => {
  const runtime = createEpochRuntime({
    initialEvents: [
      causalWorldEventToEpochEvent(eventFixture({ eventId: "causal_event_region_1" })),
      causalWorldEventToEpochEvent(eventFixture({
        eventId: "causal_event_region_2",
        regionRefs: ["region_red_gate"],
      })),
    ],
  });

  assert.deepEqual(eventIds(runtime.causalWorldEvents({ regionId: "region_red_gate" }).events), ["causal_event_region_2"]);
});

test("runtime.causalWorldEvents applies the caller limit to newest matching events", () => {
  const runtime = createEpochRuntime({
    initialEvents: [
      causalWorldEventToEpochEvent(eventFixture({ eventId: "causal_event_oldest" })),
      causalWorldEventToEpochEvent(eventFixture({ eventId: "causal_event_middle" })),
      causalWorldEventToEpochEvent(eventFixture({ eventId: "causal_event_newest" })),
    ],
  });

  assert.deepEqual(eventIds(runtime.causalWorldEvents({ limit: 2 }).events), [
    "causal_event_newest",
    "causal_event_middle",
  ]);
});

test("legacy EpochEvent returns only LegacyCausalView and no canonical causal event", () => {
  const legacyEvent = legacyEpochEvent();
  const view = epochEventToCausalView(legacyEvent);

  assert.equal(causalWorldEventFromEpochEvent(legacyEvent), undefined);
  assert.deepEqual(view, {
    originalEventId: "legacy_event_1",
    originalEventType: "resource_granted",
    sourceLedger: "epoch",
    sourcePosition: "legacy_event_1",
    inferredActorRefs: ["player_identity:agent_legacy", "explorer:explorer_legacy"],
    inferredSubjectRefs: ["resource_account:agent_legacy"],
    inferredWorldMinute: undefined,
    knownParentEventIds: [],
    causalStatus: "legacy_partially_attributed",
    adapterVersion: "causal-epoch-adapter-v1",
    warnings: ["legacy_epoch_event_read_only_view_not_canonical_causal_fact"],
  });
});

test("existing ingestCanonicalEvents still updates old identity projection", () => {
  const source = createEpochGameCore({
    clock: fixedClock("2026-07-20T00:00:00.000Z"),
    idFactory: createSequentialEpochIdFactory("causal_regression_source"),
  });
  const issued = source.issueIdentity({
    explorerId: "explorer_regression",
    identityName: "旧投影回归校验员",
  }, serverContext);
  const replica = createEpochGameCore({
    idFactory: createSequentialEpochIdFactory("causal_regression_replica"),
  });

  const projection = replica.ingestCanonicalEvents(issued.events);

  assert.equal(projection.lineage.explorer_regression[0], issued.value.agentId);
  assert.equal(projection.identities[issued.value.agentId]?.identityName, "旧投影回归校验员");
});

test("existing projectEpochEvents still projects old resource events", () => {
  const core = createEpochGameCore({
    clock: fixedClock("2026-07-20T00:00:00.000Z"),
    idFactory: createSequentialEpochIdFactory("causal_resource_regression"),
  });
  const issued = core.issueIdentity({
    explorerId: "explorer_resource_regression",
    identityName: "旧资源投影校验员",
  }, serverContext);
  core.grantResource({
    agentId: issued.value.agentId,
    resourceId: "legend",
    amount: 3,
    reason: "causal_integration_regression",
  }, serverContext);

  const projection = projectEpochEvents(core.events());

  assert.equal(projection.resourceBalances[issued.value.agentId]?.legend, 3);
});
