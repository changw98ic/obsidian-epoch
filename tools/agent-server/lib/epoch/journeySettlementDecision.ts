/**
 * journeySettlementDecision.ts — PR4 pure settlement decision derivation.
 *
 * Single responsibility: turn a {@link ConsequenceScore} (produced by
 * `journeyConsequenceScoring.ts`) into a frozen {@link SettlementDecision}.
 * Tier, reward, and world-commit are all derived here exactly once; downstream
 * layers (chronicle, reward grantor, world commit, identity projection) only
 * READ the artifacts produced here.
 *
 * Hard constraints enforced here:
 * - **Pure function.** No IO, no eventFactory, no gameCore imports.
 * - **Single derivation.** Tier / reward / worldCommit / replayDigest are
 *   all derived inside {@link deriveSettlementDecision}. No other module may
 *   re-derive any of these.
 * - **Physical verdict floor.** `mainLineSucceeded === false` forces tier
 *   `未及格` via the {@link HiddenClamp} cap; the additive score cannot
 *   rescue it.
 * - **Zero-affinity / zero-strategy.** The reward modifier is derived from
 *   the score's `totalBps` only; the audit-only `strategyConsistencySnapshot`
 *   on the ctx is structurally ignored.
 * - **Replay determinism.** {@link replaySettlement} re-derives from
 *   `(persisted, ctx)` and asserts byte-equal tier / reward / worldCommit.
 *   Divergence throws `settlement_replay_divergence` with the diffing field.
 */

import {
  CANON_THRESHOLD_BPS,
  SETTLEMENT_POLICY_VERSION,
  type BaseRewardBundle,
  type ConsequenceScore,
  type HiddenClamp,
  type RewardGrant,
  type RewardModifier,
  type SettlementContext,
  type SettlementDecision,
  type SettlementTier,
  type WorldCommitDecision,
} from "./journeySettlementRules.ts";
import {
  buildConsequenceScore,
  computeSettlementContextReplayDigest,
} from "./journeyConsequenceScoring.ts";

// ---------------------------------------------------------------------------
// Versioned placeholder constants (Step 16 tunes; bumping ships as a
// SETTLEMENT_POLICY_VERSION bump → replaySettlement divergence detection).
// ---------------------------------------------------------------------------

/**
 * Tier-threshold placeholder table, versioned via
 * {@link SETTLEMENT_POLICY_VERSION}. Maps totalBps to a tier:
 * - `< 4000` (or `!mainLineSucceeded`) → `未及格`
 * - `4000 ..< 5500` → `及格`
 * - `5500 ..< 7000` → `良好`
 * - `7000 ..< 8500` → `优秀`
 * - `>= 8500` AND `hiddenComplete` → `惊世`
 *
 * `完美` is intentionally absent from the canonical tier vocabulary.
 */
export const TIER_THRESHOLDS_V1 = Object.freeze({
  未及格_MAX: 4_000,
  及格_MAX: 5_500,
  良好_MAX: 7_000,
  优秀_MAX: 8_500,
  惊世_MIN: 8_500,
} as const);

/**
 * Threshold above which the reward modifier bumps item rarity one step within
 * the tier's allowed cap. Placeholder tuned in Step 16.
 */
export const ITEM_RARITY_BOOST_THRESHOLD_BPS = 12_000 as const;

/** Lower clamp on the reward multiplier (0.5x). */
export const REWARD_MULTIPLIER_FLOOR_BPS = 5_000 as const;

/** Upper clamp on the reward multiplier (1.5x). */
export const REWARD_MULTIPLIER_CAP_BPS = 15_000 as const;

/**
 * Reference score for the multiplier's neutral point (1.0x). At
 * `totalBps === 4000` the linear map yields `multiplierBps === 5000` (the
 * floor); at `totalBps === 10000` it yields `multiplierBps === 15000` (the
 * cap). The slope is `10000 / 6000`.
 */
export const REWARD_MULTIPLIER_NEUTRAL_TOTAL_BPS = 4_000 as const;

