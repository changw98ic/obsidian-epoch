import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import type { ServerResponse } from "node:http";
import test from "node:test";

import { createMcpHttpSessionRegistry } from "../lib/mcpHttpTransport.ts";

class FakeSseResponse extends EventEmitter {
  statusCode = 0;
  writableEnded = false;
  readonly chunks: string[] = [];
  readonly headers = new Map<string, string>();

  setHeader(name: string, value: string) {
    this.headers.set(name, value);
  }

  flushHeaders() {}

  write(chunk: string) {
    this.chunks.push(chunk);
    return true;
  }

  end() {
    this.writableEnded = true;
    this.emit("close");
  }

  body() {
    return this.chunks.join("");
  }
}

function asServerResponse(response: FakeSseResponse) {
  return response as unknown as ServerResponse;
}

test("HTTP MCP replays only events after Last-Event-ID and never broadcasts server requests", async () => {
  const registry = createMcpHttpSessionRegistry();
  const record = registry.create("owner-binding");
  const first = new FakeSseResponse();
  const firstStreamId = registry.openStream(record, asServerResponse(first));
  registry.sendOnStream(record, firstStreamId, { jsonrpc: "2.0", method: "event/one" });
  registry.sendOnStream(record, firstStreamId, { jsonrpc: "2.0", method: "event/two" });
  const eventIds = [...first.body().matchAll(/^id: (.+)$/gm)].map((match) => match[1]);
  assert.equal(eventIds.length, 2);
  registry.closeStream(record, firstStreamId);

  const replay = new FakeSseResponse();
  registry.openStream(record, asServerResponse(replay), eventIds[0]);
  assert.doesNotMatch(replay.body(), /event\/one/);
  assert.match(replay.body(), /event\/two/);

  const second = new FakeSseResponse();
  registry.openStream(record, asServerResponse(second));
  const pending = record.requestManager.request("sampling/createMessage", { messages: [] });
  assert.match(replay.body(), /sampling\/createMessage/);
  assert.doesNotMatch(second.body(), /sampling\/createMessage/);
  const requestId = JSON.parse(replay.body().match(/data: (\{[^\n]+sampling\/createMessage[^\n]+\})/)?.[1] || "null").id;
  assert.ok(requestId);
  assert.equal(record.requestManager.handleResponse({ jsonrpc: "2.0", id: requestId, result: { ok: true } }), true);
  assert.deepEqual(await pending, { ok: true });
  assert.equal(registry.close(record.session.sessionId, "owner-binding"), true);
});

test("HTTP MCP reaps expired inactive sessions when new sessions arrive", () => {
  let now = 1_000;
  const registry = createMcpHttpSessionRegistry(undefined, { sessionTtlMs: 100, now: () => now });
  registry.create("first-owner");
  now = 1_101;
  const current = registry.create("second-owner");
  assert.equal(registry.metricsSnapshot().transport.activeSessions, 1);
  assert.equal(registry.close(current.session.sessionId, "second-owner"), true);
});

test("HTTP MCP bounds total and per-binding session creation", () => {
  const registry = createMcpHttpSessionRegistry(undefined, { maxSessions: 2, maxSessionsPerBinding: 1 });
  const first = registry.create("owner-a");
  assert.throws(() => registry.create("owner-a"), /mcp_http_binding_session_limit/);
  const second = registry.create("owner-b");
  assert.throws(() => registry.create("owner-c"), /mcp_http_session_limit/);
  registry.close(first.session.sessionId, "owner-a");
  registry.close(second.session.sessionId, "owner-b");
});

test("HTTP MCP bounds concurrent SSE streams per session", () => {
  const registry = createMcpHttpSessionRegistry(undefined, { maxStreamsPerSession: 1 });
  const record = registry.create("stream-owner");
  registry.openStream(record, asServerResponse(new FakeSseResponse()));
  assert.throws(
    () => registry.openStream(record, asServerResponse(new FakeSseResponse())),
    /mcp_http_stream_limit/,
  );
  registry.close(record.session.sessionId, "stream-owner");
});

test("HTTP MCP shares Sampling limits across sessions with the same auth binding", async () => {
  const registry = createMcpHttpSessionRegistry();
  const first = registry.create("shared-owner");
  const second = registry.create("shared-owner");
  for (const record of [first, second]) {
    record.session.acceptInitialize({
      protocolVersion: "2025-06-18",
      capabilities: { sampling: {} },
      clientInfo: { name: "shared-limit-test", version: "1" },
    });
    record.session.acceptInitializedNotification();
    registry.openStream(record, asServerResponse(new FakeSseResponse()));
  }
  const input = {
    systemPrompt: "Choose one option.",
    messages: [{ role: "user" as const, text: "{}" }],
    maxTokens: 100,
  };
  const pendingA = first.sampling.createMessage(input, { activeClientRequest: true });
  const pendingB = first.sampling.createMessage(input, { activeClientRequest: true });
  const denied = await second.sampling.createMessage(input, { activeClientRequest: true });
  assert.deepEqual(denied, {
    ok: false,
    source: "sampling_advice",
    trust: "untrusted_client",
    fallback: "rate_limited",
  });
  registry.close(first.session.sessionId, "shared-owner");
  registry.close(second.session.sessionId, "shared-owner");
  assert.equal((await pendingA).ok, false);
  assert.equal((await pendingB).ok, false);
});
