import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import { createSequentialEpochIdFactory } from "../lib/epoch/protocol.ts";
import { createAgentHttpServer } from "../lib/httpServer.ts";
import { createAgentWorldRuntime } from "../lib/mcpRuntimeCore.ts";
import { hydrateAgentRuntimeOptions } from "../lib/store.ts";
import { createPhase6InMemoryStores } from "./phase6InMemoryStores.ts";

async function postJson(baseUrl: string, pathName: string, body: unknown, headers: Record<string, string> = {}) {
  const response = await fetch(`${baseUrl}${pathName}`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json", connection: "close", ...headers },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  return { response, body: text ? JSON.parse(text) : undefined };
}

async function postJsonOnFreshConnection(baseUrl: string, pathName: string, body: unknown, headers: Record<string, string>) {
  const url = new URL(pathName, baseUrl);
  const payload = JSON.stringify(body);
  return new Promise<{ status: number }>((resolve, reject) => {
    const request = http.request({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: "POST",
      agent: false,
      headers: {
        "content-type": "application/json",
        "content-length": Buffer.byteLength(payload),
        connection: "close",
        ...headers,
      },
    }, (response) => {
      response.resume();
      response.once("end", () => resolve({ status: response.statusCode || 0 }));
    });
    request.once("error", reject);
    request.end(payload);
  });
}

function openSamplingStream(baseUrl: string, pathName: string, headers: Record<string, string>) {
  const seen: Record<string, unknown>[] = [];
  const url = new URL(pathName, baseUrl);
  let resolveReady!: () => void;
  let rejectReady!: (error: Error) => void;
  let resolveMessage!: (message: Record<string, unknown>) => void;
  let rejectMessage!: (error: Error) => void;
  const ready = new Promise<void>((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });
  const message = new Promise<Record<string, unknown>>((resolve, reject) => { resolveMessage = resolve; rejectMessage = reject; });
  const request = http.request({
    hostname: url.hostname,
    port: url.port,
    path: url.pathname,
    method: "GET",
    agent: false,
    headers: { accept: "text/event-stream", connection: "close", ...headers },
  }, (response) => {
    if (response.statusCode !== 200) {
      const error = new Error(`sse_status_${response.statusCode}`);
      rejectReady(error);
      rejectMessage(error);
      return;
    }
    resolveReady();
    let buffer = "";
    response.setEncoding("utf8");
    response.on("data", (chunk: string) => {
      buffer += chunk;
      let boundary = buffer.indexOf("\n\n");
      while (boundary >= 0) {
        const frame = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const data = frame.split("\n").filter((line) => line.startsWith("data: ")).map((line) => line.slice(6)).join("\n");
        if (data) {
          const parsed = JSON.parse(data) as Record<string, unknown>;
          seen.push(parsed);
          if (parsed.method === "sampling/createMessage") resolveMessage(parsed);
        }
        boundary = buffer.indexOf("\n\n");
      }
    });
    response.once("error", rejectMessage);
  });
  request.once("error", (error) => { rejectReady(error); rejectMessage(error); });
  request.end();
  return { ready, message, seen, close: () => request.destroy() };
}

async function waitForSamplingMessage(
  stream: { readonly seen: readonly Record<string, unknown>[] },
  index: number,
) {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    const messages = stream.seen.filter((message) => message.method === "sampling/createMessage");
    if (messages[index]) return messages[index];
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
  throw new Error(`sampling_message_timeout:${index}`);
}

test("Streamable HTTP carries nested Sampling request and response on one MCP session", async () => {
  const writes = new Map<string, Record<string, unknown>[]>();
  const phase6Stores = createPhase6InMemoryStores();
  const runtime = createAgentWorldRuntime({
    epoch: {
      idFactory: createSequentialEpochIdFactory("http_sampling"),
      phase6RunAssemblyRepository: phase6Stores.phase6RunAssemblyRepository,
      phase6JourneyContextStore: phase6Stores.phase6JourneyContextStore,
      phase6ExperimentStore: phase6Stores.phase6ExperimentStore,
      phase6RagTraceStore: phase6Stores.phase6RagTraceStore,
    },
    journey: {
      now: () => "2026-07-12T00:00:00.000Z",
      worldNow: () => "2026-01-01T08:00:00.000Z",
    },
  });
  const server = createAgentHttpServer({
    runtime,
    allowLegacyHttpIdentityRegistration: true,
    health: { store: { kind: "sqlite", sqlitePath: ":memory:" } },
    persistJsonl: async (fileName, record) => {
      const records = writes.get(fileName) || [];
      records.push(record as Record<string, unknown>);
      writes.set(fileName, records);
    },
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const baseUrl = `http://127.0.0.1:${address.port}`;
  try {
    const initialized = await postJson(baseUrl, "/mcp", {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: { sampling: {} },
        clientInfo: { name: "http-sampling-host", version: "1" },
      },
    });
    assert.equal(initialized.response.status, 200);
    const headers = {
      "mcp-session-id": initialized.response.headers.get("mcp-session-id") || "",
      "mcp-protocol-version": "2025-06-18",
    };
    assert.ok(headers["mcp-session-id"]);
    assert.equal((await postJson(baseUrl, "/mcp", {
      jsonrpc: "2.0",
      method: "notifications/initialized",
    }, headers)).response.status, 202);

    const registration = await postJson(baseUrl, "/api/epoch/pairing/register", {
      idempotencyKey: "register-http-sampling-1",
    });
    assert.equal(registration.response.status, 201);
    const recoveryCode = registration.body.recoveryCode;
    const preparedCall = await postJson(baseUrl, "/mcp", {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: {
        name: "obsidian_epoch.prepare_journey",
        arguments: {
          agentId: registration.body.agentId,
          destinationRegionId: "region_gray_harbor",
          recoveryCode,
          idempotencyKey: "prepare-http-sampling-1",
        },
      },
    }, headers);
    const prepared = JSON.parse(preparedCall.body.result.content[0].text);

    const stream = openSamplingStream(baseUrl, "/mcp", headers);
    await stream.ready;
    const startPromise = postJson(baseUrl, "/mcp", {
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
      params: {
        name: "obsidian_epoch.start_journey",
        _meta: { progressToken: "journey-progress-1" },
          arguments: {
            journeyId: prepared.journey.journeyId,
            expectedVersion: prepared.journey.version,
            decisionMode: "host_sampling",
            recoveryCode,
            idempotencyKey: "start-http-sampling-1",
          },
        },
    }, headers);
    const samplingPump = (async () => {
        const message = await stream.message;
        const concurrentRegistration = await Promise.race([
          postJson(baseUrl, "/api/epoch/pairing/register", { idempotencyKey: "concurrent-during-sampling" }),
          new Promise<never>((_resolve, reject) => setTimeout(() => reject(new Error("sampling_held_global_mutation_lock")), 1_000)),
        ]);
        assert.equal(concurrentRegistration.response.status, 201);
        const concurrentMutation = await Promise.race([
          postJson(baseUrl, "/api/epoch/result-page/create", {}),
          new Promise<never>((_resolve, reject) => setTimeout(() => reject(new Error("sampling_held_mutation_coordinator")), 1_000)),
        ]);
        assert.equal(concurrentMutation.response.status, 400);
        const params = message.params as Record<string, any>;
        const prompt = JSON.parse(params.messages[0].content.text);
        const selected = prompt.actionOptions[0].actionOptionId;
        const partialHydrated = hydrateAgentRuntimeOptions({
          epochEvents: writes.get("epoch-events.jsonl") || [],
          journeyEvents: writes.get("journey-events.jsonl") || [],
          commandEvents: writes.get("command-events.jsonl") || [],
        });
        const interruptedRuntime = createAgentWorldRuntime(partialHydrated);
        const interruptedStatus = interruptedRuntime.epochJourneyStatus({
          journeyId: prepared.journey.journeyId,
          recoveryCode,
        });
        assert.equal(interruptedStatus.journey.status, "awaiting_agent");
        assert.deepEqual(interruptedStatus.episodes.map((episode) => episode.phase), ["arrival"]);
        const resumedProposal = interruptedRuntime.epochProposeJourneyStep({
          journeyId: prepared.journey.journeyId,
          expectedVersion: interruptedStatus.journey.version,
          recoveryCode,
          idempotencyKey: "resume-after-sampling-interruption",
        });
        const resumedSceneContract = resumedProposal.proposal.sceneContract;
        assert.ok(resumedSceneContract);
        assert.ok(resumedSceneContract.actionOptions.some((option) => option.actionOptionId === selected));
        const acceptSamplingMessage = async (samplingMessage: Record<string, unknown>) => {
          const samplingParams = samplingMessage.params as Record<string, any>;
          const samplingPrompt = JSON.parse(samplingParams.messages[0].content.text);
          const samplingSelection = samplingPrompt.actionOptions[0].actionOptionId;
          const accepted = await postJsonOnFreshConnection(baseUrl, "/mcp", {
            jsonrpc: "2.0",
            id: samplingMessage.id,
            result: {
              role: "assistant",
              content: {
                type: "text",
                text: JSON.stringify({
                  actionOptionId: samplingSelection,
                  rationale: "符合旅程授权",
                  confidence: 0.9,
                }),
              },
              model: "host-test-model",
              stopReason: "endTurn",
            },
          }, headers);
          assert.equal(accepted.status, 202);
        };
        await acceptSamplingMessage(message);
        let samplingIndex = 1;
        while (true) {
          const completed = await Promise.race([
            startPromise.then(() => true, () => true),
            new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 100)),
          ]);
          if (completed) break;
          await acceptSamplingMessage(await waitForSamplingMessage(stream, samplingIndex));
          samplingIndex += 1;
        }
    })();
    const [startCall] = await Promise.all([startPromise, samplingPump]);
    await new Promise<void>((resolve) => setImmediate(resolve));
    stream.close();
    assert.equal(startCall.response.status, 200);
    const started = JSON.parse(startCall.body.result.content[0].text);
    assert.equal(started.sampling.ok, true, JSON.stringify(started.sampling));
    assert.equal(started.settledAction.actionOptionId, started.sampling.decision.actionOptionId);
    assert.ok(["main", "side"].includes(started.mainEpisode.phase));
    assert.equal(started.returnEpisode.phase, "return");
    const progress = stream.seen.filter((message) => message.method === "notifications/progress")
      .map((message) => message.params as { progressToken: string; progress: number });
    assert.ok(progress.length >= 2);
    assert.ok(progress.every((message) => message.progressToken === "journey-progress-1"));
    assert.equal(progress[0]?.progress, 0);
    assert.equal(progress.at(-1)?.progress, 1);
    assert.ok(progress.every((message, index) => index === 0 || message.progress >= progress[index - 1]!.progress));

    const commandRecords = writes.get("command-events.jsonl") || [];
    assert.ok(commandRecords.length >= 1, "Journey and Epoch events must share durable command envelopes");
    const durableJourneyStages = commandRecords
      .filter((record) => record.command === "obsidian_epoch.start_journey"
        || record.command === "obsidian_epoch.propose_journey_step"
        || record.command === "obsidian_epoch.commit_journey_action");
    assert.deepEqual(
      durableJourneyStages.slice(0, 2).map((record) => record.command),
      ["obsidian_epoch.start_journey", "obsidian_epoch.start_journey"],
      "Host Sampling must commit the frozen world window before model I/O and commit journey start before model I/O",
    );
    assert.ok(durableJourneyStages.length >= 3);
    assert.ok(durableJourneyStages.slice(2).every((record) => record.command === "obsidian_epoch.commit_journey_action"));
    const firstStartEventTypes = (durableJourneyStages[0]?.journeyEvents as Array<{ eventType?: string }> || [])
      .map((event) => event.eventType);
    const secondStartEventTypes = (durableJourneyStages[1]?.journeyEvents as Array<{ eventType?: string }> || [])
      .map((event) => event.eventType);
    assert.ok(firstStartEventTypes.includes("journey_world_window_reserved"));
    assert.ok(!firstStartEventTypes.includes("journey_started"));
    assert.ok(secondStartEventTypes.includes("journey_started"));
    const persistedJourneyEventIds = [
      ...(writes.get("journey-events.jsonl") || []).map((record) => (record.event as Record<string, unknown>).eventId),
      ...commandRecords.flatMap((record) => (record.journeyEvents as Record<string, unknown>[]).map((event) => event.eventId)),
    ];
    assert.equal(new Set(persistedJourneyEventIds).size, persistedJourneyEventIds.length);

    const hydrated = hydrateAgentRuntimeOptions({
      epochEvents: writes.get("epoch-events.jsonl") || [],
      journeyEvents: writes.get("journey-events.jsonl") || [],
      commandEvents: commandRecords,
    });
    const restarted = createAgentWorldRuntime(hydrated);
    const restartedStatus = restarted.epochJourneyStatus({
      journeyId: prepared.journey.journeyId,
      recoveryCode,
    });
    assert.equal(restartedStatus.journey.status, "settled");
    const restartedPhases = restartedStatus.episodes.map((episode) => episode.phase);
    assert.equal(restartedPhases[0], "arrival");
    assert.equal(restartedPhases.at(-1), "return");
    assert.ok(restartedPhases.slice(1, -1).every((phase) => phase === "main" || phase === "side"));
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("invalid HTTP initialize is rejected without issuing a durable session", async () => {
  const server = createAgentHttpServer({ runtime: createAgentWorldRuntime() });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const baseUrl = `http://127.0.0.1:${address.port}`;
  try {
    const invalid = await postJson(baseUrl, "/mcp", {
      jsonrpc: "2.0",
      id: "invalid-init",
      method: "initialize",
      params: { protocolVersion: "2025-06-18", capabilities: null, clientInfo: {} },
    });
    assert.equal(invalid.response.status, 400);
    assert.equal(invalid.response.headers.get("mcp-session-id"), null);

    const valid = await postJson(baseUrl, "/mcp", {
      jsonrpc: "2.0",
      id: "valid-init",
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "valid-after-invalid", version: "1" },
      },
    });
    assert.equal(valid.response.status, 200);
    assert.ok(valid.response.headers.get("mcp-session-id"));
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
