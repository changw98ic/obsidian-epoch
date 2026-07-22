import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_ACTOR_MIND_CONFIG,
  actionProposal,
  actorMindConfig,
  riskToleranceForPosture,
  scoreActorGoalCandidate,
  selectActorGoals,
  type ActorMind,
  type GoalCandidate,
  type GoalScoreWeights,
} from "../lib/epoch/actorMindRules.ts";
import {
  DEFAULT_CAUSAL_SIMULATION_LOD_CONFIG,
  causalSimulationLodConfig,
  causalSimulationLodTickIntervalWorldMinutes,
  nextCausalSimulationLodDecision,
  preservedCausalSimulationState,
  shouldRunCausalSimulationLodTick,
  type CausalSimulationLod,
  type CausalSimulationLodSubjectState,
} from "../lib/epoch/causalSimulationLodRules.ts";

const ALL_SCORE_WEIGHTS: GoalScoreWeights = {
  needRelief: 1,
  valueFit: 1,
  roleDuty: 1,
  relationshipDuty: 1,
  expectedGain: 1,
  identityFit: 1,
  urgency: 1,
  feasibility: 1,
  expectedRiskPenalty: 1,
  resourceCostPenalty: 1,
  legalCostPenalty: 1,
  commitmentConflictPenalty: 1,
};

function actorMind(overrides: Partial<ActorMind> = {}): ActorMind {
  return {
    actorRef: "actor:lin",
    needs: [{
      needRef: "need:food",
      tier: "survival",
      label: "Food",
      current: 10,
      target: 90,
      urgency: 40,
      beliefRefs: ["belief:hungry"],
    }],
    values: [{
      valueRef: "value:honor",
      label: "Honor",
      weight: 70,
    }],
    roles: [{
      roleRef: "role:warden",
      dutyRef: "duty:guard",
      beneficiaryRef: "settlement:ash",
      weight: 60,
      beliefRefs: ["belief:oath"],
    }],
    beliefs: ["belief:alpha", "belief:beta", "belief:hungry", "belief:oath", "belief:tool"],
    relationships: [{
      relationshipRef: "relationship:mentor",
      targetActorRef: "actor:mei",
      dutyRef: "duty:protect",
      weight: 50,
      beliefRefs: ["belief:beta"],
    }],
    commitments: [{
      commitmentRef: "commitment:guard",
      kind: "vow",
      beneficiaryRef: "settlement:ash",
      contentRef: "content:guard_gate",
      cost: 25,
      breachConditionRef: "breach:abandon_gate",
      transferable: false,
      evidenceRefs: ["event:oath"],
      weight: 80,
      status: "active",
      beliefRefs: ["belief:oath"],
    }],
    activeGoals: [],
    queuedGoals: [],
    constraints: [],
    riskTolerance: 30,
    planningHorizonWorldMinutes: 120,
    simulationLod: 2,
    ...overrides,
  };
}

function goalCandidate(overrides: Partial<GoalCandidate> = {}): GoalCandidate {
  return {
    goalRef: "goal:feed_settlement",
    label: "Feed settlement",
    needRefs: ["need:food"],
    valueRefs: ["value:honor"],
    roleDutyRefs: ["duty:guard"],
    relationshipDutyRefs: ["duty:protect"],
    commitmentRefs: ["commitment:guard"],
    beliefRefs: ["belief:beta", "belief:alpha", "belief:missing", "belief:alpha"],
    expectedGain: 40,
    identityFit: 30,
    urgency: 20,
    feasibility: 10,
    expectedRisk: 45,
    resourceCost: 25,
    legalCost: 35,
    ...overrides,
  };
}

function scoredGoal(goalRef: string, score: number) {
  return {
    goalRef,
    label: goalRef,
    score,
    scoreBreakdown: {
      needRelief: 0,
      valueFit: 0,
      roleDuty: 0,
      relationshipDuty: 0,
      expectedGain: 0,
      identityFit: 0,
      urgency: 0,
      feasibility: 0,
      expectedRiskPenalty: 0,
      resourceCostPenalty: 0,
      legalCostPenalty: 0,
      commitmentConflictPenalty: 0,
      total: score,
    },
    supportingBeliefRefs: ["belief:alpha"],
    conflictingCommitmentRefs: [],
  };
}

