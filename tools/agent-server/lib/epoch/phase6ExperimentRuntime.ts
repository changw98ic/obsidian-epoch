import {
  PHASE6_RUN_INDEXES,
  complete,
  create,
  fail,
  registerRun,
  summary as summarizeExperiment,
  validate,
  type Phase6CompleteRunInput,
  type Phase6CreateInput,
  type Phase6Experiment,
  type Phase6ExperimentSummary,
  type Phase6ExplorerBinding,
  type Phase6IdentityBinding,
  type Phase6RegisterRunInput,
  type Phase6Run,
  type Phase6RunIndex,
  type Phase6RunResultReceiptRef,
  type Phase6SeedBinding,
  type Phase6VersionBinding,
} from "./phase6ExperimentRules";

type MaybePromise<T> = T | Promise<T>;

export interface Phase6ExperimentRuntimeStore {
  transaction<T>(
    operation: (store: Phase6ExperimentRuntimeTransactionStore) => MaybePromise<T>,
  ): MaybePromise<T>;
}

export interface Phase6ExperimentRuntimeTransactionStore {
  loadExperiment(experimentId: string): MaybePromise<Phase6Experiment | undefined>;
  saveExperiment(experiment: Phase6Experiment): MaybePromise<void>;
  loadCommand(
    commandId: string,
  ): MaybePromise<Phase6ExperimentRuntimeCommandRecord | undefined>;
  saveCommand(record: Phase6ExperimentRuntimeCommandRecord): MaybePromise<void>;
}

export interface Phase6ExperimentRuntimeCommandRecord {
  readonly commandId: string;
  readonly operation: Phase6ExperimentRuntimeOperation;
  readonly payloadHash: string;
  readonly response: Phase6ExperimentRuntimeCommandResponse;
  readonly completedAt: string;
}

export type Phase6ExperimentRuntimeOperation =
  | "createExperiment"
  | "startRun"
  | "completeRunWithReceipt"
  | "failRun"
  | "completeExperiment";

export type Phase6ExperimentRuntimeCommandResponse =
  | Phase6Experiment
  | Phase6Run;

export interface Phase6ExperimentRuntimeOptions {
  readonly store: Phase6ExperimentRuntimeStore;
  readonly now: () => Date | string;
}

export interface Phase6RuntimeCommandInput {
  readonly commandId: string;
}

export type Phase6CreateExperimentRuntimeInput =
  Phase6RuntimeCommandInput & Phase6CreateInput;

export interface Phase6StartRunRuntimeInput
  extends Phase6RuntimeCommandInput {
  readonly experimentId: string;
  readonly run: Phase6RegisterRunInput;
}

export interface Phase6ResultReceiptV2 extends Phase6RunResultReceiptRef {
  readonly receiptVersion: "v2";
  readonly experimentId: string;
  readonly runIndex: Phase6RunIndex;
  readonly identity: Phase6IdentityBinding;
  readonly explorer: Phase6ExplorerBinding;
  readonly versions: Phase6VersionBinding;
  readonly seed: Phase6SeedBinding;
}

export interface Phase6CompleteRunWithReceiptRuntimeInput
  extends Phase6RuntimeCommandInput {
  readonly experimentId: string;
  readonly runIndex: Phase6RunIndex;
  readonly receipt: Phase6ResultReceiptV2;
}

export interface Phase6FailRunRuntimeInput extends Phase6RuntimeCommandInput {
  readonly experimentId: string;
  readonly runIndex: Phase6RunIndex;
  readonly reason: string;
  readonly receipt?: Phase6ResultReceiptV2;
}

export interface Phase6CompleteExperimentRuntimeInput
  extends Phase6RuntimeCommandInput {
  readonly experimentId: string;
}

export interface Phase6LoadRuntimeInput {
  readonly experimentId: string;
}

export type Phase6SummaryRuntimeInput =
  | Phase6LoadRuntimeInput
  | Phase6Experiment;

