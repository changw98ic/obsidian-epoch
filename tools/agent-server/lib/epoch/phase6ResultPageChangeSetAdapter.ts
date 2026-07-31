import type { Phase6ResultPageChangeSet } from "./phase6ResultPageRules.ts";

type UnknownRecord = Readonly<Record<string, unknown>>;

export interface Phase6CanonicalRagMemoryFact {
  readonly key: string;
  readonly value: UnknownRecord;
  readonly text: string;
}

export function buildPhase6ProgressionChangeSet(input: {
  readonly receiptId: string;
  readonly beforeSnapshotBody: unknown;
  readonly afterSnapshotBody: unknown;
  readonly canonicalEventIds: readonly string[];
}): Phase6ResultPageChangeSet {
  const before = canonicalProgressionState(input.beforeSnapshotBody);
  const after = canonicalProgressionState(input.afterSnapshotBody);
  if (stableJson(before) === stableJson(after)) {
    return {
      mode: "no_change",
      changes: [],
      noChangeReason: "canonical_progression_equal",
      eventIds: input.canonicalEventIds,
    };
  }
  return {
    mode: "changed",
    changes: [{
      id: `${input.receiptId}:progression`,
      label: "Canonical progression changed",
      before,
      after,
      eventIds: input.canonicalEventIds,
    }],
    eventIds: input.canonicalEventIds,
  };
}

export function canonicalPhase6RagMemoryFacts(projection: unknown): readonly Phase6CanonicalRagMemoryFact[] {
  const root = asRecord(projection);
  const candidates = ["rag", "ragPanel", "knowledge", "memory", "memories"]
    .flatMap((key) => memoryCandidates(root[key]));
  const byKey = new Map<string, Phase6CanonicalRagMemoryFact>();
  for (const [index, candidate] of candidates.entries()) {
    const memory = canonicalRagMemory(candidate, index);
    if (memory && !byKey.has(memory.key)) byKey.set(memory.key, memory);
  }
  return [...byKey.values()].sort((left, right) => left.key.localeCompare(right.key));
}

function canonicalProgressionState(snapshotBody: unknown): UnknownRecord {
  const body = asRecord(snapshotBody);
  const progression = asRecord(body.progression);
  const cultivation = asRecord(progression.cultivation);
  const functionalStage = cultivation.functionalStage
    ?? progression.functionalStage;
  return compactRecord({
    attributes: body.attributes ?? progression.attributes,
    skills: progression.skills ?? progression.skillTree,
    talents: progression.talents,
    cultivation: functionalStage === undefined ? undefined : { functionalStage },
  });
}

function memoryCandidates(value: unknown): readonly unknown[] {
  if (Array.isArray(value)) return value;
  const record = asRecord(value);
  for (const key of ["hits", "records", "memories", "items"] as const) {
    if (Array.isArray(record[key])) return record[key];
  }
  return isSemanticMemory(record) ? [record] : [];
}

function canonicalRagMemory(value: unknown, index: number): Phase6CanonicalRagMemoryFact | undefined {
  const record = asRecord(value);
  if (!isSemanticMemory(record)) return undefined;
  const evidence = asRecord(record.evidence);
  const id = firstString(record, ["memoryId", "id", "recordId", "chunkId", "key", "pageId"]);
  if (!id) return undefined;
  const sourceEventIds = uniqueStrings([
    ...stringArray(record.sourceEventIds),
    ...stringArray(evidence.sourceEventIds),
  ]);
  const canonical = compactRecord({
    memoryId: id,
    kind: record.kind,
    subject: record.subject,
    title: record.title,
    text: record.text,
    content: record.content,
    summary: record.summary,
    publicSafeSummary: record.publicSafeSummary,
    confidence: record.confidence,
    status: evidence.status ?? record.status,
    refutedBy: evidence.refutedBy ?? record.refutedBy,
    evidenceIds: uniqueStrings([
      ...stringArray(record.evidenceIds),
      ...stringArray(evidence.evidenceIds),
    ]),
    sourceEventIds,
    trust: record.trust,
    sourceChain: record.sourceChain,
    compressedFromIds: record.compressedFromIds,
    sourceMemoryIds: record.sourceMemoryIds,
    supersedes: record.supersedes,
    supersededBy: record.supersededBy,
    version: record.version,
    regionId: record.regionId,
    journeyId: record.journeyId,
    sourcePageId: record.sourcePageId,
    worldStartTime: record.worldStartTime,
    worldEndTime: record.worldEndTime,
  });
  return {
    key: `memory:${id || String(index).padStart(4, "0")}`,
    value: canonical,
    text: stableJson(canonical),
  };
}

function isSemanticMemory(record: UnknownRecord): boolean {
  const hasIdentity = Boolean(firstString(record, ["memoryId", "id", "recordId", "chunkId", "key", "pageId"]));
  const evidence = asRecord(record.evidence);
  const hasSemanticValue = ["text", "content", "summary", "publicSafeSummary", "status"]
    .some((key) => record[key] !== undefined)
    || evidence.status !== undefined
    || stringArray(record.sourceEventIds).length > 0
    || stringArray(evidence.sourceEventIds).length > 0;
  return hasIdentity && hasSemanticValue;
}

function compactRecord(value: UnknownRecord): UnknownRecord {
  return Object.fromEntries(Object.entries(value).filter((entry) => entry[1] !== undefined));
}

function firstString(record: UnknownRecord, keys: readonly string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

function stringArray(value: unknown): readonly string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string" && entry.length > 0)
    : [];
}

function uniqueStrings(values: readonly string[]): readonly string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as UnknownRecord
    : {};
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as UnknownRecord;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}
