import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import crypto from "node:crypto";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { once } from "node:events";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { phase6AuthoritativeRagTrace } from "./phase6RagTestFixtures.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const evidencePath = resolve(repoRoot, "tools/agent-server/phase6-ten-run-evidence.mjs");
const scenarioProtocol = [
  ["low-prepared-resource", "resource_acquisition"],
  ["low-underprepared-information", "information_acquisition"],
  ["medium-prepared-tactical", "tactical_objective"],
  ["medium-borderline-escort", "escort_and_protection"],
  ["medium-mismatched-preserve", "resource_preservation"],
  ["high-prepared-high-value", "high_value_objective"],
  ["high-underprepared-evacuation", "survival_evacuation"],
  ["medium-prepared-cultivation", "cultivation_material"],
  ["medium-specialist-crafting", "crafting_material"],
  ["dynamic-mixed-repeat", "repeated_route_audit"],
];

test("Phase 6 ten-run evidence derives golden gate inputs from sanitized tool outputs", () => {
  withTempRepoDir((root) => {
    const input = join(root, "sanitized.jsonl");
    const outputDir = join(root, "out");
    const records = goldenSanitizedRecords();
    const sqlite = createSqliteFixture(root, records);
    writeFileSync(input, jsonl(records), "utf8");

    const result = runEvidence(input, outputDir, sqlite);
    assert.equal(result.status, 0, result.stdout + result.stderr);

    const manifest = JSON.parse(readFileSync(join(outputDir, "manifest.json"), "utf8"));
    assert.equal(manifest.ok, true, JSON.stringify(manifest.errors, null, 2));
    assert.equal(manifest.artifacts["panels-before.jsonl"].records, 10);
    assert.equal(manifest.artifacts["panels-after.jsonl"].records, 10);
    assert.equal(manifest.artifacts["receipts.jsonl"].records, 10);
    assert.equal(manifest.artifacts["economy-audit.jsonl"].records, 10);
    assert.equal(manifest.artifacts["scores.jsonl"].records, 10);
    assert.equal(manifest.input.sqlite.bytes > 0, true);
    assert.match(manifest.input.sqlite.sha256, /^sha256:[0-9a-f]{64}$/);
    assert.equal(manifest.releaseGateInputs.playerPanel, true);
    assert.equal(manifest.releaseGateInputs.economy, true);
    assert.equal(manifest.releaseGateInputs.world, true);
    assert.equal(manifest.releaseGateInputs.progression, true);
    assert.equal(manifest.releaseGateInputs.score, true);
    assert.equal(manifest.releaseGateInputs.rag, true);
    assert.equal(manifest.releaseGateInputs.shop, true);
    assert.equal(manifest.releaseGateInputs.crafting, true);

    for (const file of ["manifest.json", "panels-before.jsonl", "receipts.jsonl", "scores.jsonl"]) {
      assert.equal((statSync(join(outputDir, file)).mode & 0o777), 0o600, file);
    }

    assertGatePass("phase6-player-panel-gate.mjs", [
      "--before", repoPath(join(outputDir, "panels-before.jsonl")),
      "--after", repoPath(join(outputDir, "panels-after.jsonl")),
      "--receipt", repoPath(join(outputDir, "receipts.jsonl")),
      "--expected-runs", "10",
    ]);
    assertGatePass("phase6-economy-gate.mjs", ["--expected-runs", "10", "--input", repoPath(join(outputDir, "economy-audit.jsonl"))]);
    assertGatePass("phase6-progression-gate.mjs", ["--input", repoPath(join(outputDir, "progression.jsonl"))]);
    assert.match(readFileSync(join(outputDir, "receipts.jsonl"), "utf8").split("\n")[0], /ragDelta/);
    assertGatePass("phase6-rag-gate.mjs", [
      "--query-evaluations", repoPath(join(outputDir, "rag-query-evaluations.jsonl")),
      "--run-receipts", repoPath(join(outputDir, "receipts.jsonl")),
    ]);
    assertGatePass("phase6-world-gate.mjs", ["--input", repoPath(join(outputDir, "world-evidence.jsonl"))]);
    assertGatePass("phase6-score-gate.mjs", ["--expected-runs", "10", repoPath(join(outputDir, "scores.jsonl"))]);
    assertGatePass("phase6-shop-gate.mjs", ["--input", repoPath(join(outputDir, "shop.jsonl"))]);
    assertGatePass("phase6-crafting-gate.mjs", [
      "--recipes", repoPath(join(outputDir, "crafting-recipes.jsonl")),
      "--crafts", repoPath(join(outputDir, "crafting-crafts.jsonl")),
      "--progression", repoPath(join(outputDir, "crafting-progression.jsonl")),
    ]);
  });
});

