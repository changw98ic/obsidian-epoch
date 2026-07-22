import type { CausalEffectV1, CausalEntityRef } from "./causalContracts.ts";

export const MISSION_CONSEQUENCE_RULES_VERSION = "mission_consequence_rules_v1" as const;

export const MISSION_STATUSES = [
  "offered",
  "accepted",
  "active",
  "resolved",
  "failed",
  "abandoned",
  "expired",
] as const;

export type MissionStatus = typeof MISSION_STATUSES[number];

export const MISSION_TERMINAL_STATUSES: ReadonlySet<MissionStatus> = new Set([
  "resolved",
  "failed",
  "abandoned",
  "expired",
]);

export const MISSION_OUTCOMES = [
  "clean_success",
  "costly_success",
  "partial_success",
  "stalemate",
  "withdrawal",
  "failure",
  "catastrophe",
  "timeout",
] as const;

export type MissionOutcome = typeof MISSION_OUTCOMES[number];

export const MISSION_CONSEQUENCE_ERROR_CODES = [
  "mission_contract_id_required",
  "mission_world_id_required",
  "mission_root_pressure_required",
  "mission_objective_required",
  "mission_objective_id_required",
  "mission_objective_target_required",
  "mission_reward_source_required",
  "mission_invalid_status",
  "mission_invalid_transition",
  "mission_terminal_transition",
  "mission_expiry_before_offer",
  "mission_accepted_before_offer",
  "mission_active_before_acceptance",
  "mission_value_out_of_range",
  "mission_effect_source_required",
] as const;

export type MissionConsequenceErrorCode = typeof MISSION_CONSEQUENCE_ERROR_CODES[number];

export interface MissionValidationIssue {
  readonly code: MissionConsequenceErrorCode;
  readonly path: string;
  readonly message: string;
}

export interface MissionValidationResult {
  readonly ok: boolean;
  readonly issues: readonly MissionValidationIssue[];
}

export type MissionInterventionFamily =
  | "combat"
  | "investigation"
  | "negotiation"
  | "logistics"
  | "crafting"
  | "medical"
  | "legal"
  | "political"
  | "economic"
  | "stealth"
  | "supernatural"
  | "care";

export type MissionObjectiveOperator =
  | "eq"
  | "neq"
  | "gte"
  | "lte"
  | "contains"
  | "exists"
  | "state_is";

export interface MissionObjective {
  readonly objectiveId: string;
  readonly title?: string;
  readonly targetRef: CausalEntityRef;
  readonly operator: MissionObjectiveOperator;
  readonly expectedValue: unknown;
  readonly observableWorldStateRef?: string;
  readonly required: boolean;
  readonly weight: number;
}

export interface MissionRewardProposal {
  readonly resourceKey: string;
  readonly resourceClass: string;
  readonly unit: string;
  readonly quantityMinor: string;
  readonly payerAccountRef: string;
  readonly recipientAccountRef: string;
  readonly fundingRef: string;
}

export interface MissionResourceStake {
  readonly resourceKey: string;
  readonly resourceClass: string;
  readonly unit: string;
  readonly maxSpendMinor: string;
  readonly accountRef: string;
}

export interface MissionRiskProfile {
  readonly opposition: number;
  readonly environmentalHazard: number;
  readonly objectiveComplexity: number;
  readonly informationUncertainty: number;
  readonly logisticalBurden: number;
  readonly legalPoliticalRisk: number;
  readonly irreversibility: number;
}

export interface MissionContract {
  readonly contractId: string;
  readonly worldId: string;
  readonly status: MissionStatus;
  readonly interventionFamily: MissionInterventionFamily;
  readonly rootPressureIds: readonly string[];
  readonly sponsorRef?: string;
  readonly beneficiaryRefs: readonly string[];
  readonly oppositionRefs: readonly string[];
  readonly objectivePredicates: readonly MissionObjective[];
  readonly availableEvidenceRefs: readonly string[];
  readonly hiddenInformationRefs: readonly string[];
  readonly legalConstraintRefs: readonly string[];
  readonly rewardFundingRef?: string;
  readonly rewardProposals: readonly MissionRewardProposal[];
  readonly resourceStakes: readonly MissionResourceStake[];
  readonly risk: MissionRiskProfile;
  readonly offeredAtWorldMinute: number;
  readonly acceptedAtWorldMinute?: number;
  readonly activeAtWorldMinute?: number;
  readonly expiresAtWorldMinute?: number;
  readonly authorizationRefs: readonly string[];
  readonly causalParentEventIds: readonly string[];
}

export interface MissionStateTransitionDecision {
  readonly allowed: boolean;
  readonly fromStatus: MissionStatus;
  readonly toStatus: MissionStatus;
  readonly reasonCode: string;
  readonly issues: readonly MissionValidationIssue[];
}

export interface MissionIntensityInput {
  readonly enemyHostilePower: number;
  readonly enemyCoordination?: number;
  readonly environmentalHazard: number;
  readonly objectiveComplexity: number;
  readonly informationUncertainty?: number;
  readonly logisticalBurden?: number;
  readonly legalPoliticalRisk?: number;
  readonly irreversibility?: number;
  readonly resourcePressure: number;
  readonly worldPressure: number;
  readonly playerCombatPower: number;
}

