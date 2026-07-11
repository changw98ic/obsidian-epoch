import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import type { EpochEvent } from "../lib/epoch/events.ts";
import { createEpochGameCore } from "../lib/epoch/gameCore.ts";
import { createSequentialEpochIdFactory } from "../lib/epoch/protocol.ts";
import {
  createEpochPersistenceGuard,
  createEpochMutationCoordinator,
  createEpochEventBatchRecord,
  createLegacyEpochEventBatchWriter,
  epochEventsFromPersistenceRecord,
  persistEpochEventBatchWithGuard,
  serializeEpochEventBatch,
} from "../lib/epochPersistence.ts";
import { createEpochEventBatchJsonlAppender, hydrateAgentRuntimeOptions } from "../lib/store.ts";

test("epoch mutation coordinator drain waits for active and queued durable mutations", async () => {
  const coordinator = createEpochMutationCoordinator();
  const order: string[] = [];
  let releaseFirst: (() => void) | undefined;
  const first = coordinator.run(async () => {
    order.push("first:start");
    await new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    order.push("first:end");
  });
  const second = coordinator.run(() => {
    order.push("second");
  });
  let drained = false;
  const drain = coordinator.drain().then(() => {
    drained = true;
  });

  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(drained, false);
  assert.deepEqual(order, ["first:start"]);
  assert.ok(releaseFirst);
  releaseFirst();
  await Promise.all([first, second, drain]);
  assert.equal(drained, true);
  assert.deepEqual(order, ["first:start", "first:end", "second"]);
});

test("epoch persistence expands legacy events and batch envelopes in logical order", () => {
  const core = createEpochGameCore({
    idFactory: createSequentialEpochIdFactory("epoch_persistence"),
  });
  const first = core.issueIdentity({
    explorerId: "explorer_epoch_persistence_1",
    identityName: "批次持久化一号",
  }, {
    actorExplorerId: "explorer_epoch_persistence_1",
    trustClass: "untrusted_client",
    idempotencyKey: "issue-epoch-persistence-1",
  });
  const second = core.issueIdentity({
    explorerId: "explorer_epoch_persistence_2",
    identityName: "批次持久化二号",
  }, {
    actorExplorerId: "explorer_epoch_persistence_2",
    trustClass: "untrusted_client",
    idempotencyKey: "issue-epoch-persistence-2",
  });
  const events = [first.events[0], second.events[0]];
  const batch = createEpochEventBatchRecord(events);

  assert.deepEqual(epochEventsFromPersistenceRecord(batch), events);
  assert.deepEqual(epochEventsFromPersistenceRecord({ type: "epoch_event", event: events[0] }), [events[0]]);
  assert.deepEqual(epochEventsFromPersistenceRecord(events[0]), [events[0]]);
  assert.deepEqual(hydrateAgentRuntimeOptions({ epochEvents: [batch] }).epochEvents, events);
  assert.equal(serializeEpochEventBatch(events), `${JSON.stringify(batch)}\n`);
});

test("epoch persistence serializes a complete batch before handing it to a writer", () => {
  const core = createEpochGameCore({
    idFactory: createSequentialEpochIdFactory("epoch_persistence_serialize"),
  });
  const identity = core.issueIdentity({
    explorerId: "explorer_epoch_persistence_serialize",
    identityName: "批次序列化校验者",
  }, {
    actorExplorerId: "explorer_epoch_persistence_serialize",
    trustClass: "untrusted_client",
    idempotencyKey: "issue-epoch-persistence-serialize-1",
  });
  const circularPayload: Record<string, unknown> = {};
  circularPayload.self = circularPayload;
  const invalidEvent = {
    ...identity.events[0],
    payload: circularPayload,
  } as unknown as EpochEvent;

  assert.throws(() => serializeEpochEventBatch([invalidEvent]), /circular/i);
});

test("JSONL epoch batch appends stay serialized and use one line per batch", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "epoch-jsonl-batch-"));
  try {
    const appendEpochEventBatch = createEpochEventBatchJsonlAppender(tempDir);
    const core = createEpochGameCore({
      idFactory: createSequentialEpochIdFactory("epoch_jsonl_batch"),
    });
    const first = core.issueIdentity({
      explorerId: "explorer_epoch_jsonl_batch_1",
      identityName: "JSONL 批次一号",
    }, {
      actorExplorerId: "explorer_epoch_jsonl_batch_1",
      trustClass: "untrusted_client",
      idempotencyKey: "issue-epoch-jsonl-batch-1",
    });
    const second = core.issueIdentity({
      explorerId: "explorer_epoch_jsonl_batch_2",
      identityName: "JSONL 批次二号",
    }, {
      actorExplorerId: "explorer_epoch_jsonl_batch_2",
      trustClass: "untrusted_client",
      idempotencyKey: "issue-epoch-jsonl-batch-2",
    });

    await Promise.all([
      appendEpochEventBatch(first.events),
      appendEpochEventBatch(second.events),
    ]);

    const lines = (await readFile(join(tempDir, "epoch-events.jsonl"), "utf8")).trimEnd().split("\n");
    assert.equal(lines.length, 2);
    const records = lines.map((line) => JSON.parse(line) as { type: string; events: { eventId: string }[] });
    assert.deepEqual(records.map((record) => record.type), ["epoch_event_batch", "epoch_event_batch"]);
    assert.deepEqual(
      records.map((record) => record.events.map((event) => event.eventId)),
      [[first.events[0].eventId], [second.events[0].eventId]],
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("epoch persistence guard trips once and preserves legacy JSONL injection", async () => {
  const trips: string[] = [];
  const guard = createEpochPersistenceGuard((error) => trips.push(error.persistenceError));
  const legacyWrites: unknown[] = [];
  const legacyWriter = createLegacyEpochEventBatchWriter(async (_fileName, record) => {
    legacyWrites.push(record);
  });
  const core = createEpochGameCore({
    idFactory: createSequentialEpochIdFactory("epoch_persistence_guard"),
  });
  const identity = core.issueIdentity({
    explorerId: "explorer_epoch_persistence_guard",
    identityName: "持久化守卫校验者",
  }, {
    actorExplorerId: "explorer_epoch_persistence_guard",
    trustClass: "untrusted_client",
    idempotencyKey: "issue-epoch-persistence-guard-1",
  });

  assert.equal(await persistEpochEventBatchWithGuard(legacyWriter, guard, identity.events), 1);
  assert.equal(legacyWrites.length, 1);

  const failedGuard = createEpochPersistenceGuard((error) => trips.push(error.persistenceError));
  await assert.rejects(
    persistEpochEventBatchWithGuard(async () => {
      throw new Error("epoch_ledger_offline");
    }, failedGuard, identity.events),
    /epoch_persistence_unavailable/,
  );
  const firstError = failedGuard.error;
  assert.equal(failedGuard.trip(new Error("second_failure")), firstError);
  assert.throws(() => failedGuard.assertHealthy(), (error) => error === firstError);
  assert.deepEqual(trips, ["epoch_ledger_offline"]);
});
