#!/usr/bin/env node

import fs from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const REQUIRED_RUNS = 10;
const SECRET_KEY = /(?:secret|token|api[-_]?key|authorization|password|credential|private[-_]?key|access[-_]?key|refresh[-_]?token|session[-_]?key|recovery[-_]?code)/i;
const SECRET_VALUE = /\b(?:sk-[A-Za-z0-9_-]{12,}|Bearer\s+[A-Za-z0-9._-]{12,}|xox[baprs]-[A-Za-z0-9-]{12,}|AKIA[0-9A-Z]{16})\b/i;
const INTERNAL_ERROR = /internal_error/i;
const LEGACY_TOOL = /(?:legacy[_-]?tool|tool[_-]?legacy|legacyTool|deprecated[_-]?tool)/i;
const FIXED_FALLBACK_SCORE = /(?:fixed[_-]?fallback|fallback[_-]?score|score[_-]?fallback|default[_-]?score)/i;
const RUN_RECEIPT_TOOL_NAME = "obsidian_epoch.run_receipt";
const PHASE6_RESULT_TOOL_NAME = "obsidian_epoch.phase6_result";
const START_JOURNEY_TOOL_NAME = "obsidian_epoch.start_journey";
const BEGIN_PHASE6_EXPERIMENT_TOOL_NAME = "obsidian_epoch.begin_phase6_experiment";
const BEGIN_PHASE6_RUN_TOOL_NAME = "obsidian_epoch.begin_phase6_run";
const PHASE6_EXPERIMENT_STATUS_TOOL_NAME = "obsidian_epoch.phase6_experiment_status";
const JOURNEY_STATUS_TOOL_NAME = "obsidian_epoch.journey_status";
const PLAYER_PANEL_TOOL_NAME = "obsidian_epoch.player_panel";
const EXPECTED_SCENARIO_TAGS = Object.freeze([
  "low-prepared-resource",
  "low-underprepared-information",
  "medium-prepared-tactical",
  "medium-borderline-escort",
  "medium-mismatched-preserve",
  "high-prepared-high-value",
  "high-underprepared-evacuation",
  "medium-prepared-cultivation",
  "medium-specialist-crafting",
  "dynamic-mixed-repeat",
]);
const COMPACT_ONLY_TOOL_NAMES = new Set([
  START_JOURNEY_TOOL_NAME,
  JOURNEY_STATUS_TOOL_NAME,
  "obsidian_epoch.propose_journey_step",
  "obsidian_epoch.commit_journey_action",
  RUN_RECEIPT_TOOL_NAME,
  PHASE6_RESULT_TOOL_NAME,
]);
const RUN_RECEIPT_V2_SCHEMA = "journey_run_receipt.v2";
const SERVER_ISSUED_START_FIELDS = [
  "experimentId",
  "experiment_id",
  "runIndex",
  "run_index",
  "seed",
  "runSeed",
  "run_seed",
  "versions",
  "rulesetVersion",
  "ruleset_version",
  "catalogVersion",
  "catalog_version",
  "codeVersion",
  "code_version",
  "scenarioMatrixVersion",
  "scenario_matrix_version",
  "binding",
  "runReceipt",
  "run_receipt",
  "receipt",
];

function usage() {
  return [
    "Usage: node tools/agent-server/phase6-ten-run.mjs [--input <path>] [--experiment-id <id>]",
    "",
    "Reads JSONL or command output from --input or stdin and prints a machine JSON summary.",
    "Exits non-zero when any Phase 6 ten-run gate fails.",
  ].join("\n");
}

