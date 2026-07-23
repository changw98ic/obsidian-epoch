import {
  type EpochEvent,
  type OrganizationPrestigeChangedPayload,
  type OrganizationTreasuryChangedPayload,
  type RegionControlChangedPayload,
  type RegionControlDecayedPayload,
  type RegionControlReleasedPayload,
  type RegionInfluenceChangedPayload,
  type RegionMonumentBuiltPayload,
  type RegionRevoltOutcome,
  type RegionRevoltResolvedPayload,
  type ResourceGrantedPayload,
  type ResourceSpentPayload,
  type SeasonCampaignCreatedPayload,
  type SeasonCampaignResolvedPayload,
  type SeasonContributionRecordedPayload,
  type SeasonObjectiveCreatedPayload,
  type SeasonObjectiveCompletedPayload,
  type SeasonResolvedPayload,
  type SeasonStartedPayload,
  type TraceCreatedPayload,
} from "./events.ts";
import type { EpochEventFactory } from "./eventFactory.ts";
import {
  regionInfluenceChangedEvent,
  traceCreatedEvent,
} from "./regionEventLedgerEvents.ts";
import { resourceGrantedEvent, resourceSpentEvent } from "./resourceLedgerEvents.ts";
import {
  type EpochIdFactory,
  type EpochResourceId,
  type EpochServerReward,
  type EpochTrustClass,
} from "./protocol.ts";
import { objectiveScoreDelta } from "./encounterRules.ts";

export const TRAINING_HALL_SEASON_BONUS_SCORE = 1;
export const REGION_CONTROL_SEASON_BONUS_SCORE = 1;
export const REGION_CONTROL_SEASON_BONUS_MAX_SCORE = 3;
export const REGION_REVOLT_DEFENDER_BASE_POWER = 2;

export const TRUSTED_SEASON_TRUST_CLASSES = new Set<EpochTrustClass>([
  "server_hosted_agent",
  "host_attested",
  "remote_attested_runner",
]);

export const SEASON_TRUST_CLASS_ORDER: readonly EpochTrustClass[] = [
  "remote_attested_runner",
  "host_attested",
  "server_hosted_agent",
  "user_verified_web",
  "system_worker",
  "untrusted_client",
];

export interface RegionControlForSeasonRules {
  readonly controllingFactionId?: string;
}

export interface SeasonAgentStandingForRules {
  readonly agentId: string;
  readonly factionId: string;
  readonly score: number;
}

export interface SeasonCampaignForRegionStandingRules {
  readonly seasonId: string;
  readonly createdAt: string;
  readonly agentStandings: readonly SeasonAgentStandingForRules[];
}

export interface SeasonRegionProjectionForRules<
  TRegionControl extends RegionControlForSeasonRules = RegionControlForSeasonRules,
  TSeasonCampaign extends SeasonCampaignForRegionStandingRules = SeasonCampaignForRegionStandingRules,
> {
  readonly regionControls: Readonly<Record<string, TRegionControl | undefined>>;
  readonly seasonCampaignIdsByRegion: Readonly<Record<string, readonly string[]>>;
  readonly seasonCampaigns: Readonly<Record<string, TSeasonCampaign | undefined>>;
}

export type RegionControlReleaseEventForRules = Extract<EpochEvent, { readonly eventType: "region_control_released" }>;

export interface RegionControlReleaseProjectionForRules {
  readonly events: readonly EpochEvent[];
}

export interface AgentSeasonStandingForRegion {
  readonly factionId: string;
  readonly score: number;
  readonly seasonCreatedAt: string;
  readonly seasonId: string;
}

export interface SeasonCampaignForRules {
  readonly status: string;
}

export interface SeasonCampaignProjectionForRules<TCampaign extends SeasonCampaignForRules = SeasonCampaignForRules> {
  readonly seasonCampaigns: Readonly<Record<string, TCampaign | undefined>>;
}

export interface SeasonCampaignCreatedPayloadInput {
  readonly seasonId: string;
  readonly seasonKey: string;
  readonly title: string;
  readonly description?: string;
  readonly regionIds: readonly string[];
  readonly factionIds: readonly string[];
  readonly resourceId: EpochResourceId;
  readonly targetScore: number;
  readonly reward: EpochServerReward;
  readonly createdAt: string;
}

export interface SeasonObjectiveTemplateForCreation {
  readonly objectiveKey: string;
  readonly title: string;
  readonly description: string;
  readonly targetScore: number;
}

export interface SeasonCampaignCreationEventsInput extends SeasonCampaignCreatedPayloadInput {
  readonly objectiveTemplates: readonly SeasonObjectiveTemplateForCreation[];
  readonly idFactory: EpochIdFactory;
  readonly makeEvent: EpochEventFactory;
}

export interface SeasonCampaignCreationProjectionInput<TCampaign extends SeasonCampaignForRules> {
  readonly projection: Pick<SeasonCampaignProjectionForRules<TCampaign>, "seasonCampaigns">;
  readonly events: readonly EpochEvent[];
}

export interface SeasonStartedPayloadInput {
  readonly campaign: SeasonCampaignCreatedPayload;
  readonly sourceEventId: string;
}

export interface SeasonObjectiveCreatedPayloadInput {
  readonly objectiveId: string;
  readonly seasonId: string;
  readonly objectiveKey: string;
  readonly title: string;
  readonly description: string;
  readonly targetScore: number;
  readonly createdAt: string;
}

export interface SeasonContributionPayloadInput {
  readonly seasonId: string;
  readonly agentId: string;
  readonly explorerId: string;
  readonly factionId: string;
  readonly resourceId: EpochResourceId;
  readonly amount: number;
  readonly previousAgentScore: number;
  readonly previousFactionScore: number;
  readonly totalScore: number;
  readonly sourceOrganizationUpgradeIds: readonly string[];
  readonly sourceRegionControlRegionIds: readonly string[];
  readonly recordedAt: string;
}

export interface SeasonCampaignContributionEventsInput extends SeasonContributionPayloadInput {
  readonly balanceBefore: number;
  readonly objectives: readonly SeasonObjectiveCompletionCandidate[];
  readonly makeEvent: EpochEventFactory;
}

export interface SeasonCampaignContributionProjectionInput<TCampaign extends SeasonCampaignForRules> {
  readonly projection: Pick<SeasonCampaignProjectionForRules<TCampaign>, "seasonCampaigns">;
  readonly events: readonly EpochEvent[];
}

export interface SeasonContributionSpendPayloadInput {
  readonly agentId: string;
  readonly seasonId: string;
  readonly factionId: string;
  readonly resourceId: EpochResourceId;
  readonly amount: number;
  readonly balanceBefore: number;
}

export interface SeasonObjectiveCompletionCandidate {
  readonly objectiveId: string;
  readonly status: "open" | "completed";
  readonly targetScore: number;
}

export interface SeasonObjectiveCompletionPayloadInput {
  readonly seasonId: string;
  readonly completedByAgentId: string;
  readonly completedByExplorerId: string;
  readonly completedByFactionId: string;
  readonly totalScoreAfter: number;
  readonly sourceEventId: string;
  readonly completedAt: string;
  readonly objectives: readonly SeasonObjectiveCompletionCandidate[];
}

