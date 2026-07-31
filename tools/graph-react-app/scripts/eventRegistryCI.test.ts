import assert from "node:assert/strict";
import test from "node:test";
import { execFile } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { join, resolve, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPT_PATH = resolve(__dirname, "event-registry-check.ts");
const AGENT_SERVER = resolve(__dirname, "../../agent-server");

function runScript(env?: Record<string, string>): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  return new Promise((resolvePromise) => {
    execFile(
      "node",
      ["--import", "tsx", SCRIPT_PATH],
      {
        cwd: join(__dirname, ".."),
        timeout: 30_000,
        env: { ...process.env, ...env },
      },
      (error, stdout, stderr) => {
        resolvePromise({
          exitCode: error ? 1 : 0,
          stdout: String(stdout),
          stderr: String(stderr),
        });
      },
    );
  });
}

test("event-registry-check passes for the current codebase (exit code 0)", async () => {
  const result = await runScript();
  assert.equal(result.exitCode, 0, `Script failed with stderr: ${result.stderr}`);
  assert.ok(
    result.stdout.includes("ALL PASS") || result.stdout.includes("event types"),
    `Unexpected stdout: ${result.stdout}`,
  );
});

test("event-registry-check fails when an event type is missing from the whitelist", async () => {
  // Create a temp agent-server dir with a patched protocol.ts that has an extra event type
  const tempDir = await mkdtemp(join(tmpdir(), "event-registry-fail-"));
  try {
    const tempAgentServer = join(tempDir, "agent-server");
    const tempLibEpoch = join(tempAgentServer, "lib", "epoch");
    mkdirSync(tempLibEpoch, { recursive: true });

    // Read and patch protocol.ts: add a fake event type to EPOCH_EVENT_TYPES
    const protocolSrc = readFileSync(resolve(AGENT_SERVER, "lib/epoch/protocol.ts"), "utf-8");
    const patchedProtocol = protocolSrc.replace(
      /(export\s+const\s+EPOCH_EVENT_TYPES\s*=\s*\[)/,
      `$1"ci_test_fake_event",`,
    );
    assert.notEqual(patchedProtocol, protocolSrc, "Could not patch protocol.ts -- regex did not match");
    assert.ok(patchedProtocol.includes("ci_test_fake_event"), "Patched protocol must contain the fake event type");
    writeFileSync(join(tempLibEpoch, "protocol.ts"), patchedProtocol, "utf-8");

    // Copy runtimePublicProjectionRules.ts unchanged (no matching entry for fake type)
    const rulesSrc = readFileSync(resolve(AGENT_SERVER, "lib/epoch/runtimePublicProjectionRules.ts"), "utf-8");
    writeFileSync(join(tempLibEpoch, "runtimePublicProjectionRules.ts"), rulesSrc, "utf-8");

    // Run the real script but point it at the temp agent-server via env var
    const result = await runScript({ EVENT_REGISTRY_CHECK_AGENT_SERVER: tempAgentServer });
    assert.equal(
      result.exitCode,
      1,
      `Script should fail when a fake event type is missing from whitelist. stdout: ${result.stdout}, stderr: ${result.stderr}`,
    );
    assert.ok(
      result.stderr.includes("ci_test_fake_event"),
      `Expected stderr to mention the missing type. stdout: ${result.stdout}, stderr: ${result.stderr}`,
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
