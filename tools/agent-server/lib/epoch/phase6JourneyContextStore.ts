import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import type {
  Phase6CanonicalCursor,
  Phase6ProjectionForDelta,
} from "./phase6ProjectionDeltaRules.ts";
import type {
  Phase6IdentityBinding,
  Phase6RunIndex,
  Phase6ScenarioMatrixVersion,
  Phase6SeedBinding,
  Phase6VersionBinding,
} from "./phase6ExperimentRules.ts";
import { initializeJourneyRunReceiptSchema } from "./journeyRunReceiptStore.ts";

type JsonRecord = Record<string, unknown>;
type Phase6ContextHash = `sha256:${string}`;

export interface Phase6JourneyContextMetadata {
  readonly journeyId: string;
  readonly experimentId: string;
  readonly runId: string;
  readonly runIndex: Phase6RunIndex;
  readonly identity: Phase6IdentityBinding;
  readonly versions: Phase6VersionBinding;
  readonly seed: Phase6SeedBinding;
  readonly scenarioMatrix?: Phase6ScenarioMatrixVersion;
}

export interface Phase6JourneyContextCaptureInput {
  readonly metadata: Phase6JourneyContextMetadata;
  readonly beforeSnapshot: Phase6ProjectionForDelta;
  readonly canonicalCursor: Phase6CanonicalCursor;
  readonly createdAt?: string;
}

export interface Phase6JourneyContextRecord extends Phase6JourneyContextCaptureInput {
  readonly beforeSnapshotHash: Phase6ContextHash;
  readonly createdAt: string;
  readonly settledReceiptId?: string;
}

export interface Phase6JourneyContextSqliteStore {
  capture(input: Phase6JourneyContextCaptureInput): Phase6JourneyContextRecord;
  load(journeyId: string): Phase6JourneyContextRecord | undefined;
  markSettled(journeyId: string, receiptId: string): Phase6JourneyContextRecord;
}

interface Phase6JourneyContextRow {
  readonly journey_id: string;
  readonly experiment_id: string;
  readonly run_id: string;
  readonly run_index: number;
  readonly identity_json: string;
  readonly version_json: string;
  readonly seed_json: string;
  readonly scenario_matrix_json: string | null;
  readonly before_snapshot_json: string;
  readonly before_snapshot_hash: string;
  readonly canonical_cursor_json: string;
  readonly created_at: string;
  readonly settled_receipt_id: string | null;
}

const SECRET_KEY_PATTERN = /(?:api[_-]?key|secret|token|password|credential|private[_-]?key|signature)/i;

function nowIso() {
  return new Date().toISOString();
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function assertRecord(value: unknown, name: string): asserts value is JsonRecord {
  if (!isRecord(value)) throw new Error(`phase6_journey_context_${name}_record_required`);
}

function assertText(value: unknown, name: string): asserts value is string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`phase6_journey_context_${name}_required`);
  }
}

function assertRunIndex(value: unknown): asserts value is Phase6RunIndex {
  if (!Number.isInteger(value) || (value as number) < 1 || (value as number) > 10) {
    throw new Error("phase6_journey_context_run_index_invalid");
  }
}

function assertHash(value: string): asserts value is Phase6ContextHash {
  if (!/^sha256:[a-f0-9]{64}$/.test(value)) throw new Error("phase6_journey_context_hash_invalid");
}

