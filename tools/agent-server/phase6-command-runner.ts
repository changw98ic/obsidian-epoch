#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const RECEIPT_SCHEMA_VERSION = "obsidian-epoch.phase6-command-receipt.v2";
export const ATTESTATION_KEY_ENV = "PHASE6_ATTESTATION_KEY_FILE";
const HASH_PATTERN = /^sha256:[a-f0-9]{64}$/;
const SIGNATURE_PATTERN = /^hmac-sha256:[a-f0-9]{64}$/;
const SECRET_KEY = /(?:secret|token|api[-_]?key|authorization|password|credential|private[-_]?key|access[-_]?key|refresh[-_]?token|session[-_]?key|client[-_]?secret|recovery[-_]?code|operator[-_]?key)/i;
const SECRET_VALUE = /(?:\b(?:sk-[A-Za-z0-9_-]{12,}|Bearer\s+[A-Za-z0-9._~+/=-]{12,}|xox[baprs]-[A-Za-z0-9-]{12,}|AKIA[0-9A-Z]{16})\b|-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----)/i;

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "../..");

type Rec = Record<string, unknown>;

interface CommandRunnerOptions {
  program: string | undefined;
  args: string[];
  claimOutputs: string[];
  receipt: string | undefined;
  cwd: string;
  help: boolean;
}

function usage(): string {
  return [
    "Usage: node tools/agent-server/phase6-command-runner.mjs --program <program> [--arg <arg> ...] --claim-output <repo-path> --receipt <repo-path> [--cwd <repo-path>]",
    "",
    `Requires ${ATTESTATION_KEY_ENV} to name an absolute, repository-external 0600 file containing at least 32 bytes.`,
    "Every claimed output must be absent before execution and newly created by the shell:false command.",
    "Raw argv/stdout/stderr and attestation key material are never written to the receipt.",
  ].join("\n");
}

