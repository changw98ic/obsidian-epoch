import type {
  EpochCommandContext,
  EpochClock,
  EpochIdFactory,
  EpochResourceId,
  EpochServerReward,
  EpochTrustClass,
} from "./protocol.ts";
import type {
  EpochEvent,
  RegionInfluenceSourceEventType,
} from "./events.ts";
import {
  assertNonEmptyString,
  assertPositiveInteger,
  assertResourceId,
  normalizeTrustClass,
  serverIsoTime,
  stableKey,
} from "./protocol.ts";
import { eventFactory } from "./eventFactory.ts";
import {
  requireActiveIdentity,
} from "./identityProjectionRules.ts";
import {
  assertIdentityOwner,
} from "./identityAuthorizationRules.ts";
import {
  currentRegionInfluenceScore,
  latestTraceIdForRegion,
} from "./regionProjectionRules.ts";
import {
  addSeasonTrustScore,
  agentSeasonStandingForRegion,
  dominantSeasonTrustClass,
  latestRegionControlReleaseEvent,
  normalizeSeasonTrustBreakdown,
  planRegionControlDecayEvents,
  planReleasedRegionControlClaimEvents,
  projectRegionControlDecays,
  projectReleasedRegionControlClaim,
  regionControlBonusRegionIdsForSeasonContribution,
  regionControlDecayAmount,
  planRegionRevoltResolutionEvents,
  projectRegionRevoltResolution,
  regionRevoltResolvedPayload,
  regionRevoltSettlement,
  planSeasonCampaignCreationEvents,
  planSeasonCampaignContributionEvents,
  planSeasonCampaignSettlementEvents,
  projectSeasonCampaignCreation,
  projectSeasonCampaignContribution,
  projectSeasonCampaignSettlement,
  requireActiveSeasonCampaign,
  requireSeasonCampaign,
  seasonCampaignSettlementPlan,
  selectRegionControlDecayTargets,
  trustedSeasonScoreDelta,
  type SeasonSettlementOrganizationInput,
} from "./seasonCampaignRules.ts";
import {
  activeOrganizationUpgradeIdsForAgentSeason,
  currentOrganizationTreasuryBalance,
} from "./organizationTreasuryRules.ts";
import {
  normalizeObjectiveReward,
} from "./encounterRules.ts";
import type {
  EpochCommandResult,
  EpochOrganizationMembership,
  EpochProjection,
} from "./gameCore.ts";

// ---------------------------------------------------------------------------
// Season & region-control types
// ---------------------------------------------------------------------------

export type EpochSeasonCampaignStatus = "active" | "resolved";
export type EpochSeasonPhase = "active" | "resolved";
export type EpochSeasonPhaseEventType = "season_started" | "season_resolved";

export interface EpochSeasonPhaseEvent {
  readonly eventId: string;
  readonly eventType: EpochSeasonPhaseEventType;
  readonly phase: EpochSeasonPhase;
  readonly sourceEventId: string;
  readonly relatedEventIds: readonly string[];
  readonly at: string;
}

export type EpochSeasonObjectiveStatus = "open" | "completed";

export interface EpochSeasonObjectiveTemplate {
  readonly objectiveKey: string;
  readonly title: string;
  readonly description: string;
  readonly targetScore: number;
}

export interface EpochSeasonObjective {
  readonly objectiveId: string;
  readonly seasonId: string;
  readonly objectiveKey: string;
  readonly title: string;
  readonly description: string;
  readonly targetScore: number;
  readonly progressScore: number;
  readonly status: EpochSeasonObjectiveStatus;
  readonly createdAt: string;
  readonly sourceEventId?: string;
  readonly completedAt?: string;
  readonly completedByAgentId?: string;
  readonly completedByExplorerId?: string;
  readonly completedByFactionId?: string;
}

export interface EpochSeasonContribution {
  readonly eventId: string;
  readonly seasonId: string;
  readonly agentId: string;
  readonly explorerId: string;
  readonly factionId: string;
  readonly resourceId: EpochResourceId;
  readonly amount: number;
  readonly baseScoreDelta: number;
  readonly organizationBonusScore: number;
  readonly regionControlBonusScore: number;
  readonly scoreDelta: number;
  readonly sourceOrganizationUpgradeIds: readonly string[];
  readonly sourceRegionControlRegionIds: readonly string[];
  readonly agentScoreAfter: number;
  readonly factionScoreAfter: number;
  readonly totalScoreAfter: number;
  readonly trustClass: EpochTrustClass;
  readonly recordedAt: string;
}

