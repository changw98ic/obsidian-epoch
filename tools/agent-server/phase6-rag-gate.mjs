#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { inspectPhase6RagGateEvidence } from "./lib/epoch/phase6RagGateEvidence.mjs";

const SCHEMA_VERSION = "obsidian-epoch.phase6-rag-gate.v2";
const KEY_FACT_RECALL_MIN = 0.95;
const ROUTE_PRECISION_MIN = 0.9;
const TRACEABILITY_REQUIRED = 1;
const IMPORTANT_MEMORY_MIN_PER_RUN = 0;
const IMPORTANT_MEMORY_MAX_PER_RUN = 3;
const MAX_PARSE_FAILURE_HASHES = 20;
const MAX_FAILURE_HASHES = 50;
const SECRET_KEY = /(?:secret|token|api[-_]?key|authorization|password|credential|private[-_]?key|access[-_]?key|refresh[-_]?token|session[-_]?key|client[-_]?secret|recovery[-_]?code)/i;
const SECRET_VALUE = /(?:\b(?:sk-[A-Za-z0-9_-]{12,}|Bearer\s+[A-Za-z0-9._~+/=-]{12,}|xox[baprs]-[A-Za-z0-9-]{12,}|AKIA[0-9A-Z]{16})\b|-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----)/i;

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "../..");

function usage() {
  return [
    "Usage: node tools/agent-server/phase6-rag-gate.mjs --query-evaluations <path> [--query-evaluations <path> ...] --run-receipts <path> [--run-receipts <path> ...]",
    "",
    "Reads repository-relative machine JSON/JSONL query evaluations and RunReceipt RAG deltas.",
    "Prints only counts, metrics, and failure ID hashes. Exits non-zero when any gate fails.",
  ].join("\n");
}

