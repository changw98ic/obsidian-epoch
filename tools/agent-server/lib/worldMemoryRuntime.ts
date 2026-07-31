import { createHash } from "node:crypto";
import { closeSync, constants, fstatSync, openSync, readFileSync } from "node:fs";
import { Qwen3EmbeddingClient, QwenEmbeddingError } from "./qwenEmbeddingClient.ts";
import type { WorldContentRegistry } from "./epoch/worldContentRegistry.ts";
import {
  claimWorldKnowledgeChunks,
  completeWorldKnowledgeChunkEmbeddings,
  failWorldKnowledgeChunkEmbeddings,
  searchWorldKnowledge,
  synchronizeWorldKnowledgeRegistry,
  worldKnowledgeIndexStatus,
  type WorldKnowledgeCollection,
  type WorldKnowledgeSearchResult,
} from "./worldKnowledgeIndex.ts";
import {
  claimWorldMemoryChunks,
  completeWorldMemoryChunkEmbeddings,
  createWorldMemoryEmbeddingProfile,
  failWorldMemoryChunkEmbeddings,
  searchWorldMemory,
  synchronizeWorldMemoryFromResultPages,
  WORLD_MEMORY_EMBEDDING_DIMENSION,
  WORLD_MEMORY_EMBEDDING_MODEL,
  validateWorldMemoryEmbeddingProfile,
  worldMemoryProjectionNeedsSync,
  worldMemoryIndexStatus,
  type WorldMemoryEmbeddingProfile,
  type WorldMemorySearchResult,
} from "./worldMemoryIndex.ts";

type EnvLike = Readonly<Record<string, string | undefined>>;
type JsonRecord = Record<string, unknown>;

const DEFAULT_INTERVAL_MS = 15_000;
const DEFAULT_BATCH_SIZE = 8;
const DEFAULT_BATCHES_PER_TICK = 4;
const DEFAULT_VERIFICATION_INTERVAL_MS = 60 * 60_000;
const DEFAULT_QUERY_CACHE_TTL_MS = 15 * 60_000;
const DEFAULT_QUERY_CACHE_MAX_ENTRIES = 128;

export interface WorldMemoryRuntimeConfig {
  readonly dbPath: string;
  readonly embeddingBaseUrl?: string;
  readonly embeddingApiKey?: string;
  readonly embeddingModel: string;
  readonly embeddingDimension: typeof WORLD_MEMORY_EMBEDDING_DIMENSION;
  readonly intervalMs: number;
  readonly batchSize: number;
  readonly batchesPerTick: number;
  readonly requestTimeoutMs: number;
  readonly verificationIntervalMs: number;
  readonly queryCacheTtlMs: number;
  readonly queryCacheMaxEntries: number;
}

export interface WorldMemoryRuntimeStatus {
  readonly enabled: boolean;
  readonly semanticEnabled: boolean;
  readonly semanticErrorCode?: string;
  readonly inFlight: boolean;
  readonly model: string;
  readonly endpointModel: string;
  readonly dimension: typeof WORLD_MEMORY_EMBEDDING_DIMENSION;
  readonly lastAttemptAt?: string;
  readonly lastSuccessAt?: string;
  readonly lastErrorAt?: string;
  readonly lastErrorCode?: string;
  readonly chunks: number;
  readonly pending: number;
  readonly processing: number;
  readonly ready: number;
  readonly failed: number;
  readonly embeddingIdentityVerifiedAt?: string;
  readonly queryEmbeddingCacheEntries: number;
  readonly knowledge: {
    readonly sources: number;
    readonly chunks: number;
    readonly pending: number;
    readonly processing: number;
    readonly ready: number;
    readonly failed: number;
    readonly registrySourceHash?: string;
  };
}

