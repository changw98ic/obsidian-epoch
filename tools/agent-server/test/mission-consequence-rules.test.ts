import assert from "node:assert/strict";
import test from "node:test";

import {
  MISSION_CONSEQUENCE_RULES_VERSION,
  MISSION_OUTCOMES,
  MISSION_STATUSES,
  MISSION_TERMINAL_STATUSES,
  calculateMissionIntensity,
  intensityBand,
  missionObjectiveCompletionBps,
  nextMissionStatusForOutcome,
  proposeMissionConsequences,
  scoreGrade,
  scoreMission,
  validateMissionConsequenceInput,
  validateMissionContract,
  validateMissionTransition,
  type MissionContract,
  type MissionConsequenceInput,
  type MissionIntensityInput,
  type MissionObjective,
  type MissionOutcome,
} from "../lib/epoch/missionConsequenceRules.ts";

function objective(overrides: Partial<MissionObjective> = {}): MissionObjective {
  return {
    objectiveId: "objective_rescue",
    title: "Rescue survivors",
    targetRef: { entityType: "settlement", entityId: "gray_harbor" },
    operator: "state_is",
    expectedValue: "safe",
    observableWorldStateRef: "world_state:gray_harbor:safety",
    required: true,
    weight: 3,
    ...overrides,
  };
}

function missionContract(overrides: Partial<MissionContract> = {}): MissionContract {
  return {
    contractId: "mission_gray_harbor_rescue",
    worldId: "world_obsidian_epoch",
    status: "active",
    interventionFamily: "combat",
    rootPressureIds: ["pressure_harbor_siege"],
    sponsorRef: "faction:harbor_council",
    beneficiaryRefs: ["settlement:gray_harbor"],
    oppositionRefs: ["faction:ash_raiders"],
    objectivePredicates: [
      objective(),
      objective({
        objectiveId: "objective_secure_gate",
        title: "Secure the gate",
        targetRef: { entityType: "site", entityId: "north_gate" },
        operator: "gte",
        expectedValue: 80,
        observableWorldStateRef: "world_state:north_gate:control",
        required: false,
        weight: 1,
      }),
    ],
    availableEvidenceRefs: ["evidence:scout_report"],
    hiddenInformationRefs: ["secret:raider_route"],
    legalConstraintRefs: ["law:evacuation_authority"],
    rewardFundingRef: "treasury:harbor_council",
    rewardProposals: [{
      resourceKey: "coin",
      resourceClass: "currency",
      unit: "minor",
      quantityMinor: "1000",
      payerAccountRef: "account:council",
      recipientAccountRef: "account:player",
      fundingRef: "treasury:harbor_council",
    }],
    resourceStakes: [{
      resourceKey: "medkit",
      resourceClass: "supply",
      unit: "item",
      maxSpendMinor: "3",
      accountRef: "account:player",
    }],
    risk: {
      opposition: 70,
      environmentalHazard: 30,
      objectiveComplexity: 60,
      informationUncertainty: 40,
      logisticalBurden: 20,
      legalPoliticalRisk: 10,
      irreversibility: 50,
    },
    offeredAtWorldMinute: 1_000,
    acceptedAtWorldMinute: 1_010,
    activeAtWorldMinute: 1_020,
    expiresAtWorldMinute: 1_400,
    authorizationRefs: ["authorization:mission_board"],
    causalParentEventIds: ["event:pressure_opened"],
    ...overrides,
  };
}

function consequenceInput(
  outcome: MissionOutcome,
  overrides: Partial<MissionConsequenceInput> = {},
): MissionConsequenceInput {
  return {
    contract: missionContract(),
    outcome,
    objectiveResults: [
      { objectiveId: "objective_rescue", completedBps: 5_000, required: true },
      { objectiveId: "objective_secure_gate", completedBps: 10_000, required: false },
    ],
    actorRef: "actor:player",
    occurredAtWorldMinute: 1_200,
    sourceEventIds: ["event:mission_resolution"],
    resourceCosts: [{
      resourceKey: "medkit",
      resourceClass: "supply",
      unit: "item",
      accountRef: "account:player",
      deltaMinor: "-1",
      sourceOrSinkRef: "sink:mission_cost",
      reasonCode: "mission_resource_spent",
    }],
    existingStress: 40,
    existingInjurySeverity: 10,
    ...overrides,
  };
}

