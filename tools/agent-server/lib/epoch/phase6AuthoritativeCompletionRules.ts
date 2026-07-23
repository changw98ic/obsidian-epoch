import type { CausalCanonicalJsonValue } from "./causalCanonicalJson.ts";
import type { EpochEvent } from "./events.ts";
import type { JourneyActionResolution } from "./journeyActionResolutionRules.ts";
import type { GroundedJourneyStoryReport } from "./journeyStoryReport.ts";
import {
  JOURNEY_RUN_SUITABILITY_DIMENSIONS,
  validateJourneyRunScore,
  type BuildJourneyRunReceiptInput,
  type JourneyRunRagGrounding,
  type JourneyRunScore,
  type JourneyRunStructuredDelta,
  type JourneyRunSuitability,
} from "./journeyRunReceiptRules.ts";
import type { Phase6EconomyResourceFlow, Phase6EconomySnapshot } from "./phase6EconomyAuditRules.ts";
import type { Phase6JourneyContextRecord } from "./phase6JourneyContextStore.ts";
import type { Phase6McpJourneyCompletionContextInput } from "./phase6McpJourneyContextAdapter.ts";
import {
  buildPhase6PanelSnapshotDocument,
  type Phase6PanelSnapshotAdapterInput,
} from "./phase6PanelSnapshotAdapter.ts";
import type { Phase6ProjectionForDelta } from "./phase6ProjectionDeltaRules.ts";
import {
  phase6ResultPageScoreDetails,
  phase6ResultPageScoreSummary,
  type Phase6ResultPageChangeSet,
  type Phase6ResultPageIdentityProgressionSection,
  type Phase6ResultPageRagSection,
  type Phase6ResultPageScoreDetail,
} from "./phase6ResultPageRules.ts";

type UnknownRecord = Readonly<Record<string, unknown>>;

export const PHASE6_AUTHORITATIVE_COMPLETION_BUILDER_VERSION =
  "obsidian-epoch-phase6-authoritative-completion-builder-v0.2.0" as const;

export type Phase6AuthoritativeCompletionFindingCode =
  | "PHASE6_AUTHORITATIVE_COMPLETION_INPUT_MISSING"
  | "PHASE6_AUTHORITATIVE_COMPLETION_FIELD_REQUIRED"
  | "PHASE6_AUTHORITATIVE_COMPLETION_ARRAY_REQUIRED"
  | "PHASE6_AUTHORITATIVE_COMPLETION_ARRAY_EMPTY"
  | "PHASE6_AUTHORITATIVE_COMPLETION_SECRET_FORBIDDEN"
  | "PHASE6_AUTHORITATIVE_COMPLETION_LEGACY_FINALIZED_INPUT_REJECTED"
  | "PHASE6_AUTHORITATIVE_COMPLETION_STORED_CONTEXT_INVALID"
  | "PHASE6_AUTHORITATIVE_COMPLETION_BINDING_MISMATCH"
  | "PHASE6_AUTHORITATIVE_COMPLETION_CANONICAL_EVENT_INVALID"
  | "PHASE6_AUTHORITATIVE_COMPLETION_EVENT_BINDING_MISMATCH"
  | "PHASE6_AUTHORITATIVE_COMPLETION_SCORE_INVALID"
  | "PHASE6_AUTHORITATIVE_COMPLETION_SUITABILITY_INVALID"
  | "PHASE6_AUTHORITATIVE_COMPLETION_RAG_INVALID"
  | "PHASE6_AUTHORITATIVE_COMPLETION_SNAPSHOT_INVALID"
  | "PHASE6_AUTHORITATIVE_COMPLETION_FIXED_94_REJECTED";

