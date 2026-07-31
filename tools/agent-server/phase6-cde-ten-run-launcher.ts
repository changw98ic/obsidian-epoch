#!/usr/bin/env node
// @ts-nocheck

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const SCHEMA_VERSION = "obsidian-epoch.phase6-cde-ten-run-launcher.v1";
const MAX_TURNS = "360";
const MAX_STDERR_SUMMARY_BYTES = 8192;
const MAX_RATE_LIMIT_DELAY_MS = 6 * 60 * 60 * 1000;
const MCP_SERVER_NAME = "obsidian_epoch";
const ALLOWED_RUNTIME_MCP_TOOLS = Object.freeze([
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
]);
const ALLOWED_CLAUDE_MCP_TOOLS = Object.freeze(ALLOWED_RUNTIME_MCP_TOOLS.map(
  (tool) => `mcp__${MCP_SERVER_NAME}__${tool.replace(/\./g, "_")}`,
));
const SECRET_KEY = /(?:api[-_]?key|recovery[-_]?code|operator[-_]?key|secret|token|authorization|password|credential|private[-_]?key|access[-_]?key|refresh[-_]?token|session[-_]?key)/i;
const SECRET_VALUE_GLOBAL = /\b(?:sk-[A-Za-z0-9_-]{8,}|Bearer\s+[A-Za-z0-9._-]{8,}|xox[baprs]-[A-Za-z0-9-]{8,}|AKIA[0-9A-Z]{16})\b/gi;

function usage() {
  return [
    "Usage: node --import tsx ../agent-server/phase6-cde-ten-run-launcher.ts --prompt <path> --server-base <url> --raw-output <absolute-jsonl> --state-output <absolute-json> [--start-at <iso-or-ms>] --claude-bin <absolute-path> --mcp-adapter-bin <absolute-js-module-path>",
    "",
    "Launches Claude Code without a shell in a non-Git temporary directory, records stream-json raw output privately, and writes a redacted launcher state file.",
  ].join("\n");
}

function codedError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }
    if (["--prompt", "--server-base", "--raw-output", "--state-output", "--start-at", "--claude-bin", "--mcp-adapter-bin"].includes(arg)) {
      const value = argv[index + 1];
      if (!value) throw codedError("LAUNCHER_CONFIG_INVALID", `${arg} requires a non-empty value`);
      options[arg.slice(2)] = value;
      index += 1;
      continue;
    }
    throw codedError("LAUNCHER_CONFIG_INVALID", `unknown argument: ${arg}`);
  }
  if (options.help) return options;
  for (const key of ["prompt", "server-base", "raw-output", "state-output", "claude-bin", "mcp-adapter-bin"]) {
    if (!options[key]) throw codedError("LAUNCHER_CONFIG_INVALID", `--${key} is required`);
  }
  return options;
}

function requireAbsoluteExistingFile(label, value) {
  if (!path.isAbsolute(value)) throw codedError("LAUNCHER_CONFIG_INVALID", `${label} must be an absolute path`);
  let stat;
  try {
    stat = fs.statSync(value);
  } catch {
    throw codedError("LAUNCHER_CONFIG_INVALID", `${label} must exist`);
  }
  if (!stat.isFile()) throw codedError("LAUNCHER_CONFIG_INVALID", `${label} must be a file`);
  return value;
}

function requireAbsoluteOutputPath(label, value) {
  if (!path.isAbsolute(value)) throw codedError("LAUNCHER_CONFIG_INVALID", `${label} must be an absolute path`);
  if (fs.existsSync(value)) {
    const stat = fs.statSync(value);
    if (!stat.isFile()) throw codedError("LAUNCHER_CONFIG_INVALID", `${label} must be a file path`);
    if (stat.size > 0) throw codedError("LAUNCHER_CONFIG_INVALID", `${label} refuses to overwrite an existing non-empty file`);
  }
  fs.mkdirSync(path.dirname(value), { recursive: true });
  return value;
}

function parseServerBase(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw codedError("LAUNCHER_CONFIG_INVALID", "--server-base must be a valid http(s) URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw codedError("LAUNCHER_CONFIG_INVALID", "--server-base must use http or https");
  }
  return url.toString().replace(/\/$/, "");
}

