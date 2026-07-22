import type { EpochEvent } from "./events.ts";
import { canonicalPhase6RagMemoryFacts } from "./phase6ResultPageChangeSetAdapter.ts";

export const PHASE6_PROJECTION_DELTA_RULESET_VERSION = "obsidian-epoch-phase6-projection-delta-v0.1.0" as const;

export const PHASE6_RAG_MEMORY_LIMIT = 3;

export type Phase6RagDeltaKind = "added" | "removed" | "changed";
export type Phase6WorldDeltaKind = "advanced" | "added" | "removed" | "changed";

export type Phase6WorldDeltaDomain =
  | "time"
  | "faction"
  | "character"
  | "place"
  | "supply"
  | "danger"
  | "logistics"
  | "rumor";

export type Phase6NoChangeReason =
  | "no_canonical_events"
  | "projection_equal"
  | "no_supported_projection_fields"
  | "only_untracked_fields_changed";

export type Phase6NoWorldChangeReason =
  | "no_canonical_events"
  | "world_projection_equal"
  | "no_supported_world_fields"
  | "only_non_world_fields_changed";

export interface Phase6ProjectionForDelta {
  readonly events?: readonly EpochEvent[];
  readonly rag?: unknown;
  readonly ragPanel?: unknown;
  readonly knowledge?: unknown;
  readonly memory?: unknown;
  readonly memories?: unknown;
  readonly world?: unknown;
  readonly worldClock?: unknown;
  readonly clock?: unknown;
  readonly worldSimulation?: unknown;
  readonly simulation?: unknown;
  readonly factions?: unknown;
  readonly organizations?: unknown;
  readonly characters?: unknown;
  readonly agents?: unknown;
  readonly npcs?: unknown;
  readonly places?: unknown;
  readonly regions?: unknown;
  readonly supplies?: unknown;
  readonly inventory?: unknown;
  readonly resources?: unknown;
  readonly dangers?: unknown;
  readonly conflicts?: unknown;
  readonly anomalies?: unknown;
  readonly logistics?: unknown;
  readonly shipments?: unknown;
  readonly routes?: unknown;
  readonly rumors?: unknown;
  readonly news?: unknown;
}

export interface Phase6ProjectionDeltaInput {
  readonly before: Phase6ProjectionForDelta;
  readonly after: Phase6ProjectionForDelta;
  readonly canonicalEvents?: readonly EpochEvent[];
  readonly now?: string;
}

export interface Phase6CanonicalEventRef {
  readonly eventId: string;
  readonly eventType: string;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly createdAt: string;
  readonly trustClass: string;
  readonly causationId?: string;
  readonly correlationId?: string;
}

export interface Phase6CanonicalCursor {
  readonly kind: "phase6_canonical_cursor";
  readonly eventCount: number;
  readonly firstEventId?: string;
  readonly lastEventId?: string;
  readonly firstCreatedAt?: string;
  readonly lastCreatedAt?: string;
  readonly eventIdsHash: `fnv1a32:${string}`;
  readonly value: string;
}

export interface Phase6RagMemoryDelta {
  readonly slot: 0 | 1 | 2;
  readonly key: string;
  readonly kind: Phase6RagDeltaKind;
  readonly beforeText?: string;
  readonly afterText?: string;
  readonly noveltyBefore: number;
  readonly noveltyAfter: number;
  readonly noveltyDelta: number;
  readonly loadBefore: number;
  readonly loadAfter: number;
  readonly loadDelta: number;
  readonly traceabilityBefore: number;
  readonly traceabilityAfter: number;
  readonly traceabilityDelta: number;
  readonly sourceEvents: readonly Phase6CanonicalEventRef[];
}

export interface Phase6RagDelta {
  readonly changed: boolean;
  readonly cursor: Phase6CanonicalCursor;
  readonly memories: readonly Phase6RagMemoryDelta[];
  readonly noChangeReason?: Phase6NoChangeReason;
}

