import { type IncomingMessage, type ServerResponse } from "node:http";
import { boundedEpochTransportValue } from "../epoch/runtimePublicProjectionRules.ts";

export function corsHeaders(request: IncomingMessage, allowedOrigins: string[]) {
  const origin = request.headers.origin;
  const allowOrigin = origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0] || "null";
  return {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": allowOrigin,
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type, authorization",
    "vary": "origin",
  };
}

export function sendJson(request: IncomingMessage, response: ServerResponse, status: number, value: unknown, allowedOrigins: string[]) {
  response.writeHead(status, corsHeaders(request, allowedOrigins));
  response.end(status === 204 ? "" : JSON.stringify(boundedEpochTransportValue(value)));
}

export function sendJsonDownload(
  request: IncomingMessage,
  response: ServerResponse,
  status: number,
  value: unknown,
  allowedOrigins: string[],
  fileName: string,
) {
  const payload = `${JSON.stringify(value, null, 2)}\n`;
  response.writeHead(status, {
    ...corsHeaders(request, allowedOrigins),
    "cache-control": "no-store",
    "content-disposition": `attachment; filename="${fileName}"`,
  });
  response.end(payload);
}

export function sendTextDownload(
  request: IncomingMessage,
  response: ServerResponse,
  status: number,
  value: string,
  allowedOrigins: string[],
  fileName: string,
  contentType: string,
) {
  const { "content-type": _contentType, ...cors } = corsHeaders(request, allowedOrigins);
  response.writeHead(status, {
    ...cors,
    "content-type": contentType,
    "cache-control": "no-store",
    "content-disposition": `attachment; filename="${fileName}"`,
  });
  response.end(value);
}

export function sendEmpty(request: IncomingMessage, response: ServerResponse, status: number, allowedOrigins: string[]) {
  const { "content-type": _contentType, ...cors } = corsHeaders(request, allowedOrigins);
  response.writeHead(status, cors);
  response.end();
}

export function sendHtml(request: IncomingMessage, response: ServerResponse, status: number, value: string, allowedOrigins: string[]) {
  const { "content-type": _contentType, ...cors } = corsHeaders(request, allowedOrigins);
  response.writeHead(status, {
    ...cors,
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(value);
}

export function sendBinary(
  request: IncomingMessage,
  response: ServerResponse,
  status: number,
  value: Buffer,
  allowedOrigins: string[],
  headers: Record<string, string>,
) {
  const { "content-type": _contentType, ...cors } = corsHeaders(request, allowedOrigins);
  response.writeHead(status, {
    ...cors,
    ...headers,
    "content-length": String(value.length),
  });
  response.end(value);
}
