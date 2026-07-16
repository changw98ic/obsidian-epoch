import {
  type AnomalyEventContestedPayload,
  type AnomalyEventResolvedPayload,
  type AnomalyEventSpawnedPayload,
  type ContestedObjectiveContributedPayload,
  type ContestedObjectiveCreatedPayload,
  type ContestedObjectiveSettledPayload,
  type EpochEvent,
  type RaceCommissionCompletedPayload,
  type RegionInfluenceChangedPayload,
  type ResourceGrantedPayload,
  type ResourceSpentPayload,
  type TraceCreatedPayload,
} from "./events.ts";
import type { EpochEventFactory } from "./eventFactory.ts";
import { regionInfluenceChangedEvent, traceCreatedEvent } from "./regionEventLedgerEvents.ts";
import { resourceGrantedEvent, resourceSpentEvent } from "./resourceLedgerEvents.ts";
import {
  EPOCH_ANOMALY_SEVERITIES,
  type EpochAnomalyOutcome,
  type EpochAnomalyMedia,
  type EpochAnomalySeverity,
  type EpochIdFactory,
  type EpochObjectiveMode,
  type EpochResourceId,
  type EpochServerReward,
  assertNonEmptyString,
  assertPositiveInteger,
  assertResourceId,
} from "./protocol.ts";

export const OBJECTIVE_SCORE_WEIGHT: Readonly<Record<EpochResourceId, number>> = {
  coin: 1,
  aether: 4,
  stamina: 2,
  focus: 3,
  legend: 8,
};
export const ANOMALY_FOCUS_SCORE = 3;

export interface ContestedObjectiveStandingLike {
  readonly agentId: string;
  readonly explorerId: string;
  readonly score: number;
}

export interface ContestedObjectiveForRules {
  readonly status: string;
}

export interface ContestedObjectiveProjectionForRules<TObjective extends ContestedObjectiveForRules = ContestedObjectiveForRules> {
  readonly contestedObjectives: Readonly<Record<string, TObjective | undefined>>;
}

export interface ContestedObjectiveCreationEventsInput {
  readonly objectiveId: string;
  readonly regionId: string;
  readonly title: string;
  readonly description?: string;
  readonly resourceId: EpochResourceId;
  readonly targetScore: number;
  readonly mode: EpochObjectiveMode;
  readonly reward: EpochServerReward;
  readonly consolationReward?: EpochServerReward;
  readonly createdAt: string;
  readonly makeEvent: EpochEventFactory;
}

export interface ContestedObjectiveCreationProjectionInput<TObjective extends ContestedObjectiveForRules> {
  readonly projection: Pick<ContestedObjectiveProjectionForRules<TObjective>, "contestedObjectives">;
  readonly events: readonly EpochEvent[];
}

export interface ContestedObjectiveContributionEventsInput {
  readonly objectiveId: string;
  readonly agentId: string;
  readonly explorerId: string;
  readonly resourceId: EpochResourceId;
  readonly amount: number;
  readonly previousScore: number;
  readonly totalScore: number;
  readonly balanceBefore: number;
  readonly makeEvent: EpochEventFactory;
}

export interface ContestedObjectiveContributionProjectionInput<TObjective extends ContestedObjectiveForRules> {
  readonly projection: Pick<ContestedObjectiveProjectionForRules<TObjective>, "contestedObjectives">;
  readonly events: readonly EpochEvent[];
}

export interface ContestedObjectiveSettlementEventsInput {
  readonly objectiveId: string;
  readonly regionId: string;
  readonly objectiveTitle: string;
  readonly leaderboard: readonly ContestedObjectiveStandingLike[];
  readonly reward?: EpochServerReward;
  readonly settledAt: string;
  readonly winnerRewardBalanceBefore: number;
  readonly winnerInfluenceScoreBefore: number;
  readonly parentTraceId?: string;
  readonly idFactory: EpochIdFactory;
  readonly makeEvent: EpochEventFactory;
}

export interface ContestedObjectiveSettlementProjectionInput<TObjective extends ContestedObjectiveForRules> {
  readonly projection: Pick<ContestedObjectiveProjectionForRules<TObjective>, "contestedObjectives">;
  readonly events: readonly EpochEvent[];
}

export interface ContestedObjectiveCreatedPayloadInput {
  readonly objectiveId: string;
  readonly regionId: string;
  readonly title: string;
  readonly description?: string;
  readonly resourceId: EpochResourceId;
  readonly targetScore: number;
  readonly mode: EpochObjectiveMode;
  readonly reward: EpochServerReward;
  readonly consolationReward?: EpochServerReward;
  readonly createdAt: string;
}

