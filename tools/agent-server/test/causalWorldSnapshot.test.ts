import assert from "node:assert/strict";
import test from "node:test";

import {
  CAUSAL_WORLD_SNAPSHOT_SCHEMA_VERSION,
  CausalSnapshotError,
  assertCausalWorldSnapshotV1,
  causalWorldSnapshotHash,
  createCausalWorldSnapshot,
  emptyCausalWorldSnapshot,
  latestStreamExpectation,
} from "../lib/epoch/causalWorldSnapshot.ts";
import type {
  CausalReplayCursorV1,
  CausalWorldSnapshotV1,
} from "../lib/epoch/causalWorldSnapshot.ts";
import { causalSchemaRegistryHash } from "../lib/epoch/causalSchemaRegistry.ts";

// ---------------------------------------------------------------------------
// emptyCausalWorldSnapshot
// ---------------------------------------------------------------------------

test("emptyCausalWorldSnapshot creates an empty snapshot with correct worldId", () => {
  const snapshot = emptyCausalWorldSnapshot("world_alpha");
  assert.equal(snapshot.worldId, "world_alpha");
});

test("emptyCausalWorldSnapshot sets snapshotSchemaVersion to 1", () => {
  const snapshot = emptyCausalWorldSnapshot("w1");
  assert.equal(snapshot.snapshotSchemaVersion, CAUSAL_WORLD_SNAPSHOT_SCHEMA_VERSION);
  assert.equal(snapshot.snapshotSchemaVersion, 1);
});

test("emptyCausalWorldSnapshot initializes all collection fields to empty", () => {
  const snapshot = emptyCausalWorldSnapshot("w1");

  // events / eventHashes
  assert.deepEqual(snapshot.events, {});
  assert.deepEqual(snapshot.eventHashes, {});

  // replayCursor
  assert.equal(snapshot.replayCursor.eventCount, 0);
  assert.deepEqual(snapshot.replayCursor.streams, {});

  // balances
  assert.deepEqual(snapshot.balances.accounts, []);
  assert.deepEqual(snapshot.balances.byAccount, {});
  assert.deepEqual(snapshot.balances.creditLimitsByAccount, {});

  // ownership
  assert.deepEqual(snapshot.ownership.items, []);
  assert.deepEqual(snapshot.ownership.titleOwners, {});

  // pressure
  assert.deepEqual(snapshot.pressure.active, []);
  assert.deepEqual(snapshot.pressure.byId, {});
  assert.deepEqual(snapshot.pressure.backlog, { dueCount: 0, criticalCount: 0, overdueCriticalCount: 0 });

  // knowledge
  assert.deepEqual(snapshot.knowledge.records, []);
  assert.deepEqual(snapshot.knowledge.byId, {});
  assert.deepEqual(snapshot.knowledge.countsByKind, {});

  // actorMind
  assert.deepEqual(snapshot.actorMind.mindsByActor, {});
  assert.deepEqual(snapshot.actorMind.lodBySubject, {});
  assert.deepEqual(snapshot.actorMind.lodDistribution, { 0: 0, 1: 0, 2: 0, 3: 0 });

  // domains
  assert.deepEqual(snapshot.domains.resourceProductionNodes, []);
  assert.deepEqual(snapshot.domains.resourceProductionAssignments, []);
  assert.deepEqual(snapshot.domains.lifeProfiles, []);

  // domainExtensions
  assert.deepEqual(snapshot.domainExtensions, []);
});

test("emptyCausalWorldSnapshot sets default schema registry values", () => {
  const snapshot = emptyCausalWorldSnapshot("w1");
  assert.equal(typeof snapshot.schemaRegistryVersion, "string");
  assert.ok(snapshot.schemaRegistryVersion.length > 0);
  assert.equal(snapshot.schemaRegistryHash, causalSchemaRegistryHash());
});

test("emptyCausalWorldSnapshot auto-generates a checkpoint", () => {
  const snapshot = emptyCausalWorldSnapshot("w1");
  assert.ok(snapshot.checkpoint);
  assert.equal(snapshot.checkpoint.worldId, "w1");
  assert.equal(snapshot.checkpoint.snapshotSchemaVersion, CAUSAL_WORLD_SNAPSHOT_SCHEMA_VERSION);
});

