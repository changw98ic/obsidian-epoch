import assert from "node:assert/strict";
import test from "node:test";

import {
  inventoryItemBoundPayload,
  inventoryItemCreatedPayload,
  planCraftInventoryItemEvents,
  planInventoryItemBindEvents,
  planInventoryItemCreationEvents,
  planShopPurchaseEvents,
  projectCraftInventoryItem,
  projectInventoryItemBind,
  projectInventoryItemCreation,
  projectShopPurchaseItem,
  requireInventoryItem,
} from "../lib/epoch/inventoryRules.ts";
import { eventFactory } from "../lib/epoch/eventFactory.ts";
import { createSequentialEpochIdFactory } from "../lib/epoch/protocol.ts";

test("inventory rules read inventory item projection state", () => {
  const projection = {
    inventoryItems: {
      item_1: { itemId: "item_1", marker: "found" },
    },
  } as const;

  assert.equal(requireInventoryItem(projection, "item_1").marker, "found");
  assert.throws(() => requireInventoryItem(projection, "item_missing"), /inventory_item_not_found/);
});

test("inventory rules plan item created payloads", () => {
  assert.deepEqual(inventoryItemCreatedPayload({
    itemId: "item_1",
    agentId: "agent_1",
    explorerId: "explorer_1",
    itemKey: "crafted:field-kit",
    displayName: "灰行者工具包",
    rarity: "common",
    bound: false,
    sourceEventIds: ["event_1", "event_2"],
    createdAt: "2026-07-07T05:00:00.000Z",
  }), {
    itemId: "item_1",
    agentId: "agent_1",
    explorerId: "explorer_1",
    itemKey: "crafted:field-kit",
    displayName: "灰行者工具包",
    rarity: "common",
    bound: false,
    sourceEventIds: ["event_1", "event_2"],
    createdAt: "2026-07-07T05:00:00.000Z",
  });
});

test("inventory rules plan item creation event sequences", () => {
  const idFactory = createSequentialEpochIdFactory("inventory_create");
  const createdAt = "2026-07-07T04:55:00.000Z";
  const events = planInventoryItemCreationEvents({
    itemId: "item_1",
    agentId: "agent_1",
    explorerId: "explorer_1",
    itemKey: "operator:relic",
    displayName: "巡夜遗物",
    rarity: "rare",
    bound: false,
    sourceEventIds: ["event_source_1"],
    createdAt,
    makeEvent: eventFactory(() => new Date(createdAt), idFactory, {
      actorExplorerId: "system",
      trustClass: "system_worker" as const,
      causationId: "inventory_create",
      correlationId: "corr_inventory_create",
    }),
  });

  assert.deepEqual(events.map((event) => event.eventType), ["item_created"]);
  const created = events[0];
  assert.ok(created);
  assert.equal(created.eventType, "item_created");
  if (created.eventType !== "item_created") throw new Error("expected_item_created_event");
  assert.equal(created.aggregateType, "inventory_item");
  assert.equal(created.aggregateId, "item_1");
  assert.equal(created.agentId, "agent_1");
  assert.deepEqual(created.payload, {
    itemId: "item_1",
    agentId: "agent_1",
    explorerId: "explorer_1",
    itemKey: "operator:relic",
    displayName: "巡夜遗物",
    rarity: "rare",
    bound: false,
    sourceEventIds: ["event_source_1"],
    createdAt,
  });

  const projectedItem = {
    itemId: "item_1",
    marker: "created",
  } as const;
  assert.equal(projectInventoryItemCreation({
    events,
    projection: {
      inventoryItems: {
        item_1: projectedItem,
      },
    },
  }), projectedItem);
  assert.throws(() => projectInventoryItemCreation({
    events: [],
    projection: {
      inventoryItems: {
        item_1: projectedItem,
      },
    },
  }), /inventory_item_created_event_missing/);
  assert.throws(() => projectInventoryItemCreation({
    events,
    projection: {
      inventoryItems: {},
    },
  }), /inventory_item_projection_failed/);
});

