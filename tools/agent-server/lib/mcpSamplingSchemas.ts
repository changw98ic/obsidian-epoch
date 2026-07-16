type JsonRecord = Record<string, unknown>;

export const MCP_SAMPLING_LIMITS = Object.freeze({
  maxMessages: 16,
  maxMessageChars: 4_000,
  maxTotalMessageChars: 12_000,
  maxSystemPromptChars: 4_000,
  maxTokens: 2_048,
  maxResultChars: 4_096,
  maxDecisionDepth: 4,
  maxStopSequences: 8,
  maxStopSequenceChars: 64,
});

export const MCP_TASK_SAMPLING_LIMITS = Object.freeze({
  ...MCP_SAMPLING_LIMITS,
  maxMessageChars: 12_000,
  maxTotalMessageChars: 24_000,
  maxSystemPromptChars: 8_000,
  maxTokens: 8_192,
  maxResultChars: 32_768,
  maxDecisionDepth: 10,
});

export type McpSamplingRole = "assistant" | "user";

export interface McpSamplingTextMessage {
  readonly role: McpSamplingRole;
  readonly text: string;
}

export interface McpSamplingModelPreferences {
  readonly hints?: readonly { readonly name?: string }[];
  readonly costPriority?: number;
  readonly intelligencePriority?: number;
  readonly speedPriority?: number;
}

export interface McpSamplingCreateMessageInput {
  readonly messages: readonly McpSamplingTextMessage[];
  readonly systemPrompt?: string;
  readonly maxTokens?: number;
  readonly modelPreferences?: McpSamplingModelPreferences;
  readonly temperature?: number;
  readonly stopSequences?: readonly string[];
}

export interface JourneySamplingDecision {
  readonly actionOptionId: string;
  readonly rationale: string;
  readonly userFacingMessage?: string;
  readonly confidence: number;
}

export interface ParsedJourneySamplingResult {
  readonly decision: JourneySamplingDecision;
  readonly audit: {
    readonly model?: string;
    readonly stopReason?: string;
  };
}

export type McpSamplingSchemaErrorCode =
  | "sampling_request_invalid"
  | "sampling_result_invalid"
  | "sampling_result_not_text"
  | "sampling_result_too_large";

export class McpSamplingSchemaError extends Error {
  readonly code: McpSamplingSchemaErrorCode;
  readonly details?: JsonRecord;

  constructor(code: McpSamplingSchemaErrorCode, details?: JsonRecord) {
    super(code);
    this.name = "McpSamplingSchemaError";
    this.code = code;
    this.details = details;
  }
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function failRequest(field: string): never {
  throw new McpSamplingSchemaError("sampling_request_invalid", { field });
}

function failResult(field: string): never {
  throw new McpSamplingSchemaError("sampling_result_invalid", { field });
}

function boundedText(value: unknown, field: string, max: number, result = false): string {
  if (typeof value !== "string" || value.length === 0 || value.length > max) {
    if (result) failResult(field);
    failRequest(field);
  }
  return value;
}

function boundedPriority(value: unknown, field: string) {
  if (value === undefined) return undefined;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) failRequest(field);
  return value;
}

function buildModelPreferences(value: McpSamplingModelPreferences | undefined) {
  if (!value) return undefined;
  const hints = value.hints?.map((hint, index) => {
    if (!isRecord(hint) || (hint.name !== undefined && (typeof hint.name !== "string" || hint.name.length > 128))) {
      failRequest(`modelPreferences.hints[${index}]`);
    }
    return hint.name ? { name: hint.name } : {};
  });
  if (hints && hints.length > 8) failRequest("modelPreferences.hints");
  return {
    ...(hints ? { hints } : {}),
    ...(value.costPriority === undefined ? {} : { costPriority: boundedPriority(value.costPriority, "modelPreferences.costPriority") }),
    ...(value.intelligencePriority === undefined ? {} : { intelligencePriority: boundedPriority(value.intelligencePriority, "modelPreferences.intelligencePriority") }),
    ...(value.speedPriority === undefined ? {} : { speedPriority: boundedPriority(value.speedPriority, "modelPreferences.speedPriority") }),
  };
}

