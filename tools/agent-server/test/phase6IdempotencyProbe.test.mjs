import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { eventIdEvidence, runProbe, validateProbeEvidence } from "../phase6-idempotency-probe.mjs";

const REPO_ROOT = path.resolve(import.meta.dirname, "../../..");
const PROBE_SOURCE = path.join(REPO_ROOT, "tools/agent-server/phase6-idempotency-probe.mjs");
const GATE_SOURCE = path.join(REPO_ROOT, "tools/agent-server/phase6-idempotency-gate.mjs");

async function readJsonl(file) {
  const text = await readFile(file, "utf8");
  return text.trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));
}

async function writeJsonl(file, records) {
  await writeFile(file, `${records.map((record) => JSON.stringify(record)).join("\n")}\n`, { mode: 0o600 });
}

function runGate(files) {
  const result = spawnSync(process.execPath, [
    GATE_SOURCE,
    "--command-audit", path.relative(REPO_ROOT, files.commandAudit),
    "--settlement-audit", path.relative(REPO_ROOT, files.settlementAudit),
    "--store-audit", path.relative(REPO_ROOT, files.storeAudit),
    "--epoch-events", path.relative(REPO_ROOT, files.epochEvents),
    "--result-pages", path.relative(REPO_ROOT, files.resultPages),
  ], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  return {
    ...result,
    report: JSON.parse(result.stdout),
  };
}

function assertRawEventSequence(record, label) {
  assert.ok(record, `${label} record missing`);
  assert.ok(Array.isArray(record.rawEventIds), `${label} rawEventIds missing`);
  assert.ok(record.rawEventIds.length > 0, `${label} rawEventIds empty`);
  assert.deepEqual(record.canonicalEventIds, [...new Set(record.rawEventIds)], `${label} canonicalEventIds mismatch`);
  assert.equal(record.duplicateEventCount, 0, `${label} duplicateEventCount`);
}

async function removeEvidenceSet(prefix) {
  const parsed = path.parse(prefix);
  const base = path.join(parsed.dir, parsed.name);
  const ext = parsed.ext || ".jsonl";
  await Promise.all([
    prefix,
    `${base}.settlement${ext}`,
    `${base}.store${ext}`,
    `${base}.epoch-events${ext}`,
    `${base}.result-pages${ext}`,
    `${base}.manifest${ext}`,
  ].map((file) => rm(file, { force: true })));
}

test("phase6 idempotency probe uses public journey commit and compact MCP wrappers", async () => {
  const source = await readFile(PROBE_SOURCE, "utf8");

  assert.doesNotMatch(source, /mcp\.runtime\.epochCommitJourneyAction/u);
  assert.match(source, /callJson\(mcp,\s*"obsidian_epoch\.commit_journey_action_compact"/u);
  assert.match(source, /callJson\(mcp,\s*"obsidian_epoch\.journey_status_compact"/u);
});

test("phase6 idempotency probe emits replay-stable hashes, fail-closed conflicts, and nonduplicated events", async () => {
  const output = `.tmp-phase6-idempotency-probe-test-${process.pid}.jsonl`;
  const outputPath = path.join(REPO_ROOT, output);
  await removeEvidenceSet(outputPath);
  try {
    const result = await runProbe({ output, seed: "test-seed", experimentId: "test-experiment" });
    const command = await readJsonl(result.files.commandAudit);
    const settlement = await readJsonl(result.files.settlementAudit);
    const store = await readJsonl(result.files.storeAudit);
    const events = await readJsonl(result.files.epochEvents);
    const pages = await readJsonl(result.files.resultPages);
    const manifest = await readJsonl(result.files.manifest);

    const worldAttempts = command.filter((record) => record.commandId === "probe_world_tick_command");
    assert.equal(worldAttempts.length, 3);
    assert.equal(worldAttempts[0].resultHash, worldAttempts[1].resultHash);
    assert.equal(worldAttempts[0].writeCount, 1);
    assert.equal(worldAttempts[1].writeCount, 0);
    assert.equal(worldAttempts[1].duplicate, true);
    assert.equal(worldAttempts[2].conflict, true);
    assert.equal(worldAttempts[2].writeCount, 0);
    assert.match(worldAttempts[2].errorCode, /conflict/u);

    const journeyAttempts = settlement.filter((record) => record.commandId === "probe-journey-commit");
    assert.equal(journeyAttempts.length, 3);
    assert.equal(journeyAttempts[0].resultHash, journeyAttempts[1].resultHash);
    assert.equal(journeyAttempts[0].writeCount, 1);
    assert.equal(journeyAttempts[1].writeCount, 0);
    assert.equal(journeyAttempts[1].duplicate, true);
    assert.equal(journeyAttempts[2].conflict, true);
    assert.equal(journeyAttempts[2].writeCount, 0);
    assert.match(journeyAttempts[2].errorCode, /conflict/u);
    assertRawEventSequence(journeyAttempts[0], "commit first");
    assertRawEventSequence(journeyAttempts[1], "commit replay");
    assert.deepEqual(journeyAttempts[0].rawEventIds, journeyAttempts[1].rawEventIds);

    const statusAttempts = settlement.filter((record) => record.operation === "finalize_receipt_read");
    assert.equal(statusAttempts.length, 2);
    assertRawEventSequence(statusAttempts[0], "status first");
    assertRawEventSequence(statusAttempts[1], "status replay");
    assert.deepEqual(statusAttempts[0].rawEventIds, statusAttempts[1].rawEventIds);

    const pageAttempts = store.filter((record) => record.commandId === "probe-result-page");
    assert.equal(pageAttempts[0].writeCount, 1);
    assert.equal(pageAttempts[1].writeCount, 0);
    assert.equal(pageAttempts[1].duplicate, true);
    assertRawEventSequence(pageAttempts[0], "page first");
    assertRawEventSequence(pageAttempts[1], "page replay");
    assert.deepEqual(pageAttempts[0].rawEventIds, pageAttempts[1].rawEventIds);

    for (const record of [...command, ...settlement, ...store, ...events, ...pages]) {
      if ("duplicateEventCount" in record) assert.equal(record.duplicateEventCount, 0);
    }
    for (const record of [...events, ...pages]) assertRawEventSequence(record, `${record.auditTarget}:${record.type}`);

    assert.equal(manifest[0].duplicateEventCount, 0);
    assert.equal(manifest[0].duplicateResourceEventCount, 0);
    assert.equal(manifest[0].duplicateGrowthEventCount, 0);
    assert.equal(manifest[0].duplicateWorldEventCount, 0);

    const gated = runGate(result.files);
    assert.equal(gated.status, 0, `${gated.stdout}\n${gated.stderr}`);
    assert.equal(gated.report.ok, true);
    assert.equal(gated.report.status, "passed");
    assert.deepEqual(gated.report.errorCodes, []);
    assert.ok(gated.report.metrics.inputFiles > 0);
    assert.ok(gated.report.metrics.inputRows > 0);
    assert.equal(gated.report.metrics.parseErrors, 0);
    assert.ok(gated.report.metrics.idempotencyAttempts > 0);
    assert.ok(gated.report.metrics.idempotencyGroups > 0);
    assert.ok(gated.report.metrics.repeatedIdempotencyGroups > 0);
    assert.ok(gated.report.metrics.idempotencyConflictGroups > 0);
    assert.ok(gated.report.metrics.duplicateReplays > 0);
    assert.ok(gated.report.metrics.provenSingleWriteGroups > 0);
    for (const metric of Object.values(gated.report.metrics.sideEffects)) {
      assert.ok(metric.rowCount > 0);
      assert.equal(metric.duplicateBusinessKeyCount, 0);
    }
    assert.doesNotMatch(`${gated.stdout}\n${gated.stderr}`, /"E_[A-Z0-9_]+"/u);

    for (const file of Object.values(result.files)) {
      const mode = (await stat(file)).mode & 0o777;
      assert.equal(mode, 0o600);
    }
  } finally {
    await removeEvidenceSet(outputPath);
  }
});

test("duplicate raw event evidence fails closed in both probe validation and the gate", async () => {
  const output = `.tmp-phase6-idempotency-probe-duplicate-test-${process.pid}.jsonl`;
  const outputPath = path.join(REPO_ROOT, output);
  await removeEvidenceSet(outputPath);
  try {
    const result = await runProbe({ output, seed: "duplicate-raw", experimentId: "duplicate-raw" });
    const events = await readJsonl(result.files.epochEvents);
    const source = events.find((record) => record.type === "journey_episode_recorded");
    assertRawEventSequence(source, "duplicate injection source");

    const duplicatedIds = eventIdEvidence([...source.rawEventIds, source.rawEventIds[0]]);
    assert.equal(duplicatedIds.duplicateEventCount, 1);
    const duplicateRecord = { ...source, ...duplicatedIds };
    assert.throws(
      () => validateProbeEvidence([...events, { ...duplicateRecord, duplicateEventCount: 0 }]),
      /E_PROBE_DUPLICATE_RAW_EVENT_IDS/u,
    );

    await writeJsonl(result.files.epochEvents, [...events, duplicateRecord]);
    const gated = runGate(result.files);
    assert.equal(gated.status, 1, `${gated.stdout}\n${gated.stderr}`);
    assert.equal(gated.report.ok, false);
    assert.ok(gated.report.errorCodes.includes("E_SIDE_EFFECT_DUPLICATE"));
  } finally {
    await removeEvidenceSet(outputPath);
  }
});

test("phase6 idempotency probe output omits recovery credentials and token material", async () => {
  const output = `.tmp-phase6-idempotency-probe-scan-test-${process.pid}.jsonl`;
  const outputPath = path.join(REPO_ROOT, output);
  await removeEvidenceSet(outputPath);
  try {
    const result = await runProbe({ output, seed: "secret-scan", experimentId: "secret-scan" });
    const combined = (await Promise.all(Object.values(result.files).map((file) => readFile(file, "utf8")))).join("\n");
    assert.doesNotMatch(combined, /recoveryCode|localSecret|newRecoveryCode|publishToken|shareToken|signature/i);
    assert.doesNotMatch(combined, /Bearer\s+|sk-[A-Za-z0-9_-]{12,}|-----BEGIN .*PRIVATE KEY-----/u);
    assert.doesNotMatch(combined, /\bundefined\b/u);
  } finally {
    await removeEvidenceSet(outputPath);
  }
});