export interface Phase6AuthoritativeCompletionFinding {
  readonly code: Phase6AuthoritativeCompletionFindingCode;
  readonly severity: "error";
  readonly path: string;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface Phase6AuthoritativeCompletionSettlementMetadata {
  readonly receiptId: string;
  readonly agentId: string;
  readonly explorerId: string;
  readonly generatedAt: string;
  readonly startedAt: string;
  readonly settledAt: string;
  readonly auditId?: string;
}

export interface Phase6AuthoritativeCompletionStateDelta {
  readonly deltas: readonly JourneyRunStructuredDelta[];
  readonly eventIds: BuildJourneyRunReceiptInput["eventIds"];
  readonly world: Phase6ResultPageChangeSet;
  readonly identityProgression: Phase6ResultPageIdentityProgressionSection;
}

export interface Phase6AuthoritativeCompletionServerScoring {
  readonly scoreMission: UnknownRecord;
  readonly score: JourneyRunScore;
  readonly suitability: JourneyRunSuitability;
}

export interface Phase6AuthoritativeCompletionServerRag {
  readonly grounding: JourneyRunRagGrounding;
  readonly resultPage: Phase6ResultPageRagSection;
}

export interface Phase6AuthoritativeCompletionInput {
  readonly storedContext: Phase6JourneyContextRecord;
  readonly settlement: Phase6AuthoritativeCompletionSettlementMetadata;
  readonly afterPanel: Phase6PanelSnapshotAdapterInput;
  readonly afterProjection: Phase6ProjectionForDelta;
  readonly canonicalEvents: readonly EpochEvent[];
  readonly economy: {
    readonly next: Phase6EconomySnapshot;
    readonly flows?: readonly Phase6EconomyResourceFlow[];
    readonly sourceEvents?: readonly unknown[];
  };
  readonly serverScoring: Phase6AuthoritativeCompletionServerScoring;
  readonly serverRag: Phase6AuthoritativeCompletionServerRag;
  readonly stateDelta: Phase6AuthoritativeCompletionStateDelta;
  readonly outcome: BuildJourneyRunReceiptInput["outcome"];
  readonly actionResolutions: readonly JourneyActionResolution[];
  readonly storyReport?: GroundedJourneyStoryReport;
  readonly journeyRuntime?: Phase6McpJourneyCompletionContextInput["journeyRuntime"];
  readonly now?: string;
}

export interface Phase6AuthoritativeWorldCursor {
  readonly worldId: string;
  readonly regionId: string;
  readonly worldTimeBefore: string;
  readonly worldTimeAfter: string;
  readonly simulationVersion?: number;
}

export interface Phase6AuthoritativeExperimentBinding {
  readonly experimentId: string;
  readonly runIndex: number;
  readonly seed: string;
  readonly rulesetVersion: string;
  readonly catalogVersion: string;
  readonly codeVersion: string;
  readonly scenarioMatrixVersion: string;
}

export interface Phase6AuthoritativePostSettlementArtifacts {
  readonly afterPanel: Phase6PanelSnapshotAdapterInput;
  readonly afterProjection: Phase6ProjectionForDelta;
  readonly canonicalEvents: readonly EpochEvent[];
  readonly economy: Phase6AuthoritativeCompletionInput["economy"];
  readonly worldCursor: Phase6AuthoritativeWorldCursor;
  readonly experimentBinding: Phase6AuthoritativeExperimentBinding;
  readonly auditId: string;
  readonly checkedAt: string;
}

export interface Phase6AuthoritativeCompletionBuildSuccess {
  readonly ok: true;
  readonly status: "pre_settlement";
  readonly finalized: false;
  readonly verified: false;
  readonly builderVersion: typeof PHASE6_AUTHORITATIVE_COMPLETION_BUILDER_VERSION;
  readonly deterministic: true;
  readonly completion: Phase6McpJourneyCompletionContextInput;
  readonly postSettlement: {
    readonly canonicalArtifacts: Phase6AuthoritativePostSettlementArtifacts;
  };
  readonly sourceBindings: {
    readonly storedContextHash: string;
    readonly canonicalEventIds: readonly string[];
    readonly scoreMission: UnknownRecord;
  };
  readonly mcpTools: {
    readonly finalizePhase6Journey: {
      readonly journeyId: string;
      readonly completion: Phase6McpJourneyCompletionContextInput;
    };
  };
  readonly findings: readonly [];
}

export interface Phase6AuthoritativeCompletionBuildFailure {
  readonly ok: false;
  readonly status: "rejected";
  readonly finalized: false;
  readonly verified: false;
  readonly builderVersion: typeof PHASE6_AUTHORITATIVE_COMPLETION_BUILDER_VERSION;
  readonly deterministic: true;
  readonly findings: readonly Phase6AuthoritativeCompletionFinding[];
}

export type Phase6AuthoritativeCompletionBuildResult =
  | Phase6AuthoritativeCompletionBuildSuccess
  | Phase6AuthoritativeCompletionBuildFailure;

function finding(
  code: Phase6AuthoritativeCompletionFindingCode,
  path: string,
  message: string,
  details?: Readonly<Record<string, unknown>>,
): Phase6AuthoritativeCompletionFinding {
  return { code, severity: "error", path, message, details };
}

function failure(
  findings: readonly Phase6AuthoritativeCompletionFinding[],
): Phase6AuthoritativeCompletionBuildFailure {
  return {
    ok: false,
    status: "rejected",
    finalized: false,
    verified: false,
    builderVersion: PHASE6_AUTHORITATIVE_COMPLETION_BUILDER_VERSION,
    deterministic: true,
    findings: [...findings].sort((left, right) =>
      left.path.localeCompare(right.path) || left.code.localeCompare(right.code)),
  };
}

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function requireRecord(
  value: unknown,
  path: string,
  findings: Phase6AuthoritativeCompletionFinding[],
  code: Phase6AuthoritativeCompletionFindingCode = "PHASE6_AUTHORITATIVE_COMPLETION_FIELD_REQUIRED",
): value is UnknownRecord {
  if (isRecord(value)) return true;
  findings.push(finding(code, path, `${path} must be an authoritative object`));
  return false;
}

function requireArray(
  value: unknown,
  path: string,
  findings: Phase6AuthoritativeCompletionFinding[],
  allowEmpty = true,
): value is readonly unknown[] {
  if (!Array.isArray(value)) {
    findings.push(finding(
      "PHASE6_AUTHORITATIVE_COMPLETION_ARRAY_REQUIRED",
      path,
      `${path} must be an authoritative array`,
    ));
    return false;
  }
  if (!allowEmpty && value.length === 0) {
    findings.push(finding(
      "PHASE6_AUTHORITATIVE_COMPLETION_ARRAY_EMPTY",
      path,
      `${path} must not be empty for Phase 6 settlement`,
    ));
    return false;
  }
  return true;
}

function requireText(
  value: unknown,
  path: string,
  findings: Phase6AuthoritativeCompletionFinding[],
  code: Phase6AuthoritativeCompletionFindingCode = "PHASE6_AUTHORITATIVE_COMPLETION_FIELD_REQUIRED",
): string | undefined {
  if (typeof value === "string" && value.trim().length > 0) return value.trim();
  findings.push(finding(code, path, `${path} must be a non-empty authoritative string`));
  return undefined;
}

function requireHash(
  value: unknown,
  path: string,
  findings: Phase6AuthoritativeCompletionFinding[],
  code: Phase6AuthoritativeCompletionFindingCode,
): string | undefined {
  const text = requireText(value, path, findings, code);
  if (!text) return undefined;
  if (/^sha256:[a-f0-9]{64}$/.test(text)) return text;
  findings.push(finding(code, path, `${path} must be a sha256 hash`));
  return undefined;
}

function detectForbiddenSecret(
  value: unknown,
  path: string,
  findings: Phase6AuthoritativeCompletionFinding[],
): void {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => detectForbiddenSecret(entry, `${path}[${index}]`, findings));
    return;
  }
  if (!isRecord(value)) return;
  for (const [key, child] of Object.entries(value)) {
    const childPath = `${path}.${key}`;
    const normalizedKey = key.toLowerCase();
    if (
      normalizedKey.includes("secret")
      || normalizedKey.includes("recoverycode")
      || normalizedKey === "token"
      || normalizedKey.endsWith("token")
      || normalizedKey === "password"
    ) {
      findings.push(finding(
        "PHASE6_AUTHORITATIVE_COMPLETION_SECRET_FORBIDDEN",
        childPath,
        `${childPath} must not be included in Phase 6 completion input`,
      ));
      continue;
    }
    detectForbiddenSecret(child, childPath, findings);
  }
}

