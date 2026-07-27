/**
 * journeyConsequenceRules.test.ts — PR4 coverage for the additive-bucket
 * scoring + settlement decision.
 *
 * Tests:
 *  - result / selfLoss / collateral each traceable to source inputs
 *  - selfLoss dedup rules (Rule 1 + Rule 5)
 *  - settleJourney idempotency (replaySettlement byte-equal)
 *  - zero-affinity invariant: mutating affinity / strategy inputs cannot
 *    change the score
 *  - tier boundary table (3999/4000/5499/5500/6999/7000/8499/8500)
 *  - main-incomplete clamp + hidden-incomplete clamp
 *  - canon threshold + worldCommit reason derivation
 *  - reward modifier floor/cap + item rarity bump cap
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildConsequenceScore,
  applySelfLossDedupRules,
  computeSettlementContextReplayDigest,
  COLLATERAL_WEIGHT_BPS_V1,
  RESOURCE_SELFLOSS_BPS_PER_UNIT,
  LIFETIME_SELFLOSS_BPS_PER_POINT,
} from "../lib/epoch/journeyConsequenceScoring.ts";
import {
  deriveSettlementDecision,
  deriveSettlementId,
  replaySettlement,
  TIER_THRESHOLDS_V1,
  ITEM_RARITY_BOOST_THRESHOLD_BPS,
  REWARD_MULTIPLIER_FLOOR_BPS,
  REWARD_MULTIPLIER_CAP_BPS,
} from "../lib/epoch/journeySettlementDecision.ts";
import {
  CANON_THRESHOLD_BPS,
  SETTLEMENT_POLICY_VERSION,
  CONSEQUENCE_SCORE_POLICY_VERSION,
  type BaseRewardBundle,
  type MirrorConsequenceLedgerEntry,
  type ResultComponentInputs,
  type SelfLossContribution,
  type SettlementContext,
} from "../lib/epoch/journeySettlementRules.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const EMPTY_BREAKDOWN: ResultComponentInputs = {
  mainCompletionBps: 0,
  bonusMainCompletionBps: 0,
  sideCompletionBps: 0,
  executionQualityBps: 0,
  penaltyBps: 0,
};

const EMPTY_BASE_BUNDLE: BaseRewardBundle = {
  baseBundleRef: "test:base",
  resources: { coin: 100 },
  items: [{ itemId: "test_item", quantity: 1, baseRarityTier: 1 }],
};

function makeCtx(overrides: Partial<SettlementContext> = {}): SettlementContext {
  return {
    journeyId: "journey_test_001",
    mainObjectiveIds: ["main_1"],
    sideObjectiveIds: [],
    hiddenObjectiveIds: [],
    mainLineSucceeded: true,
    hiddenComplete: true,
    actionResolutions: [],
    selfLossSourceEventsByKind: {
      resource_cost: [],
      resource_spent_event: [],
      hosted_action_lifetime_delta: [],
      lifetime_adjusted_event: [],
    },
    mirrorLedgerEntries: [],
    canonicalActionEventIds: [],
    resultComponentInputs: EMPTY_BREAKDOWN,
    selfLossContributions: [],
    baseRewardBundle: EMPTY_BASE_BUNDLE,
    policyVersion: SETTLEMENT_POLICY_VERSION,
    ...overrides,
  };
}

function withResultInputs(
  ctx: SettlementContext,
  mainBps: number,
  sideBps: number = 10_000,
  execBps: number = 10_000,
  penaltyBps: number = 0,
): SettlementContext {
  return {
    ...ctx,
    resultComponentInputs: {
      mainCompletionBps: mainBps,
      bonusMainCompletionBps: 0,
      sideCompletionBps: sideBps,
      executionQualityBps: execBps,
      penaltyBps,
    },
  };
}

// ---------------------------------------------------------------------------
// Scoring module tests
// ---------------------------------------------------------------------------

test("buildConsequenceScore: zero-affinity / zero-strategy invariant", () => {
  const ctx = makeCtx();
  const score = buildConsequenceScore(ctx);
  // result bucket: 0 inputs → 0 resultScoreBps
  assert.equal(score.breakdown.resultScoreBps, 0);
  assert.equal(score.breakdown.selfLossScoreBps, 0);
  assert.equal(score.breakdown.collateralScoreBps, 0);
  assert.equal(score.breakdown.totalBps, 0);
  assert.equal(score.mainLineSucceeded, true);
  assert.equal(score.hiddenComplete, true);
  assert.equal(score.hiddenClamp.applied, false);
});

test("buildConsequenceScore: main-line failure forces HiddenClamp to 未及格", () => {
  const ctx = makeCtx({ mainLineSucceeded: false });
  const score = buildConsequenceScore(ctx);
  assert.equal(score.hiddenClamp.applied, true);
  assert.equal(score.hiddenClamp.tierCap, "未及格");
  assert.equal(score.hiddenClamp.reason, "main_incomplete");
});

test("buildConsequenceScore: hidden-incomplete forces clamp to 优秀", () => {
  const ctx = makeCtx({ hiddenComplete: false });
  const score = buildConsequenceScore(ctx);
  assert.equal(score.hiddenClamp.applied, true);
  assert.equal(score.hiddenClamp.tierCap, "优秀");
  assert.equal(score.hiddenClamp.reason, "hidden_incomplete");
});

test("buildConsequenceScore: result bucket is clamped to [0, 10000]", () => {
  const highCtx = withResultInputs(makeCtx(), 10_000, 10_000, 10_000);
  const score = buildConsequenceScore(highCtx);
  assert.equal(score.breakdown.resultScoreBps, 10_000);
  assert.equal(score.breakdown.totalBps, 10_000);
});

test("buildConsequenceScore: penalty reduces result bucket", () => {
  const ctx = withResultInputs(makeCtx(), 10_000, 10_000, 10_000, 1_000);
  const score = buildConsequenceScore(ctx);
  assert.equal(score.breakdown.resultScoreBps, 9_000);
});

// ---------------------------------------------------------------------------
// Self-loss dedup
// ---------------------------------------------------------------------------

test("applySelfLossDedupRules: Rule 1 dedupes by (actionEventId, costKind)", () => {
  const contributions: SelfLossContribution[] = [
    {
      actionEventId: "action_1",
      costKind: "resource",
      sourceKind: "resource_cost",
      canonicalEventIds: ["ev_1"],
      resourceUnits: 5,
    },
    {
      actionEventId: "action_1",
      costKind: "resource",
      sourceKind: "resource_spent_event",
      canonicalEventIds: ["ev_2"],
      resourceUnits: 5,
    },
  ];
  const deduped = applySelfLossDedupRules(contributions);
  assert.equal(deduped.length, 1, "same (actionEventId, costKind) tuple deduped");
});

test("applySelfLossDedupRules: Rule 5 keeps both cost kinds", () => {
  const contributions: SelfLossContribution[] = [
    {
      actionEventId: "action_1",
      costKind: "resource",
      sourceKind: "resource_cost",
      canonicalEventIds: ["ev_1"],
      resourceUnits: 5,
    },
    {
      actionEventId: "action_1",
      costKind: "lifetime",
      sourceKind: "lifetime_adjusted_event",
      canonicalEventIds: ["ev_2"],
      lifetimeDelta: -10,
    },
  ];
  const deduped = applySelfLossDedupRules(contributions);
  assert.equal(deduped.length, 2, "different costKinds survive dedup");
});

test("self-loss magnitude: resource_units * BPS_PER_UNIT", () => {
  const ctx = makeCtx({
    selfLossContributions: [
      {
        actionEventId: "action_1",
        costKind: "resource",
        sourceKind: "resource_cost",
        canonicalEventIds: ["ev_1"],
        resourceUnits: 5,
      },
    ],
  });
  const score = buildConsequenceScore(ctx);
  const expectedMagnitude = 5 * RESOURCE_SELFLOSS_BPS_PER_UNIT;
  assert.equal(score.breakdown.selfLossScoreBps, -expectedMagnitude);
});

test("self-loss magnitude: lifetime_delta only counts negative magnitude", () => {
  const ctx = makeCtx({
    selfLossContributions: [
      {
        actionEventId: "action_1",
        costKind: "lifetime",
        sourceKind: "lifetime_adjusted_event",
        canonicalEventIds: ["ev_1"],
        lifetimeDelta: 10, // gain, not loss → must NOT offset
      },
    ],
  });
  const score = buildConsequenceScore(ctx);
  assert.equal(score.breakdown.selfLossScoreBps, 0, "positive lifetime does not offset");
});

// ---------------------------------------------------------------------------
// Settlement decision tier boundaries
// ---------------------------------------------------------------------------

test("deriveSettlementDecision: tier boundary table", () => {
  const testCases: ReadonlyArray<readonly [number, "未及格" | "及格" | "良好" | "优秀" | "惊世"]> = [
    [3_999, "未及格"],
    [4_000, "及格"],
    [5_499, "及格"],
    [5_500, "良好"],
    [6_999, "良好"],
    [7_000, "优秀"],
    [8_499, "优秀"],
    [8_500, "惊世"],
  ];
  for (const [totalBps, expectedTier] of testCases) {
    const ctx = withResultInputs(makeCtx(), totalBps);
    // Override resultComponentInputs with a synthetic that yields exactly
    // totalBps by setting mainCompletionBps to totalBps * (1/0.6).
    const syntheticCtx: SettlementContext = {
      ...ctx,
      resultComponentInputs: {
        mainCompletionBps: Math.round(totalBps / 0.6),
        bonusMainCompletionBps: 0,
        sideCompletionBps: 0,
        executionQualityBps: 0,
        penaltyBps: 0,
      },
    };
    const score = buildConsequenceScore(syntheticCtx);
    const decision = deriveSettlementDecision(syntheticCtx, score);
    assert.equal(
      decision.tier,
      expectedTier,
      `totalBps=${totalBps} should map to tier=${expectedTier} (got ${decision.tier}, score breakdown total=${score.breakdown.totalBps})`,
    );
  }
});

test("deriveSettlementDecision: main-incomplete forces 未及格 even at high score", () => {
  const ctx = {
    ...withResultInputs(makeCtx(), 10_000, 10_000, 10_000),
    mainLineSucceeded: false,
  };
  const score = buildConsequenceScore(ctx);
  const decision = deriveSettlementDecision(ctx, score);
  assert.equal(decision.tier, "未及格");
  assert.equal(decision.worldCommit.status, "discarded");
  assert.equal(decision.worldCommit.reason, "main_incomplete");
});

test("deriveSettlementDecision: hidden-incomplete caps tier at 优秀", () => {
  const ctx = {
    ...withResultInputs(makeCtx(), 10_000, 10_000, 10_000),
    hiddenComplete: false,
  };
  const score = buildConsequenceScore(ctx);
  const decision = deriveSettlementDecision(ctx, score);
  assert.equal(decision.tier, "优秀");
  assert.equal(decision.worldCommit.status, "solidified");
  assert.equal(decision.worldCommit.reason, "main_completed_and_above_threshold");
});

test("惊世 requires hiddenComplete=true AND totalBps>=8500", () => {
  const ctx = withResultInputs(makeCtx({ hiddenComplete: true }), 10_000, 10_000, 10_000);
  const score = buildConsequenceScore(ctx);
  const decision = deriveSettlementDecision(ctx, score);
  assert.equal(decision.tier, "惊世");
});

// ---------------------------------------------------------------------------
// World commit canon threshold
// ---------------------------------------------------------------------------

test("worldCommit: low-score discard with 'below_canon_threshold'", () => {
  const ctx = withResultInputs(makeCtx(), 5_000); // score in 及格 range, below canon
  const score = buildConsequenceScore(ctx);
  const decision = deriveSettlementDecision(ctx, score);
  assert.equal(decision.worldCommit.status, "discarded");
  assert.equal(decision.worldCommit.canonEligible, false);
  assert.equal(decision.worldCommit.reason, "below_canon_threshold");
  assert.equal(decision.worldCommit.thresholdBps, CANON_THRESHOLD_BPS);
  assert.equal(decision.worldCommit.policyVersion, SETTLEMENT_POLICY_VERSION);
});

test("worldCommit: threshold-meeting solidify", () => {
  const ctx = withResultInputs(makeCtx(), 10_000, 10_000, 10_000);
  const score = buildConsequenceScore(ctx);
  const decision = deriveSettlementDecision(ctx, score);
  assert.equal(decision.worldCommit.status, "solidified");
  assert.equal(decision.worldCommit.canonEligible, true);
  assert.equal(decision.worldCommit.reason, "main_completed_and_above_threshold");
});

// ---------------------------------------------------------------------------
// Reward policy
// ---------------------------------------------------------------------------

test("reward: 未及格 tier produces no grant resources", () => {
  const ctx = {
    ...withResultInputs(makeCtx(), 1_000),
    mainLineSucceeded: false,
  };
  const score = buildConsequenceScore(ctx);
  const decision = deriveSettlementDecision(ctx, score);
  assert.equal(decision.tier, "未及格");
  assert.equal(Object.keys(decision.reward.resourceGrants).length, 0);
  assert.equal(decision.reward.itemGrants.length, 0);
});

test("reward: multiplier floored at 0.5x (5000 bps) at totalBps=4000", () => {
  // totalBps=4000 lands at the 及格/未及格 boundary (TIER_THRESHOLDS_V1.未及格_MAX).
  // mainCompletionBps=6667 with weight 0.6 yields resultScoreBps≈4000.
  const ctx = makeCtx({
    mainLineSucceeded: true,
    hiddenComplete: true,
    resultComponentInputs: {
      mainCompletionBps: 6_667,
      bonusMainCompletionBps: 0,
      sideCompletionBps: 0,
      executionQualityBps: 0,
      penaltyBps: 0,
    },
  });
  const score = buildConsequenceScore(ctx);
  const decision = deriveSettlementDecision(ctx, score);
  assert.equal(decision.tier, "及格");
  assert.equal(score.breakdown.totalBps, 4_000);
  assert.equal(decision.reward.modifier.multiplierBps, REWARD_MULTIPLIER_FLOOR_BPS);
});

test("reward: multiplier capped at 1.5x (15000 bps) at score=10000", () => {
  const ctx = withResultInputs(makeCtx(), 10_000, 10_000, 10_000);
  const score = buildConsequenceScore(ctx);
  const decision = deriveSettlementDecision(ctx, score);
  assert.equal(decision.reward.modifier.multiplierBps, REWARD_MULTIPLIER_CAP_BPS);
});

test("reward: resource floor protects base amount when multiplier <1x", () => {
  // totalBps=4000 (及格) → multiplier=5000 (0.5x). scaled = floor(100 * 5000 /
  // 10000) = 50; floor invariant max(base=100, scaled=50) = 100.
  const ctx = makeCtx({
    baseRewardBundle: {
      baseBundleRef: "test:base",
      resources: { coin: 100 },
      items: [],
    },
    resultComponentInputs: {
      mainCompletionBps: 6_667,
      bonusMainCompletionBps: 0,
      sideCompletionBps: 0,
      executionQualityBps: 0,
      penaltyBps: 0,
    },
  });
  const score = buildConsequenceScore(ctx);
  const decision = deriveSettlementDecision(ctx, score);
  assert.equal(decision.tier, "及格");
  assert.equal(decision.reward.resourceGrants.coin, 100);
});

test("reward: negativeRewardForbidden is the permanent invariant", () => {
  const ctx = withResultInputs(makeCtx(), 5_000);
  const score = buildConsequenceScore(ctx);
  const decision = deriveSettlementDecision(ctx, score);
  assert.equal(decision.reward.negativeRewardForbidden, true);
});

// ---------------------------------------------------------------------------
// Idempotency
// ---------------------------------------------------------------------------

test("settlement idempotency: re-derivation byte-equal", () => {
  const ctx = withResultInputs(makeCtx(), 8_000, 8_000, 8_000);
  const score = buildConsequenceScore(ctx);
  const decision1 = deriveSettlementDecision(ctx, score);
  // Re-derive via replaySettlement — should not throw
  replaySettlement(decision1, ctx);
});

test("settlement idempotency: divergent score throws", () => {
  const ctx = withResultInputs(makeCtx(), 8_000, 8_000, 8_000);
  const score = buildConsequenceScore(ctx);
  const decision = deriveSettlementDecision(ctx, score);
  // Mutate the persisted decision to introduce drift
  const drifted: typeof decision = {
    ...decision,
    tier: "未及格",
  };
  assert.throws(() => replaySettlement(drifted, ctx), /settlement_replay_divergence/);
});

test("settlement idempotency: settlementId is deterministic per journey", () => {
  const journeyId = "journey_test_deterministic";
  const id1 = deriveSettlementId(journeyId);
  const id2 = deriveSettlementId(journeyId);
  assert.equal(id1, id2);
  assert.match(id1, /settlement:journey_test_deterministic:v1$/);
});

// ---------------------------------------------------------------------------
// Zero-affinity / zero-strategy invariant (Rule 0)
// ---------------------------------------------------------------------------

test("zero-affinity invariant: ctx with banned field throws", () => {
  // The ctx shape is enforced via a runtime banlist. Constructing a ctx with
  // a banned field attached MUST throw inside buildConsequenceScore.
  const ctx = makeCtx() as SettlementContext & { affinityBonusBps?: number };
  ctx.affinityBonusBps = 500;
  assert.throws(() => buildConsequenceScore(ctx), /settlement_context_banned_field/);
});

test("canonical replay digest is byte-stable", () => {
  const ctx1 = withResultInputs(makeCtx(), 7_000, 7_000, 7_000);
  const ctx2 = withResultInputs(makeCtx(), 7_000, 7_000, 7_000);
  const digest1 = computeSettlementContextReplayDigest(ctx1);
  const digest2 = computeSettlementContextReplayDigest(ctx2);
  assert.equal(digest1, digest2);
});

// ---------------------------------------------------------------------------
// Collateral bucket weights
// ---------------------------------------------------------------------------

test("collateral bucket: object_mutation contributes positive weight", () => {
  const entry: MirrorConsequenceLedgerEntry = {
    actionEventId: "action_1",
    effectKind: "object_mutation",
    targetEntityId: "obj_1",
    delta: 10, // positive delta + positive weight → positive contribution
    consequenceType: "collateral",
    sourceEventIds: ["ev_1"],
    effectBlueprint: {},
    recordedAt: "1970-01-01T00:00:00.000Z",
    dedupeKey: "dk_1",
  };
  const ctx = makeCtx({ mirrorLedgerEntries: [entry] });
  const score = buildConsequenceScore(ctx);
  const expectedContribution = COLLATERAL_WEIGHT_BPS_V1.object_mutation * Math.sign(10) * Math.min(1, Math.abs(10) / 10);
  assert.equal(score.breakdown.collateralScoreBps, Math.round(expectedContribution));
});

test("collateral bucket: resource_spent kind is rejected at scoring", () => {
  const entry: MirrorConsequenceLedgerEntry = {
    actionEventId: "action_1",
    effectKind: "resource_spent",
    targetEntityId: "res_1",
    delta: -5,
    consequenceType: "collateral",
    sourceEventIds: ["ev_1"],
    effectBlueprint: {},
    recordedAt: "1970-01-01T00:00:00.000Z",
    dedupeKey: "dk_1",
  };
  const ctx = makeCtx({ mirrorLedgerEntries: [entry] });
  assert.throws(() => buildConsequenceScore(ctx), /collateral_kind_is_self_loss/);
});
