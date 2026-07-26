#!/usr/bin/env -S npx tsx
/**
 * PR11: Journey-level balance simulation harness.
 *
 * Per-strategy 1000-iteration Monte Carlo with fixed seed.
 * Pure computation (no external AI calls, no canonical store writes).
 * Output: JSONL to temp dir + summary statistics to stdout.
 *
 * Usage:
 *   npx tsx tools/agent-server/scripts/phase6-balance-simulate.ts [--seed N] [--iterations N] [--output DIR]
 */

import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  STRATEGIES,
  STRATEGY_DISTRIBUTIONS,
  createSeededPrng,
  drawUniform,
  drawClassification,
  type StrategyBehaviorDistribution,
} from "./phase6-balance-samples.js";

// ─── Simulation constants (mirror spec §6 + PR4 thresholds) ─────────────────

const CANON_THRESHOLD_BPS = 8500;
const RESULT_WEIGHT_MAIN = 0.6;
const RESULT_WEIGHT_SIDE = 0.2;
const RESULT_WEIGHT_EXEC = 0.2;
const RESOURCE_SELFLOSS_BPS_PER_UNIT = 200;
const LIFETIME_SELFLOSS_BPS_PER_POINT = 10;
const SELFLOSS_CAP_BPS = 3000;
const TIER_THRESHOLDS = [
  { tier: "未及格", min: 0, max: 4000 },
  { tier: "及格", min: 4000, max: 5500 },
  { tier: "良好", min: 5500, max: 7000 },
  { tier: "优秀", min: 7000, max: 8500 },
  { tier: "惊世", min: 8500, max: 10001 },
] as const;
const VIABILITY_DEATH_THRESHOLD = 3000;
const STRESSED_THRESHOLD = 6000;
const ROLEPLAY_DEVIATION_BPS: Record<string, number> = {
  aligned: 0,
  minor_deviation: 750,
  major_deviation: 2000,
  forbidden_action: 4000,
};
const DOUBT_PENALTY_BPS: Record<string, number> = {
  low: 250,
  moderate: 750,
  high: 2000,
  severe: 4000,
};
const STRATEGY_TO_APPROACH: Record<string, string> = {
  combat: "combat",
  cunning: "stealth",
  support: "support",
  logistics: "logistics",
  exploration: "scout",
};

// ─── Types ───────────────────────────────────────────────────────────────────

interface IterationResult {
  readonly strategy: Strategy;
  readonly iteration: number;
  readonly seed: string;
  readonly mainLineSucceeded: boolean;
  readonly hiddenComplete: boolean;
  readonly resultScoreBps: number;
  readonly selfLossScoreBps: number;
  readonly collateralScoreBps: number;
  readonly totalBps: number;
  readonly tier: string;
  readonly hiddenClampApplied: boolean;
  readonly worldCommit: string;
  readonly roleplayDeviation: string;
  readonly roleplayDeviationBps: number;
  readonly viabilityDeath: boolean;
  readonly strategyConsistency: string;
}

interface StrategyStats {
  readonly strategy: Strategy;
  readonly iterations: number;
  readonly tierCounts: Record<string, number>;
  readonly worldCommitCounts: Record<string, number>;
  readonly avgResultBps: number;
  readonly avgSelfLossBps: number;
  readonly avgCollateralBps: number;
  readonly avgTotalBps: number;
  readonly 惊世Rate: number;
  readonly viabilityDeathRate: number;
  readonly hiddenClampRate: number;
  readonly roleplayDistribution: Record<string, number>;
}

// ─── Simulation ──────────────────────────────────────────────────────────────

