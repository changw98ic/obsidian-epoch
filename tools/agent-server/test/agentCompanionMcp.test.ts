import assert from "node:assert/strict";
import test from "node:test";
import { handleMcpJsonRpcMessage } from "../lib/mcpJsonRpc.ts";
import { createMcpSamplingClient } from "../lib/mcpSampling.ts";
import { createMcpServerRequestManager } from "../lib/mcpServerRequestManager.ts";
import { createMcpSession } from "../lib/mcpSession.ts";
import { createAgentWorldMcpRuntime, createAgentWorldRuntime } from "../lib/mcpTools.ts";
import { createSequentialEpochIdFactory } from "../lib/epoch/protocol.ts";
import { epochEventsForPersistence } from "../lib/epoch/runtimePublicProjectionRules.ts";
import { journeyEventsForPersistence } from "../lib/epoch/journeyPersistence.ts";
import { JOURNEY_TASK_OBJECTIVE_LIMITS } from "../lib/epoch/journeyGeneratedTaskRules.ts";
import type { EpochEvent } from "../lib/epoch/events.ts";
import { createPhase6InMemoryStores } from "./phase6InMemoryStores.ts";

function payload(result: { readonly content: readonly { readonly text: string }[] }) {
  return JSON.parse(result.content[0]?.text ?? "null");
}

function recoveryCode(explorerId: string, localSecret: string) {
  return Buffer.from(JSON.stringify({ explorerId, localSecret }), "utf8").toString("base64");
}

async function fixture() {
  let realNow = "2026-07-12T00:00:00.000Z";
  let worldNow = "2026-01-01T08:00:00.000Z";
  let epochNow = "2026-07-12T00:00:00.000Z";
  const phase6Stores = createPhase6InMemoryStores();
  const mcp = createAgentWorldMcpRuntime({
    epoch: {
      idFactory: createSequentialEpochIdFactory("companion"),
      clock: () => new Date(epochNow),
      phase6RunAssemblyRepository: phase6Stores.phase6RunAssemblyRepository,
      phase6JourneyContextStore: phase6Stores.phase6JourneyContextStore,
      phase6ExperimentStore: phase6Stores.phase6ExperimentStore,
      phase6RagTraceStore: phase6Stores.phase6RagTraceStore,
    },
    journey: {
      now: () => realNow,
      worldNow: () => worldNow,
      defaultRealDurationMs: 30 * 60 * 1_000,
      defaultWorldDurationMs: 60 * 60 * 1_000,
    },
  });
  const explorerId = "explorer_companion";
  const ownerRecovery = recoveryCode(explorerId, "local-secret");
  const identity = payload(await mcp.callTool("obsidian_epoch.identity", {
    explorerId,
    recoveryCode: ownerRecovery,
    identityName: "灯蛾",
    idempotencyKey: "identity-1",
  }));
  return {
    mcp,
    explorerId,
    ownerRecovery,
    agentId: identity.value.agentId as string,
    advance: (real: string, world: string) => {
      realNow = real;
      worldNow = world;
    },
    advanceEpoch: (iso: string) => {
      epochNow = iso;
    },
  };
}

async function preparedAgentNativeJourney(
  suffix: string,
  epochNow?: string,
  proposalTool = "obsidian_epoch.propose_journey_step",
) {
  const context = await fixture();
  if (epochNow) context.advanceEpoch(epochNow);
  const prepared = payload(await context.mcp.callTool("obsidian_epoch.prepare_journey", {
    agentId: context.agentId,
    destinationRegionId: "灰港",
    mandate: { objective: "找稳定工作", priorities: ["work"] },
    recoveryCode: context.ownerRecovery,
    idempotencyKey: `prepare-${suffix}`,
  }));
  const started = payload(await context.mcp.callTool("obsidian_epoch.start_journey", {
    journeyId: prepared.journey.journeyId,
    expectedVersion: prepared.journey.version,
    recoveryCode: context.ownerRecovery,
    idempotencyKey: `start-${suffix}`,
  }));
  const proposed = payload(await context.mcp.callTool(proposalTool, {
    journeyId: started.journey.journeyId,
    expectedVersion: started.journey.version,
    recoveryCode: context.ownerRecovery,
    idempotencyKey: `propose-${suffix}`,
  }));
  return { ...context, prepared, started, proposed };
}

test("public journey proposal stays compact and remains directly committable", async () => {
  const context = await preparedAgentNativeJourney(
    "compact-public-proposal",
    undefined,
    "obsidian_epoch.propose_journey_step_compact",
  );
  assert.ok(
    Buffer.byteLength(JSON.stringify(context.proposed), "utf8") < 24_000,
    "public proposal must stay below external-agent persisted-output threshold",
  );
  assert.equal(context.proposed.transportVersion, "journey_proposal.compact.v1");
  const compactStatus = payload(await context.mcp.callTool("obsidian_epoch.journey_status_compact", {
    journeyId: context.started.journey.journeyId,
    recoveryCode: context.ownerRecovery,
  }));
  assert.ok(Buffer.byteLength(JSON.stringify(compactStatus), "utf8") < 24_000);
  assert.equal(compactStatus.transportVersion, "journey_status.compact.v1");
  const selected = context.proposed.proposal.sceneContract.actionOptions[0];
  assert.ok(selected?.signature);
  const committed = payload(await context.mcp.callTool("obsidian_epoch.commit_journey_action_compact", {
    journeyId: context.started.journey.journeyId,
    sceneId: context.proposed.proposal.sceneContract.sceneId,
    episodeId: context.proposed.proposal.episode.episodeId,
    expectedVersion: context.proposed.proposal.expectedVersion,
    actionOptionId: selected.actionOptionId,
    signature: selected.signature,
    recoveryCode: context.ownerRecovery,
    idempotencyKey: "commit-compact-public-proposal",
  }));
  assert.ok(Buffer.byteLength(JSON.stringify(committed), "utf8") < 24_000);
  assert.equal(committed.transportVersion, "journey_commit.compact.v1");
  assert.equal(committed.settledAction.actionOptionId, selected.actionOptionId);
});

test("MCP exposes an Agent-native start, propose, and commit journey flow", async () => {
  const { mcp, agentId, ownerRecovery, advance } = await fixture();
  const names = mcp.listTools().map((tool) => tool.name);
  for (const name of [
    "prepare_journey",
    "start_journey",
    "propose_journey_step",
    "commit_journey_action",
    "journey_status",
    "recall_journey",
    "journey_album",
  ]) {
    assert.ok(names.includes(`obsidian_epoch.${name}`), name);
  }

  const prepared = payload(await mcp.callTool("obsidian_epoch.prepare_journey", {
    agentId,
    destinationRegionId: "灰港",
    mandate: { objective: "找稳定工作", priorities: ["work"], avoid: ["conflict"] },
    presetId: "cautious",
    recoveryCode: ownerRecovery,
    idempotencyKey: "prepare-1",
  }));
  assert.equal(prepared.journey.status, "prepared");
  assert.equal(prepared.policySelection.presetId, "cautious");
  assert.match(prepared.preview.text, /计划：/);
  await assert.rejects(
    () => mcp.callTool("obsidian_epoch.prepare_journey", {
      agentId,
      destinationRegionId: "灰港",
      mandate: { objective: "找稳定工作", priorities: ["work"], avoid: ["conflict"] },
      presetId: "cautious",
      recoveryCode: "invalid-owner-credential",
      idempotencyKey: "prepare-1",
    }),
    /explorer_auth_invalid|recovery_code_invalid|explorer_auth_required/,
  );

  const started = payload(await mcp.callTool("obsidian_epoch.start_journey", {
    journeyId: prepared.journey.journeyId,
    expectedVersion: prepared.journey.version,
    recoveryCode: ownerRecovery,
    idempotencyKey: "start-1",
  }));
  assert.equal(started.journey.status, "awaiting_agent");
  assert.deepEqual(started.scenePlan.episodes.map((episode: { phase: string }) => episode.phase),
    ["arrival", "main", "return"]);
  assert.equal(started.sampling.fallback, "agent_native");
  assert.equal(started.episodes.length, 1);
  assert.equal(started.episodes[0].phase, "arrival");
  assert.equal(started.episodes[0].serverFacts.journeyId, started.journey.journeyId);
  assert.equal(started.episodes[0].narrative.kind, "grounded_narrative");
  assert.deepEqual(started.episodes[0].narrative.sourceEventIds, started.episodes[0].serverFacts.sourceEventIds);
  assert.equal(started.nextAction, "obsidian_epoch.propose_journey_step");

  const proposed = payload(await mcp.callTool("obsidian_epoch.propose_journey_step", {
    journeyId: started.journey.journeyId,
    expectedVersion: started.journey.version,
    recoveryCode: ownerRecovery,
    idempotencyKey: "propose-main-1",
  }));
  assert.equal(proposed.proposal.episode.phase, "main");
  assert.equal(proposed.proposal.sceneContract.sceneType, "livelihood");
  assert.deepEqual(proposed.proposal.actionOptions.map((option: { optionKey: string }) => option.optionKey), [
    "ask_for_shift",
    "verify_salt_ledger",
    "carry_manifest",
    "ask_about_recent_travelers",
    "report_discrepancy",
    "leave_without_commitment",
  ]);
  assert.equal(proposed.proposal.actionOptions.some((option: { optionKey: string }) =>
    ["observe", "assist", "anomaly"].includes(option.optionKey)), false);
  const selected = proposed.proposal.sceneContract.actionOptions[0];
  const committed = payload(await mcp.callTool("obsidian_epoch.commit_journey_action", {
    journeyId: started.journey.journeyId,
    sceneId: proposed.proposal.sceneContract.sceneId,
    episodeId: proposed.proposal.episode.episodeId,
    expectedVersion: proposed.proposal.expectedVersion,
    actionOptionId: selected.actionOptionId,
    signature: selected.signature,
    recoveryCode: ownerRecovery,
    idempotencyKey: "commit-main-1",
  }));
  assert.equal(committed.journey.status, "returning");
  assert.equal(committed.mainEpisode.phase, "main");
  assert.equal(committed.returnEpisode.phase, "return");
  assert.equal(committed.mainEpisode.narrative.kind, "grounded_narrative");
  assert.equal(committed.returnEpisode.narrative.kind, "grounded_narrative");
  assert.equal(committed.settledAction.actionOptionId, selected.actionOptionId);

  advance("2026-07-12T00:45:00.000Z", "2026-01-01T09:30:00.000Z");

  const status = payload(await mcp.callTool("obsidian_epoch.journey_status", {
    journeyId: prepared.journey.journeyId,
    recoveryCode: ownerRecovery,
  }));
  assert.deepEqual(status.episodes.map((episode: { phase: string }) => episode.phase),
    ["arrival", "main", "return"]);
  assert.equal(status.storyReport.kind, "grounded_story_report");
  assert.equal(status.storyReport.version, 3);
  assert.equal(status.storyReport.journeyId, status.journey.journeyId);
  assert.deepEqual(Object.keys(status.storyReport.structure), ["desire", "obstacle", "choice", "consequence"]);
  assert.equal(status.storyReport.profile.objective, "找稳定工作");
  assert.match(status.storyReport.profile.codeName, /^X-/);
  assert.equal(status.storyReport.profile.reincarnation, "轮回第一世");
  assert.equal(status.storyReport.evaluation.taskCompletionGrade, "F");
  assert.equal(typeof status.storyReport.evaluation.identityFidelityPercent, "number");
  assert.ok(status.storyReport.evaluation.identityFidelityPercent >= 0);
  assert.ok(status.storyReport.evaluation.identityFidelityPercent <= 100);
  assert.notEqual(status.storyReport.evaluation.identityFidelityPercent, 40);
  assert.equal(status.storyReport.evaluation.warning, undefined);
  assert.equal(status.interactionLog.kind, "journey_interaction_log");
  assert.equal(status.interactionLog.version, 1);
  assert.equal(status.interactionLog.journeyId, status.journey.journeyId);
  assert.deepEqual(status.interactionLog.entries.map((entry: { phase: string }) => entry.phase),
    ["arrival", "main", "return"]);
  assert.equal(status.interactionLog.entries[1].selectedAction.label, selected.label);
  assert.match(status.storyReport.narrative, /该局目标：找稳定工作/);
  assert.match(status.storyReport.narrative, /任务完成度：F/);
  assert.doesNotMatch(status.storyReport.narrative, /该身份将无法保留/u);
  assert.match(status.storyReport.storyContent, /向夜班书记珂岚询问当日仍缺人手的班次/);
  assert.deepEqual(status.storyReport.chapters.map((chapter: { key: string }) => chapter.key), [
    "departure", "arrival", "encounter", "decision", "consequence", "return", "aftermath",
  ]);
  assert.equal(status.storyReport.storyContent.split("\n\n").length, 7);
  assert.match(status.storyReport.storyContent, /灰港民务账房/);
  assert.match(status.storyReport.storyContent, /灰港民务所/);
  assert.match(status.storyReport.storyContent, /夜班书记珂岚/);
  assert.doesNotMatch(status.storyReport.storyContent, /任务|目标|委托|完成标准|成功条件|失败条件|结算|可追溯/);
  assert.doesNotMatch(status.storyReport.storyContent, /否则|足以证明|返程时限已经逼近|终于|冲突/);
  assert.deepEqual(
    new Set(status.storyReport.sourceEventIds),
    new Set(status.episodes.flatMap((episode: { serverFacts: { sourceEventIds: string[] } }) =>
      episode.serverFacts.sourceEventIds)),
  );
  assert.doesNotMatch(status.storyReport.narrative, /\b(?:epoch|region|journey|episode)_[a-z0-9_]+\b/);
  assert.equal(
    status.finalVerification.page.payload.journey.storyReport.narrative,
    status.storyReport.narrative,
  );
  assert.equal("interactionLog" in status.finalVerification.page.payload.journey, false);
  assert.ok(status.episodes.every((episode: { serverFacts?: unknown; narrative?: unknown }) =>
    episode.serverFacts && episode.narrative));
  const canonicalEvents = mcp.runtime.epochEvents({ limit: 1_000 }).events;
  for (const episode of status.episodes as { serverFacts: { sourceEventIds: string[] } }[]) {
    for (const sourceEventId of episode.serverFacts.sourceEventIds) {
      const event = canonicalEvents.find((candidate: { eventId: string }) => candidate.eventId === sourceEventId);
      assert.ok(event, sourceEventId);
      assert.equal(event.correlationId, status.journey.correlationId);
    }
  }

  const replay = payload(await mcp.callTool("obsidian_epoch.commit_journey_action", {
    journeyId: started.journey.journeyId,
    sceneId: proposed.proposal.sceneContract.sceneId,
    episodeId: proposed.proposal.episode.episodeId,
    expectedVersion: proposed.proposal.expectedVersion,
    actionOptionId: selected.actionOptionId,
    signature: selected.signature,
    recoveryCode: ownerRecovery,
    idempotencyKey: "commit-main-1",
  }));
  assert.equal(replay.duplicate, true);
  assert.deepEqual(replay.journey.episodeIds, status.journey.episodeIds);

  const album = payload(await mcp.callTool("obsidian_epoch.journey_album", {
    agentId,
    recoveryCode: ownerRecovery,
  }));
  assert.equal(album.journeys.length, 1);
  assert.equal(album.postcards.length, 3);
  assert.equal(album.currentYear, 1);
  assert.equal(album.annualChronicle.year, 1);
  assert.equal(album.journeys[0].storyReport.narrative, status.storyReport.narrative);
  assert.deepEqual(album.journeys[0].interactionLog, status.interactionLog);
  assert.deepEqual(album.postcards.map((postcard: { narrative: string }) => postcard.narrative),
    status.episodes.map((episode: { narrative: { postcard?: { text: string } } }) => episode.narrative.postcard?.text));

  const briefing = payload(await mcp.callTool("obsidian_epoch.agent_briefing", {
    agentId,
    recoveryCode: ownerRecovery,
    deferReturnDelivery: true,
  }));
  assert.deepEqual(briefing.recentEpisodes.map((episode: { narrative: unknown }) => episode.narrative),
    status.episodes.map((episode: { narrative: unknown }) => episode.narrative));
  assert.equal(briefing.returnedJourneyReports[0].journeyId, status.journey.journeyId);
  assert.equal(briefing.returnedJourneyReports[0].storyReport.narrative, status.storyReport.narrative);
  assert.deepEqual(briefing.returnedJourneyReports[0].interactionLog, status.interactionLog);
});