// ---------------------------------------------------------------------------
// createCausalWorldSnapshot
// ---------------------------------------------------------------------------

test("createCausalWorldSnapshot with minimal valid input succeeds", () => {
  const snapshot = createCausalWorldSnapshot({ worldId: "w_minimal" });
  assert.equal(snapshot.worldId, "w_minimal");
  assert.equal(snapshot.snapshotSchemaVersion, CAUSAL_WORLD_SNAPSHOT_SCHEMA_VERSION);
});

test("createCausalWorldSnapshot sorts record keys deterministically", () => {
  const snapshot = createCausalWorldSnapshot({
    worldId: "w_sort",
    events: {
      evt_z: {
        eventId: "evt_z",
        worldId: "w_sort",
        occurredAtWorldMinute: 0,
        causality: { causalParentEventIds: [] },
      },
      evt_a: {
        eventId: "evt_a",
        worldId: "w_sort",
        occurredAtWorldMinute: 0,
        causality: { causalParentEventIds: [] },
      },
      evt_m: {
        eventId: "evt_m",
        worldId: "w_sort",
        occurredAtWorldMinute: 0,
        causality: { causalParentEventIds: [] },
      },
    },
    eventHashes: {
      evt_z: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      evt_a: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      evt_m: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    },
  });
  assert.deepEqual(Object.keys(snapshot.events), ["evt_a", "evt_m", "evt_z"]);
  assert.deepEqual(Object.keys(snapshot.eventHashes), ["evt_a", "evt_m", "evt_z"]);
});

test("createCausalWorldSnapshot deduplicates knowledge records by id", () => {
  const snapshot = createCausalWorldSnapshot({
    worldId: "w_dedup",
    knowledge: {
      records: [
        { id: "k1", kind: "lore", content: "first", createdAt: 0, updatedAt: 0 },
        { id: "k1", kind: "lore", content: "duplicate", createdAt: 0, updatedAt: 0 },
        { id: "k2", kind: "lore", content: "second", createdAt: 0, updatedAt: 0 },
      ],
    },
  });
  assert.equal(snapshot.knowledge.records.length, 2);
  const ids = snapshot.knowledge.records.map((r) => r.id);
  assert.deepEqual(ids, ["k1", "k2"]);
  // The last value wins in uniqueSorted
  assert.equal(snapshot.knowledge.byId["k1"].content, "duplicate");
});

test("createCausalWorldSnapshot deduplicates ownership items by itemRef", () => {
  const snapshot = createCausalWorldSnapshot({
    worldId: "w_own",
    ownership: {
      items: [
        { itemRef: "item_a", titleOwnerRef: "owner1" },
        { itemRef: "item_a", titleOwnerRef: "owner2" },
        { itemRef: "item_b", titleOwnerRef: "owner1" },
      ],
    },
  });
  assert.equal(snapshot.ownership.items.length, 2);
  const refs = snapshot.ownership.items.map((i) => i.itemRef);
  assert.deepEqual(refs, ["item_a", "item_b"]);
});

test("createCausalWorldSnapshot accepts custom schemaRegistryVersion", () => {
  const snapshot = createCausalWorldSnapshot({
    worldId: "w_custom",
    schemaRegistryVersion: "42",
    schemaRegistryHash: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as `sha256:${string}`,
  });
  assert.equal(snapshot.schemaRegistryVersion, "42");
});

test("createCausalWorldSnapshot accepts a checkpoint", () => {
  const checkpoint = {
    checkpointId: "custom_cp",
    snapshotSchemaVersion: CAUSAL_WORLD_SNAPSHOT_SCHEMA_VERSION as typeof CAUSAL_WORLD_SNAPSHOT_SCHEMA_VERSION,
    worldId: "w_cp",
    snapshotHash: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as `sha256:${string}`,
    schemaRegistryVersion: "1",
    schemaRegistryHash: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as `sha256:${string}`,
    replayCursor: { eventCount: 0, streams: {} },
  };
  const snapshot = createCausalWorldSnapshot({
    worldId: "w_cp",
    checkpoint,
  });
  assert.equal(snapshot.checkpoint?.checkpointId, "custom_cp");
});

