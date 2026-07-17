import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import test from "node:test";

import { createEpochPersistenceGuard } from "../lib/epochPersistence.ts";
import { createAgentHttpServer } from "../lib/httpServer.ts";
import { createAgentWorldRuntime } from "../lib/mcpTools.ts";
import { PlayerMcpAccessTokenStore } from "../lib/playerMcpAccessTokenStore.ts";

test("community persistence failure fails closed before another mutation can be served", async () => {
  const tokenStore = await PlayerMcpAccessTokenStore.open();
  const issued = await tokenStore.issue({ explorerId: "community_persistence_guard", ttlMs: 60_000 });
  const runtime = createAgentWorldRuntime();
  const persistenceGuard = createEpochPersistenceGuard();
  let communityWrites = 0;
  const server = createAgentHttpServer({
    runtime,
    persistenceGuard,
    playerMcpAccessTokens: tokenStore,
    persistJsonl: async (fileName) => {
      if (fileName === "community.jsonl") {
        communityWrites += 1;
        throw new Error("community_disk_unavailable");
      }
    },
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const headers = {
    authorization: `Bearer ${issued.bearerToken}`,
    "content-type": "application/json",
  };

  try {
    const first = await fetch(`${baseUrl}/api/community/comment`, {
      method: "POST",
      headers,
      body: JSON.stringify({ targetType: "claim", targetId: "claim_guard", body: "must not be served" }),
    });
    assert.equal(first.status, 503);
    assert.deepEqual(await first.json(), { error: "epoch_persistence_unavailable" });

    const second = await fetch(`${baseUrl}/api/community/comment`, {
      method: "POST",
      headers,
      body: JSON.stringify({ targetType: "claim", targetId: "claim_guard", body: "must be rejected" }),
    });
    assert.equal(second.status, 503);
    assert.deepEqual(await second.json(), { error: "epoch_persistence_unavailable" });
    assert.equal(communityWrites, 1);
    assert.equal(persistenceGuard.failed, true);
    assert.equal(runtime.communityState().comments.length, 1);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("legacy context snapshot persistence failure trips the same fail-closed guard", async () => {
  const runtime = createAgentWorldRuntime();
  const persistenceGuard = createEpochPersistenceGuard();
  const server = createAgentHttpServer({
    runtime,
    persistenceGuard,
    persistJsonl: async (fileName) => {
      if (fileName === "context-snapshots.jsonl") throw new Error("context_snapshot_disk_unavailable");
    },
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const first = await fetch(`${baseUrl}/api/world/public-context`);
    assert.equal(first.status, 503);
    assert.deepEqual(await first.json(), { error: "epoch_persistence_unavailable" });

    const health = await fetch(`${baseUrl}/api/health`);
    assert.equal(health.status, 503);
    assert.equal((await health.json()).checks.persistence.status, "error");
    assert.equal(persistenceGuard.failed, true);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
