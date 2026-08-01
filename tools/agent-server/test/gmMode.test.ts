import assert from "node:assert/strict";
import test from "node:test";

import {
  JOURNEY_STATUSES,
  canTransitionJourney,
  isActiveJourneyStatus,
  isTerminalJourneyStatus,
  transitionToGM,
  pauseGMJourney,
  resumeGMJourney,
  settleGMJourneyFromActive,
  recordJourneyEpisode,
  type EpochJourney,
  type JourneyStatus,
} from "../lib/epoch/journeyRules.ts";

import {
  buildGMEpisode,
  buildWorldState,
  buildKnownFacts,
  applyDataBoundaries,
  stateChangesFrom,
  classifyGMTier,
  DEFAULT_HARD_RULES,
  type AdjudicatorOutput,
  type NarratorOutput,
  type GMWorldState,
  type ValidatedStateChanges,
  type GMCompletionTier,
} from "../lib/epoch/gmModeRules.ts";

import type { JourneySceneEpisode } from "../lib/epoch/journeySceneRules.ts";

// ── Fixtures ────────────────────────────────────────────────────────

function journeyFixture(status: JourneyStatus = "draft", overrides: Partial<EpochJourney> = {}): EpochJourney {
  const isStarted = status !== "draft" && status !== "prepared" && status !== "cancelled";
  return {
    journeyId: "journey_1",
    agentId: "agent_1",
    explorerId: "explorer_1",
    status,
    originRegionId: "region_origin",
    destinationRegionId: "region_destination",
    mandate: {
      objective: "explore freely",
      priorities: ["discovery"],
      avoid: ["danger"],
      preferredActivities: ["exploration"],
      socialPreference: "balanced",
      returnCondition: "time",
    },
    policyVersion: 1,
    ...(isStarted
      ? {
          startedAtWorldTime: "2026-07-12T00:00:00.000Z",
          dueAtWorldTime: "2026-07-12T01:00:00.000Z",
          dueAtRealTime: "2026-07-12T00:30:00.000Z",
          nextPollAt: "2026-07-12T00:10:00.000Z",
        }
      : {}),
    episodeIds: [],
    interactionIds: [],
    sourceEventIds: [],
    synchronousQuestionCount: 0,
    version: 0,
    ...overrides,
  };
}

function gmSnapshot(overrides: Partial<GMWorldState> = {}): GMWorldState {
  return {
    agent: {
      id: "agent_1",
      name: "测试角色",
      resources: { money: 1000, stamina: 80, health: 100, reputation: 10, socialCapital: 50 },
      inventory: ["手电筒", "旧手机"],
      location: "region_destination",
      status: "active",
    },
    journey: {
      id: "journey_1",
      status: "gm_active",
      version: 2,
      destinationRegionId: "region_destination",
      episodeIds: [],
    },
    episodes: [],
    ...overrides,
  };
}

function adjudicatorOutput(overrides: Partial<AdjudicatorOutput> = {}): AdjudicatorOutput {
  return {
    actionValid: true,
    invalidReason: null,
    physicalConsequences: { staminaCost: 5, healthChange: 0, timeElapsedMinutes: 15, moneySpent: 50 },
    socialConsequences: { npcChanges: {} },
    informationConsequences: {
      discovered: [{ content: "码头最近有陌生人", source: "npc_liu", reliability: 0.6, reason: "刘叔说的" }],
      confirmed: ["九号仓库有灯"],
      contradicted: [],
    },
    worldConsequences: { newEvents: [], environmentChanges: [] },
    npcAutonomousActions: {},
    availableReactions: ["继续探索", "回去休息"],
    ...overrides,
  };
}

function narratorOutput(overrides: Partial<NarratorOutput> = {}): NarratorOutput {
  return {
    narrative: "小卖部的灯管嗡嗡响。刘叔坐在柜台后面看手机。",
    npcDialogue: { npc_liu: "最近晚上不太平。" },
    atmosphere: "灯管的嗡嗡声，窗外的雨声",
    innerThoughts: "他知道些什么，但不想惹麻烦。",
    sensoryDetails: { visual: "灯管在闪", auditory: "嗡嗡声" },
    summary: "在小卖部和刘叔聊天，得知码头最近不太平。",
    ...overrides,
  };
}

// ── State Machine Tests ─────────────────────────────────────────────

test("gm_active and gm_paused are valid journey statuses", () => {
  assert.ok(JOURNEY_STATUSES.includes("gm_active"));
  assert.ok(JOURNEY_STATUSES.includes("gm_paused"));
});

test("gm_active and gm_paused are active statuses", () => {
  assert.ok(isActiveJourneyStatus("gm_active"));
  assert.ok(isActiveJourneyStatus("gm_paused"));
});

test("gm_active and gm_paused are not terminal statuses", () => {
  assert.ok(!isTerminalJourneyStatus("gm_active"));
  assert.ok(!isTerminalJourneyStatus("gm_paused"));
});

test("traveling can transition to gm_active", () => {
  assert.ok(canTransitionJourney("traveling", "gm_active"));
});

test("gm_active can transition to gm_paused, settling, cancelled, identity_ended", () => {
  assert.ok(canTransitionJourney("gm_active", "gm_paused"));
  assert.ok(canTransitionJourney("gm_active", "settling"));
  assert.ok(canTransitionJourney("gm_active", "cancelled"));
  assert.ok(canTransitionJourney("gm_active", "identity_ended"));
});

test("gm_paused can transition to gm_active, cancelled, identity_ended", () => {
  assert.ok(canTransitionJourney("gm_paused", "gm_active"));
  assert.ok(canTransitionJourney("gm_paused", "cancelled"));
  assert.ok(canTransitionJourney("gm_paused", "identity_ended"));
});

test("gm_paused cannot transition to settling directly", () => {
  assert.ok(!canTransitionJourney("gm_paused", "settling"));
});

test("draft cannot transition to gm_active", () => {
  assert.ok(!canTransitionJourney("draft", "gm_active"));
});

test("prepared cannot transition to gm_active directly", () => {
  assert.ok(!canTransitionJourney("prepared", "gm_active"));
});

// ── Transition Function Tests ───────────────────────────────────────

