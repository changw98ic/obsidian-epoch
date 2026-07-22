import assert from "node:assert/strict";
import test from "node:test";

import {
  causalPlayerPanel,
  causalPlayerTenRunAudit,
  type CausalPlayerReadCaller,
  type CausalPlayerRunAuditEntry,
} from "../lib/epoch/causalPlayerReadModel.ts";
import { createCausalWorldSnapshot, type CausalWorldSnapshotV1 } from "../lib/epoch/causalWorldSnapshot.ts";
import { buildKnowledgeState, type EpochKnowledgeInputItem } from "../lib/epoch/knowledgeStateRules.ts";
import {
  calculateMissionIntensity,
  scoreMission,
  type MissionOutcome,
} from "../lib/epoch/missionConsequenceRules.ts";
import {
  COMBAT_READINESS_DIMENSION_IDS,
  type CombatReadinessDimensionId,
  type ProgressionAttributeId,
  type ProgressionState,
} from "../lib/epoch/progressionRules.ts";
import { createInfiniteWorldRuntime } from "../lib/epoch/infiniteWorldRuntime.ts";

const WORLD_ID = "world_ten_run_e2e";
const ACTOR = { actorType: "player_identity", actorId: "identity_alpha" } as const;
const START = "2026-07-20T00:00:00.000Z";
const ACCOUNT = "identity:identity_alpha:wallet";
const INVENTORY = "identity:identity_alpha:inventory";

const caller: CausalPlayerReadCaller = {
  playerId: "player_alpha",
  identityId: "identity_alpha",
  agentId: "agent_alpha",
  explorerId: "explorer_alpha",
  accountRefs: [ACCOUNT, INVENTORY],
  itemRefs: ["item:field_blade"],
  legalAccess: ["public", "owner", "source-bound"],
};

const baseAttributes: Record<ProgressionAttributeId, number> = {
  strength: 31,
  agility: 32,
  physique: 30,
  intellect: 29,
  willpower: 33,
  spirituality: 28,
};

type Band = "low" | "medium" | "high";

interface RunCase {
  readonly runId: string;
  readonly band: Band;
  readonly outcome: MissionOutcome;
  readonly objectiveCompletionBps: number;
  readonly executionQualityBps: number;
  readonly enemyHostilePower: number;
  readonly environmentalHazard: number;
  readonly worldPressure: number;
  readonly playerCombatPower: number;
  readonly materialDelta: number;
  readonly coinDelta: number;
  readonly durabilityDelta: number;
  readonly practiceXp: number;
  readonly insightDelta: number;
  readonly methodDelta: number;
}

const runs: readonly RunCase[] = [
  run("run_01", "low", "clean_success", 9000, 8500, 24, 18, 20, 52, 1, 40, -1, 24, 1, 28),
  run("run_02", "medium", "costly_success", 8000, 6500, 48, 42, 45, 55, 2, 60, -7, 31, 1, 34),
  run("run_03", "high", "failure", 2500, 3000, 84, 78, 80, 48, -1, -30, -12, 12, 0, 12),
  run("run_04", "medium", "withdrawal", 4500, 5000, 56, 64, 58, 58, 0, -10, -6, 18, 1, 18),
  run("run_05", "high", "partial_success", 7000, 7200, 78, 86, 82, 62, 3, 80, -10, 38, 2, 44),
  run("run_06", "low", "clean_success", 10000, 10000, 12, 10, 12, 95, 1, 20, -1, 8, 0, 8),
  run("run_07", "medium", "failure", 3000, 2500, 52, 48, 55, 61, -2, -25, -9, 10, 0, 10),
  run("run_08", "high", "costly_success", 8500, 7800, 92, 75, 88, 67, 4, 100, -8, 42, 2, 48),
  run("run_09", "medium", "withdrawal", 5000, 9000, 58, 50, 60, 67, 0, -5, -4, 20, 1, 20),
  run("run_10", "high", "clean_success", 9500, 6500, 90, 94, 95, 67, 5, 120, -7, 45, 3, 52),
];

