import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { createAgentWorldMcpRuntime } from "../lib/mcpTools.ts";
import { loadDefaultWorldContentRegistry } from "../lib/epoch/worldContentRegistry.ts";
import { Qwen3EmbeddingClient } from "../lib/qwenEmbeddingClient.ts";
import {
  indexCanonicalResultPageForWorldMemory,
  initializeWorldMemorySchema,
  WORLD_MEMORY_EMBEDDING_DIMENSION,
} from "../lib/worldMemoryIndex.ts";
import { createWorldMemoryRuntime, worldMemoryRuntimeConfigFromEnv } from "../lib/worldMemoryRuntime.ts";

function vectorForText(text: string) {
  const values = new Array<number>(WORLD_MEMORY_EMBEDDING_DIMENSION).fill(0);
  values[text.includes("量子") ? 0 : 1] = 1;
  return values;
}

function storyPage() {
  return {
    pageId: "page_runtime_memory",
    createdAt: "2026-07-16T00:00:00.000Z",
    urlPath: "/epoch/result/page_runtime_memory",
    payload: {
      journey: {
        journeyId: "journey_runtime_memory",
        regionId: "quantum_lab",
        startedAtWorldTime: "0001-01-01T00:00:00.000Z",
        dueAtWorldTime: "0001-01-02T00:00:00.000Z",
        worldCommit: { status: "solidified" },
        storyReport: {
          kind: "grounded_story_report",
          title: "量子实验",
          summary: "量子实验获得成功。",
          profile: { identity: "助理", objective: "完成实验" },
          storyElements: { place: "量子实验室", result: "样本稳定" },
          evaluation: { worldCommit: { summary: "实验成为正式历史。" } },
          chapters: [{ title: "实验", text: "你修复量子设备并完成观测。" }],
          sourceEventIds: ["event_runtime_memory"],
        },
      },
    },
  };
}

