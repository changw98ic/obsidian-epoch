import type {
  EpochCommandContext,
  EpochResourceId,
  EpochServerReward,
  EpochObjectiveMode,
  EpochAnomalyMedia,
  EpochAnomalySeverity,
  EpochAnomalyOutcome,
  EpochClock,
  EpochIdFactory,
} from "./protocol.ts";
import type { EpochEvent } from "./eventTypes.ts";
import {
  assertNonEmptyString,
  assertResourceId,
  assertPositiveInteger,
  assertFiniteInteger,
  normalizeTrustClass,
  serverIsoTime,
} from "./protocol.ts";
import { eventFactory } from "./eventFactory.ts";
import {
  currentBalance,
} from "./resourceRules.ts";
import {
  requireActiveIdentity,
} from "./identityProjectionRules.ts";
import {
  assertIdentityOwner,
} from "./identityAuthorizationRules.ts";
import {
  planLegendAwardClaimEvents,
  projectLegendAwardClaim,
  requireRegionNews,
} from "./legendAwardRules.ts";
import {
  currentRegionInfluenceScore,
  latestTraceIdForRegion,
} from "./regionProjectionRules.ts";
import {
  assertAnomalySeverity,
  normalizeAnomalyMedia,
  normalizeAnomalyReward,
  normalizeObjectiveReward,
  openAnomalyEventForRegion,
  planAnomalyEventSpawnEvents,
  planAnomalyEventContestEvents,
  planAnomalyEventResolutionEvents,
  planContestedObjectiveCreationEvents,
  planContestedObjectiveContributionEvents,
  planContestedObjectiveSettlementEvents,
  planRaceCommissionCompletionEvents,
  projectAnomalyEventSpawn,
  projectAnomalyEventContest,
  projectAnomalyEventResolution,
  projectContestedObjectiveCreation,
  projectContestedObjectiveContribution,
  projectContestedObjectiveSettlement,
  requireActiveObjective,
  requireAnomalyEvent,
  requireOpenAnomalyEvent,
} from "./encounterRules.ts";
import {
  latestResourceNodeSettlementAt,
  openResourceNodeForRegion,
  planResourceNodeContestEvents,
  planResourceNodeSettlementEvents,
  planResourceNodeSpawnEvents,
  projectResourceNodeContest,
  projectResourceNodeSettlement,
  projectResourceNodeSpawn,
  requireOpenResourceNode,
  requireResourceNode,
  resourceNodeEquipmentBonus,
  resourceNodeSpawnCooldownRemainingSeconds,
} from "./resourceNodeRules.ts";
import {
  anomalyPersonalityDriftTrait,
} from "./identityLifecycleRules.ts";
import {
  type EpochProjection,
  sourceEventsMentionAgent,
} from "./gameCore.ts";

// ---------------------------------------------------------------------------
// Encounter types
// ---------------------------------------------------------------------------

export interface EpochLegendAward {
  readonly awardId: string;
  readonly newsId: string;
  readonly regionId: string;
  readonly agentId: string;
  readonly explorerId: string;
  readonly amount: number;
  readonly reason: string;
  readonly awardedAt: string;
}

export type EpochContestedObjectiveStatus = "active" | "settled";

export interface EpochObjectiveStanding {
  readonly agentId: string;
  readonly explorerId: string;
  readonly amount: number;
  readonly score: number;
}

export interface EpochRaceCompletion {
  readonly completionId: string;
  readonly agentId: string;
  readonly explorerId: string;
  readonly place: number;
  readonly score: number;
  readonly reward: EpochServerReward;
  readonly completedAt: string;
}

export interface EpochContestedObjective {
  readonly objectiveId: string;
  readonly regionId: string;
  readonly title: string;
  readonly description: string;
  readonly resourceId: EpochResourceId;
  readonly targetScore: number;
  readonly mode: EpochObjectiveMode;
  readonly reward: EpochServerReward;
  readonly consolationReward?: EpochServerReward;
  readonly createdAt: string;
  readonly status: EpochContestedObjectiveStatus;
  readonly totalScore: number;
  readonly leaderboard: readonly EpochObjectiveStanding[];
  readonly raceCompletions: readonly EpochRaceCompletion[];
  readonly settledAt?: string;
  readonly winnerAgentId?: string;
  readonly winnerExplorerId?: string;
  readonly winningScore?: number;
}

