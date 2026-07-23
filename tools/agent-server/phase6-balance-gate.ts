#!/usr/bin/env node
// @ts-nocheck

import fs from "node:fs";

const SCHEMA_VERSION = "obsidian-epoch.phase6-balance-gate.v1";
const ALLOWED_EXPECTED_RUNS = new Set([10000, 100000]);
const MAX_PARSE_ERRORS = 20;
const MAX_SCHEMA_ERRORS = 50;
const MAX_SECRET_PATHS = 50;
const DESIGN_PRIOR_VERSION = "design-prior-v1";
const PRIOR_SHARE_TOLERANCE = 0.035;
const MIN_SLICE_SAMPLES_10K = 120;
const SCORE_BIN_WIDTH = 2;
const HISTOGRAM_MAX_BIN_SHARE = 0.16;
const HISTOGRAM_MIN_NORMALIZED_ENTROPY = 0.82;
const BUILD_DOMINANCE_MAX_SHARE = 0.5;
const SPREAD_MIN_SCORE_IQR = 4;
const SPREAD_MIN_SCORE_STDDEV = 3;
const SPREAD_MAX_COST_P99 = 95;
const SPREAD_MAX_INJURY_P99 = 95;
const SPREAD_MAX_CV = 2.75;
const RESOURCE_TOLERANCE = 1e-9;
const CORRELATION_GATES = {
  // Final score may respond to mission intensity, but the upper 95% CI must stay well below single-axis control.
  intensity: { label: "score-intensity", minAbsCiUpperInclusive: 0, maxAbsCiUpperInclusive: 0.65 },
  // Combat suitability is intentionally relevant to scoring, while still bounded away from dominance.
  combatSuitability: { label: "score-combatSuitability", minAbsCiUpperInclusive: 0.12, maxAbsCiUpperInclusive: 0.82 },
  // Success is a strong outcome signal, but score must still preserve cost, injury, difficulty, and quality effects.
  success: { label: "score-success", minAbsCiUpperInclusive: 0.1, maxAbsCiUpperInclusive: 0.86 },
  // Injury should be visible in score without becoming the only balance axis.
  injury: { label: "score-injury", minAbsCiUpperInclusive: 0.05, maxAbsCiUpperInclusive: 0.8 },
};
const SECRET_KEY = /(?:secret|token|api[-_]?key|authorization|password|credential|private[-_]?key|access[-_]?key|refresh[-_]?token|session[-_]?key|recovery[-_]?code|operator[-_]?key)/i;
const SECRET_VALUE = /\b(?:sk-[A-Za-z0-9_-]{12,}|Bearer\s+[A-Za-z0-9._-]{12,}|xox[baprs]-[A-Za-z0-9-]{12,}|AKIA[0-9A-Z]{16})\b/i;

