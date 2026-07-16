import { createHash, randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";

type JsonRecord = Record<string, unknown>;
type SqlValue = string | number | bigint | null | Uint8Array;

export const WORLD_MEMORY_EMBEDDING_DIMENSION = 4096;
export const WORLD_MEMORY_EMBEDDING_MODEL = "qwen3-embedding-8b";
export const WORLD_MEMORY_PROFILE_SCHEMA_VERSION = 1;
export const WORLD_MEMORY_INDEX_SCHEMA_VERSION = 1;
export const WORLD_MEMORY_CJK_NORMALIZER_VERSION = 1;
export const WORLD_MEMORY_LSH_VERSION = 1;
export const WORLD_MEMORY_LSH_TABLE_COUNT = 16;
export const WORLD_MEMORY_LSH_BITS_PER_TABLE = 14;
// Q4 llama.cpp inference can drift slightly across scheduler/batch states even
// for identical inputs. This still rejects a changed vector space while
// tolerating the observed same-model floor (> 0.9992).
export const WORLD_MEMORY_BEHAVIOR_PROBE_MIN_COSINE = 0.999;

const WORLD_MEMORY_PROFILE_META_KEY = "embedding_profile_json";
const WORLD_MEMORY_SCHEMA_META_KEY = "index_schema_version";
const WORLD_MEMORY_CJK_META_KEY = "cjk_normalizer_version";
const WORLD_MEMORY_PROJECTION_DIRTY_META_KEY = "projection_dirty";
const WORLD_MEMORY_EXACT_SEARCH_THRESHOLD = 2048;
const WORLD_MEMORY_MAX_VECTOR_CANDIDATES = 8192;
// Match the deployed Qwen3-Embedding llama.cpp runtime, which exposes n_ctx=512.
const WORLD_MEMORY_MAX_CHUNK_CHARACTERS = 600;
const WORLD_MEMORY_CHUNK_OVERLAP_CHARACTERS = 80;

export interface WorldMemoryEmbeddingProfile {
  readonly schemaVersion: typeof WORLD_MEMORY_PROFILE_SCHEMA_VERSION;
  readonly provider: "openai-compatible-lan";
  readonly model: string;
  readonly modelDigest: `sha256:${string}`;
  readonly dimension: typeof WORLD_MEMORY_EMBEDDING_DIMENSION;
  readonly normalization: "l2";
  readonly storageEncoding: "float32-le";
  readonly inputTransform: "canonical-world-memory-v1";
}

export interface ClaimedWorldMemoryChunk {
  readonly rowId: number;
  readonly chunkId: string;
  readonly content: string;
  readonly leaseToken: string;
}

export interface WorldMemorySearchInput {
  readonly query: string;
  readonly queryEmbedding?: readonly number[];
  readonly embeddingProfile?: WorldMemoryEmbeddingProfile;
  readonly embeddingBehaviorVectors?: readonly (readonly number[])[];
  readonly regionId?: string;
  readonly fromWorldTime?: string;
  readonly toWorldTime?: string;
  readonly limit?: number;
}

export interface WorldMemorySearchHit {
  readonly chunkId: string;
  readonly sourcePageId: string;
  readonly journeyId: string;
  readonly regionId: string;
  readonly title: string;
  readonly content: string;
  readonly worldStartTime?: string;
  readonly worldEndTime?: string;
  readonly sourceEventIds: readonly string[];
  readonly lexicalRank?: number;
  readonly vectorRank?: number;
  readonly cosineSimilarity?: number;
  readonly score: number;
}

export interface WorldMemorySearchResult {
  readonly retrievalMode: "lexical" | "hybrid";
  readonly query: string;
  readonly filters: {
    readonly regionId?: string;
    readonly fromWorldTime?: string;
    readonly toWorldTime?: string;
  };
  readonly hits: readonly WorldMemorySearchHit[];
}

export interface WorldMemoryIndexStatus {
  readonly chunks: number;
  readonly pending: number;
  readonly processing: number;
  readonly ready: number;
  readonly failed: number;
  readonly embeddingProfile?: WorldMemoryEmbeddingProfile;
}

interface WorldMemoryChunkDraft {
  readonly index: number;
  readonly title: string;
  readonly content: string;
}

interface WorldMemoryChunkRow {
  readonly row_id: number;
  readonly chunk_id: string;
  readonly source_page_id: string;
  readonly journey_id: string;
  readonly region_id: string;
  readonly world_start_time: string | null;
  readonly world_end_time: string | null;
  readonly source_expires_at: string | null;
  readonly title: string;
  readonly content: string;
  readonly source_event_ids_json: string;
  readonly embedding_blob: Uint8Array | null;
  readonly embedding_dimension: number | null;
}

interface RankedVectorRow {
  readonly rowId: number;
  readonly similarity: number;
}

interface LshProbe {
  readonly tableNo: number;
  readonly bucket: number;
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function recordValue(value: unknown): JsonRecord {
  return isRecord(value) ? value : {};
}

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim()).filter(Boolean))];
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (isRecord(value)) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value: string | Uint8Array) {
  return createHash("sha256").update(value).digest("hex");
}

function nowIso() {
  return new Date().toISOString();
}

export function createWorldMemoryEmbeddingProfile(input: {
  readonly model?: string;
  readonly modelDigest: string;
}): WorldMemoryEmbeddingProfile {
  const model = optionalString(input.model) || WORLD_MEMORY_EMBEDDING_MODEL;
  const normalizedDigest = input.modelDigest.trim().toLowerCase().replace(/^sha256:/u, "");
  if (!/^[a-f0-9]{64}$/u.test(normalizedDigest)) throw new Error("world_memory_model_digest_invalid");
  return {
    schemaVersion: WORLD_MEMORY_PROFILE_SCHEMA_VERSION,
    provider: "openai-compatible-lan",
    model,
    modelDigest: `sha256:${normalizedDigest}`,
    dimension: WORLD_MEMORY_EMBEDDING_DIMENSION,
    normalization: "l2",
    storageEncoding: "float32-le",
    inputTransform: "canonical-world-memory-v1",
  };
}

function decodeEmbeddingProfile(value: string): WorldMemoryEmbeddingProfile {
  const parsed: unknown = JSON.parse(value);
  if (!isRecord(parsed)
    || parsed.schemaVersion !== WORLD_MEMORY_PROFILE_SCHEMA_VERSION
    || parsed.provider !== "openai-compatible-lan"
    || typeof parsed.model !== "string"
    || !/^sha256:[a-f0-9]{64}$/u.test(String(parsed.modelDigest))
    || parsed.dimension !== WORLD_MEMORY_EMBEDDING_DIMENSION
    || parsed.normalization !== "l2"
    || parsed.storageEncoding !== "float32-le"
    || parsed.inputTransform !== "canonical-world-memory-v1") {
    throw new Error("world_memory_embedding_profile_invalid");
  }
  return parsed as unknown as WorldMemoryEmbeddingProfile;
}

function profileJson(profile: WorldMemoryEmbeddingProfile) {
  return stableJson(profile);
}

