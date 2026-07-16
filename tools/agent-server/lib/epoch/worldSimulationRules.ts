import { createHash, randomUUID } from "node:crypto";

import {
  createEpochEvent,
  type EpochEvent,
  type WorldSimulationAdvancedPayload,
  type WorldSimulationContentMigratedPayload,
} from "./events.ts";
import type { EpochCommandContext, EpochIdFactory } from "./protocol.ts";
import { attachEpochEventsForPersistence } from "./runtimePublicProjectionRules.ts";
import type {
  WorldContentFaction,
  WorldContentPlace,
  WorldContentRegistry,
  WorldContentRoute,
} from "./worldContentRegistry.ts";
import type {
  JourneyWorldSlice,
  JourneyWorldSliceRegionState,
} from "./journeyRules.ts";

export const EPOCH_WORLD_SIMULATION_ID = "world_simulation:canonical";
export const EPOCH_WORLD_SIMULATION_RULE_VERSION = "world-simulation.v2";
export const EPOCH_WORLD_SIMULATION_QUANTUM_MINUTES = 15;
export const EPOCH_WORLD_FLOW_SHIPMENT_SAMPLE_LIMIT = 64;
export const EPOCH_WORLD_SIMULATION_CHECKPOINT_MINUTES = 1_440;

const LEGACY_WORLD_SIMULATION_RULE_VERSION = "world-simulation.v1";

export const EPOCH_WORLD_COMMODITY_IDS = [
  "food",
  "water",
  "medicine",
  "materials",
  "fuel",
  "aether",
] as const;

export type EpochWorldCommodityId = typeof EPOCH_WORLD_COMMODITY_IDS[number];
export type EpochWorldCommodityLedger = Readonly<Record<EpochWorldCommodityId, number>>;

export interface EpochWorldFacilityState {
  readonly agricultureBps: number;
  readonly waterworksBps: number;
  readonly extractionBps: number;
  readonly refiningBps: number;
  readonly manufacturingBps: number;
  readonly logisticsBps: number;
  readonly medicalBps: number;
  readonly housingBps: number;
  readonly sanitationBps: number;
}

export interface EpochWorldRegionFlowState {
  readonly produced: EpochWorldCommodityLedger;
  readonly consumed: EpochWorldCommodityLedger;
  readonly imported: EpochWorldCommodityLedger;
  readonly exported: EpochWorldCommodityLedger;
  readonly unmet: EpochWorldCommodityLedger;
  readonly tradeCoinPaid: number;
  readonly tradeCoinReceived: number;
  readonly factionTaxPaid?: number;
  readonly factionSubsidyReceived?: number;
}

export interface EpochWorldRegionSimulationState {
  readonly regionId: string;
  readonly label: string;
  readonly persistent: boolean;
  readonly population: number;
  readonly controllerFactionId?: string;
  readonly stocks: EpochWorldCommodityLedger;
  readonly reserves: EpochWorldCommodityLedger;
  readonly facilities: EpochWorldFacilityState;
  readonly productionRemainders: EpochWorldCommodityLedger;
  readonly consumptionRemainders: EpochWorldCommodityLedger;
  readonly priceMilliCoin: EpochWorldCommodityLedger;
  readonly coverageBps: EpochWorldCommodityLedger;
  readonly publicHealthBps: number;
  readonly securityBps: number;
  readonly unrestBps: number;
  readonly conflictPressureBps: number;
  readonly treasuryCoin: number;
  readonly lastFlows: EpochWorldRegionFlowState;
}

export type EpochWorldFactionOperationalStatus = "operating" | "mobilizing" | "conflict_engaged";

export interface EpochWorldFactionSimulationState {
  readonly factionId: string;
  readonly label: string;
  readonly coreMembers: number;
  readonly affiliatedPopulation: number;
  readonly treasuryCoin: number;
  readonly logisticsBps: number;
  readonly militaryReadinessBps: number;
  readonly legitimacyBps: number;
  readonly warExhaustionBps: number;
  readonly controlledRegionIds: readonly string[];
  readonly conflictRegionIds: readonly string[];
  readonly status: EpochWorldFactionOperationalStatus;
}

export interface EpochWorldShipment {
  readonly shipmentId: string;
  readonly routeId: string;
  readonly fromRegionId: string;
  readonly toRegionId: string;
  readonly commodityId: EpochWorldCommodityId;
  readonly amount: number;
  readonly unitPriceMilliCoin: number;
  readonly paidCoin: number;
  readonly departedWorldMinute: number;
  readonly arrivesWorldMinute: number;
}

export interface EpochWorldSimulationRouteState {
  readonly routeId: string;
  readonly fromRegionId: string;
  readonly toRegionId: string;
  readonly bidirectional: boolean;
  readonly baseMinutes: number;
  readonly mode: readonly string[];
}

export const EPOCH_WORLD_CONFLICT_CAUSES = [
  "faction_campaign",
  "region_control_contest",
  "resource_contest",
  "raid",
  "retaliation",
  "structured_conflict_signal",
] as const;

export type EpochWorldConflictCause = typeof EPOCH_WORLD_CONFLICT_CAUSES[number];
export type EpochWorldConflictPhase = "tension" | "hostilities" | "war";

export interface EpochWorldConflictEvidence {
  readonly evidenceId: string;
  readonly cause: EpochWorldConflictCause;
  readonly factionIds: readonly string[];
  readonly pressureBps: number;
}

export interface EpochWorldConflictState {
  readonly conflictId: string;
  readonly regionId: string;
  readonly factionIds: readonly string[];
  readonly causes: readonly EpochWorldConflictCause[];
  readonly evidenceIds: readonly string[];
  readonly intensityBps: number;
  readonly pressureAccumulationRemainder?: number;
  readonly decayRemainder?: number;
  readonly phase: EpochWorldConflictPhase;
  readonly startedWorldMinute: number;
  readonly updatedWorldMinute: number;
}

export interface EpochWorldSimulationSnapshot {
  readonly simulationId: typeof EPOCH_WORLD_SIMULATION_ID;
  readonly initialized: boolean;
  readonly worldMinute: number;
  /** Last canonical 15-minute boundary whose material state has been settled. */
  readonly materializedWorldMinute?: number;
  readonly worldContentSourceHash: `sha256:${string}`;
  readonly regions: readonly EpochWorldRegionSimulationState[];
  readonly factions: readonly EpochWorldFactionSimulationState[];
  readonly routes: readonly EpochWorldSimulationRouteState[];
  readonly conflicts: readonly EpochWorldConflictState[];
  readonly shipments: readonly EpochWorldShipment[];
  readonly commodityTotals: EpochWorldCommodityLedger;
  readonly totalCoin: number;
  readonly version: number;
  readonly stateHash: `sha256:${string}`;
  readonly lastEventId?: string;
  readonly lastAdvancedAt?: string;
}

export interface EpochWorldSimulationRegionSignal {
  readonly regionId: string;
  readonly controllerFactionId?: string;
  readonly conflictFactionIds?: readonly string[];
  readonly conflictEvidence?: readonly EpochWorldConflictEvidence[];
  readonly anomalyPressureBps?: number;
  readonly contestedResourceNodes?: number;
  readonly openMarketOrders?: number;
  /** Recent server-settled public-service impact from Journey actions. */
  readonly civicSupportBps?: number;
}

export interface EpochWorldSimulationSignals {
  readonly regions: readonly EpochWorldSimulationRegionSignal[];
}

export interface EpochWorldSimulationFlowSummary {
  readonly produced: EpochWorldCommodityLedger;
  readonly consumed: EpochWorldCommodityLedger;
  readonly lost: EpochWorldCommodityLedger;
  readonly departedShipments: readonly EpochWorldShipment[];
  readonly arrivedShipments: readonly EpochWorldShipment[];
  /** Total records represented by the bounded arrays above (v2+). */
  readonly departedShipmentCount?: number;
  readonly arrivedShipmentCount?: number;
  readonly departedShipmentsHash?: `sha256:${string}`;
  readonly arrivedShipmentsHash?: `sha256:${string}`;
  readonly shipmentSamplesTruncated?: boolean;
  readonly tradeCoinTransferred: number;
  readonly factionTaxCoinTransferred: number;
  readonly factionSubsidyCoinTransferred: number;
  readonly conflictRegionIds: readonly string[];
}

export interface AdvanceEpochWorldSimulationInput {
  readonly fromWorldMinute: number;
  readonly toWorldMinute: number;
  readonly sourceClockEventId: string;
  readonly sourceEventIds?: readonly string[];
  readonly signals?: EpochWorldSimulationSignals;
  readonly idempotencyKey: string;
  readonly causationId?: string;
  readonly correlationId?: string;
}

export interface EpochWorldSimulationAdvanceResult {
  readonly simulation: EpochWorldSimulationSnapshot;
  readonly events: readonly EpochEvent[];
  readonly flows?: EpochWorldSimulationFlowSummary;
  readonly duplicate: boolean;
}

export interface MigrateEpochWorldSimulationContentInput {
  readonly regionSuccessors?: Readonly<Record<string, string>>;
  readonly factionSuccessors?: Readonly<Record<string, string>>;
  readonly idempotencyKey: string;
  readonly causationId?: string;
  readonly correlationId?: string;
}

export interface EpochWorldSimulationContentMigrationResult {
  readonly simulation: EpochWorldSimulationSnapshot;
  readonly events: readonly EpochEvent[];
  readonly genesisCommodityDelta: EpochWorldCommodityLedger;
  readonly genesisReserveDelta: EpochWorldCommodityLedger;
  readonly genesisCoinDelta: number;
  readonly reroutedShipmentCount: number;
  readonly forcedArrivalCount: number;
  readonly duplicate: boolean;
}

export interface CreateEpochWorldSimulationRuntimeOptions {
  readonly registry: WorldContentRegistry;
  readonly initialEvents?: readonly EpochEvent[];
  readonly idFactory?: EpochIdFactory;
  readonly nowReal?: () => Date | string;
  readonly onEvents?: (events: readonly EpochEvent[]) => void;
  readonly checkpointInterval?: number;
}

type MutableLedger = Record<EpochWorldCommodityId, number>;
type MutableRegion = Omit<
  EpochWorldRegionSimulationState,
  | "stocks"
  | "reserves"
  | "productionRemainders"
  | "consumptionRemainders"
  | "priceMilliCoin"
  | "coverageBps"
  | "lastFlows"
  | "controllerFactionId"
  | "treasuryCoin"
> & {
  controllerFactionId?: string;
  treasuryCoin: number;
  stocks: MutableLedger;
  reserves: MutableLedger;
  productionRemainders: MutableLedger;
  consumptionRemainders: MutableLedger;
  priceMilliCoin: MutableLedger;
  coverageBps: MutableLedger;
  publicHealthBps: number;
  securityBps: number;
  unrestBps: number;
  conflictPressureBps: number;
  lastFlows: {
    produced: MutableLedger;
    consumed: MutableLedger;
    imported: MutableLedger;
    exported: MutableLedger;
    unmet: MutableLedger;
    tradeCoinPaid: number;
    tradeCoinReceived: number;
    factionTaxPaid: number;
    factionSubsidyReceived: number;
  };
};

const BASE_PRICE_MILLI_COIN: EpochWorldCommodityLedger = {
  food: 1_000,
  water: 400,
  medicine: 4_000,
  materials: 1_800,
  fuel: 2_200,
  aether: 10_000,
};

function emptyLedger(): MutableLedger {
  return {
    food: 0,
    water: 0,
    medicine: 0,
    materials: 0,
    fuel: 0,
    aether: 0,
  };
}

function copyLedger(value: EpochWorldCommodityLedger): MutableLedger {
  return { ...value };
}

function addLedger(target: MutableLedger, source: EpochWorldCommodityLedger) {
  for (const commodityId of EPOCH_WORLD_COMMODITY_IDS) target[commodityId] += source[commodityId];
}

function nonNegativeWhole(value: unknown, error: string): number {
  if (!Number.isSafeInteger(value) || Number(value) < 0) throw new Error(error);
  return Number(value);
}

function positiveWhole(value: unknown, error: string): number {
  const result = nonNegativeWhole(value, error);
  if (result === 0) throw new Error(error);
  return result;
}

function boundedBps(value: number) {
  return Math.max(0, Math.min(10_000, Math.round(value)));
}

function coverageBps(value: number) {
  return Math.max(0, Math.min(50_000, Math.round(value)));
}

function assertText(value: unknown, error: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(error);
  return value.trim();
}

