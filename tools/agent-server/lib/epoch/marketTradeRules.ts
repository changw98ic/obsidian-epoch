import {
  type EpochEvent,
  type MarketOrderCancelledPayload,
  type MarketOrderCreatedPayload,
  type MarketOrderExpiredPayload,
  type MarketOrderFilledPayload,
  type ItemTransferredPayload,
  type ResourceGrantedPayload,
  type ResourceSpentPayload,
} from "./events.ts";
import type { EpochEventFactory } from "./eventFactory.ts";
import { itemTransferredEvent } from "./inventoryItemLedgerEvents.ts";
import { stableKey, type EpochMarketTradeRiskFlag, type EpochResourceId } from "./protocol.ts";
import { resourceGrantedEvent, resourceSpentEvent } from "./resourceLedgerEvents.ts";

export const MARKET_TRADE_FEE_BASIS_POINTS = 500;
export const MARKET_REPEAT_COUNTERPARTY_WINDOW_SECONDS = 60 * 60;
export const MARKET_PRICE_HISTORY_WINDOW_SECONDS = 24 * 60 * 60;
export const MARKET_SUSPICIOUS_LOW_PRICE_RATIO = 0.5;
export const MARKET_SUSPICIOUS_HIGH_PRICE_RATIO = 2;
export const DEFAULT_MARKET_REGION_ID = "region_gray_harbor";

export interface MarketTradeOrderForRules {
  readonly orderId: string;
  readonly regionId: string;
  readonly sellerAgentId: string;
  readonly sellerExplorerId?: string;
  readonly sellKind: "resource" | "item";
  readonly sellResourceId?: EpochResourceId;
  readonly sellAmount: number;
  readonly sellItemId?: string;
  readonly sellItemKey?: string;
  readonly sellItemDisplayName?: string;
  readonly sellItemRarity?: string;
  readonly priceResourceId: EpochResourceId;
  readonly priceAmount: number;
  readonly status: "open" | "filled" | "cancelled" | "expired";
  readonly buyerAgentId?: string;
  readonly tradeRiskFlags?: readonly EpochMarketTradeRiskFlag[];
  readonly filledAt?: string;
}

export interface MarketTradeProjectionForRules {
  readonly marketOrders: Readonly<Record<string, MarketTradeOrderForRules>>;
}

export interface MarketOrderStatusForRules {
  readonly status: string;
}

export interface MarketOrderProjectionForRules<TOrder extends MarketOrderStatusForRules = MarketOrderStatusForRules> {
  readonly marketOrders: Readonly<Record<string, TOrder | undefined>>;
}

export interface MarketRiskRestrictionProjectionForRules {
  readonly marketRiskRestrictions: Readonly<Record<string, unknown>>;
}

export interface MarketTradeRisk {
  readonly flags: readonly EpochMarketTradeRiskFlag[];
  readonly score: number;
}

export interface MarketOrderRefundAsset {
  readonly resourceId: EpochResourceId;
  readonly amount: number;
}

export interface MarketOrderPaymentPayloadsInput {
  readonly order: MarketTradeOrderForRules;
  readonly buyerAgentId: string;
  readonly sellerAgentId: string;
  readonly buyerBalanceAfter: number;
  readonly sellerProceedsAmount: number;
  readonly sellerBalanceAfter: number;
}

export interface MarketOrderPaymentPayloads {
  readonly spend: ResourceSpentPayload;
  readonly grant: ResourceGrantedPayload;
}

export interface MarketExpirySelectionInput {
  readonly tickedAt: string;
  readonly maxAgeSeconds?: number;
  readonly limit?: number;
}

export interface MarketExpiryOrderLike {
  readonly orderId: string;
  readonly status: "open" | "filled" | "cancelled" | "expired";
  readonly createdAt: string;
}

export interface MarketOrderListedItemForRules {
  readonly itemId: string;
  readonly itemKey: string;
  readonly displayName: string;
  readonly rarity: string;
}