/**
 * Per-tier base item rarity (numeric form, matches {@link BaseRewardBundle.items.baseRarityTier}):
 * - `及格` → 0 (no item)
 * - `良好` → 1 (common)
 * - `优秀` → 2 (rare)
 * - `惊世` → 3 (legendary)
 *
 * `未及格` is excluded because no reward is granted at that tier.
 */
export const ITEM_RARITY_BY_TIER: Readonly<Record<Exclude<SettlementTier, "未及格">, 0 | 1 | 2 | 3>> = Object.freeze({
  及格: 0,
  良好: 1,
  优秀: 2,
  惊世: 3,
});

/** Maximum allowed rarity per tier (the bump rule cannot exceed this). */
export const ITEM_RARITY_CAP_BY_TIER: Readonly<Record<Exclude<SettlementTier, "未及格">, 0 | 1 | 2 | 3>> = Object.freeze({
  及格: 0,
  良好: 1,
  优秀: 2,
  惊世: 3,
});

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function clamp(value: number, floor: number, ceil: number): number {
  if (!Number.isFinite(value)) return floor;
  if (value < floor) return floor;
  if (value > ceil) return ceil;
  return value;
}

/**
 * Apply the {@link HiddenClamp} to a raw tier. Returns the effective tier
 * after clamping. The clamp is the only mechanism that may downgrade a tier
 * after the additive score is computed.
 *
 * Hard constraints:
 * - Main-line failure: tier capped at `未及格` regardless of additive score.
 * - Hidden objective set incomplete: tier capped at `优秀` (no `惊世`).
 *
 * The clamp respects the {@link HiddenClamp.tierCap} recorded on the score
 * (single-derivation invariant: the clamp is computed in
 * `journeyConsequenceScoring.ts` and consumed here read-only).
 */
function applyHiddenClamp(tier: SettlementTier, hiddenClamp: HiddenClamp): SettlementTier {
  if (!hiddenClamp.applied) return tier;
  const capRank = tierRank(hiddenClamp.tierCap);
  const tierRankValue = tierRank(tier);
  if (tierRankValue <= capRank) return tier;
  return hiddenClamp.tierCap;
}

function tierRank(tier: SettlementTier): number {
  switch (tier) {
    case "未及格": return 0;
    case "及格": return 1;
    case "良好": return 2;
    case "优秀": return 3;
    case "惊世": return 4;
    default: {
      const _exhaustive: never = tier;
      throw new Error(`unhandled_settlement_tier:${String(_exhaustive)}`);
    }
  }
}

/**
 * Map a `totalBps` value to a raw {@link SettlementTier} via the placeholder
 * {@link TIER_THRESHOLDS_V1} table. Hidden-complete gating for `惊世` is
 * enforced here: a score `>= 惊世_MIN` without `hiddenComplete` lands at
 * `优秀`. The {@link HiddenClamp} then no-ops because the score is already
 * at or below its cap.
 *
 * `mainLineSucceeded === false` always maps to `未及格` here as a belt-and-
 * braces floor on top of the clamp (the clamp is the documented mechanism;
 * this catch prevents a fabricated score from leaking past).
 */
function deriveRawTier(totalBps: number, mainLineSucceeded: boolean, hiddenComplete: boolean): SettlementTier {
  if (!mainLineSucceeded) return "未及格";
  if (totalBps < TIER_THRESHOLDS_V1.未及格_MAX) return "未及格";
  if (totalBps < TIER_THRESHOLDS_V1.及格_MAX) return "及格";
  if (totalBps < TIER_THRESHOLDS_V1.良好_MAX) return "良好";
  if (totalBps < TIER_THRESHOLDS_V1.优秀_MAX) return "优秀";
  // totalBps >= 惊世_MIN
  return hiddenComplete ? "惊世" : "优秀";
}

/**
 * Compute the reward modifier (multiplier + reason) from `totalBps`. The
 * multiplier is a linear map of `totalBps` into `[5000, 15000]` bps
 * (i.e. `[0.5x, 1.5x]`); the linear map is anchored at
 * `totalBps === 4000` → `5000` and saturates at `totalBps === 10000` →
 * `15000`.
 *
 * The modifier reads ONLY `totalBps`. Affinity / strategy / expectedApproach
 * are forbidden by the banlist on {@link SettlementContext} (enforced in
 * `journeyConsequenceScoring.ts`).
 *
 * Returned `modifierBps` is the absolute delta over 1.0x (i.e.
 * `multiplierBps - 10_000`); the field exists for chronicle readability.
 */
