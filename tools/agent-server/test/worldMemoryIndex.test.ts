import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  bindOrValidateWorldMemoryProfile,
  cjkWorldMemoryTokens,
  claimWorldMemoryChunks,
  completeWorldMemoryChunkEmbeddings,
  createWorldMemoryEmbeddingProfile,
  decodeWorldMemoryVector,
  encodeWorldMemoryVector,
  indexCanonicalResultPageForWorldMemory,
  initializeWorldMemorySchema,
  normalizeWorldMemoryVector,
  searchWorldMemory,
  synchronizeWorldMemoryFromResultPages,
  WORLD_MEMORY_EMBEDDING_DIMENSION,
  worldMemoryIndexStatus,
} from "../lib/worldMemoryIndex.ts";

function vectorAt(axis: number) {
  const vector = new Array<number>(WORLD_MEMORY_EMBEDDING_DIMENSION).fill(0);
  vector[axis] = 1;
  return vector;
}

function vectorAtCosine(axis: number, cosine: number) {
  const vector = new Array<number>(WORLD_MEMORY_EMBEDDING_DIMENSION).fill(0);
  vector[axis] = cosine;
  vector[(axis + 1) % vector.length] = Math.sqrt(1 - cosine ** 2);
  return vector;
}

function canonicalStoryPage(overrides: Record<string, unknown> = {}) {
  return {
    pageId: "page_world_memory_1",
    shareVersion: 1,
    status: "active",
    createdAt: "2026-07-16T00:00:00.000Z",
    urlPath: "/epoch/result/page_world_memory_1",
    payload: {
      journey: {
        journeyId: "journey_world_memory_1",
        regionId: "quantum_lab",
        startedAtWorldTime: "0001-01-01T00:00:00.000Z",
        dueAtWorldTime: "0001-01-05T00:00:00.000Z",
        worldCommit: { status: "solidified" },
        storyReport: {
          kind: "grounded_story_report",
          title: "第七码样本实验",
          summary: "你协助林铎完成了量子实验，并阻止样本失稳。",
          profile: { identity: "实验助理", objective: "完成入门实验并获得报酬" },
          storyElements: {
            time: "黑曜历元年一月一日至五日",
            place: "量子实验室",
            characters: ["你", "林铎"],
            result: "实验完成，样本留在实验室封存。",
          },
          evaluation: {
            worldCommit: { summary: "实验结果固化为量子实验室的历史记录。" },
            rewards: { summary: "获得金币 20、身份传说度 3。" },
            npcRelationships: [{ npcId: "npc_linduo", displayName: "林铎", scoreAfter: 12 }],
          },
          chapters: [{
            key: "encounter",
            title: "失稳前夜",
            text: "你在量子实验室检查第七码样本，发现冷却回路出现异常。你与林铎更换阀门，随后完成实验。",
          }],
          sourceEventIds: ["event_experiment_1"],
        },
        ...overrides,
      },
    },
  };
}

test("world memory admits only solidified complete story pages and indexes Chinese text", () => {
  const db = new DatabaseSync(":memory:");
  try {
    initializeWorldMemorySchema(db);
    const discarded = canonicalStoryPage({ worldCommit: { status: "discarded" } });
    assert.equal(indexCanonicalResultPageForWorldMemory(db, discarded), 0);
    assert.equal((db.prepare("SELECT COUNT(*) AS count FROM world_memory_chunks").get() as { count: number }).count, 0);

    assert.equal(indexCanonicalResultPageForWorldMemory(db, canonicalStoryPage()), 2);
    const lexical = db.prepare(`
      SELECT c.title
      FROM world_memory_cjk_fts
      JOIN world_memory_chunks AS c ON c.row_id = world_memory_cjk_fts.rowid
      WHERE world_memory_cjk_fts MATCH '"量子"'
    `).all() as { title: string }[];
    assert.ok(lexical.some((row) => row.title === "失稳前夜"));

    assert.equal(indexCanonicalResultPageForWorldMemory(db, { ...canonicalStoryPage(), status: "revoked" }), 0);
    assert.equal((db.prepare("SELECT COUNT(*) AS count FROM world_memory_chunks").get() as { count: number }).count, 0);

    assert.equal(indexCanonicalResultPageForWorldMemory(db, canonicalStoryPage()), 2);
    assert.equal(indexCanonicalResultPageForWorldMemory(db, {
      ...canonicalStoryPage(),
      expiresAt: "2000-01-01T00:00:00.000Z",
    }), 0);
    assert.equal((db.prepare("SELECT COUNT(*) AS count FROM world_memory_chunks").get() as { count: number }).count, 0);

    assert.equal(indexCanonicalResultPageForWorldMemory(db, canonicalStoryPage()), 2);
    assert.equal(indexCanonicalResultPageForWorldMemory(db, canonicalStoryPage({
      storyReport: { kind: "grounded_story_report" },
    })), 0);
    assert.equal((db.prepare("SELECT COUNT(*) AS count FROM world_memory_chunks").get() as { count: number }).count, 0);
  } finally {
    db.close();
  }
});

