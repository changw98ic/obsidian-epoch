import {
  type EpochProjection,
} from "./gameCore.ts";
import { canonicalRegionIdFromInput } from "./runtimeInputRules.ts";
import {
  inventoryItemsView,
  type EpochInventoryItemInfo,
} from "./progressReadModel.ts";
import {
  shopOffersView,
  type EpochShopOfferInfo,
} from "./shopReadModel.ts";
import {
  directTradesView,
  marketOrdersView,
  marketRiskRestrictionsView,
  type EpochDirectTradeInfo,
  type EpochMarketInfo,
} from "./marketReadModel.ts";

type ReadInput = Record<string, unknown>;

function inputString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

export interface EpochInventoryInfo {
  readonly agentId?: string;
  readonly explorerId?: string;
  readonly bound?: boolean;
  readonly tradable?: boolean;
  readonly items: readonly EpochInventoryItemInfo[];
}

export interface EpochShopInfo {
  readonly regionId?: string;
  readonly offers: readonly EpochShopOfferInfo[];
}

function booleanFilter(value: unknown): boolean | undefined {
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  return undefined;
}

export function inventoryInfoView(projection: EpochProjection, input: ReadInput = {}): EpochInventoryInfo {
  const agentId = inputString(input.agentId);
  const explorerId = inputString(input.explorerId);
  const bound = booleanFilter(input.bound);
  const tradable = input.tradable === true || input.tradable === "true";
  return {
    agentId,
    explorerId,
    bound,
    tradable: tradable || undefined,
    items: inventoryItemsView(projection, {
      agentId,
      explorerId,
      bound,
      tradable,
    }),
  };
}

export function shopInfoView(input: ReadInput = {}): EpochShopInfo {
  const requestedRegionId = typeof input.regionId === "string" && input.regionId.trim()
    ? input.regionId.trim()
    : undefined;
  return {
    regionId: requestedRegionId,
    offers: shopOffersView(canonicalRegionIdFromInput(input.regionId)),
  };
}

export function marketInfoView(projection: EpochProjection, input: ReadInput = {}): EpochMarketInfo {
  const agentId = inputString(input.agentId);
  const regionId = canonicalRegionIdFromInput(input.regionId);
  return {
    orders: marketOrdersView(projection, {
      agentId,
      regionId,
      status: inputString(input.status),
    }),
    riskRestrictions: marketRiskRestrictionsView(projection, { agentId }),
  };
}

export function directTradesInfoView(projection: EpochProjection, input: ReadInput = {}): EpochDirectTradeInfo {
  const agentId = inputString(input.agentId);
  const regionId = canonicalRegionIdFromInput(input.regionId);
  const status = inputString(input.status);
  return {
    agentId,
    regionId,
    status,
    trades: directTradesView(projection, { agentId, regionId, status }),
  };
}