function sameStringSet(left: readonly string[], right: readonly string[]): boolean {
  const normalizedLeft = [...new Set(left)].sort();
  const normalizedRight = [...new Set(right)].sort();
  return normalizedLeft.length === normalizedRight.length
    && normalizedLeft.every((value, index) => value === normalizedRight[index]);
}

function uniqueText(values: readonly unknown[]): readonly string[] {
  return [...new Set(values
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .map((value) => value.trim()))];
}

function validateMetricMap(
  value: unknown,
  dimensions: readonly string[],
  path: string,
  code: "PHASE6_AUTHORITATIVE_COMPLETION_SCORE_INVALID" | "PHASE6_AUTHORITATIVE_COMPLETION_SUITABILITY_INVALID",
  findings: Phase6AuthoritativeCompletionFinding[],
): void {
  if (!isRecord(value)) {
    findings.push(finding(code, path, `${path} must be supplied by server scoring`));
    return;
  }
  const expected = [...dimensions].sort();
  const actual = Object.keys(value).sort();
  if (!sameStringSet(actual, expected)) {
    findings.push(finding(code, path, `${path} must contain exactly the required dimensions`, {
      expected,
      actual,
    }));
  }
  for (const dimension of dimensions) {
    const metric = value[dimension];
    if (!isRecord(metric)) {
      findings.push(finding(code, `${path}.${dimension}`, "server metric is required"));
      continue;
    }
    if (typeof metric.value !== "number" || !Number.isFinite(metric.value) || metric.value < 0 || metric.value > 100) {
      findings.push(finding(code, `${path}.${dimension}.value`, "server metric must be between 0 and 100"));
    }
    if (!Array.isArray(metric.evidence) || metric.evidence.some((entry) =>
      typeof entry !== "string" || entry.trim().length === 0)) {
      findings.push(finding(
        code,
        `${path}.${dimension}.evidence`,
        "server metric evidence must contain only non-empty strings",
      ));
    }
  }
}

function validateRag(
  serverRag: UnknownRecord,
  findings: Phase6AuthoritativeCompletionFinding[],
): void {
  if (!requireRecord(
    serverRag.grounding,
    "$.serverRag.grounding",
    findings,
    "PHASE6_AUTHORITATIVE_COMPLETION_RAG_INVALID",
  )) return;
  const grounding = serverRag.grounding;
  const queryHash = requireHash(
    grounding.queryHash,
    "$.serverRag.grounding.queryHash",
    findings,
    "PHASE6_AUTHORITATIVE_COMPLETION_RAG_INVALID",
  );
  requireHash(
    grounding.corpusHash,
    "$.serverRag.grounding.corpusHash",
    findings,
    "PHASE6_AUTHORITATIVE_COMPLETION_RAG_INVALID",
  );
  const claimSourceIds: string[] = [];
  if (requireArray(grounding.claims, "$.serverRag.grounding.claims", findings)) {
    grounding.claims.forEach((claim, index) => {
      const path = `$.serverRag.grounding.claims[${index}]`;
      if (!requireRecord(claim, path, findings, "PHASE6_AUTHORITATIVE_COMPLETION_RAG_INVALID")) return;
      requireText(claim.claimId, `${path}.claimId`, findings, "PHASE6_AUTHORITATIVE_COMPLETION_RAG_INVALID");
      const sourceId = requireText(
        claim.sourceId,
        `${path}.sourceId`,
        findings,
        "PHASE6_AUTHORITATIVE_COMPLETION_RAG_INVALID",
      );
      if (sourceId) claimSourceIds.push(sourceId);
      requireHash(
        claim.sourceHash,
        `${path}.sourceHash`,
        findings,
        "PHASE6_AUTHORITATIVE_COMPLETION_RAG_INVALID",
      );
      if (typeof claim.relevance !== "number" || !Number.isFinite(claim.relevance)) {
        findings.push(finding(
          "PHASE6_AUTHORITATIVE_COMPLETION_RAG_INVALID",
          `${path}.relevance`,
          "RAG claim relevance must be a finite server value",
        ));
      }
    });
  }
  if (!requireRecord(
    serverRag.resultPage,
    "$.serverRag.resultPage",
    findings,
    "PHASE6_AUTHORITATIVE_COMPLETION_RAG_INVALID",
  )) return;
  const resultPage = serverRag.resultPage;
  if (queryHash && resultPage.retrievalSnapshotId !== queryHash) {
    findings.push(finding(
      "PHASE6_AUTHORITATIVE_COMPLETION_RAG_INVALID",
      "$.serverRag.resultPage.retrievalSnapshotId",
      "RAG result section must bind the receipt queryHash",
      { expected: queryHash, actual: resultPage.retrievalSnapshotId },
    ));
  }
  if (!Array.isArray(resultPage.evidenceIds)
    || !sameStringSet(uniqueText(resultPage.evidenceIds), uniqueText(claimSourceIds))) {
    findings.push(finding(
      "PHASE6_AUTHORITATIVE_COMPLETION_RAG_INVALID",
      "$.serverRag.resultPage.evidenceIds",
      "RAG result evidenceIds must exactly bind server grounding claim sourceIds",
    ));
  }
}

