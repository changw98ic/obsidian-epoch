import { appendJsonl } from "./store.ts";
import { createAgentWorldRuntime } from "./mcpTools.ts";
import { MAX_PARTY_RUN_MEMBERS } from "./epoch/combatSettlementRules.ts";
import { resolveEpochCanonicalRegionId } from "./regionAliases.ts";
import { epochEventsForPersistence } from "./epoch/runtimePublicProjectionRules.ts";
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

type AgentWorldRuntime = ReturnType<typeof createAgentWorldRuntime>;
type PersistJsonl = typeof appendJsonl;
type IntervalHandle = ReturnType<typeof setInterval> | number;

export interface EpochMaintenanceConfig {
  readonly enabled: boolean;
  readonly intervalMs: number;
  readonly npcRegionId?: string;
  readonly npcLimit: number;
  readonly marketMaxAgeSeconds: number;
  readonly marketLimit: number;
  readonly directTradeMaxAgeSeconds?: number;
  readonly directTradeLimit?: number;
  readonly resourceNodeRegionIds: readonly string[];
  readonly resourceNodeLimit: number;
  readonly resourceNodeSettlementLimit?: number;
  readonly anomalyRegionIds?: readonly string[];
  readonly anomalyLimit?: number;
  readonly anomalyTemplateKey?: string;
  readonly seasonRegionIds?: readonly string[];
  readonly seasonLimit?: number;
  readonly seasonKey?: string;
  readonly seasonSettlementLimit?: number;
  readonly partyRunSettlementLimit?: number;
  readonly serverHostedJobLimit?: number;
  readonly regionControlDecayLimit?: number;
  readonly regionControlDecayAmount?: number;
  readonly regionControlDecayMinAgeSeconds?: number;
  readonly abuseDecayLimit?: number;
  readonly abuseDecayAmount?: number;
  readonly runOnStart: boolean;
  readonly operatorKey?: string;
}

export interface EpochMaintenanceTickSummary {
  readonly tickId: string;
  readonly ranAt: string;
  readonly npc: {
    readonly events: number;
  };
  readonly market: {
    readonly events: number;
  };
  readonly resourceNodes: {
    readonly events: number;
    readonly spawned: number;
    readonly settled: number;
    readonly skipped: number;
  };
  readonly anomalies: {
    readonly events: number;
    readonly spawned: number;
    readonly skipped: number;
  };
  readonly seasons: {
    readonly events: number;
    readonly started: number;
    readonly settled: number;
    readonly skipped: number;
  };
  readonly partyRuns?: {
    readonly events: number;
    readonly settled: number;
    readonly skipped: number;
  };
  readonly serverHostedJobs: {
    readonly events: number;
    readonly completed: number;
    readonly skipped: number;
  };
  readonly regionControls: {
    readonly events: number;
    readonly decayed: number;
  };
  readonly abuse: {
    readonly events: number;
    readonly decayed: number;
  };
  readonly persistedEvents: number;
}

export interface EpochMaintenanceSchedulerStatus {
  readonly enabled: boolean;
  readonly intervalMs: number;
  readonly runOnStart: boolean;
  readonly inFlight: boolean;
  readonly lastStartedAt?: string;
  readonly lastFinishedAt?: string;
  readonly lastSuccessAt?: string;
  readonly lastErrorAt?: string;
  readonly lastError?: string;
  readonly lastSummary?: EpochMaintenanceTickSummary;
}

export interface EpochMaintenanceScheduler {
  readonly enabled: boolean;
  readonly stop: () => void;
  readonly drain: () => Promise<void>;
  readonly runOnce: () => Promise<EpochMaintenanceTickSummary>;
  readonly status: () => EpochMaintenanceSchedulerStatus;
}

interface EpochRuntimeEventResult {
  readonly events?: readonly unknown[];
}

interface RunEpochMaintenanceTickOptions {
  readonly runtime: AgentWorldRuntime;
  readonly persistJsonl?: PersistJsonl | null;
  readonly persistEpochEventBatch?: PersistEpochEventBatch | null;
  readonly persistenceGuard?: EpochPersistenceGuard;
  readonly mutationCoordinator?: EpochMutationCoordinator;
  readonly now?: () => Date;
  readonly config?: EpochMaintenanceConfig;
}