function parseStartAt(value) {
  if (!value) return undefined;
  const numeric = Number(value);
  const timestamp = Number.isFinite(numeric) ? numeric : Date.parse(value);
  if (!Number.isFinite(timestamp)) throw codedError("LAUNCHER_CONFIG_INVALID", "--start-at must be an ISO timestamp or epoch milliseconds");
  return timestamp;
}

function redact(text) {
  return String(text)
    .replace(SECRET_VALUE_GLOBAL, "[REDACTED_SECRET]")
    .split(/\r?\n/)
    .map((line) => (SECRET_KEY.test(line) ? "[REDACTED_SECRET_LINE]" : line))
    .join("\n");
}

function appendSummary(current, chunk) {
  const combined = current + redact(chunk.toString("utf8"));
  if (Buffer.byteLength(combined, "utf8") <= MAX_STDERR_SUMMARY_BYTES) return combined;
  return `${combined.slice(0, MAX_STDERR_SUMMARY_BYTES)}\n[stderr summary truncated]`;
}

function safeState(state) {
  const copy = { ...state };
  delete copy.env;
  delete copy.argv;
  if (copy.stderrSummary) copy.stderrSummary = redact(copy.stderrSummary);
  return copy;
}

function writeState(statePath, state) {
  fs.writeFileSync(statePath, `${JSON.stringify(safeState(state), null, 2)}\n`, { mode: 0o600 });
  fs.chmodSync(statePath, 0o600);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function checkReadiness(serverBase) {
  const base = new URL(serverBase);
  for (const suffix of ["/api/health", "/api/epoch/health", "/health"]) {
    const url = new URL(suffix, base);
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(3000) });
      await response.arrayBuffer();
      if (response.status >= 200 && response.status < 300) return { ok: true, checkedUrl: url.toString() };
    } catch {
      // Try the next conventional readiness route.
    }
  }
  return { ok: false };
}

function makeTempWorkspace() {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "phase6-cde-cwd-"));
  if (fs.existsSync(path.join(cwd, ".git"))) {
    throw codedError("LAUNCHER_CONFIG_INVALID", "temporary working directory must not contain .git");
  }
  return cwd;
}

function optionalPrivateRecoveryCodeFile(value) {
  const candidate = String(value || "").trim();
  if (!candidate) return undefined;
  if (!path.isAbsolute(candidate)) {
    throw codedError("LAUNCHER_CONFIG_INVALID", "PHASE6_MCP_RECOVERY_CODE_FILE must be absolute");
  }
  let stat;
  try {
    stat = fs.lstatSync(candidate);
  } catch {
    throw codedError("LAUNCHER_CONFIG_INVALID", "PHASE6_MCP_RECOVERY_CODE_FILE is unavailable");
  }
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw codedError("LAUNCHER_CONFIG_INVALID", "PHASE6_MCP_RECOVERY_CODE_FILE must be a regular file");
  }
  if ((stat.mode & 0o077) !== 0) {
    throw codedError("LAUNCHER_CONFIG_INVALID", "PHASE6_MCP_RECOVERY_CODE_FILE must use private permissions");
  }
  if (stat.size < 1 || stat.size > 8192) {
    throw codedError("LAUNCHER_CONFIG_INVALID", "PHASE6_MCP_RECOVERY_CODE_FILE size is invalid");
  }
  return candidate;
}

function makeMcpConfig(tempRoot, mcpAdapterModulePath, serverBase, privateRecoveryCodeFile) {
  const configPath = path.join(tempRoot, "phase6-cde-mcp.json");
  const config = {
    mcpServers: {
      [MCP_SERVER_NAME]: {
        type: "stdio",
        command: process.execPath,
        args: [mcpAdapterModulePath],
        env: {
          AGENT_WORLD_SERVER: serverBase,
          PHASE6_MCP_TOOL_ALLOWLIST: JSON.stringify(ALLOWED_RUNTIME_MCP_TOOLS),
          ...(privateRecoveryCodeFile ? {
            PHASE6_MCP_RECOVERY_CODE_FILE: privateRecoveryCodeFile,
          } : {}),
        },
      },
    },
  };
  fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
  fs.chmodSync(configPath, 0o600);
  return configPath;
}