function profilesShareVectorContract(
  actual: WorldMemoryEmbeddingProfile,
  expected: WorldMemoryEmbeddingProfile,
) {
  return actual.schemaVersion === expected.schemaVersion
    && actual.provider === expected.provider
    && actual.model === expected.model
    && actual.dimension === expected.dimension
    && actual.normalization === expected.normalization
    && actual.storageEncoding === expected.storageEncoding
    && actual.inputTransform === expected.inputTransform;
}

function storedBehaviorVectorsMatch(
  db: DatabaseSync,
  candidateVectors: readonly (readonly number[])[],
) {
  if (candidateVectors.length === 0) return false;
  const rows = db.prepare(`
    SELECT probe_index, embedding_blob
    FROM world_memory_behavior_probes
    ORDER BY probe_index
  `).all() as { probe_index: number; embedding_blob: Uint8Array }[];
  if (rows.length !== candidateVectors.length) return false;
  return rows.every((row, index) => Number(row.probe_index) === index
    && cosineSimilarity(
      decodeWorldMemoryVector(row.embedding_blob),
      normalizeWorldMemoryVector(candidateVectors[index]!),
    ) >= WORLD_MEMORY_BEHAVIOR_PROBE_MIN_COSINE);
}

function storeBehaviorVectors(
  db: DatabaseSync,
  candidateVectors: readonly (readonly number[])[],
) {
  if (candidateVectors.length === 0) return;
  const statement = db.prepare(`
    INSERT INTO world_memory_behavior_probes(probe_index, embedding_blob, created_at)
    VALUES (?, ?, ?)
  `);
  const createdAt = nowIso();
  candidateVectors.forEach((vector, index) => {
    statement.run(index, encodeWorldMemoryVector(normalizeWorldMemoryVector(vector)), createdAt);
  });
}

export function bindOrValidateWorldMemoryProfile(
  db: DatabaseSync,
  expected: WorldMemoryEmbeddingProfile,
  behaviorVectors: readonly (readonly number[])[] = [],
) {
  const hasKnowledgeChunks = Boolean(db.prepare(`
    SELECT 1 AS present FROM sqlite_master
    WHERE type = 'table' AND name = 'world_knowledge_chunks'
  `).get());
  const row = db.prepare("SELECT value FROM world_memory_meta WHERE key = ?")
    .get(WORLD_MEMORY_PROFILE_META_KEY) as { value: string } | undefined;
  if (!row) {
    const memoryReady = db.prepare("SELECT COUNT(*) AS count FROM world_memory_chunks WHERE embedding_state = 'ready'")
      .get() as { count: number };
    const knowledgeReady = hasKnowledgeChunks
      ? db.prepare("SELECT COUNT(*) AS count FROM world_knowledge_chunks WHERE embedding_state = 'ready'")
        .get() as { count: number }
      : { count: 0 };
    if (Number(memoryReady.count) + Number(knowledgeReady.count) > 0) {
      throw new Error("world_memory_populated_index_unbound");
    }
    db.prepare("INSERT INTO world_memory_meta(key, value) VALUES (?, ?)")
      .run(WORLD_MEMORY_PROFILE_META_KEY, profileJson(expected));
    storeBehaviorVectors(db, behaviorVectors);
    return expected;
  }
  const actual = decodeEmbeddingProfile(row.value);
  if (profileJson(actual) !== profileJson(expected)
    && (!profilesShareVectorContract(actual, expected)
      || !storedBehaviorVectorsMatch(db, behaviorVectors))) {
    throw new Error("world_memory_embedding_profile_mismatch");
  }
  const storedProbeCount = db.prepare("SELECT COUNT(*) AS count FROM world_memory_behavior_probes")
    .get() as { count: number };
  if (Number(storedProbeCount.count) === 0 && profileJson(actual) === profileJson(expected)) {
    storeBehaviorVectors(db, behaviorVectors);
  }
  const invalid = db.prepare(`
    SELECT COUNT(*) AS count
    FROM world_memory_chunks
    WHERE embedding_state = 'ready'
      AND (embedding_dimension != ? OR length(embedding_blob) != ?)
  `).get(WORLD_MEMORY_EMBEDDING_DIMENSION, WORLD_MEMORY_EMBEDDING_DIMENSION * 4) as { count: number };
  if (Number(invalid.count) > 0) throw new Error("world_memory_stored_vector_contract_mismatch");
  if (hasKnowledgeChunks) {
    const invalidKnowledge = db.prepare(`
      SELECT COUNT(*) AS count
      FROM world_knowledge_chunks
      WHERE embedding_state = 'ready'
        AND (embedding_dimension != ? OR length(embedding_blob) != ?)
    `).get(WORLD_MEMORY_EMBEDDING_DIMENSION, WORLD_MEMORY_EMBEDDING_DIMENSION * 4) as { count: number };
    if (Number(invalidKnowledge.count) > 0) throw new Error("world_memory_stored_vector_contract_mismatch");
  }
  return actual;
}

export function validateWorldMemoryEmbeddingProfile(
  dbPath: string,
  expected: WorldMemoryEmbeddingProfile,
  behaviorVectors: readonly (readonly number[])[] = [],
) {
  const db = new DatabaseSync(dbPath);
  try {
    initializeWorldMemorySchema(db);
    return bindOrValidateWorldMemoryProfile(db, expected, behaviorVectors);
  } finally {
    db.close();
  }
}

export function normalizeWorldMemoryVector(vector: readonly number[]): Float32Array {
  if (vector.length !== WORLD_MEMORY_EMBEDDING_DIMENSION) {
    throw new Error(`world_memory_embedding_dimension_invalid:${vector.length}`);
  }
  let normSquared = 0;
  for (const value of vector) {
    if (!Number.isFinite(value)) throw new Error("world_memory_embedding_non_finite");
    normSquared += value * value;
  }
  if (!Number.isFinite(normSquared) || normSquared === 0) throw new Error("world_memory_embedding_zero_vector");
  const inverseNorm = 1 / Math.sqrt(normSquared);
  const normalized = new Float32Array(vector.length);
  for (let index = 0; index < vector.length; index += 1) normalized[index] = vector[index]! * inverseNorm;
  return normalized;
}

export function encodeWorldMemoryVector(normalized: Float32Array): Buffer {
  if (normalized.length !== WORLD_MEMORY_EMBEDDING_DIMENSION) {
    throw new Error(`world_memory_embedding_dimension_invalid:${normalized.length}`);
  }
  const buffer = Buffer.allocUnsafe(normalized.length * 4);
  for (let index = 0; index < normalized.length; index += 1) {
    const value = normalized[index]!;
    if (!Number.isFinite(value)) throw new Error("world_memory_embedding_non_finite");
    buffer.writeFloatLE(value, index * 4);
  }
  return buffer;
}

export function decodeWorldMemoryVector(blob: Uint8Array, dimension = WORLD_MEMORY_EMBEDDING_DIMENSION) {
  if (dimension !== WORLD_MEMORY_EMBEDDING_DIMENSION || blob.byteLength !== dimension * 4) {
    throw new Error("world_memory_embedding_blob_invalid");
  }
  const source = Buffer.from(blob.buffer, blob.byteOffset, blob.byteLength);
  const values = new Float32Array(dimension);
  for (let index = 0; index < dimension; index += 1) values[index] = source.readFloatLE(index * 4);
  return values;
}

