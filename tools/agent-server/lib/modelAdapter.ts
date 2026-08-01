import { readFileSync, statSync } from "node:fs";

type JsonRecord = Record<string, unknown>;

export type ModelAdapterProvider = "anthropic" | "openai_compatible";
export type ModelAdapterMessageRole = "user" | "assistant";

export interface ModelAdapterMessage {
  readonly role: ModelAdapterMessageRole;
  readonly content: string;
}

export interface ModelAdapterCompletionInput {
  readonly systemPrompt?: string;
  readonly messages: readonly ModelAdapterMessage[];
  /**
   * Optional provider request budget. When omitted, the configured model
   * endpoint chooses its own budget; callers must not impose an arbitrary
   * application-level cap.
   */
  readonly maxTokens?: number;
  readonly temperature?: number;
  readonly responseFormat?: "json_object";
  readonly signal?: AbortSignal;
}

export interface ModelAdapterCompletionResult {
  readonly provider: ModelAdapterProvider;
  readonly model: string;
  readonly text: string;
  readonly stopReason?: string;
}

export interface ModelAdapter {
  readonly provider: ModelAdapterProvider;
  readonly model: string;
  readonly endpoint: string;
  complete(input: ModelAdapterCompletionInput): Promise<ModelAdapterCompletionResult>;
  warmup(): Promise<void>;
}

export interface ModelAdapterConfig {
  readonly provider: ModelAdapterProvider;
  readonly baseUrl: string;
  readonly model: string;
  readonly apiKey?: string;
  readonly timeoutMs?: number;
  readonly fetchImpl?: FetchLike;
}

export type ModelAdapterEnv = Readonly<Record<string, string | undefined>>;
export type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export class ModelAdapterError extends Error {
  readonly code: string;
  readonly status?: number;

  constructor(code: string, options: { readonly status?: number } = {}) {
    super(code);
    this.name = "ModelAdapterError";
    this.code = code;
    this.status = options.status;
  }
}

const DEFAULT_ANTHROPIC_BASE_URL = "https://api.anthropic.com";
const DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-4-20250514";
const DEFAULT_TIMEOUT_MS = 30_000;
const MIN_TIMEOUT_MS = 1_000;
const MAX_TIMEOUT_MS = 300_000;
const MAX_TEXT_CHARS = 200_000;

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function boundedTimeout(value: string | undefined): number {
  if (value === undefined || value.trim() === "") return DEFAULT_TIMEOUT_MS;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < MIN_TIMEOUT_MS || parsed > MAX_TIMEOUT_MS) {
    throw new ModelAdapterError("model_adapter_timeout_invalid");
  }
  return parsed;
}

function normalizeProvider(value: string | undefined): ModelAdapterProvider | undefined {
  const normalized = value?.trim().toLocaleLowerCase("en-US");
  if (!normalized || normalized === "none" || normalized === "disabled") return undefined;
  if (normalized === "anthropic") return "anthropic";
  if (["openai", "openai-compatible", "openai_compatible", "local"].includes(normalized)) {
    return "openai_compatible";
  }
  throw new ModelAdapterError("model_adapter_provider_unsupported");
}

function readSecretFile(filePath: string): string | undefined {
  try {
    const stat = statSync(filePath);
    if (!stat.isFile() || (stat.mode & 0o077) !== 0) {
      throw new ModelAdapterError("model_adapter_api_key_file_invalid");
    }
    return readFileSync(filePath, "utf8").trim() || undefined;
  } catch (error: unknown) {
    if (error instanceof ModelAdapterError) throw error;
    throw new ModelAdapterError("model_adapter_api_key_file_invalid");
  }
}

function apiKeyFromEnv(env: ModelAdapterEnv, provider: ModelAdapterProvider): string | undefined {
  const direct = nonEmptyString(env.AGENT_SERVER_MODEL_API_KEY);
  const filePath = nonEmptyString(env.AGENT_SERVER_MODEL_API_KEY_FILE);
  if (direct && filePath) throw new ModelAdapterError("model_adapter_api_key_source_conflict");
  const fromFile = filePath ? readSecretFile(filePath) : undefined;
  // This fallback is only for the provider boundary: existing Anthropic
  // deployments can move to AGENT_SERVER_MODEL_* without a code change.
  const legacyAnthropicKey = provider === "anthropic" ? nonEmptyString(env.ANTHROPIC_API_KEY) : undefined;
  return direct || fromFile || legacyAnthropicKey;
}