function run(
  runId: string,
  band: Band,
  outcome: MissionOutcome,
  objectiveCompletionBps: number,
  executionQualityBps: number,
  enemyHostilePower: number,
  environmentalHazard: number,
  worldPressure: number,
  playerCombatPower: number,
  materialDelta: number,
  coinDelta: number,
  durabilityDelta: number,
  practiceXp: number,
  insightDelta: number,
  methodDelta: number,
): RunCase {
  return {
    runId,
    band,
    outcome,
    objectiveCompletionBps,
    executionQualityBps,
    enemyHostilePower,
    environmentalHazard,
    worldPressure,
    playerCombatPower,
    materialDelta,
    coinDelta,
    durabilityDelta,
    practiceXp,
    insightDelta,
    methodDelta,
  };
}

function runtime() {
  let id = 0;
  return createInfiniteWorldRuntime({
    worldId: WORLD_ID,
    now: () => START,
    nowMs: () => 20,
    idFactory: (kind) => `${kind}_ten_${String(++id).padStart(3, "0")}`,
  });
}

function missionContract(item: RunCase, index: number) {
  return {
    contractId: item.runId,
    worldId: WORLD_ID,
    status: "active",
    interventionFamily: "combat",
    rootPressureIds: [`pressure:${item.band}:${index}`],
    sponsorRef: "faction:frontier",
    beneficiaryRefs: ["settlement:frontier"],
    oppositionRefs: ["faction:ash"],
    objectivePredicates: [{
      objectiveId: `${item.runId}:objective`,
      title: "Resolve pressure",
      targetRef: { entityType: "pressure", entityId: `${item.runId}:pressure` },
      operator: "gte",
      expectedValue: 80,
      observableWorldStateRef: `world_state:${item.runId}`,
      required: true,
      weight: 1,
    }],
    rewardFundingRef: "treasury:frontier",
    rewardProposals: [],
    resourceStakes: [],
    risk: {
      opposition: item.enemyHostilePower,
      environmentalHazard: item.environmentalHazard,
      objectiveComplexity: item.band === "low" ? 20 : item.band === "medium" ? 50 : 80,
      informationUncertainty: item.band === "low" ? 15 : item.band === "medium" ? 45 : 75,
      logisticalBurden: item.band === "low" ? 15 : item.band === "medium" ? 40 : 70,
      legalPoliticalRisk: item.band === "low" ? 10 : item.band === "medium" ? 35 : 65,
      irreversibility: item.band === "low" ? 10 : item.band === "medium" ? 45 : 80,
    },
    offeredAtWorldMinute: index * 100,
    acceptedAtWorldMinute: index * 100 + 1,
    activeAtWorldMinute: index * 100 + 2,
    authorizationRefs: ["auth:mission"],
    causalParentEventIds: [`event:${item.runId}:accepted`],
  };
}

function command(item: RunCase, index: number) {
  const commandId = `cmd_${item.runId}`;
  return {
    commandType: "mission_settle",
    commandId,
    worldId: WORLD_ID,
    actor: ACTOR,
    submittedAt: START,
    requestedWorldMinute: index * 100 + 50,
    idempotencyKey: `idem:${item.runId}`,
    expectedStreamVersions: [{ streamType: "run", streamId: "ten_run_campaign", expectedVersion: index }],
    authorizationRefs: ["auth:mission"],
    rootPressureIds: [`pressure:${item.band}:${index}`],
    payload: {
      streamId: "ten_run_campaign",
      input: {
        contract: missionContract(item, index),
        outcome: item.outcome,
        objectiveResults: [{ objectiveId: `${item.runId}:objective`, completedBps: item.objectiveCompletionBps, required: true }],
        actorRef: "actor:player",
        occurredAtWorldMinute: index * 100 + 50,
        sourceEventIds: [commandId],
      },
    },
  };
}