function deriveRewardModifier(totalBps: number): RewardModifier {
  const slope = 10_000 / 6_000; // 10000 / (10000 - 4000)
  const raw = REWARD_MULTIPLIER_FLOOR_BPS
    + (totalBps - REWARD_MULTIPLIER_NEUTRAL_TOTAL_BPS) * slope;
  const multiplierBps = clamp(Math.round(raw), REWARD_MULTIPLIER_FLOOR_BPS, REWARD_MULTIPLIER_CAP_BPS);
  return {
    modifierBps: multiplierBps - 10_000,
    multiplierBps,
    reason: "strategy_score_modifier",
  };
}

/**
 * Bump item rarity one step within the tier's allowed cap, iff the modifier
 * multiplier exceeds {@link ITEM_RARITY_BOOST_THRESHOLD_BPS}. The bump never
 * crosses the tier's cap (e.g. `优秀` cannot reach `legendary`).
 */
function bumpItemRarity(
  baseRarity: 0 | 1 | 2 | 3,
  tier: Exclude<SettlementTier, "未及格">,
  multiplierBps: number,
): 0 | 1 | 2 | 3 {
  const cap = ITEM_RARITY_CAP_BY_TIER[tier];
  const clamped = Math.min(baseRarity, cap);
  if (multiplierBps < ITEM_RARITY_BOOST_THRESHOLD_BPS) {
    return rarityFromInt(clamped);
  }
  if (baseRarity >= cap) return cap;
  return rarityFromInt(Math.min(baseRarity + 1, cap));
}

function rarityFromInt(value: number): 0 | 1 | 2 | 3 {
  if (value <= 0) return 0;
  if (value === 1) return 1;
  if (value === 2) return 2;
  return 3;
}

/**
 * Derive the {@link RewardGrant} from (tier, score, baseBundle, journeyId).
 *
 * Rules (PR4 rewardPolicy):
 * - `未及格` → no grant (caller does not call this function; this function
 *   throws so the contract is enforced at the type level).
 * - `resourceGrants[rId] = max(base.amount, floor(base.amount * multiplier / 10000))`
 *   so the floor invariant holds: multiplier `<1x` cannot reduce below base.
 * - All amounts are non-negative ({@link RewardGrant.negativeRewardForbidden}
 *   is the permanent contract invariant).
 * - Item rarity = `bumpItemRarity(baseRarity, tier, multiplier)`; quantity
 *   is unchanged.
 * - Idempotency key = `${journeyId}:${settlementId}:reward` so the grantor
 *   collapses duplicate calls.
 */
function deriveRewardGrant(
  tier: SettlementTier,
  score: ConsequenceScore,
  baseBundle: BaseRewardBundle,
  journeyId: string,
  settlementId: string,
): RewardGrant {
  if (tier === "未及格") {
    throw new Error("journey_settlement_reward_called_for_failed_tier");
  }
  const modifier = deriveRewardModifier(score.breakdown.totalBps);
  const resourceGrants: Record<string, number> = {};
  for (const [resourceId, baseAmount] of Object.entries(baseBundle.resources)) {
    const scaled = Math.floor((baseAmount * modifier.multiplierBps) / 10_000);
    // Floor protects the "reward >= tier base" invariant: multiplier <1x
    // cannot reduce below base. Negative rewards are forbidden by the
    // max() (base is non-negative by contract).
    resourceGrants[resourceId] = Math.max(baseAmount, scaled);
  }
  const itemGrants = baseBundle.items.map((item) => {
    const rarity = bumpItemRarity(item.baseRarityTier, tier, modifier.multiplierBps);
    return {
      itemId: item.itemId,
      quantity: item.quantity,
      rarityTier: rarity,
    };
  });
  return {
    tier,
    baseBundleRef: baseBundle.baseBundleRef,
    modifier,
    resourceGrants: Object.freeze(resourceGrants),
    itemGrants: Object.freeze(itemGrants),
    idempotencyKey: `${journeyId}:${settlementId}:reward`,
    negativeRewardForbidden: true,
  };
}

