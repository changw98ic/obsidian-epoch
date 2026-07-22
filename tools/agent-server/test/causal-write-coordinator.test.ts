import assert from "node:assert/strict";
import test from "node:test";
import {
  CAUSAL_COMMAND_SCHEMA_VERSION,
  CAUSAL_EVENT_SCHEMA_VERSION,
  CausalValidationError,
  type CausalActorRef,
  type CausalWorldEventCandidateV1,
  type CausalWorldEventV1,
  type CommandIntentV1,
} from "../lib/epoch/causalContracts.ts";
import { causalCanonicalJsonHash } from "../lib/epoch/causalCanonicalJson.ts";
import {
  createCausalWriteCoordinator,
  type CausalCommitBundle,
  type CausalWriteSnapshot,
} from "../lib/epoch/causalWriteCoordinator.ts";
import {
  type CausalIdempotencyManifest,
  type CausalIdempotencyManifestStore,
} from "../lib/epoch/causalIdempotencyRules.ts";

const RECORDED_AT = "2026-07-20T00:00:00.000Z";
const SUBMITTED_AT = "2026-07-20T00:00:00.000Z";
const WORLD_ID = "world_test";
const ACTOR: CausalActorRef = { actorType: "system", actorId: "clock" };
const FAKE_HASH = `sha256:${"0".repeat(64)}` as const;

function createStore() {
  const manifests = new Map<string, CausalIdempotencyManifest>();
  const writes: CausalIdempotencyManifest[] = [];
  const store: CausalIdempotencyManifestStore = {
    read(scope) {
      return manifests.get(scope);
    },
    write(manifest) {
      writes.push(manifest);
      manifests.set(manifest.scope, manifest);
    },
  };
  return { store, writes, manifests };
}

function createHarness(overrides: {
  readonly command?: Partial<CommandIntentV1>;
  readonly candidate?: Partial<CausalWorldEventCandidateV1>;
  readonly store?: CausalIdempotencyManifestStore;
  readonly commit?: (bundle: CausalCommitBundle) => void | Promise<void>;
  readonly project?: (event: CausalWorldEventV1) => void | Promise<void>;
} = {}) {
  const eventLog = new Map<string, CausalWorldEventV1>();
  const commits: CausalCommitBundle[] = [];
  const storeHarness = overrides.store ? undefined : createStore();
  const store = overrides.store || storeHarness!.store;
  const command = makeCommand(overrides.command);
  let buildCalls = 0;
  const coordinator = createCausalWriteCoordinator({
    idempotencyStore: store,
    now: () => RECORDED_AT,
    loadSnapshot: () => snapshot(),
    buildEvent: (_command, _snapshot, context) => {
      buildCalls += 1;
      return makeCandidate(_command, context, overrides.candidate);
    },
    commit: async (bundle) => {
      commits.push(bundle);
      if (overrides.commit) {
        await overrides.commit(bundle);
      }
      eventLog.set(bundle.event.eventId, bundle.event);
    },
    loadCommittedEvent: (eventId) => eventLog.get(eventId),
    project: overrides.project,
  });
  return {
    command,
    coordinator,
    commits,
    eventLog,
    storeWrites: storeHarness?.writes,
    buildCalls: () => buildCalls,
  };
}

function makeCommand(overrides: Partial<CommandIntentV1> = {}): CommandIntentV1 {
  return {
    commandId: "cmd_clock_init",
    commandType: "test.clock.initialize",
    commandSchemaVersion: CAUSAL_COMMAND_SCHEMA_VERSION,
    worldId: WORLD_ID,
    namespace: "world",
    actor: ACTOR,
    submittedAt: SUBMITTED_AT,
    requestedWorldMinute: 1,
    idempotencyKey: "idem_clock_init",
    expectedStreamVersions: [],
    authorizationRefs: ["auth:system"],
    causalParentEventIds: [],
    rootPressureIds: [],
    rootReason: "external_clock",
    payload: { minute: 1 },
    ...overrides,
  };
}

function snapshot(): CausalWriteSnapshot {
  return {
    knownEvents: {},
  };
}

function makeCandidate(
  command: CommandIntentV1,
  context: { readonly recordedAt: string; readonly registryVersion: string; readonly registryHash: `sha256:${string}` },
  overrides: Partial<CausalWorldEventCandidateV1> = {},
): CausalWorldEventCandidateV1 {
  const eventId = `evt_${command.commandId}`;
  return {
    eventId,
    eventType: "world_clock_initialized",
    schemaVersion: CAUSAL_EVENT_SCHEMA_VERSION,
    registryVersion: context.registryVersion,
    registryHash: context.registryHash,
    worldId: command.worldId,
    namespace: command.namespace,
    stream: {
      streamType: "world",
      streamId: command.worldId,
      streamVersion: 1,
    },
    occurredAtWorldMinute: command.requestedWorldMinute ?? 1,
    recordedAt: context.recordedAt,
    actorRefs: [command.actor],
    subjectRefs: [{ entityType: "world", entityId: command.worldId }],
    regionRefs: [],
    command: {
      commandId: "candidate_attempted_to_spoof",
      commandType: "candidate_attempted_to_spoof",
      idempotencyKey: "candidate_attempted_to_spoof",
      inputHash: FAKE_HASH,
    },
    causality: {
      causalParentEventIds: ["candidate_attempted_to_spoof"],
      rootPressureIds: ["candidate_attempted_to_spoof"],
      rootReason: "world_genesis",
    },
    authorizationRefs: ["candidate_attempted_to_spoof"],
    evidenceRefs: [],
    visibilityPolicyRef: "public",
    versions: {
      rulesetVersion: "test-rules",
      contentVersion: "test-content",
      adjudicatorVersion: "test-adjudicator",
    },
    determinism: {
      algorithmId: "test",
      algorithmVersion: "1",
    },
    payload: { minute: command.payload.minute },
    effects: [{
      effectId: `effect_${eventId}`,
      effectType: "world_predicate",
      targetRef: { entityType: "world", entityId: command.worldId },
      operation: "set",
      after: {
        predicateId: `clock:${command.worldId}`,
        subjectRef: { entityType: "world", entityId: command.worldId },
        operator: "eq",
        expectedValue: command.payload.minute,
        evaluationStatus: "true",
        evaluatedAtWorldMinute: command.requestedWorldMinute ?? 1,
      },
      sourceEventIds: [command.commandId],
      authorizationRefs: command.authorizationRefs,
    }],
    proof: {
      payloadHash: FAKE_HASH,
      effectsHash: FAKE_HASH,
      eventHash: FAKE_HASH,
    },
    ...overrides,
  };
}

