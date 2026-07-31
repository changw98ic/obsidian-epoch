import assert from "node:assert/strict";
import test from "node:test";

import {
  buildJourneyRunReceipt,
  JOURNEY_RUN_SCORE_DIMENSIONS,
  journeyRunSnapshotHash,
  validateJourneyRunReceipt,
  validateJourneyRunScore,
} from "../lib/epoch/journeyRunReceiptRules.ts";
import {
  buildPhase6MachineReadableResultPage,
  phase6ResultPageScoreDetails,
  phase6ResultPageScoreSummary,
} from "../lib/epoch/phase6ResultPageRules.ts";
import {
  buildPhase6ServerScoringEvidence,
  type Phase6ServerScoringEvidenceInput,
} from "../lib/epoch/phase6ServerScoringRules.ts";

const EVENT_ID = "event_phase6_score_contract";
const HASH = `sha256:${"a".repeat(64)}` as const;

function scoringInput(): Phase6ServerScoringEvidenceInput {
  return {
    canonicalEvents: [{
      eventId: EVENT_ID,
      eventType: "journey_objective_completed",
      tags: ["objective", "survival", "difficulty", "combat", "performance", "efficiency", "world_impact"],
      payload: { success: true, difficulty: 0.65, performance: 0.78, resourceCost: 0.12, injuryCost: 0.03 },
    }],
    beforeSnapshot: { combatPower: 0.55, reserve: 1 },
    afterSnapshot: { combatPower: 0.55, reserve: 0.88, injury: 0.03 },
    outcomeResolution: {
      success: true,
      objective: 0.9,
      difficulty: 0.65,
      performance: 0.78,
      resourceCost: 0.12,
      injuryCost: 0.03,
      worldImpact: 0.58,
    },
    actionResolutions: [{ performance: 0.78, riskHandling: 0.8, resourceCost: 0.12 }],
    worldCursor: { worldId: "world_score", regionId: "region_score" },
    versionBinding: { rulesetVersion: "rules_v1", catalogVersion: "catalog_v1", codeVersion: "code_v1" },
  };
}

test("new V2 receipt writes only the canonical score envelope", () => {
  const scoring = buildPhase6ServerScoringEvidence(scoringInput());
  assert.equal(scoring.ok, true);
  if (!scoring.ok) return;
  const beforeBody = { state: "before" };
  const afterBody = { state: "after" };
  const receipt = buildJourneyRunReceipt({
    receiptId: "receipt_v2",
    runId: "run_v2",
    journeyId: "journey_v2",
    agentId: "agent_v2",
    explorerId: "explorer_v2",
    experimentId: "experiment_v2",
    runIndex: 1,
    seed: "seed_v2",
    rulesetVersion: "rules_v1",
    catalogVersion: "catalog_v1",
    codeVersion: "code_v1",
    scenarioMatrixVersion: "matrix_v2",
    generatedAt: "2026-07-22T00:01:00.000Z",
    startedAt: "2026-07-22T00:00:00.000Z",
    settledAt: "2026-07-22T00:01:00.000Z",
    world: { worldId: "world_score", regionId: "region_score", worldTimeBefore: "day_1", worldTimeAfter: "day_2" },
    snapshots: {
      before: { body: beforeBody, hash: journeyRunSnapshotHash(beforeBody) },
      after: { body: afterBody, hash: journeyRunSnapshotHash(afterBody) },
    },
    deltas: [],
    score: scoring.score,
    suitability: scoring.suitability,
    rag: {
      queryHash: HASH,
      corpusHash: HASH,
      claims: [],
      importantMemoryCount: 0,
      ordinaryNodePersistenceExpansion: 0,
      delta: { entries: [] },
      noChangeReason: "projection_equal",
    },
    eventIds: { source: [EVENT_ID], settlement: [], derived: [] },
    outcome: { success: true },
  });
  assert.equal(validateJourneyRunReceipt(receipt).ok, true);
  assert.deepEqual(Object.keys(receipt.score.dimensions), [...JOURNEY_RUN_SCORE_DIMENSIONS]);
  assert.equal("world_impact" in receipt.score.dimensions, false);

  const details = phase6ResultPageScoreDetails(receipt.score, [EVENT_ID]);
  const summary = phase6ResultPageScoreSummary(receipt.score);
  assert.deepEqual(details.map((detail) => detail.dimension), [...JOURNEY_RUN_SCORE_DIMENSIONS]);
  assert.equal(details.every((detail) => detail.value === detail.score && detail.formula.length > 0), true);
  assert.equal(summary.total, receipt.score.total);

  const page = buildPhase6MachineReadableResultPage({
    receipt: {
      receiptId: receipt.receiptId,
      runId: receipt.runId,
      createdAt: receipt.generatedAt,
      payloadHash: HASH,
      canonicalEventIds: [EVENT_ID],
      canonicalEvents: [{ eventId: EVENT_ID, kind: "source" }],
    },
    events: [{ eventId: EVENT_ID, kind: "source" }],
    world: { mode: "no_change", changes: [], noChangeReason: "world_equal", eventIds: [EVENT_ID] },
    identityProgression: {
      identity: { mode: "no_change", changes: [], noChangeReason: "identity_equal", eventIds: [EVENT_ID] },
      progression: { mode: "no_change", changes: [], noChangeReason: "progression_equal", eventIds: [EVENT_ID] },
    },
    settlement: {
      status: "settled",
      settlementId: receipt.receiptId,
      eventIds: [EVENT_ID],
      economyConservation: { conserved: true, assets: [], auditFindingIds: [] },
    },
    scoreSummary: summary,
    scores: details,
    rag: {
      mode: "no_change",
      changes: [],
      noChangeReason: "no_retrieval_required",
      eventIds: [EVENT_ID],
      evidenceIds: [EVENT_ID],
      retrievalSnapshotId: HASH,
    },
    audit: {
      auditId: "audit_score_v2",
      eventIds: [EVENT_ID],
      integrity: {
        ok: true,
        receiptPayloadHash: HASH,
        canonicalEventIds: [EVENT_ID],
        checkedAt: "2026-07-22T00:01:00.000Z",
      },
    },
  });
  assert.equal(page.ok, true);
  if (page.ok) {
    assert.equal(page.page.sections.scoreSummary.total, receipt.score.total);
    assert.deepEqual(page.page.sections.scores.map((detail) => detail.dimension).sort(), [...JOURNEY_RUN_SCORE_DIMENSIONS].sort());
  }
});

