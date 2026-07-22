import assert from "node:assert/strict";
import test from "node:test";

import {
  causalPlayerPanel,
  causalPlayerPanelDelta,
  causalPlayerTenRunAudit,
  type CausalPlayerLoadoutItem,
  type CausalPlayerIdentityReadModel,
  type CausalPlayerMaterialProvenance,
  type CausalPlayerPanel,
  type CausalPlayerReadCaller,
  type CausalPlayerRunAuditEntry,
  type CausalPlayerUniqueItemDetail,
} from "../lib/epoch/causalPlayerReadModel.ts";
import {
  createCausalWorldSnapshot,
  type CausalWorldSnapshotV1,
} from "../lib/epoch/causalWorldSnapshot.ts";
import {
  buildKnowledgeState,
  type EpochKnowledgeInputItem,
  type EpochKnowledgeKind,
} from "../lib/epoch/knowledgeStateRules.ts";
import {
  COMBAT_READINESS_DIMENSION_IDS,
  type ProgressionAttributeId,
  type ProgressionState,
  type SkillNodeDefinition,
} from "../lib/epoch/progressionRules.ts";

const caller: CausalPlayerReadCaller = {
  playerId: "player_alpha",
  identityId: "identity_alpha",
  agentId: "agent_alpha",
  explorerId: "explorer_alpha",
  regionId: "region_north",
  organizationIds: ["org_lantern"],
  evidenceIds: ["evidence_permit"],
  accountRefs: ["identity:identity_alpha:wallet", "identity:identity_alpha:inventory"],
  itemRefs: ["item:sword_alpha"],
  legalAccess: ["public", "owner", "member", "source-bound"],
};

const attributes: Record<ProgressionAttributeId, number> = {
  strength: 42,
  agility: 39,
  physique: 44,
  intellect: 31,
  willpower: 47,
  spirituality: 36,
};

function snapshot(input: {
  readonly balances?: CausalWorldSnapshotV1["balances"]["accounts"];
  readonly ownership?: CausalWorldSnapshotV1["ownership"]["items"];
  readonly knowledge?: readonly EpochKnowledgeInputItem[];
  readonly domainPayloads?: readonly Readonly<Record<string, unknown>>[];
} = {}): CausalWorldSnapshotV1 {
  return createCausalWorldSnapshot({
    worldId: "world_causal_player",
    replayCursor: { eventCount: 3, lastWorldMinute: 90 },
    balances: {
      accounts: input.balances || [],
    },
    ownership: {
      items: input.ownership || [],
    },
    knowledge: buildKnowledgeState(input.knowledge || []),
    domainExtensions: (input.domainPayloads || []).map((payload, index) => ({
      slotId: `slot_${index}`,
      schemaId: "causal.player.fixture",
      schemaVersion: 1,
      owner: "identity:identity_alpha",
      hash: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      payload,
    })),
  });
}

function progression(overrides: Partial<ProgressionState> = {}): ProgressionState {
  return {
    identityId: "identity_alpha",
    lineageId: "lineage_alpha",
    functionalStage: 2,
    powerSystemId: "eastern_cultivation",
    attributes,
    resources: {
      functionalXp: 190,
      insightPoints: 4,
      skillPointsSpent: 2,
      lineageMarks: 1,
      attributeEvidenceXp: { strength: 90, agility: 70 },
      methodProficiency: { breath: 149, blade: 325 },
      domainInsight: { dream_mind: 8 },
      materials: [{ materialId: "marrow_shard", quantity: 2 }],
    },
    learnedSkillNodeIds: ["root_breath", "edge_step"],
    talents: [{
      talentId: "scar_sense",
      impact: "minor",
      source: "scar",
      scalarChannel: "perception",
      scalarBps: 500,
    }],
    carrySlots: 5,
    deploymentCapacity: 9,
    quickUseSlots: 3,
    echoSlots: 2,
    insuranceLayers: 1,
    qualificationRefs: [],
    status: {
      injurySeverity: 61,
      pollution: 72,
      debtSeverity: 81,
      stability: 45,
    },
    ...overrides,
  };
}

function skillDefinitions(): readonly SkillNodeDefinition[] {
  return [
    { nodeId: "edge_step", tier: "tier1", kind: "method_unlock", requiredStage: 1, requiredMethodId: "blade" },
    { nodeId: "root_breath", tier: "tier1", kind: "method_unlock", requiredStage: 1, requiredMethodId: "breath" },
    { nodeId: "future_gate", tier: "tier3", kind: "capstone", requiredStage: 5 },
  ];
}

