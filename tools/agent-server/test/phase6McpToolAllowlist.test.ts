import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import readline from "node:readline";
import test from "node:test";

const MCP_ENTRYPOINT = fileURLToPath(new URL("../mcp.ts", import.meta.url));
const TSX_LOADER = fileURLToPath(new URL("../../graph-react-app/node_modules/tsx/dist/loader.mjs", import.meta.url));
const PHASE6_RUNTIME_TOOLS = [
  "obsidian_epoch.register_explorer",
  "obsidian_epoch.begin_phase6_experiment",
  "obsidian_epoch.prepare_journey",
  "obsidian_epoch.player_panel",
  "obsidian_epoch.progress",
  "obsidian_epoch.world_overview",
  "obsidian_epoch.world_content",
  "obsidian_epoch.begin_phase6_run",
  "obsidian_epoch.start_journey_compact",
  "obsidian_epoch.journey_status_compact",
  "obsidian_epoch.propose_journey_step_compact",
  "obsidian_epoch.commit_journey_action_compact",
  "obsidian_epoch.phase6_experiment_status",
  "obsidian_epoch.run_receipt_compact",
  "obsidian_epoch.phase6_result_compact",
] as const;

function cleanChildEnv(extra: NodeJS.ProcessEnv = {}) {
  const env: NodeJS.ProcessEnv = { NODE_NO_WARNINGS: "1" };
  for (const key of ["PATH", "TMPDIR", "LANG", "LC_ALL"] as const) {
    if (process.env[key]) env[key] = process.env[key];
  }
  return { ...env, ...extra };
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  assert.ok(value && typeof value === "object" && !Array.isArray(value), label);
  return value as Record<string, unknown>;
}

function createStdioClient(env: NodeJS.ProcessEnv) {
  const child = spawn(process.execPath, ["--import", TSX_LOADER, MCP_ENTRYPOINT], {
    stdio: ["pipe", "pipe", "pipe"],
    env: cleanChildEnv(env),
  });
  assert.ok(child.stdin && child.stdout && child.stderr);
  const input = child.stdin;
  const lines = readline.createInterface({ input: child.stdout, crlfDelay: Infinity });
  const responses = lines[Symbol.asyncIterator]();
  let stderr = "";
  child.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString("utf8"); });

  return {
    async request(id: number, method: string, params?: Record<string, unknown>) {
      input.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, ...(params ? { params } : {}) })}\n`);
      const response = await responses.next();
      if (response.done) throw new Error(`stdio_mcp_exited_without_response:${stderr}`);
      const parsed: unknown = JSON.parse(response.value);
      return asRecord(parsed, "stdio response must be an object");
    },
    notify(method: string) {
      input.write(`${JSON.stringify({ jsonrpc: "2.0", method })}\n`);
    },
    async close() {
      input.end();
      lines.close();
      if (child.exitCode !== null || child.signalCode !== null) return;
      const exited = new Promise<void>((resolve) => child.once("exit", () => resolve()));
      child.kill("SIGTERM");
      let timeout: NodeJS.Timeout | undefined;
      const outcome = await Promise.race([
        exited.then(() => "exited" as const),
        new Promise<"timeout">((resolve) => {
          timeout = setTimeout(() => resolve("timeout"), 1_500);
          timeout.unref();
        }),
      ]);
      if (timeout) clearTimeout(timeout);
      if (outcome === "timeout" && child.exitCode === null && child.signalCode === null) {
        child.kill("SIGKILL");
        await exited;
      }
    },
  };
}

async function createFakeWorldServer() {
  let requestCount = 0;
  const server = createServer((_request, response) => {
    requestCount += 1;
    response.writeHead(500, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: "unexpected_forward" }));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    requestCount: () => requestCount,
    close: () => new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    }),
  };
}

test("Phase 6 stdio MCP exposes exactly the configured runtime tools and blocks hidden calls locally", async () => {
  const world = await createFakeWorldServer();
  const client = createStdioClient({
    AGENT_WORLD_SERVER: world.baseUrl,
    PHASE6_MCP_TOOL_ALLOWLIST: JSON.stringify(PHASE6_RUNTIME_TOOLS),
  });
  try {
    const initialized = await client.request(1, "initialize", {
      protocolVersion: "2025-06-18",
      clientInfo: { name: "phase6-allowlist-test", version: "1.0.0" },
      capabilities: {},
    });
    const initializeResult = asRecord(initialized.result, "initialize result must be an object");
    assert.deepEqual((initializeResult.capabilities as Record<string, unknown>).tools, {});
    client.notify("notifications/initialized");

    const listed = await client.request(2, "tools/list");
    const listResult = asRecord(listed.result, "tools/list result must be an object");
    assert.ok(Array.isArray(listResult.tools));
    const tools = listResult.tools.map((tool) => asRecord(tool, "tool schema must be an object"));
    assert.deepEqual(tools.map((tool) => tool.name), PHASE6_RUNTIME_TOOLS);
    assert.ok(tools.every((tool) => tool.inputSchema && typeof tool.inputSchema === "object"));
    assert.equal(tools.length, 15);
    for (const hidden of [
      "obsidian_epoch.world_health",
      "obsidian_epoch.events",
      "obsidian_epoch.journey_status",
    ]) {
      assert.equal(tools.some((tool) => tool.name === hidden), false, hidden);
    }

    const hiddenCall = await client.request(3, "tools/call", {
      name: "obsidian_epoch.events",
      arguments: {},
    });
    const hiddenError = asRecord(hiddenCall.error, "hidden tools/call must return an error");
    assert.equal(hiddenError.code, -32602);
    assert.equal(hiddenError.message, "unknown_tool:obsidian_epoch.events");
    assert.equal(world.requestCount(), 0);
  } finally {
    await client.close();
    await world.close();
  }
});

test("stdio MCP fails closed during startup for invalid and unknown allowlist env", () => {
  for (const [label, serialized, errorCode] of [
    ["invalid", "{", "invalid_json"],
    ["unknown", JSON.stringify(["obsidian_epoch.not_a_runtime_tool"]), "unknown_tool"],
  ] as const) {
    const result = spawnSync(process.execPath, ["--import", TSX_LOADER, MCP_ENTRYPOINT], {
      encoding: "utf8",
      env: cleanChildEnv({
        AGENT_WORLD_SERVER: "http://127.0.0.1:9",
        PHASE6_MCP_TOOL_ALLOWLIST: serialized,
      }),
      timeout: 15_000,
    });
    assert.equal(result.error, undefined, label);
    assert.equal(result.signal, null, label);
    assert.notEqual(result.status, 0, label);
    assert.match(result.stderr, new RegExp(`phase6_mcp_tool_allowlist_${errorCode}`), label);
  }
});
