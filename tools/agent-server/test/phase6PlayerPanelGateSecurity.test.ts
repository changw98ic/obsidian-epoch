import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const gatePath = resolve(repoRoot, "tools/agent-server/phase6-player-panel-gate.ts");

test("Phase 6 player panel gate accumulates every repeated receipt input", () => {
  withTempDir((root) => {
    const beforePath = join(root, "before.jsonl");
    const afterPath = join(root, "after.jsonl");
    const badReceiptPath = join(root, "bad-receipts.jsonl");
    const goodReceiptPath = join(root, "good-receipts.jsonl");
    const beforeRecords = [];
    const afterRecords = [];
    const goodReceipts = [];
    const badReceipts = [];

    for (let runIndex = 1; runIndex <= 10; runIndex += 1) {
      const before = currentPanel(runIndex, false);
      const after = currentPanel(runIndex, true);
      const deltas = diffPanels(before, after);
      beforeRecords.push({ runId: `journey-${runIndex}`, playerPanel: before, groups: { primary: true, secondary: true } });
      afterRecords.push({ runId: `journey-${runIndex}`, playerPanel: after, groups: { primary: true, secondary: true } });
      const receipt = {
        runId: `journey-${runIndex}`,
        receiptId: `receipt-${runIndex}`,
        version: "journey_run_receipt.v2",
        snapshots: {
          before: { body: before, hash: canonicalHash(before) },
          after: { body: after, hash: canonicalHash(after) },
        },
        deltas,
        integrity: { deltasHash: canonicalHash(deltas) },
      };
      if (runIndex === 1) {
        badReceipts.push({
          ...receipt,
          snapshots: {
            ...receipt.snapshots,
            before: { ...receipt.snapshots.before, hash: "sha256:0000000000000000" },
          },
        });
      }
      else goodReceipts.push(receipt);
    }

    writeFileSync(beforePath, jsonl(beforeRecords), "utf8");
    writeFileSync(afterPath, jsonl(afterRecords), "utf8");
    writeFileSync(badReceiptPath, jsonl(badReceipts), "utf8");
    writeFileSync(goodReceiptPath, jsonl(goodReceipts), "utf8");

    const result = spawnSync(process.execPath, [
      gatePath,
      "--before", repoPath(beforePath),
      "--after", repoPath(afterPath),
      "--receipt", repoPath(badReceiptPath),
      "--receipt", repoPath(goodReceiptPath),
      "--expected-runs", "10",
    ], { cwd: repoRoot, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

    assert.equal(result.status, 1, result.stdout + result.stderr);
    const summary = JSON.parse(result.stdout);
    assert.equal(summary.metrics.receipts, 10);
    assert.ok(summary.errorCodes.includes("E_RECEIPT_BEFORE_HASH_MISMATCH"), JSON.stringify(summary, null, 2));
    assert.equal(result.stdout.includes("0000000000000000"), false);
  });
});

test("Phase 6 player panel gate rejects a receipt without explicit run identity", () => {
  withTempDir((root) => {
    const fixture = validGateFixture();
    delete fixture.receipts[0].runId;
    const result = runGateFixture(root, fixture);
    assert.equal(result.status, 1, result.stdout + result.stderr);
    const summary = JSON.parse(result.stdout);
    assert.ok(summary.errorCodes.includes("E_RECEIPT_RUN_ID_MISSING"), JSON.stringify(summary, null, 2));
    assert.ok(summary.errorCodes.includes("E_RECEIPT_MISSING"), JSON.stringify(summary, null, 2));
  });
});

test("Phase 6 player panel gate rejects an unmatched wrong-run receipt", () => {
  withTempDir((root) => {
    const fixture = validGateFixture();
    fixture.receipts[1].runId = "journey-99";
    const result = runGateFixture(root, fixture);
    assert.equal(result.status, 1, result.stdout + result.stderr);
    const summary = JSON.parse(result.stdout);
    assert.ok(summary.errorCodes.includes("E_RECEIPT_RUN_UNMATCHED"), JSON.stringify(summary, null, 2));
    assert.ok(summary.errorCodes.includes("E_RECEIPT_MISSING"), JSON.stringify(summary, null, 2));
  });
});

test("Phase 6 player panel gate rejects duplicate receipt run identity", () => {
  withTempDir((root) => {
    const fixture = validGateFixture();
    fixture.receipts[1].runId = "journey-1";
    const result = runGateFixture(root, fixture);
    assert.equal(result.status, 1, result.stdout + result.stderr);
    const summary = JSON.parse(result.stdout);
    assert.ok(summary.errorCodes.includes("E_RECEIPT_RUN_ID_DUPLICATE"), JSON.stringify(summary, null, 2));
    assert.ok(summary.errorCodes.includes("E_RECEIPT_MISSING"), JSON.stringify(summary, null, 2));
  });
});

test("Phase 6 player panel gate rejects a noncanonical receipt version", () => {
  withTempDir((root) => {
    const fixture = validGateFixture();
    fixture.receipts.forEach((receipt) => {
      receipt.version = "journey_run_receipt.invalid";
    });
    const result = runGateFixture(root, fixture);
    assert.equal(result.status, 1, result.stdout + result.stderr);
    const summary = JSON.parse(result.stdout);
    assert.equal(summary.ok, false);
    assert.ok(summary.errorCodes.includes("E_RECEIPT_VERSION_UNSUPPORTED"));
  });
});

test("Phase 6 player panel gate accepts authoritative V2 dimensions without panelDiffHash", () => {
  withTempDir((root) => {
    const fixture = validV2GateFixture();
    const result = runGateFixture(root, fixture, 1);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    const summary = JSON.parse(result.stdout);
    assert.equal(summary.ok, true);
    assert.equal(summary.errorCodes.includes("E_RECEIPT_DIFF_HASH_MISMATCH"), false);
  });
});

test("Phase 6 player panel gate pairs a receipt by journey when run and journey identifiers differ", () => {
  withTempDir((root) => {
    const fixture = validV2GateFixture();
    const journeyId = "journey-v2-1";
    fixture.beforeRecords[0] = {
      journeyId,
      playerPanel: fixture.beforeRecords[0].playerPanel,
      groups: fixture.beforeRecords[0].groups,
    };
    fixture.afterRecords[0] = {
      journeyId,
      playerPanel: fixture.afterRecords[0].playerPanel,
      groups: fixture.afterRecords[0].groups,
    };
    fixture.receipts[0].journeyId = journeyId;
    fixture.receipts[0].runId = "phase6-run-opaque-1";

    const result = runGateFixture(root, fixture, 1);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.equal(JSON.parse(result.stdout).ok, true);
  });
});

test("Phase 6 player panel gate validates V2 snapshot and deltas hashes", () => {
  withTempDir((root) => {
    const beforeTamper = validV2GateFixture();
    beforeTamper.receipts[0].snapshots.before.hash = canonicalHash({ tampered: true });
    const beforeResult = runGateFixture(root, beforeTamper, 1);
    assert.equal(beforeResult.status, 1, beforeResult.stdout + beforeResult.stderr);
    assert.ok(JSON.parse(beforeResult.stdout).errorCodes.includes("E_RECEIPT_BEFORE_HASH_MISMATCH"));

    const deltasTamper = validV2GateFixture();
    deltasTamper.receipts[0].integrity.deltasHash = canonicalHash({ tampered: true });
    const deltasResult = runGateFixture(root, deltasTamper, 1);
    assert.equal(deltasResult.status, 1, deltasResult.stdout + deltasResult.stderr);
    assert.ok(JSON.parse(deltasResult.stdout).errorCodes.includes("E_RECEIPT_DELTAS_HASH_MISMATCH"));
  });
});

test("Phase 6 player panel gate fails closed for unknown receipt versions and unstable V2 dimensions", () => {
  withTempDir((root) => {
    const unknownVersion = validV2GateFixture();
    unknownVersion.receipts[0].version = "journey_run_receipt.v3";
    const versionResult = runGateFixture(root, unknownVersion, 1);
    assert.equal(versionResult.status, 1, versionResult.stdout + versionResult.stderr);
    assert.ok(JSON.parse(versionResult.stdout).errorCodes.includes("E_RECEIPT_VERSION_UNSUPPORTED"));

    const missingDimension = validV2GateFixture();
    delete missingDimension.beforeRecords[0].playerPanel.attributes.spirituality;
    missingDimension.receipts[0].snapshots.before.body = missingDimension.beforeRecords[0].playerPanel;
    missingDimension.receipts[0].snapshots.before.hash = canonicalHash(missingDimension.receipts[0].snapshots.before.body);
    const shapeResult = runGateFixture(root, missingDimension, 1);
    assert.equal(shapeResult.status, 1, shapeResult.stdout + shapeResult.stderr);
    const shapeSummary = JSON.parse(shapeResult.stdout);
    assert.ok(shapeSummary.errorCodes.includes("E_CURRENT_ATTRIBUTE_SHAPE"), JSON.stringify(shapeSummary, null, 2));
    assert.ok(shapeSummary.errorCodes.includes("E_DOMAIN_MISSING"), JSON.stringify(shapeSummary, null, 2));
  });
});

function withTempDir(fn) {
  const root = mkdtempSync(join(repoRoot, ".phase6-player-panel-gate-"));
  try {
    chmodSync(root, 0o700);
    fn(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function validGateFixture() {
  const beforeRecords = [];
  const afterRecords = [];
  const receipts = [];
  for (let runIndex = 1; runIndex <= 10; runIndex += 1) {
    const before = panel(runIndex, false);
    const after = panel(runIndex, true);
    beforeRecords.push({ runId: `journey-${runIndex}`, playerPanel: before, groups: { primary: true, secondary: true } });
    afterRecords.push({ runId: `journey-${runIndex}`, playerPanel: after, groups: { primary: true, secondary: true } });
    receipts.push({
      runId: `journey-${runIndex}`,
      receiptId: `receipt-${runIndex}`,
      version: "journey_run_receipt.v2",
      beforePanelHash: canonicalHash(before),
      afterPanelHash: canonicalHash(after),
      panelDiffHash: canonicalHash(diffPanels(before, after)),
    });
  }
  return { beforeRecords, afterRecords, receipts };
}

function runGateFixture(root, fixture, expectedRuns = 10) {
  const beforePath = join(root, "before.jsonl");
  const afterPath = join(root, "after.jsonl");
  const receiptPath = join(root, "receipts.jsonl");
  writeFileSync(beforePath, jsonl(fixture.beforeRecords), "utf8");
  writeFileSync(afterPath, jsonl(fixture.afterRecords), "utf8");
  writeFileSync(receiptPath, jsonl(fixture.receipts), "utf8");
  return spawnSync(process.execPath, [
    gatePath,
    "--before", repoPath(beforePath),
    "--after", repoPath(afterPath),
    "--receipt", repoPath(receiptPath),
    "--expected-runs", String(expectedRuns),
  ], { cwd: repoRoot, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
}

function repoPath(absolute) {
  return relative(repoRoot, absolute).split(/[\\/]/).join("/");
}

function panel(runIndex, after) {
  const suffix = after ? "after" : "before";
  const shift = after ? 1 : 0;
  return {
    identity: { id: `identity-${runIndex}-${suffix}` },
    attributes: {
      physique: 10 + runIndex + shift,
      agility: 11 + runIndex + shift,
      perception: 12 + runIndex + shift,
      intellect: 13 + runIndex + shift,
      willpower: 14 + runIndex + shift,
      luck: 15 + runIndex + shift,
    },
    readiness: {
      combat: runIndex + shift,
      survival: runIndex + 1 + shift,
      exploration: runIndex + 2 + shift,
      social: runIndex + 3 + shift,
      stealth: runIndex + 4 + shift,
      crafting: runIndex + 5 + shift,
      cultivation: runIndex + 6 + shift,
      resource: runIndex + 7 + shift,
      injury: runIndex + 8 + shift,
      world: runIndex + 9 + shift,
    },
    skills: [`skill-${runIndex}-${suffix}`],
    talents: [`talent-${runIndex}-${suffix}`],
    methods: [`method-${runIndex}-${suffix}`],
    cultivation: { realm: `realm-${suffix}` },
    injuries: [{ id: `injury-${suffix}` }],
    warehouse: { slots: 10 + shift },
    currency: { coin: 1000 + runIndex + shift },
    materials: { ore: 5 + runIndex + shift },
    equipment: { weapon: `blade-${suffix}` },
    carrySlots: { used: 1 + shift },
    insurance: { covered: after },
    production: { queue: [`job-${runIndex}-${suffix}`] },
    rag: { memories: [`memory-${runIndex}-${suffix}`] },
    worldCursor: { sequence: runIndex * 10 + shift },
  };
}

function validV2GateFixture() {
  const before = currentPanel(1, false);
  const after = currentPanel(1, true);
  const deltas = {
    attributes: [{ key: "strength", before: before.attributes.strength, after: after.attributes.strength }],
    worldCursor: { before: before.worldCursor.sequence, after: after.worldCursor.sequence },
  };
  return {
    beforeRecords: [{ runId: "journey-v2-1", playerPanel: before, groups: { primary: true, secondary: true } }],
    afterRecords: [{ runId: "journey-v2-1", playerPanel: after, groups: { primary: true, secondary: true } }],
    receipts: [{
      version: "journey_run_receipt.v2",
      runId: "journey-v2-1",
      receiptId: "receipt-v2-1",
      snapshots: {
        before: { body: before, hash: canonicalHash(before) },
        after: { body: after, hash: canonicalHash(after) },
      },
      deltas,
      integrity: { deltasHash: canonicalHash(deltas) },
    }],
  };
}

function currentPanel(runIndex, after) {
  const suffix = after ? "after" : "before";
  const shift = after ? 1 : 0;
  return {
    identity: { id: `identity-${runIndex}-${suffix}` },
    attributes: {
      strength: 10 + runIndex + shift,
      agility: 11 + runIndex + shift,
      physique: 12 + runIndex + shift,
      intellect: 13 + runIndex + shift,
      willpower: 14 + runIndex + shift,
      spirituality: 15 + runIndex + shift,
    },
    readiness: {
      adaptation: runIndex + shift,
      control: runIndex + 1 + shift,
      corruptionResistance: runIndex + 2 + shift,
      mobility: runIndex + 3 + shift,
      offense: runIndex + 4 + shift,
      perception: runIndex + 5 + shift,
      protection: runIndex + 6 + shift,
      reserve: runIndex + 7 + shift,
      sustain: runIndex + 8 + shift,
      synergy: runIndex + 9 + shift,
    },
    skills: [`skill-${runIndex}-${suffix}`],
    talents: [`talent-${runIndex}-${suffix}`],
    methods: [`method-${runIndex}-${suffix}`],
    cultivation: { realm: `realm-${suffix}` },
    injuries: [{ id: `injury-${suffix}` }],
    warehouse: { slots: 10 + shift },
    currency: { coin: 1000 + runIndex + shift },
    materials: { ore: 5 + runIndex + shift },
    equipment: { weapon: `blade-${suffix}` },
    carrySlots: { used: 1 + shift },
    insurance: { covered: after },
    production: { queue: [`job-${runIndex}-${suffix}`] },
    rag: { memories: [`memory-${runIndex}-${suffix}`] },
    worldCursor: { sequence: runIndex * 10 + shift },
  };
}

function jsonl(records) {
  return `${records.map((record) => JSON.stringify(record)).join("\n")}\n`;
}

function canonicalHash(value) {
  return `sha256:${crypto.createHash("sha256").update(canonicalize(value), "utf8").digest("hex")}`;
}

function canonicalize(value) {
  if (value === undefined || value === null) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(",")}}`;
}

function diffPanels(beforePanel, afterPanel) {
  const changes = [];
  collectDiff(beforePanel, afterPanel, [], changes);
  return changes;
}

function collectDiff(beforeValue, afterValue, pathSegments, changes) {
  const beforeHash = canonicalHash(beforeValue);
  const afterHash = canonicalHash(afterValue);
  if (beforeHash === afterHash) return;
  if (beforeValue && afterValue && typeof beforeValue === "object" && typeof afterValue === "object" && Array.isArray(beforeValue) === Array.isArray(afterValue)) {
    const keys = Array.isArray(beforeValue)
      ? [...Array(Math.max(beforeValue.length, afterValue.length)).keys()].map(String)
      : [...new Set([...Object.keys(beforeValue), ...Object.keys(afterValue)])].sort();
    keys.forEach((key) => collectDiff(beforeValue[key], afterValue[key], [...pathSegments, key], changes));
    return;
  }
  changes.push({
    pathHash: `sha256:${crypto.createHash("sha256").update(pathSegments.join(".")).digest("hex")}`.slice(0, 19),
    beforeHash,
    afterHash,
  });
}
