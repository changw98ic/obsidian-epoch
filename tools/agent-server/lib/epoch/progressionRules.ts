import type { CausalEffectV1, CausalNamespace } from "./causalContracts.ts";
import {
  CAUSAL_RESOURCE_SINK_REFS,
  CAUSAL_RESOURCE_SOURCE_REFS,
} from "./causalResourceCatalog.ts";

export const PROGRESSION_RULESET_VERSION = "progression-roguelite-v1" as const;
export const PROGRESSION_BALANCE_VERSION = "2026.07.20-v1" as const;
export const PROGRESSION_CONTENT_VERSION = "2026.07.20-materials-v1" as const;

export type FixedBps = number;

export type ProgressionAttributeId =
  | "strength"
  | "agility"
  | "physique"
  | "intellect"
  | "willpower"
  | "spirituality";

export type ProgressionPowerSystemId =
  | "innate_anomaly"
  | "eastern_cultivation"
  | "western_arcana"
  | "primordial_divine_contract"
  | "outer_resonance"
  | "rational_engineering"
  | "cyber_industry";

export type ProgressionDomainId =
  | "soul_death"
  | "dream_mind"
  | "fate_time"
  | "star_space_quantum"
  | "flesh_blood_mutation"
  | "ecology_element_environment";

export type CombatReadinessDimensionId =
  | "offense"
  | "protection"
  | "mobility"
  | "control"
  | "perception"
  | "sustain"
  | "reserve"
  | "corruptionResistance"
  | "synergy"
  | "adaptation";

export type ProgressionChallengeBand = "trivial" | "below_band" | "matched" | "hard" | "extreme";
export type ProgressionRunOutcome =
  | "full_completion"
  | "voluntary_extraction"
  | "forced_extraction"
  | "mission_failure_alive"
  | "server_confirmed_death";
export type SkillNodeTier = "tier1" | "tier2" | "tier3" | "capstone";
export type SkillNodeKind =
  | "method_unlock"
  | "method_transform"
  | "utility_economy"
  | "pure_numeric"
  | "capstone";
export type TalentImpact = "minor" | "major" | "defining";
export type TalentSource =
  | "species_or_true_form"
  | "origin"
  | "power_system"
  | "tradition"
  | "awakened"
  | "scar"
  | "lineage_echo";
export type RespecScope = "sameNode" | "sameBranch" | "crossTradition" | "primarySystem";
export type CarryItemRarity = "common" | "uncommon" | "rare" | "epic" | "mythic";

export type ProgressionErrorCode =
  | "ATTRIBUTE_INVALID"
  | "ATTRIBUTE_CREATION_BUDGET_INVALID"
  | "ATTRIBUTE_DIRECT_RUN_GAIN_FORBIDDEN"
  | "ATTRIBUTE_EVIDENCE_REQUIREMENT_MISSING"
  | "ATTRIBUTE_EVIDENCE_CAP_EXCEEDED"
  | "ATTRIBUTE_XP_INSUFFICIENT"
  | "POWER_SYSTEM_INVALID"
  | "FUNCTIONAL_STAGE_INVALID"
  | "BREAKTHROUGH_NOT_NEXT_STAGE"
  | "BREAKTHROUGH_REQUIREMENT_UNMET"
  | "BREAKTHROUGH_STATUS_BLOCKED"
  | "BREAKTHROUGH_MATERIAL_INSUFFICIENT"
  | "TALENT_CAPACITY_EXCEEDED"
  | "TALENT_MUTUAL_EXCLUSION"
  | "TALENT_QUALIFICATION_MISSING"
  | "TALENT_SCALAR_CAP_EXCEEDED"
  | "SKILL_POINT_BUDGET_EXCEEDED"
  | "SKILL_PREREQUISITE_MISSING"
  | "SKILL_MUTUAL_EXCLUSION"
  | "SKILL_STAGE_GATE_UNMET"
  | "SKILL_PROFICIENCY_GATE_UNMET"
  | "SKILL_DOMAIN_GATE_UNMET"
  | "SKILL_SOURCE_EVIDENCE_MISSING"
  | "SKILL_MATERIAL_INSUFFICIENT"
  | "SKILL_ADVANCEMENT_INVALID"
  | "RESPEC_FORBIDDEN"
  | "RESPEC_COST_INSUFFICIENT"
  | "LOADOUT_SLOT_CAP_EXCEEDED"
  | "LOADOUT_DEPLOYMENT_CAP_EXCEEDED"
  | "LOADOUT_QUICK_SLOT_CAP_EXCEEDED"
  | "LOADOUT_CATEGORY_CAP_EXCEEDED"
  | "LOADOUT_ITEM_FORBIDDEN"
  | "LINEAGE_CAP_EXCEEDED"
  | "INSURANCE_CAP_EXCEEDED"
  | "RESOURCE_INSUFFICIENT"
  | "RESOURCE_SOURCE_MISSING"
  | "COMBAT_VECTOR_INVALID";

export interface ProgressionRuleError {
  readonly code: ProgressionErrorCode;
  readonly message: string;
  readonly path?: string;
  readonly retryable: boolean;
}

export interface ProgressionValidationResult {
  readonly ok: boolean;
  readonly errors: readonly ProgressionRuleError[];
}

export interface ProgressionProposal {
  readonly ok: boolean;
  readonly commandType: string;
  readonly namespace: CausalNamespace;
  readonly effects: readonly CausalEffectV1[];
  readonly errors: readonly ProgressionRuleError[];
  readonly explanation: Readonly<Record<string, unknown>>;
}

export interface ProgressionMaterialStack {
  readonly materialId: string;
  readonly quantity: number;
}

export interface ProgressionResources {
  readonly functionalXp?: number;
  readonly insightPoints?: number;
  readonly skillPointsSpent?: number;
  readonly lineageMarks?: number;
  readonly attributeEvidenceXp?: Partial<Record<ProgressionAttributeId, number>>;
  readonly methodProficiency?: Readonly<Record<string, number>>;
  readonly domainInsight?: Partial<Record<ProgressionDomainId, number>>;
  readonly materials?: readonly ProgressionMaterialStack[];
}

export interface ProgressionStatus {
  readonly injurySeverity?: number;
  readonly pollution?: number;
  readonly debtSeverity?: number;
  readonly stability?: number;
}

export interface TalentNode {
  readonly talentId: string;
  readonly impact: TalentImpact;
  readonly source: TalentSource;
  readonly scalarChannel?: string;
  readonly scalarBps?: FixedBps;
  readonly definingGroup?: string;
  readonly requiresQualificationRefs?: readonly string[];
  readonly mutexTalentIds?: readonly string[];
}

export interface SkillNodeDefinition {
  readonly nodeId: string;
  readonly tier: SkillNodeTier;
  readonly kind: SkillNodeKind;
  readonly requiredStage?: number;
  readonly requiredMethodId?: string;
  readonly requiredMethodProficiency?: number;
  readonly requiredDomainId?: ProgressionDomainId;
  readonly requiredDomainInsight?: number;
  readonly prerequisiteNodeIds?: readonly string[];
  readonly mutexNodeIds?: readonly string[];
  readonly requiresSourceEvidence?: boolean;
  readonly techniqueTier?: number;
  readonly materialCost?: readonly ProgressionMaterialStack[];
}

export interface ProgressionState {
  readonly identityId: string;
  readonly lineageId?: string;
  readonly functionalStage: number;
  readonly powerSystemId: ProgressionPowerSystemId;
  readonly attributes: Readonly<Record<ProgressionAttributeId, number>>;
  readonly resources?: ProgressionResources;
  readonly learnedSkillNodeIds?: readonly string[];
  readonly talents?: readonly TalentNode[];
  readonly talentCapacity?: number;
  readonly activeTalentSlots?: number;
  readonly carrySlots?: number;
  readonly deploymentCapacity?: number;
  readonly quickUseSlots?: number;
  readonly echoSlots?: number;
  readonly insuranceLayers?: number;
  readonly status?: ProgressionStatus;
  readonly qualificationRefs?: readonly string[];
}

export interface AttributeEvidenceInput {
  readonly attributeId: ProgressionAttributeId;
  readonly relevanceBps: FixedBps;
  readonly challengeBand: ProgressionChallengeBand;
  readonly executionQualityBps: FixedBps;
  readonly recoveryStateBps: FixedBps;
  readonly repeatIndex: number;
  readonly sourceEventIds: readonly string[];
  readonly actionTags: readonly string[];
  readonly directAttributeAmount?: number;
  readonly runAwardedXpSoFar?: number;
  readonly allAttributesRunAwardedXpSoFar?: number;
}

