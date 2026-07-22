import { createHash } from "node:crypto";
import type { ActionProposal, ActorMind, CommitmentRef, GoalRef } from "./actorMindRules.ts";
import type {
  CausalEffectV1,
  CausalEntityRef,
  CausalWorldEventV1,
  KnowledgeDeltaEffectV1,
  PressureDeltaEffectV1,
  RelationshipDeltaEffectV1,
  StateTransitionEffectV1,
  WorldPredicateEffectV1,
} from "./causalContracts.ts";
import type { EpochKnowledgeCaller, EpochKnowledgeRecord } from "./knowledgeStateRules.ts";
import { canAccessKnowledgeRecord } from "./knowledgeStateRules.ts";
import type {
  EpochWorldPressure,
  EpochWorldPressureFactSignal,
  EpochWorldPressureOpportunitySeed,
  EpochWorldPressureType,
} from "./worldPressureRules.ts";
import { pressureMeetsEpochWorldOpportunityThreshold } from "./worldPressureRules.ts";

export const EPOCH_CAUSAL_NARRATIVE_RULE_VERSION = "causal-narrative.v1";

export type CausalNarrativeErrorCode =
  | "NARRATIVE_EVENT_SOURCE_REQUIRED"
  | "NARRATIVE_ROOT_PRESSURE_REQUIRED"
  | "NARRATIVE_KNOWLEDGE_NOT_VISIBLE"
  | "NARRATIVE_THREAD_TRANSITION_ILLEGAL"
  | "NARRATIVE_OPPORTUNITY_NOT_QUALIFIED"
  | "NARRATIVE_CASE_EVIDENCE_REQUIRED"
  | "NARRATIVE_CASE_HYPOTHESIS_REQUIRED"
  | "NARRATIVE_SETTLEMENT_SOURCE_REQUIRED";

export interface CausalNarrativeError {
  readonly code: CausalNarrativeErrorCode;
  readonly message: string;
  readonly path?: string;
  readonly ref?: string;
  readonly retryable: boolean;
}

export type NarrativeThreadState =
  | "proposed"
  | "active"
  | "escalating"
  | "resolving"
  | "resolved"
  | "failed"
  | "dormant"
  | "transformed";

export type NarrativeArcStage = "setup" | "complication" | "crisis" | "choice" | "fallout" | "legacy";
export type NarrativeTensionKind =
  | "survival"
  | "scarcity"
  | "duty_conflict"
  | "truth_gap"
  | "legal_accountability"
  | "relationship_strain"
  | "power_shift"
  | "supernatural_risk";

export interface NarrativeArc {
  readonly arcId: string;
  readonly stage: NarrativeArcStage;
  readonly openedAtWorldMinute: number;
  readonly dueAtWorldMinute: number;
  readonly rootPressureIds: readonly string[];
  readonly sourceEventIds: readonly string[];
  readonly objectivePredicateRefs: readonly string[];
  readonly possibleTransformRefs: readonly string[];
}

export interface NarrativeTension {
  readonly tensionId: string;
  readonly kind: NarrativeTensionKind;
  readonly score: number;
  readonly pressureIds: readonly string[];
  readonly actorGoalRefs: readonly string[];
  readonly knowledgeRefs: readonly string[];
  readonly sourceEventIds: readonly string[];
  readonly explanation: string;
}

export interface NarrativePromise {
  readonly promiseId: string;
  readonly promisorRef: string;
  readonly beneficiaryRef: string;
  readonly contentRef: string;
  readonly status: "open" | "kept" | "broken" | "released" | "disputed";
  readonly dueAtWorldMinute?: number;
  readonly evidenceRefs: readonly string[];
  readonly sourceEventIds: readonly string[];
}

export interface NarrativeDebt {
  readonly debtId: string;
  readonly debtorRef: string;
  readonly creditorRef: string;
  readonly debtKind: "resource" | "favor" | "legal" | "care" | "blood" | "reputation";
  readonly pressureRefs: readonly string[];
  readonly status: "owed" | "paid" | "defaulted" | "forgiven" | "disputed";
  readonly dueAtWorldMinute?: number;
  readonly evidenceRefs: readonly string[];
  readonly sourceEventIds: readonly string[];
}

export interface RelationshipBeat {
  readonly beatId: string;
  readonly relationshipRef: string;
  readonly actorRefs: readonly string[];
  readonly kind: "trust_gain" | "trust_loss" | "obligation" | "betrayal" | "reconciliation" | "boundary";
  readonly intensity: number;
  readonly knowledgeRefs: readonly string[];
  readonly promiseRefs: readonly string[];
  readonly debtRefs: readonly string[];
  readonly sourceEventIds: readonly string[];
  readonly occurredAtWorldMinute: number;
}

export interface NarrativeThread {
  readonly threadId: string;
  readonly state: NarrativeThreadState;
  readonly titleRef: string;
  readonly rootPressureIds: readonly string[];
  readonly originEventIds: readonly string[];
  readonly actorRefs: readonly string[];
  readonly regionRefs: readonly string[];
  readonly knownFactRefs: readonly string[];
  readonly secretRefs: readonly string[];
  readonly falseBeliefRefs: readonly string[];
  readonly conflictingGoalRefs: readonly string[];
  readonly promiseRefs: readonly string[];
  readonly debtRefs: readonly string[];
  readonly relationshipBeatRefs: readonly string[];
  readonly arcs: readonly NarrativeArc[];
  readonly tensions: readonly NarrativeTension[];
  readonly currentStage: NarrativeArcStage;
  readonly openedAtWorldMinute: number;
  readonly updatedAtWorldMinute: number;
  readonly reviewAtWorldMinute: number;
  readonly transformedFromThreadIds?: readonly string[];
  readonly transformedToThreadIds?: readonly string[];
  readonly resolvedAtWorldMinute?: number;
  readonly explanation: string;
}

export interface WorldPredicate {
  readonly predicateId: string;
  readonly subjectRef: CausalEntityRef;
  readonly operator: "eq" | "neq" | "gte" | "lte" | "contains" | "exists" | "state_is";
  readonly expectedValue: unknown;
  readonly evaluationStatus: "true" | "false" | "unknown";
  readonly evaluatedAtWorldMinute: number;
}

export interface OpportunityCost {
  readonly resourceRef: string;
  readonly quantityMinor: string;
  readonly reasonCode: string;
}

export interface OpportunityConsequence {
  readonly consequenceId: string;
  readonly trigger: "accepted" | "rejected" | "missed" | "failed" | "completed";
  readonly pressureSignalSeeds: readonly EpochWorldPressureFactSignal[];
  readonly knowledgeSeeds: readonly EpochKnowledgeRecordSeed[];
  readonly explanation: string;
}

export interface WorldOpportunity {
  readonly opportunityId: string;
  readonly rootPressureIds: readonly string[];
  readonly sponsorRef?: string;
  readonly beneficiaryRefs: readonly string[];
  readonly oppositionRefs: readonly string[];
  readonly competitorRefs: readonly string[];
  readonly interventionType: string;
  readonly eligibility: {
    readonly eligibleActorRefs: readonly string[];
    readonly requiredGoalRefs: readonly string[];
    readonly requiredKnowledgeRefs: readonly string[];
    readonly excludedByCommitmentRefs: readonly string[];
    readonly explanation: string;
  };
  readonly objectivePredicates: readonly WorldPredicate[];
  readonly availableEvidenceRefs: readonly string[];
  readonly hiddenInformationRefs: readonly string[];
  readonly capabilityRequirements: readonly string[];
  readonly resourceRequirements: readonly OpportunityCost[];
  readonly legalConstraints: readonly string[];
  readonly rewardFundingRef?: string;
  readonly worldIntensity: number;
  readonly risk: number;
  readonly cost: number;
  readonly openedAtWorldMinute: number;
  readonly expiresAtWorldMinute: number;
  readonly refusalConsequences: readonly OpportunityConsequence[];
  readonly missedConsequences: readonly OpportunityConsequence[];
  readonly explanation: string;
}