test("a safe full clear is graded good instead of becoming an automatic perfect result", async () => {
  const { mcp, agentId, ownerRecovery } = await fixture();
  const prepared = payload(await mcp.callTool("obsidian_epoch.prepare_journey", {
    agentId,
    destinationRegionId: "region_quantum_laboratory",
    taskType: "辅助完成一次实验",
    mandate: { objective: "辅助完成一次实验", priorities: ["experiment", "safe_return"] },
    recoveryCode: ownerRecovery,
    idempotencyKey: "prepare-generated-route",
  }));
  let current = payload(await mcp.callTool("obsidian_epoch.start_journey", {
    journeyId: prepared.journey.journeyId,
    expectedVersion: prepared.journey.version,
    taskGenerationMode: "server_fallback",
    recoveryCode: ownerRecovery,
    idempotencyKey: "start-generated-route",
  }));
  assert.deepEqual(current.journeyEntryReserve.reserve, [
    { resourceId: "focus", amount: 2 },
    { resourceId: "stamina", amount: 1 },
  ]);
  assert.equal(current.journeyEntryReserve.balances.focus, 2);
  assert.equal(current.journeyEntryReserve.balances.stamina, 1);
  assert.equal(current.journeyEntryReserve.duplicate, false);
  assert.equal(current.scenePlan.episodes[0].phase, "arrival");
  assert.equal(current.scenePlan.episodes.at(-1).phase, "return");
  assert.ok(current.journey.taskPlan.objectives.length > 5);
  assert.ok(current.journey.taskPlan.routes.some((route: { kind: string }) => route.kind === "choice"));
  assert.ok(current.journey.taskPlan.routes.some((route: { kind: string }) => route.kind === "unlock"));
  assert.equal("hiddenTask" in current.journey.taskPlan, false);

  let sideRewardCount = 0;
  for (let index = 0; current.journey.status !== "settled" && index < current.journey.taskPlan.objectives.length; index += 1) {
    const proposed = payload(await mcp.callTool("obsidian_epoch.propose_journey_step", {
      journeyId: current.journey.journeyId,
      expectedVersion: current.journey.version,
      recoveryCode: ownerRecovery,
      idempotencyKey: `propose-generated-route-${index}`,
    }));
    const selected = proposed.proposal.sceneContract.actionOptions.find((option: {
      completionKind?: string;
      routeSelection?: { factionObjectId?: string };
    }) => option.completionKind !== "skip" && Boolean(option.routeSelection?.factionObjectId))
      ?? proposed.proposal.sceneContract.actionOptions.find((option: { completionKind?: string; risk: string }) =>
        option.completionKind !== "skip" && option.risk === "low")
      ?? proposed.proposal.sceneContract.actionOptions.find((option: { completionKind?: string }) =>
        option.completionKind !== "skip");
    assert.ok(selected);
    assert.equal(selected.completionKind, undefined);
    current = payload(await mcp.callTool("obsidian_epoch.commit_journey_action", {
      journeyId: current.journey.journeyId,
      sceneId: proposed.proposal.sceneContract.sceneId,
      episodeId: proposed.proposal.episode.episodeId,
      expectedVersion: proposed.proposal.expectedVersion,
      actionOptionId: selected.actionOptionId,
      signature: selected.signature,
      recoveryCode: ownerRecovery,
      idempotencyKey: `commit-generated-route-${index}`,
    }));
    assert.equal(current.settledAction.journeyResolution.authority, "server");
    assert.equal(current.settledAction.journeyResolution.completionKind, "complete");
    if (proposed.proposal.episode.phase === "side") {
      assert.deepEqual(current.settledAction.reward, {
        resourceId: "coin",
        amount: 1,
        reason: `journey_side_objective:${current.journey.journeyId}:${proposed.proposal.episode.generatedTaskObjective.objectiveId}`,
      });
      sideRewardCount += 1;
    }
    if (current.journey.status !== "settled") {
      const mirrorEvents = mcp.runtime.epochEvents({ limit: 1_000 }).events.filter((event: {
        correlationId?: string;
      }) => event.correlationId === current.journey.correlationId);
      assert.equal(mirrorEvents.some((event: { eventType: string }) => [
        "journey_world_solidified",
        "region_influence_changed",
        "agent_faction_standing_changed",
        "agent_npc_bond_updated",
        "npc_memory_recorded",
        "world_clock_advanced",
        "world_simulation_advanced",
      ].includes(event.eventType)), false);
    }
  }

  assert.equal(current.journey.status, "settled");
  const executedObjectiveIds = new Set(current.episodes.flatMap((episode: {
    generatedTaskObjective?: { objectiveId: string };
  }) => episode.generatedTaskObjective ? [episode.generatedTaskObjective.objectiveId] : []));
  const choiceEpisode = current.episodes.find((episode: {
    generatedTaskObjective?: { kind: string };
  }) => episode.generatedTaskObjective?.kind === "choice");
  const choiceObjective = current.journey.taskPlan.objectives.find((objective: { kind: string }) => objective.kind === "choice");
  const selectedChoiceAction = choiceObjective.actions.find((action: { optionKey: string }) =>
    action.optionKey === choiceEpisode.serverFacts.storyBeat.selectedAction.optionKey);
  const selectedRoute = current.journey.taskPlan.routes.find((route: { routeId: string }) =>
    route.routeId === selectedChoiceAction.selectsRouteId);
  assert.ok(selectedRoute.factionObjectId);
  const unselectedRoutes = current.journey.taskPlan.routes.filter((route: { kind: string; routeId: string }) =>
    route.kind === "choice" && route.routeId !== selectedRoute.routeId);
  assert.ok(selectedRoute.objectiveIds.every((objectiveId: string) => executedObjectiveIds.has(objectiveId)));
  assert.ok(unselectedRoutes.every((route: { objectiveIds: string[] }) =>
    route.objectiveIds.every((objectiveId) => !executedObjectiveIds.has(objectiveId))));
  const unlockedRoute = current.journey.taskPlan.routes.find((route: { kind: string }) => route.kind === "unlock");
  assert.ok(unlockedRoute.objectiveIds.every((objectiveId: string) => executedObjectiveIds.has(objectiveId)));
  assert.equal(current.episodes.length, executedObjectiveIds.size + 2);
  assert.equal(current.taskAdjudication.mainCompleted, current.taskAdjudication.mainTotal);
  assert.equal(current.taskAdjudication.sideCompleted, 2);
  assert.equal(sideRewardCount, 2);
  assert.equal(current.taskAdjudication.tier, "良好");
  assert.equal(current.taskAdjudication.performance.perfectEligible, false);
  assert.equal(current.taskAdjudication.performance.completedByRisk.low, executedObjectiveIds.size);
  assert.equal(current.taskAdjudication.performance.completedByRisk.medium, 0);
  assert.equal(current.taskAdjudication.performance.completedByRisk.high, 0);
  assert.equal(current.taskAdjudication.hiddenTask.revealed, true);
  assert.ok(current.rewardGrant);
  assert.equal(current.rewardGrant.grantedItems.length, 1);
  assert.equal(current.rewardGrant.grantedAttributes.length, 0);
  assert.equal(current.taskAdjudication.rewardBundle.items.length, 1);
  assert.equal(current.taskAdjudication.rewardBundle.items[0].rarity, "common");
  assert.equal(current.taskAdjudication.rewardBundle.attributes.length, 0);
  assert.ok(current.storyReport.evaluation.rewards.resources.some((reward: { resourceId: string; amount: number }) =>
    reward.resourceId === current.taskAdjudication.reward.resourceId
      && reward.amount >= current.taskAdjudication.reward.amount));
  assert.ok(current.storyReport.evaluation.rewards.resources.some((reward: { resourceId: string; amount: number }) =>
    reward.resourceId === "coin" && reward.amount >= 2));
  assert.match(current.storyReport.evaluation.rewards.summary, /金币|以太|传说/u);
  assert.match(current.storyReport.evaluation.rewards.summary, /道具/u);
  assert.match(current.storyReport.evaluation.rewardConversion.summary, /隐藏装备分/u);
  assert.match(current.storyReport.evaluation.playerImpact.summary, /其他玩家/u);
  assert.match(current.storyReport.evaluation.playerImpact.summary, /量子实验室地区影响/u);
  assert.doesNotMatch(
    current.storyReport.evaluation.playerImpact.summary,
    /\b(?:region|organization|npc)_[a-z0-9_]+\b/u,
  );
  assert.equal(current.storyReport.evaluation.playerImpact.scope, "shared_world");
  assert.match(current.storyReport.narrative, /任务完成度：良好/u);
  assert.match(current.storyReport.narrative, /评分依据：/u);
  assert.equal(current.worldCommit.status, "solidified");
  assert.equal(current.journey.worldCommit.commitEventId, current.worldCommit.commitEventId);
  assert.ok(current.worldCommit.npcRelationships.length > 0);
  assert.match(current.storyReport.narrative, /世界固化：/u);
  assert.match(current.storyReport.narrative, /NPC关系：/u);
  assert.doesNotMatch(current.storyReport.narrative, /。；/u);
  const regionInfo = mcp.runtime.epochRegionInfo({
    regionId: "region_quantum_laboratory",
    activityLimit: 100,
    influenceLimit: 100,
    traceLimit: 100,
  });
  const journeyActivities = regionInfo.activities.filter((activity: { kind: string }) => activity.kind === "journey");
  const journeyInfluence = regionInfo.influenceChanges.filter((change: { reason: string }) =>
    change.reason.startsWith(`journey_objective:${current.journey.journeyId}:`));
  const journeyTraces = regionInfo.traces.filter((trace: { title: string }) =>
    trace.title.startsWith("旅程留下影响："));
  assert.equal(journeyActivities.length, 1);
  assert.equal(journeyActivities[0].title, "镜像对局固化");
  assert.equal(journeyInfluence.length, executedObjectiveIds.size);
  assert.equal(journeyTraces.length, executedObjectiveIds.size);
  assert.ok(journeyInfluence.every((change: { influenceDelta: number }) =>
    change.influenceDelta >= 1 && change.influenceDelta <= 5));
  const progress = mcp.runtime.epochProgress({ agentId });
  const factionStanding = progress.factionStandings.find((standing: { factionId: string }) =>
    standing.factionId === selectedRoute.factionObjectId);
  assert.ok(factionStanding);
  assert.equal(factionStanding.score, 100);
  assert.ok(factionStanding.routeIds.includes(selectedRoute.routeId));
  assert.ok(factionStanding.journeyIds.includes(current.journey.journeyId));
  assert.equal(choiceEpisode.serverFacts.stateChanges.some((change: { stateChangeId: string }) =>
    change.stateChangeId.includes(":faction_alignment:")), false);
  assert.ok(current.worldCommit.factionStandings.some((standing: { factionId: string; routeId: string }) =>
    standing.factionId === selectedRoute.factionObjectId && standing.routeId === selectedRoute.routeId));
  const nextPrepared = payload(await mcp.callTool("obsidian_epoch.prepare_journey", {
    agentId,
    destinationRegionId: "region_quantum_laboratory",
    taskType: "复查后续实验",
    recoveryCode: ownerRecovery,
    idempotencyKey: "prepare-affiliation-followup",
  }));
  const nextContext = mcp.runtime.epochJourneyTaskGenerationContext({
    journeyId: nextPrepared.journey.journeyId,
    expectedVersion: nextPrepared.journey.version,
    recoveryCode: ownerRecovery,
  });
  const affiliatedObject = nextContext.availableWorldObjects.find((object: { id: string }) =>
    object.id === selectedRoute.factionObjectId);
  assert.ok(affiliatedObject?.tags?.includes("agent_affiliated"));
  assert.ok(Array.isArray(nextContext.carriedInventoryItems));
  assert.equal(nextContext.carriedInventoryItems.length, current.rewardGrant.grantedItems.length);
  assert.ok(nextContext.carriedInventoryItems.some((item: {
    readonly itemId: string;
    readonly displayName: string;
    readonly rarity: string;
  }) => item.itemId === current.rewardGrant.grantedItems[0].itemId
    && item.displayName === current.rewardGrant.grantedItems[0].displayName
    && item.rarity === "common"));
  const replayEvents = mcp.runtime.epochEvents({ limit: 100 }).events.slice().reverse();
  const replayedRuntime = createAgentWorldRuntime({ epochEvents: replayEvents });
  assert.deepEqual(
    replayedRuntime.epochProgress({ agentId }).factionStandings,
    progress.factionStandings,
  );
  assert.equal(current.interactionLog.kind, "journey_interaction_log");
  assert.equal(current.interactionLog.entries.filter((entry: { phase: string }) => entry.phase === "main").length,
    current.taskAdjudication.mainTotal + current.taskAdjudication.bonusMainTotal);
  assert.equal(current.interactionLog.entries.filter((entry: { phase: string }) => entry.phase === "side").length, 2);
  assert.equal(current.interactionLog.entries.length, current.episodes.length);
  assert.equal(current.storyReport.chapters[0].key, "departure");
  assert.equal(current.storyReport.chapters[1].key, "arrival");
  assert.equal(current.storyReport.chapters.at(-1).key, "return");
  assert.equal(current.storyReport.chapters.filter((chapter: { key: string }) => chapter.key === "side_quest").length, 2);
  const actionChapterLeads = current.storyReport.chapters
    .filter((chapter: { key: string }) => ["encounter", "objective", "side_quest"].includes(chapter.key))
    .map((chapter: { text: string }) => chapter.text.split("。")[0]);
  assert.equal(new Set(actionChapterLeads).size, actionChapterLeads.length);
  const playerStoryText = [
    current.storyReport.storyContent,
    ...current.storyReport.chapters.map((chapter: { title: string }) => chapter.title),
  ].join("\n");
  assert.doesNotMatch(
    playerStoryText,
    /任务|主线|支线|本局|互斥路线|对应路线|签名行动|行动事件|服务端/u,
  );
  assert.doesNotMatch(current.storyReport.storyContent, /选择了「|主线：|支线：|服务端最终评定|对应奖励/u);
  assert.match(current.storyReport.storyContent, /为了.*，你离开落脚处/u);
  assert.doesNotMatch(current.storyReport.storyContent, /处理完前一件事后/u);
  assert.doesNotMatch(current.storyReport.storyContent, /主实验结束后/u);
  assert.doesNotMatch(
    current.storyReport.storyContent,
    /只进入这一条不同方案|转入选定方案|也在这里|地图中|你由现场参与者/u,
  );
  assert.doesNotMatch(current.storyReport.storyContent, /接着，你随后|没有立刻离开。.*没有立即离开/u);
  assert.doesNotMatch(current.storyReport.storyContent, /也随你一起被带了回来|这一世里的这段经历至此结束/u);
  assert.doesNotMatch(current.storyReport.storyContent, /带着带回/u);
  assert.doesNotMatch(current.storyReport.storyContent, /带着.+(?:记录|报告|数据|复核单).+回到落脚处/u);
  assert.match(current.storyReport.storyContent, /(?:确认.+(?:提交|归档)|记下.+回执).+回到落脚处。$/u);

  const firstProgress = payload(await mcp.callTool("obsidian_epoch.progress", { agentId }));
  const resourceId = current.taskAdjudication.reward.resourceId;
  const balance = firstProgress.resources[resourceId];
  const inventoryCount = firstProgress.inventoryItems.length;
  const finalized = payload(await mcp.callTool("obsidian_epoch.journey_status", {
    journeyId: current.journey.journeyId,
    recoveryCode: ownerRecovery,
  }));
  assert.equal(finalized.storyReport.mission.status, "completed");
  assert.equal(finalized.storyReport.resolution.missionStatus, "completed");
  assert.equal(finalized.finalVerification.page.payload.journey.episodes[0].phase, "arrival");
  assert.equal(finalized.finalVerification.page.payload.journey.episodes.at(-1).phase, "return");
  const filedStatus = payload(await mcp.callTool("obsidian_epoch.journey_status", {
    journeyId: current.journey.journeyId,
    recoveryCode: ownerRecovery,
  }));
  assert.deepEqual(filedStatus.storyReport, finalized.finalVerification.page.payload.journey.storyReport);
  const repeatedProgress = payload(await mcp.callTool("obsidian_epoch.progress", { agentId }));
  assert.equal(repeatedProgress.resources[resourceId], balance);
  assert.equal(repeatedProgress.inventoryItems.length, inventoryCount);
});

