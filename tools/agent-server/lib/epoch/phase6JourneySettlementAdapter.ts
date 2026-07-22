import type { EpochEvent } from "./events.ts";
import type { JourneyActionResolution } from "./journeyActionResolutionRules.ts";
import type { JourneyTickResult } from "./journeyRuntime.ts";
import type { GroundedJourneyStoryReport } from "./journeyStoryReport.ts";
import type {
  Phase6PanelSnapshotAdapterInput,
} from "./phase6PanelSnapshotAdapter.ts";
import type {
  Phase6EconomyResourceFlow,
  Phase6EconomySnapshot,
} from "./phase6EconomyAuditRules.ts";
import type {
  Phase6ProjectionForDelta,
} from "./phase6ProjectionDeltaRules.ts";
import {
  JOURNEY_RUN_SUITABILITY_DIMENSIONS,
  validateJourneyRunScore,
  type BuildJourneyRunReceiptInput,
  type JourneyRunRagGrounding,
  type JourneyRunScore,
  type JourneyRunStructuredDelta,
  type JourneyRunSuitability,
} from "./journeyRunReceiptRules.ts";
import type {
  Phase6RunAssemblyRuntimeInput,
} from "./phase6RunAssemblyRuntime.ts";

export const PHASE6_JOURNEY_SETTLEMENT_ADAPTER_VERSION = "obsidian-epoch-phase6-journey-settlement-adapter-v0.1.0" as const;

export type Phase6JourneySettlementAdapterErrorCode =
  | "PHASE6_JOURNEY_SETTLEMENT_FIELD_REQUIRED"
  | "PHASE6_JOURNEY_SETTLEMENT_ARRAY_REQUIRED"
  | "PHASE6_JOURNEY_SETTLEMENT_ARRAY_EMPTY"
  | "PHASE6_JOURNEY_SETTLEMENT_PRECOMPUTED_REJECTED"
  | "PHASE6_JOURNEY_SETTLEMENT_SCORE_INVALID"
  | "PHASE6_JOURNEY_SETTLEMENT_SUITABILITY_INVALID";