function usage() {
  return [
    "Usage: node tools/agent-server/phase6-balance-gate.mjs --expected-runs <10000|100000> [--input <path>]",
    "",
    "Reads machine JSON or JSONL samples from --input or stdin and prints a pure JSON balance-gate summary.",
    "Exits non-zero when any Phase 6 numerical balance gate fails.",
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
    if (argument === "--input") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("--input requires a path");
      }
      options.inputPath = value;
      index += 1;
      continue;
    }
    if (argument === "--expected-runs") {
      const value = Number.parseInt(argv[index + 1], 10);
      if (!ALLOWED_EXPECTED_RUNS.has(value)) {
        throw new Error("--expected-runs must be 10000 or 100000");
      }
      options.expectedRuns = value;
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${argument}`);
  }

  if (!options.help && options.expectedRuns === undefined) {
    throw new Error("--expected-runs is required");
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
    if (Array.isArray(value.samples)) {
      flattenRecords(value.samples, records);
      return records;
    }
    if (Array.isArray(value.runs)) {
      flattenRecords(value.runs, records);
      return records;
    }
    if (Array.isArray(value.records)) {
      flattenRecords(value.records, records);
      return records;
    }
    records.push(value);
  }
  return records;
}

function parseRecords(input) {
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
      parseErrors.push({ line: index + 1, reason: "not_json" });
      return;
    }
    flattenRecords(parsed, records);
  });

  return { records, parseErrors };
}

function scanForSecrets(value, path, state) {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => scanForSecrets(entry, `${path}[${index}]`, state));
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, entry] of Object.entries(value)) {
      const nextPath = path ? `${path}.${key}` : key;
      if (SECRET_KEY.test(key)) {
        state.secretPaths.add(nextPath);
      }
      scanForSecrets(entry, nextPath, state);
    }
    return;
  }
  if (typeof value === "string" && SECRET_VALUE.test(value)) {
    state.secretPaths.add(path || "$");
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

function finiteNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
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
    return value > 0;
  }
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.trim().toLowerCase();
  if (["true", "success", "succeeded", "win", "won", "pass", "passed", "1"].includes(normalized)) {
    return true;
  }
  if (["false", "failure", "failed", "loss", "lost", "fail", "0"].includes(normalized)) {
    return false;
  }
  return undefined;
}

function stringValue(value) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  return String(value);
}

function extractSample(record) {
  const score = finiteNumber(firstValue(record, [
    ["score"],
    ["rating"],
    ["result", "score"],
    ["result", "rating"],
    ["metrics", "score"],
    ["balance", "score"],
    ["payload", "score"],
    ["payload", "result", "score"],
  ]));
  const intensity = finiteNumber(firstValue(record, [
    ["intensity"],
    ["encounterIntensity"],
    ["encounter_intensity"],
    ["result", "intensity"],
    ["metrics", "intensity"],
    ["balance", "intensity"],
    ["payload", "intensity"],
    ["payload", "result", "intensity"],
  ]));
  const suitabilityBand = stringValue(firstValue(record, [
    ["suitabilityBand"],
    ["suitability_band"],
    ["suitability", "band"],
    ["band"],
    ["matchmaking", "suitabilityBand"],
    ["payload", "suitabilityBand"],
    ["payload", "suitability", "band"],
  ]));
  const build = stringValue(firstValue(record, [
    ["build"],
    ["buildId"],
    ["build_id"],
    ["deck"],
    ["deckId"],
    ["composition"],
    ["archetype"],
    ["player", "build"],
    ["player", "buildId"],
    ["payload", "build"],
    ["payload", "player", "build"],
  ]));
  const scenario = stringValue(firstValue(record, [
    ["scenario"],
    ["scenarioId"],
    ["scenario_id"],
    ["scene"],
    ["sceneId"],
    ["scene_id"],
    ["encounter"],
    ["encounterId"],
    ["mission"],
    ["payload", "scenario"],
    ["payload", "scene"],
  ]));
  const success = booleanValue(firstValue(record, [
    ["success"],
    ["succeeded"],
    ["won"],
    ["win"],
    ["result", "success"],
    ["result", "won"],
    ["outcome"],
    ["status"],
    ["payload", "success"],
    ["payload", "result", "success"],
  ]));
  const cost = finiteNumber(firstValue(record, [
    ["cost"],
    ["totalCost"],
    ["total_cost"],
    ["resourceCost"],
    ["resources", "cost"],
    ["result", "cost"],
    ["metrics", "cost"],
    ["payload", "cost"],
  ]));
  const injury = finiteNumber(firstValue(record, [
    ["injury"],
    ["injuries"],
    ["wounds"],
    ["damageTaken"],
    ["damage_taken"],
    ["result", "injury"],
    ["result", "injuries"],
    ["metrics", "injury"],
    ["payload", "injury"],
  ]));
  const outcome = stringValue(firstValue(record, [
    ["outcome"],
    ["result", "outcome"],
    ["payload", "outcome"],
  ]));
  const combatSuitability = finiteNumber(firstValue(record, [
    ["combatSuitability"],
    ["suitability"],
    ["audit", "production", "combatSuitability"],
    ["metrics", "combatSuitability"],
    ["payload", "combatSuitability"],
  ]));
  const sampling = getPath(record, ["metadata", "sampling"]);
  const priorVersion = stringValue(firstValue(record, [
    ["metadata", "sampling", "priorVersion"],
    ["sampling", "priorVersion"],
  ]));
  const stratumBuild = stringValue(firstValue(record, [
    ["metadata", "sampling", "strata", "build"],
    ["sampling", "strata", "build"],
  ]));
  const stratumScenario = stringValue(firstValue(record, [
    ["metadata", "sampling", "strata", "scenario"],
    ["sampling", "strata", "scenario"],
  ]));
  const stratumGrowthChoice = stringValue(firstValue(record, [
    ["metadata", "sampling", "strata", "growthChoice"],
    ["sampling", "strata", "growthChoice"],
  ]));
  const stratumOutcome = stringValue(firstValue(record, [
    ["metadata", "sampling", "strata", "outcome"],
    ["sampling", "strata", "outcome"],
  ]));
  const stratumIntensityTier = stringValue(firstValue(record, [
    ["metadata", "sampling", "strata", "intensityTier"],
    ["sampling", "strata", "intensityTier"],
  ]));
  const priors = sampling && typeof sampling === "object" && !Array.isArray(sampling) ? sampling.priors : undefined;
  const seed = stringValue(firstValue(record, [
    ["metadata", "seed"],
    ["seed"],
  ]));
  const seedHash = stringValue(firstValue(record, [
    ["metadata", "seedHash"],
    ["seedHash"],
  ]));

  return {
    score,
    intensity,
    suitabilityBand,
    build,
    scenario,
    success,
    outcome,
    cost,
    injury,
    combatSuitability,
    priorVersion,
    priors,
    seed,
    seedHash,
    stratumBuild,
    stratumScenario,
    stratumGrowthChoice,
    stratumOutcome,
    stratumIntensityTier,
  };
}

function resourceObject(record, paths) {
  const value = firstValue(record, paths);
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  const result = {};
  for (const [key, entry] of Object.entries(value)) {
    const number = finiteNumber(entry);
    if (number !== undefined) {
      result[key] = number;
    }
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

function resourceTotal(value) {
  if (!value) {
    return undefined;
  }
  return Object.values(value).reduce((sum, entry) => sum + entry, 0);
}

function resourceAnomaly(record) {
  const before = resourceObject(record, [
    ["resourcesBefore"],
    ["resources_before"],
    ["resources", "before"],
    ["before", "resources"],
    ["payload", "resourcesBefore"],
  ]);
  const after = resourceObject(record, [
    ["resourcesAfter"],
    ["resources_after"],
    ["resources", "after"],
    ["after", "resources"],
    ["payload", "resourcesAfter"],
  ]);
  const delta = resourceObject(record, [
    ["resourceDelta"],
    ["resource_delta"],
    ["resources", "delta"],
    ["delta", "resources"],
    ["payload", "resourceDelta"],
  ]);
  const cost = resourceObject(record, [
    ["resourceCost"],
    ["resource_cost"],
    ["resources", "cost"],
    ["cost", "resources"],
    ["payload", "resourceCost"],
  ]);
  const gain = resourceObject(record, [
    ["resourceGain"],
    ["resource_gain"],
    ["resources", "gain"],
    ["reward", "resources"],
    ["payload", "resourceGain"],
  ]);

  if (!before || !after) {
    return { evaluated: false, anomalous: false };
  }

  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  if (delta) {
    Object.keys(delta).forEach((key) => keys.add(key));
  }
  if (cost) {
    Object.keys(cost).forEach((key) => keys.add(key));
  }
  if (gain) {
    Object.keys(gain).forEach((key) => keys.add(key));
  }

  if (!delta && !cost && !gain) {
    const beforeTotal = resourceTotal(before);
    const afterTotal = resourceTotal(after);
    return {
      evaluated: false,
      anomalous: beforeTotal !== undefined && afterTotal !== undefined && afterTotal < -RESOURCE_TOLERANCE,
    };
  }

  for (const key of keys) {
    const observed = (after[key] || 0) - (before[key] || 0);
    const expected = delta ? (delta[key] || 0) : (gain?.[key] || 0) - (cost?.[key] || 0);
    if (Math.abs(observed - expected) > RESOURCE_TOLERANCE) {
      return { evaluated: true, anomalous: true };
    }
  }
  return { evaluated: true, anomalous: false };
}

function emptyStats() {
  return {
    runs: 0,
    successes: 0,
    successRate: null,
    cost: numericStats([]),
    injury: numericStats([]),
    score: numericStats([]),
  };
}

function numericStats(values) {
  if (values.length === 0) {
    return { count: 0, min: null, p25: null, mean: null, median: null, p75: null, p95: null, p99: null, max: null, iqr: null, stddev: null, cv: null };
  }
  const sorted = [...values].sort((left, right) => left - right);
  const percentile = (fraction) => {
    const index = (sorted.length - 1) * fraction;
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    if (lower === upper) {
      return sorted[lower];
    }
    return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
  };
  const sum = sorted.reduce((current, value) => current + value, 0);
  const average = sum / sorted.length;
  const variance = sorted.reduce((current, value) => current + (value - average) ** 2, 0) / sorted.length;
  const stddev = Math.sqrt(variance);
  const p25 = percentile(0.25);
  const p75 = percentile(0.75);
  return {
    count: sorted.length,
    min: sorted[0],
    p25,
    mean: average,
    median: percentile(0.5),
    p75,
    p95: percentile(0.95),
    p99: percentile(0.99),
    max: sorted[sorted.length - 1],
    iqr: p75 - p25,
    stddev,
    cv: average !== 0 ? Math.abs(stddev / average) : null,
  };
}

function summarizeGroup(samples) {
  const successCount = samples.filter((sample) => sample.success === true).length;
  return {
    runs: samples.length,
    successes: successCount,
    successRate: samples.length > 0 ? successCount / samples.length : null,
    cost: numericStats(samples.map((sample) => sample.cost).filter((value) => value !== undefined)),
    injury: numericStats(samples.map((sample) => sample.injury).filter((value) => value !== undefined)),
    score: numericStats(samples.map((sample) => sample.score).filter((value) => value !== undefined)),
  };
}

function groupedStats(samples, key) {
  const groups = new Map();
  for (const sample of samples) {
    const value = sample[key] || "unknown";
    if (!groups.has(value)) {
      groups.set(value, []);
    }
    groups.get(value).push(sample);
  }

  return Object.fromEntries(
    [...groups.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([name, groupSamples]) => [name, summarizeGroup(groupSamples)]),
  );
}

function pearson(samples, xKey, yKey = "score") {
  const pairs = samples
    .map((sample) => [numericCorrelationValue(sample[yKey]), numericCorrelationValue(sample[xKey])])
    .filter(([left, right]) => left !== undefined && right !== undefined);
  if (pairs.length < 2) {
    return { pairs: pairs.length, value: null, abs: null, ci95: null, absCi95: null };
  }

  const scoreMean = pairs.reduce((sum, [score]) => sum + score, 0) / pairs.length;
  const intensityMean = pairs.reduce((sum, [, intensity]) => sum + intensity, 0) / pairs.length;
  let numerator = 0;
  let scoreVariance = 0;
  let intensityVariance = 0;
  for (const [score, intensity] of pairs) {
    const scoreDelta = score - scoreMean;
    const intensityDelta = intensity - intensityMean;
    numerator += scoreDelta * intensityDelta;
    scoreVariance += scoreDelta * scoreDelta;
    intensityVariance += intensityDelta * intensityDelta;
  }
  if (scoreVariance === 0 || intensityVariance === 0) {
    return { pairs: pairs.length, value: null, abs: null, ci95: null, absCi95: null };
  }

  const value = numerator / Math.sqrt(scoreVariance * intensityVariance);
  const ci95 = fisherCi(value, pairs.length);
  return {
    pairs: pairs.length,
    value,
    abs: Math.abs(value),
    ci95,
    absCi95: ci95 ? [Math.min(Math.abs(ci95[0]), Math.abs(ci95[1])), Math.max(Math.abs(ci95[0]), Math.abs(ci95[1]))] : null,
  };
}

function numericCorrelationValue(value) {
  if (typeof value === "boolean") return value ? 1 : 0;
  return finiteNumber(value);
}

function fisherCi(r, n) {
  if (n <= 3) return null;
  const clamped = Math.max(-0.999999, Math.min(0.999999, r));
  const z = 0.5 * Math.log((1 + clamped) / (1 - clamped));
  const delta = 1.96 / Math.sqrt(n - 3);
  const lower = Math.tanh(z - delta);
  const upper = Math.tanh(z + delta);
  return [lower, upper];
}

function valueCounts(samples, key) {
  const counts = new Map();
  for (const sample of samples) {
    const value = sample[key];
    if (value === undefined) {
      continue;
    }
    const name = String(value);
    counts.set(name, (counts.get(name) || 0) + 1);
  }
  return [...counts.entries()].sort((left, right) => right[1] - left[1]);
}

function histogramConcentration(samples) {
  const counts = valueCounts(samples.map((sample) => ({
    scoreBin: sample.score === undefined ? undefined : `${Math.floor(sample.score / SCORE_BIN_WIDTH) * SCORE_BIN_WIDTH}-${Math.floor(sample.score / SCORE_BIN_WIDTH) * SCORE_BIN_WIDTH + SCORE_BIN_WIDTH}`,
  })), "scoreBin");
  const top = counts[0];
  const scoredRuns = samples.filter((sample) => sample.score !== undefined).length;
  const topShare = top && scoredRuns > 0 ? top[1] / scoredRuns : null;
  const entropy = scoredRuns > 0 ? -counts.reduce((sum, [, count]) => {
    const share = count / scoredRuns;
    return sum + share * Math.log2(share);
  }, 0) : null;
  const maxEntropy = counts.length > 1 ? Math.log2(counts.length) : null;
  const normalizedEntropy = entropy !== null && maxEntropy ? entropy / maxEntropy : null;
  return {
    scoredRuns,
    binWidth: SCORE_BIN_WIDTH,
    bins: counts.length,
    topBin: top ? top[0] : null,
    topBinCount: top ? top[1] : 0,
    topBinShare: topShare,
    normalizedEntropy,
    maxBinShare: HISTOGRAM_MAX_BIN_SHARE,
    minNormalizedEntropy: HISTOGRAM_MIN_NORMALIZED_ENTROPY,
    passed:
      scoredRuns > 0 &&
      topShare !== null &&
      normalizedEntropy !== null &&
      topShare <= HISTOGRAM_MAX_BIN_SHARE &&
      normalizedEntropy >= HISTOGRAM_MIN_NORMALIZED_ENTROPY,
  };
}

function buildDominance(samples) {
  const counts = valueCounts(samples, "build");
  const top = counts[0];
  const identifiedRuns = samples.filter((sample) => sample.build !== undefined).length;
  const topShare = top && identifiedRuns > 0 ? top[1] / identifiedRuns : null;
  return {
    identifiedRuns,
    uniqueBuilds: counts.length,
    topBuildCount: top ? top[1] : 0,
    topBuildShare: topShare,
    maxTopShare: BUILD_DOMINANCE_MAX_SHARE,
    passed: identifiedRuns > 0 && topShare !== null && topShare <= BUILD_DOMINANCE_MAX_SHARE,
  };
}

function expectedPriorEntries(samples, key) {
  for (const sample of samples) {
    if (sample.priors && typeof sample.priors === "object" && sample.priors[key] && typeof sample.priors[key] === "object") {
      return Object.entries(sample.priors[key]).map(([name, weight]) => [name, finiteNumber(weight) ?? 0]).filter(([, weight]) => weight > 0);
    }
  }
  return [];
}

function priorDistribution(samples, sampleKey, priorKey) {
  const expectedEntries = expectedPriorEntries(samples, priorKey);
  const counts = valueCounts(samples, sampleKey);
  const observedRuns = samples.filter((sample) => sample[sampleKey] !== undefined).length;
  const expectedTotal = expectedEntries.reduce((sum, [, weight]) => sum + weight, 0);
  const observedMap = new Map(counts);
  const buckets = expectedEntries.map(([name, weight]) => {
    const observed = observedMap.get(name) || 0;
    const observedShare = observedRuns > 0 ? observed / observedRuns : null;
    const expectedShare = expectedTotal > 0 ? weight / expectedTotal : null;
    const delta = observedShare !== null && expectedShare !== null ? observedShare - expectedShare : null;
    return { name, expectedWeight: weight, observed, expectedShare, observedShare, delta };
  });
  const missingExpected = buckets.filter((bucket) => bucket.observed === 0).map((bucket) => bucket.name);
  const unexpected = counts.filter(([name]) => !expectedEntries.some(([expected]) => expected === name)).map(([name, observed]) => ({ name, observed }));
  const maxAbsDelta = buckets.reduce((max, bucket) => Math.max(max, Math.abs(bucket.delta ?? Number.POSITIVE_INFINITY)), 0);
  return {
    observedRuns,
    expectedBuckets: expectedEntries.length,
    tolerance: PRIOR_SHARE_TOLERANCE,
    maxAbsDelta,
    missingExpected,
    unexpected,
    buckets,
    passed:
      observedRuns > 0 &&
      expectedEntries.length > 0 &&
      missingExpected.length === 0 &&
      unexpected.length === 0 &&
      maxAbsDelta <= PRIOR_SHARE_TOLERANCE,
  };
}

function priorAudit(samples, expectedRuns) {
  const priorVersions = valueCounts(samples, "priorVersion");
  const seeds = valueCounts(samples, "seed");
  const seedHashes = valueCounts(samples, "seedHash");
  const distributions = {
    build: priorDistribution(samples, "stratumBuild", "build"),
    scenario: priorDistribution(samples, "stratumScenario", "scenario"),
    growthChoice: priorDistribution(samples, "stratumGrowthChoice", "growthChoice"),
    outcome: priorDistribution(samples, "stratumOutcome", "outcome"),
    intensityTier: priorDistribution(samples, "stratumIntensityTier", "intensityTier"),
  };
  const minSliceSamples = expectedRuns >= 100000 ? MIN_SLICE_SAMPLES_10K * 10 : MIN_SLICE_SAMPLES_10K;
  const smallestBuildScenarioSlice = minCrossSlice(samples, "stratumBuild", "stratumScenario");
  const smallestScenarioOutcomeSlice = minCrossSlice(samples, "stratumScenario", "stratumOutcome");
  return {
    expectedPriorVersion: DESIGN_PRIOR_VERSION,
    priorVersions,
    seeds,
    seedHashes,
    distributions,
    minSliceSamples,
    smallestBuildScenarioSlice,
    smallestScenarioOutcomeSlice,
    passed:
      priorVersions.length === 1 &&
      priorVersions[0]?.[0] === DESIGN_PRIOR_VERSION &&
      seeds.length >= 1 &&
      seedHashes.length >= 1 &&
      Object.values(distributions).every((entry) => entry.passed) &&
      smallestBuildScenarioSlice.count >= minSliceSamples &&
      smallestScenarioOutcomeSlice.count >= Math.floor(minSliceSamples * 0.35),
  };
}

function minCrossSlice(samples, leftKey, rightKey) {
  const counts = new Map();
  for (const sample of samples) {
    if (sample[leftKey] === undefined || sample[rightKey] === undefined) continue;
    const key = `${sample[leftKey]}|${sample[rightKey]}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  if (counts.size === 0) return { key: null, count: 0 };
  return [...counts.entries()].reduce((min, [key, count]) => count < min.count ? { key, count } : min, { key: null, count: Number.POSITIVE_INFINITY });
}

