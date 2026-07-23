import type {
  Phase6CompleteRunWithReceiptRuntimeInput,
  Phase6ExperimentRuntime,
  Phase6ResultReceiptV2,
} from "./phase6ExperimentRuntime.ts";
import type {
  Phase6JourneyContextRuntimeCaptureStartResult,
  Phase6JourneyContextRuntimeFinalizeResult,
} from "./phase6JourneyContextRuntime.ts";
import type {
  Phase6BeginExperimentInput,
  Phase6BeginExperimentOutput,
  Phase6BeginRunInput,
  Phase6BeginRunOutput,
  Phase6ExperimentStatusInput,
  Phase6ExperimentStatusOutput,
  Phase6ExplorerBinding,
} from "./phase6ExperimentMcpContractRules.ts";
import type {
  Phase6Experiment,
  Phase6IdentityBinding,
  Phase6Run,
  Phase6RunIndex,
  Phase6RunReceiptRef,
  Phase6ScenarioMatrixVersion,
  Phase6SeedBinding,
  Phase6VersionBinding,
} from "./phase6ExperimentRules.ts";
import type { Phase6CanonicalCursor } from "./phase6ProjectionDeltaRules.ts";
import type {
  Phase6McpJourneyCompletionContextInput,
  Phase6McpJourneyStartContextInput,
} from "./phase6McpJourneyContextAdapter.ts";

export const PHASE6_MCP_SETTLEMENT_RUNTIME_VERSION =
  "obsidian-epoch-phase6-mcp-settlement-runtime-v0.1.0" as const;

type MaybePromise<T> = T | Promise<T>;

export interface Phase6McpSettlementJourneyContextRuntime {
  captureStart(input: {
    readonly journeyId: string;
    readonly runId: string;
    readonly identity: Phase6IdentityBinding;
    readonly canonicalCursor: Phase6CanonicalCursor;
    readonly context: Phase6McpJourneyStartContextInput;
    readonly scenarioMatrix: Phase6ScenarioMatrixVersion;
    readonly createdAt?: string;
  }): MaybePromise<Phase6JourneyContextRuntimeCaptureStartResult>;
  finalize(input: {
    readonly journeyId: string;
    readonly completion: Phase6McpJourneyCompletionContextInput;
  }): MaybePromise<Phase6JourneyContextRuntimeFinalizeResult>;
}

export interface Phase6McpSettlementRuntimeOptions {
  readonly experimentRuntime: Phase6ExperimentRuntime;
  readonly journeyContextRuntime: Phase6McpSettlementJourneyContextRuntime;
  readonly loadRunBindingByJourneyId?: (
    journeyId: string,
  ) => MaybePromise<Phase6McpSettlementRunBinding | undefined>;
  readonly issueExperimentId: (
    input: Phase6BeginExperimentInput,
  ) => MaybePromise<string>;
  readonly issueSeed: (
    input: Phase6BeginRunInput & {
      readonly identity: Phase6IdentityBinding;
      readonly versions: Phase6VersionBinding;
      readonly scenarioMatrix: Phase6ScenarioMatrixVersion;
    },
  ) => MaybePromise<string | Phase6SeedBinding>;
  readonly serverVersions: Phase6VersionBinding;
  readonly scenarioMatrix: Phase6ScenarioMatrixVersion;
}

export interface Phase6McpSettlementRunBinding {
  readonly bindingVersion: typeof PHASE6_MCP_SETTLEMENT_RUNTIME_VERSION;
  readonly experimentId: string;
  readonly runId: string;
  readonly journeyId: string;
  readonly runIndex: Phase6RunIndex;
  readonly scenarioTag: string;
  readonly identity: Phase6IdentityBinding;
  readonly explorer: Phase6ExplorerBinding;
  readonly scenarioMatrix: Phase6ScenarioMatrixVersion;
  readonly versions: Phase6VersionBinding;
  readonly seed: Phase6SeedBinding;
  readonly runReceipt: Phase6RunReceiptRef;
}

