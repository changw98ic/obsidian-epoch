import {
  epochAmbienceSceneMedia,
  epochAmbienceScenesForRegion,
  type EpochAmbienceSceneMedia,
} from "../ambienceAssets.ts";
import {
  epochCampaignKeyArtForRegion,
  epochCampaignKeyArtMedia,
  type EpochCampaignKeyArtMedia,
} from "../campaignAssets.ts";
import {
  EPOCH_EVENT_STATE_ASSETS,
  epochEventStateMedia,
  type EpochEventStateMedia,
} from "../eventStateAssets.ts";
import { epochNpcMediaForRecord, type EpochNpcMedia } from "../npcAssets.ts";
import { resolveEpochCanonicalRegionId } from "../regionAliases.ts";
import {
  epochSceneVariantMedia,
  epochSceneVariantsForRegion,
  type EpochSceneVariantMedia,
} from "../sceneVariantAssets.ts";
import {
  epochWorldSceneMedia,
  epochWorldScenesForRegion,
  type EpochWorldSceneMedia,
} from "../worldSceneAssets.ts";
import type {
  EpochAnomalyEvent,
  EpochConflictTrace,
  EpochContestedObjective,
  EpochDiplomacyRecord,
  EpochMarketOrder,
  EpochMessageRecord,
  EpochNpcCandidate,
  EpochNpcMemory,
  EpochNpcRecord,
  EpochOrganizationMembership,
  EpochOrganizationPoliticsRecord,
  EpochProjection,
  EpochResourceNode,
  EpochRetaliationOpportunity,
  EpochRegionActivity,
  EpochRegionControl,
  EpochRegionInfluenceChange,
  EpochRegionMonument,
  EpochSocialHook,
} from "./gameCore.ts";
import { anomaliesView, objectivesView, resourceNodesView } from "./encounterReadModel.ts";
import { partyRunsView, type EpochPartyRunView } from "./bountyPartyReadModel.ts";
import { npcCandidatesView } from "./npcCandidateReadModel.ts";
import {
  npcAssetsView,
  npcCareersView,
  npcHealthView,
  npcLocationsView,
  npcMemoriesView,
  socialHooksView,
  type EpochNpcAssetStateView,
  type EpochNpcCareerView,
  type EpochNpcHealthStateView,
  type EpochNpcLocationView,
} from "./npcStateReadModel.ts";
import {
  diplomacyView,
  organizationMembershipsView,
  organizationPoliticsView,
  organizationsView,
  type EpochOrganizationView,
} from "./organizationReadModel.ts";
import { activeAgentsView, influenceChangesView, messagesView, regionActivitiesView, type EpochRegionActiveAgent } from "./regionActivityReadModel.ts";
import {
  locationMotifQuotasView,
  regionCommissionsView,
  type EpochLocationMotifQuota,
  type EpochRegionCommission,
} from "./regionCommissionReadModel.ts";
import {
  regionFactionPressureView,
  regionFrontlinesView,
  regionRaidHeatView,
  regionRaidTargetsView,
  retaliationsView,
  tracesView,
  type EpochRegionFactionPressure,
  type EpochRegionFrontline,
  type EpochRegionRaidHeat,
  type EpochRegionRaidTarget,
} from "./regionConflictReadModel.ts";
import { regionLeaderboardView, type EpochRegionLeaderboardEntry } from "./regionLeaderboardReadModel.ts";
import { regionMediaAsset, type EpochRegionMedia } from "./regionMediaReadModel.ts";
import { monumentsView } from "./regionMonumentReadModel.ts";
import { regionNewsView, type EpochRegionNewsView } from "./regionNewsReadModel.ts";
import {
  directTradesView,
  regionMarketSummaryView,
  marketOrdersView,
  type EpochDirectTradeView,
  type EpochRegionMarketSummary,
} from "./marketReadModel.ts";
import {
  agentNpcBondsView,
  householdsView,
  npcRelationshipsView,
  type EpochAgentNpcBondView,
  type EpochHouseholdView,
  type EpochNpcRelationshipView,
} from "./relationshipReadModel.ts";
import { seasonsView, type EpochSeasonCampaignView } from "./seasonReadModel.ts";

type AnyRecord = Readonly<Record<string, unknown>>;

