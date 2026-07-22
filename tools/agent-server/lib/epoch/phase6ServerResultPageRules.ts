import type { EpochEvent } from "./events.ts";
import {
  buildPhase6MachineReadableResultPage,
  PHASE6_RESULT_PAGE_SCORE_DIMENSIONS,
  phase6ResultPageScoreDetails,
  phase6ResultPageScoreSummary,
  type Phase6MachineReadableResultPage,
  type Phase6ResultPageAuditSection,
  type Phase6ResultPageChange,
  type Phase6ResultPageChangeSet,
  type Phase6ResultPageFinding,
  type Phase6ResultPageFindingCode,
  type Phase6ResultPageInput,
  type Phase6ResultPageRagSection,
  type Phase6ResultPageReceiptEventRef,
  type Phase6ResultPageRunSettlement,
  type Phase6ResultPageScoreDetail,
  type Phase6ResultPageScoreSummary,
} from "./phase6ResultPageRules.ts";
import {
  JOURNEY_RUN_RECEIPT_AUTHORITY,
  JOURNEY_RUN_RECEIPT_LEGACY_VERSION,
  JOURNEY_RUN_RECEIPT_VERSION,
  JOURNEY_RUN_SUITABILITY_DIMENSIONS,
  journeyRunReceiptPayloadHash,
  validateJourneyRunReceipt,
  type JourneyRunReceipt,
} from "./journeyRunReceiptRules.ts";
import { stableResultPageJson } from "./stableResultPageJson.ts";
import { sha256Hex } from "./runtimeAuth.ts";

type AnyRecord = Readonly<Record<string, unknown>>;
type Mutable<T> = { -readonly [K in keyof T]: T[K] };

export const PHASE6_SERVER_RESULT_PAGE_RULESET_VERSION =
  "obsidian-epoch-phase6-server-result-page-v0.2.0" as const;

export type Phase6ServerResultPageStatus = "draft" | "verified";

export type Phase6ServerResultPageFindingCode =
  | Phase6ResultPageFindingCode
  | "PHASE6_SERVER_RESULT_PAGE_RECEIPT_MISSING"
  | "PHASE6_SERVER_RESULT_PAGE_RECEIPT_NOT_FINALIZED"
  | "PHASE6_SERVER_RESULT_PAGE_LEGACY_RECEIPT_REJECTED"
  | "PHASE6_SERVER_RESULT_PAGE_RECEIPT_INVALID"
  | "PHASE6_SERVER_RESULT_PAGE_CANONICAL_ARTIFACT_MISSING"
  | "PHASE6_SERVER_RESULT_PAGE_CANONICAL_ARTIFACT_INVALID"
  | "PHASE6_SERVER_RESULT_PAGE_INITIAL_ARTIFACT_MISSING"
  | "PHASE6_SERVER_RESULT_PAGE_INITIAL_ARTIFACT_INVALID"
  | "PHASE6_SERVER_RESULT_PAGE_DRAFT_VERIFIED"
  | "PHASE6_SERVER_RESULT_PAGE_RECEIPT_HASH_MISMATCH"
  | "PHASE6_SERVER_RESULT_PAGE_EVENT_MISMATCH"
  | "PHASE6_SERVER_RESULT_PAGE_WORLD_CURSOR_MISMATCH"
  | "PHASE6_SERVER_RESULT_PAGE_EXPERIMENT_BINDING_MISMATCH"
  | "PHASE6_SERVER_RESULT_PAGE_SELF_REPORTED_RESULT_REJECTED"
  | "PHASE6_SERVER_RESULT_PAGE_FIXED_94_REJECTED";

