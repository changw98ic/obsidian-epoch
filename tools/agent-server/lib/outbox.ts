import { createHash } from "node:crypto";

type AnyRecord = Record<string, unknown>;

export type LegacyOutboxStatus = "pending" | "retrying" | "dispatched" | "dead_letter";
export type LegacyGraphSyncStatus = "pending_sync" | "synced" | "retry_later";

export interface LegacyOutboxEntry {
  outboxId: string;
  kind: string;
  target: string;
  aggregateType: string;
  aggregateId: string;
  status: LegacyOutboxStatus;
  retryCount: number;
  maxRetries: number;
  deadLetter: boolean;
  payloadHash: string;
  payloadSummary: AnyRecord;
  createdAt: string;
  updatedAt: string;
  nextAttemptAt?: string;
  dispatchedAt?: string;
  deadLetteredAt?: string;
  replayedAt?: string;
  replayedByOperator?: boolean;
  manualReplayCount: number;
  lastError?: string;
}

export interface LegacyOutboxCreateInput {
  readonly kind: string;
  readonly target: string;
  readonly aggregateId: string;
  readonly aggregateType?: string;
  readonly payload: unknown;
  readonly payloadSummary?: AnyRecord;
}

export interface LegacyGraphSyncState {
  readonly status: LegacyGraphSyncStatus;
  readonly label: "待同步" | "已同步" | "稍后重试";
  readonly message: string;
  readonly outboxKind: "world_index";
  readonly outboxId?: string;
  readonly outboxStatus?: LegacyOutboxStatus;
  readonly target?: string;
  readonly retryCount?: number;
  readonly deadLetter?: boolean;
  readonly nextAttemptAt?: string;
  readonly updatedAt?: string;
}

export interface LegacyOutboxView {
  readonly summary: {
    readonly total: number;
    readonly pending: number;
    readonly retrying: number;
    readonly dispatched: number;
    readonly deadLetters: number;
  };
  readonly graphSync: LegacyGraphSyncState;
  readonly entries: LegacyOutboxEntry[];
  readonly deadLetters: LegacyOutboxEntry[];
  readonly manualReplay: {
    readonly tool: "agent_world.replay_outbox";
    readonly http: "POST /api/outbox/replay";
    readonly requires: readonly ["outboxId", "operatorKey"];
  };
}

export interface LegacyOutboxReplayResult {
  readonly entry: LegacyOutboxEntry;
  readonly summary: LegacyOutboxView["summary"];
  readonly graphSync: LegacyGraphSyncState;
}

interface LegacyOutboxOptions {
  readonly initialEvents?: readonly object[];
  readonly now?: () => Date;
  readonly idFactory?: () => string;
  readonly maxRetries?: number;
  readonly retryDelayMs?: number;
  readonly operatorKey?: string;
  readonly dispatchFailures?: AnyRecord;
}

function isRecord(value: unknown): value is AnyRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function recordValue(value: unknown): AnyRecord {
  return isRecord(value) ? value : {};
}

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" && value ? value : fallback;
}

function numberValue(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function positiveIntegerValue(value: unknown, fallback: number) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
}