export interface CaseEvidenceNode {
  readonly evidenceRef: string;
  readonly sourceEventIds: readonly string[];
  readonly supportsHypothesisRefs: readonly string[];
  readonly refutesHypothesisRefs: readonly string[];
  readonly submittedAtWorldMinute: number;
  readonly visibleToRefs: readonly string[];
}

export interface CaseHypothesis {
  readonly hypothesisId: string;
  readonly claimRef: string;
  readonly status: "open" | "supported" | "weakened" | "refuted" | "accepted";
  readonly supportEvidenceRefs: readonly string[];
  readonly counterEvidenceRefs: readonly string[];
  readonly confidenceBps: number;
}

export interface OpenCase {
  readonly caseId: string;
  readonly status: "open" | "investigating" | "contested" | "verdict_issued" | "unresolved" | "appealed" | "closed";
  readonly jurisdictionRef: string;
  readonly subjectRefs: readonly string[];
  readonly rootPressureIds: readonly string[];
  readonly sourceEventIds: readonly string[];
  readonly evidenceGraph: readonly CaseEvidenceNode[];
  readonly hypotheses: readonly CaseHypothesis[];
  readonly refutationRefs: readonly string[];
  readonly verdict?: {
    readonly verdictRef: string;
    readonly hypothesisRef: string;
    readonly outcome: "sustained" | "dismissed" | "inconclusive" | "compensated" | "sanctioned";
    readonly issuedAtWorldMinute: number;
    readonly evidenceRefs: readonly string[];
  };
  readonly unresolvedReason?: "insufficient_evidence" | "conflicting_evidence" | "jurisdiction_gap" | "actor_unavailable";
  readonly openedAtWorldMinute: number;
  readonly updatedAtWorldMinute: number;
  readonly explanation: string;
}

export interface EpochKnowledgeRecordSeed {
  readonly id: string;
  readonly kind: "fact" | "observation" | "claim" | "belief" | "rumor" | "deception" | "refutation" | "memory";
  readonly subject?: string;
  readonly text: string;
  readonly confidence: number;
  readonly evidenceIds: readonly string[];
  readonly sourceEventIds: readonly string[];
  readonly visibilityRefs: readonly string[];
}

export interface PlayerBehaviorSignal {
  readonly signalId: string;
  readonly actorRef: string;
  readonly kind: "accepted" | "rejected" | "missed" | "completed" | "failed" | "investigated" | "helped" | "harmed";
  readonly targetRef: string;
  readonly occurredAtWorldMinute: number;
  readonly sourceEventIds: readonly string[];
  readonly evidenceRefs?: readonly string[];
}

export interface CausalNarrativeRecentContent {
  readonly contentKey: string;
  readonly actorRefs?: readonly string[];
  readonly regionRefs?: readonly string[];
  readonly usedAtWorldMinute: number;
}

export interface DeriveCausalNarrativeInput {
  readonly worldId: string;
  readonly worldMinute: number;
  readonly events: readonly CausalWorldEventV1[];
  readonly pressures: readonly EpochWorldPressure[];
  readonly actorMinds: readonly ActorMind[];
  readonly knowledgeRecords: readonly EpochKnowledgeRecord[];
  readonly existingThreads?: readonly NarrativeThread[];
  readonly existingPromises?: readonly NarrativePromise[];
  readonly existingDebts?: readonly NarrativeDebt[];
  readonly existingRelationshipBeats?: readonly RelationshipBeat[];
  readonly existingCases?: readonly OpenCase[];
  readonly playerBehavior?: readonly PlayerBehaviorSignal[];
  readonly caller?: EpochKnowledgeCaller;
  readonly visibleRegionIds?: readonly string[];
  readonly visibleActorRefs?: readonly string[];
  readonly recentContent?: readonly CausalNarrativeRecentContent[];
  readonly pacingBudget?: Partial<CausalNarrativePacingBudget>;
}

export interface CausalNarrativePacingBudget {
  readonly maxThreads: number;
  readonly maxOpportunities: number;
  readonly maxCases: number;
  readonly maxPromises: number;
  readonly maxDebts: number;
  readonly maxRelationshipBeats: number;
  readonly antiRepeatWindowWorldMinutes: number;
}

export interface DeriveCausalNarrativeResult {
  readonly threads: readonly NarrativeThread[];
  readonly opportunities: readonly WorldOpportunity[];
  readonly openCases: readonly OpenCase[];
  readonly promises: readonly NarrativePromise[];
  readonly debts: readonly NarrativeDebt[];
  readonly relationshipBeats: readonly RelationshipBeat[];
  readonly rejected: readonly CausalNarrativeError[];
}

export interface TransitionNarrativeThreadInput {
  readonly thread: NarrativeThread;
  readonly toState: NarrativeThreadState;
  readonly worldMinute: number;
  readonly sourceEventIds: readonly string[];
  readonly transformedToThreadIds?: readonly string[];
}

export interface SettleNarrativeCandidateInput {
  readonly worldId: string;
  readonly worldMinute: number;
  readonly candidate:
    | { readonly kind: "thread"; readonly value: NarrativeThread; readonly fromState?: NarrativeThreadState }
    | { readonly kind: "opportunity"; readonly value: WorldOpportunity; readonly trigger: OpportunityConsequence["trigger"] }
    | { readonly kind: "case"; readonly value: OpenCase }
    | { readonly kind: "promise"; readonly value: NarrativePromise }
    | { readonly kind: "debt"; readonly value: NarrativeDebt }
    | { readonly kind: "relationship"; readonly value: RelationshipBeat };
  readonly sourceEventIds: readonly string[];
  readonly authorizationRefs?: readonly string[];
}

export interface NarrativeSettlementProposal {
  readonly proposalId: string;
  readonly effects: readonly CausalEffectV1[];
  readonly pressureSeeds: readonly EpochWorldPressureFactSignal[];
  readonly knowledgeSeeds: readonly EpochKnowledgeRecordSeed[];
  readonly errors: readonly CausalNarrativeError[];
}

const DEFAULT_PACING_BUDGET: CausalNarrativePacingBudget = {
  maxThreads: 8,
  maxOpportunities: 8,
  maxCases: 5,
  maxPromises: 8,
  maxDebts: 8,
  maxRelationshipBeats: 12,
  antiRepeatWindowWorldMinutes: 10_080,
};

const THREAD_TRANSITIONS: Readonly<Record<NarrativeThreadState, readonly NarrativeThreadState[]>> = {
  proposed: ["active", "dormant", "failed"],
  active: ["escalating", "resolving", "resolved", "failed", "dormant", "transformed"],
  escalating: ["active", "resolving", "failed", "transformed"],
  resolving: ["active", "resolved", "failed", "dormant", "transformed"],
  resolved: [],
  failed: ["dormant", "transformed"],
  dormant: ["proposed", "active", "failed"],
  transformed: [],
};

