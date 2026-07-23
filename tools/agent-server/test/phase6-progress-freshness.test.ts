import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { ATTESTATION_KEY_ENV } from "../phase6-command-runner.ts";

const repositoryRoot = path.resolve(import.meta.dirname, "../../..");
const progressScript = path.join(repositoryRoot, "tools/agent-server/phase6-progress.ts");
const updateScript = path.join(repositoryRoot, "tools/agent-server/phase6-progress-update.ts");
const runnerScript = path.join(repositoryRoot, "tools/agent-server/phase6-command-runner.ts");
const fixtureRoot = "tools/agent-server/test/.phase6-progress-fixtures";

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function prefixedSha256(value) {
  return `sha256:${value}`;
}

function canonicalJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalJson(entry)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function withEvidenceHash(entry) {
  const clone = structuredClone(entry);
  delete clone.evidenceHash;
  return {
    ...entry,
    evidenceHash: prefixedSha256(sha256(canonicalJson(clone))),
  };
}

function runJson(script, args, options = {}) {
  const env = { ...process.env };
  if (options.keyFile === null) delete env[ATTESTATION_KEY_ENV];
  else if (options.keyFile !== undefined) env[ATTESTATION_KEY_ENV] = options.keyFile;
  try {
    const stdout = execFileSync(process.execPath, [script, ...args], {
      cwd: repositoryRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env,
    });
    return { ok: true, payload: JSON.parse(stdout), stdout };
  } catch (error) {
    if (!options.allowFailure) {
      throw error;
    }
    return {
      ok: false,
      payload: JSON.parse(error.stdout.toString()),
      stdout: error.stdout.toString(),
      stderr: error.stderr.toString(),
    };
  }
}

function createHarness(t) {
  const suffix = `${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const fixtureDirectoryRelative = `${fixtureRoot}/${suffix}`;
  const fixtureDirectory = path.join(repositoryRoot, fixtureDirectoryRelative);
  fs.mkdirSync(fixtureDirectory, { recursive: true });
  const ledgerDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "phase6-progress-ledger-"));
  const keyFile = path.join(ledgerDirectory, "trust.bin");
  fs.writeFileSync(keyFile, crypto.randomBytes(32), { mode: 0o600 });
  fs.chmodSync(keyFile, 0o600);
  t.after(() => {
    fs.rmSync(fixtureDirectory, { recursive: true, force: true });
    fs.rmSync(ledgerDirectory, { recursive: true, force: true });
  });

  const specPath = `${fixtureDirectoryRelative}/spec.md`;
  const checklistPath = `${fixtureDirectoryRelative}/checklist.md`;
  const inputPath = `${fixtureDirectoryRelative}/input.txt`;
  const outputPath = `${fixtureDirectoryRelative}/output.txt`;
  fs.writeFileSync(path.join(repositoryRoot, specPath), "<!-- phase6-milestone:P6-M1:100 -->\n", "utf8");
  fs.writeFileSync(path.join(repositoryRoot, inputPath), "synthetic runtime input\n", "utf8");
  let receiptIndex = 0;

  function strongCommandEvidence() {
    receiptIndex += 1;
    const receiptPath = `${fixtureDirectoryRelative}/receipt-${receiptIndex}.json`;
    execFileSync(process.execPath, [
      runnerScript,
      "--program",
      process.execPath,
      "--arg",
      "-e",
      "--arg",
      "const fs=require('node:fs');const p=process.argv[1];setTimeout(()=>fs.writeFileSync(p,'synthetic runtime output\\n'),20)",
      "--arg",
      outputPath,
      "--claim-output",
      outputPath,
      "--receipt",
      receiptPath,
    ], {
      cwd: repositoryRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, [ATTESTATION_KEY_ENV]: keyFile },
    });
    const receipt = JSON.parse(fs.readFileSync(path.join(repositoryRoot, receiptPath), "utf8"));
    return withEvidenceHash({
      kind: "command",
      argvHash: receipt.argvHash,
      receiptPath,
      receiptHash: receipt.receiptHash,
      observedAt: receipt.endedAt,
      capturedAt: receipt.endedAt,
      summary: "Synthetic successful runtime command bound to input and output files.",
      outputPath,
      outputHash: prefixedSha256(sha256File(path.join(repositoryRoot, outputPath))),
    });
  }

  function writeLedger({
    status = "verified",
    evidence = [],
    checklistChecked = status === "verified",
    freshnessMinutes = 1440,
    phaseStatus = status === "verified" ? "complete" : "active",
    includeSecondImplementedItem = false,
  } = {}) {
    fs.writeFileSync(
      path.join(repositoryRoot, checklistPath),
      [
        "<!-- progress-milestone:P6-M1 -->",
        `- [${checklistChecked ? "x" : " "}] Synthetic item <!-- progress-item:P6-M1-01 -->`,
        ...(includeSecondImplementedItem
          ? ["- [ ] Other synthetic item <!-- progress-item:P6-M1-02 -->"]
          : []),
        "",
      ].join("\n"),
      "utf8",
    );
    const itemWeight = includeSecondImplementedItem ? 50 : 100;
    const ledger = {
      schemaVersion: "obsidian-epoch.phase-progress.v1",
      phaseId: "phase-6-observable-ten-run",
      title: "Synthetic Phase 6 progress ledger",
      status: phaseStatus,
      specPath,
      checklistPath,
      lastUpdatedAt: "2026-07-21T00:00:00.000Z",
      lastUpdatedBy: "test",
      progressPolicy: {
        implementedStatuses: ["implemented", "verified"],
        verifiedStatuses: ["verified"],
        completionRequiresVerifiedWeight: 100,
        derivedPercentagesAreNotStored: true,
      },
      freshnessPolicy: {
        verifiedMaxAgeMinutes: freshnessMinutes,
      },
      milestones: [
        {
          id: "P6-M1",
          title: "Synthetic milestone",
          weight: 100,
          items: [
            {
              id: "P6-M1-01",
              title: "Synthetic item",
              weight: itemWeight,
              status,
              evidence,
              updatedAt: "2026-07-21T00:00:00.000Z",
            },
            ...(includeSecondImplementedItem
              ? [{
                id: "P6-M1-02",
                title: "Other synthetic item",
                weight: 50,
                status: "implemented",
                evidence: [
                  {
                    kind: "artifact",
                    path: inputPath,
                    observedAt: "2026-07-21T00:00:00.000Z",
                    summary: "Implemented evidence.",
                  },
                ],
                updatedAt: "2026-07-21T00:00:00.000Z",
              }]
              : []),
          ],
        },
      ],
    };
    const ledgerPath = path.join(ledgerDirectory, "ledger.json");
    fs.writeFileSync(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`, "utf8");
    return ledgerPath;
  }

  return { inputPath, outputPath, keyFile, strongCommandEvidence, writeLedger };
}

