#!/usr/bin/env node

import { createHash } from "node:crypto";
import {
  closeSync,
  existsSync,
  fstatSync,
  lstatSync,
  mkdirSync,
  openSync,
  realpathSync,
  statSync,
  writeSync,
} from "node:fs";
import { dirname, relative, resolve, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";

import { isDirectEntrypoint } from "./lib/cliEntrypoint.ts";
import {
  auditPhase6EconomyConservation,
  phase6EconomyMinorUnit,
  PHASE6_ECONOMY_AUDIT_RULESET_VERSION,
  PHASE6_ECONOMY_SNAPSHOT_VERSION,
  type Phase6EconomyAuditInput,
  type Phase6EconomyResourceFlow,
  type Phase6EconomySnapshot,
} from "./lib/epoch/phase6EconomyAuditRules.ts";
import {
  buildPhase6ServerScoringEvidence,
  PHASE6_SERVER_SCORING_CALCULATION_VERSION,
  PHASE6_SERVER_SCORING_RULESET_VERSION,
  type Phase6ServerScoringEvidenceInput,
} from "./lib/epoch/phase6ServerScoringRules.ts";
import {
  combatReadinessVector,
  estimateEncounterSuitability,
  PROGRESSION_RULESET_VERSION,
  type CombatReadinessInput,
  type EncounterSuitabilityInput,
} from "./lib/epoch/progressionRules.ts";
import {
  calculateMissionIntensity,
  intensityBand,
  MISSION_CONSEQUENCE_RULES_VERSION,
  scoreMission,
  type MissionIntensityInput,
  type MissionOutcome,
  type MissionScoreInput,
} from "./lib/epoch/missionConsequenceRules.ts";

export const PHASE6_BALANCE_SIMULATOR_VERSION = "obsidian-epoch-phase6-balance-simulate-v0.3.0" as const;
export const PHASE6_BALANCE_SAMPLE_SCHEMA_VERSION = "obsidian-epoch.phase6-balance-sample.strict.v3" as const;
export const PHASE6_BALANCE_DESIGN_PRIOR_VERSION = "design-prior-v1" as const;

const ALLOWED_RUNS = new Set([10_000, 100_000]);
const RESOURCE_KEYS = ["coin", "focus", "aether", "legend"] as const;
const BUILDS = [
  { id: "wardbreaker", attributes: { strength: 54, agility: 34, physique: 48, intellect: 24, willpower: 38, spirituality: 24 }, method: [72, 58, 34, 48, 32, 46, 34, 38, 50, 40], equipment: [70, 60, 32, 42, 30, 44, 38, 36, 48, 38], prep: [50, 54, 30, 44, 34, 42, 40, 42, 44, 40] },
  { id: "cipher-scout", attributes: { strength: 24, agility: 58, physique: 34, intellect: 48, willpower: 34, spirituality: 30 }, method: [26, 34, 76, 44, 66, 40, 42, 38, 44, 58], equipment: [28, 38, 70, 36, 54, 38, 40, 36, 42, 54], prep: [30, 40, 62, 44, 60, 42, 44, 38, 44, 58] },
  { id: "civic-mediator", attributes: { strength: 18, agility: 30, physique: 30, intellect: 42, willpower: 40, spirituality: 62 }, method: [18, 30, 34, 38, 42, 42, 56, 44, 70, 58], equipment: [20, 32, 34, 34, 36, 38, 44, 40, 58, 54], prep: [28, 38, 42, 40, 44, 44, 56, 46, 70, 62] },
  { id: "forge-clinician", attributes: { strength: 32, agility: 28, physique: 42, intellect: 52, willpower: 32, spirituality: 44 }, method: [30, 52, 30, 74, 32, 78, 42, 52, 54, 46], equipment: [38, 58, 34, 76, 34, 70, 42, 58, 56, 48], prep: [42, 54, 38, 70, 38, 76, 44, 58, 58, 50] },
  { id: "nocturne-duelist", attributes: { strength: 42, agility: 58, physique: 38, intellect: 26, willpower: 44, spirituality: 22 }, method: [76, 42, 74, 26, 78, 24, 50, 28, 56, 58], equipment: [78, 44, 68, 24, 70, 24, 44, 26, 52, 54], prep: [58, 42, 56, 28, 62, 30, 46, 30, 54, 56] },
  { id: "archive-sapper", attributes: { strength: 30, agility: 36, physique: 34, intellect: 60, willpower: 36, spirituality: 58 }, method: [34, 44, 46, 78, 58, 72, 48, 44, 60, 62], equipment: [36, 46, 44, 74, 50, 76, 44, 46, 58, 60], prep: [40, 46, 48, 76, 54, 70, 46, 46, 60, 64] },
] as const;
const SCENARIOS = [
  { id: "low-patrol", base: 18, weights: [1000, 1400, 1500, 900, 1300, 1100, 900, 800, 600, 500] },
  { id: "market-firebreak", base: 32, weights: [700, 900, 1100, 1200, 900, 1700, 1200, 700, 1000, 600] },
  { id: "anomaly-vault", base: 48, weights: [1200, 800, 700, 1300, 1100, 1700, 900, 1200, 500, 600] },
  { id: "siege-corridor", base: 64, weights: [2200, 1600, 800, 900, 700, 700, 1300, 500, 800, 500] },
  { id: "blackout-exfil", base: 78, weights: [1100, 900, 2200, 800, 2500, 600, 700, 300, 500, 400] },
  { id: "civic-schism", base: 54, weights: [500, 800, 900, 700, 800, 700, 1000, 600, 2800, 1200] },
] as const;
const GROWTH_CHOICES = ["attribute_focus", "method_practice", "gear_repair", "knowledge_route", "social_anchor", "reserve_saving"] as const;
const OUTCOME_PRIORS = [
  { id: "clean_success", weight: 16 },
  { id: "costly_success", weight: 20 },
  { id: "partial_success", weight: 18 },
  { id: "stalemate", weight: 13 },
  { id: "withdrawal", weight: 12 },
  { id: "failure", weight: 11 },
  { id: "catastrophe", weight: 4 },
  { id: "timeout", weight: 6 },
] as const satisfies readonly { readonly id: MissionOutcome; readonly weight: number }[];
const INTENSITY_PRIORS = [
  { id: "low", multiplier: 0.65, weight: 28 },
  { id: "baseline", multiplier: 1, weight: 44 },
  { id: "high", multiplier: 1.22, weight: 28 },
] as const;
const DESIGN_PRIOR = {
  version: PHASE6_BALANCE_DESIGN_PRIOR_VERSION,
  build: Object.fromEntries(BUILDS.map((entry) => [entry.id, 1])),
  scenario: Object.fromEntries(SCENARIOS.map((entry) => [entry.id, 1])),
  growthChoice: Object.fromEntries(GROWTH_CHOICES.map((entry) => [entry, 1])),
  outcome: Object.fromEntries(OUTCOME_PRIORS.map((entry) => [entry.id, entry.weight])),
  intensityTier: Object.fromEntries(INTENSITY_PRIORS.map((entry) => [entry.id, entry.weight])),
} as const;

type ResourceKey = typeof RESOURCE_KEYS[number];
type ResourceMap = Record<ResourceKey, number>;

export interface Phase6BalanceSample {
  readonly schemaVersion: typeof PHASE6_BALANCE_SAMPLE_SCHEMA_VERSION;
  readonly metadata: {
    readonly generatorVersion: typeof PHASE6_BALANCE_SIMULATOR_VERSION;
    readonly seed: string;
    readonly seedHash: string;
    readonly runIndex: number;
    readonly sampling: {
      readonly priorVersion: typeof PHASE6_BALANCE_DESIGN_PRIOR_VERSION;
      readonly primarySeed: string;
      readonly stratumSeed: string;
      readonly strata: {
        readonly build: string;
        readonly scenario: string;
        readonly growthChoice: string;
        readonly outcome: MissionOutcome;
        readonly intensityTier: string;
      };
      readonly priors: typeof DESIGN_PRIOR;
    };
    readonly rules: {
      readonly missionConsequence: typeof MISSION_CONSEQUENCE_RULES_VERSION;
      readonly progression: typeof PROGRESSION_RULESET_VERSION;
      readonly phase6ServerScoring: typeof PHASE6_SERVER_SCORING_RULESET_VERSION;
      readonly phase6ServerScoringCalculation: typeof PHASE6_SERVER_SCORING_CALCULATION_VERSION;
      readonly phase6EconomyAudit: typeof PHASE6_ECONOMY_AUDIT_RULESET_VERSION;
      readonly phase6EconomySnapshot: typeof PHASE6_ECONOMY_SNAPSHOT_VERSION;
    };
  };
  readonly receiptId: string;
  readonly experimentId: string;
  readonly runIndex: number;
  readonly score: number;
  readonly intensity: number;
  readonly suitabilityBand: string;
  readonly build: string;
  readonly scenario: string;
  readonly success: boolean;
  readonly outcome: MissionOutcome;
  readonly cost: number;
  readonly injury: number;
  readonly resources: {
    readonly before: ResourceMap;
    readonly after: ResourceMap;
    readonly delta: ResourceMap;
    readonly gain: ResourceMap;
    readonly cost: ResourceMap;
  };
  readonly growthChoice: string;
  readonly audit: {
    readonly inputs: {
      readonly missionIntensity: MissionIntensityInput;
      readonly missionScore: MissionScoreInput;
      readonly combatReadiness: EncounterSuitabilityInput;
      readonly scoringEvidence: Phase6ServerScoringEvidenceInput;
      readonly economy: Phase6EconomyAuditInput;
    };
    readonly production: {
      readonly decisionQuality: number;
      readonly missionFinalScore: number;
      readonly serverScoreTotal: number;
      readonly combatSuitability: number;
      readonly economyOk: true;
    };
  };
}

interface Options {
  readonly runs: 10_000 | 100_000;
  readonly seed: string;
  readonly outputPath?: string;
  readonly experimentId?: string;
}

class SeededPrng {
  private state: bigint;

  constructor(seed: string) {
    const digest = createHash("sha256").update(seed).digest("hex").slice(0, 16);
    this.state = BigInt(`0x${digest}`) || 1n;
  }

  next(): number {
    this.state = (this.state * 6364136223846793005n + 1442695040888963407n) & ((1n << 64n) - 1n);
    return Number(this.state >> 11n) / 9007199254740992;
  }

  int(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  centered(width: number): number {
    return (this.next() + this.next() - 1) * width;
  }
}

export function parseArguments(argv: readonly string[]): Options & { help: boolean } {
  let runs: number | undefined;
  let seed: string | undefined;
  let outputPath: string | undefined;
  let experimentId: string | undefined;
  let help = false;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help" || argument === "-h") {
      help = true;
      continue;
    }
    if (argument === "--runs") {
      runs = Number.parseInt(requiredValue(argv, index, "--runs"), 10);
      index += 1;
      continue;
    }
    if (argument === "--seed") {
      seed = requiredValue(argv, index, "--seed");
      index += 1;
      continue;
    }
    if (argument === "--output") {
      outputPath = requiredValue(argv, index, "--output");
      index += 1;
      continue;
    }
    if (argument === "--experiment-id") {
      experimentId = requiredValue(argv, index, "--experiment-id");
      index += 1;
      continue;
    }
    throw new Error(`unknown_argument:${argument}`);
  }

  if (help) return { runs: 10_000, seed: "", outputPath, experimentId, help };
  if (!ALLOWED_RUNS.has(runs ?? 0)) throw new Error("--runs must be 10000 or 100000");
  if (!seed) throw new Error("--seed is required");
  if (!outputPath) throw new Error("--output is required");
  return { runs: runs as 10_000 | 100_000, seed, outputPath, experimentId, help };
}

