#!/usr/bin/env node
// @ts-nocheck

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const SCHEMA_VERSION = "obsidian-epoch.phase6-economy-gate.v1";
const MAX_PARSE_ERRORS = 20;
const MAX_SECRET_PATHS = 50;
const MAX_ERRORS = 200;
const SECRET_KEY = /(?:secret|token|api[-_]?key|authorization|password|credential|private[-_]?key|access[-_]?key|refresh[-_]?token|session[-_]?key|recovery[-_]?code|operator[-_]?key)/i;
const SECRET_VALUE = /\b(?:sk-[A-Za-z0-9_-]{12,}|Bearer\s+[A-Za-z0-9._-]{12,}|xox[baprs]-[A-Za-z0-9-]{12,}|AKIA[0-9A-Z]{16})\b/i;
const DECIMAL_INTEGER = /^-?(0|[1-9]\d*)$/;

function usage() {
  return [
    "Usage: node --import tsx ../agent-server/phase6-economy-gate.ts --expected-runs <count> [--input <repo-path>]",
    "",
    "Reads RunReceipt economy audit JSON/JSONL from --input or stdin and prints a machine JSON summary.",
    "Exits non-zero when run count mismatches, audit.ok is false, or any economy conservation gate fails.",
  ].join("\n");
}

function parseArguments(argv) {
  const options = { inputPath: undefined, expectedRuns: undefined, help: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help" || argument === "-h") {
      options.help = true;
      continue;
    }
    if (SECRET_KEY.test(argument)) {
      throw codedError("E_ARGUMENT_SECRET", "secret-bearing arguments are not accepted");
    }
    if (argument === "--input") {
      const value = argv[index + 1];
      if (!value) throw codedError("E_ARGUMENT", "--input requires a repo-local path");
      if (SECRET_VALUE.test(value) || SECRET_KEY.test(value)) {
        throw codedError("E_ARGUMENT_SECRET", "--input must not contain secrets");
      }
      options.inputPath = value;
      index += 1;
      continue;
    }
    if (argument === "--expected-runs") {
      const raw = argv[index + 1];
      if (!raw || !/^[1-9]\d*$/.test(raw)) {
        throw codedError("E_ARGUMENT", "--expected-runs requires a positive integer");
      }
      options.expectedRuns = Number.parseInt(raw, 10);
      if (!Number.isSafeInteger(options.expectedRuns)) {
        throw codedError("E_ARGUMENT", "--expected-runs exceeds safe integer range");
      }
      index += 1;
      continue;
    }
    throw codedError("E_ARGUMENT", `unknown argument: ${argument}`);
  }
  if (!options.help && options.expectedRuns === undefined) {
    throw codedError("E_ARGUMENT", "--expected-runs is required");
  }
  return options;
}

function codedError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function repoInputPath(inputPath) {
  if (!inputPath) return undefined;
  const repoRoot = fs.realpathSync(process.cwd());
  const resolved = path.resolve(process.cwd(), inputPath);
  const real = fs.realpathSync(resolved);
  if (real !== repoRoot && !real.startsWith(`${repoRoot}${path.sep}`)) {
    throw codedError("E_INPUT_OUTSIDE_REPO", "--input must resolve inside the repository");
  }
  return real;
}

function readInput(inputPath) {
  return inputPath ? fs.readFileSync(repoInputPath(inputPath), "utf8") : fs.readFileSync(0, "utf8");
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
  if (objectStart >= 0 && objectEnd > objectStart) {
    const parsed = tryParseJson(trimmed.slice(objectStart, objectEnd + 1));
    if (parsed !== undefined) return parsed;
  }

  const arrayStart = trimmed.indexOf("[");
  const arrayEnd = trimmed.lastIndexOf("]");
  if (arrayStart >= 0 && arrayEnd > arrayStart) {
    return tryParseJson(trimmed.slice(arrayStart, arrayEnd + 1));
  }
  return undefined;
}

function parseRecords(input) {
  const wholeDocument = tryParseJson(input.trim());
  if (wholeDocument !== undefined) return { records: flattenRecords(wholeDocument), parseErrors: [] };

  const records = [];
  const parseErrors = [];
  input.split(/\r?\n/).forEach((line, index) => {
    if (!line.trim()) return;
    const parsed = extractJsonCandidate(line);
    if (parsed === undefined) {
      parseErrors.push({ line: index + 1, code: "E_PARSE" });
      return;
    }
    flattenRecords(parsed, records);
  });
  return { records, parseErrors };
}

