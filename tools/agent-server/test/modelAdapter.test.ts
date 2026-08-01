import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createModelAdapter,
  modelAdapterConfigFromEnv,
  ModelAdapterError,
} from "../lib/modelAdapter.ts";

function jsonResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("modelAdapterConfigFromEnv", () => {
  it("returns undefined when no text-generation provider is configured", () => {
    assert.equal(modelAdapterConfigFromEnv({}), undefined);
  });

  it("configures an OpenAI-compatible endpoint without requiring a key", () => {
    const config = modelAdapterConfigFromEnv({
      AGENT_SERVER_MODEL_PROVIDER: "openai-compatible",
      AGENT_SERVER_MODEL_BASE_URL: "http://127.0.0.1:1234/v1",
      AGENT_SERVER_MODEL_NAME: "qwen-local",
      AGENT_SERVER_MODEL_TIMEOUT_MS: "4500",
    });
    assert.deepEqual(config, {
      provider: "openai_compatible",
      baseUrl: "http://127.0.0.1:1234/v1",
      model: "qwen-local",
      timeoutMs: 4500,
    });
  });

  it("uses the old Anthropic variable only at the Anthropic provider boundary", () => {
    const config = modelAdapterConfigFromEnv({ ANTHROPIC_API_KEY: "secret" });
    assert.equal(config?.provider, "anthropic");
    assert.equal(config?.apiKey, "secret");
  });

  it("requires a base URL and model for OpenAI-compatible providers", () => {
    assert.throws(
      () => modelAdapterConfigFromEnv({ AGENT_SERVER_MODEL_PROVIDER: "openai_compatible" }),
      (error: unknown) => error instanceof ModelAdapterError && error.code === "model_adapter_base_url_required",
    );
    assert.throws(
      () => modelAdapterConfigFromEnv({
        AGENT_SERVER_MODEL_PROVIDER: "openai_compatible",
        AGENT_SERVER_MODEL_BASE_URL: "http://127.0.0.1:1234",
      }),
      (error: unknown) => error instanceof ModelAdapterError && error.code === "model_adapter_model_required",
    );
  });
});