test("an optional side objective can be declined without abandoning the required main route", async () => {
  const { mcp, agentId, ownerRecovery } = await fixture();
  const prepared = payload(await mcp.callTool("obsidian_epoch.prepare_journey", {
    agentId,
    destinationRegionId: "region_quantum_laboratory",
    taskType: "辅助完成一次实验",
    mandate: {
      objective: "优先完成实验主线，资源不足时放弃额外协助",
      priorities: ["experiment", "preserve_resources"],
    },
    recoveryCode: ownerRecovery,
    idempotencyKey: "prepare-generated-optional-side-skip",
  }));
  let current = payload(await mcp.callTool("obsidian_epoch.start_journey", {
    journeyId: prepared.journey.journeyId,
    expectedVersion: prepared.journey.version,
    taskGenerationMode: "server_fallback",
    recoveryCode: ownerRecovery,
    idempotencyKey: "start-generated-optional-side-skip",
  }));

  let skippedSideObjectiveId: string | undefined;
  for (let index = 0; current.journey.status !== "settled" && index < 20; index += 1) {
    const proposed = payload(await mcp.callTool("obsidian_epoch.propose_journey_step", {
      journeyId: current.journey.journeyId,
      expectedVersion: current.journey.version,
      recoveryCode: ownerRecovery,
      idempotencyKey: `propose-generated-optional-side-skip-${index}`,
    }));
    const objective = proposed.proposal.episode.generatedTaskObjective;
    const selected = objective?.kind === "side" && skippedSideObjectiveId === undefined
      ? proposed.proposal.sceneContract.actionOptions.find((option: { completionKind?: string }) =>
          option.completionKind === "skip")
      : proposed.proposal.sceneContract.actionOptions.find((option: { completionKind?: string; risk: string }) =>
          option.completionKind !== "skip" && option.risk === "low")
        ?? proposed.proposal.sceneContract.actionOptions.find((option: { completionKind?: string }) =>
          option.completionKind !== "skip");
    assert.ok(selected);
    if (objective?.kind === "side" && skippedSideObjectiveId === undefined) {
      skippedSideObjectiveId = objective.objectiveId;
      assert.equal(selected.completionKind, "skip");
      assert.match(selected.label, /继续主线/u);
    }
    current = payload(await mcp.callTool("obsidian_epoch.commit_journey_action", {
      journeyId: current.journey.journeyId,
      sceneId: proposed.proposal.sceneContract.sceneId,
      episodeId: proposed.proposal.episode.episodeId,
      expectedVersion: proposed.proposal.expectedVersion,
      actionOptionId: selected.actionOptionId,
      signature: selected.signature,
      recoveryCode: ownerRecovery,
      idempotencyKey: `commit-generated-optional-side-skip-${index}`,
    }));
  }

  assert.ok(skippedSideObjectiveId);
  assert.equal(current.journey.status, "settled");
  assert.equal(current.taskAdjudication.mainCompleted, current.taskAdjudication.mainTotal);
  assert.equal(current.taskAdjudication.sideCompleted, 0);
  assert.equal(current.taskAdjudication.tier, "及格");
  assert.equal(current.worldCommit.status, "solidified");
  assert.equal(current.worldCommit.reason, "main_completed_and_returned");
  assert.ok(current.worldCommit.sourceEventIds.length > 0);
  assert.match(current.storyReport.narrative, /本局已固化/u);
  assert.equal(mcp.runtime.epochEvents({
    eventType: "journey_world_solidified",
    limit: 100,
  }).events.some((event) => event.eventType === "journey_world_solidified"
    && event.payload.journeyId === current.journey.journeyId), true);
  assert.ok(current.taskAdjudication.performance.skippedActions >= 1);
  assert.ok(current.interactionLog.entries.some((entry: {
    objective?: { objectiveId: string };
    outcomeSummary: string;
  }) => entry.objective?.objectiveId === skippedSideObjectiveId
    && /跳过/u.test(entry.outcomeSummary)));
  assert.match(current.storyReport.storyContent, /没有参加这次额外协助，把精力留给接下来的行动/u);
  assert.doesNotMatch(current.storyReport.storyContent, /需求、资源和长期目标|支线|主线|服务器|记录为跳过/u);
});

