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
import {
  type PublicRegistrationProtectionConfig,
  PERMISSIVE_PUBLIC_REGISTRATION_PROTECTION,
  derivePublicRegistrationActor,
} from "../publicRegistrationProtection.ts";
import type { McpHttpSessionRegistry, McpHttpSessionRecord } from "../mcpHttpTransport.ts";
import { MCP_SESSION_PROTOCOL_VERSION } from "../mcpSession.ts";
import type { EpochMutationCoordinator } from "../epochPersistence.ts";
import {
  markMcpResultAlreadyPersisted,
  runWithMcpRequestContext,
} from "../mcpRequestContext.ts";
import { type EpochHttpRouteContext } from "./httpRouteTypes.ts";
import { bearerTokenFromRequest } from "./playerBearerPrincipal.ts";

type JsonRecord = Record<string, unknown>;

type McpRouteContext = EpochHttpRouteContext & {
  readonly mcpRuntime: McpJsonRpcRuntime;
  readonly mcpHttpSessions: McpHttpSessionRegistry;
  readonly mcpMutationCoordinator: EpochMutationCoordinator;
  readonly mcpBearerToken?: string;
  readonly playerMcpAccessTokens?: PlayerMcpAccessTokenStore;
  readonly playerMcpTokenTtlMs: number;
  readonly publicRegistrationProtection?: PublicRegistrationProtectionConfig;
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
    : auth.kind;
}

const ANONYMOUS_MCP_TOOL_NAMES = new Set([
  "obsidian_epoch.quickstart",
  "obsidian_epoch.register_explorer",
]);

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
      markMcpResultAlreadyPersisted(partialResult);
    },
    {
      runMutation: context.mcpMutationCoordinator.run,
      supportsPhase6CommittedResultAtomicWrite: true as const,
    },
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

function textPayload(toolResult: unknown): JsonRecord {
  const result = recordValue(toolResult);
  const content = Array.isArray(result.content) ? result.content : [];
  const first = recordValue(content[0]);
  if (typeof first.text !== "string") throw new Error("mcp_bootstrap_registration_invalid");
  try {
    return recordValue(JSON.parse(first.text));
  } catch {
    throw new Error("mcp_bootstrap_registration_invalid");
  }
}

function copyMcpPersistenceMetadata(source: unknown, target: JsonRecord) {
  if (!source || typeof source !== "object") return;
  for (const key of ["events", "journeyEvents", "phase6CommittedResults"] as const) {
    const descriptor = Object.getOwnPropertyDescriptor(source, key);
    if (descriptor) Object.defineProperty(target, key, descriptor);
  }
}

function requirePlayerTokenStore(store: PlayerMcpAccessTokenStore | undefined) {
  if (!store) throw new Error("player_mcp_access_tokens_unavailable");
  return store;
}

async function admitAnonymousMcpRegistration(context: McpRouteContext) {
  const config = context.publicRegistrationProtection || PERMISSIVE_PUBLIC_REGISTRATION_PROTECTION;
  if (config.mode === "permissive") return;
  const store = requirePlayerTokenStore(context.playerMcpAccessTokens);
  if (!store.persistent) throw new Error("public_registration_protection_unavailable");
  const actor = derivePublicRegistrationActor(context.request, config);
  await store.consumePublicCredentialAction({
    action: "pairing_registration",
    actorHashes: actor.actorHashes,
    windowMs: config.windowMs,
    maxActions: config.maxActions,
    cooldownMs: config.cooldownMs,
  });
}

async function registerAnonymousMcpExplorer(context: McpRouteContext, args: JsonRecord) {
  await admitAnonymousMcpRegistration(context);
  const registeredToolResult = await context.mcpRuntime.callTool("obsidian_epoch.register_explorer", args);
  const registration = textPayload(registeredToolResult);
  const explorerId = typeof registration.explorerId === "string" ? registration.explorerId : "";
  const recoveryCode = typeof registration.recoveryCode === "string" ? registration.recoveryCode : "";
  const identity = recordValue(registration.value);
  const agentId = typeof identity.agentId === "string" ? identity.agentId : "";
  if (!explorerId || !agentId || !recoveryCode) throw new Error("mcp_bootstrap_registration_invalid");
  const access = await requirePlayerTokenStore(context.playerMcpAccessTokens).issue({
    explorerId,
    ttlMs: context.playerMcpTokenTtlMs,
  });
  const result: JsonRecord = {
    content: [{
      type: "text",
      text: JSON.stringify({
        explorerId,
        agentId,
        identityName: typeof identity.identityName === "string" ? identity.identityName : undefined,
        credentialStored: "proxy",
        tokenExpiresAt: access.record.expiresAt,
        proxyCredential: {
          accessToken: access.bearerToken,
          recoveryCode,
        },
      }, null, 2),
    }],
  };
  copyMcpPersistenceMetadata(registeredToolResult, result);
  return result;
}

