import type {
  EpochProjection,
  EpochSeasonCampaign,
} from "./gameCore.ts";
import {
  regionLeaderboardView,
  type EpochRegionLeaderboardEntry,
} from "./regionLeaderboardReadModel.ts";
import {
  EPOCH_TRUST_CLASSES,
  normalizeTrustClass,
  type EpochTrustClass,
} from "./protocol.ts";

export const EPOCH_COMPETITIVE_LADDER_MODES = [
  "casual",
  "ranked",
  "verified",
] as const;

export type EpochCompetitiveLadderMode = typeof EPOCH_COMPETITIVE_LADDER_MODES[number];

export const EPOCH_COMPETITIVE_LADDER_MAX_LIMIT = 100;
export const EPOCH_COMPETITIVE_LADDER_DEFAULT_LIMIT = 20;

export type EpochCompetitiveLadderDimension =
  | { readonly kind: "region"; readonly regionId: string }
  | { readonly kind: "season"; readonly seasonId: string }
  | { readonly kind: "tournament"; readonly tournamentId: string };

export type EpochCompetitiveEligibilityReason =
  | "casual_accepts_all_canonical_sources"
  | "server_settled_canonical_events"
  | "non_verified_delivery_counted"
  | "verified_delivery_required"
  | "verified_delivery_accepted"
  | "non_verified_delivery_excluded";

export type EpochCompetitiveDeliveryClass = "verified" | "mixed" | "non_verified";

export interface EpochCompetitiveAuditLink {
  readonly eventId: string;
  readonly audit: string;
}

export interface EpochCompetitiveLadderEntry {
  readonly rank: number;
  readonly agentId: string;
  readonly explorerId: string;
  readonly score: number;
  readonly canonicalScore: number;
  readonly verifiedScore: number;
  readonly excludedScore: number;
  readonly eligible: true;
  readonly eligibilityReasons: readonly EpochCompetitiveEligibilityReason[];
  readonly deliveryClass: EpochCompetitiveDeliveryClass;
  readonly dominantTrustClass: EpochTrustClass;
  readonly sourceTrustClasses: readonly EpochTrustClass[];
  readonly countedTrustClasses: readonly EpochTrustClass[];
  readonly excludedTrustClasses: readonly EpochTrustClass[];
  readonly trustBreakdown: Partial<Record<EpochTrustClass, number>>;
  readonly lastActiveAt: string;
  readonly sourceEventIds: readonly string[];
  readonly auditLinks: readonly EpochCompetitiveAuditLink[];
}

export type EpochCompetitiveLadderDimensionView =
  | {
    readonly kind: "region";
    readonly id: string;
    readonly sourceKind: "region_event_ledger";
    readonly serverSettled: true;
  }
  | {
    readonly kind: "season" | "tournament";
    readonly id: string;
    readonly seasonId: string;
    readonly title: string;
    readonly status: EpochSeasonCampaign["status"];
    readonly regionIds: readonly string[];
    readonly sourceKind: "season_campaign";
    readonly serverSettled: true;
    readonly serverTournament: true;
  };

export interface EpochCompetitiveLadderView {
  readonly mode: EpochCompetitiveLadderMode;
  readonly dimension: EpochCompetitiveLadderDimensionView;
  readonly limit: number;
  readonly total: number;
  readonly truncated: boolean;
  readonly entries: readonly EpochCompetitiveLadderEntry[];
}

interface CompetitiveCandidate {
  readonly agentId: string;
  readonly explorerId: string;
  readonly canonicalScore: number;
  readonly verifiedScore: number;
  readonly dominantTrustClass: EpochTrustClass;
  readonly trustBreakdown: Partial<Record<EpochTrustClass, number>>;
  readonly lastActiveAt: string;
  readonly sourceEventIds: readonly string[];
}

function boundedLimit(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) return EPOCH_COMPETITIVE_LADDER_DEFAULT_LIMIT;
  return Math.max(1, Math.min(Math.floor(value), EPOCH_COMPETITIVE_LADDER_MAX_LIMIT));
}