export type EpochResourceNodeStatus = "open" | "settled";

export interface EpochResourceNodeStanding {
  readonly agentId: string;
  readonly explorerId: string;
  readonly staminaSpent: number;
  readonly score: number;
}

export interface EpochResourceNode {
  readonly nodeId: string;
  readonly regionId: string;
  readonly title: string;
  readonly description: string;
  readonly resourceId: EpochResourceId;
  readonly reward: EpochServerReward;
  readonly spawnedAt: string;
  readonly status: EpochResourceNodeStatus;
  readonly totalScore: number;
  readonly leaderboard: readonly EpochResourceNodeStanding[];
  readonly settledAt?: string;
  readonly winnerAgentId?: string;
  readonly winnerExplorerId?: string;
  readonly winningScore?: number;
}

export type EpochAnomalyEventStatus = "open" | "resolved";

export interface EpochAnomalyStanding {
  readonly agentId: string;
  readonly explorerId: string;
  readonly focusSpent: number;
  readonly score: number;
}

export interface EpochAnomalyEvent {
  readonly anomalyId: string;
  readonly regionId: string;
  readonly sourceSeasonId?: string;
  readonly title: string;
  readonly description: string;
  readonly media?: EpochAnomalyMedia;
  readonly severity: EpochAnomalySeverity;
  readonly targetScore: number;
  readonly reward: EpochServerReward;
  readonly lifetimeRisk: number;
  readonly spawnedAt: string;
  readonly status: EpochAnomalyEventStatus;
  readonly totalScore: number;
  readonly leaderboard: readonly EpochAnomalyStanding[];
  readonly resolvedAt?: string;
  readonly outcome?: EpochAnomalyOutcome;
  readonly winnerAgentId?: string;
  readonly winnerExplorerId?: string;
  readonly winningScore?: number;
}

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface ClaimNewsLegendInput {
  readonly newsId: string;
  readonly agentId: string;
}

export interface CreateContestedObjectiveInput {
  readonly regionId: string;
  readonly title: string;
  readonly description?: string;
  readonly resourceId: EpochResourceId;
  readonly targetScore: number;
  readonly mode?: EpochObjectiveMode;
  readonly reward: EpochServerReward;
  readonly consolationReward?: EpochServerReward;
}

export interface ContributeContestedObjectiveInput {
  readonly objectiveId: string;
  readonly agentId: string;
  readonly amount: number;
}

export interface SettleContestedObjectiveInput {
  readonly objectiveId: string;
}

export interface CreateResourceNodeInput {
  readonly regionId: string;
  readonly title: string;
  readonly description?: string;
  readonly resourceId: EpochResourceId;
  readonly rewardAmount: number;
  readonly rewardReason?: string;
}

export interface ContestResourceNodeInput {
  readonly nodeId: string;
  readonly agentId: string;
  readonly staminaSpent: number;
}

export interface SettleResourceNodeInput {
  readonly nodeId: string;
}

export interface CreateAnomalyEventInput {
  readonly regionId: string;
  readonly sourceSeasonId?: string;
  readonly title: string;
  readonly description?: string;
  readonly media?: EpochAnomalyMedia;
  readonly severity?: EpochAnomalySeverity;
  readonly targetScore: number;
  readonly reward: EpochServerReward;
  readonly lifetimeRisk?: number;
}

export interface ContestAnomalyEventInput {
  readonly anomalyId: string;
  readonly agentId: string;
  readonly focusSpent: number;
}

export interface ResolveAnomalyEventInput {
  readonly anomalyId: string;
}

// ---------------------------------------------------------------------------
// Context & factory
// ---------------------------------------------------------------------------

