import assert from "node:assert/strict";
import test from "node:test";

import {
  buildFallbackJourneyTaskPlan,
  type JourneyGeneratedTaskObjective,
  type JourneyTaskPlanInstallation,
} from "../lib/epoch/journeyGeneratedTaskRules.ts";
import {
  buildPersistedJourneyNarrative,
  buildServerJourneyEpisodeFacts,
} from "../lib/epoch/journeyNarrativeRules.ts";
import {
  generateTaskPlanJourneySceneEpisodes,
  type JourneyAvailableWorldObject,
  type JourneyRegionContext,
  type JourneySceneEpisode,
} from "../lib/epoch/journeySceneRules.ts";
import { buildGroundedJourneyStoryReport } from "../lib/epoch/journeyStoryReport.ts";
import {
  CANON_THRESHOLD_BPS,
  CONSEQUENCE_SCORE_POLICY_VERSION,
  SETTLEMENT_POLICY_VERSION,
} from "../lib/epoch/journeySettlementRules.ts";

const region: JourneyRegionContext = {
  id: "region_gray_harbor",
  type: "region",
  label: "灰港",
  sourceFactIds: ["world:region:region_gray_harbor"],
};

const availableWorldObjects: readonly JourneyAvailableWorldObject[] = [
  region,
  {
    id: "location_gray_harbor_civic_ledger",
    type: "workplace",
    label: "灰港民务账房",
    regionId: region.id,
    sourceFactIds: ["world:location:gray_harbor_civic_ledger"],
  },
  {
    id: "organization_gray_harbor_civic_office",
    type: "organization",
    label: "灰港民务所",
    regionId: region.id,
    sourceFactIds: ["world:organization:gray_harbor_civic_office"],
  },
  {
    id: "npc_night_clerk_kelan",
    type: "npc",
    label: "夜班书记珂岚",
    regionId: region.id,
    sourceFactIds: ["world:npc:night_clerk_kelan"],
  },
  {
    id: "document_gray_harbor_salt_ledger",
    type: "document",
    label: "灰港盐票账册",
    regionId: region.id,
    sourceFactIds: ["world:document:gray_harbor_salt_ledger"],
  },
];

const installation: JourneyTaskPlanInstallation = buildFallbackJourneyTaskPlan({
  taskType: "找一份稳定工作",
  scenarioMapId: region.id,
  availableWorldObjects,
});

const activeIdentity = {
  status: "active",
  lifetime: {
    max: 100,
    remaining: 80,
    startedAt: "2026-01-01T08:00:00.000Z",
  },
  personality: {
    traits: ["谨慎", "耐心"],
    driftIds: [],
  },
} as const;

function storyEpisodes(failedObjectiveId?: string): readonly JourneySceneEpisode[] {
  const scenePlan = generateTaskPlanJourneySceneEpisodes({
    plan: installation.plan,
    region,
    availableWorldObjects,
  });
  return scenePlan.episodes.map((sceneEpisode, index) => {
    const objective = sceneEpisode.generatedTaskObjective;
    const failed = objective?.objectiveId === failedObjectiveId;
    const action = objective?.actions[0];
    const optionKey = action?.optionKey ?? `${sceneEpisode.phase ?? "scene"}_${index}`;
    const optionLabel = action?.label ?? `${sceneEpisode.title}行动`;
    const outcomeSummary = action?.outcomeSummary ?? `${sceneEpisode.title}已由服务器确认。`;
    const episodeId = `episode_${index + 1}`;
    const taskAction = objective
      ? {
          optionKey,
          optionLabel,
          outcomeSummary,
          taskObjectiveId: objective.objectiveId,
          completionKind: failed ? "failed" as const : "complete" as const,
        }
      : { optionKey, optionLabel, outcomeSummary };
    const serverFacts = buildServerJourneyEpisodeFacts({
      journeyId: "journey_story",
      episodeId,
      phase: sceneEpisode.phase ?? "main",
      title: sceneEpisode.title,
      agent: { id: "agent_moth", displayName: "灯蛾" },
      worldObjectRefs: sceneEpisode.worldObjectRefs,
      action: taskAction,
      canonicalEventIds: [`event_${index + 1}`],
    });
    return {
      ...sceneEpisode,
      episodeId,
      generatedTaskObjective: objective,
      serverFacts,
      narrative: buildPersistedJourneyNarrative({ serverFacts }).value,
      settlement: {
        canonicalEventIds: [`event_${index + 1}`],
        outcomeSummary,
        ...(objective ? {
          taskObjective: {
            objectiveId: objective.objectiveId,
            completionKind: failed ? "failed" as const : "complete" as const,
          },
        } : {}),
      },
    };
  });
}

