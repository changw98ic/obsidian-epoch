import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { causalCanonicalJsonHash } from "../lib/epoch/causalCanonicalJson.ts";
import { createPhase6RagTraceStore } from "../lib/epoch/phase6RagTraceStore.ts";
import {
  capturePhase6ServerRagTrace,
  validatePhase6ServerRagTrace,
  type CapturePhase6ServerRagTraceInput,
} from "../lib/epoch/phase6ServerRagTraceRules.ts";

function evaluatedInput(recordedAt = "2026-07-22T10:00:00.000Z"): CapturePhase6ServerRagTraceInput {
  const expectedRecentKeyFacts = Array.from({ length: 20 }, (_, index) => ({
    factId: `fact-${index + 1}`,
    sourceEventIds: [`fact-event-${index + 1}`],
  }));
  const expectedRouteEvidence = Array.from({ length: 20 }, (_, index) => ({
    evidenceId: `route-${index + 1}`,
    sourceEventIds: [`route-event-${index + 1}`],
  }));
  return {
    binding: {
      world: { worldId: "world-1", regionId: "region-1" },
      identity: { agentId: "agent-1", explorerId: "explorer-1" },
      experiment: { experimentId: "experiment-1", runIndex: 1, seed: "seed-1" },
      run: { runId: "run-1", journeyId: "journey-1", receiptId: "receipt-1" },
    },
    query: "recent facts and safe route",
    source: "world_knowledge",
    retrievalConfig: {
      retrieverName: "hybrid-world-retriever",
      retrieverVersion: "2",
      corpusVersion: "world-corpus-7",
      retrievalMode: "hybrid",
      limit: 20,
    },
    retrievedChunks: [{
      chunkId: "chunk-1",
      documentId: "document-1",
      sourceId: "source-1",
      sourceHash: causalCanonicalJsonHash("source-1"),
      rank: 1,
      relevance: 1,
    }],
    serverObservedUsedChunkIds: ["chunk-1"],
    serverObservedGroundingHits: [{
      hitId: "hit-1",
      chunkId: "chunk-1",
      documentId: "document-1",
      sourceId: "source-1",
      eventIds: expectedRecentKeyFacts.map((entry) => entry.sourceEventIds[0]),
    }],
    retrievalExpected: true,
    recordedAt,
    sourceEventIds: [
      ...expectedRecentKeyFacts.flatMap((entry) => entry.sourceEventIds),
      ...expectedRouteEvidence.flatMap((entry) => entry.sourceEventIds),
    ],
    serverEvaluation: {
      expectedRecentKeyFacts,
      retrievedFactIds: expectedRecentKeyFacts.slice(0, 19).map((entry) => entry.factId),
      expectedRouteEvidence,
      returnedRouteEvidence: [
        ...expectedRouteEvidence.slice(0, 18),
        { evidenceId: "unsupported-route-1", sourceEventIds: [] },
        { evidenceId: "unsupported-route-2", sourceEventIds: [] },
      ],
    },
  };
}

test("Phase 6 RAG trace v2 records authoritative evidence sets and computes exact metrics", () => {
  const trace = capturePhase6ServerRagTrace(evaluatedInput());
  assert.equal(trace.version, "phase6_server_rag_trace.v2");
  assert.match(trace.queryHash || "", /^sha256:[a-f0-9]{64}$/);
  assert.match(trace.integrity.traceHash, /^sha256:[a-f0-9]{64}$/);
  assert.equal(trace.evaluation?.expectedRecentKeyFacts.length, 20);
  assert.equal(trace.evaluation?.retrievedFactIds.length, 19);
  assert.equal(trace.evaluation?.expectedRouteEvidence.length, 20);
  assert.equal(trace.evaluation?.returnedRouteEvidence.length, 20);
  assert.equal(trace.evaluation?.metrics.recentKeyFactRecall.value, 0.95);
  assert.equal(trace.evaluation?.metrics.routeSummaryPrecision.value, 0.9);
  assert.deepEqual(validatePhase6ServerRagTrace(trace), { ok: true, status: "ok", issues: [] });
});

test("Phase 6 RAG SQLite store appends evaluated and no-retrieval traces for one query", () => {
  const db = new DatabaseSync(":memory:");
  const store = createPhase6RagTraceStore(db);
  const base = evaluatedInput("2026-07-22T10:00:00.000Z");
  const noRetrievalTrace = capturePhase6ServerRagTrace({
    ...base,
    query: undefined,
    retrievalConfig: undefined,
    retrievedChunks: [],
    serverObservedUsedChunkIds: [],
    serverObservedGroundingHits: [],
    retrievalExpected: false,
    noRetrievalReason: "not_needed",
    serverEvaluation: undefined,
  });
  const first = capturePhase6ServerRagTrace(base);
  const second = capturePhase6ServerRagTrace(evaluatedInput("2026-07-22T10:01:00.000Z"));
  assert.equal(noRetrievalTrace.version, "phase6_server_rag_trace.v2");
  store.append(noRetrievalTrace);
  store.append(first);
  store.append(second);
  assert.equal(store.list({ experimentId: "experiment-1", runIndex: 1 }).length, 3);
  assert.equal(store.load(noRetrievalTrace.integrity.traceHash)?.trace.version, "phase6_server_rag_trace.v2");
  assert.equal(store.loadByBinding({
    experimentId: "experiment-1",
    runIndex: 1,
    journeyId: "journey-1",
    queryHash: first.queryHash,
  })?.traceHash, second.integrity.traceHash);
  db.close();
});

test("Phase 6 RAG evaluation fails closed on missing ground truth while no-retrieval stays separate", () => {
  const malformed = capturePhase6ServerRagTrace({
    ...evaluatedInput(),
    serverEvaluation: {
      ...evaluatedInput().serverEvaluation!,
      expectedRecentKeyFacts: [],
    },
  });
  assert.equal(validatePhase6ServerRagTrace(malformed).ok, false);
  const noRetrieval = capturePhase6ServerRagTrace({
    ...evaluatedInput(),
    query: undefined,
    retrievalConfig: undefined,
    retrievedChunks: [],
    serverObservedUsedChunkIds: [],
    serverObservedGroundingHits: [],
    retrievalExpected: false,
    noRetrievalReason: "not_needed",
    serverEvaluation: undefined,
  });
  assert.equal(noRetrieval.version, "phase6_server_rag_trace.v2");
  assert.equal(noRetrieval.status, "legitimate_no_retrieval");
  assert.equal(validatePhase6ServerRagTrace(noRetrieval).ok, true);
});
