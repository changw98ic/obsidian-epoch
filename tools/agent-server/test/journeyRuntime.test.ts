import assert from "node:assert/strict";
import test from "node:test";
import { createJourneyRuntime } from "../lib/epoch/journeyRuntime.ts";
import {
  buildPersistedJourneyNarrative,
  buildServerJourneyEpisodeFacts,
} from "../lib/epoch/journeyNarrativeRules.ts";
import type { JourneySceneEpisode } from "../lib/epoch/journeySceneRules.ts";
import type { EpochEvent } from "../lib/epoch/events.ts";
import {
  projectJourneyRuntimeEvents,
  type JourneyRuntimeEvent,
} from "../lib/epoch/journeyReadModel.ts";
import { hydrateAgentRuntimeOptions } from "../lib/store.ts";
import {
  buildFallbackJourneyTaskPlan,
  nextJourneyTaskObjective,
  type JourneyTaskPlanInstallation,
} from "../lib/epoch/journeyGeneratedTaskRules.ts";
import { normalizeJourneyMandate, type JourneyMandate } from "../lib/epoch/journeyPolicyRules.ts";
import type { PrepareJourneyRuntimeInput } from "../lib/epoch/journeyRuntime.ts";
import { deriveMirrorConsequenceEntryId } from "../lib/epoch/journeyMirrorLedger.ts";
import {
  JOURNEY_ACTION_RESOLUTION_RULE_VERSION,
  type JourneyActionResolution,
} from "../lib/epoch/journeyActionResolutionRules.ts";

function sequentialIds(prefix: string) {
  let value = 0;
  return (kind: "journey" | "event") => `${prefix}_${kind}_${++value}`;
}

const canonicalLedgers = new WeakMap<ReturnType<typeof createJourneyRuntime>, EpochEvent[]>();

function runtimeAt(
  real: string,
  world = real,
  initialEvents: readonly JourneyRuntimeEvent[] = [],
  canonicalEpochEvents?: readonly EpochEvent[],
  idPrefix = "test",
) {
  const ledger = [...(canonicalEpochEvents || [])];
  const runtime = createJourneyRuntime({
    idFactory: sequentialIds(idPrefix),
    nowReal: () => real,
    nowWorld: () => world,
    initialEvents,
    canonicalEpochEvents: () => ledger,
    defaultRealDurationMs: 30 * 60 * 1_000,
    defaultWorldDurationMs: 60 * 60 * 1_000,
    pollIntervalMs: 5 * 60 * 1_000,
  });
  canonicalLedgers.set(runtime, ledger);
  return runtime;
}

function canonicalEpochEventsFor(events: readonly JourneyRuntimeEvent[]): readonly EpochEvent[] {
  const projection = projectJourneyRuntimeEvents(events);
  return Object.values(projection.episodes).flatMap((episode) => {
    const journey = projection.journeys[episode.serverFacts?.journeyId || ""]?.journey;
    if (!journey) return [];
    return (episode.settlement?.canonicalEventIds || []).flatMap((eventId) => {
      const sessionId = `session_${episode.episodeId}`;
      const beat = episode.serverFacts?.storyBeat;
      if (!beat) return [];
      const actionOptionId = `action_${eventId}`;
      const selectedAction = beat.selectedAction;
      const common = {
        aggregateType: "hosted_session",
        aggregateId: sessionId,
        actorExplorerId: journey.explorerId,
        agentId: journey.agentId,
        trustClass: "user_verified_web",
        causationId: episode.episodeId,
        correlationId: journey.correlationId,
        createdAt: "2026-07-12T00:00:00.000Z",
      };
      return [{
        ...common,
        eventId: `started_${eventId}`,
        eventType: "hosted_session_started",
        payload: { sessionId, sceneContract: {
          journeyId: journey.journeyId,
          episodeId: episode.episodeId,
          actionOptions: [{
            actionOptionId,
            optionKey: beat.selectedAction.optionKey,
            label: beat.selectedAction.label,
            targetEntityIds: selectedAction.targetEntityIds ?? [],
            ...(selectedAction.taskObjectiveId ? { taskObjectiveId: selectedAction.taskObjectiveId } : {}),
          }],
        } },
      }, {
        ...common,
        eventId,
        eventType: "hosted_action_recorded",
        payload: {
          sessionId,
          actionOptionId,
          optionLabel: beat.selectedAction.label,
          outcomeSummary: beat.outcomeSummary,
          ...(selectedAction.resolution ? { journeyResolution: selectedAction.resolution } : {}),
        },
      }] as unknown as readonly EpochEvent[];
    });
  });
}

