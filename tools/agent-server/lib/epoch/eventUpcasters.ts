/**
 * Event schema versioning and upcasting.
 *
 * Events are versioned by the presence of a `schemaVersion` field in their
 * payload. Events without `schemaVersion` are treated as version 1.
 *
 * Upcasters are applied at the persistence read boundary (in
 * `epochEventsFromPersistenceRecord`) so that reducers always see the
 * current schema version.
 */

import type { EpochEvent } from "./events.ts";

type JsonRecord = Record<string, unknown>;

export interface EventUpcaster {
  readonly eventType: string;
  readonly fromVersion: number;
  readonly toVersion: number;
  readonly upcast: (payload: JsonRecord) => JsonRecord;
}

const UPCASTERS: EventUpcaster[] = [];

export function registerUpcaster(upcaster: EventUpcaster): void {
  UPCASTERS.push(upcaster);
}

/**
 * Apply upcasters to an event payload. Returns the payload at the latest
 * known schema version. Idempotent: applying upcasters to an already-current
 * event is a no-op.
 */
export function applyUpcasters(eventType: string, payload: JsonRecord): JsonRecord {
  let current = payload;
  let version = getSchemaVersion(current);
  for (const upcaster of UPCASTERS) {
    if (upcaster.eventType !== eventType) continue;
    if (version === upcaster.fromVersion) {
      current = upcaster.upcast(current);
      version = getSchemaVersion(current);
    }
  }
  return current;
}

function getSchemaVersion(payload: JsonRecord): number {
  return typeof payload.schemaVersion === "number" && Number.isSafeInteger(payload.schemaVersion)
    ? payload.schemaVersion
    : 1;
}

/**
 * Apply upcasters to an event. Returns a new event with the upcasted payload.
 */
export function upcastEvent(event: EpochEvent): EpochEvent {
  const payload = event.payload as unknown as JsonRecord;
  const upcasted = applyUpcasters(event.eventType, payload);
  if (upcasted === payload) return event;
  return { ...event, payload: upcasted } as unknown as EpochEvent;
}

// --- Register known upcasters ---

registerUpcaster({
  eventType: "journey_world_solidified",
  fromVersion: 1,
  toVersion: 2,
  upcast: (p) => {
    if (p.schemaVersion === 2) return p;
    // v1 has mirrorLedgerPromotedEntryIds: string[]
    // v2 has mirrorLedgerPromotions: {entryId, canonicalEventId}[]
    // Cannot deterministically map v1 → v2 (positions may differ)
    // Mark as unresolved, keep original field for downstream fallback
    if (!Array.isArray(p.mirrorLedgerPromotedEntryIds)) return { ...p, schemaVersion: 2 };
    return {
      ...p,
      schemaVersion: 2,
      mirrorLedgerPromotions: [],
      _unresolvedV1Migration: true,
      _unresolvedReason: "v1 mirrorLedgerPromotedEntryIds cannot be deterministically mapped to canonicalEventId",
    };
  },
});

// Upcast old identity_issued events that lack identityViability and expectedLifePattern
registerUpcaster({
  eventType: "identity_issued",
  fromVersion: 1,
  toVersion: 2,
  upcast: (p) => {
    if (p.schemaVersion === 2) return p;
    // If already has both fields, just bump version
    if (p.identityViability && p.expectedLifePattern) return { ...p, schemaVersion: 2 };
    // Provide defaults for old events
    const agentId = typeof p.agentId === "string" ? p.agentId : "legacy";
    const startedAt = typeof p.startedAt === "string" ? p.startedAt : "2025-01-01T00:00:00Z";
    return {
      ...p,
      schemaVersion: 2,
      identityViability: p.identityViability ?? {
        identityId: agentId,
        factionStanding: {},
        flaggedWanted: [],
        identityExposed: false,
        doubtedBy: {},
        viabilityScoreBps: 10000,
        status: "healthy",
        policyVersion: "obsidian-epoch.viability-policy.v1",
        projectedAt: startedAt,
      },
      expectedLifePattern: p.expectedLifePattern ?? {
        identityId: agentId,
        patternVersion: "obsidian-epoch.roleplay-pattern.v1",
        expectedApproaches: [],
        forbiddenApproaches: [],
        factionRoleNorms: {},
        inputHash: "sha256:legacy",
        frozenAt: startedAt,
      },
    };
  },
});
