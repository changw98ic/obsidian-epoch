import assert from "node:assert/strict";
import test from "node:test";

import {
  assertCausalWorldSnapshotV1,
  causalWorldSnapshotHash,
  createCausalWorldSnapshot,
  type CausalWorldSnapshotV1,
} from "../lib/epoch/causalWorldSnapshot.ts";
import {
  createInfiniteWorldRuntime,
  type InfiniteWorldCommandType,
  type InfiniteWorldCommandV1,
  type InfiniteWorldRuntime,
  type InfiniteWorldRuntimeResult,
} from "../lib/epoch/infiniteWorldRuntime.ts";
import { DEFAULT_ECONOMY_RECIPES } from "../lib/epoch/unifiedEconomyRules.ts";
import {
  createInMemoryCausalIdempotencyManifestStore,
  type CausalIdempotencyManifestStore,
} from "../lib/epoch/causalIdempotencyRules.ts";
import type { CausalWorldEventV1 } from "../lib/epoch/causalContracts.ts";
import type { ProgressionAttributeId, ProgressionState } from "../lib/epoch/progressionRules.ts";
import type { EpochWorldPressure } from "../lib/epoch/worldPressureRules.ts";
import type { CausalSimulationLodSubjectState } from "../lib/epoch/causalSimulationLodRules.ts";

const WORLD_ID = "world_infinite_soak";
const NOW = "2026-07-20T00:00:00.000Z";
const TOTAL_WORLD_TICKS = 240;
const CHECKPOINT_EVERY = 60;
const ACTORS = [
  { actorType: "player_identity", actorId: "identity_alpha" },
  { actorType: "npc", actorId: "agent_beta" },
  { actorType: "system", actorId: "clock" },
] as const;
const REGIONS = ["region_harbor", "region_ash", "region_glass"] as const;
const EXPOSED_COMMAND_TYPES: readonly InfiniteWorldCommandType[] = [
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
  "governance_action",
  "supernatural_cast",
  "legacy_transition",
  "project_tick",
];
const DOMAIN_COVERAGE_NOTE = [
  "Runtime exposes 21 command types; there is no separate pressure or LOD command.",
  "Pressure is covered through world_tick payload/results and checkpoint observability.",
  "LOD commitments are covered through snapshot preservation across load/restart.",
].join(" ");
const RESOURCE_NODE_ID = "node_soak_iron_vein";
const RESOURCE_ACCOUNT_REF = "household:soak:materials";
const LIFE_PROFILE_ID = "life_soak_household";
const LIFE_ACTOR_REF = "actor:soak_apprentice";
const LIFE_HOUSEHOLD_REF = "household:soak";

const attributes: Record<ProgressionAttributeId, number> = {
  strength: 30,
  agility: 30,
  physique: 30,
  intellect: 30,
  willpower: 30,
  spirituality: 30,
};

function runtime(overrides: Partial<Parameters<typeof createInfiniteWorldRuntime>[0]> = {}) {
  return createInfiniteWorldRuntime({
    worldId: WORLD_ID,
    initialSnapshot: seededSnapshot(),
    now: () => NOW,
    nowMs: () => 10,
    idFactory: (kind, input) => {
      const commandId = typeof input.commandId === "string" ? input.commandId : undefined;
      return `${kind}_${commandId || stableJson(input).replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 96)}`;
    },
    healthThresholds: {
      maxRejectRate: 0,
      maxProjectionDegradedTotal: 0,
      maxSchemaErrors: 0,
      maxConservationErrors: 0,
      maxCriticalPressureBacklog: 100_000,
      maxPressureBacklogDue: 100_000,
      maxMigrationDurationMs: 1_000,
    },
    ...overrides,
  });
}

function seededSnapshot(): CausalWorldSnapshotV1 {
  return createCausalWorldSnapshot({
    worldId: WORLD_ID,
    replayCursor: { eventCount: 0, lastWorldMinute: 100 },
    balances: {
      byAccount: {
        "identity:identity_alpha:progression": {
          "material.primary:minor": "100000",
          "material.stabilizer:minor": "100000",
          "material.catalyst:minor": "100000",
          "functional_xp:xp": "100000",
        },
        "identity:identity_alpha:skill_tree": {
          "skill_points:point": "100000",
        },
        "identity:identity_alpha:inventory": {
          "material.primary:count": "100000",
          "material.stabilizer:count": "100000",
          "material.catalyst:count": "100000",
        },
        "buyer#available": {
          "coin:minor": "100000",
          "iron_alloy:minor_unit": "1000",
        },
        "merchant#available": {
          "coin:minor": "100000",
          "iron_alloy:minor_unit": "1000",
        },
        "seller#available": {
          "coin:minor": "100000",
          "iron_alloy:minor_unit": "1000",
        },
        "crafter#available": {
          "iron_alloy:minor_unit": "1000",
          "carbon_flux:minor_unit": "1000",
          "fuel_coke:minor_unit": "1000",
        },
        "account:caster:aether": {
          "aether:drop": "1000000000",
          "aether:minor": "1000000000",
        },
        "account:lineage:treasury": {
          "coin:minor": "100000",
        },
      },
    },
    ownership: {
      titleOwners: {
        "facility:project:runtime": "lineage:alpha",
        "crafted:field-blade": "identity_alpha",
      },
    },
    pressure: {
      active: [
        pressure("pressure_harbor", "economic", "region:region_harbor", 62, 120),
        pressure("pressure_ash", "ecological", "region:region_ash", 78, 80),
        pressure("pressure_glass", "informational", "region:region_glass", 35, 500),
      ],
    },
    actorMind: {
      mindsByActor: {
        "agent:keeper": {
          actorRef: "agent:keeper",
          needs: [],
          values: [],
          roles: ["warden"],
          beliefs: ["knowledge:harbor"],
          relationships: [],
          commitments: ["commitment:escort", "commitment:audit"],
          activeGoals: [],
          queuedGoals: [],
          constraints: [],
          riskTolerance: 0.4,
          planningHorizonWorldMinutes: 120,
          simulationLod: 2,
        },
      },
      lodBySubject: {
        "region:region_harbor": lodSubject("region:region_harbor", 3, ["commitment:harbor-watch"]),
        "region:region_ash": lodSubject("region:region_ash", 2, ["commitment:ash-restoration"]),
        "region:region_glass": lodSubject("region:region_glass", 1, ["commitment:glass-index"]),
      },
    },
  });
}