function parseArguments(argv: string[]): CommandRunnerOptions {
  const options: CommandRunnerOptions = { program: undefined, args: [], claimOutputs: [], receipt: undefined, cwd: ".", help: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    rejectSecretText(argument, "argument");
    if (argument === "--help" || argument === "-h") {
      options.help = true;
      continue;
    }
    if (argument === "--program") {
      options.program = readValue(argv, ++index, "--program");
      rejectSecretText(options.program, "--program");
      continue;
    }
    if (argument === "--arg") {
      const value = readValue(argv, ++index, "--arg");
      rejectSecretText(value, "--arg");
      options.args.push(value);
      continue;
    }
    if (argument === "--claim-output") {
      const value = readValue(argv, ++index, "--claim-output");
      rejectSecretText(value, "--claim-output");
      options.claimOutputs.push(value);
      continue;
    }
    if (argument === "--receipt") {
      const value = readValue(argv, ++index, "--receipt");
      rejectSecretText(value, "--receipt");
      options.receipt = value;
      continue;
    }
    if (argument === "--cwd") {
      const value = readValue(argv, ++index, "--cwd");
      rejectSecretText(value, "--cwd");
      options.cwd = value;
      continue;
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

function rejectSecretText(text: unknown, label: string): void {
  if (SECRET_KEY.test(String(text)) || SECRET_VALUE.test(String(text))) {
    throw new Error(`${label} appears to contain secret-like text`);
  }
}

function printJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function fail(code: string, message: string): void {
  printJson({ ok: false, schemaVersion: RECEIPT_SCHEMA_VERSION, code, detailHash: shortHash(message) });
  process.exitCode = 1;
}

function isRepositoryRelative(candidate: unknown): candidate is string {
  if (typeof candidate !== "string" || candidate.length === 0 || path.isAbsolute(candidate)) return false;
  const normalized = path.normalize(candidate);
  return normalized !== ".." && !normalized.startsWith(`..${path.sep}`);
}

function repositoryRelativePath(realPath: string): string {
  return path.relative(repositoryRoot, realPath).split(path.sep).join("/");
}

function lstatIfPresent(candidate: string): fs.Stats | undefined {
  try {
    return fs.lstatSync(candidate);
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException)?.code === "ENOENT") return undefined;
    throw error;
  }
}

interface ResolvedFile {
  real: string;
  path: string;
  stat: fs.Stats;
}

function resolveExistingRepoFile(candidate: string, label: string): ResolvedFile {
  if (!isRepositoryRelative(candidate)) throw new Error(`${label} must be repository-relative`);
  const absolute = path.resolve(repositoryRoot, candidate);
  const linkStat = fs.lstatSync(absolute);
  if (linkStat.isSymbolicLink()) throw new Error(`${label} must not be a symlink`);
  if (!linkStat.isFile()) throw new Error(`${label} is not a regular file`);
  const real = fs.realpathSync(absolute);
  if (!insideRepository(real)) throw new Error(`${label} resolves outside repository`);
  const stat = fs.statSync(real);
  return { real, path: repositoryRelativePath(real), stat };
}

interface AbsentFile {
  real: string;
  path: string;
  preState: "absent";
}

function resolveAbsentRepoFile(candidate: string, label: string): AbsentFile {
  if (!isRepositoryRelative(candidate)) throw new Error(`${label} must be repository-relative`);
  const absolute = path.resolve(repositoryRoot, candidate);
  const parent = fs.realpathSync(path.dirname(absolute));
  if (!insideRepository(parent)) throw new Error(`${label} parent resolves outside repository`);
  const real = path.join(parent, path.basename(absolute));
  if (lstatIfPresent(real)) throw new Error(`${label} must be absent before execution`);
  return { real, path: repositoryRelativePath(real), preState: "absent" };
}

interface ResolvedDirectory {
  real: string;
  path: string;
}

function resolveRepoDirectory(candidate: string, label: string): ResolvedDirectory {
  if (!isRepositoryRelative(candidate)) throw new Error(`${label} must be repository-relative`);
  const absolute = path.resolve(repositoryRoot, candidate);
  const linkStat = fs.lstatSync(absolute);
  if (linkStat.isSymbolicLink()) throw new Error(`${label} must not be a symlink`);
  const real = fs.realpathSync(absolute);
  if (!insideRepository(real)) throw new Error(`${label} resolves outside repository`);
  if (!fs.statSync(real).isDirectory()) throw new Error(`${label} is not a directory`);
  return { real, path: repositoryRelativePath(real) || "." };
}

function insideRepository(realPath: string): boolean {
  const root = fs.realpathSync(repositoryRoot);
  const relative = path.relative(root, realPath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function sha256(buffer: Buffer | string): string {
  return `sha256:${crypto.createHash("sha256").update(buffer).digest("hex")}`;
}

function sha256File(filePath: string): string {
  return sha256(fs.readFileSync(filePath));
}

export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (!value || typeof value !== "object") return JSON.stringify(value);
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson((value as Rec)[key])}`).join(",")}}`;
}

interface AttestationKeyOptions {
  keyFile?: string;
}

interface AttestationKey {
  bytes: Buffer;
  keyId: string;
}

export function loadAttestationKey(options: AttestationKeyOptions = {}): AttestationKey {
  const keyFile = options.keyFile ?? process.env[ATTESTATION_KEY_ENV];
  if (typeof keyFile !== "string" || keyFile.length === 0 || !path.isAbsolute(keyFile)) {
    throw new Error(`${ATTESTATION_KEY_ENV} must name an absolute key file`);
  }
  let linkStat: fs.Stats;
  let real: string;
  try {
    linkStat = fs.lstatSync(keyFile);
    if (linkStat.isSymbolicLink() || !linkStat.isFile()) throw new Error("not a regular file");
    real = fs.realpathSync(keyFile);
  } catch {
    throw new Error("attestation key must be an existing regular file and not a symlink");
  }
  if ((linkStat.mode & 0o777) !== 0o600) throw new Error("attestation key file mode must be 0600");
  if (linkStat.nlink !== 1) throw new Error("attestation key file must not have hard links");
  if (insideRepository(real)) throw new Error("attestation key file must be outside the repository");
  let descriptor: number | undefined;
  let openedStat: fs.Stats;
  let bytes: Buffer;
  try {
    descriptor = fs.openSync(real, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0));
    openedStat = fs.fstatSync(descriptor);
    bytes = fs.readFileSync(descriptor);
  } catch {
    throw new Error("attestation key could not be opened securely");
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
  }
  if (!openedStat.isFile() || openedStat.dev !== linkStat.dev || openedStat.ino !== linkStat.ino) {
    throw new Error("attestation key changed during validation");
  }
  if ((openedStat.mode & 0o777) !== 0o600 || openedStat.nlink !== 1) {
    throw new Error("attestation key permissions changed during validation");
  }
  if (bytes.length < 32) throw new Error("attestation key file must contain at least 32 bytes");
  return { bytes, keyId: sha256(bytes) };
}

