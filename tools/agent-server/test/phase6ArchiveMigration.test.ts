import assert from "node:assert/strict";
import test from "node:test";

import {
  archive,
  create,
  registerRun,
  complete,
  summary,
  validate,
  type ArchiveReason,
  type Phase6Experiment,
  type Phase6ExperimentState,
} from "../lib/epoch/phase6ExperimentRules.ts";
import {
  buildArchiveMigrationEvent,
  applyArchiveMigration,
  validateMigrationEvent,
  type Phase6ArchiveMigrationEvent,
} from "../lib/epoch/phase6MigrationRules.ts";
import {
  PHASE6_MATRIX_VERSION,
  PHASE6_AUTHORITATIVE_SCENARIO_MATRIX,
} from "../lib/epoch/phase6ScenarioMatrixRules.ts";

const NOW = "2026-07-26T00:00:00Z";

function makeExperiment(overrides?: {
  matrixVersion?: string;
  state?: Phase6ExperimentState;
  runCount?: number;
}): Phase6Experiment {
  const matrixVersion = overrides?.matrixVersion ?? PHASE6_MATRIX_VERSION;
  const matrix = {
    ...PHASE6_AUTHORITATIVE_SCENARIO_MATRIX,
    matrixVersion,
  };
  const exp = create({
    experimentId: "test-exp-1",
    identity: { identityId: "identity-1" },
    explorer: { explorerId: "explorer-1" },
    scenarioMatrix: matrix,
    versions: {
      rulesVersion: "v1",
      catalogVersion: "v1",
      codeVersion: "v1",
    },
  });

  if (overrides?.runCount && overrides.runCount > 0) {
    let current = exp;
    for (let i = 1; i <= overrides.runCount; i++) {
      current = registerRun(current, {
        runIndex: i as 1,
        identity: { identityId: "identity-1" },
        explorer: { explorerId: "explorer-1" },
        scenarioMatrix: matrix,
        versions: { rulesVersion: "v1", catalogVersion: "v1", codeVersion: "v1" },
        seed: { seed: `seed-${i}` },
        runReceipt: { receiptId: `receipt-${i}` },
      });
    }
    return current;
  }

  return exp;
}

test("archive: archives a running experiment with correct fields", () => {
  const exp = makeExperiment({ runCount: 1 });
  assert.equal(exp.state, "running");

  const archived = archive(exp, "matrix_rewrite", "phase6-matrix-v2", "digest-abc", NOW);
  assert.equal(archived.state, "archived");
  assert.ok(archived.archived);
  assert.equal(archived.archived.archiveReason, "matrix_rewrite");
  assert.equal(archived.archived.originalMatrixVersion, "phase6-matrix-v2");
  assert.equal(archived.archived.originalReceiptDigest, "digest-abc");
  assert.equal(archived.archived.originalState, "running");
  assert.equal(archived.archived.runCount, 1);
  assert.equal(archived.archived.completedRunCount, 0);
  assert.equal(archived.archived.experimentId, "test-exp-1");
});

test("archive: idempotent - already archived returns same object", () => {
  const exp = makeExperiment({ runCount: 1 });
  const archived1 = archive(exp, "matrix_rewrite", "v2", "digest", NOW);
  const archived2 = archive(archived1, "matrix_rewrite", "v2", "digest", NOW);
  assert.equal(archived1, archived2);
});

test("archive: archived experiment rejects mutations via assertMutable", () => {
  const exp = makeExperiment({ runCount: 1 });
  const archived = archive(exp, "matrix_rewrite", "v2", "digest", NOW);

  assert.throws(
    () => registerRun(archived, {
      runIndex: 2,
      identity: { identityId: "identity-1" },
      explorer: { explorerId: "explorer-1" },
      scenarioMatrix: PHASE6_AUTHORITATIVE_SCENARIO_MATRIX,
      versions: { rulesVersion: "v1", catalogVersion: "v1", codeVersion: "v1" },
      seed: { seed: "seed-2" },
      runReceipt: { receiptId: "receipt-2" },
    }),
    /phase6_experiment_archived_readonly/,
  );
});

