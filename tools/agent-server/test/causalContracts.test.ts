import assert from "node:assert/strict";
import test from "node:test";
import {
  CausalValidationError,
  isCausalValidationError,
  isCausalRecord,
  causalActorRefKey,
  assertCausalText,
  assertCausalActorRef,
  assertCausalEntityRef,
  assertCommandIntentV1,
  assertCausalEffectV1,
  assertCausalWorldEventV1,
  assertCommandResultManifestV1,
  CAUSAL_COMMAND_SCHEMA_VERSION,
  CAUSAL_EVENT_SCHEMA_VERSION,
  CAUSAL_RESULT_MANIFEST_VERSION,
} from "../lib/epoch/causalContracts.ts";

// ---------------------------------------------------------------------------
// CausalValidationError
// ---------------------------------------------------------------------------

test("CausalValidationError stores code, details, and sets name", () => {
  const err = new CausalValidationError("CAUSAL_SCHEMA_INVALID", { field: "foo" });
  assert.equal(err.name, "CausalValidationError");
  assert.equal(err.code, "CAUSAL_SCHEMA_INVALID");
  assert.deepEqual(err.details, { field: "foo" });
  assert.equal(err instanceof Error, true);
  assert.equal(err instanceof CausalValidationError, true);
});

test("CausalValidationError retryable is true for retryable error codes", () => {
  const retryable = new CausalValidationError("STREAM_VERSION_CONFLICT", {});
  assert.equal(retryable.retryable, true);
  const nonRetryable = new CausalValidationError("CAUSAL_SCHEMA_INVALID", {});
  assert.equal(nonRetryable.retryable, false);
});

test("CausalValidationError stores cause when provided", () => {
  const original = new Error("root cause");
  const err = new CausalValidationError("CAUSAL_SCHEMA_INVALID", {}, original);
  assert.equal(err.cause, original);
});

test("CausalValidationError defaults details to empty object", () => {
  const err = new CausalValidationError("CAUSAL_SCHEMA_INVALID");
  assert.deepEqual(err.details, {});
});

// ---------------------------------------------------------------------------
// isCausalValidationError
// ---------------------------------------------------------------------------

test("isCausalValidationError returns true for CausalValidationError instances", () => {
  const err = new CausalValidationError("CAUSAL_SCHEMA_INVALID", {});
  assert.equal(isCausalValidationError(err), true);
});

test("isCausalValidationError returns false for plain Error", () => {
  assert.equal(isCausalValidationError(new Error("nope")), false);
});

test("isCausalValidationError returns false for non-error values", () => {
  assert.equal(isCausalValidationError(null), false);
  assert.equal(isCausalValidationError(undefined), false);
  assert.equal(isCausalValidationError("string"), false);
  assert.equal(isCausalValidationError(42), false);
});

// ---------------------------------------------------------------------------
// isCausalRecord
// ---------------------------------------------------------------------------

test("isCausalRecord returns true for plain objects", () => {
  assert.equal(isCausalRecord({}), true);
  assert.equal(isCausalRecord({ a: 1 }), true);
});

test("isCausalRecord returns false for arrays", () => {
  assert.equal(isCausalRecord([]), false);
  assert.equal(isCausalRecord([1, 2]), false);
});

test("isCausalRecord returns false for null and primitives", () => {
  assert.equal(isCausalRecord(null), false);
  assert.equal(isCausalRecord(undefined), false);
  assert.equal(isCausalRecord("string"), false);
  assert.equal(isCausalRecord(0), false);
  assert.equal(isCausalRecord(false), false);
});

// ---------------------------------------------------------------------------
// causalActorRefKey
// ---------------------------------------------------------------------------

test("causalActorRefKey produces actorType:actorId string", () => {
  assert.equal(causalActorRefKey({ actorType: "player_identity", actorId: "p1" }), "player_identity:p1");
  assert.equal(causalActorRefKey({ actorType: "system", actorId: "sys0" }), "system:sys0");
});