function mappedModelEnv(sourceEnv) {
  const env = { ...sourceEnv };
  delete env.PHASE6_MCP_RECOVERY_CODE_FILE;
  if (sourceEnv.ZHIPU_API_KEY) env.ANTHROPIC_API_KEY = sourceEnv.ZHIPU_API_KEY;
  if (sourceEnv.ZHIPU_AUTH_TOKEN) {
    env.ANTHROPIC_AUTH_TOKEN = sourceEnv.ZHIPU_AUTH_TOKEN;
  } else if (sourceEnv.ZHIPU_API_KEY) {
    env.ANTHROPIC_AUTH_TOKEN = sourceEnv.ZHIPU_API_KEY;
  }
  if (sourceEnv.ZHIPU_BASE_URL) env.ANTHROPIC_BASE_URL = sourceEnv.ZHIPU_BASE_URL;
  if (sourceEnv.ZHIPU_MODEL) {
    for (const key of [
      "ANTHROPIC_MODEL",
      "ANTHROPIC_DEFAULT_SONNET_MODEL",
      "ANTHROPIC_DEFAULT_OPUS_MODEL",
      "ANTHROPIC_DEFAULT_HAIKU_MODEL",
      "CLAUDE_CODE_SUBAGENT_MODEL",
    ]) {
      env[key] = sourceEnv.ZHIPU_MODEL;
    }
  }
  return env;
}

function containsToolUse(value, depth = 0) {
  if (depth > 10 || value === null || value === undefined) return false;
  if (typeof value === "string") return value === "tool_use";
  if (Array.isArray(value)) return value.some((item) => containsToolUse(item, depth + 1));
  if (typeof value === "object") {
    if (value.type === "tool_use") return true;
    return Object.values(value).some((item) => containsToolUse(item, depth + 1));
  }
  return false;
}

function containsPartialExecutionEvidence(value, depth = 0) {
  if (depth > 10 || value === null || value === undefined) return false;
  if (typeof value === "string") {
    return value.includes("tool_use") || value.includes("tool_result") || value.includes("mcp__");
  }
  if (Array.isArray(value)) return value.some((item) => containsPartialExecutionEvidence(item, depth + 1));
  if (typeof value === "object") {
    return Object.values(value).some((item) => containsPartialExecutionEvidence(item, depth + 1));
  }
  return false;
}

function containsFailedUserToolResult(value, userContext = false, depth = 0) {
  if (depth > 10 || value === null || value === undefined || typeof value !== "object") return false;
  if (Array.isArray(value)) {
    return value.some((item) => containsFailedUserToolResult(item, userContext, depth + 1));
  }
  const nextUserContext = userContext || value.type === "user" || value.role === "user";
  if (nextUserContext && value.type === "tool_result" && (value.is_error === true || value.isError === true)) return true;
  return Object.values(value).some((item) => containsFailedUserToolResult(item, nextUserContext, depth + 1));
}

function inspectRateLimitText(line, inspection) {
  if (/rate[_ -]?limit|429|too many requests/i.test(line)) inspection.rateLimited = true;
  const keyedReset = line.match(/(?:retry[-_ ]?after|reset[-_ ]?at|rate[-_ ]?limit[-_ ]?reset)[^0-9A-Za-z]*(\d{13}(?!\d)|\d{10}(?!\d)|[0-9]{4}-[0-9]{2}-[0-9]{2}(?:T|\s+)[0-9]{2}:[0-9]{2}(?::[0-9]{2})?(?:\.[0-9]+)?(?:Z|[+-][0-9]{2}:?[0-9]{2})?)/i)?.[1];
  const chineseReset = line.match(/将在\s*([0-9]{4}-[0-9]{2}-[0-9]{2}\s+[0-9]{2}:[0-9]{2}(?::[0-9]{2})?)\s*重置/u)?.[1];
  for (const reset of [keyedReset, chineseReset]) {
    if (!reset) continue;
    const normalized = reset.replace(/\s+/g, " ");
    const timestamp = /^\d+$/.test(normalized)
      ? (normalized.length === 10 ? Number(normalized) * 1000 : Number(normalized))
      : Date.parse(normalized);
    if (Number.isFinite(timestamp)) inspection.resetAt = Math.max(inspection.resetAt || 0, timestamp);
  }
}

