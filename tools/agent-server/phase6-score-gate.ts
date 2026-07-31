#!/usr/bin/env node
// @ts-nocheck
import { createHash } from "node:crypto";
import { existsSync, realpathSync, statSync, readFileSync } from "node:fs";
import { resolve, relative } from "node:path";

const REQUIRED_DIMS = [
  "objective",
  "causalImpact",
  "execution",
  "risk",
  "integrity",
  "efficiency",
  "survival",
  "antiFarmDecay",
];

const SCORE_CONTRACT_VERSION = "phase6_score.v2";
const SCORE_AUTHORITY = "server_authoritative";
const SCORE_FORMULA = "total = sum(dimensions[dimension].contribution) * decay";
const SCORE_INTENSITY_CORRELATION_LIMIT = 0.15;
const REQUIRED_WEIGHTS = Object.freeze({
  objective: 2200,
  causalImpact: 1400,
  execution: 1800,
  risk: 1000,
  integrity: 1200,
  efficiency: 1200,
  survival: 700,
  antiFarmDecay: 500,
});

const DIRECT_BONUS_FIELDS = [
  "intensity",
  "suitability",
  "globalPower",
  "equipmentValue",
];

const ERROR = Object.freeze({
  USAGE: "PHASE6_USAGE",
  INPUT_PATH: "PHASE6_INPUT_PATH",
  READ: "PHASE6_READ",
  PARSE: "PHASE6_PARSE",
  EXPECTED_RUNS: "PHASE6_EXPECTED_RUNS",
  RECEIPT_SHAPE: "PHASE6_RECEIPT_SHAPE",
  SCORE_SHAPE: "PHASE6_SCORE_SHAPE",
  CONTRACT: "PHASE6_SCORE_CONTRACT",
  FORMULA: "PHASE6_SCORE_FORMULA",
  DIMENSIONS: "PHASE6_DIMENSIONS",
  WEIGHTS: "PHASE6_WEIGHTS",
  CONTRIBUTION: "PHASE6_CONTRIBUTION",
  TOTAL: "PHASE6_TOTAL",
  EVIDENCE: "PHASE6_EVIDENCE",
  DIRECT_BONUS: "PHASE6_DIRECT_BONUS",
  FALLBACK_94: "PHASE6_FALLBACK_94",
  FIXED_TOTAL: "PHASE6_FIXED_TOTAL",
  CONTEXT: "PHASE6_SCORE_CONTEXT",
  CORRELATION: "PHASE6_SCORE_INTENSITY_CORRELATION",
  VARIANCE: "PHASE6_SCORE_VARIANCE",
});

const SCORE_TOLERANCE = 1e-6;
const MONEY_TOLERANCE = 0.01;

main();

function main() {
  const startedAt = new Date().toISOString();
  const result = run(process.argv.slice(2));
  const status = result.errors.length === 0 ? "pass" : "fail";
  const output = {
    gate: "phase6-score-gate",
    version: 2,
    scoreContractVersion: SCORE_CONTRACT_VERSION,
    status,
    startedAt,
    finishedAt: new Date().toISOString(),
    counts: result.counts,
    statistics: result.statistics,
    hash: result.hash,
    errors: result.errors,
  };

  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  process.exitCode = status === "pass" ? 0 : 1;
}

