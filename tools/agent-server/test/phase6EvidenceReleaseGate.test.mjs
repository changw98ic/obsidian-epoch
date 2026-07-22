import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { canonicalJson, manifestHash } from "../phase6-evidence-pack.mjs";
import { buildReport } from "../phase6-release-gate.mjs";
import { ATTESTATION_KEY_ENV, receiptHash } from "../phase6-command-runner.mjs";

const repoRoot = path.resolve(import.meta.dirname, "../../..");
const scratchRoot = "tools/agent-server/test/.tmp-phase6-evidence-release-gate";
const requiredGates = [
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
];
const artifactKeys = [
  "panel-before",
  "panel-after",
  "panel-receipt",
  "command-audit",
  "settlement-audit",
  "store-audit",
  "journey",
  "result",
  "epoch-events",
  "economy",
  "world",
  "progression",
  "score",
  "rag-query",
  "rag-receipt",
  "balance",
  "shop",
  "crafting-input",
  "recipes",
  "crafts",
  "settlements",
  "crafting-progression",
  "progress-ledger",
];

async function resetScratch(name) {
  const relative = `${scratchRoot}/${name}`;
  const absolute = path.join(repoRoot, relative);
  await rm(absolute, { recursive: true, force: true });
  await mkdir(absolute, { recursive: true });
  return { relative, absolute };
}

async function writeScratch(relativeDirectory, fileName, text) {
  const relative = `${relativeDirectory}/${fileName}`;
  await writeFile(path.join(repoRoot, relative), text);
  return relative;
}

function sha256(value) {
  return `sha256:${crypto.createHash("sha256").update(value).digest("hex")}`;
}

function outputHash(manifest) {
  return sha256(canonicalJson({
    inputCandidates: manifest.inputCandidates,
    command: manifest.command,
    artifacts: manifest.artifacts,
  }));
}

function commandEnvironment(keyFile) {
  const env = { ...process.env };
  if (keyFile === null) delete env[ATTESTATION_KEY_ENV];
  else env[ATTESTATION_KEY_ENV] = keyFile;
  return env;
}

function createKey(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "phase6-evidence-attestation-"));
  const keyFile = path.join(directory, "trust.bin");
  fs.writeFileSync(keyFile, crypto.randomBytes(32), { mode: 0o600 });
  fs.chmodSync(keyFile, 0o600);
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return keyFile;
}

function runEvidencePack(args, keyFile) {
  return spawnSync(process.execPath, ["tools/agent-server/phase6-evidence-pack.mjs", ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    shell: false,
    env: commandEnvironment(keyFile),
  });
}

function runCommandRunner(args, keyFile) {
  return spawnSync(process.execPath, ["tools/agent-server/phase6-command-runner.mjs", ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    shell: false,
    env: commandEnvironment(keyFile),
  });
}

function runReleaseGate(configPath, keyFile) {
  return spawnSync(process.execPath, ["tools/agent-server/phase6-release-gate.mjs", "--config", configPath], {
    cwd: repoRoot,
    encoding: "utf8",
    shell: false,
    env: commandEnvironment(keyFile),
  });
}

function parseJson(stdout) {
  return JSON.parse(stdout.trim());
}

function passingGates(experimentId, progressSummary = {}) {
  return requiredGates.map((gate) => ({
    gate,
    ok: true,
    summary: gate === "tenRun"
      ? { ok: true, experimentIdHashes: [sha256(experimentId)] }
      : gate === "progress"
        ? {
          valid: true,
          verifiedPercent: 100,
          implementedPercent: 100,
          progressAsOf: "2026-07-21T00:00:00.000Z",
          staleVerifiedItemIds: [],
          ...progressSummary,
        }
        : { ok: true },
    errorCodes: [],
  }));
}

