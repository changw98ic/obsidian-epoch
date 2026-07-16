import type { AgentPublicWorld, Entity, Layer, Region, Route, WorldMapData } from "./types";

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isVec3(value: unknown): value is [number, number, number] {
  return Array.isArray(value) && value.length === 3 && value.every(isNumber);
}

function assertArray<T>(value: unknown, label: string, guard: (item: unknown) => item is T): T[] {
  if (!Array.isArray(value)) throw new Error(`${label}_array_required`);
  if (!value.every(guard)) throw new Error(`${label}_invalid`);
  return value;
}

function requiredArray(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${label}_invalid`);
  return value;
}

function summaryCount(value: unknown, label: string): number | "unknown" {
  if (value === undefined || value === null) return "unknown";
  if (!isNumber(value)) throw new Error(`${label}_invalid`);
  return value;
}

function detailMapOrNull(value: unknown, label: string): Record<string, unknown> | null {
  if (value === undefined || value === null) return null;
  if (!isObject(value)) throw new Error(`${label}_invalid`);
  return value;
}

function adaptSourceGraph(value: unknown): AgentPublicWorld["sourceGraph"] {
  if (value === undefined || value === null) {
    return { nodes: [], edges: [], status: "unknown" };
  }
  if (!isObject(value)) throw new Error("agent_world_source_graph_invalid");
  const nodes = value.nodes === undefined || value.nodes === null ? [] : value.nodes;
  const edges = value.edges === undefined || value.edges === null ? [] : value.edges;
  if (!Array.isArray(nodes) || !Array.isArray(edges)) throw new Error("agent_world_source_graph_invalid");
  return {
    nodes,
    edges,
    status: value.nodes === undefined || value.edges === undefined ? "unknown" : "present",
  };
}

function isLayer(value: unknown): value is Layer {
  return isObject(value)
    && isString(value.id)
    && isString(value.label)
    && isNumber(value.elevation)
    && isNumber(value.order)
    && isString(value.color)
    && isString(value.summary);
}

function isRegion(value: unknown): value is Region {
  return isObject(value)
    && isString(value.id)
    && isString(value.label)
    && isString(value.layer)
    && isVec3(value.position)
    && isNumber(value.radius);
}

function isEntity(value: unknown): value is Entity {
  return isObject(value)
    && isString(value.id)
    && isString(value.label)
    && isString(value.kind)
    && isString(value.layer)
    && isString(value.region)
    && isString(value.habitat)
    && isVec3(value.position)
    && isObject(value.details);
}

function isRoute(value: unknown): value is Route {
  return isObject(value)
    && isString(value.id)
    && isString(value.label)
    && Array.isArray(value.points)
    && value.points.every(isString);
}

export function parseWorldMapData(value: unknown): WorldMapData {
  if (!isObject(value)) throw new Error("world_map_object_required");
  const sourceStats = value.sourceStats;
  if (!isObject(sourceStats) || !isNumber(sourceStats.entities)) {
    throw new Error("world_map_source_stats_invalid");
  }

  return {
    ...(value as unknown as WorldMapData),
    layers: assertArray(value.layers, "layers", isLayer),
    regions: assertArray(value.regions, "regions", isRegion),
    habitats: Array.isArray(value.habitats) ? (value.habitats as WorldMapData["habitats"]) : [],
    entities: assertArray(value.entities, "entities", isEntity),
    routes: assertArray(value.routes, "routes", isRoute),
  };
}

export function parseAgentPublicWorld(value: unknown): AgentPublicWorld {
  if (!isObject(value)) throw new Error("agent_world_object_required");
  if (!isObject(value.summary)) throw new Error("agent_world_summary_required");
  return {
    summary: {
      canonicalClaims: summaryCount(value.summary.canonicalClaims, "agent_world_summary"),
      disputedClaims: summaryCount(value.summary.disputedClaims, "agent_world_summary"),
      openConflicts: summaryCount(value.summary.openConflicts, "agent_world_summary"),
      acceptedFactions: summaryCount(value.summary.acceptedFactions, "agent_world_summary"),
      archiveRuns: summaryCount(value.summary.archiveRuns, "agent_world_summary"),
    },
    claims: requiredArray(value.claims, "agent_world_claims"),
    conflicts: requiredArray(value.conflicts, "agent_world_conflicts"),
    factions: requiredArray(value.factions, "agent_world_factions"),
    archive: requiredArray(value.archive, "agent_world_archive"),
    claimDetails: detailMapOrNull(value.claimDetails, "agent_world_claim_details"),
    conflictDetails: detailMapOrNull(value.conflictDetails, "agent_world_conflict_details"),
    factionDetails: detailMapOrNull(value.factionDetails, "agent_world_faction_details"),
    sourceGraph: adaptSourceGraph(value.sourceGraph),
  };
}
