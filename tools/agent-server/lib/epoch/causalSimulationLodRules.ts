export type CausalSimulationLod = 0 | 1 | 2 | 3;

export interface CausalSimulationLodLevel {
  readonly id: CausalSimulationLod;
  readonly label: string;
  readonly tickIntervalWorldMinutes: number;
  readonly models: readonly string[];
}

export interface CausalSimulationLodPromotionConfig {
  readonly playerProximity: boolean;
  readonly criticalPressureSeverity: number;
  readonly irreversibleEvent: boolean;
  readonly activeCommitmentDueWithinWorldMinutes: number;
}

export interface CausalSimulationLodDemotionConfig {
  readonly minimumQuietWorldMinutes: number;
  readonly maximumActivePressureSeverity: number;
  readonly preserve: readonly CausalSimulationPreservedStateKind[];
}

export interface CausalSimulationLodConfig {
  readonly levels: readonly CausalSimulationLodLevel[];
  readonly promotion: CausalSimulationLodPromotionConfig;
  readonly demotion: CausalSimulationLodDemotionConfig;
}

export type CausalSimulationPreservedStateKind =
  | "commitments"
  | "debts"
  | "injuries"
  | "ownership"
  | "relationships"
  | "key_beliefs"
  | "open_cases";

export interface CausalSimulationLodSubjectState {
  readonly subjectRef: string;
  readonly simulationLod: CausalSimulationLod;
  readonly lastInteractionWorldMinute?: number;
  readonly lastChangedWorldMinute?: number;
  readonly activePressureSeverity: number;
  readonly playerProximity: boolean;
  readonly hasIrreversibleEvent: boolean;
  readonly nextCommitmentDueAtWorldMinute?: number;
  readonly commitments: readonly string[];
  readonly debts: readonly string[];
  readonly injuries: readonly string[];
  readonly ownership: readonly string[];
  readonly relationships: readonly string[];
  readonly keyBeliefs: readonly string[];
  readonly openCases: readonly string[];
}

export interface CausalSimulationLodDecisionInput {
  readonly subject: CausalSimulationLodSubjectState;
  readonly currentWorldMinute: number;
  readonly config?: Partial<CausalSimulationLodConfig>;
}

export interface CausalSimulationLodDecision {
  readonly subjectRef: string;
  readonly fromLod: CausalSimulationLod;
  readonly toLod: CausalSimulationLod;
  readonly tickIntervalWorldMinutes: number;
  readonly action: "promote" | "demote" | "hold";
  readonly reasons: readonly string[];
  readonly preservedState: CausalSimulationPreservedState;
}

export interface CausalSimulationPreservedState {
  readonly commitments: readonly string[];
  readonly debts: readonly string[];
  readonly injuries: readonly string[];
  readonly ownership: readonly string[];
  readonly relationships: readonly string[];
  readonly keyBeliefs: readonly string[];
  readonly openCases: readonly string[];
}

export const DEFAULT_CAUSAL_SIMULATION_LOD_CONFIG: CausalSimulationLodConfig = {
  levels: [
    {
      id: 0,
      label: "aggregate",
      tickIntervalWorldMinutes: 1440,
      models: [
        "population_stock_flow",
        "ecology_stock_flow",
        "regional_supply_demand",
        "background_faction_pressure",
      ],
    },
    {
      id: 1,
      label: "named_background",
      tickIntervalWorldMinutes: 360,
      models: [
        "needs",
        "commitments",
        "goal_selection",
        "coarse_action_resolution",
      ],
    },
    {
      id: 2,
      label: "important_active",
      tickIntervalWorldMinutes: 60,
      models: [
        "belief_updates",
        "plans",
        "resource_reservations",
        "institutional_actions",
      ],
    },
    {
      id: 3,
      label: "present_or_journey",
      tickIntervalWorldMinutes: 5,
      models: [
        "fine_actions",
        "dialogue",
        "combat",
        "immediate_observations",
      ],
    },
  ],
  promotion: {
    playerProximity: true,
    criticalPressureSeverity: 75,
    irreversibleEvent: true,
    activeCommitmentDueWithinWorldMinutes: 1440,
  },
  demotion: {
    minimumQuietWorldMinutes: 10080,
    maximumActivePressureSeverity: 29,
    preserve: [
      "commitments",
      "debts",
      "injuries",
      "ownership",
      "relationships",
      "key_beliefs",
      "open_cases",
    ],
  },
};

function clampLod(value: number): CausalSimulationLod {
  if (value <= 0) return 0;
  if (value === 1) return 1;
  if (value === 2) return 2;
  return 3;
}

function finiteMinute(value: number | undefined, fallback: number): number {
  const next = Math.floor(Number(value));
  return Number.isFinite(next) ? next : fallback;
}

function uniqueSorted(values: readonly string[]): readonly string[] {
  return values
    .map((value) => value.trim())
    .filter((value, index, allValues) => value.length > 0 && allValues.indexOf(value) === index)
    .sort((left, right) => left.localeCompare(right));
}

export function causalSimulationLodConfig(
  input?: Partial<CausalSimulationLodConfig>,
): CausalSimulationLodConfig {
  return {
    levels: input?.levels?.length ? input.levels : DEFAULT_CAUSAL_SIMULATION_LOD_CONFIG.levels,
    promotion: {
      ...DEFAULT_CAUSAL_SIMULATION_LOD_CONFIG.promotion,
      ...(input?.promotion || {}),
    },
    demotion: {
      ...DEFAULT_CAUSAL_SIMULATION_LOD_CONFIG.demotion,
      ...(input?.demotion || {}),
      preserve: input?.demotion?.preserve || DEFAULT_CAUSAL_SIMULATION_LOD_CONFIG.demotion.preserve,
    },
  };
}

