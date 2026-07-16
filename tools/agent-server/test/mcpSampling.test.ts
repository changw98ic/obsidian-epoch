import assert from "node:assert/strict";
import test from "node:test";
import { createMcpSamplingClient } from "../lib/mcpSampling.ts";
import { createMcpServerRequestManager } from "../lib/mcpServerRequestManager.ts";
import { createMcpSession } from "../lib/mcpSession.ts";
import { createMcpStdioTransport } from "../lib/mcpStdioTransport.ts";

function initializedSession(sampling = true) {
  const session = createMcpSession({ sessionId: `sampling_${sampling}`, transport: "stdio" });
  session.acceptInitialize({
    protocolVersion: "2025-06-18",
    capabilities: sampling ? { sampling: {} } : {},
    clientInfo: { name: "sampling-host", version: "1" },
  });
  session.acceptInitializedNotification();
  return session;
}

test("stdio transport completes a real nested sampling request-response round trip", async () => {
  const lines: string[] = [];
  let manager: ReturnType<typeof createMcpServerRequestManager>;
  const transport = createMcpStdioTransport({
    writer: {
      write: (chunk, callback) => {
        lines.push(chunk);
        callback();
        return true;
      },
    },
    onMessage: () => null,
    onResponse: (message) => { manager.handleResponse(message); },
  });
  manager = createMcpServerRequestManager({
    send: (message) => transport.send(message),
    requestIdFactory: () => "server-sampling-1",
  });
  const sampling = createMcpSamplingClient({ session: initializedSession(), requestManager: manager });
  const outcomePromise = sampling.createMessage({
    messages: [{ role: "user", text: "从合法选项中选择" }],
  }, {
    activeClientRequest: true,
    absoluteTimeoutMs: 1_000,
  });
  await new Promise<void>((resolve) => setImmediate(resolve));

  const request = JSON.parse(lines[0] ?? "null");
  assert.equal(request.method, "sampling/createMessage");
  assert.equal(request.params.includeContext, "none");
  transport.acceptLine(JSON.stringify({
    jsonrpc: "2.0",
    id: request.id,
    result: {
      role: "assistant",
      content: {
        type: "text",
        text: JSON.stringify({
          actionOptionId: "option_server_signed",
          rationale: "与委托一致",
          confidence: 0.9,
        }),
      },
      model: "client-selected-model",
      stopReason: "endTurn",
    },
  }));

  const outcome = await outcomePromise;
  assert.equal(outcome.ok, true);
  if (!outcome.ok) throw new Error("expected_sampling_success");
  assert.equal(outcome.trust, "untrusted_client");
  assert.equal(outcome.decision.actionOptionId, "option_server_signed");
  assert.equal("canonicalEvent" in outcome, false);
  manager.close();
  await transport.close();
});

test("sampling refuses missing capability, missing lifecycle, and background invocation", async () => {
  const manager = createMcpServerRequestManager({ send: () => undefined });
  const noCapability = createMcpSamplingClient({ session: initializedSession(false), requestManager: manager });
  assert.deepEqual(await noCapability.createMessage({ messages: [{ role: "user", text: "x" }] }, {
    activeClientRequest: true,
  }), {
    ok: false,
    source: "sampling_advice",
    trust: "untrusted_client",
    fallback: "capability_absent",
  });

  const newSession = createMcpSession({ sessionId: "new", transport: "stdio" });
  const notInitialized = createMcpSamplingClient({ session: newSession, requestManager: manager });
  const lifecycle = await notInitialized.createMessage({ messages: [{ role: "user", text: "x" }] }, {
    activeClientRequest: true,
  });
  assert.equal(lifecycle.ok ? "success" : lifecycle.fallback, "session_not_initialized");

  const background = await noCapability.createMessage({ messages: [{ role: "user", text: "x" }] }, {
    activeClientRequest: false,
  });
  assert.equal(background.ok ? "success" : background.fallback, "not_active_client_request");
});

test("sampling normalizes remote errors, timeouts, and invalid results", async () => {
  const responses: Record<string, unknown>[] = [];
  let nextId = 0;
  const manager = createMcpServerRequestManager({
    send: (message) => { responses.push(message); },
    requestIdFactory: () => `sample-${++nextId}`,
  });
  const sampling = createMcpSamplingClient({ session: initializedSession(), requestManager: manager });

  const method = sampling.createMessage({ messages: [{ role: "user", text: "x" }] }, { activeClientRequest: true });
  manager.handleResponse({ jsonrpc: "2.0", id: responses[0]?.id, error: { code: -32601, message: "missing" } });
  const methodOutcome = await method;
  assert.equal(methodOutcome.ok ? "success" : methodOutcome.fallback, "method_not_found");

  const invalid = sampling.createMessage({ messages: [{ role: "user", text: "x" }] }, { activeClientRequest: true });
  manager.handleResponse({ jsonrpc: "2.0", id: responses[1]?.id, result: { role: "assistant", content: { type: "image" } } });
  const invalidOutcome = await invalid;
  assert.equal(invalidOutcome.ok ? "success" : invalidOutcome.fallback, "invalid_result");

  const timeout = sampling.createMessage({ messages: [{ role: "user", text: "x" }] }, {
    activeClientRequest: true,
    absoluteTimeoutMs: 10,
  });
  const timeoutOutcome = await timeout;
  assert.equal(timeoutOutcome.ok ? "success" : timeoutOutcome.fallback, "timeout");
  manager.close();
});
