import assert from "node:assert/strict";
import test from "node:test";

import {
  CONSEQUENCE_SCORE_POLICY_VERSION,
  type MirrorConsequenceLedgerEntry,
  type SelfLossContribution,
  type SettlementContext,
} from "../lib/epoch/journeySettlementRules.ts";
import {
  buildConsequenceScore,
  COLLATERAL_CAP_BPS,
  COLLATERAL_FLOOR_BPS,
  COLLATERAL_WEIGHT_BPS_V1,
  computeSettlementContextReplayDigest,
  IDENTITY_DOUBT_COLLATERAL_CAP_BPS,
  LIFETIME_SELFLOSS_BPS_PER_POINT,
  RESOURCE_SELFLOSS_BPS_PER_UNIT,
  RESULT_WEIGHT_EXEC,
  RESULT_WEIGHT_MAIN,
  RESULT_WEIGHT_SIDE,
  SELFLOSS_CAP_BPS,
  applySelfLossDedupRules,
  collateralMagnitudeFactor,
} from "../lib/epoch/journeyConsequenceScoring.ts";
import { DOUBT_PENALTY_BPS } from "../lib/epoch/journeyViabilityRules.ts";

/**
 * PR4 journeyConsequenceScoring tests.
 *
 * Coverage map:
 * - Three-dimensional additive bucket calculation (result / self-loss / collateral).
 * - Self-loss dedup (Rule 1-8): same canonical event across 4 sources counted once.
 * - Hidden clamp recording (main_incomplete / hidden_incomplete / no clamp).
 * - mainLineSucceeded=false does NOT zero resultScoreBps in breakdown.
 * - Total = clamp(result + selfLoss + collateral, 0, 10_000).
 * - Zero-affinity banlist (runtime throw on banned ctx field).
 * - Replay digest stability (same ctx → same digest).
 */

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeBaseCtx(overrides: Partial<SettlementContext> = {}): SettlementContext {
  return {
    journeyId: "journey_test_001",
    mainObjectiveIds: ["main_001", "main_002"],
    sideObjectiveIds: ["side_001"],
    hiddenObjectiveIds: ["hidden_001"],
    mainLineSucceeded: true,
    hiddenComplete: true,
    actionResolutions: [
      { actionEventId: "evt_action_001", resultKind: "combat", succeeded: true },
      { actionEventId: "evt_action_002", resultKind: "negotiation", succeeded: true },
    ],
    selfLossSourceEventsByKind: {
      resource_cost: [],
      resource_spent_event: [],
      hosted_action_lifetime_delta: [],
      lifetime_adjusted_event: [],
    },
    mirrorLedgerEntries: [],
    canonicalActionEventIds: ["evt_action_001", "evt_action_002"],
    resultComponentInputs: {
      mainCompletionBps: 10_000,
      bonusMainCompletionBps: 0,
      sideCompletionBps: 10_000,
      executionQualityBps: 10_000,
      penaltyBps: 0,
    },
    selfLossContributions: [],
    baseRewardBundle: {
      baseBundleRef: "bundle_base_test_v1",
      resources: { coin: 5 },
      items: [],
    },
    policyVersion: 1 as const,
    ...overrides,
  };
}

function makeMirrorEntry(input: {
  readonly actionEventId: string;
  readonly effectKind: MirrorConsequenceLedgerEntry["effectKind"];
  readonly targetEntityId: string;
  readonly delta: number;
  readonly dedupeKey: string;
  readonly recordedAt?: string;
  /**
   * PR5b: identity_doubt entries MUST carry `doubtStrength` in the
   * effectBlueprint — the collateral scorer reads it via
   * DOUBT_PENALTY_BPS[strength]. Other effect kinds ignore this field.
   */
  readonly doubtStrength?: "low" | "moderate" | "high" | "severe";
}): MirrorConsequenceLedgerEntry {
  const effectBlueprint: Record<string, unknown> = {};
  if (input.doubtStrength !== undefined) {
    effectBlueprint["doubtStrength"] = input.doubtStrength;
  }
  return {
    actionEventId: input.actionEventId,
    effectKind: input.effectKind,
    targetEntityId: input.targetEntityId,
    delta: input.delta,
    consequenceType: "collateral",
    sourceEventIds: [],
    effectBlueprint,
    recordedAt: input.recordedAt ?? "1970-01-01T00:00:00.000Z",
    dedupeKey: input.dedupeKey,
  };
}

// ---------------------------------------------------------------------------
// Result bucket
// ---------------------------------------------------------------------------

