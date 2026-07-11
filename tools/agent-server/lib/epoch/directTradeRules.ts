import {
  type EpochEvent,
  type DirectTradeAcceptedPayload,
  type DirectTradeAssetPayload,
  type DirectTradeCancelledPayload,
  type DirectTradeCreatedPayload,
  type DirectTradeExpiredPayload,
  type ItemTransferredPayload,
  type ResourceGrantedPayload,
  type ResourceSpentPayload,
} from "./events.ts";
import type { EpochEventFactory } from "./eventFactory.ts";
import { itemTransferredEvent } from "./inventoryItemLedgerEvents.ts";
import { type EpochMarketTradeRiskFlag, type EpochResourceId } from "./protocol.ts";
import { resourceGrantedEvent, resourceSpentEvent } from "./resourceLedgerEvents.ts";

export const DIRECT_TRADE_REPEAT_COUNTERPARTY_WINDOW_SECONDS = 60 * 60;

export type DirectTradeAssetKind = "resource" | "item";

export interface DirectTradeAsset {
  readonly kind: DirectTradeAssetKind;
  readonly resourceId?: EpochResourceId;
  readonly amount?: number;
  readonly itemId?: string;
  readonly itemKey?: string;
  readonly itemDisplayName?: string;
  readonly itemRarity?: string;
}

export interface DirectTradeItemForRules {
  readonly itemId: string;
  readonly itemKey: string;
  readonly displayName: string;
  readonly rarity: string;
}

export interface DirectTradeForRules {
  readonly tradeId: string;
  readonly regionId: string;
  readonly proposerAgentId: string;
  readonly proposerExplorerId: string;
  readonly counterpartyAgentId: string;
  readonly counterpartyExplorerId: string;
  readonly offeredAsset: DirectTradeAsset;
  readonly requestedAsset: DirectTradeAsset;
  readonly status: "open" | "accepted" | "cancelled" | "expired";
  readonly acceptedAt?: string;
}

export interface DirectTradeStatusForRules {
  readonly status: string;
}

export interface DirectTradeProjectionForRules<TTrade extends DirectTradeStatusForRules = DirectTradeStatusForRules> {
  readonly directTrades: Readonly<Record<string, TTrade | undefined>>;
}

export interface DirectTradeRisk {
  readonly flags: readonly EpochMarketTradeRiskFlag[];
  readonly score: number;
}

export interface DirectTradeResourceSettlementAsset {
  readonly resourceId: EpochResourceId;
  readonly amount: number;
}

export interface DirectTradeResourceRefundAsset extends DirectTradeResourceSettlementAsset {}

export interface DirectTradeRequestedResourcePaymentPayloadsInput {
  readonly trade: DirectTradeForRules;
  readonly counterpartyBalanceAfter: number;
  readonly proposerBalanceAfter: number;
}

export interface DirectTradeRequestedResourcePaymentPayloads {
  readonly spend: ResourceSpentPayload;
  readonly grant: ResourceGrantedPayload;
}

export interface DirectTradeExpirySelectionInput {
  readonly tickedAt: string;
  readonly maxAgeSeconds?: number;
  readonly limit?: number;
}

export interface DirectTradeExpiryCandidateLike {
  readonly tradeId: string;
  readonly status: "open" | "accepted" | "cancelled" | "expired";
  readonly createdAt: string;
}

export interface DirectTradeCreatedPayloadInput {
  readonly tradeId: string;
  readonly regionId: string;
  readonly proposerAgentId: string;
  readonly proposerExplorerId: string;
  readonly counterpartyAgentId: string;
  readonly counterpartyExplorerId: string;
  readonly offeredAsset: DirectTradeAsset;
  readonly requestedAsset: DirectTradeAsset;
  readonly createdAt: string;
}

export interface DirectTradeCreationEventsInput extends DirectTradeCreatedPayloadInput {
  readonly proposerOfferBalanceBefore: number;
  readonly makeEvent: EpochEventFactory;
}