function run(argv) {
  const errors = [];
  const parsed = parseArgs(argv, errors);
  const receipts = [];
  const totalsByFingerprint = new Map();
  const files = [];
  const hash = createHash("sha256");
  const root = safeRealpath(process.cwd());

  if (!root) {
    return emptyResult(errors.concat(error(ERROR.INPUT_PATH, "cwd-not-readable")));
  }

  if (parsed.files.length === 0) {
    errors.push(error(ERROR.USAGE, "missing-input"));
  }

  for (const input of parsed.files) {
    const file = validateInputPath(input, root, errors);
    if (!file) continue;
    files.push(file);

    let text;
    try {
      text = readFileSync(file.real, "utf8");
    } catch {
      errors.push(error(ERROR.READ, "read-failed", { file: file.safe }));
      continue;
    }

    hash.update(file.safe);
    hash.update("\0");
    hash.update(createHash("sha256").update(text).digest("hex"));
    hash.update("\0");

    const parsedRecords = parseReceiptText(text, file.safe, errors);
    for (const record of parsedRecords) {
      receipts.push({ ...record, file: file.safe });
    }
  }

  if (parsed.expectedRuns !== undefined && receipts.length !== parsed.expectedRuns) {
    errors.push(
      error(ERROR.EXPECTED_RUNS, "count-mismatch", {
        expected: parsed.expectedRuns,
        actual: receipts.length,
      }),
    );
  }

  const totals = [];
  const weightedTotals = [];
  const decays = [];
  const intensityBaselines = [];

  receipts.forEach((receipt, index) => {
    const context = {
      index,
      file: receipt.file,
      line: receipt.line,
      runIdHash: hashValue(findRunId(receipt.value) ?? `${receipt.file}:${receipt.line ?? index}`),
    };
    const validation = validateReceipt(receipt.value, context, errors);
    if (!validation) return;

    totals.push(validation.total);
    weightedTotals.push(validation.weightedTotal);
    decays.push(validation.decay);
    intensityBaselines.push(validation.intensityBaseline);

    const previous = totalsByFingerprint.get(validation.fingerprint);
    if (previous !== undefined && Math.abs(previous - validation.total) > MONEY_TOLERANCE) {
      return;
    }
    totalsByFingerprint.set(validation.fingerprint, validation.total);
  });

  detectFixedTotals(receipts, errors);
  const correlation = scoreIntensityCorrelationAudit(totals, intensityBaselines, receipts.length, errors);

  hash.update(JSON.stringify({
    receiptCount: receipts.length,
    errorCodes: errors.map((entry) => entry.code).sort(),
    totals: totals.map((value) => round(value, 6)).sort((a, b) => a - b),
  }));

  return {
    counts: {
      files: files.length,
      receipts: receipts.length,
      validReceipts: totals.length,
      errors: errors.length,
    },
    statistics: {
      total: summarize(totals),
      weightedTotal: summarize(weightedTotals),
      decay: summarize(decays),
      scoreIntensityCorrelation: correlation,
    },
    hash: hash.digest("hex"),
    errors,
  };
}

function parseArgs(argv, errors) {
  const files = [];
  let expectedRuns;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      process.stdout.write([
        "Usage: node --import tsx ../agent-server/phase6-score-gate.ts [--expected-runs N] <score.json|score.jsonl>...",
        "",
        "Validates Phase 6 RunReceipt score formula integrity without printing raw receipt text.",
        "",
      ].join("\n"));
      process.exit(0);
    }

    if (arg === "--expected-runs") {
      const raw = argv[index + 1];
      index += 1;
      if (!/^\d+$/.test(raw ?? "")) {
        errors.push(error(ERROR.USAGE, "invalid-expected-runs"));
        continue;
      }
      expectedRuns = Number(raw);
      continue;
    }

    if (arg.startsWith("--expected-runs=")) {
      const raw = arg.slice("--expected-runs=".length);
      if (!/^\d+$/.test(raw)) {
        errors.push(error(ERROR.USAGE, "invalid-expected-runs"));
        continue;
      }
      expectedRuns = Number(raw);
      continue;
    }

    if (arg.startsWith("-")) {
      errors.push(error(ERROR.USAGE, "unknown-flag", { flagHash: hashValue(arg) }));
      continue;
    }

    files.push(arg);
  }

  return { expectedRuns, files };
}

function validateInputPath(input, root, errors) {
  const absolute = resolve(process.cwd(), input);
  let real;
  try {
    real = realpathSync(absolute);
  } catch {
    errors.push(error(ERROR.INPUT_PATH, "not-found", { inputHash: hashValue(input) }));
    return undefined;
  }

  if (!isInside(root, real)) {
    errors.push(error(ERROR.INPUT_PATH, "outside-repository", { inputHash: hashValue(input) }));
    return undefined;
  }

  let stats;
  try {
    stats = statSync(real);
  } catch {
    errors.push(error(ERROR.INPUT_PATH, "stat-failed", { inputHash: hashValue(input) }));
    return undefined;
  }

  if (!stats.isFile()) {
    errors.push(error(ERROR.INPUT_PATH, "not-file", { inputHash: hashValue(input) }));
    return undefined;
  }

  return { real, safe: relative(root, real) || "." };
}

