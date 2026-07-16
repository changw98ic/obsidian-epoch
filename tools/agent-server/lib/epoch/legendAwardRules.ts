import {
  type EpochEvent,
  type LegendAwardedPayload,
  type ResourceGrantedPayload,
} from "./events.ts";
import type { EpochEventFactory } from "./eventFactory.ts";
import type { EpochIdFactory } from "./protocol.ts";
import { resourceGrantedEvent } from "./resourceLedgerEvents.ts";

export interface LegendAwardPayloadInput {
  readonly awardId: string;
  readonly newsId: string;
  readonly regionId: string;
  readonly agentId: string;
  readonly explorerId: string;
  readonly amount: number;
  readonly awardedAt: string;
}

export interface RegionNewsForLegendRules {
  readonly newsId: string;
}

export interface RegionNewsForLegendClaimRules {
  readonly newsId: string;
  readonly regionId: string;
  readonly legendDelta?: number;
}

export interface RegionNewsProjectionForLegendRules<TNews extends RegionNewsForLegendRules = RegionNewsForLegendRules> {
  readonly regionNews: Readonly<Record<string, readonly TNews[] | undefined>>;
}

export interface LegendAwardClaimProjection<TAward extends { readonly awardId: string } = { readonly awardId: string }> {
  readonly legendAwards: Readonly<Record<string, TAward | undefined>>;
}

export interface PlanLegendAwardClaimEventsInput {
  readonly news: RegionNewsForLegendClaimRules;
  readonly agentId: string;
  readonly explorerId: string;
  readonly currentLegend: number;
  readonly awardedAt: string;
  readonly idFactory: EpochIdFactory;
  readonly makeEvent: EpochEventFactory;
}

export interface ProjectLegendAwardClaimInput<TAward extends { readonly awardId: string }> {
  readonly projection: LegendAwardClaimProjection<TAward>;
  readonly events: readonly EpochEvent[];
}

export function allRegionNews<TNews extends RegionNewsForLegendRules>(
  projection: RegionNewsProjectionForLegendRules<TNews>,
): readonly TNews[] {
  return Object.values(projection.regionNews).flatMap((newsItems) => newsItems || []);
}

export function requireRegionNews<TNews extends RegionNewsForLegendRules>(
  projection: RegionNewsProjectionForLegendRules<TNews>,
  newsId: string,
): TNews {
  const news = allRegionNews(projection).find((candidate) => candidate.newsId === newsId);
  if (!news) throw new Error("region_news_not_found");
  return news;
}

export function legendAwardPayload(input: LegendAwardPayloadInput): LegendAwardedPayload {
  const amount = Math.max(1, input.amount || 1);
  return {
    awardId: input.awardId,
    newsId: input.newsId,
    regionId: input.regionId,
    agentId: input.agentId,
    explorerId: input.explorerId,
    amount,
    reason: `region_news:${input.newsId}`,
    awardedAt: input.awardedAt,
  };
}

export function legendAwardGrantPayload(input: {
  readonly award: LegendAwardedPayload;
  readonly currentLegend: number;
}): ResourceGrantedPayload {
  return {
    resourceId: "legend",
    amount: input.award.amount,
    reason: input.award.reason,
    balanceAfter: input.currentLegend + input.award.amount,
  };
}

export function planLegendAwardClaimEvents(input: PlanLegendAwardClaimEventsInput): readonly EpochEvent[] {
  const awardId = input.idFactory("legend_award", `${input.news.newsId}:${input.agentId}`);
  const payload = legendAwardPayload({
    awardId,
    newsId: input.news.newsId,
    regionId: input.news.regionId,
    agentId: input.agentId,
    explorerId: input.explorerId,
    amount: input.news.legendDelta || 1,
    awardedAt: input.awardedAt,
  });
  const awarded = input.makeEvent("legend_awarded", awardId, payload, {
    aggregateType: "legend_award",
    agentId: input.agentId,
  });
  const granted = resourceGrantedEvent(input.makeEvent, input.agentId, legendAwardGrantPayload({
    award: payload,
    currentLegend: input.currentLegend,
  }));
  return [awarded, granted];
}

export function projectLegendAwardClaim<TAward extends { readonly awardId: string }>(
  input: ProjectLegendAwardClaimInput<TAward>,
): TAward {
  const awarded = input.events.find((event) => event.eventType === "legend_awarded");
  if (!awarded || awarded.eventType !== "legend_awarded") throw new Error("legend_award_projection_failed");
  const projected = input.projection.legendAwards[awarded.payload.awardId];
  if (!projected) throw new Error("legend_award_projection_failed");
  return projected;
}