export interface ContestedObjectiveContributionPayloadInput {
  readonly objectiveId: string;
  readonly agentId: string;
  readonly explorerId: string;
  readonly resourceId: EpochResourceId;
  readonly amount: number;
  readonly previousScore: number;
  readonly totalScore: number;
}

export interface ContestedObjectiveContributionSpendPayloadInput {
  readonly objectiveId: string;
  readonly resourceId: EpochResourceId;
  readonly amount: number;
  readonly balanceBefore: number;
}

export interface RaceCommissionCompletionEventsInput {
  readonly completionId: string;
  readonly objectiveId: string;
  readonly regionId: string;
  readonly agentId: string;
  readonly explorerId: string;
  readonly place: number;
  readonly score: number;
  readonly reward: EpochServerReward;
  readonly rewardBalanceBefore: number;
  readonly completedAt: string;
  readonly makeEvent: EpochEventFactory;
}

export interface ContestedObjectiveSettlementPayloadInput {
  readonly objectiveId: string;
  readonly settledAt: string;
  readonly winner?: ContestedObjectiveStandingLike;
  readonly reward?: EpochServerReward;
}

export interface ContestedObjectiveSettlementRewardGrantPayloadInput {
  readonly reward: EpochServerReward;
  readonly winnerRewardBalanceBefore: number;
}

export interface ContestedObjectiveSettlementInfluencePayloadInput {
  readonly influenceId: string;
  readonly regionId: string;
  readonly objectiveId: string;
  readonly winner: ContestedObjectiveStandingLike;
  readonly currentInfluenceScore: number;
  readonly sourceEventId: string;
  readonly changedAt: string;
}

export interface ContestedObjectiveSettlementTracePayloadInput {
  readonly traceId: string;
  readonly regionId: string;
  readonly objectiveId: string;
  readonly objectiveTitle: string;
  readonly winner: ContestedObjectiveStandingLike;
  readonly leaderboard: readonly ContestedObjectiveStandingLike[];
  readonly settledEventId: string;
  readonly influenceEventId: string;
  readonly influenceId: string;
  readonly parentTraceId?: string;
  readonly createdAt: string;
}

export interface AnomalyStandingLike {
  readonly agentId: string;
  readonly explorerId: string;
  readonly score: number;
}

export interface AnomalyEventForRules {
  readonly status: string;
}

export interface AnomalyProjectionForRules<TAnomaly extends AnomalyEventForRules = AnomalyEventForRules> {
  readonly anomalyEvents: Readonly<Record<string, TAnomaly | undefined>>;
  readonly anomalyEventIdsByRegion: Readonly<Record<string, readonly string[]>>;
}

export interface AnomalyEventSpawnedPayloadInput {
  readonly anomalyId: string;
  readonly regionId: string;
  readonly sourceSeasonId?: string;
  readonly title: string;
  readonly description?: string;
  readonly media?: EpochAnomalyMedia;
  readonly severity: EpochAnomalySeverity;
  readonly targetScore: number;
  readonly reward: EpochServerReward;
  readonly lifetimeRisk: number;
  readonly spawnedAt: string;
}

export interface AnomalyEventSpawnEventsInput extends AnomalyEventSpawnedPayloadInput {
  readonly makeEvent: EpochEventFactory;
}

export interface AnomalyEventSpawnProjectionInput<TAnomaly extends AnomalyEventForRules> {
  readonly projection: Pick<AnomalyProjectionForRules<TAnomaly>, "anomalyEvents">;
  readonly events: readonly EpochEvent[];
}

export interface AnomalyEventContestPayloadInput {
  readonly anomalyId: string;
  readonly agentId: string;
  readonly explorerId: string;
  readonly focusSpent: number;
  readonly previousScore: number;
  readonly totalScore: number;
  readonly contestedAt: string;
}

export interface AnomalyEventContestFocusSpendPayloadInput {
  readonly anomalyId: string;
  readonly focusSpent: number;
  readonly focusBalanceBefore: number;
}

export interface AnomalyEventContestEventsInput {
  readonly anomalyId: string;
  readonly agentId: string;
  readonly explorerId: string;
  readonly focusSpent: number;
  readonly focusBalanceBefore: number;
  readonly previousScore: number;
  readonly totalScore: number;
  readonly contestedAt: string;
  readonly makeEvent: EpochEventFactory;
}

export interface AnomalyEventContestProjectionInput<TAnomaly extends AnomalyEventForRules> {
  readonly projection: Pick<AnomalyProjectionForRules<TAnomaly>, "anomalyEvents">;
  readonly events: readonly EpochEvent[];
}

export interface AnomalyEventResolutionSideEffectInput {
  readonly resolvedEvent: EpochEvent;
  readonly eventsSoFar: readonly EpochEvent[];
}

