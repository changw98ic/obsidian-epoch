/**
 * PR11: Fixed-seed behavior distributions per strategy for balance simulation.
 * Each strategy maps to approach tags, completion rates, loss magnitudes,
 * collateral event distributions, and roleplay deviation probabilities.
 *
 * All values are deterministic constants (no RNG at runtime).
 * Distributions are drawn from a seeded PRNG at simulation time.
 */

export const STRATEGIES = [
  "combat",
  "cunning",
  "support",
  "logistics",
  "exploration",
] as const;

export type Strategy = (typeof STRATEGIES)[number];

export interface StrategyBehaviorDistribution {
  readonly strategy: Strategy;
  readonly primaryApproachTag: string;
  readonly mainCompletionRange: readonly [number, number]; // 0.0–1.0
  readonly sideCompletionRange: readonly [number, number];
  readonly hiddenCompletionRange: readonly [number, number];
  readonly selfLossResourceRange: readonly [number, number]; // resource units
  readonly selfLossLifetimeRange: readonly [number, number]; // lifetime delta (negative)
  readonly collateralWeights: Readonly<Record<string, number>>; // effectKind -> bps weight
  readonly roleplayDeviationDistribution: Readonly<Record<string, number>>; // classification -> probability
}

export const STRATEGY_DISTRIBUTIONS: readonly StrategyBehaviorDistribution[] = [
  {
    strategy: "combat",
    primaryApproachTag: "combat",
    mainCompletionRange: [0.5, 0.95],
    sideCompletionRange: [0.3, 0.7],
    hiddenCompletionRange: [0.2, 0.5],
    selfLossResourceRange: [5, 10],
    selfLossLifetimeRange: [-8, -3],
    collateralWeights: {
      object_destroy: -300,
      hidden_prerequisite_destroyed: -1500,
      region_influence_delta: 20,
      faction_standing_delta: -40,
    },
    roleplayDeviationDistribution: {
      aligned: 0.6,
      minor_deviation: 0.25,
      major_deviation: 0.1,
      forbidden_action: 0.05,
    },
  },
  {
    strategy: "cunning",
    primaryApproachTag: "stealth",
    mainCompletionRange: [0.6, 0.9],
    sideCompletionRange: [0.5, 0.8],
    hiddenCompletionRange: [0.4, 0.7],
    selfLossResourceRange: [1, 4],
    selfLossLifetimeRange: [-3, 0],
    collateralWeights: {
      trace_created: -100,
      npc_relationship_delta: 60,
      region_influence_delta: 30,
    },
    roleplayDeviationDistribution: {
      aligned: 0.7,
      minor_deviation: 0.2,
      major_deviation: 0.07,
      forbidden_action: 0.03,
    },
  },
  {
    strategy: "support",
    primaryApproachTag: "support",
    mainCompletionRange: [0.65, 0.9],
    sideCompletionRange: [0.4, 0.7],
    hiddenCompletionRange: [0.3, 0.6],
    selfLossResourceRange: [2, 5],
    selfLossLifetimeRange: [-2, 0],
    collateralWeights: {
      faction_standing_delta: 80,
      npc_relationship_delta: 60,
      region_influence_delta: 20,
    },
    roleplayDeviationDistribution: {
      aligned: 0.75,
      minor_deviation: 0.15,
      major_deviation: 0.07,
      forbidden_action: 0.03,
    },
  },
  {
    strategy: "logistics",
    primaryApproachTag: "logistics",
    mainCompletionRange: [0.7, 0.95],
    sideCompletionRange: [0.6, 0.9],
    hiddenCompletionRange: [0.3, 0.5],
    selfLossResourceRange: [0, 1],
    selfLossLifetimeRange: [0, 0],
    collateralWeights: {
      object_mutation: 50,
      region_influence_delta: 40,
    },
    roleplayDeviationDistribution: {
      aligned: 0.8,
      minor_deviation: 0.12,
      major_deviation: 0.06,
      forbidden_action: 0.02,
    },
  },
  {
    strategy: "exploration",
    primaryApproachTag: "scout",
    mainCompletionRange: [0.4, 0.85],
    sideCompletionRange: [0.3, 0.6],
    hiddenCompletionRange: [0.5, 0.8],
    selfLossResourceRange: [2, 6],
    selfLossLifetimeRange: [-3, -1],
    collateralWeights: {
      region_influence_delta: 40,
      trace_created: -80,
    },
    roleplayDeviationDistribution: {
      aligned: 0.65,
      minor_deviation: 0.2,
      major_deviation: 0.1,
      forbidden_action: 0.05,
    },
  },
];

/** Seeded PRNG (xorshift64). */
export function createSeededPrng(seed: bigint): () => bigint {
  let state = seed || 1n;
  return () => {
    state ^= state << 13n;
    state ^= state >> 7n;
    state ^= state << 17n;
    return state;
  };
}

/** Draw a value in [min, max] from a uniform seed. */
export function drawUniform(prng: () => bigint, min: number, max: number): number {
  const raw = Number(prng() % 1000000n) / 1000000;
  return min + raw * (max - min);
}

/** Draw a classification from a distribution. */
export function drawClassification(
  prng: () => bigint,
  dist: Readonly<Record<string, number>>,
): string {
  const raw = Number(prng() % 1000000n) / 1000000;
  let cumulative = 0;
  for (const [classification, probability] of Object.entries(dist)) {
    cumulative += probability;
    if (raw < cumulative) return classification;
  }
  // Fallback to last entry
  const keys = Object.keys(dist);
  return keys[keys.length - 1] ?? "aligned";
}