function releaseConfig({ manifestPath, inputPath, artifacts, experimentId }) {
  return {
    freshnessPolicy: { verifiedMaxAgeMinutes: 60 },
    evidenceManifest: { path: manifestPath },
    gates: {
      tenRun: { input: inputPath, experimentId },
      playerPanel: {
        before: artifacts["panel-before"],
        after: artifacts["panel-after"],
        receipts: [artifacts["panel-receipt"]],
        expectedRuns: 10,
      },
      idempotency: {
        commandAudit: artifacts["command-audit"],
        settlementAudit: artifacts["settlement-audit"],
        storeAudit: artifacts["store-audit"],
        journey: artifacts.journey,
        result: artifacts.result,
        epochEvents: artifacts["epoch-events"],
      },
      economy: { input: artifacts.economy, expectedRuns: 10 },
      world: { inputs: [artifacts.world] },
      progression: { input: artifacts.progression },
      score: { inputs: [artifacts.score], expectedRuns: 10 },
      rag: {
        queryEvaluations: [artifacts["rag-query"]],
        runReceipts: [artifacts["rag-receipt"]],
      },
      balance: { input: artifacts.balance, expectedRuns: 10000 },
      shop: { inputs: [artifacts.shop], minSinkSourceBps: 0 },
      crafting: {
        input: artifacts["crafting-input"],
        recipes: artifacts.recipes,
        crafts: artifacts.crafts,
        settlements: artifacts.settlements,
        progression: artifacts["crafting-progression"],
      },
      progress: { ledger: artifacts["progress-ledger"] },
    },
  };
}

function reportFor(evidence, options = {}) {
  const config = structuredClone(evidence.config);
  if (options.manifestPath !== undefined) config.evidenceManifest.path = options.manifestPath;
  if (options.experimentId !== undefined) config.gates.tenRun.experimentId = options.experimentId;
  if (options.mutateConfig) options.mutateConfig(config);
  const gateExperimentId = options.gateExperimentId ?? config.gates.tenRun.experimentId;
  const previousKey = process.env[ATTESTATION_KEY_ENV];
  const keyFile = options.keyFile ?? evidence.keyFile;
  if (keyFile === null) delete process.env[ATTESTATION_KEY_ENV];
  else process.env[ATTESTATION_KEY_ENV] = keyFile;
  try {
    return buildReport({
      config,
      configHash: "0".repeat(64),
      configErrors: [],
      configSecretCount: 0,
      gates: passingGates(gateExperimentId, options.progressSummary),
      now: new Date("2026-07-21T00:30:00.000Z"),
    });
  } finally {
    if (previousKey === undefined) delete process.env[ATTESTATION_KEY_ENV];
    else process.env[ATTESTATION_KEY_ENV] = previousKey;
  }
}

async function writeManifestVariant(evidence, name, mutate) {
  const variant = structuredClone(evidence.manifest);
  await mutate(variant);
  variant.outputHash = outputHash(variant);
  variant.manifestHash = manifestHash(variant);
  const manifestPath = `${evidence.relative}/${name}.json`;
  await writeFile(path.join(repoRoot, manifestPath), `${JSON.stringify(variant, null, 2)}\n`);
  return { manifestPath, manifest: variant };
}