test("archive: validation passes for archived experiments", () => {
  const exp = makeExperiment({ runCount: 1 });
  const archived = archive(exp, "matrix_rewrite", "v2", "digest", NOW);
  const result = validate(archived);
  assert.equal(result.ok, true);
});

test("archive: summary includes archived info", () => {
  const exp = makeExperiment({ runCount: 1 });
  const archived = archive(exp, "manual_deprecated", "v2", "digest", NOW);
  const s = summary(archived);
  assert.equal(s.state, "archived");
  assert.ok(s.archived);
  assert.equal(s.archived.archiveReason, "manual_deprecated");
});

test("buildArchiveMigrationEvent: returns undefined for current matrix version", () => {
  const exp = makeExperiment({ matrixVersion: PHASE6_MATRIX_VERSION, runCount: 1 });
  const event = buildArchiveMigrationEvent(exp, PHASE6_MATRIX_VERSION, NOW);
  assert.equal(event, undefined);
});

test("buildArchiveMigrationEvent: returns event for old matrix version", () => {
  const exp = makeExperiment({ matrixVersion: "phase6-matrix-v2", runCount: 1 });
  const event = buildArchiveMigrationEvent(exp, PHASE6_MATRIX_VERSION, NOW);
  assert.ok(event);
  assert.equal(event.experimentId, "test-exp-1");
  assert.equal(event.originalMatrixVersion, "phase6-matrix-v2");
  assert.equal(event.archiveReason, "matrix_rewrite");
  assert.ok(event.migrationId.length > 0);
});

test("buildArchiveMigrationEvent: returns undefined for already archived", () => {
  const exp = makeExperiment({ matrixVersion: "phase6-matrix-v2", runCount: 1 });
  const archived = archive(exp, "matrix_rewrite", "v2", "digest", NOW);
  const event = buildArchiveMigrationEvent(archived, PHASE6_MATRIX_VERSION, NOW);
  assert.equal(event, undefined);
});

test("buildArchiveMigrationEvent: returns undefined for planned with no runs", () => {
  const exp = makeExperiment({ matrixVersion: "phase6-matrix-v2" });
  const event = buildArchiveMigrationEvent(exp, PHASE6_MATRIX_VERSION, NOW);
  assert.equal(event, undefined);
});

test("applyArchiveMigration: applies archive to experiment", () => {
  const exp = makeExperiment({ matrixVersion: "phase6-matrix-v2", runCount: 1 });
  const event = buildArchiveMigrationEvent(exp, PHASE6_MATRIX_VERSION, NOW);
  assert.ok(event);
  const archived = applyArchiveMigration(exp, event);
  assert.equal(archived.state, "archived");
  assert.ok(archived.archived);
  assert.equal(archived.archived.archiveReason, "matrix_rewrite");
});

test("applyArchiveMigration: idempotent on already archived", () => {
  const exp = makeExperiment({ matrixVersion: "phase6-matrix-v2", runCount: 1 });
  const event = buildArchiveMigrationEvent(exp, PHASE6_MATRIX_VERSION, NOW);
  assert.ok(event);
  const archived1 = applyArchiveMigration(exp, event);
  const archived2 = applyArchiveMigration(archived1, event);
  assert.equal(archived1, archived2);
});

test("validateMigrationEvent: validates well-formed events", () => {
  const exp = makeExperiment({ matrixVersion: "phase6-matrix-v2", runCount: 1 });
  const event = buildArchiveMigrationEvent(exp, PHASE6_MATRIX_VERSION, NOW);
  assert.ok(event);
  assert.equal(validateMigrationEvent(event), true);
});

test("validateMigrationEvent: rejects invalid events", () => {
  assert.equal(validateMigrationEvent(null), false);
  assert.equal(validateMigrationEvent({}), false);
  assert.equal(validateMigrationEvent({ eventType: "wrong" }), false);
  assert.equal(validateMigrationEvent({
    eventType: "phase6_archive_migration",
    migrationId: "",
    experimentId: "x",
    originalMatrixVersion: "v",
    originalReceiptDigest: "d",
    archiveReason: "matrix_rewrite",
    archivedAt: NOW,
    idempotencyKey: "k",
    createdAt: NOW,
  }), false);
});
