#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCHEMA_VERSION = "obsidian-epoch.phase6-world-gate.v1";
const MAX_ERROR_DETAILS = 100;
const SECRET_KEY = /(?:secret|token|api[-_]?key|authorization|password|credential|private[-_]?key|access[-_]?key|refresh[-_]?token|session[-_]?key|client[-_]?secret)/i;
const SECRET_VALUE = /(?:\b(?:sk-[A-Za-z0-9_-]{12,}|Bearer\s+[A-Za-z0-9._~+/=-]{12,}|xox[baprs]-[A-Za-z0-9-]{12,}|AKIA[0-9A-Z]{16})\b|-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----)/i;
const LEGAL_NO_WORLD_CHANGE_REASONS = new Set([
  "already_applied",
  "duplicate_action",
  "idempotent_replay",
  "no_effect",
  "no_material_change",
  "out_of_scope",
  "read_only",
  "replay_only",
  "unchanged",
  "world_delta_not_required",
]);

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "../..");

function usage() {
  return [
    "Usage: node tools/agent-server/phase6-world-gate.mjs --input <repo-relative-json-or-jsonl> [--input <path> ...]",
    "",
    "Reads RunReceipt/world replay JSON or JSONL from repository-relative files.",
    "Prints only counts, hashes, and stable error codes. Exits non-zero on gate failure.",
  ].join("\n");
}

