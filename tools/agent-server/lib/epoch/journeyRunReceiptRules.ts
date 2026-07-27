import {
  causalCanonicalJson,
  causalCanonicalJsonHash,
  type CausalCanonicalJsonValue,
} from "./causalCanonicalJson.ts";

export const JOURNEY_RUN_RECEIPT_VERSION = "journey_run_receipt.v2" as const;
export const JOURNEY_RUN_RECEIPT_AUTHORITY = "server_settled" as const;
export const JOURNEY_RUN_SCORE_CONTRACT_VERSION = "phase6_score.v2" as const;
export const JOURNEY_RUN_SCORE_AUTHORITY = "server_authoritative" as const;
export const JOURNEY_RUN_SCORE_FORMULA =
  "total = sum(dimensions[dimension].contribution) * decay" as const;
export const JOURNEY_RUN_SCORE_DIMENSIONS = [
  "objective",
  "causalImpact",
  "execution",
  "risk",
  "integrity",
  "efficiency",
  "survival",
  "antiFarmDecay",
] as const;

export const JOURNEY_RUN_SUITABILITY_DIMENSIONS = [
  "combat",
  "mobility",
  "survival",
  "knowledge",
  "social",
  "stealth",
  "craft",
  "resources",
  "temperament",
  "world_fit",
] as const;

export type JourneyRunScoreDimension = typeof JOURNEY_RUN_SCORE_DIMENSIONS[number];
export type JourneyRunSuitabilityDimension = typeof JOURNEY_RUN_SUITABILITY_DIMENSIONS[number];
export type JourneyRunReceiptAuthority = typeof JOURNEY_RUN_RECEIPT_AUTHORITY;
export type JourneyRunReceiptHash = `sha256:${string}`;

export const JOURNEY_RUN_SCORE_WEIGHT_BPS = {
  objective: 2_200,
  causalImpact: 1_400,
  execution: 1_800,
  risk: 1_000,
  integrity: 1_200,
  efficiency: 1_200,
  survival: 700,
  antiFarmDecay: 500,
} as const satisfies Readonly<Record<JourneyRunScoreDimension, number>>;

export interface JourneyRunReceiptMetric {
  readonly value: number;
  readonly evidence: readonly string[];
}

export interface JourneyRunScoreMetric extends JourneyRunReceiptMetric {
  readonly events: readonly string[];
  readonly weightBps: number;
  readonly contribution: number;
  readonly reasonCode: string;
  readonly formula: string;
  readonly inputs: Readonly<Record<string, number>>;
  readonly inputContributions: Readonly<Record<string, number>>;
}

export interface JourneyRunScoreContext {
  readonly difficultyBaseline: number;
  readonly combatPowerBaseline: number;
  readonly expectedPerformanceBaseline: number;
  readonly observedPerformance: number;
  readonly performanceDeltaFromBaseline: number;
  readonly scoringUse: "context_only_not_weighted";
}

export interface JourneyRunScore {
  readonly contractVersion: typeof JOURNEY_RUN_SCORE_CONTRACT_VERSION;
  readonly authority: typeof JOURNEY_RUN_SCORE_AUTHORITY;
  readonly provenance: "server_canonical";
  readonly formula: typeof JOURNEY_RUN_SCORE_FORMULA;
  readonly dimensions: Readonly<Record<JourneyRunScoreDimension, JourneyRunScoreMetric>>;
  readonly weightedTotal: number;
  readonly decay: number;
  readonly total: number;
  readonly context: JourneyRunScoreContext;
}

export type JourneyRunSuitability = Readonly<Record<JourneyRunSuitabilityDimension, JourneyRunReceiptMetric>>;

export type JourneyRunDeltaOp = "set" | "increment" | "decrement" | "append" | "remove" | "link";

export interface JourneyRunStructuredDelta {
  readonly op: JourneyRunDeltaOp;
  readonly target: {
    readonly kind: string;
    readonly id: string;
  };
  readonly path: readonly string[];
  readonly before?: CausalCanonicalJsonValue;
  readonly after?: CausalCanonicalJsonValue;
  readonly amount?: number;
  readonly reason: string;
  readonly eventIds: readonly string[];
}