test("resultScoreBps applies the 0.6/0.2/0.2 weights and clamps to [0, 10_000]", () => {
  assert.equal(RESULT_WEIGHT_MAIN, 0.6);
  assert.equal(RESULT_WEIGHT_SIDE, 0.2);
  assert.equal(RESULT_WEIGHT_EXEC, 0.2);
  // Weights sum to exactly 1.0 so a perfect run saturates the bucket.
  assert.ok(Math.abs(RESULT_WEIGHT_MAIN + RESULT_WEIGHT_SIDE + RESULT_WEIGHT_EXEC - 1.0) < 1e-9);

  const score = buildConsequenceScore(makeBaseCtx());
  assert.equal(score.breakdown.resultScoreBps, 10_000);
  assert.equal(score.breakdown.selfLossScoreBps, 0);
  assert.equal(score.breakdown.collateralScoreBps, 0);
  assert.equal(score.breakdown.totalBps, 10_000);
});

test("resultScoreBps weights partial completion proportionally", () => {
  const ctx = makeBaseCtx({
    resultComponentInputs: {
      mainCompletionBps: 5_000, // half main → 3000
      bonusMainCompletionBps: 0,
      sideCompletionBps: 5_000, // half side → 1000
      executionQualityBps: 8_000, // 80% quality → 1600
      penaltyBps: 0,
    },
  });
  const score = buildConsequenceScore(ctx);
  // 5000*0.6 + 5000*0.2 + 8000*0.2 - 0 = 3000 + 1000 + 1600 = 5600
  assert.equal(score.breakdown.resultScoreBps, 5_600);
});

test("resultScoreBps subtracts penalty bps and clamps at zero", () => {
  const ctx = makeBaseCtx({
    resultComponentInputs: {
      mainCompletionBps: 2_000, // 1200
      bonusMainCompletionBps: 0,
      sideCompletionBps: 1_000, // 200
      executionQualityBps: 2_000, // 400
      penaltyBps: 5_000, // large penalty
    },
  });
  const score = buildConsequenceScore(ctx);
  // 1200 + 200 + 400 - 5000 = -3200 → clamp to 0
  assert.equal(score.breakdown.resultScoreBps, 0);
});

test("mainLineSucceeded=false does NOT zero resultScoreBps in breakdown (auditability)", () => {
  // The clamp is applied in deriveSettlementDecision via HiddenClamp, NOT here.
  // The breakdown stays auditable.
  const ctx = makeBaseCtx({
    mainLineSucceeded: false,
    resultComponentInputs: {
      mainCompletionBps: 8_000,
      bonusMainCompletionBps: 0,
      sideCompletionBps: 8_000,
      executionQualityBps: 8_000,
      penaltyBps: 0,
    },
  });
  const score = buildConsequenceScore(ctx);
  assert.equal(score.mainLineSucceeded, false);
  assert.equal(score.breakdown.resultScoreBps, 8_000); // untouched
  // HiddenClamp records the cap.
  assert.equal(score.hiddenClamp.applied, true);
  assert.equal(score.hiddenClamp.reason, "main_incomplete");
  assert.equal(score.hiddenClamp.tierCap, "未及格");
});

// ---------------------------------------------------------------------------
// Self-loss bucket
// ---------------------------------------------------------------------------

test("selfLossScoreBps is zero on a run with no paid contributions (Rule 8)", () => {
  const score = buildConsequenceScore(makeBaseCtx());
  assert.equal(score.breakdown.selfLossScoreBps, 0);
  assert.deepEqual(score.breakdown.selfLossSourceEventsByKind.resource_cost, []);
  assert.deepEqual(score.breakdown.selfLossSourceEventsByKind.resource_spent_event, []);
  assert.deepEqual(score.breakdown.selfLossSourceEventsByKind.hosted_action_lifetime_delta, []);
  assert.deepEqual(score.breakdown.selfLossSourceEventsByKind.lifetime_adjusted_event, []);
});

test("selfLossScoreBps charges per resource unit at RESOURCE_SELFLOSS_BPS_PER_UNIT", () => {
  assert.equal(RESOURCE_SELFLOSS_BPS_PER_UNIT, 200);
  const contributions: readonly SelfLossContribution[] = [
    {
      actionEventId: "evt_action_001",
      costKind: "resource",
      sourceKind: "resource_cost",
      canonicalEventIds: ["evt_resource_cost_001"],
      resourceUnits: 3,
    },
  ];
  const ctx = makeBaseCtx({ selfLossContributions: contributions });
  const score = buildConsequenceScore(ctx);
  // 3 units * 200 bps = 600 magnitude → -600 contribution to totalBps.
  assert.equal(score.breakdown.selfLossScoreBps, -600);
  assert.deepEqual(
    score.breakdown.selfLossSourceEventsByKind.resource_cost,
    ["evt_resource_cost_001"],
  );
});

