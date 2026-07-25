import { AsyncLocalStorage } from "node:async_hooks";
import { randomBytes } from "node:crypto";
import type { ServerResponse } from "node:http";
import { createMcpSamplingClient, type McpSamplingClient } from "./mcpSampling.ts";
import {
  createMcpSamplingLimiter,
  type McpSamplingLimiter,
  type McpSamplingLimiterOptions,
} from "./mcpSamplingLimiter.ts";
import { createMcpServerRequestManager, type McpServerRequestManager } from "./mcpServerRequestManager.ts";
import { createMcpSession, type McpSession } from "./mcpSession.ts";
import { createMcpTransportMetrics, type McpTransportMetrics } from "./mcpTransportMetrics.ts";

type JsonRecord = Record<string, unknown>;

interface HttpStream {
  readonly streamId: string;
  readonly response: ServerResponse;
}

interface StoredSseEvent {
  readonly streamId: string;
  readonly sequence: number;
  readonly eventId: string;
  readonly message: JsonRecord;
}

export interface McpHttpSessionRecord {
  readonly session: McpSession;
  readonly requestManager: McpServerRequestManager;
  readonly sampling: McpSamplingClient;
  readonly authBinding: string;
}

interface InternalSession extends McpHttpSessionRecord {
  readonly streams: Map<string, HttpStream>;
  readonly history: StoredSseEvent[];
  nextEventSequence: number;
  lastSeenAt: number;
}

interface BindingSamplingLimiter {
  readonly limiter: McpSamplingLimiter;
  lastReferencedAt: number;
}

type IntervalHandle = ReturnType<typeof setInterval> | number;

export interface McpHttpSessionRegistryOptions {
  readonly sessionTtlMs?: number;
  /**
   * Per-binding sampling limits use a fixed one-minute rolling window. Retain
   * an idle limiter for at least that window so closing and recreating an HTTP
   * session cannot reset its quota.
   */
  readonly samplingLimiterIdleTtlMs?: number;
  readonly maintenanceIntervalMs?: number;
  readonly now?: () => number;
  readonly maxSessions?: number;
  readonly maxSessionsPerBinding?: number;
  readonly maxStreamsPerSession?: number;
  readonly samplingLimiterOptions?: Omit<McpSamplingLimiterOptions, "now">;
  readonly setIntervalFn?: (handler: () => void, intervalMs: number) => IntervalHandle;
  readonly clearIntervalFn?: (handle: IntervalHandle) => void;
}

const MCP_SAMPLING_LIMIT_WINDOW_MS = 60_000;

const requestStream = new AsyncLocalStorage<string>();

function sseFrame(event: StoredSseEvent) {
  return `id: ${event.eventId}\nevent: message\ndata: ${JSON.stringify(event.message)}\n\n`;
}

function parsedEventId(value: string | undefined) {
  const match = value?.match(/^([A-Za-z0-9_-]+):(\d+)$/);
  return match ? { streamId: match[1], sequence: Number(match[2]) } : undefined;
}

export class McpHttpSessionRegistry {
  readonly #sessions = new Map<string, InternalSession>();
  readonly #samplingLimiters = new Map<string, BindingSamplingLimiter>();
  readonly #metrics: McpTransportMetrics;
  readonly #sessionTtlMs: number;
  readonly #samplingLimiterIdleTtlMs: number;
  readonly #maintenanceIntervalMs: number;
  readonly #now: () => number;
  readonly #maxSessions;
  readonly #maxSessionsPerBinding;
  readonly #maxStreamsPerSession;
  readonly #samplingLimiterOptions: Omit<McpSamplingLimiterOptions, "now">;
  readonly #clearIntervalFn: (handle: IntervalHandle) => void;
  #maintenanceHandle: IntervalHandle | undefined;
  #disposed = false;

