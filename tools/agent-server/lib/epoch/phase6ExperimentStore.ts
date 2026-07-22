import { DatabaseSync } from "node:sqlite";
import {
  PHASE6_RUN_INDEXES,
  complete as completePhase6Run,
  create as createPhase6Experiment,
  fail as failPhase6Run,
  registerRun as registerPhase6Run,
  validate as validatePhase6Experiment,
  type Phase6CompleteRunInput,
  type Phase6CreateInput,
  type Phase6Experiment,
  type Phase6ExplorerBinding,
  type Phase6ExperimentState,
  type Phase6FailRunInput,
  type Phase6IdentityBinding,
  type Phase6RegisterRunInput,
  type Phase6Run,
  type Phase6RunIndex,
  type Phase6ScenarioMatrixVersion,
  type Phase6SeedBinding,
  type Phase6VersionBinding,
} from "./phase6ExperimentRules.ts";

export interface Phase6ExperimentRunStoreFields {
  readonly journeyId: string;
}

export interface Phase6StoredRun extends Phase6Run, Phase6ExperimentRunStoreFields {}

export interface Phase6StoredRunBinding extends Phase6StoredRun {
  readonly experimentId: string;
}

export interface Phase6StoredExperiment
  extends Omit<Phase6Experiment, "runs"> {
  readonly runs: readonly Phase6StoredRun[];
}

export interface Phase6RegisterStoredRunInput
  extends Phase6RegisterRunInput,
    Phase6ExperimentRunStoreFields {}

export interface Phase6ExperimentSqliteStore {
  readonly create: (input: Phase6CreateInput) => Phase6StoredExperiment;
  readonly load: (experimentId: string) => Phase6StoredExperiment | undefined;
  readonly loadRunByJourneyId: (journeyId: string) => Phase6StoredRunBinding | undefined;
  readonly registerRun: (
    experimentId: string,
    input: Phase6RegisterStoredRunInput,
  ) => Phase6StoredExperiment;
  readonly completeRun: (
    experimentId: string,
    runIndex: Phase6RunIndex,
    input: Phase6CompleteRunInput,
  ) => Phase6StoredExperiment;
  readonly failRun: (
    experimentId: string,
    runIndex: Phase6RunIndex,
    input: Phase6FailRunInput,
  ) => Phase6StoredExperiment;
  readonly completeExperiment: (experimentId: string) => Phase6StoredExperiment;
}

interface Phase6ExperimentRow {
  readonly experiment_id: string;
  readonly state: Phase6ExperimentState;
  readonly identity_id: string;
  readonly cohort_id: string | null;
  readonly explorer_id: string | null;
  readonly explorer_display_name: string | null;
  readonly scenario_matrix_id: string;
  readonly scenario_matrix_version: string;
  readonly rules_version: string;
  readonly catalog_version: string;
  readonly code_version: string;
  readonly created_at: string;
  readonly updated_at: string;
}

interface Phase6ExperimentRunRow {
  readonly experiment_id: string;
  readonly run_index: Phase6RunIndex;
  readonly state: Phase6ExperimentState;
  readonly identity_id: string;
  readonly cohort_id: string | null;
  readonly explorer_id: string | null;
  readonly explorer_display_name: string | null;
  readonly scenario_matrix_id: string;
  readonly scenario_matrix_version: string;
  readonly rules_version: string;
  readonly catalog_version: string;
  readonly code_version: string;
  readonly seed: string;
  readonly journey_id: string;
  readonly run_receipt_id: string;
  readonly run_receipt_version: string | null;
  readonly result_receipt_id: string | null;
  readonly result_receipt_version: string | null;
  readonly failure_reason: string | null;
  readonly failure_receipt_id: string | null;
  readonly failure_receipt_version: string | null;
  readonly created_at: string;
  readonly updated_at: string;
}

