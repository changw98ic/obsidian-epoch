import {
  buildMcpSamplingCreateMessageParams,
  buildMcpTaskSamplingCreateMessageParams,
  McpSamplingSchemaError,
  parseJourneySamplingResult,
  parseJourneyTaskSamplingResult,
  type JourneySamplingDecision,
  type McpSamplingCreateMessageInput,
} from "./mcpSamplingSchemas.ts";
import {
  McpServerRequestError,
  type McpServerRequestManager,
} from "./mcpServerRequestManager.ts";
import { McpSessionError, type McpSession } from "./mcpSession.ts";
import { createMcpSamplingLimiter, type McpSamplingLimiter, type McpSamplingLimitReason } from "./mcpSamplingLimiter.ts";

type JsonRecord = Record<string, unknown>;

export type McpSamplingFallback =
  | "capability_absent"
  | "disconnect"
  | "idempotent_replay"
  | "invalid_result"
  | "journey_state_changed"
  | "method_not_found"
  | "not_active_client_request"
  | "provider_error"
  | "rate_limited"
  | "session_not_initialized"
  | "timeout"
  | "user_rejected";

export type McpSamplingOutcome = {
  readonly ok: true;
  readonly source: "sampling_advice";
  readonly trust: "untrusted_client";
  readonly decision: JourneySamplingDecision;
  readonly audit: { readonly model?: string; readonly stopReason?: string };
} | {
  readonly ok: false;
  readonly source: "sampling_advice";
  readonly trust: "untrusted_client";
  readonly fallback: McpSamplingFallback;
  readonly limitReason?: McpSamplingLimitReason;
};

export type McpTaskSamplingOutcome = {
  readonly ok: true;
  readonly source: "task_plan_sampling";
  readonly trust: "untrusted_client";
  readonly proposal: unknown;
  readonly audit: { readonly model?: string; readonly stopReason?: string };
} | {
  readonly ok: false;
  readonly source: "task_plan_sampling";
  readonly trust: "untrusted_client";
  readonly fallback: McpSamplingFallback;
  readonly limitReason?: McpSamplingLimitReason;
};

export interface McpSamplingCallContext {
  readonly activeClientRequest: boolean;
  readonly signal?: AbortSignal;
  readonly softTimeoutMs?: number;
  readonly absoluteTimeoutMs?: number;
}

export interface McpSamplingClientOptions {
  readonly session: McpSession;
  readonly requestManager: McpServerRequestManager;
  readonly audit?: (event: string, details: JsonRecord) => void;
  readonly limiter?: McpSamplingLimiter;
  readonly taskPlanLimiter?: McpSamplingLimiter;
  readonly episodeLimiter?: McpSamplingLimiter;
}

function failure(fallback: McpSamplingFallback, limitReason?: McpSamplingLimitReason): McpSamplingOutcome {
  return Object.freeze({ ok: false, source: "sampling_advice", trust: "untrusted_client", fallback, ...(limitReason ? { limitReason } : {}) });
}

function remoteFallback(error: McpServerRequestError): McpSamplingFallback {
  if (error.code === "mcp_server_request_absolute_timeout" || error.code === "mcp_server_request_soft_timeout") return "timeout";
  if (error.code === "mcp_server_request_connection_closed") return "disconnect";
  if (error.code === "mcp_server_request_aborted") return "user_rejected";
  if (error.code === "mcp_server_request_remote_error") {
    if (error.details?.code === -32601) return "method_not_found";
    const message = typeof error.details?.message === "string" ? error.details.message.toLowerCase() : "";
    if (message.includes("reject") || message.includes("denied") || message.includes("cancel")) return "user_rejected";
    return "provider_error";
  }
  return "provider_error";
}

export class McpSamplingClient {
  readonly #session: McpSession;
  readonly #requestManager: McpServerRequestManager;
  readonly #audit: NonNullable<McpSamplingClientOptions["audit"]>;
  readonly #taskPlanLimiter: McpSamplingLimiter;
  readonly #episodeLimiter: McpSamplingLimiter;

  constructor(options: McpSamplingClientOptions) {
    this.#session = options.session;
    this.#requestManager = options.requestManager;
    this.#audit = options.audit ?? (() => undefined);
    this.#episodeLimiter = options.episodeLimiter ?? options.limiter ?? createMcpSamplingLimiter({ maxTokensPerMinute: 200_000, maxRequestsPerMinute: 120 });
    this.#taskPlanLimiter = options.taskPlanLimiter ?? options.limiter ?? createMcpSamplingLimiter({ maxTokensPerMinute: 120_000, maxRequestsPerMinute: 60 });
  }

