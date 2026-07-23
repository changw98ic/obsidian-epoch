#!/usr/bin/env node
// @ts-nocheck

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  ATTESTATION_KEY_ENV,
  loadAttestationKey,
  validateExecutionReceipt,
} from "./phase6-command-runner.ts";

const SCHEMA_VERSION = "obsidian-epoch.phase6-release-gate.v1";
const EVIDENCE_SCHEMA_VERSION = "obsidian-epoch.phase6-evidence-pack.v2";
const HASH_PATTERN = /^sha256:[a-f0-9]{64}$/;
const SIGNATURE_PATTERN = /^hmac-sha256:[a-f0-9]{64}$/;
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "../..");
const SECRET_KEY = /(?:secret|token|api[-_]?key|authorization|password|credential|private[-_]?key|access[-_]?key|refresh[-_]?token|session[-_]?key|recovery[-_]?code|operator[-_]?key|client[-_]?secret)/i;
const SECRET_VALUE = /(?:\b(?:sk-[A-Za-z0-9_-]{12,}|Bearer\s+[A-Za-z0-9._~+/=-]{12,}|xox[baprs]-[A-Za-z0-9-]{12,}|AKIA[0-9A-Z]{16})\b|-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----)/i;
const REQUIRED_GATES = Object.freeze([
  "tenRun",
  "playerPanel",
  "idempotency",
  "economy",
  "world",
  "progression",
  "score",
  "rag",
  "balance",
  "shop",
  "crafting",
  "progress",
]);

const GATE_SCRIPTS = Object.freeze({
  tenRun: "phase6-ten-run.ts",
  playerPanel: "phase6-player-panel-gate.ts",
  idempotency: "phase6-idempotency-gate.ts",
  economy: "phase6-economy-gate.ts",
  world: "phase6-world-gate.ts",
  progression: "phase6-progression-gate.ts",
  score: "phase6-score-gate.ts",
  rag: "phase6-rag-gate.ts",
  balance: "phase6-balance-gate.ts",
  shop: "phase6-shop-gate.ts",
  crafting: "phase6-crafting-gate.ts",
  progress: "phase6-progress.ts",
});

function usage() {
  return [
    "Usage: node tools/agent-server/phase6-release-gate.mjs --config <repo-json> [--output <repo-json>]",
    "",
    "Runs the fixed Phase 6 release gate sequence with shell:false and prints a redacted aggregate JSON report.",
    "All required gates, fresh progress, and a current evidenceManifest must validate for ok=true.",
  ].join("\n");
}

function main() {
  let outputPath;
  let report;
  try {
    const options = parseArguments(process.argv.slice(2));
    if (options.help) {
      process.stdout.write(`${usage()}\n`);
      return;
    }
    try {
      loadAttestationKey();
    } catch (error) {
      throw codedError("E_ATTESTATION_KEY", error.message);
    }
    const configPath = resolveExistingRepoFile(options.configPath, "--config");
    outputPath = options.outputPath ? resolveNewRepoFile(options.outputPath, "--output") : undefined;
    const configText = fs.readFileSync(configPath.real, "utf8");
    const config = parseJson(configText, "E_CONFIG_JSON");
    const configSecretCount = countSecrets(config);
    const configErrors = validateConfig(config, configSecretCount);

    const gateReports = configErrors.length === 0
      ? REQUIRED_GATES.map((gateName) => runGate(gateName, config.gates[gateName]))
      : REQUIRED_GATES.map((gateName) => missingGateReport(gateName, "E_CONFIG_INVALID"));

    report = buildReport({
      config,
      configHash: sha256Text(configText),
      configErrors,
      configSecretCount,
      gates: gateReports,
    });
  } catch (error) {
    report = failureReport(error?.code || "E_RUNTIME", error?.message || "runtime failure");
  }

  const text = `${JSON.stringify(report, null, 2)}\n`;
  if (outputPath) {
    fs.writeFileSync(outputPath.real, text, { flag: "wx" });
  }
  process.stdout.write(text);
  process.exitCode = report.ok ? 0 : 1;
}

function parseArguments(argv) {
  const options = { configPath: undefined, outputPath: undefined, help: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help" || argument === "-h") {
      options.help = true;
      continue;
    }
    if (SECRET_KEY.test(argument) || SECRET_VALUE.test(argument)) throw codedError("E_ARGUMENT_SECRET", "secret-like argument rejected");
    if (argument === "--config") {
      const value = argv[index + 1];
      if (!value) throw codedError("E_ARGUMENT", "--config requires a repository-local JSON path");
      if (SECRET_KEY.test(value) || SECRET_VALUE.test(value)) throw codedError("E_ARGUMENT_SECRET", "secret-like --config path rejected");
      options.configPath = value;
      index += 1;
      continue;
    }
    if (argument === "--output") {
      const value = argv[index + 1];
      if (!value) throw codedError("E_ARGUMENT", "--output requires a repository-local report path");
      if (SECRET_KEY.test(value) || SECRET_VALUE.test(value)) throw codedError("E_ARGUMENT_SECRET", "secret-like --output path rejected");
      options.outputPath = value;
      index += 1;
      continue;
    }
    throw codedError("E_ARGUMENT", "unknown argument");
  }
  if (!options.help && !options.configPath) throw codedError("E_ARGUMENT", "--config is required");
  return options;
}