export interface EpochRegionInfo {
  readonly regionId: string;
  readonly media?: EpochRegionMedia;
  readonly campaignKeyArt: readonly EpochCampaignKeyArtMedia[];
  readonly ambienceScenes: readonly EpochAmbienceSceneMedia[];
  readonly worldScenes: readonly EpochWorldSceneMedia[];
  readonly sceneVariants: readonly EpochSceneVariantMedia[];
  readonly eventStateMedia: readonly EpochEventStateMedia[];
  readonly activeAgents: readonly EpochRegionActiveAgent[];
  readonly news: readonly EpochRegionNewsView[];
  readonly messages: readonly EpochMessageRecord[];
  readonly leaderboard: readonly EpochRegionLeaderboardEntry[];
  readonly marketSummary: EpochRegionMarketSummary;
  readonly marketOrders: readonly EpochMarketOrder[];
  readonly directTrades: readonly EpochDirectTradeView[];
  readonly influenceChanges: readonly EpochRegionInfluenceChange[];
  readonly activities: readonly EpochRegionActivity[];
  readonly traces: readonly EpochConflictTrace[];
  readonly retaliations: readonly EpochRetaliationOpportunity[];
  readonly raidHeat: EpochRegionRaidHeat;
  readonly raidTargets: readonly EpochRegionRaidTarget[];
  readonly factionPressure: readonly EpochRegionFactionPressure[];
  readonly frontlines: readonly EpochRegionFrontline[];
  readonly diplomacy: readonly EpochDiplomacyRecord[];
  readonly regionControl?: EpochRegionControl;
  readonly monuments: readonly EpochRegionMonument[];
  readonly npcs: readonly EpochNpcPublicRecord[];
  readonly npcCandidates: readonly EpochNpcCandidate[];
  readonly relationships: readonly EpochNpcRelationshipView[];
  readonly agentNpcBonds: readonly EpochAgentNpcBondView[];
  readonly memories: readonly EpochNpcMemory[];
  readonly households: readonly EpochHouseholdView[];
  readonly organizations: readonly EpochOrganizationView[];
  readonly organizationMemberships: readonly EpochOrganizationMembership[];
  readonly organizationPolitics: readonly EpochOrganizationPoliticsRecord[];
  readonly careers: readonly EpochNpcCareerView[];
  readonly locations: readonly EpochNpcLocationView[];
  readonly assetStates: readonly EpochNpcAssetStateView[];
  readonly healthStates: readonly EpochNpcHealthStateView[];
  readonly socialHooks: readonly EpochSocialHook[];
  readonly partyRuns: readonly EpochPartyRunView[];
  readonly commissions: readonly EpochRegionCommission[];
  readonly motifQuotas: readonly EpochLocationMotifQuota[];
  readonly objectives: readonly EpochContestedObjective[];
  readonly resourceNodes: readonly EpochResourceNode[];
  readonly anomalies: readonly EpochAnomalyEvent[];
  readonly seasons: readonly EpochSeasonCampaignView[];
}

export interface EpochNpcPublicRecord extends EpochNpcRecord {
  readonly media: EpochNpcMedia;
}

export interface EpochNpcInfo {
  readonly npcId?: string;
  readonly npc?: EpochNpcPublicRecord;
  readonly relationships: readonly EpochNpcRelationshipView[];
  readonly agentNpcBonds: readonly EpochAgentNpcBondView[];
  readonly memories: readonly EpochNpcMemory[];
  readonly households: readonly EpochHouseholdView[];
  readonly organizations: readonly EpochOrganizationView[];
  readonly memberships: readonly EpochOrganizationMembership[];
  readonly organizationPolitics: readonly EpochOrganizationPoliticsRecord[];
  readonly careers: readonly EpochNpcCareerView[];
  readonly locations: readonly EpochNpcLocationView[];
  readonly assetStates: readonly EpochNpcAssetStateView[];
  readonly healthStates: readonly EpochNpcHealthStateView[];
  readonly socialHooks: readonly EpochSocialHook[];
}

export interface EpochRegionInfoViewOptions {
  readonly nowIso: string;
}

export function npcPublicRecord(npc: EpochNpcRecord): EpochNpcPublicRecord {
  return {
    ...npc,
    media: epochNpcMediaForRecord(npc),
  };
}

export function npcInfoView(projection: EpochProjection, input: AnyRecord = {}): EpochNpcInfo {
  const npcId = typeof input.npcId === "string" ? input.npcId : undefined;
  return {
    npcId,
    npc: npcId && projection.npcs[npcId] ? npcPublicRecord(projection.npcs[npcId]) : undefined,
    relationships: npcRelationshipsView(projection, { npcId }),
    agentNpcBonds: agentNpcBondsView(projection, { npcId }),
    memories: npcMemoriesView(projection, { npcId }),
    households: householdsView(projection, { npcId }),
    organizations: organizationsView(projection, { npcId }),
    memberships: organizationMembershipsView(projection, { npcId }),
    organizationPolitics: organizationPoliticsView(projection, { npcId }),
    careers: npcCareersView(projection, { npcId }),
    locations: npcLocationsView(projection, { npcId }),
    assetStates: npcAssetsView(projection, { npcId }),
    healthStates: npcHealthView(projection, { npcId }),
    socialHooks: socialHooksView(projection, { npcId }),
  };
}

