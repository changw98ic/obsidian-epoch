import assert from "node:assert/strict";
import test from "node:test";
import {
  adjudicateJourneyTask,
  buildFallbackJourneyTaskPlan,
  deriveJourneyHiddenTask,
  journeyTaskGraphState,
  JOURNEY_TIER_REWARDS,
  nextJourneyTaskObjective,
  normalizeJourneyCompletionTier,
  normalizeJourneyTaskActionRisk,
  validateJourneyTaskProposal,
  type JourneyGeneratedTaskPlan,
} from "../lib/epoch/journeyGeneratedTaskRules.ts";
import { journeyTaskRouteForRegion } from "../lib/epoch/journeyTaskCatalog.ts";
import { journeyScopedNpcObjects } from "../lib/epoch/journeyWorldCatalog.ts";
import {
  JOURNEY_ACTION_RESOLUTION_RULE_VERSION,
  type JourneyActionResolution,
} from "../lib/epoch/journeyActionResolutionRules.ts";

test("legacy perfect tier label normalizes to excellent", () => {
  assert.equal(normalizeJourneyCompletionTier("完美"), "优秀");
  assert.equal(normalizeJourneyCompletionTier("优秀"), "优秀");
});

const regionId = "region_quantum_laboratory";

function fixture() {
  const route = journeyTaskRouteForRegion(regionId);
  assert.ok(route);
  const region = {
    id: regionId,
    type: "region",
    label: "量子实验室",
    regionId,
    sourceFactIds: [`world:region:${regionId}`],
  };
  const availableWorldObjects = [region, ...route.worldObjects];
  const installation = buildFallbackJourneyTaskPlan({
    taskType: "辅助完成一次实验",
    scenarioMapId: regionId,
    availableWorldObjects,
  });
  return { route, availableWorldObjects, ...installation };
}

