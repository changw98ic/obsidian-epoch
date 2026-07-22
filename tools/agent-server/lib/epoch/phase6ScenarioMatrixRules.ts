export const PHASE6_AUTHORITATIVE_SCENARIO_MATRIX = {
  id: "obsidian_epoch.phase6.authoritative_scenario_matrix",
  version: "obsidian-epoch-phase6-scenario-matrix-v0.2.0",
} as const;

export type Phase6ScenarioIntensity = "low" | "medium" | "high" | "dynamic";
export type Phase6ScenarioPreparedness = "prepared" | "underprepared" | "borderline" | "mismatched" | "specialist" | "mixed";

export interface Phase6AuthoritativeScenario {
  readonly runIndex: number;
  readonly tag: string;
  readonly intensity: Phase6ScenarioIntensity;
  readonly preparedness: Phase6ScenarioPreparedness;
  readonly taskType: string;
  readonly primaryObjective: string;
  readonly coverage: readonly string[];
}

export const PHASE6_AUTHORITATIVE_SCENARIOS = [
  { runIndex: 1, tag: "low-prepared-resource", intensity: "low", preparedness: "prepared", taskType: "resource_acquisition", primaryObjective: "resource_acquisition", coverage: ["warehouse_inflow"] },
  { runIndex: 2, tag: "low-underprepared-information", intensity: "low", preparedness: "underprepared", taskType: "information_acquisition", primaryObjective: "information_acquisition", coverage: ["conservative_withdrawal"] },
  { runIndex: 3, tag: "medium-prepared-tactical", intensity: "medium", preparedness: "prepared", taskType: "tactical_objective", primaryObjective: "tactical_objective", coverage: ["skill_and_consumable_use"] },
  { runIndex: 4, tag: "medium-borderline-escort", intensity: "medium", preparedness: "borderline", taskType: "escort_and_protection", primaryObjective: "escort_and_protection", coverage: ["stress_and_route_choice"] },
  { runIndex: 5, tag: "medium-mismatched-preserve", intensity: "medium", preparedness: "mismatched", taskType: "resource_preservation", primaryObjective: "resource_preservation", coverage: ["suitability_penalty"] },
  { runIndex: 6, tag: "high-prepared-high-value", intensity: "high", preparedness: "prepared", taskType: "high_value_objective", primaryObjective: "high_value_objective", coverage: ["high_risk_high_cost_success"] },
  { runIndex: 7, tag: "high-underprepared-evacuation", intensity: "high", preparedness: "underprepared", taskType: "survival_evacuation", primaryObjective: "survival_evacuation", coverage: ["failure_injury_insurance"] },
  { runIndex: 8, tag: "medium-prepared-cultivation", intensity: "medium", preparedness: "prepared", taskType: "cultivation_material", primaryObjective: "cultivation_material", coverage: ["cultivation_progress_or_reason"] },
  { runIndex: 9, tag: "medium-specialist-crafting", intensity: "medium", preparedness: "specialist", taskType: "crafting_material", primaryObjective: "crafting_material", coverage: ["forging_or_tailoring_input"] },
  { runIndex: 10, tag: "dynamic-mixed-repeat", intensity: "dynamic", preparedness: "mixed", taskType: "repeated_route_audit", primaryObjective: "repeated_route_audit", coverage: ["world_memory_rag_dedup_antifarm"] },
] as const satisfies readonly Phase6AuthoritativeScenario[];

export function phase6ScenarioForRun(runIndex: number): Phase6AuthoritativeScenario {
  const scenario = PHASE6_AUTHORITATIVE_SCENARIOS.find((entry) => entry.runIndex === runIndex);
  if (!scenario) throw new Error("phase6_scenario_run_index_invalid");
  return scenario;
}

export function assertPhase6ScenarioBinding(runIndex: number, scenarioTag: string, taskType?: string): Phase6AuthoritativeScenario {
  const scenario = phase6ScenarioForRun(runIndex);
  if (scenarioTag !== scenario.tag) throw new Error("phase6_scenario_tag_mismatch");
  if (taskType !== undefined && taskType !== scenario.taskType) throw new Error("phase6_scenario_task_type_mismatch");
  return scenario;
}
