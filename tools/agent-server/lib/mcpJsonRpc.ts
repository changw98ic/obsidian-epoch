import { McpSessionError, type McpSession } from "./mcpSession.ts";
import { runWithMcpRequestContext } from "./mcpRequestContext.ts";
import type { McpSamplingClient } from "./mcpSampling.ts";
import { getMcpPrompt, listMcpPrompts } from "./mcpPrompts.ts";

type JsonRecord = Record<string, unknown>;

export interface McpJsonRpcRuntime {
  readonly protocolVersion: string;
  readonly serverInfo: JsonRecord;
  readonly capabilities: JsonRecord;
  listTools: () => readonly JsonRecord[];
  callTool: (name: string, args?: JsonRecord) => Promise<JsonRecord>;
}

export interface McpJsonRpcMessageOptions {
  readonly session?: McpSession;
  readonly sampling?: McpSamplingClient;
  readonly notify?: (message: JsonRecord) => Promise<void> | void;
  readonly persistPartial?: (toolName: string, result: unknown) => Promise<void>;
}

export function mcpJsonRpcResponse(id: unknown, result: unknown) {
  return { jsonrpc: "2.0", id, result };
}

export function mcpJsonRpcErrorResponse(id: unknown, code: number, message: string, data: unknown = null) {
  return {
    jsonrpc: "2.0",
    id: id ?? null,
    error: {
      code,
      message,
      ...(data ? { data } : {}),
    },
  };
}

function parameterErrorCodes() {
  return [
    "ticket_not_found",
    "ticket_payload_mismatch",
    "ticket_identity_required",
    "ticket_identity_mismatch",
    "agent_identity_archived",
    "agent_identity_not_found",
    "downtime_mode_invalid",
    "downtime_not_active",
    "hosted_session_not_active",
    "explorer_id_required",
    "idempotency_key_conflict",
    "legacy_agent_world_tool_removed",
    "idempotency_key_required",
    "party_run_settlement_requires_server_trust",
    "resource_insufficient",
  ];
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function errorMessage(error: unknown) {
  return error instanceof Error && error.message ? error.message : "internal_error";
}

function progressToken(params: unknown): string | number | undefined {
  if (!isRecord(params) || !isRecord(params._meta)) return undefined;
  const token = params._meta.progressToken;
  return typeof token === "string" || typeof token === "number" ? token : undefined;
}

export async function handleMcpJsonRpcMessage(
  mcp: McpJsonRpcRuntime,
  message: JsonRecord,
  options: McpJsonRpcMessageOptions = {},
) {
  if (!message || message.jsonrpc !== "2.0") {
    return mcpJsonRpcErrorResponse(message?.id, -32600, "Invalid Request");
  }

  const { id, method, params } = message;

  try {
    if (method === "notifications/initialized") {
      options.session?.acceptInitializedNotification();
      return null;
    }
    if (method === "initialize") {
      const initialized = options.session?.acceptInitialize(params);
      return mcpJsonRpcResponse(id, {
        protocolVersion: initialized?.protocolVersion ?? mcp.protocolVersion,
        capabilities: mcp.capabilities,
        serverInfo: mcp.serverInfo,
      });
    }
    options.session?.assertInitialized();
    if (method === "tools/list") {
      return mcpJsonRpcResponse(id, { tools: mcp.listTools() });
    }
    if (method === "tools/call") {
      if (!isRecord(params) || typeof params.name !== "string") {
        return mcpJsonRpcErrorResponse(id, -32602, "tools/call requires params.name");
      }
      const token = progressToken(params);
      const result = await runWithMcpRequestContext({
        activeClientRequest: true,
        clientRequestId: id,
        ...(token === undefined ? {} : {
          progressToken: token,
          ...(options.notify ? { notifyProgress: async (progress: number, progressMessage: string) => {
            await options.notify?.({
              jsonrpc: "2.0",
              method: "notifications/progress",
              params: { progressToken: token, progress, total: 1, message: progressMessage },
            });
          } } : {}),
        }),
        ...(options.sampling ? { sampling: options.sampling } : {}),
        ...(options.persistPartial ? { persistPartial: options.persistPartial } : {}),
      }, () => mcp.callTool(params.name as string, isRecord(params.arguments) ? params.arguments : {}));
      return mcpJsonRpcResponse(id, result);
    }
    if (method === "prompts/list") {
      return mcpJsonRpcResponse(id, { prompts: listMcpPrompts() });
    }
    if (method === "prompts/get") {
      if (!isRecord(params) || typeof params.name !== "string") {
        return mcpJsonRpcErrorResponse(id, -32602, "prompts/get requires params.name");
      }
      const prompt = getMcpPrompt(params.name);
      return mcpJsonRpcResponse(id, prompt);
    }
    return mcpJsonRpcErrorResponse(id, -32601, `Method not found: ${method}`);
  } catch (error: unknown) {
    if (error instanceof McpSessionError) {
      if (id === undefined) return null;
      const code = error.code === "mcp_initialize_params_invalid"
        ? -32602
        : -32002;
      return mcpJsonRpcErrorResponse(id, code, error.code, error.details ?? null);
    }
    const messageText = errorMessage(error);
    if (messageText.startsWith("unknown_tool:")) return mcpJsonRpcErrorResponse(id, -32602, messageText);
    if (messageText.startsWith("prompt_not_found:")) return mcpJsonRpcErrorResponse(id, -32602, messageText);
    if (messageText === "community_auth_player_required") {
      return mcpJsonRpcErrorResponse(id, -32001, messageText);
    }
    if (messageText === "mcp_bootstrap_tool_forbidden") {
      return mcpJsonRpcErrorResponse(id, -32001, messageText);
    }
    if (messageText === "community_rate_limited") {
      const retryAfterMs = isRecord(error) && Number.isSafeInteger(error.retryAfterMs)
        ? Number(error.retryAfterMs)
        : 1_000;
      const retryAt = isRecord(error) && typeof error.retryAt === "string" ? error.retryAt : undefined;
      return mcpJsonRpcErrorResponse(id, -32003, messageText, {
        retryAfterMs,
        ...(retryAt ? { retryAt } : {}),
      });
    }
    if (messageText === "explorer_auth_required" || messageText === "explorer_auth_invalid") {
      return mcpJsonRpcErrorResponse(id, -32001, messageText);
    }
    if (messageText.startsWith("community_")) {
      return mcpJsonRpcErrorResponse(id, -32602, messageText);
    }
    if (isRecord(error) && error.code === "api_key_detected") return mcpJsonRpcErrorResponse(id, -32602, "api_key_detected");
    if (parameterErrorCodes().includes(messageText)) {
      return mcpJsonRpcErrorResponse(id, -32602, messageText);
    }
    if (messageText.startsWith("journey_")) return mcpJsonRpcErrorResponse(id, -32602, messageText);
    return mcpJsonRpcErrorResponse(id, -32603, "internal_error", { message: messageText });
  }
}