interface StartEpochMaintenanceSchedulerOptions extends RunEpochMaintenanceTickOptions {
  readonly setIntervalFn?: (handler: () => void, intervalMs: number) => IntervalHandle;
  readonly clearIntervalFn?: (handle: IntervalHandle) => void;
  readonly onError?: (error: unknown) => void;
}

const DEFAULT_MAINTENANCE_CONFIG: EpochMaintenanceConfig = {
  enabled: false,
  intervalMs: 15 * 60 * 1000,
  npcLimit: 5,
  marketMaxAgeSeconds: 24 * 60 * 60,
  marketLimit: 50,
  directTradeMaxAgeSeconds: 24 * 60 * 60,
  directTradeLimit: 50,
  resourceNodeRegionIds: [],
  resourceNodeLimit: 0,
  resourceNodeSettlementLimit: 0,
  anomalyRegionIds: [],
  anomalyLimit: 0,
  seasonRegionIds: [],
  seasonLimit: 0,
  seasonSettlementLimit: 0,
  partyRunSettlementLimit: 0,
  serverHostedJobLimit: 0,
  regionControlDecayLimit: 0,
  regionControlDecayAmount: 1,
  regionControlDecayMinAgeSeconds: 7 * 24 * 60 * 60,
  abuseDecayLimit: 0,
  abuseDecayAmount: 1,
  runOnStart: false,
};

const RESOURCE_NODE_SKIP_ERRORS = new Set([
  "resource_node_region_open",
  "resource_node_spawn_cooldown_active",
]);
const ANOMALY_SKIP_ERRORS = new Set([
  "anomaly_event_region_open",
]);

function envEnabled(value: unknown) {
  return typeof value === "string" && /^(1|true|yes|on)$/i.test(value.trim());
}

function envPositiveInteger(value: unknown, fallback: number, min: number, max: number) {
  const parsed = typeof value === "string" && value.trim() ? Number(value) : fallback;
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(Math.floor(parsed), max));
}

function envOptionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function envStringList(value: unknown) {
  if (typeof value !== "string") return [];
  return [...new Set(value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean))];
}

function envRegionId(value: unknown) {
  const regionId = envOptionalString(value);
  return regionId ? resolveEpochCanonicalRegionId(regionId) : undefined;
}

function envRegionIdList(value: unknown) {
  return [...new Set(envStringList(value).map(resolveEpochCanonicalRegionId))];
}

function idempotencySegment(value: string) {
  return value.replace(/[^a-zA-Z0-9_.:-]/g, "_");
}

async function persistEpochEvents(
  persistEpochEventBatch: PersistEpochEventBatch | null,
  persistenceGuard: EpochPersistenceGuard,
  result: EpochRuntimeEventResult,
) {
  const events = epochEventsForPersistence(result);
  return persistEpochEventBatchWithGuard(persistEpochEventBatch, persistenceGuard, events);
}

