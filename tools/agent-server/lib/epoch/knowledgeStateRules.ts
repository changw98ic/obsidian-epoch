export type EpochKnowledgeKind =
  | "fact"
  | "observation"
  | "claim"
  | "belief"
  | "rumor"
  | "deception"
  | "refutation"
  | "memory";

export type EpochKnowledgeTrustClass =
  | "untrusted_client"
  | "user_verified_web"
  | "server_hosted_agent"
  | "host_attested"
  | "remote_attested_runner"
  | "system_worker";

export type EpochKnowledgeSourceAuthority =
  | "core"
  | "official"
  | "derived"
  | "low-confidence";

export type EpochKnowledgeChannel =
  | "canonical"
  | "memory"
  | "direct"
  | "hearsay"
  | "public"
  | "private"
  | "adversarial"
  | "unknown";

export type EpochKnowledgeVisibilityScope =
  | "public"
  | "region"
  | "organization"
  | "agent"
  | "explorer"
  | "evidence";

export type EpochKnowledgeLegalAccess =
  | "public"
  | "owner"
  | "member"
  | "operator"
  | "source-bound";

export interface EpochKnowledgeSourceHop {
  readonly sourceId: string;
  readonly sourceType?: string;
  readonly trustClass: EpochKnowledgeTrustClass;
  readonly sourceAuthority: EpochKnowledgeSourceAuthority;
  readonly channel: EpochKnowledgeChannel;
  readonly hop: number;
  readonly observedAt?: string;
  readonly evidenceIds: readonly string[];
  readonly confirmationBias: number;
}

export interface EpochKnowledgeVisibility {
  readonly scopes: readonly EpochKnowledgeVisibilityScope[];
  readonly legalAccess: EpochKnowledgeLegalAccess;
  readonly regionIds: readonly string[];
  readonly organizationIds: readonly string[];
  readonly agentIds: readonly string[];
  readonly explorerIds: readonly string[];
  readonly evidenceIds: readonly string[];
}

export interface EpochKnowledgeEvidence {
  readonly evidenceIds: readonly string[];
  readonly sourceEventIds: readonly string[];
  readonly sourceChain: readonly EpochKnowledgeSourceHop[];
  readonly trustClasses: readonly EpochKnowledgeTrustClass[];
  readonly sourceAuthorities: readonly EpochKnowledgeSourceAuthority[];
  readonly channels: readonly EpochKnowledgeChannel[];
  readonly hopCount: number;
  readonly firstObservedAt?: string;
  readonly lastObservedAt?: string;
  readonly confirmationBias: number;
}

export interface EpochKnowledgeInputSource {
  readonly sourceId?: string;
  readonly sourceType?: string;
  readonly trustClass?: EpochKnowledgeTrustClass;
  readonly sourceAuthority?: EpochKnowledgeSourceAuthority;
  readonly channel?: EpochKnowledgeChannel;
  readonly hop?: number;
  readonly observedAt?: string;
  readonly evidenceIds?: readonly string[];
  readonly sourceEventIds?: readonly string[];
  readonly confirmationBias?: number;
}

export interface EpochKnowledgeInputVisibility {
  readonly scopes?: readonly EpochKnowledgeVisibilityScope[];
  readonly legalAccess?: EpochKnowledgeLegalAccess;
  readonly regionIds?: readonly string[];
  readonly organizationIds?: readonly string[];
  readonly agentIds?: readonly string[];
  readonly explorerIds?: readonly string[];
  readonly evidenceIds?: readonly string[];
}

export interface EpochKnowledgeInputItem {
  readonly id: string;
  readonly kind: EpochKnowledgeKind;
  readonly subject?: string;
  readonly text: string;
  readonly confidence?: number;
  readonly source?: EpochKnowledgeInputSource;
  readonly sources?: readonly EpochKnowledgeInputSource[];
  readonly visibility?: EpochKnowledgeInputVisibility;
  readonly regionIds?: readonly string[];
  readonly organizationIds?: readonly string[];
  readonly agentIds?: readonly string[];
  readonly explorerIds?: readonly string[];
  readonly evidenceIds?: readonly string[];
  readonly supports?: readonly string[];
  readonly refutes?: readonly string[];
  readonly supersedes?: readonly string[];
  readonly createdAt?: string;
  readonly observedAt?: string;
}