function parseArguments(argv) {
  const options = { inputPath: undefined, experimentId: undefined, help: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help" || argument === "-h") {
      options.help = true;
      continue;
    }
    if (argument === "--input") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("--input requires a path");
      }
      options.inputPath = value;
      index += 1;
      continue;
    }
    if (argument === "--experiment-id") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("--experiment-id requires a value");
      }
      options.experimentId = value;
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${argument}`);
  }
  return options;
}

function readInput(inputPath) {
  if (inputPath) {
    return fs.readFileSync(inputPath, "utf8");
  }
  return fs.readFileSync(0, "utf8");
}

function tryParseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function extractJsonCandidate(line) {
  const trimmed = line.trim();
  if (!trimmed) {
    return undefined;
  }
  const direct = tryParseJson(trimmed);
  if (direct !== undefined) {
    return direct;
  }

  const objectStart = trimmed.indexOf("{");
  const objectEnd = trimmed.lastIndexOf("}");
  if (objectStart >= 0 && objectEnd > objectStart) {
    const parsed = tryParseJson(trimmed.slice(objectStart, objectEnd + 1));
    if (parsed !== undefined) {
      return parsed;
    }
  }

  const arrayStart = trimmed.indexOf("[");
  const arrayEnd = trimmed.lastIndexOf("]");
  if (arrayStart >= 0 && arrayEnd > arrayStart) {
    return tryParseJson(trimmed.slice(arrayStart, arrayEnd + 1));
  }
  return undefined;
}

function flattenRecords(value, records = []) {
  if (Array.isArray(value)) {
    for (const entry of value) {
      flattenRecords(entry, records);
    }
    return records;
  }
  if (value && typeof value === "object") {
    records.push(value);
    flattenToolResult(value.tool_result, records);
    flattenToolResult(value.toolResult, records);
  }
  return records;
}

function flattenToolResult(value, records) {
  if (value === undefined || value === null) {
    return;
  }
  if (typeof value === "string") {
    const parsed = extractJsonCandidate(value);
    if (parsed !== undefined) {
      flattenRecords(parsed, records);
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const entry of value) {
      flattenToolResult(entry, records);
    }
    return;
  }
  if (!value || typeof value !== "object") {
    return;
  }
  if (typeof value.text === "string") {
    flattenToolResult(value.text, records);
  }
  if (typeof value.content === "string" || Array.isArray(value.content)) {
    flattenToolResult(value.content, records);
  }
  flattenRecords(value, records);
}

function parseRecords(input) {
  const records = [];
  const parseErrors = [];
  input.split(/\r?\n/).forEach((line, index) => {
    if (!line.trim()) {
      return;
    }
    const parsed = extractJsonCandidate(line);
    if (parsed === undefined) {
      parseErrors.push({
        lineNumber: index + 1,
        byteLength: Buffer.byteLength(line),
        sha256: createHash("sha256").update(line).digest("hex"),
      });
      return;
    }
    flattenRecords(parsed, records);
  });
  return { records, parseErrors };
}

function isCanonicalCdeRecord(record) {
  return record?.schemaVersion === "phase6.cde_tool_record.v1";
}

function setIfPresent(target, key, value) {
  if (value !== undefined && value !== null && value !== "") {
    target[key] = value;
  }
}

function firstProjectedValue(sources, paths) {
  for (const source of sources) {
    if (!source || typeof source !== "object" || Array.isArray(source)) {
      continue;
    }
    const value = firstValue(source, paths);
    if (value !== undefined) {
      return value;
    }
  }
  return undefined;
}

function projectedVersionsFromSources(sources) {
  const explicit = firstProjectedValue(sources, [
    ["versions"],
    ["result", "versions"],
    ["run", "versions"],
  ]);
  if (explicit && typeof explicit === "object" && !Array.isArray(explicit)) {
    return explicit;
  }
  const versions = {};
  setIfPresent(versions, "rulesetVersion", firstProjectedValue(sources, [
    ["rulesetVersion"],
    ["rulesVersion"],
    ["ruleset_version"],
    ["rules_version"],
    ["ruleset", "version"],
    ["rules", "version"],
  ]));
  setIfPresent(versions, "catalogVersion", firstProjectedValue(sources, [
    ["catalogVersion"],
    ["catalog_version"],
    ["catalog", "version"],
  ]));
  setIfPresent(versions, "codeVersion", firstProjectedValue(sources, [
    ["codeVersion"],
    ["code_version"],
    ["code", "version"],
  ]));
  setIfPresent(versions, "scenarioMatrixVersion", firstProjectedValue(sources, [
    ["scenarioMatrixVersion"],
    ["scenario_matrix_version"],
    ["scenarioMatrix", "version"],
    ["scenario_matrix", "version"],
    ["matrix", "version"],
  ]));
  return Object.keys(versions).length > 0 ? versions : undefined;
}

function canonicalProjection(record) {
  const output = record.output && typeof record.output === "object" && !Array.isArray(record.output) ? record.output : {};
  const input = record.input && typeof record.input === "object" && !Array.isArray(record.input) ? record.input : {};
  const metadata = record.metadata && typeof record.metadata === "object" && !Array.isArray(record.metadata) ? record.metadata : {};
  const sources = [output, input, metadata];
  const projected = {
    schemaVersion: record.schemaVersion,
    sequence: record.sequence,
    timestamp: record.timestamp,
    toolUseId: record.toolUseId,
    sourceToolName: record.sourceToolName,
    originalToolName: record.originalToolName ?? record.sourceToolName,
    toolName: record.toolName,
    isError: record.isError,
    ok: record.ok,
    input: record.input,
    output: record.output,
    metadata: record.metadata,
  };

  setIfPresent(projected, "experimentId", firstProjectedValue(sources, [["experimentId"], ["experiment_id"], ["experiment", "id"], ["run", "experimentId"]]));
  setIfPresent(projected, "identityId", firstProjectedValue(sources, [["identityId"], ["identity_id"], ["identity", "identityId"], ["identity", "id"], ["run", "identityId"]]));
  setIfPresent(projected, "explorerId", firstProjectedValue(sources, [["explorerId"], ["explorer_id"], ["explorer", "explorerId"], ["explorer", "id"], ["identity", "explorerId"], ["run", "explorerId"], ["player", "explorerId"], ["caller", "explorerId"]]));
  setIfPresent(projected, "runIndex", firstProjectedValue(sources, [["runIndex"], ["run_index"], ["index"], ["run", "runIndex"], ["run", "index"]]));
  setIfPresent(projected, "seed", firstProjectedValue(sources, [["seed"], ["runSeed"], ["run_seed"], ["randomSeed"], ["random_seed"], ["run", "seed"]]));
  setIfPresent(projected, "versions", projectedVersionsFromSources(sources));
  setIfPresent(projected, "rulesetVersion", projected.versions?.rulesetVersion ?? projected.versions?.rulesVersion);
  setIfPresent(projected, "catalogVersion", projected.versions?.catalogVersion);
  setIfPresent(projected, "codeVersion", projected.versions?.codeVersion);
  setIfPresent(projected, "scenarioMatrixVersion", projected.versions?.scenarioMatrixVersion);
  setIfPresent(projected, "scenarioTag", firstProjectedValue(sources, [
    ["scenarioTag"],
    ["scenario_tag"],
    ["scenario", "tag"],
    ["scenarioMatrix", "scenarioTag"],
    ["scenarioMatrix", "scenario", "tag"],
    ["startJourneyBinding", "scenarioTag"],
    ["startJourneyBinding", "scenarioMatrix", "scenarioTag"],
  ]));
  setIfPresent(projected, "binding", firstProjectedValue(sources, [["startJourneyBinding"], ["start_journey_binding"], ["binding"], ["runBinding"], ["run_binding"], ["runReceipt"], ["run_receipt"], ["receipt"]]));
  setIfPresent(projected, "eventType", firstProjectedValue(sources, [["eventType"], ["event_type"], ["type"], ["kind"], ["name"], ["stage"], ["phase"], ["message"]]));
  setIfPresent(projected, "status", firstProjectedValue(sources, [["status"], ["state"], ["outcome"]]));
  setIfPresent(projected, "verified", firstProjectedValue(sources, [["verified"], ["isVerified"], ["sidecar", "verified"]]));
  setIfPresent(projected, "formalJourney", firstProjectedValue(sources, [["formalJourney"], ["journey", "formal"], ["journey", "completed"]]) ?? record.formalJourney);
  setIfPresent(projected, "formalResultPage", record.formalResultPage);
  setIfPresent(projected, "runSettled", record.runSettled);
  setIfPresent(projected, "phase6Settlement", firstProjectedValue(sources, [["phase6Settlement"], ["phase6_settlement"]]));
  setIfPresent(projected, "playerPanelBefore", firstProjectedValue(sources, [["playerPanelBefore"], ["beforePlayerPanel"], ["panelBefore"], ["beforePanel"], ["snapshots", "playerPanelBefore"], ["snapshots", "beforePanel"]])
    ?? (record.playerPanelBefore === true && record.toolName === PLAYER_PANEL_TOOL_NAME ? output : undefined));
  setIfPresent(projected, "playerPanelAfter", firstProjectedValue(sources, [["playerPanelAfter"], ["afterPlayerPanel"], ["panelAfter"], ["afterPanel"], ["snapshots", "playerPanelAfter"], ["snapshots", "afterPanel"]])
    ?? (record.playerPanelAfter === true && record.toolName === PLAYER_PANEL_TOOL_NAME ? output : undefined));
  setIfPresent(projected, "resultPage", firstProjectedValue(sources, [["resultPage"], ["result_page"], ["formalResultPage"], ["page"]]));
  setIfPresent(projected, "receipt", firstProjectedValue(sources, [["receipt"], ["RunReceipt"], ["runReceipt"], ["run_receipt"]]));
  setIfPresent(projected, "runReceipt", firstProjectedValue(sources, [["runReceipt"], ["run_receipt"], ["RunReceipt"], ["receipt", "RunReceipt"], ["receipt", "runReceipt"]]));
  setIfPresent(projected, "result", firstProjectedValue(sources, [["result"]]));
  setIfPresent(projected, "eventIds", firstProjectedValue(sources, [["eventIds"], ["event_ids"], ["sourceEventIds"], ["source_event_ids"], ["causalParentEventIds"], ["event", "eventIds"], ["RunReceipt", "eventIds"], ["runReceipt", "eventIds"], ["receipt", "eventIds"]]));
  setIfPresent(projected, "resourceConservation", firstProjectedValue(sources, [["resourceConservation"], ["resource_conservation"], ["resources", "conservation"], ["resourceLedger", "conservation"], ["resourceLedger", "conserved"], ["result", "sections", "settlement", "economyConservation"]]));
  setIfPresent(projected, "ragDelta", firstProjectedValue(sources, [["ragDelta"], ["rag_delta"], ["worldDelta"], ["world_delta"], ["knowledgeDelta"], ["world", "delta"], ["rag", "delta"], ["result", "sections", "world", "changes"], ["result", "sections", "rag", "changes"]]));
  setIfPresent(projected, "noChangeReason", firstProjectedValue(sources, [["noChangeReason"], ["no_change_reason"], ["worldNoChangeReason"], ["ragNoChangeReason"], ["result", "sections", "world", "noChangeReason"], ["result", "sections", "rag", "noChangeReason"]]));
  setIfPresent(projected, "scoreBreakdown", firstProjectedValue(sources, [["scoreBreakdown"], ["score", "breakdown"], ["scoring", "breakdown"], ["result", "score", "breakdown"], ["receipt", "score"], ["runReceipt", "score"]]));
  return projected;
}

function canonicalMetadataConflicts(record, index) {
  if (!isCanonicalCdeRecord(record) || !record.metadata || typeof record.metadata !== "object" || Array.isArray(record.metadata)) {
    return [];
  }
  const trustedSources = [record.output, record.input].filter((value) => value && typeof value === "object" && !Array.isArray(value));
  const checks = [
    ["experimentId", [["experimentId"], ["experiment_id"], ["experiment", "id"], ["run", "experimentId"]]],
    ["runIndex", [["runIndex"], ["run_index"], ["index"], ["run", "runIndex"]]],
    ["seed", [["seed"], ["runSeed"], ["run_seed"], ["randomSeed"], ["random_seed"], ["run", "seed"]]],
    ["identityId", [["identityId"], ["identity_id"], ["identity", "identityId"], ["identity", "id"], ["run", "identityId"]]],
    ["explorerId", [["explorerId"], ["explorer_id"], ["explorer", "explorerId"], ["explorer", "id"], ["identity", "explorerId"], ["run", "explorerId"]]],
    ["versions", [["versions"]]],
    ["binding", [["binding"], ["runReceipt"], ["run_receipt"], ["receipt"]]],
  ];
  const conflicts = [];
  for (const [field, paths] of checks) {
    if (!Object.hasOwn(record.metadata, field)) {
      continue;
    }
    const metadataValue = record.metadata[field];
    const sourceValue = firstProjectedValue(trustedSources, paths);
    if (sourceValue !== undefined && !sameBinding(metadataValue, sourceValue)) {
      conflicts.push({
        index,
        path: `records[${index}].metadata.${field}`,
        field,
      });
    }
  }
  return conflicts;
}

function normalizeCanonicalRecords(records) {
  const metadataConflicts = [];
  const normalized = records.map((record, index) => {
    metadataConflicts.push(...canonicalMetadataConflicts(record, index));
    return isCanonicalCdeRecord(record) ? canonicalProjection(record) : record;
  });
  return { records: normalized, metadataConflicts };
}

function inspectForForbidden(value, path, state) {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => inspectForForbidden(entry, `${path}[${index}]`, state));
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, entry] of Object.entries(value)) {
      const nextPath = path ? `${path}.${key}` : key;
      if (SECRET_KEY.test(key)) {
        state.secretPaths.add(nextPath);
      }
      if (LEGACY_TOOL.test(key)) {
        state.legacyToolPaths.add(nextPath);
      }
      if (FIXED_FALLBACK_SCORE.test(key)) {
        state.fixedFallbackScorePaths.add(nextPath);
      }
      inspectForForbidden(entry, nextPath, state);
    }
    return;
  }
  if (typeof value !== "string") {
    return;
  }
  if (SECRET_VALUE.test(value)) {
    state.secretPaths.add(path || "$");
  }
  if (INTERNAL_ERROR.test(value)) {
    state.internalErrorPaths.add(path || "$");
  }
  if (LEGACY_TOOL.test(value)) {
    state.legacyToolPaths.add(path || "$");
  }
  if (FIXED_FALLBACK_SCORE.test(value)) {
    state.fixedFallbackScorePaths.add(path || "$");
  }
}

function getPath(value, path) {
  let current = value;
  for (const segment of path) {
    if (!current || typeof current !== "object" || !(segment in current)) {
      return undefined;
    }
    current = current[segment];
  }
  return current;
}

function firstValue(record, paths) {
  for (const path of paths) {
    const value = getPath(record, path);
    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }
  return undefined;
}

function stringifyId(value) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  return String(value);
}

function runIndexFromRecord(record) {
  const value = firstValue(record, [
    ["runIndex"],
    ["run_index"],
    ["index"],
    ["run", "runIndex"],
    ["run", "index"],
    ["metadata", "runIndex"],
    ["meta", "runIndex"],
    ["payload", "runIndex"],
    ["payload", "run", "runIndex"],
  ]);
  const numberValue = typeof value === "number" ? value : Number.parseInt(String(value), 10);
  return Number.isInteger(numberValue) && numberValue >= 1 ? numberValue : undefined;
}

function experimentIdFromRecord(record) {
  return stringifyId(firstValue(record, [
    ["experimentId"],
    ["experiment_id"],
    ["experiment", "id"],
    ["run", "experimentId"],
    ["metadata", "experimentId"],
    ["meta", "experimentId"],
    ["payload", "experimentId"],
    ["payload", "run", "experimentId"],
  ]));
}

function identityIdFromRecord(record) {
  return stringifyId(firstValue(record, [
    ["identityId"],
    ["identity_id"],
    ["identity", "identityId"],
    ["identity", "id"],
    ["run", "identityId"],
    ["metadata", "identityId"],
    ["meta", "identityId"],
    ["payload", "identityId"],
    ["payload", "identity", "identityId"],
    ["payload", "run", "identityId"],
  ]));
}

function explorerIdFromRecord(record) {
  return stringifyId(firstValue(record, [
    ["explorerId"],
    ["explorer_id"],
    ["explorer", "explorerId"],
    ["explorer", "id"],
    ["identity", "explorerId"],
    ["run", "explorerId"],
    ["metadata", "explorerId"],
    ["meta", "explorerId"],
    ["payload", "explorerId"],
    ["payload", "explorer", "explorerId"],
    ["payload", "identity", "explorerId"],
    ["payload", "run", "explorerId"],
    ["player", "explorerId"],
    ["caller", "explorerId"],
  ]));
}

function scenarioMatrixVersionFromRecord(record) {
  return stringifyId(firstValue(record, [
    ["scenarioMatrixVersion"],
    ["scenario_matrix_version"],
    ["scenarioMatrix", "version"],
    ["scenario_matrix", "version"],
    ["matrix", "version"],
    ["run", "scenarioMatrixVersion"],
    ["metadata", "scenarioMatrixVersion"],
    ["meta", "scenarioMatrixVersion"],
    ["payload", "scenarioMatrixVersion"],
    ["payload", "scenarioMatrix", "version"],
    ["payload", "run", "scenarioMatrixVersion"],
  ]));
}

function scenarioTagFromRecord(record) {
  return stringifyId(firstValue(record, [
    ["scenarioTag"],
    ["scenario_tag"],
    ["scenario", "tag"],
    ["scenarioMatrix", "scenarioTag"],
    ["scenarioMatrix", "scenario", "tag"],
    ["binding", "scenarioTag"],
    ["binding", "scenarioMatrix", "scenarioTag"],
    ["run", "scenarioTag"],
    ["input", "scenarioTag"],
    ["input", "scenario", "tag"],
    ["input", "startJourneyBinding", "scenarioTag"],
    ["input", "startJourneyBinding", "scenarioMatrix", "scenarioTag"],
    ["output", "scenarioTag"],
    ["output", "scenario", "tag"],
    ["output", "startJourneyBinding", "scenarioTag"],
    ["output", "startJourneyBinding", "scenarioMatrix", "scenarioTag"],
    ["payload", "scenarioTag"],
    ["payload", "scenario", "tag"],
  ]));
}

function rulesetVersionFromRecord(record) {
  return stringifyId(firstValue(record, [
    ["rulesetVersion"],
    ["rulesVersion"],
    ["ruleset_version"],
    ["rules_version"],
    ["ruleset", "version"],
    ["rules", "version"],
    ["versions", "rulesetVersion"],
    ["versions", "rulesVersion"],
    ["run", "rulesetVersion"],
    ["metadata", "rulesetVersion"],
    ["meta", "rulesetVersion"],
    ["payload", "rulesetVersion"],
    ["payload", "rulesVersion"],
    ["payload", "versions", "rulesetVersion"],
    ["payload", "versions", "rulesVersion"],
    ["payload", "run", "rulesetVersion"],
  ]));
}

function catalogVersionFromRecord(record) {
  return stringifyId(firstValue(record, [
    ["catalogVersion"],
    ["catalog_version"],
    ["catalog", "version"],
    ["versions", "catalogVersion"],
    ["run", "catalogVersion"],
    ["metadata", "catalogVersion"],
    ["meta", "catalogVersion"],
    ["payload", "catalogVersion"],
    ["payload", "catalog", "version"],
    ["payload", "versions", "catalogVersion"],
    ["payload", "run", "catalogVersion"],
  ]));
}

function codeVersionFromRecord(record) {
  return stringifyId(firstValue(record, [
    ["codeVersion"],
    ["code_version"],
    ["code", "version"],
    ["versions", "codeVersion"],
    ["run", "codeVersion"],
    ["metadata", "codeVersion"],
    ["meta", "codeVersion"],
    ["payload", "codeVersion"],
    ["payload", "code", "version"],
    ["payload", "versions", "codeVersion"],
    ["payload", "run", "codeVersion"],
  ]));
}

function seedFromRecord(record) {
  return stringifyId(firstValue(record, [
    ["seed", "seed"],
    ["seed"],
    ["runSeed"],
    ["run_seed"],
    ["randomSeed"],
    ["random_seed"],
    ["run", "seed"],
    ["metadata", "seed"],
    ["meta", "seed"],
    ["payload", "seed"],
    ["payload", "run", "seed"],
  ]));
}

function eventName(record) {
  return String(firstValue(record, [
    ["eventType"],
    ["event_type"],
    ["type"],
    ["kind"],
    ["name"],
    ["stage"],
    ["phase"],
    ["message"],
    ["payload", "eventType"],
    ["payload", "type"],
    ["payload", "kind"],
  ]) || "");
}

function hasTruthyPath(record, paths) {
  return paths.some((path) => {
    const value = getPath(record, path);
    if (Array.isArray(value)) {
      return value.length > 0;
    }
    if (value && typeof value === "object") {
      return Object.keys(value).length > 0;
    }
    return Boolean(value);
  });
}

function explicitSuccess(record) {
  const success = firstValue(record, [
    ["success"],
    ["ok"],
    ["payload", "success"],
    ["payload", "ok"],
    ["result", "success"],
    ["result", "ok"],
  ]);
  if (success === true || success === "true" || success === "success" || success === "ok") {
    return true;
  }
  const status = stringifyId(firstValue(record, [
    ["status"],
    ["state"],
    ["outcome"],
    ["payload", "status"],
    ["payload", "state"],
    ["result", "status"],
    ["result", "state"],
  ]));
  if (status && /^(success|succeeded|ok|completed)$/i.test(status)) {
    return true;
  }
  return firstValue(record, [["isError"], ["is_error"], ["payload", "isError"]]) === false;
}

function explicitVerified(record) {
  const verified = firstValue(record, [
    ["verified"],
    ["isVerified"],
    ["payload", "verified"],
    ["payload", "isVerified"],
    ["result", "verified"],
    ["result", "isVerified"],
    ["sidecar", "verified"],
    ["payload", "sidecar", "verified"],
  ]);
  return verified === true || verified === "true" || verified === "verified";
}

function toolNameFromRecord(record) {
  return stringifyId(firstValue(record, [
    ["tool"],
    ["toolName"],
    ["tool_name"],
    ["name"],
    ["command"],
    ["method"],
    ["serverToolName"],
    ["request", "tool"],
    ["request", "name"],
    ["request", "command"],
    ["payload", "tool"],
    ["payload", "toolName"],
    ["payload", "name"],
    ["payload", "command"],
  ]));
}

function sourceToolNamesFromRecord(record) {
  return [
    firstValue(record, [["sourceToolName"], ["source_tool_name"], ["payload", "sourceToolName"], ["metadata", "sourceToolName"]]),
    firstValue(record, [["originalToolName"], ["original_tool_name"], ["payload", "originalToolName"], ["metadata", "originalToolName"]]),
  ].map(stringifyId).filter(Boolean);
}

function hasExplicitSourceToolName(record) {
  return sourceToolNamesFromRecord(record).length > 0;
}

function timestampMillisFromRecord(record) {
  const value = firstValue(record, [
    ["timestamp"],
    ["createdAt"],
    ["created_at"],
    ["time"],
    ["occurredAt"],
    ["occurred_at"],
    ["metadata", "timestamp"],
    ["payload", "timestamp"],
  ]);
  if (value === undefined) {
    return undefined;
  }
  const millis = typeof value === "number" ? value : Date.parse(String(value));
  return Number.isFinite(millis) ? millis : undefined;
}

function isToolSuccessRecord(record, expectedName) {
  return toolNameFromRecord(record) === expectedName && explicitSuccess(record);
}

function objectsFromValue(value, objects = []) {
  if (value === undefined || value === null) {
    return objects;
  }
  if (typeof value === "string") {
    const parsed = extractJsonCandidate(value);
    if (parsed !== undefined) {
      objectsFromValue(parsed, objects);
    }
    return objects;
  }
  if (Array.isArray(value)) {
    for (const entry of value) {
      objectsFromValue(entry, objects);
    }
    return objects;
  }
  if (typeof value !== "object") {
    return objects;
  }
  objects.push(value);
  if (typeof value.text === "string") {
    objectsFromValue(value.text, objects);
  }
  if (typeof value.content === "string" || Array.isArray(value.content)) {
    objectsFromValue(value.content, objects);
  }
  return objects;
}

function candidateObjects(record, paths) {
  const objects = [record];
  for (const path of paths) {
    objectsFromValue(getPath(record, path), objects);
  }
  return objects.filter((entry) => entry && typeof entry === "object" && !Array.isArray(entry));
}

function toolPayloadCandidates(record) {
  return candidateObjects(record, [
    ["tool_result"],
    ["toolResult"],
    ["result"],
    ["output"],
    ["data"],
    ["payload"],
    ["tool_result", "content"],
    ["toolResult", "content"],
    ["result", "content"],
    ["payload", "content"],
  ]);
}

function toolInputCandidates(record) {
  return candidateObjects(record, [
    ["arguments"],
    ["args"],
    ["input"],
    ["params"],
    ["params", "arguments"],
    ["request", "arguments"],
    ["request", "args"],
    ["request", "input"],
    ["payload", "arguments"],
    ["payload", "args"],
    ["payload", "input"],
    ["payload", "params"],
  ]);
}

function valueIsError(value) {
  return value === true || value === "true" || value === "error" || value === "failed";
}

function toolCallSucceeded(record, output) {
  if (explicitSuccess(record) || explicitSuccess(output)) {
    return true;
  }
  const isError = firstValue(record, [
    ["isError"],
    ["is_error"],
    ["tool_result", "isError"],
    ["toolResult", "isError"],
    ["result", "isError"],
    ["payload", "isError"],
  ]);
  if (valueIsError(isError)) {
    return false;
  }
  return Boolean(output);
}

function stableJson(value) {
  if (value === undefined) {
    return undefined;
  }
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableJson(entry)).join(",")}]`;
  }
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
}