test("Phase 6 ten-run evidence rejects cross-experiment pollution", () => {
  withTempRepoDir((root) => {
    const records = goldenSanitizedRecords();
    records[3].metadata.experimentId = "other-exp";
    records[3].output.experimentId = "other-exp";
    const result = runFixture(root, records);
    assert.equal(result.status, 1);
    assertManifestCode(root, "E_EXPERIMENT_BINDING");
  });
});

test("Phase 6 ten-run evidence requires release-grade SQLite authority", () => {
  withTempRepoDir((root) => {
    const input = join(root, "sanitized.jsonl");
    const outputDir = join(root, "out");
    writeFileSync(input, jsonl(goldenSanitizedRecords()), "utf8");
    const result = runEvidence(input, outputDir);
    assert.equal(result.status, 1);
    assert.match(result.stdout, /E_ARGUMENT_REQUIRED/);
  });
});

test("Phase 6 ten-run evidence reports receipt and panel hash mismatch", () => {
  withTempRepoDir((root) => {
    const records = goldenSanitizedRecords();
    records.find((record) => record.toolName === "obsidian_epoch.phase6_result" && record.metadata.runIndex === 1).output.runReceipt.beforePanelHash = "sha256:bad";
    const result = runFixture(root, records);
    assert.equal(result.status, 1);
    assertManifestCode(root, "E_RECEIPT_BEFORE_HASH_MISMATCH");
  });
});

test("Phase 6 ten-run evidence rejects mismatched SQLite receipt content", () => {
  withTempRepoDir((root) => {
    const records = goldenSanitizedRecords();
    const sqlite = createSqliteFixture(root, records, {
      mutateReceipt: (receipt) => receipt.receiptId === "receipt-4" ? { ...receipt, seed: "wrong-seed" } : receipt,
    });
    const result = runFixture(root, records, sqlite);
    assert.equal(result.status, 1);
    assertManifestCode(root, "E_SQLITE_RECEIPT_CONTENT_MISMATCH");
  });
});

test("Phase 6 ten-run evidence rejects missing SQLite receipt", () => {
  withTempRepoDir((root) => {
    const records = goldenSanitizedRecords();
    const sqlite = createSqliteFixture(root, records, { omitReceiptId: "receipt-5" });
    const result = runFixture(root, records, sqlite);
    assert.equal(result.status, 1);
    assertManifestCode(root, "E_SQLITE_RECEIPT_MISSING");
  });
});

test("Phase 6 ten-run evidence rejects truncated receipt hashes", () => {
  withTempRepoDir((root) => {
    const records = goldenSanitizedRecords();
    const target = records.find((record) => record.toolName === "obsidian_epoch.phase6_result" && record.metadata.runIndex === 2).output.runReceipt;
    target.beforePanelHash = target.beforePanelHash.slice(0, 16);
    const result = runFixture(root, records);
    assert.equal(result.status, 1);
    assertManifestCode(root, "E_RECEIPT_BEFORE_HASH_MISMATCH");
  });
});

test("Phase 6 ten-run evidence rejects duplicate receipt run identity before collapse", () => {
  withTempRepoDir((root) => {
    const records = goldenSanitizedRecords();
    const sqlite = createSqliteFixture(root, records);
    const duplicate = structuredClone(records.find((record) => record.toolName === "obsidian_epoch.phase6_result" && record.metadata.runIndex === 3));
    records.push(duplicate);
    const result = runFixture(root, records, sqlite);
    assert.equal(result.status, 1);
    assertManifestCode(root, "E_RECEIPT_RUN_DUPLICATE");
    assertManifestCode(root, "E_RECEIPT_ID_DUPLICATE");
  });
});

test("Phase 6 ten-run evidence rejects conflicting duplicate receipt content before collapse", () => {
  withTempRepoDir((root) => {
    const records = goldenSanitizedRecords();
    const sqlite = createSqliteFixture(root, records);
    const conflict = structuredClone(records.find((record) => record.toolName === "obsidian_epoch.phase6_result" && record.metadata.runIndex === 4));
    conflict.output.runReceipt.seed = "conflicting-seed";
    records.push(conflict);
    const result = runFixture(root, records, sqlite);
    assert.equal(result.status, 1);
    assertManifestCode(root, "E_RECEIPT_CONTENT_CONFLICT");
  });
});

test("Phase 6 ten-run evidence rejects non-complete authoritative runs", () => {
  withTempRepoDir((root) => {
    const records = goldenSanitizedRecords();
    const sqlite = createSqliteFixture(root, records, {
      runState: (receipt) => receipt.runIndex === 6 ? "running" : "complete",
    });
    const result = runFixture(root, records, sqlite);
    assert.equal(result.status, 1);
    assertManifestCode(root, "E_SQLITE_RUN_INCOMPLETE");
  });
});

