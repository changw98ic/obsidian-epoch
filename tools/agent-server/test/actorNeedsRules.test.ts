import assert from "node:assert/strict";
import test from "node:test";

import {
  EPOCH_ACTOR_NEED_KEYS,
  advanceActorNeeds,
  initialActorLifeGoal,
  initialActorNeeds,
  type EpochActorNeedLevels,
  type EpochActorNeedsState,
} from "../lib/epoch/actorNeedsRules.ts";

function zeroLevels(): EpochActorNeedLevels {
  return Object.fromEntries(EPOCH_ACTOR_NEED_KEYS.map((key) => [key, 0])) as unknown as EpochActorNeedLevels;
}

test("actor needs and life goals are deterministic server state", () => {
  const firstNeeds = initialActorNeeds("npc", "npc_researcher");
  const secondNeeds = initialActorNeeds("npc", "npc_researcher");
  assert.deepEqual(firstNeeds, secondNeeds);
  assert.equal(firstNeeds.actorKind, "npc");
  assert.equal(firstNeeds.recentActions.length, 0);
  assert.equal(firstNeeds.actionRemainderMinutes, 0);
  assert.ok(EPOCH_ACTOR_NEED_KEYS.every((key) => firstNeeds.levels[key] >= 800));

  const goal = initialActorLifeGoal({
    actorKind: "npc",
    actorId: "npc_researcher",
    descriptor: "量子实验室见习研究员",
    traits: ["记录", "校准"],
  });
  assert.equal(goal.category, "learning");
  assert.match(goal.description, /知识/u);
  assert.equal(goal.effortWorldMinutes, 0);
  assert.equal(goal.status, "active");
});

test("physiological urgency overrides downtime and is actually relieved", () => {
  const initial = initialActorNeeds("agent", "agent_thirsty");
  const current: EpochActorNeedsState = {
    ...initial,
    levels: { ...zeroLevels(), thirst: 9_000 },
  };
  const goal = initialActorLifeGoal({
    actorKind: "agent",
    actorId: current.actorId,
    descriptor: "商队会计",
  });
  const advanced = advanceActorNeeds({
    current,
    goal,
    elapsedWorldMinutes: 240,
    toWorldMinute: 240,
    downtimeMode: "training",
    sourceEventId: "event_clock_1",
  });
  assert.equal(advanced.needs.lastAction, "drink");
  assert.deepEqual(advanced.needs.recentActions, ["drink"]);
  assert.ok(advanced.needs.levels.thirst < current.levels.thirst);
  assert.equal(advanced.needs.lastWorldMinute, 240);
  assert.equal(advanced.needs.sourceEventId, "event_clock_1");
  assert.equal(advanced.goal.progressBps, 0);
});

test("needs simulation is invariant when the same game time is split across ticks", () => {
  const needs = initialActorNeeds("npc", "npc_partitioned_clock");
  const goal = initialActorLifeGoal({
    actorKind: "npc",
    actorId: needs.actorId,
    descriptor: "白塔学院研究学徒",
  });
  const oneAdvance = advanceActorNeeds({
    current: needs,
    goal,
    elapsedWorldMinutes: 1_440,
    toWorldMinute: 1_440,
    sourceEventId: "event_clock_full_day",
  });

  let partitioned = { needs, goal };
  for (let minute = 1; minute <= 1_440; minute += 1) {
    partitioned = advanceActorNeeds({
      current: partitioned.needs,
      goal: partitioned.goal,
      elapsedWorldMinutes: 1,
      toWorldMinute: minute,
      sourceEventId: `event_clock_${minute}`,
    });
  }
  assert.deepEqual(partitioned.needs.levels, oneAdvance.needs.levels);
  assert.deepEqual(partitioned.needs.needIncreaseRemainders, oneAdvance.needs.needIncreaseRemainders);
  assert.deepEqual(partitioned.needs.recentActions, oneAdvance.needs.recentActions);
  assert.equal(partitioned.needs.lastAction, oneAdvance.needs.lastAction);
  assert.equal(partitioned.needs.actionRemainderMinutes, oneAdvance.needs.actionRemainderMinutes);
  assert.equal(partitioned.goal.effortWorldMinutes, oneAdvance.goal.effortWorldMinutes);
  assert.equal(partitioned.goal.progressBps, oneAdvance.goal.progressBps);
  assert.ok(oneAdvance.goal.progressBps > 0);
});

test("downtime guides behavior only after immediate needs are safe", () => {
  const base = initialActorNeeds("agent", "agent_resting", 600);
  const needs: EpochActorNeedsState = { ...base, levels: zeroLevels() };
  const goal = initialActorLifeGoal({
    actorKind: "agent",
    actorId: needs.actorId,
    descriptor: "外勤勘探员",
    worldMinute: 600,
  });
  const advanced = advanceActorNeeds({
    current: needs,
    goal,
    elapsedWorldMinutes: 240,
    toWorldMinute: 840,
    downtimeMode: "resting",
    sourceEventId: "event_clock_rest",
  });
  assert.equal(advanced.needs.lastAction, "sleep");
  assert.equal(advanced.goal.category, "exploration");
  assert.equal(advanced.goal.progressBps, 0);
});
