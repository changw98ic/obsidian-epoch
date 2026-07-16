import assert from "node:assert/strict";
import test from "node:test";
import {
  createMcpSession,
  McpSessionError,
  MCP_SUPPORTED_PROTOCOL_VERSIONS,
  parseMcpInitializeParams,
} from "../lib/mcpSession.ts";

const validInitializeParams = () => ({
  protocolVersion: "2025-06-18",
  capabilities: {
    roots: { listChanged: true },
    sampling: {},
    "example.dev/custom": { enabled: true },
  },
  clientInfo: { name: "test-host", title: "Test Host", version: "1.0.0" },
});

function assertSessionError(action: () => unknown, code: string): McpSessionError {
  let matched: McpSessionError | undefined;
  assert.throws(action, (error: unknown) => {
    assert.ok(error instanceof McpSessionError);
    assert.equal(error.code, code);
    assert.equal(error.message, code);
    matched = error;
    return true;
  });
  if (!matched) throw new Error("expected_mcp_session_error");
  return matched;
}

test("MCP session follows new -> initializing -> initialized -> closed", () => {
  const session = createMcpSession({
    sessionId: "session_1",
    transport: "stdio",
    now: () => new Date("2026-07-12T00:00:00.000Z"),
  });

  assert.equal(session.state, "new");
  assertSessionError(() => session.assertInitialized(), "mcp_session_not_initialized");
  const initialized = session.acceptInitialize(validInitializeParams());
  assert.equal(session.state, "initializing");
  assert.equal(initialized.protocolVersion, "2025-06-18");
  assert.equal(session.clientInfo?.name, "test-host");
  assert.equal(session.supportsClientCapability("sampling"), true);
  assertSessionError(() => session.assertInitialized(), "mcp_session_not_initialized");

  session.acceptInitializedNotification();
  session.assertInitialized();
  assert.equal(session.state, "initialized");

  session.close();
  assert.equal(session.state, "closed");
  assert.equal(session.closedAt, "2026-07-12T00:00:00.000Z");
  assert.deepEqual(session.snapshot(), {
    sessionId: "session_1",
    transport: "stdio",
    state: "closed",
    protocolVersion: "2025-06-18",
    clientInfo: { name: "test-host", title: "Test Host", version: "1.0.0" },
    clientCapabilities: {
      roots: { listChanged: true },
      sampling: {},
      "example.dev/custom": { enabled: true },
    },
    closedAt: "2026-07-12T00:00:00.000Z",
  });
});

test("initialize stores an immutable client capability snapshot without declaring server capabilities", () => {
  const params = validInitializeParams();
  const session = createMcpSession({ sessionId: "session_caps", transport: "streamable-http" });
  session.acceptInitialize(params);
  params.capabilities.roots.listChanged = false;

  assert.equal(session.clientCapabilities?.roots?.listChanged, true);
  assert.equal(session.supportsClientCapability("sampling"), true);
  assert.equal(session.supportsClientCapability("tools"), false);
  assert.equal("serverCapabilities" in session.snapshot(), false);
  assert.throws(() => {
    Object.assign(session.clientCapabilities?.sampling ?? {}, { injected: true });
  }, TypeError);
});

test("initialize negotiates the frozen MCP 2025-06-18 version set", () => {
  assert.deepEqual(MCP_SUPPORTED_PROTOCOL_VERSIONS, ["2025-06-18"]);
  const unsupported = validInitializeParams();
  unsupported.protocolVersion = "2025-11-25";
  const negotiated = parseMcpInitializeParams(unsupported);
  assert.equal(negotiated.requestedProtocolVersion, "2025-11-25");
  assert.equal(negotiated.protocolVersion, "2025-06-18");
});

test("initialize strictly validates required protocol, capabilities, and clientInfo fields", () => {
  const invalidParams: unknown[] = [
    null,
    {},
    { ...validInitializeParams(), protocolVersion: 7 },
    { ...validInitializeParams(), capabilities: null },
    { ...validInitializeParams(), capabilities: [] },
    { ...validInitializeParams(), capabilities: { sampling: true } },
    { ...validInitializeParams(), capabilities: { roots: { listChanged: "yes" } } },
    { ...validInitializeParams(), capabilities: { experimental: { feature: true } } },
    { ...validInitializeParams(), clientInfo: null },
    { ...validInitializeParams(), clientInfo: { name: "host" } },
    { ...validInitializeParams(), clientInfo: { name: "", version: "1" } },
    { ...validInitializeParams(), clientInfo: { name: "host", version: 1 } },
    { ...validInitializeParams(), clientInfo: { name: "host", version: "1", title: 1 } },
    { ...validInitializeParams(), clientInfo: { name: "host", version: "1", websiteUrl: "https://example.com" } },
  ];
  for (const params of invalidParams) {
    assertSessionError(() => parseMcpInitializeParams(params), "mcp_initialize_params_invalid");
  }
});

test("failed initialize validation leaves the session new and retryable", () => {
  const session = createMcpSession({ sessionId: "session_retry", transport: "stdio" });
  assertSessionError(
    () => session.acceptInitialize({ ...validInitializeParams(), capabilities: null }),
    "mcp_initialize_params_invalid",
  );
  assert.equal(session.state, "new");
  session.acceptInitialize(validInitializeParams());
  assert.equal(session.state, "initializing");
});

test("duplicate initialize and out-of-order initialized notifications have stable errors", () => {
  const session = createMcpSession({ sessionId: "session_order", transport: "stdio" });
  assertSessionError(
    () => session.acceptInitializedNotification(),
    "mcp_initialized_notification_unexpected",
  );
  session.acceptInitialize(validInitializeParams());
  assertSessionError(
    () => session.acceptInitialize(validInitializeParams()),
    "mcp_initialize_already_received",
  );
  session.acceptInitializedNotification();
  assertSessionError(
    () => session.acceptInitializedNotification(),
    "mcp_initialized_notification_unexpected",
  );
  assertSessionError(
    () => session.acceptInitialize(validInitializeParams()),
    "mcp_initialize_already_received",
  );
});

test("closed sessions reject lifecycle and operation methods with one stable error", () => {
  const session = createMcpSession({ sessionId: "session_closed", transport: "stdio" });
  session.acceptInitialize(validInitializeParams());
  session.acceptInitializedNotification();
  session.close(new Date("2026-07-12T01:00:00.000Z"));
  session.close(new Date("2026-07-12T02:00:00.000Z"));

  assert.equal(session.closedAt, "2026-07-12T01:00:00.000Z");
  assertSessionError(() => session.assertInitialized(), "mcp_session_closed");
  assertSessionError(() => session.acceptInitializedNotification(), "mcp_session_closed");
  assertSessionError(() => session.acceptInitialize(validInitializeParams()), "mcp_session_closed");
});
