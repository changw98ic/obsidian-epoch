import assert from "node:assert/strict";
import test from "node:test";

import { createAgentHttpServer } from "../lib/httpServer.ts";
import { createAgentWorldRuntime } from "../lib/mcpRuntimeCore.ts";

test("HTTP origin sockets outlive reverse-proxy request gaps", () => {
  const server = createAgentHttpServer({ runtime: createAgentWorldRuntime() });

  assert.equal(server.keepAliveTimeout, 65_000);
  assert.equal(server.headersTimeout, 66_000);
  assert.ok(server.headersTimeout > server.keepAliveTimeout);
});