export interface DirectTradeProjectionInput<TTrade extends DirectTradeStatusForRules> {
  readonly projection: Pick<DirectTradeProjectionForRules<TTrade>, "directTrades">;
  readonly events: readonly EpochEvent[];
}

export interface DirectTradeAcceptedPayloadInput {
  readonly trade: DirectTradeForRules;
  readonly counterpartyAgentId: string;
  readonly counterpartyExplorerId: string;
  readonly transferredOfferedItemId?: string;
  readonly transferredRequestedItemId?: string;
  readonly tradeRisk: DirectTradeRisk;
  readonly acceptedAt: string;
}

export interface DirectTradeAcceptanceEventsInput {
  readonly trade: DirectTradeForRules;
  readonly counterpartyAgentId: string;
  readonly counterpartyExplorerId: string;
  readonly proposerExplorerId: string;
  readonly counterpartyRequestedBalanceBefore: (resourceId: EpochResourceId) => number;
  readonly proposerRequestedBalanceBefore: (resourceId: EpochResourceId) => number;
  readonly counterpartyOfferedBalanceBefore: (resourceId: EpochResourceId) => number;
  readonly transferredOfferedItemId?: string;
  readonly transferredRequestedItemId?: string;
  readonly tradeRisk: DirectTradeRisk;
  readonly acceptedAt: string;
  readonly makeEvent: EpochEventFactory;
}

export interface DirectTradeItemTransferPayloadInput {
  readonly trade: DirectTradeForRules;
  readonly itemId: string;
  readonly transferredAt: string;
}

export type DirectTradeOfferedResourceRefundReason = "cancel" | "expired";

export interface DirectTradeCancellationEventsInput {
  readonly trade: DirectTradeForRules;
  readonly cancelledAt: string;
  readonly proposerRefundBalanceBefore: (resourceId: EpochResourceId) => number;
  readonly makeEvent: EpochEventFactory;
}

export interface DirectTradeExpiryEventsInput {
  readonly trade: DirectTradeForRules;
  readonly expiredAt: string;
  readonly maxAgeSeconds: number;
  readonly proposerRefundBalanceBefore: (resourceId: EpochResourceId) => number;
  readonly makeEvent: EpochEventFactory;
}

export function directTradeExpiryLimit(value: number | undefined): number {
  return Math.max(1, Math.min(Number(value || 25), 100));
}

export function directTradeExpiryMaxAgeSeconds(value: number | undefined): number {
  return Math.max(1, Number(value || 24 * 60 * 60));
}

export function selectExpiredDirectTradeTargets<TTrade extends DirectTradeExpiryCandidateLike>(
  directTradesById: Readonly<Record<string, TTrade>>,
  input: DirectTradeExpirySelectionInput,
): readonly TTrade[] {
  const maxAgeSeconds = directTradeExpiryMaxAgeSeconds(input.maxAgeSeconds);
  const limit = directTradeExpiryLimit(input.limit);
  return Object.values(directTradesById)
    .filter((trade) => trade.status === "open")
    .filter((trade) => Math.floor((Date.parse(input.tickedAt) - Date.parse(trade.createdAt)) / 1_000) >= maxAgeSeconds)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.tradeId.localeCompare(right.tradeId))
    .slice(0, limit);
}

export function requireDirectTrade<TTrade extends DirectTradeStatusForRules>(
  projection: DirectTradeProjectionForRules<TTrade>,
  tradeId: string,
): TTrade {
  const trade = projection.directTrades[tradeId];
  if (!trade) throw new Error("direct_trade_not_found");
  return trade;
}

export function requireOpenDirectTrade<TTrade extends DirectTradeStatusForRules>(
  projection: DirectTradeProjectionForRules<TTrade>,
  tradeId: string,
): TTrade {
  const trade = requireDirectTrade(projection, tradeId);
  if (trade.status !== "open") throw new Error("direct_trade_not_open");
  return trade;
}