export interface AnomalyEventResolutionEventsInput {
  readonly anomalyId: string;
  readonly regionId: string;
  readonly anomalyTitle: string;
  readonly leaderboard: readonly AnomalyStandingLike[];
  readonly totalScore: number;
  readonly targetScore: number;
  readonly reward?: EpochServerReward;
  readonly lifetimeRisk: number;
  readonly resolvedAt: string;
  readonly winnerRewardBalanceBefore: number;
  readonly winnerInfluenceScoreBefore: number;
  readonly parentTraceId?: string;
  readonly idFactory: EpochIdFactory;
  readonly makeEvent: EpochEventFactory;
  readonly planWinnerSideEffects?: (input: AnomalyEventResolutionSideEffectInput) => readonly EpochEvent[];
}

export interface AnomalyEventResolutionProjectionInput<TAnomaly extends AnomalyEventForRules> {
  readonly projection: Pick<AnomalyProjectionForRules<TAnomaly>, "anomalyEvents">;
  readonly events: readonly EpochEvent[];
}

export interface AnomalyEventResolutionPayloadInput {
  readonly anomalyId: string;
  readonly resolvedAt: string;
  readonly winner?: AnomalyStandingLike;
  readonly totalScore: number;
  readonly targetScore: number;
  readonly reward?: EpochServerReward;
  readonly lifetimeRisk: number;
}

export interface AnomalyEventResolutionRewardGrantPayloadInput {
  readonly reward: EpochServerReward;
  readonly winnerRewardBalanceBefore: number;
}

export interface AnomalyEventResolutionInfluencePayloadInput {
  readonly influenceId: string;
  readonly regionId: string;
  readonly anomalyId: string;
  readonly winner: AnomalyStandingLike;
  readonly currentInfluenceScore: number;
  readonly sourceEventId: string;
  readonly changedAt: string;
}

export interface AnomalyEventResolutionTracePayloadInput {
  readonly traceId: string;
  readonly regionId: string;
  readonly anomalyId: string;
  readonly anomalyTitle: string;
  readonly winner: AnomalyStandingLike;
  readonly leaderboard: readonly AnomalyStandingLike[];
  readonly resolvedEventId: string;
  readonly influenceEventId: string;
  readonly influenceId: string;
  readonly parentTraceId?: string;
  readonly createdAt: string;
}

export function normalizeObjectiveReward(reward: EpochServerReward): EpochServerReward {
  return {
    resourceId: assertResourceId(reward.resourceId),
    amount: assertPositiveInteger(reward.amount, "objective_reward_amount"),
    reason: assertNonEmptyString(reward.reason, "objective_reward_reason"),
  };
}

export function objectiveScoreDelta(resourceId: EpochResourceId, amount: number): number {
  return amount * OBJECTIVE_SCORE_WEIGHT[resourceId];
}

export function requireObjective<TObjective extends ContestedObjectiveForRules>(
  projection: ContestedObjectiveProjectionForRules<TObjective>,
  objectiveId: string,
): TObjective {
  const objective = projection.contestedObjectives[objectiveId];
  if (!objective) throw new Error("contested_objective_not_found");
  return objective;
}

export function requireActiveObjective<TObjective extends ContestedObjectiveForRules>(
  projection: ContestedObjectiveProjectionForRules<TObjective>,
  objectiveId: string,
): TObjective {
  const objective = requireObjective(projection, objectiveId);
  if (objective.status !== "active") throw new Error("contested_objective_settled");
  return objective;
}

export function contestedObjectiveCreatedPayload(
  input: ContestedObjectiveCreatedPayloadInput,
): ContestedObjectiveCreatedPayload {
  return {
    objectiveId: input.objectiveId,
    regionId: input.regionId,
    title: input.title,
    description: input.description?.trim() || "区域公共目标",
    resourceId: input.resourceId,
    targetScore: input.targetScore,
    mode: input.mode,
    reward: input.reward,
    ...(input.consolationReward ? { consolationReward: input.consolationReward } : {}),
    createdAt: input.createdAt,
  };
}

export function planContestedObjectiveCreationEvents(input: ContestedObjectiveCreationEventsInput): readonly EpochEvent[] {
  const payload = contestedObjectiveCreatedPayload({
    objectiveId: input.objectiveId,
    regionId: input.regionId,
    title: input.title,
    description: input.description,
    resourceId: input.resourceId,
    targetScore: input.targetScore,
    mode: input.mode,
    reward: input.reward,
    consolationReward: input.consolationReward,
    createdAt: input.createdAt,
  });
  return [input.makeEvent("contested_objective_created", input.objectiveId, payload, {
    aggregateType: "objective",
  })];
}