export type MissionIntensityBand = "low" | "medium" | "high" | "extreme";

export interface MissionThreatBudget {
  readonly total: number;
  readonly opposition: number;
  readonly environment: number;
  readonly objectives: number;
  readonly resources: number;
  readonly worldPressure: number;
  readonly readinessGap: number;
}

export interface MissionIntensityBreakdown extends MissionThreatBudget {
  readonly worldIntensity: number;
  readonly encounterIntensity: number;
  readonly band: MissionIntensityBand;
  readonly recommendedBand: MissionIntensityBand;
  readonly playerCombatRatio: number;
  readonly explanation: readonly string[];
}

export interface MissionObjectiveResult {
  readonly objectiveId: string;
  readonly completedBps: number;
  readonly required: boolean;
  readonly weight?: number;
}

export interface MissionNumericDelta {
  readonly targetRef: string;
  readonly delta: number;
  readonly reasonCode: string;
}

export interface MissionResourceConsequence {
  readonly resourceKey: string;
  readonly resourceClass: string;
  readonly unit: string;
  readonly accountRef: string;
  readonly deltaMinor: string;
  readonly sourceOrSinkRef: string;
  readonly reasonCode: string;
}

export interface MissionInjuryConsequence {
  readonly subjectRef: string;
  readonly severity: number;
  readonly lasting: boolean;
  readonly reasonCode: string;
}

export interface MissionKnowledgeConsequence {
  readonly subjectRef: string;
  readonly knowledgeKey: string;
  readonly confidenceDelta: number;
  readonly reasonCode: string;
}

export interface MissionConsequenceInput {
  readonly contract: MissionContract;
  readonly outcome: MissionOutcome;
  readonly objectiveResults: readonly MissionObjectiveResult[];
  readonly actorRef: string;
  readonly occurredAtWorldMinute: number;
  readonly sourceEventIds: readonly string[];
  readonly authorizationRefs?: readonly string[];
  readonly resourceCosts?: readonly MissionResourceConsequence[];
  readonly discoveredKnowledge?: readonly MissionKnowledgeConsequence[];
  readonly existingStress?: number;
  readonly existingInjurySeverity?: number;
}

export interface MissionConsequenceProposal {
  readonly rulesetVersion: typeof MISSION_CONSEQUENCE_RULES_VERSION;
  readonly outcome: MissionOutcome;
  readonly objectiveCompletionBps: number;
  readonly persistentConsequence: boolean;
  readonly resourceConsequences: readonly MissionResourceConsequence[];
  readonly reputationConsequences: readonly MissionNumericDelta[];
  readonly injuryConsequences: readonly MissionInjuryConsequence[];
  readonly stressConsequences: readonly MissionNumericDelta[];
  readonly knowledgeConsequences: readonly MissionKnowledgeConsequence[];
  readonly pressureConsequences: readonly MissionNumericDelta[];
  readonly stateTransition: MissionStateTransitionDecision;
  readonly causalEffects: readonly CausalEffectV1[];
  readonly explanation: readonly string[];
}

export type MissionScoreGrade = "D" | "C" | "B" | "A" | "S" | "SS";

export interface MissionScoreInput {
  readonly objectiveCompletionBps: number;
  readonly pressureReliefBps: number;
  readonly sideEffectControlBps: number;
  readonly executionQualityBps: number;
  readonly riskExposureBps: number;
  readonly meaningfulRiskBps: number;
  readonly resourceEfficiencyBps: number;
  readonly survivalBps: number;
  readonly integrityBps?: number;
  readonly combatPowerFitBps?: number;
  readonly overwhelmingForceBps?: number;
  readonly recentSimilarCompletionCount?: number;
  readonly repeatedResolutionFamilyCount?: number;
}

export type MissionScoreDimensionId =
  | "objective"
  | "causalImpact"
  | "execution"
  | "risk"
  | "efficiency"
  | "survival"
  | "integrity"
  | "antiFarmDecay";

export interface MissionScoreDimensionDetail {
  readonly dimensionId: MissionScoreDimensionId;
  readonly inputs: Readonly<Record<string, number>>;
  readonly weightBps: number;
  readonly score: number;
  readonly contribution: number;
  readonly reasonCode: string;
}

export interface MissionScoreDecouplingAudit {
  readonly ok: boolean;
  readonly scoreIntensityDirectWeightBps: 0;
  readonly suitabilityDirectScoreWeightBps: 0;
  readonly intensityGrantsAttributes: false;
  readonly reasonCodes: readonly string[];
}

export interface MissionScoreBreakdown {
  readonly objective: number;
  readonly causalImpact: number;
  readonly execution: number;
  readonly risk: number;
  readonly efficiency: number;
  readonly survival: number;
  readonly integrity: number;
  readonly antiFarmDecay: number;
  readonly rawScore: number;
  readonly finalScore: number;
  readonly grade: MissionScoreGrade;
  readonly dimensions: readonly MissionScoreDimensionDetail[];
  readonly decouplingAudit: MissionScoreDecouplingAudit;
  readonly explanation: readonly string[];
}

