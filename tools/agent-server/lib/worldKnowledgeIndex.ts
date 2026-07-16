import { createHash, randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import type {
  WorldContentEntry,
  WorldContentFaction,
  WorldContentPlace,
  WorldContentRegistry,
  WorldContentRoute,
} from "./epoch/worldContentRegistry.ts";
import {
  bindOrValidateWorldMemoryProfile,
  cjkWorldMemoryTokens,
  decodeWorldMemoryVector,
  encodeWorldMemoryVector,
  initializeWorldMemorySchema,
  normalizeWorldMemoryVector,
  WORLD_MEMORY_EMBEDDING_DIMENSION,
  type WorldMemoryEmbeddingProfile,
} from "./worldMemoryIndex.ts";

type SqlValue = string | number | bigint | null | Uint8Array;

export type WorldKnowledgeCollection =
  | "rules"
  | "systems"
  | "species"
  | "factions"
  | "layers"
  | "places"
  | "routes";

export interface WorldKnowledgeSearchInput {
  readonly query: string;
  readonly collection?: WorldKnowledgeCollection;
  readonly entityId?: string;
  readonly regionId?: string;
  readonly limit?: number;
  readonly queryEmbedding?: readonly number[];
  readonly embeddingProfile?: WorldMemoryEmbeddingProfile;
  readonly embeddingBehaviorVectors?: readonly (readonly number[])[];
}

export interface WorldKnowledgeSearchHit {
  readonly chunkId: string;
  readonly sourceId: string;
  readonly collection: WorldKnowledgeCollection;
  readonly entityId: string;
  readonly label: string;
  readonly sourcePath: string;
  readonly regionIds: readonly string[];
  readonly content: string;
  readonly lexicalRank?: number;
  readonly vectorRank?: number;
  readonly cosineSimilarity?: number;
  readonly score: number;
}

export interface WorldKnowledgeSearchResult {
  readonly retrievalMode: "lexical" | "hybrid";
  readonly query: string;
  readonly filters: {
    readonly collection?: WorldKnowledgeCollection;
    readonly entityId?: string;
    readonly regionId?: string;
  };
  readonly hits: readonly WorldKnowledgeSearchHit[];
}

export interface ClaimedWorldKnowledgeChunk {
  readonly rowId: number;
  readonly chunkId: string;
  readonly content: string;
  readonly leaseToken: string;
}

export interface WorldKnowledgeIndexStatus {
  readonly sources: number;
  readonly chunks: number;
  readonly pending: number;
  readonly processing: number;
  readonly ready: number;
  readonly failed: number;
  readonly registrySourceHash?: string;
}

interface KnowledgeDocument {
  readonly sourceId: string;
  readonly collection: WorldKnowledgeCollection;
  readonly entityId: string;
  readonly label: string;
  readonly sourcePath: string;
  readonly regionIds: readonly string[];
  readonly content: string;
  readonly metadata: Readonly<Record<string, unknown>>;
}

interface KnowledgeChunkRow {
  readonly row_id: number;
  readonly chunk_id: string;
  readonly source_id: string;
  readonly collection: WorldKnowledgeCollection;
  readonly entity_id: string;
  readonly label: string;
  readonly source_path: string;
  readonly region_ids_json: string;
  readonly content: string;
}

const WORLD_KNOWLEDGE_SCHEMA_VERSION = 1;
const WORLD_KNOWLEDGE_SCHEMA_META_KEY = "knowledge_index_schema_version";
const WORLD_KNOWLEDGE_REGISTRY_META_KEY = "knowledge_registry_source_hash";
// The production LAN llama.cpp endpoint currently serves Qwen3-Embedding with
// n_ctx=512. A 600-character ceiling keeps mixed Chinese/ASCII source chunks
// inside that runtime window while retaining overlap across boundaries.
const WORLD_KNOWLEDGE_MAX_CHUNK_CHARACTERS = 600;
const WORLD_KNOWLEDGE_CHUNK_OVERLAP_CHARACTERS = 80;
const WORLD_KNOWLEDGE_COLLECTIONS: readonly WorldKnowledgeCollection[] = [
  "rules",
  "systems",
  "species",
  "factions",
  "layers",
  "places",
  "routes",
] as const;

function nowIso() {
  return new Date().toISOString();
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function openKnowledgeDb(dbPath: string) {
  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA busy_timeout = 5000");
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");
  initializeWorldMemorySchema(db);
  initializeWorldKnowledgeSchema(db);
  return db;
}

export function initializeWorldKnowledgeSchema(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS world_knowledge_sources (
      source_id TEXT PRIMARY KEY,
      collection TEXT NOT NULL
        CHECK (collection IN ('rules','systems','species','factions','layers','places','routes')),
      entity_id TEXT NOT NULL,
      label TEXT NOT NULL,
      source_path TEXT NOT NULL,
      region_ids_json TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      registry_source_hash TEXT NOT NULL,
      metadata_json TEXT NOT NULL,
      chunk_count INTEGER NOT NULL CHECK (chunk_count >= 0),
      updated_at TEXT NOT NULL
    ) WITHOUT ROWID;
    CREATE INDEX IF NOT EXISTS idx_world_knowledge_source_collection
      ON world_knowledge_sources(collection, entity_id);
    CREATE TABLE IF NOT EXISTS world_knowledge_chunks (
      row_id INTEGER PRIMARY KEY AUTOINCREMENT,
      chunk_id TEXT NOT NULL UNIQUE,
      source_id TEXT NOT NULL REFERENCES world_knowledge_sources(source_id) ON DELETE CASCADE,
      chunk_index INTEGER NOT NULL,
      collection TEXT NOT NULL
        CHECK (collection IN ('rules','systems','species','factions','layers','places','routes')),
      entity_id TEXT NOT NULL,
      label TEXT NOT NULL,
      source_path TEXT NOT NULL,
      region_ids_json TEXT NOT NULL,
      content TEXT NOT NULL,
      cjk_tokens TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      embedding_blob BLOB,
      embedding_dimension INTEGER,
      embedding_model TEXT,
      embedding_state TEXT NOT NULL DEFAULT 'pending'
        CHECK (embedding_state IN ('pending', 'processing', 'ready', 'failed')),
      embedding_attempts INTEGER NOT NULL DEFAULT 0,
      embedding_lease_token TEXT,
      embedding_lease_expires_at TEXT,
      embedding_retry_after TEXT,
      embedding_last_error TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(source_id, chunk_index),
      CHECK (
        (embedding_blob IS NULL AND embedding_dimension IS NULL)
        OR (embedding_blob IS NOT NULL AND embedding_dimension = ${WORLD_MEMORY_EMBEDDING_DIMENSION}
          AND length(embedding_blob) = ${WORLD_MEMORY_EMBEDDING_DIMENSION * 4})
      )
    );
    CREATE INDEX IF NOT EXISTS idx_world_knowledge_queue
      ON world_knowledge_chunks(embedding_state, embedding_retry_after, row_id);
    CREATE INDEX IF NOT EXISTS idx_world_knowledge_filter
      ON world_knowledge_chunks(collection, entity_id, row_id);
    CREATE VIRTUAL TABLE IF NOT EXISTS world_knowledge_fts USING fts5(
      label,
      content,
      content='world_knowledge_chunks',
      content_rowid='row_id',
      tokenize='unicode61'
    );
    CREATE VIRTUAL TABLE IF NOT EXISTS world_knowledge_cjk_fts USING fts5(
      cjk_tokens,
      content='world_knowledge_chunks',
      content_rowid='row_id',
      tokenize='unicode61'
    );
    CREATE TRIGGER IF NOT EXISTS world_knowledge_chunks_ai AFTER INSERT ON world_knowledge_chunks BEGIN
      INSERT INTO world_knowledge_fts(rowid, label, content) VALUES (new.row_id, new.label, new.content);
      INSERT INTO world_knowledge_cjk_fts(rowid, cjk_tokens) VALUES (new.row_id, new.cjk_tokens);
    END;
    CREATE TRIGGER IF NOT EXISTS world_knowledge_chunks_ad AFTER DELETE ON world_knowledge_chunks BEGIN
      INSERT INTO world_knowledge_fts(world_knowledge_fts, rowid, label, content)
        VALUES ('delete', old.row_id, old.label, old.content);
      INSERT INTO world_knowledge_cjk_fts(world_knowledge_cjk_fts, rowid, cjk_tokens)
        VALUES ('delete', old.row_id, old.cjk_tokens);
    END;
    CREATE TRIGGER IF NOT EXISTS world_knowledge_chunks_au
      AFTER UPDATE OF label, content, cjk_tokens ON world_knowledge_chunks BEGIN
      INSERT INTO world_knowledge_fts(world_knowledge_fts, rowid, label, content)
        VALUES ('delete', old.row_id, old.label, old.content);
      INSERT INTO world_knowledge_fts(rowid, label, content) VALUES (new.row_id, new.label, new.content);
      INSERT INTO world_knowledge_cjk_fts(world_knowledge_cjk_fts, rowid, cjk_tokens)
        VALUES ('delete', old.row_id, old.cjk_tokens);
      INSERT INTO world_knowledge_cjk_fts(rowid, cjk_tokens) VALUES (new.row_id, new.cjk_tokens);
    END;
  `);
  db.prepare("INSERT OR IGNORE INTO world_memory_meta(key, value) VALUES (?, ?)")
    .run(WORLD_KNOWLEDGE_SCHEMA_META_KEY, String(WORLD_KNOWLEDGE_SCHEMA_VERSION));
}

function splitKnowledgeText(value: string) {
  const text = value.trim();
  if (!text) return [];
  if (text.length <= WORLD_KNOWLEDGE_MAX_CHUNK_CHARACTERS) return [text];
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(text.length, start + WORLD_KNOWLEDGE_MAX_CHUNK_CHARACTERS);
    if (end < text.length) {
      const boundary = Math.max(
        text.lastIndexOf("\n", end),
        text.lastIndexOf("。", end),
        text.lastIndexOf("！", end),
        text.lastIndexOf("？", end),
      );
      if (boundary > start + Math.floor(WORLD_KNOWLEDGE_MAX_CHUNK_CHARACTERS * 0.6)) end = boundary + 1;
    }
    chunks.push(text.slice(start, end).trim());
    if (end >= text.length) break;
    start = Math.max(start + 1, end - WORLD_KNOWLEDGE_CHUNK_OVERLAP_CHARACTERS);
  }
  return chunks.filter(Boolean);
}

function canonicalEntryDocument(
  collection: Exclude<WorldKnowledgeCollection, "layers" | "routes">,
  entry: WorldContentEntry | WorldContentFaction | WorldContentPlace,
): KnowledgeDocument {
  const place = collection === "places" ? entry as WorldContentPlace : undefined;
  const faction = collection === "factions" ? entry as WorldContentFaction : undefined;
  const regionIds = place
    ? [...new Set([
        place.id,
        ...(place.parentId ? [place.parentId] : []),
        ...place.jurisdictionIds,
      ])]
    : [];
  const metadata = place
    ? {
        kind: place.kind,
        spatialKind: place.spatialKind,
        layerId: place.layerId,
        parentId: place.parentId,
        jurisdictionIds: place.jurisdictionIds,
        tags: place.tags,
        persistent: place.persistent,
      }
    : faction
      ? {
          kind: faction.kind,
          coreMemberBaseline: faction.coreMemberBaseline,
          affiliatedPopulationBaseline: faction.affiliatedPopulationBaseline,
        }
      : { kind: entry.kind };
  return {
    sourceId: `world_knowledge:${collection}:${entry.id}`,
    collection,
    entityId: entry.id,
    label: entry.label,
    sourcePath: entry.sourcePath,
    regionIds,
    content: [
      `${entry.label}（${entry.id}）`,
      `内容类型：${entry.kind}`,
      entry.canonicalText,
    ].join("\n"),
    metadata,
  };
}

function routeDocument(route: WorldContentRoute, labels: ReadonlyMap<string, string>): KnowledgeDocument {
  const fromLabel = labels.get(route.from) || route.from;
  const toLabel = labels.get(route.to) || route.to;
  const direction = route.bidirectional ? "双向" : "单向";
  return {
    sourceId: `world_knowledge:routes:${route.id}`,
    collection: "routes",
    entityId: route.id,
    label: `${fromLabel}至${toLabel}路线`,
    sourcePath: "00_总览/canonical-world-atlas.json",
    regionIds: [route.from, route.to],
    content: [
      `世界路线：${fromLabel}（${route.from}）至${toLabel}（${route.to}）`,
      `路线ID：${route.id}`,
      `方向：${direction}`,
      `通行方式：${route.mode.join("、")}`,
      `基准时间：${route.baseMinutes}分钟`,
    ].join("\n"),
    metadata: { ...route },
  };
}

export function worldKnowledgeDocuments(registry: WorldContentRegistry): readonly KnowledgeDocument[] {
  const labels = new Map(registry.places.map((place) => [place.id, place.label] as const));
  return [
    ...registry.rules.map((entry) => canonicalEntryDocument("rules", entry)),
    ...registry.systems.map((entry) => canonicalEntryDocument("systems", entry)),
    ...registry.species.map((entry) => canonicalEntryDocument("species", entry)),
    ...registry.factions.map((entry) => canonicalEntryDocument("factions", entry)),
    ...registry.layers.map((layer): KnowledgeDocument => ({
      sourceId: `world_knowledge:layers:${layer.id}`,
      collection: "layers",
      entityId: layer.id,
      label: layer.label,
      sourcePath: "00_总览/canonical-world-atlas.json",
      regionIds: [],
      content: `世界层级：${layer.label}\n层级ID：${layer.id}`,
      metadata: { ...layer },
    })),
    ...registry.places.map((entry) => canonicalEntryDocument("places", entry)),
    ...registry.routes.map((route) => routeDocument(route, labels)),
  ];
}

export function synchronizeWorldKnowledgeRegistry(dbPath: string, registry: WorldContentRegistry) {
  const documents = worldKnowledgeDocuments(registry);
  const db = openKnowledgeDb(dbPath);
  let transactionStarted = false;
  try {
    db.exec("BEGIN IMMEDIATE");
    transactionStarted = true;
    db.exec(`
      CREATE TEMP TABLE IF NOT EXISTS temp_world_knowledge_source_ids (
        source_id TEXT PRIMARY KEY
      ) WITHOUT ROWID;
      DELETE FROM temp_world_knowledge_source_ids;
    `);
    const markSource = db.prepare("INSERT INTO temp_world_knowledge_source_ids(source_id) VALUES (?)");
    const upsertSource = db.prepare(`
      INSERT INTO world_knowledge_sources(
        source_id, collection, entity_id, label, source_path, region_ids_json,
        content_hash, registry_source_hash, metadata_json, chunk_count, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(source_id) DO UPDATE SET
        collection = excluded.collection,
        entity_id = excluded.entity_id,
        label = excluded.label,
        source_path = excluded.source_path,
        region_ids_json = excluded.region_ids_json,
        content_hash = excluded.content_hash,
        registry_source_hash = excluded.registry_source_hash,
        metadata_json = excluded.metadata_json,
        chunk_count = excluded.chunk_count,
        updated_at = excluded.updated_at
    `);
    const upsertChunk = db.prepare(`
      INSERT INTO world_knowledge_chunks(
        chunk_id, source_id, chunk_index, collection, entity_id, label, source_path,
        region_ids_json, content, cjk_tokens, content_hash, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(source_id, chunk_index) DO UPDATE SET
        chunk_id = excluded.chunk_id,
        collection = excluded.collection,
        entity_id = excluded.entity_id,
        label = excluded.label,
        source_path = excluded.source_path,
        region_ids_json = excluded.region_ids_json,
        content = excluded.content,
        cjk_tokens = excluded.cjk_tokens,
        content_hash = excluded.content_hash,
        embedding_blob = CASE
          WHEN world_knowledge_chunks.content_hash = excluded.content_hash
          THEN world_knowledge_chunks.embedding_blob ELSE NULL END,
        embedding_dimension = CASE
          WHEN world_knowledge_chunks.content_hash = excluded.content_hash
          THEN world_knowledge_chunks.embedding_dimension ELSE NULL END,
        embedding_model = CASE
          WHEN world_knowledge_chunks.content_hash = excluded.content_hash
          THEN world_knowledge_chunks.embedding_model ELSE NULL END,
        embedding_state = CASE
          WHEN world_knowledge_chunks.content_hash = excluded.content_hash
          THEN world_knowledge_chunks.embedding_state ELSE 'pending' END,
        embedding_attempts = CASE
          WHEN world_knowledge_chunks.content_hash = excluded.content_hash
          THEN world_knowledge_chunks.embedding_attempts ELSE 0 END,
        embedding_lease_token = NULL,
        embedding_lease_expires_at = NULL,
        embedding_retry_after = NULL,
        embedding_last_error = NULL,
        updated_at = excluded.updated_at
    `);
    const trimChunks = db.prepare(`
      DELETE FROM world_knowledge_chunks WHERE source_id = ? AND chunk_index >= ?
    `);
    const timestamp = nowIso();
    let chunkCount = 0;
    for (const document of documents) {
      markSource.run(document.sourceId);
      const chunks = splitKnowledgeText(document.content);
      const sourceContentHash = `sha256:${sha256(document.content)}`;
      upsertSource.run(
        document.sourceId,
        document.collection,
        document.entityId,
        document.label,
        document.sourcePath,
        JSON.stringify(document.regionIds),
        sourceContentHash,
        registry.sourceHash,
        stableJson(document.metadata),
        chunks.length,
        timestamp,
      );
      trimChunks.run(document.sourceId, chunks.length);
      chunks.forEach((content, chunkIndex) => {
        const contentHash = sha256(`${document.label}\n${content}`);
        upsertChunk.run(
          `world_knowledge:${sha256(`${document.sourceId}:${chunkIndex}:${contentHash}`).slice(0, 32)}`,
          document.sourceId,
          chunkIndex,
          document.collection,
          document.entityId,
          document.label,
          document.sourcePath,
          JSON.stringify(document.regionIds),
          content,
          cjkWorldMemoryTokens(`${document.label}\n${content}`, 4096).join(" "),
          contentHash,
          timestamp,
          timestamp,
        );
      });
      chunkCount += chunks.length;
    }
    db.exec(`
      DELETE FROM world_knowledge_sources
      WHERE source_id NOT IN (SELECT source_id FROM temp_world_knowledge_source_ids);
      DELETE FROM temp_world_knowledge_source_ids;
    `);
    db.prepare(`
      INSERT INTO world_memory_meta(key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run(WORLD_KNOWLEDGE_REGISTRY_META_KEY, registry.sourceHash);
    db.exec("COMMIT");
    transactionStarted = false;
    return { sources: documents.length, chunks: chunkCount, sourceHash: registry.sourceHash };
  } catch (error) {
    if (transactionStarted) db.exec("ROLLBACK");
    throw error;
  } finally {
    db.close();
  }
}

export function claimWorldKnowledgeChunks(
  dbPath: string,
  limit: number,
  leaseMs = 60_000,
): ClaimedWorldKnowledgeChunk[] {
  const boundedLimit = Math.max(1, Math.min(Number.isSafeInteger(limit) ? limit : 8, 64));
  const db = openKnowledgeDb(dbPath);
  const leaseToken = randomUUID();
  const claimedAt = nowIso();
  const leaseExpiresAt = new Date(Date.now() + leaseMs).toISOString();
  try {
    db.exec("BEGIN IMMEDIATE");
    db.prepare(`
      UPDATE world_knowledge_chunks
      SET embedding_state = 'pending', embedding_lease_token = NULL, embedding_lease_expires_at = NULL
      WHERE embedding_state = 'processing' AND embedding_lease_expires_at <= ?
    `).run(claimedAt);
    const rows = db.prepare(`
      SELECT row_id, chunk_id, content
      FROM world_knowledge_chunks
      WHERE embedding_state IN ('pending', 'failed')
        AND (embedding_retry_after IS NULL OR embedding_retry_after <= ?)
      ORDER BY row_id
      LIMIT ?
    `).all(claimedAt, boundedLimit) as { row_id: number; chunk_id: string; content: string }[];
    const update = db.prepare(`
      UPDATE world_knowledge_chunks
      SET embedding_state = 'processing', embedding_lease_token = ?,
        embedding_lease_expires_at = ?, updated_at = ?
      WHERE row_id = ?
    `);
    for (const row of rows) update.run(leaseToken, leaseExpiresAt, claimedAt, row.row_id);
    db.exec("COMMIT");
    return rows.map((row) => ({
      rowId: Number(row.row_id),
      chunkId: row.chunk_id,
      content: row.content,
      leaseToken,
    }));
  } catch (error) {
    try { db.exec("ROLLBACK"); } catch { /* transaction did not start */ }
    throw error;
  } finally {
    db.close();
  }
}

export function completeWorldKnowledgeChunkEmbeddings(
  dbPath: string,
  claims: readonly ClaimedWorldKnowledgeChunk[],
  vectors: readonly (readonly number[])[],
  profile: WorldMemoryEmbeddingProfile,
  behaviorVectors: readonly (readonly number[])[] = [],
) {
  if (claims.length === 0 || claims.length !== vectors.length) {
    throw new Error("world_knowledge_embedding_batch_count_invalid");
  }
  const normalized = vectors.map(normalizeWorldMemoryVector);
  const db = openKnowledgeDb(dbPath);
  try {
    db.exec("BEGIN IMMEDIATE");
    bindOrValidateWorldMemoryProfile(db, profile, behaviorVectors);
    const update = db.prepare(`
      UPDATE world_knowledge_chunks
      SET embedding_blob = ?, embedding_dimension = ?, embedding_model = ?,
        embedding_state = 'ready', embedding_lease_token = NULL,
        embedding_lease_expires_at = NULL, embedding_retry_after = NULL,
        embedding_last_error = NULL, updated_at = ?
      WHERE row_id = ? AND embedding_state = 'processing' AND embedding_lease_token = ?
    `);
    claims.forEach((claim, index) => {
      const result = update.run(
        encodeWorldMemoryVector(normalized[index]!),
        WORLD_MEMORY_EMBEDDING_DIMENSION,
        profile.model,
        nowIso(),
        claim.rowId,
        claim.leaseToken,
      );
      if (Number(result.changes) !== 1) throw new Error("world_knowledge_embedding_lease_lost");
    });
    db.exec("COMMIT");
  } catch (error) {
    try { db.exec("ROLLBACK"); } catch { /* transaction did not start */ }
    throw error;
  } finally {
    db.close();
  }
}

export function failWorldKnowledgeChunkEmbeddings(
  dbPath: string,
  claims: readonly ClaimedWorldKnowledgeChunk[],
  errorCode: string,
) {
  if (claims.length === 0) return;
  const db = openKnowledgeDb(dbPath);
  try {
    db.exec("BEGIN IMMEDIATE");
    const attempts = db.prepare("SELECT embedding_attempts FROM world_knowledge_chunks WHERE row_id = ?");
    const update = db.prepare(`
      UPDATE world_knowledge_chunks
      SET embedding_state = 'failed', embedding_attempts = embedding_attempts + 1,
        embedding_lease_token = NULL, embedding_lease_expires_at = NULL,
        embedding_retry_after = ?, embedding_last_error = ?, updated_at = ?
      WHERE row_id = ? AND embedding_lease_token = ?
    `);
    for (const claim of claims) {
      const row = attempts.get(claim.rowId) as { embedding_attempts: number } | undefined;
      const nextAttempt = Number(row?.embedding_attempts || 0) + 1;
      const retryDelayMs = Math.min(60 * 60_000, 15_000 * 2 ** Math.min(nextAttempt - 1, 8));
      update.run(
        new Date(Date.now() + retryDelayMs).toISOString(),
        errorCode.slice(0, 160),
        nowIso(),
        claim.rowId,
        claim.leaseToken,
      );
    }
    db.exec("COMMIT");
  } catch (error) {
    try { db.exec("ROLLBACK"); } catch { /* transaction did not start */ }
    throw error;
  } finally {
    db.close();
  }
}

function knowledgeFilterClause(input: WorldKnowledgeSearchInput, alias: string) {
  const clauses = ["1 = 1"];
  const values: SqlValue[] = [];
  if (input.collection) {
    if (!WORLD_KNOWLEDGE_COLLECTIONS.includes(input.collection)) {
      throw new Error("world_knowledge_collection_invalid");
    }
    clauses.push(`${alias}.collection = ?`);
    values.push(input.collection);
  }
  if (optionalString(input.entityId)) {
    clauses.push(`${alias}.entity_id = ?`);
    values.push(String(input.entityId).trim());
  }
  if (optionalString(input.regionId)) {
    clauses.push(`(
      json_array_length(${alias}.region_ids_json) = 0
      OR EXISTS (
        SELECT 1 FROM json_each(${alias}.region_ids_json) AS region
        WHERE region.value = ?
      )
    )`);
    values.push(String(input.regionId).trim());
  }
  return { sql: clauses.join(" AND "), values };
}

function ftsExpression(query: string) {
  const terms = [...query.matchAll(/[\p{L}\p{N}_-]+/gu)]
    .map((match) => match[0].trim()).filter(Boolean).slice(0, 16);
  return terms.map((term) => `"${term.replaceAll("\"", "\"\"")}"`).join(" OR ");
}

function lexicalKnowledgeRows(db: DatabaseSync, input: WorldKnowledgeSearchInput, limit: number) {
  const filters = knowledgeFilterClause(input, "c");
  const ranks = new Map<number, number>();
  const standard = ftsExpression(input.query);
  if (standard) {
    const rows = db.prepare(`
      SELECT c.row_id, bm25(world_knowledge_fts) AS rank
      FROM world_knowledge_fts
      JOIN world_knowledge_chunks AS c ON c.row_id = world_knowledge_fts.rowid
      WHERE world_knowledge_fts MATCH ? AND ${filters.sql}
      ORDER BY rank LIMIT ?
    `).all(standard, ...filters.values, limit) as { row_id: number }[];
    rows.forEach((row, index) => ranks.set(Number(row.row_id), index + 1));
  }
  const cjkTokens = cjkWorldMemoryTokens(input.query, 32);
  if (cjkTokens.length) {
    const expression = cjkTokens.map((token) => `"${token.replaceAll("\"", "\"\"")}"`).join(" OR ");
    const rows = db.prepare(`
      SELECT c.row_id, bm25(world_knowledge_cjk_fts) AS rank
      FROM world_knowledge_cjk_fts
      JOIN world_knowledge_chunks AS c ON c.row_id = world_knowledge_cjk_fts.rowid
      WHERE world_knowledge_cjk_fts MATCH ? AND ${filters.sql}
      ORDER BY rank LIMIT ?
    `).all(expression, ...filters.values, limit) as { row_id: number }[];
    rows.forEach((row, index) => {
      const current = ranks.get(Number(row.row_id));
      ranks.set(Number(row.row_id), Math.min(current ?? Number.POSITIVE_INFINITY, index + 1));
    });
  }
  return [...ranks.entries()].sort((left, right) => left[1] - right[1]).slice(0, limit);
}

function cosineSimilarity(left: Float32Array, right: Float32Array) {
  let dot = 0;
  for (let index = 0; index < left.length; index += 1) dot += left[index]! * right[index]!;
  return Math.max(-1, Math.min(1, dot));
}

function vectorKnowledgeRows(
  db: DatabaseSync,
  input: WorldKnowledgeSearchInput,
  normalized: Float32Array,
  limit: number,
) {
  const filters = knowledgeFilterClause(input, "c");
  const rows = db.prepare(`
    SELECT c.row_id, c.embedding_blob, c.embedding_dimension
    FROM world_knowledge_chunks AS c
    WHERE c.embedding_state = 'ready' AND ${filters.sql}
    ORDER BY c.row_id
  `).all(...filters.values) as {
    row_id: number;
    embedding_blob: Uint8Array;
    embedding_dimension: number;
  }[];
  return rows.map((row) => ({
    rowId: Number(row.row_id),
    similarity: cosineSimilarity(
      normalized,
      decodeWorldMemoryVector(row.embedding_blob, row.embedding_dimension),
    ),
  })).sort((left, right) => right.similarity - left.similarity).slice(0, limit);
}

function knowledgeRows(db: DatabaseSync, rowIds: readonly number[]) {
  if (rowIds.length === 0) return new Map<number, KnowledgeChunkRow>();
  const placeholders = rowIds.map(() => "?").join(",");
  const rows = db.prepare(`
    SELECT row_id, chunk_id, source_id, collection, entity_id, label,
      source_path, region_ids_json, content
    FROM world_knowledge_chunks
    WHERE row_id IN (${placeholders})
  `).all(...rowIds) as unknown as KnowledgeChunkRow[];
  return new Map(rows.map((row) => [Number(row.row_id), row] as const));
}

export function searchWorldKnowledge(
  dbPath: string,
  input: WorldKnowledgeSearchInput,
): WorldKnowledgeSearchResult {
  const query = input.query.trim();
  if (!query || query.length > 500) throw new Error("world_knowledge_query_invalid");
  const limit = Math.max(1, Math.min(Number.isSafeInteger(input.limit) ? Number(input.limit) : 10, 30));
  const db = openKnowledgeDb(dbPath);
  try {
    const candidateLimit = Math.max(100, limit * 10);
    const lexical = lexicalKnowledgeRows(db, { ...input, query }, candidateLimit);
    let vector: { rowId: number; similarity: number }[] = [];
    if (input.queryEmbedding) {
      if (!input.embeddingProfile) throw new Error("world_knowledge_embedding_profile_required");
      bindOrValidateWorldMemoryProfile(db, input.embeddingProfile, input.embeddingBehaviorVectors || []);
      vector = vectorKnowledgeRows(db, input, normalizeWorldMemoryVector(input.queryEmbedding), candidateLimit);
    }
    const scores = new Map<number, number>();
    const lexicalRanks = new Map<number, number>();
    const vectorRanks = new Map<number, { rank: number; similarity: number }>();
    lexical.forEach(([rowId], index) => {
      lexicalRanks.set(rowId, index + 1);
      scores.set(rowId, (scores.get(rowId) || 0) + 1 / (60 + index + 1));
    });
    vector.forEach((row, index) => {
      vectorRanks.set(row.rowId, { rank: index + 1, similarity: row.similarity });
      scores.set(row.rowId, (scores.get(row.rowId) || 0) + 1.2 / (60 + index + 1));
    });
    const ranked = [...scores.entries()]
      .sort((left, right) => right[1] - left[1] || left[0] - right[0])
      .slice(0, limit);
    const rows = knowledgeRows(db, ranked.map(([rowId]) => rowId));
    const hits = ranked.flatMap(([rowId, score]) => {
      const row = rows.get(rowId);
      if (!row) return [];
      const vectorRank = vectorRanks.get(rowId);
      let regionIds: string[] = [];
      try {
        const parsed: unknown = JSON.parse(row.region_ids_json);
        if (Array.isArray(parsed)) regionIds = parsed.filter((item): item is string => typeof item === "string");
      } catch { regionIds = []; }
      return [{
        chunkId: row.chunk_id,
        sourceId: row.source_id,
        collection: row.collection,
        entityId: row.entity_id,
        label: row.label,
        sourcePath: row.source_path,
        regionIds,
        content: row.content,
        ...(lexicalRanks.has(rowId) ? { lexicalRank: lexicalRanks.get(rowId) } : {}),
        ...(vectorRank ? { vectorRank: vectorRank.rank, cosineSimilarity: vectorRank.similarity } : {}),
        score,
      } satisfies WorldKnowledgeSearchHit];
    });
    return {
      retrievalMode: input.queryEmbedding ? "hybrid" : "lexical",
      query,
      filters: {
        ...(input.collection ? { collection: input.collection } : {}),
        ...(optionalString(input.entityId) ? { entityId: String(input.entityId).trim() } : {}),
        ...(optionalString(input.regionId) ? { regionId: String(input.regionId).trim() } : {}),
      },
      hits,
    };
  } finally {
    db.close();
  }
}

export function worldKnowledgeIndexStatus(dbPath: string): WorldKnowledgeIndexStatus {
  const db = openKnowledgeDb(dbPath);
  try {
    const rows = db.prepare(`
      SELECT embedding_state AS state, COUNT(*) AS count
      FROM world_knowledge_chunks GROUP BY embedding_state
    `).all() as { state: "pending" | "processing" | "ready" | "failed"; count: number }[];
    const counts = new Map(rows.map((row) => [row.state, Number(row.count)] as const));
    const sourceCount = db.prepare("SELECT COUNT(*) AS count FROM world_knowledge_sources")
      .get() as { count: number };
    const registry = db.prepare("SELECT value FROM world_memory_meta WHERE key = ?")
      .get(WORLD_KNOWLEDGE_REGISTRY_META_KEY) as { value: string } | undefined;
    const pending = counts.get("pending") || 0;
    const processing = counts.get("processing") || 0;
    const ready = counts.get("ready") || 0;
    const failed = counts.get("failed") || 0;
    return {
      sources: Number(sourceCount.count),
      chunks: pending + processing + ready + failed,
      pending,
      processing,
      ready,
      failed,
      ...(registry ? { registrySourceHash: registry.value } : {}),
    };
  } finally {
    db.close();
  }
}