function validateConfig(config, secretCount) {
  const errors = [];
  if (!isRecord(config)) {
    errors.push(error("E_CONFIG_SHAPE"));
    return errors;
  }
  if (secretCount > 0) errors.push(error("E_CONFIG_SECRET", { count: secretCount }));
  if (!isRecord(config.gates)) {
    errors.push(error("E_CONFIG_GATES_REQUIRED"));
    return errors;
  }
  if (!isRecord(config.freshnessPolicy) || !Number.isFinite(config.freshnessPolicy.verifiedMaxAgeMinutes) || config.freshnessPolicy.verifiedMaxAgeMinutes < 0) {
    errors.push(error("E_FRESHNESS_POLICY_REQUIRED"));
  }
  if (config.evidenceManifest === undefined) {
    errors.push(error("E_EVIDENCE_MANIFEST_REQUIRED"));
  } else if (typeof config.evidenceManifest === "string") {
    errors.push(error("E_EVIDENCE_CONFIG_LEGACY_SHAPE"));
  } else if (!isEvidenceManifestConfig(config.evidenceManifest)) {
    errors.push(error("E_EVIDENCE_CONFIG_INVALID"));
  }
  for (const gateName of REQUIRED_GATES) {
    if (!isRecord(config.gates[gateName])) {
      errors.push(error("E_GATE_CONFIG_MISSING", { gate: gateName }));
    }
  }
  return errors;
}

function runGate(gateName, gateConfig) {
  const argsResult = buildGateArgs(gateName, gateConfig);
  if (!argsResult.ok) return missingGateReport(gateName, argsResult.code, argsResult.details);

  const scriptPath = path.join("tools", "agent-server", GATE_SCRIPTS[gateName]);
  const childEnvironment = {};
  if (gateName === "progress") childEnvironment[ATTESTATION_KEY_ENV] = process.env[ATTESTATION_KEY_ENV];
  const child = spawnSync(process.execPath, [scriptPath, ...argsResult.args], {
    cwd: repositoryRoot,
    encoding: "utf8",
    shell: false,
    env: childEnvironment,
    maxBuffer: 1024 * 1024 * 20,
  });
  const errors = [];
  if (child.error) errors.push(error("E_GATE_SPAWN", { code: child.error.code || "spawn_error" }));
  if (child.status !== 0) errors.push(error("E_GATE_NON_ZERO", { exitCode: child.status ?? null, signal: child.signal ?? null }));
  if (child.stderr && child.stderr.trim().length > 0) errors.push(error("E_GATE_STDERR", { stderrHash: shortHash(child.stderr) }));

  let payload;
  try {
    payload = parseJson(child.stdout || "", "E_GATE_NON_JSON");
  } catch {
    errors.push(error("E_GATE_NON_JSON", { stdoutHash: shortHash(child.stdout || "") }));
  }
  const secretCount = payload === undefined ? 0 : countSecrets(payload);
  if (secretCount > 0) errors.push(error("E_GATE_SECRET_OUTPUT", { count: secretCount }));
  if (payload !== undefined && !gatePayloadPassed(gateName, payload)) {
    errors.push(error("E_GATE_FAILED"));
  }

  return {
    gate: gateName,
    ok: errors.length === 0,
    script: GATE_SCRIPTS[gateName],
    status: child.status ?? null,
    signal: child.signal ?? null,
    outputHash: payload === undefined ? shortHash(child.stdout || "") : canonicalHash(payload),
    summary: payload === undefined ? {} : summarizeGate(gateName, payload),
    errorCodes: unique(errors.map((entry) => entry.code)),
    errors,
  };
}

function buildGateArgs(gateName, gateConfig) {
  try {
    const inputPaths = [];
    const bindPath = (candidate, label) => {
      const argument = repoPath(candidate, label);
      const resolved = resolveExistingRepoFile(argument, label);
      inputPaths.push(repositoryRelativePath(resolved.real));
      return argument;
    };
    const repeatBoundOption = (option, values, label) => values.flatMap((value) => [option, bindPath(value, label)]);
    const success = (args) => okArgs(args, inputPaths);

    switch (gateName) {
      case "tenRun": {
        const args = [];
        args.push("--input", bindPath(gateConfig.input, "input"));
        if (gateConfig.experimentId !== undefined) pushStringOption(args, "--experiment-id", gateConfig.experimentId);
        return success(args);
      }
      case "playerPanel":
        return success([
          "--before",
          bindPath(gateConfig.before, "before"),
          "--after",
          bindPath(gateConfig.after, "after"),
          ...repeatBoundOption("--receipts", nonEmptyPathArray(gateConfig.receipts, "receipts"), "receipts"),
          "--expected-runs",
          positiveInteger(gateConfig.expectedRuns, "expectedRuns"),
        ]);
      case "idempotency": {
        const args = [
          "--command-audit",
          bindPath(gateConfig.commandAudit, "commandAudit"),
          "--settlement-audit",
          bindPath(gateConfig.settlementAudit, "settlementAudit"),
          "--store-audit",
          bindPath(gateConfig.storeAudit, "storeAudit"),
        ];
        if (gateConfig.journey !== undefined) args.push("--journey", bindPath(gateConfig.journey, "journey"));
        if (gateConfig.result !== undefined) args.push("--result", bindPath(gateConfig.result, "result"));
        if (gateConfig.epochEvents !== undefined) args.push("--epoch-events", bindPath(gateConfig.epochEvents, "epochEvents"));
        return success(args);
      }
      case "economy":
        return success(["--expected-runs", positiveInteger(gateConfig.expectedRuns, "expectedRuns"), "--input", bindPath(gateConfig.input, "input")]);
      case "world":
        return success(repeatBoundOption("--input", nonEmptyPathArray(gateConfig.inputs ?? gateConfig.input, "inputs"), "inputs"));
      case "progression":
        return success(["--input", bindPath(gateConfig.input, "input")]);
      case "score": {
        const args = [];
        if (gateConfig.expectedRuns !== undefined) args.push("--expected-runs", positiveInteger(gateConfig.expectedRuns, "expectedRuns"));
        args.push(...nonEmptyPathArray(gateConfig.inputs ?? gateConfig.input, "inputs").map((entry) => bindPath(entry, "inputs")));
        return success(args);
      }
      case "rag":
        return success([
          ...repeatBoundOption("--query-evaluations", nonEmptyPathArray(gateConfig.queryEvaluations, "queryEvaluations"), "queryEvaluations"),
          ...repeatBoundOption("--run-receipts", nonEmptyPathArray(gateConfig.runReceipts, "runReceipts"), "runReceipts"),
        ]);
      case "balance":
        return success(["--expected-runs", allowedBalanceRuns(gateConfig.expectedRuns), "--input", bindPath(gateConfig.input, "input")]);
      case "shop": {
        const args = [];
        if (gateConfig.minSinkSourceBps !== undefined) args.push("--min-sink-source-bps", nonNegativeInteger(gateConfig.minSinkSourceBps, "minSinkSourceBps"));
        args.push(...repeatBoundOption("--input", nonEmptyPathArray(gateConfig.inputs ?? gateConfig.input, "inputs"), "inputs"));
        return success(args);
      }
      case "crafting": {
        const args = [];
        for (const option of ["input", "recipes", "crafts", "settlements", "progression"]) {
          if (gateConfig[option] === undefined) continue;
          args.push(...repeatBoundOption(`--${option}`, pathArray(gateConfig[option], option), option));
        }
        if (args.length === 0) throw codedError("E_GATE_ARGUMENTS", "crafting requires at least one input role");
        return success(args);
      }
      case "progress":
        return success(["--json", "--ledger", bindPath(gateConfig.ledger, "ledger")]);
      default:
        return failArgs("E_GATE_UNKNOWN");
    }
  } catch (caught) {
    return failArgs(caught?.code || "E_GATE_ARGUMENTS", { reasonHash: shortHash(caught?.message || "argument error") });
  }
}