const INTENSITY_WEIGHTS = {
  opposition: 0.2,
  environmentalHazard: 0.14,
  objectiveComplexity: 0.16,
  informationUncertainty: 0.13,
  logisticalBurden: 0.12,
  legalPoliticalRisk: 0.12,
  irreversibility: 0.13,
} as const;

const SCORE_WEIGHTS = {
  objective: 0.25,
  causalImpact: 0.2,
  execution: 0.15,
  risk: 0.12,
  integrity: 0.1,
  efficiency: 0.1,
  survival: 0.08,
} as const;

const SCORE_WEIGHT_BPS: Record<Exclude<MissionScoreDimensionId, "antiFarmDecay">, number> = {
  objective: 2_500,
  causalImpact: 2_000,
  execution: 1_500,
  risk: 1_200,
  integrity: 1_000,
  efficiency: 1_000,
  survival: 800,
} as const;

const MISSION_SCORE_DECOUPLING_AUDIT: MissionScoreDecouplingAudit = {
  ok: true,
  scoreIntensityDirectWeightBps: 0,
  suitabilityDirectScoreWeightBps: 0,
  intensityGrantsAttributes: false,
  reasonCodes: [
    "mission_score_uses_outcome_evidence_not_intensity",
    "mission_suitability_has_zero_direct_score_weight",
    "mission_intensity_never_grants_attributes",
  ],
};

const VALID_TRANSITIONS: Readonly<Record<MissionStatus, readonly MissionStatus[]>> = {
  offered: ["accepted", "expired", "abandoned"],
  accepted: ["active", "abandoned", "expired"],
  active: ["resolved", "failed", "abandoned", "expired"],
  resolved: [],
  failed: [],
  abandoned: [],
  expired: [],
};

function issue(code: MissionConsequenceErrorCode, path: string, message: string): MissionValidationIssue {
  return { code, path, message };
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function clampInteger(value: number, min: number, max: number): number {
  return Math.round(clamp(value, min, max));
}

function clampBps(value: number): number {
  return clampInteger(value, 0, 10_000);
}

function clampPercent(value: number): number {
  return clampInteger(value, 0, 100);
}

function safeRatio(numerator: number, denominator: number): number {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return 0;
  return numerator / denominator;
}

function signedMinor(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.trunc(parsed);
}

function asMinor(value: number): string {
  return String(Math.trunc(value));
}

function effectId(contractId: string, kind: string, index: number): string {
  return `mission:${contractId}:${kind}:${index}`;
}

function entityRefFromString(ref: string, fallbackType: string): CausalEntityRef {
  const [entityType, ...rest] = ref.split(":");
  if (entityType && rest.length > 0) return { entityType, entityId: rest.join(":") };
  return { entityType: fallbackType, entityId: ref };
}

function scoreDimension(
  dimensionId: Exclude<MissionScoreDimensionId, "antiFarmDecay">,
  inputs: Readonly<Record<string, number>>,
  score: number,
  reasonCode: string,
): MissionScoreDimensionDetail {
  const weightBps = SCORE_WEIGHT_BPS[dimensionId];
  return {
    dimensionId,
    inputs,
    weightBps,
    score,
    contribution: score * (weightBps / 10_000),
    reasonCode,
  };
}

export function auditMissionScoreIntensitySuitabilityDecoupling(): MissionScoreDecouplingAudit {
  return MISSION_SCORE_DECOUPLING_AUDIT;
}

export function validateMissionContract(contract: MissionContract): MissionValidationResult {
  const issues: MissionValidationIssue[] = [];
  if (!isNonEmptyString(contract.contractId)) {
    issues.push(issue("mission_contract_id_required", "contractId", "Mission contract id is required."));
  }
  if (!isNonEmptyString(contract.worldId)) {
    issues.push(issue("mission_world_id_required", "worldId", "Mission world id is required."));
  }
  if (!MISSION_STATUSES.includes(contract.status)) {
    issues.push(issue("mission_invalid_status", "status", "Mission status is not part of the mission state machine."));
  }
  if (!contract.rootPressureIds.some(isNonEmptyString)) {
    issues.push(issue("mission_root_pressure_required", "rootPressureIds", "Formal missions must cite at least one root pressure."));
  }
  if (contract.objectivePredicates.length === 0) {
    issues.push(issue("mission_objective_required", "objectivePredicates", "Mission must contain observable objective predicates."));
  }
  contract.objectivePredicates.forEach((objective, index) => {
    if (!isNonEmptyString(objective.objectiveId)) {
      issues.push(issue("mission_objective_id_required", `objectivePredicates.${index}.objectiveId`, "Objective id is required."));
    }
    if (!objective.targetRef.entityType || !objective.targetRef.entityId) {
      issues.push(issue("mission_objective_target_required", `objectivePredicates.${index}.targetRef`, "Objective target ref is required."));
    }
    if (!Number.isFinite(objective.weight) || objective.weight <= 0) {
      issues.push(issue("mission_value_out_of_range", `objectivePredicates.${index}.weight`, "Objective weight must be positive."));
    }
  });
  if (contract.rewardProposals.length > 0 && !isNonEmptyString(contract.rewardFundingRef)) {
    issues.push(issue("mission_reward_source_required", "rewardFundingRef", "Rewards must have a funding source."));
  }
  if (
    contract.expiresAtWorldMinute !== undefined
    && contract.expiresAtWorldMinute <= contract.offeredAtWorldMinute
  ) {
    issues.push(issue("mission_expiry_before_offer", "expiresAtWorldMinute", "Mission expiry must be after offer time."));
  }
  if (
    contract.acceptedAtWorldMinute !== undefined
    && contract.acceptedAtWorldMinute < contract.offeredAtWorldMinute
  ) {
    issues.push(issue("mission_accepted_before_offer", "acceptedAtWorldMinute", "Mission acceptance cannot precede offer time."));
  }
  if (
    contract.activeAtWorldMinute !== undefined
    && contract.acceptedAtWorldMinute !== undefined
    && contract.activeAtWorldMinute < contract.acceptedAtWorldMinute
  ) {
    issues.push(issue("mission_active_before_acceptance", "activeAtWorldMinute", "Mission activation cannot precede acceptance."));
  }
  for (const [key, value] of Object.entries(contract.risk)) {
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      issues.push(issue("mission_value_out_of_range", `risk.${key}`, "Risk values must be normalized to 0..100."));
    }
  }
  return { ok: issues.length === 0, issues };
}

