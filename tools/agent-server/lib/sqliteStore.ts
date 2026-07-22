import { DatabaseSync } from "node:sqlite";
import { mkdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { type EpochEvent } from "./epoch/events.ts";
import {
  createEpochEventBatchRecord,
  epochEventsFromPersistenceRecord,
} from "./epochPersistence.ts";
import {
  assertCausalIdempotencyReplay,
  assertCausalReservationFinalization,
  causalIdempotencyLeaseExpired,
  causalIdempotencyScope,
  pendingCausalManifest,
  type CausalAtomicCommitContext,
  type CausalIdempotencyClaimResult,
  type CausalIdempotencyInput,
  type CausalIdempotencyManifest,
  type CausalIdempotencyManifestStore,
  type CausalIdempotencyReservation,
} from "./epoch/causalIdempotencyRules.ts";
import {
  hydrateAgentRuntimeOptions,
  validateCanonicalRecoveryConflicts,
} from "./store.ts";
import {
  createJourneyRunReceiptSqliteStore,
  initializeJourneyRunReceiptSchema,
} from "./epoch/journeyRunReceiptStore.ts";
import {
  createPhase6JourneyContextSqliteStore,
  type Phase6JourneyContextSqliteStore,
} from "./epoch/phase6JourneyContextStore.ts";
import {
  createPhase6ExperimentSqliteStore,
  type Phase6ExperimentSqliteStore,
} from "./epoch/phase6ExperimentStore.ts";
import {
  appendPhase6CommittedResultInTransaction,
  initializePhase6CommittedResultSchema,
  phase6CommittedResultsForPersistence,
} from "./epoch/phase6CommittedResultStore.ts";
import {
  createPhase6RagTraceStore,
  type Phase6RagTraceSqliteStore,
} from "./epoch/phase6RagTraceStore.ts";
import type { JourneyRunReceiptRepositoryAdapter } from "./epoch/journeySettlementRuntime.ts";
import {
  backfillWorldMemoryFromResultPages,
  indexCanonicalResultPageForWorldMemory,
  initializeWorldMemorySchema,
  markWorldMemoryProjectionDirty,
} from "./worldMemoryIndex.ts";

type JsonRecord = Record<string, unknown>;

export const KNOWN_JSONL_FILES = [
  "tickets.jsonl",
  "runs.jsonl",
  "lore.jsonl",
  "progression.jsonl",
  "factions.jsonl",
  "community.jsonl",
  "experience.jsonl",
  "transparency.jsonl",
  "epoch-events.jsonl",
  "journey-events.jsonl",
  "command-events.jsonl",
  "result-pages.jsonl",
  "context-snapshots.jsonl",
  "outbox.jsonl",
] as const;

type KnownJsonlFileName = typeof KNOWN_JSONL_FILES[number];
type KnownJsonlRecordFiles = Record<KnownJsonlFileName, readonly JsonRecord[]>;
type MutableKnownJsonlRecordFiles = Record<KnownJsonlFileName, JsonRecord[]>;

export interface SqliteMigrationSummary {
  readonly dbPath: string;
  readonly records: number;
  readonly files: Readonly<Record<string, number>>;
}

export interface AgentSqlitePersistenceStores {
  readonly database: DatabaseSync;
  readonly receiptRepository: JourneyRunReceiptRepositoryAdapter;
  readonly phase6JourneyContextStore: Phase6JourneyContextSqliteStore;
  readonly phase6ExperimentStore: Phase6ExperimentSqliteStore;
  readonly phase6RagTraceStore: Phase6RagTraceSqliteStore;
}

function nowIso() {
  return new Date().toISOString();
}

async function ensureSqliteDir(dbPath: string) {
  await mkdir(dirname(dbPath), { recursive: true });
}

function openSqlite(dbPath: string) {
  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA busy_timeout = 5000");
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");
  return db;
}

function initializeSqliteSchema(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS jsonl_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_name TEXT NOT NULL,
      line_number INTEGER NOT NULL,
      record_type TEXT,
      record_json TEXT NOT NULL,
      inserted_at TEXT NOT NULL,
      UNIQUE(file_name, line_number)
    );
    CREATE INDEX IF NOT EXISTS idx_jsonl_records_file ON jsonl_records(file_name, line_number);
    CREATE TABLE IF NOT EXISTS epoch_events (
      event_id TEXT PRIMARY KEY,
      event_type TEXT NOT NULL,
      aggregate_type TEXT NOT NULL,
      aggregate_id TEXT NOT NULL,
      agent_id TEXT,
      trust_class TEXT NOT NULL,
      created_at TEXT NOT NULL,
      record_id INTEGER NOT NULL REFERENCES jsonl_records(id) ON DELETE CASCADE,
      event_json TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_epoch_events_type_created ON epoch_events(event_type, created_at);
    CREATE TABLE IF NOT EXISTS result_pages (
      page_id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      url_path TEXT NOT NULL,
      record_id INTEGER NOT NULL REFERENCES jsonl_records(id) ON DELETE CASCADE,
      page_json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS journey_events (
      event_id TEXT PRIMARY KEY,
      journey_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      agent_id TEXT NOT NULL,
      explorer_id TEXT NOT NULL,
      occurred_at TEXT NOT NULL,
      journey_version INTEGER,
      record_id INTEGER NOT NULL REFERENCES jsonl_records(id) ON DELETE CASCADE,
      event_json TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_journey_events_journey_version
      ON journey_events(journey_id, journey_version, occurred_at);
    CREATE INDEX IF NOT EXISTS idx_journey_events_agent_time
      ON journey_events(agent_id, occurred_at);
    CREATE TABLE IF NOT EXISTS command_commits (
      command_id TEXT PRIMARY KEY,
      command TEXT NOT NULL,
      record_id INTEGER NOT NULL UNIQUE REFERENCES jsonl_records(id) ON DELETE CASCADE,
      commit_json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS tickets (
      run_ticket TEXT PRIMARY KEY,
      state TEXT,
      explorer_id TEXT,
      agent_id TEXT,
      record_id INTEGER NOT NULL REFERENCES jsonl_records(id) ON DELETE CASCADE,
      ticket_json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS submitted_runs (
      run_ticket TEXT PRIMARY KEY,
      explorer_id TEXT,
      score INTEGER,
      visibility TEXT,
      world_impact TEXT,
      submitted_at TEXT,
      record_id INTEGER NOT NULL REFERENCES jsonl_records(id) ON DELETE CASCADE,
      run_json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS causal_idempotency_manifests (
      scope TEXT PRIMARY KEY,
      input_hash TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('pending', 'committed', 'rejected')),
      owner_id TEXT,
      fencing_token INTEGER NOT NULL DEFAULT 0,
      lease_expires_at TEXT,
      manifest_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  initializeJourneyRunReceiptSchema(db);
  initializePhase6CommittedResultSchema(db);
  initializeWorldMemorySchema(db);
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS result_pages_world_memory_dirty_ai
    AFTER INSERT ON result_pages BEGIN
      UPDATE world_memory_meta SET value = '1' WHERE key = 'projection_dirty';
    END;
    CREATE TRIGGER IF NOT EXISTS result_pages_world_memory_dirty_au
    AFTER UPDATE OF page_json ON result_pages BEGIN
      UPDATE world_memory_meta SET value = '1' WHERE key = 'projection_dirty';
    END;
    CREATE TRIGGER IF NOT EXISTS result_pages_world_memory_dirty_ad
    AFTER DELETE ON result_pages BEGIN
      UPDATE world_memory_meta SET value = '1' WHERE key = 'projection_dirty';
    END;
  `);
  db.prepare("INSERT OR IGNORE INTO schema_migrations(version, applied_at) VALUES (?, ?)").run(1, nowIso());
  const v2 = db.prepare("SELECT version FROM schema_migrations WHERE version = 2").get();
  if (!v2) {
    let migrationStarted = false;
    try {
      db.exec("BEGIN IMMEDIATE");
      migrationStarted = true;
      const concurrentlyApplied = db.prepare("SELECT version FROM schema_migrations WHERE version = 2").get();
      if (!concurrentlyApplied) {
        backfillSqliteIndexes(db);
        db.prepare("INSERT INTO schema_migrations(version, applied_at) VALUES (?, ?)").run(2, nowIso());
      }
      db.exec("COMMIT");
      migrationStarted = false;
    } catch (error) {
      if (migrationStarted) db.exec("ROLLBACK");
      throw error;
    }
  }
  const v3 = db.prepare("SELECT version FROM schema_migrations WHERE version = 3").get();
  if (!v3) {
    let migrationStarted = false;
    try {
      db.exec("BEGIN IMMEDIATE");
      migrationStarted = true;
      const concurrentlyApplied = db.prepare("SELECT version FROM schema_migrations WHERE version = 3").get();
      if (!concurrentlyApplied) {
        backfillWorldMemoryFromResultPages(db);
        db.prepare("INSERT INTO schema_migrations(version, applied_at) VALUES (?, ?)").run(3, nowIso());
      }
      db.exec("COMMIT");
      migrationStarted = false;
    } catch (error) {
      if (migrationStarted) db.exec("ROLLBACK");
      throw error;
    }
  }
}

export function createAgentSqlitePersistenceStores(dbPath: string): AgentSqlitePersistenceStores {
  const database = openSqlite(dbPath);
  try {
    initializeSqliteSchema(database);
    return {
      database,
      receiptRepository: createJourneyRunReceiptSqliteStore(database),
      phase6JourneyContextStore: createPhase6JourneyContextSqliteStore(database),
      phase6ExperimentStore: createPhase6ExperimentSqliteStore(database),
      phase6RagTraceStore: createPhase6RagTraceStore(database),
    };
  } catch (error) {
    database.close();
    throw error;
  }
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function recordValue(value: unknown): JsonRecord {
  return isRecord(value) ? value : {};
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function stringOrNull(value: unknown) {
  return stringValue(value) || null;
}

function recordType(record: JsonRecord) {
  return typeof record.type === "string" ? record.type : null;
}

function numberValue(value: unknown) {
  return Number.isSafeInteger(value) ? Number(value) : undefined;
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (isRecord(value)) {
    return `{${Object.keys(value)
      .filter((key) => value[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function emptyKnownJsonlRecordFiles(): MutableKnownJsonlRecordFiles {
  return {
    "tickets.jsonl": [],
    "runs.jsonl": [],
    "lore.jsonl": [],
    "progression.jsonl": [],
    "factions.jsonl": [],
    "community.jsonl": [],
    "experience.jsonl": [],
    "transparency.jsonl": [],
    "epoch-events.jsonl": [],
    "journey-events.jsonl": [],
    "command-events.jsonl": [],
    "result-pages.jsonl": [],
    "context-snapshots.jsonl": [],
    "outbox.jsonl": [],
  };
}

function hydrateKnownJsonlRecordFiles(files: KnownJsonlRecordFiles) {
  return hydrateAgentRuntimeOptions({
    tickets: files["tickets.jsonl"],
    runs: files["runs.jsonl"],
    lore: files["lore.jsonl"],
    progression: files["progression.jsonl"],
    factions: files["factions.jsonl"],
    community: files["community.jsonl"],
    experience: files["experience.jsonl"],
    transparency: files["transparency.jsonl"],
    epochEvents: files["epoch-events.jsonl"],
    journeyEvents: files["journey-events.jsonl"],
    commandEvents: files["command-events.jsonl"],
    resultPages: files["result-pages.jsonl"],
    contextSnapshots: files["context-snapshots.jsonl"],
    outbox: files["outbox.jsonl"],
  });
}

function validateKnownJsonlRecordFiles(files: KnownJsonlRecordFiles) {
  validateCanonicalRecoveryConflicts({
    epochEvents: files["epoch-events.jsonl"],
    journeyEvents: files["journey-events.jsonl"],
    commandEvents: files["command-events.jsonl"],
    resultPages: files["result-pages.jsonl"],
  });
}

function lastInsertId(db: DatabaseSync) {
  const row = db.prepare("SELECT last_insert_rowid() AS id").get() as { id: number | bigint };
  return Number(row.id);
}

function insertJsonlRecord(
  db: DatabaseSync,
  fileName: string,
  lineNumber: number,
  record: JsonRecord,
) {
  const recordJson = JSON.stringify(record);
  db.prepare(`
    INSERT INTO jsonl_records(file_name, line_number, record_type, record_json, inserted_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(fileName, lineNumber, recordType(record), recordJson, nowIso());
  return lastInsertId(db);
}

function indexEpochEvent(db: DatabaseSync, recordId: number, event: EpochEvent, strict: boolean) {
  const eventId = stringValue(event.eventId);
  const eventType = stringValue(event.eventType);
  const aggregateType = stringValue(event.aggregateType);
  const aggregateId = stringValue(event.aggregateId);
  const trustClass = stringValue(event.trustClass);
  const createdAt = stringValue(event.createdAt);
  if (!eventId || !eventType || !aggregateType || !aggregateId || !trustClass || !createdAt) {
    if (strict) throw new Error("epoch_event_index_fields_required");
    return;
  }
  const eventJson = JSON.stringify(event);
  const existing = db.prepare("SELECT event_json FROM epoch_events WHERE event_id = ?")
    .get(eventId) as { event_json: string } | undefined;
  if (existing) {
    const existingEvent = JSON.parse(existing.event_json) as unknown;
    if (canonicalJson(existingEvent) === canonicalJson(event)) return;
    throw new Error("epoch_event_recovery_conflict");
  }
  db.prepare(`
    INSERT INTO epoch_events(
      event_id, event_type, aggregate_type, aggregate_id, agent_id, trust_class, created_at, record_id, event_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    eventId,
    eventType,
    aggregateType,
    aggregateId,
    stringOrNull(event.agentId),
    trustClass,
    createdAt,
    recordId,
    eventJson,
  );
}

function indexJourneyEvent(
  db: DatabaseSync,
  recordId: number,
  event: JsonRecord,
  strict: boolean,
) {
  const eventId = stringValue(event.eventId);
  const journeyId = stringValue(event.journeyId);
  const eventType = stringValue(event.eventType);
  const agentId = stringValue(event.agentId);
  const explorerId = stringValue(event.explorerId);
  const occurredAt = stringValue(event.occurredAt);
  const journey = recordValue(event.journey);
  const journeyVersion = Number.isSafeInteger(journey.version) ? Number(journey.version) : null;
  if (!eventId || !journeyId || !eventType || !agentId || !explorerId || !occurredAt) {
    if (strict) throw new Error("journey_event_index_fields_required");
    return;
  }
  const insertSql = strict
    ? `INSERT INTO journey_events(
        event_id, journey_id, event_type, agent_id, explorer_id, occurred_at,
        journey_version, record_id, event_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    : `INSERT OR REPLACE INTO journey_events(
        event_id, journey_id, event_type, agent_id, explorer_id, occurred_at,
        journey_version, record_id, event_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  db.prepare(insertSql).run(
    eventId,
    journeyId,
    eventType,
    agentId,
    explorerId,
    occurredAt,
    journeyVersion,
    recordId,
    JSON.stringify(event),
  );
}

function indexResultPage(db: DatabaseSync, recordId: number, page: JsonRecord) {
  const pageId = stringValue(page.pageId);
  const createdAt = stringValue(page.createdAt);
  const urlPath = stringValue(page.urlPath);
  if (!pageId || !createdAt || !urlPath) return;
  db.prepare(`
    INSERT OR REPLACE INTO result_pages(page_id, created_at, url_path, record_id, page_json)
    VALUES (?, ?, ?, ?, ?)
  `).run(pageId, createdAt, urlPath, recordId, JSON.stringify(page));
  db.exec("SAVEPOINT world_memory_projection");
  try {
    indexCanonicalResultPageForWorldMemory(db, page);
    db.exec("RELEASE SAVEPOINT world_memory_projection");
  } catch {
    try {
      db.exec("ROLLBACK TO SAVEPOINT world_memory_projection");
    } finally {
      db.exec("RELEASE SAVEPOINT world_memory_projection");
    }
    try {
      markWorldMemoryProjectionDirty(db);
    } catch {
      // A damaged derived schema must still not roll back the canonical page.
    }
  }
}

function indexCommandCommit(db: DatabaseSync, recordId: number, record: JsonRecord, strict: boolean) {
  const commandId = stringValue(record.commandId);
  const command = stringValue(record.command);
  if (!commandId || !command) {
    if (strict) throw new Error("agent_command_commit_index_fields_required");
    return;
  }
  const insertSql = strict
    ? "INSERT INTO command_commits(command_id, command, record_id, commit_json) VALUES (?, ?, ?, ?)"
    : "INSERT OR REPLACE INTO command_commits(command_id, command, record_id, commit_json) VALUES (?, ?, ?, ?)";
  db.prepare(insertSql).run(commandId, command, recordId, JSON.stringify(record));
}

function indexKnownRecord(
  db: DatabaseSync,
  recordId: number,
  record: JsonRecord,
  strictEpochConflicts = false,
) {
  if (record.type === "epoch_event" || record.type === "epoch_event_batch") {
    for (const event of epochEventsFromPersistenceRecord(record)) {
      indexEpochEvent(db, recordId, event, strictEpochConflicts);
    }
  }
  const directJourneyEvent = record.type === "journey_event" ? recordValue(record.event) : record;
  if (stringValue(directJourneyEvent.eventId)
    && stringValue(directJourneyEvent.journeyId)
    && stringValue(directJourneyEvent.eventType)) {
    indexJourneyEvent(db, recordId, directJourneyEvent, strictEpochConflicts);
  }
  if (record.type === "epoch_result_page" && isRecord(record.page)) {
    indexResultPage(db, recordId, record.page);
  }
  if (record.type === "agent_command_commit") {
    indexCommandCommit(db, recordId, record, strictEpochConflicts);
    const epochEvents = Array.isArray(record.epochEvents) ? record.epochEvents : [];
    for (const event of epochEventsFromPersistenceRecord({ type: "epoch_event_batch", events: epochEvents })) {
      indexEpochEvent(db, recordId, event, strictEpochConflicts);
    }
    const journeyEvents = Array.isArray(record.journeyEvents) ? record.journeyEvents : [];
    for (const event of journeyEvents) {
      if (!isRecord(event)) {
        if (strictEpochConflicts) throw new Error("journey_event_index_invalid");
        continue;
      }
      indexJourneyEvent(db, recordId, event, strictEpochConflicts);
    }
    const resultPages = Array.isArray(record.resultPages) ? record.resultPages : [];
    for (const page of resultPages) if (isRecord(page)) indexResultPage(db, recordId, page);
    for (const committed of phase6CommittedResultsForPersistence(record)) {
      appendPhase6CommittedResultInTransaction(
        db,
        committed.journeyId,
        committed.result,
        committed.createdAt,
      );
    }
  }
  const recordRunTicket = stringValue(record.runTicket);
  if (record.type === "ticket_issued" && recordRunTicket) {
    db.prepare(`
      INSERT OR REPLACE INTO tickets(run_ticket, state, explorer_id, agent_id, record_id, ticket_json)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      recordRunTicket,
      stringValue(record.state) || "issued",
      stringOrNull(record.explorerId),
      stringOrNull(record.agentId),
      recordId,
      JSON.stringify(record),
    );
  }
  if (record.type === "run_submitted" && recordRunTicket) {
    const run = recordValue(record.run);
    const adjudication = recordValue(record.adjudication);
    const settledTicket = {
      runTicket: recordRunTicket,
      state: "settled",
      explorerId: stringOrNull(run.explorerId) || stringOrNull(record.explorerId),
      agentId: stringOrNull(run.agentId),
      submittedAt: stringOrNull(record.submittedAt),
      settledAt: stringOrNull(record.settledAt) || stringOrNull(record.submittedAt),
      adjudication,
    };
    db.prepare(`
      INSERT OR REPLACE INTO tickets(run_ticket, state, explorer_id, agent_id, record_id, ticket_json)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      recordRunTicket,
      "settled",
      settledTicket.explorerId,
      settledTicket.agentId,
      recordId,
      JSON.stringify(settledTicket),
    );
    db.prepare(`
      INSERT OR REPLACE INTO submitted_runs(
        run_ticket, explorer_id, score, visibility, world_impact, submitted_at, record_id, run_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      recordRunTicket,
      stringOrNull(run.explorerId) || stringOrNull(record.explorerId),
      Number.isFinite(Number(adjudication.score)) ? Number(adjudication.score) : null,
      stringOrNull(run.visibility),
      stringOrNull(adjudication.worldImpact),
      stringOrNull(record.submittedAt),
      recordId,
      JSON.stringify(record),
    );
  }
}

function parseCausalIdempotencyManifest(value: unknown): CausalIdempotencyManifest | undefined {
  if (!isRecord(value)) return undefined;
  const status = stringValue(value.status);
  if (status !== "pending" && status !== "committed" && status !== "rejected") return undefined;
  const scope = stringValue(value.scope);
  const worldId = stringValue(value.worldId);
  const commandType = stringValue(value.commandType);
  const actorRef = stringValue(value.actorRef);
  const idempotencyKey = stringValue(value.idempotencyKey);
  const inputHash = stringValue(value.inputHash);
  if (!scope || !worldId || !commandType || !actorRef || !idempotencyKey || !inputHash?.startsWith("sha256:")) {
    return undefined;
  }
  return {
    scope,
    worldId,
    commandType,
    actorRef,
    idempotencyKey,
    inputHash: inputHash as `sha256:${string}`,
    status,
    eventIds: Array.isArray(value.eventIds) ? value.eventIds.filter((entry): entry is string => typeof entry === "string") : [],
    ...(stringValue(value.rejectionCode) ? { rejectionCode: stringValue(value.rejectionCode) } : {}),
    ...(stringValue(value.scheduledKey) ? { scheduledKey: stringValue(value.scheduledKey) } : {}),
    ...(stringValue(value.createdAt) ? { createdAt: stringValue(value.createdAt) } : {}),
    ...(stringValue(value.ownerId) ? { ownerId: stringValue(value.ownerId) } : {}),
    ...(numberValue(value.fencingToken) !== undefined ? { fencingToken: numberValue(value.fencingToken) } : {}),
    ...(stringValue(value.leaseExpiresAt) ? { leaseExpiresAt: stringValue(value.leaseExpiresAt) } : {}),
    ...(stringValue(value.updatedAt) ? { updatedAt: stringValue(value.updatedAt) } : {}),
  };
}

function readSqliteCausalManifestInTransaction(db: DatabaseSync, scope: string) {
  const row = db.prepare(`
    SELECT manifest_json
    FROM causal_idempotency_manifests
    WHERE scope = ?
  `).get(scope) as { manifest_json: string } | undefined;
  if (!row) return undefined;
  return parseCausalIdempotencyManifest(JSON.parse(row.manifest_json) as unknown);
}

function upsertSqliteCausalManifestInTransaction(db: DatabaseSync, manifest: CausalIdempotencyManifest) {
  db.prepare(`
    INSERT INTO causal_idempotency_manifests(
      scope, input_hash, status, owner_id, fencing_token, lease_expires_at, manifest_json, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(scope) DO UPDATE SET
      input_hash = excluded.input_hash,
      status = excluded.status,
      owner_id = excluded.owner_id,
      fencing_token = excluded.fencing_token,
      lease_expires_at = excluded.lease_expires_at,
      manifest_json = excluded.manifest_json,
      updated_at = excluded.updated_at
  `).run(
    manifest.scope,
    manifest.inputHash,
    manifest.status,
    stringOrNull(manifest.ownerId),
    manifest.fencingToken || 0,
    stringOrNull(manifest.leaseExpiresAt),
    JSON.stringify(manifest),
    stringValue(manifest.updatedAt) || nowIso(),
  );
}

function sqliteClaimFromExisting(
  existing: CausalIdempotencyManifest,
  input: CausalIdempotencyInput,
  options: { readonly ownerId: string; readonly now: string; readonly leaseExpiresAt: string },
): CausalIdempotencyClaimResult {
  assertCausalIdempotencyReplay(existing, input);
  if (existing.status === "pending" && causalIdempotencyLeaseExpired(existing, options.now)) {
    return {
      kind: "reserved",
      reservation: {
        manifest: pendingCausalManifest({
          ...input,
          ownerId: options.ownerId,
          fencingToken: (existing.fencingToken || 0) + 1,
          leaseExpiresAt: options.leaseExpiresAt,
          createdAt: existing.createdAt || options.now,
          updatedAt: options.now,
        }),
      },
    };
  }
  if (existing.status === "pending") return { kind: "pending", manifest: existing };
  return { kind: existing.status, manifest: existing };
}

function appendSqliteJsonlInTransaction(
  db: DatabaseSync,
  fileName: string,
  record: unknown,
) {
  const row = db.prepare(`
    SELECT COALESCE(MAX(line_number), 0) + 1 AS nextLine
    FROM jsonl_records
    WHERE file_name = ?
  `).get(fileName) as { nextLine: number };
  const jsonRecord = recordValue(record);
  const recordId = insertJsonlRecord(db, fileName, Number(row.nextLine), jsonRecord);
  indexKnownRecord(db, recordId, jsonRecord, true);
}

function backfillSqliteIndexes(db: DatabaseSync) {
  const rows = db.prepare(`
    SELECT id, file_name, record_json
    FROM jsonl_records
    ORDER BY id ASC
  `).all() as { id: number; file_name: string; record_json: string }[];
  const recordsByFile = emptyKnownJsonlRecordFiles();
  const parsedRows: { readonly id: number; readonly record: JsonRecord }[] = [];
  for (const row of rows) {
    const parsed: unknown = JSON.parse(row.record_json);
    if (!isRecord(parsed)) continue;
    if (Object.hasOwn(recordsByFile, row.file_name)) {
      recordsByFile[row.file_name as KnownJsonlFileName].push(parsed);
    }
    parsedRows.push({ id: Number(row.id), record: parsed });
  }
  validateKnownJsonlRecordFiles(recordsByFile);
  for (const row of parsedRows) {
    indexKnownRecord(db, row.id, row.record, false);
  }
}

async function readJsonlFile(filePath: string): Promise<JsonRecord[]> {
  try {
    const raw = await readFile(filePath, "utf8");
    return raw
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as unknown)
      .filter(isRecord);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return [];
    throw error;
  }
}

export async function migrateJsonlDataDirToSqlite({
  sourceDataDir,
  dbPath,
}: {
  readonly sourceDataDir: string;
  readonly dbPath: string;
}): Promise<SqliteMigrationSummary> {
  const sourceEntries = await Promise.all(KNOWN_JSONL_FILES.map(async (fileName) => [
    fileName,
    await readJsonlFile(join(sourceDataDir, fileName)),
  ] as const));
  const sourceFiles = Object.fromEntries(sourceEntries) as MutableKnownJsonlRecordFiles;
  validateKnownJsonlRecordFiles(sourceFiles);

  await ensureSqliteDir(dbPath);
  const db = openSqlite(dbPath);
  const files: Record<string, number> = {};
  let records = 0;
  let transactionStarted = false;
  try {
    initializeSqliteSchema(db);
    db.exec("BEGIN");
    transactionStarted = true;
    for (const fileName of KNOWN_JSONL_FILES) {
      const fileRecords = sourceFiles[fileName];
      files[fileName] = fileRecords.length;
      fileRecords.forEach((record, index) => {
        const recordId = insertJsonlRecord(db, fileName, index + 1, record);
        indexKnownRecord(db, recordId, record);
      });
      records += fileRecords.length;
    }
    db.exec("COMMIT");
    transactionStarted = false;
  } catch (error) {
    if (transactionStarted) db.exec("ROLLBACK");
    throw error;
  } finally {
    db.close();
  }
  return { dbPath, records, files };
}

export async function appendSqliteJsonl(dbPath: string, fileName: string, record: unknown) {
  await ensureSqliteDir(dbPath);
  const db = openSqlite(dbPath);
  let transactionStarted = false;
  try {
    initializeSqliteSchema(db);
    db.exec("BEGIN IMMEDIATE");
    transactionStarted = true;
    const row = db.prepare(`
      SELECT COALESCE(MAX(line_number), 0) + 1 AS nextLine
      FROM jsonl_records
      WHERE file_name = ?
    `).get(fileName) as { nextLine: number };
    const jsonRecord = recordValue(record);
    const recordId = insertJsonlRecord(db, fileName, Number(row.nextLine), jsonRecord);
    indexKnownRecord(db, recordId, jsonRecord, true);
    db.exec("COMMIT");
    transactionStarted = false;
  } catch (error) {
    if (transactionStarted) db.exec("ROLLBACK");
    throw error;
  } finally {
    db.close();
  }
}

export function createSqliteCausalIdempotencyManifestStore(
  dbPath: string,
): CausalIdempotencyManifestStore {
  function withTransaction<T>(mode: "BEGIN" | "BEGIN IMMEDIATE", task: (db: DatabaseSync) => T): T {
    const db = openSqlite(dbPath);
    let transactionStarted = false;
    try {
      initializeSqliteSchema(db);
      db.exec(mode);
      transactionStarted = true;
      const result = task(db);
      db.exec("COMMIT");
      transactionStarted = false;
      return result;
    } catch (error) {
      if (transactionStarted) db.exec("ROLLBACK");
      throw error;
    } finally {
      db.close();
    }
  }

  return {
    read(scope) {
      const db = openSqlite(dbPath);
      try {
        initializeSqliteSchema(db);
        return readSqliteCausalManifestInTransaction(db, scope);
      } finally {
        db.close();
      }
    },
    write(manifest) {
      withTransaction("BEGIN IMMEDIATE", (db) => {
        const existing = readSqliteCausalManifestInTransaction(db, manifest.scope);
        if (existing && existing.scope !== manifest.scope) throw new Error("causal_idempotency_scope_conflict");
        if (existing && existing.inputHash !== manifest.inputHash) {
          throw new Error("causal_idempotency_input_hash_conflict");
        }
        upsertSqliteCausalManifestInTransaction(db, manifest);
      });
    },
    putIfAbsent(manifest) {
      return withTransaction("BEGIN IMMEDIATE", (db) => {
        const existing = readSqliteCausalManifestInTransaction(db, manifest.scope);
        if (existing) return existing;
        upsertSqliteCausalManifestInTransaction(db, manifest);
        return undefined;
      });
    },
    claimReservation(input, options) {
      return withTransaction("BEGIN IMMEDIATE", (db) => {
        const scope = causalIdempotencyScope(input);
        const existing = readSqliteCausalManifestInTransaction(db, scope);
        if (existing) {
          const claim = sqliteClaimFromExisting(existing, input, options);
          if (claim.kind === "reserved") upsertSqliteCausalManifestInTransaction(db, claim.reservation.manifest);
          return claim;
        }
        const manifest = pendingCausalManifest({
          ...input,
          ownerId: options.ownerId,
          fencingToken: 1,
          leaseExpiresAt: options.leaseExpiresAt,
          createdAt: options.now,
          updatedAt: options.now,
        });
        upsertSqliteCausalManifestInTransaction(db, manifest);
        return { kind: "reserved", reservation: { manifest } };
      });
    },
    finalizeReservation(reservation, manifest) {
      return withTransaction("BEGIN IMMEDIATE", (db) => {
        const existing = readSqliteCausalManifestInTransaction(db, reservation.manifest.scope);
        const finalized = assertCausalReservationFinalization(reservation, existing, manifest);
        upsertSqliteCausalManifestInTransaction(db, finalized);
        return finalized;
      });
    },
    commitAtomically(reservation, manifest, commit) {
      return withTransaction("BEGIN IMMEDIATE", (db) => {
        const existing = readSqliteCausalManifestInTransaction(db, reservation.manifest.scope);
        const finalized = assertCausalReservationFinalization(reservation, existing, manifest);
        const atomic: CausalAtomicCommitContext = {
          appendJsonl(fileName, record) {
            appendSqliteJsonlInTransaction(db, fileName, record);
          },
        };
        const result = commit(atomic);
        if (result && typeof result === "object" && "then" in result) {
          throw new Error("causal_idempotency_sqlite_atomic_commit_must_be_sync");
        }
        upsertSqliteCausalManifestInTransaction(db, finalized);
        return finalized;
      });
    },
  };
}

export async function appendSqliteEpochEventBatch(dbPath: string, events: readonly EpochEvent[]) {
  if (events.length === 0) return;
  const batchRecord = createEpochEventBatchRecord(events);
  JSON.stringify(batchRecord);
  const jsonRecord = recordValue(batchRecord);
  await ensureSqliteDir(dbPath);
  const db = openSqlite(dbPath);
  let transactionStarted = false;
  try {
    initializeSqliteSchema(db);
    db.exec("BEGIN IMMEDIATE");
    transactionStarted = true;
    const row = db.prepare(`
      SELECT COALESCE(MAX(line_number), 0) + 1 AS nextLine
      FROM jsonl_records
      WHERE file_name = ?
    `).get("epoch-events.jsonl") as { nextLine: number };
    const recordId = insertJsonlRecord(
      db,
      "epoch-events.jsonl",
      Number(row.nextLine),
      jsonRecord,
    );
    indexKnownRecord(db, recordId, jsonRecord, true);
    db.exec("COMMIT");
    transactionStarted = false;
  } catch (error) {
    if (transactionStarted) db.exec("ROLLBACK");
    throw error;
  } finally {
    db.close();
  }
}

export function readSqliteJsonlRecords(dbPath: string, fileName: string): JsonRecord[] {
  const db = openSqlite(dbPath);
  try {
    initializeSqliteSchema(db);
    const rows = db.prepare(`
      SELECT record_json
      FROM jsonl_records
      WHERE file_name = ?
      ORDER BY line_number ASC
    `).all(fileName) as { record_json: string }[];
    return rows
      .map((row) => JSON.parse(row.record_json) as unknown)
      .filter(isRecord);
  } finally {
    db.close();
  }
}

function readSqliteCanonicalEpochEventRecords(dbPath: string): JsonRecord[] {
  const db = openSqlite(dbPath);
  try {
    initializeSqliteSchema(db);
    const rows = db.prepare(`
      SELECT event_json
      FROM epoch_events
      ORDER BY record_id ASC, rowid ASC
    `).all() as { event_json: string }[];
    return rows.map((row) => ({
      type: "epoch_event",
      event: epochEventsFromPersistenceRecord(JSON.parse(row.event_json) as unknown)[0],
    }));
  } finally {
    db.close();
  }
}

export async function loadAgentRuntimeOptionsFromSqlite(dbPath: string) {
  await ensureSqliteDir(dbPath);
  const files = Object.fromEntries(KNOWN_JSONL_FILES.map((fileName) => [
    fileName,
    readSqliteJsonlRecords(dbPath, fileName),
  ])) as MutableKnownJsonlRecordFiles;
  files["epoch-events.jsonl"] = readSqliteCanonicalEpochEventRecords(dbPath);
  return hydrateKnownJsonlRecordFiles(files);
}
