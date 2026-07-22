#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const SCHEMA_VERSION = "obsidian-epoch.phase6-player-panel-gate.v1";
const LEGACY_RECEIPT_VERSION = "journey_run_receipt.v1";
const V2_RECEIPT_VERSION = "journey_run_receipt.v2";
const DEFAULT_EXPECTED_RUNS = 10;
const REQUIRED_GROUPS_PER_RUN = 2;
const MAX_ERRORS = 200;
const SECRET_KEY = /(?:secret|token|api[-_]?key|authorization|password|credential|private[-_]?key|access[-_]?key|refresh[-_]?token|session[-_]?key|client[-_]?secret|recovery[-_]?code|operator[-_]?key)/i;
const SECRET_VALUE = /(?:\b(?:sk-[A-Za-z0-9_-]{12,}|Bearer\s+[A-Za-z0-9._~+/=-]{12,}|xox[baprs]-[A-Za-z0-9-]{12,}|AKIA[0-9A-Z]{16})\b|-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----)/i;
const BAD_FALLBACK = /(?:internal_error|default[_ -]?fallback|\bfallback_default\b)/i;
const EMPTY_REASON = /^(?:unknown|none|null|n\/a|default|internal_error|fallback|default[_ -]?fallback)$/i;
const RUN_IDENTITY_PATHS = [
  ["runId"],
  ["run_id"],
  ["journeyId"],
  ["journey_id"],
  ["meta", "runId"],
  ["meta", "journeyId"],
  ["payload", "runId"],
  ["payload", "journeyId"],
  ["runReceipt", "runId"],
  ["runReceipt", "journeyId"],
  ["receipt", "runId"],
  ["receipt", "journeyId"],
];

const ATTRIBUTE_ALIASES = [
  ["physique", ["physique", "constitution", "body", "strength", "tiPo", "体魄"]],
  ["agility", ["agility", "dexterity", "speed", "movement", "shenFa", "身法"]],
  ["perception", ["perception", "sense", "spiritualSense", "divineSense", "shenShi", "神识"]],
  ["intellect", ["intellect", "intelligence", "wisdom", "comprehension", "wuXing", "悟性"]],
  ["willpower", ["willpower", "will", "resolve", "heart", "yiZhi", "意志"]],
  ["luck", ["luck", "fortune", "karma", "opportunity", "jiYuan", "机缘"]],
];

const READINESS_ALIASES = [
  ["combat", ["combat", "battle", "fight"]],
  ["survival", ["survival", "survive"]],
  ["exploration", ["exploration", "explore"]],
  ["social", ["social", "relationship", "relations"]],
  ["stealth", ["stealth", "sneak"]],
  ["crafting", ["crafting", "craft"]],
  ["cultivation", ["cultivation", "breakthrough"]],
  ["resource", ["resource", "resources", "economy"]],
  ["injury", ["injury", "injuries", "health"]],
  ["world", ["world", "environment", "travel"]],
];

const CURRENT_ATTRIBUTE_KEYS = ["strength", "agility", "physique", "intellect", "willpower", "spirituality"];
const CURRENT_READINESS_KEYS = [
  "adaptation",
  "control",
  "corruptionResistance",
  "mobility",
  "offense",
  "perception",
  "protection",
  "reserve",
  "sustain",
  "synergy",
];
const ATTRIBUTE_CONTAINER_PATHS = [
  ["attributes"],
  ["baseAttributes"],
  ["base_attributes"],
  ["sixAttributes"],
  ["six_attributes"],
  ["stats"],
  ["profile", "attributes"],
];
const READINESS_CONTAINER_PATHS = [
  ["readiness"],
  ["readinessDimensions"],
  ["readiness_dimensions"],
  ["tenReadiness"],
  ["ten_readiness"],
  ["preparedness"],
];