async function makeGoldenEvidence(t) {
  const scratchName = `golden-${crypto.createHash("sha256").update(t.name).digest("hex").slice(0, 16)}`;
  const scratch = await resetScratch(scratchName);
  t.after(() => rm(scratch.absolute, { recursive: true, force: true }));
  const keyFile = createKey(t);

  const experimentId = "exp-golden";
  const inputText = `${JSON.stringify({ candidate: "alpha", experimentId })}\n`;
  const inputPath = await writeScratch(scratch.relative, "candidate.json", inputText);
  const artifacts = Object.fromEntries(artifactKeys.map((key) => [key, `${scratch.relative}/${key}.json`]));
  const receiptPath = `${scratch.relative}/execution-receipt.json`;
  const createArtifactsScript = [
    "const fs=require('node:fs')",
    "const entries=JSON.parse(process.argv[1])",
    "const experimentId=process.argv[2]",
    "setTimeout(()=>{for(const [artifact,file] of entries)fs.writeFileSync(file,JSON.stringify({ok:true,artifact,experimentId})+'\\n')},20)",
  ].join(";");
  const runnerArgs = [
    "--program",
    process.execPath,
    "--arg",
    "-e",
    "--arg",
    createArtifactsScript,
    "--arg",
    JSON.stringify(Object.entries(artifacts)),
    "--arg",
    experimentId,
    "--receipt",
    receiptPath,
  ];
  for (const artifactPath of Object.values(artifacts)) runnerArgs.push("--claim-output", artifactPath);
  const runner = runCommandRunner(runnerArgs, keyFile);
  assert.equal(runner.status, 0, runner.stderr || runner.stdout);
  const manifestPath = `${scratch.relative}/manifest.json`;
  const args = [
    "--experiment-id",
    experimentId,
    "--input-candidate",
    inputPath,
  ];
  for (const artifactPath of Object.values(artifacts)) args.push("--output-artifact", artifactPath);
  args.push("--execution-receipt", receiptPath, "--output", manifestPath);

  const result = runEvidencePack(args, keyFile);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const cliBody = parseJson(result.stdout);
  assert.equal(cliBody.ok, true);
  const manifest = JSON.parse(await readFile(path.join(repoRoot, manifestPath), "utf8"));
  assert.equal(manifest.manifestHash, manifestHash(manifest));
  assert.match(manifest.manifestHash, /^sha256:[a-f0-9]{64}$/);
  assert.match(manifest.outputHash, /^sha256:[a-f0-9]{64}$/);
  assert.deepEqual(Object.keys(manifest.command).sort(), ["argvHash", "cwd", "endedAt", "exitCode", "keyId", "outputs", "program", "receiptHash", "receiptPath", "schemaVersion", "signal", "signature", "startedAt", "stderr", "stdout"]);
  assert.equal(manifest.command.exitCode, 0);
  assert.equal(manifest.command.signal, null);
  assert.equal(JSON.stringify(manifest).includes("--candidate"), false);
  assert.equal(manifest.artifacts.length, artifactKeys.length);

  return {
    ...scratch,
    experimentId,
    inputPath,
    inputText,
    inputHash: sha256(inputText),
    artifacts,
    receiptPath,
    manifestPath,
    manifest,
    keyFile,
    config: releaseConfig({ manifestPath, inputPath, artifacts, experimentId }),
  };
}

test("golden evidence binds every configured gate input and release gate passes", async (t) => {
  const evidence = await makeGoldenEvidence(t);
  const report = reportFor(evidence);
  assert.equal(report.ok, true);
  assert.deepEqual(report.reason, []);
  assert.equal(report.progressVerifiedPercent, 100);
});

test("release gate requires object-shaped evidenceManifest config", async (t) => {
  const evidence = await makeGoldenEvidence(t);
  const missingConfig = structuredClone(evidence.config);
  delete missingConfig.evidenceManifest;
  const missingConfigPath = await writeScratch(evidence.relative, "release-missing-manifest.json", `${JSON.stringify(missingConfig, null, 2)}\n`);
  const cliResult = runReleaseGate(missingConfigPath, evidence.keyFile);
  assert.notEqual(cliResult.status, 0);
  assert.ok(parseJson(cliResult.stdout).reason.includes("E_EVIDENCE_MANIFEST_REQUIRED"));

  const missing = reportFor(evidence, { mutateConfig: (config) => delete config.evidenceManifest });
  assert.equal(missing.ok, false);
  assert.ok(missing.reason.includes("E_EVIDENCE_MANIFEST_REQUIRED"));

  const legacy = reportFor(evidence, { mutateConfig: (config) => { config.evidenceManifest = evidence.manifestPath; } });
  assert.equal(legacy.ok, false);
  assert.ok(legacy.reason.includes("E_EVIDENCE_CONFIG_LEGACY_SHAPE"));
});

