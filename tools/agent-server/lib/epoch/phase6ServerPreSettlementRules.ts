import type { EpochEvent } from "./events.ts";
import type { JourneyActionResolution } from "./journeyActionResolutionRules.ts";
import type { JourneyTickResult } from "./journeyRuntime.ts";
import type { GroundedJourneyStoryReport } from "./journeyStoryReport.ts";
import type {
  Phase6JourneySettlementAuthoritativeInputs,
  Phase6JourneySettlementMetadata,
} from "./phase6JourneySettlementAdapter.ts";
import type {
  Phase6McpJourneyCompletionContextInput,
  Phase6McpJourneyStoredStartContext,
} from "./phase6McpJourneyContextAdapter.ts";
import {
  buildReceiptRagEvidence,
  type Phase6ReceiptRagEvidence,
  type Phase6ServerRagTrace,
} from "./phase6ServerRagTraceRules.ts";
import {
  buildPhase6ServerScoringEvidence,
  type Phase6ServerCanonicalEvent,
  type Phase6ServerScoringResult,
  type Phase6ServerScoringWorldCursor,
} from "./phase6ServerScoringRules.ts";

type UnknownRecord = Readonly<Record<string, unknown>>;

export const PHASE6_SERVER_PRE_SETTLEMENT_RULESET_VERSION = "obsidian-epoch-phase6-server-pre-settlement-v0.1.1" as const;

export type Phase6ServerPreSettlementFindingSeverity = "error" | "info";

export type Phase6ServerPreSettlementFindingCode =
  | "PHASE6_SERVER_PRE_SETTLEMENT_INPUT_INVALID"
  | "PHASE6_SERVER_PRE_SETTLEMENT_CLIENT_PRECOMPUTED_REJECTED"
  | "PHASE6_SERVER_PRE_SETTLEMENT_BINDING_MISMATCH"
  | "PHASE6_SERVER_PRE_SETTLEMENT_EVENT_BINDING_MISSING"
  | "PHASE6_SERVER_PRE_SETTLEMENT_SCORING_FAILED"
  | "PHASE6_SERVER_PRE_SETTLEMENT_RAG_SOURCE_MISSING"
  | "PHASE6_SERVER_PRE_SETTLEMENT_RAG_INVALID"
  | "PHASE6_SERVER_PRE_SETTLEMENT_RAG_LEGITIMATE_NO_RETRIEVAL";

export interface Phase6ServerPreSettlementFinding {
  readonly code: Phase6ServerPreSettlementFindingCode;
  readonly severity: Phase6ServerPreSettlementFindingSeverity;
  readonly message: string;
  readonly path: string;
  readonly details?: UnknownRecord;
}

export type Phase6PreSettlementAuthoritativeInput =
  Omit<Phase6JourneySettlementAuthoritativeInputs, "resultPage"> & {
    readonly resultPage?: never;
  };

export interface Phase6ServerPreSettlementReceiptBasis {
  readonly deltas: Phase6JourneySettlementAuthoritativeInputs["receipt"]["deltas"];
  readonly eventIds: Phase6JourneySettlementAuthoritativeInputs["receipt"]["eventIds"];
  readonly snapshots: Phase6JourneySettlementAuthoritativeInputs["receipt"]["snapshots"];
  readonly outcome: Phase6JourneySettlementAuthoritativeInputs["receipt"]["outcome"];
}

export interface Phase6ServerPreSettlementRuntimeInput {
  readonly metadata: Phase6McpJourneyCompletionContextInput["metadata"];
  readonly afterPanel: Phase6McpJourneyCompletionContextInput["afterPanel"];
  readonly afterProjection: Phase6McpJourneyCompletionContextInput["afterProjection"];
  readonly canonicalEvents: readonly EpochEvent[];
  // RAG retrieval legally happens before the run's first canonical event
  // (cursor rules allow retrievalCursor <= beforeCursor). These are event ids
  // the persisted RAG trace cites that exist in the global event stream at
  // run-start; they extend the binding id set without polluting canonicalEvents
  // (which scoring/cursor-chain consume).
  readonly bindingAnchorEventIds?: readonly string[];
  readonly economy: Phase6McpJourneyCompletionContextInput["economy"];
  readonly worldCursor: Phase6ServerScoringWorldCursor;
  readonly now?: string;
  readonly journeyRuntime?: JourneyTickResult;
  readonly storyReport?: GroundedJourneyStoryReport;
}

