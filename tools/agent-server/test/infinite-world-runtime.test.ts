import assert from "node:assert/strict";
import test from "node:test";

import { CausalValidationError } from "../lib/epoch/causalContracts.ts";
import { createCausalWorldSnapshot } from "../lib/epoch/causalWorldSnapshot.ts";
import { createInMemoryCausalIdempotencyManifestStore } from "../lib/epoch/causalIdempotencyRules.ts";
import {
  createInfiniteWorldRuntime,
  type InfiniteWorldCommandType,
  type InfiniteWorldCommandV1,
} from "../lib/epoch/infiniteWorldRuntime.ts";
import { createLifeProfile } from "../lib/epoch/lifeProfileRules.ts";
import { DEFAULT_ECONOMY_RECIPES } from "../lib/epoch/unifiedEconomyRules.ts";
import { createCausalResourcePolicyFromCatalog } from "../lib/epoch/causalResourceCatalog.ts";
import type { ProgressionAttributeId, ProgressionState } from "../lib/epoch/progressionRules.ts";

const WORLD_ID = "world_runtime_contract";
const NOW = "2026-07-20T00:00:00.000Z";
const ACTOR = { actorType: "player_identity", actorId: "identity_alpha" } as const;

const attributes: Record<ProgressionAttributeId, number> = {
  strength: 30,
  agility: 30,
  physique: 30,
  intellect: 30,
  willpower: 30,
  spirituality: 30,
};

function runtime(overrides: Partial<Parameters<typeof createInfiniteWorldRuntime>[0]> = {}) {
  let nextId = 0;
  return createInfiniteWorldRuntime({
    worldId: WORLD_ID,
    initialSnapshot: seededSnapshot(),
    now: () => NOW,
    nowMs: () => 10,
    idFactory: (kind) => `${kind}_${String(++nextId).padStart(4, "0")}`,
    ...overrides,
  });
}

function seededSnapshot() {
  const seededLifeProfile = createLifeProfile(lifeProfileInput(100));
  return createCausalWorldSnapshot({
    worldId: WORLD_ID,
    balances: {
      byAccount: {
        "resource_node_inventory:node_seeded": { "iron_ore:minor_unit": "40" },
        "account:foundry": { "iron_ore:minor_unit": "0" },
        "household:household:runtime:resources": {
          "money:minor": "1000",
          "food:portion": "10",
          "water:liter": "10",
          "skill_material:material": "10",
        },
        "employer:runtime": { "money:minor": "10000" },
        "faction:faction_alpha": { "governance_budget:minor": "1000", governance_budget: "1000" },
      },
      accounts: [
        { accountRef: "resource_node_inventory:node_seeded", resourceKey: "iron_ore", unit: "minor_unit", balanceMinor: "40" },
        { accountRef: "account:foundry", resourceKey: "iron_ore", unit: "minor_unit", balanceMinor: "0" },
        { accountRef: "household:household:runtime:resources", resourceKey: "money", unit: "minor", balanceMinor: "1000" },
        { accountRef: "household:household:runtime:resources", resourceKey: "food", unit: "portion", balanceMinor: "10" },
        { accountRef: "household:household:runtime:resources", resourceKey: "water", unit: "liter", balanceMinor: "10" },
        { accountRef: "household:household:runtime:resources", resourceKey: "skill_material", unit: "material", balanceMinor: "10" },
        { accountRef: "employer:runtime", resourceKey: "money", unit: "minor", balanceMinor: "10000" },
        { accountRef: "identity:identity_alpha:progression", resourceKey: "material.primary", unit: "minor", balanceMinor: "100" },
        { accountRef: "identity:identity_alpha:progression", resourceKey: "material.stabilizer", unit: "minor", balanceMinor: "100" },
        { accountRef: "identity:identity_alpha:progression", resourceKey: "material.catalyst", unit: "minor", balanceMinor: "100" },
        { accountRef: "buyer", resourceKey: "coin", unit: "minor", balanceMinor: "1000" },
        { accountRef: "buyer", resourceKey: "iron_alloy", unit: "minor_unit", balanceMinor: "0" },
        { accountRef: "merchant", resourceKey: "coin", unit: "minor", balanceMinor: "1000" },
        { accountRef: "merchant", resourceKey: "iron_alloy", unit: "minor_unit", balanceMinor: "10" },
        { accountRef: "seller", resourceKey: "coin", unit: "minor", balanceMinor: "0" },
        { accountRef: "seller", resourceKey: "iron_alloy", unit: "minor_unit", balanceMinor: "5" },
        { accountRef: "crafter", resourceKey: "iron_alloy", unit: "minor_unit", balanceMinor: "10" },
        { accountRef: "crafter", resourceKey: "carbon_flux", unit: "minor_unit", balanceMinor: "10" },
        { accountRef: "crafter", resourceKey: "fuel_coke", unit: "minor_unit", balanceMinor: "10" },
        { accountRef: "account:caster:aether", resourceKey: "aether", unit: "drop", balanceMinor: "900" },
        { accountRef: "account:lineage:treasury", resourceKey: "coin", unit: "minor", balanceMinor: "1000" },
        { accountRef: "faction:faction_alpha", resourceKey: "governance_budget", unit: "minor", balanceMinor: "1000" },
      ],
    },
    domains: {
      resourceProductionNodes: [{
        nodeId: "node_seeded",
        resourceKey: "iron_ore",
        resourceClass: "material",
        unit: "minor_unit",
        capacity: 40,
        remaining: 40,
        remainingUnits: 40,
        yield: 5,
        yieldPerWorkUnit: 5,
        workerSlots: 2,
        registeredAtWorldTime: 1,
      }],
      resourceProductionAssignments: [{
        assignmentId: "assignment_seeded",
        nodeId: "node_seeded",
        workerRef: "worker:seeded",
        targetAccountRef: "account:foundry",
        slotIndex: 0,
        workUnits: "1",
        assignedAtWorldTime: 10,
        sourceEventIds: ["event:assignment_seeded"],
        authorizationRefs: ["auth:runtime:test"],
      }],
      lifeProfiles: [{ profileId: "profile_seeded", state: seededLifeProfile }],
    },
  });
}

