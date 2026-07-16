import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { createSequentialEpochIdFactory } from "../lib/epoch/protocol.ts";
import { createAgentHttpServer } from "../lib/httpServer.ts";
import { createAgentWorldRuntime } from "../lib/mcpTools.ts";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const graphAppRoot = resolve(repoRoot, "tools/graph-react-app");
const AGENT_SERVER_PROCESS_HEALTH_TIMEOUT_MS = 30_000;
const SUPPORTS_PROCESS_GROUP_SIGNALS = process.platform !== "win32";

async function runInstallSmokeCommand(args: string[], env: NodeJS.ProcessEnv = {}) {
  const child = spawn("npm", ["run", "agent:install-smoke", "--", ...args], {
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
  const stdout = Buffer.concat(stdoutChunks).toString("utf8");
  const stderr = Buffer.concat(stderrChunks).toString("utf8");
  return { code, stdout, stderr };
}

function commandOutputForAssert(output: { readonly stdout: string; readonly stderr: string }) {
  const stdout = output.stdout.trim();
  const stderr = output.stderr.trim();
  return [
    stderr ? `stderr:\n${stderr}` : "",
    stdout ? `stdout:\n${stdout}` : "",
  ].filter(Boolean).join("\n\n") || "command produced no output";
}

function parseLastJsonLine(stdout: string) {
  return JSON.parse(stdout.trim().split(/\r?\n/).at(-1) || "{}");
}

function assertConsoleSmoke(result: Record<string, any>) {
  assert.equal(result.consolePageVerified, true);
  assert.equal(result.consolePageUrl, "/epoch/console");
  assert.equal(result.consolePageStatus, 200);
  if (result.consoleExternalMediaUrl) {
    assert.equal(result.consoleAssetVerified, false);
    assert.equal(result.consoleAssetStatus, null);
    assert.equal(result.consoleExternalMediaVerified, true);
    assert.equal(result.consoleExternalMediaStatus, 200);
  } else {
    assert.equal(result.consoleAssetVerified, true);
    assert.equal(result.consoleAssetStatus, 200);
    assert.equal(result.consoleExternalMediaVerified, false);
    assert.equal(result.consoleExternalMediaUrl, null);
    assert.equal(result.consoleExternalMediaStatus, null);
  }
}

function assertHostConfigSmoke(result: Record<string, any>) {
  assert.equal(result.hostConfigFilesVerified, true);
  assert.equal(result.hostConfigFileCount, 7);
  assert.equal(result.hostConfigMissingStatus, 404);
  assert.equal(result.hostConfigFirstPath, "obsidian-epoch/host-config/claude-code.mcp.json");
  assert.equal(result.hostConfigLastPath, "obsidian-epoch/host-config/web-llm-bridge-sequence.json");
  assert.equal(result.hostInstallMatrixVerified, true);
  assert.deepEqual(result.hostInstallMatrixHosts, ["Claude Code", "Codex", "Cursor", "Hermes", "OpenClaw"]);
  assert.deepEqual(result.hostInstallMatrixConfigPaths, [
    "obsidian-epoch/host-config/claude-code.mcp.json",
    "obsidian-epoch/host-config/codex.mcp.json",
    "obsidian-epoch/host-config/cursor.mcp.json",
    "obsidian-epoch/host-config/hermes.mcp.json",
    "obsidian-epoch/host-config/openclaw.mcp.json",
  ]);
  assert.equal(result.hostInstallMatrixMcpCommand, "node obsidian-epoch/bin/mcp-proxy.ts");
  assert.equal(result.hostInstallMatrixServerEnv, "AGENT_WORLD_SERVER");
  assert.equal(result.hostInstallMatrixQuickstartTool, "obsidian_epoch.quickstart");
  assert.equal(result.hostInstallMatrixFirstTurnPlaybook, "obsidian-epoch/references/one-turn-playbook.md");
}

function assertStreamableMcpSmoke(result: Record<string, any>) {
  assert.equal(result.streamableMcpVerified, true);
  assert.equal(result.streamableMcpEndpoint, `${result.serverBase}/mcp`);
  assert.equal(result.streamableMcpProtocolVersion, "2025-06-18");
  assert.equal(result.streamableMcpServerName, "obsidian-epoch-agent-world");
  assert.equal(result.streamableMcpInitializedStatus, 202);
  assert.equal(result.streamableMcpGetStatus, 400);
  assert.ok(result.streamableMcpToolCount >= 1);
  assert.equal(result.streamableMcpWorldOverviewListed, true);
  assert.equal(result.streamableMcpQuickstartServerBase, result.serverBase);
}

function assertExplorerProfileSmoke(result: Record<string, any>) {
  assert.equal(result.explorerProfileVerified, true);
  assert.match(result.explorerId, /^explorer_[a-f0-9]{32}$/);
  assert.equal(result.explorerPageUrl, `/epoch/explorer/${encodeURIComponent(result.explorerId)}`);
  assert.equal(result.explorerPageStatus, 200);
}

function assertWorldOverviewToolSmoke(result: Record<string, any>) {
  assert.equal(result.worldPageVerified, true);
  assert.match(result.resultPublicSummary, /已整理为可分享摘要/);
  assert.equal(result.worldOverviewToolVerified, true);
  assert.equal(result.worldOverviewPublicPage, "/epoch/world");
}

function assertWebBridgeAuditSmoke(result: Record<string, any>) {
  assert.equal(result.webBridgeAuditPublicPagesVerified, true);
  assert.equal(result.webBridgeAuditIndexVerified, true);
  assert.equal(result.webBridgeAuditIndexUrl, "/epoch/audit");
  assert.equal(result.webBridgeAuditIndexStatus, 200);
  assert.equal(result.webBridgeAuditReplayTemplate, "/epoch/audit/{eventId}");
  assert.equal(result.webBridgeAuditReplayVerified, true);
  assert.match(result.webBridgeAuditReplayUrl, /^\/epoch\/audit\//);
  assert.equal(result.webBridgeAuditReplayStatus, 200);
}

function assertWebBridgeTrustSmoke(result: Record<string, any>) {
  assert.equal(result.webBridgeVerified, true);
  assert.equal(result.webBridgeChannelClass, "browser_copy_paste");
  assert.equal(result.webBridgeDeliveryTrust, "untrusted_client");
  assert.equal(result.webBridgeActionChannelClass, "browser_copy_paste");
  assert.equal(result.webBridgeActionDeliveryTrust, "untrusted_client");
  assert.equal(result.webBridgeResultFocusChannelClass, "browser_copy_paste");
  assert.equal(result.webBridgePostResultMutationRejected, true);
  assert.equal(result.webBridgePostResultMutationError, "hosted_session_not_active");
}

function assertPackageIntegritySmoke(result: Record<string, any>) {
  assert.equal(result.packageIntegrityVerified, true);
  assert.equal(result.packageFileIntegrityVerified, true);
  assert.equal(result.packageFileSignatureVerified, true);
  assert.equal(result.packageSignatureAlgorithm, "Ed25519");
  assert.equal(result.packageFileIntegrityManifest, "obsidian-epoch/assets/package-integrity.json");
  assert.ok(result.packageFileIntegrityFileCount > 1);
  assert.match(result.packageReleasePublicKey, /^[A-Za-z0-9+/]+={0,2}$/);
  assert.match(result.packageReleaseKeyId, /^[a-f0-9]{64}$/);
  assert.equal(result.packageSigningTrust, "local_alpha_fallback");
  assert.equal(result.packageSigningKeySource, "ephemeral_local_alpha_fallback");
  assert.equal(result.installSmokeCommand, "npm run agent:install-smoke -- --json");
  assert.equal(result.remoteInstallSmokeCommand, "npm run agent:install-smoke -- --server <serverBase> --json");
  assert.equal(result.releaseRehearsalCommand, "npm run agent:release-rehearsal -- --server <serverBase> --operator-key <operatorKey> --json");
  assert.equal(result.productionReleaseRehearsalCommand, "npm run agent:release-rehearsal -- --server <publicHttpsOrigin> --operator-key <operatorKey> --expected-release-key-id <releaseKeyId> --production --json");
  assert.equal(result.recoveryDrillCommand, "npm run agent:recovery-drill -- --json");
  assert.equal(result.backupCommand, "npm run agent:backup -- --json");
  assert.equal(result.restoreBackupCommand, "npm run agent:restore-backup -- --json");
}

function assertHealthSmoke(result: Record<string, any>) {
  assert.equal(result.healthStatus, 200);
  assert.equal(result.healthOk, true);
  assert.equal(result.epochHealthStatus, 200);
  assert.equal(result.epochHealthOk, true);
  assert.deepEqual(result.epochHealthChecks, result.healthChecks);
  assert.deepEqual(result.manifestHealth, {
    readiness: "/api/health",
    epochReadiness: "/api/epoch/health",
  });
  assert.equal(result.healthChecks.store.status, "ok");
  assert.equal(result.healthChecks.maintenance.status, "unconfigured");
  assert.equal(result.healthChecks.recovery.status, "unavailable");
  assert.equal(result.healthChecks.recovery.persistent, false);
}

async function withBackingServer(
  seed: string,
  run: (baseUrl: string) => Promise<void>,
  options: { readonly consoleAssetBaseUrl?: string; readonly mcpBearerToken?: string } = {},
) {
  const runtime = createAgentWorldRuntime({
    epoch: {
      idFactory: createSequentialEpochIdFactory(seed),
    },
  });
  const server = createAgentHttpServer({
    runtime,
    consoleAssetBaseUrl: options.consoleAssetBaseUrl,
    mcpBearerToken: options.mcpBearerToken,
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
      server.closeAllConnections();
    });
  }
}

async function withExternalMediaServer(
  status: number,
  run: (baseUrl: string, requests: string[]) => Promise<void>,
) {
  const requests: string[] = [];
  const server = createServer((request, response) => {
    requests.push(request.url || "");
    response.statusCode = status;
    response.setHeader("content-type", "image/png");
    response.end(status === 200 ? Buffer.from("external-media-smoke") : "missing");
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  try {
    await run(`http://127.0.0.1:${address.port}`, requests);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
      server.closeAllConnections();
    });
  }
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

test("npm install smoke command proves MCP package can play one server turn", async () => {
  const { code, stdout, stderr } = await runInstallSmokeCommand(["--json"], {
    AGENT_INSTALL_SMOKE_SEED: "test_install_smoke",
  });

  assert.equal(code, 0, commandOutputForAssert({ stdout, stderr }));
  const result = parseLastJsonLine(stdout);
  assert.equal(result.ok, true);
  assert.match(result.serverBase, /^http:\/\/127\.0\.0\.1:\d+$/);
  assert.match(result.agentId, /^test_install_smoke_agent_/);
  assert.match(result.resultPageUrl, /^\/epoch\/result\//);
  assert.match(result.webBridgeSessionId, /^test_install_smoke_session_browser_copy_paste/);
  assert.match(result.webBridgeResultPageUrl, /^\/epoch\/result\//);
  assert.equal(result.resultPlayMode, "ranked");
  assert.equal(result.resultTrustTier, "server_settled");
  assert.equal(result.webBridgeResultPlayMode, "casual");
  assert.equal(result.webBridgeResultTrustTier, "untrusted_capped");
  assert.equal(result.agentPageStatus, 200);
  assert.equal(result.resultPageStatus, 200);
  assert.equal(result.webBridgeResultPageStatus, 200);
  assertHealthSmoke(result);
  assert.equal(result.installManifestStatus, 200);
  assertPackageIntegritySmoke(result);
  assert.equal(result.packageProxyVerified, true);
  assertWebBridgeTrustSmoke(result);
  assertConsoleSmoke(result);
  assertHostConfigSmoke(result);
  assertStreamableMcpSmoke(result);
  assertExplorerProfileSmoke(result);
  assertWorldOverviewToolSmoke(result);
  assertWebBridgeAuditSmoke(result);
  assert.equal(result.packageMcpCommand, "node obsidian-epoch/bin/mcp-proxy.ts");
  assert.match(result.packageSha256, /^[a-f0-9]{64}$/);
  assert.ok(result.packageBytes > 1_000);
  assert.equal(result.via, "stdio-mcp");
});

test("npm install smoke command can target an existing AGENT_WORLD_SERVER", async () => {
  await withBackingServer("env_remote_smoke", async (baseUrl) => {
    const { code, stdout, stderr } = await runInstallSmokeCommand(["--json"], {
      AGENT_WORLD_SERVER: baseUrl,
      AGENT_INSTALL_SMOKE_SEED: "env_remote_smoke",
    });

    assert.equal(code, 0, commandOutputForAssert({ stdout, stderr }));
    const result = parseLastJsonLine(stdout);
    assert.equal(result.ok, true);
    assert.equal(result.mode, "remote");
    assert.equal(result.serverBase, baseUrl);
    assert.match(result.agentId, /^env_remote_smoke_agent_/);
    assert.match(result.webBridgeSessionId, /^env_remote_smoke_session_browser_copy_paste/);
    assert.match(result.webBridgeResultPageUrl, /^\/epoch\/result\//);
    assert.equal(result.agentPageStatus, 200);
    assert.equal(result.resultPageStatus, 200);
    assert.equal(result.webBridgeResultPageStatus, 200);
    const resultPageResponse = await fetch(new URL(result.resultPageUrl, baseUrl));
    assert.equal(resultPageResponse.status, 200);
    const resultPageHtml = await resultPageResponse.text();
    assert.match(resultPageHtml, /<h1>[^<]*探索历程<\/h1>/);
    assert.doesNotMatch(resultPageHtml, /Install smoke/i);
    assert.doesNotMatch(resultPageHtml, /<p class="public-safe-summary">[^<]*Install Smoke Runner/);
    assert.doesNotMatch(resultPageHtml, /<em>Agent<\/em>/);
    assert.doesNotMatch(resultPageHtml, /<em>Explorer<\/em>/);
    assert.match(resultPageHtml, /接下来去哪/);
    assert.match(resultPageHtml, /href="\/epoch\/console"/);
    assert.match(resultPageHtml, /恢复身份后可继续/);
    assert.doesNotMatch(resultPageHtml, /需要身份授权/);
    assert.match(resultPageHtml, /历程时间线/);
    assert.match(resultPageHtml, /完成行动/);
    assert.match(resultPageHtml, /收获入账/);
    assert.match(resultPageHtml, /校验证明/);
    assert.match(resultPageHtml, /<details class="server-receipt">/);
    assert.doesNotMatch(resultPageHtml, /<summary>技术标识<\/summary>/);
    assert.doesNotMatch(resultPageHtml, /<h2>服务器收据<\/h2>/);
    assert.doesNotMatch(resultPageHtml, /<h2>最近事件<\/h2>/);
    assert.doesNotMatch(resultPageHtml, />resource_granted</);
    assert.doesNotMatch(resultPageHtml, /region_gray_harbor 异常警报/);
    assert.doesNotMatch(resultPageHtml, /T2_local_secret|T0_public|social_hook|anomaly/);
    assertHealthSmoke(result);
    assert.equal(result.installManifestStatus, 200);
    assertPackageIntegritySmoke(result);
    assert.equal(result.packageProxyVerified, true);
    assertWebBridgeTrustSmoke(result);
    assertConsoleSmoke(result);
    assertHostConfigSmoke(result);
    assertStreamableMcpSmoke(result);
    assertExplorerProfileSmoke(result);
    assertWorldOverviewToolSmoke(result);
    assertWebBridgeAuditSmoke(result);
    assert.equal(result.packageMcpCommand, "node obsidian-epoch/bin/mcp-proxy.ts");
    assert.match(result.packageSha256, /^[a-f0-9]{64}$/);
    assert.ok(result.packageBytes > 1_000);
  });
});

test("npm install smoke command accepts --server for remote deployment checks", async () => {
  await withBackingServer("arg_remote_smoke", async (baseUrl) => {
    const { code, stdout, stderr } = await runInstallSmokeCommand(["--server", baseUrl, "--json"], {
      AGENT_INSTALL_SMOKE_SEED: "arg_remote_smoke",
    });

    assert.equal(code, 0, commandOutputForAssert({ stdout, stderr }));
    const result = parseLastJsonLine(stdout);
    assert.equal(result.ok, true);
    assert.equal(result.mode, "remote");
    assert.equal(result.serverBase, baseUrl);
    assert.match(result.agentId, /^arg_remote_smoke_agent_/);
    assert.match(result.webBridgeSessionId, /^arg_remote_smoke_session_browser_copy_paste/);
    assert.match(result.webBridgeResultPageUrl, /^\/epoch\/result\//);
    assert.equal(result.agentPageStatus, 200);
    assert.equal(result.resultPageStatus, 200);
    assert.equal(result.webBridgeResultPageStatus, 200);
    assertHealthSmoke(result);
    assert.equal(result.installManifestStatus, 200);
    assertPackageIntegritySmoke(result);
    assert.equal(result.packageProxyVerified, true);
    assertWebBridgeTrustSmoke(result);
    assertConsoleSmoke(result);
    assertHostConfigSmoke(result);
    assertStreamableMcpSmoke(result);
    assertExplorerProfileSmoke(result);
    assertWorldOverviewToolSmoke(result);
    assertWebBridgeAuditSmoke(result);
    assert.equal(result.packageMcpCommand, "node obsidian-epoch/bin/mcp-proxy.ts");
    assert.match(result.packageSha256, /^[a-f0-9]{64}$/);
    assert.ok(result.packageBytes > 1_000);
  });
});

test("npm install smoke command fails clearly when remote MCP requires a missing bearer token", async () => {
  await withBackingServer("missing_mcp_token_smoke", async (baseUrl) => {
    const { code, stdout } = await runInstallSmokeCommand(["--server", baseUrl, "--json"], {
      AGENT_INSTALL_SMOKE_SEED: "missing_mcp_token_smoke",
      AGENT_WORLD_MCP_TOKEN: "",
    });

    assert.notEqual(code, 0);
    const result = parseLastJsonLine(stdout);
    assert.equal(result.ok, false);
    assert.equal(result.error, "install_smoke_mcp_token_required");
  }, {
    mcpBearerToken: "missing-mcp-token-smoke-at-least-32-characters",
  });
});

test("npm install smoke command uses AGENT_WORLD_MCP_TOKEN for authenticated remote MCP", async () => {
  const mcpToken = "env-mcp-token-smoke-at-least-32-characters";
  await withBackingServer("env_mcp_token_smoke", async (baseUrl) => {
    const { code, stdout, stderr } = await runInstallSmokeCommand(["--server", baseUrl, "--json"], {
      AGENT_INSTALL_SMOKE_SEED: "env_mcp_token_smoke",
      AGENT_WORLD_MCP_TOKEN: mcpToken,
    });

    assert.equal(code, 0, commandOutputForAssert({ stdout, stderr }));
    const result = parseLastJsonLine(stdout);
    assert.equal(result.ok, true);
    assert.equal(result.mode, "remote");
    assert.equal(result.serverBase, baseUrl);
    assert.equal(result.packageProxyVerified, true);
    assertStreamableMcpSmoke(result);
    assertWorldOverviewToolSmoke(result);
  }, {
    mcpBearerToken: mcpToken,
  });
});

test("npm install smoke command accepts --mcp-token for authenticated remote MCP", async () => {
  const mcpToken = "arg-mcp-token-smoke-at-least-32-characters";
  await withBackingServer("arg_mcp_token_smoke", async (baseUrl) => {
    const { code, stdout, stderr } = await runInstallSmokeCommand(["--server", baseUrl, "--mcp-token", mcpToken, "--json"], {
      AGENT_INSTALL_SMOKE_SEED: "arg_mcp_token_smoke",
      AGENT_WORLD_MCP_TOKEN: "",
    });

    assert.equal(code, 0, commandOutputForAssert({ stdout, stderr }));
    const result = parseLastJsonLine(stdout);
    assert.equal(result.ok, true);
    assert.equal(result.mode, "remote");
    assert.equal(result.serverBase, baseUrl);
    assert.equal(result.packageProxyVerified, true);
    assertStreamableMcpSmoke(result);
    assertWorldOverviewToolSmoke(result);
  }, {
    mcpBearerToken: mcpToken,
  });
});

test("npm install smoke command verifies rewritten external console media URLs", async () => {
  await withExternalMediaServer(200, async (mediaBaseUrl, mediaRequests) => {
    await withBackingServer("external_console_media_smoke", async (baseUrl) => {
      const { code, stdout, stderr } = await runInstallSmokeCommand(["--server", baseUrl, "--json"], {
        AGENT_INSTALL_SMOKE_SEED: "external_console_media_smoke",
      });

      assert.equal(code, 0, commandOutputForAssert({ stdout, stderr }));
      const result = parseLastJsonLine(stdout);
      assert.equal(result.ok, true);
      assertConsoleSmoke(result);
      assert.equal(result.consoleExternalMediaVerified, true);
      assert.equal(result.consoleExternalMediaStatus, 200);
      assert.equal(typeof result.consoleExternalMediaUrl, "string");
      assert.ok(result.consoleExternalMediaUrl.startsWith(`${mediaBaseUrl}/`));
      assert.ok(mediaRequests.some((requestPath) => /\.png(?:\?|$)/.test(requestPath)));
    }, {
      consoleAssetBaseUrl: mediaBaseUrl,
    });
  });
});

test("npm install smoke command fails when rewritten external console media is inaccessible", async () => {
  await withExternalMediaServer(404, async (mediaBaseUrl) => {
    await withBackingServer("external_console_media_missing_smoke", async (baseUrl) => {
      const { code, stdout } = await runInstallSmokeCommand(["--server", baseUrl, "--json"], {
        AGENT_INSTALL_SMOKE_SEED: "external_console_media_missing_smoke",
      });

      assert.notEqual(code, 0);
      const result = parseLastJsonLine(stdout);
      assert.equal(result.ok, false);
      assert.equal(result.error, "install_smoke_console_external_media_failed");
    }, {
      consoleAssetBaseUrl: mediaBaseUrl,
    });
  });
});

test("npm install smoke command can require rewritten external console media", async () => {
  await withBackingServer("external_console_media_required_smoke", async (baseUrl) => {
    const { code, stdout } = await runInstallSmokeCommand(["--server", baseUrl, "--require-external-console-media", "--json"], {
      AGENT_INSTALL_SMOKE_SEED: "external_console_media_required_smoke",
    });

    assert.notEqual(code, 0);
    const result = parseLastJsonLine(stdout);
    assert.equal(result.ok, false);
    assert.equal(result.error, "install_smoke_console_external_media_missing");
  });
});

test("agent server process supports MCP alias and package install smoke", async () => {
  const port = await reserveFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const dataDir = await mkdtemp(resolve(tmpdir(), "agent-server-process-smoke-"));
  const child = spawn("npm", ["run", "agent:server"], {
    cwd: graphAppRoot,
    detached: SUPPORTS_PROCESS_GROUP_SIGNALS,
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      AGENT_SERVER_HOST: "127.0.0.1",
      AGENT_SERVER_PORT: String(port),
      AGENT_SERVER_DATA_DIR: dataDir,
    },
  });
  const outputChunks: Buffer[] = [];
  child.stdout.on("data", (chunk) => outputChunks.push(Buffer.from(chunk)));
  child.stderr.on("data", (chunk) => outputChunks.push(Buffer.from(chunk)));
  const childOutput = () => Buffer.concat(outputChunks).toString("utf8");

  try {
    await waitForHealthyServer(baseUrl, childOutput);
    const aliasResponse = await fetch(`${baseUrl}/api/epoch/mcp`, {
      method: "POST",
      headers: {
        "accept": "application/json, text/event-stream",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "process-smoke-init",
        method: "initialize",
        params: {
          protocolVersion: "2025-06-18",
          capabilities: {},
          clientInfo: {
            name: "obsidian-epoch-process-smoke",
            version: "0.1.0",
          },
        },
      }),
    });
    assert.equal(aliasResponse.status, 200);
    const aliasBody = await aliasResponse.json();
    assert.equal(aliasBody?.result?.serverInfo?.name, "obsidian-epoch-agent-world");

    const { code, stdout, stderr } = await runInstallSmokeCommand(["--server", baseUrl, "--json"], {
      AGENT_INSTALL_SMOKE_SEED: "process_server_smoke",
    });
    assert.equal(code, 0, `${commandOutputForAssert({ stdout, stderr })}\n\nserver:\n${childOutput()}`);
    const result = parseLastJsonLine(stdout);
    assert.equal(result.ok, true);
    assert.equal(result.mode, "remote");
    assert.equal(result.serverBase, baseUrl);
    assertWebBridgeTrustSmoke(result);
    assertStreamableMcpSmoke(result);
  } finally {
    await stopChildProcess(child);
    await rm(dataDir, { recursive: true, force: true });
  }
});

test("npm install smoke command can require operator release signing for production checks", async () => {
  await withBackingServer("require_operator_signing_smoke", async (baseUrl) => {
    const { code, stdout } = await runInstallSmokeCommand(["--server", baseUrl, "--require-operator-signing", "--json"], {
      AGENT_INSTALL_SMOKE_SEED: "require_operator_signing_smoke",
    });

    assert.notEqual(code, 0);
    const result = parseLastJsonLine(stdout);
    assert.equal(result.ok, false);
    assert.equal(result.error, "install_smoke_operator_signing_required");
  });
});

test("npm install smoke production checks require a remote public server", async () => {
  const { code, stdout } = await runInstallSmokeCommand(["--production", "--json"], {
    AGENT_INSTALL_SMOKE_SEED: "production_requires_remote_smoke",
  });

  assert.notEqual(code, 0);
  const result = parseLastJsonLine(stdout);
  assert.equal(result.ok, false);
  assert.equal(result.error, "install_smoke_production_requires_remote_server");
});

test("npm install smoke production checks reject localhost server origins", async () => {
  await withBackingServer("production_rejects_localhost_smoke", async (baseUrl) => {
    const { code, stdout } = await runInstallSmokeCommand(["--server", baseUrl, "--production", "--json"], {
      AGENT_INSTALL_SMOKE_SEED: "production_rejects_localhost_smoke",
    });

    assert.notEqual(code, 0);
    const result = parseLastJsonLine(stdout);
    assert.equal(result.ok, false);
    assert.equal(result.error, "install_smoke_production_server_must_be_public_https");
  });
});

test("npm install smoke command can pin an expected release key id", async () => {
  await withBackingServer("expected_release_key_smoke", async (baseUrl) => {
    const { code, stdout } = await runInstallSmokeCommand([
      "--server",
      baseUrl,
      "--expected-release-key-id",
      "0000000000000000000000000000000000000000000000000000000000000000",
      "--json",
    ], {
      AGENT_INSTALL_SMOKE_SEED: "expected_release_key_smoke",
    });

    assert.notEqual(code, 0);
    const result = parseLastJsonLine(stdout);
    assert.equal(result.ok, false);
    assert.equal(result.error, "install_smoke_release_key_id_mismatch");
  });
});

test("npm install smoke command uses a fresh default seed for repeated remote checks", async () => {
  await withBackingServer("repeat_remote_smoke", async (baseUrl) => {
    const first = await runInstallSmokeCommand(["--server", baseUrl, "--json"], {
      AGENT_INSTALL_SMOKE_SEED: "",
    });
    const second = await runInstallSmokeCommand(["--server", baseUrl, "--json"], {
      AGENT_INSTALL_SMOKE_SEED: "",
    });

    assert.equal(first.code, 0, first.stderr || first.stdout);
    assert.equal(second.code, 0, second.stderr || second.stdout);
    const firstResult = parseLastJsonLine(first.stdout);
    const secondResult = parseLastJsonLine(second.stdout);
    assert.equal(firstResult.ok, true);
    assert.equal(secondResult.ok, true);
    assertWebBridgeTrustSmoke(firstResult);
    assertWebBridgeTrustSmoke(secondResult);
    assertConsoleSmoke(firstResult);
    assertConsoleSmoke(secondResult);
    assertHostConfigSmoke(firstResult);
    assertHostConfigSmoke(secondResult);
    assertStreamableMcpSmoke(firstResult);
    assertStreamableMcpSmoke(secondResult);
    assertExplorerProfileSmoke(firstResult);
    assertExplorerProfileSmoke(secondResult);
    assertWorldOverviewToolSmoke(firstResult);
    assertWorldOverviewToolSmoke(secondResult);
    assertWebBridgeAuditSmoke(firstResult);
    assertWebBridgeAuditSmoke(secondResult);
    assert.notEqual(firstResult.agentId, secondResult.agentId);
    assert.notEqual(firstResult.webBridgeSessionId, secondResult.webBridgeSessionId);
  });
});