export interface SeasonFactionStandingCandidate {
  readonly factionId: string;
  readonly score: number;
}

export interface SeasonAgentStandingCandidate {
  readonly agentId: string;
  readonly explorerId: string;
  readonly factionId: string;
}

export interface SeasonCampaignSettlementPlanInput {
  readonly factionStandings: readonly SeasonFactionStandingCandidate[];
  readonly agentStandings: readonly SeasonAgentStandingCandidate[];
  readonly reward: EpochServerReward;
}

export interface SeasonCampaignSettlementPlan {
  readonly winningFaction?: SeasonFactionStandingCandidate;
  readonly contestedByFaction?: SeasonFactionStandingCandidate;
  readonly winner?: SeasonAgentStandingCandidate;
  readonly reward?: EpochServerReward;
}

export interface SeasonCampaignResolvedPayloadInput {
  readonly seasonId: string;
  readonly resolvedAt: string;
  readonly winningFaction?: SeasonFactionStandingCandidate;
  readonly winner?: SeasonAgentStandingCandidate;
  readonly reward?: EpochServerReward;
}

export interface SeasonSettlementOrganizationInput {
  readonly organizationId: string;
  readonly organizationName: string;
  readonly regionId: string;
  readonly activeAgentIds: readonly string[];
  readonly sourceEventIds: readonly string[];
}

export interface SeasonSettlementRegionControlInput {
  readonly regionId: string;
  readonly previousControllingFactionId?: string;
}

export interface SeasonCampaignSettlementEventsInput {
  readonly seasonId: string;
  readonly campaignTitle: string;
  readonly settlement: SeasonCampaignSettlementPlan;
  readonly organizations: readonly SeasonSettlementOrganizationInput[];
  readonly regionControls: readonly SeasonSettlementRegionControlInput[];
  readonly resolvedAt: string;
  readonly idFactory: EpochIdFactory;
  readonly makeEvent: EpochEventFactory;
  readonly resourceBalanceBefore: (
    eventsSoFar: readonly EpochEvent[],
    agentId: string,
    resourceId: EpochResourceId,
  ) => number;
  readonly organizationTreasuryBalanceBefore: (
    eventsSoFar: readonly EpochEvent[],
    organizationId: string,
    resourceId: EpochResourceId,
  ) => number;
  readonly organizationStandingBefore: (
    eventsSoFar: readonly EpochEvent[],
    organizationId: string,
  ) => number;
}

export interface SeasonCampaignSettlementProjectionInput<TCampaign extends SeasonCampaignForRules> {
  readonly projection: Pick<SeasonCampaignProjectionForRules<TCampaign>, "seasonCampaigns">;
  readonly events: readonly EpochEvent[];
}

export interface SeasonCampaignRewardGrantPayloadInput {
  readonly agentId: string;
  readonly reward: EpochServerReward;
  readonly winnerRewardBalanceBefore: number;
}

export interface SeasonOrganizationDividendGrantPayloadInput {
  readonly agentId: string;
  readonly seasonId: string;
  readonly organizationId: string;
  readonly resourceId: EpochResourceId;
  readonly amount: number;
  readonly memberBalanceBefore: number;
}

export interface SeasonOrganizationTreasuryPayloadInput {
  readonly treasuryEventId: string;
  readonly organizationId: string;
  readonly organizationName: string;
  readonly regionId: string;
  readonly resourceId: EpochResourceId;
  readonly amount: number;
  readonly balanceAfter: number;
  readonly seasonId: string;
  readonly sourceEventIds: readonly string[];
  readonly recordedAt: string;
}

export interface SeasonOrganizationPrestigePayloadInput {
  readonly prestigeId: string;
  readonly organizationId: string;
  readonly organizationName: string;
  readonly regionId: string;
  readonly agentId: string;
  readonly standingDelta: number;
  readonly standingAfter: number;
  readonly seasonId: string;
  readonly sourceEventIds: readonly string[];
  readonly recordedAt: string;
}

export interface SeasonRegionControlPayloadInput {
  readonly regionId: string;
  readonly seasonId: string;
  readonly winningFaction: SeasonFactionStandingCandidate;
  readonly contestedByFaction?: SeasonFactionStandingCandidate;
  readonly previousControllingFactionId?: string;
  readonly changedAt: string;
}

export interface RegionControlDecayPayloadInput {
  readonly decayId: string;
  readonly regionId: string;
  readonly controllingFactionId: string;
  readonly previousScore: number;
  readonly scoreAfter: number;
  readonly previousControlMargin: number;
  readonly sourceSeasonId: string;
  readonly decayedBy: string;
  readonly decayedAt: string;
}

export interface RegionControlReleasePayloadInput {
  readonly releaseId: string;
  readonly regionId: string;
  readonly previousControllingFactionId: string;
  readonly previousScore: number;
  readonly sourceSeasonId: string;
  readonly releasedBy: string;
  readonly releasedAt: string;
}

export interface RegionControlDecaySelectionInput {
  readonly decayedAt: string;
  readonly limit?: number;
  readonly minAgeSeconds?: number;
  readonly minScore?: number;
}

export interface RegionControlDecayTargetLike {
  readonly regionId: string;
  readonly controlScore: number;
  readonly updatedAt: string;
}

export interface RegionControlDecayEventTarget extends RegionControlDecayTargetLike {
  readonly controllingFactionId: string;
  readonly controlMargin: number;
  readonly sourceSeasonId: string;
}

export interface RegionControlDecayEventsInput<
  TControl extends RegionControlDecayEventTarget = RegionControlDecayEventTarget,
> {
  readonly targets: readonly TControl[];
  readonly amount: number;
  readonly decayedBy: string;
  readonly decayedAt: string;
  readonly idFactory: EpochIdFactory;
  readonly makeEvent: EpochEventFactory;
}

export interface RegionControlDecayProjectionInput {
  readonly events: readonly EpochEvent[];
}

export interface ReleasedRegionClaimControlPayloadInput {
  readonly regionId: string;
  readonly controllingFactionId: string;
  readonly controlScore: number;
  readonly contestedByFaction?: SeasonFactionStandingCandidate;
  readonly sourceSeasonId: string;
  readonly sourceReleaseId: string;
  readonly previousControllingFactionId: string;
  readonly previousControlSourceSeasonId: string;
  readonly claimingAgentId?: string;
  readonly claimingExplorerId?: string;
  readonly changedAt: string;
}

export interface ReleasedRegionControlClaimEventsInput extends ReleasedRegionClaimControlPayloadInput {
  readonly makeEvent: EpochEventFactory;
}

export interface ReleasedRegionControlClaimProjectionInput<
  TRegionControl extends RegionControlForSeasonRules,
> {
  readonly projection: Pick<SeasonRegionProjectionForRules<TRegionControl>, "regionControls">;
  readonly events: readonly EpochEvent[];
}

export interface RegionRevoltSettlementInput {
  readonly staminaSpent: number;
  readonly agentStandingScore: number;
  readonly previousControlScore: number;
}

