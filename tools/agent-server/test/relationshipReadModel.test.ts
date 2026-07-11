import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";

import type {
  EpochAgentNpcBond,
  EpochHousehold,
  EpochNpcRecord,
  EpochNpcRelationship,
  EpochProjection,
  EpochRelationshipEdge,
} from "../lib/epoch/gameCore.ts";
import {
  agentNpcBondsView,
  householdsView,
  npcRelationshipsView,
  relationshipMedia,
  relationshipsView,
} from "../lib/epoch/relationshipReadModel.ts";

const modulePath = new URL("../lib/epoch/relationshipReadModel.ts", import.meta.url);

function npc(overrides: Partial<EpochNpcRecord> = {}): EpochNpcRecord {
  return {
    npcId: "npc_gray_clerk",
    npcKey: "gray_clerk",
    displayName: "灰港书记员",
    regionId: "region_gray_harbor",
    traits: ["careful"],
    createdAt: "2026-07-06T00:00:00.000Z",
    lifecycle: [],
    ...overrides,
  };
}

function projection(overrides: Partial<EpochProjection> = {}): EpochProjection {
  return {
    npcs: {},
    npcRelationships: {},
    npcRelationshipIdsByNpc: {},
    npcRelationshipIdsByRegion: {},
    agentNpcBonds: {},
    agentNpcBondIdsByAgent: {},
    agentNpcBondIdsByNpc: {},
    agentNpcBondIdsByRegion: {},
    households: {},
    householdIdsByNpc: {},
    householdIdsByRegion: {},
    relationshipEdges: {},
    relationshipIdsByAgent: {},
    ...overrides,
  } as EpochProjection;
}

function npcRelationship(overrides: Partial<EpochNpcRelationship> = {}): EpochNpcRelationship {
  return {
    relationshipId: "npc_rel_1",
    sourceNpcId: "npc_gray_clerk",
    targetNpcId: "npc_dock_child",
    sourceRegionId: "region_gray_harbor",
    targetRegionId: "region_gray_harbor",
    kind: "child",
    score: 2,
    reason: "家庭义务",
    sourceEventIds: ["event_1"],
    recordedAt: "2026-07-06T00:00:00.000Z",
    ...overrides,
  };
}

function agentNpcBond(overrides: Partial<EpochAgentNpcBond> = {}): EpochAgentNpcBond {
  return {
    bondId: "bond_1",
    agentId: "agent_1",
    explorerId: "explorer_1",
    npcId: "npc_gray_clerk",
    npcRegionId: "region_gray_harbor",
    kind: "friend",
    score: 2,
    previousScore: 0,
    scoreDelta: 2,
    focusSpent: 1,
    reason: "共同巡查",
    updatedAt: "2026-07-06T00:00:00.000Z",
    ...overrides,
  };
}

function household(overrides: Partial<EpochHousehold> = {}): EpochHousehold {
  return {
    householdId: "household_1",
    regionId: "region_gray_harbor",
    memberNpcIds: ["npc_gray_clerk", "npc_dock_child"],
    reason: "lifecycle_child",
    sourceEventIds: ["event_1"],
    recordedAt: "2026-07-06T00:00:00.000Z",
    ...overrides,
  };
}

function relationshipEdge(overrides: Partial<EpochRelationshipEdge> = {}): EpochRelationshipEdge {
  return {
    relationshipId: "agent_rel_1",
    sourceAgentId: "agent_1",
    sourceExplorerId: "explorer_1",
    targetAgentId: "agent_2",
    targetExplorerId: "explorer_2",
    kind: "alliance",
    score: 3,
    previousScore: 1,
    scoreDelta: 2,
    focusSpent: 1,
    reason: "协防灰港",
    updatedAt: "2026-07-06T00:00:00.000Z",
    ...overrides,
  };
}

test("relationship read model attaches packaged media to relationship edges", () => {
  assert.ok(existsSync(modulePath), "relationshipReadModel.ts should own relationship media projections");
  const view = relationshipsView(projection({
    relationshipEdges: {
      old: relationshipEdge({ relationshipId: "old", updatedAt: "2026-07-05T00:00:00.000Z" }),
      new: relationshipEdge({ relationshipId: "new", updatedAt: "2026-07-07T00:00:00.000Z" }),
    },
    relationshipIdsByAgent: {
      agent_1: ["old", "new"],
    },
  }), { agentId: "agent_1" });

  assert.deepEqual(view.map((item) => item.relationshipId), ["new", "old"]);
  assert.ok(view.every((item) => item.media.relationshipKey === "alliance"));
});

test("relationship read model filters NPC bonds without public NPC records", () => {
  const view = agentNpcBondsView(projection({
    npcs: {
      npc_gray_clerk: npc(),
    },
    agentNpcBonds: {
      missing_npc: agentNpcBond({ bondId: "missing_npc", npcId: "npc_missing" }),
      visible: agentNpcBond({ bondId: "visible", updatedAt: "2026-07-07T00:00:00.000Z" }),
    },
    agentNpcBondIdsByRegion: {
      region_gray_harbor: ["missing_npc", "visible"],
    },
  }), { regionId: "region_gray_harbor" });

  assert.deepEqual(view.map((item) => item.bondId), ["visible"]);
  assert.equal(view[0]?.npc.displayName, "灰港书记员");
  assert.equal(view[0]?.media.relationshipKey, "friend");
});

test("relationship read model summarizes households with NPC display names", () => {
  const view = householdsView(projection({
    npcs: {
      npc_gray_clerk: npc(),
      npc_dock_child: npc({ npcId: "npc_dock_child", displayName: "码头孩子" }),
    },
    households: {
      household_1: household(),
    },
    householdIdsByRegion: {
      region_gray_harbor: ["household_1"],
    },
  }), { regionId: "region_gray_harbor" });

  assert.deepEqual(view[0]?.memberNames, ["灰港书记员", "码头孩子"]);
  assert.equal(view[0]?.summary, "灰港书记员、码头孩子 有了新的家庭成员。");
  assert.equal(view[0]?.media.relationshipKey, "household");
});

test("relationship read model binds media to NPC relationships", () => {
  const view = npcRelationshipsView(projection({
    npcRelationships: {
      npc_rel_1: npcRelationship(),
    },
    npcRelationshipIdsByNpc: {
      npc_gray_clerk: ["npc_rel_1"],
    },
  }), { npcId: "npc_gray_clerk" });

  assert.equal(view[0]?.relationshipId, "npc_rel_1");
  assert.equal(view[0]?.media.relationshipKey, "child");
});

test("relationship media lookup fails loudly when a packaged asset is missing", () => {
  assert.throws(() => relationshipMedia("missing_kind" as never), /epoch_relationship_media_missing:missing_kind/);
});
