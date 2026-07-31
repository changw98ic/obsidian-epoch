import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { createAgentHttpServer } from "../lib/httpServer.ts";
import { createAgentWorldMcpRuntime } from "../lib/mcpTools.ts";
import { createAgentWorldRuntime } from "../lib/mcpRuntimeCore.ts";
import { createAgentPersistenceFromEnv } from "../lib/persistenceConfig.ts";
import { epochEventsForPersistence } from "../lib/epoch/runtimePublicProjectionRules.ts";
import { readSqliteJsonlRecords } from "../lib/sqliteStore.ts";
import { createEpochEventBatchJsonlAppender, createJsonlCausalIdempotencyManifestStore } from "../lib/store.ts";

const WORLD_ID = "integration_infinite_world";
const NOW = "2026-07-20T00:00:00.000Z";

function command(idempotencyKey = "integration-command-1", targetWorldMinute = 10, actorId = "identity_integration") {
  return {
    commandType: "world_tick",
    commandId: `cmd_${idempotencyKey}`,
    worldId: WORLD_ID,
    actor: { actorType: "player_identity", actorId },
    submittedAt: NOW,
    requestedWorldMinute: targetWorldMinute,
    idempotencyKey,
    authorizationRefs: ["auth:integration"],
    payload: {
      streamId: "world_tick:integration",
      currentWorldMinute: 0,
      targetWorldMinute,
      sourceEventIds: [],
    },
  };
}

function textPayload(result: { readonly content: readonly { readonly text: string }[] }) {
  return JSON.parse(result.content[0]?.text || "{}") as Record<string, unknown>;
}

function runtimeWithPersistence(options: Parameters<typeof createAgentWorldRuntime>[0] = {}) {
  return createAgentWorldRuntime({
    ...options,
    infiniteWorld: {
      worldId: WORLD_ID,
      now: () => NOW,
      idFactory: (kind: string, input: Record<string, unknown>) => `${kind}_${String(input.idempotencyKey || input.commandId)}`,
      ...options.infiniteWorld,
    },
    epoch: {
      operatorKey: "operator-infinite-world",
      ...options.epoch,
    },
  });
}

