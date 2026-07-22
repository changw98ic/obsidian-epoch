#!/usr/bin/env node

import { createHash } from "node:crypto";
import { chmodSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve, sep } from "node:path";

const MCP_PREFIXES = Object.freeze([
  "mcp__obsidian_epoch__",
  "mcp__obsidian-epoch-agent-world__",
]);
const ALLOWED_OBSIDIAN_EPOCH_TOOL_SUFFIXES = new Set([
  "register_explorer",
  "begin_phase6_experiment",
  "prepare_journey",
  "player_panel",
  "progress",
  "world_overview",
  "world_content",
  "inventory",
  "shop",
  "purchase_shop_offer",
  "craft_item",
  "begin_phase6_run",
  "start_journey_compact",
  "journey_status_compact",
  "propose_journey_step_compact",
  "commit_journey_action_compact",
  "phase6_experiment_status",
  "run_receipt_compact",
  "phase6_result_compact",
]);
const CLAUDE_PROJECTS_ROOT = resolve(homedir(), ".claude", "projects");
const SECRET_FRAGMENTS = [
  "recoverycode",
  "password",
  "passwd",
  "secret",
  "token",
  "apikey",
  "authorization",
  "cookie",
  "credential",
  "privatekey",
  "accesskey",
  "sessionkey",
];

function usage(message) {
  if (message) console.error(message);
  console.error(
    "Usage: node phase6-cde-stream-to-jsonl.mjs --input <cde-stream.jsonl> --output <phase6-tools.jsonl>",
  );
  process.exit(2);
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (key === "--input" || key === "--output") {
      const value = argv[index + 1];
      if (!value) usage(`Missing value for ${key}`);
      args[key.slice(2)] = value;
      index += 1;
      continue;
    }
    usage(`Unknown argument: ${key}`);
  }
  if (!args.input || !args.output) usage("Both --input and --output are required");
  return args;
}

