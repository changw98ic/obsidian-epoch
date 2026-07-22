#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ATTESTATION_KEY_ENV,
  loadAttestationKey,
  summarizeReceipt,
  validateExecutionReceipt,
} from "./phase6-command-runner.mjs";

export const SCHEMA_VERSION = "obsidian-epoch.phase6-evidence-pack.v2";
const HASH_PATTERN = /^sha256:[a-f0-9]{64}$/;
const SECRET_KEY = /(?:secret|token|api[-_]?key|authorization|password|credential|private[-_]?key|access[-_]?key|refresh[-_]?token|session[-_]?key|client[-_]?secret|recovery[-_]?code|operator[-_]?key)/i;
const SECRET_VALUE = /(?:\b(?:sk-[A-Za-z0-9_-]{12,}|Bearer\s+[A-Za-z0-9._~+/=-]{12,}|xox[baprs]-[A-Za-z0-9-]{12,}|AKIA[0-9A-Z]{16})\b|-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----)/i;

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "../..");

function usage() {
  return [
    "Usage: node tools/agent-server/phase6-evidence-pack.mjs --experiment-id <id> --input-candidate <path> --output-artifact <path> --output <manifest-path> [options]",
    "",
    "Options:",
    "  --input-candidate <path>  Candidate input file to bind into the manifest; repeatable",
    "  --output-artifact <path>  Output artifact file to bind into the manifest; repeatable",
    "  --artifact <path>         Compatibility alias for --output-artifact",
    "  --execution-receipt <path> Private receipt produced by phase6-command-runner.mjs",
    "",
    `Requires ${ATTESTATION_KEY_ENV} to name the repository-external 0600 key used to verify the receipt.`,
    "The manifest never stores raw argv. It stores only command receipt hashes and file hashes.",
  ].join("\n");
}

