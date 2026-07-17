import { epochItemMediaForKey, type EpochItemMedia } from "../itemAssets.ts";
import {
  epochDowntimeMediaForMode,
  epochResourceMediaMap,
  type EpochDowntimeMedia,
  type EpochResourceMedia,
} from "../resourceAssets.ts";
import { actionEligibilityView, type EpochActionEligibilityInfo } from "./actionEligibilityReadModel.ts";
import {
  previewEpochDowntime,
  type EpochDowntimeDiaryEntry,
  type EpochPendingDowntimePreview,
} from "./downtimeRules.ts";
import { INVENTORY_ITEM_EFFECTS } from "./inventoryRules.ts";
import {
  identitySlotsForExplorer,
  sourceEventsMentionAgent,
  type EpochAgentIdentity,
  type EpochAgentFactionStanding,
  type EpochIdentitySlotState,
  type EpochInventoryItem,
  type EpochPersonalityDrift,
  type EpochProjection,
} from "./gameCore.ts";
import { type EpochAttributeId, type EpochEventType, type EpochResourceId } from "./protocol.ts";
import { withRegionNewsMedia, type EpochRegionNewsView } from "./regionNewsReadModel.ts";

export interface EpochInventoryItemInfo extends EpochInventoryItem {
  readonly media?: EpochItemMedia;
}

export interface EpochEquipmentEffectInfo {
  readonly itemId: string;
  readonly itemKey: string;
  readonly displayName: string;
  readonly label: string;
  readonly resourceNodeScoreBonus: number;
}

export type EpochProgressRegionNewsView = EpochRegionNewsView;

export interface EpochClaimableLegendNewsInfo extends EpochProgressRegionNewsView {
  readonly amount: number;
}

export interface EpochPendingDowntimePreviewInfo extends EpochPendingDowntimePreview {
  readonly media?: EpochDowntimeMedia;
}

export interface EpochProgressView {
  readonly agentId?: string;
  readonly explorerId?: string;
  readonly identity?: EpochAgentIdentity;
  readonly lineage: readonly string[];
  readonly identities: readonly EpochAgentIdentity[];
  readonly resources: Partial<Record<EpochResourceId, number>>;
  readonly attributes: Partial<Record<EpochAttributeId, number>>;
  readonly resourceMedia: Partial<Record<EpochResourceId, EpochResourceMedia>>;
  readonly inventoryItems: readonly EpochInventoryItemInfo[];
  readonly equipmentEffects: readonly EpochEquipmentEffectInfo[];
  readonly downtime: EpochProjection["downtime"][string] | null;
  readonly custody: EpochProjection["agentCustody"][string] | null;
  readonly downtimeMedia?: EpochDowntimeMedia;
  readonly pendingDowntime: EpochPendingDowntimePreviewInfo | null;
  readonly actionEligibility: EpochActionEligibilityInfo;
  readonly claimableLegendNews: readonly EpochClaimableLegendNewsInfo[];
  readonly downtimeDiaryEntries: readonly EpochDowntimeDiaryEntry[];
  readonly personalityDrifts: readonly EpochPersonalityDrift[];
  readonly factionStandings: readonly EpochAgentFactionStanding[];
  readonly identitySlots?: EpochIdentitySlotState;
  readonly latestEvents: readonly EpochProjection["events"][number][];
}

function eventIsForAgent(event: EpochProjection["events"][number], agentId: string) {
  return event.agentId === agentId || event.aggregateId === agentId;
}

export function latestEvents(
  projection: EpochProjection,
  input: { agentId?: string; eventType?: EpochEventType; limit?: number },
) {
  const limit = Math.max(1, Math.min(Number(input.limit || 20), 100));
  return projection.events
    .filter((event) => !input.agentId || eventIsForAgent(event, input.agentId))
    .filter((event) => !input.eventType || event.eventType === input.eventType)
    .slice(-limit)
    .reverse();
}

export function inventoryItemsView(
  projection: EpochProjection,
  input: { agentId?: string; explorerId?: string; bound?: boolean; tradable?: boolean } = {},
) {
  const itemIds = input.agentId
    ? projection.inventoryItemIdsByAgent[input.agentId] || []
    : input.explorerId
      ? projection.inventoryItemIdsByExplorer[input.explorerId] || []
      : Object.keys(projection.inventoryItems);
  return itemIds
    .map((itemId) => projection.inventoryItems[itemId])
    .filter(Boolean)
    .filter((item) => input.bound === undefined || item.bound === input.bound)
    .filter((item) => !input.tradable || (!item.bound && !item.marketLockedByOrderId))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt) || left.itemId.localeCompare(right.itemId))
    .map((item): EpochInventoryItemInfo => {
      const media = epochItemMediaForKey(item.itemKey);
      return media ? { ...item, media } : item;
    });
}

