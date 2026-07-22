import assert from "node:assert/strict";
import test from "node:test";

import {
  advanceLegacyProject,
  evaluateSupernaturalCast,
  settleMortalityAndLegacy,
  type LegacyAssetSnapshot,
  type LegacyProjectSnapshot,
  type MortalityLegacySnapshot,
  type SupernaturalActorSnapshot,
  type SupernaturalCapabilityDef,
  type SupernaturalCastIntent,
  type SupernaturalRuleResult,
} from "../lib/epoch/supernaturalLegacyRules.ts";
import type { CausalEffectV1, CausalEntityRef } from "../lib/epoch/causalContracts.ts";

function entity(entityType: string, entityId: string): CausalEntityRef {
  return { entityType, entityId };
}

function errorCodes(result: SupernaturalRuleResult<unknown>) {
  return result.errors.map((error) => error.code);
}

function effects(result: SupernaturalRuleResult<{ readonly effects: readonly { readonly causalEffect: CausalEffectV1 }[] }>) {
  assert.equal(result.ok, true);
  assert.ok(result.value);
  return result.value.effects.map((proposal) => proposal.causalEffect);
}

function effectTypes(result: SupernaturalRuleResult<{ readonly effects: readonly { readonly causalEffect: CausalEffectV1 }[] }>) {
  return effects(result).map((effect) => effect.effectType).sort();
}

function actor(overrides: Partial<SupernaturalActorSnapshot> = {}): SupernaturalActorSnapshot {
  return {
    actorRef: "identity:caster",
    state: "active",
    worldMinute: 100,
    permissions: ["self", "owner_consent"],
    prerequisiteRefs: ["prereq:moon-vessel"],
    knowledgeRefs: ["knowledge:ward-script"],
    cooldownReadyAtByCapabilityId: {},
    resourceBalancesMinor: {
      "aether:drop": "900",
      "focus:point": "500",
    },
    pollutionMinor: 100,
    exposureMinor: 200,
    instabilityMinor: 300,
    ...overrides,
  };
}

function capability(overrides: Partial<SupernaturalCapabilityDef> = {}): SupernaturalCapabilityDef {
  return {
    capabilityId: "capability:moon-bind",
    source: "arcane",
    operations: ["bind", "observe", "forecast"],
    domains: ["oath", "lineage"],
    validTargetTypes: ["identity", "relic"],
    requiredPermissions: ["self", "owner_consent"],
    requiredPrerequisiteRefs: ["prereq:moon-vessel"],
    requiredKnowledgeRefs: ["knowledge:ward-script"],
    resourceCosts: [
      {
        resourceKey: "aether",
        resourceClass: "aether",
        unit: "drop",
        quantityMinor: "300",
        accountRef: "account:caster:aether",
        authorizationRef: "auth:cost",
      },
    ],
    timeCostWorldMinutes: 30,
    cooldownWorldMinutes: 120,
    minCounterWindowWorldMinutes: 10,
    risk: {
      pollutionMinor: 120,
      exposureMinor: 80,
      backlashMinor: 60,
      legalHeatMinor: 40,
      instabilityMinor: 20,
    },
    legalClassRefs: ["legal:registered-thaumaturgy"],
    evidenceSignatureRefs: ["sig:moon", "sig:oath"],
    mayCreateWorldFact: false,
    mayRewritePastFact: false,
    maxTargets: 2,
    ...overrides,
  };
}