function selectableGoal(goalRef: string, score: number): GoalCandidate {
  return goalCandidate({
    goalRef,
    label: goalRef,
    needRefs: [],
    valueRefs: [],
    roleDutyRefs: [],
    relationshipDutyRefs: [],
    commitmentRefs: ["commitment:guard"],
    beliefRefs: ["belief:alpha"],
    expectedGain: score,
    identityFit: 0,
    urgency: 0,
    feasibility: 0,
    expectedRisk: 0,
    resourceCost: 0,
    legalCost: 0,
  });
}

function lodSubject(overrides: Partial<CausalSimulationLodSubjectState> = {}): CausalSimulationLodSubjectState {
  return {
    subjectRef: "actor:lin",
    simulationLod: 2,
    lastInteractionWorldMinute: 0,
    lastChangedWorldMinute: 0,
    activePressureSeverity: 20,
    playerProximity: false,
    hasIrreversibleEvent: false,
    commitments: ["commitment:zeta", "commitment:alpha", "commitment:alpha", " "],
    debts: ["debt:grain"],
    injuries: ["injury:scar"],
    ownership: ["own:forge"],
    relationships: ["relationship:mentor"],
    keyBeliefs: ["belief:case", "belief:alpha"],
    openCases: ["case:missing"],
    ...overrides,
  };
}

test("actor mind config normalizes goal limits and clamps invalid scores", () => {
  const config = actorMindConfig({
    activeGoalSlots: 0,
    queuedGoalSlots: Number.NaN,
    maximumFallbackPlansPerGoal: -2,
    goalAdoptionThreshold: 120,
    goalReplacementMargin: -10,
    minimumCommitmentWeightToBlockGoal: Number.POSITIVE_INFINITY,
    needCriticalThreshold: 101,
    needRecoveryThreshold: -1,
    riskToleranceDefaults: {
      cautious: -30,
      normal: 150,
      bold: 70,
      reckless: 90,
    },
  });

  assert.equal(config.activeGoalSlots, DEFAULT_ACTOR_MIND_CONFIG.activeGoalSlots);
  assert.equal(config.queuedGoalSlots, DEFAULT_ACTOR_MIND_CONFIG.queuedGoalSlots);
  assert.equal(config.maximumFallbackPlansPerGoal, DEFAULT_ACTOR_MIND_CONFIG.maximumFallbackPlansPerGoal);
  assert.equal(config.goalAdoptionThreshold, 100);
  assert.equal(config.goalReplacementMargin, 0);
  assert.equal(config.minimumCommitmentWeightToBlockGoal, 0);
  assert.equal(config.needCriticalThreshold, 100);
  assert.equal(config.needRecoveryThreshold, 0);
  assert.equal(riskToleranceForPosture("cautious", config), 0);
  assert.equal(riskToleranceForPosture("normal", config), 100);
});

test("scoreActorGoalCandidate explains normalized needs values roles commitments and goals", () => {
  const scored = scoreActorGoalCandidate(actorMind(), goalCandidate(), {
    goalScoreWeights: ALL_SCORE_WEIGHTS,
    goalAdoptionThreshold: 1,
  });

  assert.equal(scored.goalRef, "goal:feed_settlement");
  assert.deepEqual(scored.supportingBeliefRefs, ["belief:alpha", "belief:beta"]);
  assert.deepEqual(scored.conflictingCommitmentRefs, []);
  assert.deepEqual(scored.blockedByCommitmentRefs, []);
  assert.equal(scored.scoreBreakdown.needRelief, 80);
  assert.equal(scored.scoreBreakdown.valueFit, 70);
  assert.equal(scored.scoreBreakdown.roleDuty, 60);
  assert.equal(scored.scoreBreakdown.relationshipDuty, 50);
  assert.equal(scored.scoreBreakdown.expectedGain, 40);
  assert.equal(scored.scoreBreakdown.identityFit, 30);
  assert.equal(scored.scoreBreakdown.urgency, 20);
  assert.equal(scored.scoreBreakdown.feasibility, 10);
  assert.equal(scored.scoreBreakdown.expectedRiskPenalty, 15);
  assert.equal(scored.scoreBreakdown.resourceCostPenalty, 25);
  assert.equal(scored.scoreBreakdown.legalCostPenalty, 35);
  assert.equal(scored.scoreBreakdown.commitmentConflictPenalty, 0);
  assert.equal(scored.score, 285);
  assert.equal(scored.adopted, true);
});

