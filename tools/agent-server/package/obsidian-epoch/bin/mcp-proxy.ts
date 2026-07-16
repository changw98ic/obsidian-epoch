import http from "node:http";
import https from "node:https";
import readline from "node:readline";
import { pathToFileURL } from "node:url";

type AnyRecord = Record<string, unknown>;

interface JsonRpcMessage extends AnyRecord {
  readonly jsonrpc?: string;
  readonly id?: unknown;
  readonly method?: string;
  readonly params?: AnyRecord;
}

interface RemoteResponse {
  readonly status: number;
  readonly headers: http.IncomingHttpHeaders;
  readonly body?: AnyRecord;
}

const protocolVersion = "2025-06-18";
const serverBase = (process.env.AGENT_WORLD_SERVER || "http://127.0.0.1:8787").replace(/\/+$/, "");
const endpoint = new URL("/mcp", `${serverBase}/`);
const mcpToken = (process.env.AGENT_WORLD_MCP_TOKEN || "").trim();
const remoteRequestTimeoutMs = 30_000;
const remoteShutdownTimeoutMs = 1_000;
const remoteRequestMaxAttempts = 3;
const retryableTransportErrorCodes = new Set([
  "EAI_AGAIN",
  "ECONNREFUSED",
  "ECONNRESET",
  "EHOSTUNREACH",
  "ENETDOWN",
  "ENETUNREACH",
  "EPIPE",
  "ETIMEDOUT",
]);
const httpAgent = new http.Agent({ keepAlive: true, keepAliveMsecs: 1_000, maxSockets: 8, maxFreeSockets: 2 });
const httpsAgent = new https.Agent({ keepAlive: true, keepAliveMsecs: 1_000, maxSockets: 8, maxFreeSockets: 2 });
let remoteSessionId = "";
let remoteProtocolVersion = protocolVersion;
let lastEventId = "";
let eventStreamRequest: http.ClientRequest | undefined;
let eventStreamReady: Promise<void> | undefined;
let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
let remoteClosing = false;
let writeTail: Promise<void> = Promise.resolve();
let clientMessageTail: Promise<void> = Promise.resolve();

function transportFor(url: URL) {
  return url.protocol === "https:" ? https : http;
}

function agentFor(url: URL) {
  return url.protocol === "https:" ? httpsAgent : httpAgent;
}

function destroyRemoteAgents() {
  httpAgent.destroy();
  httpsAgent.destroy();
}

function authorizationHeaders() {
  return mcpToken ? { authorization: `Bearer ${mcpToken}` } : {};
}

function sessionHeaders() {
  return remoteSessionId ? {
    "mcp-session-id": remoteSessionId,
    "mcp-protocol-version": remoteProtocolVersion,
  } : {};
}

function response(id: unknown, result: unknown) {
  return { jsonrpc: "2.0", id, result };
}

function errorResponse(id: unknown, code: number, message: string, data?: unknown) {
  return {
    jsonrpc: "2.0",
    id: id ?? null,
    error: { code, message, ...(data === undefined ? {} : { data }) },
  };
}

function writeJson(message: AnyRecord) {
  const line = `${JSON.stringify(message)}\n`;
  const write = () => new Promise<void>((resolve, reject) => {
    process.stdout.write(line, (error) => error ? reject(error) : resolve());
  });
  const queued = writeTail.then(write, write);
  writeTail = queued.catch(() => undefined);
  return queued;
}

interface RemoteRequestOptions {
  readonly maxAttempts?: number;
  readonly timeoutMs?: number;
}

function retryableTransportError(error: unknown) {
  const code = error && typeof error === "object" && "code" in error
    ? String((error as NodeJS.ErrnoException).code || "")
    : "";
  return retryableTransportErrorCodes.has(code);
}