export interface RegionRevoltSettlement {
  readonly rebelPower: number;
  readonly defenderPower: number;
  readonly outcome: RegionRevoltOutcome;
}

export interface RegionRevoltStaminaSpendPayloadInput {
  readonly agentId: string;
  readonly revoltId: string;
  readonly staminaSpent: number;
  readonly staminaBalanceBefore: number;
}

export interface RegionRevoltResolvedPayloadInput {
  readonly revoltId: string;
  readonly regionId: string;
  readonly sourceReleaseId: string;
  readonly previousControllingFactionId: string;
  readonly previousControlSourceSeasonId: string;
  readonly rebelAgentId: string;
  readonly rebelExplorerId: string;
  readonly rebelFactionId: string;
  readonly sourceSeasonId: string;
  readonly factionScore: number;
  readonly staminaSpent: number;
  readonly settlement: RegionRevoltSettlement;
  readonly resolvedAt: string;
}

export interface RegionRevoltControlPayloadInput {
  readonly regionId: string;
  readonly controllingFactionId: string;
  readonly factionScore: number;
  readonly staminaSpent: number;
  readonly contestedByFactionId?: string;
  readonly settlement: RegionRevoltSettlement;
  readonly sourceSeasonId: string;
  readonly sourceReleaseId: string;
  readonly previousControllingFactionId: string;
  readonly previousControlSourceSeasonId: string;
  readonly claimingAgentId: string;
  readonly claimingExplorerId: string;
  readonly changedAt: string;
}

export interface RegionRevoltInfluencePayloadInput {
  readonly influenceId: string;
  readonly regionId: string;
  readonly revoltId: string;
  readonly rebelAgentId: string;
  readonly rebelExplorerId: string;
  readonly previousInfluenceScore: number;
  readonly sourceEventId: string;
  readonly settlement: RegionRevoltSettlement;
  readonly changedAt: string;
}

export interface RegionRevoltTracePayloadInput {
  readonly traceId: string;
  readonly regionId: string;
  readonly revoltId: string;
  readonly rebelAgentId: string;
  readonly rebelExplorerId: string;
  readonly rebelFactionId: string;
  readonly settlement: RegionRevoltSettlement;
  readonly sourceEventIds: readonly string[];
  readonly relatedInfluenceIds: readonly string[];
  readonly parentTraceId?: string;
  readonly createdAt: string;
}

export interface RegionRevoltResolutionEventsInput extends RegionRevoltResolvedPayloadInput {
  readonly makeEvent: EpochEventFactory;
  readonly staminaBalanceBefore: number;
  readonly influenceId: string;
  readonly previousInfluenceScore: number;
  readonly traceId: string;
  readonly parentTraceId?: string;
  readonly contestedByFactionId?: string;
}

export interface RegionRevoltResolutionProjectionInput {
  readonly events: readonly EpochEvent[];
}

export interface SeasonRegionMonumentPayloadInput {
  readonly monumentId: string;
  readonly regionId: string;
  readonly seasonId: string;
  readonly campaignTitle: string;
  readonly winningFactionId: string;
  readonly winner: SeasonAgentStandingCandidate;
  readonly controlScore: number;
  readonly builtAt: string;
}

export interface SeasonResolvedPayloadInput {
  readonly seasonId: string;
  readonly sourceEventId: string;
  readonly relatedEventIds: readonly string[];
  readonly winningFaction?: SeasonFactionStandingCandidate;
  readonly winner?: SeasonAgentStandingCandidate;
  readonly resolvedAt: string;
}

export function requireSeasonCampaign<TCampaign extends SeasonCampaignForRules>(
  projection: SeasonCampaignProjectionForRules<TCampaign>,
  seasonId: string,
): TCampaign {
  const campaign = projection.seasonCampaigns[seasonId];
  if (!campaign) throw new Error("season_campaign_not_found");
  return campaign;
}

export function requireActiveSeasonCampaign<TCampaign extends SeasonCampaignForRules>(
  projection: SeasonCampaignProjectionForRules<TCampaign>,
  seasonId: string,
): TCampaign {
  const campaign = requireSeasonCampaign(projection, seasonId);
  if (campaign.status !== "active") throw new Error("season_campaign_resolved");
  return campaign;
}

export function seasonCampaignCreatedPayload(input: SeasonCampaignCreatedPayloadInput): SeasonCampaignCreatedPayload {
  return {
    seasonId: input.seasonId,
    seasonKey: input.seasonKey,
    title: input.title,
    description: input.description?.trim() || "季节阵营战",
    regionIds: input.regionIds,
    factionIds: input.factionIds,
    resourceId: input.resourceId,
    targetScore: input.targetScore,
    reward: input.reward,
    createdAt: input.createdAt,
  };
}

export function seasonStartedPayload(input: SeasonStartedPayloadInput): SeasonStartedPayload {
  return {
    seasonId: input.campaign.seasonId,
    seasonKey: input.campaign.seasonKey,
    title: input.campaign.title,
    regionIds: input.campaign.regionIds,
    factionIds: input.campaign.factionIds,
    targetScore: input.campaign.targetScore,
    phase: "active",
    sourceEventId: input.sourceEventId,
    startedAt: input.campaign.createdAt,
  };
}

export function seasonObjectiveCreatedPayload(input: SeasonObjectiveCreatedPayloadInput): SeasonObjectiveCreatedPayload {
  return {
    objectiveId: input.objectiveId,
    seasonId: input.seasonId,
    objectiveKey: input.objectiveKey,
    title: input.title,
    description: input.description,
    targetScore: input.targetScore,
    createdAt: input.createdAt,
  };
}

export function planSeasonCampaignCreationEvents(input: SeasonCampaignCreationEventsInput): readonly EpochEvent[] {
  const campaignPayload = seasonCampaignCreatedPayload({
    seasonId: input.seasonId,
    seasonKey: input.seasonKey,
    title: input.title,
    description: input.description,
    regionIds: input.regionIds,
    factionIds: input.factionIds,
    resourceId: input.resourceId,
    targetScore: input.targetScore,
    reward: input.reward,
    createdAt: input.createdAt,
  });
  const created = input.makeEvent("season_campaign_created", input.seasonId, campaignPayload, {
    aggregateType: "season_campaign",
  });
  const started = input.makeEvent("season_started", input.seasonId, seasonStartedPayload({
    campaign: campaignPayload,
    sourceEventId: created.eventId,
  }), {
    aggregateType: "season_campaign",
  });
  const objectiveEvents = input.objectiveTemplates.map((objective) => {
    const objectiveId = input.idFactory("season_objective", `${input.seasonId}:${objective.objectiveKey}`);
    const objectivePayload = seasonObjectiveCreatedPayload({
      objectiveId,
      seasonId: input.seasonId,
      objectiveKey: objective.objectiveKey,
      title: objective.title,
      description: objective.description,
      targetScore: objective.targetScore,
      createdAt: campaignPayload.createdAt,
    });
    return input.makeEvent("season_objective_created", objectiveId, objectivePayload, {
      aggregateType: "season_objective",
    });
  });
  return [created, started, ...objectiveEvents];
}

