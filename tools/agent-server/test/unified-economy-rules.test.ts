import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_ECONOMY_RECIPES,
  DEFAULT_ECONOMY_RESOURCES,
  DEFAULT_SKILL_AND_CULTIVATION_CHANNELS,
  UNIFIED_ECONOMY_MIN_PRICE_MULTIPLIER_BASIS_POINTS,
  compareEconomyMinorUnits,
  economyMinorUnit,
  parseEconomyMinorUnit,
  proposeEconomyCraft,
  proposeEconomyPurchase,
  proposeEconomyRepair,
  proposeEconomySale,
  quoteEconomyPrice,
  validateDeltas,
  UNIFIED_ECONOMY_DEFAULT_FEE_ACCOUNT_REF,
  type EconomyAccountState,
  type EconomyActionContext,
  type EconomyMaterialInput,
  type EconomyResourceDefinition,
  type UnifiedEconomyState,
} from "../lib/epoch/unifiedEconomyRules.ts";

const actor = { actorType: "agent", actorId: "agent_crafter" } as const;

function context(actionId: string): EconomyActionContext {
  return {
    actionId,
    actor,
    occurredAtWorldMinute: 12_345,
    sourceEventIds: ["event_source_a", "event_source_b"],
    authorizationRefs: ["auth_ref"],
  };
}

function account(
  accountRef: string,
  balances: Readonly<Record<string, string>>,
  options: { readonly ownerRef?: string; readonly capacityMinor?: string } = {},
): EconomyAccountState {
  return {
    accountRef,
    ownerRef: options.ownerRef || `owner:${accountRef}`,
    capacityMinor: options.capacityMinor,
    balances: Object.entries(balances).map(([resourceKey, quantityMinor]) => ({
      resourceKey,
      bucket: "available" as const,
      quantityMinor,
    })),
  };
}

function material(
  resourceKey: string,
  basePriceMinor: string,
  extra: Partial<EconomyResourceDefinition> = {},
): EconomyResourceDefinition {
  return {
    resourceKey,
    resourceClass: "material",
    unit: "minor_unit",
    basePriceMinor,
    priceFloorMinor: "1",
    priceCeilingMinor: "1000000000000000000000000000",
    tradable: true,
    conserved: true,
    capacityWeightMinor: "1",
    allowedSourceTypes: ["production", "merchant_inventory", "contract_inventory", "legal_salvage", "research_byproduct", "transfer"],
    allowedSinkTypes: ["transfer", "crafting", "repair", "wear", "destruction", "freeze", "market_fee"],
    ...extra,
  };
}