  async createMessage(
    input: McpSamplingCreateMessageInput,
    context: McpSamplingCallContext,
  ): Promise<McpSamplingOutcome> {
    if (!context.activeClientRequest) return failure("not_active_client_request");
    try {
      this.#session.assertInitialized();
    } catch (error: unknown) {
      if (error instanceof McpSessionError) return failure("session_not_initialized");
      throw error;
    }
    if (!this.#session.supportsClientCapability("sampling")) return failure("capability_absent");

    const permit = this.#episodeLimiter.acquire(input.maxTokens);
    if ("denied" in permit) {
      this.#audit("sampling_terminal", { fallback: "rate_limited", limitReason: permit.denied });
      return failure("rate_limited", permit.denied);
    }

    try {
      const params = buildMcpSamplingCreateMessageParams(input);
      let wireResult: unknown;
      try {
        wireResult = await this.#requestManager.request("sampling/createMessage", params, {
          signal: context.signal,
          softTimeoutMs: context.softTimeoutMs,
          absoluteTimeoutMs: context.absoluteTimeoutMs,
        });
      } catch (error: unknown) {
        if (!(error instanceof McpServerRequestError)) throw error;
        const fallback = remoteFallback(error);
        this.#audit("sampling_terminal", { fallback });
        return failure(fallback);
      }

      try {
        const parsed = parseJourneySamplingResult(wireResult);
        this.#audit("sampling_terminal", {
          outcome: "success",
          ...(parsed.audit.model ? { model: parsed.audit.model } : {}),
          ...(parsed.audit.stopReason ? { stopReason: parsed.audit.stopReason } : {}),
        });
        return Object.freeze({
          ok: true,
          source: "sampling_advice",
          trust: "untrusted_client",
          decision: parsed.decision,
          audit: parsed.audit,
        });
      } catch (error: unknown) {
        if (!(error instanceof McpSamplingSchemaError)) throw error;
        this.#audit("sampling_terminal", { fallback: "invalid_result", schemaError: error.code });
        return failure("invalid_result");
      }
    } finally {
      permit.release();
    }
  }

  async createTaskPlanMessage(
    input: McpSamplingCreateMessageInput,
    context: McpSamplingCallContext,
  ): Promise<McpTaskSamplingOutcome> {
    const failed = (fallback: McpSamplingFallback, limitReason?: McpSamplingLimitReason): McpTaskSamplingOutcome => Object.freeze({
      ok: false,
      source: "task_plan_sampling",
      trust: "untrusted_client",
      fallback,
      ...(limitReason ? { limitReason } : {}),
    });
    if (!context.activeClientRequest) return failed("not_active_client_request");
    try {
      this.#session.assertInitialized();
    } catch (error: unknown) {
      if (error instanceof McpSessionError) return failed("session_not_initialized");
      throw error;
    }
    if (!this.#session.supportsClientCapability("sampling")) return failed("capability_absent");
    const permit = this.#taskPlanLimiter.acquire(input.maxTokens);
    if ("denied" in permit) {
      this.#audit("task_plan_sampling_terminal", { fallback: "rate_limited", limitReason: permit.denied });
      return failed("rate_limited", permit.denied);
    }
    try {
      let wireResult: unknown;
      try {
        wireResult = await this.#requestManager.request(
          "sampling/createMessage",
          buildMcpTaskSamplingCreateMessageParams(input),
          {
            signal: context.signal,
            softTimeoutMs: context.softTimeoutMs,
            absoluteTimeoutMs: context.absoluteTimeoutMs,
          },
        );
      } catch (error: unknown) {
        if (!(error instanceof McpServerRequestError)) throw error;
        const fallback = remoteFallback(error);
        this.#audit("task_plan_sampling_terminal", { fallback });
        return failed(fallback);
      }
      try {
        const parsed = parseJourneyTaskSamplingResult(wireResult);
        this.#audit("task_plan_sampling_terminal", {
          outcome: "success",
          ...(parsed.audit.model ? { model: parsed.audit.model } : {}),
          ...(parsed.audit.stopReason ? { stopReason: parsed.audit.stopReason } : {}),
        });
        return Object.freeze({
          ok: true,
          source: "task_plan_sampling",
          trust: "untrusted_client",
          proposal: parsed.proposal,
          audit: parsed.audit,
        });
      } catch (error: unknown) {
        if (!(error instanceof McpSamplingSchemaError)) throw error;
        this.#audit("task_plan_sampling_terminal", { fallback: "invalid_result", schemaError: error.code });
        return failed("invalid_result");
      }
    } finally {
      permit.release();
    }
  }
}

export function createMcpSamplingClient(options: McpSamplingClientOptions) {
  return new McpSamplingClient(options);
}