const PRESSURE_TENSION_KIND: Readonly<Record<EpochWorldPressureType, NarrativeTensionKind>> = {
  survival: "survival",
  economic: "scarcity",
  social: "relationship_strain",
  political: "power_shift",
  legal: "legal_accountability",
  ecological: "survival",
  military: "power_shift",
  informational: "truth_gap",
  supernatural: "supernatural_risk",
};

function stableJson(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function stableHash(value: unknown): string {
  return createHash("sha256").update(stableJson(value), "utf8").digest("hex");
}

function deterministicId(prefix: string, value: unknown): string {
  return `${prefix}_${stableHash({ ruleVersion: EPOCH_CAUSAL_NARRATIVE_RULE_VERSION, value }).slice(0, 24)}`;
}

function entityRef(ref: string): CausalEntityRef {
  const separator = ref.indexOf(":");
  if (separator > 0 && separator < ref.length - 1) {
    return { entityType: ref.slice(0, separator), entityId: ref.slice(separator + 1) };
  }
  return { entityType: "narrative", entityId: ref };
}

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.round(value)));
}

function uniqueSorted(values: readonly (string | undefined)[]): readonly string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value?.trim())).map((value) => value.trim()))]
    .sort((left, right) => left.localeCompare(right));
}

function error(
  code: CausalNarrativeErrorCode,
  message: string,
  ref?: string,
  path?: string,
): CausalNarrativeError {
  return { code, message, ...(path ? { path } : {}), ...(ref ? { ref } : {}), retryable: false };
}

function budget(input?: Partial<CausalNarrativePacingBudget>): CausalNarrativePacingBudget {
  return {
    maxThreads: Math.max(0, Math.floor(input?.maxThreads ?? DEFAULT_PACING_BUDGET.maxThreads)),
    maxOpportunities: Math.max(0, Math.floor(input?.maxOpportunities ?? DEFAULT_PACING_BUDGET.maxOpportunities)),
    maxCases: Math.max(0, Math.floor(input?.maxCases ?? DEFAULT_PACING_BUDGET.maxCases)),
    maxPromises: Math.max(0, Math.floor(input?.maxPromises ?? DEFAULT_PACING_BUDGET.maxPromises)),
    maxDebts: Math.max(0, Math.floor(input?.maxDebts ?? DEFAULT_PACING_BUDGET.maxDebts)),
    maxRelationshipBeats: Math.max(0, Math.floor(input?.maxRelationshipBeats ?? DEFAULT_PACING_BUDGET.maxRelationshipBeats)),
    antiRepeatWindowWorldMinutes: Math.max(0, Math.floor(input?.antiRepeatWindowWorldMinutes ?? DEFAULT_PACING_BUDGET.antiRepeatWindowWorldMinutes)),
  };
}

function isLegalThreadTransition(fromState: NarrativeThreadState, toState: NarrativeThreadState): boolean {
  return fromState === toState || THREAD_TRANSITIONS[fromState].includes(toState);
}

export function transitionNarrativeThread(input: TransitionNarrativeThreadInput): NarrativeThread {
  if (!isLegalThreadTransition(input.thread.state, input.toState)) {
    throw new Error(`illegal_narrative_thread_transition:${input.thread.state}->${input.toState}`);
  }
  const updatedAtWorldMinute = Math.max(input.thread.updatedAtWorldMinute, Math.floor(input.worldMinute));
  return {
    ...input.thread,
    state: input.toState,
    originEventIds: uniqueSorted([...input.thread.originEventIds, ...input.sourceEventIds]),
    updatedAtWorldMinute,
    reviewAtWorldMinute: input.toState === "resolved" || input.toState === "transformed"
      ? Number.MAX_SAFE_INTEGER
      : updatedAtWorldMinute + reviewIntervalForThread(input.thread),
    ...(input.toState === "resolved" ? { resolvedAtWorldMinute: updatedAtWorldMinute } : {}),
    ...(input.transformedToThreadIds ? { transformedToThreadIds: uniqueSorted(input.transformedToThreadIds) } : {}),
  };
}

function reviewIntervalForThread(thread: Pick<NarrativeThread, "tensions">): number {
  const maxTension = thread.tensions.reduce((max, tension) => Math.max(max, tension.score), 0);
  if (maxTension >= 80) return 60;
  if (maxTension >= 60) return 360;
  if (maxTension >= 35) return 1_440;
  return 10_080;
}

function eventRefs(input: DeriveCausalNarrativeInput): Readonly<Record<string, CausalWorldEventV1>> {
  return input.events.reduce((result, event) => {
    result[event.eventId] = event;
    return result;
  }, {} as Record<string, CausalWorldEventV1>);
}

function visibleKnowledge(input: DeriveCausalNarrativeInput): readonly EpochKnowledgeRecord[] {
  return input.knowledgeRecords
    .filter((record) => canAccessKnowledgeRecord(record, input.caller))
    .sort((left, right) => right.confidence - left.confidence || left.id.localeCompare(right.id));
}

function pressureVisible(pressure: EpochWorldPressure, input: DeriveCausalNarrativeInput): boolean {
  if (input.visibleRegionIds?.length) {
    const regionId = pressure.scopeRef.startsWith("region:") ? pressure.scopeRef.slice("region:".length) : pressure.scopeRef;
    if (!input.visibleRegionIds.includes(regionId) && !input.visibleRegionIds.includes(pressure.scopeRef)) return false;
  }
  if (input.visibleActorRefs?.length && pressure.affectedActorRefs.length) {
    if (!pressure.affectedActorRefs.some((ref) => input.visibleActorRefs?.includes(ref))) return false;
  }
  return pressure.visibility >= 20 || pressure.sourceFactEventIds.some((id) => input.caller?.evidenceIds?.includes(id));
}

function recentContentBlocked(
  input: DeriveCausalNarrativeInput,
  contentKey: string,
  actorRefs: readonly string[],
  regionRefs: readonly string[],
): boolean {
  const cutoff = input.worldMinute - budget(input.pacingBudget).antiRepeatWindowWorldMinutes;
  return (input.recentContent || []).some((recent) =>
    recent.usedAtWorldMinute >= cutoff
    && (
      recent.contentKey === contentKey
      || Boolean(recent.actorRefs?.some((actorRef) => actorRefs.includes(actorRef)))
      || Boolean(recent.regionRefs?.some((regionRef) => regionRefs.includes(regionRef)))
    )
  );
}

function sourceEventsExist(sourceEventIds: readonly string[], knownEvents: Readonly<Record<string, CausalWorldEventV1>>): boolean {
  return sourceEventIds.length > 0 && sourceEventIds.every((id) => Boolean(knownEvents[id]));
}

function goalsForPressure(pressure: EpochWorldPressure, actorMinds: readonly ActorMind[]): readonly GoalRef[] {
  const affected = new Set(pressure.affectedActorRefs);
  return actorMinds
    .filter((mind) => affected.size === 0 || affected.has(mind.actorRef))
    .flatMap((mind) => mind.activeGoals)
    .filter((goal) => goal.supportingBeliefRefs.some((beliefRef) => pressure.sourceFactEventIds.includes(beliefRef)))
    .sort((left, right) => right.score - left.score || left.goalRef.localeCompare(right.goalRef));
}