function baseIntensity(overrides: Partial<MissionIntensityInput> = {}): MissionIntensityInput {
  return {
    enemyHostilePower: 70,
    enemyCoordination: 60,
    environmentalHazard: 40,
    objectiveComplexity: 65,
    informationUncertainty: 35,
    logisticalBurden: 45,
    legalPoliticalRisk: 25,
    irreversibility: 55,
    resourcePressure: 50,
    worldPressure: 75,
    playerCombatPower: 35,
    ...overrides,
  };
}

test("exports mission lifecycle and outcome catalogs used by contracts", () => {
  assert.deepEqual(MISSION_STATUSES, [
    "offered",
    "accepted",
    "active",
    "resolved",
    "failed",
    "abandoned",
    "expired",
  ]);
  assert.deepEqual(MISSION_OUTCOMES, [
    "clean_success",
    "costly_success",
    "partial_success",
    "stalemate",
    "withdrawal",
    "failure",
    "catastrophe",
    "timeout",
  ]);
  assert.equal(MISSION_TERMINAL_STATUSES.has("resolved"), true);
  assert.equal(MISSION_TERMINAL_STATUSES.has("active"), false);
});

test("accepts a complete MissionContract with observable objective predicates", () => {
  const result = validateMissionContract(missionContract({
    objectivePredicates: [
      objective({ operator: "eq", expectedValue: "sealed" }),
      objective({ objectiveId: "objective_not_taken", operator: "neq", expectedValue: "captured" }),
      objective({ objectiveId: "objective_supply", operator: "contains", expectedValue: "grain" }),
      objective({ objectiveId: "objective_witness", operator: "exists", expectedValue: true }),
      objective({ objectiveId: "objective_damage", operator: "lte", expectedValue: 20 }),
      objective({ objectiveId: "objective_state", operator: "state_is", expectedValue: "stable" }),
    ],
  }));

  assert.equal(result.ok, true);
  assert.deepEqual(result.issues, []);
});

test("rejects invalid MissionContract identifiers, targets, funding, timing, and risk", () => {
  const result = validateMissionContract(missionContract({
    contractId: " ",
    worldId: "",
    status: "paused" as MissionContract["status"],
    rootPressureIds: [" "],
    rewardFundingRef: undefined,
    expiresAtWorldMinute: 900,
    acceptedAtWorldMinute: 999,
    activeAtWorldMinute: 998,
    objectivePredicates: [
      objective({
        objectiveId: "",
        targetRef: { entityType: "", entityId: "" },
        weight: 0,
      }),
    ],
    risk: {
      opposition: 101,
      environmentalHazard: -1,
      objectiveComplexity: Number.NaN,
      informationUncertainty: 40,
      logisticalBurden: 20,
      legalPoliticalRisk: 10,
      irreversibility: 50,
    },
  }));

  assert.equal(result.ok, false);
  assert.deepEqual(result.issues.map((issue) => issue.code), [
    "mission_contract_id_required",
    "mission_world_id_required",
    "mission_invalid_status",
    "mission_root_pressure_required",
    "mission_objective_id_required",
    "mission_objective_target_required",
    "mission_value_out_of_range",
    "mission_reward_source_required",
    "mission_expiry_before_offer",
    "mission_accepted_before_offer",
    "mission_active_before_acceptance",
    "mission_value_out_of_range",
    "mission_value_out_of_range",
    "mission_value_out_of_range",
  ]);
});

test("allows only legal non-terminal mission state transitions", () => {
  assert.deepEqual(validateMissionTransition("offered", "accepted"), {
    allowed: true,
    fromStatus: "offered",
    toStatus: "accepted",
    reasonCode: "mission_status_changed",
    issues: [],
  });
  assert.equal(validateMissionTransition("active", "resolved", "mission_clean_success").allowed, true);
  assert.equal(validateMissionTransition("active", "failed", "mission_failure").allowed, true);
  assert.equal(validateMissionTransition("active", "abandoned", "mission_withdrawal").allowed, true);
  assert.equal(validateMissionTransition("active", "expired", "mission_timeout").allowed, true);
});