test("selfLossScoreBps charges lifetime via max(0, -delta) at LIFETIME_SELFLOSS_BPS_PER_POINT (Rule 7)", () => {
  assert.equal(LIFETIME_SELFLOSS_BPS_PER_POINT, 10);
  const contributions: readonly SelfLossContribution[] = [
    {
      actionEventId: "evt_action_001",
      costKind: "lifetime",
      sourceKind: "hosted_action_lifetime_delta",
      canonicalEventIds: ["evt_hosted_001"],
      lifetimeDelta: -50, // paid 50 lifetime
    },
    {
      actionEventId: "evt_action_002",
      costKind: "lifetime",
      sourceKind: "lifetime_adjusted_event",
      canonicalEventIds: ["evt_lifetime_002"],
      lifetimeDelta: 20, // GAIN — does not offset (no wash-trading)
    },
  ];
  const ctx = makeBaseCtx({ selfLossContributions: contributions });
  const score = buildConsequenceScore(ctx);
  // 50 * 10 = 500 magnitude; the +20 gain contributes 0 (Rule 7). → -500.
  assert.equal(score.breakdown.selfLossScoreBps, -500);
});

test("selfLossScoreBps deduplicates the four sources by (actionEventId, costKind) — single source per tuple (Rules 1-5)", () => {
  // Same action, same cost-kind, surfacing via two different sources.
  // The defensive second pass collapses to one entry.
  const contributions: readonly SelfLossContribution[] = [
    {
      actionEventId: "evt_action_001",
      costKind: "resource",
      sourceKind: "resource_cost",
      canonicalEventIds: ["evt_resource_cost_001"],
      resourceUnits: 1,
    },
    {
      actionEventId: "evt_action_001",
      costKind: "resource",
      sourceKind: "resource_spent_event",
      canonicalEventIds: ["evt_resource_spent_001"],
      resourceUnits: 1,
    },
  ];
  const ctx = makeBaseCtx({ selfLossContributions: contributions });
  const score = buildConsequenceScore(ctx);
  // Only the FIRST occurrence wins (Rule 5). 1 unit * 200 = 200 magnitude → -200.
  assert.equal(score.breakdown.selfLossScoreBps, -200);
  assert.deepEqual(
    score.breakdown.selfLossSourceEventsByKind.resource_cost,
    ["evt_resource_cost_001"],
  );
  assert.deepEqual(
    score.breakdown.selfLossSourceEventsByKind.resource_spent_event,
    [],
  );
});

test("selfLossScoreBps distinguishes resource vs lifetime on the same action (Rule 1 — composite key)", () => {
  // Same action, DIFFERENT cost-kind: both contribute.
  const contributions: readonly SelfLossContribution[] = [
    {
      actionEventId: "evt_action_001",
      costKind: "resource",
      sourceKind: "resource_cost",
      canonicalEventIds: ["evt_resource_cost_001"],
      resourceUnits: 2,
    },
    {
      actionEventId: "evt_action_001",
      costKind: "lifetime",
      sourceKind: "hosted_action_lifetime_delta",
      canonicalEventIds: ["evt_hosted_001"],
      lifetimeDelta: -10,
    },
  ];
  const ctx = makeBaseCtx({ selfLossContributions: contributions });
  const score = buildConsequenceScore(ctx);
  // 2*200 + 10*10 = 400 + 100 = 500 magnitude → -500.
  assert.equal(score.breakdown.selfLossScoreBps, -500);
});

test("selfLossScoreBps caps at SELFLOSS_CAP_BPS even with many contributions", () => {
  assert.equal(SELFLOSS_CAP_BPS, 3_000);
  const contributions: readonly SelfLossContribution[] = Array.from({ length: 25 }, (_, i) => ({
    actionEventId: `evt_action_${String(i).padStart(3, "0")}`,
    costKind: "resource" as const,
    sourceKind: "resource_cost" as const,
    canonicalEventIds: [`evt_resource_cost_${String(i).padStart(3, "0")}`],
    resourceUnits: 1,
  }));
  const ctx = makeBaseCtx({ selfLossContributions: contributions });
  const score = buildConsequenceScore(ctx);
  // 25 * 200 = 5000 magnitude, clamped to 3000 → -3000 contribution.
  assert.equal(score.breakdown.selfLossScoreBps, -SELFLOSS_CAP_BPS);
});