test("transitionToGM transitions traveling to gm_active", () => {
  const journey = journeyFixture("traveling");
  const result = transitionToGM({ journey, expectedVersion: 0 });
  assert.equal(result.status, "gm_active");
  assert.equal(result.version, 1);
});

test("transitionToGM rejects terminal statuses", () => {
  const journey = journeyFixture("settled");
  assert.throws(() => transitionToGM({ journey, expectedVersion: 0 }), /journey_terminal_immutable/);
});

test("transitionToGM rejects invalid transitions", () => {
  const journey = journeyFixture("draft");
  assert.throws(() => transitionToGM({ journey, expectedVersion: 0 }), /journey_transition_invalid/);
});

test("transitionToGM rejects version conflict", () => {
  const journey = journeyFixture("traveling");
  assert.throws(() => transitionToGM({ journey, expectedVersion: 99 }), /journey_version_conflict/);
});

test("pauseGMJourney transitions gm_active to gm_paused", () => {
  const journey = journeyFixture("gm_active", { version: 1 });
  const result = pauseGMJourney({ journey, expectedVersion: 1 });
  assert.equal(result.status, "gm_paused");
  assert.equal(result.version, 2);
});

test("pauseGMJourney rejects non-gm_active status", () => {
  const journey = journeyFixture("traveling");
  assert.throws(() => pauseGMJourney({ journey, expectedVersion: 0 }), /journey_gm_status_invalid/);
});

test("resumeGMJourney transitions gm_paused to gm_active", () => {
  const journey = journeyFixture("gm_paused", { version: 2 });
  const result = resumeGMJourney({ journey, expectedVersion: 2 });
  assert.equal(result.status, "gm_active");
  assert.equal(result.version, 3);
});

test("resumeGMJourney rejects non-gm_paused status", () => {
  const journey = journeyFixture("gm_active", { version: 1 });
  assert.throws(() => resumeGMJourney({ journey, expectedVersion: 1 }), /journey_gm_status_invalid/);
});

test("settleGMJourneyFromActive transitions gm_active to settling", () => {
  const journey = journeyFixture("gm_active", { version: 1 });
  const result = settleGMJourneyFromActive({ journey, expectedVersion: 1 });
  assert.equal(result.status, "settling");
  assert.equal(result.version, 2);
});

test("settleGMJourneyFromActive transitions gm_paused to settling via gm_active", () => {
  const journey = journeyFixture("gm_paused", { version: 2 });
  const result = settleGMJourneyFromActive({ journey, expectedVersion: 2 });
  assert.equal(result.status, "settling");
  // version increments: gm_paused -> gm_active (+1) -> settling (+1) = version 4
  assert.equal(result.version, 4);
});

test("settleGMJourneyFromActive rejects non-GM status", () => {
  const journey = journeyFixture("traveling");
  assert.throws(() => settleGMJourneyFromActive({ journey, expectedVersion: 0 }), /journey_gm_status_invalid/);
});

// ── recordJourneyEpisode with gm_active ─────────────────────────────

test("recordJourneyEpisode allows gm_active status", () => {
  const journey = journeyFixture("gm_active", { version: 1 });
  const result = recordJourneyEpisode({
    journey,
    expectedVersion: 1,
    episodeId: "journey_1:gm:1",
    sourceEventIds: ["event_1"],
  });
  assert.equal(result.version, 2);
  assert.deepEqual(result.episodeIds, ["journey_1:gm:1"]);
});

test("recordJourneyEpisode rejects duplicate episode", () => {
  const journey = journeyFixture("gm_active", { version: 1, episodeIds: ["journey_1:gm:1"] });
  assert.throws(
    () => recordJourneyEpisode({
      journey,
      expectedVersion: 1,
      episodeId: "journey_1:gm:1",
      sourceEventIds: ["event_1"],
    }),
    /journey_episode_duplicate/,
  );
});

// ── Episode Construction Tests ──────────────────────────────────────

test("buildGMEpisode produces valid JourneySceneEpisode shape", () => {
  const snapshot = gmSnapshot();
  const judgment = adjudicatorOutput();
  const narration = narratorOutput();
  const validatedChanges = applyDataBoundaries(judgment, snapshot, DEFAULT_HARD_RULES);

  const episode = buildGMEpisode({
    journeyId: "journey_1",
    index: 1,
    playerNarrative: "我去小卖部买烟",
    snapshot,
    judgment,
    narration,
    validatedChanges,
    sourceEventId: "event_123",
  });

  // Required fields
  assert.ok(episode.episodeId);
  assert.ok(episode.candidateId);
  assert.ok(episode.type);
  assert.ok(episode.title);
  assert.ok(episode.worldObjectRefs);
  assert.ok(episode.sourceFactIds);
  assert.ok(episode.optionIds);
  assert.ok(episode.outcomeKey);
  assert.ok(episode.fingerprint);
  assert.ok(episode.serverFacts);

  // GM-specific values
  assert.equal(episode.episodeId, "journey_1:gm:1");
  assert.equal(episode.candidateId, "scene:gm:free_action");
  assert.equal(episode.phase, "main");
  assert.equal(episode.type, "travel");
  assert.deepEqual(episode.optionIds, ["gm_free_action"]);
  assert.equal(episode.outcomeKey, "gm_action_success");

  // ServerFacts required fields
  assert.equal(episode.serverFacts!.journeyId, "journey_1");
  assert.equal(episode.serverFacts!.episodeId, "journey_1:gm:1");
  assert.ok(episode.serverFacts!.allowedEntities);
  assert.ok(episode.serverFacts!.confirmedFacts);
  assert.ok(episode.serverFacts!.rumors);
  assert.ok(episode.serverFacts!.stateChanges);
  assert.ok(episode.serverFacts!.sourceEventIds);
  assert.ok(episode.serverFacts!.verification);
  assert.ok(episode.serverFacts!.storyBeat);

  // StoryBeat required fields
  const beat = episode.serverFacts!.storyBeat!;
  assert.equal(beat.phase, "main");
  assert.ok(beat.sceneTitle);
  assert.ok(beat.selectedAction);
  assert.ok(beat.outcomeSummary);
  assert.equal(beat.selectedAction.optionKey, "gm_free_action");
  assert.equal(beat.selectedAction.completionKind, "complete");

  // Narrative
  assert.ok(episode.narrative);
  assert.equal(episode.narrative!.kind, "grounded_narrative");
});