  constructor(
    metrics: McpTransportMetrics = createMcpTransportMetrics(),
    options: McpHttpSessionRegistryOptions = {},
  ) {
    this.#metrics = metrics;
    this.#sessionTtlMs = options.sessionTtlMs ?? 12 * 60 * 60 * 1_000;
    this.#samplingLimiterIdleTtlMs = Math.max(
      options.samplingLimiterIdleTtlMs ?? MCP_SAMPLING_LIMIT_WINDOW_MS,
      MCP_SAMPLING_LIMIT_WINDOW_MS,
    );
    const defaultMaintenanceIntervalMs = Math.min(this.#sessionTtlMs, this.#samplingLimiterIdleTtlMs);
    const configuredMaintenanceIntervalMs = options.maintenanceIntervalMs ?? defaultMaintenanceIntervalMs;
    this.#maintenanceIntervalMs = Number.isFinite(configuredMaintenanceIntervalMs)
      ? Math.max(1, Math.floor(configuredMaintenanceIntervalMs))
      : Math.max(1, Math.floor(defaultMaintenanceIntervalMs));
    this.#now = options.now ?? Date.now;
    this.#maxSessions = options.maxSessions ?? 10_000;
    this.#maxSessionsPerBinding = options.maxSessionsPerBinding ?? 64;
    this.#maxStreamsPerSession = options.maxStreamsPerSession ?? 4;
    this.#samplingLimiterOptions = options.samplingLimiterOptions ?? { maxTokensPerMinute: 200_000, maxRequestsPerMinute: 120, maxConcurrent: 8 };
    this.#clearIntervalFn = options.clearIntervalFn
      ?? ((handle) => clearInterval(handle as ReturnType<typeof setInterval>));
    const setIntervalFn = options.setIntervalFn
      ?? ((handler: () => void, intervalMs: number) => setInterval(handler, intervalMs));
    this.#maintenanceHandle = setIntervalFn(
      () => this.#runMaintenance(),
      this.#maintenanceIntervalMs,
    );
    this.#unrefMaintenanceTimer(this.#maintenanceHandle);
  }

  create(authBinding: string): McpHttpSessionRecord {
    this.#assertActive();
    this.#runMaintenance();
    if (this.#sessions.size >= this.#maxSessions) throw new Error("mcp_http_session_limit");
    const bindingSessions = [...this.#sessions.values()].filter((record) => record.authBinding === authBinding).length;
    if (bindingSessions >= this.#maxSessionsPerBinding) throw new Error("mcp_http_binding_session_limit");
    const sessionId = randomBytes(24).toString("base64url");
    const session = createMcpSession({ sessionId, transport: "streamable-http" });
    let record: InternalSession;
    const requestManager = createMcpServerRequestManager({
      requestIdFactory: (() => {
        let sequence = 0;
        return () => `http-server-${sessionId.slice(0, 8)}-${++sequence}`;
      })(),
      send: (message) => {
        if (typeof message.method === "string" && Object.prototype.hasOwnProperty.call(message, "id")) this.#metrics.serverRequest();
        return this.#send(record, message);
      },
    });
    record = {
      session,
      requestManager,
      sampling: createMcpSamplingClient({
        session,
        requestManager,
        limiter: this.#bindingLimiter(authBinding),
        audit: (event, details) => { if (event === "sampling_terminal") this.#metrics.samplingTerminal(details); },
      }),
      authBinding,
      streams: new Map<string, HttpStream>(),
      history: [],
      nextEventSequence: 0,
      lastSeenAt: this.#now(),
    };
    this.#sessions.set(sessionId, record);
    this.#metrics.sessionCreated();
    return record;
  }

  get(sessionId: string, authBinding: string): McpHttpSessionRecord | undefined {
    if (this.#disposed) return undefined;
    const record = this.#sessions.get(sessionId);
    if (!record || record.authBinding !== authBinding || record.session.state === "closed") return undefined;
    const now = this.#now();
    if (record.lastSeenAt <= now - this.#sessionTtlMs) {
      this.#closeRecord(record, "http_session_expired");
      return undefined;
    }
    this.#touch(record, now);
    return record;
  }

  openStream(record: McpHttpSessionRecord, response: ServerResponse, lastEventId?: string) {
    this.#assertActive();
    const internal = record as InternalSession;
    if (internal.session.state === "closed") throw new Error("mcp_http_session_unavailable");
    if (internal.streams.size >= this.#maxStreamsPerSession) throw new Error("mcp_http_stream_limit");
    this.#touch(internal);
    const streamId = randomBytes(12).toString("base64url");
    internal.streams.set(streamId, { streamId, response });
    this.#metrics.streamOpened();
    response.statusCode = 200;
    response.setHeader("content-type", "text/event-stream");
    response.setHeader("cache-control", "no-cache, no-transform");
    response.setHeader("connection", "keep-alive");
    response.flushHeaders();
    response.write(": connected\n\n");
    const cursor = parsedEventId(lastEventId);
    if (cursor) {
      for (const event of internal.history) {
        if (event.streamId === cursor.streamId && event.sequence > cursor.sequence) response.write(sseFrame(event));
      }
    }
    response.once("close", () => internal.streams.delete(streamId));
    return streamId;
  }

  async runOnStream<T>(streamId: string, run: () => Promise<T>): Promise<T> {
    return requestStream.run(streamId, run);
  }

  sendOnStream(record: McpHttpSessionRecord, streamId: string, message: JsonRecord) {
    this.#deliver(record as InternalSession, streamId, message);
  }

  notify(record: McpHttpSessionRecord, message: JsonRecord) {
    try {
      this.#send(record as InternalSession, message);
    } catch (error: unknown) {
      if (error instanceof Error && error.message === "mcp_http_stream_unavailable") return;
      throw error;
    }
  }

  closeStream(record: McpHttpSessionRecord, streamId: string) {
    const stream = (record as InternalSession).streams.get(streamId);
    if (!stream) return;
    (record as InternalSession).streams.delete(streamId);
    if (!stream.response.writableEnded) stream.response.end();
  }

  close(sessionId: string, authBinding: string): boolean {
    if (this.#disposed) return false;
    const record = this.#sessions.get(sessionId);
    if (!record || record.authBinding !== authBinding) return false;
    this.#closeRecord(record, "http_session_deleted");
    return true;
  }

  dispose() {
    if (this.#disposed) return;
    this.#disposed = true;
    const maintenanceHandle = this.#maintenanceHandle;
    this.#maintenanceHandle = undefined;
    if (maintenanceHandle !== undefined) {
      this.#clearIntervalFn(maintenanceHandle);
    }
    for (const record of [...this.#sessions.values()]) {
      this.#closeRecord(record, "http_session_registry_disposed");
    }
    this.#samplingLimiters.clear();
  }

  noteInitialized(record: McpHttpSessionRecord) {
    this.#metrics.sessionInitialized(record.session.supportsClientCapability("sampling"));
  }

  noteResponse(matched: boolean) {
    this.#metrics.response(matched);
  }

  noteToolCall(durationMs: number, success: boolean) {
    this.#metrics.toolCall(durationMs, success);
  }

  metricsSnapshot() {
    return this.#metrics.snapshot();
  }

  #send(record: InternalSession, message: JsonRecord) {
    const preferred = requestStream.getStore();
    const streamId = preferred && record.streams.has(preferred)
      ? preferred
      : record.streams.keys().next().value as string | undefined;
    if (!streamId) throw new Error("mcp_http_stream_unavailable");
    this.#deliver(record, streamId, message);
  }

  #deliver(record: InternalSession, streamId: string, message: JsonRecord) {
    const stream = record.streams.get(streamId);
    if (!stream || stream.response.writableEnded) throw new Error("mcp_http_stream_unavailable");
    const sequence = ++record.nextEventSequence;
    const event: StoredSseEvent = {
      streamId,
      sequence,
      eventId: `${streamId}:${sequence}`,
      message,
    };
    record.history.push(event);
    if (record.history.length > 256) record.history.splice(0, record.history.length - 256);
    stream.response.write(sseFrame(event));
  }

  #closeRecord(record: InternalSession, reason: string) {
    this.#sessions.delete(record.session.sessionId);
    this.#touchBindingLimiter(record.authBinding);
    record.session.close();
    record.requestManager.close(reason);
    this.#metrics.sessionClosed();
    for (const stream of record.streams.values()) {
      if (!stream.response.writableEnded) stream.response.end();
    }
    record.streams.clear();
  }

  #reapExpiredSessions() {
    const expiresAt = this.#now() - this.#sessionTtlMs;
    for (const record of this.#sessions.values()) {
      if (record.lastSeenAt <= expiresAt) this.#closeRecord(record, "http_session_expired");
    }
  }

  #reapExpiredSamplingLimiters() {
    const expiresAt = this.#now() - this.#samplingLimiterIdleTtlMs;
    const activeBindings = new Set<string>();
    for (const session of this.#sessions.values()) activeBindings.add(session.authBinding);
    for (const [authBinding, record] of this.#samplingLimiters) {
      if (activeBindings.has(authBinding)) continue;
      if (record.lastReferencedAt > expiresAt) continue;
      if (record.limiter.snapshot().concurrent > 0) continue;
      this.#samplingLimiters.delete(authBinding);
    }
  }

  #runMaintenance() {
    if (this.#disposed) return;
    this.#reapExpiredSessions();
    this.#reapExpiredSamplingLimiters();
  }

  #bindingLimiter(authBinding: string) {
    const existing = this.#samplingLimiters.get(authBinding);
    if (existing) {
      existing.lastReferencedAt = this.#now();
      return existing.limiter;
    }
    const limiter = createMcpSamplingLimiter({
      ...this.#samplingLimiterOptions,
      now: this.#now,
    });
    this.#samplingLimiters.set(authBinding, { limiter, lastReferencedAt: this.#now() });
    return limiter;
  }

  #touch(record: InternalSession, now = this.#now()) {
    record.lastSeenAt = now;
    this.#touchBindingLimiter(record.authBinding, now);
  }

  #touchBindingLimiter(authBinding: string, now = this.#now()) {
    const limiter = this.#samplingLimiters.get(authBinding);
    if (limiter) limiter.lastReferencedAt = now;
  }

  #assertActive() {
    if (this.#disposed) throw new Error("mcp_http_session_registry_disposed");
  }

  #unrefMaintenanceTimer(handle: IntervalHandle) {
    if (typeof handle !== "object" || handle === null || !("unref" in handle)) return;
    const maybeUnref = (handle as { unref?: unknown }).unref;
    if (typeof maybeUnref === "function") maybeUnref.call(handle);
  }
}

export function createMcpHttpSessionRegistry(
  metrics: McpTransportMetrics = createMcpTransportMetrics(),
  options: McpHttpSessionRegistryOptions = {},
) {
  return new McpHttpSessionRegistry(metrics, options);
}
