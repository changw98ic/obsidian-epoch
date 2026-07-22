import assert from "node:assert/strict";
import test from "node:test";

import {
  COMBAT_READINESS_DIMENSION_IDS,
  calculateAttributeEvidenceXp,
  combatReadinessVector,
  convertRunReward,
  effectiveAttributeScore,
  estimateEncounterSuitability,
  methodPracticeGain,
  proposeAttributeEvidence,
  proposeBreakthrough,
  proposeExpandCarry,
  proposeRespec,
  proposeSkillUnlock,
  validateAttributeEvidence,
  validateAttributePointIncrease,
  validateBreakthrough,
  validateCarryLoadout,
  validateExpandCarry,
  validateRespec,
  validateSkillAdvancement,
  validateSkillUnlock,
  validateTalentAllocation,
  type AttributeEvidenceInput,
  type CarryLoadoutItem,
  type CombatReadinessDimensionId,
  type ProgressionAttributeId,
  type ProgressionState,
  type SkillNodeDefinition,
  type TalentNode,
} from "../lib/epoch/progressionRules.ts";
import type { CausalEffectV1, ResourceLedgerEffectV1 } from "../lib/epoch/causalContracts.ts";

const attributes: Record<ProgressionAttributeId, number> = {
  strength: 30,
  agility: 30,
  physique: 30,
  intellect: 30,
  willpower: 30,
  spirituality: 30,
};

function state(overrides: Partial<ProgressionState> = {}): ProgressionState {
  return {
    identityId: "identity_alpha",
    lineageId: "lineage_alpha",
    functionalStage: 2,
    powerSystemId: "eastern_cultivation",
    attributes,
    resources: {
      functionalXp: 200,
      insightPoints: 3,
      skillPointsSpent: 0,
      lineageMarks: 1,
      attributeEvidenceXp: { strength: 250 },
      methodProficiency: { breath: 140 },
      domainInsight: { dream_mind: 25 },
      materials: [],
    },
    learnedSkillNodeIds: ["root_breath"],
    talents: [],
    qualificationRefs: ["qualification:eastern"],
    ...overrides,
  };
}

function attributeEvidence(overrides: Partial<AttributeEvidenceInput> = {}): AttributeEvidenceInput {
  return {
    attributeId: "strength",
    relevanceBps: 10_000,
    challengeBand: "matched",
    executionQualityBps: 10_000,
    recoveryStateBps: 10_000,
    repeatIndex: 0,
    sourceEventIds: ["event_attribute"],
    actionTags: ["lifted_gate"],
    ...overrides,
  };
}

function errorCodes(result: { readonly errors: readonly { readonly code: string }[] }) {
  return result.errors.map((item) => item.code);
}

function sortedErrorCodes(result: { readonly errors: readonly { readonly code: string }[] }) {
  return errorCodes(result).toSorted();
}

function resourceLedgerEffects(effects: readonly CausalEffectV1[]) {
  return effects.filter((effect): effect is ResourceLedgerEffectV1 => effect.effectType === "resource_ledger");
}

function allWeights(value: number): Record<CombatReadinessDimensionId, number> {
  return Object.fromEntries(COMBAT_READINESS_DIMENSION_IDS.map((dimension) => [dimension, value])) as Record<CombatReadinessDimensionId, number>;
}

test("attribute evidence awards multi-dimensional xp without bypassing the soft cap", () => {
  const strengthXp = calculateAttributeEvidenceXp(attributeEvidence({
    attributeId: "strength",
    challengeBand: "hard",
  }));
  const agilityXp = calculateAttributeEvidenceXp(attributeEvidence({
    attributeId: "agility",
    relevanceBps: 8_000,
    executionQualityBps: 11_000,
  }));

  assert.equal(strengthXp, 5);
  assert.equal(agilityXp, 3);
  assert.equal(effectiveAttributeScore(55), 55);
  assert.equal(effectiveAttributeScore(75), 67);
  assert.equal(effectiveAttributeScore(100), 75);
  assert.equal(validateAttributePointIncrease(state(), "strength", 4).ok, false);
  assert.deepEqual(errorCodes(validateAttributePointIncrease(state(), "strength", 4)), ["ATTRIBUTE_XP_INSUFFICIENT"]);
});