test("scoreActorGoalCandidate clamps illegal candidate and actor values", () => {
  const scored = scoreActorGoalCandidate(
    actorMind({
      needs: [{
        needRef: "need:food",
        tier: "survival",
        label: "Food",
        current: -50,
        target: 150,
        urgency: Number.NaN,
        beliefRefs: ["belief:hungry"],
      }],
      values: [{ valueRef: "value:honor", label: "Honor", weight: 150 }],
      roles: [{
        roleRef: "role:warden",
        dutyRef: "duty:guard",
        beneficiaryRef: "settlement:ash",
        weight: -40,
        beliefRefs: [],
      }],
      relationships: [{
        relationshipRef: "relationship:mentor",
        targetActorRef: "actor:mei",
        dutyRef: "duty:protect",
        weight: Number.POSITIVE_INFINITY,
        beliefRefs: [],
      }],
      riskTolerance: 140,
    }),
    goalCandidate({
      expectedGain: 150,
      identityFit: Number.NaN,
      urgency: -10,
      feasibility: 101,
      expectedRisk: 120,
      resourceCost: Number.POSITIVE_INFINITY,
      legalCost: -5,
    }),
    { goalScoreWeights: ALL_SCORE_WEIGHTS },
  );

  assert.equal(scored.scoreBreakdown.needRelief, 100);
  assert.equal(scored.scoreBreakdown.valueFit, 100);
  assert.equal(scored.scoreBreakdown.roleDuty, 0);
  assert.equal(scored.scoreBreakdown.relationshipDuty, 0);
  assert.equal(scored.scoreBreakdown.expectedGain, 100);
  assert.equal(scored.scoreBreakdown.identityFit, 0);
  assert.equal(scored.scoreBreakdown.urgency, 0);
  assert.equal(scored.scoreBreakdown.feasibility, 100);
  assert.equal(scored.scoreBreakdown.expectedRiskPenalty, 0);
  assert.equal(scored.scoreBreakdown.resourceCostPenalty, 0);
  assert.equal(scored.scoreBreakdown.legalCostPenalty, 0);
});

test("selectActorGoals enforces three active and five queued goals with deterministic ordering", () => {
  const result = selectActorGoals(
    actorMind(),
    [
      selectableGoal("goal:c", 90),
      selectableGoal("goal:b", 90),
      selectableGoal("goal:a", 90),
      selectableGoal("goal:h", 80),
      selectableGoal("goal:g", 80),
      selectableGoal("goal:f", 80),
      selectableGoal("goal:e", 80),
      selectableGoal("goal:d", 80),
      selectableGoal("goal:i", 70),
    ],
    {
      goalAdoptionThreshold: 1,
      goalScoreWeights: {
        ...ALL_SCORE_WEIGHTS,
        expectedGain: 1,
      },
    },
  );

  assert.deepEqual(result.activeGoals.map((goal) => goal.goalRef), ["goal:a", "goal:b", "goal:c"]);
  assert.deepEqual(result.queuedGoals.map((goal) => goal.goalRef), [
    "goal:d",
    "goal:e",
    "goal:f",
    "goal:g",
    "goal:h",
  ]);
  assert.deepEqual(result.rejectedGoals.map((goal) => goal.goalRef), ["goal:i"]);
});

test("selectActorGoals replaces active goals only when the replacement margin is met", () => {
  const blockedByMargin = selectActorGoals(
    actorMind({ activeGoals: [scoredGoal("goal:old", 80)] }),
    [selectableGoal("goal:new", 91)],
    {
      activeGoalSlots: 1,
      queuedGoalSlots: 5,
      goalAdoptionThreshold: 1,
      goalReplacementMargin: 12,
      goalScoreWeights: ALL_SCORE_WEIGHTS,
    },
  );
  const replaced = selectActorGoals(
    actorMind({ activeGoals: [scoredGoal("goal:old", 80)] }),
    [selectableGoal("goal:new", 92)],
    {
      activeGoalSlots: 1,
      queuedGoalSlots: 5,
      goalAdoptionThreshold: 1,
      goalReplacementMargin: 12,
      goalScoreWeights: ALL_SCORE_WEIGHTS,
    },
  );

  assert.deepEqual(blockedByMargin.activeGoals.map((goal) => goal.goalRef), ["goal:old"]);
  assert.deepEqual(blockedByMargin.queuedGoals.map((goal) => goal.goalRef), ["goal:new"]);
  assert.deepEqual(replaced.activeGoals.map((goal) => goal.goalRef), ["goal:new"]);
  assert.deepEqual(replaced.queuedGoals.map((goal) => goal.goalRef), []);
});

