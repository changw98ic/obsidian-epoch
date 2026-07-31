import http, { type IncomingMessage, type ServerResponse } from "node:http";
import { createAgentWorldMcpRuntime } from "./mcpTools.ts";
import { createAgentWorldRuntime } from "./mcpRuntimeCore.ts";
import { handleEpochAgentProfileRoutes } from "./http/agentProfileRoutes.ts";
import { handleEpochAuditRoutes } from "./http/auditRoutes.ts";
import { handleEpochAssetRoutes } from "./http/assetRoutes.ts";
import { handleEpochEconomyRoutes } from "./http/economyRoutes.ts";
import { handleEpochEncounterRoutes } from "./http/encounterRoutes.ts";
import { classifyHttpError } from "./http/errorResponse.ts";
import { handleEpochGameplayRoutes } from "./http/gameplayRoutes.ts";
import { handleEpochHostedRoutes } from "./http/hostedRoutes.ts";
import { handleEpochIdentityRoutes } from "./http/identityRoutes.ts";
import { handleEpochInstallRoutes } from "./http/installRoutes.ts";
import { handleLegacyRuntimeRoutes } from "./http/legacyRoutes.ts";
import { handleEpochMcpRoutes } from "./http/mcpRoutes.ts";
import { handleEpochNarrativeRoutes } from "./http/narrativeRoutes.ts";
import { handleEpochOperatorRoutes } from "./http/operatorRoutes.ts";
import { handleEpochPlayerAccessRoutes } from "./http/playerAccessRoutes.ts";
import {
  type AnyRecord,
  optionalString,
  parsedJsonBody,
  publicServerBase,
  queryParams,
  readJsonBody,
  recordArray,
  recordValue,
} from "./http/request.ts";
import {
  sendBinary,
  sendEmpty,
  sendHtml,
  sendJson,
  sendJsonDownload,
  sendTextDownload,
} from "./http/response.ts";
import { handleEpochResultRoutes } from "./http/resultRoutes.ts";
import { handleEpochSeasonRoutes } from "./http/seasonRoutes.ts";
import { handleEpochSocietyRoutes } from "./http/societyRoutes.ts";
import { handleEpochWorldRoutes } from "./http/worldRoutes.ts";
import { type RecoveryManifest, unavailableRecoveryManifest } from "./recovery.ts";
import {
  evaluatePublicReleaseReadiness,
  type PublicReleaseEvidenceStore,
} from "./publicReleaseReadiness.ts";
import { appendJsonl } from "./store.ts";
import { redactApiKeys } from "./safety.ts";
import type { EpochMaintenanceSchedulerStatus } from "./maintenance.ts";
import type { PlayerMcpAccessTokenStore } from "./playerMcpAccessTokenStore.ts";
import type { WorldMemoryRuntimeStatus } from "./worldMemoryRuntime.ts";
import {
  type PublicRegistrationProtectionConfig,
  PERMISSIVE_PUBLIC_REGISTRATION_PROTECTION,
} from "./publicRegistrationProtection.ts";
import { epochEventsForPersistence } from "./epoch/runtimePublicProjectionRules.ts";
import { journeyEventsForPersistence } from "./epoch/journeyPersistence.ts";
import {
  attachPhase6CommittedResultForPersistence,
  phase6CommittedResultsForPersistence,
} from "./epoch/phase6CommittedResultStore.ts";
import { isMcpResultAlreadyPersisted } from "./mcpRequestContext.ts";
import { createMcpHttpSessionRegistry, type McpHttpSessionRegistry } from "./mcpHttpTransport.ts";
import {
  createEpochMutationCoordinator,
  createEpochPersistenceGuard,
  createLegacyEpochEventBatchWriter,
  isEpochPersistenceError,
  persistEpochEventBatchWithGuard,
  type EpochPersistenceGuard,
  type EpochMutationCoordinator,
  type PersistEpochEventBatch,
} from "./epochPersistence.ts";
import { assertCausalWorldEventV1 } from "./epoch/causalContracts.ts";
import { causalWorldEventToEpochEvent } from "./epoch/causalEpochAdapter.ts";

type AgentWorldRuntime = ReturnType<typeof createAgentWorldRuntime>;
type PersistEpochResult = (result: unknown) => Promise<number>;

const mcpHttpSessionRegistries = new WeakMap<http.Server, McpHttpSessionRegistry>();

/** Ends MCP SSE streams and cancels their pending server requests before HTTP shutdown waits on them. */
export function disposeAgentHttpServerTransport(server: http.Server) {
  const registry = mcpHttpSessionRegistries.get(server);
  if (!registry) return false;
  registry.dispose();
  return true;
}

type HttpServerOptions = {
  runtime: AgentWorldRuntime;
  maxBodyBytes?: number;
  allowedOrigins?: string[];
  persistJsonl?: typeof appendJsonl | null;
  persistEpochEventBatch?: PersistEpochEventBatch | null;
  persistenceGuard?: EpochPersistenceGuard;
  mutationCoordinator?: EpochMutationCoordinator;
  health?: AgentHealthOptions;
  consoleAssetBaseUrl?: string;
  canonicalPublicServerBase?: string;
  mcpBearerToken?: string;
  playerMcpAccessTokens?: PlayerMcpAccessTokenStore;
  playerMcpTokenTtlMs?: number;
  publicRegistrationProtection?: PublicRegistrationProtectionConfig;
  publicReleaseEvidenceStore?: PublicReleaseEvidenceStore;
  allowLegacyHttpIdentityRegistration?: boolean;
  worldMemorySearch?: (input: AnyRecord) => Promise<unknown>;
  worldKnowledgeSearch?: (input: AnyRecord) => Promise<unknown>;
};