function prepareWithTaskPlan(
  runtime: ReturnType<typeof createJourneyRuntime>,
  input: PrepareJourneyRuntimeInput,
) {
  const prepared = runtime.prepare(input);
  const mandate = normalizeJourneyMandate(input.mandate) as JourneyMandate;
  const regionId = input.destinationRegionId;
  const locationId = regionId === "region_gray_harbor"
    ? "workplace_gray_harbor"
    : `${regionId}:test_location`;
  const installation: JourneyTaskPlanInstallation = buildFallbackJourneyTaskPlan({
    taskType: input.taskType ?? mandate.objective,
    scenarioMapId: regionId,
    availableWorldObjects: [
      {
        id: regionId,
        type: "region",
        label: regionId,
        regionId,
        sourceFactIds: [`world:region:${regionId}`],
      },
      {
        id: locationId,
        type: "workplace",
        label: `${regionId}现场`,
        regionId,
        sourceFactIds: [`world:workplace:${regionId}`],
      },
    ],
  });
  return runtime.installTaskPlan({
    journeyId: prepared.journey.journeyId,
    expectedVersion: prepared.journey.version,
    installation,
  });
}

test("mirror ledger promotion and discard retries are version-idempotent", () => {
  const runtime = runtimeAt("2026-07-12T00:00:00.000Z");
  const installed = prepareWithTaskPlan(runtime, {
    agentId: "agent_1",
    explorerId: "explorer_1",
    originRegionId: "region_gray_harbor",
    destinationRegionId: "region_gray_harbor",
    taskType: "镜像账本重放校验",
    mandate: { objective: "镜像账本重放校验" },
    policy: { presetId: "cautious" },
  });
  const journeyId = installed.journey.journeyId;
  const entry = {
    actionEventId: "action_mirror_1",
    effectKind: "trace_created" as const,
    targetEntityId: "trace:test",
    delta: 1,
    consequenceType: "collateral" as const,
    sourceEventIds: [],
    effectBlueprint: {},
    recordedAt: "2026-07-12T00:00:00.000Z",
    dedupeKey: "trace:test",
  };
  const recorded = runtime.recordMirrorConsequences({
    journeyId,
    expectedVersion: installed.journey.version,
    entries: [entry],
  });
  const entryId = deriveMirrorConsequenceEntryId({
    journeyId,
    actionEventId: entry.actionEventId,
    dedupeKey: entry.dedupeKey,
  });
  const promoted = runtime.promoteMirrorConsequences({
    journeyId,
    expectedVersion: recorded.journey.version,
    promotions: [{ entryId, canonicalEventId: "epoch_trace_1" }],
  });
  const promotionReplay = runtime.promoteMirrorConsequences({
    journeyId,
    expectedVersion: promoted.journey.version,
    promotions: [{ entryId, canonicalEventId: "epoch_trace_1" }],
  });
  assert.equal(promotionReplay.journey.version, promoted.journey.version);

  const discarded = runtime.discardMirrorConsequences({
    journeyId,
    expectedVersion: promotionReplay.journey.version,
  });
  const discardReplay = runtime.discardMirrorConsequences({
    journeyId,
    expectedVersion: discarded.journey.version,
  });
  assert.equal(discardReplay.journey.version, discarded.journey.version);
});