function castIntent(overrides: Partial<SupernaturalCastIntent> = {}): SupernaturalCastIntent {
  return {
    commandId: "cmd_cast_1",
    worldId: "world_1",
    casterRef: "identity:caster",
    capabilityId: "capability:moon-bind",
    operation: "bind",
    targetRefs: [entity("identity", "target_b"), entity("identity", "target_a")],
    intensityMinor: 5000,
    occurredAtWorldMinute: 150,
    authorizationRefs: ["auth:z", "auth:a", "auth:z"],
    sourceEventIds: ["event:z", "event:a", "event:z"],
    rootPressureIds: ["pressure:root"],
    declaredCosts: [
      {
        resourceKey: "aether",
        resourceClass: "aether",
        unit: "drop",
        quantityMinor: "300",
        accountRef: "account:caster:aether",
        authorizationRef: "auth:cost",
      },
    ],
    counterWindow: {
      opensAtWorldMinute: 151,
      closesAtWorldMinute: 170,
      counterVerbs: ["sever", "audit", "sever"],
      evidenceSignatureRefs: ["sig:oath", "sig:moon", "sig:oath"],
      targetRefs: ["identity:target_b", "identity:target_a", "identity:target_b"],
    },
    desiredWorldFactChange: "none",
    ...overrides,
  };
}

function legacyAsset(overrides: Partial<LegacyAssetSnapshot>): LegacyAssetSnapshot {
  return {
    assetId: "asset:institution",
    assetType: "institution",
    ownerRef: "identity:dead",
    titleRef: "title:institution",
    transferable: true,
    authorizedHeirRefs: ["identity:heir"],
    valueMinor: "1200",
    sourceEventIds: ["event:asset"],
    ...overrides,
  };
}

function mortalitySnapshot(overrides: Partial<MortalityLegacySnapshot> = {}): MortalityLegacySnapshot {
  return {
    worldId: "world_1",
    lineageRef: "lineage:alpha",
    identityRef: "identity:dead",
    nextIdentityRef: "identity:next",
    state: "dead",
    worldMinute: 1_000,
    injuries: [
      {
        injuryId: "injury:lethal",
        severityMinor: 10000,
        untreatedWorldMinutes: 30,
        lethal: true,
        sourceEventIds: ["event:injury"],
      },
    ],
    medicalEvidenceRefs: ["medical:confirmed"],
    witnessRefs: ["witness:one"],
    assets: [],
    insurancePolicies: [],
    authorizedInheritanceRefs: ["inheritance:lineage:alpha:identity:heir"],
    currentAttributesMinor: {
      strength: 10000,
      intellect: 5000,
    },
    currentSkillMinor: {
      alchemy: 20000,
      sword: 5000,
    },
    ...overrides,
  };
}

function mortalityIntent(overrides: Partial<Parameters<typeof settleMortalityAndLegacy>[0]["intent"]> = {}) {
  return {
    commandId: "cmd_mortality_1",
    causeEventIds: ["event:death", "event:will"],
    occurredAtWorldMinute: 1_010,
    advanceWorldMinutes: 20,
    requestedTransition: "settle_legacy" as const,
    heirRef: "identity:heir",
    authorizationRefs: ["auth:executor"],
    ...overrides,
  };
}

function project(overrides: Partial<LegacyProjectSnapshot> = {}): LegacyProjectSnapshot {
  return {
    projectId: "project:enterprise",
    projectType: "facility",
    ownerLineageRef: "lineage:alpha",
    state: "active",
    currentStageId: "stage:foundation",
    progressMinor: 0,
    stages: [
      {
        stageId: "stage:foundation",
        order: 1,
        requiredProgressMinor: 800,
        requiredInputRefs: ["charter", "site"],
        maintenanceCostMinorPerDay: "100",
        riskMinorPerDay: 100,
      },
      {
        stageId: "stage:staffing",
        order: 2,
        requiredProgressMinor: 500,
        requiredInputRefs: ["charter"],
        maintenanceCostMinorPerDay: "50",
        riskMinorPerDay: 0,
      },
    ],
    committedInputRefs: ["charter", "site"],
    personnel: [
      {
        actorRef: "identity:builder_b",
        role: "engineer",
        availableWorldMinutesPerDay: 240,
        skillMinor: 100,
        upkeepMinorPerDay: "20",
      },
      {
        actorRef: "identity:builder_a",
        role: "foreman",
        availableWorldMinutesPerDay: 120,
        skillMinor: 200,
        upkeepMinorPerDay: "30",
      },
    ],
    treasuryAccountRef: "account:lineage:treasury",
    treasuryResourceKey: "coin",
    treasuryUnit: "minor",
    treasuryBalanceMinor: "1000",
    maintenanceDebtMinor: "0",
    riskMinor: 0,
    lastAdvancedWorldMinute: 10_000,
    authorizationRefs: ["auth:project"],
    ...overrides,
  };
}

