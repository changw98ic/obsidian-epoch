import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { createAgentCompanionRuntime } from "../lib/epoch/agentCompanionRuntime.ts";
import { journeyEventsForPersistence } from "../lib/epoch/journeyPersistence.ts";
import { createJourneyRuntime } from "../lib/epoch/journeyRuntime.ts";
import { epochEventsForPersistence } from "../lib/epoch/runtimePublicProjectionRules.ts";
import { createAgentWorldRuntime } from "../lib/mcpTools.ts";
import { hydrateAgentRuntimeOptions } from "../lib/store.ts";
import {
  appendSqliteJsonl,
  loadAgentRuntimeOptionsFromSqlite,
  readSqliteJsonlRecords,
} from "../lib/sqliteStore.ts";

const execFileAsync = promisify(execFile);

function fixture(initialEvents: readonly import("../lib/epoch/journeyReadModel.ts").JourneyRuntimeEvent[] = []) {
  let sequence = 0;
  const runtime = createAgentCompanionRuntime({
    epoch: {
      progress: () => ({ identity: { agentId: "agent_persist", explorerId: "explorer_persist", status: "active" } }),
      verifyExplorerAuth: () => ({ explorerId: "explorer_persist", verified: true }),
      regionInfo: () => ({}),
      agentBriefing: () => ({}),
      events: () => ({ events: [] }),
    },
    journeyOptions: {
      idFactory: (kind) => `${kind}_persist_${++sequence}`,
      nowReal: () => "2026-07-12T00:00:00.000Z",
      nowWorld: () => "2026-01-01T08:00:00.000Z",
      initialEvents,
    },
  });
  return runtime;
}

test("Journey command results carry durable events and idempotent replay carries none", () => {
  const runtime = fixture();
  const input = {
    agentId: "agent_persist",
    destinationRegionId: "region_gray_harbor",
    recoveryCode: "owner-credential",
    idempotencyKey: "prepare-persist",
  };
  const prepared = runtime.prepare(input);
  assert.equal(journeyEventsForPersistence(prepared).length, 1);
  const duplicate = runtime.prepare(input);
  assert.equal((duplicate as { duplicate?: boolean }).duplicate, true);
  assert.equal(journeyEventsForPersistence(duplicate).length, 0);
});

test("Journey JSONL records hydrate a linked verification URL after restart", () => {
  const runtime = fixture();
  const prepared = runtime.prepare({
    agentId: "agent_persist",
    destinationRegionId: "region_gray_harbor",
    recoveryCode: "owner-credential",
    idempotencyKey: "prepare-jsonl",
  });
  const started = runtime.start({
    journeyId: prepared.journey.journeyId,
    expectedVersion: prepared.journey.version,
    recoveryCode: "owner-credential",
    idempotencyKey: "start-jsonl",
  });
  const linked = runtime.linkVerification({
    journeyId: started.journey.journeyId,
    expectedVersion: started.journey.version,
    pageId: "page_journey_jsonl",
    urlPath: "/epoch/result/page_journey_jsonl?shareToken=public&shareVersion=1",
    createdAt: "2026-07-12T00:00:00.000Z",
    recoveryCode: "owner-credential",
    idempotencyKey: "link-jsonl",
  });
  const events = [prepared, started, linked].flatMap(journeyEventsForPersistence);
  const loaded = hydrateAgentRuntimeOptions({
    journeyEvents: events.map((event) => ({ type: "journey_event", event })),
  });
  const restored = createJourneyRuntime({
    idFactory: (kind) => `${kind}_restored`,
    initialEvents: loaded.journeyEvents,
  });
  assert.equal(restored.status(started.journey.journeyId).journey.verification?.pageId, "page_journey_jsonl");
  assert.equal(restored.projection().events.length, events.length);
});