export type Phase6McpSettlementBeginRunOutput = Phase6BeginRunOutput & {
  readonly binding: Phase6McpSettlementRunBinding;
};

export type Phase6McpSettlementErrorCode =
  | "invalid_input"
  | "not_found"
  | "conflict"
  | "runtime_error";

export interface Phase6McpSettlementError {
  readonly code: Phase6McpSettlementErrorCode;
  readonly message: string;
  readonly path?: string;
}

export interface Phase6McpSettlementFailure {
  readonly ok: false;
  readonly runtimeVersion: typeof PHASE6_MCP_SETTLEMENT_RUNTIME_VERSION;
  readonly status: "failed";
  readonly error: Phase6McpSettlementError;
}

export interface Phase6McpSettlementSuccess<T> {
  readonly ok: true;
  readonly runtimeVersion: typeof PHASE6_MCP_SETTLEMENT_RUNTIME_VERSION;
  readonly status: "ok";
  readonly value: T;
}

export type Phase6McpSettlementResult<T> =
  | Phase6McpSettlementSuccess<T>
  | Phase6McpSettlementFailure;

export interface Phase6McpSettlementCaptureContext {
  readonly canonicalCursor: Phase6CanonicalCursor;
  readonly context?: Phase6McpJourneyStartContextInput;
  readonly createdAt?: string;
}

export type Phase6McpSettlementCaptureInput =
  | Phase6McpJourneyStartContextInput
  | Phase6McpSettlementCaptureContext;

export interface Phase6McpSettlementCapturedJourney {
  readonly journeyId: string;
  readonly binding: Phase6McpSettlementRunBinding;
  readonly capture: Phase6JourneyContextRuntimeCaptureStartResult;
}

export interface Phase6McpSettlementFinalizedJourney {
  readonly journeyId: string;
  readonly binding: Phase6McpSettlementRunBinding;
  readonly finalize: Phase6JourneyContextRuntimeFinalizeResult;
  readonly experimentRun: Phase6Run;
  readonly receipt?: Phase6ResultReceiptV2;
}

export type Phase6McpSettlementRuntimeCommand =
  | "beginExperiment"
  | "beginRun"
  | "captureJourneyStart"
  | "finalizeJourney";

interface CommandRecord<T> {
  readonly command: Phase6McpSettlementRuntimeCommand;
  readonly payloadHash: string;
  readonly result: Phase6McpSettlementResult<T>;
}

interface ExperimentBinding {
  readonly experimentId: string;
  readonly identity: Phase6IdentityBinding;
  readonly explorer: Phase6ExplorerBinding;
}

export interface Phase6McpSettlementRuntime {
  beginExperiment(
    input: Phase6BeginExperimentInput,
  ): Promise<Phase6McpSettlementResult<Phase6BeginExperimentOutput>>;
  beginRun(
    input: Phase6BeginRunInput,
  ): Promise<Phase6McpSettlementResult<Phase6McpSettlementBeginRunOutput>>;
  captureJourneyStart(
    binding: Phase6McpSettlementRunBinding,
    context: Phase6McpSettlementCaptureInput,
  ): Promise<Phase6McpSettlementResult<Phase6McpSettlementCapturedJourney>>;
  finalizeJourney(
    journeyId: string,
    completion: Phase6McpJourneyCompletionContextInput,
  ): Promise<Phase6McpSettlementResult<Phase6McpSettlementFinalizedJourney>>;
  status(
    input: Phase6ExperimentStatusInput,
  ): Promise<Phase6McpSettlementResult<Phase6ExperimentStatusOutput>>;
}

