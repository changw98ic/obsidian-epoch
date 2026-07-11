import {
  epochCampaignKeyArtForSeason,
  epochCampaignKeyArtMedia,
} from "../campaignAssets.ts";
import {
  epochFactionMediaForId,
  epochSeasonCampaignMediaForRecord,
  type EpochFactionMedia,
  type EpochSeasonCampaignMedia,
} from "../factionAssets.ts";
import type {
  EpochProjection,
  EpochSeasonCampaign,
  EpochSeasonContribution,
  EpochSeasonFactionStanding,
} from "./gameCore.ts";

export interface EpochSeasonFactionStandingView extends EpochSeasonFactionStanding {
  readonly media?: EpochFactionMedia;
}

export interface EpochSeasonCampaignView extends EpochSeasonCampaign {
  readonly media: EpochSeasonCampaignMedia;
  readonly factionStandings: readonly EpochSeasonFactionStandingView[];
}

export interface EpochSeasonContributionAudit extends EpochSeasonContribution {
  readonly scoreDeltaRatio: number;
  readonly publicPages: {
    readonly audit: string;
    readonly agent: string;
    readonly explorer: string;
    readonly factionFilter: string;
    readonly agentFilter: string;
  };
}

export interface EpochSeasonContributionAuditGroup {
  readonly recordedDate: string;
  readonly contributionCount: number;
  readonly scoreDeltaTotal: number;
  readonly contributions: readonly EpochSeasonContributionAudit[];
}

export interface EpochSeasonContributionDailyTotal {
  readonly recordedDate: string;
  readonly contributionCount: number;
  readonly scoreDeltaTotal: number;
  readonly resourceAmountTotal: number;
  readonly scoreDeltaRatio: number;
}

export function seasonsView(
  projection: EpochProjection,
  input: { regionId?: string; factionId?: string; status?: string } = {},
): readonly EpochSeasonCampaignView[] {
  const seasonIds = input.regionId
    ? projection.seasonCampaignIdsByRegion[input.regionId] || []
    : input.factionId
      ? projection.seasonCampaignIdsByFaction[input.factionId] || []
      : Object.keys(projection.seasonCampaigns);
  return seasonIds
    .map((seasonId) => projection.seasonCampaigns[seasonId])
    .filter((season): season is EpochSeasonCampaign => Boolean(season))
    .filter((season) => !input.factionId || season.factionIds.includes(input.factionId))
    .filter((season) => !input.status || season.status === input.status)
    .sort((left, right) => Number(left.status === "resolved") - Number(right.status === "resolved") || right.totalScore - left.totalScore)
    .map(seasonCampaignView);
}

export function seasonCampaignView(season: EpochSeasonCampaign): EpochSeasonCampaignView {
  const media = epochSeasonCampaignMediaForRecord(season);
  const campaignKeyArt = epochCampaignKeyArtForSeason({ regionIds: season.regionIds, factionIds: season.factionIds });
  return {
    ...season,
    media: {
      ...media,
      ...(campaignKeyArt ? { campaignKeyArt: epochCampaignKeyArtMedia(campaignKeyArt) } : {}),
    },
    factionStandings: season.factionStandings.map((standing) => {
      const standingMedia = epochFactionMediaForId(standing.factionId);
      return {
        ...standing,
        ...(standingMedia ? { media: standingMedia } : {}),
      };
    }),
  };
}

export function seasonContributionAuditView(
  contribution: EpochSeasonContribution,
  maxScoreDelta: number,
): EpochSeasonContributionAudit {
  return {
    ...contribution,
    scoreDeltaRatio: Math.max(0, Math.min(1, contribution.scoreDelta / Math.max(1, maxScoreDelta))),
    publicPages: {
      audit: `/epoch/audit/${encodeURIComponent(contribution.eventId)}`,
      agent: `/epoch/agent/${encodeURIComponent(contribution.agentId)}`,
      explorer: `/epoch/explorer/${encodeURIComponent(contribution.explorerId)}`,
      factionFilter: `?factionId=${encodeURIComponent(contribution.factionId)}`,
      agentFilter: `?agentId=${encodeURIComponent(contribution.agentId)}`,
    },
  };
}

export function seasonContributionAuditGroups(
  contributions: readonly EpochSeasonContributionAudit[],
): readonly EpochSeasonContributionAuditGroup[] {
  const groups = new Map<string, { contributions: EpochSeasonContributionAudit[]; scoreDeltaTotal: number }>();
  for (const contribution of contributions) {
    const recordedDate = contribution.recordedAt.slice(0, 10);
    const existing = groups.get(recordedDate);
    if (existing) {
      existing.contributions.push(contribution);
      existing.scoreDeltaTotal += contribution.scoreDelta;
      continue;
    }
    groups.set(recordedDate, {
      contributions: [contribution],
      scoreDeltaTotal: contribution.scoreDelta,
    });
  }
  return [...groups.entries()].map(([recordedDate, group]) => ({
    recordedDate,
    contributionCount: group.contributions.length,
    scoreDeltaTotal: group.scoreDeltaTotal,
    contributions: group.contributions,
  }));
}

export function seasonContributionDailyTotals(
  contributions: readonly EpochSeasonContribution[],
): readonly EpochSeasonContributionDailyTotal[] {
  const groups = new Map<string, {
    contributionCount: number;
    scoreDeltaTotal: number;
    resourceAmountTotal: number;
  }>();
  for (const contribution of contributions) {
    const recordedDate = contribution.recordedAt.slice(0, 10);
    const existing = groups.get(recordedDate);
    if (existing) {
      existing.contributionCount += 1;
      existing.scoreDeltaTotal += contribution.scoreDelta;
      existing.resourceAmountTotal += contribution.amount;
      continue;
    }
    groups.set(recordedDate, {
      contributionCount: 1,
      scoreDeltaTotal: contribution.scoreDelta,
      resourceAmountTotal: contribution.amount,
    });
  }
  const totals = [...groups.entries()].map(([recordedDate, group]) => ({
    recordedDate,
    ...group,
  }));
  const maxScoreDeltaTotal = Math.max(1, ...totals.map((total) => total.scoreDeltaTotal));
  return totals.map((total) => ({
    ...total,
    scoreDeltaRatio: Math.max(0, Math.min(1, total.scoreDeltaTotal / maxScoreDeltaTotal)),
  }));
}