export interface BreakthroughAttemptInput {
  readonly targetStage: number;
  readonly facilityTier: number;
  readonly preparedMaterials: readonly ProgressionMaterialStack[];
  readonly sourceEventIds: readonly string[];
  readonly frozenSeedRef: string;
  readonly qualificationRefs?: readonly string[];
  readonly insuranceApplies?: boolean;
}

export interface TalentAllocationInput {
  readonly addTalents: readonly TalentNode[];
  readonly removeTalentIds?: readonly string[];
  readonly qualificationRefs?: readonly string[];
}

export interface SkillUnlockInput {
  readonly node: SkillNodeDefinition;
  readonly sourceEventIds: readonly string[];
  readonly availableMaterials?: readonly ProgressionMaterialStack[];
}

export interface SkillAdvanceInput {
  readonly methodId: string;
  readonly targetTechniqueTier: number;
  readonly currentProficiency: number;
  readonly availableMaterials: readonly ProgressionMaterialStack[];
  readonly sourceEventIds: readonly string[];
  readonly hasWorldEvidence?: boolean;
}

export interface RespecInput {
  readonly scope: RespecScope;
  readonly spentExperience: number;
  readonly nodeIds: readonly string[];
  readonly sourceEventIds: readonly string[];
}

export interface CarryLoadoutItem {
  readonly itemId: string;
  readonly rarity: CarryItemRarity;
  readonly category: string;
  readonly quickUse?: boolean;
  readonly questItem?: boolean;
}

export interface ExpandCarryInput {
  readonly targetCarrySlots?: number;
  readonly targetDeploymentCapacity?: number;
  readonly targetQuickUseSlots?: number;
  readonly targetEchoSlots?: number;
  readonly targetInsuranceLayers?: number;
  readonly sourceEventIds: readonly string[];
}

export interface RunRewardConversionInput {
  readonly identityId: string;
  readonly outcome: ProgressionRunOutcome;
  readonly rewardSourceRef: string;
  readonly confirmedClaimValue: number;
  readonly unconfirmedClaimValue: number;
  readonly practiceEvidenceXp: number;
  readonly insightEvidence: number;
  readonly materials?: readonly ProgressionMaterialStack[];
  readonly sourceEventIds: readonly string[];
}

export interface CombatReadinessInput {
  readonly attributes: Readonly<Record<ProgressionAttributeId, number>>;
  readonly methodVector?: Partial<Record<CombatReadinessDimensionId, number>>;
  readonly equipmentVector?: Partial<Record<CombatReadinessDimensionId, number>>;
  readonly preparationVector?: Partial<Record<CombatReadinessDimensionId, number>>;
  readonly stateMultiplierBps?: FixedBps;
  readonly environmentMultiplierBps?: FixedBps;
  readonly matchupMultiplierByDimension?: Partial<Record<CombatReadinessDimensionId, FixedBps>>;
}

export interface EncounterSuitabilityInput extends CombatReadinessInput {
  readonly threatPoints: number;
  readonly encounterWeights: Readonly<Record<CombatReadinessDimensionId, FixedBps>>;
}

export interface EncounterSuitabilityDimensionDetail {
  readonly dimensionId: CombatReadinessDimensionId;
  readonly inputs: Readonly<Record<string, number>>;
  readonly weightBps: FixedBps;
  readonly score: number;
  readonly contribution: number;
  readonly reasonCode: string;
}

export interface ProgressionScoreIntensitySuitabilityAudit {
  readonly ok: boolean;
  readonly scoreIntensityDirectWeightBps: 0;
  readonly suitabilityDirectAttributeGrantBps: 0;
  readonly usesGlobalCombatPower: false;
  readonly reasonCodes: readonly string[];
}

const BPS = 10_000;
const ATTRIBUTE_RUN_XP_CAP = 10;
const ALL_ATTRIBUTE_RUN_XP_CAP = 24;
const ATTRIBUTE_MIN = 0;
const ATTRIBUTE_MAX = 100;
const TALENT_STARTING_CAPACITY = 5;
const TALENT_MAX_CAPACITY = 9;
const TALENT_STARTING_ACTIVE_SLOTS = 2;
const TALENT_MAX_ACTIVE_SLOTS = 5;
const TALENT_SCALAR_PER_CHANNEL_CAP_BPS = 1_000;
const TALENT_SCALAR_STACK_CAP_BPS = 12_000;
const BASE_CARRY_SLOTS = 3;
const HARD_CARRY_SLOT_CAP = 5;
const BASE_DEPLOYMENT_CAPACITY = 6;
const HARD_DEPLOYMENT_CAPACITY_CAP = 10;
const BASE_QUICK_USE_SLOTS = 2;
const HARD_QUICK_USE_SLOT_CAP = 3;
const BASE_ECHO_SLOTS = 1;
const HARD_ECHO_SLOT_CAP = 6;
const HARD_INSURANCE_LAYER_CAP = 2;

export const PROGRESSION_ATTRIBUTE_IDS: readonly ProgressionAttributeId[] = [
  "strength",
  "agility",
  "physique",
  "intellect",
  "willpower",
  "spirituality",
];

export const COMBAT_READINESS_DIMENSION_IDS: readonly CombatReadinessDimensionId[] = [
  "offense",
  "protection",
  "mobility",
  "control",
  "perception",
  "sustain",
  "reserve",
  "corruptionResistance",
  "synergy",
  "adaptation",
];

export const PROGRESSION_POWER_SYSTEM_IDS: readonly ProgressionPowerSystemId[] = [
  "innate_anomaly",
  "eastern_cultivation",
  "western_arcana",
  "primordial_divine_contract",
  "outer_resonance",
  "rational_engineering",
  "cyber_industry",
];

export const FUNCTIONAL_STAGES = [
  { stage: 1, id: "contact", label: "感应", xp: 0, primaryMethod: 0, insight: 0, softCap: 40, skillPoints: 3, active: 2, reaction: 0, passive: 2, domain: 1, talent: 2 },
  { stage: 2, id: "circulation", label: "周天", xp: 120, primaryMethod: 100, insight: 20, softCap: 50, skillPoints: 5, active: 2, reaction: 1, passive: 3, domain: 1, talent: 2 },
  { stage: 3, id: "foundation", label: "立基", xp: 360, primaryMethod: 250, insight: 20, softCap: 60, skillPoints: 7, active: 3, reaction: 1, passive: 4, domain: 1, talent: 3 },
  { stage: 4, id: "manifestation", label: "凝相", xp: 780, primaryMethod: 500, insight: 40, softCap: 70, skillPoints: 9, active: 4, reaction: 2, passive: 5, domain: 2, talent: 3 },
  { stage: 5, id: "domain", label: "开域", xp: 1500, primaryMethod: 700, insight: 60, softCap: 80, skillPoints: 11, active: 4, reaction: 3, passive: 6, domain: 2, talent: 4 },
  { stage: 6, id: "transcendence", label: "渡劫/合道", xp: 2700, primaryMethod: 900, insight: 80, softCap: 90, skillPoints: 13, active: 5, reaction: 3, passive: 6, domain: 3, talent: 5 },
] as const;

const CHALLENGE_FIT_BPS: Record<ProgressionChallengeBand, FixedBps> = {
  trivial: 2_000,
  below_band: 6_000,
  matched: 10_000,
  hard: 12_000,
  extreme: 11_000,
};

const REPEAT_NOVELTY_BPS = [10_000, 7_500, 5_000, 2_500] as const;
const METHOD_REPEAT_NOVELTY_BPS = [10_000, 7_500, 5_500, 4_000, 3_000, 2_500] as const;
const SKILL_TIER_COSTS: Record<SkillNodeTier, number> = {
  tier1: 1,
  tier2: 1,
  tier3: 2,
  capstone: 3,
};
const TALENT_COSTS: Record<TalentImpact, number> = {
  minor: 1,
  major: 2,
  defining: 3,
};
const DEPLOYMENT_COSTS: Record<CarryItemRarity, number> = {
  common: 1,
  uncommon: 2,
  rare: 3,
  epic: 4,
  mythic: 5,
};
const SETTLEMENT_RETENTION_BPS: Record<ProgressionRunOutcome, {
  confirmed: FixedBps;
  unconfirmed: FixedBps;
  practice: FixedBps;
}> = {
  full_completion: { confirmed: 10_000, unconfirmed: 7_000, practice: 10_000 },
  voluntary_extraction: { confirmed: 10_000, unconfirmed: 5_000, practice: 8_000 },
  forced_extraction: { confirmed: 7_500, unconfirmed: 2_500, practice: 6_000 },
  mission_failure_alive: { confirmed: 8_000, unconfirmed: 3_000, practice: 5_000 },
  server_confirmed_death: { confirmed: 2_000, unconfirmed: 1_000, practice: 3_500 },
};