function commitmentsForPressure(pressure: EpochWorldPressure, actorMinds: readonly ActorMind[]): readonly CommitmentRef[] {
  const actorRefs = new Set(pressure.affectedActorRefs);
  return actorMinds
    .filter((mind) => actorRefs.size === 0 || actorRefs.has(mind.actorRef))
    .flatMap((mind) => mind.commitments)
    .filter((commitment) =>
      commitment.status === "active"
      && (
        pressure.sourceFactEventIds.some((id) => commitment.evidenceRefs.includes(id) || commitment.beliefRefs.includes(id))
        || pressure.affectedActorRefs.includes(commitment.beneficiaryRef)
      ))
    .sort((left, right) => right.weight - left.weight || left.commitmentRef.localeCompare(right.commitmentRef));
}

function stageForPressure(pressure: EpochWorldPressure): NarrativeArcStage {
  if (pressure.state === "latent" || pressure.state === "detected") return "setup";
  if (pressure.state === "contested" || pressure.state === "mobilized") return "complication";
  if (pressure.state === "catastrophic") return "crisis";
  if (pressure.state === "resolving") return "choice";
  if (pressure.state === "resolved") return "fallout";
  return "legacy";
}

function threadStateForPressure(pressure: EpochWorldPressure): NarrativeThreadState {
  if (pressure.state === "latent") return "proposed";
  if (pressure.state === "detected" || pressure.state === "contested" || pressure.state === "mobilized") return "active";
  if (pressure.state === "catastrophic") return "escalating";
  if (pressure.state === "resolving") return "resolving";
  if (pressure.state === "resolved") return "resolved";
  if (pressure.state === "dormant") return "dormant";
  return "transformed";
}

function deriveThreads(
  input: DeriveCausalNarrativeInput,
  visibleRecords: readonly EpochKnowledgeRecord[],
  knownEvents: Readonly<Record<string, CausalWorldEventV1>>,
): { readonly threads: readonly NarrativeThread[]; readonly rejected: readonly CausalNarrativeError[] } {
  const rejected: CausalNarrativeError[] = [];
  const visibleRecordIds = new Set(visibleRecords.map((record) => record.id));
  const existingByRootPressure = new Map(
    (input.existingThreads || []).flatMap((thread) => thread.rootPressureIds.map((pressureId) => [pressureId, thread] as const)),
  );
  const threads: NarrativeThread[] = [];
  for (const pressure of input.pressures.filter((candidate) => pressureVisible(candidate, input))) {
    if (!pressure.sourceFactEventIds.length) {
      rejected.push(error("NARRATIVE_EVENT_SOURCE_REQUIRED", "thread root pressure has no source events", pressure.pressureId, "pressures.sourceFactEventIds"));
      continue;
    }
    if (!sourceEventsExist(pressure.sourceFactEventIds, knownEvents)) {
      rejected.push(error("NARRATIVE_EVENT_SOURCE_REQUIRED", "thread source event is not present in input events", pressure.pressureId, "events"));
      continue;
    }
    const goals = goalsForPressure(pressure, input.actorMinds);
    const commitments = commitmentsForPressure(pressure, input.actorMinds);
    const facts = visibleRecords
      .filter((record) => record.status !== "refuted" && record.evidence.sourceEventIds.some((id) => pressure.sourceFactEventIds.includes(id)))
      .map((record) => record.id);
    const falseBeliefs = visibleRecords
      .filter((record) => (record.kind === "rumor" || record.kind === "deception" || record.status === "refuted")
        && record.evidence.sourceEventIds.some((id) => pressure.sourceFactEventIds.includes(id)))
      .map((record) => record.id);
    const secrets = pressure.uncertainty >= 50
      ? pressure.sourceFactEventIds.filter((id) => !visibleRecordIds.has(id)).map((id) => `hidden:${id}`)
      : [];
    const tension: NarrativeTension = {
      tensionId: deterministicId("narrative_tension", { pressureId: pressure.pressureId, kind: PRESSURE_TENSION_KIND[pressure.type] }),
      kind: PRESSURE_TENSION_KIND[pressure.type],
      score: clampInt(pressure.severity * 0.45 + pressure.urgency * 0.25 + pressure.uncertainty * 0.15 + pressure.growthRate * 0.15, 0, 100),
      pressureIds: [pressure.pressureId],
      actorGoalRefs: goals.map((goal) => goal.goalRef),
      knowledgeRefs: uniqueSorted([...facts, ...falseBeliefs]),
      sourceEventIds: pressure.sourceFactEventIds,
      explanation: `Derived from ${pressure.type} pressure ${pressure.pressureId}; tension score uses severity, urgency, uncertainty, and growth.`,
    };
    const stage = stageForPressure(pressure);
    const arc: NarrativeArc = {
      arcId: deterministicId("narrative_arc", { pressureId: pressure.pressureId, stage }),
      stage,
      openedAtWorldMinute: pressure.openedAtWorldMinute,
      dueAtWorldMinute: pressure.reviewAtWorldMinute,
      rootPressureIds: [pressure.pressureId],
      sourceEventIds: pressure.sourceFactEventIds,
      objectivePredicateRefs: [`predicate:pressure:${pressure.pressureId}:relief`],
      possibleTransformRefs: pressure.counterPressureIds,
    };
    const actorRefs = uniqueSorted([
      ...pressure.affectedActorRefs,
      ...input.actorMinds.filter((mind) => goals.some((goal) => mind.activeGoals.some((active) => active.goalRef === goal.goalRef))).map((mind) => mind.actorRef),
    ]);
    const regionRefs = pressure.scopeRef.startsWith("region:") ? [pressure.scopeRef.slice("region:".length)] : [];
    if (recentContentBlocked(input, `pressure:${pressure.type}`, actorRefs, regionRefs)) continue;
    const existing = existingByRootPressure.get(pressure.pressureId);
    const state = existing && isLegalThreadTransition(existing.state, threadStateForPressure(pressure))
      ? threadStateForPressure(pressure)
      : existing?.state ?? threadStateForPressure(pressure);
    threads.push({
      threadId: existing?.threadId ?? deterministicId("narrative_thread", { pressureId: pressure.pressureId }),
      state,
      titleRef: `pressure:${pressure.type}:${pressure.scopeRef}`,
      rootPressureIds: [pressure.pressureId],
      originEventIds: uniqueSorted([...(existing?.originEventIds || []), ...pressure.sourceFactEventIds]),
      actorRefs,
      regionRefs,
      knownFactRefs: uniqueSorted(facts),
      secretRefs: uniqueSorted(secrets),
      falseBeliefRefs: uniqueSorted(falseBeliefs),
      conflictingGoalRefs: uniqueSorted(goals.map((goal) => goal.goalRef)),
      promiseRefs: uniqueSorted(commitments.filter((commitment) => commitment.kind === "player_promise" || commitment.kind === "vow").map((commitment) => commitment.commitmentRef)),
      debtRefs: uniqueSorted(commitments.filter((commitment) => commitment.kind === "debt" || commitment.kind === "legal_obligation").map((commitment) => commitment.commitmentRef)),
      relationshipBeatRefs: existing?.relationshipBeatRefs ?? [],
      arcs: [arc],
      tensions: [tension],
      currentStage: stage,
      openedAtWorldMinute: existing?.openedAtWorldMinute ?? pressure.openedAtWorldMinute,
      updatedAtWorldMinute: input.worldMinute,
      reviewAtWorldMinute: pressure.reviewAtWorldMinute,
      ...(pressure.transformedFromPressureIds ? { transformedFromThreadIds: pressure.transformedFromPressureIds.map((id) => deterministicId("narrative_thread", { pressureId: id })) } : {}),
      ...(pressure.transformedToPressureIds ? { transformedToThreadIds: pressure.transformedToPressureIds.map((id) => deterministicId("narrative_thread", { pressureId: id })) } : {}),
      ...(pressure.resolvedAtWorldMinute !== undefined ? { resolvedAtWorldMinute: pressure.resolvedAtWorldMinute } : {}),
      explanation: `Thread is a read-only narrative view over pressure ${pressure.pressureId} and source events ${pressure.sourceFactEventIds.join(",")}.`,
    });
  }
  return {
    threads: threads.sort(threadSort).slice(0, budget(input.pacingBudget).maxThreads),
    rejected,
  };
}

