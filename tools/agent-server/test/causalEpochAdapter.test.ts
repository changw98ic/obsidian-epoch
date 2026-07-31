import assert from "node:assert/strict";
import test from "node:test";

import {
  CAUSAL_EPOCH_ADAPTER_VERSION,
  CAUSAL_WORLD_EVENT_RECORDED_PAYLOAD_SCHEMA_VERSION,
  assertCausalWorldEventRecordedPayload,
  causalWorldEventFromEpochEvent,
  causalWorldEventToEpochEvent,
  causalWorldEventsFromEpochEvents,
  causalEpochEventCanonicalJson,
  epochEventToCausalView,
  legacyCausalViewForEpochEvent,
} from "../lib/epoch/causalEpochAdapter.ts";
import type {
  CausalWorldEventV1,
} from "../lib/epoch/causalContracts.ts";
import {
  CAUSAL_EVENT_SCHEMA_VERSION,
} from "../lib/epoch/causalContracts.ts";
import type { EpochEvent } from "../lib/epoch/events.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const HASH_A = "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const;
const HASH_B = "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as const;
const HASH_C = "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc" as const;
const HASH_D = "sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd" as const;
const HASH_E = "sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee" as const;

function minimalCausalWorldEvent(overrides: Partial<CausalWorldEventV1> = {}): CausalWorldEventV1 {
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
    effects: [],
    proof: {
      payloadHash: HASH_C,
      effectsHash: HASH_D,
      eventHash: HASH_E,
    },
    ...overrides,
  };
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

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

test("CAUSAL_EPOCH_ADAPTER_VERSION has expected value", () => {
  assert.equal(CAUSAL_EPOCH_ADAPTER_VERSION, "causal-epoch-adapter-v1");
});

test("CAUSAL_WORLD_EVENT_RECORDED_PAYLOAD_SCHEMA_VERSION has expected value", () => {
  assert.equal(CAUSAL_WORLD_EVENT_RECORDED_PAYLOAD_SCHEMA_VERSION, "1.0.0");
});

// ---------------------------------------------------------------------------
// causalWorldEventToEpochEvent
// ---------------------------------------------------------------------------

test("causalWorldEventToEpochEvent produces correct EpochEvent envelope", () => {
  const causalEvent = minimalCausalWorldEvent();

  const epochEvent = causalWorldEventToEpochEvent(causalEvent);

  assert.equal(epochEvent.eventId, "causal_event_1");
  assert.equal(epochEvent.eventType, "causal_world_event_recorded");
  assert.equal(epochEvent.aggregateType, "world_simulation");
  assert.equal(epochEvent.aggregateId, "world_1:resource_account:account_a");
  assert.equal(epochEvent.actorExplorerId, "agent_1");
  assert.equal(epochEvent.agentId, "agent_1");
  assert.equal(epochEvent.trustClass, "system_worker");
  assert.equal(epochEvent.causationId, "command_1");
  assert.equal(epochEvent.correlationId, "idem_1");
  assert.equal(epochEvent.idempotencyKey, "idem_1");
  assert.equal(epochEvent.createdAt, "2026-07-20T00:00:00.000Z");
});

test("causalWorldEventToEpochEvent embeds full causal event in payload", () => {
  const causalEvent = minimalCausalWorldEvent();

  const epochEvent = causalWorldEventToEpochEvent(causalEvent);

  assert.deepEqual(epochEvent.payload.causalEvent, causalEvent);
  assert.equal(epochEvent.payload.schemaVersion, CAUSAL_WORLD_EVENT_RECORDED_PAYLOAD_SCHEMA_VERSION);
  assert.equal(epochEvent.payload.adapterVersion, CAUSAL_EPOCH_ADAPTER_VERSION);
  assert.equal(epochEvent.payload.worldTime.occurredAtWorldMinute, 10);
  assert.equal(epochEvent.payload.worldTime.recordedAt, "2026-07-20T00:00:00.000Z");
});

test("causalWorldEventToEpochEvent uses identity namespace to produce agent_identity aggregateType", () => {
  const causalEvent = minimalCausalWorldEvent({ namespace: "identity" });

  const epochEvent = causalWorldEventToEpochEvent(causalEvent);

  assert.equal(epochEvent.aggregateType, "agent_identity");
});