function pressure(
  pressureId: string,
  type: EpochWorldPressure["type"],
  scopeRef: string,
  severity: number,
  reviewAtWorldMinute: number,
): EpochWorldPressure {
  return {
    pressureId,
    type,
    scopeRef,
    sourceFactEventIds: [`fact:${pressureId}`],
    affectedActorRefs: ["agent:keeper"],
    affectedResourceRefs: ["resource:coin"],
    severity,
    urgency: Math.min(100, severity + 5),
    growthRate: 2,
    uncertainty: 20,
    visibility: 85,
    state: "detected",
    counterPressureIds: [],
    openedAtWorldMinute: 1,
    updatedAtWorldMinute: 1,
    reviewAtWorldMinute,
  };
}

function lodSubject(
  subjectRef: string,
  simulationLod: CausalSimulationLodSubjectState["simulationLod"],
  commitments: readonly string[],
): CausalSimulationLodSubjectState {
  return {
    subjectRef,
    simulationLod,
    lastInteractionWorldMinute: 100,
    lastChangedWorldMinute: 100,
    activePressureSeverity: simulationLod === 3 ? 80 : 40,
    playerProximity: simulationLod === 3,
    hasIrreversibleEvent: false,
    nextCommitmentDueAtWorldMinute: 1_000,
    commitments,
    debts: ["debt:ledger"],
    injuries: [],
    ownership: ["facility:project:runtime"],
    relationships: ["relationship:keeper:council"],
    keyBeliefs: ["knowledge:harbor"],
    openCases: ["case:pressure-review"],
  };
}

function baseCommand(
  commandType: InfiniteWorldCommandType,
  payload: Record<string, unknown>,
  step: number,
  suffix = "main",
): InfiniteWorldCommandV1 {
  const idempotencyKey = `soak:${String(step).padStart(4, "0")}:${commandType}:${suffix}`;
  return {
    commandType,
    commandId: commandIdFor(idempotencyKey),
    worldId: WORLD_ID,
    actor: ACTORS[step % ACTORS.length],
    submittedAt: NOW,
    requestedWorldMinute: 100 + step,
    idempotencyKey,
    authorizationRefs: ["auth:runtime:soak"],
    payload: {
      streamId: WORLD_ID,
      ...payload,
    },
  } as InfiniteWorldCommandV1;
}

function commandIdFor(idempotencyKey: string): string {
  return `cmd_${idempotencyKey.replace(/[^a-zA-Z0-9_]/g, "_")}`;
}

function withStrictWorldStreamVersion(command: InfiniteWorldCommandV1, expectedVersion: number): InfiniteWorldCommandV1 {
  return {
    ...command,
    expectedStreamVersions: [{ streamType: "world", streamId: WORLD_ID, expectedVersion }],
    payload: {
      ...command.payload,
      streamId: WORLD_ID,
    },
  };
}

function strictResourceSnapshot(snapshot: CausalWorldSnapshotV1): CausalWorldSnapshotV1 {
  return createCausalWorldSnapshot({
    ...snapshot,
    checkpoint: undefined,
    events: {},
    eventHashes: {},
    replayCursor: {
      eventCount: 0,
      ...(typeof snapshot.replayCursor.lastWorldMinute === "number" ? { lastWorldMinute: snapshot.replayCursor.lastWorldMinute } : {}),
      streams: {},
    },
  });
}

function commandsForStep(step: number): readonly InfiniteWorldCommandV1[] {
  const commands: InfiniteWorldCommandV1[] = [
    baseCommand("world_tick", worldTickPayload(step), step),
  ];
  if (step === 5) commands.push(validCommand("resource_node_register", step));
  if (step === 6) commands.push(validCommand("resource_production_assign", step));
  if ([10, 20, 30, 50, 55].includes(step)) commands.push(validCommand("resource_produce", step));
  if (step === 40) commands.push(validCommand("resource_node_replenish", step));
  if (step === 7) commands.push(validCommand("life_profile_create", step));
  if (step === 180) commands.push(validCommand("life_profile_advance", step));
  if (step % 20 === 0) commands.push(validCommand("economy_buy", step));
  if (step % 30 === 0) commands.push(validCommand("economy_sell", step));
  if (step % 40 === 0) commands.push(validCommand("project_tick", step));
  if (step % 60 === 0) commands.push(validCommand("mission_settle", step));
  if (step % 80 === 0) commands.push(validCommand("economy_craft", step));
  if (step % 120 === 0) {
    commands.push(
      validCommand("economy_repair", step),
      validCommand("progression_reward", step),
      validCommand("progression_breakthrough", step),
      validCommand("progression_talent", step),
      validCommand("progression_skill", step),
      validCommand("progression_carry", step),
      validCommand("governance_action", step),
      validCommand("supernatural_cast", step),
      validCommand("legacy_transition", step),
    );
  }
  return commands;
}