test("world memory stores exactly 4096 little-endian Float32 values", () => {
  const normalized = normalizeWorldMemoryVector(vectorAt(7));
  const encoded = encodeWorldMemoryVector(normalized);
  assert.equal(encoded.byteLength, 16_384);
  const decoded = decodeWorldMemoryVector(encoded);
  assert.equal(decoded.length, WORLD_MEMORY_EMBEDDING_DIMENSION);
  assert.equal(decoded[7], 1);
  assert.throws(() => normalizeWorldMemoryVector(new Array(768).fill(1)), /world_memory_embedding_dimension_invalid/u);
  assert.throws(() => normalizeWorldMemoryVector(new Array(WORLD_MEMORY_EMBEDDING_DIMENSION).fill(0)), /zero_vector/u);
});

test("world memory queue binds one embedding profile and performs hybrid retrieval", async () => {
  const tempDir = await mkdtemp(path.join(tmpdir(), "epoch-world-memory-"));
  const dbPath = path.join(tempDir, "agent-world.sqlite");
  const db = new DatabaseSync(dbPath);
  try {
    initializeWorldMemorySchema(db);
    indexCanonicalResultPageForWorldMemory(db, canonicalStoryPage());
  } finally {
    db.close();
  }
  try {
    const claims = claimWorldMemoryChunks(dbPath, 8);
    assert.equal(claims.length, 2);
    const vectors = claims.map((claim) => claim.content.includes("冷却回路") ? vectorAt(0) : vectorAt(1));
    const profile = createWorldMemoryEmbeddingProfile({ modelDigest: "a".repeat(64) });
    const behaviorVectors = [vectorAt(20), vectorAt(21)];
    completeWorldMemoryChunkEmbeddings(dbPath, claims, vectors, profile, behaviorVectors);
    assert.deepEqual(worldMemoryIndexStatus(dbPath), {
      chunks: 2,
      pending: 0,
      processing: 0,
      ready: 2,
      failed: 0,
      embeddingProfile: profile,
    });

    const result = searchWorldMemory(dbPath, {
      query: "完全不同的词法查询",
      queryEmbedding: vectorAt(0),
      embeddingProfile: profile,
      regionId: "quantum_lab",
      limit: 1,
    });
    assert.equal(result.retrievalMode, "hybrid");
    assert.equal(result.hits[0]?.title, "失稳前夜");
    assert.equal(result.hits[0]?.sourceEventIds[0], "event_experiment_1");
    assert.ok((result.hits[0]?.cosineSimilarity || 0) > 0.99);

    const driftProfile = createWorldMemoryEmbeddingProfile({ modelDigest: "b".repeat(64) });
    const driftCompatible = searchWorldMemory(dbPath, {
      query: "冷却回路",
      queryEmbedding: vectorAt(0),
      embeddingProfile: driftProfile,
      embeddingBehaviorVectors: [vectorAtCosine(20, 0.9992), vectorAtCosine(21, 0.9992)],
      regionId: "quantum_lab",
      limit: 1,
    });
    assert.equal(driftCompatible.retrievalMode, "hybrid");
    assert.equal(driftCompatible.hits[0]?.title, "失稳前夜");
    assert.throws(() => searchWorldMemory(dbPath, {
      query: "冷却回路",
      queryEmbedding: vectorAt(0),
      embeddingProfile: driftProfile,
      embeddingBehaviorVectors: [vectorAt(22), vectorAt(23)],
    }), /world_memory_embedding_profile_mismatch/u);
    assert.equal(searchWorldMemory(dbPath, {
      query: "量子实验",
      queryEmbedding: vectorAt(0),
      embeddingProfile: profile,
      fromWorldTime: "0001-01-06T00:00:00.000Z",
    }).hits.length, 0);

    const reopened = new DatabaseSync(dbPath);
    try {
      assert.throws(() => bindOrValidateWorldMemoryProfile(reopened, createWorldMemoryEmbeddingProfile({
        modelDigest: "b".repeat(64),
      })), /world_memory_embedding_profile_mismatch/u);
    } finally {
      reopened.close();
    }
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("CJK normalizer emits deterministic unigrams and bigrams", () => {
  assert.deepEqual(cjkWorldMemoryTokens("量子实验"), ["量", "量子", "子", "子实", "实", "实验", "验"]);
});

test("world memory synchronization repairs missing derived chunks from canonical result pages", async () => {
  const tempDir = await mkdtemp(path.join(tmpdir(), "epoch-world-memory-repair-"));
  const dbPath = path.join(tempDir, "agent-world.sqlite");
  try {
    const db = new DatabaseSync(dbPath);
    try {
      initializeWorldMemorySchema(db);
      db.exec("CREATE TABLE result_pages (page_id TEXT PRIMARY KEY, page_json TEXT NOT NULL)");
      db.prepare("INSERT INTO result_pages(page_id, page_json) VALUES (?, ?)")
        .run("page_world_memory_1", JSON.stringify({
          ...canonicalStoryPage(),
          expiresAt: "2099-01-01T00:00:00.000Z",
        }));
    } finally {
      db.close();
    }

    assert.deepEqual(synchronizeWorldMemoryFromResultPages(dbPath), { pages: 1, chunks: 2 });
    const damaged = new DatabaseSync(dbPath);
    try {
      damaged.prepare("DELETE FROM world_memory_chunks WHERE chunk_index = 1").run();
      damaged.prepare("UPDATE world_memory_chunks SET source_expires_at = NULL").run();
      damaged.prepare("UPDATE world_memory_sources SET expires_at = NULL").run();
    } finally {
      damaged.close();
    }
    assert.equal(worldMemoryIndexStatus(dbPath).chunks, 1);
    assert.deepEqual(synchronizeWorldMemoryFromResultPages(dbPath), { pages: 1, chunks: 2 });
    assert.equal(worldMemoryIndexStatus(dbPath).chunks, 2);
    assert.equal(searchWorldMemory(dbPath, { query: "量子实验" }, {
      now: new Date("2099-01-01T00:00:00.000Z"),
    }).hits.length, 0);
    const withoutCanonicalSource = new DatabaseSync(dbPath);
    try {
      withoutCanonicalSource.exec("DELETE FROM result_pages");
    } finally {
      withoutCanonicalSource.close();
    }
    assert.deepEqual(synchronizeWorldMemoryFromResultPages(dbPath), { pages: 0, chunks: 0 });
    assert.equal(worldMemoryIndexStatus(dbPath).chunks, 0);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("world memory search excludes a source as soon as server time passes its expiry", async () => {
  const tempDir = await mkdtemp(path.join(tmpdir(), "epoch-world-memory-expiry-"));
  const dbPath = path.join(tempDir, "agent-world.sqlite");
  try {
    const db = new DatabaseSync(dbPath);
    try {
      initializeWorldMemorySchema(db);
      indexCanonicalResultPageForWorldMemory(db, {
        ...canonicalStoryPage(),
        expiresAt: "2099-01-01T00:00:00.000Z",
      });
    } finally {
      db.close();
    }
    assert.ok(searchWorldMemory(dbPath, { query: "量子实验" }, {
      now: new Date("2098-12-31T23:59:59.999Z"),
    }).hits.length > 0);
    assert.equal(searchWorldMemory(dbPath, { query: "量子实验" }, {
      now: new Date("2099-01-01T00:00:00.000Z"),
    }).hits.length, 0);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