function requestRemoteOnce(
  method: string,
  payload: string | undefined,
  extraHeaders: Record<string, string>,
  timeoutMs: number,
) {
  return new Promise<RemoteResponse>((resolve, reject) => {
    const request = transportFor(endpoint).request({
      protocol: endpoint.protocol,
      hostname: endpoint.hostname,
      port: endpoint.port,
      path: `${endpoint.pathname}${endpoint.search}`,
      method,
      agent: agentFor(endpoint),
      headers: {
        accept: "application/json, text/event-stream",
        ...authorizationHeaders(),
        ...sessionHeaders(),
        ...extraHeaders,
        ...(payload === undefined ? {} : {
          "content-type": "application/json",
          "content-length": String(Buffer.byteLength(payload)),
        }),
      },
    }, (remote) => {
      let text = "";
      remote.setEncoding("utf8");
      remote.on("data", (chunk: string) => { text += chunk; });
      remote.once("error", reject);
      remote.once("end", () => {
        let parsed: AnyRecord | undefined;
        if (text.trim()) {
          try {
            const value = JSON.parse(text) as unknown;
            if (value && typeof value === "object" && !Array.isArray(value)) parsed = value as AnyRecord;
          } catch {
            reject(new Error("remote_mcp_invalid_json"));
            return;
          }
        }
        resolve({ status: remote.statusCode || 0, headers: remote.headers, body: parsed });
      });
    });
    const timeout = setTimeout(() => {
      const error = new Error("remote_mcp_request_timeout") as NodeJS.ErrnoException;
      error.code = "ETIMEDOUT";
      request.destroy(error);
    }, timeoutMs);
    timeout.unref();
    request.once("close", () => clearTimeout(timeout));
    request.once("error", reject);
    request.end(payload);
  });
}

async function requestRemote(
  method: string,
  body?: AnyRecord,
  extraHeaders: Record<string, string> = {},
  options: RemoteRequestOptions = {},
) {
  const payload = body === undefined ? undefined : JSON.stringify(body);
  const maxAttempts = Math.max(1, Math.floor(options.maxAttempts || remoteRequestMaxAttempts));
  const timeoutMs = Math.max(1, Math.floor(options.timeoutMs || remoteRequestTimeoutMs));
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await requestRemoteOnce(method, payload, extraHeaders, timeoutMs);
    } catch (error) {
      lastError = error;
      if (attempt >= maxAttempts || !retryableTransportError(error)) throw error;
      await new Promise((resolve) => setTimeout(resolve, 150 * attempt));
    }
  }
  throw lastError;
}

function remoteError(result: RemoteResponse) {
  const error = result.body?.error;
  if (error && typeof error === "object" && !Array.isArray(error)) {
    const message = (error as AnyRecord).message;
    if (typeof message === "string") return message;
  }
  return `remote_mcp_request_failed_${result.status}`;
}

async function postRemote(message: JsonRpcMessage) {
  const result = await requestRemote("POST", message);
  if (result.status < 200 || result.status >= 300) throw new Error(remoteError(result));
  return result;
}

function consumeSseChunk(state: { buffer: string }, chunk: string) {
  state.buffer += chunk;
  let boundary = state.buffer.indexOf("\n\n");
  while (boundary >= 0) {
    const frame = state.buffer.slice(0, boundary);
    state.buffer = state.buffer.slice(boundary + 2);
    const lines = frame.split("\n");
    const idLine = lines.find((line) => line.startsWith("id: "));
    if (idLine) lastEventId = idLine.slice(4);
    const data = lines.filter((line) => line.startsWith("data: ")).map((line) => line.slice(6)).join("\n");
    if (data) {
      try {
        const parsed = JSON.parse(data) as unknown;
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) void writeJson(parsed as AnyRecord);
      } catch {
        void writeJson(errorResponse(null, -32700, "remote_sse_parse_error"));
      }
    }
    boundary = state.buffer.indexOf("\n\n");
  }
}

function openEventStream(): Promise<void> {
  if (!remoteSessionId) return Promise.reject(new Error("remote_mcp_session_missing"));
  if (eventStreamReady) return eventStreamReady;
  const state = { buffer: "" };
  let resolveReady!: () => void;
  let rejectReady!: (error: Error) => void;
  eventStreamReady = new Promise<void>((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });
  const request = transportFor(endpoint).request({
    protocol: endpoint.protocol,
    hostname: endpoint.hostname,
    port: endpoint.port,
    path: `${endpoint.pathname}${endpoint.search}`,
    method: "GET",
    agent: agentFor(endpoint),
    headers: {
      accept: "text/event-stream",
      connection: "keep-alive",
      ...authorizationHeaders(),
      ...sessionHeaders(),
      ...(lastEventId ? { "last-event-id": lastEventId } : {}),
    },
  }, (remote) => {
    if (remote.statusCode !== 200) {
      eventStreamRequest = undefined;
      eventStreamReady = undefined;
      remote.resume();
      rejectReady(new Error(`remote_mcp_sse_failed_${remote.statusCode}`));
      return;
    }
    resolveReady();
    remote.setEncoding("utf8");
    remote.on("data", (chunk: string) => consumeSseChunk(state, chunk));
    remote.once("close", () => {
      eventStreamRequest = undefined;
      eventStreamReady = undefined;
      scheduleEventStreamReconnect();
    });
  });
  request.once("error", (error) => {
    eventStreamRequest = undefined;
    eventStreamReady = undefined;
    rejectReady(error);
    scheduleEventStreamReconnect();
  });
  request.end();
  eventStreamRequest = request;
  return eventStreamReady;
}

