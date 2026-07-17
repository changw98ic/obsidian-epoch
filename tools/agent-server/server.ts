import { createAgentHttpServer, disposeAgentHttpServerTransport } from "./lib/httpServer.ts";
import { epochMaintenanceConfigFromEnv, startEpochMaintenanceScheduler } from "./lib/maintenance.ts";
import { createAgentWorldRuntime } from "./lib/mcpTools.ts";
import { createAgentPersistenceFromEnv } from "./lib/persistenceConfig.ts";
import { productionAgentServerConfigFromEnv } from "./lib/productionConfig.ts";
import { PlayerMcpAccessTokenStore } from "./lib/playerMcpAccessTokenStore.ts";
import { createEpochMutationCoordinator, createEpochPersistenceGuard } from "./lib/epochPersistence.ts";
import { maxJsonBodyBytesFromEnv } from "./lib/http/request.ts";
import { createWorldMemoryRuntime, worldMemoryRuntimeConfigFromEnv } from "./lib/worldMemoryRuntime.ts";
import { loadDefaultWorldContentRegistry } from "./lib/epoch/worldContentRegistry.ts";

const port = Number(process.env.AGENT_SERVER_PORT || 8787);
const host = process.env.AGENT_SERVER_HOST || "127.0.0.1";
const maxBodyBytes = maxJsonBodyBytesFromEnv(process.env.AGENT_SERVER_MAX_BODY_BYTES);
const DEFAULT_SHUTDOWN_TIMEOUT_MS = 10_000;
const MIN_SHUTDOWN_TIMEOUT_MS = 1_000;
const MAX_SHUTDOWN_TIMEOUT_MS = 120_000;

function shutdownTimeoutMsFromEnv(value: string | undefined) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) return DEFAULT_SHUTDOWN_TIMEOUT_MS;
  return Math.max(MIN_SHUTDOWN_TIMEOUT_MS, Math.min(parsed, MAX_SHUTDOWN_TIMEOUT_MS));
}

