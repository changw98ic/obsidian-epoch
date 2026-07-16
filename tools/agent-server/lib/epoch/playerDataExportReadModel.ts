import {
  auditView,
  type EpochAuditEventSummary,
  type EpochAuditRiskReviewSummary,
} from "./auditReadModel.ts";
import type {
  EpochDowntimeDiaryEntry,
  EpochDowntimeState,
} from "./downtimeRules.ts";
import {
  explorerProfileView,
  type EpochExplorerProfileSummary,
} from "./explorerProfileReadModel.ts";
import {
  sourceEventsMentionAgent,
  type EpochAgentIdentity,
  type EpochIdentitySlotState,
  type EpochMessageRecord,
  type EpochProjection,
} from "./gameCore.ts";
import {
  inventoryItemsView,
  type EpochInventoryItemInfo,
} from "./progressReadModel.ts";
import type { EpochEventType, EpochResourceId } from "./protocol.ts";
import { messagesView } from "./regionActivityReadModel.ts";
import {
  regionNewsView,
  type EpochRegionNewsView,
} from "./regionNewsReadModel.ts";
import {
  agentNpcBondsView,
  type EpochAgentNpcBondView,
} from "./relationshipReadModel.ts";
import { publicProjection } from "./runtimePublicProjectionRules.ts";
import {
  seasonContributionAuditView,
  type EpochSeasonContributionAudit,
} from "./seasonReadModel.ts";

export const EPOCH_PLAYER_DATA_EXPORT_SCHEMA_VERSION = "obsidian-epoch.player-data-export.v1" as const;

const DEFAULT_EXPORT_LIMIT = 50;
const MAX_EXPORT_LIMIT = 100;

export interface EpochPlayerDataExportInput {
  readonly explorerId: string;
  readonly limit?: number;
  readonly exportedAt?: string;
}

export interface EpochPlayerDataExportCounts {
  readonly identities: number;
  readonly resourceBalances: number;
  readonly inventoryItems: number;
  readonly downtimeStates: number;
  readonly downtimeDiaryEntries: number;
  readonly npcBonds: number;
  readonly worldMessages: number;
  readonly regionMessages: number;
  readonly newsMentions: number;
  readonly seasonContributions: number;
  readonly replayEvents: number;
}

export interface EpochPlayerDataExportProfile {
  readonly summary: EpochExplorerProfileSummary;
  readonly identitySlots: EpochIdentitySlotState;
  readonly totalResources: Partial<Record<EpochResourceId, number>>;
  readonly publicPages: {
    readonly explorer: string;
    readonly agents: readonly string[];
    readonly archives: readonly string[];
  };
}

export interface EpochPlayerDataReplayEvent {
  readonly eventId: string;
  readonly eventType: EpochEventType;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly agentId?: string;
  readonly trustClass: string;
  readonly causationId: string;
  readonly correlationId: string;
  readonly createdAt: string;
  readonly highImpact: boolean;
  readonly reviewFlags: readonly string[];
  readonly reviewScore: number;
  readonly riskReview?: EpochAuditRiskReviewSummary;
  readonly publicPages: {
    readonly audit: string;
  };
}

export interface EpochPlayerDataReplay {
  readonly limit: number;
  readonly truncated: boolean;
  readonly events: readonly EpochPlayerDataReplayEvent[];
  readonly eventIds: readonly string[];
  readonly aggregateIds: readonly string[];
  readonly trustClasses: readonly string[];
  readonly highImpactEventTypes: readonly EpochEventType[];
}

export interface EpochPlayerDataExport {
  readonly schemaVersion: typeof EPOCH_PLAYER_DATA_EXPORT_SCHEMA_VERSION;
  readonly exportedAt: string;
  readonly explorerId: string;
  readonly counts: EpochPlayerDataExportCounts;
  readonly profile: EpochPlayerDataExportProfile;
  readonly identities: readonly EpochAgentIdentity[];
  readonly resources: Readonly<Record<string, Partial<Record<EpochResourceId, number>>>>;
  readonly inventoryItems: readonly EpochInventoryItemInfo[];
  readonly downtime: Readonly<Record<string, EpochDowntimeState | null>>;
  readonly downtimeDiaryEntries: readonly EpochDowntimeDiaryEntry[];
  readonly npcBonds: readonly EpochAgentNpcBondView[];
  readonly messages: {
    readonly world: readonly EpochMessageRecord[];
    readonly region: readonly EpochMessageRecord[];
  };
  readonly newsMentions: readonly EpochRegionNewsView[];
  readonly seasonContributions: readonly EpochSeasonContributionAudit[];
  readonly replay: EpochPlayerDataReplay;
}

