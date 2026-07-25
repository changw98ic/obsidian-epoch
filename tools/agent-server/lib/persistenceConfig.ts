import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import type { CausalIdempotencyManifestStore } from "./epoch/causalIdempotencyRules.ts";
import type { PersistEpochEventBatch } from "./epochPersistence.ts";
import type { JourneyRunReceiptRepositoryAdapter } from "./epoch/journeySettlementRuntime.ts";
import {
  createPhase6CommittedResultSqliteStore,
  type Phase6CommittedResultSqliteStore,
} from "./epoch/phase6CommittedResultStore.ts";
import type { Phase6JourneyContextSqliteStore } from "./epoch/phase6JourneyContextStore.ts";
import type { Phase6ExperimentSqliteStore } from "./epoch/phase6ExperimentStore.ts";
import type { Phase6RagTraceSqliteStore } from "./epoch/phase6RagTraceStore.ts";
import { createJsonlRecoveryManifest, createSqliteRecoveryManifest, type RecoveryManifest } from "./recovery.ts";
import {
  appendSqliteEpochEventBatch,
  appendSqliteJsonl,
  createAgentSqlitePersistenceStores,
  createSqliteCausalIdempotencyManifestStore,
  loadAgentRuntimeOptionsFromSqlite,
  migrateJsonlDataDirToSqlite,
} from "./sqliteStore.ts";
import {
  appendEpochEventBatchJsonl,
  appendJsonl,
  createJsonlCausalIdempotencyManifestStore,
  dataDir,
  loadAgentRuntimeOptions,
} from "./store.ts";

type EnvLike = Record<string, string | undefined>;
type PersistJsonl = typeof appendJsonl;

export interface AgentPersistenceConfig {
  readonly storeKind: "jsonl" | "sqlite";
  readonly sqlitePath?: string;
  readonly loadedOptions: Awaited<ReturnType<typeof loadAgentRuntimeOptions>>;
  readonly persistJsonl: PersistJsonl;
  readonly persistEpochEventBatch: PersistEpochEventBatch;
  readonly causalIdempotencyStore: CausalIdempotencyManifestStore;
  readonly database?: DatabaseSync;
  readonly receiptRepository?: JourneyRunReceiptRepositoryAdapter;
  readonly phase6JourneyContextStore?: Phase6JourneyContextSqliteStore;
  readonly phase6ExperimentStore?: Phase6ExperimentSqliteStore;
  readonly phase6CommittedResultStore?: Phase6CommittedResultSqliteStore;
  readonly phase6RagTraceStore?: Phase6RagTraceSqliteStore;
  readonly recoveryManifest: () => Promise<RecoveryManifest>;
  readonly close: () => void;
  readonly dispose: () => void;
}

function enabled(value: string | undefined) {
  return value === "1" || value === "true" || value === "yes";
}

export async function createAgentPersistenceFromEnv(
  env: EnvLike = process.env,
  sourceDataDir = dataDir,
): Promise<AgentPersistenceConfig> {
  const storeKind = env.AGENT_SERVER_STORE?.trim() || "sqlite";
  if (storeKind !== "jsonl" && storeKind !== "sqlite") {
    throw new Error("AGENT_SERVER_STORE must be jsonl or sqlite");
  }
  if (storeKind === "jsonl") {
    const close = () => {};
    return {
      storeKind: "jsonl",
      loadedOptions: await loadAgentRuntimeOptions(),
      persistJsonl: appendJsonl,
      persistEpochEventBatch: appendEpochEventBatchJsonl,
      causalIdempotencyStore: createJsonlCausalIdempotencyManifestStore(sourceDataDir),
      recoveryManifest: () => createJsonlRecoveryManifest(sourceDataDir),
      close,
      dispose: close,
    };
  }

  const sqlitePath = env.AGENT_SERVER_SQLITE_PATH || join(sourceDataDir, "agent-world.sqlite");
  if (enabled(env.AGENT_SERVER_SQLITE_MIGRATE_JSONL)) {
    await migrateJsonlDataDirToSqlite({
      sourceDataDir,
      dbPath: sqlitePath,
    });
  }

  const loadedOptions = await loadAgentRuntimeOptionsFromSqlite(sqlitePath);
  const sqliteStores = createAgentSqlitePersistenceStores(sqlitePath);
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    sqliteStores.database.close();
  };

  return {
    storeKind: "sqlite",
    sqlitePath,
    loadedOptions,
    persistJsonl: (fileName, record) => appendSqliteJsonl(sqlitePath, fileName, record),
    persistEpochEventBatch: (events) => appendSqliteEpochEventBatch(sqlitePath, events),
    causalIdempotencyStore: createSqliteCausalIdempotencyManifestStore(sqlitePath),
    database: sqliteStores.database,
    receiptRepository: sqliteStores.receiptRepository,
    phase6JourneyContextStore: sqliteStores.phase6JourneyContextStore,
    phase6ExperimentStore: sqliteStores.phase6ExperimentStore,
    phase6CommittedResultStore: createPhase6CommittedResultSqliteStore(sqliteStores.database),
    phase6RagTraceStore: sqliteStores.phase6RagTraceStore,
    recoveryManifest: () => createSqliteRecoveryManifest(sqlitePath),
    close,
    dispose: close,
  };
}