export function projectContestedObjectiveCreation<TObjective extends ContestedObjectiveForRules>(
  input: ContestedObjectiveCreationProjectionInput<TObjective>,
): TObjective {
  const created = input.events.find((event) => event.eventType === "contested_objective_created");
  if (!created || created.eventType !== "contested_objective_created") {
    throw new Error("contested_objective_created_event_missing");
  }
  const objective = input.projection.contestedObjectives[created.payload.objectiveId];
  if (!objective) throw new Error("objective_projection_failed");
  return objective;
}

export function planContestedObjectiveContributionEvents(
  input: ContestedObjectiveContributionEventsInput,
): readonly EpochEvent[] {
  const spent = resourceSpentEvent(input.makeEvent, input.agentId, contestedObjectiveContributionSpendPayload({
    objectiveId: input.objectiveId,
    resourceId: input.resourceId,
    amount: input.amount,
    balanceBefore: input.balanceBefore,
  }));
  const contributedPayload = contestedObjectiveContributionPayload({
    objectiveId: input.objectiveId,
    agentId: input.agentId,
    explorerId: input.explorerId,
    resourceId: input.resourceId,
    amount: input.amount,
    previousScore: input.previousScore,
    totalScore: input.totalScore,
  });
  const contributed = input.makeEvent("contested_objective_contributed", input.objectiveId, contributedPayload, {
    aggregateType: "objective",
    agentId: input.agentId,
  });
  return [spent, contributed];
}

export function projectContestedObjectiveContribution<TObjective extends ContestedObjectiveForRules>(
  input: ContestedObjectiveContributionProjectionInput<TObjective>,
): TObjective {
  const contributed = input.events.find((event) => event.eventType === "contested_objective_contributed");
  if (!contributed || contributed.eventType !== "contested_objective_contributed") {
    throw new Error("contested_objective_contributed_event_missing");
  }
  const objective = input.projection.contestedObjectives[contributed.payload.objectiveId];
  if (!objective) throw new Error("objective_projection_failed");
  return objective;
}

export function contestedObjectiveContributionPayload(
  input: ContestedObjectiveContributionPayloadInput,
): ContestedObjectiveContributedPayload {
  const scoreDelta = objectiveScoreDelta(input.resourceId, input.amount);
  return {
    objectiveId: input.objectiveId,
    agentId: input.agentId,
    explorerId: input.explorerId,
    resourceId: input.resourceId,
    amount: input.amount,
    scoreDelta,
    agentScoreAfter: input.previousScore + scoreDelta,
    totalScoreAfter: input.totalScore + scoreDelta,
  };
}

export function contestedObjectiveContributionSpendPayload(
  input: ContestedObjectiveContributionSpendPayloadInput,
): ResourceSpentPayload {
  return {
    resourceId: input.resourceId,
    amount: input.amount,
    reason: `objective_contribution:${input.objectiveId}`,
    balanceAfter: input.balanceBefore - input.amount,
  };
}

export function planRaceCommissionCompletionEvents(
  input: RaceCommissionCompletionEventsInput,
): readonly EpochEvent[] {
  const payload: RaceCommissionCompletedPayload = {
    completionId: input.completionId,
    objectiveId: input.objectiveId,
    regionId: input.regionId,
    agentId: input.agentId,
    explorerId: input.explorerId,
    place: input.place,
    score: input.score,
    reward: input.reward,
    completedAt: input.completedAt,
  };
  return [
    input.makeEvent("race_commission_completed", input.objectiveId, payload, {
      aggregateType: "objective",
      agentId: input.agentId,
    }),
    resourceGrantedEvent(input.makeEvent, input.agentId, {
      resourceId: input.reward.resourceId,
      amount: input.reward.amount,
      reason: input.reward.reason,
      balanceAfter: input.rewardBalanceBefore + input.reward.amount,
    }),
  ];
}

export function contestedObjectiveSettlementPayload(
  input: ContestedObjectiveSettlementPayloadInput,
): ContestedObjectiveSettledPayload {
  return {
    objectiveId: input.objectiveId,
    settledAt: input.settledAt,
    winnerAgentId: input.winner?.agentId,
    winnerExplorerId: input.winner?.explorerId,
    winningScore: input.winner?.score || 0,
    reward: input.winner ? input.reward : undefined,
  };
}