function sameBinding(left, right) {
  if (left === undefined || right === undefined) {
    return left === right;
  }
  return stableJson(left) === stableJson(right);
}

function versionsFromRecord(record) {
  const object = firstValue(record, [
    ["versions"],
    ["payload", "versions"],
    ["result", "versions"],
    ["run", "versions"],
  ]);
  if (object && typeof object === "object" && !Array.isArray(object)) {
    return object;
  }
  const versionFields = {
    rulesetVersion: rulesetVersionFromRecord(record),
    catalogVersion: catalogVersionFromRecord(record),
    codeVersion: codeVersionFromRecord(record),
    scenarioMatrixVersion: scenarioMatrixVersionFromRecord(record),
  };
  const present = Object.fromEntries(Object.entries(versionFields).filter(([, value]) => value !== undefined));
  return Object.keys(present).length > 0 ? present : undefined;
}

function bindingFromRecord(record) {
  return firstValue(record, [
    ["startJourneyBinding"],
    ["start_journey_binding"],
    ["binding"],
    ["runBinding"],
    ["run_binding"],
    ["runReceipt"],
    ["run_receipt"],
    ["receipt"],
    ["payload", "binding"],
    ["payload", "startJourneyBinding"],
    ["payload", "runReceipt"],
    ["payload", "run_receipt"],
    ["result", "binding"],
    ["result", "runReceipt"],
  ]);
}

function containsServerIssuedMetadataOverride(record, path = "metadata") {
  if (isCanonicalCdeRecord(record)) {
    return containsServerIssuedMetadataOverride({ input: record.input, payload: { input: record.input } }, "input.metadata");
  }
  const metadata = firstValue(record, [
    ["metadata"],
    ["meta"],
    ["arguments", "metadata"],
    ["arguments", "meta"],
    ["args", "metadata"],
    ["args", "meta"],
    ["input", "metadata"],
    ["input", "meta"],
    ["request", "arguments", "metadata"],
    ["request", "arguments", "meta"],
    ["request", "input", "metadata"],
    ["request", "input", "meta"],
    ["payload", "metadata"],
    ["payload", "meta"],
    ["payload", "arguments", "metadata"],
    ["payload", "arguments", "meta"],
    ["payload", "input", "metadata"],
    ["payload", "input", "meta"],
  ]);
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return [];
  }
  const paths = [];
  const walk = (value, currentPath) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return;
    }
    for (const [key, entry] of Object.entries(value)) {
      const nextPath = `${currentPath}.${key}`;
      if (SERVER_ISSUED_START_FIELDS.includes(key)) {
        paths.push(nextPath);
      }
      walk(entry, nextPath);
    }
  };
  walk(metadata, path);
  return paths;
}

function isFormalJourney(record) {
  const name = eventName(record);
  return /journey/i.test(name) && /(formal|official|complete|completed|finish|finished|result|settled|journey_run)/i.test(name)
    || hasTruthyPath(record, [["formalJourney"], ["journey", "formal"], ["journey", "completed"], ["payload", "formalJourney"]]);
}

function isPanelSnapshot(record, position) {
  const name = eventName(record);
  const positionPattern = position === "before" ? /before|pre/i : /after|post/i;
  return (/player[_ -]?panel|panel[_ -]?snapshot|causalPlayerPanel/i.test(name) && positionPattern.test(name))
    || hasTruthyPath(record, position === "before"
      ? [["playerPanelBefore"], ["beforePlayerPanel"], ["panelBefore"], ["snapshots", "playerPanelBefore"], ["payload", "playerPanelBefore"]]
      : [["playerPanelAfter"], ["afterPlayerPanel"], ["panelAfter"], ["snapshots", "playerPanelAfter"], ["payload", "playerPanelAfter"]]);
}

function hasResultPage(record) {
  const name = eventName(record);
  return /result[_ -]?page/i.test(name) && /(formal|official|published|created|ready|complete|completed)/i.test(name)
    || hasTruthyPath(record, [["resultPage"], ["result_page"], ["formalResultPage"], ["payload", "resultPage"], ["payload", "result_page"]]);
}

function hasRunReceipt(record) {
  const name = eventName(record);
  return /run[_ -]?receipt|RunReceipt/i.test(name)
    || hasTruthyPath(record, [["RunReceipt"], ["runReceipt"], ["run_receipt"], ["receipt", "RunReceipt"], ["payload", "RunReceipt"], ["payload", "runReceipt"]]);
}

function runReceiptObjectFromRecord(record) {
  return firstValue(record, [
    ["receipt"],
    ["RunReceipt"],
    ["runReceipt"],
    ["run_receipt"],
    ["receipt", "RunReceipt"],
    ["receipt", "runReceipt"],
    ["payload", "RunReceipt"],
    ["payload", "runReceipt"],
    ["payload", "run_receipt"],
    ["payload", "receipt"],
    ["result", "RunReceipt"],
    ["result", "runReceipt"],
    ["result", "run_receipt"],
    ["result", "receipt"],
    ["output", "receipt"],
    ["data", "RunReceipt"],
    ["data", "runReceipt"],
  ]);
}

function receiptSchemaFrom(receipt) {
  return stringifyId(firstValue(receipt, [
    ["version"],
    ["schemaVersion"],
    ["schema_version"],
    ["schema"],
    ["type"],
    ["kind"],
    ["receiptType"],
    ["receipt_type"],
  ]));
}

function nonEmptyValue(value) {
  if (value === undefined || value === null || value === "") {
    return false;
  }
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  if (typeof value === "object") {
    return Object.keys(value).length > 0;
  }
  return true;
}

function fieldValue(receipt, paths) {
  const value = firstValue(receipt, paths);
  return nonEmptyValue(value) ? value : undefined;
}

function validateReceiptField(errors, receipt, field, paths) {
  const value = fieldValue(receipt, paths);
  if (value === undefined) {
    errors.push(field);
  }
  return value;
}

function validateRunReceiptV2(receipt, run) {
  const errors = [];
  if (!receipt || typeof receipt !== "object" || Array.isArray(receipt)) {
    return { valid: false, errors: ["receipt"] };
  }

  const schema = receiptSchemaFrom(receipt);
  if (schema !== RUN_RECEIPT_V2_SCHEMA) {
    errors.push("schema");
  }

  const experimentId = stringifyId(validateReceiptField(errors, receipt, "experimentId", [
    ["experimentId"],
    ["experiment_id"],
    ["run", "experimentId"],
  ]));
  const runIndex = runIndexFromRecord(receipt);
  if (runIndex === undefined) {
    errors.push("runIndex");
  } else if (runIndex !== run.runIndex) {
    errors.push("runIndex_match");
  }
  const seed = stringifyId(validateReceiptField(errors, receipt, "seed", [["seed"], ["runSeed"], ["run", "seed"]]));
  const rulesetVersion = stringifyId(validateReceiptField(errors, receipt, "rulesetVersion", [
    ["rulesetVersion"],
    ["ruleset_version"],
    ["versions", "rulesetVersion"],
    ["run", "rulesetVersion"],
  ]));
  const catalogVersion = stringifyId(validateReceiptField(errors, receipt, "catalogVersion", [
    ["catalogVersion"],
    ["catalog_version"],
    ["versions", "catalogVersion"],
    ["run", "catalogVersion"],
  ]));
  const codeVersion = stringifyId(validateReceiptField(errors, receipt, "codeVersion", [
    ["codeVersion"],
    ["code_version"],
    ["versions", "codeVersion"],
    ["run", "codeVersion"],
  ]));
  const scenarioMatrixVersion = stringifyId(validateReceiptField(errors, receipt, "scenarioMatrixVersion", [
    ["scenarioMatrixVersion"],
    ["scenario_matrix_version"],
    ["versions", "scenarioMatrixVersion"],
    ["run", "scenarioMatrixVersion"],
  ]));

  validateReceiptField(errors, receipt, "startedAt", [["startedAt"], ["started_at"], ["timing", "startedAt"]]);
  validateReceiptField(errors, receipt, "settledAt", [["settledAt"], ["settled_at"], ["timing", "settledAt"]]);
  validateReceiptField(errors, receipt, "worldTimeBefore", [["world", "worldTimeBefore"], ["worldTimeBefore"], ["world_time_before"], ["worldTime", "before"], ["before", "worldTime"]]);
  validateReceiptField(errors, receipt, "worldTimeAfter", [["world", "worldTimeAfter"], ["worldTimeAfter"], ["world_time_after"], ["worldTime", "after"], ["after", "worldTime"]]);
  validateReceiptField(errors, receipt, "before.body", [["snapshots", "before", "body"], ["before", "body"], ["beforeBody"]]);
  validateReceiptField(errors, receipt, "before.hash", [["snapshots", "before", "hash"], ["before", "hash"], ["beforeHash"]]);
  validateReceiptField(errors, receipt, "after.body", [["snapshots", "after", "body"], ["after", "body"], ["afterBody"]]);
  validateReceiptField(errors, receipt, "after.hash", [["snapshots", "after", "hash"], ["after", "hash"], ["afterHash"]]);
  validateReceiptField(errors, receipt, "outcome", [["outcome"], ["result", "outcome"]]);
  const integrity = validateReceiptField(errors, receipt, "integrity", [["integrity"]]);
  if (!integrity || typeof integrity !== "object" || Array.isArray(integrity)) {
    errors.push("integrity_object");
  } else {
    validateReceiptField(errors, integrity, "integrity.eventIdsHash", [["eventIdsHash"], ["event_ids_hash"]]);
    validateReceiptField(errors, integrity, "integrity.payloadHash", [["payloadHash"], ["payload_hash"]]);
  }
  const receiptEventIds = fieldValue(receipt, [["eventIds"], ["event_ids"]]);
  const flattenedReceiptEventIds = receiptEventIds && typeof receiptEventIds === "object" && !Array.isArray(receiptEventIds)
    ? ["source", "settlement", "derived"].flatMap((key) => Array.isArray(receiptEventIds[key]) ? receiptEventIds[key] : [])
    : Array.isArray(receiptEventIds) ? receiptEventIds : [];
  if (flattenedReceiptEventIds.length < 1) {
    errors.push("eventIds");
  }

  const expectedValues = [
    ["experimentId", experimentId, run.experimentIds],
    ["seed", seed, run.seeds],
    ["rulesetVersion", rulesetVersion, run.rulesetVersions],
    ["catalogVersion", catalogVersion, run.catalogVersions],
    ["codeVersion", codeVersion, run.codeVersions],
    ["scenarioMatrixVersion", scenarioMatrixVersion, run.scenarioMatrixVersions],
  ];
  for (const [field, value, expectedSet] of expectedValues) {
    if (value !== undefined && expectedSet.size === 1 && !expectedSet.has(value)) {
      errors.push(`${field}_match`);
    }
  }

  return { valid: errors.length === 0, errors };
}