export interface MarketOrderCreatedPayloadInput {
  readonly orderId: string;
  readonly regionId: string;
  readonly sellerAgentId: string;
  readonly sellerExplorerId: string;
  readonly sellKind: "resource" | "item";
  readonly sellResourceId?: EpochResourceId;
  readonly sellAmount: number;
  readonly sellItem?: MarketOrderListedItemForRules;
  readonly priceResourceId: EpochResourceId;
  readonly priceAmount: number;
  readonly createdAt: string;
}

export interface MarketOrderCreationEventsInput extends MarketOrderCreatedPayloadInput {
  readonly sellerBalanceBefore: number;
  readonly makeEvent: EpochEventFactory;
}

export interface MarketOrderCreationProjectionInput<TOrder extends MarketOrderStatusForRules> {
  readonly projection: Pick<MarketOrderProjectionForRules<TOrder>, "marketOrders">;
  readonly events: readonly EpochEvent[];
}

export interface MarketOrderFilledPayloadInput {
  readonly order: MarketTradeOrderForRules;
  readonly buyerAgentId: string;
  readonly buyerExplorerId: string;
  readonly marketFeeAmount: number;
  readonly sellerProceedsAmount: number;
  readonly transferredItemId?: string;
  readonly tradeRisk: MarketTradeRisk;
  readonly filledAt: string;
}

export interface MarketOrderFillEventsInput {
  readonly order: MarketTradeOrderForRules;
  readonly buyerAgentId: string;
  readonly buyerExplorerId: string;
  readonly buyerBalanceBefore: number;
  readonly sellerPriceBalanceBefore: number;
  readonly buyerSellBalanceBefore: number;
  readonly transferredItemId?: string;
  readonly tradeRisk: MarketTradeRisk;
  readonly filledAt: string;
  readonly makeEvent: EpochEventFactory;
}

export interface MarketOrderFillProjectionInput<TOrder extends MarketOrderStatusForRules> {
  readonly projection: Pick<MarketOrderProjectionForRules<TOrder>, "marketOrders">;
  readonly events: readonly EpochEvent[];
}

export interface MarketOrderCancellationEventsInput {
  readonly order: MarketTradeOrderForRules;
  readonly cancelledAt: string;
  readonly sellerRefundBalanceBefore: (resourceId: EpochResourceId) => number;
  readonly makeEvent: EpochEventFactory;
}

export interface MarketOrderCancellationProjectionInput<TOrder extends MarketOrderStatusForRules> {
  readonly projection: Pick<MarketOrderProjectionForRules<TOrder>, "marketOrders">;
  readonly events: readonly EpochEvent[];
}

export interface MarketOrderExpiryEventsInput {
  readonly order: MarketTradeOrderForRules;
  readonly expiredAt: string;
  readonly maxAgeSeconds: number;
  readonly sellerRefundBalanceBefore: (resourceId: EpochResourceId) => number;
  readonly makeEvent: EpochEventFactory;
}

export interface MarketOrderExpiryProjectionInput<TOrder extends MarketOrderStatusForRules> {
  readonly projection: Pick<MarketOrderProjectionForRules<TOrder>, "marketOrders">;
  readonly events: readonly EpochEvent[];
}

export interface MarketOrderItemTransferPayloadInput {
  readonly order: MarketTradeOrderForRules & { readonly sellerExplorerId: string };
  readonly itemId: string;
  readonly buyerAgentId: string;
  readonly buyerExplorerId: string;
  readonly transferredAt: string;
}

export type MarketOrderRefundReason = "cancel" | "expired";

export function normalizeMarketRegionId(regionId: unknown): string {
  const normalized = typeof regionId === "string" && regionId.trim()
    ? stableKey(regionId)
    : "";
  return normalized || DEFAULT_MARKET_REGION_ID;
}

export function marketExpiryLimit(value: number | undefined): number {
  return Math.max(1, Math.min(Number(value || 25), 100));
}