export function worldMemoryBehaviorFingerprint(vectors: readonly (readonly number[])[]) {
  if (vectors.length === 0) throw new Error("world_memory_behavior_probe_missing");
  const hash = createHash("sha256");
  for (const vector of vectors) hash.update(encodeWorldMemoryVector(normalizeWorldMemoryVector(vector)));
  return `sha256:${hash.digest("hex")}` as const;
}

export function cjkWorldMemoryTokens(value: string, maxTokens = 2048) {
  if (maxTokens <= 0) return [];
  const tokens = new Set<string>();
  const codePoints = Array.from(value);
  const isCjk = (character: string) => {
    const point = character.codePointAt(0) || 0;
    return (point >= 0x3400 && point <= 0x4dbf)
      || (point >= 0x4e00 && point <= 0x9fff)
      || (point >= 0x3040 && point <= 0x30ff)
      || (point >= 0xac00 && point <= 0xd7af);
  };
  for (let index = 0; index < codePoints.length && tokens.size < maxTokens; index += 1) {
    if (!isCjk(codePoints[index]!)) continue;
    const start = index;
    while (index + 1 < codePoints.length && isCjk(codePoints[index + 1]!)) index += 1;
    for (let offset = start; offset <= index && tokens.size < maxTokens; offset += 1) {
      tokens.add(codePoints[offset]!);
      if (offset < index && tokens.size < maxTokens) tokens.add(`${codePoints[offset]}${codePoints[offset + 1]}`);
    }
  }
  return [...tokens];
}

export function initializeWorldMemorySchema(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS world_memory_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    ) WITHOUT ROWID;
    CREATE TABLE IF NOT EXISTS world_memory_sources (
      source_page_id TEXT PRIMARY KEY,
      source_revision INTEGER NOT NULL,
      page_hash TEXT NOT NULL,
      eligible INTEGER NOT NULL CHECK (eligible IN (0, 1)),
      chunk_count INTEGER NOT NULL CHECK (chunk_count >= 0),
      expires_at TEXT,
      indexed_at TEXT NOT NULL
    ) WITHOUT ROWID;
    CREATE TABLE IF NOT EXISTS world_memory_chunks (
      row_id INTEGER PRIMARY KEY AUTOINCREMENT,
      chunk_id TEXT NOT NULL UNIQUE,
      source_page_id TEXT NOT NULL,
      source_revision INTEGER NOT NULL,
      chunk_index INTEGER NOT NULL,
      journey_id TEXT NOT NULL,
      region_id TEXT NOT NULL,
      world_start_time TEXT,
      world_end_time TEXT,
      source_expires_at TEXT,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      cjk_tokens TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      source_event_ids_json TEXT NOT NULL,
      canon_status TEXT NOT NULL CHECK (canon_status = 'solidified'),
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
      lsh_version INTEGER NOT NULL DEFAULT ${WORLD_MEMORY_LSH_VERSION},
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(source_page_id, chunk_index),
      CHECK (
        (embedding_blob IS NULL AND embedding_dimension IS NULL)
        OR (embedding_blob IS NOT NULL AND embedding_dimension = ${WORLD_MEMORY_EMBEDDING_DIMENSION}
          AND length(embedding_blob) = ${WORLD_MEMORY_EMBEDDING_DIMENSION * 4})
      )
    );
    CREATE INDEX IF NOT EXISTS idx_world_memory_source
      ON world_memory_chunks(source_page_id, source_revision, chunk_index);
    CREATE INDEX IF NOT EXISTS idx_world_memory_embedding_queue
      ON world_memory_chunks(embedding_state, embedding_retry_after, row_id);
    CREATE INDEX IF NOT EXISTS idx_world_memory_region_time
      ON world_memory_chunks(region_id, world_start_time, world_end_time);
    CREATE TABLE IF NOT EXISTS world_memory_behavior_probes (
      probe_index INTEGER PRIMARY KEY CHECK (probe_index >= 0),
      embedding_blob BLOB NOT NULL
        CHECK (length(embedding_blob) = ${WORLD_MEMORY_EMBEDDING_DIMENSION * 4}),
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS world_memory_lsh_buckets (
      chunk_row_id INTEGER NOT NULL REFERENCES world_memory_chunks(row_id) ON DELETE CASCADE,
      table_no INTEGER NOT NULL,
      bucket INTEGER NOT NULL,
      lsh_version INTEGER NOT NULL,
      PRIMARY KEY(chunk_row_id, table_no)
    ) WITHOUT ROWID;
    CREATE INDEX IF NOT EXISTS idx_world_memory_lsh_lookup
      ON world_memory_lsh_buckets(lsh_version, table_no, bucket, chunk_row_id);
    CREATE VIRTUAL TABLE IF NOT EXISTS world_memory_fts USING fts5(
      title,
      content,
      content='world_memory_chunks',
      content_rowid='row_id',
      tokenize='unicode61'
    );
    CREATE VIRTUAL TABLE IF NOT EXISTS world_memory_cjk_fts USING fts5(
      cjk_tokens,
      content='world_memory_chunks',
      content_rowid='row_id',
      tokenize='unicode61'
    );
    CREATE TRIGGER IF NOT EXISTS world_memory_chunks_ai AFTER INSERT ON world_memory_chunks BEGIN
      INSERT INTO world_memory_fts(rowid, title, content) VALUES (new.row_id, new.title, new.content);
      INSERT INTO world_memory_cjk_fts(rowid, cjk_tokens) VALUES (new.row_id, new.cjk_tokens);
    END;
    CREATE TRIGGER IF NOT EXISTS world_memory_chunks_ad AFTER DELETE ON world_memory_chunks BEGIN
      INSERT INTO world_memory_fts(world_memory_fts, rowid, title, content)
        VALUES ('delete', old.row_id, old.title, old.content);
      INSERT INTO world_memory_cjk_fts(world_memory_cjk_fts, rowid, cjk_tokens)
        VALUES ('delete', old.row_id, old.cjk_tokens);
    END;
    CREATE TRIGGER IF NOT EXISTS world_memory_chunks_au
      AFTER UPDATE OF title, content, cjk_tokens ON world_memory_chunks BEGIN
      INSERT INTO world_memory_fts(world_memory_fts, rowid, title, content)
        VALUES ('delete', old.row_id, old.title, old.content);
      INSERT INTO world_memory_fts(rowid, title, content) VALUES (new.row_id, new.title, new.content);
      INSERT INTO world_memory_cjk_fts(world_memory_cjk_fts, rowid, cjk_tokens)
        VALUES ('delete', old.row_id, old.cjk_tokens);
      INSERT INTO world_memory_cjk_fts(rowid, cjk_tokens) VALUES (new.row_id, new.cjk_tokens);
    END;
  `);
  const sourceColumns = new Set((db.prepare("PRAGMA table_info(world_memory_sources)").all() as { name: string }[])
    .map((column) => column.name));
  if (!sourceColumns.has("expires_at")) db.exec("ALTER TABLE world_memory_sources ADD COLUMN expires_at TEXT");
  const chunkColumns = new Set((db.prepare("PRAGMA table_info(world_memory_chunks)").all() as { name: string }[])
    .map((column) => column.name));
  if (!chunkColumns.has("source_expires_at")) {
    db.exec("ALTER TABLE world_memory_chunks ADD COLUMN source_expires_at TEXT");
  }
  db.exec("CREATE INDEX IF NOT EXISTS idx_world_memory_expiry ON world_memory_chunks(source_expires_at)");
  db.prepare("INSERT OR IGNORE INTO world_memory_meta(key, value) VALUES (?, ?)")
    .run(WORLD_MEMORY_SCHEMA_META_KEY, String(WORLD_MEMORY_INDEX_SCHEMA_VERSION));
  db.prepare("INSERT OR IGNORE INTO world_memory_meta(key, value) VALUES (?, ?)")
    .run(WORLD_MEMORY_CJK_META_KEY, String(WORLD_MEMORY_CJK_NORMALIZER_VERSION));
  db.prepare("INSERT OR IGNORE INTO world_memory_meta(key, value) VALUES (?, '0')")
    .run(WORLD_MEMORY_PROJECTION_DIRTY_META_KEY);
}

function setWorldMemoryProjectionDirty(db: DatabaseSync, dirty: boolean) {
  db.prepare(`
    INSERT INTO world_memory_meta(key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(WORLD_MEMORY_PROJECTION_DIRTY_META_KEY, dirty ? "1" : "0");
}

export function markWorldMemoryProjectionDirty(db: DatabaseSync) {
  setWorldMemoryProjectionDirty(db, true);
}

function splitWorldMemoryText(value: string) {
  const text = value.trim();
  if (!text) return [];
  if (text.length <= WORLD_MEMORY_MAX_CHUNK_CHARACTERS) return [text];
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(text.length, start + WORLD_MEMORY_MAX_CHUNK_CHARACTERS);
    if (end < text.length) {
      const boundary = Math.max(
        text.lastIndexOf("\n", end),
        text.lastIndexOf("。", end),
        text.lastIndexOf("！", end),
        text.lastIndexOf("？", end),
      );
      if (boundary > start + Math.floor(WORLD_MEMORY_MAX_CHUNK_CHARACTERS * 0.6)) end = boundary + 1;
    }
    chunks.push(text.slice(start, end).trim());
    if (end >= text.length) break;
    start = Math.max(start + 1, end - WORLD_MEMORY_CHUNK_OVERLAP_CHARACTERS);
  }
  return chunks.filter(Boolean);
}