interface AgentHealthOptions {
  readonly store?: {
    readonly kind: "memory" | "jsonl" | "sqlite";
    readonly sqlitePath?: string;
  };
  readonly maintenance?: {
    readonly status: () => EpochMaintenanceSchedulerStatus;
  };
  readonly worldMemory?: {
    readonly status: () => WorldMemoryRuntimeStatus;
  };
  readonly recovery?: () => Promise<RecoveryManifest> | RecoveryManifest;
  readonly recoveryCache?: {
    readonly ttlMs?: number;
    readonly clock?: () => number;
  };
  readonly serverAi?: {
    readonly getState: () => "warming" | "ready" | "degraded";
  };
}

function storeHealth(input: AgentHealthOptions["store"] | undefined, persistJsonl: typeof appendJsonl | null) {
  const kind = input?.kind || (persistJsonl ? "jsonl" : "memory");
  return {
    status: "ok",
    kind,
    persistent: kind !== "memory",
    sqlitePathConfigured: kind === "sqlite" ? Boolean(input?.sqlitePath) : undefined,
  };
}

function maintenanceHealth(input: AgentHealthOptions["maintenance"] | undefined) {
  if (!input) {
    return {
      status: "unconfigured",
      enabled: false,
      inFlight: false,
    };
  }
  const status = input.status();
  const hasUnrecoveredError = Boolean(status.lastErrorAt && (!status.lastSuccessAt || status.lastErrorAt >= status.lastSuccessAt));
  return {
    ...status,
    status: hasUnrecoveredError
      ? "error"
      : status.inFlight
        ? "running"
        : status.enabled
          ? "ok"
          : "disabled",
  };
}

function worldMemoryHealth(input: AgentHealthOptions["worldMemory"] | undefined) {
  if (!input) return { status: "unconfigured", enabled: false, semanticEnabled: false };
  const value = input.status();
  const unrecoveredError = Boolean(value.lastErrorAt
    && (!value.lastSuccessAt || value.lastErrorAt >= value.lastSuccessAt));
  const hasUnfinishedVectors = value.pending > 0
    || value.processing > 0
    || value.knowledge.pending > 0
    || value.knowledge.processing > 0;
  const hasFailedVectors = value.failed > 0 || value.knowledge.failed > 0;
  return {
    ...value,
    status: value.semanticEnabled
      ? unrecoveredError || hasFailedVectors
        ? "degraded"
        : value.inFlight
          ? "running"
          : hasUnfinishedVectors
            ? "indexing"
            : !value.embeddingIdentityVerifiedAt
              ? "initializing"
          : "ok"
      : "lexical_only",
  };
}

function serverAiHealth(input: AgentHealthOptions["serverAi"] | undefined) {
  if (!input) return { status: "unconfigured" };
  const state = input.getState();
  return { status: state };
}

function persistenceHealth(guard: EpochPersistenceGuard) {
  if (!guard.failed) return { status: "ok" };
  return {
    status: "error",
    code: guard.error?.code || "epoch_persistence_unavailable",
  };
}

function infiniteWorldHealth(runtime: AgentWorldRuntime) {
  try {
    const value = runtime.infiniteWorldHealth({});
    const health = recordValue(value.health);
    const nested = recordValue(health.health);
    return {
      ok: value.ok === true,
      status: optionalString(nested.status) || optionalString(health.status) || "ok",
      worldId: optionalString(value.worldId),
    };
  } catch (error) {
    return {
      ok: false,
      status: "error",
      code: error instanceof Error && error.message ? error.message : "infinite_world_health_unavailable",
    };
  }
}

async function loadRecoveryHealth(
  input: AgentHealthOptions["recovery"] | undefined,
  store: ReturnType<typeof storeHealth>,
): Promise<RecoveryManifest> {
  if (!input) return unavailableRecoveryManifest(store.kind);
  try {
    return await input();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ...unavailableRecoveryManifest(store.kind),
      status: "error",
      persistent: store.persistent,
      generatedAt: new Date().toISOString(),
      storeKind: store.kind,
      manifestSha256: "",
      files: {},
      records: 0,
      epochEvents: { records: 0 },
      resultPages: { records: 0 },
      error: message,
    } as RecoveryManifest & { readonly error: string };
  }
}

const DEFAULT_RECOVERY_HEALTH_CACHE_TTL_MS = 30_000;

interface RecoveryHealthCacheEntry {
  readonly manifest: RecoveryManifest;
  readonly refreshedAtMs: number;
}

function createRecoveryHealthCache(
  input: AgentHealthOptions["recovery"] | undefined,
  store: ReturnType<typeof storeHealth>,
  options: AgentHealthOptions["recoveryCache"] | undefined,
) {
  const configuredTtlMs = options?.ttlMs;
  const ttlMs = typeof configuredTtlMs === "number"
    && Number.isSafeInteger(configuredTtlMs)
    && configuredTtlMs > 0
    ? configuredTtlMs
    : DEFAULT_RECOVERY_HEALTH_CACHE_TTL_MS;
  const clock = options?.clock || Date.now;
  let cached: RecoveryHealthCacheEntry | undefined;
  let inFlight: Promise<RecoveryHealthCacheEntry> | undefined;

  function refresh() {
    if (inFlight) return inFlight;
    let pending: Promise<RecoveryHealthCacheEntry>;
    pending = (async () => {
      const manifest = await loadRecoveryHealth(input, store);
      const entry = { manifest, refreshedAtMs: clock() };
      cached = entry;
      return entry;
    })().finally(() => {
      if (inFlight === pending) inFlight = undefined;
    });
    inFlight = pending;
    return pending;
  }

  function view(entry: RecoveryHealthCacheEntry, state: "fresh" | "stale") {
    return {
      status: entry.manifest.status,
      persistent: entry.manifest.persistent,
      storeKind: entry.manifest.storeKind,
      cache: {
        state,
        ttlMs,
        refreshedAt: new Date(entry.refreshedAtMs).toISOString(),
        refreshing: Boolean(inFlight),
      },
    };
  }

  return {
    async get() {
      const current = cached;
      if (!current) return view(await refresh(), "fresh");
      if (clock() - current.refreshedAtMs < ttlMs) return view(current, "fresh");
      void refresh();
      return view(current, "stale");
    },
  };
}