function run(index: number, overrides: Partial<CausalPlayerRunAuditEntry> = {}): CausalPlayerRunAuditEntry {
  return {
    runId: `run_${String(index).padStart(2, "0")}`,
    occurredAtWorldMinute: index,
    recordedAt: `2026-07-20T00:${String(index).padStart(2, "0")}:00.000Z`,
    outcome: index % 2 === 0 ? "full_completion" : "forced_extraction",
    combatPowerMid: 40 + index,
    intensity: {
      worldIntensity: 20 + index,
      encounterIntensity: 30 + index,
      band: "medium",
      playerCombatRatio: 1 + index / 100,
    },
    score: {
      finalScore: 100 + index * 3,
      rawScore: 80 + index * 2,
      grade: "B",
    },
    breakdown: { combat: index, survival: index + 1 },
    ...overrides,
  };
}

function knowledge(kind: EpochKnowledgeKind, overrides: Partial<EpochKnowledgeInputItem> = {}): EpochKnowledgeInputItem {
  return {
    id: `knowledge_${kind}`,
    kind,
    subject: `subject_${kind}`,
    text: `${kind} route marker`,
    confidence: 0.6,
    source: {
      sourceId: `source_${kind}`,
      trustClass: "system_worker",
      sourceAuthority: "core",
      channel: "canonical",
      evidenceIds: [`event_${kind}`],
    },
    visibility: { scopes: ["public"], legalAccess: "public" },
    createdAt: "2026-07-20T00:00:00.000Z",
    observedAt: "2026-07-20T00:00:00.000Z",
    ...overrides,
  };
}

function basePanel(input: {
  readonly snapshot?: CausalWorldSnapshotV1;
  readonly caller?: CausalPlayerReadCaller;
  readonly progressionState?: ProgressionState;
  readonly runAudits?: readonly CausalPlayerRunAuditEntry[];
  readonly ragQuery?: string;
  readonly ragPage?: { readonly cursor?: string; readonly limit?: number };
  readonly methodValue?: number;
  readonly identity?: CausalPlayerIdentityReadModel;
} = {}): CausalPlayerPanel {
  return causalPlayerPanel({
    snapshot: input.snapshot || snapshot(),
    caller: input.caller || caller,
    identity: input.identity,
    progressionState: input.progressionState || progression(),
    skillDefinitions: skillDefinitions(),
    methodVector: Object.fromEntries(COMBAT_READINESS_DIMENSION_IDS.map((dimension) => [dimension, input.methodValue ?? 5])),
    equipmentVector: Object.fromEntries(COMBAT_READINESS_DIMENSION_IDS.map((dimension) => [dimension, 3])),
    preparationVector: Object.fromEntries(COMBAT_READINESS_DIMENSION_IDS.map((dimension) => [dimension, 2])),
    matchupMultiplierByDimension: Object.fromEntries(COMBAT_READINESS_DIMENSION_IDS.map((dimension) => [dimension, 10_000])),
    stateMultiplierBps: 10_000,
    environmentMultiplierBps: 10_000,
    encounter: {
      threatPoints: 52,
      weights: Object.fromEntries(COMBAT_READINESS_DIMENSION_IDS.map((dimension) => [dimension, 1_000])),
    },
    runAudits: input.runAudits,
    ragQuery: input.ragQuery,
    ragPage: input.ragPage,
  });
}

test("identity panel exposes authoritative archive and reincarnation state", () => {
  const panel = basePanel({
    identity: {
      identityId: "identity_beta",
      agentId: "agent_beta",
      explorerId: "explorer_alpha",
      status: "archived",
      generation: 2,
      previousAgentId: "agent_alpha",
      lineage: ["agent_alpha", "agent_beta"],
      lineageRootAgentId: "agent_alpha",
      canStartJourney: false,
      reincarnationRequired: true,
      source: "epoch_identity_archive",
    },
  });

  assert.equal(panel.schemaVersion, "causal-player-read-model.v2");
  assert.equal(panel.identity.status, "archived");
  assert.equal(panel.identity.canStartJourney, false);
  assert.equal(panel.identity.reincarnationRequired, true);
  assert.deepEqual(panel.identity.lineage, ["agent_alpha", "agent_beta"]);
});