function progressionState(after: readonly RunCase[]): ProgressionState {
  const functionalXp = 120 + after.reduce((sum, item) => sum + item.practiceXp, 0);
  const insightPoints = 1 + after.reduce((sum, item) => sum + item.insightDelta, 0);
  const breath = 100 + after.reduce((sum, item) => sum + item.methodDelta, 0);
  const learnedSkillNodeIds = breath >= 300 ? ["root_breath", "breath_edge"] : ["root_breath"];
  return {
    identityId: "identity_alpha",
    lineageId: "lineage_alpha",
    functionalStage: functionalXp >= 360 && insightPoints >= 12 ? 3 : 2,
    powerSystemId: "eastern_cultivation",
    attributes: baseAttributes,
    resources: {
      functionalXp,
      insightPoints,
      skillPointsSpent: learnedSkillNodeIds.length - 1,
      lineageMarks: 1,
      attributeEvidenceXp: { strength: after.reduce((sum, item) => sum + item.practiceXp, 0) },
      methodProficiency: { breath },
      domainInsight: { dream_mind: insightPoints },
      materials: [{ materialId: "primary", quantity: Math.max(0, after.reduce((sum, item) => sum + item.materialDelta, 0)) }],
    },
    learnedSkillNodeIds,
    talents: [],
    carrySlots: after.length >= 8 ? 5 : 4,
    deploymentCapacity: after.length >= 8 ? 9 : 8,
    quickUseSlots: after.length >= 5 ? 3 : 2,
    echoSlots: 1,
    insuranceLayers: after.length >= 10 ? 1 : 0,
    qualificationRefs: ["qualification:eastern"],
    status: { injurySeverity: Math.max(0, 20 - after.length), pollution: 10, debtSeverity: 0, stability: 80 },
  };
}

function auditFor(item: RunCase, index: number): CausalPlayerRunAuditEntry {
  const intensity = calculateMissionIntensity({
    enemyHostilePower: item.enemyHostilePower,
    enemyCoordination: item.band === "low" ? 20 : item.band === "medium" ? 55 : 85,
    environmentalHazard: item.environmentalHazard,
    objectiveComplexity: item.band === "low" ? 20 : item.band === "medium" ? 50 : 80,
    informationUncertainty: item.band === "low" ? 15 : item.band === "medium" ? 45 : 75,
    logisticalBurden: item.band === "low" ? 15 : item.band === "medium" ? 40 : 70,
    legalPoliticalRisk: item.band === "low" ? 10 : item.band === "medium" ? 35 : 65,
    irreversibility: item.band === "low" ? 10 : item.band === "medium" ? 45 : 80,
    resourcePressure: Math.max(0, Math.min(100, 50 - item.materialDelta * 4)),
    worldPressure: item.worldPressure,
    playerCombatPower: item.playerCombatPower,
  });
  const score = scoreMission({
    objectiveCompletionBps: item.objectiveCompletionBps,
    pressureReliefBps: item.outcome === "failure" ? 1000 : item.outcome === "withdrawal" ? 3000 : item.objectiveCompletionBps,
    sideEffectControlBps: item.durabilityDelta < -9 ? 4500 : 8000,
    executionQualityBps: item.executionQualityBps,
    meaningfulRiskBps: item.band === "low" ? 1000 : item.band === "medium" ? 5500 : 9000,
    riskExposureBps: item.band === "high" ? 8500 : item.band === "medium" ? 5500 : 1000,
    resourceEfficiencyBps: item.coinDelta >= 80 ? 8500 : item.coinDelta >= 0 ? 6500 : 3500,
    survivalBps: item.outcome === "failure" ? 3000 : item.outcome === "withdrawal" ? 6500 : 9000,
    integrityBps: item.outcome === "clean_success" ? 9000 : 7000,
    combatPowerFitBps: Math.max(0, Math.min(10000, Math.round((item.playerCombatPower / Math.max(1, item.enemyHostilePower)) * 5000))),
    overwhelmingForceBps: item.playerCombatPower >= 90 && item.band === "low" ? 10000 : 0,
    recentSimilarCompletionCount: item.playerCombatPower >= 90 && item.band === "low" ? 4 : 0,
    repeatedResolutionFamilyCount: item.playerCombatPower >= 90 && item.band === "low" ? 3 : 0,
  });
  return {
    runId: item.runId,
    occurredAtWorldMinute: index * 100 + 50,
    recordedAt: `2026-07-20T00:${String(index).padStart(2, "0")}:00.000Z`,
    outcome: item.outcome,
    combatPowerMid: item.playerCombatPower,
    intensity: {
      worldIntensity: intensity.worldIntensity,
      encounterIntensity: intensity.encounterIntensity,
      band: intensity.band,
      playerCombatRatio: intensity.playerCombatRatio,
    },
    score: {
      finalScore: score.finalScore,
      rawScore: score.rawScore,
      grade: score.grade,
    },
    breakdown: {
      objective: score.objective,
      causalImpact: score.causalImpact,
      execution: score.execution,
      risk: score.risk,
      efficiency: score.efficiency,
      survival: score.survival,
      integrity: score.integrity,
      antiFarmDecay: score.antiFarmDecay,
    },
  };
}