function commandIdFor(idempotencyKey: string): string {
  return `cmd_${idempotencyKey.replace(/[^a-zA-Z0-9_]/g, "_")}`;
}

function baseCommand(commandType: InfiniteWorldCommandType, payload: Record<string, unknown>, idempotencyKey = `idem_${commandType}`): InfiniteWorldCommandV1 {
  return {
    commandType,
    commandId: commandIdFor(idempotencyKey),
    worldId: WORLD_ID,
    actor: ACTOR,
    submittedAt: NOW,
    requestedWorldMinute: 100,
    idempotencyKey,
    authorizationRefs: ["auth:runtime:test"],
    payload: {
      streamId: `${commandType}:${idempotencyKey}`,
      ...payload,
    },
  } as InfiniteWorldCommandV1;
}

function economyState() {
  return {
    resources: {
      coin: {
        resourceKey: "coin",
        resourceClass: "currency",
        unit: "minor",
        basePriceMinor: "1",
        priceFloorMinor: "1",
        priceCeilingMinor: "1000000",
        tradable: true,
        conserved: true,
        capacityWeightMinor: "0",
        allowedSourceTypes: ["transfer", "authorized_currency_issuance"],
        allowedSinkTypes: ["transfer", "market_fee", "authorized_currency_retirement"],
      },
      iron_alloy: material("iron_alloy"),
      carbon_flux: material("carbon_flux"),
      fuel_coke: material("fuel_coke"),
      scrap_metal: material("scrap_metal", { allowedSourceTypes: ["research_byproduct"] }),
    },
    accounts: {
      buyer: account("buyer", { coin: "1000", iron_alloy: "0" }),
      merchant: account("merchant", { coin: "1000", iron_alloy: "10" }),
      seller: account("seller", { coin: "0", iron_alloy: "5" }),
      crafter: account("crafter", { iron_alloy: "10", carbon_flux: "10", fuel_coke: "10" }),
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
    },
    recipes: DEFAULT_ECONOMY_RECIPES,
    items: {
      blade_damaged: {
        itemRef: "blade_damaged",
        itemKey: "crafted:field-blade",
        titleOwnerRef: "identity_alpha",
        possessionAccountRef: "crafter",
        bucket: "damaged",
        quality: 80,
        durability: { current: 80, max: 100 },
        repairable: true,
        materialRefs: ["mat_old"],
        provenanceRefs: ["event_old"],
      },
    },
  };
}

function material(resourceKey: string, overrides: Record<string, unknown> = {}) {
  return {
    resourceKey,
    resourceClass: "material",
    unit: "minor_unit",
    basePriceMinor: "1",
    priceFloorMinor: "1",
    priceCeilingMinor: "1000000",
    tradable: true,
    conserved: true,
    capacityWeightMinor: "1",
    allowedSourceTypes: ["merchant_inventory", "research_byproduct", "transfer"],
    allowedSinkTypes: ["transfer", "crafting", "repair", "market_fee"],
    ...overrides,
  };
}

function account(accountRef: string, balances: Record<string, string>) {
  return {
    accountRef,
    ownerRef: `owner:${accountRef}`,
    capacityMinor: "10000",
    balances: Object.entries(balances).map(([resourceKey, quantityMinor]) => ({
      resourceKey,
      bucket: "available",
      quantityMinor,
    })),
  };
}

function materialInput(materialRef: string, resourceKey: string, quantityMinor: string) {
  return {
    materialRef,
    resourceKey,
    accountRef: "crafter",
    quantityMinor,
    quality: 80,
    provenanceChannel: "merchant_inventory",
    sourceEventIds: [`event:${materialRef}`],
  };
}

function resourceNodeInput(nodeId: string) {
  return {
    nodeId,
    resourceKey: "iron_ore",
    resourceClass: "material",
    unit: "minor_unit",
    capacity: "30",
    remainingUnits: "30",
    yieldPerWorkUnit: "5",
    workerSlots: 1,
    worldTime: 100,
  };
}

function resourceAssignmentInput(assignmentId: string, nodeId: string) {
  return {
    assignmentId,
    nodeId,
    workerRef: "worker:runtime",
    targetAccountRef: "account:foundry",
    slotIndex: 1,
    workUnits: "1",
    worldTime: 100,
    sourceEventIds: [`event:${assignmentId}`],
    authorizationRefs: ["auth:runtime:test"],
  };
}