function hasResultReceipt(record) {
  const name = eventName(record);
  return /result[_ -]?receipt|ResultReceipt/i.test(name)
    || hasTruthyPath(record, [["ResultReceipt"], ["resultReceipt"], ["result_receipt"], ["receipt", "ResultReceipt"], ["payload", "ResultReceipt"], ["payload", "resultReceipt"], ["result", "receipt"], ["output", "result", "receipt"]]);
}

function receiptRunIndexesFromRecord(record, paths) {
  const indexes = [];
  for (const path of paths) {
    const value = getPath(record, path);
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      continue;
    }
    const runIndex = runIndexFromRecord(value);
    if (runIndex) {
      indexes.push(runIndex);
    }
  }
  return indexes;
}

function runReceiptRunIndexesFromRecord(record) {
  return receiptRunIndexesFromRecord(record, [
    ["RunReceipt"],
    ["runReceipt"],
    ["run_receipt"],
    ["receipt", "RunReceipt"],
    ["payload", "RunReceipt"],
    ["payload", "runReceipt"],
  ]);
}

function resultReceiptRunIndexesFromRecord(record) {
  return receiptRunIndexesFromRecord(record, [
    ["ResultReceipt"],
    ["resultReceipt"],
    ["result_receipt"],
    ["receipt", "ResultReceipt"],
    ["payload", "ResultReceipt"],
    ["payload", "resultReceipt"],
    ["result", "receipt"],
    ["output", "result", "receipt"],
  ]);
}

function isCompleteRecord(record) {
  const name = eventName(record);
  const state = stringifyId(firstValue(record, [
    ["state"],
    ["status"],
    ["experiment", "state"],
    ["run", "state"],
    ["payload", "state"],
    ["payload", "status"],
    ["payload", "run", "state"],
  ]));
  return state === "complete" || state === "completed"
    || /(?:^|[_ -])complete(?:d)?(?:$|[_ -])|settled|settlement_complete/i.test(name)
    || hasResultReceipt(record);
}

function isMutationRecord(record) {
  const name = eventName(record);
  const action = stringifyId(firstValue(record, [
    ["action"],
    ["operation"],
    ["op"],
    ["mutation"],
    ["mutationType"],
    ["mutation_type"],
    ["payload", "action"],
    ["payload", "operation"],
    ["payload", "op"],
    ["payload", "mutation"],
    ["payload", "mutationType"],
  ]));
  return /create|register|registerRun|fail|complete|settle|update|patch|mutat|write|receipt|result/i.test(name)
    || /create|register|registerRun|fail|complete|settle|update|patch|mutat|write/i.test(action || "")
    || hasRunReceipt(record)
    || hasResultReceipt(record);
}

function eventIdsFrom(record) {
  const value = firstValue(record, [
    ["eventIds"],
    ["event_ids"],
    ["sourceEventIds"],
    ["source_event_ids"],
    ["causalParentEventIds"],
    ["event", "eventIds"],
    ["result", "eventIds"],
    ["RunReceipt", "eventIds"],
    ["runReceipt", "eventIds"],
    ["receipt", "eventIds"],
    ["output", "receipt", "eventIds"],
    ["result", "receipt", "canonicalEventIds"],
    ["payload", "eventIds"],
    ["payload", "sourceEventIds"],
    ["payload", "RunReceipt", "eventIds"],
    ["payload", "runReceipt", "eventIds"],
  ]);
  if (Array.isArray(value)) {
    return value.map(String).filter(Boolean);
  }
  if (value && typeof value === "object") {
    return ["source", "settlement", "derived"]
      .flatMap((key) => Array.isArray(value[key]) ? value[key] : [])
      .map(String)
      .filter(Boolean);
  }
  if (typeof value === "string" && value.trim()) {
    return [value.trim()];
  }
  return [];
}

function resourceConservationStatus(record) {
  const explicit = firstValue(record, [
    ["resourceConservation"],
    ["resource_conservation"],
    ["resources", "conservation"],
    ["resourceLedger", "conservation"],
    ["resourceLedger", "conserved"],
    ["payload", "resourceConservation"],
    ["payload", "resources", "conservation"],
    ["result", "sections", "settlement", "economyConservation"],
    ["output", "result", "sections", "settlement", "economyConservation"],
  ]);
  if (explicit === true || explicit === "passed" || explicit === "pass" || explicit === "ok" || explicit === "conserved") {
    return { observed: true, passed: true };
  }
  if (explicit === false || explicit === "failed" || explicit === "fail" || explicit === "broken") {
    return { observed: true, passed: false };
  }
  if (explicit && typeof explicit === "object") {
    const passed = explicit.passed ?? explicit.pass ?? explicit.ok ?? explicit.conserved ?? explicit.balanced;
    if (passed !== undefined) {
      return { observed: true, passed: passed === true || passed === "true" || passed === "passed" || passed === "ok" };
    }
  }

  const before = firstValue(record, [["resourcesBefore"], ["resourceBefore"], ["before", "resources"], ["payload", "resourcesBefore"]]);
  const after = firstValue(record, [["resourcesAfter"], ["resourceAfter"], ["after", "resources"], ["payload", "resourcesAfter"]]);
  const delta = firstValue(record, [["resourceDelta"], ["resourcesDelta"], ["delta", "resources"], ["payload", "resourceDelta"]]);
  if (before && after && delta && typeof before === "object" && typeof after === "object" && typeof delta === "object") {
    const keys = new Set([...Object.keys(before), ...Object.keys(after), ...Object.keys(delta)]);
    const passed = [...keys].every((key) => Number(before[key] || 0) + Number(delta[key] || 0) === Number(after[key] || 0));
    return { observed: true, passed };
  }
  return { observed: false, passed: false };
}

function hasWorldDeltaOrNoChange(record) {
  const delta = firstValue(record, [
    ["ragDelta"],
    ["rag_delta"],
    ["worldDelta"],
    ["world_delta"],
    ["knowledgeDelta"],
    ["world", "delta"],
    ["rag", "delta"],
    ["payload", "ragDelta"],
    ["payload", "worldDelta"],
    ["result", "sections", "world", "changes"],
    ["result", "sections", "rag", "changes"],
    ["output", "result", "sections", "world", "changes"],
    ["output", "result", "sections", "rag", "changes"],
  ]);
  const reason = firstValue(record, [
    ["noChangeReason"],
    ["no_change_reason"],
    ["worldNoChangeReason"],
    ["ragNoChangeReason"],
    ["payload", "noChangeReason"],
    ["result", "sections", "world", "noChangeReason"],
    ["result", "sections", "rag", "noChangeReason"],
    ["output", "result", "sections", "world", "noChangeReason"],
    ["output", "result", "sections", "rag", "noChangeReason"],
  ]);
  if (typeof reason === "string" && reason.trim()) {
    return true;
  }
  if (Array.isArray(delta)) {
    return delta.length > 0;
  }
  if (delta && typeof delta === "object") {
    return Object.keys(delta).length > 0;
  }
  return Boolean(delta);
}

function scoreBreakdown(record) {
  const value = firstValue(record, [
    ["score"],
    ["score", "breakdown"],
    ["scoreBreakdown"],
    ["breakdown"],
    ["scoring", "breakdown"],
    ["result", "score", "breakdown"],
    ["payload", "score", "breakdown"],
    ["payload", "scoreBreakdown"],
    ["payload", "breakdown"],
    ["receipt", "score"],
    ["runReceipt", "score"],
    ["output", "receipt", "score"],
  ]);
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  const numeric = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === "number" && Number.isFinite(entry)) {
      numeric[key] = entry;
    } else if (entry && typeof entry === "object" && typeof entry.score === "number" && Number.isFinite(entry.score)) {
      numeric[key] = entry.score;
    } else if (entry && typeof entry === "object" && typeof entry.value === "number" && Number.isFinite(entry.value)) {
      numeric[key] = entry.value;
    }
  }
  return Object.keys(numeric).length > 0 ? numeric : undefined;
}

function createRun(index) {
  return {
    runIndex: index,
    records: 0,
    formalJourney: 0,
    playerPanelBefore: 0,
    playerPanelAfter: 0,
    playerPanelToolCalls: 0,
    resultPage: 0,
    runReceipt: 0,
    resultReceipt: 0,
    eventIds: new Set(),
    experimentIds: new Set(),
    explorerIds: new Set(),
    identityIds: new Set(),
    scenarioMatrixVersions: new Set(),
    scenarioTags: new Set(),
    rulesetVersions: new Set(),
    catalogVersions: new Set(),
    codeVersions: new Set(),
    seeds: new Set(),
    runReceiptSuccessRecords: 0,
    runReceiptV2ValidRecords: 0,
    runReceiptV1Records: 0,
    runReceiptV2Errors: [],
    phase6ResultSuccessRecords: 0,
    phase6ResultVerifiedRecords: 0,
    beginPhase6RunSuccessRecords: 0,
    beginPhase6RunPositions: [],
    startJourneySuccessRecords: 0,
    serverIssuedStartMatches: 0,
    startJourneyMetadataOverridePaths: [],
    phase6ExperimentStatusSuccessRecords: 0,
    phase6ExperimentStatusReceiptMatches: 0,
    phase6ExperimentStatusRunStates: new Set(),
    settledStatusPositions: [],
    journeyStatusSettlements: [],
    runReceiptRunIndexMismatches: 0,
    resultReceiptRunIndexMismatches: 0,
    resourceConservationObserved: false,
    resourceConservationPassed: false,
    ragOrWorldDeltaOrNoChange: false,
    scoreBreakdowns: [],
    receiptV2Proofs: [],
    verifiedResults: [],
    beforePanelSnapshots: [],
    afterPanelSnapshots: [],
    explicitNoChangeReasons: new Set(),
  };
}

function summarizeRun(run) {
  return {
    runIndex: run.runIndex,
    records: run.records,
    formalJourney: run.formalJourney,
    playerPanelBefore: run.playerPanelBefore,
    playerPanelAfter: run.playerPanelAfter,
    playerPanelToolCalls: run.playerPanelToolCalls,
    scenarioTags: [...run.scenarioTags].sort(),
    resultPage: run.resultPage,
    runReceipt: run.runReceipt,
    resultReceipt: run.resultReceipt,
    runReceiptSuccessRecords: run.runReceiptSuccessRecords,
    runReceiptV2ValidRecords: run.runReceiptV2ValidRecords,
    phase6ResultSuccessRecords: run.phase6ResultSuccessRecords,
    phase6ResultVerifiedRecords: run.phase6ResultVerifiedRecords,
    beginPhase6RunSuccessRecords: run.beginPhase6RunSuccessRecords,
    startJourneySuccessRecords: run.startJourneySuccessRecords,
    serverIssuedStartMatches: run.serverIssuedStartMatches,
    startJourneyMetadataOverridePaths: run.startJourneyMetadataOverridePaths.length,
    phase6ExperimentStatusSuccessRecords: run.phase6ExperimentStatusSuccessRecords,
    phase6ExperimentStatusReceiptMatches: run.phase6ExperimentStatusReceiptMatches,
    phase6ExperimentStatusRunStates: [...run.phase6ExperimentStatusRunStates].sort(),
    eventIds: run.eventIds.size,
    explorerIds: run.explorerIds.size,
    seeds: run.seeds.size,
    settledStatusProofs: run.settledStatusPositions.length,
    journeyStatusSettlements: run.journeyStatusSettlements.length,
    receiptV2Proofs: run.receiptV2Proofs.length,
    verifiedResultProofs: run.verifiedResults.length,
    resourceConservationObserved: run.resourceConservationObserved,
    resourceConservationPassed: run.resourceConservationPassed,
    ragOrWorldDeltaOrNoChange: run.ragOrWorldDeltaOrNoChange,
    scoreBreakdowns: run.scoreBreakdowns.length,
    explicitNoChangeReasons: [...run.explicitNoChangeReasons].sort(),
  };
}