const REQUIRED_DOMAINS = [
  {
    key: "identity",
    paths: [["identity"], ["playerIdentity"], ["player_identity"], ["character"], ["player"], ["profile", "identity"]],
  },
  ...ATTRIBUTE_ALIASES.map(([key, aliases]) => ({
    key: `attribute.${key}`,
    paths: aliases.flatMap((alias) => [
      ["attributes", alias],
      ["baseAttributes", alias],
      ["base_attributes", alias],
      ["sixAttributes", alias],
      ["six_attributes", alias],
      ["stats", alias],
      ["profile", "attributes", alias],
    ]),
  })),
  ...READINESS_ALIASES.map(([key, aliases]) => ({
    key: `readiness.${key}`,
    paths: aliases.flatMap((alias) => [
      ["readiness", alias],
      ["readinessDimensions", alias],
      ["readiness_dimensions", alias],
      ["tenReadiness", alias],
      ["ten_readiness", alias],
      ["preparedness", alias],
    ]),
  })),
  { key: "skills", paths: [["skills"], ["abilities", "skills"], ["progression", "skills"]] },
  { key: "talents", paths: [["talents"], ["abilities", "talents"], ["progression", "talents"]] },
  { key: "methods", paths: [["methods"], ["cultivationMethods"], ["cultivation_methods"], ["gongfa"], ["功法"], ["progression", "methods"]] },
  { key: "cultivation", paths: [["cultivation"], ["realm"], ["progression", "cultivation"]] },
  { key: "injuries", paths: [["injuries"], ["wounds"], ["health", "injuries"], ["status", "injuries"], ["progression", "injuries"]] },
  { key: "warehouse", paths: [["warehouse"], ["storage", "warehouse"], ["inventory", "warehouse"], ["economy", "warehouse"]] },
  { key: "currency", paths: [["currency"], ["currencies"], ["money"], ["wallet"], ["economy", "currency"], ["economy", "currencies"]] },
  { key: "materials", paths: [["materials"], ["inventory", "materials"], ["warehouse", "materials"], ["economy", "materials"]] },
  { key: "equipment", paths: [["equipment"], ["gear"], ["inventory", "equipment"], ["economy", "equipment"]] },
  { key: "carrySlots", paths: [["carrySlots"], ["carry_slots"], ["inventory", "carrySlots"], ["inventory", "carry_slots"], ["bag", "slots"], ["economy", "carry"]] },
  { key: "insurance", paths: [["insurance"], ["safety", "insurance"], ["economy", "insurance"]] },
  { key: "production", paths: [["production"], ["crafting", "production"], ["workshop", "production"], ["economy", "production"]] },
  { key: "rag", paths: [["rag"], ["RAG"], ["ragPanel"], ["memory"], ["retrieval"], ["knowledge"]] },
  { key: "worldCursor", paths: [["worldCursor"], ["world_cursor"], ["cursor"], ["world", "cursor"], ["world", "canonicalCursor"]] },
];

const SHARED_REQUIRED_DOMAINS = REQUIRED_DOMAINS.filter((domain) => (
  !domain.key.startsWith("attribute.") && !domain.key.startsWith("readiness.")
));
const CURRENT_REQUIRED_DOMAINS = [
  SHARED_REQUIRED_DOMAINS[0],
  ...CURRENT_ATTRIBUTE_KEYS.map((key) => ({
    key: `attribute.${key}`,
    paths: ATTRIBUTE_CONTAINER_PATHS.map((containerPath) => [...containerPath, key]),
  })),
  ...CURRENT_READINESS_KEYS.map((key) => ({
    key: `readiness.${key}`,
    paths: READINESS_CONTAINER_PATHS.map((containerPath) => [...containerPath, key]),
  })),
  ...SHARED_REQUIRED_DOMAINS.slice(1),
];

function usage() {
  return [
    "Usage: node tools/agent-server/phase6-player-panel-gate.mjs --before <repo-jsonl> --after <repo-jsonl> --receipt <repo-jsonl> [--expected-runs 10]",
    "",
    "Reads ten-run before/after player panel JSON/JSONL and RunReceipt JSON/JSONL.",
    "Prints only counts, hashes, and stable error codes. Exits non-zero on gate failure.",
  ].join("\n");
}

function codedError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function parseArguments(argv) {
  const options = { beforePath: undefined, afterPath: undefined, receiptPaths: [], expectedRuns: DEFAULT_EXPECTED_RUNS, help: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help" || argument === "-h") {
      options.help = true;
      continue;
    }
    if (SECRET_KEY.test(argument) || SECRET_VALUE.test(argument)) throw codedError("E_ARGUMENT_SECRET");
    if (argument === "--before" || argument === "--before-panels" || argument === "--before-panel") {
      options.beforePath = readPathArgument(argv, index, argument);
      index += 1;
      continue;
    }
    if (argument === "--after" || argument === "--after-panels" || argument === "--after-panel") {
      options.afterPath = readPathArgument(argv, index, argument);
      index += 1;
      continue;
    }
    if (argument === "--receipt" || argument === "--receipts" || argument === "--run-receipt" || argument === "--run-receipts") {
      options.receiptPaths.push(readPathArgument(argv, index, argument));
      index += 1;
      continue;
    }
    if (argument === "--expected-runs") {
      const raw = argv[index + 1];
      if (!raw || !/^[1-9]\d*$/.test(raw)) throw codedError("E_ARGUMENT_EXPECTED_RUNS");
      options.expectedRuns = Number.parseInt(raw, 10);
      if (!Number.isSafeInteger(options.expectedRuns)) throw codedError("E_ARGUMENT_EXPECTED_RUNS");
      index += 1;
      continue;
    }
    throw codedError("E_ARGUMENT_UNKNOWN");
  }
  if (!options.help && (!options.beforePath || !options.afterPath || options.receiptPaths.length === 0)) throw codedError("E_ARGUMENT_REQUIRED");
  return options;
}