function printJson(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function sha256Text(text) {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}

function canonicalize(value, pathLabel = "$", seen = new WeakSet()) {
  if (value === null) return "null";
  switch (typeof value) {
    case "string":
      return JSON.stringify(value);
    case "boolean":
      return value ? "true" : "false";
    case "number":
      if (!Number.isFinite(value)) throw new Error(`ERR_CANONICAL_NON_FINITE_NUMBER:${pathLabel}`);
      return JSON.stringify(value);
    case "undefined":
      throw new Error(`ERR_CANONICAL_UNDEFINED:${pathLabel}`);
    case "function":
    case "symbol":
    case "bigint":
      throw new Error(`ERR_CANONICAL_UNSUPPORTED:${pathLabel}`);
    case "object":
      break;
    default:
      throw new Error(`ERR_CANONICAL_UNSUPPORTED:${pathLabel}`);
  }

  if (seen.has(value)) throw new Error(`ERR_CANONICAL_CYCLE:${pathLabel}`);
  seen.add(value);
  if (Array.isArray(value)) {
    const items = value.map((item, index) => canonicalize(item, `${pathLabel}[${index}]`, seen));
    seen.delete(value);
    return `[${items.join(",")}]`;
  }

  const properties = Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalize(value[key], `${pathLabel}.${key}`, seen)}`);
  seen.delete(value);
  return `{${properties.join(",")}}`;
}

function canonicalHash(value) {
  return `sha256:${sha256Text(canonicalize(value))}`;
}

function parseArguments(argv) {
  const options = { inputs: [], help: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help" || argument === "-h") {
      options.help = true;
      continue;
    }
    if (argument === "--input" || argument === "--receipt" || argument === "--world-replay") {
      const value = argv[index + 1];
      if (!value) throw new Error("ERR_ARGUMENT_INPUT_REQUIRED");
      options.inputs.push(value);
      index += 1;
      continue;
    }
    throw new Error("ERR_ARGUMENT_UNKNOWN");
  }
  if (!options.help && options.inputs.length === 0) throw new Error("ERR_INPUT_REQUIRED");
  return options;
}

function isRepositoryRelative(candidate) {
  if (typeof candidate !== "string" || candidate.length === 0 || path.isAbsolute(candidate)) return false;
  const normalized = path.normalize(candidate);
  return normalized !== ".." && !normalized.startsWith(`..${path.sep}`);
}

function ensureInsideRepository(realPath, repositoryRealPath) {
  const relative = path.relative(repositoryRealPath, realPath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function repositorySlash(absolutePath) {
  return path.relative(repositoryRoot, absolutePath).split(path.sep).join("/");
}

function readInputFile(inputPath, repositoryRealPath, errors) {
  if (!isRepositoryRelative(inputPath)) {
    errors.add("ERR_INPUT_PATH_OUTSIDE_REPOSITORY", inputPath);
    return undefined;
  }
  const absolutePath = path.resolve(repositoryRoot, inputPath);
  let realPath;
  let stat;
  try {
    realPath = fs.realpathSync(absolutePath);
    stat = fs.statSync(realPath);
  } catch {
    errors.add("ERR_INPUT_NOT_FOUND", inputPath);
    return undefined;
  }
  if (!ensureInsideRepository(realPath, repositoryRealPath)) {
    errors.add("ERR_INPUT_PATH_OUTSIDE_REPOSITORY", inputPath);
    return undefined;
  }
  if (!stat.isFile()) {
    errors.add("ERR_INPUT_NOT_FILE", inputPath);
    return undefined;
  }
  const text = fs.readFileSync(realPath, "utf8");
  if (text.length === 0) errors.add("ERR_INPUT_EMPTY", inputPath);
  return {
    path: repositorySlash(realPath),
    bytes: Buffer.byteLength(text, "utf8"),
    sha256: `sha256:${sha256Text(text)}`,
    text,
  };
}

function tryParseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function flattenRecords(value, records = []) {
  if (Array.isArray(value)) {
    value.forEach((entry) => flattenRecords(entry, records));
    return records;
  }
  if (value && typeof value === "object") {
    for (const key of ["records", "runs", "samples", "events", "receipts", "replay"]) {
      if (Array.isArray(value[key])) {
        flattenRecords(value[key], records);
        return records;
      }
    }
    records.push(value);
  }
  return records;
}

function parseRecords(input, errors) {
  const whole = tryParseJson(input.text.trim());
  if (whole !== undefined) {
    return flattenRecords(whole).map((record, index) => ({ record, inputPath: input.path, recordIndex: index + 1 }));
  }

  const records = [];
  input.text.split(/\r?\n/).forEach((line, lineIndex) => {
    if (!line.trim()) return;
    const parsed = tryParseJson(line.trim());
    if (parsed === undefined) {
      errors.add("ERR_JSONL_PARSE", `${input.path}:${lineIndex + 1}`);
      return;
    }
    flattenRecords(parsed).forEach((record) => {
      records.push({ record, inputPath: input.path, recordIndex: lineIndex + 1 });
    });
  });
  return records;
}

function createErrorCollector() {
  const counts = new Map();
  const details = [];
  return {
    add(code, pathLabel) {
      counts.set(code, (counts.get(code) || 0) + 1);
      if (details.length < MAX_ERROR_DETAILS) {
        details.push(pathLabel ? { code, path: String(pathLabel) } : { code });
      }
    },
    count(code) {
      return counts.get(code) || 0;
    },
    list() {
      return [...counts.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([code, count]) => ({ code, count }));
    },
    details() {
      return details.slice();
    },
    hasErrors() {
      return counts.size > 0;
    },
  };
}

function getPath(value, segments) {
  let current = value;
  for (const segment of segments) {
    if (!current || typeof current !== "object" || !(segment in current)) return undefined;
    current = current[segment];
  }
  return current;
}

function firstValue(record, paths) {
  for (const candidatePath of paths) {
    const value = getPath(record, candidatePath);
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return undefined;
}

function textValue(value) {
  if (value === undefined || value === null || value === "") return undefined;
  return String(value);
}

function numericValue(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function timeValue(value) {
  const numeric = numericValue(value);
  if (numeric !== undefined) return numeric;
  if (typeof value === "string" && value.trim()) {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function arrayOfText(value) {
  if (Array.isArray(value)) return value.map(textValue).filter(Boolean);
  const single = textValue(value);
  return single ? [single] : [];
}

function nestedReceipt(record) {
  for (const candidatePath of [
    ["RunReceipt"],
    ["runReceipt"],
    ["run_receipt"],
    ["receipt"],
    ["payload", "RunReceipt"],
    ["payload", "runReceipt"],
    ["payload", "receipt"],
  ]) {
    const value = getPath(record, candidatePath);
    if (value && typeof value === "object" && !Array.isArray(value)) {
      if (value.receiptType === "journey_run_receipt" || value.world || value.deltas || value.eventIds) return value;
    }
  }
  if (record.receiptType === "journey_run_receipt" || record.world || record.deltas || record.eventIds) return record;
  return undefined;
}

function isWorldReplayRecord(record) {
  const name = textValue(firstValue(record, [["type"], ["event"], ["eventType"], ["name"], ["payload", "type"], ["payload", "eventType"]])) || "";
  return /world|replay|causal/i.test(name)
    || firstValue(record, [["cursor"], ["canonicalCursor"], ["worldCursor"], ["payload", "cursor"], ["payload", "canonicalCursor"]]) !== undefined
    || firstValue(record, [["eventId"], ["event_id"], ["id"], ["payload", "eventId"]]) !== undefined;
}

function extractWorldDelta(record, receipt) {
  return firstValue(receipt || record, [
    ["worldDelta"],
    ["world_delta"],
    ["ragDelta"],
    ["rag_delta"],
    ["knowledgeDelta"],
    ["world", "delta"],
    ["payload", "worldDelta"],
    ["payload", "world_delta"],
    ["payload", "ragDelta"],
    ["deltas"],
  ]);
}

function hasNonEmptyDelta(delta) {
  if (Array.isArray(delta)) return delta.length > 0;
  if (delta && typeof delta === "object") return Object.keys(delta).length > 0;
  return Boolean(delta);
}

function noWorldChangeReason(record, receipt) {
  const value = firstValue(receipt || record, [
    ["noWorldChangeReason"],
    ["no_world_change_reason"],
    ["worldNoChangeReason"],
    ["noChangeReason"],
    ["no_change_reason"],
    ["payload", "noWorldChangeReason"],
    ["payload", "noChangeReason"],
  ]);
  const reason = textValue(value);
  return reason ? reason.trim() : undefined;
}

function extractEventIds(record, receipt) {
  const target = receipt || record;
  const eventIds = new Set();
  for (const value of [
    firstValue(target, [["eventIds"], ["event_ids"], ["sourceEventIds"], ["source_event_ids"]]),
    firstValue(record, [["eventIds"], ["event_ids"], ["sourceEventIds"], ["source_event_ids"], ["payload", "eventIds"]]),
  ]) {
    arrayOfText(value).forEach((eventId) => eventIds.add(eventId));
    if (value && typeof value === "object" && !Array.isArray(value)) {
      for (const nested of Object.values(value)) arrayOfText(nested).forEach((eventId) => eventIds.add(eventId));
    }
  }
  if (Array.isArray(target?.deltas)) {
    target.deltas.forEach((delta) => arrayOfText(delta?.eventIds).forEach((eventId) => eventIds.add(eventId)));
  }
  const directEventId = textValue(firstValue(record, [["eventId"], ["event_id"], ["id"], ["payload", "eventId"]]));
  if (directEventId) eventIds.add(directEventId);
  return [...eventIds].filter(Boolean);
}

function extractWorldTime(record, receipt) {
  return firstValue(receipt || record, [
    ["world", "worldTime"],
    ["worldTime"],
    ["world_time"],
    ["payload", "world", "worldTime"],
    ["payload", "worldTime"],
    ["occurredAtWorldMinute"],
    ["worldMinute"],
    ["tick"],
  ]);
}

function extractRunKey(record, receipt) {
  return textValue(firstValue(receipt || record, [
    ["runId"],
    ["journeyId"],
    ["world", "worldId"],
    ["worldId"],
    ["payload", "runId"],
    ["payload", "worldId"],
  ])) || "global";
}

function extractCursor(record) {
  const value = firstValue(record, [
    ["canonicalCursor"],
    ["cursor"],
    ["worldCursor"],
    ["replayCursor"],
    ["payload", "canonicalCursor"],
    ["payload", "cursor"],
    ["payload", "worldCursor"],
  ]);
  if (typeof value === "string" && value.trim()) return { value: value.trim(), sequence: numericValue(value) };
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const sequence = numericValue(firstValue(value, [["sequence"], ["seq"], ["offset"], ["worldMinute"], ["tick"]]));
    const eventId = textValue(firstValue(value, [["eventId"], ["event_id"], ["id"]]));
    const stable = textValue(firstValue(value, [["value"], ["cursor"], ["canonical"], ["hash"]]));
    return {
      value: stable || canonicalHash({
        eventId,
        sequence,
        worldMinute: firstValue(value, [["worldMinute"], ["world_time"], ["worldTime"]]),
        regionId: firstValue(value, [["regionId"], ["region_id"]]),
      }),
      sequence,
      eventId,
    };
  }
  return undefined;
}

function extractTick(record, cursor) {
  return numericValue(firstValue(record, [
    ["tick"],
    ["worldTick"],
    ["worldMinute"],
    ["occurredAtWorldMinute"],
    ["sequence"],
    ["seq"],
    ["payload", "tick"],
    ["payload", "worldMinute"],
    ["payload", "sequence"],
  ])) ?? cursor?.sequence;
}

function extractBootKey(record) {
  return textValue(firstValue(record, [
    ["bootId"],
    ["processId"],
    ["serverBootId"],
    ["restartId"],
    ["serviceRestartId"],
    ["payload", "bootId"],
    ["payload", "restartId"],
  ]));
}

function extractDeterminismKey(record, receipt) {
  const target = receipt || record;
  const seed = textValue(firstValue(target, [["seed"], ["runSeed"], ["input", "seed"], ["payload", "seed"]]));
  const ruleset = textValue(firstValue(target, [
    ["ruleset"],
    ["rulesetVersion"],
    ["ruleset_version"],
    ["input", "ruleset"],
    ["input", "rulesetVersion"],
    ["payload", "rulesetVersion"],
  ]));
  const catalog = textValue(firstValue(target, [
    ["catalog"],
    ["catalogVersion"],
    ["catalog_version"],
    ["input", "catalog"],
    ["input", "catalogVersion"],
    ["payload", "catalogVersion"],
  ]));
  const actions = firstValue(target, [
    ["actions"],
    ["actionLog"],
    ["action_log"],
    ["input", "actions"],
    ["payload", "actions"],
  ]);
  if (!seed || !ruleset || !catalog || actions === undefined) return undefined;
  return canonicalHash({ seed, ruleset, catalog, actions });
}

function extractResultBody(receipt) {
  if (!receipt || typeof receipt !== "object") return undefined;
  return {
    world: receipt.world,
    deltas: receipt.deltas,
    score: receipt.score,
    suitability: receipt.suitability,
    rag: receipt.rag,
    eventIds: receipt.eventIds,
  };
}

function inspectForSecrets(value, pathLabel, errors) {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => inspectForSecrets(entry, `${pathLabel}[${index}]`, errors));
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, entry] of Object.entries(value)) {
      const nextPath = `${pathLabel}.${key}`;
      if (SECRET_KEY.test(key)) errors.add("ERR_SECRET_FIELD", nextPath);
      inspectForSecrets(entry, nextPath, errors);
    }
    return;
  }
  if (typeof value === "string" && SECRET_VALUE.test(value)) errors.add("ERR_SECRET_VALUE", pathLabel);
}

function looksLikeNarration(record) {
  const name = textValue(firstValue(record, [["type"], ["event"], ["eventType"], ["name"], ["payload", "type"], ["payload", "eventType"]])) || "";
  if (/narrat|llm|model|completion|assistant/i.test(name)) return true;
  return firstValue(record, [["modelNarration"], ["narration"], ["assistantMessage"], ["payload", "modelNarration"], ["payload", "narration"]]) !== undefined;
}

function validateRecords(records, errors) {
  const receiptSummaries = [];
  const replaySummaries = [];
  const eventIds = new Set();
  const duplicateEventIds = new Set();
  const timeByRun = new Map();
  const ticksByRun = new Map();
  const cursorByRun = new Map();
  const determinism = new Map();
  const bootByRun = new Map();

  records.forEach((entry, index) => {
    const { record, inputPath, recordIndex } = entry;
    const pathLabel = `${inputPath}#${recordIndex}`;
    inspectForSecrets(record, pathLabel, errors);

    const receipt = nestedReceipt(record);
    const worldReplay = isWorldReplayRecord(record);
    if (!receipt && !worldReplay) return;

    const runKey = extractRunKey(record, receipt);
    const recordEventIds = extractEventIds(record, receipt);
    if (recordEventIds.length === 0) errors.add("ERR_EVENT_IDS_MISSING", pathLabel);
    recordEventIds.forEach((eventId) => {
      if (eventIds.has(eventId)) duplicateEventIds.add(eventId);
      eventIds.add(eventId);
    });

    const worldTime = extractWorldTime(record, receipt);
    const sortableTime = timeValue(worldTime);
    if (worldTime === undefined || sortableTime === undefined) {
      errors.add("ERR_WORLD_TIME_MISSING", pathLabel);
    } else {
      const previous = timeByRun.get(runKey);
      if (previous !== undefined && sortableTime < previous) errors.add("ERR_WORLD_TIME_NON_MONOTONIC", pathLabel);
      timeByRun.set(runKey, sortableTime);
    }

    const delta = extractWorldDelta(record, receipt);
    const reason = noWorldChangeReason(record, receipt);
    if (!hasNonEmptyDelta(delta)) {
      if (!reason) errors.add("ERR_WORLD_DELTA_OR_REASON_MISSING", pathLabel);
      else if (!LEGAL_NO_WORLD_CHANGE_REASONS.has(reason)) errors.add("ERR_NO_WORLD_CHANGE_REASON_INVALID", pathLabel);
    }

    if (receipt) {
      const requiredFields = [
        ["receiptId"],
        ["runId"],
        ["world", "worldId"],
        ["world", "regionId"],
        ["world", "snapshotHash"],
        ["integrity", "bodyHash"],
      ];
      requiredFields.forEach((fieldPath) => {
        if (firstValue(receipt, [fieldPath]) === undefined) errors.add("ERR_RECEIPT_FIELD_MISSING", `${pathLabel}.${fieldPath.join(".")}`);
      });

      const resultBody = extractResultBody(receipt);
      const resultHash = resultBody ? canonicalHash(resultBody) : undefined;
      const deterministicKey = extractDeterminismKey(record, receipt);
      if (deterministicKey && resultHash) {
        const existing = determinism.get(deterministicKey);
        if (existing && existing !== resultHash) errors.add("ERR_DETERMINISM_HASH_MISMATCH", pathLabel);
        determinism.set(deterministicKey, resultHash);
      } else {
        errors.add("ERR_DETERMINISM_FIELDS_MISSING", pathLabel);
      }
      receiptSummaries.push({ runKey, resultHash: resultHash || null });
    }

    if (worldReplay) {
      const cursor = extractCursor(record);
      if (!cursor?.value) errors.add("ERR_CANONICAL_CURSOR_MISSING", pathLabel);
      const tick = extractTick(record, cursor);
      if (tick === undefined) {
        errors.add("ERR_TICK_MISSING", pathLabel);
      } else {
        if (!ticksByRun.has(runKey)) ticksByRun.set(runKey, []);
        ticksByRun.get(runKey).push({ tick, pathLabel });
      }

      const previousCursor = cursorByRun.get(runKey);
      if (previousCursor?.sequence !== undefined && cursor?.sequence !== undefined && cursor.sequence < previousCursor.sequence) {
        errors.add("ERR_CURSOR_NON_MONOTONIC", pathLabel);
      }
      const bootKey = extractBootKey(record);
      const previousBoot = bootByRun.get(runKey);
      if (previousBoot && bootKey && previousBoot !== bootKey) {
        if (previousCursor?.sequence !== undefined && cursor?.sequence !== undefined && cursor.sequence !== previousCursor.sequence + 1) {
          errors.add("ERR_RESTART_CURSOR_DISCONTINUITY", pathLabel);
        }
      }
      if (bootKey) bootByRun.set(runKey, bootKey);
      if (cursor) cursorByRun.set(runKey, cursor);

      if (looksLikeNarration(record)) errors.add("ERR_MODEL_NARRATION_AS_WORLD_EVENT", pathLabel);
      replaySummaries.push({ runKey, cursor: cursor?.value || null, tick: tick ?? null });
    }

    if (index > Number.MAX_SAFE_INTEGER) errors.add("ERR_RECORD_LIMIT_UNSUPPORTED", pathLabel);
  });

  duplicateEventIds.forEach(() => errors.add("ERR_EVENT_ID_DUPLICATE"));

  for (const ticks of ticksByRun.values()) {
    const sorted = ticks.slice().sort((left, right) => left.tick - right.tick);
    for (let index = 1; index < sorted.length; index += 1) {
      const previous = sorted[index - 1];
      const current = sorted[index];
      if (current.tick === previous.tick) errors.add("ERR_TICK_DUPLICATE", current.pathLabel);
      if (Number.isInteger(current.tick) && Number.isInteger(previous.tick) && current.tick > previous.tick + 1) {
        errors.add("ERR_TICK_GAP", current.pathLabel);
      }
    }
  }

  if (receiptSummaries.length === 0) errors.add("ERR_NO_RUN_RECEIPTS");
  if (replaySummaries.length === 0) errors.add("ERR_NO_WORLD_REPLAY");

  return {
    receipts: receiptSummaries,
    replay: replaySummaries,
    uniqueEventIds: eventIds.size,
    deterministicGroups: determinism.size,
  };
}