function validateCanonicalEvents(
  canonicalEvents: readonly unknown[],
  eventIds: UnknownRecord | undefined,
  deltas: readonly unknown[],
  findings: Phase6AuthoritativeCompletionFinding[],
): readonly string[] {
  const canonicalEventIds: string[] = [];
  canonicalEvents.forEach((event, index) => {
    const path = `$.canonicalEvents[${index}]`;
    if (!requireRecord(
      event,
      path,
      findings,
      "PHASE6_AUTHORITATIVE_COMPLETION_CANONICAL_EVENT_INVALID",
    )) return;
    const eventId = requireText(
      event.eventId,
      `${path}.eventId`,
      findings,
      "PHASE6_AUTHORITATIVE_COMPLETION_CANONICAL_EVENT_INVALID",
    );
    requireText(
      event.eventType,
      `${path}.eventType`,
      findings,
      "PHASE6_AUTHORITATIVE_COMPLETION_CANONICAL_EVENT_INVALID",
    );
    if (eventId) canonicalEventIds.push(eventId);
  });
  if (new Set(canonicalEventIds).size !== canonicalEventIds.length) {
    findings.push(finding(
      "PHASE6_AUTHORITATIVE_COMPLETION_CANONICAL_EVENT_INVALID",
      "$.canonicalEvents",
      "canonicalEvents must not contain duplicate eventIds",
    ));
  }
  if (!eventIds) return uniqueText(canonicalEventIds);
  const source = Array.isArray(eventIds.source) ? uniqueText(eventIds.source) : [];
  const settlement = Array.isArray(eventIds.settlement) ? uniqueText(eventIds.settlement) : [];
  const derived = Array.isArray(eventIds.derived) ? uniqueText(eventIds.derived) : [];
  const categorizedEventIds = [...source, ...settlement, ...derived];
  const receiptEventIds = uniqueText(categorizedEventIds);
  if (categorizedEventIds.length !== receiptEventIds.length) {
    findings.push(finding(
      "PHASE6_AUTHORITATIVE_COMPLETION_EVENT_BINDING_MISMATCH",
      "$.stateDelta.eventIds",
      "source, settlement, and derived eventIds must be disjoint",
    ));
  }
  if (!sameStringSet(canonicalEventIds, receiptEventIds)) {
    findings.push(finding(
      "PHASE6_AUTHORITATIVE_COMPLETION_EVENT_BINDING_MISMATCH",
      "$.stateDelta.eventIds",
      "receipt eventIds must exactly partition the canonical eventIds",
      { canonicalEventIds: uniqueText(canonicalEventIds), receiptEventIds },
    ));
  }
  deltas.forEach((delta, index) => {
    if (!isRecord(delta) || !Array.isArray(delta.eventIds)) return;
    for (const eventId of uniqueText(delta.eventIds)) {
      if (!receiptEventIds.includes(eventId)) {
        findings.push(finding(
          "PHASE6_AUTHORITATIVE_COMPLETION_EVENT_BINDING_MISMATCH",
          `$.stateDelta.deltas[${index}].eventIds`,
          "state delta eventId must be part of the canonical receipt eventIds",
          { eventId },
        ));
      }
    }
  });
  return uniqueText(canonicalEventIds);
}

function beforePanelFromStoredContext(
  storedContext: UnknownRecord,
  findings: Phase6AuthoritativeCompletionFinding[],
): Phase6PanelSnapshotAdapterInput | undefined {
  if (!requireRecord(
    storedContext.beforeSnapshot,
    "$.storedContext.beforeSnapshot",
    findings,
    "PHASE6_AUTHORITATIVE_COMPLETION_STORED_CONTEXT_INVALID",
  )) return undefined;
  const before = storedContext.beforeSnapshot;
  const valid = [
    requireRecord(before.player, "$.storedContext.beforeSnapshot.player", findings, "PHASE6_AUTHORITATIVE_COMPLETION_STORED_CONTEXT_INVALID"),
    requireRecord(before.progress, "$.storedContext.beforeSnapshot.progress", findings, "PHASE6_AUTHORITATIVE_COMPLETION_STORED_CONTEXT_INVALID"),
    requireRecord(before.economy, "$.storedContext.beforeSnapshot.economy", findings, "PHASE6_AUTHORITATIVE_COMPLETION_STORED_CONTEXT_INVALID"),
    requireRecord(before.ragPanel, "$.storedContext.beforeSnapshot.ragPanel", findings, "PHASE6_AUTHORITATIVE_COMPLETION_STORED_CONTEXT_INVALID"),
    requireRecord(before.worldCursor, "$.storedContext.beforeSnapshot.worldCursor", findings, "PHASE6_AUTHORITATIVE_COMPLETION_STORED_CONTEXT_INVALID"),
  ].every(Boolean);
  if (!valid) return undefined;
  return {
    phase: "before",
    player: before.player as Phase6PanelSnapshotAdapterInput["player"],
    progress: before.progress as Phase6PanelSnapshotAdapterInput["progress"],
    economy: before.economy as Phase6PanelSnapshotAdapterInput["economy"],
    ragPanel: before.ragPanel as Phase6PanelSnapshotAdapterInput["ragPanel"],
    worldCursor: before.worldCursor as Phase6PanelSnapshotAdapterInput["worldCursor"],
  };
}