function evidence(
  plan: JourneyGeneratedTaskPlan,
  selected: Readonly<Record<string, string>>,
  quality: "ordinary" | "excellent" = "ordinary",
) {
  return plan.objectives.flatMap((objective) => {
    const optionKey = selected[objective.objectiveId];
    const action = objective.actions.find((candidate) => candidate.optionKey === optionKey);
    const difficulty = action ? { low: 40, medium: 56, high: 68 }[action.risk] : 40;
    const exceptional = quality === "excellent" && action?.risk !== "low";
    const margin = exceptional ? 20 : 5;
    const resolution: JourneyActionResolution = {
      ruleVersion: JOURNEY_ACTION_RESOLUTION_RULE_VERSION,
      authority: "server",
      decisionKeyId: "test-key",
      inputHash: `sha256:${"0".repeat(64)}`,
      outcome: exceptional ? "exceptional_success" : "success",
      completionKind: "complete",
      score: difficulty + margin,
      difficulty,
      margin,
      factors: {
        baseCompetence: difficulty + margin,
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
      ...(action?.risk === "medium" || action?.risk === "high" ? { resourceCost: {
        resourceId: action.risk === "high" ? "stamina" as const : "focus" as const,
        amount: 1 as const,
        paid: true,
      } } : {}),
      summary: "服务器测试结算。",
    };
    return optionKey ? [{
      generatedTaskObjective: objective,
      serverFacts: { storyBeat: { selectedAction: {
        optionKey,
        taskObjectiveId: objective.objectiveId,
        completionKind: "complete" as const,
        resolution,
      } } },
    }] : [];
  });
}

function skippedEvidence(plan: JourneyGeneratedTaskPlan, objectiveId: string) {
  const objective = plan.objectives.find((candidate) => candidate.objectiveId === objectiveId);
  assert.ok(objective);
  return [{
    generatedTaskObjective: objective,
    serverFacts: { storyBeat: { selectedAction: {
      optionKey: `skip_${objective.objectiveId}`,
      taskObjectiveId: objective.objectiveId,
      completionKind: "skip" as const,
    } } },
  }];
}

function failedEvidence(plan: JourneyGeneratedTaskPlan, objectiveId: string) {
  const objective = plan.objectives.find((candidate) => candidate.objectiveId === objectiveId);
  assert.ok(objective);
  const action = objective.actions[0];
  const difficulty = { low: 40, medium: 56, high: 68 }[action.risk];
  const resolution: JourneyActionResolution = {
    ruleVersion: JOURNEY_ACTION_RESOLUTION_RULE_VERSION,
    authority: "server",
    decisionKeyId: "test-key",
    inputHash: `sha256:${"1".repeat(64)}`,
    outcome: "partial_success",
    completionKind: "failed",
    score: difficulty - 1,
    difficulty,
    margin: -1,
    factors: {
      baseCompetence: difficulty - 1,
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
    summary: "服务端测试失败结算。",
  };
  return [{
    generatedTaskObjective: objective,
    serverFacts: { storyBeat: { selectedAction: {
      optionKey: action.optionKey,
      taskObjectiveId: objective.objectiveId,
      completionKind: "failed" as const,
      resolution,
    } } },
  }];
}

test("fallback blueprint contains executable multi-stage main and side objectives", () => {
  const { plan } = fixture();
  assert.equal(plan.source, "server_fallback");
  assert.ok(plan.objectives.filter((objective) => objective.kind === "main").length >= 3);
  assert.equal(plan.objectives.filter((objective) => objective.kind === "side").length, 2);
  assert.equal(plan.objectives.filter((objective) => objective.kind === "choice").length, 1);
  assert.ok(plan.objectives.every((objective) => objective.actions.length === 2));
  assert.ok(plan.routes?.some((route) => route.kind === "choice"));
  assert.ok(plan.routes?.some((route) => route.kind === "unlock"
    && route.unlockedByObjectiveIds.some((objectiveId) =>
      plan.objectives.some((objective) => objective.objectiveId === objectiveId && objective.kind === "side"))));
  assert.equal(plan.completionResult.returnMode, "report");
  assert.equal(plan.completionResult.kind, "knowledge");
  assert.match(plan.hiddenTaskCommitment, /^sha256:[a-f0-9]{64}$/u);
  assert.equal("reward" in plan, false);
  assert.equal("hiddenTask" in plan, false);
  const risks = new Set(plan.objectives.flatMap((objective) =>
    objective.actions.map((action) => action.risk)));
  assert.ok(risks.has("low"));
  assert.ok(risks.has("medium") || risks.has("high"));
  const preparation = plan.objectives.find((objective) => objective.objectiveId === "main_1_prepare");
  assert.ok(preparation);
  assert.deepEqual(preparation.actions.map((action) => action.risk), ["low", "low"]);
  const executionText = plan.objectives
    .filter((objective) => objective.title.includes("直接执行") || objective.title.includes("审慎核验"))
    .flatMap((objective) => objective.actions.map((action) => `${action.label} ${action.outcomeSummary}`))
    .join(" ");
  assert.match(executionText, /相位稳定器|第七码样本/u);
  assert.doesNotMatch(executionText, /按登记步骤完成现场事务|核验对象状态并提交记录/u);
});

test("server-authored catalog risks are not inflated by the untrusted-model semantic filter", () => {
  const forestRoute = journeyTaskRouteForRegion("region_forest");
  assert.ok(forestRoute);
  const region = {
    id: "region_forest",
    type: "region",
    label: "腐林",
    regionId: "region_forest",
    sourceFactIds: ["world:region:region_forest"],
  };
  const { plan } = buildFallbackJourneyTaskPlan({
    taskType: "为了赚钱前往城外猎杀变异兽",
    scenarioMapId: "region_forest",
    availableWorldObjects: [region, ...forestRoute.worldObjects],
  });
  const actions = plan.objectives.flatMap((objective) => objective.actions);
  const trap = actions.find((action) => /诱捕索/u.test(action.label));
  const hunt = actions.find((action) => /猎杀甲壳变异兽/u.test(action.label));
  assert.equal(trap?.risk, "medium");
  assert.equal(hunt?.risk, "high");
});

test("server task graph selects one exclusive route and lets a completed side objective unlock another main route", () => {
  const { plan } = fixture();
  const choice = plan.objectives.find((objective) => objective.kind === "choice");
  const sideUnlockRoute = plan.routes?.find((route) => route.kind === "unlock");
  assert.ok(choice);
  assert.ok(sideUnlockRoute);
  const selectedChoice = choice.actions.find((action) => action.selectsRouteId);
  assert.ok(selectedChoice?.selectsRouteId);
  const otherChoiceRoute = choice.actions.find((action) =>
    action.selectsRouteId && action.selectsRouteId !== selectedChoice.selectsRouteId)?.selectsRouteId;
  assert.ok(otherChoiceRoute);

  let episodes = evidence(plan, {});
  const first = nextJourneyTaskObjective(plan, episodes);
  assert.ok(first);
  episodes = evidence(plan, { [first.objectiveId]: first.actions[0].optionKey });
  assert.equal(nextJourneyTaskObjective(plan, episodes)?.objectiveId, choice.objectiveId);
  episodes = [
    ...episodes,
    ...evidence(plan, { [choice.objectiveId]: selectedChoice.optionKey }),
  ];

  const unlockObjectiveId = sideUnlockRoute.unlockedByObjectiveIds[0];
  const unlockObjective = plan.objectives.find((objective) => objective.objectiveId === unlockObjectiveId);
  assert.ok(unlockObjective);
  const beforeUnlock = journeyTaskGraphState(plan, episodes);
  assert.ok(beforeUnlock.activeRouteIds.includes(selectedChoice.selectsRouteId));
  assert.ok(!beforeUnlock.activeRouteIds.includes(otherChoiceRoute));
  assert.ok(!beforeUnlock.activeRouteIds.includes(sideUnlockRoute.routeId));

  episodes = [
    ...episodes,
    ...evidence(plan, { [unlockObjective.objectiveId]: unlockObjective.actions[0].optionKey }),
  ];
  const afterUnlock = journeyTaskGraphState(plan, episodes);
  assert.ok(afterUnlock.activeRouteIds.includes(sideUnlockRoute.routeId));
  assert.ok(afterUnlock.bonusMainObjectiveIds.some((objectiveId) =>
    sideUnlockRoute.objectiveIds.includes(objectiveId)));
  assert.ok(afterUnlock.requiredMainObjectiveIds.every((objectiveId) =>
    !sideUnlockRoute.objectiveIds.includes(objectiveId)));
  assert.ok(afterUnlock.requiredMainObjectiveIds.every((objectiveId) =>
    !plan.routes?.find((route) => route.routeId === otherChoiceRoute)?.objectiveIds.includes(objectiveId)));
});

test("failure on a side-unlocked bonus main does not erase a completed core route", () => {
  const { plan, hiddenTaskSeal } = fixture();
  const choice = plan.objectives.find((objective) => objective.kind === "choice");
  const unlockRoute = plan.routes?.find((route) => route.kind === "unlock");
  assert.ok(choice);
  assert.ok(unlockRoute);
  const choiceAction = choice.actions.find((action) => action.selectsRouteId);
  assert.ok(choiceAction?.selectsRouteId);
  const selectedRoute = plan.routes?.find((route) => route.routeId === choiceAction.selectsRouteId);
  assert.ok(selectedRoute);
  const routedObjectiveIds = new Set(plan.routes?.flatMap((route) => route.objectiveIds));
  const commonMains = plan.objectives.filter((objective) =>
    objective.kind === "main" && !routedObjectiveIds.has(objective.objectiveId));
  const unlockSide = plan.objectives.find((objective) =>
    objective.objectiveId === unlockRoute.unlockedByObjectiveIds[0]);
  assert.ok(unlockSide);
  const requiredObjectives = [
    ...commonMains,
    choice,
    unlockSide,
    ...selectedRoute.objectiveIds.map((objectiveId) => {
      const objective = plan.objectives.find((candidate) => candidate.objectiveId === objectiveId);
      assert.ok(objective);
      return objective;
    }),
  ];
  const selections = Object.fromEntries(requiredObjectives.map((objective) => [
    objective.objectiveId,
    objective.objectiveId === choice.objectiveId ? choiceAction.optionKey : objective.actions[0].optionKey,
  ]));
  const result = adjudicateJourneyTask({
    plan,
    hiddenTaskSeal,
    episodes: [
      ...evidence(plan, selections),
      ...failedEvidence(plan, unlockRoute.objectiveIds[0]),
    ],
  });

  assert.equal(result.mainCompleted, result.mainTotal);
  assert.equal(result.bonusMainCompleted, 0);
  assert.equal(result.bonusMainTotal, 1);
  assert.equal(result.tier, "良好");
  assert.equal(result.performance?.failedActions, 1);
});

test("server normalizes semantic danger instead of trusting a sampled low-risk label", () => {
  assert.equal(normalizeJourneyTaskActionRisk({
    proposedRisk: "low",
    taskType: "前往城外猎杀变异兽",
    sceneType: "conflict",
    targetObjects: [{ id: "mutant", type: "creature", label: "甲壳变异兽", sourceFactIds: ["world:mutant"] }],
    allowedEffectKinds: ["journey_progress"],
  }), "high");
  assert.equal(normalizeJourneyTaskActionRisk({
    proposedRisk: "low",
    taskType: "整理实验记录",
    sceneType: "commission",
    targetObjects: [{ id: "ledger", type: "document", label: "实验记录", sourceFactIds: ["world:ledger"] }],
    allowedEffectKinds: ["world_reference"],
  }), "low");
  assert.equal(normalizeJourneyTaskActionRisk({
    proposedRisk: "high",
    taskType: "整理实验记录",
    sceneType: "commission",
    targetObjects: [],
    allowedEffectKinds: ["world_reference"],
  }), "high");
});

test("semantic validator rejects model completion, reward, hidden and map-forgery fields", () => {
  const { plan, availableWorldObjects } = fixture();
  const proposal = {
    title: plan.title,
    premise: plan.premise,
    primaryObjective: plan.primaryObjective,
    successResult: plan.successResult,
    completionResult: plan.completionResult,
    objectives: plan.objectives,
    routes: plan.routes,
  };
  const validate = (candidate: unknown) => validateJourneyTaskProposal({
    proposal: candidate,
    taskType: plan.taskType,
    scenarioMapId: plan.scenarioMapId,
    availableWorldObjects,
    source: "model_sampling",
  });
  for (const forged of [
    { ...proposal, reward: { resourceId: "legend", amount: 999 } },
    { ...proposal, completionTier: "惊世" },
    { ...proposal, hiddenTask: { completed: true } },
  ]) {
    assert.throws(() => validate(forged), /journey_task_proposal_field_not_allowed/u);
  }
  assert.throws(() => validate({
    ...proposal,
    completionResult: { kind: "knowledge", returnMode: "carry", summary: "把报告带走" },
  }), /journey_task_completion_return_mode_invalid/u);
  assert.throws(() => validate({
    ...proposal,
    completionResult: { kind: "invented", returnMode: "none", summary: "伪造结果" },
  }), /journey_task_completion_result_kind_invalid/u);
  const outOfMap = {
    ...proposal,
    objectives: proposal.objectives.map((objective, index) => index === 0
      ? { ...objective, worldObjectIds: [...objective.worldObjectIds, "outside_map"] }
      : objective),
  };
  assert.throws(() => validate(outOfMap), /journey_task_world_object_not_grounded/u);
});

test("server derives all four completion tiers from signed action evidence", () => {
  const { plan, hiddenTaskSeal } = fixture();
  const sides = plan.objectives.filter((objective) => objective.kind === "side");
  const choice = plan.objectives.find((objective) => objective.kind === "choice");
  assert.ok(choice);
  const choiceAction = choice.actions[0];
  assert.ok(choiceAction.selectsRouteId);
  const selectedRoute = plan.routes?.find((route) => route.routeId === choiceAction.selectsRouteId);
  assert.ok(selectedRoute);
  const routedObjectiveIds = new Set(plan.routes?.flatMap((route) => route.objectiveIds));
  const commonMains = plan.objectives.filter((objective) =>
    objective.kind === "main" && !routedObjectiveIds.has(objective.objectiveId));
  const mainPath = [
    ...commonMains,
    choice,
    ...selectedRoute.objectiveIds.map((objectiveId) =>
      plan.objectives.find((objective) => objective.objectiveId === objectiveId)).filter(Boolean),
  ];
  const mainSelections = Object.fromEntries(mainPath.map((objective) =>
    [objective?.objectiveId, objective?.objectiveId === choice.objectiveId
      ? choiceAction.optionKey
      : objective?.actions[0].optionKey]));
  const passing = adjudicateJourneyTask({ plan, hiddenTaskSeal, episodes: evidence(plan, mainSelections) });
  assert.equal(passing.tier, "及格");
  assert.deepEqual(passing.reward, JOURNEY_TIER_REWARDS.及格);
  assert.deepEqual(passing.rewardBundle?.attributes, []);
  const unlockIds = new Set(plan.routes?.filter((route) => route.kind === "unlock")
    .flatMap((route) => route.unlockedByObjectiveIds));
  const ordinarySide = sides.find((side) => !unlockIds.has(side.objectiveId)) ?? sides[0];
  const goodSelections = { ...mainSelections, [ordinarySide.objectiveId]: ordinarySide.actions[0].optionKey };
  const good = adjudicateJourneyTask({ plan, hiddenTaskSeal, episodes: evidence(plan, goodSelections) });
  assert.equal(good.tier, "良好");
  assert.equal(good.rewardBundle?.items.length, 1);
  assert.equal(good.rewardBundle?.items[0]?.rarity, "common");
  assert.deepEqual(good.rewardBundle?.attributes, []);

  const hidden = deriveJourneyHiddenTask(plan, hiddenTaskSeal);
  const activeObjectives = plan.objectives.filter((objective) => {
    if (objective.kind === "choice" || objective.kind === "side" || commonMains.includes(objective)) return true;
    const route = plan.routes?.find((candidate) => candidate.objectiveIds.includes(objective.objectiveId));
    return route?.routeId === selectedRoute.routeId || route?.kind === "unlock";
  });
  const perfectSelections = Object.fromEntries(activeObjectives.map((objective) => {
    const required = hidden.requiredActions.find((item) => item.objectiveId === objective.objectiveId);
    const action = required
      ? objective.actions.find((candidate) => candidate.optionKey !== required.optionKey) as typeof objective.actions[number]
      : objective.objectiveId === choice.objectiveId ? choiceAction : objective.actions[0];
    return [objective.objectiveId, action.optionKey];
  }));
  const ordinaryFullClear = adjudicateJourneyTask({
    plan,
    hiddenTaskSeal,
    episodes: evidence(plan, perfectSelections),
  });
  assert.equal(ordinaryFullClear.tier, "良好");
  assert.equal(ordinaryFullClear.performance?.perfectEligible, false);
  const perfect = adjudicateJourneyTask({
    plan,
    hiddenTaskSeal,
    episodes: evidence(plan, perfectSelections, "excellent"),
  });
  assert.equal(perfect.tier, "优秀");
  assert.equal(perfect.performance?.perfectEligible, true);

  const legendarySelections = Object.fromEntries(activeObjectives.map((objective) => {
    const required = hidden.requiredActions.find((item) => item.objectiveId === objective.objectiveId);
    return [objective.objectiveId, required?.optionKey
      ?? (objective.objectiveId === choice.objectiveId ? choiceAction.optionKey : objective.actions[0].optionKey)];
  }));
  const legendary = adjudicateJourneyTask({
    plan,
    hiddenTaskSeal,
    episodes: evidence(plan, legendarySelections, "excellent"),
    revealHidden: true,
  });
  assert.equal(legendary.tier, "惊世");
  assert.deepEqual(legendary.reward, JOURNEY_TIER_REWARDS.惊世);
  assert.deepEqual(legendary.rewardBundle?.resources, [JOURNEY_TIER_REWARDS.惊世]);
  assert.deepEqual(legendary.rewardBundle?.attributes, []);
  assert.equal(legendary.rewardBundle?.items.length, 1);
  assert.match(legendary.rewardBundle?.items[0]?.displayName || "", /信物|纪念|记录器|工具包|装备/u);
  assert.equal(legendary.hiddenTask.completed, true);
  assert.equal(legendary.hiddenTask.revealed, true);
});

test("adjudication fails closed unless evidence carries the matching server settlement classification", () => {
  const { plan, hiddenTaskSeal } = fixture();
  const firstMain = plan.objectives.find((objective) => objective.kind === "main");
  assert.ok(firstMain);
  const optionKey = firstMain.actions[0].optionKey;
  const forged = [{
    generatedTaskObjective: firstMain,
    serverFacts: { storyBeat: { selectedAction: { optionKey } } },
  }];
  assert.equal(adjudicateJourneyTask({ plan, hiddenTaskSeal, episodes: forged }).mainCompleted, 0);
  assert.equal(adjudicateJourneyTask({ plan, hiddenTaskSeal, episodes: skippedEvidence(plan, firstMain.objectiveId) }).mainCompleted, 0);
});

test("journey cast changes with the journey and fallback objectives use the supplied dynamic NPCs", () => {
  const firstCast = journeyScopedNpcObjects({
    journeyId: "journey_cast_alpha",
    regionId,
    taskType: "辅助完成一次实验",
  });
  const secondCast = journeyScopedNpcObjects({
    journeyId: "journey_cast_beta",
    regionId,
    taskType: "辅助完成一次实验",
  });
  assert.equal(firstCast.length, 3);
  assert.equal(secondCast.length, 3);
  assert.notDeepEqual(firstCast.map((npc) => npc.id), secondCast.map((npc) => npc.id));
  assert.notDeepEqual(firstCast.map((npc) => npc.label), secondCast.map((npc) => npc.label));

  const region = {
    id: regionId,
    type: "region",
    label: "量子实验室",
    regionId,
    sourceFactIds: [`world:region:${regionId}`],
  };
  const taskRoute = journeyTaskRouteForRegion(regionId);
  assert.ok(taskRoute);
  const { plan } = buildFallbackJourneyTaskPlan({
    taskType: "辅助完成一次实验",
    scenarioMapId: regionId,
    availableWorldObjects: [region, ...taskRoute.worldObjects, ...firstCast],
  });
  const referencedIds = new Set(plan.objectives.flatMap((objective) => objective.worldObjectIds));
  assert.ok(firstCast.some((npc) => referencedIds.has(npc.id)));
  assert.ok(firstCast.filter((npc) => referencedIds.has(npc.id)).length >= 2);
  assert.ok(new Set(plan.objectives.flatMap((objective) =>
    objective.worldObjectIds.filter((objectId) => firstCast.some((npc) => npc.id === objectId)))).size >= 2);
  assert.doesNotMatch(JSON.stringify(plan), /林铎/u);
});

test("hidden requirement stays sealed until terminal adjudication", () => {
  const { plan, hiddenTaskSeal } = fixture();
  const before = adjudicateJourneyTask({ plan, hiddenTaskSeal, episodes: [] });
  assert.equal(before.hiddenTask.revealed, false);
  assert.deepEqual(Object.keys(before.hiddenTask).sort(), ["commitment", "revealed"]);
  assert.equal("description" in before.hiddenTask, false);
  assert.equal("requiredActions" in before.hiddenTask, false);
  assert.equal("completed" in before.hiddenTask, false);
  const after = adjudicateJourneyTask({ plan, hiddenTaskSeal, episodes: [], revealHidden: true });
  assert.equal(after.hiddenTask.revealed, true);
  assert.ok(after.hiddenTask.description);
  assert.equal(after.hiddenTask.requiredActions?.length, 2);
});

test("hidden completion cannot upgrade public adjudication before terminal reveal", () => {
  const { plan, hiddenTaskSeal } = fixture();
  const hidden = deriveJourneyHiddenTask(plan, hiddenTaskSeal);
  const hiddenSuccessSelections = Object.fromEntries(plan.objectives.map((objective) => {
    const required = hidden.requiredActions.find((item) => item.objectiveId === objective.objectiveId);
    return [objective.objectiveId, required?.optionKey ?? objective.actions[0].optionKey];
  }));

  const before = adjudicateJourneyTask({
    plan,
    hiddenTaskSeal,
    episodes: evidence(plan, hiddenSuccessSelections, "excellent"),
  });
  assert.equal(before.tier, "优秀");
  assert.deepEqual(before.hiddenTask, {
    commitment: plan.hiddenTaskCommitment,
    revealed: false,
  });
  assert.notEqual(before.reward?.resourceId, "legend");
  assert.equal(before.rewardBundle?.items[0]?.rarity, "rare");

  const after = adjudicateJourneyTask({
    plan,
    hiddenTaskSeal,
    episodes: evidence(plan, hiddenSuccessSelections, "excellent"),
    revealHidden: true,
  });
  assert.equal(after.tier, "惊世");
  assert.equal(after.hiddenTask.completed, true);
  assert.equal(after.reward?.resourceId, "legend");
  assert.equal(after.rewardBundle?.items[0]?.rarity, "legendary");
});

test("a serialized sealed task plan cannot be adjudicated without its installation seal", () => {
  const { plan } = fixture();
  const detachedPlan = JSON.parse(JSON.stringify(plan)) as JourneyGeneratedTaskPlan;
  assert.throws(
    () => adjudicateJourneyTask({ plan: detachedPlan, episodes: [] }),
    /journey_hidden_task_commitment_invalid/u,
  );
});