test("inventory rules plan crafted item event sequences", () => {
  const idFactory = createSequentialEpochIdFactory("inventory_craft");
  const craftedAt = "2026-07-07T05:00:00.000Z";
  const recipe = {
    recipeId: "field-kit",
    itemKey: "crafted:field-kit",
    displayName: "灰行者工具包",
    rarity: "common",
    costs: [
      { resourceId: "coin" as const, amount: 5 },
      { resourceId: "aether" as const, amount: 1 },
    ],
  };
  const events = planCraftInventoryItemEvents({
    recipe,
    agentId: "agent_1",
    explorerId: "explorer_1",
    spentPayloads: [
      {
        resourceId: "coin",
        amount: 5,
        reason: "craft_item:field-kit",
        balanceAfter: 3,
      },
      {
        resourceId: "aether",
        amount: 1,
        reason: "craft_item:field-kit",
        balanceAfter: 0,
      },
    ],
    createdAt: craftedAt,
    idFactory,
    makeEvent: eventFactory(() => new Date(craftedAt), idFactory, {
      actorExplorerId: "explorer_1",
      trustClass: "user_verified_web" as const,
      causationId: "craft_item",
      correlationId: "corr_craft_item",
    }),
  });

  assert.deepEqual(events.map((event) => event.eventType), [
    "resource_spent",
    "resource_spent",
    "item_created",
  ]);
  const firstSpent = events[0];
  assert.ok(firstSpent);
  assert.equal(firstSpent.eventType, "resource_spent");
  if (firstSpent.eventType !== "resource_spent") throw new Error("expected_resource_spent_event");
  assert.equal(firstSpent.aggregateType, "resource_account");
  assert.equal(firstSpent.aggregateId, "agent_1");
  assert.equal(firstSpent.agentId, "agent_1");
  assert.deepEqual(firstSpent.payload, {
    resourceId: "coin",
    amount: 5,
    reason: "craft_item:field-kit",
    balanceAfter: 3,
  });

  const secondSpent = events[1];
  assert.ok(secondSpent);
  assert.equal(secondSpent.eventType, "resource_spent");
  if (secondSpent.eventType !== "resource_spent") throw new Error("expected_second_resource_spent_event");
  assert.deepEqual(secondSpent.payload, {
    resourceId: "aether",
    amount: 1,
    reason: "craft_item:field-kit",
    balanceAfter: 0,
  });

  const created = events[2];
  assert.ok(created);
  assert.equal(created.eventType, "item_created");
  if (created.eventType !== "item_created") throw new Error("expected_item_created_event");
  assert.equal(created.aggregateType, "inventory_item");
  assert.equal(created.aggregateId, created.payload.itemId);
  assert.equal(created.agentId, "agent_1");
  assert.deepEqual(created.payload, {
    itemId: created.payload.itemId,
    agentId: "agent_1",
    explorerId: "explorer_1",
    itemKey: "crafted:field-kit",
    displayName: "灰行者工具包",
    rarity: "common",
    bound: false,
    sourceEventIds: [firstSpent.eventId, secondSpent.eventId],
    createdAt: craftedAt,
  });

  const projectedItem = {
    itemId: created.payload.itemId,
    marker: "crafted",
  } as const;
  assert.equal(projectCraftInventoryItem({
    events,
    projection: {
      inventoryItems: {
        [created.payload.itemId]: projectedItem,
      },
    },
  }), projectedItem);
  assert.throws(() => projectCraftInventoryItem({
    events: [firstSpent, secondSpent],
    projection: {
      inventoryItems: {
        [created.payload.itemId]: projectedItem,
      },
    },
  }), /inventory_item_created_event_missing/);
  assert.throws(() => projectCraftInventoryItem({
    events,
    projection: {
      inventoryItems: {},
    },
  }), /inventory_item_projection_failed/);
});