function publicRegistrationHealth(
  config: PublicRegistrationProtectionConfig,
  store: PlayerMcpAccessTokenStore | undefined,
) {
  const persistent = Boolean(store?.persistent);
  const validConfig = config.mode === "permissive" || (
    typeof config.actorHashSecret === "string"
    && config.actorHashSecret.length >= 32
    && Number.isSafeInteger(config.trustProxyHops)
    && config.trustProxyHops >= 0
    && Number.isSafeInteger(config.windowMs)
    && config.windowMs > 0
    && Number.isSafeInteger(config.maxActions)
    && config.maxActions > 0
    && Number.isSafeInteger(config.cooldownMs)
    && config.cooldownMs >= 0
  );
  const ready = config.mode === "permissive" || (validConfig && persistent);
  return {
    status: ready ? config.mode : "error",
    mode: config.mode,
    persistent,
    trustedProxyHops: config.trustProxyHops,
    windowMs: config.windowMs,
    maxActions: config.maxActions,
    cooldownMs: config.cooldownMs,
    deviceChallengeTtlMs: config.deviceChallengeTtlMs,
    invitesConfigured: config.inviteActorHashes.length,
    actorHashSecretConfigured: typeof config.actorHashSecret === "string" && config.actorHashSecret.length >= 32,
  };
}

async function serverHealth(
  runtime: AgentWorldRuntime,
  health: AgentHealthOptions | undefined,
  persistJsonl: typeof appendJsonl | null,
  persistenceGuard: EpochPersistenceGuard,
  publicRegistrationProtection: PublicRegistrationProtectionConfig,
  playerMcpAccessTokens: PlayerMcpAccessTokenStore | undefined,
  recoveryCache: ReturnType<typeof createRecoveryHealthCache>,
  mcpMetrics?: unknown,
) {
  const store = storeHealth(health?.store, persistJsonl);
  const maintenance = maintenanceHealth(health?.maintenance);
  const worldMemory = worldMemoryHealth(health?.worldMemory);
  const recovery = await recoveryCache.get();
  const publicRegistration = publicRegistrationHealth(publicRegistrationProtection, playerMcpAccessTokens);
  const persistence = persistenceHealth(persistenceGuard);
  const infiniteWorld = infiniteWorldHealth(runtime);
  const serverAi = serverAiHealth(health?.serverAi);
  return {
    ok: store.status === "ok"
      && maintenance.status !== "error"
      && recovery.status !== "error"
      && publicRegistration.status !== "error"
      && persistence.status !== "error",
    service: "agent-server",
    checks: {
      store,
      maintenance,
      worldMemory,
      infiniteWorld,
      recovery,
      publicRegistration,
      persistence,
      serverAi,
      mcp: mcpMetrics,
    },
  };
}

const DEFAULT_ALLOWED_ORIGINS = ["http://127.0.0.1:5173", "http://localhost:5173", "null"];
const DEFAULT_MAX_BODY_BYTES = 1_000_000;
const DEFAULT_PLAYER_MCP_TOKEN_TTL_MS = 12 * 60 * 60 * 1_000;

async function persistJsonlWithGuard(
  persistJsonl: typeof appendJsonl | null,
  persistenceGuard: EpochPersistenceGuard,
  fileName: string,
  record: unknown,
) {
  persistenceGuard.assertHealthy();
  if (!persistJsonl) return;
  try {
    await persistJsonl(fileName, record);
  } catch (error) {
    throw persistenceGuard.trip(error);
  }
}

async function persistRunSettlement(
  persistJsonl: typeof appendJsonl | null,
  persistenceGuard: EpochPersistenceGuard,
  body: AnyRecord,
  settlement: unknown,
  runtime: AgentWorldRuntime,
) {
  const settlementRecord = recordValue(settlement);
  const lore = recordValue(settlementRecord.lore);
  const progression = recordValue(settlementRecord.progression);
  const rawRun = recordValue(body.run);
  const sequenceNormalizedRun = typeof rawRun.sequence === "number"
    ? rawRun
    : typeof body.sequence === "number"
      ? { ...rawRun, sequence: body.sequence }
      : rawRun;
  const run = typeof sequenceNormalizedRun.contextVersion === "string"
    ? sequenceNormalizedRun
    : typeof body.contextVersion === "string"
      ? { ...sequenceNormalizedRun, contextVersion: body.contextVersion }
      : sequenceNormalizedRun;
  persistenceGuard.assertHealthy();
  if (!persistJsonl || settlementRecord.duplicate) return;
  await persistJsonlWithGuard(persistJsonl, persistenceGuard, "runs.jsonl", {
    type: settlementRecord.state === "archived" ? "run_archived" : "run_submitted",
    runTicket: settlementRecord.runTicket === null ? undefined : body.runTicket,
    archiveId: settlementRecord.archiveId,
    run: redactApiKeys(run),
    adjudication: settlementRecord.adjudication,
    lore,
    progression,
    feedback: settlementRecord.feedback,
    experience: settlementRecord.experience,
    channelClass: settlementRecord.channelClass,
    deliveryTrust: settlementRecord.deliveryTrust,
    transparencyEntry: settlementRecord.transparencyEntry,
    submittedAt: settlementRecord.submittedAt,
    settledAt: settlementRecord.settledAt,
  });
  if (Array.isArray(lore.decisions) && lore.decisions.length) {
    await persistJsonlWithGuard(persistJsonl, persistenceGuard, "lore.jsonl", {
      type: "lore_admission",
      runTicket: body.runTicket,
      lore,
      state: runtime.loreState(),
      submittedAt: settlementRecord.submittedAt,
    });
  }
  if (Number(progression.pointsAwarded || 0) > 0) {
    await persistJsonlWithGuard(persistJsonl, persistenceGuard, "progression.jsonl", {
      type: "progression_awarded",
      runTicket: body.runTicket,
      progression,
      state: runtime.progressionState({ explorerId: run.explorerId }),
      submittedAt: settlementRecord.submittedAt,
    });
  }
  await persistOutboxEntries(persistJsonl, persistenceGuard, recordArray(recordValue(settlementRecord.outbox).entries));
}