function economyState(overrides: Partial<UnifiedEconomyState> = {}): UnifiedEconomyState {
  const resources = {
    ...DEFAULT_ECONOMY_RESOURCES,
    scrap_metal: material("scrap_metal", "1", { allowedSourceTypes: ["research_byproduct"] }),
    cloth_scrap: material("cloth_scrap", "1", { allowedSourceTypes: ["research_byproduct"] }),
    heavy_ore: material("heavy_ore", "12", { capacityWeightMinor: "10" }),
    ...overrides.resources,
  };
  return {
    resources,
    accounts: {
      buyer: account("buyer", { coin: "1000", iron_alloy: "0", heavy_ore: "0" }, { capacityMinor: "10000" }),
      merchant: account("merchant", { coin: "1000", iron_alloy: "10", heavy_ore: "10" }, { capacityMinor: "10000" }),
      seller: account("seller", { coin: "0", iron_alloy: "5" }, { capacityMinor: "10000" }),
      [UNIFIED_ECONOMY_DEFAULT_FEE_ACCOUNT_REF]: account(UNIFIED_ECONOMY_DEFAULT_FEE_ACCOUNT_REF, { coin: "0" }, { capacityMinor: "10000" }),
      crafter: account("crafter", {
        iron_alloy: "10",
        carbon_flux: "10",
        fuel_coke: "10",
        woven_cloth: "10",
        standard_thread: "10",
        leather: "10",
      }, { ownerRef: "agent_crafter", capacityMinor: "10000" }),
      ...overrides.accounts,
    },
    shopOffers: {
      iron_offer: {
        offerId: "iron_offer",
        merchantAccountRef: "merchant",
        resourceKey: "iron_alloy",
        quantityMinor: "4",
        priceResourceKey: "coin",
        baseUnitPriceMinor: "8",
        priceFloorMinor: "1",
        priceCeilingMinor: "1000",
        sourceType: "merchant_inventory",
      },
      heavy_drop: {
        offerId: "heavy_drop",
        merchantAccountRef: "merchant",
        resourceKey: "heavy_ore",
        quantityMinor: "2",
        priceResourceKey: "coin",
        baseUnitPriceMinor: "12",
        priceFloorMinor: "1",
        priceCeilingMinor: "1000",
        replenishmentSourceRef: "merchant:daily:heavy_ore",
        sourceType: "merchant_inventory",
      },
      ...overrides.shopOffers,
    },
    recipes: {
      ...DEFAULT_ECONOMY_RECIPES,
      ...overrides.recipes,
    },
    items: {
      blade_damaged: {
        itemRef: "blade_damaged",
        itemKey: "crafted:field-blade",
        titleOwnerRef: "agent_crafter",
        possessionAccountRef: "crafter",
        bucket: "damaged",
        quality: 80,
        durability: { current: 80, max: 100 },
        repairable: true,
        materialRefs: ["mat_old"],
        provenanceRefs: ["event_old"],
      },
      blade_near_max: {
        itemRef: "blade_near_max",
        itemKey: "crafted:field-blade",
        titleOwnerRef: "agent_crafter",
        possessionAccountRef: "crafter",
        bucket: "damaged",
        quality: 80,
        durability: { current: 98, max: 100 },
        repairable: true,
        materialRefs: ["mat_old"],
        provenanceRefs: ["event_old"],
      },
      ...overrides.items,
    },
  };
}

function input(materialRef: string, resourceKey: string, quantityMinor: string, provenanceChannel = "merchant_inventory"): EconomyMaterialInput {
  return {
    materialRef,
    resourceKey,
    accountRef: "crafter",
    quantityMinor,
    quality: 80,
    provenanceChannel: provenanceChannel as EconomyMaterialInput["provenanceChannel"],
    sourceEventIds: [`event:${materialRef}`],
  };
}

function forgeInputs(): readonly EconomyMaterialInput[] {
  return [
    input("mat_iron", "iron_alloy", "3"),
    input("mat_carbon", "carbon_flux", "1"),
    input("mat_fuel", "fuel_coke", "1"),
  ];
}

function sewingInputs(): readonly EconomyMaterialInput[] {
  return [
    input("mat_cloth", "woven_cloth", "4"),
    input("mat_thread", "standard_thread", "2"),
    input("mat_leather", "leather", "1", "legal_salvage"),
  ];
}

test("minor units parse and compare beyond Number precision", () => {
  const huge = "900719925474099312345678901";

  assert.equal(parseEconomyMinorUnit(huge), 900719925474099312345678901n);
  assert.equal(economyMinorUnit(900719925474099312345678902n), "900719925474099312345678902");
  assert.equal(compareEconomyMinorUnits(huge, "900719925474099312345678902"), -1);
  assert.equal(compareEconomyMinorUnits("900719925474099312345678902", huge), 1);
  assert.equal(parseEconomyMinorUnit("1.5"), undefined);
});