function worldTickPayload(step: number): Record<string, unknown> {
  const regionId = REGIONS[step % REGIONS.length];
  return {
    currentWorldMinute: 100 + step - 1,
    targetWorldMinute: 100 + step,
    sourceEventIds: [`event:clock:${step}`],
    processLifeProfiles: true,
    pressures: [
      pressure("pressure_harbor", "economic", "region:region_harbor", 62 + (step % 6), 100 + step),
      pressure("pressure_ash", "ecological", "region:region_ash", 78, 90 + step),
      pressure("pressure_glass", "informational", "region:region_glass", 35 + (step % 4), 200 + step),
    ],
    ecology: {
      worldMinute: 100 + step,
      sourceEventIds: [`event:ecology:${step}`],
      stocks: [
        stock("region_harbor", "water", 80 - (step % 5), 100),
        stock("region_ash", "water", 72 - (step % 5), 100),
        stock("region_glass", "water", 68 - (step % 5), 100),
        stock("region_harbor", "grain", 65 + (step % 8), 120),
      ],
      populations: [
        population(regionId, "heron", 40 + (step % 7), 100),
        population("region_ash", "moth", 30 + (step % 5), 80),
      ],
      flows: [{
        fromRegionId: regionId,
        toRegionId: "region_harbor",
        resourceKey: "water",
        quantity: 1,
      }],
    },
  };
}

function stock(regionId: string, resourceKey: string, stockValue: number, capacity: number) {
  return {
    regionId,
    resourceKey,
    stock: stockValue,
    capacity,
    regenerationPerTick: 6,
    extractionPerTick: 4,
    pollution: 10,
    degradation: 2,
    restorationPerTick: 1,
    irreversibleThreshold: 90,
    irreversible: false,
  };
}

function population(regionId: string, speciesId: string, populationValue: number, carryingCapacity: number) {
  return {
    regionId,
    speciesId,
    population: populationValue,
    carryingCapacity,
    growthPerTick: 4,
    mortalityPerTick: 2,
    migrationOutPerTick: 1,
    migrationPreference: { region_harbor: 1 },
    irreversibleMinimum: 2,
    extinct: false,
  };
}

