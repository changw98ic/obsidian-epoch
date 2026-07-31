import assert from "node:assert/strict";
import test from "node:test";

import {
  migrateCausalSnapshot,
  assertMigratedCausalSnapshot,
  CAUSAL_SNAPSHOT_MIGRATIONS,
  type MigrateCausalSnapshotInput,
  type CausalSnapshotMigrationOutput,
} from "../lib/epoch/causalSnapshotMigration.ts";
import { emptyCausalWorldSnapshot } from "../lib/epoch/causalWorldSnapshot.ts";

const WORLD_ID = "test_migration_world";

// ---------------------------------------------------------------------------
// migrateCausalSnapshot — V1 snapshot returns "unchanged"
// ---------------------------------------------------------------------------

test("migrateCausalSnapshot with a valid V1 snapshot returns status unchanged", () => {
  const v1 = emptyCausalWorldSnapshot(WORLD_ID);
  const output = migrateCausalSnapshot({ snapshot: v1, worldId: WORLD_ID });

  assert.equal(output.report.status, "unchanged");
  assert.equal(output.report.changed, false);
  assert.equal(output.report.fromVersion, 1);
  assert.equal(output.report.toVersion, 1);
  assert.equal(output.report.issues.length, 0);
  assert.ok(output.snapshot, "snapshot should be present for unchanged result");
  assert.equal(output.snapshot.worldId, WORLD_ID);
});

// ---------------------------------------------------------------------------
// migrateCausalSnapshot — legacy snapshot returns "migrated"
// ---------------------------------------------------------------------------

test("migrateCausalSnapshot with a legacy snapshot returns status migrated with report", () => {
  const legacy = {
    worldId: WORLD_ID,
    events: [
      {
        eventId: "evt_legacy_001",
        worldId: WORLD_ID,
        eventType: "legacy_action",
        occurredAtWorldMinute: 42,
        stream: "action:player1",
        causalParentEventIds: [],
        proof: { eventHash: "sha256:abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890" },
      },
    ],
  };

  const output = migrateCausalSnapshot({ snapshot: legacy, worldId: WORLD_ID });

  assert.equal(output.report.status, "migrated");
  assert.equal(output.report.changed, true);
  assert.equal(output.report.fromVersion, "legacy");
  assert.equal(output.report.toVersion, 1);
  assert.equal(output.report.issues.length, 0);
  assert.ok(output.snapshot, "snapshot should be present for migrated result");
  assert.equal(output.snapshot.worldId, WORLD_ID);
  assert.equal(output.report.migratedEventCount, 1);
});

// ---------------------------------------------------------------------------
// migrateCausalSnapshot — empty/undefined snapshot returns "migrated"
// ---------------------------------------------------------------------------

test("migrateCausalSnapshot with undefined snapshot returns migrated empty snapshot", () => {
  const output = migrateCausalSnapshot({ snapshot: undefined, worldId: WORLD_ID });

  assert.equal(output.report.status, "migrated");
  assert.equal(output.report.changed, true);
  assert.equal(output.report.fromVersion, "empty");
  assert.ok(output.snapshot);
  assert.equal(output.snapshot.worldId, WORLD_ID);
});

// ---------------------------------------------------------------------------
// migrateCausalSnapshot — non-object snapshot returns "rejected"
// ---------------------------------------------------------------------------

test("migrateCausalSnapshot with a non-object snapshot returns status rejected", () => {
  const output = migrateCausalSnapshot({ snapshot: "not-an-object" as unknown, worldId: WORLD_ID });

  assert.equal(output.report.status, "rejected");
  assert.equal(output.report.changed, false);
  assert.equal(output.snapshot, undefined);
  assert.ok(output.report.issues.length > 0);
  assert.equal(output.report.issues[0].code, "CAUSAL_SNAPSHOT_MIGRATION_SCHEMA_INVALID");
});

// ---------------------------------------------------------------------------
// migrateCausalSnapshot — future version snapshot returns "rejected"
// ---------------------------------------------------------------------------

test("migrateCausalSnapshot with a future version snapshot returns rejected", () => {
  const future = {
    snapshotSchemaVersion: 999,
    worldId: WORLD_ID,
  };
  const output = migrateCausalSnapshot({ snapshot: future, worldId: WORLD_ID });

  assert.equal(output.report.status, "rejected");
  assert.equal(output.report.issues[0].code, "CAUSAL_SNAPSHOT_MIGRATION_UNSUPPORTED_FUTURE_VERSION");
});

// ---------------------------------------------------------------------------
// migrateCausalSnapshot — worldId mismatch returns "rejected"
// ---------------------------------------------------------------------------

