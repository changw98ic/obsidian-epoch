#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { StringDecoder } from "node:string_decoder";
import { fileURLToPath } from "node:url";
import {
  ATTESTATION_KEY_ENV,
  loadAttestationKey,
  summarizeReceipt,
  validateExecutionReceipt,
} from "./phase6-command-runner.ts";

export const SCHEMA_VERSION = "obsidian-epoch.phase6-evidence-pack.v2";
const HASH_PATTERN = /^sha256:[a-f0-9]{64}$/;
const SECRET_KEY = /(?:secret|token|api[-_]?key|authorization|password|credential|private[-_]?key|access[-_]?key|refresh[-_]?token|session[-_]?key|client[-_]?secret|recovery[-_]?code|operator[-_]?key)/i;
const SECRET_VALUE = /(?:\b(?:sk-[A-Za-z0-9_-]{12,}|Bearer\s+[A-Za-z0-9._~+/=-]{12,}|xox[baprs]-[A-Za-z0-9-]{12,}|AKIA[0-9A-Z]{16})\b|-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----)/i;
const SENSITIVE_URL_VALUE = /(?:[?&](?:share[-_]?token|publish[-_]?token|token|authorization|access[-_]?token|refresh[-_]?token|signature|recovery[-_]?code)(?:=|%3d)|\/(?:share[-_]?token|publish[-_]?token)(?:\/|$))/i;
const SENSITIVE_ASSIGNMENT = /(?:^|[\s,{])(?:"|')?(?:secret|token|api[-_]?key|authorization|password|credential|private[-_]?key|access[-_]?key|refresh[-_]?token|session[-_]?key|client[-_]?secret|recovery[-_]?code|operator[-_]?key)(?:"|')?\s*[:=]/i;

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "../..");

type Rec = Record<string, unknown>;

interface ErrorEntry {
  code: string;
  message: string;
  path?: string;
}

interface EvidencePackOptions {
  inputCandidates: string[];
  artifacts: string[];
  experimentId: string | undefined;
  output: string | undefined;
  executionReceipt: string | undefined;
  help: boolean;
}

interface HashedFile {
  path: string;
  bytes: number;
  sha256: string;
}

interface OutputTarget {
  absolutePath: string;
  path: string;
}

function usage(): string {
  return [
    "Usage: node --import tsx ../agent-server/phase6-evidence-pack.ts --experiment-id <id> --input-candidate <path> --output-artifact <path> --output <manifest-path> [options]",
    "",
    "Options:",
    "  --input-candidate <path>  Candidate input file to bind into the manifest; repeatable",
    "  --output-artifact <path>  Output artifact file to bind into the manifest; repeatable",
    "  --artifact <path>         Compatibility alias for --output-artifact",
    "  --execution-receipt <path> Private receipt produced by phase6-command-runner.ts",
    "",
    `Requires ${ATTESTATION_KEY_ENV} to name the repository-external 0600 key used to verify the receipt.`,
    "The manifest never stores raw argv. It stores only command receipt hashes and file hashes.",
  ].join("\n");
}

function printJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function fail(errors: ErrorEntry[], status = "error"): void {
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

function parseArguments(argv: string[]): EvidencePackOptions {
  const options: EvidencePackOptions = {
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
      throw new Error(`${argument} is no longer accepted; use --execution-receipt from phase6-command-runner.ts`);
    }
    throw new Error(`Unknown argument: ${argument}`);
  }

  return options;
}

function readValue(argv: string[], index: number, option: string): string {
  const value = argv[index];
  if (!value) throw new Error(`${option} requires a value`);
  return value;
}

function isRepositoryRelative(candidate: unknown): candidate is string {
  if (typeof candidate !== "string" || candidate.length === 0 || path.isAbsolute(candidate)) {
    return false;
  }
  const normalized = path.normalize(candidate);
  return normalized !== ".." && !normalized.startsWith(`..${path.sep}`);
}

function relativeSlash(absolutePath: string): string {
  return path.relative(repositoryRoot, absolutePath).split(path.sep).join("/");
}

function ensureInsideRepository(realPath: string, repositoryRealPath: string): boolean {
  const relative = path.relative(repositoryRealPath, realPath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function secretFindingsForText(text: string): { code: string; line: number }[] {
  const findings: { code: string; line: number }[] = [];
  const lines = text.split(/\r?\n/);
  lines.forEach((line, index) => {
    findings.push(...secretFindingsForLine(line, index + 1));
  });
  return findings;
}

function secretFindingsForLine(line: string, lineNumber: number): { code: string; line: number }[] {
  const codes = new Set<string>();
  try {
    collectJsonSecretFindings(JSON.parse(line), codes);
  } catch {
    if (SENSITIVE_ASSIGNMENT.test(line)) codes.add("secret_key");
    if (SECRET_VALUE.test(line) || SENSITIVE_URL_VALUE.test(line)) codes.add("secret_value");
  }
  return [...codes].sort().map((code) => ({ code, line: lineNumber }));
}

function collectJsonSecretFindings(value: unknown, codes: Set<string>): void {
  if (Array.isArray(value)) {
    value.forEach((entry) => collectJsonSecretFindings(entry, codes));
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, entry] of Object.entries(value)) {
      if (SECRET_KEY.test(key)) codes.add("secret_key");
      collectJsonSecretFindings(entry, codes);
    }
    return;
  }
  if (typeof value === "string" && (SECRET_VALUE.test(value) || SENSITIVE_URL_VALUE.test(value))) {
    codes.add("secret_value");
  }
}

function inspectFileContent(filePath: string): { sha256: string; secretFindings: { code: string; line: number }[] } {
  const hash = crypto.createHash("sha256");
  const descriptor = fs.openSync(filePath, "r");
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  const decoder = new StringDecoder("utf8");
  const findings: { code: string; line: number }[] = [];
  let carry = "";
  let lineNumber = 1;

  const inspectLine = (rawLine: string) => {
    const line = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;
    findings.push(...secretFindingsForLine(line, lineNumber));
    lineNumber += 1;
  };

  try {
    for (;;) {
      const bytesRead = fs.readSync(descriptor, buffer, 0, buffer.length, null);
      if (bytesRead === 0) break;
      const chunk = buffer.subarray(0, bytesRead);
      hash.update(chunk);
      const lines = `${carry}${decoder.write(chunk)}`.split("\n");
      carry = lines.pop() ?? "";
      for (const line of lines) inspectLine(line);
    }
    const finalLine = `${carry}${decoder.end()}`;
    if (finalLine.length > 0) inspectLine(finalLine);
  } finally {
    fs.closeSync(descriptor);
  }

  return {
    sha256: `sha256:${hash.digest("hex")}`,
    secretFindings: findings,
  };
}

function rejectSecretText(text: unknown, label: string): void {
  if (SECRET_KEY.test(String(text)) || SECRET_VALUE.test(String(text))) {
    throw new Error(`${label} appears to contain secret-like text`);
  }
}

function sha256(buffer: Buffer | string): string {
  return `sha256:${crypto.createHash("sha256").update(buffer).digest("hex")}`;
}

function validateHashedFile(inputPath: string, repositoryRealPath: string, errors: ErrorEntry[], label: string): HashedFile | undefined {
  if (!isRepositoryRelative(inputPath)) {
    errors.push({
      code: "path_outside_repository",
      message: `${label} path must be repository-relative and must not traverse outside the repository`,
      path: inputPath,
    });
    return undefined;
  }

  const absolutePath = path.resolve(repositoryRoot, inputPath);
  let realPath: string;
  let stat: fs.Stats;
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

  const content = inspectFileContent(realPath);
  const secretFindings = content.secretFindings;
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
    sha256: content.sha256,
  };
}