function parseArguments(argv) {
  const options = { queryEvaluationPaths: [], runReceiptPaths: [], help: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help" || argument === "-h") {
      options.help = true;
      continue;
    }
    if (argument === "--query-evaluations" || argument === "--query-evaluation") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error(`${argument} requires a repository-relative path`);
      }
      options.queryEvaluationPaths.push(value);
      index += 1;
      continue;
    }
    if (argument === "--run-receipts" || argument === "--run-receipt") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error(`${argument} requires a repository-relative path`);
      }
      options.runReceiptPaths.push(value);
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${argument}`);
  }
  if (!options.help && options.queryEvaluationPaths.length === 0) {
    throw new Error("--query-evaluations is required");
  }
  if (!options.help && options.runReceiptPaths.length === 0) {
    throw new Error("--run-receipts is required");
  }
  return options;
}

function printJson(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function hashId(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex").slice(0, 16);
}

function stableHash(value) {
  return hashId(JSON.stringify(value));
}

function isRepositoryRelative(candidate) {
  if (typeof candidate !== "string" || candidate.length === 0 || path.isAbsolute(candidate)) {
    return false;
  }
  const normalized = path.normalize(candidate);
  return normalized !== ".." && !normalized.startsWith(`..${path.sep}`);
}

function ensureInsideRepository(realPath, repositoryRealPath) {
  const relative = path.relative(repositoryRealPath, realPath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function readRepositoryFile(inputPath, repositoryRealPath) {
  if (!isRepositoryRelative(inputPath)) {
    throw new Error(`Input path must be repository-relative: ${hashId(inputPath)}`);
  }
  const absolutePath = path.resolve(repositoryRoot, inputPath);
  const realPath = fs.realpathSync(absolutePath);
  if (!ensureInsideRepository(realPath, repositoryRealPath)) {
    throw new Error(`Input path resolves outside repository: ${hashId(inputPath)}`);
  }
  const stat = fs.statSync(realPath);
  if (!stat.isFile()) {
    throw new Error(`Input path is not a file: ${hashId(inputPath)}`);
  }
  return fs.readFileSync(realPath, "utf8");
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
    return tryParseJson(trimmed.slice(objectStart, objectEnd + 1));
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
    value.forEach((entry) => flattenRecords(entry, records));
    return records;
  }
  if (!value || typeof value !== "object") {
    return records;
  }
  const nestedReceipt = value.runReceipt ?? value.run_receipt;
  const canonicalReceipt = value.version === "journey_run_receipt.v2"
    || (nestedReceipt && typeof nestedReceipt === "object" && nestedReceipt.version === "journey_run_receipt.v2");
  if (canonicalReceipt) {
    records.push(value);
    return records;
  }
  for (const key of ["queryEvaluations", "query_evaluations", "evaluations", "samples", "records", "runs", "runReceipts", "run_receipts", "receipts", "deltas"]) {
    if (Array.isArray(value[key])) {
      flattenRecords(value[key], records);
      return records;
    }
  }
  records.push(value);
  return records;
}

function parseRecords(input, sourceKind, sourceIndex) {
  const wholeDocument = tryParseJson(input.trim());
  if (wholeDocument !== undefined) {
    return { records: flattenRecords(wholeDocument), parseErrors: [] };
  }

  const records = [];
  const parseErrors = [];
  input.split(/\r?\n/).forEach((line, index) => {
    if (!line.trim()) {
      return;
    }
    const parsed = extractJsonCandidate(line);
    if (parsed === undefined) {
      parseErrors.push({ failureIdHash: hashId(`${sourceKind}:${sourceIndex}:${index + 1}`) });
      return;
    }
    flattenRecords(parsed, records);
  });
  return { records, parseErrors };
}

function getPath(value, segments) {
  let current = value;
  for (const segment of segments) {
    if (!current || typeof current !== "object" || !(segment in current)) {
      return undefined;
    }
    current = current[segment];
  }
  return current;
}

function firstValue(record, paths) {
  for (const candidatePath of paths) {
    const value = getPath(record, candidatePath);
    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }
  return undefined;
}

function numberValue(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return undefined;
}

function booleanValue(value) {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return value !== 0;
  }
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.trim().toLowerCase();
  if (["true", "pass", "passed", "ok", "success", "succeeded", "1"].includes(normalized)) {
    return true;
  }
  if (["false", "fail", "failed", "error", "0"].includes(normalized)) {
    return false;
  }
  return undefined;
}

function stringValue(value) {
  return value === undefined || value === null || value === "" ? undefined : String(value);
}

function idFor(record, fallback) {
  return stringValue(firstValue(record, [
    ["id"],
    ["evaluationId"],
    ["evaluation_id"],
    ["queryId"],
    ["query_id"],
    ["runId"],
    ["run_id"],
    ["runIndex"],
    ["run_index"],
    ["runTicket"],
    ["run_ticket"],
    ["RunReceipt", "runId"],
    ["runReceipt", "runId"],
    ["payload", "id"],
    ["payload", "runId"],
    ["payload", "runIndex"],
    ["payload", "runReceipt", "runId"],
  ])) || fallback;
}

function eventName(record) {
  return [
    firstValue(record, [["type"], ["eventType"], ["event_type"], ["kind"], ["name"], ["metric"], ["metricName"], ["metric_name"], ["gate"], ["payload", "type"], ["payload", "metric"]]),
    firstValue(record, [["category"], ["evaluationType"], ["evaluation_type"], ["queryType"], ["query_type"], ["payload", "category"]]),
  ].filter(Boolean).map(String).join(" ");
}

function arrayLength(value) {
  if (Array.isArray(value)) {
    return value.length;
  }
  return undefined;
}

function explicitRatio(record, paths) {
  const value = numberValue(firstValue(record, paths));
  if (value === undefined) {
    return undefined;
  }
  return value > 1 ? value / 100 : value;
}

function ratioFromCounts(record, numeratorPaths, denominatorPaths) {
  const numerator = numberValue(firstValue(record, numeratorPaths));
  const denominator = numberValue(firstValue(record, denominatorPaths));
  if (numerator !== undefined && denominator !== undefined) {
    return { numerator, denominator };
  }
  return undefined;
}

function extractRecallSample(record, fallback) {
  const name = eventName(record);
  const explicitKind = /recent[_ -]?key[_ -]?fact[_ -]?recall|key[_ -]?fact[_ -]?recall/i.test(name);
  const hasRecallFields = firstValue(record, [["recall"], ["metrics", "recall"], ["result", "recall"], ["payload", "recall"]]) !== undefined;
  const isRecentKeyFact = /recent/i.test(name) && /key[_ -]?fact|critical[_ -]?fact|important[_ -]?fact/i.test(name);
  if (!explicitKind && !(isRecentKeyFact && hasRecallFields)) {
    return undefined;
  }
  const counts = ratioFromCounts(record, [
    ["recalled"],
    ["recalledCount"],
    ["recalled_count"],
    ["matched"],
    ["matchedCount"],
    ["truePositive"],
    ["true_positive"],
    ["metrics", "recalled"],
    ["payload", "recalledCount"],
  ], [
    ["expected"],
    ["expectedCount"],
    ["expected_count"],
    ["total"],
    ["totalCount"],
    ["relevant"],
    ["relevantCount"],
    ["metrics", "expected"],
    ["payload", "expectedCount"],
  ]);
  if (counts) {
    return { id: idFor(record, fallback), numerator: counts.numerator, denominator: counts.denominator };
  }
  const expectedLength = arrayLength(firstValue(record, [["expectedFactIds"], ["expected_fact_ids"], ["expectedFacts"], ["expected_facts"], ["payload", "expectedFactIds"]]));
  const recalledLength = arrayLength(firstValue(record, [["recalledFactIds"], ["recalled_fact_ids"], ["recalledFacts"], ["recalled_facts"], ["matchedFactIds"], ["payload", "recalledFactIds"]]));
  if (expectedLength !== undefined && recalledLength !== undefined) {
    return { id: idFor(record, fallback), numerator: recalledLength, denominator: expectedLength };
  }
  const value = explicitRatio(record, [["recall"], ["keyFactRecall"], ["key_fact_recall"], ["metrics", "recall"], ["result", "recall"], ["payload", "recall"]]);
  if (value !== undefined) {
    return { id: idFor(record, fallback), value };
  }
  return { id: idFor(record, fallback), missing: true };
}

function extractPrecisionSample(record, fallback) {
  const name = eventName(record);
  const explicitKind = /route[_ -]?summary[_ -]?precision|route[_ -]?precision/i.test(name);
  const hasPrecisionFields = firstValue(record, [["precision"], ["metrics", "precision"], ["result", "precision"], ["payload", "precision"]]) !== undefined;
  if (!explicitKind && !(/route/i.test(name) && /summary/i.test(name) && hasPrecisionFields)) {
    return undefined;
  }
  const counts = ratioFromCounts(record, [
    ["correct"],
    ["correctCount"],
    ["correct_count"],
    ["supported"],
    ["supportedCount"],
    ["truePositive"],
    ["true_positive"],
    ["metrics", "correct"],
    ["payload", "correctCount"],
  ], [
    ["returned"],
    ["returnedCount"],
    ["returned_count"],
    ["claimed"],
    ["claimCount"],
    ["summaryFactCount"],
    ["summary_fact_count"],
    ["total"],
    ["totalCount"],
    ["metrics", "returned"],
    ["payload", "returnedCount"],
  ]);
  if (counts) {
    return { id: idFor(record, fallback), numerator: counts.numerator, denominator: counts.denominator };
  }
  const value = explicitRatio(record, [["precision"], ["routePrecision"], ["route_summary_precision"], ["metrics", "precision"], ["result", "precision"], ["payload", "precision"]]);
  if (value !== undefined) {
    return { id: idFor(record, fallback), value };
  }
  return { id: idFor(record, fallback), missing: true };
}

function scanSecrets(value, state) {
  if (Array.isArray(value)) {
    value.forEach((entry) => scanSecrets(entry, state));
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, entry] of Object.entries(value)) {
      if (SECRET_KEY.test(key)) {
        state.secretFindings += 1;
      }
      scanSecrets(entry, state);
    }
    return;
  }
  if (typeof value === "string" && SECRET_VALUE.test(value)) {
    state.secretFindings += 1;
  }
}

function scanAuthority(value, state, fallback) {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => scanAuthority(entry, state, `${fallback}:${index}`));
    return;
  }
  if (!value || typeof value !== "object") {
    return;
  }
  const name = eventName(value);
  const action = stringValue(firstValue(value, [["action"], ["operation"], ["op"], ["mutation"], ["payload", "action"], ["payload", "operation"]])) || "";
  const recordText = `${name} ${action}`;
  const authorityWrite = firstValue(value, [["authorityWrite"], ["authority_write"], ["payload", "authorityWrite"]]);
  const canonicalOverride = firstValue(value, [["overrideCanonical"], ["override_canonical"], ["canonicalOverride"], ["canonical_override"], ["payload", "overrideCanonical"]]);
  const isForbidden = booleanValue(authorityWrite) === true
    || booleanValue(canonicalOverride) === true
    || /authority[_ -]?write/i.test(recordText)
    || /override[_ -]?canonical|canonical[_ -]?override/i.test(recordText);
  if (isForbidden) {
    state.authorityOverwriteCount += 1;
    state.authorityOverwriteHashes.push(hashId(idFor(value, fallback)));
  }
  for (const [key, entry] of Object.entries(value)) {
    if (entry && typeof entry === "object") {
      scanAuthority(entry, state, `${fallback}:${key}`);
    }
  }
}

function extractReceipt(record) {
  return firstValue(record, [
    ["RunReceipt"],
    ["runReceipt"],
    ["run_receipt"],
    ["receipt", "RunReceipt"],
    ["receipt", "runReceipt"],
    ["payload", "RunReceipt"],
    ["payload", "runReceipt"],
  ]) || record;
}

function extractDeltas(record) {
  const receipt = extractReceipt(record);
  const value = firstValue(receipt, [
    ["ragDelta"],
    ["rag_delta"],
    ["ragDeltas"],
    ["rag_deltas"],
    ["rag", "delta"],
    ["rag", "deltas"],
    ["memoryDelta"],
    ["memory_delta"],
    ["knowledgeDelta"],
    ["knowledge_delta"],
    ["worldDelta"],
    ["world_delta"],
    ["payload", "ragDelta"],
  ]);
  if (Array.isArray(value)) {
    return value;
  }
  if (value && typeof value === "object") {
    for (const key of ["entries", "items", "events", "memories", "routes", "nodes", "deltas"]) {
      if (Array.isArray(value[key])) {
        return value[key];
      }
    }
    return [value];
  }
  return [];
}

function extractRunIndex(record, fallbackIndex) {
  const value = firstValue(record, [
    ["runIndex"],
    ["run_index"],
    ["RunReceipt", "runIndex"],
    ["runReceipt", "runIndex"],
    ["receipt", "runIndex"],
    ["payload", "runIndex"],
    ["payload", "runReceipt", "runIndex"],
  ]);
  const numeric = numberValue(value);
  return numeric !== undefined ? String(numeric) : stringValue(value) || `record-${fallbackIndex}`;
}

function isPersistentMemoryDelta(delta) {
  const text = [
    firstValue(delta, [["type"], ["kind"], ["eventType"], ["event_type"], ["category"], ["target"], ["entityType"], ["entity_type"]]),
    firstValue(delta, [["persistence"], ["persistenceType"], ["memoryType"], ["memory_type"], ["channel"]]),
  ].filter(Boolean).map(String).join(" ");
  return /persistent|persisted|solidified|memory/i.test(text)
    || booleanValue(firstValue(delta, [["persistent"], ["persisted"], ["solidified"]])) === true
    || firstValue(delta, [["memoryId"], ["memory_id"], ["payload", "memoryId"]]) !== undefined;
}

function isImportantMemory(delta) {
  const importance = stringValue(firstValue(delta, [["importance"], ["salience"], ["priority"], ["memoryImportance"], ["memory_importance"], ["payload", "importance"]]));
  const salienceScore = numberValue(firstValue(delta, [["salienceScore"], ["salience_score"], ["score"], ["payload", "salienceScore"]]));
  return /important|high|critical|major|salient|medium/i.test(importance || "") || (salienceScore !== undefined && salienceScore >= 70);
}

function hasEventTrace(delta) {
  const ids = firstValue(delta, [
    ["sourceEventIds"],
    ["source_event_ids"],
    ["eventIds"],
    ["event_ids"],
    ["sourceEvents"],
    ["source_events"],
    ["evidenceEventIds"],
    ["evidence_event_ids"],
    ["payload", "sourceEventIds"],
  ]);
  if (Array.isArray(ids)) {
    return ids.length > 0;
  }
  return typeof ids === "string" && ids.trim().length > 0;
}

function extractExplicitNumber(record, paths) {
  return numberValue(firstValue(record, paths));
}

function extractOptionalRatioMetric(record, names, countPaths) {
  const haystack = eventName(record);
  const matchesName = names.some((pattern) => pattern.test(haystack));
  const explicit = extractExplicitNumber(record, [["value"], ["rate"], ["ratio"], ["metricValue"], ["metric_value"], ["metrics", "value"], ["payload", "value"]]);
  const hasCounts = countPaths && (
    firstValue(record, countPaths.numerator) !== undefined || firstValue(record, countPaths.denominator) !== undefined
  );
  if (!matchesName && !hasCounts) {
    return undefined;
  }
  if (hasCounts) {
    const counts = ratioFromCounts(record, countPaths.numerator, countPaths.denominator);
    if (counts) {
      return { numerator: counts.numerator, denominator: counts.denominator };
    }
  }
  if (explicit !== undefined) {
    return { value: explicit > 1 ? explicit / 100 : explicit };
  }
  return { missing: true };
}

function summarizeRatioSamples(samples) {
  if (samples.length === 0) {
    return { sampleCount: 0, numerator: 0, denominator: 0, value: null };
  }
  const counted = samples.filter((sample) => sample.numerator !== undefined && sample.denominator !== undefined);
  if (counted.length > 0) {
    const numerator = counted.reduce((sum, sample) => sum + sample.numerator, 0);
    const denominator = counted.reduce((sum, sample) => sum + sample.denominator, 0);
    return { sampleCount: samples.length, numerator, denominator, value: denominator > 0 ? numerator / denominator : null };
  }
  const valued = samples.filter((sample) => sample.value !== undefined);
  const value = valued.length > 0 ? valued.reduce((sum, sample) => sum + sample.value, 0) / valued.length : null;
  return { sampleCount: samples.length, numerator: null, denominator: null, value };
}

function numericStats(values) {
  if (values.length === 0) {
    return { count: 0, min: null, mean: null, max: null };
  }
  const sorted = [...values].sort((left, right) => left - right);
  return {
    count: sorted.length,
    min: sorted[0],
    mean: sorted.reduce((sum, value) => sum + value, 0) / sorted.length,
    max: sorted[sorted.length - 1],
  };
}

function gateFailure(gate, expected, actual, ids = []) {
  return {
    gate,
    expected,
    actual,
    failureIdHashes: ids.map(hashId).slice(0, MAX_FAILURE_HASHES),
  };
}

function buildReport(queryRecords, receiptRecords, parseErrors) {
  const failures = [];
  const secretState = { secretFindings: 0 };
  const authorityState = { authorityOverwriteCount: 0, authorityOverwriteHashes: [] };

  [...queryRecords, ...receiptRecords].forEach((record, index) => {
    scanSecrets(record, secretState);
    scanAuthority(record, authorityState, `record:${index}`);
  });

  const recallSamples = [];
  const precisionSamples = [];
  const malformedEvaluationIds = [];
  const classifiedEvaluationRuns = new Set();
  const evaluatedBindings = [];
  let authoritativeEvaluationCount = 0;
  let legitimateNoRetrievalCount = 0;
  queryRecords.forEach((record, index) => {
    const inspected = inspectPhase6RagGateEvidence(record);
    const id = inspected.traceHash || idFor(record, `query:${index}`);
    if (inspected.classification === "invalid") {
      malformedEvaluationIds.push(id);
      return;
    }
    if (inspected.binding) {
      classifiedEvaluationRuns.add(String(inspected.binding.runIndex));
      evaluatedBindings.push(inspected.binding);
    }
    if (inspected.classification === "legitimate_no_retrieval") {
      legitimateNoRetrievalCount += 1;
      return;
    }
    authoritativeEvaluationCount += 1;
    recallSamples.push({ id, ...inspected.recall });
    precisionSamples.push({ id, ...inspected.precision });
  });

  const recall = summarizeRatioSamples(recallSamples.filter((sample) => !sample.missing));
  const precision = summarizeRatioSamples(precisionSamples.filter((sample) => !sample.missing));

  const importantMemoryCountsByRun = new Map();
  const receiptRunIds = new Set();
  let persistentMemoryEvents = 0;
  let tracedPersistentMemoryEvents = 0;
  const untracedMemoryIds = [];
  const duplicateRouteSamples = [];
  const ordinaryNodeExpansionSamples = [];
  const malformedReceiptIds = [];
  const receiptBindingsByRun = new Map();

  receiptRecords.forEach((record, index) => {
    const receipt = extractReceipt(record);
    const runIndex = extractRunIndex(record, index);
    receiptRunIds.add(runIndex);
    receiptBindingsByRun.set(runIndex, {
      runId: stringValue(firstValue(receipt, [["runId"], ["run_id"]])),
      journeyId: stringValue(firstValue(receipt, [["journeyId"], ["journey_id"]])),
    });

    const explicitImportant = extractExplicitNumber(receipt, [
      ["importantMemoryCount"],
      ["important_memory_count"],
      ["salientMemoryCount"],
      ["salient_memory_count"],
      ["persistentImportantMemoryCount"],
      ["persistent_important_memory_count"],
      ["rag", "importantMemoryCount"],
      ["metrics", "importantMemoryCount"],
    ]);
    if (explicitImportant !== undefined) {
      importantMemoryCountsByRun.set(runIndex, explicitImportant);
    }

    const dedupMetric = extractOptionalRatioMetric(receipt, [/duplicate[_ -]?route[_ -]?dedup/i, /route[_ -]?dedup/i], {
      numerator: [["dedupedRoutes"], ["dedupedRouteCount"], ["deduped_route_count"], ["routesDeduped"], ["rag", "dedupedRoutes"], ["metrics", "dedupedRoutes"]],
      denominator: [["duplicateRoutes"], ["duplicateRouteCount"], ["duplicate_route_count"], ["routesDuplicate"], ["rag", "duplicateRoutes"], ["metrics", "duplicateRoutes"]],
    });
    if (dedupMetric) {
      duplicateRouteSamples.push(dedupMetric);
      if (dedupMetric.missing) {
        malformedReceiptIds.push(idFor(receipt, `receipt:${index}:dedup`));
      }
    }

    const expansion = extractExplicitNumber(receipt, [
      ["ordinaryNodePersistenceExpansion"],
      ["ordinary_node_persistence_expansion"],
      ["ordinaryNodeExpansion"],
      ["ordinary_node_expansion"],
      ["nodePersistenceExpansion"],
      ["node_persistence_expansion"],
      ["rag", "ordinaryNodePersistenceExpansion"],
      ["metrics", "ordinaryNodePersistenceExpansion"],
    ]);
    if (expansion !== undefined) {
      ordinaryNodeExpansionSamples.push(expansion);
    }

    const deltas = extractDeltas(record);
    let computedImportant = 0;
    for (const delta of deltas) {
      if (!delta || typeof delta !== "object") {
        continue;
      }
      const routeMetric = extractOptionalRatioMetric(delta, [/duplicate[_ -]?route[_ -]?dedup/i, /route[_ -]?dedup/i], {
        numerator: [["deduped"], ["dedupedRoutes"], ["dedupedRouteCount"], ["deduped_route_count"]],
        denominator: [["duplicates"], ["duplicateRoutes"], ["duplicateRouteCount"], ["duplicate_route_count"]],
      });
      if (routeMetric) {
        duplicateRouteSamples.push(routeMetric);
      }
      const deltaExpansion = extractExplicitNumber(delta, [
        ["ordinaryNodePersistenceExpansion"],
        ["ordinary_node_persistence_expansion"],
        ["ordinaryNodeExpansion"],
        ["ordinary_node_expansion"],
        ["nodePersistenceExpansion"],
        ["node_persistence_expansion"],
      ]);
      if (deltaExpansion !== undefined) {
        ordinaryNodeExpansionSamples.push(deltaExpansion);
      }
      if (!isPersistentMemoryDelta(delta)) {
        continue;
      }
      persistentMemoryEvents += 1;
      if (hasEventTrace(delta)) {
        tracedPersistentMemoryEvents += 1;
      } else {
        untracedMemoryIds.push(idFor(delta, `receipt:${index}:memory:${persistentMemoryEvents}`));
      }
      if (isImportantMemory(delta)) {
        computedImportant += 1;
      }
    }
    if (explicitImportant === undefined && deltas.length > 0) {
      importantMemoryCountsByRun.set(runIndex, computedImportant);
    }
  });

  const importantMemoryCounts = [...importantMemoryCountsByRun.values()];
  const traceability = persistentMemoryEvents > 0 ? tracedPersistentMemoryEvents / persistentMemoryEvents : null;
  const duplicateRouteDedupRate = summarizeRatioSamples(duplicateRouteSamples.filter((sample) => !sample.missing));
  const ordinaryNodePersistenceExpansion = numericStats(ordinaryNodeExpansionSamples);
  const missingEvaluationRuns = [...receiptRunIds].filter((runIndex) => !classifiedEvaluationRuns.has(runIndex));
  const unknownEvaluationRuns = [...classifiedEvaluationRuns].filter((runIndex) => !receiptRunIds.has(runIndex));
  const bindingMismatchIds = evaluatedBindings
    .filter((binding) => {
      const receiptBinding = receiptBindingsByRun.get(String(binding.runIndex));
      if (!receiptBinding) return true;
      return (receiptBinding.runId && receiptBinding.runId !== binding.runId)
        || (receiptBinding.journeyId && receiptBinding.journeyId !== binding.journeyId);
    })
    .map((binding) => `${binding.runIndex}:${binding.runId}:${binding.journeyId}`);

  if (parseErrors.length > 0) {
    failures.push({
      gate: "parse_input",
      expected: 0,
      actual: parseErrors.length,
      failureIdHashes: parseErrors.map((error) => error.failureIdHash).slice(0, MAX_PARSE_FAILURE_HASHES),
    });
  }
  if (secretState.secretFindings > 0) {
    failures.push(gateFailure("no_secret_material", 0, secretState.secretFindings));
  }
  if (authorityState.authorityOverwriteCount > 0) {
    failures.push({
      gate: "no_authority_write_or_canonical_override",
      expected: 0,
      actual: authorityState.authorityOverwriteCount,
      failureIdHashes: authorityState.authorityOverwriteHashes.slice(0, MAX_FAILURE_HASHES),
    });
  }
  if (queryRecords.length === 0) {
    failures.push(gateFailure("query_evaluation_samples_present", ">0", 0));
  }
  if (receiptRecords.length === 0) {
    failures.push(gateFailure("run_receipt_rag_delta_samples_present", ">0", 0));
  }
  if (recallSamples.length === 0) {
    failures.push(gateFailure("recent_key_fact_recall_samples_present", ">0", 0));
  }
  if (precisionSamples.length === 0) {
    failures.push(gateFailure("route_summary_precision_samples_present", ">0", 0));
  }
  if (malformedEvaluationIds.length > 0) {
    failures.push(gateFailure("authoritative_rag_evaluation_shape", "valid server trace v2 with complete evidence collections and hashes", malformedEvaluationIds.length, malformedEvaluationIds));
  }
  if (missingEvaluationRuns.length > 0 || unknownEvaluationRuns.length > 0) {
    failures.push(gateFailure("rag_evaluation_run_coverage", receiptRunIds.size, classifiedEvaluationRuns.size, [...missingEvaluationRuns, ...unknownEvaluationRuns]));
  }
  if (bindingMismatchIds.length > 0) {
    failures.push(gateFailure("rag_evaluation_run_journey_binding", 0, bindingMismatchIds.length, bindingMismatchIds));
  }
  if (recall.value === null || recall.value < KEY_FACT_RECALL_MIN) {
    failures.push(gateFailure("recent_key_fact_recall", `>=${KEY_FACT_RECALL_MIN}`, recall.value));
  }
  if (precision.value === null || precision.value < ROUTE_PRECISION_MIN) {
    failures.push(gateFailure("route_summary_precision", `>=${ROUTE_PRECISION_MIN}`, precision.value));
  }
  if (persistentMemoryEvents === 0) {
    failures.push(gateFailure("persistent_memory_event_samples_present", ">0", 0));
  }
  if (traceability !== TRACEABILITY_REQUIRED) {
    failures.push(gateFailure("persistent_memory_event_traceability", TRACEABILITY_REQUIRED, traceability, untracedMemoryIds));
  }
  if (importantMemoryCounts.length === 0 || importantMemoryCountsByRun.size !== receiptRunIds.size) {
    failures.push(gateFailure("important_memory_count_samples_present_per_run", receiptRunIds.size, importantMemoryCountsByRun.size));
  }
  const invalidImportantRuns = [...importantMemoryCountsByRun.entries()]
    .filter(([, count]) => count < IMPORTANT_MEMORY_MIN_PER_RUN || count > IMPORTANT_MEMORY_MAX_PER_RUN)
    .map(([runId]) => runId);
  if (invalidImportantRuns.length > 0) {
    failures.push(gateFailure("important_memories_per_run", `${IMPORTANT_MEMORY_MIN_PER_RUN}..${IMPORTANT_MEMORY_MAX_PER_RUN}`, invalidImportantRuns.length, invalidImportantRuns));
  }
  if (duplicateRouteSamples.length === 0) {
    failures.push(gateFailure("duplicate_route_dedup_rate_samples_present", ">0", 0));
  }
  if (ordinaryNodeExpansionSamples.length === 0) {
    failures.push(gateFailure("ordinary_node_persistence_expansion_samples_present", ">0", 0));
  }
  if (malformedReceiptIds.length > 0) {
    failures.push(gateFailure("run_receipt_metric_shape", "explicit value or numerator/denominator", malformedReceiptIds.length, malformedReceiptIds));
  }

  return {
    schemaVersion: SCHEMA_VERSION,
    ok: failures.length === 0,
    input: {
      queryEvaluationRecords: queryRecords.length,
      authoritativeEvaluationRecords: authoritativeEvaluationCount,
      legitimateNoRetrievalRecords: legitimateNoRetrievalCount,
      runReceiptRecords: receiptRecords.length,
      parseErrors: parseErrors.length,
    },
    thresholds: {
      recentKeyFactRecallMin: KEY_FACT_RECALL_MIN,
      routeSummaryPrecisionMin: ROUTE_PRECISION_MIN,
      persistentMemoryEventTraceability: TRACEABILITY_REQUIRED,
      importantMemoriesPerRunMin: IMPORTANT_MEMORY_MIN_PER_RUN,
      importantMemoriesPerRunMax: IMPORTANT_MEMORY_MAX_PER_RUN,
      authorityWriteOrCanonicalOverrideMax: 0,
    },
    metrics: {
      recentKeyFactRecall: recall,
      routeSummaryPrecision: precision,
      evaluationClassification: {
        authoritativeEvaluationCount,
        legitimateNoRetrievalCount,
        invalidCount: malformedEvaluationIds.length,
        coveredRuns: classifiedEvaluationRuns.size,
      },
      persistentMemoryEventTraceability: {
        persistentMemoryEvents,
        tracedPersistentMemoryEvents,
        value: traceability,
      },
      importantMemoriesPerRun: numericStats(importantMemoryCounts),
      duplicateRouteDedupRate,
      ordinaryNodePersistenceExpansion,
      authorityWriteOrCanonicalOverrideCount: authorityState.authorityOverwriteCount,
      secretFindingCount: secretState.secretFindings,
    },
    failureCount: failures.length,
    failures,
    reportIdHash: stableHash({
      queryRecords: queryRecords.length,
      receiptRecords: receiptRecords.length,
      metrics: {
        recall: recall.value,
        precision: precision.value,
        traceability,
        importantMemoryCounts,
        duplicateRouteDedupRate: duplicateRouteDedupRate.value,
        ordinaryNodeExpansionSamples,
      },
      failures: failures.map((failure) => [failure.gate, failure.actual]),
    }),
  };
}

function main() {
  try {
    const options = parseArguments(process.argv.slice(2));
    if (options.help) {
      printJson({ schemaVersion: SCHEMA_VERSION, usage: usage().split("\n") });
      return;
    }

    const repositoryRealPath = fs.realpathSync(repositoryRoot);
    const parseErrors = [];
    const queryRecords = [];
    const receiptRecords = [];

    options.queryEvaluationPaths.forEach((inputPath, index) => {
      const parsed = parseRecords(readRepositoryFile(inputPath, repositoryRealPath), "query", index);
      queryRecords.push(...parsed.records);
      parseErrors.push(...parsed.parseErrors);
    });
    options.runReceiptPaths.forEach((inputPath, index) => {
      const parsed = parseRecords(readRepositoryFile(inputPath, repositoryRealPath), "receipt", index);
      receiptRecords.push(...parsed.records);
      parseErrors.push(...parsed.parseErrors);
    });

    const report = buildReport(queryRecords, receiptRecords, parseErrors);
    printJson(report);
    if (!report.ok) {
      process.exitCode = 1;
    }
  } catch (error) {
    printJson({
      schemaVersion: SCHEMA_VERSION,
      ok: false,
      failureCount: 1,
      failures: [{
        gate: "cli_error",
        expected: "valid repository-relative inputs",
        actual: "error",
        failureIdHashes: [hashId(error instanceof Error ? error.message : String(error))],
      }],
    });
    process.exitCode = 1;
  }
}

main();