export interface EpochSeasonAgentStanding {
  readonly agentId: string;
  readonly explorerId: string;
  readonly factionId: string;
  readonly amount: number;
  readonly score: number;
  readonly trustedScore: number;
  readonly dominantTrustClass: EpochTrustClass;
  readonly trustBreakdown: Partial<Record<EpochTrustClass, number>>;
}

export interface EpochSeasonFactionStanding {
  readonly factionId: string;
  readonly score: number;
  readonly trustedScore: number;
  readonly dominantTrustClass: EpochTrustClass;
  readonly trustBreakdown: Partial<Record<EpochTrustClass, number>>;
}

export interface EpochSeasonCampaign {
  readonly seasonId: string;
  readonly seasonKey: string;
  readonly title: string;
  readonly description: string;
  readonly regionIds: readonly string[];
  readonly factionIds: readonly string[];
  readonly resourceId: EpochResourceId;
  readonly targetScore: number;
  readonly reward: EpochServerReward;
  readonly createdAt: string;
  readonly status: EpochSeasonCampaignStatus;
  readonly phaseEvents: readonly EpochSeasonPhaseEvent[];
  readonly objectives: readonly EpochSeasonObjective[];
  readonly contributions: readonly EpochSeasonContribution[];
  readonly totalScore: number;
  readonly factionStandings: readonly EpochSeasonFactionStanding[];
  readonly agentStandings: readonly EpochSeasonAgentStanding[];
  readonly resolvedAt?: string;
  readonly winningFactionId?: string;
  readonly winnerAgentId?: string;
  readonly winnerExplorerId?: string;
  readonly winningScore?: number;
}

export interface EpochRegionControl {
  readonly regionId: string;
  readonly controllingFactionId: string;
  readonly previousControllingFactionId?: string;
  readonly controlScore: number;
  readonly contestedByFactionId?: string;
  readonly controlMargin: number;
  readonly sourceSeasonId: string;
  readonly sourceReleaseId?: string;
  readonly previousControlSourceSeasonId?: string;
  readonly claimingAgentId?: string;
  readonly claimingExplorerId?: string;
  readonly updatedAt: string;
}

export interface EpochRegionInfluenceChange {
  readonly influenceId: string;
  readonly regionId: string;
  readonly agentId: string;
  readonly explorerId: string;
  readonly influenceDelta: number;
  readonly influenceScoreAfter: number;
  readonly reason: string;
  readonly sourceEventId: string;
  readonly sourceEventType: RegionInfluenceSourceEventType;
  readonly sourceAggregateId: string;
  readonly changedAt: string;
  readonly worldMinute?: number;
}

export type EpochRegionControlDecay = ReturnType<typeof projectRegionControlDecays>[number];

export interface DecayRegionControlsInput {
  readonly limit?: number;
  readonly amount?: number;
  readonly minAgeSeconds?: number;
  readonly minScore?: number;
}

export interface ClaimReleasedRegionControlInput {
  readonly regionId: string;
  readonly seasonId: string;
  readonly factionId: string;
  readonly agentId?: string;
}

export type EpochRegionRevoltResult = ReturnType<typeof regionRevoltResolvedPayload>;

export interface ResolveRegionRevoltInput {
  readonly regionId: string;
  readonly seasonId: string;
  readonly factionId: string;
  readonly agentId: string;
  readonly staminaSpent: number;
}

export interface CreateSeasonCampaignInput {
  readonly seasonKey: string;
  readonly title: string;
  readonly description?: string;
  readonly regionIds: readonly string[];
  readonly factionIds: readonly string[];
  readonly resourceId: EpochResourceId;
  readonly targetScore: number;
  readonly reward: EpochServerReward;
  readonly objectives?: readonly EpochSeasonObjectiveTemplate[];
}

export interface ContributeSeasonCampaignInput {
  readonly seasonId: string;
  readonly agentId: string;
  readonly factionId: string;
  readonly amount: number;
}

export interface SettleSeasonCampaignInput {
  readonly seasonId: string;
}

// ---------------------------------------------------------------------------
// Context & factory
// ---------------------------------------------------------------------------

