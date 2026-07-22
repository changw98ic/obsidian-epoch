import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { createEpochGameCore } from "../lib/epoch/gameCore.ts";
import { createSequentialEpochIdFactory } from "../lib/epoch/protocol.ts";
import { buildEpochResultPagePayload } from "../lib/epoch/resultPagePayloadRules.ts";
import { resultPageActiveRecord } from "../lib/epoch/resultPageRuntimeRules.ts";
import { createAgentWorldRuntime } from "../lib/mcpTools.ts";
import {
  appendSqliteEpochEventBatch,
  appendSqliteJsonl,
  loadAgentRuntimeOptionsFromSqlite,
  migrateJsonlDataDirToSqlite,
  readSqliteJsonlRecords,
} from "../lib/sqliteStore.ts";
import {
  synchronizeWorldMemoryFromResultPages,
  worldMemoryProjectionNeedsSync,
} from "../lib/worldMemoryIndex.ts";

async function writeJsonl(filePath: string, records: readonly unknown[]) {
  await writeFile(filePath, `${records.map((record) => JSON.stringify(record)).join("\n")}\n`, "utf8");
}

test("migrateJsonlDataDirToSqlite preserves canonical epoch events and result pages", async () => {
  const tempDir = await mkdtemp(path.join(tmpdir(), "epoch-sqlite-migrate-"));
  const sourceDir = path.join(tempDir, "jsonl");
  const dbPath = path.join(tempDir, "agent-world.sqlite");
  await mkdir(sourceDir, { recursive: true });
  try {
    const core = createEpochGameCore({
      clock: () => new Date("2026-06-25T00:00:00.000Z"),
      idFactory: createSequentialEpochIdFactory("sqlite"),
      defaultLifetime: 12,
    });
    const identity = core.issueIdentity({
      explorerId: "explorer_sqlite",
      identityName: "SQLite 迁移者",
    }, {
      actorExplorerId: "explorer_sqlite",
      trustClass: "untrusted_client",
      idempotencyKey: "issue-sqlite-1",
    });
    const page = resultPageActiveRecord({
      request: {
        agentId: identity.value.agentId,
        actorExplorerId: "explorer_sqlite",
        idempotencyKey: "sqlite",
      },
      payload: buildEpochResultPagePayload({
        projection: core.project(),
        input: { agentId: identity.value.agentId },
        generatedAt: "2026-06-25T00:00:00.000Z",
      }),
      pageId: "page_sqlite_1",
      shareToken: "share-sqlite-1",
      createdAt: "2026-06-25T00:00:00.000Z",
    });

    await writeJsonl(path.join(sourceDir, "epoch-events.jsonl"), identity.events.map((event) => ({
      type: "epoch_event",
      event,
    })));
    await writeJsonl(path.join(sourceDir, "result-pages.jsonl"), [{
      type: "epoch_result_page",
      page,
    }]);

    const summary = await migrateJsonlDataDirToSqlite({ sourceDataDir: sourceDir, dbPath });
    assert.equal(summary.records, 2);
    assert.equal(summary.files["epoch-events.jsonl"], 1);
    assert.equal(summary.files["result-pages.jsonl"], 1);

    const rawEpochRecords = readSqliteJsonlRecords(dbPath, "epoch-events.jsonl");
    assert.equal(rawEpochRecords.length, 1);
    assert.equal(rawEpochRecords[0].type, "epoch_event");

    const runtime = createAgentWorldRuntime(await loadAgentRuntimeOptionsFromSqlite(dbPath));
    assert.equal(runtime.epochProgress({ agentId: identity.value.agentId }).identity?.identityName, "SQLite 迁移者");
    assert.equal(runtime.epochGetResultPage({ pageId: "page_sqlite_1" })?.pageId, "page_sqlite_1");
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("JSONL migration rejects conflicting canonical epoch events before creating the target database", async () => {
  const tempDir = await mkdtemp(path.join(tmpdir(), "epoch-sqlite-migrate-conflict-"));
  const sourceDir = path.join(tempDir, "jsonl");
  const dbPath = path.join(tempDir, "agent-world.sqlite");
  await mkdir(sourceDir, { recursive: true });
  try {
    const firstCore = createEpochGameCore({
      clock: () => new Date("2026-06-25T00:00:00.000Z"),
      idFactory: createSequentialEpochIdFactory(),
    });
    const secondCore = createEpochGameCore({
      clock: () => new Date("2026-06-26T00:00:00.000Z"),
      idFactory: createSequentialEpochIdFactory(),
    });
    const first = firstCore.issueIdentity({
      explorerId: "explorer_sqlite_conflict_first",
      identityName: "迁移冲突甲",
    }, {
      actorExplorerId: "explorer_sqlite_conflict_first",
      trustClass: "untrusted_client",
      idempotencyKey: "issue-sqlite-conflict-first",
    });
    const second = secondCore.issueIdentity({
      explorerId: "explorer_sqlite_conflict_second",
      identityName: "迁移冲突乙",
    }, {
      actorExplorerId: "explorer_sqlite_conflict_second",
      trustClass: "untrusted_client",
      idempotencyKey: "issue-sqlite-conflict-second",
    });
    assert.equal(first.events[0]?.eventId, second.events[0]?.eventId);
    assert.notDeepEqual(first.events[0], second.events[0]);
    await writeJsonl(path.join(sourceDir, "epoch-events.jsonl"), [
      { type: "epoch_event", event: first.events[0] },
      { type: "epoch_event", event: second.events[0] },
    ]);

    await assert.rejects(
      migrateJsonlDataDirToSqlite({ sourceDataDir: sourceDir, dbPath }),
      /epoch_event_recovery_conflict/,
    );
    await assert.rejects(access(dbPath), (error: unknown) =>
      error instanceof Error && "code" in error && error.code === "ENOENT");
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("appendSqliteJsonl stores new append-only records for runtime hydration", async () => {
  const tempDir = await mkdtemp(path.join(tmpdir(), "epoch-sqlite-append-"));
  const dbPath = path.join(tempDir, "agent-world.sqlite");
  try {
    const core = createEpochGameCore({
      idFactory: createSequentialEpochIdFactory("sqlite_append"),
    });
    const identity = core.issueIdentity({
      explorerId: "explorer_sqlite_append",
      identityName: "SQLite 追加者",
    }, {
      actorExplorerId: "explorer_sqlite_append",
      trustClass: "untrusted_client",
      idempotencyKey: "issue-sqlite-append-1",
    });

    await appendSqliteJsonl(dbPath, "epoch-events.jsonl", {
      type: "epoch_event",
      event: identity.events[0],
    });

    const runtime = createAgentWorldRuntime(await loadAgentRuntimeOptionsFromSqlite(dbPath));
    assert.equal(runtime.epochProgress({ agentId: identity.value.agentId }).identity?.identityName, "SQLite 追加者");
    assert.equal(readSqliteJsonlRecords(dbPath, "epoch-events.jsonl").length, 1);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("derived world-memory failures do not roll back canonical result pages and are repairable", async () => {
  const tempDir = await mkdtemp(path.join(tmpdir(), "epoch-sqlite-world-memory-isolation-"));
  const dbPath = path.join(tempDir, "agent-world.sqlite");
  const page = {
    pageId: "page_world_memory_isolation",
    createdAt: "2026-07-16T00:00:00.000Z",
    urlPath: "/epoch/result/page_world_memory_isolation",
    status: "active",
    payload: {
      journey: {
        journeyId: "journey_world_memory_isolation",
        regionId: "quantum_lab",
        worldCommit: { status: "solidified" },
        storyReport: {
          kind: "grounded_story_report",
          summary: "实验已完成。",
          chapters: [{ title: "实验", text: "你修复了设备并完成观测。" }],
        },
      },
    },
  };
  try {
    await appendSqliteJsonl(dbPath, "context-snapshots.jsonl", { type: "context_snapshot", snapshot: {} });
    const broken = new DatabaseSync(dbPath);
    try {
      broken.exec(`
        CREATE TRIGGER force_world_memory_index_failure
        BEFORE INSERT ON world_memory_chunks
        BEGIN
          SELECT RAISE(ABORT, 'forced_world_memory_index_failure');
        END;
      `);
    } finally {
      broken.close();
    }

    await appendSqliteJsonl(dbPath, "result-pages.jsonl", { type: "epoch_result_page", page });
    assert.equal(readSqliteJsonlRecords(dbPath, "result-pages.jsonl").length, 1);
    assert.equal(worldMemoryProjectionNeedsSync(dbPath), true);
    const persisted = new DatabaseSync(dbPath);
    try {
      assert.equal((persisted.prepare("SELECT COUNT(*) AS count FROM result_pages WHERE page_id = ?")
        .get(page.pageId) as { count: number }).count, 1);
      assert.equal((persisted.prepare("SELECT COUNT(*) AS count FROM world_memory_chunks")
        .get() as { count: number }).count, 0);
      persisted.exec("DROP TRIGGER force_world_memory_index_failure");
    } finally {
      persisted.close();
    }

    assert.deepEqual(synchronizeWorldMemoryFromResultPages(dbPath), { pages: 1, chunks: 2 });
    assert.equal(worldMemoryProjectionNeedsSync(dbPath), false);
    const physicallyDeleted = new DatabaseSync(dbPath);
    try {
      physicallyDeleted.prepare("DELETE FROM result_pages WHERE page_id = ?").run(page.pageId);
    } finally {
      physicallyDeleted.close();
    }
    assert.equal(worldMemoryProjectionNeedsSync(dbPath), true);
    assert.deepEqual(synchronizeWorldMemoryFromResultPages(dbPath), { pages: 0, chunks: 0 });
    assert.equal(worldMemoryProjectionNeedsSync(dbPath), false);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("command commits index nested canonical events and result pages atomically", async () => {
  const tempDir = await mkdtemp(path.join(tmpdir(), "epoch-sqlite-command-index-"));
  const dbPath = path.join(tempDir, "agent-world.sqlite");
  try {
    const core = createEpochGameCore({ idFactory: createSequentialEpochIdFactory("sqlite_command") });
    const identity = core.issueIdentity({
      explorerId: "explorer_sqlite_command",
      identityName: "SQLite 命令索引者",
    }, {
      actorExplorerId: "explorer_sqlite_command",
      trustClass: "untrusted_client",
      idempotencyKey: "issue-sqlite-command",
    });
    const page = {
      pageId: "page_sqlite_command",
      createdAt: "2026-07-15T00:00:00.000Z",
      urlPath: "/epoch/result/page_sqlite_command",
    };
    await appendSqliteJsonl(dbPath, "command-events.jsonl", {
      type: "agent_command_commit",
      version: 1,
      command: "obsidian_epoch.identity",
      commandId: "command-sqlite-index-1",
      journeyEvents: [],
      epochEvents: identity.events,
      resultPages: [page],
    });

    const db = new DatabaseSync(dbPath);
    try {
      const command = db.prepare("SELECT command FROM command_commits WHERE command_id = ?")
        .get("command-sqlite-index-1") as { command: string };
      const events = db.prepare("SELECT event_id FROM epoch_events ORDER BY rowid").all() as { event_id: string }[];
      const indexedPage = db.prepare("SELECT page_id FROM result_pages WHERE page_id = ?")
        .get(page.pageId) as { page_id: string };
      assert.equal(command.command, "obsidian_epoch.identity");
      assert.deepEqual(events.map((event) => event.event_id), identity.events.map((event) => event.eventId));
      assert.equal(indexedPage.page_id, page.pageId);
    } finally {
      db.close();
    }
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("SQLite hydration preserves canonical append order across command and epoch ledgers", async () => {
  const tempDir = await mkdtemp(path.join(tmpdir(), "epoch-sqlite-cross-ledger-order-"));
  const dbPath = path.join(tempDir, "agent-world.sqlite");
  try {
    const core = createEpochGameCore({ idFactory: createSequentialEpochIdFactory("sqlite_cross_ledger") });
    const commandIdentity = core.issueIdentity({
      explorerId: "explorer_sqlite_cross_ledger_command",
      identityName: "跨账本命令身份",
    }, {
      actorExplorerId: "explorer_sqlite_cross_ledger_command",
      trustClass: "untrusted_client",
      idempotencyKey: "issue-sqlite-cross-ledger-command",
    });
    const directIdentity = core.issueIdentity({
      explorerId: "explorer_sqlite_cross_ledger_direct",
      identityName: "跨账本直接身份",
    }, {
      actorExplorerId: "explorer_sqlite_cross_ledger_direct",
      trustClass: "untrusted_client",
      idempotencyKey: "issue-sqlite-cross-ledger-direct",
    });

    await appendSqliteJsonl(dbPath, "command-events.jsonl", {
      type: "agent_command_commit",
      version: 1,
      command: "obsidian_epoch.identity",
      commandId: "command-sqlite-cross-ledger-order",
      journeyEvents: [],
      epochEvents: commandIdentity.events,
      resultPages: [],
    });
    await appendSqliteEpochEventBatch(dbPath, directIdentity.events);

    const loaded = await loadAgentRuntimeOptionsFromSqlite(dbPath);
    assert.deepEqual(
      loaded.epochEvents.map((event) => event.eventId),
      [...commandIdentity.events, ...directIdentity.events].map((event) => event.eventId),
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("schema v2 atomically backfills command, journey, and result-page indexes from a v1 database", async () => {
  const tempDir = await mkdtemp(path.join(tmpdir(), "epoch-sqlite-v1-backfill-"));
  const dbPath = path.join(tempDir, "agent-world.sqlite");
  const command = {
    type: "agent_command_commit",
    version: 1,
    command: "obsidian_epoch.journey_status",
    commandId: "command-v1-backfill",
    epochEvents: [],
    journeyEvents: [{
      eventId: "journey_event_v1_backfill",
      journeyId: "journey_v1_backfill",
      eventType: "journey_settled",
      agentId: "agent_v1_backfill",
      explorerId: "explorer_v1_backfill",
      occurredAt: "2026-07-15T01:00:00.000Z",
      journey: { version: 9 },
    }],
    resultPages: [{
      pageId: "page_v1_backfill",
      createdAt: "2026-07-15T01:00:00.000Z",
      urlPath: "/epoch/result/page_v1_backfill",
    }],
  };
  try {
    const v1 = new DatabaseSync(dbPath);
    try {
      v1.exec(`
        CREATE TABLE schema_migrations (
          version INTEGER PRIMARY KEY,
          applied_at TEXT NOT NULL
        );
        CREATE TABLE jsonl_records (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          file_name TEXT NOT NULL,
          line_number INTEGER NOT NULL,
          record_type TEXT,
          record_json TEXT NOT NULL,
          inserted_at TEXT NOT NULL,
          UNIQUE(file_name, line_number)
        );
      `);
      v1.prepare("INSERT INTO schema_migrations(version, applied_at) VALUES (1, ?)")
        .run("2026-07-15T00:00:00.000Z");
      v1.prepare(`
        INSERT INTO jsonl_records(file_name, line_number, record_type, record_json, inserted_at)
        VALUES (?, 1, ?, ?, ?)
      `).run("command-events.jsonl", command.type, JSON.stringify(command), "2026-07-15T01:00:00.000Z");
    } finally {
      v1.close();
    }

    assert.equal(readSqliteJsonlRecords(dbPath, "command-events.jsonl").length, 1);
    const migrated = new DatabaseSync(dbPath);
    try {
      assert.ok(migrated.prepare("SELECT version FROM schema_migrations WHERE version = 2").get());
      assert.equal((migrated.prepare("SELECT command_id FROM command_commits").get() as { command_id: string }).command_id,
        command.commandId);
      const journey = migrated.prepare("SELECT journey_id, journey_version FROM journey_events").get() as {
        journey_id: string;
        journey_version: number;
      };
      assert.equal(journey.journey_id, "journey_v1_backfill");
      assert.equal(journey.journey_version, 9);
      assert.equal((migrated.prepare("SELECT page_id FROM result_pages").get() as { page_id: string }).page_id,
        "page_v1_backfill");
    } finally {
      migrated.close();
    }
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("schema v2 rejects conflicting canonical events without recording or partially indexing the migration", async () => {
  const tempDir = await mkdtemp(path.join(tmpdir(), "epoch-sqlite-v1-conflict-"));
  const dbPath = path.join(tempDir, "agent-world.sqlite");
  try {
    const firstCore = createEpochGameCore({
      clock: () => new Date("2026-06-25T00:00:00.000Z"),
      idFactory: createSequentialEpochIdFactory(),
    });
    const secondCore = createEpochGameCore({
      clock: () => new Date("2026-06-26T00:00:00.000Z"),
      idFactory: createSequentialEpochIdFactory(),
    });
    const first = firstCore.issueIdentity({
      explorerId: "explorer_sqlite_v1_conflict_first",
      identityName: "回填冲突甲",
    }, {
      actorExplorerId: "explorer_sqlite_v1_conflict_first",
      trustClass: "untrusted_client",
      idempotencyKey: "issue-sqlite-v1-conflict-first",
    });
    const second = secondCore.issueIdentity({
      explorerId: "explorer_sqlite_v1_conflict_second",
      identityName: "回填冲突乙",
    }, {
      actorExplorerId: "explorer_sqlite_v1_conflict_second",
      trustClass: "untrusted_client",
      idempotencyKey: "issue-sqlite-v1-conflict-second",
    });
    assert.equal(first.events[0]?.eventId, second.events[0]?.eventId);

    const v1 = new DatabaseSync(dbPath);
    try {
      v1.exec(`
        CREATE TABLE schema_migrations (
          version INTEGER PRIMARY KEY,
          applied_at TEXT NOT NULL
        );
        CREATE TABLE jsonl_records (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          file_name TEXT NOT NULL,
          line_number INTEGER NOT NULL,
          record_type TEXT,
          record_json TEXT NOT NULL,
          inserted_at TEXT NOT NULL,
          UNIQUE(file_name, line_number)
        );
      `);
      v1.prepare("INSERT INTO schema_migrations(version, applied_at) VALUES (1, ?)")
        .run("2026-07-15T00:00:00.000Z");
      const insert = v1.prepare(`
        INSERT INTO jsonl_records(file_name, line_number, record_type, record_json, inserted_at)
        VALUES ('epoch-events.jsonl', ?, 'epoch_event', ?, ?)
      `);
      insert.run(1, JSON.stringify({ type: "epoch_event", event: first.events[0] }), "2026-07-15T01:00:00.000Z");
      insert.run(2, JSON.stringify({ type: "epoch_event", event: second.events[0] }), "2026-07-15T01:01:00.000Z");
    } finally {
      v1.close();
    }

    assert.throws(
      () => readSqliteJsonlRecords(dbPath, "epoch-events.jsonl"),
      /epoch_event_recovery_conflict/,
    );
    const rolledBack = new DatabaseSync(dbPath);
    try {
      assert.equal(rolledBack.prepare("SELECT version FROM schema_migrations WHERE version = 2").get(), undefined);
      const indexed = rolledBack.prepare("SELECT COUNT(*) AS count FROM epoch_events").get() as { count: number };
      assert.equal(Number(indexed.count), 0);
    } finally {
      rolledBack.close();
    }
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("appendSqliteEpochEventBatch stores one batch record and indexes every event", async () => {
  const tempDir = await mkdtemp(path.join(tmpdir(), "epoch-sqlite-batch-"));
  const dbPath = path.join(tempDir, "agent-world.sqlite");
  try {
    const core = createEpochGameCore({
      idFactory: createSequentialEpochIdFactory("sqlite_batch"),
    });
    const first = core.issueIdentity({
      explorerId: "explorer_sqlite_batch_1",
      identityName: "SQLite 批次一号",
    }, {
      actorExplorerId: "explorer_sqlite_batch_1",
      trustClass: "untrusted_client",
      idempotencyKey: "issue-sqlite-batch-1",
    });
    const second = core.issueIdentity({
      explorerId: "explorer_sqlite_batch_2",
      identityName: "SQLite 批次二号",
    }, {
      actorExplorerId: "explorer_sqlite_batch_2",
      trustClass: "untrusted_client",
      idempotencyKey: "issue-sqlite-batch-2",
    });

    await appendSqliteEpochEventBatch(dbPath, [first.events[0], second.events[0]]);

    const rawRecords = readSqliteJsonlRecords(dbPath, "epoch-events.jsonl");
    assert.equal(rawRecords.length, 1);
    assert.equal(rawRecords[0].type, "epoch_event_batch");
    assert.deepEqual(
      (rawRecords[0].events as { eventId: string }[]).map((event) => event.eventId),
      [first.events[0].eventId, second.events[0].eventId],
    );

    const db = new DatabaseSync(dbPath);
    try {
      const indexed = db.prepare("SELECT event_id FROM epoch_events ORDER BY rowid ASC").all() as { event_id: string }[];
      assert.deepEqual(indexed.map((row) => row.event_id), [first.events[0].eventId, second.events[0].eventId]);
    } finally {
      db.close();
    }

    const runtime = createAgentWorldRuntime(await loadAgentRuntimeOptionsFromSqlite(dbPath));
    assert.equal(runtime.epochProgress({ agentId: first.value.agentId }).identity?.identityName, "SQLite 批次一号");
    assert.equal(runtime.epochProgress({ agentId: second.value.agentId }).identity?.identityName, "SQLite 批次二号");
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("default runtime continues sequential event IDs after a SQLite restart", async () => {
  const tempDir = await mkdtemp(path.join(tmpdir(), "epoch-sqlite-restart-id-"));
  const dbPath = path.join(tempDir, "agent-world.sqlite");
  const registrationSecret = "sqlite-restart-registration-secret-32-chars";
  try {
    const firstRuntime = createAgentWorldRuntime({ epoch: { registrationSecret } });
    const first = firstRuntime.epochRegisterExplorer({
      idempotencyKey: "sqlite-restart-register-first",
    });
    assert.equal(first.events[0].eventId, "epoch_event_000001");
    await appendSqliteEpochEventBatch(dbPath, first.events);

    const loaded = await loadAgentRuntimeOptionsFromSqlite(dbPath);
    const restartedRuntime = createAgentWorldRuntime({
      ...loaded,
      epoch: { registrationSecret },
    });
    const second = restartedRuntime.epochRegisterExplorer({
      idempotencyKey: "sqlite-restart-register-second",
    });
    assert.equal(second.events[0].eventId, "epoch_event_000002");
    assert.notEqual(second.events[0].eventId, first.events[0].eventId);
    await appendSqliteEpochEventBatch(dbPath, second.events);

    const db = new DatabaseSync(dbPath);
    try {
      const indexed = db.prepare("SELECT event_id FROM epoch_events ORDER BY rowid ASC").all() as { event_id: string }[];
      assert.deepEqual(indexed.map((row) => row.event_id), [
        "epoch_event_000001",
        "epoch_event_000002",
      ]);
    } finally {
      db.close();
    }
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("appendSqliteEpochEventBatch treats identical epoch events as idempotent and rolls back payload conflicts", async () => {
  const tempDir = await mkdtemp(path.join(tmpdir(), "epoch-sqlite-batch-rollback-"));
  const dbPath = path.join(tempDir, "agent-world.sqlite");
  try {
    const core = createEpochGameCore({
      idFactory: createSequentialEpochIdFactory("sqlite_batch_rollback"),
    });
    const identity = core.issueIdentity({
      explorerId: "explorer_sqlite_batch_rollback",
      identityName: "SQLite 回滚校验者",
    }, {
      actorExplorerId: "explorer_sqlite_batch_rollback",
      trustClass: "untrusted_client",
      idempotencyKey: "issue-sqlite-batch-rollback-1",
    });

    await appendSqliteEpochEventBatch(dbPath, [identity.events[0], identity.events[0]]);
    assert.equal(readSqliteJsonlRecords(dbPath, "epoch-events.jsonl").length, 1);
    const indexedAfterIdenticalDuplicate = new DatabaseSync(dbPath);
    try {
      const row = indexedAfterIdenticalDuplicate.prepare("SELECT COUNT(*) AS count FROM epoch_events")
        .get() as { count: number };
      assert.equal(Number(row.count), 1);
    } finally {
      indexedAfterIdenticalDuplicate.close();
    }

    const conflictingCore = createEpochGameCore({
      idFactory: createSequentialEpochIdFactory("sqlite_batch_rollback"),
    });
    const conflictingIdentity = conflictingCore.issueIdentity({
      explorerId: "explorer_sqlite_batch_rollback_conflict",
      identityName: "SQLite 回滚冲突者",
    }, {
      actorExplorerId: "explorer_sqlite_batch_rollback_conflict",
      trustClass: "untrusted_client",
      idempotencyKey: "issue-sqlite-batch-rollback-conflict",
    });
    assert.equal(conflictingIdentity.events[0].eventId, identity.events[0].eventId);
    assert.notDeepEqual(conflictingIdentity.events[0].payload, identity.events[0].payload);

    await assert.rejects(
      appendSqliteEpochEventBatch(dbPath, [conflictingIdentity.events[0]]),
      /epoch_event_recovery_conflict/,
    );

    assert.equal(readSqliteJsonlRecords(dbPath, "epoch-events.jsonl").length, 1);
    const db = new DatabaseSync(dbPath);
    try {
      const row = db.prepare("SELECT COUNT(*) AS count FROM epoch_events").get() as { count: number };
      assert.equal(Number(row.count), 1);
    } finally {
      db.close();
    }
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("SQLite migration hydrates saved context snapshots", async () => {
  const tempDir = await mkdtemp(path.join(tmpdir(), "epoch-sqlite-context-snapshot-"));
  const sourceDir = path.join(tempDir, "jsonl");
  const dbPath = path.join(tempDir, "agent-world.sqlite");
  await mkdir(sourceDir, { recursive: true });
  try {
    await writeJsonl(path.join(sourceDir, "context-snapshots.jsonl"), [{
      type: "context_snapshot",
      snapshot: {
        snapshotId: "ctxsnap_persisted_sqlite_001",
        contextVersion: "obsidian-epoch-context-pack-test",
        versions: { contextPackVersion: "obsidian-epoch-context-pack-test" },
        retrievalParams: {
          requestedAgentId: "agent_grayfile_07",
          resolvedAgentId: "agent_grayfile_07",
          explorerId: "explorer_sqlite_snapshot",
          mandate: "sqlite snapshot",
          anchorCount: 0,
          anchorIds: [],
        },
        filteringReasons: ["core_secrets_excluded"],
        settingCards: [{
          cardId: "agent:agent_grayfile_07",
          version: "obsidian-epoch-context-pack-test",
          publicSummary: "灰档-07 public summary",
          filteringReasons: ["core_secrets_excluded"],
        }],
      },
    }]);

    const summary = await migrateJsonlDataDirToSqlite({ sourceDataDir: sourceDir, dbPath });
    assert.equal(summary.files["context-snapshots.jsonl"], 1);

    const runtime = createAgentWorldRuntime(await loadAgentRuntimeOptionsFromSqlite(dbPath));
    const snapshots = runtime.contextSnapshots();
    assert.equal(snapshots.summary.total, 1);
    assert.equal(snapshots.entries[0].snapshotId, "ctxsnap_persisted_sqlite_001");
    assert.equal(snapshots.entries[0].retrievalParams.explorerId, "explorer_sqlite_snapshot");
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
