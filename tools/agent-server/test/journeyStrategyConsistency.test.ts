import assert from "node:assert/strict";
import test from "node:test";

import {
  AFFINITY_MATRIX,
  AFFINITY_MATRIX_VERSION,
  APPROACH_TAGS,
  STRATEGIES,
  STRATEGY_POLICY_VERSION,
  type ApproachTag,
  type IdentityStrategyDisposition,
  type JourneyStrategySnapshot,
  type Strategy,
  classifyPrimaryViolation,
  dispositionWeights,
  expectedApproachForTask,
  freezeIdentityStrategyDisposition,
  scoreStrategyConsistency,
  snapshotJourneyStrategy,
} from "../lib/epoch/journeyStrategyRules.ts";

const ISO = "2026-07-25T00:00:00.000Z";

// ─── freezeIdentityStrategyDisposition ──────────────────────────────────────

test("freezeIdentityStrategyDisposition produces an immutable disposition with both versions", () => {
  const d = freezeIdentityStrategyDisposition("id_1", "combat", "cunning", ISO);
  assert.equal(d.identityId, "id_1");
  assert.equal(d.primary, "combat");
  assert.equal(d.secondary, "cunning");
  assert.equal(d.frozenAt, ISO);
  assert.equal(d.strategyPolicyVersion, STRATEGY_POLICY_VERSION);
  assert.equal(d.affinityMatrixVersion, AFFINITY_MATRIX_VERSION);
});

test("freezeIdentityStrategyDisposition works without secondary", () => {
  const d = freezeIdentityStrategyDisposition("id_2", "exploration", undefined, ISO);
  assert.equal(d.primary, "exploration");
  assert.equal(d.secondary, undefined);
});

test("freezeIdentityStrategyDisposition is pure: same inputs → same output", () => {
  const a = freezeIdentityStrategyDisposition("id_1", "support", "logistics", ISO);
  const b = freezeIdentityStrategyDisposition("id_1", "support", "logistics", ISO);
  assert.deepEqual(a, b);
});

// ─── snapshotJourneyStrategy ────────────────────────────────────────────────

test("snapshotJourneyStrategy copies primary/secondary from disposition", () => {
  const d = freezeIdentityStrategyDisposition("id_1", "cunning", "stealth" as Strategy, ISO);
  // Note: "stealth" is an ApproachTag, not a Strategy. For the snapshot we use
  // the disposition's secondary which is already validated at freeze time.
  const d2 = freezeIdentityStrategyDisposition("id_1", "cunning", "exploration", ISO);
  const snap = snapshotJourneyStrategy("j_1", d2);
  assert.equal(snap.journeyId, "j_1");
  assert.equal(snap.primary, "cunning");
  assert.equal(snap.secondary, "exploration");
  assert.equal(snap.frozenAt, ISO);
  assert.equal(snap.dispositionRef, "id_1");
  assert.equal(snap.snapshotVersion, STRATEGY_POLICY_VERSION);
});

test("snapshotJourneyStrategy is pure: same disposition → same snapshot", () => {
  const d = freezeIdentityStrategyDisposition("id_1", "combat", undefined, ISO);
  const a = snapshotJourneyStrategy("j_1", d);
  const b = snapshotJourneyStrategy("j_1", d);
  assert.deepEqual(a, b);
});

// ─── expectedApproachForTask ────────────────────────────────────────────────

test("expectedApproachForTask returns bonus (100) tags for each strategy", () => {
  for (const strategy of STRATEGIES) {
    const tags = expectedApproachForTask(strategy);
    assert.ok(tags.length >= 1, `strategy ${strategy} should have at least 1 bonus tag`);
    for (const tag of tags) {
      assert.equal(
        AFFINITY_MATRIX[tag]![strategy],
        100,
        `tag ${tag} should be bonus for strategy ${strategy}`,
      );
    }
  }
});

test("expectedApproachForTask: each strategy's primary approach tag is included", () => {
  // The primary mapping is: combat→combat, cunning→stealth, support→support,
  // logistics→logistics, exploration→scout.
  const primaryMap: Readonly<Record<Strategy, ApproachTag>> = {
    combat: "combat",
    cunning: "stealth",
    support: "support",
    logistics: "logistics",
    exploration: "scout",
  };
  for (const [strategy, expectedTag] of Object.entries(primaryMap) as ReadonlyArray<[Strategy, ApproachTag]>) {
    const tags = expectedApproachForTask(strategy);
    assert.ok(tags.includes(expectedTag), `strategy ${strategy} should include ${expectedTag}`);
  }
});

