import type { EpochResultPageReadModel } from "./resultPageReadModel.ts";
import type {
  Phase6CanonicalCursor,
  Phase6ProjectionDelta,
  Phase6ProjectionForDelta,
  Phase6WorldDeltaDomain,
} from "./phase6ProjectionDeltaRules.ts";
import { buildPhase6ProjectionDelta } from "./phase6ProjectionDeltaRules.ts";
import type { EpochEvent } from "./events.ts";
import type { WorldMemorySearchResult } from "../worldMemoryIndex.ts";

export type Phase6ProjectionSnapshotAdapterErrorCode =
  | "phase6_projection_cursor_missing"
  | "phase6_projection_source_event_missing"
  | "phase6_projection_world_domain_missing"
  | "phase6_projection_world_domain_unsupported";

export interface Phase6ProjectionSnapshotAdapterError {
  readonly code: Phase6ProjectionSnapshotAdapterErrorCode;
  readonly message: string;
  readonly path: string;
}

export interface Phase6ProjectionSnapshotAdapterRagInput {
  readonly projection?: unknown;
  readonly memorySearch?: WorldMemorySearchResult;
  readonly resultPages?: EpochResultPageReadModel;
}

export interface Phase6ProjectionSnapshotAdapterWorldInput {
  readonly projection: unknown;
  readonly domains: readonly Phase6WorldDeltaDomain[];
}

export interface Phase6ProjectionSnapshotAdapterSnapshotInput {
  readonly rag?: Phase6ProjectionSnapshotAdapterRagInput;
  readonly world?: Phase6ProjectionSnapshotAdapterWorldInput;
}

export interface BuildPhase6ProjectionDeltaFromSnapshotsInput {
  readonly cursor: Phase6CanonicalCursor;
  readonly canonicalEvents: readonly EpochEvent[];
  readonly before: Phase6ProjectionSnapshotAdapterSnapshotInput;
  readonly after: Phase6ProjectionSnapshotAdapterSnapshotInput;
  readonly now?: string;
}

export interface Phase6ProjectionSnapshotAdapterSuccess {
  readonly ok: true;
  readonly before: Phase6ProjectionForDelta;
  readonly after: Phase6ProjectionForDelta;
  readonly delta: Phase6ProjectionDelta;
}

export interface Phase6ProjectionSnapshotAdapterFailure {
  readonly ok: false;
  readonly errors: readonly Phase6ProjectionSnapshotAdapterError[];
}

export type Phase6ProjectionSnapshotAdapterResult =
  | Phase6ProjectionSnapshotAdapterSuccess
  | Phase6ProjectionSnapshotAdapterFailure;

const WORLD_DOMAINS = new Set<Phase6WorldDeltaDomain>([
  "time",
  "faction",
  "character",
  "place",
  "supply",
  "danger",
  "logistics",
  "rumor",
]);

export function buildPhase6ProjectionDeltaFromSnapshots(
  input: BuildPhase6ProjectionDeltaFromSnapshotsInput,
): Phase6ProjectionSnapshotAdapterResult {
  const errors = validateAdapterInput(input);
  if (errors.length > 0) return { ok: false, errors };

  const before = normalizeProjectionSnapshot(input.before);
  const after = normalizeProjectionSnapshot(input.after);
  const delta = buildPhase6ProjectionDelta({
    before,
    after,
    canonicalEvents: input.canonicalEvents,
    ...(input.now ? { now: input.now } : {}),
  });

  return { ok: true, before, after, delta };
}

export function normalizePhase6ProjectionSnapshot(
  input: Phase6ProjectionSnapshotAdapterSnapshotInput,
): Phase6ProjectionForDelta {
  return normalizeProjectionSnapshot(input);
}