function parseReceiptText(text, file, errors) {
  const trimmed = text.trim();
  if (trimmed.length === 0) return [];

  if (trimmed[0] === "[" || trimmed[0] === "{") {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map((value, index) => ({ value, line: index + 1 }));
      }
      return [{ value: parsed, line: 1 }];
    } catch {
      if (trimmed[0] !== "{") {
        errors.push(error(ERROR.PARSE, "json-parse-failed", { file }));
        return [];
      }
    }
  }

  const records = [];
  const lines = text.split(/\r?\n/);
  lines.forEach((line, index) => {
    if (line.trim().length === 0) return;
    try {
      records.push({ value: JSON.parse(line), line: index + 1 });
    } catch {
      errors.push(error(ERROR.PARSE, "jsonl-line-parse-failed", { file, line: index + 1 }));
    }
  });
  return records;
}

function validateReceipt(receipt, context, errors) {
  if (!isObject(receipt)) {
    errors.push(error(ERROR.RECEIPT_SHAPE, "record-not-object", context));
    return undefined;
  }

  const score = findScoreObject(receipt);
  if (!score) {
    errors.push(error(ERROR.SCORE_SHAPE, "score-object-missing", context));
    return undefined;
  }

  if (score.contractVersion !== SCORE_CONTRACT_VERSION
    || score.authority !== SCORE_AUTHORITY
    || score.provenance !== "server_canonical"
    || score.formula !== SCORE_FORMULA) {
    errors.push(error(ERROR.CONTRACT, "canonical-score-contract-mismatch", context));
    return undefined;
  }

  const dims = findDimensions(score);
  if (!dims) {
    errors.push(error(ERROR.DIMENSIONS, "dimensions-missing", context));
    return undefined;
  }

  const extra = Object.keys(dims).filter((key) => !REQUIRED_DIMS.includes(key));
  const missing = REQUIRED_DIMS.filter((key) => !isObject(dims[key]));
  if (missing.length > 0 || extra.length > 0) {
    errors.push(
      error(ERROR.DIMENSIONS, "dimension-set-mismatch", {
        ...context,
        missing,
        extraHash: hashList(extra),
      }),
    );
    return undefined;
  }

  const directBonus = findDirectBonus(score);
  if (directBonus.length > 0) {
    errors.push(
      error(ERROR.DIRECT_BONUS, "direct-bonus-field-present", {
        ...context,
        fields: directBonus,
      }),
    );
  }

  const fallbackHit = findFallback94(score);
  if (fallbackHit) {
    errors.push(error(ERROR.FALLBACK_94, fallbackHit, context));
  }

  let weightSum = 0;
  let weightedTotal = 0;
  const fingerprintParts = [];

  for (const dimName of REQUIRED_DIMS) {
    const dim = dims[dimName];
    const dimContext = { ...context, dimension: dimName };
    const scoreValue = numberFrom(dim, ["score", "scorePct", "value"]);
    const weightBps = numberFrom(dim, ["weightBps"]);
    const contribution = numberFrom(dim, ["contribution", "weightedContribution", "points"]);

    if (!isFiniteNumber(scoreValue) || !isFiniteNumber(weightBps) || !isFiniteNumber(contribution)) {
      errors.push(error(ERROR.DIMENSIONS, "dimension-numeric-field-missing", dimContext));
      return undefined;
    }

    if (scoreValue < 0 || scoreValue > 100) {
      errors.push(error(ERROR.DIMENSIONS, "dimension-value-out-of-range", dimContext));
      return undefined;
    }

    if (weightBps < 0 || weightBps > 10000 || !Number.isInteger(weightBps)) {
      errors.push(error(ERROR.WEIGHTS, "invalid-weight-bps", dimContext));
      return undefined;
    }
    if (weightBps !== REQUIRED_WEIGHTS[dimName]) {
      errors.push(error(ERROR.WEIGHTS, "canonical-weight-mismatch", dimContext));
    }

    if (typeof dim.formula !== "string" || dim.formula.trim().length === 0
      || !isFiniteNumberRecord(dim.inputs)
      || !isFiniteNumberRecord(dim.inputContributions)) {
      errors.push(error(ERROR.FORMULA, "dimension-formula-inputs-missing", dimContext));
    }

    const expectedContribution = (scoreValue * weightBps) / 10000;
    if (!closeEnough(contribution, expectedContribution)) {
      errors.push(
        error(ERROR.CONTRIBUTION, "contribution-recompute-mismatch", {
          ...dimContext,
          expectedHash: hashValue(round(expectedContribution, 8)),
          actualHash: hashValue(round(contribution, 8)),
        }),
      );
    }

    if (!hasEvidence(dim)) {
      errors.push(error(ERROR.EVIDENCE, "dimension-evidence-missing", dimContext));
    }

    weightSum += weightBps;
    weightedTotal += contribution;
    fingerprintParts.push(`${dimName}:${round(scoreValue, 6)}:${weightBps}:${round(contribution, 6)}`);
  }

  if (weightSum !== 10000) {
    errors.push(
      error(ERROR.WEIGHTS, "weight-bps-sum-mismatch", {
        ...context,
        expected: 10000,
        actual: weightSum,
      }),
    );
  }

  const decay = findDecay(score, dims);
  if (!isFiniteNumber(decay)) {
    errors.push(error(ERROR.TOTAL, "decay-missing", context));
    return undefined;
  }
  if (decay < 0.65 || decay > 1) {
    errors.push(error(ERROR.TOTAL, "decay-out-of-range", context));
    return undefined;
  }

  const declaredWeightedTotal = numberFrom(score, ["weightedTotal"]);
  if (!isFiniteNumber(declaredWeightedTotal) || !closeEnough(declaredWeightedTotal, weightedTotal)) {
    errors.push(error(ERROR.TOTAL, "weighted-total-recompute-mismatch", context));
  }

  const total = numberFrom(score, ["total", "totalScore", "finalScore", "score"]);
  if (!isFiniteNumber(total)) {
    errors.push(error(ERROR.TOTAL, "total-missing", context));
    return undefined;
  }
  if (total < 0 || total > 100) {
    errors.push(error(ERROR.TOTAL, "total-out-of-range", context));
  }

  const expectedTotal = weightedTotal * decay;
  if (!closeEnough(total, expectedTotal)) {
    errors.push(
      error(ERROR.TOTAL, "total-recompute-mismatch", {
        ...context,
        expectedHash: hashValue(round(expectedTotal, 8)),
        actualHash: hashValue(round(total, 8)),
      }),
    );
  }

  const scoreContext = score.context;
  const intensityBaseline = numberFrom(scoreContext, ["difficultyBaseline"]);
  const combatPowerBaseline = numberFrom(scoreContext, ["combatPowerBaseline"]);
  const expectedPerformanceBaseline = numberFrom(scoreContext, ["expectedPerformanceBaseline"]);
  const observedPerformance = numberFrom(scoreContext, ["observedPerformance"]);
  const performanceDeltaFromBaseline = numberFrom(scoreContext, ["performanceDeltaFromBaseline"]);
  if (!isObject(scoreContext)
    || scoreContext.scoringUse !== "context_only_not_weighted"
    || !isPercent(intensityBaseline)
    || !isPercent(combatPowerBaseline)
    || !isPercent(expectedPerformanceBaseline)
    || !isPercent(observedPerformance)
    || !isFiniteNumber(performanceDeltaFromBaseline)
    || performanceDeltaFromBaseline < -100
    || performanceDeltaFromBaseline > 100) {
    errors.push(error(ERROR.CONTEXT, "context-only-baseline-invalid", context));
    return undefined;
  }

  return {
    total,
    weightedTotal,
    decay,
    intensityBaseline,
    fingerprint: hashValue(fingerprintParts.join("|")),
  };
}