function buildMcpSamplingCreateMessageParamsWithLimits(
  input: McpSamplingCreateMessageInput,
  limits: Readonly<{
    maxMessages: number;
    maxMessageChars: number;
    maxTotalMessageChars: number;
    maxSystemPromptChars: number;
    maxTokens: number;
  }>,
): JsonRecord {
  if (!Array.isArray(input.messages) || input.messages.length === 0 || input.messages.length > limits.maxMessages) {
    failRequest("messages");
  }
  let totalChars = 0;
  const messages = input.messages.map((message, index) => {
    if (!isRecord(message) || (message.role !== "user" && message.role !== "assistant")) {
      failRequest(`messages[${index}].role`);
    }
    const text = boundedText(message.text, `messages[${index}].text`, limits.maxMessageChars);
    totalChars += text.length;
    return { role: message.role, content: { type: "text", text } };
  });
  if (totalChars > limits.maxTotalMessageChars) failRequest("messages.totalChars");

  const maxTokens = input.maxTokens ?? 512;
  if (!Number.isInteger(maxTokens) || maxTokens < 1 || maxTokens > limits.maxTokens) failRequest("maxTokens");
  if (input.temperature !== undefined
    && (typeof input.temperature !== "number" || !Number.isFinite(input.temperature) || input.temperature < 0 || input.temperature > 2)) {
    failRequest("temperature");
  }
  const stopSequences = input.stopSequences?.map((value, index) => boundedText(
    value,
    `stopSequences[${index}]`,
    MCP_SAMPLING_LIMITS.maxStopSequenceChars,
  ));
  if (stopSequences && stopSequences.length > MCP_SAMPLING_LIMITS.maxStopSequences) failRequest("stopSequences");

  return {
    messages,
    maxTokens,
    includeContext: "none",
    ...(input.systemPrompt === undefined ? {} : {
      systemPrompt: boundedText(input.systemPrompt, "systemPrompt", limits.maxSystemPromptChars),
    }),
    ...(input.modelPreferences === undefined ? {} : { modelPreferences: buildModelPreferences(input.modelPreferences) }),
    ...(input.temperature === undefined ? {} : { temperature: input.temperature }),
    ...(stopSequences ? { stopSequences } : {}),
  };
}

export function buildMcpSamplingCreateMessageParams(input: McpSamplingCreateMessageInput): JsonRecord {
  return buildMcpSamplingCreateMessageParamsWithLimits(input, MCP_SAMPLING_LIMITS);
}

export function buildMcpTaskSamplingCreateMessageParams(input: McpSamplingCreateMessageInput): JsonRecord {
  return buildMcpSamplingCreateMessageParamsWithLimits(input, MCP_TASK_SAMPLING_LIMITS);
}

function assertJsonDepth(value: unknown, depth: number, maxDepth: number = MCP_SAMPLING_LIMITS.maxDecisionDepth): void {
  if (depth > maxDepth) failResult("decision.depth");
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    for (const entry of value) assertJsonDepth(entry, depth + 1, maxDepth);
    return;
  }
  for (const entry of Object.values(value)) assertJsonDepth(entry, depth + 1, maxDepth);
}

const DECISION_FIELDS = new Set(["actionOptionId", "rationale", "userFacingMessage", "confidence"]);
const RESULT_FIELDS = new Set(["role", "content", "model", "stopReason", "_meta"]);
const CONTENT_FIELDS = new Set(["type", "text"]);

