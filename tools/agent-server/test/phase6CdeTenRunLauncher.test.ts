import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { inspectRawLine } from "../phase6-cde-ten-run-launcher.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const launcherPath = resolve(repoRoot, "tools/agent-server/phase6-cde-ten-run-launcher.mjs");
const secret = "sk-zhipuSecret123456";
const authSecret = "zhipu-auth-token-secret-123456";
const toolResultSecret = "sk-toolResultSecret987654";
const toolResultContent = "SYNTHETIC_TOOL_FAILURE_CONTENT";
const recoveryCode = "phase6-private-recovery-code-fixture";
const model = "cde-glm-test";
const promptText = "Run Phase 6 synthetic prompt.\n";
const expectedRuntimeTools = [
  "obsidian_epoch.register_explorer",
  "obsidian_epoch.reincarnate",
  "obsidian_epoch.begin_phase6_experiment",
  "obsidian_epoch.prepare_journey",
  "obsidian_epoch.player_panel",
  "obsidian_epoch.progress",
  "obsidian_epoch.world_overview",
  "obsidian_epoch.world_content",
  "obsidian_epoch.inventory",
  "obsidian_epoch.shop",
  "obsidian_epoch.purchase_shop_offer",
  "obsidian_epoch.craft_item",
  "obsidian_epoch.begin_phase6_run",
  "obsidian_epoch.start_journey_compact",
  "obsidian_epoch.journey_status_compact",
  "obsidian_epoch.propose_journey_step_compact",
  "obsidian_epoch.commit_journey_action_compact",
  "obsidian_epoch.phase6_experiment_status",
  "obsidian_epoch.run_receipt_compact",
  "obsidian_epoch.phase6_result_compact",
];
const expectedAllowedTools = expectedRuntimeTools.map(
  (tool) => `mcp__obsidian_epoch__${tool.replace(/\./g, "_")}`,
);

async function withHealthServer(fn) {
  const child = spawn(process.execPath, ["-e", `
const { createServer } = require("node:http");
const server = createServer((req, res) => {
  if (req.url === "/api/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }
  res.writeHead(404);
  res.end();
});
server.listen(0, "127.0.0.1", () => {
  const address = server.address();
  console.log("http://127.0.0.1:" + address.port);
});
process.on("SIGTERM", () => server.close(() => process.exit(0)));
`], { stdio: ["ignore", "pipe", "pipe"] });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => { stdout += chunk.toString("utf8"); });
  child.stderr.on("data", (chunk) => { stderr += chunk.toString("utf8"); });
  const serverBase = await new Promise((resolveServer, rejectServer) => {
    const timer = setTimeout(() => rejectServer(new Error(`health server did not start: ${stderr}`)), 5000);
    child.stdout.on("data", () => {
      const line = stdout.trim().split(/\r?\n/)[0];
      if (line) {
        clearTimeout(timer);
        resolveServer(line);
      }
    });
    child.on("exit", (code) => rejectServer(new Error(`health server exited ${code}: ${stderr}`)));
  });
  try {
    await fn(serverBase);
  } finally {
    child.kill("SIGTERM");
    await new Promise((resolve) => child.once("exit", resolve));
  }
}

function makeFixtureRoot() {
  const root = mkdtempSync(join(tmpdir(), "phase6-cde-launcher-test-"));
  const promptPath = join(root, "prompt.md");
  const adapterPath = join(root, "mcp-adapter.mjs");
  const recoveryCodePath = join(root, "recovery-code");
  writeFileSync(promptPath, promptText, "utf8");
  writeFileSync(adapterPath, "process.exit(0);\n", "utf8");
  writeFileSync(recoveryCodePath, recoveryCode, { mode: 0o600 });
  return { root, promptPath, adapterPath, recoveryCodePath };
}