const DEFAULT_ATTRIBUTE_PROJECTION: Record<CombatReadinessDimensionId, Record<ProgressionAttributeId, FixedBps>> = {
  offense: { strength: 3_500, agility: 1_500, physique: 1_000, intellect: 1_000, willpower: 1_000, spirituality: 2_000 },
  protection: { strength: 1_000, agility: 1_000, physique: 4_500, intellect: 500, willpower: 2_000, spirituality: 1_000 },
  mobility: { strength: 1_000, agility: 5_500, physique: 1_500, intellect: 1_000, willpower: 500, spirituality: 500 },
  control: { strength: 500, agility: 1_000, physique: 500, intellect: 3_000, willpower: 2_000, spirituality: 3_000 },
  perception: { strength: 0, agility: 1_500, physique: 500, intellect: 3_500, willpower: 1_500, spirituality: 3_000 },
  sustain: { strength: 1_000, agility: 500, physique: 3_500, intellect: 1_000, willpower: 2_500, spirituality: 1_500 },
  reserve: { strength: 500, agility: 500, physique: 2_000, intellect: 2_000, willpower: 2_000, spirituality: 3_000 },
  corruptionResistance: { strength: 0, agility: 0, physique: 2_000, intellect: 1_000, willpower: 3_500, spirituality: 3_500 },
  synergy: { strength: 500, agility: 1_000, physique: 1_000, intellect: 3_000, willpower: 2_000, spirituality: 2_500 },
  adaptation: { strength: 500, agility: 1_500, physique: 1_500, intellect: 2_500, willpower: 2_500, spirituality: 1_500 },
};

const PROGRESSION_SCORE_INTENSITY_SUITABILITY_AUDIT: ProgressionScoreIntensitySuitabilityAudit = {
  ok: true,
  scoreIntensityDirectWeightBps: 0,
  suitabilityDirectAttributeGrantBps: 0,
  usesGlobalCombatPower: false,
  reasonCodes: [
    "progression_suitability_is_vector_weighted_not_global_power",
    "progression_threat_pressure_affects_probability_not_attributes",
    "progression_intensity_has_zero_direct_score_weight",
  ],
};

const BREAKTHROUGH_MATERIALS: Record<number, { facilityTier: number; hours: number; materials: readonly ProgressionMaterialStack[] }> = {
  2: { facilityTier: 1, hours: 12, materials: [{ materialId: "primary", quantity: 4 }, { materialId: "stabilizer", quantity: 1 }] },
  3: { facilityTier: 2, hours: 36, materials: [{ materialId: "primary", quantity: 8 }, { materialId: "stabilizer", quantity: 2 }, { materialId: "catalyst", quantity: 1 }] },
  4: { facilityTier: 3, hours: 72, materials: [{ materialId: "primary", quantity: 10 }, { materialId: "stabilizer", quantity: 4 }, { materialId: "catalyst", quantity: 2 }] },
  5: { facilityTier: 4, hours: 144, materials: [{ materialId: "stabilizer", quantity: 4 }, { materialId: "catalyst", quantity: 4 }, { materialId: "domain", quantity: 2 }] },
  6: { facilityTier: 5, hours: 288, materials: [{ materialId: "catalyst", quantity: 4 }, { materialId: "domain", quantity: 4 }, { materialId: "apex", quantity: 1 }] },
};

const TECHNIQUE_ADVANCEMENT: Record<number, { skillPoints: number; proficiency: number; hours: number; materials: readonly ProgressionMaterialStack[]; worldEvidence: boolean }> = {
  1: { skillPoints: 1, proficiency: 0, hours: 2, materials: [], worldEvidence: false },
  2: { skillPoints: 1, proficiency: 100, hours: 6, materials: [{ materialId: "primary", quantity: 2 }], worldEvidence: false },
  3: { skillPoints: 2, proficiency: 250, hours: 12, materials: [{ materialId: "primary", quantity: 3 }, { materialId: "stabilizer", quantity: 1 }], worldEvidence: false },
  4: { skillPoints: 2, proficiency: 500, hours: 24, materials: [{ materialId: "stabilizer", quantity: 2 }, { materialId: "catalyst", quantity: 1 }], worldEvidence: false },
  5: { skillPoints: 3, proficiency: 700, hours: 48, materials: [{ materialId: "catalyst", quantity: 2 }, { materialId: "domain", quantity: 1 }], worldEvidence: false },
  6: { skillPoints: 3, proficiency: 900, hours: 96, materials: [{ materialId: "domain", quantity: 3 }, { materialId: "apex", quantity: 1 }], worldEvidence: true },
};

function error(code: ProgressionErrorCode, message: string, path?: string, retryable = false): ProgressionRuleError {
  return { code, message, path, retryable };
}

function validation(errors: readonly ProgressionRuleError[]): ProgressionValidationResult {
  return { ok: errors.length === 0, errors: stableErrors(errors) };
}

function stableErrors(errors: readonly ProgressionRuleError[]) {
  return [...errors].sort((a, b) => `${a.path || ""}:${a.code}`.localeCompare(`${b.path || ""}:${b.code}`));
}

function clampInt(min: number, max: number, value: number) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.trunc(value)));
}

function clampBps(min: FixedBps, max: FixedBps, value: FixedBps) {
  return clampInt(min, max, value);
}

function mulBps(value: number, ...multipliers: readonly FixedBps[]) {
  let scaled = BigInt(Math.trunc(value));
  for (const multiplier of multipliers) {
    scaled = (scaled * BigInt(clampInt(0, 100_000, multiplier)) + 5_000n) / 10_000n;
  }
  return Number(scaled);
}

function resourceAmount(resources: ProgressionResources | undefined, resourceKey: keyof ProgressionResources) {
  const value = resources?.[resourceKey];
  return typeof value === "number" && Number.isFinite(value) ? Math.trunc(value) : 0;
}

function sortedUnique(values: readonly string[] | undefined) {
  return [...new Set((values || []).filter((value) => typeof value === "string" && Boolean(value.trim())).map((value) => value.trim()))]
    .sort((a, b) => a.localeCompare(b));
}

function materialQuantity(materials: readonly ProgressionMaterialStack[] | undefined, materialId: string) {
  return (materials || [])
    .filter((material) => material.materialId === materialId)
    .reduce((total, material) => total + clampInt(0, Number.MAX_SAFE_INTEGER, material.quantity), 0);
}

function materialErrors(
  available: readonly ProgressionMaterialStack[] | undefined,
  required: readonly ProgressionMaterialStack[],
  path: string,
) {
  return required
    .filter((material) => materialQuantity(available, material.materialId) < material.quantity)
    .map((material) => error(
      "SKILL_MATERIAL_INSUFFICIENT",
      `requires ${material.quantity} ${material.materialId}`,
      `${path}.${material.materialId}`,
      true,
    ));
}

function stageConfig(stage: number) {
  return FUNCTIONAL_STAGES.find((item) => item.stage === stage);
}

function effectTarget(entityType: string, entityId: string) {
  return { entityType, entityId };
}

function effectId(prefix: string, identityId: string, parts: readonly string[]) {
  return [prefix, identityId, ...parts].map((part) => part.replace(/[^a-zA-Z0-9_.:-]/g, "_")).join(":");
}

