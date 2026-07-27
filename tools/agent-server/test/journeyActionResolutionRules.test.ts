import assert from "node:assert/strict";
import test from "node:test";

import {
  journeyActionRiskTerms,
  journeyRiskPremiumForOutcome,
  resolveJourneyAction,
} from "../lib/epoch/journeyActionResolutionRules.ts";

const baseInput = {
  agentId: "agent_resolution_1",
  journeyId: "journey_resolution_1",
  episodeId: "episode_resolution_1",
  actionOptionId: "action_resolution_1",
  actionLabel: "协助完成高风险装置校准",
  objectiveTitle: "完成装置校准",
  locationLabel: "第七码操作间",
  successOutcomeSummary: "身份完成了装置校准，现场负责人确认设备已经稳定。",
  risk: "high" as const,
  identity: {
    lifetime: { max: 100, remaining: 100 },
    traits: [] as readonly string[],
  },
  resources: {},
  inventoryItems: [],
  participantTargetCount: 0,
};

test("high-risk generated actions fail closed when the identity has no preparation or support", () => {
  const first = resolveJourneyAction(baseInput);
  const replay = resolveJourneyAction(baseInput);

  assert.deepEqual(replay, first);
  assert.equal(first.authority, "server");
  assert.equal(first.completionKind, "failed");
  assert.ok(["partial_success", "failure"].includes(first.outcome));
  assert.ok(first.score < first.difficulty);
  assert.notEqual(first.summary, baseInput.successOutcomeSummary);
  assert.match(first.summary, /未完成/u);
  assert.deepEqual(first.resourceCost, { resourceId: "stamina", amount: 1, paid: false });
});

test("even a low-risk action is not an automatic success for an exhausted unprepared identity", () => {
  const resolution = resolveJourneyAction({
    ...baseInput,
    risk: "low",
    identity: {
      lifetime: { max: 100, remaining: 0 },
      traits: [],
      needs: { levels: { hunger: 10_000, thirst: 10_000, fatigue: 10_000 } },
    },
    resources: {},
    inventoryItems: [],
    participantTargetCount: 0,
  });

  assert.equal(resolution.completionKind, "failed");
  assert.ok(resolution.score < resolution.difficulty);
  assert.match(resolution.summary, /未完成/u);
});

test("choosing a server-bound route is a decision rather than a competence check", () => {
  const resolution = resolveJourneyAction({
    ...baseInput,
    risk: "low",
    objectiveKind: "choice",
    identity: {
      lifetime: { max: 100, remaining: 0 },
      traits: [],
    },
  });

  assert.equal(resolution.completionKind, "complete");
  assert.equal(resolution.outcome, "success");
  assert.equal(resolution.score, 0);
  assert.equal(resolution.difficulty, 0);
  assert.equal(resolution.resourceCost, undefined);
});

test("completed journey preparation can make a supported medium-risk action reachable", () => {
  const resolution = resolveJourneyAction({
    ...baseInput,
    risk: "medium",
    journeyPreparationScore: 16,
    identity: {
      lifetime: { max: 100, remaining: 100 },
      traits: [],
      lifeGoal: {
        category: "learning",
        description: "掌握实验方法",
        motivation: "理解实验结果",
      },
    },
    resources: { focus: 1 },
    participantTargetCount: 1,
  });

  assert.equal(resolution.completionKind, "complete");
  assert.equal(resolution.factors.journeyPreparation, 16);
  assert.ok(resolution.score >= resolution.difficulty);
  assert.deepEqual(resolution.resourceCost, { resourceId: "focus", amount: 1, paid: true });
  assert.deepEqual(resolution.riskPremium, { resourceId: "coin", amount: 1 });
});

test("risk terms expose required costs and differentiated server rewards before selection", () => {
  assert.deepEqual(journeyActionRiskTerms("low"), {});
  assert.deepEqual(journeyActionRiskTerms("medium"), {
    resourceCost: { resourceId: "focus", amount: 1 },
    successReward: { resourceId: "coin", amount: 1 },
    exceptionalSuccessReward: { resourceId: "coin", amount: 1 },
  });
  assert.deepEqual(journeyActionRiskTerms("high"), {
    resourceCost: { resourceId: "stamina", amount: 1 },
    successReward: { resourceId: "coin", amount: 2 },
    exceptionalSuccessReward: { resourceId: "coin", amount: 3 },
  });
  assert.equal(journeyRiskPremiumForOutcome("low", "success"), undefined);
  assert.deepEqual(journeyRiskPremiumForOutcome("medium", "success"), {
    resourceId: "coin",
    amount: 1,
  });
  assert.deepEqual(journeyRiskPremiumForOutcome("high", "success"), {
    resourceId: "coin",
    amount: 2,
  });
  assert.deepEqual(journeyRiskPremiumForOutcome("high", "exceptional_success"), {
    resourceId: "coin",
    amount: 3,
  });
  assert.equal(journeyRiskPremiumForOutcome("high", "failure"), undefined);
});