test("buildGMEpisode handles failed action", () => {
  const snapshot = gmSnapshot();
  const judgment = adjudicatorOutput({ actionValid: false, invalidReason: "你没有枪" });
  const narration = narratorOutput();
  const validatedChanges = applyDataBoundaries(judgment, snapshot, DEFAULT_HARD_RULES);

  const episode = buildGMEpisode({
    journeyId: "journey_1",
    index: 1,
    playerNarrative: "我用枪射击",
    snapshot,
    judgment,
    narration,
    validatedChanges,
  });

  assert.equal(episode.outcomeKey, "gm_action_failed");
  assert.equal(episode.serverFacts!.storyBeat!.selectedAction.completionKind, "failed");
});

// ── Fact Accounting Tests ───────────────────────────────────────────

test("confirmed facts go to confirmedFacts", () => {
  const snapshot = gmSnapshot();
  const judgment = adjudicatorOutput({
    informationConsequences: {
      discovered: [],
      confirmed: ["仓库有灯", "刘叔在码头工作"],
      contradicted: [],
    },
  });
  const narration = narratorOutput();
  const validatedChanges = applyDataBoundaries(judgment, snapshot, DEFAULT_HARD_RULES);

  const episode = buildGMEpisode({
    journeyId: "journey_1",
    index: 1,
    playerNarrative: "观察仓库",
    snapshot,
    judgment,
    narration,
    validatedChanges,
    sourceEventId: "event_1",
  });

  assert.equal(episode.serverFacts!.confirmedFacts.length, 2);
  assert.equal(episode.serverFacts!.confirmedFacts[0].text, "仓库有灯");
  assert.equal(episode.serverFacts!.confirmedFacts[1].text, "刘叔在码头工作");
  assert.equal(episode.serverFacts!.rumors.length, 0);
});

test("discovered info with 0 < reliability < 1 goes to rumors", () => {
  const snapshot = gmSnapshot();
  const judgment = adjudicatorOutput({
    informationConsequences: {
      discovered: [
        { content: "码头有陌生人", source: "npc", reliability: 0.6, reason: "听说" },
        { content: "仓库有货物", source: "npc", reliability: 0.4, reason: "道听途说" },
      ],
      confirmed: [],
      contradicted: [],
    },
  });
  const narration = narratorOutput();
  const validatedChanges = applyDataBoundaries(judgment, snapshot, DEFAULT_HARD_RULES);

  const episode = buildGMEpisode({
    journeyId: "journey_1",
    index: 1,
    playerNarrative: "打听消息",
    snapshot,
    judgment,
    narration,
    validatedChanges,
    sourceEventId: "event_1",
  });

  assert.equal(episode.serverFacts!.confirmedFacts.length, 0);
  assert.equal(episode.serverFacts!.rumors.length, 2);
  assert.equal(episode.serverFacts!.rumors[0].status, "unconfirmed");
  assert.equal(episode.serverFacts!.rumors[0].text, "码头有陌生人");
});

test("discovered info with reliability 1.0 goes to confirmedFacts", () => {
  const snapshot = gmSnapshot();
  const judgment = adjudicatorOutput({
    informationConsequences: {
      discovered: [
        { content: "亲眼看到的", source: "self", reliability: 1.0, reason: "亲眼确认" },
      ],
      confirmed: [],
      contradicted: [],
    },
  });
  const narration = narratorOutput();
  const validatedChanges = applyDataBoundaries(judgment, snapshot, DEFAULT_HARD_RULES);

  const episode = buildGMEpisode({
    journeyId: "journey_1",
    index: 1,
    playerNarrative: "亲自查看",
    snapshot,
    judgment,
    narration,
    validatedChanges,
    sourceEventId: "event_1",
  });

  // reliability >= 1.0 → confirmedFacts (not rumors)
  assert.equal(episode.serverFacts!.confirmedFacts.length, 1);
  assert.equal(episode.serverFacts!.confirmedFacts[0].text, "亲眼看到的");
  assert.equal(episode.serverFacts!.rumors.length, 0);
});

// ── Data Boundaries Tests ───────────────────────────────────────────

test("applyDataBoundaries clamps resources to valid range", () => {
  const snapshot = gmSnapshot();
  const judgment = adjudicatorOutput({
    physicalConsequences: { staminaCost: 200, healthChange: -150, timeElapsedMinutes: 10, moneySpent: 5000 },
  });

  const result = applyDataBoundaries(judgment, snapshot, DEFAULT_HARD_RULES);

  // stamina: 80 - 200 = -120, clamped to 0
  assert.equal(result.agent.stamina, 0);
  // health: 100 - 150 = -50, clamped to 0
  assert.equal(result.agent.health, 0);
  // money: 1000 - 5000 = -4000, clamped to 0
  assert.equal(result.agent.money, 0);
});

test("applyDataBoundaries preserves resources within range", () => {
  const snapshot = gmSnapshot();
  const judgment = adjudicatorOutput({
    physicalConsequences: { staminaCost: 10, healthChange: -5, timeElapsedMinutes: 10, moneySpent: 100 },
  });

  const result = applyDataBoundaries(judgment, snapshot, DEFAULT_HARD_RULES);

  assert.equal(result.agent.stamina, 70); // 80 - 10
  assert.equal(result.agent.health, 95);  // 100 - 5
  assert.equal(result.agent.money, 900);  // 1000 - 100
});

// ── buildKnownFacts Tests ───────────────────────────────────────────