export function planContestedObjectiveSettlementEvents(
  input: ContestedObjectiveSettlementEventsInput,
): readonly EpochEvent[] {
  const winner = input.leaderboard[0];
  const settledPayload = contestedObjectiveSettlementPayload({
    objectiveId: input.objectiveId,
    settledAt: input.settledAt,
    winner,
    reward: input.reward,
  });
  const settled = input.makeEvent("contested_objective_settled", input.objectiveId, settledPayload, {
    aggregateType: "objective",
  });
  const nextEvents: EpochEvent[] = [settled];
  const reward = settledPayload.reward;
  if (winner && reward) {
    nextEvents.push(resourceGrantedEvent(input.makeEvent, winner.agentId, contestedObjectiveSettlementRewardGrantPayload({
      reward,
      winnerRewardBalanceBefore: input.winnerRewardBalanceBefore,
    })));
    const influenceId = input.idFactory("region_influence", `${input.regionId}:${input.objectiveId}:${winner.agentId}:objective`);
    const influencePayload = contestedObjectiveSettlementInfluencePayload({
      influenceId,
      regionId: input.regionId,
      objectiveId: input.objectiveId,
      winner,
      currentInfluenceScore: input.winnerInfluenceScoreBefore,
      sourceEventId: settled.eventId,
      changedAt: settledPayload.settledAt,
    });
    const influenceChanged = regionInfluenceChangedEvent(input.makeEvent, input.regionId, influencePayload, winner.agentId);
    nextEvents.push(influenceChanged);
    const traceId = input.idFactory("trace", `${input.regionId}:${input.objectiveId}:objective`);
    const tracePayload = contestedObjectiveSettlementTracePayload({
      traceId,
      regionId: input.regionId,
      objectiveId: input.objectiveId,
      objectiveTitle: input.objectiveTitle,
      winner,
      leaderboard: input.leaderboard,
      settledEventId: settled.eventId,
      influenceEventId: influenceChanged.eventId,
      influenceId,
      parentTraceId: input.parentTraceId,
      createdAt: settledPayload.settledAt,
    });
    nextEvents.push(traceCreatedEvent(input.makeEvent, traceId, tracePayload, winner.agentId));
  }
  return nextEvents;
}

export function projectContestedObjectiveSettlement<TObjective extends ContestedObjectiveForRules>(
  input: ContestedObjectiveSettlementProjectionInput<TObjective>,
): TObjective {
  const settled = input.events.find((event) => event.eventType === "contested_objective_settled");
  if (!settled || settled.eventType !== "contested_objective_settled") {
    throw new Error("contested_objective_settled_event_missing");
  }
  const objective = input.projection.contestedObjectives[settled.payload.objectiveId];
  if (!objective) throw new Error("objective_projection_failed");
  return objective;
}

export function contestedObjectiveSettlementRewardGrantPayload(
  input: ContestedObjectiveSettlementRewardGrantPayloadInput,
): ResourceGrantedPayload {
  return {
    resourceId: input.reward.resourceId,
    amount: input.reward.amount,
    reason: input.reward.reason,
    balanceAfter: input.winnerRewardBalanceBefore + input.reward.amount,
  };
}

export function contestedObjectiveSettlementInfluencePayload(
  input: ContestedObjectiveSettlementInfluencePayloadInput,
): RegionInfluenceChangedPayload {
  return {
    influenceId: input.influenceId,
    regionId: input.regionId,
    agentId: input.winner.agentId,
    explorerId: input.winner.explorerId,
    influenceDelta: input.winner.score,
    influenceScoreAfter: input.currentInfluenceScore + input.winner.score,
    reason: `objective_settlement:${input.objectiveId}`,
    sourceEventId: input.sourceEventId,
    sourceEventType: "contested_objective_settled",
    sourceAggregateId: input.objectiveId,
    changedAt: input.changedAt,
  };
}

export function contestedObjectiveSettlementTracePayload(
  input: ContestedObjectiveSettlementTracePayloadInput,
): TraceCreatedPayload {
  return {
    traceId: input.traceId,
    regionId: input.regionId,
    title: `${input.objectiveTitle}结算`,
    summary: `${input.winner.agentId} 在 ${input.objectiveTitle} 中以 ${input.winner.score} 分胜出。`,
    sourceEventType: "contested_objective_settled",
    sourceEventIds: [input.settledEventId, input.influenceEventId],
    sourceAggregateId: input.objectiveId,
    relatedInfluenceIds: [input.influenceId],
    participantAgentIds: uniqueValues(input.leaderboard.map((standing) => standing.agentId)),
    participantExplorerIds: uniqueValues(input.leaderboard.map((standing) => standing.explorerId)),
    parentTraceId: input.parentTraceId,
    createdAt: input.createdAt,
  };
}

export function assertAnomalySeverity(value: unknown): EpochAnomalySeverity {
  if (typeof value !== "string" || !EPOCH_ANOMALY_SEVERITIES.includes(value as EpochAnomalySeverity)) {
    throw new Error("invalid_anomaly_severity");
  }
  return value as EpochAnomalySeverity;
}