test("scoreActorGoalCandidate rejects goals blocked by active conflicting commitments", () => {
  const scored = scoreActorGoalCandidate(actorMind(), goalCandidate({ commitmentRefs: [] }), {
    goalAdoptionThreshold: 1,
    goalScoreWeights: ALL_SCORE_WEIGHTS,
    minimumCommitmentWeightToBlockGoal: 65,
  });

  assert.deepEqual(scored.conflictingCommitmentRefs, ["commitment:guard"]);
  assert.equal(scored.scoreBreakdown.commitmentConflictPenalty, 80);
  assert.equal(scored.adopted, false);
});

test("actionProposal includes only referenced known beliefs and validates unknown belief refs", () => {
  const proposal = actionProposal({
    proposalRef: "proposal:feed",
    actorMind: actorMind(),
    goal: {
      goalRef: "goal:feed_settlement",
      supportingBeliefRefs: ["belief:beta", "belief:alpha"],
    },
    beliefRefs: ["belief:tool", "belief:alpha"],
    intendedEffects: [{
      effectRef: "effect:food",
      effectType: "resource_transfer",
      targetRefs: ["resource:grain", "actor:lin"],
      basisBeliefRefs: ["belief:hungry"],
    }],
    requiredResources: [{
      resourceRef: "resource:grain",
      quantity: 3,
      basisBeliefRefs: ["belief:tool"],
    }],
    requiredCapabilities: [{
      capabilityRef: "capability:carry",
      minimumLevel: 1,
      basisBeliefRefs: ["belief:alpha"],
    }],
    requiredTimeWorldMinutes: 0,
    fallbackPlans: [
      { planRef: "plan:wrong_goal", goalRef: "goal:other", beliefRefs: ["belief:alpha"] },
      { planRef: "plan:b", goalRef: "goal:feed_settlement", beliefRefs: ["belief:beta"] },
      { planRef: "plan:a", goalRef: "goal:feed_settlement", beliefRefs: ["belief:alpha"] },
      { planRef: "plan:c", goalRef: "goal:feed_settlement", beliefRefs: ["belief:tool"] },
    ],
    submittedAtWorldMinute: 1_000,
    config: { maximumFallbackPlansPerGoal: 2 },
  });

  assert.deepEqual(proposal.beliefRefs, ["belief:alpha", "belief:beta", "belief:hungry", "belief:tool"]);
  assert.deepEqual(proposal.targetRefs, ["actor:lin", "resource:grain"]);
  assert.deepEqual(proposal.fallbackPlanRefs, ["plan:a", "plan:b"]);
  assert.equal(proposal.requiredTimeWorldMinutes, 1);
  assert.equal(proposal.expiresAtWorldMinute, 1_120);
  assert.throws(() => actionProposal({
    actorMind: actorMind(),
    goal: {
      goalRef: "goal:feed_settlement",
      supportingBeliefRefs: ["belief:unknown"],
    },
    beliefRefs: [],
    intendedEffects: [],
    requiredTimeWorldMinutes: 1,
    submittedAtWorldMinute: 1_000,
  }), /action_proposal_unknown_belief_ref/);
});