function validateOutput(outputPath: string, repositoryRealPath: string, errors: ErrorEntry[]): OutputTarget | undefined {
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
  let parentRealPath: string;
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

function findDuplicatePaths(entries: (HashedFile | undefined)[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const entry of entries) {
    if (!entry) continue;
    if (seen.has(entry.path)) duplicates.add(entry.path);
    seen.add(entry.path);
  }
  return [...duplicates].sort();
}

export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (!value || typeof value !== "object") return JSON.stringify(value);
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson((value as Rec)[key])}`).join(",")}}`;
}

export function manifestHash(manifest: Rec): string {
  const { manifestHash: _manifestHash, ...withoutHash } = manifest;
  return sha256(Buffer.from(canonicalJson(withoutHash), "utf8"));
}

function writeManifest(output: OutputTarget, manifest: unknown): void {
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

function main(): void {
  let options: EvidencePackOptions;
  try {
    options = parseArguments(process.argv.slice(2));
  } catch (error: unknown) {
    fail([{ code: "invalid_arguments", message: (error as Error).message }], "invalid_arguments");
    return;
  }

  if (options.help) {
    printJson({ ok: true, schemaVersion: SCHEMA_VERSION, usage: usage() });
    return;
  }

  const errors: ErrorEntry[] = [];
  try {
    loadAttestationKey();
  } catch (error: unknown) {
    errors.push({ code: "invalid_attestation_key", message: (error as Error).message });
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
  let receipt: Rec | undefined;
  if (options.executionReceipt) {
    const receiptFile = validateHashedFile(options.executionReceipt, repositoryRealPath, errors, "execution_receipt");
    if (receiptFile) {
      try {
        receipt = JSON.parse(fs.readFileSync(path.resolve(repositoryRoot, receiptFile.path), "utf8")) as Rec;
        if (receipt.receiptPath !== receiptFile.path) {
          errors.push({ code: "invalid_execution_receipt", message: "execution receipt path does not match signed receiptPath" });
        }
        const receiptValidation = validateExecutionReceipt(receipt);
        for (const message of receiptValidation.errors) {
          errors.push({ code: "invalid_execution_receipt", message });
        }
      } catch (error: unknown) {
        errors.push({ code: "invalid_execution_receipt", message: (error as Error).message });
      }
    }
  }

  for (const duplicate of findDuplicatePaths(inputCandidates)) {
    errors.push({ code: "duplicate_input_candidate", message: "Input candidate path is duplicated after symlink resolution", path: duplicate });
  }
  for (const duplicate of findDuplicatePaths(artifacts)) {
    errors.push({ code: "duplicate_artifact", message: "Artifact path is duplicated after symlink resolution", path: duplicate });
  }

  const inputPaths = new Set(inputCandidates.filter(Boolean).map((entry) => entry!.path));
  for (const artifact of artifacts.filter(Boolean)) {
    if (inputPaths.has(artifact!.path)) {
      errors.push({ code: "artifact_matches_input_candidate", message: "Artifact path must not also be an input candidate", path: artifact!.path });
    }
  }
  if (output && [...inputCandidates, ...artifacts].some((entry) => entry && entry.path === output.path)) {
    errors.push({ code: "output_matches_hashed_file", message: "Output path must not also be a hashed input or artifact path", path: output.path });
  }
  if (receipt) {
    const receiptOutputs = new Map((receipt.outputs as Rec[]).map((entry) => [entry.path as string, entry]));
    for (const artifact of artifacts.filter(Boolean)) {
      const bound = receiptOutputs.get(artifact!.path);
      if (!bound) {
        errors.push({ code: "artifact_missing_from_receipt", message: "Every artifact must be declared by the execution receipt", path: artifact!.path });
      } else if (bound.sha256 !== artifact!.sha256 || bound.bytes !== artifact!.bytes) {
        errors.push({ code: "artifact_receipt_mismatch", message: "Artifact bytes/hash must match execution receipt", path: artifact!.path });
      }
    }
  }

  if (errors.length > 0) {
    fail(errors);
    return;
  }

  const generatedAt = new Date().toISOString();
  const sortedInputs = inputCandidates
    .map((entry) => ({ path: entry!.path, sha256: entry!.sha256 }))
    .sort((left, right) => left.path.localeCompare(right.path));
  const sortedArtifacts = artifacts
    .map((entry) => ({ path: entry!.path, bytes: entry!.bytes, sha256: entry!.sha256 }))
    .sort((left, right) => left.path.localeCompare(right.path));
  const manifest: Rec = {
    schemaVersion: SCHEMA_VERSION,
    experimentId: options.experimentId,
    generatedAt,
    inputCandidates: sortedInputs,
    command: summarizeReceipt(receipt!),
    artifacts: sortedArtifacts,
    outputHash: sha256(Buffer.from(canonicalJson({ inputCandidates: sortedInputs, command: summarizeReceipt(receipt!), artifacts: sortedArtifacts }), "utf8")),
  };
  manifest.manifestHash = manifestHash(manifest);

  try {
    writeManifest(output!, manifest);
  } catch (error: unknown) {
    fail([{ code: "write_failed", message: (error as Error).message, path: output!.path }]);
    return;
  }

  printJson({
    ok: true,
    schemaVersion: SCHEMA_VERSION,
    experimentId: options.experimentId,
    generatedAt,
    output: output!.path,
    inputCandidateCount: (manifest.inputCandidates as unknown[]).length,
    artifactCount: (manifest.artifacts as unknown[]).length,
    manifestHash: manifest.manifestHash,
    outputHash: manifest.outputHash,
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main();
}