test("dynamic buy and sell quotes clamp to hard price bounds", () => {
  const resource = material("volatile_reagent", "100", {
    priceFloorMinor: "40",
    priceCeilingMinor: "200",
  });

  const high = quoteEconomyPrice(resource, "2", "buy", {
    supplyIndex: -100,
    demandIndex: 500,
    worldPressure: 500,
    reputation: -50,
  });
  const low = quoteEconomyPrice(resource, "2", "sell", {
    supplyIndex: 500,
    demandIndex: -100,
    worldPressure: -50,
    reputation: 500,
  });

  assert.equal(high.ok, true);
  assert.equal(low.ok, true);
  if (!high.ok || !low.ok) throw new Error("expected_quotes");
  assert.equal(high.value.multiplierBasisPoints, "24750");
  assert.equal(high.value.unitPriceMinor, "200");
  assert.equal(high.value.hardCeilingMinor, "200");
  assert.equal(low.value.multiplierBasisPoints, UNIFIED_ECONOMY_MIN_PRICE_MULTIPLIER_BASIS_POINTS.toString());
  assert.equal(low.value.unitPriceMinor, "40");
  assert.equal(low.value.hardFloorMinor, "40");
});

test("buy spread, sell spread, and fees make round trips non-profitable", () => {
  const resource = material("iron_alloy", "100");
  const buy = quoteEconomyPrice(resource, "10", "buy");
  const sell = quoteEconomyPrice(resource, "10", "sell");

  assert.equal(buy.ok, true);
  assert.equal(sell.ok, true);
  if (!buy.ok || !sell.ok) throw new Error("expected_quotes");
  assert.equal(buy.value.unitPriceMinor, "112");
  assert.equal(buy.value.feeMinor, "56");
  assert.equal(buy.value.totalMinor, "1176");
  assert.equal(sell.value.unitPriceMinor, "85");
  assert.equal(sell.value.feeMinor, "43");
  assert.equal(sell.value.totalMinor, "807");
  assert.ok(BigInt(buy.value.totalMinor) > BigInt(sell.value.totalMinor));

  const confiscatoryFee = quoteEconomyPrice(resource, "1", "sell", undefined, 10_000n);
  assert.equal(confiscatoryFee.ok, false);
  if (confiscatoryFee.ok) throw new Error("expected_fee_rejection");
  assert.equal(confiscatoryFee.errors[0]?.code, "ECONOMY_ARBITRAGE_GUARD");
});

test("quotes are deterministic for identical inputs and sortable by minor unit value", () => {
  const cheap = material("cheap", "2");
  const expensive = material("expensive", "20");

  const first = quoteEconomyPrice(expensive, "3", "buy");
  const second = quoteEconomyPrice(expensive, "3", "buy");
  const cheapQuote = quoteEconomyPrice(cheap, "3", "buy");
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(cheapQuote.ok, true);
  if (!first.ok || !second.ok || !cheapQuote.ok) throw new Error("expected_quotes");

  assert.deepEqual(first.value, second.value);
  const sorted = [first.value, cheapQuote.value].sort((left, right) => compareEconomyMinorUnits(left.totalMinor, right.totalMinor));
  assert.deepEqual(sorted.map((quote) => quote.resourceKey), ["cheap", "expensive"]);
});

test("purchase proposal conserves transferred resources and routes fees to a fee account", () => {
  const result = proposeEconomyPurchase(economyState(), {
    context: context("purchase_iron"),
    buyerAccountRef: "buyer",
    offerId: "iron_offer",
  });

  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("expected_purchase");
  assert.equal(result.value.operation, "purchase");
  assert.deepEqual(result.value.deltas.map((entry) => [entry.accountRef, entry.resourceKey, entry.quantityMinor, entry.sourceType, entry.sinkType]), [
    ["buyer", "coin", "-36", undefined, "transfer"],
    ["merchant", "coin", "36", "transfer", undefined],
    ["buyer", "coin", "-2", undefined, "transfer"],
    [UNIFIED_ECONOMY_DEFAULT_FEE_ACCOUNT_REF, "coin", "2", "transfer", undefined],
    ["merchant", "iron_alloy", "-4", undefined, "transfer"],
    ["buyer", "iron_alloy", "4", "transfer", undefined],
  ]);
  assert.equal(result.value.deltas.reduce((sum, entry) => entry.resourceKey === "iron_alloy" ? sum + BigInt(entry.quantityMinor) : sum, 0n), 0n);
  assert.equal(result.value.deltas.reduce((sum, entry) => entry.resourceKey === "coin" ? sum + BigInt(entry.quantityMinor) : sum, 0n), 0n);
  assert.ok(result.value.effects.every((effect) => assert.deepEqual(effect.sourceEventIds, ["event_source_a", "event_source_b"]) === undefined));
});