export function generatePhase6BalanceSamples(options: { readonly runs: number; readonly seed: string; readonly experimentId?: string }): readonly Phase6BalanceSample[] {
  if (!Number.isSafeInteger(options.runs) || options.runs <= 0) throw new Error("runs_must_be_positive_integer");
  const prng = new SeededPrng(options.seed);
  return Array.from({ length: options.runs }, (_, index) => buildSample(index + 1, options.seed, prng, options.experimentId));
}

export function stableJson(value: unknown): string {
  return JSON.stringify(sortJson(value));
}

export function hashSamples(samples: readonly Phase6BalanceSample[]): string {
  const hash = createHash("sha256");
  for (const sample of samples) hash.update(stableJson(sample)).update("\n");
  return hash.digest("hex");
}

export function recomputeSample(sample: Phase6BalanceSample) {
  const missionIntensity = calculateMissionIntensity(sample.audit.inputs.missionIntensity);
  const missionScore = scoreMission(sample.audit.inputs.missionScore);
  const vector = combatReadinessVector(sample.audit.inputs.combatReadiness);
  const suitability = estimateEncounterSuitability(sample.audit.inputs.combatReadiness);
  const scoring = buildPhase6ServerScoringEvidence(sample.audit.inputs.scoringEvidence);
  const economy = auditPhase6EconomyConservation(sample.audit.inputs.economy);
  if (!scoring.ok || !suitability.ok || !economy.ok) {
    throw new Error("production_recompute_failed");
  }
  return { missionIntensity, missionScore, vector, suitability, scoring, economy };
}