export interface Phase6WorldDomainDelta {
  readonly domain: Phase6WorldDeltaDomain;
  readonly kind: Phase6WorldDeltaKind;
  readonly key: string;
  readonly beforeSummary?: string;
  readonly afterSummary?: string;
  readonly noveltyBefore: number;
  readonly noveltyAfter: number;
  readonly noveltyDelta: number;
  readonly loadBefore: number;
  readonly loadAfter: number;
  readonly loadDelta: number;
  readonly traceabilityBefore: number;
  readonly traceabilityAfter: number;
  readonly traceabilityDelta: number;
  readonly sourceEvents: readonly Phase6CanonicalEventRef[];
}

export interface Phase6WorldDelta {
  readonly changed: boolean;
  readonly cursor: Phase6CanonicalCursor;
  readonly domains: readonly Phase6WorldDeltaDomain[];
  readonly changes: readonly Phase6WorldDomainDelta[];
  readonly noWorldChangeReason?: Phase6NoWorldChangeReason;
}

export interface Phase6ProjectionDelta {
  readonly rulesetVersion: typeof PHASE6_PROJECTION_DELTA_RULESET_VERSION;
  readonly deterministic: true;
  readonly cursor: Phase6CanonicalCursor;
  readonly canonicalEvents: readonly Phase6CanonicalEventRef[];
  readonly ragDelta: Phase6RagDelta;
  readonly worldDelta: Phase6WorldDelta;
  readonly receipt: Phase6ProjectionDeltaReceipt;
}

export interface Phase6ProjectionDeltaReceipt {
  readonly receiptType: "phase6_projection_delta";
  readonly rulesetVersion: typeof PHASE6_PROJECTION_DELTA_RULESET_VERSION;
  readonly canonicalCursor: string;
  readonly canonicalEventIds: readonly string[];
  readonly ragChanged: boolean;
  readonly ragMemoryCount: number;
  readonly ragNoChangeReason?: Phase6NoChangeReason;
  readonly worldChanged: boolean;
  readonly worldDomains: readonly Phase6WorldDeltaDomain[];
  readonly worldNoChangeReason?: Phase6NoWorldChangeReason;
}

interface Fact {
  readonly key: string;
  readonly value: unknown;
  readonly text: string;
}

const WORLD_DOMAINS: readonly Phase6WorldDeltaDomain[] = [
  "time",
  "faction",
  "character",
  "place",
  "supply",
  "danger",
  "logistics",
  "rumor",
] as const;

const WORLD_DOMAIN_FIELDS: Readonly<Record<Phase6WorldDeltaDomain, readonly string[]>> = {
  time: ["worldClock", "clock", "world.worldClock", "world.clock", "worldMinute", "world.worldMinute"],
  faction: ["factions", "organizations", "world.factions", "world.organizations", "worldSimulation.factions", "simulation.factions"],
  character: ["characters", "agents", "npcs", "world.characters", "world.agents", "world.npcs"],
  place: ["places", "regions", "world.places", "world.regions", "worldSimulation.regions", "simulation.regions"],
  supply: ["supplies", "inventory", "resources", "world.supplies", "world.inventory", "world.resources", "worldSimulation.commodityTotals", "simulation.commodityTotals"],
  danger: ["dangers", "conflicts", "anomalies", "world.dangers", "world.conflicts", "world.anomalies", "worldSimulation.conflicts", "simulation.conflicts"],
  logistics: ["logistics", "shipments", "routes", "world.logistics", "world.shipments", "world.routes", "worldSimulation.shipments", "worldSimulation.routes", "simulation.shipments", "simulation.routes"],
  rumor: ["rumors", "news", "world.rumors", "world.news"],
};