function groundedEpisode(
  runtime: ReturnType<typeof createJourneyRuntime>,
  journeyId: string,
  episode: JourneySceneEpisode,
) {
  const canonicalEventId = `epoch_${episode.phase}_${episode.episodeId}`;
  const actionOptionId = `action_${canonicalEventId}`;
  const objective = episode.generatedTaskObjective;
  const action = objective?.actions[0];
  const taskEpisode = Boolean(objective && (episode.phase === "main" || episode.phase === "side"));
  const optionKey = action?.optionKey ?? `test_${episode.phase || "main"}`;
  const optionLabel = action?.label ?? `完成${episode.title}`;
  const outcomeSummary = action?.outcomeSummary ?? `${episode.title}已由服务器确认。`;
  const targetEntityIds = action?.targetObjectIds.length
    ? action.targetObjectIds
    : episode.worldObjectRefs.map((ref) => ref.id);
  const resolution: JourneyActionResolution | undefined = taskEpisode ? {
    ruleVersion: JOURNEY_ACTION_RESOLUTION_RULE_VERSION,
    authority: "server",
    decisionKeyId: "test-key",
    inputHash: `sha256:${"0".repeat(64)}`,
    outcome: "success",
    completionKind: "complete",
    score: 80,
    difficulty: 50,
    margin: 30,
    factors: {
      baseCompetence: 80,
      identity: 0,
      attributes: 0,
      resources: 0,
      equipment: 0,
      sceneSupport: 0,
      journeyPreparation: 0,
      condition: 0,
      goalAlignment: 0,
      deterministicVariance: 0,
    },
    summary: outcomeSummary,
  } : undefined;
  const serverFacts = buildServerJourneyEpisodeFacts({
    journeyId,
    episodeId: episode.episodeId,
    phase: episode.phase || "main",
    title: episode.title,
    agent: { id: "agent_1", displayName: "旅人" },
    worldObjectRefs: episode.worldObjectRefs,
    action: {
      optionKey,
      optionLabel,
      targetEntityIds,
      outcomeSummary,
      ...(objective && taskEpisode ? { taskObjectiveId: objective.objectiveId } : {}),
      ...(taskEpisode ? { completionKind: "complete" as const, resolution } : {}),
    },
    canonicalEventIds: [canonicalEventId],
  });
  const journey = runtime.status(journeyId).journey;
  const ledger = canonicalLedgers.get(runtime);
  if (!ledger) throw new Error("canonical_ledger_not_found");
  const sessionId = `session_${canonicalEventId}`;
  ledger.push({
    eventId: `started_${canonicalEventId}`,
    eventType: "hosted_session_started",
    aggregateType: "hosted_session",
    aggregateId: sessionId,
    actorExplorerId: journey.explorerId,
    agentId: journey.agentId,
    trustClass: "user_verified_web",
    causationId: episode.episodeId,
    correlationId: journey.correlationId,
    createdAt: "2026-07-12T00:00:00.000Z",
    payload: { sessionId, sceneContract: {
      journeyId,
      episodeId: episode.episodeId,
      actionOptions: [{
        actionOptionId,
        optionKey,
        label: optionLabel,
        targetEntityIds,
        ...(objective && taskEpisode ? { taskObjectiveId: objective.objectiveId } : {}),
      }],
    } },
  } as unknown as EpochEvent, {
    eventId: canonicalEventId,
    eventType: "hosted_action_recorded",
    aggregateType: "hosted_session",
    aggregateId: sessionId,
    actorExplorerId: journey.explorerId,
    agentId: journey.agentId,
    trustClass: "user_verified_web",
    causationId: episode.episodeId,
    correlationId: journey.correlationId,
    createdAt: "2026-07-12T00:00:00.000Z",
    payload: {
      sessionId,
      actionOptionId,
      optionLabel,
      outcomeSummary,
      ...(resolution ? { journeyResolution: resolution } : {}),
    },
  } as unknown as EpochEvent);
  return {
    ...episode,
    sourceFactIds: [...new Set([...episode.sourceFactIds, canonicalEventId])],
    settlement: {
      canonicalEventIds: [canonicalEventId],
      outcomeSummary,
      ...(objective && taskEpisode ? {
        taskObjective: { objectiveId: objective.objectiveId, completionKind: "complete" as const },
      } : {}),
    },
    serverFacts,
    narrative: buildPersistedJourneyNarrative({ serverFacts }).value,
  };
}

function threePhasePlan(runtime: ReturnType<typeof createJourneyRuntime>, journeyId: string, version: number) {
  const journey = runtime.status(journeyId).journey;
  if (!journey.taskPlan) throw new Error("journey_task_plan_required");
  const regionId = journey.destinationRegionId;
  const objectIds = [...new Set([
    regionId,
    ...journey.taskPlan.objectives.flatMap((objective) => objective.worldObjectIds),
  ])];
  return runtime.composeThreePhaseEpisodes(journeyId, version, {
    identityHistory: {},
    region: {
      id: regionId,
      type: "region",
      label: regionId,
      sourceFactIds: [`world:region:${regionId}`],
    },
    season: "current",
    resources: {},
    unresolvedClues: [],
    availableWorldObjects: objectIds.filter((objectId) => objectId !== regionId).map((objectId) => ({
      id: objectId,
      type: "workplace",
      label: objectId,
      regionId,
      sourceFactIds: [`world:object:${objectId}`],
      tags: ["work"],
    })),
  });
}

function finishGroundedThreePhases(runtime: ReturnType<typeof createJourneyRuntime>, journeyId: string, version: number) {
  const plan = threePhasePlan(runtime, journeyId, version);
  const arrival = runtime.commitEpisodes(journeyId, version, [groundedEpisode(runtime, journeyId, plan.episodes[0])]);
  let current = runtime.awaitAgent(journeyId, arrival.journey.version);
  const taskPlan = current.journey.taskPlan;
  if (!taskPlan) throw new Error("journey_task_plan_required");
  for (;;) {
    const episodes = current.journey.episodeIds
      .map((episodeId) => runtime.projection().episodes[episodeId])
      .filter(Boolean);
    const next = nextJourneyTaskObjective(taskPlan, episodes);
    if (!next) break;
    const episode = plan.episodes.find((candidate) =>
      candidate.generatedTaskObjective?.objectiveId === next.objectiveId);
    if (!episode) throw new Error("journey_task_episode_missing");
    current = runtime.commitEpisodes(journeyId, current.journey.version, [groundedEpisode(runtime, journeyId, episode)]);
  }
  const returning = runtime.beginReturn(journeyId, current.journey.version);
  const returnEpisode = plan.episodes.find((episode) => episode.phase === "return");
  if (!returnEpisode) throw new Error("journey_return_episode_missing");
  return runtime.commitEpisodes(journeyId, returning.journey.version, [groundedEpisode(runtime, journeyId, returnEpisode)]);
}