function buildSample(runIndex: number, seed: string, prng: SeededPrng, experimentId?: string): Phase6BalanceSample {
  const stratumSeed = `${seed}:run:${runIndex}:strata`;
  const build = weightedPick(BUILDS.map((entry) => ({ value: entry, weight: 1 })), prng);
  const scenario = weightedPick(SCENARIOS.map((entry) => ({ value: entry, weight: 1 })), prng);
  const growthChoice = weightedPick(GROWTH_CHOICES.map((entry) => ({ value: entry, weight: 1 })), prng);
  const outcomePrior = weightedPick(OUTCOME_PRIORS.map((entry) => ({ value: entry.id, weight: entry.weight })), prng);
  const intensityPrior = weightedPick(INTENSITY_PRIORS.map((entry) => ({ value: entry, weight: entry.weight })), prng);
  const intensityTarget = scenario.base * intensityPrior.multiplier;
  const difficulty = clampPercent(intensityTarget + prng.centered(18));
  const hostilePower = Math.max(5, Math.round(difficulty * (1.4 + prng.next() * 2.2)));
  const combatReadiness = combatInput(build, scenario.weights, growthChoice, prng);
  const combatVector = combatReadinessVector(combatReadiness);
  const combatSuitability = estimateEncounterSuitability(combatReadiness);
  if (!combatSuitability.ok) throw new Error(`combat_suitability_failed:${runIndex}:${JSON.stringify(combatSuitability.errors)}`);
  const playerCombatPower = Math.round(Object.values(combatVector).reduce((sum, value) => sum + value, 0) / Object.values(combatVector).length);
  const missionIntensityInput: MissionIntensityInput = {
    enemyHostilePower: hostilePower,
    enemyCoordination: clampPercent(difficulty + prng.centered(24)),
    environmentalHazard: clampPercent(difficulty + prng.centered(28)),
    objectiveComplexity: clampPercent(difficulty + prng.centered(26)),
    informationUncertainty: clampPercent(difficulty + prng.centered(34)),
    logisticalBurden: clampPercent(difficulty + prng.centered(30)),
    legalPoliticalRisk: clampPercent(difficulty + prng.centered(32)),
    irreversibility: clampPercent(difficulty + prng.centered(30)),
    resourcePressure: clampPercent(18 + difficulty * 0.62 + prng.centered(24)),
    worldPressure: clampPercent(12 + scenario.base * 0.8 + prng.centered(24)),
    playerCombatPower,
  };
  const missionIntensity = calculateMissionIntensity(missionIntensityInput);
  const outcome = chooseOutcome(missionIntensity.encounterIntensity, combatSuitability.victoryProbabilityBps, outcomePrior, prng);
  const success = outcome === "clean_success" || outcome === "costly_success" || outcome === "partial_success";
  const decisionQualityBps = prng.int(0, 10_000);
  const outcomeCompletionBps = objectiveForOutcome(outcome, prng);
  const objectiveCompletionBps = clampBps(Math.round(decisionQualityBps * 0.9 + outcomeCompletionBps * 0.1));
  const injury = injuryForOutcome(outcome, missionIntensity.encounterIntensity, combatSuitability.victoryProbabilityBps, prng);
  const resources = resourceLedger(runIndex, outcome, success, missionIntensity.encounterIntensity, build.id, growthChoice, prng);
  const cost = sumResource(resources.cost) / 100;
  const resourceEfficiencyBps = clampBps(10_000 - Math.round(cost * 520) - Math.round(injury * 90));
  const missionScoreInput: MissionScoreInput = {
    objectiveCompletionBps,
    pressureReliefBps: clampBps(Math.round(decisionQualityBps * 0.95 + (success ? 8_000 : 2_000) * 0.05) + prng.int(-700, 700)),
    sideEffectControlBps: clampBps(Math.round(decisionQualityBps * 0.95 + resourceEfficiencyBps * 0.05) + prng.int(-700, 700)),
    executionQualityBps: clampBps(decisionQualityBps + prng.int(-600, 600)),
    meaningfulRiskBps: clampBps(Math.round(missionIntensity.encounterIntensity * 100)),
    riskExposureBps: clampBps(Math.round((missionIntensity.encounterIntensity + injury) * 92)),
    resourceEfficiencyBps,
    survivalBps: clampBps(10_000 - Math.round(injury * 120)),
    integrityBps: 10_000,
    recentSimilarCompletionCount: runIndex % 7 === 0 ? prng.int(1, 4) : prng.int(0, 1),
    repeatedResolutionFamilyCount: runIndex % 11 === 0 ? prng.int(1, 3) : 0,
  };
  const missionScore = scoreMission(missionScoreInput);
  const scoringEvidence = scoringEvidenceInput(runIndex, missionIntensity, missionScore, combatSuitability.suitability, outcome, cost, injury, success);
  const scoring = buildPhase6ServerScoringEvidence(scoringEvidence);
  if (!scoring.ok) {
    throw new Error(`server_scoring_failed:${runIndex}:${JSON.stringify({
      findings: scoring.findings,
      outcomeResolution: scoringEvidence.outcomeResolution,
      actionResolutions: scoringEvidence.actionResolutions,
      canonicalEvents: scoringEvidence.canonicalEvents,
    })}`);
  }
  const economy = economyInput(runIndex, resources);
  const economyAudit = auditPhase6EconomyConservation(economy);
  if (!economyAudit.ok) throw new Error(`economy_audit_failed:${runIndex}:${JSON.stringify(economyAudit.findings)}`);
  const serverScoreTotal = scoring.score.total;
  if (!Number.isFinite(serverScoreTotal)) throw new Error(`server_score_total_invalid:${runIndex}`);

  return {
    schemaVersion: PHASE6_BALANCE_SAMPLE_SCHEMA_VERSION,
    metadata: {
      generatorVersion: PHASE6_BALANCE_SIMULATOR_VERSION,
      seed,
      seedHash: createHash("sha256").update(seed).digest("hex"),
      runIndex,
      sampling: {
        priorVersion: PHASE6_BALANCE_DESIGN_PRIOR_VERSION,
        primarySeed: seed,
        stratumSeed,
        strata: {
          build: build.id,
          scenario: scenario.id,
          growthChoice,
          outcome: outcomePrior,
          intensityTier: intensityPrior.id,
        },
        priors: DESIGN_PRIOR,
      },
      rules: {
        missionConsequence: MISSION_CONSEQUENCE_RULES_VERSION,
        progression: PROGRESSION_RULESET_VERSION,
        phase6ServerScoring: PHASE6_SERVER_SCORING_RULESET_VERSION,
        phase6ServerScoringCalculation: PHASE6_SERVER_SCORING_CALCULATION_VERSION,
        phase6EconomyAudit: PHASE6_ECONOMY_AUDIT_RULESET_VERSION,
        phase6EconomySnapshot: PHASE6_ECONOMY_SNAPSHOT_VERSION,
      },
    },
    receiptId: `phase6-balance-${shortHash(seed)}-${runIndex}`,
    experimentId: experimentId ?? `phase6-balance-${shortHash(seed)}`,
    runIndex,
    score: serverScoreTotal,
    intensity: missionIntensity.encounterIntensity,
    suitabilityBand: intensityBand(missionIntensity.encounterIntensity),
    build: build.id,
    scenario: scenario.id,
    success,
    outcome,
    cost,
    injury,
    resources,
    growthChoice,
    audit: {
      inputs: { missionIntensity: missionIntensityInput, missionScore: missionScoreInput, combatReadiness, scoringEvidence, economy },
      production: {
        decisionQuality: decisionQualityBps / 100,
        missionFinalScore: missionScore.finalScore,
        serverScoreTotal,
        combatSuitability: combatSuitability.suitability,
        economyOk: true,
      },
    },
  };
}