test("causal simulation LOD catalog exposes levels zero through three and their tick intervals", () => {
  const config = causalSimulationLodConfig();

  assert.deepEqual(config.levels.map((level) => ({
    id: level.id,
    label: level.label,
    tickIntervalWorldMinutes: level.tickIntervalWorldMinutes,
  })), [
    { id: 0, label: "aggregate", tickIntervalWorldMinutes: 1440 },
    { id: 1, label: "named_background", tickIntervalWorldMinutes: 360 },
    { id: 2, label: "important_active", tickIntervalWorldMinutes: 60 },
    { id: 3, label: "present_or_journey", tickIntervalWorldMinutes: 5 },
  ]);
  assert.deepEqual(config.levels.map((level) => level.id), [0, 1, 2, 3]);
  assert.equal(causalSimulationLodTickIntervalWorldMinutes(0), 1440);
  assert.equal(causalSimulationLodTickIntervalWorldMinutes(1), 360);
  assert.equal(causalSimulationLodTickIntervalWorldMinutes(2), 60);
  assert.equal(causalSimulationLodTickIntervalWorldMinutes(3), 5);
});

test("nextCausalSimulationLodDecision promotes on threshold reasons and reports the next tick interval", () => {
  const decision = nextCausalSimulationLodDecision({
    subject: lodSubject({
      simulationLod: 1,
      activePressureSeverity: 75,
      playerProximity: true,
      hasIrreversibleEvent: true,
      nextCommitmentDueAtWorldMinute: 1_100,
    }),
    currentWorldMinute: 1_000,
  });

  assert.equal(decision.action, "promote");
  assert.equal(decision.fromLod, 1);
  assert.equal(decision.toLod, 2);
  assert.equal(decision.tickIntervalWorldMinutes, 60);
  assert.deepEqual(decision.reasons, [
    "commitment_due",
    "critical_pressure",
    "irreversible_event",
    "player_proximity",
  ]);
});

test("nextCausalSimulationLodDecision demotes only after quiet low-pressure non-proximate state", () => {
  const decision = nextCausalSimulationLodDecision({
    subject: lodSubject({
      simulationLod: 2,
      lastInteractionWorldMinute: 100,
      lastChangedWorldMinute: 200,
      activePressureSeverity: 29,
      playerProximity: false,
      hasIrreversibleEvent: false,
    }),
    currentWorldMinute: 10_280,
  });

  assert.equal(decision.action, "demote");
  assert.equal(decision.fromLod, 2);
  assert.equal(decision.toLod, 1);
  assert.equal(decision.tickIntervalWorldMinutes, 360);
  assert.deepEqual(decision.reasons, [
    "low_pressure",
    "no_irreversible_event",
    "not_player_proximate",
    "quiet_long_enough",
  ]);
});

test("demotion snapshots preserve commitments debts injuries ownership relationships key beliefs and open cases", () => {
  const snapshot = preservedCausalSimulationState(lodSubject());
  const decision = nextCausalSimulationLodDecision({
    subject: lodSubject(),
    currentWorldMinute: DEFAULT_CAUSAL_SIMULATION_LOD_CONFIG.demotion.minimumQuietWorldMinutes,
  });

  assert.deepEqual(snapshot, {
    commitments: ["commitment:alpha", "commitment:zeta"],
    debts: ["debt:grain"],
    injuries: ["injury:scar"],
    ownership: ["own:forge"],
    relationships: ["relationship:mentor"],
    keyBeliefs: ["belief:alpha", "belief:case"],
    openCases: ["case:missing"],
  });
  assert.deepEqual(decision.preservedState, snapshot);
});

test("shouldRunCausalSimulationLodTick uses deterministic LOD tick intervals", () => {
  assert.equal(shouldRunCausalSimulationLodTick(3, undefined, 10), true);
  assert.equal(shouldRunCausalSimulationLodTick(3, 10, 14), false);
  assert.equal(shouldRunCausalSimulationLodTick(3, 10, 15), true);
  assert.equal(shouldRunCausalSimulationLodTick(0, 10, 1_449), false);
  assert.equal(shouldRunCausalSimulationLodTick(0, 10, 1_450), true);
});

test("nextCausalSimulationLodDecision clamps illegal LOD values into the supported range", () => {
  const low = nextCausalSimulationLodDecision({
    subject: lodSubject({ simulationLod: -1 as CausalSimulationLod }),
    currentWorldMinute: 1_000,
  });
  const high = nextCausalSimulationLodDecision({
    subject: lodSubject({ simulationLod: 99 as CausalSimulationLod }),
    currentWorldMinute: 1_000,
  });

  assert.equal(low.fromLod, 0);
  assert.equal(low.toLod, 0);
  assert.equal(high.fromLod, 3);
  assert.equal(high.toLod, 3);
});