function canonicalStoryChunks(report: JsonRecord): WorldMemoryChunkDraft[] {
  const drafts: Omit<WorldMemoryChunkDraft, "index">[] = [];
  const profile = recordValue(report.profile);
  const elements = recordValue(report.storyElements);
  const evaluation = recordValue(report.evaluation);
  const worldCommit = recordValue(evaluation.worldCommit);
  const rewards = recordValue(evaluation.rewards);
  const relationships = Array.isArray(evaluation.npcRelationships)
    ? evaluation.npcRelationships.map(recordValue)
    : [];
  const summary = [
    optionalString(report.summary),
    optionalString(profile.identity) ? `身份：${optionalString(profile.identity)}` : undefined,
    optionalString(profile.objective) ? `人生目标：${optionalString(profile.objective)}` : undefined,
    optionalString(elements.time) ? `时间：${optionalString(elements.time)}` : undefined,
    optionalString(elements.place) ? `地点：${optionalString(elements.place)}` : undefined,
    stringArray(elements.characters).length ? `人物：${stringArray(elements.characters).join("、")}` : undefined,
    optionalString(elements.result) ? `结果：${optionalString(elements.result)}` : undefined,
    optionalString(worldCommit.summary) ? `世界影响：${optionalString(worldCommit.summary)}` : undefined,
    optionalString(rewards.summary) ? `奖励：${optionalString(rewards.summary)}` : undefined,
    ...relationships.map((relationship) => {
      const displayName = optionalString(relationship.displayName) || optionalString(relationship.npcId);
      const scoreAfter = typeof relationship.scoreAfter === "number" ? relationship.scoreAfter : undefined;
      return displayName ? `人物关系：${displayName}${scoreAfter === undefined ? "" : `（${scoreAfter}）`}` : undefined;
    }),
  ].filter((entry): entry is string => Boolean(entry));
  if (summary.length) drafts.push({ title: optionalString(report.title) || "固化经历概要", content: summary.join("\n") });

  const chapters = Array.isArray(report.chapters) ? report.chapters.map(recordValue) : [];
  for (const chapter of chapters) {
    const chapterTitle = optionalString(chapter.title) || "经历";
    const chapterText = optionalString(chapter.text);
    if (!chapterText) continue;
    for (const segment of splitWorldMemoryText(chapterText)) drafts.push({ title: chapterTitle, content: segment });
  }
  if (chapters.length === 0) {
    const storyText = optionalString(report.storyContent) || optionalString(report.narrative);
    for (const segment of splitWorldMemoryText(storyText || "")) {
      drafts.push({ title: optionalString(report.title) || "固化经历", content: segment });
    }
  }
  const deduplicated = [...new Map(drafts.map((draft) => [`${draft.title}\n${draft.content}`, draft] as const)).values()];
  return deduplicated.map((draft, index) => ({ ...draft, index }));
}

