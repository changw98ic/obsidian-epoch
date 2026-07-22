import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const extractorPath = resolve(repoRoot, "tools/agent-server/phase6-cde-stream-to-jsonl.mjs");
const currentMcpPrefix = "mcp__obsidian_epoch__";
const legacyMcpPrefix = "mcp__obsidian-epoch-agent-world__";

test("Phase 6 CDE extractor reads current Claude stream-json events and redacts tool secrets", () => {
  const root = mkdtempSync(join(tmpdir(), "phase6-cde-stream-jsonl-"));
  try {
    const inputPath = join(root, "synthetic-stream.jsonl");
    const outputPath = join(root, "phase6-tools.jsonl");
    const recoveryCode = "RECOVERY-CODE-123456";
    const authToken = "tok_phase6_secret_abcdef";
    const apiKey = "sk-phase6SyntheticSecret123";
    const stream = [
      {
        type: "system",
        subtype: "init",
        session_id: "synthetic-session",
      },
      {
        type: "assistant",
        timestamp: "2026-07-21T08:00:00.000Z",
        message: {
          role: "assistant",
          content: [{
            type: "tool_use",
            id: "toolu_phase6_world_content_1",
            name: `${currentMcpPrefix}obsidian_epoch_world_content`,
            input: {
              experimentId: "phase6-exp-synthetic",
              runIndex: 1,
              recoveryCode,
              credentials: {
                token: authToken,
                apiKey,
              },
              playerId: "player_synthetic",
            },
          }],
        },
      },
      {
        type: "user",
        timestamp: "2026-07-21T08:00:01.000Z",
        message: {
          role: "user",
          content: [{
            type: "tool_result",
            tool_use_id: "toolu_phase6_world_content_1",
            is_error: false,
            content: [{
              type: "text",
              text: JSON.stringify({
                experimentId: "phase6-exp-synthetic",
                runIndex: 1,
                journey: { status: "completed" },
                receipt: {
                  publicId: "receipt_synthetic",
                  echoedSecret: `result accidentally echoed ${recoveryCode} ${authToken} ${apiKey}`,
                  bearerLine: "Bearer SHOULD_NOT_SURVIVE_123456",
                  tokenLine: "token=SHOULD_NOT_SURVIVE_123456",
                },
              }),
            }],
          }],
        },
      },
      {
        type: "result",
        subtype: "success",
        duration_ms: 42,
      },
    ];
    writeFileSync(inputPath, `${stream.map((entry) => JSON.stringify(entry)).join("\n")}\n`, "utf8");

    const result = spawnSync(process.execPath, [extractorPath, "--input", inputPath, "--output", outputPath], {
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
    });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    const output = readFileSync(outputPath, "utf8");
    assert.equal(output.includes(recoveryCode), false);
    assert.equal(output.includes(authToken), false);
    assert.equal(output.includes(apiKey), false);
    assert.equal(output.includes("SHOULD_NOT_SURVIVE_123456"), false);
    assert.equal(/recoveryCode|token|apiKey/i.test(output), false);

    const records = output.trim().split("\n").map((line) => JSON.parse(line));
    assert.equal(records.length, 1);
    assert.deepEqual(records[0], {
      schemaVersion: "phase6.cde_tool_record.v1",
      sequence: 1,
      timestamp: "2026-07-21T08:00:01.000Z",
      toolUseId: "toolu_phase6_world_content_1",
      sourceToolName: "mcp__obsidian_epoch__obsidian_epoch_world_content",
      originalToolName: "mcp__obsidian_epoch__obsidian_epoch_world_content",
      toolName: "obsidian_epoch.world_content",
      isError: false,
      ok: true,
      input: {
        experimentId: "phase6-exp-synthetic",
        runIndex: 1,
        playerId: "player_synthetic",
      },
      output: {
        experimentId: "phase6-exp-synthetic",
        runIndex: 1,
        journey: { status: "completed" },
        receipt: {
          publicId: "receipt_synthetic",
          bearerLine: "[REDACTED]",
        },
      },
      metadata: {
        experimentId: "phase6-exp-synthetic",
        runIndex: 1,
      },
      runSettled: true,
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Phase 6 CDE extractor normalizes compact tools for current and legacy MCP prefixes", () => {
  const root = mkdtempSync(join(tmpdir(), "phase6-cde-stream-jsonl-"));
  try {
    const inputPath = join(root, "synthetic-prefix-stream.jsonl");
    const outputPath = join(root, "phase6-tools.jsonl");
    const stream = [
      {
        type: "assistant",
        timestamp: "2026-07-21T08:01:00.000Z",
        message: {
          role: "assistant",
          content: [
            {
              type: "tool_use",
              id: "toolu_current_compact_1",
              name: `${currentMcpPrefix}obsidian_epoch_start_journey_compact`,
              input: { experimentId: "phase6-prefixes", runIndex: 1 },
            },
          ],
        },
      },
      {
        type: "user",
        timestamp: "2026-07-21T08:01:01.000Z",
        message: {
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: "toolu_current_compact_1",
              is_error: false,
              content: [{ type: "text", text: JSON.stringify({ status: "started" }) }],
            },
          ],
        },
      },
      {
        type: "assistant",
        timestamp: "2026-07-21T08:01:02.000Z",
        message: {
          role: "assistant",
          content: [
            {
              type: "tool_use",
              id: "toolu_legacy_compact_1",
              name: `${legacyMcpPrefix}obsidian_epoch_phase6_result_compact`,
              input: { experimentId: "phase6-prefixes", runIndex: 1 },
            },
          ],
        },
      },
      {
        type: "user",
        timestamp: "2026-07-21T08:01:03.000Z",
        message: {
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: "toolu_legacy_compact_1",
              is_error: true,
              content: [{ type: "text", text: JSON.stringify({ status: "failed" }) }],
            },
          ],
        },
      },
    ];
    writeFileSync(inputPath, `${stream.map((entry) => JSON.stringify(entry)).join("\n")}\n`, "utf8");

    const result = spawnSync(process.execPath, [extractorPath, "--input", inputPath, "--output", outputPath], {
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
    });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    const records = readFileSync(outputPath, "utf8").trim().split("\n").map((line) => JSON.parse(line));
    assert.deepEqual(records.map((record) => ({
      sourceToolName: record.sourceToolName,
      originalToolName: record.originalToolName,
      toolName: record.toolName,
      isError: record.isError,
      ok: record.ok,
    })), [
      {
        sourceToolName: `${currentMcpPrefix}obsidian_epoch_start_journey_compact`,
        originalToolName: `${currentMcpPrefix}obsidian_epoch_start_journey_compact`,
        toolName: "obsidian_epoch.start_journey",
        isError: false,
        ok: true,
      },
      {
        sourceToolName: `${legacyMcpPrefix}obsidian_epoch_phase6_result_compact`,
        originalToolName: `${legacyMcpPrefix}obsidian_epoch_phase6_result_compact`,
        toolName: "obsidian_epoch.phase6_result",
        isError: true,
        ok: false,
      },
    ]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Phase 6 CDE extractor fails closed at EOF with a pending tool use", () => {
  const root = mkdtempSync(join(tmpdir(), "phase6-cde-stream-jsonl-"));
  try {
    const inputPath = join(root, "synthetic-pending-stream.jsonl");
    const outputPath = join(root, "phase6-tools.jsonl");
    const pendingSecret = "PENDING_TOOL_USE_SECRET_123456";
    const stream = [{
      type: "assistant",
      timestamp: "2026-07-21T08:06:00.000Z",
      message: {
        role: "assistant",
        content: [{
          type: "tool_use",
          id: "toolu_pending_1",
          name: `${currentMcpPrefix}obsidian_epoch_world_content`,
          input: { experimentId: "phase6-pending", recoveryCode: pendingSecret },
        }],
      },
    }];
    writeFileSync(inputPath, `${stream.map((entry) => JSON.stringify(entry)).join("\n")}\n`, "utf8");

    const result = spawnSync(process.execPath, [extractorPath, "--input", inputPath, "--output", outputPath], {
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
    });

    assert.equal(result.status, 1);
    assert.equal(result.stdout, "");
    assert.equal(result.stderr.includes(pendingSecret), false);
    assert.equal(result.stderr.includes("recoveryCode"), false);
    assert.equal(existsSync(outputPath), false);
    assert.deepEqual(JSON.parse(result.stderr.trim()), {
      ok: false,
      error: "invalid_tool_call_stream_protocol",
      violations: [{
        reason: "pending_tool_use_without_tool_result",
      }],
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Phase 6 CDE extractor fails closed when one assistant message contains multiple tool uses", () => {
  const root = mkdtempSync(join(tmpdir(), "phase6-cde-stream-jsonl-"));
  try {
    const inputPath = join(root, "synthetic-batched-tool-use-stream.jsonl");
    const outputPath = join(root, "phase6-tools.jsonl");
    const batchedSecret = "BATCHED_TOOL_USE_SECRET_123456";
    const stream = [
      {
        type: "assistant",
        timestamp: "2026-07-21T08:03:00.000Z",
        message: {
          role: "assistant",
          content: [
            {
              type: "tool_use",
              id: "toolu_batched_1",
              name: `${currentMcpPrefix}obsidian_epoch_world_content`,
              input: { experimentId: "phase6-batched", recoveryCode: batchedSecret },
            },
            {
              type: "tool_use",
              id: "toolu_batched_2",
              name: `${currentMcpPrefix}obsidian_epoch_progress`,
              input: { experimentId: "phase6-batched" },
            },
          ],
        },
      },
      {
        type: "user",
        timestamp: "2026-07-21T08:03:01.000Z",
        message: {
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: "toolu_batched_1",
              is_error: false,
              content: [{ type: "text", text: JSON.stringify({ status: "ok" }) }],
            },
            {
              type: "tool_result",
              tool_use_id: "toolu_batched_2",
              is_error: false,
              content: [{ type: "text", text: JSON.stringify({ status: "ok" }) }],
            },
          ],
        },
      },
    ];
    writeFileSync(inputPath, `${stream.map((entry) => JSON.stringify(entry)).join("\n")}\n`, "utf8");

    const result = spawnSync(process.execPath, [extractorPath, "--input", inputPath, "--output", outputPath], {
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
    });

    assert.equal(result.status, 1);
    assert.equal(result.stdout, "");
    assert.equal(result.stderr.includes(batchedSecret), false);
    assert.equal(result.stderr.includes("recoveryCode"), false);
    assert.equal(existsSync(outputPath), false);
    const summary = JSON.parse(result.stderr.trim());
    assert.equal(summary.ok, false);
    assert.equal(summary.error, "invalid_tool_call_stream_protocol");
    assert.equal(
      summary.violations.some((violation: { reason: string }) =>
        violation.reason === "multiple_tool_uses_in_assistant_message"),
      true,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Phase 6 CDE extractor fails closed when a new tool use appears before the prior result", () => {
  const root = mkdtempSync(join(tmpdir(), "phase6-cde-stream-jsonl-"));
  try {
    const inputPath = join(root, "synthetic-overlapping-tool-use-stream.jsonl");
    const outputPath = join(root, "phase6-tools.jsonl");
    const overlapSecret = "OVERLAPPING_TOOL_USE_SECRET_123456";
    const stream = [
      {
        type: "assistant",
        timestamp: "2026-07-21T08:04:00.000Z",
        message: {
          role: "assistant",
          content: [{
            type: "tool_use",
            id: "toolu_overlap_1",
            name: `${currentMcpPrefix}obsidian_epoch_world_content`,
            input: { experimentId: "phase6-overlap", recoveryCode: overlapSecret },
          }],
        },
      },
      {
        type: "assistant",
        timestamp: "2026-07-21T08:04:01.000Z",
        message: {
          role: "assistant",
          content: [{
            type: "tool_use",
            id: "toolu_overlap_2",
            name: `${currentMcpPrefix}obsidian_epoch_progress`,
            input: { experimentId: "phase6-overlap" },
          }],
        },
      },
      {
        type: "user",
        timestamp: "2026-07-21T08:04:02.000Z",
        message: {
          role: "user",
          content: [{
            type: "tool_result",
            tool_use_id: "toolu_overlap_1",
            is_error: false,
            content: [{ type: "text", text: JSON.stringify({ status: "ok" }) }],
          }],
        },
      },
    ];
    writeFileSync(inputPath, `${stream.map((entry) => JSON.stringify(entry)).join("\n")}\n`, "utf8");

    const result = spawnSync(process.execPath, [extractorPath, "--input", inputPath, "--output", outputPath], {
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
    });

    assert.equal(result.status, 1);
    assert.equal(result.stdout, "");
    assert.equal(result.stderr.includes(overlapSecret), false);
    assert.equal(result.stderr.includes("recoveryCode"), false);
    assert.equal(existsSync(outputPath), false);
    assert.deepEqual(JSON.parse(result.stderr.trim()), {
      ok: false,
      error: "invalid_tool_call_stream_protocol",
      violations: [{
        lineNumber: 2,
        reason: "new_tool_use_before_previous_tool_result",
      }],
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Phase 6 CDE extractor fails closed on malformed stream lines without leaking or writing evidence", () => {
  const root = mkdtempSync(join(tmpdir(), "phase6-cde-stream-jsonl-"));
  try {
    const inputPath = join(root, "synthetic-malformed-stream.jsonl");
    const newOutputPath = join(root, "new-phase6-tools.jsonl");
    const existingOutputPath = join(root, "existing-phase6-tools.jsonl");
    const malformedSecret = "MALFORMED_STREAM_SECRET_987654";
    const malformedLine =
      `{"type":"assistant","message":{"content":[{"type":"tool_use","name":"Bash",` +
      `"input":{"recoveryCode":"${malformedSecret}"}},{"type":"tool_error",` +
      `"message":"${malformedSecret}"}`;
    const validStream = [
      {
        type: "assistant",
        message: {
          role: "assistant",
          content: [{
            type: "tool_use",
            id: "toolu_before_malformed_1",
            name: `${currentMcpPrefix}obsidian_epoch_world_content`,
            input: { experimentId: "phase6-malformed", runIndex: 1 },
          }],
        },
      },
      {
        type: "user",
        message: {
          role: "user",
          content: [{
            type: "tool_result",
            tool_use_id: "toolu_before_malformed_1",
            is_error: false,
            content: [{ type: "text", text: JSON.stringify({ status: "complete" }) }],
          }],
        },
      },
    ];
    const input = `${validStream.map((entry) => JSON.stringify(entry)).join("\n")}\n${malformedLine}\n`;
    writeFileSync(inputPath, input, "utf8");

    const expectedSummary = {
      ok: false,
      error: "malformed_stream_jsonl",
      malformedLines: [{
        lineNumber: 3,
        byteLength: Buffer.byteLength(malformedLine),
        sha256: createHash("sha256").update(malformedLine).digest("hex"),
      }],
    };
    const runExtractor = (outputPath) => spawnSync(
      process.execPath,
      [extractorPath, "--input", inputPath, "--output", outputPath],
      { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
    );
    const assertSafeFailure = (result) => {
      assert.equal(result.status, 1);
      assert.equal(result.stdout, "");
      assert.equal(result.stderr.includes(malformedSecret), false);
      assert.equal(result.stderr.includes("recoveryCode"), false);
      assert.equal(result.stderr.includes("tool_error"), false);
      assert.equal(result.stderr.includes("Bash"), false);
      assert.deepEqual(JSON.parse(result.stderr.trim()), expectedSummary);
    };

    const newOutputResult = runExtractor(newOutputPath);
    assertSafeFailure(newOutputResult);
    assert.equal(existsSync(newOutputPath), false);

    const existingOutput = "existing evidence must remain unchanged\n";
    writeFileSync(existingOutputPath, existingOutput, "utf8");
    const existingOutputResult = runExtractor(existingOutputPath);
    assertSafeFailure(existingOutputResult);
    assert.equal(readFileSync(existingOutputPath, "utf8"), existingOutput);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Phase 6 CDE extractor fails closed on resource listing and other non-whitelisted tools", () => {
  const root = mkdtempSync(join(tmpdir(), "phase6-cde-stream-jsonl-"));
  try {
    const inputPath = join(root, "synthetic-unauthorized-stream.jsonl");
    const outputPath = join(root, "phase6-tools.jsonl");
    const forbiddenSecret = "UNAUTHORIZED_TOOL_INPUT_SECRET";
    const stream = [{
      type: "assistant",
      timestamp: "2026-07-21T08:02:00.000Z",
      message: {
        role: "assistant",
        content: [
          {
            type: "tool_use",
            id: "toolu_forbidden_bash_1",
            name: "Bash",
            input: {
              command: `printf ${forbiddenSecret}`,
              recoveryCode: forbiddenSecret,
            },
          },
          {
            type: "tool_use",
            id: "toolu_forbidden_list_1",
            name: "ListMcpResourcesTool",
            input: { recoveryCode: forbiddenSecret },
          },
          {
            type: "tool_use",
            id: "toolu_forbidden_other_mcp_1",
            name: "mcp__untrusted_server__world_content",
            input: { token: forbiddenSecret },
          },
        ],
      },
    }];
    writeFileSync(inputPath, `${stream.map((entry) => JSON.stringify(entry)).join("\n")}\n`, "utf8");

    const result = spawnSync(process.execPath, [extractorPath, "--input", inputPath, "--output", outputPath], {
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
    });

    assert.equal(result.status, 1);
    assert.equal(result.stdout, "");
    assert.equal(result.stderr.includes(forbiddenSecret), false);
    assert.equal(existsSync(outputPath), false);
    const summary = JSON.parse(result.stderr.trim());
    assert.deepEqual(summary, {
      ok: false,
      error: "unauthorized_non_game_tool_calls",
      unauthorizedToolNames: [
        "Bash",
        "ListMcpResourcesTool",
        "mcp__untrusted_server__world_content",
      ],
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Phase 6 CDE extractor fails closed on unauthorized tools from the Obsidian Epoch MCP service", () => {
  const root = mkdtempSync(join(tmpdir(), "phase6-cde-stream-jsonl-"));
  try {
    const inputPath = join(root, "synthetic-same-service-unauthorized-stream.jsonl");
    const outputPath = join(root, "phase6-tools.jsonl");
    const sameServiceSecret = "SAME_SERVICE_UNAUTHORIZED_SECRET";
    const stream = [{
      type: "assistant",
      timestamp: "2026-07-21T08:05:00.000Z",
      message: {
        role: "assistant",
        content: [{
          type: "tool_use",
          id: "toolu_same_service_forbidden_1",
          name: `${currentMcpPrefix}obsidian_epoch_register_explorer_compact`,
          input: { recoveryCode: sameServiceSecret },
        }],
      },
    }];
    writeFileSync(inputPath, `${stream.map((entry) => JSON.stringify(entry)).join("\n")}\n`, "utf8");

    const result = spawnSync(process.execPath, [extractorPath, "--input", inputPath, "--output", outputPath], {
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
    });

    assert.equal(result.status, 1);
    assert.equal(result.stdout, "");
    assert.equal(result.stderr.includes(sameServiceSecret), false);
    assert.equal(result.stderr.includes("recoveryCode"), false);
    assert.equal(existsSync(outputPath), false);
    assert.deepEqual(JSON.parse(result.stderr.trim()), {
      ok: false,
      error: "unauthorized_non_game_tool_calls",
      unauthorizedToolNames: [
        `${currentMcpPrefix}obsidian_epoch_register_explorer_compact`,
      ],
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
