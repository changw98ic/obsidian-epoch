import {
  phase6ScenarioForRun,
  type Phase6AuthoritativeScenario,
} from "./phase6ScenarioMatrixRules.ts";

export type Phase6RunnerActionStrategy =
  | "primary_objective"
  | "lowest_risk_objective"
  | "highest_risk_objective"
  | "safe_fallback";

export interface Phase6RunnerActionOption {
  readonly actionOptionId: string;
  readonly optionKey?: string;
  readonly risk?: "low" | "medium" | "high";
  readonly decisionEffect?: string;
}

export interface Phase6RunnerActionSelection {
  readonly action: Phase6RunnerActionOption;
  readonly strategy: Phase6RunnerActionStrategy;
  readonly scenarioTag: string;
}

const RISK_ORDER: Readonly<Record<NonNullable<Phase6RunnerActionOption["risk"]>, number>> = {
  low: 0,
  medium: 1,
  high: 2,
};

/**
 * The smoke-run policy realizes the coverage promised by the authoritative
 * scenario matrix.  It is deliberately driven by scenario coverage, not by
 * observed roll results or final score.  This keeps the run evidence useful:
 * the explicitly conservative scenario exercises the signed safe-exit route;
 * the borderline companion run reaches its route-choice evidence; and the
 * underprepared crisis attempts its high-risk signed action so the failure
 * path is observed rather than silently converted into a withdrawal.
 */
export function phase6RunnerActionStrategyForRun(runIndex: number): Phase6RunnerActionStrategy {
  return phase6RunnerActionStrategyForScenario(phase6ScenarioForRun(runIndex));
}

export function phase6RunnerActionStrategyForScenario(
  scenario: Phase6AuthoritativeScenario,
): Phase6RunnerActionStrategy {
  if (scenario.coverage.includes("conservative_withdrawal")) {
    return "safe_fallback";
  }
  if (scenario.coverage.includes("failure_injury_insurance")) {
    return "highest_risk_objective";
  }
  if (scenario.coverage.includes("high_risk_high_cost_success")) {
    return "highest_risk_objective";
  }
  if (scenario.coverage.includes("cultivation_progress_or_reason")
    || scenario.coverage.includes("forging_or_tailoring_input")) {
    return "lowest_risk_objective";
  }
  return "primary_objective";
}

export function selectPhase6RunnerAction(
  runIndex: number,
  actionOptions: readonly Phase6RunnerActionOption[],
  safeFallbackActionOptionId?: string,
): Phase6RunnerActionSelection {
  if (actionOptions.length === 0) {
    throw new Error("phase6_runner_action_options_missing");
  }
  const strategy = phase6RunnerActionStrategyForRun(runIndex);
  const fallback = safeFallbackActionOptionId
    ? actionOptions.find((option) => option.actionOptionId === safeFallbackActionOptionId)
    : undefined;
  // Generated task contracts historically point safeFallbackActionOptionId at
  // their first ordinary objective action.  Removing that action from every
  // non-recall strategy silently steers the runner toward a riskier alternate
  // route.  Keep all signed options eligible here; actual safe recall is
  // handled by the owner-authorized recall_journey path in the live runner.
  const candidates = actionOptions;

  if (strategy === "safe_fallback") {
    if (!fallback) {
      throw new Error("phase6_runner_safe_fallback_missing");
    }
    return { action: fallback, strategy, scenarioTag: phase6ScenarioForRun(runIndex).tag };
  }

  if (strategy === "lowest_risk_objective") {
    return {
      action: selectByRisk(candidates, "lowest"),
      strategy,
      scenarioTag: phase6ScenarioForRun(runIndex).tag,
    };
  }
  if (strategy === "highest_risk_objective") {
    return {
      action: selectByRisk(candidates, "highest"),
      strategy,
      scenarioTag: phase6ScenarioForRun(runIndex).tag,
    };
  }

  const primary = candidates.find((option) => option.decisionEffect === "attempt_objective")
    ?? candidates[0];
  return { action: primary, strategy, scenarioTag: phase6ScenarioForRun(runIndex).tag };
}

function selectByRisk(
  candidates: readonly Phase6RunnerActionOption[],
  direction: "lowest" | "highest",
): Phase6RunnerActionOption {
  return [...candidates].sort((left, right) => {
    const delta = riskRank(left.risk) - riskRank(right.risk);
    return direction === "lowest" ? delta : -delta;
  })[0];
}

function riskRank(risk: Phase6RunnerActionOption["risk"]): number {
  return risk ? RISK_ORDER[risk] : RISK_ORDER.medium;
}