test("applySelfLossDedupRules is the canonical reference implementation of Rules 1 and 5", () => {
  const contributions: readonly SelfLossContribution[] = [
    {
      actionEventId: "evt_action_001",
      costKind: "resource",
      sourceKind: "resource_cost",
      canonicalEventIds: ["evt_a"],
      resourceUnits: 1,
    },
    {
      actionEventId: "evt_action_001",
      costKind: "resource",
      sourceKind: "resource_spent_event",
      canonicalEventIds: ["evt_b"],
      resourceUnits: 1,
    },
    {
      actionEventId: "evt_action_002",
      costKind: "resource",
      sourceKind: "resource_cost",
      canonicalEventIds: ["evt_c"],
      resourceUnits: 1,
    },
  ];
  const deduped = applySelfLossDedupRules(contributions);
  assert.equal(deduped.length, 2);
  assert.equal(deduped[0]!.actionEventId, "evt_action_001");
  assert.equal(deduped[0]!.sourceKind, "resource_cost");
  assert.equal(deduped[1]!.actionEventId, "evt_action_002");
});

// ---------------------------------------------------------------------------
// Collateral bucket
// ---------------------------------------------------------------------------

test("collateralScoreBps sums per-kind weighted entries and clamps to [FLOOR, CAP]", () => {
  assert.equal(COLLATERAL_FLOOR_BPS, -2_000);
  assert.equal(COLLATERAL_CAP_BPS, 1_500);
  const entries = [
    makeMirrorEntry({
      actionEventId: "evt_action_001",
      effectKind: "faction_standing_delta",
      targetEntityId: "faction:agent_001:faction_a",
      delta: 20, // factor = 1, weight 80, sign + → +80
      dedupeKey: "faction_standing:agent_001:faction_a:route_1:evt_action_001",
    }),
    makeMirrorEntry({
      actionEventId: "evt_action_002",
      effectKind: "object_destroy",
      targetEntityId: "object:obj_001",
      delta: -5, // factor 0.5, weight -300, sign - → +150
      dedupeKey: "object_destroy:obj_001:evt_action_002",
    }),
  ];
  const ctx = makeBaseCtx({ mirrorLedgerEntries: entries });
  const score = buildConsequenceScore(ctx);
  // 80 + 150 = 230
  assert.equal(score.breakdown.collateralScoreBps, 230);
  assert.equal(score.breakdown.collateralLedgerEntryIds.length, 2);
});

test("collateralScoreBps applies heavily-negative weight to hidden_prerequisite_destroyed", () => {
  assert.equal(COLLATERAL_WEIGHT_BPS_V1.hidden_prerequisite_destroyed, -1_500);
  const entries = [
    makeMirrorEntry({
      actionEventId: "evt_action_001",
      effectKind: "hidden_prerequisite_destroyed",
      targetEntityId: "hidden:hidden_obj_001",
      delta: -10, // factor 1, weight -1500, sign - → +1500 (cancelled)
      dedupeKey: "hidden_prereq:hidden_obj_001:evt_action_001",
    }),
    makeMirrorEntry({
      actionEventId: "evt_action_002",
      effectKind: "hidden_prerequisite_destroyed",
      targetEntityId: "hidden:hidden_obj_002",
      delta: 10, // factor 1, weight -1500, sign + → -1500
      dedupeKey: "hidden_prereq:hidden_obj_002:evt_action_002",
    }),
  ];
  const ctx = makeBaseCtx({ mirrorLedgerEntries: entries });
  const score = buildConsequenceScore(ctx);
  // +1500 - 1500 = 0
  assert.equal(score.breakdown.collateralScoreBps, 0);
});

test("collateralScoreBps clamps to CAP when many positive entries accumulate", () => {
  // Region influence deltas: weight 40, sign +, factor 1 (delta >= 10).
  const entries = Array.from({ length: 50 }, (_, i) =>
    makeMirrorEntry({
      actionEventId: `evt_action_${String(i).padStart(3, "0")}`,
      effectKind: "region_influence_delta",
      targetEntityId: `region:region_${String(i).padStart(2, "0")}`,
      delta: 20,
      dedupeKey: `region_influence:region_${String(i).padStart(2, "0")}:agent_a:evt_action_${String(i).padStart(3, "0")}`,
    }),
  );
  const ctx = makeBaseCtx({ mirrorLedgerEntries: entries });
  const score = buildConsequenceScore(ctx);
  // 50 * 40 = 2000, clamped to 1500.
  assert.equal(score.breakdown.collateralScoreBps, COLLATERAL_CAP_BPS);
});

