import assert from "node:assert/strict";
import test from "node:test";

import { causalCanonicalJsonHash } from "../lib/epoch/causalCanonicalJson.ts";
import {
  CAUSAL_COMMAND_SCHEMA_VERSION,
  CAUSAL_EVENT_SCHEMA_VERSION,
  CausalValidationError,
  type CausalActorRef,
  type CausalEffectV1,
  type CausalWorldEventCandidateV1,
  type CausalWorldEventV1,
  type CommandIntentV1,
} from "../lib/epoch/causalContracts.ts";
import {
  assertCausalIdempotencyReplay,
  assertCausalReservationFinalization,
  causalIdempotencyScope,
  pendingCausalManifest,
  type CausalIdempotencyManifest,
  type CausalIdempotencyManifestStore,
} from "../lib/epoch/causalIdempotencyRules.ts";
import {
  createCausalWriteCoordinator,
  type CausalCommitBundle,
  type CausalWriteSnapshot,
} from "../lib/epoch/causalWriteCoordinator.ts";
import {
  UNIFIED_ECONOMY_DEFAULT_FEE_ACCOUNT_REF,
  proposeEconomyCraft,
  proposeEconomyPurchase,
  proposeEconomyRepair,
  proposeEconomySale,
  type EconomyAccountState,
  type EconomyActionContext,
  type EconomyCraftRecipe,
  type EconomyMaterialInput,
  type EconomyResourceDefinition,
  type UnifiedEconomyState,
} from "../lib/epoch/unifiedEconomyRules.ts";
import {
  convertRunReward,
  proposeBreakthrough,
  proposeSkillUnlock,
  type ProgressionAttributeId,
  type ProgressionState,
} from "../lib/epoch/progressionRules.ts";
import {
  evaluateSupernaturalCast,
  type SupernaturalActorSnapshot,
  type SupernaturalCapabilityDef,
  type SupernaturalCastIntent,
} from "../lib/epoch/supernaturalLegacyRules.ts";

const RECORDED_AT = "2026-07-20T00:00:00.000Z";
const WORLD_ID = "world_domain_resource";
const ACTOR: CausalActorRef = { actorType: "system", actorId: "agent_alpha" };
const FAKE_HASH = `sha256:${"0".repeat(64)}` as const;

function createReservationStore() {
  let fencingToken = 0;
  const manifests = new Map<string, CausalIdempotencyManifest>();
  const store: CausalIdempotencyManifestStore = {
    read: (scope) => manifests.get(scope),
    write: (manifest) => {
      manifests.set(manifest.scope, manifest);
    },
    claimReservation(input, options) {
      const scope = causalIdempotencyScope(input);
      const existing = manifests.get(scope);
      if (existing) {
        assertCausalIdempotencyReplay(existing, input);
        if (existing.status === "committed") return { kind: "committed", manifest: existing };
        if (existing.status === "rejected") return { kind: "rejected", manifest: existing };
        return { kind: "pending", manifest: existing };
      }
      fencingToken += 1;
      const manifest = pendingCausalManifest({
        ...input,
        ownerId: options.ownerId,
        fencingToken,
        leaseExpiresAt: options.leaseExpiresAt,
        createdAt: options.now,
        updatedAt: options.now,
      });
      manifests.set(scope, manifest);
      return { kind: "reserved", reservation: { manifest } };
    },
    finalizeReservation(reservation, manifest) {
      const finalized = assertCausalReservationFinalization(reservation, manifests.get(reservation.manifest.scope), manifest);
      manifests.set(finalized.scope, finalized);
      return finalized;
    },
    async commitAtomically(reservation, manifest, commit) {
      const finalized = assertCausalReservationFinalization(reservation, manifests.get(reservation.manifest.scope), manifest);
      await commit({});
      manifests.set(finalized.scope, finalized);
      return finalized;
    },
  };
  return { store, manifests };
}