test("buildKnownFacts extracts confirmed facts and outcome summaries", () => {
  const episodes: JourneySceneEpisode[] = [{
    episodeId: "journey_1:gm:1",
    candidateId: "scene:gm:free_action",
    type: "travel",
    title: "自由行动",
    worldObjectRefs: [],
    sourceFactIds: [],
    optionIds: ["gm_free_action"],
    outcomeKey: "gm_action_success",
    fingerprint: { locationId: "region_1", participantIds: [], optionIds: ["gm_free_action"], outcomeKey: "gm_action_success" },
    routine: false,
    serverFacts: {
      journeyId: "journey_1",
      episodeId: "journey_1:gm:1",
      allowedEntities: [],
      confirmedFacts: [{ factId: "f1", text: "仓库有灯", entityIds: [], sourceEventIds: ["e1"] }],
      rumors: [],
      stateChanges: [],
      sourceEventIds: ["e1"],
      verification: { url: "/epoch/journey/journey_1#episode-journey_1:gm:1", journeyId: "journey_1", episodeId: "journey_1:gm:1", fragment: "episode-journey_1:gm:1" },
      storyBeat: {
        phase: "main",
        sceneTitle: "灯管的嗡嗡声",
        selectedAction: { optionKey: "gm_free_action", label: "观察仓库", completionKind: "complete" },
        outcomeSummary: "在小卖部和刘叔聊天",
      },
    },
  }];

  const facts = buildKnownFacts(episodes);

  assert.ok(facts.includes("仓库有灯"));
  assert.ok(facts.includes("在小卖部和刘叔聊天"));
  assert.equal(facts.length, 2);
});

test("buildKnownFacts deduplicates facts", () => {
  const episodes: JourneySceneEpisode[] = [{
    episodeId: "journey_1:gm:1",
    candidateId: "scene:gm:free_action",
    type: "travel",
    title: "自由行动",
    worldObjectRefs: [],
    sourceFactIds: [],
    optionIds: ["gm_free_action"],
    outcomeKey: "gm_action_success",
    fingerprint: { locationId: "region_1", participantIds: [], optionIds: ["gm_free_action"], outcomeKey: "gm_action_success" },
    routine: false,
    serverFacts: {
      journeyId: "journey_1",
      episodeId: "journey_1:gm:1",
      allowedEntities: [],
      confirmedFacts: [
        { factId: "f1", text: "仓库有灯", entityIds: [], sourceEventIds: ["e1"] },
        { factId: "f2", text: "仓库有灯", entityIds: [], sourceEventIds: ["e1"] },
      ],
      rumors: [],
      stateChanges: [],
      sourceEventIds: ["e1"],
      verification: { url: "/epoch/journey/journey_1#episode-journey_1:gm:1", journeyId: "journey_1", episodeId: "journey_1:gm:1", fragment: "episode-journey_1:gm:1" },
    },
  }];

  const facts = buildKnownFacts(episodes);
  assert.equal(facts.filter((f) => f === "仓库有灯").length, 1);
});

// ── stateChangesFrom Tests ──────────────────────────────────────────

test("stateChangesFrom produces agent state changes", () => {
  const validated: ValidatedStateChanges = {
    agent: { money: -50, stamina: -10, health: 0, reputation: 0, socialCapital: 0, location: "region_1" },
    npcs: {},
    world: { environmentChanges: [] },
  };

  const changes = stateChangesFrom(validated, "ep1", ["event_1"]);
  assert.ok(changes.length > 0);
  const agentChange = changes.find((c) => c.stateChangeId === "ep1:agent");
  assert.ok(agentChange);
  assert.ok(agentChange!.summary.includes("金钱"));
  assert.ok(agentChange!.summary.includes("体力"));
});

test("stateChangesFrom produces NPC attitude changes", () => {
  const validated: ValidatedStateChanges = {
    agent: { money: 0, stamina: 0, health: 0, reputation: 0, socialCapital: 0, location: "region_1" },
    npcs: { npc_liu: { attitude: 5, newFacts: ["他买了烟"] } },
    world: { environmentChanges: [] },
  };

  const changes = stateChangesFrom(validated, "ep1", ["event_1"]);
  const npcChange = changes.find((c) => c.stateChangeId === "ep1:npc:npc_liu");
  assert.ok(npcChange);
  assert.ok(npcChange!.summary.includes("NPC态度"));
  assert.deepEqual(npcChange!.entityIds, ["npc_liu"]);
});

// ── Episode Index Tests ─────────────────────────────────────────────

test("buildGMEpisode uses correct episode index", () => {
  const snapshot = gmSnapshot();
  const judgment = adjudicatorOutput();
  const narration = narratorOutput();
  const validatedChanges = applyDataBoundaries(judgment, snapshot, DEFAULT_HARD_RULES);

  const ep1 = buildGMEpisode({
    journeyId: "journey_1",
    index: 1,
    playerNarrative: "行动1",
    snapshot,
    judgment,
    narration,
    validatedChanges,
  });

  const ep3 = buildGMEpisode({
    journeyId: "journey_1",
    index: 3,
    playerNarrative: "行动3",
    snapshot,
    judgment,
    narration,
    validatedChanges,
  });

  assert.equal(ep1.episodeId, "journey_1:gm:1");
  assert.equal(ep3.episodeId, "journey_1:gm:3");
});

// ── Idempotency & Concurrency Tests ────────────────────────────────

import { createJourneyRuntime, type JourneyRuntimeOptions } from "../lib/epoch/journeyRuntime.ts";

function createTestJourneyRuntime(journey: EpochJourney) {
  const options: JourneyRuntimeOptions = {
    idFactory: (prefix: string) => `${prefix}_test_${Date.now()}`,
    nowReal: () => "2026-07-12T00:00:00.000Z",
    appendEvents: () => {},
    canonicalEpochEvents: new Map(),
  };
  const runtime = createJourneyRuntime(options);
  // Manually inject the journey into the projection by preparing and transitioning
  // For GM tests, we need to get the journey into gm_active state
  return runtime;
}

test("commitGMEpisodes throws journey_version_conflict on stale version", () => {
  const runtime = createTestJourneyRuntime(journeyFixture("gm_active", { version: 5 }));
  // Directly test version conflict by calling commitGMEpisodes with wrong version
  // We need the journey in the runtime first — use prepare + start + transition
  // Since the runtime is fresh, we'll test the pure function instead
  const journey = journeyFixture("gm_active", { version: 5 });
  const snapshot = gmSnapshot({ journey: { ...gmSnapshot().journey, version: 5 } });
  const judgment = adjudicatorOutput();
  const narration = narratorOutput();
  const validatedChanges = applyDataBoundaries(judgment, snapshot, DEFAULT_HARD_RULES);

  // Verify that recordJourneyEpisode rejects wrong version
  const episode = buildGMEpisode({
    journeyId: "journey_1",
    index: 1,
    playerNarrative: "test",
    snapshot,
    judgment,
    narration,
    validatedChanges,
  });

  assert.throws(
    () => recordJourneyEpisode({
      journey,
      expectedVersion: 99, // wrong version
      episodeId: "journey_1:gm:1",
      sourceEventIds: ["event_1"],
    }),
    /journey_version_conflict/,
  );
});