export function buildPhase6ProjectionDelta(input: Phase6ProjectionDeltaInput): Phase6ProjectionDelta {
  const canonicalEvents = canonicalEventRefs(selectCanonicalEvents(input));
  const cursor = phase6CanonicalCursor(canonicalEvents);
  const ragDelta = buildPhase6RagDelta(input.before, input.after, canonicalEvents, cursor);
  const worldDelta = buildPhase6WorldDelta(input.before, input.after, canonicalEvents, cursor);

  return {
    rulesetVersion: PHASE6_PROJECTION_DELTA_RULESET_VERSION,
    deterministic: true,
    cursor,
    canonicalEvents,
    ragDelta,
    worldDelta,
    receipt: phase6ProjectionDeltaReceipt(cursor, canonicalEvents, ragDelta, worldDelta),
  };
}

export function buildPhase6RagDelta(
  before: Phase6ProjectionForDelta,
  after: Phase6ProjectionForDelta,
  canonicalEvents: readonly Phase6CanonicalEventRef[],
  cursor: Phase6CanonicalCursor = phase6CanonicalCursor(canonicalEvents),
): Phase6RagDelta {
  if (canonicalEvents.length === 0) {
    return {
      changed: false,
      cursor,
      memories: [],
      noChangeReason: "no_canonical_events",
    };
  }

  const beforeFacts = canonicalPhase6RagMemoryFacts(before);
  const afterFacts = canonicalPhase6RagMemoryFacts(after);
  const memories = compareFacts(beforeFacts, afterFacts, canonicalEvents, {
    requireCanonicalEventBinding: true,
  })
    .sort(compareFactChanges)
    .slice(0, PHASE6_RAG_MEMORY_LIMIT)
    .map((change, index) => ({
      slot: index as 0 | 1 | 2,
      ...change,
    }));

  return {
    changed: memories.length > 0,
    cursor,
    memories,
    noChangeReason: memories.length === 0 ? ragNoChangeReason(beforeFacts, afterFacts, canonicalEvents) : undefined,
  };
}

export function buildPhase6WorldDelta(
  before: Phase6ProjectionForDelta,
  after: Phase6ProjectionForDelta,
  canonicalEvents: readonly Phase6CanonicalEventRef[],
  cursor: Phase6CanonicalCursor = phase6CanonicalCursor(canonicalEvents),
): Phase6WorldDelta {
  if (canonicalEvents.length === 0) {
    return {
      changed: false,
      cursor,
      domains: [],
      changes: [],
      noWorldChangeReason: "no_canonical_events",
    };
  }

  const changes = WORLD_DOMAINS.flatMap((domain) => {
    const beforeFacts = projectionFacts(before, WORLD_DOMAIN_FIELDS[domain]);
    const afterFacts = projectionFacts(after, WORLD_DOMAIN_FIELDS[domain]);
    return compareFacts(beforeFacts, afterFacts, canonicalEvents).map((change) => ({
      domain,
      kind: domain === "time" && change.kind === "changed" ? "advanced" as const : change.kind,
      key: change.key,
      beforeSummary: change.beforeText,
      afterSummary: change.afterText,
      noveltyBefore: change.noveltyBefore,
      noveltyAfter: change.noveltyAfter,
      noveltyDelta: change.noveltyDelta,
      loadBefore: change.loadBefore,
      loadAfter: change.loadAfter,
      loadDelta: change.loadDelta,
      traceabilityBefore: change.traceabilityBefore,
      traceabilityAfter: change.traceabilityAfter,
      traceabilityDelta: change.traceabilityDelta,
      sourceEvents: change.sourceEvents,
    } satisfies Phase6WorldDomainDelta));
  }).sort(compareWorldChanges);
  const domains = unique(changes.map((change) => change.domain));

  return {
    changed: changes.length > 0,
    cursor,
    domains,
    changes,
    noWorldChangeReason: changes.length === 0 ? worldNoChangeReason(before, after, canonicalEvents) : undefined,
  };
}