export function equipmentEffectsView(
  projection: EpochProjection,
  agentId?: string,
): readonly EpochEquipmentEffectInfo[] {
  if (!agentId) return [];
  const countedItemKeys = new Set<string>();
  const effects: EpochEquipmentEffectInfo[] = [];
  for (const itemId of projection.inventoryItemIdsByAgent[agentId] || []) {
    const item = projection.inventoryItems[itemId];
    if (!item?.bound || countedItemKeys.has(item.itemKey)) continue;
    const effect = INVENTORY_ITEM_EFFECTS[item.itemKey];
    if (!effect || effect.resourceNodeScoreBonus <= 0) continue;
    countedItemKeys.add(item.itemKey);
    effects.push({
      itemId: item.itemId,
      itemKey: item.itemKey,
      displayName: item.displayName,
      label: effect.label,
      resourceNodeScoreBonus: effect.resourceNodeScoreBonus,
    });
  }
  return effects;
}

export function claimableLegendNewsView(
  projection: EpochProjection,
  agentId?: string,
): readonly EpochClaimableLegendNewsInfo[] {
  if (!agentId) return [];
  const identity = projection.identities[agentId];
  if (!identity || identity.status !== "active") return [];
  return Object.values(projection.regionNews)
    .flat()
    .filter((news) => news.moderationStatus === "visible")
    .filter((news) => sourceEventsMentionAgent(projection, news.sourceEventIds, agentId))
    .filter((news) => !(projection.legendAwardIdsByNews[news.newsId] || [])
      .map((awardId) => projection.legendAwards[awardId])
      .some((award) => award?.agentId === agentId))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt) || right.newsId.localeCompare(left.newsId))
    .map((news) => ({
      ...withRegionNewsMedia(news),
      amount: Math.max(1, news.legendDelta || 1),
    }));
}

export function personalityDriftsView(
  projection: EpochProjection,
  agentId?: string,
  limit = 8,
): readonly EpochPersonalityDrift[] {
  if (!agentId) return [];
  return (projection.personalityDriftIdsByAgent[agentId] || [])
    .map((driftId) => projection.personalityDrifts[driftId])
    .filter(Boolean)
    .sort((left, right) => right.proposedAt.localeCompare(left.proposedAt) || left.driftId.localeCompare(right.driftId))
    .slice(0, Math.max(1, Math.min(limit, 50)));
}

export function progressView(
  projection: EpochProjection,
  input: { agentId?: string; explorerId?: string; limit?: number; now: string; maxDowntimeSeconds?: number },
): EpochProgressView {
  const identity = input.agentId ? projection.identities[input.agentId] : undefined;
  const explorerId = input.explorerId || identity?.explorerId;
  const lineage = explorerId ? projection.lineage[explorerId] || [] : [];
  const identities = lineage.map((agentId) => projection.identities[agentId]).filter(Boolean);
  const diaryLimit = Math.max(1, Math.min(Number(input.limit || 8), 50));
  const downtime = input.agentId ? projection.downtime[input.agentId] || null : null;
  const custody = input.agentId ? projection.agentCustody[input.agentId] || null : null;
  const downtimeMedia = downtime ? epochDowntimeMediaForMode(downtime.mode) : undefined;
  const pendingDowntime = previewEpochDowntime({
    downtime,
    now: input.now,
    maxDowntimeSeconds: input.maxDowntimeSeconds,
  });
  return {
    agentId: input.agentId,
    explorerId,
    identity,
    lineage,
    identities,
    resources: input.agentId ? projection.resourceBalances[input.agentId] || {} : {},
    attributes: input.agentId ? projection.attributeScores[input.agentId] || {} : {},
    resourceMedia: epochResourceMediaMap(),
    inventoryItems: inventoryItemsView(projection, {
      agentId: input.agentId,
      explorerId: input.agentId ? undefined : explorerId,
    }),
    equipmentEffects: equipmentEffectsView(projection, input.agentId),
    downtime,
    custody,
    downtimeMedia,
    pendingDowntime: pendingDowntime
      ? {
        ...pendingDowntime,
        media: epochDowntimeMediaForMode(pendingDowntime.mode),
      }
      : null,
    actionEligibility: actionEligibilityView(identity),
    claimableLegendNews: claimableLegendNewsView(projection, input.agentId),
    downtimeDiaryEntries: input.agentId
      ? (projection.downtimeDiaryIdsByAgent[input.agentId] || [])
        .map((diaryId) => projection.downtimeDiaryEntries[diaryId])
        .filter(Boolean)
        .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt) || right.diaryId.localeCompare(left.diaryId))
        .slice(0, diaryLimit)
      : [],
    personalityDrifts: personalityDriftsView(projection, input.agentId, diaryLimit),
    factionStandings: input.agentId
      ? (projection.factionStandingIdsByAgent[input.agentId] || [])
        .map((standingId) => projection.agentFactionStandings[standingId])
        .filter(Boolean)
        .sort((left, right) => right.score - left.score
          || right.updatedAt.localeCompare(left.updatedAt)
          || left.factionId.localeCompare(right.factionId))
      : [],
    identitySlots: explorerId ? identitySlotsForExplorer(projection, explorerId) : undefined,
    latestEvents: latestEvents(projection, {
      agentId: input.agentId,
      limit: input.limit,
    }),
  };
}
