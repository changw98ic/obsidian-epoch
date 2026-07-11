import { assertNonEmptyString } from "./protocol.ts";
import {
  type EpochAnomalyEvent,
  type EpochProjection,
  type EpochRegionControl,
  type EpochRegionMonument,
  type EpochSeasonCampaign,
} from "./gameCore.ts";
import { type EpochRuntimeResult } from "./runtimePublicProjectionRules.ts";
import { canonicalRegionIdFromInput } from "./runtimeInputRules.ts";
import {
  seasonCampaignView,
  seasonContributionAuditGroups,
  seasonContributionAuditView,
  seasonContributionDailyTotals,
  seasonsView,
  type EpochSeasonCampaignView,
  type EpochSeasonContributionAudit,
  type EpochSeasonContributionAuditGroup,
  type EpochSeasonContributionDailyTotal,
} from "./seasonReadModel.ts";

export type {
  EpochSeasonCampaignView,
  EpochSeasonContributionAudit,
  EpochSeasonContributionAuditGroup,
  EpochSeasonContributionDailyTotal,
  EpochSeasonFactionStandingView,
} from "./seasonReadModel.ts";

type AnyRecord = Record<string, unknown>;

export interface EpochSeasonCampaignInfo {
  readonly regionId?: string;
  readonly factionId?: string;
  readonly status?: string;
  readonly seasons: readonly EpochSeasonCampaignView[];
}

export interface EpochSeasonArchiveInfo {
  readonly seasonId: string;
  readonly season?: EpochSeasonCampaignView;
  readonly contributionFilters: {
    readonly factionId?: string;
    readonly agentId?: string;
  };
  readonly contributionPagination: {
    readonly total: number;
    readonly limit: number;
    readonly offset: number;
    readonly nextOffset?: number;
    readonly previousOffset?: number;
  };
  readonly contributions: readonly EpochSeasonContributionAudit[];
  readonly contributionGroups: readonly EpochSeasonContributionAuditGroup[];
  readonly contributionDailyTotals: readonly EpochSeasonContributionDailyTotal[];
  readonly encounters: readonly EpochAnomalyEvent[];
  readonly regionControls: readonly EpochRegionControl[];
  readonly monuments: readonly EpochRegionMonument[];
  readonly publicPages: {
    readonly season?: string;
    readonly regions: readonly string[];
  };
}

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function optionalNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

export function seasonCampaignRuntimeView(
  projection: EpochProjection,
  season: EpochSeasonCampaign,
): EpochSeasonCampaignView {
  return seasonCampaignView(projection.seasonCampaigns[season.seasonId] || season);
}

export function seasonRuntimeResultView(
  result: EpochRuntimeResult<EpochSeasonCampaign>,
): EpochRuntimeResult<EpochSeasonCampaignView> {
  return {
    ...result,
    value: seasonCampaignRuntimeView(result.projection, result.value),
  };
}

export function seasonsInfoView(
  projection: EpochProjection,
  input: AnyRecord = {},
): EpochSeasonCampaignInfo {
  return {
    regionId: typeof input.regionId === "string" ? input.regionId : undefined,
    factionId: typeof input.factionId === "string" ? input.factionId : undefined,
    status: typeof input.status === "string" ? input.status : undefined,
    seasons: seasonsView(projection, {
      regionId: canonicalRegionIdFromInput(input.regionId),
      factionId: typeof input.factionId === "string" ? input.factionId : undefined,
      status: typeof input.status === "string" ? input.status : undefined,
    }),
  };
}

export function seasonArchiveInfoView(
  projection: EpochProjection,
  input: AnyRecord = {},
): EpochSeasonArchiveInfo {
  const seasonId = assertNonEmptyString(input.seasonId, "season_id");
  const factionId = optionalString(input.factionId);
  const agentId = optionalString(input.agentId);
  const contributionLimit = Math.max(1, Math.min(Math.floor(optionalNumber(input.contributionLimit) ?? 20), 50));
  const contributionOffset = Math.max(0, Math.floor(optionalNumber(input.contributionOffset) ?? 0));
  const season = projection.seasonCampaigns[seasonId];
  const regionIds = season?.regionIds || [];
  const filteredContributions = (season?.contributions || [])
    .filter((contribution) => !factionId || contribution.factionId === factionId)
    .filter((contribution) => !agentId || contribution.agentId === agentId)
    .sort((left, right) => right.recordedAt.localeCompare(left.recordedAt) || right.eventId.localeCompare(left.eventId));
  const maxScoreDelta = Math.max(1, ...filteredContributions.map((contribution) => contribution.scoreDelta));
  const contributions = filteredContributions
    .slice(contributionOffset, contributionOffset + contributionLimit)
    .map((contribution) => seasonContributionAuditView(contribution, maxScoreDelta));
  const monuments = Object.values(projection.regionMonuments)
    .filter((monument) => monument.sourceSeasonId === seasonId)
    .sort((left, right) => right.builtAt.localeCompare(left.builtAt) || left.monumentId.localeCompare(right.monumentId));
  const encounters = Object.values(projection.anomalyEvents)
    .filter((anomaly) => anomaly.sourceSeasonId === seasonId)
    .sort((left, right) => right.spawnedAt.localeCompare(left.spawnedAt) || left.anomalyId.localeCompare(right.anomalyId));
  return {
    seasonId,
    season: season ? seasonCampaignView(season) : undefined,
    contributionFilters: {
      ...(factionId ? { factionId } : {}),
      ...(agentId ? { agentId } : {}),
    },
    contributionPagination: {
      total: filteredContributions.length,
      limit: contributionLimit,
      offset: contributionOffset,
      ...(contributionOffset + contributionLimit < filteredContributions.length
        ? { nextOffset: contributionOffset + contributionLimit }
        : {}),
      ...(contributionOffset > 0
        ? { previousOffset: Math.max(0, contributionOffset - contributionLimit) }
        : {}),
    },
    contributions,
    contributionGroups: seasonContributionAuditGroups(contributions),
    contributionDailyTotals: seasonContributionDailyTotals(filteredContributions),
    encounters,
    regionControls: regionIds.map((regionId) => projection.regionControls[regionId]).filter((control): control is EpochRegionControl =>
      Boolean(control && control.sourceSeasonId === seasonId)),
    monuments,
    publicPages: {
      season: season ? `/epoch/season/${encodeURIComponent(seasonId)}` : undefined,
      regions: regionIds.map((regionId) => `/epoch/region/${encodeURIComponent(regionId)}`),
    },
  };
}
