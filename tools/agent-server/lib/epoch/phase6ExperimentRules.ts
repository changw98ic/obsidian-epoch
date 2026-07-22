export type Phase6RunIndex = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export type Phase6ExperimentState =
  | "planned"
  | "running"
  | "failed"
  | "complete";

export interface Phase6ScenarioMatrixVersion {
  readonly id: string;
  readonly version: string;
}

export interface Phase6IdentityBinding {
  readonly identityId: string;
  readonly cohortId?: string;
}

export interface Phase6ExplorerBinding {
  readonly explorerId: string;
  readonly displayName?: string;
}

export interface Phase6VersionBinding {
  readonly rulesVersion: string;
  readonly catalogVersion: string;
  readonly codeVersion: string;
}

export interface Phase6SeedBinding {
  readonly seed: string;
}

export interface Phase6RunReceiptRef {
  readonly receiptId: string;
  readonly receiptVersion?: string;
}

export interface Phase6RunResultReceiptRef {
  readonly receiptId: string;
  readonly receiptVersion?: string;
}

export interface Phase6RunFailure {
  readonly reason: string;
  readonly receipt?: Phase6RunResultReceiptRef;
}

export interface Phase6Run {
  readonly runIndex: Phase6RunIndex;
  readonly state: Phase6ExperimentState;
  readonly identity: Phase6IdentityBinding;
  readonly explorer: Phase6ExplorerBinding;
  readonly scenarioMatrix: Phase6ScenarioMatrixVersion;
  readonly versions: Phase6VersionBinding;
  readonly seed: Phase6SeedBinding;
  readonly runReceipt: Phase6RunReceiptRef;
  readonly resultReceipt?: Phase6RunResultReceiptRef;
  readonly failure?: Phase6RunFailure;
}

export interface Phase6Experiment {
  readonly experimentId: string;
  readonly state: Phase6ExperimentState;
  readonly identity: Phase6IdentityBinding;
  readonly explorer: Phase6ExplorerBinding;
  readonly scenarioMatrix: Phase6ScenarioMatrixVersion;
  readonly versions: Phase6VersionBinding;
  readonly runs: readonly Phase6Run[];
}

export interface Phase6CreateInput {
  readonly experimentId: string;
  readonly identity: Phase6IdentityBinding;
  readonly explorer: Phase6ExplorerBinding;
  readonly scenarioMatrix: Phase6ScenarioMatrixVersion;
  readonly versions: Phase6VersionBinding;
}

export interface Phase6RegisterRunInput {
  readonly runIndex: Phase6RunIndex;
  readonly identity: Phase6IdentityBinding;
  readonly explorer: Phase6ExplorerBinding;
  readonly scenarioMatrix: Phase6ScenarioMatrixVersion;
  readonly versions: Phase6VersionBinding;
  readonly seed: Phase6SeedBinding;
  readonly runReceipt: Phase6RunReceiptRef;
}

export interface Phase6CompleteRunInput {
  readonly resultReceipt: Phase6RunResultReceiptRef;
}

export interface Phase6FailRunInput {
  readonly reason: string;
  readonly receipt?: Phase6RunResultReceiptRef;
}

export interface Phase6ExperimentSummary {
  readonly experimentId: string;
  readonly state: Phase6ExperimentState;
  readonly identityId: string;
  readonly explorerId: string;
  readonly explorerDisplayName?: string;
  readonly scenarioMatrixId: string;
  readonly scenarioMatrixVersion: string;
  readonly rulesVersion: string;
  readonly catalogVersion: string;
  readonly codeVersion: string;
  readonly plannedRuns: number;
  readonly runningRuns: number;
  readonly failedRuns: number;
  readonly completeRuns: number;
  readonly missingRunIndexes: readonly Phase6RunIndex[];
}

export interface Phase6ValidationResult {
  readonly ok: boolean;
  readonly errors: readonly string[];
}

export const PHASE6_RUN_INDEXES = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
] as const satisfies readonly Phase6RunIndex[];

export function create(input: Phase6CreateInput): Phase6Experiment {
  assertNonEmpty(input.experimentId, "experimentId");
  assertIdentity(input.identity);
  assertExplorer(input.explorer);
  assertScenarioMatrix(input.scenarioMatrix);
  assertVersions(input.versions);

  return {
    experimentId: input.experimentId,
    state: "planned",
    identity: input.identity,
    explorer: input.explorer,
    scenarioMatrix: input.scenarioMatrix,
    versions: input.versions,
    runs: [],
  };
}

