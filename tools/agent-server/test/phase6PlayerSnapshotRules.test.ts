import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPhase6PlayerSnapshotDocument,
  phase6PlayerPanelNoChangeReasons,
} from "../lib/epoch/phase6PlayerSnapshotRules.ts";

test("Phase 6 player snapshot exposes methods and derives domain-specific no-change reasons", () => {
  const before = buildPhase6PlayerSnapshotDocument(snapshotInput("before")).snapshot;
  const after = structuredClone(before);
  after.phase = "after";
  after.attributes.strength += 1;

  assert.deepEqual(after.progression.methods, [{
    currentProficiency: 72,
    methodId: "method-ember",
    nextTechniqueTier: 1,
    requirements: ["proficiency:72/150"],
  }]);

  const reasons = phase6PlayerPanelNoChangeReasons(before, after);
  assert.ok(reasons);
  assert.equal(reasons?.["attribute.strength"], undefined);
  assert.equal(reasons?.methods, "no_eligible_progression_change");
  assert.equal(reasons?.rag, "no_persistent_rag_change");
  assert.equal(reasons?.worldCursor, "no_world_cursor_change");
});

function snapshotInput(phase: "before" | "after") {
  return {
    phase,
    player: {
      playerId: "player-1",
      agentId: "agent-1",
      explorerId: "explorer-1",
      identityId: "identity-1",
      identity: { identityId: "identity-1" },
      progression: {
        identityId: "identity-1",
        lineageId: "lineage-1",
        powerSystemId: "cultivation",
        attributes: {
          strength: 10,
          agility: 11,
          physique: 12,
          intellect: 13,
          willpower: 14,
          spirituality: 15,
        },
        resources: { methodProficiency: { "method-ember": 72 } },
        talents: [],
        skillTree: {
          learnedNodeIds: [],
          definitions: [],
          proficiency: { "method-ember": 72 },
          advancement: [{
            methodId: "method-ember",
            currentProficiency: 72,
            nextTechniqueTier: 1,
            requirements: ["proficiency:72/150"],
          }],
        },
        functionalStage: { id: "stage-1", stage: 1, label: "Foundation", bottlenecks: [] },
        loadout: {
          carrySlots: 3,
          deploymentCapacity: 6,
          quickUseSlots: 2,
          echoSlots: 1,
          insuranceLayers: 0,
          broughtItems: [],
          usedDeploymentCapacity: 0,
          usedQuickUseSlots: 0,
          usedWeightMinor: "0",
        },
      },
      combatReadiness: {
        dimensions: {
          adaptation: 1,
          control: 2,
          corruptionResistance: 3,
          mobility: 4,
          offense: 5,
          perception: 6,
          protection: 7,
          reserve: 8,
          sustain: 9,
          synergy: 10,
        },
      },
      wallet: {
        accounts: [],
        currencies: [],
        resources: [],
        materials: [],
        uniqueItems: [],
        capacity: { total: 6 },
      },
      injuries: [],
      injuryStates: [],
      production: { entries: [], status: "legitimate_no_production" },
      ragPanel: {
        hits: [],
        countsByKind: {},
        page: { limit: 20, total: 0 },
        retrieval: { visibleTotal: 0 },
      },
    },
    progress: {
      agentId: "agent-1",
      explorerId: "explorer-1",
      identity: { identityId: "identity-1" },
      injuries: [],
      injuryStates: [],
      equipmentEffects: [],
      inventoryItems: [],
    },
    economy: {
      inventory: {},
      production: { entries: [], status: "legitimate_no_production" },
    },
    worldCursor: { sequence: 1, regionId: "region-1", worldTime: "epoch:1" },
  };
}
