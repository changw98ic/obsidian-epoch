import {
  JOURNEY_RUN_SCORE_DIMENSIONS,
  type JourneyRunScore,
  type JourneyRunScoreContext,
  type JourneyRunScoreDimension,
} from "./journeyRunReceiptRules.ts";

export const PHASE6_RESULT_PAGE_RULESET_VERSION = "obsidian-epoch-phase6-result-page-v0.2.0" as const;

export const PHASE6_RESULT_PAGE_SCORE_DIMENSIONS = JOURNEY_RUN_SCORE_DIMENSIONS;

export type Phase6ResultPageScoreDimension = JourneyRunScoreDimension;

export type Phase6ResultPageChangeMode = "changed" | "no_change";
export type Phase6ResultPageFindingSeverity = "error";

export type Phase6ResultPageFindingCode =
  | "PHASE6_RESULT_PAGE_INPUT_MISSING"
  | "PHASE6_RESULT_PAGE_SECTION_MISSING"
  | "PHASE6_RESULT_PAGE_SECTION_INVALID"
  | "PHASE6_RESULT_PAGE_SCORE_MISSING"
  | "PHASE6_RESULT_PAGE_SCORE_DUPLICATE"
  | "PHASE6_RESULT_PAGE_SCORE_INVALID"
  | "PHASE6_RESULT_PAGE_FIXED_FALLBACK_SCORE"
  | "PHASE6_RESULT_PAGE_RECEIPT_EVENT_MISMATCH"
  | "PHASE6_RESULT_PAGE_AUDIT_INTEGRITY_FAILED";

