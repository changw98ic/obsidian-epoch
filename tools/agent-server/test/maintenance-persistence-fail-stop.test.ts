import assert from "node:assert/strict";
import test from "node:test";
import { createEpochPersistenceGuard } from "../lib/epochPersistence.ts";
import { startEpochMaintenanceScheduler } from "../lib/maintenance.ts";
import { createAgentWorldRuntime } from "../lib/mcpTools.ts";

test("run-on-start maintenance trips once, stops scheduling, and does not run the next command", async () => {
  const baseRuntime = createAgentWorldRuntime();
  const identity = baseRuntime.epochIdentity({
    explorerId: "explorer_maintenance_persistence_failure",
    identityName: "维护持久化失败身份",
    idempotencyKey: "identity-maintenance-persistence-failure-1",
  });
  if (!("events" in identity)) throw new Error("maintenance_identity_events_required");
  let marketCalls = 0;
  const runtime = new Proxy(baseRuntime, {
    get(target, property, receiver) {
      if (property === "epochTickNpcLifecycle") return () => identity;
      if (property === "epochTickMarketExpiry") {
        const tickMarket = target.epochTickMarketExpiry.bind(target);
        return (...args: Parameters<typeof target.epochTickMarketExpiry>) => {
          marketCalls += 1;
          return tickMarket(...args);
        };
      }
      return Reflect.get(target, property, receiver);
    },
  });
  const trips: string[] = [];
  const errors: string[] = [];
  const guard = createEpochPersistenceGuard((error) => trips.push(error.persistenceError));
  let batchCalls = 0;
  let legacyCalls = 0;
  let clearCalls = 0;
  let scheduledHandler: (() => void) | undefined;

  const scheduler = startEpochMaintenanceScheduler({
    runtime,
    persistenceGuard: guard,
    persistEpochEventBatch: async (events) => {
      batchCalls += 1;
      assert.deepEqual(events.map((event) => event.eventId), identity.events.map((event) => event.eventId));
      throw new Error("maintenance_epoch_ledger_offline");
    },
    persistJsonl: async () => {
      legacyCalls += 1;
    },
    config: {
      enabled: true,
      intervalMs: 10_000,
      npcLimit: 1,
      marketMaxAgeSeconds: 60,
      marketLimit: 1,
      resourceNodeRegionIds: [],
      resourceNodeLimit: 0,
      runOnStart: true,
    },
    setIntervalFn: (handler) => {
      scheduledHandler = handler;
      return 91;
    },
    clearIntervalFn: () => {
      clearCalls += 1;
    },
    onError: (error) => {
      errors.push(error instanceof Error ? error.message : String(error));
    },
  });

  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(guard.failed, true);
  assert.deepEqual(trips, ["maintenance_epoch_ledger_offline"]);
  assert.deepEqual(errors, ["epoch_persistence_unavailable"]);
  assert.equal(batchCalls, 1);
  assert.equal(legacyCalls, 0);
  assert.equal(marketCalls, 0);
  assert.equal(clearCalls, 1);
  assert.equal(scheduler.status().lastError, "epoch_persistence_unavailable");

  scheduledHandler?.();
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(batchCalls, 1);
  assert.equal(marketCalls, 0);
  assert.equal(clearCalls, 1);
});
