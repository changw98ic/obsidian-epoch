import assert from "node:assert/strict";
import test from "node:test";

import {
  CANON_THRESHOLD_BPS,
  CONSEQUENCE_SCORE_POLICY_VERSION,
  SETTLEMENT_POLICY_VERSION,
  type ConsequenceBreakdown,
  type ConsequenceEffectKind,
  type ConsequenceScore,
  type ConsequenceType,
  type HiddenClamp,
  type HiddenClampReason,
  type MirrorConsequenceLedgerEntry,
  type RewardGrant,
  type RewardModifier,
  type SelfLossSourceKind,
  type SettlementContext,
  type SettlementDecision,
  type SettlementTier,
  type WorldCommitDecision,
  type WorldCommitReason,
  type WorldCommitStatus,
} from "../lib/epoch/journeySettlementRules.ts";

/**
 * PR1 type-freeze tests for journeySettlementRules.
 *
 * These tests exercise the runtime-observable surface of the contract:
 * exported version constants, enum completeness, idempotency invariants on
 * the de-duplication key, and the zero-affinity / zero-strategy banlist
 * enforced on the public {@link SettlementDecision} shape.
 *
 * Pure-type verification (constructibility, exhaustiveness) is expressed via
 * fixtures that the TypeScript compiler must accept under strict mode.
 */

const EXPECTED_CONSEQUENCE_EFFECT_KINDS: readonly ConsequenceEffectKind[] = [
  "resource_spent",
  "lifetime_adjusted",
  "object_mutation",
  "object_destroy",
  "faction_standing_delta",
  "npc_relationship_delta",
  "region_influence_delta",
  "hidden_prerequisite_destroyed",
  "identity_doubt",
  "trace_created",
];

const EXPECTED_CONSEQUENCE_TYPES: readonly ConsequenceType[] = [
  "result",
  "self_loss",
  "collateral",
];

const EXPECTED_SELF_LOSS_SOURCE_KINDS: readonly SelfLossSourceKind[] = [
  "resource_cost",
  "resource_spent_event",
  "hosted_action_lifetime_delta",
  "lifetime_adjusted_event",
];

const EXPECTED_SETTLEMENT_TIERS: readonly SettlementTier[] = [
  "未及格",
  "及格",
  "良好",
  "优秀",
  "惊世",
];

const EXPECTED_HIDDEN_CLAMP_REASONS: readonly HiddenClampReason[] = [
  "main_incomplete",
  "hidden_incomplete",
];

const EXPECTED_WORLD_COMMIT_STATUSES: readonly WorldCommitStatus[] = [
  "solidified",
  "discarded",
];

const EXPECTED_WORLD_COMMIT_REASONS: readonly WorldCommitReason[] = [
  "main_completed_and_above_threshold",
  "main_incomplete",
  "below_canon_threshold",
];

/**
 * Compile-time exhaustiveness guards. Each switch uses `never` to ensure that
 * adding a new enum variant without updating the dispatcher is a type error.
 * At runtime the dispatcher throws on the default branch, providing the
 * "fail closed" guarantee required by the contract.
 */
function assertExhaustiveEffectKind(value: ConsequenceEffectKind): string {
  switch (value) {
    case "resource_spent":
    case "lifetime_adjusted":
    case "object_mutation":
    case "object_destroy":
    case "faction_standing_delta":
    case "npc_relationship_delta":
    case "region_influence_delta":
    case "hidden_prerequisite_destroyed":
    case "identity_doubt":
    case "trace_created":
      return value;
    default: {
      const _exhaustive: never = value;
      throw new Error(`unhandled_consequence_effect_kind:${String(_exhaustive)}`);
    }
  }
}

function assertExhaustiveSettlementTier(value: SettlementTier): string {
  switch (value) {
    case "未及格":
    case "及格":
    case "良好":
    case "优秀":
    case "惊世":
      return value;
    default: {
      const _exhaustive: never = value;
      throw new Error(`unhandled_settlement_tier:${String(_exhaustive)}`);
    }
  }
}

function assertExhaustiveWorldCommitStatus(value: WorldCommitStatus): string {
  switch (value) {
    case "solidified":
    case "discarded":
      return value;
    default: {
      const _exhaustive: never = value;
      throw new Error(`unhandled_world_commit_status:${String(_exhaustive)}`);
    }
  }
}