export function marketExpiryMaxAgeSeconds(value: number | undefined): number {
  return Math.max(1, Number(value || 24 * 60 * 60));
}

export function selectExpiredMarketOrders<TOrder extends MarketExpiryOrderLike>(
  marketOrdersById: Readonly<Record<string, TOrder>>,
  input: MarketExpirySelectionInput,
): readonly TOrder[] {
  const maxAgeSeconds = marketExpiryMaxAgeSeconds(input.maxAgeSeconds);
  const limit = marketExpiryLimit(input.limit);
  return Object.values(marketOrdersById)
    .filter((order) => order.status === "open")
    .filter((order) => Math.floor((Date.parse(input.tickedAt) - Date.parse(order.createdAt)) / 1_000) >= maxAgeSeconds)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.orderId.localeCompare(right.orderId))
    .slice(0, limit);
}

export function requireMarketOrder<TOrder extends MarketOrderStatusForRules>(
  projection: MarketOrderProjectionForRules<TOrder>,
  orderId: string,
): TOrder {
  const order = projection.marketOrders[orderId];
  if (!order) throw new Error("market_order_not_found");
  return order;
}

export function requireOpenMarketOrder<TOrder extends MarketOrderStatusForRules>(
  projection: MarketOrderProjectionForRules<TOrder>,
  orderId: string,
): TOrder {
  const order = requireMarketOrder(projection, orderId);
  if (order.status !== "open") throw new Error("market_order_not_open");
  return order;
}

export function assertMarketAgentNotRestricted(
  projection: MarketRiskRestrictionProjectionForRules,
  agentId: string,
): void {
  if (projection.marketRiskRestrictions[agentId]) throw new Error("market_agent_restricted");
}

export function marketTradeFeeAmount(priceAmount: number): number {
  return Math.floor((priceAmount * MARKET_TRADE_FEE_BASIS_POINTS) / 10_000);
}

export function marketSellerProceedsAmount(priceAmount: number): number {
  return priceAmount - marketTradeFeeAmount(priceAmount);
}

export function marketCounterpartyKey(firstAgentId: string, secondAgentId: string): string {
  return [firstAgentId, secondAgentId].sort((left, right) => left.localeCompare(right)).join(":");
}

export function marketUnitPrice(order: Pick<MarketTradeOrderForRules, "priceAmount" | "sellAmount">): number {
  return order.sellAmount > 0 ? order.priceAmount / order.sellAmount : 0;
}

export function marketPriceRiskFlags(
  projection: MarketTradeProjectionForRules,
  order: MarketTradeOrderForRules,
  filledAt: string,
): readonly EpochMarketTradeRiskFlag[] {
  if (order.sellKind !== "resource") return [];
  const currentUnitPrice = marketUnitPrice(order);
  if (currentUnitPrice <= 0) return [];
  const filledTime = Date.parse(filledAt);
  const cleanRecentPrices = Object.values(projection.marketOrders)
    .filter((item) => item.status === "filled"
      && item.sellResourceId === order.sellResourceId
      && item.priceResourceId === order.priceResourceId
      && item.filledAt
      && !(item.tradeRiskFlags || []).length)
    .filter((item) => {
      const elapsedSeconds = Math.floor((filledTime - Date.parse(item.filledAt || filledAt)) / 1_000);
      return elapsedSeconds >= 0 && elapsedSeconds <= MARKET_PRICE_HISTORY_WINDOW_SECONDS;
    })
    .map((item) => marketUnitPrice(item))
    .filter((unitPrice) => unitPrice > 0);
  const baselineUnitPrice = median(cleanRecentPrices);
  if (!baselineUnitPrice) return [];
  if (currentUnitPrice <= baselineUnitPrice * MARKET_SUSPICIOUS_LOW_PRICE_RATIO) return ["suspicious_low_price"];
  if (currentUnitPrice >= baselineUnitPrice * MARKET_SUSPICIOUS_HIGH_PRICE_RATIO) return ["suspicious_high_price"];
  return [];
}

