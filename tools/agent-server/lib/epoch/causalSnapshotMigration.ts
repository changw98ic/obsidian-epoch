import {
  CAUSAL_WORLD_SNAPSHOT_SCHEMA_VERSION,
  CausalSnapshotError,
  assertCausalWorldSnapshotV1,
  createCausalWorldSnapshot,
  emptyCausalWorldSnapshot,
  legacyCausalEventReference,
  type CausalReplayCursorV1,
  type CausalStreamCursorV1,
  type CausalWorldSnapshotV1,
} from "./causalWorldSnapshot.ts";
import { causalCanonicalJsonHash } from "./causalCanonicalJson.ts";
import {
  assertCausalWorldEventV1,
  isCausalRecord,
  type CausalWorldEventV1,
  type LegacyCausalViewV1,
} from "./causalContracts.ts";
import { causalSchemaRegistryHash } from "./causalSchemaRegistry.ts";

export const CAUSAL_SNAPSHOT_MIGRATION_REGISTRY_VERSION = 1 as const;

export type CausalSnapshotMigrationErrorCode =
  | "CAUSAL_SNAPSHOT_MIGRATION_UNSUPPORTED_FUTURE_VERSION"
  | "CAUSAL_SNAPSHOT_MIGRATION_WORLD_MISMATCH"
  | "CAUSAL_SNAPSHOT_MIGRATION_SCHEMA_INVALID";

export type CausalSnapshotMigrationResultStatus = "unchanged" | "migrated" | "rejected";

export interface CausalSnapshotMigrationIssue {
  readonly code: CausalSnapshotMigrationErrorCode | string;
  readonly message: string;
  readonly path: string;
}

export interface CausalSnapshotMigrationReport {
  readonly fromVersion: number | "legacy" | "empty";
  readonly toVersion: typeof CAUSAL_WORLD_SNAPSHOT_SCHEMA_VERSION;
  readonly dryRun: boolean;
  readonly status: CausalSnapshotMigrationResultStatus;
  readonly changed: boolean;
  readonly migratedEventCount: number;
  readonly issues: readonly CausalSnapshotMigrationIssue[];
  readonly durationMs: number;
}

export interface CausalSnapshotMigrationOutput {
  readonly snapshot?: CausalWorldSnapshotV1;
  readonly report: CausalSnapshotMigrationReport;
}

export interface MigrateCausalSnapshotInput {
  readonly snapshot?: unknown;
  readonly worldId: string;
  readonly dryRun?: boolean;
  readonly nowMs?: () => number;
}

export interface CausalSnapshotMigrationStep {
  readonly fromVersion: number | "legacy" | "empty";
  readonly toVersion: number;
  readonly migrate: (snapshot: unknown, worldId: string) => CausalWorldSnapshotV1;
}

export const CAUSAL_SNAPSHOT_MIGRATIONS: readonly CausalSnapshotMigrationStep[] = [
  {
    fromVersion: "empty",
    toVersion: CAUSAL_WORLD_SNAPSHOT_SCHEMA_VERSION,
    migrate: (_snapshot, worldId) => emptyCausalWorldSnapshot(worldId),
  },
  {
    fromVersion: "legacy",
    toVersion: CAUSAL_WORLD_SNAPSHOT_SCHEMA_VERSION,
    migrate: migrateLegacySnapshotToV1,
  },
] as const;

