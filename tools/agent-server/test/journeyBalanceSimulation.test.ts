import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { readFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const ROOT = "/Volumes/ORICO/Obsidian";
const GRAPH = `${ROOT}/tools/graph-react-app`;
const SIM_SCRIPT = `${ROOT}/tools/agent-server/scripts/phase6-balance-simulate.ts`;

function runSim(seed: number, iterations: number, outputDir: string): void {
  execSync(
    `npx tsx ${SIM_SCRIPT} --seed ${seed} --iterations ${iterations} --output ${outputDir}`,
    { cwd: GRAPH, timeout: 120_000, stdio: "pipe" },
  );
}

describe("PR11 balance simulation", () => {
  it("deterministic: same seed produces identical per-strategy output", () => {
    const dir1 = join(tmpdir(), `bal-det1-${Date.now()}`);
    const dir2 = join(tmpdir(), `bal-det2-${Date.now()}`);
    try {
      runSim(123, 50, dir1);
      runSim(123, 50, dir2);
      for (const strategy of ["combat", "cunning", "support", "logistics", "exploration"]) {
        const f1 = readFileSync(join(dir1, `${strategy}-iterations.jsonl`), "utf8");
        const f2 = readFileSync(join(dir2, `${strategy}-iterations.jsonl`), "utf8");
        assert.equal(f1, f2, `Determinism failed for ${strategy}`);
      }
    } finally {
      rmSync(dir1, { recursive: true, force: true });
      rmSync(dir2, { recursive: true, force: true });
    }
  });

  it("five strategies produce meaningfully divergent averages", () => {
    const dir = join(tmpdir(), `bal-div-${Date.now()}`);
    try {
      runSim(42, 200, dir);
      const summary = JSON.parse(readFileSync(join(dir, "summary.json"), "utf8"));
      const avgs: number[] = summary.map((s: { avgTotalBps: number }) => s.avgTotalBps);
      const unique = new Set(avgs);
      assert.ok(unique.size >= 3, `Expected ≥3 distinct avgTotalBps, got ${unique.size}: [${avgs}]`);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("tier counts sum to iteration count per strategy", () => {
    const dir = join(tmpdir(), `bal-tier-${Date.now()}`);
    try {
      runSim(42, 100, dir);
      const summary = JSON.parse(readFileSync(join(dir, "summary.json"), "utf8"));
      for (const s of summary) {
        const total = Object.values(s.tierCounts as Record<string, number>).reduce((a: number, b: number) => a + b, 0);
        assert.equal(total, s.iterations, `Tier sum mismatch for ${s.strategy}`);
        assert.ok(s.avgTotalBps >= 0 && s.avgTotalBps <= 10000, `avgTotalBps out of range for ${s.strategy}`);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("output is to temp dir, not data/", () => {
    const dir = join(tmpdir(), `bal-temp-${Date.now()}`);
    try {
      runSim(42, 10, dir);
      assert.ok(existsSync(join(dir, "summary.json")), "summary.json missing");
      assert.ok(!existsSync(join(ROOT, "tools/agent-server/data/balance-sim")), "Must not pollute data/");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("no forbidden fields in output", () => {
    const dir = join(tmpdir(), `bal-leak-${Date.now()}`);
    try {
      runSim(42, 10, dir);
      const summary = JSON.parse(readFileSync(join(dir, "summary.json"), "utf8"));
      const forbidden = ["taskFamilyId", "strategyAffinity", "fitBps", "expectedApproach", "bonusBps"];
      for (const s of summary) {
        for (const f of forbidden) {
          assert.equal((s as Record<string, unknown>)[f], undefined, `Leakage: ${f} in ${s.strategy}`);
        }
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
