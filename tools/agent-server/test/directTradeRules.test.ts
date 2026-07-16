import assert from "node:assert/strict";
import test from "node:test";

import {
  DIRECT_TRADE_REPEAT_COUNTERPARTY_WINDOW_SECONDS,
  directTradeAcceptedPayload,
  directTradeAssetFromPayload,
  directTradeAssetLabel,
  directTradeAssetPayload,
  directTradeCancelledPayload,
  directTradeCreatedPayload,
  directTradeExpiryLimit,
  directTradeExpiryMaxAgeSeconds,
  directTradeExpiredPayload,
  directTradeItemAsset,
  directTradeOfferedResourceGoodsAsset,
  directTradeOfferedResourceRefundAsset,
  directTradeOfferedResourceRefundPayload,
  directTradeOfferedResourceGoodsGrantPayload,
  directTradeOfferedResourceLockSpendPayload,
  directTradeOfferedItemTransferPayload,
  directTradeRequestedItemTransferPayload,
  directTradeRequestedResourcePaymentAsset,
  directTradeRequestedResourcePaymentGrantPayload,
  directTradeRequestedResourcePaymentPayloads,
  directTradeRequestedResourcePaymentSpendPayload,
  directTradeResourceAsset,
  directTradeRisk,
  planDirectTradeAcceptanceEvents,
  planDirectTradeCancellationEvents,
  planDirectTradeCreationEvents,
  planDirectTradeExpiryEvents,
  projectDirectTradeAcceptance,
  projectDirectTradeCancellation,
  projectDirectTradeCreation,
  projectDirectTradeExpiry,
  requireDirectTrade,
  requireOpenDirectTrade,
  selectExpiredDirectTradeTargets,
  type DirectTradeForRules,
} from "../lib/epoch/directTradeRules.ts";
import { eventFactory } from "../lib/epoch/eventFactory.ts";
import { createSequentialEpochIdFactory } from "../lib/epoch/protocol.ts";

const acceptedAt = "2026-07-07T04:00:00.000Z";

function directTrade(overrides: Partial<DirectTradeForRules>): DirectTradeForRules {
  return {
    tradeId: "trade_default",
    regionId: "region_gray_harbor",
    proposerAgentId: "agent_seller",
    proposerExplorerId: "explorer_seller",
    counterpartyAgentId: "agent_buyer",
    counterpartyExplorerId: "explorer_buyer",
    offeredAsset: directTradeResourceAsset("aether", 1),
    requestedAsset: directTradeResourceAsset("coin", 3),
    status: "open",
    ...overrides,
  };
}

test("direct trade rules convert resource and item assets", () => {
  assert.deepEqual(directTradeResourceAsset("aether", 2), {
    kind: "resource",
    resourceId: "aether",
    amount: 2,
  });
  assert.deepEqual(directTradeItemAsset({
    itemId: "item_1",
    itemKey: "obsidian_knife",
    displayName: "黑曜短刀",
    rarity: "rare",
  }), {
    kind: "item",
    itemId: "item_1",
    itemKey: "obsidian_knife",
    itemDisplayName: "黑曜短刀",
    itemRarity: "rare",
  });
  assert.deepEqual(directTradeAssetFromPayload({ kind: "resource", resourceId: "coin", amount: 5 }), {
    kind: "resource",
    resourceId: "coin",
    amount: 5,
  });
  assert.deepEqual(directTradeAssetPayload({
    kind: "item",
    itemId: "item_1",
    itemKey: "obsidian_knife",
    itemDisplayName: "黑曜短刀",
    itemRarity: "rare",
  }), {
    kind: "item",
    itemId: "item_1",
    itemKey: "obsidian_knife",
    itemDisplayName: "黑曜短刀",
    itemRarity: "rare",
  });
  assert.equal(directTradeAssetLabel(directTradeResourceAsset("coin", 5)), "5 coin");
  assert.equal(directTradeAssetLabel({
    kind: "item",
    itemId: "item_1",
    itemKey: "obsidian_knife",
    itemDisplayName: "",
    itemRarity: "rare",
  }), "obsidian_knife");
});

