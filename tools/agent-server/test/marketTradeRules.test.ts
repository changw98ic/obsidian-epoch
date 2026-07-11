import assert from "node:assert/strict";
import test from "node:test";

import {
  MARKET_PRICE_HISTORY_WINDOW_SECONDS,
  MARKET_REPEAT_COUNTERPARTY_WINDOW_SECONDS,
  MARKET_SUSPICIOUS_HIGH_PRICE_RATIO,
  MARKET_SUSPICIOUS_LOW_PRICE_RATIO,
  MARKET_TRADE_FEE_BASIS_POINTS,
  DEFAULT_MARKET_REGION_ID,
  assertMarketAgentNotRestricted,
  marketCounterpartyKey,
  marketOrderBuyerPaymentSpendPayload,
  marketOrderCancelledPayload,
  marketOrderCreatedPayload,
  marketExpiryLimit,
  marketExpiryMaxAgeSeconds,
  marketOrderExpiredPayload,
  marketOrderFilledPayload,
  marketOrderGoodsGrantAsset,
  marketOrderGoodsGrantPayload,
  marketOrderItemTransferPayload,
  marketOrderLockSpendPayload,
  marketOrderPaymentPayloads,
  marketPriceRiskFlags,
  marketOrderRefundAsset,
  marketOrderRefundPayload,
  marketOrderSellerPaymentGrantPayload,
  marketSellerProceedsAmount,
  marketTradeFeeAmount,
  marketTradeRisk,
  marketUnitPrice,
  normalizeMarketRegionId,
  planMarketOrderCancellationEvents,
  planMarketOrderCreationEvents,
  planMarketOrderExpiryEvents,
  planMarketOrderFillEvents,
  projectMarketOrderCancellation,
  projectMarketOrderCreation,
  projectMarketOrderExpiry,
  projectMarketOrderFill,
  requireMarketOrder,
  requireOpenMarketOrder,
  selectExpiredMarketOrders,
  type MarketTradeOrderForRules,
} from "../lib/epoch/marketTradeRules.ts";
import { eventFactory } from "../lib/epoch/eventFactory.ts";
import { createSequentialEpochIdFactory } from "../lib/epoch/protocol.ts";

const filledAt = "2026-07-07T03:00:00.000Z";

function marketOrder(overrides: Partial<MarketTradeOrderForRules>): MarketTradeOrderForRules {
  return {
    orderId: "order_default",
    regionId: "region_gray_harbor",
    sellerAgentId: "agent_seller",
    sellKind: "resource",
    sellResourceId: "aether",
    sellAmount: 2,
    priceResourceId: "coin",
    priceAmount: 20,
    status: "open",
    ...overrides,
  };
}

test("market trade rules calculate fees and unit prices", () => {
  assert.equal(MARKET_TRADE_FEE_BASIS_POINTS, 500);
  assert.equal(DEFAULT_MARKET_REGION_ID, "region_gray_harbor");
  assert.equal(marketTradeFeeAmount(40), 2);
  assert.equal(marketTradeFeeAmount(19), 0);
  assert.equal(marketSellerProceedsAmount(40), 38);
  assert.equal(marketUnitPrice(marketOrder({ sellAmount: 4, priceAmount: 20 })), 5);
  assert.equal(marketUnitPrice(marketOrder({ sellAmount: 0, priceAmount: 20 })), 0);
  assert.equal(marketCounterpartyKey("agent_b", "agent_a"), "agent_a:agent_b");
});

test("market trade rules normalize market region ids", () => {
  assert.equal(normalizeMarketRegionId(undefined), "region_gray_harbor");
  assert.equal(normalizeMarketRegionId(""), "region_gray_harbor");
  assert.equal(normalizeMarketRegionId("  Gray Harbor  "), "gray_harbor");
  assert.equal(normalizeMarketRegionId("region/Crimson Market!"), "regioncrimson_market");
});