export function directTradeResourceAsset(resourceId: EpochResourceId, amount: number): DirectTradeAsset {
  return { kind: "resource", resourceId, amount };
}

export function directTradeItemAsset(item: DirectTradeItemForRules): DirectTradeAsset {
  return {
    kind: "item",
    itemId: item.itemId,
    itemKey: item.itemKey,
    itemDisplayName: item.displayName,
    itemRarity: item.rarity,
  };
}

export function directTradeAssetFromPayload(payload: DirectTradeAssetPayload): DirectTradeAsset {
  if (payload.kind === "resource") {
    if (!payload.resourceId || !payload.amount) throw new Error("direct_trade_resource_asset_invalid");
    return directTradeResourceAsset(payload.resourceId, payload.amount);
  }
  if (!payload.itemId) throw new Error("direct_trade_item_asset_invalid");
  return {
    kind: "item",
    itemId: payload.itemId,
    itemKey: payload.itemKey,
    itemDisplayName: payload.itemDisplayName,
    itemRarity: payload.itemRarity,
  };
}

export function directTradeAssetPayload(asset: DirectTradeAsset): DirectTradeAssetPayload {
  if (asset.kind === "resource") {
    if (!asset.resourceId || !asset.amount) throw new Error("direct_trade_resource_asset_invalid");
    return { kind: "resource", resourceId: asset.resourceId, amount: asset.amount };
  }
  if (!asset.itemId) throw new Error("direct_trade_item_asset_invalid");
  return {
    kind: "item",
    itemId: asset.itemId,
    itemKey: asset.itemKey,
    itemDisplayName: asset.itemDisplayName,
    itemRarity: asset.itemRarity,
  };
}

export function directTradeAssetLabel(asset: DirectTradeAsset): string {
  return asset.kind === "item"
    ? asset.itemDisplayName || asset.itemKey || asset.itemId || "物品"
    : `${asset.amount} ${asset.resourceId}`;
}

export function directTradeRisk(
  directTrades: Readonly<Record<string, DirectTradeForRules>>,
  trade: DirectTradeForRules,
  counterpartyAgentId: string,
  acceptedAt: string,
): DirectTradeRisk {
  const tradePairKey = directTradeCounterpartyKey(trade.proposerAgentId, counterpartyAgentId);
  const hasRecentDirectTrade = Object.values(directTrades).some((candidate) => {
    if (candidate.status !== "accepted" || !candidate.acceptedAt) return false;
    if (directTradeCounterpartyKey(candidate.proposerAgentId, candidate.counterpartyAgentId) !== tradePairKey) {
      return false;
    }
    const elapsedSeconds = Math.floor((Date.parse(acceptedAt) - Date.parse(candidate.acceptedAt)) / 1_000);
    return elapsedSeconds >= 0 && elapsedSeconds <= DIRECT_TRADE_REPEAT_COUNTERPARTY_WINDOW_SECONDS;
  });
  const flags: EpochMarketTradeRiskFlag[] = hasRecentDirectTrade ? ["repeat_counterparty_trade"] : [];
  return { flags, score: flags.length };
}

export function directTradeCreatedPayload(input: DirectTradeCreatedPayloadInput): DirectTradeCreatedPayload {
  return {
    tradeId: input.tradeId,
    regionId: input.regionId,
    proposerAgentId: input.proposerAgentId,
    proposerExplorerId: input.proposerExplorerId,
    counterpartyAgentId: input.counterpartyAgentId,
    counterpartyExplorerId: input.counterpartyExplorerId,
    offeredAsset: directTradeAssetPayload(input.offeredAsset),
    requestedAsset: directTradeAssetPayload(input.requestedAsset),
    createdAt: input.createdAt,
  };
}

