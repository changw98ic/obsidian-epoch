import {
  capturePhase6JourneyStartContext,
  type Phase6McpJourneyCompletionContextInput,
  type Phase6McpJourneyContextAdapterResult,
  type Phase6McpJourneyStartContextInput,
} from "./phase6McpJourneyContextAdapter.ts";
import type {
  Phase6JourneyContextRecord,
  Phase6JourneyContextSqliteStore,
} from "./phase6JourneyContextStore.ts";
import {
  adaptPhase6JourneySettlementInput,
  type Phase6JourneySettlementAdapterResult,
  type Phase6JourneySettlementAuthoritativeInputs,
} from "./phase6JourneySettlementAdapter.ts";
import type {
  Phase6IdentityBinding,
  Phase6RunIndex,
  Phase6ScenarioMatrixVersion,
} from "./phase6ExperimentRules.ts";
import type { Phase6CanonicalCursor } from "./phase6ProjectionDeltaRules.ts";
import type {
  Phase6PanelSnapshotAdapterInput,
  Phase6PanelSnapshotEconomyProjection,
  Phase6PanelSnapshotPlayerProjection,
} from "./phase6PanelSnapshotAdapter.ts";
import type {
  Phase6RunAssemblyRuntimeInput,
  Phase6RunAssemblyRuntimeSettleResult,
} from "./phase6RunAssemblyRuntime.ts";
import type { JourneyRunReceipt } from "./journeyRunReceiptRules.ts";

export const PHASE6_JOURNEY_CONTEXT_RUNTIME_VERSION =
  "obsidian-epoch-phase6-journey-context-runtime-v0.2.0" as const;

export interface Phase6JourneyContextRunAssemblyRuntime {
  assembleAndSettle(
    input: Phase6RunAssemblyRuntimeInput,
  ): Promise<Phase6RunAssemblyRuntimeSettleResult>;
  loadReceipt(receiptId: string): Promise<JourneyRunReceipt | undefined>;
}

export interface Phase6JourneyContextRuntimeOptions {
  readonly contextStore: Phase6JourneyContextSqliteStore;
  readonly runAssemblyRuntime: Phase6JourneyContextRunAssemblyRuntime;
}

export interface Phase6JourneyContextRuntimeCaptureStartInput {
  readonly journeyId: string;
  readonly runId: string;
  readonly identity: Phase6IdentityBinding;
  readonly canonicalCursor: Phase6CanonicalCursor;
  readonly context: Phase6McpJourneyStartContextInput;
  readonly scenarioMatrix: Phase6ScenarioMatrixVersion;
  readonly createdAt?: string;
}

export interface Phase6JourneyContextRuntimeCapturedStart {
  readonly ok: true;
  readonly status: "captured";
  readonly runtimeVersion: typeof PHASE6_JOURNEY_CONTEXT_RUNTIME_VERSION;
  readonly context: Phase6JourneyContextRecord;
}

export interface Phase6JourneyContextRuntimeStartAdapterFailure {
  readonly ok: false;
  readonly status: "adapter_failed";
  readonly runtimeVersion: typeof PHASE6_JOURNEY_CONTEXT_RUNTIME_VERSION;
  readonly adapter: Phase6McpJourneyContextAdapterResult<unknown>;
}

export type Phase6JourneyContextRuntimeCaptureStartResult =
  | Phase6JourneyContextRuntimeCapturedStart
  | Phase6JourneyContextRuntimeStartAdapterFailure;

export interface Phase6JourneyContextRuntimeFinalizeInput {
  readonly journeyId: string;
  readonly completion: Phase6JourneyContextRuntimeCompletionInput;
}

export type Phase6JourneyContextRuntimeCompletionInput =
  | Phase6McpJourneyCompletionContextInput
  | Phase6JourneySettlementAuthoritativeInputs;