function readPathArgument(argv, index, flag) {
  const value = argv[index + 1];
  if (!value) throw codedError(flag === "--expected-runs" ? "E_ARGUMENT_EXPECTED_RUNS" : "E_ARGUMENT_PATH");
  if (SECRET_KEY.test(value) || SECRET_VALUE.test(value)) throw codedError("E_ARGUMENT_SECRET");
  return value;
}

function sha256Text(text) {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}

function sha256(value) {
  return `sha256:${sha256Text(String(value))}`;
}

function shortHash(value) {
  return sha256(value).slice(0, 19);
}

function canonicalize(value, pathLabel = "$", seen = new WeakSet()) {
  if (value === null) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw codedError(`E_CANONICAL_NUMBER`);
    return JSON.stringify(value);
  }
  if (typeof value !== "object") throw codedError(`E_CANONICAL_UNSUPPORTED`);
  if (seen.has(value)) throw codedError(`E_CANONICAL_CYCLE`);
  seen.add(value);
  if (Array.isArray(value)) {
    const items = value.map((entry, index) => canonicalize(entry, `${pathLabel}[${index}]`, seen));
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
  return sha256(canonicalize(value));
}

function repoInputPath(inputPath) {
  if (!inputPath || path.isAbsolute(inputPath)) throw codedError("E_INPUT_PATH");
  const normalized = path.normalize(inputPath);
  if (normalized === ".." || normalized.startsWith(`..${path.sep}`)) throw codedError("E_INPUT_OUTSIDE_REPO");
  const repoRoot = fs.realpathSync(process.cwd());
  const resolved = path.resolve(process.cwd(), inputPath);
  const real = fs.realpathSync(resolved);
  if (real !== repoRoot && !real.startsWith(`${repoRoot}${path.sep}`)) throw codedError("E_INPUT_OUTSIDE_REPO");
  if (!fs.statSync(real).isFile()) throw codedError("E_INPUT_NOT_FILE");
  return real;
}

function readInput(inputPath) {
  const real = repoInputPath(inputPath);
  const text = fs.readFileSync(real, "utf8");
  if (text.length === 0) throw codedError("E_INPUT_EMPTY");
  return { text, hash: sha256(text) };
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
  if (!trimmed) return undefined;
  const direct = tryParseJson(trimmed);
  if (direct !== undefined) return direct;
  const objectStart = trimmed.indexOf("{");
  const objectEnd = trimmed.lastIndexOf("}");
  if (objectStart >= 0 && objectEnd > objectStart) return tryParseJson(trimmed.slice(objectStart, objectEnd + 1));
  const arrayStart = trimmed.indexOf("[");
  const arrayEnd = trimmed.lastIndexOf("]");
  if (arrayStart >= 0 && arrayEnd > arrayStart) return tryParseJson(trimmed.slice(arrayStart, arrayEnd + 1));
  return undefined;
}

function flattenRecords(value, records = []) {
  if (Array.isArray(value)) {
    value.forEach((entry) => flattenRecords(entry, records));
    return records;
  }
  if (value && typeof value === "object") {
    for (const key of ["records", "runs", "samples", "receipts", "runReceipts", "run_receipts", "panels", "playerPanels", "player_panels"]) {
      if (Array.isArray(value[key])) return flattenRecords(value[key], records);
    }
    records.push(value);
  }
  return records;
}

function parseRecords(input) {
  const whole = tryParseJson(input.text.trim());
  if (whole !== undefined) return { records: flattenRecords(whole), parseErrorCount: 0 };
  const records = [];
  let parseErrorCount = 0;
  input.text.split(/\r?\n/).forEach((line) => {
    if (!line.trim()) return;
    const parsed = extractJsonCandidate(line);
    if (parsed === undefined) {
      parseErrorCount += 1;
      return;
    }
    flattenRecords(parsed, records);
  });
  return { records, parseErrorCount };
}