/**
 * Derive the {@link WorldCommitDecision} from (mainLineSucceeded, totalBps).
 *
 * - `canonEligible = mainLineSucceeded && totalBps >= CANON_THRESHOLD_BPS`.
 * - `status = canonEligible ? 'solidified' : 'discarded'`.
 * - `reason` reflects which condition fired:
 *   - `main_completed_and_above_threshold` (solidified)
 *   - `below_canon_threshold` (discarded despite main completion)
 *   - `main_incomplete` (discarded because main failed)
 */
function deriveWorldCommit(
  mainLineSucceeded: boolean,
  totalBps: number,
): WorldCommitDecision {
  if (!mainLineSucceeded) {
    return {
      status: "discarded",
      canonEligible: false,
      thresholdBps: CANON_THRESHOLD_BPS,
      policyVersion: SETTLEMENT_POLICY_VERSION,
      reason: "main_incomplete",
    };
  }
  if (totalBps < CANON_THRESHOLD_BPS) {
    return {
      status: "discarded",
      canonEligible: false,
      thresholdBps: CANON_THRESHOLD_BPS,
      policyVersion: SETTLEMENT_POLICY_VERSION,
      reason: "below_canon_threshold",
    };
  }
  return {
    status: "solidified",
    canonEligible: true,
    thresholdBps: CANON_THRESHOLD_BPS,
    policyVersion: SETTLEMENT_POLICY_VERSION,
    reason: "main_completed_and_above_threshold",
  };
}

/**
 * Derive the stable settlement id for one journey settlement. The id is
 * scoped to the journey + policy version so a policy bump re-derives the
 * decision (and idempotently re-grants the reward under the new key).
 */