function threadSort(left: NarrativeThread, right: NarrativeThread): number {
  const leftTension = left.tensions.reduce((max, tension) => Math.max(max, tension.score), 0);
  const rightTension = right.tensions.reduce((max, tension) => Math.max(max, tension.score), 0);
  return rightTension - leftTension || left.reviewAtWorldMinute - right.reviewAtWorldMinute || left.threadId.localeCompare(right.threadId);
}

function deriveOpportunities(input: DeriveCausalNarrativeInput): { readonly opportunities: readonly WorldOpportunity[]; readonly rejected: readonly CausalNarrativeError[] } {
  const rejected: CausalNarrativeError[] = [];
  const opportunities: WorldOpportunity[] = [];
  const visibleRecords = visibleKnowledge(input);
  const visibleRecordIds = new Set(visibleRecords.map((record) => record.id));
  for (const pressure of input.pressures.filter((candidate) => pressureVisible(candidate, input))) {
    if (!pressureMeetsEpochWorldOpportunityThreshold(pressure)) continue;
    if (!pressure.sourceFactEventIds.length) {
      rejected.push(error("NARRATIVE_ROOT_PRESSURE_REQUIRED", "opportunity requires root pressure source events", pressure.pressureId));
      continue;
    }
    const actors = input.actorMinds.filter((mind) =>
      pressure.affectedActorRefs.length === 0
      || pressure.affectedActorRefs.includes(mind.actorRef)
      || mind.activeGoals.some((goal) => goal.supportingBeliefRefs.some((beliefRef) => pressure.sourceFactEventIds.includes(beliefRef)))
    );
    const eligibleActorRefs = actors
      .filter((mind) => mind.activeGoals.length > 0 && mind.beliefs.some((beliefRef) => visibleRecordIds.has(beliefRef) || pressure.sourceFactEventIds.includes(beliefRef)))
      .map((mind) => mind.actorRef);
    if (!eligibleActorRefs.length) {
      rejected.push(error("NARRATIVE_OPPORTUNITY_NOT_QUALIFIED", "no visible actor goal and knowledge basis qualifies for opportunity", pressure.pressureId));
      continue;
    }
    const interventionType = `relieve_${pressure.type}_pressure`;
    const risk = clampInt(pressure.severity * 0.35 + pressure.urgency * 0.25 + pressure.uncertainty * 0.25 + pressure.growthRate * 0.15, 0, 100);
    const cost = clampInt(Math.max(1, pressure.severity + pressure.urgency) * 10, 1, 10_000);
    const opportunityId = deterministicId("world_opportunity", { interventionType, pressureId: pressure.pressureId, actors: eligibleActorRefs });
    const pressureSignal = missedPressureSignal(pressure, input.worldMinute, opportunityId);
    opportunities.push({
      opportunityId,
      rootPressureIds: [pressure.pressureId],
      sponsorRef: pressure.affectedActorRefs[0],
      beneficiaryRefs: pressure.affectedActorRefs,
      oppositionRefs: pressure.counterPressureIds,
      competitorRefs: actors.filter((mind) => !eligibleActorRefs.includes(mind.actorRef)).map((mind) => mind.actorRef),
      interventionType,
      eligibility: {
        eligibleActorRefs: uniqueSorted(eligibleActorRefs),
        requiredGoalRefs: uniqueSorted(actors.flatMap((mind) => mind.activeGoals.map((goal) => goal.goalRef))),
        requiredKnowledgeRefs: uniqueSorted(pressure.sourceFactEventIds.filter((id) => visibleRecordIds.has(id))),
        excludedByCommitmentRefs: uniqueSorted(actors.flatMap((mind) =>
          mind.commitments.filter((commitment) => commitment.status === "active" && commitment.weight >= 65).map((commitment) => commitment.commitmentRef))),
        explanation: "Eligible actors must have visible knowledge and at least one active goal grounded in the same pressure evidence.",
      },
      objectivePredicates: [{
        predicateId: deterministicId("predicate", { opportunityId, pressureId: pressure.pressureId, target: "severity" }),
        subjectRef: entityRef(`world_pressure:${pressure.pressureId}`),
        operator: "lte",
        expectedValue: Math.max(0, pressure.severity - 15),
        evaluationStatus: "unknown",
        evaluatedAtWorldMinute: input.worldMinute,
      }],
      availableEvidenceRefs: pressure.sourceFactEventIds.filter((id) => visibleRecordIds.has(id) || input.events.some((event) => event.eventId === id)),
      hiddenInformationRefs: pressure.uncertainty >= 50 ? [`hidden:${pressure.pressureId}`] : [],
      capabilityRequirements: [`capability:${pressure.type}:intervention`],
      resourceRequirements: [{ resourceRef: `resource:${pressure.type}:response_capacity`, quantityMinor: String(cost), reasonCode: "pressure_response_cost" }],
      legalConstraints: pressure.type === "legal" || pressure.type === "political" ? [`legal_basis:${pressure.scopeRef}`] : [],
      rewardFundingRef: pressure.affectedResourceRefs[0],
      worldIntensity: clampInt(risk + pressure.visibility * 0.1, 0, 100),
      risk,
      cost,
      openedAtWorldMinute: input.worldMinute,
      expiresAtWorldMinute: pressure.reviewAtWorldMinute,
      refusalConsequences: [{
        consequenceId: deterministicId("opportunity_consequence", { opportunityId, trigger: "rejected" }),
        trigger: "rejected",
        pressureSignalSeeds: [pressureSignal],
        knowledgeSeeds: [knowledgeSeed("claim", opportunityId, "Opportunity was refused despite visible pressure.", pressure.sourceFactEventIds, pressure.affectedActorRefs, 0.56)],
        explanation: "Refusal preserves history and adds a visible claim plus pressure signal for the next tick.",
      }],
      missedConsequences: [{
        consequenceId: deterministicId("opportunity_consequence", { opportunityId, trigger: "missed" }),
        trigger: "missed",
        pressureSignalSeeds: [pressureSignal],
        knowledgeSeeds: [knowledgeSeed("observation", opportunityId, "Opportunity expired while root pressure remained unresolved.", pressure.sourceFactEventIds, pressure.affectedActorRefs, 0.72)],
        explanation: "Missing the deadline increases or preserves the underlying pressure instead of resetting it.",
      }],
      explanation: `Opportunity is derived from pressure ${pressure.pressureId}, actor goals, and caller-visible evidence only.`,
    });
  }
  return {
    opportunities: [...dedupeBy(opportunities, (candidate) => candidate.opportunityId)]
      .sort((left, right) => right.worldIntensity - left.worldIntensity || left.expiresAtWorldMinute - right.expiresAtWorldMinute || left.opportunityId.localeCompare(right.opportunityId))
      .slice(0, budget(input.pacingBudget).maxOpportunities),
    rejected,
  };
}