export interface Phase6ServerPreSettlementInput {
  readonly stores: Phase6McpJourneyStoredStartContext;
  readonly runtime: Phase6ServerPreSettlementRuntimeInput;
  readonly serverOutcomeResolution: unknown;
  readonly serverActionResolutions: readonly JourneyActionResolution[];
  readonly receiptBasis: Phase6ServerPreSettlementReceiptBasis;
  readonly persistedRagTrace: Phase6ServerRagTrace;
}

export interface Phase6ServerPreSettlementSuccess {
  readonly ok: true;
  readonly rulesetVersion: typeof PHASE6_SERVER_PRE_SETTLEMENT_RULESET_VERSION;
  readonly deterministic: true;
  readonly value: {
    readonly authoritativeInput: Phase6PreSettlementAuthoritativeInput;
    readonly scoringEvidence: Extract<Phase6ServerScoringResult, { readonly ok: true }>;
    readonly ragEvidence: Phase6ReceiptRagEvidence;
    readonly finalizeContract: {
      readonly strictV2ReceiptMustBeFinalizedByAssembly: true;
      readonly resultPageMustBeBuiltFromFinalizedReceipt: true;
      readonly finalizedReceiptInputRejected: true;
      readonly finalizedResultPageInputRejected: true;
    };
  };
  readonly findings: readonly Phase6ServerPreSettlementFinding[];
}

export interface Phase6ServerPreSettlementFailure {
  readonly ok: false;
  readonly rulesetVersion: typeof PHASE6_SERVER_PRE_SETTLEMENT_RULESET_VERSION;
  readonly deterministic: true;
  readonly findings: readonly Phase6ServerPreSettlementFinding[];
  readonly scoringEvidence?: Phase6ServerScoringResult;
  readonly ragEvidence?: Phase6ReceiptRagEvidence;
}

export type Phase6ServerPreSettlementResult =
  | Phase6ServerPreSettlementSuccess
  | Phase6ServerPreSettlementFailure;

const FORBIDDEN_PRECOMPUTED_KEYS = new Set([
  "clientScore",
  "clientSuitability",
  "clientRag",
  "clientReceipt",
  "clientResultPage",
  "modelScore",
  "modelSuitability",
  "modelRag",
  "modelReceipt",
  "modelResultPage",
  "precomputedScore",
  "precomputedSuitability",
  "precomputedRag",
  "precomputedReceipt",
  "precomputedResultPage",
  "finalizedReceipt",
  "verifiedResultPage",
  "scoreInput",
  "suitabilityInput",
]);

const FORBIDDEN_GENERIC_PRECOMPUTED_KEYS = new Set([
  "rag",
  "receipt",
  "resultPage",
]);

const SERVER_AUTHORED_PANEL_PATHS = new Set([
  "$.stores.beforeProjection.rag",
  "$.runtime.afterProjection.rag",
]);

function finding(
  code: Phase6ServerPreSettlementFindingCode,
  severity: Phase6ServerPreSettlementFindingSeverity,
  message: string,
  path: string,
  details?: UnknownRecord,
): Phase6ServerPreSettlementFinding {
  return { code, severity, message, path, details };
}

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function trim(value: string): string {
  return value.trim();
}

function eventId(event: EpochEvent): string | undefined {
  if (isRecord(event) && nonEmpty(event.eventId)) return event.eventId.trim();
  if (isRecord(event) && nonEmpty(event.id)) return event.id.trim();
  return undefined;
}

function unique(values: readonly string[]): readonly string[] {
  return [...new Set(values.map(trim).filter(nonEmpty))];
}

interface Phase6ServerPreSettlementCursorEvidence {
  readonly worldId?: string;
  readonly regionId?: string;
  readonly branchId?: string;
  readonly worldTime?: string | number;
  readonly simulationVersion?: string;
}

function textField(value: unknown, key: string): string | undefined {
  if (!isRecord(value)) return undefined;
  const entry = value[key];
  return nonEmpty(entry) ? entry.trim() : undefined;
}