function inspectStructuredRateLimit(parsed, inspection) {
  const failedResult = parsed?.type === "result"
    && (parsed?.is_error === true
      || parsed?.isError === true
      || parsed?.subtype === "error"
      || parsed?.subtype === "error_during_execution");
  const errorEnvelope = parsed?.type === "error"
    || failedResult
    || parsed?.error?.type === "rate_limit_error"
    || parsed?.error?.status === 429
    || parsed?.status === 429;
  if (!errorEnvelope) return;

  // Only inspect a top-level model/transport error envelope. Tool results and
  // game data legitimately contain fields such as rateLimit and retryAfter;
  // scanning the entire stream line would misclassify a successful run.
  inspectRateLimitText(JSON.stringify({
    type: parsed?.type,
    subtype: parsed?.subtype,
    status: parsed?.status,
    error: parsed?.error,
    message: typeof parsed?.message === "string" ? parsed.message : undefined,
    result: failedResult ? parsed?.result : undefined,
  }), inspection);
}

export function inspectRawLine(line, inspection) {
  if (!line.trim()) return;
  let parsed;
  try {
    parsed = JSON.parse(line);
  } catch {
    inspection.unparseableStreamLine = true;
    inspection.partialEvidence = true;
    return;
  }
  inspectStructuredRateLimit(parsed, inspection);
  if (containsToolUse(parsed)) inspection.toolUseSeen = true;
  if (containsPartialExecutionEvidence(parsed)) inspection.partialEvidence = true;
  if (containsFailedUserToolResult(parsed)) {
    inspection.toolExecutionError = true;
    inspection.partialEvidence = true;
  }
}

function inspectStderrLine(line, inspection) {
  if (!line.trim()) return;
  inspectRateLimitText(line, inspection);
  try {
    inspectStructuredRateLimit(JSON.parse(line), inspection);
  } catch {
    // Stderr diagnostics are not part of the stream-json execution evidence.
  }
}

function rawInspectionFromFile(rawPath) {
  const inspection = {
    rateLimited: false,
    toolUseSeen: false,
    toolExecutionError: false,
    unparseableStreamLine: false,
    partialEvidence: false,
    resetAt: undefined,
  };
  if (!fs.existsSync(rawPath)) return inspection;
  const content = fs.readFileSync(rawPath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    if (line.trim()) inspectRawLine(line, inspection);
  }
  return inspection;
}

function buildClaudeArgv({ mcpConfigPath, promptText }) {
  return [
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
    mcpConfigPath,
    "--strict-mcp-config",
    "--allowedTools",
    ...ALLOWED_CLAUDE_MCP_TOOLS,
    "--max-turns",
    MAX_TURNS,
    "--effort",
    "high",
    promptText,
  ];
}

