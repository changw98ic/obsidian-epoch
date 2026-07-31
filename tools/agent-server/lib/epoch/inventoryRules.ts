import {
  type EpochEvent,
  type ItemBoundPayload,
  type ItemCreatedPayload,
  type ResourceSpentPayload,
} from "./events.ts";
import type { EpochEventFactory } from "./eventFactory.ts";
import { itemBoundEvent, itemCreatedEvent } from "./inventoryItemLedgerEvents.ts";
import {
  type EpochIdFactory,
  stableKey,
  type EpochResourceId,
} from "./protocol.ts";
import { resourceSpentEvents } from "./resourceLedgerEvents.ts";

export interface InventoryCraftRecipe {
  readonly recipeId: string;
  readonly itemKey: string;
  readonly displayName: string;
  readonly rarity: string;
  readonly costs: readonly { readonly resourceId: EpochResourceId; readonly amount: number }[];
}

export interface EpochShopCost {
  readonly resourceId: EpochResourceId;
  readonly amount: number;
}

export interface EpochShopOffer {
  readonly offerId: string;
  /** Version of the server-owned shop catalog entry that set this price and limit. */
  readonly offerVersion: string;
  readonly regionId?: string;
  readonly priceRegionId?: string;
  readonly itemKey: string;
  readonly displayName: string;
  readonly rarity: string;
  readonly bindOnAcquire?: boolean;
  /** Available units within the declared stock scope. */
  readonly stock: number;
  /** Shop inventory is allocated separately to each explorer identity. */
  readonly stockScope: "per_explorer";
  /** Enforced maximum purchases for one explorer identity. */
  readonly perExplorerLimit: number;
  readonly costs: readonly EpochShopCost[];
  readonly baseCosts?: readonly EpochShopCost[];
  readonly regionalCosts?: Readonly<Record<string, readonly EpochShopCost[]>>;
}

export interface EpochInventoryItemEffect {
  readonly itemKey: string;
  readonly label: string;
  readonly resourceNodeScoreBonus: number;
}

export interface EpochInventoryEquipmentItem {
  readonly itemId: string;
  readonly itemKey: string;
  readonly bound?: boolean;
}

export interface EpochInventoryEquipmentBonus {
  readonly equipmentScoreBonus: number;
  readonly equipmentItemIds: readonly string[];
}

export interface InventoryItemProjectionForRules<TItem = unknown> {
  readonly inventoryItems: Readonly<Record<string, TItem | undefined>>;
}

export interface InventoryItemCreationEventsInput {
  readonly itemId: string;
  readonly agentId: string;
  readonly explorerId: string;
  readonly itemKey: string;
  readonly displayName: string;
  readonly rarity: string;
  readonly bound: boolean;
  readonly sourceEventIds: readonly string[];
  readonly createdAt: string;
  readonly makeEvent: EpochEventFactory;
}

export interface InventoryItemCreationProjectionInput<TItem> {
  readonly projection: Pick<InventoryItemProjectionForRules<TItem>, "inventoryItems">;
  readonly events: readonly EpochEvent[];
}

export interface CraftInventoryItemEventsInput {
  readonly recipe: InventoryCraftRecipe;
  readonly agentId: string;
  readonly explorerId: string;
  readonly spentPayloads: readonly ResourceSpentPayload[];
  readonly createdAt: string;
  readonly idFactory: EpochIdFactory;
  readonly makeEvent: EpochEventFactory;
}

export interface CraftInventoryItemProjectionInput<TItem> {
  readonly projection: Pick<InventoryItemProjectionForRules<TItem>, "inventoryItems">;
  readonly events: readonly EpochEvent[];
}

export interface ShopPurchaseEventsInput {
  readonly offer: EpochShopOffer;
  readonly agentId: string;
  readonly explorerId: string;
  readonly spentPayloads: readonly ResourceSpentPayload[];
  readonly createdAt: string;
  readonly idFactory: EpochIdFactory;
  readonly makeEvent: EpochEventFactory;
}

export interface ShopPurchaseProjectionInput<TItem> {
  readonly projection: Pick<InventoryItemProjectionForRules<TItem>, "inventoryItems">;
  readonly events: readonly EpochEvent[];
}

export interface InventoryItemBindEventsInput {
  readonly itemId: string;
  readonly agentId: string;
  readonly explorerId: string;
  readonly reason?: string;
  readonly boundAt: string;
  readonly makeEvent: EpochEventFactory;
}

export interface InventoryItemBindProjectionInput<TItem> {
  readonly projection: Pick<InventoryItemProjectionForRules<TItem>, "inventoryItems">;
  readonly events: readonly EpochEvent[];
}