test("market trade rules read order projection state", () => {
  const projection = {
    marketOrders: {
      order_open: { status: "open", marker: "open" },
      order_filled: { status: "filled", marker: "filled" },
    },
  };

  assert.equal(requireMarketOrder(projection, "order_open").marker, "open");
  assert.equal(requireOpenMarketOrder(projection, "order_open").marker, "open");
  assert.throws(() => requireMarketOrder(projection, "missing"), /market_order_not_found/);
  assert.throws(() => requireOpenMarketOrder(projection, "order_filled"), /market_order_not_open/);
  assert.doesNotThrow(() => assertMarketAgentNotRestricted({ marketRiskRestrictions: {} }, "agent_open"));
  assert.throws(() => assertMarketAgentNotRestricted({
    marketRiskRestrictions: {
      agent_blocked: { sourceReviewId: "risk_review_1" },
    },
  }, "agent_blocked"), /market_agent_restricted/);
});

test("market trade rules flag repeat counterparty trades inside the review window", () => {
  assert.equal(MARKET_REPEAT_COUNTERPARTY_WINDOW_SECONDS, 3600);
  const order = marketOrder({ orderId: "order_new", sellerAgentId: "agent_seller" });
  const projection = {
    marketOrders: {
      old_recent: marketOrder({
        orderId: "old_recent",
        sellerAgentId: "agent_buyer",
        buyerAgentId: "agent_seller",
        status: "filled",
        filledAt: "2026-07-07T02:30:00.000Z",
      }),
      old_stale: marketOrder({
        orderId: "old_stale",
        sellerAgentId: "agent_seller",
        buyerAgentId: "agent_buyer",
        status: "filled",
        filledAt: "2026-07-07T01:00:00.000Z",
      }),
    },
  };

  assert.deepEqual(marketTradeRisk(projection, order, "agent_buyer", filledAt), {
    flags: ["repeat_counterparty_trade"],
    score: 1,
  });
});

test("market trade rules flag suspicious prices against clean recent history", () => {
  assert.equal(MARKET_PRICE_HISTORY_WINDOW_SECONDS, 86400);
  assert.equal(MARKET_SUSPICIOUS_LOW_PRICE_RATIO, 0.5);
  assert.equal(MARKET_SUSPICIOUS_HIGH_PRICE_RATIO, 2);
  const projection = {
    marketOrders: {
      fair_a: marketOrder({
        orderId: "fair_a",
        priceAmount: 20,
        sellAmount: 2,
        status: "filled",
        filledAt: "2026-07-07T02:00:00.000Z",
      }),
      fair_b: marketOrder({
        orderId: "fair_b",
        priceAmount: 24,
        sellAmount: 2,
        status: "filled",
        filledAt: "2026-07-07T02:10:00.000Z",
      }),
      flagged_history: marketOrder({
        orderId: "flagged_history",
        priceAmount: 100,
        sellAmount: 2,
        status: "filled",
        tradeRiskFlags: ["suspicious_high_price"],
        filledAt: "2026-07-07T02:20:00.000Z",
      }),
    },
  };

  assert.deepEqual(marketPriceRiskFlags(projection, marketOrder({
    orderId: "low",
    priceAmount: 10,
    sellAmount: 2,
  }), filledAt), ["suspicious_low_price"]);
  assert.deepEqual(marketPriceRiskFlags(projection, marketOrder({
    orderId: "high",
    priceAmount: 50,
    sellAmount: 2,
  }), filledAt), ["suspicious_high_price"]);
  assert.deepEqual(marketPriceRiskFlags(projection, marketOrder({
    orderId: "item_order",
    sellKind: "item",
    sellResourceId: undefined,
    priceAmount: 50,
    sellAmount: 1,
  }), filledAt), []);
});