export function parseJourneySamplingResult(value: unknown): ParsedJourneySamplingResult {
  if (!isRecord(value)) failResult("result");
  for (const field of Object.keys(value)) if (!RESULT_FIELDS.has(field)) failResult(`result.${field}`);
  if (value.role !== "assistant") failResult("result.role");
  if (!isRecord(value.content) || value.content.type !== "text") {
    throw new McpSamplingSchemaError("sampling_result_not_text", { field: "result.content" });
  }
  for (const field of Object.keys(value.content)) if (!CONTENT_FIELDS.has(field)) failResult(`result.content.${field}`);
  if (typeof value.content.text !== "string") failResult("result.content.text");
  if (value.content.text.length > MCP_SAMPLING_LIMITS.maxResultChars) {
    throw new McpSamplingSchemaError("sampling_result_too_large");
  }
  const trimmed = value.content.text.trim();
  if (!trimmed || trimmed.includes("```") || !trimmed.startsWith("{") || !trimmed.endsWith("}")) {
    failResult("result.content.text.strictJson");
  }
  let decoded: unknown;
  try {
    decoded = JSON.parse(trimmed);
  } catch {
    failResult("result.content.text.json");
  }
  assertJsonDepth(decoded, 0);
  if (!isRecord(decoded)) failResult("decision");
  for (const field of Object.keys(decoded)) if (!DECISION_FIELDS.has(field)) failResult(`decision.${field}`);
  const actionOptionId = boundedText(decoded.actionOptionId, "decision.actionOptionId", 128, true);
  const rationale = boundedText(decoded.rationale, "decision.rationale", 1_000, true);
  const userFacingMessage = decoded.userFacingMessage === undefined
    ? undefined
    : boundedText(decoded.userFacingMessage, "decision.userFacingMessage", 2_000, true);
  if (typeof decoded.confidence !== "number" || !Number.isFinite(decoded.confidence)
    || decoded.confidence < 0 || decoded.confidence > 1) failResult("decision.confidence");
  if (value.model !== undefined && typeof value.model !== "string") failResult("result.model");
  if (value.stopReason !== undefined && typeof value.stopReason !== "string") failResult("result.stopReason");

  return Object.freeze({
    decision: Object.freeze({
      actionOptionId,
      rationale,
      ...(userFacingMessage === undefined ? {} : { userFacingMessage }),
      confidence: decoded.confidence,
    }),
    audit: Object.freeze({
      ...(typeof value.model === "string" ? { model: value.model } : {}),
      ...(typeof value.stopReason === "string" ? { stopReason: value.stopReason } : {}),
    }),
  });
}

export interface ParsedJourneyTaskSamplingResult {
  readonly proposal: unknown;
  readonly audit: {
    readonly model?: string;
    readonly stopReason?: string;
  };
}

export function parseJourneyTaskSamplingResult(value: unknown): ParsedJourneyTaskSamplingResult {
  if (!isRecord(value)) failResult("result");
  for (const field of Object.keys(value)) if (!RESULT_FIELDS.has(field)) failResult(`result.${field}`);
  if (value.role !== "assistant") failResult("result.role");
  if (!isRecord(value.content) || value.content.type !== "text") {
    throw new McpSamplingSchemaError("sampling_result_not_text", { field: "result.content" });
  }
  for (const field of Object.keys(value.content)) if (!CONTENT_FIELDS.has(field)) failResult(`result.content.${field}`);
  if (typeof value.content.text !== "string") failResult("result.content.text");
  if (value.content.text.length > MCP_TASK_SAMPLING_LIMITS.maxResultChars) {
    throw new McpSamplingSchemaError("sampling_result_too_large");
  }
  const trimmed = value.content.text.trim();
  if (!trimmed || trimmed.includes("```") || !trimmed.startsWith("{") || !trimmed.endsWith("}")) {
    failResult("result.content.text.strictJson");
  }
  let decoded: unknown;
  try {
    decoded = JSON.parse(trimmed);
  } catch {
    failResult("result.content.text.json");
  }
  assertJsonDepth(decoded, 0, MCP_TASK_SAMPLING_LIMITS.maxDecisionDepth);
  if (!isRecord(decoded)) failResult("taskProposal");
  if (value.model !== undefined && typeof value.model !== "string") failResult("result.model");
  if (value.stopReason !== undefined && typeof value.stopReason !== "string") failResult("result.stopReason");
  return Object.freeze({
    proposal: decoded,
    audit: Object.freeze({
      ...(typeof value.model === "string" ? { model: value.model } : {}),
      ...(typeof value.stopReason === "string" ? { stopReason: value.stopReason } : {}),
    }),
  });
}
