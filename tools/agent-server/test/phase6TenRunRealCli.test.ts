import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { resolve } from "node:path";

const repositoryRoot = resolve(import.meta.dirname, "../../..");
const appDirectory = resolve(repositoryRoot, "tools/graph-react-app");
const runnerPath = resolve(repositoryRoot, "tools/agent-server/phase6-ten-run-real.ts");

test("Phase 6 real ten-run runner documents its explicit target and exclusive trace output options", () => {
  const result = spawnSync(process.execPath, ["--import", "tsx", runnerPath, "--help"], {
    cwd: appDirectory,
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /--server-base <http\(s\)-origin>/);
  assert.match(result.stdout, /pins the target origin/);
  assert.match(result.stdout, /--output <path>/);
  assert.match(result.stdout, /exclusive creation/);
});