function endpointFor(provider: ModelAdapterProvider, baseUrl: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(baseUrl);
  } catch {
    throw new ModelAdapterError("model_adapter_base_url_invalid");
  }
  if (!(parsed.protocol === "http:" || parsed.protocol === "https:")
    || parsed.username
    || parsed.password
    || parsed.search
    || parsed.hash) {
    throw new ModelAdapterError("model_adapter_base_url_invalid");
  }

  const path = parsed.pathname.replace(/\/+$/u, "");
  const suffix = provider === "anthropic" ? "/messages" : "/chat/completions";
  if (path.endsWith(suffix)) {
    parsed.pathname = path;
  } else {
    const versionedPath = path.endsWith("/v1") ? path : `${path}/v1`;
    parsed.pathname = `${versionedPath}${suffix}`.replace(/\/{2,}/gu, "/");
  }
  return parsed;
}

function assertCompletionInput(input: ModelAdapterCompletionInput): void {
  if (!Array.isArray(input.messages) || input.messages.length === 0) {
    throw new ModelAdapterError("model_adapter_messages_required");
  }
  if (input.maxTokens !== undefined && (!Number.isSafeInteger(input.maxTokens) || input.maxTokens < 1)) {
    throw new ModelAdapterError("model_adapter_max_tokens_invalid");
  }
  if (input.temperature !== undefined
    && (!Number.isFinite(input.temperature) || input.temperature < 0 || input.temperature > 2)) {
    throw new ModelAdapterError("model_adapter_temperature_invalid");
  }
  if (input.systemPrompt !== undefined && input.systemPrompt.length > MAX_TEXT_CHARS) {
    throw new ModelAdapterError("model_adapter_prompt_too_large");
  }
  for (const message of input.messages) {
    if (!message.content.trim() || message.content.length > MAX_TEXT_CHARS) {
      throw new ModelAdapterError("model_adapter_message_invalid");
    }
  }
}

function textFromContent(value: unknown): string {
  if (typeof value === "string") return value;
  if (!Array.isArray(value)) return "";
  return value.map((part) => {
    if (!isRecord(part)) return "";
    return typeof part.text === "string" ? part.text : "";
  }).join("");
}

function parseAnthropicResponse(
  payload: unknown,
  config: ModelAdapterConfig,
): ModelAdapterCompletionResult {
  if (!isRecord(payload) || !Array.isArray(payload.content)) {
    throw new ModelAdapterError("model_adapter_response_invalid");
  }
  const text = textFromContent(payload.content);
  if (!text) throw new ModelAdapterError("model_adapter_response_text_missing");
  return {
    provider: config.provider,
    model: nonEmptyString(payload.model) || config.model,
    text,
    ...(nonEmptyString(payload.stop_reason) ? { stopReason: nonEmptyString(payload.stop_reason) } : {}),
  };
}

function parseOpenAiCompatibleResponse(
  payload: unknown,
  config: ModelAdapterConfig,
): ModelAdapterCompletionResult {
  if (!isRecord(payload) || !Array.isArray(payload.choices) || payload.choices.length === 0) {
    throw new ModelAdapterError("model_adapter_response_invalid");
  }
  const firstChoice = payload.choices[0];
  if (!isRecord(firstChoice) || !isRecord(firstChoice.message)) {
    throw new ModelAdapterError("model_adapter_response_invalid");
  }
  const text = textFromContent(firstChoice.message.content);
  if (!text) throw new ModelAdapterError("model_adapter_response_text_missing");
  return {
    provider: config.provider,
    model: nonEmptyString(payload.model) || config.model,
    text,
    ...(nonEmptyString(firstChoice.finish_reason) ? { stopReason: nonEmptyString(firstChoice.finish_reason) } : {}),
  };
}

interface StreamCompletion {
  readonly text: string;
  readonly stopReason?: string;
}