test("inventory rules plan shop purchase event sequences", () => {
  const idFactory = createSequentialEpochIdFactory("shop_purchase");
  const purchasedAt = "2026-07-07T05:20:00.000Z";
  const offer = {
    offerId: "ashen-oath-relic",
    offerVersion: "inventory-shop.v2",
    itemKey: "shop:ashen-oath-relic",
    displayName: "灰誓遗物",
    rarity: "rare",
    bindOnAcquire: true,
    stock: 1,
    stockScope: "per_explorer" as const,
    perExplorerLimit: 1,
    costs: [
      { resourceId: "coin" as const, amount: 8 },
      { resourceId: "legend" as const, amount: 1 },
    ],
  };
  const events = planShopPurchaseEvents({
    offer,
    agentId: "agent_1",
    explorerId: "explorer_1",
    spentPayloads: [
      {
        resourceId: "coin",
        amount: 8,
        reason: "shop_purchase:ashen-oath-relic",
        balanceAfter: 4,
      },
      {
        resourceId: "legend",
        amount: 1,
        reason: "shop_purchase:ashen-oath-relic",
        balanceAfter: 0,
      },
    ],
    createdAt: purchasedAt,
    idFactory,
    makeEvent: eventFactory(() => new Date(purchasedAt), idFactory, {
      actorExplorerId: "explorer_1",
      trustClass: "user_verified_web" as const,
      causationId: "shop_purchase",
      correlationId: "corr_shop_purchase",
    }),
  });

  assert.deepEqual(events.map((event) => event.eventType), [
    "resource_spent",
    "resource_spent",
    "item_created",
  ]);
  const firstSpent = events[0];
  const secondSpent = events[1];
  const created = events[2];
  assert.ok(firstSpent);
  assert.ok(secondSpent);
  assert.ok(created);
  assert.equal(firstSpent.eventType, "resource_spent");
  assert.equal(secondSpent.eventType, "resource_spent");
  assert.equal(created.eventType, "item_created");
  if (firstSpent.eventType !== "resource_spent") throw new Error("expected_resource_spent_event");
  if (secondSpent.eventType !== "resource_spent") throw new Error("expected_second_resource_spent_event");
  if (created.eventType !== "item_created") throw new Error("expected_item_created_event");
  assert.equal(created.aggregateType, "inventory_item");
  assert.equal(created.aggregateId, created.payload.itemId);
  assert.equal(created.agentId, "agent_1");
  assert.deepEqual(created.payload, {
    itemId: created.payload.itemId,
    agentId: "agent_1",
    explorerId: "explorer_1",
    itemKey: "shop:ashen-oath-relic",
    displayName: "灰誓遗物",
    rarity: "rare",
    bound: true,
    sourceEventIds: [firstSpent.eventId, secondSpent.eventId],
    createdAt: purchasedAt,
  });

  const projectedItem = {
    itemId: created.payload.itemId,
    marker: "purchased",
  } as const;
  assert.equal(projectShopPurchaseItem({
    events,
    projection: {
      inventoryItems: {
        [created.payload.itemId]: projectedItem,
      },
    },
  }), projectedItem);
  assert.throws(() => projectShopPurchaseItem({
    events: [firstSpent, secondSpent],
    projection: {
      inventoryItems: {
        [created.payload.itemId]: projectedItem,
      },
    },
  }), /shop_purchase_item_created_event_missing/);
  assert.throws(() => projectShopPurchaseItem({
    events,
    projection: {
      inventoryItems: {},
    },
  }), /shop_purchase_item_projection_failed/);
});

test("inventory rules plan item bound payloads with stable defaults", () => {
  assert.deepEqual(inventoryItemBoundPayload({
    itemId: "item_1",
    agentId: "agent_1",
    explorerId: "explorer_1",
    reason: "  attune_to_agent  ",
    boundAt: "2026-07-07T05:10:00.000Z",
  }), {
    itemId: "item_1",
    agentId: "agent_1",
    explorerId: "explorer_1",
    reason: "attune_to_agent",
    boundAt: "2026-07-07T05:10:00.000Z",
  });

  assert.deepEqual(inventoryItemBoundPayload({
    itemId: "item_2",
    agentId: "agent_1",
    explorerId: "explorer_1",
    reason: "  ",
    boundAt: "2026-07-07T05:11:00.000Z",
  }), {
    itemId: "item_2",
    agentId: "agent_1",
    explorerId: "explorer_1",
    reason: "bind_to_identity",
    boundAt: "2026-07-07T05:11:00.000Z",
  });
});

test("inventory rules plan item bind event sequences", () => {
  const idFactory = createSequentialEpochIdFactory("inventory_bind");
  const boundAt = "2026-07-07T05:30:00.000Z";
  const events = planInventoryItemBindEvents({
    itemId: "item_1",
    agentId: "agent_1",
    explorerId: "explorer_1",
    reason: "  attune_to_agent  ",
    boundAt,
    makeEvent: eventFactory(() => new Date(boundAt), idFactory, {
      actorExplorerId: "explorer_1",
      trustClass: "user_verified_web" as const,
      causationId: "inventory_bind",
      correlationId: "corr_inventory_bind",
    }),
  });

  assert.deepEqual(events.map((event) => event.eventType), ["item_bound"]);
  const bound = events[0];
  assert.ok(bound);
  assert.equal(bound.eventType, "item_bound");
  if (bound.eventType !== "item_bound") throw new Error("expected_item_bound_event");
  assert.equal(bound.aggregateType, "inventory_item");
  assert.equal(bound.aggregateId, "item_1");
  assert.equal(bound.agentId, "agent_1");
  assert.deepEqual(bound.payload, {
    itemId: "item_1",
    agentId: "agent_1",
    explorerId: "explorer_1",
    reason: "attune_to_agent",
    boundAt,
  });

  const projectedItem = {
    itemId: "item_1",
    marker: "bound",
  } as const;
  assert.equal(projectInventoryItemBind({
    events,
    projection: {
      inventoryItems: {
        item_1: projectedItem,
      },
    },
  }), projectedItem);
  assert.throws(() => projectInventoryItemBind({
    events: [],
    projection: {
      inventoryItems: {
        item_1: projectedItem,
      },
    },
  }), /inventory_item_bound_event_missing/);
  assert.throws(() => projectInventoryItemBind({
    events,
    projection: {
      inventoryItems: {},
    },
  }), /inventory_item_projection_failed/);
});
