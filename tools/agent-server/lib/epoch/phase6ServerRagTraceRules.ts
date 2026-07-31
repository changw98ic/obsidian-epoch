import {
  causalCanonicalJsonHash,
  type CausalCanonicalJsonValue,
} from "./causalCanonicalJson.ts";
import type {
  JourneyRunRagGrounding,
  JourneyRunReceiptHash,
} from "./journeyRunReceiptRules.ts";

export const PHASE6_SERVER_RAG_TRACE_VERSION = "phase6_server_rag_trace.v2" as const;
export const PHASE6_SERVER_RAG_TRACE_AUTHORITY = "server_retriever_observed" as const;
export const PHASE6_SERVER_RAG_EVALUATION_VERSION = "phase6_server_rag_evaluation.v1" as const;
export const PHASE6_SERVER_RAG_EVALUATION_AUTHORITY = "server_ground_truth_comparison" as const;

export type Phase6ServerRagTraceVersion = typeof PHASE6_SERVER_RAG_TRACE_VERSION;

export type Phase6ServerRagTraceStatus =
  | "ok"
  | "legitimate_no_retrieval"
  | "source_missing"
  | "invalid";

export type Phase6ServerRagSource =
  | "world_knowledge"
  | "world_memory"
  | "context_snapshot"
  | "journey_context"
  | "other_server_retriever";

export interface Phase6ServerRagBinding {
  readonly world: {
    readonly worldId: string;
    readonly regionId?: string;
    readonly worldTime?: string;
    readonly simulationVersion?: number;
  };
  readonly identity: {
    readonly agentId: string;
    readonly explorerId: string;
    readonly requestedAgentId?: string;
    readonly resolvedAgentId?: string;
  };
  readonly experiment: {
    readonly experimentId: string;
    readonly runIndex: number;
    readonly seed?: string;
  };
  readonly run: {
    readonly runId: string;
    readonly journeyId: string;
    readonly receiptId?: string;
  };
}

export interface Phase6ServerRagRetrievalConfig {
  readonly retrieverName: string;
  readonly retrieverVersion: string;
  readonly corpusVersion: string;
  readonly embeddingVersion?: string;
  readonly rankingVersion?: string;
  readonly retrievalMode?: "lexical" | "semantic" | "hybrid" | "direct";
  readonly limit?: number;
  readonly filters?: CausalCanonicalJsonValue;
}

export interface Phase6ServerObservedRetrievedChunk {
  readonly chunkId: string;
  readonly documentId: string;
  readonly sourceId: string;
  readonly sourceHash: JourneyRunReceiptHash;
  readonly rank: number;
  readonly score?: number;
  readonly relevance?: number;
  readonly quoteHash?: JourneyRunReceiptHash;
  readonly metadata?: CausalCanonicalJsonValue;
}

export interface Phase6ServerObservedGroundingHit {
  readonly hitId: string;
  readonly chunkId: string;
  readonly documentId: string;
  readonly sourceId: string;
  readonly claimId?: string;
  readonly citationId?: string;
  readonly quoteHash?: JourneyRunReceiptHash;
  readonly eventIds: readonly string[];
}

export interface Phase6ServerRecentKeyFact {
  readonly factId: string;
  readonly sourceEventIds: readonly string[];
}

export interface Phase6ServerRouteEvidence {
  readonly evidenceId: string;
  readonly sourceEventIds: readonly string[];
}

export interface CapturePhase6ServerRagEvaluationInput {
  readonly expectedRecentKeyFacts: readonly Phase6ServerRecentKeyFact[];
  readonly retrievedFactIds: readonly string[];
  readonly expectedRouteEvidence: readonly Phase6ServerRouteEvidence[];
  readonly returnedRouteEvidence: readonly Phase6ServerRouteEvidence[];
}

