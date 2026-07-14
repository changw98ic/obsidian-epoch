import assert from "node:assert/strict";
import test from "node:test";
import {
  createMcpServerRequestManager,
  McpServerRequestError,
  type McpRequestId,
} from "../lib/mcpServerRequestManager.ts";

async function expectCode(promise: Promise<unknown>, code: string) {
  await assert.rejects(promise, (error: unknown) => {
    assert.ok(error instanceof McpServerRequestError);
    assert.equal(error.code, code);
    return true;
  });
}

test("resolves out-of-order server responses without sharing the client request id namespace", async () => {
  const sent: Record<string, unknown>[] = [];
  let nextId = 0;
  const manager = createMcpServerRequestManager({
    send: (message) => { sent.push(message); },
    requestIdFactory: () => `server-${++nextId}`,
  });
  const first = manager.request("sampling/createMessage", { prompt: "a" });
  const second = manager.request("sampling/createMessage", { prompt: "b" });
  assert.deepEqual(sent.map((message) => message.id), ["server-1", "server-2"]);
  assert.equal(manager.handleResponse({ jsonrpc: "2.0", id: "server-2", result: { choice: "b" } }), true);
  assert.equal(manager.handleResponse({ jsonrpc: "2.0", id: "server-1", result: { choice: "a" } }), true);
  assert.deepEqual(await first, { choice: "a" });
  assert.deepEqual(await second, { choice: "b" });
  assert.equal(manager.pendingRequestCount, 0);
});

test("late and duplicate responses are audited and never revive a terminal request", async () => {
  const audits: string[] = [];
  const manager = createMcpServerRequestManager({
    send: () => undefined,
    requestIdFactory: () => "server-1",
    audit: (event) => audits.push(event),
  });
  const request = manager.request("sampling/createMessage");
  assert.equal(manager.handleResponse({ jsonrpc: "2.0", id: "server-1", result: "first" }), true);
  assert.equal(await request, "first");
  assert.equal(manager.handleResponse({ jsonrpc: "2.0", id: "server-1", result: "late" }), false);
  assert.deepEqual(audits, ["mcp_server_response_late_or_unknown"]);
});

test("timeout and response race has one terminal outcome and sends cancellation", async () => {
  const sent: Record<string, unknown>[] = [];
  const manager = createMcpServerRequestManager({
    send: (message) => { sent.push(message); },
    requestIdFactory: () => 7,
  });
  const request = manager.request("sampling/createMessage", {}, { absoluteTimeoutMs: 10 });
  await expectCode(request, "mcp_server_request_absolute_timeout");
  assert.equal(manager.handleResponse({ jsonrpc: "2.0", id: 7, result: "too-late" }), false);
  assert.equal(sent.some((message) => message.method === "notifications/cancelled"), true);
});

test("progress can rearm soft timeout but never exceeds the absolute deadline", async () => {
  const manager = createMcpServerRequestManager({
    send: () => undefined,
    requestIdFactory: () => "progress-1",
  });
  const request = manager.request("sampling/createMessage", {}, {
    softTimeoutMs: 300,
    absoluteTimeoutMs: 700,
  });
  const terminal = expectCode(request, "mcp_server_request_absolute_timeout");
  await new Promise((resolve) => setTimeout(resolve, 200));
  assert.equal(manager.noteProgress("progress-1"), true);
  await new Promise((resolve) => setTimeout(resolve, 200));
  assert.equal(manager.noteProgress("progress-1"), true);
  await terminal;
});

test("AbortSignal, explicit cancel, close, and remote errors use stable terminal codes", async () => {
  const ids: McpRequestId[] = [1, 2, 3, 4];
  const manager = createMcpServerRequestManager({
    send: () => undefined,
    requestIdFactory: () => ids.shift() ?? 99,
  });
  const controller = new AbortController();
  const aborted = manager.request("sampling/createMessage", {}, { signal: controller.signal });
  controller.abort();
  await expectCode(aborted, "mcp_server_request_aborted");

  const cancelled = manager.request("sampling/createMessage");
  assert.equal(manager.cancel(2, "tool_cancelled"), true);
  await expectCode(cancelled, "mcp_server_request_aborted");

  const remoteError = manager.request("sampling/createMessage");
  assert.equal(manager.handleResponse({
    jsonrpc: "2.0",
    id: 3,
    error: { code: -32603, message: "provider_error" },
  }), true);
  await expectCode(remoteError, "mcp_server_request_remote_error");

  const closed = manager.request("sampling/createMessage");
  manager.close();
  await expectCode(closed, "mcp_server_request_connection_closed");
  await expectCode(manager.request("sampling/createMessage"), "mcp_server_request_connection_closed");
});