test("cast rejects missing source permission prerequisites knowledge unpaid costs cooldown and invalid actor state", () => {
  const result = evaluateSupernaturalCast({
    actor: actor({
      state: "dead",
      permissions: ["self"],
      prerequisiteRefs: [],
      knowledgeRefs: [],
      cooldownReadyAtByCapabilityId: { "capability:moon-bind": 200 },
      resourceBalancesMinor: { "aether:drop": "299" },
    }),
    intent: castIntent({
      declaredCosts: [],
    }),
    capabilities: [capability({ source: "" as SupernaturalCapabilityDef["source"] })],
  });

  assert.equal(result.ok, false);
  assert.deepEqual(errorCodes(result), [
    "ACTOR_NOT_ACTIVE",
    "CAPABILITY_SOURCE_MISSING",
    "CAPABILITY_PERMISSION_DENIED",
    "CAPABILITY_PREREQUISITE_MISSING",
    "CAPABILITY_KNOWLEDGE_MISSING",
    "CAPABILITY_COOLDOWN_ACTIVE",
    "CAPABILITY_COST_UNPAID",
  ]);
});

test("cast rejects past rewrites free world facts unsupported targets missing counter windows and invalid intensity", () => {
  const result = evaluateSupernaturalCast({
    actor: actor(),
    intent: castIntent({
      operation: "harm",
      intensityMinor: 10001,
      targetRefs: [entity("organization", "org_1"), entity("identity", "target_a"), entity("identity", "target_b")],
      counterWindow: undefined,
      desiredWorldFactChange: "rewrite_past_fact",
    }),
    capabilities: [capability()],
  });

  assert.equal(result.ok, false);
  assert.deepEqual(errorCodes(result), [
    "INVALID_INTEGER",
    "CAPABILITY_TARGET_INVALID",
    "CAPABILITY_TARGET_INVALID",
    "CAPABILITY_TARGET_INVALID",
    "CAPABILITY_WORLD_REWRITE_DENIED",
    "CAPABILITY_COUNTER_WINDOW_REQUIRED",
  ]);
});

test("cast normalizes counter windows and records pollution exposure backlash legal heat and cooldown", () => {
  const result = evaluateSupernaturalCast({
    actor: actor(),
    intent: castIntent(),
    capabilities: [capability()],
  });

  assert.equal(result.ok, true);
  assert.ok(result.value);
  assert.equal(result.value.nextCooldownReadyAtWorldMinute, 270);
  assert.deepEqual(result.value.counterWindow, {
    opensAtWorldMinute: 151,
    closesAtWorldMinute: 170,
    counterVerbs: ["audit", "sever"],
    evidenceSignatureRefs: ["sig:moon", "sig:oath"],
    targetRefs: ["identity:target_a", "identity:target_b"],
  });
  assert.deepEqual(result.value.risk, {
    pollutionMinor: 60,
    exposureMinor: 40,
    backlashMinor: 30,
    legalHeatMinor: 20,
    instabilityMinor: 10,
  });
  const pressure = effects(result).find((effect) => effect.effectType === "pressure_delta");
  assert.ok(pressure);
  assert.deepEqual(pressure.after, {
    capabilityId: "capability:moon-bind",
    source: "arcane",
    pollutionMinorAfter: 160,
    exposureMinorAfter: 240,
    instabilityMinorAfter: 310,
    backlashMinor: 30,
    legalHeatMinor: 20,
  });
});

