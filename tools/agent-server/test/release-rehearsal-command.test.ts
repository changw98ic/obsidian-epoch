import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

const repoRoot = path.resolve(import.meta.dirname, "../../..");
const graphAppRoot = path.resolve(repoRoot, "tools/graph-react-app");
const AGENT_SERVER_PROCESS_HEALTH_TIMEOUT_MS = 30_000;
const SUPPORTS_PROCESS_GROUP_SIGNALS = process.platform !== "win32";

async function runNpmScript(args: readonly string[], env: NodeJS.ProcessEnv = {}) {
  const child = spawn("npm", args, {
    cwd: graphAppRoot,
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      ...env,
    },
  });
  const stdoutChunks: Buffer[] = [];
  const stderrChunks: Buffer[] = [];
  child.stdout.on("data", (chunk) => stdoutChunks.push(Buffer.from(chunk)));
  child.stderr.on("data", (chunk) => stderrChunks.push(Buffer.from(chunk)));
  const [code] = await once(child, "exit");
  return {
    code,
    stdout: Buffer.concat(stdoutChunks).toString("utf8"),
    stderr: Buffer.concat(stderrChunks).toString("utf8"),
  };
}

function parseLastJsonLine(stdout: string) {
  return JSON.parse(stdout.trim().split(/\r?\n/).at(-1) || "{}");
}

async function reserveFreePort() {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const port = address.port;
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return port;
}

