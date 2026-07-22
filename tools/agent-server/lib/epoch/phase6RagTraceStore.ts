import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import {
  capturePhase6ServerRagTrace,
  validatePhase6ServerRagTrace,
  type CapturePhase6ServerRagTraceInput,
  type Phase6ServerRagTrace,
  type Phase6ServerRagTraceStatus,
} from "./phase6ServerRagTraceRules.ts";
import type { JourneyRunReceiptHash } from "./journeyRunReceiptRules.ts";

type Phase6RagTraceQueryKey = string;

export interface Phase6RagTraceRecord {
  readonly traceHash: JourneyRunReceiptHash;
  readonly payloadHash: JourneyRunReceiptHash;
  readonly experimentId: string;
  readonly runIndex: number;
  readonly runId: string;
  readonly journeyId: string;
  readonly queryHash?: JourneyRunReceiptHash;
  readonly status: Phase6ServerRagTraceStatus;
  readonly source: string;
  readonly trace: Phase6ServerRagTrace;
  readonly recordedAt: string;
  readonly createdAt: string;
}

export interface Phase6RagTraceBindingLookup {
  readonly experimentId: string;
  readonly runIndex: number;
  readonly journeyId: string;
  readonly queryHash?: JourneyRunReceiptHash;
}

export interface Phase6RagTraceListQuery {
  readonly experimentId?: string;
  readonly runIndex?: number;
  readonly journeyId?: string;
  readonly queryHash?: JourneyRunReceiptHash;
  readonly limit?: number;
}

export interface Phase6RagTraceSqliteStore {
  append(trace: Phase6ServerRagTrace): Phase6RagTraceRecord;
  capture(input: CapturePhase6ServerRagTraceInput): Phase6RagTraceRecord;
  load(traceHash: JourneyRunReceiptHash): Phase6RagTraceRecord | undefined;
  loadByBinding(binding: Phase6RagTraceBindingLookup): Phase6RagTraceRecord | undefined;
  list(query?: Phase6RagTraceListQuery): readonly Phase6RagTraceRecord[];
}

interface Phase6RagTraceRow {
  readonly trace_hash: string;
  readonly payload_hash: string;
  readonly experiment_id: string;
  readonly run_index: number;
  readonly run_id: string;
  readonly journey_id: string;
  readonly query_hash: string | null;
  readonly query_key: string;
  readonly status: string;
  readonly source: string;
  readonly trace_json: string;
  readonly recorded_at: string;
  readonly created_at: string;
}

export const PHASE6_RAG_TRACE_SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS phase6_rag_traces (
    trace_hash TEXT PRIMARY KEY,
    payload_hash TEXT NOT NULL,
    experiment_id TEXT NOT NULL,
    run_index INTEGER NOT NULL,
    run_id TEXT NOT NULL,
    journey_id TEXT NOT NULL,
    query_hash TEXT,
    query_key TEXT NOT NULL,
    status TEXT NOT NULL,
    source TEXT NOT NULL,
    trace_json TEXT NOT NULL,
    recorded_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE(experiment_id, run_index, journey_id, query_key)
  );
  CREATE INDEX IF NOT EXISTS idx_phase6_rag_traces_experiment_run
    ON phase6_rag_traces(experiment_id, run_index, recorded_at);
  CREATE INDEX IF NOT EXISTS idx_phase6_rag_traces_journey
    ON phase6_rag_traces(journey_id, recorded_at);
  CREATE INDEX IF NOT EXISTS idx_phase6_rag_traces_query_hash
    ON phase6_rag_traces(query_hash, recorded_at);
  CREATE TRIGGER IF NOT EXISTS phase6_rag_traces_no_update
  BEFORE UPDATE ON phase6_rag_traces BEGIN
    SELECT RAISE(ABORT, 'phase6_rag_traces_append_only');
  END;
  CREATE TRIGGER IF NOT EXISTS phase6_rag_traces_no_delete
  BEFORE DELETE ON phase6_rag_traces BEGIN
    SELECT RAISE(ABORT, 'phase6_rag_traces_append_only');
  END;