test("rejects illegal and terminal mission state transitions", () => {
  const illegal = validateMissionTransition("offered", "resolved");
  const terminal = validateMissionTransition("resolved", "active");

  assert.equal(illegal.allowed, false);
  assert.equal(illegal.issues[0]?.code, "mission_invalid_transition");
  assert.equal(terminal.allowed, false);
  assert.equal(terminal.issues[0]?.code, "mission_terminal_transition");
});

test("maps mission outcomes onto terminal lifecycle states", () => {
  assert.equal(nextMissionStatusForOutcome("clean_success"), "resolved");
  assert.equal(nextMissionStatusForOutcome("costly_success"), "resolved");
  assert.equal(nextMissionStatusForOutcome("partial_success"), "resolved");
  assert.equal(nextMissionStatusForOutcome("withdrawal"), "abandoned");
  assert.equal(nextMissionStatusForOutcome("timeout"), "expired");
  assert.equal(nextMissionStatusForOutcome("failure"), "failed");
  assert.equal(nextMissionStatusForOutcome("catastrophe"), "failed");
  assert.equal(nextMissionStatusForOutcome("stalemate"), "failed");
});

test("computes weighted partial objective progress and clamps result bps", () => {
  const result = missionObjectiveCompletionBps(missionContract().objectivePredicates, [
    { objectiveId: "objective_rescue", completedBps: 2_500, required: true },
    { objectiveId: "objective_secure_gate", completedBps: 20_000, required: false },
    { objectiveId: "objective_unknown", completedBps: 10_000, required: false },
  ]);

  assert.equal(result, 4_375);
});

test("returns zero objective completion when the contract has no target predicates", () => {
  assert.equal(missionObjectiveCompletionBps([], [
    { objectiveId: "objective_any", completedBps: 10_000, required: true },
  ]), 0);
});

test("validates consequence inputs and requires source events plus bounded objective progress", () => {
  const result = validateMissionConsequenceInput(consequenceInput("failure", {
    sourceEventIds: [],
    objectiveResults: [{ objectiveId: "objective_rescue", completedBps: 10_001, required: true }],
  }));

  assert.equal(result.ok, false);
  assert.deepEqual(result.issues.map((issue) => issue.code), [
    "mission_effect_source_required",
    "mission_value_out_of_range",
  ]);
});

test("costly success produces persistent resource, reputation, injury, stress, pressure, and knowledge consequences", () => {
  const proposal = proposeMissionConsequences(consequenceInput("costly_success"));

  assert.equal(proposal.rulesetVersion, MISSION_CONSEQUENCE_RULES_VERSION);
  assert.equal(proposal.persistentConsequence, true);
  assert.equal(proposal.stateTransition.allowed, true);
  assert.equal(proposal.stateTransition.toStatus, "resolved");
  assert.equal(proposal.resourceConsequences.some((item) => item.reasonCode === "mission_costly_success_reward"), true);
  assert.equal(proposal.reputationConsequences.some((item) => item.delta > 0), true);
  assert.equal(proposal.injuryConsequences.some((item) => item.severity > 0), true);
  assert.equal(proposal.stressConsequences.some((item) => item.delta > 0), true);
  assert.equal(proposal.pressureConsequences.some((item) => item.delta < 0), true);
  assert.equal(proposal.knowledgeConsequences.some((item) => item.confidenceDelta > 0), true);
});

test("failure produces persistent resource, reputation, injury, stress, pressure, and knowledge consequences", () => {
  const proposal = proposeMissionConsequences(consequenceInput("failure"));

  assert.equal(proposal.persistentConsequence, true);
  assert.equal(proposal.stateTransition.toStatus, "failed");
  assert.equal(proposal.resourceConsequences.some((item) => item.deltaMinor === "-1"), true);
  assert.equal(proposal.reputationConsequences.some((item) => item.delta < 0), true);
  assert.equal(proposal.injuryConsequences.some((item) => item.severity > 0), true);
  assert.equal(proposal.stressConsequences.some((item) => item.delta > 0), true);
  assert.equal(proposal.pressureConsequences.some((item) => item.delta > 0), true);
  assert.equal(proposal.knowledgeConsequences.some((item) => item.reasonCode === "mission_failure_knowledge"), true);
});