export function projectSeasonCampaignCreation<TCampaign extends SeasonCampaignForRules>(
  input: SeasonCampaignCreationProjectionInput<TCampaign>,
): TCampaign {
  const created = input.events.find((event) => event.eventType === "season_campaign_created");
  if (!created || created.eventType !== "season_campaign_created") {
    throw new Error("season_campaign_created_event_missing");
  }
  const campaign = input.projection.seasonCampaigns[created.payload.seasonId];
  if (!campaign) throw new Error("season_campaign_projection_failed");
  return campaign;
}

export function seasonContributionOrganizationBonusScore(sourceOrganizationUpgradeIds: readonly string[]): number {
  return sourceOrganizationUpgradeIds.length > 0 ? TRAINING_HALL_SEASON_BONUS_SCORE : 0;
}

export function seasonContributionRegionControlBonusScore(sourceRegionControlRegionIds: readonly string[]): number {
  return Math.min(
    sourceRegionControlRegionIds.length * REGION_CONTROL_SEASON_BONUS_SCORE,
    REGION_CONTROL_SEASON_BONUS_MAX_SCORE,
  );
}

export function regionControlBonusRegionIdsForSeasonContribution(
  projection: Pick<SeasonRegionProjectionForRules, "regionControls">,
  input: { readonly factionId: string; readonly seasonRegionIds: readonly string[] },
): readonly string[] {
  return input.seasonRegionIds
    .filter((regionId) => projection.regionControls[regionId]?.controllingFactionId === input.factionId)
    .sort((left, right) => left.localeCompare(right));
}

export function agentSeasonStandingForRegion(
  projection: Pick<SeasonRegionProjectionForRules, "seasonCampaignIdsByRegion" | "seasonCampaigns">,
  input: { readonly regionId: string; readonly agentId: string },
): AgentSeasonStandingForRegion | undefined {
  let selected: AgentSeasonStandingForRegion | undefined;
  for (const seasonId of projection.seasonCampaignIdsByRegion[input.regionId] || []) {
    const season = projection.seasonCampaigns[seasonId];
    if (!season) continue;
    for (const standing of season.agentStandings) {
      if (standing.agentId !== input.agentId || standing.score <= 0) continue;
      if (
        !selected
        || standing.score > selected.score
        || (
          standing.score === selected.score
          && (
            season.createdAt > selected.seasonCreatedAt
            || (season.createdAt === selected.seasonCreatedAt && season.seasonId > selected.seasonId)
          )
        )
      ) {
        selected = {
          factionId: standing.factionId,
          score: standing.score,
          seasonCreatedAt: season.createdAt,
          seasonId: season.seasonId,
        };
      }
    }
  }
  return selected;
}

export function normalizeSeasonTrustBreakdown(
  breakdown: Partial<Record<EpochTrustClass, number>> | undefined,
): Partial<Record<EpochTrustClass, number>> {
  const next: Partial<Record<EpochTrustClass, number>> = {};
  for (const trustClass of SEASON_TRUST_CLASS_ORDER) {
    const score = breakdown?.[trustClass];
    if (typeof score === "number" && Number.isFinite(score) && score > 0) next[trustClass] = score;
  }
  return next;
}

export function dominantSeasonTrustClass(breakdown: Partial<Record<EpochTrustClass, number>>): EpochTrustClass {
  let dominant: EpochTrustClass = "untrusted_client";
  let dominantScore = -1;
  for (const trustClass of SEASON_TRUST_CLASS_ORDER) {
    const score = breakdown[trustClass] || 0;
    if (score > dominantScore) {
      dominant = trustClass;
      dominantScore = score;
    }
  }
  return dominant;
}

export function addSeasonTrustScore(
  breakdown: Partial<Record<EpochTrustClass, number>> | undefined,
  trustClass: EpochTrustClass,
  scoreDelta: number,
): Partial<Record<EpochTrustClass, number>> {
  const next = normalizeSeasonTrustBreakdown(breakdown);
  if (scoreDelta > 0) next[trustClass] = (next[trustClass] || 0) + scoreDelta;
  return next;
}

export function trustedSeasonScoreDelta(trustClass: EpochTrustClass, scoreDelta: number): number {
  return TRUSTED_SEASON_TRUST_CLASSES.has(trustClass) ? scoreDelta : 0;
}

export function seasonContributionPayload(
  input: SeasonContributionPayloadInput,
): SeasonContributionRecordedPayload {
  const baseScoreDelta = objectiveScoreDelta(input.resourceId, input.amount);
  const organizationBonusScore = seasonContributionOrganizationBonusScore(input.sourceOrganizationUpgradeIds);
  const regionControlBonusScore = seasonContributionRegionControlBonusScore(input.sourceRegionControlRegionIds);
  const scoreDelta = baseScoreDelta + organizationBonusScore + regionControlBonusScore;
  return {
    seasonId: input.seasonId,
    agentId: input.agentId,
    explorerId: input.explorerId,
    factionId: input.factionId,
    resourceId: input.resourceId,
    amount: input.amount,
    baseScoreDelta,
    organizationBonusScore,
    regionControlBonusScore,
    scoreDelta,
    sourceOrganizationUpgradeIds: input.sourceOrganizationUpgradeIds,
    sourceRegionControlRegionIds: input.sourceRegionControlRegionIds,
    agentScoreAfter: input.previousAgentScore + scoreDelta,
    factionScoreAfter: input.previousFactionScore + scoreDelta,
    totalScoreAfter: input.totalScore + scoreDelta,
    recordedAt: input.recordedAt,
  };
}

export function seasonContributionSpendPayload(input: SeasonContributionSpendPayloadInput): ResourceSpentPayload {
  return {
    resourceId: input.resourceId,
    amount: input.amount,
    reason: `season_contribution:${input.seasonId}:${input.factionId}`,
    balanceAfter: input.balanceBefore - input.amount,
    accountRef: `agent:${input.agentId}`,
    assetKey: `resource:${input.resourceId}`,
    unit: "unit",
    quantityMinor: (BigInt(input.amount) * 100n).toString(),
  };
}

export function planSeasonCampaignContributionEvents(
  input: SeasonCampaignContributionEventsInput,
): readonly EpochEvent[] {
  const spent = resourceSpentEvent(input.makeEvent, input.agentId, seasonContributionSpendPayload({
    agentId: input.agentId,
    seasonId: input.seasonId,
    factionId: input.factionId,
    resourceId: input.resourceId,
    amount: input.amount,
    balanceBefore: input.balanceBefore,
  }));
  const contributionPayload = seasonContributionPayload({
    seasonId: input.seasonId,
    agentId: input.agentId,
    explorerId: input.explorerId,
    factionId: input.factionId,
    resourceId: input.resourceId,
    amount: input.amount,
    previousAgentScore: input.previousAgentScore,
    previousFactionScore: input.previousFactionScore,
    totalScore: input.totalScore,
    sourceOrganizationUpgradeIds: input.sourceOrganizationUpgradeIds,
    sourceRegionControlRegionIds: input.sourceRegionControlRegionIds,
    recordedAt: input.recordedAt,
  });
  const contributed = input.makeEvent("season_contribution_recorded", input.seasonId, contributionPayload, {
    aggregateType: "season_campaign",
    agentId: input.agentId,
  });
  const objectiveCompletedEvents = seasonObjectiveCompletionPayloads({
    seasonId: input.seasonId,
    completedByAgentId: input.agentId,
    completedByExplorerId: input.explorerId,
    completedByFactionId: input.factionId,
    totalScoreAfter: contributionPayload.totalScoreAfter,
    sourceEventId: contributed.eventId,
    completedAt: contributionPayload.recordedAt,
    objectives: input.objectives,
  }).map((completedPayload) =>
    input.makeEvent("season_objective_completed", completedPayload.objectiveId, completedPayload, {
      aggregateType: "season_objective",
      agentId: input.agentId,
    }));
  return [spent, contributed, ...objectiveCompletedEvents];
}