export function normalizeAnomalyReward(reward: EpochServerReward): EpochServerReward {
  return {
    resourceId: assertResourceId(reward.resourceId),
    amount: assertPositiveInteger(reward.amount, "anomaly_reward_amount"),
    reason: assertNonEmptyString(reward.reason, "anomaly_reward_reason"),
  };
}

export function anomalyScoreDelta(focusSpent: number): number {
  return focusSpent * ANOMALY_FOCUS_SCORE;
}

export function requireAnomalyEvent<TAnomaly extends AnomalyEventForRules>(
  projection: Pick<AnomalyProjectionForRules<TAnomaly>, "anomalyEvents">,
  anomalyId: string,
): TAnomaly {
  const anomaly = projection.anomalyEvents[anomalyId];
  if (!anomaly) throw new Error("anomaly_event_not_found");
  return anomaly;
}

export function requireOpenAnomalyEvent<TAnomaly extends AnomalyEventForRules>(
  projection: Pick<AnomalyProjectionForRules<TAnomaly>, "anomalyEvents">,
  anomalyId: string,
): TAnomaly {
  const anomaly = requireAnomalyEvent(projection, anomalyId);
  if (anomaly.status !== "open") throw new Error("anomaly_event_not_open");
  return anomaly;
}

export function openAnomalyEventForRegion<TAnomaly extends AnomalyEventForRules>(
  projection: AnomalyProjectionForRules<TAnomaly>,
  regionId: string,
): TAnomaly | undefined {
  return (projection.anomalyEventIdsByRegion[regionId] || [])
    .map((anomalyId) => projection.anomalyEvents[anomalyId])
    .find((anomaly): anomaly is TAnomaly => {
      if (!anomaly) return false;
      return anomaly.status === "open";
    });
}

export function anomalyEventSpawnedPayload(input: AnomalyEventSpawnedPayloadInput): AnomalyEventSpawnedPayload {
  return {
    anomalyId: input.anomalyId,
    regionId: input.regionId,
    sourceSeasonId: input.sourceSeasonId,
    title: input.title,
    description: input.description?.trim() || "区域异常链",
    ...(input.media ? { media: input.media } : {}),
    severity: input.severity,
    targetScore: input.targetScore,
    reward: input.reward,
    lifetimeRisk: input.lifetimeRisk,
    spawnedAt: input.spawnedAt,
  };
}

export function planAnomalyEventSpawnEvents(input: AnomalyEventSpawnEventsInput): readonly EpochEvent[] {
  const payload = anomalyEventSpawnedPayload({
    anomalyId: input.anomalyId,
    regionId: input.regionId,
    sourceSeasonId: input.sourceSeasonId,
    title: input.title,
    description: input.description,
    media: input.media,
    severity: input.severity,
    targetScore: input.targetScore,
    reward: input.reward,
    lifetimeRisk: input.lifetimeRisk,
    spawnedAt: input.spawnedAt,
  });
  return [input.makeEvent("anomaly_event_spawned", input.anomalyId, payload, {
    aggregateType: "anomaly_event",
  })];
}

export function projectAnomalyEventSpawn<TAnomaly extends AnomalyEventForRules>(
  input: AnomalyEventSpawnProjectionInput<TAnomaly>,
): TAnomaly {
  const spawned = input.events.find((event) => event.eventType === "anomaly_event_spawned");
  if (!spawned || spawned.eventType !== "anomaly_event_spawned") {
    throw new Error("anomaly_event_spawned_event_missing");
  }
  const anomaly = input.projection.anomalyEvents[spawned.payload.anomalyId];
  if (!anomaly) throw new Error("anomaly_projection_failed");
  return anomaly;
}

export function anomalyEventContestPayload(input: AnomalyEventContestPayloadInput): AnomalyEventContestedPayload {
  const scoreDelta = anomalyScoreDelta(input.focusSpent);
  return {
    anomalyId: input.anomalyId,
    agentId: input.agentId,
    explorerId: input.explorerId,
    focusSpent: input.focusSpent,
    scoreDelta,
    agentScoreAfter: input.previousScore + scoreDelta,
    totalScoreAfter: input.totalScore + scoreDelta,
    contestedAt: input.contestedAt,
  };
}

export function anomalyEventContestFocusSpendPayload(
  input: AnomalyEventContestFocusSpendPayloadInput,
): ResourceSpentPayload {
  return {
    resourceId: "focus",
    amount: input.focusSpent,
    reason: `anomaly_event_contest:${input.anomalyId}`,
    balanceAfter: input.focusBalanceBefore - input.focusSpent,
  };
}