async function rejectsWithCode(promise: Promise<unknown>, code: CausalValidationError["code"]) {
  await assert.rejects(promise, (error: unknown) => {
    assert.ok(error instanceof CausalValidationError);
    assert.equal(error.code, code);
    return true;
  });
}

async function rejectsWithIdempotencyConflict(promise: Promise<unknown>) {
  await assert.rejects(promise, (error: unknown) => {
    assert.ok(error && typeof error === "object" && "code" in error);
    assert.equal(error.code, "causal_idempotency_conflict");
    return true;
  });
}

test("commits a valid command and records its idempotency manifest", async () => {
  const harness = createHarness();

  const result = await harness.coordinator.execute(harness.command);

  assert.equal(result.replayed, false);
  assert.equal(result.manifest.status, "committed");
  assert.equal(result.manifest.projectionStatus, "current");
  assert.deepEqual(result.manifest.eventIds, [result.event.eventId]);
  assert.equal(harness.commits.length, 1);
  assert.equal(harness.storeWrites?.length, 1);
  assert.equal(harness.storeWrites?.[0]?.status, "committed");
});

test("replays a committed result for the same idempotency key without committing again", async () => {
  const harness = createHarness();

  const first = await harness.coordinator.execute(harness.command);
  const second = await harness.coordinator.execute(harness.command);

  assert.equal(second.replayed, true);
  assert.equal(second.event.eventId, first.event.eventId);
  assert.equal(harness.commits.length, 1);
  assert.equal(harness.buildCalls(), 1);
});

test("rejects same idempotency key when the stable input changes", async () => {
  const harness = createHarness();
  await harness.coordinator.execute(harness.command);

  await rejectsWithIdempotencyConflict(
    harness.coordinator.execute({
      ...harness.command,
      payload: { minute: 2 },
    }),
  );

  assert.equal(harness.commits.length, 1);
});

test("rejects validation failures without committing", async () => {
  const harness = createHarness({
    candidate: {
      actorRefs: [],
    },
  });

  await rejectsWithCode(harness.coordinator.execute(harness.command), "AUTHORIZATION_DENIED");

  assert.equal(harness.commits.length, 0);
  assert.equal(harness.storeWrites?.length, 1);
  assert.equal(harness.storeWrites?.[0]?.status, "rejected");
  assert.equal(harness.storeWrites?.[0]?.rejectionCode, "AUTHORIZATION_DENIED");
});

test("allows retry after append failure because no idempotency manifest is stored", async () => {
  let appendAttempts = 0;
  const harness = createHarness({
    commit: () => {
      appendAttempts += 1;
      if (appendAttempts === 1) throw new Error("append failed");
    },
  });

  await rejectsWithCode(harness.coordinator.execute(harness.command), "CANONICAL_APPEND_FAILED");
  const result = await harness.coordinator.execute(harness.command);

  assert.equal(result.replayed, false);
  assert.equal(appendAttempts, 2);
  assert.equal(harness.storeWrites?.length, 1);
  assert.equal(harness.storeWrites?.[0]?.status, "committed");
});

test("returns a committed degraded result when projection fails", async () => {
  const harness = createHarness({
    project: () => {
      throw new Error("projection unavailable");
    },
  });

  const result = await harness.coordinator.execute(harness.command);

  assert.equal(result.manifest.status, "committed");
  assert.equal(result.manifest.projectionStatus, "degraded");
  assert.deepEqual(result.manifest.warnings, ["PROJECTION_LAGGING"]);
  assert.equal(harness.commits.length, 1);
  assert.equal(harness.storeWrites?.[0]?.status, "committed");
});

test("serializes concurrent executions for the same idempotency key and commits once", async () => {
  const harness = createHarness();

  const [first, second] = await Promise.all([
    harness.coordinator.execute(harness.command),
    harness.coordinator.execute(harness.command),
  ]);

  assert.equal(first.replayed, false);
  assert.equal(second.replayed, true);
  assert.equal(second.event.eventId, first.event.eventId);
  assert.equal(harness.commits.length, 1);
});

test("overwrites candidate proof hashes with coordinator-computed hashes", async () => {
  const harness = createHarness();

  const result = await harness.coordinator.execute(harness.command);

  assert.notEqual(result.event.proof.payloadHash, FAKE_HASH);
  assert.notEqual(result.event.proof.effectsHash, FAKE_HASH);
  assert.notEqual(result.event.proof.eventHash, FAKE_HASH);
  assert.equal(result.event.proof.payloadHash, causalCanonicalJsonHash(result.event.payload));
  assert.equal(result.event.proof.effectsHash, causalCanonicalJsonHash(result.event.effects));
});