export interface EpochKnowledgeRecord {
  readonly id: string;
  readonly kind: EpochKnowledgeKind;
  readonly subject?: string;
  readonly text: string;
  readonly confidence: number;
  readonly status: "accepted" | "contested" | "refuted";
  readonly evidence: EpochKnowledgeEvidence;
  readonly visibility: EpochKnowledgeVisibility;
  readonly supports: readonly string[];
  readonly refutes: readonly string[];
  readonly refutedBy: readonly string[];
  readonly supersedes: readonly string[];
  readonly createdAt?: string;
  readonly observedAt?: string;
}

export interface EpochKnowledgeState {
  readonly records: readonly EpochKnowledgeRecord[];
  readonly byKind: Readonly<Record<EpochKnowledgeKind, readonly EpochKnowledgeRecord[]>>;
  readonly byId: Readonly<Record<string, EpochKnowledgeRecord>>;
  readonly refutations: readonly EpochKnowledgeRecord[];
}

export interface EpochKnowledgeCaller {
  readonly explorerId?: string;
  readonly agentId?: string;
  readonly regionId?: string;
  readonly organizationIds?: readonly string[];
  readonly evidenceIds?: readonly string[];
  readonly trustClass?: EpochKnowledgeTrustClass;
  readonly legalAccess?: readonly EpochKnowledgeLegalAccess[];
}

const KNOWLEDGE_KINDS: readonly EpochKnowledgeKind[] = [
  "fact",
  "observation",
  "claim",
  "belief",
  "rumor",
  "deception",
  "refutation",
  "memory",
] as const;

const TRUST_CLASSES: readonly EpochKnowledgeTrustClass[] = [
  "untrusted_client",
  "user_verified_web",
  "server_hosted_agent",
  "host_attested",
  "remote_attested_runner",
  "system_worker",
] as const;

const AUTHORITIES: readonly EpochKnowledgeSourceAuthority[] = [
  "core",
  "official",
  "derived",
  "low-confidence",
] as const;

const CHANNELS: readonly EpochKnowledgeChannel[] = [
  "canonical",
  "memory",
  "direct",
  "hearsay",
  "public",
  "private",
  "adversarial",
  "unknown",
] as const;

const SCOPES: readonly EpochKnowledgeVisibilityScope[] = [
  "public",
  "region",
  "organization",
  "agent",
  "explorer",
  "evidence",
] as const;

const LEGAL_ACCESS: readonly EpochKnowledgeLegalAccess[] = [
  "public",
  "owner",
  "member",
  "operator",
  "source-bound",
] as const;

const KIND_BASE_CONFIDENCE: Readonly<Record<EpochKnowledgeKind, number>> = {
  fact: 0.95,
  observation: 0.72,
  claim: 0.56,
  belief: 0.46,
  rumor: 0.28,
  deception: 0.12,
  refutation: 0.64,
  memory: 0.5,
};

const TRUST_WEIGHT: Readonly<Record<EpochKnowledgeTrustClass, number>> = {
  system_worker: 1,
  server_hosted_agent: 0.92,
  host_attested: 0.84,
  remote_attested_runner: 0.76,
  user_verified_web: 0.58,
  untrusted_client: 0.24,
};

const AUTHORITY_WEIGHT: Readonly<Record<EpochKnowledgeSourceAuthority, number>> = {
  core: 1,
  official: 0.86,
  derived: 0.58,
  "low-confidence": 0.24,
};

const CHANNEL_WEIGHT: Readonly<Record<EpochKnowledgeChannel, number>> = {
  canonical: 1,
  direct: 0.82,
  memory: 0.64,
  public: 0.58,
  private: 0.5,
  hearsay: 0.3,
  adversarial: 0.14,
  unknown: 0.42,
};