test("direct trade rules read trade projection state", () => {
  const projection = {
    directTrades: {
      trade_open: { status: "open", marker: "open" },
      trade_accepted: { status: "accepted", marker: "accepted" },
    },
  };

  assert.equal(requireDirectTrade(projection, "trade_open").marker, "open");
  assert.equal(requireOpenDirectTrade(projection, "trade_open").marker, "open");
  assert.throws(() => requireDirectTrade(projection, "missing"), /direct_trade_not_found/);
  assert.throws(() => requireOpenDirectTrade(projection, "trade_accepted"), /direct_trade_not_open/);
});

test("direct trade rules reject malformed asset payloads", () => {
  assert.throws(() => directTradeAssetFromPayload({ kind: "resource", resourceId: "coin" }), /direct_trade_resource_asset_invalid/);
  assert.throws(() => directTradeAssetPayload({ kind: "item" }), /direct_trade_item_asset_invalid/);
  assert.throws(() => directTradeRequestedResourcePaymentAsset(directTrade({
    requestedAsset: { kind: "resource", resourceId: "coin" } as never,
  })), /direct_trade_resource_asset_invalid/);
  assert.throws(() => directTradeOfferedResourceGoodsAsset(directTrade({
    offeredAsset: { kind: "resource", amount: 3 } as never,
  })), /direct_trade_resource_asset_invalid/);
});

test("direct trade rules flag repeat counterparty acceptance inside the review window", () => {
  assert.equal(DIRECT_TRADE_REPEAT_COUNTERPARTY_WINDOW_SECONDS, 3600);
  const trade = directTrade({ tradeId: "trade_new" });
  const directTrades = {
    old_recent_reversed: directTrade({
      tradeId: "old_recent_reversed",
      proposerAgentId: "agent_buyer",
      counterpartyAgentId: "agent_seller",
      status: "accepted",
      acceptedAt: "2026-07-07T03:30:00.000Z",
    }),
    old_stale: directTrade({
      tradeId: "old_stale",
      status: "accepted",
      acceptedAt: "2026-07-07T02:00:00.000Z",
    }),
  };

  assert.deepEqual(directTradeRisk(directTrades, trade, "agent_buyer", acceptedAt), {
    flags: ["repeat_counterparty_trade"],
    score: 1,
  });
});

test("direct trade rules plan created and escrow lock payloads", () => {
  assert.deepEqual(directTradeCreatedPayload({
    tradeId: "trade_created",
    regionId: "region_cinder",
    proposerAgentId: "agent_seller",
    proposerExplorerId: "explorer_seller",
    counterpartyAgentId: "agent_buyer",
    counterpartyExplorerId: "explorer_buyer",
    offeredAsset: directTradeResourceAsset("aether", 4),
    requestedAsset: directTradeResourceAsset("coin", 12),
    createdAt: acceptedAt,
  }), {
    tradeId: "trade_created",
    regionId: "region_cinder",
    proposerAgentId: "agent_seller",
    proposerExplorerId: "explorer_seller",
    counterpartyAgentId: "agent_buyer",
    counterpartyExplorerId: "explorer_buyer",
    offeredAsset: { kind: "resource", resourceId: "aether", amount: 4 },
    requestedAsset: { kind: "resource", resourceId: "coin", amount: 12 },
    createdAt: acceptedAt,
  });

  assert.deepEqual(directTradeOfferedResourceLockSpendPayload("trade_created", "aether", 4, 6), {
    resourceId: "aether",
    amount: 4,
    reason: "direct_trade_lock:trade_created",
    balanceAfter: 6,
  });
});

