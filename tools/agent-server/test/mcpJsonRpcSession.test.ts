import assert from "node:assert/strict";
import test from "node:test";
import { handleMcpJsonRpcMessage, type McpJsonRpcRuntime } from "../lib/mcpJsonRpc.ts";
import { createMcpSession } from "../lib/mcpSession.ts";

const runtime: McpJsonRpcRuntime = {
  protocolVersion: "2025-06-18",
  serverInfo: { name: "test", version: "1" },
  capabilities: { tools: {} },
  listTools: () => [],
  callTool: async () => ({ content: [] }),
};

function request(id: number, method: string, params?: Record<string, unknown>) {
  return { jsonrpc: "2.0", id, method, ...(params ? { params } : {}) };
}

test("session-gated JSON-RPC enforces initialize then initialized before tools", async () => {
  const session = createMcpSession({ sessionId: "stdio_test", transport: "stdio" });
  const beforeInitialize = await handleMcpJsonRpcMessage(runtime, request(1, "tools/list"), { session });
  assert.ok(beforeInitialize && "error" in beforeInitialize);
  assert.equal(beforeInitialize.error.message, "mcp_session_not_initialized");

  const initialized = await handleMcpJsonRpcMessage(runtime, request(2, "initialize", {
    protocolVersion: "2025-06-18",
    capabilities: { sampling: {} },
    clientInfo: { name: "test-host", version: "1" },
  }), { session });
  assert.ok(initialized && "result" in initialized && initialized.result && typeof initialized.result === "object");
  assert.equal("protocolVersion" in initialized.result ? initialized.result.protocolVersion : undefined, "2025-06-18");
  assert.deepEqual("capabilities" in initialized.result ? initialized.result.capabilities : undefined, { tools: {} });

  const beforeNotification = await handleMcpJsonRpcMessage(runtime, request(3, "tools/list"), { session });
  assert.ok(beforeNotification && "error" in beforeNotification);
  assert.equal(beforeNotification.error.message, "mcp_session_not_initialized");
  assert.equal(await handleMcpJsonRpcMessage(runtime, {
    jsonrpc: "2.0",
    method: "notifications/initialized",
  }, { session }), null);

  const listed = await handleMcpJsonRpcMessage(runtime, request(4, "tools/list"), { session });
  assert.ok(listed && "result" in listed);
  assert.deepEqual(listed.result, { tools: [] });
  assert.equal(session.supportsClientCapability("sampling"), true);
});

test("session-gated JSON-RPC negotiates its supported protocol and rejects duplicate initialize", async () => {
  const session = createMcpSession({ sessionId: "stdio_version", transport: "stdio" });
  const unsupported = await handleMcpJsonRpcMessage(runtime, request(1, "initialize", {
    protocolVersion: "2025-11-25",
    capabilities: {},
    clientInfo: { name: "test-host", version: "1" },
  }), { session });
  assert.ok(unsupported && "result" in unsupported && unsupported.result && typeof unsupported.result === "object");
  assert.equal("protocolVersion" in unsupported.result ? unsupported.result.protocolVersion : undefined, "2025-06-18");

  const duplicate = await handleMcpJsonRpcMessage(runtime, request(3, "initialize", {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "test-host", version: "1" },
  }), { session });
  assert.ok(duplicate && "error" in duplicate);
  assert.equal(duplicate.error.message, "mcp_initialize_already_received");
});