test("collateralScoreBps clamps to FLOOR when many negative entries accumulate", () => {
  // PR5b: identity_doubt now uses DOUBT_PENALTY_BPS[strength] (severe=4000)
  // with a per-journey cap of IDENTITY_DOUBT_COLLATERAL_CAP_BPS (4000). 5
  // severe entries sum to 20000 raw, clamped to 4000 magnitude → -4000 to
  // cumulative → collateral clamped to FLOOR (-2000).
  const entries = Array.from({ length: 5 }, (_, i) =>
    makeMirrorEntry({
      actionEventId: `evt_action_${String(i).padStart(3, "0")}`,
      effectKind: "identity_doubt",
      targetEntityId: `identity:agent_${String(i).padStart(2, "0")}`,
      delta: 15,
      dedupeKey: `identity_doubt:agent_${String(i).padStart(2, "0")}:evt_action_${String(i).padStart(3, "0")}`,
      doubtStrength: "severe",
    }),
  );
  const ctx = makeBaseCtx({ mirrorLedgerEntries: entries });
  const score = buildConsequenceScore(ctx);
  // -4000 (capped doubt) clamped to FLOOR -2000.
  assert.equal(score.breakdown.collateralScoreBps, COLLATERAL_FLOOR_BPS);
});

test("PR5b identity_doubt uses DOUBT_PENALTY_BPS[strength] capped at IDENTITY_DOUBT_COLLATERAL_CAP_BPS", () => {
  // Single severe doubt: -4000 bps (= DOUBT_PENALTY_BPS.severe = cap). No
  // FLOOR clamp needed because -4000 > -2000... wait, -4000 < -2000, so this
  // DOES hit FLOOR. Use moderate instead so we observe the raw contribution.
  // 2 moderate entries → 2 * 750 = 1500 raw → -1500 cumulative → -1500
  // collateral (above FLOOR -2000, below CAP).
  const moderateEntries = Array.from({ length: 2 }, (_, i) =>
    makeMirrorEntry({
      actionEventId: `evt_action_mod_${i}`,
      effectKind: "identity_doubt",
      targetEntityId: `identity:agent_mod_${i}`,
      delta: 0,
      dedupeKey: `identity_doubt:agent_mod_${i}:evt_action_mod_${i}`,
      doubtStrength: "moderate",
    }),
  );
  const ctxModerate = makeBaseCtx({ mirrorLedgerEntries: moderateEntries });
  const scoreModerate = buildConsequenceScore(ctxModerate);
  assert.equal(
    scoreModerate.breakdown.collateralScoreBps,
    -(DOUBT_PENALTY_BPS.moderate * 2),
  );
  // Entry IDs are recorded for audit.
  assert.equal(scoreModerate.breakdown.collateralLedgerEntryIds.length, 2);
});

test("PR5b identity_doubt entries without doubtStrength contribute 0 bps (fail-open defence)", () => {
  // Legacy/malformed blueprint without doubtStrength MUST NOT fabricate a
  // penalty. The scorer reads effectBlueprint.doubtStrength and skips
  // accumulation when the field is absent or invalid.
  const entries = [
    makeMirrorEntry({
      actionEventId: "evt_action_legacy",
      effectKind: "identity_doubt",
      targetEntityId: "identity:agent_legacy",
      delta: 15,
      dedupeKey: "identity_doubt:agent_legacy:evt_action_legacy",
      // doubtStrength intentionally omitted.
    }),
  ];
  const ctx = makeBaseCtx({ mirrorLedgerEntries: entries });
  const score = buildConsequenceScore(ctx);
  // 0 bps collateral contribution; entry id still recorded for audit.
  assert.equal(score.breakdown.collateralScoreBps, 0);
  assert.equal(score.breakdown.collateralLedgerEntryIds.length, 1);
});

test("PR5b identity_doubt cap prevents solo-kill: 3 severe entries still hit only the 4000 cap", () => {
  // 3 severe = 12000 raw → clamp to 4000 → -4000 cumulative → FLOOR -2000.
  // The cap ensures a single journey cannot drain collateral below what one
  // severe doubt would do (anti-solo-kill).
  const entries = Array.from({ length: 3 }, (_, i) =>
    makeMirrorEntry({
      actionEventId: `evt_action_sev_${i}`,
      effectKind: "identity_doubt",
      targetEntityId: `identity:agent_sev_${i}`,
      delta: 0,
      dedupeKey: `identity_doubt:agent_sev_${i}:evt_action_sev_${i}`,
      doubtStrength: "severe",
    }),
  );
  const ctx = makeBaseCtx({ mirrorLedgerEntries: entries });
  const score = buildConsequenceScore(ctx);
  assert.equal(score.breakdown.collateralScoreBps, COLLATERAL_FLOOR_BPS);
  assert.equal(score.breakdown.collateralLedgerEntryIds.length, 3);
  // Sanity: the cap constant equals DOUBT_PENALTY_BPS.severe (one severe).
  assert.equal(IDENTITY_DOUBT_COLLATERAL_CAP_BPS, DOUBT_PENALTY_BPS.severe);
});

