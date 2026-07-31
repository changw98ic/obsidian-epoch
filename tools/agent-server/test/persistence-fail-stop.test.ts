import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createEpochPersistenceGuard } from "../lib/epochPersistence.ts";
import { createAgentHttpServer } from "../lib/httpServer.ts";
import { createAgentWorldRuntime } from "../lib/mcpRuntimeCore.ts";

async function listen(server: ReturnType<typeof createAgentHttpServer>) {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  return `http://127.0.0.1:${address.port}`;
}

async function close(server: ReturnType<typeof createAgentHttpServer>) {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

async function postJson(baseUrl: string, pathName: string, body: unknown) {
  const response = await fetch(`${baseUrl}${pathName}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() as Record<string, unknown> };
}

async function getJson(baseUrl: string, pathName: string) {
  const response = await fetch(`${baseUrl}${pathName}`);
  return { status: response.status, body: await response.json() as Record<string, unknown> };
}

function runtimeEvents(runtime: ReturnType<typeof createAgentWorldRuntime>) {
  return runtime.epochEvents({ limit: 100 }).events;
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

test("HTTP trips persistence once, skips rejection audit, and rejects later requests before mutation", async () => {
  const runtime = createAgentWorldRuntime();
  const guard = createEpochPersistenceGuard();
  let batchCalls = 0;
  let legacyCalls = 0;
  const server = createAgentHttpServer({
    runtime,
    allowLegacyHttpIdentityRegistration: true,
    persistenceGuard: guard,
    persistEpochEventBatch: async () => {
      batchCalls += 1;
      throw new Error("private:///var/lib/epoch-ledger.sqlite");
    },
    persistJsonl: async () => {
      legacyCalls += 1;
    },
  });
  const baseUrl = await listen(server);
  try {
    const first = await postJson(baseUrl, "/api/epoch/identity/issue", {
      explorerId: "explorer_http_persistence_failure",
      identityName: "持久化失败身份",
      idempotencyKey: "issue-http-persistence-failure-1",
    });
    assert.equal(first.status, 503);
    assert.deepEqual(first.body, { error: "epoch_persistence_unavailable" });
    assert.equal(guard.failed, true);
    assert.equal(batchCalls, 1);
    assert.equal(legacyCalls, 0);
    const eventsAfterFailure = runtimeEvents(runtime);
    assert.equal(eventsAfterFailure.some((event) => event.eventType === "command_rejected"), false);

    const second = await postJson(baseUrl, "/api/epoch/identity/issue", {
      explorerId: "explorer_http_persistence_failure_second",
      idempotencyKey: "issue-http-persistence-failure-2",
    });
    assert.equal(second.status, 503);
    assert.equal(batchCalls, 1);
    assert.equal(runtimeEvents(runtime).length, eventsAfterFailure.length);

    const health = await getJson(baseUrl, "/api/health");
    assert.equal(health.status, 503);
    const checks = health.body.checks as Record<string, unknown>;
    assert.deepEqual(checks.persistence, {
      status: "error",
      code: "epoch_persistence_unavailable",
    });
    assert.equal(JSON.stringify(health.body).includes("/var/lib/epoch-ledger.sqlite"), false);
  } finally {
    await close(server);
  }
});

test("HTTP serializes concurrent mutations through persistence fail-stop", async () => {
  const runtime = createAgentWorldRuntime();
  const guard = createEpochPersistenceGuard();
  const writerEntered = deferred<void>();
  const writerFailure = deferred<void>();
  let batchCalls = 0;
  const server = createAgentHttpServer({
    runtime,
    allowLegacyHttpIdentityRegistration: true,
    persistenceGuard: guard,
    persistEpochEventBatch: async () => {
      batchCalls += 1;
      writerEntered.resolve();
      await writerFailure.promise;
    },
  });
  const baseUrl = await listen(server);
  try {
    const firstPending = postJson(baseUrl, "/api/epoch/identity/issue", {
      explorerId: "explorer_http_concurrent_failure_first",
      idempotencyKey: "issue-http-concurrent-failure-1",
    });
    await writerEntered.promise;
    const secondPending = postJson(baseUrl, "/api/epoch/identity/issue", {
      explorerId: "explorer_http_concurrent_failure_second",
      idempotencyKey: "issue-http-concurrent-failure-2",
    });

    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(batchCalls, 1);
    assert.equal(runtimeEvents(runtime).filter((event) => event.eventType === "identity_issued").length, 1);

    writerFailure.reject(new Error("concurrent_epoch_ledger_offline"));
    const [first, second] = await Promise.all([firstPending, secondPending]);
    assert.equal(first.status, 503);
    assert.equal(second.status, 503);
    assert.equal(guard.failed, true);
    assert.equal(batchCalls, 1);
    const issuedEvents = runtimeEvents(runtime).filter((event) => event.eventType === "identity_issued");
    assert.equal(issuedEvents.length, 1);
    assert.equal(issuedEvents[0].payload.explorerId, "explorer_http_concurrent_failure_first");
  } finally {
    await close(server);
  }
});

test("HTTP does not swallow persistence failure while recording a rejected-command audit", async () => {
  const runtime = createAgentWorldRuntime();
  const guard = createEpochPersistenceGuard();
  const server = createAgentHttpServer({
    runtime,
    allowLegacyHttpIdentityRegistration: true,
    persistenceGuard: guard,
    persistEpochEventBatch: async () => {
      throw new Error("audit_ledger_offline");
    },
  });
  const baseUrl = await listen(server);
  try {
    const response = await postJson(baseUrl, "/api/transparency/anchor", {
      explorerId: "explorer_http_audit_persistence_failure",
      publicNote: "remove sk-proj-abcdefghijklmnopqrstuvwxyz1234567890 before upload",
    });
    assert.equal(response.status, 503);
    assert.deepEqual(response.body, { error: "epoch_persistence_unavailable" });
    assert.equal(guard.failed, true);
    assert.equal(runtimeEvents(runtime).some((event) => event.eventType === "command_rejected"), true);
  } finally {
    await close(server);
  }
});

test("production server wires the shared batch writer and handles early persistence failure before listen", async () => {
  const source = await readFile(new URL("../server.ts", import.meta.url), "utf8");
  assert.match(source, /createEpochPersistenceGuard/);
  assert.match(source, /persistEpochEventBatch: persistence\.persistEpochEventBatch/);
  assert.match(source, /persistenceGuard,/);
  assert.match(source, /createEpochMutationCoordinator/);
  assert.match(source, /mutationCoordinator,/);
  assert.match(source, /shutdown\("PERSISTENCE_FAILURE", 1\)/);
  assert.match(source, /if \(persistenceGuard\.failed\)/);
  assert.match(source, /if \(persistenceGuard\.failed\) \{\s+worldMemory\?\.stop\(\);\s+maintenance\.stop\(\);\s+closePersistence\(\);\s+return;/);
});