function gatePayloadPassed(gateName, payload) {
  if (!isRecord(payload)) return false;
  if (gateName === "score") return payload.status === "pass";
  if (gateName === "balance") return payload.passed === true;
  if (gateName === "progress") return payload.valid === true && payload.verifiedPercent === 100;
  return payload.ok === true;
}

function summarizeGate(gateName, payload) {
  const summary = {
    schemaVersion: typeof payload.schemaVersion === "string" ? payload.schemaVersion : undefined,
    hash: summarizeHash(payload),
    metrics: summarizeMetrics(payload),
    errorCodes: summarizeErrorCodes(payload),
    experimentIdHashes: experimentIdHashes(payload),
  };
  if (gateName === "score") summary.status = payload.status;
  if (gateName === "balance") summary.passed = payload.passed === true;
  if (gateName === "progress") {
    summary.valid = payload.valid === true;
    summary.verifiedPercent = payload.verifiedPercent ?? null;
    summary.implementedPercent = payload.implementedPercent ?? null;
    summary.progressAsOf = typeof payload.progressAsOf === "string" ? payload.progressAsOf : undefined;
    summary.staleVerifiedItemIds = Array.isArray(payload.staleVerifiedItemIds) ? payload.staleVerifiedItemIds.map(String).sort() : undefined;
    summary.status = typeof payload.status === "string" ? payload.status : undefined;
  } else {
    summary.ok = payload.ok === true;
  }
  return stripUndefined(summary);
}

function summarizeHash(payload) {
  if (typeof payload.hash === "string") return payload.hash;
  if (isRecord(payload.hash)) return payload.hash;
  if (typeof payload.reportIdHash === "string") return payload.reportIdHash;
  if (isRecord(payload.hashes)) return payload.hashes;
  return canonicalHash({
    metrics: payload.metrics,
    counts: payload.counts,
    input: payload.input,
    errorCodes: summarizeErrorCodes(payload),
  });
}

function summarizeMetrics(payload) {
  const metrics = {};
  for (const key of ["metrics", "counts", "statistics", "input", "failureCount", "truncatedErrors", "secretPathCount"]) {
    if (payload[key] !== undefined) metrics[key] = sanitizeSummaryValue(payload[key]);
  }
  return metrics;
}

function summarizeErrorCodes(payload) {
  if (Array.isArray(payload.errorCodes)) return payload.errorCodes.map(String).slice(0, 64);
  if (Array.isArray(payload.errors)) return unique(payload.errors.map((entry) => isRecord(entry) ? entry.code : undefined).filter(Boolean)).slice(0, 64);
  if (Array.isArray(payload.failures)) return unique(payload.failures.map((entry) => isRecord(entry) ? entry.gate : undefined).filter(Boolean)).slice(0, 64);
  return [];
}

export function buildReport({ config, configHash, configErrors, configSecretCount, gates, now = new Date() }) {
  const releaseErrors = [
    ...validateProgressFreshness({
      progressSummary: gates.find((gate) => gate.gate === "progress")?.summary,
      freshnessPolicy: config?.freshnessPolicy,
      now,
    }),
    ...validateEvidenceManifest(config, gates),
  ];
  const missingOrFailed = gates.filter((gate) => !gate.ok).map((gate) => gate.gate);
  const requiredGateStatus = Object.fromEntries(gates.map((gate) => [gate.gate, gate.ok]));
  const ok = configErrors.length === 0 && releaseErrors.length === 0 && missingOrFailed.length === 0;
  return {
    schemaVersion: SCHEMA_VERSION,
    ok,
    generatedAt: now.toISOString(),
    configHash: `sha256:${configHash}`,
    gateOrder: REQUIRED_GATES,
    progressVerifiedPercent: gates.find((gate) => gate.gate === "progress")?.summary?.verifiedPercent ?? null,
    counts: {
      requiredGates: REQUIRED_GATES.length,
      passedGates: gates.filter((gate) => gate.ok).length,
      failedGates: missingOrFailed.length,
      configErrors: configErrors.length + releaseErrors.length,
      configSecretFindings: configSecretCount,
    },
    requiredGateStatus,
    gates,
    errorCodes: unique([
      ...configErrors.map((entry) => entry.code),
      ...releaseErrors.map((entry) => entry.code),
      ...gates.flatMap((gate) => gate.errorCodes || []),
    ]),
    reason: unique([
      ...configErrors.map((entry) => entry.code),
      ...releaseErrors.map((entry) => entry.code),
      ...gates.flatMap((gate) => gate.errorCodes || []),
    ]),
    errors: [...configErrors, ...releaseErrors],
  };
}