test("purchase proposal rejects insufficient balance, missing stock, reputation, and capacity overflow", () => {
  const insufficient = proposeEconomyPurchase(economyState({
    accounts: {
      buyer: account("buyer", { coin: "10", iron_alloy: "0" }, { capacityMinor: "10000" }),
    },
  }), {
    context: context("purchase_insufficient"),
    buyerAccountRef: "buyer",
    offerId: "iron_offer",
  });
  const stock = proposeEconomyPurchase(economyState({
    accounts: {
      merchant: account("merchant", { coin: "1000", iron_alloy: "1" }, { capacityMinor: "10000" }),
    },
  }), {
    context: context("purchase_stock"),
    buyerAccountRef: "buyer",
    offerId: "iron_offer",
  });
  const reputation = proposeEconomyPurchase(economyState({
    shopOffers: {
      iron_offer: {
        offerId: "iron_offer",
        merchantAccountRef: "merchant",
        resourceKey: "iron_alloy",
        quantityMinor: "1",
        priceResourceKey: "coin",
        baseUnitPriceMinor: "8",
        priceFloorMinor: "1",
        priceCeilingMinor: "1000",
        requiredReputation: 80,
      },
    },
  }), {
    context: context("purchase_reputation"),
    buyerAccountRef: "buyer",
    offerId: "iron_offer",
    marketPressure: { supplyIndex: 50, demandIndex: 50, worldPressure: 0, reputation: 40 },
  });
  const capacity = proposeEconomyPurchase(economyState({
    accounts: {
      buyer: account("buyer", { coin: "1000", heavy_ore: "0" }, { capacityMinor: "10" }),
    },
  }), {
    context: context("purchase_capacity"),
    buyerAccountRef: "buyer",
    offerId: "heavy_drop",
  });

  assert.equal(insufficient.ok, false);
  assert.equal(stock.ok, false);
  assert.equal(reputation.ok, false);
  assert.equal(capacity.ok, false);
  if (insufficient.ok || stock.ok || reputation.ok || capacity.ok) throw new Error("expected_rejections");
  assert.equal(insufficient.errors[0]?.code, "ECONOMY_NEGATIVE_BALANCE");
  assert.equal(stock.errors[0]?.code, "ECONOMY_OFFER_OUT_OF_STOCK");
  assert.equal(reputation.errors[0]?.code, "ECONOMY_REPUTATION_REQUIRED");
  assert.equal(capacity.errors[0]?.code, "ECONOMY_CAPACITY_EXCEEDED");
});

test("sale proposal preserves inventory and pays proceeds net of fee", () => {
  const result = proposeEconomySale(economyState(), {
    context: context("sell_iron"),
    sellerAccountRef: "seller",
    merchantAccountRef: "merchant",
    resourceKey: "iron_alloy",
    quantityMinor: "5",
    priceResourceKey: "coin",
  });

  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("expected_sale");
  assert.deepEqual(result.value.deltas.map((entry) => [entry.accountRef, entry.resourceKey, entry.quantityMinor, entry.sourceType, entry.sinkType]), [
    ["seller", "iron_alloy", "-5", undefined, "transfer"],
    ["merchant", "iron_alloy", "5", "transfer", undefined],
    ["merchant", "coin", "-35", undefined, "transfer"],
    ["seller", "coin", "33", "transfer", undefined],
    [UNIFIED_ECONOMY_DEFAULT_FEE_ACCOUNT_REF, "coin", "2", "transfer", undefined],
  ]);
  assert.equal(result.value.deltas.reduce((sum, entry) => entry.resourceKey === "iron_alloy" ? sum + BigInt(entry.quantityMinor) : sum, 0n), 0n);
  assert.equal(result.value.deltas.reduce((sum, entry) => entry.resourceKey === "coin" ? sum + BigInt(entry.quantityMinor) : sum, 0n), 0n);
});