function missedPressureSignal(pressure: EpochWorldPressure, worldMinute: number, opportunityId: string): EpochWorldPressureFactSignal {
  return {
    signalId: deterministicId("pressure_signal", { pressureId: pressure.pressureId, opportunityId, trigger: "missed" }),
    kind: pressure.type === "legal" ? "case_backlog"
      : pressure.type === "informational" ? "rumor_spread"
        : pressure.type === "economic" ? "debt_default"
          : pressure.type === "survival" ? "food_shortage"
            : pressure.type === "ecological" ? "carrying_capacity_loss"
              : pressure.type === "military" ? "security_breakdown"
                : pressure.type === "supernatural" ? "anomaly"
                  : pressure.type === "political" ? "legitimacy_loss"
                    : "trust_collapse",
    scopeRef: pressure.scopeRef,
    observedAtWorldMinute: worldMinute,
    sourceFactEventIds: pressure.sourceFactEventIds,
    affectedActorRefs: pressure.affectedActorRefs,
    affectedResourceRefs: pressure.affectedResourceRefs,
    severity: clampInt(pressure.severity + 5, 0, 100),
    urgency: clampInt(pressure.urgency + 5, 0, 100),
    growthRate: pressure.growthRate,
    uncertainty: pressure.uncertainty,
    visibility: pressure.visibility,
    pressureType: pressure.type,
  };
}

function knowledgeSeed(
  kind: EpochKnowledgeRecordSeed["kind"],
  subject: string,
  text: string,
  sourceEventIds: readonly string[],
  visibilityRefs: readonly string[],
  confidence: number,
): EpochKnowledgeRecordSeed {
  return {
    id: deterministicId("knowledge_seed", { kind, subject, sourceEventIds, text }),
    kind,
    subject,
    text,
    confidence,
    evidenceIds: sourceEventIds,
    sourceEventIds,
    visibilityRefs: uniqueSorted(visibilityRefs),
  };
}

function deriveCases(input: DeriveCausalNarrativeInput, visibleRecords: readonly EpochKnowledgeRecord[]): { readonly cases: readonly OpenCase[]; readonly rejected: readonly CausalNarrativeError[] } {
  const rejected: CausalNarrativeError[] = [];
  const cases: OpenCase[] = [...(input.existingCases || [])];
  const legalPressures = input.pressures.filter((pressure) =>
    pressureVisible(pressure, input)
    && (pressure.type === "legal" || pressure.sourceFactEventIds.some((eventId) => input.events.find((event) => event.eventId === eventId)?.eventType.includes("case"))));
  for (const pressure of legalPressures) {
    const evidenceRecords = visibleRecords.filter((record) =>
      record.evidence.sourceEventIds.some((id) => pressure.sourceFactEventIds.includes(id))
      || record.evidence.evidenceIds.some((id) => pressure.sourceFactEventIds.includes(id)));
    if (!evidenceRecords.length) {
      rejected.push(error("NARRATIVE_CASE_EVIDENCE_REQUIRED", "case requires caller-visible evidence history", pressure.pressureId));
      continue;
    }
    const hypotheses = evidenceRecords
      .filter((record) => record.kind === "claim" || record.kind === "fact" || record.kind === "observation")
      .map((record) => caseHypothesis(record, evidenceRecords));
    if (!hypotheses.length) {
      rejected.push(error("NARRATIVE_CASE_HYPOTHESIS_REQUIRED", "case requires at least one visible fact, observation, or claim hypothesis", pressure.pressureId));
      continue;
    }
    const caseId = deterministicId("open_case", { pressureId: pressure.pressureId, evidence: evidenceRecords.map((record) => record.id) });
    if (cases.some((openCase) => openCase.caseId === caseId)) continue;
    const refutations = uniqueSorted(evidenceRecords.flatMap((record) => record.refutedBy));
    const status: OpenCase["status"] = refutations.length ? "contested" : "investigating";
    cases.push({
      caseId,
      status,
      jurisdictionRef: pressure.scopeRef.startsWith("region:") ? `jurisdiction:${pressure.scopeRef.slice("region:".length)}` : `jurisdiction:${pressure.scopeRef}`,
      subjectRefs: uniqueSorted([...pressure.affectedActorRefs, pressure.scopeRef]),
      rootPressureIds: [pressure.pressureId],
      sourceEventIds: pressure.sourceFactEventIds,
      evidenceGraph: evidenceRecords.map((record) => ({
        evidenceRef: record.id,
        sourceEventIds: record.evidence.sourceEventIds,
        supportsHypothesisRefs: record.supports,
        refutesHypothesisRefs: record.refutes,
        submittedAtWorldMinute: input.worldMinute,
        visibleToRefs: uniqueSorted([
          ...record.visibility.agentIds.map((id) => `agent:${id}`),
          ...record.visibility.explorerIds.map((id) => `explorer:${id}`),
          ...record.visibility.regionIds.map((id) => `region:${id}`),
          ...(record.visibility.scopes.includes("public") ? ["public"] : []),
        ]),
      })),
      hypotheses,
      refutationRefs: refutations,
      unresolvedReason: status === "contested" ? "conflicting_evidence" : undefined,
      openedAtWorldMinute: pressure.openedAtWorldMinute,
      updatedAtWorldMinute: input.worldMinute,
      explanation: `Open case preserves evidence, hypotheses, and refutations for legal pressure ${pressure.pressureId}; refutations do not delete history.`,
    });
  }
  return {
    cases: [...dedupeBy(cases, (openCase) => openCase.caseId)]
      .sort((left, right) => right.updatedAtWorldMinute - left.updatedAtWorldMinute || left.caseId.localeCompare(right.caseId))
      .slice(0, budget(input.pacingBudget).maxCases),
    rejected,
  };
}

function caseHypothesis(record: EpochKnowledgeRecord, records: readonly EpochKnowledgeRecord[]): CaseHypothesis {
  const counters = uniqueSorted([
    ...record.refutedBy,
    ...records.filter((candidate) => candidate.refutes.includes(record.id)).map((candidate) => candidate.id),
  ]);
  const supports = uniqueSorted([
    record.id,
    ...records.filter((candidate) => candidate.supports.includes(record.id)).map((candidate) => candidate.id),
  ]);
  const confidenceBps = clampInt(record.confidence * 10_000 + supports.length * 250 - counters.length * 1_500, 0, 10_000);
  return {
    hypothesisId: deterministicId("case_hypothesis", { recordId: record.id }),
    claimRef: record.id,
    status: counters.length ? confidenceBps >= 5_000 ? "weakened" : "refuted" : confidenceBps >= 7_000 ? "supported" : "open",
    supportEvidenceRefs: supports,
    counterEvidenceRefs: counters,
    confidenceBps,
  };
}