export function projectSeasonCampaignContribution<TCampaign extends SeasonCampaignForRules>(
  input: SeasonCampaignContributionProjectionInput<TCampaign>,
): TCampaign {
  const contributed = input.events.find((event) => event.eventType === "season_contribution_recorded");
  if (!contributed || contributed.eventType !== "season_contribution_recorded") {
    throw new Error("season_contribution_recorded_event_missing");
  }
  const campaign = input.projection.seasonCampaigns[contributed.payload.seasonId];
  if (!campaign) throw new Error("season_campaign_projection_failed");
  return campaign;
}

export function seasonObjectiveCompletionPayloads(
  input: SeasonObjectiveCompletionPayloadInput,
): SeasonObjectiveCompletedPayload[] {
  return input.objectives
    .filter((objective) => objective.status === "open" && input.totalScoreAfter >= objective.targetScore)
    .map((objective) => ({
      objectiveId: objective.objectiveId,
      seasonId: input.seasonId,
      completedByAgentId: input.completedByAgentId,
      completedByExplorerId: input.completedByExplorerId,
      completedByFactionId: input.completedByFactionId,
      progressScore: objective.targetScore,
      targetScore: objective.targetScore,
      sourceEventId: input.sourceEventId,
      completedAt: input.completedAt,
    }));
}

export function seasonCampaignSettlementPlan(input: SeasonCampaignSettlementPlanInput): SeasonCampaignSettlementPlan {
  const winningFaction = input.factionStandings[0]?.score > 0 ? input.factionStandings[0] : undefined;
  const contestedByFaction = winningFaction
    ? input.factionStandings.find((standing) => standing.factionId !== winningFaction.factionId)
    : undefined;
  const winner = winningFaction
    ? input.agentStandings.find((standing) => standing.factionId === winningFaction.factionId)
    : undefined;
  return {
    winningFaction,
    contestedByFaction,
    winner,
    reward: winner ? input.reward : undefined,
  };
}

export function seasonCampaignResolvedPayload(
  input: SeasonCampaignResolvedPayloadInput,
): SeasonCampaignResolvedPayload {
  return {
    seasonId: input.seasonId,
    resolvedAt: input.resolvedAt,
    winningFactionId: input.winningFaction?.factionId,
    winnerAgentId: input.winner?.agentId,
    winnerExplorerId: input.winner?.explorerId,
    winningScore: input.winningFaction?.score || 0,
    reward: input.reward,
  };
}

export function planSeasonCampaignSettlementEvents(
  input: SeasonCampaignSettlementEventsInput,
): readonly EpochEvent[] {
  const { winningFaction, contestedByFaction, winner, reward } = input.settlement;
  const resolvedPayload = seasonCampaignResolvedPayload({
    seasonId: input.seasonId,
    resolvedAt: input.resolvedAt,
    winningFaction,
    winner,
    reward,
  });
  const resolved = input.makeEvent("season_campaign_resolved", input.seasonId, resolvedPayload, {
    aggregateType: "season_campaign",
  });
  const nextEvents: EpochEvent[] = [resolved];
  if (winner && reward) {
    nextEvents.push(resourceGrantedEvent(input.makeEvent, winner.agentId, seasonCampaignRewardGrantPayload({
      agentId: winner.agentId,
      reward,
      winnerRewardBalanceBefore: input.resourceBalanceBefore(nextEvents, winner.agentId, reward.resourceId),
    })));
  }
  if (winner && reward && winningFaction) {
    const organizationDividendAmount = seasonOrganizationDividendAmount(reward.amount);
    const prestigeDelta = seasonOrganizationPrestigeDelta(winningFaction.score);
    for (const organization of input.organizations) {
      for (const memberAgentId of organization.activeAgentIds) {
        nextEvents.push(resourceGrantedEvent(input.makeEvent, memberAgentId, seasonOrganizationDividendGrantPayload({
          agentId: memberAgentId,
          seasonId: input.seasonId,
          organizationId: organization.organizationId,
          resourceId: reward.resourceId,
          amount: organizationDividendAmount,
          memberBalanceBefore: input.resourceBalanceBefore(nextEvents, memberAgentId, reward.resourceId),
        })));
      }
      const treasuryEventId = input.idFactory(
        "organization_politics",
        `${organization.organizationId}:${input.seasonId}:treasury:${reward.resourceId}`,
      );
      const treasuryPayload = seasonOrganizationTreasuryPayload({
        treasuryEventId,
        organizationId: organization.organizationId,
        organizationName: organization.organizationName,
        regionId: organization.regionId,
        resourceId: reward.resourceId,
        amount: reward.amount,
        balanceAfter: input.organizationTreasuryBalanceBefore(
          nextEvents,
          organization.organizationId,
          reward.resourceId,
        ) + reward.amount,
        seasonId: input.seasonId,
        sourceEventIds: [
          resolved.eventId,
          ...organization.sourceEventIds,
        ],
        recordedAt: input.resolvedAt,
      });
      nextEvents.push(input.makeEvent("organization_treasury_changed", treasuryEventId, treasuryPayload, {
        aggregateType: "organization",
        agentId: winner.agentId,
      }));
      const prestigeId = input.idFactory(
        "organization_politics",
        `${organization.organizationId}:${input.seasonId}:season_prestige`,
      );
      const prestigePayload = seasonOrganizationPrestigePayload({
        prestigeId,
        organizationId: organization.organizationId,
        organizationName: organization.organizationName,
        regionId: organization.regionId,
        agentId: winner.agentId,
        standingDelta: prestigeDelta,
        standingAfter: input.organizationStandingBefore(nextEvents, organization.organizationId) + prestigeDelta,
        seasonId: input.seasonId,
        sourceEventIds: [
          resolved.eventId,
          ...organization.sourceEventIds,
        ],
        recordedAt: input.resolvedAt,
      });
      nextEvents.push(input.makeEvent("organization_prestige_changed", prestigeId, prestigePayload, {
        aggregateType: "organization_politics",
        agentId: winner.agentId,
      }));
    }
  }
  if (winningFaction) {
    for (const regionControl of input.regionControls) {
      const controlPayload = seasonRegionControlPayload({
        regionId: regionControl.regionId,
        previousControllingFactionId: regionControl.previousControllingFactionId,
        seasonId: input.seasonId,
        winningFaction,
        contestedByFaction,
        changedAt: input.resolvedAt,
      });
      nextEvents.push(input.makeEvent("region_control_changed", regionControl.regionId, controlPayload, {
        aggregateType: "region",
      }));
      if (winner) {
        const monumentId = input.idFactory(
          "monument",
          `${regionControl.regionId}:${input.seasonId}:${winningFaction.factionId}`,
        );
        const monumentPayload = seasonRegionMonumentPayload({
          monumentId,
          regionId: regionControl.regionId,
          seasonId: input.seasonId,
          campaignTitle: input.campaignTitle,
          winningFactionId: winningFaction.factionId,
          winner,
          controlScore: winningFaction.score,
          builtAt: input.resolvedAt,
        });
        nextEvents.push(input.makeEvent("region_monument_built", monumentId, monumentPayload, {
          aggregateType: "region_monument",
        }));
      }
    }
  }
  const phasePayload = seasonResolvedPayload({
    seasonId: input.seasonId,
    sourceEventId: resolved.eventId,
    relatedEventIds: nextEvents.slice(1).map((event) => event.eventId),
    winningFaction,
    winner,
    resolvedAt: input.resolvedAt,
  });
  nextEvents.push(input.makeEvent("season_resolved", input.seasonId, phasePayload, {
    aggregateType: "season_campaign",
  }));
  return nextEvents;
}