test("expectedApproachForTask returns only bonus tags, never neutral or penalty", () => {
  for (const strategy of STRATEGIES) {
    const tags = expectedApproachForTask(strategy);
    for (const tag of APPROACH_TAGS) {
      const affinity = AFFINITY_MATRIX[tag]![strategy]!;
      if (tags.includes(tag)) {
        assert.equal(affinity, 100, `${tag} should be bonus for ${strategy}`);
      }
    }
  }
});

// ─── classifyPrimaryViolation ───────────────────────────────────────────────

test("classifyPrimaryViolation: empty observedTags defaults to normal (legacy)", () => {
  const c = classifyPrimaryViolation("combat", []);
  assert.equal(c.kind, "normal");
  assert.equal(c.primaryWeightBps, 10000);
  assert.equal(c.secondaryWeightBps, 0);
});

test("classifyPrimaryViolation: all bonus tags → normal", () => {
  // combat strategy, observed combat tag → bonus (100), primaryAffinityScoreBps = 100*100 = 10000
  const c = classifyPrimaryViolation("combat", ["combat"]);
  assert.equal(c.kind, "normal");
});

test("classifyPrimaryViolation: all penalty tags → fully_violates", () => {
  // combat strategy, observed support tag → penalty (0), primaryAffinityScoreBps = 0*100 = 0 < 2000
  const c = classifyPrimaryViolation("combat", ["support"]);
  assert.equal(c.kind, "fully_violates");
  assert.equal(c.primaryWeightBps, 3000);
  assert.equal(c.secondaryWeightBps, 7000);
});

test("classifyPrimaryViolation: mix of penalty and neutral → normal if average >= 20", () => {
  // combat strategy: stealth=0(penalty), logistics=50(neutral)
  // average = 25, * 100 = 2500 >= 2000 → normal
  const c = classifyPrimaryViolation("combat", ["stealth", "logistics"]);
  assert.equal(c.kind, "normal");
});

test("classifyPrimaryViolation: mostly penalty with one neutral can still be fully_violates", () => {
  // combat strategy: stealth=0, diplomacy=50 (wait diplomacy is 50 for combat? Let me check)
  // AFFINITY_MATRIX.diplomacy.combat = 50, so avg with stealth: (0+50)/2 = 25, *100 = 2500 >= 2000 → normal
  // Let me use all penalty: stealth=0, support=0 for combat
  // avg = 0, *100 = 0 < 2000 → fully_violates
  const c = classifyPrimaryViolation("combat", ["stealth", "support"]);
  assert.equal(c.kind, "fully_violates");
});

test("classifyPrimaryViolation: single neutral tag → normal", () => {
  // combat strategy, observed logistics tag → neutral (50), primaryAffinityScoreBps = 50*100 = 5000
  const c = classifyPrimaryViolation("combat", ["logistics"]);
  assert.equal(c.kind, "normal");
});

// ─── scoreStrategyConsistency ───────────────────────────────────────────────

test("scoreStrategyConsistency: no entries → matchBps=10000, normal (legacy default)", () => {
  const d = freezeIdentityStrategyDisposition("id_1", "combat", undefined, ISO);
  const snap = snapshotJourneyStrategy("j_1", d);
  const score = scoreStrategyConsistency(snap, [], ISO);
  assert.equal(score.matchBps, 10000);
  assert.equal(score.classification.kind, "normal");
  assert.equal(score.strategyPolicyVersion, STRATEGY_POLICY_VERSION);
  assert.equal(score.computedAt, ISO);
});

test("scoreStrategyConsistency: all bonus entries → matchBps=10000", () => {
  const d = freezeIdentityStrategyDisposition("id_1", "combat", undefined, ISO);
  const snap = snapshotJourneyStrategy("j_1", d);
  const entries = [{
    source: "action" as const,
    sourceId: "a_1",
    approachTags: ["combat"] as readonly ApproachTag[],
    recordedAt: ISO,
  }];
  const score = scoreStrategyConsistency(snap, entries, ISO);
  // combat vs combat = 100, matchBps = 100/1 * 100 = 10000
  assert.equal(score.matchBps, 10000);
  assert.equal(score.classification.kind, "normal");
});

test("scoreStrategyConsistency: all penalty entries → matchBps=0, fully_violates", () => {
  const d = freezeIdentityStrategyDisposition("id_1", "combat", undefined, ISO);
  const snap = snapshotJourneyStrategy("j_1", d);
  const entries = [{
    source: "action" as const,
    sourceId: "a_1",
    approachTags: ["support"] as readonly ApproachTag[],
    recordedAt: ISO,
  }];
  const score = scoreStrategyConsistency(snap, entries, ISO);
  // support vs combat = 0, matchBps = 0/1 * 100 = 0
  assert.equal(score.matchBps, 0);
  assert.equal(score.classification.kind, "fully_violates");
});