test("delta validation requires authorized source or sink for non-conserved net changes", () => {
  const state = economyState();
  const unauthorized = validateDeltas(state, [
    {
      accountRef: "buyer",
      resourceKey: "coin",
      resourceClass: "currency",
      unit: "minor_coin",
      bucket: "available",
      quantityMinor: "5",
      sourceType: "production",
    },
    {
      accountRef: "buyer",
      resourceKey: "iron_alloy",
      resourceClass: "material",
      unit: "minor_unit",
      bucket: "available",
      quantityMinor: "-1",
    },
  ]);

  assert.equal(unauthorized.ok, false);
  if (unauthorized.ok) throw new Error("expected_validation_errors");
  assert.deepEqual(unauthorized.errors.map((entry) => entry.code), [
    "ECONOMY_UNAUTHORIZED_SOURCE",
    "ECONOMY_NEGATIVE_BALANCE",
    "ECONOMY_UNAUTHORIZED_SINK",
  ]);
});

test("skill and cultivation material channels declare provenance and source event requirements", () => {
  assert.deepEqual(DEFAULT_SKILL_AND_CULTIVATION_CHANNELS.filter((entry) => entry.purpose === "cultivation").map((entry) => entry.materialKey), [
    "spirit_grain",
    "meridian_salve",
    "foundation_dew",
    "domain_jade",
    "tribulation_conductor",
  ]);
  assert.deepEqual(DEFAULT_SKILL_AND_CULTIVATION_CHANNELS.find((entry) => entry.materialKey === "formation_core"), {
    materialKey: "formation_core",
    purpose: "skill_advancement",
    primaryChannel: "contract_inventory",
    secondaryChannels: ["dismantling", "faction_allocation"],
    requiresSourceEventIds: true,
  });
  assert.ok(DEFAULT_SKILL_AND_CULTIVATION_CHANNELS.every((entry) => entry.requiresSourceEventIds));
});

test("crafting rejects duplicate materials, missing provenance, wrong channel, and low skill", () => {
  const duplicate = proposeEconomyCraft(economyState(), {
    context: context("craft_duplicate"),
    crafterAccountRef: "crafter",
    recipeId: "forge_field_blade",
    materialInputs: [
      input("mat_same", "iron_alloy", "3"),
      input("mat_same", "carbon_flux", "1"),
      input("mat_fuel", "fuel_coke", "1"),
    ],
    crafterSkill: 20,
    workstationQuality: 50,
    processControl: 50,
  });
  const badProvenance = proposeEconomyCraft(economyState(), {
    context: context("craft_provenance"),
    crafterAccountRef: "crafter",
    recipeId: "forge_field_blade",
    materialInputs: [
      { ...input("mat_iron", "iron_alloy", "3"), sourceEventIds: [] },
      input("mat_carbon", "carbon_flux", "1", "sect_market"),
      input("mat_fuel", "fuel_coke", "1"),
    ],
    crafterSkill: 20,
    workstationQuality: 50,
    processControl: 50,
  });
  const lowSkill = proposeEconomyCraft(economyState(), {
    context: context("craft_low_skill"),
    crafterAccountRef: "crafter",
    recipeId: "forge_field_blade",
    materialInputs: forgeInputs(),
    crafterSkill: 19,
    workstationQuality: 50,
    processControl: 50,
  });

  assert.equal(duplicate.ok, false);
  assert.equal(badProvenance.ok, false);
  assert.equal(lowSkill.ok, false);
  if (duplicate.ok || badProvenance.ok || lowSkill.ok) throw new Error("expected_craft_rejections");
  assert.equal(duplicate.errors[0]?.code, "ECONOMY_DUPLICATE_MATERIAL");
  assert.deepEqual(badProvenance.errors.map((entry) => entry.code), [
    "ECONOMY_MATERIAL_PROVENANCE_REQUIRED",
    "ECONOMY_MATERIAL_PROVENANCE_REQUIRED",
  ]);
  assert.equal(lowSkill.errors[0]?.code, "ECONOMY_ILLEGAL_RECIPE");
});