export function epochMaintenanceConfigFromEnv(env: Record<string, string | undefined>): EpochMaintenanceConfig {
  const config: EpochMaintenanceConfig = {
    enabled: envEnabled(env.AGENT_SERVER_MAINTENANCE_ENABLED),
    intervalMs: envPositiveInteger(
      env.AGENT_SERVER_MAINTENANCE_INTERVAL_MS,
      DEFAULT_MAINTENANCE_CONFIG.intervalMs,
      1_000,
      24 * 60 * 60 * 1000,
    ),
    npcRegionId: envRegionId(env.AGENT_SERVER_MAINTENANCE_NPC_REGION_ID),
    npcLimit: envPositiveInteger(env.AGENT_SERVER_MAINTENANCE_NPC_LIMIT, DEFAULT_MAINTENANCE_CONFIG.npcLimit, 1, 100),
    marketMaxAgeSeconds: envPositiveInteger(
      env.AGENT_SERVER_MAINTENANCE_MARKET_MAX_AGE_SECONDS,
      DEFAULT_MAINTENANCE_CONFIG.marketMaxAgeSeconds,
      1,
      30 * 24 * 60 * 60,
    ),
    marketLimit: envPositiveInteger(env.AGENT_SERVER_MAINTENANCE_MARKET_LIMIT, DEFAULT_MAINTENANCE_CONFIG.marketLimit, 1, 500),
    directTradeMaxAgeSeconds: envPositiveInteger(
      env.AGENT_SERVER_MAINTENANCE_DIRECT_TRADE_MAX_AGE_SECONDS,
      DEFAULT_MAINTENANCE_CONFIG.directTradeMaxAgeSeconds || DEFAULT_MAINTENANCE_CONFIG.marketMaxAgeSeconds,
      1,
      30 * 24 * 60 * 60,
    ),
    directTradeLimit: envPositiveInteger(
      env.AGENT_SERVER_MAINTENANCE_DIRECT_TRADE_LIMIT,
      DEFAULT_MAINTENANCE_CONFIG.directTradeLimit || DEFAULT_MAINTENANCE_CONFIG.marketLimit,
      1,
      500,
    ),
    resourceNodeRegionIds: envRegionIdList(env.AGENT_SERVER_MAINTENANCE_RESOURCE_NODE_REGION_IDS),
    resourceNodeLimit: envPositiveInteger(
      env.AGENT_SERVER_MAINTENANCE_RESOURCE_NODE_LIMIT,
      DEFAULT_MAINTENANCE_CONFIG.resourceNodeLimit,
      0,
      100,
    ),
    resourceNodeSettlementLimit: envPositiveInteger(
      env.AGENT_SERVER_MAINTENANCE_RESOURCE_NODE_SETTLEMENT_LIMIT,
      DEFAULT_MAINTENANCE_CONFIG.resourceNodeSettlementLimit || 0,
      0,
      100,
    ),
    anomalyRegionIds: envRegionIdList(env.AGENT_SERVER_MAINTENANCE_ANOMALY_REGION_IDS),
    anomalyLimit: envPositiveInteger(
      env.AGENT_SERVER_MAINTENANCE_ANOMALY_LIMIT,
      DEFAULT_MAINTENANCE_CONFIG.anomalyLimit || 0,
      0,
      100,
    ),
    anomalyTemplateKey: envOptionalString(env.AGENT_SERVER_MAINTENANCE_ANOMALY_TEMPLATE_KEY),
    seasonRegionIds: envRegionIdList(env.AGENT_SERVER_MAINTENANCE_SEASON_REGION_IDS),
    seasonLimit: envPositiveInteger(
      env.AGENT_SERVER_MAINTENANCE_SEASON_LIMIT,
      DEFAULT_MAINTENANCE_CONFIG.seasonLimit || 0,
      0,
      100,
    ),
    seasonKey: envOptionalString(env.AGENT_SERVER_MAINTENANCE_SEASON_KEY),
    seasonSettlementLimit: envPositiveInteger(
      env.AGENT_SERVER_MAINTENANCE_SEASON_SETTLEMENT_LIMIT,
      DEFAULT_MAINTENANCE_CONFIG.seasonSettlementLimit || 0,
      0,
      100,
    ),
    partyRunSettlementLimit: envPositiveInteger(
      env.AGENT_SERVER_MAINTENANCE_PARTY_RUN_SETTLEMENT_LIMIT,
      DEFAULT_MAINTENANCE_CONFIG.partyRunSettlementLimit || 0,
      0,
      100,
    ),
    serverHostedJobLimit: envPositiveInteger(
      env.AGENT_SERVER_MAINTENANCE_SERVER_HOSTED_JOB_LIMIT,
      DEFAULT_MAINTENANCE_CONFIG.serverHostedJobLimit || 0,
      0,
      100,
    ),
    regionControlDecayLimit: envPositiveInteger(
      env.AGENT_SERVER_MAINTENANCE_REGION_CONTROL_DECAY_LIMIT,
      DEFAULT_MAINTENANCE_CONFIG.regionControlDecayLimit || 0,
      0,
      100,
    ),
    regionControlDecayAmount: envPositiveInteger(
      env.AGENT_SERVER_MAINTENANCE_REGION_CONTROL_DECAY_AMOUNT,
      DEFAULT_MAINTENANCE_CONFIG.regionControlDecayAmount || 1,
      1,
      100,
    ),
    regionControlDecayMinAgeSeconds: envPositiveInteger(
      env.AGENT_SERVER_MAINTENANCE_REGION_CONTROL_DECAY_MIN_AGE_SECONDS,
      DEFAULT_MAINTENANCE_CONFIG.regionControlDecayMinAgeSeconds || (7 * 24 * 60 * 60),
      0,
      365 * 24 * 60 * 60,
    ),
    abuseDecayLimit: envPositiveInteger(
      env.AGENT_SERVER_MAINTENANCE_ABUSE_DECAY_LIMIT,
      DEFAULT_MAINTENANCE_CONFIG.abuseDecayLimit || 0,
      0,
      100,
    ),
    abuseDecayAmount: envPositiveInteger(
      env.AGENT_SERVER_MAINTENANCE_ABUSE_DECAY_AMOUNT,
      DEFAULT_MAINTENANCE_CONFIG.abuseDecayAmount || 1,
      1,
      10,
    ),
    runOnStart: envEnabled(env.AGENT_SERVER_MAINTENANCE_RUN_ON_START),
    operatorKey: envOptionalString(env.AGENT_SERVER_OPERATOR_KEY),
  };

  if (env.NODE_ENV === "production") {
    if (!config.enabled) {
      throw new Error("AGENT_SERVER_MAINTENANCE_ENABLED must be enabled when NODE_ENV=production");
    }
    if (!config.operatorKey) {
      throw new Error("AGENT_SERVER_OPERATOR_KEY must be set for production world maintenance");
    }
  }

  return config;
}