test("attribute evidence rejects direct run attribute gains and requires evidence provenance", () => {
  const result = validateAttributeEvidence(attributeEvidence({
    directAttributeAmount: 1,
    sourceEventIds: [],
    actionTags: [],
  }));

  assert.equal(result.ok, false);
  assert.deepEqual(errorCodes(result), [
    "ATTRIBUTE_EVIDENCE_REQUIREMENT_MISSING",
    "ATTRIBUTE_DIRECT_RUN_GAIN_FORBIDDEN",
    "ATTRIBUTE_EVIDENCE_REQUIREMENT_MISSING",
  ]);
});

test("run rewards convert into functional xp insight and retained materials instead of fixed attributes", () => {
  const proposal = convertRunReward({
    identityId: "identity_alpha",
    outcome: "forced_extraction",
    rewardSourceRef: "escrow:run_1",
    confirmedClaimValue: 100,
    unconfirmedClaimValue: 80,
    practiceEvidenceXp: 20,
    insightEvidence: 30,
    materials: [
      { materialId: "stabilizer", quantity: 4 },
      { materialId: "primary", quantity: 8 },
    ],
    sourceEventIds: ["event_run"],
  });

  assert.equal(proposal.ok, true);
  assert.equal(proposal.explanation.noDirectAttributeGain, true);
  assert.deepEqual(resourceLedgerEffects(proposal.effects).map((effect) => effect.after.resourceKey), [
    "functional_xp",
    "insight_points",
    "material.primary",
    "material.stabilizer",
  ]);
  assert.equal(resourceLedgerEffects(proposal.effects).some((effect) => effect.after.resourceKey.includes("attribute")), false);
});

test("breakthrough requires next stage prerequisites facilities materials health and frozen seed", () => {
  const result = validateBreakthrough(state({
    functionalStage: 2,
    resources: {
      functionalXp: 100,
      methodProficiency: { breath: 100 },
      domainInsight: { dream_mind: 10 },
    },
    qualificationRefs: [],
    status: {
      injurySeverity: 61,
      pollution: 71,
      debtSeverity: 81,
      stability: 49,
    },
  }), {
    targetStage: 4,
    facilityTier: 1,
    preparedMaterials: [{ materialId: "primary", quantity: 1 }],
    sourceEventIds: ["event_attempt"],
    frozenSeedRef: "",
  });

  assert.equal(result.ok, false);
  assert.deepEqual(sortedErrorCodes(result), [
    "BREAKTHROUGH_MATERIAL_INSUFFICIENT",
    "BREAKTHROUGH_MATERIAL_INSUFFICIENT",
    "BREAKTHROUGH_MATERIAL_INSUFFICIENT",
    "BREAKTHROUGH_NOT_NEXT_STAGE",
    "BREAKTHROUGH_REQUIREMENT_UNMET",
    "BREAKTHROUGH_REQUIREMENT_UNMET",
    "BREAKTHROUGH_REQUIREMENT_UNMET",
    "BREAKTHROUGH_REQUIREMENT_UNMET",
    "BREAKTHROUGH_REQUIREMENT_UNMET",
    "BREAKTHROUGH_REQUIREMENT_UNMET",
    "BREAKTHROUGH_STATUS_BLOCKED",
    "BREAKTHROUGH_STATUS_BLOCKED",
    "BREAKTHROUGH_STATUS_BLOCKED",
    "BREAKTHROUGH_STATUS_BLOCKED",
  ].toSorted());
});

test("breakthrough proposal consumes required materials and advances only when gates pass", () => {
  const proposal = proposeBreakthrough(state({
    functionalStage: 2,
    resources: {
      functionalXp: 360,
      methodProficiency: { breath: 250 },
      domainInsight: { dream_mind: 20 },
    },
  }), {
    targetStage: 3,
    facilityTier: 2,
    preparedMaterials: [
      { materialId: "primary", quantity: 8 },
      { materialId: "stabilizer", quantity: 2 },
      { materialId: "catalyst", quantity: 1 },
    ],
    sourceEventIds: ["event_b", "event_a", "event_b"],
    frozenSeedRef: "seed:breakthrough_3",
  });

  assert.equal(proposal.ok, true);
  assert.deepEqual(proposal.effects.map((effect) => effect.operation), [
    "consume_breakthrough_material",
    "consume_breakthrough_material",
    "consume_breakthrough_material",
    "advance_functional_stage",
  ]);
  assert.deepEqual(proposal.effects.map((effect) => effect.sourceEventIds), [
    ["event_a", "event_b"],
    ["event_a", "event_b"],
    ["event_a", "event_b"],
    ["event_a", "event_b"],
  ]);
  assert.deepEqual(resourceLedgerEffects(proposal.effects).map((effect) => effect.after.resourceKey), [
    "material.primary",
    "material.stabilizer",
    "material.catalyst",
  ]);
});