export interface GameCoreSeasonContext {
  readonly projection: () => EpochProjection;
  readonly commit: <T>(events: readonly EpochEvent[], value: T) => EpochCommandResult<T>;
  readonly applyEvents: (projection: EpochProjection, events: readonly EpochEvent[]) => EpochProjection;
  readonly clock: EpochClock;
  readonly idFactory: EpochIdFactory;
  readonly currentBalance: (projection: EpochProjection, agentId: string, resourceId: EpochResourceId) => number;
  readonly currentOrganizationTreasuryBalance: (projection: EpochProjection, organizationId: string, resourceId: EpochResourceId) => number;
}

function requireServerTrust(context: EpochCommandContext, errorCode: string) {
  const trustClass = normalizeTrustClass(context.trustClass);
  if (trustClass === "untrusted_client") throw new Error(errorCode);
  return trustClass;
}

export function createSeasonCommands(ctx: GameCoreSeasonContext) {
  function decayRegionControls(input: DecayRegionControlsInput, context: EpochCommandContext): EpochCommandResult<readonly EpochRegionControlDecay[]> {
    const trustClass = requireServerTrust(context, "region_control_decay_requires_server_trust");
    const current = ctx.projection();
    const amount = regionControlDecayAmount(input.amount);
    const decayedAt = serverIsoTime(ctx.clock);
    const makeEvent = eventFactory(ctx.clock, ctx.idFactory, { ...context, trustClass });
    const actorExplorerId = assertNonEmptyString(context.actorExplorerId, "actor_explorer_id");
    const decayedEvents = planRegionControlDecayEvents({
      targets: selectRegionControlDecayTargets(current.regionControls, { ...input, decayedAt }),
      amount,
      decayedBy: actorExplorerId,
      decayedAt,
      idFactory: ctx.idFactory,
      makeEvent,
    });
    if (decayedEvents.length === 0) return { events: [], value: [], projection: current };
    const values: readonly EpochRegionControlDecay[] = projectRegionControlDecays({ events: decayedEvents });
    return ctx.commit(decayedEvents, values);
  }

  function claimReleasedRegionControl(
    input: ClaimReleasedRegionControlInput,
    context: EpochCommandContext,
  ): EpochCommandResult<EpochRegionControl> {
    const trustClass = requireServerTrust(context, "region_control_claim_requires_server_trust");
    const current = ctx.projection();
    const regionId = assertNonEmptyString(input.regionId, "region_id");
    if (current.regionControls[regionId]) throw new Error("region_control_already_active");
    const releaseEvent = latestRegionControlReleaseEvent(current, regionId);
    if (!releaseEvent) throw new Error("region_control_release_required");
    const seasonId = assertNonEmptyString(input.seasonId, "season_id");
    const factionId = assertNonEmptyString(input.factionId, "faction_id");
    const campaign = requireSeasonCampaign(current, seasonId);
    if (!campaign.regionIds.includes(regionId)) throw new Error("region_control_claim_region_mismatch");
    if (!campaign.factionIds.includes(factionId)) throw new Error("region_control_claim_faction_mismatch");
    const factionStanding = campaign.factionStandings.find((standing) => standing.factionId === factionId);
    if (!factionStanding || factionStanding.score <= 0) throw new Error("region_control_claim_score_required");
    const agentId = input.agentId ? assertNonEmptyString(input.agentId, "agent_id") : undefined;
    const claimingIdentity = agentId ? requireActiveIdentity(current, agentId) : undefined;
    if (agentId) {
      const agentStanding = campaign.agentStandings.find((standing) =>
        standing.agentId === agentId
        && standing.factionId === factionId
        && standing.score > 0);
      if (!agentStanding) throw new Error("region_control_claim_agent_standing_required");
    }
    const contestedByFaction = campaign.factionStandings
      .filter((standing) => standing.factionId !== factionId && standing.score > 0)
      .sort((left, right) => right.score - left.score || left.factionId.localeCompare(right.factionId))[0];
    const claimedAt = serverIsoTime(ctx.clock);
    const makeEvent = eventFactory(ctx.clock, ctx.idFactory, { ...context, trustClass });
    const nextEvents = planReleasedRegionControlClaimEvents({
      makeEvent,
      regionId,
      controllingFactionId: factionId,
      previousControllingFactionId: releaseEvent.payload.previousControllingFactionId,
      controlScore: factionStanding.score,
      contestedByFaction,
      sourceSeasonId: seasonId,
      sourceReleaseId: releaseEvent.payload.releaseId,
      previousControlSourceSeasonId: releaseEvent.payload.sourceSeasonId,
      claimingAgentId: claimingIdentity?.agentId,
      claimingExplorerId: claimingIdentity?.explorerId,
      changedAt: claimedAt,
    });
    const nextProjection = ctx.applyEvents(current, nextEvents);
    return ctx.commit(nextEvents, projectReleasedRegionControlClaim({
      events: nextEvents,
      projection: nextProjection,
    }));
  }

  function resolveRegionRevolt(
    input: ResolveRegionRevoltInput,
    context: EpochCommandContext,
  ): EpochCommandResult<EpochRegionRevoltResult> {
    const current = ctx.projection();
    const regionId = assertNonEmptyString(input.regionId, "region_id");
    if (current.regionControls[regionId]) throw new Error("region_revolt_requires_released_control");
    const releaseEvent = latestRegionControlReleaseEvent(current, regionId);
    if (!releaseEvent) throw new Error("region_control_release_required");
    const seasonId = assertNonEmptyString(input.seasonId, "season_id");
    const factionId = assertNonEmptyString(input.factionId, "faction_id");
    const agentId = assertNonEmptyString(input.agentId, "agent_id");
    const rebel = requireActiveIdentity(current, agentId);
    assertIdentityOwner(rebel, context, "region_revolt_actor_owner_mismatch");
    const campaign = requireSeasonCampaign(current, seasonId);
    if (!campaign.regionIds.includes(regionId)) throw new Error("region_revolt_region_mismatch");
    if (!campaign.factionIds.includes(factionId)) throw new Error("region_revolt_faction_mismatch");
    const factionStanding = campaign.factionStandings.find((standing) => standing.factionId === factionId);
    if (!factionStanding || factionStanding.score <= 0) throw new Error("region_revolt_score_required");
    const agentStanding = campaign.agentStandings.find((standing) =>
      standing.agentId === agentId
      && standing.factionId === factionId
      && standing.score > 0);
    if (!agentStanding) throw new Error("region_revolt_agent_standing_required");
    const staminaSpent = assertPositiveInteger(input.staminaSpent, "region_revolt_stamina_spent");
    const staminaBalance = ctx.currentBalance(current, agentId, "stamina");
    if (staminaBalance < staminaSpent) throw new Error("resource_insufficient");
    const resolvedAt = serverIsoTime(ctx.clock);
    const settlement = regionRevoltSettlement({
      staminaSpent,
      agentStandingScore: agentStanding.score,
      previousControlScore: releaseEvent.payload.previousScore,
    });
    const revoltId = ctx.idFactory("region_revolt", `${regionId}:${seasonId}:${agentId}:${staminaSpent}:${resolvedAt}`);
    const makeEvent = eventFactory(ctx.clock, ctx.idFactory, context);
    const nextEvents = planRegionRevoltResolutionEvents({
      makeEvent,
      revoltId,
      regionId,
      sourceReleaseId: releaseEvent.payload.releaseId,
      previousControllingFactionId: releaseEvent.payload.previousControllingFactionId,
      previousControlSourceSeasonId: releaseEvent.payload.sourceSeasonId,
      rebelAgentId: agentId,
      rebelExplorerId: rebel.explorerId,
      rebelFactionId: factionId,
      sourceSeasonId: seasonId,
      factionScore: factionStanding.score,
      staminaSpent,
      settlement,
      resolvedAt,
      staminaBalanceBefore: staminaBalance,
      influenceId: ctx.idFactory("region_influence", `${regionId}:${revoltId}:${agentId}:revolt`),
      previousInfluenceScore: currentRegionInfluenceScore(current, regionId, agentId),
      traceId: ctx.idFactory("trace", `${regionId}:${revoltId}:revolt`),
      parentTraceId: latestTraceIdForRegion(current, regionId),
      ...(campaign.factionIds.includes(releaseEvent.payload.previousControllingFactionId)
        ? { contestedByFactionId: releaseEvent.payload.previousControllingFactionId }
        : {}),
    });
    return ctx.commit(nextEvents, projectRegionRevoltResolution({ events: nextEvents }));
  }

  function createSeasonCampaign(input: CreateSeasonCampaignInput, context: EpochCommandContext): EpochCommandResult<EpochSeasonCampaign> {
    const trustClass = requireServerTrust(context, "season_campaign_requires_server_trust");
    const current = ctx.projection();
    const seasonKey = stableKey(assertNonEmptyString(input.seasonKey, "season_key"));
    const title = assertNonEmptyString(input.title, "season_title");
    const regionIds = [...new Set(input.regionIds.map((regionId) => assertNonEmptyString(regionId, "season_region_id")))];
    const factionIds = [...new Set(input.factionIds.map((factionId) => assertNonEmptyString(factionId, "season_faction_id")))];
    if (regionIds.length === 0) throw new Error("season_regions_required");
    if (factionIds.length < 2) throw new Error("season_factions_required");
    const resourceId = assertResourceId(input.resourceId);
    const targetScore = assertPositiveInteger(input.targetScore, "season_target_score");
    const seasonId = ctx.idFactory("season", seasonKey);
    const existing = current.seasonCampaigns[seasonId];
    if (existing) return { events: [], value: existing, projection: current };
    const reward = normalizeObjectiveReward(input.reward);
    const objectiveTemplatesByKey = new Map<string, EpochSeasonObjectiveTemplate>();
    for (const objective of input.objectives || []) {
      const objectiveKey = stableKey(assertNonEmptyString(objective.objectiveKey, "season_objective_key"));
      objectiveTemplatesByKey.set(objectiveKey, {
        objectiveKey,
        title: assertNonEmptyString(objective.title, "season_objective_title"),
        description: objective.description.trim() || "赛季目标",
        targetScore: assertPositiveInteger(objective.targetScore, "season_objective_target_score"),
      });
    }
    const objectiveTemplates = [...objectiveTemplatesByKey.values()];
    const createdAt = serverIsoTime(ctx.clock);
    const makeEvent = eventFactory(ctx.clock, ctx.idFactory, { ...context, trustClass });
    const nextEvents = planSeasonCampaignCreationEvents({
      seasonId,
      seasonKey,
      title,
      description: input.description,
      regionIds,
      factionIds,
      resourceId,
      targetScore,
      reward,
      createdAt,
      objectiveTemplates,
      idFactory: ctx.idFactory,
      makeEvent,
    });
    const nextProjection = ctx.applyEvents(current, nextEvents);
    return ctx.commit(nextEvents, projectSeasonCampaignCreation({ events: nextEvents, projection: nextProjection }));
  }

  function contributeSeasonCampaign(
    input: ContributeSeasonCampaignInput,
    context: EpochCommandContext,
  ): EpochCommandResult<EpochSeasonCampaign> {
    const current = ctx.projection();
    const seasonId = assertNonEmptyString(input.seasonId, "season_id");
    const campaign = requireActiveSeasonCampaign(current, seasonId);
    const agentId = assertNonEmptyString(input.agentId, "agent_id");
    const identity = requireActiveIdentity(current, agentId);
    assertIdentityOwner(identity, context, "season_contributor_owner_mismatch");
    const factionId = assertNonEmptyString(input.factionId, "season_faction_id");
    if (!campaign.factionIds.includes(factionId)) throw new Error("season_faction_not_found");
    const amount = assertPositiveInteger(input.amount, "season_contribution_amount");
    const balance = ctx.currentBalance(current, agentId, campaign.resourceId);
    if (balance < amount) throw new Error("resource_insufficient");
    const sourceOrganizationUpgradeIds = activeOrganizationUpgradeIdsForAgentSeason(
      current,
      agentId,
      campaign.regionIds,
      "training_hall",
    );
    const sourceRegionControlRegionIds = regionControlBonusRegionIdsForSeasonContribution(current, {
      factionId,
      seasonRegionIds: campaign.regionIds,
    });
    const previousAgentScore = campaign.agentStandings.find((standing) =>
      standing.agentId === agentId && standing.factionId === factionId)?.score || 0;
    const previousFactionScore = campaign.factionStandings.find((standing) => standing.factionId === factionId)?.score || 0;
    const makeEvent = eventFactory(ctx.clock, ctx.idFactory, context);
    const nextEvents = planSeasonCampaignContributionEvents({
      seasonId,
      agentId,
      explorerId: identity.explorerId,
      factionId,
      resourceId: campaign.resourceId,
      amount,
      previousAgentScore,
      previousFactionScore,
      totalScore: campaign.totalScore,
      sourceOrganizationUpgradeIds,
      sourceRegionControlRegionIds,
      balanceBefore: balance,
      recordedAt: serverIsoTime(ctx.clock),
      objectives: campaign.objectives,
      makeEvent,
    });
    const nextProjection = ctx.applyEvents(current, nextEvents);
    return ctx.commit(nextEvents, projectSeasonCampaignContribution({ events: nextEvents, projection: nextProjection }));
  }

  function settleSeasonCampaign(input: SettleSeasonCampaignInput, context: EpochCommandContext): EpochCommandResult<EpochSeasonCampaign> {
    const trustClass = requireServerTrust(context, "season_campaign_settlement_requires_server_trust");
    const current = ctx.projection();
    const seasonId = assertNonEmptyString(input.seasonId, "season_id");
    const campaign = requireActiveSeasonCampaign(current, seasonId);
    const settlement = seasonCampaignSettlementPlan({
      factionStandings: campaign.factionStandings,
      agentStandings: campaign.agentStandings,
      reward: campaign.reward,
    });
    const { winningFaction, contestedByFaction, winner, reward } = settlement;
    const resolvedAt = serverIsoTime(ctx.clock);
    const makeEvent = eventFactory(ctx.clock, ctx.idFactory, { ...context, trustClass });
    const settlementOrganizations: SeasonSettlementOrganizationInput[] = [];
    if (winner && reward && winningFaction) {
      const winningOrganizationIds = uniqueValues(Object.values(current.organizationMemberships)
        .filter((membership): membership is EpochOrganizationMembership & { readonly agentId: string } =>
          membership.memberType === "agent"
          && membership.agentId === winner.agentId
          && membership.status === "active"
          && campaign.regionIds.includes(membership.regionId))
        .map((membership) => membership.organizationId))
        .sort((left, right) => left.localeCompare(right));
      for (const organizationId of winningOrganizationIds) {
        const organization = current.organizations[organizationId];
        if (!organization) continue;
        const activeAgentMemberships = (current.organizationMembershipIdsByOrganization[organizationId] || [])
          .map((membershipId) => current.organizationMemberships[membershipId])
          .filter((membership): membership is EpochOrganizationMembership & { readonly agentId: string } =>
            Boolean(membership)
            && membership.memberType === "agent"
            && typeof membership.agentId === "string"
            && membership.status === "active"
            && campaign.regionIds.includes(membership.regionId)
            && current.identities[membership.agentId]?.status === "active")
          .sort((left, right) => left.recordedAt.localeCompare(right.recordedAt) || left.membershipId.localeCompare(right.membershipId));
        const activeAgentIds = uniqueValues(activeAgentMemberships.map((membership) => membership.agentId))
          .sort((left, right) => left.localeCompare(right));
        settlementOrganizations.push({
          organizationId,
          organizationName: organization.displayName,
          regionId: organization.regionId,
          activeAgentIds,
          sourceEventIds: [
            ...activeAgentMemberships.flatMap((membership) => membership.sourceEventIds),
          ],
        });
      }
    }
    const regionControls = campaign.regionIds.map((regionId) => ({
      regionId,
      previousControllingFactionId: current.regionControls[regionId]?.controllingFactionId,
    }));
    const nextEvents = planSeasonCampaignSettlementEvents({
      seasonId,
      campaignTitle: campaign.title,
      settlement: {
        winningFaction,
        contestedByFaction,
        winner,
        reward,
      },
      organizations: settlementOrganizations,
      regionControls,
      resolvedAt,
      idFactory: ctx.idFactory,
      makeEvent,
      resourceBalanceBefore: (eventsSoFar, agentId, resourceId) =>
        ctx.currentBalance(ctx.applyEvents(current, eventsSoFar), agentId, resourceId),
      organizationTreasuryBalanceBefore: (eventsSoFar, organizationId, resourceId) =>
        ctx.currentOrganizationTreasuryBalance(ctx.applyEvents(current, eventsSoFar), organizationId, resourceId),
      organizationStandingBefore: (eventsSoFar, organizationId) =>
        ctx.applyEvents(current, eventsSoFar).organizationPoliticalStandingByOrganization[organizationId] || 0,
    });
    const nextProjection = ctx.applyEvents(current, nextEvents);
    return ctx.commit(nextEvents, projectSeasonCampaignSettlement({ events: nextEvents, projection: nextProjection }));
  }

  return {
    decayRegionControls,
    claimReleasedRegionControl,
    resolveRegionRevolt,
    createSeasonCampaign,
    contributeSeasonCampaign,
    settleSeasonCampaign,
  };
}

function uniqueValues(values: readonly string[]): string[] {
  return values.filter((value, index) => value && values.indexOf(value) === index);
}