test("market trade rules plan created and listing lock payloads", () => {
  assert.deepEqual(marketOrderCreatedPayload({
    orderId: "order_created",
    regionId: "region_cinder",
    sellerAgentId: "agent_seller",
    sellerExplorerId: "explorer_seller",
    sellKind: "item",
    sellAmount: 1,
    sellItem: {
      itemId: "item_1",
      itemKey: "obsidian_charm",
      displayName: "Obsidian Charm",
      rarity: "rare",
    },
    priceResourceId: "coin",
    priceAmount: 20,
    createdAt: filledAt,
  }), {
    orderId: "order_created",
    regionId: "region_cinder",
    sellerAgentId: "agent_seller",
    sellerExplorerId: "explorer_seller",
    sellKind: "item",
    sellResourceId: undefined,
    sellAmount: 1,
    sellItemId: "item_1",
    sellItemKey: "obsidian_charm",
    sellItemDisplayName: "Obsidian Charm",
    sellItemRarity: "rare",
    priceResourceId: "coin",
    priceAmount: 20,
    createdAt: filledAt,
  });

  assert.deepEqual(marketOrderLockSpendPayload("order_created", "aether", 3, 7), {
    resourceId: "aether",
    amount: 3,
    reason: "market_order_lock:order_created",
    balanceAfter: 7,
  });
});

test("market trade rules plan creation event sequences", () => {
  const idFactory = createSequentialEpochIdFactory("market_creation");
  const createdAt = "2026-07-07T03:00:00.000Z";
  const makeEvent = eventFactory(() => new Date(createdAt), idFactory, {
    actorExplorerId: "explorer_seller",
    trustClass: "user_verified_web" as const,
    causationId: "market_creation",
    correlationId: "corr_market_creation",
  });
  const resourceEvents = planMarketOrderCreationEvents({
    orderId: "order_resource",
    regionId: "region_gray_harbor",
    sellerAgentId: "agent_seller",
    sellerExplorerId: "explorer_seller",
    sellKind: "resource",
    sellResourceId: "aether",
    sellAmount: 3,
    priceResourceId: "coin",
    priceAmount: 20,
    createdAt,
    sellerBalanceBefore: 9,
    makeEvent,
  });

  assert.deepEqual(resourceEvents.map((event) => event.eventType), [
    "resource_spent",
    "market_order_created",
  ]);
  const [locked, created] = resourceEvents;
  assert.equal(locked?.aggregateType, "resource_account");
  assert.equal(locked?.aggregateId, "agent_seller");
  assert.equal(created?.aggregateType, "market_order");
  assert.equal(created?.aggregateId, "order_resource");
  if (locked?.eventType !== "resource_spent") throw new Error("expected_resource_spent_event");
  if (created?.eventType !== "market_order_created") throw new Error("expected_market_order_created_event");
  assert.deepEqual(locked.payload, {
    resourceId: "aether",
    amount: 3,
    reason: "market_order_lock:order_resource",
    balanceAfter: 6,
  });
  assert.equal(created.payload.sellKind, "resource");
  assert.equal(created.payload.sellResourceId, "aether");

  const itemEvents = planMarketOrderCreationEvents({
    orderId: "order_item",
    regionId: "region_gray_harbor",
    sellerAgentId: "agent_seller",
    sellerExplorerId: "explorer_seller",
    sellKind: "item",
    sellAmount: 1,
    sellItem: {
      itemId: "item_1",
      itemKey: "obsidian_charm",
      displayName: "Obsidian Charm",
      rarity: "rare",
    },
    priceResourceId: "coin",
    priceAmount: 20,
    createdAt,
    sellerBalanceBefore: 0,
    makeEvent,
  });
  assert.deepEqual(itemEvents.map((event) => event.eventType), ["market_order_created"]);

  const projectedOrder = {
    orderId: "order_resource",
    status: "open",
    marker: "created",
  } as const;
  assert.equal(projectMarketOrderCreation({
    events: resourceEvents,
    projection: {
      marketOrders: {
        order_resource: projectedOrder,
      },
    },
  }), projectedOrder);
  assert.throws(() => projectMarketOrderCreation({
    events: [],
    projection: {
      marketOrders: {
        order_resource: projectedOrder,
      },
    },
  }), /market_order_created_event_missing/);
  assert.throws(() => projectMarketOrderCreation({
    events: resourceEvents,
    projection: {
      marketOrders: {},
    },
  }), /market_order_projection_failed/);
});

