import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import {
  attachEpochEventsForPersistence,
  epochEventsForPersistence,
} from "./runtimePublicProjectionRules.ts";

type JsonRecord = Record<string, unknown>;
type Phase6CommittedResultHash = `sha256:${string}`;

export interface Phase6CommittedResultRecord {
  readonly journeyId: string;
  readonly sequence: number;
  readonly payloadHash: Phase6CommittedResultHash;
  readonly result: JsonRecord;
  readonly createdAt: string;
}

export interface Phase6CommittedResultSqliteStore {
  readonly append: (journeyId: string, result: unknown, createdAt?: string) => Phase6CommittedResultRecord;
  readonly listByJourneyId: (journeyId: string) => readonly Phase6CommittedResultRecord[];
}

export interface Phase6CommittedResultPersistenceEntry {
  readonly journeyId: string;
  readonly result: unknown;
  readonly createdAt?: string;
}

interface Phase6CommittedResultRow {
  readonly journey_id: string;
  readonly sequence: number;
  readonly payload_hash: string;
  readonly result_json: string;
  readonly created_at: string;
}

const SECRET_KEY_PATTERN = /(?:api[_-]?key|secret|token|password|credential|private[_-]?key|recovery[\s_-]?code|authorization|cookie|session[\s_-]?key)/i;
const committedResultsForPersistence = new WeakMap<object, readonly Phase6CommittedResultPersistenceEntry[]>();

export function attachPhase6CommittedResultForPersistence<T extends object>(
  target: T,
  entry: Phase6CommittedResultPersistenceEntry,
): T {
  const entries = committedResultsForPersistence.get(target) ?? [];
  committedResultsForPersistence.set(target, [...entries, entry]);
  return target;
}

export function phase6CommittedResultsForPersistence(
  value: unknown,
): readonly Phase6CommittedResultPersistenceEntry[] {
  return value && typeof value === "object"
    ? committedResultsForPersistence.get(value) ?? []
    : [];
}