test("release gate rejects a self-consistent legacy evidence manifest schema", async (t) => {
  const evidence = await makeGoldenEvidence(t);
  const variant = await writeManifestVariant(evidence, "manifest-legacy-schema", async (manifest) => {
    manifest.schemaVersion = "obsidian-epoch.phase6-evidence-pack.v1";
  });
  const report = reportFor(evidence, { manifestPath: variant.manifestPath });
  assert.equal(report.ok, false);
  assert.ok(report.reason.includes("E_EVIDENCE_SCHEMA_VERSION"));
  assert.equal(report.reason.includes("E_EVIDENCE_MANIFEST_HASH_MISMATCH"), false);
});

test("release gate rejects unsigned old-shape command receipts even with self-consistent manifest hashes", async (t) => {
  const evidence = await makeGoldenEvidence(t);
  const variant = await writeManifestVariant(evidence, "manifest-old-command-shape", async (manifest) => {
    manifest.command.schemaVersion = "obsidian-epoch.phase6-command-receipt.v1";
    delete manifest.command.keyId;
    delete manifest.command.signature;
    for (const output of manifest.command.outputs) {
      delete output.preState;
      delete output.createdByRun;
      delete output.mtime;
      delete output.ctime;
    }
  });

  const report = reportFor(evidence, { manifestPath: variant.manifestPath });
  assert.equal(report.ok, false);
  assert.ok(report.reason.includes("E_EVIDENCE_COMMAND"));
  assert.equal(report.reason.includes("E_EVIDENCE_MANIFEST_HASH_MISMATCH"), false);
});

test("evidence pack and release gate reject non-zero command exitCode", async (t) => {
  const evidence = await makeGoldenEvidence(t);
  const rejectedPath = `${evidence.relative}/non-zero-cli.json`;
  const failedReceiptPath = `${evidence.relative}/failed-receipt.json`;
  const failedOutputPath = `${evidence.relative}/failed-output.json`;
  const failedRunner = runCommandRunner([
    "--program",
    process.execPath,
    "--arg",
    "-e",
    "--arg",
    "const fs=require('node:fs');const p=process.argv[1];setTimeout(()=>{fs.writeFileSync(p,'failed output\\n');process.exit(7)},20)",
    "--arg",
    failedOutputPath,
    "--claim-output",
    failedOutputPath,
    "--receipt",
    failedReceiptPath,
  ], evidence.keyFile);
  assert.notEqual(failedRunner.status, 0);
  const cliResult = runEvidencePack([
    "--experiment-id",
    evidence.experimentId,
    "--input-candidate",
    evidence.inputPath,
    "--output-artifact",
    failedOutputPath,
    "--execution-receipt",
    failedReceiptPath,
    "--output",
    rejectedPath,
  ], evidence.keyFile);
  assert.notEqual(cliResult.status, 0);
  assert.ok(parseJson(cliResult.stdout).reason.includes("invalid_execution_receipt"));

  const variant = await writeManifestVariant(evidence, "manifest-non-zero", async (manifest) => {
    manifest.command.exitCode = 7;
  });
  const report = reportFor(evidence, { manifestPath: variant.manifestPath });
  assert.equal(report.ok, false);
  assert.ok(report.reason.includes("E_EVIDENCE_COMMAND_EXIT_CODE"));
  assert.equal(report.reason.includes("E_EVIDENCE_MANIFEST_HASH_MISMATCH"), false);
});

test("evidence pack rejects legacy caller-supplied command exit code shape", async (t) => {
  const evidence = await makeGoldenEvidence(t);
  const rejectedPath = `${evidence.relative}/legacy-exit-code.json`;
  const cliResult = runEvidencePack([
    "--experiment-id",
    evidence.experimentId,
    "--input-candidate",
    evidence.inputPath,
    "--output-artifact",
    evidence.artifacts.economy,
    "--command-exit-code",
    "0",
    "--output",
    rejectedPath,
  ], evidence.keyFile);
  assert.notEqual(cliResult.status, 0);
  assert.ok(parseJson(cliResult.stdout).reason.includes("invalid_arguments"));
});

