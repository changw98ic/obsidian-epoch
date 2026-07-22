import {
  type EpochProjection,
} from "./gameCore.ts";
import {
  CAUSAL_WORLD_SNAPSHOT_SCHEMA_VERSION,
  type CausalWorldSnapshotV1,
} from "./causalWorldSnapshot.ts";
import { canonicalRegionIdFromInput } from "./runtimeInputRules.ts";
import {
  inventoryItemsView,
  type EpochInventoryItemInfo,
} from "./progressReadModel.ts";
import {
  type ResourceProductionAssignment,
  type ResourceProductionNode,
} from "./resourceProductionRules.ts";
import {
  DEFAULT_ECONOMY_RECIPES,
  type EconomyCraftRecipe,
} from "./unifiedEconomyRules.ts";
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
  readonly production: EpochEconomyProductionInfo;
}

export interface EpochShopInfo {
  readonly regionId?: string;
  readonly offers: readonly EpochShopOfferInfo[];
  readonly production: EpochEconomyProductionInfo;
}

export interface EpochEconomyUnavailableInfo {
  readonly status: "unavailable";
  readonly reason: string;
}

export interface EpochEconomyProductionQueueInfo {
  readonly version: string;
  readonly nodes: readonly ResourceProductionNode[];
  readonly assignments: readonly ResourceProductionAssignment[];
}

export interface EpochEconomyProfessionProjection {
  readonly version: string;
  readonly professions: readonly unknown[];
}

export interface EpochEconomyRecipeProjection {
  readonly version: string;
  readonly recipes: readonly EconomyCraftRecipe[];
}

export type EpochEconomyProductionInfo =
  | {
    readonly status: "available";
    readonly version: string;
    readonly source: "causal_world_snapshot";
    readonly worldId: string;
    readonly snapshotSchemaVersion: typeof CAUSAL_WORLD_SNAPSHOT_SCHEMA_VERSION;
    readonly queues: EpochEconomyProductionQueueInfo;
    readonly professions: EpochEconomyProfessionProjection;
    readonly recipes: EpochEconomyRecipeProjection;
  }
  | {
    readonly status: "unavailable";
    readonly version: string;
    readonly source: "unavailable";
    readonly error: EpochEconomyUnavailableInfo;
  };

function booleanFilter(value: unknown): boolean | undefined {
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  return undefined;
}

function causalSnapshotFromInput(input: ReadInput): CausalWorldSnapshotV1 | undefined {
  const snapshot = input.snapshot;
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return undefined;
  const candidate = snapshot as Partial<CausalWorldSnapshotV1>;
  if (typeof candidate.worldId !== "string") return undefined;
  if (!candidate.domains || !Array.isArray(candidate.domains.resourceProductionNodes) || !Array.isArray(candidate.domains.resourceProductionAssignments)) return undefined;
  return candidate as CausalWorldSnapshotV1;
}

export function productionInfoView(input: ReadInput = {}): EpochEconomyProductionInfo {
  const snapshot = causalSnapshotFromInput(input);
  if (!snapshot) {
    return {
      status: "unavailable",
      version: "economy-production-read-model.v1",
      source: "unavailable",
      error: {
        status: "unavailable",
        reason: "causal world snapshot was not supplied to economy production read model",
      },
    };
  }
  return {
    status: "available",
    version: "economy-production-read-model.v1",
    source: "causal_world_snapshot",
    worldId: snapshot.worldId,
    snapshotSchemaVersion: snapshot.snapshotSchemaVersion,
    queues: {
      version: "resource-production-queues.v1",
      nodes: [...snapshot.domains.resourceProductionNodes].sort((left, right) => left.nodeId.localeCompare(right.nodeId)),
      assignments: [...snapshot.domains.resourceProductionAssignments].sort((left, right) => left.assignmentId.localeCompare(right.assignmentId)),
    },
    professions: {
      version: "resource-production-professions.v1",
      professions: [],
    },
    recipes: {
      version: "economy-craft-recipes.v1",
      recipes: Object.values(DEFAULT_ECONOMY_RECIPES)
        .filter((recipe): recipe is EconomyCraftRecipe => Boolean(recipe))
        .sort((left, right) => left.recipeId.localeCompare(right.recipeId)),
    },
  };
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
    production: productionInfoView(input),
  };
}

export function shopInfoView(input: ReadInput = {}): EpochShopInfo {
  const requestedRegionId = typeof input.regionId === "string" && input.regionId.trim()
    ? input.regionId.trim()
    : undefined;
  return {
    regionId: requestedRegionId,
    offers: shopOffersView(canonicalRegionIdFromInput(input.regionId)),
    production: productionInfoView(input),
  };
}

export function marketInfoView(
  projection: EpochProjection,
  input: ReadInput = {},
): EpochMarketInfo & { readonly production: EpochEconomyProductionInfo } {
  const agentId = inputString(input.agentId);
  const regionId = canonicalRegionIdFromInput(input.regionId);
  return {
    orders: marketOrdersView(projection, {
      agentId,
      regionId,
      status: inputString(input.status),
    }),
    riskRestrictions: marketRiskRestrictionsView(projection, { agentId }),
    production: productionInfoView(input),
  };
}

export function directTradesInfoView(
  projection: EpochProjection,
  input: ReadInput = {},
): EpochDirectTradeInfo & { readonly production: EpochEconomyProductionInfo } {
  const agentId = inputString(input.agentId);
  const regionId = canonicalRegionIdFromInput(input.regionId);
  const status = inputString(input.status);
  return {
    agentId,
    regionId,
    status,
    trades: directTradesView(projection, { agentId, regionId, status }),
    production: productionInfoView(input),
  };
}