export interface WorldMemoryRuntime {
  readonly start: () => void;
  readonly stop: () => void;
  readonly drain: () => Promise<void>;
  readonly runOnce: () => Promise<void>;
  readonly search: (input?: JsonRecord) => Promise<WorldMemorySearchResult & {
    readonly semanticUnavailable?: true;
    readonly semanticErrorCode?: string;
  }>;
  readonly searchKnowledge: (input?: JsonRecord) => Promise<WorldKnowledgeSearchResult & {
    readonly semanticUnavailable?: true;
    readonly semanticErrorCode?: string;
  }>;
  readonly status: () => WorldMemoryRuntimeStatus;
}

function enabled(value: string | undefined, fallback: boolean) {
  if (value === undefined || value.trim() === "") return fallback;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

function boundedInteger(value: string | undefined, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback;
}

function embeddingApiKeyFromEnv(env: EnvLike) {
  const direct = env.AGENT_SERVER_EMBEDDING_API_KEY?.trim() || undefined;
  const filePath = env.AGENT_SERVER_EMBEDDING_API_KEY_FILE?.trim() || undefined;
  if (direct && filePath) throw new Error("world_memory_embedding_api_key_source_conflict");
  if (!filePath) return direct;
  let fileDescriptor: number;
  try {
    fileDescriptor = openSync(filePath, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
  } catch (error) {
    throw new Error("world_memory_embedding_api_key_file_invalid", { cause: error });
  }
  try {
    const fileStat = fstatSync(fileDescriptor);
    if (!fileStat.isFile()) throw new Error("world_memory_embedding_api_key_file_type_invalid");
    const managedContainerSecret = filePath.startsWith("/run/secrets/");
    const unsafePermissions = managedContainerSecret
      ? (fileStat.mode & 0o022) !== 0
      : (fileStat.mode & 0o077) !== 0;
    if (unsafePermissions) {
      throw new Error("world_memory_embedding_api_key_file_permissions_invalid");
    }
    return readFileSync(fileDescriptor, "utf8").trim() || undefined;
  } finally {
    closeSync(fileDescriptor);
  }
}

export function worldMemoryRuntimeConfigFromEnv(
  dbPath: string,
  env: EnvLike = process.env,
): WorldMemoryRuntimeConfig {
  const baseUrl = env.AGENT_SERVER_EMBEDDING_BASE_URL?.trim() || undefined;
  const semanticEnabled = enabled(env.AGENT_SERVER_WORLD_MEMORY_ENABLED, Boolean(baseUrl));
  const embeddingApiKey = semanticEnabled && baseUrl ? embeddingApiKeyFromEnv(env) : undefined;
  return {
    dbPath,
    ...(semanticEnabled && baseUrl ? { embeddingBaseUrl: baseUrl } : {}),
    ...(embeddingApiKey ? { embeddingApiKey } : {}),
    embeddingModel: env.AGENT_SERVER_EMBEDDING_MODEL?.trim() || "text-embedding-qwen3-embedding-8b",
    embeddingDimension: WORLD_MEMORY_EMBEDDING_DIMENSION,
    intervalMs: boundedInteger(env.AGENT_SERVER_WORLD_MEMORY_INTERVAL_MS, DEFAULT_INTERVAL_MS, 1_000, 300_000),
    batchSize: boundedInteger(env.AGENT_SERVER_WORLD_MEMORY_BATCH_SIZE, DEFAULT_BATCH_SIZE, 1, 64),
    batchesPerTick: boundedInteger(
      env.AGENT_SERVER_WORLD_MEMORY_BATCHES_PER_TICK,
      DEFAULT_BATCHES_PER_TICK,
      1,
      32,
    ),
    requestTimeoutMs: boundedInteger(env.AGENT_SERVER_EMBEDDING_TIMEOUT_MS, 30_000, 1_000, 300_000),
    verificationIntervalMs: boundedInteger(
      env.AGENT_SERVER_EMBEDDING_VERIFICATION_INTERVAL_MS,
      DEFAULT_VERIFICATION_INTERVAL_MS,
      60_000,
      24 * 60 * 60_000,
    ),
    queryCacheTtlMs: boundedInteger(
      env.AGENT_SERVER_EMBEDDING_QUERY_CACHE_TTL_MS,
      DEFAULT_QUERY_CACHE_TTL_MS,
      0,
      60 * 60_000,
    ),
    queryCacheMaxEntries: boundedInteger(
      env.AGENT_SERVER_EMBEDDING_QUERY_CACHE_MAX_ENTRIES,
      DEFAULT_QUERY_CACHE_MAX_ENTRIES,
      0,
      4096,
    ),
  };
}

function safeErrorCode(error: unknown) {
  if (error instanceof QwenEmbeddingError) return error.code.slice(0, 160);
  if (error instanceof Error && /^[a-z0-9_:-]+$/iu.test(error.message)) return error.message.slice(0, 160);
  return "world_memory_embedding_failed";
}

function noReadyVectorsErrorCode(
  scope: "world_memory" | "world_knowledge",
  status: { readonly pending: number; readonly processing: number; readonly failed: number },
  lastErrorCode: string | undefined,
) {
  if (lastErrorCode) return lastErrorCode;
  if (status.failed > 0) return `${scope}_embedding_failed`;
  if (status.pending > 0 || status.processing > 0) return `${scope}_embeddings_pending`;
  return `${scope}_embeddings_unavailable`;
}

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

interface VerifiedEmbeddingIdentity {
  readonly profile: WorldMemoryEmbeddingProfile;
  readonly behaviorEmbeddings: readonly (readonly number[])[];
  readonly verifiedAt: string;
  readonly verifiedAtMs: number;
}

interface CachedQueryEmbedding {
  readonly embedding: readonly number[];
  readonly expiresAtMs: number;
}

function queryEmbeddingCacheKey(query: string) {
  return createHash("sha256").update(query, "utf8").digest("base64url");
}

export function createWorldMemoryRuntime(
  config: WorldMemoryRuntimeConfig,
  options: {
    readonly client?: Qwen3EmbeddingClient;
    readonly worldContentRegistry?: WorldContentRegistry;
  } = {},
): WorldMemoryRuntime {
  const client = options.client || (config.embeddingBaseUrl
    ? new Qwen3EmbeddingClient({
        baseUrl: config.embeddingBaseUrl,
        apiKey: config.embeddingApiKey,
        model: config.embeddingModel,
        expectedDimensions: config.embeddingDimension,
        requestTimeoutMs: config.requestTimeoutMs,
      })
    : undefined);
  let timer: NodeJS.Timeout | undefined;
  let active: Promise<void> | undefined;
  let lastAttemptAt: string | undefined;
  let lastSuccessAt: string | undefined;
  let lastErrorAt: string | undefined;
  let lastErrorCode: string | undefined;
  let synchronizationInitialized = false;
  let knowledgeSynchronizationHash: string | undefined;
  let verifiedEmbeddingIdentity: VerifiedEmbeddingIdentity | undefined;
  let identityVerificationInFlight: Promise<VerifiedEmbeddingIdentity> | undefined;
  const queryEmbeddingCache = new Map<string, CachedQueryEmbedding>();
  const queryEmbeddingInFlight = new Map<string, Promise<readonly number[]>>();

  const invalidateEmbeddingIdentityIfNeeded = (error: unknown) => {
    const code = safeErrorCode(error);
    if (code.startsWith("world_memory_embedding_profile_")
      || code === "world_memory_stored_vector_contract_mismatch"
      || code === "qwen_embedding_response_invalid"
      || code.startsWith("qwen_embedding_dimension_mismatch:")) {
      verifiedEmbeddingIdentity = undefined;
      queryEmbeddingCache.clear();
    }
  };

  const synchronizeIfNeeded = () => {
    if (synchronizationInitialized && !worldMemoryProjectionNeedsSync(config.dbPath)) return;
    synchronizeWorldMemoryFromResultPages(config.dbPath);
    synchronizationInitialized = true;
  };

  const synchronizeKnowledgeIfNeeded = () => {
    const registry = options.worldContentRegistry;
    if (!registry || knowledgeSynchronizationHash === registry.sourceHash) return;
    synchronizeWorldKnowledgeRegistry(config.dbPath, registry);
    knowledgeSynchronizationHash = registry.sourceHash;
  };

  const ensureEmbeddingIdentity = async () => {
    if (!client) throw new QwenEmbeddingError("qwen_embedding_client_unavailable");
    const now = Date.now();
    if (verifiedEmbeddingIdentity
      && now - verifiedEmbeddingIdentity.verifiedAtMs < config.verificationIntervalMs) {
      return verifiedEmbeddingIdentity;
    }
    if (identityVerificationInFlight) return identityVerificationInFlight;
    let current: Promise<VerifiedEmbeddingIdentity>;
    current = (async () => {
      const behavior = await client.verifyBehavior();
      const expectedProfile = createWorldMemoryEmbeddingProfile({
        model: WORLD_MEMORY_EMBEDDING_MODEL,
        modelDigest: behavior.behaviorFingerprint,
      });
      const profile = validateWorldMemoryEmbeddingProfile(
        config.dbPath,
        expectedProfile,
        behavior.behaviorEmbeddings,
      );
      const verifiedAtMs = Date.now();
      const identity = {
        profile,
        behaviorEmbeddings: behavior.behaviorEmbeddings,
        verifiedAt: new Date(verifiedAtMs).toISOString(),
        verifiedAtMs,
      } satisfies VerifiedEmbeddingIdentity;
      verifiedEmbeddingIdentity = identity;
      return identity;
    })().catch((error: unknown) => {
      verifiedEmbeddingIdentity = undefined;
      queryEmbeddingCache.clear();
      throw error;
    }).finally(() => {
      if (identityVerificationInFlight === current) identityVerificationInFlight = undefined;
    });
    identityVerificationInFlight = current;
    return current;
  };

  const storeQueryEmbedding = (key: string, embedding: readonly number[]) => {
    if (config.queryCacheTtlMs <= 0 || config.queryCacheMaxEntries <= 0) return;
    const now = Date.now();
    for (const [cachedKey, cached] of queryEmbeddingCache) {
      if (cached.expiresAtMs <= now) queryEmbeddingCache.delete(cachedKey);
    }
    queryEmbeddingCache.delete(key);
    queryEmbeddingCache.set(key, { embedding, expiresAtMs: now + config.queryCacheTtlMs });
    while (queryEmbeddingCache.size > config.queryCacheMaxEntries) {
      const oldestKey = queryEmbeddingCache.keys().next().value as string | undefined;
      if (!oldestKey) break;
      queryEmbeddingCache.delete(oldestKey);
    }
  };

  const embedQuery = async (query: string) => {
    if (!client) throw new QwenEmbeddingError("qwen_embedding_client_unavailable");
    const identity = await ensureEmbeddingIdentity();
    const key = queryEmbeddingCacheKey(query);
    const cached = queryEmbeddingCache.get(key);
    const now = Date.now();
    if (cached && cached.expiresAtMs > now) {
      queryEmbeddingCache.delete(key);
      queryEmbeddingCache.set(key, cached);
      return { embedding: cached.embedding, identity };
    }
    if (cached) queryEmbeddingCache.delete(key);
    let pending = queryEmbeddingInFlight.get(key);
    if (!pending) {
      pending = client.embedAll([query]).then((embeddings) => {
        const embedding = embeddings[0];
        if (!embedding) throw new QwenEmbeddingError("qwen_embedding_count_mismatch");
        storeQueryEmbedding(key, embedding);
        return embedding;
      }).finally(() => {
        queryEmbeddingInFlight.delete(key);
      });
      queryEmbeddingInFlight.set(key, pending);
    }
    return { embedding: await pending, identity };
  };

  const runBatch = async () => {
    if (!client) return 0;
    const claims = claimWorldMemoryChunks(config.dbPath, config.batchSize);
    if (claims.length === 0) return 0;
    try {
      const identity = await ensureEmbeddingIdentity();
      const embeddings = await client.embedAll(claims.map((claim) => claim.content));
      completeWorldMemoryChunkEmbeddings(
        config.dbPath,
        claims,
        embeddings,
        identity.profile,
        identity.behaviorEmbeddings,
      );
      return claims.length;
    } catch (error) {
      invalidateEmbeddingIdentityIfNeeded(error);
      const code = safeErrorCode(error);
      failWorldMemoryChunkEmbeddings(config.dbPath, claims, code);
      throw error;
    }
  };

  const runKnowledgeBatch = async () => {
    if (!client || !options.worldContentRegistry) return 0;
    const claims = claimWorldKnowledgeChunks(config.dbPath, config.batchSize);
    if (claims.length === 0) return 0;
    try {
      const identity = await ensureEmbeddingIdentity();
      const embeddings = await client.embedAll(claims.map((claim) => claim.content));
      completeWorldKnowledgeChunkEmbeddings(
        config.dbPath,
        claims,
        embeddings,
        identity.profile,
        identity.behaviorEmbeddings,
      );
      return claims.length;
    } catch (error) {
      invalidateEmbeddingIdentityIfNeeded(error);
      const code = safeErrorCode(error);
      failWorldKnowledgeChunkEmbeddings(config.dbPath, claims, code);
      throw error;
    }
  };

  const runOnce = () => {
    if (active) return active;
    lastAttemptAt = new Date().toISOString();
    let current: Promise<void>;
    current = (async () => {
      synchronizeIfNeeded();
      synchronizeKnowledgeIfNeeded();
      for (let batch = 0; batch < config.batchesPerTick; batch += 1) {
        const storyCount = await runBatch();
        const knowledgeCount = await runKnowledgeBatch();
        if (storyCount === 0 && knowledgeCount === 0) break;
      }
      if (client) await ensureEmbeddingIdentity();
      lastSuccessAt = new Date().toISOString();
      lastErrorCode = undefined;
    })().catch((error: unknown) => {
      lastErrorAt = new Date().toISOString();
      lastErrorCode = safeErrorCode(error);
      throw error;
    }).finally(() => {
      if (active === current) active = undefined;
    });
    active = current;
    return current;
  };

  const search = async (input: JsonRecord = {}) => {
    const query = optionalString(input.query);
    if (!query) throw new Error("world_memory_query_required");
    const searchInput = {
      query,
      ...(optionalString(input.regionId) ? { regionId: optionalString(input.regionId) } : {}),
      ...(optionalString(input.fromWorldTime) ? { fromWorldTime: optionalString(input.fromWorldTime) } : {}),
      ...(optionalString(input.toWorldTime) ? { toWorldTime: optionalString(input.toWorldTime) } : {}),
      ...(Number.isSafeInteger(input.limit) ? { limit: Number(input.limit) } : {}),
    };
    try {
      synchronizeIfNeeded();
    } catch (error) {
      invalidateEmbeddingIdentityIfNeeded(error);
      return {
        retrievalMode: "lexical" as const,
        query,
        filters: {
          ...(searchInput.regionId ? { regionId: searchInput.regionId } : {}),
          ...(searchInput.fromWorldTime ? { fromWorldTime: searchInput.fromWorldTime } : {}),
          ...(searchInput.toWorldTime ? { toWorldTime: searchInput.toWorldTime } : {}),
        },
        hits: [],
        semanticUnavailable: true as const,
        semanticErrorCode: safeErrorCode(error),
      };
    }
    if (!client) {
      return {
        ...searchWorldMemory(config.dbPath, searchInput),
        semanticUnavailable: true as const,
        semanticErrorCode: "qwen_embedding_client_unavailable",
      };
    }
    const index = worldMemoryIndexStatus(config.dbPath);
    if (index.ready === 0) {
      return {
        ...searchWorldMemory(config.dbPath, searchInput),
        semanticUnavailable: true as const,
        semanticErrorCode: noReadyVectorsErrorCode("world_memory", index, lastErrorCode),
      };
    }
    try {
      const embedded = await embedQuery(query);
      return searchWorldMemory(config.dbPath, {
        ...searchInput,
        queryEmbedding: embedded.embedding,
        embeddingProfile: embedded.identity.profile,
        embeddingBehaviorVectors: embedded.identity.behaviorEmbeddings,
      });
    } catch (error) {
      invalidateEmbeddingIdentityIfNeeded(error);
      return {
        ...searchWorldMemory(config.dbPath, searchInput),
        semanticUnavailable: true as const,
        semanticErrorCode: safeErrorCode(error),
      };
    }
  };

  const searchKnowledge = async (input: JsonRecord = {}) => {
    const query = optionalString(input.query);
    if (!query) throw new Error("world_knowledge_query_required");
    synchronizeKnowledgeIfNeeded();
    const searchInput = {
      query,
      ...(optionalString(input.collection)
        ? { collection: optionalString(input.collection) as WorldKnowledgeCollection }
        : {}),
      ...(optionalString(input.entityId) ? { entityId: optionalString(input.entityId) } : {}),
      ...(optionalString(input.regionId) ? { regionId: optionalString(input.regionId) } : {}),
      ...(Number.isSafeInteger(input.limit) ? { limit: Number(input.limit) } : {}),
    };
    if (!client) {
      return {
        ...searchWorldKnowledge(config.dbPath, searchInput),
        semanticUnavailable: true as const,
        semanticErrorCode: "qwen_embedding_client_unavailable",
      };
    }
    const knowledge = worldKnowledgeIndexStatus(config.dbPath);
    if (knowledge.ready === 0) {
      return {
        ...searchWorldKnowledge(config.dbPath, searchInput),
        semanticUnavailable: true as const,
        semanticErrorCode: noReadyVectorsErrorCode("world_knowledge", knowledge, lastErrorCode),
      };
    }
    try {
      const embedded = await embedQuery(query);
      return searchWorldKnowledge(config.dbPath, {
        ...searchInput,
        queryEmbedding: embedded.embedding,
        embeddingProfile: embedded.identity.profile,
        embeddingBehaviorVectors: embedded.identity.behaviorEmbeddings,
      });
    } catch (error) {
      invalidateEmbeddingIdentityIfNeeded(error);
      return {
        ...searchWorldKnowledge(config.dbPath, searchInput),
        semanticUnavailable: true as const,
        semanticErrorCode: safeErrorCode(error),
      };
    }
  };

  return {
    start() {
      if (timer) return;
      void runOnce().catch(() => undefined);
      timer = setInterval(() => void runOnce().catch(() => undefined), config.intervalMs);
      timer.unref();
    },
    stop() {
      if (timer) clearInterval(timer);
      timer = undefined;
      queryEmbeddingCache.clear();
      client?.close();
    },
    drain: async () => {
      try {
        await active;
      } catch {
        // Embedding is a rebuildable projection and must never fail shutdown.
      }
    },
    runOnce,
    search,
    searchKnowledge,
    status() {
      const index = worldMemoryIndexStatus(config.dbPath);
      const knowledge = worldKnowledgeIndexStatus(config.dbPath);
      return {
        enabled: true,
        semanticEnabled: Boolean(client),
        ...(!client
          ? { semanticErrorCode: "qwen_embedding_client_unavailable" }
          : lastErrorCode
            ? { semanticErrorCode: lastErrorCode }
            : {}),
        inFlight: Boolean(active),
        model: WORLD_MEMORY_EMBEDDING_MODEL,
        endpointModel: config.embeddingModel,
        dimension: config.embeddingDimension,
        ...(lastAttemptAt ? { lastAttemptAt } : {}),
        ...(lastSuccessAt ? { lastSuccessAt } : {}),
        ...(lastErrorAt ? { lastErrorAt } : {}),
        ...(lastErrorCode ? { lastErrorCode } : {}),
        chunks: index.chunks,
        pending: index.pending,
        processing: index.processing,
        ready: index.ready,
        failed: index.failed,
        ...(verifiedEmbeddingIdentity
          ? { embeddingIdentityVerifiedAt: verifiedEmbeddingIdentity.verifiedAt }
          : {}),
        queryEmbeddingCacheEntries: queryEmbeddingCache.size,
        knowledge,
      };
    },
  };
}
