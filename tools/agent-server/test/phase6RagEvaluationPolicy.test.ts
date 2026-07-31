import assert from "node:assert/strict";
import test from "node:test";
import { causalCanonicalJsonHash } from "../lib/epoch/causalCanonicalJson.ts";
import {
  buildPhase6RagServerEvaluation,
  PHASE6_RAG_EVALUATION_PROFILES,
  phase6RagEvaluationProfileForRun,
} from "../lib/epoch/phase6RagEvaluationPolicy.ts";
import {
  capturePhase6ServerRagTrace,
  validatePhase6ServerRagTrace,
} from "../lib/epoch/phase6ServerRagTraceRules.ts";

test("Phase 6 RAG evaluation profiles cover each fixed run with server-owned facts and routes", () => {
  assert.deepEqual(
    PHASE6_RAG_EVALUATION_PROFILES.map((profile) => profile.runIndex),
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  );
  for (const profile of PHASE6_RAG_EVALUATION_PROFILES) {
    assert.ok(profile.query.trim());
    assert.ok(profile.expectedFactIds.length > 0);
    assert.ok(profile.expectedRouteEvidenceIds.length > 0);
    assert.equal(phase6RagEvaluationProfileForRun(profile.runIndex), profile);
  }
  assert.throws(() => phase6RagEvaluationProfileForRun(11), /phase6_rag_evaluation_profile_missing/);
});

test("Phase 6 RAG evaluation keeps its expected facts independent from the returned route", () => {
  const sourceEventIds = ["event-b", "event-a", "event-a"];
  const evaluation = buildPhase6RagServerEvaluation({
    runIndex: 1,
    sourceEventIds,
    retrievedChunks: [
      { sourceId: "world_knowledge:routes:route_mirror_orbit", rank: 1 },
      { sourceId: "world_knowledge:rules:rule_canonical_geography", rank: 2 },
      { sourceId: "world_knowledge:rules:rule_economy_resources", rank: 3 },
    ],
  });

  assert.deepEqual(evaluation.expectedRecentKeyFacts.map((fact) => fact.factId), [
    "world_knowledge:rules:rule_economy_resources",
    "world_knowledge:rules:rule_canonical_geography",
  ]);
  assert.deepEqual(evaluation.expectedRouteEvidence.map((entry) => entry.evidenceId), [
    "world_knowledge:routes:route_mirror_prism",
  ]);
  assert.deepEqual(evaluation.returnedRouteEvidence.map((entry) => entry.evidenceId), [
    "world_knowledge:routes:route_mirror_orbit",
  ]);
  assert.deepEqual(evaluation.expectedRecentKeyFacts[0]!.sourceEventIds, ["event-a", "event-b"]);

  const trace = capturePhase6ServerRagTrace({
    binding: {
      world: { worldId: "obsidian_epoch", regionId: "region_gray_harbor" },
      identity: { agentId: "agent-1", explorerId: "explorer-1" },
      experiment: { experimentId: "experiment-1", runIndex: 1, seed: "seed-1" },
      run: { runId: "run-1", journeyId: "journey-1", receiptId: "receipt-1" },
    },
    query: phase6RagEvaluationProfileForRun(1).query,
    source: "world_knowledge",
    retrievalConfig: {
      retrieverName: "test",
      retrieverVersion: "1",
      corpusVersion: "1",
      retrievalMode: "lexical",
    },
    retrievedChunks: [
      {
        chunkId: "route-orbit",
        documentId: "route_mirror_orbit",
        sourceId: "world_knowledge:routes:route_mirror_orbit",
        sourceHash: causalCanonicalJsonHash("route-orbit"),
        rank: 1,
      },
      {
        chunkId: "geography",
        documentId: "rule_canonical_geography",
        sourceId: "world_knowledge:rules:rule_canonical_geography",
        sourceHash: causalCanonicalJsonHash("geography"),
        rank: 2,
      },
      {
        chunkId: "economy",
        documentId: "rule_economy_resources",
        sourceId: "world_knowledge:rules:rule_economy_resources",
        sourceHash: causalCanonicalJsonHash("economy"),
        rank: 3,
      },
    ],
    serverObservedUsedChunkIds: ["route-orbit", "geography", "economy"],
    serverObservedGroundingHits: [],
    retrievalExpected: true,
    recordedAt: "2026-07-30T00:00:00.000Z",
    sourceEventIds: ["event-a", "event-b"],
    serverEvaluation: evaluation,
  });

  assert.equal(trace.evaluation?.metrics.recentKeyFactRecall.value, 1);
  assert.equal(trace.evaluation?.metrics.routeSummaryPrecision.value, 0);
  assert.deepEqual(validatePhase6ServerRagTrace(trace), { ok: true, status: "ok", issues: [] });
});

test("Phase 6 RAG evaluation rejects traces without canonical source events", () => {
  assert.throws(() => buildPhase6RagServerEvaluation({
    runIndex: 1,
    sourceEventIds: [],
    retrievedChunks: [],
  }), /phase6_rag_evaluation_source_events_missing/);
});