test("direct trade rules plan creation event sequences", () => {
  const idFactory = createSequentialEpochIdFactory("direct_trade_creation");
  const makeEvent = eventFactory(() => new Date(acceptedAt), idFactory, {
    actorExplorerId: "explorer_seller",
    trustClass: "user_verified_web" as const,
    causationId: "direct_trade_creation",
    correlationId: "corr_direct_trade_creation",
  });
  const resourceEvents = planDirectTradeCreationEvents({
    tradeId: "trade_created",
    regionId: "region_cinder",
    proposerAgentId: "agent_seller",
    proposerExplorerId: "explorer_seller",
    counterpartyAgentId: "agent_buyer",
    counterpartyExplorerId: "explorer_buyer",
    offeredAsset: directTradeResourceAsset("aether", 4),
    requestedAsset: directTradeResourceAsset("coin", 12),
    createdAt: acceptedAt,
    proposerOfferBalanceBefore: 9,
    makeEvent,
  });

  assert.deepEqual(resourceEvents.map((event) => event.eventType), [
    "resource_spent",
    "direct_trade_created",
  ]);
  const [locked, created] = resourceEvents;
  assert.equal(locked?.aggregateType, "resource_account");
  assert.equal(locked?.aggregateId, "agent_seller");
  assert.equal(created?.aggregateType, "direct_trade");
  assert.equal(created?.aggregateId, "trade_created");
  if (locked?.eventType !== "resource_spent") throw new Error("expected_resource_spent");
  if (created?.eventType !== "direct_trade_created") throw new Error("expected_direct_trade_created");
  assert.deepEqual(locked.payload, {
    resourceId: "aether",
    amount: 4,
    reason: "direct_trade_lock:trade_created",
    balanceAfter: 5,
  });
  assert.equal(created.payload.proposerAgentId, "agent_seller");

  const itemEvents = planDirectTradeCreationEvents({
    tradeId: "trade_item",
    regionId: "region_cinder",
    proposerAgentId: "agent_seller",
    proposerExplorerId: "explorer_seller",
    counterpartyAgentId: "agent_buyer",
    counterpartyExplorerId: "explorer_buyer",
    offeredAsset: {
      kind: "item",
      itemId: "item_offer",
      itemKey: "obsidian_knife",
      itemDisplayName: "黑曜短刀",
      itemRarity: "rare",
    },
    requestedAsset: directTradeResourceAsset("coin", 12),
    createdAt: acceptedAt,
    proposerOfferBalanceBefore: 0,
    makeEvent,
  });
  assert.deepEqual(itemEvents.map((event) => event.eventType), ["direct_trade_created"]);

  const projectedTrade = {
    tradeId: "trade_created",
    status: "open",
    marker: "created",
  } as const;
  assert.equal(projectDirectTradeCreation({
    events: resourceEvents,
    projection: {
      directTrades: {
        trade_created: projectedTrade,
      },
    },
  }), projectedTrade);
  assert.throws(() => projectDirectTradeCreation({
    events: [],
    projection: {
      directTrades: {
        trade_created: projectedTrade,
      },
    },
  }), /direct_trade_created_event_missing/);
  assert.throws(() => projectDirectTradeCreation({
    events: resourceEvents,
    projection: {
      directTrades: {},
    },
  }), /direct_trade_projection_failed/);
});

test("direct trade rules plan accepted payloads", () => {
  assert.deepEqual(directTradeAcceptedPayload({
    trade: directTrade({
      tradeId: "trade_accepted",
      regionId: "region_cinder",
      proposerAgentId: "agent_seller",
      proposerExplorerId: "explorer_seller",
    }),
    counterpartyAgentId: "agent_buyer",
    counterpartyExplorerId: "explorer_buyer",
    transferredOfferedItemId: "item_offer",
    transferredRequestedItemId: "item_request",
    tradeRisk: { flags: ["repeat_counterparty_trade"], score: 1 },
    acceptedAt,
  }), {
    tradeId: "trade_accepted",
    regionId: "region_cinder",
    proposerAgentId: "agent_seller",
    proposerExplorerId: "explorer_seller",
    counterpartyAgentId: "agent_buyer",
    counterpartyExplorerId: "explorer_buyer",
    transferredOfferedItemId: "item_offer",
    transferredRequestedItemId: "item_request",
    tradeRiskFlags: ["repeat_counterparty_trade"],
    tradeRiskScore: 1,
    acceptedAt,
  });
});