export function registerRun(
  experiment: Phase6Experiment,
  input: Phase6RegisterRunInput,
): Phase6Experiment {
  assertMutable(experiment);
  assertRunIndex(input.runIndex);
  // The experiment identity is the lineage root. Run 1 must use that root;
  // later runs may use a server-verified reincarnation owned by the same explorer.
  if (input.runIndex === 1 || experiment.runs.length === 0) {
    assertIdentityMatches(experiment.identity, input.identity);
  }
  assertExplorerMatches(experiment.explorer, input.explorer);
  assertScenarioMatrixMatches(experiment.scenarioMatrix, input.scenarioMatrix);
  assertVersionsMatch(experiment.versions, input.versions);
  assertNonEmpty(input.seed.seed, "seed");
  assertNonEmpty(input.runReceipt.receiptId, "runReceipt.receiptId");

  if (experiment.runs.some((run) => run.runIndex === input.runIndex)) {
    throw new Error(`Phase 6 runIndex ${input.runIndex} is already registered`);
  }

  const run: Phase6Run = {
    runIndex: input.runIndex,
    state: "running",
    identity: input.identity,
    explorer: input.explorer,
    scenarioMatrix: input.scenarioMatrix,
    versions: input.versions,
    seed: input.seed,
    runReceipt: input.runReceipt,
  };

  return withRuns(experiment, [...experiment.runs, run]);
}

export function fail(
  experiment: Phase6Experiment,
  runIndex: Phase6RunIndex,
  input: Phase6FailRunInput,
): Phase6Experiment {
  assertMutable(experiment);
  assertRunIndex(runIndex);
  assertNonEmpty(input.reason, "reason");

  return updateRun(experiment, runIndex, (run) => {
    assertRunMutable(run);
    return {
      ...run,
      state: "failed",
      failure: {
        reason: input.reason,
        receipt: input.receipt,
      },
    };
  });
}

export function complete(
  experiment: Phase6Experiment,
  runIndex: Phase6RunIndex,
  input: Phase6CompleteRunInput,
): Phase6Experiment {
  assertMutable(experiment);
  assertRunIndex(runIndex);
  assertNonEmpty(input.resultReceipt.receiptId, "resultReceipt.receiptId");

  return updateRun(experiment, runIndex, (run) => {
    assertRunMutable(run);
    return {
      ...run,
      state: "complete",
      resultReceipt: input.resultReceipt,
    };
  });
}

export function validate(
  experiment: Phase6Experiment,
): Phase6ValidationResult {
  const errors: string[] = [];
  collectExperimentErrors(experiment, errors);
  return { ok: errors.length === 0, errors };
}

export function summary(
  experiment: Phase6Experiment,
): Phase6ExperimentSummary {
  const missingRunIndexes = PHASE6_RUN_INDEXES.filter(
    (runIndex) => !experiment.runs.some((run) => run.runIndex === runIndex),
  );

  return {
    experimentId: experiment.experimentId,
    state: experiment.state,
    identityId: experiment.identity.identityId,
    explorerId: experiment.explorer.explorerId,
    explorerDisplayName: experiment.explorer.displayName,
    scenarioMatrixId: experiment.scenarioMatrix.id,
    scenarioMatrixVersion: experiment.scenarioMatrix.version,
    rulesVersion: experiment.versions.rulesVersion,
    catalogVersion: experiment.versions.catalogVersion,
    codeVersion: experiment.versions.codeVersion,
    plannedRuns: countRuns(experiment, "planned"),
    runningRuns: countRuns(experiment, "running"),
    failedRuns: countRuns(experiment, "failed"),
    completeRuns: countRuns(experiment, "complete"),
    missingRunIndexes,
  };
}

function withRuns(
  experiment: Phase6Experiment,
  runs: readonly Phase6Run[],
): Phase6Experiment {
  const nextState = deriveExperimentState(runs);
  return {
    ...experiment,
    state: nextState,
    runs: [...runs].sort((a, b) => a.runIndex - b.runIndex),
  };
}