function printJson(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function fail(errors, status = "error") {
  printJson({
    ok: false,
    status,
    schemaVersion: SCHEMA_VERSION,
    reason: errors.map((entry) => entry.code).sort(),
    errors: errors.map((entry) => ({
      code: entry.code,
      message: entry.message,
      path: entry.path,
    })),
  });
  process.exitCode = 1;
}

function parseArguments(argv) {
  const options = {
    inputCandidates: [],
    artifacts: [],
    experimentId: undefined,
    output: undefined,
    executionReceipt: undefined,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    rejectSecretText(argument, "argument");
    if (argument === "--help" || argument === "-h") {
      options.help = true;
      continue;
    }
    if (argument === "--experiment-id") {
      options.experimentId = readValue(argv, ++index, "--experiment-id");
      rejectSecretText(options.experimentId, "--experiment-id");
      continue;
    }
    if (argument === "--input-candidate") {
      const value = readValue(argv, ++index, "--input-candidate");
      rejectSecretText(value, "--input-candidate");
      options.inputCandidates.push(value);
      continue;
    }
    if (argument === "--output-artifact" || argument === "--artifact") {
      const value = readValue(argv, ++index, argument);
      rejectSecretText(value, argument);
      options.artifacts.push(value);
      continue;
    }
    if (argument === "--output") {
      const value = readValue(argv, ++index, "--output");
      rejectSecretText(value, "--output");
      options.output = value;
      continue;
    }
    if (argument === "--execution-receipt") {
      const value = readValue(argv, ++index, "--execution-receipt");
      rejectSecretText(value, "--execution-receipt");
      options.executionReceipt = value;
      continue;
    }
    if (argument === "--argv-file" || argument === "--argv-hash" || argument === "--command-exit-code") {
      readValue(argv, ++index, argument);
      throw new Error(`${argument} is no longer accepted; use --execution-receipt from phase6-command-runner.mjs`);
    }
    throw new Error(`Unknown argument: ${argument}`);
  }

  return options;
}

function readValue(argv, index, option) {
  const value = argv[index];
  if (!value) throw new Error(`${option} requires a value`);
  return value;
}

function isRepositoryRelative(candidate) {
  if (typeof candidate !== "string" || candidate.length === 0 || path.isAbsolute(candidate)) {
    return false;
  }
  const normalized = path.normalize(candidate);
  return normalized !== ".." && !normalized.startsWith(`..${path.sep}`);
}

function relativeSlash(absolutePath) {
  return path.relative(repositoryRoot, absolutePath).split(path.sep).join("/");
}

function ensureInsideRepository(realPath, repositoryRealPath) {
  const relative = path.relative(repositoryRealPath, realPath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function secretFindingsForText(text) {
  const findings = [];
  const lines = text.split(/\r?\n/);
  lines.forEach((line, index) => {
    if (SECRET_KEY.test(line)) findings.push({ code: "secret_key", line: index + 1 });
    if (SECRET_VALUE.test(line)) findings.push({ code: "secret_value", line: index + 1 });
  });
  return findings;
}

function rejectSecretText(text, label) {
  if (SECRET_KEY.test(String(text)) || SECRET_VALUE.test(String(text))) {
    throw new Error(`${label} appears to contain secret-like text`);
  }
}

function sha256(buffer) {
  return `sha256:${crypto.createHash("sha256").update(buffer).digest("hex")}`;
}

function validateHashedFile(inputPath, repositoryRealPath, errors, label) {
  if (!isRepositoryRelative(inputPath)) {
    errors.push({
      code: "path_outside_repository",
      message: `${label} path must be repository-relative and must not traverse outside the repository`,
      path: inputPath,
    });
    return undefined;
  }

  const absolutePath = path.resolve(repositoryRoot, inputPath);
  let realPath;
  let stat;
  try {
    realPath = fs.realpathSync(absolutePath);
    stat = fs.statSync(realPath);
  } catch {
    errors.push({ code: `${label}_not_found`, message: `${label} does not exist`, path: inputPath });
    return undefined;
  }

  if (!ensureInsideRepository(realPath, repositoryRealPath)) {
    errors.push({ code: "symlink_outside_repository", message: `${label} resolves outside the repository`, path: inputPath });
    return undefined;
  }
  if (!stat.isFile()) {
    errors.push({ code: `${label}_not_file`, message: `${label} must be a regular file`, path: inputPath });
    return undefined;
  }
  if (stat.size === 0) {
    errors.push({ code: `empty_${label}`, message: `${label} must not be empty`, path: inputPath });
    return undefined;
  }

  const buffer = fs.readFileSync(realPath);
  const text = buffer.toString("utf8");
  const secretFindings = secretFindingsForText(text);
  if (secretFindings.length > 0) {
    for (const finding of secretFindings) {
      errors.push({
        code: finding.code,
        message: `${label} appears to contain a secret at line ${finding.line}`,
        path: inputPath,
      });
    }
    return undefined;
  }

  return {
    path: relativeSlash(realPath),
    bytes: stat.size,
    sha256: sha256(buffer),
  };
}

function validateOutput(outputPath, repositoryRealPath, errors) {
  if (!isRepositoryRelative(outputPath)) {
    errors.push({
      code: "path_outside_repository",
      message: "Output path must be repository-relative and must not traverse outside the repository",
      path: outputPath,
    });
    return undefined;
  }

  const absolutePath = path.resolve(repositoryRoot, outputPath);
  const parentPath = path.dirname(absolutePath);
  let parentRealPath;
  try {
    parentRealPath = fs.realpathSync(parentPath);
  } catch {
    errors.push({ code: "output_parent_not_found", message: "Output parent directory does not exist", path: outputPath });
    return undefined;
  }

  if (!ensureInsideRepository(parentRealPath, repositoryRealPath)) {
    errors.push({ code: "symlink_outside_repository", message: "Output parent resolves outside the repository", path: outputPath });
    return undefined;
  }

  if (fs.existsSync(absolutePath)) {
    const outputRealPath = fs.realpathSync(absolutePath);
    if (!ensureInsideRepository(outputRealPath, repositoryRealPath)) {
      errors.push({ code: "symlink_outside_repository", message: "Output resolves outside the repository", path: outputPath });
      return undefined;
    }
    const stat = fs.statSync(outputRealPath);
    if (!stat.isFile()) {
      errors.push({ code: "output_not_file", message: "Output must be a regular file", path: outputPath });
      return undefined;
    }
    if (stat.size > 0) {
      errors.push({ code: "output_exists", message: "Output already exists and is non-empty", path: outputPath });
      return undefined;
    }
  }

  return {
    absolutePath,
    path: path.relative(repositoryRoot, absolutePath).split(path.sep).join("/"),
  };
}

function findDuplicatePaths(entries) {
  const seen = new Set();
  const duplicates = new Set();
  for (const entry of entries) {
    if (!entry) continue;
    if (seen.has(entry.path)) duplicates.add(entry.path);
    seen.add(entry.path);
  }
  return [...duplicates].sort();
}

export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (!value || typeof value !== "object") return JSON.stringify(value);
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
}

export function manifestHash(manifest) {
  const { manifestHash: _manifestHash, ...withoutHash } = manifest;
  return sha256(Buffer.from(canonicalJson(withoutHash), "utf8"));
}

function writeManifest(output, manifest) {
  const directory = path.dirname(output.absolutePath);
  const temporaryPath = path.join(directory, `.${path.basename(output.absolutePath)}.${process.pid}.${Date.now()}.tmp`);

  try {
    fs.writeFileSync(temporaryPath, `${JSON.stringify(manifest, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
    fs.renameSync(temporaryPath, output.absolutePath);
  } catch (error) {
    try {
      if (fs.existsSync(temporaryPath)) fs.unlinkSync(temporaryPath);
    } catch {
      // Best-effort cleanup; the command still reports the original write failure.
    }
    throw error;
  }
}

function main() {
  let options;
  try {
    options = parseArguments(process.argv.slice(2));
  } catch (error) {
    fail([{ code: "invalid_arguments", message: error.message }], "invalid_arguments");
    return;
  }

  if (options.help) {
    printJson({ ok: true, schemaVersion: SCHEMA_VERSION, usage: usage() });
    return;
  }

  const errors = [];
  try {
    loadAttestationKey();
  } catch (error) {
    errors.push({ code: "invalid_attestation_key", message: error.message });
  }
  if (!options.experimentId || !options.experimentId.trim()) errors.push({ code: "missing_experiment_id", message: "--experiment-id is required" });
  if (SECRET_KEY.test(options.experimentId || "") || SECRET_VALUE.test(options.experimentId || "")) {
    errors.push({ code: "secret_argument", message: "--experiment-id appears to contain secret-like text" });
  }
  if (options.inputCandidates.length === 0) errors.push({ code: "missing_input_candidate", message: "At least one --input-candidate path is required" });
  if (options.artifacts.length === 0) errors.push({ code: "missing_artifact", message: "At least one --output-artifact or --artifact path is required" });
  if (!options.output) errors.push({ code: "missing_output", message: "--output is required" });
  if (!options.executionReceipt) errors.push({ code: "missing_execution_receipt", message: "--execution-receipt is required" });

  const repositoryRealPath = fs.realpathSync(repositoryRoot);
  const inputCandidates = options.inputCandidates.map((entry) => validateHashedFile(entry, repositoryRealPath, errors, "input_candidate"));
  const artifacts = options.artifacts.map((entry) => validateHashedFile(entry, repositoryRealPath, errors, "artifact"));
  const output = options.output ? validateOutput(options.output, repositoryRealPath, errors) : undefined;
  let receipt;
  if (options.executionReceipt) {
    const receiptFile = validateHashedFile(options.executionReceipt, repositoryRealPath, errors, "execution_receipt");
    if (receiptFile) {
      try {
        receipt = JSON.parse(fs.readFileSync(path.resolve(repositoryRoot, receiptFile.path), "utf8"));
        if (receipt.receiptPath !== receiptFile.path) {
          errors.push({ code: "invalid_execution_receipt", message: "execution receipt path does not match signed receiptPath" });
        }
        const receiptValidation = validateExecutionReceipt(receipt);
        for (const message of receiptValidation.errors) {
          errors.push({ code: "invalid_execution_receipt", message });
        }
      } catch (error) {
        errors.push({ code: "invalid_execution_receipt", message: error.message });
      }
    }
  }

  for (const duplicate of findDuplicatePaths(inputCandidates)) {
    errors.push({ code: "duplicate_input_candidate", message: "Input candidate path is duplicated after symlink resolution", path: duplicate });
  }
  for (const duplicate of findDuplicatePaths(artifacts)) {
    errors.push({ code: "duplicate_artifact", message: "Artifact path is duplicated after symlink resolution", path: duplicate });
  }

  const inputPaths = new Set(inputCandidates.filter(Boolean).map((entry) => entry.path));
  for (const artifact of artifacts.filter(Boolean)) {
    if (inputPaths.has(artifact.path)) {
      errors.push({ code: "artifact_matches_input_candidate", message: "Artifact path must not also be an input candidate", path: artifact.path });
    }
  }
  if (output && [...inputCandidates, ...artifacts].some((entry) => entry && entry.path === output.path)) {
    errors.push({ code: "output_matches_hashed_file", message: "Output path must not also be a hashed input or artifact path", path: output.path });
  }
  if (receipt) {
    const receiptOutputs = new Map(receipt.outputs.map((entry) => [entry.path, entry]));
    for (const artifact of artifacts.filter(Boolean)) {
      const bound = receiptOutputs.get(artifact.path);
      if (!bound) {
        errors.push({ code: "artifact_missing_from_receipt", message: "Every artifact must be declared by the execution receipt", path: artifact.path });
      } else if (bound.sha256 !== artifact.sha256 || bound.bytes !== artifact.bytes) {
        errors.push({ code: "artifact_receipt_mismatch", message: "Artifact bytes/hash must match execution receipt", path: artifact.path });
      }
    }
  }

  if (errors.length > 0) {
    fail(errors);
    return;
  }

  const generatedAt = new Date().toISOString();
  const sortedInputs = inputCandidates
    .map((entry) => ({ path: entry.path, sha256: entry.sha256 }))
    .sort((left, right) => left.path.localeCompare(right.path));
  const sortedArtifacts = artifacts
    .map((entry) => ({ path: entry.path, bytes: entry.bytes, sha256: entry.sha256 }))
    .sort((left, right) => left.path.localeCompare(right.path));
  const manifest = {
    schemaVersion: SCHEMA_VERSION,
    experimentId: options.experimentId,
    generatedAt,
    inputCandidates: sortedInputs,
    command: summarizeReceipt(receipt),
    artifacts: sortedArtifacts,
    outputHash: sha256(Buffer.from(canonicalJson({ inputCandidates: sortedInputs, command: summarizeReceipt(receipt), artifacts: sortedArtifacts }), "utf8")),
  };
  manifest.manifestHash = manifestHash(manifest);

  try {
    writeManifest(output, manifest);
  } catch (error) {
    fail([{ code: "write_failed", message: error.message, path: output.path }]);
    return;
  }

  printJson({
    ok: true,
    schemaVersion: SCHEMA_VERSION,
    experimentId: options.experimentId,
    generatedAt,
    output: output.path,
    inputCandidateCount: manifest.inputCandidates.length,
    artifactCount: manifest.artifacts.length,
    manifestHash: manifest.manifestHash,
    outputHash: manifest.outputHash,
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main();
}