function validateScoreBreakdowns(runs, failures, forbidden) {
  const missingRuns = runs.filter((run) => run.scoreBreakdowns.length < 1).map((run) => run.runIndex);
  if (missingRuns.length > 0) {
    failures.push({
      gate: "score_breakdown_present",
      expected: ">=1 per run",
      actual: `${missingRuns.length} missing runs`,
      runIndexes: missingRuns,
      message: "each run must expose scoring subitems",
    });
    return;
  }

  const allBreakdowns = runs.map((run) => ({
    runIndex: run.runIndex,
    breakdown: run.scoreBreakdowns.at(-1),
  }));
  const keys = new Set(allBreakdowns.flatMap((entry) => Object.keys(entry.breakdown)));
  if (keys.size < 2) {
    failures.push({
      gate: "score_breakdown_components",
      expected: "at least 2 numeric components",
      actual: keys.size,
      message: "scoring must include real subcomponents, not a single fallback value",
    });
  }

  const componentVariances = [...keys].map((key) => new Set(allBreakdowns.map((entry) => entry.breakdown[key]).filter((value) => value !== undefined)).size);
  if (!componentVariances.some((size) => size > 1)) {
    failures.push({
      gate: "score_breakdown_not_fixed",
      expected: "at least one component varies across ten runs",
      actual: "all observed components fixed",
      message: "scoring subitems look like fixed fallback values",
    });
  }

  if (forbidden.fixedFallbackScorePaths.size > 0) {
    failures.push({
      gate: "score_breakdown_no_fallback_marker",
      expected: 0,
      actual: forbidden.fixedFallbackScorePaths.size,
      paths: [...forbidden.fixedFallbackScorePaths].slice(0, 20),
      message: "input contains fallback-score markers",
    });
  }
}

function failIfValueSetInvalid(failures, gate, expected, values, message) {
  if (values.size !== 1) {
    failures.push({
      gate,
      expected,
      actual: values.size,
      values: [...values].slice(0, 20),
      message,
    });
  }
}

function findToolOutputs(records, toolName, predicate) {
  const matches = [];
  for (const record of records) {
    if (toolNameFromRecord(record) !== toolName) {
      continue;
    }
    const output = toolPayloadCandidates(record).find(predicate);
    if (toolCallSucceeded(record, output)) {
      matches.push({ record, output });
    }
  }
  return matches;
}

function phase6ExperimentBeginOutputs(records) {
  return findToolOutputs(records, BEGIN_PHASE6_EXPERIMENT_TOOL_NAME, (candidate) => {
    return stringifyId(firstValue(candidate, [["experimentId"], ["experiment_id"]]))
      && stringifyId(firstValue(candidate, [["state"], ["status"]])) === "planned"
      && versionsFromRecord(candidate);
  });
}

function phase6RunBeginOutputs(records) {
  return findToolOutputs(records, BEGIN_PHASE6_RUN_TOOL_NAME, (candidate) => {
    return stringifyId(firstValue(candidate, [["experimentId"], ["experiment_id"]]))
      && runIndexFromRecord(candidate) !== undefined
      && stringifyId(firstValue(candidate, [["state"], ["status"]])) === "running"
      && seedFromRecord(candidate)
      && versionsFromRecord(candidate)
      && bindingFromRecord(candidate);
  });
}

function phase6StatusOutputs(records) {
  return findToolOutputs(records, PHASE6_EXPERIMENT_STATUS_TOOL_NAME, (candidate) => {
    return stringifyId(firstValue(candidate, [["experimentId"], ["experiment_id"]]))
      && Array.isArray(firstValue(candidate, [["runs"], ["status", "runs"], ["payload", "runs"]]));
  });
}

function startJourneyOutputs(records) {
  return records
    .filter((record) => toolNameFromRecord(record) === START_JOURNEY_TOOL_NAME)
    .filter((record) => toolCallSucceeded(record, record));
}

function issuedRunFromOutput(output) {
  return {
    experimentId: experimentIdFromRecord(output),
    runIndex: runIndexFromRecord(output),
    seed: seedFromRecord(output),
    versions: versionsFromRecord(output),
    binding: bindingFromRecord(output),
  };
}

function startJourneyIssuedFields(record) {
  const candidates = toolInputCandidates(record);
  const source = candidates.find((candidate) => (
    experimentIdFromRecord(candidate)
      || runIndexFromRecord(candidate)
      || seedFromRecord(candidate)
      || versionsFromRecord(candidate)
      || bindingFromRecord(candidate)
  )) || record;
  return {
    experimentId: experimentIdFromRecord(source),
    runIndex: runIndexFromRecord(source),
    seed: seedFromRecord(source),
    versions: versionsFromRecord(source),
    binding: bindingFromRecord(source),
  };
}

function statusRunViews(output) {
  const runs = firstValue(output, [["runs"], ["status", "runs"], ["payload", "runs"]]);
  return Array.isArray(runs) ? runs.filter((run) => run && typeof run === "object" && !Array.isArray(run)) : [];
}

function statusStateFromRunView(runView) {
  return stringifyId(firstValue(runView, [["state"], ["status"], ["run", "state"]]));
}

function statusReceiptFromRunView(runView) {
  return firstValue(runView, [
    ["receipt"],
    ["runReceipt"],
    ["run_receipt"],
    ["binding"],
    ["run", "receipt"],
    ["run", "runReceipt"],
  ]);
}

function addFailure(failures, gate, details = {}) {
  failures.push({ code: gate, gate, ...details });
}

function collectFailClosedFindings(value, path, findings) {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => collectFailClosedFindings(entry, `${path}[${index}]`, findings));
    return;
  }
  if (!value || typeof value !== "object") {
    return;
  }
  for (const [key, entry] of Object.entries(value)) {
    const nextPath = path ? `${path}.${key}` : key;
    const normalizedKey = key.replace(/[-_]/g, "").toLowerCase();
    if ((normalizedKey === "iserror" || normalizedKey === "toolerror") && valueIsError(entry)) {
      findings.push({ path: nextPath, reason: key });
    } else if (normalizedKey === "ok" && entry === false) {
      findings.push({ path: nextPath, reason: "ok_false" });
    } else if (normalizedKey === "toolerror" && nonEmptyValue(entry)) {
      findings.push({ path: nextPath, reason: "toolError" });
    } else if (/^(unauthorized|unauthorizedtool|unauthorizedtoolname|unauthorizedtoolnames|nonmcptool|nonmcptools|nonmcp|notmcp|mcpunauthorized)$/.test(normalizedKey) && nonEmptyValue(entry) && entry !== false) {
      findings.push({ path: nextPath, reason: key });
    }
    collectFailClosedFindings(entry, nextPath, findings);
  }
}

function collectCompactToolFindings(records) {
  const findings = [];
  records.forEach((record, index) => {
    const toolName = toolNameFromRecord(record);
    if (!COMPACT_ONLY_TOOL_NAMES.has(toolName)) {
      return;
    }
    if (!hasExplicitSourceToolName(record)) {
      findings.push({
        index,
        toolName,
        sourceToolName: null,
      });
      return;
    }
    for (const sourceToolName of sourceToolNamesFromRecord(record)) {
      if (!/_compact$/i.test(sourceToolName)) {
        findings.push({
          index,
          toolName,
          sourceToolName,
        });
      }
    }
  });
  return findings;
}

function normalizeFailures(failures) {
  return failures.map((failure) => ({
    code: failure.code || failure.gate || "unknown_gate",
    ...failure,
  }));
}

function receiptIdFrom(value) {
  return stringifyId(firstValue(value, [
    ["receiptId"],
    ["receipt_id"],
    ["publicId"],
    ["public_id"],
    ["id"],
    ["receipt", "receiptId"],
    ["runReceipt", "receiptId"],
    ["run_receipt", "receiptId"],
    ["phase6Settlement", "receiptId"],
    ["phase6Settlement", "receipt", "receiptId"],
    ["resultPage", "receiptId"],
    ["page", "receiptId"],
    ["payload", "receiptId"],
    ["result", "receiptId"],
    ["result", "receipt", "receiptId"],
  ]));
}

function pageIdFrom(value) {
  return stringifyId(firstValue(value, [
    ["pageId"],
    ["page_id"],
    ["resultPageId"],
    ["result_page_id"],
    ["id"],
    ["page", "pageId"],
    ["resultPage", "pageId"],
    ["phase6Settlement", "pageId"],
    ["phase6Settlement", "resultPage", "pageId"],
    ["finalVerification", "pageId"],
    ["finalVerification", "page", "pageId"],
    ["payload", "pageId"],
    ["result", "pageId"],
  ]));
}

function phase6SettlementFromRecord(record) {
  return firstValue(record, [
    ["phase6Settlement"],
    ["phase6_settlement"],
    ["payload", "phase6Settlement"],
    ["result", "phase6Settlement"],
    ["output", "phase6Settlement"],
    ["data", "phase6Settlement"],
  ]);
}

function isJourneyStatusToolRecord(record) {
  return toolNameFromRecord(record) === JOURNEY_STATUS_TOOL_NAME || /journey[_ -]?status/i.test(eventName(record));
}

function isSettledPhase6Settlement(settlement) {
  return settlement && typeof settlement === "object" && !Array.isArray(settlement)
    && firstValue(settlement, [["ok"]]) === true
    && stringifyId(firstValue(settlement, [["status"], ["state"]])) === "settled"
    && nonEmptyValue(receiptIdFrom(settlement))
    && nonEmptyValue(pageIdFrom(settlement));
}

function resultIdsFromRecord(record) {
  const candidates = toolPayloadCandidates(record);
  const source = candidates.find((candidate) => pageIdFrom(candidate) || receiptIdFrom(candidate)) || record;
  return {
    pageId: pageIdFrom(source),
    receiptId: receiptIdFrom(source),
  };
}

function panelSnapshotObject(record, position) {
  const paths = position === "before"
    ? [
      ["playerPanelBefore"],
      ["beforePlayerPanel"],
      ["panelBefore"],
      ["beforePanel"],
      ["snapshots", "playerPanelBefore"],
      ["snapshots", "beforePanel"],
      ["payload", "playerPanelBefore"],
      ["payload", "beforePanel"],
      ["result", "playerPanelBefore"],
      ["result", "beforePanel"],
    ]
    : [
      ["playerPanelAfter"],
      ["afterPlayerPanel"],
      ["panelAfter"],
      ["afterPanel"],
      ["snapshots", "playerPanelAfter"],
      ["snapshots", "afterPanel"],
      ["payload", "playerPanelAfter"],
      ["payload", "afterPanel"],
      ["result", "playerPanelAfter"],
      ["result", "afterPanel"],
    ];
  const snapshot = firstValue(record, paths);
  return snapshot && typeof snapshot === "object" && !Array.isArray(snapshot) ? snapshot : undefined;
}

function objectsDiffer(before, after, pathGroups) {
  return pathGroups.some((paths) => {
    const beforeValue = firstValue(before, paths);
    const afterValue = firstValue(after, paths);
    return beforeValue !== undefined && afterValue !== undefined && !sameBinding(beforeValue, afterValue);
  });
}

function panelDiffProof(before, after) {
  const changedCategories = [];
  const categories = [
    ["resources", [[["wallet"]], [["economy"]], [["resources"]]]],
    ["progression", [[["progression"]], [["player", "progression"]]]],
    ["combat", [[["combat"]], [["readiness"]], [["combatReadiness"]]]],
    ["rag", [[["rag"]], [["ragPanel"]], [["player", "ragPanel"]]]],
    ["recentRuns", [[["recentRuns"]], [["runs"]], [["history"]]]],
  ];
  for (const [name, paths] of categories) {
    if (objectsDiffer(before, after, paths)) {
      changedCategories.push(name);
    }
  }
  const skillTalentChanged = objectsDiffer(before, after, [
    [["progression", "skillTree"]],
    [["progression", "skills"]],
    [["skills"]],
    [["progression", "talents"]],
    [["talents"]],
    [["player", "progression", "skillTree"]],
    [["player", "progression", "talents"]],
  ]);
  const strengthChanged = objectsDiffer(before, after, [
    [["combat", "dimensions", "strength"]],
    [["readiness", "dimensions", "strength"]],
    [["combatReadiness", "dimensions", "strength"]],
    [["attributes", "strength"]],
    [["progression", "attributeEvidenceXp", "strength"]],
    [["strength"]],
  ]);
  const intensityChanged = objectsDiffer(before, after, [
    [["recentRuns", "runs", 0, "intensity", "encounterIntensity"]],
    [["recentRuns", "runs", 0, "intensity"]],
    [["intensity", "encounterIntensity"]],
    [["encounterIntensity"]],
  ]);
  return {
    changedCategories,
    skillTalentChanged,
    strengthChanged,
    intensityChanged,
    anyChanged: !sameBinding(before, after),
  };
}

function explicitNoChangeReasonsFrom(record) {
  const reasons = [];
  const seen = new WeakSet();
  const walk = (value, path = [], depth = 0) => {
    if (!value || typeof value !== "object" || depth > 12 || seen.has(value)) return;
    seen.add(value);
    for (const [key, entry] of Object.entries(value)) {
      const nextPath = [...path, key];
      const normalized = key.replace(/[-_]/g, "").toLowerCase();
      const directReason = /^(?:stablereason|nochangereason|nogrowthreason|nodeltareason)$/.test(normalized);
      const contextualReason = normalized === "reason" && (
        value.changed === false
        || value.changed === 0
        || value.count === 0
        || /(?:progression|rag|delta|changeset)/i.test(path.join("."))
      );
      if ((directReason || contextualReason) && typeof entry === "string" && entry.trim()) {
        reasons.push(`${nextPath.join(".")}:${entry.trim()}`);
      }
      walk(entry, nextPath, depth + 1);
    }
  };
  walk(record);
  return reasons;
}