function validCommand(commandType: InfiniteWorldCommandType, step: number): InfiniteWorldCommandV1 {
  const sourceEventIds = [`event:source:${step}:${commandType}`];
  const context = {
    actionId: `action_${step}_${commandType}`,
    actor: ACTORS[step % ACTORS.length],
    occurredAtWorldMinute: 100 + step,
    sourceEventIds,
    authorizationRefs: ["auth:runtime:soak"],
  };
  switch (commandType) {
    case "world_tick":
      return baseCommand(commandType, worldTickPayload(step), step);
    case "resource_node_register":
      return baseCommand(commandType, {
        input: {
          nodeId: RESOURCE_NODE_ID,
          resourceKey: "iron_ore",
          resourceClass: "material",
          unit: "minor_unit",
          capacity: "9",
          remainingUnits: "9",
          yieldPerWorkUnit: "3",
          workerSlots: 1,
          worldTime: 100 + step,
        },
      }, step);
    case "resource_production_assign":
      return baseCommand(commandType, {
        input: {
          assignmentId: "assignment_soak_miner",
          nodeId: RESOURCE_NODE_ID,
          workerRef: "worker:soak_miner",
          targetAccountRef: RESOURCE_ACCOUNT_REF,
          workUnits: "1",
          worldTime: 100 + step,
          sourceEventIds,
          authorizationRefs: ["auth:resource:soak"],
        },
      }, step);
    case "resource_produce":
      return baseCommand(commandType, {
        nodeId: RESOURCE_NODE_ID,
        resourceKey: "iron_ore",
        targetAccountRef: RESOURCE_ACCOUNT_REF,
        sourceEventIds,
        authorizationRefs: ["auth:resource:soak"],
        effectId: `resource_produce_soak_${step}`,
      }, step);
    case "resource_node_replenish":
      return baseCommand(commandType, {
        input: {
          nodeId: RESOURCE_NODE_ID,
          amount: "4",
          worldTime: 100 + step,
        },
      }, step);
    case "life_profile_create":
      return baseCommand(commandType, {
        profileId: LIFE_PROFILE_ID,
        input: lifeProfileCreateInput(100 + step),
      }, step);
    case "life_profile_advance":
      return baseCommand(commandType, {
        profileId: LIFE_PROFILE_ID,
        toWorldMinute: 100 + step,
      }, step);
    case "mission_settle":
      return baseCommand(commandType, {
        input: {
          contract: missionContract(step),
          outcome: "costly_success",
          objectiveResults: [{ objectiveId: "objective_runtime", completedBps: 8000, required: true }],
          actorRef: "actor:player",
          occurredAtWorldMinute: 100 + step,
          sourceEventIds,
        },
      }, step);
    case "economy_buy":
      return baseCommand(commandType, {
        state: economyState(step),
        input: { context, buyerAccountRef: "buyer", offerId: "iron_offer", quantityMinor: "1" },
      }, step);
    case "economy_sell":
      return baseCommand(commandType, {
        state: economyState(step),
        input: {
          context,
          sellerAccountRef: "seller",
          merchantAccountRef: "merchant",
          resourceKey: "iron_alloy",
          quantityMinor: "1",
          priceResourceKey: "coin",
        },
      }, step);
    case "economy_craft":
      return baseCommand(commandType, {
        state: economyState(step),
        input: {
          context,
          crafterAccountRef: "crafter",
          recipeId: "forge_field_blade",
          materialInputs: [
            materialInput(`mat_iron_${step}`, "iron_alloy", "3"),
            materialInput(`mat_carbon_${step}`, "carbon_flux", "1"),
            materialInput(`mat_fuel_${step}`, "fuel_coke", "1"),
          ],
          crafterSkill: 90,
          workstationQuality: 70,
          processControl: 80,
          outputItemRef: `item_forged_${step}`,
          seed: `seed_${step}`,
        },
      }, step);
    case "economy_repair":
      return baseCommand(commandType, {
        state: economyState(step),
        input: {
          context,
          repairerAccountRef: "crafter",
          payerAccountRef: "crafter",
          itemRef: "blade_damaged",
          recipeId: "repair_metalwork",
          materialInputs: [
            materialInput(`mat_repair_iron_${step}`, "iron_alloy", "1"),
            materialInput(`mat_repair_flux_${step}`, "carbon_flux", "1"),
          ],
          repairerSkill: 80,
          workstationQuality: 80,
          processControl: 80,
        },
      }, step);
    case "progression_reward":
      return baseCommand(commandType, {
        input: {
          identityId: "identity_alpha",
          outcome: "forced_extraction",
          rewardSourceRef: `reward:run:${step}`,
          confirmedClaimValue: 100,
          unconfirmedClaimValue: 50,
          practiceEvidenceXp: 20,
          insightEvidence: 30,
          materials: [{ materialId: "primary", quantity: 2 }],
          sourceEventIds,
        },
      }, step);
    case "progression_breakthrough":
      return baseCommand(commandType, {
        state: progressionState(),
        input: {
          targetStage: 3,
          facilityTier: 2,
          preparedMaterials: [
            { materialId: "primary", quantity: 8 },
            { materialId: "stabilizer", quantity: 2 },
            { materialId: "catalyst", quantity: 1 },
          ],
          sourceEventIds,
          frozenSeedRef: `seed:breakthrough:${step}`,
        },
      }, step);
    case "progression_talent":
      return baseCommand(commandType, {
        state: progressionState(),
        input: { addTalents: [{ talentId: `scar_sense_${step}`, impact: "minor", source: "scar" }] },
      }, step);
    case "progression_skill":
      return baseCommand(commandType, {
        state: progressionState(),
        input: {
          node: {
            nodeId: `breath_edge_${step}`,
            tier: "tier2",
            kind: "method_unlock",
            prerequisiteNodeIds: ["root_breath"],
            materialCost: [{ materialId: "primary", quantity: 2 }],
          },
          sourceEventIds,
          availableMaterials: [{ materialId: "primary", quantity: 2 }],
        },
      }, step);
    case "progression_carry":
      return baseCommand(commandType, {
        state: progressionState(),
        input: {
          targetCarrySlots: 4,
          targetDeploymentCapacity: 8,
          targetQuickUseSlots: 3,
          targetEchoSlots: 2,
          targetInsuranceLayers: 1,
          sourceEventIds,
        },
      }, step);
    case "governance_action":
      return baseCommand(commandType, {
        state: governanceState(),
        action: {
          actionId: `action_enact_${step}`,
          kind: "enact_law",
          actorRef: "faction:faction_alpha",
          targetRef: "law:law_charter",
          sourceRef: "event:hearing",
          worldMinute: 100 + step,
          sourceEventIds,
          authorizationRefs: ["authority:council"],
          requiredAuthorityRefs: ["authority:council"],
          oppositionRefs: ["faction:opposition"],
          cost: {},
        },
      }, step);
    case "supernatural_cast":
      return baseCommand(commandType, {
        actorSnapshot: supernaturalActor(),
        intent: {
          commandId: `cmd_cast_${step}`,
          worldId: WORLD_ID,
          casterRef: "identity:caster",
          capabilityId: "capability:moon",
          operation: "observe",
          targetRefs: [{ entityType: "identity", entityId: "target" }],
          intensityMinor: 5000,
          occurredAtWorldMinute: 100 + step,
          authorizationRefs: ["auth:cost"],
          sourceEventIds,
          declaredCosts: [{
            resourceKey: "aether",
            resourceClass: "aether",
            unit: "drop",
            quantityMinor: "300",
            accountRef: "account:caster:aether",
            authorizationRef: "auth:cost",
          }],
          desiredWorldFactChange: "none",
        },
        capabilities: [supernaturalCapability()],
      }, step);
    case "legacy_transition":
      return baseCommand(commandType, {
        snapshot: mortalitySnapshot(),
        intent: {
          commandId: `cmd_legacy_${step}`,
          causeEventIds: sourceEventIds,
          occurredAtWorldMinute: 100 + step,
          advanceWorldMinutes: 10,
          requestedTransition: "settle_legacy",
          heirRef: "identity:heir",
          authorizationRefs: ["inheritance:lineage:alpha:identity:heir"],
        },
      }, step);
    case "project_tick":
      return baseCommand(commandType, {
        input: {
          commandId: `cmd_project_${step}`,
          worldId: WORLD_ID,
          project: projectSnapshot(),
          toWorldMinute: 100 + step + 1,
          sourceEventIds,
        },
      }, step);
  }
}