export function indexCanonicalResultPageForWorldMemory(db: DatabaseSync, pageValue: unknown) {
  const page = recordValue(pageValue);
  const pageId = optionalString(page.pageId);
  if (!pageId) return 0;
  const sourceRevision = Number.isSafeInteger(page.shareVersion) ? Number(page.shareVersion) : 1;
  const pageHash = sha256(stableJson(page));
  const payload = recordValue(page.payload);
  const journey = recordValue(payload.journey);
  const worldCommit = recordValue(journey.worldCommit);
  const report = recordValue(journey.storyReport);
  const status = optionalString(page.status) || "active";
  const expiresAt = optionalString(page.expiresAt);
  const expiresAtMs = expiresAt ? Date.parse(expiresAt) : Number.POSITIVE_INFINITY;
  const unexpired = !expiresAt || (Number.isFinite(expiresAtMs) && expiresAtMs > Date.now());
  const eligible = status === "active"
    && unexpired
    && worldCommit.status === "solidified"
    && report.kind === "grounded_story_report"
    && optionalString(journey.journeyId)
    && optionalString(journey.regionId);
  const existingSource = db.prepare(`
    SELECT
      source.page_hash,
      source.eligible,
      source.chunk_count,
      source.expires_at,
      (SELECT COUNT(*) FROM world_memory_chunks AS chunk
        WHERE chunk.source_page_id = source.source_page_id) AS actual_chunk_count,
      (SELECT COUNT(*) FROM world_memory_chunks AS chunk
        WHERE chunk.source_page_id = source.source_page_id
          AND chunk.source_expires_at IS NOT source.expires_at) AS expiry_mismatch_count
    FROM world_memory_sources AS source
    WHERE source.source_page_id = ?
  `).get(pageId) as {
    page_hash: string;
    eligible: number;
    chunk_count: number;
    expires_at: string | null;
    actual_chunk_count: number;
    expiry_mismatch_count: number;
  } | undefined;
  if (existingSource?.page_hash === pageHash
    && Boolean(existingSource.eligible) === Boolean(eligible)
    && existingSource.expires_at === (expiresAt || null)
    && Number(existingSource.expiry_mismatch_count) === 0
    && Number(existingSource.actual_chunk_count) === Number(existingSource.chunk_count)) {
    return Number(existingSource.chunk_count);
  }
  if (!eligible) {
    db.prepare("DELETE FROM world_memory_chunks WHERE source_page_id = ?").run(pageId);
    db.prepare(`
      INSERT INTO world_memory_sources(
        source_page_id, source_revision, page_hash, eligible, chunk_count, expires_at, indexed_at
      ) VALUES (?, ?, ?, 0, 0, ?, ?)
      ON CONFLICT(source_page_id) DO UPDATE SET
        source_revision = excluded.source_revision,
        page_hash = excluded.page_hash,
        eligible = 0,
        chunk_count = 0,
        expires_at = excluded.expires_at,
        indexed_at = excluded.indexed_at
    `).run(pageId, sourceRevision, pageHash, expiresAt || null, nowIso());
    return 0;
  }
  const chunks = canonicalStoryChunks(report);
  if (chunks.length === 0) {
    db.prepare("DELETE FROM world_memory_chunks WHERE source_page_id = ?").run(pageId);
    db.prepare(`
      INSERT INTO world_memory_sources(
        source_page_id, source_revision, page_hash, eligible, chunk_count, expires_at, indexed_at
      ) VALUES (?, ?, ?, 1, 0, ?, ?)
      ON CONFLICT(source_page_id) DO UPDATE SET
        source_revision = excluded.source_revision,
        page_hash = excluded.page_hash,
        eligible = 1,
        chunk_count = 0,
        expires_at = excluded.expires_at,
        indexed_at = excluded.indexed_at
    `).run(pageId, sourceRevision, pageHash, expiresAt || null, nowIso());
    return 0;
  }
  const timestamp = nowIso();
  const journeyId = String(journey.journeyId);
  const regionId = String(journey.regionId);
  const sourceEventIds = stringArray(report.sourceEventIds);
  db.prepare("DELETE FROM world_memory_chunks WHERE source_page_id = ? AND chunk_index >= ?")
    .run(pageId, chunks.length);
  const statement = db.prepare(`
    INSERT INTO world_memory_chunks(
      chunk_id, source_page_id, source_revision, chunk_index, journey_id, region_id,
      world_start_time, world_end_time, source_expires_at, title, content, cjk_tokens, content_hash,
      source_event_ids_json, canon_status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'solidified', ?, ?)
    ON CONFLICT(source_page_id, chunk_index) DO UPDATE SET
      chunk_id = excluded.chunk_id,
      source_revision = excluded.source_revision,
      journey_id = excluded.journey_id,
      region_id = excluded.region_id,
      world_start_time = excluded.world_start_time,
      world_end_time = excluded.world_end_time,
      source_expires_at = excluded.source_expires_at,
      title = excluded.title,
      content = excluded.content,
      cjk_tokens = excluded.cjk_tokens,
      source_event_ids_json = excluded.source_event_ids_json,
      content_hash = excluded.content_hash,
      embedding_blob = CASE
        WHEN world_memory_chunks.content_hash = excluded.content_hash THEN world_memory_chunks.embedding_blob
        ELSE NULL END,
      embedding_dimension = CASE
        WHEN world_memory_chunks.content_hash = excluded.content_hash THEN world_memory_chunks.embedding_dimension
        ELSE NULL END,
      embedding_model = CASE
        WHEN world_memory_chunks.content_hash = excluded.content_hash THEN world_memory_chunks.embedding_model
        ELSE NULL END,
      embedding_state = CASE
        WHEN world_memory_chunks.content_hash = excluded.content_hash THEN world_memory_chunks.embedding_state
        ELSE 'pending' END,
      embedding_attempts = CASE
        WHEN world_memory_chunks.content_hash = excluded.content_hash THEN world_memory_chunks.embedding_attempts
        ELSE 0 END,
      embedding_lease_token = NULL,
      embedding_lease_expires_at = NULL,
      embedding_retry_after = NULL,
      embedding_last_error = NULL,
      lsh_version = ${WORLD_MEMORY_LSH_VERSION},
      updated_at = excluded.updated_at
  `);
  for (const chunk of chunks) {
    const contentHash = sha256(`${chunk.title}\n${chunk.content}`);
    const chunkId = `world_memory:${sha256(`${pageId}:${chunk.index}:${contentHash}`).slice(0, 32)}`;
    statement.run(
      chunkId,
      pageId,
      sourceRevision,
      chunk.index,
      journeyId,
      regionId,
      optionalString(journey.startedAtWorldTime) || null,
      optionalString(journey.dueAtWorldTime) || optionalString(journey.settledAtWorldTime) || null,
      expiresAt || null,
      chunk.title,
      chunk.content,
      cjkWorldMemoryTokens(`${chunk.title}\n${chunk.content}`, 4096).join(" "),
      contentHash,
      JSON.stringify(sourceEventIds),
      timestamp,
      timestamp,
    );
  }
  db.prepare(`
    INSERT INTO world_memory_sources(
      source_page_id, source_revision, page_hash, eligible, chunk_count, expires_at, indexed_at
    ) VALUES (?, ?, ?, 1, ?, ?, ?)
    ON CONFLICT(source_page_id) DO UPDATE SET
      source_revision = excluded.source_revision,
      page_hash = excluded.page_hash,
      eligible = 1,
      chunk_count = excluded.chunk_count,
      expires_at = excluded.expires_at,
      indexed_at = excluded.indexed_at
  `).run(pageId, sourceRevision, pageHash, chunks.length, expiresAt || null, timestamp);
  return chunks.length;
}

export function backfillWorldMemoryFromResultPages(db: DatabaseSync) {
  const rows = db.prepare("SELECT page_json FROM result_pages ORDER BY rowid")
    .all() as { page_json: string }[];
  let chunks = 0;
  for (const row of rows) chunks += indexCanonicalResultPageForWorldMemory(db, JSON.parse(row.page_json));
  db.exec("INSERT INTO world_memory_fts(world_memory_fts) VALUES('rebuild')");
  db.exec("INSERT INTO world_memory_cjk_fts(world_memory_cjk_fts) VALUES('rebuild')");
  setWorldMemoryProjectionDirty(db, false);
  return chunks;
}