function resourceLedgerEffect(input: {
  readonly effectId: string;
  readonly targetEntityType: string;
  readonly targetEntityId: string;
  readonly operation: string;
  readonly resourceKey: string;
  readonly resourceClass: string;
  readonly unit: string;
  readonly accountRef: string;
  readonly quantity: number;
  readonly sourceEventIds: readonly string[];
  readonly authorizationRefs?: readonly string[];
  readonly creationSourceRef?: string;
  readonly destructionSinkRef?: string;
}): CausalEffectV1 {
  return {
    effectId: input.effectId,
    effectType: "resource_ledger",
    targetRef: effectTarget(input.targetEntityType, input.targetEntityId),
    operation: input.operation,
    after: {
      resourceKey: input.resourceKey,
      resourceClass: input.resourceClass,
      unit: input.unit,
      entries: [{ accountRef: input.accountRef, quantityMinor: String(Math.trunc(input.quantity)) }],
      ...(input.creationSourceRef ? { creationSourceRef: input.creationSourceRef } : {}),
      ...(input.destructionSinkRef ? { destructionSinkRef: input.destructionSinkRef } : {}),
    },
    sourceEventIds: sortedUnique(input.sourceEventIds),
    authorizationRefs: sortedUnique(input.authorizationRefs),
  };
}

function knowledgeEffect(input: {
  readonly effectId: string;
  readonly identityId: string;
  readonly operation: string;
  readonly after: Readonly<Record<string, unknown>>;
  readonly sourceEventIds: readonly string[];
  readonly authorizationRefs?: readonly string[];
}): CausalEffectV1 {
  return {
    effectId: input.effectId,
    effectType: "knowledge_delta",
    targetRef: effectTarget("identity", input.identityId),
    operation: input.operation,
    after: {
      rulesetVersion: PROGRESSION_RULESET_VERSION,
      balanceVersion: PROGRESSION_BALANCE_VERSION,
      ...input.after,
    },
    sourceEventIds: sortedUnique(input.sourceEventIds),
    authorizationRefs: sortedUnique(input.authorizationRefs),
  };
}

export function effectiveAttributeScore(rawValue: number) {
  const value = clampInt(ATTRIBUTE_MIN, ATTRIBUTE_MAX, rawValue);
  if (value <= 55) return value;
  if (value <= 75) return Math.min(95, 55 + Math.round((value - 55) * 0.6));
  return Math.min(95, 67 + Math.round((value - 75) * 0.3));
}

export function attributeXpToNextPoint(attributeValue: number) {
  const value = clampInt(ATTRIBUTE_MIN, ATTRIBUTE_MAX, attributeValue);
  return Math.round(20 + 1.5 * value + 6 * Math.max(0, value - 55));
}

export function validateAttributeCreation(attributes: Readonly<Record<ProgressionAttributeId, number>>) {
  const errors: ProgressionRuleError[] = [];
  let total = 0;
  for (const attributeId of PROGRESSION_ATTRIBUTE_IDS) {
    const value = attributes[attributeId];
    if (!Number.isInteger(value) || value < 20 || value > 40) {
      errors.push(error("ATTRIBUTE_CREATION_BUDGET_INVALID", "creation attributes must be integers from 20 to 40", `attributes.${attributeId}`));
    }
    total += Number.isFinite(value) ? value : 0;
  }
  if (total !== 180) {
    errors.push(error("ATTRIBUTE_CREATION_BUDGET_INVALID", "creation attributes must spend exactly 180 points", "attributes"));
  }
  return validation(errors);
}

export function calculateAttributeEvidenceXp(input: AttributeEvidenceInput) {
  const novelty = REPEAT_NOVELTY_BPS[Math.min(Math.max(0, input.repeatIndex), REPEAT_NOVELTY_BPS.length - 1)];
  const raw = mulBps(
    4,
    clampBps(0, BPS, input.relevanceBps),
    CHALLENGE_FIT_BPS[input.challengeBand],
    clampBps(5_000, 12_000, input.executionQualityBps),
    clampBps(5_000, BPS, input.recoveryStateBps),
    novelty,
  );
  return Math.max(0, raw);
}

export function validateAttributeEvidence(input: AttributeEvidenceInput) {
  const errors: ProgressionRuleError[] = [];
  if (!PROGRESSION_ATTRIBUTE_IDS.includes(input.attributeId)) {
    errors.push(error("ATTRIBUTE_INVALID", "unknown attribute id", "attributeId"));
  }
  if ((input.directAttributeAmount || 0) !== 0) {
    errors.push(error("ATTRIBUTE_DIRECT_RUN_GAIN_FORBIDDEN", "run rewards may record evidence xp but may not grant raw attribute points", "directAttributeAmount"));
  }
  if (!input.sourceEventIds.length) {
    errors.push(error("ATTRIBUTE_EVIDENCE_REQUIREMENT_MISSING", "attribute evidence requires source event ids", "sourceEventIds", true));
  }
  if (!input.actionTags.length) {
    errors.push(error("ATTRIBUTE_EVIDENCE_REQUIREMENT_MISSING", "attribute evidence requires concrete action tags", "actionTags", true));
  }
  const xp = calculateAttributeEvidenceXp(input);
  if ((input.runAwardedXpSoFar || 0) + xp > ATTRIBUTE_RUN_XP_CAP) {
    errors.push(error("ATTRIBUTE_EVIDENCE_CAP_EXCEEDED", "per-attribute run evidence xp cap exceeded", "runAwardedXpSoFar"));
  }
  if ((input.allAttributesRunAwardedXpSoFar || 0) + xp > ALL_ATTRIBUTE_RUN_XP_CAP) {
    errors.push(error("ATTRIBUTE_EVIDENCE_CAP_EXCEEDED", "all-attribute run evidence xp cap exceeded", "allAttributesRunAwardedXpSoFar"));
  }
  return validation(errors);
}

export function validateAttributePointIncrease(
  state: ProgressionState,
  attributeId: ProgressionAttributeId,
  points = 1,
) {
  const current = state.attributes[attributeId];
  const xp = state.resources?.attributeEvidenceXp?.[attributeId] || 0;
  let required = 0;
  for (let index = 0; index < Math.max(0, points); index += 1) {
    required += attributeXpToNextPoint(current + index);
  }
  const errors: ProgressionRuleError[] = [];
  if (!PROGRESSION_ATTRIBUTE_IDS.includes(attributeId)) errors.push(error("ATTRIBUTE_INVALID", "unknown attribute id", "attributeId"));
  if (!Number.isInteger(points) || points <= 0) errors.push(error("ATTRIBUTE_INVALID", "attribute point increase must be positive integer", "points"));
  if (current + points > ATTRIBUTE_MAX) errors.push(error("ATTRIBUTE_INVALID", "attribute hard cap exceeded", "points"));
  if (xp < required) errors.push(error("ATTRIBUTE_XP_INSUFFICIENT", `requires ${required} evidence xp`, `resources.attributeEvidenceXp.${attributeId}`, true));
  return validation(errors);
}

export function proposeAttributeEvidence(state: ProgressionState, input: AttributeEvidenceInput): ProgressionProposal {
  const result = validateAttributeEvidence(input);
  const xp = calculateAttributeEvidenceXp(input);
  return {
    ok: result.ok,
    commandType: "progression.attribute_evidence_recorded",
    namespace: "identity",
    effects: result.ok ? [resourceLedgerEffect({
      effectId: effectId("progression.attribute_evidence", state.identityId, [input.attributeId, String(xp)]),
      targetEntityType: "identity",
      targetEntityId: state.identityId,
      operation: "grant_evidence",
      resourceKey: `attribute_evidence.${input.attributeId}`,
      resourceClass: "progression_evidence",
      unit: "xp",
      accountRef: `identity:${state.identityId}:progression`,
      quantity: xp,
      creationSourceRef: CAUSAL_RESOURCE_SOURCE_REFS.verifiedActionEvidence,
      sourceEventIds: input.sourceEventIds,
    })] : [],
    errors: result.errors,
    explanation: { xp, actionTags: [...input.actionTags].sort(), noDirectAttributeGain: true },
  };
}

