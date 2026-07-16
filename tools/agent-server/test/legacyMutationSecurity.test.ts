import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import test from "node:test";

import { createAgentHttpServer } from "../lib/httpServer.ts";
import {
  createAgentWorldMcpRuntime,
  createAgentWorldRuntime,
} from "../lib/mcpTools.ts";

const LEGACY_MUTATION_DISABLED_ERROR = "legacy_mutation_disabled_in_production";

async function withNodeEnv<T>(nodeEnv: string, run: () => Promise<T>): Promise<T> {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = nodeEnv;
  try {
    return await run();
  } finally {
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
  }
}

async function postJson(baseUrl: string, path: string, body: Record<string, unknown>) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return {
    status: response.status,
    body: await response.json() as Record<string, unknown>,
  };
}

test("production HTTP closes legacy start and submit before trusting request identities", async () => {
  await withNodeEnv("production", async () => {
    const server = createAgentHttpServer({ runtime: createAgentWorldRuntime() });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}`;

    try {
      const start = await postJson(baseUrl, "/api/runs/start", {
        explorerId: "explorer_forged",
        agentId: "agent_forged",
      });
      const submit = await postJson(baseUrl, "/api/runs/submit", {
        explorerId: "explorer_forged",
        agentId: "agent_forged",
        runTicket: "rt_forged",
      });

      assert.equal(start.status, 403);
      assert.equal(start.body.error, LEGACY_MUTATION_DISABLED_ERROR);
      assert.equal(submit.status, 403);
      assert.equal(submit.body.error, LEGACY_MUTATION_DISABLED_ERROR);
      assert.doesNotMatch(JSON.stringify([start.body, submit.body]), /explorer_forged|agent_forged|rt_forged/);
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });
});

test("production MCP closes legacy start and submit with the same stable error code", async () => {
  await withNodeEnv("production", async () => {
    const mcp = createAgentWorldMcpRuntime();
    await assert.rejects(
      () => mcp.callTool("agent_world.start_run", {
        explorerId: "explorer_forged",
        agentId: "agent_forged",
      }),
      (error: unknown) => error instanceof Error && error.message === LEGACY_MUTATION_DISABLED_ERROR,
    );
    await assert.rejects(
      () => mcp.callTool("agent_world.submit_battle_report", {
        explorerId: "explorer_forged",
        agentId: "agent_forged",
        runTicket: "rt_forged",
      }),
      (error: unknown) => error instanceof Error && error.message === LEGACY_MUTATION_DISABLED_ERROR,
    );
  });
});

test("development keeps legacy start available for compatibility", async () => {
  await withNodeEnv("development", async () => {
    const mcp = createAgentWorldMcpRuntime({
      tickets: { idFactory: () => "rt_legacy_development_00000001" },
    });
    const result = await mcp.callTool("agent_world.start_run", {
      explorerId: "explorer_development",
      agentId: "agent_development",
    });
    const payload = JSON.parse(result.content[0]?.text || "{}") as Record<string, unknown>;
    assert.equal(payload.runTicket, "rt_legacy_development_00000001");
  });
});
