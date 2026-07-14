import assert from "node:assert/strict";
import test from "node:test";

import { JOURNEY_SCENE_TYPES, journeySceneCatalog } from "../lib/epoch/journeySceneCatalog.ts";
import {
  episodeFingerprintKey,
  generateJourneySceneEpisodes,
  generateThreePhaseJourneySceneEpisodes,
  rankJourneySceneCandidates,
  wouldRepeatEpisodeThreeTimes,
  type JourneyAvailableWorldObject,
  type JourneyEpisodeFingerprint,
  type JourneySceneGenerationInput,
} from "../lib/epoch/journeySceneRules.ts";

const REGION = {
  id: "region_gray_harbor",
  type: "region",
  label: "灰港",
  sourceFactIds: ["event_region_confirmed"],
} as const;

const OBJECTS: readonly JourneyAvailableWorldObject[] = [
  {
    id: "workshop_1",
    type: "workplace",
    label: "盐绳工坊",
    regionId: REGION.id,
    sourceFactIds: ["event_workshop_open"],
    tags: ["work", "rope"],
  },
  {
    id: "npc_1",
    type: "npc",
    label: "守潮人弥娅",
    regionId: REGION.id,
    sourceFactIds: ["event_npc_canonicalized"],
    participantIds: ["npc_1"],
  },
  {
    id: "clue_site_1",
    type: "location",
    label: "旧潮标",
    regionId: REGION.id,
    sourceFactIds: ["event_tide_marker_seen"],
    sceneTypes: ["discovery"],
  },
];

function input(overrides: Partial<JourneySceneGenerationInput> = {}): JourneySceneGenerationInput {
  return {
    mandate: {
      objective: "在灰港找到可靠的生计",
      priorities: ["work"],
      avoid: ["conflict"],
      preferredActivities: ["livelihood"],
      socialPreference: "balanced",
      returnCondition: "time",
    },
    identityHistory: {
      roles: ["scribe"],
      traits: ["careful"],
      recentEpisodeFingerprints: [],
    },
    region: REGION,
    season: "雾季",
    resources: { coin: 4 },
    unresolvedClues: [{
      clueId: "clue_1",
      label: "退潮刻痕",
      sourceFactIds: ["event_clue_open"],
      relatedWorldObjectIds: ["clue_site_1"],
    }],
    availableWorldObjects: OBJECTS,
    episodeCount: 3,
    ...overrides,
  };
}

test("catalog defines every required journey candidate type", () => {
  assert.deepEqual(JOURNEY_SCENE_TYPES, [
    "livelihood", "travel", "relationship", "commission", "world_event", "discovery", "health", "conflict",
  ]);
  assert.deepEqual(journeySceneCatalog().map((entry) => entry.type), JOURNEY_SCENE_TYPES);
});

test("ranked candidates are deterministic and grounded in supplied world objects and facts", () => {
  const first = rankJourneySceneCandidates(input());
  const second = rankJourneySceneCandidates(input());
  assert.deepEqual(first, second);
  assert.ok(first.length >= 3);
  const suppliedIds = new Set([REGION.id, ...OBJECTS.map((object) => object.id)]);
  for (const candidate of first) {
    assert.ok(candidate.worldObjectRefs.length >= 1);
    assert.ok(candidate.worldObjectRefs.every((object) => suppliedIds.has(object.id)));
    assert.ok(candidate.sourceFactIds.length >= 1);
  }
});

test("mandate priorities, preferred activities, and avoid terms materially reorder candidates", () => {
  const workFirst = rankJourneySceneCandidates(input())[0];
  assert.equal(workFirst.type, "livelihood");
  assert.ok(workFirst.worldObjectRefs.some((object) => object.id === "npc_1"));
  assert.ok(workFirst.sourceFactIds.includes("event_npc_canonicalized"));
  assert.ok(workFirst.sourceFactIds.includes("event_region_confirmed"));
  assert.ok(workFirst.fingerprint.participantIds.includes("npc_1"));

  const socialFirst = rankJourneySceneCandidates(input({
    mandate: {
      objective: "拜访灰港居民",
      priorities: ["relationship"],
      avoid: ["work"],
      preferredActivities: ["meet", "social"],
      socialPreference: "outgoing",
      returnCondition: "time",
    },
  }))[0];
  assert.equal(socialFirst.type, "relationship");
  assert.notEqual(socialFirst.candidateId, workFirst.candidateId);

  const agent = {
    id: "agent_visitor",
    type: "agent",
    label: "访客",
    regionId: REGION.id,
    sourceFactIds: ["event_agent_present"],
    participantIds: ["agent_visitor"],
  } satisfies JourneyAvailableWorldObject;
  const requestedAgent = rankJourneySceneCandidates(input({
    mandate: {
      objective: "拜访同住灰港的其他探索者",
      priorities: ["social", "agent"],
      avoid: [],
      preferredActivities: ["social", "visit"],
      socialPreference: "outgoing",
      returnCondition: "time",
    },
    availableWorldObjects: [...OBJECTS, agent],
  }))[0];
  assert.equal(requestedAgent.candidateId, "scene:relationship:agent_visitor");
});