function updateRun(
  experiment: Phase6Experiment,
  runIndex: Phase6RunIndex,
  update: (run: Phase6Run) => Phase6Run,
): Phase6Experiment {
  let found = false;
  const runs = experiment.runs.map((run) => {
    if (run.runIndex !== runIndex) {
      return run;
    }
    found = true;
    return update(run);
  });

  if (!found) {
    throw new Error(`Phase 6 runIndex ${runIndex} is not registered`);
  }

  return withRuns(experiment, runs);
}

function deriveExperimentState(
  runs: readonly Phase6Run[],
): Phase6ExperimentState {
  if (runs.some((run) => run.state === "failed")) {
    return "failed";
  }

  if (
    runs.length === PHASE6_RUN_INDEXES.length &&
    runs.every((run) => run.state === "complete")
  ) {
    return "complete";
  }

  if (runs.some((run) => run.state === "running")) {
    return "running";
  }

  return "planned";
}

function collectExperimentErrors(
  experiment: Phase6Experiment,
  errors: string[],
): void {
  collectRequiredErrors(experiment, errors);

  const seen = new Set<Phase6RunIndex>();
  for (const run of experiment.runs) {
    if (!isRunIndex(run.runIndex)) {
      errors.push(`invalid runIndex ${run.runIndex}`);
      continue;
    }

    if (seen.has(run.runIndex)) {
      errors.push(`duplicate runIndex ${run.runIndex}`);
    }
    seen.add(run.runIndex);

    if (run.runIndex === 1 && !identityEquals(experiment.identity, run.identity)) {
      errors.push(`runIndex ${run.runIndex} has a different identity binding`);
    }
    if (!explorerEquals(experiment.explorer, run.explorer)) {
      errors.push(`runIndex ${run.runIndex} has a different explorer binding`);
    }
    if (!scenarioMatrixEquals(experiment.scenarioMatrix, run.scenarioMatrix)) {
      errors.push(
        `runIndex ${run.runIndex} has a different scenario matrix version`,
      );
    }
    if (!versionsEqual(experiment.versions, run.versions)) {
      errors.push(`runIndex ${run.runIndex} has a different version binding`);
    }
    if (!run.resultReceipt && run.state === "complete") {
      errors.push(`runIndex ${run.runIndex} is complete without result receipt`);
    }
  }

  if (experiment.state === "complete") {
    if (experiment.runs.length !== PHASE6_RUN_INDEXES.length) {
      errors.push("complete experiment must contain exactly ten runs");
    }
    for (const runIndex of PHASE6_RUN_INDEXES) {
      if (!seen.has(runIndex)) {
        errors.push(`complete experiment is missing runIndex ${runIndex}`);
      }
    }
    for (const run of experiment.runs) {
      if (run.state !== "complete") {
        errors.push(`complete experiment has non-complete runIndex ${run.runIndex}`);
      }
      if (!run.resultReceipt) {
        errors.push(`complete experiment runIndex ${run.runIndex} lacks result receipt`);
      }
    }
  }

  if (experiment.runs.length > PHASE6_RUN_INDEXES.length) {
    errors.push("experiment contains more than ten runs");
  }
}

function collectRequiredErrors(
  experiment: Phase6Experiment,
  errors: string[],
): void {
  pushMissing(errors, experiment.experimentId, "experimentId");
  pushMissing(errors, experiment.identity.identityId, "identity.identityId");
  pushMissing(errors, experiment.explorer?.explorerId ?? "", "explorer.explorerId");
  pushMissing(errors, experiment.scenarioMatrix.id, "scenarioMatrix.id");
  pushMissing(
    errors,
    experiment.scenarioMatrix.version,
    "scenarioMatrix.version",
  );
  pushMissing(errors, experiment.versions.rulesVersion, "versions.rulesVersion");
  pushMissing(errors, experiment.versions.catalogVersion, "versions.catalogVersion");
  pushMissing(errors, experiment.versions.codeVersion, "versions.codeVersion");

  for (const run of experiment.runs) {
    pushMissing(
      errors,
      run.explorer?.explorerId ?? "",
      `runIndex ${run.runIndex} explorer.explorerId`,
    );
    pushMissing(errors, run.seed.seed, `runIndex ${run.runIndex} seed`);
    pushMissing(
      errors,
      run.runReceipt.receiptId,
      `runIndex ${run.runIndex} runReceipt.receiptId`,
    );
  }
}

function countRuns(
  experiment: Phase6Experiment,
  state: Phase6ExperimentState,
): number {
  return experiment.runs.filter((run) => run.state === state).length;
}