function correlationGate(samples, key, config) {
  const result = pearson(samples, key);
  const ciUpper = result.absCi95 ? result.absCi95[1] : null;
  return {
    label: config.label,
    rationale: "Fisher-z 95% CI on Pearson r; bounds keep combat-relevant variables visible without allowing one axis to dominate final score.",
    variable: key,
    minAbsCiUpperInclusive: config.minAbsCiUpperInclusive,
    maxAbsCiUpperInclusive: config.maxAbsCiUpperInclusive,
    ...result,
    passed:
      ciUpper !== null &&
      ciUpper >= config.minAbsCiUpperInclusive &&
      ciUpper <= config.maxAbsCiUpperInclusive,
  };
}

function spreadGate(samples) {
  const groups = {
    build: groupedStats(samples, "build"),
    scenario: groupedStats(samples, "scenario"),
  };
  const failures = [];
  for (const [groupKind, grouped] of Object.entries(groups)) {
    for (const [name, stats] of Object.entries(grouped)) {
      checkSpread(`${groupKind}:${name}`, stats, failures);
    }
  }
  return {
    thresholds: {
      minScoreIqr: SPREAD_MIN_SCORE_IQR,
      minScoreStddev: SPREAD_MIN_SCORE_STDDEV,
      maxCostP99: SPREAD_MAX_COST_P99,
      maxInjuryP99: SPREAD_MAX_INJURY_P99,
      maxCv: SPREAD_MAX_CV,
    },
    failureCount: failures.length,
    failures: failures.slice(0, 50),
    passed: failures.length === 0,
  };
}