function validateProgressFreshness({ progressSummary, freshnessPolicy, now }) {
  const errors = [];
  if (!isRecord(progressSummary)) {
    errors.push(error("E_PROGRESS_REPORT_REQUIRED"));
    return errors;
  }
  if (progressSummary.verifiedPercent !== 100) {
    errors.push(error("E_PROGRESS_NOT_FULLY_VERIFIED", { verifiedPercent: progressSummary.verifiedPercent ?? null }));
  }
  if (!Array.isArray(progressSummary.staleVerifiedItemIds)) {
    errors.push(error("E_PROGRESS_STALE_LIST_REQUIRED"));
  } else if (progressSummary.staleVerifiedItemIds.length > 0) {
    errors.push(error("E_PROGRESS_STALE_VERIFIED_ITEMS", { count: progressSummary.staleVerifiedItemIds.length }));
  }
  if (!isRecord(freshnessPolicy) || !Number.isFinite(freshnessPolicy.verifiedMaxAgeMinutes) || freshnessPolicy.verifiedMaxAgeMinutes < 0) {
    errors.push(error("E_FRESHNESS_POLICY_REQUIRED"));
    return errors;
  }
  if (typeof progressSummary.progressAsOf !== "string" || Number.isNaN(Date.parse(progressSummary.progressAsOf))) {
    errors.push(error("E_PROGRESS_AS_OF_REQUIRED"));
    return errors;
  }
  const ageMinutes = (now.getTime() - Date.parse(progressSummary.progressAsOf)) / 60_000;
  if (ageMinutes < 0) errors.push(error("E_PROGRESS_AS_OF_FUTURE"));
  if (ageMinutes > freshnessPolicy.verifiedMaxAgeMinutes) {
    errors.push(error("E_PROGRESS_STALE", { ageMinutes: Math.floor(ageMinutes), verifiedMaxAgeMinutes: freshnessPolicy.verifiedMaxAgeMinutes }));
  }
  return errors;
}

function isEvidenceManifestConfig(value) {
  if (!isRecord(value)) return false;
  if (typeof value.path !== "string" || value.path.trim() === "") return false;
  if (value.experimentId !== undefined && (typeof value.experimentId !== "string" || value.experimentId.trim() === "")) return false;
  if (value.inputCandidates !== undefined) {
    if (!Array.isArray(value.inputCandidates)) return false;
    if (!value.inputCandidates.every((entry) => isRecord(entry)
      && typeof entry.path === "string"
      && entry.path.trim() !== ""
      && (entry.sha256 === undefined || HASH_PATTERN.test(String(entry.sha256))))) return false;
  }
  return true;
}

function normalizeEvidenceManifestConfig(config) {
  if (!config || config.evidenceManifest === undefined) return undefined;
  return config.evidenceManifest;
}