function findScoreObject(receipt) {
  const candidates = [
    receipt.score,
    receipt.scoring,
    receipt.phase6Score,
    receipt.runScore,
    receipt.result?.score,
    receipt.receipt?.score,
    receipt.runReceipt?.score,
  ];
  return candidates.find((candidate) => isObject(candidate));
}

function findDimensions(score) {
  const candidates = [
    score.dimensions,
    score.dimensionScores,
    score.breakdown,
    score.components,
  ];
  return candidates.find((candidate) => isObject(candidate) && REQUIRED_DIMS.some((dim) => dim in candidate));
}

function findDecay(score, dims) {
  const direct = numberFrom(score, [
    "decay",
    "decayMultiplier",
    "antiFarmDecayMultiplier",
    "antiFarmDecayFactor",
  ]);
  if (isFiniteNumber(direct)) return normalizeDecay(direct);

  const dimDecay = numberFrom(dims.antiFarmDecay, [
    "decay",
    "decayMultiplier",
    "multiplier",
    "factor",
  ]);
  if (isFiniteNumber(dimDecay)) return normalizeDecay(dimDecay);

  return undefined;
}

function normalizeDecay(value) {
  return value > 1 ? value / 100 : value;
}

function findDirectBonus(score) {
  const found = new Set();
  walk(score, (key, value, path) => {
    if (!DIRECT_BONUS_FIELDS.includes(key)) return;
    if (!isFiniteNumber(value)) return;
    if (isDimensionPath(path)) return;
    found.add(key);
  });
  return [...found].sort();
}