function makeFakeClaude(root) {
  const fakeClaudePath = join(root, "fake-claude.mjs");
  writeFileSync(fakeClaudePath, `#!/usr/bin/env node
import { appendFileSync, existsSync, writeFileSync } from "node:fs";
const capturePath = process.env.PHASE6_FAKE_CAPTURE;
const scenario = process.env.PHASE6_FAKE_SCENARIO || "success";
const marker = process.env.PHASE6_FAKE_MARKER;
const configIndex = process.argv.indexOf("--mcp-config");
const payload = {
  argv: process.argv.slice(2),
  cwd: process.cwd(),
  hasGitCwd: existsSync(process.cwd() + "/.git"),
  mcpConfigPath: configIndex >= 0 ? process.argv[configIndex + 1] : undefined,
  anthropicApiKeyMapped: process.env.ANTHROPIC_API_KEY === "${secret}",
  anthropicAuthTokenMapped: process.env.ANTHROPIC_AUTH_TOKEN === "${authSecret}",
  anthropicBaseUrlMapped: process.env.ANTHROPIC_BASE_URL === "http://zhipu.example.test",
  anthropicModelMapped: process.env.ANTHROPIC_MODEL === "${model}",
  defaultSonnetModelMapped: process.env.ANTHROPIC_DEFAULT_SONNET_MODEL === "${model}",
  defaultOpusModelMapped: process.env.ANTHROPIC_DEFAULT_OPUS_MODEL === "${model}",
  defaultHaikuModelMapped: process.env.ANTHROPIC_DEFAULT_HAIKU_MODEL === "${model}",
  subagentModelMapped: process.env.CLAUDE_CODE_SUBAGENT_MODEL === "${model}",
  recoveryCodeFileLeakedToClaude: Boolean(process.env.PHASE6_MCP_RECOVERY_CODE_FILE),
};
appendFileSync(capturePath, JSON.stringify(payload) + "\\n");
if (scenario === "rate-before-tool" && marker && !existsSync(marker)) {
  writeFileSync(marker, "seen");
  const reset = new Date(Date.now() - 1000);
  const pad = (value) => String(value).padStart(2, "0");
  const resetText = reset.getFullYear() + "-" + pad(reset.getMonth() + 1) + "-" + pad(reset.getDate())
    + " " + pad(reset.getHours()) + ":" + pad(reset.getMinutes()) + ":" + pad(reset.getSeconds());
  console.error("warning: mcp__ adapter emitted an ordinary diagnostic");
  console.log(JSON.stringify({ type: "error", status: 429, error: { type: "rate_limit_error", message: "将在 " + resetText + " 重置" } }));
  process.exit(1);
}
if (scenario === "rate-after-tool") {
  console.log(JSON.stringify({ type: "assistant", message: { content: [{ type: "tool_use", name: "mcp__obsidian_epoch__obsidian_epoch_register_explorer" }] } }));
  console.log(JSON.stringify({ type: "error", status: 429, error: { type: "rate_limit_error" }, resetAt: Date.now() - 1000 }));
  process.exit(1);
}
if (scenario === "truncated-tool-before-rate") {
  console.log('{"type":"assistant","message":{"content":[{"type":"tool_use","name":"mcp__obsidian_epoch__obsidian_epoch_register_explorer"');
  console.log(JSON.stringify({ type: "error", status: 429, error: { type: "rate_limit_error" }, resetAt: Date.now() - 1000 }));
  process.exit(1);
}
if (scenario === "tool-execution-error") {
  process.once("SIGTERM", () => {
    if (marker) writeFileSync(marker, "SIGTERM");
    process.exit(143);
  });
  console.log(JSON.stringify({
    type: "assistant",
    message: { content: [{ type: "tool_use", id: "tool-1", name: "mcp__obsidian_epoch__obsidian_epoch_register_explorer" }] },
  }));
  console.log(JSON.stringify({
    type: "user",
    message: {
      role: "user",
      content: [{
        type: "tool_result",
        tool_use_id: "tool-1",
        is_error: true,
        content: "${toolResultContent}: ${toolResultSecret}",
      }],
    },
  }));
  await new Promise((resolve) => setTimeout(resolve, 8000));
  process.exit(0);
}
if (scenario === "secret-stderr-fail") {
  console.error("authorization: Bearer SHOULD_REDACT_123456789");
  console.error("apiKey=${secret}");
  console.error("authToken=${authSecret}");
  process.exit(1);
}
if (scenario === "no-tool-success") {
  console.log(JSON.stringify({ type: "assistant", message: { content: [{ type: "text", text: "RAW_STREAM_SENTINEL" }] } }));
  console.log(JSON.stringify({ type: "result", subtype: "success" }));
  process.exit(0);
}
console.log(JSON.stringify({
  type: "assistant",
  message: { content: [{ type: "tool_use", id: "tool-success", name: "mcp__obsidian_epoch__obsidian_epoch_register_explorer" }] },
}));
console.log(JSON.stringify({ type: "assistant", message: { content: [{ type: "text", text: "RAW_STREAM_SENTINEL" }] } }));
console.log(JSON.stringify({ type: "result", subtype: "success" }));
`, "utf8");
  chmodSync(fakeClaudePath, 0o755);
  return fakeClaudePath;
}