function parseSseCompletion(body: string, provider: ModelAdapterProvider): StreamCompletion {
  let text = "";
  let stopReason: string | undefined;

  for (const block of body.split(/\r?\n\r?\n/gu)) {
    const dataLines: string[] = [];
    for (const line of block.split(/\r?\n/gu)) {
      if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
    }
    const data = dataLines.join("\n").trim();
    if (!data || data === "[DONE]") continue;

    let payload: unknown;
    try {
      payload = JSON.parse(data);
    } catch {
      continue;
    }
    if (!isRecord(payload)) continue;

    if (provider === "anthropic") {
      if (payload.type === "content_block_delta" && isRecord(payload.delta)) {
        if (payload.delta.type === "text_delta" && typeof payload.delta.text === "string") {
          text += payload.delta.text;
        }
      } else if (payload.type === "message_delta" && isRecord(payload.delta)) {
        stopReason = nonEmptyString(payload.delta.stop_reason) || stopReason;
      }
      continue;
    }

    const choices = Array.isArray(payload.choices) ? payload.choices : [];
    const firstChoice = choices[0];
    if (!isRecord(firstChoice)) continue;
    if (isRecord(firstChoice.delta)) text += textFromContent(firstChoice.delta.content);
    stopReason = nonEmptyString(firstChoice.finish_reason) || stopReason;
  }

  return { text, ...(stopReason ? { stopReason } : {}) };
}

function parseCompletionBody(
  body: string,
  contentType: string,
  config: ModelAdapterConfig,
): ModelAdapterCompletionResult {
  const trimmed = body.trim();
  const hasSseRecords = /(?:^|\r?\n)(?:event|data):/u.test(trimmed);
  if (!hasSseRecords && (contentType.includes("json") || trimmed.startsWith("{") || trimmed.startsWith("["))) {
    let payload: unknown;
    try {
      payload = JSON.parse(trimmed);
    } catch {
      throw new ModelAdapterError("model_adapter_response_invalid");
    }
    return config.provider === "anthropic"
      ? parseAnthropicResponse(payload, config)
      : parseOpenAiCompatibleResponse(payload, config);
  }

  const completion = parseSseCompletion(body, config.provider);
  if (!completion.text) throw new ModelAdapterError("model_adapter_response_text_missing");
  return {
    provider: config.provider,
    model: config.model,
    text: completion.text,
    ...(completion.stopReason ? { stopReason: completion.stopReason } : {}),
  };
}

async function readResponseBody(response: Response): Promise<string> {
  if (!response.body) return response.text();
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let body = "";
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      body += decoder.decode(chunk.value, { stream: true });
    }
    body += decoder.decode();
    return body;
  } finally {
    reader.releaseLock();
  }
}

function requestMessages(input: ModelAdapterCompletionInput): readonly JsonRecord[] {
  return [
    ...(input.systemPrompt ? [{ role: "system", content: input.systemPrompt }] : []),
    ...input.messages.map((message) => ({ role: message.role, content: message.content })),
  ];
}

export class HttpModelAdapter implements ModelAdapter {
  readonly provider: ModelAdapterProvider;
  readonly model: string;
  readonly endpoint: string;
  private readonly apiKey: string | undefined;
  private readonly timeoutMs: number;
  private readonly fetchImpl: FetchLike;

  constructor(config: ModelAdapterConfig) {
    if (!config.model.trim()) throw new ModelAdapterError("model_adapter_model_required");
    if (config.provider === "anthropic" && !config.apiKey?.trim()) {
      throw new ModelAdapterError("model_adapter_api_key_required");
    }
    if (config.provider === "openai_compatible" && !config.baseUrl.trim()) {
      throw new ModelAdapterError("model_adapter_base_url_required");
    }
    this.provider = config.provider;
    this.model = config.model.trim();
    this.endpoint = endpointFor(config.provider, config.baseUrl).toString();
    this.apiKey = config.apiKey?.trim() || undefined;
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    if (!Number.isSafeInteger(this.timeoutMs)
      || this.timeoutMs < MIN_TIMEOUT_MS
      || this.timeoutMs > MAX_TIMEOUT_MS) {
      throw new ModelAdapterError("model_adapter_timeout_invalid");
    }
    this.fetchImpl = config.fetchImpl || fetch;
  }

