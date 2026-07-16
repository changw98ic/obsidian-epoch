type JsonRecord = Record<string, unknown>;
export type McpRequestId = string | number;

export interface McpServerRequestManagerOptions {
  readonly send: (message: JsonRecord) => Promise<void> | void;
  readonly requestIdFactory?: () => McpRequestId;
  readonly audit?: (event: string, details: JsonRecord) => void;
}

export interface McpServerRequestOptions {
  readonly signal?: AbortSignal;
  readonly softTimeoutMs?: number;
  readonly absoluteTimeoutMs?: number;
}

export type McpServerRequestErrorCode =
  | "mcp_server_request_aborted"
  | "mcp_server_request_absolute_timeout"
  | "mcp_server_request_connection_closed"
  | "mcp_server_request_remote_error"
  | "mcp_server_request_send_failed"
  | "mcp_server_request_soft_timeout";

export class McpServerRequestError extends Error {
  readonly code: McpServerRequestErrorCode;
  readonly details?: JsonRecord;

  constructor(code: McpServerRequestErrorCode, details?: JsonRecord) {
    super(code);
    this.name = "McpServerRequestError";
    this.code = code;
    this.details = details;
  }
}

interface PendingRequest {
  readonly id: McpRequestId;
  readonly resolve: (result: unknown) => void;
  readonly reject: (error: McpServerRequestError) => void;
  readonly signal?: AbortSignal;
  abortListener?: () => void;
  readonly softTimeoutMs?: number;
  readonly absoluteDeadline: number;
  softTimer?: ReturnType<typeof setTimeout>;
  absoluteTimer: ReturnType<typeof setTimeout>;
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function responseId(message: JsonRecord): McpRequestId | undefined {
  return typeof message.id === "string" || typeof message.id === "number" ? message.id : undefined;
}

function positiveTimeout(value: number | undefined, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
}

export class McpServerRequestManager {
  readonly #send: McpServerRequestManagerOptions["send"];
  readonly #requestIdFactory: NonNullable<McpServerRequestManagerOptions["requestIdFactory"]>;
  readonly #audit: NonNullable<McpServerRequestManagerOptions["audit"]>;
  readonly #pending = new Map<McpRequestId, PendingRequest>();
  #nextId = 1;
  #closed = false;

  constructor(options: McpServerRequestManagerOptions) {
    this.#send = options.send;
    this.#requestIdFactory = options.requestIdFactory ?? (() => `server-${this.#nextId++}`);
    this.#audit = options.audit ?? (() => undefined);
  }

  get pendingRequestCount() {
    return this.#pending.size;
  }