function deriveLongHooks(input: DeriveCausalNarrativeInput): {
  readonly promises: readonly NarrativePromise[];
  readonly debts: readonly NarrativeDebt[];
  readonly relationshipBeats: readonly RelationshipBeat[];
} {
  const promises: NarrativePromise[] = [...(input.existingPromises || [])];
  const debts: NarrativeDebt[] = [...(input.existingDebts || [])];
  const beats: RelationshipBeat[] = [...(input.existingRelationshipBeats || [])];
  const eventIds = new Set(input.events.map((event) => event.eventId));
  for (const mind of input.actorMinds) {
    for (const commitment of mind.commitments.filter((candidate) => candidate.status === "active" || candidate.status === "disputed")) {
      const sourceEventIds = commitment.evidenceRefs.filter((ref) => eventIds.has(ref));
      if (!sourceEventIds.length) continue;
      if (commitment.kind === "player_promise" || commitment.kind === "vow" || commitment.kind === "contract") {
        promises.push({
          promiseId: deterministicId("promise", { actorRef: mind.actorRef, commitmentRef: commitment.commitmentRef }),
          promisorRef: mind.actorRef,
          beneficiaryRef: commitment.beneficiaryRef,
          contentRef: commitment.contentRef,
          status: commitment.status === "disputed" ? "disputed" : "open",
          ...(commitment.dueAtWorldMinute !== undefined ? { dueAtWorldMinute: commitment.dueAtWorldMinute } : {}),
          evidenceRefs: commitment.evidenceRefs,
          sourceEventIds,
        });
      }
      if (commitment.kind === "debt" || commitment.kind === "legal_obligation" || commitment.cost > 0) {
        debts.push({
          debtId: deterministicId("debt", { actorRef: mind.actorRef, commitmentRef: commitment.commitmentRef }),
          debtorRef: mind.actorRef,
          creditorRef: commitment.beneficiaryRef,
          debtKind: commitment.kind === "legal_obligation" ? "legal" : commitment.kind === "debt" ? "resource" : "favor",
          pressureRefs: input.pressures.filter((pressure) => pressure.sourceFactEventIds.some((id) => sourceEventIds.includes(id))).map((pressure) => pressure.pressureId),
          status: commitment.status === "disputed" ? "disputed" : "owed",
          ...(commitment.dueAtWorldMinute !== undefined ? { dueAtWorldMinute: commitment.dueAtWorldMinute } : {}),
          evidenceRefs: commitment.evidenceRefs,
          sourceEventIds,
        });
      }
    }
    for (const relationship of mind.relationships) {
      const sourceEventIds = relationship.beliefRefs.filter((ref) => eventIds.has(ref));
      if (!sourceEventIds.length) continue;
      beats.push({
        beatId: deterministicId("relationship_beat", { actorRef: mind.actorRef, relationshipRef: relationship.relationshipRef, sourceEventIds }),
        relationshipRef: relationship.relationshipRef,
        actorRefs: uniqueSorted([mind.actorRef, relationship.targetActorRef]),
        kind: relationship.weight >= 0 ? "obligation" : "trust_loss",
        intensity: clampInt(Math.abs(relationship.weight), 0, 100),
        knowledgeRefs: relationship.beliefRefs,
        promiseRefs: [],
        debtRefs: [],
        sourceEventIds,
        occurredAtWorldMinute: input.worldMinute,
      });
    }
  }
  return {
    promises: [...dedupeBy(promises, (promise) => promise.promiseId)]
      .sort((left, right) => left.promiseId.localeCompare(right.promiseId))
      .slice(0, budget(input.pacingBudget).maxPromises),
    debts: [...dedupeBy(debts, (debt) => debt.debtId)]
      .sort((left, right) => left.debtId.localeCompare(right.debtId))
      .slice(0, budget(input.pacingBudget).maxDebts),
    relationshipBeats: [...dedupeBy(beats, (beat) => beat.beatId)]
      .sort((left, right) => right.intensity - left.intensity || left.beatId.localeCompare(right.beatId))
      .slice(0, budget(input.pacingBudget).maxRelationshipBeats),
  };
}

function dedupeBy<T>(values: readonly T[], keyOf: (value: T) => string): readonly T[] {
  const byKey = new Map<string, T>();
  for (const value of values) {
    const key = keyOf(value);
    if (!byKey.has(key)) byKey.set(key, value);
  }
  return [...byKey.values()];
}

export function deriveCausalNarrative(input: DeriveCausalNarrativeInput): DeriveCausalNarrativeResult {
  const knownEvents = eventRefs(input);
  const visibleRecords = visibleKnowledge(input);
  const threadResult = deriveThreads(input, visibleRecords, knownEvents);
  const opportunityResult = deriveOpportunities(input);
  const caseResult = deriveCases(input, visibleRecords);
  const hooks = deriveLongHooks(input);
  return {
    threads: threadResult.threads,
    opportunities: opportunityResult.opportunities,
    openCases: caseResult.cases,
    promises: hooks.promises,
    debts: hooks.debts,
    relationshipBeats: hooks.relationshipBeats,
    rejected: [...threadResult.rejected, ...opportunityResult.rejected, ...caseResult.rejected]
      .sort((left, right) => left.code.localeCompare(right.code) || (left.ref || "").localeCompare(right.ref || "")),
  };
}

export function opportunitySeedFromOpportunity(opportunity: WorldOpportunity): EpochWorldPressureOpportunitySeed {
  return {
    opportunityId: opportunity.opportunityId,
    rootPressureIds: opportunity.rootPressureIds,
    beneficiaryRefs: opportunity.beneficiaryRefs,
    oppositionRefs: opportunity.oppositionRefs,
    interventionType: opportunity.interventionType,
    availableEvidenceRefs: opportunity.availableEvidenceRefs,
    hiddenInformationRefs: opportunity.hiddenInformationRefs,
    worldIntensity: opportunity.worldIntensity,
    expiresAtWorldMinute: opportunity.expiresAtWorldMinute,
  };
}

export function actionProposalFromOpportunity(input: {
  readonly opportunity: WorldOpportunity;
  readonly actorMind: Pick<ActorMind, "actorRef" | "beliefs" | "planningHorizonWorldMinutes">;
  readonly goal: Pick<GoalRef, "goalRef" | "supportingBeliefRefs">;
  readonly submittedAtWorldMinute: number;
}): ActionProposal {
  return {
    proposalId: deterministicId("action_proposal", {
      opportunityId: input.opportunity.opportunityId,
      actorRef: input.actorMind.actorRef,
      goalRef: input.goal.goalRef,
    }),
    actorRef: input.actorMind.actorRef,
    goalRef: input.goal.goalRef,
    beliefRefs: uniqueSorted([...input.goal.supportingBeliefRefs, ...input.opportunity.availableEvidenceRefs]),
    intendedEffects: input.opportunity.objectivePredicates.map((predicate) => ({
      effectRef: predicate.predicateId,
      effectType: "world_predicate",
      targetRefs: [`${predicate.subjectRef.entityType}:${predicate.subjectRef.entityId}`],
      basisBeliefRefs: input.opportunity.availableEvidenceRefs,
      expectedValue: predicate.expectedValue,
    })),
    requiredResources: input.opportunity.resourceRequirements.map((cost) => ({
      resourceRef: cost.resourceRef,
      quantity: Number.parseInt(cost.quantityMinor, 10) || 0,
      basisBeliefRefs: input.opportunity.availableEvidenceRefs,
    })),
    requiredTimeWorldMinutes: Math.max(1, input.opportunity.expiresAtWorldMinute - input.submittedAtWorldMinute),
    requiredCapabilities: input.opportunity.capabilityRequirements.map((capabilityRef) => ({
      capabilityRef,
      minimumLevel: Math.max(1, Math.floor(input.opportunity.worldIntensity / 20)),
      basisBeliefRefs: input.opportunity.availableEvidenceRefs,
    })),
    targetRefs: uniqueSorted([
      ...input.opportunity.beneficiaryRefs,
      ...input.opportunity.oppositionRefs,
      ...input.opportunity.rootPressureIds.map((id) => `world_pressure:${id}`),
    ]),
    legalBasisRefs: input.opportunity.legalConstraints,
    consentRefs: [],
    fallbackPlanRefs: [],
    expiresAtWorldMinute: input.opportunity.expiresAtWorldMinute,
  };
}