function scalarField(value: unknown, key: string): string | number | undefined {
  if (!isRecord(value)) return undefined;
  const entry = value[key];
  if (typeof entry === "number" && Number.isFinite(entry)) return entry;
  return nonEmpty(entry) ? entry.trim() : undefined;
}

function cursorFromRecord(value: unknown): Phase6ServerPreSettlementCursorEvidence {
  return {
    worldId: textField(value, "worldId"),
    regionId: textField(value, "regionId"),
    branchId: textField(value, "branchId") ?? textField(value, "branch"),
    worldTime: scalarField(value, "worldTime") ?? scalarField(value, "cursor") ?? scalarField(value, "tick"),
    simulationVersion: textField(value, "simulationVersion"),
  };
}

function cursorFromMetadataWorld(value: unknown, timeKey: "worldTimeBefore" | "worldTimeAfter"): Phase6ServerPreSettlementCursorEvidence {
  return {
    ...cursorFromRecord(value),
    worldTime: scalarField(value, timeKey) ?? scalarField(value, "worldTime"),
  };
}

function startCursorFromStores(input: Phase6ServerPreSettlementInput): Phase6ServerPreSettlementCursorEvidence {
  const stores = input.stores as unknown;
  const candidates = isRecord(stores)
    ? [
        stores.worldCursorBefore,
        stores.beforeWorldCursor,
        stores.startWorldCursor,
        stores.worldCursor,
        stores.cursor,
      ]
    : [];
  const explicit = candidates.map(cursorFromRecord).find((cursor) => cursor.worldId || cursor.regionId || cursor.worldTime);
  if (explicit) return explicit;
  return cursorFromMetadataWorld(input.runtime.metadata?.world, "worldTimeBefore");
}

function settlementCursorFromRuntime(input: Phase6ServerPreSettlementInput): Phase6ServerPreSettlementCursorEvidence {
  return {
    ...cursorFromMetadataWorld(input.runtime.metadata?.world, "worldTimeAfter"),
    ...cursorFromRecord(input.runtime.worldCursor),
  };
}

function compareCursorTime(left: unknown, right: unknown): -1 | 0 | 1 | undefined {
  if (left === undefined || right === undefined) return undefined;
  if (left === right) return 0;
  const leftNumber = typeof left === "number" ? left : Number(left);
  const rightNumber = typeof right === "number" ? right : Number(right);
  if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
    return leftNumber === rightNumber ? 0 : leftNumber < rightNumber ? -1 : 1;
  }
  if (typeof left === "string" && typeof right === "string") {
    const leftDate = Date.parse(left);
    const rightDate = Date.parse(right);
    if (Number.isFinite(leftDate) && Number.isFinite(rightDate)) {
      return leftDate === rightDate ? 0 : leftDate < rightDate ? -1 : 1;
    }
    return left === right ? 0 : undefined;
  }
  return undefined;
}

function cursorPath(value: Phase6ServerPreSettlementCursorEvidence): string {
  return [
    value.worldId ?? "?",
    value.regionId ?? "?",
    value.branchId ?? "?",
    value.worldTime ?? "?",
    value.simulationVersion ?? "?",
  ].join("/");
}

function cursorAtOrBefore(
  findings: Phase6ServerPreSettlementFinding[],
  path: string,
  left: Phase6ServerPreSettlementCursorEvidence,
  right: Phase6ServerPreSettlementCursorEvidence,
  label: string,
): void {
  const comparison = compareCursorTime(left.worldTime, right.worldTime);
  if (comparison !== undefined && comparison <= 0) return;
  findings.push(finding(
    "PHASE6_SERVER_PRE_SETTLEMENT_BINDING_MISMATCH",
    "error",
    `${label} cursor must be equal to or earlier than the stored before cursor`,
    path,
    { retrievalCursor: left, beforeCursor: right },
  ));
}