function combatInput(build: typeof BUILDS[number], weights: readonly number[], growthChoice: string, prng: SeededPrng): EncounterSuitabilityInput {
  const dimensions = ["offense", "protection", "mobility", "control", "perception", "sustain", "reserve", "corruptionResistance", "synergy", "adaptation"] as const;
  const normalizedWeights = normalizeWeights(weights);
  const vector = (values: readonly number[]) => Object.fromEntries(dimensions.map((dimension, index) => [
    dimension,
    clampPercent(values[index] + (growthChoice === "method_practice" ? 3 : 0) + prng.centered(7)),
  ])) as CombatReadinessInput["methodVector"];
  return {
    attributes: build.attributes,
    methodVector: vector(build.method),
    equipmentVector: vector(build.equipment),
    preparationVector: vector(build.prep),
    stateMultiplierBps: clampBps(8_200 + prng.int(0, 3_600)),
    environmentMultiplierBps: clampBps(8_500 + prng.int(0, 3_200)),
    matchupMultiplierByDimension: Object.fromEntries(dimensions.map((dimension) => [dimension, clampBps(8_000 + prng.int(0, 4_000))])) as EncounterSuitabilityInput["matchupMultiplierByDimension"],
    encounterWeights: Object.fromEntries(dimensions.map((dimension, index) => [dimension, normalizedWeights[index]])) as unknown as EncounterSuitabilityInput["encounterWeights"],
    threatPoints: 35 + prng.int(0, 185),
  };
}