export function synchronizeWorldMemoryFromResultPages(dbPath: string) {
  const db = openWorldMemoryDb(dbPath);
  let transactionStarted = false;
  try {
    db.exec("BEGIN IMMEDIATE");
    transactionStarted = true;
    const resultPagesTable = db.prepare(`
      SELECT 1 AS present FROM sqlite_master WHERE type = 'table' AND name = 'result_pages'
    `).get();
    if (!resultPagesTable) {
      setWorldMemoryProjectionDirty(db, false);
      db.exec("COMMIT");
      transactionStarted = false;
      return { pages: 0, chunks: 0 };
    }
    const rows = db.prepare("SELECT page_json FROM result_pages ORDER BY rowid")
      .all() as { page_json: string }[];
    db.exec(`
      DELETE FROM world_memory_chunks
      WHERE source_page_id NOT IN (SELECT page_id FROM result_pages);
      DELETE FROM world_memory_sources
      WHERE source_page_id NOT IN (SELECT page_id FROM result_pages);
    `);
    let chunks = 0;
    for (const row of rows) chunks += indexCanonicalResultPageForWorldMemory(db, JSON.parse(row.page_json));
    setWorldMemoryProjectionDirty(db, false);
    db.exec("COMMIT");
    transactionStarted = false;
    return { pages: rows.length, chunks };
  } catch (error) {
    if (transactionStarted) db.exec("ROLLBACK");
    throw error;
  } finally {
    db.close();
  }
}

export function worldMemoryProjectionNeedsSync(dbPath: string) {
  const db = new DatabaseSync(dbPath);
  try {
    db.exec("PRAGMA busy_timeout = 5000");
    const metaTable = db.prepare(`
      SELECT 1 AS present FROM sqlite_master WHERE type = 'table' AND name = 'world_memory_meta'
    `).get();
    if (!metaTable) return true;
    const row = db.prepare("SELECT value FROM world_memory_meta WHERE key = ?")
      .get(WORLD_MEMORY_PROJECTION_DIRTY_META_KEY) as { value: string } | undefined;
    return row?.value !== "0";
  } finally {
    db.close();
  }
}

function openWorldMemoryDb(dbPath: string) {
  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA busy_timeout = 5000");
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");
  initializeWorldMemorySchema(db);
  return db;
}

export function claimWorldMemoryChunks(dbPath: string, limit: number, leaseMs = 60_000): ClaimedWorldMemoryChunk[] {
  const boundedLimit = Math.max(1, Math.min(Number.isSafeInteger(limit) ? limit : 8, 64));
  const db = openWorldMemoryDb(dbPath);
  const leaseToken = randomUUID();
  const claimedAt = nowIso();
  const leaseExpiresAt = new Date(Date.now() + leaseMs).toISOString();
  try {
    db.exec("BEGIN IMMEDIATE");
    db.prepare(`
      UPDATE world_memory_chunks
      SET embedding_state = 'pending', embedding_lease_token = NULL, embedding_lease_expires_at = NULL
      WHERE embedding_state = 'processing' AND embedding_lease_expires_at <= ?
    `).run(claimedAt);
    const rows = db.prepare(`
      SELECT row_id, chunk_id, content
      FROM world_memory_chunks
      WHERE embedding_state IN ('pending', 'failed')
        AND (embedding_retry_after IS NULL OR embedding_retry_after <= ?)
      ORDER BY row_id
      LIMIT ?
    `).all(claimedAt, boundedLimit) as { row_id: number; chunk_id: string; content: string }[];
    const update = db.prepare(`
      UPDATE world_memory_chunks
      SET embedding_state = 'processing', embedding_lease_token = ?, embedding_lease_expires_at = ?, updated_at = ?
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

function mix32(value: number) {
  let result = value >>> 0;
  result ^= result >>> 16;
  result = Math.imul(result, 0x7feb352d) >>> 0;
  result ^= result >>> 15;
  result = Math.imul(result, 0x846ca68b) >>> 0;
  result ^= result >>> 16;
  return result >>> 0;
}

function xorshift32(value: number) {
  let result = value >>> 0;
  result ^= result << 13;
  result ^= result >>> 17;
  result ^= result << 5;
  return result >>> 0;
}

const hyperplanesByDimension = new Map<number, readonly Int8Array[]>();

function hyperplanesForDimension(dimension: number) {
  const existing = hyperplanesByDimension.get(dimension);
  if (existing) return existing;
  const planes: Int8Array[] = [];
  const count = WORLD_MEMORY_LSH_TABLE_COUNT * WORLD_MEMORY_LSH_BITS_PER_TABLE;
  for (let plane = 0; plane < count; plane += 1) {
    let state = mix32(0x6d2b79f5 ^ Math.imul(dimension, 0x9e3779b9) ^ Math.imul(plane, 0x85ebca6b));
    const signs = new Int8Array(dimension);
    for (let component = 0; component < dimension; component += 1) {
      state = xorshift32(state);
      signs[component] = (state & 1) === 0 ? -1 : 1;
    }
    planes.push(signs);
  }
  hyperplanesByDimension.set(dimension, planes);
  return planes;
}

function worldMemoryLshSignatures(normalized: Float32Array) {
  const hyperplanes = hyperplanesForDimension(normalized.length);
  const signatures: number[] = [];
  for (let table = 0; table < WORLD_MEMORY_LSH_TABLE_COUNT; table += 1) {
    let signature = 0;
    for (let bit = 0; bit < WORLD_MEMORY_LSH_BITS_PER_TABLE; bit += 1) {
      const signs = hyperplanes[table * WORLD_MEMORY_LSH_BITS_PER_TABLE + bit]!;
      let dot = 0;
      for (let component = 0; component < normalized.length; component += 1) {
        dot += normalized[component]! * signs[component]!;
      }
      if (dot >= 0) signature |= 1 << bit;
    }
    signatures.push(signature);
  }
  return signatures;
}

export function completeWorldMemoryChunkEmbeddings(
  dbPath: string,
  claims: readonly ClaimedWorldMemoryChunk[],
  vectors: readonly (readonly number[])[],
  profile: WorldMemoryEmbeddingProfile,
  behaviorVectors: readonly (readonly number[])[] = [],
) {
  if (claims.length === 0 || claims.length !== vectors.length) throw new Error("world_memory_embedding_batch_count_invalid");
  const normalized = vectors.map(normalizeWorldMemoryVector);
  const db = openWorldMemoryDb(dbPath);
  try {
    db.exec("BEGIN IMMEDIATE");
    bindOrValidateWorldMemoryProfile(db, profile, behaviorVectors);
    const update = db.prepare(`
      UPDATE world_memory_chunks
      SET embedding_blob = ?, embedding_dimension = ?, embedding_model = ?, embedding_state = 'ready',
        embedding_lease_token = NULL, embedding_lease_expires_at = NULL, embedding_retry_after = NULL,
        embedding_last_error = NULL, lsh_version = ?, updated_at = ?
      WHERE row_id = ? AND embedding_state = 'processing' AND embedding_lease_token = ?
    `);
    const deleteBuckets = db.prepare("DELETE FROM world_memory_lsh_buckets WHERE chunk_row_id = ?");
    const insertBucket = db.prepare(`
      INSERT INTO world_memory_lsh_buckets(chunk_row_id, table_no, bucket, lsh_version)
      VALUES (?, ?, ?, ?)
    `);
    for (let index = 0; index < claims.length; index += 1) {
      const claim = claims[index]!;
      const embedding = normalized[index]!;
      const result = update.run(
        encodeWorldMemoryVector(embedding),
        WORLD_MEMORY_EMBEDDING_DIMENSION,
        profile.model,
        WORLD_MEMORY_LSH_VERSION,
        nowIso(),
        claim.rowId,
        claim.leaseToken,
      );
      if (Number(result.changes) !== 1) throw new Error("world_memory_embedding_lease_lost");
      deleteBuckets.run(claim.rowId);
      worldMemoryLshSignatures(embedding).forEach((bucket, tableNo) => {
        insertBucket.run(claim.rowId, tableNo, bucket, WORLD_MEMORY_LSH_VERSION);
      });
    }
    db.exec("COMMIT");
  } catch (error) {
    try { db.exec("ROLLBACK"); } catch { /* transaction did not start */ }
    throw error;
  } finally {
    db.close();
  }
}

export function failWorldMemoryChunkEmbeddings(
  dbPath: string,
  claims: readonly ClaimedWorldMemoryChunk[],
  errorCode: string,
) {
  if (claims.length === 0) return;
  const db = openWorldMemoryDb(dbPath);
  const attempts = db.prepare("SELECT embedding_attempts FROM world_memory_chunks WHERE row_id = ?");
  const update = db.prepare(`
    UPDATE world_memory_chunks
    SET embedding_state = 'failed', embedding_attempts = embedding_attempts + 1,
      embedding_lease_token = NULL, embedding_lease_expires_at = NULL,
      embedding_retry_after = ?, embedding_last_error = ?, updated_at = ?
    WHERE row_id = ? AND embedding_lease_token = ?
  `);
  try {
    db.exec("BEGIN IMMEDIATE");
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

function filterClause(input: WorldMemorySearchInput, alias: string, searchAt: string) {
  const clauses: string[] = [
    `${alias}.canon_status = 'solidified'`,
    `(${alias}.source_expires_at IS NULL OR ${alias}.source_expires_at > ?)`,
  ];
  const values: SqlValue[] = [searchAt];
  if (optionalString(input.regionId)) {
    clauses.push(`${alias}.region_id = ?`);
    values.push(String(input.regionId).trim());
  }
  if (optionalString(input.fromWorldTime)) {
    clauses.push(`(${alias}.world_end_time IS NULL OR ${alias}.world_end_time >= ?)`);
    values.push(String(input.fromWorldTime).trim());
  }
  if (optionalString(input.toWorldTime)) {
    clauses.push(`(${alias}.world_start_time IS NULL OR ${alias}.world_start_time <= ?)`);
    values.push(String(input.toWorldTime).trim());
  }
  return { sql: clauses.join(" AND "), values };
}

function ftsMatchExpression(query: string) {
  const terms = [...query.matchAll(/[\p{L}\p{N}_-]+/gu)]
    .map((match) => match[0].trim()).filter(Boolean).slice(0, 16);
  return terms.map((term) => `"${term.replaceAll("\"", "\"\"")}"`).join(" OR ");
}

