import assert from "node:assert/strict";
import test from "node:test";

import {
  AFFINITY_MATRIX_VERSION,
  APPROACH_TAGS,
  STRATEGIES,
  STRATEGY_POLICY_VERSION,
  isApproachTag,
  isStrategy,
  type ApproachSnapshot,
  type ApproachSnapshotEntry,
  type ApproachSnapshotSource,
  type ApproachTag,
  type IdentityStrategyDisposition,
  type PrimaryViolationClassification,
  type Strategy,
  type StrategyConsistencyScore,
  type StrategyProfile,
} from "../lib/epoch/journeyStrategyRules.ts";

const ISO = "2026-07-25T00:00:00.000Z";

test("version constants are pinned at 1 and exported as const", () => {
  assert.equal(STRATEGY_POLICY_VERSION, 1);
  assert.equal(AFFINITY_MATRIX_VERSION, 1);

  // `as const` narrows the literal type at compile time; assert the runtime
  // type is exactly number 1 (not "1" string, not 1.0 number object).
  assert.strictEqual(STRATEGY_POLICY_VERSION, 1 as number);
  assert.strictEqual(AFFINITY_MATRIX_VERSION, 1 as number);
});

test("STRATEGIES is the canonical five-value taxonomy in stable order", () => {
  assert.deepEqual([...STRATEGIES], [
    "combat",
    "cunning",
    "support",
    "logistics",
    "exploration",
  ]);
});

test("APPROACH_TAGS is the canonical seven-value set in stable order", () => {
  assert.deepEqual([...APPROACH_TAGS], [
    "combat",
    "stealth",
    "diplomacy",
    "support",
    "logistics",
    "scout",
    "preservation",
  ]);
});

test("Strategy union is exactly the STRATEGIES tuple element type", () => {
  // Compile-time exhaustiveness: every literal is assignable to Strategy.
  const values: readonly Strategy[] = [
    "combat",
    "cunning",
    "support",
    "logistics",
    "exploration",
  ];
  assert.equal(values.length, STRATEGIES.length);
  for (const v of values) {
    assert.equal(isStrategy(v), true);
  }
});

test("ApproachTag union is exactly the APPROACH_TAGS tuple element type", () => {
  const values: readonly ApproachTag[] = [
    "combat",
    "stealth",
    "diplomacy",
    "support",
    "logistics",
    "scout",
    "preservation",
  ];
  assert.equal(values.length, APPROACH_TAGS.length);
  for (const v of values) {
    assert.equal(isApproachTag(v), true);
  }
});

test("isApproachTag fails closed on unknown, mistyped, or look-alike values", () => {
  // Unknown string — must reject.
  assert.equal(isApproachTag("social"), false);
  assert.equal(isApproachTag("Combat"), false); // case-sensitive
  assert.equal(isApproachTag(" combat "), false); // whitespace
  assert.equal(isApproachTag(""), false);

  // Non-string — must reject without throwing.
  assert.equal(isApproachTag(null), false);
  assert.equal(isApproachTag(undefined), false);
  assert.equal(isApproachTag(42), false);
  assert.equal(isApproachTag({ tag: "combat" }), false);
  assert.equal(isApproachTag(["combat"]), false);
});

test("isApproachTag never throws — untrusted input is safe to probe", () => {
  // Defensively probe a forged payload an untrusted client might send.
  const forged = JSON.parse('{"tag":"combat","extra":"malicious"}');
  assert.doesNotThrow(() => isApproachTag(forged));
  assert.equal(isApproachTag(forged), false);
  assert.doesNotThrow(() => isApproachTag(forged.tag));
  assert.equal(isApproachTag(forged.tag), true);
});

test("isStrategy fails closed on unknown or mistyped values", () => {
  assert.equal(isStrategy("trickster"), false);
  assert.equal(isStrategy("Combat"), false);
  assert.equal(isStrategy(""), false);
  assert.equal(isStrategy(null), false);
  assert.equal(isStrategy(undefined), false);
  assert.equal(isStrategy(0), false);
  assert.equal(isStrategy({ primary: "combat" }), false);
});

