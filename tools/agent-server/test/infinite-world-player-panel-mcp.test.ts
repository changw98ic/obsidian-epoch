import assert from "node:assert/strict";
import test from "node:test";

import { createAgentHttpServer } from "../lib/httpServer.ts";
import { createAgentWorldMcpRuntime } from "../lib/mcpTools.ts";
import { createAgentWorldRuntime } from "../lib/mcpRuntimeCore.ts";
import { createCausalWorldSnapshot, type CausalWorldSnapshotV1 } from "../lib/epoch/causalWorldSnapshot.ts";
import { buildKnowledgeState, type EpochKnowledgeInputItem } from "../lib/epoch/knowledgeStateRules.ts";
import type { ProgressionAttributeId, ProgressionState } from "../lib/epoch/progressionRules.ts";

const WORLD_ID = "world_player_panel_mcp";
const AGENT_ID = "identity_alpha";
const EXPLORER_ID = "explorer_alpha";
const RECOVERY_CODE = Buffer.from(JSON.stringify({ explorerId: EXPLORER_ID, localSecret: "secret_alpha" }), "utf8").toString("base64");
const OPERATOR_KEY = "operator-panel";

function textPayload(result: { readonly content: readonly { readonly text: string }[] }) {
  return JSON.parse(result.content[0]?.text || "{}") as Record<string, unknown>;
}

const idCounters = new Map<string, number>();

function idFactory(kind: string, seed?: string) {
  if (kind === "agent" && seed?.startsWith(`${EXPLORER_ID}:1:`)) return AGENT_ID;
  const current = (idCounters.get(kind) || 0) + 1;
  idCounters.set(kind, current);
  return `panel_${kind}_${String(current).padStart(6, "0")}`;
}

async function mcpWithSnapshot(snapshot: CausalWorldSnapshotV1) {
  const mcp = createAgentWorldMcpRuntime({
    epoch: {
      idFactory,
      operatorKey: OPERATOR_KEY,
      now: () => "2026-07-20T00:00:00.000Z",
    },
    infiniteWorld: {
      worldId: WORLD_ID,
      initialSnapshot: snapshot,
    },
  });
  await mcp.callTool("obsidian_epoch.identity", {
    explorerId: EXPLORER_ID,
    recoveryCode: RECOVERY_CODE,
    identityName: "Alpha",
    idempotencyKey: "issue-alpha",
  });
  return mcp;
}

function attributes(): Record<ProgressionAttributeId, number> {
  return {
    strength: 40,
    agility: 35,
    physique: 38,
    intellect: 32,
    willpower: 41,
    spirituality: 30,
  };
}

function progressionState(): ProgressionState {
  return {
    identityId: AGENT_ID,
    lineageId: "lineage_alpha",
    functionalStage: 2,
    powerSystemId: "eastern_cultivation",
    attributes: attributes(),
    resources: {
      functionalXp: 240,
      insightPoints: 7,
      skillPointsSpent: 1,
      lineageMarks: 2,
      attributeEvidenceXp: { strength: 80 },
      methodProficiency: { breath: 180, blade: 220 },
      domainInsight: { dream_mind: 4 },
      materials: [{ materialId: "ember", quantity: 3 }],
    },
    learnedSkillNodeIds: ["root_breath", "edge_step"],
    talents: [],
    carrySlots: 5,
    deploymentCapacity: 9,
    quickUseSlots: 3,
    echoSlots: 1,
    insuranceLayers: 1,
    qualificationRefs: ["qualification:alpha"],
    status: { injurySeverity: 5, pollution: 0, debtSeverity: 0, stability: 90 },
  };
}

function knowledge(): readonly EpochKnowledgeInputItem[] {
  return [
    {
      id: "rag_public",
      kind: "fact",
      subject: "public pressure",
      text: "visible server pressure route",
      confidence: 0.9,
      source: { sourceId: "event_public", trustClass: "system_worker", sourceAuthority: "core", channel: "canonical", evidenceIds: ["event_public"] },
      visibility: { scopes: ["public"], legalAccess: "public" },
      createdAt: "2026-07-20T00:00:00.000Z",
    },
    {
      id: "rag_secret_org",
      kind: "memory",
      subject: "secret organization plan",
      text: "org-only server memory must not leak",
      confidence: 0.8,
      source: { sourceId: "event_secret", trustClass: "system_worker", sourceAuthority: "core", channel: "private", evidenceIds: ["event_secret"] },
      visibility: { scopes: ["organization"], legalAccess: "member", organizationIds: ["org_secret"] },
      createdAt: "2026-07-20T00:00:00.000Z",
    },
  ];
}

