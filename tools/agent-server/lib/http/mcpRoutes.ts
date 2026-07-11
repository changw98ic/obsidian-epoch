import { timingSafeEqual } from "node:crypto";
import { type IncomingMessage, type ServerResponse } from "node:http";
import {
  handleMcpJsonRpcMessage,
  type McpJsonRpcRuntime,
  mcpJsonRpcErrorResponse,
} from "../mcpJsonRpc.ts";
import {
  runWithMcpRequestAuthContext,
  type McpRequestAuthContext,
} from "../mcpRequestAuthContext.ts";
import type { PlayerMcpAccessTokenStore } from "../playerMcpAccessTokenStore.ts";
import { type EpochHttpRouteContext } from "./httpRouteTypes.ts";

type JsonRecord = Record<string, unknown>;

type McpRouteContext = EpochHttpRouteContext & {
  readonly mcpRuntime: McpJsonRpcRuntime;
  readonly mcpBearerToken?: string;
  readonly playerMcpAccessTokens?: PlayerMcpAccessTokenStore;
  readonly publicServerBase: string;
  readonly persistMcpJsonRpcPayload: (requestBody: JsonRecord, jsonRpcResult: unknown) => Promise<unknown>;
  readonly persistMcpToolPayload: (toolName: string, toolResult: unknown) => Promise<unknown>;
  readonly sendEmpty: (
    request: IncomingMessage,
    response: ServerResponse,
    status: number,
    allowedOrigins: string[],
  ) => void;
};

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function recordValue(value: unknown): JsonRecord {
  return isRecord(value) ? value : {};
}

function isRequestOriginAllowed(request: IncomingMessage, allowedOrigins: readonly string[]) {
  const origin = request.headers.origin;
  return !origin || allowedOrigins.includes(origin);
}

const PROTECTED_MCP_PATHS = new Set([
  "/mcp",
  "/api/epoch/mcp",
  "/api/epoch/mcp/tools/list",
  "/api/epoch/mcp/tools/call",
]);

function requestBearerToken(request: IncomingMessage): string | undefined {
  const rawHeader = request.headers.authorization;
  const authorization = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;
  if (!authorization?.startsWith("Bearer ")) return undefined;
  const token = authorization.slice("Bearer ".length).trim();
  return token || undefined;
}

function bearerTokenMatches(providedToken: string, expectedToken: string) {
  const provided = Buffer.from(providedToken, "utf8");
  const expected = Buffer.from(expectedToken, "utf8");
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

function authenticateMcpRequest(
  request: IncomingMessage,
  expectedToken: string | undefined,
  playerTokens: PlayerMcpAccessTokenStore | undefined,
): McpRequestAuthContext | undefined {
  if (!expectedToken && !playerTokens) return { kind: "bootstrap" };
  const providedToken = requestBearerToken(request);
  if (!providedToken) return undefined;
  if (expectedToken && bearerTokenMatches(providedToken, expectedToken)) return { kind: "bootstrap" };
  const playerToken = playerTokens?.authenticate(providedToken);
  return playerToken
    ? { kind: "player", explorerId: playerToken.explorerId, tokenId: playerToken.tokenId }
    : undefined;
}

function mcpJsonRpcBodyForRequest(serverBase: string, body: JsonRecord) {
  const params = recordValue(body.params);
  if (body.method !== "tools/call" || params.name !== "obsidian_epoch.quickstart") return body;
  const args = recordValue(params.arguments);
  return {
    ...body,
    params: {
      ...params,
      arguments: {
        serverBase,
        ...args,
      },
    },
  };
}

export async function handleEpochMcpRoutes(context: McpRouteContext): Promise<boolean> {
  const {
    allowedOrigins,
    maxBodyBytes,
    mcpBearerToken,
    mcpRuntime,
    method,
    pathname,
    publicServerBase,
    playerMcpAccessTokens,
    request,
    response,
  } = context;

  const requestAuth = PROTECTED_MCP_PATHS.has(pathname)
    ? authenticateMcpRequest(request, mcpBearerToken, playerMcpAccessTokens)
    : undefined;
  if (PROTECTED_MCP_PATHS.has(pathname) && !requestAuth) {
    response.setHeader("www-authenticate", "Bearer realm=\"obsidian-epoch-mcp\"");
    const body = pathname === "/mcp" || pathname === "/api/epoch/mcp"
      ? mcpJsonRpcErrorResponse(null, -32001, "authentication_required")
      : { error: "mcp_auth_required" };
    context.sendJson(request, response, 401, body, allowedOrigins);
    return true;
  }

  if (pathname === "/mcp" || pathname === "/api/epoch/mcp") {
    if (!isRequestOriginAllowed(request, allowedOrigins)) {
      context.sendJson(request, response, 403, mcpJsonRpcErrorResponse(null, -32000, "origin_not_allowed"), allowedOrigins);
      return true;
    }
    if (method === "GET") {
      context.sendJson(request, response, 405, mcpJsonRpcErrorResponse(null, -32000, "method_not_allowed"), allowedOrigins);
      return true;
    }
    if (method === "POST") {
      const body = await context.readJsonBody(request, maxBodyBytes);
      const mcpBody = mcpJsonRpcBodyForRequest(publicServerBase, body);
      const result = await runWithMcpRequestAuthContext(
        requestAuth || { kind: "bootstrap" },
        () => handleMcpJsonRpcMessage(mcpRuntime, mcpBody),
      );
      if (!result) {
        context.sendEmpty(request, response, 202, allowedOrigins);
        return true;
      }
      await context.persistMcpJsonRpcPayload(mcpBody, result);
      context.sendJson(request, response, 200, result, allowedOrigins);
      return true;
    }
    context.sendJson(request, response, 405, mcpJsonRpcErrorResponse(null, -32000, "method_not_allowed"), allowedOrigins);
    return true;
  }

  if (method === "GET" && pathname === "/api/epoch/mcp/tools/list") {
    context.sendJson(request, response, 200, { tools: mcpRuntime.listTools() }, allowedOrigins);
    return true;
  }

  if (method === "POST" && pathname === "/api/epoch/mcp/tools/call") {
    const body = await context.readJsonBody(request, maxBodyBytes);
    const toolName = typeof body.name === "string" ? body.name : "";
    if (!toolName) throw new Error("mcp_tool_name_required");
    const toolArguments = recordValue(body.arguments);
    const result = await runWithMcpRequestAuthContext(
      requestAuth || { kind: "bootstrap" },
      () => mcpRuntime.callTool(toolName, toolArguments),
    );
    await context.persistMcpToolPayload(toolName, result);
    context.sendJson(request, response, 200, result, allowedOrigins);
    return true;
  }

  return false;
}