export function planDirectTradeCreationEvents(input: DirectTradeCreationEventsInput): readonly EpochEvent[] {
  const created = input.makeEvent("direct_trade_created", input.tradeId, directTradeCreatedPayload({
    tradeId: input.tradeId,
    regionId: input.regionId,
    proposerAgentId: input.proposerAgentId,
    proposerExplorerId: input.proposerExplorerId,
    counterpartyAgentId: input.counterpartyAgentId,
    counterpartyExplorerId: input.counterpartyExplorerId,
    offeredAsset: input.offeredAsset,
    requestedAsset: input.requestedAsset,
    createdAt: input.createdAt,
  }), {
    aggregateType: "direct_trade",
    agentId: input.proposerAgentId,
  });
  if (input.offeredAsset.kind !== "resource") return [created];
  const offeredAsset = requireDirectTradeResourceAsset(input.offeredAsset);
  return [
    resourceSpentEvent(input.makeEvent, input.proposerAgentId, directTradeOfferedResourceLockSpendPayload(
      input.tradeId,
      offeredAsset.resourceId,
      offeredAsset.amount,
      input.proposerOfferBalanceBefore - offeredAsset.amount,
    )),
    created,
  ];
}

export function projectDirectTradeCreation<TTrade extends DirectTradeStatusForRules>(
  input: DirectTradeProjectionInput<TTrade>,
): TTrade {
  const created = input.events.find((event) => event.eventType === "direct_trade_created");
  if (!created || created.eventType !== "direct_trade_created") {
    throw new Error("direct_trade_created_event_missing");
  }
  const trade = input.projection.directTrades[created.payload.tradeId];
  if (!trade) throw new Error("direct_trade_projection_failed");
  return trade;
}

export function directTradeAcceptedPayload(input: DirectTradeAcceptedPayloadInput): DirectTradeAcceptedPayload {
  return {
    tradeId: input.trade.tradeId,
    regionId: input.trade.regionId,
    proposerAgentId: input.trade.proposerAgentId,
    proposerExplorerId: input.trade.proposerExplorerId,
    counterpartyAgentId: input.counterpartyAgentId,
    counterpartyExplorerId: input.counterpartyExplorerId,
    transferredOfferedItemId: input.transferredOfferedItemId,
    transferredRequestedItemId: input.transferredRequestedItemId,
    tradeRiskFlags: input.tradeRisk.flags,
    tradeRiskScore: input.tradeRisk.score,
    acceptedAt: input.acceptedAt,
  };
}