test("release gate rejects a manifest that omits one configured gate input", async (t) => {
  const evidence = await makeGoldenEvidence(t);
  const omittedPath = evidence.artifacts["rag-query"];
  const variant = await writeManifestVariant(evidence, "manifest-omits-gate-input", async (manifest) => {
    manifest.artifacts = manifest.artifacts.filter((entry) => entry.path !== omittedPath);
  });
  const report = reportFor(evidence, { manifestPath: variant.manifestPath });
  assert.equal(report.ok, false);
  assert.ok(report.reason.includes("E_EVIDENCE_GATE_INPUT_MISSING"));
  assert.equal(report.reason.includes("E_EVIDENCE_MANIFEST_HASH_MISMATCH"), false);
});

test("release gate rejects an old independently passing artifact from another experiment", async (t) => {
  const evidence = await makeGoldenEvidence(t);
  const artifactPath = evidence.artifacts.economy;
  const oldText = `${JSON.stringify({ ok: true, artifact: "economy", experimentId: "exp-old" })}\n`;
  await writeFile(path.join(repoRoot, artifactPath), oldText);
  const variant = await writeManifestVariant(evidence, "manifest-old-artifact", async (manifest) => {
    const entry = manifest.artifacts.find((candidate) => candidate.path === artifactPath);
    entry.bytes = Buffer.byteLength(oldText);
    entry.sha256 = sha256(oldText);
  });

  const report = reportFor(evidence, { manifestPath: variant.manifestPath });
  assert.equal(report.ok, false);
  assert.ok(report.reason.includes("E_EVIDENCE_EXPERIMENT_MISMATCH"));
  assert.equal(report.reason.includes("E_EVIDENCE_FILE_HASH_MISMATCH"), false);
  assert.equal(report.reason.includes("E_EVIDENCE_GATE_INPUT_MISSING"), false);
});

test("release gate rejects a tampered manifestHash", async (t) => {
  const evidence = await makeGoldenEvidence(t);
  const tamperedPath = `${evidence.relative}/manifest-tampered.json`;
  const tampered = { ...evidence.manifest, outputHash: sha256("different-output\n") };
  await writeFile(path.join(repoRoot, tamperedPath), `${JSON.stringify(tampered, null, 2)}\n`);

  const report = reportFor(evidence, { manifestPath: tamperedPath });
  assert.equal(report.ok, false);
  assert.ok(report.reason.includes("E_EVIDENCE_MANIFEST_HASH_MISMATCH"));
});

test("release gate rejects input candidates changed after manifest generation", async (t) => {
  const evidence = await makeGoldenEvidence(t);
  await writeFile(path.join(repoRoot, evidence.inputPath), `${JSON.stringify({ candidate: "changed", experimentId: evidence.experimentId })}\n`);

  const report = reportFor(evidence);
  assert.equal(report.ok, false);
  assert.ok(report.reason.includes("E_EVIDENCE_FILE_HASH_MISMATCH"));
});

test("release gate rejects tampered execution receipts and changed artifact contents", async (t) => {
  const evidence = await makeGoldenEvidence(t);
  const tamperedReceipt = JSON.parse(await readFile(path.join(repoRoot, evidence.receiptPath), "utf8"));
  tamperedReceipt.exitCode = 0;
  tamperedReceipt.stdout.bytes += 1;
  await writeFile(path.join(repoRoot, evidence.receiptPath), `${JSON.stringify(tamperedReceipt, null, 2)}\n`, { mode: 0o600 });
  const tamperedReport = reportFor(evidence);
  assert.equal(tamperedReport.ok, false);
  assert.ok(tamperedReport.reason.includes("E_EVIDENCE_RECEIPT_INVALID"));

  const restored = structuredClone(evidence.manifest.command);
  await writeFile(path.join(repoRoot, evidence.receiptPath), `${JSON.stringify({ ...restored, receiptHash: restored.receiptHash }, null, 2)}\n`, { mode: 0o600 });
  await writeFile(path.join(repoRoot, evidence.artifacts.economy), `${JSON.stringify({ ok: true, artifact: "economy", experimentId: evidence.experimentId, changed: true })}\n`);
  const changedReport = reportFor(evidence);
  assert.equal(changedReport.ok, false);
  assert.ok(changedReport.reason.includes("E_EVIDENCE_FILE_HASH_MISMATCH"));
  assert.ok(changedReport.reason.includes("E_EVIDENCE_RECEIPT_INVALID"));
});