function outboxStatus(value: unknown): LegacyOutboxStatus {
  return value === "pending" || value === "retrying" || value === "dispatched" || value === "dead_letter"
    ? value
    : "pending";
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (isRecord(value)) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function hashPayload(value: unknown) {
  return `sha256:${createHash("sha256").update(stableJson(value)).digest("hex")}`;
}

function failureMap(value: unknown) {
  const failures = new Map<string, number>();
  for (const [key, count] of Object.entries(recordValue(value))) {
    const remaining = positiveIntegerValue(count, 0);
    if (remaining > 0) failures.set(key, remaining);
  }
  return failures;
}

function cloneEntry(entry: LegacyOutboxEntry): LegacyOutboxEntry {
  return {
    ...entry,
    payloadSummary: { ...entry.payloadSummary },
  };
}

export function graphSyncFromOutboxEntries(
  entries: readonly LegacyOutboxEntry[],
  options: { readonly initialSettlement?: boolean } = {},
): LegacyGraphSyncState {
  const entry = entries.find((candidate) => candidate.kind === "world_index");
  if (!entry) {
    return {
      status: "pending_sync",
      label: "待同步",
      message: "图谱索引等待结算 outbox 事件。",
      outboxKind: "world_index",
    };
  }
  const base = {
    outboxKind: "world_index" as const,
    outboxId: entry.outboxId,
    outboxStatus: entry.status,
    target: entry.target,
    retryCount: entry.retryCount,
    deadLetter: entry.deadLetter,
    nextAttemptAt: entry.nextAttemptAt,
    updatedAt: entry.updatedAt,
  };
  if (entry.status === "retrying" || entry.status === "dead_letter") {
    return {
      ...base,
      status: "retry_later",
      label: "稍后重试",
      message: "图谱索引暂未确认，稍后重试或由操作员重放 world_index outbox 事件。",
    };
  }
  if (entry.status === "dispatched" && !options.initialSettlement) {
    return {
      ...base,
      status: "synced",
      label: "已同步",
      message: "图谱索引已确认本次结算。",
    };
  }
  return {
    ...base,
    status: "pending_sync",
    label: "待同步",
    message: "图谱索引正在确认本次结算，稍后刷新同步状态。",
  };
}

function entryFromRecord(record: AnyRecord, fallbackNow: string, fallbackMaxRetries: number): LegacyOutboxEntry | undefined {
  const source = record.type === "outbox_event" ? record : recordValue(record.entry);
  const outboxId = stringValue(source.outboxId);
  const kind = stringValue(source.kind);
  const target = stringValue(source.target);
  const aggregateId = stringValue(source.aggregateId);
  if (!outboxId || !kind || !target || !aggregateId) return undefined;
  const retryCount = Math.max(0, Math.floor(numberValue(source.retryCount, 0)));
  const status = outboxStatus(source.status);
  return {
    outboxId,
    kind,
    target,
    aggregateType: stringValue(source.aggregateType, "legacy_run"),
    aggregateId,
    status,
    retryCount,
    maxRetries: positiveIntegerValue(source.maxRetries, fallbackMaxRetries),
    deadLetter: source.deadLetter === true || status === "dead_letter",
    payloadHash: stringValue(source.payloadHash, hashPayload(recordValue(source.payloadSummary))),
    payloadSummary: recordValue(source.payloadSummary),
    createdAt: stringValue(source.createdAt, fallbackNow),
    updatedAt: stringValue(source.updatedAt, fallbackNow),
    nextAttemptAt: stringValue(source.nextAttemptAt) || undefined,
    dispatchedAt: stringValue(source.dispatchedAt) || undefined,
    deadLetteredAt: stringValue(source.deadLetteredAt) || undefined,
    replayedAt: stringValue(source.replayedAt) || undefined,
    replayedByOperator: source.replayedByOperator === true || undefined,
    manualReplayCount: Math.max(0, Math.floor(numberValue(source.manualReplayCount, 0))),
    lastError: stringValue(source.lastError) || undefined,
  };
}

export function createLegacyOutboxLedger(options: LegacyOutboxOptions = {}) {
  const now = typeof options.now === "function" ? options.now : () => new Date();
  const maxRetries = positiveIntegerValue(options.maxRetries, 3);
  const retryDelayMs = positiveIntegerValue(options.retryDelayMs, 60_000);
  const configuredOperatorKey = typeof options.operatorKey === "string" && options.operatorKey.trim()
    ? options.operatorKey.trim()
    : undefined;
  const remainingFailures = failureMap(options.dispatchFailures);
  let nextId = 0;
  const idFactory = typeof options.idFactory === "function"
    ? options.idFactory
    : () => `outbox_${String(++nextId).padStart(6, "0")}`;
  const entries: LegacyOutboxEntry[] = [];

  for (const record of Array.isArray(options.initialEvents) ? options.initialEvents : []) {
    const entry = entryFromRecord(recordValue(record), now().toISOString(), maxRetries);
    if (!entry) continue;
    const existingIndex = entries.findIndex((candidate) => candidate.outboxId === entry.outboxId);
    if (existingIndex >= 0) {
      entries[existingIndex] = entry;
    } else {
      entries.push(entry);
    }
  }

  function summary(): LegacyOutboxView["summary"] {
    return {
      total: entries.length,
      pending: entries.filter((entry) => entry.status === "pending").length,
      retrying: entries.filter((entry) => entry.status === "retrying").length,
      dispatched: entries.filter((entry) => entry.status === "dispatched").length,
      deadLetters: entries.filter((entry) => entry.status === "dead_letter").length,
    };
  }

  function dispatchShouldFail(entry: LegacyOutboxEntry) {
    for (const key of [entry.outboxId, entry.kind, entry.target]) {
      const remaining = remainingFailures.get(key) || 0;
      if (remaining > 0) {
        remainingFailures.set(key, remaining - 1);
        return true;
      }
    }
    return false;
  }

  function dispatch(entry: LegacyOutboxEntry) {
    const checkedAt = now();
    entry.updatedAt = checkedAt.toISOString();
    if (dispatchShouldFail(entry)) {
      entry.retryCount += 1;
      entry.lastError = `outbox_dispatch_failed:${entry.kind}`;
      if (entry.retryCount >= entry.maxRetries) {
        entry.status = "dead_letter";
        entry.deadLetter = true;
        entry.deadLetteredAt = checkedAt.toISOString();
        entry.nextAttemptAt = undefined;
        return cloneEntry(entry);
      }
      entry.status = "retrying";
      entry.deadLetter = false;
      entry.nextAttemptAt = new Date(checkedAt.getTime() + retryDelayMs).toISOString();
      return cloneEntry(entry);
    }
    entry.status = "dispatched";
    entry.deadLetter = false;
    entry.dispatchedAt = checkedAt.toISOString();
    entry.updatedAt = checkedAt.toISOString();
    entry.nextAttemptAt = undefined;
    entry.deadLetteredAt = undefined;
    entry.lastError = undefined;
    return cloneEntry(entry);
  }

  function enqueue(input: LegacyOutboxCreateInput) {
    const createdAt = now().toISOString();
    const entry: LegacyOutboxEntry = {
      outboxId: idFactory(),
      kind: input.kind,
      target: input.target,
      aggregateType: input.aggregateType || "legacy_run",
      aggregateId: input.aggregateId,
      status: "pending",
      retryCount: 0,
      maxRetries,
      deadLetter: false,
      payloadHash: hashPayload(input.payload),
      payloadSummary: { ...recordValue(input.payloadSummary) },
      createdAt,
      updatedAt: createdAt,
      manualReplayCount: 0,
    };
    entries.push(entry);
    return dispatch(entry);
  }

  function enqueueBatch(inputs: readonly LegacyOutboxCreateInput[]) {
    return inputs.map(enqueue);
  }

  function view(input: AnyRecord = {}): LegacyOutboxView {
    const status = stringValue(input.status);
    const limit = positiveIntegerValue(input.limit, 100);
    const selectedEntries = entries
      .filter((entry) => !status || entry.status === status)
      .slice(-limit)
      .reverse()
      .map(cloneEntry);
    return {
      summary: summary(),
      graphSync: graphSyncFromOutboxEntries(entries),
      entries: selectedEntries,
      deadLetters: entries
        .filter((entry) => entry.status === "dead_letter")
        .slice(-limit)
        .reverse()
        .map(cloneEntry),
      manualReplay: {
        tool: "agent_world.replay_outbox",
        http: "POST /api/outbox/replay",
        requires: ["outboxId", "operatorKey"],
      },
    };
  }

  function replay(input: AnyRecord = {}): LegacyOutboxReplayResult {
    const outboxId = stringValue(input.outboxId);
    if (!outboxId) throw new Error("outbox_id_required");
    const operatorKey = stringValue(input.operatorKey).trim();
    if (!operatorKey || (configuredOperatorKey && operatorKey !== configuredOperatorKey)) {
      throw new Error("operator_key_required");
    }
    const entry = entries.find((candidate) => candidate.outboxId === outboxId);
    if (!entry) throw new Error("outbox_event_not_found");
    const replayedAt = now().toISOString();
    entry.manualReplayCount += 1;
    entry.replayedAt = replayedAt;
    entry.updatedAt = replayedAt;
    entry.replayedByOperator = true;
    entry.deadLetter = false;
    if (entry.status === "dispatched") {
      return { entry: cloneEntry(entry), summary: summary(), graphSync: graphSyncFromOutboxEntries(entries) };
    }
    const dispatched = dispatch(entry);
    return { entry: dispatched, summary: summary(), graphSync: graphSyncFromOutboxEntries(entries) };
  }

  return {
    enqueueBatch,
    view,
    replay,
  };
}
