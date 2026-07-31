import type {
  EpochCommandContext,
  EpochResourceId,
  EpochClock,
  EpochIdFactory,
  EpochMarketTradeRiskFlag,
} from "./protocol.ts";
import type { EpochEvent } from "./events.ts";
import {
  assertNonEmptyString,
  assertResourceId,
  assertPositiveInteger,
  normalizeTrustClass,
  serverIsoTime,
  stableKey,
} from "./protocol.ts";
import { eventFactory } from "./eventFactory.ts";
import {
  requireActiveIdentity,
} from "./identityProjectionRules.ts";
import {
  assertIdentityOwner,
} from "./identityAuthorizationRules.ts";
import {
  copyBalance,
  currentBalance,
  resourceSpendPayloads,
} from "./resourceRules.ts";
import {
  normalizeItemRarity,
  normalizeShopRegionId,
  planCraftInventoryItemEvents,
  planInventoryItemBindEvents,
  planInventoryItemCreationEvents,
  planShopPurchaseEvents,
  projectCraftInventoryItem,
  projectInventoryItemBind,
  projectInventoryItemCreation,
  projectShopPurchaseItem,
  requireCraftRecipe,
  requireInventoryItem,
  requireShopOffer,
  resolveEpochShopOfferForRegion,
} from "./inventoryRules.ts";
import {
  assertMarketAgentNotRestricted,
  marketOrderGoodsGrantAsset,
  marketTradeRisk,
  marketExpiryMaxAgeSeconds,
  normalizeMarketRegionId,
  planMarketOrderCancellationEvents,
  planMarketOrderFillEvents,
  planMarketOrderCreationEvents,
  planMarketOrderExpiryEvents,
  projectMarketOrderCancellation,
  projectMarketOrderFill,
  projectMarketOrderCreation,
  projectMarketOrderExpiry,
  requireMarketOrder,
  requireOpenMarketOrder,
  selectExpiredMarketOrders,
} from "./marketTradeRules.ts";
import {
  directTradeAssetFromPayload,
  directTradeAssetLabel,
  directTradeItemAsset,
  planDirectTradeAcceptanceEvents,
  planDirectTradeCancellationEvents,
  planDirectTradeCreationEvents,
  planDirectTradeExpiryEvents,
  projectDirectTradeAcceptance,
  projectDirectTradeCancellation,
  projectDirectTradeCreation,
  projectDirectTradeExpiry,
  directTradeRequestedResourcePaymentAsset,
  directTradeResourceAsset,
  directTradeRisk,
  directTradeExpiryMaxAgeSeconds,
  requireDirectTrade,
  requireOpenDirectTrade,
  selectExpiredDirectTradeTargets,
} from "./directTradeRules.ts";
import {
  planBountyClaimEvents,
  planBountyCreationEvents,
  projectBountyClaim,
  projectBountyCreation,
  requireBounty,
  requireOpenBounty,
} from "./bountyRules.ts";
import {
  autoEscalatedRiskReviewPlan,
} from "./moderationRiskRules.ts";
import {
  assertKnownSourceEvents,
  normalizeSourceEventIds,
} from "./sourceEventRules.ts";
import {
  currentRegionInfluenceScore,
  latestTraceIdForRegion,
} from "./regionProjectionRules.ts";
import type {
  EpochCommandResult,
  EpochProjection,
  EpochInventoryItem,
  EpochMarketOrder,
  EpochMarketSellKind,
  EpochMarketOrderStatus,
  EpochDirectTrade,
  EpochDirectTradeAsset,
  EpochDirectTradeAssetKind,
  EpochDirectTradeStatus,
  EpochBounty,
  EpochBountyStatus,
} from "./gameCore.ts";
import {
  sourceEventsMentionAgent,
} from "./gameCore.ts";

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface CreateInventoryItemInput {
  readonly agentId: string;
  readonly itemKey: string;
  readonly displayName: string;
  readonly rarity?: string;
  readonly sourceEventIds: readonly string[];
}

export interface BindInventoryItemInput {
  readonly itemId: string;
  readonly agentId: string;
  readonly reason?: string;
}

export interface CraftInventoryItemInput {
  readonly agentId: string;
  readonly recipeId: string;
}

export interface PurchaseShopOfferInput {
  readonly agentId: string;
  readonly offerId: string;
  readonly regionId?: string;
}

export interface CreateMarketOrderInput {
  readonly sellerAgentId: string;
  readonly regionId?: string;
  readonly sellResourceId?: EpochResourceId;
  readonly sellAmount?: number;
  readonly sellItemId?: string;
  readonly priceResourceId: EpochResourceId;
  readonly priceAmount: number;
}

export interface FillMarketOrderInput {
  readonly orderId: string;
  readonly buyerAgentId: string;
}

export interface CancelMarketOrderInput {
  readonly orderId: string;
  readonly sellerAgentId: string;
}

export interface CreateDirectTradeInput {
  readonly proposerAgentId: string;
  readonly counterpartyAgentId: string;
  readonly regionId?: string;
  readonly offerResourceId?: EpochResourceId;
  readonly offerAmount?: number;
  readonly offerItemId?: string;
  readonly requestResourceId?: EpochResourceId;
  readonly requestAmount?: number;
  readonly requestItemId?: string;
}