export function initializePhase6ExperimentSchema(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS phase6_experiments (
      experiment_id TEXT PRIMARY KEY,
      state TEXT NOT NULL CHECK (state IN ('planned', 'running', 'failed', 'complete')),
      identity_id TEXT NOT NULL,
      cohort_id TEXT,
      explorer_id TEXT NOT NULL,
      explorer_display_name TEXT,
      scenario_matrix_id TEXT NOT NULL,
      scenario_matrix_version TEXT NOT NULL,
      rules_version TEXT NOT NULL,
      catalog_version TEXT NOT NULL,
      code_version TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS phase6_experiment_runs (
      experiment_id TEXT NOT NULL,
      run_index INTEGER NOT NULL CHECK (run_index BETWEEN 1 AND 10),
      state TEXT NOT NULL CHECK (state IN ('planned', 'running', 'failed', 'complete')),
      identity_id TEXT NOT NULL,
      cohort_id TEXT,
      explorer_id TEXT NOT NULL,
      explorer_display_name TEXT,
      scenario_matrix_id TEXT NOT NULL,
      scenario_matrix_version TEXT NOT NULL,
      rules_version TEXT NOT NULL,
      catalog_version TEXT NOT NULL,
      code_version TEXT NOT NULL,
      seed TEXT NOT NULL,
      journey_id TEXT NOT NULL,
      run_receipt_id TEXT NOT NULL,
      run_receipt_version TEXT,
      result_receipt_id TEXT,
      result_receipt_version TEXT,
      failure_reason TEXT,
      failure_receipt_id TEXT,
      failure_receipt_version TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (experiment_id, run_index),
      FOREIGN KEY (experiment_id) REFERENCES phase6_experiments(experiment_id)
    );
    CREATE INDEX IF NOT EXISTS idx_phase6_experiment_runs_experiment_state
      ON phase6_experiment_runs(experiment_id, state);
  `);
  ensureNullableTextColumn(db, "phase6_experiments", "explorer_id");
  ensureNullableTextColumn(db, "phase6_experiments", "explorer_display_name");
  ensureNullableTextColumn(db, "phase6_experiment_runs", "explorer_id");
  ensureNullableTextColumn(db, "phase6_experiment_runs", "explorer_display_name");
  const duplicateJourney = db.prepare(`
    SELECT journey_id, COUNT(*) AS binding_count
    FROM phase6_experiment_runs
    GROUP BY journey_id
    HAVING COUNT(*) > 1
    ORDER BY journey_id
    LIMIT 1
  `).get() as { readonly journey_id?: unknown; readonly binding_count?: unknown } | undefined;
  if (duplicateJourney) {
    const journeyId = typeof duplicateJourney.journey_id === "string"
      ? duplicateJourney.journey_id
      : "invalid";
    throw new Error(`phase6_experiment_run_journey_conflict:${journeyId}`);
  }
  const journeyIndex = (db.prepare("PRAGMA index_list('phase6_experiment_runs')").all() as Array<{
    readonly name?: unknown;
    readonly unique?: unknown;
  }>).find((index) => index.name === "idx_phase6_experiment_runs_journey_id");
  if (!journeyIndex || Number(journeyIndex.unique) !== 1) {
    db.exec(`
      DROP INDEX IF EXISTS idx_phase6_experiment_runs_journey_id;
      CREATE UNIQUE INDEX idx_phase6_experiment_runs_journey_id
        ON phase6_experiment_runs(journey_id);
    `);
  }
  db.exec(`
    DROP TRIGGER IF EXISTS phase6_experiments_identity_immutable;
    DROP TRIGGER IF EXISTS phase6_experiment_runs_identity_immutable;
    CREATE TRIGGER IF NOT EXISTS phase6_experiments_no_delete
    BEFORE DELETE ON phase6_experiments BEGIN
      SELECT RAISE(ABORT, 'phase6_experiments_delete_forbidden');
    END;
    CREATE TRIGGER IF NOT EXISTS phase6_experiment_runs_no_delete
    BEFORE DELETE ON phase6_experiment_runs BEGIN
      SELECT RAISE(ABORT, 'phase6_experiment_runs_delete_forbidden');
    END;
    CREATE TRIGGER IF NOT EXISTS phase6_experiments_identity_immutable
    BEFORE UPDATE ON phase6_experiments
    WHEN OLD.experiment_id != NEW.experiment_id
      OR OLD.identity_id != NEW.identity_id
      OR COALESCE(OLD.cohort_id, '') != COALESCE(NEW.cohort_id, '')
      OR COALESCE(OLD.explorer_id, '') != COALESCE(NEW.explorer_id, '')
      OR COALESCE(OLD.explorer_display_name, '') != COALESCE(NEW.explorer_display_name, '')
      OR OLD.scenario_matrix_id != NEW.scenario_matrix_id
      OR OLD.scenario_matrix_version != NEW.scenario_matrix_version
      OR OLD.rules_version != NEW.rules_version
      OR OLD.catalog_version != NEW.catalog_version
      OR OLD.code_version != NEW.code_version
      OR OLD.created_at != NEW.created_at
    BEGIN
      SELECT RAISE(ABORT, 'phase6_experiment_identity_immutable');
    END;
    CREATE TRIGGER IF NOT EXISTS phase6_experiments_complete_immutable
    BEFORE UPDATE ON phase6_experiments
    WHEN OLD.state = 'complete' AND OLD.state != NEW.state
    BEGIN
      SELECT RAISE(ABORT, 'phase6_experiment_complete_immutable');
    END;
    CREATE TRIGGER IF NOT EXISTS phase6_experiment_runs_identity_immutable
    BEFORE UPDATE ON phase6_experiment_runs
    WHEN OLD.experiment_id != NEW.experiment_id
      OR OLD.run_index != NEW.run_index
      OR OLD.identity_id != NEW.identity_id
      OR COALESCE(OLD.cohort_id, '') != COALESCE(NEW.cohort_id, '')
      OR COALESCE(OLD.explorer_id, '') != COALESCE(NEW.explorer_id, '')
      OR COALESCE(OLD.explorer_display_name, '') != COALESCE(NEW.explorer_display_name, '')
      OR OLD.scenario_matrix_id != NEW.scenario_matrix_id
      OR OLD.scenario_matrix_version != NEW.scenario_matrix_version
      OR OLD.rules_version != NEW.rules_version
      OR OLD.catalog_version != NEW.catalog_version
      OR OLD.code_version != NEW.code_version
      OR OLD.seed != NEW.seed
      OR OLD.journey_id != NEW.journey_id
      OR OLD.run_receipt_id != NEW.run_receipt_id
      OR COALESCE(OLD.run_receipt_version, '') != COALESCE(NEW.run_receipt_version, '')
      OR OLD.created_at != NEW.created_at
    BEGIN
      SELECT RAISE(ABORT, 'phase6_experiment_run_identity_immutable');
    END;
    CREATE TRIGGER IF NOT EXISTS phase6_experiment_runs_terminal_immutable
    BEFORE UPDATE ON phase6_experiment_runs
    WHEN OLD.state IN ('failed', 'complete')
    BEGIN
      SELECT RAISE(ABORT, 'phase6_experiment_run_terminal_immutable');
    END;
    CREATE TRIGGER IF NOT EXISTS phase6_experiment_runs_status_transition
    BEFORE UPDATE ON phase6_experiment_runs
    WHEN NOT (
      OLD.state = 'running'
      AND NEW.state IN ('failed', 'complete')
    )
    BEGIN
      SELECT RAISE(ABORT, 'phase6_experiment_run_transition_invalid');
    END;
  `);
}

export function createPhase6ExperimentSqliteStore(
  db: DatabaseSync,
): Phase6ExperimentSqliteStore {
  initializePhase6ExperimentSchema(db);

  const loadExperimentStatement = db.prepare(`
    SELECT
      experiment_id,
      state,
      identity_id,
      cohort_id,
      explorer_id,
      explorer_display_name,
      scenario_matrix_id,
      scenario_matrix_version,
      rules_version,
      catalog_version,
      code_version,
      created_at,
      updated_at
    FROM phase6_experiments
    WHERE experiment_id = ?
  `);
  const loadRunsStatement = db.prepare(`
    SELECT
      experiment_id,
      run_index,
      state,
      identity_id,
      cohort_id,
      explorer_id,
      explorer_display_name,
      scenario_matrix_id,
      scenario_matrix_version,
      rules_version,
      catalog_version,
      code_version,
      seed,
      journey_id,
      run_receipt_id,
      run_receipt_version,
      result_receipt_id,
      result_receipt_version,
      failure_reason,
      failure_receipt_id,
      failure_receipt_version,
      created_at,
      updated_at
    FROM phase6_experiment_runs
    WHERE experiment_id = ?
    ORDER BY run_index
  `);
  const loadRunByJourneyStatement = db.prepare(`
    SELECT
      experiment_id,
      run_index,
      state,
      identity_id,
      cohort_id,
      explorer_id,
      explorer_display_name,
      scenario_matrix_id,
      scenario_matrix_version,
      rules_version,
      catalog_version,
      code_version,
      seed,
      journey_id,
      run_receipt_id,
      run_receipt_version,
      result_receipt_id,
      result_receipt_version,
      failure_reason,
      failure_receipt_id,
      failure_receipt_version,
      created_at,
      updated_at
    FROM phase6_experiment_runs
    WHERE journey_id = ?
    ORDER BY created_at, experiment_id, run_index
    LIMIT 2
  `);
  const insertExperimentStatement = db.prepare(`
    INSERT OR IGNORE INTO phase6_experiments (
      experiment_id,
      state,
      identity_id,
      cohort_id,
      explorer_id,
      explorer_display_name,
      scenario_matrix_id,
      scenario_matrix_version,
      rules_version,
      catalog_version,
      code_version,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertRunStatement = db.prepare(`
    INSERT INTO phase6_experiment_runs (
      experiment_id,
      run_index,
      state,
      identity_id,
      cohort_id,
      explorer_id,
      explorer_display_name,
      scenario_matrix_id,
      scenario_matrix_version,
      rules_version,
      catalog_version,
      code_version,
      seed,
      journey_id,
      run_receipt_id,
      run_receipt_version,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const updateExperimentStateStatement = db.prepare(`
    UPDATE phase6_experiments
    SET state = ?, updated_at = ?
    WHERE experiment_id = ?
  `);
  const completeRunStatement = db.prepare(`
    UPDATE phase6_experiment_runs
    SET
      state = 'complete',
      result_receipt_id = ?,
      result_receipt_version = ?,
      updated_at = ?
    WHERE experiment_id = ? AND run_index = ?
  `);
  const failRunStatement = db.prepare(`
    UPDATE phase6_experiment_runs
    SET
      state = 'failed',
      failure_reason = ?,
      failure_receipt_id = ?,
      failure_receipt_version = ?,
      updated_at = ?
    WHERE experiment_id = ? AND run_index = ?
  `);

  function load(experimentId: string) {
    assertNonEmpty(experimentId, "experimentId");

    const experimentRow = loadExperimentStatement.get(experimentId);
    if (!experimentRow) return undefined;
    if (!isExperimentRow(experimentRow)) {
      throw new Error(`phase6_experiment_row_invalid:${experimentId}`);
    }

    const runRows = loadRunsStatement.all(experimentId);
    const runs = runRows.map((row) => {
      if (!isExperimentRunRow(row)) {
        throw new Error(`phase6_experiment_run_row_invalid:${experimentId}`);
      }
      return runFromRow(row);
    });

    const experiment = experimentFromRows(experimentRow, runs);
    assertValidStoredExperiment(experiment);
    return experiment;
  }

  function requireLoaded(experimentId: string) {
    const experiment = load(experimentId);
    if (!experiment) throw new Error(`phase6_experiment_not_found:${experimentId}`);
    return experiment;
  }

  function updateExperimentState(
    experimentId: string,
    state: Phase6ExperimentState,
    updatedAt: string,
  ) {
    updateExperimentStateStatement.run(state, updatedAt, experimentId);
  }

  return {
    create(input: Phase6CreateInput) {
      assertNoSecretLikeInput(input);

      return transaction(db, () => {
        const experiment = createPhase6Experiment(input);
        assertValidRulesExperiment(experiment);

        const now = new Date().toISOString();
        insertExperimentStatement.run(
          experiment.experimentId,
          experiment.state,
          experiment.identity.identityId,
          experiment.identity.cohortId ?? null,
          experiment.explorer.explorerId,
          experiment.explorer.displayName ?? null,
          experiment.scenarioMatrix.id,
          experiment.scenarioMatrix.version,
          experiment.versions.rulesVersion,
          experiment.versions.catalogVersion,
          experiment.versions.codeVersion,
          now,
          now,
        );

        const stored = requireLoaded(experiment.experimentId);
        assertExperimentIdentityMatches(stored, experiment);
        return stored;
      });
    },

    load,

    loadRunByJourneyId(journeyId: string) {
      assertNonEmpty(journeyId, "journeyId");
      const rows = loadRunByJourneyStatement.all(journeyId.trim());
      if (rows.length === 0) return undefined;
      if (rows.length > 1) throw new Error(`phase6_experiment_run_journey_conflict:${journeyId.trim()}`);
      const row = rows[0];
      if (!isExperimentRunRow(row)) {
        throw new Error(`phase6_experiment_run_row_invalid_for_journey:${journeyId.trim()}`);
      }
      return {
        ...runFromRow(row),
        experimentId: row.experiment_id,
      };
    },

    registerRun(experimentId: string, input: Phase6RegisterStoredRunInput) {
      assertNoSecretLikeInput(input);
      assertNonEmpty(input.journeyId, "journeyId");

      return transaction(db, () => {
        const stored = requireLoaded(experimentId);
        assertExperimentMutable(stored);
        const normalizedJourneyId = input.journeyId.trim();
        const existingJourneyRows = loadRunByJourneyStatement.all(normalizedJourneyId);
        const conflictingJourney = existingJourneyRows.find((row) => {
          if (!isExperimentRunRow(row)) {
            throw new Error(`phase6_experiment_run_row_invalid_for_journey:${normalizedJourneyId}`);
          }
          return row.experiment_id !== experimentId || row.run_index !== input.runIndex;
        });
        if (conflictingJourney) {
          throw new Error(`phase6_experiment_run_journey_conflict:${normalizedJourneyId}`);
        }

        const next = registerPhase6Run(toRulesExperiment(stored), input);
        assertValidRulesExperiment(next);

        const run = next.runs.find((candidate) => candidate.runIndex === input.runIndex);
        if (!run) throw new Error(`phase6_experiment_run_missing_after_register:${input.runIndex}`);

        const now = new Date().toISOString();
        insertRunStatement.run(
          next.experimentId,
          run.runIndex,
          run.state,
          run.identity.identityId,
          run.identity.cohortId ?? null,
          run.explorer.explorerId,
          run.explorer.displayName ?? null,
          run.scenarioMatrix.id,
          run.scenarioMatrix.version,
          run.versions.rulesVersion,
          run.versions.catalogVersion,
          run.versions.codeVersion,
          run.seed.seed,
          input.journeyId,
          run.runReceipt.receiptId,
          run.runReceipt.receiptVersion ?? null,
          now,
          now,
        );
        updateExperimentState(next.experimentId, next.state, now);
        return requireLoaded(next.experimentId);
      });
    },

    completeRun(
      experimentId: string,
      runIndex: Phase6RunIndex,
      input: Phase6CompleteRunInput,
    ) {
      assertNoSecretLikeInput(input);

      return transaction(db, () => {
        const stored = requireLoaded(experimentId);
        assertExperimentMutable(stored);

        const next = completePhase6Run(toRulesExperiment(stored), runIndex, input);
        assertValidRulesExperiment(next);

        const now = new Date().toISOString();
        completeRunStatement.run(
          input.resultReceipt.receiptId,
          input.resultReceipt.receiptVersion ?? null,
          now,
          experimentId,
          runIndex,
        );
        updateExperimentState(experimentId, next.state, now);
        return requireLoaded(experimentId);
      });
    },

    failRun(experimentId: string, runIndex: Phase6RunIndex, input: Phase6FailRunInput) {
      assertNoSecretLikeInput(input);

      return transaction(db, () => {
        const stored = requireLoaded(experimentId);
        assertExperimentMutable(stored);

        const next = failPhase6Run(toRulesExperiment(stored), runIndex, input);
        assertValidRulesExperiment(next);

        const now = new Date().toISOString();
        failRunStatement.run(
          input.reason,
          input.receipt?.receiptId ?? null,
          input.receipt?.receiptVersion ?? null,
          now,
          experimentId,
          runIndex,
        );
        updateExperimentState(experimentId, next.state, now);
        return requireLoaded(experimentId);
      });
    },

    completeExperiment(experimentId: string) {
      return transaction(db, () => {
        const stored = requireLoaded(experimentId);
        if (stored.state === "complete") return stored;
        assertExperimentMutable(stored);

        const missingRunIndexes = PHASE6_RUN_INDEXES.filter(
          (runIndex) => !stored.runs.some((run) => run.runIndex === runIndex),
        );
        if (missingRunIndexes.length > 0) {
          throw new Error(`phase6_experiment_runs_missing:${missingRunIndexes.join(",")}`);
        }
        const incompleteRun = stored.runs.find((run) => run.state !== "complete");
        if (incompleteRun) {
          throw new Error(`phase6_experiment_run_incomplete:${incompleteRun.runIndex}`);
        }

        const next: Phase6Experiment = {
          ...toRulesExperiment(stored),
          state: "complete",
        };
        assertValidRulesExperiment(next);

        updateExperimentState(experimentId, "complete", new Date().toISOString());
        return requireLoaded(experimentId);
      });
    },
  };
}

function experimentFromRows(
  row: Phase6ExperimentRow,
  runs: readonly Phase6StoredRun[],
): Phase6StoredExperiment {
  const experiment: Phase6StoredExperiment = {
    experimentId: row.experiment_id,
    state: row.state,
    identity: identityFromRow(row),
    explorer: explorerFromRow(row),
    scenarioMatrix: scenarioMatrixFromRow(row),
    versions: versionsFromRow(row),
    runs,
  };

  for (const run of runs) {
    // Run 1 is bound to the lineage root. Later runs may persist a
    // server-verified reincarnation while remaining under the same explorer.
    if (run.runIndex === 1) assertIdentityMatches(experiment.identity, run.identity);
    assertExplorerMatches(experiment.explorer, run.explorer);
    assertScenarioMatrixMatches(experiment.scenarioMatrix, run.scenarioMatrix);
    assertVersionsMatch(experiment.versions, run.versions);
  }

  return experiment;
}

function runFromRow(row: Phase6ExperimentRunRow): Phase6StoredRun {
  return {
    runIndex: row.run_index,
    state: row.state,
    identity: identityFromRow(row),
    explorer: explorerFromRow(row),
    scenarioMatrix: scenarioMatrixFromRow(row),
    versions: versionsFromRow(row),
    seed: seedFromRow(row),
    journeyId: row.journey_id,
    runReceipt: {
      receiptId: row.run_receipt_id,
      receiptVersion: row.run_receipt_version ?? undefined,
    },
    resultReceipt: row.result_receipt_id
      ? {
          receiptId: row.result_receipt_id,
          receiptVersion: row.result_receipt_version ?? undefined,
        }
      : undefined,
    failure: row.failure_reason
      ? {
          reason: row.failure_reason,
          receipt: row.failure_receipt_id
            ? {
                receiptId: row.failure_receipt_id,
                receiptVersion: row.failure_receipt_version ?? undefined,
              }
            : undefined,
        }
      : undefined,
  };
}

function identityFromRow(row: {
  readonly identity_id: string;
  readonly cohort_id: string | null;
}): Phase6IdentityBinding {
  return {
    identityId: row.identity_id,
    cohortId: row.cohort_id ?? undefined,
  };
}

function explorerFromRow(row: {
  readonly explorer_id: string | null;
  readonly explorer_display_name: string | null;
}): Phase6ExplorerBinding {
  return {
    explorerId: row.explorer_id ?? "",
    displayName: row.explorer_display_name ?? undefined,
  };
}

function scenarioMatrixFromRow(row: {
  readonly scenario_matrix_id: string;
  readonly scenario_matrix_version: string;
}): Phase6ScenarioMatrixVersion {
  return {
    id: row.scenario_matrix_id,
    version: row.scenario_matrix_version,
  };
}

function versionsFromRow(row: {
  readonly rules_version: string;
  readonly catalog_version: string;
  readonly code_version: string;
}): Phase6VersionBinding {
  return {
    rulesVersion: row.rules_version,
    catalogVersion: row.catalog_version,
    codeVersion: row.code_version,
  };
}

function seedFromRow(row: { readonly seed: string }): Phase6SeedBinding {
  return { seed: row.seed };
}

function toRulesExperiment(experiment: Phase6StoredExperiment): Phase6Experiment {
  return {
    ...experiment,
    runs: experiment.runs.map(({ journeyId: _journeyId, ...run }) => run),
  };
}

function assertValidStoredExperiment(experiment: Phase6StoredExperiment) {
  assertNoSecretLikeInput(experiment);
  assertValidRulesExperiment(toRulesExperiment(experiment));
}

function assertValidRulesExperiment(experiment: Phase6Experiment) {
  const validation = validatePhase6Experiment(experiment);
  if (!validation.ok) {
    throw new Error(`phase6_experiment_invalid:${validation.errors[0] || "unknown"}`);
  }
}

function assertExperimentMutable(experiment: Phase6StoredExperiment) {
  if (experiment.state === "complete") {
    throw new Error(`phase6_experiment_complete_immutable:${experiment.experimentId}`);
  }
}

function assertExperimentIdentityMatches(
  stored: Phase6StoredExperiment,
  expected: Phase6Experiment,
) {
  assertIdentityMatches(stored.identity, expected.identity);
  assertExplorerMatches(stored.explorer, expected.explorer);
  assertScenarioMatrixMatches(stored.scenarioMatrix, expected.scenarioMatrix);
  assertVersionsMatch(stored.versions, expected.versions);
}

function assertIdentityMatches(
  left: Phase6IdentityBinding,
  right: Phase6IdentityBinding,
) {
  if (
    left.identityId !== right.identityId ||
    (left.cohortId ?? "") !== (right.cohortId ?? "")
  ) {
    throw new Error("phase6_experiment_identity_mismatch");
  }
}

function assertExplorerMatches(
  left: Phase6ExplorerBinding,
  right: Phase6ExplorerBinding,
) {
  if (
    left.explorerId !== right.explorerId ||
    (left.displayName ?? "") !== (right.displayName ?? "")
  ) {
    throw new Error("phase6_experiment_explorer_mismatch");
  }
}

function assertScenarioMatrixMatches(
  left: Phase6ScenarioMatrixVersion,
  right: Phase6ScenarioMatrixVersion,
) {
  if (left.id !== right.id || left.version !== right.version) {
    throw new Error("phase6_experiment_scenario_matrix_mismatch");
  }
}

function assertVersionsMatch(
  left: Phase6VersionBinding,
  right: Phase6VersionBinding,
) {
  if (
    left.rulesVersion !== right.rulesVersion ||
    left.catalogVersion !== right.catalogVersion ||
    left.codeVersion !== right.codeVersion
  ) {
    throw new Error("phase6_experiment_version_mismatch");
  }
}

function assertNonEmpty(value: string, fieldName: string) {
  if (value.trim().length === 0) {
    throw new Error(`phase6_experiment_${fieldName}_required`);
  }
}

function assertNoSecretLikeInput(value: unknown) {
  const path: string[] = [];
  assertNoSecretLikeValue(value, path);
}

function assertNoSecretLikeValue(value: unknown, path: string[]) {
  if (typeof value === "string") {
    if (looksSecretLike(path[path.length - 1] || "") || looksSecretLike(value)) {
      throw new Error(`phase6_experiment_secret_forbidden:${path.join(".") || "value"}`);
    }
    return;
  }
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertNoSecretLikeValue(entry, [...path, String(index)]));
    return;
  }

  for (const [key, entry] of Object.entries(value)) {
    if (looksSecretLike(key)) {
      throw new Error(`phase6_experiment_secret_forbidden:${[...path, key].join(".")}`);
    }
    assertNoSecretLikeValue(entry, [...path, key]);
  }
}

function looksSecretLike(value: string) {
  return /(?:secret|token|password|credential|api[_-]?key|private[_-]?key)/i.test(value);
}

function ensureNullableTextColumn(
  db: DatabaseSync,
  tableName: string,
  columnName: string,
) {
  const rows = db.prepare(`PRAGMA table_info(${tableName})`).all();
  const exists = rows.some((row) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) return false;
    return (row as Record<string, unknown>).name === columnName;
  });
  if (!exists) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} TEXT`);
  }
}

function transaction<T>(db: DatabaseSync, work: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = work();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

function isExperimentRow(value: unknown): value is Phase6ExperimentRow {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.experiment_id === "string" &&
    isExperimentState(row.state) &&
    typeof row.identity_id === "string" &&
    (row.cohort_id === null || typeof row.cohort_id === "string") &&
    (row.explorer_id === null || typeof row.explorer_id === "string") &&
    (row.explorer_display_name === null || typeof row.explorer_display_name === "string") &&
    typeof row.scenario_matrix_id === "string" &&
    typeof row.scenario_matrix_version === "string" &&
    typeof row.rules_version === "string" &&
    typeof row.catalog_version === "string" &&
    typeof row.code_version === "string" &&
    typeof row.created_at === "string" &&
    typeof row.updated_at === "string"
  );
}

function isExperimentRunRow(value: unknown): value is Phase6ExperimentRunRow {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.experiment_id === "string" &&
    isRunIndex(row.run_index) &&
    isExperimentState(row.state) &&
    typeof row.identity_id === "string" &&
    (row.cohort_id === null || typeof row.cohort_id === "string") &&
    (row.explorer_id === null || typeof row.explorer_id === "string") &&
    (row.explorer_display_name === null || typeof row.explorer_display_name === "string") &&
    typeof row.scenario_matrix_id === "string" &&
    typeof row.scenario_matrix_version === "string" &&
    typeof row.rules_version === "string" &&
    typeof row.catalog_version === "string" &&
    typeof row.code_version === "string" &&
    typeof row.seed === "string" &&
    typeof row.journey_id === "string" &&
    typeof row.run_receipt_id === "string" &&
    (row.run_receipt_version === null || typeof row.run_receipt_version === "string") &&
    (row.result_receipt_id === null || typeof row.result_receipt_id === "string") &&
    (row.result_receipt_version === null || typeof row.result_receipt_version === "string") &&
    (row.failure_reason === null || typeof row.failure_reason === "string") &&
    (row.failure_receipt_id === null || typeof row.failure_receipt_id === "string") &&
    (row.failure_receipt_version === null || typeof row.failure_receipt_version === "string") &&
    typeof row.created_at === "string" &&
    typeof row.updated_at === "string"
  );
}

function isExperimentState(value: unknown): value is Phase6ExperimentState {
  return (
    value === "planned" ||
    value === "running" ||
    value === "failed" ||
    value === "complete"
  );
}

function isRunIndex(value: unknown): value is Phase6RunIndex {
  return PHASE6_RUN_INDEXES.some((runIndex) => runIndex === value);
}