`;

function nowIso() {
  return new Date().toISOString();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function assertText(value: unknown, name: string): asserts value is string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`phase6_rag_trace_${name}_required`);
  }
}

function assertRunIndex(value: unknown): asserts value is number {
  if (!Number.isInteger(value) || (value as number) < 1) {
    throw new Error("phase6_rag_trace_run_index_invalid");
  }
}

function assertHash(value: string, name: string): asserts value is JourneyRunReceiptHash {
  if (!/^sha256:[a-f0-9]{64}$/.test(value)) throw new Error(`phase6_rag_trace_${name}_invalid`);
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

function sha256(value: string): JourneyRunReceiptHash {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function payloadHash(trace: Phase6ServerRagTrace): JourneyRunReceiptHash {
  return sha256(canonicalJson(trace));
}

function queryKey(queryHash: JourneyRunReceiptHash | undefined): Phase6RagTraceQueryKey {
  return queryHash ?? "__phase6_no_query_hash__";
}

function storageQueryKey(trace: Phase6ServerRagTrace): Phase6RagTraceQueryKey {
  return trace.version === "phase6_server_rag_trace.v2"
    ? `${queryKey(trace.queryHash)}:${trace.integrity.traceHash}`
    : queryKey(trace.queryHash);
}

function isTraceRow(value: unknown): value is Phase6RagTraceRow {
  if (!isRecord(value)) return false;
  return (
    typeof value.trace_hash === "string" &&
    typeof value.payload_hash === "string" &&
    typeof value.experiment_id === "string" &&
    typeof value.run_index === "number" &&
    typeof value.run_id === "string" &&
    typeof value.journey_id === "string" &&
    (typeof value.query_hash === "string" || value.query_hash === null) &&
    typeof value.query_key === "string" &&
    typeof value.status === "string" &&
    typeof value.source === "string" &&
    typeof value.trace_json === "string" &&
    typeof value.recorded_at === "string" &&
    typeof value.created_at === "string"
  );
}

function assertStorableTrace(trace: Phase6ServerRagTrace): void {
  const validation = validatePhase6ServerRagTrace(trace);
  if (!validation.ok) {
    throw new Error(`phase6_rag_trace_invalid:${validation.issues[0]?.code || "unknown"}`);
  }
  if (validation.status !== trace.status) throw new Error("phase6_rag_trace_status_mismatch");
  if (trace.status === "source_missing") throw new Error("phase6_rag_trace_source_missing_rejected");
  if (trace.status === "invalid") throw new Error("phase6_rag_trace_invalid_status_rejected");
}

function normalizeTrace(trace: Phase6ServerRagTrace) {
  assertStorableTrace(trace);
  assertHash(trace.integrity.traceHash, "trace_hash");
  if (trace.queryHash !== undefined) assertHash(trace.queryHash, "query_hash");
  assertText(trace.binding.experiment.experimentId, "experiment_id");
  assertRunIndex(trace.binding.experiment.runIndex);
  assertText(trace.binding.run.runId, "run_id");
  assertText(trace.binding.run.journeyId, "journey_id");
  assertText(trace.recordedAt, "recorded_at");
  assertText(trace.source, "source");

  return {
    traceHash: trace.integrity.traceHash,
    payloadHash: payloadHash(trace),
    experimentId: trace.binding.experiment.experimentId.trim(),
    runIndex: trace.binding.experiment.runIndex,
    runId: trace.binding.run.runId.trim(),
    journeyId: trace.binding.run.journeyId.trim(),
    queryHash: trace.queryHash,
    queryKey: storageQueryKey(trace),
    status: trace.status,
    source: trace.source,
    traceJson: canonicalJson(trace),
    recordedAt: trace.recordedAt.trim(),
  };
}

function parseStoredRow(row: Phase6RagTraceRow): Phase6RagTraceRecord {
  assertHash(row.trace_hash, "trace_hash");
  assertHash(row.payload_hash, "payload_hash");
  if (row.query_hash !== null) assertHash(row.query_hash, "query_hash");
  assertRunIndex(row.run_index);

  let trace: Phase6ServerRagTrace;
  try {
    trace = JSON.parse(row.trace_json) as Phase6ServerRagTrace;
  } catch {
    throw new Error(`phase6_rag_trace_json_invalid:${row.trace_hash}`);
  }

  const normalized = normalizeTrace(trace);
  if (normalized.traceHash !== row.trace_hash) throw new Error("phase6_rag_trace_row_hash_mismatch");
  if (normalized.payloadHash !== row.payload_hash) throw new Error("phase6_rag_trace_row_payload_hash_mismatch");
  if (normalized.experimentId !== row.experiment_id) throw new Error("phase6_rag_trace_row_experiment_mismatch");
  if (normalized.runIndex !== row.run_index) throw new Error("phase6_rag_trace_row_run_index_mismatch");
  if (normalized.runId !== row.run_id) throw new Error("phase6_rag_trace_row_run_id_mismatch");
  if (normalized.journeyId !== row.journey_id) throw new Error("phase6_rag_trace_row_journey_mismatch");
  if ((normalized.queryHash ?? null) !== row.query_hash) throw new Error("phase6_rag_trace_row_query_hash_mismatch");
  if (normalized.queryKey !== row.query_key) throw new Error("phase6_rag_trace_row_query_key_mismatch");

  return {
    traceHash: row.trace_hash,
    payloadHash: row.payload_hash,
    experimentId: row.experiment_id,
    runIndex: row.run_index,
    runId: row.run_id,
    journeyId: row.journey_id,
    ...(row.query_hash ? { queryHash: row.query_hash } : {}),
    status: trace.status,
    source: row.source,
    trace,
    recordedAt: row.recorded_at,
    createdAt: row.created_at,
  };
}

function assertSamePayload(existing: Phase6RagTraceRecord, normalized: ReturnType<typeof normalizeTrace>): void {
  if (existing.traceHash === normalized.traceHash && existing.payloadHash !== normalized.payloadHash) {
    throw new Error("phase6_rag_trace_payload_hash_conflict");
  }
  if (
    existing.experimentId === normalized.experimentId &&
    existing.runIndex === normalized.runIndex &&
    existing.journeyId === normalized.journeyId &&
    storageQueryKey(existing.trace) === normalized.queryKey &&
    existing.payloadHash !== normalized.payloadHash
  ) {
    throw new Error("phase6_rag_trace_binding_conflict");
  }
}

export function initializePhase6RagTraceSchema(db: DatabaseSync) {
  db.exec(PHASE6_RAG_TRACE_SCHEMA_SQL);
}

export function createPhase6RagTraceStore(db: DatabaseSync): Phase6RagTraceSqliteStore {
  initializePhase6RagTraceSchema(db);

  const loadStatement = db.prepare(`
    SELECT trace_hash, payload_hash, experiment_id, run_index, run_id, journey_id, query_hash, query_key,
      status, source, trace_json, recorded_at, created_at
    FROM phase6_rag_traces
    WHERE trace_hash = ?
  `);
  const loadBindingStatement = db.prepare(`
    SELECT trace_hash, payload_hash, experiment_id, run_index, run_id, journey_id, query_hash, query_key,
      status, source, trace_json, recorded_at, created_at
    FROM phase6_rag_traces
    WHERE experiment_id = ? AND run_index = ? AND journey_id = ?
      AND ((? IS NULL AND query_hash IS NULL) OR query_hash = ?)
    ORDER BY recorded_at DESC, trace_hash DESC
    LIMIT 1
  `);
  const loadBindingKeyStatement = db.prepare(`
    SELECT trace_hash, payload_hash, experiment_id, run_index, run_id, journey_id, query_hash, query_key,
      status, source, trace_json, recorded_at, created_at
    FROM phase6_rag_traces
    WHERE experiment_id = ? AND run_index = ? AND journey_id = ? AND query_key = ?
  `);
  const listBaseSql = `
    SELECT trace_hash, payload_hash, experiment_id, run_index, run_id, journey_id, query_hash, query_key,
      status, source, trace_json, recorded_at, created_at
    FROM phase6_rag_traces
  `;
  const insertStatement = db.prepare(`
    INSERT OR IGNORE INTO phase6_rag_traces (
      trace_hash,
      payload_hash,
      experiment_id,
      run_index,
      run_id,
      journey_id,
      query_hash,
      query_key,
      status,
      source,
      trace_json,
      recorded_at,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  function load(traceHash: JourneyRunReceiptHash) {
    assertHash(traceHash, "trace_hash");
    const row = loadStatement.get(traceHash);
    if (!row) return undefined;
    if (!isTraceRow(row)) throw new Error(`phase6_rag_trace_row_invalid:${traceHash}`);
    return parseStoredRow(row);
  }

  function loadByBinding(binding: Phase6RagTraceBindingLookup) {
    assertText(binding.experimentId, "experiment_id");
    assertRunIndex(binding.runIndex);
    assertText(binding.journeyId, "journey_id");
    if (binding.queryHash !== undefined) assertHash(binding.queryHash, "query_hash");
    const row = loadBindingStatement.get(
      binding.experimentId.trim(),
      binding.runIndex,
      binding.journeyId.trim(),
      binding.queryHash ?? null,
      binding.queryHash ?? null,
    );
    if (!row) return undefined;
    if (!isTraceRow(row)) throw new Error("phase6_rag_trace_binding_row_invalid");
    return parseStoredRow(row);
  }

  function list(query: Phase6RagTraceListQuery = {}) {
    const where: string[] = [];
    const params: (string | number)[] = [];
    if (query.experimentId !== undefined) {
      assertText(query.experimentId, "experiment_id");
      where.push("experiment_id = ?");
      params.push(query.experimentId.trim());
    }
    if (query.runIndex !== undefined) {
      assertRunIndex(query.runIndex);
      where.push("run_index = ?");
      params.push(query.runIndex);
    }
    if (query.journeyId !== undefined) {
      assertText(query.journeyId, "journey_id");
      where.push("journey_id = ?");
      params.push(query.journeyId.trim());
    }
    if (query.queryHash !== undefined) {
      assertHash(query.queryHash, "query_hash");
      where.push("query_hash = ?");
      params.push(query.queryHash);
    }

    const limit = query.limit ?? 100;
    if (!Number.isInteger(limit) || limit < 1 || limit > 1000) {
      throw new Error("phase6_rag_trace_list_limit_invalid");
    }

    const statement = db.prepare(`
      ${listBaseSql}
      ${where.length > 0 ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY recorded_at ASC, trace_hash ASC
      LIMIT ?
    `);
    const rows = statement.all(...params, limit);
    return rows.map((row) => {
      if (!isTraceRow(row)) throw new Error("phase6_rag_trace_list_row_invalid");
      return parseStoredRow(row);
    });
  }

  function append(trace: Phase6ServerRagTrace) {
    const normalized = normalizeTrace(trace);
    const existingByTraceHash = load(normalized.traceHash);
    if (existingByTraceHash) {
      assertSamePayload(existingByTraceHash, normalized);
      return existingByTraceHash;
    }

    const existingBindingRow = loadBindingKeyStatement.get(
      normalized.experimentId,
      normalized.runIndex,
      normalized.journeyId,
      normalized.queryKey,
    );
    const existingByBinding = existingBindingRow
      ? (() => {
        if (!isTraceRow(existingBindingRow)) throw new Error("phase6_rag_trace_binding_row_invalid");
        return parseStoredRow(existingBindingRow);
      })()
      : undefined;
    if (existingByBinding) {
      assertSamePayload(existingByBinding, normalized);
      return existingByBinding;
    }

    insertStatement.run(
      normalized.traceHash,
      normalized.payloadHash,
      normalized.experimentId,
      normalized.runIndex,
      normalized.runId,
      normalized.journeyId,
      normalized.queryHash ?? null,
      normalized.queryKey,
      normalized.status,
      normalized.source,
      normalized.traceJson,
      normalized.recordedAt,
      nowIso(),
    );

    const stored = load(normalized.traceHash);
    if (!stored) throw new Error("phase6_rag_trace_insert_failed");
    assertSamePayload(stored, normalized);
    return stored;
  }

  return {
    append,
    capture(input: CapturePhase6ServerRagTraceInput) {
      return append(capturePhase6ServerRagTrace(input));
    },
    load,
    loadByBinding,
    list,
  };
}