test("forging success consumes materials, records labor recipe, quality, ownership, lifecycle, and provenance", () => {
  const result = proposeEconomyCraft(economyState(), {
    context: context("craft_forge_success"),
    crafterAccountRef: "crafter",
    recipeId: "forge_field_blade",
    materialInputs: forgeInputs(),
    crafterSkill: 90,
    workstationQuality: 70,
    processControl: 80,
    outputItemRef: "item_forged",
    seed: "seed_0",
  });

  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("expected_forging_success");
  assert.equal(result.value.failure, false);
  assert.equal(result.value.quality, 81);
  assert.deepEqual(result.value.deltas.map((entry) => [entry.resourceKey, entry.quantityMinor, entry.sinkType, entry.sinkRef]), [
    ["iron_alloy", "-3", "crafting", "sink:recipe_verified_transform"],
    ["carbon_flux", "-1", "crafting", "sink:recipe_verified_transform"],
    ["fuel_coke", "-1", "crafting", "sink:recipe_verified_transform"],
  ]);
  assert.equal(DEFAULT_ECONOMY_RECIPES.forge_field_blade?.laborWorldMinutes, 180);
  assert.equal(DEFAULT_ECONOMY_RECIPES.forge_field_blade?.facilityCapacityMinor, "180");
  assert.deepEqual(result.value.createdItem, {
    itemRef: "item_forged",
    itemKey: "crafted:field-blade",
    titleOwnerRef: "agent_crafter",
    possessionAccountRef: "crafter",
    bucket: "available",
    quality: 81,
    durability: { current: 100, max: 100 },
    repairable: true,
    materialRefs: ["mat_carbon", "mat_fuel", "mat_iron"],
    provenanceRefs: ["event:mat_carbon", "event:mat_fuel", "event:mat_iron"],
  });
  assert.deepEqual(result.value.effects.map((effect) => effect.effectType), [
    "resource_ledger",
    "resource_ledger",
    "resource_ledger",
    "unique_item_lifecycle",
    "ownership_interest",
    "ownership_interest",
  ]);
  assert.ok(result.value.effects.every((effect) => assert.deepEqual(effect.sourceEventIds, ["event_source_a", "event_source_b"]) === undefined));
});

test("tailoring success uses sewing recipe materials and deterministic quality", () => {
  const result = proposeEconomyCraft(economyState(), {
    context: context("craft_sew_success"),
    crafterAccountRef: "crafter",
    recipeId: "sew_travel_cloak",
    materialInputs: sewingInputs(),
    crafterSkill: 70,
    workstationQuality: 60,
    processControl: 60,
    outputItemRef: "item_cloak",
    seed: "seed_0",
  });

  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("expected_tailoring_success");
  assert.equal(result.value.failure, false);
  assert.equal(result.value.quality, 72);
  assert.deepEqual(result.value.createdItem?.materialRefs, ["mat_cloth", "mat_leather", "mat_thread"]);
  assert.equal(DEFAULT_ECONOMY_RECIPES.sew_travel_cloak?.laborWorldMinutes, 150);
  assert.equal(DEFAULT_ECONOMY_RECIPES.sew_travel_cloak?.facilityCapacityMinor, "150");
});