function simulateIteration(
  dist: StrategyBehaviorDistribution,
  iteration: number,
  seed: bigint,
): IterationResult {
  const prng = createSeededPrng(seed + BigInt(iteration));

  // Main/side/hidden completion
  const mainProb = drawUniform(prng, dist.mainCompletionRange[0], dist.mainCompletionRange[1]);
  const sideProb = drawUniform(prng, dist.sideCompletionRange[0], dist.sideCompletionRange[1]);
  const hiddenProb = drawUniform(prng, dist.hiddenCompletionRange[0], dist.hiddenCompletionRange[1]);
  const mainLineSucceeded = drawUniform(prng, 0, 1) < mainProb;
  const sideCompleted = drawUniform(prng, 0, 1) < sideProb;
  const hiddenComplete = drawUniform(prng, 0, 1) < hiddenProb;

  // Result score
  const mainBps = mainLineSucceeded ? 10000 : 0;
  const sideBps = sideCompleted ? 10000 : 0;
  const execBps = drawUniform(prng, 5000, 10000); // execution quality variance
  const resultScoreBps = Math.min(10000, Math.max(0,
    Math.round(mainBps * RESULT_WEIGHT_MAIN + sideBps * RESULT_WEIGHT_SIDE + execBps * RESULT_WEIGHT_EXEC),
  ));

  // Self-loss
  const resourceUnits = Math.round(drawUniform(prng, dist.selfLossResourceRange[0], dist.selfLossResourceRange[1]));
  const lifetimeDelta = Math.round(drawUniform(prng, dist.selfLossLifetimeRange[0], dist.selfLossLifetimeRange[1]));
  const rawSelfLoss = resourceUnits * RESOURCE_SELFLOSS_BPS_PER_UNIT + Math.max(0, -lifetimeDelta) * LIFETIME_SELFLOSS_BPS_PER_POINT;
  const selfLossScoreBps = -Math.min(rawSelfLoss, SELFLOSS_CAP_BPS);

  // Collateral
  let collateralScoreBps = 0;
  for (const [effectKind, weight] of Object.entries(dist.collateralWeights)) {
    const triggered = drawUniform(prng, 0, 1) < 0.3; // 30% chance per effect kind
    if (triggered) {
      const magnitude = effectKind.startsWith("object") ? drawUniform(prng, 1, 3) : 1;
      collateralScoreBps += Math.round(weight * magnitude);
    }
  }
  collateralScoreBps = Math.max(-2000, Math.min(1500, collateralScoreBps));

  // Roleplay deviation
  const roleplayDeviation = drawClassification(prng, dist.roleplayDeviationDistribution);
  const roleplayDeviationBps = ROLEPLAY_DEVIATION_BPS[roleplayDeviation] ?? 0;

  // Total
  const totalBps = Math.min(10000, Math.max(0, resultScoreBps + selfLossScoreBps + collateralScoreBps));

  // Tier
  let tier = "未及格";
  for (const t of TIER_THRESHOLDS) {
    if (totalBps >= t.min && totalBps < t.max) { tier = t.tier; break; }
  }
  // Hidden clamp
  let hiddenClampApplied = false;
  if (!mainLineSucceeded) {
    tier = "未及格";
    hiddenClampApplied = true;
  } else if (!hiddenComplete && (tier === "惊世" || tier === "优秀")) {
    tier = "优秀";
    hiddenClampApplied = true;
  }
  // 惊世 gate
  if (tier === "惊世" && !hiddenComplete) tier = "优秀";

  // World commit
  const worldCommit = mainLineSucceeded && totalBps >= CANON_THRESHOLD_BPS ? "solidified" : "discarded";

  // Viability death (simplified)
  const viabilityScore = 6000 + drawUniform(prng, -3000, 3000); // rough simulation
  const viabilityDeath = viabilityScore <= VIABILITY_DEATH_THRESHOLD;

  // Strategy consistency
  const strategyConsistency = roleplayDeviation === "aligned" ? "normal" : "fully_violates";

  return {
    strategy: dist.strategy,
    iteration,
    seed: seed.toString(),
    mainLineSucceeded,
    hiddenComplete,
    resultScoreBps,
    selfLossScoreBps,
    collateralScoreBps,
    totalBps,
    tier,
    hiddenClampApplied,
    worldCommit,
    roleplayDeviation,
    roleplayDeviationBps,
    viabilityDeath,
    strategyConsistency,
  };
}

