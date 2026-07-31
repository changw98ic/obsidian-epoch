import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { capturePhase6ServerRagTrace } from "../lib/epoch/phase6ServerRagTraceRules.ts";
import { causalCanonicalJsonHash } from "../lib/epoch/causalCanonicalJson.ts";

const testDirectory = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(testDirectory, "../../..");
const gatePath = resolve(repoRoot, "tools/agent-server/phase6-rag-gate.ts");

function traceInput(runIndex: number) {
  const expectedRecentKeyFacts = Array.from({ length: 20 }, (_, index) => ({
    factId: `fact-${runIndex}-${index + 1}`,
    sourceEventIds: [`fact-event-${runIndex}-${index + 1}`],
  }));
  const expectedRouteEvidence = Array.from({ length: 20 }, (_, index) => ({
    evidenceId: `route-${runIndex}-${index + 1}`,
    sourceEventIds: [`route-event-${runIndex}-${index + 1}`],
  }));
  return {
    binding: {
      world: { worldId: "world-gate" },
      identity: { agentId: "agent-gate", explorerId: "explorer-gate" },
      experiment: { experimentId: "experiment-gate", runIndex },
      run: { runId: `run-${runIndex}`, journeyId: `journey-${runIndex}` },
    },
    query: `query-${runIndex}`,
    source: "world_memory" as const,
    retrievalConfig: {
      retrieverName: "gate-retriever",
      retrieverVersion: "2",
      corpusVersion: "gate-corpus",
      retrievalMode: "hybrid" as const,
      limit: 20,
    },
    retrievedChunks: [{
      chunkId: `chunk-${runIndex}`,
      documentId: `document-${runIndex}`,
      sourceId: `source-${runIndex}`,
      sourceHash: causalCanonicalJsonHash(`source-${runIndex}`),
      rank: 1,
    }],
    serverObservedUsedChunkIds: [`chunk-${runIndex}`],
    serverObservedGroundingHits: [{
      hitId: `hit-${runIndex}`,
      chunkId: `chunk-${runIndex}`,
      documentId: `document-${runIndex}`,
      sourceId: `source-${runIndex}`,
      eventIds: expectedRecentKeyFacts.map((entry) => entry.sourceEventIds[0]),
    }],
    retrievalExpected: true,
    recordedAt: `2026-07-22T11:00:${String(runIndex).padStart(2, "0")}.000Z`,
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
        { evidenceId: `unsupported-${runIndex}-1`, sourceEventIds: [] },
        { evidenceId: `unsupported-${runIndex}-2`, sourceEventIds: [] },
      ],
    },
  };
}

function receipt(runIndex: number) {
  return {
    runIndex,
    runId: `run-${runIndex}`,
    journeyId: `journey-${runIndex}`,
    importantMemoryCount: 1,
    dedupedRouteCount: 1,
    duplicateRouteCount: 1,
    ordinaryNodePersistenceExpansion: 1,
    ragDelta: [{
      type: "persistent_memory",
      importance: "high",
      memoryId: `memory-${runIndex}`,
      sourceEventIds: [`memory-event-${runIndex}`],
    }],
  };
}

