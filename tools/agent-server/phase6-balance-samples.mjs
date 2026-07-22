#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCHEMA_VERSION = "obsidian-epoch.phase6-balance-samples.v1";
const SECRET_KEY = /(?:secret|token|api[-_]?key|authorization|password|credential|private[-_]?key|access[-_]?key|refresh[-_]?token|session[-_]?key|recovery[-_]?code|operator[-_]?key)/i;
const SECRET_VALUE = /\b(?:sk-[A-Za-z0-9_-]{12,}|Bearer\s+[A-Za-z0-9._-]{12,}|xox[baprs]-[A-Za-z0-9-]{12,}|AKIA[0-9A-Z]{16})\b/i;

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "../..");

function usage() {
  return [
    "Usage: node tools/agent-server/phase6-balance-samples.mjs --input <repo-json-or-jsonl-path> --output <repo-jsonl-path>",
    "",
    "Converts strict JourneyRunReceipt balance sample JSON/JSONL into JSONL accepted by phase6-balance-gate.mjs.",
    "Input and output paths must resolve inside the repository. Output refuses non-empty files.",
  ].join("\n");
}

function printJson(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function parseArguments(argv) {
  const options = { inputPath: undefined, outputPath: undefined, help: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help" || argument === "-h") {
      options.help = true;
      continue;
    }
    if (argument === "--input") {
      const value = argv[index + 1];
      if (!value) throw new Error("--input requires a repository-contained path");
      options.inputPath = value;
      index += 1;
      continue;
    }
    if (argument === "--output") {
      const value = argv[index + 1];
      if (!value) throw new Error("--output requires a repository-contained path");
      options.outputPath = value;
      index += 1;
      continue;
    }
    throw new Error(`unknown_argument:${argument}`);
  }
  if (!options.help) {
    if (!options.inputPath) throw new Error("--input is required");
    if (!options.outputPath) throw new Error("--output is required");
  }
  return options;
}

function assertInsideRepository(resolvedPath, label) {
  const relative = path.relative(repositoryRoot, resolvedPath);
  if (relative === "" || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`${label}_outside_repository`);
  }
}

function resolveInputPath(candidate) {
  const lexical = path.resolve(process.cwd(), candidate);
  assertInsideRepository(lexical, "input");
  let real;
  try {
    real = fs.realpathSync(lexical);
  } catch {
    throw new Error("input_not_found");
  }
  assertInsideRepository(real, "input_symlink");
  const stat = fs.statSync(real);
  if (!stat.isFile()) throw new Error("input_not_file");
  return real;
}

function resolveOutputPath(candidate) {
  const lexical = path.resolve(process.cwd(), candidate);
  assertInsideRepository(lexical, "output");

  const parent = path.dirname(lexical);
  let realParent;
  try {
    realParent = fs.realpathSync(parent);
  } catch {
    const nearestExistingParent = nearestExistingDirectory(parent);
    realParent = fs.realpathSync(nearestExistingParent);
  }
  assertInsideRepository(realParent, "output_parent_symlink");
  return lexical;
}

function nearestExistingDirectory(directory) {
  let current = directory;
  while (!fs.existsSync(current)) {
    const next = path.dirname(current);
    if (next === current) throw new Error("output_parent_not_found");
    current = next;
  }
  const stat = fs.statSync(current);
  if (!stat.isDirectory()) throw new Error("output_parent_not_directory");
  return current;
}

function ensureWritableOutput(outputPath) {
  const parent = path.dirname(outputPath);
  fs.mkdirSync(parent, { recursive: true });

  if (!fs.existsSync(outputPath)) return;

  const linkStat = fs.lstatSync(outputPath);
  if (linkStat.isSymbolicLink()) throw new Error("output_symlink_refused");
  if (!linkStat.isFile()) throw new Error("output_not_file");
  if (linkStat.size > 0) throw new Error("output_refuses_non_empty_file");
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
    for (const entry of value) flattenRecords(entry, records);
    return records;
  }
  if (value && typeof value === "object") {
    if (Array.isArray(value.receipts)) return flattenRecords(value.receipts, records);
    if (Array.isArray(value.runs)) return flattenRecords(value.runs, records);
    if (Array.isArray(value.samples)) return flattenRecords(value.samples, records);
    records.push(value);
  }
  return records;
}