test("persistence config injects JSONL causal idempotency store and epoch batch adapter", async () => {
  const tempDir = await mkdtemp(path.join(tmpdir(), "infinite-world-jsonl-"));
  try {
    const appendBatch = createEpochEventBatchJsonlAppender(tempDir);
    const runtime = runtimeWithPersistence({
      infiniteWorld: {
        idempotencyStore: createJsonlCausalIdempotencyManifestStore(tempDir),
        atomicCommit: ({ atomic, epochEvents }) => {
          if (!atomic?.appendJsonl) throw new Error("causal_atomic_append_required");
          atomic.appendJsonl("epoch-events.jsonl", {
            type: "epoch_event_batch",
            events: epochEvents,
          });
        },
      },
    });

    const result = await runtime.infiniteWorldCommand({
      command: command(),
      operatorKey: "operator-infinite-world",
    });

    assert.equal((result as { replayed?: boolean }).replayed, false);
    const manifestLines = (await readFile(path.join(tempDir, "causal-idempotency.jsonl"), "utf8")).trim().split("\n");
    const epochLines = (await readFile(path.join(tempDir, "epoch-events.jsonl"), "utf8")).trim().split("\n");
    assert.equal(manifestLines.length, 2);
    assert.equal(epochLines.length, 1);
    assert.equal(JSON.parse(epochLines[0] as string).type, "epoch_event_batch");
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("SQLite causal idempotency store replays after runtime restart without a duplicate batch", async () => {
  const tempDir = await mkdtemp(path.join(tmpdir(), "infinite-world-sqlite-"));
  const dbPath = path.join(tempDir, "world.sqlite");
  try {
    const persistence = await createAgentPersistenceFromEnv({
      AGENT_SERVER_STORE: "sqlite",
      AGENT_SERVER_SQLITE_PATH: dbPath,
    }, tempDir);
    const firstRuntime = runtimeWithPersistence({
      infiniteWorld: {
        idempotencyStore: persistence.causalIdempotencyStore,
        atomicCommit: ({ atomic, epochEvents }) => {
          if (atomic?.appendJsonl) atomic.appendJsonl("epoch-events.jsonl", { type: "epoch_event_batch", events: epochEvents });
        },
      },
    });

    await firstRuntime.infiniteWorldCommand({
      command: command(),
      operatorKey: "operator-infinite-world",
    });
    const reloadedPersistence = await createAgentPersistenceFromEnv({
      AGENT_SERVER_STORE: "sqlite",
      AGENT_SERVER_SQLITE_PATH: dbPath,
    }, tempDir);
    const restarted = runtimeWithPersistence({
      epochEvents: reloadedPersistence.loadedOptions.epochEvents,
      infiniteWorld: {
        idempotencyStore: reloadedPersistence.causalIdempotencyStore,
        atomicCommit: ({ atomic, epochEvents }) => {
          if (atomic?.appendJsonl) atomic.appendJsonl("epoch-events.jsonl", { type: "epoch_event_batch", events: epochEvents });
        },
      },
    });
    const replay = await restarted.infiniteWorldCommand({
      command: command(),
      operatorKey: "operator-infinite-world",
    });

    assert.equal((replay as { replayed?: boolean }).replayed, true);
    assert.equal(readSqliteJsonlRecords(dbPath, "epoch-events.jsonl").length, 1);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("persisted causal event recovery fails closed on corrupted event while valid history recovers", async () => {
  const firstRuntime = runtimeWithPersistence();
  const firstResult = await firstRuntime.infiniteWorldCommand({
    command: command("corrupt-recovery"),
    operatorKey: "operator-infinite-world",
  });
  const persistedEvents = epochEventsForPersistence(firstResult);
  assert.equal(persistedEvents.length, 1);

  const restarted = runtimeWithPersistence({ epochEvents: persistedEvents });
  const recoveredEvent = (firstResult as { readonly event: { readonly stream: { readonly streamType: string; readonly streamId: string } } }).event;
  const followUpCommand = command("post-recovery", 11);
  const followUp = await restarted.infiniteWorldCommand({
    command: {
      ...followUpCommand,
      expectedStreamVersions: [{
        streamType: recoveredEvent.stream.streamType,
        streamId: recoveredEvent.stream.streamId,
        expectedVersion: 2,
      }],
      payload: {
        ...followUpCommand.payload,
        currentWorldMinute: 10,
      },
    },
    operatorKey: "operator-infinite-world",
  });
  assert.equal((followUp as { replayed?: boolean }).replayed, false);

  const corruptedEvent = {
    ...persistedEvents[0],
    payload: "not-a-causal-world-event-payload",
  } as EpochEvent;
  assert.throws(
    () => runtimeWithPersistence({
      epochEvents: [
        { type: "legacy_non_causal_event", payload: "ignored" },
        corruptedEvent,
      ],
    }),
    /causal_world_event_recovery_failed:index=1:.*type=causal_world_event_recorded/,
  );
});

test("MCP infinite world tools cover command, conflict, unauthorized, degraded, snapshot, health and migrate", async () => {
  const mcp = createAgentWorldMcpRuntime({
    runtime: runtimeWithPersistence({
      infiniteWorld: {
        ingestCanonicalEvents: () => {
          throw new Error("projection-down");
        },
      },
    }),
  });
  const names = mcp.listTools().map((tool) => tool.name);
  for (const name of [
    "obsidian_epoch.command",
    "obsidian_epoch.world_snapshot",
    "obsidian_epoch.world_health",
    "obsidian_epoch.world_migrate",
  ]) {
    assert.ok(names.includes(name), `${name} listed`);
  }
  const committed = textPayload(await mcp.callTool("obsidian_epoch.command", {
    command: command("mcp-degraded"),
    operatorKey: "operator-infinite-world",
  }));
  assert.equal(committed.projectionStatus, "degraded");
  assert.deepEqual(committed.warnings, ["PROJECTION_LAGGING"]);
  assert.equal((committed.health as { health: { status: string } }).health.status, "degraded");

  await assert.rejects(
    () => mcp.callTool("obsidian_epoch.world_snapshot"),
    /operator_key_required/,
  );
  const snapshotTool = mcp.listTools().find((tool) => tool.name === "obsidian_epoch.world_snapshot");
  assert.ok(snapshotTool?.inputSchema.required.includes("operatorKey"));
  const snapshot = textPayload(await mcp.callTool("obsidian_epoch.world_snapshot", {
    operatorKey: "operator-infinite-world",
  }));
  assert.equal(snapshot.worldId, WORLD_ID);
  assert.equal((snapshot.snapshot as { worldId: string }).worldId, WORLD_ID);

  const health = textPayload(await mcp.callTool("obsidian_epoch.world_health"));
  assert.equal((health.health as { health: { status: string } }).health.status, "degraded");

  const migration = textPayload(await mcp.callTool("obsidian_epoch.world_migrate", {
    operatorKey: "operator-infinite-world",
  }));
  assert.equal((migration.migration as { report: { dryRun: boolean } }).report.dryRun, true);

  await assert.rejects(
    () => mcp.callTool("obsidian_epoch.command", { command: command("unauthorized") }),
    /infinite_world_owner_or_operator_auth_required/,
  );
  await assert.rejects(
    () => mcp.callTool("obsidian_epoch.command", {
      command: command("mcp-degraded", 11),
      operatorKey: "operator-infinite-world",
    }),
    /causal_idempotency_conflict/,
  );
  await assert.rejects(
    () => mcp.callTool("obsidian_epoch.world_migrate", {
      operatorKey: "operator-infinite-world",
      dryRun: false,
    }),
    /infinite_world_migrate_dry_run_required/,
  );
});

test("HTTP MCP tools/call persists infinite world epoch batch exactly once and reports health", async () => {
  const persisted: unknown[][] = [];
  const runtime = runtimeWithPersistence();
  const server = createAgentHttpServer({
    runtime,
    persistEpochEventBatch: async (events) => {
      persisted.push([...events]);
    },
    health: { store: { kind: "jsonl" } },
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const baseUrl = `http://127.0.0.1:${address.port}`;
  try {
    const call = async () => {
      const response = await fetch(`${baseUrl}/api/epoch/mcp/tools/call`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "obsidian_epoch.command",
          arguments: { command: command("http-once"), operatorKey: "operator-infinite-world" },
        }),
      });
      return {
        status: response.status,
        body: await response.json() as Record<string, unknown>,
      };
    };
    const first = await call();
    const replay = await call();
    assert.equal(first.status, 200);
    assert.equal(replay.status, 200);
    assert.equal(persisted.length, 1);
    assert.equal(persisted[0]?.length, 1);

    const healthResponse = await fetch(`${baseUrl}/api/health`);
    const health = await healthResponse.json() as { checks: { infiniteWorld: { worldId: string } } };
    assert.equal(healthResponse.status, 200);
    assert.equal(health.checks.infiniteWorld.worldId, WORLD_ID);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