export function projectSeasonCampaignSettlement<TCampaign extends SeasonCampaignForRules>(
  input: SeasonCampaignSettlementProjectionInput<TCampaign>,
): TCampaign {
  const resolved = input.events.find((event) => event.eventType === "season_campaign_resolved");
  if (!resolved || resolved.eventType !== "season_campaign_resolved") {
    throw new Error("season_campaign_resolved_event_missing");
  }
  const campaign = input.projection.seasonCampaigns[resolved.payload.seasonId];
  if (!campaign) throw new Error("season_campaign_projection_failed");
  return campaign;
}

export function seasonCampaignRewardGrantPayload(input: SeasonCampaignRewardGrantPayloadInput): ResourceGrantedPayload {
  return {
    resourceId: input.reward.resourceId,
    amount: input.reward.amount,
    reason: input.reward.reason,
    balanceAfter: input.winnerRewardBalanceBefore + input.reward.amount,
    accountRef: `agent:${input.agentId}`,
    assetKey: `resource:${input.reward.resourceId}`,
    unit: "unit",
    quantityMinor: (BigInt(input.reward.amount) * 100n).toString(),
  };
}

export function seasonOrganizationDividendAmount(rewardAmount: number): number {
  return Math.max(1, Math.floor(rewardAmount / 2));
}

export function seasonOrganizationPrestigeDelta(winningScore: number): number {
  return Math.max(1, winningScore);
}

export function seasonOrganizationDividendGrantPayload(
  input: SeasonOrganizationDividendGrantPayloadInput,
): ResourceGrantedPayload {
  return {
    resourceId: input.resourceId,
    amount: input.amount,
    reason: `organization_season_dividend:${input.seasonId}:${input.organizationId}`,
    balanceAfter: input.memberBalanceBefore + input.amount,
    accountRef: `agent:${input.agentId}`,
    assetKey: `resource:${input.resourceId}`,
    unit: "unit",
    quantityMinor: (BigInt(input.amount) * 100n).toString(),
  };
}

export function seasonOrganizationTreasuryPayload(
  input: SeasonOrganizationTreasuryPayloadInput,
): OrganizationTreasuryChangedPayload {
  return {
    treasuryEventId: input.treasuryEventId,
    organizationId: input.organizationId,
    organizationName: input.organizationName,
    regionId: input.regionId,
    resourceId: input.resourceId,
    amountDelta: input.amount,
    balanceAfter: input.balanceAfter,
    reason: `season_campaign:${input.seasonId}`,
    sourceSeasonId: input.seasonId,
    sourceEventIds: uniqueValues(input.sourceEventIds),
    recordedAt: input.recordedAt,
  };
}

export function seasonOrganizationPrestigePayload(
  input: SeasonOrganizationPrestigePayloadInput,
): OrganizationPrestigeChangedPayload {
  return {
    prestigeId: input.prestigeId,
    organizationId: input.organizationId,
    organizationName: input.organizationName,
    regionId: input.regionId,
    agentId: input.agentId,
    sourceSeasonId: input.seasonId,
    standingDelta: input.standingDelta,
    standingAfter: input.standingAfter,
    reason: `season_campaign:${input.seasonId}`,
    sourceEventIds: uniqueValues(input.sourceEventIds),
    recordedAt: input.recordedAt,
  };
}

export function seasonRegionControlPayload(input: SeasonRegionControlPayloadInput): RegionControlChangedPayload {
  return {
    regionId: input.regionId,
    controllingFactionId: input.winningFaction.factionId,
    previousControllingFactionId: input.previousControllingFactionId,
    controlScore: input.winningFaction.score,
    contestedByFactionId: input.contestedByFaction?.factionId,
    controlMargin: Math.max(0, input.winningFaction.score - (input.contestedByFaction?.score || 0)),
    sourceSeasonId: input.seasonId,
    changedAt: input.changedAt,
  };
}

export function regionControlScoreAfter(previousScore: number, amount: number): number {
  return Math.max(0, previousScore - amount);
}

export function regionControlDecayLimit(value: number | undefined): number {
  return Math.max(0, Math.min(Math.floor(Number(value ?? 25)), 100));
}

export function regionControlDecayAmount(value: number | undefined): number {
  return Math.max(1, Math.min(Math.floor(Number(value ?? 1)), 100));
}

export function regionControlDecayMinAgeSeconds(value: number | undefined): number {
  return Math.max(
    0,
    Math.min(Math.floor(Number(value ?? (7 * 24 * 60 * 60))), 365 * 24 * 60 * 60),
  );
}

export function regionControlDecayMinScore(value: number | undefined): number {
  return Math.max(1, Math.floor(Number(value ?? 1)));
}

export function selectRegionControlDecayTargets<TControl extends RegionControlDecayTargetLike>(
  controlsByRegionId: Readonly<Record<string, TControl>>,
  input: RegionControlDecaySelectionInput,
): readonly TControl[] {
  const limit = regionControlDecayLimit(input.limit);
  const minAgeSeconds = regionControlDecayMinAgeSeconds(input.minAgeSeconds);
  const minScore = regionControlDecayMinScore(input.minScore);
  const cutoff = new Date(Date.parse(input.decayedAt) - (minAgeSeconds * 1_000)).toISOString();
  return Object.values(controlsByRegionId)
    .filter((control) => control.controlScore >= minScore && control.updatedAt <= cutoff)
    .sort((left, right) => left.updatedAt.localeCompare(right.updatedAt) || left.regionId.localeCompare(right.regionId))
    .slice(0, limit);
}