export function causalSimulationLodLevel(
  lod: CausalSimulationLod,
  configInput?: Partial<CausalSimulationLodConfig>,
): CausalSimulationLodLevel {
  const config = causalSimulationLodConfig(configInput);
  const level = config.levels.find((candidate) => candidate.id === lod);
  if (!level) throw new Error("causal_simulation_lod_level_missing");
  return level;
}

export function causalSimulationLodTickIntervalWorldMinutes(
  lod: CausalSimulationLod,
  configInput?: Partial<CausalSimulationLodConfig>,
): number {
  return causalSimulationLodLevel(lod, configInput).tickIntervalWorldMinutes;
}

export function preservedCausalSimulationState(
  subject: Pick<
    CausalSimulationLodSubjectState,
    "commitments" | "debts" | "injuries" | "ownership" | "relationships" | "keyBeliefs" | "openCases"
  >,
  preserveKinds: readonly CausalSimulationPreservedStateKind[] = DEFAULT_CAUSAL_SIMULATION_LOD_CONFIG.demotion.preserve,
): CausalSimulationPreservedState {
  const shouldPreserve = new Set(preserveKinds);
  return {
    commitments: shouldPreserve.has("commitments") ? uniqueSorted(subject.commitments) : [],
    debts: shouldPreserve.has("debts") ? uniqueSorted(subject.debts) : [],
    injuries: shouldPreserve.has("injuries") ? uniqueSorted(subject.injuries) : [],
    ownership: shouldPreserve.has("ownership") ? uniqueSorted(subject.ownership) : [],
    relationships: shouldPreserve.has("relationships") ? uniqueSorted(subject.relationships) : [],
    keyBeliefs: shouldPreserve.has("key_beliefs") ? uniqueSorted(subject.keyBeliefs) : [],
    openCases: shouldPreserve.has("open_cases") ? uniqueSorted(subject.openCases) : [],
  };
}

export function causalSimulationPromotionReasons(input: CausalSimulationLodDecisionInput): readonly string[] {
  const { subject } = input;
  const config = causalSimulationLodConfig(input.config);
  const reasons: string[] = [];
  if (config.promotion.playerProximity && subject.playerProximity) reasons.push("player_proximity");
  if (subject.activePressureSeverity >= config.promotion.criticalPressureSeverity) reasons.push("critical_pressure");
  if (config.promotion.irreversibleEvent && subject.hasIrreversibleEvent) reasons.push("irreversible_event");
  if (
    subject.nextCommitmentDueAtWorldMinute !== undefined
    && subject.nextCommitmentDueAtWorldMinute - input.currentWorldMinute
      <= config.promotion.activeCommitmentDueWithinWorldMinutes
  ) {
    reasons.push("commitment_due");
  }
  return reasons.sort((left, right) => left.localeCompare(right));
}

export function causalSimulationDemotionReasons(input: CausalSimulationLodDecisionInput): readonly string[] {
  const { subject } = input;
  const config = causalSimulationLodConfig(input.config);
  const lastActiveMinute = Math.max(
    finiteMinute(subject.lastInteractionWorldMinute, 0),
    finiteMinute(subject.lastChangedWorldMinute, 0),
  );
  const quietWorldMinutes = Math.max(0, input.currentWorldMinute - lastActiveMinute);
  const reasons: string[] = [];
  if (quietWorldMinutes >= config.demotion.minimumQuietWorldMinutes) reasons.push("quiet_long_enough");
  if (subject.activePressureSeverity <= config.demotion.maximumActivePressureSeverity) reasons.push("low_pressure");
  if (!subject.playerProximity) reasons.push("not_player_proximate");
  if (!subject.hasIrreversibleEvent) reasons.push("no_irreversible_event");
  return reasons.sort((left, right) => left.localeCompare(right));
}

export function nextCausalSimulationLodDecision(
  input: CausalSimulationLodDecisionInput,
): CausalSimulationLodDecision {
  const { subject } = input;
  const config = causalSimulationLodConfig(input.config);
  const promotionReasons = causalSimulationPromotionReasons({ ...input, config });
  const demotionReasons = causalSimulationDemotionReasons({ ...input, config });
  const fromLod = clampLod(subject.simulationLod);
  let toLod = fromLod;
  let action: CausalSimulationLodDecision["action"] = "hold";
  let reasons: readonly string[] = [];

  if (promotionReasons.length > 0 && fromLod < 3) {
    toLod = clampLod(fromLod + 1);
    action = "promote";
    reasons = promotionReasons;
  } else if (
    fromLod > 0
    && demotionReasons.includes("quiet_long_enough")
    && demotionReasons.includes("low_pressure")
    && demotionReasons.includes("not_player_proximate")
  ) {
    toLod = clampLod(fromLod - 1);
    action = "demote";
    reasons = demotionReasons;
  }

  return {
    subjectRef: subject.subjectRef,
    fromLod,
    toLod,
    tickIntervalWorldMinutes: causalSimulationLodTickIntervalWorldMinutes(toLod, config),
    action,
    reasons,
    preservedState: preservedCausalSimulationState(subject, config.demotion.preserve),
  };
}

export function shouldRunCausalSimulationLodTick(
  lod: CausalSimulationLod,
  lastTickWorldMinute: number | undefined,
  currentWorldMinute: number,
  configInput?: Partial<CausalSimulationLodConfig>,
): boolean {
  if (lastTickWorldMinute === undefined) return true;
  return currentWorldMinute - lastTickWorldMinute >= causalSimulationLodTickIntervalWorldMinutes(lod, configInput);
}
