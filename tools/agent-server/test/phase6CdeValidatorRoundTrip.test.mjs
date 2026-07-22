import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const extractorPath = resolve(repoRoot, "tools/agent-server/phase6-cde-stream-to-jsonl.mjs");
const validatorPath = resolve(repoRoot, "tools/agent-server/phase6-ten-run.mjs");
const mcpPrefix = "mcp__obsidian_epoch__";
const experimentId = "phase6-exp-roundtrip";
const identityId = "identity-roundtrip";
const explorerId = "explorer-roundtrip";
const versions = {
  rulesetVersion: "rules-v1",
  catalogVersion: "catalog-v1",
  codeVersion: "code-v1",
  scenarioMatrixVersion: "phase6.scenario-matrix.v0.2.0",
};
const scenarioTags = [
  "low-prepared-resource",
  "low-underprepared-information",
  "medium-prepared-tactical",
  "medium-borderline-escort",
  "medium-mismatched-preserve",
  "high-prepared-high-value",
  "high-underprepared-evacuation",
  "medium-prepared-cultivation",
  "medium-specialist-crafting",
  "dynamic-mixed-repeat",
];

test("Phase 6 extractor output validates through the ten-run CLI", () => {
  const root = mkdtempSync(join(tmpdir(), "phase6-cde-validator-roundtrip-"));
  try {
    const streamPath = join(root, "claude-stream.jsonl");
    const toolsPath = join(root, "phase6-tools.jsonl");
    writeFileSync(streamPath, jsonl(modernClaudeStream()), "utf8");

    const extracted = spawnSync(process.execPath, [extractorPath, "--input", streamPath, "--output", toolsPath], {
      cwd: repoRoot,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    });
    assert.equal(extracted.status, 0, extracted.stderr || extracted.stdout);

    const records = readFileSync(toolsPath, "utf8").trim().split("\n").map((line) => JSON.parse(line));
    assert.equal(records.length, 81);
    assert.equal(records.every((record) => record.sourceToolName && record.originalToolName === record.sourceToolName), true);
    assert.equal(records.some((record) => record.toolName === "obsidian_epoch.run_receipt" && record.output?.receipt?.version === "journey_run_receipt.v2"), true);

    const validated = spawnSync(process.execPath, [validatorPath, "--input", toolsPath], {
      cwd: repoRoot,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    });
    assert.equal(validated.status, 0, validated.stdout + validated.stderr);
    const summary = JSON.parse(validated.stdout);
    assert.equal(summary.ok, true, JSON.stringify(summary.failures, null, 2));
    assert.equal(summary.gates.beginPhase6RunSuccessRecords, 10);
    assert.equal(summary.gates.runReceiptV2ValidRecords, 10);
    assert.equal(summary.gates.phase6ResultVerifiedRecords, 10);
    assert.equal(summary.gates.serverIssuedStartMatches, 10);
    assert.equal(summary.gates.playerPanelToolCalls, 20);
    assert.equal(summary.gates.scenarioTags, 10);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

function modernClaudeStream() {
  const events = [];
  let sequence = 0;
  const pushTool = (toolSuffix, input, output, timestamp) => {
    sequence += 1;
    const toolUseId = `toolu_roundtrip_${sequence}`;
    events.push({
      type: "assistant",
      timestamp,
      message: {
        role: "assistant",
        content: [{
          type: "tool_use",
          id: toolUseId,
          name: `${mcpPrefix}obsidian_epoch_${toolSuffix}`,
          input,
        }],
      },
    });
    events.push({
      type: "user",
      timestamp: addSecond(timestamp),
      message: {
        role: "user",
        content: [{
          type: "tool_result",
          tool_use_id: toolUseId,
          is_error: false,
          content: [{ type: "text", text: JSON.stringify(output) }],
        }],
      },
    });
  };

  pushTool(
    "begin_phase6_experiment",
    { identityId, explorerId },
    { experimentId, identityId, explorerId, status: "planned", versions },
    "2026-07-21T00:00:00.000Z",
  );

  for (let runIndex = 1; runIndex <= 10; runIndex += 1) {
    const binding = { receiptId: `begin-receipt-${runIndex}`, runIndex, experimentId };
    const seed = `seed-${runIndex}`;
    const scenarioTag = scenarioTags[runIndex - 1];
    const common = { experimentId, identityId, explorerId, runIndex, seed, versions, scenarioTag };
    pushTool(
      "begin_phase6_run",
      { experimentId, runIndex, scenarioTag },
      { ...common, status: "running", binding },
      `2026-07-21T00:${minute(runIndex)}:01.000Z`,
    );
    pushTool(
      "player_panel",
      { agentId: explorerId, experimentId, runIndex },
      { ...common, ...panel(runIndex, "before") },
      `2026-07-21T00:${minute(runIndex)}:02.000Z`,
    );
    pushTool(
      "start_journey_compact",
      { experimentId, runIndex, seed, versions, binding },
      { ...common, status: "started", binding },
      `2026-07-21T00:${minute(runIndex)}:03.000Z`,
    );
    pushTool(
      "journey_status_compact",
      { experimentId, runIndex },
      {
        ...common,
        phase6Settlement: {
          ok: true,
          status: "settled",
          pageId: `page-${runIndex}`,
          receiptId: `receipt-${runIndex}`,
        },
      },
      `2026-07-21T00:${minute(runIndex)}:05.000Z`,
    );
    pushTool(
      "run_receipt_compact",
      { experimentId, runIndex },
      {
        ...common,
        receipt: receipt(runIndex),
        runReceipt: receipt(runIndex),
        resourceConservation: { ok: true },
        ragDelta: { added: [`knowledge-${runIndex}`] },
        scoreBreakdown: canonicalScoreBreakdown(runIndex),
        eventIds: [`event-${runIndex}-receipt-record`],
      },
      `2026-07-21T00:${minute(runIndex)}:07.000Z`,
    );
    pushTool(
      "phase6_result_compact",
      { experimentId, runIndex },
      {
        ...common,
        verified: true,
        pageId: `page-${runIndex}`,
        receiptId: `receipt-${runIndex}`,
        resultPage: { pageId: `page-${runIndex}`, receiptId: `receipt-${runIndex}` },
        result: { receipt: { receiptId: `receipt-${runIndex}`, runIndex } },
        progressionDelta: runIndex === 2
          ? { changed: 0, noChangeReason: "canonical_progression_equal" }
          : { changed: 1 },
      },
      `2026-07-21T00:${minute(runIndex)}:09.000Z`,
    );
    pushTool(
      "player_panel",
      { agentId: explorerId, experimentId, runIndex },
      { ...common, ...panel(runIndex, runIndex === 2 ? "before" : "after") },
      `2026-07-21T00:${minute(runIndex)}:10.000Z`,
    );
    pushTool(
      "phase6_experiment_status",
      { experimentId, runIndex },
      {
        experimentId,
        runs: [{ runIndex, status: "complete", receipt: binding }],
      },
      `2026-07-21T00:${minute(runIndex)}:11.000Z`,
    );
  }
  return events;
}

function receipt(runIndex) {
  return {
    version: "journey_run_receipt.v2",
    receiptId: `receipt-${runIndex}`,
    pageId: `page-${runIndex}`,
    experimentId,
    runIndex,
    scenarioTag: scenarioTags[runIndex - 1],
    seed: `seed-${runIndex}`,
    ...versions,
    startedAt: `2026-07-21T00:${minute(runIndex)}:01.000Z`,
    settledAt: `2026-07-21T00:${minute(runIndex)}:08.000Z`,
    worldTimeBefore: runIndex * 100,
    worldTimeAfter: runIndex * 100 + 10,
    before: { body: { runIndex, state: "before" }, hash: `before-hash-${runIndex}` },
    after: { body: { runIndex, state: "after" }, hash: `after-hash-${runIndex}` },
    outcome: { summary: `settled ${runIndex}` },
    integrity: { eventIdsHash: `events-hash-${runIndex}`, payloadHash: `payload-hash-${runIndex}` },
    eventIds: [`event-${runIndex}-receipt`],
  };
}

function canonicalScoreBreakdown(runIndex) {
  return {
    objective: 60 + (runIndex % 3),
    causalImpact: 55 + ((runIndex * 2) % 5),
    execution: 58 + ((runIndex * 3) % 7),
    risk: 52 + ((runIndex * 5) % 11),
    integrity: 100,
    efficiency: 57 + ((runIndex * 7) % 9),
    survival: 70 + ((runIndex * 11) % 13),
    antiFarmDecay: 100 - (runIndex % 4),
  };
}

function panel(runIndex, phase) {
  const after = phase === "after";
  return {
    wallet: { currencies: [{ resourceKey: "coin", balanceMinor: String(1000 + runIndex + (after ? 1 : 0)) }] },
    progression: {
      skillTree: {
        learnedNodeIds: after ? ["root", `skill-${runIndex}`] : ["root"],
        proficiency: { root: 10, [`skill-${runIndex}`]: after ? runIndex : 0 },
      },
      talents: after ? [{ talentId: `talent-${runIndex}` }] : [],
      attributeEvidenceXp: { strength: after ? runIndex : 0 },
    },
    combat: {
      dimensions: { strength: after ? 40 + runIndex : 30 + runIndex },
      aggregatePower: { mid: after ? 200 + runIndex : 100 + runIndex },
    },
    rag: { hits: after ? [{ id: `knowledge-${runIndex}`, confidence: 0.8 }] : [{ id: "baseline", confidence: 0.5 }] },
    recentRuns: {
      runs: after
        ? [{ runId: `run-${runIndex}`, intensity: { encounterIntensity: 10 + runIndex }, score: { finalScore: 20 + runIndex } }]
        : [{ runId: `previous-${runIndex}`, intensity: { encounterIntensity: runIndex }, score: { finalScore: runIndex } }],
    },
  };
}

function minute(runIndex) {
  return String(runIndex).padStart(2, "0");
}

function addSecond(timestamp) {
  return new Date(Date.parse(timestamp) + 1000).toISOString();
}

function jsonl(records) {
  return `${records.map((record) => JSON.stringify(record)).join("\n")}\n`;
}