export function regionControlDecayPayload(input: RegionControlDecayPayloadInput): RegionControlDecayedPayload {
  const decayAmount = input.previousScore - input.scoreAfter;
  return {
    decayId: input.decayId,
    regionId: input.regionId,
    controllingFactionId: input.controllingFactionId,
    previousScore: input.previousScore,
    scoreAfter: input.scoreAfter,
    decayAmount,
    previousControlMargin: input.previousControlMargin,
    controlMarginAfter: Math.max(0, input.previousControlMargin - decayAmount),
    sourceSeasonId: input.sourceSeasonId,
    decayedBy: input.decayedBy,
    decayedAt: input.decayedAt,
    reason: "maintenance_decay",
  };
}

export function regionControlReleasePayload(input: RegionControlReleasePayloadInput): RegionControlReleasedPayload {
  return {
    releaseId: input.releaseId,
    regionId: input.regionId,
    previousControllingFactionId: input.previousControllingFactionId,
    previousScore: input.previousScore,
    sourceSeasonId: input.sourceSeasonId,
    releasedBy: input.releasedBy,
    releasedAt: input.releasedAt,
    reason: "maintenance_decay_zero",
  };
}

export function planRegionControlDecayEvents(input: RegionControlDecayEventsInput): readonly EpochEvent[] {
  return input.targets.flatMap((control) => {
    const scoreAfter = regionControlScoreAfter(control.controlScore, input.amount);
    const payload = regionControlDecayPayload({
      decayId: input.idFactory("region_control_decay", `${control.regionId}:${control.sourceSeasonId}:${scoreAfter}`),
      regionId: control.regionId,
      controllingFactionId: control.controllingFactionId,
      previousScore: control.controlScore,
      scoreAfter,
      previousControlMargin: control.controlMargin,
      sourceSeasonId: control.sourceSeasonId,
      decayedBy: input.decayedBy,
      decayedAt: input.decayedAt,
    });
    const decayEvent = input.makeEvent("region_control_decayed", control.regionId, payload, {
      aggregateType: "region",
    });
    if (scoreAfter > 0) return [decayEvent];
    const releasePayload = regionControlReleasePayload({
      releaseId: input.idFactory("region_control_release", `${control.regionId}:${control.sourceSeasonId}:${input.decayedAt}`),
      regionId: control.regionId,
      previousControllingFactionId: control.controllingFactionId,
      previousScore: control.controlScore,
      sourceSeasonId: control.sourceSeasonId,
      releasedBy: input.decayedBy,
      releasedAt: input.decayedAt,
    });
    const releaseEvent = input.makeEvent("region_control_released", control.regionId, releasePayload, {
      aggregateType: "region",
    });
    return [decayEvent, releaseEvent];
  });
}

export function projectRegionControlDecays(
  input: RegionControlDecayProjectionInput,
): readonly RegionControlDecayedPayload[] {
  return input.events
    .filter((event): event is Extract<EpochEvent, { readonly eventType: "region_control_decayed" }> =>
      event.eventType === "region_control_decayed")
    .map((event) => event.payload);
}

export function latestRegionControlReleaseEvent(
  projection: RegionControlReleaseProjectionForRules,
  regionId: string,
): RegionControlReleaseEventForRules | undefined {
  return [...projection.events]
    .reverse()
    .find((event): event is RegionControlReleaseEventForRules =>
      event.eventType === "region_control_released" && event.payload.regionId === regionId);
}

export function releasedRegionClaimControlPayload(
  input: ReleasedRegionClaimControlPayloadInput,
): RegionControlChangedPayload {
  return {
    regionId: input.regionId,
    controllingFactionId: input.controllingFactionId,
    previousControllingFactionId: input.previousControllingFactionId,
    controlScore: input.controlScore,
    contestedByFactionId: input.contestedByFaction?.factionId,
    controlMargin: Math.max(0, input.controlScore - (input.contestedByFaction?.score || 0)),
    sourceSeasonId: input.sourceSeasonId,
    sourceReleaseId: input.sourceReleaseId,
    previousControlSourceSeasonId: input.previousControlSourceSeasonId,
    claimingAgentId: input.claimingAgentId,
    claimingExplorerId: input.claimingExplorerId,
    reason: "released_region_claim",
    changedAt: input.changedAt,
  };
}

export function planReleasedRegionControlClaimEvents(
  input: ReleasedRegionControlClaimEventsInput,
): readonly EpochEvent[] {
  const claimed = input.makeEvent("region_control_changed", input.regionId, releasedRegionClaimControlPayload(input), {
    aggregateType: "region",
    agentId: input.claimingAgentId,
  });
  return [claimed];
}

export function projectReleasedRegionControlClaim<TRegionControl extends RegionControlForSeasonRules>(
  input: ReleasedRegionControlClaimProjectionInput<TRegionControl>,
): TRegionControl {
  const changed = input.events.find((event) => event.eventType === "region_control_changed");
  if (!changed || changed.eventType !== "region_control_changed") {
    throw new Error("region_control_changed_event_missing");
  }
  const regionControl = input.projection.regionControls[changed.payload.regionId];
  if (!regionControl) throw new Error("region_control_projection_failed");
  return regionControl;
}

export function regionRevoltSettlement(input: RegionRevoltSettlementInput): RegionRevoltSettlement {
  const rebelPower = (input.staminaSpent * 2) + input.agentStandingScore;
  const defenderPower = input.previousControlScore + REGION_REVOLT_DEFENDER_BASE_POWER;
  return {
    rebelPower,
    defenderPower,
    outcome: rebelPower > defenderPower ? "revolt_succeeded" : "revolt_defended",
  };
}

export function regionRevoltStaminaSpendPayload(input: RegionRevoltStaminaSpendPayloadInput): ResourceSpentPayload {
  return {
    resourceId: "stamina",
    amount: input.staminaSpent,
    reason: `region_revolt:${input.revoltId}`,
    balanceAfter: input.staminaBalanceBefore - input.staminaSpent,
    accountRef: `agent:${input.agentId}`,
    assetKey: "resource:stamina",
    unit: "unit",
    quantityMinor: (BigInt(input.staminaSpent) * 100n).toString(),
  };
}

export function regionRevoltInfluenceDelta(outcome: RegionRevoltOutcome): number {
  return outcome === "revolt_succeeded" ? 10 : 2;
}

export function regionRevoltResolvedPayload(input: RegionRevoltResolvedPayloadInput): RegionRevoltResolvedPayload {
  return {
    revoltId: input.revoltId,
    regionId: input.regionId,
    sourceReleaseId: input.sourceReleaseId,
    previousControllingFactionId: input.previousControllingFactionId,
    previousControlSourceSeasonId: input.previousControlSourceSeasonId,
    rebelAgentId: input.rebelAgentId,
    rebelExplorerId: input.rebelExplorerId,
    rebelFactionId: input.rebelFactionId,
    sourceSeasonId: input.sourceSeasonId,
    factionScore: input.factionScore,
    staminaSpent: input.staminaSpent,
    rebelPower: input.settlement.rebelPower,
    defenderPower: input.settlement.defenderPower,
    outcome: input.settlement.outcome,
    resolvedAt: input.resolvedAt,
  };
}