export function phase6ProjectionDeltaReceipt(
  cursor: Phase6CanonicalCursor,
  canonicalEvents: readonly Phase6CanonicalEventRef[],
  ragDelta: Phase6RagDelta,
  worldDelta: Phase6WorldDelta,
): Phase6ProjectionDeltaReceipt {
  return {
    receiptType: "phase6_projection_delta",
    rulesetVersion: PHASE6_PROJECTION_DELTA_RULESET_VERSION,
    canonicalCursor: cursor.value,
    canonicalEventIds: canonicalEvents.map((event) => event.eventId),
    ragChanged: ragDelta.changed,
    ragMemoryCount: ragDelta.memories.length,
    ragNoChangeReason: ragDelta.noChangeReason,
    worldChanged: worldDelta.changed,
    worldDomains: worldDelta.domains,
    worldNoChangeReason: worldDelta.noWorldChangeReason,
  };
}

export function phase6CanonicalCursor(canonicalEvents: readonly Phase6CanonicalEventRef[]): Phase6CanonicalCursor {
  const sorted = [...canonicalEvents].sort(compareEventRefs);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const eventIdsHash = `fnv1a32:${fnv1a32(sorted.map((event) => event.eventId).join("\n"))}` as const;
  const value = [
    "phase6",
    sorted.length.toString(),
    first?.createdAt || "none",
    first?.eventId || "none",
    last?.createdAt || "none",
    last?.eventId || "none",
    eventIdsHash,
  ].join(":");

  return {
    kind: "phase6_canonical_cursor",
    eventCount: sorted.length,
    firstEventId: first?.eventId,
    lastEventId: last?.eventId,
    firstCreatedAt: first?.createdAt,
    lastCreatedAt: last?.createdAt,
    eventIdsHash,
    value,
  };
}

function selectCanonicalEvents(input: Phase6ProjectionDeltaInput): readonly EpochEvent[] {
  return input.canonicalEvents || input.after.events || [];
}

function canonicalEventRefs(events: readonly EpochEvent[]): readonly Phase6CanonicalEventRef[] {
  return events.map((event) => ({
    eventId: event.eventId,
    eventType: event.eventType,
    aggregateType: event.aggregateType,
    aggregateId: event.aggregateId,
    createdAt: event.createdAt,
    trustClass: event.trustClass,
    causationId: event.causationId,
    correlationId: event.correlationId,
  })).sort(compareEventRefs);
}

function compareFacts(
  beforeFacts: readonly Fact[],
  afterFacts: readonly Fact[],
  canonicalEvents: readonly Phase6CanonicalEventRef[],
  options: { readonly requireCanonicalEventBinding?: boolean } = {},
): readonly Omit<Phase6RagMemoryDelta, "slot">[] {
  const beforeByKey = new Map(beforeFacts.map((fact) => [fact.key, fact]));
  const afterByKey = new Map(afterFacts.map((fact) => [fact.key, fact]));
  const keys = unique([...beforeByKey.keys(), ...afterByKey.keys()]).sort();

  return keys.flatMap((key) => {
    const before = beforeByKey.get(key);
    const after = afterByKey.get(key);
    if (before?.text === after?.text) return [];
    const beforeText = before?.text;
    const afterText = after?.text;
    const sourceEvents = sourceEventsForChange(
      key,
      beforeText,
      afterText,
      canonicalEvents,
      options.requireCanonicalEventBinding !== true,
    );
    if (options.requireCanonicalEventBinding && sourceEvents.length === 0) return [];
    return [{
      key,
      kind: before && after ? "changed" : before ? "removed" : "added",
      beforeText,
      afterText,
      noveltyBefore: noveltyScore(beforeText),
      noveltyAfter: noveltyScore(afterText),
      noveltyDelta: roundMetric(noveltyScore(afterText) - noveltyScore(beforeText)),
      loadBefore: loadScore(beforeText),
      loadAfter: loadScore(afterText),
      loadDelta: roundMetric(loadScore(afterText) - loadScore(beforeText)),
      traceabilityBefore: traceabilityScore(beforeText, canonicalEvents),
      traceabilityAfter: traceabilityScore(afterText, canonicalEvents),
      traceabilityDelta: roundMetric(traceabilityScore(afterText, canonicalEvents) - traceabilityScore(beforeText, canonicalEvents)),
      sourceEvents,
    }];
  });
}