test("causalWorldEventToEpochEvent uses run namespace to produce party_run aggregateType", () => {
  const causalEvent = minimalCausalWorldEvent({ namespace: "run" });

  const epochEvent = causalWorldEventToEpochEvent(causalEvent);

  assert.equal(epochEvent.aggregateType, "party_run");
});

test("causalWorldEventToEpochEvent uses lineage namespace to produce agent_identity aggregateType", () => {
  const causalEvent = minimalCausalWorldEvent({ namespace: "lineage" });

  const epochEvent = causalWorldEventToEpochEvent(causalEvent);

  assert.equal(epochEvent.aggregateType, "agent_identity");
});

test("causalWorldEventToEpochEvent with no player_identity actor uses first actor for actorExplorerId", () => {
  const causalEvent = minimalCausalWorldEvent({
    actorRefs: [
      { actorType: "system", actorId: "clock" },
      { actorType: "npc", actorId: "npc_1" },
    ],
  });

  const epochEvent = causalWorldEventToEpochEvent(causalEvent);

  assert.equal(epochEvent.actorExplorerId, "system:clock");
  assert.equal(epochEvent.agentId, undefined);
});

test("causalWorldEventToEpochEvent with no actors uses system for actorExplorerId", () => {
  const causalEvent = minimalCausalWorldEvent({
    actorRefs: [],
  });

  const epochEvent = causalWorldEventToEpochEvent(causalEvent);

  assert.equal(epochEvent.actorExplorerId, "system");
  assert.equal(epochEvent.agentId, undefined);
});

// ---------------------------------------------------------------------------
// causalWorldEventFromEpochEvent
// ---------------------------------------------------------------------------

test("causalWorldEventFromEpochEvent extracts causal event from causal_world_event_recorded envelope", () => {
  const causalEvent = minimalCausalWorldEvent();
  const epochEvent = causalWorldEventToEpochEvent(causalEvent);

  const extracted = causalWorldEventFromEpochEvent(epochEvent);

  assert.deepEqual(extracted, causalEvent);
});

test("causalWorldEventFromEpochEvent returns undefined for non-causal event types", () => {
  const legacy = legacyEpochEvent();

  const result = causalWorldEventFromEpochEvent(legacy);

  assert.equal(result, undefined);
});

// ---------------------------------------------------------------------------
// Round-trip: EpochEvent -> CausalWorldEventV1 -> EpochEvent
// ---------------------------------------------------------------------------

test("round-trip: causalWorldEventToEpochEvent -> causalWorldEventFromEpochEvent preserves all causal fields", () => {
  const original = minimalCausalWorldEvent();

  const epochEvent = causalWorldEventToEpochEvent(original);
  const roundTripped = causalWorldEventFromEpochEvent(epochEvent);

  assert.deepEqual(roundTripped, original);
});

test("round-trip preserves eventId", () => {
  const original = minimalCausalWorldEvent({ eventId: "unique_event_xyz" });

  const epochEvent = causalWorldEventToEpochEvent(original);
  assert.equal(epochEvent.eventId, "unique_event_xyz");

  const roundTripped = causalWorldEventFromEpochEvent(epochEvent);
  assert.equal(roundTripped?.eventId, "unique_event_xyz");
});

test("round-trip preserves stream and causality structure", () => {
  const original = minimalCausalWorldEvent({
    stream: {
      streamType: "custom_stream",
      streamId: "stream_42",
      streamVersion: 7,
    },
  });

  const epochEvent = causalWorldEventToEpochEvent(original);
  const roundTripped = causalWorldEventFromEpochEvent(epochEvent);

  assert.deepEqual(roundTripped?.stream, {
    streamType: "custom_stream",
    streamId: "stream_42",
    streamVersion: 7,
  });
});

test("round-trip preserves command fields", () => {
  const original = minimalCausalWorldEvent({
    command: {
      commandId: "cmd_special",
      commandType: "resource.transfer",
      idempotencyKey: "idem_special",
      inputHash: HASH_A,
    },
  });

  const epochEvent = causalWorldEventToEpochEvent(original);
  const roundTripped = causalWorldEventFromEpochEvent(epochEvent);

  assert.deepEqual(roundTripped?.command, {
    commandId: "cmd_special",
    commandType: "resource.transfer",
    idempotencyKey: "idem_special",
    inputHash: HASH_A,
  });
});