export function createPhase6McpSettlementRuntime(
  options: Phase6McpSettlementRuntimeOptions,
): Phase6McpSettlementRuntime {
  const commandRecords = new Map<string, CommandRecord<unknown>>();
  const experiments = new Map<string, ExperimentBinding>();
  const runs = new Map<string, Phase6McpSettlementRunBinding>();
  const journeys = new Map<string, Phase6McpSettlementRunBinding>();

  async function beginExperiment(
    input: Phase6BeginExperimentInput,
  ): Promise<Phase6McpSettlementResult<Phase6BeginExperimentOutput>> {
    return command(input.commandId, "beginExperiment", input, async () => {
      assertText(input.commandId, "commandId");
      assertIdentity(input.identity);
      assertExplorer(input.explorer);

      const experimentId = assertIssuedText(
        await options.issueExperimentId(input),
        "experimentId",
      );

      const experiment = await options.experimentRuntime.createExperiment({
        commandId: input.commandId,
        experimentId,
        identity: input.identity,
        explorer: input.explorer,
        scenarioMatrix: options.scenarioMatrix,
        versions: options.serverVersions,
      });

      experiments.set(experiment.experimentId, {
        experimentId: experiment.experimentId,
        identity: experiment.identity,
        explorer: input.explorer,
      });

      return {
        experimentId: experiment.experimentId,
        state: "planned",
        identity: experiment.identity,
        explorer: input.explorer,
        scenarioMatrix: experiment.scenarioMatrix,
        versions: experiment.versions,
      };
    });
  }

  async function beginRun(
    input: Phase6BeginRunInput,
  ): Promise<Phase6McpSettlementResult<Phase6McpSettlementBeginRunOutput>> {
    if (!input.commandId) throw settlementError("invalid_input", "Phase 6 commandId is required", "commandId");
    if (input.runIndex === undefined) throw settlementError("invalid_input", "Phase 6 runIndex is required", "runIndex");
    if (!input.scenarioTag) throw settlementError("invalid_input", "Phase 6 scenarioTag is required", "scenarioTag");
    const commandId: string = input.commandId;
    const runIndex: number = input.runIndex;
    const scenarioTag: string = input.scenarioTag;
    return command(commandId, "beginRun", input, async () => {
      assertText(commandId, "commandId");
      assertText(input.experimentId, "experimentId");
      assertRunIndex(runIndex);
      assertText(scenarioTag, "scenarioTag");

      const experiment = await requireExperiment(input.experimentId);
      const experimentBinding = requireExperimentBinding(experiment);
      const seed = normalizeSeed(
        await options.issueSeed({
          ...input,
          commandId,
          runIndex: runIndex as Phase6RunIndex,
          scenarioTag,
          identity: experiment.identity,
          versions: experiment.versions,
          scenarioMatrix: experiment.scenarioMatrix,
        }),
      );
      const runId = stableRunId(input.experimentId, runIndex);
      const runReceipt = stableRunReceipt(input.experimentId, runIndex);
      const run = await options.experimentRuntime.startRun({
        commandId,
        experimentId: input.experimentId,
        run: {
          runIndex: runIndex as Phase6RunIndex,
          identity: experiment.identity,
          explorer: experimentBinding.explorer,
          scenarioMatrix: experiment.scenarioMatrix,
          versions: experiment.versions,
          seed,
          runReceipt,
        },
      });

      const binding: Phase6McpSettlementRunBinding = {
        bindingVersion: PHASE6_MCP_SETTLEMENT_RUNTIME_VERSION,
        experimentId: input.experimentId,
        runId,
        journeyId: runId,
        runIndex: runIndex as Phase6RunIndex,
        scenarioTag,
        identity: run.identity,
        explorer: experimentBinding.explorer,
        scenarioMatrix: run.scenarioMatrix,
        versions: run.versions,
        seed: run.seed,
        runReceipt: run.runReceipt,
      };
      rememberRun(binding);

      return {
        experimentId: input.experimentId,
        runIndex: runIndex as Phase6RunIndex,
        scenarioTag,
        state: "running",
        identity: run.identity,
        explorer: experimentBinding.explorer,
        scenarioMatrix: run.scenarioMatrix,
        versions: run.versions,
        seed: run.seed,
        runReceipt: run.runReceipt,
        journeyId: runId,
        runId,
        expectedVersion: 1,
        startJourneyBinding: binding as unknown as Readonly<Record<string, unknown>>,
        binding,
      };
    });
  }

  async function captureJourneyStart(
    binding: Phase6McpSettlementRunBinding,
    context: Phase6McpSettlementCaptureInput,
  ): Promise<Phase6McpSettlementResult<Phase6McpSettlementCapturedJourney>> {
    return command(
      binding?.journeyId,
      "captureJourneyStart",
      { binding, context },
      async () => {
        assertRegisteredBinding(binding);
        assertBindingWasIssued(binding, runs);
        const capture = normalizeCaptureContext(context);
        const experiment = await requireExperiment(binding.experimentId);
        assertRunMatchesBinding(requireRun(experiment, binding.runIndex), binding);

        const result = await options.journeyContextRuntime.captureStart({
          journeyId: binding.journeyId,
          runId: binding.runId,
          identity: binding.identity,
          canonicalCursor: capture.canonicalCursor,
          context: capture.context,
          scenarioMatrix: binding.scenarioMatrix,
          createdAt: capture.createdAt,
        });
        if (result.ok) journeys.set(binding.journeyId, binding);

        return {
          journeyId: binding.journeyId,
          binding,
          capture: result,
        };
      },
    );
  }

  async function finalizeJourney(
    journeyId: string,
    completion: Phase6McpJourneyCompletionContextInput,
  ): Promise<Phase6McpSettlementResult<Phase6McpSettlementFinalizedJourney>> {
    return command(journeyId, "finalizeJourney", { journeyId, completion }, async () => {
      assertText(journeyId, "journeyId");
      const binding = journeys.get(journeyId)
        ?? runs.get(journeyId)
        ?? await options.loadRunBindingByJourneyId?.(journeyId);
      if (binding === undefined) {
        throw settlementError("not_found", `Phase 6 journey ${journeyId} is not captured`, "journeyId");
      }
      rememberRun(binding);

      const experiment = await requireExperiment(binding.experimentId);
      assertRunMatchesBinding(requireRun(experiment, binding.runIndex), binding);

      const finalized = await options.journeyContextRuntime.finalize({
        journeyId,
        completion,
      });

      assertFinalizeContextMatchesBinding(finalized, binding);

      if (finalized.ok) {
        const receipt = resultReceiptFromFinalize(finalized, binding);
        const experimentRun = await options.experimentRuntime.completeRunWithReceipt(
          completeCommandInput(journeyId, binding, receipt),
        );
        return {
          journeyId,
          binding,
          finalize: finalized,
          experimentRun,
          receipt,
        };
      }

      const failedRun = await options.experimentRuntime.failRun({
        commandId: stableFailureCommandId(journeyId, finalized.status),
        experimentId: binding.experimentId,
        runIndex: binding.runIndex,
        reason: finalizeFailureReason(finalized),
      });

      return {
        journeyId,
        binding,
        finalize: finalized,
        experimentRun: failedRun,
      };
    });
  }

  async function status(
    input: Phase6ExperimentStatusInput,
  ): Promise<Phase6McpSettlementResult<Phase6ExperimentStatusOutput>> {
    try {
      assertText(input.experimentId, "experimentId");
      const experiment = await requireExperiment(input.experimentId);
      const binding = requireExperimentBinding(experiment);
      return success({
        experimentId: experiment.experimentId,
        state: experiment.state,
        identity: experiment.identity,
        explorer: binding.explorer,
        scenarioMatrix: experiment.scenarioMatrix,
        versions: experiment.versions,
        runs: experiment.runs.map((run) => ({
          runIndex: run.runIndex,
          state: run.state,
          receipt: run.resultReceipt ?? run.runReceipt,
        })),
      });
    } catch (error) {
      return failure(error);
    }
  }

  async function command<T>(
    commandId: string,
    commandName: Phase6McpSettlementRuntimeCommand,
    payload: unknown,
    execute: () => MaybePromise<T>,
  ): Promise<Phase6McpSettlementResult<T>> {
    try {
      assertText(commandId, "commandId");
      const payloadHash = canonicalJson(payload);
      const existing = commandRecords.get(commandId);
      if (existing !== undefined) {
        if (existing.command !== commandName || existing.payloadHash !== payloadHash) {
          return failure(
            settlementError(
              "conflict",
              `Phase 6 MCP settlement command ${commandId} was already used for a different payload`,
              "commandId",
            ),
          );
        }
        return existing.result as Phase6McpSettlementResult<T>;
      }

      const result = success(await execute());
      commandRecords.set(commandId, {
        command: commandName,
        payloadHash,
        result,
      });
      return result;
    } catch (error) {
      const result = failure(error);
      if (isText(commandId)) {
        commandRecords.set(commandId, {
          command: commandName,
          payloadHash: canonicalJson(payload),
          result,
        });
      }
      return result;
    }
  }

  async function requireExperiment(experimentId: string): Promise<Phase6Experiment> {
    const experiment = await options.experimentRuntime.load({ experimentId });
    if (experiment === undefined) {
      throw settlementError("not_found", `Phase 6 experiment ${experimentId} is not registered`, "experimentId");
    }
    if (!sameValue(experiment.scenarioMatrix, options.scenarioMatrix)) {
      throw settlementError("conflict", "Phase 6 experiment scenario matrix does not match this settlement runtime");
    }
    if (!sameValue(experiment.versions, options.serverVersions)) {
      throw settlementError("conflict", "Phase 6 experiment versions do not match this settlement runtime");
    }
    return experiment;
  }

  function requireExperimentBinding(experiment: Phase6Experiment): ExperimentBinding {
    const binding = experiments.get(experiment.experimentId);
    if (binding === undefined) {
      throw settlementError(
        "not_found",
        `Phase 6 experiment ${experiment.experimentId} was not begun by this settlement runtime`,
        "experimentId",
      );
    }
    if (!sameValue(binding.identity, experiment.identity)) {
      throw settlementError("conflict", "Phase 6 experiment identity binding changed");
    }
    return binding;
  }

  function rememberRun(binding: Phase6McpSettlementRunBinding): void {
    runs.set(runKey(binding.experimentId, binding.runIndex), binding);
    runs.set(binding.journeyId, binding);
  }

  return {
    beginExperiment,
    beginRun,
    captureJourneyStart,
    finalizeJourney,
    status,
  };
}