test("evidence pack, release gate, and release CLI require the matching external attestation key", async (t) => {
  const evidence = await makeGoldenEvidence(t);
  const wrongKey = createKey(t);
  const packArgs = [
    "--experiment-id",
    evidence.experimentId,
    "--input-candidate",
    evidence.inputPath,
    "--output-artifact",
    evidence.artifacts.economy,
    "--execution-receipt",
    evidence.receiptPath,
  ];

  const wrongKeyResult = runEvidencePack([...packArgs, "--output", `${evidence.relative}/wrong-key-manifest.json`], wrongKey);
  assert.notEqual(wrongKeyResult.status, 0);
  assert.ok(parseJson(wrongKeyResult.stdout).reason.includes("invalid_execution_receipt"));

  const missingKeyResult = runEvidencePack([...packArgs, "--output", `${evidence.relative}/missing-key-manifest.json`], null);
  assert.notEqual(missingKeyResult.status, 0);
  assert.ok(parseJson(missingKeyResult.stdout).reason.includes("invalid_attestation_key"));

  const copiedReceiptPath = `${evidence.relative}/copied-receipt.json`;
  await writeFile(path.join(repoRoot, copiedReceiptPath), await readFile(path.join(repoRoot, evidence.receiptPath)), { mode: 0o600 });
  await fs.promises.chmod(path.join(repoRoot, copiedReceiptPath), 0o600);
  const copiedReceiptResult = runEvidencePack([
    ...packArgs.slice(0, -1),
    copiedReceiptPath,
    "--output",
    `${evidence.relative}/copied-receipt-manifest.json`,
  ], evidence.keyFile);
  assert.notEqual(copiedReceiptResult.status, 0);
  assert.ok(parseJson(copiedReceiptResult.stdout).reason.includes("invalid_execution_receipt"));

  const wrongKeyReport = reportFor(evidence, { keyFile: wrongKey });
  assert.equal(wrongKeyReport.ok, false);
  assert.ok(wrongKeyReport.reason.includes("E_EVIDENCE_RECEIPT_INVALID"));

  const configPath = await writeScratch(evidence.relative, "release-config.json", `${JSON.stringify(evidence.config, null, 2)}\n`);
  const missingKeyRelease = runReleaseGate(configPath, null);
  assert.notEqual(missingKeyRelease.status, 0);
  assert.ok(parseJson(missingKeyRelease.stdout).reason.includes("E_ATTESTATION_KEY"));
});

test("self-consistent handwritten receipt claims cannot bypass evidence or release verification", async (t) => {
  const evidence = await makeGoldenEvidence(t);
  const forgedReceiptPath = `${evidence.relative}/handwritten-receipt.json`;
  const forged = JSON.parse(await readFile(path.join(repoRoot, evidence.receiptPath), "utf8"));
  forged.receiptPath = forgedReceiptPath;
  forged.outputs[0].preState = "present";
  forged.outputs[0].createdByRun = false;
  forged.receiptHash = receiptHash(forged);
  await writeFile(path.join(repoRoot, forgedReceiptPath), `${JSON.stringify(forged, null, 2)}\n`, { mode: 0o600 });
  await fs.promises.chmod(path.join(repoRoot, forgedReceiptPath), 0o600);

  const packResult = runEvidencePack([
    "--experiment-id",
    evidence.experimentId,
    "--input-candidate",
    evidence.inputPath,
    "--output-artifact",
    evidence.artifacts.economy,
    "--execution-receipt",
    forgedReceiptPath,
    "--output",
    `${evidence.relative}/handwritten-manifest.json`,
  ], evidence.keyFile);
  assert.notEqual(packResult.status, 0);
  assert.ok(parseJson(packResult.stdout).reason.includes("invalid_execution_receipt"));

  const variant = await writeManifestVariant(evidence, "manifest-handwritten-receipt", async (manifest) => {
    manifest.command = structuredClone(forged);
  });
  const releaseReport = reportFor(evidence, { manifestPath: variant.manifestPath });
  assert.equal(releaseReport.ok, false);
  assert.ok(releaseReport.reason.includes("E_EVIDENCE_RECEIPT_INVALID"));
});