export interface Phase6JourneyContextRuntimeFinalized {
  readonly ok: true;
  readonly status: "settled" | "duplicate";
  readonly runtimeVersion: typeof PHASE6_JOURNEY_CONTEXT_RUNTIME_VERSION;
  readonly context: Phase6JourneyContextRecord;
  readonly assembly: Phase6RunAssemblyRuntimeSettleResult & { readonly ok: true };
}

export interface Phase6JourneyContextRuntimeFinalizeAdapterFailure {
  readonly ok: false;
  readonly status: "adapter_failed";
  readonly runtimeVersion: typeof PHASE6_JOURNEY_CONTEXT_RUNTIME_VERSION;
  readonly context: Phase6JourneyContextRecord;
  readonly adapter: Phase6JourneySettlementAdapterResult;
}

export interface Phase6JourneyContextRuntimeReceiptConflict {
  readonly ok: false;
  readonly status: "receipt_conflict";
  readonly runtimeVersion: typeof PHASE6_JOURNEY_CONTEXT_RUNTIME_VERSION;
  readonly context: Phase6JourneyContextRecord;
  readonly conflict: {
    readonly code: "PHASE6_JOURNEY_CONTEXT_RECEIPT_CONFLICT";
    readonly message: string;
    readonly settledReceiptId: string;
    readonly receiptId: string;
  };
}

export interface Phase6JourneyContextRuntimeAssemblyFailure {
  readonly ok: false;
  readonly status: "assembly_failed" | "conflict";
  readonly runtimeVersion: typeof PHASE6_JOURNEY_CONTEXT_RUNTIME_VERSION;
  readonly context: Phase6JourneyContextRecord;
  readonly assembly: Phase6RunAssemblyRuntimeSettleResult & { readonly ok: false };
}

export type Phase6JourneyContextRuntimeFinalizeResult =
  | Phase6JourneyContextRuntimeFinalized
  | Phase6JourneyContextRuntimeFinalizeAdapterFailure
  | Phase6JourneyContextRuntimeReceiptConflict
  | Phase6JourneyContextRuntimeAssemblyFailure;

type PublicBeforeProjection = Phase6JourneyContextRecord["beforeSnapshot"] & {
  readonly player?: Phase6PanelSnapshotPlayerProjection;
  readonly progress?: Phase6PanelSnapshotAdapterInput["progress"];
  readonly economy?: Phase6PanelSnapshotEconomyProjection & Phase6McpJourneyStartContextInput["economy"];
  readonly ragPanel?: Phase6PanelSnapshotAdapterInput["ragPanel"];
  readonly worldCursor?: Phase6PanelSnapshotAdapterInput["worldCursor"];
};

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isStrictAuthoritativeInput(
  value: Phase6JourneyContextRuntimeCompletionInput,
): value is Phase6JourneySettlementAuthoritativeInputs {
  return isRecord(value)
    && isRecord(value.beforePanel)
    && isRecord(value.projections)
    && isRecord(value.receipt);
}

function assertStoredBinding(
  path: string,
  stored: unknown,
  supplied: unknown,
): void {
  if (stored === supplied) return;
  throw new Error(`phase6_journey_context_binding_mismatch:${path}`);
}

function beforePanelFromStoredContext(record: Phase6JourneyContextRecord): Phase6PanelSnapshotAdapterInput {
  const before = record.beforeSnapshot as PublicBeforeProjection;
  return {
    phase: "before",
    player: before.player as Phase6PanelSnapshotAdapterInput["player"],
    progress: before.progress as Phase6PanelSnapshotAdapterInput["progress"],
    economy: before.economy as Phase6PanelSnapshotAdapterInput["economy"],
    ragPanel: before.ragPanel as Phase6PanelSnapshotAdapterInput["ragPanel"],
    worldCursor: before.worldCursor as Phase6PanelSnapshotAdapterInput["worldCursor"],
  };
}