export function planAnomalyEventContestEvents(input: AnomalyEventContestEventsInput): readonly EpochEvent[] {
  const spent = resourceSpentEvent(input.makeEvent, input.agentId, anomalyEventContestFocusSpendPayload({
    anomalyId: input.anomalyId,
    focusSpent: input.focusSpent,
    focusBalanceBefore: input.focusBalanceBefore,
  }));
  const contestedPayload = anomalyEventContestPayload({
    anomalyId: input.anomalyId,
    agentId: input.agentId,
    explorerId: input.explorerId,
    focusSpent: input.focusSpent,
    previousScore: input.previousScore,
    totalScore: input.totalScore,
    contestedAt: input.contestedAt,
  });
  const contested = input.makeEvent("anomaly_event_contested", input.anomalyId, contestedPayload, {
    aggregateType: "anomaly_event",
    agentId: input.agentId,
  });
  return [spent, contested];
}

export function projectAnomalyEventContest<TAnomaly extends AnomalyEventForRules>(
  input: AnomalyEventContestProjectionInput<TAnomaly>,
): TAnomaly {
  const contested = input.events.find((event) => event.eventType === "anomaly_event_contested");
  if (!contested || contested.eventType !== "anomaly_event_contested") {
    throw new Error("anomaly_event_contested_event_missing");
  }
  const anomaly = input.projection.anomalyEvents[contested.payload.anomalyId];
  if (!anomaly) throw new Error("anomaly_projection_failed");
  return anomaly;
}

export function anomalyEventResolutionOutcome(
  input: Pick<AnomalyEventResolutionPayloadInput, "winner" | "totalScore" | "targetScore">,
): EpochAnomalyOutcome {
  return input.winner && input.totalScore >= input.targetScore ? "contained" : "escaped";
}

export function anomalyEventResolutionPayload(
  input: AnomalyEventResolutionPayloadInput,
): AnomalyEventResolvedPayload {
  const outcome = anomalyEventResolutionOutcome(input);
  const reward = outcome === "contained" && input.winner ? input.reward : undefined;
  return {
    anomalyId: input.anomalyId,
    resolvedAt: input.resolvedAt,
    outcome,
    winnerAgentId: reward ? input.winner?.agentId : undefined,
    winnerExplorerId: reward ? input.winner?.explorerId : undefined,
    winningScore: input.winner?.score || 0,
    reward,
    lifetimeRisk: input.lifetimeRisk,
  };
}

export function planAnomalyEventResolutionEvents(input: AnomalyEventResolutionEventsInput): readonly EpochEvent[] {
  const winner = input.leaderboard[0];
  const resolvedPayload = anomalyEventResolutionPayload({
    anomalyId: input.anomalyId,
    resolvedAt: input.resolvedAt,
    winner,
    totalScore: input.totalScore,
    targetScore: input.targetScore,
    reward: input.reward,
    lifetimeRisk: input.lifetimeRisk,
  });
  const resolved = input.makeEvent("anomaly_event_resolved", input.anomalyId, resolvedPayload, {
    aggregateType: "anomaly_event",
  });
  const nextEvents: EpochEvent[] = [resolved];
  const reward = resolvedPayload.reward;
  if (winner && reward) {
    nextEvents.push(resourceGrantedEvent(input.makeEvent, winner.agentId, anomalyEventResolutionRewardGrantPayload({
      reward,
      winnerRewardBalanceBefore: input.winnerRewardBalanceBefore,
    })));
    nextEvents.push(...(input.planWinnerSideEffects?.({
      resolvedEvent: resolved,
      eventsSoFar: nextEvents,
    }) || []));
    const influenceId = input.idFactory("region_influence", `${input.regionId}:${input.anomalyId}:${winner.agentId}:anomaly`);
    const influencePayload = anomalyEventResolutionInfluencePayload({
      influenceId,
      regionId: input.regionId,
      anomalyId: input.anomalyId,
      winner,
      currentInfluenceScore: input.winnerInfluenceScoreBefore,
      sourceEventId: resolved.eventId,
      changedAt: resolvedPayload.resolvedAt,
    });
    const influenceChanged = regionInfluenceChangedEvent(input.makeEvent, input.regionId, influencePayload, winner.agentId);
    nextEvents.push(influenceChanged);
    const traceId = input.idFactory("trace", `${input.regionId}:${input.anomalyId}:anomaly`);
    const tracePayload = anomalyEventResolutionTracePayload({
      traceId,
      regionId: input.regionId,
      anomalyId: input.anomalyId,
      anomalyTitle: input.anomalyTitle,
      winner,
      leaderboard: input.leaderboard,
      resolvedEventId: resolved.eventId,
      influenceEventId: influenceChanged.eventId,
      influenceId,
      parentTraceId: input.parentTraceId,
      createdAt: resolvedPayload.resolvedAt,
    });
    nextEvents.push(traceCreatedEvent(input.makeEvent, traceId, tracePayload, winner.agentId));
  }
  return nextEvents;
}

