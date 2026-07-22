import {
  buildKnowledgeState,
  canAccessKnowledgeRecord,
  type EpochKnowledgeCaller,
  type EpochKnowledgeInputSource,
  type EpochKnowledgeInputItem,
  type EpochKnowledgeInputVisibility,
  type EpochKnowledgeKind,
  type EpochKnowledgeLegalAccess,
  type EpochKnowledgeRecord,
} from "./knowledgeStateRules.ts";

export type SearchHitSource = "memory" | "knowledge" | "merged";

export interface WorldMemoryLikeHit {
  readonly chunkId: string;
  readonly sourcePageId?: string;
  readonly journeyId?: string;
  readonly regionId?: string;
  readonly title?: string;
  readonly content: string;
  readonly worldStartTime?: string;
  readonly worldEndTime?: string;
  readonly sourceEventIds?: readonly string[];
  readonly source?: EpochKnowledgeInputSource;
  readonly visibility?: EpochKnowledgeInputVisibility;
  readonly legalAccess?: EpochKnowledgeLegalAccess;
  readonly lexicalRank?: number;
  readonly vectorRank?: number;
  readonly cosineSimilarity?: number;
  readonly score?: number;
}

export interface WorldKnowledgeLikeHit {
  readonly chunkId: string;
  readonly sourceId?: string;
  readonly collection?: string;
  readonly entityId?: string;
  readonly label?: string;
  readonly sourcePath?: string;
  readonly regionIds?: readonly string[];
  readonly source?: EpochKnowledgeInputSource;
  readonly visibility?: EpochKnowledgeInputVisibility;
  readonly legalAccess?: EpochKnowledgeLegalAccess;
  readonly content: string;
  readonly lexicalRank?: number;
  readonly vectorRank?: number;
  readonly cosineSimilarity?: number;
  readonly score?: number;
}

export interface EpochKnowledgeViewHit {
  readonly id: string;
  readonly source: SearchHitSource;
  readonly kind: EpochKnowledgeKind;
  readonly title: string;
  readonly content: string;
  readonly confidence: number;
  readonly score: number;
  readonly regionIds: readonly string[];
  readonly evidenceIds: readonly string[];
  readonly sourceChain: EpochKnowledgeRecord["evidence"]["sourceChain"];
  readonly record?: EpochKnowledgeRecord;
  readonly memory?: WorldMemoryLikeHit;
  readonly knowledge?: WorldKnowledgeLikeHit;
}

export interface EpochKnowledgeViewInput {
  readonly caller?: EpochKnowledgeCaller;
  readonly query?: string;
  readonly regionId?: string;
  readonly organizationId?: string;
  readonly evidenceIds?: readonly string[];
  readonly kinds?: readonly EpochKnowledgeKind[];
  readonly limit?: number;
  readonly records?: readonly EpochKnowledgeInputItem[];
  readonly memoryHits?: readonly WorldMemoryLikeHit[];
  readonly knowledgeHits?: readonly WorldKnowledgeLikeHit[];
}

export interface EpochKnowledgeView {
  readonly query?: string;
  readonly caller: EpochKnowledgeCaller;
  readonly filters: {
    readonly regionId?: string;
    readonly organizationId?: string;
    readonly evidenceIds: readonly string[];
    readonly kinds: readonly EpochKnowledgeKind[];
  };
  readonly hits: readonly EpochKnowledgeViewHit[];
  readonly totals: {
    readonly visibleRecords: number;
    readonly memoryHits: number;
    readonly knowledgeHits: number;
    readonly mergedHits: number;
    readonly excludedHits: number;
  };
  readonly guidance: {
    readonly separation: string;
    readonly authorization: string;
    readonly refutation: string;
  };
}

const VIEW_KINDS: readonly EpochKnowledgeKind[] = [
  "fact",
  "observation",
  "claim",
  "belief",
  "rumor",
  "deception",
  "refutation",
  "memory",
] as const;

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function uniqueSorted(values: readonly (string | undefined)[]): readonly string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value?.trim()))
    .map((value) => value.trim()))].sort();
}