export interface Phase6ResultPageFinding {
  readonly code: Phase6ResultPageFindingCode;
  readonly severity: Phase6ResultPageFindingSeverity;
  readonly message: string;
  readonly path?: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface Phase6ResultPageReceiptEventRef {
  readonly eventId: string;
  readonly eventType: string;
  readonly aggregateType?: string;
  readonly aggregateId?: string;
  readonly receiptId?: string;
  readonly runId?: string;
  readonly payloadHash?: string;
}

export interface Phase6ResultPageRunReceiptLike {
  readonly receiptId: string;
  readonly runId: string;
  readonly createdAt: string;
  readonly payloadHash?: string;
  readonly canonicalEventIds: readonly string[];
  readonly canonicalEvents?: readonly Phase6ResultPageReceiptEventRef[];
}

export interface Phase6ResultPageChange {
  readonly id: string;
  readonly label: string;
  readonly before?: unknown;
  readonly after?: unknown;
  readonly eventIds: readonly string[];
}

export interface Phase6ResultPageChangeSet {
  readonly mode: Phase6ResultPageChangeMode;
  readonly changes: readonly Phase6ResultPageChange[];
  readonly noChangeReason?: string;
  readonly eventIds: readonly string[];
}

export interface Phase6ResultPageIdentityProgressionSection {
  readonly identity: Phase6ResultPageChangeSet;
  readonly progression: Phase6ResultPageChangeSet;
}

export interface Phase6ResultPageEconomyAssetConservation {
  readonly assetKey: string;
  readonly unit: string;
  readonly openingTotalMinor: string;
  readonly closingTotalMinor: string;
  readonly systemMintMinor: string;
  readonly systemBurnMinor: string;
  readonly expectedClosingTotalMinor: string;
  readonly unexplainedDeltaMinor: string;
  readonly conserved: boolean;
}

export interface Phase6ResultPageEconomyConservation {
  readonly conserved: boolean;
  readonly assets: readonly Phase6ResultPageEconomyAssetConservation[];
  readonly auditFindingIds: readonly string[];
}

export interface Phase6ResultPageRunSettlement {
  readonly status: "settled" | "rejected" | "rolled_back";
  readonly settlementId: string;
  readonly eventIds: readonly string[];
  readonly economyConservation: Phase6ResultPageEconomyConservation;
}

export interface Phase6ResultPageScoreDetail {
  readonly dimension: Phase6ResultPageScoreDimension;
  readonly score: number;
  readonly value: number;
  readonly weightBps: number;
  readonly contribution: number;
  readonly reasonCode: string;
  readonly formula: string;
  readonly inputs: Readonly<Record<string, number>>;
  readonly inputContributions: Readonly<Record<string, number>>;
  readonly basis: string;
  readonly source: "server_authoritative";
  readonly eventIds: readonly string[];
  readonly fallback?: boolean;
}

export interface Phase6ResultPageScoreSummary {
  readonly contractVersion: JourneyRunScore["contractVersion"];
  readonly authority: JourneyRunScore["authority"];
  readonly weightedTotal: number;
  readonly decay: number;
  readonly total: number;
  readonly formula: JourneyRunScore["formula"];
  readonly context: JourneyRunScoreContext;
}

export interface Phase6ResultPageRagSection {
  readonly mode: Phase6ResultPageChangeMode;
  readonly changes: readonly Phase6ResultPageChange[];
  readonly noChangeReason?: string;
  readonly eventIds: readonly string[];
  readonly evidenceIds: readonly string[];
  readonly retrievalSnapshotId?: string;
}

export interface Phase6ResultPageIntegritySection {
  readonly ok: boolean;
  readonly receiptPayloadHash?: string;
  readonly resultPagePayloadHash?: string;
  readonly canonicalEventIds: readonly string[];
  readonly checkedAt: string;
}

export interface Phase6ResultPageAuditSection {
  readonly auditId: string;
  readonly eventIds: readonly string[];
  readonly integrity: Phase6ResultPageIntegritySection;
}

export interface Phase6ResultPageInput {
  readonly receipt: Phase6ResultPageRunReceiptLike;
  readonly events: readonly Phase6ResultPageReceiptEventRef[];
  readonly world: Phase6ResultPageChangeSet;
  readonly identityProgression: Phase6ResultPageIdentityProgressionSection;
  readonly settlement: Phase6ResultPageRunSettlement;
  readonly scoreSummary: Phase6ResultPageScoreSummary;
  readonly scores: readonly Phase6ResultPageScoreDetail[];
  readonly rag: Phase6ResultPageRagSection;
  readonly audit: Phase6ResultPageAuditSection;
}

export interface Phase6MachineReadableResultPage {
  readonly rulesetVersion: typeof PHASE6_RESULT_PAGE_RULESET_VERSION;
  readonly deterministic: true;
  readonly receipt: Phase6ResultPageRunReceiptLike;
  readonly sections: {
    readonly world: Phase6ResultPageChangeSet;
    readonly identityProgression: Phase6ResultPageIdentityProgressionSection;
    readonly settlement: Phase6ResultPageRunSettlement;
    readonly scoreSummary: Phase6ResultPageScoreSummary;
    readonly scores: readonly Phase6ResultPageScoreDetail[];
    readonly rag: Phase6ResultPageRagSection;
    readonly audit: Phase6ResultPageAuditSection;
  };
}

export interface Phase6ResultPageBuildSuccess {
  readonly ok: true;
  readonly verified: true;
  readonly page: Phase6MachineReadableResultPage;
  readonly findings: readonly [];
}

export interface Phase6ResultPageBuildFailure {
  readonly ok: false;
  readonly verified: false;
  readonly page?: undefined;
  readonly findings: readonly Phase6ResultPageFinding[];
}

export type Phase6ResultPageBuildResult = Phase6ResultPageBuildSuccess | Phase6ResultPageBuildFailure;

function finding(
  code: Phase6ResultPageFindingCode,
  message: string,
  path?: string,
  details?: Readonly<Record<string, unknown>>,
): Phase6ResultPageFinding {
  return { code, severity: "error", message, path, details };
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function validateChangeSet(
  value: unknown,
  path: string,
  label: string,
  findings: Phase6ResultPageFinding[],
): value is Phase6ResultPageChangeSet {
  if (!isRecord(value)) {
    findings.push(finding("PHASE6_RESULT_PAGE_SECTION_MISSING", `${label} section is required`, path));
    return false;
  }
  const mode = value.mode;
  const changes = value.changes;
  const eventIds = value.eventIds;
  if (mode !== "changed" && mode !== "no_change") {
    findings.push(finding("PHASE6_RESULT_PAGE_SECTION_INVALID", `${label} mode must be changed or no_change`, `${path}.mode`));
  }
  if (!Array.isArray(changes)) {
    findings.push(finding("PHASE6_RESULT_PAGE_SECTION_INVALID", `${label} changes must be an array`, `${path}.changes`));
  }
  if (!Array.isArray(eventIds)) {
    findings.push(finding("PHASE6_RESULT_PAGE_SECTION_INVALID", `${label} eventIds must be an array`, `${path}.eventIds`));
  }
  if (mode === "changed" && Array.isArray(changes) && changes.length === 0) {
    findings.push(finding("PHASE6_RESULT_PAGE_SECTION_INVALID", `${label} changed mode requires at least one change`, `${path}.changes`));
  }
  if (mode === "no_change" && !isNonEmptyString(value.noChangeReason)) {
    findings.push(finding("PHASE6_RESULT_PAGE_SECTION_INVALID", `${label} no_change mode requires noChangeReason`, `${path}.noChangeReason`));
  }
  if (Array.isArray(changes)) {
    changes.forEach((change, index) => {
      const changePath = `${path}.changes.${index}`;
      if (!isRecord(change)) {
        findings.push(finding("PHASE6_RESULT_PAGE_SECTION_INVALID", `${label} change must be an object`, changePath));
        return;
      }
      if (!isNonEmptyString(change.id)) {
        findings.push(finding("PHASE6_RESULT_PAGE_SECTION_INVALID", `${label} change id is required`, `${changePath}.id`));
      }
      if (!isNonEmptyString(change.label)) {
        findings.push(finding("PHASE6_RESULT_PAGE_SECTION_INVALID", `${label} change label is required`, `${changePath}.label`));
      }
      if (!Array.isArray(change.eventIds) || change.eventIds.length === 0) {
        findings.push(finding("PHASE6_RESULT_PAGE_SECTION_INVALID", `${label} change requires eventIds`, `${changePath}.eventIds`));
      }
    });
  }
  return true;
}

function validateReceiptAndEvents(input: Phase6ResultPageInput, findings: Phase6ResultPageFinding[]) {
  const { receipt, events } = input;
  if (!isRecord(receipt)) {
    findings.push(finding("PHASE6_RESULT_PAGE_SECTION_MISSING", "receipt is required", "receipt"));
    return;
  }
  if (!isNonEmptyString(receipt.receiptId)) {
    findings.push(finding("PHASE6_RESULT_PAGE_SECTION_INVALID", "receiptId is required", "receipt.receiptId"));
  }
  if (!isNonEmptyString(receipt.runId)) {
    findings.push(finding("PHASE6_RESULT_PAGE_SECTION_INVALID", "runId is required", "receipt.runId"));
  }
  if (!isNonEmptyString(receipt.createdAt)) {
    findings.push(finding("PHASE6_RESULT_PAGE_SECTION_INVALID", "receipt createdAt is required", "receipt.createdAt"));
  }
  if (!Array.isArray(receipt.canonicalEventIds) || receipt.canonicalEventIds.length === 0) {
    findings.push(finding("PHASE6_RESULT_PAGE_SECTION_INVALID", "receipt canonicalEventIds are required", "receipt.canonicalEventIds"));
  }
  if (!Array.isArray(events) || events.length === 0) {
    findings.push(finding("PHASE6_RESULT_PAGE_SECTION_MISSING", "events are required", "events"));
    return;
  }

  const eventIds = new Set<string>();
  events.forEach((event, index) => {
    if (!isNonEmptyString(event.eventId)) {
      findings.push(finding("PHASE6_RESULT_PAGE_SECTION_INVALID", "eventId is required", `events.${index}.eventId`));
      return;
    }
    eventIds.add(event.eventId);
    if (event.receiptId && event.receiptId !== receipt.receiptId) {
      findings.push(finding("PHASE6_RESULT_PAGE_RECEIPT_EVENT_MISMATCH", "event receiptId does not match receipt", `events.${index}.receiptId`, {
        eventId: event.eventId,
        eventReceiptId: event.receiptId,
        receiptId: receipt.receiptId,
      }));
    }
    if (event.runId && event.runId !== receipt.runId) {
      findings.push(finding("PHASE6_RESULT_PAGE_RECEIPT_EVENT_MISMATCH", "event runId does not match receipt", `events.${index}.runId`, {
        eventId: event.eventId,
        eventRunId: event.runId,
        receiptRunId: receipt.runId,
      }));
    }
  });

  if (Array.isArray(receipt.canonicalEventIds)) {
    const canonicalIds = new Set(receipt.canonicalEventIds);
    for (const eventId of canonicalIds) {
      if (!eventIds.has(eventId)) {
        findings.push(finding("PHASE6_RESULT_PAGE_RECEIPT_EVENT_MISMATCH", "receipt canonical event is missing from supplied events", "receipt.canonicalEventIds", {
          eventId,
        }));
      }
    }
    for (const eventId of eventIds) {
      if (!canonicalIds.has(eventId)) {
        findings.push(finding("PHASE6_RESULT_PAGE_RECEIPT_EVENT_MISMATCH", "supplied event is not listed by receipt canonicalEventIds", "events", {
          eventId,
        }));
      }
    }
  }

  if (receipt.canonicalEvents) {
    const embeddedIds = new Set(receipt.canonicalEvents.map((event) => event.eventId));
    for (const eventId of receipt.canonicalEventIds) {
      if (!embeddedIds.has(eventId)) {
        findings.push(finding("PHASE6_RESULT_PAGE_RECEIPT_EVENT_MISMATCH", "receipt canonicalEvents do not cover canonicalEventIds", "receipt.canonicalEvents", {
          eventId,
        }));
      }
    }
  }
}

function validateIdentityProgression(input: Phase6ResultPageInput, findings: Phase6ResultPageFinding[]) {
  const section = input.identityProgression;
  if (!isRecord(section)) {
    findings.push(finding("PHASE6_RESULT_PAGE_SECTION_MISSING", "identityProgression section is required", "identityProgression"));
    return;
  }
  validateChangeSet(section.identity, "identityProgression.identity", "identity", findings);
  validateChangeSet(section.progression, "identityProgression.progression", "progression", findings);
}

function validateSettlement(input: Phase6ResultPageInput, findings: Phase6ResultPageFinding[]) {
  const settlement = input.settlement;
  if (!isRecord(settlement)) {
    findings.push(finding("PHASE6_RESULT_PAGE_SECTION_MISSING", "settlement section is required", "settlement"));
    return;
  }
  if (settlement.status !== "settled" && settlement.status !== "rejected" && settlement.status !== "rolled_back") {
    findings.push(finding("PHASE6_RESULT_PAGE_SECTION_INVALID", "settlement status is invalid", "settlement.status"));
  }
  if (!isNonEmptyString(settlement.settlementId)) {
    findings.push(finding("PHASE6_RESULT_PAGE_SECTION_INVALID", "settlementId is required", "settlement.settlementId"));
  }
  if (!Array.isArray(settlement.eventIds) || settlement.eventIds.length === 0) {
    findings.push(finding("PHASE6_RESULT_PAGE_SECTION_INVALID", "settlement eventIds are required", "settlement.eventIds"));
  }
  const conservation = settlement.economyConservation;
  if (!isRecord(conservation)) {
    findings.push(finding("PHASE6_RESULT_PAGE_SECTION_MISSING", "economyConservation is required", "settlement.economyConservation"));
    return;
  }
  if (conservation.conserved !== true) {
    findings.push(finding("PHASE6_RESULT_PAGE_SECTION_INVALID", "economy conservation must be explicitly true", "settlement.economyConservation.conserved"));
  }
  if (!Array.isArray(conservation.assets)) {
    findings.push(finding("PHASE6_RESULT_PAGE_SECTION_INVALID", "economy conservation assets are required", "settlement.economyConservation.assets"));
  }
}

function validateScores(input: Phase6ResultPageInput, findings: Phase6ResultPageFinding[]) {
  if (!Array.isArray(input.scores)) {
    findings.push(finding("PHASE6_RESULT_PAGE_SECTION_MISSING", "scores section is required", "scores"));
    return;
  }
  const byDimension = new Map<string, Phase6ResultPageScoreDetail[]>();
  input.scores.forEach((score, index) => {
    const path = `scores.${index}`;
    if (!isRecord(score)) {
      findings.push(finding("PHASE6_RESULT_PAGE_SCORE_INVALID", "score entry must be an object", path));
      return;
    }
    if (!PHASE6_RESULT_PAGE_SCORE_DIMENSIONS.includes(score.dimension as Phase6ResultPageScoreDimension)) {
      findings.push(finding("PHASE6_RESULT_PAGE_SCORE_INVALID", "score dimension is invalid", `${path}.dimension`, {
        dimension: score.dimension,
      }));
    }
    if (Number.isFinite(score.score) === false || score.score < 0 || score.score > 100) {
      findings.push(finding("PHASE6_RESULT_PAGE_SCORE_INVALID", "score must be a finite number from 0 to 100", `${path}.score`, {
        score: score.score,
      }));
    }
    if (score.value !== score.score) {
      findings.push(finding("PHASE6_RESULT_PAGE_SCORE_INVALID", "score display alias must equal canonical value", `${path}.value`));
    }
    if (!Number.isInteger(score.weightBps) || score.weightBps < 0 || score.weightBps > 10_000) {
      findings.push(finding("PHASE6_RESULT_PAGE_SCORE_INVALID", "weightBps must be an integer from 0 to 10000", `${path}.weightBps`));
    }
    if (!Number.isFinite(score.contribution)
      || Math.abs(score.contribution - score.value * score.weightBps / 10_000) > 1e-6) {
      findings.push(finding("PHASE6_RESULT_PAGE_SCORE_INVALID", "contribution must be recomputable", `${path}.contribution`));
    }
    if (!isNonEmptyString(score.reasonCode) || !isNonEmptyString(score.formula)) {
      findings.push(finding("PHASE6_RESULT_PAGE_SCORE_INVALID", "reasonCode and formula are required", path));
    }
    if (!isRecord(score.inputs) || !isRecord(score.inputContributions)) {
      findings.push(finding("PHASE6_RESULT_PAGE_SCORE_INVALID", "inputs and inputContributions are required", path));
    }
    if (!isNonEmptyString(score.basis)) {
      findings.push(finding("PHASE6_RESULT_PAGE_SCORE_INVALID", "score basis is required", `${path}.basis`));
    }
    if (score.source !== "server_authoritative") {
      findings.push(finding("PHASE6_RESULT_PAGE_SCORE_INVALID", "score source is invalid", `${path}.source`));
    }
    if (!Array.isArray(score.eventIds) || score.eventIds.length === 0) {
      findings.push(finding("PHASE6_RESULT_PAGE_SCORE_INVALID", "score eventIds are required", `${path}.eventIds`));
    }
    if (score.fallback === true) {
      findings.push(finding("PHASE6_RESULT_PAGE_FIXED_FALLBACK_SCORE", "fixed fallback score is forbidden", path, {
        dimension: score.dimension,
        score: score.score,
      }));
    }
    const entries = byDimension.get(String(score.dimension)) || [];
    entries.push(score as Phase6ResultPageScoreDetail);
    byDimension.set(String(score.dimension), entries);
  });

  for (const dimension of PHASE6_RESULT_PAGE_SCORE_DIMENSIONS) {
    const entries = byDimension.get(dimension) || [];
    if (entries.length === 0) {
      findings.push(finding("PHASE6_RESULT_PAGE_SCORE_MISSING", "required score dimension is missing", "scores", { dimension }));
    }
    if (entries.length > 1) {
      findings.push(finding("PHASE6_RESULT_PAGE_SCORE_DUPLICATE", "score dimension is duplicated", "scores", { dimension }));
    }
  }
  if (input.scores.length === PHASE6_RESULT_PAGE_SCORE_DIMENSIONS.length
    && input.scores.every((score) => score.score === 94)) {
    findings.push(finding("PHASE6_RESULT_PAGE_FIXED_FALLBACK_SCORE", "fixed fallback 94 vector is forbidden", "scores"));
  }

  const summary = input.scoreSummary;
  if (!isRecord(summary)) {
    findings.push(finding("PHASE6_RESULT_PAGE_SECTION_MISSING", "scoreSummary is required", "scoreSummary"));
    return;
  }
  const weightedTotal = input.scores.reduce((sum, score) => sum + score.contribution, 0);
  if (!Number.isFinite(summary.weightedTotal) || Math.abs(summary.weightedTotal - weightedTotal) > 1e-6) {
    findings.push(finding("PHASE6_RESULT_PAGE_SCORE_INVALID", "scoreSummary weightedTotal is invalid", "scoreSummary.weightedTotal"));
  }
  if (!Number.isFinite(summary.decay) || summary.decay < 0.65 || summary.decay > 1) {
    findings.push(finding("PHASE6_RESULT_PAGE_SCORE_INVALID", "scoreSummary decay is invalid", "scoreSummary.decay"));
  }
  if (!Number.isFinite(summary.total)
    || summary.total < 0
    || summary.total > 100
    || Math.abs(summary.total - summary.weightedTotal * summary.decay) > 1e-6) {
    findings.push(finding("PHASE6_RESULT_PAGE_SCORE_INVALID", "scoreSummary total is invalid", "scoreSummary.total"));
  }
}

export function phase6ResultPageScoreDetails(
  score: JourneyRunScore,
  canonicalEventIds: readonly string[],
): readonly Phase6ResultPageScoreDetail[] {
  const canonical = new Set(canonicalEventIds);
  return PHASE6_RESULT_PAGE_SCORE_DIMENSIONS.map((dimension) => {
    const metric = score.dimensions[dimension];
    const matched = metric.events.filter((eventId) => canonical.has(eventId));
    const eventIds = matched.length > 0 ? [...new Set(matched)] : [...new Set(canonicalEventIds)];
    return {
      dimension,
      score: metric.value,
      value: metric.value,
      weightBps: metric.weightBps,
      contribution: metric.contribution,
      reasonCode: metric.reasonCode,
      formula: metric.formula,
      inputs: metric.inputs,
      inputContributions: metric.inputContributions,
      basis: `${metric.reasonCode}: ${metric.formula}`,
      source: "server_authoritative",
      eventIds,
    };
  });
}

export function phase6ResultPageScoreSummary(score: JourneyRunScore): Phase6ResultPageScoreSummary {
  return {
    contractVersion: score.contractVersion,
    authority: score.authority,
    weightedTotal: score.weightedTotal,
    decay: score.decay,
    total: score.total,
    formula: score.formula,
    context: score.context,
  };
}

function validateRag(input: Phase6ResultPageInput, findings: Phase6ResultPageFinding[]) {
  if (!validateChangeSet(input.rag, "rag", "RAG", findings)) return;
  if (!Array.isArray(input.rag.evidenceIds)) {
    findings.push(finding("PHASE6_RESULT_PAGE_SECTION_INVALID", "RAG evidenceIds are required", "rag.evidenceIds"));
  }
}

function validateAudit(input: Phase6ResultPageInput, findings: Phase6ResultPageFinding[]) {
  const audit = input.audit;
  if (!isRecord(audit)) {
    findings.push(finding("PHASE6_RESULT_PAGE_SECTION_MISSING", "audit section is required", "audit"));
    return;
  }
  if (!isNonEmptyString(audit.auditId)) {
    findings.push(finding("PHASE6_RESULT_PAGE_SECTION_INVALID", "auditId is required", "audit.auditId"));
  }
  if (!Array.isArray(audit.eventIds) || audit.eventIds.length === 0) {
    findings.push(finding("PHASE6_RESULT_PAGE_SECTION_INVALID", "audit eventIds are required", "audit.eventIds"));
  }
  const integrity = audit.integrity;
  if (!isRecord(integrity)) {
    findings.push(finding("PHASE6_RESULT_PAGE_SECTION_MISSING", "audit integrity is required", "audit.integrity"));
    return;
  }
  if (integrity.ok !== true) {
    findings.push(finding("PHASE6_RESULT_PAGE_AUDIT_INTEGRITY_FAILED", "audit integrity must be explicitly ok", "audit.integrity.ok"));
  }
  if (!Array.isArray(integrity.canonicalEventIds) || integrity.canonicalEventIds.length === 0) {
    findings.push(finding("PHASE6_RESULT_PAGE_SECTION_INVALID", "integrity canonicalEventIds are required", "audit.integrity.canonicalEventIds"));
  }
  if (!isNonEmptyString(integrity.checkedAt)) {
    findings.push(finding("PHASE6_RESULT_PAGE_SECTION_INVALID", "integrity checkedAt is required", "audit.integrity.checkedAt"));
  }
  if (input.receipt?.payloadHash && integrity.receiptPayloadHash && input.receipt.payloadHash !== integrity.receiptPayloadHash) {
    findings.push(finding("PHASE6_RESULT_PAGE_AUDIT_INTEGRITY_FAILED", "integrity receiptPayloadHash does not match receipt", "audit.integrity.receiptPayloadHash", {
      receiptPayloadHash: input.receipt.payloadHash,
      integrityReceiptPayloadHash: integrity.receiptPayloadHash,
    }));
  }
  if (Array.isArray(input.receipt?.canonicalEventIds) && Array.isArray(integrity.canonicalEventIds)) {
    const receiptIds = new Set(input.receipt.canonicalEventIds);
    const integrityIds = new Set(integrity.canonicalEventIds);
    for (const eventId of receiptIds) {
      if (!integrityIds.has(eventId)) {
        findings.push(finding("PHASE6_RESULT_PAGE_RECEIPT_EVENT_MISMATCH", "integrity canonicalEventIds do not cover receipt canonicalEventIds", "audit.integrity.canonicalEventIds", {
          eventId,
        }));
      }
    }
    for (const eventId of integrityIds) {
      if (!receiptIds.has(eventId)) {
        findings.push(finding("PHASE6_RESULT_PAGE_RECEIPT_EVENT_MISMATCH", "integrity canonicalEventIds include an event outside receipt", "audit.integrity.canonicalEventIds", {
          eventId,
        }));
      }
    }
  }
}

function stableScores(scores: readonly Phase6ResultPageScoreDetail[]) {
  return [...scores].sort((left, right) => left.dimension.localeCompare(right.dimension));
}

function collectChangeSetEventIds(section: Phase6ResultPageChangeSet | undefined): readonly string[] {
  if (!section) return [];
  return [
    ...(Array.isArray(section.eventIds) ? section.eventIds : []),
    ...((Array.isArray(section.changes) ? section.changes : []).flatMap((change) =>
      Array.isArray(change.eventIds) ? change.eventIds : [])),
  ];
}

function validateSectionEventReferences(input: Phase6ResultPageInput, findings: Phase6ResultPageFinding[]) {
  if (!Array.isArray(input.receipt?.canonicalEventIds)) return;
  const canonicalIds = new Set(input.receipt.canonicalEventIds);
  const referenced: readonly [string, readonly string[]][] = [
    ["world", collectChangeSetEventIds(input.world)],
    ["identityProgression.identity", collectChangeSetEventIds(input.identityProgression?.identity)],
    ["identityProgression.progression", collectChangeSetEventIds(input.identityProgression?.progression)],
    ["settlement", Array.isArray(input.settlement?.eventIds) ? input.settlement.eventIds : []],
    ["scores", Array.isArray(input.scores) ? input.scores.flatMap((score) => Array.isArray(score.eventIds) ? score.eventIds : []) : []],
    ["rag", [
      ...collectChangeSetEventIds(input.rag),
      ...(Array.isArray(input.rag?.evidenceIds) ? input.rag.evidenceIds : []),
    ]],
    ["audit", Array.isArray(input.audit?.eventIds) ? input.audit.eventIds : []],
  ];
  for (const [path, eventIds] of referenced) {
    for (const eventId of eventIds) {
      if (!canonicalIds.has(eventId)) {
        findings.push(finding("PHASE6_RESULT_PAGE_RECEIPT_EVENT_MISMATCH", "section references an event outside receipt canonicalEventIds", path, {
          eventId,
        }));
      }
    }
  }
}

export function buildPhase6MachineReadableResultPage(input: Phase6ResultPageInput): Phase6ResultPageBuildResult {
  const findings: Phase6ResultPageFinding[] = [];
  if (!isRecord(input)) {
    return {
      ok: false,
      verified: false,
      findings: [finding("PHASE6_RESULT_PAGE_INPUT_MISSING", "phase 6 result page input is required")],
    };
  }

  validateReceiptAndEvents(input, findings);
  validateChangeSet(input.world, "world", "world", findings);
  validateIdentityProgression(input, findings);
  validateSettlement(input, findings);
  validateScores(input, findings);
  validateRag(input, findings);
  validateAudit(input, findings);
  validateSectionEventReferences(input, findings);

  if (findings.length > 0) {
    return {
      ok: false,
      verified: false,
      findings: findings.sort((left, right) =>
        left.code.localeCompare(right.code)
        || String(left.path || "").localeCompare(String(right.path || ""))
        || left.message.localeCompare(right.message)),
    };
  }

  return {
    ok: true,
    verified: true,
    findings: [],
    page: {
      rulesetVersion: PHASE6_RESULT_PAGE_RULESET_VERSION,
      deterministic: true,
      receipt: input.receipt,
      sections: {
        world: input.world,
        identityProgression: input.identityProgression,
        settlement: input.settlement,
        scoreSummary: input.scoreSummary,
        scores: stableScores(input.scores),
        rag: input.rag,
        audit: input.audit,
      },
    },
  };
}

export function assertPhase6MachineReadableResultPage(input: Phase6ResultPageInput): Phase6MachineReadableResultPage {
  const result = buildPhase6MachineReadableResultPage(input);
  if (!result.verified) {
    const first = result.findings[0];
    throw new Error(first ? `${first.code}:${first.path || "input"}:${first.message}` : "PHASE6_RESULT_PAGE_INVALID");
  }
  return result.page;
}