test("StrategyProfile round-trips with the pinned policy version", () => {
  const profile: StrategyProfile = {
    primary: "combat",
    secondary: "cunning",
    settledAt: ISO,
    policyVersion: STRATEGY_POLICY_VERSION,
  };
  assert.equal(profile.primary, "combat");
  assert.equal(profile.secondary, "cunning");
  assert.equal(profile.policyVersion, 1);
  assert.equal(profile.policyVersion, STRATEGY_POLICY_VERSION);

  // Secondary is optional; a single-posture profile is well-typed.
  const single: StrategyProfile = {
    primary: "exploration",
    settledAt: ISO,
    policyVersion: STRATEGY_POLICY_VERSION,
  };
  assert.equal(single.secondary, undefined);
});

test("IdentityStrategyDisposition carries BOTH policy versions for replay", () => {
  const disposition: IdentityStrategyDisposition = {
    identityId: "identity_1",
    primary: "support",
    secondary: "logistics",
    frozenAt: ISO,
    strategyPolicyVersion: STRATEGY_POLICY_VERSION,
    affinityMatrixVersion: AFFINITY_MATRIX_VERSION,
  };
  assert.equal(disposition.identityId, "identity_1");
  assert.equal(disposition.primary, "support");
  assert.equal(disposition.strategyPolicyVersion, STRATEGY_POLICY_VERSION);
  assert.equal(disposition.affinityMatrixVersion, AFFINITY_MATRIX_VERSION);
  // Both versions must be 1 (the pinned PR1 value).
  assert.equal(disposition.strategyPolicyVersion, 1);
  assert.equal(disposition.affinityMatrixVersion, 1);
});

test("PrimaryViolationClassification has exactly two kinds with fixed bps", () => {
  const normal: PrimaryViolationClassification = {
    kind: "normal",
    primaryWeightBps: 10000,
    secondaryWeightBps: 0,
  };
  const violated: PrimaryViolationClassification = {
    kind: "fully_violates",
    primaryWeightBps: 3000,
    secondaryWeightBps: 7000,
  };

  assert.equal(normal.kind, "normal");
  assert.equal(normal.primaryWeightBps, 10000);
  assert.equal(normal.secondaryWeightBps, 0);

  assert.equal(violated.kind, "fully_violates");
  assert.equal(violated.primaryWeightBps, 3000);
  assert.equal(violated.secondaryWeightBps, 7000);

  // Discriminated union narrows correctly.
  function weightOf(c: PrimaryViolationClassification): number {
    return c.primaryWeightBps + c.secondaryWeightBps;
  }
  assert.equal(weightOf(normal), 10000);
  assert.equal(weightOf(violated), 10000);
});

test("ApproachSnapshotSource is exactly the three pipeline stages", () => {
  const sources: readonly ApproachSnapshotSource[] = ["offer", "plan", "action"];
  assert.deepEqual([...sources], ["offer", "plan", "action"]);
});

test("ApproachSnapshotEntry carries a validated approachTags array", () => {
  const entry: ApproachSnapshotEntry = {
    source: "plan",
    sourceId: "plan_1",
    approachTags: ["stealth", "scout"],
    recordedAt: ISO,
  };
  assert.equal(entry.source, "plan");
  assert.equal(entry.sourceId, "plan_1");
  assert.deepEqual([...entry.approachTags], ["stealth", "scout"]);

  // Every stored tag must pass the fail-closed guard.
  for (const tag of entry.approachTags) {
    assert.equal(isApproachTag(tag), true);
  }
});

test("ApproachSnapshot preserves entry order and pins snapshotVersion", () => {
  const snapshot: ApproachSnapshot = {
    journeyId: "journey_1",
    entries: [
      {
        source: "offer",
        sourceId: "offer_1",
        approachTags: ["diplomacy"],
        recordedAt: ISO,
      },
      {
        source: "plan",
        sourceId: "plan_1",
        approachTags: ["stealth"],
        recordedAt: ISO,
      },
      {
        source: "action",
        sourceId: "action_1",
        approachTags: ["combat"],
        recordedAt: ISO,
      },
    ],
    snapshotVersion: STRATEGY_POLICY_VERSION,
  };
  assert.equal(snapshot.journeyId, "journey_1");
  assert.equal(snapshot.entries.length, 3);
  assert.equal(snapshot.entries[0]?.source, "offer");
  assert.equal(snapshot.entries[1]?.source, "plan");
  assert.equal(snapshot.entries[2]?.source, "action");
  assert.equal(snapshot.snapshotVersion, STRATEGY_POLICY_VERSION);
});

