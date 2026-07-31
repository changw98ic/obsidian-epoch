export const PHASE6_MATRIX_VERSION = "phase6-matrix-v4" as const;
export const PHASE6_SCENARIO_READINESS_RULE_VERSION = "phase6-scenario-readiness.v1" as const;

export const PHASE6_AUTHORITATIVE_SCENARIO_MATRIX = {
  id: "obsidian_epoch.phase6.authoritative_scenario_matrix",
  version: "obsidian-epoch-phase6-scenario-matrix-v0.3.0",
  matrixVersion: PHASE6_MATRIX_VERSION,
} as const;

export type Phase6ScenarioIntensity = "low" | "medium" | "high" | "dynamic";
export type Phase6ScenarioPreparedness = "prepared" | "underprepared" | "borderline" | "mismatched" | "specialist" | "mixed";
export type Phase6OfferSource = "catalog" | "server_ai" | "region_pool";
export type Phase6StrategySnapshotHint = "logistics" | "combat" | "support" | "cunning" | "exploration";

export interface Phase6AuthoritativeScenario {
  readonly runIndex: number;
  readonly tag: string;
  readonly intensity: Phase6ScenarioIntensity;
  readonly preparedness: Phase6ScenarioPreparedness;
  readonly taskFamilyId: string;
  readonly offerSource: Phase6OfferSource;
  readonly strategySnapshotHint: Phase6StrategySnapshotHint;
  readonly primaryObjective: string;
  readonly coverage: readonly string[];
}

/**
 * A server-issued preflight readiness record for a single Phase 6 scenario.
 *
 * The score deliberately uses the same 0..16 scale as ordinary completed
 * journey preparation.  It is not client input and is later embedded in the
 * signed, persisted scene contract so action settlement can audit exactly why
 * a prepared scenario was treated as prepared.
 */
export interface Phase6ScenarioReadiness {
  readonly authority: "phase6_authoritative_matrix";
  readonly ruleVersion: typeof PHASE6_SCENARIO_READINESS_RULE_VERSION;
  readonly runIndex: number;
  readonly scenarioTag: string;
  readonly preparedness: Phase6ScenarioPreparedness;
  readonly journeyPreparationScore: number;
}

const PHASE6_PREPARATION_SCORE_BY_STATE: Readonly<Record<Phase6ScenarioPreparedness, number>> = {
  prepared: 12,
  specialist: 10,
  mixed: 6,
  borderline: 4,
  mismatched: 0,
  underprepared: 0,
};

export const PHASE6_AUTHORITATIVE_SCENARIOS = [
  { runIndex: 1, tag: "low-prepared-resource", intensity: "low", preparedness: "prepared", taskFamilyId: "resource_acquisition", offerSource: "catalog", strategySnapshotHint: "logistics", primaryObjective: "resource_acquisition", coverage: ["warehouse_inflow"] },
  { runIndex: 2, tag: "low-underprepared-information", intensity: "low", preparedness: "underprepared", taskFamilyId: "information_acquisition", offerSource: "region_pool", strategySnapshotHint: "cunning", primaryObjective: "information_acquisition", coverage: ["conservative_withdrawal"] },
  { runIndex: 3, tag: "medium-prepared-structured", intensity: "medium", preparedness: "prepared", taskFamilyId: "structured_challenge", offerSource: "server_ai", strategySnapshotHint: "combat", primaryObjective: "structured_challenge", coverage: ["skill_and_consumable_use"] },
  { runIndex: 4, tag: "medium-borderline-companion", intensity: "medium", preparedness: "borderline", taskFamilyId: "companion_support", offerSource: "catalog", strategySnapshotHint: "support", primaryObjective: "companion_support", coverage: ["stress_and_route_choice"] },
  { runIndex: 5, tag: "medium-mismatched-preserve", intensity: "medium", preparedness: "mismatched", taskFamilyId: "resource_preservation", offerSource: "region_pool", strategySnapshotHint: "logistics", primaryObjective: "resource_preservation", coverage: ["suitability_penalty"] },
  { runIndex: 6, tag: "high-prepared-priority", intensity: "high", preparedness: "prepared", taskFamilyId: "priority_commission", offerSource: "server_ai", strategySnapshotHint: "combat", primaryObjective: "priority_commission", coverage: ["high_risk_high_cost_success"] },
  { runIndex: 7, tag: "high-underprepared-crisis", intensity: "high", preparedness: "underprepared", taskFamilyId: "crisis_retreat", offerSource: "catalog", strategySnapshotHint: "cunning", primaryObjective: "crisis_retreat", coverage: ["failure_injury_insurance"] },
  { runIndex: 8, tag: "medium-prepared-cultivation", intensity: "medium", preparedness: "prepared", taskFamilyId: "cultivation_material", offerSource: "server_ai", strategySnapshotHint: "exploration", primaryObjective: "cultivation_material", coverage: ["cultivation_progress_or_reason"] },
  { runIndex: 9, tag: "medium-specialist-crafting", intensity: "medium", preparedness: "specialist", taskFamilyId: "crafting_material", offerSource: "region_pool", strategySnapshotHint: "logistics", primaryObjective: "crafting_material", coverage: ["forging_or_tailoring_input"] },
  { runIndex: 10, tag: "dynamic-mixed-repeat", intensity: "dynamic", preparedness: "mixed", taskFamilyId: "repeated_route_audit", offerSource: "catalog", strategySnapshotHint: "exploration", primaryObjective: "repeated_route_audit", coverage: ["world_memory_rag_dedup_antifarm"] },
] as const satisfies readonly Phase6AuthoritativeScenario[];

export function phase6ScenarioForRun(runIndex: number): Phase6AuthoritativeScenario {
  const scenario = PHASE6_AUTHORITATIVE_SCENARIOS.find((entry) => entry.runIndex === runIndex);
  if (!scenario) throw new Error("phase6_scenario_run_index_invalid");
  return scenario;
}

/**
 * Builds the only allowed readiness value for a Phase 6 run.  Callers pass
 * the server-issued run index and tag; the score itself is never accepted
 * from a request.
 */
export function phase6ScenarioReadinessForRun(
  runIndex: number,
  scenarioTag?: string,
): Phase6ScenarioReadiness {
  const scenario = phase6ScenarioForRun(runIndex);
  if (scenarioTag !== undefined && scenarioTag !== scenario.tag) {
    throw new Error("phase6_scenario_readiness_tag_mismatch");
  }
  return {
    authority: "phase6_authoritative_matrix",
    ruleVersion: PHASE6_SCENARIO_READINESS_RULE_VERSION,
    runIndex: scenario.runIndex,
    scenarioTag: scenario.tag,
    preparedness: scenario.preparedness,
    journeyPreparationScore: PHASE6_PREPARATION_SCORE_BY_STATE[scenario.preparedness],
  };
}

/** Assert the complete scenario binding against the authoritative matrix. */
export function assertPhase6ScenarioBinding(
  runIndex: number,
  scenarioTag: string,
  taskFamilyId: string,
): Phase6AuthoritativeScenario {
  const scenario = phase6ScenarioForRun(runIndex);
  if (scenarioTag !== scenario.tag) throw new Error("phase6_scenario_tag_mismatch");
  if (!taskFamilyId || taskFamilyId !== scenario.taskFamilyId) {
    throw new Error("phase6_scenario_task_family_mismatch");
  }
  return scenario;
}