function normalizeLimit(value: unknown) {
  return Math.max(1, Math.min(Number.isSafeInteger(value) ? Number(value) : 12, 50));
}

function recordMatchesFilters(
  record: EpochKnowledgeRecord,
  input: EpochKnowledgeViewInput,
  kinds: readonly EpochKnowledgeKind[],
) {
  if (!kinds.includes(record.kind)) return false;
  if (input.regionId && !record.visibility.regionIds.includes(input.regionId) && !record.visibility.scopes.includes("public")) return false;
  if (input.organizationId && !record.visibility.organizationIds.includes(input.organizationId)) return false;
  if (input.evidenceIds?.length && !input.evidenceIds.some((id) => record.visibility.evidenceIds.includes(id))) return false;
  return true;
}

function hasLawfulSource(source: EpochKnowledgeInputSource | undefined) {
  return Boolean(optionalString(source?.sourceId))
    && Boolean(source?.trustClass)
    && Boolean(source?.sourceAuthority)
    && source?.trustClass !== "untrusted_client"
    && source?.sourceAuthority !== "low-confidence";
}

function explicitVisibilityForExternalHit(
  hit: {
    readonly source?: EpochKnowledgeInputSource;
    readonly visibility?: EpochKnowledgeInputVisibility;
    readonly legalAccess?: EpochKnowledgeLegalAccess;
  },
): EpochKnowledgeInputVisibility | undefined {
  if (hit.visibility) return hit.visibility;
  if (hit.legalAccess === "public" && hasLawfulSource(hit.source)) {
    return {
      scopes: ["public"],
      legalAccess: "public",
    };
  }
  return undefined;
}

function recordHit(record: EpochKnowledgeRecord): EpochKnowledgeViewHit {
  return {
    id: `record:${record.id}`,
    source: record.kind === "memory" ? "memory" : "knowledge",
    kind: record.kind,
    title: record.subject || record.id,
    content: record.text,
    confidence: record.confidence,
    score: record.confidence,
    regionIds: record.visibility.regionIds,
    evidenceIds: record.evidence.evidenceIds,
    sourceChain: record.evidence.sourceChain,
    record,
  };
}

function memoryHit(hit: WorldMemoryLikeHit): EpochKnowledgeViewHit {
  const evidenceIds = uniqueSorted(hit.sourceEventIds || []);
  const confidence = Math.max(0, Math.min(1, 0.48 + Math.min(Number(hit.score || 0), 1) * 0.25));
  const record = externalHitRecord({
    id: `memory:${hit.chunkId}`,
    source: "memory",
    kind: "memory",
    title: hit.title || hit.sourcePageId || hit.chunkId,
    content: hit.content,
    confidence,
    score: Number(hit.score || 0),
    regionIds: uniqueSorted([hit.regionId]),
    evidenceIds,
    sourceInput: hit.source,
    fallbackSource: {
      sourceId: hit.sourcePageId || hit.chunkId,
      sourceType: "world_memory",
      trustClass: "user_verified_web",
      sourceAuthority: "derived",
      channel: "memory",
      hop: 1,
      ...(hit.worldEndTime || hit.worldStartTime ? { observedAt: hit.worldEndTime || hit.worldStartTime } : {}),
      evidenceIds,
      confirmationBias: 0.2,
    },
    visibility: explicitVisibilityForExternalHit(hit),
    memory: hit,
  });
  if (record) return record;
  return {
    id: `memory:${hit.chunkId}`,
    source: "memory",
    kind: "memory",
    title: hit.title || hit.sourcePageId || hit.chunkId,
    content: hit.content,
    confidence,
    score: Number(hit.score || 0),
    regionIds: uniqueSorted([hit.regionId]),
    evidenceIds,
    sourceChain: [{
      sourceId: hit.sourcePageId || hit.chunkId,
      sourceType: "world_memory",
      trustClass: "user_verified_web",
      sourceAuthority: "derived",
      channel: "memory",
      hop: 1,
      ...(hit.worldEndTime || hit.worldStartTime ? { observedAt: hit.worldEndTime || hit.worldStartTime } : {}),
      evidenceIds,
      confirmationBias: 0.2,
    }],
    memory: hit,
  };
}

