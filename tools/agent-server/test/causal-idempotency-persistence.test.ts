import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
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
import {
  createCausalWriteCoordinator,
  type CausalCommitBundle,
  type CausalWriteSnapshot,
} from "../lib/epoch/causalWriteCoordinator.ts";
import {
  causalIdempotencyScope,
  createInMemoryCausalIdempotencyManifestStore,
} from "../lib/epoch/causalIdempotencyRules.ts";
import { createJsonlCausalIdempotencyManifestStore } from "../lib/epoch/causalIdempotencyPersistence.ts";
import {
  createSqliteCausalIdempotencyManifestStore,
  readSqliteJsonlRecords,
} from "../lib/sqliteStore.ts";

const RECORDED_AT = "2026-07-20T00:00:00.000Z";
const LATER_AT = "2026-07-20T00:00:01.000Z";
const WORLD_ID = "world_idempotency_persistence";
const ACTOR: CausalActorRef = { actorType: "system", actorId: "clock" };
const FAKE_HASH = `sha256:${"0".repeat(64)}` as const;

function deferred<T = void>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

function makeCommand(overrides: Partial<CommandIntentV1> = {}): CommandIntentV1 {
  return {
    commandId: "cmd_idempotency_persistence",
    commandType: "test.clock.initialize",
    commandSchemaVersion: CAUSAL_COMMAND_SCHEMA_VERSION,
    worldId: WORLD_ID,
    namespace: "world",
    actor: ACTOR,
    submittedAt: RECORDED_AT,
    requestedWorldMinute: 1,
    idempotencyKey: "idem_persistent_clock_init",
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
  return { knownEvents: {} };
}

function makeCandidate(
  command: CommandIntentV1,
  context: { readonly recordedAt: string; readonly registryVersion: string; readonly registryHash: `sha256:${string}` },
): CausalWorldEventCandidateV1 {
  const eventId = `evt_${command.commandId}_${command.payload.minute}`;
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
      streamVersion: Number(command.payload.minute),
    },
    occurredAtWorldMinute: command.requestedWorldMinute ?? 1,
    recordedAt: context.recordedAt,
    actorRefs: [command.actor],
    subjectRefs: [{ entityType: "world", entityId: command.worldId }],
    regionRefs: [],
    command: {
      commandId: "candidate_spoof",
      commandType: "candidate_spoof",
      idempotencyKey: "candidate_spoof",
      inputHash: FAKE_HASH,
    },
    causality: {
      causalParentEventIds: [],
      rootPressureIds: [],
      rootReason: "external_clock",
    },
    authorizationRefs: ["auth:system"],
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
  };
}

function createCoordinator(options: {
  readonly store: ReturnType<typeof createInMemoryCausalIdempotencyManifestStore>;
  readonly ownerId: string;
  readonly now?: () => string;
  readonly buildGate?: Promise<void>;
  readonly commit?: (bundle: CausalCommitBundle) => void | Promise<void>;
  readonly eventLog?: Map<string, CausalWorldEventV1>;
}) {
  const eventLog = options.eventLog || new Map<string, CausalWorldEventV1>();
  return createCausalWriteCoordinator({
    idempotencyStore: options.store,
    ownerId: options.ownerId,
    reservationLeaseMs: 10,
    now: options.now || (() => RECORDED_AT),
    loadSnapshot: () => snapshot(),
    buildEvent: async (command, _snapshot, context) => {
      await options.buildGate;
      return makeCandidate(command, context);
    },
    commit: (bundle) => {
      options.commit?.(bundle);
      eventLog.set(bundle.event.eventId, bundle.event);
    },
    loadCommittedEvent: (eventId) => eventLog.get(eventId),
  });
}

test("two coordinator instances with the same scope reserve once before append and reject different input", async () => {
  const store = createInMemoryCausalIdempotencyManifestStore();
  const eventLog = new Map<string, CausalWorldEventV1>();
  const gate = deferred();
  const commits: CausalCommitBundle[] = [];
  const first = createCoordinator({
    store,
    ownerId: "owner:first",
    buildGate: gate.promise,
    commit: (bundle) => commits.push(bundle),
    eventLog,
  });
  const second = createCoordinator({
    store,
    ownerId: "owner:second",
    eventLog,
  });

  const winning = first.execute(makeCommand());
  await assert.rejects(
    second.execute(makeCommand({ payload: { minute: 2 } })),
    (error: unknown) => Boolean(error && typeof error === "object" && "code" in error
      && error.code === "causal_idempotency_conflict"),
  );
  assert.equal(commits.length, 0);

  gate.resolve();
  const result = await winning;
  assert.equal(result.replayed, false);
  assert.equal(commits.length, 1);
});

test("concurrent same-input loser receives retryable pending, then replays committed result", async () => {
  const store = createInMemoryCausalIdempotencyManifestStore();
  const eventLog = new Map<string, CausalWorldEventV1>();
  const gate = deferred();
  const first = createCoordinator({ store, ownerId: "owner:first", buildGate: gate.promise, eventLog });
  const second = createCoordinator({ store, ownerId: "owner:second", eventLog });

  const winning = first.execute(makeCommand());
  await assert.rejects(
    second.execute(makeCommand()),
    (error: unknown) => {
      assert.ok(error instanceof CausalValidationError);
      assert.equal(error.code, "CANONICAL_APPEND_FAILED");
      assert.equal(error.retryable, true);
      assert.equal(error.details.reason, "causal_idempotency_pending");
      return true;
    },
  );

  gate.resolve();
  const committed = await winning;
  const replay = await second.execute(makeCommand());
  assert.equal(replay.replayed, true);
  assert.equal(replay.event.eventId, committed.event.eventId);
});