test("wallet reports visible resource minor-units and material provenance", () => {
  const materialProvenance: readonly CausalPlayerMaterialProvenance[] = [{
    materialRef: "mat_ember",
    resourceKey: "material.ember",
    quantityMinor: "250",
    provenanceChannel: "salvage",
    sourceRefs: ["run_01"],
    evidenceIds: ["event_material"],
    accountRef: "identity:identity_alpha:wallet",
  }];
  const panel = causalPlayerPanel({
    snapshot: snapshot({
      balances: [
        { accountRef: "identity:identity_alpha:wallet", resourceKey: "gold", unit: "minor", balanceMinor: "12345", creditLimitMinor: "20000" },
        { accountRef: "identity:identity_alpha:wallet", resourceKey: "material.ember", unit: "minor", balanceMinor: "500" },
        { accountRef: "identity:identity_beta:wallet", resourceKey: "gold", unit: "minor", balanceMinor: "999999" },
      ],
    }),
    caller,
    progressionState: progression(),
    materialProvenance,
  });

  assert.deepEqual(panel.wallet.accounts, ["identity:identity_alpha:wallet"]);
  assert.equal(panel.wallet.currencies[0]?.balanceMinor, "12345");
  assert.equal(panel.wallet.materials[0]?.balanceMinor, "500");
  assert.deepEqual(panel.wallet.materials[0]?.materialProvenance, materialProvenance);
  assert.deepEqual(panel.wallet.capacity, { usedMinor: "12845", limitMinor: "20000", remainingMinor: "7155" });
});

test("wallet reports visible unique item durability and capacity details", () => {
  const uniqueItems: readonly CausalPlayerUniqueItemDetail[] = [{
    itemRef: "item:sword_alpha",
    itemKey: "black_sword",
    titleOwnerRef: "identity:identity_alpha",
    possessionAccountRef: "identity:identity_alpha:inventory",
    bucket: "carried",
    lifecycleState: "damaged",
    durability: { current: 7, max: 10, ratioBps: 7000 },
    capacityMinor: "1500",
    quality: 0.82,
    provenanceRefs: ["event_craft"],
    materialRefs: ["mat_ember"],
  }];
  const panel = causalPlayerPanel({
    snapshot: snapshot({
      ownership: [
        { itemRef: "item:sword_alpha", titleOwnerRef: "identity:identity_alpha", lifecycleState: "active" },
        { itemRef: "item:hidden_beta", titleOwnerRef: "identity:identity_beta", lifecycleState: "active" },
      ],
    }),
    caller,
    progressionState: progression(),
    uniqueItems,
  });

  assert.equal(panel.wallet.uniqueItems.length, 1);
  assert.deepEqual(panel.wallet.uniqueItems[0], uniqueItems[0]);
});

test("progression reports attributes stage bottlenecks talents skills loadout weight and insurance", () => {
  const loadoutItems: readonly CausalPlayerLoadoutItem[] = [
    { itemId: "item:sword_alpha", rarity: "rare", category: "weapon", deploymentCost: 4, weightMinor: "1200" },
    { itemId: "item:potion_alpha", rarity: "common", category: "consumable", quickUse: true, weightMinor: "300" },
  ];
  const panel = causalPlayerPanel({
    snapshot: snapshot(),
    caller,
    progressionState: progression(),
    skillDefinitions: skillDefinitions(),
    loadoutItems,
  });

  assert.equal(panel.progression.functionalStage?.stage, 2);
  assert.deepEqual(panel.progression.functionalStage?.bottlenecks, [
    "functional_xp:190/360",
    "domain_insight:8/20",
    "qualification_refs:missing",
    "injury:blocking",
    "pollution:blocking",
    "debt:blocking",
    "stability:blocking",
  ]);
  assert.equal(panel.progression.attributes.strength, 42);
  assert.deepEqual(panel.progression.talents.map((talent) => talent.talentId), ["scar_sense"]);
  assert.deepEqual(panel.progression.skillTree.learnedNodeIds, ["edge_step", "root_breath"]);
  assert.deepEqual(panel.progression.skillTree.advancement.map((row) => row.methodId), ["blade", "breath"]);
  assert.equal(panel.progression.loadout.insuranceLayers, 1);
  assert.equal(panel.progression.loadout.usedDeploymentCapacity, 5);
  assert.equal(panel.progression.loadout.usedQuickUseSlots, 1);
  assert.equal(panel.progression.loadout.usedWeightMinor, "1500");
});