export function migrateCausalSnapshot(input: MigrateCausalSnapshotInput): CausalSnapshotMigrationOutput {
  const startedAt = (input.nowMs || Date.now)();
  const dryRun = Boolean(input.dryRun);
  const finish = (
    fromVersion: CausalSnapshotMigrationReport["fromVersion"],
    status: CausalSnapshotMigrationResultStatus,
    snapshot: CausalWorldSnapshotV1 | undefined,
    issues: readonly CausalSnapshotMigrationIssue[] = [],
    migratedEventCount = 0,
  ): CausalSnapshotMigrationOutput => ({
    ...(dryRun ? {} : snapshot ? { snapshot } : {}),
    report: {
      fromVersion,
      toVersion: CAUSAL_WORLD_SNAPSHOT_SCHEMA_VERSION,
      dryRun,
      status,
      changed: status === "migrated",
      migratedEventCount,
      issues,
      durationMs: Math.max(0, (input.nowMs || Date.now)() - startedAt),
    },
  });

  if (input.snapshot === undefined || input.snapshot === null) {
    return finish("empty", "migrated", emptyCausalWorldSnapshot(input.worldId));
  }
  if (!isCausalRecord(input.snapshot)) {
    return finish("legacy", "rejected", undefined, [issue("CAUSAL_SNAPSHOT_MIGRATION_SCHEMA_INVALID", "snapshot must be an object", "$")]);
  }
  if (typeof input.snapshot.worldId === "string" && input.snapshot.worldId !== input.worldId) {
    return finish("legacy", "rejected", undefined, [
      issue(
        "CAUSAL_SNAPSHOT_MIGRATION_WORLD_MISMATCH",
        "snapshot worldId does not match target worldId",
        "$.worldId",
      ),
    ]);
  }

  const version = input.snapshot.snapshotSchemaVersion;
  if (typeof version === "number") {
    if (version > CAUSAL_WORLD_SNAPSHOT_SCHEMA_VERSION) {
      return finish(version, "rejected", undefined, [
        issue("CAUSAL_SNAPSHOT_MIGRATION_UNSUPPORTED_FUTURE_VERSION", "future snapshot version is not readable by this binary", "$.snapshotSchemaVersion"),
      ]);
    }
    if (version === CAUSAL_WORLD_SNAPSHOT_SCHEMA_VERSION) {
      try {
        const snapshot = assertCausalWorldSnapshotV1(input.snapshot);
        if (snapshot.worldId !== input.worldId) {
          return finish(version, "rejected", undefined, [
            issue(
              "CAUSAL_SNAPSHOT_MIGRATION_WORLD_MISMATCH",
              "snapshot worldId does not match target worldId",
              "$.worldId",
            ),
          ]);
        }
        return finish(version, "unchanged", snapshot);
      } catch (error) {
        return finish(version, "rejected", undefined, [issue(errorCode(error), "v1 snapshot validation failed", "$")]);
      }
    }
  }

  try {
    const migrated = migrateLegacySnapshotToV1(input.snapshot, input.worldId);
    const migratedEventCount = Object.keys(migrated.events).length;
    return finish("legacy", "migrated", migrated, [], migratedEventCount);
  } catch (error) {
    return finish("legacy", "rejected", undefined, [issue(errorCode(error), "legacy snapshot migration failed", "$")]);
  }
}

export function assertMigratedCausalSnapshot(input: MigrateCausalSnapshotInput): CausalWorldSnapshotV1 {
  const output = migrateCausalSnapshot({ ...input, dryRun: false });
  if (!output.snapshot) {
    throw new CausalSnapshotError("CAUSAL_SNAPSHOT_SCHEMA_INVALID", { issues: output.report.issues });
  }
  return output.snapshot;
}

function migrateLegacySnapshotToV1(snapshot: unknown, worldId: string): CausalWorldSnapshotV1 {
  if (!isCausalRecord(snapshot)) return emptyCausalWorldSnapshot(worldId);
  const migratedWorldId = typeof snapshot.worldId === "string" ? snapshot.worldId : worldId;
  const events: Record<string, ReturnType<typeof legacyCausalEventReference>> = {};
  const eventHashes: Record<string, CausalWorldEventV1["proof"]["eventHash"]> = {};
  const rawEvents = Array.isArray(snapshot.events)
    ? snapshot.events
    : Array.isArray(snapshot.legacyEvents)
      ? snapshot.legacyEvents
      : [];
  for (const rawEvent of rawEvents) {
    const causal = tryCausalEvent(rawEvent);
    if (causal) {
      if (causal.worldId !== worldId) {
        throw new CausalSnapshotError("CAUSAL_SNAPSHOT_MIGRATION_WORLD_MISMATCH", {
          eventId: causal.eventId,
          expectedWorldId: worldId,
          actualWorldId: causal.worldId,
        });
      }
      events[causal.eventId] = {
        eventId: causal.eventId,
        worldId: causal.worldId,
        occurredAtWorldMinute: causal.occurredAtWorldMinute,
        stream: causal.stream,
        causality: {
          causalParentEventIds: causal.causality.causalParentEventIds,
        },
      };
      eventHashes[causal.eventId] = causal.proof.eventHash;
      continue;
    }
    const legacy = legacyView(rawEvent, migratedWorldId);
    if (legacy) {
      if (legacy.inferredWorldId !== worldId) {
        throw new CausalSnapshotError("CAUSAL_SNAPSHOT_MIGRATION_WORLD_MISMATCH", {
          eventId: legacy.originalEventId,
          expectedWorldId: worldId,
          actualWorldId: legacy.inferredWorldId,
        });
      }
      const reference = legacyCausalEventReference(legacy);
      events[legacy.originalEventId] = reference;
      eventHashes[legacy.originalEventId] = causalCanonicalJsonHash(reference);
    }
  }
  return assertCausalWorldSnapshotV1(createCausalWorldSnapshot({
    worldId: migratedWorldId,
    schemaRegistryHash: causalSchemaRegistryHash(),
    replayCursor: replayCursorFromEventReferences(events, eventHashes),
    events,
    eventHashes,
    balances: isCausalRecord(snapshot.balances) ? snapshot.balances : undefined,
    ownership: isCausalRecord(snapshot.ownership) ? snapshot.ownership : undefined,
    domainExtensions: [],
  }));
}