export function validateMissionTransition(
  fromStatus: MissionStatus,
  toStatus: MissionStatus,
  reasonCode = "mission_status_changed",
): MissionStateTransitionDecision {
  const issues: MissionValidationIssue[] = [];
  if (!MISSION_STATUSES.includes(fromStatus) || !MISSION_STATUSES.includes(toStatus)) {
    issues.push(issue("mission_invalid_status", "status", "Mission transition contains an unknown status."));
  } else if (MISSION_TERMINAL_STATUSES.has(fromStatus)) {
    issues.push(issue("mission_terminal_transition", "fromStatus", "Terminal mission statuses cannot transition."));
  } else if (!VALID_TRANSITIONS[fromStatus].includes(toStatus)) {
    issues.push(issue("mission_invalid_transition", "toStatus", `Cannot transition mission from ${fromStatus} to ${toStatus}.`));
  }
  return {
    allowed: issues.length === 0,
    fromStatus,
    toStatus,
    reasonCode,
    issues,
  };
}

export function nextMissionStatusForOutcome(outcome: MissionOutcome): MissionStatus {
  if (outcome === "clean_success" || outcome === "costly_success" || outcome === "partial_success") return "resolved";
  if (outcome === "withdrawal") return "abandoned";
  if (outcome === "timeout") return "expired";
  return "failed";
}

export function missionObjectiveCompletionBps(
  objectives: readonly MissionObjective[],
  results: readonly MissionObjectiveResult[],
): number {
  if (objectives.length === 0) return 0;
  const resultById = new Map(results.map((result) => [result.objectiveId, result]));
  let totalWeight = 0;
  let completedWeight = 0;
  for (const objective of objectives) {
    const weight = Math.max(1, objective.weight);
    const result = resultById.get(objective.objectiveId);
    const completedBps = clampBps(result?.completedBps ?? 0);
    totalWeight += weight;
    completedWeight += weight * completedBps;
  }
  return totalWeight > 0 ? clampBps(completedWeight / totalWeight) : 0;
}

export function calculateMissionIntensity(input: MissionIntensityInput): MissionIntensityBreakdown {
  const enemyHostilePower = clampPercent(input.enemyHostilePower);
  const enemyCoordination = clampPercent(input.enemyCoordination ?? 50);
  const opposition = clampPercent(enemyHostilePower * 0.8 + enemyCoordination * 0.2);
  const environmentalHazard = clampPercent(input.environmentalHazard);
  const objectiveComplexity = clampPercent(input.objectiveComplexity);
  const informationUncertainty = clampPercent(input.informationUncertainty ?? 0);
  const logisticalBurden = clampPercent(input.logisticalBurden ?? 0);
  const legalPoliticalRisk = clampPercent(input.legalPoliticalRisk ?? 0);
  const irreversibility = clampPercent(input.irreversibility ?? 0);
  const resourcePressure = clampPercent(input.resourcePressure);
  const worldPressure = clampPercent(input.worldPressure);
  const playerCombatPower = clamp(input.playerCombatPower, 0, 10_000);
  const playerCombatRatio = clamp(safeRatio(playerCombatPower, Math.max(1, enemyHostilePower)), 0, 10);
  const readinessGap = clampPercent(playerCombatRatio >= 1 ? 0 : (1 - playerCombatRatio) * 100);

  const worldIntensity = clampPercent(
    opposition * INTENSITY_WEIGHTS.opposition
      + environmentalHazard * INTENSITY_WEIGHTS.environmentalHazard
      + objectiveComplexity * INTENSITY_WEIGHTS.objectiveComplexity
      + informationUncertainty * INTENSITY_WEIGHTS.informationUncertainty
      + logisticalBurden * INTENSITY_WEIGHTS.logisticalBurden
      + legalPoliticalRisk * INTENSITY_WEIGHTS.legalPoliticalRisk
      + irreversibility * INTENSITY_WEIGHTS.irreversibility,
  );
  const encounterIntensity = clampPercent(
    worldIntensity * 0.58
      + resourcePressure * 0.14
      + worldPressure * 0.16
      + readinessGap * 0.12,
  );
  const threatBudget: MissionThreatBudget = {
    total: encounterIntensity,
    opposition,
    environment: environmentalHazard,
    objectives: objectiveComplexity,
    resources: resourcePressure,
    worldPressure,
    readinessGap,
  };
  const band = intensityBand(encounterIntensity);
  const recommendedBand = intensityBand(clampPercent(worldIntensity * 0.7 + worldPressure * 0.3));
  return {
    ...threatBudget,
    worldIntensity,
    encounterIntensity,
    band,
    recommendedBand,
    playerCombatRatio,
    explanation: [
      `客观世界强度 ${worldIntensity}/100；对局显示强度 ${encounterIntensity}/100。`,
      `敌对战力/协同形成 opposition ${opposition}/100，玩家战斗力比 ${playerCombatRatio.toFixed(2)}。`,
      `资源压力 ${resourcePressure}/100，世界压力 ${worldPressure}/100，readiness gap ${readinessGap}/100。`,
    ],
  };
}