// ---------------------------------------------------------------------------
// assertCausalText
// ---------------------------------------------------------------------------

test("assertCausalText accepts non-empty trimmed strings", () => {
  assert.equal(assertCausalText("hello", "field"), "hello");
  assert.equal(assertCausalText("  abc  ", "field"), "  abc  ");
});

test("assertCausalText throws for empty string", () => {
  assert.throws(
    () => assertCausalText("", "field"),
    (err: unknown) => err instanceof CausalValidationError && err.details.field === "field",
  );
});

test("assertCausalText throws for whitespace-only string", () => {
  assert.throws(
    () => assertCausalText("   ", "field"),
    (err: unknown) => err instanceof CausalValidationError && err.details.field === "field",
  );
});

test("assertCausalText throws for non-string values", () => {
  assert.throws(() => assertCausalText(123, "field"), CausalValidationError);
  assert.throws(() => assertCausalText(null, "field"), CausalValidationError);
  assert.throws(() => assertCausalText(undefined, "field"), CausalValidationError);
  assert.throws(() => assertCausalText({}, "field"), CausalValidationError);
});

// ---------------------------------------------------------------------------
// assertCausalActorRef
// ---------------------------------------------------------------------------

test("assertCausalActorRef accepts valid actor ref", () => {
  const ref = assertCausalActorRef({ actorType: "player_identity", actorId: "p1" });
  assert.equal(ref.actorType, "player_identity");
  assert.equal(ref.actorId, "p1");
});

test("assertCausalActorRef accepts all valid actor types", () => {
  const types = ["player_identity", "npc", "household", "organization", "system"] as const;
  for (const actorType of types) {
    const ref = assertCausalActorRef({ actorType, actorId: "id" });
    assert.equal(ref.actorType, actorType);
  }
});

test("assertCausalActorRef throws for invalid actorType", () => {
  assert.throws(
    () => assertCausalActorRef({ actorType: "invalid_type", actorId: "id" }),
    (err: unknown) => err instanceof CausalValidationError && err.details.field === "actor.actorType",
  );
});

test("assertCausalActorRef throws when actorType is missing", () => {
  assert.throws(() => assertCausalActorRef({ actorId: "id" }), CausalValidationError);
});

test("assertCausalActorRef throws when actorId is missing", () => {
  assert.throws(() => assertCausalActorRef({ actorType: "npc" }), CausalValidationError);
});

test("assertCausalActorRef throws for non-object input", () => {
  assert.throws(() => assertCausalActorRef(null), CausalValidationError);
  assert.throws(() => assertCausalActorRef("string"), CausalValidationError);
  assert.throws(() => assertCausalActorRef(42), CausalValidationError);
});

test("assertCausalActorRef uses custom field name in errors", () => {
  assert.throws(
    () => assertCausalActorRef(null, "customField"),
    (err: unknown) => err instanceof CausalValidationError && err.details.field === "customField",
  );
});

// ---------------------------------------------------------------------------
// assertCausalEntityRef
// ---------------------------------------------------------------------------

test("assertCausalEntityRef accepts valid entity ref", () => {
  const ref = assertCausalEntityRef({ entityType: "region", entityId: "r1" });
  assert.equal(ref.entityType, "region");
  assert.equal(ref.entityId, "r1");
});

test("assertCausalEntityRef throws when entityType is missing", () => {
  assert.throws(() => assertCausalEntityRef({ entityId: "r1" }), CausalValidationError);
});

test("assertCausalEntityRef throws when entityId is missing", () => {
  assert.throws(() => assertCausalEntityRef({ entityType: "region" }), CausalValidationError);
});

test("assertCausalEntityRef throws for non-object input", () => {
  assert.throws(() => assertCausalEntityRef(null), CausalValidationError);
  assert.throws(() => assertCausalEntityRef(undefined), CausalValidationError);
  assert.throws(() => assertCausalEntityRef(0), CausalValidationError);
});

