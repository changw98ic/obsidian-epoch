import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

// @ts-ignore: phase6-ten-run is a CLI .mjs module with a focused test export.
import { validate } from "../phase6-ten-run.mjs";

const experimentId = "phase6-exp-synthetic";
const identityId = "identity-synthetic";
const explorerId = "explorer-synthetic";
const versions = {
  rulesetVersion: "rules-v1",
  catalogVersion: "catalog-v1",
  codeVersion: "code-v1",
  scenarioMatrixVersion: "matrix-v1",
};

type JsonRecord = Record<string, unknown>;

const launcherSourceToolName = (toolName: string) => `mcp__obsidian_epoch__obsidian_epoch_${toolName}`;

function receipt(runIndex: number): JsonRecord {
  return {
    version: "journey_run_receipt.v2",
    receiptId: `receipt-${runIndex}`,
    pageId: `page-${runIndex}`,
    experimentId,
    runIndex,
    seed: `seed-${runIndex}`,
    ...versions,
    startedAt: `2026-07-21T00:${String(runIndex).padStart(2, "0")}:01.000Z`,
    settledAt: `2026-07-21T00:${String(runIndex).padStart(2, "0")}:04.000Z`,
    worldTimeBefore: runIndex * 100,
    worldTimeAfter: runIndex * 100 + 10,
    before: { body: { runIndex, state: "before" }, hash: `before-hash-${runIndex}` },
    after: { body: { runIndex, state: "after" }, hash: `after-hash-${runIndex}` },
    outcome: { summary: `settled ${runIndex}` },
    integrity: { eventIdsHash: `events-hash-${runIndex}`, payloadHash: `payload-hash-${runIndex}` },
    eventIds: [`event-${runIndex}-receipt`],
  };
}