export interface Phase6ServerRagEvaluation {
  readonly evaluationType: "phase6_server_rag_evaluation";
  readonly version: typeof PHASE6_SERVER_RAG_EVALUATION_VERSION;
  readonly authority: typeof PHASE6_SERVER_RAG_EVALUATION_AUTHORITY;
  readonly expectedRecentKeyFacts: readonly Phase6ServerRecentKeyFact[];
  readonly retrievedFactIds: readonly string[];
  readonly expectedRouteEvidence: readonly Phase6ServerRouteEvidence[];
  readonly returnedRouteEvidence: readonly Phase6ServerRouteEvidence[];
  readonly metrics: {
    readonly recentKeyFactRecall: {
      readonly recalledFactIds: readonly string[];
      readonly recalledCount: number;
      readonly expectedCount: number;
      readonly value: number;
    };
    readonly routeSummaryPrecision: {
      readonly correctEvidenceIds: readonly string[];
      readonly correctCount: number;
      readonly returnedCount: number;
      readonly value: number;
    };
  };
  readonly integrity: {
    readonly expectedRecentKeyFactsHash: JourneyRunReceiptHash;
    readonly retrievedFactIdsHash: JourneyRunReceiptHash;
    readonly expectedRouteEvidenceHash: JourneyRunReceiptHash;
    readonly returnedRouteEvidenceHash: JourneyRunReceiptHash;
    readonly metricsHash: JourneyRunReceiptHash;
    readonly evaluationHash: JourneyRunReceiptHash;
  };
}

export interface CapturePhase6ServerRagTraceInput {
  readonly binding: Phase6ServerRagBinding;
  readonly query?: string;
  readonly source: Phase6ServerRagSource;
  readonly retrievalConfig?: Phase6ServerRagRetrievalConfig;
  readonly retrievedChunks?: readonly Phase6ServerObservedRetrievedChunk[];
  readonly serverObservedUsedChunkIds?: readonly string[];
  readonly serverObservedGroundingHits?: readonly Phase6ServerObservedGroundingHit[];
  readonly retrievalExpected: boolean;
  readonly noRetrievalReason?: "not_needed" | "policy_skipped" | "empty_query" | "upstream_disabled";
  readonly recordedAt: string;
  readonly sourceEventIds: readonly string[];
  readonly sourceMissingReason?: string;
  readonly serverEvaluation?: CapturePhase6ServerRagEvaluationInput;
}

export interface Phase6ServerRagTrace {
  readonly traceType: "phase6_server_rag_trace";
  readonly version: Phase6ServerRagTraceVersion;
  readonly authority: typeof PHASE6_SERVER_RAG_TRACE_AUTHORITY;
  readonly status: Phase6ServerRagTraceStatus;
  readonly query?: string;
  readonly queryHash?: JourneyRunReceiptHash;
  readonly source: Phase6ServerRagSource;
  readonly retrievalConfig?: Phase6ServerRagRetrievalConfig;
  readonly retrieved: readonly Phase6ServerObservedRetrievedChunk[];
  readonly usedChunkIds: readonly string[];
  readonly usedDocumentIds: readonly string[];
  readonly groundingHits: readonly Phase6ServerObservedGroundingHit[];
  readonly groundingHitRate?: number;
  readonly binding: Phase6ServerRagBinding;
  readonly recordedAt: string;
  readonly sourceEventIds: readonly string[];
  readonly evaluation?: Phase6ServerRagEvaluation;
  readonly noRetrievalReason?: CapturePhase6ServerRagTraceInput["noRetrievalReason"];
  readonly sourceMissingReason?: string;
  readonly integrity: {
    readonly queryHash?: JourneyRunReceiptHash;
    readonly retrievedHash: JourneyRunReceiptHash;
    readonly usedHash: JourneyRunReceiptHash;
    readonly groundingHash: JourneyRunReceiptHash;
    readonly configHash?: JourneyRunReceiptHash;
    readonly bindingHash: JourneyRunReceiptHash;
    readonly sourceEventIdsHash: JourneyRunReceiptHash;
    readonly evaluationHash?: JourneyRunReceiptHash;
    readonly traceHash: JourneyRunReceiptHash;
  };
}

export interface Phase6ServerRagTraceValidationIssue {
  readonly code: string;
  readonly path: string;
  readonly message: string;
}

export interface Phase6ServerRagTraceValidationResult {
  readonly ok: boolean;
  readonly status: Phase6ServerRagTraceStatus;
  readonly issues: readonly Phase6ServerRagTraceValidationIssue[];
}

