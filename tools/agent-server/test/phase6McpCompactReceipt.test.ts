import assert from "node:assert/strict";
import test from "node:test";

import { buildCompactPhase6RunReceiptForTransport } from "../lib/mcpToolsPhase6.ts";

const compactReceipt = buildCompactPhase6RunReceiptForTransport({
  compactTransportArray(value: unknown) {
    return Array.isArray(value) ? value : [];
  },
  preserveCompactTransportEvents<T extends Record<string, unknown>>(value: T) {
    return value;
  },
});

function receiptWithRag(rag: Record<string, unknown>) {
  return {
    rulesetVersion: "rules_v1",
    receipt: {
      receiptType: "journey_run_receipt",
      version: "journey_run_receipt.v2",
      authority: "server_settled",
      receiptId: "receipt-1",
      runId: "run-1",
      journeyId: "journey-1",
      agentId: "agent-1",
      explorerId: "explorer-1",
      experimentId: "experiment-1",
      runIndex: 1,
      seed: "seed-1",
      rulesetVersion: "rules_v1",
      catalogVersion: "catalog_v1",
      codeVersion: "code_v1",
      scenarioMatrixVersion: "matrix_v1",
      settlementPolicyVersion: "phase6-settlement-policy-v1",
      generatedAt: "2026-07-30T00:00:01.000Z",
      startedAt: "2026-07-30T00:00:00.000Z",
      settledAt: "2026-07-30T00:00:01.000Z",
      world: {},
      snapshots: { before: { hash: "sha256:before" }, after: { hash: "sha256:after" } },
      noChangeReasons: {},
      deltas: [],
      score: {},
      suitability: {},
      rag,
      eventIds: { source: [], settlement: [], derived: [] },
      outcome: {},
      integrity: {},
    },
  };
}

function compactRag(result: unknown): Record<string, unknown> {
  const output = result as { receipt: { rag: Record<string, unknown> } };
  return output.receipt.rag;
}

test("compact Phase 6 receipts retain zero-delta RAG reason and required counters", () => {
  const rag = compactRag(compactReceipt(receiptWithRag({
    queryHash: "sha256:query",
    corpusHash: "sha256:corpus",
    claims: [],
    importantMemoryCount: 0,
    ordinaryNodePersistenceExpansion: 0,
    delta: { entries: [] },
    noChangeReason: "projection_equal",
  })));
  assert.equal(rag.importantMemoryCount, 0);
  assert.equal(rag.ordinaryNodePersistenceExpansion, 0);
  assert.deepEqual(rag.delta, { count: 0, entries: [] });
  assert.equal(rag.noChangeReason, "projection_equal");
});

test("compact Phase 6 receipts retain persistent-memory event evidence", () => {
  const rag = compactRag(compactReceipt(receiptWithRag({
    queryHash: "sha256:query",
    corpusHash: "sha256:corpus",
    claims: [],
    importantMemoryCount: 1,
    ordinaryNodePersistenceExpansion: 0,
    delta: {
      entries: [{
        type: "persistent_memory",
        memoryId: "memory-1",
        importance: "high",
        sourceEventIds: ["event-1", "event-2"],
      }],
    },
  })));
  assert.equal(rag.importantMemoryCount, 1);
  assert.equal(rag.noChangeReason, undefined);
  assert.deepEqual(rag.delta, {
    count: 1,
    entries: [{
      type: "persistent_memory",
      memoryId: "memory-1",
      importance: "high",
      sourceEventIds: { count: 2, values: ["event-1", "event-2"] },
    }],
  });
});