function panel(runIndex: number, phase: "before" | "after"): JsonRecord {
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

function record(runIndex: number, offset: number, body: JsonRecord): JsonRecord {
  return {
    timestamp: `2026-07-21T00:${String(runIndex).padStart(2, "0")}:${String(offset).padStart(2, "0")}.000Z`,
    experimentId,
    identityId,
    explorerId,
    runIndex,
    ...versions,
    ok: true,
    ...body,
  };
}

function goldenRecords(): JsonRecord[] {
  const records: JsonRecord[] = [{
    timestamp: "2026-07-21T00:00:00.000Z",
    toolName: "obsidian_epoch.begin_phase6_experiment",
    sourceToolName: launcherSourceToolName("begin_phase6_experiment"),
    ok: true,
    experimentId,
    identityId,
    explorerId,
    status: "planned",
    versions,
  }];

  for (let runIndex = 1; runIndex <= 10; runIndex += 1) {
    const binding = { receiptId: `begin-receipt-${runIndex}`, runIndex, experimentId };
    records.push(
      record(runIndex, 1, {
        toolName: "obsidian_epoch.begin_phase6_run",
        sourceToolName: launcherSourceToolName("begin_phase6_run"),
        status: "running",
        seed: `seed-${runIndex}`,
        versions,
        binding,
      }),
      record(runIndex, 2, {
        toolName: "obsidian_epoch.start_journey",
        sourceToolName: launcherSourceToolName("start_journey_compact"),
        seed: `seed-${runIndex}`,
        versions,
        binding,
        formalJourney: true,
        playerPanelBefore: panel(runIndex, "before"),
      }),
      record(runIndex, 3, {
        eventType: "player_panel_snapshot_after",
        playerPanelAfter: panel(runIndex, "after"),
        eventIds: [`event-${runIndex}-panel`],
      }),
      record(runIndex, 4, {
        toolName: "obsidian_epoch.journey_status",
        sourceToolName: launcherSourceToolName("journey_status_compact"),
        phase6Settlement: {
          ok: true,
          status: "settled",
          pageId: `page-${runIndex}`,
          receiptId: `receipt-${runIndex}`,
        },
      }),
      record(runIndex, 5, {
        toolName: "obsidian_epoch.run_receipt",
        sourceToolName: launcherSourceToolName("run_receipt_compact"),
        receipt: receipt(runIndex),
        runReceipt: receipt(runIndex),
        resourceConservation: { ok: true },
        ragDelta: { added: [`knowledge-${runIndex}`] },
        scoreBreakdown: { execution: runIndex, risk: runIndex % 3 },
        eventIds: [`event-${runIndex}-receipt-record`],
      }),
      record(runIndex, 6, {
        eventType: "formal_result_page_published",
        resultPage: { pageId: `page-${runIndex}`, receiptId: `receipt-${runIndex}` },
      }),
      record(runIndex, 7, {
        toolName: "obsidian_epoch.phase6_result",
        sourceToolName: launcherSourceToolName("phase6_result_compact"),
        verified: true,
        pageId: `page-${runIndex}`,
        receiptId: `receipt-${runIndex}`,
        resultPage: { pageId: `page-${runIndex}`, receiptId: `receipt-${runIndex}` },
        result: { receipt: { receiptId: `receipt-${runIndex}`, runIndex } },
      }),
      record(runIndex, 8, {
        toolName: "obsidian_epoch.phase6_experiment_status",
        sourceToolName: launcherSourceToolName("phase6_experiment_status"),
        runs: [{ runIndex, status: "complete", receipt: binding }],
      }),
    );
  }
  return records;
}

function validateRecords(records: JsonRecord[]) {
  return validate({}, `${records.map((entry) => JSON.stringify(entry)).join("\n")}\n`);
}

function canonicalRecordFrom(body: JsonRecord, sequence: number): JsonRecord {
  const input: JsonRecord = {
    experimentId: body.experimentId,
    runIndex: body.runIndex,
  };
  if (body.toolName === "obsidian_epoch.start_journey") {
    input.seed = body.seed;
    input.versions = body.versions;
    input.binding = body.binding;
  }
  return {
    schemaVersion: "phase6.cde_tool_record.v1",
    sequence,
    timestamp: body.timestamp,
    toolUseId: `toolu_canonical_${sequence}`,
    sourceToolName: body.sourceToolName,
    originalToolName: body.sourceToolName,
    toolName: body.toolName,
    isError: false,
    ok: body.ok,
    input,
    output: { ...body },
    metadata: {
      experimentId: body.experimentId,
      ...(body.runIndex ? { runIndex: body.runIndex } : {}),
    },
  };
}

function canonicalGoldenRecords(): JsonRecord[] {
  return goldenRecords().map((entry, index) => canonicalRecordFrom(entry, index + 1));
}

function assertFailure(records: JsonRecord[], code: string) {
  const summary = validateRecords(records);
  assert.equal(summary.ok, false);
  assert.ok(summary.failures.some((failure: { code: string }) => failure.code === code), JSON.stringify(summary.failures, null, 2));
}

test("Phase 6 ten-run validator accepts a complete synthetic proof", () => {
  const summary = validateRecords(goldenRecords());
  assert.equal(summary.ok, true, JSON.stringify(summary.failures, null, 2));
  assert.equal(summary.gates.runReceiptV2ValidRecords, 10);
  assert.equal(summary.gates.phase6ResultVerifiedRecords, 10);
});

test("Phase 6 ten-run validator accepts extractor canonical output-layer fields", () => {
  const summary = validateRecords(canonicalGoldenRecords());
  assert.equal(summary.ok, true, JSON.stringify(summary.failures, null, 2));
  assert.equal(summary.gates.runReceiptV2ValidRecords, 10);
  assert.equal(summary.gates.phase6ResultVerifiedRecords, 10);
  assert.equal(summary.gates.serverIssuedStartMatches, 10);
});

test("Phase 6 ten-run validator rejects contradictory canonical metadata without treating consistent metadata as override", () => {
  const consistent = validateRecords(canonicalGoldenRecords());
  assert.equal(consistent.ok, true, JSON.stringify(consistent.failures, null, 2));
  assert.equal(consistent.gates.startJourneyMetadataOverrideRecords, 0);

  const records = canonicalGoldenRecords();
  const target = records.find((entry) => entry.toolName === "obsidian_epoch.start_journey" && (entry.metadata as JsonRecord).runIndex === 1) as JsonRecord;
  (target.metadata as JsonRecord).runIndex = 2;
  assertFailure(records, "phase6_canonical_metadata_conflict");
});

test("Phase 6 ten-run validator accepts real launcher mixed compact and noncompact sources", () => {
  const records = goldenRecords();
  const legalNonCompactTools = [
    "register_explorer",
    "prepare_journey",
    "player_panel",
    "progress",
    "world_overview",
    "world_content",
  ];
  const legalCompactTools = [
    "propose_journey_step",
    "commit_journey_action",
  ];
  const extractedRecords = [...legalNonCompactTools, ...legalCompactTools].map((tool, index) => ({
    schemaVersion: "phase6.cde_tool_record.v1",
    sequence: 10_000 + index,
    timestamp: `2026-07-21T00:00:${String(index + 1).padStart(2, "0")}.000Z`,
    toolUseId: `toolu_mixed_source_${index + 1}`,
    sourceToolName: launcherSourceToolName(
      legalCompactTools.includes(tool) ? `${tool}_compact` : tool,
    ),
    toolName: `obsidian_epoch.${tool}`,
    isError: false,
    ok: true,
    input: { experimentId, runIndex: 1 },
    output: { status: "ok" },
    metadata: { experimentId, runIndex: 1 },
  }));
  records.splice(1, 0, ...extractedRecords);

  const summary = validateRecords(records);
  assert.equal(summary.ok, true, JSON.stringify(summary.failures, null, 2));
});

test("Phase 6 ten-run validator fails on any malformed nonempty JSONL line without echoing it", () => {
  const records = goldenRecords();
  const malformedSecret = "MALFORMED_TEN_RUN_SECRET_987654";
  const malformedLine = `{"toolName":"obsidian_epoch.start_journey","secret":"${malformedSecret}"`;
  const input = [
    JSON.stringify(records[0]),
    malformedLine,
    ...records.slice(1).map((entry) => JSON.stringify(entry)),
  ].join("\n");

  const summary = validate({}, `${input}\n`);
  assert.equal(summary.ok, false);
  assert.equal(summary.parseErrors, 1);
  const failure = summary.failures.find((entry: { code: string }) => entry.code === "parse_input");
  assert.ok(failure);
  assert.deepEqual(failure.malformedLines, [{
    lineNumber: 2,
    byteLength: Buffer.byteLength(malformedLine),
    sha256: createHash("sha256").update(malformedLine).digest("hex"),
  }]);
  assert.equal(JSON.stringify(failure).includes(malformedSecret), false);
  assert.deepEqual(Object.keys(failure.malformedLines[0]).sort(), ["byteLength", "lineNumber", "sha256"]);
});

test("Phase 6 ten-run validator fails closed on any error marker", () => {
  const records = goldenRecords();
  records.splice(10, 0, record(1, 9, { isError: true, ok: true, eventType: "temporary_tool_recovery" }));
  assertFailure(records, "phase6_fail_closed_error_markers");
});

test("Phase 6 ten-run validator requires one explorer binding", () => {
  const records = goldenRecords();
  records[20].explorerId = "other-explorer";
  assertFailure(records, "phase6_explorer_binding_consistent");
});

test("Phase 6 ten-run validator requires previous run proof before next begin", () => {
  const records = goldenRecords();
  const moved = records.splice(4, 1)[0];
  records.splice(11, 0, moved);
  assertFailure(records, "phase6_previous_run_settled_before_next_begin");
});

test("Phase 6 ten-run validator requires strict journey_status settlement ids", () => {
  const records = goldenRecords();
  const settlement = records[4].phase6Settlement as JsonRecord;
  settlement.status = "completed";
  assertFailure(records, "phase6_journey_status_settlement_strict");
});

test("Phase 6 ten-run validator binds verified result to same-run status and receipt", () => {
  const records = goldenRecords();
  records[7].receiptId = "receipt-from-other-run";
  assertFailure(records, "phase6_result_verified_binding_match");
});

test("Phase 6 ten-run validator rejects non-compact sources for all six compact-only normalized tools", () => {
  const compactOnlyTools = [
    ["start_journey", 2],
    ["journey_status", 4],
    ["run_receipt", 5],
    ["phase6_result", 7],
  ] as const;
  for (const [tool, recordIndex] of compactOnlyTools) {
    const records = goldenRecords();
    records[recordIndex].sourceToolName = launcherSourceToolName(tool);
    assertFailure(records, "phase6_compact_only_source_tools");
  }

  for (const tool of ["propose_journey_step", "commit_journey_action"]) {
    const records = goldenRecords();
    records.push({
      schemaVersion: "phase6.cde_tool_record.v1",
      sequence: 20_000,
      toolUseId: `toolu_${tool}_noncompact`,
      sourceToolName: launcherSourceToolName(tool),
      toolName: `obsidian_epoch.${tool}`,
      isError: false,
      ok: true,
      input: {},
      output: { status: "ok" },
    });
    assertFailure(records, "phase6_compact_only_source_tools");
  }

  const records = goldenRecords();
  records[2].originalToolName = launcherSourceToolName("start_journey");
  assertFailure(records, "phase6_compact_only_source_tools");

  const missingSourceRecords = goldenRecords();
  delete missingSourceRecords[2].sourceToolName;
  delete missingSourceRecords[2].originalToolName;
  assertFailure(missingSourceRecords, "phase6_compact_only_source_tools");
});

test("Phase 6 ten-run validator requires real before/after panel changes", () => {
  const records = goldenRecords();
  records[3].playerPanelAfter = records[2].playerPanelBefore;
  assertFailure(records, "phase6_player_panel_real_changes");
});

test("Phase 6 ten-run validator keeps existing economy, RAG, and scoring gates", () => {
  const noEconomy = goldenRecords();
  delete noEconomy[5].resourceConservation;
  assertFailure(noEconomy, "resource_conservation");

  const noRag = goldenRecords();
  delete noRag[5].ragDelta;
  assertFailure(noRag, "rag_world_delta_or_no_change_reason");

  const noScoring = goldenRecords();
  delete noScoring[5].scoreBreakdown;
  assertFailure(noScoring, "score_breakdown_present");
});