export function intensityBand(score: number): MissionIntensityBand {
  const value = clampPercent(score);
  if (value >= 80) return "extreme";
  if (value >= 60) return "high";
  if (value >= 35) return "medium";
  return "low";
}

export function scoreMission(input: MissionScoreInput): MissionScoreBreakdown {
  const objective = clampPercent(input.objectiveCompletionBps / 100);
  const pressureRelief = clampPercent(input.pressureReliefBps / 100);
  const sideEffectControl = clampPercent(input.sideEffectControlBps / 100);
  const causalImpact = clampPercent(pressureRelief * 0.7 + sideEffectControl * 0.3);
  const combatFit = clampPercent(input.combatPowerFitBps ?? 5_000);
  const execution = clampPercent((input.executionQualityBps / 100) * 0.85 + combatFit * 0.15);
  const meaningfulRisk = clampPercent(input.meaningfulRiskBps / 100);
  const riskExposure = clampPercent(input.riskExposureBps / 100);
  const risk = clampPercent(meaningfulRisk * 0.7 + Math.min(riskExposure, meaningfulRisk + 20) * 0.3);
  const efficiency = clampPercent(input.resourceEfficiencyBps / 100);
  const survival = clampPercent(input.survivalBps / 100);
  const integrity = clampPercent((input.integrityBps ?? 10_000) / 100);
  const overwhelmingPenalty = clampPercent((input.overwhelmingForceBps ?? 0) / 100) * 0.08;
  const rawScore = clampPercent(
    objective * SCORE_WEIGHTS.objective
      + causalImpact * SCORE_WEIGHTS.causalImpact
      + execution * SCORE_WEIGHTS.execution
      + risk * SCORE_WEIGHTS.risk
      + integrity * SCORE_WEIGHTS.integrity
      + efficiency * SCORE_WEIGHTS.efficiency
      + survival * SCORE_WEIGHTS.survival
      - overwhelmingPenalty,
  );
  const antiFarmDecay = clampPercent(
    (input.recentSimilarCompletionCount ?? 0) * 7
      + (input.repeatedResolutionFamilyCount ?? 0) * 5,
  );
  const finalScore = clampPercent(rawScore * (1 - Math.min(35, antiFarmDecay) / 100));
  const weightedPositiveContribution = [
    objective * SCORE_WEIGHTS.objective,
    causalImpact * SCORE_WEIGHTS.causalImpact,
    execution * SCORE_WEIGHTS.execution,
    risk * SCORE_WEIGHTS.risk,
    integrity * SCORE_WEIGHTS.integrity,
    efficiency * SCORE_WEIGHTS.efficiency,
    survival * SCORE_WEIGHTS.survival,
  ].reduce((sum, contribution) => sum + contribution, 0);
  const dimensions: readonly MissionScoreDimensionDetail[] = [
    scoreDimension(
      "objective",
      { objectiveCompletionBps: clampBps(input.objectiveCompletionBps) },
      objective,
      "mission_score_objective_completion",
    ),
    scoreDimension(
      "causalImpact",
      {
        pressureReliefBps: clampBps(input.pressureReliefBps),
        sideEffectControlBps: clampBps(input.sideEffectControlBps),
      },
      causalImpact,
      "mission_score_causal_impact",
    ),
    scoreDimension(
      "execution",
      {
        executionQualityBps: clampBps(input.executionQualityBps),
        combatPowerFitBps: clampBps(input.combatPowerFitBps ?? 5_000),
      },
      execution,
      "mission_score_execution_quality_and_fit",
    ),
    scoreDimension(
      "risk",
      {
        meaningfulRiskBps: clampBps(input.meaningfulRiskBps),
        riskExposureBps: clampBps(input.riskExposureBps),
      },
      risk,
      "mission_score_meaningful_risk",
    ),
    scoreDimension(
      "integrity",
      { integrityBps: clampBps(input.integrityBps ?? 10_000) },
      integrity,
      "mission_score_integrity",
    ),
    scoreDimension(
      "efficiency",
      { resourceEfficiencyBps: clampBps(input.resourceEfficiencyBps) },
      efficiency,
      "mission_score_resource_efficiency",
    ),
    scoreDimension(
      "survival",
      { survivalBps: clampBps(input.survivalBps) },
      survival,
      "mission_score_survival",
    ),
    {
      dimensionId: "antiFarmDecay",
      inputs: {
        recentSimilarCompletionCount: Math.max(0, Math.trunc(input.recentSimilarCompletionCount ?? 0)),
        repeatedResolutionFamilyCount: Math.max(0, Math.trunc(input.repeatedResolutionFamilyCount ?? 0)),
        overwhelmingForceBps: clampBps(input.overwhelmingForceBps ?? 0),
        cappedDecayPercent: Math.min(35, antiFarmDecay),
      },
      weightBps: 0,
      score: antiFarmDecay,
      contribution: finalScore - weightedPositiveContribution,
      reasonCode: "mission_score_anti_farm_and_overwhelming_force_decay",
    },
  ];
  return {
    objective,
    causalImpact,
    execution,
    risk,
    efficiency,
    survival,
    integrity,
    antiFarmDecay,
    rawScore,
    finalScore,
    grade: scoreGrade(finalScore),
    dimensions,
    decouplingAudit: auditMissionScoreIntensitySuitabilityDecoupling(),
    explanation: [
      `目标 ${objective}/100，因果影响 ${causalImpact}/100，执行 ${execution}/100。`,
      `风险 ${risk}/100，效率 ${efficiency}/100，存活 ${survival}/100，完整性 ${integrity}/100。`,
      `战斗力只进入执行适配，直接评分权重为 0；反刷衰减 ${Math.min(35, antiFarmDecay)}%。`,
    ],
  };
}