test("round-trip preserves effects array", () => {
  const effect = {
    effectId: "effect_1",
    effectType: "resource_ledger" as const,
    targetRef: { entityType: "resource_account", entityId: "account_a" },
    operation: "transfer",
    after: {
      resourceKey: "coin",
      resourceClass: "currency",
      unit: "minor",
      entries: [{ accountRef: "account_a", quantityMinor: "1" }],
    },
    sourceEventIds: [] as readonly string[],
    authorizationRefs: ["auth:system"],
  };
  const original = minimalCausalWorldEvent({ effects: [effect] });

  const epochEvent = causalWorldEventToEpochEvent(original);
  const roundTripped = causalWorldEventFromEpochEvent(epochEvent);

  assert.deepEqual(roundTripped?.effects, [effect]);
});

// ---------------------------------------------------------------------------
// epochEventToCausalView
// ---------------------------------------------------------------------------

test("epochEventToCausalView returns CausalWorldEventV1 for causal_world_event_recorded", () => {
  const causalEvent = minimalCausalWorldEvent();
  const epochEvent = causalWorldEventToEpochEvent(causalEvent);

  const view = epochEventToCausalView(epochEvent);

  assert.deepEqual(view, causalEvent);
});

test("epochEventToCausalView returns LegacyCausalViewV1 for non-causal event types", () => {
  const legacy = legacyEpochEvent();

  const view = epochEventToCausalView(legacy);

  assert.equal(view.originalEventId, "legacy_event_1");
  assert.equal(view.originalEventType, "resource_granted");
  assert.equal(view.sourceLedger, "epoch");
  assert.equal(view.causalStatus, "legacy_partially_attributed");
  assert.deepEqual(view.inferredActorRefs, ["player_identity:agent_legacy", "explorer:explorer_legacy"]);
  assert.deepEqual(view.inferredSubjectRefs, ["resource_account:agent_legacy"]);
  assert.deepEqual(view.warnings, ["legacy_epoch_event_read_only_view_not_canonical_causal_fact"]);
});

// ---------------------------------------------------------------------------
// legacyCausalViewForEpochEvent
// ---------------------------------------------------------------------------

test("legacyCausalViewForEpochEvent includes actor and subject refs", () => {
  const legacy = legacyEpochEvent();

  const view = legacyCausalViewForEpochEvent(legacy);

  assert.deepEqual(view.inferredActorRefs, ["player_identity:agent_legacy", "explorer:explorer_legacy"]);
  assert.deepEqual(view.inferredSubjectRefs, ["resource_account:agent_legacy"]);
});

test("legacyCausalViewForEpochEvent with no agentId or actorExplorerId uses empty actorRefs", () => {
  const legacy: EpochEvent = {
    ...legacyEpochEvent(),
    agentId: undefined,
    actorExplorerId: "",
  };

  const view = legacyCausalViewForEpochEvent(legacy);

  assert.deepEqual(view.inferredActorRefs, []);
});

test("legacyCausalViewForEpochEvent extracts sourceEventIds from payload", () => {
  const legacy: EpochEvent = {
    ...legacyEpochEvent(),
    payload: {
      ...legacyEpochEvent().payload,
      sourceEventIds: ["evt_parent_1", "evt_parent_2"],
    },
  };

  const view = legacyCausalViewForEpochEvent(legacy);

  assert.deepEqual(view.knownParentEventIds, ["evt_parent_1", "evt_parent_2"]);
  assert.equal(view.causalStatus, "legacy_partially_attributed");
});

test("legacyCausalViewForEpochEvent infers worldMinute from payload when present", () => {
  const legacy: EpochEvent = {
    ...legacyEpochEvent(),
    payload: {
      ...legacyEpochEvent().payload,
      worldMinute: 42,
    },
  };

  const view = legacyCausalViewForEpochEvent(legacy);

  assert.equal(view.inferredWorldMinute, 42);
});