describe("HttpModelAdapter", () => {
  it("sends OpenAI-compatible chat requests and parses text content", async () => {
    let requestUrl = "";
    let requestInit: RequestInit | undefined;
    const adapter = createModelAdapter({
      provider: "openai_compatible",
      baseUrl: "http://model.test:1234/v1",
      model: "qwen-local",
      apiKey: "secret",
      fetchImpl: async (input, init) => {
        requestUrl = String(input);
        requestInit = init;
        return jsonResponse({
          model: "qwen-local",
          choices: [{
            message: { role: "assistant", content: "[{\"ok\":true}]" },
            finish_reason: "stop",
          }],
        });
      },
    });

    const result = await adapter.complete({
      systemPrompt: "Return JSON only.",
      messages: [{ role: "user", content: "继续。" }],
      maxTokens: 128,
      responseFormat: "json_object",
    });

    assert.equal(new URL(requestUrl).pathname, "/v1/chat/completions");
    const headers = new Headers(requestInit?.headers);
    assert.equal(headers.get("authorization"), "Bearer secret");
    const body = JSON.parse(String(requestInit?.body)) as {
      readonly model: string;
      readonly messages: readonly { readonly role: string; readonly content: string }[];
      readonly stream: boolean;
      readonly response_format?: { readonly type: string };
    };
    assert.equal(body.model, "qwen-local");
    assert.equal(body.stream, true);
    assert.deepEqual(body.messages, [
      { role: "system", content: "Return JSON only." },
      { role: "user", content: "继续。" },
    ]);
    assert.deepEqual(body.response_format, { type: "json_object" });
    assert.equal(result.text, "[{\"ok\":true}]");
    assert.equal(result.stopReason, "stop");
  });

  it("sends Anthropic messages requests and parses text blocks", async () => {
    let requestUrl = "";
    let requestInit: RequestInit | undefined;
    const adapter = createModelAdapter({
      provider: "anthropic",
      baseUrl: "https://anthropic.test",
      model: "claude-test",
      apiKey: "secret",
      fetchImpl: async (input, init) => {
        requestUrl = String(input);
        requestInit = init;
        return jsonResponse({
          model: "claude-test",
          content: [{ type: "text", text: "好的" }],
          stop_reason: "end_turn",
        });
      },
    });

    const result = await adapter.complete({
      systemPrompt: "只返回事实。",
      messages: [{ role: "user", content: "讲述结果。" }],
      maxTokens: 64,
    });

    assert.equal(new URL(requestUrl).pathname, "/v1/messages");
    const headers = new Headers(requestInit?.headers);
    assert.equal(headers.get("x-api-key"), "secret");
    assert.equal(headers.get("anthropic-version"), "2023-06-01");
    const body = JSON.parse(String(requestInit?.body)) as {
      readonly system: string;
      readonly messages: readonly { readonly role: string; readonly content: string }[];
      readonly stream: boolean;
    };
    assert.equal(body.system, "只返回事实。");
    assert.equal(body.stream, true);
    assert.deepEqual(body.messages, [{ role: "user", content: "讲述结果。" }]);
    assert.equal(result.text, "好的");
    assert.equal(result.stopReason, "end_turn");
  });

  it("accepts array text blocks from OpenAI-compatible responses", async () => {
    const adapter = createModelAdapter({
      provider: "openai_compatible",
      baseUrl: "http://model.test/v1/chat/completions",
      model: "local",
      fetchImpl: async () => jsonResponse({
        choices: [{ message: { content: [{ type: "text", text: "甲" }, { type: "text", text: "乙" }] } }],
      }),
    });
    const result = await adapter.complete({
      messages: [{ role: "user", content: "合并" }],
      maxTokens: 32,
    });
    assert.equal(result.text, "甲乙");
  });

  it("streams Anthropic thinking and text deltas, returning only final text", async () => {
    let requestInit: RequestInit | undefined;
    const adapter = createModelAdapter({
      provider: "anthropic",
      baseUrl: "https://anthropic.test",
      model: "claude-test",
      apiKey: "secret",
      fetchImpl: async (_input, init) => {
        requestInit = init;
        return new Response([
          "event: message_start",
          'data: {"type":"message_start"}',
          "",
          "event: content_block_delta",
          'data: {"type":"content_block_delta","delta":{"type":"thinking_delta","thinking":"内部思考"}}',
          "",
          "event: content_block_delta",
          'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"好的"}}',
          "",
          "event: message_delta",
          'data: {"type":"message_delta","delta":{"stop_reason":"end_turn"}}',
          "",
        ].join("\n"), {
          headers: { "content-type": "text/event-stream" },
        });
      },
    });

    const result = await adapter.complete({
      messages: [{ role: "user", content: "讲述结果。" }],
    });

    const body = JSON.parse(String(requestInit?.body)) as { readonly stream: boolean; readonly max_tokens?: number };
    assert.equal(body.stream, true);
    assert.equal("max_tokens" in body, false);
    assert.equal(result.text, "好的");
    assert.equal(result.stopReason, "end_turn");
  });

  it("uses a streaming text-producing warmup request without an app cap", async () => {
    let requestBody: { readonly max_tokens?: number; readonly stream?: boolean; readonly system?: string } | undefined;
    const adapter = createModelAdapter({
      provider: "anthropic",
      baseUrl: "https://anthropic.test",
      model: "claude-test",
      apiKey: "secret",
      fetchImpl: async (_input, init) => {
        requestBody = JSON.parse(String(init?.body)) as { readonly max_tokens?: number; readonly stream?: boolean; readonly system?: string };
        return jsonResponse({ content: [{ type: "text", text: "OK" }] });
      },
    });
    await adapter.warmup();
    assert.equal(requestBody?.max_tokens, undefined);
    assert.equal(requestBody?.stream, true);
    assert.equal(requestBody?.system, "Warmup only. Reply with OK.");
  });

  it("returns stable error codes without exposing provider response bodies", async () => {
    const adapter = createModelAdapter({
      provider: "openai_compatible",
      baseUrl: "http://model.test",
      model: "local",
      fetchImpl: async () => new Response("secret-provider-body", { status: 401 }),
    });
    await assert.rejects(
      () => adapter.complete({ messages: [{ role: "user", content: "请求" }], maxTokens: 32 }),
      (error: unknown) => error instanceof ModelAdapterError
        && error.code === "model_adapter_http_401"
        && !error.message.includes("secret-provider-body"),
    );
  });
});