function validateAdapterInput(
  input: BuildPhase6ProjectionDeltaFromSnapshotsInput,
): readonly Phase6ProjectionSnapshotAdapterError[] {
  const errors: Phase6ProjectionSnapshotAdapterError[] = [];
  if (!input.cursor?.value) {
    errors.push(error(
      "phase6_projection_cursor_missing",
      "Phase 6 projection adapter requires the canonical cursor from the caller.",
      "cursor",
    ));
  }
  if (!input.canonicalEvents.length) {
    errors.push(error(
      "phase6_projection_source_event_missing",
      "Phase 6 projection adapter requires at least one canonical source event.",
      "canonicalEvents",
    ));
  }
  errors.push(...validateWorldDomains(input.before, "before.world.domains"));
  errors.push(...validateWorldDomains(input.after, "after.world.domains"));
  return errors;
}

function validateWorldDomains(
  snapshot: Phase6ProjectionSnapshotAdapterSnapshotInput,
  path: string,
): readonly Phase6ProjectionSnapshotAdapterError[] {
  if (!snapshot.world?.domains.length) {
    return [error(
      "phase6_projection_world_domain_missing",
      "Phase 6 projection adapter requires explicit world domains from the caller.",
      path,
    )];
  }
  return snapshot.world.domains
    .filter((domain) => !WORLD_DOMAINS.has(domain))
    .map((domain) => error(
      "phase6_projection_world_domain_unsupported",
      `Unsupported Phase 6 world domain: ${domain}`,
      path,
    ));
}

function normalizeProjectionSnapshot(
  input: Phase6ProjectionSnapshotAdapterSnapshotInput,
): Phase6ProjectionForDelta {
  return {
    ...(input.rag ? normalizeRagProjection(input.rag) : {}),
    ...(input.world ? normalizeWorldProjection(input.world) : {}),
  };
}

function normalizeRagProjection(input: Phase6ProjectionSnapshotAdapterRagInput): Phase6ProjectionForDelta {
  const projection = asRecord(input.projection);
  return {
    ...(input.projection === undefined ? {} : { rag: projection }),
    ...(input.memorySearch ? { memories: normalizeMemorySearch(input.memorySearch) } : {}),
    ...(input.resultPages ? { knowledge: normalizeResultPages(input.resultPages) } : {}),
  };
}

function normalizeWorldProjection(input: Phase6ProjectionSnapshotAdapterWorldInput): Phase6ProjectionForDelta {
  const projection = asRecord(input.projection);
  const normalized: Record<string, unknown> = {};
  for (const domain of input.domains) {
    for (const key of worldDomainKeys(domain)) {
      if (key in projection) normalized[key] = projection[key];
    }
  }
  return normalized;
}

function normalizeMemorySearch(input: WorldMemorySearchResult) {
  return input.hits.map((hit) => compactRecord({
    key: hit.chunkId,
    title: hit.title,
    content: hit.content,
    regionId: hit.regionId,
    journeyId: hit.journeyId,
    sourcePageId: hit.sourcePageId,
    sourceEventIds: hit.sourceEventIds,
    score: hit.score,
    worldStartTime: hit.worldStartTime,
    worldEndTime: hit.worldEndTime,
  }));
}

function normalizeResultPages(input: EpochResultPageReadModel) {
  return [...input.values()].map((page) => compactRecord({
    key: page.pageId,
    pageId: page.pageId,
    createdAt: page.createdAt,
    expiresAt: page.expiresAt,
    status: page.status,
    publicSafeSummary: page.publicSafeSummary,
  }));
}

function worldDomainKeys(domain: Phase6WorldDeltaDomain): readonly string[] {
  switch (domain) {
    case "time":
      return ["worldClock", "clock", "worldMinute"];
    case "faction":
      return ["factions", "organizations"];
    case "character":
      return ["characters", "agents", "npcs"];
    case "place":
      return ["places", "regions"];
    case "supply":
      return ["supplies", "inventory", "resources"];
    case "danger":
      return ["dangers", "conflicts", "anomalies"];
    case "logistics":
      return ["logistics", "shipments", "routes"];
    case "rumor":
      return ["rumors", "news"];
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function compactRecord(input: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
}

function error(
  code: Phase6ProjectionSnapshotAdapterErrorCode,
  message: string,
  path: string,
): Phase6ProjectionSnapshotAdapterError {
  return { code, message, path };
}
