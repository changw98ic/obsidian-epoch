import assert from "node:assert/strict";
import test from "node:test";

import {
  phase6RunnerActionStrategyForRun,
  selectPhase6RunnerAction,
} from "../lib/epoch/phase6RunActionPolicy.ts";

const actions = [
  { actionOptionId: "primary", risk: "medium" as const, decisionEffect: "attempt_objective" },
  { actionOptionId: "safe-objective", risk: "low" as const, decisionEffect: "attempt_objective" },
  { actionOptionId: "fallback", risk: "low" as const, decisionEffect: "withdraw" },
  { actionOptionId: "high-objective", risk: "high" as const, decisionEffect: "attempt_objective" },
] as const;

test("Phase 6 action policy is derived from fixed scenario coverage", () => {
  assert.equal(phase6RunnerActionStrategyForRun(1), "primary_objective");
  assert.equal(phase6RunnerActionStrategyForRun(2), "safe_fallback");
  assert.equal(phase6RunnerActionStrategyForRun(4), "primary_objective");
  assert.equal(phase6RunnerActionStrategyForRun(6), "highest_risk_objective");
  assert.equal(phase6RunnerActionStrategyForRun(7), "highest_risk_objective");
  assert.equal(phase6RunnerActionStrategyForRun(8), "lowest_risk_objective");
});

test("Phase 6 action policy uses only server-signed options and fallback binding", () => {
  assert.equal(selectPhase6RunnerAction(1, actions, "fallback").action.actionOptionId, "primary");
  assert.equal(selectPhase6RunnerAction(2, actions, "fallback").action.actionOptionId, "fallback");
  assert.equal(selectPhase6RunnerAction(4, actions, "fallback").action.actionOptionId, "primary");
  assert.equal(selectPhase6RunnerAction(6, actions, "fallback").action.actionOptionId, "high-objective");
  assert.equal(selectPhase6RunnerAction(7, actions, "fallback").action.actionOptionId, "high-objective");
  assert.equal(selectPhase6RunnerAction(8, actions, "fallback").action.actionOptionId, "safe-objective");
  assert.throws(() => selectPhase6RunnerAction(2, actions, "missing"), /phase6_runner_safe_fallback_missing/);
});

test("ordinary first actions remain eligible when legacy contracts label them as a fallback", () => {
  const ordinaryContract = [
    { actionOptionId: "ordinary-primary", risk: "medium" as const, decisionEffect: "attempt_objective" },
    { actionOptionId: "risky-alternate", risk: "high" as const, decisionEffect: "attempt_objective" },
  ] as const;
  assert.equal(
    selectPhase6RunnerAction(1, ordinaryContract, "ordinary-primary").action.actionOptionId,
    "ordinary-primary",
  );
});