async function waitForHealthyServer(baseUrl: string, childOutput: () => string) {
  const deadline = Date.now() + AGENT_SERVER_PROCESS_HEALTH_TIMEOUT_MS;
  let lastError = "";
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      const body = await response.json();
      if (response.status === 200 && body?.ok === true) return;
      lastError = `status:${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`agent_server_process_not_healthy:${lastError}:${childOutput()}`);
}

async function stopChildProcess(child: ReturnType<typeof spawn>) {
  if (child.exitCode !== null || child.signalCode !== null) return;

  const signalProcessTree = (signal: NodeJS.Signals) => {
    if (SUPPORTS_PROCESS_GROUP_SIGNALS && child.pid) {
      try {
        process.kill(-child.pid, signal);
        return;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ESRCH") return;
        throw error;
      }
    }
    child.kill(signal);
  };

  signalProcessTree("SIGTERM");
  const exited = await Promise.race([
    once(child, "exit").then(() => true),
    new Promise<false>((resolve) => setTimeout(() => resolve(false), 2_000)),
  ]);
  if (!exited) signalProcessTree("SIGKILL");
}

test("graph app package exposes the release rehearsal command", async () => {
  const packageJson = JSON.parse(await readFile(path.join(graphAppRoot, "package.json"), "utf8"));
  assert.equal(packageJson.scripts["agent:release-rehearsal"], "node --import tsx ../agent-server/release-rehearsal.ts");
});

test("release rehearsal command proves install backup restore and recovery evidence", async () => {
  const tempDir = await mkdtemp(path.join(tmpdir(), "epoch-release-rehearsal-"));
  const dataDir = path.join(tempDir, "server-data");
  const backupRoot = path.join(tempDir, "backups");
  const sqlitePath = path.join(tempDir, "drill.sqlite");
  const restoreDataDir = path.join(tempDir, "restored-jsonl");
  const restoreSqlitePath = path.join(tempDir, "restored.sqlite");
  const port = await reserveFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const operatorKey = "release-rehearsal-operator-secret";
  const imageDigest = `sha256:${"a".repeat(64)}`;
  const imageReference = "registry.example/obsidian-epoch-agent-server:0.1.0-alpha";
  const child = spawn("npm", ["run", "agent:server"], {
    cwd: graphAppRoot,
    detached: SUPPORTS_PROCESS_GROUP_SIGNALS,
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      AGENT_SERVER_HOST: "127.0.0.1",
      AGENT_SERVER_PORT: String(port),
      AGENT_SERVER_DATA_DIR: dataDir,
      AGENT_SERVER_OPERATOR_KEY: operatorKey,
    },
  });
  const outputChunks: Buffer[] = [];
  child.stdout.on("data", (chunk) => outputChunks.push(Buffer.from(chunk)));
  child.stderr.on("data", (chunk) => outputChunks.push(Buffer.from(chunk)));
  const childOutput = () => Buffer.concat(outputChunks).toString("utf8");

  try {
    await waitForHealthyServer(baseUrl, childOutput);
    const result = await runNpmScript([
      "run",
      "agent:release-rehearsal",
      "--",
      "--server",
      baseUrl,
      "--operator-key",
      operatorKey,
      "--source",
      dataDir,
      "--sqlite",
      sqlitePath,
      "--backup-root",
      backupRoot,
      "--restore-target-source",
      restoreDataDir,
      "--restore-target-sqlite",
      restoreSqlitePath,
      "--image-digest",
      imageDigest,
      "--image-reference",
      imageReference,
      "--json",
    ], {
      AGENT_INSTALL_SMOKE_SEED: "release_rehearsal",
    });

    assert.equal(result.code, 0, result.stderr || result.stdout || childOutput());
    const body = parseLastJsonLine(result.stdout);
    assert.equal(body.ok, true);
    assert.equal(body.serverBase, baseUrl);
    assert.equal(body.installSmoke.ok, true);
    assert.equal(body.installSmoke.webBridgeDeliveryTrust, "untrusted_client");
    assert.equal(body.installSmoke.webBridgePostResultMutationRejected, true);
    assert.match(body.installSmoke.packageSha256, /^[a-f0-9]{64}$/);
    assert.equal(body.artifacts.package.digest, `sha256:${body.installSmoke.packageSha256}`);
    assert.ok(body.artifacts.package.bytes > 0);
    assert.equal(body.artifacts.package.evidence, "live-package-download");
    assert.deepEqual(body.artifacts.image, {
      reference: imageReference,
      digest: imageDigest,
      evidence: "operator-supplied-registry-digest",
    });
    assert.equal(body.operatorOverview.verified, true);
    assert.equal(body.operatorOverview.status, 200);
    assert.equal(body.recoveryDrill.ok, true);
    assert.equal(body.recoveryDrill.expectedAgentFound, true);
    assert.equal(body.recoveryDrill.expectedResultPageFound, true);
    assert.equal(body.backup.ok, true);
    assert.ok(body.backup.fileCount > 0);
    assert.equal(body.restore.ok, true);
    assert.equal(body.restore.jsonlRestored, true);
    assert.equal(body.restore.sqliteRestored, true);
    assert.deepEqual(body.checks, {
      installSmoke: true,
      operatorOverview: true,
      recoveryDrill: true,
      backup: true,
      restore: true,
      artifactDigests: true,
    });
  } finally {
    await stopChildProcess(child);
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("release rehearsal production mode requires a pinned release key id", async () => {
  const result = await runNpmScript([
    "run",
    "agent:release-rehearsal",
    "--",
    "--server",
    "https://epoch.example.test",
    "--production",
    "--json",
  ]);

  assert.notEqual(result.code, 0);
  const body = parseLastJsonLine(result.stdout);
  assert.equal(body.ok, false);
  assert.equal(body.error, "release_rehearsal_expected_release_key_id_required");
});

test("release rehearsal production mode requires an immutable image digest", async () => {
  const result = await runNpmScript([
    "run",
    "agent:release-rehearsal",
    "--",
    "--server",
    "https://epoch.example.test",
    "--operator-key",
    "release-rehearsal-operator-secret",
    "--expected-release-key-id",
    "b".repeat(64),
    "--production",
    "--json",
  ]);

  assert.notEqual(result.code, 0);
  const body = parseLastJsonLine(result.stdout);
  assert.equal(body.ok, false);
  assert.equal(body.error, "release_rehearsal_image_digest_required");
});

test("release rehearsal production mode requires the player token ledger and independent backup trust", async () => {
  const commonArgs = [
    "run",
    "agent:release-rehearsal",
    "--",
    "--server",
    "https://epoch.example.test",
    "--operator-key",
    "release-rehearsal-operator-secret",
    "--expected-release-key-id",
    "b".repeat(64),
    "--image-digest",
    `sha256:${"c".repeat(64)}`,
    "--production",
    "--json",
  ] as const;

  const missingLedger = await runNpmScript(commonArgs);
  assert.notEqual(missingLedger.code, 0);
  assert.equal(parseLastJsonLine(missingLedger.stdout).error, "release_rehearsal_player_mcp_token_ledger_required");

  const missingSigningKey = await runNpmScript(commonArgs, {
    AGENT_SERVER_MCP_PLAYER_TOKEN_JSONL_PATH: "/tmp/player-tokens.jsonl",
  });
  assert.notEqual(missingSigningKey.code, 0);
  assert.equal(
    parseLastJsonLine(missingSigningKey.stdout).error,
    "release_rehearsal_backup_signing_private_key_required",
  );

  const missingVerificationKey = await runNpmScript(commonArgs, {
    AGENT_SERVER_MCP_PLAYER_TOKEN_JSONL_PATH: "/tmp/player-tokens.jsonl",
    AGENT_SERVER_BACKUP_SIGNING_PRIVATE_KEY_PEM: "configured-but-not-read-before-gate",
  });
  assert.notEqual(missingVerificationKey.code, 0);
  assert.equal(
    parseLastJsonLine(missingVerificationKey.stdout).error,
    "release_rehearsal_backup_verification_public_key_required",
  );
});