test("legacyCausalViewForEpochEvent sets inferredWorldMinute to undefined when payload.worldMinute is not a safe integer", () => {
  const legacy: EpochEvent = {
    ...legacyEpochEvent(),
    payload: {
      ...legacyEpochEvent().payload,
      worldMinute: "not_a_number",
    },
  };

  const view = legacyCausalViewForEpochEvent(legacy);

  assert.equal(view.inferredWorldMinute, undefined);
});

test("legacyCausalViewForEpochEvent returns legacy_unattributed when no actors and no sourceEventIds", () => {
  const legacy: EpochEvent = {
    ...legacyEpochEvent(),
    agentId: undefined,
    actorExplorerId: "",
    payload: {},
  };

  const view = legacyCausalViewForEpochEvent(legacy);

  assert.equal(view.causalStatus, "legacy_unattributed");
});

// ---------------------------------------------------------------------------
// assertCausalWorldEventRecordedPayload
// ---------------------------------------------------------------------------

test("assertCausalWorldEventRecordedPayload validates a correct payload", () => {
  const causalEvent = minimalCausalWorldEvent();
  const epochEvent = causalWorldEventToEpochEvent(causalEvent);

  const payload = assertCausalWorldEventRecordedPayload(epochEvent.payload);

  assert.equal(payload.schemaVersion, CAUSAL_WORLD_EVENT_RECORDED_PAYLOAD_SCHEMA_VERSION);
  assert.equal(payload.adapterVersion, CAUSAL_EPOCH_ADAPTER_VERSION);
  assert.deepEqual(payload.causalEvent, causalEvent);
  assert.equal(payload.worldTime.occurredAtWorldMinute, 10);
  assert.equal(payload.worldTime.recordedAt, "2026-07-20T00:00:00.000Z");
});

test("assertCausalWorldEventRecordedPayload rejects null input", () => {
  assert.throws(
    () => assertCausalWorldEventRecordedPayload(null),
    /causal_world_event_payload_required/,
  );
});

test("assertCausalWorldEventRecordedPayload rejects non-object input", () => {
  assert.throws(
    () => assertCausalWorldEventRecordedPayload("not_an_object"),
    /causal_world_event_payload_required/,
  );
});

test("assertCausalWorldEventRecordedPayload rejects wrong schemaVersion", () => {
  const causalEvent = minimalCausalWorldEvent();
  const epochEvent = causalWorldEventToEpochEvent(causalEvent);

  assert.throws(
    () => assertCausalWorldEventRecordedPayload({
      ...epochEvent.payload,
      schemaVersion: "9.9.9",
    }),
    /causal_world_event_payload_schema_version_invalid/,
  );
});

test("assertCausalWorldEventRecordedPayload rejects wrong adapterVersion", () => {
  const causalEvent = minimalCausalWorldEvent();
  const epochEvent = causalWorldEventToEpochEvent(causalEvent);

  assert.throws(
    () => assertCausalWorldEventRecordedPayload({
      ...epochEvent.payload,
      adapterVersion: "wrong_version",
    }),
    /causal_world_event_adapter_version_invalid/,
  );
});

test("assertCausalWorldEventRecordedPayload rejects missing worldTime", () => {
  const causalEvent = minimalCausalWorldEvent();
  const epochEvent = causalWorldEventToEpochEvent(causalEvent);

  assert.throws(
    () => assertCausalWorldEventRecordedPayload({
      ...epochEvent.payload,
      worldTime: undefined,
    }),
    /causal_world_event_world_time_required/,
  );
});

test("assertCausalWorldEventRecordedPayload rejects mismatched worldTime", () => {
  const causalEvent = minimalCausalWorldEvent();
  const epochEvent = causalWorldEventToEpochEvent(causalEvent);

  assert.throws(
    () => assertCausalWorldEventRecordedPayload({
      ...epochEvent.payload,
      worldTime: {
        occurredAtWorldMinute: 999,
        recordedAt: "2099-01-01T00:00:00.000Z",
      },
    }),
    /causal_world_event_world_time_mismatch/,
  );
});

// ---------------------------------------------------------------------------
// causalWorldEventsFromEpochEvents
// ---------------------------------------------------------------------------