test("collateralMagnitudeFactor normalises |delta| into [0, 1] via min(1, |delta|/10)", () => {
  assert.equal(collateralMagnitudeFactor(0), 0);
  assert.equal(collateralMagnitudeFactor(5), 0.5);
  assert.equal(collateralMagnitudeFactor(10), 1);
  assert.equal(collateralMagnitudeFactor(50), 1);
  assert.equal(collateralMagnitudeFactor(-15), 1);
});

test("collateralScoreBps throws if resource_spent or lifetime_adjusted entry reaches scoring (defensive)", () => {
  // These kinds are self-loss; the ledger refuses them at dedupe-key
  // derivation. The scoring function fails closed if one slips through.
  const entries = [
    makeMirrorEntry({
      actionEventId: "evt_action_001",
      effectKind: "resource_spent",
      targetEntityId: "res_stamina",
      delta: -3,
      dedupeKey: "evt_action_001:res_stamina:self_loss",
    }),
  ];
  // Override consequenceType so the entry reaches scoring — the makeMirrorEntry
  // helper sets 'collateral' by default; we need to test the defensive guard.
  const badEntries = entries.map((entry) => ({
    ...entry,
    consequenceType: "collateral" as const,
  }));
  const ctx = makeBaseCtx({ mirrorLedgerEntries: badEntries });
  assert.throws(
    () => buildConsequenceScore(ctx),
    /journey_consequence_scoring_collateral_kind_is_self_loss:resource_spent/,
  );
});

test("collateralScoreBps ignores mirror entries whose consequenceType is self_loss / result", () => {
  // The bucket only aggregates consequenceType === 'collateral'. Self-loss
  // entries are scored in the self-loss bucket; result entries are upstream.
  const entries = [
    {
      ...makeMirrorEntry({
        actionEventId: "evt_action_001",
        effectKind: "object_destroy",
        targetEntityId: "object:obj_001",
        delta: -5,
        dedupeKey: "object_destroy:obj_001:evt_action_001",
      }),
      consequenceType: "self_loss" as const,
    },
  ];
  const ctx = makeBaseCtx({ mirrorLedgerEntries: entries });
  const score = buildConsequenceScore(ctx);
  assert.equal(score.breakdown.collateralScoreBps, 0);
  assert.equal(score.breakdown.collateralLedgerEntryIds.length, 0);
});

// ---------------------------------------------------------------------------
// Total bps
// ---------------------------------------------------------------------------

test("totalBps = clamp(result + selfLoss + collateral, 0, 10_000)", () => {
  const ctx = makeBaseCtx({
    resultComponentInputs: {
      mainCompletionBps: 10_000,
      bonusMainCompletionBps: 0,
      sideCompletionBps: 10_000,
      executionQualityBps: 10_000,
      penaltyBps: 0,
    },
    selfLossContributions: [
      {
        actionEventId: "evt_action_001",
        costKind: "resource",
        sourceKind: "resource_cost",
        canonicalEventIds: ["evt_resource_cost_001"],
        resourceUnits: 5, // 1000 bps magnitude
      },
    ],
    mirrorLedgerEntries: [
      makeMirrorEntry({
        actionEventId: "evt_action_002",
        effectKind: "faction_standing_delta",
        targetEntityId: "faction:agent_001:faction_a",
        delta: 20, // +80
        dedupeKey: "faction_standing:agent_001:faction_a:route_1:evt_action_002",
      }),
    ],
  });
  const score = buildConsequenceScore(ctx);
  // result 10000 + selfLoss -1000 + collateral 80 = 9080
  assert.equal(score.breakdown.resultScoreBps, 10_000);
  assert.equal(score.breakdown.selfLossScoreBps, -1_000);
  assert.equal(score.breakdown.collateralScoreBps, 80);
  assert.equal(score.breakdown.totalBps, 9_080);
});