function checkSpread(label, stats, failures) {
  if (stats.runs <= 0) {
    failures.push({ label, reason: "empty_slice" });
    return;
  }
  for (const metric of ["score", "cost", "injury"]) {
    const current = stats[metric];
    if (current.count <= 0 || current.iqr === null || current.stddev === null || current.cv === null) {
      failures.push({ label, metric, reason: "missing_distribution" });
      continue;
    }
    if (metric === "score" && (current.iqr < SPREAD_MIN_SCORE_IQR || current.stddev < SPREAD_MIN_SCORE_STDDEV)) {
      failures.push({ label, metric, reason: "score_spread_too_narrow", iqr: current.iqr, stddev: current.stddev });
    }
    if (current.cv > SPREAD_MAX_CV) {
      failures.push({ label, metric, reason: "cv_too_high", cv: current.cv });
    }
  }
  if (stats.cost.p99 !== null && stats.cost.p99 > SPREAD_MAX_COST_P99) {
    failures.push({ label, metric: "cost", reason: "cost_tail_explosion", p99: stats.cost.p99 });
  }
  if (stats.injury.p99 !== null && stats.injury.p99 > SPREAD_MAX_INJURY_P99) {
    failures.push({ label, metric: "injury", reason: "injury_tail_explosion", p99: stats.injury.p99 });
  }
}