test("a zero-delta RAG receipt requires its explicit reason", () => {
  const scoring = buildPhase6ServerScoringEvidence(scoringInput());
  assert.equal(scoring.ok, true);
  if (!scoring.ok) return;
  const beforeBody = { state: "before" };
  const afterBody = { state: "after" };
  const receipt = buildJourneyRunReceipt({
    receiptId: "receipt_rag_reason",
    runId: "run_rag_reason",
    journeyId: "journey_rag_reason",
    agentId: "agent_rag_reason",
    explorerId: "explorer_rag_reason",
    experimentId: "experiment_rag_reason",
    runIndex: 1,
    seed: "seed_rag_reason",
    rulesetVersion: "rules_v1",
    catalogVersion: "catalog_v1",
    codeVersion: "code_v1",
    scenarioMatrixVersion: "matrix_v2",
    generatedAt: "2026-07-22T00:01:00.000Z",
    startedAt: "2026-07-22T00:00:00.000Z",
    settledAt: "2026-07-22T00:01:00.000Z",
    world: { worldId: "world_score", regionId: "region_score", worldTimeBefore: "day_1", worldTimeAfter: "day_2" },
    snapshots: {
      before: { body: beforeBody, hash: journeyRunSnapshotHash(beforeBody) },
      after: { body: afterBody, hash: journeyRunSnapshotHash(afterBody) },
    },
    deltas: [],
    score: scoring.score,
    suitability: scoring.suitability,
    rag: {
      queryHash: HASH,
      corpusHash: HASH,
      claims: [],
      importantMemoryCount: 0,
      ordinaryNodePersistenceExpansion: 0,
      delta: { entries: [] },
      noChangeReason: "projection_equal",
    },
    eventIds: { source: [EVENT_ID], settlement: [], derived: [] },
    outcome: { success: true },
  });
  const missingReason = structuredClone(receipt) as { rag: { noChangeReason?: string } };
  delete missingReason.rag.noChangeReason;
  const validation = validateJourneyRunReceipt(missingReason);
  assert.equal(validation.ok, false);
  assert.equal(validation.issues.some((entry) => entry.code === "journey_run_receipt_rag_no_change_reason_required"), true);
});

test("a score without the canonical envelope is rejected", () => {
  assert.equal(validateJourneyRunScore({ objective: { value: 82, evidence: [EVENT_ID] } }).ok, false);
});

test("all score-bearing production assembly modules load with the canonical contract", async () => {
  await Promise.all([
    import("../lib/epoch/phase6RunAssembly.ts"),
    import("../lib/epoch/phase6JourneySettlementAdapter.ts"),
    import("../lib/epoch/phase6ServerResultPageRules.ts"),
    import("../lib/epoch/phase6AuthoritativeCompletionRules.ts"),
    import("../lib/epoch/phase6ServerPreSettlementRules.ts"),
  ]);
});