function replayCursorFromEventReferences(
  events: Readonly<Record<string, ReturnType<typeof legacyCausalEventReference>>>,
  eventHashes: Readonly<Record<string, CausalWorldEventV1["proof"]["eventHash"]>>,
): CausalReplayCursorV1 {
  const sortedEvents = Object.values(events).sort((left, right) =>
    left.occurredAtWorldMinute - right.occurredAtWorldMinute ||
    (left.stream?.streamType || "").localeCompare(right.stream?.streamType || "") ||
    (left.stream?.streamId || "").localeCompare(right.stream?.streamId || "") ||
    (left.stream?.streamVersion || 0) - (right.stream?.streamVersion || 0) ||
    left.eventId.localeCompare(right.eventId));
  const last = sortedEvents[sortedEvents.length - 1];
  const streams: Record<string, CausalStreamCursorV1> = {};
  for (const event of sortedEvents) {
    if (!event.stream) continue;
    const key = `${encodeURIComponent(event.stream.streamType)}:${encodeURIComponent(event.stream.streamId)}`;
    const current = streams[key];
    if (!current || event.stream.streamVersion >= current.latestVersion) {
      streams[key] = {
        streamType: event.stream.streamType,
        streamId: event.stream.streamId,
        latestVersion: event.stream.streamVersion,
        latestEventId: event.eventId,
        latestEventHash: eventHashes[event.eventId],
        latestWorldMinute: event.occurredAtWorldMinute,
      };
    }
  }
  return {
    eventCount: sortedEvents.length,
    ...(last ? {
      lastEventId: last.eventId,
      lastEventHash: eventHashes[last.eventId],
      lastWorldMinute: Math.max(...sortedEvents.map((event) => event.occurredAtWorldMinute)),
    } : {}),
    streams: Object.keys(streams).sort().reduce((result, key) => {
      result[key] = streams[key];
      return result;
    }, {} as Record<string, CausalStreamCursorV1>),
  };
}

function tryCausalEvent(value: unknown): CausalWorldEventV1 | undefined {
  try {
    return assertCausalWorldEventV1(value);
  } catch {
    return undefined;
  }
}

function legacyView(value: unknown, worldId: string): LegacyCausalViewV1 | undefined {
  if (!isCausalRecord(value)) return undefined;
  const originalEventId = typeof value.eventId === "string"
    ? value.eventId
    : typeof value.id === "string" ? value.id : undefined;
  const originalEventType = typeof value.eventType === "string"
    ? value.eventType
    : typeof value.type === "string" ? value.type : "legacy_unknown";
  if (!originalEventId) return undefined;
  return {
    originalEventId,
    originalEventType,
    sourceLedger: typeof value.sourceLedger === "string" ? value.sourceLedger : "legacy_snapshot",
    sourcePosition: typeof value.sourcePosition === "string" ? value.sourcePosition : originalEventId,
    inferredWorldId: typeof value.worldId === "string" ? value.worldId : worldId,
    inferredActorRefs: stringArray(value.actorRefs),
    inferredSubjectRefs: stringArray(value.subjectRefs),
    inferredWorldMinute: typeof value.occurredAtWorldMinute === "number" ? value.occurredAtWorldMinute : undefined,
    knownParentEventIds: stringArray(value.causalParentEventIds),
    causalStatus: "legacy_partially_attributed",
    adapterVersion: "causal-snapshot-migration.v1",
    warnings: ["legacy_snapshot_event_has_no_canonical_hash"],
  };
}

function stringArray(value: unknown): readonly string[] {
  return Array.isArray(value)
    ? [...new Set(value.filter((entry): entry is string => typeof entry === "string" && entry.length > 0))].sort()
    : [];
}

function issue(code: string, message: string, path: string): CausalSnapshotMigrationIssue {
  return { code, message, path };
}

function errorCode(error: unknown): string {
  if (error && typeof error === "object" && "code" in error && typeof error.code === "string") return error.code;
  return "CAUSAL_SNAPSHOT_MIGRATION_SCHEMA_INVALID";
}
