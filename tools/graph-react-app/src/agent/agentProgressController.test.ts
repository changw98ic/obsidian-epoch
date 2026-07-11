import assert from "node:assert/strict";
import test from "node:test";
import { refreshAgentProgress } from "./agentProgressController";
import type { AgentProgressRefreshBundle } from "./agentProgressController";
import type {
  EpochAbuseStatus,
  EpochAgentBriefingView,
  EpochAgentMemoryInfo,
  EpochPersonalMigrationSummary,
} from "../types";

function briefing(agentId: string, generatedAt: string): EpochAgentBriefingView {
  return {
    generatedAt,
    progress: { agentId },
  } as unknown as EpochAgentBriefingView;
}

function memory(agentId: string): EpochAgentMemoryInfo {
  return { agentId, memories: [] } as unknown as EpochAgentMemoryInfo;
}

function personalMigrationSummary(agentId: string): EpochPersonalMigrationSummary {
  return { agentId, summaries: [] } as unknown as EpochPersonalMigrationSummary;
}

function abuseStatus(agentId: string): EpochAbuseStatus {
  return { agentId, active: false } as unknown as EpochAbuseStatus;
}

test("refreshAgentProgress commits a fresh progress bundle", async () => {
  let requestSeq = 0;
  let cleared = false;
  const committed: AgentProgressRefreshBundle[] = [];
  const calls: unknown[] = [];

  const result = await refreshAgentProgress({
    agentId: "agent_1",
    regionId: "region_gray_harbor",
    explorerId: "explorer_1",
    quiet: false,
    nextRequestSeq: () => ++requestSeq,
    currentRequestSeq: () => requestSeq,
    getLatestSnapshot: () => ({
      currentAgentId: "agent_1",
      regionId: "region_gray_harbor",
    }),
    clearBriefingSyncedAt: () => {
      cleared = true;
    },
    commit: (bundle) => {
      committed.push(bundle);
    },
    api: {
      getAgentBriefing: async (input) => {
        calls.push(["briefing", input]);
        return briefing(input?.agentId || "unknown", "2026-07-07T00:00:00.000Z");
      },
      getAgentMemory: async (input) => {
        calls.push(["memory", input]);
        return memory(input?.agentId || "unknown");
      },
      getPersonalMigrationSummary: async (input) => {
        calls.push(["migration", input]);
        return personalMigrationSummary(input?.agentId || "unknown");
      },
      getAbuseStatus: async (input) => {
        calls.push(["abuse", input]);
        return abuseStatus(input?.agentId || "unknown");
      },
    },
  });

  const bundle = committed[0];
  assert.ok(bundle);
  assert.equal(result.status, "applied");
  assert.equal(cleared, true);
  assert.equal(committed.length, 1);
  assert.equal(bundle.briefing.generatedAt, "2026-07-07T00:00:00.000Z");
  assert.equal(bundle.briefing.progress.agentId, "agent_1");
  assert.equal(bundle.memory.agentId, "agent_1");
  assert.equal(bundle.personalMigrationSummary.agentId, "agent_1");
  assert.deepEqual(bundle.abuseStatus, abuseStatus("agent_1"));
  assert.deepEqual(calls, [
    ["briefing", { agentId: "agent_1", regionId: "region_gray_harbor", limit: 6 }],
    ["memory", { agentId: "agent_1", regionId: "region_gray_harbor", limit: 6 }],
    ["migration", { agentId: "agent_1", explorerId: "explorer_1", limit: 6 }],
    ["abuse", { agentId: "agent_1" }],
  ]);
});

test("refreshAgentProgress drops stale progress bundles", async () => {
  let requestSeq = 0;
  let committed = false;
  let cleared = false;

  const result = await refreshAgentProgress({
    agentId: "agent_1",
    regionId: "region_gray_harbor",
    quiet: true,
    nextRequestSeq: () => ++requestSeq,
    currentRequestSeq: () => requestSeq,
    getLatestSnapshot: () => ({
      currentAgentId: "agent_2",
      regionId: "region_salt_mirror",
    }),
    clearBriefingSyncedAt: () => {
      cleared = true;
    },
    commit: () => {
      committed = true;
    },
    api: {
      getAgentBriefing: async (input) => briefing(input?.agentId || "unknown", "2026-07-07T00:00:00.000Z"),
      getAgentMemory: async (input) => memory(input?.agentId || "unknown"),
      getPersonalMigrationSummary: async (input) => personalMigrationSummary(input?.agentId || "unknown"),
      getAbuseStatus: async (input) => abuseStatus(input?.agentId || "unknown"),
    },
  });

  assert.equal(result.status, "stale");
  assert.equal(committed, false);
  assert.equal(cleared, false);
});