export interface InventoryItemCreatedPayloadInput {
  readonly itemId: string;
  readonly agentId: string;
  readonly explorerId: string;
  readonly itemKey: string;
  readonly displayName: string;
  readonly rarity: string;
  readonly bound: boolean;
  readonly sourceEventIds: readonly string[];
  readonly createdAt: string;
}

export interface InventoryItemBoundPayloadInput {
  readonly itemId: string;
  readonly agentId: string;
  readonly explorerId: string;
  readonly reason?: string;
  readonly boundAt: string;
}

export const INVENTORY_CRAFT_RECIPE_CATALOG_VERSION = "inventory-craft-recipes.v2";
export const EPOCH_SHOP_CATALOG_VERSION = "inventory-shop.v2";

export const INVENTORY_CRAFT_RECIPES: readonly InventoryCraftRecipe[] = [
  {
    recipeId: "field-kit",
    itemKey: "crafted:field-kit",
    displayName: "灰行者工具包",
    rarity: "common",
    costs: [
      { resourceId: "coin", amount: 5 },
      { resourceId: "aether", amount: 1 },
    ],
  },
  {
    recipeId: "focus-charm",
    itemKey: "crafted:focus-charm",
    displayName: "静心盐线护符",
    rarity: "uncommon",
    costs: [
      { resourceId: "focus", amount: 3 },
      { resourceId: "aether", amount: 2 },
    ],
  },
  {
    recipeId: "training-band",
    itemKey: "crafted:training-band",
    displayName: "巡夜训练缚带",
    rarity: "common",
    costs: [
      { resourceId: "stamina", amount: 4 },
      { resourceId: "coin", amount: 2 },
    ],
  },
  {
    recipeId: "phase6-field-blade",
    itemKey: "crafted:phase6-field-blade",
    displayName: "星铁野战刃",
    rarity: "uncommon",
    costs: [
      { resourceId: "material_forging_alloy", amount: 1 },
      { resourceId: "coin", amount: 1 },
    ],
  },
];

const INVENTORY_CRAFT_RECIPE_BY_ID = Object.fromEntries(
  INVENTORY_CRAFT_RECIPES.map((recipe) => [recipe.recipeId, recipe]),
) as Readonly<Record<string, InventoryCraftRecipe>>;

export const EPOCH_SHOP_OFFERS: readonly EpochShopOffer[] = [
  {
    offerId: "gray-ration-pack",
    offerVersion: EPOCH_SHOP_CATALOG_VERSION,
    regionId: "region_gray_harbor",
    itemKey: "shop:gray-ration-pack",
    displayName: "灰市补给包",
    rarity: "common",
    stock: 1,
    stockScope: "per_explorer",
    perExplorerLimit: 1,
    costs: [{ resourceId: "coin", amount: 3 }],
    regionalCosts: {
      region_ash_outpost: [{ resourceId: "coin", amount: 4 }],
    },
  },
  {
    offerId: "aether-survey-lantern",
    offerVersion: EPOCH_SHOP_CATALOG_VERSION,
    regionId: "region_gray_harbor",
    itemKey: "shop:aether-survey-lantern",
    displayName: "灵质探勘灯",
    rarity: "uncommon",
    stock: 1,
    stockScope: "per_explorer",
    perExplorerLimit: 1,
    costs: [
      { resourceId: "coin", amount: 4 },
      { resourceId: "aether", amount: 1 },
    ],
  },
  {
    offerId: "ashen-oath-relic",
    offerVersion: EPOCH_SHOP_CATALOG_VERSION,
    regionId: "region_gray_harbor",
    itemKey: "shop:ashen-oath-relic",
    displayName: "灰誓遗物",
    rarity: "rare",
    bindOnAcquire: true,
    stock: 1,
    stockScope: "per_explorer",
    perExplorerLimit: 1,
    costs: [
      { resourceId: "coin", amount: 8 },
      { resourceId: "legend", amount: 1 },
    ],
  },
  {
    offerId: "pipewarden-valve-kit",
    offerVersion: EPOCH_SHOP_CATALOG_VERSION,
    regionId: "region_city_pipes",
    itemKey: "shop:pipewarden-valve-kit",
    displayName: "管网阀钥工具",
    rarity: "common",
    stock: 1,
    stockScope: "per_explorer",
    perExplorerLimit: 1,
    costs: [
      { resourceId: "coin", amount: 2 },
      { resourceId: "stamina", amount: 1 },
    ],
  },
  {
    offerId: "mine-echo-relic",
    offerVersion: EPOCH_SHOP_CATALOG_VERSION,
    regionId: "region_abandoned_mine",
    itemKey: "shop:mine-echo-relic",
    displayName: "矿脉回声遗物",
    rarity: "rare",
    bindOnAcquire: true,
    stock: 1,
    stockScope: "per_explorer",
    perExplorerLimit: 1,
    costs: [
      { resourceId: "coin", amount: 6 },
      { resourceId: "focus", amount: 2 },
    ],
  },
] as const;