function command(commandType: string, id: string, payload: unknown = {}): CommandIntentV1 {
  return {
    commandId: `cmd_${id}`,
    commandType,
    commandSchemaVersion: CAUSAL_COMMAND_SCHEMA_VERSION,
    worldId: WORLD_ID,
    namespace: "identity",
    actor: ACTOR,
    submittedAt: RECORDED_AT,
    requestedWorldMinute: 123,
    idempotencyKey: `idem_${id}`,
    expectedStreamVersions: [],
    authorizationRefs: ["auth:domain"],
    causalParentEventIds: ["event_parent"],
    rootPressureIds: [],
    payload,
  };
}

async function commitProposal(commandType: string, id: string, effects: readonly CausalEffectV1[]) {
  const events = new Map<string, CausalWorldEventV1>();
  const commits: CausalCommitBundle[] = [];
  const store = createReservationStore();
  const coordinator = createCausalWriteCoordinator({
    idempotencyStore: store.store,
    now: () => RECORDED_AT,
    ownerId: "test-owner",
    loadSnapshot: () => snapshotFor(effects),
    buildEvent: (intent, _snapshot, context) => eventCandidate(intent, context, effects),
    commit: (bundle) => {
      commits.push(bundle);
      events.set(bundle.event.eventId, bundle.event);
    },
    loadCommittedEvent: (eventId) => events.get(eventId),
  });

  const result = await coordinator.execute(command(commandType, id, { effectCount: effects.length }));
  assert.equal(result.manifest.status, "committed");
  assert.equal(result.violations.length, 0);
  assert.equal(result.replayed, false);
  assert.equal(commits.length, 1);
  assert.equal(store.manifests.values().next().value?.status, "committed");
  return result.event;
}

async function rejectProposal(commandType: string, id: string, effects: readonly CausalEffectV1[], code: CausalValidationError["code"]) {
  const coordinator = createCausalWriteCoordinator({
    idempotencyStore: createReservationStore().store,
    now: () => RECORDED_AT,
    loadSnapshot: () => snapshotFor(effects),
    buildEvent: (intent, _snapshot, context) => eventCandidate(intent, context, effects),
    commit: () => undefined,
    loadCommittedEvent: () => undefined,
  });

  await assert.rejects(
    coordinator.execute(command(commandType, id, { effectCount: effects.length })),
    (error: unknown) => {
      assert.ok(error instanceof CausalValidationError);
      assert.equal(error.code, code);
      return true;
    },
  );
}

function snapshotFor(effects: readonly CausalEffectV1[]): CausalWriteSnapshot {
  const balances: Record<string, Record<string, string>> = {};
  for (const effect of effects) {
    if (effect.effectType !== "resource_ledger") continue;
    const after = effect.after as {
      readonly resourceKey: string;
      readonly unit: string;
      readonly entries: readonly { readonly accountRef: string; readonly quantityMinor: string }[];
    };
    for (const entry of after.entries) {
      if (BigInt(entry.quantityMinor) >= 0n) continue;
      balances[entry.accountRef] = {
        ...balances[entry.accountRef],
        [`${after.resourceKey}:${after.unit}`]: String(-BigInt(entry.quantityMinor) + 1_000n),
      };
    }
  }
  return {
    knownEvents: {
      event_parent: {
        eventId: "event_parent",
        worldId: WORLD_ID,
        occurredAtWorldMinute: 100,
        stream: { streamType: "world", streamId: WORLD_ID, streamVersion: 1 },
        causality: { causalParentEventIds: [] },
      },
    },
    balances: { balances },
  };
}