test("talent allocation enforces capacity mutual exclusion qualifications and scalar caps", () => {
  const addTalents: TalentNode[] = [
    { talentId: "defining_a", impact: "defining", source: "origin", definingGroup: "soul" },
    { talentId: "defining_b", impact: "defining", source: "scar", definingGroup: "soul" },
    { talentId: "mutex_a", impact: "major", source: "awakened", mutexTalentIds: ["mutex_b"] },
    { talentId: "mutex_b", impact: "minor", source: "awakened" },
    { talentId: "locked", impact: "minor", source: "lineage_echo", requiresQualificationRefs: ["qualification:missing"] },
    { talentId: "scalar_a", impact: "minor", source: "tradition", scalarChannel: "damage", scalarBps: 800 },
    { talentId: "scalar_b", impact: "minor", source: "tradition", scalarChannel: "damage", scalarBps: 400 },
  ];

  const result = validateTalentAllocation(state({
    talentCapacity: 20,
    activeTalentSlots: 20,
  }), { addTalents });

  assert.equal(result.ok, false);
  assert.deepEqual(sortedErrorCodes(result), [
    "TALENT_CAPACITY_EXCEEDED",
    "TALENT_MUTUAL_EXCLUSION",
    "TALENT_MUTUAL_EXCLUSION",
    "TALENT_QUALIFICATION_MISSING",
    "TALENT_SCALAR_CAP_EXCEEDED",
  ].toSorted());
});

test("talent allocation clamps configured capacity and active slots to hard caps", () => {
  const addTalents: TalentNode[] = [
    { talentId: "minor_a", impact: "minor", source: "origin" },
    { talentId: "minor_b", impact: "minor", source: "tradition" },
    { talentId: "minor_c", impact: "minor", source: "awakened" },
    { talentId: "minor_d", impact: "minor", source: "scar" },
    { talentId: "minor_e", impact: "minor", source: "lineage_echo" },
    { talentId: "minor_f", impact: "minor", source: "power_system" },
  ];

  const result = validateTalentAllocation(state({
    talentCapacity: 99,
    activeTalentSlots: 99,
  }), { addTalents });

  assert.equal(result.ok, false);
  assert.deepEqual(errorCodes(result), ["TALENT_CAPACITY_EXCEEDED"]);
});

test("skill unlock enforces point budget prerequisites mutex gates source evidence and materials", () => {
  const node: SkillNodeDefinition = {
    nodeId: "shadow_step",
    tier: "capstone",
    kind: "method_unlock",
    requiredStage: 3,
    requiredMethodId: "breath",
    requiredMethodProficiency: 250,
    requiredDomainId: "dream_mind",
    requiredDomainInsight: 30,
    prerequisiteNodeIds: ["missing_root"],
    mutexNodeIds: ["root_breath"],
    requiresSourceEvidence: true,
    materialCost: [{ materialId: "catalyst", quantity: 1 }],
  };

  const result = validateSkillUnlock(state({
    functionalStage: 2,
    resources: {
      skillPointsSpent: 4,
      methodProficiency: { breath: 100 },
      domainInsight: { dream_mind: 20 },
    },
  }), {
    node,
    sourceEventIds: [],
    availableMaterials: [],
  });

  assert.equal(result.ok, false);
  assert.deepEqual(sortedErrorCodes(result), [
    "SKILL_DOMAIN_GATE_UNMET",
    "SKILL_MATERIAL_INSUFFICIENT",
    "SKILL_MUTUAL_EXCLUSION",
    "SKILL_POINT_BUDGET_EXCEEDED",
    "SKILL_PREREQUISITE_MISSING",
    "SKILL_PROFICIENCY_GATE_UNMET",
    "SKILL_SOURCE_EVIDENCE_MISSING",
    "SKILL_STAGE_GATE_UNMET",
  ].toSorted());
});