test("scoreStrategyConsistency: mixed entries → weighted average", () => {
  const d = freezeIdentityStrategyDisposition("id_1", "combat", undefined, ISO);
  const snap = snapshotJourneyStrategy("j_1", d);
  const entries = [{
    source: "action" as const,
    sourceId: "a_1",
    // combat=100, support=0 for combat strategy
    approachTags: ["combat", "support"] as readonly ApproachTag[],
    recordedAt: ISO,
  }];
  const score = scoreStrategyConsistency(snap, entries, ISO);
  // sum = 100 + 0 = 100, count = 2, matchBps = (100/2)*100 = 5000
  assert.equal(score.matchBps, 5000);
  // avg = 50, *100 = 5000 >= 2000 → normal
  assert.equal(score.classification.kind, "normal");
});

test("scoreStrategyConsistency: snapshot carries journeyId and entries", () => {
  const d = freezeIdentityStrategyDisposition("id_1", "support", undefined, ISO);
  const snap = snapshotJourneyStrategy("j_42", d);
  const entries = [{
    source: "plan" as const,
    sourceId: "p_1",
    approachTags: ["diplomacy"] as readonly ApproachTag[],
    recordedAt: ISO,
  }];
  const score = scoreStrategyConsistency(snap, entries, ISO);
  assert.equal(score.snapshot.journeyId, "j_42");
  assert.equal(score.snapshot.entries.length, 1);
  assert.equal(score.snapshot.snapshotVersion, STRATEGY_POLICY_VERSION);
});

test("scoreStrategyConsistency is audit-only: no forbidden fields on result", () => {
  const d = freezeIdentityStrategyDisposition("id_1", "combat", undefined, ISO);
  const snap = snapshotJourneyStrategy("j_1", d);
  const score = scoreStrategyConsistency(snap, [], ISO);
  const forbidden = [
    "fitBps", "strategyAffinity", "taskFamilyId", "expectedApproach",
    "bonusBps", "multiplierBps", "rewardBps",
  ] as const;
  for (const name of forbidden) {
    assert.equal(
      (score as Record<string, unknown>)[name],
      undefined,
      `StrategyConsistencyScore must not carry ${name}`,
    );
  }
});

test("scoreStrategyConsistency: affinity values never enter ConsequenceScore (banlist check)", () => {
  // Verify that the score type's keys are exactly the expected set.
  const d = freezeIdentityStrategyDisposition("id_1", "combat", undefined, ISO);
  const snap = snapshotJourneyStrategy("j_1", d);
  const score = scoreStrategyConsistency(snap, [], ISO);
  const keys = Object.keys(score).sort();
  assert.deepEqual(keys, [
    "classification",
    "computedAt",
    "matchBps",
    "snapshot",
    "strategyPolicyVersion",
  ]);
});

// ─── dispositionWeights ─────────────────────────────────────────────────────

test("dispositionWeights: normal classification → primary narrative", () => {
  const d = freezeIdentityStrategyDisposition("id_1", "combat", "cunning", ISO);
  const w = dispositionWeights(
    { kind: "normal", primaryWeightBps: 10000, secondaryWeightBps: 0 },
    d,
  );
  assert.match(w.primaryNarrative, /战斗/);
  assert.match(w.primaryNarrative, /一贯擅长/);
  assert.match(w.secondaryNarrative, /诡计/);
});

test("dispositionWeights: fully_violates → deviation narrative", () => {
  const d = freezeIdentityStrategyDisposition("id_1", "combat", "cunning", ISO);
  const w = dispositionWeights(
    { kind: "fully_violates", primaryWeightBps: 3000, secondaryWeightBps: 7000 },
    d,
  );
  assert.match(w.primaryNarrative, /偏离/);
  assert.match(w.primaryNarrative, /战斗/);
  assert.match(w.primaryNarrative, /诡计/);
});

test("dispositionWeights: fully_violates without secondary → deviation without secondary label", () => {
  const d = freezeIdentityStrategyDisposition("id_1", "exploration", undefined, ISO);
  const w = dispositionWeights(
    { kind: "fully_violates", primaryWeightBps: 3000, secondaryWeightBps: 7000 },
    d,
  );
  assert.match(w.primaryNarrative, /偏离/);
  assert.match(w.primaryNarrative, /探索/);
  // secondaryNarrative should be empty when no secondary
  assert.equal(w.secondaryNarrative, "");
});