function flattenRecords(value, records = []) {
  if (Array.isArray(value)) {
    value.forEach((entry) => flattenRecords(entry, records));
    return records;
  }
  if (value && typeof value === "object") {
    if (Array.isArray(value.records)) return flattenRecords(value.records, records);
    if (Array.isArray(value.runs)) return flattenRecords(value.runs, records);
    if (Array.isArray(value.receipts)) return flattenRecords(value.receipts, records);
    if (Array.isArray(value.samples)) return flattenRecords(value.samples, records);
    records.push(value);
  }
  return records;
}

function scanForSecrets(value, pathName, state) {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => scanForSecrets(entry, `${pathName}[${index}]`, state));
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, entry] of Object.entries(value)) {
      const nextPath = pathName ? `${pathName}.${key}` : key;
      if (SECRET_KEY.test(key)) state.secretPaths.add(nextPath);
      scanForSecrets(entry, nextPath, state);
    }
    return;
  }
  if (typeof value === "string" && SECRET_VALUE.test(value)) {
    state.secretPaths.add(pathName || "$");
  }
}

function sha256(value) {
  return `sha256:${crypto.createHash("sha256").update(String(value)).digest("hex")}`;
}

function shortHash(value) {
  return sha256(value).slice(0, 19);
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

function receiptIdFromContext(record, audit) {
  const value = firstValue(record, [
    ["receiptId"],
    ["receipt_id"],
    ["runReceipt", "receiptId"],
    ["RunReceipt", "receiptId"],
    ["journeyRunReceipt", "receiptId"],
    ["JourneyRunReceipt", "receiptId"],
    ["receipt", "receiptId"],
    ["payload", "receiptId"],
    ["payload", "runReceipt", "receiptId"],
    ["payload", "journeyRunReceipt", "receiptId"],
    ["result", "receiptId"],
    ["result", "receipt", "receiptId"],
  ]);
  return value === undefined ? hashAuditIdentity(audit) : String(value);
}

function hashAuditIdentity(audit) {
  return JSON.stringify({
    previousSnapshotId: audit.previousSnapshotId,
    nextSnapshotId: audit.nextSnapshotId,
    assets: Array.isArray(audit.assets) ? audit.assets.length : 0,
    findings: Array.isArray(audit.findings) ? audit.findings.length : 0,
  });
}

function looksLikeEconomyAudit(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  if (typeof value.ok !== "boolean") return false;
  return Array.isArray(value.assets)
    || Array.isArray(value.feeSplits)
    || Array.isArray(value.negativeInventories)
    || Array.isArray(value.duplicateSources)
    || Array.isArray(value.findings);
}

function findAudits(value, context, audits, seen, depth = 0) {
  if (!value || typeof value !== "object" || depth > 12) return audits;
  if (Array.isArray(value)) {
    value.forEach((entry) => findAudits(entry, context, audits, seen, depth + 1));
    return audits;
  }
  if (looksLikeEconomyAudit(value) && !seen.has(value)) {
    seen.add(value);
    audits.push({ audit: value, receiptId: receiptIdFromContext(context, value) });
  }
  for (const entry of Object.values(value)) {
    findAudits(entry, context, audits, seen, depth + 1);
  }
  return audits;
}

function parseMinorUnit(value) {
  if (typeof value === "bigint") return value;
  if (typeof value === "number" && Number.isSafeInteger(value)) return BigInt(value);
  if (typeof value === "string" && DECIMAL_INTEGER.test(value)) return BigInt(value);
  return undefined;
}

function absBigint(value) {
  return value < 0n ? -value : value;
}

function addBigintMetric(metrics, key, value) {
  metrics[key] = (parseMinorUnit(metrics[key]) || 0n) + value;
}

function findingCodes(audit) {
  if (!Array.isArray(audit.findings)) return [];
  return audit.findings
    .map((finding) => finding && typeof finding === "object" ? String(finding.code || "") : "")
    .filter(Boolean)
    .sort();
}

function countFinding(audit, codePattern) {
  return findingCodes(audit).filter((code) => codePattern.test(code)).length;
}

function summarizeAudit(entry, index) {
  const audit = entry.audit;
  const receiptHash = shortHash(entry.receiptId);
  const errors = [];
  const metrics = {
    assets: Array.isArray(audit.assets) ? audit.assets.length : 0,
    accountBalances: Array.isArray(audit.accountBalances) ? audit.accountBalances.length : 0,
    feeSplits: Array.isArray(audit.feeSplits) ? audit.feeSplits.length : 0,
    negativeInventories: Array.isArray(audit.negativeInventories) ? audit.negativeInventories.length : 0,
    duplicateSources: Array.isArray(audit.duplicateSources) ? audit.duplicateSources.length : 0,
    duplicateFlows: countFinding(audit, /DUPLICATE_FLOW_ID$/),
    unsupportedEvents: Number(firstValue(audit, [["unsupportedEventCount"], ["eventAdapter", "unsupportedEventCount"]]) || 0)
      + countFinding(audit, /EVENT_UNSUPPORTED$/),
    unexplainedDeltaMinorAbs: 0n,
    feeUnexplainedShareMinorAbs: 0n,
    accountMismatchMinorAbs: 0n,
  };

  if (audit.ok !== true) {
    errors.push(error("E_AUDIT_NOT_OK", index, receiptHash));
  }

  const assets = Array.isArray(audit.assets) ? audit.assets : [];
  const assetMetrics = assets.map((asset) => {
    const opening = parseMinorUnit(asset.openingTotalMinor) || 0n;
    const mint = parseMinorUnit(asset.systemMintMinor) || 0n;
    const burn = parseMinorUnit(asset.systemBurnMinor) || 0n;
    const closing = parseMinorUnit(asset.closingTotalMinor) || 0n;
    const expectedClosing = opening + mint - burn;
    const calculatedDelta = closing - expectedClosing;
    const reportedDelta = parseMinorUnit(asset.unexplainedDeltaMinor);
    const unexplainedDelta = reportedDelta === undefined ? calculatedDelta : reportedDelta;
    metrics.unexplainedDeltaMinorAbs += absBigint(unexplainedDelta);
    if (calculatedDelta !== 0n || unexplainedDelta !== 0n || asset.conserved === false) {
      errors.push(error("E_ASSET_DELTA", index, receiptHash, { assetHash: shortHash(`${asset.assetKey || ""}:${asset.unit || ""}`) }));
    }
    return {
      assetHash: shortHash(`${asset.assetKey || ""}:${asset.unit || ""}`),
      openingMinor: opening.toString(),
      mintMinor: mint.toString(),
      burnMinor: burn.toString(),
      closingMinor: closing.toString(),
      expectedClosingMinor: expectedClosing.toString(),
      unexplainedDeltaMinor: unexplainedDelta.toString(),
      conserved: calculatedDelta === 0n && unexplainedDelta === 0n && asset.conserved !== false,
    };
  }).sort((left, right) => left.assetHash.localeCompare(right.assetHash));

  const feeSplits = Array.isArray(audit.feeSplits) ? audit.feeSplits : [];
  feeSplits.forEach((split) => {
    const unexplained = parseMinorUnit(split.unexplainedShareMinor) || 0n;
    metrics.feeUnexplainedShareMinorAbs += absBigint(unexplained);
    if (unexplained !== 0n || split.balanced === false) {
      errors.push(error("E_FEE_SPLIT_DELTA", index, receiptHash));
    }
  });

  const balances = Array.isArray(audit.accountBalances) ? audit.accountBalances : [];
  balances.forEach((balance) => {
    const mismatch = parseMinorUnit(balance.mismatchMinor) || 0n;
    metrics.accountMismatchMinorAbs += absBigint(mismatch);
    if (mismatch !== 0n) {
      errors.push(error("E_UNEXPLAINED_DELTA", index, receiptHash));
    }
  });

  if (metrics.negativeInventories > 0) errors.push(error("E_NEGATIVE_INVENTORY", index, receiptHash));
  if (metrics.duplicateFlows > 0) errors.push(error("E_DUPLICATE_FLOW", index, receiptHash));
  if (metrics.duplicateSources > 0) errors.push(error("E_DUPLICATE_SOURCE", index, receiptHash));
  if (metrics.unsupportedEvents > 0) errors.push(error("E_UNSUPPORTED_EVENT", index, receiptHash));

  return {
    runIndex: index + 1,
    receiptIdHash: receiptHash,
    ok: errors.length === 0,
    metrics: stringifyBigintMetrics(metrics),
    assets: assetMetrics,
    errorCodes: unique(errors.map((entry) => entry.code)),
    errors,
  };
}

function error(code, runIndex, receiptHash, details = undefined) {
  return {
    code,
    ...(runIndex !== undefined ? { runIndex: runIndex + 1 } : {}),
    ...(receiptHash ? { receiptIdHash: receiptHash } : {}),
    ...(details ? { details } : {}),
  };
}

function unique(values) {
  return [...new Set(values)].sort();
}

function stringifyBigintMetrics(metrics) {
  const result = {};
  for (const [key, value] of Object.entries(metrics)) {
    result[key] = typeof value === "bigint" ? value.toString() : value;
  }
  return result;
}

function summarize(auditEntries, expectedRuns, parseErrors, secretPaths) {
  const runs = auditEntries.map((entry, index) => summarizeAudit(entry, index));
  const errors = [];
  if (parseErrors.length > 0) {
    errors.push(...parseErrors.slice(0, MAX_PARSE_ERRORS).map((entry) => ({ code: "E_PARSE", line: entry.line })));
  }
  if (secretPaths.size > 0) {
    errors.push({ code: "E_SECRET_INPUT", count: secretPaths.size });
  }
  if (auditEntries.length !== expectedRuns) {
    errors.push({ code: "E_EXPECTED_RUNS_MISMATCH", expectedRuns, actualRuns: auditEntries.length });
  }
  for (const run of runs) errors.push(...run.errors);

  const metrics = {
    expectedRuns,
    actualRuns: auditEntries.length,
    okRuns: runs.filter((run) => run.ok).length,
    failedRuns: runs.filter((run) => !run.ok).length,
    assets: sumNumber(runs, "assets"),
    accountBalances: sumNumber(runs, "accountBalances"),
    feeSplits: sumNumber(runs, "feeSplits"),
    negativeInventories: sumNumber(runs, "negativeInventories"),
    duplicateSources: sumNumber(runs, "duplicateSources"),
    duplicateFlows: sumNumber(runs, "duplicateFlows"),
    unsupportedEvents: sumNumber(runs, "unsupportedEvents"),
    unexplainedDeltaMinorAbs: sumBigintString(runs, "unexplainedDeltaMinorAbs"),
    feeUnexplainedShareMinorAbs: sumBigintString(runs, "feeUnexplainedShareMinorAbs"),
    accountMismatchMinorAbs: sumBigintString(runs, "accountMismatchMinorAbs"),
  };

  const limitedErrors = errors.slice(0, MAX_ERRORS).map((entry) => {
    const { code, runIndex, receiptIdHash, line, count, expectedRuns: expected, actualRuns, details } = entry;
    return {
      code,
      ...(runIndex !== undefined ? { runIndex } : {}),
      ...(receiptIdHash ? { receiptIdHash } : {}),
      ...(line !== undefined ? { line } : {}),
      ...(count !== undefined ? { count } : {}),
      ...(expected !== undefined ? { expectedRuns: expected } : {}),
      ...(actualRuns !== undefined ? { actualRuns } : {}),
      ...(details ? { details } : {}),
    };
  });

  return {
    schemaVersion: SCHEMA_VERSION,
    ok: errors.length === 0,
    metrics,
    receiptIdHashes: runs.map((run) => run.receiptIdHash).sort(),
    runs: runs.map(({ errors: _errors, ...run }) => run),
    errorCodes: unique(errors.map((entry) => entry.code)),
    errors: limitedErrors,
    truncatedErrors: Math.max(0, errors.length - limitedErrors.length),
    secretPathCount: secretPaths.size > 0 ? Math.min(secretPaths.size, MAX_SECRET_PATHS) : 0,
  };
}

function sumNumber(runs, metric) {
  return runs.reduce((sum, run) => sum + Number(run.metrics[metric] || 0), 0);
}

function sumBigintString(runs, metric) {
  return runs.reduce((sum, run) => sum + (parseMinorUnit(run.metrics[metric]) || 0n), 0n).toString();
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
    const input = readInput(options.inputPath);
    const { records, parseErrors } = parseRecords(input);
    const secretState = { secretPaths: new Set() };
    records.forEach((record, index) => scanForSecrets(record, `records[${index}]`, secretState));
    const audits = [];
    const seen = new WeakSet();
    records.forEach((record) => findAudits(record, record, audits, seen));
    printAndExit(summarize(audits, options.expectedRuns, parseErrors, secretState.secretPaths));
  } catch (errorValue) {
    const code = errorValue && typeof errorValue === "object" && errorValue.code ? String(errorValue.code) : "E_RUNTIME";
    printAndExit({
      schemaVersion: SCHEMA_VERSION,
      ok: false,
      metrics: { expectedRuns: options?.expectedRuns ?? null, actualRuns: 0 },
      receiptIdHashes: [],
      runs: [],
      errorCodes: [code],
      errors: [{ code }],
      truncatedErrors: 0,
      secretPathCount: 0,
    });
  }
}

main();
