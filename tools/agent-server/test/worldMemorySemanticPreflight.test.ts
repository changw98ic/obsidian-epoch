import assert from "node:assert/strict";
import test from "node:test";
import { WORLD_MEMORY_EMBEDDING_DIMENSION } from "../lib/worldMemoryIndex.ts";
import { runWorldMemorySemanticPreflight } from "../world-memory-semantic-preflight.ts";

test("semantic preflight explains that an embedding endpoint is required", async () => {
  const result = await runWorldMemorySemanticPreflight({
    dbPath: "/tmp/world-memory-semantic-preflight.sqlite",
    env: {},
  });

  assert.deepEqual(result, {
    ok: false,
    semanticEnabled: false,
    code: "semantic_embedding_base_url_missing",
    endpointModel: "text-embedding-qwen3-embedding-8b",
    dimension: WORLD_MEMORY_EMBEDDING_DIMENSION,
  });
});

test("semantic preflight verifies a configured embedding client without exposing its endpoint", async () => {
  let closed = false;
  const result = await runWorldMemorySemanticPreflight({
    dbPath: "/tmp/world-memory-semantic-preflight.sqlite",
    env: {
      AGENT_SERVER_EMBEDDING_BASE_URL: "http://192.168.1.8:1234",
    },
    clientFactory: () => ({
      verifyBehavior: async () => ({
        behaviorEmbeddings: [
          new Array<number>(WORLD_MEMORY_EMBEDDING_DIMENSION).fill(0),
          new Array<number>(WORLD_MEMORY_EMBEDDING_DIMENSION).fill(0),
        ],
        behaviorFingerprint: `sha256:${"a".repeat(64)}`,
      }),
      close: () => {
        closed = true;
      },
    }),
  });

  assert.deepEqual(result, {
    ok: true,
    semanticEnabled: true,
    endpointModel: "text-embedding-qwen3-embedding-8b",
    dimension: WORLD_MEMORY_EMBEDDING_DIMENSION,
  });
  assert.equal(closed, true);
});

test("semantic preflight returns a stable provider error code", async () => {
  const result = await runWorldMemorySemanticPreflight({
    dbPath: "/tmp/world-memory-semantic-preflight.sqlite",
    env: {
      AGENT_SERVER_EMBEDDING_BASE_URL: "http://192.168.1.8:1234",
    },
    clientFactory: () => ({
      verifyBehavior: async () => {
        throw new Error("qwen_embedding_transport_error");
      },
      close: () => undefined,
    }),
  });

  assert.deepEqual(result, {
    ok: false,
    semanticEnabled: false,
    code: "qwen_embedding_transport_error",
    endpointModel: "text-embedding-qwen3-embedding-8b",
    dimension: WORLD_MEMORY_EMBEDDING_DIMENSION,
  });
});