test("release gate scans manifest-bound file contents for secrets", async (t) => {
  const evidence = await makeGoldenEvidence(t);
  const secretText = "clientSecret=sk-abc123456789secret\n";
  await writeFile(path.join(repoRoot, evidence.artifacts.economy), secretText);
  const variant = await writeManifestVariant(evidence, "manifest-secret-artifact", async (manifest) => {
    const entry = manifest.artifacts.find((candidate) => candidate.path === evidence.artifacts.economy);
    entry.bytes = Buffer.byteLength(secretText);
    entry.sha256 = sha256(secretText);
  });
  const report = reportFor(evidence, { manifestPath: variant.manifestPath });
  assert.equal(report.ok, false);
  assert.ok(report.reason.includes("E_EVIDENCE_FILE_SECRET"));
});

test("release gate rejects stale or old-shape progress reports", async (t) => {
  const evidence = await makeGoldenEvidence(t);
  const stale = reportFor(evidence, {
    progressSummary: {
      progressAsOf: "2026-07-20T22:00:00.000Z",
      staleVerifiedItemIds: ["P6-M1-01"],
    },
  });
  assert.equal(stale.ok, false);
  assert.ok(stale.reason.includes("E_PROGRESS_STALE"));
  assert.ok(stale.reason.includes("E_PROGRESS_STALE_VERIFIED_ITEMS"));

  const oldShape = reportFor(evidence, {
    progressSummary: { progressAsOf: undefined, staleVerifiedItemIds: undefined },
  });
  assert.equal(oldShape.ok, false);
  assert.ok(oldShape.reason.includes("E_PROGRESS_AS_OF_REQUIRED"));
  assert.ok(oldShape.reason.includes("E_PROGRESS_STALE_LIST_REQUIRED"));
});

test("release gate rejects ten-run experiment mismatches", async (t) => {
  const evidence = await makeGoldenEvidence(t);
  const report = reportFor(evidence, { experimentId: "exp-other", gateExperimentId: "exp-other" });
  assert.equal(report.ok, false);
  assert.ok(report.reason.includes("E_EVIDENCE_EXPERIMENT_MISMATCH"));
});

test("evidence-pack rejects secret-looking candidate and artifact content", async (t) => {
  const scratch = await resetScratch("guard-content");
  t.after(() => rm(scratch.absolute, { recursive: true, force: true }));
  const keyFile = createKey(t);
  const inputPath = await writeScratch(scratch.relative, "candidate.json", "{\"candidate\":\"alpha\"}\n");
  const artifactPath = await writeScratch(scratch.relative, "result.txt", "apiKey=sk-abc123456789secret\n");
  const manifestPath = `${scratch.relative}/manifest.json`;

  const result = runEvidencePack([
    "--experiment-id",
    "exp-guard",
    "--input-candidate",
    inputPath,
    "--output-artifact",
    artifactPath,
    "--output",
    manifestPath,
  ], keyFile);
  assert.notEqual(result.status, 0);
  const body = parseJson(result.stdout);
  assert.equal(body.ok, false);
  assert.ok(body.reason.includes("secret_key") || body.reason.includes("secret_value"));
});