function assertExplorer(input: Phase6ExplorerBinding | undefined) {
  if (input === undefined) {
    throw new Error("Phase 6 explorer.explorerId is required");
  }
  assertNonEmpty(input.explorerId, "explorer.explorerId");
}

function assertExplorerMatches(
  expected: Phase6ExplorerBinding,
  actual: Phase6ExplorerBinding,
) {
  assertExplorer(actual);
  if (
    expected.explorerId !== actual.explorerId ||
    expected.displayName !== actual.displayName
  ) {
    throw new Error("Phase 6 explorer binding does not match experiment");
  }
}

function assertMutable(experiment: Phase6Experiment): void {
  if (experiment.state === "complete") {
    throw new Error("Phase 6 experiment is complete and cannot be modified");
  }
}

function assertRunMutable(run: Phase6Run): void {
  if (run.state === "complete") {
    throw new Error(`Phase 6 runIndex ${run.runIndex} is complete and cannot be modified`);
  }
}

function assertRunIndex(runIndex: Phase6RunIndex): void {
  if (!isRunIndex(runIndex)) {
    throw new Error(`Phase 6 runIndex must be an integer from 1 to 10`);
  }
}

function isRunIndex(runIndex: number): runIndex is Phase6RunIndex {
  return PHASE6_RUN_INDEXES.includes(runIndex as Phase6RunIndex);
}

function assertIdentity(identity: Phase6IdentityBinding): void {
  assertNonEmpty(identity.identityId, "identity.identityId");
}

function assertScenarioMatrix(scenarioMatrix: Phase6ScenarioMatrixVersion): void {
  assertNonEmpty(scenarioMatrix.id, "scenarioMatrix.id");
  assertNonEmpty(scenarioMatrix.version, "scenarioMatrix.version");
}

function assertVersions(versions: Phase6VersionBinding): void {
  assertNonEmpty(versions.rulesVersion, "versions.rulesVersion");
  assertNonEmpty(versions.catalogVersion, "versions.catalogVersion");
  assertNonEmpty(versions.codeVersion, "versions.codeVersion");
}

function assertIdentityMatches(
  expected: Phase6IdentityBinding,
  actual: Phase6IdentityBinding,
): void {
  assertIdentity(actual);
  if (!identityEquals(expected, actual)) {
    throw new Error("Phase 6 run identity binding does not match experiment identity");
  }
}

function assertScenarioMatrixMatches(
  expected: Phase6ScenarioMatrixVersion,
  actual: Phase6ScenarioMatrixVersion,
): void {
  assertScenarioMatrix(actual);
  if (!scenarioMatrixEquals(expected, actual)) {
    throw new Error(
      "Phase 6 run scenario matrix version does not match experiment scenario matrix",
    );
  }
}

function assertVersionsMatch(
  expected: Phase6VersionBinding,
  actual: Phase6VersionBinding,
): void {
  assertVersions(actual);
  if (!versionsEqual(expected, actual)) {
    throw new Error("Phase 6 run version binding does not match experiment versions");
  }
}

function assertNonEmpty(value: string, field: string): void {
  if (value.trim().length === 0) {
    throw new Error(`Phase 6 ${field} is required`);
  }
}

function pushMissing(errors: string[], value: string, field: string): void {
  if (value.trim().length === 0) {
    errors.push(`${field} is required`);
  }
}

function identityEquals(
  left: Phase6IdentityBinding,
  right: Phase6IdentityBinding,
): boolean {
  return left.identityId === right.identityId && left.cohortId === right.cohortId;
}

function explorerEquals(
  left: Phase6ExplorerBinding | undefined,
  right: Phase6ExplorerBinding | undefined,
): boolean {
  return (
    left?.explorerId === right?.explorerId &&
    left?.displayName === right?.displayName
  );
}

function scenarioMatrixEquals(
  left: Phase6ScenarioMatrixVersion,
  right: Phase6ScenarioMatrixVersion,
): boolean {
  return left.id === right.id && left.version === right.version;
}

function versionsEqual(
  left: Phase6VersionBinding,
  right: Phase6VersionBinding,
): boolean {
  return (
    left.rulesVersion === right.rulesVersion &&
    left.catalogVersion === right.catalogVersion &&
    left.codeVersion === right.codeVersion
  );
}