async function persistStateSnapshotWithGuard(
  persistJsonl: typeof appendJsonl | null,
  persistenceGuard: EpochPersistenceGuard,
  fileName: string,
  record: unknown,
) {
  await persistJsonlWithGuard(persistJsonl, persistenceGuard, fileName, record);
}

async function persistContextSnapshot(
  persistJsonl: typeof appendJsonl | null,
  persistenceGuard: EpochPersistenceGuard,
  contextPackage: unknown,
) {
  persistenceGuard.assertHealthy();
  if (!persistJsonl) return;
  const snapshot = recordValue(recordValue(contextPackage).contextSnapshot);
  if (!optionalString(snapshot.snapshotId)) return;
  await persistJsonlWithGuard(persistJsonl, persistenceGuard, "context-snapshots.jsonl", {
    type: "context_snapshot",
    snapshot,
  });
}

async function persistEpochEvents(
  persistEpochEventBatch: PersistEpochEventBatch | null,
  persistenceGuard: EpochPersistenceGuard,
  result: unknown,
) {
  const events = epochEventsForPersistence(result);
  if (events.length) return persistEpochEventBatchWithGuard(persistEpochEventBatch, persistenceGuard, events);
  const causalEvent = causalEventEnvelopeForPersistence(result);
  if (causalEvent) {
    return persistEpochEventBatchWithGuard(persistEpochEventBatch, persistenceGuard, [
      causalWorldEventToEpochEvent(causalEvent),
    ]);
  }
  return persistEpochEventBatchWithGuard(persistEpochEventBatch, persistenceGuard, events);
}

function causalEventEnvelopeForPersistence(result: unknown) {
  const record = recordValue(result);
  const candidate = record.causalEvent || record.event;
  if (!candidate) return undefined;
  try {
    return assertCausalWorldEventV1(candidate);
  } catch {
    return undefined;
  }
}

async function persistOutboxEntries(
  persistJsonl: typeof appendJsonl | null,
  persistenceGuard: EpochPersistenceGuard,
  entries: readonly AnyRecord[],
) {
  persistenceGuard.assertHealthy();
  if (!persistJsonl) return 0;
  let count = 0;
  for (const entry of entries) {
    await persistJsonlWithGuard(persistJsonl, persistenceGuard, "outbox.jsonl", { type: "outbox_event", ...entry });
    count += 1;
  }
  return count;
}

function errorCodeForRejectedHttpCommand(error: unknown) {
  return error instanceof Error && error.message ? error.message : "internal_error";
}

async function recordRejectedHttpCommand(
  request: IncomingMessage,
  runtime: AgentWorldRuntime,
  persistEpochResult: PersistEpochResult,
  error: unknown,
  statusCode: number,
) {
  const method = request.method || "GET";
  const pathname = new URL(request.url || "/", "http://127.0.0.1").pathname;
  const body = parsedJsonBody(request);
  if (method !== "POST" || !pathname.startsWith("/api/") || !body || Array.isArray(body)) return;
  const isMcpToolProxy = pathname === "/api/epoch/mcp/tools/call";
  const isPublicCredentialRoute = pathname === "/api/epoch/pairing/register"
    || pathname === "/api/epoch/mcp/access-tokens";
  const sourceInput = isPublicCredentialRoute
    ? { redacted: true, reason: "public_credential_input" }
    : isMcpToolProxy
      ? recordValue(body.arguments)
      : body;
  const command = isMcpToolProxy && typeof body.name === "string" && body.name.trim()
    ? body.name.trim()
    : `${method} ${pathname}`;
  let result: unknown;
  try {
    result = runtime.epochRecordRejectedCommand({
      surface: "http",
      command,
      errorCode: errorCodeForRejectedHttpCommand(error),
      statusCode,
      input: sourceInput,
    });
  } catch {
    // Preserve the original rejected-command response if its secondary audit record cannot be built.
    return;
  }
  await persistEpochResult(result);
}

function resultPageRevisionIdentity(page: AnyRecord) {
  return `${String(page.pageId)}:${typeof page.shareVersion === "number" ? page.shareVersion : 1}`;
}