function boundedLimit(value: number | undefined): number {
  const parsed = Number(value ?? DEFAULT_EXPORT_LIMIT);
  if (!Number.isFinite(parsed)) return DEFAULT_EXPORT_LIMIT;
  return Math.max(1, Math.min(Math.trunc(parsed), MAX_EXPORT_LIMIT));
}

function exportTimestamp(value: string | undefined): string {
  const date = value === undefined ? new Date() : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("player_data_export_invalid_exported_at");
  return date.toISOString();
}

function uniqueById<TValue>(values: readonly TValue[], idOf: (value: TValue) => string): TValue[] {
  const unique = new Map<string, TValue>();
  for (const value of values) unique.set(idOf(value), value);
  return [...unique.values()];
}

function replayEvent(summary: EpochAuditEventSummary): EpochPlayerDataReplayEvent {
  return {
    eventId: summary.eventId,
    eventType: summary.eventType,
    aggregateType: summary.aggregateType,
    aggregateId: summary.aggregateId,
    ...(summary.agentId ? { agentId: summary.agentId } : {}),
    trustClass: summary.trustClass,
    causationId: summary.causationId,
    correlationId: summary.correlationId,
    createdAt: summary.createdAt,
    highImpact: summary.highImpact,
    reviewFlags: summary.reviewFlags,
    reviewScore: summary.reviewScore,
    ...(summary.riskReview ? { riskReview: summary.riskReview } : {}),
    publicPages: summary.publicPages,
  };
}

function lineageNewsMentions(
  projection: EpochProjection,
  agentIds: ReadonlySet<string>,
  limit: number,
): readonly EpochRegionNewsView[] {
  const awardNewsIds = new Set(
    [...agentIds].flatMap((agentId) => (projection.legendAwardIdsByAgent[agentId] || [])
      .map((awardId) => projection.legendAwards[awardId]?.newsId)
      .filter((newsId): newsId is string => Boolean(newsId))),
  );
  return regionNewsView(Object.values(projection.regionNews).flat())
    .filter((news) => awardNewsIds.has(news.newsId)
      || [...agentIds].some((agentId) => sourceEventsMentionAgent(projection, news.sourceEventIds, agentId)))
    .slice(0, limit);
}