function normalizeWeights(weights: readonly number[]): readonly number[] {
  const total = weights.reduce((sum, value) => sum + value, 0);
  if (total <= 0) throw new Error("encounter_weights_empty");
  const scaled = weights.map((value) => Math.floor((value * 10_000) / total));
  let remainder = 10_000 - scaled.reduce((sum, value) => sum + value, 0);
  for (let index = 0; remainder > 0; index = (index + 1) % scaled.length) {
    scaled[index] += 1;
    remainder -= 1;
  }
  return scaled;
}

function chooseOutcome(intensity: number, victoryBps: number, priorOutcome: MissionOutcome, prng: SeededPrng): MissionOutcome {
  const successPressure = victoryBps / 10_000 - intensity / 210 + prng.centered(0.22);
  const priorShift = outcomePressureShift(priorOutcome);
  const pressure = successPressure + priorShift + prng.centered(0.08);
  if (pressure > 0.36) return prng.next() < 0.7 ? "clean_success" : "costly_success";
  if (pressure > 0.1) return prng.next() < 0.58 ? "costly_success" : "partial_success";
  if (pressure > -0.08) return prng.next() < 0.62 ? "partial_success" : "stalemate";
  if (pressure > -0.28) return prng.next() < 0.56 ? "withdrawal" : "stalemate";
  if (pressure > -0.48) return prng.next() < 0.68 ? "failure" : "timeout";
  return prng.next() < 0.62 ? "catastrophe" : "failure";
}