export function deriveSettlementId(journeyId: string): string {
  return `settlement:${journeyId}:v${SETTLEMENT_POLICY_VERSION}`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Derive the single-point {@link SettlementDecision} for one journey.
 *
 * Order of operations:
 * 1. Raw tier from `totalBps` via {@link TIER_THRESHOLDS_V1}.
 * 2. Apply {@link HiddenClamp} (the only mechanism that may downgrade a tier
 *    after the additive score is computed).
 * 3. Reward grant from (clamped tier, score, baseBundle).
 * 4. World commit from (mainLineSucceeded, totalBps).
 * 5. Replay digest = `sha256(causalCanonicalJson(ctx canonical subset))`.
 *
 * Single-derivation invariant: tier / reward / worldCommit / replayDigest
 * are all derived here. Downstream layers MUST read but never mutate them.
 *
 * @param ctx Frozen settlement context (the canonical input).
 * @param score Frozen consequence score (output of `buildConsequenceScore`).
 */
export function deriveSettlementDecision(
  ctx: SettlementContext,
  score: ConsequenceScore,
): SettlementDecision {
  const rawTier = deriveRawTier(
    score.breakdown.totalBps,
    score.mainLineSucceeded,
    score.hiddenComplete,
  );
  const tier = applyHiddenClamp(rawTier, score.hiddenClamp);
  const settlementId = deriveSettlementId(ctx.journeyId);
  const reward = tier === "未及格"
    ? makeNoRewardGrant(ctx, settlementId)
    : deriveRewardGrant(tier, score, ctx.baseRewardBundle, ctx.journeyId, settlementId);
  const worldCommit = deriveWorldCommit(
    score.mainLineSucceeded,
    score.breakdown.totalBps,
  );
  const replayDigest = computeSettlementContextReplayDigest(ctx);
  return {
    journeyId: ctx.journeyId,
    score,
    tier,
    reward,
    worldCommit,
    hiddenClamp: score.hiddenClamp,
    policyVersion: SETTLEMENT_POLICY_VERSION,
    settledAt: "1970-01-01T00:00:00.000Z",
    replayDigest,
  };
}

/**
 * Build the empty reward grant used when the tier is `未及格`. The grant
 * carries no resources / items and the journey-grade modifier; downstream
 * grantors do not call it. The permanent
 * {@link RewardGrant.negativeRewardForbidden} marker is preserved.
 */
function makeNoRewardGrant(ctx: SettlementContext, settlementId: string): RewardGrant {
  return {
    tier: "未及格",
    baseBundleRef: ctx.baseRewardBundle.baseBundleRef,
    modifier: {
      modifierBps: 0,
      multiplierBps: 0,
      reason: "journey_grade",
    },
    resourceGrants: Object.freeze({}),
    itemGrants: Object.freeze([]),
    idempotencyKey: `${ctx.journeyId}:${settlementId}:reward`,
    negativeRewardForbidden: true,
  };
}

/**
 * Re-derive a {@link SettlementDecision} from `(persisted, ctx)` and assert
 * byte-equal tier / reward / worldCommit. Used by receipt validation and by
 * `journeyPersistence` restart replay.
 *
 * Contract:
 * - The re-derivation runs the FULL pipeline: {@link buildConsequenceScore}
 *   on the ctx, then {@link deriveSettlementDecision}. This catches drift
 *   in either the score inputs OR the decision derivation.
 * - The re-derivation uses the {@link SETTLEMENT_POLICY_VERSION} recorded on
 *   the persisted decision (NOT the current default). For the first version
 *   this is identical; bumping the policy version is the documented
 *   migration path.
 * - Divergence throws `settlement_replay_divergence` with the diffing field
 *   name in the message so the operator can locate the drift.
 */
export function replaySettlement(
  persisted: SettlementDecision,
  ctx: SettlementContext,
): void {
  if (persisted.policyVersion !== SETTLEMENT_POLICY_VERSION) {
    throw new Error(
      `settlement_replay_policy_version_mismatch:${persisted.policyVersion}:${SETTLEMENT_POLICY_VERSION}`,
    );
  }
  const rederivedScore = buildConsequenceScore(ctx);
  const redecision = deriveSettlementDecision(ctx, rederivedScore);
  if (redecision.tier !== persisted.tier) {
    throw new Error(
      `settlement_replay_divergence:tier:persisted=${persisted.tier}:rederived=${redecision.tier}`,
    );
  }
  assertScoreEqual(persisted.score, redecision.score);
  assertRewardEqual(persisted.reward, redecision.reward);
  assertWorldCommitEqual(persisted.worldCommit, redecision.worldCommit);
  if (persisted.replayDigest !== undefined && redecision.replayDigest !== persisted.replayDigest) {
    throw new Error(
      `settlement_replay_divergence:replayDigest:persisted=${persisted.replayDigest}:rederived=${redecision.replayDigest}`,
    );
  }
}

function assertScoreEqual(a: ConsequenceScore, b: ConsequenceScore): void {
  if (a.breakdown.totalBps !== b.breakdown.totalBps) {
    throw new Error(
      `settlement_replay_divergence:score_total:${a.breakdown.totalBps}:${b.breakdown.totalBps}`,
    );
  }
  // PR4 replay hardening: verify each breakdown component individually so a
  // shift that leaves totalBps coincidentally unchanged (e.g. result+10 /
  // selfLoss-10) is still flagged. The total-only check is a coincidental
  // pass; the per-component check closes the gap.
  if (a.breakdown.resultScoreBps !== b.breakdown.resultScoreBps) {
    throw new Error(
      `settlement_replay_divergence:score_result:${a.breakdown.resultScoreBps}:${b.breakdown.resultScoreBps}`,
    );
  }
  if (a.breakdown.selfLossScoreBps !== b.breakdown.selfLossScoreBps) {
    throw new Error(
      `settlement_replay_divergence:score_self_loss:${a.breakdown.selfLossScoreBps}:${b.breakdown.selfLossScoreBps}`,
    );
  }
  if (a.breakdown.collateralScoreBps !== b.breakdown.collateralScoreBps) {
    throw new Error(
      `settlement_replay_divergence:score_collateral:${a.breakdown.collateralScoreBps}:${b.breakdown.collateralScoreBps}`,
    );
  }
  if (a.mainLineSucceeded !== b.mainLineSucceeded) {
    throw new Error(
      `settlement_replay_divergence:score_main_line:${a.mainLineSucceeded}:${b.mainLineSucceeded}`,
    );
  }
  if (a.hiddenComplete !== b.hiddenComplete) {
    throw new Error(
      `settlement_replay_divergence:score_hidden:${a.hiddenComplete}:${b.hiddenComplete}`,
    );
  }
}

function assertRewardEqual(a: RewardGrant, b: RewardGrant): void {
  if (a.tier !== b.tier) {
    throw new Error(`settlement_replay_divergence:reward_tier:${a.tier}:${b.tier}`);
  }
  if (a.modifier.multiplierBps !== b.modifier.multiplierBps) {
    throw new Error(
      `settlement_replay_divergence:reward_multiplier:${a.modifier.multiplierBps}:${b.modifier.multiplierBps}`,
    );
  }
  if (a.modifier.modifierBps !== b.modifier.modifierBps) {
    throw new Error(
      `settlement_replay_divergence:reward_modifier:${a.modifier.modifierBps}:${b.modifier.modifierBps}`,
    );
  }
  const aResourceIds = Object.keys(a.resourceGrants).sort();
  const bResourceIds = Object.keys(b.resourceGrants).sort();
  if (JSON.stringify(aResourceIds) !== JSON.stringify(bResourceIds)) {
    throw new Error("settlement_replay_divergence:reward_resource_ids");
  }
  for (const resourceId of aResourceIds) {
    if (a.resourceGrants[resourceId] !== b.resourceGrants[resourceId]) {
      throw new Error(
        `settlement_replay_divergence:reward_resource:${resourceId}:${a.resourceGrants[resourceId]}:${b.resourceGrants[resourceId]}`,
      );
    }
  }
  const aItems = [...a.itemGrants].sort((x, y) => x.itemId < y.itemId ? -1 : x.itemId > y.itemId ? 1 : 0);
  const bItems = [...b.itemGrants].sort((x, y) => x.itemId < y.itemId ? -1 : x.itemId > y.itemId ? 1 : 0);
  if (aItems.length !== bItems.length) {
    throw new Error(`settlement_replay_divergence:reward_item_count:${aItems.length}:${bItems.length}`);
  }
  for (let i = 0; i < aItems.length; i += 1) {
    const aItem = aItems[i]!;
    const bItem = bItems[i]!;
    if (aItem.itemId !== bItem.itemId || aItem.quantity !== bItem.quantity || aItem.rarityTier !== bItem.rarityTier) {
      throw new Error(`settlement_replay_divergence:reward_item:${aItem.itemId}:${bItem.itemId}`);
    }
  }
}

function assertWorldCommitEqual(a: WorldCommitDecision, b: WorldCommitDecision): void {
  if (a.status !== b.status) {
    throw new Error(`settlement_replay_divergence:world_commit_status:${a.status}:${b.status}`);
  }
  if (a.canonEligible !== b.canonEligible) {
    throw new Error(
      `settlement_replay_divergence:world_commit_canon:${a.canonEligible}:${b.canonEligible}`,
    );
  }
  if (a.reason !== b.reason) {
    throw new Error(`settlement_replay_divergence:world_commit_reason:${a.reason}:${b.reason}`);
  }
  // PR4 replay hardening: verify the threshold and policyVersion so a future
  // change that points deriveWorldCommit at the wrong constant (or a persisted
  // record replayed under a bumped policy) is caught here, not just by the
  // digest. The two are derived from versioned constants inside
  // deriveWorldCommit, so any drift is a real contract violation.
  if (a.thresholdBps !== b.thresholdBps) {
    throw new Error(
      `settlement_replay_divergence:world_commit_threshold:${a.thresholdBps}:${b.thresholdBps}`,
    );
  }
  if (a.policyVersion !== b.policyVersion) {
    throw new Error(
      `settlement_replay_divergence:world_commit_policy:${a.policyVersion}:${b.policyVersion}`,
    );
  }
}