export function marketTradeRisk(
  projection: MarketTradeProjectionForRules,
  order: MarketTradeOrderForRules,
  buyerAgentId: string,
  filledAt: string,
): MarketTradeRisk {
  const counterpartyKey = marketCounterpartyKey(order.sellerAgentId, buyerAgentId);
  const hasRecentCounterpartyTrade = Object.values(projection.marketOrders)
    .filter((item) => item.status === "filled" && item.buyerAgentId && item.filledAt)
    .some((item) => {
      const elapsedSeconds = Math.floor((Date.parse(filledAt) - Date.parse(item.filledAt || filledAt)) / 1_000);
      return elapsedSeconds >= 0
        && elapsedSeconds <= MARKET_REPEAT_COUNTERPARTY_WINDOW_SECONDS
        && marketCounterpartyKey(item.sellerAgentId, item.buyerAgentId || "") === counterpartyKey;
    });
  const flags: EpochMarketTradeRiskFlag[] = [
    ...(hasRecentCounterpartyTrade ? ["repeat_counterparty_trade" as const] : []),
    ...marketPriceRiskFlags(projection, order, filledAt),
  ];
  return { flags, score: flags.length };
}

export function marketOrderCreatedPayload(input: MarketOrderCreatedPayloadInput): MarketOrderCreatedPayload {
  return {
    orderId: input.orderId,
    regionId: input.regionId,
    sellerAgentId: input.sellerAgentId,
    sellerExplorerId: input.sellerExplorerId,
    sellKind: input.sellKind,
    sellResourceId: input.sellResourceId,
    sellAmount: input.sellAmount,
    sellItemId: input.sellItem?.itemId,
    sellItemKey: input.sellItem?.itemKey,
    sellItemDisplayName: input.sellItem?.displayName,
    sellItemRarity: input.sellItem?.rarity,
    priceResourceId: input.priceResourceId,
    priceAmount: input.priceAmount,
    createdAt: input.createdAt,
  };
}

export function planMarketOrderCreationEvents(input: MarketOrderCreationEventsInput): readonly EpochEvent[] {
  const createdPayload = marketOrderCreatedPayload({
    orderId: input.orderId,
    regionId: input.regionId,
    sellerAgentId: input.sellerAgentId,
    sellerExplorerId: input.sellerExplorerId,
    sellKind: input.sellKind,
    sellResourceId: input.sellResourceId,
    sellAmount: input.sellAmount,
    sellItem: input.sellItem,
    priceResourceId: input.priceResourceId,
    priceAmount: input.priceAmount,
    createdAt: input.createdAt,
  });
  const created = input.makeEvent("market_order_created", input.orderId, createdPayload, {
    aggregateType: "market_order",
    agentId: input.sellerAgentId,
  });
  if (!input.sellResourceId) return [created];
  return [
    resourceSpentEvent(input.makeEvent, input.sellerAgentId, marketOrderLockSpendPayload(
      input.orderId,
      input.sellResourceId,
      input.sellAmount,
      input.sellerBalanceBefore - input.sellAmount,
      input.sellerAgentId,
    )),
    created,
  ];
}

export function projectMarketOrderCreation<TOrder extends MarketOrderStatusForRules>(
  input: MarketOrderCreationProjectionInput<TOrder>,
): TOrder {
  const created = input.events.find((event) => event.eventType === "market_order_created");
  if (!created || created.eventType !== "market_order_created") {
    throw new Error("market_order_created_event_missing");
  }
  const order = input.projection.marketOrders[created.payload.orderId];
  if (!order) throw new Error("market_order_projection_failed");
  return order;
}

export function marketOrderFilledPayload(input: MarketOrderFilledPayloadInput): MarketOrderFilledPayload {
  return {
    orderId: input.order.orderId,
    regionId: input.order.regionId,
    buyerAgentId: input.buyerAgentId,
    buyerExplorerId: input.buyerExplorerId,
    marketFeeResourceId: input.order.priceResourceId,
    marketFeeAmount: input.marketFeeAmount,
    sellerProceedsAmount: input.sellerProceedsAmount,
    transferredItemId: input.transferredItemId,
    tradeRiskFlags: input.tradeRisk.flags,
    tradeRiskScore: input.tradeRisk.score,
    filledAt: input.filledAt,
  };
}