test("cast requires a valid counter window for bounded supernatural actions", () => {
  const beforeOpen = evaluateSupernaturalCast({
    actor: actor(),
    intent: castIntent({
      counterWindow: {
        opensAtWorldMinute: 149,
        closesAtWorldMinute: 200,
        counterVerbs: ["audit"],
        evidenceSignatureRefs: ["sig:moon"],
        targetRefs: ["identity:target_a"],
      },
    }),
    capabilities: [capability()],
  });
  const tooShort = evaluateSupernaturalCast({
    actor: actor(),
    intent: castIntent({
      counterWindow: {
        opensAtWorldMinute: 150,
        closesAtWorldMinute: 159,
        counterVerbs: ["audit"],
        evidenceSignatureRefs: ["sig:moon"],
        targetRefs: ["identity:target_a"],
      },
    }),
    capabilities: [capability()],
  });

  assert.deepEqual(errorCodes(beforeOpen), ["CAPABILITY_COUNTER_WINDOW_REQUIRED"]);
  assert.deepEqual(errorCodes(tooShort), ["CAPABILITY_COUNTER_WINDOW_REQUIRED"]);
});

test("cast effects keep complete source provenance and conserve paid resources into a destruction sink", () => {
  const result = evaluateSupernaturalCast({
    actor: actor(),
    intent: castIntent(),
    capabilities: [capability()],
  });

  const allEffects = effects(result);
  assert.equal(allEffects.length, 6);
  assert.deepEqual(allEffects.map((effect) => effect.sourceEventIds), [
    ["event:a", "event:z"],
    ["event:a", "event:z"],
    ["event:a", "event:z"],
    ["event:a", "event:z"],
    ["event:a", "event:z"],
    ["event:a", "event:z"],
  ]);
  assert.equal(allEffects.every((effect) => effect.authorizationRefs.includes("auth:a")), true);
  assert.equal(allEffects.every((effect) => effect.authorizationRefs.includes("auth:z")), true);

  const ledger = allEffects.find((effect) => effect.effectType === "resource_ledger");
  assert.ok(ledger);
  assert.equal(ledger.after.resourceKey, "aether");
  assert.deepEqual(ledger.after.entries, [{ accountRef: "account:caster:aether", quantityMinor: "-300" }]);
  assert.equal(ledger.after.destructionSinkRef, "sink:supernatural_cost:capability:moon-bind");
  assert.equal("creationSourceRef" in ledger.after, false);
});