function knowledgeFor(item: RunCase, index: number): EpochKnowledgeInputItem {
  return {
    id: `knowledge:${item.runId}`,
    kind: index % 3 === 0 ? "observation" : "fact",
    subject: `${item.band} route ${item.runId}`,
    text: `${item.outcome} pressure trace for ${item.runId}`,
    confidence: item.outcome === "failure" ? 0.55 : 0.75,
    source: {
      sourceId: `source:${item.runId}`,
      trustClass: "system_worker",
      sourceAuthority: "runtime",
      channel: "canonical",
      evidenceIds: [`event:${item.runId}:resolution`],
    },
    visibility: { scopes: ["public"], legalAccess: "public" },
    createdAt: START,
    observedAt: START,
  };
}

function panelSnapshot(base: CausalWorldSnapshotV1, completed: readonly RunCase[]): CausalWorldSnapshotV1 {
  const coin = 1000 + completed.reduce((sum, item) => sum + item.coinDelta, 0);
  const primary = 2 + completed.reduce((sum, item) => sum + item.materialDelta, 0);
  const durability = Math.max(1, 100 + completed.reduce((sum, item) => sum + item.durabilityDelta, 0));
  return createCausalWorldSnapshot({
    ...base,
    balances: {
      accounts: [
        { accountRef: ACCOUNT, resourceKey: "gold", unit: "minor", balanceMinor: String(coin), creditLimitMinor: "5000" },
        { accountRef: ACCOUNT, resourceKey: "material.primary", unit: "minor", balanceMinor: String(primary) },
      ],
    },
    ownership: {
      items: [{ itemRef: "item:field_blade", titleOwnerRef: "identity:identity_alpha", lifecycleState: "active" }],
    },
    knowledge: buildKnowledgeState(completed.map(knowledgeFor)),
    domainExtensions: [{
      slotId: "player_projection",
      schemaId: "causal.player.fixture",
      schemaVersion: 1,
      owner: "identity:identity_alpha",
      hash: `sha256:${"0".repeat(64)}`,
      payload: {
        progressionState: progressionState(completed),
        materialProvenance: completed.filter((item) => item.materialDelta > 0).map((item) => ({
          materialRef: `material:${item.runId}`,
          resourceKey: "material.primary",
          quantityMinor: String(item.materialDelta),
          provenanceChannel: "mission_reward",
          sourceRefs: [item.runId],
          evidenceIds: [`event:${item.runId}:resolution`],
          accountRef: ACCOUNT,
        })),
        uniqueItems: [{
          itemRef: "item:field_blade",
          itemKey: "crafted:field-blade",
          titleOwnerRef: "identity:identity_alpha",
          possessionAccountRef: INVENTORY,
          bucket: durability >= 70 ? "available" : "damaged",
          lifecycleState: "active",
          durability: { current: durability, max: 100 },
          quality: 81,
          provenanceRefs: ["event:forge"],
          materialRefs: ["material:iron", "material:carbon"],
        }],
        loadoutItems: [
          { itemId: "field_blade", rarity: "rare", category: "mainCore", quickUse: false, deploymentCost: 3, weightMinor: "3" },
          ...(completed.length >= 5 ? [{ itemId: "focus_pill", rarity: "uncommon", category: "potion", quickUse: true, deploymentCost: 1, weightMinor: "1" }] : []),
        ],
        runAudits: completed.map(auditFor),
      },
    }],
  });
}

function combatVector(value: number): Record<CombatReadinessDimensionId, number> {
  return Object.fromEntries(COMBAT_READINESS_DIMENSION_IDS.map((dimension) => [dimension, value])) as Record<CombatReadinessDimensionId, number>;
}

