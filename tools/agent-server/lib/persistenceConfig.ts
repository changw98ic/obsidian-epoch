import { join } from "node:path";
import type { PersistEpochEventBatch } from "./epochPersistence.ts";
import { createJsonlRecoveryManifest, createSqliteRecoveryManifest, type RecoveryManifest } from "./recovery.ts";
import {
  appendSqliteEpochEventBatch,
  appendSqliteJsonl,
  loadAgentRuntimeOptionsFromSqlite,
  migrateJsonlDataDirToSqlite,
} from "./sqliteStore.ts";
import { appendEpochEventBatchJsonl, appendJsonl, dataDir, loadAgentRuntimeOptions } from "./store.ts";

type EnvLike = Record<string, string | undefined>;
type PersistJsonl = typeof appendJsonl;

export interface AgentPersistenceConfig {
  readonly storeKind: "jsonl" | "sqlite";
  readonly sqlitePath?: string;
  readonly loadedOptions: Awaited<ReturnType<typeof loadAgentRuntimeOptions>>;
  readonly persistJsonl: PersistJsonl;
  readonly persistEpochEventBatch: PersistEpochEventBatch;
  readonly recoveryManifest: () => Promise<RecoveryManifest>;
}

function enabled(value: string | undefined) {
  return value === "1" || value === "true" || value === "yes";
}

export async function createAgentPersistenceFromEnv(
  env: EnvLike = process.env,
  sourceDataDir = dataDir,
): Promise<AgentPersistenceConfig> {
  const storeKind = env.AGENT_SERVER_STORE?.trim() || "jsonl";
  if (storeKind !== "jsonl" && storeKind !== "sqlite") {
    throw new Error("AGENT_SERVER_STORE must be jsonl or sqlite");
  }
  if (storeKind === "jsonl") {
    return {
      storeKind: "jsonl",
      loadedOptions: await loadAgentRuntimeOptions(),
      persistJsonl: appendJsonl,
      persistEpochEventBatch: appendEpochEventBatchJsonl,
      recoveryManifest: () => createJsonlRecoveryManifest(sourceDataDir),
    };
  }

  const sqlitePath = env.AGENT_SERVER_SQLITE_PATH || join(sourceDataDir, "agent-world.sqlite");
  if (enabled(env.AGENT_SERVER_SQLITE_MIGRATE_JSONL)) {
    await migrateJsonlDataDirToSqlite({
      sourceDataDir,
      dbPath: sqlitePath,
    });
  }

  return {
    storeKind: "sqlite",
    sqlitePath,
    loadedOptions: await loadAgentRuntimeOptionsFromSqlite(sqlitePath),
    persistJsonl: (fileName, record) => appendSqliteJsonl(sqlitePath, fileName, record),
    persistEpochEventBatch: (events) => appendSqliteEpochEventBatch(sqlitePath, events),
    recoveryManifest: () => createSqliteRecoveryManifest(sqlitePath),
  };
}