function validateEvidenceManifest(config, gates) {
  const errors = [];
  if (config?.evidenceManifest === undefined) {
    errors.push(error("E_EVIDENCE_MANIFEST_REQUIRED"));
    return errors;
  }
  if (typeof config.evidenceManifest === "string") {
    errors.push(error("E_EVIDENCE_CONFIG_LEGACY_SHAPE"));
    return errors;
  }
  if (!isEvidenceManifestConfig(config.evidenceManifest)) {
    errors.push(error("E_EVIDENCE_CONFIG_INVALID"));
    return errors;
  }

  const manifestConfig = normalizeEvidenceManifestConfig(config);
  let manifestPath;
  let manifest;
  try {
    manifestPath = resolveExistingRepoFile(manifestConfig.path, "evidenceManifest.path");
    manifest = parseJson(fs.readFileSync(manifestPath.real, "utf8"), "E_EVIDENCE_MANIFEST_JSON");
  } catch (caught) {
    errors.push(error(caught?.code || "E_EVIDENCE_MANIFEST_READ"));
    return errors;
  }

  const secretCount = countSecrets(manifest);
  if (secretCount > 0) errors.push(error("E_EVIDENCE_MANIFEST_SECRET", { count: secretCount }));
  if (!isRecord(manifest)) {
    errors.push(error("E_EVIDENCE_MANIFEST_SHAPE"));
    return errors;
  }
  if (manifest.schemaVersion !== EVIDENCE_SCHEMA_VERSION) errors.push(error("E_EVIDENCE_SCHEMA_VERSION"));
  for (const field of ["experimentId", "generatedAt", "inputCandidates", "command", "artifacts", "outputHash", "manifestHash"]) {
    if (manifest[field] === undefined) errors.push(error("E_EVIDENCE_FIELD_REQUIRED", { field }));
  }
  if (typeof manifest.experimentId !== "string" || manifest.experimentId.trim() === "") errors.push(error("E_EVIDENCE_EXPERIMENT_ID"));
  if (typeof manifest.generatedAt !== "string" || Number.isNaN(Date.parse(manifest.generatedAt))) errors.push(error("E_EVIDENCE_GENERATED_AT"));
  if (!HASH_PATTERN.test(String(manifest.outputHash))) {
    errors.push(error("E_EVIDENCE_OUTPUT_HASH"));
  } else if (manifest.outputHash !== evidenceOutputHash(manifest)) {
    errors.push(error("E_EVIDENCE_OUTPUT_HASH_MISMATCH"));
  }
  if (!HASH_PATTERN.test(String(manifest.manifestHash))) errors.push(error("E_EVIDENCE_MANIFEST_HASH_FORMAT"));
  if (manifest.manifestHash !== evidenceManifestHash(manifest)) errors.push(error("E_EVIDENCE_MANIFEST_HASH_MISMATCH"));

  let inputFiles = new Map();
  if (!Array.isArray(manifest.inputCandidates) || manifest.inputCandidates.length === 0) {
    errors.push(error("E_EVIDENCE_INPUTS_REQUIRED"));
  } else {
    inputFiles = validateManifestFiles(manifest.inputCandidates, "inputCandidates", errors);
  }
  let artifactFiles = new Map();
  if (!Array.isArray(manifest.artifacts) || manifest.artifacts.length === 0) {
    errors.push(error("E_EVIDENCE_ARTIFACTS_REQUIRED"));
  } else {
    artifactFiles = validateManifestFiles(manifest.artifacts, "artifacts", errors);
  }
  const commandExitCode = isRecord(manifest.command) ? manifest.command.exitCode : undefined;
  if (!isRecord(manifest.command)
    || !HASH_PATTERN.test(String(manifest.command.argvHash))
    || !HASH_PATTERN.test(String(manifest.command.receiptHash))
    || !HASH_PATTERN.test(String(manifest.command.keyId))
    || !SIGNATURE_PATTERN.test(String(manifest.command.signature))) {
    errors.push(error("E_EVIDENCE_COMMAND"));
  }
  if (commandExitCode !== 0 || manifest.command?.signal !== null) {
    errors.push(error("E_EVIDENCE_COMMAND_EXIT_CODE", { exitCode: Number.isSafeInteger(commandExitCode) ? commandExitCode : null }));
  }
  validateManifestReceipt(manifest, artifactFiles, errors);

  const manifestFiles = new Map(inputFiles);
  for (const [filePath, entry] of artifactFiles) {
    if (manifestFiles.has(filePath)) {
      errors.push(error("E_EVIDENCE_DUPLICATE_FILE", { field: "inputCandidates/artifacts", pathHash: shortHash(filePath) }));
    } else {
      manifestFiles.set(filePath, entry);
    }
  }

  validateConfiguredCandidates(manifestConfig, inputFiles, errors);
  const gateInputs = collectGateInputBindings(config, errors);
  validateGateInputBindings(gateInputs, manifestFiles, errors);
  validateExperimentBindings({ config, manifestConfig, manifest, gates, gateInputs, manifestFiles, errors });

  return errors;
}

function validateConfiguredCandidates(manifestConfig, inputFiles, errors) {
  if (!Array.isArray(manifestConfig.inputCandidates)) return;
  for (const candidate of manifestConfig.inputCandidates) {
    let candidatePath;
    try {
      candidatePath = repositoryRelativePath(resolveExistingRepoFile(candidate.path, "evidenceManifest.inputCandidates").real);
    } catch (caught) {
      errors.push(error("E_EVIDENCE_CANDIDATE_MISSING", { pathHash: shortHash(candidate.path), reasonCode: caught?.code || "E_INPUT_PATH" }));
      continue;
    }
    const actual = inputFiles.get(candidatePath);
    if (!actual) {
      errors.push(error("E_EVIDENCE_CANDIDATE_MISSING", { pathHash: shortHash(candidatePath) }));
    } else if (candidate.sha256 !== undefined && actual.sha256 !== candidate.sha256) {
      errors.push(error("E_EVIDENCE_CANDIDATE_HASH_MISMATCH", { pathHash: shortHash(candidatePath) }));
    }
  }
}

function collectGateInputBindings(config, errors) {
  const byPath = new Map();
  for (const gateName of REQUIRED_GATES) {
    const gateConfig = config?.gates?.[gateName];
    if (!isRecord(gateConfig)) {
      errors.push(error("E_EVIDENCE_GATE_INPUT_CONFIG", { gate: gateName, reasonCode: "E_GATE_CONFIG_MISSING" }));
      continue;
    }
    const argsResult = buildGateArgs(gateName, gateConfig);
    if (!argsResult.ok) {
      errors.push(error("E_EVIDENCE_GATE_INPUT_CONFIG", { gate: gateName, reasonCode: argsResult.code }));
      continue;
    }
    for (const filePath of argsResult.inputPaths) {
      const binding = byPath.get(filePath) || { path: filePath, gates: new Set() };
      binding.gates.add(gateName);
      byPath.set(filePath, binding);
    }
  }
  return [...byPath.values()]
    .map((entry) => ({ path: entry.path, gates: [...entry.gates].sort() }))
    .sort((left, right) => left.path.localeCompare(right.path));
}

function validateGateInputBindings(gateInputs, manifestFiles, errors) {
  for (const binding of gateInputs) {
    const actual = manifestFiles.get(binding.path);
    if (!actual) {
      errors.push(error("E_EVIDENCE_GATE_INPUT_MISSING", { gates: binding.gates, pathHash: shortHash(binding.path) }));
      continue;
    }
    const currentHash = `sha256:${sha256File(path.resolve(repositoryRoot, binding.path))}`;
    if (actual.sha256 !== currentHash) {
      errors.push(error("E_EVIDENCE_GATE_INPUT_HASH_MISMATCH", { gates: binding.gates, pathHash: shortHash(binding.path) }));
    }
  }
}