export interface ExecutionReceipt {
  schemaVersion: string;
  program: string;
  argvHash: string;
  cwd: string;
  startedAt: string;
  endedAt: string;
  exitCode: number | null;
  signal: string | null;
  stdout: { bytes: number; sha256: string };
  stderr: { bytes: number; sha256: string };
  outputs: ReceiptOutput[];
  receiptPath: string;
  receiptHash?: string;
  keyId?: string;
  signature?: string;
  [key: string]: unknown;
}

interface ReceiptOutput {
  path: string;
  preState: string;
  createdByRun: boolean;
  bytes: number;
  sha256: string;
  mtime: string;
  ctime: string;
  [key: string]: unknown;
}

export function receiptHash(receipt: Rec): string {
  const { receiptHash: _receiptHash, signature: _signature, ...withoutHashOrSignature } = receipt;
  return sha256(Buffer.from(canonicalJson(withoutHashOrSignature), "utf8"));
}

function receiptSignature(receipt: Rec, keyBytes: Buffer): string {
  const { signature: _signature, ...withoutSignature } = receipt;
  return `hmac-sha256:${crypto.createHmac("sha256", keyBytes).update(canonicalJson(withoutSignature), "utf8").digest("hex")}`;
}

function signatureMatches(actual: unknown, expected: string): boolean {
  if (!SIGNATURE_PATTERN.test(String(actual)) || !SIGNATURE_PATTERN.test(String(expected))) return false;
  const actualBytes = Buffer.from((actual as string).slice("hmac-sha256:".length), "hex");
  const expectedBytes = Buffer.from(expected.slice("hmac-sha256:".length), "hex");
  return actualBytes.length === expectedBytes.length && crypto.timingSafeEqual(actualBytes, expectedBytes);
}

export function summarizeReceipt(receipt: Rec): Rec {
  return {
    schemaVersion: receipt.schemaVersion,
    program: receipt.program,
    argvHash: receipt.argvHash,
    cwd: receipt.cwd,
    startedAt: receipt.startedAt,
    endedAt: receipt.endedAt,
    exitCode: receipt.exitCode,
    signal: receipt.signal ?? null,
    stdout: receipt.stdout,
    stderr: receipt.stderr,
    outputs: receipt.outputs,
    receiptPath: receipt.receiptPath,
    receiptHash: receipt.receiptHash,
    keyId: receipt.keyId,
    signature: receipt.signature,
  };
}

function validateOutputEntry(output: unknown, receipt: Rec, errors: string[], seen: Set<string>): void {
  const out = output as Rec | null;
  if (!out || typeof out !== "object"
    || typeof out.path !== "string"
    || out.preState !== "absent"
    || out.createdByRun !== true
    || !Number.isSafeInteger(out.bytes)
    || (out.bytes as number) <= 0
    || !HASH_PATTERN.test(String(out.sha256))) {
    errors.push("each output must bind path, preState=absent, createdByRun=true, positive bytes, and sha256");
    return;
  }
  const outputPath = out.path as string;
  if (seen.has(outputPath)) errors.push("outputs must not contain duplicate paths");
  seen.add(outputPath);
  const startedMs = Date.parse(receipt.startedAt as string);
  const endedMs = Date.parse(receipt.endedAt as string);
  for (const timestamp of ["mtime", "ctime"] as const) {
    const valueMs = Date.parse(out[timestamp] as string);
    if (typeof out[timestamp] !== "string" || Number.isNaN(valueMs)) {
      errors.push(`output ${timestamp} must be a timestamp`);
    } else if (valueMs <= startedMs || valueMs > endedMs) {
      errors.push(`output ${timestamp} must be inside the command execution window`);
    }
  }
  let file: ResolvedFile;
  try {
    file = resolveExistingRepoFile(outputPath, "output.path");
  } catch {
    errors.push(`output is missing or invalid: ${shortHash(outputPath)}`);
    return;
  }
  if (file.path !== outputPath) errors.push(`output path is non-canonical: ${shortHash(outputPath)}`);
  if (file.stat.size !== (out.bytes as number)) errors.push(`output bytes mismatch: ${shortHash(outputPath)}`);
  if (sha256File(file.real) !== out.sha256) errors.push(`output hash mismatch: ${shortHash(outputPath)}`);
  if (file.stat.mtime.toISOString() !== out.mtime) errors.push(`output mtime mismatch: ${shortHash(outputPath)}`);
  if (file.stat.ctime.getTime() < Date.parse(out.ctime as string)) errors.push(`output ctime predates signed ctime: ${shortHash(outputPath)}`);
}

interface ValidateReceiptOptions {
  keyFile?: string;
  requireSuccess?: boolean;
}

