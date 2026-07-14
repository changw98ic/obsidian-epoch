import { mcpJsonRpcErrorResponse } from "./mcpJsonRpc.ts";

export type McpJsonRecord = Record<string, unknown>;

export type McpStdioMessageKind = "request" | "notification" | "response" | "invalid";

export interface McpLineWriter {
  write(chunk: string, callback: (error?: Error | null) => void): boolean;
}

export interface McpStdioTransportOptions {
  readonly writer: McpLineWriter;
  readonly onMessage: (message: McpJsonRecord) => Promise<McpJsonRecord | null> | McpJsonRecord | null;
  readonly onResponse: (message: McpJsonRecord) => void;
  readonly onAudit?: (event: string, details?: McpJsonRecord) => void;
}

function isRecord(value: unknown): value is McpJsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasOwn(record: McpJsonRecord, key: string) {
  return Object.prototype.hasOwnProperty.call(record, key);
}

export function classifyMcpStdioMessage(message: McpJsonRecord): McpStdioMessageKind {
  if (message.jsonrpc !== "2.0") return "invalid";
  if (typeof message.method === "string") return hasOwn(message, "id") ? "request" : "notification";
  if (hasOwn(message, "id") && (hasOwn(message, "result") || hasOwn(message, "error"))) return "response";
  return "invalid";
}

export class McpStdioTransport {
  readonly #writer: McpLineWriter;
  readonly #onMessage: McpStdioTransportOptions["onMessage"];
  readonly #onResponse: McpStdioTransportOptions["onResponse"];
  readonly #onAudit: NonNullable<McpStdioTransportOptions["onAudit"]>;
  #writeTail: Promise<void> = Promise.resolve();
  #closed = false;

  constructor(options: McpStdioTransportOptions) {
    this.#writer = options.writer;
    this.#onMessage = options.onMessage;
    this.#onResponse = options.onResponse;
    this.#onAudit = options.onAudit ?? (() => undefined);
  }

  get closed() {
    return this.#closed;
  }

  acceptLine(line: string) {
    if (this.#closed || !line.trim()) return;

    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      void this.send(mcpJsonRpcErrorResponse(null, -32700, "Parse error"));
      return;
    }

    if (!isRecord(parsed)) {
      void this.send(mcpJsonRpcErrorResponse(null, -32600, "Invalid Request"));
      return;
    }

    const kind = classifyMcpStdioMessage(parsed);
    if (kind === "response") {
      try {
        this.#onResponse(parsed);
      } catch (error: unknown) {
        this.#onAudit("stdio_response_router_error", {
          message: error instanceof Error ? error.message : "unknown_error",
        });
      }
      return;
    }
    if (kind === "invalid") {
      void this.send(mcpJsonRpcErrorResponse(parsed.id, -32600, "Invalid Request"));
      return;
    }

    void Promise.resolve(this.#onMessage(parsed))
      .then((response) => response ? this.send(response) : undefined)
      .catch((error: unknown) => this.send(mcpJsonRpcErrorResponse(
        parsed.id,
        -32603,
        "internal_error",
        { message: error instanceof Error ? error.message : "unknown_error" },
      )));
  }

  send(message: McpJsonRecord): Promise<void> {
    if (this.#closed) return Promise.reject(new Error("mcp_stdio_transport_closed"));
    const line = `${JSON.stringify(message)}\n`;
    const write = () => new Promise<void>((resolve, reject) => {
      this.#writer.write(line, (error?: Error | null) => error ? reject(error) : resolve());
    });
    const queued = this.#writeTail.then(write, write);
    this.#writeTail = queued.catch((error: unknown) => {
      this.#onAudit("stdio_write_error", {
        message: error instanceof Error ? error.message : "unknown_error",
      });
    });
    return queued;
  }

  async close() {
    this.#closed = true;
    await this.#writeTail;
  }
}

export function createMcpStdioTransport(options: McpStdioTransportOptions) {
  return new McpStdioTransport(options);
}