test("Phase 6 ten-run evidence binds receipt V2 rules/catalog/code versions to SQLite", () => {
  withTempRepoDir((root) => {
    const records = goldenSanitizedRecords();
    const sqlite = createSqliteFixture(root, records, {
      codeVersion: (receipt) => receipt.runIndex === 7 ? "code-other" : receipt.codeVersion,
    });
    const result = runFixture(root, records, sqlite);
    assert.equal(result.status, 1);
    assertManifestCode(root, "E_SQLITE_CODE_VERSION_MISMATCH");
  });
});

test("Phase 6 ten-run evidence rejects non-V2 and inconsistent receipt versions", () => {
  withTempRepoDir((root) => {
    const records = goldenSanitizedRecords();
    const target = records.find((record) => record.toolName === "obsidian_epoch.phase6_result" && record.metadata.runIndex === 8).output.runReceipt;
    target.version = "journey_run_receipt.v1";
    target.codeVersion = "code-other";
    const sqlite = createSqliteFixture(root, records);
    const result = runFixture(root, records, sqlite);
    assert.equal(result.status, 1);
    assertManifestCode(root, "E_RECEIPT_V2_REQUIRED");
    assertManifestCode(root, "E_RECEIPT_VERSION_INCONSISTENT");
  });
});

test("Phase 6 ten-run evidence snapshots committed WAL content and hashes that snapshot", async () => {
  await withTempRepoDirAsync(async (root) => {
    const records = goldenSanitizedRecords();
    const sqlite = createSqliteFixture(root, records);
    const writer = await startWalWriter(sqlite, [
      "BEGIN IMMEDIATE;",
      "UPDATE phase6_experiment_runs SET updated_at = '2026-02-02T00:00:00.000Z' WHERE run_index = 1;",
      "COMMIT;",
    ]);
    try {
      assert.equal(existsSync(`${sqlite}-wal`), true);
      const mainFileHash = fileHash(sqlite);
      const result = runFixture(root, records, sqlite);
      assert.equal(result.status, 0, result.stdout + result.stderr);
      const manifest = JSON.parse(readFileSync(join(root, "out", "manifest.json"), "utf8"));
      assert.notEqual(manifest.input.sqlite.sha256, mainFileHash);
      assert.match(manifest.input.sqlite.sha256, /^sha256:[0-9a-f]{64}$/);
    } finally {
      await stopSqliteWriter(writer);
    }
  });
});

test("Phase 6 ten-run evidence keeps query and manifest bound after source database swap", () => {
  withTempRepoDir((root) => {
    const records = goldenSanitizedRecords();
    const sqlite = createSqliteFixture(root, records);
    const replacement = join(root, "replacement.sqlite");
    const replacementResult = spawnSync("sqlite3", [replacement, "CREATE TABLE unrelated (id TEXT);"] , { encoding: "utf8" });
    assert.equal(replacementResult.status, 0, replacementResult.stderr);
    const replacementHash = fileHash(replacement);
    const which = spawnSync("which", ["sqlite3"], { encoding: "utf8" });
    assert.equal(which.status, 0, which.stderr);
    const binDir = join(root, "bin");
    const wrapper = join(binDir, "sqlite3");
    mkdirSync(binDir);
    writeFileSync(wrapper, sqliteSwapWrapper(), { encoding: "utf8", mode: 0o700 });
    chmodSync(wrapper, 0o700);
    const input = join(root, "sanitized.jsonl");
    const outputDir = join(root, "out");
    writeFileSync(input, jsonl(records), "utf8");
    const result = runEvidence(input, outputDir, sqlite, {
      ...process.env,
      PATH: `${binDir}:${process.env.PATH || ""}`,
      PHASE6_REAL_SQLITE3: which.stdout.trim(),
      PHASE6_SWAP_SQLITE: replacement,
    });
    assert.equal(result.status, 0, result.stdout + result.stderr);
    const manifest = JSON.parse(readFileSync(join(outputDir, "manifest.json"), "utf8"));
    assert.notEqual(manifest.input.sqlite.sha256, replacementHash);
    assert.equal(existsSync(replacement), false);
  });
});

test("Phase 6 ten-run evidence fails closed when required evidence is missing", () => {
  withTempRepoDir((root) => {
    const records = goldenSanitizedRecords().filter((record) => record.toolName !== "obsidian_epoch.rag_evaluation");
    const result = runFixture(root, records);
    assert.equal(result.status, 1);
    assertManifestCode(root, "E_MISSING_REQUIRED_EVIDENCE");
  });
});

test("Phase 6 ten-run evidence refuses secret-bearing sanitized input", () => {
  withTempRepoDir((root) => {
    const records = goldenSanitizedRecords();
    records[0].output.authorization = "Bearer SECRET_MATERIAL_123456";
    const result = runFixture(root, records);
    assert.equal(result.status, 1);
    assertManifestCode(root, "E_SECRET_INPUT");
    assert.equal(readFileSync(join(root, "out", "manifest.json"), "utf8").includes("SECRET_MATERIAL"), false);
  });
});