test("direct trade rules plan acceptance ledger and item transfer payloads", () => {
  const trade = directTrade({
    tradeId: "trade_accepted",
    offeredAsset: directTradeResourceAsset("aether", 4),
    requestedAsset: directTradeResourceAsset("coin", 12),
  });

  assert.deepEqual(directTradeRequestedResourcePaymentAsset(trade), {
    resourceId: "coin",
    amount: 12,
  });
  assert.equal(directTradeRequestedResourcePaymentAsset(directTrade({
    requestedAsset: {
      kind: "item",
      itemId: "item_request",
      itemKey: "cinder_ring",
      itemDisplayName: "余烬戒指",
      itemRarity: "uncommon",
    },
  })), undefined);
  assert.deepEqual(directTradeOfferedResourceGoodsAsset(trade), {
    resourceId: "aether",
    amount: 4,
  });
  assert.equal(directTradeOfferedResourceGoodsAsset(directTrade({
    offeredAsset: {
      kind: "item",
      itemId: "item_offer",
      itemKey: "obsidian_knife",
      itemDisplayName: "黑曜短刀",
      itemRarity: "rare",
    },
  })), undefined);
  assert.deepEqual(directTradeRequestedResourcePaymentPayloads({
    trade,
    counterpartyBalanceAfter: 8,
    proposerBalanceAfter: 20,
  }), {
    spend: {
      resourceId: "coin",
      amount: 12,
      reason: "direct_trade_payment:trade_accepted",
      balanceAfter: 8,
    },
    grant: {
      resourceId: "coin",
      amount: 12,
      reason: "direct_trade_payment:trade_accepted",
      balanceAfter: 20,
    },
  });
  assert.deepEqual(directTradeRequestedResourcePaymentSpendPayload(trade, 8), {
    resourceId: "coin",
    amount: 12,
    reason: "direct_trade_payment:trade_accepted",
    balanceAfter: 8,
  });
  assert.deepEqual(directTradeRequestedResourcePaymentGrantPayload(trade, 20), {
    resourceId: "coin",
    amount: 12,
    reason: "direct_trade_payment:trade_accepted",
    balanceAfter: 20,
  });
  assert.deepEqual(directTradeOfferedResourceGoodsGrantPayload(trade, 7), {
    resourceId: "aether",
    amount: 4,
    reason: "direct_trade_goods:trade_accepted",
    balanceAfter: 7,
  });
  assert.equal(directTradeOfferedResourceGoodsGrantPayload(directTrade({
    offeredAsset: {
      kind: "item",
      itemId: "item_offer",
      itemKey: "obsidian_knife",
      itemDisplayName: "黑曜短刀",
      itemRarity: "rare",
    },
  }), 7), undefined);
  assert.deepEqual(directTradeOfferedItemTransferPayload({
    trade: directTrade({
      tradeId: "trade_item",
      offeredAsset: {
        kind: "item",
        itemId: "item_offer",
        itemKey: "obsidian_knife",
        itemDisplayName: "黑曜短刀",
        itemRarity: "rare",
      },
    }),
    itemId: "item_offer",
    transferredAt: acceptedAt,
  }), {
    itemId: "item_offer",
    fromAgentId: "agent_seller",
    fromExplorerId: "explorer_seller",
    toAgentId: "agent_buyer",
    toExplorerId: "explorer_buyer",
    sourceOrderId: "trade_item",
    transferredAt: acceptedAt,
  });
  assert.deepEqual(directTradeRequestedItemTransferPayload({
    trade: directTrade({
      tradeId: "trade_item",
      requestedAsset: {
        kind: "item",
        itemId: "item_request",
        itemKey: "cinder_ring",
        itemDisplayName: "余烬戒指",
        itemRarity: "uncommon",
      },
    }),
    itemId: "item_request",
    transferredAt: acceptedAt,
  }), {
    itemId: "item_request",
    fromAgentId: "agent_buyer",
    fromExplorerId: "explorer_buyer",
    toAgentId: "agent_seller",
    toExplorerId: "explorer_seller",
    sourceOrderId: "trade_item",
    transferredAt: acceptedAt,
  });
});