// ---------------------------------------------------------------------------
// assertCausalWorldSnapshotV1
// ---------------------------------------------------------------------------

test("assertCausalWorldSnapshotV1 returns normalized snapshot for valid input", () => {
  const original = emptyCausalWorldSnapshot("w_valid");
  const result = assertCausalWorldSnapshotV1(original);
  assert.equal(result.worldId, "w_valid");
  assert.equal(result.snapshotSchemaVersion, CAUSAL_WORLD_SNAPSHOT_SCHEMA_VERSION);
});

test("assertCausalWorldSnapshotV1 throws CausalSnapshotError for null input", () => {
  assert.throws(
    () => assertCausalWorldSnapshotV1(null),
    (error: unknown) => {
      assert.ok(error instanceof CausalSnapshotError);
      assert.equal(error.code, "CAUSAL_SNAPSHOT_SCHEMA_INVALID");
      return true;
    },
  );
});

test("assertCausalWorldSnapshotV1 throws CausalSnapshotError for array input", () => {
  assert.throws(
    () => assertCausalWorldSnapshotV1([1, 2, 3]),
    (error: unknown) => {
      assert.ok(error instanceof CausalSnapshotError);
      assert.equal(error.code, "CAUSAL_SNAPSHOT_SCHEMA_INVALID");
      return true;
    },
  );
});

test("assertCausalWorldSnapshotV1 throws CausalSnapshotError for wrong schema version", () => {
  assert.throws(
    () => assertCausalWorldSnapshotV1({ snapshotSchemaVersion: 999, worldId: "w1" }),
    (error: unknown) => {
      assert.ok(error instanceof CausalSnapshotError);
      assert.equal(error.code, "CAUSAL_SNAPSHOT_FUTURE_VERSION");
      return true;
    },
  );
});

test("assertCausalWorldSnapshotV1 throws CausalSnapshotError for missing worldId", () => {
  assert.throws(
    () => assertCausalWorldSnapshotV1({ snapshotSchemaVersion: 1 }),
    (error: unknown) => {
      assert.ok(error instanceof CausalSnapshotError);
      assert.equal(error.code, "CAUSAL_SNAPSHOT_SCHEMA_INVALID");
      return true;
    },
  );
});

test("assertCausalWorldSnapshotV1 throws CausalSnapshotError for wrong registry hash", () => {
  const original = emptyCausalWorldSnapshot("w_bad");
  assert.throws(
    () => assertCausalWorldSnapshotV1({
      ...original,
      schemaRegistryHash: "sha256:deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
    }),
    (error: unknown) => {
      assert.ok(error instanceof CausalSnapshotError);
      assert.equal(error.code, "CAUSAL_SNAPSHOT_REGISTRY_HASH_MISMATCH");
      return true;
    },
  );
});

test("assertCausalWorldSnapshotV1 preserves error details", () => {
  try {
    assertCausalWorldSnapshotV1(null);
    assert.fail("should have thrown");
  } catch (error: unknown) {
    assert.ok(error instanceof CausalSnapshotError);
    assert.deepEqual(error.details, { field: "snapshot" });
  }
});

// ---------------------------------------------------------------------------
// causalWorldSnapshotHash
// ---------------------------------------------------------------------------

test("causalWorldSnapshotHash returns consistent hash for same snapshot", () => {
  const snapshot = emptyCausalWorldSnapshot("w_hash");
  const hash1 = causalWorldSnapshotHash(snapshot);
  const hash2 = causalWorldSnapshotHash(snapshot);
  assert.equal(hash1, hash2);
  assert.match(hash1, /^sha256:[0-9a-f]{64}$/);
});

test("causalWorldSnapshotHash returns different hashes for different worldIds", () => {
  const snap1 = emptyCausalWorldSnapshot("w_aaa");
  const snap2 = emptyCausalWorldSnapshot("w_bbb");
  const hash1 = causalWorldSnapshotHash(snap1);
  const hash2 = causalWorldSnapshotHash(snap2);
  assert.notEqual(hash1, hash2);
});

