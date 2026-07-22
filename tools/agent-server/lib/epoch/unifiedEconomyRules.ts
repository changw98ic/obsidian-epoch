import type {
  CausalActorRef,
  CausalEffectV1,
  CausalEntityRef,
  OwnershipInterestType,
  ResourceLedgerEffectV1,
  StateTransitionEffectV1,
  UniqueItemLifecycleEffectV1,
} from "./causalContracts.ts";
import {
  CAUSAL_RESOURCE_SINK_REFS,
  CAUSAL_RESOURCE_SOURCE_REFS,
} from "./causalResourceCatalog.ts";

export const UNIFIED_ECONOMY_RULESET_VERSION = "obsidian-epoch-unified-economy-v0.1.0" as const;
export const UNIFIED_ECONOMY_CONTENT_VERSION = "2026.07.20-materials-v1" as const;
export const UNIFIED_ECONOMY_PRICE_BASIS_POINTS = 10_000n;
export const UNIFIED_ECONOMY_DEFAULT_FEE_BASIS_POINTS = 500n;
export const UNIFIED_ECONOMY_DEFAULT_REPAIR_FEE_BASIS_POINTS = 1_000n;
export const UNIFIED_ECONOMY_MIN_PRICE_MULTIPLIER_BASIS_POINTS = 3_000n;
export const UNIFIED_ECONOMY_MAX_PRICE_MULTIPLIER_BASIS_POINTS = 25_000n;
export const UNIFIED_ECONOMY_DEFAULT_BUY_SPREAD_BASIS_POINTS = 1_200n;
export const UNIFIED_ECONOMY_DEFAULT_SELL_SPREAD_BASIS_POINTS = 1_500n;
export const UNIFIED_ECONOMY_DURABILITY_LOSS_FLOOR = 1;
export const UNIFIED_ECONOMY_MINIMUM_QUALITY = 1;
export const UNIFIED_ECONOMY_MAXIMUM_QUALITY = 100;
export const UNIFIED_ECONOMY_BASE_WASTE_BASIS_POINTS = 800n;
export const UNIFIED_ECONOMY_MIN_WASTE_BASIS_POINTS = 100n;
export const UNIFIED_ECONOMY_MAX_WASTE_BASIS_POINTS = 4_500n;
export const UNIFIED_ECONOMY_DEFAULT_FEE_ACCOUNT_REF = "market:fee_account" as const;

const DECIMAL_INTEGER = /^-?(0|[1-9]\d*)$/;

export type EconomyMinorUnitString = `${bigint}`;
export type EconomyResourceClass =
  | "currency"
  | "world_good"
  | "material"
  | "unique_item"
  | "labor_time"
  | "facility_capacity"
  | "energy";
export type EconomySourceType =
  | "production"
  | "harvest_or_extraction"
  | "transfer"
  | "system_mint"
  | "recovery"
  | "migration"
  | "merchant_inventory"
  | "contract_inventory"
  | "faction_allocation"
  | "domain_event"
  | "legal_salvage"
  | "research_byproduct"
  | "dismantling";
export type EconomySinkType =
  | "consumption"
  | "wear"
  | "transfer"
  | "destruction"
  | "tax"
  | "freeze"
  | "market_fee"
  | "crafting"
  | "repair"
  | "spoilage"
  | "migration";
export type EconomyInventoryBucket =
  | "available"
  | "reserved"
  | "in_transit"
  | "held_in_custody"
  | "equipped"
  | "leased"
  | "seized"
  | "damaged"
  | "consumed"
  | "destroyed";
export type EconomyOperation = "purchase" | "sell" | "craft" | "repair";
export type EconomyCraftDiscipline = "forging" | "tailoring";
export type EconomyProvenanceChannel =
  | "world_production"
  | "harvest_or_extraction"
  | "contract_inventory"
  | "merchant_inventory"
  | "dismantling"
  | "research_byproduct"
  | "faction_allocation"
  | "domain_event"
  | "legal_salvage"
  | "black_market"
  | "sect_market"
  | "academy_market"
  | "temple_market";

export type UnifiedEconomyErrorCode =
  | "ECONOMY_INVALID_MINOR_UNIT"
  | "ECONOMY_INVALID_QUANTITY"
  | "ECONOMY_UNKNOWN_RESOURCE"
  | "ECONOMY_UNKNOWN_ACCOUNT"
  | "ECONOMY_UNKNOWN_OFFER"
  | "ECONOMY_UNKNOWN_ITEM"
  | "ECONOMY_UNKNOWN_RECIPE"
  | "ECONOMY_ILLEGAL_RECIPE"
  | "ECONOMY_DUPLICATE_MATERIAL"
  | "ECONOMY_MATERIAL_PROVENANCE_REQUIRED"
  | "ECONOMY_INSUFFICIENT_BALANCE"
  | "ECONOMY_NEGATIVE_BALANCE"
  | "ECONOMY_CAPACITY_EXCEEDED"
  | "ECONOMY_OFFER_OUT_OF_STOCK"
  | "ECONOMY_PRICE_OUT_OF_BOUNDS"
  | "ECONOMY_ARBITRAGE_GUARD"
  | "ECONOMY_REPUTATION_REQUIRED"
  | "ECONOMY_DURABILITY_INVALID"
  | "ECONOMY_ITEM_NOT_REPAIRABLE"
  | "ECONOMY_UNAUTHORIZED_SOURCE"
  | "ECONOMY_UNAUTHORIZED_SINK";

