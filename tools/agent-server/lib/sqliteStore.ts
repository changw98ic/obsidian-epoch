import { DatabaseSync } from "node:sqlite";
import { mkdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { type EpochEvent } from "./epoch/events.ts";
import {
  createEpochEventBatchRecord,
  epochEventsFromPersistenceRecord,
} from "./epochPersistence.ts";
import { hydrateAgentRuntimeOptions } from "./store.ts";

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
  "result-pages.jsonl",
  "context-snapshots.jsonl",
  "outbox.jsonl",
] as const;

export interface SqliteMigrationSummary {
  readonly dbPath: string;
  readonly records: number;
  readonly files: Readonly<Record<string, number>>;
}

function nowIso() {
  return new Date().toISOString();
}

async function ensureSqliteDir(dbPath: string) {
  await mkdir(dirname(dbPath), { recursive: true });
}

function openSqlite(dbPath: string) {
  const db = new DatabaseSync(dbPath);
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
  `);
  db.prepare("INSERT OR IGNORE INTO schema_migrations(version, applied_at) VALUES (?, ?)").run(1, nowIso());
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

function lastInsertId(db: DatabaseSync) {
  const row = db.prepare("SELECT last_insert_rowid() AS id").get() as { id: number | bigint };
  return Number(row.id);
}

function insertJsonlRecord(
  db: DatabaseSync,
  fileName: string,
  lineNumber: number,
  record: JsonRecord,
  strict = false,
) {
  const recordJson = JSON.stringify(record);
  const insertSql = strict
    ? `INSERT INTO jsonl_records(file_name, line_number, record_type, record_json, inserted_at)
       VALUES (?, ?, ?, ?, ?)`
    : `INSERT OR IGNORE INTO jsonl_records(file_name, line_number, record_type, record_json, inserted_at)
       VALUES (?, ?, ?, ?, ?)`;
  db.prepare(insertSql).run(fileName, lineNumber, recordType(record), recordJson, nowIso());
  if (strict) return lastInsertId(db);
  const existing = db.prepare(`
    SELECT id FROM jsonl_records WHERE file_name = ? AND line_number = ?
  `).get(fileName, lineNumber) as { id: number } | undefined;
  return existing?.id || lastInsertId(db);
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
  const insertSql = strict
    ? `INSERT INTO epoch_events(
        event_id, event_type, aggregate_type, aggregate_id, agent_id, trust_class, created_at, record_id, event_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    : `INSERT OR REPLACE INTO epoch_events(
        event_id, event_type, aggregate_type, aggregate_id, agent_id, trust_class, created_at, record_id, event_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  db.prepare(insertSql).run(
    eventId,
    eventType,
    aggregateType,
    aggregateId,
    stringOrNull(event.agentId),
    trustClass,
    createdAt,
    recordId,
    JSON.stringify(event),
  );
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
  if (record.type === "epoch_result_page" && isRecord(record.page)) {
    const page = record.page;
    const pageId = stringValue(page.pageId);
    const createdAt = stringValue(page.createdAt);
    const urlPath = stringValue(page.urlPath);
    if (!pageId || !createdAt || !urlPath) return;
    db.prepare(`
      INSERT OR REPLACE INTO result_pages(page_id, created_at, url_path, record_id, page_json)
      VALUES (?, ?, ?, ?, ?)
    `).run(pageId, createdAt, urlPath, recordId, JSON.stringify(page));
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
  await ensureSqliteDir(dbPath);
  const db = openSqlite(dbPath);
  const files: Record<string, number> = {};
  let records = 0;
  try {
    initializeSqliteSchema(db);
    db.exec("BEGIN");
    for (const fileName of KNOWN_JSONL_FILES) {
      const fileRecords = await readJsonlFile(join(sourceDataDir, fileName));
      files[fileName] = fileRecords.length;
      fileRecords.forEach((record, index) => {
        const recordId = insertJsonlRecord(db, fileName, index + 1, record);
        indexKnownRecord(db, recordId, record);
      });
      records += fileRecords.length;
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  } finally {
    db.close();
  }
  return { dbPath, records, files };
}

export async function appendSqliteJsonl(dbPath: string, fileName: string, record: unknown) {
  await ensureSqliteDir(dbPath);
  const db = openSqlite(dbPath);
  try {
    initializeSqliteSchema(db);
    const row = db.prepare(`
      SELECT COALESCE(MAX(line_number), 0) + 1 AS nextLine
      FROM jsonl_records
      WHERE file_name = ?
    `).get(fileName) as { nextLine: number };
    db.exec("BEGIN");
    const jsonRecord = recordValue(record);
    const recordId = insertJsonlRecord(db, fileName, Number(row.nextLine), jsonRecord);
    indexKnownRecord(db, recordId, jsonRecord);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  } finally {
    db.close();
  }
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
      true,
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

export async function loadAgentRuntimeOptionsFromSqlite(dbPath: string) {
  await ensureSqliteDir(dbPath);
  const files = Object.fromEntries(KNOWN_JSONL_FILES.map((fileName) => [
    fileName,
    readSqliteJsonlRecords(dbPath, fileName),
  ]));
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
    resultPages: files["result-pages.jsonl"],
    contextSnapshots: files["context-snapshots.jsonl"],
    outbox: files["outbox.jsonl"],
  });
}