function economyBeforeFromStoredContext(record: Phase6JourneyContextRecord) {
  const before = record.beforeSnapshot as PublicBeforeProjection;
  if (!before.economy?.snapshot) {
    throw new Error(`phase6_journey_context_economy_before_missing:${record.metadata.journeyId}`);
  }
  return before.economy.snapshot;
}

function missingContext(journeyId: string): never {
  throw new Error(`phase6_journey_context_missing:${journeyId}`);
}

function missingScenarioMatrixVersion(journeyId: string): never {
  throw new Error(`phase6_journey_context_scenario_matrix_version_missing:${journeyId}`);
}

function receiptConflict(
  context: Phase6JourneyContextRecord,
  receiptId: string,
): Phase6JourneyContextRuntimeReceiptConflict {
  return {
    ok: false,
    status: "receipt_conflict",
    runtimeVersion: PHASE6_JOURNEY_CONTEXT_RUNTIME_VERSION,
    context,
    conflict: {
      code: "PHASE6_JOURNEY_CONTEXT_RECEIPT_CONFLICT",
      message: "Phase 6 journey context is already settled with a different receipt",
      settledReceiptId: context.settledReceiptId as string,
      receiptId,
    },
  };
}

function finalizeInput(
  context: Phase6JourneyContextRecord,
  completion: Phase6McpJourneyCompletionContextInput,
): Phase6JourneySettlementAuthoritativeInputs {
  const scenarioMatrixVersion =
    context.metadata.scenarioMatrix?.version ?? missingScenarioMatrixVersion(context.metadata.journeyId);

  return {
    metadata: {
      ...completion.metadata,
      journeyId: context.metadata.journeyId,
      runId: context.metadata.runId,
      experimentId: context.metadata.experimentId,
      runIndex: context.metadata.runIndex,
      seed: context.metadata.seed.seed,
      rulesetVersion: context.metadata.versions.rulesVersion,
      catalogVersion: context.metadata.versions.catalogVersion,
      codeVersion: context.metadata.versions.codeVersion,
      scenarioMatrixVersion,
    },
    beforePanel: beforePanelFromStoredContext(context),
    afterPanel: completion.afterPanel,
    canonicalEvents: completion.canonicalEvents,
    economy: {
      previous: economyBeforeFromStoredContext(context),
      next: completion.economy.next,
      ...(completion.economy.flows ? { flows: completion.economy.flows } : {}),
      ...(completion.economy.sourceEvents ? { sourceEvents: completion.economy.sourceEvents } : {}),
    },
    projections: {
      before: context.beforeSnapshot,
      after: completion.afterProjection,
      ...(completion.now ? { now: completion.now } : {}),
    },
      receipt: completion.receipt,
      ...(completion.journeyRuntime ? { journeyRuntime: completion.journeyRuntime } : {}),
      ...(completion.actionResolutions ? { actionResolutions: completion.actionResolutions } : {}),
      ...(completion.storyReport ? { storyReport: completion.storyReport } : {}),
    };
  }

function authoritativeFinalizeInput(
  context: Phase6JourneyContextRecord,
  completion: Phase6JourneyContextRuntimeCompletionInput,
): Phase6JourneySettlementAuthoritativeInputs {
  if (!isStrictAuthoritativeInput(completion)) return finalizeInput(context, completion);

  const scenarioMatrixVersion =
    context.metadata.scenarioMatrix?.version ?? missingScenarioMatrixVersion(context.metadata.journeyId);
  assertStoredBinding("journeyId", context.metadata.journeyId, completion.metadata.journeyId);
  assertStoredBinding("experimentId", context.metadata.experimentId, completion.metadata.experimentId);
  assertStoredBinding("runId", context.metadata.runId, completion.metadata.runId);
  assertStoredBinding("runIndex", context.metadata.runIndex, completion.metadata.runIndex);
  assertStoredBinding("seed", context.metadata.seed.seed, completion.metadata.seed);
  assertStoredBinding("rulesVersion", context.metadata.versions.rulesVersion, completion.metadata.rulesetVersion);
  assertStoredBinding("catalogVersion", context.metadata.versions.catalogVersion, completion.metadata.catalogVersion);
  assertStoredBinding("codeVersion", context.metadata.versions.codeVersion, completion.metadata.codeVersion);
  assertStoredBinding("scenarioMatrixVersion", scenarioMatrixVersion, completion.metadata.scenarioMatrixVersion);
  return completion;
}