test("causalWorldSnapshotHash returns different hashes after adding events", () => {
  const snap1 = emptyCausalWorldSnapshot("w_same");
  const snap2 = createCausalWorldSnapshot({
    worldId: "w_same",
    events: {
      evt_1: {
        eventId: "evt_1",
        worldId: "w_same",
        occurredAtWorldMinute: 5,
        causality: { causalParentEventIds: [] },
      },
    },
    eventHashes: {
      evt_1: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as `sha256:${string}`,
    },
  });
  assert.notEqual(causalWorldSnapshotHash(snap1), causalWorldSnapshotHash(snap2));
});

// ---------------------------------------------------------------------------
// latestStreamExpectation
// ---------------------------------------------------------------------------

test("latestStreamExpectation returns undefined for empty cursor", () => {
  const cursor: CausalReplayCursorV1 = { eventCount: 0, streams: {} };
  assert.equal(latestStreamExpectation(cursor), undefined);
});

test("latestStreamExpectation extracts the single stream", () => {
  const cursor: CausalReplayCursorV1 = {
    eventCount: 3,
    streams: {
      "resource_account:acc1": {
        streamType: "resource_account",
        streamId: "acc1",
        latestVersion: 3,
        latestWorldMinute: 100,
      },
    },
  };
  const result = latestStreamExpectation(cursor);
  assert.ok(result);
  assert.equal(result.streamType, "resource_account");
  assert.equal(result.streamId, "acc1");
  assert.equal(result.expectedNextVersion, 4);
  assert.equal(result.latestWorldMinute, 100);
});

test("latestStreamExpectation selects the stream with highest worldMinute", () => {
  const cursor: CausalReplayCursorV1 = {
    eventCount: 5,
    streams: {
      "resource_account:old": {
        streamType: "resource_account",
        streamId: "old",
        latestVersion: 10,
        latestWorldMinute: 50,
      },
      "resource_account:new": {
        streamType: "resource_account",
        streamId: "new",
        latestVersion: 2,
        latestWorldMinute: 200,
      },
    },
  };
  const result = latestStreamExpectation(cursor);
  assert.ok(result);
  assert.equal(result.streamId, "new");
  assert.equal(result.expectedNextVersion, 3);
});

test("latestStreamExpectation breaks ties by version then streamType then streamId", () => {
  const cursor: CausalReplayCursorV1 = {
    eventCount: 4,
    streams: {
      "alpha:bbb": {
        streamType: "alpha",
        streamId: "bbb",
        latestVersion: 5,
        latestWorldMinute: 100,
      },
      "alpha:aaa": {
        streamType: "alpha",
        streamId: "aaa",
        latestVersion: 5,
        latestWorldMinute: 100,
      },
    },
  };
  const result = latestStreamExpectation(cursor);
  assert.ok(result);
  // Same worldMinute and version, so ties break by streamType (same) then streamId (aaa < bbb)
  // But sort is descending by worldMinute/version, then ascending by streamType/streamId for last-place
  // The sort picks the first element: higher worldMinute, higher version, then lexicographic ascending
  // Both have same minute and version; the sort is left.localeCompare(right) for streamType (both "alpha")
  // and then left.streamId.localeCompare(right.streamId): "aaa" < "bbb", so "aaa" is first
  assert.equal(result.streamId, "aaa");
});

test("latestStreamExpectation uses version when worldMinute is absent", () => {
  const cursor: CausalReplayCursorV1 = {
    eventCount: 2,
    streams: {
      "t1:s1": {
        streamType: "t1",
        streamId: "s1",
        latestVersion: 1,
      },
      "t2:s2": {
        streamType: "t2",
        streamId: "s2",
        latestVersion: 5,
      },
    },
  };
  const result = latestStreamExpectation(cursor);
  assert.ok(result);
  assert.equal(result.streamId, "s2");
  assert.equal(result.expectedNextVersion, 6);
  assert.equal(result.latestWorldMinute, undefined);
});