test("CONSEQUENCE_SCORE_POLICY_VERSION and SETTLEMENT_POLICY_VERSION are exported as 1", () => {
  assert.equal(CONSEQUENCE_SCORE_POLICY_VERSION, 1);
  assert.equal(SETTLEMENT_POLICY_VERSION, 1);
});

test("CANON_THRESHOLD_BPS placeholder is exported and gated by SETTLEMENT_POLICY_VERSION", () => {
  // Placeholder value calibrated in Step 16; interpretation is gated by the
  // policy version constant asserted above.
  assert.equal(CANON_THRESHOLD_BPS, 8500);
  assert.ok(
    CANON_THRESHOLD_BPS > 0 && CANON_THRESHOLD_BPS <= 10000,
    "canon threshold must be a sensible bps value",
  );
});

test("ConsequenceEffectKind union enumerates every canonical effect kind", () => {
  const observed = new Set<ConsequenceEffectKind>(EXPECTED_CONSEQUENCE_EFFECT_KINDS);
  assert.equal(observed.size, 10);
  for (const kind of EXPECTED_CONSEQUENCE_EFFECT_KINDS) {
    assert.equal(assertExhaustiveEffectKind(kind), kind);
  }
});

test("ConsequenceType union enumerates result / self_loss / collateral", () => {
  assert.deepEqual([...EXPECTED_CONSEQUENCE_TYPES].sort(), ["collateral", "result", "self_loss"]);
});

test("SelfLossSourceKind union enumerates the four canonical self-loss sources", () => {
  assert.equal(EXPECTED_SELF_LOSS_SOURCE_KINDS.length, 4);
});

test("SettlementTier union omits the legacy 完美 label", () => {
  assert.deepEqual([...EXPECTED_SETTLEMENT_TIERS], ["未及格", "及格", "良好", "优秀", "惊世"]);
  for (const tier of EXPECTED_SETTLEMENT_TIERS) {
    assert.equal(assertExhaustiveSettlementTier(tier), tier);
  }
});

test("HiddenClampReason union enumerates main_incomplete and hidden_incomplete", () => {
  assert.deepEqual([...EXPECTED_HIDDEN_CLAMP_REASONS].sort(), [
    "hidden_incomplete",
    "main_incomplete",
  ]);
});

test("WorldCommitStatus union enumerates solidified and discarded", () => {
  assert.deepEqual([...EXPECTED_WORLD_COMMIT_STATUSES].sort(), ["discarded", "solidified"]);
  assert.deepEqual([...EXPECTED_WORLD_COMMIT_STATUSES], ["solidified", "discarded"]);
  for (const status of EXPECTED_WORLD_COMMIT_STATUSES) {
    assert.equal(assertExhaustiveWorldCommitStatus(status), status);
  }
});

test("WorldCommitReason union enumerates the three canonical reasons", () => {
  assert.equal(EXPECTED_WORLD_COMMIT_REASONS.length, 3);
});

test("exhaustive dispatchers fail closed on unknown enum tag", () => {
  // Simulate a foreign tag slipping past the type system. The dispatcher must
  // throw rather than silently fall through — this is the "fail closed" guard.
  const foreign = "absolutely_unknown" as unknown as ConsequenceEffectKind;
  assert.throws(
    () => assertExhaustiveEffectKind(foreign),
    /unhandled_consequence_effect_kind/,
  );

  const foreignTier = "完美" as unknown as SettlementTier;
  assert.throws(
    () => assertExhaustiveSettlementTier(foreignTier),
    /unhandled_settlement_tier/,
  );

  const foreignStatus = "frozen" as unknown as WorldCommitStatus;
  assert.throws(
    () => assertExhaustiveWorldCommitStatus(foreignStatus),
    /unhandled_world_commit_status/,
  );
});

test("MirrorConsequenceLedgerEntry is constructible with the idempotency contract fields", () => {
  const entry: MirrorConsequenceLedgerEntry = {
    actionEventId: "evt_action_001",
    effectKind: "resource_spent",
    targetEntityId: "res_stamina",
    delta: -12,
    consequenceType: "self_loss",
    sourceEventIds: ["evt_mirror_spend_001"],
    effectBlueprint: { resourceId: "res_stamina", dimension: "amount" },
    recordedAt: "1970-01-01T00:00:00.000Z",
    dedupeKey: "evt_action_001:res_stamina:self_loss",
  };
  assert.equal(entry.actionEventId, "evt_action_001");
  assert.equal(entry.promotedCanonicalEventId, undefined);
  // Idempotency key shape: composite of actionEventId + dedupeKey. PR4 will
  // enforce uniqueness; PR1 only freezes the shape.
  assert.match(entry.dedupeKey, /^evt_action_001:/);
});