export interface Phase6JourneySettlementAdapterError {
  readonly code: Phase6JourneySettlementAdapterErrorCode;
  readonly path: string;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface Phase6JourneySettlementMetadata {
  readonly runId: string;
  readonly journeyId: string;
  readonly agentId: string;
  readonly explorerId: string;
  readonly receiptId: string;
  readonly experimentId: string;
  readonly runIndex: number;
  readonly seed: string;
  readonly rulesetVersion: string;
  readonly catalogVersion: string;
  readonly codeVersion: string;
  readonly scenarioMatrixVersion: string;
  readonly generatedAt: string;
  readonly startedAt: string;
  readonly settledAt: string;
  readonly world: BuildJourneyRunReceiptInput["world"];
}

export interface Phase6JourneySettlementAuthoritativeInputs {
  readonly metadata: Phase6JourneySettlementMetadata;
  readonly beforePanel: Phase6PanelSnapshotAdapterInput;
  readonly afterPanel: Phase6PanelSnapshotAdapterInput;
  readonly canonicalEvents: readonly EpochEvent[];
  readonly economy: {
    readonly previous: Phase6EconomySnapshot;
    readonly next: Phase6EconomySnapshot;
    readonly flows?: readonly Phase6EconomyResourceFlow[];
    readonly sourceEvents?: readonly unknown[];
  };
  readonly projections: {
    readonly before: Phase6ProjectionForDelta;
    readonly after: Phase6ProjectionForDelta;
    readonly now?: string;
  };
  readonly receipt: {
    readonly deltas: readonly JourneyRunStructuredDelta[];
    readonly score: JourneyRunScore;
    readonly suitability: JourneyRunSuitability;
    readonly rag: JourneyRunRagGrounding;
    readonly eventIds: BuildJourneyRunReceiptInput["eventIds"];
    readonly snapshots: BuildJourneyRunReceiptInput["snapshots"];
    readonly outcome: BuildJourneyRunReceiptInput["outcome"];
  };
  readonly resultPage?: never;
  readonly finalizedReceipt?: never;
  readonly verifiedResultPage?: never;
  readonly clientScore?: never;
  readonly clientSuitability?: never;
  readonly clientRag?: never;
  readonly clientReceipt?: never;
  readonly clientResultPage?: never;
  readonly modelScore?: never;
  readonly modelSuitability?: never;
  readonly modelRag?: never;
  readonly modelReceipt?: never;
  readonly modelResultPage?: never;
  readonly journeyRuntime?: JourneyTickResult;
  readonly actionResolutions?: readonly JourneyActionResolution[];
  readonly storyReport?: GroundedJourneyStoryReport;
}

export interface Phase6JourneySettlementAdapterSuccess {
  readonly ok: true;
  readonly adapterVersion: typeof PHASE6_JOURNEY_SETTLEMENT_ADAPTER_VERSION;
  readonly value: Phase6RunAssemblyRuntimeInput;
  readonly errors: readonly [];
}

export interface Phase6JourneySettlementAdapterFailure {
  readonly ok: false;
  readonly adapterVersion: typeof PHASE6_JOURNEY_SETTLEMENT_ADAPTER_VERSION;
  readonly errors: readonly Phase6JourneySettlementAdapterError[];
}

export type Phase6JourneySettlementAdapterResult =
  | Phase6JourneySettlementAdapterSuccess
  | Phase6JourneySettlementAdapterFailure;

function error(
  code: Phase6JourneySettlementAdapterErrorCode,
  path: string,
  message: string,
  details?: Readonly<Record<string, unknown>>,
): Phase6JourneySettlementAdapterError {
  return { code, path, message, details };
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function requireRecord(value: unknown, path: string, errors: Phase6JourneySettlementAdapterError[]): boolean {
  if (isRecord(value)) return true;
  errors.push(error("PHASE6_JOURNEY_SETTLEMENT_FIELD_REQUIRED", path, `${path} must be supplied by an authoritative service source`));
  return false;
}

function requireText(value: unknown, path: string, errors: Phase6JourneySettlementAdapterError[]): void {
  if (nonEmpty(value)) return;
  errors.push(error("PHASE6_JOURNEY_SETTLEMENT_FIELD_REQUIRED", path, `${path} must be a non-empty authoritative string`));
}

function requireArray(value: unknown, path: string, errors: Phase6JourneySettlementAdapterError[], allowEmpty = false): void {
  if (!Array.isArray(value)) {
    errors.push(error("PHASE6_JOURNEY_SETTLEMENT_ARRAY_REQUIRED", path, `${path} must be an authoritative array`));
    return;
  }
  if (!allowEmpty && value.length === 0) {
    errors.push(error("PHASE6_JOURNEY_SETTLEMENT_ARRAY_EMPTY", path, `${path} must not be empty`));
  }
}

const FORBIDDEN_PRECOMPUTED_KEYS = new Set([
  "client",
  "clientScore",
  "clientSuitability",
  "clientRag",
  "clientReceipt",
  "clientResultPage",
  "model",
  "modelScore",
  "modelSuitability",
  "modelRag",
  "modelReceipt",
  "modelResultPage",
  "precomputed",
  "precomputedScore",
  "precomputedSuitability",
  "precomputedRag",
  "precomputedReceipt",
  "precomputedResultPage",
  "finalizedReceipt",
  "verifiedResultPage",
  "resultPage",
]);

function collectForbiddenPrecomputedFields(
  value: unknown,
  path = "$",
  seen = new WeakSet<object>(),
): readonly string[] {
  if (!value || typeof value !== "object") return [];
  if (seen.has(value)) return [];
  seen.add(value);
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) => collectForbiddenPrecomputedFields(entry, `${path}.${index}`, seen));
  }
  return Object.entries(value as Record<string, unknown>).flatMap(([key, entry]) => {
    const childPath = `${path}.${key}`;
    return [
      ...(FORBIDDEN_PRECOMPUTED_KEYS.has(key) ? [childPath] : []),
      ...collectForbiddenPrecomputedFields(entry, childPath, seen),
    ];
  });
}