function eventCandidate(
  intent: CommandIntentV1,
  context: { readonly recordedAt: string; readonly registryVersion: string; readonly registryHash: `sha256:${string}` },
  effects: readonly CausalEffectV1[],
): CausalWorldEventCandidateV1 {
  return {
    eventId: `event_${intent.commandId}`,
    eventType: "resource_granted",
    schemaVersion: CAUSAL_EVENT_SCHEMA_VERSION,
    registryVersion: context.registryVersion,
    registryHash: context.registryHash,
    worldId: intent.worldId,
    namespace: intent.namespace,
    stream: { streamType: "identity", streamId: "identity_alpha", streamVersion: 1 },
    occurredAtWorldMinute: intent.requestedWorldMinute ?? 0,
    recordedAt: context.recordedAt,
    actorRefs: [intent.actor],
    subjectRefs: [{ entityType: "identity", entityId: "identity_alpha" }],
    regionRefs: [],
    command: {
      commandId: "candidate_spoof",
      commandType: "candidate_spoof",
      idempotencyKey: "candidate_spoof",
      inputHash: FAKE_HASH,
    },
    causality: {
      causalParentEventIds: [],
      rootPressureIds: [],
      rootReason: "world_genesis",
    },
    authorizationRefs: [],
    evidenceRefs: ["event_parent"],
    visibilityPolicyRef: "private",
    versions: {
      rulesetVersion: "domain-resource-test",
      contentVersion: "domain-resource-test",
      adjudicatorVersion: "domain-resource-test",
    },
    determinism: {
      algorithmId: "domain-resource-test",
      algorithmVersion: "1",
    },
    payload: { commandType: intent.commandType },
    effects,
    proof: {
      payloadHash: causalCanonicalJsonHash({}),
      effectsHash: causalCanonicalJsonHash([]),
      eventHash: FAKE_HASH,
    },
  };
}

function account(accountRef: string, balances: Readonly<Record<string, string>>): EconomyAccountState {
  return {
    accountRef,
    ownerRef: `owner:${accountRef}`,
    capacityMinor: "100000",
    balances: Object.entries(balances).map(([resourceKey, quantityMinor]) => ({
      resourceKey,
      bucket: "available" as const,
      quantityMinor,
    })),
  };
}

function economyResource(
  resourceKey: string,
  resourceClass: EconomyResourceDefinition["resourceClass"],
  unit: string,
  basePriceMinor = "1",
): EconomyResourceDefinition {
  return {
    resourceKey,
    resourceClass,
    unit,
    basePriceMinor,
    priceFloorMinor: "1",
    priceCeilingMinor: "1000000",
    tradable: true,
    conserved: true,
    capacityWeightMinor: "1",
    allowedSourceTypes: ["production", "merchant_inventory", "research_byproduct", "transfer"],
    allowedSinkTypes: ["transfer", "crafting", "repair", "wear", "destruction", "freeze", "market_fee"],
  };
}

const ECONOMY_RESOURCES: Readonly<Record<string, EconomyResourceDefinition>> = {
  coin: economyResource("coin", "currency", "minor_coin", "1"),
  iron_alloy: economyResource("iron_alloy", "material", "minor_unit", "8"),
  carbon_flux: economyResource("carbon_flux", "material", "minor_unit", "5"),
  fuel_coke: economyResource("fuel_coke", "energy", "minor_unit", "2"),
};

const ECONOMY_RECIPES: Readonly<Record<string, EconomyCraftRecipe>> = {
  forge_field_blade: {
    recipeId: "forge_field_blade",
    discipline: "forging",
    outputItemKey: "crafted:field-blade",
    outputQuantityMinor: "1",
    requiredMaterials: [
      { resourceKey: "iron_alloy", quantityMinor: "3", allowedProvenanceChannels: ["merchant_inventory"] },
      { resourceKey: "carbon_flux", quantityMinor: "1", allowedProvenanceChannels: ["merchant_inventory"] },
      { resourceKey: "fuel_coke", quantityMinor: "1", allowedProvenanceChannels: ["merchant_inventory"] },
    ],
    laborWorldMinutes: 180,
    facilityCapacityMinor: "180",
    minimumSkill: 10,
    baseFailureBasisPoints: "0",
  },
  repair_metalwork: {
    recipeId: "repair_metalwork",
    discipline: "forging",
    outputItemKey: "repair:metalwork",
    outputQuantityMinor: "1",
    requiredMaterials: [
      { resourceKey: "iron_alloy", quantityMinor: "2", allowedProvenanceChannels: ["merchant_inventory"] },
      { resourceKey: "fuel_coke", quantityMinor: "1", allowedProvenanceChannels: ["merchant_inventory"] },
    ],
    laborWorldMinutes: 60,
    facilityCapacityMinor: "60",
    minimumSkill: 10,
    baseFailureBasisPoints: "0",
    repairDurabilityGain: 20,
  },
};