function outcomePressureShift(outcome: MissionOutcome): number {
  const shifts: Record<MissionOutcome, number> = {
    clean_success: 0.24,
    costly_success: 0.15,
    partial_success: 0.06,
    stalemate: -0.04,
    withdrawal: -0.13,
    failure: -0.24,
    catastrophe: -0.42,
    timeout: -0.3,
  };
  return shifts[outcome];
}

function objectiveForOutcome(outcome: MissionOutcome, prng: SeededPrng): number {
  const ranges: Record<MissionOutcome, readonly [number, number]> = {
    clean_success: [9_000, 10_000],
    costly_success: [7_500, 9_300],
    partial_success: [4_500, 7_500],
    stalemate: [2_000, 5_400],
    withdrawal: [800, 4_200],
    failure: [0, 2_800],
    catastrophe: [0, 1_500],
    timeout: [500, 3_800],
  };
  const [min, max] = ranges[outcome];
  return prng.int(min, max);
}

function injuryForOutcome(outcome: MissionOutcome, intensity: number, victoryBps: number, prng: SeededPrng): number {
  const base = outcome === "clean_success" ? 0 : outcome === "costly_success" ? 8 : outcome === "partial_success" ? 12 : outcome === "withdrawal" ? 9 : outcome === "catastrophe" ? 45 : 22;
  return round4(clampPercent(base + intensity * 0.2 + (5_000 - victoryBps) / 350 + prng.centered(9)));
}

function resourceLedger(runIndex: number, outcome: MissionOutcome, success: boolean, intensity: number, buildId: string, growthChoice: string, prng: SeededPrng) {
  const before = Object.fromEntries(RESOURCE_KEYS.map((key, index) => [key, 240 + index * 80 + (runIndex % 97) + prng.int(0, 140)])) as ResourceMap;
  const gain = zeroResources();
  const cost = zeroResources();
  const primary = RESOURCE_KEYS[(runIndex + buildId.length) % RESOURCE_KEYS.length];
  const secondary = RESOURCE_KEYS[(runIndex + growthChoice.length + 1) % RESOURCE_KEYS.length];
  cost.focus = Math.max(1, Math.round(1 + intensity / 18 + prng.int(0, 5)));
  cost.coin = Math.max(0, Math.round(intensity / 30 + prng.int(0, 8)));
  if (growthChoice === "gear_repair" || growthChoice === "reserve_saving") cost.aether = prng.int(0, 4);
  if (success) {
    gain[primary] += Math.round(8 + intensity / 7 + prng.int(0, 18));
    gain[secondary] += Math.round(2 + intensity / 18 + prng.int(0, 7));
  } else if (outcome === "withdrawal" || outcome === "stalemate" || outcome === "timeout") {
    gain[secondary] += prng.int(0, 5);
  }
  if (outcome === "catastrophe") cost.legend += prng.int(1, 4);
  const delta = Object.fromEntries(RESOURCE_KEYS.map((key) => [key, gain[key] - cost[key]])) as ResourceMap;
  const after = Object.fromEntries(RESOURCE_KEYS.map((key) => [key, before[key] + delta[key]])) as ResourceMap;
  return { before, after, delta, gain, cost };
}

