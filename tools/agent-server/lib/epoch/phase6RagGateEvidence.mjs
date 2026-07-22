import crypto from "node:crypto";

export const PHASE6_RAG_GATE_TRACE_VERSION = "phase6_server_rag_trace.v2";
export const PHASE6_RAG_GATE_TRACE_LEGACY_VERSION = "phase6_server_rag_trace.v1";
export const PHASE6_RAG_GATE_EVALUATION_VERSION = "phase6_server_rag_evaluation.v1";

const TRACE_AUTHORITY = "server_retriever_observed";
const EVALUATION_AUTHORITY = "server_ground_truth_comparison";
const HASH_PATTERN = /^sha256:[a-f0-9]{64}$/;

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function canonicalJson(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (isRecord(value)) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  if (typeof value === "number" && !Number.isFinite(value)) throw new Error("non_finite_number");
  return JSON.stringify(value);
}

export function phase6RagCanonicalHash(value) {
  return `sha256:${crypto.createHash("sha256").update(canonicalJson(value), "utf8").digest("hex")}`;
}

function uniqueSorted(values) {
  return [...new Set(values.map((value) => value.trim()).filter(isNonEmptyString))]
    .sort((left, right) => left.localeCompare(right));
}

function normalizedExpected(entries, idKey) {
  const byId = new Map();
  for (const entry of entries) {
    if (!isRecord(entry) || !isNonEmptyString(entry[idKey]) || !Array.isArray(entry.sourceEventIds)) continue;
    const id = entry[idKey].trim();
    byId.set(id, { [idKey]: id, sourceEventIds: uniqueSorted(entry.sourceEventIds) });
  }
  return [...byId.values()].sort((left, right) => left[idKey].localeCompare(right[idKey]));
}

function expectedEvaluationFromCollections(evaluation) {
  const expectedRecentKeyFacts = normalizedExpected(evaluation.expectedRecentKeyFacts, "factId");
  const retrievedFactIds = uniqueSorted(evaluation.retrievedFactIds);
  const expectedRouteEvidence = normalizedExpected(evaluation.expectedRouteEvidence, "evidenceId");
  const returnedRouteEvidence = normalizedExpected(evaluation.returnedRouteEvidence, "evidenceId");
  const expectedFactIds = new Set(expectedRecentKeyFacts.map((entry) => entry.factId));
  const expectedRouteIds = new Set(expectedRouteEvidence.map((entry) => entry.evidenceId));
  const recalledFactIds = retrievedFactIds.filter((factId) => expectedFactIds.has(factId));
  const correctEvidenceIds = returnedRouteEvidence
    .map((entry) => entry.evidenceId)
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

function traceFromRecord(record) {
  if (isRecord(record?.trace)) return record.trace;
  if (isRecord(record?.phase6RagTrace)) return record.phase6RagTrace;
  return record;
}

function validateBinding(trace, errors) {
  const binding = trace.binding;
  if (!isRecord(binding)
    || !isRecord(binding.experiment)
    || !isNonEmptyString(binding.experiment.experimentId)
    || !Number.isInteger(binding.experiment.runIndex)
    || binding.experiment.runIndex < 1
    || !isRecord(binding.run)
    || !isNonEmptyString(binding.run.runId)
    || !isNonEmptyString(binding.run.journeyId)) {
    errors.push("phase6_rag_evaluation_binding_missing");
    return undefined;
  }
  return {
    experimentId: binding.experiment.experimentId,
    runIndex: binding.experiment.runIndex,
    runId: binding.run.runId,
    journeyId: binding.run.journeyId,
  };
}

function validateTraceIntegrity(trace, errors) {
  if (!isRecord(trace.integrity) || !HASH_PATTERN.test(trace.integrity.traceHash || "")) {
    errors.push("phase6_rag_trace_hash_missing");
    return;
  }
  const { integrity, ...body } = trace;
  if (phase6RagCanonicalHash(body) !== integrity.traceHash) errors.push("phase6_rag_trace_hash_mismatch");
  if (trace.query !== undefined) {
    if (!HASH_PATTERN.test(trace.queryHash || "") || phase6RagCanonicalHash(trace.query) !== trace.queryHash) {
      errors.push("phase6_rag_query_hash_mismatch");
    }
  }
  for (const [field, value] of [
    ["retrievedHash", trace.retrieved],
    ["usedHash", { chunkIds: trace.usedChunkIds, documentIds: trace.usedDocumentIds }],
    ["groundingHash", trace.groundingHits],
    ["bindingHash", trace.binding],
    ["sourceEventIdsHash", trace.sourceEventIds],
  ]) {
    if (!HASH_PATTERN.test(integrity[field] || "") || phase6RagCanonicalHash(value) !== integrity[field]) {
      errors.push(`phase6_rag_${field}_mismatch`);
    }
  }
}

export function inspectPhase6RagGateEvidence(record) {
  const trace = traceFromRecord(record);
  const errors = [];
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
      || trace.retrieved.length !== 0
      || trace.evaluation !== undefined) {
      errors.push("phase6_rag_legitimate_no_retrieval_invalid");
    }
    return {
      classification: errors.length === 0 ? "legitimate_no_retrieval" : "invalid",
      errors,
      binding,
      traceHash: trace.integrity?.traceHash,
    };
  }

  if (trace.version !== PHASE6_RAG_GATE_TRACE_VERSION || trace.status !== "ok") {
    errors.push("phase6_rag_evaluation_v2_required");
  }
  if (!isNonEmptyString(trace.query) || !HASH_PATTERN.test(trace.queryHash || "")) {
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
    return { classification: "invalid", errors, binding, traceHash: trace.integrity?.traceHash };
  }
  if (evaluation.expectedRecentKeyFacts.length === 0
    || evaluation.expectedRouteEvidence.length === 0
    || evaluation.returnedRouteEvidence.length === 0) {
    errors.push("phase6_rag_evaluation_sample_insufficient");
  }
  const sourceEvents = new Set(trace.sourceEventIds || []);
  for (const entry of [...evaluation.expectedRecentKeyFacts, ...evaluation.expectedRouteEvidence]) {
    if (!isRecord(entry) || !Array.isArray(entry.sourceEventIds) || entry.sourceEventIds.length === 0
      || entry.sourceEventIds.some((eventId) => !sourceEvents.has(eventId))) {
      errors.push("phase6_rag_evaluation_ground_truth_unbound");
      break;
    }
  }
  const expected = expectedEvaluationFromCollections(evaluation);
  if (phase6RagCanonicalHash(evaluation) !== phase6RagCanonicalHash(expected)) {
    errors.push("phase6_rag_evaluation_integrity_mismatch");
  }
  if (trace.integrity?.evaluationHash !== expected.integrity.evaluationHash) {
    errors.push("phase6_rag_trace_evaluation_hash_mismatch");
  }
  return {
    classification: errors.length === 0 ? "evaluated" : "invalid",
    errors,
    binding,
    traceHash: trace.integrity?.traceHash,
    recall: {
      numerator: expected.metrics.recentKeyFactRecall.recalledCount,
      denominator: expected.metrics.recentKeyFactRecall.expectedCount,
    },
    precision: {
      numerator: expected.metrics.routeSummaryPrecision.correctCount,
      denominator: expected.metrics.routeSummaryPrecision.returnedCount,
    },
  };
}