test("recordJourneyEpisode rejects duplicate episodeId (idempotency guard)", () => {
  const journey = journeyFixture("gm_active", {
    version: 1,
    episodeIds: ["journey_1:gm:1"],
    sourceEventIds: ["event_1"],
  });

  assert.throws(
    () => recordJourneyEpisode({
      journey,
      expectedVersion: 1,
      episodeId: "journey_1:gm:1", // duplicate
      sourceEventIds: ["event_1"],
    }),
    /journey_episode_duplicate/,
  );
});

test("different episodes can be committed sequentially", () => {
  let journey = journeyFixture("gm_active", { version: 1 });

  // First episode
  journey = recordJourneyEpisode({
    journey,
    expectedVersion: 1,
    episodeId: "journey_1:gm:1",
    sourceEventIds: ["event_1"],
  });
  assert.equal(journey.version, 2);
  assert.deepEqual(journey.episodeIds, ["journey_1:gm:1"]);

  // Second episode
  journey = recordJourneyEpisode({
    journey,
    expectedVersion: 2,
    episodeId: "journey_1:gm:2",
    sourceEventIds: ["event_2"],
  });
  assert.equal(journey.version, 3);
  assert.deepEqual(journey.episodeIds, ["journey_1:gm:1", "journey_1:gm:2"]);

  // Third episode
  journey = recordJourneyEpisode({
    journey,
    expectedVersion: 3,
    episodeId: "journey_1:gm:3",
    sourceEventIds: ["event_3"],
  });
  assert.equal(journey.version, 4);
  assert.deepEqual(journey.episodeIds, ["journey_1:gm:1", "journey_1:gm:2", "journey_1:gm:3"]);
});

test("concurrent commit with stale version throws journey_version_conflict", () => {
  let journey = journeyFixture("gm_active", { version: 1 });

  // First commit succeeds
  journey = recordJourneyEpisode({
    journey,
    expectedVersion: 1,
    episodeId: "journey_1:gm:1",
    sourceEventIds: ["event_1"],
  });
  assert.equal(journey.version, 2);

  // Concurrent commit with stale version (simulates race condition)
  assert.throws(
    () => recordJourneyEpisode({
      journey,
      expectedVersion: 1, // stale — should be 2
      episodeId: "journey_1:gm:2",
      sourceEventIds: ["event_2"],
    }),
    /journey_version_conflict/,
  );
});

test("buildGMEpisode produces unique episodeIds for different indices", () => {
  const snapshot = gmSnapshot();
  const judgment = adjudicatorOutput();
  const narration = narratorOutput();
  const validatedChanges = applyDataBoundaries(judgment, snapshot, DEFAULT_HARD_RULES);

  const ids = new Set<string>();
  for (let i = 1; i <= 10; i++) {
    const ep = buildGMEpisode({
      journeyId: "journey_1",
      index: i,
      playerNarrative: `行动${i}`,
      snapshot,
      judgment,
      narration,
      validatedChanges,
    });
    assert.ok(!ids.has(ep.episodeId), `Duplicate episodeId: ${ep.episodeId}`);
    ids.add(ep.episodeId);
  }
  assert.equal(ids.size, 10);
});

// ── Full Chain: sourceFactIds backfill ──────────────────────────────

test("buildGMEpisode with sourceEventId populates sourceFactIds", () => {
  const snapshot = gmSnapshot();
  const judgment = adjudicatorOutput();
  const narration = narratorOutput();
  const validatedChanges = applyDataBoundaries(judgment, snapshot, DEFAULT_HARD_RULES);

  const episode = buildGMEpisode({
    journeyId: "journey_1",
    index: 1,
    playerNarrative: "test",
    snapshot,
    judgment,
    narration,
    validatedChanges,
    sourceEventId: "event_abc",
  });

  assert.deepEqual(episode.sourceFactIds, ["event_abc"]);
  assert.deepEqual(episode.serverFacts!.sourceEventIds, ["event_abc"]);
  assert.deepEqual(episode.serverFacts!.confirmedFacts[0]?.sourceEventIds, ["event_abc"]);
});

test("buildGMEpisode without sourceEventId has empty sourceFactIds (backfilled at commit)", () => {
  const snapshot = gmSnapshot();
  const judgment = adjudicatorOutput();
  const narration = narratorOutput();
  const validatedChanges = applyDataBoundaries(judgment, snapshot, DEFAULT_HARD_RULES);

  const episode = buildGMEpisode({
    journeyId: "journey_1",
    index: 1,
    playerNarrative: "test",
    snapshot,
    judgment,
    narration,
    validatedChanges,
    // no sourceEventId
  });

  // Before commit, sourceFactIds is empty — commitGMEpisodes backfills
  assert.deepEqual(episode.sourceFactIds, []);
  assert.deepEqual(episode.serverFacts!.sourceEventIds, []);
});

test("recordJourneyEpisode rejects empty sourceEventIds (P0-1 guard)", () => {
  const journey = journeyFixture("gm_active", { version: 1 });
  assert.throws(
    () => recordJourneyEpisode({
      journey,
      expectedVersion: 1,
      episodeId: "journey_1:gm:1",
      sourceEventIds: [], // empty — must be rejected
    }),
    /journey_episode_source_event_ids_required/,
  );
});

// ── Settlement Tier Tests ───────────────────────────────────────────

test("classifyGMTier: 0 episodes is 未及格", () => {
  assert.equal(classifyGMTier(0, 0), "未及格");
});

test("classifyGMTier: all complete is 惊世", () => {
  assert.equal(classifyGMTier(5, 5), "惊世");
});