test("a server-signed skipped main objective fails the generated run without inventing a returned result", async () => {
  const { mcp, agentId, ownerRecovery } = await fixture();
  const prepared = payload(await mcp.callTool("obsidian_epoch.prepare_journey", {
    agentId,
    destinationRegionId: "region_quantum_laboratory",
    taskType: "辅助完成一次实验",
    recoveryCode: ownerRecovery,
    idempotencyKey: "prepare-generated-skipped-main",
  }));
  let current = payload(await mcp.callTool("obsidian_epoch.start_journey", {
    journeyId: prepared.journey.journeyId,
    expectedVersion: prepared.journey.version,
    taskGenerationMode: "server_fallback",
    recoveryCode: ownerRecovery,
    idempotencyKey: "start-generated-skipped-main",
  }));

  for (let index = 0; current.journey.status !== "settled" && index < current.journey.taskPlan.objectives.length; index += 1) {
    const proposed = payload(await mcp.callTool("obsidian_epoch.propose_journey_step", {
      journeyId: current.journey.journeyId,
      expectedVersion: current.journey.version,
      recoveryCode: ownerRecovery,
      idempotencyKey: `propose-generated-skipped-main-${index}`,
    }));
    const selected = index === 0
      ? proposed.proposal.sceneContract.actionOptions.find((option: { completionKind?: string }) =>
          option.completionKind === "skip")
      : proposed.proposal.sceneContract.actionOptions.find((option: { completionKind?: string; risk: string }) =>
          option.completionKind !== "skip" && option.risk === "low")
        ?? proposed.proposal.sceneContract.actionOptions.find((option: { completionKind?: string }) =>
          option.completionKind !== "skip");
    assert.ok(selected);
    current = payload(await mcp.callTool("obsidian_epoch.commit_journey_action", {
      journeyId: current.journey.journeyId,
      sceneId: proposed.proposal.sceneContract.sceneId,
      episodeId: proposed.proposal.episode.episodeId,
      expectedVersion: proposed.proposal.expectedVersion,
      actionOptionId: selected.actionOptionId,
      signature: selected.signature,
      recoveryCode: ownerRecovery,
      idempotencyKey: `commit-generated-skipped-main-${index}`,
    }));
  }

  assert.equal(current.journey.status, "settled");
  assert.equal(current.taskAdjudication.mainCompleted, 0);
  assert.equal(current.taskAdjudication.tier, "未及格");
  assert.equal(current.mission.status, "failed");
  assert.equal(current.rewardGrant, undefined);
  assert.equal(current.episodes[1].serverFacts.storyBeat.selectedAction.completionKind, "skip");
  assert.match(current.storyReport.storyContent, /没有继续眼前的行动，随后开始准备返程/u);
  assert.doesNotMatch(current.storyReport.storyContent, /记录为跳过|服务器|开始收束本局行动/u);
  assert.match(current.storyReport.storyContent, /没有把沿途留下的记录当成已经办成的结果。$/u);
  assert.doesNotMatch(current.storyReport.chapters.at(-1).text, /已经在现场归档|带着.+回到落脚处/u);
  assert.match(current.storyReport.narrative, /任务完成度：未及格/u);
  assert.equal(current.worldCommit.status, "discarded");
  assert.deepEqual(current.worldCommit.sourceEventIds, []);
  assert.match(current.storyReport.narrative, /本局镜像未固化/u);
  const finalizedFailedRun = payload(await mcp.callTool("obsidian_epoch.journey_status", {
    journeyId: current.journey.journeyId,
    recoveryCode: ownerRecovery,
  }));
  assert.match(finalizedFailedRun.storyReport.evaluation.warning ?? "", /本局未及格.*无法继续保留/u);
  assert.ok(finalizedFailedRun.storyReport.evaluation.identityFidelityPercent <= 20);
  assert.equal(
    finalizedFailedRun.finalVerification.page.payload.journey.storyReport.evaluation.warning,
    finalizedFailedRun.storyReport.evaluation.warning,
  );
  const skippedFailureProgress = payload(await mcp.callTool("obsidian_epoch.progress", { agentId }));
  assert.equal(skippedFailureProgress.identity.status, "archived");
  const failedMirrorEvents = mcp.runtime.epochEvents({ limit: 1_000 }).events.filter((event: {
    correlationId?: string;
  }) => event.correlationId === current.journey.correlationId);
  assert.equal(failedMirrorEvents.some((event: { eventType: string }) => [
    "journey_world_solidified",
    "region_influence_changed",
    "agent_faction_standing_changed",
    "agent_npc_bond_updated",
    "npc_memory_recorded",
    "world_clock_advanced",
    "world_simulation_advanced",
  ].includes(event.eventType)), false);
});

test("Host Sampling partial persistence retains every generated objective action event", async () => {
  const { mcp, agentId, ownerRecovery } = await fixture();
  const prepared = payload(await mcp.callTool("obsidian_epoch.prepare_journey", {
    agentId,
    destinationRegionId: "region_starship_graveyard",
    taskType: "参加打捞队入门试炼",
    recoveryCode: ownerRecovery,
    idempotencyKey: "prepare-generated-staged-persistence",
  }));
  const session = createMcpSession({ sessionId: "generated_staged_persistence", transport: "stdio" });
  session.acceptInitialize({
    protocolVersion: "2025-06-18",
    capabilities: { sampling: {} },
    clientInfo: { name: "generated-staged-persistence-host", version: "1" },
  });
  session.acceptInitializedNotification();
  const sent: Record<string, unknown>[] = [];
  let requestSequence = 0;
  const manager = createMcpServerRequestManager({
    send: (message) => { sent.push(message); },
    requestIdFactory: () => `generated-staged-${++requestSequence}`,
  });
  const partials: { readonly toolName: string; readonly result: unknown }[] = [];
  const responsePromise = handleMcpJsonRpcMessage(mcp, {
    jsonrpc: "2.0",
    id: 601,
    method: "tools/call",
    params: {
      name: "obsidian_epoch.start_journey",
      arguments: {
        journeyId: prepared.journey.journeyId,
        expectedVersion: prepared.journey.version,
        taskGenerationMode: "server_fallback",
        decisionMode: "host_sampling",
        recoveryCode: ownerRecovery,
        idempotencyKey: "start-generated-staged-persistence",
      },
    },
  }, {
    session,
    sampling: createMcpSamplingClient({ session, requestManager: manager }),
    persistPartial: async (toolName, result) => { partials.push({ toolName, result }); },
  });

  let responseSettled = false;
  void responsePromise.then(
    () => { responseSettled = true; },
    () => { responseSettled = true; },
  );
  let index = 0;
  while (!responseSettled) {
    while (sent.length <= index && !responseSettled) {
      await new Promise<void>((resolve) => setImmediate(resolve));
    }
    if (responseSettled) break;
    const requestBound = JOURNEY_TASK_OBJECTIVE_LIMITS.mainMax
      + JOURNEY_TASK_OBJECTIVE_LIMITS.sideMax
      + JOURNEY_TASK_OBJECTIVE_LIMITS.choiceMax;
    if (index >= requestBound) throw new Error("generated_staged_sampling_request_bound_exceeded");
    const request = sent[index] as {
      readonly id: string;
      readonly params: {
        readonly systemPrompt?: string;
        readonly messages: readonly { readonly content: { readonly text: string } }[];
      };
    };
    const prompt = JSON.parse(request.params.messages[0]!.content.text);
    if (index === 0) {
      assert.match(request.params.systemPrompt || "", /not as a quest-grade optimizer/u);
      assert.equal(typeof prompt.decisionContext.identity.identityName, "string");
      assert.ok(Array.isArray(prompt.decisionContext.identity.traits), JSON.stringify(Object.keys(prompt.decisionContext ?? {})));
      assert.ok(Array.isArray(prompt.decisionContext.identity.strongestNeeds));
      assert.equal(typeof prompt.decisionContext.resources, "object");
      assert.match(prompt.decisionContext.worldSlice.sliceHash, /^sha256:/u);
      assert.equal(typeof prompt.decisionContext.worldSlice.direction, "object");
      assert.ok(JSON.stringify(prompt.decisionContext.worldSlice).length < 2_000);
      assert.ok(prompt.actionOptions.every((option: {
        intent?: string;
        decisionEffect?: string;
      }) => typeof option.intent === "string" && typeof option.decisionEffect === "string"));
    }
    manager.handleResponse({
      jsonrpc: "2.0",
      id: request.id,
      result: {
        role: "assistant",
        content: { type: "text", text: JSON.stringify({
          actionOptionId: (prompt.actionOptions.find((option: {
            risk: string;
            decisionEffect: string;
          }) => option.risk === "low" && option.decisionEffect === "attempt_objective")
            ?? prompt.actionOptions.find((option: { decisionEffect: string }) =>
              option.decisionEffect === "attempt_objective")
            ?? prompt.actionOptions[0]).actionOptionId,
          rationale: "选择服务器签发的完成行动",
          confidence: 0.95,
        }) },
        model: "staged-persistence-host",
        stopReason: "endTurn",
      },
    });
    index += 1;
  }

  const response = await responsePromise;
  assert.ok(response && "result" in response);
  const result = payload(response.result as { readonly content: readonly { readonly text: string }[] });
  assert.equal(result.journey.status, "settled");
  const stepPartials = partials.filter((partial) =>
    partial.toolName === "obsidian_epoch.propose_journey_step");
  assert.ok(stepPartials.length >= 3, `stepPartials=${stepPartials.length}, sent=${sent.length}, samplingDecisions=${result.samplingDecisions?.length ?? 0}`);
  assert.equal(stepPartials.length, sent.length);
  assert.equal(stepPartials.length, result.samplingDecisions.length);
  for (const partial of stepPartials) {
    const persisted = partial.result;
    assert.ok(persisted && typeof persisted === "object", "each propose_journey_step partial should carry persisted result");
    const keys = Object.keys(persisted as Record<string, unknown>);
    assert.ok(keys.length > 0, `propose_journey_step partial should have keys, got: ${JSON.stringify(keys)}`);
  }
  manager.close();
});

test("task type and server map are sent to Host Sampling and the validated model blueprint is persisted", async () => {
  const { mcp, agentId, ownerRecovery } = await fixture();
  const prepared = payload(await mcp.callTool("obsidian_epoch.prepare_journey", {
    agentId,
    destinationRegionId: "region_quantum_laboratory",
    taskType: "辅助完成一次实验",
    mandate: { objective: "辅助完成一次实验" },
    recoveryCode: ownerRecovery,
    idempotencyKey: "prepare-model-blueprint",
  }));
  const session = createMcpSession({ sessionId: "task_blueprint_sampling", transport: "stdio" });
  session.acceptInitialize({
    protocolVersion: "2025-06-18",
    capabilities: { sampling: {} },
    clientInfo: { name: "test-host", version: "1" },
  });
  session.acceptInitializedNotification();
  const sent: Record<string, unknown>[] = [];
  const manager = createMcpServerRequestManager({
    send: (message) => { sent.push(message); },
    requestIdFactory: () => "server-task-blueprint",
  });
  const sampling = createMcpSamplingClient({ session, requestManager: manager });
  const responsePromise = handleMcpJsonRpcMessage(mcp, {
    jsonrpc: "2.0",
    id: 501,
    method: "tools/call",
    params: {
      name: "obsidian_epoch.start_journey",
      arguments: {
        journeyId: prepared.journey.journeyId,
        expectedVersion: prepared.journey.version,
        taskGenerationMode: "model_sampling",
        recoveryCode: ownerRecovery,
        idempotencyKey: "start-model-blueprint",
      },
    },
  }, { session, sampling });
  await new Promise<void>((resolve) => setImmediate(resolve));
  const request = JSON.parse(JSON.stringify(sent[0]));
  const prompt = JSON.parse(request.params.messages[0].content.text);
  assert.equal(prompt.taskType, "辅助完成一次实验");
  assert.equal(prompt.identityName, "灯蛾");
  assert.equal(prompt.scenarioMapId, "region_quantum_laboratory");
  assert.ok(prompt.availableWorldObjects.some((object: { id: string }) => object.id === "device_phase_stabilizer"));
  const taskNpc = prompt.availableWorldObjects.find((object: { type: string; id: string; label: string }) =>
    object.type === "npc");
  assert.ok(taskNpc);
  assert.notEqual(taskNpc.id, "npc_chief_researcher_linduo");
  const objectiveSeeds = [
    { id: "main_prepare", kind: "main", sequence: 1, title: "检查实验舱" },
    { id: "main_calibrate", kind: "main", sequence: 2, title: "校准稳定器" },
    { id: "main_verify", kind: "main", sequence: 3, title: "核验样本数据" },
    { id: "side_log", kind: "side", sequence: 1, title: "整理实验日志" },
    { id: "side_reset", kind: "side", sequence: 2, title: "复位实验台" },
  ] as const;
  const proposal = {
    title: "相位样本协作实验",
    premise: `${taskNpc.label}正在相位实验舱进行样本测试，需要助手完成检查、校准和核验。`,
    primaryObjective: "协助完成第七码样本测试并提交记录。",
    successResult: "第七码样本测试记录",
    completionResult: { kind: "knowledge", returnMode: "report", summary: "第七码样本测试记录" },
    objectives: objectiveSeeds.map((seed) => ({
      objectiveId: seed.id,
      kind: seed.kind,
      sequence: seed.sequence,
      title: seed.title,
      objective: `在相位实验舱完成${seed.title}。`,
      completionCriteria: `${seed.title}产生签名行动记录。`,
      sceneType: "commission",
      locationId: "location_quantum_phase_chamber",
      worldObjectIds: ["location_quantum_phase_chamber", taskNpc.id, "device_phase_stabilizer"],
      actions: [0, 1].map((choice) => ({
        optionKey: `${seed.id}_choice_${choice + 1}`,
        label: `与${taskNpc.label}在相位实验舱执行${seed.title}方案${choice + 1}`,
        intent: `只操作相位稳定器并按${taskNpc.label}确认的顺序完成${seed.title}。`,
        risk: choice === 0 ? "low" : "medium",
        allowedEffectKinds: ["journey_progress", "world_reference"],
        targetObjectIds: ["location_quantum_phase_chamber", taskNpc.id, "device_phase_stabilizer"],
        outcomeSummary: `身份与${taskNpc.label}在相位实验舱完成了${seed.title}方案${choice + 1}，记录已保存。`,
      })),
    })),
  };
  manager.handleResponse({
    jsonrpc: "2.0",
    id: request.id,
    result: {
      role: "assistant",
      content: { type: "text", text: JSON.stringify(proposal) },
      model: "host-model",
      stopReason: "endTurn",
    },
  });
  const response = await responsePromise;
  assert.ok(response && "result" in response);
  const result = payload(response.result as { readonly content: readonly { readonly text: string }[] });
  assert.equal(result.taskGeneration.ok, true);
  assert.equal(result.journey.taskPlan.source, "model_sampling");
  assert.equal(result.journey.taskPlan.objectives.length, 5);
  assert.deepEqual(result.scenePlan.episodes.map((episode: { phase: string }) => episode.phase), [
    "arrival", "main", "main", "main", "side", "side", "return",
  ]);
  assert.equal("reward" in result.journey.taskPlan, false);
  assert.equal("hiddenTask" in result.journey.taskPlan, false);
});