test("unresolved clues, region, season, resources, and identity history participate in pure scoring", () => {
  const ranked = rankJourneySceneCandidates(input({
    mandate: {
      objective: "调查退潮刻痕",
      priorities: ["discovery"],
      avoid: [],
      preferredActivities: ["clue"],
      socialPreference: "reserved",
      returnCondition: "objective",
    },
    identityHistory: { completedSceneTypes: ["livelihood"], visitedWorldObjectIds: ["workshop_1"] },
    season: "潮汐调查季",
    resources: { clue_kit: 1 },
  }));
  assert.equal(ranked[0].type, "discovery");
  assert.ok(ranked[0].sourceFactIds.includes("event_clue_open"));
});

test("episode fingerprint prevents a third identical location-participants-options-outcome episode", () => {
  const repeated: JourneyEpisodeFingerprint = {
    locationId: "workshop_1",
    participantIds: [],
    optionIds: ["observe_conditions", "work_safely"],
    outcomeKey: "routine_work_recorded",
  };
  assert.equal(episodeFingerprintKey(repeated), "workshop_1||observe_conditions,work_safely|routine_work_recorded");
  assert.equal(wouldRepeatEpisodeThreeTimes([repeated, repeated], repeated), true);

  const plan = generateJourneySceneEpisodes(input({
    episodeCount: 1,
    identityHistory: { recentEpisodeFingerprints: [repeated, repeated] },
  }));
  assert.equal(plan.status, "ready");
  assert.equal(plan.episodes.length, 1);
  assert.notEqual(episodeFingerprintKey(plan.episodes[0].fingerprint), episodeFingerprintKey(repeated));
});

test("sparse input falls back to a verifiable region routine without inventing NPCs", () => {
  const plan = generateJourneySceneEpisodes(input({
    availableWorldObjects: [],
    unresolvedClues: [],
    episodeCount: 3,
  }));
  assert.equal(plan.status, "ready");
  assert.equal(plan.usedRoutineFallback, true);
  assert.equal(plan.episodes.length, 1);
  assert.deepEqual(plan.episodes[0].worldObjectRefs, [{ id: REGION.id, type: REGION.type, label: REGION.label }]);
  assert.deepEqual(plan.episodes[0].sourceFactIds, REGION.sourceFactIds);
  assert.deepEqual(plan.episodes[0].worldObjectRefs.map((object) => object.type), ["region"]);
});

test("no grounded object returns an explicit empty plan rather than fabricating evidence", () => {
  const plan = generateJourneySceneEpisodes(input({
    region: { id: REGION.id, type: "region", label: REGION.label, sourceFactIds: [] },
    availableWorldObjects: [],
  }));
  assert.equal(plan.status, "no_verifiable_world_object");
  assert.deepEqual(plan.episodes, []);
  assert.deepEqual(plan.candidates, []);
});

test("P0 generation clamps every non-empty journey to one through three episodes", () => {
  assert.equal(generateJourneySceneEpisodes(input({ episodeCount: -5 })).episodes.length, 1);
  assert.equal(generateJourneySceneEpisodes(input({ episodeCount: 99 })).episodes.length, 3);
});

test("three-phase journey always orders grounded arrival, main event, and return", () => {
  const plan = generateThreePhaseJourneySceneEpisodes(input());

  assert.equal(plan.status, "ready");
  assert.deepEqual(plan.episodes.map((episode) => episode.phase), ["arrival", "main", "return"]);
  assert.deepEqual(plan.episodes.map((episode) => episode.type), ["travel", "livelihood", "travel"]);
  assert.deepEqual(plan.episodes[0].worldObjectRefs, [{ id: REGION.id, type: REGION.type, label: REGION.label }]);
  assert.deepEqual(plan.episodes[2].worldObjectRefs, [{ id: REGION.id, type: REGION.type, label: REGION.label }]);
  assert.ok(plan.episodes.every((episode) => episode.sourceFactIds.length > 0));
  assert.notEqual(plan.episodes[0].outcomeKey, plan.episodes[2].outcomeKey);
});