function validateNoPrecomputedArtifacts(
  input: Phase6JourneySettlementAuthoritativeInputs,
  errors: Phase6JourneySettlementAdapterError[],
): void {
  const forbidden = collectForbiddenPrecomputedFields(input);
  if (forbidden.length === 0) return;
  errors.push(error(
    "PHASE6_JOURNEY_SETTLEMENT_PRECOMPUTED_REJECTED",
    "$",
    "strict Phase 6 settlement adapter accepts only authoritative raw pre-settlement input; client/model/precomputed artifacts, finalized receipts, and result pages must be produced by assembly",
    { paths: forbidden },
  ));
}

function validateMetadata(input: Phase6JourneySettlementAuthoritativeInputs, errors: Phase6JourneySettlementAdapterError[]): void {
  requireRecord(input.metadata, "metadata", errors);
  requireText(input.metadata?.runId, "metadata.runId", errors);
  requireText(input.metadata?.journeyId, "metadata.journeyId", errors);
  requireText(input.metadata?.agentId, "metadata.agentId", errors);
  requireText(input.metadata?.explorerId, "metadata.explorerId", errors);
  requireText(input.metadata?.receiptId, "metadata.receiptId", errors);
  requireText(input.metadata?.experimentId, "metadata.experimentId", errors);
  if (!Number.isInteger(input.metadata?.runIndex) || (input.metadata?.runIndex as number) < 1 || (input.metadata?.runIndex as number) > 10) {
    errors.push(error(
      "PHASE6_JOURNEY_SETTLEMENT_FIELD_REQUIRED",
      "metadata.runIndex",
      "metadata.runIndex must be supplied by an authoritative service source as an integer from 1 to 10",
    ));
  }
  requireText(input.metadata?.seed, "metadata.seed", errors);
  requireText(input.metadata?.rulesetVersion, "metadata.rulesetVersion", errors);
  requireText(input.metadata?.catalogVersion, "metadata.catalogVersion", errors);
  requireText(input.metadata?.codeVersion, "metadata.codeVersion", errors);
  requireText(input.metadata?.scenarioMatrixVersion, "metadata.scenarioMatrixVersion", errors);
  requireText(input.metadata?.generatedAt, "metadata.generatedAt", errors);
  requireText(input.metadata?.startedAt, "metadata.startedAt", errors);
  requireText(input.metadata?.settledAt, "metadata.settledAt", errors);
  requireRecord(input.metadata?.world, "metadata.world", errors);
  requireText(input.metadata?.world?.worldId, "metadata.world.worldId", errors);
  requireText(input.metadata?.world?.regionId, "metadata.world.regionId", errors);
  requireText(input.metadata?.world?.worldTimeBefore, "metadata.world.worldTimeBefore", errors);
  requireText(input.metadata?.world?.worldTimeAfter, "metadata.world.worldTimeAfter", errors);
}

function validateEconomy(input: Phase6JourneySettlementAuthoritativeInputs, errors: Phase6JourneySettlementAdapterError[]): void {
  requireRecord(input.economy, "economy", errors);
  requireRecord(input.economy?.previous, "economy.previous", errors);
  requireRecord(input.economy?.next, "economy.next", errors);
  if (input.economy?.flows === undefined && input.economy?.sourceEvents === undefined) {
    errors.push(error(
      "PHASE6_JOURNEY_SETTLEMENT_FIELD_REQUIRED",
      "economy.flows",
      "economy must include authoritative canonical flows or source events for the economy event adapter",
    ));
  }
  if (input.economy?.flows !== undefined) requireArray(input.economy.flows, "economy.flows", errors, true);
  if (input.economy?.sourceEvents !== undefined) requireArray(input.economy.sourceEvents, "economy.sourceEvents", errors, true);
}