function mcpRuntimeForRequest(
  context: McpRouteContext,
  requestAuth: McpRequestAuthContext,
): McpJsonRpcRuntime {
  if (requestAuth.kind !== "anonymous") return context.mcpRuntime;
  return {
    ...context.mcpRuntime,
    listTools: () => context.mcpRuntime.listTools()
      .filter((tool) => ANONYMOUS_MCP_TOOL_NAMES.has(String(tool.name))),
    callTool: async (name, args = {}) => {
      if (!ANONYMOUS_MCP_TOOL_NAMES.has(name)) throw new Error("mcp_bootstrap_tool_forbidden");
      if (name === "obsidian_epoch.register_explorer") {
        return registerAnonymousMcpExplorer(context, args);
      }
      return context.mcpRuntime.callTool(name, args);
    },
  };
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
  const providedToken = bearerTokenFromRequest(request);
  if (!providedToken) return playerTokens ? { kind: "anonymous" } : undefined;
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
      const requestRuntime = mcpRuntimeForRequest(context, requestAuth || { kind: "bootstrap" });
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
          () => handleMcpJsonRpcMessage(requestRuntime, mcpBody, {
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
          () => handleMcpJsonRpcMessage(requestRuntime, mcpBody, {
            session: resolved.record?.session,
            sampling: resolved.record?.sampling,
            notify: (notification) => mcpHttpSessions.notify(resolved.record as McpHttpSessionRecord, notification),
            persistPartial: stagedPartialPersistence(context),
          }),
        );
        const executeAndPersist = async () => {
          const result = await execute();
          if (result) await context.persistMcpJsonRpcPayload(mcpBody, result);
          return result;
        };
        const startedAt = Date.now();
        const isToolCall = mcpBody.method === "tools/call";
        let succeeded = false;
        let result;
        try {
          result = await mcpHttpSessions.runOnStream(streamId, () =>
            serializedToolCall(mcpBody)
              ? mcpMutationCoordinator.run(executeAndPersist)
              : executeAndPersist());
          succeeded = true;
        } finally {
          if (isToolCall) mcpHttpSessions.noteToolCall(Date.now() - startedAt, succeeded);
        }
        if (result) {
          mcpHttpSessions.sendOnStream(resolved.record, streamId, result);
        }
        mcpHttpSessions.closeStream(resolved.record, streamId);
        return true;
      }
      const execute = () => runWithMcpRequestAuthContext(
        requestAuth || { kind: "bootstrap" },
        () => handleMcpJsonRpcMessage(requestRuntime, mcpBody, {
          session: resolved.record?.session,
          sampling: resolved.record?.sampling,
          notify: (notification) => mcpHttpSessions.notify(resolved.record as McpHttpSessionRecord, notification),
          persistPartial: stagedPartialPersistence(context),
        }),
      );
      const executeAndPersist = async () => {
        const result = await execute();
        if (result) await context.persistMcpJsonRpcPayload(mcpBody, result);
        return result;
      };
      const startedAt = Date.now();
      const isToolCall = mcpBody.method === "tools/call";
      let succeeded = false;
      let result;
      try {
        result = serializedToolCall(mcpBody)
          ? await mcpMutationCoordinator.run(executeAndPersist)
          : await executeAndPersist();
        succeeded = true;
      } finally {
        if (isToolCall) mcpHttpSessions.noteToolCall(Date.now() - startedAt, succeeded);
      }
      if (!result) {
        context.sendEmpty(request, response, 202, allowedOrigins);
        return true;
      }
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
    const requestRuntime = mcpRuntimeForRequest(context, requestAuth || { kind: "bootstrap" });
    context.sendJson(request, response, 200, { tools: requestRuntime.listTools() }, allowedOrigins);
    return true;
  }

  if (method === "POST" && pathname === "/api/epoch/mcp/tools/call") {
    const body = await context.readJsonBody(request, maxBodyBytes);
    const toolName = typeof body.name === "string" ? body.name : "";
    if (!toolName) throw new Error("mcp_tool_name_required");
    const toolArguments = recordValue(body.arguments);
    const partialPersistence = stagedPartialPersistence(context);
    const requestRuntime = mcpRuntimeForRequest(context, requestAuth || { kind: "bootstrap" });
    const result = await runWithMcpRequestAuthContext(
      requestAuth || { kind: "bootstrap" },
      () => runWithMcpRequestContext({
        activeClientRequest: true,
        clientRequestId: toolArguments.idempotencyKey || `${toolName}:http`,
        persistPartial: partialPersistence,
      }, () => requestRuntime.callTool(toolName, toolArguments)),
    );
    await context.persistMcpToolPayload(toolName, result);
    context.sendJson(request, response, 200, result, allowedOrigins);
    return true;
  }

  return false;
}