test("world memory runtime embeds pending canon chunks and serves MCP hybrid retrieval", async () => {
  const tempDir = await mkdtemp(path.join(tmpdir(), "epoch-world-memory-runtime-"));
  const dbPath = path.join(tempDir, "agent-world.sqlite");
  const db = new DatabaseSync(dbPath);
  try {
    initializeWorldMemorySchema(db);
    indexCanonicalResultPageForWorldMemory(db, storyPage());
  } finally {
    db.close();
  }
  try {
    const embeddingRequests: string[][] = [];
    const client = new Qwen3EmbeddingClient({
      baseUrl: "http://192.168.1.8:1234",
      maxAttempts: 1,
      fetchImpl: async (_input, init) => {
        const body = JSON.parse(String(init?.body)) as { input: string[] };
        embeddingRequests.push(body.input);
        return new Response(JSON.stringify({
          model: "qwen3-embedding-8b",
          data: body.input.map((text, index) => ({ index, embedding: vectorForText(text) })),
        }), { status: 200, headers: { "content-type": "application/json" } });
      },
    });
    const runtime = createWorldMemoryRuntime(
      worldMemoryRuntimeConfigFromEnv(dbPath, {
        AGENT_SERVER_EMBEDDING_BASE_URL: "http://192.168.1.8:1234",
        AGENT_SERVER_WORLD_MEMORY_BATCH_SIZE: "8",
      }),
      { client },
    );
    await runtime.runOnce();
    assert.equal(runtime.status().ready, 2);
    assert.equal(runtime.status().pending, 0);

    const mcp = createAgentWorldMcpRuntime({ worldMemorySearch: runtime.search });
    assert.ok(mcp.listTools().some((tool) => tool.name === "obsidian_epoch.world_memory"));
    const result = await mcp.callTool("obsidian_epoch.world_memory", {
      query: "量子研究",
      regionId: "quantum_lab",
      limit: 2,
    });
    const payload = JSON.parse(result.content[0]!.text) as {
      retrievalMode: string;
      hits: Array<{ journeyId: string; cosineSimilarity?: number }>;
    };
    assert.equal(payload.retrievalMode, "hybrid");
    assert.equal(payload.hits[0]?.journeyId, "journey_runtime_memory");
    assert.ok((payload.hits[0]?.cosineSimilarity || 0) > 0.99);

    const outsideTimeRange = await mcp.callTool("obsidian_epoch.world_memory", {
      query: "量子研究",
      regionId: "quantum_lab",
      fromWorldTime: "0001-01-03T00:00:00.000Z",
      limit: 2,
    });
    assert.equal((JSON.parse(outsideTimeRange.content[0]!.text) as { hits: unknown[] }).hits.length, 0);
    assert.equal(embeddingRequests.filter((inputs) =>
      inputs.every((input) => input.includes("模型身份探针"))).length, 1);
    assert.equal(embeddingRequests.filter((inputs) =>
      inputs.length === 1 && inputs[0] === "量子研究").length, 1);
    assert.equal(runtime.status().queryEmbeddingCacheEntries, 1);
    assert.ok(runtime.status().embeddingIdentityVerifiedAt);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("world memory skips the embedding endpoint when no semantic vectors are ready", async () => {
  const tempDir = await mkdtemp(path.join(tmpdir(), "epoch-world-memory-empty-semantic-"));
  const dbPath = path.join(tempDir, "agent-world.sqlite");
  const db = new DatabaseSync(dbPath);
  try {
    initializeWorldMemorySchema(db);
  } finally {
    db.close();
  }
  try {
    let requestCount = 0;
    const client = new Qwen3EmbeddingClient({
      baseUrl: "http://192.168.1.8:1234",
      maxAttempts: 1,
      fetchImpl: async () => {
        requestCount += 1;
        throw new Error("embedding endpoint must not be called");
      },
    });
    const runtime = createWorldMemoryRuntime(
      worldMemoryRuntimeConfigFromEnv(dbPath, { AGENT_SERVER_EMBEDDING_BASE_URL: "http://192.168.1.8:1234" }),
      { client },
    );
    const result = await runtime.search({ query: "尚未固化的故事" });
    assert.equal(result.retrievalMode, "lexical");
    assert.equal(result.hits.length, 0);
    assert.equal(requestCount, 0);
    runtime.stop();
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("world memory runtime degrades to lexical search without a LAN endpoint", async () => {
  const tempDir = await mkdtemp(path.join(tmpdir(), "epoch-world-memory-lexical-"));
  const dbPath = path.join(tempDir, "agent-world.sqlite");
  const db = new DatabaseSync(dbPath);
  try {
    initializeWorldMemorySchema(db);
    indexCanonicalResultPageForWorldMemory(db, storyPage());
  } finally {
    db.close();
  }
  try {
    const runtime = createWorldMemoryRuntime(worldMemoryRuntimeConfigFromEnv(dbPath, {}));
    const result = await runtime.search({ query: "量子实验" });
    assert.equal(result.retrievalMode, "lexical");
    assert.equal(result.semanticUnavailable, true);
    assert.ok(result.hits.length > 0);
    await assert.rejects(
      () => createAgentWorldMcpRuntime().callTool("obsidian_epoch.world_memory", { query: "量子实验" }),
      /world_memory_unavailable/u,
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("world memory runtime aborts LAN work and drains without blocking shutdown", async () => {
  const tempDir = await mkdtemp(path.join(tmpdir(), "epoch-world-memory-shutdown-"));
  const dbPath = path.join(tempDir, "agent-world.sqlite");
  const db = new DatabaseSync(dbPath);
  try {
    initializeWorldMemorySchema(db);
    indexCanonicalResultPageForWorldMemory(db, storyPage());
  } finally {
    db.close();
  }
  try {
    let requestStarted!: () => void;
    const started = new Promise<void>((resolve) => { requestStarted = resolve; });
    const client = new Qwen3EmbeddingClient({
      baseUrl: "http://192.168.1.8:1234",
      requestTimeoutMs: 30_000,
      maxAttempts: 3,
      fetchImpl: async (_input, init) => new Promise<Response>((_resolve, reject) => {
        requestStarted();
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("aborted", "AbortError"));
        }, { once: true });
      }),
    });
    const runtime = createWorldMemoryRuntime(
      worldMemoryRuntimeConfigFromEnv(dbPath, { AGENT_SERVER_EMBEDDING_BASE_URL: "http://192.168.1.8:1234" }),
      { client },
    );
    const active = runtime.runOnce();
    void active.catch(() => undefined);
    await started;
    runtime.stop();
    await runtime.drain();
    await assert.rejects(active, /qwen_embedding_client_closed/u);
    assert.equal(runtime.status().inFlight, false);
    assert.equal(runtime.status().failed, 2);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("world memory runtime reads embedding credentials from a secret file", async () => {
  const tempDir = await mkdtemp(path.join(tmpdir(), "epoch-world-memory-secret-"));
  const secretPath = path.join(tempDir, "embedding-key");
  try {
    await writeFile(secretPath, "lan-secret\n", { mode: 0o600 });
    const config = worldMemoryRuntimeConfigFromEnv(path.join(tempDir, "agent-world.sqlite"), {
      AGENT_SERVER_EMBEDDING_BASE_URL: "http://192.168.1.8:1234",
      AGENT_SERVER_EMBEDDING_API_KEY_FILE: secretPath,
    });
    assert.equal(config.embeddingApiKey, "lan-secret");
    assert.equal(config.embeddingModel, "text-embedding-qwen3-embedding-8b");
    assert.equal(config.verificationIntervalMs, 3_600_000);
    assert.equal(config.queryCacheTtlMs, 900_000);
    assert.equal(config.queryCacheMaxEntries, 128);
    assert.throws(() => worldMemoryRuntimeConfigFromEnv(path.join(tempDir, "conflict.sqlite"), {
      AGENT_SERVER_EMBEDDING_BASE_URL: "http://192.168.1.8:1234",
      AGENT_SERVER_EMBEDDING_API_KEY: "direct-secret",
      AGENT_SERVER_EMBEDDING_API_KEY_FILE: secretPath,
    }), /world_memory_embedding_api_key_source_conflict/u);
    const exposedSecretPath = path.join(tempDir, "embedding-key-exposed");
    await writeFile(exposedSecretPath, "exposed-secret\n", { mode: 0o644 });
    assert.throws(() => worldMemoryRuntimeConfigFromEnv(path.join(tempDir, "exposed.sqlite"), {
      AGENT_SERVER_EMBEDDING_BASE_URL: "http://192.168.1.8:1234",
      AGENT_SERVER_EMBEDDING_API_KEY_FILE: exposedSecretPath,
    }), /world_memory_embedding_api_key_file_permissions_invalid/u);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("world memory runtime indexes canonical knowledge and exposes MCP hybrid retrieval", async () => {
  const tempDir = await mkdtemp(path.join(tmpdir(), "epoch-world-knowledge-runtime-"));
  const dbPath = path.join(tempDir, "agent-world.sqlite");
  const full = loadDefaultWorldContentRegistry();
  const registry = {
    ...full,
    sourceHash: `sha256:${"e".repeat(64)}` as const,
    rules: [],
    systems: full.systems.slice(0, 1),
    species: [],
    factions: [],
    layers: [],
    places: [],
    routes: [],
  };
  try {
    const client = new Qwen3EmbeddingClient({
      baseUrl: "http://192.168.1.8:1234",
      maxAttempts: 1,
      fetchImpl: async (_input, init) => {
        const body = JSON.parse(String(init?.body)) as { input: string[] };
        return new Response(JSON.stringify({
          model: "qwen3-embedding-8b",
          data: body.input.map((text, index) => ({ index, embedding: vectorForText(text) })),
        }), { status: 200, headers: { "content-type": "application/json" } });
      },
    });
    const runtime = createWorldMemoryRuntime(
      worldMemoryRuntimeConfigFromEnv(dbPath, {
        AGENT_SERVER_EMBEDDING_BASE_URL: "http://192.168.1.8:1234",
        AGENT_SERVER_WORLD_MEMORY_BATCH_SIZE: "64",
        AGENT_SERVER_WORLD_MEMORY_BATCHES_PER_TICK: "32",
      }),
      { client, worldContentRegistry: registry },
    );
    await runtime.runOnce();
    assert.ok(runtime.status().knowledge.sources > 0);
    assert.equal(runtime.status().knowledge.pending, 0);
    assert.ok(runtime.status().knowledge.ready > 0);

    const mcp = createAgentWorldMcpRuntime({ worldKnowledgeSearch: runtime.searchKnowledge });
    assert.ok(mcp.listTools().some((tool) => tool.name === "obsidian_epoch.world_knowledge"));
    const response = await mcp.callTool("obsidian_epoch.world_knowledge", {
      query: registry.systems[0]!.label,
      collection: "systems",
      limit: 2,
    });
    const payload = JSON.parse(response.content[0]!.text) as {
      retrievalMode: string;
      hits: Array<{ entityId: string }>;
    };
    assert.equal(payload.retrievalMode, "hybrid");
    assert.equal(payload.hits[0]?.entityId, registry.systems[0]!.id);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