  async complete(input: ModelAdapterCompletionInput): Promise<ModelAdapterCompletionResult> {
    assertCompletionInput(input);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    const abortListener = input.signal
      ? () => controller.abort()
      : undefined;
    if (input.signal && input.signal.aborted) {
      clearTimeout(timeout);
      throw new ModelAdapterError("model_adapter_aborted");
    }
    input.signal?.addEventListener("abort", abortListener!, { once: true });
    try {
      const body = this.provider === "anthropic"
        ? {
          model: this.model,
          stream: true,
          messages: input.messages,
          ...(input.maxTokens === undefined ? {} : { max_tokens: input.maxTokens }),
          ...(input.systemPrompt ? { system: input.systemPrompt } : {}),
          ...(input.temperature === undefined ? {} : { temperature: input.temperature }),
        }
        : {
          model: this.model,
          messages: requestMessages(input),
          stream: true,
          ...(input.maxTokens === undefined ? {} : { max_tokens: input.maxTokens }),
          ...(input.temperature === undefined ? {} : { temperature: input.temperature }),
          ...(input.responseFormat === "json_object" ? { response_format: { type: "json_object" } } : {}),
        };
      const headers: Record<string, string> = {
        "content-type": "application/json",
        accept: "text/event-stream, application/json",
      };
      if (this.provider === "anthropic") {
        headers["x-api-key"] = this.apiKey!;
        headers["anthropic-version"] = "2023-06-01";
      } else if (this.apiKey) {
        headers.authorization = `Bearer ${this.apiKey}`;
      }
      let response: Response;
      try {
        response = await this.fetchImpl(this.endpoint, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
          signal: controller.signal,
        });
      } catch (error: unknown) {
        if (controller.signal.aborted) {
          throw new ModelAdapterError(input.signal?.aborted ? "model_adapter_aborted" : "model_adapter_timeout");
        }
        throw new ModelAdapterError("model_adapter_transport_error");
      }
      if (!response.ok) {
        throw new ModelAdapterError(`model_adapter_http_${response.status}`, { status: response.status });
      }
      try {
        const responseBody = await readResponseBody(response);
        return parseCompletionBody(
          responseBody,
          response.headers.get("content-type")?.toLocaleLowerCase("en-US") || "",
          { provider: this.provider, baseUrl: this.endpoint, model: this.model, apiKey: this.apiKey },
        );
      } catch (error: unknown) {
        if (error instanceof ModelAdapterError) throw error;
        if (controller.signal.aborted) {
          throw new ModelAdapterError(input.signal?.aborted ? "model_adapter_aborted" : "model_adapter_timeout");
        }
        throw new ModelAdapterError("model_adapter_response_invalid");
      }
    } finally {
      clearTimeout(timeout);
      if (input.signal && abortListener) input.signal.removeEventListener("abort", abortListener);
    }
  }

  async warmup(): Promise<void> {
    await this.complete({
      systemPrompt: "Warmup only. Reply with OK.",
      messages: [{ role: "user", content: "Reply with only OK." }],
    });
  }
}

export function createModelAdapter(config: ModelAdapterConfig): ModelAdapter {
  return new HttpModelAdapter(config);
}

export function modelAdapterConfigFromEnv(env: ModelAdapterEnv = process.env): ModelAdapterConfig | undefined {
  const provider = normalizeProvider(env.AGENT_SERVER_MODEL_PROVIDER)
    || (nonEmptyString(env.ANTHROPIC_API_KEY) ? "anthropic" : undefined);
  if (!provider) return undefined;

  const apiKey = apiKeyFromEnv(env, provider);
  const baseUrl = nonEmptyString(env.AGENT_SERVER_MODEL_BASE_URL)
    || (provider === "anthropic" ? DEFAULT_ANTHROPIC_BASE_URL : undefined);
  if (!baseUrl) throw new ModelAdapterError("model_adapter_base_url_required");
  const model = nonEmptyString(env.AGENT_SERVER_MODEL_NAME)
    || (provider === "anthropic" ? DEFAULT_ANTHROPIC_MODEL : undefined);
  if (!model) throw new ModelAdapterError("model_adapter_model_required");
  if (provider === "anthropic" && !apiKey) throw new ModelAdapterError("model_adapter_api_key_required");
  return {
    provider,
    baseUrl,
    model,
    ...(apiKey ? { apiKey } : {}),
    timeoutMs: boundedTimeout(env.AGENT_SERVER_MODEL_TIMEOUT_MS),
  };
}

export function createModelAdapterFromEnv(env: ModelAdapterEnv = process.env): ModelAdapter | undefined {
  const config = modelAdapterConfigFromEnv(env);
  return config ? createModelAdapter(config) : undefined;
}