async function runEpochMaintenanceTickUnlocked({
  runtime,
  persistJsonl = null,
  persistEpochEventBatch = null,
  persistenceGuard: configuredPersistenceGuard,
  now = () => new Date(),
  config = DEFAULT_MAINTENANCE_CONFIG,
}: RunEpochMaintenanceTickOptions): Promise<EpochMaintenanceTickSummary> {
  const persistenceGuard = configuredPersistenceGuard || createEpochPersistenceGuard();
  const epochEventBatchWriter = persistEpochEventBatch || createLegacyEpochEventBatchWriter(persistJsonl);
  const persistResult = (result: EpochRuntimeEventResult) =>
    persistEpochEvents(epochEventBatchWriter, persistenceGuard, result);
  persistenceGuard.assertHealthy();
  const ranAt = now().toISOString();
  const tickId = idempotencySegment(ranAt);
  const npc = runtime.epochTickNpcLifecycle({
    operatorKey: config.operatorKey,
    regionId: config.npcRegionId,
    limit: config.npcLimit,
    idempotencyKey: `maintenance:${tickId}:npc`,
  });
  const npcPersistedEvents = await persistResult(npc);
  const market = runtime.epochTickMarketExpiry({
    operatorKey: config.operatorKey,
    maxAgeSeconds: config.marketMaxAgeSeconds,
    limit: config.marketLimit,
    idempotencyKey: `maintenance:${tickId}:market`,
  });
  const marketPersistedEvents = await persistResult(market);
  const directTradeExpiry = runtime.epochTickDirectTradeExpiry({
    operatorKey: config.operatorKey,
    maxAgeSeconds: config.directTradeMaxAgeSeconds || config.marketMaxAgeSeconds,
    limit: config.directTradeLimit || config.marketLimit,
    idempotencyKey: `maintenance:${tickId}:direct-trade`,
  });
  const directTradePersistedEvents = await persistResult(directTradeExpiry);
  const resourceNodeRegionIds = (config.resourceNodeRegionIds || []).slice(0, config.resourceNodeLimit || 0);
  let resourceNodeEvents = 0;
  let resourceNodeSpawned = 0;
  let resourceNodeSettled = 0;
  let resourceNodeSkipped = 0;
  let resourceNodePersistedEvents = 0;
  const resourceNodeSettlementLimit = config.resourceNodeSettlementLimit || 0;
  const contestedResourceNodes = runtime.epochResourceNodes({})
    .nodes
    .filter((node: { status?: string; totalScore?: number }) =>
      node.status === "open" && Number(node.totalScore || 0) > 0)
    .sort((left: { spawnedAt?: string; nodeId: string }, right: { spawnedAt?: string; nodeId: string }) =>
      String(left.spawnedAt || "").localeCompare(String(right.spawnedAt || "")) || left.nodeId.localeCompare(right.nodeId))
    .slice(0, resourceNodeSettlementLimit);
  for (const node of contestedResourceNodes) {
    const result = runtime.epochSettleResourceNode({
      operatorKey: config.operatorKey,
      nodeId: node.nodeId,
      idempotencyKey: `maintenance:${tickId}:resource-node-settle:${idempotencySegment(node.nodeId)}`,
    });
    resourceNodeEvents += result.events.length;
    if (result.events.some((event: { eventType?: unknown }) => event.eventType === "resource_node_settled")) {
      resourceNodeSettled += 1;
    }
    resourceNodePersistedEvents += await persistResult(result);
  }
  for (const regionId of resourceNodeRegionIds) {
    try {
      const result = runtime.epochSpawnResourceNode({
        operatorKey: config.operatorKey,
        regionId,
        title: "区域灵质露点",
        description: "服务器维护巡检发现的短周期区域资源点，争夺和奖励都按服务器事件结算。",
        resourceId: "aether",
        rewardAmount: 2,
        rewardReason: `maintenance_resource_node:${regionId}`,
        idempotencyKey: `maintenance:${tickId}:resource-node:${idempotencySegment(regionId)}`,
      });
      resourceNodeEvents += result.events.length;
      if (result.events.length > 0) resourceNodeSpawned += 1;
      resourceNodePersistedEvents += await persistResult(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!RESOURCE_NODE_SKIP_ERRORS.has(message)) throw error;
      resourceNodeSkipped += 1;
    }
  }
  const anomalyRegionIds = (config.anomalyRegionIds || []).slice(0, config.anomalyLimit || 0);
  let anomalyEvents = 0;
  let anomalySpawned = 0;
  let anomalySkipped = 0;
  let anomalyPersistedEvents = 0;
  for (const regionId of anomalyRegionIds) {
    try {
      const result = runtime.epochSpawnAnomaly({
        operatorKey: config.operatorKey,
        regionId,
        templateKey: config.anomalyTemplateKey,
        anomalyTemplateRotationSeed: `${tickId}:${regionId}`,
        idempotencyKey: `maintenance:${tickId}:anomaly:${idempotencySegment(regionId)}`,
      });
      anomalyEvents += result.events.length;
      if (result.events.some((event: { eventType?: unknown }) => event.eventType === "anomaly_event_spawned")) {
        anomalySpawned += 1;
      }
      anomalyPersistedEvents += await persistResult(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!ANOMALY_SKIP_ERRORS.has(message)) throw error;
      anomalySkipped += 1;
    }
  }
  const seasonRegionIds = (config.seasonRegionIds || []).slice(0, config.seasonLimit || 0);
  let seasonEvents = 0;
  let seasonStarted = 0;
  let seasonSettled = 0;
  let seasonSkipped = 0;
  let seasonPersistedEvents = 0;
  for (const season of runtime.epochSeasons({}).seasons
    .filter((season: { status?: string; totalScore?: number; targetScore?: number }) =>
      season.status === "active" && Number(season.totalScore || 0) >= Number(season.targetScore || 0))
    .sort((left: { createdAt?: string; seasonId: string }, right: { createdAt?: string; seasonId: string }) =>
      String(left.createdAt || "").localeCompare(String(right.createdAt || "")) || left.seasonId.localeCompare(right.seasonId))
    .slice(0, config.seasonSettlementLimit || 0)) {
    const result = runtime.epochSettleSeason({
      operatorKey: config.operatorKey,
      seasonId: season.seasonId,
      idempotencyKey: `maintenance:${tickId}:season-settle:${idempotencySegment(season.seasonId)}`,
    });
    seasonEvents += result.events.length;
    if (result.events.some((event: { eventType?: unknown }) => event.eventType === "season_campaign_resolved")) {
      seasonSettled += 1;
    }
    seasonPersistedEvents += await persistResult(result);
  }
  for (const regionId of seasonRegionIds) {
    const regionSeasons = runtime.epochSeasons({ regionId }).seasons;
    if (regionSeasons.some((season: { status?: string }) => season.status === "active")) {
      seasonSkipped += 1;
      continue;
    }
    const seasonKey = config.seasonKey || "gray_harbor_faction_season";
    const result = runtime.epochSeedSeason({
      operatorKey: config.operatorKey,
      regionId,
      seasonKey,
      seasonInstanceKey: `${seasonKey}:${regionId}:${tickId}`,
      idempotencyKey: `maintenance:${tickId}:season:${idempotencySegment(regionId)}`,
    });
    seasonEvents += result.events.length;
    if (result.events.some((event: { eventType?: unknown }) => event.eventType === "season_campaign_created")) {
      seasonStarted += 1;
    } else {
      seasonSkipped += 1;
    }
    seasonPersistedEvents += await persistResult(result);
  }

  let partyRunEvents = 0;
  let partyRunsSettled = 0;
  let partyRunsSkipped = 0;
  let partyRunPersistedEvents = 0;
  const partyRunSettlementLimit = config.partyRunSettlementLimit || 0;
  const maturePartyRuns = runtime.epochPartyRuns({ status: "open" })
    .partyRuns
    .filter((partyRun: { members?: readonly unknown[] }) =>
      (partyRun.members || []).length >= MAX_PARTY_RUN_MEMBERS)
    .sort((left: { createdAt?: string; partyRunId: string }, right: { createdAt?: string; partyRunId: string }) =>
      String(left.createdAt || "").localeCompare(String(right.createdAt || ""))
        || left.partyRunId.localeCompare(right.partyRunId))
    .slice(0, partyRunSettlementLimit);
  for (const partyRun of maturePartyRuns) {
    const result = runtime.epochSettlePartyRun({
      operatorKey: config.operatorKey,
      partyRunId: partyRun.partyRunId,
      idempotencyKey: `maintenance:${tickId}:party-run-settle:${idempotencySegment(partyRun.partyRunId)}`,
    });
    partyRunEvents += result.events.length;
    if (result.events.some((event: { eventType?: unknown }) => event.eventType === "party_run_settled")) {
      partyRunsSettled += 1;
    } else {
      partyRunsSkipped += 1;
    }
    partyRunPersistedEvents += await persistResult(result);
  }

  let serverHostedJobEvents = 0;
  let serverHostedJobsCompleted = 0;
  let serverHostedJobsSkipped = 0;
  let serverHostedJobPersistedEvents = 0;
  const serverHostedJobLimit = config.serverHostedJobLimit || 0;
  for (let index = 0; index < serverHostedJobLimit; index += 1) {
    const job = runtime.epochServerHostedJobs({
      operatorKey: config.operatorKey,
      status: "queued",
    }).jobs[0];
    if (!job) break;
    const result = runtime.epochRunServerHostedJob({
      operatorKey: config.operatorKey,
      jobId: job.jobId,
      idempotencyKey: `maintenance:${tickId}:server-hosted-job:${idempotencySegment(job.jobId)}`,
    });
    serverHostedJobEvents += result.events.length;
    if (result.events.some((event: { eventType?: unknown }) => event.eventType === "server_hosted_job_completed")) {
      serverHostedJobsCompleted += 1;
    } else {
      serverHostedJobsSkipped += 1;
    }
    serverHostedJobPersistedEvents += await persistResult(result);
  }

  const regionControlDecayLimit = config.regionControlDecayLimit || 0;
  const regionControlDecay = regionControlDecayLimit > 0
    ? runtime.epochDecayRegionControls({
      operatorKey: config.operatorKey,
      limit: regionControlDecayLimit,
      amount: config.regionControlDecayAmount || 1,
      minAgeSeconds: config.regionControlDecayMinAgeSeconds ?? (7 * 24 * 60 * 60),
      idempotencyKey: `maintenance:${tickId}:region-control-decay`,
    })
    : { events: [], value: [] };
  const regionControlPersistedEvents = await persistResult(regionControlDecay);

  const abuseDecayLimit = config.abuseDecayLimit || 0;
  const abuseDecay = abuseDecayLimit > 0
    ? runtime.epochDecayAbuseScores({
      operatorKey: config.operatorKey,
      limit: abuseDecayLimit,
      amount: config.abuseDecayAmount || 1,
      idempotencyKey: `maintenance:${tickId}:abuse-decay`,
    })
    : { events: [], value: [] };
  const abusePersistedEvents = await persistResult(abuseDecay);

  const persistedEvents = npcPersistedEvents
    + marketPersistedEvents
    + directTradePersistedEvents
    + resourceNodePersistedEvents
    + anomalyPersistedEvents
    + seasonPersistedEvents
    + partyRunPersistedEvents
    + serverHostedJobPersistedEvents
    + regionControlPersistedEvents
    + abusePersistedEvents;

  return {
    tickId,
    ranAt,
    npc: {
      events: npc.events.length,
    },
    market: {
      events: market.events.length + directTradeExpiry.events.length,
    },
    resourceNodes: {
      events: resourceNodeEvents,
      spawned: resourceNodeSpawned,
      settled: resourceNodeSettled,
      skipped: resourceNodeSkipped,
    },
    anomalies: {
      events: anomalyEvents,
      spawned: anomalySpawned,
      skipped: anomalySkipped,
    },
    seasons: {
      events: seasonEvents,
      started: seasonStarted,
      settled: seasonSettled,
      skipped: seasonSkipped,
    },
    partyRuns: {
      events: partyRunEvents,
      settled: partyRunsSettled,
      skipped: partyRunsSkipped,
    },
    serverHostedJobs: {
      events: serverHostedJobEvents,
      completed: serverHostedJobsCompleted,
      skipped: serverHostedJobsSkipped,
    },
    regionControls: {
      events: regionControlDecay.events.length,
      decayed: regionControlDecay.value.length,
    },
    abuse: {
      events: abuseDecay.events.length,
      decayed: abuseDecay.value.length,
    },
    persistedEvents,
  };
}