async function main() {
  const startupConfig = productionAgentServerConfigFromEnv(process.env);
  const resolvedRuntimeEnv = {
    ...process.env,
    ...(startupConfig.operatorKey ? { AGENT_SERVER_OPERATOR_KEY: startupConfig.operatorKey } : {}),
  };
  const persistence = await createAgentPersistenceFromEnv(process.env);
  const playerMcpAccessTokens = startupConfig.mcpPlayerTokenJsonlPath
    ? await PlayerMcpAccessTokenStore.open({ jsonlPath: startupConfig.mcpPlayerTokenJsonlPath })
    : undefined;
  const runtime = createAgentWorldRuntime({
    ...persistence.loadedOptions,
    epoch: {
      ...((persistence.loadedOptions as { epoch?: Record<string, unknown> }).epoch || {}),
      attestedRunners: startupConfig.attestedRunners,
      operatorKey: startupConfig.operatorKey,
      registrationSecret: startupConfig.registrationSecret,
    },
  });
  const worldContentRegistry = loadDefaultWorldContentRegistry();
  const worldMemory = persistence.sqlitePath
    ? createWorldMemoryRuntime(
        worldMemoryRuntimeConfigFromEnv(persistence.sqlitePath, process.env),
        { worldContentRegistry },
      )
    : undefined;
  const shutdownTimeoutMs = shutdownTimeoutMsFromEnv(process.env.AGENT_SERVER_SHUTDOWN_TIMEOUT_MS);
  let maintenance: ReturnType<typeof startEpochMaintenanceScheduler> | undefined;
  let server: ReturnType<typeof createAgentHttpServer> | undefined;
  let shutdownStarted = false;

  const shutdown = (reason: NodeJS.Signals | "PERSISTENCE_FAILURE", exitCode = 0) => {
    if (exitCode !== 0) process.exitCode = exitCode;
    maintenance?.stop();
    worldMemory?.stop();
    if (!server || shutdownStarted) return;
    shutdownStarted = true;
    const activeServer = server;
    console.log(`agent-server received ${reason}; draining connections for up to ${shutdownTimeoutMs}ms`);
    disposeAgentHttpServerTransport(activeServer);

    const forceExitTimer = setTimeout(() => {
      console.error(`agent-server graceful shutdown timed out after ${shutdownTimeoutMs}ms`);
      activeServer.closeAllConnections();
      process.exit(1);
    }, shutdownTimeoutMs);
    forceExitTimer.unref();
    const closeIdleConnectionsTimer = setInterval(() => activeServer.closeIdleConnections(), 100);
    closeIdleConnectionsTimer.unref();

    activeServer.close((error) => {
      void (async () => {
        if (error) throw error;
        await maintenance?.drain();
        await worldMemory?.drain();
        await mutationCoordinator.drain();
        console.log(`agent-server stopped after ${reason}`);
      })().catch((shutdownError: unknown) => {
        const message = shutdownError instanceof Error ? shutdownError.message : String(shutdownError);
        console.error(`agent-server shutdown failed after ${reason}: ${message}`);
        process.exitCode = 1;
      }).finally(() => {
        clearTimeout(forceExitTimer);
        clearInterval(closeIdleConnectionsTimer);
      });
    });
    activeServer.closeIdleConnections();
  };

  const persistenceGuard = createEpochPersistenceGuard((error) => {
    console.error(`agent-server fatal persistence failure: ${error.persistenceError}`);
    shutdown("PERSISTENCE_FAILURE", 1);
  });
  const mutationCoordinator = createEpochMutationCoordinator();

  maintenance = startEpochMaintenanceScheduler({
    runtime,
    persistJsonl: persistence.persistJsonl,
    persistEpochEventBatch: persistence.persistEpochEventBatch,
    persistenceGuard,
    mutationCoordinator,
    config: epochMaintenanceConfigFromEnv(resolvedRuntimeEnv),
    onError: (error) => {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`epoch maintenance failed: ${message}`);
    },
  });
  server = createAgentHttpServer({
    runtime,
    allowedOrigins: startupConfig.allowedOrigins,
    canonicalPublicServerBase: startupConfig.publicServerBase,
    consoleAssetBaseUrl: startupConfig.consoleAssetBaseUrl,
    mcpBearerToken: startupConfig.mcpBearerToken,
    playerMcpAccessTokens,
    playerMcpTokenTtlMs: startupConfig.mcpPlayerTokenTtlMs,
    publicRegistrationProtection: startupConfig.publicRegistrationProtection,
    maxBodyBytes,
    persistJsonl: persistence.persistJsonl,
    persistEpochEventBatch: persistence.persistEpochEventBatch,
    persistenceGuard,
    mutationCoordinator,
    health: {
      store: {
        kind: persistence.storeKind,
        sqlitePath: persistence.sqlitePath,
      },
      maintenance,
      worldMemory,
      recovery: persistence.recoveryManifest,
    },
    worldMemorySearch: worldMemory?.search,
    worldKnowledgeSearch: worldMemory?.searchKnowledge,
  });
  if (persistenceGuard.failed) {
    worldMemory?.stop();
    maintenance.stop();
    return;
  }
  worldMemory?.start();

  const onSigterm = () => shutdown("SIGTERM");
  const onSigint = () => shutdown("SIGINT");
  process.once("SIGTERM", onSigterm);
  process.once("SIGINT", onSigint);
  server.on("close", () => {
    maintenance.stop();
    worldMemory?.stop();
    process.off("SIGTERM", onSigterm);
    process.off("SIGINT", onSigint);
  });

  server.listen(port, host, () => {
    console.log(`agent-server listening on http://${host}:${port}`);
    if (maintenance.enabled) console.log("epoch maintenance scheduler enabled");
  });
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`agent-server failed: ${message}`);
  process.exitCode = 1;
});