function economyInput(runIndex: number, resources: Phase6BalanceSample["resources"]): Phase6EconomyAuditInput {
  const accountRef = `identity:phase6-balance:${runIndex}`;
  const previous = snapshot(`previous-${runIndex}`, accountRef, resources.before);
  const next = snapshot(`next-${runIndex}`, accountRef, resources.after);
  const flows: Phase6EconomyResourceFlow[] = [];
  for (const key of RESOURCE_KEYS) {
    if (resources.gain[key] > 0) {
      flows.push({
        flowId: `flow-${runIndex}-${key}-gain`,
        assetKey: key,
        unit: "minor",
        quantityMinor: phase6EconomyMinorUnit(BigInt(resources.gain[key])),
        reasonCode: "reward_mint",
        source: { kind: "system", ref: `system:phase6:${key}` },
        sink: { kind: "account", ref: accountRef, bucket: "available" },
        sourceRef: `sim:${runIndex}:${key}:gain`,
      });
    }
    if (resources.cost[key] > 0) {
      flows.push({
        flowId: `flow-${runIndex}-${key}-cost`,
        assetKey: key,
        unit: "minor",
        quantityMinor: phase6EconomyMinorUnit(BigInt(resources.cost[key])),
        reasonCode: "consumption_burn",
        source: { kind: "account", ref: accountRef, bucket: "available" },
        sink: { kind: "system", ref: `system:phase6:${key}` },
        sourceRef: `sim:${runIndex}:${key}:cost`,
      });
    }
  }
  return { previous, next, flows };
}

function snapshot(snapshotId: string, accountRef: string, resources: ResourceMap): Phase6EconomySnapshot {
  return {
    snapshotVersion: PHASE6_ECONOMY_SNAPSHOT_VERSION,
    snapshotId,
    entries: RESOURCE_KEYS.map((key) => ({
      accountRef,
      assetKey: key,
      unit: "minor",
      bucket: "available",
      quantityMinor: phase6EconomyMinorUnit(BigInt(resources[key])),
    })),
  };
}

function scoringEvidenceInput(
  runIndex: number,
  intensity: ReturnType<typeof calculateMissionIntensity>,
  score: ReturnType<typeof scoreMission>,
  combatPower: number,
  outcome: MissionOutcome,
  cost: number,
  injury: number,
  success: boolean,
): Phase6ServerScoringEvidenceInput {
  const eventId = `event_phase6_balance_${runIndex}`;
  const performanceEvidence = score.execution > 49 && score.execution < 51 ? 51 : score.execution;
  return {
    canonicalEvents: [{
      eventId,
      eventType: `journey_${outcome}`,
      tags: ["objective", "survival", "difficulty", "combat", "performance", "efficiency", "world_impact", "resource", "injury"],
      payload: {
        objective: score.objective,
        survival: score.survival,
        difficulty: intensity.encounterIntensity,
        threat: intensity.total,
        performance: performanceEvidence,
        resourceCost: Math.min(100, cost),
        injuryCost: Math.min(100, injury),
        worldImpact: score.causalImpact,
        success,
      },
    }],
    beforeSnapshot: {
      player: { combatReadiness: { combatPower } },
      resources: { reserve: 1 },
    },
    afterSnapshot: {
      player: { combatReadiness: { combatPower } },
      injury,
      resources: { reserve: Math.max(0, 1 - cost / 100) },
    },
    outcomeResolution: {
      objective: score.objective,
      difficulty: intensity.encounterIntensity,
      performance: performanceEvidence,
      resourceCost: Math.min(100, cost),
      injuryCost: Math.min(100, injury),
      worldImpact: score.causalImpact,
    },
    actionResolutions: [{ actionId: `action-${runIndex}`, performance: performanceEvidence, resourceCost: Math.min(100, cost), injuryCost: Math.min(100, injury) }],
    worldCursor: { worldId: "world_phase6_balance", regionId: "region_balance_lab", worldMinute: runIndex },
    versionBinding: {
      rulesetVersion: PHASE6_SERVER_SCORING_RULESET_VERSION,
      catalogVersion: "obsidian-epoch-balance-catalog-v1",
      codeVersion: PHASE6_BALANCE_SIMULATOR_VERSION,
      scenarioMatrixVersion: "phase6-balance-sim-matrix-v1",
      calculationVersion: PHASE6_SERVER_SCORING_CALCULATION_VERSION,
    },
  };
}