test("Phase 6 ten-run evidence refuses to overwrite a non-empty output directory", () => {
  withTempRepoDir((root) => {
    const input = join(root, "sanitized.jsonl");
    const outputDir = join(root, "out");
    const records = goldenSanitizedRecords();
    const sqlite = createSqliteFixture(root, records);
    writeFileSync(input, jsonl(records), "utf8");
    mkdirSync(outputDir);
    writeFileSync(join(outputDir, "existing.txt"), "occupied", "utf8");
    const result = runEvidence(input, outputDir, sqlite);
    assert.equal(result.status, 1);
    assert.match(result.stdout, /E_OUTPUT_NOT_EMPTY/);
  });
});

function runFixture(root, records, sqlite = undefined) {
  const input = join(root, "sanitized.jsonl");
  const outputDir = join(root, "out");
  sqlite ??= createSqliteFixture(root, records);
  writeFileSync(input, jsonl(records), "utf8");
  return runEvidence(input, outputDir, sqlite);
}

function runEvidence(input, outputDir, sqlite, env = process.env) {
  const args = [
    evidencePath,
    "--input", repoPath(input),
    "--output-dir", repoPath(outputDir),
    "--expected-runs", "10",
  ];
  if (sqlite) args.push("--sqlite", repoPath(sqlite));
  return spawnSync(process.execPath, args, { cwd: repoRoot, encoding: "utf8", env, maxBuffer: 64 * 1024 * 1024 });
}