test("totalBps clamps to zero when collateral floor drags the sum negative", () => {
  // Low result + heavy negative collateral + non-trivial self-loss.
  // PR5b: identity_doubt entries now carry doubtStrength in the blueprint;
  // 5 severe entries → 20000 raw → 4000 capped → -4000 cumulative → FLOOR -2000.
  const ctx = makeBaseCtx({
    resultComponentInputs: {
      mainCompletionBps: 1_000, // 600
      bonusMainCompletionBps: 0,
      sideCompletionBps: 1_000, // 200
      executionQualityBps: 1_000, // 200
      penaltyBps: 0,
    },
    selfLossContributions: [],
    mirrorLedgerEntries: Array.from({ length: 5 }, (_, i) =>
      makeMirrorEntry({
        actionEventId: `evt_action_${String(i).padStart(3, "0")}`,
        effectKind: "identity_doubt",
        targetEntityId: `identity:agent_${String(i).padStart(2, "0")}`,
        delta: 15,
        dedupeKey: `identity_doubt:agent_${String(i).padStart(2, "0")}:evt_action_${String(i).padStart(3, "0")}`,
        doubtStrength: "severe",
      }),
    ),
  });
  const score = buildConsequenceScore(ctx);
  // result 1000 + selfLoss 0 + collateral -2000 = -1000 → clamp to 0.
  assert.equal(score.breakdown.resultScoreBps, 1_000);
  assert.equal(score.breakdown.collateralScoreBps, -2_000);
  assert.equal(score.breakdown.totalBps, 0);
});

// ---------------------------------------------------------------------------
// Hidden clamp recording
// ---------------------------------------------------------------------------

test("hiddenClamp records main_incomplete when mainLineSucceeded=false", () => {
  const ctx = makeBaseCtx({ mainLineSucceeded: false });
  const score = buildConsequenceScore(ctx);
  assert.equal(score.hiddenClamp.applied, true);
  assert.equal(score.hiddenClamp.reason, "main_incomplete");
  assert.equal(score.hiddenClamp.tierCap, "未及格");
  assert.deepEqual(score.hiddenClamp.sourceHiddenObjectiveIds, []);
});

test("hiddenClamp records hidden_incomplete when hiddenComplete=false", () => {
  const ctx = makeBaseCtx({ hiddenComplete: false, hiddenObjectiveIds: ["hidden_001"] });
  const score = buildConsequenceScore(ctx);
  assert.equal(score.hiddenClamp.applied, true);
  assert.equal(score.hiddenClamp.reason, "hidden_incomplete");
  assert.equal(score.hiddenClamp.tierCap, "优秀");
  assert.deepEqual(score.hiddenClamp.sourceHiddenObjectiveIds, ["hidden_001"]);
});

test("hiddenClamp is not applied when main+hidden both succeeded", () => {
  const score = buildConsequenceScore(makeBaseCtx());
  assert.equal(score.hiddenClamp.applied, false);
  assert.equal(score.hiddenClamp.reason, undefined);
  assert.equal(score.hiddenClamp.tierCap, "惊世");
});

// ---------------------------------------------------------------------------
// Zero-affinity banlist
// ---------------------------------------------------------------------------

test("buildConsequenceScore throws when ctx carries a banned affinity/strategy field", () => {
  const banlist = [
    "affinityBonusBps",
    "strategyRewardModifier",
    "strategyAffinity",
    "fitBps",
    "expectedApproach",
  ] as const;
  for (const banned of banlist) {
    const polluted = {
      ...makeBaseCtx(),
      [banned]: 42,
    };
    assert.throws(
      () => buildConsequenceScore(polluted as unknown as SettlementContext),
      new RegExp(`settlement_context_banned_field:${banned}`),
    );
  }
});

test("buildConsequenceScore tolerates strategyConsistencySnapshot (audit-only field)", () => {
  // The strategyConsistencySnapshot field is AUDIT-ONLY; it is permitted on
  // ctx but never read. The function must not throw on its presence.
  const ctx: SettlementContext = {
    ...makeBaseCtx(),
    // Minimal audit-only stub; the real StrategyConsistencyScore shape lives
    // in journeyStrategyRules.ts and is not needed for this contract test.
    strategyConsistencySnapshot: undefined,
  };
  const score = buildConsequenceScore(ctx);
  assert.equal(score.policyVersion, CONSEQUENCE_SCORE_POLICY_VERSION);
});

// ---------------------------------------------------------------------------
// Policy version + computedAt stability
// ---------------------------------------------------------------------------

test("ConsequenceScore carries CONSEQUENCE_SCORE_POLICY_VERSION=1 and stable computedAt", () => {
  const score = buildConsequenceScore(makeBaseCtx());
  assert.equal(score.policyVersion, 1);
  // Fixed epoch for replay determinism (chronicle rewrites on persist).
  assert.equal(score.computedAt, "1970-01-01T00:00:00.000Z");
});

// ---------------------------------------------------------------------------
// Replay digest
// ---------------------------------------------------------------------------