function runClaude({ claudeBin, argv, cwd, rawPath, env }) {
  return new Promise((resolve) => {
    const raw = fs.createWriteStream(rawPath, { flags: "w", mode: 0o600 });
    let stderrSummary = "";
    let outputError;
    const inspection = {
      rateLimited: false,
      toolUseSeen: false,
      toolExecutionError: false,
      unparseableStreamLine: false,
      partialEvidence: false,
      resetAt: undefined,
    };
    let stdoutBuffer = "";
    let stderrBuffer = "";
    let terminatingForToolExecutionError = false;
    const child = spawn(claudeBin, argv, {
      cwd,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      env,
    });

    raw.on("error", (error) => {
      outputError = error.message;
      child.kill("SIGTERM");
    });
    function terminateForToolExecutionError() {
      if (terminatingForToolExecutionError || !inspection.toolExecutionError) return;
      terminatingForToolExecutionError = true;
      child.kill("SIGTERM");
    }
    child.stdout.on("data", (chunk) => {
      raw.write(chunk);
      stdoutBuffer += chunk.toString("utf8");
      for (;;) {
        const newlineIndex = stdoutBuffer.indexOf("\n");
        if (newlineIndex < 0) break;
        inspectRawLine(stdoutBuffer.slice(0, newlineIndex), inspection);
        terminateForToolExecutionError();
        stdoutBuffer = stdoutBuffer.slice(newlineIndex + 1);
      }
    });
    child.stderr.on("data", (chunk) => {
      stderrSummary = appendSummary(stderrSummary, chunk);
      stderrBuffer += chunk.toString("utf8");
      for (;;) {
        const newlineIndex = stderrBuffer.indexOf("\n");
        if (newlineIndex < 0) break;
        inspectStderrLine(stderrBuffer.slice(0, newlineIndex), inspection);
        stderrBuffer = stderrBuffer.slice(newlineIndex + 1);
      }
    });
    child.on("error", (error) => {
      stderrSummary = appendSummary(stderrSummary, Buffer.from(error.message));
    });
    child.on("close", (code, signal) => {
      if (stdoutBuffer.trim()) inspectRawLine(stdoutBuffer, inspection);
      if (stderrBuffer.trim()) inspectStderrLine(stderrBuffer, inspection);
      raw.end(() => {
        fs.chmodSync(rawPath, 0o600);
        resolve({
          exitCode: Number.isInteger(code) ? code : 1,
          signal,
          stderrSummary,
          outputError,
          inspection,
        });
      });
    });
  });
}