export function planMarketOrderFillEvents(input: MarketOrderFillEventsInput): readonly EpochEvent[] {
  const marketFeeAmount = marketTradeFeeAmount(input.order.priceAmount);
  const sellerProceedsAmount = marketSellerProceedsAmount(input.order.priceAmount);
  const paymentPayloads = marketOrderPaymentPayloads({
    order: input.order,
    buyerAgentId: input.buyerAgentId,
    sellerAgentId: input.order.sellerAgentId,
    buyerBalanceAfter: input.buyerBalanceBefore - input.order.priceAmount,
    sellerProceedsAmount,
    sellerBalanceAfter: input.sellerPriceBalanceBefore + sellerProceedsAmount,
  });
  const paymentSpent = resourceSpentEvent(input.makeEvent, input.buyerAgentId, paymentPayloads.spend);
  const paymentGranted = resourceGrantedEvent(input.makeEvent, input.order.sellerAgentId, paymentPayloads.grant);
  const goodsAsset = marketOrderGoodsGrantAsset(input.order);
  const goodsPayload = goodsAsset
    ? marketOrderGoodsGrantPayload(input.order, input.buyerSellBalanceBefore + goodsAsset.amount, input.buyerAgentId)
    : undefined;
  const goodsGranted = goodsPayload
    ? resourceGrantedEvent(input.makeEvent, input.buyerAgentId, goodsPayload)
    : undefined;
  const itemTransferPayload = input.transferredItemId && input.order.sellerExplorerId
    ? marketOrderItemTransferPayload({
      order: input.order as MarketTradeOrderForRules & { readonly sellerExplorerId: string },
      itemId: input.transferredItemId,
      buyerAgentId: input.buyerAgentId,
      buyerExplorerId: input.buyerExplorerId,
      transferredAt: input.filledAt,
    })
    : undefined;
  const itemTransferred = input.transferredItemId && itemTransferPayload
    ? itemTransferredEvent(input.makeEvent, input.transferredItemId, itemTransferPayload, input.buyerAgentId)
    : undefined;
  const filledPayload = marketOrderFilledPayload({
    order: input.order,
    buyerAgentId: input.buyerAgentId,
    buyerExplorerId: input.buyerExplorerId,
    marketFeeAmount,
    sellerProceedsAmount,
    transferredItemId: input.transferredItemId,
    tradeRisk: input.tradeRisk,
    filledAt: input.filledAt,
  });
  const filled = input.makeEvent("market_order_filled", input.order.orderId, filledPayload, {
    aggregateType: "market_order",
    agentId: input.buyerAgentId,
  });
  return [paymentSpent, paymentGranted, goodsGranted, itemTransferred, filled]
    .filter((event): event is EpochEvent => Boolean(event));
}

export function projectMarketOrderFill<TOrder extends MarketOrderStatusForRules>(
  input: MarketOrderFillProjectionInput<TOrder>,
): TOrder {
  const filled = input.events.find((event) => event.eventType === "market_order_filled");
  if (!filled || filled.eventType !== "market_order_filled") {
    throw new Error("market_order_filled_event_missing");
  }
  const order = input.projection.marketOrders[filled.payload.orderId];
  if (!order) throw new Error("market_order_projection_failed");
  return order;
}

export function marketOrderLockSpendPayload(
  orderId: string,
  resourceId: EpochResourceId,
  amount: number,
  balanceAfter: number,
  agentId: string,
): ResourceSpentPayload {
  return {
    resourceId,
    amount,
    reason: `market_order_lock:${orderId}`,
    balanceAfter,
    accountRef: `agent:${agentId}`,
    assetKey: `resource:${resourceId}`,
    unit: "unit",
    quantityMinor: (BigInt(amount) * 100n).toString(),
  };
}