export interface UnifiedEconomyError {
  readonly code: UnifiedEconomyErrorCode;
  readonly message: string;
  readonly field?: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export type UnifiedEconomyResult<T> =
  | { readonly ok: true; readonly value: T; readonly warnings: readonly UnifiedEconomyError[] }
  | { readonly ok: false; readonly errors: readonly UnifiedEconomyError[]; readonly warnings: readonly UnifiedEconomyError[] };

export interface EconomyResourceDefinition {
  readonly resourceKey: string;
  readonly resourceClass: EconomyResourceClass;
  readonly unit: string;
  readonly basePriceMinor?: EconomyMinorUnitString;
  readonly priceFloorMinor?: EconomyMinorUnitString;
  readonly priceCeilingMinor?: EconomyMinorUnitString;
  readonly tradable: boolean;
  readonly conserved: boolean;
  readonly capacityWeightMinor?: EconomyMinorUnitString;
  readonly allowedSourceTypes: readonly EconomySourceType[];
  readonly allowedSinkTypes: readonly EconomySinkType[];
}

export interface EconomyResourceDelta {
  readonly accountRef: string;
  readonly resourceKey: string;
  readonly resourceClass: EconomyResourceClass;
  readonly unit: string;
  readonly bucket: EconomyInventoryBucket;
  readonly quantityMinor: EconomyMinorUnitString;
  readonly sourceType?: EconomySourceType;
  readonly sinkType?: EconomySinkType;
  readonly sourceRef?: string;
  readonly sinkRef?: string;
}

export interface EconomyInventoryBalance {
  readonly resourceKey: string;
  readonly bucket: EconomyInventoryBucket;
  readonly quantityMinor: EconomyMinorUnitString;
}

export interface EconomyAccountState {
  readonly accountRef: string;
  readonly ownerRef: string;
  readonly balances: readonly EconomyInventoryBalance[];
  readonly capacityMinor?: EconomyMinorUnitString;
  readonly creditLimits?: Readonly<Record<string, EconomyMinorUnitString | undefined>>;
}

export interface EconomyDurabilityState {
  readonly current: number;
  readonly max: number;
}

export interface EconomyUniqueItemState {
  readonly itemRef: string;
  readonly itemKey: string;
  readonly titleOwnerRef: string;
  readonly possessionAccountRef: string;
  readonly bucket: EconomyInventoryBucket;
  readonly quality: number;
  readonly durability: EconomyDurabilityState;
  readonly repairable: boolean;
  readonly materialRefs: readonly string[];
  readonly provenanceRefs: readonly string[];
}

export interface EconomyMarketPressure {
  readonly supplyIndex: number;
  readonly demandIndex: number;
  readonly worldPressure: number;
  readonly reputation: number;
}

export interface EconomyPriceQuote {
  readonly resourceKey: string;
  readonly unitPriceMinor: EconomyMinorUnitString;
  readonly quantityMinor: EconomyMinorUnitString;
  readonly grossMinor: EconomyMinorUnitString;
  readonly feeMinor: EconomyMinorUnitString;
  readonly totalMinor: EconomyMinorUnitString;
  readonly multiplierBasisPoints: `${bigint}`;
  readonly spreadBasisPoints: `${bigint}`;
  readonly feeBasisPoints: `${bigint}`;
  readonly hardFloorMinor: EconomyMinorUnitString;
  readonly hardCeilingMinor: EconomyMinorUnitString;
}

export interface EconomyShopOffer {
  readonly offerId: string;
  readonly merchantAccountRef: string;
  readonly itemKey?: string;
  readonly resourceKey?: string;
  readonly quantityMinor: EconomyMinorUnitString;
  readonly priceResourceKey: string;
  readonly baseUnitPriceMinor: EconomyMinorUnitString;
  readonly priceFloorMinor?: EconomyMinorUnitString;
  readonly priceCeilingMinor?: EconomyMinorUnitString;
  readonly requiredReputation?: number;
  readonly replenishmentSourceRef?: string;
  readonly sourceType?: EconomySourceType;
}

export interface EconomyMaterialRequirement {
  readonly resourceKey: string;
  readonly quantityMinor: EconomyMinorUnitString;
  readonly allowedProvenanceChannels: readonly EconomyProvenanceChannel[];
  readonly allowSubstitution?: boolean;
}

export interface EconomyMaterialInput {
  readonly materialRef: string;
  readonly resourceKey: string;
  readonly accountRef: string;
  readonly quantityMinor: EconomyMinorUnitString;
  readonly quality: number;
  readonly provenanceChannel: EconomyProvenanceChannel;
  readonly sourceEventIds: readonly string[];
}

export interface EconomyCraftRecipe {
  readonly recipeId: string;
  readonly discipline: EconomyCraftDiscipline;
  readonly outputItemKey: string;
  readonly outputResourceKey?: string;
  readonly outputQuantityMinor: EconomyMinorUnitString;
  readonly requiredMaterials: readonly EconomyMaterialRequirement[];
  readonly laborWorldMinutes: number;
  readonly facilityCapacityMinor: EconomyMinorUnitString;
  readonly energyResourceKey?: string;
  readonly energyQuantityMinor?: EconomyMinorUnitString;
  readonly minimumSkill: number;
  readonly baseFailureBasisPoints: `${bigint}`;
  readonly byproductResourceKey?: string;
  readonly byproductQuantityMinor?: EconomyMinorUnitString;
  readonly repairDurabilityGain?: number;
}

export interface EconomySkillMaterialChannel {
  readonly materialKey: string;
  readonly purpose: "skill_advancement" | "cultivation";
  readonly primaryChannel: EconomyProvenanceChannel;
  readonly secondaryChannels: readonly EconomyProvenanceChannel[];
  readonly requiresSourceEventIds: boolean;
}

export interface UnifiedEconomyState {
  readonly accounts: Readonly<Record<string, EconomyAccountState | undefined>>;
  readonly resources: Readonly<Record<string, EconomyResourceDefinition | undefined>>;
  readonly shopOffers?: Readonly<Record<string, EconomyShopOffer | undefined>>;
  readonly recipes?: Readonly<Record<string, EconomyCraftRecipe | undefined>>;
  readonly items?: Readonly<Record<string, EconomyUniqueItemState | undefined>>;
}

export interface EconomyActionContext {
  readonly actionId: string;
  readonly actor: CausalActorRef;
  readonly occurredAtWorldMinute: number;
  readonly sourceEventIds: readonly string[];
  readonly authorizationRefs: readonly string[];
}

export interface EconomyEffectProposal {
  readonly rulesetVersion: typeof UNIFIED_ECONOMY_RULESET_VERSION;
  readonly operation: EconomyOperation;
  readonly actionId: string;
  readonly effects: readonly CausalEffectV1[];
  readonly deltas: readonly EconomyResourceDelta[];
  readonly quote?: EconomyPriceQuote;
  readonly createdItem?: EconomyUniqueItemState;
  readonly quality?: number;
  readonly failure?: boolean;
}

export interface EconomyPurchaseInput {
  readonly context: EconomyActionContext;
  readonly buyerAccountRef: string;
  readonly offerId: string;
  readonly quantityMinor?: EconomyMinorUnitString;
  readonly marketPressure?: EconomyMarketPressure;
  readonly feeAccountRef?: string;
}

export interface EconomySellInput {
  readonly context: EconomyActionContext;
  readonly sellerAccountRef: string;
  readonly merchantAccountRef: string;
  readonly resourceKey: string;
  readonly quantityMinor: EconomyMinorUnitString;
  readonly priceResourceKey: string;
  readonly marketPressure?: EconomyMarketPressure;
  readonly feeAccountRef?: string;
}

export interface EconomyCraftInput {
  readonly context: EconomyActionContext;
  readonly crafterAccountRef: string;
  readonly recipeId: string;
  readonly materialInputs: readonly EconomyMaterialInput[];
  readonly crafterSkill: number;
  readonly workstationQuality: number;
  readonly processControl: number;
  readonly outputItemRef?: string;
  readonly seed?: string;
}

export interface EconomyRepairInput {
  readonly context: EconomyActionContext;
  readonly repairerAccountRef: string;
  readonly payerAccountRef: string;
  readonly itemRef: string;
  readonly recipeId: string;
  readonly materialInputs: readonly EconomyMaterialInput[];
  readonly repairerSkill: number;
  readonly workstationQuality: number;
  readonly processControl: number;
}

export const ECONOMY_INVENTORY_BUCKETS: readonly EconomyInventoryBucket[] = [
  "available",
  "reserved",
  "in_transit",
  "held_in_custody",
  "equipped",
  "leased",
  "seized",
  "damaged",
  "consumed",
  "destroyed",
];

export const DEFAULT_ECONOMY_RESOURCES: Readonly<Record<string, EconomyResourceDefinition | undefined>> = {
  coin: {
    resourceKey: "coin",
    resourceClass: "currency",
    unit: "minor_coin",
    basePriceMinor: "1",
    priceFloorMinor: "1",
    priceCeilingMinor: "1",
    tradable: true,
    conserved: true,
    allowedSourceTypes: ["transfer", "system_mint", "recovery", "migration"],
    allowedSinkTypes: ["transfer", "tax", "freeze", "market_fee", "destruction", "migration"],
  },
  iron_alloy: material("iron_alloy", "8", ["production", "merchant_inventory", "dismantling"]),
  carbon_flux: material("carbon_flux", "4", ["production", "merchant_inventory", "legal_salvage"]),
  hardwood: material("hardwood", "6", ["production", "merchant_inventory", "legal_salvage"]),
  fuel_coke: material("fuel_coke", "10", ["production", "merchant_inventory", "contract_inventory"]),
  leather: material("leather", "8", ["production", "merchant_inventory", "legal_salvage"]),
  woven_cloth: material("woven_cloth", "6", ["production", "merchant_inventory", "contract_inventory"]),
  standard_thread: material("standard_thread", "2", ["production", "merchant_inventory", "contract_inventory"]),
  reinforced_thread: material("reinforced_thread", "18", ["production", "merchant_inventory", "contract_inventory"]),
  resonant_alloy: material("resonant_alloy", "72", ["production", "faction_allocation", "dismantling"]),
  domain_alloy: material("domain_alloy", "720", ["domain_event", "dismantling", "contract_inventory"]),
  aether_fiber: material("aether_fiber", "65", ["production", "faction_allocation", "dismantling"]),
  resonant_thread: material("resonant_thread", "180", ["production", "contract_inventory", "dismantling"]),
  domain_silk: material("domain_silk", "680", ["harvest_or_extraction", "faction_allocation", "domain_event"]),
  spirit_grain: material("spirit_grain", "16", ["production", "merchant_inventory", "contract_inventory"]),
  meridian_salve: material("meridian_salve", "24", ["production", "merchant_inventory", "contract_inventory"]),
  foundation_dew: material("foundation_dew", "70", ["production", "harvest_or_extraction", "faction_allocation"]),
  formation_core: material("formation_core", "210", ["production", "contract_inventory", "dismantling"]),
  domain_jade: material("domain_jade", "820", ["harvest_or_extraction", "faction_allocation", "domain_event"]),
  tribulation_conductor: material("tribulation_conductor", "0", ["domain_event"]),
};

export const DEFAULT_SKILL_AND_CULTIVATION_CHANNELS: readonly EconomySkillMaterialChannel[] = [
  channel("spirit_grain", "cultivation", "sect_market", ["contract_inventory", "merchant_inventory"]),
  channel("meridian_salve", "cultivation", "merchant_inventory", ["sect_market", "contract_inventory"]),
  channel("foundation_dew", "cultivation", "harvest_or_extraction", ["domain_event", "faction_allocation"]),
  channel("formation_core", "skill_advancement", "contract_inventory", ["dismantling", "faction_allocation"]),
  channel("domain_jade", "cultivation", "domain_event", ["faction_allocation", "harvest_or_extraction"]),
  channel("tribulation_conductor", "cultivation", "domain_event", []),
  channel("resonant_alloy", "skill_advancement", "dismantling", ["faction_allocation", "contract_inventory"]),
  channel("resonant_thread", "skill_advancement", "contract_inventory", ["dismantling", "merchant_inventory"]),
];

export const DEFAULT_ECONOMY_RECIPES: Readonly<Record<string, EconomyCraftRecipe | undefined>> = {
  forge_field_blade: {
    recipeId: "forge_field_blade",
    discipline: "forging",
    outputItemKey: "crafted:field-blade",
    outputQuantityMinor: "1",
    requiredMaterials: [
      requirement("iron_alloy", "3", ["merchant_inventory", "contract_inventory", "dismantling"]),
      requirement("carbon_flux", "1", ["merchant_inventory", "legal_salvage", "contract_inventory"]),
      requirement("fuel_coke", "1", ["merchant_inventory", "contract_inventory"]),
    ],
    laborWorldMinutes: 180,
    facilityCapacityMinor: "180",
    energyResourceKey: "fuel_coke",
    energyQuantityMinor: "1",
    minimumSkill: 20,
    baseFailureBasisPoints: "800",
    byproductResourceKey: "scrap_metal",
    byproductQuantityMinor: "1",
  },
  forge_resonant_guard: {
    recipeId: "forge_resonant_guard",
    discipline: "forging",
    outputItemKey: "crafted:resonant-guard",
    outputQuantityMinor: "1",
    requiredMaterials: [
      requirement("resonant_alloy", "2", ["faction_allocation", "dismantling", "contract_inventory"]),
      requirement("hardwood", "1", ["merchant_inventory", "legal_salvage", "contract_inventory"]),
      requirement("formation_core", "1", ["contract_inventory", "dismantling", "faction_allocation"]),
    ],
    laborWorldMinutes: 480,
    facilityCapacityMinor: "480",
    minimumSkill: 55,
    baseFailureBasisPoints: "1400",
    byproductResourceKey: "scrap_metal",
    byproductQuantityMinor: "1",
  },
  sew_travel_cloak: {
    recipeId: "sew_travel_cloak",
    discipline: "tailoring",
    outputItemKey: "crafted:travel-cloak",
    outputQuantityMinor: "1",
    requiredMaterials: [
      requirement("woven_cloth", "4", ["merchant_inventory", "contract_inventory", "dismantling"]),
      requirement("standard_thread", "2", ["merchant_inventory", "contract_inventory"]),
      requirement("leather", "1", ["merchant_inventory", "legal_salvage", "dismantling"]),
    ],
    laborWorldMinutes: 150,
    facilityCapacityMinor: "150",
    minimumSkill: 15,
    baseFailureBasisPoints: "700",
    byproductResourceKey: "cloth_scrap",
    byproductQuantityMinor: "1",
  },
  sew_aether_sash: {
    recipeId: "sew_aether_sash",
    discipline: "tailoring",
    outputItemKey: "crafted:aether-sash",
    outputQuantityMinor: "1",
    requiredMaterials: [
      requirement("aether_fiber", "2", ["faction_allocation", "dismantling", "contract_inventory"]),
      requirement("reinforced_thread", "3", ["merchant_inventory", "contract_inventory"]),
      requirement("resonant_thread", "1", ["contract_inventory", "dismantling", "faction_allocation"]),
    ],
    laborWorldMinutes: 420,
    facilityCapacityMinor: "420",
    minimumSkill: 50,
    baseFailureBasisPoints: "1200",
    byproductResourceKey: "cloth_scrap",
    byproductQuantityMinor: "1",
  },
  repair_metalwork: {
    recipeId: "repair_metalwork",
    discipline: "forging",
    outputItemKey: "repair:metalwork",
    outputQuantityMinor: "0",
    requiredMaterials: [
      requirement("iron_alloy", "1", ["merchant_inventory", "contract_inventory", "dismantling"]),
      requirement("carbon_flux", "1", ["merchant_inventory", "legal_salvage", "contract_inventory"]),
    ],
    laborWorldMinutes: 90,
    facilityCapacityMinor: "90",
    minimumSkill: 15,
    baseFailureBasisPoints: "500",
    repairDurabilityGain: 35,
  },
  repair_textile: {
    recipeId: "repair_textile",
    discipline: "tailoring",
    outputItemKey: "repair:textile",
    outputQuantityMinor: "0",
    requiredMaterials: [
      requirement("woven_cloth", "1", ["merchant_inventory", "contract_inventory", "dismantling"]),
      requirement("standard_thread", "2", ["merchant_inventory", "contract_inventory"]),
    ],
    laborWorldMinutes: 75,
    facilityCapacityMinor: "75",
    minimumSkill: 12,
    baseFailureBasisPoints: "500",
    repairDurabilityGain: 30,
  },
};

export function parseEconomyMinorUnit(value: string): bigint | undefined {
  if (!DECIMAL_INTEGER.test(value)) return undefined;
  return BigInt(value);
}

export function economyMinorUnit(value: bigint): EconomyMinorUnitString {
  return value.toString() as EconomyMinorUnitString;
}

export function compareEconomyMinorUnits(left: EconomyMinorUnitString, right: EconomyMinorUnitString): -1 | 0 | 1 {
  const leftValue = BigInt(left);
  const rightValue = BigInt(right);
  return leftValue < rightValue ? -1 : leftValue > rightValue ? 1 : 0;
}

export function quoteEconomyPrice(
  resource: EconomyResourceDefinition,
  quantityMinor: EconomyMinorUnitString,
  side: "buy" | "sell",
  pressure: EconomyMarketPressure = { supplyIndex: 50, demandIndex: 50, worldPressure: 0, reputation: 50 },
  feeBasisPoints: bigint = UNIFIED_ECONOMY_DEFAULT_FEE_BASIS_POINTS,
): UnifiedEconomyResult<EconomyPriceQuote> {
  const quantity = parseEconomyMinorUnit(quantityMinor);
  const basePrice = parseEconomyMinorUnit(resource.basePriceMinor || "0");
  if (quantity === undefined) return fail("ECONOMY_INVALID_MINOR_UNIT", "quantityMinor must be an integer string", "quantityMinor");
  if (basePrice === undefined) return fail("ECONOMY_INVALID_MINOR_UNIT", "basePriceMinor must be an integer string", "basePriceMinor");
  if (quantity <= 0n || basePrice <= 0n) {
    return fail("ECONOMY_INVALID_QUANTITY", "quantity and base price must be positive", "quantityMinor");
  }

  const multiplier = dynamicPriceMultiplierBasisPoints(pressure);
  const spread = side === "buy" ? UNIFIED_ECONOMY_DEFAULT_BUY_SPREAD_BASIS_POINTS : -UNIFIED_ECONOMY_DEFAULT_SELL_SPREAD_BASIS_POINTS;
  const withSpread = clampBigInt(
    multiplier + spread,
    UNIFIED_ECONOMY_MIN_PRICE_MULTIPLIER_BASIS_POINTS,
    UNIFIED_ECONOMY_MAX_PRICE_MULTIPLIER_BASIS_POINTS,
  );
  const rawUnitPrice = divRoundUp(basePrice * withSpread, UNIFIED_ECONOMY_PRICE_BASIS_POINTS);
  const floor = parseEconomyMinorUnit(resource.priceFloorMinor || "1");
  const ceiling = parseEconomyMinorUnit(resource.priceCeilingMinor || (basePrice * 25n).toString());
  if (floor === undefined) return fail("ECONOMY_INVALID_MINOR_UNIT", "priceFloorMinor must be an integer string", "priceFloorMinor");
  if (ceiling === undefined) return fail("ECONOMY_INVALID_MINOR_UNIT", "priceCeilingMinor must be an integer string", "priceCeilingMinor");
  const unitPrice = clampBigInt(rawUnitPrice, floor, ceiling);
  const gross = unitPrice * quantity;
  const fee = divRoundUp(gross * feeBasisPoints, UNIFIED_ECONOMY_PRICE_BASIS_POINTS);
  const total = side === "buy" ? gross + fee : gross - fee;
  if (side === "sell" && total <= 0n) {
    return fail("ECONOMY_ARBITRAGE_GUARD", "sell proceeds must stay positive after fee", "feeBasisPoints");
  }
  return ok({
    resourceKey: resource.resourceKey,
    unitPriceMinor: economyMinorUnit(unitPrice),
    quantityMinor,
    grossMinor: economyMinorUnit(gross),
    feeMinor: economyMinorUnit(fee),
    totalMinor: economyMinorUnit(total),
    multiplierBasisPoints: economyMinorUnit(multiplier),
    spreadBasisPoints: economyMinorUnit(spread),
    feeBasisPoints: economyMinorUnit(feeBasisPoints),
    hardFloorMinor: economyMinorUnit(floor),
    hardCeilingMinor: economyMinorUnit(ceiling),
  });
}

export function proposeEconomyPurchase(
  state: UnifiedEconomyState,
  input: EconomyPurchaseInput,
): UnifiedEconomyResult<EconomyEffectProposal> {
  const offer = state.shopOffers?.[input.offerId];
  if (!offer) return fail("ECONOMY_UNKNOWN_OFFER", "shop offer does not exist", "offerId");
  const buyer = state.accounts[input.buyerAccountRef];
  const merchant = state.accounts[offer.merchantAccountRef];
  if (!buyer) return fail("ECONOMY_UNKNOWN_ACCOUNT", "buyer account does not exist", "buyerAccountRef");
  if (!merchant) return fail("ECONOMY_UNKNOWN_ACCOUNT", "merchant account does not exist", "merchantAccountRef");

  const soldResourceKey = offer.resourceKey || offer.itemKey;
  if (!soldResourceKey) return fail("ECONOMY_UNKNOWN_RESOURCE", "offer has no item or resource key", "offerId");
  const soldResource = state.resources[soldResourceKey] || DEFAULT_ECONOMY_RESOURCES[soldResourceKey] || (offer.itemKey ? itemResource(offer.itemKey, offer.baseUnitPriceMinor) : undefined);
  const priceResource = state.resources[offer.priceResourceKey] || DEFAULT_ECONOMY_RESOURCES[offer.priceResourceKey];
  if (!soldResource) return fail("ECONOMY_UNKNOWN_RESOURCE", "offered resource is unknown", "resourceKey");
  if (!priceResource) return fail("ECONOMY_UNKNOWN_RESOURCE", "price resource is unknown", "priceResourceKey");
  if (offer.requiredReputation !== undefined && (input.marketPressure?.reputation || 0) < offer.requiredReputation) {
    return fail("ECONOMY_REPUTATION_REQUIRED", "buyer reputation is below offer requirement", "requiredReputation");
  }

  const quantityMinor = input.quantityMinor || offer.quantityMinor;
  const quoteResource: EconomyResourceDefinition = {
    ...priceResource,
    basePriceMinor: offer.baseUnitPriceMinor,
    priceFloorMinor: offer.priceFloorMinor || priceResource.priceFloorMinor,
    priceCeilingMinor: offer.priceCeilingMinor || priceResource.priceCeilingMinor,
  };
  const quote = quoteEconomyPrice(quoteResource, quantityMinor, "buy", input.marketPressure);
  if (!quote.ok) return quote;

  const stockAvailable = accountBalance(merchant, soldResourceKey, "available") >= BigInt(quantityMinor);
  if (!stockAvailable) return fail("ECONOMY_OFFER_OUT_OF_STOCK", "merchant available inventory cannot fill offer", "offerId");

  const deltas: EconomyResourceDelta[] = [
    delta(input.buyerAccountRef, offer.priceResourceKey, priceResource, "available", economyMinorUnit(-BigInt(quote.value.grossMinor)), undefined, "transfer", undefined, undefined),
    delta(offer.merchantAccountRef, offer.priceResourceKey, priceResource, "available", quote.value.grossMinor, "transfer", undefined, undefined, undefined),
  ];
  if (BigInt(quote.value.feeMinor) > 0n) {
    deltas.push(
      delta(input.buyerAccountRef, offer.priceResourceKey, priceResource, "available", economyMinorUnit(-BigInt(quote.value.feeMinor)), undefined, "transfer", undefined, undefined),
      delta(input.feeAccountRef || UNIFIED_ECONOMY_DEFAULT_FEE_ACCOUNT_REF, offer.priceResourceKey, priceResource, "available", quote.value.feeMinor, "transfer", undefined, undefined, undefined),
    );
  }
  deltas.push(
    delta(offer.merchantAccountRef, soldResourceKey, soldResource, "available", economyMinorUnit(-BigInt(quantityMinor)), undefined, "transfer", undefined, undefined),
    delta(input.buyerAccountRef, soldResourceKey, soldResource, "available", quantityMinor, "transfer", undefined, undefined, undefined),
  );

  const validation = validateDeltas(state, deltas);
  if (!validation.ok) return validation;
  return ok(proposal("purchase", input.context, deltas, quote.value));
}

export function proposeEconomySale(
  state: UnifiedEconomyState,
  input: EconomySellInput,
): UnifiedEconomyResult<EconomyEffectProposal> {
  const seller = state.accounts[input.sellerAccountRef];
  const merchant = state.accounts[input.merchantAccountRef];
  if (!seller) return fail("ECONOMY_UNKNOWN_ACCOUNT", "seller account does not exist", "sellerAccountRef");
  if (!merchant) return fail("ECONOMY_UNKNOWN_ACCOUNT", "merchant account does not exist", "merchantAccountRef");
  const resource = state.resources[input.resourceKey] || DEFAULT_ECONOMY_RESOURCES[input.resourceKey];
  const priceResource = state.resources[input.priceResourceKey] || DEFAULT_ECONOMY_RESOURCES[input.priceResourceKey];
  if (!resource) return fail("ECONOMY_UNKNOWN_RESOURCE", "sold resource is unknown", "resourceKey");
  if (!priceResource) return fail("ECONOMY_UNKNOWN_RESOURCE", "price resource is unknown", "priceResourceKey");
  const quote = quoteEconomyPrice(resource, input.quantityMinor, "sell", input.marketPressure);
  if (!quote.ok) return quote;
  const deltas: EconomyResourceDelta[] = [
    delta(input.sellerAccountRef, input.resourceKey, resource, "available", economyMinorUnit(-BigInt(input.quantityMinor)), undefined, "transfer", undefined, undefined),
    delta(input.merchantAccountRef, input.resourceKey, resource, "available", input.quantityMinor, "transfer", undefined, undefined, undefined),
    delta(input.merchantAccountRef, input.priceResourceKey, priceResource, "available", economyMinorUnit(-BigInt(quote.value.grossMinor)), undefined, "transfer", undefined, undefined),
    delta(input.sellerAccountRef, input.priceResourceKey, priceResource, "available", quote.value.totalMinor, "transfer", undefined, undefined, undefined),
  ];
  if (BigInt(quote.value.feeMinor) > 0n) {
    deltas.push(delta(input.feeAccountRef || UNIFIED_ECONOMY_DEFAULT_FEE_ACCOUNT_REF, input.priceResourceKey, priceResource, "available", quote.value.feeMinor, "transfer", undefined, undefined, undefined));
  }
  const validation = validateDeltas(state, deltas);
  if (!validation.ok) return validation;
  return ok(proposal("sell", input.context, deltas, quote.value));
}

export function proposeEconomyCraft(
  state: UnifiedEconomyState,
  input: EconomyCraftInput,
): UnifiedEconomyResult<EconomyEffectProposal> {
  const recipe = state.recipes?.[input.recipeId] || DEFAULT_ECONOMY_RECIPES[input.recipeId];
  if (!recipe) return fail("ECONOMY_UNKNOWN_RECIPE", "recipe does not exist", "recipeId");
  if (recipe.repairDurabilityGain !== undefined) return fail("ECONOMY_ILLEGAL_RECIPE", "repair recipe cannot be used for crafting", "recipeId");
  const materials = validateMaterialInputs(state, recipe, input.materialInputs);
  if (!materials.ok) return materials;
  if (input.crafterSkill < recipe.minimumSkill) return fail("ECONOMY_ILLEGAL_RECIPE", "crafter skill is below recipe minimum", "crafterSkill");

  const deltas = materialConsumptionDeltas(
    state,
    input.materialInputs,
    input.crafterAccountRef,
    CAUSAL_RESOURCE_SINK_REFS.recipeVerifiedTransform,
  );
  const quality = computeCraftQuality(input.materialInputs, input.crafterSkill, input.workstationQuality, input.processControl);
  const failure = deterministicFailure(input.seed || input.context.actionId, recipe.baseFailureBasisPoints, input.crafterSkill, recipe.minimumSkill);
  const outputResource = recipe.outputResourceKey ? state.resources[recipe.outputResourceKey] || DEFAULT_ECONOMY_RESOURCES[recipe.outputResourceKey] : undefined;
  let createdItem: EconomyUniqueItemState | undefined;
  if (failure) {
    addByproductDelta(state, deltas, input.crafterAccountRef, recipe, "research_byproduct");
  } else if (outputResource) {
    deltas.push(delta(input.crafterAccountRef, outputResource.resourceKey, outputResource, "available", recipe.outputQuantityMinor, "production", undefined, CAUSAL_RESOURCE_SOURCE_REFS.recipeVerifiedTransform, undefined));
  } else {
    createdItem = {
      itemRef: input.outputItemRef || `item:${input.context.actionId}`,
      itemKey: recipe.outputItemKey,
      titleOwnerRef: accountOwnerRef(state, input.crafterAccountRef),
      possessionAccountRef: input.crafterAccountRef,
      bucket: "available",
      quality,
      durability: { current: 100, max: 100 },
      repairable: true,
      materialRefs: input.materialInputs.map((material) => material.materialRef).sort(),
      provenanceRefs: input.materialInputs.flatMap((material) => material.sourceEventIds).sort(),
    };
  }
  const validation = validateDeltas(state, deltas);
  if (!validation.ok) return validation;
  const base = proposal("craft", input.context, deltas);
  const effects = createdItem ? [...base.effects, ...createdItemEffects(input.context, createdItem)] : base.effects;
  return ok({ ...base, effects, createdItem, quality, failure });
}

export function proposeEconomyRepair(
  state: UnifiedEconomyState,
  input: EconomyRepairInput,
): UnifiedEconomyResult<EconomyEffectProposal> {
  const item = state.items?.[input.itemRef];
  if (!item) return fail("ECONOMY_UNKNOWN_ITEM", "item does not exist", "itemRef");
  if (!item.repairable) return fail("ECONOMY_ITEM_NOT_REPAIRABLE", "item is not repairable", "itemRef");
  if (item.durability.current < 0 || item.durability.current > item.durability.max || item.durability.max <= 0) {
    return fail("ECONOMY_DURABILITY_INVALID", "item durability is invalid", "itemRef");
  }
  const recipe = state.recipes?.[input.recipeId] || DEFAULT_ECONOMY_RECIPES[input.recipeId];
  if (!recipe || recipe.repairDurabilityGain === undefined) return fail("ECONOMY_UNKNOWN_RECIPE", "repair recipe does not exist", "recipeId");
  const materials = validateMaterialInputs(state, recipe, input.materialInputs);
  if (!materials.ok) return materials;
  if (input.repairerSkill < recipe.minimumSkill) return fail("ECONOMY_ILLEGAL_RECIPE", "repairer skill is below recipe minimum", "repairerSkill");
  const deltas = materialConsumptionDeltas(
    state,
    input.materialInputs,
    input.repairerAccountRef,
    CAUSAL_RESOURCE_SINK_REFS.repairMaterial,
  );
  const validation = validateDeltas(state, deltas);
  if (!validation.ok) return validation;

  const repairQuality = computeCraftQuality(input.materialInputs, input.repairerSkill, input.workstationQuality, input.processControl);
  const failure = deterministicFailure(`${input.context.actionId}:repair`, recipe.baseFailureBasisPoints, input.repairerSkill, recipe.minimumSkill);
  const gain = failure ? UNIFIED_ECONOMY_DURABILITY_LOSS_FLOOR * -1 : Math.max(UNIFIED_ECONOMY_DURABILITY_LOSS_FLOOR, Math.floor(recipe.repairDurabilityGain * repairQuality / 100));
  const repairedDurability = clampNumber(item.durability.current + gain, 0, item.durability.max);
  const base = proposal("repair", input.context, deltas);
  const effects: CausalEffectV1[] = [
    ...base.effects,
    {
      effectId: `${input.context.actionId}:item:repair:${input.itemRef}`,
      effectType: "unique_item_lifecycle",
      targetRef: entityRef("unique_item", input.itemRef),
      operation: "repair_durability",
      after: {
        itemId: input.itemRef,
        itemType: item.itemKey,
        fromState: item.durability.current < item.durability.max ? "damaged" : "active",
        toState: repairedDurability < item.durability.max ? "damaged" : "repaired",
        titleOwnerRef: item.titleOwnerRef,
        sourceMechanismRef: `recipe:${recipe.recipeId}`,
      },
      sourceEventIds: input.context.sourceEventIds,
      authorizationRefs: input.context.authorizationRefs,
    } satisfies UniqueItemLifecycleEffectV1,
    stateEffect(input.context, "durability", input.itemRef, String(item.durability.current), String(repairedDurability), failure ? "repair_failed_wear" : "repair_completed"),
  ];
  return ok({ ...base, effects, quality: repairQuality, failure });
}

export function validateDeltas(
  state: Pick<UnifiedEconomyState, "accounts" | "resources">,
  deltas: readonly EconomyResourceDelta[],
): UnifiedEconomyResult<readonly EconomyResourceDelta[]> {
  const errors: UnifiedEconomyError[] = [];
  const accountTotals = new Map<string, bigint>();
  for (const entry of deltas) {
    const quantity = parseEconomyMinorUnit(entry.quantityMinor);
    const resource = state.resources[entry.resourceKey] || DEFAULT_ECONOMY_RESOURCES[entry.resourceKey];
    const account = state.accounts[entry.accountRef];
    if (quantity === undefined) errors.push(error("ECONOMY_INVALID_MINOR_UNIT", "quantityMinor must be an integer string", "quantityMinor"));
    if (!resource) errors.push(error("ECONOMY_UNKNOWN_RESOURCE", "resource is not registered", "resourceKey", { resourceKey: entry.resourceKey }));
    if (!account) errors.push(error("ECONOMY_UNKNOWN_ACCOUNT", "account is not registered", "accountRef", { accountRef: entry.accountRef }));
    if (resource && entry.sourceType && entry.sourceType !== "transfer" && !resource.allowedSourceTypes.includes(entry.sourceType)) {
      errors.push(error("ECONOMY_UNAUTHORIZED_SOURCE", "source type is not allowed for resource", "sourceType", { resourceKey: entry.resourceKey, sourceType: entry.sourceType }));
    }
    if (resource && entry.sinkType && entry.sinkType !== "transfer" && !resource.allowedSinkTypes.includes(entry.sinkType)) {
      errors.push(error("ECONOMY_UNAUTHORIZED_SINK", "sink type is not allowed for resource", "sinkType", { resourceKey: entry.resourceKey, sinkType: entry.sinkType }));
    }
    if (quantity !== undefined && account && quantity < 0n) {
      const after = accountBalance(account, entry.resourceKey, entry.bucket) + sumDeltaFor(deltas, entry.accountRef, entry.resourceKey, entry.bucket);
      const creditLimit = BigInt(account.creditLimits?.[entry.resourceKey] || "0");
      if (after < -creditLimit) errors.push(error("ECONOMY_NEGATIVE_BALANCE", "delta would create a negative balance", "quantityMinor", { accountRef: entry.accountRef, resourceKey: entry.resourceKey }));
    }
  }
  for (const account of Object.values(state.accounts)) {
    if (!account?.capacityMinor) continue;
    let used = accountCapacityUsed(state, account);
    for (const entry of deltas.filter((candidate) => candidate.accountRef === account.accountRef)) {
      const resource = state.resources[entry.resourceKey] || DEFAULT_ECONOMY_RESOURCES[entry.resourceKey];
      if (!resource?.capacityWeightMinor) continue;
      used += BigInt(entry.quantityMinor) * BigInt(resource.capacityWeightMinor);
    }
    if (used > BigInt(account.capacityMinor)) {
      errors.push(error("ECONOMY_CAPACITY_EXCEEDED", "account capacity would be exceeded", "capacityMinor", { accountRef: account.accountRef }));
    }
  }
  for (const entry of deltas) {
    const key = `${entry.resourceKey}:${entry.unit}`;
    const quantity = parseEconomyMinorUnit(entry.quantityMinor);
    if (quantity === undefined) continue;
    accountTotals.set(key, (accountTotals.get(key) || 0n) + quantity);
  }
  for (const [key, total] of accountTotals) {
    if (total === 0n) continue;
    const related = deltas.filter((entry) => `${entry.resourceKey}:${entry.unit}` === key);
    const hasSource = related.some((entry) => entry.sourceType && entry.sourceType !== "transfer");
    const hasSink = related.some((entry) => entry.sinkType && entry.sinkType !== "transfer");
    if (total > 0n && !hasSource) errors.push(error("ECONOMY_UNAUTHORIZED_SOURCE", "positive net resource delta requires explicit source", "sourceType", { key }));
    if (total < 0n && !hasSink) errors.push(error("ECONOMY_UNAUTHORIZED_SINK", "negative net resource delta requires explicit sink", "sinkType", { key }));
  }
  return errors.length ? { ok: false, errors, warnings: [] } : ok(deltas);
}

function dynamicPriceMultiplierBasisPoints(pressure: EconomyMarketPressure): bigint {
  const demandSupply = (clampNumber(pressure.demandIndex, 0, 100) - clampNumber(pressure.supplyIndex, 0, 100)) * 90;
  const worldPressure = clampNumber(pressure.worldPressure, 0, 100) * 45;
  const reputationDiscount = (clampNumber(pressure.reputation, 0, 100) - 50) * 25;
  return clampBigInt(
    BigInt(10_000 + demandSupply + worldPressure - reputationDiscount),
    UNIFIED_ECONOMY_MIN_PRICE_MULTIPLIER_BASIS_POINTS,
    UNIFIED_ECONOMY_MAX_PRICE_MULTIPLIER_BASIS_POINTS,
  );
}

function validateMaterialInputs(
  state: UnifiedEconomyState,
  recipe: EconomyCraftRecipe,
  inputs: readonly EconomyMaterialInput[],
): UnifiedEconomyResult<readonly EconomyMaterialInput[]> {
  const errors: UnifiedEconomyError[] = [];
  const seen = new Set<string>();
  for (const input of inputs) {
    if (seen.has(input.materialRef)) errors.push(error("ECONOMY_DUPLICATE_MATERIAL", "material input cannot be repeated", "materialRef"));
    seen.add(input.materialRef);
    if (!input.sourceEventIds.length) errors.push(error("ECONOMY_MATERIAL_PROVENANCE_REQUIRED", "material input requires source event ids", "sourceEventIds"));
    if (!state.accounts[input.accountRef]) errors.push(error("ECONOMY_UNKNOWN_ACCOUNT", "material account does not exist", "accountRef"));
    if (!(state.resources[input.resourceKey] || DEFAULT_ECONOMY_RESOURCES[input.resourceKey])) errors.push(error("ECONOMY_UNKNOWN_RESOURCE", "material resource is unknown", "resourceKey"));
  }
  for (const requirement of recipe.requiredMaterials) {
    const matching = inputs.filter((input) => input.resourceKey === requirement.resourceKey);
    const total = matching.reduce((sum, input) => sum + BigInt(input.quantityMinor), 0n);
    if (total < BigInt(requirement.quantityMinor)) {
      errors.push(error("ECONOMY_INSUFFICIENT_BALANCE", "required material quantity is missing", "materialInputs", { resourceKey: requirement.resourceKey }));
    }
    for (const input of matching) {
      if (!requirement.allowedProvenanceChannels.includes(input.provenanceChannel)) {
        errors.push(error("ECONOMY_MATERIAL_PROVENANCE_REQUIRED", "material provenance channel is not allowed by recipe", "provenanceChannel", { resourceKey: input.resourceKey }));
      }
    }
  }
  return errors.length ? { ok: false, errors, warnings: [] } : ok(inputs);
}

function materialConsumptionDeltas(
  state: UnifiedEconomyState,
  inputs: readonly EconomyMaterialInput[],
  fallbackAccountRef: string,
  sinkRef: string,
): EconomyResourceDelta[] {
  return inputs.map((input) => {
    const resource = state.resources[input.resourceKey] || DEFAULT_ECONOMY_RESOURCES[input.resourceKey] || material(input.resourceKey, "1", ["production"]);
    return delta(input.accountRef || fallbackAccountRef, input.resourceKey, resource, "available", economyMinorUnit(-BigInt(input.quantityMinor)), undefined, "crafting", undefined, sinkRef);
  });
}

function addByproductDelta(
  state: UnifiedEconomyState,
  deltas: EconomyResourceDelta[],
  accountRef: string,
  recipe: EconomyCraftRecipe,
  sourceType: EconomySourceType,
): void {
  if (!recipe.byproductResourceKey || !recipe.byproductQuantityMinor) return;
  const resource = state.resources[recipe.byproductResourceKey] || material(recipe.byproductResourceKey, "1", [sourceType]);
  deltas.push(delta(accountRef, recipe.byproductResourceKey, resource, "available", recipe.byproductQuantityMinor, sourceType, undefined, `recipe:${recipe.recipeId}:byproduct`, undefined));
}

function computeCraftQuality(inputs: readonly EconomyMaterialInput[], skill: number, workstationQuality: number, processControl: number): number {
  const totalQuantity = inputs.reduce((sum, input) => sum + BigInt(input.quantityMinor), 0n);
  const weightedInput = totalQuantity === 0n
    ? 0
    : Number(inputs.reduce((sum, input) => sum + BigInt(input.quantityMinor) * BigInt(clampNumber(input.quality, 0, 100)), 0n) / totalQuantity);
  return clampNumber(
    Math.round(0.45 * weightedInput + 0.25 * clampNumber(skill, 0, 100) + 0.15 * clampNumber(workstationQuality, 0, 100) + 0.15 * clampNumber(processControl, 0, 100)),
    UNIFIED_ECONOMY_MINIMUM_QUALITY,
    UNIFIED_ECONOMY_MAXIMUM_QUALITY,
  );
}

function deterministicFailure(seed: string, baseFailureBasisPoints: `${bigint}`, skill: number, minimumSkill: number): boolean {
  const adjusted = clampBigInt(
    BigInt(baseFailureBasisPoints) - BigInt(Math.max(0, skill - minimumSkill) * 60),
    UNIFIED_ECONOMY_MIN_WASTE_BASIS_POINTS,
    UNIFIED_ECONOMY_MAX_WASTE_BASIS_POINTS,
  );
  return BigInt(stableHash(seed) % 10_000) < adjusted;
}

function proposal(
  operation: EconomyOperation,
  context: EconomyActionContext,
  deltas: readonly EconomyResourceDelta[],
  quote?: EconomyPriceQuote,
): EconomyEffectProposal {
  return {
    rulesetVersion: UNIFIED_ECONOMY_RULESET_VERSION,
    operation,
    actionId: context.actionId,
    effects: resourceLedgerEffects(context, operation, deltas),
    deltas,
    quote,
  };
}

function resourceLedgerEffects(
  context: EconomyActionContext,
  operation: EconomyOperation,
  deltas: readonly EconomyResourceDelta[],
): readonly ResourceLedgerEffectV1[] {
  const groups = new Map<string, EconomyResourceDelta[]>();
  for (const entry of deltas) {
    const key = `${entry.resourceKey}:${entry.unit}:${entry.sourceRef || ""}:${entry.sinkRef || ""}`;
    groups.set(key, [...(groups.get(key) || []), entry]);
  }
  return Array.from(groups.values()).map((entries, index) => {
    const first = entries[0]!;
    const net = entries.reduce((sum, entry) => sum + BigInt(entry.quantityMinor), 0n);
    return {
      effectId: `${context.actionId}:resource:${index}`,
      effectType: "resource_ledger",
      targetRef: entityRef("resource", first.resourceKey),
      operation,
      after: {
        resourceKey: first.resourceKey,
        resourceClass: first.resourceClass,
        unit: first.unit,
        entries: entries.map((entry) => ({ accountRef: `${entry.accountRef}#${entry.bucket}`, quantityMinor: entry.quantityMinor })),
        ...(net > 0n ? { creationSourceRef: first.sourceRef || first.sourceType } : {}),
        ...(net < 0n ? { destructionSinkRef: first.sinkRef || first.sinkType } : {}),
      },
      sourceEventIds: context.sourceEventIds,
      authorizationRefs: context.authorizationRefs,
    };
  });
}

function createdItemEffects(context: EconomyActionContext, item: EconomyUniqueItemState): readonly CausalEffectV1[] {
  return [
    {
      effectId: `${context.actionId}:item:create`,
      effectType: "unique_item_lifecycle",
      targetRef: entityRef("unique_item", item.itemRef),
      operation: "craft_create",
      after: {
        itemId: item.itemRef,
        itemType: item.itemKey,
        toState: "created",
        titleOwnerRef: item.titleOwnerRef,
        sourceMechanismRef: `craft:${context.actionId}`,
      },
      sourceEventIds: context.sourceEventIds,
      authorizationRefs: context.authorizationRefs,
    } satisfies UniqueItemLifecycleEffectV1,
    ownershipEffect(context, item.itemRef, "title", item.titleOwnerRef),
    ownershipEffect(context, item.itemRef, "possession", item.titleOwnerRef),
  ];
}

function ownershipEffect(
  context: EconomyActionContext,
  itemRef: string,
  interestType: OwnershipInterestType,
  holderRef: string,
): CausalEffectV1 {
  return {
    effectId: `${context.actionId}:ownership:${interestType}:${itemRef}`,
    effectType: "ownership_interest",
    targetRef: entityRef("unique_item", itemRef),
    operation: "grant",
    after: {
      itemRef,
      interestType,
      holderRef,
      validFromWorldMinute: context.occurredAtWorldMinute,
      basisEventIds: context.sourceEventIds,
      priority: interestType === "title" ? 100 : 50,
      transferable: true,
      status: "granted",
    },
    sourceEventIds: context.sourceEventIds,
    authorizationRefs: context.authorizationRefs,
  };
}

function stateEffect(
  context: EconomyActionContext,
  stateMachineId: string,
  subjectId: string,
  fromState: string,
  toState: string,
  reasonCode: string,
): StateTransitionEffectV1 {
  return {
    effectId: `${context.actionId}:state:${stateMachineId}:${subjectId}`,
    effectType: "state_transition",
    targetRef: entityRef(stateMachineId, subjectId),
    operation: "transition",
    after: {
      stateMachineId,
      fromState,
      toState,
      transitionId: `${stateMachineId}:${fromState}->${toState}`,
      reasonCode,
    },
    sourceEventIds: context.sourceEventIds,
    authorizationRefs: context.authorizationRefs,
  };
}

function accountBalance(account: EconomyAccountState, resourceKey: string, bucket: EconomyInventoryBucket): bigint {
  return account.balances
    .filter((entry) => entry.resourceKey === resourceKey && entry.bucket === bucket)
    .reduce((sum, entry) => sum + BigInt(entry.quantityMinor), 0n);
}

function sumDeltaFor(deltas: readonly EconomyResourceDelta[], accountRef: string, resourceKey: string, bucket: EconomyInventoryBucket): bigint {
  return deltas
    .filter((entry) => entry.accountRef === accountRef && entry.resourceKey === resourceKey && entry.bucket === bucket)
    .reduce((sum, entry) => sum + BigInt(entry.quantityMinor), 0n);
}

function accountCapacityUsed(
  state: Pick<UnifiedEconomyState, "resources">,
  account: EconomyAccountState,
): bigint {
  return account.balances.reduce((sum, entry) => {
    if (entry.bucket !== "available" && entry.bucket !== "reserved" && entry.bucket !== "equipped") return sum;
    const resource = state.resources[entry.resourceKey] || DEFAULT_ECONOMY_RESOURCES[entry.resourceKey];
    return sum + BigInt(entry.quantityMinor) * BigInt(resource?.capacityWeightMinor || "0");
  }, 0n);
}

function accountOwnerRef(state: UnifiedEconomyState, accountRef: string): string {
  return state.accounts[accountRef]?.ownerRef || accountRef;
}

function delta(
  accountRef: string,
  resourceKey: string,
  resource: EconomyResourceDefinition,
  bucket: EconomyInventoryBucket,
  quantityMinor: EconomyMinorUnitString,
  sourceType?: EconomySourceType,
  sinkType?: EconomySinkType,
  sourceRef?: string,
  sinkRef?: string,
): EconomyResourceDelta {
  return {
    accountRef,
    resourceKey,
    resourceClass: resource.resourceClass,
    unit: resource.unit,
    bucket,
    quantityMinor,
    sourceType,
    sinkType,
    sourceRef,
    sinkRef,
  };
}

function material(resourceKey: string, basePriceMinor: EconomyMinorUnitString, allowedSourceTypes: readonly EconomySourceType[]): EconomyResourceDefinition {
  return {
    resourceKey,
    resourceClass: "material",
    unit: "minor_unit",
    basePriceMinor,
    priceFloorMinor: basePriceMinor === "0" ? "0" : economyMinorUnit(BigInt(basePriceMinor) / 3n || 1n),
    priceCeilingMinor: basePriceMinor === "0" ? "0" : economyMinorUnit(BigInt(basePriceMinor) * 25n),
    tradable: basePriceMinor !== "0",
    conserved: true,
    capacityWeightMinor: "1",
    allowedSourceTypes,
    allowedSinkTypes: ["transfer", "crafting", "repair", "wear", "destruction", "freeze"],
  };
}

function itemResource(itemKey: string, basePriceMinor: EconomyMinorUnitString): EconomyResourceDefinition {
  const parsedBasePrice = parseEconomyMinorUnit(basePriceMinor);
  const safeBasePrice = parsedBasePrice !== undefined && parsedBasePrice > 0n ? parsedBasePrice : 1n;
  return {
    resourceKey: itemKey,
    resourceClass: "unique_item",
    unit: "item",
    basePriceMinor,
    priceFloorMinor: economyMinorUnit(safeBasePrice / 3n || 1n),
    priceCeilingMinor: economyMinorUnit(safeBasePrice * 25n),
    tradable: true,
    conserved: true,
    capacityWeightMinor: "1",
    allowedSourceTypes: ["production", "merchant_inventory", "contract_inventory", "transfer"],
    allowedSinkTypes: ["transfer", "repair", "wear", "destruction", "freeze"],
  };
}

function requirement(resourceKey: string, quantityMinor: EconomyMinorUnitString, allowedProvenanceChannels: readonly EconomyProvenanceChannel[]): EconomyMaterialRequirement {
  return { resourceKey, quantityMinor, allowedProvenanceChannels };
}

function channel(
  materialKey: string,
  purpose: EconomySkillMaterialChannel["purpose"],
  primaryChannel: EconomyProvenanceChannel,
  secondaryChannels: readonly EconomyProvenanceChannel[],
): EconomySkillMaterialChannel {
  return { materialKey, purpose, primaryChannel, secondaryChannels, requiresSourceEventIds: true };
}

function entityRef(entityType: string, entityId: string): CausalEntityRef {
  return { entityType, entityId };
}

function divRoundUp(value: bigint, divisor: bigint): bigint {
  return value <= 0n ? value / divisor : (value + divisor - 1n) / divisor;
}

function clampBigInt(value: bigint, min: bigint, max: bigint): bigint {
  return value < min ? min : value > max ? max : value;
}

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.round(value)));
}

function stableHash(seed: string): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function ok<T>(value: T, warnings: readonly UnifiedEconomyError[] = []): UnifiedEconomyResult<T> {
  return { ok: true, value, warnings };
}

function fail<T = never>(
  code: UnifiedEconomyErrorCode,
  message: string,
  field?: string,
  details?: Readonly<Record<string, unknown>>,
): UnifiedEconomyResult<T> {
  return { ok: false, errors: [error(code, message, field, details)], warnings: [] };
}

function error(
  code: UnifiedEconomyErrorCode,
  message: string,
  field?: string,
  details?: Readonly<Record<string, unknown>>,
): UnifiedEconomyError {
  return { code, message, field, details };
}