test("ConsequenceBreakdown is constructible and carries self-loss + collateral summaries", () => {
  const breakdown: ConsequenceBreakdown = {
    resultScoreBps: 6000,
    selfLossScoreBps: -800,
    collateralScoreBps: 300,
    totalBps: 5500,
    selfLossSourceEventsByKind: {
      resource_cost: ["evt_resource_cost_001"],
      resource_spent_event: [],
      hosted_action_lifetime_delta: ["evt_lifetime_delta_001"],
      lifetime_adjusted_event: [],
    },
    collateralLedgerEntryIds: ["ledger_entry_001", "ledger_entry_002"],
  };
  assert.equal(breakdown.totalBps, 5500);
  // Every canonical SelfLossSourceKind key must be present on the record.
  for (const kind of EXPECTED_SELF_LOSS_SOURCE_KINDS) {
    assert.ok(
      Array.isArray(breakdown.selfLossSourceEventsByKind[kind]),
      `missing self-loss source kind on breakdown: ${kind}`,
    );
  }
});

test("HiddenClamp is constructible for both the main-incomplete and hidden-incomplete cases", () => {
  const mainIncomplete: HiddenClamp = {
    applied: true,
    reason: "main_incomplete",
    tierCap: "未及格",
    sourceHiddenObjectiveIds: [],
  };
  const hiddenIncomplete: HiddenClamp = {
    applied: true,
    reason: "hidden_incomplete",
    tierCap: "优秀",
    sourceHiddenObjectiveIds: ["hidden_obj_007"],
  };
  const noClamp: HiddenClamp = {
    applied: false,
    tierCap: "惊世",
    sourceHiddenObjectiveIds: [],
  };
  assert.equal(mainIncomplete.tierCap, "未及格");
  assert.equal(hiddenIncomplete.tierCap, "优秀");
  assert.equal(noClamp.applied, false);
  assert.equal(noClamp.reason, undefined);
});

test("ConsequenceScore carries the AFTER-settlement summaries without re-feeding the breakdown", () => {
  const score: ConsequenceScore = {
    breakdown: {
      resultScoreBps: 6000,
      selfLossScoreBps: 0,
      collateralScoreBps: 0,
      totalBps: 6000,
      selfLossSourceEventsByKind: {
        resource_cost: [],
        resource_spent_event: [],
        hosted_action_lifetime_delta: [],
        lifetime_adjusted_event: [],
      },
      collateralLedgerEntryIds: [],
    },
    mainLineSucceeded: true,
    hiddenComplete: false,
    hiddenClamp: {
      applied: true,
      reason: "hidden_incomplete",
      tierCap: "优秀",
      sourceHiddenObjectiveIds: ["hidden_obj_007"],
    },
    roleplaySummary: { deviationBps: 120, doubtEventCount: 1, exposed: false },
    viabilitySummary: {
      viabilityScoreBpsBefore: 9100,
      viabilityScoreBpsAfter: 8700,
      status: "stressed",
    },
    policyVersion: CONSEQUENCE_SCORE_POLICY_VERSION,
    computedAt: "1970-01-01T00:00:00.000Z",
  };
  assert.equal(score.policyVersion, 1);
  // The summaries are projections; they must not appear inside breakdown.
  assert.equal(score.breakdown.totalBps, 6000);
  assert.equal(score.roleplaySummary?.doubtEventCount, 1);
  assert.equal(score.viabilitySummary?.status, "stressed");
});

test("WorldCommitDecision reason aligns with canonEligible and status", () => {
  const solidified: WorldCommitDecision = {
    status: "solidified",
    canonEligible: true,
    thresholdBps: CANON_THRESHOLD_BPS,
    policyVersion: SETTLEMENT_POLICY_VERSION,
    reason: "main_completed_and_above_threshold",
  };
  const discardedBelowThreshold: WorldCommitDecision = {
    status: "discarded",
    canonEligible: false,
    thresholdBps: CANON_THRESHOLD_BPS,
    policyVersion: SETTLEMENT_POLICY_VERSION,
    reason: "below_canon_threshold",
  };
  const discardedMainIncomplete: WorldCommitDecision = {
    status: "discarded",
    canonEligible: false,
    thresholdBps: CANON_THRESHOLD_BPS,
    policyVersion: SETTLEMENT_POLICY_VERSION,
    reason: "main_incomplete",
  };
  assert.equal(solidified.status, "solidified");
  assert.equal(discardedBelowThreshold.status, "discarded");
  assert.equal(discardedMainIncomplete.canonEligible, false);
});