export function validateBreakthrough(state: ProgressionState, input: BreakthroughAttemptInput) {
  const errors: ProgressionRuleError[] = [];
  const target = stageConfig(input.targetStage);
  if (!target) errors.push(error("FUNCTIONAL_STAGE_INVALID", "target stage must be 1 through 6", "targetStage"));
  if (input.targetStage !== state.functionalStage + 1) {
    errors.push(error("BREAKTHROUGH_NOT_NEXT_STAGE", "breakthrough may only advance exactly one stage", "targetStage"));
  }
  if (target) {
    const functionalXp = resourceAmount(state.resources, "functionalXp");
    const primaryMethod = Math.max(0, ...Object.values(state.resources?.methodProficiency || {}).map((value) => Math.trunc(value)));
    const domainInsight = Math.max(0, ...Object.values(state.resources?.domainInsight || {}).map((value) => Math.trunc(value || 0)));
    if (functionalXp < target.xp) errors.push(error("BREAKTHROUGH_REQUIREMENT_UNMET", `requires ${target.xp} functional xp`, "resources.functionalXp", true));
    if (primaryMethod < target.primaryMethod) errors.push(error("BREAKTHROUGH_REQUIREMENT_UNMET", `requires ${target.primaryMethod} primary method proficiency`, "resources.methodProficiency", true));
    if (domainInsight < target.insight) errors.push(error("BREAKTHROUGH_REQUIREMENT_UNMET", `requires ${target.insight} primary domain insight`, "resources.domainInsight", true));
  }
  const materialRule = BREAKTHROUGH_MATERIALS[input.targetStage];
  if (materialRule) {
    if (input.facilityTier < materialRule.facilityTier) {
      errors.push(error("BREAKTHROUGH_REQUIREMENT_UNMET", `requires facility tier ${materialRule.facilityTier}`, "facilityTier", true));
    }
    for (const material of materialRule.materials) {
      if (materialQuantity(input.preparedMaterials, material.materialId) < material.quantity) {
        errors.push(error("BREAKTHROUGH_MATERIAL_INSUFFICIENT", `requires ${material.quantity} ${material.materialId}`, `preparedMaterials.${material.materialId}`, true));
      }
    }
  }
  if (!state.qualificationRefs?.length && !input.qualificationRefs?.length) {
    errors.push(error("BREAKTHROUGH_REQUIREMENT_UNMET", "power system qualification evidence is required", "qualificationRefs", true));
  }
  const status = state.status || {};
  if ((status.injurySeverity || 0) > 60) errors.push(error("BREAKTHROUGH_STATUS_BLOCKED", "injury severity is too high", "status.injurySeverity", true));
  if ((status.pollution || 0) > 70) errors.push(error("BREAKTHROUGH_STATUS_BLOCKED", "pollution is too high", "status.pollution", true));
  if ((status.debtSeverity || 0) > 80) errors.push(error("BREAKTHROUGH_STATUS_BLOCKED", "debt pressure is too high", "status.debtSeverity", true));
  if ((status.stability ?? 100) < 50) errors.push(error("BREAKTHROUGH_STATUS_BLOCKED", "identity stability is too low", "status.stability", true));
  if (!input.frozenSeedRef) errors.push(error("BREAKTHROUGH_REQUIREMENT_UNMET", "server-frozen seed and consequence reference is required", "frozenSeedRef", true));
  return validation(errors);
}

export function proposeBreakthrough(state: ProgressionState, input: BreakthroughAttemptInput): ProgressionProposal {
  const result = validateBreakthrough(state, input);
  const materialRule = BREAKTHROUGH_MATERIALS[input.targetStage];
  const materialEffects = result.ok && materialRule ? materialRule.materials.map((material) => resourceLedgerEffect({
    effectId: effectId("progression.breakthrough.material", state.identityId, [String(input.targetStage), material.materialId]),
    targetEntityType: "identity",
    targetEntityId: state.identityId,
    operation: "consume_breakthrough_material",
    resourceKey: `material.${material.materialId}`,
    resourceClass: "material",
    unit: "count",
    accountRef: `identity:${state.identityId}:inventory`,
    quantity: -material.quantity,
    destructionSinkRef: CAUSAL_RESOURCE_SINK_REFS.breakthroughRitual,
    sourceEventIds: input.sourceEventIds,
  })) : [];
  const stageEffect: CausalEffectV1[] = result.ok ? [{
    effectId: effectId("progression.functional_stage", state.identityId, [String(state.functionalStage), String(input.targetStage)]),
    effectType: "state_transition",
    targetRef: effectTarget("identity", state.identityId),
    operation: "advance_functional_stage",
    after: {
      stateMachineId: "progression.functional_stage",
      fromState: String(state.functionalStage),
      toState: String(input.targetStage),
      transitionId: `stage_${state.functionalStage}_to_${input.targetStage}`,
      reasonCode: "breakthrough_requirements_met",
    },
    sourceEventIds: sortedUnique(input.sourceEventIds),
    authorizationRefs: sortedUnique([...(input.qualificationRefs || []), ...(state.qualificationRefs || []), input.frozenSeedRef]),
  }] : [];
  return {
    ok: result.ok,
    commandType: "progression.functional_stage_advanced",
    namespace: "identity",
    effects: [...materialEffects, ...stageEffect],
    errors: result.errors,
    explanation: { targetStage: input.targetStage, materialRule, insuranceApplies: Boolean(input.insuranceApplies) },
  };
}

export function validateTalentAllocation(state: ProgressionState, input: TalentAllocationInput) {
  const remaining = (state.talents || []).filter((talent) => !(input.removeTalentIds || []).includes(talent.talentId));
  const talents = [...remaining, ...input.addTalents].sort((a, b) => a.talentId.localeCompare(b.talentId));
  const capacity = Math.min(state.talentCapacity || TALENT_STARTING_CAPACITY, TALENT_MAX_CAPACITY);
  const activeSlots = Math.min(state.activeTalentSlots || stageConfig(state.functionalStage)?.talent || TALENT_STARTING_ACTIVE_SLOTS, TALENT_MAX_ACTIVE_SLOTS);
  const errors: ProgressionRuleError[] = [];
  const cost = talents.reduce((total, talent) => total + TALENT_COSTS[talent.impact], 0);
  if (cost > capacity || talents.length > activeSlots) {
    errors.push(error("TALENT_CAPACITY_EXCEEDED", "talent capacity or active slot limit exceeded", "talents"));
  }
  const definingGroups = new Set<string>();
  const scalarByChannel = new Map<string, number>();
  let scalarStack = BPS;
  const qualificationRefs = new Set([...(state.qualificationRefs || []), ...(input.qualificationRefs || [])]);
  for (const talent of talents) {
    if (talent.impact === "defining") {
      const group = talent.definingGroup || "default_defining";
      if (definingGroups.has(group)) errors.push(error("TALENT_MUTUAL_EXCLUSION", "defining talents are mutually exclusive within a group", `talents.${talent.talentId}`));
      definingGroups.add(group);
    }
    for (const mutexTalentId of talent.mutexTalentIds || []) {
      if (talents.some((candidate) => candidate.talentId === mutexTalentId)) {
        errors.push(error("TALENT_MUTUAL_EXCLUSION", "mutually exclusive talent selected", `talents.${talent.talentId}`));
      }
    }
    for (const ref of talent.requiresQualificationRefs || []) {
      if (!qualificationRefs.has(ref)) errors.push(error("TALENT_QUALIFICATION_MISSING", "talent qualification evidence is missing", `talents.${talent.talentId}.requiresQualificationRefs`, true));
    }
    if (talent.scalarChannel && talent.scalarBps) {
      const channelTotal = (scalarByChannel.get(talent.scalarChannel) || 0) + talent.scalarBps;
      scalarByChannel.set(talent.scalarChannel, channelTotal);
      scalarStack = mulBps(scalarStack, BPS + talent.scalarBps);
    }
  }
  for (const [channel, total] of scalarByChannel) {
    if (total > TALENT_SCALAR_PER_CHANNEL_CAP_BPS) {
      errors.push(error("TALENT_SCALAR_CAP_EXCEEDED", "pure scalar talent channel cap exceeded", `talentScalar.${channel}`));
    }
  }
  if (scalarStack > TALENT_SCALAR_STACK_CAP_BPS) {
    errors.push(error("TALENT_SCALAR_CAP_EXCEEDED", "total talent scalar stack cap exceeded", "talentScalar.stack"));
  }
  return validation(errors);
}

export function proposeTalentAllocation(state: ProgressionState, input: TalentAllocationInput): ProgressionProposal {
  const result = validateTalentAllocation(state, input);
  return {
    ok: result.ok,
    commandType: "progression.talent_manifested",
    namespace: "identity",
    effects: result.ok ? [knowledgeEffect({
      effectId: effectId("progression.talent_allocation", state.identityId, input.addTalents.map((talent) => talent.talentId)),
      identityId: state.identityId,
      operation: "allocate_talent_graph",
      after: {
        addedTalentIds: input.addTalents.map((talent) => talent.talentId).sort(),
        removedTalentIds: sortedUnique(input.removeTalentIds),
        capacity: Math.min(state.talentCapacity || TALENT_STARTING_CAPACITY, TALENT_MAX_CAPACITY),
        mechanicFirst: true,
      },
      sourceEventIds: input.addTalents.flatMap((talent) => talent.requiresQualificationRefs || []),
      authorizationRefs: input.qualificationRefs,
    })] : [],
    errors: result.errors,
    explanation: { addedTalentIds: input.addTalents.map((talent) => talent.talentId).sort() },
  };
}

