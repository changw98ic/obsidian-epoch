import type { EpochEvent } from "./events.ts";
import type { EpochInventoryItem, EpochProjection } from "./gameCore.ts";
import {
  INVENTORY_CRAFT_RECIPES,
  INVENTORY_ITEM_EFFECTS,
  epochShopOffersForRegion,
  type EpochShopCost,
} from "./inventoryRules.ts";
import {
  JOURNEY_ACTION_RESOLUTION_RULE_VERSION,
  journeyActionEquipmentFactor,
} from "./journeyActionResolutionRules.ts";
import type { EpochResourceId } from "./protocol.ts";

export const EPOCH_ECONOMY_ACTION_FACTS_VERSION = "economy-action-facts.v2";

type EconomyActionKind = "purchase_shop_offer" | "craft_item";
type EconomyActionAvailability = "available" | "insufficient_resources" | "purchase_limit_reached" | "identity_inactive";

interface EconomyActionCost extends EpochShopCost {
  readonly balance: number;
  readonly remainingAfterExecution: number;
}

interface EconomyActionSource {
  readonly kind: EconomyActionKind;
  readonly actionId: string;
  readonly itemKey: string;
  readonly displayName: string;
  readonly rarity: string;
  readonly costs: readonly EpochShopCost[];
  readonly boundOnAcquire: boolean;
  readonly execution: {
    readonly tool: "obsidian_epoch.purchase_shop_offer" | "obsidian_epoch.craft_item";
    readonly arguments: Readonly<Record<string, string>>;
  };
  readonly purchaseLimitReached?: boolean;
}

export interface EpochEconomyActionFact {
  readonly actionId: string;
  readonly kind: EconomyActionKind;
  readonly item: {
    readonly itemKey: string;
    readonly displayName: string;
    readonly rarity: string;
    readonly boundOnAcquire: boolean;
  };
  readonly costs: readonly EconomyActionCost[];
  readonly availability: {
    readonly status: EconomyActionAvailability;
    readonly missingResources: readonly { readonly resourceId: EpochResourceId; readonly amount: number }[];
    readonly balancesAfter: Readonly<Partial<Record<EpochResourceId, number>>>;
  };
  readonly execution: {
    readonly tool: "obsidian_epoch.purchase_shop_offer" | "obsidian_epoch.craft_item";
    readonly arguments: Readonly<Record<string, string>>;
    readonly idempotencyKeyRequired: true;
  };
  readonly nextJourneyImpact: {
    readonly ruleVersion: typeof JOURNEY_ACTION_RESOLUTION_RULE_VERSION;
    readonly equipmentFactor: {
      readonly before: number;
      readonly after: number;
      readonly delta: number;
    };
    readonly summary: string;
    readonly binding?: {
      readonly tool: "obsidian_epoch.bind_item";
      readonly optionalEquipmentFactorAfterBinding: number;
      readonly optionalEquipmentFactorDelta: number;
      readonly resourceNodeScoreBonus?: number;
    };
  };
}

export interface EpochEconomyActionFacts {
  readonly authority: "server_economy_action_facts";
  readonly version: typeof EPOCH_ECONOMY_ACTION_FACTS_VERSION;
  readonly agentId: string;
  readonly explorerId: string;
  readonly regionId?: string;
  readonly ownerAccess: {
    readonly status: "owner_authorized" | "identity_inactive";
    readonly canExecute: boolean;
  };
  readonly balances: Readonly<Partial<Record<EpochResourceId, number>>>;
  readonly actions: readonly EpochEconomyActionFact[];
}

function balanceOf(
  balances: Readonly<Partial<Record<EpochResourceId, number>>>,
  resourceId: EpochResourceId,
) {
  const value = balances[resourceId];
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

function normalizedBalances(
  balances: Readonly<Partial<Record<EpochResourceId, number>>>,
): Readonly<Partial<Record<EpochResourceId, number>>> {
  return Object.fromEntries(Object.entries(balances)
    .filter((entry): entry is [EpochResourceId, number] =>
      typeof entry[1] === "number" && Number.isFinite(entry[1]))
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([resourceId, amount]) => [resourceId, Math.max(0, Math.floor(amount))])) as Readonly<
      Partial<Record<EpochResourceId, number>
    >>;
}

function agentItems(projection: EpochProjection, agentId: string): readonly EpochInventoryItem[] {
  return (projection.inventoryItemIdsByAgent[agentId] || [])
    .map((itemId) => projection.inventoryItems[itemId])
    .filter((item): item is EpochInventoryItem => Boolean(item));
}

function purchaseCount(events: readonly EpochEvent[], agentId: string, offerId: string) {
  const purchaseRefs = new Set<string>();
  for (const event of events) {
    if (event.eventType !== "resource_spent" || event.agentId !== agentId) continue;
    const reason = event.payload.reason;
    if (reason !== `shop_purchase:${offerId}` && !reason.endsWith(`:${offerId}`)) continue;
    purchaseRefs.add(event.idempotencyKey || event.correlationId || event.causationId || event.eventId);
  }
  return purchaseRefs.size;
}