test("withdrawal produces persistent resource, reputation, injury, stress, pressure, and knowledge consequences", () => {
  const proposal = proposeMissionConsequences(consequenceInput("withdrawal"));

  assert.equal(proposal.persistentConsequence, true);
  assert.equal(proposal.stateTransition.toStatus, "abandoned");
  assert.equal(proposal.resourceConsequences.some((item) => item.deltaMinor === "-1"), true);
  assert.equal(proposal.reputationConsequences.some((item) => item.delta > 0), true);
  assert.equal(proposal.injuryConsequences.some((item) => item.severity > 0), true);
  assert.equal(proposal.stressConsequences.some((item) => item.delta > 0), true);
  assert.equal(proposal.pressureConsequences.some((item) => item.delta > 0), true);
  assert.equal(proposal.knowledgeConsequences.length > 0, true);
});

test("timeout produces persistent resource, reputation, injury, stress, pressure, and knowledge consequences", () => {
  const proposal = proposeMissionConsequences(consequenceInput("timeout"));

  assert.equal(proposal.persistentConsequence, true);
  assert.equal(proposal.stateTransition.toStatus, "expired");
  assert.equal(proposal.resourceConsequences.some((item) => item.deltaMinor === "-1"), true);
  assert.equal(proposal.reputationConsequences.some((item) => item.delta > 0), true);
  assert.equal(proposal.injuryConsequences.some((item) => item.severity > 0), true);
  assert.equal(proposal.stressConsequences.some((item) => item.delta > 0), true);
  assert.equal(proposal.pressureConsequences.some((item) => item.delta > 0), true);
  assert.equal(proposal.knowledgeConsequences.length > 0, true);
});

test("builds causal effects from the proposal source and remains deterministic", () => {
  const input = consequenceInput("costly_success", {
    authorizationRefs: ["authorization:field_order"],
    discoveredKnowledge: [{
      subjectRef: "actor:player",
      knowledgeKey: "knowledge:raider_route",
      confidenceDelta: 150,
      reasonCode: "mission_discovered_route",
    }],
  });
  const left = proposeMissionConsequences(input);
  const right = proposeMissionConsequences(input);

  assert.deepEqual(left, right);
  assert.equal(left.causalEffects.every((effect) => effect.sourceEventIds.includes("event:mission_resolution")), true);
  assert.equal(left.causalEffects.every((effect) => effect.authorizationRefs.includes("authorization:field_order")), true);
  assert.equal(left.causalEffects.some((effect) => effect.effectId === "mission:mission_gray_harbor_rescue:state:0"), true);
  assert.equal(left.causalEffects.some((effect) => effect.effectType === "knowledge_delta"), true);
  assert.equal(
    left.causalEffects.some((effect) =>
      effect.effectType === "knowledge_delta"
      && typeof effect.after === "object"
      && effect.after !== null
      && "confidenceDelta" in effect.after
      && effect.after.confidenceDelta === 99),
    true,
  );
});

test("mission intensity combines opposition, environment, objectives, resources, world pressure, and readiness", () => {
  const low = calculateMissionIntensity(baseIntensity({
    enemyHostilePower: 10,
    enemyCoordination: 10,
    environmentalHazard: 10,
    objectiveComplexity: 10,
    informationUncertainty: 10,
    logisticalBurden: 10,
    legalPoliticalRisk: 10,
    irreversibility: 10,
    resourcePressure: 10,
    worldPressure: 10,
    playerCombatPower: 100,
  }));
  const high = calculateMissionIntensity(baseIntensity({
    enemyHostilePower: 90,
    enemyCoordination: 90,
    environmentalHazard: 90,
    objectiveComplexity: 90,
    informationUncertainty: 90,
    logisticalBurden: 90,
    legalPoliticalRisk: 90,
    irreversibility: 90,
    resourcePressure: 90,
    worldPressure: 90,
    playerCombatPower: 10,
  }));

  assert.equal(low.band, "low");
  assert.equal(high.band, "extreme");
  assert.equal(high.total > low.total, true);
  assert.equal(high.opposition > low.opposition, true);
  assert.equal(high.environment > low.environment, true);
  assert.equal(high.objectives > low.objectives, true);
  assert.equal(high.resources > low.resources, true);
  assert.equal(high.worldPressure > low.worldPressure, true);
  assert.equal(high.readinessGap > low.readinessGap, true);
});