function assertNoSecretKeys(value: unknown, path = "payload"): void {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertNoSecretKeys(entry, `${path}[${index}]`));
    return;
  }
  if (!isRecord(value)) return;
  for (const [key, entry] of Object.entries(value)) {
    if (SECRET_KEY_PATTERN.test(key)) throw new Error(`phase6_journey_context_secret_field_rejected:${path}.${key}`);
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

function sha256(value: string): Phase6ContextHash {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function parseJsonRecord(json: string, field: string): JsonRecord {
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    throw new Error(`phase6_journey_context_${field}_json_invalid`);
  }
  assertRecord(value, field);
  assertNoSecretKeys(value, field);
  return value;
}

function parseOptionalJsonRecord(json: string | null, field: string): JsonRecord | undefined {
  if (json === null) return undefined;
  return parseJsonRecord(json, field);
}

function assertCanonicalCursor(value: unknown): asserts value is Phase6CanonicalCursor {
  assertRecord(value, "canonical_cursor");
  if (value.kind !== "phase6_canonical_cursor") throw new Error("phase6_journey_context_cursor_kind_invalid");
  if (!Number.isSafeInteger(value.eventCount) || (value.eventCount as number) < 0) {
    throw new Error("phase6_journey_context_cursor_event_count_invalid");
  }
  assertText(value.eventIdsHash, "cursor_event_ids_hash");
  if (!/^fnv1a32:[0-9a-f]+$/.test(value.eventIdsHash)) {
    throw new Error("phase6_journey_context_cursor_event_ids_hash_invalid");
  }
  assertText(value.value, "cursor_value");
}

function normalizeMetadata(input: Phase6JourneyContextMetadata): Phase6JourneyContextMetadata {
  assertText(input.journeyId, "journey_id");
  assertText(input.experimentId, "experiment_id");
  assertText(input.runId, "run_id");
  assertRunIndex(input.runIndex);
  assertRecord(input.identity, "identity");
  assertText(input.identity.identityId, "identity_id");
  if (input.identity.cohortId !== undefined) assertText(input.identity.cohortId, "identity_cohort_id");
  assertRecord(input.versions, "versions");
  assertText(input.versions.rulesVersion, "rules_version");
  assertText(input.versions.catalogVersion, "catalog_version");
  assertText(input.versions.codeVersion, "code_version");
  assertRecord(input.seed, "seed");
  assertText(input.seed.seed, "seed");
  if (input.scenarioMatrix !== undefined) {
    assertRecord(input.scenarioMatrix, "scenario_matrix");
    assertText(input.scenarioMatrix.id, "scenario_matrix_id");
    assertText(input.scenarioMatrix.version, "scenario_matrix_version");
  }
  assertNoSecretKeys({
    identity: input.identity,
    versions: input.versions,
    scenarioMatrix: input.scenarioMatrix,
  }, "metadata");

  return {
    journeyId: input.journeyId.trim(),
    experimentId: input.experimentId.trim(),
    runId: input.runId.trim(),
    runIndex: input.runIndex,
    identity: {
      identityId: input.identity.identityId.trim(),
      ...(input.identity.cohortId ? { cohortId: input.identity.cohortId.trim() } : {}),
    },
    versions: {
      rulesVersion: input.versions.rulesVersion.trim(),
      catalogVersion: input.versions.catalogVersion.trim(),
      codeVersion: input.versions.codeVersion.trim(),
    },
    seed: {
      seed: input.seed.seed.trim(),
    },
    ...(input.scenarioMatrix ? {
      scenarioMatrix: {
        id: input.scenarioMatrix.id.trim(),
        version: input.scenarioMatrix.version.trim(),
      },
    } : {}),
  };
}

function normalizeCapture(input: Phase6JourneyContextCaptureInput): Phase6JourneyContextRecord {
  const metadata = normalizeMetadata(input.metadata);
  assertRecord(input.beforeSnapshot, "before_snapshot");
  assertNoSecretKeys(input.beforeSnapshot, "beforeSnapshot");
  assertRecord(input.canonicalCursor, "canonical_cursor");
  assertCanonicalCursor(input.canonicalCursor);
  assertNoSecretKeys(input.canonicalCursor, "canonicalCursor");
  if (input.createdAt !== undefined) assertText(input.createdAt, "created_at");

  const beforeSnapshotJson = canonicalJson(input.beforeSnapshot);
  return {
    metadata,
    beforeSnapshot: input.beforeSnapshot,
    beforeSnapshotHash: sha256(beforeSnapshotJson),
    canonicalCursor: input.canonicalCursor,
    createdAt: input.createdAt?.trim() || nowIso(),
  };
}

function isContextRow(value: unknown): value is Phase6JourneyContextRow {
  if (!isRecord(value)) return false;
  return (
    typeof value.journey_id === "string" &&
    typeof value.experiment_id === "string" &&
    typeof value.run_id === "string" &&
    typeof value.run_index === "number" &&
    typeof value.identity_json === "string" &&
    typeof value.version_json === "string" &&
    typeof value.seed_json === "string" &&
    (typeof value.scenario_matrix_json === "string" || value.scenario_matrix_json === null) &&
    typeof value.before_snapshot_json === "string" &&
    typeof value.before_snapshot_hash === "string" &&
    typeof value.canonical_cursor_json === "string" &&
    typeof value.created_at === "string" &&
    (typeof value.settled_receipt_id === "string" || value.settled_receipt_id === null)
  );
}

function parseStoredRow(row: Phase6JourneyContextRow): Phase6JourneyContextRecord {
  assertRunIndex(row.run_index);
  assertHash(row.before_snapshot_hash);
  const identity = parseJsonRecord(row.identity_json, "identity") as unknown as Phase6IdentityBinding;
  const versions = parseJsonRecord(row.version_json, "versions") as unknown as Phase6VersionBinding;
  const seed = parseJsonRecord(row.seed_json, "seed") as unknown as Phase6SeedBinding;
  const scenarioMatrix = parseOptionalJsonRecord(row.scenario_matrix_json, "scenario_matrix") as
    | Phase6ScenarioMatrixVersion
    | undefined;
  const beforeSnapshot = parseJsonRecord(row.before_snapshot_json, "before_snapshot") as Phase6ProjectionForDelta;
  const canonicalCursor = parseJsonRecord(row.canonical_cursor_json, "canonical_cursor");
  assertCanonicalCursor(canonicalCursor);
  if (sha256(canonicalJson(beforeSnapshot)) !== row.before_snapshot_hash) {
    throw new Error(`phase6_journey_context_hash_mismatch:${row.journey_id}`);
  }

  return {
    metadata: normalizeMetadata({
      journeyId: row.journey_id,
      experimentId: row.experiment_id,
      runId: row.run_id,
      runIndex: row.run_index,
      identity,
      versions,
      seed,
      scenarioMatrix,
    }),
    beforeSnapshot,
    beforeSnapshotHash: row.before_snapshot_hash,
    canonicalCursor,
    createdAt: row.created_at,
    ...(row.settled_receipt_id ? { settledReceiptId: row.settled_receipt_id } : {}),
  };
}

function assertSamePayload(existing: Phase6JourneyContextRecord, incoming: Phase6JourneyContextRecord): void {
  const fields: readonly [string, unknown, unknown][] = [
    ["metadata", existing.metadata, incoming.metadata],
    ["beforeSnapshotHash", existing.beforeSnapshotHash, incoming.beforeSnapshotHash],
    ["beforeSnapshot", existing.beforeSnapshot, incoming.beforeSnapshot],
    ["canonicalCursor", existing.canonicalCursor, incoming.canonicalCursor],
  ];
  for (const [field, left, right] of fields) {
    if (canonicalJson(left) !== canonicalJson(right)) {
      throw new Error(`phase6_journey_context_payload_conflict:${incoming.metadata.journeyId}:${field}`);
    }
  }
}

export function initializePhase6JourneyContextSchema(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS phase6_journey_contexts (
      journey_id TEXT PRIMARY KEY,
      experiment_id TEXT NOT NULL,
      run_id TEXT NOT NULL,
      run_index INTEGER NOT NULL CHECK(run_index BETWEEN 1 AND 10),
      identity_json TEXT NOT NULL,
      version_json TEXT NOT NULL,
      seed_json TEXT NOT NULL,
      scenario_matrix_json TEXT,
      before_snapshot_json TEXT NOT NULL,
      before_snapshot_hash TEXT NOT NULL,
      canonical_cursor_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      settled_receipt_id TEXT REFERENCES journey_run_receipts(receipt_id)
    );
    CREATE INDEX IF NOT EXISTS idx_phase6_journey_contexts_experiment_run
      ON phase6_journey_contexts(experiment_id, run_id);
    CREATE TRIGGER IF NOT EXISTS phase6_journey_contexts_no_payload_update
    BEFORE UPDATE ON phase6_journey_contexts
    WHEN
      OLD.journey_id <> NEW.journey_id OR
      OLD.experiment_id <> NEW.experiment_id OR
      OLD.run_id <> NEW.run_id OR
      OLD.run_index <> NEW.run_index OR
      OLD.identity_json <> NEW.identity_json OR
      OLD.version_json <> NEW.version_json OR
      OLD.seed_json <> NEW.seed_json OR
      COALESCE(OLD.scenario_matrix_json, '') <> COALESCE(NEW.scenario_matrix_json, '') OR
      OLD.before_snapshot_json <> NEW.before_snapshot_json OR
      OLD.before_snapshot_hash <> NEW.before_snapshot_hash OR
      OLD.canonical_cursor_json <> NEW.canonical_cursor_json OR
      OLD.created_at <> NEW.created_at
    BEGIN
      SELECT RAISE(ABORT, 'phase6_journey_contexts_payload_immutable');
    END;
    CREATE TRIGGER IF NOT EXISTS phase6_journey_contexts_settle_once
    BEFORE UPDATE OF settled_receipt_id ON phase6_journey_contexts
    WHEN
      OLD.settled_receipt_id IS NOT NULL OR
      NEW.settled_receipt_id IS NULL
    BEGIN
      SELECT RAISE(ABORT, 'phase6_journey_contexts_settle_once');
    END;
    CREATE TRIGGER IF NOT EXISTS phase6_journey_contexts_no_delete
    BEFORE DELETE ON phase6_journey_contexts BEGIN
      SELECT RAISE(ABORT, 'phase6_journey_contexts_append_only');
    END;
  `);
}

export function createPhase6JourneyContextSqliteStore(db: DatabaseSync): Phase6JourneyContextSqliteStore {
  initializeJourneyRunReceiptSchema(db);
  initializePhase6JourneyContextSchema(db);

  const selectStatement = db.prepare(`
    SELECT
      journey_id,
      experiment_id,
      run_id,
      run_index,
      identity_json,
      version_json,
      seed_json,
      scenario_matrix_json,
      before_snapshot_json,
      before_snapshot_hash,
      canonical_cursor_json,
      created_at,
      settled_receipt_id
    FROM phase6_journey_contexts
    WHERE journey_id = ?
  `);
  const insertStatement = db.prepare(`
    INSERT OR IGNORE INTO phase6_journey_contexts (
      journey_id,
      experiment_id,
      run_id,
      run_index,
      identity_json,
      version_json,
      seed_json,
      scenario_matrix_json,
      before_snapshot_json,
      before_snapshot_hash,
      canonical_cursor_json,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const settleStatement = db.prepare(`
    UPDATE phase6_journey_contexts
    SET settled_receipt_id = ?
    WHERE
      journey_id = ? AND
      settled_receipt_id IS NULL AND
      EXISTS (
        SELECT 1
        FROM journey_run_receipts
        WHERE receipt_id = ? AND journey_id = phase6_journey_contexts.journey_id
      )
  `);

  function load(journeyId: string): Phase6JourneyContextRecord | undefined {
    assertText(journeyId, "journey_id");
    const row = selectStatement.get(journeyId.trim());
    if (!row) return undefined;
    if (!isContextRow(row)) throw new Error(`phase6_journey_context_row_invalid:${journeyId}`);
    return parseStoredRow(row);
  }

  return {
    capture(input: Phase6JourneyContextCaptureInput) {
      const record = normalizeCapture(input);
      insertStatement.run(
        record.metadata.journeyId,
        record.metadata.experimentId,
        record.metadata.runId,
        record.metadata.runIndex,
        canonicalJson(record.metadata.identity),
        canonicalJson(record.metadata.versions),
        canonicalJson(record.metadata.seed),
        record.metadata.scenarioMatrix ? canonicalJson(record.metadata.scenarioMatrix) : null,
        canonicalJson(record.beforeSnapshot),
        record.beforeSnapshotHash,
        canonicalJson(record.canonicalCursor),
        record.createdAt,
      );
      const stored = load(record.metadata.journeyId);
      if (!stored) throw new Error(`phase6_journey_context_capture_missing:${record.metadata.journeyId}`);
      assertSamePayload(stored, record);
      return stored;
    },
    load,
    markSettled(journeyId: string, receiptId: string) {
      assertText(journeyId, "journey_id");
      assertText(receiptId, "receipt_id");
      let transactionStarted = false;
      try {
        db.exec("BEGIN IMMEDIATE");
        transactionStarted = true;
        const before = load(journeyId);
        if (!before) throw new Error(`phase6_journey_context_missing:${journeyId.trim()}`);
        if (before.settledReceiptId) {
          throw new Error(`phase6_journey_context_already_settled:${journeyId.trim()}`);
        }
        settleStatement.run(receiptId.trim(), journeyId.trim(), receiptId.trim());
        const after = load(journeyId);
        if (!after?.settledReceiptId) throw new Error(`phase6_journey_context_settle_failed:${journeyId.trim()}`);
        db.exec("COMMIT");
        transactionStarted = false;
        return after;
      } catch (error) {
        if (transactionStarted) db.exec("ROLLBACK");
        throw error;
      }
    },
  };
}