test("one Journey is a complete mission with explicit tasks, stakes, criteria, and a terminal result", async () => {
  const { mcp, agentId, ownerRecovery, advance } = await fixture();
  const prepared = payload(await mcp.callTool("obsidian_epoch.prepare_journey", {
    agentId,
    destinationRegionId: "灰港",
    mandate: { objective: "找稳定工作", priorities: ["work"], avoid: ["conflict"] },
    recoveryCode: ownerRecovery,
    idempotencyKey: "prepare-complete-mission",
  }));

  assert.equal(prepared.mission.kind, "journey_mission");
  assert.equal(prepared.mission.version, 1);
  assert.equal(prepared.mission.status, "briefing");
  assert.match(prepared.mission.primaryObjective, /灰港民务所/);
  assert.match(prepared.mission.primaryObjective, /完成一项.*登记.*事务/);
  assert.ok(prepared.mission.stakes.length >= 20);
  assert.ok(prepared.mission.successCriteria.length >= 3);
  assert.ok(prepared.mission.failureConditions.length >= 3);
  assert.ok(prepared.mission.failureConsequences.length >= 1);
  assert.deepEqual(prepared.mission.tasks.map((task: { taskId: string; status: string }) =>
    [task.taskId, task.status]), [
    ["reach_civic_ledger", "pending"],
    ["complete_registered_work", "pending"],
    ["return_with_record", "pending"],
  ]);

  const started = payload(await mcp.callTool("obsidian_epoch.start_journey", {
    journeyId: prepared.journey.journeyId,
    expectedVersion: prepared.journey.version,
    recoveryCode: ownerRecovery,
    idempotencyKey: "start-complete-mission",
  }));
  assert.equal(started.mission.status, "active");
  assert.deepEqual(started.mission.tasks.map((task: { status: string }) => task.status),
    ["completed", "active", "pending"]);
  assert.equal(started.mission.currentTaskId, "complete_registered_work");

  const proposed = payload(await mcp.callTool("obsidian_epoch.propose_journey_step", {
    journeyId: started.journey.journeyId,
    expectedVersion: started.journey.version,
    recoveryCode: ownerRecovery,
    idempotencyKey: "propose-complete-mission",
  }));
  assert.equal(proposed.mission.currentTaskId, "complete_registered_work");
  const selected = proposed.proposal.sceneContract.actionOptions.find((option: { optionKey: string }) =>
    option.optionKey === "verify_salt_ledger");
  assert.ok(selected);

  await mcp.callTool("obsidian_epoch.commit_journey_action", {
    journeyId: started.journey.journeyId,
    sceneId: proposed.proposal.sceneContract.sceneId,
    episodeId: proposed.proposal.episode.episodeId,
    expectedVersion: proposed.proposal.expectedVersion,
    actionOptionId: selected.actionOptionId,
    signature: selected.signature,
    recoveryCode: ownerRecovery,
    idempotencyKey: "commit-complete-mission",
  });
  advance("2026-07-12T00:45:00.000Z", "2026-01-01T09:30:00.000Z");

  const status = payload(await mcp.callTool("obsidian_epoch.journey_status", {
    journeyId: prepared.journey.journeyId,
    recoveryCode: ownerRecovery,
  }));
  assert.equal(status.journey.status, "settled");
  assert.equal(status.mission.status, "completed");
  assert.deepEqual(status.mission.tasks.map((task: { status: string }) => task.status),
    ["completed", "completed", "completed"]);
  assert.equal(status.mission.outcome.result, "success");
  assert.equal(status.mission.outcome.decisiveActionOptionKey, "verify_salt_ledger");
  assert.equal(status.storyReport.mission.status, "completed");
  assert.equal(status.storyReport.resolution.missionStatus, "completed");
  assert.equal(status.storyReport.profile.objective, "找稳定工作");
  assert.equal(status.storyReport.evaluation.taskCompletionGrade, "C");
  assert.match(status.storyReport.narrative, /任务完成度：C/);
  assert.doesNotMatch(status.storyReport.storyContent, /任务|目标|委托|成功条件|失败条件|结算|可追溯/);
  assert.deepEqual(status.finalVerification.page.payload.journey.mission, status.mission);
  assert.equal(status.finalVerification.page.payload.runSummary.runKind, "one_shot_journey");
  assert.equal(status.finalVerification.page.payload.runSummary.endingReason, "completed");
});

test("a real non-Gray-Harbor journey runs the quantum experiment route end to end", async () => {
  const { mcp, agentId, ownerRecovery, advance } = await fixture();
  const prepared = payload(await mcp.callTool("obsidian_epoch.prepare_journey", {
    agentId,
    destinationRegionId: "region_quantum_laboratory",
    mandate: { objective: "协助完成一次相位实验并带回实验记录", priorities: ["experiment", "safe_return"] },
    recoveryCode: ownerRecovery,
    idempotencyKey: "prepare-quantum-experiment",
  }));
  assert.equal(prepared.mission.title, "相位样本协助实验");
  assert.equal(prepared.mission.tasks[1].taskId, "complete_primary_task");

  const started = payload(await mcp.callTool("obsidian_epoch.start_journey", {
    journeyId: prepared.journey.journeyId,
    expectedVersion: prepared.journey.version,
    recoveryCode: ownerRecovery,
    idempotencyKey: "start-quantum-experiment",
  }));
  assert.equal(started.episodes[0].serverFacts.storyBeat.selectedAction.optionKey, "enter_destination");

  const proposed = payload(await mcp.callTool("obsidian_epoch.propose_journey_step", {
    journeyId: started.journey.journeyId,
    expectedVersion: started.journey.version,
    recoveryCode: ownerRecovery,
    idempotencyKey: "propose-quantum-experiment",
  }));
  assert.equal(proposed.proposal.sceneContract.location.label, "相位实验舱");
  assert.deepEqual(proposed.proposal.sceneContract.actionOptions.map((option: { optionKey: string }) => option.optionKey), [
    "assist_phase_experiment", "monitor_sample_seven", "withdraw_from_phase_test",
  ]);
  const selected = proposed.proposal.sceneContract.actionOptions.find((option: { optionKey: string }) =>
    option.optionKey === "assist_phase_experiment");
  assert.ok(selected);
  await mcp.callTool("obsidian_epoch.commit_journey_action", {
    journeyId: started.journey.journeyId,
    sceneId: proposed.proposal.sceneContract.sceneId,
    episodeId: proposed.proposal.episode.episodeId,
    expectedVersion: proposed.proposal.expectedVersion,
    actionOptionId: selected.actionOptionId,
    signature: selected.signature,
    recoveryCode: ownerRecovery,
    idempotencyKey: "commit-quantum-experiment",
  });
  advance("2026-07-12T00:45:00.000Z", "2026-01-01T09:30:00.000Z");

  const status = payload(await mcp.callTool("obsidian_epoch.journey_status", {
    journeyId: prepared.journey.journeyId,
    recoveryCode: ownerRecovery,
  }));
  assert.equal(status.mission.status, "completed");
  assert.equal(status.mission.outcome.decisiveActionOptionKey, "assist_phase_experiment");
  assert.match(status.storyReport.storyContent, /相位实验舱/);
  assert.match(status.storyReport.storyContent, /首席实验员林铎/);
  assert.match(status.storyReport.storyContent, /三组传感数据/);
  assert.match(status.storyReport.storyContent, /第七码样本测试记录/);
  assert.doesNotMatch(status.storyReport.storyContent, /灰港|民务账房|盐票账册/u);
  assert.equal(status.storyReport.evaluation.taskCompletionGrade, "C");
});

test("a settled Journey that misses the core task is reported as a failed run", async () => {
  const { mcp, agentId, ownerRecovery, advance } = await fixture();
  const prepared = payload(await mcp.callTool("obsidian_epoch.prepare_journey", {
    agentId,
    destinationRegionId: "灰港",
    mandate: { objective: "找稳定工作", priorities: ["work"] },
    recoveryCode: ownerRecovery,
    idempotencyKey: "prepare-failed-mission",
  }));
  const started = payload(await mcp.callTool("obsidian_epoch.start_journey", {
    journeyId: prepared.journey.journeyId,
    expectedVersion: prepared.journey.version,
    recoveryCode: ownerRecovery,
    idempotencyKey: "start-failed-mission",
  }));
  const proposed = payload(await mcp.callTool("obsidian_epoch.propose_journey_step", {
    journeyId: started.journey.journeyId,
    expectedVersion: started.journey.version,
    recoveryCode: ownerRecovery,
    idempotencyKey: "propose-failed-mission",
  }));
  const selected = proposed.proposal.sceneContract.actionOptions.find((option: { optionKey: string }) =>
    option.optionKey === "leave_without_commitment");
  assert.ok(selected);
  await mcp.callTool("obsidian_epoch.commit_journey_action", {
    journeyId: started.journey.journeyId,
    sceneId: proposed.proposal.sceneContract.sceneId,
    episodeId: proposed.proposal.episode.episodeId,
    expectedVersion: proposed.proposal.expectedVersion,
    actionOptionId: selected.actionOptionId,
    signature: selected.signature,
    recoveryCode: ownerRecovery,
    idempotencyKey: "commit-failed-mission",
  });
  advance("2026-07-12T00:45:00.000Z", "2026-01-01T09:30:00.000Z");

  const status = payload(await mcp.callTool("obsidian_epoch.journey_status", {
    journeyId: prepared.journey.journeyId,
    recoveryCode: ownerRecovery,
  }));
  assert.equal(status.journey.status, "settled");
  assert.equal(status.mission.status, "failed");
  assert.equal(status.mission.outcome.result, "failure");
  assert.deepEqual(status.mission.tasks.map((task: { status: string }) => task.status),
    ["completed", "failed", "completed"]);
  assert.equal(status.storyReport.resolution.missionStatus, "failed");
  assert.equal(status.storyReport.evaluation.taskCompletionGrade, "F");
  assert.match(status.storyReport.narrative, /任务完成度：F/);
  assert.equal(status.storyReport.evaluation.warning, undefined);
  assert.doesNotMatch(status.storyReport.storyContent, /任务|目标|委托|成功|失败|结算|可追溯/);
  assert.equal(status.finalVerification.page.payload.runSummary.runKind, "one_shot_journey");
  assert.equal(status.finalVerification.page.payload.runSummary.endingReason, "early_exit");
});