test("RewardModifier and RewardGrant clamp multiplier to [5000, 15000] and forbid negative rewards", () => {
  const modifier: RewardModifier = {
    modifierBps: 1500,
    multiplierBps: 11500,
    reason: "journey_grade",
  };
  assert.ok(modifier.multiplierBps >= 5000 && modifier.multiplierBps <= 15000);

  const grant: RewardGrant = {
    tier: "优秀",
    baseBundleRef: "bundle_base_excellent_v1",
    modifier,
    resourceGrants: { res_coin: 250, res_stamina: 50 },
    itemGrants: [
      { itemId: "item_relic_001", quantity: 1, rarityTier: 4 },
    ],
    idempotencyKey: "journey_001:settlement:reward",
    negativeRewardForbidden: true,
  };
  // The negative-reward invariant is a permanent literal marker on the type.
  assert.equal(grant.negativeRewardForbidden, true);
  for (const qty of Object.values(grant.resourceGrants)) {
    assert.ok(qty >= 0, "negative resource reward forbidden");
  }
  for (const item of grant.itemGrants) {
    assert.ok(item.quantity >= 0, "negative item reward forbidden");
  }
});

test("SettlementDecision single-derivation invariant: score -> tier/reward/worldCommit all set at once", () => {
  const decision: SettlementDecision = {
    journeyId: "journey_001",
    score: {
      breakdown: {
        resultScoreBps: 7200,
        selfLossScoreBps: -200,
        collateralScoreBps: 400,
        totalBps: 7400,
        selfLossSourceEventsByKind: {
          resource_cost: ["evt_resource_cost_001"],
          resource_spent_event: [],
          hosted_action_lifetime_delta: [],
          lifetime_adjusted_event: [],
        },
        collateralLedgerEntryIds: ["ledger_entry_001"],
      },
      mainLineSucceeded: true,
      hiddenComplete: true,
      hiddenClamp: { applied: false, tierCap: "惊世", sourceHiddenObjectiveIds: [] },
      policyVersion: CONSEQUENCE_SCORE_POLICY_VERSION,
      computedAt: "1970-01-01T00:00:00.000Z",
    },
    tier: "惊世",
    reward: {
      tier: "惊世",
      baseBundleRef: "bundle_base_legendary_v1",
      modifier: { modifierBps: 2500, multiplierBps: 12500, reason: "journey_grade" },
      resourceGrants: { res_coin: 500 },
      itemGrants: [{ itemId: "item_relic_legendary", quantity: 1, rarityTier: 5 }],
      idempotencyKey: "journey_001:settlement:reward",
      negativeRewardForbidden: true,
    },
    worldCommit: {
      status: "solidified",
      canonEligible: true,
      thresholdBps: CANON_THRESHOLD_BPS,
      policyVersion: SETTLEMENT_POLICY_VERSION,
      reason: "main_completed_and_above_threshold",
    },
    hiddenClamp: { applied: false, tierCap: "惊世", sourceHiddenObjectiveIds: [] },
    policyVersion: SETTLEMENT_POLICY_VERSION,
    settledAt: "1970-01-01T00:00:00.000Z",
    replayDigest: "sha256:" + "a".repeat(64),
  };
  assert.equal(decision.journeyId, "journey_001");
  assert.equal(decision.policyVersion, SETTLEMENT_POLICY_VERSION);
  assert.equal(decision.score.policyVersion, CONSEQUENCE_SCORE_POLICY_VERSION);
  assert.equal(decision.tier, decision.reward.tier);
  assert.equal(decision.worldCommit.canonEligible, true);
});