test("direct trade rules plan acceptance event sequences", () => {
  const idFactory = createSequentialEpochIdFactory("direct_trade_acceptance");
  const makeEvent = eventFactory(() => new Date(acceptedAt), idFactory, {
    actorExplorerId: "explorer_buyer",
    trustClass: "user_verified_web" as const,
    causationId: "direct_trade_acceptance",
    correlationId: "corr_direct_trade_acceptance",
  });
  const resourceTrade = directTrade({
    tradeId: "trade_resource",
    offeredAsset: directTradeResourceAsset("aether", 4),
    requestedAsset: directTradeResourceAsset("coin", 12),
  });
  const resourceEvents = planDirectTradeAcceptanceEvents({
    trade: resourceTrade,
    counterpartyAgentId: "agent_buyer",
    counterpartyExplorerId: "explorer_buyer",
    proposerExplorerId: "explorer_seller",
    counterpartyRequestedBalanceBefore: () => 20,
    proposerRequestedBalanceBefore: () => 8,
    counterpartyOfferedBalanceBefore: () => 3,
    tradeRisk: { flags: ["repeat_counterparty_trade"], score: 1 },
    acceptedAt,
    makeEvent,
  });

  assert.deepEqual(resourceEvents.map((event) => event.eventType), [
    "resource_spent",
    "resource_granted",
    "resource_granted",
    "direct_trade_accepted",
  ]);
  const [paymentSpent, paymentGranted, goodsGranted, resourceAccepted] = resourceEvents;
  assert.equal(paymentSpent?.aggregateId, "agent_buyer");
  assert.equal(paymentGranted?.aggregateId, "agent_seller");
  assert.equal(goodsGranted?.aggregateId, "agent_buyer");
  assert.equal(resourceAccepted?.aggregateType, "direct_trade");
  if (paymentSpent?.eventType !== "resource_spent") throw new Error("expected_payment_spent");
  if (paymentGranted?.eventType !== "resource_granted") throw new Error("expected_payment_granted");
  if (goodsGranted?.eventType !== "resource_granted") throw new Error("expected_goods_granted");
  if (resourceAccepted?.eventType !== "direct_trade_accepted") throw new Error("expected_direct_trade_accepted");
  assert.equal(paymentSpent.payload.balanceAfter, 8);
  assert.equal(paymentGranted.payload.balanceAfter, 20);
  assert.equal(goodsGranted.payload.balanceAfter, 7);
  assert.deepEqual(resourceAccepted.payload.tradeRiskFlags, ["repeat_counterparty_trade"]);

  const itemTrade = directTrade({
    tradeId: "trade_item",
    offeredAsset: {
      kind: "item",
      itemId: "item_offer",
      itemKey: "obsidian_knife",
      itemDisplayName: "黑曜短刀",
      itemRarity: "rare",
    },
    requestedAsset: {
      kind: "item",
      itemId: "item_request",
      itemKey: "cinder_ring",
      itemDisplayName: "余烬戒指",
      itemRarity: "uncommon",
    },
  });
  const itemEvents = planDirectTradeAcceptanceEvents({
    trade: itemTrade,
    counterpartyAgentId: "agent_buyer",
    counterpartyExplorerId: "explorer_buyer",
    proposerExplorerId: "explorer_seller",
    counterpartyRequestedBalanceBefore: () => 0,
    proposerRequestedBalanceBefore: () => 0,
    counterpartyOfferedBalanceBefore: () => 0,
    transferredOfferedItemId: "item_offer",
    transferredRequestedItemId: "item_request",
    tradeRisk: { flags: [], score: 0 },
    acceptedAt,
    makeEvent,
  });
  assert.deepEqual(itemEvents.map((event) => event.eventType), [
    "item_transferred",
    "item_transferred",
    "direct_trade_accepted",
  ]);

  const projectedTrade = {
    tradeId: "trade_resource",
    status: "accepted",
    marker: "accepted",
  } as const;
  assert.equal(projectDirectTradeAcceptance({
    events: resourceEvents,
    projection: {
      directTrades: {
        trade_resource: projectedTrade,
      },
    },
  }), projectedTrade);
  assert.throws(() => projectDirectTradeAcceptance({
    events: [],
    projection: {
      directTrades: {
        trade_resource: projectedTrade,
      },
    },
  }), /direct_trade_accepted_event_missing/);
  assert.throws(() => projectDirectTradeAcceptance({
    events: resourceEvents,
    projection: {
      directTrades: {},
    },
  }), /direct_trade_projection_failed/);
});