function validateSamples(records) {
  const samples = [];
  const schemaErrors = [];
  const resource = { evaluatedRuns: 0, anomalousRuns: 0, unevaluableRuns: 0 };

  records.forEach((record, index) => {
    const sample = extractSample(record);
    const label = `records[${index}]`;
    if (sample.score === undefined) {
      schemaErrors.push(`${label}.score is required and must be numeric`);
    }
    if (sample.intensity === undefined) {
      schemaErrors.push(`${label}.intensity is required and must be numeric`);
    }
    if (!sample.suitabilityBand) {
      schemaErrors.push(`${label}.suitabilityBand is required`);
    }
    if (!sample.build) {
      schemaErrors.push(`${label}.build is required`);
    }
    if (!sample.scenario) {
      schemaErrors.push(`${label}.scenario is required`);
    }
    if (sample.success === undefined) {
      schemaErrors.push(`${label}.success is required and must be boolean-like`);
    }
    if (sample.cost === undefined) {
      schemaErrors.push(`${label}.cost is required and must be numeric`);
    }
    if (sample.injury === undefined) {
      schemaErrors.push(`${label}.injury is required and must be numeric`);
    }
    if (sample.combatSuitability === undefined) {
      schemaErrors.push(`${label}.audit.production.combatSuitability is required and must be numeric`);
    }
    if (!sample.outcome) {
      schemaErrors.push(`${label}.outcome is required`);
    }
    if (sample.priorVersion !== DESIGN_PRIOR_VERSION) {
      schemaErrors.push(`${label}.metadata.sampling.priorVersion must be ${DESIGN_PRIOR_VERSION}`);
    }
    if (!sample.seed || !sample.seedHash) {
      schemaErrors.push(`${label}.metadata.seed and metadata.seedHash are required`);
    }
    if (!sample.stratumBuild || !sample.stratumScenario || !sample.stratumGrowthChoice || !sample.stratumOutcome || !sample.stratumIntensityTier) {
      schemaErrors.push(`${label}.metadata.sampling.strata must include build, scenario, growthChoice, outcome, intensityTier`);
    }
    if (!sample.priors || typeof sample.priors !== "object") {
      schemaErrors.push(`${label}.metadata.sampling.priors is required`);
    }

    const resourceCheck = resourceAnomaly(record);
    if (resourceCheck.evaluated) {
      resource.evaluatedRuns += 1;
    } else {
      resource.unevaluableRuns += 1;
    }
    if (resourceCheck.anomalous) {
      resource.anomalousRuns += 1;
    }

    samples.push(sample);
  });

  return { samples, schemaErrors, resource };
}