function mutateLastRecordedEpisode(
  events: readonly JourneyRuntimeEvent[],
  mutate: (episode: JourneySceneEpisode) => JourneySceneEpisode,
): readonly JourneyRuntimeEvent[] {
  let lastRecordedIndex = -1;
  for (let index = events.length - 1; index >= 0; index -= 1) {
    if (events[index]?.eventType === "journey_episode_recorded") {
      lastRecordedIndex = index;
      break;
    }
  }
  assert.notEqual(lastRecordedIndex, -1);
  return events.map((event, index) => {
    if (index !== lastRecordedIndex || event.eventType !== "journey_episode_recorded" || !event.episode) return event;
    return { ...event, episode: mutate(event.episode) };
  });
}

test("prepare applies a safe preset and returns a human-readable zero-question preview", () => {
  const runtime = runtimeAt("2026-07-12T00:00:00.000Z");
  const prepared = runtime.prepare({
    agentId: "agent_1",
    explorerId: "explorer_1",
    originRegionId: "灰港",
    destinationRegionId: "灰港",
    mandate: { objective: "找稳定工作", avoid: ["异常"] },
    policy: { presetId: "cautious" },
  });

  assert.equal(prepared.journey.status, "prepared");
  assert.equal(prepared.journey.version, 1);
  assert.equal(prepared.policySelection.presetId, "cautious");
  assert.equal(prepared.policySelection.policy.maxAutomaticLifetimeLoss, 0);
  assert.match(prepared.preview.text, /计划：/);
  assert.match(prepared.preview.text, /预计返程：/);
  assert.equal(prepared.journey.synchronousQuestionCount, 0);
});

test("start freezes a server-randomized mirror window and tick settles exactly once after real due time", () => {
  const runtime = runtimeAt("2026-07-12T00:00:00.000Z", "2026-01-01T08:00:00.000Z");
  const prepared = prepareWithTaskPlan(runtime, {
    agentId: "agent_1",
    explorerId: "explorer_1",
    originRegionId: "region_a",
    destinationRegionId: "region_b",
  });
  const started = runtime.start({ journeyId: prepared.journey.journeyId, expectedVersion: prepared.journey.version });
  assert.equal(started.journey.status, "traveling");
  assert.equal(started.journey.worldMode, "mirror");
  assert.equal(started.journey.mirrorTimeRuleVersion, 2);
  assert.equal(started.journey.dueAtRealTime, "2026-07-12T00:30:00.000Z");
  const mirrorStart = Date.parse(started.journey.startedAtWorldTime || "");
  const mirrorEnd = Date.parse(started.journey.dueAtWorldTime || "");
  const canonicalStart = Date.parse("2026-01-01T08:00:00.000Z");
  const worldOrigin = Date.parse("2026-01-01T00:00:00.000Z");
  assert.ok(mirrorStart >= worldOrigin && mirrorStart < mirrorEnd);
  assert.ok(mirrorEnd <= canonicalStart);
  assert.equal((mirrorStart - worldOrigin) % (15 * 60 * 1_000), 0);
  assert.ok(mirrorEnd - mirrorStart >= 45 * 60 * 1_000);
  assert.ok(mirrorEnd - mirrorStart <= 12 * 60 * 60 * 1_000);
  assert.equal((mirrorEnd - mirrorStart) % (15 * 60 * 1_000), 0);
  assert.equal(started.journey.nextPollAt, "2026-07-12T00:05:00.000Z");
  assert.equal(started.journey.expectedReturnWorldTime, started.journey.dueAtWorldTime);
  finishGroundedThreePhases(runtime, started.journey.journeyId, started.journey.version);

  assert.deepEqual(runtime.tick({
    nowReal: "2026-07-12T00:29:59.000Z",
    nowWorld: "2026-01-01T08:59:59.000Z",
  }).events, []);
  const settled = runtime.tick({
    nowReal: "2026-07-12T00:30:00.000Z",
    nowWorld: "2026-01-01T09:00:00.000Z",
  });
  assert.equal(settled.events.length, 2);
  assert.deepEqual(settled.settledJourneyIds, [prepared.journey.journeyId]);
  assert.equal(runtime.status(prepared.journey.journeyId).journey.status, "settled");
  assert.equal(
    runtime.status(prepared.journey.journeyId).journey.settledAtWorldTime,
    started.journey.dueAtWorldTime,
  );
  assert.deepEqual(runtime.tick({
    nowReal: "2026-07-12T01:00:00.000Z",
    nowWorld: "2026-01-01T10:00:00.000Z",
  }).events, []);
});