test("assertCausalEntityRef uses custom field name in errors", () => {
  assert.throws(
    () => assertCausalEntityRef(null, "myEntity"),
    (err: unknown) => err instanceof CausalValidationError && err.details.field === "myEntity",
  );
});

// ---------------------------------------------------------------------------
// assertCommandIntentV1
// ---------------------------------------------------------------------------

function validCommandIntent(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    commandId: "cmd-001",
    commandType: "world.apply_effect",
    commandSchemaVersion: CAUSAL_COMMAND_SCHEMA_VERSION,
    worldId: "w1",
    namespace: "world",
    actor: { actorType: "system", actorId: "sys" },
    submittedAt: "2026-01-01T00:00:00.000Z",
    idempotencyKey: "idem-001",
    expectedStreamVersions: [
      { streamType: "world", streamId: "w1", expectedVersion: 0 },
    ],
    authorizationRefs: ["auth-1"],
    causalParentEventIds: [],
    rootPressureIds: [],
    payload: { action: "test" },
    ...overrides,
  };
}

test("assertCommandIntentV1 accepts a fully valid command intent", () => {
  const cmd = assertCommandIntentV1(validCommandIntent());
  assert.equal(cmd.commandId, "cmd-001");
  assert.equal(cmd.namespace, "world");
  assert.equal(cmd.commandSchemaVersion, CAUSAL_COMMAND_SCHEMA_VERSION);
  assert.equal(cmd.actor.actorType, "system");
  assert.equal(cmd.expectedStreamVersions.length, 1);
  assert.deepEqual(cmd.authorizationRefs, ["auth-1"]);
});

test("assertCommandIntentV1 accepts command with requestedWorldMinute", () => {
  const cmd = assertCommandIntentV1(validCommandIntent({ requestedWorldMinute: 100 }));
  assert.equal(cmd.requestedWorldMinute, 100);
});

test("assertCommandIntentV1 accepts all valid namespaces", () => {
  for (const ns of ["world", "lineage", "identity", "run"]) {
    const cmd = assertCommandIntentV1(validCommandIntent({ namespace: ns }));
    assert.equal(cmd.namespace, ns);
  }
});

test("assertCommandIntentV1 throws for non-object input", () => {
  assert.throws(
    () => assertCommandIntentV1(null),
    (err: unknown) => err instanceof CausalValidationError && err.details.field === "command",
  );
});

test("assertCommandIntentV1 throws for invalid namespace", () => {
  assert.throws(
    () => assertCommandIntentV1(validCommandIntent({ namespace: "invalid" })),
    (err: unknown) => err instanceof CausalValidationError && err.details.field === "namespace",
  );
});

test("assertCommandIntentV1 throws for wrong commandSchemaVersion", () => {
  assert.throws(
    () => assertCommandIntentV1(validCommandIntent({ commandSchemaVersion: "2.0.0" })),
    (err: unknown) => err instanceof CausalValidationError && err.details.field === "commandSchemaVersion",
  );
});

test("assertCommandIntentV1 throws when payload is missing", () => {
  const input = validCommandIntent();
  delete input.payload;
  assert.throws(
    () => assertCommandIntentV1(input),
    (err: unknown) => err instanceof CausalValidationError && err.details.field === "payload",
  );
});

test("assertCommandIntentV1 throws when expectedStreamVersions is not an array", () => {
  assert.throws(
    () => assertCommandIntentV1(validCommandIntent({ expectedStreamVersions: "not-array" })),
    (err: unknown) => err instanceof CausalValidationError && err.details.field === "expectedStreamVersions",
  );
});

test("assertCommandIntentV1 throws for invalid stream version entry", () => {
  assert.throws(
    () => assertCommandIntentV1(validCommandIntent({ expectedStreamVersions: [{ streamType: "x", streamId: "y" }] })),
    (err: unknown) =>
      err instanceof CausalValidationError && err.details.field === "expectedStreamVersions[0]",
  );
});

