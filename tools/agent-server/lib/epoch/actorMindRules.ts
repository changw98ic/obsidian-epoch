import { assertNonEmptyString, stableKey } from "./protocol.ts";

export type ActorMindNeedTier =
  | "survival"
  | "safety"
  | "belonging"
  | "dignity"
  | "achievement"
  | "transcendence";

export type ActorMindCommitmentKind =
  | "contract"
  | "debt"
  | "care"
  | "organization_duty"
  | "order"
  | "vow"
  | "apprenticeship"
  | "legal_obligation"
  | "player_promise"
  | "lineage_commitment";

export type ActorMindRiskPosture = "cautious" | "normal" | "bold" | "reckless";

export interface NeedState {
  readonly needRef: string;
  readonly tier: ActorMindNeedTier;
  readonly label: string;
  readonly current: number;
  readonly target: number;
  readonly urgency: number;
  readonly beliefRefs: readonly string[];
}

export interface ValueWeight {
  readonly valueRef: string;
  readonly label: string;
  readonly weight: number;
}

export interface RoleObligation {
  readonly roleRef: string;
  readonly dutyRef: string;
  readonly beneficiaryRef: string;
  readonly weight: number;
  readonly dueAtWorldMinute?: number;
  readonly beliefRefs: readonly string[];
}

export interface RelationshipDuty {
  readonly relationshipRef: string;
  readonly targetActorRef: string;
  readonly dutyRef: string;
  readonly weight: number;
  readonly beliefRefs: readonly string[];
}

export interface CommitmentRef {
  readonly commitmentRef: string;
  readonly kind: ActorMindCommitmentKind;
  readonly beneficiaryRef: string;
  readonly contentRef: string;
  readonly dueAtWorldMinute?: number;
  readonly cost: number;
  readonly breachConditionRef: string;
  readonly transferable: boolean;
  readonly evidenceRefs: readonly string[];
  readonly weight: number;
  readonly status: "active" | "fulfilled" | "breached" | "released" | "disputed";
  readonly beliefRefs: readonly string[];
}

export interface ConstraintRef {
  readonly constraintRef: string;
  readonly kind: "resource" | "legal" | "capability" | "time" | "consent" | "location";
  readonly weight: number;
  readonly beliefRefs: readonly string[];
}

export interface GoalRef {
  readonly goalRef: string;
  readonly label: string;
  readonly score: number;
  readonly scoreBreakdown: GoalScoreBreakdown;
  readonly supportingBeliefRefs: readonly string[];
  readonly conflictingCommitmentRefs: readonly string[];
}

export interface ActorMind {
  readonly actorRef: string;
  readonly needs: readonly NeedState[];
  readonly values: readonly ValueWeight[];
  readonly roles: readonly RoleObligation[];
  readonly beliefs: readonly string[];
  readonly relationships: readonly RelationshipDuty[];
  readonly commitments: readonly CommitmentRef[];
  readonly activeGoals: readonly GoalRef[];
  readonly queuedGoals: readonly GoalRef[];
  readonly constraints: readonly ConstraintRef[];
  readonly riskTolerance: number;
  readonly planningHorizonWorldMinutes: number;
  readonly simulationLod: 0 | 1 | 2 | 3;
}

export interface GoalScoreWeights {
  readonly needRelief: number;
  readonly valueFit: number;
  readonly roleDuty: number;
  readonly relationshipDuty: number;
  readonly expectedGain: number;
  readonly identityFit: number;
  readonly urgency: number;
  readonly feasibility: number;
  readonly expectedRiskPenalty: number;
  readonly resourceCostPenalty: number;
  readonly legalCostPenalty: number;
  readonly commitmentConflictPenalty: number;
}

export interface ActorMindConfig {
  readonly activeGoalSlots: number;
  readonly queuedGoalSlots: number;
  readonly maximumFallbackPlansPerGoal: number;
  readonly goalAdoptionThreshold: number;
  readonly goalReplacementMargin: number;
  readonly minimumCommitmentWeightToBlockGoal: number;
  readonly goalScoreWeights: GoalScoreWeights;
  readonly riskToleranceDefaults: Readonly<Record<ActorMindRiskPosture, number>>;
  readonly needCriticalThreshold: number;
  readonly needRecoveryThreshold: number;
}

