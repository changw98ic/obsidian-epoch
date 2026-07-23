import {
  buildPhase6PlayerSnapshotDocument,
  type Phase6PlayerSnapshotDiff,
  type Phase6PlayerSnapshotDocument,
  type Phase6PlayerSnapshotInput,
} from "./phase6PlayerSnapshotRules.ts";
import type {
  Phase6PanelSnapshotAdapterInput,
  Phase6PanelSnapshotAdapterResult,
} from "./phase6PanelSnapshotAdapter.ts";
import {
  adaptPhase6EconomyEvents,
  type Phase6EconomyEventAdapterReport,
} from "./phase6EconomyEventAdapter.ts";
import {
  auditPhase6EconomyConservation,
  type Phase6EconomyAuditFinding,
  type Phase6EconomyAuditReport,
  type Phase6EconomyResourceFlow,
  type Phase6EconomySnapshot,
} from "./phase6EconomyAuditRules.ts";
import {
  buildPhase6ProjectionDelta,
  type Phase6ProjectionDelta,
  type Phase6ProjectionDeltaInput,
} from "./phase6ProjectionDeltaRules.ts";
import {
  buildJourneyRunReceipt,
  JOURNEY_RUN_SUITABILITY_DIMENSIONS,
  validateJourneyRunReceipt,
  validateJourneyRunScore,
  type BuildJourneyRunReceiptInput,
  type JourneyRunReceipt,
  type JourneyRunReceiptMetric,
  type JourneyRunScore,
  type JourneyRunSuitability,
} from "./journeyRunReceiptRules.ts";
import {
  phase6ResultPageScoreDetails,
  phase6ResultPageScoreSummary,
} from "./phase6ResultPageRules.ts";
import type {
  Phase6ResultPageAuditSection,
  Phase6ResultPageBuildResult,
  Phase6ResultPageChangeSet,
  Phase6ResultPageEconomyAssetConservation,
  Phase6ResultPageFinding,
  Phase6ResultPageIdentityProgressionSection,
  Phase6ResultPageInput,
  Phase6ResultPageRagSection,
  Phase6ResultPageReceiptEventRef,
  Phase6ResultPageRunSettlement,
  Phase6ResultPageScoreDetail,
  Phase6ResultPageScoreSummary,
} from "./phase6ResultPageRules.ts";
import { buildPhase6ProgressionChangeSet } from "./phase6ResultPageChangeSetAdapter.ts";
import type { CausalCanonicalJsonValue } from "./causalCanonicalJson.ts";

type UnknownRecord = Readonly<Record<string, unknown>>;

export const PHASE6_RUN_ASSEMBLY_RULESET_VERSION = "obsidian-epoch-phase6-run-assembly-v0.1.2" as const;

export type Phase6RunAssemblyFindingSeverity = "error";

export type Phase6RunAssemblyFindingCode =
  | "PHASE6_RUN_ASSEMBLY_INPUT_INVALID"
  | "PHASE6_RUN_ASSEMBLY_PRECOMPUTED_REJECTED"
  | "PHASE6_RUN_ASSEMBLY_PANEL_SNAPSHOT_ADAPTER_MISSING"
  | "PHASE6_RUN_ASSEMBLY_PANEL_SNAPSHOT_FAILED"
  | "PHASE6_RUN_ASSEMBLY_ECONOMY_EVENT_ADAPTER_FAILED"
  | "PHASE6_RUN_ASSEMBLY_ECONOMY_AUDIT_FAILED"
  | "PHASE6_RUN_ASSEMBLY_SCORE_INVALID"
  | "PHASE6_RUN_ASSEMBLY_SUITABILITY_INVALID"
  | "PHASE6_RUN_ASSEMBLY_RECEIPT_FIELD_REQUIRED"
  | "PHASE6_RUN_ASSEMBLY_RECEIPT_INVALID"
  | "PHASE6_RUN_ASSEMBLY_RESULT_PAGE_BUILDER_MISSING"
  | "PHASE6_RUN_ASSEMBLY_RESULT_PAGE_FAILED";