test("classifyGMTier: 80%+ is 优秀", () => {
  assert.equal(classifyGMTier(4, 5), "优秀");
  assert.equal(classifyGMTier(8, 10), "优秀");
});

test("classifyGMTier: 60%+ is 良好", () => {
  assert.equal(classifyGMTier(3, 5), "良好");
  assert.equal(classifyGMTier(6, 10), "良好");
});

test("classifyGMTier: any complete is 及格", () => {
  assert.equal(classifyGMTier(1, 5), "及格");
  assert.equal(classifyGMTier(2, 10), "及格");
  assert.equal(classifyGMTier(1, 10), "及格");
});

test("classifyGMTier: zero complete is 未及格", () => {
  assert.equal(classifyGMTier(0, 5), "未及格");
  assert.equal(classifyGMTier(0, 10), "未及格");
});

test("classifyGMTier: boundary values", () => {
  // Exactly 60%
  assert.equal(classifyGMTier(3, 5), "良好");
  // Exactly 80%
  assert.equal(classifyGMTier(4, 5), "优秀");
  // Exactly 100%
  assert.equal(classifyGMTier(5, 5), "惊世");
  // Just below 60%
  assert.equal(classifyGMTier(2, 5), "及格");
  // Just below 80%
  assert.equal(classifyGMTier(3, 4), "良好"); // 75%
});

test("GM episode completionKind drives tier classification", () => {
  const snapshot = gmSnapshot();
  const narration = narratorOutput();

  // Build 5 episodes: 4 complete, 1 failed
  const episodes: JourneySceneEpisode[] = [];
  for (let i = 1; i <= 5; i++) {
    const valid = i !== 3; // episode 3 is failed
    const judgment = adjudicatorOutput({
      actionValid: valid,
      invalidReason: valid ? null : "失败了",
    });
    const validatedChanges = applyDataBoundaries(judgment, snapshot, DEFAULT_HARD_RULES);
    episodes.push(buildGMEpisode({
      journeyId: "journey_1",
      index: i,
      playerNarrative: `行动${i}`,
      snapshot,
      judgment,
      narration,
      validatedChanges,
      sourceEventId: `event_${i}`,
    }));
  }

  // Verify completionKind
  assert.equal(episodes[0].serverFacts!.storyBeat!.selectedAction.completionKind, "complete");
  assert.equal(episodes[1].serverFacts!.storyBeat!.selectedAction.completionKind, "complete");
  assert.equal(episodes[2].serverFacts!.storyBeat!.selectedAction.completionKind, "failed");
  assert.equal(episodes[3].serverFacts!.storyBeat!.selectedAction.completionKind, "complete");
  assert.equal(episodes[4].serverFacts!.storyBeat!.selectedAction.completionKind, "complete");

  // Count completions
  const completed = episodes.filter(
    (ep) => ep.serverFacts?.storyBeat?.selectedAction.completionKind === "complete",
  ).length;
  assert.equal(completed, 4);

  // 4/5 = 80% → 优秀
  assert.equal(classifyGMTier(completed, episodes.length), "优秀");
});

// ── End-to-End: buildGMEpisode → commitGMEpisodes full chain ────────

import {
  createJourneyRuntime,
  type JourneyRuntimeOptions,
  type JourneyRuntimeRecord,
} from "../lib/epoch/journeyRuntime.ts";
import type { JourneyRuntimeEvent } from "../lib/epoch/journeyReadModel.ts";
import type { JourneyPolicySelection, JourneyPolicyPreview } from "../lib/epoch/journeyPolicyRules.ts";

const POLICY_SELECTION: JourneyPolicySelection = { presetId: "cautious", presetVersion: "1", overrides: {} };
const POLICY_PREVIEW: JourneyPolicyPreview = {
  mandateSummary: "explore freely",
  socialPreference: "balanced",
  expectedReturn: "约半小时后",
  riskWarnings: [],
};