test("changes only player combat power to reduce encounter intensity without changing world intensity", () => {
  const underpowered = calculateMissionIntensity(baseIntensity({ playerCombatPower: 20 }));
  const prepared = calculateMissionIntensity(baseIntensity({ playerCombatPower: 200 }));

  assert.equal(underpowered.worldIntensity, prepared.worldIntensity);
  assert.equal(underpowered.worldPressureBand, prepared.worldPressureBand);
  assert.equal(underpowered.playerCombatRatio < prepared.playerCombatRatio, true);
  assert.equal(underpowered.readinessGap > prepared.readinessGap, true);
  assert.equal(underpowered.encounterIntensity > prepared.encounterIntensity, true);
});

test("clamps mission intensity zero denominators and extreme inputs into bounded values", () => {
  const result = calculateMissionIntensity(baseIntensity({
    enemyHostilePower: -100,
    enemyCoordination: 500,
    environmentalHazard: Number.POSITIVE_INFINITY,
    objectiveComplexity: -20,
    informationUncertainty: 120,
    logisticalBurden: Number.NaN,
    legalPoliticalRisk: 300,
    irreversibility: -1,
    resourcePressure: 500,
    worldPressure: -500,
    playerCombatPower: 50_000,
  }));

  assert.equal(result.opposition, 20);
  assert.equal(result.environment, 0);
  assert.equal(result.objectives, 0);
  assert.equal(result.resources, 100);
  assert.equal(result.worldPressure, 0);
  assert.equal(result.playerCombatRatio, 10);
  assert.equal(result.readinessGap, 0);
  assert.equal(result.total >= 0 && result.total <= 100, true);
});

test("maps intensity and score grade boundaries with clamping", () => {
  assert.equal(intensityBand(-1), "low");
  assert.equal(intensityBand(35), "medium");
  assert.equal(intensityBand(60), "high");
  assert.equal(intensityBand(80), "extreme");
  assert.equal(intensityBand(Number.POSITIVE_INFINITY), "low");
  assert.equal(scoreGrade(39), "D");
  assert.equal(scoreGrade(40), "C");
  assert.equal(scoreGrade(55), "B");
  assert.equal(scoreGrade(70), "A");
  assert.equal(scoreGrade(85), "S");
  assert.equal(scoreGrade(95), "SS");
  assert.equal(scoreGrade(Number.POSITIVE_INFINITY), "D");
});

test("scores objective, causal, execution, risk, efficiency, survival, and integrity breakdowns", () => {
  const score = scoreMission({
    objectiveCompletionBps: 8_000,
    pressureReliefBps: 7_000,
    sideEffectControlBps: 9_000,
    executionQualityBps: 6_000,
    meaningfulRiskBps: 5_000,
    riskExposureBps: 8_000,
    resourceEfficiencyBps: 4_000,
    survivalBps: 10_000,
    integrityBps: 3_000,
  });

  assert.equal(score.objective, 80);
  assert.equal(score.causalImpact, 76);
  assert.equal(score.execution, 60);
  assert.equal(score.risk, 56);
  assert.equal(score.efficiency, 40);
  assert.equal(score.survival, 100);
  assert.equal(score.integrity, 30);
  assert.equal(score.antiFarmDecay, 0);
  assert.equal(score.rawScore, 66);
  assert.equal(score.finalScore, 66);
  assert.equal(score.grade, "B");
});