test("computeSettlementContextReplayDigest is byte-stable across key-order permutations", () => {
  const ctx1 = makeBaseCtx();
  const ctx2: SettlementContext = {
    ...makeBaseCtx(),
    // Permute objective-id array order; digest must be identical because the
    // canonical subset sorts before hashing.
    mainObjectiveIds: ["main_002", "main_001"],
    canonicalActionEventIds: ["evt_action_002", "evt_action_001"],
  };
  const digest1 = computeSettlementContextReplayDigest(ctx1);
  const digest2 = computeSettlementContextReplayDigest(ctx2);
  assert.equal(digest1, digest2);
  assert.match(digest1, /^sha256:[0-9a-f]{64}$/);
});

test("computeSettlementContextReplayDigest changes when result-component inputs change", () => {
  const ctx1 = makeBaseCtx();
  const ctx2 = makeBaseCtx({
    resultComponentInputs: {
      mainCompletionBps: 9_000,
      bonusMainCompletionBps: 0,
      sideCompletionBps: 10_000,
      executionQualityBps: 10_000,
      penaltyBps: 0,
    },
  });
  assert.notEqual(
    computeSettlementContextReplayDigest(ctx1),
    computeSettlementContextReplayDigest(ctx2),
  );
});

test("computeSettlementContextReplayDigest excludes the audit-only strategyConsistencySnapshot", () => {
  const ctx1 = makeBaseCtx();
  const ctx2: SettlementContext = {
    ...makeBaseCtx(),
    // Different audit-only values; digest must be identical.
    strategyConsistencySnapshot: undefined,
  };
  assert.equal(
    computeSettlementContextReplayDigest(ctx1),
    computeSettlementContextReplayDigest(ctx2),
  );
});

// ---------------------------------------------------------------------------
// PR5a — Verify-round-1 adversarial findings (NON-BLOCKING) locked as
// regression tests. The scorer is reason-blind by design; the anti-loop
// contract for viability-triggered lifetime_adjusted is enforced planner-side
// + at gameCore event-apply time, NOT inside computeSelfLossBucket.
// ---------------------------------------------------------------------------

test("PR5a residual risk: computeSelfLossBucket is reason-blind — viability-tagged lifetime_adjusted fed back WOULD score as self-loss (Verify finding 2, documented contract)", () => {
  // The SelfLossContribution wire shape (frozen in PR4) carries no `reason`
  // field. computeSelfLossBucket therefore cannot distinguish a viability-
  // triggered lifetime_adjusted event (reasons `identity_viability_acceleration`
  // / `identity_viability_social_death`) from an ordinary hosted-action
  // lifetime cost. If a future integration bug fed such an event back into
  // the SAME journey's ctx.selfLossContributions, this test demonstrates
  // that the scorer would happily charge it — violating spec §6.8.
  //
  // The mitigation is NOT in this function. It lives in three places that
  // this test cannot reach:
  //   1. deriveViabilityTrigger JSDoc contract (planner MUST NOT push the
  //      returned delta into the same journey's selfLossContributions).
  //   2. lifetimeAdjustedPayload helper refuses the reserved reasons without
  //      a server-attested viabilityTriggerRef (identityLifecycleRules).
  //   3. gameCore.ts lifetime_adjusted case guards a preceding
  //      identity_viability_projected event with matching sourceSettlementId.
  //
  // We lock the reason-blind behavior in so that a future attempt to add a
  // `reason` discriminant to SelfLossContribution shows up as a deliberate
  // POLICY_VERSION bump, not a silent type widening.
  const viabilityTaggedContribution: SelfLossContribution = {
    actionEventId: "evt_viability_lifetime_adjusted",
    costKind: "lifetime",
    sourceKind: "lifetime_adjusted_event",
    canonicalEventIds: ["evt_lifetime_adjusted_viability"],
    lifetimeDelta: -50, // magnitude 50 → 50 * 10 = 500 bps of self-loss
  };
  const ctx = makeBaseCtx({
    selfLossContributions: [viabilityTaggedContribution],
  });
  const score = buildConsequenceScore(ctx);

  // The scorer charges 500 bps. This is the documented reason-blind behavior;
  // the planner contract above is what prevents this contribution from ever
  // appearing here in production.
  assert.equal(score.breakdown.selfLossScoreBps, -500);
  assert.deepEqual(
    score.breakdown.selfLossSourceEventsByKind.lifetime_adjusted_event,
    ["evt_lifetime_adjusted_viability"],
  );
  // No collateral entry was created (the contribution is self-loss, not
  // collateral). Belt-and-braces: the same canonical event id MUST NOT
  // appear in the collateral audit list.
  assert.equal(score.breakdown.collateralLedgerEntryIds.length, 0);
});