function lifeProfileInput(worldMinute = 0) {
  return {
    worldMinute,
    actors: [{
      actorRef: "actor:runtime",
      householdRef: "household:runtime",
      body: { hunger: 1000, thirst: 1000, fatigue: 1000, stress: 1000, health: 9000 },
      mind: { stress: 1000, mood: 7000, belonging: 6000, purpose: 6000 },
      work: {
        employerAccountRef: "employer:runtime",
        wagePerWorldMinute: 2,
        schedule: [{ startMinuteOfDay: 0, endMinuteOfDay: 240 }],
      },
      sleep: { schedule: [{ startMinuteOfDay: 1320, endMinuteOfDay: 360 }] },
    }],
    households: [{
      householdRef: "household:runtime",
      resources: { money: 1000, food: 10, water: 10, skill_material: 10 },
    }],
    externalAccounts: {
      "employer:runtime": { money: 10000 },
    },
  };
}

function progressionState(overrides: Partial<ProgressionState> = {}): ProgressionState {
  return {
    identityId: "identity_alpha",
    lineageId: "lineage_alpha",
    functionalStage: 2,
    powerSystemId: "eastern_cultivation",
    attributes,
    resources: {
      functionalXp: 360,
      insightPoints: 4,
      skillPointsSpent: 0,
      lineageMarks: 1,
      attributeEvidenceXp: { strength: 250 },
      methodProficiency: { breath: 250 },
      domainInsight: { dream_mind: 30 },
      materials: [],
    },
    learnedSkillNodeIds: ["root_breath"],
    talents: [],
    qualificationRefs: ["qualification:eastern"],
    ...overrides,
  };
}

function missionContract() {
  return {
    contractId: "mission_runtime",
    worldId: WORLD_ID,
    status: "active",
    interventionFamily: "combat",
    rootPressureIds: ["pressure_runtime"],
    sponsorRef: "faction:runtime",
    beneficiaryRefs: ["settlement:runtime"],
    oppositionRefs: ["faction:opposition"],
    objectivePredicates: [{
      objectiveId: "objective_runtime",
      title: "Resolve runtime pressure",
      targetRef: { entityType: "pressure", entityId: "runtime" },
      operator: "gte",
      expectedValue: 80,
      observableWorldStateRef: "world_state:runtime",
      required: true,
      weight: 1,
    }],
    rewardFundingRef: "treasury:runtime",
    rewardProposals: [],
    resourceStakes: [],
    risk: {
      opposition: 50,
      environmentalHazard: 40,
      objectiveComplexity: 45,
      informationUncertainty: 30,
      logisticalBurden: 35,
      legalPoliticalRisk: 20,
      irreversibility: 30,
    },
    offeredAtWorldMinute: 1,
    acceptedAtWorldMinute: 2,
    activeAtWorldMinute: 3,
    authorizationRefs: ["auth:runtime:test"],
    causalParentEventIds: ["event:mission_open"],
  };
}

function governanceState() {
  const metrics = { legitimacy: 70, administrativeCapacity: 65, cohesion: 60, corruption: 15, fiscal: 80, influence: 55 };
  return {
    factions: [{ factionId: "faction_alpha", status: "active", metrics }],
    institutions: [{ institutionId: "institution_council", jurisdictionIds: ["jurisdiction_harbor"], authorityRefs: ["authority:council"], status: "active", metrics }],
    jurisdictions: [{ jurisdictionId: "jurisdiction_harbor", regionIds: ["region_harbor"], institutionIds: ["institution_council"], lawIds: ["law_charter"], taxRateBasisPoints: 600, status: "active" }],
    laws: [{ lawId: "law_charter", jurisdictionId: "jurisdiction_harbor", sponsorRef: "faction:faction_alpha", status: "proposed", authorityRefs: ["authority:council"] }],
    policies: [],
    offices: [],
    claims: [],
    obligations: [],
  };
}

function supernaturalActor() {
  return {
    actorRef: "identity:caster",
    state: "active",
    worldMinute: 100,
    permissions: ["self"],
    prerequisiteRefs: ["prereq:moon"],
    knowledgeRefs: ["knowledge:ward"],
    cooldownReadyAtByCapabilityId: {},
    resourceBalancesMinor: { "aether:drop": "900" },
    pollutionMinor: 0,
    exposureMinor: 0,
    instabilityMinor: 0,
  };
}

function supernaturalCapability() {
  return {
    capabilityId: "capability:moon",
    source: "arcane",
    operations: ["observe"],
    domains: ["oath"],
    validTargetTypes: ["identity"],
    requiredPermissions: ["self"],
    requiredPrerequisiteRefs: ["prereq:moon"],
    requiredKnowledgeRefs: ["knowledge:ward"],
    resourceCosts: [{ resourceKey: "aether", resourceClass: "aether", unit: "drop", quantityMinor: "300", accountRef: "account:caster:aether", authorizationRef: "auth:cost" }],
    timeCostWorldMinutes: 10,
    cooldownWorldMinutes: 30,
    minCounterWindowWorldMinutes: 0,
    risk: { pollutionMinor: 10, exposureMinor: 10, backlashMinor: 0, legalHeatMinor: 0, instabilityMinor: 0 },
    legalClassRefs: [],
    evidenceSignatureRefs: ["sig:moon"],
    mayCreateWorldFact: false,
    mayRewritePastFact: false,
    maxTargets: 1,
  };
}