export function spentSkillPoints(nodes: readonly Pick<SkillNodeDefinition, "tier">[]) {
  return nodes.reduce((total, node) => total + SKILL_TIER_COSTS[node.tier], 0);
}

export function validateSkillUnlock(state: ProgressionState, input: SkillUnlockInput) {
  const errors: ProgressionRuleError[] = [];
  const stage = stageConfig(state.functionalStage);
  const learned = new Set(state.learnedSkillNodeIds || []);
  const node = input.node;
  const budget = stage?.skillPoints || 0;
  const spent = resourceAmount(state.resources, "skillPointsSpent");
  const cost = SKILL_TIER_COSTS[node.tier];
  if (spent + cost > budget) errors.push(error("SKILL_POINT_BUDGET_EXCEEDED", "skill point budget exceeded for current functional stage", "resources.skillPointsSpent"));
  for (const prerequisite of node.prerequisiteNodeIds || []) {
    if (!learned.has(prerequisite)) errors.push(error("SKILL_PREREQUISITE_MISSING", "required prerequisite skill node is missing", `node.prerequisiteNodeIds.${prerequisite}`, true));
  }
  for (const mutex of node.mutexNodeIds || []) {
    if (learned.has(mutex)) errors.push(error("SKILL_MUTUAL_EXCLUSION", "mutually exclusive skill node already learned", `node.mutexNodeIds.${mutex}`));
  }
  if ((node.requiredStage || 1) > state.functionalStage) errors.push(error("SKILL_STAGE_GATE_UNMET", "functional stage gate is unmet", "node.requiredStage", true));
  const methodProficiency = node.requiredMethodId ? state.resources?.methodProficiency?.[node.requiredMethodId] || 0 : 0;
  if (node.requiredMethodId && methodProficiency < (node.requiredMethodProficiency || 0)) {
    errors.push(error("SKILL_PROFICIENCY_GATE_UNMET", "method proficiency gate is unmet", "node.requiredMethodProficiency", true));
  }
  if (node.requiredDomainId && (state.resources?.domainInsight?.[node.requiredDomainId] || 0) < (node.requiredDomainInsight || 0)) {
    errors.push(error("SKILL_DOMAIN_GATE_UNMET", "domain insight gate is unmet", "node.requiredDomainInsight", true));
  }
  if (node.requiresSourceEvidence && !input.sourceEventIds.length) {
    errors.push(error("SKILL_SOURCE_EVIDENCE_MISSING", "teacher, manual, or world source evidence is required", "sourceEventIds", true));
  }
  errors.push(...materialErrors(input.availableMaterials, node.materialCost || [], "availableMaterials"));
  return validation(errors);
}

export function proposeSkillUnlock(state: ProgressionState, input: SkillUnlockInput): ProgressionProposal {
  const result = validateSkillUnlock(state, input);
  const materialEffects = result.ok ? (input.node.materialCost || []).map((material) => resourceLedgerEffect({
    effectId: effectId("progression.skill.material", state.identityId, [input.node.nodeId, material.materialId]),
    targetEntityType: "identity",
    targetEntityId: state.identityId,
    operation: "consume_skill_material",
    resourceKey: `material.${material.materialId}`,
    resourceClass: "material",
    unit: "count",
    accountRef: `identity:${state.identityId}:inventory`,
    quantity: -material.quantity,
    destructionSinkRef: CAUSAL_RESOURCE_SINK_REFS.skillAdvancement,
    sourceEventIds: input.sourceEventIds,
  })) : [];
  return {
    ok: result.ok,
    commandType: "progression.skill_node_unlocked",
    namespace: "identity",
    effects: result.ok ? [
      resourceLedgerEffect({
        effectId: effectId("progression.skill.point", state.identityId, [input.node.nodeId]),
        targetEntityType: "identity",
        targetEntityId: state.identityId,
        operation: "allocate_skill_points",
        resourceKey: "skill_points",
        resourceClass: "progression_budget",
        unit: "point",
        accountRef: `identity:${state.identityId}:skill_tree`,
        quantity: -SKILL_TIER_COSTS[input.node.tier],
        destructionSinkRef: CAUSAL_RESOURCE_SINK_REFS.skillTreeAllocation,
        sourceEventIds: input.sourceEventIds,
      }),
      ...materialEffects,
      knowledgeEffect({
        effectId: effectId("progression.skill.unlock", state.identityId, [input.node.nodeId]),
        identityId: state.identityId,
        operation: "unlock_skill_node",
        after: {
          nodeId: input.node.nodeId,
          tier: input.node.tier,
          kind: input.node.kind,
          pointCost: SKILL_TIER_COSTS[input.node.tier],
        },
        sourceEventIds: input.sourceEventIds,
      }),
    ] : [],
    errors: result.errors,
    explanation: { nodeId: input.node.nodeId, pointCost: SKILL_TIER_COSTS[input.node.tier] },
  };
}

export function validateSkillAdvancement(state: ProgressionState, input: SkillAdvanceInput) {
  const errors: ProgressionRuleError[] = [];
  const rule = TECHNIQUE_ADVANCEMENT[input.targetTechniqueTier];
  if (!rule) return validation([error("SKILL_ADVANCEMENT_INVALID", "target technique tier must be 1 through 6", "targetTechniqueTier")]);
  if (input.targetTechniqueTier > (stageConfig(state.functionalStage)?.stage || 1)) {
    errors.push(error("SKILL_STAGE_GATE_UNMET", "technique tier exceeds current functional stage", "targetTechniqueTier", true));
  }
  if (input.currentProficiency < rule.proficiency) {
    errors.push(error("SKILL_PROFICIENCY_GATE_UNMET", `requires proficiency ${rule.proficiency}`, "currentProficiency", true));
  }
  if (rule.worldEvidence && !input.hasWorldEvidence) {
    errors.push(error("SKILL_SOURCE_EVIDENCE_MISSING", "tier 6 advancement requires world event evidence", "hasWorldEvidence", true));
  }
  errors.push(...materialErrors(input.availableMaterials, rule.materials, "availableMaterials"));
  return validation(errors);
}

export function validateRespec(state: ProgressionState, input: RespecInput) {
  const errors: ProgressionRuleError[] = [];
  if (input.scope === "primarySystem") {
    errors.push(error("RESPEC_FORBIDDEN", "primary power system cannot be changed within the same identity", "scope"));
  }
  const insightCost = input.scope === "sameNode" ? 1 : input.scope === "sameBranch" ? 2 : input.scope === "crossTradition" ? 3 : Number.MAX_SAFE_INTEGER;
  const lineageCost = input.scope === "crossTradition" ? 1 : 0;
  if (resourceAmount(state.resources, "insightPoints") < insightCost) errors.push(error("RESPEC_COST_INSUFFICIENT", `requires ${insightCost} insight points`, "resources.insightPoints", true));
  if (resourceAmount(state.resources, "lineageMarks") < lineageCost) errors.push(error("RESPEC_COST_INSUFFICIENT", `requires ${lineageCost} lineage marks`, "resources.lineageMarks", true));
  if (!input.sourceEventIds.length) errors.push(error("SKILL_SOURCE_EVIDENCE_MISSING", "respec requires teacher, service, or contract evidence", "sourceEventIds", true));
  return validation(errors);
}