test("SettlementContext is constructible with all optional projections and the audit-only strategy snapshot", () => {
  const ctx: SettlementContext = {
    journeyId: "journey_001",
    mainObjectiveIds: ["main_001", "main_002"],
    sideObjectiveIds: ["side_001"],
    hiddenObjectiveIds: ["hidden_001"],
    mainLineSucceeded: true,
    hiddenComplete: true,
    actionResolutions: [
      { actionEventId: "evt_action_001", resultKind: "combat", succeeded: true },
    ],
    selfLossSourceEventsByKind: {
      resource_cost: ["evt_resource_cost_001"],
      resource_spent_event: [],
      hosted_action_lifetime_delta: [],
      lifetime_adjusted_event: [],
    },
    mirrorLedgerEntries: [
      {
        actionEventId: "evt_action_001",
        effectKind: "resource_spent",
        targetEntityId: "res_stamina",
        delta: -12,
        consequenceType: "self_loss",
        sourceEventIds: ["evt_mirror_spend_001"],
        effectBlueprint: {},
        recordedAt: "1970-01-01T00:00:00.000Z",
        dedupeKey: "evt_action_001:res_stamina:self_loss",
      },
    ],
    canonicalActionEventIds: ["evt_action_001"],
    resultComponentInputs: {
      mainCompletionBps: 10_000,
      bonusMainCompletionBps: 0,
      sideCompletionBps: 10_000,
      executionQualityBps: 8_000,
      penaltyBps: 0,
    },
    selfLossContributions: [
      {
        actionEventId: "evt_action_001",
        costKind: "resource",
        sourceKind: "resource_cost",
        canonicalEventIds: ["evt_resource_cost_001"],
        resourceUnits: 1,
      },
    ],
    baseRewardBundle: {
      baseBundleRef: "bundle_base_journey_001_v1",
      resources: { coin: 5 },
      items: [],
    },
    policyVersion: SETTLEMENT_POLICY_VERSION,
  };
  assert.equal(ctx.journeyId, "journey_001");
  assert.equal(ctx.resultComponentInputs.mainCompletionBps, 10_000);
  assert.equal(ctx.selfLossContributions.length, 1);
  assert.equal(ctx.baseRewardBundle.resources.coin, 5);
  assert.equal(ctx.strategyConsistencySnapshot, undefined);
  assert.equal(ctx.roleplayScore, undefined);
  assert.equal(ctx.identityViability, undefined);
  assert.equal(ctx.expectedLifePattern, undefined);
  assert.equal(ctx.offerHash, undefined);
});

test("zero-affinity / zero-strategy banlist: SettlementDecision forbids affinity and strategy fields", () => {
  // Type-level assertion: assigning any banned field to a SettlementDecision
  // literal is a compile error. The runtime fixture below mirrors that
  // invariant by enumerating the banlist and asserting the keys are absent on
  // a constructed instance.
  const banlist = [
    "affinityBonusBps",
    "strategyRewardModifier",
    "strategyAffinity",
    "fitBps",
    "expectedApproach",
  ] as const;

  const decision: SettlementDecision = {
    journeyId: "journey_001",
    score: {
      breakdown: {
        resultScoreBps: 6000,
        selfLossScoreBps: 0,
        collateralScoreBps: 0,
        totalBps: 6000,
        selfLossSourceEventsByKind: {
          resource_cost: [],
          resource_spent_event: [],
          hosted_action_lifetime_delta: [],
          lifetime_adjusted_event: [],
        },
        collateralLedgerEntryIds: [],
      },
      mainLineSucceeded: true,
      hiddenComplete: true,
      hiddenClamp: { applied: false, tierCap: "惊世", sourceHiddenObjectiveIds: [] },
      policyVersion: CONSEQUENCE_SCORE_POLICY_VERSION,
      computedAt: "1970-01-01T00:00:00.000Z",
    },
    tier: "良好",
    reward: {
      tier: "良好",
      baseBundleRef: "bundle_base_good_v1",
      modifier: { modifierBps: 0, multiplierBps: 10000, reason: "journey_grade" },
      resourceGrants: {},
      itemGrants: [],
      idempotencyKey: "journey_001:settlement:reward",
      negativeRewardForbidden: true,
    },
    worldCommit: {
      status: "solidified",
      canonEligible: true,
      thresholdBps: CANON_THRESHOLD_BPS,
      policyVersion: SETTLEMENT_POLICY_VERSION,
      reason: "main_completed_and_above_threshold",
    },
    hiddenClamp: { applied: false, tierCap: "惊世", sourceHiddenObjectiveIds: [] },
    policyVersion: SETTLEMENT_POLICY_VERSION,
    settledAt: "1970-01-01T00:00:00.000Z",
  };

  for (const banned of banlist) {
    assert.equal(
      (decision as unknown as Record<string, unknown>)[banned],
      undefined,
      `SettlementDecision must not carry banned field: ${banned}`,
    );
  }
});
