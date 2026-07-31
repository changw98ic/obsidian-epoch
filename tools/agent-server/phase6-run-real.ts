#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const MAX_STDERR_SUMMARY_BYTES = 8192;
const DEFAULT_TIMEOUT_MS = 30 * 60 * 1000;
const SECRET_KEY = /(?:api[-_]?key|recovery[-_]?code|operator[-_]?key|secret|token|authorization|password|credential|private[-_]?key|access[-_]?key|refresh[-_]?token|session[-_]?key)/i;
const SECRET_VALUE = /\b(?:sk-[A-Za-z0-9_-]{12,}|Bearer\s+[A-Za-z0-9._-]{12,}|xox[baprs]-[A-Za-z0-9-]{12,}|AKIA[0-9A-Z]{16})\b/i;
const SECRET_VALUE_GLOBAL = /\b(?:sk-[A-Za-z0-9_-]{12,}|Bearer\s+[A-Za-z0-9._-]{12,}|xox[baprs]-[A-Za-z0-9-]{12,}|AKIA[0-9A-Z]{16})\b/gi;

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "../..");
const acceptanceScript = path.join(scriptDirectory, "phase6-ten-run.ts");

type Rec = Record<string, unknown>;

interface RunRealOptions {
  commandJson: string | undefined;
  outputPath: string | undefined;
  experimentId: string | undefined;
  timeoutMs: number;
  help: boolean;
}

interface SecretFinding {
  reasons: string[];
  paths: string[];
}

interface CommandResult {
  exitCode: number;
  signal: string | null;
  timedOut: boolean;
  outputError: string | undefined;
  stdoutSecretFinding: SecretFinding | undefined;
  stderrSummary: string;
}

interface AcceptanceResult {
  exitCode: number;
  signal: string | null;
  stdout: string;
  stderrSummary: string;
}

function usage(): string {
  return [
    "Usage: node --import tsx ../agent-server/phase6-run-real.ts --command-json '<argv-json>' --output <repo-jsonl-path> [--experiment-id <id>] [--timeout-ms <ms>]",
    "",
    "Runs a real external host command without a shell, writes stdout to a repository JSONL evidence file,",
    "summarizes stderr with redaction, then invokes phase6-ten-run.ts against the evidence file.",
  ].join("\n");
}