export function planDirectTradeAcceptanceEvents(input: DirectTradeAcceptanceEventsInput): readonly EpochEvent[] {
  const nextEvents: EpochEvent[] = [];
  const requestedPaymentAsset = directTradeRequestedResourcePaymentAsset(input.trade);
  if (requestedPaymentAsset) {
    const paymentPayloads = directTradeRequestedResourcePaymentPayloads({
      trade: input.trade,
      counterpartyBalanceAfter: input.counterpartyRequestedBalanceBefore(requestedPaymentAsset.resourceId)
        - requestedPaymentAsset.amount,
      proposerBalanceAfter: input.proposerRequestedBalanceBefore(requestedPaymentAsset.resourceId)
        + requestedPaymentAsset.amount,
    });
    if (!paymentPayloads) throw new Error("direct_trade_resource_asset_invalid");
    nextEvents.push(resourceSpentEvent(input.makeEvent, input.counterpartyAgentId, paymentPayloads.spend));
    nextEvents.push(resourceGrantedEvent(input.makeEvent, input.trade.proposerAgentId, paymentPayloads.grant));
  }

  const offeredGoodsAsset = directTradeOfferedResourceGoodsAsset(input.trade);
  if (offeredGoodsAsset) {
    const goodsPayload = directTradeOfferedResourceGoodsGrantPayload(
      input.trade,
      input.counterpartyOfferedBalanceBefore(offeredGoodsAsset.resourceId) + offeredGoodsAsset.amount,
    );
    if (goodsPayload) nextEvents.push(resourceGrantedEvent(input.makeEvent, input.counterpartyAgentId, goodsPayload));
  }

  const tradeWithCounterpartyExplorer = {
    ...input.trade,
    counterpartyExplorerId: input.counterpartyExplorerId,
  };
  const offeredTransferPayload = input.transferredOfferedItemId
    ? directTradeOfferedItemTransferPayload({
      trade: tradeWithCounterpartyExplorer,
      itemId: input.transferredOfferedItemId,
      transferredAt: input.acceptedAt,
    })
    : undefined;
  if (input.transferredOfferedItemId && offeredTransferPayload) {
    nextEvents.push(itemTransferredEvent(
      input.makeEvent,
      input.transferredOfferedItemId,
      offeredTransferPayload,
      input.counterpartyAgentId,
    ));
  }

  const tradeWithProposerExplorer = {
    ...tradeWithCounterpartyExplorer,
    proposerExplorerId: input.proposerExplorerId,
  };
  const requestedTransferPayload = input.transferredRequestedItemId
    ? directTradeRequestedItemTransferPayload({
      trade: tradeWithProposerExplorer,
      itemId: input.transferredRequestedItemId,
      transferredAt: input.acceptedAt,
    })
    : undefined;
  if (input.transferredRequestedItemId && requestedTransferPayload) {
    nextEvents.push(itemTransferredEvent(
      input.makeEvent,
      input.transferredRequestedItemId,
      requestedTransferPayload,
      input.trade.proposerAgentId,
    ));
  }

  const accepted = input.makeEvent("direct_trade_accepted", input.trade.tradeId, directTradeAcceptedPayload({
    trade: input.trade,
    counterpartyAgentId: input.counterpartyAgentId,
    counterpartyExplorerId: input.counterpartyExplorerId,
    transferredOfferedItemId: input.transferredOfferedItemId,
    transferredRequestedItemId: input.transferredRequestedItemId,
    tradeRisk: input.tradeRisk,
    acceptedAt: input.acceptedAt,
  }), {
    aggregateType: "direct_trade",
    agentId: input.counterpartyAgentId,
  });
  nextEvents.push(accepted);
  return nextEvents;
}

export function projectDirectTradeAcceptance<TTrade extends DirectTradeStatusForRules>(
  input: DirectTradeProjectionInput<TTrade>,
): TTrade {
  const accepted = input.events.find((event) => event.eventType === "direct_trade_accepted");
  if (!accepted || accepted.eventType !== "direct_trade_accepted") {
    throw new Error("direct_trade_accepted_event_missing");
  }
  const trade = input.projection.directTrades[accepted.payload.tradeId];
  if (!trade) throw new Error("direct_trade_projection_failed");
  return trade;
}

export function directTradeOfferedResourceLockSpendPayload(
  tradeId: string,
  resourceId: EpochResourceId,
  amount: number,
  balanceAfter: number,
): ResourceSpentPayload {
  return {
    resourceId,
    amount,
    reason: `direct_trade_lock:${tradeId}`,
    balanceAfter,
  };
}

export function directTradeRequestedResourcePaymentSpendPayload(
  trade: DirectTradeForRules,
  balanceAfter: number,
): ResourceSpentPayload {
  const requestedAsset = requireDirectTradeResourceAsset(trade.requestedAsset);
  return {
    resourceId: requestedAsset.resourceId,
    amount: requestedAsset.amount,
    reason: `direct_trade_payment:${trade.tradeId}`,
    balanceAfter,
  };
}

export function directTradeRequestedResourcePaymentGrantPayload(
  trade: DirectTradeForRules,
  balanceAfter: number,
): ResourceGrantedPayload {
  const requestedAsset = requireDirectTradeResourceAsset(trade.requestedAsset);
  return {
    resourceId: requestedAsset.resourceId,
    amount: requestedAsset.amount,
    reason: `direct_trade_payment:${trade.tradeId}`,
    balanceAfter,
  };
}

