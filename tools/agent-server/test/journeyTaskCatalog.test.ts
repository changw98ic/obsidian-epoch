import assert from "node:assert/strict";
import test from "node:test";
import {
  buildJourneySceneContract,
  journeySceneHostedActionOptions,
  verifyJourneySceneActionSignature,
  type JourneySceneContractWorldObject,
} from "../lib/epoch/journeySceneContractRules.ts";
import { generateThreePhaseJourneySceneEpisodes } from "../lib/epoch/journeySceneRules.ts";
import {
  isJourneyTaskCompletionAction,
  journeyTaskRoutes,
} from "../lib/epoch/journeyTaskCatalog.ts";

const MANDATE = {
  objective: "完成目的地的具体任务并带回可核验结果",
  priorities: ["mission_completion", "safe_return"],
  avoid: ["abandonment"],
  preferredActivities: [],
  socialPreference: "balanced" as const,
  returnCondition: "time" as const,
};

function regionObject(regionId: string): JourneySceneContractWorldObject {
  return {
    id: regionId,
    type: "region",
    label: regionId,
    sourceFactIds: [`world:region:${regionId}`],
  };
}

test("task catalog exposes many concrete routes instead of three hard-coded variants", () => {
  const routes = journeyTaskRoutes();
  assert.ok(routes.length >= 16, `expected at least 16 routes, got ${routes.length}`);
  assert.equal(new Set(routes.map((route) => route.regionId)).size, routes.length);
  assert.equal(new Set(routes.map((route) => route.routeKey)).size, routes.length);
  assert.ok(routes.some((route) => route.routeKey === "phase_experiment"));
  assert.ok(routes.some((route) => route.routeKey === "cathedral_entry_trial"));
  assert.ok(routes.some((route) => route.routeKey === "forest_mutant_bounty"));
  assert.ok(routes.some((route) => route.routeKey === "mine_rescue"));
  assert.ok(routes.every((route) => route.regionId !== "region_gray_harbor"));

  const actionKeys = routes.flatMap((route) => route.actions.map((action) => action.optionKey));
  assert.equal(new Set(actionKeys).size, actionKeys.length);
  for (const route of routes) {
    assert.ok(route.actions.length >= 3, route.routeKey);
    assert.ok(route.actions.filter((action) => action.completesMission).length >= 2, route.routeKey);
    assert.equal(route.actions.find((action) => action.optionKey === route.safeFallbackOptionKey)?.completesMission, false);
    assert.ok(route.worldObjects.some((object) => object.id === route.locationId));
    assert.ok(route.participantIds.length > 0);
    assert.doesNotMatch(`${route.title}${route.premise}`, /灰港|民务账房|盐票账册/u);
  }
});

test("every task route generates a three-phase plan and a grounded signed main contract", () => {
  for (const route of journeyTaskRoutes()) {
    const region = regionObject(route.regionId);
    const plan = generateThreePhaseJourneySceneEpisodes({
      mandate: MANDATE,
      identityHistory: {},
      region: { ...region, label: route.regionId },
      season: "current",
      resources: {},
      unresolvedClues: [],
      availableWorldObjects: route.worldObjects,
      episodeCount: 3,
    });
    assert.equal(plan.status, "ready", route.routeKey);
    assert.equal(plan.episodes.length, 3, route.routeKey);
    assert.deepEqual(plan.episodes.map((episode) => episode.phase), ["arrival", "main", "return"]);
    const main = plan.episodes[1];
    assert.equal(main.type, route.sceneType, route.routeKey);
    assert.equal(main.worldObjectRefs[0]?.id, route.locationId, route.routeKey);

    const worldObjects = [region, ...route.worldObjects];
    const contract = buildJourneySceneContract({
      seed: `seed:${route.routeKey}`,
      agentId: "agent_task_catalog_test",
      journeyId: `journey:${route.routeKey}`,
      episodeId: main.episodeId,
      sceneType: main.type,
      phase: "main",
      title: main.title,
      mandate: MANDATE,
      worldObjects,
      sourceFactIds: worldObjects.flatMap((object) => object.sourceFactIds),
      expectedVersion: 1,
      expiresAt: "2026-07-15T00:00:00.000Z",
    });
    assert.equal(contract.location.id, route.locationId, route.routeKey);
    assert.deepEqual(contract.actionOptions.map((action) => action.optionKey),
      route.actions.map((action) => action.optionKey), route.routeKey);
    assert.equal(contract.actionOptions.find((action) =>
      action.actionOptionId === contract.safeFallbackActionOptionId)?.optionKey,
    route.safeFallbackOptionKey, route.routeKey);
    assert.ok(contract.actionOptions.every((action) => verifyJourneySceneActionSignature({
      agentId: "agent_task_catalog_test",
      contract,
      action,
    })), route.routeKey);
    assert.ok(contract.actionOptions.filter((action) => isJourneyTaskCompletionAction(action.optionKey)).length >= 2);
    assert.deepEqual(journeySceneHostedActionOptions(contract).map((action) => action.outcomeSummary),
      route.actions.map((action) => action.outcomeSummary), route.routeKey);
  }
});

test("non-Gray-Harbor travel contracts use destination-neutral arrival actions and outcomes", () => {
  const route = journeyTaskRoutes().find((item) => item.regionId === "region_quantum_laboratory");
  assert.ok(route);
  assert.equal(
    route.mission.primaryObjective,
    "在相位实验舱协助完成第七码样本测试，并确认实验记录已提交归档。",
  );
  assert.doesNotMatch(route.mission.primaryObjective, /带回.*记录/u);
  const region = regionObject(route.regionId);
  const contract = buildJourneySceneContract({
    seed: "quantum-arrival",
    agentId: "agent_quantum_arrival",
    journeyId: "journey_quantum_arrival",
    episodeId: "episode_quantum_arrival",
    sceneType: "travel",
    phase: "arrival",
    title: "到达：量子实验室",
    mandate: MANDATE,
    worldObjects: [region],
    sourceFactIds: region.sourceFactIds,
    expectedVersion: 1,
    expiresAt: "2026-07-15T00:00:00.000Z",
  });
  assert.deepEqual(contract.actionOptions.map((action) => action.optionKey), [
    "enter_destination", "review_arrival_route", "turn_back_before_entry",
  ]);
  assert.doesNotMatch(journeySceneHostedActionOptions(contract)[0]?.outcomeSummary ?? "", /灰港/u);
});