function lifeProfileCreateInput(worldMinute: number) {
  return {
    worldMinute,
    actors: [{
      actorKind: "actor",
      actorRef: LIFE_ACTOR_REF,
      householdRef: LIFE_HOUSEHOLD_REF,
      identityKind: "both",
      body: {
        hunger: 1_000,
        thirst: 1_000,
        fatigue: 5_000,
        stress: 2_000,
        health: 8_000,
        mood: 6_000,
        belonging: 5_000,
        purpose: 5_000,
      },
      mind: {
        hunger: 1_000,
        thirst: 1_000,
        fatigue: 4_000,
        stress: 2_000,
        health: 8_000,
        mood: 6_000,
        belonging: 5_000,
        purpose: 5_000,
      },
      skills: [{ skillRef: "skill:ledger_math", progressBps: 0, studiedWorldMinutes: 0 }],
      work: {
        employerAccountRef: "external:harbor_foundry",
        wagePerWorldMinute: 2,
        schedule: [{ startMinuteOfDay: 120, endMinuteOfDay: 180 }],
      },
      study: {
        schoolAccountRef: "external:night_school",
        skillRef: "skill:ledger_math",
        progressBpsPerWorldMinute: 25,
        tuitionPerWorldMinute: 1,
        materialPerWorldMinute: 1,
        schedule: [{ startMinuteOfDay: 200, endMinuteOfDay: 260 }],
      },
      sleep: {
        schedule: [{ startMinuteOfDay: 1_320, endMinuteOfDay: 360 }],
      },
    }],
    households: [{
      householdRef: LIFE_HOUSEHOLD_REF,
      memberActorRefs: [LIFE_ACTOR_REF],
      resourceAccountRef: "account:life:soak_household",
      resources: {
        money: 500,
        food: 1_000,
        water: 1_000,
        tuition_credit: 500,
        skill_material: 500,
      },
      debt: {},
    }],
    externalAccounts: {
      "external:harbor_foundry": { money: 10_000 },
      "external:night_school": { money: 0, tuition_credit: 0, skill_material: 0 },
      "external:market": { food: 10_000, water: 10_000 },
    },
  };
}

function economyState(step: number) {
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
      buyer: account("buyer", { coin: "100000", iron_alloy: "1000" }),
      merchant: account("merchant", { coin: "100000", iron_alloy: "1000" }),
      seller: account("seller", { coin: "100000", iron_alloy: "1000" }),
      crafter: account("crafter", { iron_alloy: "1000", carbon_flux: "1000", fuel_coke: "1000" }),
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
        durability: { current: Math.max(1, 80 - (step % 20)), max: 100 },
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
    capacityMinor: "1000000",
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

function progressionState(): ProgressionState {
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
  };
}