export function marketOrderBuyerPaymentSpendPayload(
  order: MarketTradeOrderForRules,
  balanceAfter: number,
  agentId: string,
): ResourceSpentPayload {
  return {
    resourceId: order.priceResourceId,
    amount: order.priceAmount,
    reason: `market_order_fill:${order.orderId}`,
    balanceAfter,
    accountRef: `agent:${agentId}`,
    assetKey: `resource:${order.priceResourceId}`,
    unit: "unit",
    quantityMinor: (BigInt(order.priceAmount) * 100n).toString(),
  };
}

export function marketOrderSellerPaymentGrantPayload(
  order: MarketTradeOrderForRules,
  sellerProceedsAmount: number,
  balanceAfter: number,
  agentId: string,
): ResourceGrantedPayload {
  return {
    resourceId: order.priceResourceId,
    amount: sellerProceedsAmount,
    reason: `market_order_payment:${order.orderId}`,
    balanceAfter,
    accountRef: `agent:${agentId}`,
    assetKey: `resource:${order.priceResourceId}`,
    unit: "unit",
    quantityMinor: (BigInt(sellerProceedsAmount) * 100n).toString(),
  };
}

export function marketOrderPaymentPayloads(input: MarketOrderPaymentPayloadsInput): MarketOrderPaymentPayloads {
  return {
    spend: marketOrderBuyerPaymentSpendPayload(input.order, input.buyerBalanceAfter, input.buyerAgentId),
    grant: marketOrderSellerPaymentGrantPayload(
      input.order,
      input.sellerProceedsAmount,
      input.sellerBalanceAfter,
      input.sellerAgentId,
    ),
  };
}

export function marketOrderGoodsGrantAsset(order: MarketTradeOrderForRules): MarketOrderRefundAsset | undefined {
  if (!order.sellResourceId) return undefined;
  return {
    resourceId: order.sellResourceId,
    amount: order.sellAmount,
  };
}

export function marketOrderGoodsGrantPayload(
  order: MarketTradeOrderForRules,
  balanceAfter: number,
  agentId: string,
): ResourceGrantedPayload | undefined {
  const asset = marketOrderGoodsGrantAsset(order);
  if (!asset) return undefined;
  return {
    resourceId: asset.resourceId,
    amount: asset.amount,
    reason: `market_order_goods:${order.orderId}`,
    balanceAfter,
    accountRef: `agent:${agentId}`,
    assetKey: `resource:${asset.resourceId}`,
    unit: "unit",
    quantityMinor: (BigInt(asset.amount) * 100n).toString(),
  };
}

export function marketOrderItemTransferPayload(input: MarketOrderItemTransferPayloadInput): ItemTransferredPayload {
  return {
    itemId: input.itemId,
    fromAgentId: input.order.sellerAgentId,
    fromExplorerId: input.order.sellerExplorerId,
    toAgentId: input.buyerAgentId,
    toExplorerId: input.buyerExplorerId,
    sourceOrderId: input.order.orderId,
    transferredAt: input.transferredAt,
  };
}

export function marketOrderCancelledPayload(
  order: MarketTradeOrderForRules,
  cancelledAt: string,
): MarketOrderCancelledPayload {
  return {
    orderId: order.orderId,
    regionId: order.regionId,
    sellerAgentId: order.sellerAgentId,
    cancelledAt,
  };
}

export function planMarketOrderCancellationEvents(input: MarketOrderCancellationEventsInput): readonly EpochEvent[] {
  const refundAsset = marketOrderRefundAsset(input.order);
  const refundPayload = refundAsset
    ? marketOrderRefundPayload(
      input.order,
      "cancel",
      input.sellerRefundBalanceBefore(refundAsset.resourceId) + refundAsset.amount,
      input.order.sellerAgentId,
    )
    : undefined;
  const refund = refundPayload
    ? resourceGrantedEvent(input.makeEvent, input.order.sellerAgentId, refundPayload)
    : undefined;
  const cancelled = input.makeEvent(
    "market_order_cancelled",
    input.order.orderId,
    marketOrderCancelledPayload(input.order, input.cancelledAt),
    {
      aggregateType: "market_order",
      agentId: input.order.sellerAgentId,
    },
  );
  return [refund, cancelled].filter((event): event is EpochEvent => Boolean(event));
}