export function createPhase6JourneyContextRuntime(options: Phase6JourneyContextRuntimeOptions) {
  function captureStart(
    input: Phase6JourneyContextRuntimeCaptureStartInput,
  ): Phase6JourneyContextRuntimeCaptureStartResult {
    const captured = capturePhase6JourneyStartContext(input.context);
    if (!captured.ok) {
      return {
        ok: false,
        status: "adapter_failed",
        runtimeVersion: PHASE6_JOURNEY_CONTEXT_RUNTIME_VERSION,
        adapter: captured,
      };
    }

    const context = options.contextStore.capture({
      metadata: {
        journeyId: input.journeyId,
        experimentId: captured.value.experiment.experimentId,
        runId: input.runId,
        runIndex: captured.value.experiment.runIndex as Phase6RunIndex,
        identity: input.identity,
        versions: {
          rulesVersion: captured.value.version.rulesetVersion,
          catalogVersion: captured.value.version.catalogVersion,
          codeVersion: captured.value.version.codeVersion,
        },
        seed: {
          seed: captured.value.experiment.seed,
        },
        scenarioMatrix: input.scenarioMatrix,
      },
      beforeSnapshot: captured.value.beforeProjection,
      canonicalCursor: input.canonicalCursor,
      createdAt: input.createdAt,
    });

    return {
      ok: true,
      status: "captured",
      runtimeVersion: PHASE6_JOURNEY_CONTEXT_RUNTIME_VERSION,
      context,
    };
  }

  async function finalizeAndSettle(
    journeyId: string,
    completion: Phase6JourneyContextRuntimeCompletionInput,
  ): Promise<Phase6JourneyContextRuntimeFinalizeResult> {
    const context = options.contextStore.load(journeyId) ?? missingContext(journeyId);
    const authoritativeInput = authoritativeFinalizeInput(context, completion);
    const receiptId = authoritativeInput.metadata.receiptId.trim();

    if (context.settledReceiptId && context.settledReceiptId !== receiptId) {
      return receiptConflict(context, receiptId);
    }

    const adapter = adaptPhase6JourneySettlementInput(authoritativeInput);
    if (!adapter.ok) {
      return {
        ok: false,
        status: "adapter_failed",
        runtimeVersion: PHASE6_JOURNEY_CONTEXT_RUNTIME_VERSION,
        context,
        adapter,
      };
    }

    const assembly = await options.runAssemblyRuntime.assembleAndSettle(adapter.value);
    if (!assembly.ok) {
      return {
        ok: false,
        status: assembly.status,
        runtimeVersion: PHASE6_JOURNEY_CONTEXT_RUNTIME_VERSION,
        context,
        assembly,
      };
    }

    const settledContext = options.contextStore.markSettled(journeyId, receiptId);
    return {
      ok: true,
      status: assembly.status,
      runtimeVersion: PHASE6_JOURNEY_CONTEXT_RUNTIME_VERSION,
      context: settledContext,
      assembly,
    };
  }

  function loadContext(journeyId: string): Phase6JourneyContextRecord | undefined {
    return options.contextStore.load(journeyId);
  }

  function loadReceipt(receiptId: string): Promise<JourneyRunReceipt | undefined> {
    return options.runAssemblyRuntime.loadReceipt(receiptId);
  }

  return {
    captureStart,
    finalizeAndSettle,
    loadContext,
    loadReceipt,
  };
}