function actionSources(input: {
  readonly projection: EpochProjection;
  readonly agentId: string;
  readonly regionId?: string;
}): readonly EconomyActionSource[] {
  const shop = epochShopOffersForRegion(input.regionId).map((offer): EconomyActionSource => ({
    kind: "purchase_shop_offer",
    actionId: `shop:${offer.offerId}`,
    itemKey: offer.itemKey,
    displayName: offer.displayName,
    rarity: offer.rarity,
    costs: offer.costs,
    boundOnAcquire: offer.bindOnAcquire === true,
    execution: {
      tool: "obsidian_epoch.purchase_shop_offer",
      arguments: {
        agentId: input.agentId,
        offerId: offer.offerId,
        ...(input.regionId ? { regionId: input.regionId } : {}),
      },
    },
    purchaseLimitReached: purchaseCount(input.projection.events, input.agentId, offer.offerId)
      >= Math.min(offer.stock, offer.perExplorerLimit),
  }));
  const crafts = INVENTORY_CRAFT_RECIPES.map((recipe): EconomyActionSource => ({
    kind: "craft_item",
    actionId: `craft:${recipe.recipeId}`,
    itemKey: recipe.itemKey,
    displayName: recipe.displayName,
    rarity: recipe.rarity,
    costs: recipe.costs,
    boundOnAcquire: false,
    execution: {
      tool: "obsidian_epoch.craft_item",
      arguments: {
        agentId: input.agentId,
        recipeId: recipe.recipeId,
      },
    },
  }));
  return [...shop, ...crafts].sort((left, right) => left.actionId.localeCompare(right.actionId));
}

function economyActionFact(input: {
  readonly source: EconomyActionSource;
  readonly balances: Readonly<Partial<Record<EpochResourceId, number>>>;
  readonly currentItems: readonly EpochInventoryItem[];
  readonly identityActive: boolean;
}) : EpochEconomyActionFact {
  const costs = input.source.costs.map((cost) => {
    const balance = balanceOf(input.balances, cost.resourceId);
    return {
      ...cost,
      balance,
      remainingAfterExecution: balance - cost.amount,
    };
  });
  const missingResources = costs
    .filter((cost) => cost.remainingAfterExecution < 0)
    .map((cost) => ({ resourceId: cost.resourceId, amount: Math.abs(cost.remainingAfterExecution) }));
  const availability: EconomyActionAvailability = !input.identityActive
    ? "identity_inactive"
    : input.source.purchaseLimitReached
      ? "purchase_limit_reached"
      : missingResources.length > 0
        ? "insufficient_resources"
        : "available";
  const balancesAfter = {
    ...input.balances,
    ...Object.fromEntries(costs.map((cost) => [cost.resourceId, Math.max(0, cost.remainingAfterExecution)])),
  } as Readonly<Partial<Record<EpochResourceId, number>>>;
  const before = journeyActionEquipmentFactor(input.currentItems);
  const candidate = {
    itemId: `economy-advice:${input.source.actionId}`,
    rarity: input.source.rarity,
    bound: input.source.boundOnAcquire,
  };
  const after = journeyActionEquipmentFactor([...input.currentItems, candidate]);
  const boundAfter = journeyActionEquipmentFactor([...input.currentItems, { ...candidate, bound: true }]);
  const effect = INVENTORY_ITEM_EFFECTS[input.source.itemKey];
  return {
    actionId: input.source.actionId,
    kind: input.source.kind,
    item: {
      itemKey: input.source.itemKey,
      displayName: input.source.displayName,
      rarity: input.source.rarity,
      boundOnAcquire: input.source.boundOnAcquire,
    },
    costs,
    availability: {
      status: availability,
      missingResources,
      balancesAfter,
    },
    execution: {
      ...input.source.execution,
      idempotencyKeyRequired: true,
    },
    nextJourneyImpact: {
      ruleVersion: JOURNEY_ACTION_RESOLUTION_RULE_VERSION,
      equipmentFactor: {
        before,
        after,
        delta: after - before,
      },
      summary: after > before
        ? `下一局的服务器行动结算装备因子将从 ${before} 提高到 ${after}。`
        : `下一局的服务器行动结算装备因子保持 ${before}，不会因这件物品再提高。`,
      ...(!input.source.boundOnAcquire ? {
        binding: {
          tool: "obsidian_epoch.bind_item" as const,
          optionalEquipmentFactorAfterBinding: boundAfter,
          optionalEquipmentFactorDelta: boundAfter - before,
          ...(effect ? { resourceNodeScoreBonus: effect.resourceNodeScoreBonus } : {}),
        },
      } : {}),
    },
  };
}

export function epochEconomyActionOptions(input: {
  readonly projection: EpochProjection;
  readonly agentId: string;
  readonly explorerId: string;
  readonly regionId?: string;
}): EpochEconomyActionFacts {
  const identity = input.projection.identities[input.agentId];
  const identityActive = identity?.status === "active" && identity.explorerId === input.explorerId;
  const balances = normalizedBalances(input.projection.resourceBalances[input.agentId] || {});
  const actions = actionSources(input).map((source) => economyActionFact({
    source,
    balances,
    currentItems: agentItems(input.projection, input.agentId),
    identityActive,
  }));
  return {
    authority: "server_economy_action_facts",
    version: EPOCH_ECONOMY_ACTION_FACTS_VERSION,
    agentId: input.agentId,
    explorerId: input.explorerId,
    ...(input.regionId ? { regionId: input.regionId } : {}),
    ownerAccess: identityActive
      ? { status: "owner_authorized", canExecute: true }
      : { status: "identity_inactive", canExecute: false },
    balances,
    actions,
  };
}