const EPOCH_SHOP_OFFER_BY_ID = Object.fromEntries(
  EPOCH_SHOP_OFFERS.map((offer) => [offer.offerId, offer]),
) as Readonly<Record<string, EpochShopOffer>>;

export const INVENTORY_ITEM_EFFECTS: Readonly<Record<string, EpochInventoryItemEffect>> = {
  "crafted:field-kit": {
    itemKey: "crafted:field-kit",
    label: "资源点争夺分 +1",
    resourceNodeScoreBonus: 1,
  },
  "crafted:training-band": {
    itemKey: "crafted:training-band",
    label: "资源点争夺分 +2",
    resourceNodeScoreBonus: 2,
  },
};

export function normalizeItemRarity(value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0) return "common";
  return stableKey(value) || "common";
}

export function normalizeShopRegionId(regionId: unknown): string | undefined {
  return typeof regionId === "string" && regionId.trim()
    ? stableKey(regionId)
    : undefined;
}

export function resolveEpochShopOfferForRegion(offer: EpochShopOffer, regionId?: string): EpochShopOffer {
  const priceRegionId = normalizeShopRegionId(regionId);
  const regionalCosts = priceRegionId ? offer.regionalCosts?.[priceRegionId] : undefined;
  const { regionalCosts: _regionalCosts, ...publicOffer } = offer;
  return {
    ...publicOffer,
    priceRegionId: regionalCosts ? priceRegionId : offer.regionId,
    costs: regionalCosts || offer.costs,
    baseCosts: offer.costs,
  };
}

export function epochShopOffersForRegion(regionId?: string): readonly EpochShopOffer[] {
  const normalizedRegionId = normalizeShopRegionId(regionId);
  return EPOCH_SHOP_OFFERS
    .filter((offer) =>
      !normalizedRegionId
      || !offer.regionId
      || offer.regionId === normalizedRegionId
      || Boolean(offer.regionalCosts?.[normalizedRegionId]))
    .map((offer) => resolveEpochShopOfferForRegion(offer, normalizedRegionId));
}

export function requireCraftRecipe(recipeId: string): InventoryCraftRecipe {
  const recipe = INVENTORY_CRAFT_RECIPE_BY_ID[recipeId];
  if (!recipe) throw new Error("craft_recipe_not_found");
  return recipe;
}

export function requireShopOffer(offerId: string): EpochShopOffer {
  const offer = EPOCH_SHOP_OFFER_BY_ID[offerId];
  if (!offer) throw new Error("shop_offer_not_found");
  return offer;
}

export function requireInventoryItem<TItem>(
  projection: InventoryItemProjectionForRules<TItem>,
  itemId: string,
): TItem {
  const item = projection.inventoryItems[itemId];
  if (!item) throw new Error("inventory_item_not_found");
  return item;
}

export function inventoryEquipmentBonus(
  items: readonly EpochInventoryEquipmentItem[],
): EpochInventoryEquipmentBonus {
  const countedItemKeys = new Set<string>();
  const equipmentItemIds: string[] = [];
  let equipmentScoreBonus = 0;
  for (const item of items) {
    if (!item.bound || countedItemKeys.has(item.itemKey)) continue;
    const effect = INVENTORY_ITEM_EFFECTS[item.itemKey];
    if (!effect || effect.resourceNodeScoreBonus <= 0) continue;
    countedItemKeys.add(item.itemKey);
    equipmentItemIds.push(item.itemId);
    equipmentScoreBonus += effect.resourceNodeScoreBonus;
  }
  return {
    equipmentScoreBonus,
    equipmentItemIds,
  };
}

export function inventoryItemCreatedPayload(input: InventoryItemCreatedPayloadInput): ItemCreatedPayload {
  return {
    itemId: input.itemId,
    agentId: input.agentId,
    explorerId: input.explorerId,
    itemKey: input.itemKey,
    displayName: input.displayName,
    rarity: input.rarity,
    bound: input.bound,
    sourceEventIds: input.sourceEventIds,
    createdAt: input.createdAt,
  };
}

export function planInventoryItemCreationEvents(input: InventoryItemCreationEventsInput): readonly EpochEvent[] {
  const payload = inventoryItemCreatedPayload({
    itemId: input.itemId,
    agentId: input.agentId,
    explorerId: input.explorerId,
    itemKey: input.itemKey,
    displayName: input.displayName,
    rarity: input.rarity,
    bound: input.bound,
    sourceEventIds: input.sourceEventIds,
    createdAt: input.createdAt,
  });
  return [itemCreatedEvent(input.makeEvent, input.itemId, payload, input.agentId)];
}