test("assertCommandIntentV1 throws for negative expectedVersion", () => {
  assert.throws(
    () =>
      assertCommandIntentV1(
        validCommandIntent({
          expectedStreamVersions: [{ streamType: "x", streamId: "y", expectedVersion: -1 }],
        }),
      ),
    CausalValidationError,
  );
});

test("assertCommandIntentV1 throws for invalid submittedAt timestamp", () => {
  assert.throws(
    () => assertCommandIntentV1(validCommandIntent({ submittedAt: "not-a-date" })),
    (err: unknown) => err instanceof CausalValidationError && err.details.field === "submittedAt",
  );
});

test("assertCommandIntentV1 throws for invalid requestedWorldMinute", () => {
  assert.throws(
    () => assertCommandIntentV1(validCommandIntent({ requestedWorldMinute: -5 })),
    (err: unknown) => err instanceof CausalValidationError && err.details.field === "requestedWorldMinute",
  );
});

test("assertCommandIntentV1 throws for non-integer requestedWorldMinute", () => {
  assert.throws(
    () => assertCommandIntentV1(validCommandIntent({ requestedWorldMinute: 3.14 })),
    CausalValidationError,
  );
});

test("assertCommandIntentV1 throws when commandId is missing", () => {
  const input = validCommandIntent();
  delete input.commandId;
  assert.throws(() => assertCommandIntentV1(input), CausalValidationError);
});

test("assertCommandIntentV1 throws when actor is invalid", () => {
  assert.throws(
    () => assertCommandIntentV1(validCommandIntent({ actor: { actorType: "bad", actorId: "x" } })),
    (err: unknown) =>
      err instanceof CausalValidationError && err.details.field === "actor.actorType",
  );
});

test("assertCommandIntentV1 throws when authorizationRefs contains non-string", () => {
  assert.throws(
    () => assertCommandIntentV1(validCommandIntent({ authorizationRefs: [42] })),
    (err: unknown) =>
      err instanceof CausalValidationError && err.details.field === "authorizationRefs[0]",
  );
});

test("assertCommandIntentV1 throws when authorizationRefs is not an array", () => {
  assert.throws(
    () => assertCommandIntentV1(validCommandIntent({ authorizationRefs: "not-array" })),
    CausalValidationError,
  );
});

test("assertCommandIntentV1 accepts empty arrays for string array fields", () => {
  const cmd = assertCommandIntentV1(
    validCommandIntent({
      authorizationRefs: [],
      causalParentEventIds: [],
      rootPressureIds: [],
    }),
  );
  assert.deepEqual(cmd.authorizationRefs, []);
  assert.deepEqual(cmd.causalParentEventIds, []);
  assert.deepEqual(cmd.rootPressureIds, []);
});

// ---------------------------------------------------------------------------
// assertCausalEffectV1
// ---------------------------------------------------------------------------

function validEffect(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    effectId: "eff-001",
    effectType: "resource_ledger",
    targetRef: { entityType: "account", entityId: "a1" },
    operation: "credit",
    after: { resourceKey: "gold", resourceClass: "currency", unit: "minor", entries: [] },
    sourceEventIds: ["evt-1"],
    authorizationRefs: ["auth-1"],
    ...overrides,
  };
}

test("assertCausalEffectV1 accepts a valid effect", () => {
  const eff = assertCausalEffectV1(validEffect());
  assert.equal(eff.effectId, "eff-001");
  assert.equal(eff.effectType, "resource_ledger");
  assert.equal(eff.targetRef.entityType, "account");
});

test("assertCausalEffectV1 accepts all valid effect types", () => {
  const types = [
    "resource_ledger",
    "unique_item_lifecycle",
    "ownership_interest",
    "state_transition",
    "relationship_delta",
    "knowledge_delta",
    "pressure_delta",
    "legal_delta",
    "world_predicate",
  ];
  for (const effectType of types) {
    const eff = assertCausalEffectV1(validEffect({ effectType }));
    assert.equal(eff.effectType, effectType);
  }
});