async function persistEpochResultPage(
  persistJsonl: typeof appendJsonl | null,
  result: unknown,
  persistenceGuard?: EpochPersistenceGuard,
) {
  const input = recordValue(result);
  const commandPersistence = recordValue(input.commandPersistence);
  const pageResult = recordValue(commandPersistence.pageResult ?? result);
  if (!persistJsonl || pageResult.duplicate || !pageResult.page) return;
  const command = optionalString(commandPersistence.command);
  if (!command) throw new Error("result_page_command_envelope_required");
  const sourceResult = commandPersistence.sourceResult ?? pageResult;
  const journeyEvents = [...new Map(journeyEventsForPersistence(sourceResult)
    .map((event) => [event.eventId, event] as const)).values()];
  const epochEvents = [...new Map(epochEventsForPersistence(sourceResult)
    .map((event) => [event.eventId, event] as const)).values()];
  const page = recordValue(pageResult.page);
  const commandId = `${command}:${journeyEvents[0]?.eventId || epochEvents[0]?.eventId || resultPageRevisionIdentity(page)}`;
  persistenceGuard?.assertHealthy();
  try {
    await persistJsonl("command-events.jsonl", {
      type: "agent_command_commit",
      version: 1,
      command,
      commandId,
      journeyEvents,
      epochEvents,
      resultPages: [page],
    });
  } catch (error) {
    throw persistenceGuard ? persistenceGuard.trip(error) : error;
  }
}

export function parseMcpToolResultPayload(toolResult: unknown) {
  const content = recordValue(toolResult).content;
  if (!Array.isArray(content) || content.length === 0) throw new Error("mcp_tool_result_content_invalid");
  const first = recordValue(content[0]);
  if (first.type !== "text" || typeof first.text !== "string") {
    throw new Error("mcp_tool_result_content_invalid");
  }
  try {
    return JSON.parse(first.text) as unknown;
  } catch {
    throw new Error("mcp_tool_result_content_invalid");
  }
}

function isPersistableResultPage(value: unknown): value is AnyRecord {
  const page = recordValue(value);
  return Boolean(
    optionalString(page.pageId)
      && optionalString(page.createdAt)
      && optionalString(page.urlPath)
      && optionalString(page.createdBy)
      && optionalString(page.idempotencyKey),
  );
}

export function embeddedResultPagesForPersistence(payload: unknown) {
  const record = recordValue(payload);
  const pages: AnyRecord[] = [];
  const appendPageResult = (value: unknown) => {
    const pageResult = recordValue(value);
    if (pageResult.duplicate === true) return;
    const nestedPage = recordValue(pageResult.page);
    if (isPersistableResultPage(nestedPage)) {
      pages.push(nestedPage);
      return;
    }
    if (isPersistableResultPage(pageResult)) pages.push(pageResult);
  };
  appendPageResult(record);
  for (const key of ["verification", "departureVerification", "finalVerification"] as const) {
    appendPageResult(record[key]);
  }
  const returned = record.returnedJourneyVerifications;
  if (Array.isArray(returned)) {
    for (const verification of returned) appendPageResult(verification);
  }
  return [...new Map(pages.map((page) => [String(page.pageId), page] as const)).values()];
}

async function persistMcpToolPayload(
  persistJsonl: typeof appendJsonl | null,
  persistEpochResult: PersistEpochResult,
  persistenceGuard: EpochPersistenceGuard,
  runtime: AgentWorldRuntime,
  toolName: string,
  toolResult: unknown,
  payloadShape: "mcp_tool_result" | "raw_internal_partial" = "mcp_tool_result",
) {
  if (isMcpResultAlreadyPersisted(toolResult)) return;
  const toolResultRecord = recordValue(toolResult);
  const payload = payloadShape === "raw_internal_partial"
    ? toolResult
    : parseMcpToolResultPayload(toolResult);
  const resultPages = embeddedResultPagesForPersistence(payload);
  const journeyEvents = [...new Map(journeyEventsForPersistence(toolResult)
    .map((event) => [event.eventId, event] as const)).values()];
  const epochEvents = [...new Map(epochEventsForPersistence(toolResult)
    .map((event) => [event.eventId, event] as const)).values()];
  const committedResults = phase6CommittedResultsForPersistence(toolResult);
  const requiresCommandEnvelope = journeyEvents.length > 0
    || resultPages.length > 0
    || committedResults.length > 0;
  if (persistJsonl && requiresCommandEnvelope) {
    const resultPageRevisionSetIdentity = resultPages
      .map(resultPageRevisionIdentity)
      .sort()
      .join(",");
    persistenceGuard.assertHealthy();
    try {
      const commandEnvelope = {
        type: "agent_command_commit",
        version: 1,
        command: toolName,
        commandId: `${toolName}:${journeyEvents[0]?.eventId || epochEvents[0]?.eventId || resultPageRevisionSetIdentity}`,
        journeyEvents,
        epochEvents,
        resultPages,
      };
      for (const committed of committedResults) {
        attachPhase6CommittedResultForPersistence(commandEnvelope, committed);
      }
      await persistJsonl("command-events.jsonl", commandEnvelope);
    } catch (error) {
      throw persistenceGuard.trip(error);
    }
  } else if (!requiresCommandEnvelope) {
    if (epochEvents.length) await persistEpochResult(toolResult);
  }
  if (Array.isArray(toolResultRecord.events) || epochEvents.length) {
    if (toolName !== "obsidian_epoch.create_result_page" && toolName !== "obsidian_epoch.start_journey") return;
  }
  if (toolName === "agent_world.context_package") {
    await persistContextSnapshot(persistJsonl, persistenceGuard, payload);
    return;
  }
  const communityAction = toolName === "agent_world.community_react"
    ? "reaction"
    : toolName === "agent_world.community_comment"
      ? "comment"
      : toolName === "agent_world.community_flag"
        ? "flag"
        : toolName === "agent_world.community_moderate"
          ? "moderation"
          : undefined;
  if (communityAction && persistJsonl) {
    persistenceGuard.assertHealthy();
    try {
      await persistJsonl("community.jsonl", {
        type: "community_state",
        action: communityAction,
        result: payload,
        state: runtime.communityState(),
      });
    } catch (error) {
      throw persistenceGuard.trip(error);
    }
  }
  if (requiresCommandEnvelope) return;
  for (const key of ["verification", "departureVerification", "finalVerification"] as const) {
    await persistEpochResultPage(persistJsonl, recordValue(recordValue(payload)[key]));
  }
  const returnedVerifications = recordValue(payload).returnedJourneyVerifications;
  if (Array.isArray(returnedVerifications)) {
    for (const verification of returnedVerifications) await persistEpochResultPage(persistJsonl, verification);
  }
  if (toolName === "obsidian_epoch.start_journey") return;
  if (
    toolName === "obsidian_epoch.create_result_page"
    || toolName === "obsidian_epoch.revoke_result_page"
    || toolName === "obsidian_epoch.delete_result_page"
  ) {
    await persistEpochResultPage(persistJsonl, payload);
    return;
  }
}

