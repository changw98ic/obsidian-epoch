import {
  assemblePhase6Run,
  type Phase6RunAssemblyDependencies,
  type Phase6RunAssemblyFailure,
  type Phase6RunAssemblyFinding,
  type Phase6RunAssemblyInput,
  type Phase6RunAssemblySuccess,
} from "./phase6RunAssembly.ts";
import { buildPhase6PanelSnapshotDocument } from "./phase6PanelSnapshotAdapter.ts";
import { buildPhase6MachineReadableResultPage } from "./phase6ResultPageRules.ts";
import {
  createJourneySettlementRuntime,
  JourneySettlementConflictError,
  type JourneyRunReceiptRepositoryAdapter,
  type SettleJourneyRunReceiptResult,
} from "./journeySettlementRuntime.ts";
import type { BuildJourneyRunReceiptInput, JourneyRunReceipt } from "./journeyRunReceiptRules.ts";

export const PHASE6_RUN_ASSEMBLY_RUNTIME_VERSION = "obsidian-epoch-phase6-run-assembly-runtime-v0.1.0" as const;

export type Phase6RunAssemblyRuntimeConflictCode = "PHASE6_RUN_ASSEMBLY_RECEIPT_CONFLICT";

export interface Phase6RunAssemblyRuntimeConflict {
  readonly code: Phase6RunAssemblyRuntimeConflictCode;
  readonly message: string;
  readonly receiptId: string;
}

export interface Phase6RunAssemblyRuntimeOptions {
  readonly repository: JourneyRunReceiptRepositoryAdapter;
  readonly now?: () => string;
  readonly dependencies?: Phase6RunAssemblyDependencies;
}

export type Phase6RunAssemblyRuntimeReceiptInput = Phase6RunAssemblyInput["receipt"];

export type Phase6RunAssemblyRuntimeInput =
  Omit<Phase6RunAssemblyInput, "receipt"> & {
    readonly receipt: Phase6RunAssemblyRuntimeReceiptInput;
  };

export interface Phase6RunAssemblyRuntimeSettledSuccess {
  readonly ok: true;
  readonly status: "settled" | "duplicate";
  readonly runtimeVersion: typeof PHASE6_RUN_ASSEMBLY_RUNTIME_VERSION;
  readonly assembly: Phase6RunAssemblySuccess;
  readonly settlement: SettleJourneyRunReceiptResult;
}

export interface Phase6RunAssemblyRuntimeAssemblyFailure {
  readonly ok: false;
  readonly status: "assembly_failed";
  readonly runtimeVersion: typeof PHASE6_RUN_ASSEMBLY_RUNTIME_VERSION;
  readonly findings: readonly Phase6RunAssemblyFinding[];
  readonly assembly: Phase6RunAssemblyFailure;
}

export interface Phase6RunAssemblyRuntimeConflictFailure {
  readonly ok: false;
  readonly status: "conflict";
  readonly runtimeVersion: typeof PHASE6_RUN_ASSEMBLY_RUNTIME_VERSION;
  readonly conflict: Phase6RunAssemblyRuntimeConflict;
  readonly findings: readonly [];
  readonly assembly: Phase6RunAssemblySuccess;
}

export type Phase6RunAssemblyRuntimeSettleResult =
  | Phase6RunAssemblyRuntimeSettledSuccess
  | Phase6RunAssemblyRuntimeAssemblyFailure
  | Phase6RunAssemblyRuntimeConflictFailure;

function runtimeNow(now?: () => string): () => string {
  return now ?? (() => new Date().toISOString());
}

function assemblyDependencies(
  overrides?: Phase6RunAssemblyDependencies,
): Phase6RunAssemblyDependencies {
  return {
    buildPanelSnapshot: buildPhase6PanelSnapshotDocument,
    buildResultPage: buildPhase6MachineReadableResultPage,
    ...overrides,
  };
}

function settlePayload(
  input: Phase6RunAssemblyInput,
): Omit<BuildJourneyRunReceiptInput, "receiptId" | "generatedAt"> {
  return {
    runId: input.runId,
    journeyId: input.journeyId,
    agentId: input.receipt.agentId,
    explorerId: input.receipt.explorerId,
    experimentId: input.receipt.experimentId,
    runIndex: input.receipt.runIndex,
    seed: input.receipt.seed,
    rulesetVersion: input.receipt.rulesetVersion,
    catalogVersion: input.receipt.catalogVersion,
    codeVersion: input.receipt.codeVersion,
    scenarioMatrixVersion: input.receipt.scenarioMatrixVersion,
    startedAt: input.receipt.startedAt,
    settledAt: input.receipt.settledAt,
    world: input.receipt.world,
    snapshots: input.receipt.snapshots,
    deltas: input.receipt.deltas,
    score: input.receipt.score,
    suitability: input.receipt.suitability,
    rag: input.receipt.rag,
    eventIds: input.receipt.eventIds,
    outcome: input.receipt.outcome,
  };
}

function conflictResult(
  error: JourneySettlementConflictError,
  assembly: Phase6RunAssemblySuccess,
): Phase6RunAssemblyRuntimeConflictFailure {
  return {
    ok: false,
    status: "conflict",
    runtimeVersion: PHASE6_RUN_ASSEMBLY_RUNTIME_VERSION,
    conflict: {
      code: "PHASE6_RUN_ASSEMBLY_RECEIPT_CONFLICT",
      message: error.message,
      receiptId: error.receiptId,
    },
    findings: [],
    assembly,
  };
}

export function createPhase6RunAssemblyRuntime(options: Phase6RunAssemblyRuntimeOptions) {
  const now = runtimeNow(options.now);
  const dependencies = assemblyDependencies(options.dependencies);
  const loader = createJourneySettlementRuntime({
    repository: options.repository,
    now,
  });

  async function assembleAndSettle(
    input: Phase6RunAssemblyRuntimeInput,
  ): Promise<Phase6RunAssemblyRuntimeSettleResult> {
    const assemblyInput = input;
    const assembly = assemblePhase6Run(assemblyInput, dependencies);
    if (!assembly.ok) {
      return {
        ok: false,
        status: "assembly_failed",
        runtimeVersion: PHASE6_RUN_ASSEMBLY_RUNTIME_VERSION,
        findings: assembly.findings,
        assembly,
      };
    }

    const settlementRuntime = createJourneySettlementRuntime({
      repository: options.repository,
      now: () => assemblyInput.receipt.generatedAt,
    });

    try {
      const settlement = await settlementRuntime.settle({
        receiptId: assembly.artifacts.receipt.receiptId,
        payload: settlePayload(assemblyInput),
      });
      return {
        ok: true,
        status: settlement.duplicate ? "duplicate" : "settled",
        runtimeVersion: PHASE6_RUN_ASSEMBLY_RUNTIME_VERSION,
        assembly,
        settlement,
      };
    } catch (error) {
      if (error instanceof JourneySettlementConflictError) return conflictResult(error, assembly);
      throw error;
    }
  }

  async function loadReceipt(receiptId: string): Promise<JourneyRunReceipt | undefined> {
    return loader.load(receiptId);
  }

  return {
    assembleAndSettle,
    loadReceipt,
  };
}