export function playerDataExportView(
  projection: EpochProjection,
  input: EpochPlayerDataExportInput,
): EpochPlayerDataExport {
  const limit = boundedLimit(input.limit);
  const safeProjection = publicProjection(projection);
  const profile = explorerProfileView(safeProjection, {
    explorerId: input.explorerId,
    limit,
  });
  const identities = profile.identities;
  const agentIds = new Set(identities.map((identity) => identity.agentId));

  const resources = Object.fromEntries(identities.map((identity) => [
    identity.agentId,
    safeProjection.resourceBalances[identity.agentId] || {},
  ]));
  const inventoryItems = uniqueById(
    identities.flatMap((identity) => inventoryItemsView(safeProjection, { agentId: identity.agentId })),
    (item) => item.itemId,
  )
    .filter((item) => item.explorerId === profile.explorerId && agentIds.has(item.agentId))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt) || left.itemId.localeCompare(right.itemId))
    .slice(0, limit);
  const downtime = Object.fromEntries(identities.map((identity) => [
    identity.agentId,
    safeProjection.downtime[identity.agentId] || null,
  ]));
  const downtimeDiaryEntries = uniqueById(
    identities.flatMap((identity) => (safeProjection.downtimeDiaryIdsByAgent[identity.agentId] || [])
      .map((diaryId) => safeProjection.downtimeDiaryEntries[diaryId])
      .filter((entry): entry is EpochDowntimeDiaryEntry => Boolean(entry))),
    (entry) => entry.diaryId,
  )
    .filter((entry) => agentIds.has(entry.agentId))
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt) || left.diaryId.localeCompare(right.diaryId))
    .slice(0, limit);
  const npcBonds = uniqueById(
    identities.flatMap((identity) => agentNpcBondsView(safeProjection, { agentId: identity.agentId })),
    (bond) => bond.bondId,
  )
    .filter((bond) => bond.explorerId === profile.explorerId && agentIds.has(bond.agentId))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt) || left.bondId.localeCompare(right.bondId))
    .slice(0, limit);

  const messageViews = identities.map((identity) => messagesView(safeProjection, {
    agentId: identity.agentId,
    limit: MAX_EXPORT_LIMIT,
  }));
  const worldMessages = uniqueById(messageViews.flatMap((view) => view.worldMessages), (message) => message.messageId)
    .filter((message) => message.explorerId === profile.explorerId && agentIds.has(message.agentId))
    .sort((left, right) => right.postedAt.localeCompare(left.postedAt) || right.messageId.localeCompare(left.messageId))
    .slice(0, limit);
  const regionMessages = uniqueById(messageViews.flatMap((view) => view.regionMessages), (message) => message.messageId)
    .filter((message) => message.explorerId === profile.explorerId && agentIds.has(message.agentId))
    .sort((left, right) => right.postedAt.localeCompare(left.postedAt) || right.messageId.localeCompare(left.messageId))
    .slice(0, limit);
  const newsMentions = lineageNewsMentions(safeProjection, agentIds, limit);

  const allSeasonContributions = Object.values(safeProjection.seasonCampaigns)
    .flatMap((season) => season.contributions)
    .filter((contribution) => contribution.explorerId === profile.explorerId && agentIds.has(contribution.agentId));
  const maxSeasonScoreDelta = Math.max(1, ...allSeasonContributions.map((contribution) => contribution.scoreDelta));
  const seasonContributions = allSeasonContributions
    .map((contribution) => seasonContributionAuditView(contribution, maxSeasonScoreDelta))
    .sort((left, right) => right.recordedAt.localeCompare(left.recordedAt) || left.eventId.localeCompare(right.eventId))
    .slice(0, limit);

  const auditViews = identities.map((identity) => auditView(safeProjection, {
    agentId: identity.agentId,
    limit: MAX_EXPORT_LIMIT,
  }));
  const allReplayEvents = uniqueById(
    auditViews.flatMap((view) => view.events),
    (event) => event.eventId,
  ).sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.eventId.localeCompare(right.eventId));
  const selectedReplayEvents = allReplayEvents.slice(-limit).map(replayEvent);
  const replay: EpochPlayerDataReplay = {
    limit,
    truncated: allReplayEvents.length > limit || auditViews.some((view) => view.total > view.events.length),
    events: selectedReplayEvents,
    eventIds: selectedReplayEvents.map((event) => event.eventId),
    aggregateIds: [...new Set(selectedReplayEvents.map((event) => event.aggregateId))],
    trustClasses: [...new Set(selectedReplayEvents.map((event) => event.trustClass))],
    highImpactEventTypes: [...new Set(selectedReplayEvents
      .filter((event) => event.highImpact)
      .map((event) => event.eventType))],
  };

  const counts: EpochPlayerDataExportCounts = {
    identities: identities.length,
    resourceBalances: Object.values(resources).reduce((total, balances) => total + Object.keys(balances).length, 0),
    inventoryItems: inventoryItems.length,
    downtimeStates: Object.values(downtime).filter(Boolean).length,
    downtimeDiaryEntries: downtimeDiaryEntries.length,
    npcBonds: npcBonds.length,
    worldMessages: worldMessages.length,
    regionMessages: regionMessages.length,
    newsMentions: newsMentions.length,
    seasonContributions: seasonContributions.length,
    replayEvents: replay.events.length,
  };

  return {
    schemaVersion: EPOCH_PLAYER_DATA_EXPORT_SCHEMA_VERSION,
    exportedAt: exportTimestamp(input.exportedAt),
    explorerId: profile.explorerId,
    counts,
    profile: {
      summary: profile.summary,
      identitySlots: profile.identitySlots,
      totalResources: profile.totalResources,
      publicPages: profile.publicPages,
    },
    identities,
    resources,
    inventoryItems,
    downtime,
    downtimeDiaryEntries,
    npcBonds,
    messages: {
      world: worldMessages,
      region: regionMessages,
    },
    newsMentions,
    seasonContributions,
    replay,
  };
}