function completeCommandInput(
  journeyId: string,
  binding: Phase6McpSettlementRunBinding,
  receipt: Phase6ResultReceiptV2,
): Phase6CompleteRunWithReceiptRuntimeInput {
  return {
    commandId: stableCompleteCommandId(journeyId, receipt.receiptId),
    experimentId: binding.experimentId,
    runIndex: binding.runIndex,
    receipt,
  };
}

function resultReceiptFromFinalize(
  finalized: Phase6JourneyContextRuntimeFinalizeResult & { readonly ok: true },
  binding: Phase6McpSettlementRunBinding,
): Phase6ResultReceiptV2 {
  const receiptId = finalized.assembly.assembly.artifacts.receipt.receiptId;
  assertText(receiptId, "receiptId");
  return {
    receiptId,
    receiptVersion: "v2",
    experimentId: binding.experimentId,
    runIndex: binding.runIndex,
    identity: binding.identity,
    explorer: binding.explorer,
    versions: binding.versions,
    seed: binding.seed,
  };
}

function assertFinalizeContextMatchesBinding(
  finalized: Phase6JourneyContextRuntimeFinalizeResult,
  binding: Phase6McpSettlementRunBinding,
): void {
  const metadata = finalized.context.metadata;
  if (metadata.journeyId !== binding.journeyId) {
    throw settlementError("conflict", "Phase 6 finalized journeyId does not match the registered run binding");
  }
  if (metadata.experimentId !== binding.experimentId || metadata.runId !== binding.runId || metadata.runIndex !== binding.runIndex) {
    throw settlementError("conflict", "Phase 6 finalized run identity does not match the registered run binding");
  }
  if (!sameValue(metadata.identity, binding.identity)) {
    throw settlementError("conflict", "Phase 6 finalized identity does not match the registered run binding");
  }
  if (!sameValue(metadata.versions, binding.versions)) {
    throw settlementError("conflict", "Phase 6 finalized versions do not match the registered run binding");
  }
  if (!sameValue(metadata.seed, binding.seed)) {
    throw settlementError("conflict", "Phase 6 finalized seed does not match the registered run binding");
  }
}