export interface JourneyRunRagClaim {
  readonly claimId: string;
  readonly sourceId: string;
  readonly sourceHash: JourneyRunReceiptHash;
  readonly quoteHash?: JourneyRunReceiptHash;
  readonly relevance: number;
}

export interface JourneyRunRagGrounding {
  readonly queryHash: JourneyRunReceiptHash;
  readonly corpusHash: JourneyRunReceiptHash;
  readonly claims: readonly JourneyRunRagClaim[];
}

export interface JourneyRunWorldReceipt {
  readonly worldId: string;
  readonly regionId: string;
  readonly worldTimeBefore: string;
  readonly worldTimeAfter: string;
  readonly simulationVersion?: number;
}

export interface JourneyRunSnapshotReceipt {
  readonly body: CausalCanonicalJsonValue;
  readonly hash: JourneyRunReceiptHash;
}

export interface JourneyRunReceiptSnapshots {
  readonly before: JourneyRunSnapshotReceipt;
  readonly after: JourneyRunSnapshotReceipt;
}

export interface JourneyRunReceiptEventIds {
  readonly source: readonly string[];
  readonly settlement: readonly string[];
  readonly derived: readonly string[];
}

export interface JourneyRunReceiptIntegrity {
  readonly beforeSnapshotHash: JourneyRunReceiptHash;
  readonly afterSnapshotHash: JourneyRunReceiptHash;
  readonly deltasHash: JourneyRunReceiptHash;
  readonly scoreHash: JourneyRunReceiptHash;
  readonly suitabilityHash: JourneyRunReceiptHash;
  readonly ragHash: JourneyRunReceiptHash;
  readonly worldHash: JourneyRunReceiptHash;
  readonly eventIdsHash: JourneyRunReceiptHash;
  readonly outcomeHash: JourneyRunReceiptHash;
  readonly bodyHash: JourneyRunReceiptHash;
  readonly payloadHash: JourneyRunReceiptHash;
}

export interface JourneyRunReceipt {
  readonly receiptType: "journey_run_receipt";
  readonly version: typeof JOURNEY_RUN_RECEIPT_VERSION;
  readonly authority: JourneyRunReceiptAuthority;
  readonly receiptId: string;
  readonly runId: string;
  readonly journeyId: string;
  readonly agentId: string;
  readonly explorerId: string;
  readonly experimentId: string;
  readonly runIndex: number;
  readonly seed: string;
  readonly rulesetVersion: string;
  readonly catalogVersion: string;
  readonly codeVersion: string;
  readonly scenarioMatrixVersion: string;
  readonly matrixVersion?: string;
  readonly generatedAt: string;
  readonly startedAt: string;
  readonly settledAt: string;
  readonly world: JourneyRunWorldReceipt;
  readonly snapshots: JourneyRunReceiptSnapshots;
  readonly deltas: readonly JourneyRunStructuredDelta[];
  readonly score: JourneyRunScore;
  readonly suitability: JourneyRunSuitability;
  readonly rag: JourneyRunRagGrounding;
  readonly eventIds: JourneyRunReceiptEventIds;
  readonly outcome: CausalCanonicalJsonValue;
  readonly integrity: JourneyRunReceiptIntegrity;
}

export interface BuildJourneyRunReceiptInput {
  readonly receiptId: string;
  readonly runId: string;
  readonly journeyId: string;
  readonly agentId: string;
  readonly explorerId: string;
  readonly experimentId: string;
  readonly runIndex: number;
  readonly seed: string;
  readonly rulesetVersion: string;
  readonly catalogVersion: string;
  readonly codeVersion: string;
  readonly scenarioMatrixVersion: string;
  readonly matrixVersion?: string;
  readonly generatedAt: string;
  readonly startedAt: string;
  readonly settledAt: string;
  readonly world: JourneyRunWorldReceipt;
  readonly snapshots: JourneyRunReceiptSnapshots;
  readonly deltas: readonly JourneyRunStructuredDelta[];
  readonly score: JourneyRunScore;
  readonly suitability: JourneyRunSuitability;
  readonly rag: JourneyRunRagGrounding;
  readonly eventIds: JourneyRunReceiptEventIds;
  readonly outcome: CausalCanonicalJsonValue;
}