test("market trade rules plan filled payloads", () => {
  assert.deepEqual(marketOrderFilledPayload({
    order: marketOrder({ orderId: "order_filled", regionId: "region_cinder", priceResourceId: "coin" }),
    buyerAgentId: "agent_buyer",
    buyerExplorerId: "explorer_buyer",
    marketFeeAmount: 2,
    sellerProceedsAmount: 38,
    transferredItemId: "item_1",
    tradeRisk: { flags: ["repeat_counterparty_trade"], score: 1 },
    filledAt,
  }), {
    orderId: "order_filled",
    regionId: "region_cinder",
    buyerAgentId: "agent_buyer",
    buyerExplorerId: "explorer_buyer",
    marketFeeResourceId: "coin",
    marketFeeAmount: 2,
    sellerProceedsAmount: 38,
    transferredItemId: "item_1",
    tradeRiskFlags: ["repeat_counterparty_trade"],
    tradeRiskScore: 1,
    filledAt,
  });
});

test("market trade rules plan fill ledger and item transfer payloads", () => {
  const order = marketOrder({
    orderId: "order_filled",
    regionId: "region_cinder",
    sellerAgentId: "agent_seller",
    sellerExplorerId: "explorer_seller",
    sellResourceId: "aether",
    sellAmount: 4,
    priceResourceId: "coin",
    priceAmount: 40,
  });

  assert.deepEqual(marketOrderPaymentPayloads({
    order,
    buyerBalanceAfter: 60,
    sellerProceedsAmount: 38,
    sellerBalanceAfter: 52,
  }), {
    spend: {
      resourceId: "coin",
      amount: 40,
      reason: "market_order_fill:order_filled",
      balanceAfter: 60,
    },
    grant: {
      resourceId: "coin",
      amount: 38,
      reason: "market_order_payment:order_filled",
      balanceAfter: 52,
    },
  });
  assert.deepEqual(marketOrderBuyerPaymentSpendPayload(order, 60), {
    resourceId: "coin",
    amount: 40,
    reason: "market_order_fill:order_filled",
    balanceAfter: 60,
  });
  assert.deepEqual(marketOrderSellerPaymentGrantPayload(order, 38, 52), {
    resourceId: "coin",
    amount: 38,
    reason: "market_order_payment:order_filled",
    balanceAfter: 52,
  });
  assert.deepEqual(marketOrderGoodsGrantAsset(order), {
    resourceId: "aether",
    amount: 4,
  });
  assert.deepEqual(marketOrderGoodsGrantPayload(order, 11), {
    resourceId: "aether",
    amount: 4,
    reason: "market_order_goods:order_filled",
    balanceAfter: 11,
  });
  assert.equal(marketOrderGoodsGrantAsset(marketOrder({
    orderId: "item_order",
    sellKind: "item",
    sellResourceId: undefined,
    sellAmount: 1,
  })), undefined);
  assert.equal(marketOrderGoodsGrantPayload(marketOrder({
    orderId: "item_order",
    sellKind: "item",
    sellResourceId: undefined,
    sellAmount: 1,
  }), 11), undefined);
  assert.deepEqual(marketOrderItemTransferPayload({
    order: marketOrder({
      orderId: "item_order",
      sellerAgentId: "agent_seller",
      sellerExplorerId: "explorer_seller",
      sellKind: "item",
      sellResourceId: undefined,
      sellAmount: 1,
    }) as MarketTradeOrderForRules & { readonly sellerExplorerId: string },
    itemId: "item_1",
    buyerAgentId: "agent_buyer",
    buyerExplorerId: "explorer_buyer",
    transferredAt: filledAt,
  }), {
    itemId: "item_1",
    fromAgentId: "agent_seller",
    fromExplorerId: "explorer_seller",
    toAgentId: "agent_buyer",
    toExplorerId: "explorer_buyer",
    sourceOrderId: "item_order",
    transferredAt: filledAt,
  });
});