  request(method: string, params: JsonRecord = {}, options: McpServerRequestOptions = {}): Promise<unknown> {
    if (this.#closed) return Promise.reject(new McpServerRequestError("mcp_server_request_connection_closed"));
    if (!method.trim()) return Promise.reject(new McpServerRequestError("mcp_server_request_send_failed", { reason: "method_required" }));
    if (options.signal?.aborted) return Promise.reject(new McpServerRequestError("mcp_server_request_aborted"));

    const id = this.#requestIdFactory();
    if (this.#pending.has(id)) {
      return Promise.reject(new McpServerRequestError("mcp_server_request_send_failed", { reason: "request_id_collision" }));
    }
    const absoluteTimeoutMs = positiveTimeout(options.absoluteTimeoutMs, 60_000);
    const softTimeoutMs = options.softTimeoutMs === undefined
      ? undefined
      : Math.min(positiveTimeout(options.softTimeoutMs, absoluteTimeoutMs), absoluteTimeoutMs);

    return new Promise<unknown>((resolve, reject) => {
      const pending: PendingRequest = {
        id,
        resolve,
        reject,
        signal: options.signal,
        softTimeoutMs,
        absoluteDeadline: Date.now() + absoluteTimeoutMs,
        absoluteTimer: setTimeout(() => {
          this.#terminate(id, "mcp_server_request_absolute_timeout", true);
        }, absoluteTimeoutMs),
      };
      if (softTimeoutMs !== undefined) this.#armSoftTimer(pending, softTimeoutMs);
      if (options.signal) {
        pending.abortListener = () => this.#terminate(id, "mcp_server_request_aborted", true);
        options.signal.addEventListener("abort", pending.abortListener, { once: true });
      }
      this.#pending.set(id, pending);
      Promise.resolve(this.#send({ jsonrpc: "2.0", id, method, params })).catch((error: unknown) => {
        this.#terminate(id, "mcp_server_request_send_failed", false, {
          message: error instanceof Error ? error.message : "unknown_error",
        });
      });
    });
  }

  handleResponse(message: JsonRecord): boolean {
    const id = responseId(message);
    if (id === undefined) {
      this.#audit("mcp_server_response_invalid_id", {});
      return false;
    }
    const pending = this.#take(id);
    if (!pending) {
      this.#audit("mcp_server_response_late_or_unknown", { id });
      return false;
    }
    if (isRecord(message.error)) {
      pending.reject(new McpServerRequestError("mcp_server_request_remote_error", {
        id,
        code: message.error.code,
        message: message.error.message,
      }));
    } else if (Object.prototype.hasOwnProperty.call(message, "result")) {
      pending.resolve(message.result);
    } else {
      pending.reject(new McpServerRequestError("mcp_server_request_remote_error", {
        id,
        message: "result_or_error_required",
      }));
    }
    return true;
  }

  noteProgress(id: McpRequestId): boolean {
    const pending = this.#pending.get(id);
    if (!pending) {
      this.#audit("mcp_server_progress_late_or_unknown", { id });
      return false;
    }
    if (pending.softTimeoutMs === undefined) return true;
    const remaining = pending.absoluteDeadline - Date.now();
    if (remaining <= 0) {
      this.#terminate(id, "mcp_server_request_absolute_timeout", true);
      return false;
    }
    this.#armSoftTimer(pending, Math.min(pending.softTimeoutMs, remaining));
    return true;
  }

  cancel(id: McpRequestId, reason = "cancelled") {
    return this.#terminate(id, "mcp_server_request_aborted", true, { reason });
  }

  close(reason = "connection_closed") {
    if (this.#closed) return;
    this.#closed = true;
    for (const id of [...this.#pending.keys()]) {
      this.#terminate(id, "mcp_server_request_connection_closed", false, { reason });
    }
  }

  #armSoftTimer(pending: PendingRequest, timeoutMs: number) {
    if (pending.softTimer) clearTimeout(pending.softTimer);
    pending.softTimer = setTimeout(() => {
      const code = Date.now() >= pending.absoluteDeadline
        ? "mcp_server_request_absolute_timeout"
        : "mcp_server_request_soft_timeout";
      this.#terminate(pending.id, code, true);
    }, timeoutMs);
  }

  #terminate(
    id: McpRequestId,
    code: McpServerRequestErrorCode,
    notifyClient: boolean,
    details: JsonRecord = {},
  ) {
    const pending = this.#take(id);
    if (!pending) return false;
    if (notifyClient) {
      void Promise.resolve(this.#send({
        jsonrpc: "2.0",
        method: "notifications/cancelled",
        params: { requestId: id, reason: details.reason ?? code },
      })).catch((error: unknown) => {
        this.#audit("mcp_server_cancellation_send_failed", {
          id,
          message: error instanceof Error ? error.message : "unknown_error",
        });
      });
    }
    pending.reject(new McpServerRequestError(code, { id, ...details }));
    return true;
  }

  #take(id: McpRequestId): PendingRequest | undefined {
    const pending = this.#pending.get(id);
    if (!pending) return undefined;
    this.#pending.delete(id);
    clearTimeout(pending.absoluteTimer);
    if (pending.softTimer) clearTimeout(pending.softTimer);
    if (pending.signal && pending.abortListener) {
      pending.signal.removeEventListener("abort", pending.abortListener);
    }
    return pending;
  }
}

export function createMcpServerRequestManager(options: McpServerRequestManagerOptions) {
  return new McpServerRequestManager(options);
}