export function settleNarrativeCandidate(input: SettleNarrativeCandidateInput): NarrativeSettlementProposal {
  const sourceEventIds = uniqueSorted(input.sourceEventIds);
  if (!sourceEventIds.length) {
    return {
      proposalId: deterministicId("narrative_settlement", { input, missingSources: true }),
      effects: [],
      pressureSeeds: [],
      knowledgeSeeds: [],
      errors: [error("NARRATIVE_SETTLEMENT_SOURCE_REQUIRED", "settlement proposal requires source events")],
    };
  }
  const authorizationRefs = uniqueSorted(input.authorizationRefs || ["auth:system:narrative_rules"]);
  const proposalId = deterministicId("narrative_settlement", {
    kind: input.candidate.kind,
    sourceEventIds,
    worldId: input.worldId,
    worldMinute: input.worldMinute,
  });
  const effects: CausalEffectV1[] = [];
  const pressureSeeds: EpochWorldPressureFactSignal[] = [];
  const knowledgeSeeds: EpochKnowledgeRecordSeed[] = [];
  if (input.candidate.kind === "thread") {
    effects.push(stateTransitionEffect({
      id: input.candidate.value.threadId,
      fromState: input.candidate.fromState ?? input.candidate.value.state,
      toState: input.candidate.value.state,
      worldMinute: input.worldMinute,
      sourceEventIds,
      authorizationRefs,
    }));
  } else if (input.candidate.kind === "opportunity") {
    const candidate = input.candidate;
    const opportunity = candidate.value;
    effects.push(pressureDeltaEffect(`world_opportunity:${opportunity.opportunityId}`, "narrative_opportunity_proposal", {
      opportunity: opportunitySeedFromOpportunity(opportunity),
      trigger: candidate.trigger,
    }, sourceEventIds, authorizationRefs));
    const consequences = [...opportunity.refusalConsequences, ...opportunity.missedConsequences]
      .filter((consequence) => consequence.trigger === candidate.trigger);
    pressureSeeds.push(...consequences.flatMap((consequence) => consequence.pressureSignalSeeds));
    knowledgeSeeds.push(...consequences.flatMap((consequence) => consequence.knowledgeSeeds));
  } else if (input.candidate.kind === "case") {
    const openCase = input.candidate.value;
    effects.push(knowledgeDeltaEffect(`open_case:${openCase.caseId}`, "case_state_proposal", {
      caseId: openCase.caseId,
      status: openCase.status,
      evidenceGraph: openCase.evidenceGraph,
      hypotheses: openCase.hypotheses,
      refutationRefs: openCase.refutationRefs,
      verdict: openCase.verdict,
      unresolvedReason: openCase.unresolvedReason,
    }, sourceEventIds, authorizationRefs));
  } else if (input.candidate.kind === "promise") {
    const promise = input.candidate.value;
    effects.push(knowledgeDeltaEffect(`promise:${promise.promiseId}`, "promise_hook_proposal", { ...promise }, sourceEventIds, authorizationRefs));
  } else if (input.candidate.kind === "debt") {
    const debt = input.candidate.value;
    effects.push(pressureDeltaEffect(`debt:${debt.debtId}`, "debt_hook_proposal", { ...debt }, sourceEventIds, authorizationRefs));
  } else {
    const beat = input.candidate.value;
    effects.push(relationshipDeltaEffect(`relationship:${beat.relationshipRef}`, "relationship_beat_proposal", { ...beat }, sourceEventIds, authorizationRefs));
  }
  return { proposalId, effects, pressureSeeds, knowledgeSeeds, errors: [] };
}

function stateTransitionEffect(input: {
  readonly id: string;
  readonly fromState: string;
  readonly toState: string;
  readonly worldMinute: number;
  readonly sourceEventIds: readonly string[];
  readonly authorizationRefs: readonly string[];
}): StateTransitionEffectV1 {
  return {
    effectId: deterministicId("effect", { kind: "thread_state", id: input.id, fromState: input.fromState, toState: input.toState }),
    effectType: "state_transition",
    targetRef: entityRef(`narrative_thread:${input.id}`),
    operation: "narrative_thread_state_proposal",
    after: {
      stateMachineId: `narrative_thread:${input.id}`,
      fromState: input.fromState,
      toState: input.toState,
      transitionId: deterministicId("transition", { id: input.id, fromState: input.fromState, toState: input.toState }),
      reasonCode: "derived_from_causal_narrative_rules",
    },
    sourceEventIds: input.sourceEventIds,
    authorizationRefs: input.authorizationRefs,
  };
}

function pressureDeltaEffect(
  targetRef: string,
  operation: string,
  after: Readonly<Record<string, unknown>>,
  sourceEventIds: readonly string[],
  authorizationRefs: readonly string[],
): PressureDeltaEffectV1 {
  return {
    effectId: deterministicId("effect", { targetRef, operation, after }),
    effectType: "pressure_delta",
    targetRef: entityRef(targetRef),
    operation,
    after,
    sourceEventIds,
    authorizationRefs,
  };
}

function knowledgeDeltaEffect(
  targetRef: string,
  operation: string,
  after: Readonly<Record<string, unknown>>,
  sourceEventIds: readonly string[],
  authorizationRefs: readonly string[],
): KnowledgeDeltaEffectV1 {
  return {
    effectId: deterministicId("effect", { targetRef, operation, after }),
    effectType: "knowledge_delta",
    targetRef: entityRef(targetRef),
    operation,
    after,
    sourceEventIds,
    authorizationRefs,
  };
}

function relationshipDeltaEffect(
  targetRef: string,
  operation: string,
  after: Readonly<Record<string, unknown>>,
  sourceEventIds: readonly string[],
  authorizationRefs: readonly string[],
): RelationshipDeltaEffectV1 {
  return {
    effectId: deterministicId("effect", { targetRef, operation, after }),
    effectType: "relationship_delta",
    targetRef: entityRef(targetRef),
    operation,
    after,
    sourceEventIds,
    authorizationRefs,
  };
}

export function worldPredicateEffectFromOpportunity(
  opportunity: WorldOpportunity,
  predicate: WorldPredicate,
  sourceEventIds: readonly string[],
  authorizationRefs: readonly string[] = ["auth:system:narrative_rules"],
): WorldPredicateEffectV1 {
  return {
    effectId: deterministicId("effect", { opportunityId: opportunity.opportunityId, predicate }),
    effectType: "world_predicate",
    targetRef: entityRef(`world_opportunity:${opportunity.opportunityId}`),
    operation: "opportunity_objective_proposal",
    after: predicate,
    sourceEventIds: uniqueSorted(sourceEventIds),
    authorizationRefs: uniqueSorted(authorizationRefs),
  };
}