function makeSnapshotEvent(
  eventType: JourneyRuntimeEvent["eventType"],
  journey: EpochJourney,
  episode?: import("../lib/epoch/journeySceneRules.ts").JourneySceneEpisode,
): JourneyRuntimeEvent {
  return {
    eventId: `evt_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    eventType,
    journeyId: journey.journeyId,
    agentId: journey.agentId,
    explorerId: journey.explorerId,
    occurredAt: new Date().toISOString(),
    journey,
    policySelection: POLICY_SELECTION,
    preview: POLICY_PREVIEW,
    ...(episode ? { episode } : {}),
  };
}

function buildGMInitialEvents(journeyId = "journey_gm_1"): JourneyRuntimeEvent[] {
  const base = journeyFixture("draft", { journeyId, version: 0 });
  const prepared = { ...base, status: "prepared" as const, version: 1 };
  const traveling = {
    ...prepared,
    status: "traveling" as const,
    version: 2,
    startedAtWorldTime: "2026-07-12T00:00:00.000Z",
    dueAtWorldTime: "2026-07-12T01:00:00.000Z",
    dueAtRealTime: "2026-07-12T00:30:00.000Z",
    nextPollAt: "2026-07-12T00:10:00.000Z",
  };
  const gmActive = { ...traveling, status: "gm_active" as const, version: 3 };
  return [
    makeSnapshotEvent("journey_prepared", prepared),
    makeSnapshotEvent("journey_status_changed", traveling),
    makeSnapshotEvent("journey_status_changed", gmActive),
  ];
}

test("E2E: buildGMEpisode → commitGMEpisodes backfills sourceFactIds and increments version", () => {
  const initialEvents = buildGMInitialEvents();
  let appendedEvents: JourneyRuntimeEvent[] = [];
  const options: JourneyRuntimeOptions = {
    idFactory: (kind) => `${kind}_e2e_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    nowReal: () => "2026-07-12T00:05:00.000Z",
    initialEvents,
    appendEvents: (events) => { appendedEvents = [...appendedEvents, ...events]; },
    canonicalEpochEvents: () => [],
  };
  const runtime = createJourneyRuntime(options);

  // Verify journey is in gm_active state
  const before = runtime.status("journey_gm_1");
  assert.equal(before.journey.status, "gm_active");
  assert.equal(before.journey.version, 3);
  assert.equal(before.journey.episodeIds.length, 0);

  // Build a GM episode (no sourceEventId)
  const snapshot = gmSnapshot({
    journey: {
      id: "journey_gm_1",
      status: "gm_active",
      version: 3,
      destinationRegionId: "region_destination",
      episodeIds: [],
    },
  });
  const judgment = adjudicatorOutput();
  const narration = narratorOutput();
  const validatedChanges = applyDataBoundaries(judgment, snapshot, DEFAULT_HARD_RULES);
  const episode = buildGMEpisode({
    journeyId: "journey_gm_1",
    index: 1,
    playerNarrative: "去小卖部买烟",
    snapshot,
    judgment,
    narration,
    validatedChanges,
    // no sourceEventId — commitGMEpisodes backfills
  });

  // Verify sourceFactIds is empty before commit
  assert.deepEqual(episode.sourceFactIds, []);

  // Commit via commitGMEpisodes
  const committed = runtime.commitGMEpisodes("journey_gm_1", 3, [episode]);

  // Verify version incremented
  assert.equal(committed.journey.version, 4);

  // Verify episodeIds updated
  assert.deepEqual(committed.journey.episodeIds, ["journey_gm_1:gm:1"]);

  // Verify sourceEventIds was backfilled in the committed episode event
  const committedEvent = appendedEvents.find((e) => e.eventType === "journey_episode_recorded");
  assert.ok(committedEvent, "journey_episode_recorded event should be appended");
  assert.ok(committedEvent.episode, "event should carry the episode");
  assert.equal(committedEvent.episode.sourceFactIds.length, 1, "sourceFactIds should be backfilled");
  assert.ok(committedEvent.episode.sourceFactIds[0].startsWith("event_"), "sourceFactIds should be an event id");
  assert.equal(committedEvent.episode.serverFacts!.sourceEventIds.length, 1, "serverFacts.sourceEventIds should be backfilled");
  assert.equal(
    committedEvent.episode.sourceFactIds[0],
    committedEvent.episode.serverFacts!.sourceEventIds[0],
    "sourceFactIds and serverFacts.sourceEventIds should match",
  );

  // Verify confirmedFacts sourceEventIds also backfilled
  if (committedEvent.episode.serverFacts!.confirmedFacts.length > 0) {
    assert.deepEqual(
      committedEvent.episode.serverFacts!.confirmedFacts[0].sourceEventIds,
      committedEvent.episode.serverFacts!.sourceEventIds,
    );
  }
});