test("an overdue awaiting_agent journey cannot leave its open main decision unresolved", () => {
  const runtime = runtimeAt("2026-07-12T00:00:00.000Z", "2026-01-01T08:00:00.000Z");
  const prepared = prepareWithTaskPlan(runtime, {
    agentId: "agent_waiting",
    explorerId: "explorer_waiting",
    originRegionId: "region_gray_harbor",
    destinationRegionId: "region_gray_harbor",
  });
  const started = runtime.start({ journeyId: prepared.journey.journeyId, expectedVersion: prepared.journey.version });
  const plan = threePhasePlan(runtime, started.journey.journeyId, started.journey.version);
  const arrived = runtime.commitEpisodes(started.journey.journeyId, started.journey.version, [
    groundedEpisode(runtime, started.journey.journeyId, plan.episodes[0]),
  ]);
  const waiting = runtime.awaitAgent(started.journey.journeyId, arrived.journey.version);

  const overdue = runtime.tick({
    nowReal: "2026-07-12T00:45:00.000Z",
    nowWorld: "2026-01-01T09:30:00.000Z",
  });
  assert.deepEqual(overdue.events, []);
  assert.equal(runtime.status(waiting.journey.journeyId).journey.status, "awaiting_agent");

  let current = waiting;
  const taskPlan = current.journey.taskPlan;
  if (!taskPlan) throw new Error("journey_task_plan_required");
  for (;;) {
    const episodes = current.journey.episodeIds
      .map((episodeId) => runtime.projection().episodes[episodeId])
      .filter(Boolean);
    const next = nextJourneyTaskObjective(taskPlan, episodes);
    if (!next) break;
    const episode = plan.episodes.find((candidate) =>
      candidate.generatedTaskObjective?.objectiveId === next.objectiveId);
    if (!episode) throw new Error("journey_task_episode_missing");
    current = runtime.commitEpisodes(current.journey.journeyId, current.journey.version, [
      groundedEpisode(runtime, current.journey.journeyId, episode),
    ]);
  }
  const returning = runtime.beginReturn(current.journey.journeyId, current.journey.version);
  const returnEpisode = plan.episodes.find((episode) => episode.phase === "return");
  if (!returnEpisode) throw new Error("journey_return_episode_missing");
  runtime.commitEpisodes(returning.journey.journeyId, returning.journey.version, [
    groundedEpisode(runtime, returning.journey.journeyId, returnEpisode),
  ]);
  assert.equal(runtime.tick({
    nowReal: "2026-07-12T00:45:00.000Z",
    nowWorld: "2026-01-01T09:30:00.000Z",
  }).settledJourneyIds.length, 1);
});

test("disconnect hydration catches up due journeys and delivers the return only once", () => {
  const online = runtimeAt("2026-07-12T00:00:00.000Z", "2026-01-01T08:00:00.000Z");
  const prepared = prepareWithTaskPlan(online, {
    agentId: "agent_1",
    explorerId: "explorer_1",
    originRegionId: "a",
    destinationRegionId: "b",
  });
  const started = online.start({ journeyId: prepared.journey.journeyId, expectedVersion: prepared.journey.version });
  finishGroundedThreePhases(online, started.journey.journeyId, started.journey.version);
  const persisted = online.projection().events;

  const reconnected = runtimeAt(
    "2026-07-12T00:45:00.000Z",
    "2026-01-01T09:30:00.000Z",
    persisted,
    canonicalEpochEventsFor(persisted),
    "reconnected",
  );
  const catchUp = reconnected.catchUp();
  assert.deepEqual(catchUp.settledJourneyIds, [prepared.journey.journeyId]);
  assert.equal(reconnected.claimReturnedJourneys("explorer_1").length, 1);
  assert.equal(reconnected.claimReturnedJourneys("explorer_1").length, 0);

  const acknowledgedEvents = reconnected.projection().events;
  const delivered = acknowledgedEvents.at(-1);
  assert.equal(delivered?.eventType, "journey_return_delivered");
  const hydrated = hydrateAgentRuntimeOptions({
    journeyEvents: acknowledgedEvents.slice(0, -1),
    commandEvents: [{
      type: "agent_command_commit",
      version: 1,
      command: "obsidian_epoch.agent_briefing",
      commandId: "ack-returned-journey-1",
      journeyEvents: delivered ? [delivered] : [],
      epochEvents: [],
      resultPages: [],
    }],
  });

  const restartedAgain = runtimeAt(
    "2026-07-12T01:00:00.000Z",
    "2026-01-01T10:00:00.000Z",
    hydrated.journeyEvents,
    canonicalEpochEventsFor(hydrated.journeyEvents),
    "restarted",
  );
  assert.equal(restartedAgain.claimReturnedJourneys("explorer_1").length, 0);
  assert.throws(() => runtimeAt(
    "2026-07-12T01:00:00.000Z",
    "2026-01-01T10:00:00.000Z",
    hydrated.journeyEvents,
    [],
  ), /journey_settlement_grounding_invalid/);
  const unrelated = canonicalEpochEventsFor(hydrated.journeyEvents).map((event, index) =>
    index === 0 ? { ...event, correlationId: "journey:unrelated" } as EpochEvent : event);
  assert.throws(() => runtimeAt(
    "2026-07-12T01:00:00.000Z",
    "2026-01-01T10:00:00.000Z",
    hydrated.journeyEvents,
    unrelated,
  ), /journey_settlement_grounding_invalid/);
});