test("journey proposal and commit reject stale, forged, cross-scene, unauthorized, and expired inputs", async () => {
  const first = await preparedAgentNativeJourney("adversarial-a");
  const contract = first.proposed.proposal.sceneContract;
  const selected = contract.actionOptions[0];
  const replay = payload(await first.mcp.callTool("obsidian_epoch.propose_journey_step", {
    journeyId: first.started.journey.journeyId,
    expectedVersion: first.started.journey.version,
    recoveryCode: first.ownerRecovery,
    idempotencyKey: "propose-adversarial-a",
  }));
  assert.equal(replay.proposal.sceneContract.sceneId, contract.sceneId);
  assert.deepEqual(replay.proposal.sceneContract.actionOptions, contract.actionOptions);
  const alternateProposalKey = payload(await first.mcp.callTool("obsidian_epoch.propose_journey_step", {
    journeyId: first.started.journey.journeyId,
    expectedVersion: first.started.journey.version,
    recoveryCode: first.ownerRecovery,
    idempotencyKey: "propose-adversarial-a-second-key",
  }));
  assert.equal(alternateProposalKey.proposal.sceneContract.sceneId, contract.sceneId);

  await assert.rejects(() => first.mcp.callTool("obsidian_epoch.propose_journey_step", {
    journeyId: first.started.journey.journeyId,
    expectedVersion: first.started.journey.version - 1,
    recoveryCode: first.ownerRecovery,
    idempotencyKey: "propose-stale",
  }), /journey_version_conflict/);
  const baseCommit = {
    journeyId: first.started.journey.journeyId,
    sceneId: contract.sceneId,
    episodeId: contract.episodeId,
    expectedVersion: contract.expectedVersion,
    actionOptionId: selected.actionOptionId,
    signature: selected.signature,
    recoveryCode: first.ownerRecovery,
  };
  await assert.rejects(() => first.mcp.callTool("obsidian_epoch.commit_journey_action", {
    ...baseCommit,
    recoveryCode: "invalid-owner-credential",
    idempotencyKey: "commit-wrong-owner",
  }), /explorer_auth_invalid|recovery_code_invalid|explorer_auth_required/);
  await assert.rejects(() => first.mcp.callTool("obsidian_epoch.commit_journey_action", {
    ...baseCommit,
    actionOptionId: "action_not_issued",
    idempotencyKey: "commit-unknown-action",
  }), /journey_scene_action_not_found/);
  await assert.rejects(() => first.mcp.callTool("obsidian_epoch.commit_journey_action", {
    ...baseCommit,
    signature: `${selected.signature.slice(0, -2)}AA`,
    idempotencyKey: "commit-forged-signature",
  }), /journey_scene_action_signature_invalid/);

  const second = await preparedAgentNativeJourney("adversarial-b", "2026-07-12T00:01:00.000Z");
  await assert.rejects(() => second.mcp.callTool("obsidian_epoch.commit_journey_action", {
    journeyId: second.started.journey.journeyId,
    sceneId: second.proposed.proposal.sceneContract.sceneId,
    episodeId: second.proposed.proposal.episode.episodeId,
    expectedVersion: second.proposed.proposal.expectedVersion,
    actionOptionId: selected.actionOptionId,
    signature: selected.signature,
    recoveryCode: second.ownerRecovery,
    idempotencyKey: "commit-cross-scene",
  }), /journey_scene_action_not_found|journey_scene_action_signature_invalid/);

  first.advanceEpoch("2026-07-12T00:16:00.000Z");
  await assert.rejects(() => first.mcp.callTool("obsidian_epoch.commit_journey_action", {
    ...baseCommit,
    idempotencyKey: "commit-expired",
  }), /journey_scene_contract_expired/);
  const refreshed = payload(await first.mcp.callTool("obsidian_epoch.propose_journey_step", {
    journeyId: first.started.journey.journeyId,
    expectedVersion: first.started.journey.version,
    recoveryCode: first.ownerRecovery,
    idempotencyKey: "propose-after-expiry",
  }));
  assert.notEqual(refreshed.proposal.sceneContract.sceneId, contract.sceneId);
});