function scanForSecretsAndFallbacks(value, state) {
  if (Array.isArray(value)) {
    value.forEach((entry) => scanForSecretsAndFallbacks(entry, state));
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, entry] of Object.entries(value)) {
      if (SECRET_KEY.test(key)) state.secretCount += 1;
      if (BAD_FALLBACK.test(key)) state.fallbackCount += 1;
      scanForSecretsAndFallbacks(entry, state);
    }
    return;
  }
  if (typeof value === "string") {
    if (SECRET_VALUE.test(value)) state.secretCount += 1;
    if (BAD_FALLBACK.test(value)) state.fallbackCount += 1;
  }
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
  for (const candidate of paths) {
    const value = getPath(record, candidate);
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return undefined;
}

function textValue(value) {
  if (value === undefined || value === null || value === "") return undefined;
  return String(value);
}

function runIdentity(record) {
  return textValue(firstValue(record, RUN_IDENTITY_PATHS));
}

function runIdentities(record) {
  return unique(RUN_IDENTITY_PATHS.map((segments) => textValue(getPath(record, segments))).filter(Boolean));
}

function extractPanel(record) {
  const candidate = firstValue(record, [
    ["playerPanel"],
    ["player_panel"],
    ["panel"],
    ["payload", "playerPanel"],
    ["payload", "player_panel"],
    ["payload", "panel"],
    ["result", "playerPanel"],
    ["result", "panel"],
  ]);
  return candidate && typeof candidate === "object" ? candidate : record;
}

function groupCount(record, panel) {
  const groups = firstValue(record, [
    ["groups"],
    ["panelGroups"],
    ["panel_groups"],
    ["playerPanelGroups"],
    ["player_panel_groups"],
    ["payload", "groups"],
    ["payload", "panelGroups"],
  ]) ?? firstValue(panel, [["groups"], ["panelGroups"], ["panel_groups"], ["sections"], ["sectionGroups"]]);
  if (Array.isArray(groups)) return groups.length;
  if (groups && typeof groups === "object") return Object.keys(groups).length;
  return undefined;
}

function domainValue(panel, domain) {
  return firstValue(panel, domain.paths);
}

function panelHash(panel) {
  return canonicalHash(panel);
}

function panelReportedHash(record, panel) {
  return textValue(firstValue(record, [
    ["panelHash"],
    ["panel_hash"],
    ["hash"],
    ["playerPanelHash"],
    ["player_panel_hash"],
    ["payload", "panelHash"],
    ["payload", "playerPanelHash"],
  ]) ?? firstValue(panel, [["panelHash"], ["panel_hash"], ["hash"]]));
}

function receiptHashValue(receipt, side) {
  const snake = `${side}_panel_hash`;
  const camel = `${side}PanelHash`;
  return textValue(firstValue(receipt, [
    [camel],
    [snake],
    ["panelHashes", side],
    ["panel_hashes", side],
    ["hashes", "panels", side],
    ["hashes", "panel", side],
    ["playerPanel", "hashes", side],
    ["player_panel", "hashes", side],
    ["payload", camel],
    ["payload", "panelHashes", side],
  ]));
}