test("settlement rejects restored episodes that only look grounded", () => {
  const online = runtimeAt("2026-07-12T00:00:00.000Z", "2026-01-01T08:00:00.000Z");
  const prepared = prepareWithTaskPlan(online, {
    agentId: "agent_probe",
    explorerId: "explorer_probe",
    originRegionId: "region_gray_harbor",
    destinationRegionId: "region_gray_harbor",
  });
  const started = online.start({ journeyId: prepared.journey.journeyId, expectedVersion: prepared.journey.version });
  finishGroundedThreePhases(online, started.journey.journeyId, started.journey.version);

  const probes: readonly {
    readonly name: string;
    readonly mutate: (episode: JourneySceneEpisode) => JourneySceneEpisode;
  }[] = [
    {
      name: "pseudo-empty server facts and narrative",
      mutate: (episode) => ({
        ...episode,
        serverFacts: { sourceEventIds: episode.settlement?.canonicalEventIds ?? [] },
        narrative: {},
      } as unknown as JourneySceneEpisode),
    },
    {
      name: "wrong journey id",
      mutate: (episode) => ({ ...episode, serverFacts: { ...episode.serverFacts!, journeyId: "journey_other" } }),
    },
    {
      name: "wrong episode id",
      mutate: (episode) => ({ ...episode, serverFacts: { ...episode.serverFacts!, episodeId: "episode_other" } }),
    },
    {
      name: "missing confirmed facts",
      mutate: (episode) => ({ ...episode, serverFacts: { ...episode.serverFacts!, confirmedFacts: [] } }),
    },
    {
      name: "missing state changes",
      mutate: (episode) => ({ ...episode, serverFacts: { ...episode.serverFacts!, stateChanges: [] } }),
    },
    {
      name: "missing fact provenance",
      mutate: (episode) => ({
        ...episode,
        serverFacts: {
          ...episode.serverFacts!,
          confirmedFacts: episode.serverFacts!.confirmedFacts.map((fact) => ({ ...fact, sourceEventIds: [] })),
        },
      }),
    },
    {
      name: "missing narrative provenance",
      mutate: (episode) => ({
        ...episode,
        narrative: { ...episode.narrative!, sourceEventIds: [] },
      } as JourneySceneEpisode),
    },
  ];

  for (const probe of probes) {
    const restored = runtimeAt(
      "2026-07-12T00:45:00.000Z",
      "2026-01-01T09:30:00.000Z",
      mutateLastRecordedEpisode(online.projection().events, probe.mutate),
    );
    assert.deepEqual(restored.catchUp().settledJourneyIds, [], probe.name);
    assert.equal(restored.status(prepared.journey.journeyId).journey.status, "returning", probe.name);
  }

  online.tick({
    nowReal: "2026-07-12T00:45:00.000Z",
    nowWorld: "2026-01-01T09:30:00.000Z",
  });
  assert.throws(() => runtimeAt(
    "2026-07-12T01:00:00.000Z",
    "2026-01-01T10:00:00.000Z",
    mutateLastRecordedEpisode(online.projection().events, probes[0]!.mutate),
  ), /journey_settlement_grounding_invalid/);
});

test("three-phase commit rejects an episode with a forged grounding envelope", () => {
  const runtime = runtimeAt("2026-07-12T00:00:00.000Z");
  const prepared = prepareWithTaskPlan(runtime, {
    agentId: "agent_commit_probe",
    explorerId: "explorer_commit_probe",
    originRegionId: "region_gray_harbor",
    destinationRegionId: "region_gray_harbor",
  });
  const started = runtime.start({ journeyId: prepared.journey.journeyId, expectedVersion: prepared.journey.version });
  const [arrival] = threePhasePlan(runtime, started.journey.journeyId, started.journey.version).episodes;
  const grounded = groundedEpisode(runtime, started.journey.journeyId, arrival);

  assert.throws(() => runtime.commitEpisodes(started.journey.journeyId, started.journey.version, [{
    ...grounded,
    serverFacts: { ...grounded.serverFacts, confirmedFacts: [] },
  }]), /journey_episode_grounding_invalid/);
});