export function validateExecutionReceipt(receipt: unknown, options: ValidateReceiptOptions = {}): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  const requireSuccess = options.requireSuccess !== false;
  let key: AttestationKey | undefined;
  try {
    key = loadAttestationKey({ keyFile: options.keyFile });
  } catch (error: unknown) {
    errors.push((error as Error).message);
  }
  const rec = receipt as Rec | null;
  if (!rec || typeof rec !== "object" || Array.isArray(rec)) {
    return { ok: false, errors: [...errors, "receipt must be an object"] };
  }
  if (rec.schemaVersion !== RECEIPT_SCHEMA_VERSION) errors.push(`schemaVersion must be ${RECEIPT_SCHEMA_VERSION}`);
  if (typeof rec.program !== "string" || (rec.program as string).trim() === "" || SECRET_KEY.test(rec.program as string) || SECRET_VALUE.test(rec.program as string)) {
    errors.push("program must be a non-secret string");
  }
  if (!HASH_PATTERN.test(String(rec.argvHash))) errors.push("argvHash must be sha256:<64hex>");
  if (!isRepositoryRelative(rec.cwd)) errors.push("cwd must be repository-relative");
  if (typeof rec.startedAt !== "string" || Number.isNaN(Date.parse(rec.startedAt as string))) errors.push("startedAt must be a timestamp");
  if (typeof rec.endedAt !== "string" || Number.isNaN(Date.parse(rec.endedAt as string))) errors.push("endedAt must be a timestamp");
  if (Date.parse(rec.endedAt as string) < Date.parse(rec.startedAt as string)) errors.push("endedAt must not precede startedAt");
  if (!Number.isInteger(rec.exitCode) && rec.exitCode !== null) errors.push("exitCode must be an integer or null");
  if (rec.signal !== null && typeof rec.signal !== "string") errors.push("signal must be null or a string");
  if (requireSuccess && (rec.exitCode !== 0 || rec.signal !== null)) errors.push("receipt command did not complete successfully");
  for (const streamName of ["stdout", "stderr"] as const) {
    const stream = rec[streamName] as Rec | undefined;
    if (!stream || typeof stream !== "object" || !Number.isSafeInteger(stream.bytes) || (stream.bytes as number) < 0 || !HASH_PATTERN.test(String(stream.sha256))) {
      errors.push(`${streamName} must include bytes and sha256`);
    }
  }
  if (!Array.isArray(rec.outputs) || (rec.outputs as unknown[]).length === 0) {
    errors.push("outputs must be a non-empty array");
  } else {
    const seen = new Set<string>();
    for (const output of rec.outputs as unknown[]) validateOutputEntry(output, rec, errors, seen);
  }
  if (!HASH_PATTERN.test(String(rec.receiptHash))) {
    errors.push("receiptHash must be sha256:<64hex>");
  } else if (rec.receiptHash !== receiptHash(rec)) {
    errors.push("receiptHash does not match canonical receipt");
  }
  if (!HASH_PATTERN.test(String(rec.keyId))) {
    errors.push("keyId must be sha256:<64hex>");
  } else if (key && rec.keyId !== key.keyId) {
    errors.push("receipt keyId does not match attestation key");
  }
  if (!SIGNATURE_PATTERN.test(String(rec.signature))) {
    errors.push("signature must be hmac-sha256:<64hex>");
  } else if (key && !signatureMatches(rec.signature, receiptSignature(rec, key.bytes))) {
    errors.push("receipt signature verification failed");
  }
  if (rec.receiptPath !== undefined) {
    try {
      const file = resolveExistingRepoFile(rec.receiptPath as string, "receiptPath");
      const mode = file.stat.mode & 0o777;
      if (mode !== 0o600) errors.push("receiptPath file mode must be 0600");
      const onDisk: unknown = JSON.parse(fs.readFileSync(file.real, "utf8"));
      if (canonicalJson(onDisk) !== canonicalJson(rec)) errors.push("receiptPath content does not match receipt");
    } catch {
      errors.push("receiptPath is missing or invalid");
    }
  } else {
    errors.push("receiptPath is required");
  }
  return { ok: errors.length === 0, errors };
}

function shortHash(value: unknown): string {
  return crypto.createHash("sha256").update(String(value)).digest("hex").slice(0, 16);
}