function buildReport(options, parsed) {
  const secretState = { secretPaths: new Set() };
  parsed.records.forEach((record, index) => scanForSecrets(record, `records[${index}]`, secretState));
  const { samples, schemaErrors, resource } = validateSamples(parsed.records);
  const correlations = {
    scoreIntensity: correlationGate(samples, "intensity", CORRELATION_GATES.intensity),
    scoreCombatSuitability: correlationGate(samples, "combatSuitability", CORRELATION_GATES.combatSuitability),
    scoreSuccess: correlationGate(samples, "success", CORRELATION_GATES.success),
    scoreInjury: correlationGate(samples, "injury", CORRELATION_GATES.injury),
  };
  const scoreHistogram = histogramConcentration(samples);
  const dominance = buildDominance(samples);
  const priors = priorAudit(samples, options.expectedRuns);
  const spread = spreadGate(samples);

  const gates = {
    expectedRuns: {
      passed: parsed.records.length === options.expectedRuns,
      expected: options.expectedRuns,
      actual: parsed.records.length,
    },
    parseableInput: {
      passed: parsed.parseErrors.length === 0,
      parseErrors: parsed.parseErrors.slice(0, MAX_PARSE_ERRORS),
      parseErrorCount: parsed.parseErrors.length,
    },
    noSecretMaterial: {
      passed: secretState.secretPaths.size === 0,
      secretPathCount: secretState.secretPaths.size,
      secretPaths: [...secretState.secretPaths].slice(0, MAX_SECRET_PATHS),
    },
    schema: {
      passed: schemaErrors.length === 0,
      errorCount: schemaErrors.length,
      errors: schemaErrors.slice(0, MAX_SCHEMA_ERRORS),
    },
    observedDesignPriors: priors,
    pearsonFisherCi: {
      passed: Object.values(correlations).every((entry) => entry.passed),
      correlations,
    },
    scoreHistogramEntropy: scoreHistogram,
    singleBuildDominance: dominance,
    stratifiedSpread: spread,
    resourceConservation: {
      passed: resource.anomalousRuns === 0,
      ...resource,
    },
  };

  const passed = Object.values(gates).every((gate) => gate.passed === true);

  return {
    schemaVersion: SCHEMA_VERSION,
    passed,
    input: {
      source: options.inputPath ? "file" : "stdin",
      expectedRuns: options.expectedRuns,
      observedRuns: parsed.records.length,
    },
    gates,
    metrics: {
      overall: summarizeGroup(samples),
      bySuitabilityBand: groupedStats(samples, "suitabilityBand"),
      byBuild: groupedStats(samples, "build"),
      byScenario: groupedStats(samples, "scenario"),
      priors,
      correlations,
      scoreHistogram,
    },
  };
}

function printJson(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function main() {
  try {
    const options = parseArguments(process.argv.slice(2));
    if (options.help) {
      printJson({ schemaVersion: SCHEMA_VERSION, usage: usage().split("\n") });
      return;
    }

    const input = readInput(options.inputPath);
    const parsed = parseRecords(input);
    const report = buildReport(options, parsed);
    printJson(report);
    if (!report.passed) {
      process.exitCode = 1;
    }
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