export interface GameCoreEncounterContext {
  readonly projection: () => EpochProjection;
  readonly commit: <T>(events: readonly EpochEvent[], value: T) => { readonly events: readonly EpochEvent[]; readonly value: T; readonly projection: EpochProjection };
  readonly applyEvents: (projection: EpochProjection, events: readonly EpochEvent[]) => EpochProjection;
  readonly clock: EpochClock;
  readonly idFactory: EpochIdFactory;
  readonly lifetimeAdjustmentEvents: (
    current: EpochProjection,
    agentId: string,
    delta: number,
    reason: string,
    finalTitle: string,
    context: EpochCommandContext,
  ) => readonly EpochEvent[];
  readonly proposePersonalityDriftEvent: (
    current: EpochProjection,
    input: {
      readonly agentId: string;
      readonly sourceEventId: string;
      readonly trigger: string;
      readonly suggestedTrait: string;
      readonly summary: string;
    },
    context: EpochCommandContext,
  ) => EpochEvent | undefined;
}

function requireServerTrust(context: EpochCommandContext, errorCode: string) {
  const trustClass = normalizeTrustClass(context.trustClass);
  if (trustClass === "untrusted_client") throw new Error(errorCode);
  return trustClass;
}

export function createEncounterCommands(
  ctx: GameCoreEncounterContext,
) {
  function claimNewsLegend(input: ClaimNewsLegendInput, context: EpochCommandContext) {
    const current = ctx.projection();
    const newsId = assertNonEmptyString(input.newsId, "news_id");
    const agentId = assertNonEmptyString(input.agentId, "agent_id");
    const identity = requireActiveIdentity(current, agentId);
    if (context.actorExplorerId !== identity.explorerId && context.trustClass !== "system_worker") {
      throw new Error("legend_claim_owner_mismatch");
    }
    const news = requireRegionNews(current, newsId);
    if (!sourceEventsMentionAgent(current, news.sourceEventIds, agentId)) {
      throw new Error("legend_news_agent_not_mentioned");
    }
    const existingAward = (current.legendAwardIdsByNews[newsId] || [])
      .map((awardId) => current.legendAwards[awardId])
      .find((award) => award?.agentId === agentId);
    if (existingAward) {
      return { events: [], value: existingAward, projection: current };
    }
    const makeEvent = eventFactory(ctx.clock, ctx.idFactory, context);
    const nextEvents = planLegendAwardClaimEvents({
      news,
      agentId,
      explorerId: identity.explorerId,
      currentLegend: currentBalance(current, agentId, "legend"),
      awardedAt: serverIsoTime(ctx.clock),
      idFactory: ctx.idFactory,
      makeEvent,
    });
    const nextProjection = ctx.applyEvents(current, nextEvents);
    return ctx.commit(nextEvents, projectLegendAwardClaim({
      events: nextEvents,
      projection: nextProjection,
    }));
  }

  function createContestedObjective(input: CreateContestedObjectiveInput, context: EpochCommandContext) {
    const trustClass = requireServerTrust(context, "contested_objective_requires_server_trust");
    const current = ctx.projection();
    const regionId = assertNonEmptyString(input.regionId, "region_id");
    const title = assertNonEmptyString(input.title, "objective_title");
    const resourceId = assertResourceId(input.resourceId);
    const objectiveId = ctx.idFactory("objective", `${regionId}:${title}`);
    const existing = current.contestedObjectives[objectiveId];
    if (existing) return { events: [], value: existing, projection: current };
    const nextEvents = planContestedObjectiveCreationEvents({
      objectiveId,
      regionId,
      title,
      description: input.description,
      resourceId,
      targetScore: assertPositiveInteger(input.targetScore, "objective_target_score"),
      mode: input.mode === "race" ? "race" : "contribution",
      reward: normalizeObjectiveReward(input.reward),
      consolationReward: input.consolationReward ? normalizeObjectiveReward(input.consolationReward) : undefined,
      createdAt: serverIsoTime(ctx.clock),
      makeEvent: eventFactory(ctx.clock, ctx.idFactory, { ...context, trustClass }),
    });
    const nextProjection = ctx.applyEvents(current, nextEvents);
    return ctx.commit(nextEvents, projectContestedObjectiveCreation({
      events: nextEvents,
      projection: nextProjection,
    }));
  }

  function contributeContestedObjective(
    input: ContributeContestedObjectiveInput,
    context: EpochCommandContext,
  ) {
    const current = ctx.projection();
    const objectiveId = assertNonEmptyString(input.objectiveId, "objective_id");
    const objective = requireActiveObjective(current, objectiveId);
    const agentId = assertNonEmptyString(input.agentId, "agent_id");
    const identity = requireActiveIdentity(current, agentId);
    assertIdentityOwner(identity, context, "objective_contributor_owner_mismatch");
    const amount = assertPositiveInteger(input.amount, "objective_contribution_amount");
    const balance = currentBalance(current, agentId, objective.resourceId);
    if (balance < amount) throw new Error("resource_insufficient");
    const previousScore = objective.leaderboard.find((standing) => standing.agentId === agentId)?.score || 0;
    const contributionEvents = planContestedObjectiveContributionEvents({
      objectiveId,
      agentId,
      explorerId: identity.explorerId,
      resourceId: objective.resourceId,
      amount,
      previousScore,
      totalScore: objective.totalScore,
      balanceBefore: balance,
      makeEvent: eventFactory(ctx.clock, ctx.idFactory, context),
    });
    const afterContribution = ctx.applyEvents(current, contributionEvents);
    const contributedObjective = requireActiveObjective(afterContribution, objectiveId);
    const contributedStanding = contributedObjective.leaderboard.find((standing) => standing.agentId === agentId);
    const crossedRaceFinish = objective.mode === "race"
      && previousScore < objective.targetScore
      && Boolean(contributedStanding && contributedStanding.score >= objective.targetScore);
    const nextEvents: EpochEvent[] = [...contributionEvents];
    if (crossedRaceFinish && contributedStanding) {
      const place = objective.raceCompletions.length + 1;
      const reward = place === 1
        ? objective.reward
        : objective.consolationReward || {
            resourceId: objective.reward.resourceId,
            amount: Math.max(1, Math.floor(objective.reward.amount / 4)),
            reason: `race_consolation:${objective.objectiveId}`,
          };
      nextEvents.push(...planRaceCommissionCompletionEvents({
        completionId: ctx.idFactory("race_completion", `${objectiveId}:${agentId}:${place}`),
        objectiveId,
        regionId: objective.regionId,
        agentId,
        explorerId: identity.explorerId,
        place,
        score: contributedStanding.score,
        reward,
        rewardBalanceBefore: currentBalance(afterContribution, agentId, reward.resourceId),
        completedAt: serverIsoTime(ctx.clock),
        makeEvent: eventFactory(ctx.clock, ctx.idFactory, {
          actorExplorerId: "system",
          trustClass: "system_worker",
          causationId: context.causationId,
          correlationId: context.correlationId,
          idempotencyKey: context.idempotencyKey,
        }),
      }));
    }
    const nextProjection = ctx.applyEvents(current, nextEvents);
    return ctx.commit(nextEvents, projectContestedObjectiveContribution({
      events: nextEvents,
      projection: nextProjection,
    }));
  }

  function settleContestedObjective(input: SettleContestedObjectiveInput, context: EpochCommandContext) {
    const trustClass = requireServerTrust(context, "contested_objective_settlement_requires_server_trust");
    const current = ctx.projection();
    const objectiveId = assertNonEmptyString(input.objectiveId, "objective_id");
    const objective = requireActiveObjective(current, objectiveId);
    const raceWinner = objective.mode === "race" ? objective.raceCompletions[0] : undefined;
    const raceWinnerStanding = raceWinner
      ? objective.leaderboard.find((standing) => standing.agentId === raceWinner.agentId)
      : undefined;
    const settlementLeaderboard = raceWinnerStanding
      ? [raceWinnerStanding, ...objective.leaderboard.filter((standing) => standing.agentId !== raceWinnerStanding.agentId)]
      : objective.leaderboard;
    const winner = settlementLeaderboard[0];
    const nextEvents = planContestedObjectiveSettlementEvents({
      objectiveId,
      regionId: objective.regionId,
      objectiveTitle: objective.title,
      leaderboard: settlementLeaderboard,
      reward: objective.mode === "race" ? undefined : objective.reward,
      settledAt: serverIsoTime(ctx.clock),
      winnerRewardBalanceBefore: winner && objective.reward
        ? currentBalance(current, winner.agentId, objective.reward.resourceId)
        : 0,
      winnerInfluenceScoreBefore: winner
        ? currentRegionInfluenceScore(current, objective.regionId, winner.agentId)
        : 0,
      parentTraceId: latestTraceIdForRegion(current, objective.regionId),
      idFactory: ctx.idFactory,
      makeEvent: eventFactory(ctx.clock, ctx.idFactory, { ...context, trustClass }),
    });
    const nextProjection = ctx.applyEvents(current, nextEvents);
    return ctx.commit(nextEvents, projectContestedObjectiveSettlement({
      events: nextEvents,
      projection: nextProjection,
    }));
  }

  function createResourceNode(input: CreateResourceNodeInput, context: EpochCommandContext) {
    const trustClass = requireServerTrust(context, "resource_node_requires_server_trust");
    const current = ctx.projection();
    const regionId = assertNonEmptyString(input.regionId, "region_id");
    const title = assertNonEmptyString(input.title, "resource_node_title");
    const resourceId = assertResourceId(input.resourceId);
    const spawnedAt = serverIsoTime(ctx.clock);
    const reward: EpochServerReward = {
      resourceId,
      amount: assertPositiveInteger(input.rewardAmount, "resource_node_reward_amount"),
      reason: input.rewardReason?.trim() || "resource_node_settlement",
    };
    const openNode = openResourceNodeForRegion(current, regionId);
    if (openNode) throw new Error("resource_node_region_open");
    const latestSettledAt = latestResourceNodeSettlementAt(current, regionId);
    if (resourceNodeSpawnCooldownRemainingSeconds(spawnedAt, latestSettledAt) > 0) {
      throw new Error("resource_node_spawn_cooldown_active");
    }
    const nodeId = ctx.idFactory("resource_node", `${regionId}:${title}:${resourceId}:${spawnedAt}`);
    const existing = current.resourceNodes[nodeId];
    if (existing) return { events: [], value: existing, projection: current };
    const nextEvents = planResourceNodeSpawnEvents({
      nodeId,
      regionId,
      title,
      description: input.description,
      resourceId,
      reward,
      spawnedAt,
      makeEvent: eventFactory(ctx.clock, ctx.idFactory, { ...context, trustClass }),
    });
    const nextProjection = ctx.applyEvents(current, nextEvents);
    return ctx.commit(nextEvents, projectResourceNodeSpawn({ events: nextEvents, projection: nextProjection }));
  }

  function contestResourceNode(input: ContestResourceNodeInput, context: EpochCommandContext) {
    const current = ctx.projection();
    const nodeId = assertNonEmptyString(input.nodeId, "resource_node_id");
    const node = requireOpenResourceNode(current, nodeId);
    const agentId = assertNonEmptyString(input.agentId, "agent_id");
    const identity = requireActiveIdentity(current, agentId);
    assertIdentityOwner(identity, context, "resource_node_contest_owner_mismatch");
    const staminaSpent = assertPositiveInteger(input.staminaSpent, "resource_node_stamina_spent");
    const staminaBalance = currentBalance(current, agentId, "stamina");
    if (staminaBalance < staminaSpent) throw new Error("resource_insufficient");
    const { equipmentScoreBonus, equipmentItemIds } = resourceNodeEquipmentBonus(current, agentId);
    const previousScore = node.leaderboard.find((standing) => standing.agentId === agentId)?.score || 0;
    const nextEvents = planResourceNodeContestEvents({
      nodeId,
      agentId,
      explorerId: identity.explorerId,
      staminaSpent,
      staminaBalanceBefore: staminaBalance,
      previousScore,
      totalScore: node.totalScore,
      equipmentScoreBonus,
      equipmentItemIds,
      contestedAt: serverIsoTime(ctx.clock),
      makeEvent: eventFactory(ctx.clock, ctx.idFactory, context),
    });
    const nextProjection = ctx.applyEvents(current, nextEvents);
    return ctx.commit(nextEvents, projectResourceNodeContest({ events: nextEvents, projection: nextProjection }));
  }

  function settleResourceNode(input: SettleResourceNodeInput, context: EpochCommandContext) {
    const trustClass = requireServerTrust(context, "resource_node_settlement_requires_server_trust");
    const current = ctx.projection();
    const nodeId = assertNonEmptyString(input.nodeId, "resource_node_id");
    const node = requireResourceNode(current, nodeId);
    if (node.status === "settled") return { events: [], value: node, projection: current };
    const winner = node.leaderboard[0];
    const makeEvent = eventFactory(ctx.clock, ctx.idFactory, { ...context, trustClass });
    const settledAt = serverIsoTime(ctx.clock);
    const nextEvents = planResourceNodeSettlementEvents({
      nodeId,
      regionId: node.regionId,
      nodeTitle: node.title,
      leaderboard: node.leaderboard,
      reward: node.reward,
      settledAt,
      winnerRewardBalanceBefore: winner ? currentBalance(current, winner.agentId, node.reward.resourceId) : 0,
      winnerInfluenceScoreBefore: winner ? currentRegionInfluenceScore(current, node.regionId, winner.agentId) : 0,
      parentTraceId: latestTraceIdForRegion(current, node.regionId),
      idFactory: ctx.idFactory,
      makeEvent,
    });
    const nextProjection = ctx.applyEvents(current, nextEvents);
    return ctx.commit(nextEvents, projectResourceNodeSettlement({ events: nextEvents, projection: nextProjection }));
  }

  function createAnomalyEvent(input: CreateAnomalyEventInput, context: EpochCommandContext) {
    const trustClass = requireServerTrust(context, "anomaly_event_requires_server_trust");
    const current = ctx.projection();
    const regionId = assertNonEmptyString(input.regionId, "region_id");
    const sourceSeasonId = typeof input.sourceSeasonId === "string" && input.sourceSeasonId.trim()
      ? input.sourceSeasonId.trim()
      : undefined;
    if (sourceSeasonId) {
      const sourceSeason = current.seasonCampaigns[sourceSeasonId];
      if (!sourceSeason) throw new Error("anomaly_source_season_not_found");
      if (!sourceSeason.regionIds.includes(regionId)) throw new Error("anomaly_source_season_region_mismatch");
    }
    const title = assertNonEmptyString(input.title, "anomaly_event_title");
    const severity = assertAnomalySeverity(input.severity || "minor");
    const targetScore = assertPositiveInteger(input.targetScore, "anomaly_event_target_score");
    const reward = normalizeAnomalyReward(input.reward);
    const media = normalizeAnomalyMedia(input.media);
    const lifetimeRisk = input.lifetimeRisk === undefined ? 1 : assertFiniteInteger(input.lifetimeRisk, "anomaly_lifetime_risk");
    if (lifetimeRisk < 0) throw new Error("anomaly_lifetime_risk_invalid");
    const openAnomaly = openAnomalyEventForRegion(current, regionId);
    if (openAnomaly) throw new Error("anomaly_event_region_open");
    const spawnedAt = serverIsoTime(ctx.clock);
    const anomalyId = ctx.idFactory("anomaly", `${regionId}:${title}:${severity}:${spawnedAt}`);
    const existing = current.anomalyEvents[anomalyId];
    if (existing) return { events: [], value: existing, projection: current };
    const nextEvents = planAnomalyEventSpawnEvents({
      anomalyId,
      regionId,
      sourceSeasonId,
      title,
      description: input.description,
      media,
      severity,
      targetScore,
      reward,
      lifetimeRisk,
      spawnedAt,
      makeEvent: eventFactory(ctx.clock, ctx.idFactory, { ...context, trustClass }),
    });
    const nextProjection = ctx.applyEvents(current, nextEvents);
    return ctx.commit(nextEvents, projectAnomalyEventSpawn({ events: nextEvents, projection: nextProjection }));
  }

  function contestAnomalyEvent(input: ContestAnomalyEventInput, context: EpochCommandContext) {
    const current = ctx.projection();
    const anomalyId = assertNonEmptyString(input.anomalyId, "anomaly_event_id");
    const anomaly = requireOpenAnomalyEvent(current, anomalyId);
    const agentId = assertNonEmptyString(input.agentId, "agent_id");
    const identity = requireActiveIdentity(current, agentId);
    assertIdentityOwner(identity, context, "anomaly_contest_owner_mismatch");
    const focusSpent = assertPositiveInteger(input.focusSpent, "anomaly_focus_spent");
    const focusBalance = currentBalance(current, agentId, "focus");
    if (focusBalance < focusSpent) throw new Error("resource_insufficient");
    const previousScore = anomaly.leaderboard.find((standing) => standing.agentId === agentId)?.score || 0;
    const nextEvents = planAnomalyEventContestEvents({
      anomalyId,
      agentId,
      explorerId: identity.explorerId,
      focusSpent,
      focusBalanceBefore: focusBalance,
      previousScore,
      totalScore: anomaly.totalScore,
      contestedAt: serverIsoTime(ctx.clock),
      makeEvent: eventFactory(ctx.clock, ctx.idFactory, context),
    });
    const nextProjection = ctx.applyEvents(current, nextEvents);
    return ctx.commit(nextEvents, projectAnomalyEventContest({ events: nextEvents, projection: nextProjection }));
  }

  function resolveAnomalyEvent(input: ResolveAnomalyEventInput, context: EpochCommandContext) {
    const trustClass = requireServerTrust(context, "anomaly_event_resolution_requires_server_trust");
    const current = ctx.projection();
    const anomalyId = assertNonEmptyString(input.anomalyId, "anomaly_event_id");
    const anomaly = requireAnomalyEvent(current, anomalyId);
    if (anomaly.status === "resolved") return { events: [], value: anomaly, projection: current };
    const winner = anomaly.leaderboard[0];
    const resolvedAt = serverIsoTime(ctx.clock);
    const makeEvent = eventFactory(ctx.clock, ctx.idFactory, { ...context, trustClass });
    const nextEvents = planAnomalyEventResolutionEvents({
      anomalyId,
      regionId: anomaly.regionId,
      anomalyTitle: anomaly.title,
      leaderboard: anomaly.leaderboard,
      totalScore: anomaly.totalScore,
      targetScore: anomaly.targetScore,
      reward: anomaly.reward,
      lifetimeRisk: anomaly.lifetimeRisk,
      resolvedAt,
      winnerRewardBalanceBefore: winner && anomaly.reward ? currentBalance(current, winner.agentId, anomaly.reward.resourceId) : 0,
      winnerInfluenceScoreBefore: winner ? currentRegionInfluenceScore(current, anomaly.regionId, winner.agentId) : 0,
      parentTraceId: latestTraceIdForRegion(current, anomaly.regionId),
      idFactory: ctx.idFactory,
      makeEvent,
      planWinnerSideEffects: winner ? ({ resolvedEvent, eventsSoFar }) => {
        if (anomaly.lifetimeRisk <= 0) return [];
        const lifetimeEvents = ctx.lifetimeAdjustmentEvents(
          current,
          winner.agentId,
          -anomaly.lifetimeRisk,
          `anomaly_event_resolved:${anomalyId}`,
          "异常压制定档身份",
          { ...context, trustClass },
        );
        const afterLifetimeRisk = ctx.applyEvents(current, [...eventsSoFar, ...lifetimeEvents]);
        if (afterLifetimeRisk.identities[winner.agentId]?.status === "active") {
          const driftProposed = ctx.proposePersonalityDriftEvent(afterLifetimeRisk, {
            agentId: winner.agentId,
            sourceEventId: resolvedEvent.eventId,
            trigger: `anomaly_lifetime_risk:${anomalyId}`,
            suggestedTrait: anomalyPersonalityDriftTrait(anomaly.lifetimeRisk),
            summary: `${anomaly.title} 的压制让该身份损失 ${anomaly.lifetimeRisk} 点寿命；确认后写入长期行事风格。`,
          }, { ...context, trustClass });
          return driftProposed ? [...lifetimeEvents, driftProposed] : lifetimeEvents;
        }
        return lifetimeEvents;
      } : undefined,
    });
    const nextProjection = ctx.applyEvents(current, nextEvents);
    return ctx.commit(nextEvents, projectAnomalyEventResolution({ events: nextEvents, projection: nextProjection }));
  }

  return {
    claimNewsLegend,
    createContestedObjective,
    contributeContestedObjective,
    settleContestedObjective,
    createResourceNode,
    contestResourceNode,
    settleResourceNode,
    createAnomalyEvent,
    contestAnomalyEvent,
    resolveAnomalyEvent,
  };
}