function validateManifestFiles(entries, field, errors) {
  const seen = new Set();
  const files = new Map();
  for (const entry of entries) {
    if (!isRecord(entry) || typeof entry.path !== "string" || !HASH_PATTERN.test(String(entry.sha256))) {
      errors.push(error("E_EVIDENCE_FILE_ENTRY", { field }));
      continue;
    }
    const normalizedPath = normalizeRepoPath(entry.path);
    if (seen.has(normalizedPath)) errors.push(error("E_EVIDENCE_DUPLICATE_FILE", { field, pathHash: shortHash(normalizedPath) }));
    seen.add(normalizedPath);
    let file;
    try {
      file = resolveExistingRepoFile(normalizedPath, field);
    } catch (caught) {
      errors.push(error("E_EVIDENCE_FILE_MISSING", { field, pathHash: shortHash(normalizedPath), reasonCode: caught?.code || "E_INPUT_PATH" }));
      continue;
    }
    const canonicalPath = repositoryRelativePath(file.real);
    if (canonicalPath !== normalizedPath) {
      errors.push(error("E_EVIDENCE_FILE_PATH_NON_CANONICAL", { field, pathHash: shortHash(normalizedPath) }));
      continue;
    }
    const stat = fs.statSync(file.real);
    if (stat.size === 0) errors.push(error("E_EVIDENCE_EMPTY_FILE", { field, pathHash: shortHash(normalizedPath) }));
    const contentSecretCount = countSecretsInText(fs.readFileSync(file.real, "utf8"));
    if (contentSecretCount > 0) errors.push(error("E_EVIDENCE_FILE_SECRET", { field, pathHash: shortHash(normalizedPath), count: contentSecretCount }));
    if (field === "artifacts" && entry.bytes !== stat.size) errors.push(error("E_EVIDENCE_BYTES_MISMATCH", { pathHash: shortHash(normalizedPath) }));
    const currentHash = `sha256:${sha256File(file.real)}`;
    if (currentHash !== entry.sha256) errors.push(error("E_EVIDENCE_FILE_HASH_MISMATCH", { field, pathHash: shortHash(normalizedPath) }));
    files.set(canonicalPath, { ...entry, currentHash, manifestField: field });
  }
  return files;
}

function validateManifestReceipt(manifest, artifactFiles, errors) {
  if (!isRecord(manifest.command)) return;
  let receiptPath;
  try {
    receiptPath = resolveExistingRepoFile(manifest.command.receiptPath, "command.receiptPath");
  } catch (caught) {
    errors.push(error("E_EVIDENCE_RECEIPT_MISSING", { reasonCode: caught?.code || "E_INPUT_PATH" }));
    return;
  }
  let receipt;
  try {
    receipt = parseJson(fs.readFileSync(receiptPath.real, "utf8"), "E_EVIDENCE_RECEIPT_JSON");
  } catch (caught) {
    errors.push(error(caught?.code || "E_EVIDENCE_RECEIPT_JSON"));
    return;
  }
  const validation = validateExecutionReceipt(receipt);
  for (const message of validation.errors) {
    errors.push(error("E_EVIDENCE_RECEIPT_INVALID", { detailHash: shortHash(message) }));
  }
  if (receipt.receiptHash !== manifest.command.receiptHash) errors.push(error("E_EVIDENCE_RECEIPT_HASH_MISMATCH"));
  for (const field of ["schemaVersion", "program", "argvHash", "cwd", "startedAt", "endedAt", "exitCode", "signal", "stdout", "stderr", "outputs", "keyId", "signature"]) {
    if (JSON.stringify(manifest.command[field]) !== JSON.stringify(receipt[field])) {
      errors.push(error("E_EVIDENCE_RECEIPT_SUMMARY_MISMATCH", { field }));
    }
  }
  const receiptOutputs = new Map(Array.isArray(receipt.outputs) ? receipt.outputs.map((entry) => [entry.path, entry]) : []);
  for (const [artifactPath, artifact] of artifactFiles) {
    const output = receiptOutputs.get(artifactPath);
    if (!output) {
      errors.push(error("E_EVIDENCE_ARTIFACT_RECEIPT_MISSING", { pathHash: shortHash(artifactPath) }));
    } else if (output.sha256 !== artifact.sha256 || output.bytes !== artifact.bytes) {
      errors.push(error("E_EVIDENCE_ARTIFACT_RECEIPT_MISMATCH", { pathHash: shortHash(artifactPath) }));
    }
  }
}