export function proposeRespec(state: ProgressionState, input: RespecInput): ProgressionProposal {
  const result = validateRespec(state, input);
  const insightCost = input.scope === "sameNode" ? 1 : input.scope === "sameBranch" ? 2 : input.scope === "crossTradition" ? 3 : 0;
  const lineageCost = input.scope === "crossTradition" ? 1 : 0;
  const lossBps = input.scope === "sameNode" ? 2_000 : input.scope === "sameBranch" ? 4_000 : input.scope === "crossTradition" ? 5_000 : 10_000;
  const effects: CausalEffectV1[] = [];
  if (result.ok) {
    effects.push(resourceLedgerEffect({
      effectId: effectId("progression.respec.insight", state.identityId, [input.scope]),
      targetEntityType: "identity",
      targetEntityId: state.identityId,
      operation: "consume_respec_insight",
      resourceKey: "insight_points",
      resourceClass: "progression_budget",
      unit: "point",
      accountRef: `identity:${state.identityId}:skill_tree`,
      quantity: -insightCost,
      destructionSinkRef: CAUSAL_RESOURCE_SINK_REFS.skillRespec,
      sourceEventIds: input.sourceEventIds,
    }));
    if (lineageCost) {
      effects.push(resourceLedgerEffect({
        effectId: effectId("progression.respec.lineage", state.identityId, [input.scope]),
        targetEntityType: "lineage",
        targetEntityId: state.lineageId || state.identityId,
        operation: "consume_respec_lineage_mark",
        resourceKey: "lineage_marks",
        resourceClass: "lineage_entitlement",
        unit: "mark",
        accountRef: `lineage:${state.lineageId || state.identityId}:progression`,
        quantity: -lineageCost,
        destructionSinkRef: CAUSAL_RESOURCE_SINK_REFS.crossTraditionRespec,
        sourceEventIds: input.sourceEventIds,
      }));
    }
    effects.push(knowledgeEffect({
      effectId: effectId("progression.skill.respec", state.identityId, [input.scope, ...input.nodeIds]),
      identityId: state.identityId,
      operation: "respec_skill_nodes",
      after: {
        scope: input.scope,
        nodeIds: sortedUnique(input.nodeIds),
        spentExperienceLoss: mulBps(input.spentExperience, lossBps),
      },
      sourceEventIds: input.sourceEventIds,
    }));
  }
  return {
    ok: result.ok,
    commandType: "progression.skill_node_respecced",
    namespace: input.scope === "crossTradition" ? "lineage" : "identity",
    effects,
    errors: result.errors,
    explanation: { insightCost, lineageCost, spentExperienceLoss: mulBps(input.spentExperience, lossBps) },
  };
}

export function validateCarryLoadout(state: ProgressionState, items: readonly CarryLoadoutItem[]) {
  const errors: ProgressionRuleError[] = [];
  const carrySlots = Math.min(state.carrySlots || BASE_CARRY_SLOTS, HARD_CARRY_SLOT_CAP);
  const deploymentCapacity = Math.min(state.deploymentCapacity || BASE_DEPLOYMENT_CAPACITY, HARD_DEPLOYMENT_CAPACITY_CAP);
  const quickUseSlots = Math.min(state.quickUseSlots || BASE_QUICK_USE_SLOTS, HARD_QUICK_USE_SLOT_CAP);
  const deployment = items.reduce((total, item) => total + DEPLOYMENT_COSTS[item.rarity], 0);
  const quickUseCount = items.filter((item) => item.quickUse).length;
  if (items.length > carrySlots) errors.push(error("LOADOUT_SLOT_CAP_EXCEEDED", "physical bring-in slot cap exceeded", "items"));
  if (deployment > deploymentCapacity) errors.push(error("LOADOUT_DEPLOYMENT_CAP_EXCEEDED", "deployment capacity cap exceeded", "items"));
  if (quickUseCount > quickUseSlots) errors.push(error("LOADOUT_QUICK_SLOT_CAP_EXCEEDED", "quick-use slot cap exceeded", "items"));
  if (items.filter((item) => item.category === "mainCore").length > 1) {
    errors.push(error("LOADOUT_CATEGORY_CAP_EXCEEDED", "only one main core may be brought in", "items.category.mainCore"));
  }
  const byCategory = new Map<string, number>();
  for (const item of items) {
    byCategory.set(item.category, (byCategory.get(item.category) || 0) + 1);
    if (item.questItem) errors.push(error("LOADOUT_ITEM_FORBIDDEN", "quest items cannot be brought in", `items.${item.itemId}`));
  }
  for (const [category, count] of byCategory) {
    if (category !== "mainCore" && count > 2) errors.push(error("LOADOUT_CATEGORY_CAP_EXCEEDED", "same category bring-in cap exceeded", `items.category.${category}`));
  }
  return validation(errors);
}

export function validateExpandCarry(state: ProgressionState, input: ExpandCarryInput) {
  const errors: ProgressionRuleError[] = [];
  if ((input.targetCarrySlots || state.carrySlots || BASE_CARRY_SLOTS) > HARD_CARRY_SLOT_CAP) {
    errors.push(error("LOADOUT_SLOT_CAP_EXCEEDED", "carry slot hard cap exceeded", "targetCarrySlots"));
  }
  if ((input.targetDeploymentCapacity || state.deploymentCapacity || BASE_DEPLOYMENT_CAPACITY) > HARD_DEPLOYMENT_CAPACITY_CAP) {
    errors.push(error("LOADOUT_DEPLOYMENT_CAP_EXCEEDED", "deployment capacity hard cap exceeded", "targetDeploymentCapacity"));
  }
  if ((input.targetQuickUseSlots || state.quickUseSlots || BASE_QUICK_USE_SLOTS) > HARD_QUICK_USE_SLOT_CAP) {
    errors.push(error("LOADOUT_QUICK_SLOT_CAP_EXCEEDED", "quick-use hard cap exceeded", "targetQuickUseSlots"));
  }
  if ((input.targetEchoSlots || state.echoSlots || BASE_ECHO_SLOTS) > HARD_ECHO_SLOT_CAP) {
    errors.push(error("LINEAGE_CAP_EXCEEDED", "echo slot hard cap exceeded", "targetEchoSlots"));
  }
  if ((input.targetInsuranceLayers || state.insuranceLayers || 0) > HARD_INSURANCE_LAYER_CAP) {
    errors.push(error("INSURANCE_CAP_EXCEEDED", "insurance layer hard cap exceeded", "targetInsuranceLayers"));
  }
  if (!input.sourceEventIds.length) errors.push(error("RESOURCE_SOURCE_MISSING", "loadout growth requires lineage, logistics, or insurance source event", "sourceEventIds", true));
  return validation(errors);
}

export function proposeExpandCarry(state: ProgressionState, input: ExpandCarryInput): ProgressionProposal {
  const result = validateExpandCarry(state, input);
  return {
    ok: result.ok,
    commandType: "lineage.loadout_capacity_expanded",
    namespace: "lineage",
    effects: result.ok ? [{
      effectId: effectId("lineage.loadout_capacity", state.lineageId || state.identityId, [
        String(input.targetCarrySlots || state.carrySlots || BASE_CARRY_SLOTS),
        String(input.targetDeploymentCapacity || state.deploymentCapacity || BASE_DEPLOYMENT_CAPACITY),
      ]),
      effectType: "ownership_interest",
      targetRef: effectTarget("lineage", state.lineageId || state.identityId),
      operation: "grant_carry_permission",
      after: {
        itemRef: `lineage:${state.lineageId || state.identityId}:loadout_capacity`,
        interestType: "carry_permission",
        holderRef: `identity:${state.identityId}`,
        validFromWorldMinute: 0,
        basisEventIds: sortedUnique(input.sourceEventIds),
        priority: 0,
        transferable: false,
        status: "granted",
      },
      sourceEventIds: sortedUnique(input.sourceEventIds),
      authorizationRefs: [],
    }] : [],
    errors: result.errors,
    explanation: {
      targetCarrySlots: input.targetCarrySlots,
      targetDeploymentCapacity: input.targetDeploymentCapacity,
      targetQuickUseSlots: input.targetQuickUseSlots,
      targetEchoSlots: input.targetEchoSlots,
      targetInsuranceLayers: input.targetInsuranceLayers,
      opportunityCostRequired: true,
    },
  };
}