function validateMetricMap(
  value: unknown,
  dimensions: readonly string[],
  path: string,
  code: "PHASE6_JOURNEY_SETTLEMENT_SCORE_INVALID" | "PHASE6_JOURNEY_SETTLEMENT_SUITABILITY_INVALID",
  errors: Phase6JourneySettlementAdapterError[],
): void {
  if (!isRecord(value)) {
    errors.push(error(code, path, `${path} must be supplied as authoritative metrics`));
    return;
  }
  const actual = Object.keys(value).sort();
  const expected = [...dimensions].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    errors.push(error(code, path, `${path} must contain exactly the required dimensions`, { expected, actual }));
  }
  for (const dimension of dimensions) {
    const metric = value[dimension];
    if (!isRecord(metric)) {
      errors.push(error(code, `${path}.${dimension}`, `${path}.${dimension} is required`));
      continue;
    }
    if (typeof metric.value !== "number" || !Number.isFinite(metric.value) || metric.value < 0 || metric.value > 100) {
      errors.push(error(code, `${path}.${dimension}.value`, `${path}.${dimension}.value must be a finite number between 0 and 100`));
    }
    if (!Array.isArray(metric.evidence) || metric.evidence.some((entry) => !nonEmpty(entry))) {
      errors.push(error(code, `${path}.${dimension}.evidence`, `${path}.${dimension}.evidence must be authoritative non-empty strings`));
    }
  }
}

function validateReceipt(input: Phase6JourneySettlementAuthoritativeInputs, errors: Phase6JourneySettlementAdapterError[]): void {
  requireRecord(input.receipt, "receipt", errors);
  requireArray(input.receipt?.deltas, "receipt.deltas", errors, true);
  validateJourneyRunScore(input.receipt?.score).issues.forEach((issue) => errors.push(error(
    "PHASE6_JOURNEY_SETTLEMENT_SCORE_INVALID",
    `receipt.score${issue.path === "$" ? "" : issue.path.slice(1)}`,
    issue.code,
  )));
  validateMetricMap(input.receipt?.suitability, JOURNEY_RUN_SUITABILITY_DIMENSIONS, "receipt.suitability", "PHASE6_JOURNEY_SETTLEMENT_SUITABILITY_INVALID", errors);
  requireRecord(input.receipt?.rag, "receipt.rag", errors);
  requireRecord(input.receipt?.eventIds, "receipt.eventIds", errors);
  requireArray(input.receipt?.eventIds?.source, "receipt.eventIds.source", errors, true);
  requireArray(input.receipt?.eventIds?.settlement, "receipt.eventIds.settlement", errors, true);
  requireArray(input.receipt?.eventIds?.derived, "receipt.eventIds.derived", errors, true);
  requireRecord(input.receipt?.snapshots, "receipt.snapshots", errors);
  requireRecord(input.receipt?.snapshots?.before, "receipt.snapshots.before", errors);
  if (input.receipt?.snapshots?.before?.body === undefined) {
    errors.push(error(
      "PHASE6_JOURNEY_SETTLEMENT_FIELD_REQUIRED",
      "receipt.snapshots.before.body",
      "receipt.snapshots.before.body must be supplied by an authoritative service source",
    ));
  }
  requireText(input.receipt?.snapshots?.before?.hash, "receipt.snapshots.before.hash", errors);
  requireRecord(input.receipt?.snapshots?.after, "receipt.snapshots.after", errors);
  if (input.receipt?.snapshots?.after?.body === undefined) {
    errors.push(error(
      "PHASE6_JOURNEY_SETTLEMENT_FIELD_REQUIRED",
      "receipt.snapshots.after.body",
      "receipt.snapshots.after.body must be supplied by an authoritative service source",
    ));
  }
  requireText(input.receipt?.snapshots?.after?.hash, "receipt.snapshots.after.hash", errors);
  if (input.receipt?.outcome === undefined) {
    errors.push(error(
      "PHASE6_JOURNEY_SETTLEMENT_FIELD_REQUIRED",
      "receipt.outcome",
      "receipt.outcome must be supplied by an authoritative service source",
    ));
  }
}