function runAudit(index: number) {
  return {
    runId: `run_${String(index).padStart(2, "0")}`,
    occurredAtWorldMinute: index,
    recordedAt: `2026-07-20T00:${String(index).padStart(2, "0")}:00.000Z`,
    outcome: index % 2 ? "clean_success" : "costly_success",
    combatPowerMid: 45 + index,
    intensity: {
      worldIntensity: 20 + index,
      encounterIntensity: 30 + index,
      band: index > 7 ? "high" : "medium",
      playerCombatRatio: 1 + index / 20,
    },
    score: {
      finalScore: 100 + index * 7,
      rawScore: 90 + index * 5,
      grade: index > 7 ? "A" : "B",
    },
    breakdown: { execution: index, survival: index + 2, risk: index + 3 },
  };
}

function snapshot(runCount = 10): CausalWorldSnapshotV1 {
  return createCausalWorldSnapshot({
    worldId: WORLD_ID,
    balances: {
      accounts: [
        { accountRef: `identity:${AGENT_ID}:wallet`, resourceKey: "gold", unit: "minor", balanceMinor: "1234", creditLimitMinor: "5000" },
        { accountRef: `identity:${AGENT_ID}:wallet`, resourceKey: "material.ember", unit: "minor", balanceMinor: "7" },
        { accountRef: "identity:identity_beta:wallet", resourceKey: "gold", unit: "minor", balanceMinor: "999999" },
      ],
    },
    ownership: {
      items: [
        { itemRef: "item:field_blade", titleOwnerRef: `identity:${AGENT_ID}`, lifecycleState: "active" },
        { itemRef: "item:beta_secret", titleOwnerRef: "identity:identity_beta", lifecycleState: "active" },
      ],
    },
    knowledge: buildKnowledgeState(knowledge()),
    domainExtensions: [{
      slotId: "player_projection",
      schemaId: "causal.player.fixture",
      schemaVersion: 1,
      owner: `identity:${AGENT_ID}`,
      hash: `sha256:${"a".repeat(64)}`,
      payload: {
        progressionState: progressionState(),
        skillDefinitions: [
          { nodeId: "root_breath", tier: "tier1", kind: "method_unlock", requiredStage: 1, requiredMethodId: "breath" },
          { nodeId: "edge_step", tier: "tier1", kind: "method_unlock", requiredStage: 1, requiredMethodId: "blade" },
        ],
        uniqueItems: [{
          itemRef: "item:field_blade",
          itemKey: "field_blade",
          titleOwnerRef: `identity:${AGENT_ID}`,
          possessionAccountRef: `identity:${AGENT_ID}:inventory`,
          bucket: "carried",
          lifecycleState: "active",
          durability: { current: 88, max: 100 },
          quality: 82,
          provenanceRefs: ["event_forge"],
          materialRefs: ["material.ember"],
        }],
        loadoutItems: [{ itemId: "field_blade", rarity: "rare", category: "weapon", quickUse: false, deploymentCost: 3, weightMinor: "2" }],
        runAudits: Array.from({ length: runCount }, (_, index) => runAudit(index + 1)),
      },
    }],
  });
}

test("player panel owner success uses server snapshot and clamps pagination", async () => {
  const mcp = await mcpWithSnapshot(snapshot());
  const payload = textPayload(await mcp.callTool("obsidian_epoch.player_panel", {
    agentId: AGENT_ID,
    recoveryCode: RECOVERY_CODE,
    ragLimit: 999,
    runLimit: 999,
    panel: { wallet: { currencies: [{ balanceMinor: "999999999" }] } },
  }));
  const panel = payload.panel as Record<string, any>;
  assert.equal(panel.wallet.currencies[0].balanceMinor, "1234");
  assert.equal(panel.wallet.materials[0].balanceMinor, "7");
  assert.equal(panel.wallet.uniqueItems[0].durability.current, 88);
  assert.deepEqual(panel.wallet.uniqueItems.map((item: { itemRef: string }) => item.itemRef), ["item:field_blade"]);
  assert.equal(panel.progression.resources.functionalXp, 240);
  assert.deepEqual(panel.progression.skillTree.learnedNodeIds, ["edge_step", "root_breath"]);
  assert.equal(panel.progression.loadout.carrySlots, 5);
  assert.equal(panel.progression.loadout.broughtItems[0].itemId, "field_blade");
  assert.equal(panel.combat.aggregatePower.label.length > 0, true);
  assert.equal(panel.recentRuns.runs[0].score.finalScore, 170);
  assert.equal(panel.recentRuns.runs[0].intensity.encounterIntensity, 40);
  assert.equal(panel.rag.page.limit, 100);
});