function mortalitySnapshot() {
  return {
    worldId: WORLD_ID,
    lineageRef: "lineage:alpha",
    identityRef: "identity:dead",
    nextIdentityRef: "identity:next",
    state: "dead",
    worldMinute: 100,
    injuries: [{ injuryId: "injury:lethal", severityMinor: 10000, untreatedWorldMinutes: 30, lethal: true, sourceEventIds: ["event:injury"] }],
    medicalEvidenceRefs: ["medical:confirmed"],
    witnessRefs: ["witness:one"],
    assets: [],
    insurancePolicies: [],
    authorizedInheritanceRefs: ["inheritance:lineage:alpha:identity:heir"],
    currentAttributesMinor: { strength: 10000 },
    currentSkillMinor: { blade: 10000 },
  };
}

function projectSnapshot() {
  return {
    projectId: "project:runtime",
    projectType: "facility",
    ownerLineageRef: "lineage:alpha",
    state: "active",
    currentStageId: "stage:foundation",
    progressMinor: 0,
    stages: [{ stageId: "stage:foundation", order: 1, requiredProgressMinor: 800, requiredInputRefs: ["charter"], maintenanceCostMinorPerDay: "100", riskMinorPerDay: 100 }],
    committedInputRefs: ["charter"],
    personnel: [{ actorRef: "identity:builder", role: "foreman", availableWorldMinutesPerDay: 240, skillMinor: 100, upkeepMinorPerDay: "20" }],
    treasuryAccountRef: "account:lineage:treasury",
    treasuryResourceKey: "coin",
    treasuryUnit: "minor",
    treasuryBalanceMinor: "1000",
    maintenanceDebtMinor: "0",
    riskMinor: 0,
    lastAdvancedWorldMinute: 100,
    authorizationRefs: ["auth:project"],
  };
}