function normalizedKey(key) {
  return String(key).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isSecretKey(key) {
  const normalized = normalizedKey(key);
  return SECRET_FRAGMENTS.some((fragment) => normalized.includes(fragment));
}

function collectSecretValues(value, destination, seen = new WeakSet()) {
  if (!value || typeof value !== "object") return;
  if (seen.has(value)) return;
  seen.add(value);
  if (Array.isArray(value)) {
    for (const item of value) collectSecretValues(item, destination, seen);
    return;
  }
  for (const [key, item] of Object.entries(value)) {
    if (isSecretKey(key)) {
      if (typeof item === "string" && item.length >= 4) destination.add(item);
      continue;
    }
    collectSecretValues(item, destination, seen);
  }
}

function looksLikeSecret(value, knownSecrets) {
  if (knownSecrets.has(value)) return true;
  return (
    knownSecrets.size > 0 && [...knownSecrets].some((secret) => secret.length >= 4 && value.includes(secret))
  ) || (
    /^Bearer\s+\S+/i.test(value) ||
    /^(?:sk|xai|api)[-_][A-Za-z0-9_-]{12,}$/.test(value) ||
    /(?:api[_-]?key|access[_-]?token|auth[_-]?token|token|authorization|recovery[_-]?code)=\S+/i.test(value)
  );
}

function sanitize(value, knownSecrets, seen = new WeakSet()) {
  if (value === null || typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "string") return looksLikeSecret(value, knownSecrets) ? "[REDACTED]" : value;
  if (typeof value !== "object") return undefined;
  if (seen.has(value)) return "[CIRCULAR]";
  seen.add(value);
  if (Array.isArray(value)) {
    return value.map((item) => sanitize(item, knownSecrets, seen)).filter((item) => item !== undefined);
  }
  const result = {};
  for (const [key, item] of Object.entries(value)) {
    if (isSecretKey(key)) continue;
    const safe = sanitize(item, knownSecrets, seen);
    if (safe !== undefined) result[key] = safe;
  }
  return result;
}

function normalizeToolName(rawName) {
  if (typeof rawName !== "string") return null;
  const prefix = MCP_PREFIXES.find((candidate) => rawName.startsWith(candidate));
  if (!prefix) return null;
  const suffix = rawName.slice(prefix.length);
  if (!suffix.startsWith("obsidian_epoch_")) return null;
  const toolSuffix = suffix.slice("obsidian_epoch_".length);
  if (!ALLOWED_OBSIDIAN_EPOCH_TOOL_SUFFIXES.has(toolSuffix)) return null;
  if (suffix.startsWith("obsidian_epoch_")) {
    const publicName = `obsidian_epoch.${toolSuffix}`;
    return publicName.replace(
      /\.(start_journey|propose_journey_step|commit_journey_action|journey_status|run_receipt|phase6_result)_compact$/,
      ".$1",
    );
  }
  return null;
}

function contentFingerprint(text) {
  return {
    byteLength: Buffer.byteLength(text),
    sha256: createHash("sha256").update(text).digest("hex"),
  };
}

function reportableToolName(rawName) {
  const value = String(rawName || "unknown_tool");
  if (
    isSecretKey(value) ||
    looksLikeSecret(value, new Set()) ||
    !/^[A-Za-z0-9_.:-]+$/.test(value) ||
    value.length > 200
  ) {
    return {
      redactedToolName: true,
      ...contentFingerprint(value),
    };
  }
  return value;
}

function unparsedTextSummary(text) {
  return {
    unparsedText: true,
    ...contentFingerprint(text),
  };
}

function parseTextPayload(text, depth) {
  try {
    return JSON.parse(text);
  } catch {
    const persistedPath = text.match(/Full output saved to:\s*([^\r\n]+\.json)/)?.[1]?.trim();
    if (!persistedPath || depth >= 3) return unparsedTextSummary(text);
    try {
      const allowedRoot = realpathSync(CLAUDE_PROJECTS_ROOT);
      const resolvedPath = realpathSync(persistedPath);
      if (resolvedPath !== allowedRoot && !resolvedPath.startsWith(`${allowedRoot}${sep}`)) {
        return { ...unparsedTextSummary(text), persistedOutputRejected: true };
      }
      const persistedContent = JSON.parse(readFileSync(resolvedPath, "utf8"));
      return parseToolResultContent(persistedContent, depth + 1);
    } catch {
      return { ...unparsedTextSummary(text), persistedOutputUnavailable: true };
    }
  }
}

function parseToolResultContent(content, depth = 0) {
  const blocks = Array.isArray(content) ? content : [content];
  const parsed = [];
  for (const block of blocks) {
    if (block && typeof block === "object" && typeof block.text === "string") {
      parsed.push(parseTextPayload(block.text, depth));
      continue;
    }
    if (typeof block === "string") {
      parsed.push(parseTextPayload(block, depth));
    }
  }
  if (parsed.length === 0) return null;
  return parsed.length === 1 ? parsed[0] : parsed;
}

function messageContentBlocks(envelope) {
  const message = envelope?.message;
  if (Array.isArray(message?.content)) return message.content;
  if (Array.isArray(envelope?.content)) return envelope.content;
  if (Array.isArray(message)) return message;
  return [];
}

function findKey(value, candidateKeys, depth = 0, seen = new WeakSet()) {
  if (!value || typeof value !== "object" || depth > 8 || seen.has(value)) return undefined;
  seen.add(value);
  if (!Array.isArray(value)) {
    for (const key of candidateKeys) {
      if (Object.hasOwn(value, key) && value[key] !== undefined && value[key] !== null) return value[key];
    }
  }
  for (const item of Array.isArray(value) ? value : Object.values(value)) {
    const found = findKey(item, candidateKeys, depth + 1, seen);
    if (found !== undefined) return found;
  }
  return undefined;
}

function asPositiveInteger(value) {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : undefined;
}

function asNonEmptyString(value) {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function isSettled(record) {
  const settled = record.output?.settled ?? record.output?.isSettled;
  if (settled === true) return true;
  const journey = findKey(record.output, ["journey"]);
  const state = journey && typeof journey === "object"
    ? journey.status
    : record.output?.runState ?? record.output?.state;
  return typeof state === "string" && /^(?:settled|complete|completed|finalized)$/i.test(state);
}

function assignRunMetadata(records) {
  let experimentId;
  let currentRun;
  let nextRun = 1;
  const settledRuns = new Set();

  for (const record of records) {
    const recordExperimentId = asNonEmptyString(
      findKey(record.output, ["experimentId", "phase6ExperimentId"]) ??
        findKey(record.input, ["experimentId", "phase6ExperimentId"]),
    );
    if (recordExperimentId) experimentId = recordExperimentId;

    const explicitRun = asPositiveInteger(
      findKey(record.output, ["runIndex", "runNumber"]) ?? findKey(record.input, ["runIndex", "runNumber"]),
    );
    if (explicitRun) currentRun = explicitRun;

    if (record.toolName === "obsidian_epoch.prepare_journey") {
      if (!currentRun || settledRuns.has(currentRun)) currentRun = explicitRun ?? nextRun;
    }

    const isRunScoped = /(?:prepare_journey|player_panel|progress|world_overview|world_content|begin_phase6_run|phase6_run_begin|start_journey|journey_status|propose_(?:journey_step|action)|commit_(?:journey_action|journey_step|action)|run_receipt|phase6_result)$/.test(
      record.toolName,
    );
    record.metadata = {
      ...(experimentId ? { experimentId } : {}),
      ...(isRunScoped && currentRun ? { runIndex: currentRun } : {}),
    };

    if (currentRun && isSettled(record)) {
      settledRuns.add(currentRun);
      nextRun = Math.max(nextRun, currentRun + 1);
    }
  }
}

function addEvidenceMarkers(records) {
  const formalJourneyRuns = new Set();

  for (const record of records) {
    const runIndex = record.metadata?.runIndex;
    if (
      record.ok &&
      runIndex &&
      record.toolName === "obsidian_epoch.start_journey" &&
      !formalJourneyRuns.has(runIndex)
    ) {
      record.formalJourney = true;
      formalJourneyRuns.add(runIndex);
    }
    if (record.ok && runIndex && record.toolName === "obsidian_epoch.phase6_result") {
      record.formalResultPage = true;
    }
    if (record.ok && runIndex && isSettled(record)) record.runSettled = true;
  }

  const runBegins = records
    .map((record, index) => ({ record, index }))
    .filter(({ record }) => /(?:begin_phase6_run|phase6_run_begin)$/.test(record.toolName));
  for (let beginOffset = 0; beginOffset < runBegins.length; beginOffset += 1) {
    const { record: beginRecord, index: beginIndex } = runBegins[beginOffset];
    const runIndex = beginRecord.metadata?.runIndex;
    if (!runIndex) continue;
    const nextBeginIndex = beginOffset + 1 < runBegins.length ? runBegins[beginOffset + 1].index : records.length;
    const resultIndex = records.findIndex((candidate, index) =>
      index > beginIndex && index < nextBeginIndex && candidate.toolName === "obsidian_epoch.phase6_result");
    const beforeEnd = resultIndex >= 0 ? resultIndex : nextBeginIndex;
    const beforePanel = records.find((candidate, index) =>
      index > beginIndex
      && index < beforeEnd
      && candidate.ok
      && /(?:player_panel|panel_player)$/.test(candidate.toolName));
    if (beforePanel) {
      beforePanel.metadata = { ...beforePanel.metadata, ...beginRecord.metadata };
      beforePanel.playerPanelBefore = true;
    }
    if (resultIndex < 0) continue;
    const afterPanel = records.find((candidate, index) =>
      index > resultIndex
      && index < nextBeginIndex
      && candidate.ok
      && /(?:player_panel|panel_player)$/.test(candidate.toolName));
    if (afterPanel) {
      afterPanel.metadata = { ...afterPanel.metadata, ...beginRecord.metadata };
      afterPanel.playerPanelAfter = true;
    }
  }
}

function assertSanitized(records, knownSecrets) {
  const serialized = records.map((record) => JSON.stringify(record)).join("\n");
  for (const secret of knownSecrets) {
    if (secret.length >= 4 && serialized.includes(secret)) {
      throw new Error("Sanitization failed: a secret-bearing value remains in output");
    }
  }
  for (const record of records) {
    const stack = [record];
    while (stack.length) {
      const value = stack.pop();
      if (!value || typeof value !== "object") continue;
      for (const [key, item] of Object.entries(value)) {
        if (isSecretKey(key)) throw new Error(`Sanitization failed: forbidden key ${key}`);
        if (item && typeof item === "object") stack.push(item);
      }
    }
  }
}

const { input, output } = parseArgs(process.argv.slice(2));
const calls = new Map();
const completedCalls = new Set();
const rawRecords = [];
const unauthorizedToolNames = new Set();
const malformedLines = [];
const streamProtocolViolations = [];
let pendingToolUseId = null;

for (const [lineIndex, line] of readFileSync(input, "utf8").split(/\r?\n/).entries()) {
  if (!line.trim()) continue;
  let envelope;
  try {
    envelope = JSON.parse(line);
  } catch {
    malformedLines.push({
      lineNumber: lineIndex + 1,
      ...contentFingerprint(line),
    });
    continue;
  }
  const blocks = messageContentBlocks(envelope);
  if (blocks.length === 0) continue;
  const toolUseBlocks = blocks.filter((block) => block?.type === "tool_use");
  if (toolUseBlocks.length > 1) {
    streamProtocolViolations.push({
      lineNumber: lineIndex + 1,
      reason: "multiple_tool_uses_in_assistant_message",
      toolUseCount: toolUseBlocks.length,
    });
  }
  for (const block of blocks) {
    if (block?.type === "tool_use") {
      if (pendingToolUseId) {
        streamProtocolViolations.push({
          lineNumber: lineIndex + 1,
          reason: "new_tool_use_before_previous_tool_result",
        });
      }
      const toolName = normalizeToolName(block.name);
      if (!toolName) {
        unauthorizedToolNames.add(JSON.stringify(reportableToolName(block.name)));
      }
      if (toolName && typeof block.id === "string") {
        calls.set(block.id, {
          sourceToolName: block.name,
          toolName,
          input: block.input ?? {},
          timestamp: envelope.timestamp ?? null,
        });
        pendingToolUseId = block.id;
      }
      continue;
    }
    if (block?.type !== "tool_result" || typeof block.tool_use_id !== "string") continue;
    if (completedCalls.has(block.tool_use_id)) continue;
    const call = calls.get(block.tool_use_id);
    if (!call) continue;
    completedCalls.add(block.tool_use_id);
    if (pendingToolUseId === block.tool_use_id) pendingToolUseId = null;
    rawRecords.push({
      schemaVersion: "phase6.cde_tool_record.v1",
      sequence: rawRecords.length + 1,
      timestamp: envelope.timestamp ?? call.timestamp,
      toolUseId: block.tool_use_id,
      sourceToolName: call.sourceToolName,
      originalToolName: call.sourceToolName,
      toolName: call.toolName,
      isError: block.is_error === true,
      ok: block.is_error !== true,
      input: call.input,
      output: parseToolResultContent(block.content),
    });
  }
}

if (malformedLines.length > 0) {
  console.error(JSON.stringify({
    ok: false,
    error: "malformed_stream_jsonl",
    malformedLines,
  }));
  process.exit(1);
}

if (unauthorizedToolNames.size > 0) {
  console.error(JSON.stringify({
    ok: false,
    error: "unauthorized_non_game_tool_calls",
    unauthorizedToolNames: [...unauthorizedToolNames].sort().map((name) => JSON.parse(name)),
  }));
  process.exit(1);
}

if (streamProtocolViolations.length > 0) {
  console.error(JSON.stringify({
    ok: false,
    error: "invalid_tool_call_stream_protocol",
    violations: streamProtocolViolations,
  }));
  process.exit(1);
}

if (pendingToolUseId) {
  console.error(JSON.stringify({
    ok: false,
    error: "invalid_tool_call_stream_protocol",
    violations: [{
      reason: "pending_tool_use_without_tool_result",
    }],
  }));
  process.exit(1);
}

const knownSecrets = new Set();
for (const record of rawRecords) collectSecretValues(record, knownSecrets);
const records = rawRecords.map((record) => sanitize(record, knownSecrets));
assignRunMetadata(records);
addEvidenceMarkers(records);
assertSanitized(records, knownSecrets);

const jsonl = records.map((record) => JSON.stringify(record)).join("\n") + (records.length ? "\n" : "");
writeFileSync(output, jsonl, { encoding: "utf8", mode: 0o600 });
chmodSync(output, 0o600);
console.error(JSON.stringify({ ok: true, records: records.length, output }));