function resolveWritableOutputPath(outputPath: string): string {
  const resolvedPath = resolve(process.cwd(), outputPath);
  assertInsideRepository(resolvedPath, "output");
  const parent = dirname(resolvedPath);
  const nearest = nearestExistingDirectory(parent);
  assertInsideRepository(realpathSync(nearest), "output_parent");
  mkdirSync(parent, { recursive: true });
  if (existsSync(resolvedPath)) {
    const linkStat = lstatSync(resolvedPath);
    if (linkStat.isSymbolicLink()) throw new Error("output_symlink_refused");
    if (!linkStat.isFile()) throw new Error("output_not_file");
    if (linkStat.size > 0) throw new Error("output_refuses_non_empty_file");
  }
  return resolvedPath;
}

function writeSamples(resolvedPath: string, samples: readonly Phase6BalanceSample[]) {
  const fd = openSync(resolvedPath, "w", 0o600);
  try {
    const stat = fstatSync(fd);
    if (!stat.isFile()) throw new Error("output_not_file");
    for (const sample of samples) writeSync(fd, `${stableJson(sample)}\n`, undefined, "utf8");
  } finally {
    closeSync(fd);
  }
}

function usage(): string {
  return [
    "Usage: node --import tsx tools/agent-server/phase6-balance-simulate.ts --runs <10000|100000> --seed <seed> --output <repo-jsonl-path> [--experiment-id <id>]",
    "",
    "Generates deterministic strict Phase 6 balanceSample JSONL using production scoring, intensity, combat readiness, and economy audit rules.",
  ].join("\n");
}

function main() {
  try {
    const options = parseArguments(process.argv.slice(2));
    if (options.help) {
      process.stdout.write(`${JSON.stringify({ ok: true, usage: usage().split("\n") }, null, 2)}\n`);
      return;
    }
    const resolvedOutputPath = resolveWritableOutputPath(options.outputPath ?? "phase6-balance-samples.json");
    const samples = generatePhase6BalanceSamples(options);
    writeSamples(resolvedOutputPath, samples);
    process.stdout.write(`${JSON.stringify({
      ok: true,
      schemaVersion: PHASE6_BALANCE_SAMPLE_SCHEMA_VERSION,
      generatorVersion: PHASE6_BALANCE_SIMULATOR_VERSION,
      runs: samples.length,
      seed: options.seed,
      output: relative(repositoryRoot(), resolvedOutputPath),
      sha256: hashSamples(samples),
    }, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`phase6 balance simulate failed: ${error instanceof Error ? error.message : "unknown_error"}\n`);
    process.exitCode = 1;
  }
}

function requiredValue(argv: readonly string[], index: number, label: string): string {
  const value = argv[index + 1];
  if (!value) throw new Error(`${label} requires a value`);
  return value;
}

function zeroResources(): ResourceMap {
  return { coin: 0, focus: 0, aether: 0, legend: 0 };
}

function sumResource(value: ResourceMap): number {
  return Object.values(value).reduce((sum, entry) => sum + entry, 0);
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function clampBps(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(10_000, Math.round(value)));
}

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

function weightedPick<T>(entries: readonly { readonly value: T; readonly weight: number }[], prng: SeededPrng): T {
  const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
  if (total <= 0) throw new Error("weighted_pick_empty");
  let cursor = prng.next() * total;
  for (const entry of entries) {
    cursor -= entry.weight;
    if (cursor < 0) return entry.value;
  }
  return entries[entries.length - 1].value;
}

function shortHash(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 12);
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJson);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)).map(([key, entry]) => [key, sortJson(entry)]));
  }
  return value;
}

function repositoryRoot(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), "../..");
}

function assertInsideRepository(resolvedPath: string, label: string) {
  const rel = relative(repositoryRoot(), resolvedPath);
  if (rel === "" || rel.startsWith("..") || isAbsolute(rel)) throw new Error(`${label}_outside_repository`);
}

function nearestExistingDirectory(directory: string): string {
  let current = directory;
  while (!existsSync(current)) current = dirname(current);
  if (!statSync(current).isDirectory()) throw new Error("output_parent_not_directory");
  return current;
}

if (isDirectEntrypoint(import.meta.url, process.argv[1])) main();