function findFallback94(score) {
  const total = numberFrom(score, ["total", "totalScore", "finalScore", "score"]);
  if (total === 94 && hasFallbackMarker(score)) return "fallback-94-marker";
  if (total === 94 && !findDimensions(score)) return "fallback-94-without-dimensions";
  return undefined;
}

function hasFallbackMarker(value) {
  let hit = false;
  walk(value, (key, item) => {
    if (hit) return;
    const keyText = String(key).toLowerCase();
    if (keyText.includes("fallback") && item) hit = true;
    if (typeof item === "string" && item.toLowerCase().includes("fallback")) hit = true;
  });
  return hit;
}

function isDimensionPath(path) {
  return [
    "dimensions.",
    "dimensionScores.",
    "breakdown.",
    "components.",
    ".dimensions.",
    ".dimensionScores.",
    ".breakdown.",
    ".components.",
  ].some((prefix) => path.includes(prefix));
}

function detectFixedTotals(receipts, errors) {
  const byRun = [];

  receipts.forEach((receipt, index) => {
    const score = isObject(receipt.value) ? findScoreObject(receipt.value) : undefined;
    const dims = score ? findDimensions(score) : undefined;
    const total = score ? numberFrom(score, ["total", "totalScore", "finalScore", "score"]) : undefined;
    if (!dims || !isFiniteNumber(total)) return;
    const componentFingerprint = REQUIRED_DIMS
      .map((dim) => {
        const item = dims[dim];
        return `${dim}:${numberFrom(item, ["score", "scorePct", "value"])}:${numberFrom(item, ["weightBps"])}:${numberFrom(item, ["contribution", "weightedContribution", "points"])}`;
      })
      .join("|");
    byRun.push({
      index,
      total,
      componentHash: hashValue(componentFingerprint),
    });
  });

  const totals = new Map();
  for (const item of byRun) {
    const key = String(round(item.total, 6));
    const entry = totals.get(key) ?? new Set();
    entry.add(item.componentHash);
    totals.set(key, entry);
  }

  for (const [total, fingerprints] of totals) {
    if (fingerprints.size > 1) {
      errors.push(
        error(ERROR.FIXED_TOTAL, "different-components-same-total", {
          totalHash: hashValue(total),
          variants: fingerprints.size,
        }),
      );
    }
  }
  if (byRun.length >= 2 && totals.size === 1) {
    errors.push(error(ERROR.VARIANCE, "all-run-totals-constant", { runs: byRun.length }));
  }
}

function scoreIntensityCorrelationAudit(totals, intensityBaselines, receiptCount, errors) {
  if (receiptCount < 10) return null;
  if (totals.length !== receiptCount || intensityBaselines.length !== receiptCount) {
    errors.push(error(ERROR.CORRELATION, "correlation-input-incomplete", {
      receipts: receiptCount,
      totals: totals.length,
      intensityBaselines: intensityBaselines.length,
    }));
    return null;
  }
  const correlation = pearsonCorrelation(intensityBaselines, totals);
  if (!isFiniteNumber(correlation)) {
    errors.push(error(ERROR.CORRELATION, "correlation-not-auditable", { runs: receiptCount }));
    return null;
  }
  if (Math.abs(correlation) >= SCORE_INTENSITY_CORRELATION_LIMIT) {
    errors.push(error(ERROR.CORRELATION, "absolute-correlation-limit-exceeded", {
      limit: SCORE_INTENSITY_CORRELATION_LIMIT,
      actual: round(correlation, 6),
    }));
  }
  return round(correlation, 6);
}