function knowledgeHit(hit: WorldKnowledgeLikeHit): EpochKnowledgeViewHit {
  const collectionKind: EpochKnowledgeKind = hit.collection === "rules" || hit.collection === "systems" ? "fact" : "claim";
  const evidenceIds = uniqueSorted([hit.sourceId, hit.sourcePath]);
  const confidence = collectionKind === "fact" ? 0.96 : 0.82;
  const record = externalHitRecord({
    id: `knowledge:${hit.chunkId}`,
    source: "knowledge",
    kind: collectionKind,
    title: hit.label || hit.entityId || hit.sourceId || hit.chunkId,
    content: hit.content,
    confidence,
    score: Number(hit.score || 0),
    regionIds: uniqueSorted(hit.regionIds || []),
    evidenceIds,
    sourceInput: hit.source,
    fallbackSource: {
      sourceId: hit.sourceId || hit.chunkId,
      sourceType: "world_knowledge",
      trustClass: "system_worker",
      sourceAuthority: "core",
      channel: "canonical",
      hop: 0,
      evidenceIds,
      confirmationBias: 0,
    },
    visibility: explicitVisibilityForExternalHit(hit),
    knowledge: hit,
  });
  if (record) return record;
  return {
    id: `knowledge:${hit.chunkId}`,
    source: "knowledge",
    kind: collectionKind,
    title: hit.label || hit.entityId || hit.sourceId || hit.chunkId,
    content: hit.content,
    confidence,
    score: Number(hit.score || 0),
    regionIds: uniqueSorted(hit.regionIds || []),
    evidenceIds,
    sourceChain: [{
      sourceId: hit.sourceId || hit.chunkId,
      sourceType: "world_knowledge",
      trustClass: "system_worker",
      sourceAuthority: "core",
      channel: "canonical",
      hop: 0,
      evidenceIds,
      confirmationBias: 0,
    }],
    knowledge: hit,
  };
}

function externalHitRecord(input: {
  readonly id: string;
  readonly source: SearchHitSource;
  readonly kind: EpochKnowledgeKind;
  readonly title: string;
  readonly content: string;
  readonly confidence: number;
  readonly score: number;
  readonly regionIds: readonly string[];
  readonly evidenceIds: readonly string[];
  readonly sourceInput?: EpochKnowledgeInputSource;
  readonly fallbackSource: EpochKnowledgeInputSource;
  readonly visibility?: EpochKnowledgeInputVisibility;
  readonly memory?: WorldMemoryLikeHit;
  readonly knowledge?: WorldKnowledgeLikeHit;
}): EpochKnowledgeViewHit | undefined {
  if (!input.visibility) return undefined;
  const record = buildKnowledgeState([{
    id: input.id,
    kind: input.kind,
    subject: input.title,
    text: input.content,
    confidence: input.confidence,
    source: input.sourceInput || input.fallbackSource,
    visibility: input.visibility,
    regionIds: input.regionIds,
    evidenceIds: input.evidenceIds,
  }]).records[0];
  if (!record) return undefined;
  return {
    id: input.id,
    source: input.source,
    kind: record.kind,
    title: record.subject || record.id,
    content: record.text,
    confidence: record.confidence,
    score: input.score,
    regionIds: record.visibility.regionIds,
    evidenceIds: record.evidence.evidenceIds,
    sourceChain: record.evidence.sourceChain,
    record,
    ...(input.memory ? { memory: input.memory } : {}),
    ...(input.knowledge ? { knowledge: input.knowledge } : {}),
  };
}

