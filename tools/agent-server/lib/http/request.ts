import { type IncomingMessage } from "node:http";
import { assertPublicSafe } from "../safety.ts";

const PARSED_JSON_BODY = Symbol("parsed_json_body");
export const DEFAULT_MAX_JSON_BODY_BYTES = 1_000_000;

export type AnyRecord = Record<string, unknown>;
type RequestWithParsedJson = IncomingMessage & { [PARSED_JSON_BODY]?: AnyRecord };

export function isRecord(value: unknown): value is AnyRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function recordValue(value: unknown): AnyRecord {
  return isRecord(value) ? value : {};
}

export function recordArray(value: unknown): AnyRecord[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

export function optionalString(value: unknown) {
  return typeof value === "string" && value ? value : undefined;
}

export function parsedJsonBody(request: IncomingMessage): AnyRecord | undefined {
  return (request as RequestWithParsedJson)[PARSED_JSON_BODY];
}

export function maxJsonBodyBytesFromEnv(value: string | undefined) {
  if (value === undefined || value.trim() === "") return DEFAULT_MAX_JSON_BODY_BYTES;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error("AGENT_SERVER_MAX_BODY_BYTES must be a positive safe integer");
  }
  return parsed;
}

export async function readJsonBody(request: IncomingMessage, maxBodyBytes: number): Promise<AnyRecord> {
  if (!Number.isSafeInteger(maxBodyBytes) || maxBodyBytes <= 0) {
    throw new Error("invalid_max_body_bytes");
  }
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > maxBodyBytes) {
      throw Object.assign(new Error("json_body_too_large"), { code: "json_body_too_large" });
    }
    chunks.push(buffer);
  }
  const parsed = chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {};
  const body = recordValue(parsed);
  (request as RequestWithParsedJson)[PARSED_JSON_BODY] = body;
  assertPublicSafe(parsed);
  return body;
}

export function queryParams(request: IncomingMessage) {
  return new URL(request.url || "/", "http://127.0.0.1").searchParams;
}

export function firstHeaderValue(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw?.split(",")[0]?.trim();
}

export function publicServerBase(request: IncomingMessage, configuredBase?: string) {
  if (configuredBase) return configuredBase.replace(/\/+$/, "");
  const forwardedProto = firstHeaderValue(request.headers["x-forwarded-proto"]);
  const forwardedHost = firstHeaderValue(request.headers["x-forwarded-host"]);
  const proto = forwardedProto && ["http", "https"].includes(forwardedProto)
    ? forwardedProto
    : "http";
  const host = forwardedHost || firstHeaderValue(request.headers.host) || "127.0.0.1:8787";
  return `${proto}://${host}`.replace(/\/+$/, "");
}