function requireSameCursorScope(
  findings: Phase6ServerPreSettlementFinding[],
  path: string,
  left: Phase6ServerPreSettlementCursorEvidence,
  right: Phase6ServerPreSettlementCursorEvidence,
  label: string,
): void {
  bindingMismatch(findings, `${path}.worldId`, left.worldId, right.worldId, `${label} world`);
  bindingMismatch(findings, `${path}.regionId`, left.regionId, right.regionId, `${label} region`);
  bindingMismatch(findings, `${path}.branchId`, left.branchId, right.branchId, `${label} branch`);
  bindingMismatch(findings, `${path}.simulationVersion`, left.simulationVersion, right.simulationVersion, `${label} simulation version`);
}

function eventCursor(event: EpochEvent, keys: readonly string[]): Phase6ServerPreSettlementCursorEvidence | undefined {
  if (!isRecord(event)) return undefined;
  for (const key of keys) {
    const cursor = cursorFromRecord(event[key]);
    if (cursor.worldId || cursor.regionId || cursor.branchId || cursor.worldTime || cursor.simulationVersion) return cursor;
  }
  return undefined;
}

function validateCanonicalCursorChain(
  input: Phase6ServerPreSettlementInput,
  beforeCursor: Phase6ServerPreSettlementCursorEvidence,
  afterCursor: Phase6ServerPreSettlementCursorEvidence,
): readonly Phase6ServerPreSettlementFinding[] {
  const findings: Phase6ServerPreSettlementFinding[] = [];
  if (input.runtime.canonicalEvents.length === 0) {
    return [finding(
      "PHASE6_SERVER_PRE_SETTLEMENT_EVENT_BINDING_MISSING",
      "error",
      "canonical event chain is required to prove settlement cursor advancement",
      "runtime.canonicalEvents",
    )];
  }

  let previousAfter = beforeCursor;
  let sawCursorProof = false;
  input.runtime.canonicalEvents.forEach((event, index) => {
    const eventBefore = eventCursor(event, ["worldCursorBefore", "beforeWorldCursor", "cursorBefore", "beforeCursor"]);
    const eventAfter = eventCursor(event, ["worldCursorAfter", "afterWorldCursor", "cursorAfter", "afterCursor", "worldCursor"]);
    if (!eventBefore || !eventAfter) return;

    sawCursorProof = true;
    requireSameCursorScope(findings, `runtime.canonicalEvents.${index}.worldCursorBefore`, previousAfter, eventBefore, "canonical event chain");
    const chainComparison = compareCursorTime(previousAfter.worldTime, eventBefore.worldTime);
    if (chainComparison === undefined || chainComparison > 0) {
      findings.push(finding(
        "PHASE6_SERVER_PRE_SETTLEMENT_BINDING_MISMATCH",
        "error",
        "canonical event chain must not fork or roll back before an event",
        `runtime.canonicalEvents.${index}.worldCursorBefore`,
        { previousAfter, eventBefore },
      ));
    }

    requireSameCursorScope(findings, `runtime.canonicalEvents.${index}.worldCursorAfter`, eventBefore, eventAfter, "canonical event transition");
    const eventComparison = compareCursorTime(eventBefore.worldTime, eventAfter.worldTime);
    if (eventComparison === undefined || eventComparison > 0) {
      findings.push(finding(
        "PHASE6_SERVER_PRE_SETTLEMENT_BINDING_MISMATCH",
        "error",
        "canonical event cursor transition must be monotonic",
        `runtime.canonicalEvents.${index}.worldCursorAfter`,
        { eventBefore, eventAfter },
      ));
    }
    previousAfter = eventAfter;
  });

  if (!sawCursorProof) {
    findings.push(finding(
      "PHASE6_SERVER_PRE_SETTLEMENT_EVENT_BINDING_MISSING",
      "error",
      "canonical events must carry before/after world cursors to prove settlement advancement",
      "runtime.canonicalEvents",
      { beforeCursor, afterCursor },
    ));
  } else {
    requireSameCursorScope(findings, "runtime.worldCursor", previousAfter, afterCursor, "canonical event chain final cursor");
    const finalComparison = compareCursorTime(previousAfter.worldTime, afterCursor.worldTime);
    if (finalComparison === undefined || finalComparison !== 0) {
      findings.push(finding(
        "PHASE6_SERVER_PRE_SETTLEMENT_BINDING_MISMATCH",
        "error",
        "canonical event chain final cursor must match the settlement cursor",
        "runtime.worldCursor",
        { chainCursor: previousAfter, settlementCursor: afterCursor },
      ));
    }
  }

  return findings;
}

