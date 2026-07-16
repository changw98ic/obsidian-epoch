import assert from "node:assert/strict";
import test from "node:test";
import { Qwen3EmbeddingClient } from "../lib/qwenEmbeddingClient.ts";
import { WORLD_MEMORY_EMBEDDING_DIMENSION } from "../lib/worldMemoryIndex.ts";

function vectorAt(axis: number, dimensions = WORLD_MEMORY_EMBEDDING_DIMENSION) {
  const vector = new Array<number>(dimensions).fill(0);
  vector[axis % dimensions] = 1;
  return vector;
}

test("Qwen LAN client isolates fixed behavior probes from variable application batches", async () => {
  const requests: Array<{ url: string; authorization?: string; body: Record<string, unknown> }> = [];
  const client = new Qwen3EmbeddingClient({
    baseUrl: "http://192.168.1.8:1234/v1",
    apiKey: "lan-secret",
    maxAttempts: 1,
    fetchImpl: async (input, init) => {
      const body = JSON.parse(String(init?.body)) as { model: string; input: string[] };
      const headers = new Headers(init?.headers);
      requests.push({
        url: String(input),
        authorization: headers.get("authorization") || undefined,
        body,
      });
      return new Response(JSON.stringify({
        model: "qwen3-embedding-8b",
        data: body.input.map((_, index) => ({
          object: "embedding",
          index,
          embedding: vectorAt(index),
        })).reverse(),
      }), { status: 200, headers: { "content-type": "application/json" } });
    },
  });

  const result = await client.embedAllVerifyingBehavior(["量子实验"]);
  assert.equal(requests.length, 2);
  assert.equal(requests[0]?.url, "http://192.168.1.8:1234/v1/embeddings");
  assert.equal(requests[0]?.authorization, "Bearer lan-secret");
  assert.equal(requests[0]?.body.model, "qwen3-embedding-8b");
  assert.deepEqual(requests[0]?.body.input, ["量子实验"]);
  assert.equal(requests[1]?.url, "http://192.168.1.8:1234/v1/embeddings");
  assert.equal(requests[1]?.authorization, "Bearer lan-secret");
  assert.equal(requests[1]?.body.model, "qwen3-embedding-8b");
  assert.equal((requests[1]?.body.input as string[]).length, 2);
  assert.equal(result.embeddings.length, 1);
  assert.equal(result.embeddings[0]?.length, WORLD_MEMORY_EMBEDDING_DIMENSION);
  assert.equal(result.behaviorEmbeddings.length, 2);
  assert.equal(result.behaviorEmbeddings[0]?.length, WORLD_MEMORY_EMBEDDING_DIMENSION);
  assert.match(result.behaviorFingerprint, /^sha256:[a-f0-9]{64}$/u);
});

test("Qwen LAN client rejects wrong dimensions and wrong model identity", async () => {
  const wrongDimension = new Qwen3EmbeddingClient({
    baseUrl: "http://127.0.0.1:1234",
    maxAttempts: 1,
    fetchImpl: async () => new Response(JSON.stringify({
      model: "qwen3-embedding-8b",
      data: [{ index: 0, embedding: vectorAt(0, 768) }],
    }), { status: 200 }),
  });
  await assert.rejects(() => wrongDimension.embedAll(["text"]), /qwen_embedding_dimension_mismatch:768/u);

  const wrongModel = new Qwen3EmbeddingClient({
    baseUrl: "http://127.0.0.1:1234",
    maxAttempts: 1,
    fetchImpl: async () => new Response(JSON.stringify({
      model: "another-model",
      data: [{ index: 0, embedding: vectorAt(0) }],
    }), { status: 200 }),
  });
  await assert.rejects(() => wrongModel.embedAll(["text"]), /qwen_embedding_response_invalid/u);
});

test("Qwen LAN client refuses non-4096 contracts", () => {
  assert.throws(() => new Qwen3EmbeddingClient({
    baseUrl: "http://127.0.0.1:1234",
    expectedDimensions: 768,
  }), /qwen_embedding_dimension_contract_invalid/u);
});

test("Qwen LAN client aborts in-flight requests when closed", async () => {
  let aborted = false;
  const client = new Qwen3EmbeddingClient({
    baseUrl: "http://127.0.0.1:1234",
    requestTimeoutMs: 30_000,
    maxAttempts: 3,
    fetchImpl: async (_input, init) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => {
        aborted = true;
        reject(new DOMException("aborted", "AbortError"));
      }, { once: true });
    }),
  });

  const pending = client.embedAll(["text"]);
  void pending.catch(() => undefined);
  client.close();
  await assert.rejects(pending, /qwen_embedding_client_closed/u);
  assert.equal(aborted, true);
  await assert.rejects(() => client.embedAll(["text"]), /qwen_embedding_client_closed/u);
});