export function convertRunReward(input: RunRewardConversionInput): ProgressionProposal {
  const errors: ProgressionRuleError[] = [];
  if (!input.rewardSourceRef) errors.push(error("RESOURCE_SOURCE_MISSING", "run rewards require a source account, inventory, reservoir, escrow, or audited mint ref", "rewardSourceRef", true));
  if (!input.sourceEventIds.length) errors.push(error("RESOURCE_SOURCE_MISSING", "run reward conversion requires source event ids", "sourceEventIds", true));
  const retention = SETTLEMENT_RETENTION_BPS[input.outcome];
  const functionalXp = mulBps(input.confirmedClaimValue + input.unconfirmedClaimValue, retention.confirmed) + mulBps(input.practiceEvidenceXp, retention.practice);
  const insight = Math.min(12, mulBps(input.insightEvidence, retention.practice));
  const materialRetention = retention.unconfirmed;
  const materialEffects = (input.materials || [])
    .slice()
    .sort((a, b) => a.materialId.localeCompare(b.materialId))
    .map((material) => ({
      ...material,
      quantity: mulBps(material.quantity, materialRetention),
    }))
    .filter((material) => material.quantity > 0)
    .map((material) => resourceLedgerEffect({
      effectId: effectId("progression.run_reward.material", input.identityId, [input.outcome, material.materialId]),
      targetEntityType: "identity",
      targetEntityId: input.identityId,
      operation: "grant_retained_material",
      resourceKey: `material.${material.materialId}`,
      resourceClass: "material",
      unit: "count",
      accountRef: `identity:${input.identityId}:inventory`,
      quantity: material.quantity,
      creationSourceRef: CAUSAL_RESOURCE_SOURCE_REFS.missionReward,
      sourceEventIds: input.sourceEventIds,
    }));
  const effects = errors.length ? [] : [
    resourceLedgerEffect({
      effectId: effectId("progression.run_reward.functional_xp", input.identityId, [input.outcome]),
      targetEntityType: "identity",
      targetEntityId: input.identityId,
      operation: "grant_functional_xp_from_run_evidence",
      resourceKey: "functional_xp",
      resourceClass: "progression_resource",
      unit: "xp",
      accountRef: `identity:${input.identityId}:progression`,
      quantity: functionalXp,
      creationSourceRef: CAUSAL_RESOURCE_SOURCE_REFS.missionReward,
      sourceEventIds: input.sourceEventIds,
    }),
    resourceLedgerEffect({
      effectId: effectId("progression.run_reward.insight", input.identityId, [input.outcome]),
      targetEntityType: "identity",
      targetEntityId: input.identityId,
      operation: "grant_insight_from_run_evidence",
      resourceKey: "insight_points",
      resourceClass: "progression_budget",
      unit: "point",
      accountRef: `identity:${input.identityId}:skill_tree`,
      quantity: insight,
      creationSourceRef: CAUSAL_RESOURCE_SOURCE_REFS.missionReward,
      sourceEventIds: input.sourceEventIds,
    }),
    ...materialEffects,
  ];
  return {
    ok: errors.length === 0,
    commandType: "progression.run_reward_converted",
    namespace: "identity",
    effects,
    errors: stableErrors(errors),
    explanation: {
      outcome: input.outcome,
      functionalXp,
      insight,
      noDirectAttributeGain: true,
      temporaryBuildRetained: 0,
    },
  };
}

export function combatReadinessVector(input: CombatReadinessInput): Readonly<Record<CombatReadinessDimensionId, number>> {
  const state = clampBps(6_000, 11_500, input.stateMultiplierBps || BPS);
  const environment = clampBps(7_000, 13_000, input.environmentMultiplierBps || BPS);
  const combinedBase = clampBps(5_500, 14_500, mulBps(BPS, state, environment));
  const vector = {} as Record<CombatReadinessDimensionId, number>;
  for (const dimension of COMBAT_READINESS_DIMENSION_IDS) {
    const attributeProjection = PROGRESSION_ATTRIBUTE_IDS.reduce((total, attributeId) => {
      return total + mulBps(effectiveAttributeScore(input.attributes[attributeId] || 0), DEFAULT_ATTRIBUTE_PROJECTION[dimension][attributeId]);
    }, 0);
    const method = clampInt(0, 100, input.methodVector?.[dimension] || 0);
    const equipment = clampInt(0, 100, input.equipmentVector?.[dimension] || 0);
    const preparation = clampInt(0, 100, input.preparationVector?.[dimension] || 0);
    const mixed = mulBps(attributeProjection, 3_500) + mulBps(method, 3_000) + mulBps(equipment, 2_000) + mulBps(preparation, 1_500);
    const matchup = clampBps(7_500, 12_500, input.matchupMultiplierByDimension?.[dimension] || BPS);
    vector[dimension] = clampInt(0, 100, mulBps(mixed, combinedBase, matchup));
  }
  return vector;
}

export function combatReadinessDimensionDetails(
  input: EncounterSuitabilityInput,
  vector = combatReadinessVector(input),
): readonly EncounterSuitabilityDimensionDetail[] {
  return COMBAT_READINESS_DIMENSION_IDS.map((dimension) => {
    const weightBps = clampBps(0, BPS, input.encounterWeights[dimension] || 0);
    return {
      dimensionId: dimension,
      inputs: {
        attributeProjectionScore: PROGRESSION_ATTRIBUTE_IDS.reduce((total, attributeId) => {
          return total + mulBps(
            effectiveAttributeScore(input.attributes[attributeId] || 0),
            DEFAULT_ATTRIBUTE_PROJECTION[dimension][attributeId],
          );
        }, 0),
        methodVectorScore: clampInt(0, 100, input.methodVector?.[dimension] || 0),
        equipmentVectorScore: clampInt(0, 100, input.equipmentVector?.[dimension] || 0),
        preparationVectorScore: clampInt(0, 100, input.preparationVector?.[dimension] || 0),
        stateMultiplierBps: clampBps(6_000, 11_500, input.stateMultiplierBps || BPS),
        environmentMultiplierBps: clampBps(7_000, 13_000, input.environmentMultiplierBps || BPS),
        matchupMultiplierBps: clampBps(7_500, 12_500, input.matchupMultiplierByDimension?.[dimension] || BPS),
      },
      weightBps,
      score: vector[dimension],
      contribution: mulBps(vector[dimension], weightBps),
      reasonCode: `progression_suitability_${dimension}`,
    };
  });
}

export function auditProgressionScoreIntensitySuitabilityDecoupling(): ProgressionScoreIntensitySuitabilityAudit {
  return PROGRESSION_SCORE_INTENSITY_SUITABILITY_AUDIT;
}

export function encounterPressure(threatPoints: number) {
  const tp = Math.max(0, Math.trunc(threatPoints));
  return Math.round((100 * tp) / (tp + 120));
}

export function estimateEncounterSuitability(input: EncounterSuitabilityInput) {
  const weightTotal = COMBAT_READINESS_DIMENSION_IDS.reduce((total, dimension) => total + (input.encounterWeights[dimension] || 0), 0);
  const vector = combatReadinessVector(input);
  const dimensionDetails = combatReadinessDimensionDetails(input, vector);
  if (weightTotal !== BPS) {
    return {
      ok: false,
      errors: [error("COMBAT_VECTOR_INVALID", "encounter weights must sum to 10000 bps", "encounterWeights")],
      vector,
      dimensionDetails,
      suitability: 0,
      pressure: encounterPressure(input.threatPoints),
      victoryProbabilityBps: 0,
      band: "invalid",
      decouplingAudit: auditProgressionScoreIntensitySuitabilityDecoupling(),
    };
  }
  const suitability = COMBAT_READINESS_DIMENSION_IDS.reduce((total, dimension) => {
    return total + mulBps(vector[dimension], input.encounterWeights[dimension]);
  }, 0);
  const pressure = encounterPressure(input.threatPoints);
  const probability = 1 / (1 + Math.exp(-(suitability - pressure) / 12));
  const victoryProbabilityBps = clampInt(0, BPS, Math.round(probability * BPS));
  const band = victoryProbabilityBps < 2_500
    ? "critical"
    : victoryProbabilityBps < 4_500
      ? "disadvantaged"
      : victoryProbabilityBps < 5_500
        ? "contested"
        : victoryProbabilityBps < 7_500
          ? "favored"
          : "dominant";
  return {
    ok: true,
    errors: [],
    vector,
    dimensionDetails,
    suitability,
    pressure,
    victoryProbabilityBps,
    band,
    decouplingAudit: auditProgressionScoreIntensitySuitabilityDecoupling(),
  };
}

export function methodPracticeGain(input: {
  readonly base: number;
  readonly difficultyFitBps: FixedBps;
  readonly repeatIndex: number;
  readonly correctnessBps: FixedBps;
  readonly mentorshipBps: FixedBps;
  readonly riskFitBps: FixedBps;
}) {
  const novelty = METHOD_REPEAT_NOVELTY_BPS[Math.min(Math.max(0, input.repeatIndex), METHOD_REPEAT_NOVELTY_BPS.length - 1)];
  return mulBps(
    input.base,
    clampBps(0, 15_000, input.difficultyFitBps),
    novelty,
    clampBps(0, 12_000, input.correctnessBps),
    clampBps(0, 15_000, input.mentorshipBps),
    clampBps(0, 15_000, input.riskFitBps),
  );
}