export interface JourneyRunReceiptValidationIssue {
  readonly code: string;
  readonly path: string;
}

export interface JourneyRunReceiptValidationResult {
  readonly ok: boolean;
  readonly issues: readonly JourneyRunReceiptValidationIssue[];
}

function issue(code: string, path: string): JourneyRunReceiptValidationIssue {
  return { code, path };
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isSha256(value: unknown): value is JourneyRunReceiptHash {
  return typeof value === "string" && /^sha256:[a-f0-9]{64}$/.test(value);
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function unique(values: readonly string[]) {
  return [...new Set(values)];
}

function assertMetricMap<TDimension extends string>(
  value: unknown,
  dimensions: readonly TDimension[],
  path: string,
  issues: JourneyRunReceiptValidationIssue[],
) {
  if (!isRecord(value)) {
    issues.push(issue("journey_run_receipt_metric_map_invalid", path));
    return;
  }
  for (const dimension of dimensions) {
    const metric = value[dimension];
    if (!isRecord(metric)) {
      issues.push(issue("journey_run_receipt_metric_missing", `${path}.${dimension}`));
      continue;
    }
    if (typeof metric.value !== "number" || !Number.isFinite(metric.value) || metric.value < 0 || metric.value > 100) {
      issues.push(issue("journey_run_receipt_metric_value_invalid", `${path}.${dimension}.value`));
    }
    if (!Array.isArray(metric.evidence) || metric.evidence.some((entry) => !nonEmpty(entry))) {
      issues.push(issue("journey_run_receipt_metric_evidence_invalid", `${path}.${dimension}.evidence`));
    }
  }
}

function finiteNumberRecord(
  value: unknown,
  path: string,
  issues: JourneyRunReceiptValidationIssue[],
) {
  if (!isRecord(value)) {
    issues.push(issue("journey_run_receipt_score_numeric_record_invalid", path));
    return;
  }
  for (const [key, entry] of Object.entries(value)) {
    if (!nonEmpty(key) || typeof entry !== "number" || !Number.isFinite(entry)) {
      issues.push(issue("journey_run_receipt_score_numeric_record_invalid", `${path}.${key}`));
    }
  }
}

function closeEnough(left: number, right: number): boolean {
  return Math.abs(left - right) <= 1e-6;
}

function assertJourneyRunScore(
  value: unknown,
  path: string,
  issues: JourneyRunReceiptValidationIssue[],
) {
  if (!isRecord(value)) {
    issues.push(issue("journey_run_receipt_score_invalid", path));
    return;
  }
  if (value.contractVersion !== JOURNEY_RUN_SCORE_CONTRACT_VERSION) {
    issues.push(issue("journey_run_receipt_score_contract_version_invalid", `${path}.contractVersion`));
  }
  if (value.authority !== JOURNEY_RUN_SCORE_AUTHORITY) {
    issues.push(issue("journey_run_receipt_score_authority_invalid", `${path}.authority`));
  }
  if (value.provenance !== "server_canonical") {
    issues.push(issue("journey_run_receipt_score_provenance_invalid", `${path}.provenance`));
  }
  if (value.formula !== JOURNEY_RUN_SCORE_FORMULA) {
    issues.push(issue("journey_run_receipt_score_formula_invalid", `${path}.formula`));
  }

  const dimensions = value.dimensions;
  let expectedWeightedTotal = 0;
  if (!isRecord(dimensions)) {
    issues.push(issue("journey_run_receipt_score_dimensions_invalid", `${path}.dimensions`));
  } else {
    const actual = Object.keys(dimensions).sort();
    const expected = [...JOURNEY_RUN_SCORE_DIMENSIONS].sort();
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      issues.push(issue("journey_run_receipt_score_dimensions_mismatch", `${path}.dimensions`));
    }
    for (const dimension of JOURNEY_RUN_SCORE_DIMENSIONS) {
      const metric = dimensions[dimension];
      const metricPath = `${path}.dimensions.${dimension}`;
      if (!isRecord(metric)) {
        issues.push(issue("journey_run_receipt_score_dimension_missing", metricPath));
        continue;
      }
      const metricValue = metric.value;
      if (typeof metricValue !== "number" || !Number.isFinite(metricValue) || metricValue < 0 || metricValue > 100) {
        issues.push(issue("journey_run_receipt_score_dimension_value_invalid", `${metricPath}.value`));
      }
      if (metric.weightBps !== JOURNEY_RUN_SCORE_WEIGHT_BPS[dimension]) {
        issues.push(issue("journey_run_receipt_score_dimension_weight_invalid", `${metricPath}.weightBps`));
      }
      if (!nonEmpty(metric.reasonCode)) {
        issues.push(issue("journey_run_receipt_score_dimension_reason_invalid", `${metricPath}.reasonCode`));
      }
      if (!nonEmpty(metric.formula)) {
        issues.push(issue("journey_run_receipt_score_dimension_formula_invalid", `${metricPath}.formula`));
      }
      if (!Array.isArray(metric.evidence) || metric.evidence.length === 0 || metric.evidence.some((entry) => !nonEmpty(entry))) {
        issues.push(issue("journey_run_receipt_score_dimension_evidence_invalid", `${metricPath}.evidence`));
      }
      if (!Array.isArray(metric.events) || metric.events.length === 0 || metric.events.some((entry) => !nonEmpty(entry))) {
        issues.push(issue("journey_run_receipt_score_dimension_events_invalid", `${metricPath}.events`));
      }
      finiteNumberRecord(metric.inputs, `${metricPath}.inputs`, issues);
      finiteNumberRecord(metric.inputContributions, `${metricPath}.inputContributions`, issues);
      if (typeof metricValue === "number" && Number.isFinite(metricValue)) {
        const expectedContribution = metricValue * JOURNEY_RUN_SCORE_WEIGHT_BPS[dimension] / 10_000;
        if (typeof metric.contribution !== "number"
          || !Number.isFinite(metric.contribution)
          || !closeEnough(metric.contribution, expectedContribution)) {
          issues.push(issue("journey_run_receipt_score_dimension_contribution_invalid", `${metricPath}.contribution`));
        } else {
          expectedWeightedTotal += metric.contribution;
        }
      }
    }
  }

  if (typeof value.weightedTotal !== "number"
    || !Number.isFinite(value.weightedTotal)
    || value.weightedTotal < 0
    || value.weightedTotal > 100
    || !closeEnough(value.weightedTotal, expectedWeightedTotal)) {
    issues.push(issue("journey_run_receipt_score_weighted_total_invalid", `${path}.weightedTotal`));
  }
  if (typeof value.decay !== "number" || !Number.isFinite(value.decay) || value.decay < 0.65 || value.decay > 1) {
    issues.push(issue("journey_run_receipt_score_decay_invalid", `${path}.decay`));
  }
  if (typeof value.total !== "number" || !Number.isFinite(value.total) || value.total < 0 || value.total > 100) {
    issues.push(issue("journey_run_receipt_score_total_invalid", `${path}.total`));
  } else if (typeof value.weightedTotal === "number"
    && Number.isFinite(value.weightedTotal)
    && typeof value.decay === "number"
    && Number.isFinite(value.decay)
    && !closeEnough(value.total, value.weightedTotal * value.decay)) {
    issues.push(issue("journey_run_receipt_score_total_formula_mismatch", `${path}.total`));
  }

  if (!isRecord(value.context)) {
    issues.push(issue("journey_run_receipt_score_context_invalid", `${path}.context`));
  } else {
    for (const field of [
      "difficultyBaseline",
      "combatPowerBaseline",
      "expectedPerformanceBaseline",
      "observedPerformance",
    ] as const) {
      const contextValue = value.context[field];
      if (typeof contextValue !== "number" || !Number.isFinite(contextValue) || contextValue < 0 || contextValue > 100) {
        issues.push(issue("journey_run_receipt_score_context_value_invalid", `${path}.context.${field}`));
      }
    }
    const delta = value.context.performanceDeltaFromBaseline;
    if (typeof delta !== "number" || !Number.isFinite(delta) || delta < -100 || delta > 100) {
      issues.push(issue("journey_run_receipt_score_context_value_invalid", `${path}.context.performanceDeltaFromBaseline`));
    }
    if (value.context.scoringUse !== "context_only_not_weighted") {
      issues.push(issue("journey_run_receipt_score_context_usage_invalid", `${path}.context.scoringUse`));
    }
  }
}

export function validateJourneyRunScore(score: unknown): JourneyRunReceiptValidationResult {
  const issues: JourneyRunReceiptValidationIssue[] = [];
  assertJourneyRunScore(score, "$", issues);
  return { ok: issues.length === 0, issues };
}

function receiptBody(receipt: Omit<JourneyRunReceipt, "integrity">) {
  return {
    receiptType: receipt.receiptType,
    version: receipt.version,
    authority: receipt.authority,
    receiptId: receipt.receiptId,
    runId: receipt.runId,
    journeyId: receipt.journeyId,
    agentId: receipt.agentId,
    explorerId: receipt.explorerId,
    experimentId: receipt.experimentId,
    runIndex: receipt.runIndex,
    seed: receipt.seed,
    rulesetVersion: receipt.rulesetVersion,
    catalogVersion: receipt.catalogVersion,
    codeVersion: receipt.codeVersion,
    scenarioMatrixVersion: receipt.scenarioMatrixVersion,
    ...(receipt.matrixVersion !== undefined ? { matrixVersion: receipt.matrixVersion } : {}),
    generatedAt: receipt.generatedAt,
    startedAt: receipt.startedAt,
    settledAt: receipt.settledAt,
    world: receipt.world,
    snapshots: receipt.snapshots,
    deltas: receipt.deltas,
    score: receipt.score,
    suitability: receipt.suitability,
    rag: receipt.rag,
    eventIds: receipt.eventIds,
    outcome: receipt.outcome,
  } satisfies Omit<JourneyRunReceipt, "integrity">;
}

export function journeyRunSnapshotHash(snapshot: unknown): JourneyRunReceiptHash {
  return causalCanonicalJsonHash(snapshot);
}

export function journeyRunReceiptPayloadHash(payload: unknown): JourneyRunReceiptHash {
  return causalCanonicalJsonHash(payload);
}

export function journeyRunReceiptCanonicalJson(receipt: JourneyRunReceipt): string {
  return causalCanonicalJson(receipt);
}

export function journeyRunReceiptIntegrity(body: Omit<JourneyRunReceipt, "integrity">): JourneyRunReceiptIntegrity {
  const bodyHash = causalCanonicalJsonHash(receiptBody(body));
  return {
    beforeSnapshotHash: body.snapshots.before.hash,
    afterSnapshotHash: body.snapshots.after.hash,
    deltasHash: causalCanonicalJsonHash(body.deltas),
    scoreHash: causalCanonicalJsonHash(body.score),
    suitabilityHash: causalCanonicalJsonHash(body.suitability),
    ragHash: causalCanonicalJsonHash(body.rag),
    worldHash: causalCanonicalJsonHash(body.world),
    eventIdsHash: causalCanonicalJsonHash(body.eventIds),
    outcomeHash: causalCanonicalJsonHash(body.outcome),
    bodyHash,
    payloadHash: bodyHash,
  };
}

export function buildJourneyRunReceipt(input: BuildJourneyRunReceiptInput): JourneyRunReceipt {
  const scoreValidation = validateJourneyRunScore(input.score);
  if (!scoreValidation.ok) {
    const first = scoreValidation.issues[0];
    throw new TypeError(`${first?.code ?? "journey_run_receipt_score_invalid"}:${first?.path ?? "$"}`);
  }
  const body = receiptBody({
    receiptType: "journey_run_receipt",
    version: JOURNEY_RUN_RECEIPT_VERSION,
    authority: JOURNEY_RUN_RECEIPT_AUTHORITY,
    receiptId: input.receiptId.trim(),
    runId: input.runId.trim(),
    journeyId: input.journeyId.trim(),
    agentId: input.agentId.trim(),
    explorerId: input.explorerId.trim(),
    experimentId: input.experimentId.trim(),
    runIndex: input.runIndex,
    seed: input.seed.trim(),
    rulesetVersion: input.rulesetVersion.trim(),
    catalogVersion: input.catalogVersion.trim(),
    codeVersion: input.codeVersion.trim(),
    scenarioMatrixVersion: input.scenarioMatrixVersion.trim(),
    ...(input.matrixVersion !== undefined ? { matrixVersion: input.matrixVersion } : {}),
    generatedAt: input.generatedAt,
    startedAt: input.startedAt,
    settledAt: input.settledAt,
    world: {
      worldId: input.world.worldId,
      regionId: input.world.regionId,
      worldTimeBefore: input.world.worldTimeBefore,
      worldTimeAfter: input.world.worldTimeAfter,
      ...(typeof input.world.simulationVersion === "number" ? { simulationVersion: input.world.simulationVersion } : {}),
    },
    snapshots: input.snapshots,
    deltas: input.deltas,
    score: input.score,
    suitability: input.suitability,
    rag: input.rag,
    eventIds: {
      source: unique(input.eventIds.source),
      settlement: unique(input.eventIds.settlement),
      derived: unique(input.eventIds.derived),
    },
    outcome: input.outcome,
  });
  return {
    ...body,
    integrity: journeyRunReceiptIntegrity(body),
  };
}

export function extractJourneyRunReceiptEventIds(receipt: JourneyRunReceipt): readonly string[] {
  return unique([
    ...receipt.eventIds.source,
    ...receipt.eventIds.settlement,
    ...receipt.eventIds.derived,
    ...receipt.deltas.flatMap((delta) => delta.eventIds),
  ]).filter(nonEmpty);
}

export function validateJourneyRunReceipt(receipt: unknown): JourneyRunReceiptValidationResult {
  const issues: JourneyRunReceiptValidationIssue[] = [];
  if (!isRecord(receipt)) return { ok: false, issues: [issue("journey_run_receipt_invalid", "$")] };
  const candidate = receipt as unknown as JourneyRunReceipt;
  if (candidate.receiptType !== "journey_run_receipt") issues.push(issue("journey_run_receipt_type_invalid", "$.receiptType"));
  if (candidate.version !== JOURNEY_RUN_RECEIPT_VERSION) issues.push(issue("journey_run_receipt_version_invalid", "$.version"));
  if (candidate.authority !== JOURNEY_RUN_RECEIPT_AUTHORITY) issues.push(issue("journey_run_receipt_authority_invalid", "$.authority"));
  for (const field of [
    "receiptId",
    "runId",
    "journeyId",
    "agentId",
    "explorerId",
    "experimentId",
    "seed",
    "rulesetVersion",
    "catalogVersion",
    "codeVersion",
    "scenarioMatrixVersion",
  ] as const) {
    if (!nonEmpty(candidate[field])) issues.push(issue("journey_run_receipt_text_required", `$.${field}`));
  }
  if (!Number.isInteger(candidate.runIndex) || candidate.runIndex < 1 || candidate.runIndex > 10) {
    issues.push(issue("journey_run_receipt_run_index_invalid", "$.runIndex"));
  }
  if (!nonEmpty(candidate.generatedAt) || !Number.isFinite(Date.parse(candidate.generatedAt))) {
    issues.push(issue("journey_run_receipt_generated_at_invalid", "$.generatedAt"));
  }
  for (const field of ["startedAt", "settledAt"] as const) {
    if (!nonEmpty(candidate[field]) || !Number.isFinite(Date.parse(candidate[field]))) {
      issues.push(issue("journey_run_receipt_time_invalid", `$.${field}`));
    }
  }
  if (!isRecord(candidate.world)) {
    issues.push(issue("journey_run_receipt_world_invalid", "$.world"));
  } else {
    for (const field of ["worldId", "regionId", "worldTimeBefore", "worldTimeAfter"] as const) {
      if (!nonEmpty(candidate.world[field])) issues.push(issue("journey_run_receipt_world_text_required", `$.world.${field}`));
    }
  }
  if (!isRecord(candidate.snapshots)) {
    issues.push(issue("journey_run_receipt_snapshots_invalid", "$.snapshots"));
  } else {
    for (const side of ["before", "after"] as const) {
      const snapshot = candidate.snapshots[side];
      if (!isRecord(snapshot)) {
        issues.push(issue("journey_run_receipt_snapshot_invalid", `$.snapshots.${side}`));
        continue;
      }
      if (snapshot.body === undefined) issues.push(issue("journey_run_receipt_snapshot_body_required", `$.snapshots.${side}.body`));
      if (!isSha256(snapshot.hash)) {
        issues.push(issue("journey_run_receipt_snapshot_hash_invalid", `$.snapshots.${side}.hash`));
      } else if (snapshot.body !== undefined && journeyRunSnapshotHash(snapshot.body) !== snapshot.hash) {
        issues.push(issue("journey_run_receipt_snapshot_hash_mismatch", `$.snapshots.${side}.hash`));
      }
    }
  }
  if (!Array.isArray(candidate.deltas)) {
    issues.push(issue("journey_run_receipt_deltas_invalid", "$.deltas"));
  } else {
    candidate.deltas.forEach((delta, index) => {
      if (!isRecord(delta.target) || !nonEmpty(delta.target.kind) || !nonEmpty(delta.target.id)) {
        issues.push(issue("journey_run_receipt_delta_target_invalid", `$.deltas[${index}].target`));
      }
      if (!Array.isArray(delta.path) || delta.path.some((entry: unknown) => !nonEmpty(entry))) {
        issues.push(issue("journey_run_receipt_delta_path_invalid", `$.deltas[${index}].path`));
      }
      if (!nonEmpty(delta.reason)) issues.push(issue("journey_run_receipt_delta_reason_required", `$.deltas[${index}].reason`));
      if (!Array.isArray(delta.eventIds) || delta.eventIds.some((entry: unknown) => !nonEmpty(entry))) {
        issues.push(issue("journey_run_receipt_delta_event_ids_invalid", `$.deltas[${index}].eventIds`));
      }
    });
  }
  assertJourneyRunScore(candidate.score, "$.score", issues);
  assertMetricMap(candidate.suitability, JOURNEY_RUN_SUITABILITY_DIMENSIONS, "$.suitability", issues);
  if (!isRecord(candidate.rag) || !isSha256(candidate.rag.queryHash) || !isSha256(candidate.rag.corpusHash) || !Array.isArray(candidate.rag.claims)) {
    issues.push(issue("journey_run_receipt_rag_invalid", "$.rag"));
  } else {
    candidate.rag.claims.forEach((claim, index) => {
      if (!nonEmpty(claim.claimId) || !nonEmpty(claim.sourceId) || !isSha256(claim.sourceHash)) {
        issues.push(issue("journey_run_receipt_rag_claim_invalid", `$.rag.claims[${index}]`));
      }
      if (typeof claim.relevance !== "number" || !Number.isFinite(claim.relevance) || claim.relevance < 0 || claim.relevance > 1) {
        issues.push(issue("journey_run_receipt_rag_relevance_invalid", `$.rag.claims[${index}].relevance`));
      }
    });
  }
  if (!isRecord(candidate.eventIds)
    || !Array.isArray(candidate.eventIds.source)
    || !Array.isArray(candidate.eventIds.settlement)
    || !Array.isArray(candidate.eventIds.derived)) {
    issues.push(issue("journey_run_receipt_event_ids_invalid", "$.eventIds"));
  }
  if (candidate.outcome === undefined) issues.push(issue("journey_run_receipt_outcome_required", "$.outcome"));
  if (!isRecord(candidate.integrity)) {
    issues.push(issue("journey_run_receipt_integrity_invalid", "$.integrity"));
  } else {
    const body = receiptBody(candidate);
    const expected = journeyRunReceiptIntegrity(body);
    for (const field of Object.keys(expected) as readonly (keyof JourneyRunReceiptIntegrity)[]) {
      if (candidate.integrity[field] !== expected[field]) {
        issues.push(issue("journey_run_receipt_integrity_mismatch", `$.integrity.${field}`));
      }
    }
  }
  return { ok: issues.length === 0, issues };
}
