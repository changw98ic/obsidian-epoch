#!/usr/bin/env -S npx tsx
/**
 * PR11: Journey-level balance simulation harness (canonical pipeline version).
 *
 * Imports the real settlement pipeline (buildConsequenceScore / deriveSettlementDecision)
 * and per-strategy behavior distributions to produce statistically valid comparison data.
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

// ─── Canonical imports (tsx resolves .ts extensions) ─────────────────────────

import { buildConsequenceScore } from "../lib/epoch/journeyConsequenceScoring.js";
import { deriveSettlementDecision } from "../lib/epoch/journeySettlementDecision.js";
import type {
  SettlementContext,
  ConsequenceScore,
  SettlementDecision,
  ResultComponentInputs,
  SelfLossContribution,
  SelfLossSourceKind,
  MirrorConsequenceLedgerEntry,
  BaseRewardBundle,
  SettlementTier,
} from "../lib/epoch/journeySettlementRules.js";
import type { RoleplayScore, ExpectedLifePattern } from "../lib/epoch/journeyRoleplayRules.js";
import type { IdentityViability } from "../lib/epoch/journeyViabilityRules.js";

// ─── Constants (mirror PR4 thresholds) ──────────────────────────────────────

const CANON_THRESHOLD_BPS = 8500;
const SELFLOSS_CAP_BPS = 3000;
const RESOURCE_SELFLOSS_BPS_PER_UNIT = 200;
const LIFETIME_SELFLOSS_BPS_PER_POINT = 10;
const TIER_THRESHOLDS: readonly { readonly tier: SettlementTier; readonly min: number; readonly max: number }[] = [
  { tier: "未及格" as SettlementTier, min: 0, max: 4000 },
  { tier: "及格" as SettlementTier, min: 4000, max: 5500 },
  { tier: "良好" as SettlementTier, min: 5500, max: 7000 },
  { tier: "优秀" as SettlementTier, min: 7000, max: 8500 },
  { tier: "惊世" as SettlementTier, min: 8500, max: 10001 },
];
const ROLEPLAY_DEVIATION_BPS: Record<string, number> = {
  aligned: 0, minor_deviation: 750, major_deviation: 2000, forbidden_action: 4000,
};
const VIABILITY_DEATH_THRESHOLD = 3000;
const STRESSED_THRESHOLD = 6000;
const STRATEGY_TO_APPROACH: Record<string, string> = {
  combat: "combat", cunning: "stealth", support: "support", logistics: "logistics", exploration: "scout",
};

// ─── Simulation types ───────────────────────────────────────────────────────

interface IterationResult {
  readonly strategy: string;
  readonly iteration: number;
  readonly seed: string;
  readonly mainLineSucceeded: boolean;
  readonly hiddenComplete: boolean;
  readonly resultScoreBps: number;
  readonly selfLossScoreBps: number;
  readonly collateralScoreBps: number;
  readonly totalBps: number;
  readonly tier: string;
  readonly worldCommit: string;
  readonly rewardMultiplierBps: number;
  readonly roleplayDeviation: string;
  readonly roleplayDeviationBps: number;
  readonly viabilityDeath: boolean;
  readonly hiddenClampApplied: boolean;
  readonly strategyConsistency: string;
}

interface StrategyStats {
  readonly strategy: string;
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
  readonly avgRewardMultiplierBps: number;
}

// ─── Simulation helpers ─────────────────────────────────────────────────────

function buildResultComponentInputs(
  prng: () => bigint,
  dist: StrategyBehaviorDistribution,
  mainSucceeded: boolean,
  sideCompleted: boolean,
): ResultComponentInputs {
  return {
    mainCompletionBps: mainSucceeded ? 10000 : 0,
    bonusMainCompletionBps: 0,
    sideCompletionBps: sideCompleted ? 10000 : 0,
    executionQualityBps: Math.round(drawUniform(prng, 5000, 10000)),
    penaltyBps: mainSucceeded ? 0 : 750,
  };
}

function buildSelfLossContributions(
  prng: () => bigint,
  dist: StrategyBehaviorDistribution,
): readonly SelfLossContribution[] {
  const resourceUnits = Math.round(drawUniform(prng, dist.selfLossResourceRange[0], dist.selfLossResourceRange[1]));
  const lifetimeDelta = Math.round(drawUniform(prng, dist.selfLossLifetimeRange[0], dist.selfLossLifetimeRange[1]));
  const entries: SelfLossContribution[] = [];
  if (resourceUnits > 0) {
    entries.push({
      costKind: "resource" as const,
      resourceId: "focus",
      amount: resourceUnits,
      bps: Math.min(resourceUnits * RESOURCE_SELFLOSS_BPS_PER_UNIT, SELFLOSS_CAP_BPS),
      sourceEventId: `sim-resource-${Date.now()}`,
    });
  }
  if (lifetimeDelta < 0) {
    entries.push({
      costKind: "lifetime" as const,
      resourceId: "lifetime",
      amount: Math.abs(lifetimeDelta),
      bps: Math.min(Math.abs(lifetimeDelta) * LIFETIME_SELFLOSS_BPS_PER_POINT, SELFLOSS_CAP_BPS),
      sourceEventId: `sim-lifetime-${Date.now()}`,
    });
  }
  return entries;
}

function buildMirrorLedgerEntries(
  prng: () => bigint,
  dist: StrategyBehaviorDistribution,
  strategy: string,
  iteration: number,
): readonly MirrorConsequenceLedgerEntry[] {
  const entries: MirrorConsequenceLedgerEntry[] = [];
  for (const [effectKind, weight] of Object.entries(dist.collateralWeights)) {
    if (drawUniform(prng, 0, 1) < 0.3) {
      const magnitude = effectKind.startsWith("object") ? drawUniform(prng, 1, 3) : 1;
      entries.push({
        entryId: `mcle-${strategy}-${iteration}-${effectKind}`,
        journeyId: `sim-${strategy}-${iteration}`,
        actionEventId: `action-${iteration}-${effectKind}`,
        effectKind: effectKind as MirrorConsequenceLedgerEntry["effectKind"],
        targetEntityId: `entity-${effectKind}-${iteration}`,
        delta: Math.round(weight * magnitude),
        consequenceType: "collateral" as const,
        sourceEventIds: [`action-${iteration}-${effectKind}`],
        effectBlueprint: {},
        recordedAt: new Date().toISOString(),
        dedupeKey: `${effectKind}:${iteration}:${strategy}`,
      });
    }
  }
  // Identity doubt (from roleplay deviation)
  const roleplayDeviation = drawClassification(prng, dist.roleplayDeviationDistribution);
  if (roleplayDeviation !== "aligned") {
    const strength = roleplayDeviation === "forbidden_action" ? "severe" as const
      : roleplayDeviation === "major_deviation" ? "high" as const
      : "moderate" as const;
    entries.push({
      entryId: `mcle-${strategy}-${iteration}-doubt`,
      journeyId: `sim-${strategy}-${iteration}`,
      actionEventId: `action-${iteration}-doubt`,
      effectKind: "identity_doubt" as const,
      targetEntityId: `identity-${strategy}-${iteration}`,
      delta: ROLEPLAY_DEVIATION_BPS[roleplayDeviation] ?? 0,
      consequenceType: "collateral" as const,
      sourceEventIds: [`action-${iteration}-doubt`],
      effectBlueprint: { doubtStrength: strength },
      recordedAt: new Date().toISOString(),
      dedupeKey: `identity_doubt:${iteration}:${strategy}`,
    });
  }
  return entries;
}

function buildBaseRewardBundle(_prng: () => bigint): BaseRewardBundle {
  return {
    resources: [{ resourceId: "coin", amount: 3 }],
    items: [{ itemKey: "common_loot", rarity: "common" }],
    attributes: [],
  };
}

function buildExpectedLifePattern(strategy: string): ExpectedLifePattern {
  const approach = STRATEGY_TO_APPROACH[strategy] ?? "scout";
  return {
    identityId: `sim-identity-${strategy}`,
    patternVersion: 1,
    expectedApproaches: [approach],
    forbiddenApproaches: STRATEGIES.filter(s => s !== strategy).map(s => STRATEGY_TO_APPROACH[s] ?? "scout"),
    factionRoleNorms: {},
    inputHash: `sha256:${strategy}-pattern`,
    frozenAt: new Date().toISOString(),
  } as unknown as ExpectedLifePattern;
}

// ─── Core simulation loop ───────────────────────────────────────────────────

function simulateIteration(
  dist: StrategyBehaviorDistribution,
  iteration: number,
  seed: bigint,
): IterationResult {
  const prng = createSeededPrng(seed + BigInt(STRATEGIES.indexOf(dist.strategy) * 100000) + BigInt(iteration));
  const strategy = dist.strategy;

  const mainLineSucceeded = drawUniform(prng, 0, 1) < drawUniform(prng, dist.mainCompletionRange[0], dist.mainCompletionRange[1]);
  const sideCompleted = drawUniform(prng, 0, 1) < drawUniform(prng, dist.sideCompletionRange[0], dist.sideCompletionRange[1]);
  const hiddenComplete = drawUniform(prng, 0, 1) < drawUniform(prng, dist.hiddenCompletionRange[0], dist.hiddenCompletionRange[1]);

  const resultInputs = buildResultComponentInputs(prng, dist, mainLineSucceeded, sideCompleted);
  const selfLoss = buildSelfLossContributions(prng, dist);
  const mirrorEntries = buildMirrorLedgerEntries(prng, dist, strategy, iteration);
  const baseReward = buildBaseRewardBundle(prng);
  const pattern = buildExpectedLifePattern(strategy);

  const ctx: SettlementContext = {
    journeyId: `sim-${strategy}-${iteration}`,
    mainObjectiveIds: ["main-1", "main-2", "main-3"],
    sideObjectiveIds: ["side-1", "side-2"],
    hiddenObjectiveIds: ["hidden-1"],
    mainLineSucceeded,
    hiddenComplete,
    actionResolutions: [
      { actionEventId: `action-${iteration}-main`, resultKind: "objective_complete", succeeded: mainLineSucceeded },
      { actionEventId: `action-${iteration}-side`, resultKind: "objective_complete", succeeded: sideCompleted },
    ],
    selfLossSourceEventsByKind: {
      resource: selfLoss.filter(s => s.costKind === "resource").map(s => s.sourceEventId),
      lifetime: selfLoss.filter(s => s.costKind === "lifetime").map(s => s.sourceEventId),
    } as Record<SelfLossSourceKind, readonly string[]>,
    mirrorLedgerEntries: mirrorEntries as readonly MirrorConsequenceLedgerEntry[],
    canonicalActionEventIds: [`action-${iteration}-main`, `action-${iteration}-side`],
    resultComponentInputs: resultInputs,
    selfLossContributions: selfLoss,
    baseRewardBundle: baseReward,
    expectedLifePattern: pattern,
  };

  const score = buildConsequenceScore(ctx);
  const decision = deriveSettlementDecision(ctx, score);

  const roleplayDeviation = drawClassification(prng, dist.roleplayDeviationDistribution);
  const roleplayDeviationBps = ROLEPLAY_DEVIATION_BPS[roleplayDeviation] ?? 0;
  const viabilityScore = 6000 + drawUniform(prng, -3000, 3000);
  const viabilityDeath = viabilityScore <= VIABILITY_DEATH_THRESHOLD;
  const strategyConsistency = roleplayDeviation === "aligned" ? "normal" : "fully_violates";

  return {
    strategy,
    iteration,
    seed: seed.toString(),
    mainLineSucceeded,
    hiddenComplete,
    resultScoreBps: score.breakdown.resultScoreBps,
    selfLossScoreBps: score.breakdown.selfLossScoreBps,
    collateralScoreBps: score.breakdown.collateralScoreBps,
    totalBps: score.breakdown.totalBps,
    tier: decision.tier,
    worldCommit: decision.worldCommit.status,
    rewardMultiplierBps: decision.reward.modifier.multiplierBps,
    roleplayDeviation,
    roleplayDeviationBps,
    viabilityDeath,
    hiddenClampApplied: decision.hiddenClamp.applied,
    strategyConsistency,
  };
}

function aggregateStats(results: readonly IterationResult[]): StrategyStats {
  const n = results.length;
  const tierCounts: Record<string, number> = {};
  const worldCommitCounts: Record<string, number> = {};
  const roleplayDistribution: Record<string, number> = {};
  let sumResult = 0, sumSelfLoss = 0, sumCollateral = 0, sumTotal = 0, sumRewardMult = 0;
  let 惊世Count = 0, viabilityDeathCount = 0, hiddenClampCount = 0;

  for (const r of results) {
    tierCounts[r.tier] = (tierCounts[r.tier] ?? 0) + 1;
    worldCommitCounts[r.worldCommit] = (worldCommitCounts[r.worldCommit] ?? 0) + 1;
    roleplayDistribution[r.roleplayDeviation] = (roleplayDistribution[r.roleplayDeviation] ?? 0) + 1;
    sumResult += r.resultScoreBps;
    sumSelfLoss += r.selfLossScoreBps;
    sumCollateral += r.collateralScoreBps;
    sumTotal += r.totalBps;
    sumRewardMult += r.rewardMultiplierBps;
    if (r.tier === "惊世") 惊世Count++;
    if (r.viabilityDeath) viabilityDeathCount++;
    if (r.hiddenClampApplied) hiddenClampCount++;
  }

  return {
    strategy: results[0]?.strategy ?? "combat",
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
    avgRewardMultiplierBps: Math.round(sumRewardMult / n),
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

console.log(`PR11 Balance Simulation (canonical pipeline)`);
console.log(`  Seed: ${BASE_SEED}`);
console.log(`  Iterations per strategy: ${ITERATIONS}`);
console.log(`  Output: ${outputDir}`);
console.log();

const allStats: StrategyStats[] = [];

for (const dist of STRATEGY_DISTRIBUTIONS) {
  const results: IterationResult[] = [];
  for (let i = 0; i < ITERATIONS; i++) {
    results.push(simulateIteration(dist, i, BASE_SEED));
  }
  allStats.push(aggregateStats(results));
  const jsonl = results.map(r => JSON.stringify(r)).join("\n");
  writeFileSync(join(outputDir, `${dist.strategy}-iterations.jsonl`), jsonl + "\n");
}

writeFileSync(join(outputDir, "summary.json"), JSON.stringify(allStats, null, 2));

console.log("Strategy      | Avg Total | 惊世 Rate | Viab Death | Solidified | Avg Reward");
console.log("------------- | --------- | --------- | ---------- | ---------- | ----------");
for (const s of allStats) {
  const solidified = s.worldCommitCounts["solidified"] ?? 0;
  const solidifiedRate = +(solidified / s.iterations * 100).toFixed(1);
  console.log(
    `${s.strategy.padEnd(13)} | ${String(s.avgTotalBps).padStart(9)} | ${String(s.惊世Rate + "%").padStart(9)} | ${String(s.viabilityDeathRate + "%").padStart(10)} | ${String(solidifiedRate + "%").padStart(10)} | ${String(s.avgRewardMultiplierBps).padStart(10)}`,
  );
}

console.log(`\nResults written to: ${outputDir}`);