test("static artifact and review evidence cannot make an item verified", (t) => {
  const harness = createHarness(t);
  const ledgerPath = harness.writeLedger({
    evidence: [
      {
        kind: "artifact",
        path: harness.inputPath,
        observedAt: "2026-07-21T00:00:00.000Z",
        summary: "Static file reference.",
      },
      {
        kind: "review",
        observedAt: "2026-07-21T00:00:00.000Z",
        summary: "Human review alone is not runtime evidence.",
      },
    ],
  });

  const result = runJson(progressScript, ["--json", "--ledger", ledgerPath, "--as-of", "2026-07-21T00:30:00.000Z"], { allowFailure: true, keyFile: harness.keyFile });

  assert.equal(result.ok, false);
  assert.equal(result.payload.valid, false);
  assert.equal(result.payload.verifiedPercent, 0);
  assert.match(result.payload.errors.join("\n"), /without strong runtime evidence/);
});

test("metric evidence must bind its current source file to a signed receipt output", (t) => {
  const harness = createHarness(t);
  const commandEvidence = harness.strongCommandEvidence();
  const inputHash = prefixedSha256(sha256File(path.join(repositoryRoot, harness.inputPath)));
  const metricEvidence = withEvidenceHash({
    kind: "metric",
    name: "synthetic-count",
    actual: 1,
    expected: 1,
    comparator: "=",
    sourcePath: harness.inputPath,
    sha256: inputHash.slice("sha256:".length),
    outputHash: inputHash,
    receiptPath: commandEvidence.receiptPath,
    receiptHash: commandEvidence.receiptHash,
    observedAt: commandEvidence.observedAt,
    capturedAt: commandEvidence.capturedAt,
    summary: "Metric source is intentionally unrelated to the signed command output.",
  });
  const ledgerPath = harness.writeLedger({ evidence: [metricEvidence] });
  const asOf = new Date(Date.parse(metricEvidence.capturedAt) + 30 * 60_000).toISOString();

  const result = runJson(progressScript, ["--json", "--ledger", ledgerPath, "--as-of", asOf], { allowFailure: true, keyFile: harness.keyFile });

  assert.equal(result.ok, false);
  assert.match(result.payload.errors.join("\n"), /not declared in receipt outputs/);
});