function isKnowledgeKind(value: unknown): value is EpochKnowledgeKind {
  return typeof value === "string" && KNOWLEDGE_KINDS.includes(value as EpochKnowledgeKind);
}

function normalizeTrustClass(value: unknown): EpochKnowledgeTrustClass {
  return typeof value === "string" && TRUST_CLASSES.includes(value as EpochKnowledgeTrustClass)
    ? value as EpochKnowledgeTrustClass
    : "untrusted_client";
}

function normalizeAuthority(value: unknown, trustClass: EpochKnowledgeTrustClass): EpochKnowledgeSourceAuthority {
  if (typeof value === "string" && AUTHORITIES.includes(value as EpochKnowledgeSourceAuthority)) {
    return value as EpochKnowledgeSourceAuthority;
  }
  if (trustClass === "system_worker") return "core";
  if (trustClass === "untrusted_client") return "low-confidence";
  return "official";
}

function normalizeChannel(value: unknown): EpochKnowledgeChannel {
  return typeof value === "string" && CHANNELS.includes(value as EpochKnowledgeChannel)
    ? value as EpochKnowledgeChannel
    : "unknown";
}

function normalizeScope(value: unknown): EpochKnowledgeVisibilityScope | undefined {
  return typeof value === "string" && SCOPES.includes(value as EpochKnowledgeVisibilityScope)
    ? value as EpochKnowledgeVisibilityScope
    : undefined;
}

function normalizeLegalAccess(value: unknown): EpochKnowledgeLegalAccess {
  return typeof value === "string" && LEGAL_ACCESS.includes(value as EpochKnowledgeLegalAccess)
    ? value as EpochKnowledgeLegalAccess
    : "source-bound";
}

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function uniqueSorted(values: readonly (string | undefined)[]): readonly string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value?.trim()))
    .map((value) => value.trim()))].sort();
}

function uniqueOrdered(values: readonly (string | undefined)[]): readonly string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const normalized = optionalString(value);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

function clamp01(value: unknown, fallback: number) {
  const numeric = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return Math.max(0, Math.min(1, numeric));
}

function normalizeSource(
  source: EpochKnowledgeInputSource | undefined,
  fallbackId: string,
  fallbackObservedAt?: string,
): EpochKnowledgeSourceHop {
  const trustClass = normalizeTrustClass(source?.trustClass);
  const sourceAuthority = normalizeAuthority(source?.sourceAuthority, trustClass);
  const sourceType = optionalString(source?.sourceType);
  const observedAt = optionalString(source?.observedAt) || fallbackObservedAt;
  return {
    sourceId: optionalString(source?.sourceId) || fallbackId,
    ...(sourceType ? { sourceType } : {}),
    trustClass,
    sourceAuthority,
    channel: normalizeChannel(source?.channel),
    hop: Math.max(0, Math.min(Number.isSafeInteger(source?.hop) ? Number(source?.hop) : 0, 16)),
    ...(observedAt ? { observedAt } : {}),
    evidenceIds: uniqueOrdered([...(source?.evidenceIds || []), ...(source?.sourceEventIds || [])]),
    confirmationBias: clamp01(source?.confirmationBias, 0),
  };
}

function confidenceFromSources(kind: EpochKnowledgeKind, sources: readonly EpochKnowledgeSourceHop[]) {
  const sourceScore = sources.length
    ? sources.reduce((total, source) => {
      const hopPenalty = Math.max(0.4, 1 - source.hop * 0.08);
      const biasPenalty = Math.max(0.35, 1 - source.confirmationBias * 0.5);
      return total
        + TRUST_WEIGHT[source.trustClass]
        * AUTHORITY_WEIGHT[source.sourceAuthority]
        * CHANNEL_WEIGHT[source.channel]
        * hopPenalty
        * biasPenalty;
    }, 0) / sources.length
    : 0.2;
  return Math.max(0, Math.min(1, KIND_BASE_CONFIDENCE[kind] * 0.55 + sourceScore * 0.45));
}