function missionContract(step: number) {
  return {
    contractId: `mission_runtime_${step}`,
    worldId: WORLD_ID,
    status: "active",
    interventionFamily: "combat",
    rootPressureIds: ["pressure_ash"],
    sponsorRef: "faction:runtime",
    beneficiaryRefs: ["settlement:runtime"],
    oppositionRefs: ["faction:opposition"],
    objectivePredicates: [{
      objectiveId: "objective_runtime",
      title: "Resolve runtime pressure",
      targetRef: { entityType: "pressure", entityId: "pressure_ash" },
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
    authorizationRefs: ["auth:runtime:soak"],
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
    resourceBalancesMinor: { "aether:drop": "1000000000" },
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
    resourceCosts: [{
      resourceKey: "aether",
      resourceClass: "aether",
      unit: "drop",
      quantityMinor: "300",
      accountRef: "account:caster:aether",
      authorizationRef: "auth:cost",
    }],
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
    stages: [{
      stageId: "stage:foundation",
      order: 1,
      requiredProgressMinor: 800,
      requiredInputRefs: ["charter"],
      maintenanceCostMinorPerDay: "100",
      riskMinorPerDay: 100,
    }],
    committedInputRefs: ["charter"],
    personnel: [{
      actorRef: "identity:builder",
      role: "foreman",
      availableWorldMinutesPerDay: 240,
      skillMinor: 100,
      upkeepMinorPerDay: "20",
    }],
    treasuryAccountRef: "account:lineage:treasury",
    treasuryResourceKey: "coin",
    treasuryUnit: "minor",
    treasuryBalanceMinor: "100000",
    maintenanceDebtMinor: "0",
    riskMinor: 0,
    lastAdvancedWorldMinute: 100,
    authorizationRefs: ["auth:project"],
  };
}

async function runBaseline() {
  let world = runtime();
  const committed: CausalWorldEventV1[] = [];
  const commandTypes = new Set<InfiniteWorldCommandType>();
  const checkpoints: CausalWorldSnapshotV1[] = [];

  for (let step = 1; step <= TOTAL_WORLD_TICKS; step += 1) {
    for (const command of commandsForStep(step).map((entry) => withStrictWorldStreamVersion(entry, 1))) {
      const result = await world.execute(command);
      committed.push(result.event);
      commandTypes.add(command.commandType);
      assertDomainResultBounds(result);
      world = runtime({
        initialSnapshot: strictResourceSnapshot(world.snapshot()),
      });
    }
    if (step % CHECKPOINT_EVERY === 0) {
      checkpoints.push(assertCausalWorldSnapshotV1(world.snapshot()));
    }
  }
  await world.drain();
  return { world, committed, commandTypes, checkpoints };
}

async function runWithRestarts() {
  const idempotencyStore = createInMemoryCausalIdempotencyManifestStore();
  let world = runtime({ idempotencyStore });
  const committed: CausalWorldEventV1[] = [];
  const checkpoints: CausalWorldSnapshotV1[] = [];

  for (let step = 1; step <= TOTAL_WORLD_TICKS; step += 1) {
    const commands = commandsForStep(step).map((entry) => withStrictWorldStreamVersion(entry, 1));
    for (const command of commands) {
      const beforeEvents = world.events().length;
      const result = await world.execute(command);
      const replayed = await world.execute(command);
      assert.equal(replayed.replayed, true);
      assert.equal(world.events().length, beforeEvents + 1);
      committed.push(result.event);
      assertDomainResultBounds(result);
      world = runtime({
        initialSnapshot: strictResourceSnapshot(world.snapshot()),
        idempotencyStore,
      });
    }
    if (step % CHECKPOINT_EVERY === 0) {
      const checkpoint = assertCausalWorldSnapshotV1(world.snapshot());
      checkpoints.push(checkpoint);
      const replayProbe = commands[0];
      const beforeRestartReplayEvents = world.events().length;
      const restartedForReplay = runtime({
        initialSnapshot: checkpoint,
        initialEvents: [committed.find((event) => event.command.idempotencyKey === replayProbe.idempotencyKey)!],
        idempotencyStore,
      });
      const replayedAfterRestart = await restartedForReplay.execute(replayProbe);
      assert.equal(replayedAfterRestart.replayed, true);
      assert.equal(restartedForReplay.events().length, 1);
      assert.equal(world.events().length, beforeRestartReplayEvents);
      world = runtime({
        initialSnapshot: checkpoint,
        idempotencyStore,
      });
    }
  }
  await world.drain();
  return { world, committed, idempotencyStore, checkpoints };
}

function assertDomainResultBounds(result: InfiniteWorldRuntimeResult): void {
  const payload = result.event.payload as Readonly<Record<string, unknown>>;
  const pressureResult = recordValue(payload.pressureResult);
  if (pressureResult) {
    for (const pressureEntry of arrayValue(pressureResult.pressures)) {
      assertFiniteBoundedNumber(pressureEntry.severity, 0, 100, "pressure.severity");
      assertFiniteBoundedNumber(pressureEntry.urgency, 0, 100, "pressure.urgency");
      assertFiniteBoundedNumber(pressureEntry.uncertainty, 0, 100, "pressure.uncertainty");
      assertFiniteBoundedNumber(pressureEntry.visibility, 0, 100, "pressure.visibility");
    }
  }
  const ecologyResult = recordValue(payload.ecologyResult);
  if (ecologyResult) {
    for (const stockEntry of arrayValue(ecologyResult.stocks)) {
      assertFiniteBoundedNumber(stockEntry.stock, 0, numberValue(stockEntry.capacity), "ecology.stock");
      assertFiniteBoundedNumber(stockEntry.pollution, 0, 100, "ecology.pollution");
    }
    for (const populationEntry of arrayValue(ecologyResult.populations)) {
      assertFiniteBoundedNumber(populationEntry.population, 0, numberValue(populationEntry.carryingCapacity), "ecology.population");
    }
  }
}

function assertFinalInvariants(snapshot: CausalWorldSnapshotV1, committedCount: number): void {
  assert.equal(Number.isFinite(committedCount), true);
  assert.equal(committedCount > TOTAL_WORLD_TICKS, true);
  for (const account of snapshot.balances.accounts) {
    assert.equal(isFiniteIntegerString(account.balanceMinor), true, `${account.accountRef}:${account.resourceKey} is finite`);
    assert.equal(BigInt(account.balanceMinor) >= 0n, true, `${account.accountRef}:${account.resourceKey} is non-negative`);
  }
  for (const pressureEntry of snapshot.pressure.active) {
    assertFiniteBoundedNumber(pressureEntry.severity, 0, 100, `${pressureEntry.pressureId}.severity`);
    assertFiniteBoundedNumber(pressureEntry.urgency, 0, 100, `${pressureEntry.pressureId}.urgency`);
    assertFiniteBoundedNumber(pressureEntry.growthRate, -100, 100, `${pressureEntry.pressureId}.growthRate`);
    assertFiniteBoundedNumber(pressureEntry.uncertainty, 0, 100, `${pressureEntry.pressureId}.uncertainty`);
    assertFiniteBoundedNumber(pressureEntry.visibility, 0, 100, `${pressureEntry.pressureId}.visibility`);
  }
  for (const lod of Object.values(snapshot.actorMind.lodBySubject)) {
    assert.equal([0, 1, 2, 3].includes(lod.simulationLod), true, `${lod.subjectRef} LOD is bounded`);
    assert.equal(lod.commitments.length > 0, true, `${lod.subjectRef} commitments preserved`);
  }
  assert.equal(snapshot.actorMind.mindsByActor["agent:keeper"].commitments.includes("commitment:escort"), true);
  assert.equal(snapshot.ownership.titleOwners["facility:project:runtime"], "lineage:alpha");
  assertResourceNodeInvariants(snapshot);
  assertLifeProfileInvariants(snapshot);
}

function assertResourceNodeInvariants(snapshot: CausalWorldSnapshotV1): void {
  const node = snapshot.domains.resourceProductionNodes.find((entry) => entry.nodeId === RESOURCE_NODE_ID);
  assert.ok(node, "soak resource node is preserved");
  assert.equal(node.capacity, "9");
  assert.equal(node.remainingUnits, "0");
  assert.equal(node.depletedAtWorldTime, 155);
  assert.equal(BigInt(node.remainingUnits) >= 0n, true, "resource node remainingUnits is non-negative");

  const nodeBalance = snapshot.balances.byAccount[`resource_node_inventory:${RESOURCE_NODE_ID}`]?.["iron_ore:minor_unit"];
  const householdBalance = snapshot.balances.byAccount[RESOURCE_ACCOUNT_REF]?.["iron_ore:minor_unit"];
  assert.equal(nodeBalance, "0");
  assert.equal(householdBalance, "13");
  assert.equal(BigInt(nodeBalance || "0") + BigInt(householdBalance || "0"), 13n, "resource node production is conserved after replenishment");
}

function assertLifeProfileInvariants(snapshot: CausalWorldSnapshotV1): void {
  const profile = snapshot.domains.lifeProfiles.find((entry) => entry.profileId === LIFE_PROFILE_ID);
  assert.ok(profile, "soak life profile is preserved");
  assert.equal(profile.state.worldMinute, 340);
  const actor = profile.state.actors.find((entry) => entry.actorRef === LIFE_ACTOR_REF);
  const household = profile.state.households.find((entry) => entry.householdRef === LIFE_HOUSEHOLD_REF);
  assert.ok(actor, "soak life profile actor is preserved");
  assert.ok(household, "soak life profile household is preserved");
  assert.equal(household.resources.money > 500, true, "household receives work wages");
  assert.equal(household.resources.food >= 0, true, "household food never goes negative");
  assert.equal(household.resources.water >= 0, true, "household water never goes negative");
  assert.equal(household.resources.tuition_credit >= 0, true, "household tuition credit never goes negative");
  assert.equal(household.resources.skill_material >= 0, true, "household skill material never goes negative");
  assert.equal(actor.skills[0]?.studiedWorldMinutes, 60);
  assert.equal(actor.skills[0]?.progressBps, 1_500);
  for (const metric of [...Object.values(actor.body), ...Object.values(actor.mind)]) {
    assertFiniteBoundedNumber(metric, 0, 10_000, "life_profile.metric");
  }
}

function assertHealthIsExplainable(world: InfiniteWorldRuntime, committedCount: number): void {
  const health = world.health();
  assert.equal(health.health.status, "ok");
  assert.equal(health.health.ready, true);
  assert.equal(health.health.reasons.length, 0);
  assert.equal(health.health.slo.ok, true);
  assert.equal(health.health.slo.violations.length, 0);
  assert.equal(committedCount > TOTAL_WORLD_TICKS, true);
  assert.equal((health.health.counters["causal_pressure_backlog_total{kind=critical}"] || 0) >= 0, true);
  assert.equal((health.health.counters["causal_lod_subject_total{lod=3}"] || 0) >= 0, true);
  assert.equal(Array.isArray(health.traces), true);
}

function assertCheckpointTamperingIsRejected(snapshot: CausalWorldSnapshotV1): void {
  assert.throws(
    () => assertCausalWorldSnapshotV1({
      ...snapshot,
      balances: {
        ...snapshot.balances,
        byAccount: {
          ...snapshot.balances.byAccount,
          "buyer#available": { ...snapshot.balances.byAccount["buyer#available"], "coin:minor": "999999999" },
        },
      },
      checkpoint: snapshot.checkpoint,
    }),
    (error: unknown) => error instanceof Error && "code" in error && error.code === "CAUSAL_SNAPSHOT_CHECKPOINT_MISMATCH",
  );
}

async function assertSameKeyDifferentInputIsRejected(
  idempotencyStore: CausalIdempotencyManifestStore,
  checkpoint: CausalWorldSnapshotV1,
  committed: readonly CausalWorldEventV1[],
): Promise<void> {
  const world = runtime({ initialSnapshot: checkpoint, initialEvents: committed, idempotencyStore });
  const command = commandsForStep(CHECKPOINT_EVERY)[0];
  await assert.rejects(
    world.execute({
      ...command,
      payload: {
        ...command.payload,
        targetWorldMinute: 10_000,
      },
    }),
    (error: unknown) => error instanceof Error && "code" in error && error.code === "causal_idempotency_conflict",
  );
  assert.equal(world.events().length, committed.length);
}

function snapshotDigest(snapshot: CausalWorldSnapshotV1) {
  return {
    hash: causalWorldSnapshotHash(snapshot),
    cursor: snapshot.replayCursor,
    events: snapshot.events,
    eventHashes: snapshot.eventHashes,
    balances: snapshot.balances,
    ownership: snapshot.ownership,
    domains: snapshot.domains,
  };
}

function recordValue(value: unknown): Readonly<Record<string, unknown>> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Readonly<Record<string, unknown>>
    : undefined;
}

function arrayValue(value: unknown): readonly Readonly<Record<string, unknown>>[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is Readonly<Record<string, unknown>> => Boolean(recordValue(entry)))
    : [];
}