test("journey commit is idempotent and conflicting or concurrent choices settle at most once", async () => {
  const replayCase = await preparedAgentNativeJourney("commit-replay");
  const contract = replayCase.proposed.proposal.sceneContract;
  const selected = contract.actionOptions[0];
  const commitInput = {
    journeyId: replayCase.started.journey.journeyId,
    sceneId: contract.sceneId,
    episodeId: contract.episodeId,
    expectedVersion: contract.expectedVersion,
    actionOptionId: selected.actionOptionId,
    signature: selected.signature,
    recoveryCode: replayCase.ownerRecovery,
    idempotencyKey: "commit-replay",
  };
  const committed = payload(await replayCase.mcp.callTool("obsidian_epoch.commit_journey_action", commitInput));
  const replay = payload(await replayCase.mcp.callTool("obsidian_epoch.commit_journey_action", commitInput));
  assert.equal(replay.duplicate, true);
  assert.deepEqual(replay.journey.episodeIds, committed.journey.episodeIds);
  const alternate = contract.actionOptions[1];
  await assert.rejects(() => replayCase.mcp.callTool("obsidian_epoch.commit_journey_action", {
    ...commitInput,
    actionOptionId: alternate.actionOptionId,
    signature: alternate.signature,
  }), /idempotency_key_conflict/);

  const race = await preparedAgentNativeJourney("commit-race");
  const left = race.proposed.proposal.sceneContract.actionOptions[0];
  const right = race.proposed.proposal.sceneContract.actionOptions[1];
  const base = {
    journeyId: race.started.journey.journeyId,
    sceneId: race.proposed.proposal.sceneContract.sceneId,
    episodeId: race.proposed.proposal.episode.episodeId,
    expectedVersion: race.proposed.proposal.expectedVersion,
    recoveryCode: race.ownerRecovery,
  };
  const results = await Promise.allSettled([
    race.mcp.callTool("obsidian_epoch.commit_journey_action", {
      ...base,
      actionOptionId: left.actionOptionId,
      signature: left.signature,
      idempotencyKey: "commit-race-left",
    }),
    race.mcp.callTool("obsidian_epoch.commit_journey_action", {
      ...base,
      actionOptionId: right.actionOptionId,
      signature: right.signature,
      idempotencyKey: "commit-race-right",
    }),
  ]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  const status = payload(await race.mcp.callTool("obsidian_epoch.journey_status", {
    journeyId: race.started.journey.journeyId,
    recoveryCode: race.ownerRecovery,
  }));
  assert.deepEqual(status.episodes.map((episode: { phase: string }) => episode.phase),
    ["arrival", "main", "return"]);
});

test("a proposed signed scene survives epoch and journey event replay before commit", () => {
  const explorerId = "explorer_restart_proposal";
  const ownerRecovery = recoveryCode(explorerId, "restart-secret");
  const options = {
    epoch: {
      idFactory: createSequentialEpochIdFactory("restart_proposal"),
      clock: () => new Date("2026-07-12T00:00:00.000Z"),
    },
    journey: {
      now: () => "2026-07-12T00:00:00.000Z",
      worldNow: () => "2026-01-01T08:00:00.000Z",
    },
  };
  const runtime = createAgentWorldRuntime(options);
  const identity = runtime.epochIdentity({
    explorerId,
    recoveryCode: ownerRecovery,
    identityName: "重启提案校验者",
    idempotencyKey: "restart-identity",
  });
  if (!("value" in identity)) throw new Error("expected issued identity");
  const prepared = runtime.epochPrepareJourney({
    agentId: identity.value.agentId,
    destinationRegionId: "灰港",
    mandate: { objective: "找稳定工作", priorities: ["work"] },
    recoveryCode: ownerRecovery,
    idempotencyKey: "restart-prepare",
  });
  const started = runtime.epochStartJourneyAgentNative({
    journeyId: prepared.journey.journeyId,
    expectedVersion: prepared.journey.version,
    recoveryCode: ownerRecovery,
    idempotencyKey: "restart-start",
  });
  const proposalInput = {
    journeyId: started.journey.journeyId,
    expectedVersion: started.journey.version,
    recoveryCode: ownerRecovery,
    idempotencyKey: "restart-propose",
  };
  const proposed = runtime.epochProposeJourneyStep(proposalInput);
  const epochEvents = [identity, started, proposed].flatMap(epochEventsForPersistence);
  const journeyEvents = [prepared, started, proposed].flatMap(journeyEventsForPersistence);
  assert.doesNotMatch(JSON.stringify({ epochEvents, journeyEvents }), /restart-secret|recoveryCode|localSecret/);

  const restarted = createAgentWorldRuntime({ ...options, epochEvents, journeyEvents });
  const replayed = restarted.epochProposeJourneyStep(proposalInput);
  assert.equal(replayed.proposal.sceneContract?.sceneId, proposed.proposal.sceneContract?.sceneId);
  assert.deepEqual(replayed.proposal.sceneContract?.actionOptions, proposed.proposal.sceneContract?.actionOptions);
  const selected = replayed.proposal.sceneContract?.actionOptions[0];
  assert.ok(selected);
  const committed = restarted.epochCommitJourneyAction({
    journeyId: started.journey.journeyId,
    sceneId: replayed.proposal.sceneContract?.sceneId,
    episodeId: replayed.proposal.episode.episodeId,
    expectedVersion: replayed.proposal.expectedVersion,
    actionOptionId: selected.actionOptionId,
    signature: selected.signature,
    recoveryCode: ownerRecovery,
    idempotencyKey: "restart-commit",
  });
  assert.deepEqual(committed.journey.episodeIds.length, 3);
});

test("an archived identity keeps its grounded album inside the reincarnated lineage chronicle", async () => {
  const context = await preparedAgentNativeJourney("lineage-album");
  const selected = context.proposed.proposal.sceneContract.actionOptions[0];
  await context.mcp.callTool("obsidian_epoch.commit_journey_action", {
    journeyId: context.started.journey.journeyId,
    sceneId: context.proposed.proposal.sceneContract.sceneId,
    episodeId: context.proposed.proposal.episode.episodeId,
    expectedVersion: context.proposed.proposal.expectedVersion,
    actionOptionId: selected.actionOptionId,
    signature: selected.signature,
    recoveryCode: context.ownerRecovery,
    idempotencyKey: "lineage-album-commit",
  });
  context.advance("2026-07-12T00:45:00.000Z", "2026-01-01T09:30:00.000Z");
  const settled = payload(await context.mcp.callTool("obsidian_epoch.journey_status", {
    journeyId: context.started.journey.journeyId,
    recoveryCode: context.ownerRecovery,
  }));
  assert.equal(settled.journey.status, "settled");
  await context.mcp.callTool("obsidian_epoch.archive_identity", {
    agentId: context.agentId,
    recoveryCode: context.ownerRecovery,
    idempotencyKey: "lineage-album-archive",
  });
  const reincarnated = payload(await context.mcp.callTool("obsidian_epoch.reincarnate", {
    previousAgentId: context.agentId,
    recoveryCode: context.ownerRecovery,
    idempotencyKey: "lineage-album-reincarnate",
  }));
  assert.equal(reincarnated.value.generation, 2);

  const album = payload(await context.mcp.callTool("obsidian_epoch.journey_album", {
    agentId: context.agentId,
    recoveryCode: context.ownerRecovery,
    year: 1,
  }));
  assert.equal(album.currentYear, 1);
  assert.equal(album.annualChronicle.year, 1);
  assert.equal(album.postcards.length, 3);
  assert.equal(album.lineageChronicle.generations.length, 2);
  assert.equal(album.lineageChronicle.generations[0].agentId, context.agentId);
  assert.equal(album.lineageChronicle.generations[0].postcardIds.length, 3);
  assert.equal(album.lineageChronicle.generations[1].agentId, reincarnated.value.agentId);
  const transition = album.lineageChronicle.transitions[0];
  assert.equal(transition.fromAgentId, context.agentId);
  assert.equal(transition.toAgentId, reincarnated.value.agentId);
  assert.ok(transition.sourceEventIds.length >= 2);
});

test("start_journey performs nested Sampling and settles only a server-issued option", async () => {
  const { mcp, agentId, ownerRecovery, advance } = await fixture();
  const prepared = payload(await mcp.callTool("obsidian_epoch.prepare_journey", {
    agentId,
    destinationRegionId: "灰港",
    mandate: { objective: "找稳定工作", priorities: ["work"] },
    recoveryCode: ownerRecovery,
    idempotencyKey: "prepare-sampling",
  }));

  const session = createMcpSession({ sessionId: "companion_sampling", transport: "stdio" });
  session.acceptInitialize({
    protocolVersion: "2025-06-18",
    capabilities: { sampling: {} },
    clientInfo: { name: "test-host", version: "1" },
  });
  session.acceptInitializedNotification();
  const sent: Record<string, unknown>[] = [];
  const manager = createMcpServerRequestManager({
    send: (message) => { sent.push(message); },
    requestIdFactory: () => "server-sampling-journey",
  });
  const sampling = createMcpSamplingClient({ session, requestManager: manager });
  const responsePromise = handleMcpJsonRpcMessage(mcp, {
    jsonrpc: "2.0",
    id: 77,
    method: "tools/call",
    params: {
      name: "obsidian_epoch.start_journey",
      arguments: {
        journeyId: prepared.journey.journeyId,
        expectedVersion: prepared.journey.version,
        decisionMode: "host_sampling",
        recoveryCode: ownerRecovery,
        idempotencyKey: "start-sampling",
      },
    },
  }, { session, sampling });
  await new Promise<void>((resolve) => setImmediate(resolve));

  const request = JSON.parse(JSON.stringify(sent[0]));
  assert.equal(request.method, "sampling/createMessage");
  const prompt = JSON.parse(request.params.messages[0].content.text);
  assert.equal(prompt.scene.location.label, "灰港民务账房");
  assert.ok(prompt.scene.participants.some((participant: { label: string }) => participant.label === "夜班书记珂岚"));
  assert.ok(prompt.scene.confirmedFactIds.every((factId: string) => factId.startsWith("world:")));
  assert.equal(prompt.actionOptions.some((option: { label: string }) =>
    /观察区域势态|协助区域事务|接触低阶异常/u.test(option.label)), false);
  const selectedId = prompt.actionOptions[0].actionOptionId;
  manager.handleResponse({
    jsonrpc: "2.0",
    id: request.id,
    result: {
      role: "assistant",
      content: {
        type: "text",
        text: JSON.stringify({
          actionOptionId: selectedId,
          rationale: "低风险且符合委托",
          confidence: 0.9,
          userFacingMessage: "我先做这件稳妥的事。",
        }),
      },
      model: "host-model",
      stopReason: "endTurn",
    },
  });
  const response = await responsePromise;
  assert.ok(response && "result" in response);
  const result = payload(response.result as { readonly content: readonly { readonly text: string }[] });
  assert.equal(result.sampling.ok, true);
  assert.equal(result.sampling.trust, "untrusted_client");
  assert.equal(result.settledAction.actionOptionId, selectedId);
  assert.equal(result.proposal.episode.phase, "main");
  assert.equal(result.mainEpisode.phase, "main");
  assert.equal(result.returnEpisode.phase, "return");
  assert.equal(result.journey.status, "returning");
  const replay = payload(await mcp.callTool("obsidian_epoch.start_journey", {
    journeyId: prepared.journey.journeyId,
    expectedVersion: prepared.journey.version,
    decisionMode: "host_sampling",
    recoveryCode: ownerRecovery,
    idempotencyKey: "start-sampling",
  }));
  assert.equal(replay.sampling.fallback, "capability_absent");
  assert.deepEqual(replay.journey.episodeIds, result.journey.episodeIds);
  assert.equal(sent.length, 1);
  advance("2026-07-12T00:45:00.000Z", "2026-01-01T09:30:00.000Z");
  const settled = payload(await mcp.callTool("obsidian_epoch.journey_status", {
    journeyId: prepared.journey.journeyId,
    recoveryCode: ownerRecovery,
  }));
  assert.equal(settled.finalVerification.page.payload.journey.status, "settled");
  assert.deepEqual(settled.episodes.map((episode: { phase: string }) => episode.phase),
    ["arrival", "main", "return"]);
  assert.ok(settled.finalVerification.page.payload.journey.canonicalEventIds.length >= 3);
  assert.ok(settled.finalVerification.page.payload.journey.stateDelta.outcomeSummary);
  assert.equal(settled.finalVerification.page.expiresAt, undefined);
  manager.close();
});

test("invalid Sampling advice leaves the signed proposal open for Agent-native commit", async () => {
  const { mcp, agentId, ownerRecovery } = await fixture();
  const prepared = payload(await mcp.callTool("obsidian_epoch.prepare_journey", {
    agentId,
    destinationRegionId: "灰港",
    mandate: { objective: "找稳定工作", priorities: ["work"] },
    recoveryCode: ownerRecovery,
    idempotencyKey: "prepare-invalid-sampling",
  }));
  const session = createMcpSession({ sessionId: "invalid_sampling", transport: "stdio" });
  session.acceptInitialize({
    protocolVersion: "2025-06-18",
    capabilities: { sampling: {} },
    clientInfo: { name: "invalid-sampling-host", version: "1" },
  });
  session.acceptInitializedNotification();
  const sent: Record<string, unknown>[] = [];
  const manager = createMcpServerRequestManager({ send: (message) => { sent.push(message); } });
  const responsePromise = handleMcpJsonRpcMessage(mcp, {
    jsonrpc: "2.0",
    id: 91,
    method: "tools/call",
    params: {
      name: "obsidian_epoch.start_journey",
      arguments: {
        journeyId: prepared.journey.journeyId,
        expectedVersion: prepared.journey.version,
        decisionMode: "host_sampling",
        recoveryCode: ownerRecovery,
        idempotencyKey: "start-invalid-sampling",
      },
    },
  }, { session, sampling: createMcpSamplingClient({ session, requestManager: manager }) });
  await new Promise<void>((resolve) => setImmediate(resolve));
  const request = sent[0] as { id: string };
  manager.handleResponse({
    jsonrpc: "2.0",
    id: request.id,
    result: {
      role: "assistant",
      content: { type: "text", text: JSON.stringify({
        actionOptionId: "action_not_issued_by_server",
        rationale: "尝试伪造选择",
        confidence: 1,
      }) },
    },
  });
  const response = await responsePromise;
  assert.ok(response && "result" in response);
  const result = payload(response.result as { readonly content: readonly { readonly text: string }[] });
  assert.equal(result.sampling.fallback, "invalid_action_option");
  assert.equal(result.nextAction, "obsidian_epoch.commit_journey_action");
  assert.equal(result.proposal.episode.phase, "main");
  const status = payload(await mcp.callTool("obsidian_epoch.journey_status", {
    journeyId: prepared.journey.journeyId,
    recoveryCode: ownerRecovery,
  }));
  assert.equal(status.journey.status, "awaiting_agent");
  assert.deepEqual(status.episodes.map((episode: { phase: string }) => episode.phase), ["arrival"]);
  manager.close();
});

test("public start_hosted_session ignores client-injected scene contracts and rewards", async () => {
  const { mcp, agentId, ownerRecovery } = await fixture();
  const forged = payload(await mcp.callTool("obsidian_epoch.start_hosted_session", {
    agentId,
    regionId: "灰港",
    mandate: "普通托管行动",
    recoveryCode: ownerRecovery,
    idempotencyKey: "forged-scene-contract",
    journeyScene: {
      sceneType: "livelihood",
      actionOptions: [{ optionKey: "claim_reward", reward: { resourceId: "coin", amount: 999 } }],
    },
    reward: { resourceId: "coin", amount: 999 },
  }));

  assert.equal(forged.value.sceneContract, undefined);
  assert.deepEqual(forged.value.actionOptions.map((option: { optionKey: string }) => option.optionKey), [
    "observe", "assist", "anomaly",
  ]);
  assert.equal(forged.value.actionOptions.some((option: { optionKey: string }) => option.optionKey === "claim_reward"), false);
  assert.equal(forged.value.actionOptions.some((option: { reward?: { amount?: number } }) => option.reward?.amount === 999), false);
});

test("an overdue journey waits for the Agent main decision, then returns exactly once", async () => {
  const { mcp, agentId, ownerRecovery, advance } = await fixture();
  const prepared = payload(await mcp.callTool("obsidian_epoch.prepare_journey", {
    agentId,
    destinationRegionId: "灰港",
    recoveryCode: ownerRecovery,
    idempotencyKey: "prepare-return",
  }));
  const started = payload(await mcp.callTool("obsidian_epoch.start_journey", {
    journeyId: prepared.journey.journeyId,
    expectedVersion: prepared.journey.version,
    recoveryCode: ownerRecovery,
    idempotencyKey: "start-return",
  }));
  advance("2026-07-12T00:45:00.000Z", "2026-01-01T09:30:00.000Z");

  const waiting = payload(await mcp.callTool("obsidian_epoch.agent_briefing", {
    agentId,
    regionId: "灰港",
    recoveryCode: ownerRecovery,
  }));
  assert.equal(waiting.returnedJourneys.length, 0);
  assert.equal(waiting.currentJourney.status, "awaiting_agent");

  const proposed = payload(await mcp.callTool("obsidian_epoch.propose_journey_step", {
    journeyId: started.journey.journeyId,
    expectedVersion: waiting.currentJourney.version,
    recoveryCode: ownerRecovery,
    idempotencyKey: "propose-overdue-main",
  }));
  const selected = proposed.proposal.sceneContract.actionOptions[0];
  await mcp.callTool("obsidian_epoch.commit_journey_action", {
    journeyId: started.journey.journeyId,
    sceneId: proposed.proposal.sceneContract.sceneId,
    episodeId: proposed.proposal.episode.episodeId,
    expectedVersion: proposed.proposal.expectedVersion,
    actionOptionId: selected.actionOptionId,
    signature: selected.signature,
    recoveryCode: ownerRecovery,
    idempotencyKey: "commit-overdue-main",
  });

  const first = payload(await mcp.callTool("obsidian_epoch.agent_briefing", {
    agentId,
    regionId: "灰港",
    recoveryCode: ownerRecovery,
  }));
  assert.equal(first.returnedJourneys.length, 1);
  assert.equal(first.returnedJourneys[0].status, "settled");
  assert.equal(first.returnedJourneyVerifications.length, 1);
  const second = payload(await mcp.callTool("obsidian_epoch.agent_briefing", {
    agentId,
    regionId: "灰港",
    recoveryCode: ownerRecovery,
    acknowledgeReturnedJourneyIds: [first.returnedJourneys[0].journeyId],
  }));
  assert.equal(second.returnedJourneys.length, 0);
});

test("recall records a safe grounded main decision and return before settlement", async () => {
  const { mcp, agentId, ownerRecovery, advance } = await fixture();
  const prepared = payload(await mcp.callTool("obsidian_epoch.prepare_journey", {
    agentId,
    destinationRegionId: "灰港",
    recoveryCode: ownerRecovery,
    idempotencyKey: "prepare-recall-grounded",
  }));
  const started = payload(await mcp.callTool("obsidian_epoch.start_journey", {
    journeyId: prepared.journey.journeyId,
    expectedVersion: prepared.journey.version,
    recoveryCode: ownerRecovery,
    idempotencyKey: "start-recall-grounded",
  }));
  const recalled = payload(await mcp.callTool("obsidian_epoch.recall_journey", {
    journeyId: started.journey.journeyId,
    expectedVersion: started.journey.version,
    recoveryCode: ownerRecovery,
    idempotencyKey: "recall-grounded",
  }));
  assert.deepEqual(recalled.episodes.map((episode: { phase: string }) => episode.phase), ["arrival", "main", "return"]);
  assert.equal(recalled.mainEpisode.settlement.outcomeSummary.includes("安全离开"), true);
  assert.equal(recalled.returnEpisode.serverFacts.sourceEventIds.length > 0, true);
  assert.equal(recalled.journey.status, "returning");

  advance("2026-07-12T00:45:00.000Z", "2026-01-01T09:30:00.000Z");
  const status = payload(await mcp.callTool("obsidian_epoch.journey_status", {
    journeyId: started.journey.journeyId,
    recoveryCode: ownerRecovery,
  }));
  assert.equal(status.journey.status, "settled");
});

test("Journey idempotency keys are isolated between explorers", async () => {
  const mcp = createAgentWorldMcpRuntime({ epoch: { idFactory: createSequentialEpochIdFactory("journey_owner_scope") } });
  const issue = async (explorerId: string) => {
    const recovery = recoveryCode(explorerId, `secret-${explorerId}`);
    const identity = payload(await mcp.callTool("obsidian_epoch.identity", {
      explorerId,
      recoveryCode: recovery,
      idempotencyKey: `identity-${explorerId}`,
    }));
    return { recovery, agentId: identity.value.agentId as string };
  };
  const ownerA = await issue("explorer_scope_a");
  const ownerB = await issue("explorer_scope_b");
  const prepare = async (owner: { recovery: string; agentId: string }) => payload(await mcp.callTool(
    "obsidian_epoch.prepare_journey",
    {
      agentId: owner.agentId,
      destinationRegionId: "region_gray_harbor",
      recoveryCode: owner.recovery,
      idempotencyKey: "same-client-key",
    },
  ));
  const preparedA = await prepare(ownerA);
  const preparedB = await prepare(ownerB);
  assert.notEqual(preparedA.journey.journeyId, preparedB.journey.journeyId);
});

test("Agent A journey encounter appears in Agent B briefing without direct model contact", async () => {
  let realNow = "2026-07-12T00:00:00.000Z";
  let worldNow = "2026-01-01T08:00:00.000Z";
  let epochNow = "2026-07-12T00:00:00.000Z";
  const mcp = createAgentWorldMcpRuntime({
    epoch: {
      idFactory: createSequentialEpochIdFactory("two_agent_journey"),
      clock: () => new Date(epochNow),
    },
    journey: {
      now: () => realNow,
      worldNow: () => worldNow,
    },
  });
  const recoveryA = recoveryCode("explorer_two_agent_a", "local-secret-a");
  const recoveryB = recoveryCode("explorer_two_agent_b", "local-secret-b");
  const identityA = payload(await mcp.callTool("obsidian_epoch.identity", {
    explorerId: "explorer_two_agent_a",
    recoveryCode: recoveryA,
    identityName: "远行者 A",
    idempotencyKey: "identity-two-agent-a",
  }));
  const identityB = payload(await mcp.callTool("obsidian_epoch.identity", {
    explorerId: "explorer_two_agent_b",
    recoveryCode: recoveryB,
    identityName: "留守者 B",
    idempotencyKey: "identity-two-agent-b",
  }));
  await mcp.callTool("obsidian_epoch.set_downtime", {
    agentId: identityB.value.agentId,
    mode: "meditation",
    recoveryCode: recoveryB,
    idempotencyKey: "downtime-two-agent-b",
  });
  const prepared = payload(await mcp.callTool("obsidian_epoch.prepare_journey", {
    agentId: identityA.value.agentId,
    destinationRegionId: "region_gray_harbor",
    mandate: {
      objective: "拜访同住灰港的其他探索者",
      priorities: ["social", "agent"],
      preferredActivities: ["social", "visit"],
    },
    recoveryCode: recoveryA,
    idempotencyKey: "prepare-two-agent-a",
  }));
  const session = createMcpSession({ sessionId: "two_agent_sampling", transport: "stdio" });
  session.acceptInitialize({
    protocolVersion: "2025-06-18",
    capabilities: { sampling: {} },
    clientInfo: { name: "two-agent-test-host", version: "1" },
  });
  session.acceptInitializedNotification();
  const sent: Record<string, unknown>[] = [];
  const manager = createMcpServerRequestManager({ send: (message) => { sent.push(message); } });
  const responsePromise = handleMcpJsonRpcMessage(mcp, {
    jsonrpc: "2.0",
    id: 88,
    method: "tools/call",
    params: {
      name: "obsidian_epoch.start_journey",
      arguments: {
        journeyId: prepared.journey.journeyId,
        expectedVersion: prepared.journey.version,
        decisionMode: "host_sampling",
        recoveryCode: recoveryA,
        idempotencyKey: "start-two-agent-a",
      },
    },
  }, { session, sampling: createMcpSamplingClient({ session, requestManager: manager }) });
  await new Promise<void>((resolve) => setImmediate(resolve));
  const samplingRequest = sent[0] as { id: string; params: { messages: { content: { text: string } }[] } };
  const samplingPrompt = JSON.parse(samplingRequest.params.messages[0].content.text);
  manager.handleResponse({
    jsonrpc: "2.0",
    id: samplingRequest.id,
    result: {
      role: "assistant",
      content: { type: "text", text: JSON.stringify({
        actionOptionId: samplingPrompt.actionOptions[0].actionOptionId,
        rationale: "执行服务器签发的社交行动",
        confidence: 0.9,
      }) },
    },
  });
  const response = await responsePromise;
  assert.ok(response && "result" in response);
  const started = payload(response.result as { readonly content: readonly { readonly text: string }[] });
  assert.ok(started.scenePlan.episodes.some((episode: { fingerprint: { participantIds: string[] } }) =>
    episode.fingerprint.participantIds.includes(identityB.value.agentId)));
  realNow = "2026-07-12T00:45:00.000Z";
  worldNow = "2026-01-01T09:30:00.000Z";

  const briefingA = payload(await mcp.callTool("obsidian_epoch.agent_briefing", {
    agentId: identityA.value.agentId,
    recoveryCode: recoveryA,
    deferReturnDelivery: true,
  }));
  const storyReportA = briefingA.returnedJourneyReports[0].storyReport;
  assert.equal(storyReportA.evaluation.playerImpact.scope, "direct");
  assert.deepEqual(storyReportA.evaluation.playerImpact.affectedPlayers, ["留守者 B"]);
  assert.match(storyReportA.evaluation.playerImpact.summary, /交互收件箱/u);

  const briefingB = payload(await mcp.callTool("obsidian_epoch.agent_briefing", {
    agentId: identityB.value.agentId,
    regionId: "region_gray_harbor",
    recoveryCode: recoveryB,
  }));
  assert.equal(briefingB.interactionInboxTotal, 1);
  assert.equal(briefingB.interactionInbox[0].kind, "encounter");
  assert.equal(briefingB.interactionInbox[0].proposerAgentId, identityA.value.agentId);
  assert.match(briefingB.interactionInboxFeatured.whyRelevant, /真实旅程/);
  const shared = briefingB.interactionInbox[0].sharedEpisode;
  assert.ok(shared);
  assert.deepEqual(shared.sourceEventIds, started.mainEpisode.serverFacts.sourceEventIds);
  assert.equal(shared.narrative, started.mainEpisode.narrative.postcard.text);
  assert.match(shared.verificationUrl, /\/epoch\/result\/.+#episode-/);
  assert.ok(Date.parse(briefingB.interactionInbox[0].expiresAtWorldTime) > Date.parse(worldNow));
  assert.doesNotMatch(JSON.stringify(briefingB.interactionInbox), /local-secret|recoveryCode|signature|actionOptions/);

  const aEpisode = briefingA.recentEpisodes.find((episode: { episodeId: string }) => episode.episodeId === shared.episodeId);
  assert.ok(aEpisode);
  assert.deepEqual(aEpisode.serverFacts.sourceEventIds, shared.sourceEventIds);
  assert.equal(aEpisode.narrative.postcard.text, shared.narrative);

  const replayB = payload(await mcp.callTool("obsidian_epoch.agent_briefing", {
    agentId: identityB.value.agentId,
    recoveryCode: recoveryB,
  }));
  assert.equal(replayB.interactionInboxTotal, briefingB.interactionInboxTotal);
  assert.equal(replayB.interactionInbox[0].interactionId, briefingB.interactionInbox[0].interactionId);
  await mcp.callTool("obsidian_epoch.set_downtime", {
    agentId: identityA.value.agentId,
    mode: "meditation",
    recoveryCode: recoveryA,
    idempotencyKey: "two-agent-a-focus-downtime",
  });
  epochNow = "2026-07-12T00:10:00.000Z";
  await mcp.callTool("obsidian_epoch.claim_downtime", {
    agentId: identityA.value.agentId,
    recoveryCode: recoveryA,
    idempotencyKey: "two-agent-a-focus-claim",
  });
  await mcp.callTool("obsidian_epoch.propose_diplomacy", {
    regionId: "region_gray_harbor",
    sourceAgentId: identityA.value.agentId,
    targetAgentId: identityB.value.agentId,
    kind: "alliance",
    focusSpent: 1,
    terms: "share_gray_harbor_routes",
    recoveryCode: recoveryA,
    idempotencyKey: "two-agent-diplomacy-before-noise",
  });
  const withDiplomacy = payload(await mcp.callTool("obsidian_epoch.agent_briefing", {
    agentId: identityB.value.agentId,
    recoveryCode: recoveryB,
  }));
  const diplomacyInteraction = withDiplomacy.interactionInbox.find((entry: { kind: string }) => entry.kind === "commission");
  assert.ok(diplomacyInteraction);
  for (let index = 0; index < 250; index += 1) {
    mcp.runtime.epochRecordRejectedCommand({
      surface: "test",
      command: `unrelated-noise-${index}`,
      errorCode: "unrelated_noise",
      statusCode: 400,
      input: { redacted: true },
    });
  }
  const afterUnrelatedTraffic = payload(await mcp.callTool("obsidian_epoch.agent_briefing", {
    agentId: identityB.value.agentId,
    recoveryCode: recoveryB,
  }));
  assert.ok(afterUnrelatedTraffic.interactionInboxTotal >= 2);
  assert.ok(afterUnrelatedTraffic.interactionInbox.some((entry: { interactionId: string }) =>
    entry.interactionId === diplomacyInteraction.interactionId));
  const publicB = payload(await mcp.callTool("obsidian_epoch.agent_briefing", {
    agentId: identityB.value.agentId,
  }));
  assert.equal(publicB.interactionInboxTotal, 0);
  assert.deepEqual(publicB.interactionInboxSummaries, []);
  assert.deepEqual(publicB.interactionInbox, []);
  manager.close();
});

test("MCP briefing keeps the oldest evicted terminal closed across canonical replay and runtime restart", async () => {
  const createdAt = "2026-07-12T00:00:00.000Z";
  const worldNow = "2026-07-12T00:05:00.000Z";
  const base = createAgentWorldMcpRuntime({
    epoch: { clock: () => new Date(createdAt) },
    journey: { now: () => createdAt, worldNow: () => worldNow },
  });
  const explorerA = "explorer_terminal_e2e_a";
  const explorerB = "explorer_terminal_e2e_b";
  const recoveryA = recoveryCode(explorerA, "terminal-e2e-a-secret");
  const recoveryB = recoveryCode(explorerB, "terminal-e2e-b-secret");
  const identityA = payload(await base.callTool("obsidian_epoch.identity", {
    explorerId: explorerA,
    recoveryCode: recoveryA,
    identityName: "终局提案者",
    idempotencyKey: "terminal-e2e-identity-a",
  }));
  const identityB = payload(await base.callTool("obsidian_epoch.identity", {
    explorerId: explorerB,
    recoveryCode: recoveryB,
    identityName: "终局接收者",
    idempotencyKey: "terminal-e2e-identity-b",
  }));
  const sourceAgentId = identityA.value.agentId as string;
  const targetAgentId = identityB.value.agentId as string;
  const lifecycleEvents = Array.from({ length: 201 }, (_, index) => {
    const suffix = String(200 - index).padStart(3, "0");
    const diplomacyId = `diplomacy_terminal_e2e_${suffix}`;
    const commonPayload = {
      diplomacyId,
      regionId: "region_gray_harbor",
      sourceAgentId,
      sourceExplorerId: explorerA,
      targetAgentId,
      targetExplorerId: explorerB,
      kind: "alliance",
      focusSpent: 1,
      terms: `terminal_e2e_${suffix}`,
    };
    const proposal = {
      eventId: `epoch_terminal_e2e_proposal_${suffix}`,
      eventType: "diplomacy_proposed",
      aggregateType: "diplomacy",
      aggregateId: diplomacyId,
      actorExplorerId: explorerA,
      agentId: sourceAgentId,
      trustClass: "user_verified_web",
      causationId: `terminal_e2e_proposal_${suffix}`,
      correlationId: `terminal_e2e_${suffix}`,
      createdAt,
      payload: { ...commonPayload, status: "pending", proposedAt: createdAt },
    } as unknown as EpochEvent;
    const response = {
      ...proposal,
      eventId: `epoch_terminal_e2e_response_${suffix}`,
      eventType: "diplomacy_responded",
      actorExplorerId: explorerB,
      agentId: targetAgentId,
      causationId: proposal.eventId,
      payload: {
        ...commonPayload,
        status: "accepted",
        response: "accepted",
        respondedAt: createdAt,
      },
    } as unknown as EpochEvent;
    return [proposal, response] as const;
  }).flat();
  const baseEvents = base.runtime.epochEvents({ limit: 1_000 }).events as EpochEvent[];
  const recoveredEvents = [...baseEvents, ...lifecycleEvents];
  const evictedInteractionId = `interaction:${lifecycleEvents[0]!.aggregateId}:${targetAgentId}`;

  const briefingAfterRecovery = async () => {
    const restarted = createAgentWorldMcpRuntime({
      epochEvents: recoveredEvents,
      epoch: { clock: () => new Date(createdAt) },
      journey: { now: () => createdAt, worldNow: () => worldNow },
    });
    const first = payload(await restarted.callTool("obsidian_epoch.agent_briefing", {
      agentId: targetAgentId,
      recoveryCode: recoveryB,
    }));
    const incrementalReplay = payload(await restarted.callTool("obsidian_epoch.agent_briefing", {
      agentId: targetAgentId,
      recoveryCode: recoveryB,
    }));
    assert.equal(first.interactionInboxFeatured?.envelope?.status, "accepted");
    assert.equal(incrementalReplay.interactionInboxFeatured?.envelope?.status, "accepted");
    assert.notEqual(first.interactionInboxFeatured?.envelope?.interactionId, evictedInteractionId);
    assert.notEqual(incrementalReplay.interactionInboxFeatured?.envelope?.interactionId, evictedInteractionId);
    assert.equal(incrementalReplay.interactionInboxTotal, first.interactionInboxTotal);
    return first;
  };

  const firstRestart = await briefingAfterRecovery();
  const secondRestart = await briefingAfterRecovery();
  assert.equal(secondRestart.interactionInboxTotal, firstRestart.interactionInboxTotal);
  assert.equal(secondRestart.interactionInboxFeatured?.envelope?.status, "accepted");
  assert.notEqual(secondRestart.interactionInboxFeatured?.envelope?.interactionId, evictedInteractionId);
});