function runGate(
  queryRecords: readonly unknown[],
  receiptRecords: readonly unknown[] = Array.from({ length: 10 }, (_, index) => receipt(index + 1)),
) {
  const root = mkdtempSync(join(testDirectory, ".phase6-rag-gate-"));
  try {
    const queryPath = join(root, "queries.jsonl");
    const receiptPath = join(root, "receipts.jsonl");
    writeFileSync(queryPath, queryRecords.map((value) => JSON.stringify(value)).join("\n") + "\n", "utf8");
    writeFileSync(receiptPath, receiptRecords.map((value) => JSON.stringify(value)).join("\n") + "\n", "utf8");
    const result = spawnSync(process.execPath, [
      gatePath,
      "--query-evaluations", relative(repoRoot, queryPath),
      "--run-receipts", relative(repoRoot, receiptPath),
    ], { cwd: repoRoot, encoding: "utf8" });
    return { status: result.status, report: JSON.parse(result.stdout) };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test("Phase 6 RAG gate passes exact thresholds and excludes legitimate no-retrieval", () => {
  const traces = Array.from({ length: 9 }, (_, index) => capturePhase6ServerRagTrace(traceInput(index + 1)));
  traces.push(capturePhase6ServerRagTrace({
    ...traceInput(10),
    query: undefined,
    retrievalConfig: undefined,
    retrievedChunks: [],
    serverObservedUsedChunkIds: [],
    serverObservedGroundingHits: [],
    retrievalExpected: false,
    noRetrievalReason: "not_needed",
    serverEvaluation: undefined,
  }));
  const result = runGate(traces);
  assert.equal(result.status, 0, JSON.stringify(result.report.failures, null, 2));
  assert.equal(result.report.metrics.recentKeyFactRecall.value, 0.95);
  assert.equal(result.report.metrics.routeSummaryPrecision.value, 0.9);
  assert.equal(result.report.metrics.evaluationClassification.authoritativeEvaluationCount, 9);
  assert.equal(result.report.metrics.evaluationClassification.legitimateNoRetrievalCount, 1);
});

test("Phase 6 RAG gate rejects ordinary traces even when they claim passing ratios", () => {
  const records = Array.from({ length: 10 }, (_, index) => ({
    id: `fake-${index + 1}`,
    type: "recent_key_fact_recall route_summary_precision",
    recalledCount: 20,
    expectedCount: 20,
    correctCount: 20,
    returnedCount: 20,
  }));
  const result = runGate(records);
  assert.equal(result.status, 1);
  assert.equal(result.report.failures.some((failure: { gate: string }) => failure.gate === "authoritative_rag_evaluation_shape"), true);
});

test("Phase 6 RAG gate fails closed on missing evaluation fields", () => {
  const traces = Array.from({ length: 10 }, (_, index) => capturePhase6ServerRagTrace(traceInput(index + 1)));
  delete (traces[0] as unknown as { evaluation?: unknown }).evaluation;
  const result = runGate(traces);
  assert.equal(result.status, 1);
  assert.equal(result.report.failures.some((failure: { gate: string }) => failure.gate === "authoritative_rag_evaluation_shape"), true);
});

test("Phase 6 RAG gate rejects a zero-delta run without an explicit reason", () => {
  const traces = Array.from({ length: 9 }, (_, index) => capturePhase6ServerRagTrace(traceInput(index + 1)));
  traces.push(capturePhase6ServerRagTrace({
    ...traceInput(10),
    query: undefined,
    retrievalConfig: undefined,
    retrievedChunks: [],
    serverObservedUsedChunkIds: [],
    serverObservedGroundingHits: [],
    retrievalExpected: false,
    noRetrievalReason: "not_needed",
    serverEvaluation: undefined,
  }));
  const receipts = Array.from({ length: 10 }, (_, index) => receipt(index + 1));
  receipts[0] = {
    ...receipts[0],
    importantMemoryCount: 0,
    ordinaryNodePersistenceExpansion: 0,
    ragDelta: [],
  };
  const result = runGate(traces, receipts);
  assert.equal(result.status, 1);
  assert.equal(result.report.failures.some((failure: { gate: string }) => failure.gate === "rag_no_change_reason_present"), true);
});

test("Phase 6 RAG gate ignores a non-RAG top-level no-change reason", () => {
  const traces = Array.from({ length: 10 }, (_, index) => capturePhase6ServerRagTrace(traceInput(index + 1)));
  const receipts = Array.from({ length: 10 }, (_, index) => ({
    ...receipt(index + 1),
    noChangeReason: "server_canonical_domain_stable_by_receipt_hash",
  }));
  const result = runGate(traces, receipts);
  assert.equal(result.status, 0, JSON.stringify(result.report.failures, null, 2));
});