function normalizeEvidence(item: EpochKnowledgeInputItem): EpochKnowledgeEvidence {
  const sources = (item.sources && item.sources.length ? item.sources : [item.source])
    .map((source, index) => normalizeSource(source, `${item.id}:source:${index}`, item.observedAt || item.createdAt));
  const evidenceIds = uniqueOrdered([
    ...(item.evidenceIds || []),
    ...sources.flatMap((source) => source.evidenceIds),
  ]);
  const observedTimes = uniqueSorted(sources.map((source) => source.observedAt));
  const firstObservedAt = observedTimes[0];
  const lastObservedAt = observedTimes[observedTimes.length - 1];
  return {
    evidenceIds,
    sourceEventIds: evidenceIds.filter((id) => id.startsWith("evt_") || id.startsWith("event_")),
    sourceChain: sources,
    trustClasses: uniqueSorted(sources.map((source) => source.trustClass)) as readonly EpochKnowledgeTrustClass[],
    sourceAuthorities: uniqueSorted(sources.map((source) => source.sourceAuthority)) as readonly EpochKnowledgeSourceAuthority[],
    channels: uniqueSorted(sources.map((source) => source.channel)) as readonly EpochKnowledgeChannel[],
    hopCount: sources.reduce((max, source) => Math.max(max, source.hop), 0),
    ...(firstObservedAt ? { firstObservedAt } : {}),
    ...(lastObservedAt ? { lastObservedAt } : {}),
    confirmationBias: sources.length
      ? sources.reduce((total, source) => total + source.confirmationBias, 0) / sources.length
      : 0,
  };
}

function normalizeVisibility(item: EpochKnowledgeInputItem, evidence: EpochKnowledgeEvidence): EpochKnowledgeVisibility {
  const visibility = item.visibility || {};
  const regionIds = uniqueSorted([...(visibility.regionIds || []), ...(item.regionIds || [])]);
  const organizationIds = uniqueSorted([...(visibility.organizationIds || []), ...(item.organizationIds || [])]);
  const agentIds = uniqueSorted([...(visibility.agentIds || []), ...(item.agentIds || [])]);
  const explorerIds = uniqueSorted([...(visibility.explorerIds || []), ...(item.explorerIds || [])]);
  const evidenceIds = uniqueSorted([...(visibility.evidenceIds || []), ...(item.evidenceIds || []), ...evidence.evidenceIds]);
  const explicitScopes = (visibility.scopes || []).map(normalizeScope).filter((scope): scope is EpochKnowledgeVisibilityScope => Boolean(scope));
  const inferredScopes = uniqueSorted([
    regionIds.length ? "region" : undefined,
    organizationIds.length ? "organization" : undefined,
    agentIds.length ? "agent" : undefined,
    explorerIds.length ? "explorer" : undefined,
    evidenceIds.length ? "evidence" : undefined,
  ]) as readonly EpochKnowledgeVisibilityScope[];
  const scopes: readonly EpochKnowledgeVisibilityScope[] = explicitScopes.length
    ? uniqueSorted(explicitScopes) as readonly EpochKnowledgeVisibilityScope[]
    : inferredScopes.length ? inferredScopes : ["public"];
  const defaultLegalAccess: EpochKnowledgeLegalAccess = scopes.includes("public") && scopes.length === 1 ? "public" : "source-bound";
  return {
    scopes,
    legalAccess: normalizeLegalAccess(visibility.legalAccess || defaultLegalAccess),
    regionIds,
    organizationIds,
    agentIds,
    explorerIds,
    evidenceIds,
  };
}