function validateWorldCursorBindings(input: Phase6ServerPreSettlementInput): readonly Phase6ServerPreSettlementFinding[] {
  const findings: Phase6ServerPreSettlementFinding[] = [];
  const beforeCursor = startCursorFromStores(input);
  const afterCursor = settlementCursorFromRuntime(input);
  const retrievalCursor = cursorFromRecord(input.persistedRagTrace?.binding?.world);

  requireSameCursorScope(findings, "persistedRagTrace.binding.world", beforeCursor, retrievalCursor, "RAG retrieval");
  cursorAtOrBefore(findings, "persistedRagTrace.binding.world.worldTime", retrievalCursor, beforeCursor, "RAG retrieval");
  requireSameCursorScope(findings, "runtime.worldCursor", beforeCursor, afterCursor, "settlement");
  const settlementComparison = compareCursorTime(beforeCursor.worldTime, afterCursor.worldTime);
  if (settlementComparison === undefined || settlementComparison > 0) {
    findings.push(finding(
      "PHASE6_SERVER_PRE_SETTLEMENT_BINDING_MISMATCH",
      "error",
      "settlement cursor must be monotonic and not earlier than the stored before cursor",
      "runtime.worldCursor.worldTime",
      { beforeCursor, settlementCursor: afterCursor },
    ));
  }

  findings.push(...validateCanonicalCursorChain(input, beforeCursor, afterCursor));
  return findings;
}

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
    const forbidden = FORBIDDEN_PRECOMPUTED_KEYS.has(key)
      || (FORBIDDEN_GENERIC_PRECOMPUTED_KEYS.has(key) && !SERVER_AUTHORED_PANEL_PATHS.has(childPath));
    return [
      ...(forbidden ? [childPath] : []),
      ...collectForbiddenPrecomputedFields(entry, childPath, seen),
    ];
  });
}

function bindingMismatch(
  findings: Phase6ServerPreSettlementFinding[],
  path: string,
  left: unknown,
  right: unknown,
  label: string,
): void {
  if (left === undefined || right === undefined) return;
  if (left === right) return;
  findings.push(finding(
    "PHASE6_SERVER_PRE_SETTLEMENT_BINDING_MISMATCH",
    "error",
    `${label} binding must match across server context, runtime, and persisted evidence`,
    path,
    { expected: left, actual: right },
  ));
}

function requireTextBinding(
  findings: Phase6ServerPreSettlementFinding[],
  value: unknown,
  path: string,
  label: string,
): void {
  if (nonEmpty(value)) return;
  findings.push(finding(
    "PHASE6_SERVER_PRE_SETTLEMENT_BINDING_MISMATCH",
    "error",
    `${label} binding is required`,
    path,
  ));
}