export function initializePhase6CommittedResultSchema(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS phase6_committed_results (
      journey_id TEXT NOT NULL,
      sequence INTEGER NOT NULL CHECK(sequence >= 1),
      payload_hash TEXT NOT NULL,
      result_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (journey_id, sequence),
      UNIQUE (journey_id, payload_hash)
    );
    CREATE INDEX IF NOT EXISTS idx_phase6_committed_results_journey_sequence
      ON phase6_committed_results(journey_id, sequence);
    CREATE TRIGGER IF NOT EXISTS phase6_committed_results_no_update
    BEFORE UPDATE ON phase6_committed_results BEGIN
      SELECT RAISE(ABORT, 'phase6_committed_results_append_only');
    END;
    CREATE TRIGGER IF NOT EXISTS phase6_committed_results_no_delete
    BEFORE DELETE ON phase6_committed_results BEGIN
      SELECT RAISE(ABORT, 'phase6_committed_results_append_only');
    END;
  `);
}

export function createPhase6CommittedResultSqliteStore(
  db: DatabaseSync,
): Phase6CommittedResultSqliteStore {
  initializePhase6CommittedResultSchema(db);

  const selectByJourney = db.prepare(`
    SELECT journey_id, sequence, payload_hash, result_json, created_at
    FROM phase6_committed_results
    WHERE journey_id = ?
    ORDER BY sequence
  `);
  return {
    append(journeyId: string, result: unknown, createdAt?: string) {
      let started = false;
      try {
        db.exec("BEGIN IMMEDIATE");
        started = true;
        const appended = appendPhase6CommittedResultInTransaction(db, journeyId, result, createdAt);
        db.exec("COMMIT");
        started = false;
        return appended;
      } catch (error) {
        if (started) db.exec("ROLLBACK");
        throw error;
      }
    },
    listByJourneyId(journeyId: string) {
      const normalizedJourneyId = requireText(journeyId, "journey_id");
      return selectByJourney.all(normalizedJourneyId)
        .map((row) => rowToRecord(assertRow(row, normalizedJourneyId)));
    },
  };
}

export function appendPhase6CommittedResultInTransaction(
  db: DatabaseSync,
  journeyId: string,
  result: unknown,
  createdAt?: string,
): Phase6CommittedResultRecord {
  const normalizedJourneyId = requireText(journeyId, "journey_id");
  const normalizedResult = normalizeCommittedResult(result);
  assertNoSecretKeys(normalizedResult);
  const resultJson = canonicalJson(normalizedResult);
  const payloadHash = sha256(resultJson);
  const selectByHash = db.prepare(`
    SELECT journey_id, sequence, payload_hash, result_json, created_at
    FROM phase6_committed_results
    WHERE journey_id = ? AND payload_hash = ?
  `);
  const existing = selectByHash.get(normalizedJourneyId, payloadHash);
  if (existing) return rowToRecord(assertRow(existing, normalizedJourneyId));

  const sequence = sequenceFromRow(db.prepare(`
    SELECT COALESCE(MAX(sequence), 0) + 1 AS sequence
    FROM phase6_committed_results
    WHERE journey_id = ?
  `).get(normalizedJourneyId));
  db.prepare(`
    INSERT OR IGNORE INTO phase6_committed_results (
      journey_id,
      sequence,
      payload_hash,
      result_json,
      created_at
    ) VALUES (?, ?, ?, ?, ?)
  `).run(
    normalizedJourneyId,
    sequence,
    payloadHash,
    resultJson,
    requireText(createdAt || new Date().toISOString(), "created_at"),
  );
  const row = selectByHash.get(normalizedJourneyId, payloadHash);
  if (!row) throw new Error(`phase6_committed_result_append_failed:${normalizedJourneyId}`);
  return rowToRecord(assertRow(row, normalizedJourneyId));
}

function rowToRecord(row: Phase6CommittedResultRow): Phase6CommittedResultRecord {
  const hash = requireHash(row.payload_hash);
  const result = parseResult(row.result_json, row.journey_id, row.sequence);
  return {
    journeyId: row.journey_id,
    sequence: row.sequence,
    payloadHash: hash,
    result,
    createdAt: row.created_at,
  };
}

function assertRow(value: unknown, journeyId: string): Phase6CommittedResultRow {
  if (!isRecord(value)
    || typeof value.journey_id !== "string"
    || typeof value.sequence !== "number"
    || typeof value.payload_hash !== "string"
    || typeof value.result_json !== "string"
    || typeof value.created_at !== "string") {
    throw new Error(`phase6_committed_result_row_invalid:${journeyId}`);
  }
  return value as unknown as Phase6CommittedResultRow;
}

function parseResult(json: string, journeyId: string, sequence: number): JsonRecord {
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    throw new Error(`phase6_committed_result_json_invalid:${journeyId}:${sequence}`);
  }
  const result = requireRecord(value, "stored_result");
  assertNoSecretKeys(result);
  return withServerResolutionEvidence(result);
}

function sequenceFromRow(value: unknown): number {
  const sequence = isRecord(value) ? Number(value.sequence) : NaN;
  if (!Number.isSafeInteger(sequence) || sequence < 1) {
    throw new Error("phase6_committed_result_sequence_invalid");
  }
  return sequence;
}

function requireHash(value: string): Phase6CommittedResultHash {
  if (!/^sha256:[a-f0-9]{64}$/.test(value)) throw new Error("phase6_committed_result_hash_invalid");
  return value as Phase6CommittedResultHash;
}

function requireText(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`phase6_committed_result_${field}_required`);
  }
  return value.trim();
}

function requireRecord(value: unknown, field: string): JsonRecord {
  if (!isRecord(value)) throw new Error(`phase6_committed_result_${field}_record_required`);
  return value;
}

function normalizeCommittedResult(value: unknown): JsonRecord {
  const result = requireRecord(value, "result");
  if (Array.isArray(result.events)) return result;
  const events = epochEventsForPersistence(value);
  return events.length > 0 ? { ...result, events } : result;
}

function withServerResolutionEvidence(result: JsonRecord): JsonRecord {
  const settledAction = isRecord(result.settledAction) ? result.settledAction : undefined;
  const actionId = settledAction?.actionId;
  const journeyResolution = settledAction?.journeyResolution;
  if (typeof actionId !== "string"
    || !isRecord(journeyResolution)
    || journeyResolution.authority !== "server") {
    return result;
  }
  const events = epochEventsForPersistence(result);
  let enriched = false;
  const evidenceEvents = events.map((event) => {
    if (event.eventType !== "hosted_action_recorded"
      || event.payload.actionId !== actionId
      || event.payload.journeyResolution !== undefined) {
      return event;
    }
    enriched = true;
    return {
      ...event,
      payload: {
        ...event.payload,
        journeyResolution,
      },
    } as unknown as typeof event;
  });
  return enriched ? attachEpochEventsForPersistence(result, evidenceEvents) : result;
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function assertNoSecretKeys(value: unknown, path = "payload"): void {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertNoSecretKeys(entry, `${path}[${index}]`));
    return;
  }
  if (!isRecord(value)) return;
  for (const [key, entry] of Object.entries(value)) {
    if (SECRET_KEY_PATTERN.test(key)) throw new Error(`phase6_committed_result_secret_field_rejected:${path}.${key}`);
    assertNoSecretKeys(entry, `${path}.${key}`);
  }
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

function sha256(value: string): Phase6CommittedResultHash {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}