async function main() {
  let statePath;
  let state = {
    schemaVersion: SCHEMA_VERSION,
    status: "waiting",
    attempts: 0,
    startedAt: new Date().toISOString(),
  };
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
      process.stdout.write(`${usage()}\n`);
      return;
    }
    statePath = requireAbsoluteOutputPath("--state-output", options["state-output"]);
    const rawPath = requireAbsoluteOutputPath("--raw-output", options["raw-output"]);
    if (rawPath === statePath) throw codedError("LAUNCHER_CONFIG_INVALID", "--raw-output and --state-output must be different paths");
    const promptPath = requireAbsoluteExistingFile("--prompt", options.prompt);
    const claudeBin = requireAbsoluteExistingFile("--claude-bin", options["claude-bin"]);
    const mcpAdapterModulePath = requireAbsoluteExistingFile("--mcp-adapter-bin", options["mcp-adapter-bin"]);
    const serverBase = parseServerBase(options["server-base"]);
    const startAt = parseStartAt(options["start-at"]);
    const privateRecoveryCodeFile = optionalPrivateRecoveryCodeFile(process.env.PHASE6_MCP_RECOVERY_CODE_FILE);
    const promptText = fs.readFileSync(promptPath, "utf8");
    if (!promptText.trim()) throw codedError("LAUNCHER_CONFIG_INVALID", "--prompt file must be non-empty");

    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "phase6-cde-launch-"));
    const cwd = makeTempWorkspace();
    const mcpConfigPath = makeMcpConfig(tempRoot, mcpAdapterModulePath, serverBase, privateRecoveryCodeFile);
    state = {
      ...state,
      rawOutput: rawPath,
      stateOutput: statePath,
      mcpConfigPath,
      workingDirectory: cwd,
      allowedMcpTools: ALLOWED_CLAUDE_MCP_TOOLS,
      privateRecoveryBrokerConfigured: Boolean(privateRecoveryCodeFile),
      maxTurns: Number(MAX_TURNS),
    };
    writeState(statePath, state);

    if (startAt && startAt > Date.now()) {
      await sleep(startAt - Date.now());
    }
    const readiness = await checkReadiness(serverBase);
    if (!readiness.ok) throw codedError("RUNTIME_NOT_READY", "world runtime readiness check failed");
    state.readiness = readiness;

    const argv = buildClaudeArgv({ mcpConfigPath, promptText });
    const env = mappedModelEnv(process.env);
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      state = { ...state, status: "running", attempts: attempt, lastRunStartedAt: new Date().toISOString() };
      writeState(statePath, state);
      const result = await runClaude({ claudeBin, argv, cwd, rawPath, env });
      const rawInspection = rawInspectionFromFile(rawPath);
      const inspection = {
        ...rawInspection,
        rateLimited: result.inspection.rateLimited || rawInspection.rateLimited,
        toolUseSeen: result.inspection.toolUseSeen || rawInspection.toolUseSeen,
        toolExecutionError: result.inspection.toolExecutionError || rawInspection.toolExecutionError,
        unparseableStreamLine: result.inspection.unparseableStreamLine || rawInspection.unparseableStreamLine,
        partialEvidence: result.inspection.partialEvidence || rawInspection.partialEvidence,
        resetAt: Math.max(result.inspection.resetAt || 0, rawInspection.resetAt || 0) || undefined,
      };
      if (result.outputError) throw codedError("MODEL_RUN_FAILED", `failed to write raw output: ${result.outputError}`);
      if (inspection.toolExecutionError) {
        state = {
          ...state,
          toolExecutionError: true,
          toolUseSeen: inspection.toolUseSeen,
          unparseableStreamLine: inspection.unparseableStreamLine,
          partialEvidence: true,
        };
        throw codedError("TOOL_EXECUTION_ERROR", "Claude reported a failed tool execution; refusing to continue or retry");
      }
      if (result.exitCode === 0 && !inspection.rateLimited && !inspection.toolUseSeen) {
        state = {
          ...state,
          toolUseSeen: false,
          unparseableStreamLine: inspection.unparseableStreamLine,
          partialEvidence: inspection.partialEvidence,
        };
        throw codedError("MODEL_NO_TOOL_EXECUTION", "Claude exited successfully without executing any MCP tool");
      }
      if (result.exitCode === 0 && !inspection.rateLimited) {
        state = {
          ...state,
          status: "finished",
          finishedAt: new Date().toISOString(),
          exitCode: result.exitCode,
          signal: result.signal,
          rateLimited: false,
          toolUseSeen: true,
          unparseableStreamLine: inspection.unparseableStreamLine,
          partialEvidence: false,
        };
        writeState(statePath, state);
        process.stdout.write(`${JSON.stringify({ ok: true, stateOutput: statePath, rawOutput: rawPath })}\n`);
        return;
      }
      if (inspection.rateLimited) {
        state = {
          ...state,
          rateLimited: true,
          toolUseSeen: inspection.toolUseSeen,
          unparseableStreamLine: inspection.unparseableStreamLine,
          partialEvidence: inspection.partialEvidence,
        };
        if (inspection.partialEvidence) throw codedError("RATE_LIMITED", "rate limit occurred with partial execution evidence; refusing to replay a partial experiment");
        if (attempt === 1 && inspection.resetAt) {
          const delayMs = Math.max(0, inspection.resetAt - Date.now());
          if (delayMs <= MAX_RATE_LIMIT_DELAY_MS) {
            state = { ...state, status: "waiting", classification: "RATE_LIMITED", retryAt: new Date(inspection.resetAt).toISOString() };
            writeState(statePath, state);
            await sleep(delayMs);
            continue;
          }
        }
        throw codedError("RATE_LIMITED", "rate limited before tool_use but no bounded reset/retry time was available");
      }
      state.stderrSummary = result.stderrSummary;
      throw codedError("MODEL_RUN_FAILED", `Claude exited with code ${result.exitCode}`);
    }
  } catch (error) {
    const code = error?.code || "MODEL_RUN_FAILED";
    state = {
      ...state,
      status: "failed",
      classification: code,
      failedAt: new Date().toISOString(),
      message: redact(error instanceof Error ? error.message : String(error)),
    };
    if (statePath) writeState(statePath, state);
    process.stderr.write(`${JSON.stringify({ ok: false, classification: code, message: state.message })}\n`);
    process.exitCode = code === "LAUNCHER_CONFIG_INVALID" ? 2 : 1;
  }
}

if (path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1] || "")) {
  main();
}
