import crypto from "node:crypto";

export const PHASE6_RAG_GATE_TRACE_VERSION = "phase6_server_rag_trace.v2";
export const PHASE6_RAG_GATE_TRACE_LEGACY_VERSION = "phase6_server_rag_trace.v1";
export const PHASE6_RAG_GATE_EVALUATION_VERSION = "phase6_server_rag_evaluation.v1";

const TRACE_AUTHORITY = "server_retriever_observed";
const EVALUATION_AUTHORITY = "server_ground_truth_comparison";
const HASH_PATTERN = /^sha256:[a-f0-9]{64}$/;

type Rec = Record<string, unknown>;

function isRecord(value: unknown): value is Rec {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function canonicalJson(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (isRecord(value)) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  if (typeof value === "number" && !Number.isFinite(value)) throw new Error("non_finite_number");
  return JSON.stringify(value);
}

export function phase6RagCanonicalHash(value: unknown): string {
  return `sha256:${crypto.createHash("sha256").update(canonicalJson(value), "utf8").digest("hex")}`;
}

function uniqueSorted(values: unknown[]): string[] {
  return [...new Set(values.map((value) => String(value).trim()).filter(isNonEmptyString))]
    .sort((left, right) => left.localeCompare(right));
}

interface NormalizedEntry {
  [key: string]: unknown;
  sourceEventIds: string[];
}

function normalizedExpected(entries: unknown[], idKey: string): NormalizedEntry[] {
  const byId = new Map<string, NormalizedEntry>();
  for (const entry of entries) {
    if (!isRecord(entry) || !isNonEmptyString(entry[idKey]) || !Array.isArray(entry.sourceEventIds)) continue;
    const id = (entry[idKey] as string).trim();
    byId.set(id, { [idKey]: id, sourceEventIds: uniqueSorted(entry.sourceEventIds) });
  }
  return [...byId.values()].sort((left, right) => (left[idKey] as string).localeCompare(right[idKey] as string));
}

interface EvaluationInput {
  expectedRecentKeyFacts: unknown[];
  retrievedFactIds: unknown[];
  expectedRouteEvidence: unknown[];
  returnedRouteEvidence: unknown[];
  [key: string]: unknown;
}

function expectedEvaluationFromCollections(evaluation: EvaluationInput): Rec {
  const expectedRecentKeyFacts = normalizedExpected(evaluation.expectedRecentKeyFacts, "factId");
  const retrievedFactIds = uniqueSorted(evaluation.retrievedFactIds);
  const expectedRouteEvidence = normalizedExpected(evaluation.expectedRouteEvidence, "evidenceId");
  const returnedRouteEvidence = normalizedExpected(evaluation.returnedRouteEvidence, "evidenceId");
  const expectedFactIds = new Set(expectedRecentKeyFacts.map((entry) => entry.factId as string));
  const expectedRouteIds = new Set(expectedRouteEvidence.map((entry) => entry.evidenceId as string));
  const recalledFactIds = retrievedFactIds.filter((factId) => expectedFactIds.has(factId));
  const correctEvidenceIds = returnedRouteEvidence
    .map((entry) => entry.evidenceId as string)
    .filter((evidenceId) => expectedRouteIds.has(evidenceId));
  const body = {
    evaluationType: "phase6_server_rag_evaluation",
    version: PHASE6_RAG_GATE_EVALUATION_VERSION,
    authority: EVALUATION_AUTHORITY,
    expectedRecentKeyFacts,
    retrievedFactIds,
    expectedRouteEvidence,
    returnedRouteEvidence,
    metrics: {
      recentKeyFactRecall: {
        recalledFactIds,
        recalledCount: recalledFactIds.length,
        expectedCount: expectedRecentKeyFacts.length,
        value: expectedRecentKeyFacts.length > 0 ? recalledFactIds.length / expectedRecentKeyFacts.length : 0,
      },
      routeSummaryPrecision: {
        correctEvidenceIds,
        correctCount: correctEvidenceIds.length,
        returnedCount: returnedRouteEvidence.length,
        value: returnedRouteEvidence.length > 0 ? correctEvidenceIds.length / returnedRouteEvidence.length : 0,
      },
    },
  };
  return {
    ...body,
    integrity: {
      expectedRecentKeyFactsHash: phase6RagCanonicalHash(body.expectedRecentKeyFacts),
      retrievedFactIdsHash: phase6RagCanonicalHash(body.retrievedFactIds),
      expectedRouteEvidenceHash: phase6RagCanonicalHash(body.expectedRouteEvidence),
      returnedRouteEvidenceHash: phase6RagCanonicalHash(body.returnedRouteEvidence),
      metricsHash: phase6RagCanonicalHash(body.metrics),
      evaluationHash: phase6RagCanonicalHash(body),
    },
  };
}

function traceFromRecord(record: unknown): unknown {
  if (isRecord(record) && isRecord(record?.trace)) return record.trace;
  if (isRecord(record) && isRecord(record?.phase6RagTrace)) return record.phase6RagTrace;
  return record;
}

interface BindingResult {
  experimentId: string;
  runIndex: number;
  runId: string;
  journeyId: string;
}

function validateBinding(trace: Rec, errors: string[]): BindingResult | undefined {
  const binding = trace.binding;
  if (!isRecord(binding)
    || !isRecord(binding.experiment)
    || !isNonEmptyString((binding.experiment as Rec).experimentId)
    || !Number.isInteger((binding.experiment as Rec).runIndex)
    || ((binding.experiment as Rec).runIndex as number) < 1
    || !isRecord(binding.run)
    || !isNonEmptyString((binding.run as Rec).runId)
    || !isNonEmptyString((binding.run as Rec).journeyId)) {
    errors.push("phase6_rag_evaluation_binding_missing");
    return undefined;
  }
  const experiment = binding.experiment as Rec;
  const run = binding.run as Rec;
  return {
    experimentId: experiment.experimentId as string,
    runIndex: experiment.runIndex as number,
    runId: run.runId as string,
    journeyId: run.journeyId as string,
  };
}

function validateTraceIntegrity(trace: Rec, errors: string[]): void {
  const integrity = trace.integrity;
  if (!isRecord(integrity) || !HASH_PATTERN.test((integrity.traceHash as string) || "")) {
    errors.push("phase6_rag_trace_hash_missing");
    return;
  }
  const { integrity: _integrity, ...body } = trace;
  if (phase6RagCanonicalHash(body) !== (integrity.traceHash as string)) errors.push("phase6_rag_trace_hash_mismatch");
  if (trace.query !== undefined) {
    if (!HASH_PATTERN.test((trace.queryHash as string) || "") || phase6RagCanonicalHash(trace.query) !== (trace.queryHash as string)) {
      errors.push("phase6_rag_query_hash_mismatch");
    }
  }
  const fieldsToCheck: [string, unknown][] = [
    ["retrievedHash", trace.retrieved],
    ["usedHash", { chunkIds: trace.usedChunkIds, documentIds: trace.usedDocumentIds }],
    ["groundingHash", trace.groundingHits],
    ["bindingHash", trace.binding],
    ["sourceEventIdsHash", trace.sourceEventIds],
  ];
  for (const [field, value] of fieldsToCheck) {
    if (!HASH_PATTERN.test((integrity[field] as string) || "") || phase6RagCanonicalHash(value) !== (integrity[field] as string)) {
      errors.push(`phase6_rag_${field}_mismatch`);
    }
  }
}

export interface RagGateInspectionResult {
  classification: string;
  errors: string[];
  binding?: BindingResult;
  traceHash?: string;
  recall?: { numerator: number; denominator: number };
  precision?: { numerator: number; denominator: number };
}

export function inspectPhase6RagGateEvidence(record: unknown): RagGateInspectionResult {
  const trace = traceFromRecord(record);
  const errors: string[] = [];
  if (!isRecord(trace) || trace.traceType !== "phase6_server_rag_trace" || trace.authority !== TRACE_AUTHORITY) {
    return { classification: "invalid", errors: ["phase6_rag_authoritative_trace_required"] };
  }
  const binding = validateBinding(trace, errors);
  if (!Array.isArray(trace.retrieved) || !Array.isArray(trace.usedChunkIds)
    || !Array.isArray(trace.usedDocumentIds) || !Array.isArray(trace.groundingHits)
    || !Array.isArray(trace.sourceEventIds)) {
    errors.push("phase6_rag_trace_fields_missing");
  } else {
    validateTraceIntegrity(trace, errors);
  }

  if (trace.status === "legitimate_no_retrieval") {
    if (trace.version !== PHASE6_RAG_GATE_TRACE_LEGACY_VERSION
      || !isNonEmptyString(trace.noRetrievalReason)
      || !Array.isArray(trace.retrieved)
      || (trace.retrieved as unknown[]).length !== 0
      || trace.evaluation !== undefined) {
      errors.push("phase6_rag_legitimate_no_retrieval_invalid");
    }
    return {
      classification: errors.length === 0 ? "legitimate_no_retrieval" : "invalid",
      errors,
      binding,
      traceHash: isRecord(trace.integrity) ? (trace.integrity as Rec).traceHash as string : undefined,
    };
  }

  if (trace.version !== PHASE6_RAG_GATE_TRACE_VERSION || trace.status !== "ok") {
    errors.push("phase6_rag_evaluation_v2_required");
  }
  if (!isNonEmptyString(trace.query) || !HASH_PATTERN.test((trace.queryHash as string) || "")) {
    errors.push("phase6_rag_evaluation_query_required");
  }
  const evaluation = trace.evaluation;
  if (!isRecord(evaluation)
    || evaluation.evaluationType !== "phase6_server_rag_evaluation"
    || evaluation.version !== PHASE6_RAG_GATE_EVALUATION_VERSION
    || evaluation.authority !== EVALUATION_AUTHORITY
    || !Array.isArray(evaluation.expectedRecentKeyFacts)
    || !Array.isArray(evaluation.retrievedFactIds)
    || !Array.isArray(evaluation.expectedRouteEvidence)
    || !Array.isArray(evaluation.returnedRouteEvidence)) {
    errors.push("phase6_rag_evaluation_fields_missing");
    return { classification: "invalid", errors, binding, traceHash: isRecord(trace.integrity) ? (trace.integrity as Rec).traceHash as string : undefined };
  }
  if ((evaluation.expectedRecentKeyFacts as unknown[]).length === 0
    || (evaluation.expectedRouteEvidence as unknown[]).length === 0
    || (evaluation.returnedRouteEvidence as unknown[]).length === 0) {
    errors.push("phase6_rag_evaluation_sample_insufficient");
  }
  const sourceEvents = new Set((trace.sourceEventIds as unknown[]) || []);
  for (const entry of [...(evaluation.expectedRecentKeyFacts as unknown[]), ...(evaluation.expectedRouteEvidence as unknown[])]) {
    if (!isRecord(entry) || !Array.isArray(entry.sourceEventIds) || (entry.sourceEventIds as unknown[]).length === 0
      || (entry.sourceEventIds as unknown[]).some((eventId) => !sourceEvents.has(eventId))) {
      errors.push("phase6_rag_evaluation_ground_truth_unbound");
      break;
    }
  }
  const expected = expectedEvaluationFromCollections(evaluation as unknown as EvaluationInput);
  if (phase6RagCanonicalHash(evaluation) !== phase6RagCanonicalHash(expected)) {
    errors.push("phase6_rag_evaluation_integrity_mismatch");
  }
  const traceIntegrity = isRecord(trace.integrity) ? trace.integrity as Rec : undefined;
  const expectedIntegrity = expected.integrity as Rec;
  if (traceIntegrity?.evaluationHash !== expectedIntegrity.evaluationHash) {
    errors.push("phase6_rag_trace_evaluation_hash_mismatch");
  }
  const metrics = expected.metrics as Rec;
  const recentKeyFactRecall = metrics.recentKeyFactRecall as Rec;
  const routeSummaryPrecision = metrics.routeSummaryPrecision as Rec;
  return {
    classification: errors.length === 0 ? "evaluated" : "invalid",
    errors,
    binding,
    traceHash: traceIntegrity?.traceHash as string | undefined,
    recall: {
      numerator: recentKeyFactRecall.recalledCount as number,
      denominator: recentKeyFactRecall.expectedCount as number,
    },
    precision: {
      numerator: routeSummaryPrecision.correctCount as number,
      denominator: routeSummaryPrecision.returnedCount as number,
    },
  };
}