function aggregateStats(results: IterationResult[]): StrategyStats {
  const n = results.length;
  const tierCounts: Record<string, number> = {};
  const worldCommitCounts: Record<string, number> = {};
  const roleplayDistribution: Record<string, number> = {};
  let sumResult = 0, sumSelfLoss = 0, sumCollateral = 0, sumTotal = 0;
  let 惊世Count = 0, viabilityDeathCount = 0, hiddenClampCount = 0;

  for (const r of results) {
    tierCounts[r.tier] = (tierCounts[r.tier] ?? 0) + 1;
    worldCommitCounts[r.worldCommit] = (worldCommitCounts[r.worldCommit] ?? 0) + 1;
    roleplayDistribution[r.roleplayDeviation] = (roleplayDistribution[r.roleplayDeviation] ?? 0) + 1;
    sumResult += r.resultScoreBps;
    sumSelfLoss += r.selfLossScoreBps;
    sumCollateral += r.collateralScoreBps;
    sumTotal += r.totalBps;
    if (r.tier === "惊世") 惊世Count++;
    if (r.viabilityDeath) viabilityDeathCount++;
    if (r.hiddenClampApplied) hiddenClampCount++;
  }

  return {
    strategy: results[0]?.strategy ?? "combat" as Strategy,
    iterations: n,
    tierCounts,
    worldCommitCounts,
    avgResultBps: Math.round(sumResult / n),
    avgSelfLossBps: Math.round(sumSelfLoss / n),
    avgCollateralBps: Math.round(sumCollateral / n),
    avgTotalBps: Math.round(sumTotal / n),
    惊世Rate: +(惊世Count / n * 100).toFixed(2),
    viabilityDeathRate: +(viabilityDeathCount / n * 100).toFixed(2),
    hiddenClampRate: +(hiddenClampCount / n * 100).toFixed(2),
    roleplayDistribution,
  };
}

// ─── CLI ─────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const seedArg = args.indexOf("--seed");
const iterArg = args.indexOf("--iterations");
const outArg = args.indexOf("--output");

const BASE_SEED = seedArg >= 0 ? BigInt(args[seedArg + 1] ?? "42") : 42n;
const ITERATIONS = iterArg >= 0 ? parseInt(args[iterArg + 1] ?? "1000", 10) : 1000;
const outputDir = outArg >= 0 ? (args[outArg + 1] ?? join(tmpdir(), "balance-sim")) : mkdtempSync(join(tmpdir(), "balance-sim-"));

mkdirSync(outputDir, { recursive: true });

console.log(`PR11 Balance Simulation`);
console.log(`  Seed: ${BASE_SEED}`);
console.log(`  Iterations per strategy: ${ITERATIONS}`);
console.log(`  Output: ${outputDir}`);
console.log();

const allResults: IterationResult[] = [];
const allStats: StrategyStats[] = [];

for (const dist of STRATEGY_DISTRIBUTIONS) {
  const results: IterationResult[] = [];
  for (let i = 0; i < ITERATIONS; i++) {
    results.push(simulateIteration(dist, i, BASE_SEED + BigInt(STRATEGIES.indexOf(dist.strategy) * 100000)));
  }
  allResults.push(...results);
  allStats.push(aggregateStats(results));

  // Write per-iteration JSONL
  const jsonl = results.map(r => JSON.stringify(r)).join("\n");
  writeFileSync(join(outputDir, `${dist.strategy}-iterations.jsonl`), jsonl + "\n");
}

// Write summary
writeFileSync(join(outputDir, "summary.json"), JSON.stringify(allStats, null, 2));

// Print summary table
console.log("Strategy      | Avg Total | 惊世 Rate | Viab Death | Hidden Clamp | Solidified");
console.log("------------- | --------- | --------- | ---------- | ------------ | ----------");
for (const s of allStats) {
  const solidified = s.worldCommitCounts["solidified"] ?? 0;
  const solidifiedRate = +(solidified / s.iterations * 100).toFixed(1);
  console.log(
    `${s.strategy.padEnd(13)} | ${String(s.avgTotalBps).padStart(9)} | ${String(s.惊世Rate + "%").padStart(9)} | ${String(s.viabilityDeathRate + "%").padStart(10)} | ${String(s.hiddenClampRate + "%").padStart(12)} | ${String(solidifiedRate + "%").padStart(10)}`,
  );
}

console.log(`\nResults written to: ${outputDir}`);
console.log("Run `npm run agent:balance-simulate` for CI integration.");