export interface GoalCandidate {
  readonly goalRef: string;
  readonly label: string;
  readonly needRefs: readonly string[];
  readonly valueRefs: readonly string[];
  readonly roleDutyRefs: readonly string[];
  readonly relationshipDutyRefs: readonly string[];
  readonly commitmentRefs: readonly string[];
  readonly beliefRefs: readonly string[];
  readonly expectedGain: number;
  readonly identityFit: number;
  readonly urgency: number;
  readonly feasibility: number;
  readonly expectedRisk: number;
  readonly resourceCost: number;
  readonly legalCost: number;
}

export interface GoalScoreBreakdown {
  readonly needRelief: number;
  readonly valueFit: number;
  readonly roleDuty: number;
  readonly relationshipDuty: number;
  readonly expectedGain: number;
  readonly identityFit: number;
  readonly urgency: number;
  readonly feasibility: number;
  readonly expectedRiskPenalty: number;
  readonly resourceCostPenalty: number;
  readonly legalCostPenalty: number;
  readonly commitmentConflictPenalty: number;
  readonly total: number;
}

export interface ScoredGoalCandidate extends GoalRef {
  readonly candidate: GoalCandidate;
  readonly blockedByCommitmentRefs: readonly string[];
  readonly adopted: boolean;
}

export interface ActorGoalSelectionResult {
  readonly activeGoals: readonly GoalRef[];
  readonly queuedGoals: readonly GoalRef[];
  readonly rejectedGoals: readonly ScoredGoalCandidate[];
  readonly scoredCandidates: readonly ScoredGoalCandidate[];
}

export interface EffectIntent {
  readonly effectRef: string;
  readonly effectType: string;
  readonly targetRefs: readonly string[];
  readonly basisBeliefRefs: readonly string[];
  readonly expectedValue?: unknown;
}

export interface ReservationRequest {
  readonly resourceRef: string;
  readonly quantity: number;
  readonly basisBeliefRefs: readonly string[];
}

export interface CapabilityRequirement {
  readonly capabilityRef: string;
  readonly minimumLevel: number;
  readonly basisBeliefRefs: readonly string[];
}

export interface ActorPlanRef {
  readonly planRef: string;
  readonly goalRef: string;
  readonly beliefRefs: readonly string[];
}

export interface ActionProposal {
  readonly proposalId: string;
  readonly actorRef: string;
  readonly goalRef: string;
  readonly beliefRefs: readonly string[];
  readonly intendedEffects: readonly EffectIntent[];
  readonly requiredResources: readonly ReservationRequest[];
  readonly requiredTimeWorldMinutes: number;
  readonly requiredCapabilities: readonly CapabilityRequirement[];
  readonly targetRefs: readonly string[];
  readonly legalBasisRefs: readonly string[];
  readonly consentRefs: readonly string[];
  readonly fallbackPlanRefs: readonly string[];
  readonly expiresAtWorldMinute: number;
}

export interface ActionProposalInput {
  readonly proposalRef?: string;
  readonly actorMind: Pick<ActorMind, "actorRef" | "beliefs" | "planningHorizonWorldMinutes">;
  readonly goal: Pick<GoalRef, "goalRef" | "supportingBeliefRefs">;
  readonly beliefRefs: readonly string[];
  readonly intendedEffects: readonly EffectIntent[];
  readonly requiredResources?: readonly ReservationRequest[];
  readonly requiredTimeWorldMinutes: number;
  readonly requiredCapabilities?: readonly CapabilityRequirement[];
  readonly targetRefs?: readonly string[];
  readonly legalBasisRefs?: readonly string[];
  readonly consentRefs?: readonly string[];
  readonly fallbackPlans?: readonly ActorPlanRef[];
  readonly submittedAtWorldMinute: number;
  readonly config?: Partial<Pick<ActorMindConfig, "maximumFallbackPlansPerGoal">>;
}

export const DEFAULT_ACTOR_MIND_CONFIG: ActorMindConfig = {
  activeGoalSlots: 3,
  queuedGoalSlots: 5,
  maximumFallbackPlansPerGoal: 2,
  goalAdoptionThreshold: 52,
  goalReplacementMargin: 12,
  minimumCommitmentWeightToBlockGoal: 65,
  goalScoreWeights: {
    needRelief: 0.2,
    valueFit: 0.12,
    roleDuty: 0.1,
    relationshipDuty: 0.1,
    expectedGain: 0.08,
    identityFit: 0.08,
    urgency: 0.12,
    feasibility: 0.2,
    expectedRiskPenalty: 0.16,
    resourceCostPenalty: 0.1,
    legalCostPenalty: 0.08,
    commitmentConflictPenalty: 0.12,
  },
  riskToleranceDefaults: {
    cautious: 25,
    normal: 50,
    bold: 70,
    reckless: 90,
  },
  needCriticalThreshold: 80,
  needRecoveryThreshold: 35,
};

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(value, 100));
}