function validCommand(commandType: InfiniteWorldCommandType, idempotencyKey = `idem_${commandType}`): InfiniteWorldCommandV1 {
  const sourceEventIds = [commandIdFor(idempotencyKey)];
  const context = { actionId: `action_${commandType}`, actor: ACTOR, occurredAtWorldMinute: 100, sourceEventIds, authorizationRefs: ["auth:runtime:test"] };
  switch (commandType) {
    case "world_tick":
      return baseCommand(commandType, { currentWorldMinute: 100, targetWorldMinute: 101, sourceEventIds: ["event:clock"] }, idempotencyKey);
    case "resource_node_register":
      return baseCommand(commandType, { input: resourceNodeInput("node_runtime") }, idempotencyKey);
    case "resource_production_assign":
      return baseCommand(commandType, { input: resourceAssignmentInput("assignment_runtime", "node_seeded") }, idempotencyKey);
    case "resource_produce":
      return baseCommand(commandType, { nodeId: "node_seeded", resourceKey: "iron_ore", targetAccountRef: "account:foundry", sourceEventIds }, idempotencyKey);
    case "resource_node_replenish":
      return baseCommand(commandType, { input: { nodeId: "node_seeded", amount: "5", worldTime: 100 } }, idempotencyKey);
    case "life_profile_create":
      return baseCommand(commandType, { profileId: "profile_runtime", input: lifeProfileInput(100) }, idempotencyKey);
    case "life_profile_advance":
      return baseCommand(commandType, { profileId: "profile_seeded", toWorldMinute: 180 }, idempotencyKey);
    case "mission_settle":
      return baseCommand(commandType, { input: { contract: missionContract(), outcome: "costly_success", objectiveResults: [{ objectiveId: "objective_runtime", completedBps: 8000, required: true }], actorRef: "actor:player", occurredAtWorldMinute: 100, sourceEventIds } }, idempotencyKey);
    case "economy_buy":
      return baseCommand(commandType, { state: economyState(), input: { context, buyerAccountRef: "buyer", offerId: "iron_offer" } }, idempotencyKey);
    case "economy_sell":
      return baseCommand(commandType, { state: economyState(), input: { context, sellerAccountRef: "seller", merchantAccountRef: "merchant", resourceKey: "iron_alloy", quantityMinor: "1", priceResourceKey: "coin" } }, idempotencyKey);
    case "economy_craft":
      return baseCommand(commandType, { state: economyState(), input: { context, crafterAccountRef: "crafter", recipeId: "forge_field_blade", materialInputs: [materialInput("mat_iron", "iron_alloy", "3"), materialInput("mat_carbon", "carbon_flux", "1"), materialInput("mat_fuel", "fuel_coke", "1")], crafterSkill: 90, workstationQuality: 70, processControl: 80, outputItemRef: "item_forged", seed: "seed_0" } }, idempotencyKey);
    case "economy_repair":
      return baseCommand(commandType, { state: economyState(), input: { context, repairerAccountRef: "crafter", payerAccountRef: "crafter", itemRef: "blade_damaged", recipeId: "repair_metalwork", materialInputs: [materialInput("mat_repair_iron", "iron_alloy", "1"), materialInput("mat_repair_flux", "carbon_flux", "1")], repairerSkill: 80, workstationQuality: 80, processControl: 80 } }, idempotencyKey);
    case "progression_reward":
      return baseCommand(commandType, { input: { identityId: "identity_alpha", outcome: "forced_extraction", rewardSourceRef: "reward:run", confirmedClaimValue: 100, unconfirmedClaimValue: 50, practiceEvidenceXp: 20, insightEvidence: 30, materials: [{ materialId: "primary", quantity: 2 }], sourceEventIds } }, idempotencyKey);
    case "progression_breakthrough":
      return baseCommand(commandType, { state: progressionState(), input: { targetStage: 3, facilityTier: 2, preparedMaterials: [{ materialId: "primary", quantity: 8 }, { materialId: "stabilizer", quantity: 2 }, { materialId: "catalyst", quantity: 1 }], sourceEventIds, frozenSeedRef: "seed:breakthrough" } }, idempotencyKey);
    case "progression_talent":
      return baseCommand(commandType, { state: progressionState(), input: { addTalents: [{ talentId: "scar_sense", impact: "minor", source: "scar" }] } }, idempotencyKey);
    case "progression_skill":
      return baseCommand(commandType, { state: progressionState(), input: { node: { nodeId: "breath_edge", tier: "tier2", kind: "method_unlock", prerequisiteNodeIds: ["root_breath"], materialCost: [{ materialId: "primary", quantity: 2 }] }, sourceEventIds, availableMaterials: [{ materialId: "primary", quantity: 2 }] } }, idempotencyKey);
    case "progression_carry":
      return baseCommand(commandType, { state: progressionState(), input: { targetCarrySlots: 4, targetDeploymentCapacity: 8, targetQuickUseSlots: 3, targetEchoSlots: 2, targetInsuranceLayers: 1, sourceEventIds } }, idempotencyKey);
    case "progression_attribute_evidence":
      return baseCommand(commandType, { state: progressionState(), input: { attributeId: "strength", relevanceBps: 8000, challengeBand: "matched", executionQualityBps: 7000, recoveryStateBps: 9000, repeatIndex: 0, sourceEventIds, actionTags: ["combat"] } }, idempotencyKey);
    case "progression_respec":
      return baseCommand(commandType, { state: progressionState({ resources: { functionalXp: 360, insightPoints: 4, skillPointsSpent: 0, lineageMarks: 1, attributeEvidenceXp: { strength: 250 }, methodProficiency: { breath: 250 }, domainInsight: { dream_mind: 30 }, materials: [] } }), input: { scope: "sameNode", spentExperience: 100, nodeIds: ["root_breath"], sourceEventIds } }, idempotencyKey);
    case "governance_action":
      return baseCommand(commandType, { state: governanceState(), action: { actionId: "action_enact", kind: "enact_law", actorRef: "faction:faction_alpha", targetRef: "law:law_charter", sourceRef: "event:hearing", worldMinute: 100, sourceEventIds, authorizationRefs: ["authority:council"], requiredAuthorityRefs: ["authority:council"], oppositionRefs: ["faction:opposition"], cost: {} } }, idempotencyKey);
    case "supernatural_cast":
      return baseCommand(commandType, { actorSnapshot: supernaturalActor(), intent: { commandId: "cmd_cast", worldId: WORLD_ID, casterRef: "identity:caster", capabilityId: "capability:moon", operation: "observe", targetRefs: [{ entityType: "identity", entityId: "target" }], intensityMinor: 5000, occurredAtWorldMinute: 100, authorizationRefs: ["auth:cost"], sourceEventIds, declaredCosts: [{ resourceKey: "aether", resourceClass: "aether", unit: "drop", quantityMinor: "300", accountRef: "account:caster:aether", authorizationRef: "auth:cost" }], desiredWorldFactChange: "none" }, capabilities: [supernaturalCapability()] }, idempotencyKey);
    case "legacy_transition":
      return baseCommand(commandType, { snapshot: mortalitySnapshot(), intent: { commandId: "cmd_legacy", causeEventIds: sourceEventIds, occurredAtWorldMinute: 110, advanceWorldMinutes: 10, requestedTransition: "settle_legacy", heirRef: "identity:heir", authorizationRefs: ["inheritance:lineage:alpha:identity:heir"] } }, idempotencyKey);
    case "project_tick":
      return baseCommand(commandType, { input: { commandId: "cmd_project", worldId: WORLD_ID, project: projectSnapshot(), toWorldMinute: 1540, sourceEventIds } }, idempotencyKey);
    case "narrative_settle":
      return baseCommand(commandType, { input: { worldId: WORLD_ID, worldMinute: 100, candidate: { kind: "thread", value: { threadId: "thread_runtime", state: "active", titleRef: "title:runtime", rootPressureIds: ["pressure_runtime"], originEventIds: sourceEventIds, actorRefs: ["actor:runtime"], regionRefs: ["region_harbor"], knownFactRefs: [], secretRefs: [], falseBeliefRefs: [], conflictingGoalRefs: [], promiseRefs: [], debtRefs: [], relationshipBeatRefs: [], arcs: [], tensions: [], currentStage: "setup", openedAtWorldMinute: 50, updatedAtWorldMinute: 100, reviewAtWorldMinute: 200, explanation: "runtime test thread" } }, sourceEventIds, authorizationRefs: ["auth:runtime:test"] } }, idempotencyKey);
  }
}

