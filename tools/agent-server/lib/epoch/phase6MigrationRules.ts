import { createHash } from "node:crypto";
import { PHASE6_MATRIX_VERSION } from "./phase6ScenarioMatrixRules.ts";
import {
  archive,
  type ArchiveReason,
  type Phase6Experiment,
  type Phase6ExperimentState,
} from "./phase6ExperimentRules.ts";

export interface Phase6ArchiveMigrationEvent {
  readonly eventType: "phase6_archive_migration";
  readonly migrationId: string;
  readonly experimentId: string;
  readonly originalMatrixVersion: string;
  readonly originalState: Phase6ExperimentState;
  readonly originalReceiptDigest: string;
  readonly archiveReason: ArchiveReason;
  readonly archivedAt: string;
  readonly idempotencyKey: string;
  readonly createdAt: string;
}

/**
 * Build a migration event for an experiment that needs to be archived due to
 * matrix version mismatch. Returns undefined if no migration is needed.
 */
export function buildArchiveMigrationEvent(
  experiment: Phase6Experiment,
  currentMatrixVersion: string,
  now: string,
): Phase6ArchiveMigrationEvent | undefined {
  // Skip if already archived
  if (experiment.state === "archived") {
    return undefined;
  }

  // Skip planned experiments with no runs
  if (experiment.state === "planned" && experiment.runs.length === 0) {
    return undefined;
  }

  const experimentMatrixVersion = experiment.scenarioMatrix.matrixVersion
    ?? experiment.scenarioMatrix.version;

  // Skip if matrix version matches
  if (experimentMatrixVersion === currentMatrixVersion) {
    return undefined;
  }

  const migrationId = createHash("sha256")
    .update(`${experiment.experimentId}:${experimentMatrixVersion}`)
    .digest("hex");

  const originalReceiptDigest = createHash("sha256")
    .update(JSON.stringify({
      experimentId: experiment.experimentId,
      scenarioMatrix: experiment.scenarioMatrix,
      runCount: experiment.runs.length,
    }))
    .digest("hex");

  return {
    eventType: "phase6_archive_migration",
    migrationId,
    experimentId: experiment.experimentId,
    originalMatrixVersion: experimentMatrixVersion,
    originalState: experiment.state,
    originalReceiptDigest,
    archiveReason: "matrix_rewrite",
    archivedAt: now,
    idempotencyKey: migrationId,
    createdAt: now,
  };
}

/**
 * Apply an archive migration event to an experiment. Returns the archived
 * experiment. Idempotent: if the experiment is already archived, returns it
 * unchanged.
 */
export function applyArchiveMigration(
  experiment: Phase6Experiment,
  migrationEvent: Phase6ArchiveMigrationEvent,
): Phase6Experiment {
  if (experiment.state === "archived") {
    return experiment;
  }

  return archive(
    experiment,
    migrationEvent.archiveReason,
    migrationEvent.originalMatrixVersion,
    migrationEvent.originalReceiptDigest,
    migrationEvent.archivedAt,
  );
}

/**
 * Validate that a migration event is well-formed.
 */
export function validateMigrationEvent(
  event: unknown,
): event is Phase6ArchiveMigrationEvent {
  if (event === null || typeof event !== "object") return false;
  const record = event as Record<string, unknown>;
  return (
    record.eventType === "phase6_archive_migration" &&
    typeof record.migrationId === "string" &&
    record.migrationId.length > 0 &&
    typeof record.experimentId === "string" &&
    record.experimentId.length > 0 &&
    typeof record.originalMatrixVersion === "string" &&
    record.originalMatrixVersion.length > 0 &&
    typeof record.originalReceiptDigest === "string" &&
    record.originalReceiptDigest.length > 0 &&
    (record.archiveReason === "matrix_rewrite" ||
      record.archiveReason === "manual_deprecated" ||
      record.archiveReason === "schema_incompatible") &&
    typeof record.archivedAt === "string" &&
    typeof record.idempotencyKey === "string" &&
    typeof record.createdAt === "string"
  );
}