test("market trade rules plan fill event sequences", () => {
  const idFactory = createSequentialEpochIdFactory("market_fill");
  const makeEvent = eventFactory(() => new Date(filledAt), idFactory, {
    actorExplorerId: "explorer_buyer",
    trustClass: "user_verified_web" as const,
    causationId: "market_fill",
    correlationId: "corr_market_fill",
  });
  const resourceOrder = marketOrder({
    orderId: "order_resource",
    sellerAgentId: "agent_seller",
    sellerExplorerId: "explorer_seller",
    sellResourceId: "aether",
    sellAmount: 4,
    priceResourceId: "coin",
    priceAmount: 40,
  });
  const resourceEvents = planMarketOrderFillEvents({
    order: resourceOrder,
    buyerAgentId: "agent_buyer",
    buyerExplorerId: "explorer_buyer",
    buyerBalanceBefore: 100,
    sellerPriceBalanceBefore: 14,
    buyerSellBalanceBefore: 7,
    tradeRisk: { flags: ["repeat_counterparty_trade"], score: 1 },
    filledAt,
    makeEvent,
  });

  assert.deepEqual(resourceEvents.map((event) => event.eventType), [
    "resource_spent",
    "resource_granted",
    "resource_granted",
    "market_order_filled",
  ]);
  const [paymentSpent, paymentGranted, goodsGranted, resourceFilled] = resourceEvents;
  assert.equal(paymentSpent?.aggregateId, "agent_buyer");
  assert.equal(paymentGranted?.aggregateId, "agent_seller");
  assert.equal(goodsGranted?.aggregateId, "agent_buyer");
  assert.equal(resourceFilled?.aggregateType, "market_order");
  if (paymentSpent?.eventType !== "resource_spent") throw new Error("expected_payment_spent");
  if (paymentGranted?.eventType !== "resource_granted") throw new Error("expected_payment_granted");
  if (goodsGranted?.eventType !== "resource_granted") throw new Error("expected_goods_granted");
  if (resourceFilled?.eventType !== "market_order_filled") throw new Error("expected_market_order_filled");
  assert.equal(paymentSpent.payload.balanceAfter, 60);
  assert.equal(paymentGranted.payload.balanceAfter, 52);
  assert.equal(goodsGranted.payload.balanceAfter, 11);
  assert.equal(resourceFilled.payload.marketFeeAmount, 2);
  assert.equal(resourceFilled.payload.sellerProceedsAmount, 38);
  assert.deepEqual(resourceFilled.payload.tradeRiskFlags, ["repeat_counterparty_trade"]);

  const itemOrder = marketOrder({
    orderId: "order_item",
    sellerAgentId: "agent_seller",
    sellerExplorerId: "explorer_seller",
    sellKind: "item",
    sellResourceId: undefined,
    sellAmount: 1,
    sellItemId: "item_1",
    priceResourceId: "coin",
    priceAmount: 20,
  });
  const itemEvents = planMarketOrderFillEvents({
    order: itemOrder,
    buyerAgentId: "agent_buyer",
    buyerExplorerId: "explorer_buyer",
    buyerBalanceBefore: 40,
    sellerPriceBalanceBefore: 10,
    buyerSellBalanceBefore: 0,
    transferredItemId: "item_1",
    tradeRisk: { flags: [], score: 0 },
    filledAt,
    makeEvent,
  });
  assert.deepEqual(itemEvents.map((event) => event.eventType), [
    "resource_spent",
    "resource_granted",
    "item_transferred",
    "market_order_filled",
  ]);

  const projectedOrder = {
    orderId: "order_resource",
    status: "filled",
    marker: "filled",
  } as const;
  assert.equal(projectMarketOrderFill({
    events: resourceEvents,
    projection: {
      marketOrders: {
        order_resource: projectedOrder,
      },
    },
  }), projectedOrder);
  assert.throws(() => projectMarketOrderFill({
    events: [],
    projection: {
      marketOrders: {
        order_resource: projectedOrder,
      },
    },
  }), /market_order_filled_event_missing/);
  assert.throws(() => projectMarketOrderFill({
    events: resourceEvents,
    projection: {
      marketOrders: {},
    },
  }), /market_order_projection_failed/);
});