function validateExperimentBindings({ config, manifestConfig, manifest, gates, gateInputs, manifestFiles, errors }) {
  if (typeof manifest.experimentId !== "string" || manifest.experimentId.trim() === "") return;

  const expectedId = manifest.experimentId;
  const expectedHash = experimentIdHash(expectedId);
  const configuredId = config?.gates?.tenRun?.experimentId;
  if (configuredId !== undefined && configuredId !== expectedId) {
    errors.push(error("E_EVIDENCE_EXPERIMENT_MISMATCH", { source: "tenRun.config" }));
  }
  if (manifestConfig.experimentId !== undefined && manifestConfig.experimentId !== expectedId) {
    errors.push(error("E_EVIDENCE_EXPERIMENT_MISMATCH", { source: "evidenceManifest.config" }));
  }

  const tenRunSummary = gates?.find((gate) => gate.gate === "tenRun")?.summary;
  if (!isRecord(tenRunSummary) || !Array.isArray(tenRunSummary.experimentIdHashes) || tenRunSummary.experimentIdHashes.length === 0) {
    errors.push(error("E_EVIDENCE_TEN_RUN_EXPERIMENT_REQUIRED"));
  }

  for (const gate of gates || []) {
    const hashes = gate?.summary?.experimentIdHashes;
    if (hashes === undefined) continue;
    if (!Array.isArray(hashes) || hashes.length === 0 || hashes.some((entry) => !HASH_PATTERN.test(String(entry)))) {
      errors.push(error("E_EVIDENCE_GATE_EXPERIMENT_INVALID", { gate: gate.gate }));
      continue;
    }
    if (hashes.some((entry) => entry !== expectedHash)) {
      errors.push(error("E_EVIDENCE_EXPERIMENT_MISMATCH", { source: "gate.output", gate: gate.gate }));
    }
  }

  const gateBindings = new Map(gateInputs.map((binding) => [binding.path, binding.gates]));
  for (const [filePath, manifestFile] of manifestFiles) {
    const inspection = inspectFileExperimentIds(path.resolve(repositoryRoot, filePath));
    if (inspection.unparsedMentions > 0) {
      errors.push(error("E_EVIDENCE_EXPERIMENT_PARSE", {
        manifestField: manifestFile.manifestField,
        gates: gateBindings.get(filePath) || [],
        pathHash: shortHash(filePath),
        count: inspection.unparsedMentions,
      }));
    }
    const mismatches = [...inspection.ids].filter((entry) => entry !== expectedId);
    if (mismatches.length > 0) {
      errors.push(error("E_EVIDENCE_EXPERIMENT_MISMATCH", {
        source: "manifest.file",
        manifestField: manifestFile.manifestField,
        gates: gateBindings.get(filePath) || [],
        pathHash: shortHash(filePath),
        count: mismatches.length,
      }));
    }
  }
}

function inspectFileExperimentIds(filePath) {
  const text = fs.readFileSync(filePath, "utf8");
  const ids = new Set();
  const whole = tryParseJson(text);
  if (whole !== undefined) {
    collectExperimentIds(whole, ids);
    return { ids, unparsedMentions: 0 };
  }

  let unparsedMentions = 0;
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const parsed = extractJsonCandidate(line);
    if (parsed === undefined) {
      if (/(?:"|')?experiment(?:Id|_id)(?:"|')?\s*[:=]/i.test(line)) unparsedMentions += 1;
      continue;
    }
    collectExperimentIds(parsed, ids);
  }
  return { ids, unparsedMentions };
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
  const direct = tryParseJson(trimmed);
  if (direct !== undefined) return direct;
  for (const [opening, closing] of [["{", "}"], ["[", "]"]]) {
    const start = trimmed.indexOf(opening);
    const end = trimmed.lastIndexOf(closing);
    if (start < 0 || end <= start) continue;
    const parsed = tryParseJson(trimmed.slice(start, end + 1));
    if (parsed !== undefined) return parsed;
  }
  return undefined;
}

function collectExperimentIds(value, ids = new Set()) {
  if (Array.isArray(value)) {
    for (const entry of value) collectExperimentIds(entry, ids);
    return ids;
  }
  if (!isRecord(value)) return ids;
  for (const [key, entry] of Object.entries(value)) {
    if (/^experiment(?:Id|_id)$/i.test(key) && ["string", "number"].includes(typeof entry) && String(entry).trim() !== "") {
      ids.add(String(entry));
    }
    if (/^experiment$/i.test(key) && isRecord(entry) && ["string", "number"].includes(typeof entry.id) && String(entry.id).trim() !== "") {
      ids.add(String(entry.id));
    }
    collectExperimentIds(entry, ids);
  }
  return ids;
}

function experimentIdHashes(value) {
  const hashes = [...collectExperimentIds(value)].sort().map(experimentIdHash);
  return hashes.length > 0 ? hashes : undefined;
}

function experimentIdHash(value) {
  return `sha256:${sha256Text(String(value))}`;
}

function normalizeRepoPath(candidate) {
  return path.normalize(candidate).split(path.sep).join("/");
}

function repositoryRelativePath(realPath) {
  return path.relative(repositoryRoot, realPath).split(path.sep).join("/");
}

function evidenceManifestHash(manifest) {
  const { manifestHash: _manifestHash, ...withoutHash } = manifest;
  return canonicalHash(withoutHash);
}

function evidenceOutputHash(manifest) {
  return canonicalHash({
    inputCandidates: manifest.inputCandidates,
    command: manifest.command,
    artifacts: manifest.artifacts,
  });
}

function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function failureReport(code, message) {
  return {
    schemaVersion: SCHEMA_VERSION,
    ok: false,
    generatedAt: new Date().toISOString(),
    gateOrder: REQUIRED_GATES,
    counts: { requiredGates: REQUIRED_GATES.length, passedGates: 0, failedGates: REQUIRED_GATES.length, configErrors: 1 },
    requiredGateStatus: Object.fromEntries(REQUIRED_GATES.map((gate) => [gate, false])),
    gates: REQUIRED_GATES.map((gate) => missingGateReport(gate, code)),
    errorCodes: [code],
    reason: [code],
    errors: [error(code, { messageHash: shortHash(message) })],
  };
}

function missingGateReport(gateName, code, details = undefined) {
  const entry = error(code, details);
  return {
    gate: gateName,
    ok: false,
    script: GATE_SCRIPTS[gateName],
    status: null,
    signal: null,
    outputHash: shortHash(`${gateName}:${code}`),
    summary: {},
    errorCodes: [code],
    errors: [entry],
  };
}

function pushStringOption(args, option, value) {
  if (typeof value !== "string" || value.trim() === "") throw codedError("E_GATE_ARGUMENTS", `${option} requires a string`);
  if (SECRET_KEY.test(value) || SECRET_VALUE.test(value)) throw codedError("E_ARGUMENT_SECRET", `${option} contains secret-like text`);
  args.push(option, value);
}

function pathArray(value, label) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") return [value];
  throw codedError("E_GATE_ARGUMENTS", `${label} must be a path or path array`);
}

