import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";

import type {
  EpochNpcAssetState,
  EpochNpcCareerRecord,
  EpochNpcHealthState,
  EpochNpcLocationRecord,
  EpochNpcMemory,
  EpochNpcRecord,
  EpochProjection,
  EpochSocialHook,
} from "../lib/epoch/gameCore.ts";
import {
  npcAssetsView,
  npcCareersView,
  npcHealthView,
  npcLocationsView,
  npcMemoriesView,
  socialHooksView,
} from "../lib/epoch/npcStateReadModel.ts";

const modulePath = new URL("../lib/epoch/npcStateReadModel.ts", import.meta.url);

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
    npcs: {
      npc_gray_clerk: npc(),
    },
    npcMemories: {},
    npcMemoryIdsByNpc: {},
    npcMemoryIdsByRegion: {},
    npcCareerRecords: {},
    npcCareerIdsByNpc: {},
    npcCareerIdsByRegion: {},
    npcLocationRecords: {},
    npcLocationIdsByNpc: {},
    npcLocationIdsByRegion: {},
    npcAssetStates: {},
    npcAssetIdsByNpc: {},
    npcAssetIdsByRegion: {},
    npcHealthStates: {},
    npcHealthIdsByNpc: {},
    npcHealthIdsByRegion: {},
    socialHooks: {},
    socialHookIdsByNpc: {},
    socialHookIdsByRegion: {},
    ...overrides,
  } as EpochProjection;
}

function memory(overrides: Partial<EpochNpcMemory> = {}): EpochNpcMemory {
  return {
    memoryId: "memory_1",
    npcId: "npc_gray_clerk",
    regionId: "region_gray_harbor",
    summary: "记录了一次港口巡查。",
    importance: "low",
    sourceEventIds: ["event_1"],
    recordedAt: "2026-07-06T00:00:00.000Z",
    ...overrides,
  };
}

function career(overrides: Partial<EpochNpcCareerRecord> = {}): EpochNpcCareerRecord {
  return {
    careerId: "career_1",
    npcId: "npc_gray_clerk",
    regionId: "region_gray_harbor",
    title: "港务书记员",
    status: "active",
    sourceEventIds: ["event_1"],
    recordedAt: "2026-07-06T00:00:00.000Z",
    ...overrides,
  };
}

function location(overrides: Partial<EpochNpcLocationRecord> = {}): EpochNpcLocationRecord {
  return {
    locationId: "location_1",
    npcId: "npc_gray_clerk",
    fromRegionId: "region_ash_outpost",
    toRegionId: "region_gray_harbor",
    reason: "work",
    sourceEventIds: ["event_1"],
    recordedAt: "2026-07-06T00:00:00.000Z",
    ...overrides,
  };
}

function asset(overrides: Partial<EpochNpcAssetState> = {}): EpochNpcAssetState {
  return {
    assetId: "asset_1",
    npcId: "npc_gray_clerk",
    regionId: "region_gray_harbor",
    assetKey: "coin",
    delta: -2,
    balanceAfter: 8,
    reason: "family",
    sourceEventIds: ["event_1"],
    recordedAt: "2026-07-06T00:00:00.000Z",
    ...overrides,
  };
}

function health(overrides: Partial<EpochNpcHealthState> = {}): EpochNpcHealthState {
  return {
    healthId: "health_1",
    npcId: "npc_gray_clerk",
    regionId: "region_gray_harbor",
    status: "recovering",
    severity: "low",
    reason: "rest",
    sourceEventIds: ["event_1"],
    recordedAt: "2026-07-06T00:00:00.000Z",
    ...overrides,
  };
}

function socialHook(overrides: Partial<EpochSocialHook> = {}): EpochSocialHook {
  return {
    hookId: "hook_1",
    regionId: "region_gray_harbor",
    npcId: "npc_gray_clerk",
    kind: "letter",
    title: "家庭义务",
    body: "灰港书记员需要协助。",
    actionLabel: "处理家庭义务",
    risk: "low",
    sourceEventIds: ["event_1"],
    createdAt: "2026-07-06T00:00:00.000Z",
    ...overrides,
  };
}

test("NPC state read model sorts memories newest first", () => {
  assert.ok(existsSync(modulePath), "npcStateReadModel.ts should own NPC state projections");
  const view = npcMemoriesView(projection({
    npcMemories: {
      old: memory({ memoryId: "old", recordedAt: "2026-07-05T00:00:00.000Z" }),
      new: memory({ memoryId: "new", recordedAt: "2026-07-07T00:00:00.000Z" }),
    },
    npcMemoryIdsByRegion: {
      region_gray_harbor: ["old", "new"],
    },
  }), { regionId: "region_gray_harbor" });

  assert.deepEqual(view.map((item) => item.memoryId), ["new", "old"]);
});

test("NPC state read model adds display summaries to lifecycle records", () => {
  const base = projection({
    npcCareerRecords: { career_1: career() },
    npcCareerIdsByNpc: { npc_gray_clerk: ["career_1"] },
    npcLocationRecords: { location_1: location() },
    npcLocationIdsByNpc: { npc_gray_clerk: ["location_1"] },
    npcAssetStates: { asset_1: asset() },
    npcAssetIdsByNpc: { npc_gray_clerk: ["asset_1"] },
    npcHealthStates: { health_1: health() },
    npcHealthIdsByNpc: { npc_gray_clerk: ["health_1"] },
  });

  assert.equal(
    npcCareersView(base, { npcId: "npc_gray_clerk" })[0]?.summary,
    "灰港书记员 的职业更新为 港务书记员（active）。",
  );
  assert.equal(
    npcLocationsView(base, { npcId: "npc_gray_clerk" })[0]?.summary,
    "灰港书记员 从 region_ash_outpost 迁徙至 region_gray_harbor。",
  );
  assert.equal(
    npcAssetsView(base, { npcId: "npc_gray_clerk" })[0]?.summary,
    "灰港书记员 的资产 coin 减少 2，当前 8。",
  );
  assert.equal(
    npcHealthView(base, { npcId: "npc_gray_clerk" })[0]?.summary,
    "灰港书记员 的健康变为 recovering（low）。",
  );
});

test("NPC state read model falls back to NPC id when display name is missing", () => {
  const view = npcCareersView(projection({
    npcs: {},
    npcCareerRecords: {
      career_1: career({ npcId: "npc_missing" }),
    },
    npcCareerIdsByNpc: {
      npc_missing: ["career_1"],
    },
  }), { npcId: "npc_missing" });

  assert.equal(view[0]?.npcDisplayName, "npc_missing");
});

test("NPC state read model sorts social hooks newest first", () => {
  const view = socialHooksView(projection({
    socialHooks: {
      old: socialHook({ hookId: "old", createdAt: "2026-07-05T00:00:00.000Z" }),
      new: socialHook({ hookId: "new", createdAt: "2026-07-07T00:00:00.000Z" }),
    },
    socialHookIdsByNpc: {
      npc_gray_clerk: ["old", "new"],
    },
  }), { npcId: "npc_gray_clerk" });

  assert.deepEqual(view.map((item) => item.hookId), ["new", "old"]);
});