function normalizeRecord(item: EpochKnowledgeInputItem): EpochKnowledgeRecord | undefined {
  const id = optionalString(item.id);
  const text = optionalString(item.text);
  if (!id || !text || !isKnowledgeKind(item.kind)) return undefined;
  const evidence = normalizeEvidence(item);
  const confidence = clamp01(item.confidence, confidenceFromSources(item.kind, evidence.sourceChain));
  const subject = optionalString(item.subject);
  const createdAt = optionalString(item.createdAt);
  const observedAt = optionalString(item.observedAt) || evidence.lastObservedAt;
  return {
    id,
    kind: item.kind,
    ...(subject ? { subject } : {}),
    text,
    confidence,
    status: "accepted",
    evidence,
    visibility: normalizeVisibility(item, evidence),
    supports: uniqueSorted(item.supports || []),
    refutes: uniqueSorted(item.refutes || []),
    refutedBy: [],
    supersedes: uniqueSorted(item.supersedes || []),
    ...(createdAt ? { createdAt } : {}),
    ...(observedAt ? { observedAt } : {}),
  };
}

export function buildKnowledgeState(items: readonly EpochKnowledgeInputItem[]): EpochKnowledgeState {
  const acceptedRecords = items
    .map(normalizeRecord)
    .filter((record): record is EpochKnowledgeRecord => Boolean(record))
    .sort((left, right) => left.id.localeCompare(right.id));
  const refutedBy = new Map<string, string[]>();
  for (const record of acceptedRecords) {
    if (record.kind !== "refutation") continue;
    for (const targetId of record.refutes) {
      refutedBy.set(targetId, uniqueSorted([...(refutedBy.get(targetId) || []), record.id]) as string[]);
    }
  }
  const byOriginalId = new Map(acceptedRecords.map((record) => [record.id, record] as const));
  const records = acceptedRecords.map((record) => {
    const refuters = refutedBy.get(record.id) || [];
    if (refuters.length === 0) return record;
    const strongestRefutation = refuters.reduce((max, refutationId) =>
      Math.max(max, byOriginalId.get(refutationId)?.confidence || 0), 0);
    const status = strongestRefutation >= 0.8 && record.kind !== "belief" ? "refuted" : "contested";
    return {
      ...record,
      status,
      refutedBy: refuters,
    } satisfies EpochKnowledgeRecord;
  });
  const byKind = KNOWLEDGE_KINDS.reduce((result, kind) => {
    result[kind] = records.filter((record) => record.kind === kind);
    return result;
  }, {} as Record<EpochKnowledgeKind, readonly EpochKnowledgeRecord[]>);
  const byId = records.reduce((result, record) => {
    result[record.id] = record;
    return result;
  }, {} as Record<string, EpochKnowledgeRecord>);
  return {
    records,
    byKind,
    byId,
    refutations: byKind.refutation,
  };
}

export function canAccessKnowledgeRecord(record: EpochKnowledgeRecord, caller: EpochKnowledgeCaller = {}): boolean {
  const visibility = record.visibility;
  if (caller.legalAccess?.includes("operator")) return true;
  if (visibility.legalAccess === "operator") return false;
  if (visibility.legalAccess === "public" && visibility.scopes.includes("public")) return true;
  if (caller.regionId && visibility.regionIds.includes(caller.regionId) && visibility.scopes.includes("region")) return true;
  if (caller.agentId && visibility.agentIds.includes(caller.agentId) && visibility.scopes.includes("agent")) return true;
  if (caller.explorerId && visibility.explorerIds.includes(caller.explorerId) && visibility.scopes.includes("explorer")) return true;
  if (caller.organizationIds?.some((id) => visibility.organizationIds.includes(id)) && visibility.scopes.includes("organization")) {
    return true;
  }
  if (caller.evidenceIds?.some((id) => visibility.evidenceIds.includes(id)) && visibility.scopes.includes("evidence")) return true;
  if (visibility.legalAccess === "owner") return Boolean(caller.agentId && visibility.agentIds.includes(caller.agentId))
    || Boolean(caller.explorerId && visibility.explorerIds.includes(caller.explorerId));
  if (visibility.legalAccess === "member") {
    return Boolean(caller.organizationIds?.some((id) => visibility.organizationIds.includes(id)));
  }
  return false;
}