export function scoreGrade(score: number): MissionScoreGrade {
  const value = clampPercent(score);
  if (value >= 95) return "SS";
  if (value >= 85) return "S";
  if (value >= 70) return "A";
  if (value >= 55) return "B";
  if (value >= 40) return "C";
  return "D";
}

export function proposeMissionConsequences(input: MissionConsequenceInput): MissionConsequenceProposal {
  const completionBps = missionObjectiveCompletionBps(input.contract.objectivePredicates, input.objectiveResults);
  const nextStatus = nextMissionStatusForOutcome(input.outcome);
  const stateTransition = validateMissionTransition(input.contract.status, nextStatus, `mission_${input.outcome}`);
  const outcomeWeight = outcomeConsequenceWeight(input.outcome, completionBps);
  const sourceEventIds = input.sourceEventIds;
  const authorizationRefs = input.authorizationRefs ?? input.contract.authorizationRefs;
  const resourceConsequences = [
    ...(input.resourceCosts ?? []),
    ...rewardResourceConsequences(input, outcomeWeight),
  ];
  const reputationConsequences = reputationConsequencesForOutcome(input, outcomeWeight);
  const injuryConsequences = injuryConsequencesForOutcome(input, outcomeWeight);
  const stressConsequences = stressConsequencesForOutcome(input, outcomeWeight);
  const knowledgeConsequences = [
    ...(input.discoveredKnowledge ?? []),
    ...defaultKnowledgeConsequences(input, completionBps),
  ];
  const pressureConsequences = pressureConsequencesForOutcome(input, completionBps);
  const causalEffects = [
    stateTransitionEffect(input.contract, stateTransition, sourceEventIds, authorizationRefs),
    ...resourceConsequences.map((consequence, index) =>
      resourceConsequenceEffect(input.contract, consequence, index, sourceEventIds, authorizationRefs)),
    ...reputationConsequences.map((consequence, index) =>
      numericDeltaEffect(input.contract, "relationship_delta", "reputation", consequence, index, sourceEventIds, authorizationRefs)),
    ...injuryConsequences.map((consequence, index) =>
      injuryEffect(input.contract, consequence, index, sourceEventIds, authorizationRefs)),
    ...stressConsequences.map((consequence, index) =>
      numericDeltaEffect(input.contract, "pressure_delta", "stress", consequence, index, sourceEventIds, authorizationRefs)),
    ...knowledgeConsequences.map((consequence, index) =>
      knowledgeEffect(input.contract, consequence, index, sourceEventIds, authorizationRefs)),
    ...pressureConsequences.map((consequence, index) =>
      numericDeltaEffect(input.contract, "pressure_delta", "root_pressure", consequence, index, sourceEventIds, authorizationRefs)),
  ];
  return {
    rulesetVersion: MISSION_CONSEQUENCE_RULES_VERSION,
    outcome: input.outcome,
    objectiveCompletionBps: completionBps,
    persistentConsequence: causalEffects.length > 0,
    resourceConsequences,
    reputationConsequences,
    injuryConsequences,
    stressConsequences,
    knowledgeConsequences,
    pressureConsequences,
    stateTransition,
    causalEffects,
    explanation: [
      `结局 ${input.outcome} 将任务推进到 ${nextStatus}。`,
      `目标完成度 ${Math.round(completionBps / 100)}%，即使失败/撤退/超时也保留资源、压力、知识或伤势后果。`,
      `生成 ${causalEffects.length} 个可映射 CausalEffectV1 proposal。`,
    ],
  };
}