export function regionInfoView(
  projection: EpochProjection,
  input: AnyRecord = {},
  options: EpochRegionInfoViewOptions,
): EpochRegionInfo {
  const requestedRegionId = String(input.regionId || "");
  const regionId = resolveEpochCanonicalRegionId(requestedRegionId);
  const media = regionMediaAsset(regionId);
  return {
    regionId: requestedRegionId,
    ...(media ? { media } : {}),
    campaignKeyArt: epochCampaignKeyArtForRegion(regionId).map(epochCampaignKeyArtMedia),
    ambienceScenes: epochAmbienceScenesForRegion(regionId).map(epochAmbienceSceneMedia),
    worldScenes: epochWorldScenesForRegion(regionId).map(epochWorldSceneMedia),
    sceneVariants: epochSceneVariantsForRegion(regionId).map(epochSceneVariantMedia),
    eventStateMedia: EPOCH_EVENT_STATE_ASSETS.map(epochEventStateMedia),
    activeAgents: activeAgentsView(projection, { regionId, limit: Number(input.activeAgentLimit || 12) }),
    news: regionNewsView(projection.regionNews[regionId] || []),
    messages: messagesView(projection, { regionId, limit: Number(input.limit || 30) }).regionMessages,
    leaderboard: regionLeaderboardView(projection, { regionId, limit: Number(input.leaderboardLimit || 20) }),
    marketSummary: regionMarketSummaryView(projection, regionId),
    marketOrders: marketOrdersView(projection, { regionId }).slice(0, Number(input.marketOrderLimit || 20)),
    directTrades: directTradesView(projection, { regionId }).slice(0, Number(input.directTradeLimit || 20)),
    influenceChanges: influenceChangesView(projection, { regionId, limit: Number(input.influenceLimit || 20) }),
    activities: regionActivitiesView(projection, { regionId, limit: Number(input.activityLimit || 20) }),
    traces: tracesView(projection, { regionId, limit: Number(input.traceLimit || 20) }),
    retaliations: retaliationsView(projection, { regionId, status: typeof input.retaliationStatus === "string" ? input.retaliationStatus : undefined }),
    raidHeat: regionRaidHeatView(projection, { regionId }),
    raidTargets: regionRaidTargetsView(projection, {
      regionId,
      attackerAgentId: typeof input.raidTargetAttackerAgentId === "string" ? input.raidTargetAttackerAgentId : undefined,
      limit: Number(input.raidTargetLimit || 8),
      nowIso: options.nowIso,
    }),
    factionPressure: regionFactionPressureView(projection, { regionId }),
    frontlines: regionFrontlinesView(projection, { regionId, limit: Number(input.frontlineLimit || 8) }),
    diplomacy: diplomacyView(projection, { regionId, status: typeof input.diplomacyStatus === "string" ? input.diplomacyStatus : undefined }),
    regionControl: projection.regionControls[regionId],
    monuments: monumentsView(projection, { regionId }),
    npcs: Object.values(projection.npcs).filter((npc) => npc.regionId === regionId).map(npcPublicRecord),
    npcCandidates: npcCandidatesView(projection, {
      regionId,
      reviewLevel: typeof input.npcCandidateReviewLevel === "string" ? input.npcCandidateReviewLevel : undefined,
      limit: Number(input.npcCandidateLimit || 30),
    }),
    relationships: npcRelationshipsView(projection, { regionId }),
    agentNpcBonds: agentNpcBondsView(projection, { regionId }),
    memories: npcMemoriesView(projection, { regionId }),
    households: householdsView(projection, { regionId }),
    organizations: organizationsView(projection, { regionId }),
    organizationMemberships: organizationMembershipsView(projection, { regionId }),
    organizationPolitics: organizationPoliticsView(projection, { regionId }),
    careers: npcCareersView(projection, { regionId }),
    locations: npcLocationsView(projection, { regionId }),
    assetStates: npcAssetsView(projection, { regionId }),
    healthStates: npcHealthView(projection, { regionId }),
    socialHooks: socialHooksView(projection, { regionId }),
    partyRuns: partyRunsView(projection, { regionId }),
    commissions: regionCommissionsView(projection, { regionId }),
    motifQuotas: locationMotifQuotasView(projection, { regionId }),
    objectives: objectivesView(projection, { regionId }),
    resourceNodes: resourceNodesView(projection, { regionId }),
    anomalies: anomaliesView(projection, { regionId }),
    seasons: seasonsView(projection, { regionId }),
  };
}