function validateAuthoritativeInput(input: Phase6JourneySettlementAuthoritativeInputs): readonly Phase6JourneySettlementAdapterError[] {
  const errors: Phase6JourneySettlementAdapterError[] = [];
  validateNoPrecomputedArtifacts(input, errors);
  validateMetadata(input, errors);
  requireRecord(input.beforePanel, "beforePanel", errors);
  requireRecord(input.afterPanel, "afterPanel", errors);
  requireArray(input.canonicalEvents, "canonicalEvents", errors);
  validateEconomy(input, errors);
  requireRecord(input.projections, "projections", errors);
  requireRecord(input.projections?.before, "projections.before", errors);
  requireRecord(input.projections?.after, "projections.after", errors);
  if (input.projections?.now !== undefined) requireText(input.projections.now, "projections.now", errors);
  validateReceipt(input, errors);
  return errors;
}

export function adaptPhase6JourneySettlementInput(
  input: Phase6JourneySettlementAuthoritativeInputs,
): Phase6JourneySettlementAdapterResult {
  const errors = validateAuthoritativeInput(input);
  if (errors.length > 0) {
    return {
      ok: false,
      adapterVersion: PHASE6_JOURNEY_SETTLEMENT_ADAPTER_VERSION,
      errors,
    };
  }

  return {
    ok: true,
    adapterVersion: PHASE6_JOURNEY_SETTLEMENT_ADAPTER_VERSION,
    value: {
      runId: input.metadata.runId.trim(),
      journeyId: input.metadata.journeyId.trim(),
      beforeSnapshot: {
        kind: "panel_snapshot",
        input: input.beforePanel,
      },
      afterSnapshot: {
        kind: "panel_snapshot",
        input: input.afterPanel,
      },
      economy: {
        previous: input.economy.previous,
        next: input.economy.next,
        ...(input.economy.flows !== undefined ? { flows: input.economy.flows } : {}),
        ...(input.economy.sourceEvents !== undefined ? { sourceEvents: input.economy.sourceEvents } : {}),
      },
      projectionDelta: {
        before: input.projections.before,
        after: input.projections.after,
        canonicalEvents: input.canonicalEvents,
        ...(input.projections.now !== undefined ? { now: input.projections.now } : {}),
      },
      receipt: {
        receiptId: input.metadata.receiptId.trim(),
        agentId: input.metadata.agentId.trim(),
        explorerId: input.metadata.explorerId.trim(),
        experimentId: input.metadata.experimentId.trim(),
        runIndex: input.metadata.runIndex,
        seed: input.metadata.seed.trim(),
        rulesetVersion: input.metadata.rulesetVersion.trim(),
        catalogVersion: input.metadata.catalogVersion.trim(),
        codeVersion: input.metadata.codeVersion.trim(),
        scenarioMatrixVersion: input.metadata.scenarioMatrixVersion.trim(),
        generatedAt: input.metadata.generatedAt,
        startedAt: input.metadata.startedAt,
        settledAt: input.metadata.settledAt,
        world: input.metadata.world,
        snapshots: input.receipt.snapshots,
        deltas: input.receipt.deltas,
        score: input.receipt.score,
        suitability: input.receipt.suitability,
        rag: input.receipt.rag,
        eventIds: input.receipt.eventIds,
        outcome: input.receipt.outcome,
      },
    },
    errors: [],
  };
}