function positiveInteger(value: number | undefined, fallback: number): number {
  const next = Math.floor(Number(value));
  return Number.isFinite(next) && next > 0 ? next : fallback;
}

function uniqueStableStrings(values: readonly string[]): readonly string[] {
  return values
    .map((value) => value.trim())
    .filter((value, index, allValues) => value.length > 0 && allValues.indexOf(value) === index)
    .sort((left, right) => left.localeCompare(right));
}

function normalizeWeights(weights: Partial<GoalScoreWeights> | undefined): GoalScoreWeights {
  return {
    ...DEFAULT_ACTOR_MIND_CONFIG.goalScoreWeights,
    ...(weights || {}),
  };
}

export function actorMindConfig(input?: Partial<ActorMindConfig>): ActorMindConfig {
  return {
    activeGoalSlots: positiveInteger(input?.activeGoalSlots, DEFAULT_ACTOR_MIND_CONFIG.activeGoalSlots),
    queuedGoalSlots: positiveInteger(input?.queuedGoalSlots, DEFAULT_ACTOR_MIND_CONFIG.queuedGoalSlots),
    maximumFallbackPlansPerGoal: positiveInteger(
      input?.maximumFallbackPlansPerGoal,
      DEFAULT_ACTOR_MIND_CONFIG.maximumFallbackPlansPerGoal,
    ),
    goalAdoptionThreshold: clampScore(input?.goalAdoptionThreshold ?? DEFAULT_ACTOR_MIND_CONFIG.goalAdoptionThreshold),
    goalReplacementMargin: clampScore(input?.goalReplacementMargin ?? DEFAULT_ACTOR_MIND_CONFIG.goalReplacementMargin),
    minimumCommitmentWeightToBlockGoal: clampScore(
      input?.minimumCommitmentWeightToBlockGoal ?? DEFAULT_ACTOR_MIND_CONFIG.minimumCommitmentWeightToBlockGoal,
    ),
    goalScoreWeights: normalizeWeights(input?.goalScoreWeights),
    riskToleranceDefaults: {
      ...DEFAULT_ACTOR_MIND_CONFIG.riskToleranceDefaults,
      ...(input?.riskToleranceDefaults || {}),
    },
    needCriticalThreshold: clampScore(input?.needCriticalThreshold ?? DEFAULT_ACTOR_MIND_CONFIG.needCriticalThreshold),
    needRecoveryThreshold: clampScore(input?.needRecoveryThreshold ?? DEFAULT_ACTOR_MIND_CONFIG.needRecoveryThreshold),
  };
}

export function riskToleranceForPosture(
  posture: ActorMindRiskPosture | undefined,
  configInput?: Partial<ActorMindConfig>,
): number {
  const config = actorMindConfig(configInput);
  return clampScore(config.riskToleranceDefaults[posture || "normal"]);
}

function averageScore(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + clampScore(value), 0) / values.length;
}

function needReliefScore(needs: readonly NeedState[], candidate: GoalCandidate): number {
  const referencedNeeds = needs.filter((need) => candidate.needRefs.includes(need.needRef));
  return averageScore(referencedNeeds.map((need) => {
    const gap = Math.max(0, clampScore(need.target) - clampScore(need.current));
    return Math.max(gap, clampScore(need.urgency));
  }));
}

function valueFitScore(values: readonly ValueWeight[], candidate: GoalCandidate): number {
  return averageScore(values
    .filter((value) => candidate.valueRefs.includes(value.valueRef))
    .map((value) => value.weight));
}

function roleDutyScore(roles: readonly RoleObligation[], candidate: GoalCandidate): number {
  return averageScore(roles
    .filter((role) => candidate.roleDutyRefs.includes(role.dutyRef) || candidate.roleDutyRefs.includes(role.roleRef))
    .map((role) => role.weight));
}

function relationshipDutyScore(relationships: readonly RelationshipDuty[], candidate: GoalCandidate): number {
  return averageScore(relationships
    .filter((relationship) =>
      candidate.relationshipDutyRefs.includes(relationship.dutyRef)
      || candidate.relationshipDutyRefs.includes(relationship.relationshipRef))
    .map((relationship) => relationship.weight));
}