function assertRunMatchesBinding(run: Phase6Run, binding: Phase6McpSettlementRunBinding): void {
  if (run.runIndex !== binding.runIndex) {
    throw settlementError("conflict", "Phase 6 runIndex does not match binding");
  }
  if (!sameValue(run.identity, binding.identity)) {
    throw settlementError("conflict", "Phase 6 run identity does not match binding");
  }
  if (!sameValue(run.versions, binding.versions)) {
    throw settlementError("conflict", "Phase 6 run versions do not match binding");
  }
  if (!sameValue(run.seed, binding.seed)) {
    throw settlementError("conflict", "Phase 6 run seed does not match binding");
  }
  if (!sameValue(run.runReceipt, binding.runReceipt)) {
    throw settlementError("conflict", "Phase 6 run receipt does not match binding");
  }
}

function assertRegisteredBinding(binding: Phase6McpSettlementRunBinding): void {
  if (!binding || binding.bindingVersion !== PHASE6_MCP_SETTLEMENT_RUNTIME_VERSION) {
    throw settlementError("invalid_input", "Phase 6 MCP settlement run binding is required", "binding");
  }
}

function assertBindingWasIssued(
  binding: Phase6McpSettlementRunBinding,
  runs: ReadonlyMap<string, Phase6McpSettlementRunBinding>,
): void {
  const issued = runs.get(runKey(binding.experimentId, binding.runIndex));
  if (issued === undefined) {
    throw settlementError("not_found", "Phase 6 MCP settlement run binding was not issued by this runtime", "binding");
  }
  if (!sameValue(issued, binding)) {
    throw settlementError("conflict", "Phase 6 MCP settlement run binding does not match the issued binding", "binding");
  }
}

