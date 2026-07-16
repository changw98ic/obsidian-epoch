import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { loadDefaultWorldContentRegistry } from "../lib/epoch/worldContentRegistry.ts";
import {
  claimWorldKnowledgeChunks,
  completeWorldKnowledgeChunkEmbeddings,
  searchWorldKnowledge,
  synchronizeWorldKnowledgeRegistry,
  worldKnowledgeDocuments,
  worldKnowledgeIndexStatus,
} from "../lib/worldKnowledgeIndex.ts";
import {
  createWorldMemoryEmbeddingProfile,
  WORLD_MEMORY_EMBEDDING_DIMENSION,
} from "../lib/worldMemoryIndex.ts";

function vectorAt(axis: number) {
  const vector = new Array<number>(WORLD_MEMORY_EMBEDDING_DIMENSION).fill(0);
  vector[axis] = 1;
  return vector;
}

test("canonical world registry becomes a rebuildable lexical knowledge index", async () => {
  const tempDir = await mkdtemp(path.join(tmpdir(), "epoch-world-knowledge-"));
  const dbPath = path.join(tempDir, "agent-world.sqlite");
  const registry = loadDefaultWorldContentRegistry();
  try {
    const documents = worldKnowledgeDocuments(registry);
    assert.equal(documents.length, 122);
    const synchronized = synchronizeWorldKnowledgeRegistry(dbPath, registry);
    assert.equal(synchronized.sources, 122);
    assert.ok(synchronized.chunks >= 122);
    assert.deepEqual(worldKnowledgeIndexStatus(dbPath), {
      sources: 122,
      chunks: synchronized.chunks,
      pending: synchronized.chunks,
      processing: 0,
      ready: 0,
      failed: 0,
      registrySourceHash: registry.sourceHash,
    });

    const faction = searchWorldKnowledge(dbPath, {
      query: "圣银审判庭",
      collection: "factions",
      limit: 3,
    });
    assert.equal(faction.retrievalMode, "lexical");
    assert.equal(faction.hits[0]?.entityId, "faction_silver_inquisition");
    assert.match(faction.hits[0]?.sourcePath || "", /^03_势力组织\//u);

    const regional = searchWorldKnowledge(dbPath, {
      query: "灰港 交易 路线",
      regionId: "region_gray_harbor",
      limit: 20,
    });
    assert.ok(regional.hits.length > 0);
    assert.ok(regional.hits.every((hit) => hit.regionIds.length === 0
      || hit.regionIds.includes("region_gray_harbor")));

    const secondSync = synchronizeWorldKnowledgeRegistry(dbPath, registry);
    assert.equal(secondSync.chunks, synchronized.chunks);
    assert.equal(worldKnowledgeIndexStatus(dbPath).pending, synchronized.chunks);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("world knowledge stores 4096-dimensional vectors and performs hybrid retrieval", async () => {
  const tempDir = await mkdtemp(path.join(tmpdir(), "epoch-world-knowledge-vector-"));
  const dbPath = path.join(tempDir, "agent-world.sqlite");
  const full = loadDefaultWorldContentRegistry();
  const registry = {
    ...full,
    sourceHash: `sha256:${"c".repeat(64)}` as const,
    rules: full.rules.slice(0, 1),
    systems: [],
    species: [],
    factions: [],
    layers: [],
    places: [],
    routes: [],
  };
  try {
    synchronizeWorldKnowledgeRegistry(dbPath, registry);
    const claims = claimWorldKnowledgeChunks(dbPath, 64);
    assert.ok(claims.length > 0);
    completeWorldKnowledgeChunkEmbeddings(
      dbPath,
      claims,
      claims.map((claim) => claim.content.includes("世界") ? vectorAt(0) : vectorAt(1)),
      createWorldMemoryEmbeddingProfile({ modelDigest: "d".repeat(64) }),
      [vectorAt(20), vectorAt(21)],
    );
    const status = worldKnowledgeIndexStatus(dbPath);
    assert.equal(status.ready, claims.length);
    assert.equal(status.pending, 0);

    const result = searchWorldKnowledge(dbPath, {
      query: "完全不同的词法查询",
      queryEmbedding: vectorAt(0),
      embeddingProfile: createWorldMemoryEmbeddingProfile({ modelDigest: "d".repeat(64) }),
      embeddingBehaviorVectors: [vectorAt(20), vectorAt(21)],
      limit: 1,
    });
    assert.equal(result.retrievalMode, "hybrid");
    assert.ok((result.hits[0]?.cosineSimilarity || 0) > 0.99);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
