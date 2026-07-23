import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import readline from "node:readline";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createSequentialEpochIdFactory } from "../lib/epoch/protocol.ts";
import { createAgentHttpServer } from "../lib/httpServer.ts";
import { createAgentWorldRuntime } from "../lib/mcpTools.ts";
import { createPhase6InMemoryStores } from "./phase6InMemoryStores.ts";

test("local Host through package proxy completes remote Streamable HTTP Sampling", async () => {
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
  const server = createAgentHttpServer({ runtime, health: { store: { kind: "sqlite", sqlitePath: ":memory:" } } });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const registrationResponse = await fetch(`${baseUrl}/api/epoch/pairing/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ idempotencyKey: "register-proxy-sampling-1" }),
  });
  assert.equal(registrationResponse.status, 201);
  const registration = await registrationResponse.json() as Record<string, string>;

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

    const preparedCall = await request(2, "tools/call", {
      name: "obsidian_epoch.prepare_journey",
      arguments: {
        agentId: registration.agentId,
        destinationRegionId: "region_gray_harbor",
        recoveryCode: registration.recoveryCode,
        idempotencyKey: "prepare-proxy-sampling-1",
      },
    });
    assert.ok(!preparedCall.error, preparedCall.error?.message);
    const prepared = JSON.parse(preparedCall.result.content[0].text);
    const startedCall = await request(3, "tools/call", {
      name: "obsidian_epoch.start_journey",
      arguments: {
        journeyId: prepared.journey.journeyId,
        expectedVersion: prepared.journey.version,
        decisionMode: "host_sampling",
        recoveryCode: registration.recoveryCode,
        idempotencyKey: "start-proxy-sampling-1",
      },
    });
    assert.ok(!startedCall.error, startedCall.error?.message);
    const started = JSON.parse(startedCall.result.content[0].text);
    assert.equal(started.sampling.ok, true);
    assert.equal(started.settledAction.actionOptionId, started.sampling.decision.actionOptionId);
    assert.equal(started.mainEpisode.phase, "main");
    assert.equal(started.returnEpisode.phase, "return");
    assert.deepEqual([started.arrivalEpisode, started.mainEpisode, started.returnEpisode]
      .map((episode: { narrative: { kind: string } }) => episode.narrative.kind),
    ["grounded_narrative", "grounded_narrative", "grounded_narrative"]);
    realNow = "2026-07-12T00:45:00.000Z";
    worldNow = "2026-01-01T09:30:00.000Z";
    const statusCall = await request(4, "tools/call", {
      name: "obsidian_epoch.journey_status",
      arguments: { journeyId: prepared.journey.journeyId, recoveryCode: registration.recoveryCode },
    });
    assert.ok(!statusCall.error, statusCall.error?.message);
    const status = JSON.parse(statusCall.result.content[0].text);
    assert.equal(status.journey.status, "settled");
    assert.equal(status.episodes.length, 3);
    const verificationUrl = status.finalVerification.page.urlPath;
    const verification = await fetch(`${baseUrl}${verificationUrl}`);
    assert.equal(verification.status, 200);
    const verificationHtml = await verification.text();
    assert.match(verificationHtml, /这是一份面向玩家的完整故事/);
    assert.match(verificationHtml, /完整故事报告/);
    assert.doesNotMatch(verificationHtml, /从旅途中寄来|历程时间线/);
  } finally {
    lines.close();
    child.stdin.destroy();
    if (!child.killed) child.kill("SIGTERM");
    await Promise.race([once(child, "exit"), new Promise((resolve) => setTimeout(resolve, 1_000))]);
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