function nonEmptyPathArray(value, label) {
  const values = pathArray(value, label);
  if (values.length === 0) throw codedError("E_GATE_ARGUMENTS", `${label} cannot be empty`);
  return values;
}

function repoPath(candidate, label) {
  if (typeof candidate !== "string" || candidate.length === 0 || path.isAbsolute(candidate)) {
    throw codedError("E_INPUT_PATH", `${label} must be repository-relative`);
  }
  if (SECRET_KEY.test(candidate) || SECRET_VALUE.test(candidate)) throw codedError("E_ARGUMENT_SECRET", `${label} contains secret-like text`);
  const normalized = path.normalize(candidate);
  if (normalized === ".." || normalized.startsWith(`..${path.sep}`)) {
    throw codedError("E_INPUT_PATH", `${label} must not traverse outside repository`);
  }
  resolveExistingRepoFile(candidate, label);
  return candidate;
}

function resolveExistingRepoFile(candidate, label) {
  if (typeof candidate !== "string" || candidate.length === 0 || path.isAbsolute(candidate)) {
    throw codedError("E_INPUT_PATH", `${label} must be repository-relative`);
  }
  const resolved = path.resolve(repositoryRoot, candidate);
  let real;
  let stat;
  try {
    real = fs.realpathSync(resolved);
    stat = fs.statSync(real);
  } catch {
    throw codedError("E_INPUT_PATH", `${label} not found`);
  }
  if (!insideRepository(real)) throw codedError("E_INPUT_PATH", `${label} resolves outside repository`);
  if (!stat.isFile()) throw codedError("E_INPUT_PATH", `${label} is not a file`);
  return { real };
}

function resolveNewRepoFile(candidate, label) {
  if (typeof candidate !== "string" || candidate.length === 0 || path.isAbsolute(candidate)) {
    throw codedError("E_OUTPUT_PATH", `${label} must be repository-relative`);
  }
  if (SECRET_KEY.test(candidate) || SECRET_VALUE.test(candidate)) throw codedError("E_ARGUMENT_SECRET", `${label} contains secret-like text`);
  const normalized = path.normalize(candidate);
  if (normalized === ".." || normalized.startsWith(`..${path.sep}`)) throw codedError("E_OUTPUT_PATH", `${label} must not traverse outside repository`);
  const realParent = fs.realpathSync(path.dirname(path.resolve(repositoryRoot, normalized)));
  if (!insideRepository(realParent)) throw codedError("E_OUTPUT_PATH", `${label} parent resolves outside repository`);
  const real = path.join(realParent, path.basename(normalized));
  if (fs.existsSync(real)) throw codedError("E_OUTPUT_EXISTS", `${label} already exists`);
  return { real };
}

function insideRepository(realPath) {
  const root = fs.realpathSync(repositoryRoot);
  const relative = path.relative(root, realPath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function positiveInteger(value, label) {
  if (!Number.isSafeInteger(value) || value <= 0) throw codedError("E_GATE_ARGUMENTS", `${label} must be a positive integer`);
  return String(value);
}

function nonNegativeInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) throw codedError("E_GATE_ARGUMENTS", `${label} must be a non-negative integer`);
  return String(value);
}

function allowedBalanceRuns(value) {
  if (value !== 10000 && value !== 100000) throw codedError("E_GATE_ARGUMENTS", "balance expectedRuns must be 10000 or 100000");
  return String(value);
}

function okArgs(args, inputPaths = []) {
  return { ok: true, args, inputPaths: unique(inputPaths) };
}

function failArgs(code, details = undefined) {
  return { ok: false, code, details };
}

function parseJson(text, code) {
  try {
    return JSON.parse(text);
  } catch {
    throw codedError(code, "invalid JSON");
  }
}

function sanitizeSummaryValue(value) {
  if (Array.isArray(value)) return value.slice(0, 32).map(sanitizeSummaryValue);
  if (!isRecord(value)) return value;
  const output = {};
  for (const [key, entry] of Object.entries(value)) {
    if (/path|file|argv|env|input/i.test(key) && typeof entry === "string") {
      output[`${key}Hash`] = shortHash(entry);
      continue;
    }
    output[key] = sanitizeSummaryValue(entry);
  }
  return output;
}

function countSecrets(value) {
  let count = 0;
  walk(value, (key, entry) => {
    if (SECRET_KEY.test(key)) count += 1;
    if (typeof entry === "string" && SECRET_VALUE.test(entry)) count += 1;
  });
  return count;
}

function countSecretsInText(text) {
  let count = 0;
  for (const line of String(text).split(/\r?\n/)) {
    if (SECRET_KEY.test(line)) count += 1;
    if (SECRET_VALUE.test(line)) count += 1;
  }
  return count;
}

function walk(value, visitor, parentKey = "") {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => walk(entry, visitor, `${parentKey}[${index}]`));
    return;
  }
  if (!isRecord(value)) {
    visitor(parentKey, value);
    return;
  }
  for (const [key, entry] of Object.entries(value)) {
    visitor(key, entry);
    walk(entry, visitor, key);
  }
}

function canonicalHash(value) {
  return `sha256:${crypto.createHash("sha256").update(stableJson(value)).digest("hex")}`;
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (!isRecord(value)) return JSON.stringify(value);
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
}

function sha256Text(text) {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}

function shortHash(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex").slice(0, 16);
}

function unique(values) {
  return [...new Set(values)].sort();
}

function stripUndefined(value) {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined));
}

function error(code, details = undefined) {
  return details === undefined ? { code } : { code, ...details };
}

function codedError(code, message) {
  const failure = new Error(message);
  failure.code = code;
  return failure;
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main();
}
