type JsonRecord = Record<string, unknown>;

export interface McpJsonRpcRuntime {
  readonly protocolVersion: string;
  readonly serverInfo: JsonRecord;
  readonly capabilities: JsonRecord;
  listTools: () => readonly JsonRecord[];
  callTool: (name: string, args?: JsonRecord) => Promise<JsonRecord>;
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
    "idempotency_key_conflict",
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

export async function handleMcpJsonRpcMessage(mcp: McpJsonRpcRuntime, message: JsonRecord) {
  if (!message || message.jsonrpc !== "2.0") {
    return mcpJsonRpcErrorResponse(message?.id, -32600, "Invalid Request");
  }

  const { id, method, params } = message;

  if (method === "notifications/initialized") return null;

  try {
    if (method === "initialize") {
      return mcpJsonRpcResponse(id, {
        protocolVersion: mcp.protocolVersion,
        capabilities: mcp.capabilities,
        serverInfo: mcp.serverInfo,
      });
    }
    if (method === "tools/list") {
      return mcpJsonRpcResponse(id, { tools: mcp.listTools() });
    }
    if (method === "tools/call") {
      if (!isRecord(params) || typeof params.name !== "string") {
        return mcpJsonRpcErrorResponse(id, -32602, "tools/call requires params.name");
      }
      return mcpJsonRpcResponse(id, await mcp.callTool(params.name, isRecord(params.arguments) ? params.arguments : {}));
    }
    return mcpJsonRpcErrorResponse(id, -32601, `Method not found: ${method}`);
  } catch (error: unknown) {
    const messageText = errorMessage(error);
    if (messageText.startsWith("unknown_tool:")) return mcpJsonRpcErrorResponse(id, -32602, messageText);
    if (isRecord(error) && error.code === "api_key_detected") return mcpJsonRpcErrorResponse(id, -32602, "api_key_detected");
    if (parameterErrorCodes().includes(messageText)) {
      return mcpJsonRpcErrorResponse(id, -32602, messageText);
    }
    return mcpJsonRpcErrorResponse(id, -32603, "internal_error", { message: messageText });
  }
}
