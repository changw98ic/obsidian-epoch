import assert from "node:assert/strict";
import test from "node:test";

import {
  PHASE6_AUTHORITATIVE_SCENARIOS,
  PHASE6_MATRIX_VERSION,
  assertPhase6ScenarioBinding,
  phase6ScenarioForRun,
} from "../lib/epoch/phase6ScenarioMatrixRules.ts";
import { journeyFallbackRiskForScenario } from "../lib/epoch/journeyGeneratedTaskRules.ts";

test("Phase 6 scenario matrix binds ten unique server scenarios", () => {
  assert.equal(PHASE6_AUTHORITATIVE_SCENARIOS.length, 10);
  assert.deepEqual(PHASE6_AUTHORITATIVE_SCENARIOS.map((entry) => entry.runIndex), [1,2,3,4,5,6,7,8,9,10]);
  assert.equal(new Set(PHASE6_AUTHORITATIVE_SCENARIOS.map((entry) => entry.tag)).size, 10);
  assert.equal(new Set(PHASE6_AUTHORITATIVE_SCENARIOS.map((entry) => entry.taskFamilyId)).size, 10);
  for (const scenario of PHASE6_AUTHORITATIVE_SCENARIOS) {
    assert.equal(phase6ScenarioForRun(scenario.runIndex), scenario);
    assert.equal(assertPhase6ScenarioBinding(scenario.runIndex, scenario.tag, scenario.taskFamilyId), scenario);
  }
});

test("Phase 6 scenario matrix has v3 matrix version", () => {
  assert.equal(PHASE6_MATRIX_VERSION, "phase6-matrix-v3");
  for (const scenario of PHASE6_AUTHORITATIVE_SCENARIOS) {
    assert.ok(scenario.taskFamilyId.length > 0, `runIndex ${scenario.runIndex} must have taskFamilyId`);
    assert.ok(["catalog", "server_ai", "region_pool"].includes(scenario.offerSource), `runIndex ${scenario.runIndex} has invalid offerSource`);
    assert.ok(["logistics", "combat", "support", "cunning", "exploration"].includes(scenario.strategySnapshotHint), `runIndex ${scenario.runIndex} has invalid strategySnapshotHint`);
  }
});

test("Phase 6 scenario binding rejects client-selected tags and task family ids", () => {
  assert.throws(() => assertPhase6ScenarioBinding(1, "high-prepared-priority", "resource_acquisition"), /phase6_scenario_tag_mismatch/);
  assert.throws(() => assertPhase6ScenarioBinding(1, "low-prepared-resource", "crisis_retreat"), /phase6_scenario_task_family_mismatch/);
  assert.throws(() => phase6ScenarioForRun(11), /phase6_scenario_run_index_invalid/);
});

test("Phase 6 scenario binding accepts matching taskFamilyId", () => {
  // Should not throw when taskFamilyId matches
  assert.doesNotThrow(() => assertPhase6ScenarioBinding(1, "low-prepared-resource", "resource_acquisition"));
  assert.doesNotThrow(() => assertPhase6ScenarioBinding(6, "high-prepared-priority", "priority_commission"));
});

test("Phase 6 fallback risk policy creates distinct low medium high and dynamic choices", () => {
  const base = { objectiveKind: "main" as const, objectiveSequence: 2, actionIndex: 0, baseRisk: "low" as const };
  assert.equal(journeyFallbackRiskForScenario({ ...base, profile: "low" }), "low");
  assert.equal(journeyFallbackRiskForScenario({ ...base, profile: "medium" }), "medium");
  assert.equal(journeyFallbackRiskForScenario({ ...base, profile: "high" }), "high");
  assert.equal(journeyFallbackRiskForScenario({ ...base, profile: "dynamic" }), "high");
  assert.equal(journeyFallbackRiskForScenario({ ...base, profile: "high", actionIndex: 1 }), "medium");
});