function runLauncher({ root, promptPath, adapterPath, recoveryCodePath, fakeClaudePath, serverBase, rawPath, statePath, scenario = "success", marker }) {
  return spawnSync(process.execPath, [
    launcherPath,
    "--prompt",
    promptPath,
    "--server-base",
    serverBase,
    "--raw-output",
    rawPath,
    "--state-output",
    statePath,
    "--claude-bin",
    fakeClaudePath,
    "--mcp-adapter-bin",
    adapterPath,
  ], {
    encoding: "utf8",
    env: {
      ...process.env,
      ZHIPU_API_KEY: secret,
      ZHIPU_AUTH_TOKEN: authSecret,
      ZHIPU_BASE_URL: "http://zhipu.example.test",
      ZHIPU_MODEL: model,
      ANTHROPIC_API_KEY: "must-be-overridden",
      ANTHROPIC_AUTH_TOKEN: "must-be-overridden",
      ANTHROPIC_BASE_URL: "must-be-overridden",
      ANTHROPIC_MODEL: "must-be-overridden",
      ANTHROPIC_DEFAULT_SONNET_MODEL: "must-be-overridden",
      ANTHROPIC_DEFAULT_OPUS_MODEL: "must-be-overridden",
      ANTHROPIC_DEFAULT_HAIKU_MODEL: "must-be-overridden",
      CLAUDE_CODE_SUBAGENT_MODEL: "must-be-overridden",
      PHASE6_FAKE_CAPTURE: join(root, "capture.jsonl"),
      PHASE6_FAKE_SCENARIO: scenario,
      PHASE6_MCP_RECOVERY_CODE_FILE: recoveryCodePath,
      ...(marker ? { PHASE6_FAKE_MARKER: marker } : {}),
    },
    maxBuffer: 16 * 1024 * 1024,
  });
}