function numberValue(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function assertFiniteBoundedNumber(value: unknown, min: number, max: number, label: string): void {
  assert.equal(typeof value, "number", `${label} is numeric`);
  assert.equal(Number.isFinite(value), true, `${label} is finite`);
  assert.equal((value as number) >= min, true, `${label} >= ${min}`);
  assert.equal((value as number) <= max, true, `${label} <= ${max}`);
}

function isFiniteIntegerString(value: string): boolean {
  return /^-?(0|[1-9]\d*)$/.test(value);
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (!value || typeof value !== "object") return JSON.stringify(value);
  return `{${Object.entries(value as Readonly<Record<string, unknown>>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`)
    .join(",")}}`;
}

test("deterministic restart and replay soak matches uninterrupted baseline", async () => {
  assert.equal(EXPOSED_COMMAND_TYPES.length, 21, DOMAIN_COVERAGE_NOTE);
  const baseline = await runBaseline();
  const restarted = await runWithRestarts();

  for (const commandType of EXPOSED_COMMAND_TYPES) {
    assert.equal(baseline.commandTypes.has(commandType), true, `${commandType} covered by soak command schedule`);
  }
  assert.equal(baseline.committed.length, restarted.committed.length);
  assert.deepEqual(
    restarted.committed.map((event) => event.proof.eventHash),
    baseline.committed.map((event) => event.proof.eventHash),
  );
  assert.equal(restarted.checkpoints.length, baseline.checkpoints.length);
  for (let index = 0; index < restarted.checkpoints.length; index += 1) {
    assert.deepEqual(snapshotDigest(restarted.checkpoints[index]!), snapshotDigest(baseline.checkpoints[index]!));
    assertResourceCheckpointState(restarted.checkpoints[index]!, (index + 1) * CHECKPOINT_EVERY);
    assertLifeProfileCheckpointState(restarted.checkpoints[index]!, 100 + ((index + 1) * CHECKPOINT_EVERY));
  }
  assert.deepEqual(snapshotDigest(restarted.world.snapshot()), snapshotDigest(baseline.world.snapshot()));

  assertFinalInvariants(restarted.world.snapshot(), restarted.committed.length);
  assertHealthIsExplainable(baseline.world, baseline.committed.length);
  assertCheckpointTamperingIsRejected(restarted.checkpoints[0]);
  await assertSameKeyDifferentInputIsRejected(
    restarted.idempotencyStore,
    restarted.checkpoints[0],
    restarted.committed.slice(0, restarted.checkpoints[0].replayCursor.eventCount),
  );
});

function assertResourceCheckpointState(snapshot: CausalWorldSnapshotV1, step: number): void {
  const node = snapshot.domains.resourceProductionNodes.find((entry) => entry.nodeId === RESOURCE_NODE_ID);
  assert.ok(node, `resource node exists at checkpoint ${step}`);
  assert.equal(BigInt(node.remainingUnits) >= 0n, true, `resource node is non-negative at checkpoint ${step}`);
  assert.equal(node.remainingUnits, "0", `resource node is fully depleted at checkpoint ${step}`);
  assert.equal(node.depletedAtWorldTime, 155, `resource node depletedAt is deterministic at checkpoint ${step}`);
  const nodeBalance = BigInt(snapshot.balances.byAccount[`resource_node_inventory:${RESOURCE_NODE_ID}`]?.["iron_ore:minor_unit"] || "0");
  const householdBalance = BigInt(snapshot.balances.byAccount[RESOURCE_ACCOUNT_REF]?.["iron_ore:minor_unit"] || "0");
  assert.equal(nodeBalance >= 0n, true, `resource node ledger balance is non-negative at checkpoint ${step}`);
  assert.equal(householdBalance >= 0n, true, `resource target ledger balance is non-negative at checkpoint ${step}`);
  assert.equal(nodeBalance + householdBalance, 13n, `resource ledger is conserved at checkpoint ${step}`);
}

function assertLifeProfileCheckpointState(snapshot: CausalWorldSnapshotV1, expectedWorldMinute: number): void {
  const profile = snapshot.domains.lifeProfiles.find((entry) => entry.profileId === LIFE_PROFILE_ID);
  assert.ok(profile, `life profile exists at ${expectedWorldMinute}`);
  assert.equal(profile.state.worldMinute, expectedWorldMinute);
  const actor = profile.state.actors.find((entry) => entry.actorRef === LIFE_ACTOR_REF);
  const household = profile.state.households.find((entry) => entry.householdRef === LIFE_HOUSEHOLD_REF);
  assert.ok(actor, `life actor exists at ${expectedWorldMinute}`);
  assert.ok(household, `life household exists at ${expectedWorldMinute}`);
  assert.equal(household.resources.money >= 500, true, `life household money is non-negative and wage-funded at ${expectedWorldMinute}`);
  assert.equal(household.resources.food >= 0, true, `life food is non-negative at ${expectedWorldMinute}`);
  assert.equal(household.resources.water >= 0, true, `life water is non-negative at ${expectedWorldMinute}`);
  assert.equal(household.resources.tuition_credit >= 0, true, `life tuition is non-negative at ${expectedWorldMinute}`);
  assert.equal(household.resources.skill_material >= 0, true, `life materials are non-negative at ${expectedWorldMinute}`);
  assert.equal((actor.skills[0]?.studiedWorldMinutes || 0) >= (expectedWorldMinute >= 260 ? 60 : 0), true, `life study progresses by schedule at ${expectedWorldMinute}`);
  for (const metric of [...Object.values(actor.body), ...Object.values(actor.mind)]) {
    assertFiniteBoundedNumber(metric, 0, 10_000, `life metric at ${expectedWorldMinute}`);
  }
}
