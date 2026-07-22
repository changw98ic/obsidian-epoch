import {
  buildJourneyRunReceipt,
  journeyRunReceiptPayloadHash,
  validateJourneyRunReceipt,
  type BuildJourneyRunReceiptInput,
  type JourneyRunReceipt,
  type JourneyRunReceiptHash,
} from "./journeyRunReceiptRules.ts";

type Awaitable<T> = T | Promise<T>;

export interface JourneySettledRunReceiptRecord {
  readonly receiptId: string;
  readonly payloadHash: JourneyRunReceiptHash;
  readonly receipt: JourneyRunReceipt;
  readonly settledAt: string;
}

export interface JourneyRunReceiptRepositoryAdapter {
  readonly loadByReceiptId: (receiptId: string) => Awaitable<JourneySettledRunReceiptRecord | undefined>;
  readonly saveIfAbsent: (
    record: JourneySettledRunReceiptRecord,
  ) => Awaitable<JourneySettledRunReceiptRecord | undefined>;
}

export interface JourneySettlementRuntimeOptions {
  readonly repository: JourneyRunReceiptRepositoryAdapter;
  readonly now?: () => string;
}

export type SettleJourneyRunReceiptPayload = Omit<BuildJourneyRunReceiptInput, "receiptId" | "generatedAt">;

export interface SettleJourneyRunReceiptInput {
  readonly receiptId: string;
  readonly payload: SettleJourneyRunReceiptPayload;
}

export interface SettleJourneyRunReceiptResult {
  readonly receipt: JourneyRunReceipt;
  readonly payloadHash: JourneyRunReceiptHash;
  readonly duplicate: boolean;
}

export class JourneySettlementConflictError extends Error {
  readonly code = "journey_run_receipt_payload_conflict";
  readonly receiptId: string;

  constructor(receiptId: string) {
    super(`journey_run_receipt_payload_conflict:${receiptId}`);
    this.name = "JourneySettlementConflictError";
    this.receiptId = receiptId;
  }
}

function requireReceiptId(value: unknown) {
  if (typeof value !== "string" || !value.trim()) throw new Error("journey_run_receipt_id_required");
  return value.trim();
}

function assertStoredRecord(record: JourneySettledRunReceiptRecord) {
  if (record.receiptId !== record.receipt.receiptId) throw new Error("journey_run_receipt_record_id_mismatch");
  if (!/^sha256:[a-f0-9]{64}$/.test(record.payloadHash)) throw new Error("journey_run_receipt_record_payload_hash_invalid");
  const validation = validateJourneyRunReceipt(record.receipt);
  if (!validation.ok) throw new Error(`journey_run_receipt_record_invalid:${validation.issues[0]?.code || "unknown"}`);
}

function rejectConflict(receiptId: string): never {
  throw new JourneySettlementConflictError(receiptId);
}

function replayOrConflict(
  receiptId: string,
  existing: JourneySettledRunReceiptRecord,
  payloadHash: JourneyRunReceiptHash,
): SettleJourneyRunReceiptResult {
  assertStoredRecord(existing);
  if (existing.payloadHash !== payloadHash) rejectConflict(receiptId);
  return {
    receipt: existing.receipt,
    payloadHash,
    duplicate: true,
  };
}

export function createJourneySettlementRuntime(options: JourneySettlementRuntimeOptions) {
  const now = options.now ?? (() => new Date().toISOString());

  async function load(receiptIdInput: string): Promise<JourneyRunReceipt | undefined> {
    const receiptId = requireReceiptId(receiptIdInput);
    const record = await options.repository.loadByReceiptId(receiptId);
    if (!record) return undefined;
    assertStoredRecord(record);
    return record.receipt;
  }

  async function settle(input: SettleJourneyRunReceiptInput): Promise<SettleJourneyRunReceiptResult> {
    const receiptId = requireReceiptId(input.receiptId);
    const payloadHash = journeyRunReceiptPayloadHash(input.payload);
    const existing = await options.repository.loadByReceiptId(receiptId);
    if (existing) return replayOrConflict(receiptId, existing, payloadHash);

    const receipt = buildJourneyRunReceipt({
      ...input.payload,
      receiptId,
      generatedAt: now(),
    });
    const validation = validateJourneyRunReceipt(receipt);
    if (!validation.ok) throw new Error(`journey_run_receipt_invalid:${validation.issues[0]?.code || "unknown"}`);

    const record: JourneySettledRunReceiptRecord = {
      receiptId,
      payloadHash,
      receipt,
      settledAt: receipt.generatedAt,
    };
    const raced = await options.repository.saveIfAbsent(record);
    if (raced) return replayOrConflict(receiptId, raced, payloadHash);
    return {
      receipt,
      payloadHash,
      duplicate: false,
    };
  }

  return {
    settle,
    load,
  };
}