export function projectAnomalyEventResolution<TAnomaly extends AnomalyEventForRules>(
  input: AnomalyEventResolutionProjectionInput<TAnomaly>,
): TAnomaly {
  const resolved = input.events.find((event) => event.eventType === "anomaly_event_resolved");
  if (!resolved || resolved.eventType !== "anomaly_event_resolved") {
    throw new Error("anomaly_event_resolved_event_missing");
  }
  const anomaly = input.projection.anomalyEvents[resolved.payload.anomalyId];
  if (!anomaly) throw new Error("anomaly_projection_failed");
  return anomaly;
}

export function anomalyEventResolutionRewardGrantPayload(
  input: AnomalyEventResolutionRewardGrantPayloadInput,
): ResourceGrantedPayload {
  return {
    resourceId: input.reward.resourceId,
    amount: input.reward.amount,
    reason: input.reward.reason,
    balanceAfter: input.winnerRewardBalanceBefore + input.reward.amount,
  };
}

export function anomalyEventResolutionInfluencePayload(
  input: AnomalyEventResolutionInfluencePayloadInput,
): RegionInfluenceChangedPayload {
  return {
    influenceId: input.influenceId,
    regionId: input.regionId,
    agentId: input.winner.agentId,
    explorerId: input.winner.explorerId,
    influenceDelta: input.winner.score,
    influenceScoreAfter: input.currentInfluenceScore + input.winner.score,
    reason: `anomaly_event_resolution:${input.anomalyId}`,
    sourceEventId: input.sourceEventId,
    sourceEventType: "anomaly_event_resolved",
    sourceAggregateId: input.anomalyId,
    changedAt: input.changedAt,
  };
}

export function anomalyEventResolutionTracePayload(
  input: AnomalyEventResolutionTracePayloadInput,
): TraceCreatedPayload {
  return {
    traceId: input.traceId,
    regionId: input.regionId,
    title: `${input.anomalyTitle}结算`,
    summary: `${input.winner.agentId} 在 ${input.anomalyTitle} 中以 ${input.winner.score} 分完成异常压制。`,
    sourceEventType: "anomaly_event_resolved",
    sourceEventIds: [input.resolvedEventId, input.influenceEventId],
    sourceAggregateId: input.anomalyId,
    relatedInfluenceIds: [input.influenceId],
    participantAgentIds: uniqueValues(input.leaderboard.map((standing) => standing.agentId)),
    participantExplorerIds: uniqueValues(input.leaderboard.map((standing) => standing.explorerId)),
    parentTraceId: input.parentTraceId,
    createdAt: input.createdAt,
  };
}

export function normalizeAnomalyMedia(media: EpochAnomalyMedia | undefined): EpochAnomalyMedia | undefined {
  if (!media) return undefined;
  const palette = Array.isArray(media.palette)
    ? media.palette.map((color) => assertNonEmptyString(color, "anomaly_media_palette_color"))
    : [];
  if (palette.length < 3) throw new Error("anomaly_media_palette_too_small");
  const assetPath = media.assetPath === undefined
    ? undefined
    : assertNonEmptyString(media.assetPath, "anomaly_media_asset_path");
  const imageUrl = media.imageUrl === undefined
    ? undefined
    : assertNonEmptyString(media.imageUrl, "anomaly_media_image_url");
  const imageSha256 = media.imageSha256 === undefined
    ? undefined
    : assertNonEmptyString(media.imageSha256, "anomaly_media_image_sha256");
  return {
    variantLabel: assertNonEmptyString(media.variantLabel, "anomaly_media_variant_label"),
    scenePrompt: assertNonEmptyString(media.scenePrompt, "anomaly_media_scene_prompt"),
    palette,
    accentColor: assertNonEmptyString(media.accentColor, "anomaly_media_accent_color"),
    dangerColor: assertNonEmptyString(media.dangerColor, "anomaly_media_danger_color"),
    sigil: assertNonEmptyString(media.sigil, "anomaly_media_sigil"),
    publicAlt: assertNonEmptyString(media.publicAlt, "anomaly_media_public_alt"),
    ...(assetPath ? { assetPath } : {}),
    ...(imageUrl ? { imageUrl } : {}),
    ...(imageSha256 ? { imageSha256 } : {}),
  };
}

function uniqueValues(values: readonly string[]): string[] {
  return values.filter((value, index) => value && values.indexOf(value) === index);
}