function validateEventBindings(
  input: Phase6ServerPreSettlementInput,
  canonicalEventIds: readonly string[],
): readonly Phase6ServerPreSettlementFinding[] {
  const findings: Phase6ServerPreSettlementFinding[] = [];
  const canonical = new Set(canonicalEventIds);
  const missingCanonicalIds = input.runtime.canonicalEvents
    .map((event, index) => ({ id: eventId(event), index }))
    .filter((entry) => !entry.id);

  for (const entry of missingCanonicalIds) {
    findings.push(finding(
      "PHASE6_SERVER_PRE_SETTLEMENT_EVENT_BINDING_MISSING",
      "error",
      "canonical event must carry an authoritative eventId/id before pre-settlement assembly",
      `runtime.canonicalEvents.${entry.index}`,
    ));
  }

  const receiptEventGroups = [
    ["source", input.receiptBasis.eventIds.source],
    ["settlement", input.receiptBasis.eventIds.settlement],
    ["derived", input.receiptBasis.eventIds.derived],
  ] as const;
  for (const [name, eventIds] of receiptEventGroups) {
    eventIds.forEach((id, index) => {
      if (!nonEmpty(id)) {
        findings.push(finding(
          "PHASE6_SERVER_PRE_SETTLEMENT_EVENT_BINDING_MISSING",
          "error",
          "receipt event ids must be non-empty authoritative ids",
          `receiptBasis.eventIds.${name}.${index}`,
        ));
      }
    });
  }

  input.receiptBasis.eventIds.source.forEach((id, index) => {
    if (nonEmpty(id) && !canonical.has(id.trim())) {
      findings.push(finding(
        "PHASE6_SERVER_PRE_SETTLEMENT_EVENT_BINDING_MISSING",
        "error",
        "receipt source event ids must bind to runtime canonical events",
        `receiptBasis.eventIds.source.${index}`,
        { eventId: id },
      ));
    }
  });

  input.persistedRagTrace.sourceEventIds.forEach((id, index) => {
    if (nonEmpty(id) && !canonical.has(id.trim())) {
      findings.push(finding(
        "PHASE6_SERVER_PRE_SETTLEMENT_EVENT_BINDING_MISSING",
        "error",
        "persisted RAG source event ids must bind to runtime canonical events",
        `persistedRagTrace.sourceEventIds.${index}`,
        { eventId: id },
      ));
    }
  });

  input.persistedRagTrace.groundingHits.forEach((hit, hitIndex) => {
    hit.eventIds.forEach((id, eventIndex) => {
      if (nonEmpty(id) && !canonical.has(id.trim())) {
        findings.push(finding(
          "PHASE6_SERVER_PRE_SETTLEMENT_EVENT_BINDING_MISSING",
          "error",
          "persisted RAG grounding event ids must bind to runtime canonical events",
          `persistedRagTrace.groundingHits.${hitIndex}.eventIds.${eventIndex}`,
          { eventId: id },
        ));
      }
    });
  });

  return findings;
}

function validateBindings(input: Phase6ServerPreSettlementInput): readonly Phase6ServerPreSettlementFinding[] {
  const findings: Phase6ServerPreSettlementFinding[] = [];
  if (!isRecord(input)) {
    return [finding(
      "PHASE6_SERVER_PRE_SETTLEMENT_INPUT_INVALID",
      "error",
      "pre-settlement input must be an object assembled from server stores and runtime evidence",
      "$",
    )];
  }

  const forbidden = collectForbiddenPrecomputedFields(input);
  if (forbidden.length > 0) {
    findings.push(finding(
      "PHASE6_SERVER_PRE_SETTLEMENT_CLIENT_PRECOMPUTED_REJECTED",
      "error",
      "pre-settlement assembly rejects client/model precomputed score, suitability, RAG, receipt, or result page fields",
      "$",
      { fields: forbidden },
    ));
  }

  const metadata = input.runtime?.metadata;
  const experiment = input.stores?.experiment;
  const version = input.stores?.version;
  const cursor = input.runtime?.worldCursor;
  const rag = input.persistedRagTrace?.binding;
  const world = metadata?.world;

  requireTextBinding(findings, metadata?.agentId, "runtime.metadata.agentId", "agent identity");
  requireTextBinding(findings, metadata?.explorerId, "runtime.metadata.explorerId", "explorer identity");
  requireTextBinding(findings, experiment?.experimentId, "stores.experiment.experimentId", "experiment");
  requireTextBinding(findings, metadata?.runId, "runtime.metadata.runId", "run");
  requireTextBinding(findings, metadata?.journeyId, "runtime.metadata.journeyId", "journey");
  requireTextBinding(findings, experiment?.seed, "stores.experiment.seed", "seed");
  requireTextBinding(findings, version?.rulesetVersion, "stores.version.rulesetVersion", "ruleset version");
  requireTextBinding(findings, version?.catalogVersion, "stores.version.catalogVersion", "catalog version");
  requireTextBinding(findings, version?.codeVersion, "stores.version.codeVersion", "code version");
  requireTextBinding(findings, version?.scenarioMatrixVersion, "stores.version.scenarioMatrixVersion", "scenario matrix version");
  requireTextBinding(findings, cursor?.worldId, "runtime.worldCursor.worldId", "world cursor");

  bindingMismatch(findings, "persistedRagTrace.binding.identity.agentId", metadata?.agentId, rag?.identity.agentId, "agent identity");
  bindingMismatch(findings, "persistedRagTrace.binding.identity.explorerId", metadata?.explorerId, rag?.identity.explorerId, "explorer identity");
  bindingMismatch(findings, "persistedRagTrace.binding.experiment.experimentId", experiment?.experimentId, rag?.experiment.experimentId, "experiment");
  bindingMismatch(findings, "persistedRagTrace.binding.experiment.runIndex", experiment?.runIndex, rag?.experiment.runIndex, "experiment run index");
  bindingMismatch(findings, "persistedRagTrace.binding.experiment.seed", experiment?.seed, rag?.experiment.seed, "seed");
  bindingMismatch(findings, "persistedRagTrace.binding.run.runId", metadata?.runId, rag?.run.runId, "run");
  bindingMismatch(findings, "persistedRagTrace.binding.run.journeyId", metadata?.journeyId, rag?.run.journeyId, "journey");
  bindingMismatch(findings, "persistedRagTrace.binding.run.receiptId", metadata?.receiptId, rag?.run.receiptId, "receipt");
  bindingMismatch(findings, "runtime.worldCursor.worldId", world?.worldId, cursor?.worldId, "world cursor");
  bindingMismatch(findings, "runtime.worldCursor.regionId", world?.regionId, cursor?.regionId, "region cursor");
  bindingMismatch(findings, "runtime.worldCursor.worldTime", world?.worldTimeAfter, cursor?.worldTime, "world time cursor");
  findings.push(...validateWorldCursorBindings(input));

  const canonicalEventIds = unique([
    ...input.runtime.canonicalEvents.map((event) => eventId(event) ?? ""),
    ...(input.runtime.bindingAnchorEventIds ?? []),
  ]);
  findings.push(...validateEventBindings(input, canonicalEventIds));
  return findings;
}