test("causalWorldEventsFromEpochEvents filters causal events from mixed event list", () => {
  const causal1 = minimalCausalWorldEvent({ eventId: "causal_1" });
  const causal2 = minimalCausalWorldEvent({ eventId: "causal_2" });
  const epochEvents: readonly EpochEvent[] = [
    legacyEpochEvent(),
    causalWorldEventToEpochEvent(causal1),
    legacyEpochEvent(),
    causalWorldEventToEpochEvent(causal2),
  ];

  const result = causalWorldEventsFromEpochEvents(epochEvents);

  assert.equal(result.length, 2);
  assert.equal(result[0]?.eventId, "causal_2");
  assert.equal(result[1]?.eventId, "causal_1");
});

test("causalWorldEventsFromEpochEvents returns results in reverse chronological order (newest first)", () => {
  const events: readonly EpochEvent[] = [
    causalWorldEventToEpochEvent(minimalCausalWorldEvent({ eventId: "first" })),
    causalWorldEventToEpochEvent(minimalCausalWorldEvent({ eventId: "second" })),
    causalWorldEventToEpochEvent(minimalCausalWorldEvent({ eventId: "third" })),
  ];

  const result = causalWorldEventsFromEpochEvents(events);

  assert.deepEqual(result.map((e) => e.eventId), ["third", "second", "first"]);
});

test("causalWorldEventsFromEpochEvents applies limit", () => {
  const events: readonly EpochEvent[] = [
    causalWorldEventToEpochEvent(minimalCausalWorldEvent({ eventId: "a" })),
    causalWorldEventToEpochEvent(minimalCausalWorldEvent({ eventId: "b" })),
    causalWorldEventToEpochEvent(minimalCausalWorldEvent({ eventId: "c" })),
  ];

  const result = causalWorldEventsFromEpochEvents(events, { limit: 2 });

  assert.equal(result.length, 2);
  assert.deepEqual(result.map((e) => e.eventId), ["c", "b"]);
});

test("causalWorldEventsFromEpochEvents filters by eventType", () => {
  const events: readonly EpochEvent[] = [
    causalWorldEventToEpochEvent(minimalCausalWorldEvent({ eventId: "a", eventType: "resource_granted" })),
    causalWorldEventToEpochEvent(minimalCausalWorldEvent({ eventId: "b", eventType: "world_clock_advanced" })),
  ];

  const result = causalWorldEventsFromEpochEvents(events, { eventType: "resource_granted" });

  assert.equal(result.length, 1);
  assert.equal(result[0]?.eventId, "a");
});

test("causalWorldEventsFromEpochEvents filters by worldId", () => {
  const events: readonly EpochEvent[] = [
    causalWorldEventToEpochEvent(minimalCausalWorldEvent({ eventId: "a", worldId: "world_1" })),
    causalWorldEventToEpochEvent(minimalCausalWorldEvent({ eventId: "b", worldId: "world_2" })),
  ];

  const result = causalWorldEventsFromEpochEvents(events, { worldId: "world_2" });

  assert.equal(result.length, 1);
  assert.equal(result[0]?.eventId, "b");
});

test("causalWorldEventsFromEpochEvents filters by namespace", () => {
  const events: readonly EpochEvent[] = [
    causalWorldEventToEpochEvent(minimalCausalWorldEvent({ eventId: "a", namespace: "world" })),
    causalWorldEventToEpochEvent(minimalCausalWorldEvent({ eventId: "b", namespace: "identity" })),
  ];

  const result = causalWorldEventsFromEpochEvents(events, { namespace: "identity" });

  assert.equal(result.length, 1);
  assert.equal(result[0]?.eventId, "b");
});

test("causalWorldEventsFromEpochEvents filters by agentId", () => {
  const events: readonly EpochEvent[] = [
    causalWorldEventToEpochEvent(minimalCausalWorldEvent({ eventId: "a" })),
    causalWorldEventToEpochEvent(minimalCausalWorldEvent({
      eventId: "b",
      actorRefs: [{ actorType: "player_identity", actorId: "agent_2" }],
    })),
  ];

  const result = causalWorldEventsFromEpochEvents(events, { agentId: "agent_2" });

  assert.equal(result.length, 1);
  assert.equal(result[0]?.eventId, "b");
});