function validate(options, input) {
  const parsed = parseRecords(input);
  const { records, metadataConflicts } = normalizeCanonicalRecords(parsed.records);
  const { parseErrors } = parsed;
  const forbidden = {
    secretPaths: new Set(),
    internalErrorPaths: new Set(),
    legacyToolPaths: new Set(),
    fixedFallbackScorePaths: new Set(),
  };
  const failClosedFindings = [];

  records.forEach((record, index) => {
    inspectForForbidden(record, `records[${index}]`, forbidden);
    collectFailClosedFindings(record, `records[${index}]`, failClosedFindings);
  });
  const compactToolFindings = collectCompactToolFindings(records);

  const beginExperimentOutputs = phase6ExperimentBeginOutputs(records);
  const beginRunOutputs = phase6RunBeginOutputs(records);
  const statusOutputs = phase6StatusOutputs(records);
  const startJourneyRecords = startJourneyOutputs(records);
  const issuedExperimentIds = new Set(beginExperimentOutputs.map(({ output }) => experimentIdFromRecord(output)).filter(Boolean));
  const experimentCounts = new Map();
  for (const record of records) {
    const id = experimentIdFromRecord(record);
    if (id) {
      experimentCounts.set(id, (experimentCounts.get(id) || 0) + 1);
    }
  }
  const selectedExperimentId = options.experimentId
    || (issuedExperimentIds.size === 1 ? [...issuedExperimentIds][0] : undefined)
    || [...experimentCounts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0];
  const issuedRunsByIndex = new Map();
  for (const { output } of beginRunOutputs) {
    const issued = issuedRunFromOutput(output);
    if (issued.runIndex !== undefined) {
      issuedRunsByIndex.set(issued.runIndex, issued);
    }
  }

  const runsByIndex = new Map();
  let ungroupedRecords = 0;
  const invalidRunIndexes = new Set();
  const mutationAfterComplete = [];
  const completedRunIndexes = new Set();
  let experimentCompleteSeen = false;
  for (const [recordPosition, record] of records.entries()) {
    const experimentId = experimentIdFromRecord(record);
    if (selectedExperimentId && experimentId && experimentId !== selectedExperimentId) {
      continue;
    }
    const runIndex = runIndexFromRecord(record);
    if (!runIndex) {
      ungroupedRecords += 1;
      continue;
    }
    if (runIndex < 1 || runIndex > REQUIRED_RUNS) {
      invalidRunIndexes.add(runIndex);
      continue;
    }
    if ((experimentCompleteSeen || completedRunIndexes.has(runIndex)) && isMutationRecord(record)) {
      mutationAfterComplete.push({ runIndex, event: eventName(record) || null });
    }
    if (!runsByIndex.has(runIndex)) {
      runsByIndex.set(runIndex, createRun(runIndex));
    }
    const run = runsByIndex.get(runIndex);
    run.records += 1;
    const identityId = identityIdFromRecord(record);
    const explorerId = explorerIdFromRecord(record);
    const scenarioMatrixVersion = scenarioMatrixVersionFromRecord(record);
    const scenarioTag = scenarioTagFromRecord(record);
    const rulesetVersion = rulesetVersionFromRecord(record);
    const catalogVersion = catalogVersionFromRecord(record);
    const codeVersion = codeVersionFromRecord(record);
    const seed = seedFromRecord(record);
    if (experimentId) {
      run.experimentIds.add(experimentId);
    }
    if (identityId) {
      run.identityIds.add(identityId);
    }
    if (explorerId) {
      run.explorerIds.add(explorerId);
    }
    if (scenarioMatrixVersion) {
      run.scenarioMatrixVersions.add(scenarioMatrixVersion);
    }
    if (scenarioTag) {
      run.scenarioTags.add(scenarioTag);
    }
    if (rulesetVersion) {
      run.rulesetVersions.add(rulesetVersion);
    }
    if (catalogVersion) {
      run.catalogVersions.add(catalogVersion);
    }
    if (codeVersion) {
      run.codeVersions.add(codeVersion);
    }
    if (seed) {
      run.seeds.add(seed);
    }
    if (isFormalJourney(record)) {
      run.formalJourney += 1;
    }
    if (isPanelSnapshot(record, "before")) {
      run.playerPanelBefore += 1;
    }
    if (isPanelSnapshot(record, "after")) {
      run.playerPanelAfter += 1;
    }
    if (isToolSuccessRecord(record, PLAYER_PANEL_TOOL_NAME)) {
      run.playerPanelToolCalls += 1;
    }
    if (hasResultPage(record)) {
      run.resultPage += 1;
    }
    if (hasRunReceipt(record)) {
      run.runReceipt += 1;
    }
    const receiptObject = runReceiptObjectFromRecord(record);
    const receiptSchema = receiptSchemaFrom(receiptObject);
    if (receiptSchema === "journey_run_receipt.v1") {
      run.runReceiptV1Records += 1;
    }
    if (isToolSuccessRecord(record, RUN_RECEIPT_TOOL_NAME)) {
      run.runReceiptSuccessRecords += 1;
      const receiptValidation = validateRunReceiptV2(receiptObject, run);
      if (receiptValidation.valid) {
        run.runReceiptV2ValidRecords += 1;
        run.receiptV2Proofs.push({
          position: recordPosition,
          receiptId: receiptIdFrom(receiptObject),
          pageId: pageIdFrom(receiptObject),
        });
      } else {
        run.runReceiptV2Errors.push(...receiptValidation.errors);
      }
    }
    if (isToolSuccessRecord(record, PHASE6_RESULT_TOOL_NAME)) {
      run.phase6ResultSuccessRecords += 1;
      if (explicitVerified(record)) {
        run.phase6ResultVerifiedRecords += 1;
        run.verifiedResults.push({
          position: recordPosition,
          ...resultIdsFromRecord(record),
        });
      }
    }
    if (isJourneyStatusToolRecord(record) && toolCallSucceeded(record, record)) {
      const settlement = phase6SettlementFromRecord(record);
      if (isSettledPhase6Settlement(settlement)) {
        const proof = {
          position: recordPosition,
          receiptId: receiptIdFrom(settlement),
          pageId: pageIdFrom(settlement),
        };
        run.settledStatusPositions.push(recordPosition);
        run.journeyStatusSettlements.push(proof);
      }
    }
    const beforePanel = panelSnapshotObject(record, "before");
    if (beforePanel) {
      run.beforePanelSnapshots.push(beforePanel);
    }
    const afterPanel = panelSnapshotObject(record, "after");
    if (afterPanel) {
      run.afterPanelSnapshots.push(afterPanel);
    }
    if (hasResultReceipt(record)) {
      run.resultReceipt += 1;
    }
    for (const receiptRunIndex of runReceiptRunIndexesFromRecord(record)) {
      if (receiptRunIndex !== runIndex) {
        run.runReceiptRunIndexMismatches += 1;
      }
    }
    for (const receiptRunIndex of resultReceiptRunIndexesFromRecord(record)) {
      if (receiptRunIndex !== runIndex) {
        run.resultReceiptRunIndexMismatches += 1;
      }
    }
    for (const eventId of eventIdsFrom(record)) {
      run.eventIds.add(eventId);
    }
    const conservation = resourceConservationStatus(record);
    if (conservation.observed) {
      run.resourceConservationObserved = true;
      run.resourceConservationPassed ||= conservation.passed;
    }
    run.ragOrWorldDeltaOrNoChange ||= hasWorldDeltaOrNoChange(record);
    const breakdown = scoreBreakdown(record);
    if (breakdown) {
      run.scoreBreakdowns.push(breakdown);
    }
    for (const reason of explicitNoChangeReasonsFrom(record)) {
      run.explicitNoChangeReasons.add(reason);
    }
    if (isCompleteRecord(record)) {
      completedRunIndexes.add(runIndex);
      if (!hasResultReceipt(record)) {
        experimentCompleteSeen = true;
      }
    }
  }

  const runs = [...runsByIndex.values()].sort((left, right) => left.runIndex - right.runIndex);
  const experimentIds = new Set(runs.flatMap((run) => [...run.experimentIds]));
  const explorerIds = new Set(runs.flatMap((run) => [...run.explorerIds]));
  const identityIds = new Set(runs.flatMap((run) => [...run.identityIds]));
  const scenarioMatrixVersions = new Set(runs.flatMap((run) => [...run.scenarioMatrixVersions]));
  const scenarioTags = new Set(runs.flatMap((run) => [...run.scenarioTags]));
  const rulesetVersions = new Set(runs.flatMap((run) => [...run.rulesetVersions]));
  const catalogVersions = new Set(runs.flatMap((run) => [...run.catalogVersions]));
  const codeVersions = new Set(runs.flatMap((run) => [...run.codeVersions]));
  const beginRunIndexes = beginRunOutputs
    .map(({ output }) => runIndexFromRecord(output))
    .filter((runIndex) => runIndex !== undefined);
  const beginRunIndexCounts = beginRunIndexes.reduce((counts, runIndex) => {
    counts.set(runIndex, (counts.get(runIndex) || 0) + 1);
    return counts;
  }, new Map());
  for (const runIndex of beginRunIndexes) {
    const run = runsByIndex.get(runIndex);
    if (run) {
      run.beginPhase6RunSuccessRecords += 1;
    }
  }
  for (const { record, output } of beginRunOutputs) {
    const runIndex = runIndexFromRecord(output);
    const run = runIndex ? runsByIndex.get(runIndex) : undefined;
    if (run) {
      run.beginPhase6RunPositions.push(records.indexOf(record));
    }
  }
  const startJourneyMismatches = [];
  const startJourneyMetadataOverrides = [];
  for (const record of startJourneyRecords) {
    const started = startJourneyIssuedFields(record);
    const run = started.runIndex ? runsByIndex.get(started.runIndex) : undefined;
    if (run) {
      run.startJourneySuccessRecords += 1;
      const overridePaths = containsServerIssuedMetadataOverride(record);
      if (overridePaths.length > 0) {
        run.startJourneyMetadataOverridePaths.push(...overridePaths);
        startJourneyMetadataOverrides.push({ runIndex: run.runIndex, paths: overridePaths.slice(0, 20) });
      }
      const issued = issuedRunsByIndex.get(run.runIndex);
      const mismatched = !issued
        || started.experimentId !== issued.experimentId
        || started.runIndex !== issued.runIndex
        || started.seed !== issued.seed
        || !sameBinding(started.versions, issued.versions)
        || !sameBinding(started.binding, issued.binding);
      if (mismatched) {
        startJourneyMismatches.push({
          runIndex: run.runIndex,
          fields: {
            experimentId: started.experimentId === issued?.experimentId,
            runIndex: started.runIndex === issued?.runIndex,
            seed: started.seed === issued?.seed,
            versions: sameBinding(started.versions, issued?.versions),
            binding: sameBinding(started.binding, issued?.binding),
          },
        });
      } else {
        run.serverIssuedStartMatches += 1;
      }
    } else {
      startJourneyMismatches.push({ runIndex: started.runIndex || null, fields: { runIndex: false } });
    }
  }
  const statusReceiptMismatches = [];
  for (const { output } of statusOutputs) {
    const experimentId = experimentIdFromRecord(output);
    if (selectedExperimentId && experimentId && experimentId !== selectedExperimentId) {
      continue;
    }
    for (const runView of statusRunViews(output)) {
      const runIndex = runIndexFromRecord(runView);
      if (!runIndex) {
        continue;
      }
      const run = runsByIndex.get(runIndex);
      if (!run) {
        continue;
      }
      run.phase6ExperimentStatusSuccessRecords += 1;
      const state = statusStateFromRunView(runView);
      if (state) {
        run.phase6ExperimentStatusRunStates.add(state);
      }
      const issued = issuedRunsByIndex.get(runIndex);
      const receipt = statusReceiptFromRunView(runView);
      if (issued && sameBinding(receipt, issued.binding)) {
        run.phase6ExperimentStatusReceiptMatches += 1;
      } else if (receipt !== undefined || /^(complete|completed)$/i.test(state || "")) {
        statusReceiptMismatches.push({ runIndex, state: state || null });
      }
    }
  }
  const failures = [];
  if (parseErrors.length > 0) {
    failures.push({
      gate: "parse_input",
      expected: 0,
      actual: parseErrors.length,
      malformedLines: parseErrors.slice(0, 30),
      message: "every non-empty input line must contain parseable JSON; raw lines are not echoed",
    });
  }
  if (forbidden.secretPaths.size > 0) {
    failures.push({
      gate: "no_secret_material",
      expected: 0,
      actual: forbidden.secretPaths.size,
      paths: [...forbidden.secretPaths].slice(0, 20),
      message: "input contains secret-looking keys or values; raw values are not echoed",
    });
  }
  if (forbidden.internalErrorPaths.size > 0) {
    failures.push({
      gate: "no_internal_error",
      expected: 0,
      actual: forbidden.internalErrorPaths.size,
      paths: [...forbidden.internalErrorPaths].slice(0, 20),
      message: "input contains internal_error markers",
    });
  }
  if (forbidden.legacyToolPaths.size > 0) {
    failures.push({
      gate: "no_legacy_tool",
      expected: 0,
      actual: forbidden.legacyToolPaths.size,
      paths: [...forbidden.legacyToolPaths].slice(0, 20),
      message: "input contains legacy tool markers",
    });
  }
  if (failClosedFindings.length > 0) {
    addFailure(failures, "phase6_fail_closed_error_markers", {
      expected: 0,
      actual: failClosedFindings.length,
      findings: failClosedFindings.slice(0, 30),
      message: "any isError=true, ok=false, toolError, unauthorized, or non-MCP marker fails the whole ten-run proof",
    });
  }
  if (compactToolFindings.length > 0) {
    addFailure(failures, "phase6_compact_only_source_tools", {
      expected: "sourceToolName/originalToolName end with _compact for compact-only normalized tools",
      actual: compactToolFindings.length,
      findings: compactToolFindings.slice(0, 30),
      message: "the six compact-only normalized tools must retain compact launcher source names",
    });
  }
  if (metadataConflicts.length > 0) {
    addFailure(failures, "phase6_canonical_metadata_conflict", {
      expected: "metadata agrees with canonical input/output when both expose the same server-issued field",
      actual: metadataConflicts.length,
      conflicts: metadataConflicts.slice(0, 30),
      message: "canonical extractor metadata may project input/output values but must not contradict them",
    });
  }
  if (beginExperimentOutputs.length !== 1) {
    addFailure(failures, "phase6_begin_experiment_once", {
      expected: "exactly one successful obsidian_epoch.begin_phase6_experiment",
      actual: beginExperimentOutputs.length,
      message: "Phase 6 experiment authority must be issued once by the server",
    });
  }
  if (issuedExperimentIds.size !== 1) {
    addFailure(failures, "phase6_begin_experiment_id_unique", {
      expected: "one issued experimentId",
      actual: issuedExperimentIds.size,
      values: [...issuedExperimentIds].slice(0, 20),
      message: "successful begin_phase6_experiment records must bind one experimentId",
    });
  }
  if (beginRunOutputs.length !== REQUIRED_RUNS) {
    addFailure(failures, "phase6_begin_run_success_count", {
      expected: REQUIRED_RUNS,
      actual: beginRunOutputs.length,
      message: "Phase 6 requires exactly ten successful begin_phase6_run records",
    });
  }
  const missingBeginRunIndexes = Array.from({ length: REQUIRED_RUNS }, (_, index) => index + 1)
    .filter((runIndex) => !beginRunIndexCounts.has(runIndex));
  const duplicateBeginRunIndexes = [...beginRunIndexCounts.entries()]
    .filter(([, count]) => count !== 1)
    .map(([runIndex, count]) => ({ runIndex, count }));
  if (missingBeginRunIndexes.length > 0 || duplicateBeginRunIndexes.length > 0) {
    addFailure(failures, "phase6_begin_run_exact_coverage", {
      expected: "one successful begin_phase6_run for each runIndex 1..10",
      actual: beginRunIndexes,
      missingRunIndexes: missingBeginRunIndexes,
      duplicateRunIndexes: duplicateBeginRunIndexes,
      message: "server-issued begin_phase6_run records must cover runIndex 1 through 10 exactly once",
    });
  }
  const beginRunSequence = beginRunOutputs.map(({ record, output }) => ({
    runIndex: runIndexFromRecord(output),
    position: records.indexOf(record),
    timestamp: timestampMillisFromRecord(record),
  })).sort((left, right) => left.position - right.position);
  const beginRunSequenceIndexes = beginRunSequence.map((entry) => entry.runIndex);
  if (beginRunSequenceIndexes.length === REQUIRED_RUNS
    && beginRunSequenceIndexes.some((runIndex, index) => runIndex !== index + 1)) {
    addFailure(failures, "phase6_begin_run_order_strict", {
      expected: "successful begin_phase6_run records appear as runIndex 1..10",
      actual: beginRunSequenceIndexes,
      message: "begin run records must be strictly ordered by runIndex",
    });
  }
  const missingBeginTimestamps = beginRunSequence.filter((entry) => entry.timestamp === undefined);
  const nonIncreasingBeginTimestamps = [];
  for (let index = 1; index < beginRunSequence.length; index += 1) {
    const previous = beginRunSequence[index - 1];
    const current = beginRunSequence[index];
    if (previous.timestamp !== undefined && current.timestamp !== undefined && current.timestamp <= previous.timestamp) {
      nonIncreasingBeginTimestamps.push({ previousRunIndex: previous.runIndex, runIndex: current.runIndex });
    }
  }
  if (missingBeginTimestamps.length > 0 || nonIncreasingBeginTimestamps.length > 0) {
    addFailure(failures, "phase6_begin_run_time_strict", {
      expected: "each begin_phase6_run has a timestamp strictly later than the prior begin",
      actual: {
        missingTimestamps: missingBeginTimestamps.map((entry) => entry.runIndex),
        nonIncreasing: nonIncreasingBeginTimestamps,
      },
      message: "begin run timestamps must strictly increase across runIndex 1..10",
    });
  }
  const beginRunExperimentMismatches = beginRunOutputs
    .map(({ output }) => issuedRunFromOutput(output))
    .filter((issued) => selectedExperimentId && issued.experimentId !== selectedExperimentId)
    .map((issued) => ({ runIndex: issued.runIndex, experimentId: issued.experimentId }));
  if (beginRunExperimentMismatches.length > 0) {
    addFailure(failures, "phase6_begin_run_experiment_match", {
      expected: selectedExperimentId || "selected experimentId",
      actual: beginRunExperimentMismatches.slice(0, 20),
      message: "begin_phase6_run outputs must use the begin_phase6_experiment experimentId",
    });
  }
  if (startJourneyMismatches.length > 0) {
    addFailure(failures, "phase6_start_journey_uses_server_issued_binding", {
      expected: "start_journey experimentId/runIndex/seed/versions/binding equal begin_phase6_run output",
      actual: startJourneyMismatches.length,
      mismatches: startJourneyMismatches.slice(0, 20),
      message: "start_journey may only use server-issued begin_phase6_run bindings",
    });
  }
  if (startJourneyMetadataOverrides.length > 0) {
    addFailure(failures, "phase6_start_journey_no_metadata_override", {
      expected: 0,
      actual: startJourneyMetadataOverrides.length,
      overrides: startJourneyMetadataOverrides.slice(0, 20),
      message: "client metadata must not override server-issued experiment/run/seed/version/binding fields",
    });
  }
  if (statusReceiptMismatches.length > 0) {
    addFailure(failures, "phase6_status_receipt_binding_match", {
      expected: "status run receipt matches begin_phase6_run runReceipt",
      actual: statusReceiptMismatches.length,
      mismatches: statusReceiptMismatches.slice(0, 20),
      message: "phase6_experiment_status run receipt references must match server-issued run receipts",
    });
  }
  if (runs.length !== REQUIRED_RUNS) {
    failures.push({
      gate: "ten_runs_grouped",
      expected: REQUIRED_RUNS,
      actual: runs.length,
      message: "records must aggregate to exactly ten runIndex groups",
    });
  }
  if (invalidRunIndexes.size > 0) {
    failures.push({
      gate: "phase6_run_index_domain",
      expected: "1..10",
      actual: [...invalidRunIndexes].sort((left, right) => left - right),
      message: "runIndex must be inside the fixed Phase 6 ten-run domain",
    });
  }
  const observedRunIndexes = new Set(runs.map((run) => run.runIndex));
  const missingRunIndexes = Array.from({ length: REQUIRED_RUNS }, (_, index) => index + 1)
    .filter((runIndex) => !observedRunIndexes.has(runIndex));
  if (missingRunIndexes.length > 0 || observedRunIndexes.size !== REQUIRED_RUNS) {
    failures.push({
      gate: "phase6_run_index_exact_coverage",
      expected: "unique runIndex set 1..10",
      actual: runs.map((run) => run.runIndex),
      missingRunIndexes,
      message: "Phase 6 JSONL must cover each runIndex from 1 through 10 exactly once as run groups",
    });
  }
  failIfValueSetInvalid(
    failures,
    "phase6_experiment_binding_consistent",
    "one experimentId across ten runs",
    experimentIds,
    "experimentId must be present and consistent across the ten-run experiment",
  );
  failIfValueSetInvalid(
    failures,
    "phase6_explorer_binding_consistent",
    "one explorerId across ten runs",
    explorerIds,
    "explorerId must be present and consistent across the ten-run experiment",
  );
  failIfValueSetInvalid(
    failures,
    "phase6_identity_binding_consistent",
    "one identityId across ten runs",
    identityIds,
    "identityId must be present and consistent across the ten-run experiment",
  );
  failIfValueSetInvalid(
    failures,
    "phase6_scenario_matrix_version_consistent",
    "one scenarioMatrixVersion across ten runs",
    scenarioMatrixVersions,
    "scenarioMatrixVersion must be present and consistent across the ten-run experiment",
  );
  if (scenarioTags.size !== REQUIRED_RUNS || EXPECTED_SCENARIO_TAGS.some((tag) => !scenarioTags.has(tag))) {
    failures.push({
      gate: "phase6_scenario_matrix_exact_coverage",
      expected: EXPECTED_SCENARIO_TAGS,
      actual: [...scenarioTags].sort(),
      message: "the server-authoritative ten-run matrix must cover each required scenario tag exactly once",
    });
  }
  failIfValueSetInvalid(
    failures,
    "phase6_ruleset_version_consistent",
    "one rulesetVersion across ten runs",
    rulesetVersions,
    "rulesetVersion must be present and consistent across the ten-run experiment",
  );
  failIfValueSetInvalid(
    failures,
    "phase6_catalog_version_consistent",
    "one catalogVersion across ten runs",
    catalogVersions,
    "catalogVersion must be present and consistent across the ten-run experiment",
  );
  failIfValueSetInvalid(
    failures,
    "phase6_code_version_consistent",
    "one codeVersion across ten runs",
    codeVersions,
    "codeVersion must be present and consistent across the ten-run experiment",
  );
  if (mutationAfterComplete.length > 0) {
    failures.push({
      gate: "phase6_no_mutation_after_complete",
      expected: 0,
      actual: mutationAfterComplete.length,
      mutations: mutationAfterComplete.slice(0, 20),
      message: "no mutation records may appear after a run or experiment is complete",
    });
  }

  const duplicateEventIds = new Set();
  const allEventIds = new Set();
  for (const run of runs) {
    if (run.experimentIds.size < 1) {
      failures.push({ gate: "phase6_experiment_id_present", runIndex: run.runIndex, expected: "present", actual: "missing" });
    }
    if (run.identityIds.size < 1) {
      failures.push({ gate: "phase6_identity_id_present", runIndex: run.runIndex, expected: "present", actual: "missing" });
    }
    if (run.explorerIds.size < 1) {
      failures.push({ gate: "phase6_explorer_id_present", runIndex: run.runIndex, expected: "present", actual: "missing" });
    }
    if (run.scenarioMatrixVersions.size < 1) {
      failures.push({ gate: "phase6_scenario_matrix_version_present", runIndex: run.runIndex, expected: "present", actual: "missing" });
    }
    const expectedScenarioTag = EXPECTED_SCENARIO_TAGS[run.runIndex - 1];
    if (run.scenarioTags.size !== 1 || !run.scenarioTags.has(expectedScenarioTag)) {
      failures.push({
        gate: "phase6_scenario_tag_matches_run",
        runIndex: run.runIndex,
        expected: expectedScenarioTag,
        actual: [...run.scenarioTags].sort(),
      });
    }
    if (run.rulesetVersions.size < 1) {
      failures.push({ gate: "phase6_ruleset_version_present", runIndex: run.runIndex, expected: "present", actual: "missing" });
    }
    if (run.catalogVersions.size < 1) {
      failures.push({ gate: "phase6_catalog_version_present", runIndex: run.runIndex, expected: "present", actual: "missing" });
    }
    if (run.codeVersions.size < 1) {
      failures.push({ gate: "phase6_code_version_present", runIndex: run.runIndex, expected: "present", actual: "missing" });
    }
    if (run.seeds.size !== 1) {
      failures.push({
        gate: "phase6_seed_present",
        runIndex: run.runIndex,
        expected: "exactly one seed value",
        actual: run.seeds.size,
        message: "each run must expose one stable seed",
      });
    }
    if (run.beginPhase6RunSuccessRecords !== 1) {
      addFailure(failures, "phase6_begin_run_once_per_run", {
        runIndex: run.runIndex,
        expected: 1,
        actual: run.beginPhase6RunSuccessRecords,
        message: "each run must have exactly one successful begin_phase6_run",
      });
    }
    if (run.startJourneySuccessRecords < 1) {
      addFailure(failures, "phase6_start_journey_present", {
        runIndex: run.runIndex,
        expected: ">=1 successful start_journey",
        actual: run.startJourneySuccessRecords,
        message: "each run must start from the server-issued Phase 6 binding",
      });
    }
    if (run.serverIssuedStartMatches !== run.startJourneySuccessRecords) {
      addFailure(failures, "phase6_start_journey_all_bindings_match", {
        runIndex: run.runIndex,
        expected: run.startJourneySuccessRecords,
        actual: run.serverIssuedStartMatches,
        message: "every start_journey in a run must match begin_phase6_run experimentId/runIndex/seed/versions/binding",
      });
    }
    if (run.phase6ExperimentStatusSuccessRecords < 1) {
      addFailure(failures, "phase6_experiment_status_present", {
        runIndex: run.runIndex,
        expected: ">=1 successful phase6_experiment_status containing this run",
        actual: run.phase6ExperimentStatusSuccessRecords,
        message: "each run must be observed through phase6_experiment_status",
      });
    }
    const hasCompleteStatus = [...run.phase6ExperimentStatusRunStates].some((state) => /^(complete|completed)$/i.test(state));
    if (run.phase6ExperimentStatusReceiptMatches < 1 || !hasCompleteStatus) {
      addFailure(failures, "phase6_experiment_status_run_receipt_consistent", {
        runIndex: run.runIndex,
        expected: "complete status with receipt matching begin_phase6_run runReceipt",
        actual: {
          receiptMatches: run.phase6ExperimentStatusReceiptMatches,
          states: [...run.phase6ExperimentStatusRunStates].sort(),
        },
        message: "phase6_experiment_status must link the completed run state to the server-issued receipt",
      });
    }
    if (run.runReceipt < 1) {
      failures.push({ gate: "phase6_run_receipt_present", runIndex: run.runIndex, expected: ">=1", actual: run.runReceipt });
    }
    if (run.runReceiptSuccessRecords < 1) {
      failures.push({
        gate: "phase6_obsidian_epoch_run_receipt_success_present",
        runIndex: run.runIndex,
        expected: ">=1 successful obsidian_epoch.run_receipt record",
        actual: run.runReceiptSuccessRecords,
      });
    }
    if (run.runReceiptV1Records > 0) {
      failures.push({
        gate: "phase6_run_receipt_no_v1",
        runIndex: run.runIndex,
        expected: 0,
        actual: run.runReceiptV1Records,
        message: "journey_run_receipt.v1 is not accepted by the Phase 6 RunReceipt v2 gate",
      });
    }
    if (run.runReceiptV2ValidRecords < 1) {
      failures.push({
        gate: "phase6_run_receipt_v2_strict",
        runIndex: run.runIndex,
        expected: `>=1 strict ${RUN_RECEIPT_V2_SCHEMA} receipt`,
        actual: run.runReceiptV2ValidRecords,
        missingOrInvalid: [...new Set(run.runReceiptV2Errors)].slice(0, 30),
        message: "obsidian_epoch.run_receipt must return a strict journey_run_receipt.v2 receipt with required bindings, timing, world time, before/after body+hash, outcome, and integrity.eventIds",
      });
    }
    if (run.phase6ResultSuccessRecords < 1) {
      failures.push({
        gate: "phase6_obsidian_epoch_phase6_result_success_present",
        runIndex: run.runIndex,
        expected: ">=1 successful obsidian_epoch.phase6_result record",
        actual: run.phase6ResultSuccessRecords,
      });
    }
    if (run.phase6ResultVerifiedRecords < 1) {
      failures.push({
        gate: "phase6_result_sidecar_verified",
        runIndex: run.runIndex,
        expected: ">=1 verified obsidian_epoch.phase6_result sidecar",
        actual: run.phase6ResultVerifiedRecords,
        message: "Phase 6 result sidecar must explicitly report verified=true",
      });
    }
    const statusBindings = new Set(run.journeyStatusSettlements.map((proof) => `${proof.pageId}\u0000${proof.receiptId}`));
    const receiptIds = new Set(run.receiptV2Proofs.map((proof) => proof.receiptId).filter(Boolean));
    const verifiedResultBindings = run.verifiedResults.filter((proof) => proof.pageId && proof.receiptId);
    if (run.journeyStatusSettlements.length < 1) {
      failures.push({
        gate: "phase6_journey_status_settlement_strict",
        runIndex: run.runIndex,
        expected: "journey_status phase6Settlement.ok=true/status=settled/nonempty pageId+receiptId",
        actual: 0,
      });
    }
    if (verifiedResultBindings.length < 1 || !verifiedResultBindings.some((proof) => statusBindings.has(`${proof.pageId}\u0000${proof.receiptId}`) && receiptIds.has(proof.receiptId))) {
      failures.push({
        gate: "phase6_result_verified_binding_match",
        runIndex: run.runIndex,
        expected: "verified result pageId/receiptId match same-run journey_status settlement and V2 receipt",
        actual: verifiedResultBindings.map((proof) => ({ pageId: proof.pageId || null, receiptId: proof.receiptId || null })).slice(0, 10),
        message: "verified=true is accepted only when result pageId and receiptId bind to same-run status and receipt evidence",
      });
    }
    const beginPosition = run.beginPhase6RunPositions[0];
    if (run.runIndex > 1 && beginPosition !== undefined) {
      const previousRun = runsByIndex.get(run.runIndex - 1);
      const previousReady = previousRun
        && previousRun.settledStatusPositions.some((position) => position < beginPosition)
        && previousRun.receiptV2Proofs.some((proof) => proof.position < beginPosition)
        && previousRun.verifiedResults.some((proof) => proof.position < beginPosition && proof.pageId && proof.receiptId);
      if (!previousReady) {
        failures.push({
          gate: "phase6_previous_run_settled_before_next_begin",
          runIndex: run.runIndex,
          expected: `run ${run.runIndex - 1} settled status, V2 receipt, and verified result before run ${run.runIndex} begin`,
          actual: "missing or appears after next begin",
        });
      }
    }
    if (run.resultReceipt < 1) {
      failures.push({ gate: "phase6_result_receipt_present", runIndex: run.runIndex, expected: ">=1", actual: run.resultReceipt });
    }
    if (run.runReceiptRunIndexMismatches > 0) {
      failures.push({
        gate: "phase6_run_receipt_run_index_match",
        runIndex: run.runIndex,
        expected: run.runIndex,
        actual: `${run.runReceiptRunIndexMismatches} mismatched receipts`,
      });
    }
    if (run.resultReceiptRunIndexMismatches > 0) {
      failures.push({
        gate: "phase6_result_receipt_run_index_match",
        runIndex: run.runIndex,
        expected: run.runIndex,
        actual: `${run.resultReceiptRunIndexMismatches} mismatched receipts`,
      });
    }
    if (run.formalJourney !== 1) {
      failures.push({ gate: "formal_journey", runIndex: run.runIndex, expected: 1, actual: run.formalJourney });
    }
    if (run.playerPanelToolCalls !== 2) {
      failures.push({ gate: "phase6_player_panel_exact_tool_calls", runIndex: run.runIndex, expected: 2, actual: run.playerPanelToolCalls });
    }
    if (run.playerPanelBefore !== 1) {
      failures.push({ gate: "player_panel_before", runIndex: run.runIndex, expected: 1, actual: run.playerPanelBefore });
    }
    if (run.playerPanelAfter !== 1) {
      failures.push({ gate: "player_panel_after", runIndex: run.runIndex, expected: 1, actual: run.playerPanelAfter });
    }
    const beforePanel = run.beforePanelSnapshots.at(-1);
    const afterPanel = run.afterPanelSnapshots.at(-1);
    if (!beforePanel || !afterPanel) {
      failures.push({
        gate: "phase6_player_panel_before_after_snapshots_present",
        runIndex: run.runIndex,
        expected: "machine-readable before and after player panel snapshots",
        actual: { before: Boolean(beforePanel), after: Boolean(afterPanel) },
      });
    } else {
      const proof = panelDiffProof(beforePanel, afterPanel);
      if (!proof.anyChanged && run.explicitNoChangeReasons.size === 0) {
        failures.push({
          gate: "phase6_player_panel_delta_or_no_change_reason",
          runIndex: run.runIndex,
          expected: "a canonical before/after delta or an explicit stable no-change reason",
          actual: proof,
          message: "Phase 6 must not force attribute or skill growth; unchanged panels are valid only with a structured reason",
        });
      }
    }
    if (run.resultPage < 1) {
      failures.push({ gate: "formal_result_page", runIndex: run.runIndex, expected: ">=1", actual: run.resultPage });
    }
    if (run.runReceipt < 1) {
      failures.push({ gate: "run_receipt", runIndex: run.runIndex, expected: ">=1", actual: run.runReceipt });
    }
    if (run.eventIds.size < 1) {
      failures.push({ gate: "event_ids", runIndex: run.runIndex, expected: ">=1", actual: 0 });
    }
    for (const eventId of run.eventIds) {
      if (allEventIds.has(eventId)) {
        duplicateEventIds.add(eventId);
      }
      allEventIds.add(eventId);
    }
    if (!run.resourceConservationObserved || !run.resourceConservationPassed) {
      failures.push({
        gate: "resource_conservation",
        runIndex: run.runIndex,
        expected: "observed passed conservation proof",
        actual: run.resourceConservationObserved ? "observed failed" : "missing",
      });
    }
    if (!run.ragOrWorldDeltaOrNoChange) {
      failures.push({
        gate: "rag_world_delta_or_no_change_reason",
        runIndex: run.runIndex,
        expected: "delta or explicit no-change reason",
        actual: "missing",
      });
    }
  }
  if (duplicateEventIds.size > 0) {
    failures.push({
      gate: "event_ids_unique",
      expected: "all eventIds unique across run groups",
      actual: duplicateEventIds.size,
      eventIds: [...duplicateEventIds].slice(0, 20),
    });
  }
  validateScoreBreakdowns(runs, failures, forbidden);

  return {
    schemaVersion: "obsidian-epoch.phase6-ten-run.acceptance.v1",
    ok: failures.length === 0,
    experimentId: selectedExperimentId || null,
    requiredRuns: REQUIRED_RUNS,
    recordsParsed: records.length,
    parseErrors: parseErrors.length,
    ungroupedRecords,
    runCount: runs.length,
    gates: {
      formalJourneys: runs.reduce((sum, run) => sum + run.formalJourney, 0),
      playerPanelBeforeSnapshots: runs.reduce((sum, run) => sum + run.playerPanelBefore, 0),
      playerPanelAfterSnapshots: runs.reduce((sum, run) => sum + run.playerPanelAfter, 0),
      playerPanelToolCalls: runs.reduce((sum, run) => sum + run.playerPanelToolCalls, 0),
      scenarioTags: scenarioTags.size,
      resultPages: runs.reduce((sum, run) => sum + run.resultPage, 0),
      runReceipts: runs.reduce((sum, run) => sum + run.runReceipt, 0),
      runReceiptSuccessRecords: runs.reduce((sum, run) => sum + run.runReceiptSuccessRecords, 0),
      runReceiptV2ValidRecords: runs.reduce((sum, run) => sum + run.runReceiptV2ValidRecords, 0),
      runReceiptV1Records: runs.reduce((sum, run) => sum + run.runReceiptV1Records, 0),
      resultReceipts: runs.reduce((sum, run) => sum + run.resultReceipt, 0),
      phase6ResultSuccessRecords: runs.reduce((sum, run) => sum + run.phase6ResultSuccessRecords, 0),
      phase6ResultVerifiedRecords: runs.reduce((sum, run) => sum + run.phase6ResultVerifiedRecords, 0),
      beginPhase6ExperimentSuccessRecords: beginExperimentOutputs.length,
      beginPhase6RunSuccessRecords: beginRunOutputs.length,
      beginPhase6RunCoveredIndexes: new Set(beginRunIndexes).size,
      startJourneySuccessRecords: runs.reduce((sum, run) => sum + run.startJourneySuccessRecords, 0),
      serverIssuedStartMatches: runs.reduce((sum, run) => sum + run.serverIssuedStartMatches, 0),
      startJourneyMetadataOverrideRecords: startJourneyMetadataOverrides.length,
      phase6ExperimentStatusSuccessRecords: statusOutputs.length,
      phase6ExperimentStatusRunObservations: runs.reduce((sum, run) => sum + run.phase6ExperimentStatusSuccessRecords, 0),
      phase6ExperimentStatusReceiptMatches: runs.reduce((sum, run) => sum + run.phase6ExperimentStatusReceiptMatches, 0),
      phase6MutationAfterComplete: mutationAfterComplete.length,
      eventIds: allEventIds.size,
      resourceConservationPassedRuns: runs.filter((run) => run.resourceConservationObserved && run.resourceConservationPassed).length,
      ragWorldDeltaOrNoChangeRuns: runs.filter((run) => run.ragOrWorldDeltaOrNoChange).length,
      internalErrors: forbidden.internalErrorPaths.size,
      legacyTools: forbidden.legacyToolPaths.size,
      secretFindings: forbidden.secretPaths.size,
    },
    runs: runs.map(summarizeRun),
    failures: normalizeFailures(failures),
  };
}

function main() {
  try {
    const options = parseArguments(process.argv.slice(2));
    if (options.help) {
      process.stdout.write(`${usage()}\n`);
      return;
    }
    const input = readInput(options.inputPath);
    const summary = validate(options, input);
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
    if (!summary.ok) {
      process.exitCode = 1;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stdout.write(`${JSON.stringify({
      schemaVersion: "obsidian-epoch.phase6-ten-run.acceptance.v1",
      ok: false,
      failures: [{ code: "cli_error", gate: "cli_error", message }],
    }, null, 2)}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(process.argv[1])) {
  main();
}

export { validate };