function projectionFacts(projection: Phase6ProjectionForDelta, paths: readonly string[]): readonly Fact[] {
  return paths.flatMap((path) => {
    const value = valueAtPath(projection, path);
    if (value === undefined) return [];
    return flattenFacts(path, value);
  }).sort((left, right) => left.key.localeCompare(right.key));
}

function flattenFacts(prefix: string, value: unknown): readonly Fact[] {
  if (value === undefined) return [];
  if (value === null || typeof value !== "object") {
    return [{ key: prefix, value, text: stablePhase6Json(value) }];
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return [{ key: prefix, value, text: "[]" }];
    return value.flatMap((item, index) => flattenFacts(`${prefix}.${factIdentity(item, index)}`, item));
  }

  const record = value as Readonly<Record<string, unknown>>;
  const keys = Object.keys(record).sort();
  if (keys.length === 0) return [{ key: prefix, value, text: "{}" }];
  if (hasFactIdentity(record)) {
    return [{ key: `${prefix}.${factIdentity(record, 0)}`, value, text: stablePhase6Json(value) }];
  }
  return keys.flatMap((key) => flattenFacts(`${prefix}.${key}`, record[key]));
}

function factIdentity(value: unknown, fallbackIndex: number): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) return fallbackIndex.toString().padStart(4, "0");
  const record = value as Readonly<Record<string, unknown>>;
  const id = record.id
    || record.eventId
    || record.memoryId
    || record.recordId
    || record.agentId
    || record.npcId
    || record.regionId
    || record.placeId
    || record.factionId
    || record.organizationId
    || record.shipmentId
    || record.routeId
    || record.conflictId
    || record.rumorId
    || record.newsId;
  return typeof id === "string" && id.length > 0 ? id : fallbackIndex.toString().padStart(4, "0");
}

function hasFactIdentity(record: Readonly<Record<string, unknown>>): boolean {
  return [
    "id",
    "eventId",
    "memoryId",
    "recordId",
    "agentId",
    "npcId",
    "regionId",
    "placeId",
    "factionId",
    "organizationId",
    "shipmentId",
    "routeId",
    "conflictId",
    "rumorId",
    "newsId",
  ].some((key) => typeof record[key] === "string" && record[key] !== "");
}

function valueAtPath(value: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((current, segment) => {
    if (!current || typeof current !== "object" || Array.isArray(current)) return undefined;
    return (current as Readonly<Record<string, unknown>>)[segment];
  }, value);
}

function ragNoChangeReason(
  beforeFacts: readonly Fact[],
  afterFacts: readonly Fact[],
  canonicalEvents: readonly Phase6CanonicalEventRef[],
): Phase6NoChangeReason {
  if (canonicalEvents.length === 0) return "no_canonical_events";
  if (beforeFacts.length === 0 && afterFacts.length === 0) return "no_supported_projection_fields";
  if (stablePhase6Json(beforeFacts) === stablePhase6Json(afterFacts)) return "projection_equal";
  return "only_untracked_fields_changed";
}

function worldNoChangeReason(
  before: Phase6ProjectionForDelta,
  after: Phase6ProjectionForDelta,
  canonicalEvents: readonly Phase6CanonicalEventRef[],
): Phase6NoWorldChangeReason {
  if (canonicalEvents.length === 0) return "no_canonical_events";
  const beforeFacts = WORLD_DOMAINS.flatMap((domain) => projectionFacts(before, WORLD_DOMAIN_FIELDS[domain]));
  const afterFacts = WORLD_DOMAINS.flatMap((domain) => projectionFacts(after, WORLD_DOMAIN_FIELDS[domain]));
  if (beforeFacts.length === 0 && afterFacts.length === 0) return "no_supported_world_fields";
  if (stablePhase6Json(beforeFacts) === stablePhase6Json(afterFacts)) return "world_projection_equal";
  return "only_non_world_fields_changed";
}