test("direct trade rules plan cancel expiry and refund payloads", () => {
  const trade = directTrade({
    tradeId: "trade_terminal",
    regionId: "region_cinder",
    proposerAgentId: "agent_seller",
    proposerExplorerId: "explorer_seller",
    offeredAsset: directTradeResourceAsset("aether", 4),
  });

  assert.deepEqual(directTradeCancelledPayload(trade, "2026-07-07T04:10:00.000Z"), {
    tradeId: "trade_terminal",
    regionId: "region_cinder",
    proposerAgentId: "agent_seller",
    cancelledAt: "2026-07-07T04:10:00.000Z",
  });
  assert.deepEqual(directTradeExpiredPayload(trade, "2026-07-07T05:00:00.000Z", 86_400), {
    tradeId: "trade_terminal",
    regionId: "region_cinder",
    proposerAgentId: "agent_seller",
    expiredAt: "2026-07-07T05:00:00.000Z",
    maxAgeSeconds: 86_400,
  });
  assert.deepEqual(directTradeOfferedResourceRefundAsset(trade), {
    resourceId: "aether",
    amount: 4,
  });
  assert.deepEqual(directTradeOfferedResourceRefundPayload(trade, "expired", 9), {
    resourceId: "aether",
    amount: 4,
    reason: "direct_trade_expired:trade_terminal",
    balanceAfter: 9,
  });
  assert.equal(directTradeOfferedResourceRefundPayload(directTrade({
    offeredAsset: {
      kind: "item",
      itemId: "item_offer",
      itemKey: "obsidian_knife",
      itemDisplayName: "黑曜短刀",
      itemRarity: "rare",
    },
  }), "cancel", 9), undefined);
});

test("direct trade rules plan cancellation and expiry event sequences", () => {
  const idFactory = createSequentialEpochIdFactory("direct_trade_terminal");
  const terminalAt = "2026-07-07T05:00:00.000Z";
  const makeEvent = eventFactory(() => new Date(terminalAt), idFactory, {
    actorExplorerId: "explorer_seller",
    trustClass: "user_verified_web" as const,
    causationId: "direct_trade_terminal",
    correlationId: "corr_direct_trade_terminal",
  });
  const trade = directTrade({
    tradeId: "trade_terminal",
    regionId: "region_cinder",
    proposerAgentId: "agent_seller",
    proposerExplorerId: "explorer_seller",
    offeredAsset: directTradeResourceAsset("aether", 4),
  });

  const cancelledEvents = planDirectTradeCancellationEvents({
    trade,
    cancelledAt: terminalAt,
    proposerRefundBalanceBefore: () => 5,
    makeEvent,
  });
  assert.deepEqual(cancelledEvents.map((event) => event.eventType), [
    "resource_granted",
    "direct_trade_cancelled",
  ]);
  const [cancelRefund, cancelled] = cancelledEvents;
  if (cancelRefund?.eventType !== "resource_granted") throw new Error("expected_cancel_refund");
  if (cancelled?.eventType !== "direct_trade_cancelled") throw new Error("expected_direct_trade_cancelled");
  assert.equal(cancelRefund.payload.reason, "direct_trade_cancel:trade_terminal");
  assert.equal(cancelRefund.payload.balanceAfter, 9);
  assert.equal(cancelled.payload.cancelledAt, terminalAt);

  const expiredEvents = planDirectTradeExpiryEvents({
    trade,
    expiredAt: terminalAt,
    maxAgeSeconds: 86_400,
    proposerRefundBalanceBefore: () => 6,
    makeEvent,
  });
  assert.deepEqual(expiredEvents.map((event) => event.eventType), [
    "resource_granted",
    "direct_trade_expired",
  ]);
  const [expireRefund, expired] = expiredEvents;
  if (expireRefund?.eventType !== "resource_granted") throw new Error("expected_expire_refund");
  if (expired?.eventType !== "direct_trade_expired") throw new Error("expected_direct_trade_expired");
  assert.equal(expireRefund.payload.reason, "direct_trade_expired:trade_terminal");
  assert.equal(expireRefund.payload.balanceAfter, 10);
  assert.equal(expired.payload.maxAgeSeconds, 86_400);

  const itemTrade = directTrade({
    tradeId: "trade_item",
    offeredAsset: {
      kind: "item",
      itemId: "item_offer",
      itemKey: "obsidian_knife",
      itemDisplayName: "黑曜短刀",
      itemRarity: "rare",
    },
  });
  assert.deepEqual(planDirectTradeCancellationEvents({
    trade: itemTrade,
    cancelledAt: terminalAt,
    proposerRefundBalanceBefore: () => 0,
    makeEvent,
  }).map((event) => event.eventType), ["direct_trade_cancelled"]);

  const projectedCancel = {
    tradeId: "trade_terminal",
    status: "cancelled",
    marker: "cancelled",
  } as const;
  assert.equal(projectDirectTradeCancellation({
    events: cancelledEvents,
    projection: {
      directTrades: {
        trade_terminal: projectedCancel,
      },
    },
  }), projectedCancel);
  assert.throws(() => projectDirectTradeCancellation({
    events: [],
    projection: {
      directTrades: {
        trade_terminal: projectedCancel,
      },
    },
  }), /direct_trade_cancelled_event_missing/);
  assert.throws(() => projectDirectTradeCancellation({
    events: cancelledEvents,
    projection: {
      directTrades: {},
    },
  }), /direct_trade_projection_failed/);

  const projectedExpiry = {
    tradeId: "trade_terminal",
    status: "expired",
    marker: "expired",
  } as const;
  assert.equal(projectDirectTradeExpiry({
    events: expiredEvents,
    projection: {
      directTrades: {
        trade_terminal: projectedExpiry,
      },
    },
  }), projectedExpiry);
  assert.throws(() => projectDirectTradeExpiry({
    events: [],
    projection: {
      directTrades: {
        trade_terminal: projectedExpiry,
      },
    },
  }), /direct_trade_expired_event_missing/);
  assert.throws(() => projectDirectTradeExpiry({
    events: expiredEvents,
    projection: {
      directTrades: {},
    },
  }), /direct_trade_projection_failed/);
});