export function projectMarketOrderCancellation<TOrder extends MarketOrderStatusForRules>(
  input: MarketOrderCancellationProjectionInput<TOrder>,
): TOrder {
  const cancelled = input.events.find((event) => event.eventType === "market_order_cancelled");
  if (!cancelled || cancelled.eventType !== "market_order_cancelled") {
    throw new Error("market_order_cancelled_event_missing");
  }
  const order = input.projection.marketOrders[cancelled.payload.orderId];
  if (!order) throw new Error("market_order_projection_failed");
  return order;
}

export function marketOrderExpiredPayload(
  order: MarketTradeOrderForRules,
  expiredAt: string,
  maxAgeSeconds: number,
): MarketOrderExpiredPayload {
  return {
    orderId: order.orderId,
    regionId: order.regionId,
    sellerAgentId: order.sellerAgentId,
    expiredAt,
    maxAgeSeconds,
  };
}

export function planMarketOrderExpiryEvents(input: MarketOrderExpiryEventsInput): readonly EpochEvent[] {
  const refundAsset = marketOrderRefundAsset(input.order);
  const refundPayload = refundAsset
    ? marketOrderRefundPayload(
      input.order,
      "expired",
      input.sellerRefundBalanceBefore(refundAsset.resourceId) + refundAsset.amount,
      input.order.sellerAgentId,
    )
    : undefined;
  const refund = refundPayload
    ? resourceGrantedEvent(input.makeEvent, input.order.sellerAgentId, refundPayload)
    : undefined;
  const expired = input.makeEvent(
    "market_order_expired",
    input.order.orderId,
    marketOrderExpiredPayload(input.order, input.expiredAt, input.maxAgeSeconds),
    {
      aggregateType: "market_order",
      agentId: input.order.sellerAgentId,
    },
  );
  return [refund, expired].filter((event): event is EpochEvent => Boolean(event));
}

export function projectMarketOrderExpiry<TOrder extends MarketOrderStatusForRules>(
  input: MarketOrderExpiryProjectionInput<TOrder>,
): TOrder {
  const expired = input.events.find((event) => event.eventType === "market_order_expired");
  if (!expired || expired.eventType !== "market_order_expired") {
    throw new Error("market_order_expired_event_missing");
  }
  const order = input.projection.marketOrders[expired.payload.orderId];
  if (!order) throw new Error("market_order_projection_failed");
  return order;
}

export function marketOrderRefundAsset(order: MarketTradeOrderForRules): MarketOrderRefundAsset | undefined {
  if (!order.sellResourceId) return undefined;
  return {
    resourceId: order.sellResourceId,
    amount: order.sellAmount,
  };
}

export function marketOrderRefundPayload(
  order: MarketTradeOrderForRules,
  refundReason: MarketOrderRefundReason,
  balanceAfter: number,
  agentId: string,
): ResourceGrantedPayload | undefined {
  const refundAsset = marketOrderRefundAsset(order);
  if (!refundAsset) return undefined;
  return {
    resourceId: refundAsset.resourceId,
    amount: refundAsset.amount,
    reason: `market_order_${refundReason}:${order.orderId}`,
    balanceAfter,
    accountRef: `agent:${agentId}`,
    assetKey: `resource:${refundAsset.resourceId}`,
    unit: "unit",
    quantityMinor: (BigInt(refundAsset.amount) * 100n).toString(),
  };
}

function median(values: readonly number[]): number | undefined {
  if (!values.length) return undefined;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2) return sorted[middle];
  return (sorted[middle - 1] + sorted[middle]) / 2;
}
