import { DatabaseSync } from "node:sqlite";
import { createJourneyRunReceiptSqliteStore } from "../lib/epoch/journeyRunReceiptStore.ts";
import { createPhase6CommittedResultSqliteStore } from "../lib/epoch/phase6CommittedResultStore.ts";
import { createPhase6JourneyContextSqliteStore } from "../lib/epoch/phase6JourneyContextStore.ts";
import { createPhase6ExperimentSqliteStore } from "../lib/epoch/phase6ExperimentStore.ts";
import { createPhase6RagTraceStore } from "../lib/epoch/phase6RagTraceStore.ts";

export interface Phase6InMemoryStores {
  readonly database: DatabaseSync;
  readonly phase6RunAssemblyRepository: ReturnType<typeof createJourneyRunReceiptSqliteStore>;
  readonly phase6CommittedResultStore: ReturnType<typeof createPhase6CommittedResultSqliteStore>;
  readonly phase6JourneyContextStore: ReturnType<typeof createPhase6JourneyContextSqliteStore>;
  readonly phase6ExperimentStore: ReturnType<typeof createPhase6ExperimentSqliteStore>;
  readonly phase6RagTraceStore: ReturnType<typeof createPhase6RagTraceStore>;
}

export function createPhase6InMemoryStores(): Phase6InMemoryStores {
  const database = new DatabaseSync(":memory:");
  return {
    database,
    phase6RunAssemblyRepository: createJourneyRunReceiptSqliteStore(database),
    phase6CommittedResultStore: createPhase6CommittedResultSqliteStore(database),
    phase6JourneyContextStore: createPhase6JourneyContextSqliteStore(database),
    phase6ExperimentStore: createPhase6ExperimentSqliteStore(database),
    phase6RagTraceStore: createPhase6RagTraceStore(database),
  };
}