function parseRecords(input) {
  const document = tryParseJson(input.trim());
  if (document !== undefined) return { records: flattenRecords(document), parseErrors: [] };

  const records = [];
  const parseErrors = [];
  input.split(/\r?\n/).forEach((line, index) => {
    if (!line.trim()) return;
    const parsed = tryParseJson(line);
    if (parsed === undefined) {
      parseErrors.push({ line: index + 1, reason: "not_json" });
      return;
    }
    flattenRecords(parsed, records);
  });
  return { records, parseErrors };
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function scanForSecrets(value, pathName, findings) {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => scanForSecrets(entry, `${pathName}[${index}]`, findings));
    return;
  }
  if (isRecord(value)) {
    for (const [key, entry] of Object.entries(value)) {
      const nextPath = pathName ? `${pathName}.${key}` : key;
      if (SECRET_KEY.test(key)) findings.push(nextPath);
      scanForSecrets(entry, nextPath, findings);
    }
    return;
  }
  if (typeof value === "string" && SECRET_VALUE.test(value)) findings.push(pathName || "$");
}

function candidateReceipt(record) {
  if (record.receiptType === "journey_run_receipt") return record;
  for (const key of ["journeyRunReceipt", "JourneyRunReceipt", "runReceipt", "RunReceipt", "receipt"]) {
    if (isRecord(record[key]) && record[key].receiptType === "journey_run_receipt") return record[key];
  }
  if (typeof record.receipt_json === "string") {
    const parsed = tryParseJson(record.receipt_json);
    if (isRecord(parsed) && parsed.receiptType === "journey_run_receipt") return parsed;
  }
  return record;
}

function sampleContainer(record, receipt) {
  if (isRecord(record.balanceSample)) return record.balanceSample;
  if (isRecord(record.sample)) return record.sample;
  if (isRecord(record.balance)) return record.balance;
  if (isRecord(receipt.balanceSample)) return receipt.balanceSample;
  if (isRecord(receipt.sample)) return receipt.sample;
  if (isRecord(receipt.balance)) return receipt.balance;
  return record;
}

function requireOwn(container, key, label, errors) {
  if (!isRecord(container) || !Object.prototype.hasOwnProperty.call(container, key)) {
    errors.push(`${label}.${key}:missing`);
    return undefined;
  }
  return container[key];
}

function requireNumber(container, key, label, errors) {
  const value = requireOwn(container, key, label, errors);
  if (typeof value !== "number" || !Number.isFinite(value)) {
    if (value !== undefined) errors.push(`${label}.${key}:number_required`);
    return undefined;
  }
  return value;
}

function requireString(container, key, label, errors) {
  const value = requireOwn(container, key, label, errors);
  if (typeof value !== "string" || value.length === 0) {
    if (value !== undefined) errors.push(`${label}.${key}:string_required`);
    return undefined;
  }
  return value;
}

function requireBoolean(container, key, label, errors) {
  const value = requireOwn(container, key, label, errors);
  if (typeof value !== "boolean") {
    if (value !== undefined) errors.push(`${label}.${key}:boolean_required`);
    return undefined;
  }
  return value;
}

function requireNumberMap(container, key, label, errors) {
  const value = requireOwn(container, key, label, errors);
  if (!isRecord(value)) {
    if (value !== undefined) errors.push(`${label}.${key}:object_required`);
    return undefined;
  }

  const result = {};
  for (const [entryKey, entryValue] of Object.entries(value)) {
    if (typeof entryValue !== "number" || !Number.isFinite(entryValue)) {
      errors.push(`${label}.${key}.${entryKey}:number_required`);
      continue;
    }
    result[entryKey] = entryValue;
  }
  if (Object.keys(result).length === 0) errors.push(`${label}.${key}:non_empty_object_required`);
  return result;
}