function worldBinding(
  storedContext: UnknownRecord,
  afterPanel: UnknownRecord,
  afterProjection: UnknownRecord,
  findings: Phase6AuthoritativeCompletionFinding[],
): Phase6AuthoritativeWorldCursor | undefined {
  const before = isRecord(storedContext.beforeSnapshot) ? storedContext.beforeSnapshot : undefined;
  const beforeCursor = before && isRecord(before.worldCursor) ? before.worldCursor : undefined;
  const afterCursor = isRecord(afterPanel.worldCursor) ? afterPanel.worldCursor : undefined;
  const projectionCursor = isRecord(afterProjection.worldCursor) ? afterProjection.worldCursor : undefined;
  if (!beforeCursor || !afterCursor || !projectionCursor) {
    findings.push(finding(
      "PHASE6_AUTHORITATIVE_COMPLETION_STORED_CONTEXT_INVALID",
      "$.storedContext.beforeSnapshot.worldCursor",
      "stored before, after panel, and after projection world cursors are required",
    ));
    return undefined;
  }
  const worldId = requireText(
    beforeCursor.epochId,
    "$.storedContext.beforeSnapshot.worldCursor.epochId",
    findings,
    "PHASE6_AUTHORITATIVE_COMPLETION_STORED_CONTEXT_INVALID",
  );
  const afterWorldId = requireText(
    afterCursor.epochId,
    "$.afterPanel.worldCursor.epochId",
    findings,
    "PHASE6_AUTHORITATIVE_COMPLETION_FIELD_REQUIRED",
  );
  const regionId = requireText(afterCursor.regionId, "$.afterPanel.worldCursor.regionId", findings);
  const worldTimeBefore = requireText(
    beforeCursor.worldTime,
    "$.storedContext.beforeSnapshot.worldCursor.worldTime",
    findings,
    "PHASE6_AUTHORITATIVE_COMPLETION_STORED_CONTEXT_INVALID",
  );
  const worldTimeAfter = requireText(afterCursor.worldTime, "$.afterPanel.worldCursor.worldTime", findings);
  for (const [field, expected, actual] of [
    ["epochId", afterWorldId, projectionCursor.epochId],
    ["regionId", regionId, projectionCursor.regionId],
    ["worldTime", worldTimeAfter, projectionCursor.worldTime],
  ] as const) {
    if (expected !== undefined && actual !== expected) {
      findings.push(finding(
        "PHASE6_AUTHORITATIVE_COMPLETION_BINDING_MISMATCH",
        `$.afterProjection.worldCursor.${field}`,
        "after projection world cursor must exactly match the after panel",
        { expected, actual },
      ));
    }
  }
  if (worldId && afterWorldId && worldId !== afterWorldId) {
    findings.push(finding(
      "PHASE6_AUTHORITATIVE_COMPLETION_BINDING_MISMATCH",
      "$.afterPanel.worldCursor.epochId",
      "before and after world ids must match",
      { expected: worldId, actual: afterWorldId },
    ));
  }
  if (!worldId || !regionId || !worldTimeBefore || !worldTimeAfter) return undefined;
  return { worldId, regionId, worldTimeBefore, worldTimeAfter };
}

function experimentBinding(
  storedContext: UnknownRecord,
  findings: Phase6AuthoritativeCompletionFinding[],
): Phase6AuthoritativeExperimentBinding | undefined {
  if (!requireRecord(
    storedContext.metadata,
    "$.storedContext.metadata",
    findings,
    "PHASE6_AUTHORITATIVE_COMPLETION_STORED_CONTEXT_INVALID",
  )) return undefined;
  const metadata = storedContext.metadata;
  const seed = isRecord(metadata.seed) ? metadata.seed : undefined;
  const versions = isRecord(metadata.versions) ? metadata.versions : undefined;
  const scenarioMatrix = isRecord(metadata.scenarioMatrix) ? metadata.scenarioMatrix : undefined;
  const experimentId = requireText(
    metadata.experimentId,
    "$.storedContext.metadata.experimentId",
    findings,
    "PHASE6_AUTHORITATIVE_COMPLETION_STORED_CONTEXT_INVALID",
  );
  const seedValue = requireText(
    seed?.seed,
    "$.storedContext.metadata.seed.seed",
    findings,
    "PHASE6_AUTHORITATIVE_COMPLETION_STORED_CONTEXT_INVALID",
  );
  const rulesetVersion = requireText(
    versions?.rulesVersion,
    "$.storedContext.metadata.versions.rulesVersion",
    findings,
    "PHASE6_AUTHORITATIVE_COMPLETION_STORED_CONTEXT_INVALID",
  );
  const catalogVersion = requireText(
    versions?.catalogVersion,
    "$.storedContext.metadata.versions.catalogVersion",
    findings,
    "PHASE6_AUTHORITATIVE_COMPLETION_STORED_CONTEXT_INVALID",
  );
  const codeVersion = requireText(
    versions?.codeVersion,
    "$.storedContext.metadata.versions.codeVersion",
    findings,
    "PHASE6_AUTHORITATIVE_COMPLETION_STORED_CONTEXT_INVALID",
  );
  const scenarioMatrixVersion = requireText(
    scenarioMatrix?.version,
    "$.storedContext.metadata.scenarioMatrix.version",
    findings,
    "PHASE6_AUTHORITATIVE_COMPLETION_STORED_CONTEXT_INVALID",
  );
  const runIndex = metadata.runIndex;
  if (!Number.isInteger(runIndex) || (runIndex as number) < 1 || (runIndex as number) > 10) {
    findings.push(finding(
      "PHASE6_AUTHORITATIVE_COMPLETION_STORED_CONTEXT_INVALID",
      "$.storedContext.metadata.runIndex",
      "stored Phase 6 runIndex must be an integer from 1 to 10",
    ));
  }
  if (
    !experimentId
    || !seedValue
    || !rulesetVersion
    || !catalogVersion
    || !codeVersion
    || !scenarioMatrixVersion
    || !Number.isInteger(runIndex)
  ) return undefined;
  return {
    experimentId,
    runIndex: runIndex as number,
    seed: seedValue,
    rulesetVersion,
    catalogVersion,
    codeVersion,
    scenarioMatrixVersion,
  };
}