function receiptSchema(receipt) {
  const versionValues = unique([
    textValue(getPath(receipt, ["version"])),
    textValue(getPath(receipt, ["schemaVersion"])),
    textValue(getPath(receipt, ["schema_version"])),
    textValue(getPath(receipt, ["receiptVersion"])),
    textValue(getPath(receipt, ["receipt_version"])),
  ].filter(Boolean));
  if (versionValues.length > 1) return { kind: "invalid", errorCode: "E_RECEIPT_VERSION_CONFLICT" };
  if (versionValues.length === 1) {
    if (versionValues[0] === LEGACY_RECEIPT_VERSION) return { kind: "legacy" };
    if (versionValues[0] === V2_RECEIPT_VERSION) return { kind: "v2" };
    return { kind: "invalid", errorCode: "E_RECEIPT_VERSION_UNSUPPORTED" };
  }
  const hasV2Shape = getPath(receipt, ["snapshots"]) !== undefined
    || getPath(receipt, ["deltas"]) !== undefined
    || getPath(receipt, ["integrity", "deltasHash"]) !== undefined;
  return hasV2Shape
    ? { kind: "invalid", errorCode: "E_RECEIPT_VERSION_MISSING" }
    : { kind: "legacy" };
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function validateV2Receipt(receipt, beforePanel, afterPanel, runKey, errors) {
  const snapshots = getPath(receipt, ["snapshots"]);
  const integrity = getPath(receipt, ["integrity"]);
  const deltas = getPath(receipt, ["deltas"]);
  if (!isRecord(snapshots) || !isRecord(integrity) || deltas === undefined) {
    errors.push(error("E_RECEIPT_V2_SHAPE_INVALID", runKey));
    return;
  }

  for (const [side, panel] of [["before", beforePanel], ["after", afterPanel]]) {
    const snapshot = snapshots[side];
    const code = side === "before" ? "E_RECEIPT_BEFORE_HASH_MISMATCH" : "E_RECEIPT_AFTER_HASH_MISMATCH";
    if (!isRecord(snapshot) || !Object.prototype.hasOwnProperty.call(snapshot, "body") || !isRecord(snapshot.body)) {
      errors.push(error("E_RECEIPT_V2_SHAPE_INVALID", runKey));
      continue;
    }
    const reportedHash = textValue(snapshot.hash);
    if (!reportedHash
      || !hashesEqual(canonicalHash(snapshot.body), reportedHash)
      || !hashesEqual(canonicalHash(panel), reportedHash)) {
      errors.push(error(code, runKey));
    }
  }

  const deltasHash = textValue(integrity.deltasHash);
  if (!deltasHash || !hashesEqual(canonicalHash(deltas), deltasHash)) {
    errors.push(error("E_RECEIPT_DELTAS_HASH_MISMATCH", runKey));
  }
}

function validateCurrentDimensionShape(panel, runKey, errors) {
  validateExactDimensionContainer(panel, ATTRIBUTE_CONTAINER_PATHS, CURRENT_ATTRIBUTE_KEYS, "E_CURRENT_ATTRIBUTE_SHAPE", runKey, errors);
  validateExactDimensionContainer(panel, READINESS_CONTAINER_PATHS, CURRENT_READINESS_KEYS, "E_CURRENT_READINESS_SHAPE", runKey, errors);
}

function validateExactDimensionContainer(panel, paths, requiredKeys, code, runKey, errors) {
  const containers = paths
    .map((candidate) => getPath(panel, candidate))
    .filter((candidate) => candidate !== undefined);
  if (containers.length !== 1 || !isRecord(containers[0])) {
    errors.push(error(code, runKey));
    return;
  }
  const actualKeys = Object.keys(containers[0]).sort();
  const expectedKeys = [...requiredKeys].sort();
  if (canonicalize(actualKeys) !== canonicalize(expectedKeys)) errors.push(error(code, runKey));
}

function diffReportedHash(record, receipt) {
  return textValue(firstValue(receipt, [
    ["panelDiffHash"],
    ["panel_diff_hash"],
    ["diffHash"],
    ["diff_hash"],
    ["playerPanel", "diffHash"],
    ["player_panel", "diffHash"],
    ["hashes", "panelDiff"],
    ["hashes", "diff"],
    ["payload", "panelDiffHash"],
  ]) ?? firstValue(record, [["diffHash"], ["diff_hash"], ["panelDiffHash"], ["panel_diff_hash"]]));
}

function hashesEqual(actual, expected) {
  return typeof actual === "string" && typeof expected === "string" && isStrictSha256(actual) && isStrictSha256(expected) && actual === expected;
}

function isStrictSha256(value) {
  return typeof value === "string" && /^sha256:[0-9a-f]{64}$/.test(value);
}

function diffPanels(beforePanel, afterPanel) {
  const changes = [];
  collectDiff(beforePanel, afterPanel, [], changes);
  return changes;
}

function collectDiff(beforeValue, afterValue, pathSegments, changes) {
  const beforeHash = diffValueHash(beforeValue);
  const afterHash = diffValueHash(afterValue);
  if (beforeHash === afterHash) return;
  const beforeObject = beforeValue && typeof beforeValue === "object";
  const afterObject = afterValue && typeof afterValue === "object";
  if (beforeObject && afterObject && Array.isArray(beforeValue) === Array.isArray(afterValue)) {
    const keys = Array.isArray(beforeValue)
      ? [...Array(Math.max(beforeValue.length, afterValue.length)).keys()].map(String)
      : [...new Set([...Object.keys(beforeValue), ...Object.keys(afterValue)])].sort();
    keys.forEach((key) => collectDiff(beforeValue[key], afterValue[key], [...pathSegments, key], changes));
    return;
  }
  changes.push({
    pathHash: shortHash(pathSegments.join(".")),
    beforeHash,
    afterHash,
  });
}

function diffValueHash(value) {
  return value === undefined
    ? sha256("obsidian-epoch.phase6-player-panel-gate.missing-value")
    : canonicalHash(value);
}

function reasonForDomain(domainKey, beforeRecord, afterRecord, receipt) {
  const domainReasons = firstValue(receipt, [
    ["noChangeReasons"],
    ["no_change_reasons"],
    ["stableReasons"],
    ["stable_reasons"],
    ["panelNoChangeReasons"],
    ["panel_no_change_reasons"],
    ["playerPanel", "noChangeReasons"],
    ["player_panel", "noChangeReasons"],
  ]);
  if (domainReasons && typeof domainReasons === "object" && !Array.isArray(domainReasons)) {
    const direct = textValue(domainReasons[domainKey]);
    if (direct && !EMPTY_REASON.test(direct.trim())) return direct;
  }
  const domainReasonEntries = firstValue(receipt, [
    ["domainReasons"],
    ["domain_reasons"],
    ["panelDomainReasons"],
    ["panel_domain_reasons"],
  ]);
  if (Array.isArray(domainReasonEntries)) {
    for (const entry of domainReasonEntries) {
      const key = textValue(firstValue(entry, [["domain"], ["key"], ["field"], ["path"]]));
      const reason = textValue(firstValue(entry, [["reason"], ["noChangeReason"], ["stableReason"]]));
      if (key === domainKey && reason && !EMPTY_REASON.test(reason.trim())) return reason;
    }
  }
  const fallback = textValue(firstValue(afterRecord, [["noChangeReason"], ["stableReason"], ["reason"]])
    ?? firstValue(beforeRecord, [["noChangeReason"], ["stableReason"], ["reason"]])
    ?? firstValue(receipt, [["noChangeReason"], ["stableReason"], ["reason"]]));
  return fallback && !EMPTY_REASON.test(fallback.trim()) ? fallback : undefined;
}

function error(code, runKey, extra = undefined) {
  return {
    code,
    ...(runKey ? { runHash: shortHash(runKey) } : {}),
    ...(extra ? extra : {}),
  };
}

function unique(values) {
  return [...new Set(values)].sort();
}

function indexByRunIdentity(records, kind, errors) {
  const byRun = new Map();
  records.forEach((record, index) => {
    const identities = runIdentities(record);
    const key = runIdentity(record);
    if (!key) {
      errors.push({ code: `E_${kind}_RUN_ID_MISSING`, record: index + 1 });
      return;
    }
    if (identities.length !== 1) {
      errors.push({ code: `E_${kind}_RUN_ID_CONFLICT`, record: index + 1 });
      return;
    }
    const entries = byRun.get(key) ?? [];
    entries.push({ record, index });
    byRun.set(key, entries);
  });
  for (const [key, entries] of byRun) {
    if (entries.length > 1) errors.push(error(`E_${kind}_RUN_ID_DUPLICATE`, key, { count: entries.length }));
  }
  return byRun;
}

function summarize(beforeRecords, afterRecords, receiptRecords, options, parseErrors, sourceHashes) {
  const errors = [];
  const secretState = { secretCount: 0, fallbackCount: 0 };
  [...beforeRecords, ...afterRecords, ...receiptRecords].forEach((record) => scanForSecretsAndFallbacks(record, secretState));

  if (parseErrors.before > 0) errors.push({ code: "E_BEFORE_PARSE", count: parseErrors.before });
  if (parseErrors.after > 0) errors.push({ code: "E_AFTER_PARSE", count: parseErrors.after });
  if (parseErrors.receipt > 0) errors.push({ code: "E_RECEIPT_PARSE", count: parseErrors.receipt });
  if (secretState.secretCount > 0) errors.push({ code: "E_SECRET_INPUT", count: secretState.secretCount });
  if (secretState.fallbackCount > 0) errors.push({ code: "E_INTERNAL_ERROR_OR_DEFAULT_FALLBACK", count: secretState.fallbackCount });
  if (beforeRecords.length !== options.expectedRuns) errors.push({ code: "E_BEFORE_RUN_COUNT", expectedRuns: options.expectedRuns, actualRuns: beforeRecords.length });
  if (afterRecords.length !== options.expectedRuns) errors.push({ code: "E_AFTER_RUN_COUNT", expectedRuns: options.expectedRuns, actualRuns: afterRecords.length });
  if (receiptRecords.length !== options.expectedRuns) errors.push({ code: "E_RECEIPT_RUN_COUNT", expectedRuns: options.expectedRuns, actualRuns: receiptRecords.length });

  const runs = [];
  const beforeByRun = indexByRunIdentity(beforeRecords, "BEFORE", errors);
  const afterByRun = indexByRunIdentity(afterRecords, "AFTER", errors);
  const receiptsByRun = indexByRunIdentity(receiptRecords, "RECEIPT", errors);
  const runKeys = [...new Set([...beforeByRun.keys(), ...afterByRun.keys()])].sort();
  for (const key of receiptsByRun.keys()) {
    if (!beforeByRun.has(key) || !afterByRun.has(key)) errors.push(error("E_RECEIPT_RUN_UNMATCHED", key));
  }
  let pairedRuns = 0;
  let coveredDomains = 0;
  let unchangedDomains = 0;
  let unchangedDomainsWithReason = 0;

  runKeys.forEach((key) => {
    const beforeEntries = beforeByRun.get(key);
    const afterEntries = afterByRun.get(key);
    if (!beforeEntries || !afterEntries) {
      errors.push(error("E_PANEL_PAIR_MISSING", key));
      return;
    }
    pairedRuns += 1;
    const beforeEntry = beforeEntries[0];
    const afterEntry = afterEntries[0];
    const beforePanel = extractPanel(beforeEntry.record);
    const afterPanel = extractPanel(afterEntry.record);
    const receiptEntries = receiptsByRun.get(key) ?? [];
    const receipts = receiptEntries.map((entry) => entry.record);
    if (receipts.length === 0) errors.push(error("E_RECEIPT_MISSING", key));
    const receiptSchemas = receipts.map((receipt) => receiptSchema(receipt));
    receiptSchemas.forEach((schema) => {
      if (schema.kind === "invalid") errors.push(error(schema.errorCode, key));
    });
    const usesCurrentSchema = receiptSchemas.length > 0 && receiptSchemas.every((schema) => schema.kind === "v2");

    const beforeGroupCount = groupCount(beforeEntry.record, beforePanel);
    const afterGroupCount = groupCount(afterEntry.record, afterPanel);
    if (beforeGroupCount !== REQUIRED_GROUPS_PER_RUN) {
      errors.push(error("E_BEFORE_GROUP_COUNT", key, { expectedGroups: REQUIRED_GROUPS_PER_RUN, actualGroups: beforeGroupCount ?? null }));
    }
    if (afterGroupCount !== REQUIRED_GROUPS_PER_RUN) {
      errors.push(error("E_AFTER_GROUP_COUNT", key, { expectedGroups: REQUIRED_GROUPS_PER_RUN, actualGroups: afterGroupCount ?? null }));
    }

    const beforeHash = panelHash(beforePanel);
    const afterHash = panelHash(afterPanel);
    const diff = diffPanels(beforePanel, afterPanel);
    const diffHash = canonicalHash(diff);
    const receiptHash = receipts.length > 0 ? canonicalHash(receipts[0]) : undefined;
    const reportedBeforeHash = panelReportedHash(beforeEntry.record, beforePanel);
    const reportedAfterHash = panelReportedHash(afterEntry.record, afterPanel);

    if (reportedBeforeHash && !hashesEqual(beforeHash, reportedBeforeHash)) errors.push(error("E_BEFORE_PANEL_HASH_MISMATCH", key));
    if (reportedAfterHash && !hashesEqual(afterHash, reportedAfterHash)) errors.push(error("E_AFTER_PANEL_HASH_MISMATCH", key));
    receipts.forEach((receipt, index) => {
      const schema = receiptSchemas[index];
      if (schema.kind === "v2") {
        validateV2Receipt(receipt, beforePanel, afterPanel, key, errors);
        return;
      }
      if (schema.kind !== "legacy") return;
      const receiptBeforeHash = receiptHashValue(receipt, "before");
      const receiptAfterHash = receiptHashValue(receipt, "after");
      const receiptDiffHash = diffReportedHash(afterEntry.record, receipt);
      if (!receiptBeforeHash || !hashesEqual(beforeHash, receiptBeforeHash)) errors.push(error("E_RECEIPT_BEFORE_HASH_MISMATCH", key));
      if (!receiptAfterHash || !hashesEqual(afterHash, receiptAfterHash)) errors.push(error("E_RECEIPT_AFTER_HASH_MISMATCH", key));
      if (!receiptDiffHash || !hashesEqual(diffHash, receiptDiffHash)) errors.push(error("E_RECEIPT_DIFF_HASH_MISMATCH", key));
    });

    if (usesCurrentSchema) {
      validateCurrentDimensionShape(beforePanel, key, errors);
      validateCurrentDimensionShape(afterPanel, key, errors);
    }

    const requiredDomains = usesCurrentSchema ? CURRENT_REQUIRED_DOMAINS : REQUIRED_DOMAINS;
    for (const domain of requiredDomains) {
      const beforeValue = domainValue(beforePanel, domain);
      const afterValue = domainValue(afterPanel, domain);
      if (beforeValue === undefined || afterValue === undefined) {
        errors.push(error("E_DOMAIN_MISSING", key, { domainHash: shortHash(domain.key) }));
        continue;
      }
      coveredDomains += 1;
      if (canonicalHash(beforeValue) === canonicalHash(afterValue)) {
        unchangedDomains += 1;
        const receiptsToCheck = receipts.length > 0 ? receipts : [{}];
        if (receiptsToCheck.every((receipt) => reasonForDomain(domain.key, beforeEntry.record, afterEntry.record, receipt))) {
          unchangedDomainsWithReason += 1;
        } else {
          errors.push(error("E_UNCHANGED_DOMAIN_REASON_MISSING", key, { domainHash: shortHash(domain.key) }));
        }
      }
    }

    runs.push({
      runHash: shortHash(key),
      beforePanelHash: beforeHash,
      afterPanelHash: afterHash,
      diffHash,
      receiptHash,
      diffLeafCount: diff.length,
    });
  });

  const limitedErrors = errors.slice(0, MAX_ERRORS);
  return {
    schemaVersion: SCHEMA_VERSION,
    ok: errors.length === 0,
    metrics: {
      expectedRuns: options.expectedRuns,
      beforePanels: beforeRecords.length,
      afterPanels: afterRecords.length,
      receipts: receiptRecords.length,
      pairedRuns,
      requiredGroupsPerRun: REQUIRED_GROUPS_PER_RUN,
      requiredDomainsPerPanel: REQUIRED_DOMAINS.length,
      coveredDomainComparisons: coveredDomains,
      unchangedDomains,
      unchangedDomainsWithReason,
      secretFindingCount: secretState.secretCount,
      fallbackFindingCount: secretState.fallbackCount,
    },
    sourceHashes,
    runHashes: runs.sort((left, right) => left.runHash.localeCompare(right.runHash)),
    errorCodes: unique(errors.map((entry) => entry.code)),
    errors: limitedErrors,
    truncatedErrors: Math.max(0, errors.length - limitedErrors.length),
  };
}

function printAndExit(summary) {
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  process.exitCode = summary.ok ? 0 : 1;
}

function main() {
  let options;
  try {
    options = parseArguments(process.argv.slice(2));
    if (options.help) {
      process.stdout.write(`${usage()}\n`);
      return;
    }
    const beforeInput = readInput(options.beforePath);
    const afterInput = readInput(options.afterPath);
    const receiptInputs = options.receiptPaths.map(readInput);
    const beforeParsed = parseRecords(beforeInput);
    const afterParsed = parseRecords(afterInput);
    const receiptParsedList = receiptInputs.map(parseRecords);
    const receiptRecords = receiptParsedList.flatMap((parsed) => parsed.records);
    const receiptParseErrorCount = receiptParsedList.reduce((total, parsed) => total + parsed.parseErrorCount, 0);
    printAndExit(summarize(
      beforeParsed.records,
      afterParsed.records,
      receiptRecords,
      options,
      { before: beforeParsed.parseErrorCount, after: afterParsed.parseErrorCount, receipt: receiptParseErrorCount },
      { before: beforeInput.hash, after: afterInput.hash, receipts: receiptInputs.map((input) => input.hash) },
    ));
  } catch (errorValue) {
    const code = errorValue && typeof errorValue === "object" && errorValue.code ? String(errorValue.code) : "E_RUNTIME";
    printAndExit({
      schemaVersion: SCHEMA_VERSION,
      ok: false,
      metrics: {
        expectedRuns: options?.expectedRuns ?? DEFAULT_EXPECTED_RUNS,
        beforePanels: 0,
        afterPanels: 0,
        receipts: 0,
        pairedRuns: 0,
        requiredGroupsPerRun: REQUIRED_GROUPS_PER_RUN,
        requiredDomainsPerPanel: REQUIRED_DOMAINS.length,
        coveredDomainComparisons: 0,
        unchangedDomains: 0,
        unchangedDomainsWithReason: 0,
        secretFindingCount: 0,
        fallbackFindingCount: 0,
      },
      sourceHashes: {},
      runHashes: [],
      errorCodes: [code],
      errors: [{ code }],
      truncatedErrors: 0,
    });
  }
}

main();