test("applies anti-farm decay to mission scores", () => {
  const normal = scoreMission({
    objectiveCompletionBps: 10_000,
    pressureReliefBps: 10_000,
    sideEffectControlBps: 10_000,
    executionQualityBps: 10_000,
    meaningfulRiskBps: 10_000,
    riskExposureBps: 10_000,
    resourceEfficiencyBps: 10_000,
    survivalBps: 10_000,
    integrityBps: 10_000,
  });
  const farmed = scoreMission({
    objectiveCompletionBps: 10_000,
    pressureReliefBps: 10_000,
    sideEffectControlBps: 10_000,
    executionQualityBps: 10_000,
    meaningfulRiskBps: 10_000,
    riskExposureBps: 10_000,
    resourceEfficiencyBps: 10_000,
    survivalBps: 10_000,
    integrityBps: 10_000,
    recentSimilarCompletionCount: 4,
    repeatedResolutionFamilyCount: 3,
  });

  assert.equal(normal.rawScore, 100);
  assert.equal(normal.finalScore, 100);
  assert.equal(farmed.antiFarmDecay, 43);
  assert.equal(farmed.rawScore, 100);
  assert.equal(farmed.finalScore, 65);
  assert.equal(farmed.finalScore < normal.finalScore, true);
  assert.equal(Math.round(farmed.dimensions.reduce((sum, dimension) => sum + dimension.contribution, 0)), farmed.finalScore);
  assert.equal(
    farmed.dimensions.find((dimension) => dimension.dimensionId === "antiFarmDecay")?.reasonCode,
    "mission_score_anti_farm_decay",
  );
});

test("does not directly use combat power or suitability in task scoring", () => {
  const weakCombat = scoreMission({
    objectiveCompletionBps: 8_000,
    pressureReliefBps: 8_000,
    sideEffectControlBps: 8_000,
    executionQualityBps: 5_000,
    meaningfulRiskBps: 6_000,
    riskExposureBps: 6_000,
    resourceEfficiencyBps: 7_000,
    survivalBps: 9_000,
    integrityBps: 9_000,
  });
  const strongCombat = scoreMission({
    objectiveCompletionBps: 8_000,
    pressureReliefBps: 8_000,
    sideEffectControlBps: 8_000,
    executionQualityBps: 5_000,
    meaningfulRiskBps: 6_000,
    riskExposureBps: 6_000,
    resourceEfficiencyBps: 7_000,
    survivalBps: 9_000,
    integrityBps: 9_000,
  });
  const poorMission = scoreMission({
    objectiveCompletionBps: 0,
    pressureReliefBps: 0,
    sideEffectControlBps: 0,
    executionQualityBps: 0,
    meaningfulRiskBps: 0,
    riskExposureBps: 0,
    resourceEfficiencyBps: 0,
    survivalBps: 0,
    integrityBps: 0,
  });

  assert.equal(strongCombat.execution, weakCombat.execution);
  assert.equal(strongCombat.finalScore, weakCombat.finalScore);
  assert.equal(poorMission.finalScore < weakCombat.finalScore, true);
});

test("clamps score inputs and never lets invalid numeric extremes escape", () => {
  const score = scoreMission({
    objectiveCompletionBps: Number.POSITIVE_INFINITY,
    pressureReliefBps: Number.NaN,
    sideEffectControlBps: -10_000,
    executionQualityBps: Number.NEGATIVE_INFINITY,
    riskExposureBps: 100_000,
    meaningfulRiskBps: 100_000,
    resourceEfficiencyBps: 100_000,
    survivalBps: -1,
    integrityBps: 100_000,
    recentSimilarCompletionCount: 100,
    repeatedResolutionFamilyCount: 100,
  });

  assert.equal(score.objective, 0);
  assert.equal(score.causalImpact, 0);
  assert.equal(score.execution, 0);
  assert.equal(score.risk, 100);
  assert.equal(score.efficiency, 100);
  assert.equal(score.survival, 0);
  assert.equal(score.integrity, 100);
  assert.equal(score.antiFarmDecay, 100);
  assert.equal(score.rawScore, 32);
  assert.equal(score.finalScore, 21);
  assert.equal(Math.round(score.dimensions.reduce((sum, dimension) => sum + dimension.contribution, 0)), score.finalScore);
});