function mergeHits(hits: readonly EpochKnowledgeViewHit[]) {
  const byKey = new Map<string, EpochKnowledgeViewHit>();
  for (const hit of hits) {
    const key = `${hit.title.toLocaleLowerCase("zh-CN")}:${hit.content.toLocaleLowerCase("zh-CN")}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, hit);
      continue;
    }
    byKey.set(key, {
      ...existing,
      source: existing.source === hit.source ? existing.source : "merged",
      confidence: Math.max(existing.confidence, hit.confidence),
      score: Math.max(existing.score, hit.score),
      regionIds: uniqueSorted([...existing.regionIds, ...hit.regionIds]),
      evidenceIds: uniqueSorted([...existing.evidenceIds, ...hit.evidenceIds]),
      sourceChain: [...existing.sourceChain, ...hit.sourceChain],
      record: existing.record || hit.record,
      memory: existing.memory || hit.memory,
      knowledge: existing.knowledge || hit.knowledge,
    });
  }
  return [...byKey.values()].sort((left, right) =>
    right.confidence - left.confidence
    || right.score - left.score
    || left.id.localeCompare(right.id));
}

export function knowledgeView(input: EpochKnowledgeViewInput = {}): EpochKnowledgeView {
  const caller = input.caller || {};
  const limit = normalizeLimit(input.limit);
  const kinds = (input.kinds?.length ? input.kinds : VIEW_KINDS)
    .filter((kind, index, values) => VIEW_KINDS.includes(kind) && values.indexOf(kind) === index);
  const requestedEvidenceIds = uniqueSorted([...(input.evidenceIds || []), ...(caller.evidenceIds || [])]);
  const requestedRegionId = optionalString(input.regionId) || caller.regionId;
  const state = buildKnowledgeState(input.records || []);
  const visibleRecords = state.records.filter((record) =>
    canAccessKnowledgeRecord(record, caller) && recordMatchesFilters(record, {
      ...input,
      regionId: requestedRegionId,
      evidenceIds: requestedEvidenceIds,
    }, kinds));
  const visibleRecordHits = visibleRecords.map(recordHit);
  const memoryHits = (input.memoryHits || []).map(memoryHit);
  const knowledgeHits = (input.knowledgeHits || []).map(knowledgeHit);
  const externalHitVisible = (hit: EpochKnowledgeViewHit) =>
    Boolean(hit.record)
      && canAccessKnowledgeRecord(hit.record as EpochKnowledgeRecord, caller)
      && recordMatchesFilters(hit.record as EpochKnowledgeRecord, {
        ...input,
        regionId: requestedRegionId,
        evidenceIds: requestedEvidenceIds,
      }, kinds);
  const visibleMemoryHits = memoryHits.filter(externalHitVisible);
  const visibleKnowledgeHits = knowledgeHits.filter(externalHitVisible);
  const excludedHits = memoryHits.length + knowledgeHits.length - visibleMemoryHits.length - visibleKnowledgeHits.length;
  const hits = mergeHits([...visibleRecordHits, ...visibleMemoryHits, ...visibleKnowledgeHits]).slice(0, limit);
  const query = optionalString(input.query);
  const organizationId = optionalString(input.organizationId);
  return {
    ...(query ? { query } : {}),
    caller,
    filters: {
      ...(requestedRegionId ? { regionId: requestedRegionId } : {}),
      ...(organizationId ? { organizationId } : {}),
      evidenceIds: requestedEvidenceIds,
      kinds,
    },
    hits,
    totals: {
      visibleRecords: visibleRecords.length,
      memoryHits: visibleMemoryHits.length,
      knowledgeHits: visibleKnowledgeHits.length,
      mergedHits: hits.length,
      excludedHits,
    },
    guidance: {
      separation: "Fact/Observation/Claim/Belief/Rumor/Deception/Refutation/Memory remain typed; retrieval hits do not promote memory into global fact.",
      authorization: "View output is caller scoped by public, region, organization, agent, explorer or evidence-bound legal access.",
      refutation: "Refutations mark targets contested/refuted in view state, but beliefs remain present unless the caller lacks visibility.",
    },
  };
}