test("direct trade rules select stale open expiry tick targets", () => {
  const tickedAt = "2026-07-07T05:00:00.000Z";
  const trade = (
    tradeId: string,
    createdAt: string,
    status: "open" | "accepted" | "cancelled" | "expired" = "open",
  ) => ({ tradeId, createdAt, status });

  assert.equal(directTradeExpiryLimit(undefined), 25);
  assert.equal(directTradeExpiryLimit(0), 25);
  assert.equal(directTradeExpiryLimit(-5), 1);
  assert.equal(directTradeExpiryLimit(200), 100);
  assert.equal(directTradeExpiryMaxAgeSeconds(undefined), 86_400);
  assert.equal(directTradeExpiryMaxAgeSeconds(0), 86_400);
  assert.equal(directTradeExpiryMaxAgeSeconds(-5), 1);
  assert.deepEqual(
    selectExpiredDirectTradeTargets({
      fresh: trade("fresh", "2026-07-07T04:30:01.000Z"),
      accepted: trade("accepted", "2026-07-07T03:00:00.000Z", "accepted"),
      old_b: trade("old_b", "2026-07-07T03:00:00.000Z"),
      boundary: trade("boundary", "2026-07-07T04:00:00.000Z"),
      old_a: trade("old_a", "2026-07-07T03:00:00.000Z"),
    }, {
      tickedAt,
      maxAgeSeconds: 3_600,
      limit: 2,
    }).map((item) => item.tradeId),
    ["old_a", "old_b"],
  );
  assert.deepEqual(
    selectExpiredDirectTradeTargets({
      fresh: trade("fresh", "2026-07-07T04:30:01.000Z"),
      boundary: trade("boundary", "2026-07-07T04:00:00.000Z"),
    }, {
      tickedAt,
      maxAgeSeconds: 3_600,
      limit: 5,
    }).map((item) => item.tradeId),
    ["boundary"],
  );
});