test("fresh strong runtime evidence counts as current verified progress", (t) => {
  const harness = createHarness(t);
  const evidence = harness.strongCommandEvidence();
  const asOf = new Date(Date.parse(evidence.capturedAt) + 30 * 60_000).toISOString();
  const ledgerPath = harness.writeLedger({
    evidence: [evidence],
  });

  const result = runJson(progressScript, ["--json", "--ledger", ledgerPath, "--as-of", asOf], { keyFile: harness.keyFile });

  assert.equal(result.payload.valid, true);
  assert.equal(result.payload.verifiedPercent, 100);
  assert.equal(result.payload.currentVerifiedPercent, 100);
  assert.deepEqual(result.payload.staleVerifiedItemIds, []);
  assert.deepEqual(result.payload.freshnessPolicy, { verifiedMaxAgeMinutes: 1440 });
  assert.equal(result.payload.progressAsOf, asOf);
});

test("expired strong runtime evidence is stale and does not count toward current verified progress", (t) => {
  const harness = createHarness(t);
  const evidence = harness.strongCommandEvidence();
  const asOf = new Date(Date.parse(evidence.capturedAt) + 120 * 60_000).toISOString();
  const ledgerPath = harness.writeLedger({
    phaseStatus: "active",
    freshnessMinutes: 60,
    includeSecondImplementedItem: true,
    evidence: [evidence],
  });

  const result = runJson(progressScript, ["--json", "--ledger", ledgerPath, "--as-of", asOf], { keyFile: harness.keyFile });

  assert.equal(result.payload.valid, true);
  assert.equal(result.payload.verifiedPercent, 0);
  assert.equal(result.payload.currentVerifiedPercent, 0);
  assert.deepEqual(result.payload.staleVerifiedItemIds, ["P6-M1-01"]);
});

test("hash mismatches invalidate strong runtime evidence", (t) => {
  const harness = createHarness(t);
  const evidence = harness.strongCommandEvidence();
  evidence.receiptHash = prefixedSha256("0".repeat(64));
  evidence.evidenceHash = withEvidenceHash(evidence).evidenceHash;
  const ledgerPath = harness.writeLedger({ evidence: [evidence] });

  const asOf = new Date(Date.parse(evidence.capturedAt) + 30 * 60_000).toISOString();
  const result = runJson(progressScript, ["--json", "--ledger", ledgerPath, "--as-of", asOf], { allowFailure: true, keyFile: harness.keyFile });

  assert.equal(result.ok, false);
  assert.equal(result.payload.valid, false);
  assert.match(result.payload.errors.join("\n"), /receiptHash does not match/);
});

test("progress rejects a copied receipt whose evidence path is not the signed receiptPath", (t) => {
  const harness = createHarness(t);
  const evidence = harness.strongCommandEvidence();
  const copiedReceiptPath = `${path.dirname(evidence.receiptPath)}/receipt-copy.json`;
  fs.copyFileSync(path.join(repositoryRoot, evidence.receiptPath), path.join(repositoryRoot, copiedReceiptPath));
  fs.chmodSync(path.join(repositoryRoot, copiedReceiptPath), 0o600);
  evidence.receiptPath = copiedReceiptPath;
  evidence.evidenceHash = withEvidenceHash(evidence).evidenceHash;
  const ledgerPath = harness.writeLedger({ evidence: [evidence] });
  const asOf = new Date(Date.parse(evidence.capturedAt) + 30 * 60_000).toISOString();

  const result = runJson(progressScript, ["--json", "--ledger", ledgerPath, "--as-of", asOf], { allowFailure: true, keyFile: harness.keyFile });

  assert.equal(result.ok, false);
  assert.match(result.payload.errors.join("\n"), /receiptPath does not match signed receiptPath/);
});

