import { phase6RagCanonicalHash } from "../lib/epoch/phase6RagGateEvidence.ts";

function evidenceEntries(prefix, count, eventPrefix) {
  return Array.from({ length: count }, (_, index) => ({
    [`${prefix === "fact" ? "fact" : "evidence"}Id`]: `${prefix}-${index + 1}`,
    sourceEventIds: [`${eventPrefix}-${index + 1}`],
  })).sort((left, right) => {
    const idKey = prefix === "fact" ? "factId" : "evidenceId";
    return left[idKey].localeCompare(right[idKey]);
  });
}

function evaluationIntegrity(body) {
  return {
    expectedRecentKeyFactsHash: phase6RagCanonicalHash(body.expectedRecentKeyFacts),
    retrievedFactIdsHash: phase6RagCanonicalHash(body.retrievedFactIds),
    expectedRouteEvidenceHash: phase6RagCanonicalHash(body.expectedRouteEvidence),
    returnedRouteEvidenceHash: phase6RagCanonicalHash(body.returnedRouteEvidence),
    metricsHash: phase6RagCanonicalHash(body.metrics),
    evaluationHash: phase6RagCanonicalHash(body),
  };
}

export function phase6AuthoritativeRagTrace({
  runIndex,
  experimentId = "phase6-exp-evidence",
  runId = `run-${runIndex}`,
  journeyId = `journey-${runIndex}`,
  recalledCount = 19,
  expectedFactCount = 20,
  correctRouteCount = 18,
  returnedRouteCount = 20,
} = {}) {
  const expectedRecentKeyFacts = evidenceEntries("fact", expectedFactCount, `event-fact-${runIndex}`);
  const expectedRouteEvidence = evidenceEntries("route", returnedRouteCount, `event-route-${runIndex}`);
  const retrievedFactIds = expectedRecentKeyFacts.slice(0, recalledCount).map((entry) => entry.factId);
  const returnedRouteEvidence = [
    ...expectedRouteEvidence.slice(0, correctRouteCount),
    ...Array.from({ length: returnedRouteCount - correctRouteCount }, (_, index) => ({
      evidenceId: `unsupported-route-${runIndex}-${index + 1}`,
      sourceEventIds: [],
    })),
  ].sort((left, right) => left.evidenceId.localeCompare(right.evidenceId));
  const recalledFactIds = [...retrievedFactIds];
  const correctEvidenceIds = expectedRouteEvidence.slice(0, correctRouteCount).map((entry) => entry.evidenceId);
  const evaluationBody = {
    evaluationType: "phase6_server_rag_evaluation",
    version: "phase6_server_rag_evaluation.v1",
    authority: "server_ground_truth_comparison",
    expectedRecentKeyFacts,
    retrievedFactIds,
    expectedRouteEvidence,
    returnedRouteEvidence,
    metrics: {
      recentKeyFactRecall: {
        recalledFactIds,
        recalledCount,
        expectedCount: expectedFactCount,
        value: recalledCount / expectedFactCount,
      },
      routeSummaryPrecision: {
        correctEvidenceIds,
        correctCount: correctRouteCount,
        returnedCount: returnedRouteCount,
        value: correctRouteCount / returnedRouteCount,
      },
    },
  };
  const evaluation = { ...evaluationBody, integrity: evaluationIntegrity(evaluationBody) };
  const query = `phase6 query ${runIndex}`;
  const queryHash = phase6RagCanonicalHash(query);
  const retrieved = [{
    chunkId: `chunk-${runIndex}`,
    documentId: `document-${runIndex}`,
    sourceId: `source-${runIndex}`,
    sourceHash: phase6RagCanonicalHash({ runIndex, source: true }),
    rank: 1,
    relevance: 1,
  }];
  const groundingHits = [{
    hitId: `hit-${runIndex}`,
    chunkId: `chunk-${runIndex}`,
    documentId: `document-${runIndex}`,
    sourceId: `source-${runIndex}`,
    eventIds: expectedRecentKeyFacts.map((entry) => entry.sourceEventIds[0]),
  }];
  const binding = {
    world: { worldId: "world-phase6", regionId: "region-phase6" },
    identity: { agentId: "agent-phase6", explorerId: "explorer-phase6" },
    experiment: { experimentId, runIndex, seed: `seed-${runIndex}` },
    run: { runId, journeyId, receiptId: `receipt-${runIndex}` },
  };
  const retrievalConfig = {
    retrieverName: "phase6-test-retriever",
    retrieverVersion: "1",
    corpusVersion: "1",
    retrievalMode: "hybrid",
    limit: 20,
  };
  const sourceEventIds = [
    ...expectedRecentKeyFacts.flatMap((entry) => entry.sourceEventIds),
    ...expectedRouteEvidence.flatMap((entry) => entry.sourceEventIds),
  ];
  const usedChunkIds = [`chunk-${runIndex}`];
  const usedDocumentIds = [`document-${runIndex}`];
  const traceBody = {
    traceType: "phase6_server_rag_trace",
    version: "phase6_server_rag_trace.v2",
    authority: "server_retriever_observed",
    status: "ok",
    query,
    queryHash,
    source: "world_knowledge",
    retrievalConfig,
    retrieved,
    usedChunkIds,
    usedDocumentIds,
    groundingHits,
    groundingHitRate: 1,
    binding,
    recordedAt: `2026-07-22T00:00:${String(runIndex).padStart(2, "0")}.000Z`,
    sourceEventIds,
    evaluation,
  };
  return {
    ...traceBody,
    integrity: {
      queryHash,
      retrievedHash: phase6RagCanonicalHash(retrieved),
      usedHash: phase6RagCanonicalHash({ chunkIds: usedChunkIds, documentIds: usedDocumentIds }),
      groundingHash: phase6RagCanonicalHash(groundingHits),
      configHash: phase6RagCanonicalHash(retrievalConfig),
      bindingHash: phase6RagCanonicalHash(binding),
      sourceEventIdsHash: phase6RagCanonicalHash(sourceEventIds),
      evaluationHash: evaluation.integrity.evaluationHash,
      traceHash: phase6RagCanonicalHash(traceBody),
    },
  };
}