test("skill unlock proposal spends skill points and advancement validates proficiency materials and world evidence", () => {
  const proposal = proposeSkillUnlock(state(), {
    node: {
      nodeId: "breath_edge",
      tier: "tier2",
      kind: "method_unlock",
      prerequisiteNodeIds: ["root_breath"],
      materialCost: [{ materialId: "primary", quantity: 2 }],
    },
    sourceEventIds: ["event_skill"],
    availableMaterials: [{ materialId: "primary", quantity: 2 }],
  });
  const advancement = validateSkillAdvancement(state({ functionalStage: 6 }), {
    methodId: "breath",
    targetTechniqueTier: 6,
    currentProficiency: 899,
    availableMaterials: [{ materialId: "domain", quantity: 3 }],
    sourceEventIds: ["event_advance"],
    hasWorldEvidence: false,
  });

  assert.equal(proposal.ok, true);
  assert.deepEqual(proposal.effects.map((effect) => effect.operation), [
    "allocate_skill_points",
    "consume_skill_material",
    "unlock_skill_node",
  ]);
  assert.deepEqual(sortedErrorCodes(advancement), [
    "SKILL_MATERIAL_INSUFFICIENT",
    "SKILL_PROFICIENCY_GATE_UNMET",
    "SKILL_SOURCE_EVIDENCE_MISSING",
  ].toSorted());
});

test("respec forbids primary system changes and charges insight lineage and experience loss", () => {
  assert.deepEqual(errorCodes(validateRespec(state(), {
    scope: "primarySystem",
    spentExperience: 100,
    nodeIds: ["breath_edge"],
    sourceEventIds: ["event_respec"],
  })), ["RESPEC_COST_INSUFFICIENT", "RESPEC_FORBIDDEN"]);

  const proposal = proposeRespec(state(), {
    scope: "crossTradition",
    spentExperience: 100,
    nodeIds: ["zeta", "alpha", "alpha"],
    sourceEventIds: ["event_respec"],
  });

  assert.equal(proposal.ok, true);
  assert.equal(proposal.namespace, "lineage");
  assert.deepEqual(proposal.effects.map((effect) => effect.operation), [
    "consume_respec_insight",
    "consume_respec_lineage_mark",
    "respec_skill_nodes",
  ]);
  assert.deepEqual(proposal.effects[2]?.after.nodeIds, ["alpha", "zeta"]);
  assert.equal(proposal.effects[2]?.after.spentExperienceLoss, 50);
});

test("carry loadout enforces slots deployment quick use category caps and forbidden quest items", () => {
  const items: CarryLoadoutItem[] = [
    { itemId: "core_a", rarity: "rare", category: "mainCore", quickUse: true },
    { itemId: "core_b", rarity: "rare", category: "mainCore", quickUse: true },
    { itemId: "potion_a", rarity: "uncommon", category: "potion", quickUse: true },
    { itemId: "potion_b", rarity: "uncommon", category: "potion" },
    { itemId: "potion_c", rarity: "uncommon", category: "potion" },
    { itemId: "quest_lock", rarity: "common", category: "tool", questItem: true },
  ];

  const result = validateCarryLoadout(state(), items);

  assert.equal(result.ok, false);
  assert.deepEqual(errorCodes(result), [
    "LOADOUT_DEPLOYMENT_CAP_EXCEEDED",
    "LOADOUT_QUICK_SLOT_CAP_EXCEEDED",
    "LOADOUT_SLOT_CAP_EXCEEDED",
    "LOADOUT_CATEGORY_CAP_EXCEEDED",
    "LOADOUT_CATEGORY_CAP_EXCEEDED",
    "LOADOUT_ITEM_FORBIDDEN",
  ]);
});

test("carry expansion caps bring-in load quick-use echo and insurance while requiring opportunity cost provenance", () => {
  const result = validateExpandCarry(state(), {
    targetCarrySlots: 6,
    targetDeploymentCapacity: 11,
    targetQuickUseSlots: 4,
    targetEchoSlots: 7,
    targetInsuranceLayers: 3,
    sourceEventIds: [],
  });
  const proposal = proposeExpandCarry(state(), {
    targetCarrySlots: 4,
    targetDeploymentCapacity: 8,
    targetQuickUseSlots: 3,
    targetEchoSlots: 2,
    targetInsuranceLayers: 1,
    sourceEventIds: ["event_capacity"],
  });

  assert.equal(result.ok, false);
  assert.deepEqual(errorCodes(result), [
    "RESOURCE_SOURCE_MISSING",
    "LOADOUT_SLOT_CAP_EXCEEDED",
    "LOADOUT_DEPLOYMENT_CAP_EXCEEDED",
    "LINEAGE_CAP_EXCEEDED",
    "INSURANCE_CAP_EXCEEDED",
    "LOADOUT_QUICK_SLOT_CAP_EXCEEDED",
  ]);
  assert.equal(proposal.ok, true);
  assert.equal(proposal.namespace, "lineage");
  assert.equal(proposal.explanation.opportunityCostRequired, true);
  assert.deepEqual(proposal.effects[0]?.after.basisEventIds, ["event_capacity"]);
});