test("progress and updater fail closed for missing or mismatched attestation keys", (t) => {
  const harness = createHarness(t);
  const evidence = harness.strongCommandEvidence();
  const ledgerPath = harness.writeLedger({ evidence: [evidence] });
  const asOf = new Date(Date.parse(evidence.capturedAt) + 30 * 60_000).toISOString();
  const wrongDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "phase6-progress-wrong-key-"));
  const wrongKey = path.join(wrongDirectory, "trust.bin");
  fs.writeFileSync(wrongKey, crypto.randomBytes(32), { mode: 0o600 });
  fs.chmodSync(wrongKey, 0o600);
  t.after(() => fs.rmSync(wrongDirectory, { recursive: true, force: true }));

  const wrong = runJson(progressScript, ["--json", "--ledger", ledgerPath, "--as-of", asOf], { allowFailure: true, keyFile: wrongKey });
  assert.equal(wrong.ok, false);
  assert.equal(wrong.payload.valid, false);
  assert.match(wrong.payload.errors.join("\n"), /keyId does not match|signature verification failed/);

  const missing = runJson(progressScript, ["--json", "--ledger", ledgerPath, "--as-of", asOf], { allowFailure: true, keyFile: null });
  assert.equal(missing.ok, false);
  assert.match(missing.payload.errors.join("\n"), /attestation key invalid/);

  const updater = runJson(updateScript, ["--ledger", ledgerPath, "--item", "P6-M1-01", "--status", "verified"], { allowFailure: true, keyFile: null });
  assert.equal(updater.ok, false);
  assert.equal(updater.payload.code, "attestation_key_invalid");
});

test("as-of timestamp deterministically controls freshness", (t) => {
  const harness = createHarness(t);
  const evidence = harness.strongCommandEvidence();
  const freshAsOf = new Date(Date.parse(evidence.capturedAt) + 59 * 60_000).toISOString();
  const staleAsOf = new Date(Date.parse(evidence.capturedAt) + 61 * 60_000).toISOString();
  const ledgerPath = harness.writeLedger({
    phaseStatus: "active",
    freshnessMinutes: 60,
    includeSecondImplementedItem: true,
    evidence: [evidence],
  });

  const fresh = runJson(progressScript, ["--json", "--ledger", ledgerPath, "--as-of", freshAsOf], { keyFile: harness.keyFile });
  const stale = runJson(progressScript, ["--json", "--ledger", ledgerPath, "--as-of", staleAsOf], { keyFile: harness.keyFile });

  assert.equal(fresh.payload.verifiedPercent, 50);
  assert.equal(stale.payload.verifiedPercent, 0);
  assert.deepEqual(stale.payload.staleVerifiedItemIds, ["P6-M1-01"]);
});

test("updater refuses to promote implemented items using review-only evidence", (t) => {
  const harness = createHarness(t);
  const ledgerPath = harness.writeLedger({
    status: "implemented",
    checklistChecked: false,
    includeSecondImplementedItem: true,
    evidence: [
      {
        kind: "artifact",
        path: harness.inputPath,
        observedAt: "2026-07-21T00:00:00.000Z",
        summary: "Implemented evidence.",
      },
    ],
  });
  const reviewEvidence = JSON.stringify({
    kind: "review",
    observedAt: new Date().toISOString(),
    summary: "Review-only verification attempt.",
  });

  const result = runJson(updateScript, [
    "--ledger",
    ledgerPath,
    "--item",
    "P6-M1-01",
    "--status",
    "verified",
    "--evidence-json",
    reviewEvidence,
  ], { allowFailure: true, keyFile: harness.keyFile });

  assert.equal(result.ok, false);
  assert.equal(result.payload.code, "candidate_validation_failed");
  assert.match(result.payload.errors.join("\n"), /without strong runtime evidence/);
});

test("updater accepts fresh strong runtime evidence for an explicit verified transition", (t) => {
  const harness = createHarness(t);
  const ledgerPath = harness.writeLedger({
    status: "implemented",
    checklistChecked: false,
    includeSecondImplementedItem: true,
    evidence: [
      {
        kind: "artifact",
        path: harness.inputPath,
        observedAt: "2026-07-21T00:00:00.000Z",
        summary: "Implemented evidence.",
      },
    ],
  });

  const result = runJson(updateScript, [
    "--ledger",
    ledgerPath,
    "--item",
    "P6-M1-01",
    "--status",
    "verified",
    "--evidence-json",
    JSON.stringify(harness.strongCommandEvidence()),
  ], { keyFile: harness.keyFile });

  assert.equal(result.payload.ok, true);
  const updated = JSON.parse(fs.readFileSync(ledgerPath, "utf8"));
  assert.equal(updated.milestones[0].items[0].status, "verified");
});
