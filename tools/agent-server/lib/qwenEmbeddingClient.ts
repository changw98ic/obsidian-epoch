import {
  WORLD_MEMORY_EMBEDDING_DIMENSION,
  WORLD_MEMORY_EMBEDDING_MODEL,
  worldMemoryBehaviorFingerprint,
} from "./worldMemoryIndex.ts";

type JsonRecord = Record<string, unknown>;
type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

const BEHAVIOR_PROBES = [
  "黑曜纪元模型身份探针甲：量子实验与样本签注。",
  "黑曜纪元模型身份探针乙：城外猎杀变异兽并安全返程。",
] as const;

export class QwenEmbeddingError extends Error {
  readonly code: string;

  constructor(code: string, options?: ErrorOptions) {
    super(code, options);
    this.name = "QwenEmbeddingError";
    this.code = code;
  }
}

export interface QwenEmbeddingBatch {
  readonly embeddings: readonly (readonly number[])[];
  readonly behaviorEmbeddings: readonly (readonly number[])[];
  readonly behaviorFingerprint: `sha256:${string}`;
}

export interface QwenEmbeddingBehavior {
  readonly behaviorEmbeddings: readonly (readonly number[])[];
  readonly behaviorFingerprint: `sha256:${string}`;
}

export interface QwenEmbeddingClientOptions {
  readonly baseUrl: string;
  readonly apiKey?: string;
  readonly model?: string;
  readonly expectedDimensions?: number;
  readonly requestTimeoutMs?: number;
  readonly maxAttempts?: number;
  readonly fetchImpl?: FetchLike;
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function embeddingsEndpoint(baseUrl: string) {
  let parsed: URL;
  try {
    parsed = new URL(baseUrl);
  } catch (error) {
    throw new QwenEmbeddingError("qwen_embedding_base_url_invalid", { cause: error });
  }
  if (!(["http:", "https:"] as const).includes(parsed.protocol as "http:" | "https:")
    || parsed.username || parsed.password) {
    throw new QwenEmbeddingError("qwen_embedding_base_url_invalid");
  }
  parsed.hash = "";
  parsed.search = "";
  parsed.pathname = parsed.pathname.replace(/\/+$/u, "");
  parsed.pathname = parsed.pathname.endsWith("/v1")
    ? `${parsed.pathname}/embeddings`
    : `${parsed.pathname}/v1/embeddings`.replace(/\/{2,}/gu, "/");
  return parsed;
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export class Qwen3EmbeddingClient {
  readonly model: string;
  readonly expectedDimensions: number;
  readonly endpoint: URL;
  readonly requestTimeoutMs: number;
  readonly maxAttempts: number;
  readonly apiKey?: string;
  readonly fetchImpl: FetchLike;
  private readonly activeControllers = new Set<AbortController>();
  private closed = false;

  constructor(options: QwenEmbeddingClientOptions) {
    const model = (options.model || WORLD_MEMORY_EMBEDDING_MODEL).trim();
    if (!model) throw new QwenEmbeddingError("qwen_embedding_model_required");
    const expectedDimensions = options.expectedDimensions ?? WORLD_MEMORY_EMBEDDING_DIMENSION;
    if (expectedDimensions !== WORLD_MEMORY_EMBEDDING_DIMENSION) {
      throw new QwenEmbeddingError("qwen_embedding_dimension_contract_invalid");
    }
    const requestTimeoutMs = options.requestTimeoutMs ?? 30_000;
    if (!Number.isSafeInteger(requestTimeoutMs) || requestTimeoutMs < 100 || requestTimeoutMs > 300_000) {
      throw new QwenEmbeddingError("qwen_embedding_timeout_invalid");
    }
    const maxAttempts = options.maxAttempts ?? 3;
    if (!Number.isSafeInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 5) {
      throw new QwenEmbeddingError("qwen_embedding_attempts_invalid");
    }
    this.model = model;
    this.expectedDimensions = expectedDimensions;
    this.endpoint = embeddingsEndpoint(options.baseUrl);
    this.requestTimeoutMs = requestTimeoutMs;
    this.maxAttempts = maxAttempts;
    this.apiKey = options.apiKey?.trim() || undefined;
    this.fetchImpl = options.fetchImpl || fetch;
  }

  async embedAll(inputs: readonly string[]): Promise<readonly (readonly number[])[]> {
    if (this.closed) throw new QwenEmbeddingError("qwen_embedding_client_closed");
    if (inputs.length === 0) return [];
    if (inputs.length > 64 || inputs.some((input) => !input.trim() || input.length > 16_000)) {
      throw new QwenEmbeddingError("qwen_embedding_input_invalid");
    }
    let lastError: unknown;
    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      if (this.closed) throw new QwenEmbeddingError("qwen_embedding_client_closed");
      const controller = new AbortController();
      this.activeControllers.add(controller);
      const timer = setTimeout(() => controller.abort(), this.requestTimeoutMs);
      try {
        const response = await this.fetchImpl(this.endpoint, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...(this.apiKey ? { authorization: `Bearer ${this.apiKey}` } : {}),
          },
          body: JSON.stringify({ model: this.model, input: inputs }),
          signal: controller.signal,
        });
        if (!response.ok) throw new QwenEmbeddingError(`qwen_embedding_http_${response.status}`);
        const payload: unknown = await response.json();
        return this.decodeResponse(payload, inputs.length);
      } catch (error) {
        if (this.closed) throw new QwenEmbeddingError("qwen_embedding_client_closed", { cause: error });
        lastError = error;
        if (attempt >= this.maxAttempts) break;
        await sleep(250 * attempt);
      } finally {
        clearTimeout(timer);
        this.activeControllers.delete(controller);
      }
    }
    if (lastError instanceof QwenEmbeddingError) throw lastError;
    if (lastError instanceof Error && lastError.name === "AbortError") {
      throw new QwenEmbeddingError("qwen_embedding_timeout", { cause: lastError });
    }
    throw new QwenEmbeddingError("qwen_embedding_transport_error", { cause: lastError });
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    for (const controller of this.activeControllers) controller.abort();
    this.activeControllers.clear();
  }

  async embedAllVerifyingBehavior(inputs: readonly string[]): Promise<QwenEmbeddingBatch> {
    if (inputs.length === 0) throw new QwenEmbeddingError("qwen_embedding_input_invalid");
    const embeddings = await this.embedAll(inputs);
    const behavior = await this.verifyBehavior();
    return { embeddings, ...behavior };
  }

  async verifyBehavior(): Promise<QwenEmbeddingBehavior> {
    // Keep identity probes in a fixed-size request. Some OpenAI-compatible
    // llama.cpp servers pad a batch to its longest input, which can introduce
    // enough numerical drift to make the same model fail its own identity
    // check when probes are mixed with arbitrary application text.
    const probeVectors = await this.embedAll(BEHAVIOR_PROBES);
    if (probeVectors.length !== BEHAVIOR_PROBES.length) {
      throw new QwenEmbeddingError("qwen_embedding_behavior_probe_invalid");
    }
    return {
      behaviorEmbeddings: probeVectors,
      behaviorFingerprint: worldMemoryBehaviorFingerprint(probeVectors),
    };
  }

  private decodeResponse(payload: unknown, expectedCount: number) {
    if (!isRecord(payload) || payload.model !== this.model || !Array.isArray(payload.data)) {
      throw new QwenEmbeddingError("qwen_embedding_response_invalid");
    }
    if (payload.data.length !== expectedCount) throw new QwenEmbeddingError("qwen_embedding_count_mismatch");
    const ordered: Array<readonly number[] | undefined> = new Array(expectedCount);
    payload.data.forEach((itemValue, position) => {
      const item = recordValue(itemValue);
      if (!Number.isSafeInteger(item.index) || !Array.isArray(item.embedding)) {
        throw new QwenEmbeddingError(`qwen_embedding_item_invalid:${position}`);
      }
      const index = Number(item.index);
      if (index < 0 || index >= expectedCount || ordered[index]) {
        throw new QwenEmbeddingError("qwen_embedding_index_invalid");
      }
      if (item.embedding.length !== this.expectedDimensions) {
        throw new QwenEmbeddingError(`qwen_embedding_dimension_mismatch:${item.embedding.length}`);
      }
      const values = item.embedding.map((value, valueIndex) => {
        if (typeof value !== "number" || !Number.isFinite(value)) {
          throw new QwenEmbeddingError(`qwen_embedding_value_invalid:${valueIndex}`);
        }
        return value;
      });
      ordered[index] = values;
    });
    if (ordered.some((entry) => !entry)) throw new QwenEmbeddingError("qwen_embedding_index_incomplete");
    return ordered as readonly (readonly number[])[];
  }
}

function recordValue(value: unknown): JsonRecord {
  return isRecord(value) ? value : {};
}