export interface AcceptDirectTradeInput {
  readonly tradeId: string;
  readonly counterpartyAgentId: string;
}

export interface CancelDirectTradeInput {
  readonly tradeId: string;
  readonly proposerAgentId: string;
}

export interface TickDirectTradeExpiryInput {
  readonly maxAgeSeconds?: number;
  readonly limit?: number;
}

export interface TickDirectTradeExpiryResult {
  readonly tickedAt: string;
  readonly updated: readonly EpochDirectTrade[];
}

export interface TickMarketExpiryInput {
  readonly maxAgeSeconds?: number;
  readonly limit?: number;
}

export interface TickMarketExpiryResult {
  readonly tickedAt: string;
  readonly updated: readonly EpochMarketOrder[];
}

export interface CreateBountyInput {
  readonly sponsorAgentId: string;
  readonly regionId: string;
  readonly title: string;
  readonly description?: string;
  readonly rewardResourceId: EpochResourceId;
  readonly rewardAmount: number;
  readonly requiredItemKey?: string;
}

export interface ClaimBountyInput {
  readonly bountyId: string;
  readonly claimantAgentId: string;
  readonly fulfillmentItemId?: string;
  readonly evidence?: string;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

export interface GameCoreTradeContext {
  readonly projection: () => EpochProjection;
  readonly commit: <T>(events: readonly EpochEvent[], value: T) => EpochCommandResult<T>;
  readonly applyEvents: (projection: EpochProjection, events: readonly EpochEvent[]) => EpochProjection;
  readonly clock: EpochClock;
  readonly idFactory: EpochIdFactory;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function requireServerTrust(context: EpochCommandContext, errorCode: string) {
  const trustClass = normalizeTrustClass(context.trustClass);
  if (trustClass === "untrusted_client") throw new Error(errorCode);
  return trustClass;
}

function uniqueValues(values: readonly string[]): string[] {
  return values.filter((value, index) => value && values.indexOf(value) === index);
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createTradeCommands(ctx: GameCoreTradeContext) {

  function createInventoryItem(input: CreateInventoryItemInput, context: EpochCommandContext): EpochCommandResult<EpochInventoryItem> {
    const trustClass = requireServerTrust(context, "item_create_requires_server_trust");
    const current = ctx.projection();
    const agentId = assertNonEmptyString(input.agentId, "agent_id");
    const identity = requireActiveIdentity(current, agentId);
    const itemKey = stableKey(assertNonEmptyString(input.itemKey, "item_key"));
    const displayName = assertNonEmptyString(input.displayName, "item_display_name");
    const sourceEventIds = normalizeSourceEventIds(input.sourceEventIds, "inventory_item_source_event_id");
    assertKnownSourceEvents(current, sourceEventIds);
    if (!sourceEventsMentionAgent(current, sourceEventIds, agentId)) {
      throw new Error("inventory_item_source_agent_mismatch");
    }
    const rarity = normalizeItemRarity(input.rarity);
    const itemId = ctx.idFactory("item", `${agentId}:${itemKey}:${sourceEventIds.join(":")}`);
    const existing = current.inventoryItems[itemId];
    if (existing) return { events: [], value: existing, projection: current };
    const nextEvents = planInventoryItemCreationEvents({
      itemId,
      agentId,
      explorerId: identity.explorerId,
      itemKey,
      displayName,
      rarity,
      bound: false,
      sourceEventIds,
      createdAt: serverIsoTime(ctx.clock),
      makeEvent: eventFactory(ctx.clock, ctx.idFactory, { ...context, trustClass }),
    });
    const nextProjection = ctx.applyEvents(current, nextEvents);
    return ctx.commit(nextEvents, projectInventoryItemCreation({ events: nextEvents, projection: nextProjection }));
  }

  function craftInventoryItem(input: CraftInventoryItemInput, context: EpochCommandContext): EpochCommandResult<EpochInventoryItem> {
    const current = ctx.projection();
    const agentId = assertNonEmptyString(input.agentId, "agent_id");
    const identity = requireActiveIdentity(current, agentId);
    if (context.actorExplorerId !== identity.explorerId) {
      throw new Error("inventory_craft_owner_mismatch");
    }
    const recipeId = stableKey(assertNonEmptyString(input.recipeId, "craft_recipe_id"));
    const recipe = requireCraftRecipe(recipeId);

    const makeEvent = eventFactory(ctx.clock, ctx.idFactory, context);
    const spentPayloads = resourceSpendPayloads(
      current,
      agentId,
      recipe.costs,
      () => `craft_item:${recipe.recipeId}`,
    );
    const nextEvents = planCraftInventoryItemEvents({
      recipe,
      agentId,
      explorerId: identity.explorerId,
      spentPayloads,
      createdAt: serverIsoTime(ctx.clock),
      idFactory: ctx.idFactory,
      makeEvent,
    });
    const nextProjection = ctx.applyEvents(current, nextEvents);
    return ctx.commit(nextEvents, projectCraftInventoryItem({ events: nextEvents, projection: nextProjection }));
  }

  function purchaseShopOffer(input: PurchaseShopOfferInput, context: EpochCommandContext): EpochCommandResult<EpochInventoryItem> {
    const current = ctx.projection();
    const agentId = assertNonEmptyString(input.agentId, "agent_id");
    const identity = requireActiveIdentity(current, agentId);
    if (context.actorExplorerId !== identity.explorerId) {
      throw new Error("shop_purchase_owner_mismatch");
    }
    const offerId = stableKey(assertNonEmptyString(input.offerId, "shop_offer_id"));
    if (!offerId) throw new Error("shop_offer_id_required");
    const regionId = normalizeShopRegionId(input.regionId);
    const offer = resolveEpochShopOfferForRegion(requireShopOffer(offerId), regionId);
    if (!Number.isSafeInteger(offer.stock) || offer.stock <= 0
      || !Number.isSafeInteger(offer.perExplorerLimit) || offer.perExplorerLimit <= 0) {
      throw new Error("shop_offer_limit_invalid");
    }
    const priorPurchaseRefs = new Set<string>();
    for (const event of current.events) {
      if (event.eventType !== "resource_spent" || event.agentId !== agentId) continue;
      const reason = event.payload.reason;
      if (reason !== `shop_purchase:${offer.offerId}` && !reason.endsWith(`:${offer.offerId}`)) continue;
      priorPurchaseRefs.add(event.idempotencyKey || event.correlationId || event.causationId || event.eventId);
    }
    const explorerPurchaseCap = Math.min(offer.stock, offer.perExplorerLimit);
    if (priorPurchaseRefs.size >= explorerPurchaseCap) {
      throw new Error("shop_offer_purchase_limit_reached");
    }

    const makeEvent = eventFactory(ctx.clock, ctx.idFactory, context);
    const spentPayloads = resourceSpendPayloads(
      current,
      agentId,
      offer.costs,
      () => regionId ? `shop_purchase:${regionId}:${offer.offerId}` : `shop_purchase:${offer.offerId}`,
    );
    const nextEvents = planShopPurchaseEvents({
      offer,
      agentId,
      explorerId: identity.explorerId,
      spentPayloads,
      createdAt: serverIsoTime(ctx.clock),
      idFactory: ctx.idFactory,
      makeEvent,
    });
    const nextProjection = ctx.applyEvents(current, nextEvents);
    return ctx.commit(nextEvents, projectShopPurchaseItem({ events: nextEvents, projection: nextProjection }));
  }

  function bindInventoryItem(input: BindInventoryItemInput, context: EpochCommandContext): EpochCommandResult<EpochInventoryItem> {
    const current = ctx.projection();
    const itemId = assertNonEmptyString(input.itemId, "item_id");
    const item = requireInventoryItem(current, itemId);
    const agentId = assertNonEmptyString(input.agentId, "agent_id");
    if (item.agentId !== agentId) {
      throw new Error("inventory_item_owner_mismatch");
    }
    const identity = requireActiveIdentity(current, agentId);
    if (item.explorerId !== identity.explorerId) {
      throw new Error("inventory_item_owner_mismatch");
    }
    assertIdentityOwner(identity, context, "inventory_bind_owner_mismatch");
    if (item.marketLockedByOrderId) {
      throw new Error("inventory_item_market_locked");
    }
    if (item.bound) return { events: [], value: item, projection: current };
    const nextEvents = planInventoryItemBindEvents({
      itemId,
      agentId,
      explorerId: identity.explorerId,
      reason: input.reason,
      boundAt: serverIsoTime(ctx.clock),
      makeEvent: eventFactory(ctx.clock, ctx.idFactory, context),
    });
    const nextProjection = ctx.applyEvents(current, nextEvents);
    return ctx.commit(nextEvents, projectInventoryItemBind({ events: nextEvents, projection: nextProjection }));
  }

  function createMarketOrder(input: CreateMarketOrderInput, context: EpochCommandContext): EpochCommandResult<EpochMarketOrder> {
    const current = ctx.projection();
    const sellerAgentId = assertNonEmptyString(input.sellerAgentId, "seller_agent_id");
    const seller = requireActiveIdentity(current, sellerAgentId);
    assertIdentityOwner(seller, context, "market_order_seller_owner_mismatch");
    assertMarketAgentNotRestricted(current, sellerAgentId);
    const regionId = normalizeMarketRegionId(input.regionId);
    const priceResourceId = assertResourceId(input.priceResourceId);
    const priceAmount = assertPositiveInteger(input.priceAmount, "price_amount");
    const sellItemId = typeof input.sellItemId === "string" && input.sellItemId.trim().length > 0
      ? assertNonEmptyString(input.sellItemId, "sell_item_id")
      : undefined;
    const sellKind: EpochMarketSellKind = sellItemId ? "item" : "resource";
    const sellResourceId = sellKind === "resource" ? assertResourceId(input.sellResourceId) : undefined;
    const sellAmount = sellKind === "resource" ? assertPositiveInteger(input.sellAmount, "sell_amount") : 1;
    const sellItem = sellItemId ? requireInventoryItem(current, sellItemId) : undefined;
    if (sellItem) {
      if (sellItem.agentId !== sellerAgentId || sellItem.explorerId !== seller.explorerId) {
        throw new Error("inventory_item_owner_mismatch");
      }
      if (sellItem.bound) throw new Error("inventory_item_bound_not_tradable");
      if (sellItem.marketLockedByOrderId) throw new Error("inventory_item_market_locked");
    }
    const sellerBalance = sellResourceId ? currentBalance(current, sellerAgentId, sellResourceId) : 0;
    if (sellResourceId && sellerBalance < sellAmount) throw new Error("resource_insufficient");
    const createdAt = serverIsoTime(ctx.clock);
    const orderId = ctx.idFactory("order", `${regionId}:${sellKind}:${sellResourceId || sellItemId}:${sellAmount}:${priceResourceId}:${priceAmount}:${createdAt}:${sellerAgentId}`);
    const makeEvent = eventFactory(ctx.clock, ctx.idFactory, context);
    const nextEvents = planMarketOrderCreationEvents({
      orderId,
      regionId,
      sellerAgentId,
      sellerExplorerId: seller.explorerId,
      sellKind,
      sellResourceId,
      sellAmount,
      sellItem,
      priceResourceId,
      priceAmount,
      createdAt,
      sellerBalanceBefore: sellerBalance,
      makeEvent,
    });
    const nextProjection = ctx.applyEvents(current, nextEvents);
    return ctx.commit(nextEvents, projectMarketOrderCreation({ events: nextEvents, projection: nextProjection }));
  }

  function fillMarketOrder(input: FillMarketOrderInput, context: EpochCommandContext): EpochCommandResult<EpochMarketOrder> {
    const current = ctx.projection();
    const orderId = assertNonEmptyString(input.orderId, "order_id");
    const order = requireOpenMarketOrder(current, orderId);
    const buyerAgentId = assertNonEmptyString(input.buyerAgentId, "buyer_agent_id");
    const buyer = requireActiveIdentity(current, buyerAgentId);
    assertIdentityOwner(buyer, context, "market_order_buyer_owner_mismatch");
    assertMarketAgentNotRestricted(current, buyerAgentId);
    assertMarketAgentNotRestricted(current, order.sellerAgentId);
    if (buyerAgentId === order.sellerAgentId) throw new Error("market_self_fill_not_allowed");
    if (buyer.explorerId === order.sellerExplorerId) throw new Error("market_same_explorer_fill_not_allowed");
    const buyerBalance = currentBalance(current, buyerAgentId, order.priceResourceId);
    if (buyerBalance < order.priceAmount) throw new Error("resource_insufficient");
    const sellerPriceBalance = currentBalance(current, order.sellerAgentId, order.priceResourceId);
    const goodsAsset = marketOrderGoodsGrantAsset(order);
    const buyerSellBalance = goodsAsset ? currentBalance(current, buyerAgentId, goodsAsset.resourceId) : 0;
    const sellItem = order.sellKind === "item" && order.sellItemId
      ? requireInventoryItem(current, order.sellItemId)
      : undefined;
    if (sellItem) {
      if (sellItem.agentId !== order.sellerAgentId || sellItem.explorerId !== order.sellerExplorerId) {
        throw new Error("inventory_item_owner_mismatch");
      }
      if (sellItem.bound) throw new Error("inventory_item_bound_not_tradable");
      if (sellItem.marketLockedByOrderId !== order.orderId) throw new Error("inventory_item_market_lock_mismatch");
    }
    const filledAt = serverIsoTime(ctx.clock);
    const tradeRisk = marketTradeRisk(current, order, buyerAgentId, filledAt);
    const makeEvent = eventFactory(ctx.clock, ctx.idFactory, context);
    const nextEvents = planMarketOrderFillEvents({
      order,
      buyerAgentId,
      buyerExplorerId: buyer.explorerId,
      buyerBalanceBefore: buyerBalance,
      sellerPriceBalanceBefore: sellerPriceBalance,
      buyerSellBalanceBefore: buyerSellBalance,
      transferredItemId: sellItem?.itemId,
      tradeRisk,
      filledAt,
      makeEvent,
    });
    const nextProjection = ctx.applyEvents(current, nextEvents);
    return ctx.commit(nextEvents, projectMarketOrderFill({ events: nextEvents, projection: nextProjection }));
  }

  function cancelMarketOrder(input: CancelMarketOrderInput, context: EpochCommandContext): EpochCommandResult<EpochMarketOrder> {
    const current = ctx.projection();
    const orderId = assertNonEmptyString(input.orderId, "order_id");
    const order = requireOpenMarketOrder(current, orderId);
    const sellerAgentId = assertNonEmptyString(input.sellerAgentId, "seller_agent_id");
    if (sellerAgentId !== order.sellerAgentId) throw new Error("market_order_owner_mismatch");
    const seller = requireActiveIdentity(current, sellerAgentId);
    assertIdentityOwner(seller, context, "market_order_seller_owner_mismatch");
    const makeEvent = eventFactory(ctx.clock, ctx.idFactory, context);
    const nextEvents = planMarketOrderCancellationEvents({
      order,
      cancelledAt: serverIsoTime(ctx.clock),
      sellerRefundBalanceBefore: (resourceId) => currentBalance(current, sellerAgentId, resourceId),
      makeEvent,
    });
    const nextProjection = ctx.applyEvents(current, nextEvents);
    return ctx.commit(nextEvents, projectMarketOrderCancellation({ events: nextEvents, projection: nextProjection }));
  }

  function createDirectTrade(input: CreateDirectTradeInput, context: EpochCommandContext): EpochCommandResult<EpochDirectTrade> {
    const current = ctx.projection();
    const proposerAgentId = assertNonEmptyString(input.proposerAgentId, "proposer_agent_id");
    const counterpartyAgentId = assertNonEmptyString(input.counterpartyAgentId, "counterparty_agent_id");
    const proposer = requireActiveIdentity(current, proposerAgentId);
    const counterparty = requireActiveIdentity(current, counterpartyAgentId);
    assertIdentityOwner(proposer, context, "direct_trade_proposer_owner_mismatch");
    assertMarketAgentNotRestricted(current, proposerAgentId);
    assertMarketAgentNotRestricted(current, counterpartyAgentId);
    if (proposerAgentId === counterpartyAgentId) throw new Error("direct_trade_self_not_allowed");
    if (proposer.explorerId === counterparty.explorerId) throw new Error("direct_trade_same_explorer_not_allowed");
    const regionId = normalizeMarketRegionId(input.regionId);
    const offerItemId = typeof input.offerItemId === "string" && input.offerItemId.trim().length > 0
      ? assertNonEmptyString(input.offerItemId, "offer_item_id")
      : undefined;
    const requestItemId = typeof input.requestItemId === "string" && input.requestItemId.trim().length > 0
      ? assertNonEmptyString(input.requestItemId, "request_item_id")
      : undefined;
    const hasOfferResource = typeof input.offerResourceId === "string" && input.offerResourceId.trim().length > 0;
    const hasRequestResource = typeof input.requestResourceId === "string" && input.requestResourceId.trim().length > 0;
    if ((hasOfferResource && offerItemId) || (!hasOfferResource && !offerItemId)) {
      throw new Error(hasOfferResource ? "direct_trade_offer_asset_ambiguous" : "direct_trade_offer_asset_required");
    }
    if ((hasRequestResource && requestItemId) || (!hasRequestResource && !requestItemId)) {
      throw new Error(hasRequestResource ? "direct_trade_request_asset_ambiguous" : "direct_trade_request_asset_required");
    }

    const offerResourceId = hasOfferResource ? assertResourceId(input.offerResourceId) : undefined;
    const offerAmount = offerResourceId ? assertPositiveInteger(input.offerAmount, "offer_amount") : undefined;
    const requestResourceId = hasRequestResource ? assertResourceId(input.requestResourceId) : undefined;
    const requestAmount = requestResourceId ? assertPositiveInteger(input.requestAmount, "request_amount") : undefined;
    const offeredItem = offerItemId ? requireInventoryItem(current, offerItemId) : undefined;
    const requestedItem = requestItemId ? requireInventoryItem(current, requestItemId) : undefined;
    if (offeredItem) {
      if (offeredItem.agentId !== proposerAgentId || offeredItem.explorerId !== proposer.explorerId) {
        throw new Error("inventory_item_owner_mismatch");
      }
      if (offeredItem.bound) throw new Error("inventory_item_bound_not_tradable");
      if (offeredItem.marketLockedByOrderId) throw new Error("inventory_item_market_locked");
    }
    if (requestedItem) {
      if (requestedItem.agentId !== counterpartyAgentId || requestedItem.explorerId !== counterparty.explorerId) {
        throw new Error("inventory_item_owner_mismatch");
      }
      if (requestedItem.bound) throw new Error("inventory_item_bound_not_tradable");
      if (requestedItem.marketLockedByOrderId) throw new Error("inventory_item_market_locked");
    }
    const proposerOfferBalance = offerResourceId ? currentBalance(current, proposerAgentId, offerResourceId) : 0;
    if (offerResourceId && offerAmount && proposerOfferBalance < offerAmount) throw new Error("resource_insufficient");
    const offeredAsset = offeredItem
      ? directTradeItemAsset(offeredItem)
      : directTradeResourceAsset(offerResourceId as EpochResourceId, offerAmount as number);
    const requestedAsset = requestedItem
      ? directTradeItemAsset(requestedItem)
      : directTradeResourceAsset(requestResourceId as EpochResourceId, requestAmount as number);
    const createdAt = serverIsoTime(ctx.clock);
    const tradeId = ctx.idFactory(
      "direct_trade",
      `${regionId}:${proposerAgentId}:${counterpartyAgentId}:${directTradeAssetLabel(offeredAsset)}:${directTradeAssetLabel(requestedAsset)}:${createdAt}`,
    );
    const makeEvent = eventFactory(ctx.clock, ctx.idFactory, context);
    const nextEvents = planDirectTradeCreationEvents({
      tradeId,
      regionId,
      proposerAgentId,
      proposerExplorerId: proposer.explorerId,
      counterpartyAgentId,
      counterpartyExplorerId: counterparty.explorerId,
      offeredAsset,
      requestedAsset,
      createdAt,
      proposerOfferBalanceBefore: proposerOfferBalance,
      makeEvent,
    });
    const nextProjection = ctx.applyEvents(current, nextEvents);
    return ctx.commit(nextEvents, projectDirectTradeCreation({ events: nextEvents, projection: nextProjection }));
  }

  function acceptDirectTrade(input: AcceptDirectTradeInput, context: EpochCommandContext): EpochCommandResult<EpochDirectTrade> {
    const current = ctx.projection();
    const tradeId = assertNonEmptyString(input.tradeId, "trade_id");
    const trade = requireOpenDirectTrade(current, tradeId);
    const counterpartyAgentId = assertNonEmptyString(input.counterpartyAgentId, "counterparty_agent_id");
    if (counterpartyAgentId !== trade.counterpartyAgentId) throw new Error("direct_trade_counterparty_mismatch");
    const counterparty = requireActiveIdentity(current, counterpartyAgentId);
    const proposer = requireActiveIdentity(current, trade.proposerAgentId);
    assertIdentityOwner(counterparty, context, "direct_trade_counterparty_owner_mismatch");
    assertMarketAgentNotRestricted(current, counterpartyAgentId);
    assertMarketAgentNotRestricted(current, trade.proposerAgentId);
    if (counterpartyAgentId === trade.proposerAgentId) throw new Error("direct_trade_self_not_allowed");
    if (counterparty.explorerId === trade.proposerExplorerId) throw new Error("direct_trade_same_explorer_not_allowed");

    const offeredItem = trade.offeredAsset.kind === "item" && trade.offeredAsset.itemId
      ? requireInventoryItem(current, trade.offeredAsset.itemId)
      : undefined;
    if (offeredItem) {
      if (offeredItem.agentId !== trade.proposerAgentId || offeredItem.explorerId !== trade.proposerExplorerId) {
        throw new Error("inventory_item_owner_mismatch");
      }
      if (offeredItem.bound) throw new Error("inventory_item_bound_not_tradable");
      if (offeredItem.marketLockedByOrderId !== trade.tradeId) throw new Error("inventory_item_market_lock_mismatch");
    }
    const requestedItem = trade.requestedAsset.kind === "item" && trade.requestedAsset.itemId
      ? requireInventoryItem(current, trade.requestedAsset.itemId)
      : undefined;
    if (requestedItem) {
      if (requestedItem.agentId !== counterpartyAgentId || requestedItem.explorerId !== counterparty.explorerId) {
        throw new Error("inventory_item_owner_mismatch");
      }
      if (requestedItem.bound) throw new Error("inventory_item_bound_not_tradable");
      if (requestedItem.marketLockedByOrderId) throw new Error("inventory_item_market_locked");
    }

    const acceptedAt = serverIsoTime(ctx.clock);
    const makeEvent = eventFactory(ctx.clock, ctx.idFactory, context);
    const requestedPaymentAsset = directTradeRequestedResourcePaymentAsset(trade);
    if (requestedPaymentAsset) {
      const counterpartyBalance = currentBalance(current, counterpartyAgentId, requestedPaymentAsset.resourceId);
      if (counterpartyBalance < requestedPaymentAsset.amount) throw new Error("resource_insufficient");
    }
    const tradeRisk = directTradeRisk(current.directTrades, trade, counterpartyAgentId, acceptedAt);
    const nextEvents: EpochEvent[] = [...planDirectTradeAcceptanceEvents({
      trade,
      counterpartyAgentId,
      counterpartyExplorerId: counterparty.explorerId,
      proposerExplorerId: proposer.explorerId,
      counterpartyRequestedBalanceBefore: (resourceId) => currentBalance(current, counterpartyAgentId, resourceId),
      proposerRequestedBalanceBefore: (resourceId) => currentBalance(current, trade.proposerAgentId, resourceId),
      counterpartyOfferedBalanceBefore: (resourceId) => currentBalance(current, counterpartyAgentId, resourceId),
      transferredOfferedItemId: offeredItem?.itemId,
      transferredRequestedItemId: requestedItem?.itemId,
      tradeRisk,
      acceptedAt,
      makeEvent,
    })];
    const accepted = nextEvents.find((event) => event.eventType === "direct_trade_accepted");
    if (!accepted || accepted.eventType !== "direct_trade_accepted") {
      throw new Error("direct_trade_accepted_event_missing");
    }
    if (tradeRisk.flags.length || tradeRisk.score > 0) {
      const reviewId = ctx.idFactory("risk_review", accepted.eventId);
      const autoRiskReview = autoEscalatedRiskReviewPlan({
        reviewId,
        sourceEventId: accepted.eventId,
        sourceEventType: accepted.eventType,
        agentId: counterpartyAgentId,
        explorerId: counterparty.explorerId,
        reviewFlags: tradeRisk.flags,
        reviewScore: tradeRisk.score,
        reviewedAt: acceptedAt,
        correlationId: context.correlationId,
      });
      if (!autoRiskReview) throw new Error("risk_review_auto_escalation_plan_failed");
      const serverRiskEvent = eventFactory(ctx.clock, ctx.idFactory, autoRiskReview.context);
      nextEvents.push(serverRiskEvent("risk_review_recorded", reviewId, autoRiskReview.payload, {
        aggregateType: autoRiskReview.aggregateType,
        agentId: autoRiskReview.agentId,
      }));
    }
    const nextProjection = ctx.applyEvents(current, nextEvents);
    return ctx.commit(nextEvents, projectDirectTradeAcceptance({ events: nextEvents, projection: nextProjection }));
  }

  function cancelDirectTrade(input: CancelDirectTradeInput, context: EpochCommandContext): EpochCommandResult<EpochDirectTrade> {
    const current = ctx.projection();
    const tradeId = assertNonEmptyString(input.tradeId, "trade_id");
    const trade = requireOpenDirectTrade(current, tradeId);
    const proposerAgentId = assertNonEmptyString(input.proposerAgentId, "proposer_agent_id");
    if (proposerAgentId !== trade.proposerAgentId) throw new Error("direct_trade_owner_mismatch");
    const proposer = requireActiveIdentity(current, proposerAgentId);
    assertIdentityOwner(proposer, context, "direct_trade_proposer_owner_mismatch");
    const makeEvent = eventFactory(ctx.clock, ctx.idFactory, context);
    const cancelledAt = serverIsoTime(ctx.clock);
    const nextEvents = planDirectTradeCancellationEvents({
      trade,
      cancelledAt,
      proposerRefundBalanceBefore: (resourceId) => currentBalance(current, proposerAgentId, resourceId),
      makeEvent,
    });
    const nextProjection = ctx.applyEvents(current, nextEvents);
    return ctx.commit(nextEvents, projectDirectTradeCancellation({ events: nextEvents, projection: nextProjection }));
  }

  function tickDirectTradeExpiry(input: TickDirectTradeExpiryInput, context: EpochCommandContext): EpochCommandResult<TickDirectTradeExpiryResult> {
    const trustClass = requireServerTrust(context, "direct_trade_expiry_tick_requires_server_trust");
    const current = ctx.projection();
    const tickedAt = serverIsoTime(ctx.clock);
    const maxAgeSeconds = directTradeExpiryMaxAgeSeconds(input.maxAgeSeconds);
    const expiredTrades = selectExpiredDirectTradeTargets(current.directTrades, { ...input, tickedAt });
    const makeEvent = eventFactory(ctx.clock, ctx.idFactory, { ...context, trustClass });
    const nextEvents: EpochEvent[] = [];
    for (const trade of expiredTrades) {
      const interimProjection = ctx.applyEvents(current, nextEvents);
      nextEvents.push(...planDirectTradeExpiryEvents({
        trade,
        expiredAt: tickedAt,
        maxAgeSeconds,
        proposerRefundBalanceBefore: (resourceId) => currentBalance(interimProjection, trade.proposerAgentId, resourceId),
        makeEvent,
      }));
    }
    const nextProjection = ctx.applyEvents(current, nextEvents);
    return ctx.commit(nextEvents, {
      tickedAt,
      updated: expiredTrades
        .map((trade) => projectDirectTradeExpiry({
          events: nextEvents.filter((event) =>
            event.aggregateId === trade.tradeId || (
              event.aggregateId === trade.proposerAgentId
              && event.eventType === "resource_granted"
            )),
          projection: nextProjection,
        }))
        .filter(Boolean),
    });
  }

  function tickMarketExpiry(input: TickMarketExpiryInput, context: EpochCommandContext): EpochCommandResult<TickMarketExpiryResult> {
    const trustClass = requireServerTrust(context, "market_expiry_tick_requires_server_trust");
    const current = ctx.projection();
    const tickedAt = serverIsoTime(ctx.clock);
    const maxAgeSeconds = marketExpiryMaxAgeSeconds(input.maxAgeSeconds);
    const expiredOrders = selectExpiredMarketOrders(current.marketOrders, { ...input, tickedAt });
    const makeEvent = eventFactory(ctx.clock, ctx.idFactory, { ...context, trustClass });
    const nextEvents: EpochEvent[] = [];
    for (const order of expiredOrders) {
      const interimProjection = ctx.applyEvents(current, nextEvents);
      nextEvents.push(...planMarketOrderExpiryEvents({
        order,
        expiredAt: tickedAt,
        maxAgeSeconds,
        sellerRefundBalanceBefore: (resourceId) =>
          currentBalance(interimProjection, order.sellerAgentId, resourceId),
        makeEvent,
      }));
    }
    const nextProjection = ctx.applyEvents(current, nextEvents);
    return ctx.commit(nextEvents, {
      tickedAt,
      updated: expiredOrders
        .map((order) => projectMarketOrderExpiry({
          events: nextEvents.filter((event) =>
            event.aggregateId === order.orderId || (
              event.aggregateId === order.sellerAgentId
              && event.eventType === "resource_granted"
            )),
          projection: nextProjection,
        }))
        .filter(Boolean),
    });
  }

  function createBounty(input: CreateBountyInput, context: EpochCommandContext): EpochCommandResult<EpochBounty> {
    const current = ctx.projection();
    const sponsorAgentId = assertNonEmptyString(input.sponsorAgentId, "sponsor_agent_id");
    const sponsor = requireActiveIdentity(current, sponsorAgentId);
    assertIdentityOwner(sponsor, context, "bounty_sponsor_owner_mismatch");
    const regionId = assertNonEmptyString(input.regionId, "region_id");
    const title = assertNonEmptyString(input.title, "bounty_title");
    const rewardResourceId = assertResourceId(input.rewardResourceId);
    const rewardAmount = assertPositiveInteger(input.rewardAmount, "bounty_reward_amount");
    const requiredItemKey = typeof input.requiredItemKey === "string" && input.requiredItemKey.trim().length > 0
      ? input.requiredItemKey.trim()
      : undefined;
    const sponsorBalance = currentBalance(current, sponsorAgentId, rewardResourceId);
    if (sponsorBalance < rewardAmount) throw new Error("resource_insufficient");
    const createdAt = serverIsoTime(ctx.clock);
    const bountyId = ctx.idFactory("bounty", `${regionId}:${title}:${createdAt}:${sponsorAgentId}`);
    const makeEvent = eventFactory(ctx.clock, ctx.idFactory, context);
    const nextEvents = planBountyCreationEvents({
      bountyId,
      regionId,
      sponsorAgentId,
      sponsorExplorerId: sponsor.explorerId,
      title,
      description: input.description,
      rewardResourceId,
      rewardAmount,
      requiredItemKey,
      createdAt,
      sponsorBalanceBefore: sponsorBalance,
      makeEvent,
    });
    const nextProjection = ctx.applyEvents(current, nextEvents);
    return ctx.commit(nextEvents, projectBountyCreation({ events: nextEvents, projection: nextProjection }));
  }

  function claimBounty(input: ClaimBountyInput, context: EpochCommandContext): EpochCommandResult<EpochBounty> {
    const current = ctx.projection();
    const bountyId = assertNonEmptyString(input.bountyId, "bounty_id");
    const bounty = requireOpenBounty(current, bountyId);
    const claimantAgentId = assertNonEmptyString(input.claimantAgentId, "claimant_agent_id");
    const claimant = requireActiveIdentity(current, claimantAgentId);
    assertIdentityOwner(claimant, context, "bounty_claimant_owner_mismatch");
    if (claimantAgentId === bounty.sponsorAgentId) throw new Error("bounty_self_claim_not_allowed");
    const evidence = input.evidence?.trim() || "server_verified_bounty_claim";
    const fulfillmentItem = bounty.requiredItemKey
      ? requireInventoryItem(current, assertNonEmptyString(input.fulfillmentItemId, "bounty_fulfillment_item"))
      : undefined;
    if (fulfillmentItem) {
      if (fulfillmentItem.agentId !== claimantAgentId || fulfillmentItem.explorerId !== claimant.explorerId) {
        throw new Error("inventory_item_owner_mismatch");
      }
      if (fulfillmentItem.itemKey !== bounty.requiredItemKey) throw new Error("bounty_item_key_mismatch");
      if (fulfillmentItem.bound) throw new Error("inventory_item_bound_not_tradable");
      if (fulfillmentItem.marketLockedByOrderId) throw new Error("inventory_item_market_locked");
    }
    const makeEvent = eventFactory(ctx.clock, ctx.idFactory, context);
    const claimedAt = serverIsoTime(ctx.clock);
    const influenceId = ctx.idFactory("region_influence", `${bounty.regionId}:${bountyId}:${claimantAgentId}:bounty`);
    const participantAgentIds = uniqueValues([bounty.sponsorAgentId, claimantAgentId]);
    const participantExplorerIds = uniqueValues([bounty.sponsorExplorerId, claimant.explorerId]);
    const traceId = ctx.idFactory("trace", `${bounty.regionId}:${bountyId}:bounty`);
    const nextEvents = planBountyClaimEvents({
      bounty,
      claimantAgentId,
      claimantExplorerId: claimant.explorerId,
      transferredItemId: fulfillmentItem?.itemId,
      evidence,
      claimantRewardBalanceBefore: currentBalance(current, claimantAgentId, bounty.rewardResourceId),
      influenceId,
      influenceScoreBefore: currentRegionInfluenceScore(current, bounty.regionId, claimantAgentId),
      traceId,
      participantAgentIds,
      participantExplorerIds,
      parentTraceId: latestTraceIdForRegion(current, bounty.regionId),
      claimedAt,
      makeEvent,
    });
    const nextProjection = ctx.applyEvents(current, nextEvents);
    return ctx.commit(nextEvents, projectBountyClaim({ events: nextEvents, projection: nextProjection }));
  }

  return {
    createInventoryItem,
    craftInventoryItem,
    purchaseShopOffer,
    bindInventoryItem,
    createMarketOrder,
    fillMarketOrder,
    cancelMarketOrder,
    createDirectTrade,
    acceptDirectTrade,
    cancelDirectTrade,
    tickDirectTradeExpiry,
    tickMarketExpiry,
    createBounty,
    claimBounty,
  };
}