export function buildPhase6AuthoritativeCompletion(
  explicitInput: unknown,
): Phase6AuthoritativeCompletionBuildResult {
  if (!isRecord(explicitInput)) {
    return failure([finding(
      "PHASE6_AUTHORITATIVE_COMPLETION_INPUT_MISSING",
      "$",
      "phase6CompletionInput must be an explicit pre-settlement authoritative object",
    )]);
  }

  const findings: Phase6AuthoritativeCompletionFinding[] = [];
  detectForbiddenSecret(explicitInput, "$", findings);
  for (const field of ["receipt", "resultPage", "finalizedReceipt", "verifiedResultPage"] as const) {
    if (field in explicitInput) {
      findings.push(finding(
        "PHASE6_AUTHORITATIVE_COMPLETION_LEGACY_FINALIZED_INPUT_REJECTED",
        `$.${field}`,
        `legacy ${field} input cannot authorize Phase 6 settlement`,
      ));
    }
  }

  const hasStoredContext = requireRecord(
    explicitInput.storedContext,
    "$.storedContext",
    findings,
    "PHASE6_AUTHORITATIVE_COMPLETION_STORED_CONTEXT_INVALID",
  );
  const hasSettlement = requireRecord(explicitInput.settlement, "$.settlement", findings);
  const hasAfterPanel = requireRecord(explicitInput.afterPanel, "$.afterPanel", findings);
  const hasAfterProjection = requireRecord(explicitInput.afterProjection, "$.afterProjection", findings);
  const hasCanonicalEvents = requireArray(explicitInput.canonicalEvents, "$.canonicalEvents", findings, false);
  const hasEconomy = requireRecord(explicitInput.economy, "$.economy", findings);
  const hasServerScoring = requireRecord(explicitInput.serverScoring, "$.serverScoring", findings);
  const hasServerRag = requireRecord(explicitInput.serverRag, "$.serverRag", findings);
  const hasStateDelta = requireRecord(explicitInput.stateDelta, "$.stateDelta", findings);
  const hasActionResolutions = requireArray(
    explicitInput.actionResolutions,
    "$.actionResolutions",
    findings,
  );
  const actionResolutions = hasActionResolutions
    ? explicitInput.actionResolutions as readonly unknown[]
    : [];
  if (explicitInput.outcome === undefined) {
    findings.push(finding(
      "PHASE6_AUTHORITATIVE_COMPLETION_FIELD_REQUIRED",
      "$.outcome",
      "$.outcome must be supplied by authoritative server settlement",
    ));
  }

  const storedContext: UnknownRecord = hasStoredContext ? explicitInput.storedContext as UnknownRecord : {};
  const settlement: UnknownRecord = hasSettlement ? explicitInput.settlement as UnknownRecord : {};
  const afterPanel: UnknownRecord = hasAfterPanel ? explicitInput.afterPanel as UnknownRecord : {};
  const afterProjection: UnknownRecord = hasAfterProjection ? explicitInput.afterProjection as UnknownRecord : {};
  const economy: UnknownRecord = hasEconomy ? explicitInput.economy as UnknownRecord : {};
  const serverScoring: UnknownRecord = hasServerScoring ? explicitInput.serverScoring as UnknownRecord : {};
  const serverRag: UnknownRecord = hasServerRag ? explicitInput.serverRag as UnknownRecord : {};
  const stateDelta: UnknownRecord = hasStateDelta ? explicitInput.stateDelta as UnknownRecord : {};

  const receiptId = requireText(settlement.receiptId, "$.settlement.receiptId", findings);
  const agentId = requireText(settlement.agentId, "$.settlement.agentId", findings);
  const explorerId = requireText(settlement.explorerId, "$.settlement.explorerId", findings);
  const generatedAt = requireText(settlement.generatedAt, "$.settlement.generatedAt", findings);
  const startedAt = requireText(settlement.startedAt, "$.settlement.startedAt", findings);
  const settledAt = requireText(settlement.settledAt, "$.settlement.settledAt", findings);
  const auditId = settlement.auditId === undefined
    ? receiptId
    : requireText(settlement.auditId, "$.settlement.auditId", findings);
  const journeyId = isRecord(storedContext.metadata)
    ? requireText(
      storedContext.metadata.journeyId,
      "$.storedContext.metadata.journeyId",
      findings,
      "PHASE6_AUTHORITATIVE_COMPLETION_STORED_CONTEXT_INVALID",
    )
    : undefined;
  const runId = isRecord(storedContext.metadata)
    ? requireText(
      storedContext.metadata.runId,
      "$.storedContext.metadata.runId",
      findings,
      "PHASE6_AUTHORITATIVE_COMPLETION_STORED_CONTEXT_INVALID",
    )
    : undefined;
  const storedContextHash = requireHash(
    storedContext.beforeSnapshotHash,
    "$.storedContext.beforeSnapshotHash",
    findings,
    "PHASE6_AUTHORITATIVE_COMPLETION_STORED_CONTEXT_INVALID",
  );
  if (receiptId && typeof storedContext.settledReceiptId === "string"
    && storedContext.settledReceiptId.trim() !== receiptId) {
    findings.push(finding(
      "PHASE6_AUTHORITATIVE_COMPLETION_BINDING_MISMATCH",
      "$.storedContext.settledReceiptId",
      "stored context is already bound to another receipt",
      { expected: receiptId, actual: storedContext.settledReceiptId },
    ));
  }
  if (afterPanel.phase !== "after") {
    findings.push(finding(
      "PHASE6_AUTHORITATIVE_COMPLETION_BINDING_MISMATCH",
      "$.afterPanel.phase",
      "afterPanel.phase must be after",
      { actual: afterPanel.phase },
    ));
  }
  if (requireRecord(afterPanel.player, "$.afterPanel.player", findings)) {
    const panelAgentId = requireText(afterPanel.player.agentId, "$.afterPanel.player.agentId", findings);
    const panelExplorerId = requireText(afterPanel.player.explorerId, "$.afterPanel.player.explorerId", findings);
    if (agentId && panelAgentId && agentId !== panelAgentId) {
      findings.push(finding(
        "PHASE6_AUTHORITATIVE_COMPLETION_BINDING_MISMATCH",
        "$.afterPanel.player.agentId",
        "after panel agentId must match settlement metadata",
        { expected: agentId, actual: panelAgentId },
      ));
    }
    if (explorerId && panelExplorerId && explorerId !== panelExplorerId) {
      findings.push(finding(
        "PHASE6_AUTHORITATIVE_COMPLETION_BINDING_MISMATCH",
        "$.afterPanel.player.explorerId",
        "after panel explorerId must match settlement metadata",
        { expected: explorerId, actual: panelExplorerId },
      ));
    }
  }

  if (hasEconomy) {
    requireRecord(economy.next, "$.economy.next", findings);
    if (economy.flows === undefined && economy.sourceEvents === undefined) {
      findings.push(finding(
        "PHASE6_AUTHORITATIVE_COMPLETION_FIELD_REQUIRED",
        "$.economy.flows",
        "economy must include authoritative flows or sourceEvents",
      ));
    }
    if (economy.flows !== undefined) requireArray(economy.flows, "$.economy.flows", findings);
    if (economy.sourceEvents !== undefined) {
      requireArray(economy.sourceEvents, "$.economy.sourceEvents", findings);
    }
  }

  if (hasServerScoring) {
    requireRecord(serverScoring.scoreMission, "$.serverScoring.scoreMission", findings);
    validateJourneyRunScore(serverScoring.score).issues.forEach((issue) => findings.push(finding(
      "PHASE6_AUTHORITATIVE_COMPLETION_SCORE_INVALID",
      `$.serverScoring.score${issue.path === "$" ? "" : issue.path.slice(1)}`,
      issue.code,
    )));
    validateMetricMap(
      serverScoring.suitability,
      JOURNEY_RUN_SUITABILITY_DIMENSIONS,
      "$.serverScoring.suitability",
      "PHASE6_AUTHORITATIVE_COMPLETION_SUITABILITY_INVALID",
      findings,
    );
    const serverScore = serverScoring.score;
    if (isRecord(serverScore)
      && isRecord(serverScore.dimensions)
      && Object.values(serverScore.dimensions).length === 8
      && Object.values(serverScore.dimensions).every((metric) => isRecord(metric) && metric.value === 94)) {
      findings.push(finding(
        "PHASE6_AUTHORITATIVE_COMPLETION_FIXED_94_REJECTED",
        "$.serverScoring.score",
        "Phase 6 score cannot be the fixed fallback 94 vector",
      ));
    }
  }
  if (hasServerRag) validateRag(serverRag, findings);

  const deltas = hasStateDelta && requireArray(stateDelta.deltas, "$.stateDelta.deltas", findings)
    ? stateDelta.deltas
    : [];
  let eventIds: UnknownRecord | undefined;
  if (hasStateDelta && requireRecord(stateDelta.eventIds, "$.stateDelta.eventIds", findings)) {
    eventIds = stateDelta.eventIds;
    for (const field of ["source", "settlement", "derived"] as const) {
      requireArray(eventIds[field], `$.stateDelta.eventIds.${field}`, findings);
    }
  }
  if (hasStateDelta) {
    requireRecord(stateDelta.world, "$.stateDelta.world", findings);
    requireRecord(stateDelta.identityProgression, "$.stateDelta.identityProgression", findings);
  }

  const canonicalEvents: readonly unknown[] = hasCanonicalEvents
    ? explicitInput.canonicalEvents as readonly unknown[]
    : [];
  const canonicalEventIds = validateCanonicalEvents(canonicalEvents, eventIds, deltas, findings);
  if (hasActionResolutions) {
    actionResolutions.forEach((resolution, index) => {
      const path = `$.actionResolutions[${index}]`;
      if (!requireRecord(resolution, path, findings)) return;
      if (resolution.authority !== "server") {
        findings.push(finding(
          "PHASE6_AUTHORITATIVE_COMPLETION_BINDING_MISMATCH",
          `${path}.authority`,
          "Phase 6 action resolution authority must be server",
          { actual: resolution.authority },
        ));
      }
    });
  }
  if (explicitInput.storyReport !== undefined) {
    requireRecord(explicitInput.storyReport, "$.storyReport", findings);
  }
  if (explicitInput.journeyRuntime !== undefined) {
    requireRecord(explicitInput.journeyRuntime, "$.journeyRuntime", findings);
  }
  if (explicitInput.now !== undefined) requireText(explicitInput.now, "$.now", findings);

  const beforePanel = beforePanelFromStoredContext(storedContext, findings);
  const world = worldBinding(storedContext, afterPanel, afterProjection, findings);
  const experiment = experimentBinding(storedContext, findings);
  const beforeSnapshot = beforePanel ? buildPhase6PanelSnapshotDocument(beforePanel) : undefined;
  const afterSnapshot = hasAfterPanel
    ? buildPhase6PanelSnapshotDocument(afterPanel as unknown as Phase6PanelSnapshotAdapterInput)
    : undefined;
  for (const [path, snapshot] of [
    ["$.storedContext.beforeSnapshot", beforeSnapshot],
    ["$.afterPanel", afterSnapshot],
  ] as const) {
    if (snapshot && !snapshot.ok) {
      snapshot.errors.forEach((issue) => findings.push(finding(
        "PHASE6_AUTHORITATIVE_COMPLETION_SNAPSHOT_INVALID",
        `${path}${issue.path === "$" ? "" : issue.path.slice(1)}`,
        issue.message,
        { snapshotCode: issue.code },
      )));
    }
  }

  if (
    findings.length > 0
    || !journeyId
    || !runId
    || !receiptId
    || !agentId
    || !explorerId
    || !generatedAt
    || !startedAt
    || !settledAt
    || !auditId
    || !storedContextHash
    || !beforePanel
    || !world
    || !experiment
    || !beforeSnapshot?.ok
    || !afterSnapshot?.ok
  ) return failure(findings);

  const score = serverScoring.score as JourneyRunScore;
  const suitability = serverScoring.suitability as JourneyRunSuitability;
  const grounding = serverRag.grounding as unknown as JourneyRunRagGrounding;
  const classifiedEventIds = stateDelta.eventIds as unknown as BuildJourneyRunReceiptInput["eventIds"];
  const scores = phase6ResultPageScoreDetails(score, canonicalEventIds);
  const completion: Phase6McpJourneyCompletionContextInput = {
    metadata: {
      runId,
      journeyId,
      agentId,
      explorerId,
      receiptId,
      generatedAt,
      startedAt,
      settledAt,
      world,
    },
    afterPanel: explicitInput.afterPanel as Phase6PanelSnapshotAdapterInput,
    afterProjection: explicitInput.afterProjection as Phase6ProjectionForDelta,
    canonicalEvents: canonicalEvents as readonly EpochEvent[],
    economy: {
      next: economy.next as Phase6EconomySnapshot,
      ...(economy.flows !== undefined
        ? { flows: economy.flows as readonly Phase6EconomyResourceFlow[] }
        : {}),
      ...(economy.sourceEvents !== undefined
        ? { sourceEvents: economy.sourceEvents as readonly unknown[] }
        : {}),
    },
    receipt: {
      deltas: deltas as readonly JourneyRunStructuredDelta[],
      score,
      suitability,
      rag: grounding,
      eventIds: classifiedEventIds,
      snapshots: {
        before: {
          body: beforeSnapshot.value.snapshot as unknown as CausalCanonicalJsonValue,
          hash: beforeSnapshot.value.hash,
        },
        after: {
          body: afterSnapshot.value.snapshot as unknown as CausalCanonicalJsonValue,
          hash: afterSnapshot.value.hash,
        },
      },
      outcome: explicitInput.outcome as BuildJourneyRunReceiptInput["outcome"],
    },
    resultPage: {
      world: stateDelta.world as unknown as Phase6ResultPageChangeSet,
      identityProgression: stateDelta.identityProgression as unknown as Phase6ResultPageIdentityProgressionSection,
      settlement: {
        status: "settled",
        settlementId: receiptId,
        eventIds: classifiedEventIds.settlement,
      },
      scoreSummary: phase6ResultPageScoreSummary(score),
      scores,
      rag: serverRag.resultPage as unknown as Phase6ResultPageRagSection,
      audit: {
        auditId,
        eventIds: canonicalEventIds,
      },
    },
    ...(typeof explicitInput.now === "string" ? { now: explicitInput.now.trim() } : {}),
    ...(explicitInput.journeyRuntime !== undefined
      ? { journeyRuntime: explicitInput.journeyRuntime as Phase6McpJourneyCompletionContextInput["journeyRuntime"] }
      : {}),
    actionResolutions: actionResolutions as readonly JourneyActionResolution[],
    ...(explicitInput.storyReport !== undefined
      ? { storyReport: explicitInput.storyReport as GroundedJourneyStoryReport }
      : {}),
  };
  const canonicalArtifacts: Phase6AuthoritativePostSettlementArtifacts = {
    afterPanel: completion.afterPanel,
    afterProjection: completion.afterProjection,
    canonicalEvents: completion.canonicalEvents,
    economy: completion.economy,
    worldCursor: world,
    experimentBinding: experiment,
    auditId,
    checkedAt: settledAt,
  };

  return {
    ok: true,
    status: "pre_settlement",
    finalized: false,
    verified: false,
    builderVersion: PHASE6_AUTHORITATIVE_COMPLETION_BUILDER_VERSION,
    deterministic: true,
    completion,
    postSettlement: { canonicalArtifacts },
    sourceBindings: {
      storedContextHash,
      canonicalEventIds,
      scoreMission: serverScoring.scoreMission as UnknownRecord,
    },
    mcpTools: {
      finalizePhase6Journey: {
        journeyId,
        completion,
      },
    },
    findings: [],
  };
}