function writePrivateJson(output: AbsentFile, value: unknown): void {
  fs.writeFileSync(output.real, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", flag: "wx", mode: 0o600 });
  fs.chmodSync(output.real, 0o600);
}

function inspectCreatedOutput(output: AbsentFile, startedAt: string): ReceiptOutput {
  const linkStat = fs.lstatSync(output.real);
  if (linkStat.isSymbolicLink() || !linkStat.isFile()) throw new Error("claimed output must be a newly created regular file, not a directory or symlink");
  const file = resolveExistingRepoFile(output.path, "--claim-output");
  const startedMs = Date.parse(startedAt);
  const mtime = file.stat.mtime.toISOString();
  const ctime = file.stat.ctime.toISOString();
  if (Date.parse(mtime) <= startedMs) throw new Error("claimed output mtime is outside the command execution window");
  if (Date.parse(ctime) <= startedMs) throw new Error("claimed output ctime is outside the command execution window");
  if (file.stat.size <= 0) throw new Error("claimed output must not be empty");
  return {
    path: file.path,
    preState: output.preState,
    createdByRun: true,
    bytes: file.stat.size,
    sha256: sha256File(file.real),
    mtime,
    ctime,
  };
}

function main(): void {
  let options: CommandRunnerOptions;
  try {
    options = parseArguments(process.argv.slice(2));
    if (options.help) {
      printJson({ ok: true, schemaVersion: RECEIPT_SCHEMA_VERSION, usage: usage() });
      return;
    }
    if (!options.program) throw new Error("--program is required");
    if (options.claimOutputs.length === 0) throw new Error("at least one --claim-output is required");
    if (!options.receipt) throw new Error("--receipt is required");

    const key = loadAttestationKey();
    const cwd = resolveRepoDirectory(options.cwd, "--cwd");
    const receiptOutput = resolveAbsentRepoFile(options.receipt, "--receipt");
    const claimedOutputs = options.claimOutputs.map((entry) => resolveAbsentRepoFile(entry, "--claim-output"));
    const uniqueOutputs = new Set(claimedOutputs.map((entry) => entry.path));
    if (uniqueOutputs.size !== claimedOutputs.length) throw new Error("--claim-output paths must be unique");
    if (uniqueOutputs.has(receiptOutput.path)) throw new Error("--receipt must not also be a claimed output");

    const startedAt = new Date().toISOString();
    const childEnvironment = { ...process.env };
    delete childEnvironment[ATTESTATION_KEY_ENV];
    const child = spawnSync(options.program, options.args, {
      cwd: cwd.real,
      encoding: "buffer",
      shell: false,
      env: childEnvironment,
      maxBuffer: 1024 * 1024 * 50,
    });
    const stdout = child.stdout ?? Buffer.alloc(0);
    const stderr = child.stderr ?? Buffer.alloc(0);
    const outputs = claimedOutputs
      .map((entry) => inspectCreatedOutput(entry, startedAt))
      .sort((left, right) => left.path.localeCompare(right.path));
    const endedAt = new Date().toISOString();
    for (const output of outputs) {
      if (Date.parse(output.mtime) > Date.parse(endedAt)) throw new Error("claimed output mtime is outside the command execution window");
      if (Date.parse(output.ctime) > Date.parse(endedAt)) throw new Error("claimed output ctime is outside the command execution window");
    }
    const receipt: Rec = {
      schemaVersion: RECEIPT_SCHEMA_VERSION,
      program: options.program,
      argvHash: sha256(Buffer.from(canonicalJson([options.program, ...options.args]), "utf8")),
      cwd: cwd.path,
      startedAt,
      endedAt,
      exitCode: child.status ?? null,
      signal: child.signal ?? null,
      stdout: { bytes: stdout.length, sha256: sha256(stdout) },
      stderr: { bytes: stderr.length, sha256: sha256(stderr) },
      outputs,
      receiptPath: receiptOutput.path,
      keyId: key.keyId,
    };
    receipt.receiptHash = receiptHash(receipt);
    receipt.signature = receiptSignature(receipt, key.bytes);
    writePrivateJson(receiptOutput, receipt);
    printJson({
      ok: receipt.exitCode === 0 && receipt.signal === null,
      schemaVersion: RECEIPT_SCHEMA_VERSION,
      receiptPath: receiptOutput.path,
      receiptHash: receipt.receiptHash,
      exitCode: receipt.exitCode,
      signal: receipt.signal,
      stdout: receipt.stdout,
      stderr: receipt.stderr,
      outputCount: outputs.length,
    });
    process.exitCode = receipt.exitCode === 0 && receipt.signal === null ? 0 : 1;
  } catch (error: unknown) {
    fail("runtime_error", (error as Error).message);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main();
}