export interface Phase6ServerResultPageFinding {
  readonly code: Phase6ServerResultPageFindingCode;
  readonly severity: "error";
  readonly message: string;
  readonly path?: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface Phase6ServerWorldCursor {
  readonly worldId: string;
  readonly regionId: string;
  readonly worldTimeBefore: string;
  readonly worldTimeAfter: string;
  readonly simulationVersion?: number;
}

export interface Phase6ServerExperimentBinding {
  readonly experimentId: string;
  readonly runIndex: number;
  readonly seed: string;
  readonly rulesetVersion: string;
  readonly catalogVersion: string;
  readonly codeVersion: string;
  readonly scenarioMatrixVersion: string;
}

export interface Phase6ServerEconomyArtifacts {
  readonly next: unknown;
  readonly flows?: readonly unknown[];
  readonly sourceEvents?: readonly unknown[];
  readonly conservation?: Phase6ResultPageRunSettlement["economyConservation"];
}

export interface Phase6ServerCanonicalArtifacts {
  readonly afterPanel: unknown;
  readonly afterProjection: unknown;
  readonly canonicalEvents: readonly EpochEvent[];
  readonly economy: Phase6ServerEconomyArtifacts;
  readonly worldCursor: Phase6ServerWorldCursor;
  readonly experimentBinding: Phase6ServerExperimentBinding;
  readonly auditId?: string;
  readonly checkedAt?: string;
}

export interface Phase6ServerResultPageBuildInput {
  readonly receipt?: unknown;
  readonly canonicalArtifacts?: Phase6ServerCanonicalArtifacts;
  readonly initialResultArtifact?: unknown;
  readonly clientResultPage?: unknown;
  readonly modelResultPage?: unknown;
  readonly resultPage?: unknown;
}

export interface Phase6ServerSuitabilityDetail {
  readonly dimension: typeof JOURNEY_RUN_SUITABILITY_DIMENSIONS[number];
  readonly score: number;
  readonly basis: string;
  readonly eventIds: readonly string[];
}

export interface Phase6ServerResultPageSections {
  readonly world: Phase6ResultPageChangeSet;
  readonly identityProgression: Phase6ResultPageInput["identityProgression"];
  readonly settlement: Phase6ResultPageRunSettlement;
  readonly scoreSummary: Phase6ResultPageScoreSummary;
  readonly scores: readonly Phase6ResultPageScoreDetail[];
  readonly suitability: readonly Phase6ServerSuitabilityDetail[];
  readonly rag: Phase6ResultPageRagSection;
  readonly audit: Phase6ResultPageAuditSection;
}

export interface Phase6ServerResultPageDraft {
  readonly draft: true;
  readonly verified: false;
  readonly reason: "receipt_not_finalized";
  readonly receiptId?: string;
  readonly runId?: string;
  readonly journeyId?: string;
  readonly eventIds: readonly string[];
  readonly worldCursor?: Phase6ServerWorldCursor;
  readonly experimentBinding?: Phase6ServerExperimentBinding;
  readonly canonicalArtifactBound: boolean;
  readonly initialResultArtifactBound: false;
}

export interface Phase6ServerFinalizedPageBinding {
  readonly receiptId: string;
  readonly receiptHash: string;
  readonly receiptPayloadHash: string;
  readonly eventIds: readonly string[];
  readonly worldCursor: Phase6ServerWorldCursor;
  readonly experimentBinding: Phase6ServerExperimentBinding;
  readonly initialResultArtifactHash: string;
}

export interface Phase6ServerResultPageDraftSuccess {
  readonly ok: true;
  readonly status: "draft";
  readonly finalized: false;
  readonly verified: false;
  readonly deterministic: true;
  readonly rulesetVersion: typeof PHASE6_SERVER_RESULT_PAGE_RULESET_VERSION;
  readonly draft: Phase6ServerResultPageDraft;
  readonly findings: readonly [];
}

export interface Phase6ServerResultPageBuildSuccess {
  readonly ok: true;
  readonly status: "verified";
  readonly finalized: true;
  readonly verified: true;
  readonly deterministic: true;
  readonly rulesetVersion: typeof PHASE6_SERVER_RESULT_PAGE_RULESET_VERSION;
  readonly receiptId: string;
  readonly receiptHash: string;
  readonly eventIds: readonly string[];
  readonly worldCursor: Phase6ServerWorldCursor;
  readonly experimentBinding: Phase6ServerExperimentBinding;
  readonly resultPageInput: Phase6ResultPageInput;
  readonly sections: Phase6ServerResultPageSections;
  readonly verificationBinding: Phase6ServerFinalizedPageBinding;
  readonly resultPage: Phase6MachineReadableResultPage;
  readonly resultPagePayloadHash: string;
  readonly initialResultArtifactHash: string;
  readonly findings: readonly [];
}

export interface Phase6ServerResultPageBuildFailure {
  readonly ok: false;
  readonly status: "failed";
  readonly finalized: false;
  readonly verified: false;
  readonly deterministic: true;
  readonly rulesetVersion: typeof PHASE6_SERVER_RESULT_PAGE_RULESET_VERSION;
  readonly findings: readonly Phase6ServerResultPageFinding[];
}

export type Phase6ServerResultPageBuildResult =
  | Phase6ServerResultPageDraftSuccess
  | Phase6ServerResultPageBuildSuccess
  | Phase6ServerResultPageBuildFailure;

function finding(
  code: Phase6ServerResultPageFindingCode,
  message: string,
  path?: string,
  details?: Readonly<Record<string, unknown>>,
): Phase6ServerResultPageFinding {
  return { code, severity: "error", message, path, details };
}

function failed(
  findings: readonly Phase6ServerResultPageFinding[],
): Phase6ServerResultPageBuildFailure {
  return {
    ok: false,
    status: "failed",
    finalized: false,
    verified: false,
    deterministic: true,
    rulesetVersion: PHASE6_SERVER_RESULT_PAGE_RULESET_VERSION,
    findings,
  };
}

function isRecord(value: unknown): value is AnyRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function unique(values: readonly unknown[]): readonly string[] {
  return [...new Set(values.filter(nonEmpty).map((value) => value.trim()))];
}

function sameStringSet(left: readonly string[], right: readonly string[]): boolean {
  const normalizedLeft = [...new Set(left)].sort();
  const normalizedRight = [...new Set(right)].sort();
  return normalizedLeft.length === normalizedRight.length
    && normalizedLeft.every((value, index) => value === normalizedRight[index]);
}

function eventIdOf(event: unknown): string | undefined {
  if (!isRecord(event)) return undefined;
  const candidates = [event.eventId, event.id, event.canonicalEventId];
  return candidates.find(nonEmpty)?.trim();
}

function eventTypeOf(event: unknown): string {
  return isRecord(event) && nonEmpty(event.type)
    ? event.type.trim()
    : isRecord(event) && nonEmpty(event.eventType)
      ? event.eventType.trim()
      : "journey_run_settlement";
}

function canonicalReceiptEventIds(receipt: JourneyRunReceipt): readonly string[] {
  return unique([
    ...receipt.eventIds.source,
    ...receipt.eventIds.settlement,
    ...receipt.eventIds.derived,
  ]);
}

function receiptDeltaEventIds(receipt: JourneyRunReceipt): readonly string[] {
  return unique(receipt.deltas.flatMap((delta) => delta.eventIds));
}

function changeSet(
  label: string,
  changes: readonly Phase6ResultPageChange[],
  eventIds: readonly string[],
): Phase6ResultPageChangeSet {
  return changes.length > 0
    ? { mode: "changed", changes, eventIds }
    : {
      mode: "no_change",
      changes: [],
      noChangeReason: `${label} did not change in server-settled canonical artifacts`,
      eventIds,
    };
}

function changesFromDeltas(
  receipt: JourneyRunReceipt,
  include: (delta: JourneyRunReceipt["deltas"][number]) => boolean,
): readonly Phase6ResultPageChange[] {
  return receipt.deltas.filter(include).map((delta, index) => ({
    id: `${delta.target.kind}:${delta.target.id}:${index}`,
    label: `${delta.op} ${delta.target.kind}/${delta.target.id} ${delta.path.join(".")}`,
    ...(delta.before !== undefined ? { before: delta.before } : {}),
    ...(delta.after !== undefined ? { after: delta.after } : {}),
    eventIds: delta.eventIds,
  }));
}

function scoreDetails(receipt: JourneyRunReceipt): readonly Phase6ResultPageScoreDetail[] {
  return phase6ResultPageScoreDetails(receipt.score, canonicalReceiptEventIds(receipt));
}

function suitabilityDetails(receipt: JourneyRunReceipt): readonly Phase6ServerSuitabilityDetail[] {
  const eventIds = canonicalReceiptEventIds(receipt);
  return JOURNEY_RUN_SUITABILITY_DIMENSIONS.map((dimension) => ({
    dimension,
    score: receipt.suitability[dimension].value,
    basis: receipt.suitability[dimension].evidence.length > 0
      ? receipt.suitability[dimension].evidence.join("; ")
      : "server-settled JourneyRunReceipt metric",
    eventIds,
  }));
}

function allResultScoresAreFixed94(scores: readonly Phase6ResultPageScoreDetail[]): boolean {
  return scores.length === PHASE6_RESULT_PAGE_SCORE_DIMENSIONS.length
    && scores.every((score) => score.value === 94);
}

function validateNoSelfReportedResultPage(
  input: Phase6ServerResultPageBuildInput,
  findings: Phase6ServerResultPageFinding[],
): void {
  if (input.clientResultPage !== undefined) {
    findings.push(finding(
      "PHASE6_SERVER_RESULT_PAGE_SELF_REPORTED_RESULT_REJECTED",
      "Client-reported result page is not authoritative input",
      "clientResultPage",
    ));
  }
  if (input.modelResultPage !== undefined) {
    findings.push(finding(
      "PHASE6_SERVER_RESULT_PAGE_SELF_REPORTED_RESULT_REJECTED",
      "Model-reported result page is not authoritative input",
      "modelResultPage",
    ));
  }
  if (input.resultPage !== undefined) {
    findings.push(finding(
      "PHASE6_SERVER_RESULT_PAGE_SELF_REPORTED_RESULT_REJECTED",
      "Prebuilt result page is rejected; this module only builds from receipt and server artifacts",
      "resultPage",
    ));
  }
}

function strictFinalizedReceipt(
  value: unknown,
  findings: Phase6ServerResultPageFinding[],
): JourneyRunReceipt | undefined {
  if (!isRecord(value)) {
    findings.push(finding(
      "PHASE6_SERVER_RESULT_PAGE_RECEIPT_MISSING",
      "journey_run_receipt.v2 is required",
      "receipt",
    ));
    return undefined;
  }
  if (value.version === JOURNEY_RUN_RECEIPT_LEGACY_VERSION) {
    findings.push(finding(
      "PHASE6_SERVER_RESULT_PAGE_LEGACY_RECEIPT_REJECTED",
      "Legacy journey_run_receipt.v1 cannot produce a Phase 6 result",
      "receipt.version",
    ));
    return undefined;
  }
  if (value.receiptType !== "journey_run_receipt" || value.version !== JOURNEY_RUN_RECEIPT_VERSION) {
    findings.push(finding(
      "PHASE6_SERVER_RESULT_PAGE_RECEIPT_NOT_FINALIZED",
      "Only finalized strict journey_run_receipt.v2 can produce verified Phase 6 output",
      "receipt.version",
      { receiptType: value.receiptType, version: value.version },
    ));
    return undefined;
  }
  if (value.authority !== JOURNEY_RUN_RECEIPT_AUTHORITY) {
    findings.push(finding(
      "PHASE6_SERVER_RESULT_PAGE_RECEIPT_INVALID",
      "JourneyRunReceipt authority must be server_settled",
      "receipt.authority",
      { authority: value.authority },
    ));
  }
  const validation = validateJourneyRunReceipt(value);
  if (!validation.ok) {
    for (const issue of validation.issues) {
      findings.push(finding(
        "PHASE6_SERVER_RESULT_PAGE_RECEIPT_INVALID",
        issue.code,
        `receipt${issue.path === "$" ? "" : issue.path.slice(1)}`,
      ));
    }
    return undefined;
  }
  return value as JourneyRunReceipt;
}

function isUnfinalizedReceipt(value: unknown): value is AnyRecord {
  if (
    !isRecord(value)
    || value.receiptType !== "journey_run_receipt"
    || value.version !== JOURNEY_RUN_RECEIPT_VERSION
  ) return false;
  return value.finalized === false
    || value.status === "draft";
}

function draftEventIds(receipt: AnyRecord): readonly string[] {
  if (!isRecord(receipt.eventIds)) return [];
  return unique([
    ...(Array.isArray(receipt.eventIds.source) ? receipt.eventIds.source : []),
    ...(Array.isArray(receipt.eventIds.settlement) ? receipt.eventIds.settlement : []),
    ...(Array.isArray(receipt.eventIds.derived) ? receipt.eventIds.derived : []),
  ]);
}

function buildDraftResult(
  receipt: AnyRecord,
  artifacts: Phase6ServerCanonicalArtifacts | undefined,
): Phase6ServerResultPageDraftSuccess {
  return {
    ok: true,
    status: "draft",
    finalized: false,
    verified: false,
    deterministic: true,
    rulesetVersion: PHASE6_SERVER_RESULT_PAGE_RULESET_VERSION,
    draft: {
      draft: true,
      verified: false,
      reason: "receipt_not_finalized",
      ...(nonEmpty(receipt.receiptId) ? { receiptId: receipt.receiptId.trim() } : {}),
      ...(nonEmpty(receipt.runId) ? { runId: receipt.runId.trim() } : {}),
      ...(nonEmpty(receipt.journeyId) ? { journeyId: receipt.journeyId.trim() } : {}),
      eventIds: draftEventIds(receipt),
      ...(artifacts?.worldCursor ? { worldCursor: artifacts.worldCursor } : {}),
      ...(artifacts?.experimentBinding ? { experimentBinding: artifacts.experimentBinding } : {}),
      canonicalArtifactBound: Boolean(artifacts),
      initialResultArtifactBound: false,
    },
    findings: [],
  };
}

interface Phase6ValidatedInitialResultArtifact {
  readonly page: AnyRecord;
  readonly artifactHash: string;
  readonly economyConservation: Phase6ResultPageRunSettlement["economyConservation"];
}

function isDraftArtifact(value: AnyRecord, page?: AnyRecord): boolean {
  return value.draft === true
    || value.status === "draft"
    || page?.draft === true
    || page?.status === "draft";
}

function validateDraftInvariant(
  value: unknown,
  findings: Phase6ServerResultPageFinding[],
): void {
  if (!isRecord(value)) return;
  const page = isRecord(value.page) ? value.page : undefined;
  if (isDraftArtifact(value, page) && (value.verified === true || page?.verified === true)) {
    findings.push(finding(
      "PHASE6_SERVER_RESULT_PAGE_DRAFT_VERIFIED",
      "A draft result artifact must never claim verified status",
      "initialResultArtifact.verified",
    ));
  }
}

function validateInitialResultArtifact(
  receipt: JourneyRunReceipt,
  artifacts: Phase6ServerCanonicalArtifacts,
  value: unknown,
  findings: Phase6ServerResultPageFinding[],
): Phase6ValidatedInitialResultArtifact | undefined {
  if (!isRecord(value)) {
    findings.push(finding(
      "PHASE6_SERVER_RESULT_PAGE_INITIAL_ARTIFACT_MISSING",
      "RunAssembly initial result artifact is required before Phase 6 verification",
      "initialResultArtifact",
    ));
    return undefined;
  }
  validateDraftInvariant(value, findings);
  if (value.ok !== true || (Array.isArray(value.findings) && value.findings.length > 0)) {
    findings.push(finding(
      "PHASE6_SERVER_RESULT_PAGE_INITIAL_ARTIFACT_INVALID",
      "Initial result artifact must be a successful server RunAssembly artifact",
      "initialResultArtifact",
    ));
  }
  if (!isRecord(value.page)) {
    findings.push(finding(
      "PHASE6_SERVER_RESULT_PAGE_INITIAL_ARTIFACT_INVALID",
      "Initial result artifact page is required",
      "initialResultArtifact.page",
    ));
    return undefined;
  }
  const page = value.page;
  const pageReceipt = isRecord(page.receipt) ? page.receipt : undefined;
  const expectedReceiptPayloadHash = journeyRunReceiptPayloadHash(receipt);
  const expectedEventIds = canonicalReceiptEventIds(receipt);
  if (!pageReceipt) {
    findings.push(finding(
      "PHASE6_SERVER_RESULT_PAGE_INITIAL_ARTIFACT_INVALID",
      "Initial result artifact receipt binding is required",
      "initialResultArtifact.page.receipt",
    ));
  } else {
    for (const [path, expected, actual] of [
      ["receiptId", receipt.receiptId, pageReceipt.receiptId],
      ["runId", receipt.runId, pageReceipt.runId],
      ["payloadHash", expectedReceiptPayloadHash, pageReceipt.payloadHash],
    ] as const) {
      if (actual !== expected) {
        findings.push(finding(
          path === "payloadHash"
            ? "PHASE6_SERVER_RESULT_PAGE_RECEIPT_HASH_MISMATCH"
            : "PHASE6_SERVER_RESULT_PAGE_INITIAL_ARTIFACT_INVALID",
          `Initial result artifact ${path} must bind the finalized receipt`,
          `initialResultArtifact.page.receipt.${path}`,
          { expected, actual },
        ));
      }
    }
    const pageEventIds = Array.isArray(pageReceipt.canonicalEventIds)
      ? unique(pageReceipt.canonicalEventIds)
      : [];
    if (!sameStringSet(pageEventIds, expectedEventIds)) {
      findings.push(finding(
        "PHASE6_SERVER_RESULT_PAGE_EVENT_MISMATCH",
        "Initial result artifact receipt eventIds must exactly bind the finalized receipt",
        "initialResultArtifact.page.receipt.canonicalEventIds",
        { expected: expectedEventIds, actual: pageEventIds },
      ));
    }
  }
  const pageEvents = Array.isArray(page.events) ? unique(page.events.map(eventIdOf)) : [];
  if (!sameStringSet(pageEvents, expectedEventIds)) {
    findings.push(finding(
      "PHASE6_SERVER_RESULT_PAGE_EVENT_MISMATCH",
      "Initial result artifact events must exactly bind finalized receipt eventIds",
      "initialResultArtifact.page.events",
      { expected: expectedEventIds, actual: pageEvents },
    ));
  }
  const audit = isRecord(page.audit) ? page.audit : undefined;
  const integrity = audit && isRecord(audit.integrity) ? audit.integrity : undefined;
  if (!integrity) {
    findings.push(finding(
      "PHASE6_SERVER_RESULT_PAGE_INITIAL_ARTIFACT_INVALID",
      "Initial result artifact audit integrity is required",
      "initialResultArtifact.page.audit.integrity",
    ));
  } else {
    if (integrity.receiptPayloadHash !== expectedReceiptPayloadHash) {
      findings.push(finding(
        "PHASE6_SERVER_RESULT_PAGE_RECEIPT_HASH_MISMATCH",
        "Initial result artifact audit must bind the finalized receipt payload hash",
        "initialResultArtifact.page.audit.integrity.receiptPayloadHash",
        { expected: expectedReceiptPayloadHash, actual: integrity.receiptPayloadHash },
      ));
    }
    const auditEventIds = Array.isArray(integrity.canonicalEventIds)
      ? unique(integrity.canonicalEventIds)
      : [];
    if (!sameStringSet(auditEventIds, expectedEventIds)) {
      findings.push(finding(
        "PHASE6_SERVER_RESULT_PAGE_EVENT_MISMATCH",
        "Initial result artifact audit eventIds must exactly bind the finalized receipt",
        "initialResultArtifact.page.audit.integrity.canonicalEventIds",
        { expected: expectedEventIds, actual: auditEventIds },
      ));
    }
  }
  const settlement = isRecord(page.settlement) ? page.settlement : undefined;
  if (!settlement) {
    findings.push(finding(
      "PHASE6_SERVER_RESULT_PAGE_INITIAL_ARTIFACT_INVALID",
      "Initial result artifact settlement section is required",
      "initialResultArtifact.page.settlement",
    ));
    return undefined;
  }
  if (settlement.settlementId !== receipt.receiptId) {
    findings.push(finding(
      "PHASE6_SERVER_RESULT_PAGE_INITIAL_ARTIFACT_INVALID",
      "Initial result artifact settlementId must bind the finalized receipt",
      "initialResultArtifact.page.settlement.settlementId",
      { expected: receipt.receiptId, actual: settlement.settlementId },
    ));
  }
  const settlementEventIds = Array.isArray(settlement.eventIds) ? unique(settlement.eventIds) : [];
  if (!sameStringSet(settlementEventIds, receipt.eventIds.settlement)) {
    findings.push(finding(
      "PHASE6_SERVER_RESULT_PAGE_EVENT_MISMATCH",
      "Initial result artifact settlement eventIds must match the finalized receipt",
      "initialResultArtifact.page.settlement.eventIds",
      { expected: receipt.eventIds.settlement, actual: settlementEventIds },
    ));
  }
  if (!isRecord(settlement.economyConservation)) {
    findings.push(finding(
      "PHASE6_SERVER_RESULT_PAGE_INITIAL_ARTIFACT_INVALID",
      "RunAssembly economy conservation artifact is required",
      "initialResultArtifact.page.settlement.economyConservation",
    ));
    return undefined;
  }
  if (artifacts.economy.conservation !== undefined
    && stableResultPageJson(settlement.economyConservation)
      !== stableResultPageJson(artifacts.economy.conservation)) {
    findings.push(finding(
      "PHASE6_SERVER_RESULT_PAGE_INITIAL_ARTIFACT_INVALID",
      "Initial result economy conservation must match canonical RunAssembly artifacts",
      "initialResultArtifact.page.settlement.economyConservation",
    ));
  }
  if (findings.length > 0) return undefined;
  return {
    page,
    artifactHash: `sha256:${sha256Hex(stableResultPageJson(value))}`,
    economyConservation: settlement.economyConservation as Phase6ResultPageRunSettlement["economyConservation"],
  };
}

function validateArtifacts(
  receipt: JourneyRunReceipt,
  artifacts: Phase6ServerCanonicalArtifacts | undefined,
  findings: Phase6ServerResultPageFinding[],
): artifacts is Phase6ServerCanonicalArtifacts {
  if (!artifacts) {
    findings.push(finding(
      "PHASE6_SERVER_RESULT_PAGE_CANONICAL_ARTIFACT_MISSING",
      "Canonical server artifacts are required",
      "canonicalArtifacts",
    ));
    return false;
  }
  if (!isRecord(artifacts.afterPanel)) {
    findings.push(finding(
      "PHASE6_SERVER_RESULT_PAGE_CANONICAL_ARTIFACT_INVALID",
      "afterPanel must be a server-owned object",
      "canonicalArtifacts.afterPanel",
    ));
  }
  if (!isRecord(artifacts.afterProjection)) {
    findings.push(finding(
      "PHASE6_SERVER_RESULT_PAGE_CANONICAL_ARTIFACT_INVALID",
      "afterProjection must be a server-owned object",
      "canonicalArtifacts.afterProjection",
    ));
  }
  const canonicalEvents = Array.isArray(artifacts.canonicalEvents) ? artifacts.canonicalEvents : [];
  if (!Array.isArray(artifacts.canonicalEvents)) {
    findings.push(finding(
      "PHASE6_SERVER_RESULT_PAGE_CANONICAL_ARTIFACT_INVALID",
      "canonicalEvents must be a server-owned array",
      "canonicalArtifacts.canonicalEvents",
    ));
  }
  if (!isRecord(artifacts.economy) || !isRecord(artifacts.economy.next)) {
    findings.push(finding(
      "PHASE6_SERVER_RESULT_PAGE_CANONICAL_ARTIFACT_INVALID",
      "economy.next must be supplied by server artifacts",
      "canonicalArtifacts.economy.next",
    ));
  }
  if (isRecord(artifacts.economy)) {
    if (artifacts.economy.flows === undefined && artifacts.economy.sourceEvents === undefined) {
      findings.push(finding(
        "PHASE6_SERVER_RESULT_PAGE_CANONICAL_ARTIFACT_INVALID",
        "Canonical economy must include flows or sourceEvents",
        "canonicalArtifacts.economy.flows",
      ));
    }
  }
  const cursor = artifacts.worldCursor;
  if (
    !cursor
    || cursor.worldId !== receipt.world.worldId
    || cursor.regionId !== receipt.world.regionId
    || cursor.worldTimeBefore !== receipt.world.worldTimeBefore
    || cursor.worldTimeAfter !== receipt.world.worldTimeAfter
    || cursor.simulationVersion !== receipt.world.simulationVersion
  ) {
    findings.push(finding(
      "PHASE6_SERVER_RESULT_PAGE_WORLD_CURSOR_MISMATCH",
      "World cursor must match journey_run_receipt.v2 world fields exactly",
      "canonicalArtifacts.worldCursor",
      { expected: receipt.world, actual: cursor },
    ));
  }
  for (const [path, value] of [
    ["canonicalArtifacts.afterPanel", artifacts.afterPanel],
    ["canonicalArtifacts.afterProjection", artifacts.afterProjection],
  ] as const) {
    const projection = isRecord(value) ? value : undefined;
    const projectionCursor = projection && isRecord(projection.worldCursor)
      ? projection.worldCursor
      : undefined;
    if (
      !projectionCursor
      || projectionCursor.epochId !== receipt.world.worldId
      || projectionCursor.regionId !== receipt.world.regionId
      || projectionCursor.worldTime !== receipt.world.worldTimeAfter
    ) {
      findings.push(finding(
        "PHASE6_SERVER_RESULT_PAGE_WORLD_CURSOR_MISMATCH",
        "After artifact world cursor must bind the finalized receipt world cursor",
        `${path}.worldCursor`,
        {
          expected: {
            epochId: receipt.world.worldId,
            regionId: receipt.world.regionId,
            worldTime: receipt.world.worldTimeAfter,
          },
          actual: projectionCursor,
        },
      ));
    }
  }
  const binding = artifacts.experimentBinding;
  const expectedBinding: Phase6ServerExperimentBinding = {
    experimentId: receipt.experimentId,
    runIndex: receipt.runIndex,
    seed: receipt.seed,
    rulesetVersion: receipt.rulesetVersion,
    catalogVersion: receipt.catalogVersion,
    codeVersion: receipt.codeVersion,
    scenarioMatrixVersion: receipt.scenarioMatrixVersion,
  };
  if (
    !binding
    || binding.experimentId !== expectedBinding.experimentId
    || binding.runIndex !== expectedBinding.runIndex
    || binding.seed !== expectedBinding.seed
    || binding.rulesetVersion !== expectedBinding.rulesetVersion
    || binding.catalogVersion !== expectedBinding.catalogVersion
    || binding.codeVersion !== expectedBinding.codeVersion
    || binding.scenarioMatrixVersion !== expectedBinding.scenarioMatrixVersion
  ) {
    findings.push(finding(
      "PHASE6_SERVER_RESULT_PAGE_EXPERIMENT_BINDING_MISMATCH",
      "Experiment binding must match journey_run_receipt.v2 exactly",
      "canonicalArtifacts.experimentBinding",
      { expected: expectedBinding, actual: binding },
    ));
  }
  const rawArtifactEventIds = canonicalEvents.map(eventIdOf);
  const artifactEventIds = unique(rawArtifactEventIds);
  const receiptEventIds = canonicalReceiptEventIds(receipt);
  if (rawArtifactEventIds.some((eventId) => !eventId)
    || artifactEventIds.length !== canonicalEvents.length) {
    findings.push(finding(
      "PHASE6_SERVER_RESULT_PAGE_CANONICAL_ARTIFACT_INVALID",
      "Canonical server events must have unique non-empty eventIds",
      "canonicalArtifacts.canonicalEvents",
    ));
  }
  if (!sameStringSet(artifactEventIds, receiptEventIds)) {
    findings.push(finding(
      "PHASE6_SERVER_RESULT_PAGE_EVENT_MISMATCH",
      "Canonical server artifact eventIds must exactly match finalized receipt eventIds",
      "canonicalArtifacts.canonicalEvents",
      { expected: receiptEventIds, actual: artifactEventIds },
    ));
  }
  for (const eventId of receiptDeltaEventIds(receipt)) {
    if (!receiptEventIds.includes(eventId)) {
      findings.push(finding(
        "PHASE6_SERVER_RESULT_PAGE_EVENT_MISMATCH",
        "Receipt delta eventId is not part of receipt canonical eventIds",
        "receipt.deltas",
        { eventId },
      ));
    }
  }
  return findings.length === 0;
}

function eventRefs(
  receipt: JourneyRunReceipt,
  canonicalEvents: readonly EpochEvent[],
): readonly Phase6ResultPageReceiptEventRef[] {
  const eventsById = new Map(unique(canonicalEvents.map(eventIdOf)).map((eventId) => {
    const event = canonicalEvents.find((candidate) => eventIdOf(candidate) === eventId);
    return [eventId, event];
  }));
  return canonicalReceiptEventIds(receipt).map((eventId) => {
    const event = eventsById.get(eventId);
    const aggregate = isRecord(event) && isRecord(event.aggregate) ? event.aggregate : undefined;
    return {
      eventId,
      eventType: eventTypeOf(event),
      ...(aggregate && nonEmpty(aggregate.type) ? { aggregateType: aggregate.type.trim() } : {}),
      ...(aggregate && nonEmpty(aggregate.id) ? { aggregateId: aggregate.id.trim() } : {}),
      receiptId: receipt.receiptId,
      runId: receipt.runId,
      payloadHash: receipt.integrity.bodyHash,
    };
  });
}

export function buildPhase6ServerResultPageInput(
  receipt: JourneyRunReceipt,
  artifacts: Phase6ServerCanonicalArtifacts,
  initialResultArtifactHash: string,
  economyConservation: Phase6ResultPageRunSettlement["economyConservation"],
): {
  readonly resultPageInput: Phase6ResultPageInput;
  readonly sections: Phase6ServerResultPageSections;
  readonly verificationBinding: Phase6ServerFinalizedPageBinding;
  readonly resultPagePayloadHash: string;
} {
  const canonicalEventIds = canonicalReceiptEventIds(receipt);
  const refs = eventRefs(receipt, artifacts.canonicalEvents);
  const worldChanges = changesFromDeltas(receipt, (delta) =>
    delta.target.kind === "world" || delta.target.kind === "region" || delta.target.kind === "world_state");
  const identityChanges = changesFromDeltas(receipt, (delta) =>
    delta.target.kind === "identity" || delta.path[0] === "identity");
  const progressionChanges = changesFromDeltas(receipt, (delta) =>
    delta.target.kind === "progression" || delta.path[0] === "progression");
  const ragChanges: readonly Phase6ResultPageChange[] = receipt.rag.claims.map((claim) => ({
    id: claim.claimId,
    label: `RAG claim ${claim.claimId}`,
    after: claim,
    eventIds: canonicalEventIds,
  }));
  const scores = scoreDetails(receipt);
  const sections: Phase6ServerResultPageSections = {
    world: changeSet("World", worldChanges, receipt.eventIds.derived),
    identityProgression: {
      identity: changeSet("Identity", identityChanges, receipt.eventIds.derived),
      progression: changeSet("Progression", progressionChanges, receipt.eventIds.derived),
    },
    settlement: {
      status: "settled",
      settlementId: receipt.receiptId,
      eventIds: receipt.eventIds.settlement,
      economyConservation,
    },
    scoreSummary: phase6ResultPageScoreSummary(receipt.score),
    scores,
    suitability: suitabilityDetails(receipt),
    rag: {
      ...changeSet("RAG", ragChanges, canonicalEventIds),
      evidenceIds: unique(receipt.rag.claims.map((claim) => claim.sourceId)),
      retrievalSnapshotId: receipt.rag.queryHash,
    },
    audit: {
      auditId: artifacts.auditId ?? receipt.receiptId,
      eventIds: canonicalEventIds,
      integrity: {
        ok: true,
        receiptPayloadHash: receipt.integrity.bodyHash,
        canonicalEventIds,
        checkedAt: artifacts.checkedAt ?? receipt.settledAt,
      },
    },
  };
  const resultPageInput: Mutable<Phase6ResultPageInput> = {
    receipt: {
      receiptId: receipt.receiptId,
      runId: receipt.runId,
      createdAt: receipt.generatedAt,
      payloadHash: receipt.integrity.bodyHash,
      canonicalEventIds,
      canonicalEvents: refs,
    },
    events: refs,
    world: sections.world,
    identityProgression: sections.identityProgression,
    settlement: sections.settlement,
    scoreSummary: sections.scoreSummary,
    scores,
    rag: sections.rag,
    audit: sections.audit,
  };
  const verificationBinding: Phase6ServerFinalizedPageBinding = {
    receiptId: receipt.receiptId,
    receiptHash: receipt.integrity.bodyHash,
    receiptPayloadHash: journeyRunReceiptPayloadHash(receipt),
    eventIds: canonicalEventIds,
    worldCursor: artifacts.worldCursor,
    experimentBinding: artifacts.experimentBinding,
    initialResultArtifactHash,
  };
  const resultPagePayloadHash = `sha256:${sha256Hex(stableResultPageJson({
    resultPage: resultPageInput,
    verificationBinding,
  }))}`;
  resultPageInput.audit = {
    ...resultPageInput.audit,
    integrity: {
      ...resultPageInput.audit.integrity,
      resultPagePayloadHash,
    },
  };
  return { resultPageInput, sections, verificationBinding, resultPagePayloadHash };
}

export function buildPhase6ServerResultPageEvidence(
  input: Phase6ServerResultPageBuildInput,
): Phase6ServerResultPageBuildResult {
  const findings: Phase6ServerResultPageFinding[] = [];
  validateNoSelfReportedResultPage(input, findings);
  validateDraftInvariant(input.initialResultArtifact, findings);
  if (findings.length > 0) return failed(findings);
  if (isUnfinalizedReceipt(input.receipt)) {
    return buildDraftResult(input.receipt, input.canonicalArtifacts);
  }
  const receipt = strictFinalizedReceipt(input.receipt, findings);
  if (!receipt) return failed(findings);
  if (!validateArtifacts(receipt, input.canonicalArtifacts, findings)) {
    return failed(findings);
  }

  const artifacts = input.canonicalArtifacts;
  const initialResultArtifact = validateInitialResultArtifact(
    receipt,
    artifacts,
    input.initialResultArtifact,
    findings,
  );
  if (!initialResultArtifact) return failed(findings);
  const {
    resultPageInput,
    sections,
    verificationBinding,
    resultPagePayloadHash,
  } = buildPhase6ServerResultPageInput(
    receipt,
    artifacts,
    initialResultArtifact.artifactHash,
    initialResultArtifact.economyConservation,
  );
  if (allResultScoresAreFixed94(sections.scores)) {
    return failed([finding(
      "PHASE6_SERVER_RESULT_PAGE_FIXED_94_REJECTED",
      "Result page scores must not be a fixed fallback 94 vector",
      "resultPage.scores",
    )]);
  }

  const resultPage = buildPhase6MachineReadableResultPage(resultPageInput);
  if (!resultPage.ok) {
    return failed(resultPage.findings.map((issue: Phase6ResultPageFinding) => ({
        code: issue.code,
        severity: "error",
        message: issue.message,
        path: issue.path,
        details: issue.details,
      })));
  }

  return {
    ok: true,
    status: "verified",
    finalized: true,
    verified: true,
    deterministic: true,
    rulesetVersion: PHASE6_SERVER_RESULT_PAGE_RULESET_VERSION,
    receiptId: receipt.receiptId,
    receiptHash: receipt.integrity.bodyHash,
    eventIds: canonicalReceiptEventIds(receipt),
    worldCursor: artifacts.worldCursor,
    experimentBinding: artifacts.experimentBinding,
    resultPageInput,
    sections,
    verificationBinding,
    resultPage: resultPage.page,
    resultPagePayloadHash,
    initialResultArtifactHash: initialResultArtifact.artifactHash,
    findings: [],
  };
}

export function buildPhase6VerifiedResultPage(
  input: Phase6ServerResultPageBuildInput,
): Phase6ServerResultPageBuildResult {
  return buildPhase6ServerResultPageEvidence(input);
}
