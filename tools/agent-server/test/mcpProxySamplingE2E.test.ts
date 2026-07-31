import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import readline from "node:readline";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createSequentialEpochIdFactory } from "../lib/epoch/protocol.ts";
import { createAgentHttpServer } from "../lib/httpServer.ts";
import { createAgentWorldRuntime } from "../lib/mcpRuntimeCore.ts";
import { PlayerMcpAccessTokenStore } from "../lib/playerMcpAccessTokenStore.ts";
import { createPhase6InMemoryStores } from "./phase6InMemoryStores.ts";

test("local Host enrolls through the package proxy before completing remote Streamable HTTP Sampling", async () => {
  let realNow = "2026-07-12T00:00:00.000Z";
  let worldNow = "2026-01-01T08:00:00.000Z";
  const phase6Stores = createPhase6InMemoryStores();
  const runtime = createAgentWorldRuntime({
    epoch: {
      idFactory: createSequentialEpochIdFactory("proxy_sampling"),
      phase6RunAssemblyRepository: phase6Stores.phase6RunAssemblyRepository,
      phase6JourneyContextStore: phase6Stores.phase6JourneyContextStore,
      phase6ExperimentStore: phase6Stores.phase6ExperimentStore,
      phase6RagTraceStore: phase6Stores.phase6RagTraceStore,
    },
    journey: {
      now: () => realNow,
      worldNow: () => worldNow,
    },
  });
  const playerMcpAccessTokens = await PlayerMcpAccessTokenStore.open();
  const server = createAgentHttpServer({
    runtime,
    health: { store: { kind: "sqlite", sqlitePath: ":memory:" } },
    playerMcpAccessTokens,
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const child = spawn(process.execPath, ["tools/agent-server/package/obsidian-epoch/bin/mcp-proxy.ts"], {
    cwd: fileURLToPath(new URL("../../..", import.meta.url)),
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env, AGENT_WORLD_SERVER: baseUrl, AGENT_WORLD_MCP_TOKEN: "" },
  });
  const lines = readline.createInterface({ input: child.stdout, crlfDelay: Infinity });
  const pending = new Map<number, (message: Record<string, any>) => void>();
  const stderr: Buffer[] = [];
  child.stderr.on("data", (chunk) => stderr.push(Buffer.from(chunk)));
  lines.on("line", (line) => {
    const message = JSON.parse(line) as Record<string, any>;
    if (message.method === "sampling/createMessage") {
      const prompt = JSON.parse(message.params.messages[0].content.text);
      child.stdin.write(`${JSON.stringify({
        jsonrpc: "2.0",
        id: message.id,
        result: {
          role: "assistant",
          content: {
            type: "text",
            text: JSON.stringify({
              actionOptionId: prompt.actionOptions[0].actionOptionId,
              rationale: "宿主选择服务器签发的选项",
              confidence: 0.95,
            }),
          },
          model: "proxy-host-test",
          stopReason: "endTurn",
        },
      })}\n`);
      return;
    }
    if (typeof message.id === "number") {
      pending.get(message.id)?.(message);
      pending.delete(message.id);
    }
  });
  const request = (id: number, method: string, params?: Record<string, unknown>) => new Promise<Record<string, any>>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`proxy_timeout:${Buffer.concat(stderr).toString("utf8")}`)), 10_000);
    pending.set(id, (message) => { clearTimeout(timeout); resolve(message); });
    child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, ...(params ? { params } : {}) })}\n`);
  });

  try {
    const initialized = await request(1, "initialize", {
      protocolVersion: "2025-06-18",
      capabilities: { sampling: {} },
      clientInfo: { name: "proxy-e2e-host", version: "1" },
    });
    assert.equal(initialized.result.protocolVersion, "2025-06-18");
    child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })}\n`);

    const bootstrapTools = await request(2, "tools/list");
    assert.deepEqual(
      bootstrapTools.result.tools.map((tool: { name: string }) => tool.name).sort(),
      ["obsidian_epoch.quickstart", "obsidian_epoch.register_explorer"],
    );

    const forbiddenCall = await request(3, "tools/call", {
      name: "obsidian_epoch.progress",
      arguments: {},
    });
    assert.equal(forbiddenCall.error?.message, "mcp_bootstrap_tool_forbidden");

    const registrationCall = await request(4, "tools/call", {
      name: "obsidian_epoch.register_explorer",
      arguments: { idempotencyKey: "register-proxy-sampling-1" },
    });
    assert.ok(!registrationCall.error, registrationCall.error?.message);
    const registration = JSON.parse(registrationCall.result.content[0].text) as Record<string, string>;
    assert.ok(registration.explorerId);
    assert.ok(registration.agentId);
    assert.equal(registration.credentialStored, "proxy");
    assert.equal(registrationCall.result.content[0].text.includes("accessToken"), false);
    assert.equal(registrationCall.result.content[0].text.includes("recoveryCode"), false);

    const preparedCall = await request(5, "tools/call", {
      name: "obsidian_epoch.prepare_journey",
      arguments: {
        agentId: registration.agentId,
        destinationRegionId: "region_gray_harbor",
        idempotencyKey: "prepare-proxy-sampling-1",
      },
    });
    assert.ok(!preparedCall.error, preparedCall.error?.message);
    const prepared = JSON.parse(preparedCall.result.content[0].text);
    const startedCall = await request(6, "tools/call", {
      name: "obsidian_epoch.start_journey",
      arguments: {
        journeyId: prepared.journey.journeyId,
        expectedVersion: prepared.journey.version,
        decisionMode: "host_sampling",
        idempotencyKey: "start-proxy-sampling-1",
      },
    });
    assert.ok(!startedCall.error, startedCall.error?.message);
    const started = JSON.parse(startedCall.result.content[0].text);
    assert.equal(started.sampling.ok, true);
    assert.equal(started.settledAction.actionOptionId, started.sampling.decision.actionOptionId);
    assert.ok(["main", "side"].includes(started.mainEpisode.phase));
    assert.equal(started.returnEpisode.phase, "return");
    assert.deepEqual([started.arrivalEpisode, started.mainEpisode, started.returnEpisode]
      .map((episode: { narrative: { kind: string } }) => episode.narrative.kind),
    ["grounded_narrative", "grounded_narrative", "grounded_narrative"]);
    realNow = "2026-07-12T00:45:00.000Z";
    worldNow = "2026-01-01T09:30:00.000Z";
    const statusCall = await request(7, "tools/call", {
      name: "obsidian_epoch.journey_status",
      arguments: { journeyId: prepared.journey.journeyId },
    });
    assert.ok(!statusCall.error, statusCall.error?.message);
    const status = JSON.parse(statusCall.result.content[0].text);
    assert.equal(status.journey.status, "settled");
    assert.ok(status.episodes.length >= 3);
    assert.equal(status.episodes[0].phase, "arrival");
    assert.equal(status.episodes.at(-1).phase, "return");
    assert.ok(status.episodes.slice(1, -1)
      .every((episode: { phase: string }) => episode.phase === "main" || episode.phase === "side"));
    const verificationUrl = status.finalVerification.page.urlPath;
    const verification = await fetch(`${baseUrl}${verificationUrl}`);
    assert.equal(verification.status, 200);
    const verificationHtml = await verification.text();
    assert.match(verificationHtml, /这是一份面向玩家的完整故事/);
    assert.match(verificationHtml, /完整故事报告/);
    assert.doesNotMatch(verificationHtml, /从旅途中寄来|历程时间线/);
    assert.doesNotMatch(verificationHtml, /Phase 6 结果页校验未通过|PHASE6_RESULT_PAGE_INPUT_MISSING/);
    assert.doesNotMatch(verificationHtml, /<em>奖励<\/em><b>无公开奖励/);
    assert.match(verificationHtml, /<meta name="obsidian-epoch-public-surface" content="sha256:[a-f0-9]{64}">/);
    assert.match(verificationHtml, /href="\/epoch\/web-play">\s*<b>MCP 观察<\/b>/);
    assert.match(verificationHtml, /依据自己的计划决定行动/);
    assert.doesNotMatch(verificationHtml, /调用 obsidian_epoch\.(turn_card|set_downtime)/);
    assert.doesNotMatch(verificationHtml, /服务器推荐/);
    assert.doesNotMatch(verificationHtml, /恢复身份后继续派遣或托管/);
  } finally {
    lines.close();
    child.stdin.destroy();
    if (!child.killed) child.kill("SIGTERM");
    await Promise.race([once(child, "exit"), new Promise((resolve) => setTimeout(resolve, 1_000))]);
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