export function runEpochMaintenanceTick(
  options: RunEpochMaintenanceTickOptions,
): Promise<EpochMaintenanceTickSummary> {
  const mutationCoordinator = options.mutationCoordinator || createEpochMutationCoordinator();
  return mutationCoordinator.run(() => runEpochMaintenanceTickUnlocked(options));
}

export function startEpochMaintenanceScheduler({
  runtime,
  persistJsonl = null,
  persistEpochEventBatch = null,
  persistenceGuard: configuredPersistenceGuard,
  mutationCoordinator: configuredMutationCoordinator,
  now,
  config = DEFAULT_MAINTENANCE_CONFIG,
  setIntervalFn = setInterval,
  clearIntervalFn = clearInterval,
  onError,
}: StartEpochMaintenanceSchedulerOptions): EpochMaintenanceScheduler {
  const persistenceGuard = configuredPersistenceGuard || createEpochPersistenceGuard();
  const mutationCoordinator = configuredMutationCoordinator || createEpochMutationCoordinator();
  const epochEventBatchWriter = persistEpochEventBatch || createLegacyEpochEventBatchWriter(persistJsonl);
  const nowFn = now || (() => new Date());
  let inFlight: Promise<EpochMaintenanceTickSummary> | null = null;
  let handle: IntervalHandle | undefined;
  let stopped = false;
  let lastStartedAt: string | undefined;
  let lastFinishedAt: string | undefined;
  let lastSuccessAt: string | undefined;
  let lastErrorAt: string | undefined;
  let lastError: string | undefined;
  let lastSummary: EpochMaintenanceTickSummary | undefined;

  const status = (): EpochMaintenanceSchedulerStatus => ({
    enabled: config.enabled,
    intervalMs: config.intervalMs,
    runOnStart: config.runOnStart,
    inFlight: Boolean(inFlight),
    lastStartedAt,
    lastFinishedAt,
    lastSuccessAt,
    lastErrorAt,
    lastError,
    lastSummary,
  });

  const stop = () => {
    if (stopped) return;
    stopped = true;
    if (handle !== undefined) clearIntervalFn(handle);
  };

  const drain = async () => {
    if (inFlight) await inFlight;
  };

  const runOnce = async () => {
    if (inFlight) return inFlight;
    persistenceGuard.assertHealthy();
    lastStartedAt = nowFn().toISOString();
    inFlight = runEpochMaintenanceTick({
      runtime,
      persistEpochEventBatch: epochEventBatchWriter,
      persistenceGuard,
      mutationCoordinator,
      now: nowFn,
      config,
    })
      .then((summary) => {
        lastFinishedAt = nowFn().toISOString();
        lastSuccessAt = lastFinishedAt;
        lastErrorAt = undefined;
        lastError = undefined;
        lastSummary = summary;
        return summary;
      })
      .catch((error: unknown) => {
        lastFinishedAt = nowFn().toISOString();
        lastErrorAt = lastFinishedAt;
        lastError = error instanceof Error ? error.message : String(error);
        if (isEpochPersistenceError(error)) stop();
        onError?.(error);
        throw error;
      })
      .finally(() => {
        inFlight = null;
      });
    return inFlight;
  };

  if (!config.enabled) {
    return {
      enabled: false,
      stop,
      drain,
      runOnce,
      status,
    };
  }

  handle = setIntervalFn(() => {
    void runOnce().catch(() => undefined);
  }, config.intervalMs);

  if (config.runOnStart) void runOnce().catch(() => undefined);

  return {
    enabled: true,
    stop,
    drain,
    runOnce,
    status,
  };
}