function requireRun(experiment: Phase6Experiment, runIndex: Phase6RunIndex): Phase6Run {
  const run = experiment.runs.find((candidate) => candidate.runIndex === runIndex);
  if (run === undefined) {
    throw settlementError("not_found", `Phase 6 runIndex ${runIndex} is not registered`, "runIndex");
  }
  return run;
}

function normalizeCaptureContext(input: Phase6McpSettlementCaptureInput): {
  readonly canonicalCursor: Phase6CanonicalCursor;
  readonly context: Phase6McpJourneyStartContextInput;
  readonly createdAt?: string;
} {
  const candidate = input as Phase6McpSettlementCaptureContext;
  if (candidate.context !== undefined) {
    assertCanonicalCursor(candidate.canonicalCursor);
    return {
      canonicalCursor: candidate.canonicalCursor,
      context: candidate.context,
      createdAt: candidate.createdAt,
    };
  }

  const direct = input as Phase6McpJourneyStartContextInput & {
    readonly canonicalCursor?: Phase6CanonicalCursor;
    readonly createdAt?: string;
  };
  assertCanonicalCursor(direct.canonicalCursor);
  return {
    canonicalCursor: direct.canonicalCursor,
    context: direct,
    createdAt: direct.createdAt,
  };
}

function normalizeSeed(value: string | Phase6SeedBinding): Phase6SeedBinding {
  const seed = typeof value === "string" ? value : value.seed;
  assertText(seed, "seed");
  return { seed };
}

function stableRunId(experimentId: string, runIndex: Phase6RunIndex): string {
  return `${experimentId}:run:${runIndex}`;
}

