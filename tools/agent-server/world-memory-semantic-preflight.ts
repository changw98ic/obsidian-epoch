import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  Qwen3EmbeddingClient,
  QwenEmbeddingError,
  type QwenEmbeddingBehavior,
} from "./lib/qwenEmbeddingClient.ts";
import { WORLD_MEMORY_EMBEDDING_DIMENSION } from "./lib/worldMemoryIndex.ts";
import {
  worldMemoryRuntimeConfigFromEnv,
  type WorldMemoryRuntimeConfig,
} from "./lib/worldMemoryRuntime.ts";

type EnvLike = Readonly<Record<string, string | undefined>>;

const DEFAULT_EMBEDDING_MODEL = "text-embedding-qwen3-embedding-8b";

export interface WorldMemoryEmbeddingProbeClient {
  readonly verifyBehavior: () => Promise<QwenEmbeddingBehavior>;
  readonly close: () => void;
}

export interface WorldMemorySemanticPreflightInput {
  readonly dbPath?: string;
  readonly env?: EnvLike;
  readonly clientFactory?: (config: WorldMemoryRuntimeConfig) => WorldMemoryEmbeddingProbeClient;
}

export interface WorldMemorySemanticPreflightResult {
  readonly ok: boolean;
  readonly semanticEnabled: boolean;
  readonly endpointModel: string;
  readonly dimension: typeof WORLD_MEMORY_EMBEDDING_DIMENSION;
  readonly code?: string;
}

function modelFromEnv(env: EnvLike) {
  return env.AGENT_SERVER_EMBEDDING_MODEL?.trim() || DEFAULT_EMBEDDING_MODEL;
}

function safeErrorCode(error: unknown) {
  if (error instanceof QwenEmbeddingError) return error.code;
  if (error instanceof Error && /^[a-z0-9_:-]+$/iu.test(error.message)) return error.message;
  return "world_memory_semantic_preflight_failed";
}

function failedResult(code: string, endpointModel: string): WorldMemorySemanticPreflightResult {
  return {
    ok: false,
    semanticEnabled: false,
    code,
    endpointModel,
    dimension: WORLD_MEMORY_EMBEDDING_DIMENSION,
  };
}

function behaviorHasExpectedDimension(behavior: QwenEmbeddingBehavior) {
  return behavior.behaviorEmbeddings.length > 0
    && behavior.behaviorEmbeddings.every((embedding) => embedding.length === WORLD_MEMORY_EMBEDDING_DIMENSION);
}

/**
 * Verifies the external embedding dependency without reading or mutating the
 * world-memory database. It deliberately emits only stable codes, never the
 * endpoint URL or bearer credential.
 */
export async function runWorldMemorySemanticPreflight(
  input: WorldMemorySemanticPreflightInput = {},
): Promise<WorldMemorySemanticPreflightResult> {
  const env = input.env || process.env;
  const endpointModel = modelFromEnv(env);
  const dbPath = input.dbPath || env.AGENT_SERVER_SQLITE_PATH || "/tmp/agent-world-semantic-preflight.sqlite";
  let config: WorldMemoryRuntimeConfig;
  try {
    config = worldMemoryRuntimeConfigFromEnv(dbPath, env);
  } catch (error) {
    return failedResult(safeErrorCode(error), endpointModel);
  }
  if (!config.embeddingBaseUrl) {
    return failedResult("semantic_embedding_base_url_missing", config.embeddingModel);
  }

  let client: WorldMemoryEmbeddingProbeClient | undefined;
  try {
    client = input.clientFactory?.(config) || new Qwen3EmbeddingClient({
      baseUrl: config.embeddingBaseUrl,
      apiKey: config.embeddingApiKey,
      model: config.embeddingModel,
      expectedDimensions: config.embeddingDimension,
      requestTimeoutMs: config.requestTimeoutMs,
    });
    const behavior = await client.verifyBehavior();
    if (!behaviorHasExpectedDimension(behavior)) {
      return failedResult("qwen_embedding_behavior_probe_invalid", config.embeddingModel);
    }
    return {
      ok: true,
      semanticEnabled: true,
      endpointModel: config.embeddingModel,
      dimension: config.embeddingDimension,
    };
  } catch (error) {
    return failedResult(safeErrorCode(error), config.embeddingModel);
  } finally {
    client?.close();
  }
}

function printResult(result: WorldMemorySemanticPreflightResult, json: boolean) {
  if (json) {
    process.stdout.write(`${JSON.stringify(result)}\n`);
    return;
  }
  if (result.ok) {
    process.stdout.write(`Semantic embedding preflight passed: model=${result.endpointModel}; dimension=${result.dimension}\n`);
    return;
  }
  process.stderr.write(`Semantic embedding preflight failed: ${result.code}\n`);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== "--json")) {
    throw new Error("world_memory_semantic_preflight_usage: --json");
  }
  const result = await runWorldMemorySemanticPreflight();
  printResult(result, args.includes("--json"));
  if (!result.ok) process.exitCode = 1;
}

if (path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1] || "")) {
  main().catch((error: unknown) => {
    const code = safeErrorCode(error);
    process.stderr.write(`Semantic embedding preflight failed: ${code}\n`);
    process.exitCode = 1;
  });
}