function positiveScore(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function uniqueStrings(values: readonly string[]): readonly string[] {
  return [...new Set(values)];
}

function positiveTrustBreakdown(
  breakdown: Partial<Record<EpochTrustClass, number>>,
): Partial<Record<EpochTrustClass, number>> {
  const normalized: Partial<Record<EpochTrustClass, number>> = {};
  for (const trustClass of EPOCH_TRUST_CLASSES) {
    const score = positiveScore(breakdown[trustClass] || 0);
    if (score > 0) normalized[trustClass] = score;
  }
  return normalized;
}

function sourceTrustClasses(
  breakdown: Partial<Record<EpochTrustClass, number>>,
): readonly EpochTrustClass[] {
  return EPOCH_TRUST_CLASSES.filter((trustClass) => (breakdown[trustClass] || 0) > 0);
}

function isVerifiedCompetitiveTrustClass(trustClass: EpochTrustClass): boolean {
  return trustClass === "server_hosted_agent"
    || trustClass === "host_attested"
    || trustClass === "remote_attested_runner";
}

function deliveryClass(canonicalScore: number, verifiedScore: number): EpochCompetitiveDeliveryClass {
  if (verifiedScore <= 0) return "non_verified";
  if (verifiedScore >= canonicalScore) return "verified";
  return "mixed";
}

function eligibilityReasons(
  mode: EpochCompetitiveLadderMode,
  delivery: EpochCompetitiveDeliveryClass,
): readonly EpochCompetitiveEligibilityReason[] {
  if (mode === "casual") return ["casual_accepts_all_canonical_sources"];
  if (mode === "ranked") {
    return delivery === "verified"
      ? ["server_settled_canonical_events"]
      : ["server_settled_canonical_events", "non_verified_delivery_counted"];
  }
  return delivery === "verified"
    ? ["verified_delivery_required", "verified_delivery_accepted"]
    : ["verified_delivery_required", "verified_delivery_accepted", "non_verified_delivery_excluded"];
}

function auditLinks(sourceEventIds: readonly string[]): readonly EpochCompetitiveAuditLink[] {
  return sourceEventIds.map((eventId) => ({
    eventId,
    audit: `/epoch/audit/${encodeURIComponent(eventId)}`,
  }));
}

function candidateToEntry(
  candidate: CompetitiveCandidate,
  mode: EpochCompetitiveLadderMode,
): Omit<EpochCompetitiveLadderEntry, "rank"> | undefined {
  const canonicalScore = positiveScore(candidate.canonicalScore);
  const verifiedScore = Math.min(canonicalScore, positiveScore(candidate.verifiedScore));
  const score = mode === "verified" ? verifiedScore : canonicalScore;
  if (score <= 0) return undefined;
  const breakdown = positiveTrustBreakdown(candidate.trustBreakdown);
  const sourceClasses = sourceTrustClasses(breakdown);
  const countedTrustClasses = mode === "verified"
    ? sourceClasses.filter(isVerifiedCompetitiveTrustClass)
    : sourceClasses;
  const excludedTrustClasses = mode === "verified"
    ? sourceClasses.filter((trustClass) => !isVerifiedCompetitiveTrustClass(trustClass))
    : [];
  const delivery = deliveryClass(canonicalScore, verifiedScore);
  return {
    agentId: candidate.agentId,
    explorerId: candidate.explorerId,
    score,
    canonicalScore,
    verifiedScore,
    excludedScore: canonicalScore - verifiedScore,
    eligible: true,
    eligibilityReasons: eligibilityReasons(mode, delivery),
    deliveryClass: delivery,
    dominantTrustClass: normalizeTrustClass(candidate.dominantTrustClass),
    sourceTrustClasses: sourceClasses,
    countedTrustClasses,
    excludedTrustClasses,
    trustBreakdown: breakdown,
    lastActiveAt: candidate.lastActiveAt,
    sourceEventIds: candidate.sourceEventIds,
    auditLinks: auditLinks(candidate.sourceEventIds),
  };
}

function sourceEventIdsForMode(
  projection: EpochProjection,
  sourceEventIds: readonly string[],
  mode: EpochCompetitiveLadderMode,
): readonly string[] {
  const uniqueEventIds = uniqueStrings(sourceEventIds);
  if (mode !== "verified") return uniqueEventIds;
  const trustClassByEventId = new Map(projection.events.map((event) => [
    event.eventId,
    normalizeTrustClass(event.trustClass),
  ]));
  return uniqueEventIds.filter((eventId) => {
    const trustClass = trustClassByEventId.get(eventId);
    return trustClass !== undefined && isVerifiedCompetitiveTrustClass(trustClass);
  });
}

function regionCandidates(
  projection: EpochProjection,
  regionId: string,
  mode: EpochCompetitiveLadderMode,
): readonly CompetitiveCandidate[] {
  const leaderboard = regionLeaderboardView(projection, {
    regionId,
    limit: Math.max(1, projection.events.length),
  });
  return leaderboard.map((entry: EpochRegionLeaderboardEntry) => ({
    agentId: entry.agentId,
    explorerId: entry.explorerId,
    canonicalScore: entry.influenceScore,
    verifiedScore: entry.trustedInfluenceScore,
    dominantTrustClass: entry.dominantTrustClass,
    trustBreakdown: entry.trustBreakdown,
    lastActiveAt: entry.lastActiveAt,
    sourceEventIds: sourceEventIdsForMode(projection, entry.sourceEventIds, mode),
  }));
}

function seasonSourceEventIds(
  campaign: EpochSeasonCampaign,
  agentId: string,
  mode: EpochCompetitiveLadderMode,
): readonly string[] {
  return uniqueStrings(campaign.contributions
    .filter((contribution) => contribution.agentId === agentId)
    .filter((contribution) => mode !== "verified"
      || isVerifiedCompetitiveTrustClass(normalizeTrustClass(contribution.trustClass)))
    .map((contribution) => contribution.eventId));
}

function seasonLastActiveAt(campaign: EpochSeasonCampaign, agentId: string): string {
  return campaign.contributions
    .filter((contribution) => contribution.agentId === agentId)
    .reduce((latest, contribution) => latest.localeCompare(contribution.recordedAt) >= 0
      ? latest
      : contribution.recordedAt, campaign.createdAt);
}

function seasonCandidates(
  campaign: EpochSeasonCampaign,
  mode: EpochCompetitiveLadderMode,
): readonly CompetitiveCandidate[] {
  return campaign.agentStandings.map((standing) => ({
    agentId: standing.agentId,
    explorerId: standing.explorerId,
    canonicalScore: standing.score,
    verifiedScore: standing.trustedScore,
    dominantTrustClass: standing.dominantTrustClass,
    trustBreakdown: standing.trustBreakdown,
    lastActiveAt: seasonLastActiveAt(campaign, standing.agentId),
    sourceEventIds: seasonSourceEventIds(campaign, standing.agentId, mode),
  }));
}

function seasonCampaignForDimension(
  projection: EpochProjection,
  dimension: Extract<EpochCompetitiveLadderDimension, { readonly kind: "season" | "tournament" }>,
): EpochSeasonCampaign {
  const seasonId = dimension.kind === "season" ? dimension.seasonId : dimension.tournamentId;
  const campaign = projection.seasonCampaigns[seasonId];
  if (!campaign) throw new Error("competitive_ladder_season_campaign_not_found");
  return campaign;
}

function dimensionView(
  dimension: EpochCompetitiveLadderDimension,
  campaign?: EpochSeasonCampaign,
): EpochCompetitiveLadderDimensionView {
  if (dimension.kind === "region") {
    return {
      kind: "region",
      id: dimension.regionId,
      sourceKind: "region_event_ledger",
      serverSettled: true,
    };
  }
  if (!campaign) throw new Error("competitive_ladder_season_campaign_not_found");
  return {
    kind: dimension.kind,
    id: dimension.kind === "season" ? dimension.seasonId : dimension.tournamentId,
    seasonId: campaign.seasonId,
    title: campaign.title,
    status: campaign.status,
    regionIds: [...campaign.regionIds],
    sourceKind: "season_campaign",
    serverSettled: true,
    serverTournament: true,
  };
}

export function competitiveLadderView(
  projection: EpochProjection,
  input: {
    readonly mode: EpochCompetitiveLadderMode;
    readonly dimension: EpochCompetitiveLadderDimension;
    readonly limit?: number;
  },
): EpochCompetitiveLadderView {
  const limit = boundedLimit(input.limit);
  let campaign: EpochSeasonCampaign | undefined;
  let candidates: readonly CompetitiveCandidate[];
  if (input.dimension.kind === "region") {
    candidates = regionCandidates(projection, input.dimension.regionId, input.mode);
  } else {
    campaign = seasonCampaignForDimension(projection, input.dimension);
    candidates = seasonCandidates(campaign, input.mode);
  }
  const ranked = candidates
    .map((candidate) => candidateToEntry(candidate, input.mode))
    .filter((entry): entry is Omit<EpochCompetitiveLadderEntry, "rank"> => entry !== undefined)
    .sort((left, right) => right.score - left.score
      || right.verifiedScore - left.verifiedScore
      || right.lastActiveAt.localeCompare(left.lastActiveAt)
      || left.agentId.localeCompare(right.agentId));
  const entries = ranked.slice(0, limit).map((entry, index) => ({
    ...entry,
    rank: index + 1,
  }));
  return {
    mode: input.mode,
    dimension: dimensionView(input.dimension, campaign),
    limit,
    total: ranked.length,
    truncated: ranked.length > entries.length,
    entries,
  };
}