test("cast warns but does not grant invisible no-cost no-risk power", () => {
  const result = evaluateSupernaturalCast({
    actor: actor(),
    intent: castIntent({
      operation: "observe",
      counterWindow: undefined,
      declaredCosts: [],
      desiredWorldFactChange: "none",
    }),
    capabilities: [
      capability({
        operations: ["observe"],
        resourceCosts: [],
        timeCostWorldMinutes: 0,
        risk: {
          pollutionMinor: 0,
          exposureMinor: 0,
          backlashMinor: 0,
          legalHeatMinor: 0,
          instabilityMinor: 0,
        },
      }),
    ],
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.warnings, ["capability_has_no_material_cost_or_risk"]);
  assert.deepEqual(effectTypes(result), ["knowledge_delta", "state_transition", "world_predicate"]);
});

test("mortality state machine requires evidence, confirmed death, authorization, and forward time", () => {
  const noDeathEvidence = settleMortalityAndLegacy({
    snapshot: mortalitySnapshot({
      state: "dying",
      injuries: [],
    }),
    intent: mortalityIntent({ requestedTransition: "confirm_death" }),
  });
  const prematureSettlement = settleMortalityAndLegacy({
    snapshot: mortalitySnapshot({ state: "dying" }),
    intent: mortalityIntent(),
  });
  const unauthorized = settleMortalityAndLegacy({
    snapshot: mortalitySnapshot({
      authorizedInheritanceRefs: [],
    }),
    intent: mortalityIntent({ authorizationRefs: [] }),
  });
  const backwards = settleMortalityAndLegacy({
    snapshot: mortalitySnapshot({ worldMinute: 2_000 }),
    intent: mortalityIntent({ occurredAtWorldMinute: 1_000, advanceWorldMinutes: 10 }),
  });

  assert.deepEqual(errorCodes(noDeathEvidence), ["MORTALITY_INVALID_TRANSITION"]);
  assert.deepEqual(errorCodes(prematureSettlement), ["MORTALITY_INVALID_TRANSITION", "DEATH_NOT_CONFIRMED"]);
  assert.deepEqual(errorCodes(unauthorized), ["LEGACY_AUTHORIZATION_DENIED"]);
  assert.deepEqual(errorCodes(backwards), ["INVALID_TIME_RANGE"]);
});

test("mortality state machine advances injury dying death settlement and reincarnation states", () => {
  const injured = settleMortalityAndLegacy({
    snapshot: mortalitySnapshot({ state: "healthy" }),
    intent: mortalityIntent({ requestedTransition: "injure", heirRef: undefined }),
  });
  const dying = settleMortalityAndLegacy({
    snapshot: mortalitySnapshot({ state: "injured" }),
    intent: mortalityIntent({ requestedTransition: "mark_dying", heirRef: undefined }),
  });
  const dead = settleMortalityAndLegacy({
    snapshot: mortalitySnapshot({ state: "dying" }),
    intent: mortalityIntent({ requestedTransition: "confirm_death", heirRef: undefined }),
  });
  const settled = settleMortalityAndLegacy({
    snapshot: mortalitySnapshot({ state: "dead" }),
    intent: mortalityIntent(),
  });
  const reincarnated = settleMortalityAndLegacy({
    snapshot: mortalitySnapshot({ state: "legacy_settled" }),
    intent: mortalityIntent({ requestedTransition: "issue_reincarnation" }),
  });

  assert.equal(injured.value?.nextState, "injured");
  assert.equal(dying.value?.nextState, "dying");
  assert.equal(dead.value?.nextState, "dead");
  assert.equal(settled.value?.nextState, "legacy_settled");
  assert.equal(reincarnated.value?.nextState, "reincarnated");
  assert.equal(settled.value?.elapsedWorldMinutes, 30);
  assert.deepEqual(effectTypes(settled), ["knowledge_delta", "knowledge_delta", "knowledge_delta", "knowledge_delta", "state_transition", "world_predicate"]);
});

test("legacy settlement only carries limited institutions work debts enemies echoes relics and never full attributes", () => {
  const result = settleMortalityAndLegacy({
    snapshot: mortalitySnapshot({
      assets: [
        legacyAsset({ assetId: "asset:relic", assetType: "relic", numericScaleMinor: 20000 }),
        legacyAsset({ assetId: "asset:workshop", assetType: "workshop", valueMinor: "16000" }),
        legacyAsset({ assetId: "asset:institution", assetType: "institution", valueMinor: "12000" }),
        legacyAsset({ assetId: "asset:debt", assetType: "debt", valueMinor: "5000" }),
        legacyAsset({ assetId: "asset:enemy", assetType: "enemy", valueMinor: "5000" }),
        legacyAsset({ assetId: "asset:reputation", assetType: "reputation_memory", valueMinor: "5000" }),
        legacyAsset({ assetId: "asset:estate", assetType: "estate", valueMinor: "9000" }),
      ],
    }),
    intent: mortalityIntent(),
  });

  assert.equal(result.ok, true);
  assert.ok(result.value);
  assert.deepEqual(result.value.inheritedAssetIds, [
    "asset:debt",
    "asset:enemy",
    "asset:estate",
    "asset:institution",
    "asset:relic",
    "asset:reputation",
    "asset:workshop",
  ]);
  assert.deepEqual(result.value.blockedAssetIds, []);
  assert.equal(result.value.inheritedEchoes.every((echo) => echo.strengthMinor <= 3500), true);
  assert.deepEqual(
    result.value.inheritedEchoes.filter((echo) => echo.sourceRef.startsWith("attribute:")).map((echo) => [echo.sourceRef, echo.strengthMinor]),
    [["attribute:intellect", 1250], ["attribute:strength", 2500]],
  );
  assert.deepEqual(
    result.value.inheritedEchoes.filter((echo) => echo.sourceRef.startsWith("skill:")).map((echo) => [echo.sourceRef, echo.strengthMinor]),
    [["skill:alchemy", 3500], ["skill:sword", 1000]],
  );
});

test("legacy settlement requires carry-in slot and insurance authorization", () => {
  const result = settleMortalityAndLegacy({
    snapshot: mortalitySnapshot({
      assets: [
        legacyAsset({ assetId: "asset:carry", assetType: "carry_in_slot", valueMinor: "1" }),
        legacyAsset({ assetId: "asset:insurance", assetType: "insurance_policy", valueMinor: "8000" }),
        legacyAsset({ assetId: "asset:relic", assetType: "relic", valueMinor: "4000" }),
      ],
    }),
    intent: mortalityIntent({ authorizationRefs: ["authorized:asset:insurance"] }),
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.value?.inheritedAssetIds, ["asset:insurance", "asset:relic"]);
  assert.deepEqual(result.value?.blockedAssetIds, ["asset:carry"]);
  assert.deepEqual(result.value?.inheritedEchoes.map((echo) => echo.echoType).toSorted(), [
    "insurance_claim",
    "method_familiarity",
    "method_familiarity",
    "method_familiarity",
    "method_familiarity",
    "minor_relic",
  ]);
});

test("project advancement validates active inputs personnel terminal state and backwards time", () => {
  assert.deepEqual(errorCodes(advanceLegacyProject({
    commandId: "cmd_project_1",
    worldId: "world_1",
    project: project({ committedInputRefs: ["charter"] }),
    toWorldMinute: 11_440,
    sourceEventIds: ["event:project"],
  })), ["PROJECT_INPUT_MISSING"]);
  assert.deepEqual(errorCodes(advanceLegacyProject({
    commandId: "cmd_project_1",
    worldId: "world_1",
    project: project({ personnel: [] }),
    toWorldMinute: 11_440,
    sourceEventIds: ["event:project"],
  })), ["PROJECT_PERSONNEL_UNAVAILABLE"]);
  assert.deepEqual(errorCodes(advanceLegacyProject({
    commandId: "cmd_project_1",
    worldId: "world_1",
    project: project({ state: "completed" }),
    toWorldMinute: 11_440,
    sourceEventIds: ["event:project"],
  })), ["PROJECT_INVALID_STATE"]);
  assert.deepEqual(errorCodes(advanceLegacyProject({
    commandId: "cmd_project_1",
    worldId: "world_1",
    project: project(),
    toWorldMinute: 9_999,
    sourceEventIds: ["event:project"],
  })), ["INVALID_TIME_RANGE"]);
});

test("project advancement spends maintenance and personnel and advances offline progress deterministically", () => {
  const result = advanceLegacyProject({
    commandId: "cmd_project_1",
    worldId: "world_1",
    project: project(),
    toWorldMinute: 11_440,
    sourceEventIds: ["event:z", "event:a"],
  });

  assert.equal(result.ok, true);
  assert.ok(result.value);
  assert.equal(result.value.advancedDays, 1);
  assert.equal(result.value.project.currentStageId, "stage:foundation");
  assert.equal(result.value.project.progressMinor, 480);
  assert.equal(result.value.project.treasuryBalanceMinor, "850");
  assert.equal(result.value.project.riskMinor, 100);
  assert.deepEqual(effectTypes(result), ["pressure_delta", "resource_ledger"]);
  assert.deepEqual(effects(result).map((effect) => effect.sourceEventIds), [["event:a", "event:z"], ["event:a", "event:z"]]);
});

test("project advancement pauses resumes blocks fails completes and clamps extreme risk", () => {
  const paused = advanceLegacyProject({
    commandId: "cmd_pause",
    worldId: "world_1",
    project: project(),
    toWorldMinute: 10_060,
    pauseRequested: true,
    sourceEventIds: ["event:pause"],
  });
  const resumed = advanceLegacyProject({
    commandId: "cmd_resume",
    worldId: "world_1",
    project: project({ state: "paused" }),
    toWorldMinute: 10_060,
    resumeRequested: true,
    sourceEventIds: ["event:resume"],
  });
  const blocked = advanceLegacyProject({
    commandId: "cmd_block",
    worldId: "world_1",
    project: project({ treasuryBalanceMinor: "10" }),
    toWorldMinute: 11_440,
    sourceEventIds: ["event:block"],
  });
  const failed = advanceLegacyProject({
    commandId: "cmd_fail",
    worldId: "world_1",
    project: project({
      stages: [
        {
          stageId: "stage:foundation",
          order: 1,
          requiredProgressMinor: 999999,
          requiredInputRefs: ["charter", "site"],
          maintenanceCostMinorPerDay: "1",
          riskMinorPerDay: 999999,
        },
      ],
    }),
    toWorldMinute: 11_440,
    sourceEventIds: ["event:fail"],
  });
  const completed = advanceLegacyProject({
    commandId: "cmd_complete",
    worldId: "world_1",
    project: project({
      progressMinor: 700,
      stages: [
        {
          stageId: "stage:foundation",
          order: 1,
          requiredProgressMinor: 800,
          requiredInputRefs: ["charter", "site"],
          maintenanceCostMinorPerDay: "1",
          riskMinorPerDay: 0,
        },
      ],
    }),
    toWorldMinute: 11_440,
    sourceEventIds: ["event:complete"],
  });

  assert.equal(paused.value?.project.state, "paused");
  assert.equal(resumed.value?.project.state, "active");
  assert.equal(blocked.value?.project.state, "blocked");
  assert.deepEqual(errorCodes(blocked), ["PROJECT_MAINTENANCE_UNPAID"]);
  assert.equal(failed.value?.project.state, "failed");
  assert.equal(failed.value?.project.riskMinor, 10000);
  assert.equal(completed.value?.project.state, "completed");
});

test("supernatural rule effects use deterministic ids and stable ordering", () => {
  const firstCast = evaluateSupernaturalCast({
    actor: actor(),
    intent: castIntent(),
    capabilities: [capability()],
  });
  const secondCast = evaluateSupernaturalCast({
    actor: actor(),
    intent: castIntent(),
    capabilities: [capability()],
  });
  const firstLegacy = settleMortalityAndLegacy({
    snapshot: mortalitySnapshot({
      assets: [
        legacyAsset({ assetId: "asset:b", assetType: "relic" }),
        legacyAsset({ assetId: "asset:a", assetType: "relic" }),
      ],
    }),
    intent: mortalityIntent(),
  });
  const secondLegacy = settleMortalityAndLegacy({
    snapshot: mortalitySnapshot({
      assets: [
        legacyAsset({ assetId: "asset:b", assetType: "relic" }),
        legacyAsset({ assetId: "asset:a", assetType: "relic" }),
      ],
    }),
    intent: mortalityIntent(),
  });

  assert.deepEqual(firstCast.value?.effects.map((proposal) => proposal.proposalId), secondCast.value?.effects.map((proposal) => proposal.proposalId));
  assert.deepEqual(firstCast.value?.effects.map((proposal) => proposal.proposalId), firstCast.value?.effects.map((proposal) => proposal.proposalId).toSorted());
  assert.deepEqual(firstLegacy.value?.inheritedAssetIds, ["asset:a", "asset:b"]);
  assert.deepEqual(firstLegacy.value?.effects.map((proposal) => proposal.proposalId), secondLegacy.value?.effects.map((proposal) => proposal.proposalId));
  assert.deepEqual(firstLegacy.value?.effects.map((proposal) => proposal.proposalId), firstLegacy.value?.effects.map((proposal) => proposal.proposalId).toSorted());
});