export interface Phase6ExperimentRuntime {
  createExperiment(
    input: Phase6CreateExperimentRuntimeInput,
  ): Promise<Phase6Experiment>;
  startRun(input: Phase6StartRunRuntimeInput): Promise<Phase6Run>;
  completeRunWithReceipt(
    input: Phase6CompleteRunWithReceiptRuntimeInput,
  ): Promise<Phase6Run>;
  failRun(input: Phase6FailRunRuntimeInput): Promise<Phase6Run>;
  completeExperiment(
    input: Phase6CompleteExperimentRuntimeInput,
  ): Promise<Phase6Experiment>;
  load(input: Phase6LoadRuntimeInput): Promise<Phase6Experiment | undefined>;
  summary(input: Phase6SummaryRuntimeInput): Promise<Phase6ExperimentSummary>;
}

export function createPhase6ExperimentRuntime(
  options: Phase6ExperimentRuntimeOptions,
): Phase6ExperimentRuntime {
  return {
    createExperiment(input) {
      return runCommand(options, "createExperiment", input, async (store) => {
        const existing = await store.loadExperiment(input.experimentId);
        if (existing !== undefined) {
          throw new Error(
            `Phase 6 experiment ${input.experimentId} is already registered`,
          );
        }

        const experiment = assertValidExperiment(
          create({
            experimentId: input.experimentId,
            identity: input.identity,
            explorer: input.explorer,
            scenarioMatrix: input.scenarioMatrix,
            versions: input.versions,
          }),
        );

        await store.saveExperiment(experiment);
        return experiment;
      });
    },

    startRun(input) {
      return runCommand(options, "startRun", input, async (store) => {
        const experiment = await requireExperiment(store, input.experimentId);
        const next = assertValidExperiment(registerRun(experiment, input.run));
        const run = requireRun(next, input.run.runIndex);

        await store.saveExperiment(next);
        return run;
      });
    },

    completeRunWithReceipt(input) {
      return runCommand(
        options,
        "completeRunWithReceipt",
        input,
        async (store) => {
          const experiment = await requireExperiment(store, input.experimentId);
          const run = requireRun(experiment, input.runIndex);
          assertReceiptMatchesRun(input.receipt, experiment, run);

          const completeInput: Phase6CompleteRunInput = {
            resultReceipt: input.receipt,
          };
          const next = assertValidExperiment(
            complete(experiment, input.runIndex, completeInput),
          );
          const completedRun = requireRun(next, input.runIndex);

          await store.saveExperiment(next);
          return completedRun;
        },
      );
    },

    failRun(input) {
      return runCommand(options, "failRun", input, async (store) => {
        const experiment = await requireExperiment(store, input.experimentId);
        const run = requireRun(experiment, input.runIndex);
        if (input.receipt !== undefined) {
          assertReceiptMatchesRun(input.receipt, experiment, run);
        }

        const next = assertValidExperiment(
          fail(experiment, input.runIndex, {
            reason: input.reason,
            receipt: input.receipt,
          }),
        );
        const failedRun = requireRun(next, input.runIndex);

        await store.saveExperiment(next);
        return failedRun;
      });
    },

    completeExperiment(input) {
      return runCommand(options, "completeExperiment", input, async (store) => {
        const experiment = await requireExperiment(store, input.experimentId);
        const next = assertValidExperiment(markExperimentComplete(experiment));

        await store.saveExperiment(next);
        return next;
      });
    },

    async load(input) {
      assertNonEmpty(input.experimentId, "experimentId");
      const experiment = await options.store.transaction((store) =>
        store.loadExperiment(input.experimentId),
      );
      return experiment === undefined ? undefined : assertValidExperiment(experiment);
    },

    async summary(input) {
      const experiment =
        "experimentId" in input && "runs" in input
          ? input
          : await this.load(input);

      if (experiment === undefined) {
        throw new Error(`Phase 6 experiment ${input.experimentId} is not registered`);
      }

      return summarizeExperiment(assertValidExperiment(experiment));
    },
  };
}

async function runCommand<T extends Phase6ExperimentRuntimeCommandResponse>(
  options: Phase6ExperimentRuntimeOptions,
  operation: Phase6ExperimentRuntimeOperation,
  input: Phase6RuntimeCommandInput,
  execute: (store: Phase6ExperimentRuntimeTransactionStore) => MaybePromise<T>,
): Promise<T> {
  assertNonEmpty(input.commandId, "commandId");
  assertNoSecretKeys(input);
  const payloadHash = canonicalJson(input);

  return options.store.transaction(async (store) => {
    const existing = await store.loadCommand(input.commandId);
    if (existing !== undefined) {
      if (
        existing.operation !== operation ||
        existing.payloadHash !== payloadHash
      ) {
        throw new Error(
          `Phase 6 command ${input.commandId} conflicts with an existing payload`,
        );
      }
      return existing.response as T;
    }

    const response = await execute(store);
    await store.saveCommand({
      commandId: input.commandId,
      operation,
      payloadHash,
      response,
      completedAt: formatNow(options.now()),
    });
    return response;
  });
}