test("RAG caller filtering covers all eight kinds through public region organization and evidence scopes", () => {
  const kinds: readonly EpochKnowledgeKind[] = ["fact", "observation", "claim", "belief", "rumor", "deception", "refutation", "memory"];
  const scoped = kinds.map((kind, index) => knowledge(kind, index % 4 === 0
    ? { visibility: { scopes: ["public"], legalAccess: "public" } }
    : index % 4 === 1
      ? { visibility: { scopes: ["region"], legalAccess: "source-bound", regionIds: ["region_north"] } }
      : index % 4 === 2
        ? { visibility: { scopes: ["organization"], legalAccess: "member", organizationIds: ["org_lantern"] } }
        : { visibility: { scopes: ["evidence"], legalAccess: "source-bound", evidenceIds: ["evidence_permit"] } }));
  const panel = causalPlayerPanel({
    snapshot: snapshot({ knowledge: scoped }),
    caller,
    progressionState: progression(),
  });

  assert.deepEqual(panel.rag.countsByKind, {
    fact: 1,
    observation: 1,
    claim: 1,
    belief: 1,
    rumor: 1,
    deception: 1,
    refutation: 1,
    memory: 1,
  });
  assert.equal(panel.rag.retrieval.visibleTotal, 8);
  assert.equal(panel.rag.retrieval.hiddenRecordsExcluded, 0);
});

test("RAG excludes inaccessible hidden content without leaking its text", () => {
  const panel = causalPlayerPanel({
    snapshot: snapshot({
      knowledge: [
        knowledge("fact", { id: "visible_fact", text: "public marker" }),
        knowledge("memory", {
          id: "hidden_memory",
          text: "hidden token should never appear",
          subject: "secret subject",
          visibility: { scopes: ["agent"], legalAccess: "owner", agentIds: ["agent_beta"] },
        }),
      ],
    }),
    caller,
    progressionState: progression(),
  });
  const serialized = JSON.stringify(panel.rag);

  assert.equal(panel.rag.hits.length, 1);
  assert.equal(panel.rag.retrieval.hiddenRecordsExcluded, 1);
  assert.equal(serialized.includes("hidden token"), false);
  assert.equal(serialized.includes("secret subject"), false);
});

test("combat readiness reports ten dimensions aggregate range and encounter fit", () => {
  const panel = basePanel();

  assert.deepEqual(Object.keys(panel.combat.dimensions).sort(), [...COMBAT_READINESS_DIMENSION_IDS].sort());
  assert.equal(panel.combat.aggregatePower.low <= panel.combat.aggregatePower.mid, true);
  assert.equal(panel.combat.aggregatePower.mid <= panel.combat.aggregatePower.high, true);
  assert.equal(panel.combat.encounterFit?.threatPoints, 52);
  assert.equal(panel.combat.encounterFit?.weights.offense, 1000);
});

test("recent runs are sorted by recency and retain intensity score breakdown", () => {
  const panel = basePanel({
    runAudits: [
      run(1, { breakdown: { combat: 1 } }),
      run(3, { breakdown: { combat: 3, extraction: 2 } }),
      run(2, { breakdown: { combat: 2 } }),
    ],
  });

  assert.deepEqual(panel.recentRuns.runs.map((entry) => entry.runId), ["run_03", "run_02", "run_01"]);
  assert.deepEqual(panel.recentRuns.runs[0]?.intensity, {
    worldIntensity: 23,
    encounterIntensity: 33,
    band: "medium",
    playerCombatRatio: 1.03,
  });
  assert.deepEqual(panel.recentRuns.runs[0]?.score, {
    finalScore: 109,
    rawScore: 86,
    grade: "B",
  });
  assert.deepEqual(panel.recentRuns.runs[0]?.breakdown, { combat: 3, extraction: 2 });
});

test("panel delta reports resource skill RAG combat intensity and score changes", () => {
  const before = basePanel({
    snapshot: snapshot({
      balances: [{ accountRef: "identity:identity_alpha:wallet", resourceKey: "gold", unit: "minor", balanceMinor: "100" }],
      knowledge: [knowledge("fact", { id: "fact_old", confidence: 0.4 })],
    }),
    progressionState: progression({ learnedSkillNodeIds: ["root_breath"], resources: { methodProficiency: { breath: 100 } } }),
    runAudits: [run(1)],
    methodValue: 1,
  });
  const after = basePanel({
    snapshot: snapshot({
      balances: [{ accountRef: "identity:identity_alpha:wallet", resourceKey: "gold", unit: "minor", balanceMinor: "175" }],
      knowledge: [knowledge("fact", { id: "fact_old", confidence: 0.7 }), knowledge("memory", { id: "memory_new" })],
    }),
    progressionState: progression({ learnedSkillNodeIds: ["root_breath", "edge_step"], resources: { methodProficiency: { breath: 160, blade: 10 } } }),
    runAudits: [run(2)],
    methodValue: 12,
  });

  assert.deepEqual(causalPlayerPanelDelta(before, after), {
    fromCheckpointHash: before.checkpointHash,
    toCheckpointHash: after.checkpointHash,
    resources: [{ key: "identity:identity_alpha:wallet:gold:minor", before: 100, after: 175, delta: 75 }],
    skills: {
      addedNodeIds: ["edge_step"],
      removedNodeIds: [],
      proficiency: [
        { key: "blade", before: 0, after: 10, delta: 10 },
        { key: "breath", before: 100, after: 160, delta: 60 },
      ],
    },
    rag: {
      addedIds: ["memory_new"],
      removedIds: [],
      confidence: [
        { key: "fact_old", before: 0.4, after: 0.7, delta: 0.29999999999999993 },
        { key: "memory_new", before: 0, after: 0.6, delta: 0.6 },
      ],
    },
    combatPower: {
      before: before.combat.aggregatePower.mid,
      after: after.combat.aggregatePower.mid,
      delta: after.combat.aggregatePower.mid - before.combat.aggregatePower.mid,
    },
    intensity: { before: 31, after: 32, delta: 1 },
    score: { before: 103, after: 106, delta: 3 },
  });
});