test("assertCausalEffectV1 throws for invalid effectType", () => {
  assert.throws(
    () => assertCausalEffectV1(validEffect({ effectType: "unknown_type" })),
    (err: unknown) =>
      err instanceof CausalValidationError && String(err.details.field).includes("effectType"),
  );
});

test("assertCausalEffectV1 throws for non-object input", () => {
  assert.throws(() => assertCausalEffectV1(null), CausalValidationError);
  assert.throws(() => assertCausalEffectV1("string"), CausalValidationError);
});

test("assertCausalEffectV1 throws when after is missing", () => {
  const input = validEffect();
  delete input.after;
  assert.throws(() => assertCausalEffectV1(input), CausalValidationError);
});

test("assertCausalEffectV1 throws when targetRef is invalid", () => {
  assert.throws(
    () => assertCausalEffectV1(validEffect({ targetRef: { entityType: "x" } })),
    CausalValidationError,
  );
});

test("assertCausalEffectV1 uses index parameter in error fields", () => {
  assert.throws(
    () => assertCausalEffectV1(null, 3),
    (err: unknown) =>
      err instanceof CausalValidationError && err.details.field === "effects[3]",
  );
});

test("assertCausalEffectV1 accepts optional beforeRef", () => {
  const eff = assertCausalEffectV1(validEffect({ beforeRef: "prev-hash" }));
  assert.equal(eff.beforeRef, "prev-hash");
});

test("assertCausalEffectV1 accepts undefined beforeRef", () => {
  const eff = assertCausalEffectV1(validEffect());
  assert.equal(eff.beforeRef, undefined);
});

// ---------------------------------------------------------------------------
// assertCausalWorldEventV1
// ---------------------------------------------------------------------------

function validHash(): string {
  return "sha256:" + "a".repeat(64);
}

function validWorldEvent(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: CAUSAL_EVENT_SCHEMA_VERSION,
    namespace: "world",
    registryHash: validHash(),
    stream: { streamVersion: 1 },
    command: { inputHash: validHash() },
    causality: {},
    versions: {},
    determinism: {},
    payload: {},
    proof: { payloadHash: validHash(), effectsHash: validHash(), eventHash: validHash() },
    effects: [],
    actorRefs: [],
    subjectRefs: [],
    ...overrides,
  };
}

test("assertCausalWorldEventV1 accepts a valid world event", () => {
  const evt = assertCausalWorldEventV1(validWorldEvent());
  assert.equal(evt.schemaVersion, CAUSAL_EVENT_SCHEMA_VERSION);
  assert.equal(evt.namespace, "world");
});

test("assertCausalWorldEventV1 throws for wrong schemaVersion", () => {
  assert.throws(
    () => assertCausalWorldEventV1(validWorldEvent({ schemaVersion: "9.9.9" })),
    (err: unknown) =>
      err instanceof CausalValidationError && err.details.field === "schemaVersion",
  );
});

test("assertCausalWorldEventV1 throws for non-object input", () => {
  assert.throws(
    () => assertCausalWorldEventV1(null),
    (err: unknown) => err instanceof CausalValidationError && err.details.field === "event",
  );
});

test("assertCausalWorldEventV1 throws for invalid namespace", () => {
  assert.throws(
    () => assertCausalWorldEventV1(validWorldEvent({ namespace: "bad" })),
    (err: unknown) => err instanceof CausalValidationError && err.details.field === "namespace",
  );
});

test("assertCausalWorldEventV1 throws for stream with invalid streamVersion", () => {
  assert.throws(
    () => assertCausalWorldEventV1(validWorldEvent({ stream: { streamVersion: 0 } })),
    (err: unknown) => err instanceof CausalValidationError && err.details.field === "stream",
  );
});

test("assertCausalWorldEventV1 throws when a required section is missing", () => {
  const input = validWorldEvent();
  delete (input as Record<string, unknown>).proof;
  assert.throws(
    () => assertCausalWorldEventV1(input),
    (err: unknown) => err instanceof CausalValidationError && err.details.field === "eventSections",
  );
});

