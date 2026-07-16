import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { attestedRunnersFromEnv } from "../lib/attestedRunnerConfig.ts";

test("attestedRunnersFromEnv reads one runner from explicit env fields without exposing defaults", () => {
  const runners = attestedRunnersFromEnv({
    AGENT_SERVER_ATTESTED_RUNNER_ID: "runner_env",
    AGENT_SERVER_ATTESTED_RUNNER_SECRET: "secret_env",
    AGENT_SERVER_ATTESTED_RUNNER_LABEL: "Env runner",
    AGENT_SERVER_ATTESTED_RUNNER_TRUST_CLASS: "host_attested",
    AGENT_SERVER_ATTESTED_RUNNER_KEY_ID: "env-key-2026-06",
  });

  assert.equal(runners[0].runnerId, "runner_env");
  assert.equal(runners[0].secret, "secret_env");
  assert.equal(runners[0].label, "Env runner");
  assert.equal(runners[0].trustClass, "host_attested");
  assert.equal(runners[0].keyId, "env-key-2026-06");
  assert.match(runners[0].secretFingerprint || "", /^sha256:[a-f0-9]{16}$/);
  assert.deepEqual(attestedRunnersFromEnv({}), []);
});

test("attestedRunnersFromEnv reads JSON runner lists and rejects malformed values", () => {
  const runners = attestedRunnersFromEnv({
    AGENT_SERVER_ATTESTED_RUNNERS: JSON.stringify([
      {
        runnerId: "runner_json",
        secret: "secret_json",
        label: "JSON runner",
        trustClass: "remote_attested_runner",
        keyId: "json-key-2026-06",
        challengeTtlMs: 1234,
      },
    ]),
  });

  assert.equal(runners[0].runnerId, "runner_json");
  assert.equal(runners[0].keyId, "json-key-2026-06");
  assert.match(runners[0].secretFingerprint || "", /^sha256:[a-f0-9]{16}$/);
  assert.equal(runners[0].challengeTtlMs, 1234);
  assert.throws(() => attestedRunnersFromEnv({
    AGENT_SERVER_ATTESTED_RUNNERS: "[",
  }), /attested_runners_env_invalid_json/);
  assert.throws(() => attestedRunnersFromEnv({
    AGENT_SERVER_ATTESTED_RUNNERS: JSON.stringify([{ runnerId: "missing_secret" }]),
  }), /attested_runner_secret_required/);
});

test("attestedRunnersFromEnv reads secret files and rejects ambiguous secret sources", async () => {
  const tempDir = await mkdtemp(path.join(tmpdir(), "attested-runner-config-"));
  const singleSecretFile = path.join(tempDir, "single.txt");
  const runnerBundleFile = path.join(tempDir, "runners.json");
  await writeFile(singleSecretFile, "file-runner-secret\n", { mode: 0o600 });
  await writeFile(runnerBundleFile, JSON.stringify([{
    runnerId: "runner_file_bundle",
    secret: "bundle-runner-secret",
    keyId: "bundle-key-1",
  }]), { mode: 0o600 });
  try {
    const single = attestedRunnersFromEnv({
      AGENT_SERVER_ATTESTED_RUNNER_ID: "runner_file",
      AGENT_SERVER_ATTESTED_RUNNER_SECRET_FILE: singleSecretFile,
    });
    assert.equal(single[0]?.secret, "file-runner-secret");
    const bundled = attestedRunnersFromEnv({
      AGENT_SERVER_ATTESTED_RUNNERS_FILE: runnerBundleFile,
    });
    assert.equal(bundled[0]?.runnerId, "runner_file_bundle");
    assert.throws(() => attestedRunnersFromEnv({
      AGENT_SERVER_ATTESTED_RUNNERS: "[]",
      AGENT_SERVER_ATTESTED_RUNNERS_FILE: runnerBundleFile,
    }), /attested_runners_source_ambiguous/);
    assert.throws(() => attestedRunnersFromEnv({
      AGENT_SERVER_ATTESTED_RUNNER_ID: "runner_ambiguous",
      AGENT_SERVER_ATTESTED_RUNNER_SECRET: "inline",
      AGENT_SERVER_ATTESTED_RUNNER_SECRET_FILE: singleSecretFile,
    }), /attested_runner_secret_source_ambiguous/);
    assert.throws(() => attestedRunnersFromEnv({
      AGENT_SERVER_ATTESTED_RUNNER_ID: "runner_single",
      AGENT_SERVER_ATTESTED_RUNNER_SECRET_FILE: singleSecretFile,
      AGENT_SERVER_ATTESTED_RUNNERS_FILE: runnerBundleFile,
    }), /attested_runner_single_and_multi_source_ambiguous/);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