function buildMetadata(input: Phase6ServerPreSettlementInput): Phase6JourneySettlementMetadata {
  return {
    ...input.runtime.metadata,
    experimentId: input.stores.experiment.experimentId.trim(),
    runIndex: input.stores.experiment.runIndex,
    seed: input.stores.experiment.seed.trim(),
    rulesetVersion: input.stores.version.rulesetVersion.trim(),
    catalogVersion: input.stores.version.catalogVersion.trim(),
    codeVersion: input.stores.version.codeVersion.trim(),
    scenarioMatrixVersion: input.stores.version.scenarioMatrixVersion.trim(),
  };
}

function ragFindings(ragEvidence: Phase6ReceiptRagEvidence): readonly Phase6ServerPreSettlementFinding[] {
  if (ragEvidence.validation.status === "legitimate_no_retrieval" && ragEvidence.validation.ok) {
    return [finding(
      "PHASE6_SERVER_PRE_SETTLEMENT_RAG_LEGITIMATE_NO_RETRIEVAL",
      "info",
      "RAG retrieval was not required by server policy and is accepted as explicit no-retrieval evidence",
      "persistedRagTrace",
      { reason: ragEvidence.trace.noRetrievalReason },
    )];
  }
  if (ragEvidence.validation.status === "source_missing") {
    return [finding(
      "PHASE6_SERVER_PRE_SETTLEMENT_RAG_SOURCE_MISSING",
      "error",
      "RAG source is missing and cannot be treated as authoritative receipt grounding",
      "persistedRagTrace",
      { issues: ragEvidence.validation.issues },
    )];
  }
  if (!ragEvidence.validation.ok) {
    return [finding(
      "PHASE6_SERVER_PRE_SETTLEMENT_RAG_INVALID",
      "error",
      "persisted RAG trace failed server validation",
      "persistedRagTrace",
      { status: ragEvidence.validation.status, issues: ragEvidence.validation.issues },
    )];
  }
  return [];
}