test("combat readiness exposes ten clamped dimensions and encounter UI bands", () => {
  const vector = combatReadinessVector({
    attributes: {
      strength: 999,
      agility: -10,
      physique: 60,
      intellect: 40,
      willpower: 35,
      spirituality: Number.POSITIVE_INFINITY,
    },
    methodVector: allWeights(300),
    equipmentVector: allWeights(-50),
    preparationVector: allWeights(50),
    stateMultiplierBps: 20_000,
    environmentMultiplierBps: 1,
    matchupMultiplierByDimension: allWeights(20_000),
  });
  const result = estimateEncounterSuitability({
    attributes,
    methodVector: allWeights(80),
    equipmentVector: allWeights(50),
    preparationVector: allWeights(60),
    threatPoints: 120,
    encounterWeights: allWeights(1_000),
  });

  assert.deepEqual(Object.keys(vector), COMBAT_READINESS_DIMENSION_IDS);
  assert.equal(Object.values(vector).every((value) => Number.isInteger(value) && value >= 0 && value <= 100), true);
  assert.equal(result.ok, true);
  assert.equal(["critical", "disadvantaged", "contested", "favored", "dominant"].includes(result.band), true);
  assert.equal(result.pressure, 50);
  assert.equal(result.victoryProbabilityBps >= 0 && result.victoryProbabilityBps <= 10_000, true);
});

test("encounter suitability rejects non-normalized weights for UI-safe invalid output", () => {
  const result = estimateEncounterSuitability({
    attributes,
    threatPoints: 120,
    encounterWeights: allWeights(999),
  });

  assert.equal(result.ok, false);
  assert.equal(result.band, "invalid");
  assert.deepEqual(errorCodes(result), ["COMBAT_VECTOR_INVALID"]);
});

test("proposals preserve sorted source event ids and ledger account context", () => {
  const proposal = proposeAttributeEvidence(state(), attributeEvidence({
    sourceEventIds: ["event_z", "event_a", "event_a"],
    actionTags: ["zeta", "alpha"],
  }));

  assert.equal(proposal.ok, true);
  assert.equal(proposal.effects[0]?.effectType, "resource_ledger");
  assert.equal(resourceLedgerEffects(proposal.effects)[0]?.after.entries[0]?.accountRef, "identity:identity_alpha:progression");
  assert.deepEqual(proposal.effects[0]?.sourceEventIds, ["event_a", "event_z"]);
  assert.deepEqual(proposal.explanation.actionTags, ["alpha", "zeta"]);
});

test("extreme values clamp and deterministic ordering remains stable", () => {
  const repeated = calculateAttributeEvidenceXp(attributeEvidence({
    repeatIndex: 999,
    executionQualityBps: 99_999,
    recoveryStateBps: -100,
  }));
  const practice = methodPracticeGain({
    base: 10,
    difficultyFitBps: 99_999,
    repeatIndex: 999,
    correctnessBps: 99_999,
    mentorshipBps: 99_999,
    riskFitBps: 99_999,
  });
  const left = proposeBreakthrough(state({
    functionalStage: 1,
    resources: {
      functionalXp: 120,
      methodProficiency: { breath: 100 },
      domainInsight: { dream_mind: 20 },
    },
  }), {
    targetStage: 2,
    facilityTier: 1,
    preparedMaterials: [
      { materialId: "stabilizer", quantity: 1 },
      { materialId: "primary", quantity: 4 },
    ],
    sourceEventIds: ["event_z", "event_a", "event_z"],
    frozenSeedRef: "seed:two",
  });
  const right = proposeBreakthrough(state({
    functionalStage: 1,
    resources: {
      functionalXp: 120,
      methodProficiency: { breath: 100 },
      domainInsight: { dream_mind: 20 },
    },
  }), {
    targetStage: 2,
    facilityTier: 1,
    preparedMaterials: [
      { materialId: "primary", quantity: 4 },
      { materialId: "stabilizer", quantity: 1 },
    ],
    sourceEventIds: ["event_a", "event_z"],
    frozenSeedRef: "seed:two",
  });

  assert.equal(repeated, 1);
  assert.equal(practice, 12);
  assert.deepEqual(left, right);
});