function assertGatePass(script, args) {
  const result = spawnSync(process.execPath, [resolve(repoRoot, "tools/agent-server", script), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  assert.equal(result.status, 0, `${script}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
}

function assertManifestCode(root, code) {
  const manifest = JSON.parse(readFileSync(join(root, "out", "manifest.json"), "utf8"));
  assert.ok(manifest.errorCodes.includes(code), JSON.stringify(manifest, null, 2));
}

function withTempRepoDir(fn) {
  const root = mkdtempSync(join(repoRoot, ".phase6-ten-run-evidence-test-"));
  try {
    chmodSync(root, 0o700);
    fn(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

async function withTempRepoDirAsync(fn) {
  const root = mkdtempSync(join(repoRoot, ".phase6-ten-run-evidence-test-"));
  try {
    chmodSync(root, 0o700);
    await fn(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function repoPath(absolute) {
  return relative(repoRoot, absolute).split(/[\\/]/).join("/");
}

function createSqliteFixture(root, records, options = {}) {
  const sqlite = join(root, "authority.sqlite");
  const receipts = records
    .filter((record) => record.toolName === "obsidian_epoch.phase6_result")
    .map((record) => record.output.runReceipt);
  const statements = [
    "CREATE TABLE phase6_experiment_runs (experiment_id TEXT NOT NULL, run_index INTEGER NOT NULL CHECK (run_index BETWEEN 1 AND 10), state TEXT NOT NULL CHECK (state IN ('planned', 'running', 'failed', 'complete')), identity_id TEXT NOT NULL, cohort_id TEXT, explorer_id TEXT NOT NULL, explorer_display_name TEXT, scenario_matrix_id TEXT NOT NULL, scenario_matrix_version TEXT NOT NULL, rules_version TEXT NOT NULL, catalog_version TEXT NOT NULL, code_version TEXT NOT NULL, seed TEXT NOT NULL, journey_id TEXT NOT NULL, run_receipt_id TEXT NOT NULL, run_receipt_version TEXT, result_receipt_id TEXT, result_receipt_version TEXT, failure_reason TEXT, failure_receipt_id TEXT, failure_receipt_version TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY (experiment_id, run_index));",
    "CREATE TABLE journey_run_receipts (receipt_id TEXT PRIMARY KEY, journey_id TEXT NOT NULL, payload_hash TEXT NOT NULL, receipt_json TEXT NOT NULL, created_at TEXT NOT NULL);",
    "CREATE TABLE journey_events (event_id TEXT PRIMARY KEY, journey_id TEXT NOT NULL, event_type TEXT NOT NULL, agent_id TEXT NOT NULL, explorer_id TEXT NOT NULL, occurred_at TEXT NOT NULL, journey_version INTEGER, record_id INTEGER NOT NULL, event_json TEXT NOT NULL);",
    "CREATE TABLE result_pages (page_id TEXT PRIMARY KEY, page_json TEXT NOT NULL, created_at TEXT NOT NULL);",
  ];
  for (const receipt of receipts) {
    const runState = options.runState ? options.runState(receipt) : "complete";
    const rulesVersion = options.rulesVersion ? options.rulesVersion(receipt) : receipt.rulesetVersion;
    const catalogVersion = options.catalogVersion ? options.catalogVersion(receipt) : receipt.catalogVersion;
    const codeVersion = options.codeVersion ? options.codeVersion(receipt) : receipt.codeVersion;
    const receiptVersion = options.receiptVersion ? options.receiptVersion(receipt) : receipt.version;
    statements.push([
      "INSERT INTO phase6_experiment_runs (experiment_id, run_index, state, identity_id, explorer_id, scenario_matrix_id, scenario_matrix_version, rules_version, catalog_version, code_version, seed, journey_id, run_receipt_id, run_receipt_version, created_at, updated_at) VALUES (",
      [receipt.experimentId, receipt.runIndex, runState, `identity-${receipt.runIndex}`, "explorer-1", "matrix-1", "matrix-v1", rulesVersion, catalogVersion, codeVersion, receipt.seed, receipt.runId, receipt.receiptId, receiptVersion, "2026-01-01T00:00:00.000Z", "2026-01-01T00:00:00.000Z"].map(sql).join(","),
      ");",
    ].join(""));
    if (receipt.receiptId !== options.omitReceiptId) {
      const sqliteReceipt = options.mutateReceipt ? options.mutateReceipt(receipt) : receipt;
      statements.push([
        "INSERT INTO journey_run_receipts (receipt_id, journey_id, payload_hash, receipt_json, created_at) VALUES (",
        [receipt.receiptId, receipt.runId, canonicalHash(sqliteReceipt), JSON.stringify(sqliteReceipt), "2026-01-01T00:00:00.000Z"].map(sql).join(","),
        ");",
      ].join(""));
    }
    statements.push([
      "INSERT INTO result_pages (page_id, page_json, created_at) VALUES (",
      [`page-${receipt.runIndex}`, JSON.stringify(resultPage(receipt)), "2026-01-01T00:00:00.000Z"].map(sql).join(","),
      ");",
    ].join(""));
    for (const eventId of [...receipt.eventIds, ...receipt.worldDelta.eventIds]) {
      const eventJson = eventId === `event-${receipt.runIndex}-world`
        ? worldReplay(receipt.runIndex)
        : { eventId, journeyId: receipt.runId, eventType: "phase6_receipt_event" };
      statements.push([
        "INSERT INTO journey_events (event_id, journey_id, event_type, agent_id, explorer_id, occurred_at, journey_version, record_id, event_json) VALUES (",
        [eventId, receipt.runId, eventJson.eventType, "agent-1", "explorer-1", "2026-01-01T00:00:00.000Z", 1, receipt.runIndex, JSON.stringify(eventJson)].map(sql).join(","),
        ");",
      ].join(""));
    }
  }
  const result = spawnSync("sqlite3", [sqlite], { input: statements.join("\n"), cwd: repoRoot, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  assert.equal(result.status, 0, result.stderr);
  return sqlite;
}

function sql(value) {
  if (value === undefined || value === null) return "NULL";
  if (typeof value === "number") return String(value);
  return `'${String(value).replaceAll("'", "''")}'`;
}

async function startWalWriter(sqlite, statements) {
  const child = spawn("sqlite3", [sqlite], { cwd: repoRoot, stdio: ["pipe", "pipe", "pipe"] });
  let stdout = "";
  let stderr = "";
  const ready = new Promise((resolveReady, rejectReady) => {
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
      if (stdout.includes("PHASE6_WAL_READY")) resolveReady();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });
    child.once("error", rejectReady);
    child.once("exit", (code) => {
      if (!stdout.includes("PHASE6_WAL_READY")) rejectReady(new Error(`sqlite WAL writer exited ${code}: ${stderr}`));
    });
  });
  child.stdin.write([".bail on", "PRAGMA journal_mode=WAL;", "PRAGMA wal_autocheckpoint=0;", ...statements, ".print PHASE6_WAL_READY", ""].join("\n"));
  await ready;
  return child;
}

async function stopSqliteWriter(child) {
  if (child.exitCode !== null) return;
  child.stdin.end(".exit\n");
  await once(child, "exit");
}

function fileHash(file) {
  return `sha256:${crypto.createHash("sha256").update(readFileSync(file)).digest("hex")}`;
}

function sqliteSwapWrapper() {
  return [
    "#!/bin/sh",
    "\"$PHASE6_REAL_SQLITE3\" \"$@\"",
    "status=$?",
    "case \"${2-}\" in",
    "  .backup*) mv -f \"$PHASE6_SWAP_SQLITE\" \"$1\" ;;",
    "esac",
    "exit \"$status\"",
    "",
  ].join("\n");
}

function goldenSanitizedRecords() {
  const records = [];
  for (let runIndex = 1; runIndex <= 10; runIndex += 1) {
    const before = panel(runIndex, false);
    const after = panel(runIndex, true);
    const receipt = runReceipt(runIndex, before, after);
    const binding = {
      experimentId: "phase6-exp-evidence",
      runIndex,
      journeyId: `journey-${runIndex}`,
      receiptId: `receipt-${runIndex}`,
    };
    const [scenarioTag, taskType] = scenarioProtocol[runIndex - 1];
    records.push(
      toolRecord(runIndex, "obsidian_epoch.prepare_journey", { ...binding, taskType }, { taskType }),
      toolRecord(runIndex, "obsidian_epoch.begin_phase6_run", { ...binding, scenarioTag }, { scenarioTag }),
      toolRecord(runIndex, "obsidian_epoch.player_panel", { ...binding, playerPanel: before }, {}, { playerPanelBefore: true }),
      toolRecord(runIndex, "obsidian_epoch.phase6_result", {
        ...binding,
        runReceipt: receipt,
        worldReplay: worldReplay(runIndex),
        economyAudit: economyAudit(runIndex),
        progressionDelta: progressionDelta(runIndex),
        score: score(runIndex),
        shop: shopRecords(runIndex),
        crafting: craftingRecords(runIndex),
      }),
      toolRecord(runIndex, "obsidian_epoch.rag_evaluation", {
        ...binding,
        queryEvaluations: [
          ...["recent_key_fact_recall", "route_summary_precision"].map((type) => ({
            type,
            phase6RagTrace: phase6AuthoritativeRagTrace({
              runIndex,
              experimentId: binding.experimentId,
              runId: binding.journeyId,
              journeyId: binding.journeyId,
              recalledCount: 20,
            }),
          })),
        ],
      }),
      toolRecord(runIndex, "obsidian_epoch.player_panel", { ...binding, playerPanel: after }, {}, { playerPanelAfter: true }),
    );
  }
  return records;
}

function toolRecord(runIndex, toolName, output, input = {}, markers = {}) {
  return {
    schemaVersion: "phase6.cde_tool_record.v1",
    sequence: runIndex,
    toolName,
    ok: true,
    input: { experimentId: "phase6-exp-evidence", runIndex, ...input },
    output,
    metadata: { experimentId: "phase6-exp-evidence", runIndex },
    ...markers,
  };
}

function panel(runIndex, after) {
  const suffix = after ? "after" : "before";
  const sourceEventIds = [`event-${runIndex}-receipt`];
  const cultivationMaterial = {
    materialId: "phase6-cultivation-core",
    materialClass: "cultivation_advancement_material",
    quantity: 1,
    sourceEventIds,
    usageRefs: [{ system: "cultivation", stageId: "cultivation-stage-2" }],
  };
  const forgingMaterial = {
    materialId: "phase6-forging-ingot",
    materialClass: "forging_material",
    quantity: 1,
    sourceEventIds,
    usageRefs: [{ system: "forging", recipeId: "phase6-forging-recipe" }],
  };
  const postedMaterials = after
    ? [runIndex === 8 ? cultivationMaterial : undefined, runIndex === 9 ? forgingMaterial : undefined].filter(Boolean)
    : [];
  return {
    identity: { id: `identity-${runIndex}-${suffix}` },
    attributes: {
      strength: 10 + runIndex,
      agility: 11 + runIndex,
      physique: 12 + runIndex,
      intellect: 13 + runIndex,
      willpower: 14 + runIndex,
      spirituality: 15 + runIndex,
    },
    readiness: {
      adaptation: runIndex + (after ? 1 : 0),
      control: runIndex + 1 + (after ? 1 : 0),
      corruptionResistance: runIndex + 2 + (after ? 1 : 0),
      mobility: runIndex + 3 + (after ? 1 : 0),
      offense: runIndex + 4 + (after ? 1 : 0),
      perception: runIndex + 5 + (after ? 1 : 0),
      protection: runIndex + 6 + (after ? 1 : 0),
      reserve: runIndex + 7 + (after ? 1 : 0),
      sustain: runIndex + 8 + (after ? 1 : 0),
      synergy: runIndex + 9 + (after ? 1 : 0),
    },
    progression: {
      skills: { [`skill-${runIndex}`]: { rank: 1 } },
      talents: [`talent-${runIndex}`],
      methods: [`method-${runIndex}`],
      cultivation: {
        functionalStage: { stageId: "cultivation-stage-1", rank: 1 },
        resources: { materials: runIndex === 8 && after ? [cultivationMaterial] : [] },
      },
      injuries: [],
    },
    economy: {
      warehouse: { slots: 10 + (after ? 1 : 0), resources: postedMaterials },
      currencies: { coin: 1000 + runIndex + (after ? 1 : 0) },
      materials: runIndex === 9 && after ? [forgingMaterial] : [],
      equipment: { weapon: `blade-${suffix}` },
      carry: { used: 1 + (after ? 1 : 0) },
      insurance: { covered: after },
      production: { queue: [`job-${runIndex}-${suffix}`] },
    },
    ragPanel: { memories: [`memory-${runIndex}-${suffix}`] },
    worldCursor: { sequence: runIndex * 10 + (after ? 1 : 0) },
  };
}

function runReceipt(runIndex, before, after) {
  const deltas = [{ eventId: `event-${runIndex}-world`, kind: "world_delta" }];
  const beforeHash = canonicalHash(before);
  const afterHash = canonicalHash(after);
  const body = {
    version: "journey_run_receipt.v2",
    receiptType: "journey_run_receipt",
    receiptId: `receipt-${runIndex}`,
    runId: `journey-${runIndex}`,
    journeyId: `journey-${runIndex}`,
    experimentId: "phase6-exp-evidence",
    runIndex,
    seed: `seed-${runIndex}`,
    rulesetVersion: "rules-v1",
    catalogVersion: "catalog-v1",
    codeVersion: "code-v1",
    actions: [{ actionId: `action-${runIndex}` }],
    eventIds: [`event-${runIndex}-receipt`],
    noChangeReason: "server_canonical_domain_stable_by_receipt_hash",
    worldTime: runIndex * 100,
    world: {
      worldId: "world-1",
      regionId: `region-${runIndex}`,
      snapshotHash: `snapshot-${runIndex}`,
      worldTime: runIndex * 100,
      delta: { changed: true },
    },
    deltas,
    snapshots: {
      before: { body: before, hash: beforeHash },
      after: { body: after, hash: afterHash },
    },
    worldDelta: { eventIds: [`event-${runIndex}-world`], changed: true },
    suitability: { ok: true },
    rag: { importantMemoryCount: 1 },
    ragDelta: {
      importantMemoryCount: 1,
      duplicateRouteDedupRate: { dedupedRoutes: 2, duplicateRoutes: 2 },
      ordinaryNodePersistenceExpansion: 0,
      entries: [{
        type: "persistent_memory",
        memoryId: `memory-${runIndex}`,
        importance: "high",
        sourceEventIds: [`event-${runIndex}-receipt`],
      }],
    },
    importantMemoryCount: 1,
    dedupedRoutes: 2,
    duplicateRoutes: 2,
    ordinaryNodePersistenceExpansion: 0,
    beforePanelHash: beforeHash,
    afterPanelHash: afterHash,
    panelDiffHash: canonicalHash(diffPanels(before, after)),
    economyAudit: economyAudit(runIndex),
    score: score(runIndex),
  };
  return {
    ...body,
    integrity: {
      bodyHash: canonicalHash(body),
      deltasHash: canonicalHash(deltas),
      beforeSnapshotHash: beforeHash,
      afterSnapshotHash: afterHash,
    },
  };
}

function resultPage(receipt) {
  const eventIds = [`event-${receipt.runIndex}-receipt`];
  const scoreSummary = {
    contractVersion: receipt.score.contractVersion,
    authority: receipt.score.authority,
    weightedTotal: receipt.score.weightedTotal,
    decay: receipt.score.decay,
    total: receipt.score.total,
    formula: receipt.score.formula,
    context: receipt.score.context,
  };
  const scores = Object.entries(receipt.score.dimensions).map(([dimension, metric]) => ({
    dimension,
    score: metric.value,
    value: metric.value,
    weightBps: metric.weightBps,
    contribution: metric.contribution,
    reasonCode: metric.reasonCode,
    formula: metric.formula,
    inputs: metric.inputs,
    inputContributions: metric.inputContributions,
    basis: `${metric.reasonCode}: ${metric.formula}`,
    source: "server_authoritative",
    eventIds: metric.events,
  }));
  return {
    payload: {
      receipt: {
        phase6: {
          verified: true,
          ok: true,
          page: {
            deterministic: true,
            receipt: {
              receiptId: receipt.receiptId,
              canonicalEvents: [{ receiptId: receipt.receiptId, eventId: eventIds[0] }],
            },
            sections: {
              identityProgression: {
                progression: {
                  mode: "no_change",
                  changes: [],
                  noChangeReason: "canonical_progression_equal",
                  eventIds,
                },
              },
              settlement: {
                eventIds,
                economyConservation: {
                  conserved: true,
                  assets: receipt.economyAudit.assets,
                  auditFindingIds: [],
                },
              },
              scoreSummary,
              scores,
            },
          },
        },
      },
    },
  };
}

function worldReplay(runIndex) {
  return {
    eventType: "world_replay_event",
    runId: `journey-${runIndex}`,
    eventId: `event-${runIndex}-world`,
    worldTime: runIndex * 100,
    canonicalCursor: { sequence: runIndex, eventId: `event-${runIndex}-world`, regionId: `region-${runIndex}`, worldMinute: runIndex * 100 },
    worldDelta: { changed: true },
  };
}

function economyAudit(runIndex) {
  return {
    ok: true,
    receiptId: `receipt-${runIndex}`,
    assets: [{
      assetKey: "coin",
      unit: "minor",
      openingTotalMinor: "1000",
      systemMintMinor: "10",
      systemBurnMinor: "3",
      closingTotalMinor: "1007",
      unexplainedDeltaMinor: "0",
      conserved: true,
      reason: "phase6_reward_and_fee",
    }],
    feeSplits: [{ totalMinor: "3", unexplainedShareMinor: "0", balanced: true }],
    accountBalances: [{ mismatchMinor: "0" }],
    negativeInventories: [],
    duplicateSources: [],
    findings: [],
  };
}

function progressionDelta(runIndex) {
  return {
    requestId: `progression-${runIndex}`,
    source: `event-${runIndex}-receipt`,
    canonicalEventId: `event-${runIndex}-receipt`,
    cost: [{ asset: "coin", quantity: 1 }],
    attributeEvidence: [`evidence-${runIndex}`],
    cap: 99,
    permanentAttributes: {
      agility: { before: 10, after: 11, cap: 99 },
    },
  };
}

function score(runIndex) {
  const value = [60, 80, 65, 75, 70, 70, 75, 65, 80, 60][runIndex - 1];
  const difficultyBaseline = runIndex * 10;
  const weights = {
    objective: 2200,
    causalImpact: 1400,
    execution: 1800,
    risk: 1000,
    integrity: 1200,
    efficiency: 1200,
    survival: 700,
    antiFarmDecay: 500,
  };
  const dimensions = {};
  for (const dim of ["objective", "causalImpact", "execution", "risk", "integrity", "efficiency", "survival", "antiFarmDecay"]) {
    dimensions[dim] = {
      value,
      weightBps: weights[dim],
      contribution: value * weights[dim] / 10_000,
      reasonCode: `test_${dim}`,
      formula: "quality",
      inputs: { quality: value / 100 },
      inputContributions: { quality: value },
      events: [`event-${runIndex}-receipt`],
      evidence: [`event-${runIndex}-receipt`],
    };
  }
  return {
    contractVersion: "phase6_score.v2",
    authority: "server_authoritative",
    provenance: "server_canonical",
    formula: "total = sum(dimensions[dimension].contribution) * decay",
    dimensions,
    weightedTotal: value,
    decay: 1,
    total: value,
    context: {
      difficultyBaseline,
      combatPowerBaseline: 50,
      expectedPerformanceBaseline: 50 + difficultyBaseline * 0.2,
      observedPerformance: value,
      performanceDeltaFromBaseline: value - (50 + difficultyBaseline * 0.2),
      scoringUse: "context_only_not_weighted",
    },
  };
}

function shopRecords(runIndex) {
  return {
    offers: [{
      offerId: `offer-${runIndex}`,
      offerVersion: "v1",
      itemKey: `item-${runIndex}`,
      costs: [{ resourceKey: "coin", amount: "100" }],
      stock: "10",
    }],
    purchases: [{
      operation: "purchase",
      requestId: `purchase-${runIndex}`,
      offerId: `offer-${runIndex}`,
      itemKey: `item-${runIndex}`,
      resourceSpends: [{ resourceKey: "coin", amount: "100" }],
      feeMinor: "30",
    }],
    economyAudit: economyAudit(runIndex),
  };
}

function craftingRecords(runIndex) {
  return {
    recipes: [{
      recipeId: `recipe-${runIndex}`,
      version: "v1",
      materials: [{ materialId: "ore", quantity: 2 }],
      outputs: [{ itemId: "ore", quantity: 1 }],
    }],
    crafts: [{
      craftId: `craft-${runIndex}`,
      recipeId: `recipe-${runIndex}`,
      recipeVersion: "v1",
      idempotencyKey: `craft-key-${runIndex}`,
      claimId: `claim-${runIndex}`,
      success: true,
      materialsConsumed: [{ materialId: "ore", quantity: 2, sourceEventId: `event-${runIndex}-ore` }],
      outputs: [{ itemId: "ore", quantity: 1, sourceEventId: `craft-${runIndex}` }],
      losses: [{ itemId: "ore", quantity: 1 }],
      fees: [{ asset: "coin", quantity: 1 }],
      quality: { grade: "common" },
      seed: `craft-seed-${runIndex}`,
    }],
    progression: [{
      profession: "smithing",
      professionXp: 1,
      source: `craft-${runIndex}`,
    }],
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