async function requireExperiment(
  store: Phase6ExperimentRuntimeTransactionStore,
  experimentId: string,
): Promise<Phase6Experiment> {
  assertNonEmpty(experimentId, "experimentId");
  const experiment = await store.loadExperiment(experimentId);
  if (experiment === undefined) {
    throw new Error(`Phase 6 experiment ${experimentId} is not registered`);
  }
  return assertValidExperiment(experiment);
}

function requireRun(
  experiment: Phase6Experiment,
  runIndex: Phase6RunIndex,
): Phase6Run {
  const run = experiment.runs.find((candidate) => candidate.runIndex === runIndex);
  if (run === undefined) {
    throw new Error(`Phase 6 runIndex ${runIndex} is not registered`);
  }
  return run;
}

function markExperimentComplete(
  experiment: Phase6Experiment,
): Phase6Experiment {
  const completeRuns = experiment.runs.filter((run) => run.state === "complete");
  if (
    experiment.runs.length !== PHASE6_RUN_INDEXES.length ||
    completeRuns.length !== PHASE6_RUN_INDEXES.length
  ) {
    throw new Error("Phase 6 experiment requires exactly 10 complete runs");
  }

  for (const runIndex of PHASE6_RUN_INDEXES) {
    const run = requireRun(experiment, runIndex);
    if (run.state !== "complete") {
      throw new Error(`Phase 6 runIndex ${runIndex} is not complete`);
    }
  }

  return {
    ...experiment,
    state: "complete",
  };
}

function assertReceiptMatchesRun(
  receipt: Phase6ResultReceiptV2,
  experiment: Phase6Experiment,
  run: Phase6Run,
): void {
  assertNonEmpty(receipt.receiptId, "receipt.receiptId");
  if (receipt.receiptVersion !== "v2") {
    throw new Error("Phase 6 result receipt must be v2");
  }
  if (receipt.experimentId !== experiment.experimentId) {
    throw new Error("Phase 6 receipt experimentId does not match registration");
  }
  if (receipt.runIndex !== run.runIndex) {
    throw new Error("Phase 6 receipt runIndex does not match registration");
  }
  if (!sameJson(receipt.identity, run.identity)) {
    throw new Error("Phase 6 receipt identity does not match registration");
  }
  if (!sameJson(receipt.explorer, run.explorer)) {
    throw new Error("Phase 6 receipt explorer does not match registration");
  }
  if (!sameJson(receipt.versions, run.versions)) {
    throw new Error("Phase 6 receipt versions do not match registration");
  }
  if (!sameJson(receipt.seed, run.seed)) {
    throw new Error("Phase 6 receipt seed does not match registration");
  }
}

function assertValidExperiment(
  experiment: Phase6Experiment,
): Phase6Experiment {
  const result = validate(experiment);
  if (!result.ok) {
    throw new Error(`Invalid Phase 6 experiment: ${result.errors.join("; ")}`);
  }
  return experiment;
}

function assertNonEmpty(value: string, label: string): void {
  if (value.trim().length === 0) {
    throw new Error(`Phase 6 ${label} is required`);
  }
}

function assertNoSecretKeys(value: unknown): void {
  const path: string[] = [];
  visitObject(value, path, (key) => {
    if (/secret|password|token|credential|apiKey/i.test(key)) {
      throw new Error(`Phase 6 runtime payload must not include ${key}`);
    }
  });
}

function visitObject(
  value: unknown,
  path: string[],
  visitKey: (key: string, path: readonly string[]) => void,
): void {
  if (value === null || typeof value !== "object") {
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => visitObject(item, [...path, String(index)], visitKey));
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    visitKey(key, path);
    visitObject(child, [...path, key], visitKey);
  }
}

function sameJson(left: unknown, right: unknown): boolean {
  return canonicalJson(left) === canonicalJson(right);
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(sortJson(value));
}

function sortJson(value: unknown): unknown {
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(sortJson);
  }
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, sortJson(child)]),
  );
}

function formatNow(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}