function worldCommit(input: {
  readonly completionTier: "未及格" | "及格";
  readonly reason: "main_incomplete" | "main_completed_and_above_threshold";
}) {
  const failed = input.completionTier === "未及格";
  return {
    mode: "mirror" as const,
    status: failed ? "discarded" as const : "solidified" as const,
    completionTier: input.completionTier,
    reason: input.reason,
    regionId: region.id,
    committedAtWorldTime: "2026-01-01T09:30:00.000Z",
    influenceDelta: 0,
    factionStandings: [],
    npcRelationships: [],
    sourceEventIds: ["event_commit"],
    completionScoreBps: failed ? 0 : 5_000,
    canonThresholdBps: CANON_THRESHOLD_BPS,
    settlementPolicyVersion: SETTLEMENT_POLICY_VERSION,
    consequenceScorePolicyVersion: CONSEQUENCE_SCORE_POLICY_VERSION,
    settlementId: "settlement_story",
    consequenceScoreBreakdown: {
      resultScoreBps: failed ? 0 : 5_000,
      selfLossScoreBps: 0,
      collateralScoreBps: 0,
    },
  } as const;
}

function reportInput(
  episodes: readonly JourneySceneEpisode[],
  commit: ReturnType<typeof worldCommit>,
  identity = activeIdentity,
) {
  return {
    journeyId: "journey_story",
    status: "settled" as const,
    objective: "找一份稳定工作",
    regionId: region.id,
    startedAtWorldTime: "2026-01-01T08:00:00.000Z",
    dueAtWorldTime: "2026-01-01T09:30:00.000Z",
    episodes,
    taskPlan: installation.plan,
    hiddenTaskSeal: installation.hiddenTaskSeal,
    hiddenPrerequisiteLinks: [],
    worldCommit: commit,
    identity,
  };
}

test("builds a grounded story only from the installed task plan and terminal evidence", () => {
  const episodes = storyEpisodes();
  const report = buildGroundedJourneyStoryReport(reportInput(
    episodes,
    worldCommit({ completionTier: "及格", reason: "main_completed_and_above_threshold" }),
  ));

  assert.ok(report);
  assert.equal(report.kind, "grounded_story_report");
  assert.equal(report.evaluation.taskCompletionGrade, "及格");
  assert.equal(report.evaluation.warning, undefined);
  assert.equal("attributes" in report.evaluation.rewards, false);
  assert.equal(report.mission.status, "completed");
  assert.equal(report.resolution.missionStatus, "completed");
  assert.equal(report.resolution.journeyStatus, "completed");
  assert.ok(report.chapters.some((chapter) => chapter.key === "arrival"));
  assert.ok(report.chapters.some((chapter) => chapter.key === "return"));
  assert.ok(report.chapters.every((chapter) => chapter.sourceEventIds.length > 0));
  assert.ok(report.storyContent.length > 0);
});

test("identity archive-shaped metadata does not become a journey archive warning", () => {
  const report = buildGroundedJourneyStoryReport(reportInput(
    storyEpisodes(),
    worldCommit({ completionTier: "及格", reason: "main_completed_and_above_threshold" }),
    {
      ...activeIdentity,
      status: "archived",
      lifetime: { ...activeIdentity.lifetime, remaining: 80, archivedAt: "2026-01-01T09:30:00.000Z" },
    },
  ));

  assert.ok(report);
  assert.equal(report.evaluation.warning, undefined);
  assert.ok(report.evaluation.identityFidelityPercent > 0);
});

test("a failed main evidence path yields the canonical failed mission grade", () => {
  const firstMain = installation.plan.objectives.find((objective) => objective.kind === "main");
  assert.ok(firstMain);
  const episodes = storyEpisodes(firstMain.objectiveId);
  const report = buildGroundedJourneyStoryReport(reportInput(
    episodes,
    worldCommit({ completionTier: "未及格", reason: "main_incomplete" }),
  ));

  assert.ok(report);
  assert.equal(report.evaluation.taskCompletionGrade, "未及格");
  assert.equal(report.mission.status, "failed");
  assert.equal(report.mission.outcome?.result, "failure");
  assert.equal(report.resolution.missionStatus, "failed");
  assert.ok(report.mission.tasks.some((task) => task.status === "failed"));
});

test("story generation fails closed before a terminal task path is fully grounded", () => {
  const episodes = storyEpisodes();
  const base = reportInput(
    episodes,
    worldCommit({ completionTier: "及格", reason: "main_completed_and_above_threshold" }),
  );
  assert.equal(buildGroundedJourneyStoryReport({ ...base, status: "running" }), undefined);
  assert.equal(buildGroundedJourneyStoryReport({ ...base, episodes: episodes.slice(0, 2) }), undefined);
});