export interface Phase6ReceiptRagEvidence {
  readonly grounding: JourneyRunRagGrounding;
  readonly trace: Phase6ServerRagTrace;
  readonly validation: Phase6ServerRagTraceValidationResult;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isSha256(value: unknown): value is JourneyRunReceiptHash {
  return typeof value === "string" && /^sha256:[a-f0-9]{64}$/.test(value);
}

function unique(values: readonly string[]): readonly string[] {
  return [...new Set(values.map((value) => value.trim()).filter(isNonEmptyString))];
}

function uniqueSorted(values: readonly string[]): readonly string[] {
  return [...unique(values)].sort((left, right) => left.localeCompare(right));
}

function issue(code: string, path: string, message: string): Phase6ServerRagTraceValidationIssue {
  return { code, path, message };
}

function sortedChunks(
  chunks: readonly Phase6ServerObservedRetrievedChunk[],
): readonly Phase6ServerObservedRetrievedChunk[] {
  return [...chunks]
    .map((chunk) => ({
      ...chunk,
      chunkId: chunk.chunkId.trim(),
      documentId: chunk.documentId.trim(),
      sourceId: chunk.sourceId.trim(),
    }))
    .sort((left, right) => left.rank - right.rank || left.chunkId.localeCompare(right.chunkId));
}

function sortedGroundingHits(
  hits: readonly Phase6ServerObservedGroundingHit[],
): readonly Phase6ServerObservedGroundingHit[] {
  return [...hits]
    .map((hit) => ({
      ...hit,
      hitId: hit.hitId.trim(),
      chunkId: hit.chunkId.trim(),
      documentId: hit.documentId.trim(),
      sourceId: hit.sourceId.trim(),
      eventIds: unique(hit.eventIds),
    }))
    .sort((left, right) => left.hitId.localeCompare(right.hitId));
}

function sortedRecentKeyFacts(
  facts: readonly Phase6ServerRecentKeyFact[],
): readonly Phase6ServerRecentKeyFact[] {
  const byId = new Map<string, Phase6ServerRecentKeyFact>();
  for (const fact of facts) {
    const factId = fact.factId.trim();
    if (!factId) continue;
    byId.set(factId, { factId, sourceEventIds: uniqueSorted(fact.sourceEventIds) });
  }
  return [...byId.values()].sort((left, right) => left.factId.localeCompare(right.factId));
}

function sortedRouteEvidence(
  entries: readonly Phase6ServerRouteEvidence[],
): readonly Phase6ServerRouteEvidence[] {
  const byId = new Map<string, Phase6ServerRouteEvidence>();
  for (const entry of entries) {
    const evidenceId = entry.evidenceId.trim();
    if (!evidenceId) continue;
    byId.set(evidenceId, { evidenceId, sourceEventIds: uniqueSorted(entry.sourceEventIds) });
  }
  return [...byId.values()].sort((left, right) => left.evidenceId.localeCompare(right.evidenceId));
}

type Phase6ServerRagEvaluationBody = Omit<Phase6ServerRagEvaluation, "integrity">;

function evaluationIntegrity(body: Phase6ServerRagEvaluationBody): Phase6ServerRagEvaluation["integrity"] {
  return {
    expectedRecentKeyFactsHash: causalCanonicalJsonHash(body.expectedRecentKeyFacts),
    retrievedFactIdsHash: causalCanonicalJsonHash(body.retrievedFactIds),
    expectedRouteEvidenceHash: causalCanonicalJsonHash(body.expectedRouteEvidence),
    returnedRouteEvidenceHash: causalCanonicalJsonHash(body.returnedRouteEvidence),
    metricsHash: causalCanonicalJsonHash(body.metrics),
    evaluationHash: causalCanonicalJsonHash(body),
  };
}

export function buildPhase6ServerRagEvaluation(
  input: CapturePhase6ServerRagEvaluationInput,
): Phase6ServerRagEvaluation {
  const expectedRecentKeyFacts = sortedRecentKeyFacts(input.expectedRecentKeyFacts);
  const retrievedFactIds = uniqueSorted(input.retrievedFactIds);
  const expectedRouteEvidence = sortedRouteEvidence(input.expectedRouteEvidence);
  const returnedRouteEvidence = sortedRouteEvidence(input.returnedRouteEvidence);
  const expectedFactIds = new Set(expectedRecentKeyFacts.map((fact) => fact.factId));
  const expectedRouteIds = new Set(expectedRouteEvidence.map((entry) => entry.evidenceId));
  const recalledFactIds = retrievedFactIds.filter((factId) => expectedFactIds.has(factId));
  const correctEvidenceIds = returnedRouteEvidence
    .map((entry) => entry.evidenceId)
    .filter((evidenceId) => expectedRouteIds.has(evidenceId));
  const body: Phase6ServerRagEvaluationBody = {
    evaluationType: "phase6_server_rag_evaluation",
    version: PHASE6_SERVER_RAG_EVALUATION_VERSION,
    authority: PHASE6_SERVER_RAG_EVALUATION_AUTHORITY,
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
  return { ...body, integrity: evaluationIntegrity(body) };
}

function traceBody(trace: Omit<Phase6ServerRagTrace, "integrity">) {
  return {
    traceType: trace.traceType,
    version: trace.version,
    authority: trace.authority,
    status: trace.status,
    ...(trace.query ? { query: trace.query } : {}),
    ...(trace.queryHash ? { queryHash: trace.queryHash } : {}),
    source: trace.source,
    ...(trace.retrievalConfig ? { retrievalConfig: trace.retrievalConfig } : {}),
    retrieved: trace.retrieved,
    usedChunkIds: trace.usedChunkIds,
    usedDocumentIds: trace.usedDocumentIds,
    groundingHits: trace.groundingHits,
    ...(typeof trace.groundingHitRate === "number" ? { groundingHitRate: trace.groundingHitRate } : {}),
    binding: trace.binding,
    recordedAt: trace.recordedAt,
    sourceEventIds: trace.sourceEventIds,
    ...(trace.evaluation ? { evaluation: trace.evaluation } : {}),
    ...(trace.noRetrievalReason ? { noRetrievalReason: trace.noRetrievalReason } : {}),
    ...(trace.sourceMissingReason ? { sourceMissingReason: trace.sourceMissingReason } : {}),
  } satisfies Omit<Phase6ServerRagTrace, "integrity">;
}

function traceIntegrity(body: Omit<Phase6ServerRagTrace, "integrity">): Phase6ServerRagTrace["integrity"] {
  const traceHash = causalCanonicalJsonHash(traceBody(body));
  return {
    ...(body.queryHash ? { queryHash: body.queryHash } : {}),
    retrievedHash: causalCanonicalJsonHash(body.retrieved),
    usedHash: causalCanonicalJsonHash({
      chunkIds: body.usedChunkIds,
      documentIds: body.usedDocumentIds,
    }),
    groundingHash: causalCanonicalJsonHash(body.groundingHits),
    ...(body.retrievalConfig ? { configHash: causalCanonicalJsonHash(body.retrievalConfig) } : {}),
    bindingHash: causalCanonicalJsonHash(body.binding),
    sourceEventIdsHash: causalCanonicalJsonHash(body.sourceEventIds),
    ...(body.evaluation ? { evaluationHash: body.evaluation.integrity.evaluationHash } : {}),
    traceHash,
  };
}

function statusFor(input: CapturePhase6ServerRagTraceInput): Phase6ServerRagTraceStatus {
  const retrieved = input.retrievedChunks ?? [];
  if (!input.retrievalExpected && retrieved.length === 0) return "legitimate_no_retrieval";
  if (input.retrievalExpected && (!input.retrievalConfig || retrieved.length === 0)) return "source_missing";
  return "ok";
}

export function capturePhase6ServerRagTrace(input: CapturePhase6ServerRagTraceInput): Phase6ServerRagTrace {
  const query = input.query?.trim();
  const retrieved = sortedChunks(input.retrievedChunks ?? []);
  const hits = sortedGroundingHits(input.serverObservedGroundingHits ?? []);
  const usedChunkIds = unique(input.serverObservedUsedChunkIds ?? hits.map((hit) => hit.chunkId));
  const retrievedByChunk = new Map(retrieved.map((chunk) => [chunk.chunkId, chunk]));
  const usedDocumentIds = unique(usedChunkIds.map((chunkId) => retrievedByChunk.get(chunkId)?.documentId ?? ""));
  const evaluation = input.serverEvaluation
    ? buildPhase6ServerRagEvaluation(input.serverEvaluation)
    : undefined;
  const body = traceBody({
    traceType: "phase6_server_rag_trace",
    version: PHASE6_SERVER_RAG_TRACE_VERSION,
    authority: PHASE6_SERVER_RAG_TRACE_AUTHORITY,
    status: statusFor(input),
    ...(query ? { query, queryHash: causalCanonicalJsonHash(query) } : {}),
    source: input.source,
    ...(input.retrievalConfig ? { retrievalConfig: input.retrievalConfig } : {}),
    retrieved,
    usedChunkIds,
    usedDocumentIds,
    groundingHits: hits,
    ...(retrieved.length > 0 && hits.length > 0 ? { groundingHitRate: hits.length / retrieved.length } : {}),
    binding: input.binding,
    recordedAt: input.recordedAt,
    sourceEventIds: unique(input.sourceEventIds),
    ...(evaluation ? { evaluation } : {}),
    ...(!input.retrievalExpected && input.noRetrievalReason ? { noRetrievalReason: input.noRetrievalReason } : {}),
    ...(input.sourceMissingReason ? { sourceMissingReason: input.sourceMissingReason } : {}),
  });
  return {
    ...body,
    integrity: traceIntegrity(body),
  };
}

export function normalizePhase6ServerRagTrace(trace: Phase6ServerRagTrace): Phase6ServerRagTrace {
  return capturePhase6ServerRagTrace({
    binding: trace.binding,
    query: trace.query,
    source: trace.source,
    retrievalConfig: trace.retrievalConfig,
    retrievedChunks: trace.retrieved,
    serverObservedUsedChunkIds: trace.usedChunkIds,
    serverObservedGroundingHits: trace.groundingHits,
    retrievalExpected: trace.status !== "legitimate_no_retrieval",
    noRetrievalReason: trace.noRetrievalReason,
    recordedAt: trace.recordedAt,
    sourceEventIds: trace.sourceEventIds,
    sourceMissingReason: trace.sourceMissingReason,
    ...(trace.evaluation ? {
      serverEvaluation: {
        expectedRecentKeyFacts: trace.evaluation.expectedRecentKeyFacts,
        retrievedFactIds: trace.evaluation.retrievedFactIds,
        expectedRouteEvidence: trace.evaluation.expectedRouteEvidence,
        returnedRouteEvidence: trace.evaluation.returnedRouteEvidence,
      },
    } : {}),
  });
}

export function validatePhase6ServerRagTrace(trace: Phase6ServerRagTrace): Phase6ServerRagTraceValidationResult {
  const issues: Phase6ServerRagTraceValidationIssue[] = [];
  if (trace.traceType !== "phase6_server_rag_trace") {
    issues.push(issue("phase6_rag_trace_type_invalid", "$.traceType", "Trace type must identify Phase 6 server RAG evidence."));
  }
  if (trace.version !== PHASE6_SERVER_RAG_TRACE_VERSION) {
    issues.push(issue("phase6_rag_trace_version_invalid", "$.version", "Unsupported Phase 6 server RAG trace version."));
  }
  if (trace.status === "ok" && !trace.evaluation) {
    issues.push(issue("phase6_rag_trace_evaluation_required", "$.evaluation", "Version 2 traces require server-computed RAG evaluation evidence."));
  }
  if (trace.evaluation && trace.status !== "ok") {
    issues.push(issue("phase6_rag_trace_evaluation_status_invalid", "$.status", "Evaluated traces must represent an observed retrieval."));
  }
  if (trace.authority !== PHASE6_SERVER_RAG_TRACE_AUTHORITY) {
    issues.push(issue("phase6_rag_trace_authority_invalid", "$.authority", "Trace authority must be server retriever observation."));
  }
  if (trace.queryHash && (!trace.query || causalCanonicalJsonHash(trace.query) !== trace.queryHash)) {
    issues.push(issue("phase6_rag_trace_query_hash_mismatch", "$.queryHash", "Query hash must match the recorded query."));
  }
  if (trace.status === "ok" && (!trace.queryHash || !trace.retrievalConfig || trace.retrieved.length === 0)) {
    issues.push(issue("phase6_rag_trace_source_missing", "$", "Successful RAG evidence requires query, retrieval config and retrieved chunks."));
  }
  if (trace.status === "legitimate_no_retrieval" && (!trace.noRetrievalReason || trace.retrieved.length > 0)) {
    issues.push(issue("phase6_rag_trace_no_retrieval_invalid", "$.noRetrievalReason", "Legitimate no-retrieval must state why retrieval was not needed and contain no chunks."));
  }
  if (trace.status === "source_missing" && !trace.sourceMissingReason) {
    issues.push(issue("phase6_rag_trace_source_missing_reason_required", "$.sourceMissingReason", "Missing retrieval source must be structured, not silently treated as a zero-hit retrieval."));
  }
  if (!isNonEmptyString(trace.binding.world.worldId)) {
    issues.push(issue("phase6_rag_trace_world_missing", "$.binding.world.worldId", "Trace must bind to a world id."));
  }
  for (const field of ["agentId", "explorerId"] as const) {
    if (!isNonEmptyString(trace.binding.identity[field])) {
      issues.push(issue("phase6_rag_trace_identity_missing", `$.binding.identity.${field}`, "Trace must bind to identity."));
    }
  }
  if (!isNonEmptyString(trace.binding.experiment.experimentId) || !Number.isInteger(trace.binding.experiment.runIndex)) {
    issues.push(issue("phase6_rag_trace_experiment_missing", "$.binding.experiment", "Trace must bind to experiment id and run index."));
  }
  for (const field of ["runId", "journeyId"] as const) {
    if (!isNonEmptyString(trace.binding.run[field])) {
      issues.push(issue("phase6_rag_trace_run_missing", `$.binding.run.${field}`, "Trace must bind to journey run."));
    }
  }
  if (!isNonEmptyString(trace.recordedAt) || !Number.isFinite(Date.parse(trace.recordedAt))) {
    issues.push(issue("phase6_rag_trace_recorded_at_invalid", "$.recordedAt", "Trace recordedAt must be an ISO-compatible timestamp."));
  }
  if (!Array.isArray(trace.sourceEventIds) || trace.sourceEventIds.some((eventId) => !isNonEmptyString(eventId))) {
    issues.push(issue("phase6_rag_trace_source_events_invalid", "$.sourceEventIds", "Trace must carry server source event ids."));
  }
  const chunkIds = new Set<string>();
  trace.retrieved.forEach((chunk, index) => {
    const path = `$.retrieved[${index}]`;
    if (!isNonEmptyString(chunk.chunkId)) issues.push(issue("phase6_rag_trace_chunk_id_missing", `${path}.chunkId`, "Retrieved chunk id is required."));
    if (!isNonEmptyString(chunk.documentId)) issues.push(issue("phase6_rag_trace_document_id_missing", `${path}.documentId`, "Retrieved document id is required."));
    if (!isNonEmptyString(chunk.sourceId)) issues.push(issue("phase6_rag_trace_source_id_missing", `${path}.sourceId`, "Retrieved source id is required."));
    if (!isSha256(chunk.sourceHash)) issues.push(issue("phase6_rag_trace_source_hash_invalid", `${path}.sourceHash`, "Source hash must be sha256."));
    if (!Number.isInteger(chunk.rank) || chunk.rank < 1) issues.push(issue("phase6_rag_trace_rank_invalid", `${path}.rank`, "Rank must be a positive integer."));
    if (chunk.score !== undefined && (!Number.isFinite(chunk.score) || chunk.score < 0)) issues.push(issue("phase6_rag_trace_score_invalid", `${path}.score`, "Score must be a non-negative finite number."));
    if (chunk.relevance !== undefined && (!Number.isFinite(chunk.relevance) || chunk.relevance < 0 || chunk.relevance > 1)) issues.push(issue("phase6_rag_trace_relevance_invalid", `${path}.relevance`, "Relevance must be between 0 and 1."));
    if (chunk.quoteHash !== undefined && !isSha256(chunk.quoteHash)) issues.push(issue("phase6_rag_trace_quote_hash_invalid", `${path}.quoteHash`, "Quote hash must be sha256."));
    chunkIds.add(chunk.chunkId);
  });
  for (const chunkId of trace.usedChunkIds) {
    if (!chunkIds.has(chunkId)) {
      issues.push(issue("phase6_rag_trace_used_chunk_not_retrieved", "$.usedChunkIds", "Used ids must come from server-recorded retrieved chunks."));
    }
  }
  trace.groundingHits.forEach((hit, index) => {
    const path = `$.groundingHits[${index}]`;
    if (!chunkIds.has(hit.chunkId)) issues.push(issue("phase6_rag_trace_grounding_not_retrieved", `${path}.chunkId`, "Grounding hits must reference retrieved chunks."));
    if (!isNonEmptyString(hit.hitId)) issues.push(issue("phase6_rag_trace_grounding_hit_id_missing", `${path}.hitId`, "Grounding hit id is required."));
    if (!Array.isArray(hit.eventIds) || hit.eventIds.some((eventId) => !isNonEmptyString(eventId))) issues.push(issue("phase6_rag_trace_grounding_events_invalid", `${path}.eventIds`, "Grounding hits must carry server event ids."));
  });
  if (trace.evaluation) {
    const evaluation = trace.evaluation;
    if (evaluation.evaluationType !== "phase6_server_rag_evaluation") {
      issues.push(issue("phase6_rag_evaluation_type_invalid", "$.evaluation.evaluationType", "Evaluation type must identify server RAG quality evidence."));
    }
    if (evaluation.version !== PHASE6_SERVER_RAG_EVALUATION_VERSION) {
      issues.push(issue("phase6_rag_evaluation_version_invalid", "$.evaluation.version", "Unsupported server RAG evaluation version."));
    }
    if (evaluation.authority !== PHASE6_SERVER_RAG_EVALUATION_AUTHORITY) {
      issues.push(issue("phase6_rag_evaluation_authority_invalid", "$.evaluation.authority", "Evaluation must be computed against server-owned ground truth."));
    }
    const arrays = [
      evaluation.expectedRecentKeyFacts,
      evaluation.retrievedFactIds,
      evaluation.expectedRouteEvidence,
      evaluation.returnedRouteEvidence,
    ];
    if (arrays.some((value) => !Array.isArray(value))) {
      issues.push(issue("phase6_rag_evaluation_fields_missing", "$.evaluation", "All authoritative evaluation collections are required."));
    } else {
      if (evaluation.expectedRecentKeyFacts.length === 0) {
        issues.push(issue("phase6_rag_evaluation_expected_facts_empty", "$.evaluation.expectedRecentKeyFacts", "Evaluated retrievals require recent key-fact ground truth."));
      }
      if (evaluation.expectedRouteEvidence.length === 0 || evaluation.returnedRouteEvidence.length === 0) {
        issues.push(issue("phase6_rag_evaluation_route_sample_empty", "$.evaluation", "Evaluated retrievals require expected and returned route evidence samples."));
      }
      const traceSourceEvents = new Set(trace.sourceEventIds);
      [...evaluation.expectedRecentKeyFacts, ...evaluation.expectedRouteEvidence].forEach((entry, index) => {
        const id = "factId" in entry ? entry.factId : entry.evidenceId;
        if (!isNonEmptyString(id) || !Array.isArray(entry.sourceEventIds) || entry.sourceEventIds.length === 0) {
          issues.push(issue("phase6_rag_evaluation_ground_truth_invalid", `$.evaluation.groundTruth[${index}]`, "Expected evidence requires an id and server source events."));
        } else if (entry.sourceEventIds.some((eventId) => !traceSourceEvents.has(eventId))) {
          issues.push(issue("phase6_rag_evaluation_ground_truth_unbound", `$.evaluation.groundTruth[${index}].sourceEventIds`, "Expected evidence must bind to trace source events."));
        }
      });
      if (evaluation.retrievedFactIds.some((factId) => !isNonEmptyString(factId))) {
        issues.push(issue("phase6_rag_evaluation_retrieved_fact_invalid", "$.evaluation.retrievedFactIds", "Retrieved fact ids must be non-empty strings."));
      }
      if (evaluation.returnedRouteEvidence.some((entry) => !isNonEmptyString(entry.evidenceId))) {
        issues.push(issue("phase6_rag_evaluation_returned_route_invalid", "$.evaluation.returnedRouteEvidence", "Returned route evidence ids must be non-empty strings."));
      }
      const expectedEvaluation = buildPhase6ServerRagEvaluation({
        expectedRecentKeyFacts: evaluation.expectedRecentKeyFacts,
        retrievedFactIds: evaluation.retrievedFactIds,
        expectedRouteEvidence: evaluation.expectedRouteEvidence,
        returnedRouteEvidence: evaluation.returnedRouteEvidence,
      });
      if (causalCanonicalJsonHash(evaluation) !== causalCanonicalJsonHash(expectedEvaluation)) {
        issues.push(issue("phase6_rag_evaluation_integrity_mismatch", "$.evaluation.integrity.evaluationHash", "Evaluation metrics and hashes must be recomputed from the four authoritative evidence collections."));
      }
      if (trace.integrity.evaluationHash !== expectedEvaluation.integrity.evaluationHash) {
        issues.push(issue("phase6_rag_trace_evaluation_hash_mismatch", "$.integrity.evaluationHash", "Trace integrity must bind the server RAG evaluation."));
      }
    }
  }
  const expectedIntegrity = traceIntegrity(traceBody(trace));
  if (trace.integrity.traceHash !== expectedIntegrity.traceHash) {
    issues.push(issue("phase6_rag_trace_integrity_mismatch", "$.integrity.traceHash", "Trace integrity hash does not match canonical trace body."));
  }
  return {
    ok: issues.length === 0 && trace.status !== "source_missing" && trace.status !== "invalid",
    status: issues.length === 0 ? trace.status : "invalid",
    issues,
  };
}

export function buildReceiptRagEvidence(trace: Phase6ServerRagTrace): Phase6ReceiptRagEvidence {
  const normalized = normalizePhase6ServerRagTrace(trace);
  const validation = validatePhase6ServerRagTrace(normalized);
  const retrievedByChunk = new Map(normalized.retrieved.map((chunk) => [chunk.chunkId, chunk]));
  const claims = normalized.usedChunkIds
    .map((chunkId) => retrievedByChunk.get(chunkId))
    .filter((chunk): chunk is Phase6ServerObservedRetrievedChunk => Boolean(chunk))
    .map((chunk) => ({
      claimId: chunk.chunkId,
      sourceId: chunk.sourceId,
      sourceHash: chunk.sourceHash,
      ...(chunk.quoteHash ? { quoteHash: chunk.quoteHash } : {}),
      relevance: chunk.relevance ?? Math.max(0, Math.min(1, chunk.score ?? 0)),
    }));
  return {
    grounding: {
      queryHash: normalized.queryHash ?? causalCanonicalJsonHash({
        status: normalized.status,
        source: normalized.source,
        reason: normalized.noRetrievalReason ?? normalized.sourceMissingReason ?? "query_missing",
      }),
      corpusHash: causalCanonicalJsonHash({
        source: normalized.source,
        config: normalized.retrievalConfig,
        retrieved: normalized.retrieved.map((chunk) => ({
          chunkId: chunk.chunkId,
          documentId: chunk.documentId,
          sourceId: chunk.sourceId,
          sourceHash: chunk.sourceHash,
        })),
      }),
      claims,
      // Retrieval evidence has no authority to add a persistent memory on its
      // own. Pre-settlement replaces this safe zero-delta projection with the
      // canonical-event-derived result for the completed run.
      importantMemoryCount: 0,
      ordinaryNodePersistenceExpansion: 0,
      delta: { entries: [] },
      noChangeReason: "no_supported_projection_fields",
    },
    trace: normalized,
    validation,
  };
}