export function directTradeOfferedResourceGoodsGrantPayload(
  trade: DirectTradeForRules,
  balanceAfter: number,
): ResourceGrantedPayload | undefined {
  const offeredAsset = directTradeOfferedResourceGoodsAsset(trade);
  if (!offeredAsset) return undefined;
  return {
    resourceId: offeredAsset.resourceId,
    amount: offeredAsset.amount,
    reason: `direct_trade_goods:${trade.tradeId}`,
    balanceAfter,
  };
}

export function directTradeRequestedResourcePaymentAsset(
  trade: DirectTradeForRules,
): DirectTradeResourceSettlementAsset | undefined {
  if (trade.requestedAsset.kind !== "resource") return undefined;
  return requireDirectTradeResourceAsset(trade.requestedAsset);
}

export function directTradeOfferedResourceGoodsAsset(
  trade: DirectTradeForRules,
): DirectTradeResourceSettlementAsset | undefined {
  if (trade.offeredAsset.kind !== "resource") return undefined;
  return requireDirectTradeResourceAsset(trade.offeredAsset);
}

export function directTradeRequestedResourcePaymentPayloads(
  input: DirectTradeRequestedResourcePaymentPayloadsInput,
): DirectTradeRequestedResourcePaymentPayloads | undefined {
  if (!directTradeRequestedResourcePaymentAsset(input.trade)) return undefined;
  return {
    spend: directTradeRequestedResourcePaymentSpendPayload(input.trade, input.counterpartyBalanceAfter),
    grant: directTradeRequestedResourcePaymentGrantPayload(input.trade, input.proposerBalanceAfter),
  };
}

export function directTradeOfferedItemTransferPayload(
  input: DirectTradeItemTransferPayloadInput,
): ItemTransferredPayload {
  return {
    itemId: input.itemId,
    fromAgentId: input.trade.proposerAgentId,
    fromExplorerId: input.trade.proposerExplorerId,
    toAgentId: input.trade.counterpartyAgentId,
    toExplorerId: input.trade.counterpartyExplorerId,
    sourceOrderId: input.trade.tradeId,
    transferredAt: input.transferredAt,
  };
}

export function directTradeRequestedItemTransferPayload(
  input: DirectTradeItemTransferPayloadInput,
): ItemTransferredPayload {
  return {
    itemId: input.itemId,
    fromAgentId: input.trade.counterpartyAgentId,
    fromExplorerId: input.trade.counterpartyExplorerId,
    toAgentId: input.trade.proposerAgentId,
    toExplorerId: input.trade.proposerExplorerId,
    sourceOrderId: input.trade.tradeId,
    transferredAt: input.transferredAt,
  };
}

export function directTradeCancelledPayload(trade: DirectTradeForRules, cancelledAt: string): DirectTradeCancelledPayload {
  return {
    tradeId: trade.tradeId,
    regionId: trade.regionId,
    proposerAgentId: trade.proposerAgentId,
    cancelledAt,
  };
}

export function planDirectTradeCancellationEvents(input: DirectTradeCancellationEventsInput): readonly EpochEvent[] {
  const refundAsset = directTradeOfferedResourceRefundAsset(input.trade);
  const refundPayload = refundAsset
    ? directTradeOfferedResourceRefundPayload(
      input.trade,
      "cancel",
      input.proposerRefundBalanceBefore(refundAsset.resourceId) + refundAsset.amount,
    )
    : undefined;
  const refund = refundPayload
    ? resourceGrantedEvent(input.makeEvent, input.trade.proposerAgentId, refundPayload)
    : undefined;
  const cancelled = input.makeEvent(
    "direct_trade_cancelled",
    input.trade.tradeId,
    directTradeCancelledPayload(input.trade, input.cancelledAt),
    {
      aggregateType: "direct_trade",
      agentId: input.trade.proposerAgentId,
    },
  );
  return [refund, cancelled].filter((event): event is EpochEvent => Boolean(event));
}

