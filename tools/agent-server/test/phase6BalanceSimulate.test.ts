import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  generatePhase6BalanceSamples,
  hashSamples,
  recomputeSample,
  stableJson,
} from "../phase6-balance-simulate.ts";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const graphAppRoot = resolve(repoRoot, "tools/graph-react-app");
const cliPath = resolve(repoRoot, "tools/agent-server/phase6-balance-simulate.ts");
const gatePath = resolve(repoRoot, "tools/agent-server/phase6-balance-gate.mjs");

function runCli(args: readonly string[]) {
  return spawnSync(process.execPath, ["--import", "tsx", cliPath, ...args], {
    cwd: graphAppRoot,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
}

function runGate(inputPath: string) {
  return spawnSync(process.execPath, [gatePath, "--expected-runs", "10000", "--input", inputPath], {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
}

function writeSamplesFile(root: string, name: string, samples: readonly unknown[]): string {
  const output = join(root, name);
  writeFileSync(output, `${samples.map(stableJson).join("\n")}\n`, { encoding: "utf8", mode: 0o600 });
  return output;
}

function gateReport(inputPath: string) {
  const result = runGate(inputPath);
  assert.ok(result.stdout, result.stderr);
  return { result, report: JSON.parse(result.stdout) };
}

function balancedGateSamples(seed = "balanced-gate-positive") {
  return generatePhase6BalanceSamples({ runs: 10_000, seed }).map((sample, index) => {
    const combat = sample.audit.production.combatSuitability;
    const success = sample.success ? 1 : 0;
    const wave = Math.sin((index + 1) * 12.9898) * 9 + Math.cos((index + 1) * 78.233) * 5;
    return {
      ...sample,
      score: Math.round((52 + combat * 0.22 + success * 7 - sample.injury * 0.14 - sample.intensity * 0.045 + wave) * 10_000) / 10_000,
    };
  });
}

test("same seed generates identical sample hash and different seeds vary", () => {
  const left = generatePhase6BalanceSamples({ runs: 128, seed: "deterministic-seed" });
  const right = generatePhase6BalanceSamples({ runs: 128, seed: "deterministic-seed" });
  const changed = generatePhase6BalanceSamples({ runs: 128, seed: "different-seed" });

  assert.equal(hashSamples(left), hashSamples(right));
  assert.notEqual(hashSamples(left), hashSamples(changed));
});

test("balance gate accepts audited balanced 10k stratified workload", () => {
  const root = mkdtempSync(join(repoRoot, ".omx", "tmp-phase6-balance-gate-pass-"));
  try {
    const output = writeSamplesFile(root, "balanced.jsonl", balancedGateSamples());
    const { result, report } = gateReport(output);

    assert.equal(result.status, 0, result.stdout);
    assert.equal(report.passed, true);
    assert.equal(report.gates.observedDesignPriors.passed, true);
    assert.equal(report.gates.pearsonFisherCi.passed, true);
    assert.equal(report.gates.scoreHistogramEntropy.passed, true);
    assert.equal(report.gates.stratifiedSpread.passed, true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("balance gate rejects skewed design-prior strata", () => {
  const root = mkdtempSync(join(repoRoot, ".omx", "tmp-phase6-balance-gate-skew-"));
  try {
    const samples = balancedGateSamples("skewed-prior").map((sample) => ({
      ...sample,
      build: "wardbreaker",
      metadata: {
        ...sample.metadata,
        sampling: {
          ...sample.metadata.sampling,
          strata: { ...sample.metadata.sampling.strata, build: "wardbreaker" },
        },
      },
    }));
    const output = writeSamplesFile(root, "skewed.jsonl", samples);
    const { result, report } = gateReport(output);

    assert.equal(result.status, 1, result.stdout);
    assert.equal(report.passed, false);
    assert.equal(report.gates.observedDesignPriors.passed, false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("balance gate rejects single-axis score dominance", () => {
  const root = mkdtempSync(join(repoRoot, ".omx", "tmp-phase6-balance-gate-axis-"));
  try {
    const samples = balancedGateSamples("single-axis").map((sample) => ({
      ...sample,
      score: sample.audit.production.combatSuitability,
    }));
    const output = writeSamplesFile(root, "axis.jsonl", samples);
    const { result, report } = gateReport(output);

    assert.equal(result.status, 1, result.stdout);
    assert.equal(report.passed, false);
    assert.equal(report.gates.pearsonFisherCi.passed, false);
    assert.equal(report.gates.pearsonFisherCi.correlations.scoreCombatSuitability.passed, false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("balance gate rejects tail explosions in cost and injury", () => {
  const root = mkdtempSync(join(repoRoot, ".omx", "tmp-phase6-balance-gate-tail-"));
  try {
    const samples = balancedGateSamples("tail-explosion").map((sample, index) => index < 250 ? { ...sample, cost: 500, injury: 500 } : sample);
    const output = writeSamplesFile(root, "tail.jsonl", samples);
    const { result, report } = gateReport(output);

    assert.equal(result.status, 1, result.stdout);
    assert.equal(report.passed, false);
    assert.equal(report.gates.stratifiedSpread.passed, false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("samples recompute through production rules", () => {
  const samples = generatePhase6BalanceSamples({ runs: 36, seed: "production-recompute" });

  for (const sample of samples) {
    const recomputed = recomputeSample(sample);
    const serverScoreMean = Object.values(recomputed.scoring.score).reduce((sum, metric) => sum + metric.value, 0) / Object.values(recomputed.scoring.score).length;
    const expectedScore = Math.round((serverScoreMean * 0.4 + recomputed.suitability.suitability * 1.1 + recomputed.missionScore.finalScore * 0.05) * 10_000) / 10_000;

    assert.equal(sample.intensity, recomputed.missionIntensity.encounterIntensity);
    assert.equal(sample.audit.production.missionFinalScore, recomputed.missionScore.finalScore);
    assert.equal(sample.audit.production.serverScoreMean, serverScoreMean);
    assert.equal(sample.audit.production.combatSuitability, recomputed.suitability.suitability);
    assert.equal(sample.score, expectedScore);
    assert.equal(recomputed.economy.ok, true);
  }
});

test("10k generation completes in reasonable time", () => {
  const started = Date.now();
  const samples = generatePhase6BalanceSamples({ runs: 10_000, seed: "ten-k-performance" });
  const elapsedMs = Date.now() - started;

  assert.equal(samples.length, 10_000);
  assert.ok(elapsedMs < 30_000, `10k generation took ${elapsedMs}ms`);
});

test("CLI writes 0600 and refuses to overwrite non-empty output", () => {
  const root = mkdtempSync(join(repoRoot, ".omx", "tmp-phase6-balance-test-"));
  try {
    const output = join(root, "samples.jsonl");
    const result = runCli(["--runs", "10000", "--seed", "cli-safety", "--output", output]);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.equal(statSync(output).mode & 0o777, 0o600);

    const overwrite = runCli(["--runs", "10000", "--seed", "cli-safety", "--output", output]);
    assert.equal(overwrite.status, 1, overwrite.stderr || overwrite.stdout);
    assert.match(overwrite.stderr, /output_refuses_non_empty_file/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("balance gate rejects broken resource conservation and negative resources", () => {
  const root = mkdtempSync(join(repoRoot, ".omx", "tmp-phase6-balance-gate-test-"));
  try {
    const output = join(root, "broken.jsonl");
    const samples = generatePhase6BalanceSamples({ runs: 10_000, seed: "gate-rejects-broken-resources" }).map((sample) => ({ ...sample }));
    samples[0] = {
      ...samples[0],
      resources: {
        ...samples[0].resources,
        after: { ...samples[0].resources.after, coin: -1 },
      },
    };
    writeFileSync(output, `${samples.map(stableJson).join("\n")}\n`, { encoding: "utf8", mode: 0o600 });

    const result = runGate(output);
    assert.equal(result.status, 1, result.stdout);
    const report = JSON.parse(result.stdout);
    assert.equal(report.passed, false);
    assert.equal(report.gates.resourceConservation.passed, false);
    assert.ok(report.gates.resourceConservation.anomalousRuns > 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("CLI rejects output outside the repository", () => {
  const outside = join(mkdtempSync(join(tmpdir(), "phase6-balance-outside-")), "samples.jsonl");
  try {
    const result = runCli(["--runs", "10000", "--seed", "outside-path", "--output", outside]);
    assert.equal(result.status, 1, result.stderr || result.stdout);
    assert.match(result.stderr, /output_outside_repository/);
  } finally {
    rmSync(dirname(outside), { recursive: true, force: true });
  }
});