test("crafting failure consumes inputs and grants deterministic byproduct without creating an item", () => {
  const result = proposeEconomyCraft(economyState(), {
    context: context("craft_forge_failure"),
    crafterAccountRef: "crafter",
    recipeId: "forge_field_blade",
    materialInputs: forgeInputs(),
    crafterSkill: 20,
    workstationQuality: 10,
    processControl: 10,
    seed: "seed_11",
  });

  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("expected_forging_failure");
  assert.equal(result.value.failure, true);
  assert.equal(result.value.createdItem, undefined);
  assert.deepEqual(result.value.deltas.at(-1), {
    accountRef: "crafter",
    resourceKey: "scrap_metal",
    resourceClass: "material",
    unit: "minor_unit",
    bucket: "available",
    quantityMinor: "1",
    sourceType: "research_byproduct",
    sinkType: undefined,
    sourceRef: "recipe:forge_field_blade:byproduct",
    sinkRef: undefined,
  });
});

test("repair consumes repair recipe materials, clamps durability at max, and records lifecycle", () => {
  const result = proposeEconomyRepair(economyState(), {
    context: context("repair_13"),
    repairerAccountRef: "crafter",
    payerAccountRef: "crafter",
    itemRef: "blade_near_max",
    recipeId: "repair_metalwork",
    materialInputs: [
      input("mat_repair_iron", "iron_alloy", "1"),
      input("mat_repair_flux", "carbon_flux", "1"),
    ],
    repairerSkill: 80,
    workstationQuality: 80,
    processControl: 80,
  });

  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("expected_repair_success");
  assert.equal(result.value.failure, false);
  assert.deepEqual(result.value.deltas.map((entry) => [entry.resourceKey, entry.quantityMinor, entry.sinkRef]), [
    ["iron_alloy", "-1", "sink:repair_material"],
    ["carbon_flux", "-1", "sink:repair_material"],
  ]);
  const lifecycle = result.value.effects.find((effect) => effect.effectType === "unique_item_lifecycle");
  assert.equal(lifecycle?.operation, "repair_durability");
  assert.deepEqual(lifecycle?.after, {
    itemId: "blade_near_max",
    itemType: "crafted:field-blade",
    fromState: "damaged",
    toState: "repaired",
    titleOwnerRef: "agent_crafter",
    sourceMechanismRef: "recipe:repair_metalwork",
  });
  const transition = result.value.effects.find((effect) => effect.effectType === "state_transition");
  assert.equal(transition?.after.toState, "100");
});

test("repair failure applies durability loss floor and rejects invalid repair targets", () => {
  const failure = proposeEconomyRepair(economyState(), {
    context: context("repair_8"),
    repairerAccountRef: "crafter",
    payerAccountRef: "crafter",
    itemRef: "blade_damaged",
    recipeId: "repair_metalwork",
    materialInputs: [
      input("mat_repair_iron", "iron_alloy", "1"),
      input("mat_repair_flux", "carbon_flux", "1"),
    ],
    repairerSkill: 15,
    workstationQuality: 10,
    processControl: 10,
  });
  const notRepairable = proposeEconomyRepair(economyState({
    items: {
      blade_damaged: {
        ...economyState().items?.blade_damaged,
        repairable: false,
      },
    },
  }), {
    context: context("repair_not_repairable"),
    repairerAccountRef: "crafter",
    payerAccountRef: "crafter",
    itemRef: "blade_damaged",
    recipeId: "repair_metalwork",
    materialInputs: [
      input("mat_repair_iron", "iron_alloy", "1"),
      input("mat_repair_flux", "carbon_flux", "1"),
    ],
    repairerSkill: 15,
    workstationQuality: 10,
    processControl: 10,
  });

  assert.equal(failure.ok, true);
  assert.equal(notRepairable.ok, false);
  if (!failure.ok || notRepairable.ok) throw new Error("expected_repair_results");
  assert.equal(failure.value.failure, true);
  assert.equal(failure.value.effects.find((effect) => effect.effectType === "state_transition")?.after.toState, "79");
  assert.equal(notRepairable.errors[0]?.code, "ECONOMY_ITEM_NOT_REPAIRABLE");
});
