import { assertEpochEvent, type EpochEvent } from "./epoch/events.ts";

type JsonRecord = Record<string, unknown>;

export interface EpochEventBatchRecord {
  readonly type: "epoch_event_batch";
  readonly events: readonly EpochEvent[];
}

export type PersistEpochEventBatch = (events: readonly EpochEvent[]) => Promise<void>;
export type PersistJsonlRecord = (fileName: string, record: unknown) => Promise<void>;

export interface EpochMutationCoordinator {
  readonly run: <T>(operation: () => Promise<T> | T) => Promise<T>;
  readonly drain: () => Promise<void>;
}

export function createEpochMutationCoordinator(): EpochMutationCoordinator {
  let tail: Promise<void> = Promise.resolve();
  return {
    run<T>(operation: () => Promise<T> | T) {
      const result = tail.then(operation);
      tail = result.then(() => undefined, () => undefined);
      return result;
    },
    drain() {
      return tail;
    },
  };
}

export class EpochPersistenceError extends Error {
  readonly code = "epoch_persistence_unavailable";
  readonly persistenceError: string;

  constructor(cause: unknown) {
    super("epoch_persistence_unavailable", { cause });
    this.name = "EpochPersistenceError";
    this.persistenceError = cause instanceof Error ? cause.message : String(cause);
  }
}

export interface EpochPersistenceGuard {
  readonly failed: boolean;
  readonly error: EpochPersistenceError | null;
  readonly assertHealthy: () => void;
  readonly trip: (cause: unknown) => EpochPersistenceError;
}

export function isEpochPersistenceError(error: unknown): error is EpochPersistenceError {
  return error instanceof EpochPersistenceError;
}

export function createEpochPersistenceGuard(
  onTrip?: (error: EpochPersistenceError) => void,
): EpochPersistenceGuard {
  let failure: EpochPersistenceError | null = null;
  return {
    get failed() {
      return failure !== null;
    },
    get error() {
      return failure;
    },
    assertHealthy() {
      if (failure) throw failure;
    },
    trip(cause) {
      if (failure) return failure;
      failure = isEpochPersistenceError(cause) ? cause : new EpochPersistenceError(cause);
      onTrip?.(failure);
      return failure;
    },
  };
}

export function createLegacyEpochEventBatchWriter(
  persistJsonl: PersistJsonlRecord | null | undefined,
): PersistEpochEventBatch | null {
  if (!persistJsonl) return null;
  return async (events) => {
    for (const event of events) {
      await persistJsonl("epoch-events.jsonl", { type: "epoch_event", event });
    }
  };
}

export async function persistEpochEventBatchWithGuard(
  persistEpochEventBatch: PersistEpochEventBatch | null,
  guard: EpochPersistenceGuard,
  events: readonly EpochEvent[],
) {
  guard.assertHealthy();
  if (!persistEpochEventBatch || events.length === 0) return 0;
  try {
    await persistEpochEventBatch(events);
    return events.length;
  } catch (error) {
    throw guard.trip(error);
  }
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function createEpochEventBatchRecord(events: readonly EpochEvent[]): EpochEventBatchRecord {
  return {
    type: "epoch_event_batch",
    events: events.map((event) => assertEpochEvent(event)),
  };
}

export function serializeEpochEventBatch(events: readonly EpochEvent[]) {
  return `${JSON.stringify(createEpochEventBatchRecord(events))}\n`;
}

export function epochEventsFromPersistenceRecord(record: unknown): readonly EpochEvent[] {
  if (!isRecord(record)) return [assertEpochEvent(record)];
  if (record.type === "epoch_event_batch") {
    if (!Array.isArray(record.events)) throw new Error("epoch_event_batch_events_required");
    return record.events.map((event) => assertEpochEvent(event));
  }
  if (record.type === "epoch_event") return [assertEpochEvent(record.event)];
  return [assertEpochEvent(record)];
}