async function persistMcpJsonRpcPayload(
  persistJsonl: typeof appendJsonl | null,
  persistEpochResult: PersistEpochResult,
  persistenceGuard: EpochPersistenceGuard,
  runtime: AgentWorldRuntime,
  requestBody: AnyRecord,
  jsonRpcResult: unknown,
) {
  const resultRecord = recordValue(jsonRpcResult);
  if (requestBody.method !== "tools/call") return;
  const params = recordValue(requestBody.params);
  const toolName = typeof params.name === "string" ? params.name : "";
  if (!toolName || !resultRecord.result) return;
  await persistMcpToolPayload(persistJsonl, persistEpochResult, persistenceGuard, runtime, toolName, resultRecord.result);
}

export function createAgentHttpServer({
  runtime,
  maxBodyBytes = DEFAULT_MAX_BODY_BYTES,
  allowedOrigins = DEFAULT_ALLOWED_ORIGINS,
  persistJsonl = null,
  persistEpochEventBatch = null,
  persistenceGuard: configuredPersistenceGuard,
  mutationCoordinator: configuredMutationCoordinator,
  health,
  consoleAssetBaseUrl,
  canonicalPublicServerBase,
  mcpBearerToken,
  playerMcpAccessTokens,
  playerMcpTokenTtlMs = DEFAULT_PLAYER_MCP_TOKEN_TTL_MS,
  publicRegistrationProtection = PERMISSIVE_PUBLIC_REGISTRATION_PROTECTION,
  publicReleaseEvidenceStore,
  allowLegacyHttpIdentityRegistration = false,
  worldMemorySearch,
  worldKnowledgeSearch,
}: HttpServerOptions) {
  const persistenceGuard = configuredPersistenceGuard || createEpochPersistenceGuard();
  const mutationCoordinator = configuredMutationCoordinator || createEpochMutationCoordinator();
  const epochEventBatchWriter = persistEpochEventBatch || createLegacyEpochEventBatchWriter(persistJsonl);
  const persistEpochResult: PersistEpochResult = (result) =>
    persistEpochEvents(epochEventBatchWriter, persistenceGuard, result);
  const mcpSqlitePath = health?.store?.kind === "sqlite" ? health.store.sqlitePath : undefined;
  const mcpRuntime = createAgentWorldMcpRuntime({
    runtime,
    sqlitePath: mcpSqlitePath,
    recordRejectedCommands: false,
    authoritativeIdentityIssuance: true,
    worldMemorySearch,
    worldKnowledgeSearch,
  });
  const mcpHttpSessions = createMcpHttpSessionRegistry();
  const recoveryCache = createRecoveryHealthCache(
    health?.recovery,
    storeHealth(health?.store, persistJsonl),
    health?.recoveryCache,
  );
  const publicReleaseReadiness = async (packageInfo: {
    readonly sha256: string;
    readonly releaseKeyId: string;
    readonly signingTrust: string;
  }) => {
    let evidence;
    try {
      evidence = publicReleaseEvidenceStore?.read();
    } catch {
      evidence = undefined;
    }
    return evaluatePublicReleaseReadiness({
      health: await serverHealth(
        runtime,
        health,
        persistJsonl,
        persistenceGuard,
        publicRegistrationProtection,
        playerMcpAccessTokens,
        recoveryCache,
        mcpHttpSessions.metricsSnapshot(),
      ),
      package: packageInfo,
      evidence,
    });
  };

  async function handle(request: IncomingMessage, response: ServerResponse) {
    const url = request.url || "/";
    const pathname = new URL(url, "http://127.0.0.1").pathname;
    const method = request.method || "GET";

    if (method === "OPTIONS") {
      sendJson(request, response, 204, {}, allowedOrigins);
      return;
    }
    if (method === "GET" && (pathname === "/api/health" || pathname === "/api/epoch/health")) {
      const readiness = await serverHealth(
        runtime,
        health,
        persistJsonl,
        persistenceGuard,
        publicRegistrationProtection,
        playerMcpAccessTokens,
        recoveryCache,
        mcpHttpSessions.metricsSnapshot(),
      );
      sendJson(
        request,
        response,
        readiness.ok ? 200 : 503,
        readiness,
        allowedOrigins,
      );
      return;
    }
    persistenceGuard.assertHealthy();
    if (await handleEpochMcpRoutes({
      runtime,
      request,
      response,
      method,
      pathname,
      allowedOrigins,
      maxBodyBytes,
      persistEpochEvents: persistEpochResult,
      persistEpochResultPage: (result) => persistEpochResultPage(persistJsonl, result, persistenceGuard),
      readJsonBody,
      sendJson,
      sendHtml,
      queryParams,
      mcpRuntime,
      mcpHttpSessions,
      mcpMutationCoordinator: mutationCoordinator,
      mcpBearerToken,
      playerMcpAccessTokens,
      playerMcpTokenTtlMs,
      publicRegistrationProtection,
      publicServerBase: publicServerBase(request, canonicalPublicServerBase),
      persistMcpJsonRpcPayload: (requestBody, jsonRpcResult) =>
        persistMcpJsonRpcPayload(persistJsonl, persistEpochResult, persistenceGuard, runtime, requestBody, jsonRpcResult),
      persistMcpToolPayload: (toolName, toolResult, payloadShape) =>
        persistMcpToolPayload(persistJsonl, persistEpochResult, persistenceGuard, runtime, toolName, toolResult, payloadShape),
      sendEmpty,
    })) {
      return;
    }
    if (await handleEpochPlayerAccessRoutes({
      runtime,
      request,
      response,
      method,
      pathname,
      allowedOrigins,
      maxBodyBytes,
      persistEpochEvents: persistEpochResult,
      persistEpochResultPage: (result) => persistEpochResultPage(persistJsonl, result),
      readJsonBody,
      sendJson,
      sendHtml,
      queryParams,
      playerMcpAccessTokens,
      playerMcpTokenTtlMs,
      publicServerBase: publicServerBase(request, canonicalPublicServerBase),
      publicRegistrationProtection,
    })) {
      return;
    }
    if (await handleEpochResultRoutes({
      runtime,
      request,
      response,
      method,
      pathname,
      allowedOrigins,
      maxBodyBytes,
      persistEpochEvents: persistEpochResult,
      persistEpochResultPage: (result) => persistEpochResultPage(persistJsonl, result, persistenceGuard),
      readJsonBody,
      sendJson,
      sendHtml,
      queryParams,
    })) {
      return;
    }
    if (await handleEpochIdentityRoutes({
      runtime,
      request,
      response,
      method,
      pathname,
      allowedOrigins,
      maxBodyBytes,
      persistEpochEvents: persistEpochResult,
      persistEpochResultPage: (result) => persistEpochResultPage(persistJsonl, result),
      readJsonBody,
      sendJson,
      sendHtml,
      queryParams,
      allowLegacyHttpIdentityRegistration,
    })) {
      return;
    }
    if (await handleEpochAgentProfileRoutes({
      runtime,
      request,
      response,
      method,
      pathname,
      allowedOrigins,
      maxBodyBytes,
      persistEpochEvents: persistEpochResult,
      persistEpochResultPage: (result) => persistEpochResultPage(persistJsonl, result),
      readJsonBody,
      sendJson,
      sendHtml,
      queryParams,
    })) {
      return;
    }
    if (await handleEpochSocietyRoutes({
      runtime,
      request,
      response,
      method,
      pathname,
      allowedOrigins,
      maxBodyBytes,
      persistEpochEvents: persistEpochResult,
      persistEpochResultPage: (result) => persistEpochResultPage(persistJsonl, result),
      readJsonBody,
      sendJson,
      sendHtml,
      queryParams,
    })) {
      return;
    }
    if (await handleEpochNarrativeRoutes({
      runtime,
      request,
      response,
      method,
      pathname,
      allowedOrigins,
      maxBodyBytes,
      persistEpochEvents: persistEpochResult,
      persistEpochResultPage: (result) => persistEpochResultPage(persistJsonl, result),
      readJsonBody,
      sendJson,
      sendHtml,
      queryParams,
    })) {
      return;
    }
    if (await handleEpochOperatorRoutes({
      runtime,
      request,
      response,
      method,
      pathname,
      allowedOrigins,
      maxBodyBytes,
      persistEpochEvents: persistEpochResult,
      persistEpochResultPage: (result) => persistEpochResultPage(persistJsonl, result),
      readJsonBody,
      sendJson,
      sendHtml,
      queryParams,
      publicReleaseEvidenceStore,
    })) {
      return;
    }
    if (await handleEpochEncounterRoutes({
      runtime,
      request,
      response,
      method,
      pathname,
      allowedOrigins,
      maxBodyBytes,
      persistEpochEvents: persistEpochResult,
      persistEpochResultPage: (result) => persistEpochResultPage(persistJsonl, result),
      readJsonBody,
      sendJson,
      sendHtml,
      queryParams,
    })) {
      return;
    }
    if (await handleEpochEconomyRoutes({
      runtime,
      request,
      response,
      method,
      pathname,
      allowedOrigins,
      maxBodyBytes,
      persistEpochEvents: persistEpochResult,
      persistEpochResultPage: (result) => persistEpochResultPage(persistJsonl, result),
      readJsonBody,
      sendJson,
      sendHtml,
      queryParams,
    })) {
      return;
    }
    if (await handleEpochSeasonRoutes({
      runtime,
      request,
      response,
      method,
      pathname,
      allowedOrigins,
      maxBodyBytes,
      persistEpochEvents: persistEpochResult,
      persistEpochResultPage: (result) => persistEpochResultPage(persistJsonl, result),
      readJsonBody,
      sendJson,
      sendHtml,
      queryParams,
    })) {
      return;
    }
    if (await handleEpochGameplayRoutes({
      runtime,
      request,
      response,
      method,
      pathname,
      allowedOrigins,
      maxBodyBytes,
      persistEpochEvents: persistEpochResult,
      persistEpochResultPage: (result) => persistEpochResultPage(persistJsonl, result),
      readJsonBody,
      sendJson,
      sendHtml,
      queryParams,
    })) {
      return;
    }
    if (await handleEpochHostedRoutes({
      runtime,
      request,
      response,
      method,
      pathname,
      allowedOrigins,
      maxBodyBytes,
      persistEpochEvents: persistEpochResult,
      persistEpochResultPage: (result) => persistEpochResultPage(persistJsonl, result),
      readJsonBody,
      sendJson,
      sendHtml,
      queryParams,
    })) {
      return;
    }
    if (await handleEpochAuditRoutes({
      runtime,
      request,
      response,
      method,
      pathname,
      allowedOrigins,
      maxBodyBytes,
      persistEpochEvents: persistEpochResult,
      persistEpochResultPage: (result) => persistEpochResultPage(persistJsonl, result),
      readJsonBody,
      sendJson,
      sendHtml,
      sendBinary,
      sendJsonDownload,
      sendTextDownload,
      queryParams,
    })) {
      return;
    }
    if (await handleEpochInstallRoutes({
      runtime,
      request,
      response,
      method,
      pathname,
      allowedOrigins,
      maxBodyBytes,
      persistEpochEvents: persistEpochResult,
      persistEpochResultPage: (result) => persistEpochResultPage(persistJsonl, result),
      readJsonBody,
      sendJson,
      sendHtml,
      sendBinary,
      queryParams,
      publicServerBase: publicServerBase(request, canonicalPublicServerBase),
      publicReleaseReadiness,
    })) {
      return;
    }
    if (await handleEpochWorldRoutes({
      runtime,
      request,
      response,
      method,
      pathname,
      allowedOrigins,
      maxBodyBytes,
      persistEpochEvents: persistEpochResult,
      persistEpochResultPage: (result) => persistEpochResultPage(persistJsonl, result),
      readJsonBody,
      sendJson,
      sendHtml,
      queryParams,
    })) {
      return;
    }
    if (await handleEpochAssetRoutes({
      runtime,
      request,
      response,
      method,
      pathname,
      allowedOrigins,
      maxBodyBytes,
      persistEpochEvents: persistEpochResult,
      persistEpochResultPage: (result) => persistEpochResultPage(persistJsonl, result),
      readJsonBody,
      sendJson,
      sendHtml,
      sendBinary,
      queryParams,
      consoleAssetBaseUrl,
    })) {
      return;
    }
    if (await handleLegacyRuntimeRoutes({
      runtime,
      request,
      response,
      method,
      pathname,
      allowedOrigins,
      maxBodyBytes,
      persistEpochEvents: persistEpochResult,
      persistEpochResultPage: (result) => persistEpochResultPage(persistJsonl, result),
      playerMcpAccessTokens,
      persistRunSettlement: (body, settlement) =>
        persistRunSettlement(persistJsonl, persistenceGuard, body, settlement, runtime),
      persistContextSnapshot: (contextPackage) =>
        persistContextSnapshot(persistJsonl, persistenceGuard, contextPackage),
      persistStateSnapshot: (fileName, record) =>
        persistStateSnapshotWithGuard(persistJsonl, persistenceGuard, fileName, record),
      persistOutboxEntries: (entries) => persistOutboxEntries(persistJsonl, persistenceGuard, entries),
      readJsonBody,
      sendJson,
      sendHtml,
      queryParams,
    })) {
      return;
    }

    sendJson(request, response, 404, { error: "not_found" }, allowedOrigins);
  }

  async function handleWithErrorResponse(request: IncomingMessage, response: ServerResponse) {
    try {
      await handle(request, response);
    } catch (error: unknown) {
      let errorResponse = classifyHttpError(error);
      if (!isEpochPersistenceError(error)) {
        try {
          await recordRejectedHttpCommand(request, runtime, persistEpochResult, error, errorResponse.statusCode);
        } catch (auditError) {
          errorResponse = classifyHttpError(auditError);
        }
      }
      for (const [name, value] of Object.entries(errorResponse.headers || {})) {
        response.setHeader(name, value);
      }
      sendJson(request, response, errorResponse.statusCode, errorResponse.body, allowedOrigins);
    }
  }

  const server = http.createServer((request, response) => {
    const run = () => handleWithErrorResponse(request, response);
    const pathname = new URL(request.url || "/", "http://127.0.0.1").pathname;
    const isMcpTransport = pathname === "/mcp" || pathname === "/api/epoch/mcp";
    const task = request.method === "POST" && !isMcpTransport ? mutationCoordinator.run(run) : run();
    void task.catch((error: unknown) => {
      if (response.headersSent) {
        response.destroy(error instanceof Error ? error : new Error(String(error)));
        return;
      }
      sendJson(request, response, 500, { error: "internal_error" }, allowedOrigins);
    });
  });
  mcpHttpSessionRegistries.set(server, mcpHttpSessions);
  // `http.Server.close()` waits for open keep-alive/SSE connections before it
  // emits `close`. Dispose the MCP registry before delegating so callers that
  // close a server directly cannot be held open by an active SSE stream.
  const closeServer = server.close.bind(server);
  server.close = ((callback?: (error?: Error) => void) => {
    disposeAgentHttpServerTransport(server);
    return closeServer(callback);
  }) as typeof server.close;
  server.once("close", () => {
    disposeAgentHttpServerTransport(server);
    mcpHttpSessionRegistries.delete(server);
  });
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 66_000;
  return server;
}