function parseArguments(argv: string[]): RunRealOptions {
  const options: RunRealOptions = {
    commandJson: undefined,
    outputPath: undefined,
    experimentId: undefined,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help" || argument === "-h") {
      options.help = true;
      continue;
    }
    if (argument === "--command-json") {
      options.commandJson = argv[index + 1];
      if (!options.commandJson) {
        throw new Error("--command-json requires a JSON argv array");
      }
      index += 1;
      continue;
    }
    if (argument === "--output") {
      options.outputPath = argv[index + 1];
      if (!options.outputPath) {
        throw new Error("--output requires a repository-relative or repository-contained path");
      }
      index += 1;
      continue;
    }
    if (argument === "--experiment-id") {
      options.experimentId = argv[index + 1];
      if (!options.experimentId) {
        throw new Error("--experiment-id requires a non-empty value");
      }
      index += 1;
      continue;
    }
    if (argument === "--timeout-ms") {
      const timeout = Number.parseInt(argv[index + 1], 10);
      if (!Number.isInteger(timeout) || timeout <= 0) {
        throw new Error("--timeout-ms requires a positive integer");
      }
      options.timeoutMs = timeout;
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${argument}`);
  }

  if (!options.help) {
    if (!options.commandJson) {
      throw new Error("--command-json is required");
    }
    if (!options.outputPath) {
      throw new Error("--output is required");
    }
  }
  return options;
}

function parseCommand(commandJson: string): string[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(commandJson);
  } catch {
    throw new Error("--command-json must be valid JSON");
  }
  if (!Array.isArray(parsed) || parsed.length === 0 || parsed.some((entry: unknown) => typeof entry !== "string" || (entry as string).length === 0)) {
    throw new Error("--command-json must be a non-empty JSON array of non-empty strings");
  }
  (parsed as string[]).forEach((entry, index) => {
    if (SECRET_VALUE.test(entry)) {
      throw new Error(`--command-json argv[${index}] appears to contain secret material`);
    }
    const [maybeKey] = entry.split("=", 1);
    if (SECRET_KEY.test(maybeKey || "") || SECRET_KEY.test(entry.replace(/^--?/, "").split(/[=:\s]/, 1)[0] || "")) {
      throw new Error(`--command-json argv[${index}] appears to contain a forbidden secret-bearing argument`);
    }
  });
  return parsed as string[];
}

function resolveOutputPath(candidate: string): string {
  const resolved = path.resolve(process.cwd(), candidate);
  const relative = path.relative(repositoryRoot, resolved);
  if (relative === "" || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("--output must resolve inside the repository");
  }
  return resolved;
}

function ensureWritableOutput(outputPath: string): void {
  if (fs.existsSync(outputPath)) {
    const stat = fs.statSync(outputPath);
    if (!stat.isFile()) {
      throw new Error("--output must be a file path");
    }
    if (stat.size > 0) {
      throw new Error("--output refuses to overwrite an existing non-empty file");
    }
  }
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
}

function redact(text: string): string {
  return text
    .replace(SECRET_VALUE_GLOBAL, "[REDACTED_SECRET]")
    .split(/\r?\n/)
    .map((line) => {
      if (SECRET_KEY.test(line)) {
        return "[REDACTED_SECRET_LINE]";
      }
      return line;
    })
    .join("\n");
}

function secretPathsInValue(value: unknown, pathPrefix: string, paths: string[]): void {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => secretPathsInValue(entry, `${pathPrefix}[${index}]`, paths));
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, entry] of Object.entries(value)) {
      const pathName = pathPrefix ? `${pathPrefix}.${key}` : key;
      if (SECRET_KEY.test(key)) {
        paths.push(pathName);
      }
      secretPathsInValue(entry, pathName, paths);
    }
  }
}

function parseJsonLine(line: string): unknown {
  const trimmed = line.trim();
  if (!trimmed) {
    return undefined;
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    const objectStart = trimmed.indexOf("{");
    const objectEnd = trimmed.lastIndexOf("}");
    if (objectStart >= 0 && objectEnd > objectStart) {
      try {
        return JSON.parse(trimmed.slice(objectStart, objectEnd + 1));
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
}

function secretFindingForStdoutLine(line: string): SecretFinding | undefined {
  const reasons: string[] = [];
  const paths: string[] = [];
  if (SECRET_VALUE.test(line)) {
    reasons.push("token_pattern");
  }
  const parsed = parseJsonLine(line);
  if (parsed !== undefined) {
    secretPathsInValue(parsed, "$", paths);
  }
  if (paths.length > 0) {
    reasons.push("secret_looking_json_key");
  }
  if (reasons.length === 0) {
    return undefined;
  }
  return {
    reasons: [...new Set(reasons)],
    paths: [...new Set(paths)].slice(0, 20),
  };
}

function appendSummary(current: string, chunk: Buffer): string {
  const redacted = redact(chunk.toString("utf8"));
  const combined = current + redacted;
  if (Buffer.byteLength(combined, "utf8") <= MAX_STDERR_SUMMARY_BYTES) {
    return combined;
  }
  return combined.slice(0, MAX_STDERR_SUMMARY_BYTES) + "\n[stderr summary truncated]";
}

function cleanupEvidenceFile(outputPath: string, removeNewFile: boolean): void {
  try {
    if (removeNewFile) {
      fs.rmSync(outputPath, { force: true });
      return;
    }
    fs.truncateSync(outputPath, 0);
  } catch {
    // Avoid leaking path-specific or platform-specific cleanup details.
  }
}

function runExternalCommand(argv: string[], outputPath: string, timeoutMs: number): Promise<CommandResult> {
  return new Promise((resolve) => {
    const outputExistedBefore = fs.existsSync(outputPath);
    const output = fs.createWriteStream(outputPath, { flags: "w", mode: 0o600 });
    let stderrSummary = "";
    let stdoutBuffer = "";
    let stdoutSecretFinding: SecretFinding | undefined;
    let timedOut = false;
    let settled = false;
    let outputError: Error | undefined;
    let terminatingForSecret = false;

    const child = spawn(argv[0], argv.slice(1), {
      cwd: repositoryRoot,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      setTimeout(() => {
        if (!settled) {
          child.kill("SIGKILL");
        }
      }, 5000).unref();
    }, timeoutMs);
    timer.unref();

    output.on("error", (error: Error) => {
      outputError = error;
      child.kill("SIGTERM");
    });
    function terminateForStdoutSecret(finding: SecretFinding): void {
      if (terminatingForSecret) {
        return;
      }
      terminatingForSecret = true;
      stdoutSecretFinding = finding;
      child.stdout.pause();
      child.kill("SIGTERM");
      setTimeout(() => {
        if (!settled) {
          child.kill("SIGKILL");
        }
      }, 5000).unref();
    }

    function writeCheckedLine(line: string): boolean {
      const finding = secretFindingForStdoutLine(line);
      if (finding) {
        terminateForStdoutSecret(finding);
        return false;
      }
      output.write(line);
      return true;
    }

    child.stdout.on("data", (chunk: Buffer) => {
      if (terminatingForSecret) {
        return;
      }
      stdoutBuffer += chunk.toString("utf8");
      for (;;) {
        const newlineIndex = stdoutBuffer.indexOf("\n");
        if (newlineIndex < 0) {
          break;
        }
        const line = stdoutBuffer.slice(0, newlineIndex + 1);
        stdoutBuffer = stdoutBuffer.slice(newlineIndex + 1);
        if (!writeCheckedLine(line)) {
          stdoutBuffer = "";
          break;
        }
      }
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderrSummary = appendSummary(stderrSummary, chunk);
    });
    child.on("error", (error: Error) => {
      stderrSummary = appendSummary(stderrSummary, Buffer.from(error.message));
    });
    child.on("close", (code: number | null, signal: string | null) => {
      settled = true;
      clearTimeout(timer);
      if (!terminatingForSecret && stdoutBuffer.length > 0) {
        writeCheckedLine(stdoutBuffer);
        stdoutBuffer = "";
      }
      output.end(() => {
        if (stdoutSecretFinding) {
          cleanupEvidenceFile(outputPath, !outputExistedBefore);
        }
        resolve({
          exitCode: Number.isInteger(code) ? code! : 1,
          signal,
          timedOut,
          outputError: outputError ? outputError.message : undefined,
          stdoutSecretFinding,
          stderrSummary,
        });
      });
    });
  });
}

function runAcceptance(outputPath: string, experimentId: string | undefined): Promise<AcceptanceResult> {
  return new Promise((resolve) => {
    const acceptanceArguments = [
      acceptanceScript,
      "--input",
      outputPath,
    ];
    if (experimentId) {
      acceptanceArguments.push("--experiment-id", experimentId);
    }
    const child = spawn(process.execPath, acceptanceArguments, {
      cwd: repositoryRoot,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderrSummary = "";
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderrSummary = appendSummary(stderrSummary, chunk);
    });
    child.on("error", (error: Error) => {
      stderrSummary = appendSummary(stderrSummary, Buffer.from(error.message));
    });
    child.on("close", (code: number | null, signal: string | null) => {
      resolve({
        exitCode: Number.isInteger(code) ? code! : 1,
        signal,
        stdout,
        stderrSummary,
      });
    });
  });
}

function writeRunnerFailure(message: string): void {
  process.stdout.write(`${JSON.stringify({
    schemaVersion: "obsidian-epoch.phase6-real-runner.v1",
    ok: false,
    failures: [{ gate: "runner_error", message }],
  }, null, 2)}\n`);
  process.exitCode = 1;
}

async function main(): Promise<void> {
  let options: RunRealOptions;
  try {
    options = parseArguments(process.argv.slice(2));
    if (options.help) {
      process.stdout.write(`${usage()}\n`);
      return;
    }

    const command = parseCommand(options.commandJson!);
    const outputPath = resolveOutputPath(options.outputPath!);
    ensureWritableOutput(outputPath);

    const commandResult = await runExternalCommand(command, outputPath, options.timeoutMs);
    if (commandResult.stderrSummary) {
      process.stderr.write(`${JSON.stringify({
        schemaVersion: "obsidian-epoch.phase6-real-runner.stderr-summary.v1",
        source: "external_command",
        timedOut: commandResult.timedOut,
        exitCode: commandResult.exitCode,
        signal: commandResult.signal,
        summary: commandResult.stderrSummary,
      }, null, 2)}\n`);
    }
    if (commandResult.outputError) {
      writeRunnerFailure(`failed to write output evidence: ${commandResult.outputError}`);
      return;
    }
    if (commandResult.stdoutSecretFinding) {
      process.stdout.write(`${JSON.stringify({
        schemaVersion: "obsidian-epoch.phase6-real-runner.v1",
        ok: false,
        failures: [{
          gate: "stdout_secret_guard",
          reasons: commandResult.stdoutSecretFinding.reasons,
          paths: commandResult.stdoutSecretFinding.paths,
          message: "external stdout contained secret-looking material; raw line was not written",
        }],
      }, null, 2)}\n`);
      process.exitCode = 1;
      return;
    }

    const acceptance = await runAcceptance(outputPath, options.experimentId);
    if (acceptance.stdout) {
      process.stdout.write(acceptance.stdout);
      if (!acceptance.stdout.endsWith("\n")) {
        process.stdout.write("\n");
      }
    }
    if (acceptance.stderrSummary) {
      process.stderr.write(`${JSON.stringify({
        schemaVersion: "obsidian-epoch.phase6-real-runner.stderr-summary.v1",
        source: "phase6-ten-run",
        exitCode: acceptance.exitCode,
        signal: acceptance.signal,
        summary: acceptance.stderrSummary,
      }, null, 2)}\n`);
    }

    process.exitCode = commandResult.exitCode !== 0 ? commandResult.exitCode : acceptance.exitCode;
  } catch (error: unknown) {
    writeRunnerFailure(error instanceof Error ? error.message : String(error));
  }
}

main();