test("an unpaid medium or high risk cost is a hard server gate even when other factors are strong", () => {
  const resolution = resolveJourneyAction({
    ...baseInput,
    journeyPreparationScore: 16,
    identity: {
      lifetime: { max: 100, remaining: 100 },
      traits: ["沉着", "实验训练", "协作"],
      lifeGoal: {
        category: "learning",
        description: "掌握实验方法",
        motivation: "理解实验结果",
      },
    },
    resources: { focus: 20, aether: 20 },
    inventoryItems: [
      { itemId: "item_legendary_tool", rarity: "legendary", bound: true },
      { itemId: "item_rare_manual", rarity: "rare", bound: false },
    ],
    participantTargetCount: 2,
  });

  assert.ok(resolution.score >= resolution.difficulty);
  assert.equal(resolution.outcome, "failure");
  assert.equal(resolution.completionKind, "failed");
  assert.equal(resolution.gatingFailure, "required_resource_missing");
  assert.deepEqual(resolution.resourceCost, { resourceId: "stamina", amount: 1, paid: false });
  assert.equal(resolution.riskPremium, undefined);
});

test("a life goal bonus applies only when the current action matches that goal", () => {
  const aligned = resolveJourneyAction({
    ...baseInput,
    actionOptionId: "action_learning_aligned",
    actionLabel: "记录实验数据并分析样本",
    objectiveTitle: "完成实验研究",
    risk: "low",
    identity: {
      lifetime: { max: 100, remaining: 100 },
      traits: [],
      lifeGoal: {
        category: "learning",
        description: "系统掌握一门知识",
        motivation: "理解世界",
      },
    },
  });
  const unrelated = resolveJourneyAction({
    ...baseInput,
    actionOptionId: "action_learning_unrelated",
    actionLabel: "护送货箱穿过堤岸",
    objectiveTitle: "审慎核验结果",
    risk: "low",
    identity: {
      lifetime: { max: 100, remaining: 100 },
      traits: [],
      lifeGoal: {
        category: "learning",
        description: "系统掌握一门知识",
        motivation: "理解世界",
      },
    },
  });

  assert.equal(aligned.factors.goalAlignment, 6);
  assert.equal(unrelated.factors.goalAlignment, 0);
});

test("identity state, resources, equipment and scene support can clear a high-risk action", () => {
  const resolution = resolveJourneyAction({
    ...baseInput,
    identity: {
      lifetime: { max: 100, remaining: 100 },
      traits: ["沉着", "实验训练", "协作"],
    },
    resources: { focus: 20, stamina: 20, aether: 20 },
    attributes: { intellect: 3, willpower: 2, physique: 1 },
    inventoryItems: [
      { itemId: "item_legendary_tool", rarity: "legendary", bound: true },
      { itemId: "item_rare_manual", rarity: "rare", bound: false },
    ],
    participantTargetCount: 2,
  });

  assert.equal(resolution.completionKind, "complete");
  assert.ok(["success", "exceptional_success"].includes(resolution.outcome));
  assert.ok(resolution.score >= resolution.difficulty);
  assert.match(resolution.summary, /装置校准/u);
  assert.ok(resolution.factors.resources > 0);
  assert.equal(resolution.factors.attributes, 6);
  assert.ok(resolution.factors.equipment > 0);
  assert.ok(resolution.factors.sceneSupport > 0);
  assert.deepEqual(resolution.resourceCost, { resourceId: "stamina", amount: 1, paid: true });
  assert.deepEqual(resolution.riskPremium, {
    resourceId: "coin",
    amount: resolution.outcome === "exceptional_success" ? 3 : 2,
  });
});

test("every non-successful objective action resolves as failed", () => {
  const resolution = resolveJourneyAction({
    ...baseInput,
    risk: "medium",
    resources: {},
  });

  assert.equal(resolution.outcome, "failure");
  assert.equal(resolution.completionKind, "failed");
  assert.match(resolution.summary, /未完成/u);
});