function sourceEventsForChange(
  key: string,
  beforeText: string | undefined,
  afterText: string | undefined,
  canonicalEvents: readonly Phase6CanonicalEventRef[],
  fallbackToLast = true,
): readonly Phase6CanonicalEventRef[] {
  if (canonicalEvents.length === 0) return [];
  const haystack = `${key}\n${beforeText || ""}\n${afterText || ""}`.toLowerCase();
  const matched = canonicalEvents.filter((event) =>
    haystack.includes(event.eventId.toLowerCase())
    || haystack.includes(event.aggregateId.toLowerCase())
    || haystack.includes(event.eventType.toLowerCase()));
  return (matched.length > 0
    ? matched
    : fallbackToLast
      ? [canonicalEvents[canonicalEvents.length - 1]]
      : []).slice(0, 8);
}

function noveltyScore(text: string | undefined): number {
  if (!text) return 0;
  const tokens = normalizedTokens(text);
  if (tokens.length === 0) return 0;
  return roundMetric(new Set(tokens).size / tokens.length);
}

function loadScore(text: string | undefined): number {
  if (!text) return 0;
  return roundMetric(Math.min(1, text.length / 2_000));
}

function traceabilityScore(text: string | undefined, canonicalEvents: readonly Phase6CanonicalEventRef[]): number {
  if (!text || canonicalEvents.length === 0) return 0;
  const lowered = text.toLowerCase();
  const hits = canonicalEvents.filter((event) =>
    lowered.includes(event.eventId.toLowerCase())
    || lowered.includes(event.aggregateId.toLowerCase())
    || lowered.includes(event.eventType.toLowerCase())).length;
  return roundMetric(hits / canonicalEvents.length);
}

function normalizedTokens(text: string): readonly string[] {
  return text.toLowerCase().split(/[^a-z0-9_\u4e00-\u9fff]+/u).filter(Boolean);
}

function compareFactChanges(
  left: Omit<Phase6RagMemoryDelta, "slot">,
  right: Omit<Phase6RagMemoryDelta, "slot">,
): number {
  return Math.abs(right.noveltyDelta) - Math.abs(left.noveltyDelta)
    || Math.abs(right.loadDelta) - Math.abs(left.loadDelta)
    || Math.abs(right.traceabilityDelta) - Math.abs(left.traceabilityDelta)
    || left.key.localeCompare(right.key);
}

function compareWorldChanges(left: Phase6WorldDomainDelta, right: Phase6WorldDomainDelta): number {
  return WORLD_DOMAINS.indexOf(left.domain) - WORLD_DOMAINS.indexOf(right.domain)
    || Math.abs(right.noveltyDelta) - Math.abs(left.noveltyDelta)
    || Math.abs(right.loadDelta) - Math.abs(left.loadDelta)
    || Math.abs(right.traceabilityDelta) - Math.abs(left.traceabilityDelta)
    || left.key.localeCompare(right.key);
}

function compareEventRefs(left: Phase6CanonicalEventRef, right: Phase6CanonicalEventRef): number {
  return left.createdAt.localeCompare(right.createdAt)
    || left.eventId.localeCompare(right.eventId);
}

function stablePhase6Json(value: unknown): string {
  if (value === undefined) return "undefined";
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stablePhase6Json).join(",")}]`;
  const record = value as Readonly<Record<string, unknown>>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stablePhase6Json(record[key])}`).join(",")}}`;
}

function fnv1a32(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function roundMetric(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function unique<T>(values: readonly T[]): readonly T[] {
  return [...new Set(values)];
}
