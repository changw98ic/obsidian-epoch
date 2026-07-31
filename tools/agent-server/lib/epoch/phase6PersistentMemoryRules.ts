import type { EpochEvent } from "./events.ts";

type UnknownRecord = Readonly<Record<string, unknown>>;

export const PHASE6_PERSISTENT_MEMORY_RULESET_VERSION = "obsidian-epoch-phase6-persistent-memory-v0.1.0" as const;

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as UnknownRecord
    : {};
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function primaryRouteId(event: Extract<EpochEvent, { readonly eventType: "journey_world_solidified" }>): string | undefined {
  const declaredRoutes = (event.payload.routeIds ?? [])
    .filter(nonEmpty)
    .sort((left, right) => left.localeCompare(right));
  if (declaredRoutes.length > 0) return declaredRoutes[0];
  const routes = event.payload.factionStandings
    .map((standing) => standing.routeId)
    .filter(nonEmpty)
    .sort((left, right) => left.localeCompare(right));
  return routes[0];
}

function persistentMemoryFromSolidification(
  event: Extract<EpochEvent, { readonly eventType: "journey_world_solidified" }>,
): UnknownRecord {
  const payload = event.payload;
  const routeId = primaryRouteId(event);
  const memoryId = routeId
    ? `phase6-memory:route:${payload.regionId}:${routeId}`
    : `phase6-memory:journey:${payload.journeyId}`;
  return {
    id: memoryId,
    memoryId,
    kind: "memory",
    importance: "high",
    subject: routeId
      ? `route:${payload.regionId}:${routeId}`
      : `journey:${payload.journeyId}`,
    title: routeId ? "已固化路线记忆" : "已固化旅程记忆",
    text: `旅程 ${payload.journeyId} 已固化；地区 ${payload.regionId}；${routeId ? `路线 ${routeId}；` : ""}完成目标 ${payload.completedObjectiveIds.length}；结算等级 ${payload.completionTier}；地区影响 ${payload.influenceDelta}。`,
    confidence: 1,
    journeyId: payload.journeyId,
    regionId: payload.regionId,
    worldEndTime: payload.committedAtWorldTime || event.createdAt,
    sourceEventIds: [event.eventId],
    evidence: {
      status: "accepted",
      evidenceIds: [event.eventId],
      sourceEventIds: [event.eventId],
    },
  };
}

export function phase6PersistentMemoriesFromCanonicalEvents(
  events: readonly EpochEvent[],
  agentId: string,
): readonly UnknownRecord[] {
  const latestByMemoryId = new Map<string, UnknownRecord>();
  const solidifications = events
    .filter((event): event is Extract<EpochEvent, { readonly eventType: "journey_world_solidified" }> =>
      event.eventType === "journey_world_solidified"
      && (event.agentId === agentId || event.payload.agentId === agentId))
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt)
      || left.eventId.localeCompare(right.eventId));
  for (const event of solidifications) {
    const memory = persistentMemoryFromSolidification(event);
    const memoryId = memory.memoryId;
    if (nonEmpty(memoryId)) latestByMemoryId.set(memoryId, memory);
  }
  return [...latestByMemoryId.values()]
    .sort((left, right) => String(left.memoryId).localeCompare(String(right.memoryId)));
}

/**
 * Phase 6 keeps durable RAG memories as a read projection of canonical
 * solidification events. This function never writes a knowledge or world record.
 */
export function projectPhase6PersistentRagPanel(input: {
  readonly ragPanel: UnknownRecord;
  readonly canonicalEvents: readonly EpochEvent[];
  readonly agentId: string;
}): UnknownRecord {
  const baseHits = Array.isArray(input.ragPanel.hits)
    ? input.ragPanel.hits.filter((hit): hit is UnknownRecord => Boolean(hit) && typeof hit === "object" && !Array.isArray(hit))
    : [];
  const derivedMemories = phase6PersistentMemoriesFromCanonicalEvents(input.canonicalEvents, input.agentId);
  const hitsById = new Map<string, UnknownRecord>();
  for (const hit of baseHits) {
    const id = asRecord(hit).id;
    if (nonEmpty(id)) hitsById.set(id, hit);
  }
  for (const memory of derivedMemories) {
    const id = memory.memoryId;
    if (nonEmpty(id)) hitsById.set(id, memory);
  }
  const countsByKind = asRecord(input.ragPanel.countsByKind);
  const baseMemoryCount = typeof countsByKind.memory === "number" && Number.isFinite(countsByKind.memory)
    ? Math.max(0, Math.trunc(countsByKind.memory))
    : baseHits.filter((hit) => hit.kind === "memory").length;
  const page = asRecord(input.ragPanel.page);
  const baseTotal = typeof page.total === "number" && Number.isFinite(page.total)
    ? Math.max(0, Math.trunc(page.total))
    : baseHits.length;
  return {
    ...input.ragPanel,
    hits: [...hitsById.values()].sort((left, right) =>
      String(left.memoryId || left.id).localeCompare(String(right.memoryId || right.id))),
    countsByKind: {
      ...countsByKind,
      memory: baseMemoryCount + derivedMemories.length,
    },
    page: {
      ...page,
      total: Math.max(baseTotal, hitsById.size),
    },
    phase6Persistence: {
      rulesetVersion: PHASE6_PERSISTENT_MEMORY_RULESET_VERSION,
      projectedMemoryCount: derivedMemories.length,
      source: "canonical_journey_world_solidified_events",
    },
  };
}