export interface Phase6RunAssemblyFinding {
  readonly code: Phase6RunAssemblyFindingCode;
  readonly severity: Phase6RunAssemblyFindingSeverity;
  readonly message: string;
  readonly path: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface Phase6PanelSnapshotAssembler {
  (input: Phase6PanelSnapshotAdapterInput): Phase6PanelSnapshotAdapterResult<Phase6PlayerSnapshotDocument>;
}

export interface Phase6ResultPageAssembler {
  (input: Phase6ResultPageInput): Phase6ResultPageBuildResult;
}

export interface Phase6RunAssemblyDependencies {
  readonly buildPanelSnapshot?: Phase6PanelSnapshotAssembler;
  readonly buildResultPage?: Phase6ResultPageAssembler;
}

export type Phase6RunAssemblySnapshotSource =
  | {
    readonly kind: "document";
    readonly document: Phase6PlayerSnapshotDocument;
  }
  | {
    readonly kind: "player_snapshot_input";
    readonly input: Phase6PlayerSnapshotInput;
  }
  | {
    readonly kind: "panel_snapshot";
    readonly input: Phase6PanelSnapshotAdapterInput;
  };

export interface Phase6RunAssemblyEconomyInput {
  readonly previous: Phase6EconomySnapshot;
  readonly next: Phase6EconomySnapshot;
  readonly flows?: readonly Phase6EconomyResourceFlow[];
  readonly sourceEvents?: readonly unknown[];
}

export interface Phase6RunAssemblyResultPageSections {
  readonly events?: readonly Phase6ResultPageReceiptEventRef[];
  readonly world: Phase6ResultPageChangeSet;
  readonly identityProgression: Phase6ResultPageIdentityProgressionSection;
  readonly settlement: Omit<Phase6ResultPageRunSettlement, "economyConservation"> & {
    readonly economyConservation?: Phase6ResultPageRunSettlement["economyConservation"];
  };
  readonly scoreSummary: Phase6ResultPageScoreSummary;
  readonly scores: readonly Phase6ResultPageScoreDetail[];
  readonly rag: Phase6ResultPageRagSection;
  readonly audit: Omit<Phase6ResultPageAuditSection, "integrity"> & {
    readonly integrity?: Phase6ResultPageAuditSection["integrity"];
  };
}

export interface Phase6RunAssemblyInput {
  readonly runId: string;
  readonly journeyId: string;
  readonly beforeSnapshot: Phase6RunAssemblySnapshotSource;
  readonly afterSnapshot: Phase6RunAssemblySnapshotSource;
  readonly economy: Phase6RunAssemblyEconomyInput;
  readonly projectionDelta: Phase6ProjectionDeltaInput;
  readonly receipt: Omit<BuildJourneyRunReceiptInput, "runId" | "journeyId" | "score" | "suitability"> & {
    readonly score: JourneyRunScore;
    readonly suitability: JourneyRunSuitability;
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
}

export interface Phase6RunAssemblyArtifacts {
  readonly beforeSnapshot: Phase6PlayerSnapshotDocument;
  readonly afterSnapshot: Phase6PlayerSnapshotDocument;
  readonly snapshotDiff: Phase6PlayerSnapshotDiff;
  readonly economyFlows: readonly Phase6EconomyResourceFlow[];
  readonly economyEventAdapterReport?: Phase6EconomyEventAdapterReport;
  readonly economyAudit: Phase6EconomyAuditReport;
  readonly projectionDelta: Phase6ProjectionDelta;
  readonly receipt: JourneyRunReceipt;
  readonly resultPageInput: Phase6ResultPageInput;
  readonly resultPageOutput: Phase6ResultPageBuildResult;
}

export interface Phase6RunAssemblySuccess {
  readonly ok: true;
  readonly rulesetVersion: typeof PHASE6_RUN_ASSEMBLY_RULESET_VERSION;
  readonly deterministic: true;
  readonly artifacts: Phase6RunAssemblyArtifacts;
  readonly findings: readonly [];
}

export interface Phase6RunAssemblyFailure {
  readonly ok: false;
  readonly rulesetVersion: typeof PHASE6_RUN_ASSEMBLY_RULESET_VERSION;
  readonly deterministic: true;
  readonly findings: readonly Phase6RunAssemblyFinding[];
  readonly artifacts?: Partial<Phase6RunAssemblyArtifacts>;
}

export type Phase6RunAssemblyResult = Phase6RunAssemblySuccess | Phase6RunAssemblyFailure;

interface SnapshotBuildSuccess {
  readonly ok: true;
  readonly document: Phase6PlayerSnapshotDocument;
}

interface SnapshotBuildFailure {
  readonly ok: false;
  readonly findings: readonly Phase6RunAssemblyFinding[];
}

type SnapshotBuildResult = SnapshotBuildSuccess | SnapshotBuildFailure;

function finding(
  code: Phase6RunAssemblyFindingCode,
  message: string,
  path: string,
  details?: Readonly<Record<string, unknown>>,
): Phase6RunAssemblyFinding {
  return { code, severity: "error", message, path, details };
}

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

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

function rejectPrecomputedArtifacts(input: Phase6RunAssemblyInput): readonly Phase6RunAssemblyFinding[] {
  const forbidden = collectForbiddenPrecomputedFields(input);
  if (forbidden.length === 0) return [];
  return [
    finding(
      "PHASE6_RUN_ASSEMBLY_PRECOMPUTED_REJECTED",
      "Phase 6 run assembly accepts only authoritative raw settlement inputs; finalized receipts and result pages are produced internally after server scoring, suitability, and RAG are bound",
      "$",
      { paths: forbidden },
    ),
  ];
}

function receiptEventRefs(receipt: JourneyRunReceipt): readonly Phase6ResultPageReceiptEventRef[] {
  return [
    ...receipt.eventIds.source.map((eventId) => ({ eventId, kind: "source" })),
    ...receipt.eventIds.settlement.map((eventId) => ({ eventId, kind: "settlement" })),
    ...receipt.eventIds.derived.map((eventId) => ({ eventId, kind: "derived" })),
  ] as unknown as readonly Phase6ResultPageReceiptEventRef[];
}

function deriveResultPageSectionsFromFinalizedReceipt(
  receipt: JourneyRunReceipt,
  economyAudit: Phase6EconomyAuditReport,
  projectionDelta: Phase6ProjectionDelta,
): Phase6RunAssemblyResultPageSections {
  const canonicalEventIds = projectionDelta.canonicalEvents.map((event) => event.eventId);
  const canonical = new Set(canonicalEventIds);
  const referencedEventIds = (eventIds: readonly string[]) => {
    const matched = [...new Set(eventIds.filter((eventId) => canonical.has(eventId)))];
    return matched.length > 0 ? matched : canonicalEventIds;
  };
  const worldChanges: readonly Phase6ResultPageChangeSet["changes"][number][] = projectionDelta.worldDelta.changes.map((change, index) => ({
    id: `world:${change.domain}:${change.key}:${index}`,
    label: `${change.domain}:${change.kind}`,
    ...(change.beforeSummary !== undefined ? { before: change.beforeSummary } : {}),
    ...(change.afterSummary !== undefined ? { after: change.afterSummary } : {}),
    eventIds: referencedEventIds(change.sourceEvents.map((event) => event.eventId)),
  }));
  const world: Phase6ResultPageChangeSet = worldChanges.length > 0
    ? { mode: "changed", changes: worldChanges, eventIds: referencedEventIds(worldChanges.flatMap((change) => change.eventIds)) }
    : {
        mode: "no_change",
        changes: [],
        noChangeReason: projectionDelta.worldDelta.noWorldChangeReason || "server_projection_has_no_world_change",
        eventIds: canonicalEventIds,
      };

  const beforeBody = isRecord(receipt.snapshots.before.body) ? receipt.snapshots.before.body : {};
  const afterBody = isRecord(receipt.snapshots.after.body) ? receipt.snapshots.after.body : {};
  const snapshotChangeSet = (key: "identity", label: string): Phase6ResultPageChangeSet => {
    const before = beforeBody[key];
    const after = afterBody[key];
    if (stableJson(before) === stableJson(after)) {
      return {
        mode: "no_change",
        changes: [],
        noChangeReason: `${key}_projection_equal`,
        eventIds: canonicalEventIds,
      };
    }
    return {
      mode: "changed",
      changes: [{
        id: `${receipt.receiptId}:${key}`,
        label,
        ...(before !== undefined ? { before } : {}),
        ...(after !== undefined ? { after } : {}),
        eventIds: canonicalEventIds,
      }],
      eventIds: canonicalEventIds,
    };
  };

  const ragChanges: readonly Phase6ResultPageChangeSet["changes"][number][] = projectionDelta.ragDelta.memories.map((memory) => ({
    id: `rag:${memory.slot}:${memory.key}`,
    label: `RAG memory ${memory.kind}`,
    ...(memory.beforeText !== undefined ? { before: memory.beforeText } : {}),
    ...(memory.afterText !== undefined ? { after: memory.afterText } : {}),
    eventIds: referencedEventIds(memory.sourceEvents.map((event) => event.eventId)),
  }));
  const ragEventIds = referencedEventIds(ragChanges.flatMap((change) => change.eventIds));
  const rag: Phase6ResultPageRagSection = ragChanges.length > 0
    ? {
        mode: "changed",
        changes: ragChanges,
        eventIds: ragEventIds,
        evidenceIds: ragEventIds,
        retrievalSnapshotId: receipt.rag.corpusHash,
      }
    : {
        mode: "no_change",
        changes: [],
        noChangeReason: projectionDelta.ragDelta.noChangeReason || "server_verified_no_rag_change",
        eventIds: canonicalEventIds,
        evidenceIds: canonicalEventIds,
        retrievalSnapshotId: receipt.rag.corpusHash,
      };

  const settlementEventIds = referencedEventIds(receipt.eventIds.settlement);
  const scoreDetails = phase6ResultPageScoreDetails(receipt.score, canonicalEventIds);
  const receiptPayloadHash = receipt.integrity.payloadHash;
  return {
    events: resultPageEvents(projectionDelta, receipt),
    world,
    identityProgression: {
      identity: snapshotChangeSet("identity", "Identity state changed"),
      progression: buildPhase6ProgressionChangeSet({
        receiptId: receipt.receiptId,
        beforeSnapshotBody: beforeBody,
        afterSnapshotBody: afterBody,
        canonicalEventIds,
      }),
    },
    settlement: {
      status: "settled",
      settlementId: `${receipt.receiptId}:settlement`,
      eventIds: settlementEventIds,
      economyConservation: economyConservation(economyAudit),
    },
    scoreSummary: phase6ResultPageScoreSummary(receipt.score),
    scores: scoreDetails,
    rag,
    audit: {
      auditId: `${receipt.receiptId}:audit`,
      eventIds: canonicalEventIds,
      integrity: {
        ok: true,
        receiptPayloadHash,
        canonicalEventIds,
        checkedAt: receipt.generatedAt,
      },
    },
  };
}

function fail(
  findings: readonly Phase6RunAssemblyFinding[],
  artifacts?: Partial<Phase6RunAssemblyArtifacts>,
): Phase6RunAssemblyFailure {
  return {
    ok: false,
    rulesetVersion: PHASE6_RUN_ASSEMBLY_RULESET_VERSION,
    deterministic: true,
    findings,
    ...(artifacts ? { artifacts } : {}),
  };
}

function buildSnapshot(
  source: Phase6RunAssemblySnapshotSource,
  path: string,
  dependencies: Phase6RunAssemblyDependencies,
): SnapshotBuildResult {
  if (source.kind === "document") return { ok: true, document: source.document };
  if (source.kind === "player_snapshot_input") {
    return { ok: true, document: buildPhase6PlayerSnapshotDocument(source.input) };
  }
  if (!dependencies.buildPanelSnapshot) {
    return {
      ok: false,
      findings: [
        finding(
          "PHASE6_RUN_ASSEMBLY_PANEL_SNAPSHOT_ADAPTER_MISSING",
          "panel snapshot sources require an injected Phase 6 panel snapshot adapter",
          path,
        ),
      ],
    };
  }

  const result = dependencies.buildPanelSnapshot(source.input);
  if (result.ok) return { ok: true, document: result.value };
  return {
    ok: false,
    findings: result.errors.map((error, index) => finding(
      "PHASE6_RUN_ASSEMBLY_PANEL_SNAPSHOT_FAILED",
      error.message,
      `${path}.adapterErrors.${index}`,
      { adapterCode: error.code, adapterPath: error.path },
    )),
  };
}

function snapshotDiff(
  before: Phase6PlayerSnapshotDocument,
  after: Phase6PlayerSnapshotDocument,
): Phase6PlayerSnapshotDiff {
  if (before.hash === after.hash) {
    return {
      beforeHash: before.hash,
      afterHash: after.hash,
      changed: false,
      added: [],
      removed: [],
      changedValues: [],
      noChangeReason: "hash_equal",
    };
  }

  const beforeValues = flattenSnapshot(before.snapshot);
  const afterValues = flattenSnapshot(after.snapshot);
  const beforePaths = new Set(beforeValues.keys());
  const afterPaths = new Set(afterValues.keys());
  const added = [...afterPaths]
    .filter((path) => !beforePaths.has(path))
    .sort()
    .map((path) => ({ path, after: afterValues.get(path) as CausalCanonicalJsonValue }));
  const removed = [...beforePaths]
    .filter((path) => !afterPaths.has(path))
    .sort()
    .map((path) => ({ path, before: beforeValues.get(path) as CausalCanonicalJsonValue }));
  const changedValues = [...beforePaths]
    .filter((path) => afterPaths.has(path) && stableJson(beforeValues.get(path)) !== stableJson(afterValues.get(path)))
    .sort()
    .map((path) => ({ path, before: beforeValues.get(path) as CausalCanonicalJsonValue, after: afterValues.get(path) as CausalCanonicalJsonValue }));

  return {
    beforeHash: before.hash,
    afterHash: after.hash,
    changed: added.length > 0 || removed.length > 0 || changedValues.length > 0,
    added,
    removed,
    changedValues,
    noChangeReason: added.length === 0 && removed.length === 0 && changedValues.length === 0 ? "canonical_json_equal" : undefined,
  };
}

function flattenSnapshot(value: unknown): Map<string, unknown> {
  const out = new Map<string, unknown>();
  visit("$", value, out);
  return out;
}

function visit(path: string, value: unknown, out: Map<string, unknown>): void {
  if (Array.isArray(value)) {
    if (value.length === 0) out.set(path, value);
    value.forEach((item, index) => visit(`${path}[${index}]`, item, out));
    return;
  }
  if (isRecord(value)) {
    const keys = Object.keys(value).sort();
    if (keys.length === 0) out.set(path, value);
    keys.forEach((key) => visit(`${path}.${key}`, value[key], out));
    return;
  }
  out.set(path, value);
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (isRecord(value)) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function economyFlows(input: Phase6RunAssemblyEconomyInput) {
  if (input.flows) return { flows: input.flows };
  const adapted = adaptPhase6EconomyEvents(input.sourceEvents || []);
  return { flows: adapted.flows, report: adapted.report };
}

function validateMetricMap(
  value: Readonly<Record<string, JourneyRunReceiptMetric>>,
  dimensions: readonly string[],
  path: string,
  code: "PHASE6_RUN_ASSEMBLY_SCORE_INVALID" | "PHASE6_RUN_ASSEMBLY_SUITABILITY_INVALID",
): readonly Phase6RunAssemblyFinding[] {
  const findings: Phase6RunAssemblyFinding[] = [];
  const keys = Object.keys(value).sort();
  const expected = [...dimensions].sort();
  if (stableJson(keys) !== stableJson(expected)) {
    findings.push(finding(code, "metric map must contain exactly the required dimensions", path, { expected, actual: keys }));
  }
  for (const dimension of dimensions) {
    const metric = value[dimension];
    if (!isRecord(metric)) {
      findings.push(finding(code, "metric is required", `${path}.${dimension}`));
      continue;
    }
    if (typeof metric.value !== "number" || !Number.isFinite(metric.value) || metric.value < 0 || metric.value > 100) {
      findings.push(finding(code, "metric value must be a finite number between 0 and 100", `${path}.${dimension}.value`));
    }
    if (!Array.isArray(metric.evidence) || metric.evidence.some((entry) => !nonEmpty(entry))) {
      findings.push(finding(code, "metric evidence must be non-empty strings", `${path}.${dimension}.evidence`));
    }
  }
  return findings;
}

function receiptValidationFindings(
  validation: ReturnType<typeof validateJourneyRunReceipt>,
): readonly Phase6RunAssemblyFinding[] {
  if (validation.ok) return [];
  return validation.issues.map((issue) => finding(
    "PHASE6_RUN_ASSEMBLY_RECEIPT_INVALID",
    issue.code,
    issue.path,
  ));
}

function validateReceiptAuthoritativeFields(input: Phase6RunAssemblyInput): readonly Phase6RunAssemblyFinding[] {
  const findings: Phase6RunAssemblyFinding[] = [];
  const receipt = input.receipt as unknown as UnknownRecord;
  const textFields = [
    "receiptId",
    "agentId",
    "explorerId",
    "experimentId",
    "seed",
    "rulesetVersion",
    "catalogVersion",
    "codeVersion",
    "scenarioMatrixVersion",
    "generatedAt",
    "startedAt",
    "settledAt",
  ] as const;
  for (const field of textFields) {
    if (!nonEmpty(receipt[field])) {
      findings.push(finding(
        "PHASE6_RUN_ASSEMBLY_RECEIPT_FIELD_REQUIRED",
        `${field} must be supplied by authoritative Phase 6 input`,
        `receipt.${field}`,
      ));
    }
  }
  if (!Number.isInteger(receipt.runIndex) || (receipt.runIndex as number) < 1 || (receipt.runIndex as number) > 10) {
    findings.push(finding(
      "PHASE6_RUN_ASSEMBLY_RECEIPT_FIELD_REQUIRED",
      "runIndex must be supplied by authoritative Phase 6 input as an integer from 1 to 10",
      "receipt.runIndex",
    ));
  }
  const world = receipt.world;
  if (!isRecord(world)) {
    findings.push(finding(
      "PHASE6_RUN_ASSEMBLY_RECEIPT_FIELD_REQUIRED",
      "world must be supplied by authoritative Phase 6 input",
      "receipt.world",
    ));
  } else {
    for (const field of ["worldId", "regionId", "worldTimeBefore", "worldTimeAfter"] as const) {
      if (!nonEmpty(world[field])) {
        findings.push(finding(
          "PHASE6_RUN_ASSEMBLY_RECEIPT_FIELD_REQUIRED",
          `world.${field} must be supplied by authoritative Phase 6 input`,
          `receipt.world.${field}`,
        ));
      }
    }
  }
  const snapshots = receipt.snapshots;
  if (!isRecord(snapshots)) {
    findings.push(finding(
      "PHASE6_RUN_ASSEMBLY_RECEIPT_FIELD_REQUIRED",
      "before and after snapshot receipt bodies and hashes must be supplied by authoritative Phase 6 input",
      "receipt.snapshots",
    ));
  } else {
    for (const side of ["before", "after"] as const) {
      const snapshot = snapshots[side];
      if (!isRecord(snapshot)) {
        findings.push(finding(
          "PHASE6_RUN_ASSEMBLY_RECEIPT_FIELD_REQUIRED",
          `${side} snapshot body and hash must be supplied by authoritative Phase 6 input`,
          `receipt.snapshots.${side}`,
        ));
        continue;
      }
      if (snapshot.body === undefined) {
        findings.push(finding(
          "PHASE6_RUN_ASSEMBLY_RECEIPT_FIELD_REQUIRED",
          `${side} snapshot body must be supplied by authoritative Phase 6 input`,
          `receipt.snapshots.${side}.body`,
        ));
      }
      if (!nonEmpty(snapshot.hash)) {
        findings.push(finding(
          "PHASE6_RUN_ASSEMBLY_RECEIPT_FIELD_REQUIRED",
          `${side} snapshot hash must be supplied by authoritative Phase 6 input`,
          `receipt.snapshots.${side}.hash`,
        ));
      }
    }
  }
  if (receipt.outcome === undefined) {
    findings.push(finding(
      "PHASE6_RUN_ASSEMBLY_RECEIPT_FIELD_REQUIRED",
      "outcome must be supplied by authoritative Phase 6 input",
      "receipt.outcome",
    ));
  }
  return findings;
}

function resultPageEvents(projectionDelta: Phase6ProjectionDelta, receipt: JourneyRunReceipt): readonly Phase6ResultPageReceiptEventRef[] {
  return projectionDelta.canonicalEvents.map((event) => ({
    eventId: event.eventId,
    eventType: event.eventType,
    aggregateType: event.aggregateType,
    aggregateId: event.aggregateId,
    receiptId: receipt.receiptId,
    runId: receipt.runId,
  }));
}

function economyConservation(audit: Phase6EconomyAuditReport): Phase6ResultPageRunSettlement["economyConservation"] {
  return {
    conserved: audit.ok,
    assets: audit.assets.map((asset): Phase6ResultPageEconomyAssetConservation => ({
      assetKey: asset.assetKey,
      unit: asset.unit,
      openingTotalMinor: asset.openingTotalMinor,
      closingTotalMinor: asset.closingTotalMinor,
      systemMintMinor: asset.systemMintMinor,
      systemBurnMinor: asset.systemBurnMinor,
      expectedClosingTotalMinor: asset.expectedClosingTotalMinor,
      unexplainedDeltaMinor: asset.unexplainedDeltaMinor,
      conserved: asset.conserved,
    })),
    auditFindingIds: audit.findings.map((entry, index) => `${entry.code}:${index}`),
  };
}

function resultPageInput(
  input: Phase6RunAssemblyInput,
  receipt: JourneyRunReceipt,
  projectionDelta: Phase6ProjectionDelta,
  economyAudit: Phase6EconomyAuditReport,
): Phase6ResultPageInput {
  const resultPage = deriveResultPageSectionsFromFinalizedReceipt(receipt, economyAudit, projectionDelta);
  const canonicalEventIds = projectionDelta.canonicalEvents.map((event) => event.eventId);
  const receiptPayloadHash = receipt.integrity.payloadHash;
  return {
    receipt: {
      receiptId: receipt.receiptId,
      runId: receipt.runId,
      createdAt: receipt.generatedAt,
      payloadHash: receiptPayloadHash,
      canonicalEventIds,
      canonicalEvents: resultPageEvents(projectionDelta, receipt),
    },
    events: resultPage.events || resultPageEvents(projectionDelta, receipt),
    world: resultPage.world,
    identityProgression: resultPage.identityProgression,
    settlement: {
      ...resultPage.settlement,
      economyConservation: resultPage.settlement.economyConservation || economyConservation(economyAudit),
    },
    scoreSummary: resultPage.scoreSummary,
    scores: resultPage.scores,
    rag: resultPage.rag,
    audit: {
      ...resultPage.audit,
      integrity: resultPage.audit.integrity || {
        ok: true,
        receiptPayloadHash,
        canonicalEventIds,
        checkedAt: receipt.generatedAt,
      },
    },
  };
}

function resultPageFindings(findings: readonly Phase6ResultPageFinding[]): readonly Phase6RunAssemblyFinding[] {
  return findings.map((entry, index) => finding(
    "PHASE6_RUN_ASSEMBLY_RESULT_PAGE_FAILED",
    entry.message,
    entry.path || `resultPage.findings.${index}`,
    { resultPageCode: entry.code, ...entry.details },
  ));
}

function economyAuditFindings(findings: readonly Phase6EconomyAuditFinding[]): readonly Phase6RunAssemblyFinding[] {
  return findings.map((entry, index) => finding(
    "PHASE6_RUN_ASSEMBLY_ECONOMY_AUDIT_FAILED",
    entry.message,
    entry.path || `economy.audit.findings.${index}`,
    { economyCode: entry.code, ...entry.details },
  ));
}

export function assemblePhase6Run(
  input: Phase6RunAssemblyInput,
  dependencies: Phase6RunAssemblyDependencies = {},
): Phase6RunAssemblyResult {
  const inputFindings = rejectPrecomputedArtifacts(input);
  if (inputFindings.length > 0) return fail(inputFindings);

  const beforeSnapshot = buildSnapshot(input.beforeSnapshot, "beforeSnapshot", dependencies);
  if (!beforeSnapshot.ok) return fail(beforeSnapshot.findings);

  const afterSnapshot = buildSnapshot(input.afterSnapshot, "afterSnapshot", dependencies);
  if (!afterSnapshot.ok) return fail(afterSnapshot.findings, { beforeSnapshot: beforeSnapshot.document });

  const diff = snapshotDiff(beforeSnapshot.document, afterSnapshot.document);
  const economy = economyFlows(input.economy);
  if (economy.report && !economy.report.ok) {
    return fail(
      economy.report.findings.map((entry, index) => finding(
        "PHASE6_RUN_ASSEMBLY_ECONOMY_EVENT_ADAPTER_FAILED",
        entry.message,
        entry.path || `economy.sourceEvents.${index}`,
        { adapterCode: entry.code, sourceEventIds: entry.sourceEventIds, sourceRef: entry.sourceRef, ...entry.details },
      )),
      {
        beforeSnapshot: beforeSnapshot.document,
        afterSnapshot: afterSnapshot.document,
        snapshotDiff: diff,
        economyFlows: economy.flows,
        economyEventAdapterReport: economy.report,
      },
    );
  }

  const audit = auditPhase6EconomyConservation({
    previous: input.economy.previous,
    next: input.economy.next,
    flows: economy.flows,
  });
  if (audit.findings.length > 0 || !audit.ok) {
    return fail(
      economyAuditFindings(audit.findings),
      {
        beforeSnapshot: beforeSnapshot.document,
        afterSnapshot: afterSnapshot.document,
        snapshotDiff: diff,
        economyFlows: economy.flows,
        economyEventAdapterReport: economy.report,
        economyAudit: audit,
      },
    );
  }

  const projectionDelta = buildPhase6ProjectionDelta(input.projectionDelta);
  const receiptFieldFindings = validateReceiptAuthoritativeFields(input);
  if (receiptFieldFindings.length > 0) {
    return fail(receiptFieldFindings, {
      beforeSnapshot: beforeSnapshot.document,
      afterSnapshot: afterSnapshot.document,
      snapshotDiff: diff,
      economyFlows: economy.flows,
      economyEventAdapterReport: economy.report,
      economyAudit: audit,
      projectionDelta,
    });
  }

  const scoreFindings = validateJourneyRunScore(input.receipt.score).issues.map((issue) => finding(
    "PHASE6_RUN_ASSEMBLY_SCORE_INVALID",
    issue.code,
    `receipt.score${issue.path === "$" ? "" : issue.path.slice(1)}`,
  ));
  if (scoreFindings.length > 0) {
    return fail(scoreFindings, {
      beforeSnapshot: beforeSnapshot.document,
      afterSnapshot: afterSnapshot.document,
      snapshotDiff: diff,
      economyFlows: economy.flows,
      economyEventAdapterReport: economy.report,
      economyAudit: audit,
      projectionDelta,
    });
  }

  const suitabilityFindings = validateMetricMap(
    input.receipt.suitability,
    JOURNEY_RUN_SUITABILITY_DIMENSIONS,
    "receipt.suitability",
    "PHASE6_RUN_ASSEMBLY_SUITABILITY_INVALID",
  );
  if (suitabilityFindings.length > 0) {
    return fail(suitabilityFindings, {
      beforeSnapshot: beforeSnapshot.document,
      afterSnapshot: afterSnapshot.document,
      snapshotDiff: diff,
      economyFlows: economy.flows,
      economyEventAdapterReport: economy.report,
      economyAudit: audit,
      projectionDelta,
    });
  }

  const receipt = buildJourneyRunReceipt({
    ...input.receipt,
    runId: input.runId,
    journeyId: input.journeyId,
    score: input.receipt.score,
    suitability: input.receipt.suitability,
  });
  const receiptFindings = receiptValidationFindings(validateJourneyRunReceipt(receipt));
  if (receiptFindings.length > 0) {
    return fail(receiptFindings, {
      beforeSnapshot: beforeSnapshot.document,
      afterSnapshot: afterSnapshot.document,
      snapshotDiff: diff,
      economyFlows: economy.flows,
      economyEventAdapterReport: economy.report,
      economyAudit: audit,
      projectionDelta,
      receipt,
    });
  }

  const pageInput = resultPageInput(input, receipt, projectionDelta, audit);
  if (!dependencies.buildResultPage) {
    return fail(
      [
        finding(
          "PHASE6_RUN_ASSEMBLY_RESULT_PAGE_BUILDER_MISSING",
          "result page assembly requires an injected Phase 6 result page builder",
          "resultPage",
        ),
      ],
      {
        beforeSnapshot: beforeSnapshot.document,
        afterSnapshot: afterSnapshot.document,
        snapshotDiff: diff,
        economyFlows: economy.flows,
        economyEventAdapterReport: economy.report,
        economyAudit: audit,
        projectionDelta,
        receipt,
        resultPageInput: pageInput,
      },
    );
  }

  const pageOutput = dependencies.buildResultPage(pageInput);
  if (!pageOutput.ok || pageOutput.findings.length > 0) {
    return fail(
      resultPageFindings(pageOutput.findings),
      {
        beforeSnapshot: beforeSnapshot.document,
        afterSnapshot: afterSnapshot.document,
        snapshotDiff: diff,
        economyFlows: economy.flows,
        economyEventAdapterReport: economy.report,
        economyAudit: audit,
        projectionDelta,
        receipt,
        resultPageInput: pageInput,
        resultPageOutput: pageOutput,
      },
    );
  }

  return {
    ok: true,
    rulesetVersion: PHASE6_RUN_ASSEMBLY_RULESET_VERSION,
    deterministic: true,
    artifacts: {
      beforeSnapshot: beforeSnapshot.document,
      afterSnapshot: afterSnapshot.document,
      snapshotDiff: diff,
      economyFlows: economy.flows,
      economyEventAdapterReport: economy.report,
      economyAudit: audit,
      projectionDelta,
      receipt,
      resultPageInput: pageInput,
      resultPageOutput: pageOutput,
    },
    findings: [],
  };
}