function stableRunReceipt(experimentId: string, runIndex: Phase6RunIndex): Phase6RunReceiptRef {
  return {
    receiptId: `${stableRunId(experimentId, runIndex)}:receipt:v1`,
    receiptVersion: "v1",
  };
}

function stableCompleteCommandId(journeyId: string, receiptId: string): string {
  return `phase6-mcp-settlement:${journeyId}:complete:${receiptId}`;
}

function stableFailureCommandId(journeyId: string, status: string): string {
  return `phase6-mcp-settlement:${journeyId}:fail:${status}`;
}

function runKey(experimentId: string, runIndex: Phase6RunIndex): string {
  return `${experimentId}:${runIndex}`;
}

function finalizeFailureReason(finalized: Phase6JourneyContextRuntimeFinalizeResult): string {
  if (finalized.ok) return "Phase 6 journey finalized successfully";
  if (finalized.status === "adapter_failed") {
    return "Phase 6 journey settlement adapter failed";
  }
  if (finalized.status === "receipt_conflict") {
    return `Phase 6 journey receipt conflict: ${finalized.conflict.message}`;
  }
  return `Phase 6 journey settlement failed: ${finalized.status}`;
}

function assertIdentity(identity: Phase6IdentityBinding): void {
  assertText(identity.identityId, "identity.identityId");
  if (identity.cohortId !== undefined) assertText(identity.cohortId, "identity.cohortId");
}

function assertExplorer(explorer: Phase6ExplorerBinding): void {
  assertText(explorer.explorerId, "explorer.explorerId");
  if (explorer.displayName !== undefined) assertText(explorer.displayName, "explorer.displayName");
}

function assertRunIndex(value: number): asserts value is Phase6RunIndex {
  if (!Number.isInteger(value) || value < 1 || value > 10) {
    throw settlementError("invalid_input", "Phase 6 runIndex must be an integer from 1 to 10", "runIndex");
  }
}

function assertCanonicalCursor(value: unknown): asserts value is Phase6CanonicalCursor {
  const cursor = value as Phase6CanonicalCursor | undefined;
  if (
    cursor?.kind !== "phase6_canonical_cursor" ||
    !Number.isSafeInteger(cursor.eventCount) ||
    typeof cursor.eventIdsHash !== "string" ||
    typeof cursor.value !== "string"
  ) {
    throw settlementError("invalid_input", "Phase 6 canonical cursor is required", "canonicalCursor");
  }
}

function assertIssuedText(value: string, path: string): string {
  assertText(value, path);
  return value.trim();
}

function assertText(value: unknown, path: string): asserts value is string {
  if (!isText(value)) {
    throw settlementError("invalid_input", `Phase 6 ${path} is required`, path);
  }
}

function isText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function success<T>(value: T): Phase6McpSettlementSuccess<T> {
  return {
    ok: true,
    runtimeVersion: PHASE6_MCP_SETTLEMENT_RUNTIME_VERSION,
    status: "ok",
    value,
  };
}

function failure(error: unknown): Phase6McpSettlementFailure {
  if (isSettlementError(error)) {
    return {
      ok: false,
      runtimeVersion: PHASE6_MCP_SETTLEMENT_RUNTIME_VERSION,
      status: "failed",
      error,
    };
  }
  return {
    ok: false,
    runtimeVersion: PHASE6_MCP_SETTLEMENT_RUNTIME_VERSION,
    status: "failed",
    error: {
      code: "runtime_error",
      message: error instanceof Error ? error.message : "Phase 6 MCP settlement runtime failed",
    },
  };
}

function settlementError(
  code: Phase6McpSettlementErrorCode,
  message: string,
  path?: string,
): Phase6McpSettlementError {
  return path === undefined ? { code, message } : { code, message, path };
}

function isSettlementError(error: unknown): error is Phase6McpSettlementError {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      "message" in error,
  );
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .filter((key) => record[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function sameValue(left: unknown, right: unknown): boolean {
  return canonicalJson(left) === canonicalJson(right);
}