async function rejectsCode(promise: Promise<unknown>, code: string) {
  await assert.rejects(promise, (error: unknown) => {
    assert.equal((error as { code?: string }).code, code);
    return true;
  });
}

test("commits every known infinite world command type through the runtime", async (t) => {
  const commandTypes: readonly InfiniteWorldCommandType[] = [
    "world_tick",
    "resource_node_register",
    "resource_production_assign",
    "resource_produce",
    "resource_node_replenish",
    "life_profile_create",
    "life_profile_advance",
    "mission_settle",
    "economy_buy",
    "economy_sell",
    "economy_craft",
    "economy_repair",
    "progression_reward",
    "progression_breakthrough",
    "progression_talent",
    "progression_skill",
    "progression_carry",
    "progression_attribute_evidence",
    "progression_respec",
    "governance_action",
    "supernatural_cast",
    "legacy_transition",
    "project_tick",
    "narrative_settle",
  ];

  for (const commandType of commandTypes) {
    await t.test(`commits ${commandType}`, async () => {
      const world = runtime();
      try {
        const result = await world.execute(validCommand(commandType));
        assert.equal(result.replayed, false);
        assert.equal(result.event.command.commandType, commandType);
        assert.equal(world.events().length, 1);
        assert.equal(world.snapshot().replayCursor.eventCount, 1);
      } catch (error) {
        const details = "details" in (error as object) ? JSON.stringify((error as { details?: unknown }).details) : "{}";
        assert.fail(`${commandType} failed: ${(error as Error).message}; details=${details}; cause=${((error as Error).cause as Error | undefined)?.message}`);
      }
    });
  }
});

test("rejects unknown command types before commit", async () => {
  const world = runtime();
  await rejectsCode(world.execute({ ...validCommand("world_tick"), commandType: "unknown_command" }), "CAUSAL_SCHEMA_UNKNOWN");
  assert.equal(world.events().length, 0);
});

test("rejects malformed command actor before commit", async () => {
  const world = runtime();
  await rejectsCode(world.execute({ ...validCommand("world_tick"), actor: { actorType: "system" } }), "CAUSAL_SCHEMA_INVALID");
  assert.equal(world.events().length, 0);
});

test("rejects initial snapshots from a different world", () => {
  assert.throws(
    () => runtime({ initialSnapshot: createCausalWorldSnapshot({ worldId: "foreign_world" }) }),
    (error: unknown) => {
      assert.ok(error instanceof CausalValidationError);
      assert.equal(error.code, "CAUSAL_SCHEMA_INVALID");
      assert.equal(error.details.field, "initialSnapshot.worldId");
      return true;
    },
  );
});

test("rejects domain-invalid command and leaves the snapshot unchanged", async () => {
  const world = runtime();
  const before = world.checkpoint().snapshotHash;
  await rejectsCode(world.execute(baseCommand("economy_buy", { state: economyState(), input: { context: { actionId: "bad", actor: ACTOR, occurredAtWorldMinute: 100, sourceEventIds: ["event:source"], authorizationRefs: [] }, buyerAccountRef: "buyer", offerId: "missing_offer" } }, "idem_bad_buy")), "CAUSAL_SCHEMA_INVALID");
  assert.equal(world.checkpoint().snapshotHash, before);
  assert.equal(world.events().length, 0);
});

test("commits explicit runtime resource creation refs and zero-sum life transfers", async () => {
  for (const commandType of ["resource_node_register", "resource_node_replenish", "life_profile_create", "life_profile_advance"] as const) {
    const world = runtime();
    const result = await world.execute(validCommand(commandType, `idem_catalog_${commandType}`));
    assert.equal(result.event.command.commandType, commandType);
    assert.equal(world.snapshot().replayCursor.eventCount, 1);
  }
});

test("catalog policy rejects forged dynamic resource refs fail-closed", () => {
  const policy = createCausalResourcePolicyFromCatalog();
  const event = {
    eventType: "progression_change_committed",
    command: { commandType: "progression_reward" },
  };
  const effect = {
    operation: "grant_functional_xp_from_run_evidence",
    sourceEventIds: ["event:verified_run"],
  };

  assert.equal(policy.creationSourceAllowed({
    ref: "source:forged_runtime_reward",
    resourceKey: "functional_xp",
    event,
    effect,
  }), false);
  assert.equal(policy.destructionSinkAllowed({
    ref: "sink:forged_runtime_sink",
    resourceKey: "skill_points",
    event: { eventType: "progression_change_committed", command: { commandType: "progression_skill" } },
    effect: { operation: "allocate_skill_points", sourceEventIds: ["event:verified_skill"] },
  }), false);
});

