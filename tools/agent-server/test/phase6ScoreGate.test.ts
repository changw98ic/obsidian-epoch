import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const TEST_DIR = fileURLToPath(new URL(".", import.meta.url));
const AGENT_SERVER_DIR = join(TEST_DIR, "..");

const DIMENSIONS = ["objective", "causalImpact", "execution", "risk", "integrity", "efficiency", "survival", "antiFarmDecay"];
const WEIGHTS = { objective: 2200, causalImpact: 1400, execution: 1800, risk: 1000, integrity: 1200, efficiency: 1200, survival: 700, antiFarmDecay: 500 };

function score(value, difficultyBaseline) {
  const dimensions = Object.fromEntries(DIMENSIONS.map((dimension) => [dimension, {
    value,
    weightBps: WEIGHTS[dimension],
    contribution: value * WEIGHTS[dimension] / 10_000,
    reasonCode: `test_${dimension}`,
    formula: "quality",
    inputs: { quality: value / 100 },
    inputContributions: { quality: value },
    events: [`event_${difficultyBaseline}`],
    evidence: [`event_${difficultyBaseline}`],
  }]));
  return {
    contractVersion: "phase6_score.v2",
    authority: "server_authoritative",
    provenance: "server_canonical",
    formula: "total = sum(dimensions[dimension].contribution) * decay",
    dimensions,
    weightedTotal: value,
    decay: 1,
    total: value,
    context: {
      difficultyBaseline,
      combatPowerBaseline: 50,
      expectedPerformanceBaseline: 50 + difficultyBaseline * 0.2,
      observedPerformance: value,
      performanceDeltaFromBaseline: value - (50 + difficultyBaseline * 0.2),
      scoringUse: "context_only_not_weighted",
    },
  };
}

function runGate(values) {
  const directory = mkdtempSync(join(AGENT_SERVER_DIR, "test/.phase6-score-gate-"));
  const input = join(directory, "scores.jsonl");
  writeFileSync(input, values.map((value, index) => JSON.stringify({ runId: `run_${index + 1}`, score: value })).join("\n"));
  const result = spawnSync(process.execPath, [join(AGENT_SERVER_DIR, "phase6-score-gate.ts"), "--expected-runs", "10", input], {
    cwd: AGENT_SERVER_DIR,
    encoding: "utf8",
  });
  rmSync(directory, { recursive: true, force: true });
  return { ...result, report: JSON.parse(result.stdout) };
}

test("score gate accepts varied ten-run totals with auditable low intensity correlation", () => {
  const qualities = [60, 80, 65, 75, 70, 70, 75, 65, 80, 60];
  const result = runGate(qualities.map((quality, index) => score(quality, (index + 1) * 10)));
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(result.report.status, "pass");
  assert.equal(Math.abs(result.report.statistics.scoreIntensityCorrelation) < 0.15, true);
  assert.equal(result.report.statistics.total.min < result.report.statistics.total.max, true);
});

test("score gate rejects intensity-correlated totals", () => {
  const result = runGate(Array.from({ length: 10 }, (_, index) => score(50 + index * 4, (index + 1) * 10)));
  assert.equal(result.status, 1);
  assert.equal(result.report.errors.some((error) => error.code === "PHASE6_SCORE_INTENSITY_CORRELATION"), true);
});