test("market trade rules plan cancel expiry and refund payloads", () => {
  const order = marketOrder({
    orderId: "order_terminal",
    regionId: "region_cinder",
    sellerAgentId: "agent_seller",
    sellResourceId: "aether",
    sellAmount: 4,
  });

  assert.deepEqual(marketOrderCancelledPayload(order, "2026-07-07T03:10:00.000Z"), {
    orderId: "order_terminal",
    regionId: "region_cinder",
    sellerAgentId: "agent_seller",
    cancelledAt: "2026-07-07T03:10:00.000Z",
  });
  assert.deepEqual(marketOrderExpiredPayload(order, "2026-07-07T04:00:00.000Z", 86_400), {
    orderId: "order_terminal",
    regionId: "region_cinder",
    sellerAgentId: "agent_seller",
    expiredAt: "2026-07-07T04:00:00.000Z",
    maxAgeSeconds: 86_400,
  });
  assert.deepEqual(marketOrderRefundAsset(order), {
    resourceId: "aether",
    amount: 4,
  });
  assert.deepEqual(marketOrderRefundPayload(order, "expired", 9), {
    resourceId: "aether",
    amount: 4,
    reason: "market_order_expired:order_terminal",
    balanceAfter: 9,
  });
  assert.equal(marketOrderRefundPayload(marketOrder({
    sellKind: "item",
    sellResourceId: undefined,
    sellAmount: 1,
  }), "cancel", 9), undefined);
});