test("causalWorldEventsFromEpochEvents filters by explorerId", () => {
  const events: readonly EpochEvent[] = [
    causalWorldEventToEpochEvent(minimalCausalWorldEvent({ eventId: "a" })),
    causalWorldEventToEpochEvent(minimalCausalWorldEvent({
      eventId: "b",
      actorRefs: [{ actorType: "system", actorId: "explorer_xyz" }],
    })),
  ];

  const result = causalWorldEventsFromEpochEvents(events, { explorerId: "explorer_xyz" });

  assert.equal(result.length, 1);
  assert.equal(result[0]?.eventId, "b");
});

test("causalWorldEventsFromEpochEvents filters by actorRef", () => {
  const events: readonly EpochEvent[] = [
    causalWorldEventToEpochEvent(minimalCausalWorldEvent({ eventId: "a" })),
    causalWorldEventToEpochEvent(minimalCausalWorldEvent({
      eventId: "b",
      actorRefs: [{ actorType: "npc", actorId: "npc_42" }],
    })),
  ];

  const result = causalWorldEventsFromEpochEvents(events, { actorRef: "npc:npc_42" });

  assert.equal(result.length, 1);
  assert.equal(result[0]?.eventId, "b");
});

test("causalWorldEventsFromEpochEvents filters by subjectRef", () => {
  const events: readonly EpochEvent[] = [
    causalWorldEventToEpochEvent(minimalCausalWorldEvent({ eventId: "a" })),
    causalWorldEventToEpochEvent(minimalCausalWorldEvent({
      eventId: "b",
      subjectRefs: [{ entityType: "region", entityId: "region_red_gate" }],
    })),
  ];

  const result = causalWorldEventsFromEpochEvents(events, { subjectRef: "region:region_red_gate" });

  assert.equal(result.length, 1);
  assert.equal(result[0]?.eventId, "b");
});

test("causalWorldEventsFromEpochEvents filters by regionId", () => {
  const events: readonly EpochEvent[] = [
    causalWorldEventToEpochEvent(minimalCausalWorldEvent({ eventId: "a" })),
    causalWorldEventToEpochEvent(minimalCausalWorldEvent({
      eventId: "b",
      regionRefs: ["region_red_gate"],
    })),
  ];

  const result = causalWorldEventsFromEpochEvents(events, { regionId: "region_red_gate" });

  assert.equal(result.length, 1);
  assert.equal(result[0]?.eventId, "b");
});

test("causalWorldEventsFromEpochEvents returns empty array when no causal events match", () => {
  const events: readonly EpochEvent[] = [
    legacyEpochEvent(),
  ];

  const result = causalWorldEventsFromEpochEvents(events);

  assert.equal(result.length, 0);
});

test("causalWorldEventsFromEpochEvents uses default limit of 50", () => {
  const events: readonly EpochEvent[] = Array.from({ length: 60 }, (_, i) =>
    causalWorldEventToEpochEvent(minimalCausalWorldEvent({ eventId: `event_${i}` })),
  );

  const result = causalWorldEventsFromEpochEvents(events);

  assert.equal(result.length, 50);
});

// ---------------------------------------------------------------------------
// causalEpochEventCanonicalJson
// ---------------------------------------------------------------------------

test("causalEpochEventCanonicalJson returns a string", () => {
  const legacy = legacyEpochEvent();

  const json = causalEpochEventCanonicalJson(legacy);

  assert.equal(typeof json, "string");
  assert.ok(json.length > 0);
});

test("causalEpochEventCanonicalJson produces deterministic output for same input", () => {
  const legacy = legacyEpochEvent();

  const json1 = causalEpochEventCanonicalJson(legacy);
  const json2 = causalEpochEventCanonicalJson(legacy);

  assert.equal(json1, json2);
});

test("causalEpochEventCanonicalJson returns valid JSON", () => {
  const causalEvent = minimalCausalWorldEvent();
  const epochEvent = causalWorldEventToEpochEvent(causalEvent);

  const json = causalEpochEventCanonicalJson(epochEvent);

  assert.doesNotThrow(() => JSON.parse(json));
});
