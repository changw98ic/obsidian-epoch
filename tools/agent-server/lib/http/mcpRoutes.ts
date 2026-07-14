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
import type { McpHttpSessionRegistry, McpHttpSessionRecord } from "../mcpHttpTransport.ts";
import { MCP_SESSION_PROTOCOL_VERSION } from "../mcpSession.ts";
import type { EpochMutationCoordinator } from "../epochPersistence.ts";
import { type EpochHttpRouteContext } from "./httpRouteTypes.ts";

type JsonRecord = Record<string, unknown>;

type McpRouteContext = EpochHttpRouteContext & {
  readonly mcpRuntime: McpJsonRpcRuntime;
  readonly mcpHttpSessions: McpHttpSessionRegistry;
  readonly mcpMutationCoordinator: EpochMutationCoordinator;
  readonly mcpBearerToken?: string;
  readonly playerMcpAccessTokens?: PlayerMcpAccessTokenStore;
  readonly publicServerBase: string;
  readonly persistMcpJsonRpcPayload: (requestBody: JsonRecord, jsonRpcResult: unknown) => Promise<unknown>;
  readonly persistMcpToolPayload: (
    toolName: string,
    toolResult: unknown,
    payloadShape?: "mcp_tool_result" | "raw_internal_partial",
  ) => Promise<unknown>;
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

function authBinding(auth: McpRequestAuthContext) {
  return auth.kind === "player"
    ? `player:${auth.explorerId}:${auth.tokenId}`
    : "bootstrap";
}

function singleHeader(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function acceptsSse(request: IncomingMessage) {
  return (singleHeader(request.headers.accept) || "").split(",")[0]?.trim().startsWith("text/event-stream") === true;
}

function isJsonRpcResponse(body: JsonRecord) {
  return body.jsonrpc === "2.0"
    && Object.prototype.hasOwnProperty.call(body, "id")
    && typeof body.method !== "string"
    && (Object.prototype.hasOwnProperty.call(body, "result") || Object.prototype.hasOwnProperty.call(body, "error"));
}

function serializedToolCall(body: JsonRecord) {
  if (body.method !== "tools/call" || !body.params || typeof body.params !== "object" || Array.isArray(body.params)) return false;
  const params = body.params as JsonRecord;
  if (params.name !== "obsidian_epoch.start_journey") return true;
  const args = recordValue(params.arguments);
  return args.decisionMode !== "host_sampling";
}

function stagedPartialPersistence(context: McpRouteContext) {
  return Object.assign(
    async (toolName: string, partialResult: unknown) => {
      await context.persistMcpToolPayload(toolName, partialResult, "raw_internal_partial");
    },
    { runMutation: context.mcpMutationCoordinator.run },
  );
}

function sessionForRequest(
  context: McpRouteContext,
  requestAuth: McpRequestAuthContext,
): { record?: McpHttpSessionRecord; error?: "missing" | "not_found" | "version" } {
  const sessionId = singleHeader(context.request.headers["mcp-session-id"]);
  if (!sessionId) return { error: "missing" };
  const record = context.mcpHttpSessions.get(sessionId, authBinding(requestAuth));
  if (!record) return { error: "not_found" };
  const version = singleHeader(context.request.headers["mcp-protocol-version"]);
  if (version !== record.session.protocolVersion) return { error: "version" };
  return { record };
}

function sendSessionError(context: McpRouteContext, error: "missing" | "not_found" | "version") {
  const status = error === "not_found" ? 404 : 400;
  const message = error === "missing"
    ? "mcp_session_id_required"
    : error === "version"
      ? "mcp_protocol_version_mismatch"
      : "mcp_session_not_found";
  context.sendJson(context.request, context.response, status, mcpJsonRpcErrorResponse(null, -32002, message), context.allowedOrigins);
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
    mcpHttpSessions,
    mcpRuntime,
    mcpMutationCoordinator,
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
      const resolved = sessionForRequest(context, requestAuth || { kind: "bootstrap" });
      if (!resolved.record) {
        sendSessionError(context, resolved.error || "not_found");
        return true;
      }
      const origin = singleHeader(request.headers.origin);
      if (origin) response.setHeader("access-control-allow-origin", origin);
      try {
        mcpHttpSessions.openStream(resolved.record, response, singleHeader(request.headers["last-event-id"]));
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "mcp_http_stream_limit";
        context.sendJson(request, response, 429, mcpJsonRpcErrorResponse(null, -32003, message), allowedOrigins);
      }
      return true;
    }
    if (method === "POST") {
      const body = await context.readJsonBody(request, maxBodyBytes);
      const mcpBody = mcpJsonRpcBodyForRequest(publicServerBase, body);
      if (mcpBody.method === "initialize") {
        const binding = authBinding(requestAuth || { kind: "bootstrap" });
        let record: McpHttpSessionRecord;
        try {
          record = mcpHttpSessions.create(binding);
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : "mcp_http_session_limit";
          context.sendJson(request, response, 429, mcpJsonRpcErrorResponse(mcpBody.id ?? null, -32003, message), allowedOrigins);
          return true;
        }
        const result = await runWithMcpRequestAuthContext(
          requestAuth || { kind: "bootstrap" },
          () => handleMcpJsonRpcMessage(mcpRuntime, mcpBody, {
            session: record.session,
            sampling: record.sampling,
            notify: (notification) => mcpHttpSessions.notify(record, notification),
            persistPartial: stagedPartialPersistence(context),
          }),
        );
        if (record.session.state !== "initializing") {
          mcpHttpSessions.close(record.session.sessionId, binding);
          context.sendJson(request, response, 400, result, allowedOrigins);
          return true;
        }
        mcpHttpSessions.noteInitialized(record);
        response.setHeader("mcp-session-id", record.session.sessionId);
        response.setHeader("mcp-protocol-version", record.session.protocolVersion || MCP_SESSION_PROTOCOL_VERSION);
        context.sendJson(request, response, 200, result, allowedOrigins);
        return true;
      }
      const resolved = sessionForRequest(context, requestAuth || { kind: "bootstrap" });
      if (!resolved.record) {
        sendSessionError(context, resolved.error || "not_found");
        return true;
      }
      if (isJsonRpcResponse(mcpBody)) {
        mcpHttpSessions.noteResponse(resolved.record.requestManager.handleResponse(mcpBody));
        context.sendEmpty(request, response, 202, allowedOrigins);
        return true;
      }
      if (acceptsSse(request) && Object.prototype.hasOwnProperty.call(mcpBody, "id")) {
        const origin = singleHeader(request.headers.origin);
        if (origin) response.setHeader("access-control-allow-origin", origin);
        let streamId: string;
        try {
          streamId = mcpHttpSessions.openStream(resolved.record, response);
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : "mcp_http_stream_limit";
          context.sendJson(request, response, 429, mcpJsonRpcErrorResponse(mcpBody.id ?? null, -32003, message), allowedOrigins);
          return true;
        }
        const execute = () => runWithMcpRequestAuthContext(
          requestAuth || { kind: "bootstrap" },
          () => handleMcpJsonRpcMessage(mcpRuntime, mcpBody, {
            session: resolved.record?.session,
            sampling: resolved.record?.sampling,
            notify: (notification) => mcpHttpSessions.notify(resolved.record as McpHttpSessionRecord, notification),
            persistPartial: stagedPartialPersistence(context),
          }),
        );
        const startedAt = Date.now();
        const isToolCall = mcpBody.method === "tools/call";
        let succeeded = false;
        let result;
        try {
          result = await mcpHttpSessions.runOnStream(streamId, () =>
            serializedToolCall(mcpBody) ? mcpMutationCoordinator.run(execute) : execute());
          succeeded = true;
        } finally {
          if (isToolCall) mcpHttpSessions.noteToolCall(Date.now() - startedAt, succeeded);
        }
        if (result) {
          await context.persistMcpJsonRpcPayload(mcpBody, result);
          mcpHttpSessions.sendOnStream(resolved.record, streamId, result);
        }
        mcpHttpSessions.closeStream(resolved.record, streamId);
        return true;
      }
      const execute = () => runWithMcpRequestAuthContext(
        requestAuth || { kind: "bootstrap" },
        () => handleMcpJsonRpcMessage(mcpRuntime, mcpBody, {
          session: resolved.record?.session,
          sampling: resolved.record?.sampling,
          notify: (notification) => mcpHttpSessions.notify(resolved.record as McpHttpSessionRecord, notification),
          persistPartial: stagedPartialPersistence(context),
        }),
      );
      const startedAt = Date.now();
      const isToolCall = mcpBody.method === "tools/call";
      let succeeded = false;
      let result;
      try {
        result = serializedToolCall(mcpBody)
          ? await mcpMutationCoordinator.run(execute)
          : await execute();
        succeeded = true;
      } finally {
        if (isToolCall) mcpHttpSessions.noteToolCall(Date.now() - startedAt, succeeded);
      }
      if (!result) {
        context.sendEmpty(request, response, 202, allowedOrigins);
        return true;
      }
      await context.persistMcpJsonRpcPayload(mcpBody, result);
      context.sendJson(request, response, 200, result, allowedOrigins);
      return true;
    }
    if (method === "DELETE") {
      const sessionId = singleHeader(request.headers["mcp-session-id"]);
      const version = singleHeader(request.headers["mcp-protocol-version"]);
      if (!sessionId) {
        sendSessionError(context, "missing");
        return true;
      }
      const record = mcpHttpSessions.get(sessionId, authBinding(requestAuth || { kind: "bootstrap" }));
      if (!record) {
        sendSessionError(context, "not_found");
        return true;
      }
      if (version !== record.session.protocolVersion) {
        sendSessionError(context, "version");
        return true;
      }
      mcpHttpSessions.close(sessionId, authBinding(requestAuth || { kind: "bootstrap" }));
      context.sendEmpty(request, response, 204, allowedOrigins);
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
