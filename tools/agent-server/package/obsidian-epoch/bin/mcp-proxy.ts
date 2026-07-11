import readline from "node:readline";
import { pathToFileURL } from "node:url";

type AnyRecord = Record<string, unknown>;

interface JsonRpcMessage {
  readonly jsonrpc?: string;
  readonly id?: unknown;
  readonly method?: string;
  readonly params?: AnyRecord;
}

interface McpTool {
  readonly name: string;
  readonly description?: string;
  readonly inputSchema: AnyRecord;
}

const protocolVersion = "2025-06-18";
const serverInfo = {
  name: "obsidian-epoch-agent-world",
  version: "0.1.0",
};
const serverBase = (process.env.AGENT_WORLD_SERVER || "http://127.0.0.1:8787").replace(/\/+$/, "");
const mcpToken = (process.env.AGENT_WORLD_MCP_TOKEN || "").trim();
let cachedTools: readonly McpTool[] | null = null;

function authorizationHeaders(): Record<string, string> {
  return mcpToken ? { authorization: `Bearer ${mcpToken}` } : {};
}

function response(id: unknown, result: unknown) {
  return { jsonrpc: "2.0", id, result };
}

function errorResponse(id: unknown, code: number, message: string, data: unknown = null) {
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

async function readJson(response: Response): Promise<AnyRecord> {
  const payload = await response.json();
  return payload && typeof payload === "object" && !Array.isArray(payload) ? payload as AnyRecord : {};
}

function toolsFromManifest(payload: AnyRecord): readonly McpTool[] {
  const names = Array.isArray(payload.tools) ? payload.tools : [];
  return names
    .filter((name): name is string => typeof name === "string" && Boolean(name))
    .map((name) => ({
      name,
      description: "Remote Obsidian Epoch tool. Use the packaged Skill instructions for arguments and trust rules.",
      inputSchema: {
        type: "object",
        additionalProperties: true,
      },
    }));
}

async function listTools(): Promise<readonly McpTool[]> {
  if (cachedTools) return cachedTools;
  const listResponse = await fetch(`${serverBase}/api/epoch/mcp/tools/list`, {
    headers: authorizationHeaders(),
  });
  if (listResponse.ok) {
    const payload = await readJson(listResponse);
    const tools = Array.isArray(payload.tools) ? payload.tools as McpTool[] : [];
    if (tools.length) {
      cachedTools = tools;
      return tools;
    }
  }
  if (listResponse.status === 401 || listResponse.status === 403) {
    const payload = await readJson(listResponse);
    throw new Error(String(payload.error || payload.message || `remote_mcp_tools_list_auth_failed_${listResponse.status}`));
  }

  const manifestResponse = await fetch(`${serverBase}/api/epoch/install-manifest`);
  if (!manifestResponse.ok) {
    throw new Error(`remote_mcp_tools_list_failed_${manifestResponse.status}`);
  }
  cachedTools = toolsFromManifest(await readJson(manifestResponse));
  return cachedTools;
}

async function callTool(name: string, args: AnyRecord = {}) {
  const forwardedArgs = name === "obsidian_epoch.quickstart" ? { serverBase, ...args } : args;
  const toolResponse = await fetch(`${serverBase}/api/epoch/mcp/tools/call`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...authorizationHeaders(),
    },
    body: JSON.stringify({ name, arguments: forwardedArgs }),
  });
  const payload = await readJson(toolResponse);
  if (!toolResponse.ok) {
    throw new Error(String(payload.error || payload.message || `remote_mcp_request_failed_${toolResponse.status}`));
  }
  return payload;
}

export async function handleJsonRpcMessage(message: JsonRpcMessage) {
  if (!message || message.jsonrpc !== "2.0") {
    return errorResponse(message?.id, -32600, "Invalid Request");
  }

  const { id, method, params } = message;
  if (method === "notifications/initialized") return null;

  try {
    if (method === "initialize") {
      return response(id, {
        protocolVersion,
        capabilities: { tools: {} },
        serverInfo,
      });
    }
    if (method === "tools/list") {
      return response(id, { tools: await listTools() });
    }
    if (method === "tools/call") {
      const toolName = params?.name;
      if (typeof toolName !== "string" || !toolName) {
        return errorResponse(id, -32602, "tools/call requires params.name");
      }
      const toolArgs = params.arguments && typeof params.arguments === "object" && !Array.isArray(params.arguments)
        ? params.arguments as AnyRecord
        : {};
      return response(id, await callTool(toolName, toolArgs));
    }
    return errorResponse(id, -32601, `Method not found: ${method || ""}`);
  } catch (error) {
    const messageText = error instanceof Error ? error.message : "internal_error";
    if (messageText === "mcp_auth_required" || messageText === "authentication_required") {
      return errorResponse(id, -32001, messageText);
    }
    const validationErrors = [
      "ticket_not_found",
      "ticket_payload_mismatch",
      "ticket_identity_required",
      "ticket_identity_mismatch",
      "agent_identity_archived",
      "agent_identity_not_found",
      "downtime_mode_invalid",
      "downtime_not_active",
      "hosted_session_not_active",
      "idempotency_key_required",
      "resource_insufficient",
    ];
    if (messageText.startsWith("unknown_tool:") || validationErrors.includes(messageText)) {
      return errorResponse(id, -32602, messageText);
    }
    return errorResponse(id, -32603, "internal_error", { message: messageText });
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  const lines = readline.createInterface({
    input: process.stdin,
    crlfDelay: Infinity,
  });

  lines.on("line", async (line) => {
    if (!line.trim()) return;
    let parsed: JsonRpcMessage;
    try {
      parsed = JSON.parse(line) as JsonRpcMessage;
    } catch {
      process.stdout.write(`${JSON.stringify(errorResponse(null, -32700, "Parse error"))}\n`);
      return;
    }

    const result = await handleJsonRpcMessage(parsed);
    if (result) process.stdout.write(`${JSON.stringify(result)}\n`);
  });
}