export function regionRevoltInfluencePayload(
  input: RegionRevoltInfluencePayloadInput,
): RegionInfluenceChangedPayload {
  const influenceDelta = regionRevoltInfluenceDelta(input.settlement.outcome);
  return {
    influenceId: input.influenceId,
    regionId: input.regionId,
    agentId: input.rebelAgentId,
    explorerId: input.rebelExplorerId,
    influenceDelta,
    influenceScoreAfter: input.previousInfluenceScore + influenceDelta,
    reason: `region_revolt:${input.revoltId}`,
    sourceEventId: input.sourceEventId,
    sourceEventType: "region_revolt_resolved",
    sourceAggregateId: input.revoltId,
    changedAt: input.changedAt,
  };
}

export function regionRevoltTracePayload(input: RegionRevoltTracePayloadInput): TraceCreatedPayload {
  return {
    traceId: input.traceId,
    regionId: input.regionId,
    title: `区域起义 ${input.revoltId}`,
    summary: `${input.rebelAgentId} 代表 ${input.rebelFactionId} 发起区域起义，结果 ${input.settlement.outcome}。`,
    sourceEventType: "region_revolt_resolved",
    sourceEventIds: input.sourceEventIds,
    sourceAggregateId: input.revoltId,
    relatedInfluenceIds: input.relatedInfluenceIds,
    participantAgentIds: [input.rebelAgentId],
    participantExplorerIds: [input.rebelExplorerId],
    parentTraceId: input.parentTraceId,
    createdAt: input.createdAt,
  };
}

export function regionRevoltControlPayload(input: RegionRevoltControlPayloadInput): RegionControlChangedPayload {
  return {
    regionId: input.regionId,
    controllingFactionId: input.controllingFactionId,
    previousControllingFactionId: input.previousControllingFactionId,
    controlScore: input.factionScore + input.staminaSpent,
    contestedByFactionId: input.contestedByFactionId,
    controlMargin: Math.max(0, input.settlement.rebelPower - input.settlement.defenderPower),
    sourceSeasonId: input.sourceSeasonId,
    sourceReleaseId: input.sourceReleaseId,
    previousControlSourceSeasonId: input.previousControlSourceSeasonId,
    claimingAgentId: input.claimingAgentId,
    claimingExplorerId: input.claimingExplorerId,
    reason: "released_region_revolt",
    changedAt: input.changedAt,
  };
}

export function planRegionRevoltResolutionEvents(input: RegionRevoltResolutionEventsInput): readonly EpochEvent[] {
  const staminaSpentEvent = resourceSpentEvent(input.makeEvent, input.rebelAgentId, regionRevoltStaminaSpendPayload({
    agentId: input.rebelAgentId,
    revoltId: input.revoltId,
    staminaSpent: input.staminaSpent,
    staminaBalanceBefore: input.staminaBalanceBefore,
  }));
  const resolvedPayload = regionRevoltResolvedPayload(input);
  const revoltResolved = input.makeEvent("region_revolt_resolved", input.revoltId, resolvedPayload, {
    aggregateType: "region",
    agentId: input.rebelAgentId,
  });
  const influencePayload = regionRevoltInfluencePayload({
    influenceId: input.influenceId,
    regionId: input.regionId,
    revoltId: input.revoltId,
    rebelAgentId: input.rebelAgentId,
    rebelExplorerId: input.rebelExplorerId,
    previousInfluenceScore: input.previousInfluenceScore,
    sourceEventId: revoltResolved.eventId,
    settlement: input.settlement,
    changedAt: input.resolvedAt,
  });
  const influenceChanged = regionInfluenceChangedEvent(input.makeEvent, input.regionId, influencePayload, input.rebelAgentId);
  const tracePayload = regionRevoltTracePayload({
    traceId: input.traceId,
    regionId: input.regionId,
    revoltId: input.revoltId,
    rebelAgentId: input.rebelAgentId,
    rebelExplorerId: input.rebelExplorerId,
    rebelFactionId: input.rebelFactionId,
    settlement: input.settlement,
    sourceEventIds: [revoltResolved.eventId, influenceChanged.eventId],
    relatedInfluenceIds: [input.influenceId],
    parentTraceId: input.parentTraceId,
    createdAt: input.resolvedAt,
  });
  const traceCreated = traceCreatedEvent(input.makeEvent, input.traceId, tracePayload, input.rebelAgentId);
  const nextEvents: EpochEvent[] = [staminaSpentEvent, revoltResolved, influenceChanged, traceCreated];
  if (input.settlement.outcome === "revolt_succeeded") {
    const controlPayload = regionRevoltControlPayload({
      regionId: input.regionId,
      controllingFactionId: input.rebelFactionId,
      previousControllingFactionId: input.previousControllingFactionId,
      factionScore: input.factionScore,
      staminaSpent: input.staminaSpent,
      contestedByFactionId: input.contestedByFactionId,
      settlement: input.settlement,
      sourceSeasonId: input.sourceSeasonId,
      sourceReleaseId: input.sourceReleaseId,
      previousControlSourceSeasonId: input.previousControlSourceSeasonId,
      claimingAgentId: input.rebelAgentId,
      claimingExplorerId: input.rebelExplorerId,
      changedAt: input.resolvedAt,
    });
    nextEvents.push(input.makeEvent("region_control_changed", input.regionId, controlPayload, {
      aggregateType: "region",
      agentId: input.rebelAgentId,
    }));
  }
  return nextEvents;
}

export function projectRegionRevoltResolution(
  input: RegionRevoltResolutionProjectionInput,
): RegionRevoltResolvedPayload {
  const resolved = input.events.find((event) => event.eventType === "region_revolt_resolved");
  if (!resolved || resolved.eventType !== "region_revolt_resolved") {
    throw new Error("region_revolt_resolved_event_missing");
  }
  return resolved.payload;
}

export function seasonRegionMonumentPayload(input: SeasonRegionMonumentPayloadInput): RegionMonumentBuiltPayload {
  return {
    monumentId: input.monumentId,
    regionId: input.regionId,
    title: `${input.campaignTitle}胜利纪念碑`,
    description: `${input.winningFactionId} 在 ${input.campaignTitle} 中取得区域控制，${input.winner.explorerId} 的身份被刻入赛季档案。`,
    controllingFactionId: input.winningFactionId,
    winnerAgentId: input.winner.agentId,
    winnerExplorerId: input.winner.explorerId,
    sourceSeasonId: input.seasonId,
    controlScore: input.controlScore,
    builtAt: input.builtAt,
  };
}

export function seasonResolvedPayload(input: SeasonResolvedPayloadInput): SeasonResolvedPayload {
  return {
    seasonId: input.seasonId,
    phase: "resolved",
    sourceEventId: input.sourceEventId,
    relatedEventIds: input.relatedEventIds,
    winningFactionId: input.winningFaction?.factionId,
    winnerAgentId: input.winner?.agentId,
    winnerExplorerId: input.winner?.explorerId,
    winningScore: input.winningFaction?.score || 0,
    resolvedAt: input.resolvedAt,
  };
}

function uniqueValues(values: readonly string[]): string[] {
  return values.filter((value, index) => value && values.indexOf(value) === index);
}
