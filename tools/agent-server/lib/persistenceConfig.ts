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
import {
  createPublicReleaseEvidenceStore,
  type PublicReleaseEvidenceStore,
} from "./publicReleaseReadiness.ts";
import { createSqliteRecoveryManifest, type RecoveryManifest } from "./recovery.ts";
import {
  appendSqliteEpochEventBatch,
  appendSqliteJsonl,
  createAgentSqlitePersistenceStores,
  createSqliteCausalIdempotencyManifestStore,
  loadAgentRuntimeOptionsFromSqlite,
  migrateJsonlDataDirToSqlite,
  type KNOWN_JSONL_FILES,
} from "./sqliteStore.ts";
import {
  appendJsonl,
  dataDir,
  loadAgentRuntimeOptions,
} from "./store.ts";

type EnvLike = Record<string, string | undefined>;
type PersistJsonl = typeof appendJsonl;

export interface AgentPersistenceConfig {
  readonly storeKind: "sqlite";
  readonly sqlitePath: string;
  readonly loadedOptions: Awaited<ReturnType<typeof loadAgentRuntimeOptions>>;
  readonly persistJsonl: PersistJsonl;
  readonly persistEpochEventBatch: PersistEpochEventBatch;
  readonly causalIdempotencyStore: CausalIdempotencyManifestStore;
  readonly database: DatabaseSync;
  readonly receiptRepository?: JourneyRunReceiptRepositoryAdapter;
  readonly phase6JourneyContextStore?: Phase6JourneyContextSqliteStore;
  readonly phase6ExperimentStore?: Phase6ExperimentSqliteStore;
  readonly phase6CommittedResultStore?: Phase6CommittedResultSqliteStore;
  readonly phase6RagTraceStore?: Phase6RagTraceSqliteStore;
  readonly publicReleaseEvidenceStore: PublicReleaseEvidenceStore;
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
  if (env.AGENT_SERVER_STORE && env.AGENT_SERVER_STORE !== "sqlite") {
    throw new Error("AGENT_SERVER_STORE must be sqlite");
  }
  const sqlitePath = env.AGENT_SERVER_SQLITE_PATH || join(sourceDataDir, "agent-world.sqlite");

  // Auto-migrate JSONL to SQLite if JSONL data exists and hasn't been migrated yet
  const { existsSync } = await import("node:fs");
  const jsonlEventFile = join(sourceDataDir, "epoch-events.jsonl");
  const jsonlArchived = join(sourceDataDir, "epoch-events.jsonl.archived");
  if (existsSync(jsonlEventFile) && !existsSync(jsonlArchived)) {
    await migrateJsonlDataDirToSqlite({ sourceDataDir, dbPath: sqlitePath });
    // Archive JSONL files after successful migration
    const { rename } = await import("node:fs/promises");
    const { KNOWN_JSONL_FILES } = await import("./sqliteStore.ts");
    for (const fileName of KNOWN_JSONL_FILES) {
      const filePath = join(sourceDataDir, fileName);
      if (existsSync(filePath)) {
        await rename(filePath, join(sourceDataDir, `${fileName}.archived`)).catch(() => {});
      }
    }
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
    publicReleaseEvidenceStore: createPublicReleaseEvidenceStore(sqliteStores.database),
    recoveryManifest: () => createSqliteRecoveryManifest(sqlitePath),
    close,
    dispose: close,
  };
}