function main() {
  let options;
  try {
    options = parseArguments(process.argv.slice(2));
  } catch (error) {
    printJson({
      ok: false,
      schemaVersion: SCHEMA_VERSION,
      errors: [{ code: error.message || "ERR_ARGUMENT_INVALID", count: 1 }],
    });
    process.exitCode = 1;
    return;
  }

  if (options.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }

  const errors = createErrorCollector();
  let repositoryRealPath;
  try {
    repositoryRealPath = fs.realpathSync(repositoryRoot);
  } catch {
    printJson({
      ok: false,
      schemaVersion: SCHEMA_VERSION,
      errors: [{ code: "ERR_REPOSITORY_ROOT_UNREADABLE", count: 1 }],
    });
    process.exitCode = 1;
    return;
  }

  const inputs = options.inputs
    .map((inputPath) => readInputFile(inputPath, repositoryRealPath, errors))
    .filter(Boolean);
  const records = inputs.flatMap((input) => parseRecords(input, errors));
  const gate = validateRecords(records, errors);
  const summaryHash = canonicalHash({
    inputs: inputs.map((input) => ({ path: input.path, bytes: input.bytes, sha256: input.sha256 })),
    receipts: gate.receipts,
    replay: gate.replay,
  });

  const output = {
    ok: !errors.hasErrors(),
    schemaVersion: SCHEMA_VERSION,
    inputs: inputs.map((input) => ({ path: input.path, bytes: input.bytes, sha256: input.sha256 })),
    counts: {
      inputs: inputs.length,
      records: records.length,
      runReceipts: gate.receipts.length,
      worldReplayRecords: gate.replay.length,
      uniqueEventIds: gate.uniqueEventIds,
      deterministicGroups: gate.deterministicGroups,
      errors: errors.list().reduce((sum, item) => sum + item.count, 0),
    },
    hash: {
      gate: summaryHash,
      receipts: canonicalHash(gate.receipts),
      replay: canonicalHash(gate.replay),
    },
    errors: errors.list(),
    errorDetails: errors.details(),
  };

  printJson(output);
  if (!output.ok) process.exitCode = 1;
}

main();