function scheduleEventStreamReconnect() {
  if (remoteClosing || !remoteSessionId || reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = undefined;
    void openEventStream().catch(() => scheduleEventStreamReconnect());
  }, 250);
}

async function closeRemoteSession() {
  remoteClosing = true;
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = undefined;
  eventStreamRequest?.destroy();
  eventStreamRequest = undefined;
  eventStreamReady = undefined;
  if (!remoteSessionId) return;
  try {
    await requestRemote("DELETE", undefined, {}, {
      maxAttempts: 1,
      timeoutMs: remoteShutdownTimeoutMs,
    });
  } catch {
    // The local Host is already disconnecting; remote cleanup is best effort.
  }
  remoteSessionId = "";
}

function isJsonRpcResponse(message: JsonRpcMessage) {
  return message.jsonrpc === "2.0"
    && typeof message.method !== "string"
    && Object.prototype.hasOwnProperty.call(message, "id")
    && (Object.prototype.hasOwnProperty.call(message, "result") || Object.prototype.hasOwnProperty.call(message, "error"));
}

function isPriorityClientMessage(message: JsonRpcMessage) {
  return isJsonRpcResponse(message)
    || message.method === "notifications/cancelled"
    || message.method === "notifications/progress";
}

export async function handleJsonRpcMessage(message: JsonRpcMessage) {
  if (!message || message.jsonrpc !== "2.0") return errorResponse(message?.id, -32600, "Invalid Request");
  if (isJsonRpcResponse(message)) {
    await postRemote(message);
    return null;
  }
  if (message.method === "initialize") {
    remoteClosing = false;
    const remote = await requestRemote("POST", message);
    if (remote.status !== 200 || !remote.body) throw new Error(remoteError(remote));
    const sessionHeader = remote.headers["mcp-session-id"];
    remoteSessionId = Array.isArray(sessionHeader) ? sessionHeader[0] : sessionHeader || "";
    const versionHeader = remote.headers["mcp-protocol-version"];
    remoteProtocolVersion = (Array.isArray(versionHeader) ? versionHeader[0] : versionHeader) || protocolVersion;
    if (!remoteSessionId) throw new Error("remote_mcp_session_missing");
    return remote.body;
  }
  if (!remoteSessionId) return errorResponse(message.id, -32002, "mcp_session_not_initialized");
  const remote = await postRemote(message);
  if (message.method === "notifications/initialized") {
    await openEventStream();
    return null;
  }
  return remote.body || (Object.prototype.hasOwnProperty.call(message, "id")
    ? errorResponse(message.id, -32603, "remote_mcp_empty_response")
    : null);
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  const lines = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
  lines.on("line", (line) => {
    if (!line.trim()) return;
    let parsed: JsonRpcMessage;
    try {
      parsed = JSON.parse(line) as JsonRpcMessage;
    } catch {
      void writeJson(errorResponse(null, -32700, "Parse error"));
      return;
    }
    const handle = () => handleJsonRpcMessage(parsed)
      .then((result) => result ? writeJson(result) : undefined)
      .catch((error: unknown) => writeJson(errorResponse(
        parsed.id,
        error instanceof Error && /auth|401|403/.test(error.message) ? -32001 : -32603,
        error instanceof Error ? error.message : "internal_error",
      )));
    if (isPriorityClientMessage(parsed)) {
      void handle();
    } else {
      const queued = clientMessageTail.then(handle, handle);
      clientMessageTail = queued.then(() => undefined, () => undefined);
    }
  });
  let shutdownPromise: Promise<void> | undefined;
  const shutdown = () => {
    shutdownPromise ||= closeRemoteSession()
      .then(() => writeTail)
      .finally(destroyRemoteAgents);
    return shutdownPromise;
  };
  lines.once("close", () => { void shutdown(); });
  process.once("SIGTERM", () => { void shutdown().finally(() => process.exit(0)); });
  process.once("SIGINT", () => { void shutdown().finally(() => process.exit(0)); });
}