function pearsonCorrelation(left, right) {
  if (left.length !== right.length || left.length < 2) return undefined;
  const leftMean = left.reduce((sum, value) => sum + value, 0) / left.length;
  const rightMean = right.reduce((sum, value) => sum + value, 0) / right.length;
  let numerator = 0;
  let leftSquares = 0;
  let rightSquares = 0;
  for (let index = 0; index < left.length; index += 1) {
    const leftDelta = left[index] - leftMean;
    const rightDelta = right[index] - rightMean;
    numerator += leftDelta * rightDelta;
    leftSquares += leftDelta * leftDelta;
    rightSquares += rightDelta * rightDelta;
  }
  const denominator = Math.sqrt(leftSquares * rightSquares);
  return denominator === 0 ? undefined : numerator / denominator;
}

function hasEvidence(dim) {
  if (typeof dim.reasonCode !== "string" || dim.reasonCode.trim().length === 0) return false;
  if (Array.isArray(dim.events) && dim.events.length > 0) return true;
  if (Array.isArray(dim.eventEvidence) && dim.eventEvidence.length > 0) return true;
  if (isObject(dim.event) && Object.keys(dim.event).length > 0) return true;
  if (isObject(dim.evidence) && Object.keys(dim.evidence).length > 0) return true;
  return false;
}

function isFiniteNumberRecord(value) {
  return isObject(value)
    && Object.values(value).every((entry) => isFiniteNumber(entry));
}

function isPercent(value) {
  return isFiniteNumber(value) && value >= 0 && value <= 100;
}

function numberFrom(source, keys) {
  if (!isObject(source)) return undefined;
  for (const key of keys) {
    const value = source[key];
    if (isFiniteNumber(value)) return value;
    if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) {
      return Number(value);
    }
  }
  return undefined;
}

function findRunId(receipt) {
  if (!isObject(receipt)) return undefined;
  return receipt.runId ?? receipt.id ?? receipt.receiptId ?? receipt.run?.id ?? receipt.metadata?.runId;
}

function walk(value, visitor, path = "") {
  if (Array.isArray(value)) {
    value.forEach((item, index) => walk(item, visitor, `${path}[${index}]`));
    return;
  }
  if (!isObject(value)) return;
  for (const [key, item] of Object.entries(value)) {
    const nextPath = path ? `${path}.${key}` : key;
    visitor(key, item, nextPath);
    walk(item, visitor, nextPath);
  }
}

function summarize(values) {
  if (values.length === 0) {
    return { min: null, max: null, mean: null };
  }
  const sorted = [...values].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, value) => acc + value, 0);
  return {
    min: round(sorted[0], 6),
    max: round(sorted[sorted.length - 1], 6),
    mean: round(sum / sorted.length, 6),
  };
}

function error(code, reason, details = {}) {
  return { code, reason, ...details };
}

function emptyResult(errors) {
  return {
    errors,
    counts: { files: 0, receipts: 0, validReceipts: 0, errors: errors.length },
    statistics: {
      total: summarize([]),
      weightedTotal: summarize([]),
      decay: summarize([]),
      scoreIntensityCorrelation: null,
    },
    hash: createHash("sha256").update(JSON.stringify(errors)).digest("hex"),
  };
}

function closeEnough(actual, expected) {
  return Math.abs(actual - expected) <= Math.max(SCORE_TOLERANCE, MONEY_TOLERANCE);
}

function isInside(root, target) {
  const rel = relative(root, target);
  return rel === "" || (!rel.startsWith("..") && !rel.startsWith("/"));
}

function safeRealpath(path) {
  try {
    return realpathSync(path);
  } catch {
    return undefined;
  }
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function round(value, places) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function hashValue(value) {
  return createHash("sha256").update(String(value)).digest("hex").slice(0, 16);
}

function hashList(values) {
  return values.map((value) => hashValue(value)).sort();
}