test("live three-phase commit cannot bypass a missing canonical Epoch ledger", () => {
  const runtime = createJourneyRuntime({
    idFactory: sequentialIds("no_ledger"),
    nowReal: () => "2026-07-12T00:00:00.000Z",
    nowWorld: () => "2026-01-01T08:00:00.000Z",
  });
  const prepared = prepareWithTaskPlan(runtime, {
    agentId: "agent_no_ledger",
    explorerId: "explorer_no_ledger",
    originRegionId: "region_gray_harbor",
    destinationRegionId: "region_gray_harbor",
  });
  const started = runtime.start({ journeyId: prepared.journey.journeyId, expectedVersion: prepared.journey.version });
  const episode = threePhasePlan(runtime, started.journey.journeyId, started.journey.version).episodes[0];
  const canonicalEventId = "event_not_in_a_ledger";
  const serverFacts = buildServerJourneyEpisodeFacts({
    journeyId: started.journey.journeyId,
    episodeId: episode.episodeId,
    phase: "arrival",
    title: episode.title,
    agent: { id: started.journey.agentId },
    worldObjectRefs: episode.worldObjectRefs,
    action: { optionLabel: "伪造行动", outcomeSummary: "伪造结算" },
    canonicalEventIds: [canonicalEventId],
  });
  assert.throws(() => runtime.commitEpisodes(started.journey.journeyId, started.journey.version, [{
    ...episode,
    sourceFactIds: [...episode.sourceFactIds, canonicalEventId],
    settlement: { canonicalEventIds: [canonicalEventId], outcomeSummary: "伪造结算" },
    serverFacts,
    narrative: buildPersistedJourneyNarrative({ serverFacts }).value,
  }]), /journey_episode_grounding_invalid/);
});

test("recall preserves prior state and enters safe returning before settlement", () => {
  const runtime = runtimeAt("2026-07-12T00:00:00.000Z");
  const prepared = runtime.prepare({
    agentId: "agent_1",
    explorerId: "explorer_1",
    originRegionId: "a",
    destinationRegionId: "b",
  });
  const started = runtime.start({ journeyId: prepared.journey.journeyId, expectedVersion: 1 });
  const recalled = runtime.recall(started.journey.journeyId, 2);
  assert.equal(recalled.journey.status, "returning");
  assert.equal(recalled.journey.dueAtRealTime, started.journey.dueAtRealTime);
  assert.equal(runtime.tick({
    nowReal: "2026-07-12T00:01:00.000Z",
    nowWorld: "2026-07-12T00:01:00.000Z",
  }).settledJourneyIds.length, 0);
  assert.equal(runtime.status(recalled.journey.journeyId).journey.status, "returning");
});

test("runtime enforces one active journey per agent and event projections reject gaps", () => {
  const runtime = runtimeAt("2026-07-12T00:00:00.000Z");
  runtime.prepare({
    agentId: "agent_1",
    explorerId: "explorer_1",
    originRegionId: "a",
    destinationRegionId: "b",
  });
  assert.throws(() => runtime.prepare({
    agentId: "agent_1",
    explorerId: "explorer_1",
    originRegionId: "a",
    destinationRegionId: "c",
  }), /journey_active_conflict/);
  assert.equal(runtime.activeForAgent("agent_1")?.journey.status, "prepared");

  const [preparedEvent] = runtime.projection().events;
  if (!preparedEvent || preparedEvent.eventType === "journey_return_delivered") {
    throw new Error("expected_prepared_event");
  }
  assert.throws(() => projectJourneyRuntimeEvents([
    preparedEvent,
    {
      ...preparedEvent,
      eventId: "event_gap",
      eventType: "journey_status_changed",
      journey: { ...preparedEvent.journey, version: preparedEvent.journey.version + 2 },
    },
  ]), /journey_event_version_gap/);
});