test("strict catalog permits governed budget spend and ecology stock flow refs narrowly", async () => {
  const policy = createCausalResourcePolicyFromCatalog();
  const governanceEvent = {
    eventType: "governance_action_resolved",
    command: { commandType: "governance_action" },
  };
  const governanceEffect = {
    operation: "spend_governance_budget",
    sourceEventIds: ["event:governance:cost"],
  };
  const ecologyEvent = {
    eventType: "ecology_tick_resolved",
    command: { commandType: "world_tick" },
  };
  const ecologyEffect = {
    operation: "ecology_stock_tick",
    sourceEventIds: ["event:ecology:tick"],
  };

  assert.equal(policy.destructionSinkAllowed({
    ref: "governance_cost:action_budgeted",
    resourceKey: "governance_budget",
    event: governanceEvent,
    effect: governanceEffect,
  }), true);
  assert.equal(policy.creationSourceAllowed({
    ref: "ecology:regeneration",
    resourceKey: "water",
    event: ecologyEvent,
    effect: ecologyEffect,
  }), true);
  assert.equal(policy.destructionSinkAllowed({
    ref: "ecology:extraction_or_loss",
    resourceKey: "water",
    event: ecologyEvent,
    effect: ecologyEffect,
  }), true);

  for (const invalid of [
    {
      ref: "governance_cost:action_budgeted",
      resourceKey: "coin",
      event: governanceEvent,
      effect: governanceEffect,
    },
    {
      ref: "governance_cost:action_budgeted",
      resourceKey: "governance_budget",
      event: { eventType: "progression_change_committed", command: { commandType: "governance_action" } },
      effect: governanceEffect,
    },
    {
      ref: "governance_cost:action_budgeted",
      resourceKey: "governance_budget",
      event: { eventType: "governance_action_resolved", command: { commandType: "world_tick" } },
      effect: governanceEffect,
    },
    {
      ref: "governance_cost:action_budgeted",
      resourceKey: "governance_budget",
      event: governanceEvent,
      effect: { operation: "ecology_stock_tick", sourceEventIds: ["event:governance:cost"] },
    },
  ]) {
    assert.equal(policy.destructionSinkAllowed(invalid), false);
  }

  for (const invalid of [
    {
      ref: "ecology:regeneration",
      resourceKey: "governance_budget",
      event: ecologyEvent,
      effect: ecologyEffect,
    },
    {
      ref: "ecology:regeneration",
      resourceKey: "water",
      event: { eventType: "governance_action_resolved", command: { commandType: "world_tick" } },
      effect: ecologyEffect,
    },
    {
      ref: "ecology:regeneration",
      resourceKey: "water",
      event: { eventType: "ecology_tick_resolved", command: { commandType: "governance_action" } },
      effect: ecologyEffect,
    },
    {
      ref: "ecology:regeneration",
      resourceKey: "water",
      event: ecologyEvent,
      effect: { operation: "spend_governance_budget", sourceEventIds: ["event:ecology:tick"] },
    },
  ]) {
    assert.equal(policy.creationSourceAllowed(invalid), false);
  }

  const budgetedWorld = runtime();
  const budgeted = await budgetedWorld.execute(baseCommand("governance_action", {
    state: governanceState(),
    action: {
      actionId: "action_budgeted",
      kind: "enact_law",
      actorRef: "faction:faction_alpha",
      targetRef: "law:law_charter",
      sourceRef: "event:hearing",
      worldMinute: 100,
      sourceEventIds: ["event:governance:cost"],
      authorizationRefs: ["authority:council"],
      requiredAuthorityRefs: ["authority:council"],
      oppositionRefs: ["faction:opposition"],
      cost: {
        treasuryMinor: "25",
        legitimacy: 0,
        administrativeCapacity: 0,
        cohesion: 0,
        influence: 0,
      },
    },
  }, "idem_governance_budgeted"));

  assert.equal(budgeted.event.command.commandType, "governance_action");
  assert.equal(budgetedWorld.snapshot().balances.byAccount["faction:faction_alpha"]?.["governance_budget:minor"], "975");

  const ecologyWorld = runtime();
  const ecology = await ecologyWorld.execute(baseCommand("world_tick", {
    currentWorldMinute: 100,
    targetWorldMinute: 101,
    sourceEventIds: ["event:clock"],
    ecology: {
      worldMinute: 101,
      sourceEventIds: ["event:ecology:tick"],
      stocks: [{
        regionId: "region_harbor",
        resourceKey: "water",
        stock: 80,
        capacity: 100,
        regenerationPerTick: 6,
        extractionPerTick: 4,
        pollution: 10,
        degradation: 2,
        restorationPerTick: 1,
        irreversibleThreshold: 90,
        irreversible: false,
      }],
      populations: [],
      flows: [],
    },
  }, "idem_ecology_stock_refs"));

  assert.equal(ecology.event.command.commandType, "world_tick");
  assert.equal(ecologyWorld.snapshot().replayCursor.eventCount, 1);
});

test("replays the same idempotency key without committing again", async () => {
  const world = runtime();
  const command = validCommand("world_tick", "idem_replay");
  const first = await world.execute(command);
  const second = await world.execute(command);
  assert.equal(second.replayed, true);
  assert.equal(second.event.eventId, first.event.eventId);
  assert.equal(world.events().length, 1);
  assert.equal(world.resultForIdempotencyKey("idem_replay")?.event.eventId, first.event.eventId);
});