test("dynamic task plan command events hydrate across a process restart", () => {
  const runtime = fixture();
  const prepared = runtime.prepare({
    agentId: "agent_persist",
    destinationRegionId: "region_starship_graveyard",
    taskType: "参加打捞队入门试炼",
    recoveryCode: "owner-credential",
    idempotencyKey: "prepare-dynamic-command-envelope",
  });
  const started = runtime.start({
    journeyId: prepared.journey.journeyId,
    expectedVersion: prepared.journey.version,
    taskGenerationMode: "server_fallback",
    recoveryCode: "owner-credential",
    idempotencyKey: "start-dynamic-command-envelope",
  });
  const journeyEvents = [prepared, started].flatMap(journeyEventsForPersistence);
  assert.ok(journeyEvents.some((event) => event.eventType === "journey_task_plan_installed"));

  const loaded = hydrateAgentRuntimeOptions({
    commandEvents: [{
      type: "agent_command_commit",
      version: 1,
      command: "obsidian_epoch.start_journey",
      commandId: "dynamic-command-envelope",
      journeyEvents,
      epochEvents: [],
      resultPages: [],
    }],
  });
  const restored = createJourneyRuntime({
    idFactory: (kind) => `${kind}_restored_dynamic`,
    initialEvents: loaded.journeyEvents,
  });
  const restoredJourney = restored.status(prepared.journey.journeyId).journey;
  assert.equal(restoredJourney.status, "traveling");
  assert.deepEqual(restoredJourney.taskPlan, started.journey.taskPlan);
  assert.ok(restoredJourney.taskPlan?.routes?.some((route) => route.kind === "choice"));
  assert.ok(restoredJourney.taskPlan?.routes?.some((route) => route.kind === "unlock"));

  const withoutInstallationSeal = journeyEvents.map((event) => {
    if (event.eventType !== "journey_task_plan_installed") return event;
    const { hiddenTaskSeal: _seal, ...eventWithoutSeal } = event;
    return eventWithoutSeal;
  });
  assert.throws(() => createJourneyRuntime({
    idFactory: (kind) => `${kind}_missing_seal`,
    initialEvents: withoutInstallationSeal,
  }), /journey_hidden_task_commitment_invalid/u);
});