test("migrateCausalSnapshot with mismatched worldId returns rejected", () => {
  const snapshot = {
    worldId: "different_world",
  };
  const output = migrateCausalSnapshot({ snapshot, worldId: WORLD_ID });

  assert.equal(output.report.status, "rejected");
  assert.equal(output.report.issues[0].code, "CAUSAL_SNAPSHOT_MIGRATION_WORLD_MISMATCH");
});

// ---------------------------------------------------------------------------
// migrateCausalSnapshot — dryRun suppresses snapshot in output
// ---------------------------------------------------------------------------

test("migrateCausalSnapshot with dryRun omits snapshot from output", () => {
  const legacy = { worldId: WORLD_ID, events: [] };
  const output = migrateCausalSnapshot({ snapshot: legacy, worldId: WORLD_ID, dryRun: true });

  assert.equal(output.report.status, "migrated");
  assert.equal(output.report.dryRun, true);
  assert.equal(output.snapshot, undefined, "snapshot should be omitted in dryRun mode");
});

// ---------------------------------------------------------------------------
// migrateCausalSnapshot — nowMs is used for deterministic durationMs
// ---------------------------------------------------------------------------

test("migrateCausalSnapshot uses nowMs for deterministic timing", () => {
  let tick = 1000;
  const nowMs = () => tick++;
  const output = migrateCausalSnapshot({ snapshot: undefined, worldId: WORLD_ID, nowMs });

  assert.equal(output.report.durationMs, 1);
});

// ---------------------------------------------------------------------------
// assertMigratedCausalSnapshot — valid snapshot returns result
// ---------------------------------------------------------------------------

test("assertMigratedCausalSnapshot with a valid V1 snapshot returns the snapshot", () => {
  const v1 = emptyCausalWorldSnapshot(WORLD_ID);
  const result = assertMigratedCausalSnapshot({ snapshot: v1, worldId: WORLD_ID });

  assert.ok(result);
  assert.equal(result.worldId, WORLD_ID);
  assert.equal(result.snapshotSchemaVersion, 1);
});

// ---------------------------------------------------------------------------
// assertMigratedCausalSnapshot — invalid snapshot throws
// ---------------------------------------------------------------------------

test("assertMigratedCausalSnapshot with an invalid snapshot throws CausalSnapshotError", () => {
  assert.throws(
    () => assertMigratedCausalSnapshot({ snapshot: "bad", worldId: WORLD_ID }),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.equal(error.name, "CausalSnapshotError");
      return true;
    },
  );
});

// ---------------------------------------------------------------------------
// assertMigratedCausalSnapshot — legacy snapshot migrates successfully
// ---------------------------------------------------------------------------

test("assertMigratedCausalSnapshot with a legacy snapshot returns migrated snapshot", () => {
  const legacy = {
    worldId: WORLD_ID,
    events: [
      {
        id: "evt_legacy_002",
        type: "trade",
        worldId: WORLD_ID,
        occurredAtWorldMinute: 10,
        actorRefs: ["merchant"],
        subjectRefs: ["player1"],
        causalParentEventIds: [],
      },
    ],
  };

  const result = assertMigratedCausalSnapshot({ snapshot: legacy, worldId: WORLD_ID });

  assert.ok(result);
  assert.equal(result.worldId, WORLD_ID);
  assert.equal(result.snapshotSchemaVersion, 1);
});

// ---------------------------------------------------------------------------
// CAUSAL_SNAPSHOT_MIGRATIONS — registry is a non-empty array
// ---------------------------------------------------------------------------

test("CAUSAL_SNAPSHOT_MIGRATIONS is a non-empty array of migration steps", () => {
  assert.ok(Array.isArray(CAUSAL_SNAPSHOT_MIGRATIONS), "registry should be an array");
  assert.ok(CAUSAL_SNAPSHOT_MIGRATIONS.length > 0, "registry should have at least one migration step");

  for (const step of CAUSAL_SNAPSHOT_MIGRATIONS) {
    assert.ok(typeof step.fromVersion === "number" || step.fromVersion === "legacy" || step.fromVersion === "empty",
      `fromVersion should be number | "legacy" | "empty", got ${String(step.fromVersion)}`);
    assert.equal(typeof step.toVersion, "number");
    assert.equal(typeof step.migrate, "function");
  }
});

// ---------------------------------------------------------------------------
// CAUSAL_SNAPSHOT_MIGRATIONS — has empty and legacy entries
// ---------------------------------------------------------------------------

test("CAUSAL_SNAPSHOT_MIGRATIONS contains empty and legacy migration steps", () => {
  const fromVersions = CAUSAL_SNAPSHOT_MIGRATIONS.map((s) => s.fromVersion);
  assert.ok(fromVersions.includes("empty"), "should have an 'empty' migration step");
  assert.ok(fromVersions.includes("legacy"), "should have a 'legacy' migration step");
});