export function buildPhase6ServerPreSettlement(
  input: Phase6ServerPreSettlementInput,
): Phase6ServerPreSettlementResult {
  const bindingFindings = validateBindings(input);
  if (bindingFindings.some((entry) => entry.severity === "error")) {
    return {
      ok: false,
      rulesetVersion: PHASE6_SERVER_PRE_SETTLEMENT_RULESET_VERSION,
      deterministic: true,
      findings: bindingFindings,
    };
  }

  const scoringEvidence = buildPhase6ServerScoringEvidence({
    canonicalEvents: input.runtime.canonicalEvents as unknown as readonly Phase6ServerCanonicalEvent[],
    beforeSnapshot: input.stores.beforePanel,
    afterSnapshot: input.runtime.afterPanel,
    outcomeResolution: input.serverOutcomeResolution,
    actionResolutions: input.serverActionResolutions,
    worldCursor: input.runtime.worldCursor,
    versionBinding: {
      rulesetVersion: input.stores.version.rulesetVersion,
      catalogVersion: input.stores.version.catalogVersion,
      codeVersion: input.stores.version.codeVersion,
      scenarioMatrixVersion: input.stores.version.scenarioMatrixVersion,
    },
  });
  if (!scoringEvidence.ok) {
    return {
      ok: false,
      rulesetVersion: PHASE6_SERVER_PRE_SETTLEMENT_RULESET_VERSION,
      deterministic: true,
      findings: [
        ...bindingFindings,
        ...scoringEvidence.findings.map((entry) => finding(
          "PHASE6_SERVER_PRE_SETTLEMENT_SCORING_FAILED",
          "error",
          entry.message,
          `serverScoring.${entry.path}`,
          { scoringCode: entry.code, ...(entry.details ? { details: entry.details } : {}) },
        )),
      ],
      scoringEvidence,
    };
  }

  const ragEvidence = {
    ...buildReceiptRagEvidence(input.persistedRagTrace),
    cursorBinding: {
      retrievalCursor: cursorFromRecord(input.persistedRagTrace.binding.world),
      settlementCursor: settlementCursorFromRuntime(input),
    },
  };
  const ragValidationFindings = ragFindings(ragEvidence);
  if (ragValidationFindings.some((entry) => entry.severity === "error")) {
    return {
      ok: false,
      rulesetVersion: PHASE6_SERVER_PRE_SETTLEMENT_RULESET_VERSION,
      deterministic: true,
      findings: [...bindingFindings, ...ragValidationFindings],
      scoringEvidence,
      ragEvidence,
    };
  }

  const metadata = buildMetadata(input);
  const receipt = {
    deltas: input.receiptBasis.deltas,
    score: scoringEvidence.score,
    suitability: scoringEvidence.suitability,
    rag: ragEvidence.grounding,
    eventIds: input.receiptBasis.eventIds,
    snapshots: input.receiptBasis.snapshots,
    outcome: input.receiptBasis.outcome,
  };

  const authoritativeInput: Phase6PreSettlementAuthoritativeInput = {
    metadata,
    beforePanel: input.stores.beforePanel,
    afterPanel: input.runtime.afterPanel,
    canonicalEvents: input.runtime.canonicalEvents,
    economy: {
      previous: input.stores.economyBefore,
      next: input.runtime.economy.next,
      ...(input.runtime.economy.flows ? { flows: input.runtime.economy.flows } : {}),
      ...(input.runtime.economy.sourceEvents ? { sourceEvents: input.runtime.economy.sourceEvents } : {}),
    },
    projections: {
      before: input.stores.beforeProjection,
      after: input.runtime.afterProjection,
      ...(input.runtime.now ? { now: input.runtime.now } : {}),
    },
    receipt,
    ...(input.runtime.journeyRuntime ? { journeyRuntime: input.runtime.journeyRuntime } : {}),
    actionResolutions: input.serverActionResolutions,
    ...(input.runtime.storyReport ? { storyReport: input.runtime.storyReport } : {}),
  };

  return {
    ok: true,
    rulesetVersion: PHASE6_SERVER_PRE_SETTLEMENT_RULESET_VERSION,
    deterministic: true,
    value: {
      authoritativeInput,
      scoringEvidence,
      ragEvidence,
      finalizeContract: {
        strictV2ReceiptMustBeFinalizedByAssembly: true,
        resultPageMustBeBuiltFromFinalizedReceipt: true,
        finalizedReceiptInputRejected: true,
        finalizedResultPageInputRejected: true,
      },
    },
    findings: [...bindingFindings, ...ragValidationFindings],
  };
}