test("SQLite stores and hydrates Journey event records", async () => {
  const tempDir = await mkdtemp(path.join(tmpdir(), "journey-sqlite-"));
  const dbPath = path.join(tempDir, "agent-world.sqlite");
  try {
    const runtime = fixture();
    const prepared = runtime.prepare({
      agentId: "agent_persist",
      destinationRegionId: "region_gray_harbor",
      recoveryCode: "owner-credential",
      idempotencyKey: "prepare-sqlite",
    });
    const event = journeyEventsForPersistence(prepared)[0];
    assert.ok(event);
    await appendSqliteJsonl(dbPath, "journey-events.jsonl", { type: "journey_event", event });
    const loaded = await loadAgentRuntimeOptionsFromSqlite(dbPath);
    assert.equal(loaded.journeyEvents.length, 1);
    assert.equal(loaded.journeyEvents[0].eventId, event.eventId);
    assert.equal(readSqliteJsonlRecords(dbPath, "journey-events.jsonl").length, 1);
    const db = new DatabaseSync(dbPath);
    try {
      const indexed = db.prepare(`
        SELECT event_id, journey_id, journey_version
        FROM journey_events
      `).get() as { event_id: string; journey_id: string; journey_version: number };
      assert.equal(indexed.event_id, event.eventId);
      assert.equal(indexed.journey_id, event.journeyId);
      assert.equal(indexed.journey_version, "journey" in event ? event.journey.version : null);
    } finally {
      db.close();
    }
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("command envelope hydration rejects malformed versions and conflicting canonical IDs", () => {
  const runtime = fixture();
  const prepared = runtime.prepare({
    agentId: "agent_persist",
    destinationRegionId: "region_gray_harbor",
    recoveryCode: "owner-credential",
    idempotencyKey: "prepare-command-envelope",
  });
  const event = journeyEventsForPersistence(prepared)[0];
  assert.ok(event);
  if (event.eventType === "journey_return_delivered") throw new Error("expected_journey_snapshot_event");
  const page = {
    pageId: "page_command_envelope",
    createdAt: "2026-07-12T00:00:00.000Z",
    urlPath: "/epoch/result/page_command_envelope",
    payload: { pageType: "journey", generatedAt: "2026-07-12T00:00:00.000Z" },
  };
  const envelope = {
    type: "agent_command_commit",
    version: 1,
    command: "obsidian_epoch.prepare_journey",
    commandId: "command-envelope-1",
    journeyEvents: [event],
    epochEvents: [],
    resultPages: [page],
  };

  assert.equal(hydrateAgentRuntimeOptions({ commandEvents: [envelope] }).journeyEvents.length, 1);
  assert.equal(hydrateAgentRuntimeOptions({ commandEvents: [envelope] }).resultPages.length, 1);
  assert.throws(
    () => hydrateAgentRuntimeOptions({ commandEvents: [{ ...envelope, version: 2 }] }),
    /agent_command_commit_version_unsupported/,
  );
  assert.throws(
    () => hydrateAgentRuntimeOptions({ commandEvents: [{ ...envelope, resultPages: undefined }] }),
    /agent_command_commit_result_pages_required/,
  );
  assert.throws(
    () => hydrateAgentRuntimeOptions({
      commandEvents: [envelope, { ...envelope, command: "obsidian_epoch.tampered_command" }],
    }),
    /agent_command_commit_recovery_conflict/,
  );
  assert.throws(
    () => hydrateAgentRuntimeOptions({
      journeyEvents: [{ type: "journey_event", event }],
      commandEvents: [{
        ...envelope,
        journeyEvents: [{ ...event, eventType: "journey_started" }],
      }],
    }),
    /journey_event_recovery_conflict/,
  );
  assert.throws(
    () => hydrateAgentRuntimeOptions({
      resultPages: [{ type: "epoch_result_page", page }],
      commandEvents: [{
        ...envelope,
        resultPages: [{ ...page, urlPath: "/epoch/result/tampered" }],
      }],
    }),
    /result_page_recovery_conflict/,
  );

  const equivalentWithDifferentKeyOrder = {
    urlPath: page.urlPath,
    payload: { generatedAt: "2026-07-12T00:00:00.000Z", pageType: "journey" },
    createdAt: page.createdAt,
    pageId: page.pageId,
  };
  assert.equal(hydrateAgentRuntimeOptions({
    resultPages: [{ type: "epoch_result_page", page: equivalentWithDifferentKeyOrder }],
    commandEvents: [envelope],
  }).resultPages.length, 1);

  const delivered = {
    eventId: "event_return_delivered_command_envelope",
    eventType: "journey_return_delivered",
    journeyId: event.journeyId,
    agentId: event.agentId,
    explorerId: event.explorerId,
    occurredAt: "2026-07-12T00:30:00.000Z",
    deliveredAt: "2026-07-12T00:30:00.000Z",
  };
  assert.equal(hydrateAgentRuntimeOptions({
    commandEvents: [{ ...envelope, commandId: "return-delivered-envelope", journeyEvents: [delivered] }],
  }).journeyEvents[0]?.eventType, "journey_return_delivered");
  assert.throws(() => hydrateAgentRuntimeOptions({
    commandEvents: [{
      ...envelope,
      commandId: "return-delivered-with-snapshot",
      journeyEvents: [{ ...delivered, journey: event.journey }],
    }],
  }), /agent_command_commit_journey_event_invalid/);
  assert.throws(() => hydrateAgentRuntimeOptions({
    commandEvents: [{
      ...envelope,
      commandId: "return-delivered-without-delivery-time",
      journeyEvents: [{ ...delivered, deliveredAt: undefined }],
    }],
  }), /agent_command_commit_journey_event_invalid/);
  assert.throws(() => hydrateAgentRuntimeOptions({
    commandEvents: [{
      ...envelope,
      commandId: "unknown-journey-event-type",
      journeyEvents: [{ ...event, eventType: "journey_unknown" }],
    }],
  }), /agent_command_commit_journey_event_invalid/);
  const { journey: _journey, ...snapshotWithoutJourney } = event;
  assert.throws(() => hydrateAgentRuntimeOptions({
    commandEvents: [{ ...envelope, commandId: "snapshot-without-journey", journeyEvents: [snapshotWithoutJourney] }],
  }), /agent_command_commit_journey_event_invalid/);
});

test("SQLite concurrent appends preserve every record with a unique continuous line", async () => {
  const tempDir = await mkdtemp(path.join(tmpdir(), "journey-sqlite-concurrent-"));
  const dbPath = path.join(tempDir, "agent-world.sqlite");
  try {
    const processCount = 4;
    const recordsPerProcess = 16;
    const count = processCount * recordsPerProcess;
    const moduleUrl = new URL("../lib/sqliteStore.ts", import.meta.url).href;
    const program = `
      import { appendSqliteJsonl } from ${JSON.stringify(moduleUrl)};
      const [dbPath, workerId, countText] = process.argv.slice(1);
      for (let index = 0; index < Number(countText); index += 1) {
        const id = workerId + "-" + index;
        await appendSqliteJsonl(dbPath, "command-events.jsonl", {
          type: "agent_command_commit",
          version: 1,
          command: "test.concurrent",
          commandId: "concurrent-" + id,
          journeyEvents: [],
          epochEvents: [],
          resultPages: [{
            pageId: "page-concurrent-" + id,
            createdAt: "2026-07-12T00:00:00.000Z",
            urlPath: "/epoch/result/page-concurrent-" + id,
          }],
        });
      }
    `;
    await Promise.all(Array.from({ length: processCount }, (_, workerId) => execFileAsync(
      process.execPath,
      [
        "--experimental-strip-types",
        "--input-type=module",
        "--eval",
        program,
        dbPath,
        String(workerId),
        String(recordsPerProcess),
      ],
    )));
    const records = readSqliteJsonlRecords(dbPath, "command-events.jsonl");
    assert.equal(records.length, count);
    assert.deepEqual(
      new Set(records.map((record) => record.commandId)).size,
      count,
    );
    const db = new DatabaseSync(dbPath);
    try {
      const rows = db.prepare(`
        SELECT line_number FROM jsonl_records
        WHERE file_name = 'command-events.jsonl'
        ORDER BY line_number
      `).all() as { line_number: number }[];
      assert.deepEqual(rows.map((row) => row.line_number), Array.from({ length: count }, (_, index) => index + 1));
      const commandCount = db.prepare("SELECT COUNT(*) AS count FROM command_commits").get() as { count: number };
      const pageCount = db.prepare("SELECT COUNT(*) AS count FROM result_pages").get() as { count: number };
      assert.equal(Number(commandCount.count), count);
      assert.equal(Number(pageCount.count), count);
    } finally {
      db.close();
    }
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("Journey idempotency survives restart without persisting credentials or duplicating events", () => {
  const firstRuntime = fixture();
  const prepareInput = {
    agentId: "agent_persist",
    destinationRegionId: "region_gray_harbor",
    recoveryCode: "owner-credential",
    idempotencyKey: "prepare-restart",
  };
  const prepared = firstRuntime.prepare(prepareInput);
  const startInput = {
    journeyId: prepared.journey.journeyId,
    expectedVersion: prepared.journey.version,
    recoveryCode: "owner-credential",
    idempotencyKey: "start-restart",
  };
  const started = firstRuntime.start(startInput);
  const events = [prepared, started].flatMap(journeyEventsForPersistence);
  assert.ok(events.every((event) => event.command?.subjectHash.length === 64));
  assert.doesNotMatch(JSON.stringify(events), /owner-credential|recoveryCode/);

  const restarted = fixture(events);
  const duplicatePrepare = restarted.prepare(prepareInput);
  const duplicateStart = restarted.start(startInput);
  assert.equal((duplicatePrepare as { duplicate?: boolean }).duplicate, true);
  assert.equal((duplicateStart as { duplicate?: boolean }).duplicate, true);
  assert.equal(journeyEventsForPersistence(duplicatePrepare).length, 0);
  assert.equal(journeyEventsForPersistence(duplicateStart).length, 0);
  assert.equal(duplicateStart.scenePlan.episodes.length, 0);
  assert.ok(started.scenePlan.episodes.length >= 1);
  assert.throws(() => restarted.prepare({ ...prepareInput, destinationRegionId: "region_salt_mirror" }), /idempotency_key_conflict/);
});

test("default Journey IDs continue above the persisted high-water mark after restart", async () => {
  const recovery = (explorerId: string) => Buffer.from(JSON.stringify({
    explorerId,
    localSecret: `secret-${explorerId}`,
  }), "utf8").toString("base64");
  const first = createAgentWorldRuntime();
  const identityA = first.epochIdentity({
    explorerId: "explorer_restart_a",
    recoveryCode: recovery("explorer_restart_a"),
    idempotencyKey: "identity-restart-a",
  });
  const identityB = first.epochIdentity({
    explorerId: "explorer_restart_b",
    recoveryCode: recovery("explorer_restart_b"),
    idempotencyKey: "identity-restart-b",
  });
  assert.ok("value" in identityA && "value" in identityB);
  const preparedA = await first.epochPrepareJourney({
    agentId: identityA.value.agentId,
    destinationRegionId: "region_gray_harbor",
    recoveryCode: recovery("explorer_restart_a"),
    idempotencyKey: "prepare-restart-a",
  });
  const restarted = createAgentWorldRuntime({
    epochEvents: [...epochEventsForPersistence(identityA), ...epochEventsForPersistence(identityB)],
    journeyEvents: journeyEventsForPersistence(preparedA),
  });
  const preparedB = await restarted.epochPrepareJourney({
    agentId: identityB.value.agentId,
    destinationRegionId: "region_gray_harbor",
    recoveryCode: recovery("explorer_restart_b"),
    idempotencyKey: "prepare-restart-b",
  });
  assert.notEqual(preparedB.journey.journeyId, preparedA.journey.journeyId);
  assert.ok(preparedB.journey.journeyId > preparedA.journey.journeyId);
});