test("player panel rejects unauthorized reads", async () => {
  const mcp = await mcpWithSnapshot(snapshot());
  await assert.rejects(
    () => mcp.callTool("obsidian_epoch.player_panel", { agentId: AGENT_ID }),
    /infinite_world_owner_or_operator_auth_required/,
  );
  await assert.rejects(
    () => mcp.callTool("obsidian_epoch.player_panel", { agentId: AGENT_ID, recoveryCode: "wrong" }),
    /explorer_auth_invalid|explorer_auth_failed|recovery/i,
  );
});

test("another player and organization-private RAG do not leak to owner", async () => {
  const mcp = await mcpWithSnapshot(snapshot());
  const payload = textPayload(await mcp.callTool("obsidian_epoch.player_panel", {
    agentId: AGENT_ID,
    recoveryCode: RECOVERY_CODE,
    organizationIds: ["org_secret"],
    ragQuery: "server",
  }));
  const panel = payload.panel as Record<string, any>;
  assert.deepEqual(panel.rag.hits.map((hit: { id: string }) => hit.id), ["rag_public"]);
  assert.equal(JSON.stringify(panel).includes("org-only server memory must not leak"), false);
  assert.equal(panel.rag.retrieval.hiddenRecordsExcluded, 1);
  assert.equal(JSON.stringify(panel).includes("999999"), false);
  assert.equal(JSON.stringify(panel).includes("item:beta_secret"), false);
});

test("operator can read player panel and HTTP tools/call routes through existing endpoint", async () => {
  const runtime = createAgentWorldRuntime({
    epoch: { idFactory, operatorKey: OPERATOR_KEY },
    infiniteWorld: { worldId: WORLD_ID, initialSnapshot: snapshot() },
  });
  const mcp = createAgentWorldMcpRuntime({ runtime });
  const operator = textPayload(await mcp.callTool("obsidian_epoch.player_panel", {
    operatorKey: OPERATOR_KEY,
    identityId: AGENT_ID,
    organizationIds: ["org_secret"],
  }));
  const operatorPanel = operator.panel as Record<string, any>;
  assert.equal(operatorPanel.rag.hits.some((hit: { id: string }) => hit.id === "rag_secret_org"), true);

  const server = createAgentHttpServer({ runtime });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  try {
    const response = await fetch(`http://127.0.0.1:${address.port}/api/epoch/mcp/tools/call`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "obsidian_epoch.player_panel",
        arguments: { operatorKey: OPERATOR_KEY, identityId: AGENT_ID },
      }),
    });
    const body = await response.json() as Record<string, any>;
    assert.equal(response.status, 200);
    assert.equal(JSON.parse(body.content[0].text).panel.worldId, WORLD_ID);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("ten run audit requires exactly ten available runs and marks correlation non-causal", async () => {
  const mcp = await mcpWithSnapshot(snapshot(10));
  const payload = textPayload(await mcp.callTool("obsidian_epoch.ten_run_audit", {
    agentId: AGENT_ID,
    recoveryCode: RECOVERY_CODE,
  }));
  const audit = payload.audit as Record<string, any>;
  assert.equal(payload.ok, true);
  assert.equal(payload.available, 10);
  assert.equal(payload.required, 10);
  assert.equal(audit.runs.length, 10);
  assert.equal(audit.changes.length, 9);
  assert.equal(audit.descriptiveCorrelation.sampleSize, 10);
  assert.equal(audit.descriptiveCorrelation.caveat, "descriptive_non_causal");
});

test("ten run audit reports available and required for empty or insufficient data", async () => {
  const empty = await mcpWithSnapshot(createCausalWorldSnapshot({ worldId: WORLD_ID }));
  const emptyPayload = textPayload(await empty.callTool("obsidian_epoch.ten_run_audit", {
    agentId: AGENT_ID,
    recoveryCode: RECOVERY_CODE,
  }));
  assert.equal(emptyPayload.ok, false);
  assert.equal(emptyPayload.available, 0);
  assert.equal(emptyPayload.required, 10);

  const partial = await mcpWithSnapshot(snapshot(3));
  const partialPayload = textPayload(await partial.callTool("obsidian_epoch.ten_run_audit", {
    agentId: AGENT_ID,
    recoveryCode: RECOVERY_CODE,
  }));
  assert.equal(partialPayload.ok, false);
  assert.equal(partialPayload.available, 3);
  assert.equal(partialPayload.required, 10);
});
