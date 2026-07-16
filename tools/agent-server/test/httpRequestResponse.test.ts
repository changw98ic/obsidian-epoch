import assert from "node:assert/strict";
import { type IncomingMessage } from "node:http";
import { Readable } from "node:stream";
import test from "node:test";
import {
  DEFAULT_MAX_JSON_BODY_BYTES,
  maxJsonBodyBytesFromEnv,
  parsedJsonBody,
  publicServerBase,
  queryParams,
  readJsonBody,
} from "../lib/http/request.ts";
import { corsHeaders } from "../lib/http/response.ts";

function requestFrom(body = "", headers: IncomingMessage["headers"] = {}, url = "/") {
  return Object.assign(Readable.from(body ? [Buffer.from(body)] : []), { headers, url }) as IncomingMessage;
}

test("HTTP request helpers derive public server base from forwarded headers", () => {
  assert.equal(publicServerBase(requestFrom("", {
    "x-forwarded-proto": "https",
    "x-forwarded-host": "epoch.example.test, internal.example.test",
    host: "127.0.0.1:8792",
  })), "https://epoch.example.test");

  assert.equal(publicServerBase(requestFrom("", {
    "x-forwarded-proto": "ftp",
    host: "127.0.0.1:8792",
  })), "http://127.0.0.1:8792");

  assert.equal(publicServerBase(requestFrom("", {
    "x-forwarded-proto": "https",
    "x-forwarded-host": "attacker.example",
    host: "attacker.example",
  }), "https://epoch.example/"), "https://epoch.example");
});

test("HTTP request helpers parse query params and cache parsed JSON bodies", async () => {
  const request = requestFrom("{\"agentId\":\"agent_1\"}", {}, "/api/example?region=gray_harbor");
  assert.equal(queryParams(request).get("region"), "gray_harbor");

  const body = await readJsonBody(request, 1000);
  assert.deepEqual(body, { agentId: "agent_1" });
  assert.equal(parsedJsonBody(request), body);
});

test("HTTP request helpers reject oversized JSON bodies with stable code", async () => {
  await assert.rejects(
    () => readJsonBody(requestFrom("{\"large\":true}"), 4),
    (error: unknown) => error instanceof Error && (error as { readonly code?: unknown }).code === "json_body_too_large",
  );
  await assert.rejects(
    () => readJsonBody(requestFrom("{}"), Number.NaN),
    /invalid_max_body_bytes/,
  );
});

test("HTTP body limit configuration fails closed on invalid values", () => {
  assert.equal(maxJsonBodyBytesFromEnv(undefined), DEFAULT_MAX_JSON_BODY_BYTES);
  assert.equal(maxJsonBodyBytesFromEnv("2048"), 2048);
  assert.throws(() => maxJsonBodyBytesFromEnv("NaN"), /positive safe integer/);
  assert.throws(() => maxJsonBodyBytesFromEnv("0"), /positive safe integer/);
});

test("HTTP response helpers choose allowed CORS origins and fallback origin", () => {
  assert.equal(corsHeaders(requestFrom("", { origin: "https://allowed.example.test" }), [
    "https://allowed.example.test",
    "https://fallback.example.test",
  ])["access-control-allow-origin"], "https://allowed.example.test");

  assert.equal(corsHeaders(requestFrom("", { origin: "https://blocked.example.test" }), [
    "https://fallback.example.test",
  ])["access-control-allow-origin"], "https://fallback.example.test");
});