test("canonical parent event ids survive command normalization into runtime event causality", async () => {
  const world = runtime({ enforcementMode: "observe" });
  const result = await world.execute({
    ...validCommand("world_tick", "idem_parent_ids"),
    causalParentEventIds: ["event_parent_b", "event_parent_a", "event_parent_a"],
    payload: {
      streamId: "world_tick:parent_ids",
      currentWorldMinute: 100,
      targetWorldMinute: 101,
    },
  });

  assert.deepEqual(result.event.causality.causalParentEventIds, ["event_parent_a", "event_parent_b"]);
});

test("failed atomic commit leaves runtime snapshot and event log unchanged", async () => {
  const world = runtime({
    atomicCommit: () => {
      throw new Error("canonical persistence down");
    },
  });
  const before = world.checkpoint().snapshotHash;

  await assert.rejects(
    () => world.execute(validCommand("world_tick", "idem_atomic_fail")),
    /CANONICAL_APPEND_FAILED/,
  );

  assert.equal(world.checkpoint().snapshotHash, before);
  assert.equal(world.snapshot().replayCursor.eventCount, 0);
  assert.equal(world.events().length, 0);
});

test("failed idempotency finalization leaves runtime snapshot and event log unchanged", async () => {
  const store = createInMemoryCausalIdempotencyManifestStore();
  const originalCommitAtomically = store.commitAtomically?.bind(store);
  assert.ok(originalCommitAtomically);
  const failingStore = {
    ...store,
    commitAtomically: async (...args: Parameters<NonNullable<typeof store.commitAtomically>>) => {
      await args[2]({});
      throw new Error("manifest finalization down");
    },
  };
  const world = runtime({ idempotencyStore: failingStore });
  const before = world.checkpoint().snapshotHash;

  await assert.rejects(
    () => world.execute(validCommand("world_tick", "idem_finalization_fail")),
    /CANONICAL_APPEND_FAILED/,
  );

  assert.equal(world.checkpoint().snapshotHash, before);
  assert.equal(world.snapshot().replayCursor.eventCount, 0);
  assert.equal(world.events().length, 0);
});

test("rejects same idempotency key with different input", async () => {
  const world = runtime();
  await world.execute(validCommand("world_tick", "idem_conflict"));
  await rejectsCode(world.execute(baseCommand("world_tick", { currentWorldMinute: 100, targetWorldMinute: 102 }, "idem_conflict")), "causal_idempotency_conflict");
  assert.equal(world.events().length, 1);
});

test("serializes concurrent executions for the same key and commits once", async () => {
  const world = runtime();
  const command = validCommand("world_tick", "idem_parallel");
  const results = await Promise.all([world.execute(command), world.execute(command)]);
  assert.equal(results.filter((result) => result.replayed).length, 1);
  assert.equal(world.events().length, 1);
});

test("returns degraded result and degraded health when projection hook fails", async () => {
  const world = runtime({
    ingestCanonicalEvents: () => {
      throw new Error("projection down");
    },
  });
  const result = await world.execute(validCommand("world_tick", "idem_degraded"));
  const health = world.health();
  assert.equal(result.manifest.projectionStatus, "degraded");
  assert.equal(result.manifest.warnings.includes("PROJECTION_LAGGING"), true);
  assert.equal(health.health.status, "degraded");
  assert.equal(health.traces.some((trace) => trace.kind === "projection_degraded"), true);
});

test("exposes checkpoint migrate health events result lookup and drain", async () => {
  const world = runtime();
  const result = await world.execute(validCommand("world_tick", "idem_api"));
  const checkpoint = world.checkpoint();
  const dryRun = world.migrate(undefined, true);
  const migrated = world.migrate({ worldId: WORLD_ID, legacyEvents: [] });

  await world.drain();

  assert.equal(checkpoint.worldId, WORLD_ID);
  assert.equal(checkpoint.replayCursor.eventCount, 1);
  assert.equal(dryRun.report.dryRun, true);
  assert.equal(dryRun.snapshot, undefined);
  assert.equal(migrated.report.status, "migrated");
  assert.equal(world.health().health.ready, true);
  assert.deepEqual(world.events().map((event) => event.eventId), [result.event.eventId]);
  assert.equal(world.resultForIdempotencyKey("idem_api")?.event.eventId, result.event.eventId);
});

test("migrate rejects snapshots from a different world without changing runtime snapshot", () => {
  const world = runtime();
  const before = world.checkpoint().snapshotHash;
  const migration = world.migrate(createCausalWorldSnapshot({ worldId: "foreign_world" }));

  assert.equal(migration.report.status, "rejected");
  assert.equal(migration.report.issues[0]?.code, "CAUSAL_SNAPSHOT_MIGRATION_WORLD_MISMATCH");
  assert.equal(world.checkpoint().snapshotHash, before);
  assert.equal(world.snapshot().worldId, WORLD_ID);
});

test("accepts an explicit initial snapshot and preserves it across rejected execution", async () => {
  const initialSnapshot = createCausalWorldSnapshot({ worldId: WORLD_ID });
  const world = runtime({ initialSnapshot });
  const before = world.checkpoint().snapshotHash;
  await rejectsCode(world.execute({ commandType: "world_tick", worldId: WORLD_ID, actor: ACTOR, idempotencyKey: "idem_bad_payload", payload: null }), "CAUSAL_SCHEMA_INVALID");
  assert.equal(world.checkpoint().snapshotHash, before);
  assert.equal(world.snapshot().worldId, WORLD_ID);
});