export function validateMissionConsequenceInput(input: MissionConsequenceInput): MissionValidationResult {
  const contractValidation = validateMissionContract(input.contract);
  const issues = [...contractValidation.issues];
  if (!input.sourceEventIds.some(isNonEmptyString)) {
    issues.push(issue("mission_effect_source_required", "sourceEventIds", "Consequence effects must cite at least one source event."));
  }
  for (const [index, result] of input.objectiveResults.entries()) {
    if (!Number.isFinite(result.completedBps) || result.completedBps < 0 || result.completedBps > 10_000) {
      issues.push(issue("mission_value_out_of_range", `objectiveResults.${index}.completedBps`, "Objective completion must be 0..10000 bps."));
    }
  }
  return { ok: issues.length === 0, issues };
}

function outcomeConsequenceWeight(outcome: MissionOutcome, completionBps: number): number {
  const completion = completionBps / 10_000;
  switch (outcome) {
    case "clean_success":
      return 1;
    case "costly_success":
      return 0.85;
    case "partial_success":
      return clamp(0.35 + completion * 0.45, 0.35, 0.8);
    case "stalemate":
      return 0.25;
    case "withdrawal":
      return 0.18;
    case "timeout":
      return 0.12;
    case "catastrophe":
      return -1;
    case "failure":
    default:
      return -0.55;
  }
}

function rewardResourceConsequences(
  input: MissionConsequenceInput,
  outcomeWeight: number,
): readonly MissionResourceConsequence[] {
  if (outcomeWeight <= 0) return [];
  const payoutRatio = input.outcome === "partial_success" ? 0.5 : input.outcome === "costly_success" ? 0.8 : 1;
  return input.contract.rewardProposals.map((reward) => {
    const quantity = signedMinor(reward.quantityMinor);
    return {
      resourceKey: reward.resourceKey,
      resourceClass: reward.resourceClass,
      unit: reward.unit,
      accountRef: reward.recipientAccountRef,
      deltaMinor: asMinor(quantity * payoutRatio),
      sourceOrSinkRef: reward.fundingRef,
      reasonCode: `mission_${input.outcome}_reward`,
    };
  }).filter((consequence) => signedMinor(consequence.deltaMinor) !== 0);
}

function reputationConsequencesForOutcome(
  input: MissionConsequenceInput,
  outcomeWeight: number,
): readonly MissionNumericDelta[] {
  const sponsorDelta = Math.round(outcomeWeight * 10);
  const publicDelta = Math.round(outcomeWeight * 6);
  const refs = [
    ...(input.contract.sponsorRef ? [input.contract.sponsorRef] : []),
    ...input.contract.beneficiaryRefs,
  ];
  return refs.map((targetRef, index) => ({
    targetRef,
    delta: index === 0 ? sponsorDelta : publicDelta,
    reasonCode: `mission_${input.outcome}_reputation`,
  })).filter((consequence) => consequence.delta !== 0);
}

function injuryConsequencesForOutcome(
  input: MissionConsequenceInput,
  outcomeWeight: number,
): readonly MissionInjuryConsequence[] {
  const baseSeverity = outcomeWeight >= 1
    ? 0
    : input.outcome === "withdrawal"
      ? 8
      : input.outcome === "timeout"
        ? 5
        : input.outcome === "catastrophe"
          ? 70
          : input.outcome === "costly_success"
            ? 18
            : input.outcome === "partial_success"
              ? 14
              : 35;
  const severity = clampPercent(baseSeverity + (input.existingInjurySeverity ?? 0) * 0.2);
  if (severity <= 0) return [];
  return [{
    subjectRef: input.actorRef,
    severity,
    lasting: severity >= 40 || input.outcome === "catastrophe",
    reasonCode: `mission_${input.outcome}_injury`,
  }];
}

function stressConsequencesForOutcome(
  input: MissionConsequenceInput,
  outcomeWeight: number,
): readonly MissionNumericDelta[] {
  const base = outcomeWeight >= 1 ? -8 : Math.round(Math.abs(outcomeWeight) * 25) + 6;
  const existing = clampPercent(input.existingStress ?? 0);
  const delta = input.outcome === "clean_success"
    ? Math.max(-12, -Math.round(existing * 0.15))
    : base;
  if (delta === 0) return [];
  return [{
    targetRef: input.actorRef,
    delta,
    reasonCode: `mission_${input.outcome}_stress`,
  }];
}