export function projectDirectTradeCancellation<TTrade extends DirectTradeStatusForRules>(
  input: DirectTradeProjectionInput<TTrade>,
): TTrade {
  const cancelled = input.events.find((event) => event.eventType === "direct_trade_cancelled");
  if (!cancelled || cancelled.eventType !== "direct_trade_cancelled") {
    throw new Error("direct_trade_cancelled_event_missing");
  }
  const trade = input.projection.directTrades[cancelled.payload.tradeId];
  if (!trade) throw new Error("direct_trade_projection_failed");
  return trade;
}

export function directTradeExpiredPayload(
  trade: DirectTradeForRules,
  expiredAt: string,
  maxAgeSeconds: number,
): DirectTradeExpiredPayload {
  return {
    tradeId: trade.tradeId,
    regionId: trade.regionId,
    proposerAgentId: trade.proposerAgentId,
    expiredAt,
    maxAgeSeconds,
  };
}

export function planDirectTradeExpiryEvents(input: DirectTradeExpiryEventsInput): readonly EpochEvent[] {
  const refundAsset = directTradeOfferedResourceRefundAsset(input.trade);
  const refundPayload = refundAsset
    ? directTradeOfferedResourceRefundPayload(
      input.trade,
      "expired",
      input.proposerRefundBalanceBefore(refundAsset.resourceId) + refundAsset.amount,
    )
    : undefined;
  const refund = refundPayload
    ? resourceGrantedEvent(input.makeEvent, input.trade.proposerAgentId, refundPayload)
    : undefined;
  const expired = input.makeEvent(
    "direct_trade_expired",
    input.trade.tradeId,
    directTradeExpiredPayload(input.trade, input.expiredAt, input.maxAgeSeconds),
    {
      aggregateType: "direct_trade",
      agentId: input.trade.proposerAgentId,
    },
  );
  return [refund, expired].filter((event): event is EpochEvent => Boolean(event));
}

export function projectDirectTradeExpiry<TTrade extends DirectTradeStatusForRules>(
  input: DirectTradeProjectionInput<TTrade>,
): TTrade {
  const expired = input.events.find((event) => event.eventType === "direct_trade_expired");
  if (!expired || expired.eventType !== "direct_trade_expired") {
    throw new Error("direct_trade_expired_event_missing");
  }
  const trade = input.projection.directTrades[expired.payload.tradeId];
  if (!trade) throw new Error("direct_trade_projection_failed");
  return trade;
}

export function directTradeOfferedResourceRefundAsset(
  trade: DirectTradeForRules,
): DirectTradeResourceRefundAsset | undefined {
  return directTradeOfferedResourceGoodsAsset(trade);
}

export function directTradeOfferedResourceRefundPayload(
  trade: DirectTradeForRules,
  refundReason: DirectTradeOfferedResourceRefundReason,
  balanceAfter: number,
): ResourceGrantedPayload | undefined {
  const refundAsset = directTradeOfferedResourceRefundAsset(trade);
  if (!refundAsset) return undefined;
  return {
    resourceId: refundAsset.resourceId,
    amount: refundAsset.amount,
    reason: `direct_trade_${refundReason}:${trade.tradeId}`,
    balanceAfter,
  };
}

function directTradeCounterpartyKey(firstAgentId: string, secondAgentId: string): string {
  return [firstAgentId, secondAgentId].sort((left, right) => left.localeCompare(right)).join(":");
}

function requireDirectTradeResourceAsset(asset: DirectTradeAsset): DirectTradeResourceSettlementAsset {
  if (asset.kind !== "resource" || !asset.resourceId || !asset.amount) {
    throw new Error("direct_trade_resource_asset_invalid");
  }
  return {
    resourceId: asset.resourceId,
    amount: asset.amount,
  };
}