test("market trade rules plan cancellation and expiry event sequences", () => {
  const idFactory = createSequentialEpochIdFactory("market_terminal");
  const terminalAt = "2026-07-07T04:00:00.000Z";
  const makeEvent = eventFactory(() => new Date(terminalAt), idFactory, {
    actorExplorerId: "explorer_seller",
    trustClass: "user_verified_web" as const,
    causationId: "market_terminal",
    correlationId: "corr_market_terminal",
  });
  const order = marketOrder({
    orderId: "order_terminal",
    regionId: "region_cinder",
    sellerAgentId: "agent_seller",
    sellResourceId: "aether",
    sellAmount: 4,
  });

  const cancelledEvents = planMarketOrderCancellationEvents({
    order,
    cancelledAt: terminalAt,
    sellerRefundBalanceBefore: () => 5,
    makeEvent,
  });
  assert.deepEqual(cancelledEvents.map((event) => event.eventType), [
    "resource_granted",
    "market_order_cancelled",
  ]);
  const [cancelRefund, cancelled] = cancelledEvents;
  if (cancelRefund?.eventType !== "resource_granted") throw new Error("expected_cancel_refund");
  if (cancelled?.eventType !== "market_order_cancelled") throw new Error("expected_market_order_cancelled");
  assert.equal(cancelRefund.payload.reason, "market_order_cancel:order_terminal");
  assert.equal(cancelRefund.payload.balanceAfter, 9);
  assert.equal(cancelled.payload.cancelledAt, terminalAt);

  const expiredEvents = planMarketOrderExpiryEvents({
    order,
    expiredAt: terminalAt,
    maxAgeSeconds: 86_400,
    sellerRefundBalanceBefore: () => 6,
    makeEvent,
  });
  assert.deepEqual(expiredEvents.map((event) => event.eventType), [
    "resource_granted",
    "market_order_expired",
  ]);
  const [expireRefund, expired] = expiredEvents;
  if (expireRefund?.eventType !== "resource_granted") throw new Error("expected_expire_refund");
  if (expired?.eventType !== "market_order_expired") throw new Error("expected_market_order_expired");
  assert.equal(expireRefund.payload.reason, "market_order_expired:order_terminal");
  assert.equal(expireRefund.payload.balanceAfter, 10);
  assert.equal(expired.payload.maxAgeSeconds, 86_400);

  const itemOrder = marketOrder({
    orderId: "order_item",
    sellKind: "item",
    sellResourceId: undefined,
    sellAmount: 1,
  });
  assert.deepEqual(planMarketOrderCancellationEvents({
    order: itemOrder,
    cancelledAt: terminalAt,
    sellerRefundBalanceBefore: () => 0,
    makeEvent,
  }).map((event) => event.eventType), ["market_order_cancelled"]);

  const projectedCancel = {
    orderId: "order_terminal",
    status: "cancelled",
    marker: "cancelled",
  } as const;
  assert.equal(projectMarketOrderCancellation({
    events: cancelledEvents,
    projection: {
      marketOrders: {
        order_terminal: projectedCancel,
      },
    },
  }), projectedCancel);
  assert.throws(() => projectMarketOrderCancellation({
    events: [],
    projection: {
      marketOrders: {
        order_terminal: projectedCancel,
      },
    },
  }), /market_order_cancelled_event_missing/);
  assert.throws(() => projectMarketOrderCancellation({
    events: cancelledEvents,
    projection: {
      marketOrders: {},
    },
  }), /market_order_projection_failed/);

  const projectedExpiry = {
    orderId: "order_terminal",
    status: "expired",
    marker: "expired",
  } as const;
  assert.equal(projectMarketOrderExpiry({
    events: expiredEvents,
    projection: {
      marketOrders: {
        order_terminal: projectedExpiry,
      },
    },
  }), projectedExpiry);
  assert.throws(() => projectMarketOrderExpiry({
    events: [],
    projection: {
      marketOrders: {
        order_terminal: projectedExpiry,
      },
    },
  }), /market_order_expired_event_missing/);
  assert.throws(() => projectMarketOrderExpiry({
    events: expiredEvents,
    projection: {
      marketOrders: {},
    },
  }), /market_order_projection_failed/);
});

test("market trade rules select stale open expiry tick targets", () => {
  const tickedAt = "2026-07-07T05:00:00.000Z";
  const order = (
    orderId: string,
    createdAt: string,
    status: "open" | "filled" | "cancelled" | "expired" = "open",
  ) => ({ orderId, createdAt, status });

  assert.equal(marketExpiryLimit(undefined), 25);
  assert.equal(marketExpiryLimit(0), 25);
  assert.equal(marketExpiryLimit(-5), 1);
  assert.equal(marketExpiryLimit(200), 100);
  assert.equal(marketExpiryMaxAgeSeconds(undefined), 86_400);
  assert.equal(marketExpiryMaxAgeSeconds(0), 86_400);
  assert.equal(marketExpiryMaxAgeSeconds(-5), 1);
  assert.deepEqual(
    selectExpiredMarketOrders({
      fresh: order("fresh", "2026-07-07T04:30:01.000Z"),
      filled: order("filled", "2026-07-07T03:00:00.000Z", "filled"),
      old_b: order("old_b", "2026-07-07T03:00:00.000Z"),
      boundary: order("boundary", "2026-07-07T04:00:00.000Z"),
      old_a: order("old_a", "2026-07-07T03:00:00.000Z"),
    }, {
      tickedAt,
      maxAgeSeconds: 3_600,
      limit: 2,
    }).map((item) => item.orderId),
    ["old_a", "old_b"],
  );
  assert.deepEqual(
    selectExpiredMarketOrders({
      fresh: order("fresh", "2026-07-07T04:30:01.000Z"),
      boundary: order("boundary", "2026-07-07T04:00:00.000Z"),
    }, {
      tickedAt,
      maxAgeSeconds: 3_600,
      limit: 5,
    }).map((item) => item.orderId),
    ["boundary"],
  );
});