function economyContext(actionId: string): EconomyActionContext {
  return {
    actionId,
    actor: ACTOR,
    occurredAtWorldMinute: 123,
    sourceEventIds: ["event_parent"],
    authorizationRefs: ["auth:domain"],
  };
}

function economyState(): UnifiedEconomyState {
  return {
    resources: ECONOMY_RESOURCES,
    accounts: {
      buyer: account("buyer", { coin: "1000", iron_alloy: "0" }),
      merchant: account("merchant", { coin: "1000", iron_alloy: "10" }),
      seller: account("seller", { coin: "0", iron_alloy: "5" }),
      crafter: account("crafter", { iron_alloy: "10", carbon_flux: "10", fuel_coke: "10" }),
      [UNIFIED_ECONOMY_DEFAULT_FEE_ACCOUNT_REF]: account(UNIFIED_ECONOMY_DEFAULT_FEE_ACCOUNT_REF, { coin: "0" }),
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
        replenishmentSourceRef: "merchant:daily:iron",
        sourceType: "merchant_inventory",
      },
    },
    recipes: ECONOMY_RECIPES,
    items: {
      blade_damaged: {
        itemRef: "blade_damaged",
        itemKey: "crafted:field-blade",
        titleOwnerRef: "agent_alpha",
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

function materialInput(materialRef: string, resourceKey: string, quantityMinor: string): EconomyMaterialInput {
  return {
    materialRef,
    resourceKey,
    accountRef: "crafter",
    quantityMinor,
    quality: 80,
    provenanceChannel: "merchant_inventory",
    sourceEventIds: ["event_parent"],
  };
}

const progressionAttributes: Record<ProgressionAttributeId, number> = {
  strength: 30,
  agility: 30,
  physique: 30,
  intellect: 30,
  willpower: 30,
  spirituality: 30,
};

function progressionState(): ProgressionState {
  return {
    identityId: "identity_alpha",
    lineageId: "lineage_alpha",
    functionalStage: 2,
    powerSystemId: "eastern_cultivation",
    attributes: progressionAttributes,
    resources: {
      functionalXp: 400,
      insightPoints: 3,
      skillPointsSpent: 0,
      lineageMarks: 1,
      methodProficiency: { breath: 300 },
      domainInsight: { dream_mind: 30 },
    },
    learnedSkillNodeIds: ["root_breath"],
    qualificationRefs: ["qualification:eastern"],
  };
}

function supernaturalActor(): SupernaturalActorSnapshot {
  return {
    actorRef: "identity:caster",
    state: "active",
    worldMinute: 100,
    permissions: ["self", "owner_consent"],
    prerequisiteRefs: ["prereq:moon-vessel"],
    knowledgeRefs: ["knowledge:ward-script"],
    cooldownReadyAtByCapabilityId: {},
    resourceBalancesMinor: { "aether:drop": "900" },
    pollutionMinor: 0,
    exposureMinor: 0,
    instabilityMinor: 0,
  };
}

function supernaturalCapability(): SupernaturalCapabilityDef {
  return {
    capabilityId: "capability:moon-bind",
    source: "arcane",
    operations: ["bind"],
    domains: ["oath"],
    validTargetTypes: ["identity"],
    requiredPermissions: ["self", "owner_consent"],
    requiredPrerequisiteRefs: ["prereq:moon-vessel"],
    requiredKnowledgeRefs: ["knowledge:ward-script"],
    resourceCosts: [{
      resourceKey: "aether",
      resourceClass: "aether",
      unit: "drop",
      quantityMinor: "300",
      accountRef: "account:caster:aether",
      authorizationRef: "auth:cost",
    }],
    timeCostWorldMinutes: 30,
    cooldownWorldMinutes: 120,
    minCounterWindowWorldMinutes: 10,
    risk: { pollutionMinor: 0, exposureMinor: 0, backlashMinor: 0, legalHeatMinor: 0, instabilityMinor: 0 },
    legalClassRefs: [],
    evidenceSignatureRefs: ["sig:moon"],
    mayCreateWorldFact: false,
    mayRewritePastFact: false,
    maxTargets: 1,
  };
}

function supernaturalIntent(): SupernaturalCastIntent {
  return {
    commandId: "cmd_cast",
    worldId: WORLD_ID,
    casterRef: "identity:caster",
    capabilityId: "capability:moon-bind",
    operation: "bind",
    targetRefs: [{ entityType: "identity", entityId: "target" }],
    intensityMinor: 5000,
    occurredAtWorldMinute: 123,
    authorizationRefs: ["auth:domain"],
    sourceEventIds: ["event_parent"],
    rootPressureIds: [],
    declaredCosts: [{
      resourceKey: "aether",
      resourceClass: "aether",
      unit: "drop",
      quantityMinor: "300",
      accountRef: "account:caster:aether",
      authorizationRef: "auth:cost",
    }],
    counterWindow: {
      opensAtWorldMinute: 124,
      closesAtWorldMinute: 140,
      counterVerbs: ["break"],
      evidenceSignatureRefs: ["sig:moon"],
      targetRefs: ["identity:target"],
    },
  };
}

function resourceLedgerEffects(effects: readonly CausalEffectV1[]): readonly CausalEffectV1[] {
  return effects.filter((effect) => effect.effectType === "resource_ledger");
}

function withCreationSource(effect: CausalEffectV1, creationSourceRef: string): CausalEffectV1 {
  const { destructionSinkRef: _destructionSinkRef, ...after } = effect.after as Record<string, unknown>;
  return { ...effect, after: { ...after, creationSourceRef } };
}

function withDestructionSink(effect: CausalEffectV1, destructionSinkRef: string): CausalEffectV1 {
  const { creationSourceRef: _creationSourceRef, ...after } = effect.after as Record<string, unknown>;
  return { ...effect, after: { ...after, destructionSinkRef } };
}

test("economy buy sell craft and repair proposals commit through the default coordinator policy", async () => {
  const state = economyState();
  const purchase = proposeEconomyPurchase(state, { context: economyContext("purchase"), buyerAccountRef: "buyer", offerId: "iron_offer" });
  const sale = proposeEconomySale(state, { context: economyContext("sale"), sellerAccountRef: "seller", merchantAccountRef: "merchant", resourceKey: "iron_alloy", quantityMinor: "5", priceResourceKey: "coin" });
  const craft = proposeEconomyCraft(state, {
    context: economyContext("craft"),
    crafterAccountRef: "crafter",
    recipeId: "forge_field_blade",
    materialInputs: [
      materialInput("mat_iron", "iron_alloy", "3"),
      materialInput("mat_carbon", "carbon_flux", "1"),
      materialInput("mat_fuel", "fuel_coke", "1"),
    ],
    crafterSkill: 80,
    workstationQuality: 80,
    processControl: 80,
    seed: "success_seed",
  });
  const repair = proposeEconomyRepair(state, {
    context: economyContext("repair"),
    repairerAccountRef: "crafter",
    payerAccountRef: "crafter",
    itemRef: "blade_damaged",
    recipeId: "repair_metalwork",
    materialInputs: [materialInput("mat_iron", "iron_alloy", "2"), materialInput("mat_fuel", "fuel_coke", "1")],
    repairerSkill: 80,
    workstationQuality: 80,
    processControl: 80,
  });

  assert.equal(purchase.ok, true);
  assert.equal(sale.ok, true);
  assert.equal(craft.ok, true);
  assert.equal(repair.ok, true);
  if (!purchase.ok || !sale.ok || !craft.ok || !repair.ok) throw new Error("expected economy proposals");

  await commitProposal("economy.purchase", "economy_purchase", purchase.value.effects);
  await commitProposal("economy.sell", "economy_sell", sale.value.effects);
  await commitProposal("economy.craft", "economy_craft", craft.value.effects);
  await commitProposal("economy.repair", "economy_repair", repair.value.effects);

  assert.equal(resourceLedgerEffects(purchase.value.effects).some((effect) => "creationSourceRef" in effect.after), false);
  assert.equal(resourceLedgerEffects(sale.value.effects).some((effect) => "destructionSinkRef" in effect.after), false);
});

test("progression reward breakthrough and skill proposals commit through the default coordinator policy", async () => {
  const state = progressionState();
  const reward = convertRunReward({
    identityId: "identity_alpha",
    outcome: "forced_extraction",
    rewardSourceRef: "escrow:run_1",
    confirmedClaimValue: 100,
    unconfirmedClaimValue: 50,
    practiceEvidenceXp: 20,
    insightEvidence: 30,
    materials: [{ materialId: "primary", quantity: 6 }],
    sourceEventIds: ["event_parent"],
  });
  const breakthrough = proposeBreakthrough(state, {
    targetStage: 3,
    facilityTier: 2,
    preparedMaterials: [
      { materialId: "primary", quantity: 8 },
      { materialId: "stabilizer", quantity: 2 },
      { materialId: "catalyst", quantity: 1 },
    ],
    sourceEventIds: ["event_parent"],
    frozenSeedRef: "seed:breakthrough_3",
  });
  const skill = proposeSkillUnlock(state, {
    node: { nodeId: "node_guard", tier: "tier1", kind: "method_unlock", prerequisiteNodeIds: ["root_breath"], materialCost: [{ materialId: "primary", quantity: 1 }] },
    sourceEventIds: ["event_parent"],
    availableMaterials: [{ materialId: "primary", quantity: 1 }],
  });

  assert.equal(reward.ok, true);
  assert.equal(breakthrough.ok, true);
  assert.equal(skill.ok, true);

  await commitProposal("progression.run_reward_converted", "progression_reward", reward.effects);
  await commitProposal("progression.functional_stage_advanced", "progression_breakthrough", breakthrough.effects);
  await commitProposal("progression.skill_node_unlocked", "progression_skill", skill.effects);
});

test("supernatural cast costs commit through the default coordinator policy", async () => {
  const result = evaluateSupernaturalCast({
    actor: supernaturalActor(),
    intent: supernaturalIntent(),
    capabilities: [supernaturalCapability()],
  });

  assert.equal(result.ok, true);
  assert.ok(result.value);
  await commitProposal("supernatural.cast_committed", "supernatural_cast", result.value.effects.map((effect) => effect.causalEffect));
});

test("default coordinator rejects unknown resource sources and sinks", async () => {
  const reward = convertRunReward({
    identityId: "identity_alpha",
    outcome: "forced_extraction",
    rewardSourceRef: "escrow:run_1",
    confirmedClaimValue: 100,
    unconfirmedClaimValue: 0,
    practiceEvidenceXp: 0,
    insightEvidence: 0,
    sourceEventIds: ["event_parent"],
  });
  const breakthrough = proposeBreakthrough(progressionState(), {
    targetStage: 3,
    facilityTier: 2,
    preparedMaterials: [
      { materialId: "primary", quantity: 8 },
      { materialId: "stabilizer", quantity: 2 },
      { materialId: "catalyst", quantity: 1 },
    ],
    sourceEventIds: ["event_parent"],
    frozenSeedRef: "seed:breakthrough_3",
  });

  assert.equal(reward.ok, true);
  assert.equal(breakthrough.ok, true);

  await rejectProposal("progression.run_reward_converted", "unknown_source", [
    withCreationSource(resourceLedgerEffects(reward.effects)[0]!, "source:unknown"),
  ], "RESOURCE_SOURCE_DENIED");
  await rejectProposal("progression.functional_stage_advanced", "unknown_sink", [
    withDestructionSink(resourceLedgerEffects(breakthrough.effects)[0]!, "sink:unknown"),
  ], "RESOURCE_SINK_DENIED");
});