test("stale reservation can be stolen and old owner is fenced before append", async () => {
  const store = createInMemoryCausalIdempotencyManifestStore();
  const eventLog = new Map<string, CausalWorldEventV1>();
  const oldGate = deferred();
  const staleCommits: CausalCommitBundle[] = [];
  const freshCommits: CausalCommitBundle[] = [];
  const stale = createCoordinator({
    store,
    ownerId: "owner:stale",
    now: () => RECORDED_AT,
    buildGate: oldGate.promise,
    commit: (bundle) => staleCommits.push(bundle),
    eventLog,
  });
  const fresh = createCoordinator({
    store,
    ownerId: "owner:fresh",
    now: () => LATER_AT,
    commit: (bundle) => freshCommits.push(bundle),
    eventLog,
  });

  const staleAttempt = stale.execute(makeCommand());
  const freshResult = await fresh.execute(makeCommand());
  assert.equal(freshResult.replayed, false);
  assert.equal(freshCommits.length, 1);

  oldGate.resolve();
  await assert.rejects(staleAttempt, (error: unknown) => {
    assert.ok(error instanceof CausalValidationError);
    assert.equal(error.code, "CANONICAL_APPEND_FAILED");
    assert.equal(error.retryable, true);
    return true;
  });
  assert.equal(staleCommits.length, 0);
});

test("JSONL idempotency store recovers pending and committed reservations across instances", async () => {
  const tempDir = await mkdtemp(path.join(tmpdir(), "causal-idempotency-jsonl-"));
  try {
    const input = {
      worldId: WORLD_ID,
      commandType: "test.clock.initialize",
      actorRef: "system:clock",
      idempotencyKey: "idem_jsonl_recovery",
      input: { minute: 1 },
    };
    const scope = causalIdempotencyScope(input);
    const first = createJsonlCausalIdempotencyManifestStore(tempDir);
    const claim = await first.claimReservation!(input, {
      ownerId: "owner:first",
      now: RECORDED_AT,
      leaseExpiresAt: "2026-07-20T00:00:00.010Z",
    });
    assert.equal(claim.kind, "reserved");

    const recoveredPending = await createJsonlCausalIdempotencyManifestStore(tempDir).claimReservation!(input, {
      ownerId: "owner:second",
      now: RECORDED_AT,
      leaseExpiresAt: "2026-07-20T00:00:00.010Z",
    });
    assert.equal(recoveredPending.kind, "pending");

    const stolen = await createJsonlCausalIdempotencyManifestStore(tempDir).claimReservation!(input, {
      ownerId: "owner:fresh",
      now: LATER_AT,
      leaseExpiresAt: "2026-07-20T00:00:02.000Z",
    });
    assert.equal(stolen.kind, "reserved");
    assert.equal(stolen.reservation.manifest.fencingToken, 2);
    await createJsonlCausalIdempotencyManifestStore(tempDir).finalizeReservation!(
      stolen.reservation,
      {
        ...stolen.reservation.manifest,
        status: "committed",
        eventIds: ["evt_jsonl_recovered"],
        updatedAt: LATER_AT,
      },
    );

    const recovered = await createJsonlCausalIdempotencyManifestStore(tempDir).read(scope);
    assert.equal(recovered?.status, "committed");
    assert.deepEqual(recovered?.eventIds, ["evt_jsonl_recovered"]);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("SQLite idempotency store commits canonical append and final manifest in one fenced transaction", async () => {
  const tempDir = await mkdtemp(path.join(tmpdir(), "causal-idempotency-sqlite-"));
  const dbPath = path.join(tempDir, "agent-world.sqlite");
  try {
    const store = createSqliteCausalIdempotencyManifestStore(dbPath);
    const eventLog = new Map<string, CausalWorldEventV1>();
    const coordinator = createCausalWriteCoordinator({
      idempotencyStore: store,
      ownerId: "owner:sqlite",
      now: () => RECORDED_AT,
      loadSnapshot: () => snapshot(),
      buildEvent: (command, _snapshot, context) => makeCandidate(command, context),
      commit: (bundle) => {
        assert.ok(bundle.atomic?.appendJsonl);
        bundle.atomic.appendJsonl("command-events.jsonl", {
          type: "causal_command_result",
          eventId: bundle.event.eventId,
        });
        eventLog.set(bundle.event.eventId, bundle.event);
      },
      loadCommittedEvent: (eventId) => eventLog.get(eventId),
    });

    const result = await coordinator.execute(makeCommand({ commandId: "cmd_sqlite_atomic" }));
    assert.equal(result.replayed, false);

    const records = readSqliteJsonlRecords(dbPath, "command-events.jsonl");
    assert.equal(records.length, 1);
    assert.equal(records[0].eventId, result.event.eventId);
    const scope = causalIdempotencyScope({
      worldId: result.event.worldId,
      commandType: result.event.command.commandType,
      actorRef: "system:clock",
      idempotencyKey: result.event.command.idempotencyKey,
    });
    assert.equal((await store.read(scope))?.status, "committed");
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