test("ten run audit keeps exactly ten runs and reports chronological combat intensity score changes", () => {
  const audit = causalPlayerTenRunAudit(basePanel({
    runAudits: Array.from({ length: 12 }, (_, index) => run(index + 1)),
  }));

  assert.equal(audit.runs.length, 10);
  assert.deepEqual(audit.runs.map((entry) => entry.runId), [
    "run_12",
    "run_11",
    "run_10",
    "run_09",
    "run_08",
    "run_07",
    "run_06",
    "run_05",
    "run_04",
    "run_03",
  ]);
  assert.equal(audit.changes.length, 9);
  assert.deepEqual(audit.changes[0], {
    fromRunId: "run_03",
    toRunId: "run_04",
    combatPowerDelta: 1,
    intensityDelta: 1,
    scoreDelta: 3,
    outcomeChanged: true,
  });
});

test("Pearson audit is descriptive non causal and handles constant sequences safely", () => {
  const audit = causalPlayerTenRunAudit(basePanel({
    runAudits: Array.from({ length: 10 }, (_, index) => run(index + 1, {
      combatPowerMid: 50,
      score: { finalScore: 100, rawScore: 100, grade: "B" },
    })),
  }));

  assert.equal(audit.descriptiveCorrelation.sampleSize, 10);
  assert.equal(audit.descriptiveCorrelation.combatPowerVsScorePearson, null);
  assert.equal(audit.descriptiveCorrelation.label, "insufficient_variance");
  assert.equal(audit.descriptiveCorrelation.caveat, "descriptive_non_causal");
});

test("pagination is stable and sanitizes sensitive visible RAG fields", () => {
  const panel = causalPlayerPanel({
    snapshot: snapshot({
      knowledge: [
        knowledge("fact", {
          id: "a_visible",
          text: "plain earliest",
          observedAt: "2026-07-20T00:00:00.000Z",
        }),
        knowledge("fact", {
          id: "b_token_visible",
          subject: "api token subject",
          text: "api token value should be redacted",
          evidenceIds: ["token_evidence"],
          source: {
            sourceId: "private_source_token",
            trustClass: "system_worker",
            sourceAuthority: "core",
            channel: "canonical",
            evidenceIds: ["event_token"],
          },
          observedAt: "2026-07-20T00:02:00.000Z",
        }),
        knowledge("fact", {
          id: "c_visible",
          text: "plain latest",
          observedAt: "2026-07-20T00:03:00.000Z",
        }),
      ],
    }),
    caller,
    progressionState: progression(),
    ragPage: { limit: 1, cursor: "1" },
  });

  assert.deepEqual(panel.rag.page, { cursor: "1", limit: 1, nextCursor: "2", total: 3 });
  assert.equal(panel.rag.hits[0]?.id, "b_token_visible");
  assert.equal(panel.rag.hits[0]?.subject, "[redacted]");
  assert.equal(panel.rag.hits[0]?.text, "[redacted]");
  assert.equal(panel.rag.hits[0]?.sourceChain[0]?.sourceId, "[redacted]");
  assert.deepEqual(panel.rag.hits[0]?.evidence.evidenceIds, ["[redacted]", "[redacted]"]);
});

test("empty data returns stable empty panels without throwing", () => {
  const panel = causalPlayerPanel({
    snapshot: snapshot(),
    caller: {},
  });

  assert.deepEqual(panel.wallet.accounts, []);
  assert.deepEqual(panel.progression.skillTree.learnedNodeIds, []);
  assert.deepEqual(panel.rag.hits, []);
  assert.deepEqual(panel.recentRuns.runs, []);
  assert.equal(panel.combat.aggregatePower.mid, 0);
  assert.equal(panel.identity.status, "unavailable");
  assert.equal(panel.identity.canStartJourney, false);
});