function optionalTraceString(containers, key) {
  for (const container of containers) {
    if (!isRecord(container) || !Object.prototype.hasOwnProperty.call(container, key)) continue;
    const value = container[key];
    if (typeof value === "string" && value.length > 0) return value;
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return undefined;
}

function optionalTraceRunIndex(containers) {
  for (const container of containers) {
    if (!isRecord(container) || !Object.prototype.hasOwnProperty.call(container, "runIndex")) continue;
    const value = container.runIndex;
    if (Number.isInteger(value)) return value;
  }
  return undefined;
}

function convertRecord(record, index) {
  const errors = [];
  const receipt = candidateReceipt(record);
  const sample = sampleContainer(record, receipt);
  const label = `records[${index}]`;

  const resources = requireOwn(sample, "resources", label, errors);
  if (!isRecord(resources)) {
    if (resources !== undefined) errors.push(`${label}.resources:object_required`);
  }

  const output = {
    score: requireNumber(sample, "score", label, errors),
    intensity: requireNumber(sample, "intensity", label, errors),
    suitabilityBand: requireString(sample, "suitabilityBand", label, errors),
    build: requireString(sample, "build", label, errors),
    scenario: requireString(sample, "scenario", label, errors),
    success: requireBoolean(sample, "success", label, errors),
    cost: requireNumber(sample, "cost", label, errors),
    injury: requireNumber(sample, "injury", label, errors),
    resources: {
      before: requireNumberMap(resources, "before", `${label}.resources`, errors),
      after: requireNumberMap(resources, "after", `${label}.resources`, errors),
      delta: requireNumberMap(resources, "delta", `${label}.resources`, errors),
      gain: requireNumberMap(resources, "gain", `${label}.resources`, errors),
      cost: requireNumberMap(resources, "cost", `${label}.resources`, errors),
    },
  };

  const traceContainers = [record, sample, receipt];
  const receiptId = optionalTraceString(traceContainers, "receiptId");
  const experimentId = optionalTraceString(traceContainers, "experimentId");
  const runIndex = optionalTraceRunIndex(traceContainers);
  if (receiptId !== undefined) output.receiptId = receiptId;
  if (experimentId !== undefined) output.experimentId = experimentId;
  if (runIndex !== undefined) output.runIndex = runIndex;

  return { output, errors };
}

function main() {
  try {
    const options = parseArguments(process.argv.slice(2));
    if (options.help) {
      printJson({ schemaVersion: SCHEMA_VERSION, usage: usage().split("\n") });
      return;
    }

    const inputPath = resolveInputPath(options.inputPath);
    const outputPath = resolveOutputPath(options.outputPath);
    if (inputPath === outputPath) throw new Error("input_output_must_differ");
    ensureWritableOutput(outputPath);

    const input = fs.readFileSync(inputPath, "utf8");
    const parsed = parseRecords(input);
    const secretPaths = [];
    parsed.records.forEach((record, index) => scanForSecrets(record, `records[${index}]`, secretPaths));

    const converted = parsed.records.map((record, index) => convertRecord(record, index));
    const schemaErrors = converted.flatMap((entry) => entry.errors);

    if (parsed.parseErrors.length > 0 || secretPaths.length > 0 || schemaErrors.length > 0) {
      printJson({
        schemaVersion: SCHEMA_VERSION,
        passed: false,
        input: { records: parsed.records.length },
        errors: {
          parseErrors: parsed.parseErrors.slice(0, 20),
          secretPathCount: secretPaths.length,
          secretPaths: secretPaths.slice(0, 20),
          schemaErrorCount: schemaErrors.length,
          schemaErrors: schemaErrors.slice(0, 50),
        },
      });
      process.exitCode = 1;
      return;
    }

    const jsonl = converted.map((entry) => JSON.stringify(entry.output)).join("\n");
    fs.writeFileSync(outputPath, jsonl.length > 0 ? `${jsonl}\n` : "", { encoding: "utf8" });
    printJson({
      schemaVersion: SCHEMA_VERSION,
      passed: true,
      input: { records: parsed.records.length },
      output: { path: path.relative(repositoryRoot, outputPath), records: converted.length },
    });
  } catch (error) {
    printJson({
      schemaVersion: SCHEMA_VERSION,
      passed: false,
      error: error instanceof Error ? error.message : "unknown_error",
    });
    process.exitCode = 1;
  }
}

main();
