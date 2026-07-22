import { DatabaseSync } from "node:sqlite";
import {
  journeyRunReceiptCanonicalJson,
  validateJourneyRunReceipt,
  type JourneyRunReceipt,
  type JourneyRunReceiptHash,
} from "./journeyRunReceiptRules.ts";
import {
  type JourneyRunReceiptRepositoryAdapter,
  type JourneySettledRunReceiptRecord,
} from "./journeySettlementRuntime.ts";

interface JourneyRunReceiptRow {
  readonly receipt_id: string;
  readonly journey_id: string;
  readonly payload_hash: JourneyRunReceiptHash;
  readonly receipt_json: string;
  readonly created_at: string;
}

function isJourneyRunReceiptRow(value: unknown): value is JourneyRunReceiptRow {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.receipt_id === "string" &&
    typeof row.journey_id === "string" &&
    typeof row.payload_hash === "string" &&
    typeof row.receipt_json === "string" &&
    typeof row.created_at === "string"
  );
}

function assertPayloadHash(value: string): asserts value is JourneyRunReceiptHash {
  if (!/^sha256:[a-f0-9]{64}$/.test(value)) throw new Error("journey_run_receipt_payload_hash_invalid");
}

function parseStoredReceipt(row: JourneyRunReceiptRow): JourneySettledRunReceiptRecord {
  assertPayloadHash(row.payload_hash);

  let receipt: JourneyRunReceipt;
  try {
    receipt = JSON.parse(row.receipt_json) as JourneyRunReceipt;
  } catch {
    throw new Error(`journey_run_receipt_json_invalid:${row.receipt_id}`);
  }

  const validation = validateJourneyRunReceipt(receipt);
  if (!validation.ok) {
    throw new Error(`journey_run_receipt_stored_invalid:${validation.issues[0]?.code || "unknown"}`);
  }
  if (receipt.receiptId !== row.receipt_id) throw new Error("journey_run_receipt_row_id_mismatch");
  if (receipt.journeyId !== row.journey_id) throw new Error("journey_run_receipt_row_journey_mismatch");

  return {
    receiptId: row.receipt_id,
    payloadHash: row.payload_hash,
    receipt,
    settledAt: row.created_at,
  };
}

export function initializeJourneyRunReceiptSchema(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS journey_run_receipts (
      receipt_id TEXT PRIMARY KEY,
      journey_id TEXT NOT NULL,
      payload_hash TEXT NOT NULL,
      receipt_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_journey_run_receipts_journey_created
      ON journey_run_receipts(journey_id, created_at);
    CREATE TRIGGER IF NOT EXISTS journey_run_receipts_no_update
    BEFORE UPDATE ON journey_run_receipts BEGIN
      SELECT RAISE(ABORT, 'journey_run_receipts_append_only');
    END;
    CREATE TRIGGER IF NOT EXISTS journey_run_receipts_no_delete
    BEFORE DELETE ON journey_run_receipts BEGIN
      SELECT RAISE(ABORT, 'journey_run_receipts_append_only');
    END;
  `);
}

export function createJourneyRunReceiptSqliteStore(db: DatabaseSync): JourneyRunReceiptRepositoryAdapter {
  initializeJourneyRunReceiptSchema(db);

  const loadStatement = db.prepare(`
    SELECT receipt_id, journey_id, payload_hash, receipt_json, created_at
    FROM journey_run_receipts
    WHERE receipt_id = ?
  `);
  const insertStatement = db.prepare(`
    INSERT OR IGNORE INTO journey_run_receipts (
      receipt_id,
      journey_id,
      payload_hash,
      receipt_json,
      created_at
    ) VALUES (?, ?, ?, ?, ?)
  `);

  function loadByReceiptId(receiptId: string) {
    const row = loadStatement.get(receiptId);
    if (!row) return undefined;
    if (!isJourneyRunReceiptRow(row)) throw new Error(`journey_run_receipt_row_invalid:${receiptId}`);
    return parseStoredReceipt(row);
  }

  return {
    loadByReceiptId,
    saveIfAbsent(record: JourneySettledRunReceiptRecord) {
      const validation = validateJourneyRunReceipt(record.receipt);
      if (!validation.ok) {
        throw new Error(`journey_run_receipt_record_invalid:${validation.issues[0]?.code || "unknown"}`);
      }
      if (record.receiptId !== record.receipt.receiptId) throw new Error("journey_run_receipt_record_id_mismatch");
      if (record.receipt.journeyId.trim().length === 0) throw new Error("journey_run_receipt_journey_id_required");
      assertPayloadHash(record.payloadHash);

      const result = insertStatement.run(
        record.receiptId,
        record.receipt.journeyId,
        record.payloadHash,
        journeyRunReceiptCanonicalJson(record.receipt),
        record.settledAt,
      );
      return result.changes === 0 ? loadByReceiptId(record.receiptId) : undefined;
    },
  };
}