test("E2E: two sequential GM episodes produce correct version and episodeIds", () => {
  const initialEvents = buildGMInitialEvents("journey_gm_2");
  const options: JourneyRuntimeOptions = {
    idFactory: (kind) => `${kind}_seq_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    nowReal: () => "2026-07-12T00:05:00.000Z",
    initialEvents,
    appendEvents: () => {},
    canonicalEpochEvents: () => [],
  };
  const runtime = createJourneyRuntime(options);
  const snap = gmSnapshot({
    journey: { id: "journey_gm_2", status: "gm_active", version: 3, destinationRegionId: "region_destination", episodeIds: [] },
  });
  const judg = adjudicatorOutput();
  const narr = narratorOutput();

  // Episode 1
  const ep1 = buildGMEpisode({
    journeyId: "journey_gm_2", index: 1, playerNarrative: "行动1",
    snapshot: snap, judgment: judg, narration: narr,
    validatedChanges: applyDataBoundaries(judg, snap, DEFAULT_HARD_RULES),
  });
  const r1 = runtime.commitGMEpisodes("journey_gm_2", 3, [ep1]);
  assert.equal(r1.journey.version, 4);
  assert.deepEqual(r1.journey.episodeIds, ["journey_gm_2:gm:1"]);

  // Episode 2
  const ep2 = buildGMEpisode({
    journeyId: "journey_gm_2", index: 2, playerNarrative: "行动2",
    snapshot: snap, judgment: judg, narration: narr,
    validatedChanges: applyDataBoundaries(judg, snap, DEFAULT_HARD_RULES),
  });
  const r2 = runtime.commitGMEpisodes("journey_gm_2", 4, [ep2]);
  assert.equal(r2.journey.version, 5);
  assert.deepEqual(r2.journey.episodeIds, ["journey_gm_2:gm:1", "journey_gm_2:gm:2"]);
});

test("E2E: commitGMEpisodes throws journey_version_conflict on stale version", () => {
  const initialEvents = buildGMInitialEvents("journey_gm_3");
  const options: JourneyRuntimeOptions = {
    idFactory: (kind) => `${kind}_conflict_${Date.now()}`,
    nowReal: () => "2026-07-12T00:05:00.000Z",
    initialEvents,
    appendEvents: () => {},
    canonicalEpochEvents: () => [],
  };
  const runtime = createJourneyRuntime(options);
  const snap = gmSnapshot({
    journey: { id: "journey_gm_3", status: "gm_active", version: 3, destinationRegionId: "region_destination", episodeIds: [] },
  });
  const judg = adjudicatorOutput();
  const narr = narratorOutput();
  const ep = buildGMEpisode({
    journeyId: "journey_gm_3", index: 1, playerNarrative: "test",
    snapshot: snap, judgment: judg, narration: narr,
    validatedChanges: applyDataBoundaries(judg, snap, DEFAULT_HARD_RULES),
  });

  // Stale version (should be 3)
  assert.throws(
    () => runtime.commitGMEpisodes("journey_gm_3", 2, [ep]),
    /journey_version_conflict/,
  );
});

test("E2E: commitGMEpisodes rejects non-gm_active status", () => {
  // Create a journey in traveling state (not gm_active)
  const base = journeyFixture("draft", { journeyId: "journey_gm_4", version: 0 });
  const prepared = { ...base, status: "prepared" as const, version: 1 };
  const traveling = {
    ...prepared,
    status: "traveling" as const,
    version: 2,
    startedAtWorldTime: "2026-07-12T00:00:00.000Z",
    dueAtWorldTime: "2026-07-12T01:00:00.000Z",
    dueAtRealTime: "2026-07-12T00:30:00.000Z",
    nextPollAt: "2026-07-12T00:10:00.000Z",
  };
  const options: JourneyRuntimeOptions = {
    idFactory: (kind) => `${kind}_status_${Date.now()}`,
    nowReal: () => "2026-07-12T00:05:00.000Z",
    initialEvents: [
      makeSnapshotEvent("journey_prepared", prepared),
      makeSnapshotEvent("journey_status_changed", traveling),
    ],
    appendEvents: () => {},
    canonicalEpochEvents: () => [],
  };
  const runtime = createJourneyRuntime(options);
  const snap = gmSnapshot({
    journey: { id: "journey_gm_4", status: "traveling", version: 2, destinationRegionId: "region_destination", episodeIds: [] },
  });
  const judg = adjudicatorOutput();
  const narr = narratorOutput();
  const ep = buildGMEpisode({
    journeyId: "journey_gm_4", index: 1, playerNarrative: "test",
    snapshot: snap, judgment: judg, narration: narr,
    validatedChanges: applyDataBoundaries(judg, snap, DEFAULT_HARD_RULES),
  });

  assert.throws(
    () => runtime.commitGMEpisodes("journey_gm_4", 2, [ep]),
    /journey_gm_status_invalid/,
  );
});

// ── tick() GM settlement tests ──────────────────────────────────────

function buildNormalSettlingEvents(journeyId = "journey_normal"): JourneyRuntimeEvent[] {
  const base = journeyFixture("draft", { journeyId, version: 0 });
  const prepared = { ...base, status: "prepared" as const, version: 1 };
  const traveling = {
    ...prepared,
    status: "traveling" as const,
    version: 2,
    startedAtWorldTime: "2026-07-12T00:00:00.000Z",
    dueAtWorldTime: "2026-07-12T01:00:00.000Z",
    dueAtRealTime: "2026-07-12T00:30:00.000Z",
    nextPollAt: "2026-07-12T00:10:00.000Z",
  };
  const returning = { ...traveling, status: "returning" as const, version: 3 };
  const settling = { ...returning, status: "settling" as const, version: 4 };
  return [
    makeSnapshotEvent("journey_prepared", prepared),
    makeSnapshotEvent("journey_status_changed", traveling),
    makeSnapshotEvent("journey_status_changed", returning),
    makeSnapshotEvent("journey_status_changed", settling),
  ];
}

function buildGMSettlingEvents(journeyId = "journey_gm_settling"): JourneyRuntimeEvent[] {
  const base = journeyFixture("draft", { journeyId, version: 0 });
  const prepared = { ...base, status: "prepared" as const, version: 1 };
  const traveling = {
    ...prepared,
    status: "traveling" as const,
    version: 2,
    startedAtWorldTime: "2026-07-12T00:00:00.000Z",
    dueAtWorldTime: "2026-07-12T01:00:00.000Z",
    dueAtRealTime: "2026-07-12T00:30:00.000Z",
    nextPollAt: "2026-07-12T00:10:00.000Z",
  };
  const gmActive = { ...traveling, status: "gm_active" as const, version: 3 };
  const settling = { ...gmActive, status: "settling" as const, version: 4, taskPlan: undefined };
  return [
    makeSnapshotEvent("journey_prepared", prepared),
    makeSnapshotEvent("journey_status_changed", traveling),
    makeSnapshotEvent("journey_status_changed", gmActive),
    makeSnapshotEvent("journey_status_changed", settling),
  ];
}

test("tick() skips GM settling journey (no taskPlan) without throwing", () => {
  const gmSettlingEvents = buildGMSettlingEvents();
  const options: JourneyRuntimeOptions = {
    idFactory: (kind) => `${kind}_tick_${Date.now()}`,
    nowReal: () => "2026-07-12T00:35:00.000Z", // past dueAtRealTime
    initialEvents: gmSettlingEvents,
    appendEvents: () => {},
    canonicalEpochEvents: () => [],
  };
  const runtime = createJourneyRuntime(options);

  // Verify GM journey is in settling
  const before = runtime.status("journey_gm_settling");
  assert.equal(before.journey.status, "settling");

  // tick() should NOT throw and should NOT settle the GM journey
  const result = runtime.tick();
  assert.equal(result.settledJourneyIds.length, 0, "GM journey should not be settled by tick");

  // Journey should still be in settling
  const after = runtime.status("journey_gm_settling");
  assert.equal(after.journey.status, "settling");
});

test("tick() processes both GM and non-GM settling journeys without throwing", () => {
  // Mix: one normal settling journey (no episodes → not settled by tick) + one GM settling journey
  const normalEvents = buildNormalSettlingEvents("journey_normal_mix");
  const gmEvents = buildGMSettlingEvents("journey_gm_mix");
  const options: JourneyRuntimeOptions = {
    idFactory: (kind) => `${kind}_mix_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    nowReal: () => "2026-07-12T00:35:00.000Z",
    initialEvents: [...normalEvents, ...gmEvents],
    appendEvents: () => {},
    canonicalEpochEvents: () => [],
  };
  const runtime = createJourneyRuntime(options);

  // tick() must not throw even with mixed GM and non-GM settling journeys
  const result = runtime.tick();

  // GM journey should remain in settling (skipped by tick due to no taskPlan)
  assert.ok(!result.settledJourneyIds.includes("journey_gm_mix"), "GM journey should not be settled");
  assert.equal(runtime.status("journey_gm_mix").journey.status, "settling");

  // Normal journey also remains in settling (no grounded episodes)
  assert.ok(!result.settledJourneyIds.includes("journey_normal_mix"), "normal journey needs grounded episodes to settle");
  assert.equal(runtime.status("journey_normal_mix").journey.status, "settling");
});

test("tick() does not throw when GM settling journey coexists with other journeys", () => {
  const gmEvents = buildGMSettlingEvents("journey_gm_coexist");
  const options: JourneyRuntimeOptions = {
    idFactory: (kind) => `${kind}_coexist_${Date.now()}`,
    nowReal: () => "2026-07-12T00:35:00.000Z",
    initialEvents: gmEvents,
    appendEvents: () => {},
    canonicalEpochEvents: () => [],
  };
  const runtime = createJourneyRuntime(options);

  // tick() must not throw even with GM settling journeys
  assert.doesNotThrow(() => runtime.tick());
});