test("assertCausalWorldEventV1 throws for invalid hash format", () => {
  assert.throws(
    () => assertCausalWorldEventV1(validWorldEvent({ registryHash: "not-a-hash" })),
    (err: unknown) => err instanceof CausalValidationError && err.details.field === "registryHash",
  );
});

test("assertCausalWorldEventV1 throws for hash with wrong length", () => {
  assert.throws(
    () => assertCausalWorldEventV1(validWorldEvent({ registryHash: "sha256:abcd" })),
    (err: unknown) => err instanceof CausalValidationError && err.details.field === "registryHash",
  );
});

test("assertCausalWorldEventV1 throws for hash with uppercase hex", () => {
  assert.throws(
    () =>
      assertCausalWorldEventV1(
        validWorldEvent({ registryHash: "sha256:" + "A".repeat(64) }),
      ),
    (err: unknown) => err instanceof CausalValidationError && err.details.field === "registryHash",
  );
});

// ---------------------------------------------------------------------------
// assertCommandResultManifestV1
// ---------------------------------------------------------------------------

function validManifest(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    manifestVersion: CAUSAL_RESULT_MANIFEST_VERSION,
    status: "committed",
    projectionStatus: "current",
    eventIds: ["evt-1"],
    eventHashes: ["hash-1"],
    warnings: [],
    ...overrides,
  };
}

test("assertCommandResultManifestV1 accepts a valid committed manifest", () => {
  const m = assertCommandResultManifestV1(validManifest());
  assert.equal(m.status, "committed");
  assert.equal(m.projectionStatus, "current");
});

test("assertCommandResultManifestV1 accepts a rejected manifest", () => {
  const m = assertCommandResultManifestV1(validManifest({ status: "rejected" }));
  assert.equal(m.status, "rejected");
});

test("assertCommandResultManifestV1 accepts all valid projectionStatus values", () => {
  for (const ps of ["current", "pending", "degraded"]) {
    const m = assertCommandResultManifestV1(validManifest({ projectionStatus: ps }));
    assert.equal(m.projectionStatus, ps);
  }
});

test("assertCommandResultManifestV1 throws for invalid status", () => {
  assert.throws(
    () => assertCommandResultManifestV1(validManifest({ status: "pending" })),
    (err: unknown) =>
      err instanceof CausalValidationError && err.details.field === "resultManifest.status",
  );
});

test("assertCommandResultManifestV1 throws for invalid projectionStatus", () => {
  assert.throws(
    () => assertCommandResultManifestV1(validManifest({ projectionStatus: "unknown" })),
    (err: unknown) =>
      err instanceof CausalValidationError && err.details.field === "resultManifest.projectionStatus",
  );
});

test("assertCommandResultManifestV1 throws for wrong manifestVersion", () => {
  assert.throws(
    () => assertCommandResultManifestV1(validManifest({ manifestVersion: "9.0.0" })),
    (err: unknown) =>
      err instanceof CausalValidationError && err.details.field === "resultManifest",
  );
});

test("assertCommandResultManifestV1 throws for non-object input", () => {
  assert.throws(
    () => assertCommandResultManifestV1(null),
    (err: unknown) =>
      err instanceof CausalValidationError && err.details.field === "resultManifest",
  );
});

test("assertCommandResultManifestV1 throws when eventIds is not an array", () => {
  assert.throws(
    () => assertCommandResultManifestV1(validManifest({ eventIds: "not-array" })),
    (err: unknown) =>
      err instanceof CausalValidationError && err.details.field === "resultManifest",
  );
});

test("assertCommandResultManifestV1 throws when warnings is not an array", () => {
  assert.throws(
    () => assertCommandResultManifestV1(validManifest({ warnings: "not-array" })),
    (err: unknown) =>
      err instanceof CausalValidationError && err.details.field === "resultManifest",
  );
});