function normalizedStrings(value: readonly string[] | undefined): readonly string[] {
  return [...new Set((value || []).map((item) => assertText(item, "world_simulation_string_invalid")))].sort();
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const candidate = value as Record<string, unknown>;
    return `{${Object.keys(candidate).sort().map((key) => `${JSON.stringify(key)}:${stableJson(candidate[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value: unknown): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(stableJson(value)).digest("hex")}`;
}

function createShipmentFlowAccumulator() {
  let count = 0;
  const samples: EpochWorldShipment[] = [];
  const hash = createHash("sha256");
  return {
    add(shipments: readonly EpochWorldShipment[]) {
      for (const shipment of shipments) {
        count += 1;
        hash.update(stableJson(shipment));
        hash.update("\n");
        if (samples.length < EPOCH_WORLD_FLOW_SHIPMENT_SAMPLE_LIMIT) samples.push(shipment);
      }
    },
    finish() {
      return {
        count,
        samples,
        hash: `sha256:${hash.digest("hex")}` as `sha256:${string}`,
      };
    },
  };
}

function deterministicNumber(key: string, min: number, max: number) {
  const digest = createHash("sha256").update(key).digest();
  const value = digest.readUInt32BE(0);
  return min + (value % (max - min + 1));
}

function hasTag(place: WorldContentPlace, ...tags: readonly string[]) {
  return tags.some((tag) => place.tags.includes(tag));
}

function regionPopulation(place: WorldContentPlace) {
  if (!place.persistent || place.spatialKind === "anomaly") return 0;
  const base = place.spatialKind === "settlement"
    ? 12_000
    : place.spatialKind === "district"
      ? 4_000
      : place.spatialKind === "macro_region"
        ? 2_000
        : 500;
  const tagged = base
    + (hasTag(place, "population_center") ? 30_000 : 0)
    + (hasTag(place, "orbit") ? 8_000 : 0)
    + (hasTag(place, "housing") ? 2_000 : 0)
    + (hasTag(place, "deep_sea") ? 1_500 : 0);
  return tagged + deterministicNumber(place.id, 0, Math.max(1, Math.floor(tagged / 8)));
}

function facilityScore(place: WorldContentPlace, matches: readonly string[], base: number) {
  const hits = matches.filter((tag) => place.tags.includes(tag)).length;
  return boundedBps(base + hits * 1_800);
}

function regionFacilities(place: WorldContentPlace): EpochWorldFacilityState {
  const populated = place.persistent && place.spatialKind !== "anomaly";
  const base = populated ? 1_000 : 0;
  return {
    agricultureBps: facilityScore(place, ["food", "fishery", "wetland", "ecology", "medicine"], base),
    waterworksBps: facilityScore(place, ["water", "water_source", "wetland", "deep_sea"], base),
    extractionBps: facilityScore(place, ["ore", "mining", "salvage", "fuel", "divine_material"], base),
    refiningBps: facilityScore(place, ["research", "manufacturing", "divine_material", "probability"], base),
    manufacturingBps: facilityScore(place, ["manufacturing", "research", "memory_industry", "maintenance"], base),
    logisticsBps: facilityScore(place, ["trade", "trade_gate", "shipping", "convoy", "underground_transit"], base),
    medicalBps: facilityScore(place, ["medicine", "rescue", "purification", "research"], base),
    housingBps: facilityScore(place, ["housing", "population_center", "settlement"], place.spatialKind === "settlement" ? 5_000 : base),
    sanitationBps: facilityScore(place, ["water", "maintenance", "purification"], place.spatialKind === "settlement" ? 4_000 : base),
  };
}

function daysOfStock(place: WorldContentPlace, commodityId: EpochWorldCommodityId) {
  if (commodityId === "food") {
    if (hasTag(place, "food", "fishery", "wetland")) return 10;
    if (hasTag(place, "food_import", "orbit")) return 2;
    return 5;
  }
  if (commodityId === "water") {
    if (hasTag(place, "water", "water_source", "wetland", "deep_sea")) return 12;
    if (hasTag(place, "orbit")) return 2;
    return 4;
  }
  if (commodityId === "medicine") return hasTag(place, "medicine", "research", "purification") ? 8 : 2;
  if (commodityId === "materials") return hasTag(place, "ore", "mining", "salvage", "manufacturing") ? 10 : 2;
  if (commodityId === "fuel") return hasTag(place, "fuel", "manufacturing", "waste") ? 8 : 3;
  return hasTag(place, "research", "divine_material", "probability", "outer_signal") ? 8 : 1;
}

function dailyNeed(population: number, commodityId: EpochWorldCommodityId, conflict = false) {
  if (commodityId === "food" || commodityId === "water") return population * 1_000;
  if (commodityId === "medicine") return population * (conflict ? 40 : 8);
  if (commodityId === "fuel") return population * (conflict ? 180 : 100);
  if (commodityId === "materials") return population * (conflict ? 50 : 20);
  return population * (conflict ? 20 : 5);
}

function initialStocks(place: WorldContentPlace, population: number): MutableLedger {
  const result = emptyLedger();
  for (const commodityId of EPOCH_WORLD_COMMODITY_IDS) {
    result[commodityId] = dailyNeed(population, commodityId) * daysOfStock(place, commodityId);
  }
  return result;
}

function initialReserves(place: WorldContentPlace, population: number): MutableLedger {
  const reserve = emptyLedger();
  reserve.water = dailyNeed(population, "water") * (hasTag(place, "water", "water_source", "deep_sea") ? 2_000 : 120);
  reserve.food = dailyNeed(population, "food") * (hasTag(place, "food", "fishery", "ecology", "wetland") ? 800 : 80);
  reserve.medicine = dailyNeed(population, "medicine") * (hasTag(place, "medicine", "ecology") ? 400 : 40);
  reserve.materials = dailyNeed(population, "materials") * (hasTag(place, "ore", "mining", "salvage") ? 3_000 : 100);
  reserve.fuel = dailyNeed(population, "fuel") * (hasTag(place, "fuel", "waste", "mining") ? 2_000 : 80);
  reserve.aether = dailyNeed(population, "aether") * (hasTag(place, "divine_material", "probability", "outer_signal") ? 2_000 : 60);
  return reserve;
}

function seededController(place: WorldContentPlace, factionIds: ReadonlySet<string>) {
  return place.jurisdictionIds.find((jurisdictionId) => factionIds.has(jurisdictionId));
}

function zeroFlows(): MutableRegion["lastFlows"] {
  return {
    produced: emptyLedger(),
    consumed: emptyLedger(),
    imported: emptyLedger(),
    exported: emptyLedger(),
    unmet: emptyLedger(),
    tradeCoinPaid: 0,
    tradeCoinReceived: 0,
    factionTaxPaid: 0,
    factionSubsidyReceived: 0,
  };
}

function seedRegion(place: WorldContentPlace, factions: readonly WorldContentFaction[]): EpochWorldRegionSimulationState {
  const population = regionPopulation(place);
  const factionIds = new Set(factions.map((faction) => faction.id));
  const stocks = initialStocks(place, population);
  const coverage = emptyLedger();
  for (const commodityId of EPOCH_WORLD_COMMODITY_IDS) {
    const need = dailyNeed(population, commodityId);
    coverage[commodityId] = need > 0 ? coverageBps((stocks[commodityId] * 10_000) / (need * 5)) : 10_000;
  }
  return {
    regionId: place.id,
    label: place.label,
    persistent: place.persistent,
    population,
    ...(seededController(place, factionIds) ? { controllerFactionId: seededController(place, factionIds) } : {}),
    stocks,
    reserves: initialReserves(place, population),
    facilities: regionFacilities(place),
    productionRemainders: emptyLedger(),
    consumptionRemainders: emptyLedger(),
    priceMilliCoin: { ...BASE_PRICE_MILLI_COIN },
    coverageBps: coverage,
    publicHealthBps: population > 0 ? 8_000 : 10_000,
    securityBps: population > 0 ? 7_000 : 10_000,
    unrestBps: 1_000,
    conflictPressureBps: 0,
    treasuryCoin: population * 50,
    lastFlows: zeroFlows(),
  };
}

function seedFaction(faction: WorldContentFaction): EpochWorldFactionSimulationState {
  const totalPeople = faction.coreMemberBaseline + faction.affiliatedPopulationBaseline;
  return {
    factionId: faction.id,
    label: faction.label,
    coreMembers: faction.coreMemberBaseline,
    affiliatedPopulation: faction.affiliatedPopulationBaseline,
    treasuryCoin: totalPeople * 100,
    logisticsBps: 6_000,
    militaryReadinessBps: 4_000,
    legitimacyBps: 6_500,
    warExhaustionBps: 0,
    controlledRegionIds: [],
    conflictRegionIds: [],
    status: "operating",
  };
}

function simulationRoute(route: WorldContentRoute): EpochWorldSimulationRouteState {
  return {
    routeId: route.id,
    fromRegionId: route.from,
    toRegionId: route.to,
    bidirectional: route.bidirectional,
    baseMinutes: route.baseMinutes,
    mode: [...route.mode].sort(),
  };
}

function commodityTotals(
  regions: readonly EpochWorldRegionSimulationState[],
  shipments: readonly EpochWorldShipment[],
) {
  const totals = emptyLedger();
  for (const region of regions) addLedger(totals, region.stocks);
  for (const shipment of shipments) totals[shipment.commodityId] += shipment.amount;
  return totals;
}

function totalCoin(
  regions: readonly EpochWorldRegionSimulationState[],
  factions: readonly EpochWorldFactionSimulationState[],
) {
  return regions.reduce((total, region) => total + region.treasuryCoin, 0)
    + factions.reduce((total, faction) => total + faction.treasuryCoin, 0);
}

function snapshotWithHash(input: Omit<EpochWorldSimulationSnapshot, "stateHash">): EpochWorldSimulationSnapshot {
  return { ...input, stateHash: sha256(input) };
}

function seedSnapshot(registry: WorldContentRegistry, worldMinute: number): EpochWorldSimulationSnapshot {
  const regions = registry.places.map((place) => seedRegion(place, registry.factions))
    .sort((left, right) => left.regionId.localeCompare(right.regionId));
  const factions = registry.factions.map(seedFaction)
    .sort((left, right) => left.factionId.localeCompare(right.factionId));
  const routes = registry.routes.map(simulationRoute)
    .sort((left, right) => left.routeId.localeCompare(right.routeId));
  const shipments: EpochWorldShipment[] = [];
  return snapshotWithHash({
    simulationId: EPOCH_WORLD_SIMULATION_ID,
    initialized: true,
    worldMinute,
    materializedWorldMinute: worldMinute,
    worldContentSourceHash: registry.sourceHash,
    regions,
    factions,
    routes,
    conflicts: [],
    shipments,
    commodityTotals: commodityTotals(regions, shipments),
    totalCoin: totalCoin(regions, factions),
    version: 1,
  });
}

function uninitializedSnapshot(registry: WorldContentRegistry): EpochWorldSimulationSnapshot {
  return snapshotWithHash({
    simulationId: EPOCH_WORLD_SIMULATION_ID,
    initialized: false,
    worldMinute: 0,
    materializedWorldMinute: 0,
    worldContentSourceHash: registry.sourceHash,
    regions: [],
    factions: [],
    routes: [],
    conflicts: [],
    shipments: [],
    commodityTotals: emptyLedger(),
    totalCoin: 0,
    version: 0,
  });
}

function reserveTotals(regions: readonly EpochWorldRegionSimulationState[]) {
  const totals = emptyLedger();
  for (const region of regions) addLedger(totals, region.reserves);
  return totals;
}

function normalizedSuccessorMap(
  value: Readonly<Record<string, string>> | undefined,
  kind: "region" | "faction",
): Readonly<Record<string, string>> {
  const entries = Object.entries(value || {}).map(([sourceId, targetId]) => [
    assertText(sourceId, `world_simulation_${kind}_successor_source_invalid`),
    assertText(targetId, `world_simulation_${kind}_successor_target_invalid`),
  ] as const).sort(([left], [right]) => left.localeCompare(right));
  const result: Record<string, string> = {};
  for (const [sourceId, targetId] of entries) {
    if (sourceId === targetId) throw new Error(`world_simulation_${kind}_successor_identity_invalid:${sourceId}`);
    if (Object.hasOwn(result, sourceId)) throw new Error(`world_simulation_${kind}_successor_duplicate:${sourceId}`);
    result[sourceId] = targetId;
  }
  return result;
}

function migrationCommandHash(input: {
  readonly fromWorldContentSourceHash: `sha256:${string}`;
  readonly toWorldContentSourceHash: `sha256:${string}`;
  readonly worldMinute: number;
  readonly regionSuccessors: Readonly<Record<string, string>>;
  readonly factionSuccessors: Readonly<Record<string, string>>;
}) {
  return sha256(input);
}

function weightedWhole(left: number, leftWeight: number, right: number, rightWeight: number) {
  const totalWeight = leftWeight + rightWeight;
  if (totalWeight <= 0) return Math.round((left + right) / 2);
  return Math.round((left * leftWeight + right * rightWeight) / totalWeight);
}

function weightedLedger(
  left: EpochWorldCommodityLedger,
  leftWeight: number,
  right: EpochWorldCommodityLedger,
  rightWeight: number,
) {
  const result = emptyLedger();
  for (const commodityId of EPOCH_WORLD_COMMODITY_IDS) {
    result[commodityId] = weightedWhole(
      left[commodityId],
      leftWeight,
      right[commodityId],
      rightWeight,
    );
  }
  return result;
}

function summedLedger(left: EpochWorldCommodityLedger, right: EpochWorldCommodityLedger) {
  const result = copyLedger(left);
  addLedger(result, right);
  return result;
}

function emptyReplacementRegion(
  place: WorldContentPlace,
  factions: readonly WorldContentFaction[],
): EpochWorldRegionSimulationState {
  const seeded = seedRegion(place, factions);
  return {
    ...seeded,
    population: 0,
    stocks: emptyLedger(),
    reserves: emptyLedger(),
    productionRemainders: emptyLedger(),
    consumptionRemainders: emptyLedger(),
    coverageBps: emptyLedger(),
    treasuryCoin: 0,
    lastFlows: zeroFlows(),
  };
}

function mergeRegionState(
  target: EpochWorldRegionSimulationState,
  source: EpochWorldRegionSimulationState,
  controllerFactionId: string | undefined,
): EpochWorldRegionSimulationState {
  const targetWeight = target.population;
  const sourceWeight = source.population;
  const controller = target.controllerFactionId || controllerFactionId;
  return {
    ...target,
    population: target.population + source.population,
    ...(controller ? { controllerFactionId: controller } : { controllerFactionId: undefined }),
    stocks: summedLedger(target.stocks, source.stocks),
    reserves: summedLedger(target.reserves, source.reserves),
    productionRemainders: summedLedger(target.productionRemainders, source.productionRemainders),
    consumptionRemainders: summedLedger(target.consumptionRemainders, source.consumptionRemainders),
    priceMilliCoin: weightedLedger(target.priceMilliCoin, targetWeight, source.priceMilliCoin, sourceWeight),
    coverageBps: weightedLedger(target.coverageBps, targetWeight, source.coverageBps, sourceWeight),
    publicHealthBps: weightedWhole(target.publicHealthBps, targetWeight, source.publicHealthBps, sourceWeight),
    securityBps: weightedWhole(target.securityBps, targetWeight, source.securityBps, sourceWeight),
    unrestBps: weightedWhole(target.unrestBps, targetWeight, source.unrestBps, sourceWeight),
    conflictPressureBps: weightedWhole(
      target.conflictPressureBps,
      targetWeight,
      source.conflictPressureBps,
      sourceWeight,
    ),
    treasuryCoin: target.treasuryCoin + source.treasuryCoin,
    lastFlows: {
      produced: summedLedger(target.lastFlows.produced, source.lastFlows.produced),
      consumed: summedLedger(target.lastFlows.consumed, source.lastFlows.consumed),
      imported: summedLedger(target.lastFlows.imported, source.lastFlows.imported),
      exported: summedLedger(target.lastFlows.exported, source.lastFlows.exported),
      unmet: summedLedger(target.lastFlows.unmet, source.lastFlows.unmet),
      tradeCoinPaid: target.lastFlows.tradeCoinPaid + source.lastFlows.tradeCoinPaid,
      tradeCoinReceived: target.lastFlows.tradeCoinReceived + source.lastFlows.tradeCoinReceived,
      factionTaxPaid: (target.lastFlows.factionTaxPaid || 0) + (source.lastFlows.factionTaxPaid || 0),
      factionSubsidyReceived: (target.lastFlows.factionSubsidyReceived || 0)
        + (source.lastFlows.factionSubsidyReceived || 0),
    },
  };
}

function emptyReplacementFaction(faction: WorldContentFaction): EpochWorldFactionSimulationState {
  const seeded = seedFaction(faction);
  return {
    ...seeded,
    coreMembers: 0,
    affiliatedPopulation: 0,
    treasuryCoin: 0,
  };
}

function factionStatusRank(status: EpochWorldFactionOperationalStatus) {
  if (status === "conflict_engaged") return 2;
  if (status === "mobilizing") return 1;
  return 0;
}

function mergeFactionState(
  target: EpochWorldFactionSimulationState,
  source: EpochWorldFactionSimulationState,
  regionSuccessors: Readonly<Record<string, string>>,
): EpochWorldFactionSimulationState {
  const targetWeight = target.coreMembers + target.affiliatedPopulation;
  const sourceWeight = source.coreMembers + source.affiliatedPopulation;
  const status = factionStatusRank(target.status) >= factionStatusRank(source.status)
    ? target.status
    : source.status;
  return {
    ...target,
    coreMembers: target.coreMembers + source.coreMembers,
    affiliatedPopulation: target.affiliatedPopulation + source.affiliatedPopulation,
    treasuryCoin: target.treasuryCoin + source.treasuryCoin,
    logisticsBps: weightedWhole(target.logisticsBps, targetWeight, source.logisticsBps, sourceWeight),
    militaryReadinessBps: weightedWhole(
      target.militaryReadinessBps,
      targetWeight,
      source.militaryReadinessBps,
      sourceWeight,
    ),
    legitimacyBps: weightedWhole(target.legitimacyBps, targetWeight, source.legitimacyBps, sourceWeight),
    warExhaustionBps: weightedWhole(
      target.warExhaustionBps,
      targetWeight,
      source.warExhaustionBps,
      sourceWeight,
    ),
    controlledRegionIds: normalizedStrings([
      ...target.controlledRegionIds,
      ...source.controlledRegionIds.map((regionId) => regionSuccessors[regionId] || regionId),
    ]),
    conflictRegionIds: normalizedStrings([
      ...target.conflictRegionIds,
      ...source.conflictRegionIds.map((regionId) => regionSuccessors[regionId] || regionId),
    ]),
    status,
  };
}

interface WorldContentMigrationTransition {
  readonly snapshot: EpochWorldSimulationSnapshot;
  readonly genesisCommodityDelta: EpochWorldCommodityLedger;
  readonly genesisReserveDelta: EpochWorldCommodityLedger;
  readonly genesisCoinDelta: number;
  readonly reroutedShipmentCount: number;
  readonly forcedArrivalCount: number;
}

function migrateSnapshot(
  previous: EpochWorldSimulationSnapshot,
  registry: WorldContentRegistry,
  regionSuccessors: Readonly<Record<string, string>>,
  factionSuccessors: Readonly<Record<string, string>>,
): WorldContentMigrationTransition {
  const currentPlaceIds = new Set(registry.places.map((place) => place.id));
  const currentFactionIds = new Set(registry.factions.map((faction) => faction.id));
  const removedRegions = previous.regions.filter((region) => !currentPlaceIds.has(region.regionId));
  const removedFactions = previous.factions.filter((faction) => !currentFactionIds.has(faction.factionId));
  const removedRegionIds = new Set(removedRegions.map((region) => region.regionId));
  const removedFactionIds = new Set(removedFactions.map((faction) => faction.factionId));
  for (const [sourceId, targetId] of Object.entries(regionSuccessors)) {
    if (!removedRegionIds.has(sourceId)) throw new Error(`world_simulation_region_successor_source_active:${sourceId}`);
    if (!currentPlaceIds.has(targetId)) throw new Error(`world_simulation_region_successor_target_missing:${targetId}`);
  }
  for (const region of removedRegions) {
    if (!regionSuccessors[region.regionId]) {
      throw new Error(`world_simulation_region_successor_required:${region.regionId}`);
    }
  }
  for (const [sourceId, targetId] of Object.entries(factionSuccessors)) {
    if (!removedFactionIds.has(sourceId)) throw new Error(`world_simulation_faction_successor_source_active:${sourceId}`);
    if (!currentFactionIds.has(targetId)) throw new Error(`world_simulation_faction_successor_target_missing:${targetId}`);
  }
  for (const faction of removedFactions) {
    if (!factionSuccessors[faction.factionId]) {
      throw new Error(`world_simulation_faction_successor_required:${faction.factionId}`);
    }
  }

  const replacementRegionIds = new Set(Object.values(regionSuccessors));
  const replacementFactionIds = new Set(Object.values(factionSuccessors));
  const oldRegionById = new Map(previous.regions.map((region) => [region.regionId, region]));
  const oldFactionById = new Map(previous.factions.map((faction) => [faction.factionId, faction]));
  const genesisCommodityDelta = emptyLedger();
  const genesisReserveDelta = emptyLedger();
  let genesisCoinDelta = 0;

  const regionMap = new Map<string, EpochWorldRegionSimulationState>();
  for (const place of [...registry.places].sort((left, right) => left.id.localeCompare(right.id))) {
    const existing = oldRegionById.get(place.id);
    if (existing) {
      const mappedController = existing.controllerFactionId
        ? factionSuccessors[existing.controllerFactionId] || existing.controllerFactionId
        : undefined;
      regionMap.set(place.id, {
        ...existing,
        label: place.label,
        persistent: place.persistent,
        facilities: regionFacilities(place),
        ...(mappedController ? { controllerFactionId: mappedController } : { controllerFactionId: undefined }),
      });
      continue;
    }
    if (replacementRegionIds.has(place.id)) {
      regionMap.set(place.id, emptyReplacementRegion(place, registry.factions));
      continue;
    }
    const seeded = seedRegion(place, registry.factions);
    regionMap.set(place.id, seeded);
    addLedger(genesisCommodityDelta, seeded.stocks);
    addLedger(genesisReserveDelta, seeded.reserves);
    genesisCoinDelta += seeded.treasuryCoin;
  }
  for (const removed of [...removedRegions].sort((left, right) => left.regionId.localeCompare(right.regionId))) {
    const targetId = regionSuccessors[removed.regionId]!;
    const target = regionMap.get(targetId);
    if (!target) throw new Error(`world_simulation_region_successor_target_missing:${targetId}`);
    const mappedController = removed.controllerFactionId
      ? factionSuccessors[removed.controllerFactionId] || removed.controllerFactionId
      : undefined;
    regionMap.set(targetId, mergeRegionState(target, removed, mappedController));
  }

  const factionMap = new Map<string, EpochWorldFactionSimulationState>();
  for (const faction of [...registry.factions].sort((left, right) => left.id.localeCompare(right.id))) {
    const existing = oldFactionById.get(faction.id);
    if (existing) {
      factionMap.set(faction.id, { ...existing, label: faction.label });
      continue;
    }
    if (replacementFactionIds.has(faction.id)) {
      factionMap.set(faction.id, emptyReplacementFaction(faction));
      continue;
    }
    const seeded = seedFaction(faction);
    factionMap.set(faction.id, seeded);
    genesisCoinDelta += seeded.treasuryCoin;
  }
  for (const removed of [...removedFactions].sort((left, right) => left.factionId.localeCompare(right.factionId))) {
    const targetId = factionSuccessors[removed.factionId]!;
    const target = factionMap.get(targetId);
    if (!target) throw new Error(`world_simulation_faction_successor_target_missing:${targetId}`);
    factionMap.set(targetId, mergeFactionState(target, removed, regionSuccessors));
  }

  const routes = registry.routes.map(simulationRoute)
    .sort((left, right) => left.routeId.localeCompare(right.routeId));
  function routeFor(fromRegionId: string, toRegionId: string) {
    return routes.find((route) =>
      (route.fromRegionId === fromRegionId && route.toRegionId === toRegionId)
      || (route.bidirectional && route.fromRegionId === toRegionId && route.toRegionId === fromRegionId));
  }
  let reroutedShipmentCount = 0;
  let forcedArrivalCount = 0;
  const shipments: EpochWorldShipment[] = [];
  for (const shipment of [...previous.shipments].sort((left, right) => left.shipmentId.localeCompare(right.shipmentId))) {
    const fromRegionId = regionSuccessors[shipment.fromRegionId] || shipment.fromRegionId;
    const toRegionId = regionSuccessors[shipment.toRegionId] || shipment.toRegionId;
    const route = routeFor(fromRegionId, toRegionId);
    if (!route) {
      const destination = regionMap.get(toRegionId);
      if (!destination) throw new Error(`world_simulation_shipment_migration_destination_missing:${shipment.shipmentId}`);
      regionMap.set(toRegionId, {
        ...destination,
        stocks: {
          ...destination.stocks,
          [shipment.commodityId]: destination.stocks[shipment.commodityId] + shipment.amount,
        },
      });
      forcedArrivalCount += 1;
      continue;
    }
    if (route.routeId !== shipment.routeId
      || fromRegionId !== shipment.fromRegionId
      || toRegionId !== shipment.toRegionId) {
      reroutedShipmentCount += 1;
    }
    shipments.push({
      ...shipment,
      routeId: route.routeId,
      fromRegionId,
      toRegionId,
    });
  }

  const regions = [...regionMap.values()].sort((left, right) => left.regionId.localeCompare(right.regionId));
  const regionIds = new Set(regions.map((region) => region.regionId));
  const factions = [...factionMap.values()].map((faction): EpochWorldFactionSimulationState => {
    const controlledRegionIds = regions
      .filter((region) => region.controllerFactionId === faction.factionId)
      .map((region) => region.regionId)
      .sort();
    const conflictRegionIds = normalizedStrings(faction.conflictRegionIds
      .map((regionId) => regionSuccessors[regionId] || regionId)
      .filter((regionId) => regionIds.has(regionId)));
    return {
      ...faction,
      controlledRegionIds,
      conflictRegionIds,
      status: conflictRegionIds.length > 0 ? "conflict_engaged" : faction.status,
    };
  }).sort((left, right) => left.factionId.localeCompare(right.factionId));
  const conflictMap = new Map<string, EpochWorldConflictState>();
  for (const conflict of previous.conflicts) {
    const regionId = regionSuccessors[conflict.regionId] || conflict.regionId;
    const factionIds = normalizedStrings(conflict.factionIds
      .map((factionId) => factionSuccessors[factionId] || factionId)
      .filter((factionId) => currentFactionIds.has(factionId)));
    if (!regionIds.has(regionId) || factionIds.length < 2) continue;
    const key = `${regionId}:${factionIds.join(":")}`;
    const existing = conflictMap.get(key);
    conflictMap.set(key, {
      conflictId: worldConflictId(regionId, factionIds),
      regionId,
      factionIds,
      causes: normalizedStrings([...(existing?.causes || []), ...conflict.causes]) as readonly EpochWorldConflictCause[],
      evidenceIds: normalizedStrings([...(existing?.evidenceIds || []), ...conflict.evidenceIds]),
      intensityBps: Math.max(existing?.intensityBps || 0, conflict.intensityBps),
      phase: conflictPhase(Math.max(existing?.intensityBps || 0, conflict.intensityBps)),
      startedWorldMinute: Math.min(existing?.startedWorldMinute ?? conflict.startedWorldMinute, conflict.startedWorldMinute),
      updatedWorldMinute: Math.max(existing?.updatedWorldMinute || 0, conflict.updatedWorldMinute),
    });
  }
  const conflicts = [...conflictMap.values()].sort((left, right) => left.conflictId.localeCompare(right.conflictId));
  const next = snapshotWithHash({
    simulationId: EPOCH_WORLD_SIMULATION_ID,
    initialized: true,
    worldMinute: previous.worldMinute,
    materializedWorldMinute: previous.materializedWorldMinute ?? previous.worldMinute,
    worldContentSourceHash: registry.sourceHash,
    regions,
    factions,
    routes,
    conflicts,
    shipments,
    commodityTotals: commodityTotals(regions, shipments),
    totalCoin: totalCoin(regions, factions),
    version: previous.version + 1,
  });
  for (const commodityId of EPOCH_WORLD_COMMODITY_IDS) {
    if (next.commodityTotals[commodityId] - previous.commodityTotals[commodityId]
      !== genesisCommodityDelta[commodityId]) {
      throw new Error(`world_simulation_migration_commodity_conservation_failed:${commodityId}`);
    }
    if (reserveTotals(next.regions)[commodityId] - reserveTotals(previous.regions)[commodityId]
      !== genesisReserveDelta[commodityId]) {
      throw new Error(`world_simulation_migration_reserve_conservation_failed:${commodityId}`);
    }
  }
  if (next.totalCoin - previous.totalCoin !== genesisCoinDelta) {
    throw new Error("world_simulation_migration_coin_conservation_failed");
  }
  return {
    snapshot: next,
    genesisCommodityDelta,
    genesisReserveDelta,
    genesisCoinDelta,
    reroutedShipmentCount,
    forcedArrivalCount,
  };
}

function assertLedger(value: EpochWorldCommodityLedger, error: string) {
  for (const commodityId of EPOCH_WORLD_COMMODITY_IDS) nonNegativeWhole(value[commodityId], error);
}

function assertSnapshot(
  snapshot: EpochWorldSimulationSnapshot,
  options: { readonly skipStateHash?: boolean } = {},
) {
  if (snapshot.simulationId !== EPOCH_WORLD_SIMULATION_ID) throw new Error("world_simulation_snapshot_id_invalid");
  if (!/^sha256:[a-f0-9]{64}$/u.test(snapshot.worldContentSourceHash)) {
    throw new Error("world_simulation_content_hash_invalid");
  }
  nonNegativeWhole(snapshot.worldMinute, "world_simulation_snapshot_minute_invalid");
  if (snapshot.materializedWorldMinute !== undefined) {
    const materializedWorldMinute = nonNegativeWhole(
      snapshot.materializedWorldMinute,
      "world_simulation_materialized_minute_invalid",
    );
    if (materializedWorldMinute > snapshot.worldMinute
      || snapshot.worldMinute - materializedWorldMinute >= EPOCH_WORLD_SIMULATION_QUANTUM_MINUTES) {
      throw new Error("world_simulation_materialized_minute_invalid");
    }
  }
  nonNegativeWhole(snapshot.version, "world_simulation_snapshot_version_invalid");
  nonNegativeWhole(snapshot.totalCoin, "world_simulation_snapshot_coin_invalid");
  const regionIds = new Set<string>();
  for (const region of snapshot.regions) {
    if (regionIds.has(region.regionId)) throw new Error(`world_simulation_region_duplicate:${region.regionId}`);
    regionIds.add(region.regionId);
    nonNegativeWhole(region.population, "world_simulation_population_invalid");
    nonNegativeWhole(region.treasuryCoin, "world_simulation_region_coin_invalid");
    assertLedger(region.stocks, "world_simulation_stock_invalid");
    assertLedger(region.reserves, "world_simulation_reserve_invalid");
    assertLedger(region.productionRemainders, "world_simulation_production_remainder_invalid");
    assertLedger(region.consumptionRemainders, "world_simulation_consumption_remainder_invalid");
    assertLedger(region.priceMilliCoin, "world_simulation_price_invalid");
    assertLedger(region.coverageBps, "world_simulation_coverage_invalid");
    assertLedger(region.lastFlows.produced, "world_simulation_produced_flow_invalid");
    assertLedger(region.lastFlows.consumed, "world_simulation_consumed_flow_invalid");
    assertLedger(region.lastFlows.imported, "world_simulation_imported_flow_invalid");
    assertLedger(region.lastFlows.exported, "world_simulation_exported_flow_invalid");
    assertLedger(region.lastFlows.unmet, "world_simulation_unmet_flow_invalid");
    nonNegativeWhole(region.lastFlows.tradeCoinPaid, "world_simulation_trade_coin_paid_invalid");
    nonNegativeWhole(region.lastFlows.tradeCoinReceived, "world_simulation_trade_coin_received_invalid");
    nonNegativeWhole(region.lastFlows.factionTaxPaid || 0, "world_simulation_faction_tax_invalid");
    nonNegativeWhole(region.lastFlows.factionSubsidyReceived || 0, "world_simulation_faction_subsidy_invalid");
  }
  const factionIds = new Set<string>();
  for (const faction of snapshot.factions) {
    if (factionIds.has(faction.factionId)) throw new Error(`world_simulation_faction_duplicate:${faction.factionId}`);
    factionIds.add(faction.factionId);
    positiveWhole(faction.coreMembers, "world_simulation_faction_members_invalid");
    nonNegativeWhole(faction.affiliatedPopulation, "world_simulation_faction_affiliates_invalid");
    nonNegativeWhole(faction.treasuryCoin, "world_simulation_faction_coin_invalid");
  }
  for (const region of snapshot.regions) {
    if (region.controllerFactionId && !factionIds.has(region.controllerFactionId)) {
      throw new Error(`world_simulation_region_controller_invalid:${region.regionId}`);
    }
  }
  const routeIds = new Set<string>();
  for (const route of snapshot.routes) {
    if (routeIds.has(route.routeId)) throw new Error(`world_simulation_route_duplicate:${route.routeId}`);
    routeIds.add(route.routeId);
    if (!regionIds.has(route.fromRegionId) || !regionIds.has(route.toRegionId)
      || route.fromRegionId === route.toRegionId) {
      throw new Error(`world_simulation_route_region_invalid:${route.routeId}`);
    }
    positiveWhole(route.baseMinutes, "world_simulation_route_minutes_invalid");
    normalizedStrings(route.mode);
  }
  const conflictIds = new Set<string>();
  for (const conflict of snapshot.conflicts) {
    if (conflictIds.has(conflict.conflictId)) {
      throw new Error(`world_simulation_conflict_duplicate:${conflict.conflictId}`);
    }
    conflictIds.add(conflict.conflictId);
    if (!regionIds.has(conflict.regionId)) {
      throw new Error(`world_simulation_conflict_region_invalid:${conflict.conflictId}`);
    }
    if (conflict.factionIds.length < 2
      || conflict.factionIds.some((factionId) => !factionIds.has(factionId))
      || stableJson(conflict.factionIds) !== stableJson(normalizedStrings(conflict.factionIds))) {
      throw new Error(`world_simulation_conflict_factions_invalid:${conflict.conflictId}`);
    }
    if (conflict.causes.length === 0
      || conflict.causes.some((cause) => !EPOCH_WORLD_CONFLICT_CAUSES.includes(cause))) {
      throw new Error(`world_simulation_conflict_causes_invalid:${conflict.conflictId}`);
    }
    positiveWhole(conflict.intensityBps, "world_simulation_conflict_intensity_invalid");
    if (conflict.pressureAccumulationRemainder !== undefined
      && (!Number.isSafeInteger(conflict.pressureAccumulationRemainder)
        || conflict.pressureAccumulationRemainder < 0
        || conflict.pressureAccumulationRemainder >= 2_880)) {
      throw new Error(`world_simulation_conflict_pressure_remainder_invalid:${conflict.conflictId}`);
    }
    if (conflict.decayRemainder !== undefined
      && (!Number.isSafeInteger(conflict.decayRemainder)
        || conflict.decayRemainder < 0
        || conflict.decayRemainder >= 1_440)) {
      throw new Error(`world_simulation_conflict_decay_remainder_invalid:${conflict.conflictId}`);
    }
    if (conflict.phase !== conflictPhase(conflict.intensityBps)) {
      throw new Error(`world_simulation_conflict_phase_invalid:${conflict.conflictId}`);
    }
    nonNegativeWhole(conflict.startedWorldMinute, "world_simulation_conflict_start_invalid");
    nonNegativeWhole(conflict.updatedWorldMinute, "world_simulation_conflict_update_invalid");
    if (conflict.updatedWorldMinute < conflict.startedWorldMinute
      || conflict.updatedWorldMinute > snapshot.worldMinute) {
      throw new Error(`world_simulation_conflict_time_invalid:${conflict.conflictId}`);
    }
  }
  const shipmentIds = new Set<string>();
  for (const shipment of snapshot.shipments) {
    if (shipmentIds.has(shipment.shipmentId)) throw new Error(`world_simulation_shipment_duplicate:${shipment.shipmentId}`);
    shipmentIds.add(shipment.shipmentId);
    positiveWhole(shipment.amount, "world_simulation_shipment_amount_invalid");
    positiveWhole(shipment.unitPriceMilliCoin, "world_simulation_shipment_price_invalid");
    positiveWhole(shipment.paidCoin, "world_simulation_shipment_payment_invalid");
    if (shipment.arrivesWorldMinute <= shipment.departedWorldMinute) {
      throw new Error(`world_simulation_shipment_time_invalid:${shipment.shipmentId}`);
    }
    if (!regionIds.has(shipment.fromRegionId) || !regionIds.has(shipment.toRegionId)) {
      throw new Error(`world_simulation_shipment_region_invalid:${shipment.shipmentId}`);
    }
  }
  assertLedger(snapshot.commodityTotals, "world_simulation_total_invalid");
  if (!options.skipStateHash) {
    const expectedHash = sha256((({ stateHash: _stateHash, ...value }) => value)(snapshot));
    if (snapshot.stateHash !== expectedHash) throw new Error("world_simulation_state_hash_invalid");
  }
}

function supportedRuleVersion(value: string) {
  return value === EPOCH_WORLD_SIMULATION_RULE_VERSION
    || value === LEGACY_WORLD_SIMULATION_RULE_VERSION;
}

function persistedSnapshot(
  snapshot: EpochWorldSimulationSnapshot,
  registry: WorldContentRegistry,
): EpochWorldSimulationSnapshot {
  const candidate = snapshot as EpochWorldSimulationSnapshot & {
    readonly routes?: readonly EpochWorldSimulationRouteState[];
    readonly conflicts?: readonly EpochWorldConflictState[];
  };
  if (Array.isArray(candidate.routes) && Array.isArray(candidate.conflicts)) {
    assertSnapshot(snapshot);
    return snapshot;
  }
  const raw = candidate as unknown as Record<string, unknown>;
  const { stateHash: _stateHash, ...legacyValue } = raw;
  if (sha256(legacyValue) !== snapshot.stateHash) throw new Error("world_simulation_legacy_state_hash_invalid");
  const hydrated = {
    ...snapshot,
    routes: Array.isArray(candidate.routes)
      ? candidate.routes
      : snapshot.worldContentSourceHash === registry.sourceHash
        ? registry.routes.map(simulationRoute).sort((left, right) => left.routeId.localeCompare(right.routeId))
        : [],
    conflicts: Array.isArray(candidate.conflicts) ? candidate.conflicts : [],
  };
  assertSnapshot(hydrated, { skipStateHash: true });
  return hydrated;
}

function simulationEvent(event: EpochEvent) {
  return event.aggregateType === "world_simulation" && event.aggregateId === EPOCH_WORLD_SIMULATION_ID;
}

export function projectEpochWorldSimulation(
  events: readonly EpochEvent[],
  registry: WorldContentRegistry,
  initialState?: EpochWorldSimulationSnapshot,
): EpochWorldSimulationSnapshot {
  let state = initialState || uninitializedSnapshot(registry);
  for (const event of events.filter(simulationEvent)) {
    if (event.eventType === "world_simulation_initialized") {
      if (state.initialized) throw new Error("world_simulation_initialized_twice");
      if (event.payload.simulationId !== EPOCH_WORLD_SIMULATION_ID
        || event.payload.worldContentSourceHash !== event.payload.snapshot.worldContentSourceHash
        || !supportedRuleVersion(event.payload.ruleVersion)
        || event.payload.snapshot.worldMinute !== event.payload.worldMinute) {
        throw new Error("world_simulation_initialization_invalid");
      }
      const snapshot = persistedSnapshot(event.payload.snapshot, registry);
      state = {
        ...snapshot,
        lastEventId: event.eventId,
        lastAdvancedAt: event.createdAt,
      };
      continue;
    }
    if (event.eventType === "world_simulation_advanced") {
      if (!state.initialized) throw new Error("world_simulation_advance_before_initialization");
      if (event.payload.simulationId !== EPOCH_WORLD_SIMULATION_ID
        || event.payload.worldContentSourceHash !== state.worldContentSourceHash
        || !supportedRuleVersion(event.payload.ruleVersion)
        || event.payload.fromWorldMinute !== state.worldMinute
        || event.payload.previousStateHash !== state.stateHash
        || event.payload.elapsedWorldMinutes !== event.payload.toWorldMinute - event.payload.fromWorldMinute
        || event.payload.toWorldMinute <= event.payload.fromWorldMinute) {
        throw new Error(`world_simulation_event_sequence_invalid:${event.eventId}`);
      }
      if (!event.payload.signals) {
        const legacySnapshot = event.payload.snapshot;
        if (!legacySnapshot
          || legacySnapshot.worldContentSourceHash !== state.worldContentSourceHash
          || legacySnapshot.worldMinute !== event.payload.toWorldMinute
          || legacySnapshot.version !== state.version + 1) {
          throw new Error(`world_simulation_legacy_snapshot_invalid:${event.eventId}`);
        }
        const snapshot = persistedSnapshot(legacySnapshot, registry);
        state = {
          ...snapshot,
          lastEventId: event.eventId,
          lastAdvancedAt: event.createdAt,
        };
        continue;
      }
      const signals = normalizeSignals(event.payload.signals);
      if (stableJson(signals) !== stableJson(event.payload.signals)) {
        throw new Error(`world_simulation_event_signals_not_normalized:${event.eventId}`);
      }
      const sourceEventIds = normalizedStrings(event.payload.sourceEventIds);
      const expectedCommandHash = commandHash({
        fromWorldMinute: event.payload.fromWorldMinute,
        toWorldMinute: event.payload.toWorldMinute,
        sourceClockEventId: assertText(
          event.payload.sourceClockEventId,
          "world_simulation_clock_event_required",
        ),
        sourceEventIds,
        signals,
      });
      if (event.payload.commandHash !== expectedCommandHash) {
        throw new Error(`world_simulation_event_command_hash_invalid:${event.eventId}`);
      }
      const transition = (event.payload.ruleVersion === LEGACY_WORLD_SIMULATION_RULE_VERSION
        ? advanceSnapshotV1
        : advanceSnapshot)(state, {
        fromWorldMinute: event.payload.fromWorldMinute,
        toWorldMinute: event.payload.toWorldMinute,
        sourceClockEventId: event.payload.sourceClockEventId,
        sourceEventIds,
        signals,
        idempotencyKey: event.idempotencyKey || `replay:${event.eventId}`,
      }, signals, expectedCommandHash);
      if (event.payload.nextStateHash !== transition.snapshot.stateHash
        || event.payload.nextVersion !== transition.snapshot.version
        || sha256(event.payload.flows) !== sha256(transition.flows)) {
        throw new Error(`world_simulation_incremental_transition_invalid:${event.eventId}`);
      }
      if (event.payload.snapshot) {
        assertSnapshot(event.payload.snapshot);
        if (event.payload.snapshot.stateHash !== transition.snapshot.stateHash) {
          throw new Error(`world_simulation_checkpoint_mismatch:${event.eventId}`);
        }
      } else if (event.payload.checkpoint) {
        throw new Error(`world_simulation_checkpoint_missing:${event.eventId}`);
      }
      state = {
        ...transition.snapshot,
        lastEventId: event.eventId,
        lastAdvancedAt: event.createdAt,
      };
      continue;
    }
    if (event.eventType === "world_simulation_content_migrated") {
      if (!state.initialized) throw new Error("world_simulation_migration_before_initialization");
      const regionSuccessors = normalizedSuccessorMap(event.payload.regionSuccessors, "region");
      const factionSuccessors = normalizedSuccessorMap(event.payload.factionSuccessors, "faction");
      if (stableJson(regionSuccessors) !== stableJson(event.payload.regionSuccessors)
        || stableJson(factionSuccessors) !== stableJson(event.payload.factionSuccessors)) {
        throw new Error(`world_simulation_migration_successors_not_normalized:${event.eventId}`);
      }
      const expectedCommandHash = migrationCommandHash({
        fromWorldContentSourceHash: event.payload.fromWorldContentSourceHash,
        toWorldContentSourceHash: event.payload.toWorldContentSourceHash,
        worldMinute: event.payload.worldMinute,
        regionSuccessors,
        factionSuccessors,
      });
      const snapshot = event.payload.snapshot;
      if (event.payload.simulationId !== EPOCH_WORLD_SIMULATION_ID
        || !supportedRuleVersion(event.payload.ruleVersion)
        || event.payload.fromWorldContentSourceHash !== state.worldContentSourceHash
        || event.payload.toWorldContentSourceHash !== snapshot.worldContentSourceHash
        || event.payload.fromWorldContentSourceHash === event.payload.toWorldContentSourceHash
        || event.payload.worldMinute !== state.worldMinute
        || snapshot.worldMinute !== state.worldMinute
        || snapshot.version !== state.version + 1
        || event.payload.previousStateHash !== state.stateHash
        || event.payload.nextStateHash !== snapshot.stateHash
        || event.payload.commandHash !== expectedCommandHash) {
        throw new Error(`world_simulation_migration_sequence_invalid:${event.eventId}`);
      }
      assertSnapshot(snapshot);
      assertLedger(event.payload.genesisCommodityDelta, "world_simulation_migration_genesis_invalid");
      assertLedger(event.payload.genesisReserveDelta, "world_simulation_migration_reserve_genesis_invalid");
      nonNegativeWhole(event.payload.genesisCoinDelta, "world_simulation_migration_coin_genesis_invalid");
      nonNegativeWhole(event.payload.reroutedShipmentCount, "world_simulation_migration_reroute_count_invalid");
      nonNegativeWhole(event.payload.forcedArrivalCount, "world_simulation_migration_arrival_count_invalid");
      const previousReserves = reserveTotals(state.regions);
      const nextReserves = reserveTotals(snapshot.regions);
      for (const commodityId of EPOCH_WORLD_COMMODITY_IDS) {
        if (snapshot.commodityTotals[commodityId] - state.commodityTotals[commodityId]
          !== event.payload.genesisCommodityDelta[commodityId]) {
          throw new Error(`world_simulation_migration_commodity_delta_invalid:${commodityId}`);
        }
        if (nextReserves[commodityId] - previousReserves[commodityId]
          !== event.payload.genesisReserveDelta[commodityId]) {
          throw new Error(`world_simulation_migration_reserve_delta_invalid:${commodityId}`);
        }
      }
      if (snapshot.totalCoin - state.totalCoin !== event.payload.genesisCoinDelta) {
        throw new Error("world_simulation_migration_coin_delta_invalid");
      }
      state = {
        ...snapshot,
        lastEventId: event.eventId,
        lastAdvancedAt: event.createdAt,
      };
      continue;
    }
    throw new Error(`world_simulation_event_type_invalid:${event.eventType}`);
  }
  return state;
}

function mutableRegion(region: EpochWorldRegionSimulationState): MutableRegion {
  return {
    ...region,
    stocks: copyLedger(region.stocks),
    reserves: copyLedger(region.reserves),
    productionRemainders: copyLedger(region.productionRemainders),
    consumptionRemainders: copyLedger(region.consumptionRemainders),
    priceMilliCoin: copyLedger(region.priceMilliCoin),
    coverageBps: copyLedger(region.coverageBps),
    lastFlows: zeroFlows(),
  };
}

function scaledDaily(dailyAmount: number, elapsedWorldMinutes: number, remainder: number) {
  const numerator = dailyAmount * elapsedWorldMinutes + remainder;
  return {
    amount: Math.floor(numerator / 1_440),
    remainder: numerator % 1_440,
  };
}

function consume(region: MutableRegion, commodityId: EpochWorldCommodityId, requested: number) {
  const amount = Math.min(region.stocks[commodityId], Math.max(0, Math.floor(requested)));
  region.stocks[commodityId] -= amount;
  region.lastFlows.consumed[commodityId] += amount;
  region.lastFlows.unmet[commodityId] += Math.max(0, Math.floor(requested) - amount);
  return amount;
}

function produce(region: MutableRegion, commodityId: EpochWorldCommodityId, amount: number) {
  const produced = Math.max(0, Math.floor(amount));
  region.stocks[commodityId] += produced;
  region.lastFlows.produced[commodityId] += produced;
  return produced;
}

function potentialDailyProduction(region: MutableRegion, commodityId: EpochWorldCommodityId) {
  const population = region.population;
  if (population === 0) return 0;
  if (commodityId === "water") return Math.floor(population * 1_000 * (7_000 + region.facilities.waterworksBps) / 10_000);
  if (commodityId === "food") return Math.floor(population * 1_000 * (4_500 + region.facilities.agricultureBps) / 10_000);
  if (commodityId === "medicine") return Math.floor(population * 80 * region.facilities.medicalBps / 10_000);
  if (commodityId === "materials") return Math.floor(50_000 * region.facilities.extractionBps / 10_000);
  if (commodityId === "fuel") return Math.floor(35_000 * region.facilities.extractionBps / 10_000);
  return Math.floor(8_000 * region.facilities.refiningBps / 10_000);
}

function applyProduction(region: MutableRegion, elapsedWorldMinutes: number) {
  for (const commodityId of EPOCH_WORLD_COMMODITY_IDS) {
    const scaled = scaledDaily(
      potentialDailyProduction(region, commodityId),
      elapsedWorldMinutes,
      region.productionRemainders[commodityId],
    );
    region.productionRemainders[commodityId] = scaled.remainder;
    let amount = Math.min(scaled.amount, region.reserves[commodityId]);
    if (commodityId === "water") {
      const fuelNeeded = Math.ceil(amount / 100);
      const fuelUsed = consume(region, "fuel", fuelNeeded);
      amount = Math.min(amount, fuelUsed * 100);
    } else if (commodityId === "food") {
      const waterUsed = consume(region, "water", Math.ceil(amount / 4));
      const fuelUsed = consume(region, "fuel", Math.ceil(amount / 50));
      amount = Math.min(amount, waterUsed * 4, fuelUsed * 50);
    } else if (commodityId === "materials") {
      const fuelUsed = consume(region, "fuel", Math.ceil(amount / 10));
      amount = Math.min(amount, fuelUsed * 10);
    } else if (commodityId === "medicine") {
      const foodUsed = consume(region, "food", Math.ceil(amount / 10));
      const materialsUsed = consume(region, "materials", Math.ceil(amount / 20));
      amount = Math.min(amount, foodUsed * 10, materialsUsed * 20);
    } else if (commodityId === "aether") {
      const materialsUsed = consume(region, "materials", Math.ceil(amount / 5));
      const fuelUsed = consume(region, "fuel", Math.ceil(amount / 10));
      amount = Math.min(amount, materialsUsed * 5, fuelUsed * 10);
    }
    region.reserves[commodityId] -= amount;
    produce(region, commodityId, amount);
  }
}

function applyPopulationNeeds(region: MutableRegion, elapsedWorldMinutes: number, conflict: boolean) {
  for (const commodityId of EPOCH_WORLD_COMMODITY_IDS) {
    const scaled = scaledDaily(
      dailyNeed(region.population, commodityId, conflict),
      elapsedWorldMinutes,
      region.consumptionRemainders[commodityId],
    );
    region.consumptionRemainders[commodityId] = scaled.remainder;
    consume(region, commodityId, scaled.amount);
  }
}

function updateRegionIndicators(
  region: MutableRegion,
  signal: EpochWorldSimulationRegionSignal | undefined,
  conflictIntensityBps: number,
) {
  const conflict = conflictIntensityBps > 0;
  const anomalyPressure = boundedBps(Number(signal?.anomalyPressureBps || 0));
  const marketLiquidityBps = Math.min(2_500, nonNegativeWhole(
    Math.floor(Number(signal?.openMarketOrders || 0)),
    "world_simulation_market_orders_invalid",
  ) * 125);
  const contestedPressure = Math.min(2_000, nonNegativeWhole(
    Math.floor(Number(signal?.contestedResourceNodes || 0)),
    "world_simulation_contested_nodes_invalid",
  ) * 400);
  const civicSupportBps = boundedBps(Number(signal?.civicSupportBps || 0));
  region.conflictPressureBps = conflict
    ? Math.max(region.conflictPressureBps, boundedBps(conflictIntensityBps + contestedPressure))
    : boundedBps(region.conflictPressureBps * 0.85 + anomalyPressure + contestedPressure);
  if (signal?.controllerFactionId) region.controllerFactionId = signal.controllerFactionId;
  const shortages: number[] = [];
  for (const commodityId of EPOCH_WORLD_COMMODITY_IDS) {
    const need = dailyNeed(region.population, commodityId, conflict);
    region.coverageBps[commodityId] = need > 0
      ? coverageBps((region.stocks[commodityId] * 10_000) / (need * 5))
      : 10_000;
    const rawPricePressureBps = Math.max(5_000, Math.min(50_000, Math.floor(100_000_000 / Math.max(2_000, region.coverageBps[commodityId]))));
    const pricePressureBps = rawPricePressureBps > 10_000
      ? Math.max(10_000, rawPricePressureBps - marketLiquidityBps)
      : Math.min(10_000, rawPricePressureBps + marketLiquidityBps);
    region.priceMilliCoin[commodityId] = Math.max(1, Math.floor(BASE_PRICE_MILLI_COIN[commodityId] * pricePressureBps / 10_000));
    shortages.push(Math.max(0, 10_000 - region.coverageBps[commodityId]));
  }
  const shortagePressure = Math.floor(shortages.reduce((total, value) => total + value, 0) / shortages.length);
  region.publicHealthBps = boundedBps(region.publicHealthBps
    + (shortagePressure === 0 ? 80 : -Math.ceil(shortagePressure / 30))
    - Math.ceil(region.conflictPressureBps / 100)
    + Math.floor(civicSupportBps / 200));
  region.securityBps = boundedBps(region.securityBps
    + (region.conflictPressureBps === 0 ? 60 : -Math.ceil(region.conflictPressureBps / 80))
    - Math.ceil(region.unrestBps / 250)
    + Math.floor(civicSupportBps / 160));
  region.unrestBps = boundedBps(region.unrestBps
    + Math.ceil(shortagePressure / 40)
    + Math.ceil(region.conflictPressureBps / 100)
    - Math.ceil(region.securityBps / 300)
    - Math.floor(civicSupportBps / 150));
}

function shipmentCapacity(route: EpochWorldSimulationRouteState, elapsedWorldMinutes: number) {
  const modeMultiplier = route.mode.some((mode) => /rail|shuttle|tug|submersible|elevator/u.test(mode))
    ? 5
    : route.mode.some((mode) => /road|convoy|causeway/u.test(mode))
      ? 3
      : 1;
  return Math.max(1_000, Math.floor(250_000 * modeMultiplier * elapsedWorldMinutes / 1_440));
}

function targetStock(region: MutableRegion, commodityId: EpochWorldCommodityId, days: number) {
  return dailyNeed(region.population, commodityId, region.conflictPressureBps > 0) * days;
}

function scheduleDirection(
  route: EpochWorldSimulationRouteState,
  from: MutableRegion,
  to: MutableRegion,
  commodityId: EpochWorldCommodityId,
  toWorldMinute: number,
  elapsedWorldMinutes: number,
  commandHash: string,
) {
  if (!from.persistent || !to.persistent || from.population === 0 || to.population === 0) return undefined;
  if (from.coverageBps[commodityId] < 15_000 || to.coverageBps[commodityId] >= 8_000) return undefined;
  const surplus = Math.max(0, from.stocks[commodityId] - targetStock(from, commodityId, 5));
  const deficit = Math.max(0, targetStock(to, commodityId, 5) - to.stocks[commodityId]);
  const unitPriceMilliCoin = Math.max(1, Math.floor(
    (from.priceMilliCoin[commodityId] + to.priceMilliCoin[commodityId]) / 2,
  ));
  const affordableAmount = Math.floor(to.treasuryCoin * 1_000_000 / unitPriceMilliCoin);
  const amount = Math.min(surplus, deficit, shipmentCapacity(route, elapsedWorldMinutes), affordableAmount);
  if (amount <= 0) return undefined;
  const paidCoin = Math.floor(amount * unitPriceMilliCoin / 1_000_000);
  if (paidCoin <= 0) return undefined;
  from.stocks[commodityId] -= amount;
  to.treasuryCoin -= paidCoin;
  from.treasuryCoin += paidCoin;
  from.lastFlows.exported[commodityId] += amount;
  to.lastFlows.tradeCoinPaid += paidCoin;
  from.lastFlows.tradeCoinReceived += paidCoin;
  return {
    shipmentId: `shipment_${createHash("sha256")
      .update(`${commandHash}:${route.routeId}:${from.regionId}:${to.regionId}:${commodityId}:${toWorldMinute}`)
      .digest("hex")
      .slice(0, 24)}`,
    routeId: route.routeId,
    fromRegionId: from.regionId,
    toRegionId: to.regionId,
    commodityId,
    amount,
    unitPriceMilliCoin,
    paidCoin,
    departedWorldMinute: toWorldMinute,
    arrivesWorldMinute: toWorldMinute + route.baseMinutes,
  } satisfies EpochWorldShipment;
}

function conflictCause(value: unknown): EpochWorldConflictCause {
  const cause = assertText(value, "world_simulation_conflict_cause_invalid") as EpochWorldConflictCause;
  if (!EPOCH_WORLD_CONFLICT_CAUSES.includes(cause)) {
    throw new Error(`world_simulation_conflict_cause_invalid:${cause}`);
  }
  return cause;
}

function normalizeSignals(value: EpochWorldSimulationSignals | undefined): EpochWorldSimulationSignals {
  const regions = [...(value?.regions || [])].map((signal) => {
    const regionId = assertText(signal.regionId, "world_simulation_signal_region_invalid");
    const legacyFactionIds = normalizedStrings(signal.conflictFactionIds);
    const conflictEvidence = [...(signal.conflictEvidence || [])].map((evidence) => {
      const factionIds = normalizedStrings(evidence.factionIds);
      if (factionIds.length < 2) throw new Error("world_simulation_conflict_factions_required");
      return {
        evidenceId: assertText(evidence.evidenceId, "world_simulation_conflict_evidence_id_invalid"),
        cause: conflictCause(evidence.cause),
        factionIds,
        pressureBps: positiveWhole(
          boundedBps(Number(evidence.pressureBps)),
          "world_simulation_conflict_pressure_invalid",
        ),
      };
    });
    if (conflictEvidence.length === 0 && legacyFactionIds.length >= 2) {
      conflictEvidence.push({
        evidenceId: `structured:${regionId}:${legacyFactionIds.join(":")}`,
        cause: "structured_conflict_signal",
        factionIds: legacyFactionIds,
        pressureBps: 7_000,
      });
    }
    conflictEvidence.sort((left, right) =>
      left.evidenceId.localeCompare(right.evidenceId) || left.cause.localeCompare(right.cause));
    const evidenceIds = new Set<string>();
    for (const evidence of conflictEvidence) {
      if (evidenceIds.has(evidence.evidenceId)) {
        throw new Error(`world_simulation_conflict_evidence_duplicate:${evidence.evidenceId}`);
      }
      evidenceIds.add(evidence.evidenceId);
    }
    return {
      regionId,
      ...(signal.controllerFactionId ? {
        controllerFactionId: assertText(signal.controllerFactionId, "world_simulation_signal_controller_invalid"),
      } : {}),
      conflictFactionIds: normalizedStrings([
        ...legacyFactionIds,
        ...conflictEvidence.flatMap((evidence) => evidence.factionIds),
      ]),
      conflictEvidence,
      anomalyPressureBps: boundedBps(Number(signal.anomalyPressureBps || 0)),
      contestedResourceNodes: nonNegativeWhole(
        Math.floor(Number(signal.contestedResourceNodes || 0)),
        "world_simulation_signal_resource_nodes_invalid",
      ),
      openMarketOrders: nonNegativeWhole(
        Math.floor(Number(signal.openMarketOrders || 0)),
        "world_simulation_signal_market_orders_invalid",
      ),
      civicSupportBps: boundedBps(Number(signal.civicSupportBps || 0)),
    };
  }).sort((left, right) => left.regionId.localeCompare(right.regionId));
  const regionIds = new Set<string>();
  for (const signal of regions) {
    if (regionIds.has(signal.regionId)) throw new Error(`world_simulation_signal_region_duplicate:${signal.regionId}`);
    regionIds.add(signal.regionId);
  }
  return { regions };
}

function worldConflictId(regionId: string, factionIds: readonly string[]) {
  return `world_conflict_${createHash("sha256")
    .update(`${regionId}:${factionIds.join(":")}`)
    .digest("hex")
    .slice(0, 24)}`;
}

function conflictPhase(intensityBps: number): EpochWorldConflictPhase {
  if (intensityBps >= 8_000) return "war";
  if (intensityBps >= 4_000) return "hostilities";
  return "tension";
}

function updateConflicts(
  previous: readonly EpochWorldConflictState[],
  signals: EpochWorldSimulationSignals,
  elapsedWorldMinutes: number,
  toWorldMinute: number,
) {
  const previousByKey = new Map(previous.map((conflict) => [
    `${conflict.regionId}:${conflict.factionIds.join(":")}`,
    conflict,
  ]));
  const evidenceByKey = new Map<string, {
    regionId: string;
    factionIds: readonly string[];
    causes: Set<EpochWorldConflictCause>;
    evidenceIds: Set<string>;
    pressureBps: number;
  }>();
  for (const signal of signals.regions) {
    for (const evidence of signal.conflictEvidence || []) {
      const key = `${signal.regionId}:${evidence.factionIds.join(":")}`;
      const group = evidenceByKey.get(key) || {
        regionId: signal.regionId,
        factionIds: evidence.factionIds,
        causes: new Set<EpochWorldConflictCause>(),
        evidenceIds: new Set<string>(),
        pressureBps: 0,
      };
      group.causes.add(evidence.cause);
      group.evidenceIds.add(evidence.evidenceId);
      group.pressureBps = boundedBps(group.pressureBps + evidence.pressureBps);
      evidenceByKey.set(key, group);
    }
  }
  const next: EpochWorldConflictState[] = [];
  for (const [key, evidence] of [...evidenceByKey.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    const existing = previousByKey.get(key);
    const accumulated = existing
      ? existing.intensityBps + Math.max(1, Math.floor(evidence.pressureBps * elapsedWorldMinutes / 2_880))
      : evidence.pressureBps;
    const intensityBps = boundedBps(Math.max(evidence.pressureBps, accumulated));
    next.push({
      conflictId: existing?.conflictId || worldConflictId(evidence.regionId, evidence.factionIds),
      regionId: evidence.regionId,
      factionIds: evidence.factionIds,
      causes: normalizedStrings([...(existing?.causes || []), ...evidence.causes]) as readonly EpochWorldConflictCause[],
      evidenceIds: normalizedStrings([...evidence.evidenceIds]),
      intensityBps,
      phase: conflictPhase(intensityBps),
      startedWorldMinute: existing?.startedWorldMinute ?? toWorldMinute,
      updatedWorldMinute: toWorldMinute,
    });
    previousByKey.delete(key);
  }
  const decay = Math.max(250, Math.floor(1_000 * elapsedWorldMinutes / 1_440));
  for (const existing of previousByKey.values()) {
    const intensityBps = Math.max(0, existing.intensityBps - decay);
    if (intensityBps < 1_000) continue;
    next.push({
      ...existing,
      evidenceIds: [],
      intensityBps,
      phase: conflictPhase(intensityBps),
      updatedWorldMinute: toWorldMinute,
    });
  }
  return next.sort((left, right) => left.conflictId.localeCompare(right.conflictId));
}

function updateFactions(
  previous: readonly EpochWorldFactionSimulationState[],
  regions: readonly MutableRegion[],
  conflicts: readonly EpochWorldConflictState[],
) {
  const conflictFactionRegions = new Map<string, Set<string>>();
  for (const conflict of conflicts) {
    for (const factionId of conflict.factionIds) {
      const regionIds = conflictFactionRegions.get(factionId) || new Set<string>();
      regionIds.add(conflict.regionId);
      conflictFactionRegions.set(factionId, regionIds);
    }
  }
  let factionTaxCoinTransferred = 0;
  let factionSubsidyCoinTransferred = 0;
  const factions = previous.map((faction): EpochWorldFactionSimulationState => {
    const controlledRegions = regions.filter((region) => region.controllerFactionId === faction.factionId);
    const conflictRegionIds = [...(conflictFactionRegions.get(faction.factionId) || [])].sort();
    const averageLogistics = controlledRegions.length > 0
      ? Math.floor(controlledRegions.reduce((total, region) => total + region.facilities.logisticsBps, 0) / controlledRegions.length)
      : faction.logisticsBps;
    const averageSecurity = controlledRegions.length > 0
      ? Math.floor(controlledRegions.reduce((total, region) => total + region.securityBps, 0) / controlledRegions.length)
      : faction.legitimacyBps;
    const engaged = conflictRegionIds.length > 0;
    const warExhaustionBps = boundedBps(faction.warExhaustionBps + (engaged ? 120 : -80));
    let treasuryCoin = faction.treasuryCoin;
    for (const region of controlledRegions) {
      const tax = Math.min(region.treasuryCoin, Math.floor(region.lastFlows.tradeCoinReceived * 500 / 10_000));
      region.treasuryCoin -= tax;
      treasuryCoin += tax;
      region.lastFlows.factionTaxPaid += tax;
      factionTaxCoinTransferred += tax;
    }
    const shortageRegions = controlledRegions
      .filter((region) => EPOCH_WORLD_COMMODITY_IDS.some((commodityId) => region.coverageBps[commodityId] < 7_500))
      .sort((left, right) => left.regionId.localeCompare(right.regionId));
    for (const region of shortageRegions) {
      const unmetValue = EPOCH_WORLD_COMMODITY_IDS.reduce((total, commodityId) =>
        total + Math.floor(region.lastFlows.unmet[commodityId] * region.priceMilliCoin[commodityId] / 1_000_000), 0);
      const subsidy = Math.min(treasuryCoin, Math.max(0, Math.min(unmetValue, Math.floor(treasuryCoin / 100))));
      treasuryCoin -= subsidy;
      region.treasuryCoin += subsidy;
      region.lastFlows.factionSubsidyReceived += subsidy;
      factionSubsidyCoinTransferred += subsidy;
    }
    return {
      ...faction,
      treasuryCoin,
      logisticsBps: boundedBps((faction.logisticsBps * 3 + averageLogistics) / 4),
      militaryReadinessBps: boundedBps(faction.militaryReadinessBps + (engaged ? 100 : -40) - Math.ceil(warExhaustionBps / 250)),
      legitimacyBps: boundedBps((faction.legitimacyBps * 4 + averageSecurity) / 5 - Math.ceil(warExhaustionBps / 400)),
      warExhaustionBps,
      controlledRegionIds: controlledRegions.map((region) => region.regionId).sort(),
      conflictRegionIds,
      status: engaged ? "conflict_engaged" : controlledRegions.some((region) => region.conflictPressureBps > 0) ? "mobilizing" : "operating",
    };
  }).sort((left, right) => left.factionId.localeCompare(right.factionId));
  return { factions, factionTaxCoinTransferred, factionSubsidyCoinTransferred };
}

function advanceSnapshotV1(
  previous: EpochWorldSimulationSnapshot,
  input: AdvanceEpochWorldSimulationInput,
  signals: EpochWorldSimulationSignals,
  commandHash: `sha256:${string}`,
) {
  const elapsedWorldMinutes = input.toWorldMinute - input.fromWorldMinute;
  const knownRegionIds = new Set(previous.regions.map((region) => region.regionId));
  const knownFactionIds = new Set(previous.factions.map((faction) => faction.factionId));
  for (const signal of signals.regions) {
    if (!knownRegionIds.has(signal.regionId)) {
      throw new Error(`world_simulation_signal_region_unknown:${signal.regionId}`);
    }
    if (signal.controllerFactionId && !knownFactionIds.has(signal.controllerFactionId)) {
      throw new Error(`world_simulation_signal_controller_unknown:${signal.controllerFactionId}`);
    }
    for (const factionId of signal.conflictFactionIds || []) {
      if (!knownFactionIds.has(factionId)) {
        throw new Error(`world_simulation_signal_faction_unknown:${factionId}`);
      }
    }
  }
  const conflicts = updateConflicts(previous.conflicts, signals, elapsedWorldMinutes, input.toWorldMinute);
  const conflictIntensityByRegion = new Map<string, number>();
  for (const conflict of conflicts) {
    conflictIntensityByRegion.set(
      conflict.regionId,
      Math.max(conflictIntensityByRegion.get(conflict.regionId) || 0, conflict.intensityBps),
    );
  }
  const regions = previous.regions.map(mutableRegion);
  const regionsById = new Map(regions.map((region) => [region.regionId, region]));
  const signalsByRegion = new Map(signals.regions.map((signal) => [signal.regionId, signal]));
  const arrivedShipments: EpochWorldShipment[] = [];
  const shipments: EpochWorldShipment[] = [];
  for (const shipment of previous.shipments) {
    if (shipment.arrivesWorldMinute > input.toWorldMinute) {
      shipments.push(shipment);
      continue;
    }
    const destination = regionsById.get(shipment.toRegionId);
    if (!destination) throw new Error(`world_simulation_shipment_destination_missing:${shipment.shipmentId}`);
    destination.stocks[shipment.commodityId] += shipment.amount;
    destination.lastFlows.imported[shipment.commodityId] += shipment.amount;
    arrivedShipments.push(shipment);
  }
  for (const region of regions) {
    const signal = signalsByRegion.get(region.regionId);
    if (signal?.controllerFactionId) region.controllerFactionId = signal.controllerFactionId;
    const conflictIntensityBps = conflictIntensityByRegion.get(region.regionId) || 0;
    const conflict = conflictIntensityBps > 0;
    applyProduction(region, elapsedWorldMinutes);
    applyPopulationNeeds(region, elapsedWorldMinutes, conflict);
    updateRegionIndicators(region, signal, conflictIntensityBps);
  }
  const departedShipments: EpochWorldShipment[] = [];
  for (const route of previous.routes) {
    const from = regionsById.get(route.fromRegionId);
    const to = regionsById.get(route.toRegionId);
    if (!from || !to) throw new Error(`world_simulation_route_region_missing:${route.routeId}`);
    for (const commodityId of EPOCH_WORLD_COMMODITY_IDS) {
      const forward = scheduleDirection(route, from, to, commodityId, input.toWorldMinute, elapsedWorldMinutes, commandHash);
      if (forward) {
        shipments.push(forward);
        departedShipments.push(forward);
        continue;
      }
      if (!route.bidirectional) continue;
      const reverse = scheduleDirection(route, to, from, commodityId, input.toWorldMinute, elapsedWorldMinutes, commandHash);
      if (reverse) {
        shipments.push(reverse);
        departedShipments.push(reverse);
      }
    }
  }
  const factionUpdate = updateFactions(previous.factions, regions, conflicts);
  const factionStates = factionUpdate.factions;
  const immutableRegions = regions
    .map((region): EpochWorldRegionSimulationState => ({ ...region }))
    .sort((left, right) => left.regionId.localeCompare(right.regionId));
  const orderedShipments = shipments.sort((left, right) =>
    left.arrivesWorldMinute - right.arrivesWorldMinute || left.shipmentId.localeCompare(right.shipmentId));
  const produced = emptyLedger();
  const consumed = emptyLedger();
  for (const region of immutableRegions) {
    addLedger(produced, region.lastFlows.produced);
    addLedger(consumed, region.lastFlows.consumed);
  }
  const flows: EpochWorldSimulationFlowSummary = {
    produced,
    consumed,
    lost: emptyLedger(),
    departedShipments: departedShipments.sort((left, right) => left.shipmentId.localeCompare(right.shipmentId)),
    arrivedShipments: arrivedShipments.sort((left, right) => left.shipmentId.localeCompare(right.shipmentId)),
    tradeCoinTransferred: departedShipments.reduce((total, shipment) => total + shipment.paidCoin, 0),
    factionTaxCoinTransferred: factionUpdate.factionTaxCoinTransferred,
    factionSubsidyCoinTransferred: factionUpdate.factionSubsidyCoinTransferred,
    conflictRegionIds: normalizedStrings(conflicts.map((conflict) => conflict.regionId)),
  };
  const next = snapshotWithHash({
    simulationId: EPOCH_WORLD_SIMULATION_ID,
    initialized: true,
    worldMinute: input.toWorldMinute,
    worldContentSourceHash: previous.worldContentSourceHash,
    regions: immutableRegions,
    factions: factionStates,
    routes: previous.routes,
    conflicts,
    shipments: orderedShipments,
    commodityTotals: commodityTotals(immutableRegions, orderedShipments),
    totalCoin: totalCoin(immutableRegions, factionStates),
    version: previous.version + 1,
  });
  for (const commodityId of EPOCH_WORLD_COMMODITY_IDS) {
    const expected = previous.commodityTotals[commodityId]
      + produced[commodityId]
      - consumed[commodityId]
      - flows.lost[commodityId];
    if (next.commodityTotals[commodityId] !== expected) {
      throw new Error(`world_simulation_commodity_conservation_failed:${commodityId}`);
    }
  }
  if (next.totalCoin !== previous.totalCoin) throw new Error("world_simulation_coin_conservation_failed");
  return { snapshot: next, flows };
}

function crossesWorldDay(fromWorldMinute: number, toWorldMinute: number) {
  return Math.floor(fromWorldMinute / 1_440) !== Math.floor(toWorldMinute / 1_440);
}

function updateRegionIndicatorsV2(
  region: MutableRegion,
  signal: EpochWorldSimulationRegionSignal | undefined,
  conflictIntensityBps: number,
  applyDailyChanges: boolean,
) {
  const conflict = conflictIntensityBps > 0;
  const anomalyPressure = boundedBps(Number(signal?.anomalyPressureBps || 0));
  const marketLiquidityBps = Math.min(2_500, nonNegativeWhole(
    Math.floor(Number(signal?.openMarketOrders || 0)),
    "world_simulation_market_orders_invalid",
  ) * 125);
  const contestedPressure = Math.min(2_000, nonNegativeWhole(
    Math.floor(Number(signal?.contestedResourceNodes || 0)),
    "world_simulation_contested_nodes_invalid",
  ) * 400);
  const civicSupportBps = boundedBps(Number(signal?.civicSupportBps || 0));
  const externalPressure = boundedBps(anomalyPressure + contestedPressure);
  region.conflictPressureBps = conflict
    ? Math.max(region.conflictPressureBps, boundedBps(conflictIntensityBps + contestedPressure))
    : applyDailyChanges
      ? boundedBps(region.conflictPressureBps * 0.85 + externalPressure)
      : Math.max(region.conflictPressureBps, externalPressure);
  if (signal?.controllerFactionId) region.controllerFactionId = signal.controllerFactionId;
  const shortages: number[] = [];
  for (const commodityId of EPOCH_WORLD_COMMODITY_IDS) {
    const need = dailyNeed(region.population, commodityId, conflict);
    region.coverageBps[commodityId] = need > 0
      ? coverageBps((region.stocks[commodityId] * 10_000) / (need * 5))
      : 10_000;
    const rawPricePressureBps = Math.max(
      5_000,
      Math.min(50_000, Math.floor(100_000_000 / Math.max(2_000, region.coverageBps[commodityId]))),
    );
    const pricePressureBps = rawPricePressureBps > 10_000
      ? Math.max(10_000, rawPricePressureBps - marketLiquidityBps)
      : Math.min(10_000, rawPricePressureBps + marketLiquidityBps);
    region.priceMilliCoin[commodityId] = Math.max(
      1,
      Math.floor(BASE_PRICE_MILLI_COIN[commodityId] * pricePressureBps / 10_000),
    );
    shortages.push(Math.max(0, 10_000 - region.coverageBps[commodityId]));
  }
  if (!applyDailyChanges) return;
  const shortagePressure = Math.floor(
    shortages.reduce((total, value) => total + value, 0) / shortages.length,
  );
  region.publicHealthBps = boundedBps(region.publicHealthBps
    + (shortagePressure === 0 ? 80 : -Math.ceil(shortagePressure / 30))
    - Math.ceil(region.conflictPressureBps / 100)
    + Math.floor(civicSupportBps / 200));
  region.securityBps = boundedBps(region.securityBps
    + (region.conflictPressureBps === 0 ? 60 : -Math.ceil(region.conflictPressureBps / 80))
    - Math.ceil(region.unrestBps / 250)
    + Math.floor(civicSupportBps / 160));
  region.unrestBps = boundedBps(region.unrestBps
    + Math.ceil(shortagePressure / 40)
    + Math.ceil(region.conflictPressureBps / 100)
    - Math.ceil(region.securityBps / 300)
    - Math.floor(civicSupportBps / 150));
}

function updateConflictsV2(
  previous: readonly EpochWorldConflictState[],
  signals: EpochWorldSimulationSignals,
  elapsedWorldMinutes: number,
  toWorldMinute: number,
) {
  const previousByKey = new Map(previous.map((conflict) => [
    `${conflict.regionId}:${conflict.factionIds.join(":")}`,
    conflict,
  ]));
  const evidenceByKey = new Map<string, {
    regionId: string;
    factionIds: readonly string[];
    causes: Set<EpochWorldConflictCause>;
    evidenceIds: Set<string>;
    pressureBps: number;
  }>();
  for (const signal of signals.regions) {
    for (const evidence of signal.conflictEvidence || []) {
      const key = `${signal.regionId}:${evidence.factionIds.join(":")}`;
      const group = evidenceByKey.get(key) || {
        regionId: signal.regionId,
        factionIds: evidence.factionIds,
        causes: new Set<EpochWorldConflictCause>(),
        evidenceIds: new Set<string>(),
        pressureBps: 0,
      };
      group.causes.add(evidence.cause);
      group.evidenceIds.add(evidence.evidenceId);
      group.pressureBps = boundedBps(group.pressureBps + evidence.pressureBps);
      evidenceByKey.set(key, group);
    }
  }
  const next: EpochWorldConflictState[] = [];
  for (const [key, evidence] of [...evidenceByKey.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    const existing = previousByKey.get(key);
    const pressureNumerator = evidence.pressureBps * elapsedWorldMinutes
      + (existing?.pressureAccumulationRemainder || 0);
    const accumulated = (existing?.intensityBps ?? evidence.pressureBps)
      + Math.floor(pressureNumerator / 2_880);
    const intensityBps = boundedBps(Math.max(evidence.pressureBps, accumulated));
    next.push({
      conflictId: existing?.conflictId || worldConflictId(evidence.regionId, evidence.factionIds),
      regionId: evidence.regionId,
      factionIds: evidence.factionIds,
      causes: normalizedStrings([
        ...(existing?.causes || []),
        ...evidence.causes,
      ]) as readonly EpochWorldConflictCause[],
      evidenceIds: normalizedStrings([...evidence.evidenceIds]),
      intensityBps,
      pressureAccumulationRemainder: pressureNumerator % 2_880,
      decayRemainder: 0,
      phase: conflictPhase(intensityBps),
      startedWorldMinute: existing?.startedWorldMinute ?? toWorldMinute - elapsedWorldMinutes,
      updatedWorldMinute: toWorldMinute,
    });
    previousByKey.delete(key);
  }
  for (const existing of previousByKey.values()) {
    const decayNumerator = 1_000 * elapsedWorldMinutes + (existing.decayRemainder || 0);
    const decay = Math.floor(decayNumerator / 1_440);
    const intensityBps = Math.max(0, existing.intensityBps - decay);
    if (intensityBps < 1_000) continue;
    next.push({
      ...existing,
      evidenceIds: [],
      intensityBps,
      decayRemainder: decayNumerator % 1_440,
      phase: conflictPhase(intensityBps),
      updatedWorldMinute: toWorldMinute,
    });
  }
  return next.sort((left, right) => left.conflictId.localeCompare(right.conflictId));
}

function updateFactionsV2(
  previous: readonly EpochWorldFactionSimulationState[],
  regions: readonly MutableRegion[],
  conflicts: readonly EpochWorldConflictState[],
  applyDailyChanges: boolean,
) {
  const conflictFactionRegions = new Map<string, Set<string>>();
  for (const conflict of conflicts) {
    for (const factionId of conflict.factionIds) {
      const regionIds = conflictFactionRegions.get(factionId) || new Set<string>();
      regionIds.add(conflict.regionId);
      conflictFactionRegions.set(factionId, regionIds);
    }
  }
  let factionTaxCoinTransferred = 0;
  let factionSubsidyCoinTransferred = 0;
  const factions = previous.map((faction): EpochWorldFactionSimulationState => {
    const controlledRegions = regions.filter((region) => region.controllerFactionId === faction.factionId);
    const conflictRegionIds = [...(conflictFactionRegions.get(faction.factionId) || [])].sort();
    const averageLogistics = controlledRegions.length > 0
      ? Math.floor(controlledRegions.reduce(
        (total, region) => total + region.facilities.logisticsBps,
        0,
      ) / controlledRegions.length)
      : faction.logisticsBps;
    const averageSecurity = controlledRegions.length > 0
      ? Math.floor(controlledRegions.reduce((total, region) => total + region.securityBps, 0)
        / controlledRegions.length)
      : faction.legitimacyBps;
    const engaged = conflictRegionIds.length > 0;
    const warExhaustionBps = applyDailyChanges
      ? boundedBps(faction.warExhaustionBps + (engaged ? 120 : -80))
      : faction.warExhaustionBps;
    let treasuryCoin = faction.treasuryCoin;
    for (const region of controlledRegions) {
      const tax = Math.min(
        region.treasuryCoin,
        Math.floor(region.lastFlows.tradeCoinReceived * 500 / 10_000),
      );
      region.treasuryCoin -= tax;
      treasuryCoin += tax;
      region.lastFlows.factionTaxPaid += tax;
      factionTaxCoinTransferred += tax;
    }
    const shortageRegions = controlledRegions
      .filter((region) => EPOCH_WORLD_COMMODITY_IDS.some(
        (commodityId) => region.coverageBps[commodityId] < 7_500,
      ))
      .sort((left, right) => left.regionId.localeCompare(right.regionId));
    for (const region of shortageRegions) {
      const unmetValue = EPOCH_WORLD_COMMODITY_IDS.reduce((total, commodityId) =>
        total + Math.floor(
          region.lastFlows.unmet[commodityId] * region.priceMilliCoin[commodityId] / 1_000_000,
        ), 0);
      const subsidy = Math.min(
        treasuryCoin,
        Math.max(0, Math.min(unmetValue, Math.floor(treasuryCoin / 100))),
      );
      treasuryCoin -= subsidy;
      region.treasuryCoin += subsidy;
      region.lastFlows.factionSubsidyReceived += subsidy;
      factionSubsidyCoinTransferred += subsidy;
    }
    return {
      ...faction,
      treasuryCoin,
      logisticsBps: applyDailyChanges
        ? boundedBps((faction.logisticsBps * 3 + averageLogistics) / 4)
        : faction.logisticsBps,
      militaryReadinessBps: applyDailyChanges
        ? boundedBps(
          faction.militaryReadinessBps
            + (engaged ? 100 : -40)
            - Math.ceil(warExhaustionBps / 250),
        )
        : faction.militaryReadinessBps,
      legitimacyBps: applyDailyChanges
        ? boundedBps(
          (faction.legitimacyBps * 4 + averageSecurity) / 5
            - Math.ceil(warExhaustionBps / 400),
        )
        : faction.legitimacyBps,
      warExhaustionBps,
      controlledRegionIds: controlledRegions.map((region) => region.regionId).sort(),
      conflictRegionIds,
      status: engaged
        ? "conflict_engaged"
        : controlledRegions.some((region) => region.conflictPressureBps > 0)
          ? "mobilizing"
          : "operating",
    };
  }).sort((left, right) => left.factionId.localeCompare(right.factionId));
  return { factions, factionTaxCoinTransferred, factionSubsidyCoinTransferred };
}

function validateSimulationSignals(
  previous: EpochWorldSimulationSnapshot,
  signals: EpochWorldSimulationSignals,
) {
  const knownRegionIds = new Set(previous.regions.map((region) => region.regionId));
  const knownFactionIds = new Set(previous.factions.map((faction) => faction.factionId));
  for (const signal of signals.regions) {
    if (!knownRegionIds.has(signal.regionId)) {
      throw new Error(`world_simulation_signal_region_unknown:${signal.regionId}`);
    }
    if (signal.controllerFactionId && !knownFactionIds.has(signal.controllerFactionId)) {
      throw new Error(`world_simulation_signal_controller_unknown:${signal.controllerFactionId}`);
    }
    for (const factionId of signal.conflictFactionIds || []) {
      if (!knownFactionIds.has(factionId)) {
        throw new Error(`world_simulation_signal_faction_unknown:${factionId}`);
      }
    }
  }
}

function advanceMaterialQuantum(
  previous: EpochWorldSimulationSnapshot,
  fromWorldMinute: number,
  toWorldMinute: number,
  signals: EpochWorldSimulationSignals,
) {
  const elapsedWorldMinutes = toWorldMinute - fromWorldMinute;
  const conflicts = updateConflictsV2(
    previous.conflicts,
    signals,
    elapsedWorldMinutes,
    toWorldMinute,
  );
  const conflictIntensityByRegion = new Map<string, number>();
  for (const conflict of conflicts) {
    conflictIntensityByRegion.set(
      conflict.regionId,
      Math.max(conflictIntensityByRegion.get(conflict.regionId) || 0, conflict.intensityBps),
    );
  }
  const regions = previous.regions.map(mutableRegion);
  const regionsById = new Map(regions.map((region) => [region.regionId, region]));
  const signalsByRegion = new Map(signals.regions.map((signal) => [signal.regionId, signal]));
  const arrivedShipments: EpochWorldShipment[] = [];
  const shipments: EpochWorldShipment[] = [];
  for (const shipment of previous.shipments) {
    if (shipment.arrivesWorldMinute > toWorldMinute) {
      shipments.push(shipment);
      continue;
    }
    const destination = regionsById.get(shipment.toRegionId);
    if (!destination) {
      throw new Error(`world_simulation_shipment_destination_missing:${shipment.shipmentId}`);
    }
    destination.stocks[shipment.commodityId] += shipment.amount;
    destination.lastFlows.imported[shipment.commodityId] += shipment.amount;
    arrivedShipments.push(shipment);
  }
  const applyDailyChanges = crossesWorldDay(fromWorldMinute, toWorldMinute);
  for (const region of regions) {
    const signal = signalsByRegion.get(region.regionId);
    if (signal?.controllerFactionId) region.controllerFactionId = signal.controllerFactionId;
    const conflictIntensityBps = conflictIntensityByRegion.get(region.regionId) || 0;
    applyProduction(region, elapsedWorldMinutes);
    applyPopulationNeeds(region, elapsedWorldMinutes, conflictIntensityBps > 0);
    updateRegionIndicatorsV2(region, signal, conflictIntensityBps, applyDailyChanges);
  }
  const departedShipments: EpochWorldShipment[] = [];
  const shipmentSeed = `${EPOCH_WORLD_SIMULATION_RULE_VERSION}:${previous.worldContentSourceHash}`;
  for (const route of previous.routes) {
    const from = regionsById.get(route.fromRegionId);
    const to = regionsById.get(route.toRegionId);
    if (!from || !to) throw new Error(`world_simulation_route_region_missing:${route.routeId}`);
    for (const commodityId of EPOCH_WORLD_COMMODITY_IDS) {
      const forward = scheduleDirection(
        route,
        from,
        to,
        commodityId,
        toWorldMinute,
        elapsedWorldMinutes,
        shipmentSeed,
      );
      if (forward) {
        shipments.push(forward);
        departedShipments.push(forward);
        continue;
      }
      if (!route.bidirectional) continue;
      const reverse = scheduleDirection(
        route,
        to,
        from,
        commodityId,
        toWorldMinute,
        elapsedWorldMinutes,
        shipmentSeed,
      );
      if (reverse) {
        shipments.push(reverse);
        departedShipments.push(reverse);
      }
    }
  }
  const factionUpdate = updateFactionsV2(
    previous.factions,
    regions,
    conflicts,
    applyDailyChanges,
  );
  const immutableRegions = regions
    .map((region): EpochWorldRegionSimulationState => ({ ...region }))
    .sort((left, right) => left.regionId.localeCompare(right.regionId));
  const orderedShipments = shipments.sort((left, right) =>
    left.arrivesWorldMinute - right.arrivesWorldMinute
      || left.shipmentId.localeCompare(right.shipmentId));
  const produced = emptyLedger();
  const consumed = emptyLedger();
  for (const region of immutableRegions) {
    addLedger(produced, region.lastFlows.produced);
    addLedger(consumed, region.lastFlows.consumed);
  }
  const flows: EpochWorldSimulationFlowSummary = {
    produced,
    consumed,
    lost: emptyLedger(),
    departedShipments: departedShipments.sort(
      (left, right) => left.shipmentId.localeCompare(right.shipmentId),
    ),
    arrivedShipments: arrivedShipments.sort(
      (left, right) => left.shipmentId.localeCompare(right.shipmentId),
    ),
    tradeCoinTransferred: departedShipments.reduce(
      (total, shipment) => total + shipment.paidCoin,
      0,
    ),
    factionTaxCoinTransferred: factionUpdate.factionTaxCoinTransferred,
    factionSubsidyCoinTransferred: factionUpdate.factionSubsidyCoinTransferred,
    conflictRegionIds: normalizedStrings(conflicts.map((conflict) => conflict.regionId)),
  };
  const next = snapshotWithHash({
    simulationId: EPOCH_WORLD_SIMULATION_ID,
    initialized: true,
    worldMinute: toWorldMinute,
    materializedWorldMinute: toWorldMinute,
    worldContentSourceHash: previous.worldContentSourceHash,
    regions: immutableRegions,
    factions: factionUpdate.factions,
    routes: previous.routes,
    conflicts,
    shipments: orderedShipments,
    commodityTotals: commodityTotals(immutableRegions, orderedShipments),
    totalCoin: totalCoin(immutableRegions, factionUpdate.factions),
    version: previous.version,
  });
  for (const commodityId of EPOCH_WORLD_COMMODITY_IDS) {
    const expected = previous.commodityTotals[commodityId]
      + produced[commodityId]
      - consumed[commodityId]
      - flows.lost[commodityId];
    if (next.commodityTotals[commodityId] !== expected) {
      throw new Error(`world_simulation_commodity_conservation_failed:${commodityId}`);
    }
  }
  if (next.totalCoin !== previous.totalCoin) throw new Error("world_simulation_coin_conservation_failed");
  return { snapshot: next, flows };
}

function advanceSnapshot(
  previous: EpochWorldSimulationSnapshot,
  input: AdvanceEpochWorldSimulationInput,
  signals: EpochWorldSimulationSignals,
  _commandHash: `sha256:${string}`,
) {
  if (input.fromWorldMinute !== previous.worldMinute) {
    throw new Error(`world_simulation_clock_mismatch:${previous.worldMinute}:${input.fromWorldMinute}`);
  }
  validateSimulationSignals(previous, signals);
  const produced = emptyLedger();
  const consumed = emptyLedger();
  const lost = emptyLedger();
  const departedShipmentAccumulator = createShipmentFlowAccumulator();
  const arrivedShipmentAccumulator = createShipmentFlowAccumulator();
  let tradeCoinTransferred = 0;
  let factionTaxCoinTransferred = 0;
  let factionSubsidyCoinTransferred = 0;
  let materializedWorldMinute = previous.materializedWorldMinute ?? previous.worldMinute;
  let materialState = previous;
  let conflictRegionIds = normalizedStrings(previous.conflicts.map((conflict) => conflict.regionId));
  while (materializedWorldMinute + EPOCH_WORLD_SIMULATION_QUANTUM_MINUTES <= input.toWorldMinute) {
    const nextMaterializedWorldMinute = materializedWorldMinute
      + EPOCH_WORLD_SIMULATION_QUANTUM_MINUTES;
    const step = advanceMaterialQuantum(
      materialState,
      materializedWorldMinute,
      nextMaterializedWorldMinute,
      signals,
    );
    addLedger(produced, step.flows.produced);
    addLedger(consumed, step.flows.consumed);
    addLedger(lost, step.flows.lost);
    departedShipmentAccumulator.add(step.flows.departedShipments);
    arrivedShipmentAccumulator.add(step.flows.arrivedShipments);
    tradeCoinTransferred += step.flows.tradeCoinTransferred;
    factionTaxCoinTransferred += step.flows.factionTaxCoinTransferred;
    factionSubsidyCoinTransferred += step.flows.factionSubsidyCoinTransferred;
    conflictRegionIds = step.flows.conflictRegionIds;
    materializedWorldMinute = nextMaterializedWorldMinute;
    materialState = step.snapshot;
  }
  const orderedShipments = [...materialState.shipments].sort((left, right) =>
    left.arrivesWorldMinute - right.arrivesWorldMinute
      || left.shipmentId.localeCompare(right.shipmentId));
  const next = snapshotWithHash({
    simulationId: EPOCH_WORLD_SIMULATION_ID,
    initialized: true,
    worldMinute: input.toWorldMinute,
    materializedWorldMinute,
    worldContentSourceHash: previous.worldContentSourceHash,
    regions: materialState.regions,
    factions: materialState.factions,
    routes: materialState.routes,
    conflicts: materialState.conflicts,
    shipments: orderedShipments,
    commodityTotals: materialState.commodityTotals,
    totalCoin: materialState.totalCoin,
    version: previous.version + 1,
  });
  const departedShipmentFlow = departedShipmentAccumulator.finish();
  const arrivedShipmentFlow = arrivedShipmentAccumulator.finish();
  const flows: EpochWorldSimulationFlowSummary = {
    produced,
    consumed,
    lost,
    departedShipments: departedShipmentFlow.samples.sort(
      (left, right) => left.departedWorldMinute - right.departedWorldMinute
        || left.shipmentId.localeCompare(right.shipmentId),
    ),
    arrivedShipments: arrivedShipmentFlow.samples.sort(
      (left, right) => left.arrivesWorldMinute - right.arrivesWorldMinute
        || left.shipmentId.localeCompare(right.shipmentId),
    ),
    departedShipmentCount: departedShipmentFlow.count,
    arrivedShipmentCount: arrivedShipmentFlow.count,
    departedShipmentsHash: departedShipmentFlow.hash,
    arrivedShipmentsHash: arrivedShipmentFlow.hash,
    shipmentSamplesTruncated: departedShipmentFlow.count > departedShipmentFlow.samples.length
      || arrivedShipmentFlow.count > arrivedShipmentFlow.samples.length,
    tradeCoinTransferred,
    factionTaxCoinTransferred,
    factionSubsidyCoinTransferred,
    conflictRegionIds,
  };
  for (const commodityId of EPOCH_WORLD_COMMODITY_IDS) {
    const expected = previous.commodityTotals[commodityId]
      + produced[commodityId]
      - consumed[commodityId]
      - lost[commodityId];
    if (next.commodityTotals[commodityId] !== expected) {
      throw new Error(`world_simulation_commodity_conservation_failed:${commodityId}`);
    }
  }
  if (next.totalCoin !== previous.totalCoin) throw new Error("world_simulation_coin_conservation_failed");
  return { snapshot: next, flows };
}

function commandHash(input: {
  readonly fromWorldMinute: number;
  readonly toWorldMinute: number;
  readonly sourceClockEventId: string;
  readonly sourceEventIds: readonly string[];
  readonly signals: EpochWorldSimulationSignals;
}) {
  return sha256(input);
}

function isoNow(nowReal: () => Date | string): string {
  const value = nowReal();
  const timestamp = value instanceof Date ? value.getTime() : Date.parse(value);
  if (!Number.isFinite(timestamp)) throw new Error("world_simulation_audit_time_invalid");
  return new Date(timestamp).toISOString();
}

export function createEpochWorldSimulationRuntime(options: CreateEpochWorldSimulationRuntimeOptions) {
  const registry = options.registry;
  const idFactory: EpochIdFactory = options.idFactory || ((kind) => `${kind}_world_simulation_${randomUUID()}`);
  const nowReal = options.nowReal || (() => new Date());
  const checkpointInterval = options.checkpointInterval === undefined
    ? 96
    : positiveWhole(options.checkpointInterval, "world_simulation_checkpoint_interval_invalid");
  const simulationEvents: EpochEvent[] = (options.initialEvents || []).filter(simulationEvent);
  let state = uninitializedSnapshot(registry);
  const priorCommands = new Map<string, {
    readonly commandHash: `sha256:${string}`;
    readonly simulation: EpochWorldSimulationSnapshot;
    readonly flows: EpochWorldSimulationFlowSummary;
  }>();
  const priorMigrations = new Map<string, {
    readonly requestHash: `sha256:${string}`;
    readonly result: EpochWorldSimulationContentMigrationResult;
  }>();
  function rebuild() {
    priorCommands.clear();
    priorMigrations.clear();
    let replayedState = uninitializedSnapshot(registry);
    for (const event of simulationEvents) {
      replayedState = projectEpochWorldSimulation([event], registry, replayedState);
      if (event.eventType === "world_simulation_advanced" && event.idempotencyKey) {
        if (priorMigrations.has(event.idempotencyKey)) {
          throw new Error(`world_simulation_idempotency_history_conflict:${event.idempotencyKey}`);
        }
        const existing = priorCommands.get(event.idempotencyKey);
        if (existing && existing.commandHash !== event.payload.commandHash) {
          throw new Error(`world_simulation_idempotency_history_conflict:${event.idempotencyKey}`);
        }
        priorCommands.set(event.idempotencyKey, {
          commandHash: event.payload.commandHash,
          simulation: replayedState,
          flows: event.payload.flows,
        });
        continue;
      }
      if (event.eventType === "world_simulation_content_migrated" && event.idempotencyKey) {
        if (priorCommands.has(event.idempotencyKey) || priorMigrations.has(event.idempotencyKey)) {
          throw new Error(`world_simulation_idempotency_history_conflict:${event.idempotencyKey}`);
        }
        priorMigrations.set(event.idempotencyKey, {
          requestHash: sha256({
            toWorldContentSourceHash: event.payload.toWorldContentSourceHash,
            regionSuccessors: event.payload.regionSuccessors,
            factionSuccessors: event.payload.factionSuccessors,
          }),
          result: {
            simulation: replayedState,
            events: [],
            genesisCommodityDelta: event.payload.genesisCommodityDelta,
            genesisReserveDelta: event.payload.genesisReserveDelta,
            genesisCoinDelta: event.payload.genesisCoinDelta,
            reroutedShipmentCount: event.payload.reroutedShipmentCount,
            forcedArrivalCount: event.payload.forcedArrivalCount,
            duplicate: true,
          },
        });
      }
    }
    state = replayedState;
  }
  rebuild();

  function rollback(eventCount: number) {
    if (!Number.isSafeInteger(eventCount) || eventCount < 0 || eventCount > simulationEvents.length) {
      throw new Error("world_simulation_checkpoint_invalid");
    }
    simulationEvents.splice(eventCount);
    rebuild();
  }

  function context(input: {
    readonly idempotencyKey: string;
    readonly causationId?: string;
    readonly correlationId?: string;
  }, suffix = ""): EpochCommandContext {
    return {
      actorExplorerId: "system-world-simulation",
      trustClass: "system_worker",
      idempotencyKey: `${input.idempotencyKey}${suffix}`,
      causationId: input.causationId,
      correlationId: input.correlationId,
    };
  }

  function apply(events: readonly EpochEvent[]) {
    const nextState = projectEpochWorldSimulation(events, registry, state);
    options.onEvents?.(events);
    simulationEvents.push(...events);
    state = nextState;
  }

  function advance(input: AdvanceEpochWorldSimulationInput): EpochWorldSimulationAdvanceResult {
    const fromWorldMinute = nonNegativeWhole(input.fromWorldMinute, "world_simulation_from_minute_invalid");
    const toWorldMinute = positiveWhole(input.toWorldMinute, "world_simulation_to_minute_invalid");
    if (toWorldMinute <= fromWorldMinute) throw new Error("world_simulation_elapsed_minutes_invalid");
    const sourceClockEventId = assertText(input.sourceClockEventId, "world_simulation_clock_event_required");
    const sourceEventIds = normalizedStrings(input.sourceEventIds);
    const signals = normalizeSignals(input.signals);
    const idempotencyKey = assertText(input.idempotencyKey, "idempotency_key_required");
    const expectedHash = commandHash({
      fromWorldMinute,
      toWorldMinute,
      sourceClockEventId,
      sourceEventIds,
      signals,
    });
    const prior = priorCommands.get(idempotencyKey);
    if (prior) {
      if (prior.commandHash !== expectedHash) throw new Error("idempotency_key_conflict");
      return attachEpochEventsForPersistence({
        simulation: prior.simulation,
        events: [],
        flows: prior.flows,
        duplicate: true,
      }, []);
    }
    if (priorMigrations.has(idempotencyKey)) throw new Error("idempotency_key_conflict");
    if (state.initialized && state.worldMinute !== fromWorldMinute) {
      throw new Error(`world_simulation_clock_mismatch:${state.worldMinute}:${fromWorldMinute}`);
    }
    if (state.initialized && state.worldContentSourceHash !== registry.sourceHash) {
      throw new Error(`world_simulation_content_migration_required:${state.worldContentSourceHash}:${registry.sourceHash}`);
    }
    const createdAt = isoNow(nowReal);
    const events: EpochEvent[] = [];
    if (!state.initialized) {
      const initialized = seedSnapshot(registry, fromWorldMinute);
      const event = createEpochEvent({
        eventType: "world_simulation_initialized",
        aggregateType: "world_simulation",
        aggregateId: EPOCH_WORLD_SIMULATION_ID,
        context: context({ ...input, idempotencyKey }, ":initialize"),
        createdAt,
        idFactory,
        payload: {
          simulationId: EPOCH_WORLD_SIMULATION_ID,
          worldMinute: fromWorldMinute,
          worldContentSourceHash: registry.sourceHash,
          ruleVersion: EPOCH_WORLD_SIMULATION_RULE_VERSION,
          snapshot: initialized,
        },
      });
      events.push(event);
      apply([event]);
    }
    const transition = advanceSnapshot(state, {
      ...input,
      fromWorldMinute,
      toWorldMinute,
      sourceClockEventId,
      sourceEventIds,
      signals,
      idempotencyKey,
    }, signals, expectedHash);
    const checkpoint = transition.snapshot.version % checkpointInterval === 0
      || Math.floor(fromWorldMinute / EPOCH_WORLD_SIMULATION_CHECKPOINT_MINUTES)
        !== Math.floor(toWorldMinute / EPOCH_WORLD_SIMULATION_CHECKPOINT_MINUTES);
    const payload: WorldSimulationAdvancedPayload = {
      simulationId: EPOCH_WORLD_SIMULATION_ID,
      fromWorldMinute,
      toWorldMinute,
      elapsedWorldMinutes: toWorldMinute - fromWorldMinute,
      sourceClockEventId,
      sourceEventIds,
      worldContentSourceHash: registry.sourceHash,
      ruleVersion: EPOCH_WORLD_SIMULATION_RULE_VERSION,
      commandHash: expectedHash,
      previousStateHash: state.stateHash,
      signals,
      nextStateHash: transition.snapshot.stateHash,
      nextVersion: transition.snapshot.version,
      checkpoint,
      ...(checkpoint ? { snapshot: transition.snapshot } : {}),
      flows: transition.flows,
    };
    const advanced = createEpochEvent({
      eventType: "world_simulation_advanced",
      aggregateType: "world_simulation",
      aggregateId: EPOCH_WORLD_SIMULATION_ID,
      context: context({ ...input, idempotencyKey }),
      createdAt,
      idFactory,
      payload,
    });
    events.push(advanced);
    apply([advanced]);
    priorCommands.set(idempotencyKey, {
      commandHash: expectedHash,
      simulation: state,
      flows: transition.flows,
    });
    return attachEpochEventsForPersistence({
      simulation: state,
      events,
      flows: transition.flows,
      duplicate: false,
    }, events);
  }

  function migrateContent(
    input: MigrateEpochWorldSimulationContentInput,
  ): EpochWorldSimulationContentMigrationResult {
    const idempotencyKey = assertText(input.idempotencyKey, "idempotency_key_required");
    const regionSuccessors = normalizedSuccessorMap(input.regionSuccessors, "region");
    const factionSuccessors = normalizedSuccessorMap(input.factionSuccessors, "faction");
    const requestHash = sha256({
      toWorldContentSourceHash: registry.sourceHash,
      regionSuccessors,
      factionSuccessors,
    });
    const prior = priorMigrations.get(idempotencyKey);
    if (prior) {
      if (prior.requestHash !== requestHash) throw new Error("idempotency_key_conflict");
      return attachEpochEventsForPersistence(prior.result, []);
    }
    if (priorCommands.has(idempotencyKey)) throw new Error("idempotency_key_conflict");
    if (!state.initialized) throw new Error("world_simulation_migration_before_initialization");
    if (state.worldContentSourceHash === registry.sourceHash) {
      throw new Error("world_simulation_content_migration_not_required");
    }
    const expectedHash = migrationCommandHash({
      fromWorldContentSourceHash: state.worldContentSourceHash,
      toWorldContentSourceHash: registry.sourceHash,
      worldMinute: state.worldMinute,
      regionSuccessors,
      factionSuccessors,
    });
    const transition = migrateSnapshot(state, registry, regionSuccessors, factionSuccessors);
    const createdAt = isoNow(nowReal);
    const payload: WorldSimulationContentMigratedPayload = {
      simulationId: EPOCH_WORLD_SIMULATION_ID,
      worldMinute: state.worldMinute,
      fromWorldContentSourceHash: state.worldContentSourceHash,
      toWorldContentSourceHash: registry.sourceHash,
      ruleVersion: EPOCH_WORLD_SIMULATION_RULE_VERSION,
      commandHash: expectedHash,
      previousStateHash: state.stateHash,
      nextStateHash: transition.snapshot.stateHash,
      regionSuccessors,
      factionSuccessors,
      genesisCommodityDelta: transition.genesisCommodityDelta,
      genesisReserveDelta: transition.genesisReserveDelta,
      genesisCoinDelta: transition.genesisCoinDelta,
      reroutedShipmentCount: transition.reroutedShipmentCount,
      forcedArrivalCount: transition.forcedArrivalCount,
      snapshot: transition.snapshot,
    };
    const migrated = createEpochEvent({
      eventType: "world_simulation_content_migrated",
      aggregateType: "world_simulation",
      aggregateId: EPOCH_WORLD_SIMULATION_ID,
      context: context({ ...input, idempotencyKey }),
      createdAt,
      idFactory,
      payload,
    });
    apply([migrated]);
    const result = attachEpochEventsForPersistence({
      simulation: state,
      events: [migrated],
      genesisCommodityDelta: transition.genesisCommodityDelta,
      genesisReserveDelta: transition.genesisReserveDelta,
      genesisCoinDelta: transition.genesisCoinDelta,
      reroutedShipmentCount: transition.reroutedShipmentCount,
      forcedArrivalCount: transition.forcedArrivalCount,
      duplicate: false,
    }, [migrated]);
    priorMigrations.set(idempotencyKey, { requestHash, result: { ...result, events: [], duplicate: true } });
    return result;
  }

  return {
    status: () => state,
    advance,
    migrateContent,
    checkpoint: () => simulationEvents.length,
    rollback,
    resultForIdempotencyKey: (idempotencyKey: string) => priorCommands.get(idempotencyKey),
    events: () => [...simulationEvents],
  };
}

function simulationSnapshotAtOrBefore(
  events: readonly EpochEvent[],
  registry: WorldContentRegistry,
  targetWorldMinute: number,
) {
  nonNegativeWhole(targetWorldMinute, "world_simulation_slice_minute_invalid");
  let state = uninitializedSnapshot(registry);
  for (const event of events.filter(simulationEvent)) {
    const eventWorldMinute = event.eventType === "world_simulation_initialized"
      ? event.payload.worldMinute
      : event.eventType === "world_simulation_advanced"
        ? event.payload.toWorldMinute
        : event.eventType === "world_simulation_content_migrated"
          ? event.payload.worldMinute
          : Number.POSITIVE_INFINITY;
    if (eventWorldMinute > targetWorldMinute) break;
    state = projectEpochWorldSimulation([event], registry, state);
  }
  return state.initialized ? state : seedSnapshot(registry, 0);
}

function journeySliceRegionState(
  snapshot: EpochWorldSimulationSnapshot,
  regionId: string,
): JourneyWorldSliceRegionState {
  const region = snapshot.regions.find((candidate) => candidate.regionId === regionId);
  if (!region) throw new Error("world_simulation_slice_region_not_found");
  return {
    worldMinute: snapshot.worldMinute,
    stateHash: snapshot.stateHash,
    ...(region.controllerFactionId ? { controllerFactionId: region.controllerFactionId } : {}),
    population: region.population,
    treasuryCoin: region.treasuryCoin,
    securityBps: region.securityBps,
    unrestBps: region.unrestBps,
    conflictPressureBps: region.conflictPressureBps,
    stocks: region.stocks,
    priceMilliCoin: region.priceMilliCoin,
    coverageBps: region.coverageBps,
    conflictPhases: snapshot.conflicts
      .filter((conflict) => conflict.regionId === regionId)
      .map((conflict) => `${conflict.phase}:${conflict.factionIds.join("+")}`)
      .sort(),
  };
}

function ledgerDelta(
  start: Readonly<Record<string, number>>,
  end: Readonly<Record<string, number>>,
) {
  return Object.fromEntries([...new Set([...Object.keys(start), ...Object.keys(end)])]
    .sort()
    .map((key) => [key, (end[key] ?? 0) - (start[key] ?? 0)]));
}

export function worldSimulationHistoricalSlice(input: {
  readonly events: readonly EpochEvent[];
  readonly registry: WorldContentRegistry;
  readonly regionId: string;
  readonly startedAtWorldTime: string;
  readonly endedAtWorldTime: string;
  readonly startedAtWorldMinute: number;
  readonly endedAtWorldMinute: number;
}): JourneyWorldSlice {
  const regionId = assertText(input.regionId, "world_simulation_slice_region_required");
  const startedAtWorldMinute = nonNegativeWhole(
    input.startedAtWorldMinute,
    "world_simulation_slice_start_invalid",
  );
  const endedAtWorldMinute = nonNegativeWhole(
    input.endedAtWorldMinute,
    "world_simulation_slice_end_invalid",
  );
  if (endedAtWorldMinute < startedAtWorldMinute) throw new Error("world_simulation_slice_window_invalid");
  const started = simulationSnapshotAtOrBefore(input.events, input.registry, startedAtWorldMinute);
  const ended = simulationSnapshotAtOrBefore(input.events, input.registry, endedAtWorldMinute);
  const start = journeySliceRegionState(started, regionId);
  const end = journeySliceRegionState(ended, regionId);
  const sourceEventIds = input.events.filter((event) => {
    if (!simulationEvent(event)) return false;
    if (event.eventType === "world_simulation_initialized") {
      return event.payload.worldMinute >= startedAtWorldMinute
        && event.payload.worldMinute <= endedAtWorldMinute;
    }
    if (event.eventType === "world_simulation_advanced") {
      return event.payload.fromWorldMinute <= endedAtWorldMinute
        && event.payload.toWorldMinute >= startedAtWorldMinute;
    }
    return event.eventType === "world_simulation_content_migrated"
      && event.payload.worldMinute >= startedAtWorldMinute
      && event.payload.worldMinute <= endedAtWorldMinute;
  }).map((event) => event.eventId);
  const unsigned = {
    version: 1 as const,
    authority: "server_world_simulation" as const,
    regionId,
    startedAtWorldTime: input.startedAtWorldTime,
    endedAtWorldTime: input.endedAtWorldTime,
    startedAtWorldMinute,
    endedAtWorldMinute,
    worldContentSourceHash: input.registry.sourceHash,
    start,
    end,
    direction: {
      controllerChanged: start.controllerFactionId !== end.controllerFactionId,
      populationDelta: end.population - start.population,
      treasuryCoinDelta: end.treasuryCoin - start.treasuryCoin,
      securityDeltaBps: end.securityBps - start.securityBps,
      unrestDeltaBps: end.unrestBps - start.unrestBps,
      conflictPressureDeltaBps: end.conflictPressureBps - start.conflictPressureBps,
      stockDelta: ledgerDelta(start.stocks, end.stocks),
      priceDeltaMilliCoin: ledgerDelta(start.priceMilliCoin, end.priceMilliCoin),
    },
    sourceEventIds,
  };
  return { ...unsigned, sliceHash: sha256(unsigned) };
}

export interface EpochWorldSimulationViewInput {
  readonly regionId?: string;
  readonly factionId?: string;
  readonly includeShipments?: boolean;
  readonly limit?: number;
}

export function worldSimulationView(
  state: EpochWorldSimulationSnapshot,
  input: EpochWorldSimulationViewInput = {},
) {
  const materializedWorldMinute = state.materializedWorldMinute ?? state.worldMinute;
  const limit = Number.isSafeInteger(input.limit) ? Math.max(1, Math.min(Number(input.limit), 100)) : 25;
  const regions = state.regions
    .filter((region) => !input.regionId || region.regionId === input.regionId)
    .slice(0, limit);
  const factions = state.factions
    .filter((faction) => !input.factionId || faction.factionId === input.factionId)
    .slice(0, limit);
  const conflicts = state.conflicts
    .filter((conflict) => !input.regionId || conflict.regionId === input.regionId)
    .filter((conflict) => !input.factionId || conflict.factionIds.includes(input.factionId))
    .slice(0, limit);
  const shipments = input.includeShipments
    ? state.shipments
        .filter((shipment) => !input.regionId
          || shipment.fromRegionId === input.regionId
          || shipment.toRegionId === input.regionId)
        .slice(0, limit)
    : undefined;
  return {
    authority: "server_world_simulation" as const,
    ruleVersion: EPOCH_WORLD_SIMULATION_RULE_VERSION,
    initialized: state.initialized,
    worldMinute: state.worldMinute,
    materializedWorldMinute,
    pendingMaterializationWorldMinutes: state.worldMinute - materializedWorldMinute,
    worldContentSourceHash: state.worldContentSourceHash,
    version: state.version,
    stateHash: state.stateHash,
    commodityTotals: state.commodityTotals,
    totalCoin: state.totalCoin,
    counts: {
      regions: state.regions.length,
      factions: state.factions.length,
      shipments: state.shipments.length,
      shortageRegions: state.regions.filter((region) =>
        EPOCH_WORLD_COMMODITY_IDS.some((commodityId) => region.coverageBps[commodityId] < 10_000)).length,
      conflictRegions: state.regions.filter((region) => region.conflictPressureBps > 0).length,
      conflicts: state.conflicts.length,
      wars: state.conflicts.filter((conflict) => conflict.phase === "war").length,
    },
    regions,
    factions,
    conflicts,
    ...(shipments ? { shipments } : {}),
    lastEventId: state.lastEventId,
    lastAdvancedAt: state.lastAdvancedAt,
  };
}