export function commitmentConflictRefs(
  commitments: readonly CommitmentRef[],
  candidate: GoalCandidate,
  configInput?: Partial<ActorMindConfig>,
): readonly string[] {
  const config = actorMindConfig(configInput);
  return commitments
    .filter((commitment) =>
      commitment.status === "active"
      && !candidate.commitmentRefs.includes(commitment.commitmentRef)
      && commitment.weight >= config.minimumCommitmentWeightToBlockGoal)
    .map((commitment) => commitment.commitmentRef)
    .sort((left, right) => left.localeCompare(right));
}

export function scoreActorGoalCandidate(
  actorMind: Pick<ActorMind, "needs" | "values" | "roles" | "relationships" | "commitments" | "riskTolerance" | "beliefs">,
  candidate: GoalCandidate,
  configInput?: Partial<ActorMindConfig>,
): ScoredGoalCandidate {
  const config = actorMindConfig(configInput);
  const weights = config.goalScoreWeights;
  const knownBeliefRefs = new Set(actorMind.beliefs);
  const supportingBeliefRefs = uniqueStableStrings(candidate.beliefRefs.filter((beliefRef) => knownBeliefRefs.has(beliefRef)));
  const conflictingCommitmentRefs = commitmentConflictRefs(actorMind.commitments, candidate, config);
  const commitmentConflict = averageScore(conflictingCommitmentRefs
    .map((commitmentRef) => actorMind.commitments.find((commitment) => commitment.commitmentRef === commitmentRef)?.weight || 0));
  const riskExcess = Math.max(0, clampScore(candidate.expectedRisk) - clampScore(actorMind.riskTolerance));

  const breakdown: GoalScoreBreakdown = {
    needRelief: needReliefScore(actorMind.needs, candidate) * weights.needRelief,
    valueFit: valueFitScore(actorMind.values, candidate) * weights.valueFit,
    roleDuty: roleDutyScore(actorMind.roles, candidate) * weights.roleDuty,
    relationshipDuty: relationshipDutyScore(actorMind.relationships, candidate) * weights.relationshipDuty,
    expectedGain: clampScore(candidate.expectedGain) * weights.expectedGain,
    identityFit: clampScore(candidate.identityFit) * weights.identityFit,
    urgency: clampScore(candidate.urgency) * weights.urgency,
    feasibility: clampScore(candidate.feasibility) * weights.feasibility,
    expectedRiskPenalty: riskExcess * weights.expectedRiskPenalty,
    resourceCostPenalty: clampScore(candidate.resourceCost) * weights.resourceCostPenalty,
    legalCostPenalty: clampScore(candidate.legalCost) * weights.legalCostPenalty,
    commitmentConflictPenalty: commitmentConflict * weights.commitmentConflictPenalty,
    total: 0,
  };
  const total = Math.max(0, (
    breakdown.needRelief
    + breakdown.valueFit
    + breakdown.roleDuty
    + breakdown.relationshipDuty
    + breakdown.expectedGain
    + breakdown.identityFit
    + breakdown.urgency
    + breakdown.feasibility
    - breakdown.expectedRiskPenalty
    - breakdown.resourceCostPenalty
    - breakdown.legalCostPenalty
    - breakdown.commitmentConflictPenalty
  ));
  const finalBreakdown = { ...breakdown, total };

  return {
    goalRef: assertNonEmptyString(candidate.goalRef, "goal_ref"),
    label: assertNonEmptyString(candidate.label, "goal_label"),
    score: total,
    scoreBreakdown: finalBreakdown,
    supportingBeliefRefs,
    conflictingCommitmentRefs,
    blockedByCommitmentRefs: conflictingCommitmentRefs,
    adopted: total >= config.goalAdoptionThreshold
      && supportingBeliefRefs.length > 0
      && conflictingCommitmentRefs.length === 0,
    candidate,
  };
}

function goalSort(left: Pick<GoalRef, "goalRef" | "score">, right: Pick<GoalRef, "goalRef" | "score">): number {
  return right.score - left.score || left.goalRef.localeCompare(right.goalRef);
}