test("Phase 6 CDE launcher starts Claude without shell from a non-Git temp cwd and keeps raw/config private", async () => {
  await withHealthServer(async (serverBase) => {
    const fixture = makeFixtureRoot();
    try {
      const fakeClaudePath = makeFakeClaude(fixture.root);
      const rawPath = join(fixture.root, "raw.jsonl");
      const statePath = join(fixture.root, "state.json");
      const result = runLauncher({ ...fixture, fakeClaudePath, serverBase, rawPath, statePath });

      assert.equal(result.status, 0, result.stderr || result.stdout);
      assert.equal(result.stdout.includes("RAW_STREAM_SENTINEL"), false);
      assert.equal(statSync(rawPath).mode & 0o777, 0o600);
      assert.equal(statSync(statePath).mode & 0o777, 0o600);
      assert.match(readFileSync(rawPath, "utf8"), /RAW_STREAM_SENTINEL/);

      const capture = JSON.parse(readFileSync(join(fixture.root, "capture.jsonl"), "utf8").trim());
      assert.equal(capture.hasGitCwd, false);
      assert.equal(capture.anthropicApiKeyMapped, true);
      assert.equal(capture.anthropicAuthTokenMapped, true);
      assert.equal(capture.anthropicBaseUrlMapped, true);
      assert.equal(capture.anthropicModelMapped, true);
      assert.equal(capture.defaultSonnetModelMapped, true);
      assert.equal(capture.defaultOpusModelMapped, true);
      assert.equal(capture.defaultHaikuModelMapped, true);
      assert.equal(capture.subagentModelMapped, true);
      assert.equal(capture.recoveryCodeFileLeakedToClaude, false);
      assert.deepEqual(capture.argv, [
        "--print",
        "--input-format",
        "text",
        "--output-format",
        "stream-json",
        "--verbose",
        "--bare",
        "--tools",
        "",
        "--mcp-config",
        capture.mcpConfigPath,
        "--strict-mcp-config",
        "--allowedTools",
        ...expectedAllowedTools,
        "--max-turns",
        "360",
        "--effort",
        "high",
        promptText,
      ]);
      assert.equal(capture.argv.join(" ").includes(secret), false);
      assert.equal(capture.argv.join(" ").includes(authSecret), false);

      const mcpConfig = JSON.parse(readFileSync(capture.mcpConfigPath, "utf8"));
      assert.equal(statSync(capture.mcpConfigPath).mode & 0o777, 0o600);
      assert.equal(statSync(fixture.adapterPath).mode & 0o111, 0);
      assert.deepEqual(Object.keys(mcpConfig.mcpServers), ["obsidian_epoch"]);
      assert.deepEqual(mcpConfig.mcpServers.obsidian_epoch, {
        type: "stdio",
        command: process.execPath,
        args: [fixture.adapterPath],
        env: {
          AGENT_WORLD_SERVER: serverBase,
          PHASE6_MCP_TOOL_ALLOWLIST: JSON.stringify(expectedRuntimeTools),
          PHASE6_MCP_RECOVERY_CODE_FILE: fixture.recoveryCodePath,
        },
      });
      const runtimeAllowlist = JSON.parse(mcpConfig.mcpServers.obsidian_epoch.env.PHASE6_MCP_TOOL_ALLOWLIST);
      assert.deepEqual(runtimeAllowlist, expectedRuntimeTools);
      assert.equal(runtimeAllowlist.length, 20);
      assert.equal(new Set(runtimeAllowlist).size, 20);
      const stateText = readFileSync(statePath, "utf8");
      const state = JSON.parse(stateText);
      assert.equal(state.maxTurns, 360);
      assert.equal(state.privateRecoveryBrokerConfigured, true);
      assert.deepEqual(state.allowedMcpTools, expectedAllowedTools);
      assert.equal(stateText.includes(secret), false);
      assert.equal(stateText.includes(authSecret), false);
      assert.equal(stateText.includes(recoveryCode), false);
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });
});

test("Phase 6 CDE launcher safely retries a 429 only before any tool_use", async () => {
  await withHealthServer(async (serverBase) => {
    const fixture = makeFixtureRoot();
    try {
      const fakeClaudePath = makeFakeClaude(fixture.root);
      const rawPath = join(fixture.root, "raw.jsonl");
      const statePath = join(fixture.root, "state.json");
      const marker = join(fixture.root, "first-attempt");
      const result = runLauncher({ ...fixture, fakeClaudePath, serverBase, rawPath, statePath, scenario: "rate-before-tool", marker });

      assert.equal(result.status, 0, result.stderr || result.stdout);
      const captures = readFileSync(join(fixture.root, "capture.jsonl"), "utf8").trim().split("\n");
      assert.equal(captures.length, 2);
      const state = JSON.parse(readFileSync(statePath, "utf8"));
      assert.equal(state.status, "finished");
      assert.equal(state.unparseableStreamLine, false);
      assert.equal(state.partialEvidence, false);
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });
});

test("Phase 6 CDE launcher rejects a successful model exit without MCP tool execution", async () => {
  await withHealthServer(async (serverBase) => {
    const fixture = makeFixtureRoot();
    try {
      const fakeClaudePath = makeFakeClaude(fixture.root);
      const rawPath = join(fixture.root, "raw.jsonl");
      const statePath = join(fixture.root, "state.json");
      const result = runLauncher({ ...fixture, fakeClaudePath, serverBase, rawPath, statePath, scenario: "no-tool-success" });

      assert.equal(result.status, 1);
      const state = JSON.parse(readFileSync(statePath, "utf8"));
      assert.equal(state.status, "failed");
      assert.equal(state.classification, "MODEL_NO_TOOL_EXECUTION");
      assert.equal(state.toolUseSeen, false);
      assert.equal(state.attempts, 1);
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });
});

test("Phase 6 CDE launcher fails closed on 429 after tool_use without replay", async () => {
  await withHealthServer(async (serverBase) => {
    const fixture = makeFixtureRoot();
    try {
      const fakeClaudePath = makeFakeClaude(fixture.root);
      const rawPath = join(fixture.root, "raw.jsonl");
      const statePath = join(fixture.root, "state.json");
      const result = runLauncher({ ...fixture, fakeClaudePath, serverBase, rawPath, statePath, scenario: "rate-after-tool" });

      assert.equal(result.status, 1);
      const captures = readFileSync(join(fixture.root, "capture.jsonl"), "utf8").trim().split("\n");
      assert.equal(captures.length, 1);
      const state = JSON.parse(readFileSync(statePath, "utf8"));
      assert.equal(state.status, "failed");
      assert.equal(state.classification, "RATE_LIMITED");
      assert.equal(state.toolUseSeen, true);
      assert.equal(state.partialEvidence, true);
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });
});

test("Phase 6 CDE launcher fails closed on a truncated tool_use line followed by 429", async () => {
  await withHealthServer(async (serverBase) => {
    const fixture = makeFixtureRoot();
    try {
      const fakeClaudePath = makeFakeClaude(fixture.root);
      const rawPath = join(fixture.root, "raw.jsonl");
      const statePath = join(fixture.root, "state.json");
      const result = runLauncher({
        ...fixture,
        fakeClaudePath,
        serverBase,
        rawPath,
        statePath,
        scenario: "truncated-tool-before-rate",
      });

      assert.equal(result.status, 1);
      const captures = readFileSync(join(fixture.root, "capture.jsonl"), "utf8").trim().split("\n");
      assert.equal(captures.length, 1);
      const state = JSON.parse(readFileSync(statePath, "utf8"));
      assert.equal(state.status, "failed");
      assert.equal(state.classification, "RATE_LIMITED");
      assert.equal(state.unparseableStreamLine, true);
      assert.equal(state.partialEvidence, true);
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });
});

test("Phase 6 CDE launcher terminates immediately on a failed user tool_result without retrying", async () => {
  await withHealthServer(async (serverBase) => {
    const fixture = makeFixtureRoot();
    try {
      const fakeClaudePath = makeFakeClaude(fixture.root);
      const rawPath = join(fixture.root, "raw.jsonl");
      const statePath = join(fixture.root, "state.json");
      const marker = join(fixture.root, "tool-error-signal");
      const startedAt = Date.now();
      const result = runLauncher({
        ...fixture,
        fakeClaudePath,
        serverBase,
        rawPath,
        statePath,
        scenario: "tool-execution-error",
        marker,
      });
      const elapsedMs = Date.now() - startedAt;

      assert.equal(result.status, 1);
      assert.ok(elapsedMs < 5000, `launcher took ${elapsedMs}ms instead of terminating the sleeping child`);
      assert.equal(readFileSync(marker, "utf8"), "SIGTERM");
      const captures = readFileSync(join(fixture.root, "capture.jsonl"), "utf8").trim().split("\n");
      assert.equal(captures.length, 1);
      assert.equal(statSync(rawPath).mode & 0o777, 0o600);
      assert.match(readFileSync(rawPath, "utf8"), new RegExp(toolResultSecret));

      const stateText = readFileSync(statePath, "utf8");
      const state = JSON.parse(stateText);
      assert.equal(state.status, "failed");
      assert.equal(state.classification, "TOOL_EXECUTION_ERROR");
      assert.equal(state.attempts, 1);
      assert.equal(state.toolExecutionError, true);
      assert.equal(state.partialEvidence, true);
      assert.equal(stateText.includes(toolResultSecret), false);
      assert.equal(stateText.includes(toolResultContent), false);
      assert.equal(result.stderr.includes(toolResultSecret), false);
      assert.equal(result.stderr.includes(toolResultContent), false);
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });
});

test("Phase 6 CDE launcher redacts sensitive stderr from failed state", async () => {
  await withHealthServer(async (serverBase) => {
    const fixture = makeFixtureRoot();
    try {
      const fakeClaudePath = makeFakeClaude(fixture.root);
      const rawPath = join(fixture.root, "raw.jsonl");
      const statePath = join(fixture.root, "state.json");
      const result = runLauncher({ ...fixture, fakeClaudePath, serverBase, rawPath, statePath, scenario: "secret-stderr-fail" });

      assert.equal(result.status, 1);
      const stateText = readFileSync(statePath, "utf8");
      assert.equal(stateText.includes(secret), false);
      assert.equal(stateText.includes(authSecret), false);
      assert.equal(stateText.includes("SHOULD_REDACT"), false);
      assert.equal(result.stderr.includes(secret), false);
      assert.equal(result.stderr.includes(authSecret), false);
      assert.equal(result.stderr.includes("SHOULD_REDACT"), false);
      const state = JSON.parse(stateText);
      assert.equal(state.status, "failed");
      assert.equal(state.classification, "MODEL_RUN_FAILED");
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });
});

test("Phase 6 CDE launcher parses the real Chinese 429 reset timestamp with a space-separated time", () => {
  const inspection = {
    rateLimited: false,
    toolUseSeen: false,
    unparseableStreamLine: false,
    partialEvidence: false,
    resetAt: undefined,
  };
  inspectRawLine(JSON.stringify({
    type: "error",
    status: 429,
    error: { type: "rate_limit_error", message: "将在 2026-07-21 19:15:40 重置" },
  }), inspection);

  assert.equal(inspection.rateLimited, true);
  assert.equal(inspection.toolUseSeen, false);
  assert.equal(inspection.unparseableStreamLine, false);
  assert.equal(inspection.partialEvidence, false);
  assert.equal(inspection.resetAt, Date.parse("2026-07-21 19:15:40"));
});

test("Phase 6 CDE launcher ignores rate-limit vocabulary inside successful game output", () => {
  const inspection = {
    rateLimited: false,
    toolUseSeen: false,
    toolExecutionError: false,
    unparseableStreamLine: false,
    partialEvidence: false,
    resetAt: undefined,
  };
  for (const record of [
    {
      type: "user",
      message: {
        role: "user",
        content: [{
          type: "tool_result",
          is_error: false,
          content: JSON.stringify({ rateLimit: 429, retryAfter: 60, community: "too many requests" }),
        }],
      },
    },
    {
      type: "assistant",
      message: { role: "assistant", content: [{ type: "text", text: "The game panel reports rate_limit 429." }] },
    },
    {
      type: "result",
      subtype: "success",
      is_error: false,
      result: "Successful summary mentioning rateLimit, retryAfter, and 429.",
    },
  ]) {
    inspectRawLine(JSON.stringify(record), inspection);
  }

  assert.equal(inspection.rateLimited, false);
  assert.equal(inspection.resetAt, undefined);
  assert.equal(inspection.toolExecutionError, false);
});

test("Phase 6 CDE launcher detects both modern tool_result error flag spellings", () => {
  for (const errorFlag of ["is_error", "isError"]) {
    const inspection = {
      rateLimited: false,
      toolUseSeen: false,
      toolExecutionError: false,
      unparseableStreamLine: false,
      partialEvidence: false,
      resetAt: undefined,
    };
    inspectRawLine(JSON.stringify({
      type: "user",
      message: {
        role: "user",
        content: [{ type: "tool_result", [errorFlag]: true, content: "not persisted" }],
      },
    }), inspection);

    assert.equal(inspection.toolExecutionError, true, errorFlag);
    assert.equal(inspection.partialEvidence, true, errorFlag);
  }
});

test("Phase 6 CDE launcher rejects a relative MCP adapter module path before launch", async () => {
  await withHealthServer(async (serverBase) => {
    const fixture = makeFixtureRoot();
    try {
      const fakeClaudePath = makeFakeClaude(fixture.root);
      const statePath = join(fixture.root, "state.json");
      const result = runLauncher({
        ...fixture,
        adapterPath: "relative-adapter.mjs",
        fakeClaudePath,
        serverBase,
        rawPath: join(fixture.root, "raw.jsonl"),
        statePath,
      });

      assert.equal(result.status, 2);
      assert.equal(existsSync(join(fixture.root, "capture.jsonl")), false);
      const state = JSON.parse(readFileSync(statePath, "utf8"));
      assert.equal(state.status, "failed");
      assert.equal(state.classification, "LAUNCHER_CONFIG_INVALID");
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });
});

test("Phase 6 CDE launcher rejects relative output paths before launch", async () => {
  await withHealthServer(async (serverBase) => {
    const fixture = makeFixtureRoot();
    try {
      const fakeClaudePath = makeFakeClaude(fixture.root);
      const result = runLauncher({
        ...fixture,
        fakeClaudePath,
        serverBase,
        rawPath: "relative-raw.jsonl",
        statePath: join(fixture.root, "state.json"),
      });

      assert.equal(result.status, 2);
      assert.equal(existsSync(join(fixture.root, "capture.jsonl")), false);
      const state = JSON.parse(readFileSync(join(fixture.root, "state.json"), "utf8"));
      assert.equal(state.status, "failed");
      assert.equal(state.classification, "LAUNCHER_CONFIG_INVALID");
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });
});