function defaultKnowledgeConsequences(
  input: MissionConsequenceInput,
  completionBps: number,
): readonly MissionKnowledgeConsequence[] {
  if (completionBps <= 0 && input.outcome !== "failure" && input.outcome !== "catastrophe") return [];
  return input.contract.rootPressureIds.map((pressureId) => ({
    subjectRef: input.actorRef,
    knowledgeKey: `pressure:${pressureId}:mission_result:${input.contract.contractId}`,
    confidenceDelta: input.outcome === "catastrophe" ? 20 : input.outcome === "failure" ? 12 : 8,
    reasonCode: `mission_${input.outcome}_knowledge`,
  }));
}

function pressureConsequencesForOutcome(
  input: MissionConsequenceInput,
  completionBps: number,
): readonly MissionNumericDelta[] {
  const completion = completionBps / 10_000;
  const deltaByOutcome: Record<MissionOutcome, number> = {
    clean_success: -35,
    costly_success: -24,
    partial_success: -Math.round(10 + completion * 16),
    stalemate: -4,
    withdrawal: 6,
    failure: 15,
    catastrophe: 35,
    timeout: 12,
  };
  return input.contract.rootPressureIds.map((pressureId) => ({
    targetRef: `pressure:${pressureId}`,
    delta: deltaByOutcome[input.outcome],
    reasonCode: `mission_${input.outcome}_pressure`,
  }));
}

function stateTransitionEffect(
  contract: MissionContract,
  transition: MissionStateTransitionDecision,
  sourceEventIds: readonly string[],
  authorizationRefs: readonly string[],
): CausalEffectV1 {
  return {
    effectId: effectId(contract.contractId, "state", 0),
    effectType: "state_transition",
    targetRef: { entityType: "mission_contract", entityId: contract.contractId },
    operation: "transition",
    after: {
      stateMachineId: "mission_contract",
      fromState: transition.fromStatus,
      toState: transition.toStatus,
      transitionId: `${contract.contractId}:${transition.fromStatus}:${transition.toStatus}`,
      reasonCode: transition.reasonCode,
    },
    sourceEventIds,
    authorizationRefs,
  };
}

function resourceConsequenceEffect(
  contract: MissionContract,
  consequence: MissionResourceConsequence,
  index: number,
  sourceEventIds: readonly string[],
  authorizationRefs: readonly string[],
): CausalEffectV1 {
  const quantity = signedMinor(consequence.deltaMinor);
  return {
    effectId: effectId(contract.contractId, "resource", index),
    effectType: "resource_ledger",
    targetRef: entityRefFromString(consequence.accountRef, "account"),
    operation: quantity >= 0 ? "credit" : "debit",
    after: {
      resourceKey: consequence.resourceKey,
      resourceClass: consequence.resourceClass,
      unit: consequence.unit,
      entries: [{
        accountRef: consequence.accountRef,
        quantityMinor: consequence.deltaMinor,
      }],
      ...(quantity >= 0
        ? { creationSourceRef: consequence.sourceOrSinkRef }
        : { destructionSinkRef: consequence.sourceOrSinkRef }),
    },
    sourceEventIds,
    authorizationRefs,
  };
}

function numericDeltaEffect(
  contract: MissionContract,
  effectType: "relationship_delta" | "pressure_delta",
  domain: string,
  consequence: MissionNumericDelta,
  index: number,
  sourceEventIds: readonly string[],
  authorizationRefs: readonly string[],
): CausalEffectV1 {
  return {
    effectId: effectId(contract.contractId, `${domain}_${effectType}`, index),
    effectType,
    targetRef: entityRefFromString(consequence.targetRef, domain),
    operation: "delta",
    after: {
      domain,
      delta: consequence.delta,
      reasonCode: consequence.reasonCode,
      contractId: contract.contractId,
    },
    sourceEventIds,
    authorizationRefs,
  };
}

function injuryEffect(
  contract: MissionContract,
  consequence: MissionInjuryConsequence,
  index: number,
  sourceEventIds: readonly string[],
  authorizationRefs: readonly string[],
): CausalEffectV1 {
  return {
    effectId: effectId(contract.contractId, "injury", index),
    effectType: "state_transition",
    targetRef: entityRefFromString(consequence.subjectRef, "identity"),
    operation: "mission_injury",
    after: {
      stateMachineId: "identity_health",
      fromState: "unknown",
      toState: consequence.lasting ? "lasting_injury" : "injured",
      transitionId: `${contract.contractId}:injury:${index}`,
      reasonCode: consequence.reasonCode,
    },
    sourceEventIds,
    authorizationRefs,
  };
}

function knowledgeEffect(
  contract: MissionContract,
  consequence: MissionKnowledgeConsequence,
  index: number,
  sourceEventIds: readonly string[],
  authorizationRefs: readonly string[],
): CausalEffectV1 {
  return {
    effectId: effectId(contract.contractId, "knowledge", index),
    effectType: "knowledge_delta",
    targetRef: entityRefFromString(consequence.subjectRef, "identity"),
    operation: "confidence_delta",
    after: {
      knowledgeKey: consequence.knowledgeKey,
      confidenceDelta: clampInteger(consequence.confidenceDelta, -99, 99),
      reasonCode: consequence.reasonCode,
      contractId: contract.contractId,
    },
    sourceEventIds,
    authorizationRefs,
  };
}