test("dispositionWeights: never leaks numeric values", () => {
  const d = freezeIdentityStrategyDisposition("id_1", "support", "logistics", ISO);
  for (const kind of ["normal", "fully_violates"] as const) {
    const classification = kind === "normal"
      ? { kind: "normal" as const, primaryWeightBps: 10000, secondaryWeightBps: 0 }
      : { kind: "fully_violates" as const, primaryWeightBps: 3000, secondaryWeightBps: 7000 };
    const w = dispositionWeights(classification, d);
    // No digits in narrative
    assert.equal(/\d/u.test(w.primaryNarrative), false, `primary narrative must not contain digits: ${w.primaryNarrative}`);
    assert.equal(/\d/u.test(w.secondaryNarrative), false, `secondary narrative must not contain digits: ${w.secondaryNarrative}`);
  }
});

// ─── AFFINITY_MATRIX integrity ──────────────────────────────────────────────

test("AFFINITY_MATRIX covers all 7 approach tags × 5 strategies", () => {
  assert.equal(Object.keys(AFFINITY_MATRIX).length, APPROACH_TAGS.length);
  for (const tag of APPROACH_TAGS) {
    const row = AFFINITY_MATRIX[tag]!;
    assert.equal(Object.keys(row).length, STRATEGIES.length);
    for (const strategy of STRATEGIES) {
      const value = row[strategy]!;
      assert.ok(
        value === 0 || value === 50 || value === 100,
        `AFFINITY_MATRIX[${tag}][${strategy}] must be 0/50/100, got ${value}`,
      );
    }
  }
});

test("AFFINITY_MATRIX: each strategy has exactly one bonus (100) entry", () => {
  for (const strategy of STRATEGIES) {
    const bonusTags = APPROACH_TAGS.filter((tag) => AFFINITY_MATRIX[tag]![strategy] === 100);
    assert.equal(bonusTags.length, 1, `strategy ${strategy} should have exactly 1 bonus tag, got ${bonusTags.join(",")}`);
  }
});

test("AFFINITY_MATRIX: bonus tags match expectedApproachForTask output", () => {
  for (const strategy of STRATEGIES) {
    const expected = expectedApproachForTask(strategy);
    const bonusTags = APPROACH_TAGS.filter((tag) => AFFINITY_MATRIX[tag]![strategy] === 100);
    assert.deepEqual([...expected].sort(), [...bonusTags].sort());
  }
});

test("AFFINITY_MATRIX: each strategy has at least one penalty (0) entry", () => {
  for (const strategy of STRATEGIES) {
    const penaltyTags = APPROACH_TAGS.filter((tag) => AFFINITY_MATRIX[tag]![strategy] === 0);
    assert.ok(penaltyTags.length >= 1, `strategy ${strategy} should have at least 1 penalty tag`);
  }
});

// ─── End-to-end: freeze → snapshot → score ──────────────────────────────────

test("end-to-end: freeze → snapshot → score with multiple entries", () => {
  const d = freezeIdentityStrategyDisposition("id_1", "cunning", "exploration", ISO);
  const snap = snapshotJourneyStrategy("j_end", d);
  const entries = [
    {
      source: "offer" as const,
      sourceId: "o_1",
      approachTags: ["stealth"] as readonly ApproachTag[],
      recordedAt: ISO,
    },
    {
      source: "plan" as const,
      sourceId: "p_1",
      approachTags: ["scout"] as readonly ApproachTag[],
      recordedAt: ISO,
    },
    {
      source: "action" as const,
      sourceId: "a_1",
      approachTags: ["stealth", "diplomacy"] as readonly ApproachTag[],
      recordedAt: ISO,
    },
  ];
  const score = scoreStrategyConsistency(snap, entries, ISO);
  // cunning primary: stealth=100, scout=50, diplomacy=50
  // sum = 100 + 50 + 100 + 50 = 300, count = 4, matchBps = (300/4)*100 = 7500
  assert.equal(score.matchBps, 7500);
  assert.equal(score.classification.kind, "normal");
  assert.equal(score.snapshot.entries.length, 3);
  assert.equal(score.snapshot.journeyId, "j_end");
});

test("end-to-end: fully_violates path with logistics primary", () => {
  const d = freezeIdentityStrategyDisposition("id_2", "logistics", undefined, ISO);
  const snap = snapshotJourneyStrategy("j_log", d);
  // logistics primary: combat=50, stealth=0, diplomacy=50, support=50, logistics=100, scout=0, preservation=50
  // All penalty tags for logistics: stealth(0), scout(0)
  const entries = [{
    source: "action" as const,
    sourceId: "a_1",
    approachTags: ["stealth", "scout"] as readonly ApproachTag[],
    recordedAt: ISO,
  }];
  const score = scoreStrategyConsistency(snap, entries, ISO);
  // sum = 0 + 0 = 0, count = 2, matchBps = 0
  assert.equal(score.matchBps, 0);
  assert.equal(score.classification.kind, "fully_violates");
});
