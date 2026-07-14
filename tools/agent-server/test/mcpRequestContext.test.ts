import assert from "node:assert/strict";
import test from "node:test";
import { handleMcpJsonRpcMessage, type McpJsonRpcRuntime } from "../lib/mcpJsonRpc.ts";
import { currentMcpRequestContext } from "../lib/mcpRequestContext.ts";
import { createMcpSamplingClient } from "../lib/mcpSampling.ts";
import { createMcpServerRequestManager } from "../lib/mcpServerRequestManager.ts";
import { createMcpSession } from "../lib/mcpSession.ts";

test("tools/call exposes sampling only inside the active client request context", async () => {
  const session = createMcpSession({ sessionId: "context", transport: "stdio" });
  session.acceptInitialize({
    protocolVersion: "2025-06-18",
    capabilities: { sampling: {} },
    clientInfo: { name: "host", version: "1" },
  });
  session.acceptInitializedNotification();
  const requestManager = createMcpServerRequestManager({ send: () => undefined });
  const sampling = createMcpSamplingClient({ session, requestManager });
  const runtime: McpJsonRpcRuntime = {
    protocolVersion: "2025-06-18",
    serverInfo: { name: "test", version: "1" },
    capabilities: { tools: {} },
    listTools: () => [],
    callTool: async () => {
      const context = currentMcpRequestContext();
      return {
        active: context?.activeClientRequest,
        requestId: context?.clientRequestId,
        progressToken: context?.progressToken,
        hasSampling: context?.sampling === sampling,
      };
    },
  };
  const response = await handleMcpJsonRpcMessage(runtime, {
    jsonrpc: "2.0",
    id: 9,
    method: "tools/call",
    params: {
      name: "test",
      arguments: {},
      _meta: { progressToken: "progress-9" },
    },
  }, { session, sampling });
  assert.ok(response && "result" in response);
  assert.deepEqual(response.result, {
    active: true,
    requestId: 9,
    progressToken: "progress-9",
    hasSampling: true,
  });
  assert.equal(currentMcpRequestContext(), undefined);
  requestManager.close();
});
