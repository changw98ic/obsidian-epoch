import assert from "node:assert/strict";
import test from "node:test";
import {
  buildMcpSamplingCreateMessageParams,
  McpSamplingSchemaError,
  parseJourneySamplingResult,
} from "../lib/mcpSamplingSchemas.ts";

function validResult(decision: Record<string, unknown> = {}) {
  return {
    role: "assistant",
    content: {
      type: "text",
      text: JSON.stringify({
        actionOptionId: "option_safe_work",
        rationale: "符合低风险委托",
        confidence: 0.8,
        ...decision,
      }),
    },
    model: "host-model",
    stopReason: "endTurn",
  };
}

function assertSchemaError(action: () => unknown, code: string) {
  assert.throws(action, (error: unknown) => {
    assert.ok(error instanceof McpSamplingSchemaError);
    assert.equal(error.code, code);
    return true;
  });
}

test("builds bounded text-only createMessage params with context disabled", () => {
  const params = buildMcpSamplingCreateMessageParams({
    messages: [{ role: "user", text: "只从合法选项中选择" }],
    systemPrompt: "输出严格 JSON",
    maxTokens: 256,
    modelPreferences: { intelligencePriority: 0.8 },
  });
  assert.equal(params.includeContext, "none");
  assert.equal(params.maxTokens, 256);
  assert.deepEqual(params.messages, [{
    role: "user",
    content: { type: "text", text: "只从合法选项中选择" },
  }]);
  assert.equal(JSON.stringify(params).includes("metadata"), false);
});

test("request builder rejects oversized, non-text, and out-of-range inputs", () => {
  assertSchemaError(() => buildMcpSamplingCreateMessageParams({ messages: [] }), "sampling_request_invalid");
  assertSchemaError(() => buildMcpSamplingCreateMessageParams({
    messages: [{ role: "user", text: "x".repeat(4_001) }],
  }), "sampling_request_invalid");
  assertSchemaError(() => buildMcpSamplingCreateMessageParams({
    messages: [{ role: "user", text: "ok" }],
    maxTokens: 9_999,
  }), "sampling_request_invalid");
  assertSchemaError(() => buildMcpSamplingCreateMessageParams({
    messages: [{ role: "user", text: "ok" }],
    temperature: 3,
  }), "sampling_request_invalid");
});

test("parses a strict text JSON decision and keeps model metadata audit-only", () => {
  const parsed = parseJourneySamplingResult(validResult({ userFacingMessage: "我去找份稳妥的活。" }));
  assert.deepEqual(parsed.decision, {
    actionOptionId: "option_safe_work",
    rationale: "符合低风险委托",
    userFacingMessage: "我去找份稳妥的活。",
    confidence: 0.8,
  });
  assert.deepEqual(parsed.audit, { model: "host-model", stopReason: "endTurn" });
  assert.equal("model" in parsed.decision, false);
});

test("rejects image, array content, markdown fences, extra fields, and oversize results", () => {
  assertSchemaError(() => parseJourneySamplingResult({ role: "assistant", content: { type: "image", data: "x" } }), "sampling_result_not_text");
  assertSchemaError(() => parseJourneySamplingResult({ role: "assistant", content: [] }), "sampling_result_not_text");
  assertSchemaError(() => parseJourneySamplingResult({
    ...validResult(),
    content: { type: "text", text: "```json\n{}\n```" },
  }), "sampling_result_invalid");
  assertSchemaError(() => parseJourneySamplingResult({ ...validResult(), reward: 100 }), "sampling_result_invalid");
  assertSchemaError(() => parseJourneySamplingResult(validResult({ outcome: "win" })), "sampling_result_invalid");
  assertSchemaError(() => parseJourneySamplingResult({
    ...validResult(),
    content: { type: "text", text: "x".repeat(4_097) },
  }), "sampling_result_too_large");
});

test("rejects invalid action ids, confidence, and non-JSON text", () => {
  assertSchemaError(() => parseJourneySamplingResult(validResult({ actionOptionId: "" })), "sampling_result_invalid");
  assertSchemaError(() => parseJourneySamplingResult(validResult({ confidence: 2 })), "sampling_result_invalid");
  assertSchemaError(() => parseJourneySamplingResult({
    ...validResult(),
    content: { type: "text", text: "choose option_safe_work" },
  }), "sampling_result_invalid");
});