export function selectActorGoals(
  actorMind: Pick<ActorMind, "needs" | "values" | "roles" | "relationships" | "commitments" | "riskTolerance" | "beliefs" | "activeGoals">,
  candidates: readonly GoalCandidate[],
  configInput?: Partial<ActorMindConfig>,
): ActorGoalSelectionResult {
  const config = actorMindConfig(configInput);
  const scoredCandidates = candidates
    .map((candidate) => scoreActorGoalCandidate(actorMind, candidate, config))
    .sort(goalSort);
  const adoptable = scoredCandidates.filter((candidate) => candidate.adopted);
  const existingActiveGoals = [...actorMind.activeGoals].sort(goalSort);
  const openActiveSlots = Math.max(0, config.activeGoalSlots - existingActiveGoals.length);
  const fillCandidates = adoptable.slice(0, openActiveSlots);
  const filledGoalRefs = new Set(fillCandidates.map((goal) => goal.goalRef));
  const replacementCandidates = adoptable
    .filter((candidate) => !filledGoalRefs.has(candidate.goalRef))
    .filter((candidate) => existingActiveGoals.some((activeGoal) =>
      candidate.score >= activeGoal.score + config.goalReplacementMargin));
  const activeGoals = [...existingActiveGoals, ...fillCandidates, ...replacementCandidates]
    .sort(goalSort)
    .slice(0, config.activeGoalSlots);
  const activeGoalRefs = new Set(activeGoals.map((goal) => goal.goalRef));
  const queuedGoals = adoptable
    .filter((candidate) => !activeGoalRefs.has(candidate.goalRef))
    .filter((candidate) => !activeGoals.some((goal) => goal.goalRef === candidate.goalRef))
    .slice(0, config.queuedGoalSlots);
  const rejectedGoals = scoredCandidates.filter((candidate) =>
    !activeGoals.some((goal) => goal.goalRef === candidate.goalRef)
    && !queuedGoals.some((goal) => goal.goalRef === candidate.goalRef));

  return {
    activeGoals,
    queuedGoals,
    rejectedGoals,
    scoredCandidates,
  };
}

function allBasisBeliefsForProposal(input: ActionProposalInput): readonly string[] {
  return uniqueStableStrings([
    ...input.goal.supportingBeliefRefs,
    ...input.beliefRefs,
    ...input.intendedEffects.flatMap((effect) => effect.basisBeliefRefs),
    ...(input.requiredResources || []).flatMap((resource) => resource.basisBeliefRefs),
    ...(input.requiredCapabilities || []).flatMap((capability) => capability.basisBeliefRefs),
    ...(input.fallbackPlans || []).flatMap((plan) => plan.beliefRefs),
  ]);
}

function assertKnownBeliefs(actorMind: Pick<ActorMind, "beliefs">, beliefRefs: readonly string[]): void {
  const knownBeliefRefs = new Set(actorMind.beliefs);
  for (const beliefRef of beliefRefs) {
    if (!knownBeliefRefs.has(beliefRef)) throw new Error("action_proposal_unknown_belief_ref");
  }
}

export function actionProposal(input: ActionProposalInput): ActionProposal {
  const config = actorMindConfig(input.config);
  const beliefRefs = allBasisBeliefsForProposal(input);
  if (beliefRefs.length === 0) throw new Error("action_proposal_belief_refs_required");
  assertKnownBeliefs(input.actorMind, beliefRefs);

  const fallbackPlanRefs = uniqueStableStrings((input.fallbackPlans || [])
    .filter((plan) => plan.goalRef === input.goal.goalRef)
    .slice(0, config.maximumFallbackPlansPerGoal)
    .map((plan) => plan.planRef));
  const requiredTimeWorldMinutes = Math.max(1, Math.floor(Number(input.requiredTimeWorldMinutes)));
  const proposalId = input.proposalRef
    ? assertNonEmptyString(input.proposalRef, "proposal_ref")
    : `action_proposal_${stableKey(`${input.actorMind.actorRef}:${input.goal.goalRef}:${beliefRefs.join(":")}`)}`;

  return {
    proposalId,
    actorRef: assertNonEmptyString(input.actorMind.actorRef, "actor_ref"),
    goalRef: assertNonEmptyString(input.goal.goalRef, "goal_ref"),
    beliefRefs,
    intendedEffects: input.intendedEffects,
    requiredResources: input.requiredResources || [],
    requiredTimeWorldMinutes,
    requiredCapabilities: input.requiredCapabilities || [],
    targetRefs: uniqueStableStrings(input.targetRefs || input.intendedEffects.flatMap((effect) => effect.targetRefs)),
    legalBasisRefs: uniqueStableStrings(input.legalBasisRefs || []),
    consentRefs: uniqueStableStrings(input.consentRefs || []),
    fallbackPlanRefs,
    expiresAtWorldMinute: input.submittedAtWorldMinute
      + Math.max(requiredTimeWorldMinutes, input.actorMind.planningHorizonWorldMinutes),
  };
}
