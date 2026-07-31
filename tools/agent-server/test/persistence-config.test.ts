import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { createEpochGameCore } from "../lib/epoch/gameCore.ts";
import { createSequentialEpochIdFactory } from "../lib/epoch/protocol.ts";
import { createAgentPersistenceFromEnv } from "../lib/persistenceConfig.ts";
import { readSqliteJsonlRecords } from "../lib/sqliteStore.ts";

test("createAgentPersistenceFromEnv migrates JSONL data and appends future writes to SQLite", async () => {
  const tempDir = await mkdtemp(path.join(tmpdir(), "epoch-persistence-config-"));
  const dataDir = path.join(tempDir, "data");
  const dbPath = path.join(tempDir, "prod.sqlite");
  await mkdir(dataDir, { recursive: true });
  try {
    const core = createEpochGameCore({
      idFactory: createSequentialEpochIdFactory("persist_sqlite"),
    });
    const identity = core.issueIdentity({
      explorerId: "explorer_persist_sqlite",
      identityName: "生产迁移者",
    }, {
      actorExplorerId: "explorer_persist_sqlite",
      trustClass: "untrusted_client",
      idempotencyKey: "issue-persist-sqlite-1",
    });
    await writeFile(path.join(dataDir, "epoch-events.jsonl"), `${JSON.stringify({
      type: "epoch_event",
      event: identity.events[0],
    })}\n`, "utf8");

    const persistence = await createAgentPersistenceFromEnv({
      AGENT_SERVER_STORE: "sqlite",
      AGENT_SERVER_SQLITE_PATH: dbPath,
      AGENT_SERVER_SQLITE_MIGRATE_JSONL: "1",
    }, dataDir);

    assert.equal(persistence.storeKind, "sqlite");
    assert.equal(persistence.loadedOptions.epochEvents[0].eventId, identity.events[0].eventId);
    assert.equal(typeof persistence.persistEpochEventBatch, "function");
    assert.equal(typeof persistence.causalIdempotencyStore.claimReservation, "function");

    await persistence.persistJsonl("result-pages.jsonl", {
      type: "epoch_result_page",
      page: {
        pageId: "page_from_persist_config",
        createdAt: "2026-06-25T00:00:00.000Z",
        urlPath: "/epoch/result/page_from_persist_config",
        payload: { pageType: "agent_result", generatedAt: "2026-06-25T00:00:00.000Z", progress: {} },
        createdBy: "test",
        idempotencyKey: "result_page:persist_config",
      },
    });

    assert.equal(readSqliteJsonlRecords(dbPath, "result-pages.jsonl").length, 1);

    const secondIdentity = core.issueIdentity({
      explorerId: "explorer_persist_sqlite_batch",
      identityName: "生产批次持久化者",
    }, {
      actorExplorerId: "explorer_persist_sqlite_batch",
      trustClass: "untrusted_client",
      idempotencyKey: "issue-persist-sqlite-batch-1",
    });
    await persistence.persistEpochEventBatch(secondIdentity.events);

    const epochRecords = readSqliteJsonlRecords(dbPath, "epoch-events.jsonl");
    assert.equal(epochRecords.length, 2);
    assert.equal(epochRecords[0].type, "epoch_event");
    assert.equal(epochRecords[1].type, "epoch_event_batch");
    assert.deepEqual(
      (epochRecords[1].events as { eventId: string }[]).map((event) => event.eventId),
      secondIdentity.events.map((event) => event.eventId),
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("createAgentPersistenceFromEnv rejects a noncanonical store", async () => {
  await assert.rejects(
    () => createAgentPersistenceFromEnv({ AGENT_SERVER_STORE: "sqllite" }),
    /AGENT_SERVER_STORE must be sqlite/,
  );
});