test("StrategyConsistencyScore is constructible with matchBps + classification", () => {
  const snapshot: ApproachSnapshot = {
    journeyId: "journey_1",
    entries: [],
    snapshotVersion: STRATEGY_POLICY_VERSION,
  };
  const score: StrategyConsistencyScore = {
    matchBps: 8500,
    snapshot,
    classification: {
      kind: "normal",
      primaryWeightBps: 10000,
      secondaryWeightBps: 0,
    },
    strategyPolicyVersion: STRATEGY_POLICY_VERSION,
    computedAt: ISO,
  };
  assert.equal(score.matchBps, 8500);
  assert.equal(score.snapshot, snapshot);
  assert.equal(score.classification.kind, "normal");
  assert.equal(score.strategyPolicyVersion, STRATEGY_POLICY_VERSION);

  // matchBps is bounded 0-10000 by contract; verify the boundary values
  // are representable.
  const zero: StrategyConsistencyScore = { ...score, matchBps: 0 };
  const full: StrategyConsistencyScore = { ...score, matchBps: 10000 };
  assert.equal(zero.matchBps, 0);
  assert.equal(full.matchBps, 10000);
});

test("ZERO AFFINITY BONUS: StrategyConsistencyScore carries no affinity or fit fields", () => {
  // The hard contract: StrategyConsistencyScore is audit-only and must NOT
  // carry any field that downstream code could misread as a reward multiplier
  // or strategy input. Assert the known field set exhaustively.
  const score: StrategyConsistencyScore = {
    matchBps: 0,
    snapshot: {
      journeyId: "journey_1",
      entries: [],
      snapshotVersion: STRATEGY_POLICY_VERSION,
    },
    classification: {
      kind: "normal",
      primaryWeightBps: 10000,
      secondaryWeightBps: 0,
    },
    strategyPolicyVersion: STRATEGY_POLICY_VERSION,
    computedAt: ISO,
  };
  const keys = Object.keys(score).sort();
  assert.deepEqual(keys, [
    "classification",
    "computedAt",
    "matchBps",
    "snapshot",
    "strategyPolicyVersion",
  ]);

  // Forbidden field names — none of these may appear on the score type.
  const forbidden = [
    "fitBps",
    "strategyAffinity",
    "taskFamilyId",
    "expectedApproach",
    "bonusBps",
    "multiplierBps",
    "rewardBps",
  ] as const;
  for (const name of forbidden) {
    assert.equal(
      (score as Record<string, unknown>)[name],
      undefined,
      `StrategyConsistencyScore must not carry ${name}`,
    );
  }
});

test("ZERO AFFINITY BONUS: no Public type in the module carries affinity fields", () => {
  // Audit via the module's exported runtime objects: every Public, client-
  // facing shape built from this module composes Strategy/ApproachTag and the
  // interfaces above. None of them defines a fit/affinity field.
  //
  // The strongest runtime proxy we have is to inspect ApproachSnapshot and
  // StrategyProfile (the persisted/Public surfaces): they must not carry
  // any of the forbidden field names either.
  const publicFixtures: ReadonlyArray<Record<string, unknown>> = [
    {
      primary: "combat",
      settledAt: ISO,
      policyVersion: STRATEGY_POLICY_VERSION,
    } satisfies StrategyProfile,
    {
      journeyId: "journey_1",
      entries: [],
      snapshotVersion: STRATEGY_POLICY_VERSION,
    } satisfies ApproachSnapshot,
  ];

  const forbidden = [
    "fitBps",
    "strategyAffinity",
    "taskFamilyId",
    "expectedApproach",
  ] as const;

  for (const fixture of publicFixtures) {
    for (const name of forbidden) {
      assert.equal(
        fixture[name],
        undefined,
        `Public fixture must not carry ${name}`,
      );
    }
  }
});