test("executes ten deterministic runs and exposes player panel audit without causal score claims", async () => {
  const world = runtime();
  const panels = [];

  for (let index = 1; index <= runs.length; index += 1) {
    const item = runs[index - 1];
    const result = await world.execute(command(item, index));
    assert.equal(result.replayed, false);
    assert.equal(result.event.eventType, "mission_outcome_settled");
    assert.equal(result.event.effects.some((effect) => JSON.stringify(effect).includes("\"attribute\"") && JSON.stringify(effect).includes("\"quantityMinor\":\"1\"")), false);

    const snapshot = panelSnapshot(world.snapshot(), runs.slice(0, index));
    const panel = causalPlayerPanel({
      snapshot,
      caller,
      methodVector: combatVector(8 + index),
      equipmentVector: combatVector(5),
      preparationVector: combatVector(index >= 5 ? 6 : 3),
      matchupMultiplierByDimension: combatVector(1000),
      stateMultiplierBps: 10_000,
      environmentMultiplierBps: item.band === "high" ? 9000 : 10_000,
      encounter: { threatPoints: item.enemyHostilePower, weights: combatVector(1000) },
      ragQuery: "pressure",
    });
    panels.push(panel);

    assert.equal(panel.wallet.currencies[0]?.balanceMinor, String(1000 + runs.slice(0, index).reduce((sum, runItem) => sum + runItem.coinDelta, 0)));
    assert.equal(panel.wallet.materials[0]?.balanceMinor, String(2 + runs.slice(0, index).reduce((sum, runItem) => sum + runItem.materialDelta, 0)));
    assert.equal(panel.wallet.uniqueItems[0]?.durability?.current, Math.max(1, 100 + runs.slice(0, index).reduce((sum, runItem) => sum + runItem.durabilityDelta, 0)));
    assert.equal(panel.progression.resources.functionalXp, 120 + runs.slice(0, index).reduce((sum, runItem) => sum + runItem.practiceXp, 0));
    assert.equal(panel.progression.resources.insightPoints, 1 + runs.slice(0, index).reduce((sum, runItem) => sum + runItem.insightDelta, 0));
    assert.equal(panel.progression.skillTree.advancement.some((entry) => entry.methodId === "breath"), true);
    assert.equal(panel.progression.loadout.carrySlots, index >= 8 ? 5 : 4);
    assert.equal(panel.rag.hits.some((hit) => hit.id === `knowledge:${item.runId}`), true);
    assert.deepEqual(Object.keys(panel.combat.dimensions), COMBAT_READINESS_DIMENSION_IDS);
    assert.equal(panel.recentRuns.runs.length, index);
    assert.ok(panel.recentRuns.runs[0]?.intensity.encounterIntensity >= 0);
    assert.ok(Object.keys(panel.recentRuns.runs[0]?.breakdown || {}).includes("execution"));
  }

  const finalPanel = panels.at(-1);
  assert.ok(finalPanel);
  const audit = causalPlayerTenRunAudit(finalPanel);
  assert.equal(audit.runs.length, 10);
  assert.equal(audit.descriptiveCorrelation.sampleSize, 10);
  assert.equal(audit.descriptiveCorrelation.caveat, "descriptive_non_causal");
  assert.equal(audit.changes.length, 9);

  const lowFarm = audit.runs.find((entry) => entry.runId === "run_06");
  const highSuccess = audit.runs.find((entry) => entry.runId === "run_08");
  const samePowerPoorExecution = audit.runs.find((entry) => entry.runId === "run_09");
  const samePowerBetterExecution = audit.runs.find((entry) => entry.runId === "run_08");
  const sameExecutionMedium = audit.runs.find((entry) => entry.runId === "run_02");
  const sameExecutionHigh = audit.runs.find((entry) => entry.runId === "run_10");

  assert.ok(lowFarm && highSuccess && lowFarm.score.finalScore < highSuccess.score.finalScore, "high power low risk farm run must not score higher than high risk success");
  assert.ok(samePowerPoorExecution && samePowerBetterExecution && samePowerPoorExecution.combatPowerMid === samePowerBetterExecution.combatPowerMid);
  assert.ok(samePowerPoorExecution.score.finalScore !== samePowerBetterExecution.score.finalScore, "same combat power must vary by execution");
  assert.ok(sameExecutionMedium && sameExecutionHigh);
  assert.equal(runs.find((entry) => entry.runId === "run_02")?.executionQualityBps, runs.find((entry) => entry.runId === "run_10")?.executionQualityBps);
  assert.notEqual(sameExecutionMedium.intensity.encounterIntensity, sameExecutionHigh.intensity.encounterIntensity);

  const materialNet = Number(finalPanel.wallet.materials[0]?.balanceMinor || 0) - 2;
  assert.equal(materialNet, runs.reduce((sum, item) => sum + item.materialDelta, 0));
  assert.equal(world.events().length, 10);
});