test("runtime records one to three grounded scene episodes into the journey projection", () => {
  const runtime = runtimeAt("2026-07-12T00:00:00.000Z");
  const prepared = runtime.prepare({
    agentId: "agent_1",
    explorerId: "explorer_1",
    originRegionId: "gray_harbor",
    destinationRegionId: "gray_harbor",
    mandate: { objective: "找稳定工作", priorities: ["work"], preferredActivities: ["livelihood"] },
  });
  const started = runtime.start({ journeyId: prepared.journey.journeyId, expectedVersion: prepared.journey.version });
  const plan = runtime.composeEpisodes(started.journey.journeyId, started.journey.version, {
    identityHistory: {},
    region: {
      id: "gray_harbor",
      type: "region",
      label: "灰港",
      sourceFactIds: ["event_region"],
    },
    season: "雾季",
    resources: {},
    unresolvedClues: [],
    availableWorldObjects: [{
      id: "rope_workshop",
      type: "workplace",
      label: "盐绳工坊",
      regionId: "gray_harbor",
      sourceFactIds: ["event_workshop"],
      tags: ["work"],
    }],
    episodeCount: 3,
  });
  assert.ok(plan.episodes.length >= 1 && plan.episodes.length <= 3);
  runtime.commitEpisodes(started.journey.journeyId, started.journey.version, plan.episodes);
  const record = runtime.status(started.journey.journeyId);
  assert.deepEqual(record.journey.episodeIds, plan.episodes.map((episode) => episode.episodeId));
  assert.ok(record.journey.sourceEventIds.includes("event_workshop"));
  assert.deepEqual(Object.keys(runtime.projection().episodes), record.journey.episodeIds);
  assert.ok(plan.episodes.every((episode) => episode.worldObjectRefs.some((ref) => ref.id === "rope_workshop" || ref.id === "gray_harbor")));
});

test("three-phase episode commits cannot bypass arrival, main, or return order", () => {
  const runtime = runtimeAt("2026-07-12T00:00:00.000Z");
  const prepared = prepareWithTaskPlan(runtime, {
    agentId: "agent_phases",
    explorerId: "explorer_phases",
    originRegionId: "region_gray_harbor",
    destinationRegionId: "region_gray_harbor",
    mandate: { objective: "找稳定工作", priorities: ["work"] },
  });
  const started = runtime.start({ journeyId: prepared.journey.journeyId, expectedVersion: prepared.journey.version });
  const plan = runtime.composeThreePhaseEpisodes(started.journey.journeyId, started.journey.version, {
    identityHistory: {},
    region: {
      id: "region_gray_harbor",
      type: "region",
      label: "灰港",
      sourceFactIds: ["world:region:region_gray_harbor"],
    },
    season: "current",
    resources: {},
    unresolvedClues: [],
    availableWorldObjects: [{
      id: "workplace_gray_harbor",
      type: "workplace",
      label: "灰港账房",
      regionId: "region_gray_harbor",
      sourceFactIds: ["world:workplace:gray_harbor"],
      tags: ["work"],
    }],
  });

  assert.throws(() => runtime.commitEpisodes(started.journey.journeyId, started.journey.version, [plan.episodes[1]]),
    /journey_episode_phase_order_invalid/);
  const arrived = runtime.commitEpisodes(started.journey.journeyId, started.journey.version, [
    groundedEpisode(runtime, started.journey.journeyId, plan.episodes[0]),
  ]);
  const waiting = runtime.awaitAgent(arrived.journey.journeyId, arrived.journey.version);
  assert.throws(() => runtime.commitEpisodes(waiting.journey.journeyId, waiting.journey.version, [plan.episodes[2]]),
    /journey_episode_objective_order_invalid/);
  const main = runtime.commitEpisodes(waiting.journey.journeyId, waiting.journey.version, [
    groundedEpisode(runtime, waiting.journey.journeyId, plan.episodes[1]),
  ]);
  let current = main;
  const committedEpisodeIds = [plan.episodes[0].episodeId, plan.episodes[1].episodeId];
  const taskPlan = current.journey.taskPlan;
  if (!taskPlan) throw new Error("journey_task_plan_required");
  for (;;) {
    const episodes = current.journey.episodeIds
      .map((episodeId) => runtime.projection().episodes[episodeId])
      .filter(Boolean);
    const next = nextJourneyTaskObjective(taskPlan, episodes);
    if (!next) break;
    const episode = plan.episodes.find((candidate) =>
      candidate.generatedTaskObjective?.objectiveId === next.objectiveId);
    if (!episode) throw new Error("journey_task_episode_missing");
    current = runtime.commitEpisodes(current.journey.journeyId, current.journey.version, [
      groundedEpisode(runtime, current.journey.journeyId, episode),
    ]);
    committedEpisodeIds.push(episode.episodeId);
  }
  const returning = runtime.beginReturn(current.journey.journeyId, current.journey.version);
  const returnEpisode = plan.episodes.find((episode) => episode.phase === "return");
  if (!returnEpisode) throw new Error("journey_return_episode_missing");
  const completed = runtime.commitEpisodes(returning.journey.journeyId, returning.journey.version, [
    groundedEpisode(runtime, returning.journey.journeyId, returnEpisode),
  ]);
  committedEpisodeIds.push(returnEpisode.episodeId);
  assert.deepEqual(completed.journey.episodeIds, committedEpisodeIds);
});