export function projectInventoryItemCreation<TItem>(
  input: InventoryItemCreationProjectionInput<TItem>,
): TItem {
  const created = input.events.find((event) => event.eventType === "item_created");
  if (!created || created.eventType !== "item_created") {
    throw new Error("inventory_item_created_event_missing");
  }
  const item = input.projection.inventoryItems[created.payload.itemId];
  if (!item) throw new Error("inventory_item_projection_failed");
  return item;
}

export function planCraftInventoryItemEvents(input: CraftInventoryItemEventsInput): readonly EpochEvent[] {
  const spentEvents = resourceSpentEvents(input.makeEvent, input.agentId, input.spentPayloads);
  const sourceEventIds = spentEvents.map((event) => event.eventId);
  const itemId = input.idFactory("item", `${input.agentId}:${input.recipe.itemKey}:${sourceEventIds.join(":")}`);
  const payload = inventoryItemCreatedPayload({
    itemId,
    agentId: input.agentId,
    explorerId: input.explorerId,
    itemKey: input.recipe.itemKey,
    displayName: input.recipe.displayName,
    rarity: input.recipe.rarity,
    bound: false,
    sourceEventIds,
    createdAt: input.createdAt,
  });
  const created = itemCreatedEvent(input.makeEvent, itemId, payload, input.agentId);
  return [...spentEvents, created];
}

export function projectCraftInventoryItem<TItem>(
  input: CraftInventoryItemProjectionInput<TItem>,
): TItem {
  const created = input.events.find((event) => event.eventType === "item_created");
  if (!created || created.eventType !== "item_created") {
    throw new Error("inventory_item_created_event_missing");
  }
  const item = input.projection.inventoryItems[created.payload.itemId];
  if (!item) throw new Error("inventory_item_projection_failed");
  return item;
}

export function planShopPurchaseEvents(input: ShopPurchaseEventsInput): readonly EpochEvent[] {
  const spentEvents = resourceSpentEvents(input.makeEvent, input.agentId, input.spentPayloads);
  const sourceEventIds = spentEvents.map((event) => event.eventId);
  const itemId = input.idFactory("item", `${input.agentId}:${input.offer.itemKey}:${sourceEventIds.join(":")}`);
  const payload = inventoryItemCreatedPayload({
    itemId,
    agentId: input.agentId,
    explorerId: input.explorerId,
    itemKey: input.offer.itemKey,
    displayName: input.offer.displayName,
    rarity: input.offer.rarity,
    bound: input.offer.bindOnAcquire === true,
    sourceEventIds,
    createdAt: input.createdAt,
  });
  const created = itemCreatedEvent(input.makeEvent, itemId, payload, input.agentId);
  return [...spentEvents, created];
}

export function projectShopPurchaseItem<TItem>(
  input: ShopPurchaseProjectionInput<TItem>,
): TItem {
  const created = input.events.find((event) => event.eventType === "item_created");
  if (!created || created.eventType !== "item_created") {
    throw new Error("shop_purchase_item_created_event_missing");
  }
  const item = input.projection.inventoryItems[created.payload.itemId];
  if (!item) throw new Error("shop_purchase_item_projection_failed");
  return item;
}

export function inventoryItemBoundPayload(input: InventoryItemBoundPayloadInput): ItemBoundPayload {
  return {
    itemId: input.itemId,
    agentId: input.agentId,
    explorerId: input.explorerId,
    reason: input.reason?.trim() || "bind_to_identity",
    boundAt: input.boundAt,
  };
}

export function planInventoryItemBindEvents(input: InventoryItemBindEventsInput): readonly EpochEvent[] {
  const payload = inventoryItemBoundPayload({
    itemId: input.itemId,
    agentId: input.agentId,
    explorerId: input.explorerId,
    reason: input.reason,
    boundAt: input.boundAt,
  });
  return [itemBoundEvent(input.makeEvent, input.itemId, payload, input.agentId)];
}

export function projectInventoryItemBind<TItem>(
  input: InventoryItemBindProjectionInput<TItem>,
): TItem {
  const bound = input.events.find((event) => event.eventType === "item_bound");
  if (!bound || bound.eventType !== "item_bound") {
    throw new Error("inventory_item_bound_event_missing");
  }
  const item = input.projection.inventoryItems[bound.payload.itemId];
  if (!item) throw new Error("inventory_item_projection_failed");
  return item;
}