function lexicalRowIds(db: DatabaseSync, input: WorldMemorySearchInput, limit: number, searchAt: string) {
  const filters = filterClause(input, "c", searchAt);
  const ranks = new Map<number, number>();
  const standardExpression = ftsMatchExpression(input.query);
  if (standardExpression) {
    const rows = db.prepare(`
      SELECT c.row_id, bm25(world_memory_fts) AS rank
      FROM world_memory_fts
      JOIN world_memory_chunks AS c ON c.row_id = world_memory_fts.rowid
      WHERE world_memory_fts MATCH ? AND ${filters.sql}
      ORDER BY rank
      LIMIT ?
    `).all(standardExpression, ...filters.values, limit) as { row_id: number; rank: number }[];
    rows.forEach((row, index) => ranks.set(Number(row.row_id), index + 1));
  }
  const cjkTokens = cjkWorldMemoryTokens(input.query, 32);
  if (cjkTokens.length) {
    const expression = cjkTokens.map((token) => `"${token.replaceAll("\"", "\"\"")}"`).join(" OR ");
    const rows = db.prepare(`
      SELECT c.row_id, bm25(world_memory_cjk_fts) AS rank
      FROM world_memory_cjk_fts
      JOIN world_memory_chunks AS c ON c.row_id = world_memory_cjk_fts.rowid
      WHERE world_memory_cjk_fts MATCH ? AND ${filters.sql}
      ORDER BY rank
      LIMIT ?
    `).all(expression, ...filters.values, limit) as { row_id: number; rank: number }[];
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

function lshProbes(normalized: Float32Array, radius: 1 | 2) {
  const probes: LshProbe[] = [];
  worldMemoryLshSignatures(normalized).forEach((base, tableNo) => {
    probes.push({ tableNo, bucket: base });
    for (let first = 0; first < WORLD_MEMORY_LSH_BITS_PER_TABLE; first += 1) {
      probes.push({ tableNo, bucket: base ^ (1 << first) });
    }
    if (radius === 2) {
      for (let first = 0; first < WORLD_MEMORY_LSH_BITS_PER_TABLE; first += 1) {
        for (let second = first + 1; second < WORLD_MEMORY_LSH_BITS_PER_TABLE; second += 1) {
          probes.push({ tableNo, bucket: base ^ (1 << first) ^ (1 << second) });
        }
      }
    }
  });
  return probes;
}

function exactCandidateIds(db: DatabaseSync, input: WorldMemorySearchInput, searchAt: string) {
  const filters = filterClause(input, "c", searchAt);
  const rows = db.prepare(`
    SELECT c.row_id
    FROM world_memory_chunks AS c
    WHERE c.embedding_state = 'ready' AND ${filters.sql}
    ORDER BY c.row_id
  `).all(...filters.values) as { row_id: number }[];
  return rows.map((row) => Number(row.row_id));
}

function lshCandidateIds(
  db: DatabaseSync,
  input: WorldMemorySearchInput,
  normalized: Float32Array,
  radius: 1 | 2,
  searchAt: string,
) {
  db.exec(`
    CREATE TEMP TABLE IF NOT EXISTS temp_world_memory_lsh_probes (
      table_no INTEGER NOT NULL,
      bucket INTEGER NOT NULL,
      PRIMARY KEY(table_no, bucket)
    ) WITHOUT ROWID;
    DELETE FROM temp_world_memory_lsh_probes;
  `);
  const insert = db.prepare("INSERT OR IGNORE INTO temp_world_memory_lsh_probes(table_no, bucket) VALUES (?, ?)");
  for (const probe of lshProbes(normalized, radius)) insert.run(probe.tableNo, probe.bucket);
  const filters = filterClause(input, "c", searchAt);
  const rows = db.prepare(`
    SELECT b.chunk_row_id, COUNT(*) AS collisions
    FROM temp_world_memory_lsh_probes AS p
    JOIN world_memory_lsh_buckets AS b INDEXED BY idx_world_memory_lsh_lookup
      ON b.lsh_version = ${WORLD_MEMORY_LSH_VERSION}
      AND b.table_no = p.table_no AND b.bucket = p.bucket
    JOIN world_memory_chunks AS c ON c.row_id = b.chunk_row_id
    WHERE c.embedding_state = 'ready' AND ${filters.sql}
    GROUP BY b.chunk_row_id
    ORDER BY collisions DESC, b.chunk_row_id
    LIMIT ${WORLD_MEMORY_MAX_VECTOR_CANDIDATES}
  `).all(...filters.values) as { chunk_row_id: number }[];
  db.exec("DELETE FROM temp_world_memory_lsh_probes");
  return rows.map((row) => Number(row.chunk_row_id));
}

function vectorRows(
  db: DatabaseSync,
  input: WorldMemorySearchInput,
  normalized: Float32Array,
  limit: number,
  searchAt: string,
) {
  const filters = filterClause(input, "c", searchAt);
  const count = db.prepare(`
    SELECT COUNT(*) AS count FROM world_memory_chunks AS c
    WHERE c.embedding_state = 'ready' AND ${filters.sql}
  `).get(...filters.values) as { count: number };
  let candidateIds: number[];
  if (Number(count.count) <= WORLD_MEMORY_EXACT_SEARCH_THRESHOLD) {
    candidateIds = exactCandidateIds(db, input, searchAt);
  } else {
    candidateIds = lshCandidateIds(db, input, normalized, 1, searchAt);
    if (candidateIds.length < Math.max(64, limit * 8)) {
      candidateIds = lshCandidateIds(db, input, normalized, 2, searchAt);
    }
  }
  const ranked: RankedVectorRow[] = [];
  const batchSize = 500;
  for (let offset = 0; offset < candidateIds.length; offset += batchSize) {
    const ids = candidateIds.slice(offset, offset + batchSize);
    if (ids.length === 0) continue;
    const placeholders = ids.map(() => "?").join(",");
    const rows = db.prepare(`
      SELECT row_id, embedding_blob, embedding_dimension
      FROM world_memory_chunks
      WHERE row_id IN (${placeholders})
    `).all(...ids) as { row_id: number; embedding_blob: Uint8Array; embedding_dimension: number }[];
    for (const row of rows) {
      ranked.push({
        rowId: Number(row.row_id),
        similarity: cosineSimilarity(normalized, decodeWorldMemoryVector(row.embedding_blob, row.embedding_dimension)),
      });
    }
  }
  return ranked.sort((left, right) => right.similarity - left.similarity).slice(0, limit);
}

function loadChunkRows(db: DatabaseSync, rowIds: readonly number[], searchAt: string) {
  if (rowIds.length === 0) return new Map<number, WorldMemoryChunkRow>();
  const placeholders = rowIds.map(() => "?").join(",");
  const rows = db.prepare(`
    SELECT row_id, chunk_id, source_page_id, journey_id, region_id, world_start_time, world_end_time,
      source_expires_at, title, content, source_event_ids_json, embedding_blob, embedding_dimension
    FROM world_memory_chunks
    WHERE row_id IN (${placeholders})
      AND (source_expires_at IS NULL OR source_expires_at > ?)
  `).all(...rowIds, searchAt) as unknown as WorldMemoryChunkRow[];
  return new Map(rows.map((row) => [Number(row.row_id), row] as const));
}

export function searchWorldMemory(
  dbPath: string,
  input: WorldMemorySearchInput,
  options: { readonly now?: Date } = {},
): WorldMemorySearchResult {
  const query = input.query.trim();
  if (!query || query.length > 500) throw new Error("world_memory_query_invalid");
  const limit = Math.max(1, Math.min(Number.isSafeInteger(input.limit) ? Number(input.limit) : 10, 30));
  if (input.fromWorldTime && input.toWorldTime && input.fromWorldTime > input.toWorldTime) {
    throw new Error("world_memory_time_range_invalid");
  }
  const searchNow = options.now || new Date();
  if (!Number.isFinite(searchNow.getTime())) throw new Error("world_memory_search_time_invalid");
  const searchAt = searchNow.toISOString();
  const db = openWorldMemoryDb(dbPath);
  try {
    const lexical = lexicalRowIds(db, { ...input, query }, Math.max(100, limit * 10), searchAt);
    let vector: RankedVectorRow[] = [];
    if (input.queryEmbedding) {
      if (!input.embeddingProfile) throw new Error("world_memory_embedding_profile_required");
      bindOrValidateWorldMemoryProfile(db, input.embeddingProfile, input.embeddingBehaviorVectors || []);
      vector = vectorRows(
        db,
        input,
        normalizeWorldMemoryVector(input.queryEmbedding),
        Math.max(100, limit * 10),
        searchAt,
      );
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
    const rankedIds = [...scores.entries()]
      .sort((left, right) => right[1] - left[1] || left[0] - right[0])
      .slice(0, limit);
    const rows = loadChunkRows(db, rankedIds.map(([rowId]) => rowId), searchAt);
    const hits = rankedIds.flatMap(([rowId, score]) => {
      const row = rows.get(rowId);
      if (!row) return [];
      const vectorRank = vectorRanks.get(rowId);
      let sourceEventIds: string[] = [];
      try { sourceEventIds = stringArray(JSON.parse(row.source_event_ids_json)); } catch { sourceEventIds = []; }
      return [{
        chunkId: row.chunk_id,
        sourcePageId: row.source_page_id,
        journeyId: row.journey_id,
        regionId: row.region_id,
        title: row.title,
        content: row.content,
        ...(row.world_start_time ? { worldStartTime: row.world_start_time } : {}),
        ...(row.world_end_time ? { worldEndTime: row.world_end_time } : {}),
        sourceEventIds,
        ...(lexicalRanks.has(rowId) ? { lexicalRank: lexicalRanks.get(rowId) } : {}),
        ...(vectorRank ? { vectorRank: vectorRank.rank, cosineSimilarity: vectorRank.similarity } : {}),
        score,
      } satisfies WorldMemorySearchHit];
    });
    return {
      retrievalMode: input.queryEmbedding ? "hybrid" : "lexical",
      query,
      filters: {
        ...(optionalString(input.regionId) ? { regionId: String(input.regionId).trim() } : {}),
        ...(optionalString(input.fromWorldTime) ? { fromWorldTime: String(input.fromWorldTime).trim() } : {}),
        ...(optionalString(input.toWorldTime) ? { toWorldTime: String(input.toWorldTime).trim() } : {}),
      },
      hits,
    };
  } finally {
    db.close();
  }
}

export function worldMemoryIndexStatus(dbPath: string): WorldMemoryIndexStatus {
  const db = openWorldMemoryDb(dbPath);
  try {
    const rows = db.prepare(`
      SELECT embedding_state AS state, COUNT(*) AS count
      FROM world_memory_chunks
      GROUP BY embedding_state
    `).all() as { state: "pending" | "processing" | "ready" | "failed"; count: number }[];
    const counts = new Map(rows.map((row) => [row.state, Number(row.count)] as const));
    const profileRow = db.prepare("SELECT value FROM world_memory_meta WHERE key = ?")
      .get(WORLD_MEMORY_PROFILE_META_KEY) as { value: string } | undefined;
    const pending = counts.get("pending") || 0;
    const processing = counts.get("processing") || 0;
    const ready = counts.get("ready") || 0;
    const failed = counts.get("failed") || 0;
    return {
      chunks: pending + processing + ready + failed,
      pending,
      processing,
      ready,
      failed,
      ...(profileRow ? { embeddingProfile: decodeEmbeddingProfile(profileRow.value) } : {}),
    };
  } finally {
    db.close();
  }
}
