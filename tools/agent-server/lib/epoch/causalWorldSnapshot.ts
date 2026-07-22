import {
  causalCanonicalJson,
  causalCanonicalJsonHash,
} from "./causalCanonicalJson.ts";
import type {
  CausalEventReference,
  CausalStreamExpectation,
} from "./causalInvariantRules.ts";
import {
  parseQuantityMinor,
  resourceBalanceKey,
  type CausalResourceBalanceSnapshot,
  type CausalTitleOwnershipSnapshot,
} from "./causalResourceRules.ts";
import {
  causalSchemaRegistryHash,
  CAUSAL_SCHEMA_REGISTRY_VERSION,
} from "./causalSchemaRegistry.ts";
import type {
  CausalEffectV1,
  CausalOwnershipSnapshot,
  CausalResourceAccountSnapshot,
  CausalWorldEventV1,
  LegacyCausalViewV1,
  UniqueItemLifecycleState,
} from "./causalContracts.ts";
import type { ActorMind } from "./actorMindRules.ts";
import type { CausalSimulationLod, CausalSimulationLodSubjectState } from "./causalSimulationLodRules.ts";
import type { EpochKnowledgeRecord, EpochKnowledgeState } from "./knowledgeStateRules.ts";
import type { EpochWorldPressure } from "./worldPressureRules.ts";
import type { ResourceProductionAssignment, ResourceProductionNode } from "./resourceProductionRules.ts";
import { validateLifeProfile, type LifeProfileState } from "./lifeProfileRules.ts";

export const CAUSAL_WORLD_SNAPSHOT_SCHEMA_VERSION = 1 as const;

export type CausalSnapshotErrorCode =
  | "CAUSAL_SNAPSHOT_SCHEMA_INVALID"
  | "CAUSAL_SNAPSHOT_FUTURE_VERSION"
  | "CAUSAL_SNAPSHOT_REGISTRY_HASH_MISMATCH"
  | "CAUSAL_SNAPSHOT_CHECKPOINT_MISMATCH"
  | "CAUSAL_SNAPSHOT_MIGRATION_WORLD_MISMATCH"
  | "CAUSAL_REPLAY_CURSOR_CONFLICT"
  | "CAUSAL_REPLAY_STREAM_GAP"
  | "CAUSAL_REPLAY_WORLD_TIME_REGRESSION"
  | "CAUSAL_REPLAY_EVENT_HASH_CONFLICT"
  | "CAUSAL_REPLAY_EVENT_DUPLICATE";

export class CausalSnapshotError extends Error {
  readonly code: CausalSnapshotErrorCode;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(code: CausalSnapshotErrorCode, details: Readonly<Record<string, unknown>> = {}) {
    super(code);
    this.name = "CausalSnapshotError";
    this.code = code;
    this.details = details;
  }
}

export interface CausalReplayCursorV1 {
  readonly eventCount: number;
  readonly lastEventId?: string;
  readonly lastEventHash?: `sha256:${string}`;
  readonly lastRecordedAt?: string;
  readonly lastWorldMinute?: number;
  readonly streams: Readonly<Record<string, CausalStreamCursorV1>>;
}

export interface CausalStreamCursorV1 {
  readonly streamType: string;
  readonly streamId: string;
  readonly latestVersion: number;
  readonly latestEventId?: string;
  readonly latestEventHash?: `sha256:${string}`;
  readonly latestWorldMinute?: number;
}

export interface CausalCheckpointMetadataV1 {
  readonly checkpointId: string;
  readonly snapshotSchemaVersion: typeof CAUSAL_WORLD_SNAPSHOT_SCHEMA_VERSION;
  readonly worldId: string;
  readonly snapshotHash: `sha256:${string}`;
  readonly schemaRegistryVersion: string;
  readonly schemaRegistryHash: `sha256:${string}`;
  readonly replayCursor: CausalReplayCursorV1;
  readonly createdAt?: string;
  readonly migrationVersion?: number;
}

export interface CausalWorldBalancesV1 {
  readonly accounts: readonly CausalResourceAccountSnapshot[];
  readonly byAccount: Readonly<Record<string, Readonly<Record<string, string>>>>;
  readonly creditLimitsByAccount: Readonly<Record<string, Readonly<Record<string, string>>>>;
}

export interface CausalWorldOwnershipV1 {
  readonly items: readonly CausalOwnershipSnapshot[];
  readonly titleOwners: Readonly<Record<string, string>>;
}

export interface CausalKnowledgeSnapshotV1 {
  readonly records: readonly EpochKnowledgeRecord[];
  readonly byId: Readonly<Record<string, EpochKnowledgeRecord>>;
  readonly countsByKind: Readonly<Record<string, number>>;
}

export interface CausalActorMindSnapshotV1 {
  readonly mindsByActor: Readonly<Record<string, ActorMind>>;
  readonly lodBySubject: Readonly<Record<string, CausalSimulationLodSubjectState>>;
  readonly lodDistribution: Readonly<Record<CausalSimulationLod, number>>;
}

export interface CausalLifeProfileSnapshotV1 {
  readonly profileId: string;
  readonly state: LifeProfileState;
}

export interface CausalWorldDomainsV1 {
  readonly resourceProductionNodes: readonly ResourceProductionNode[];
  readonly resourceProductionAssignments: readonly ResourceProductionAssignment[];
  readonly lifeProfiles: readonly CausalLifeProfileSnapshotV1[];
}

export interface CausalDomainExtensionSlotV1 {
  readonly slotId: string;
  readonly schemaId: string;
  readonly schemaVersion: number;
  readonly owner: string;
  readonly hash: `sha256:${string}`;
  readonly payload: unknown;
}

export interface CausalWorldSnapshotV1 {
  readonly snapshotSchemaVersion: typeof CAUSAL_WORLD_SNAPSHOT_SCHEMA_VERSION;
  readonly worldId: string;
  readonly schemaRegistryVersion: string;
  readonly schemaRegistryHash: `sha256:${string}`;
  readonly replayCursor: CausalReplayCursorV1;
  readonly events: Readonly<Record<string, CausalEventReference>>;
  readonly eventHashes: Readonly<Record<string, `sha256:${string}`>>;
  readonly balances: CausalWorldBalancesV1;
  readonly ownership: CausalWorldOwnershipV1;
  readonly pressure: {
    readonly active: readonly EpochWorldPressure[];
    readonly byId: Readonly<Record<string, EpochWorldPressure>>;
    readonly backlog: {
      readonly dueCount: number;
      readonly criticalCount: number;
      readonly overdueCriticalCount: number;
    };
  };
  readonly knowledge: CausalKnowledgeSnapshotV1;
  readonly actorMind: CausalActorMindSnapshotV1;
  readonly domains: CausalWorldDomainsV1;
  readonly domainExtensions: readonly CausalDomainExtensionSlotV1[];
  readonly checkpoint?: CausalCheckpointMetadataV1;
}

export interface CreateCausalWorldSnapshotInput {
  readonly worldId: string;
  readonly schemaRegistryVersion?: string;
  readonly schemaRegistryHash?: `sha256:${string}`;
  readonly replayCursor?: Partial<CausalReplayCursorV1>;
  readonly events?: Readonly<Record<string, CausalEventReference>>;
  readonly eventHashes?: Readonly<Record<string, `sha256:${string}`>>;
  readonly balances?: Partial<CausalWorldBalancesV1>;
  readonly ownership?: Partial<CausalWorldOwnershipV1>;
  readonly pressure?: {
    readonly active?: readonly EpochWorldPressure[];
    readonly byId?: Readonly<Record<string, EpochWorldPressure>>;
  };
  readonly knowledge?: Partial<CausalKnowledgeSnapshotV1> | EpochKnowledgeState;
  readonly actorMind?: Partial<CausalActorMindSnapshotV1>;
  readonly domains?: Partial<CausalWorldDomainsV1>;
  readonly domainExtensions?: readonly CausalDomainExtensionSlotV1[];
  readonly checkpoint?: CausalCheckpointMetadataV1;
}

export interface CausalReplayContinuityResult {
  readonly ok: boolean;
  readonly expectedStreamVersion: number;
  readonly actualStreamVersion: number;
  readonly errors: readonly CausalSnapshotError[];
}

function sortRecord<T>(record: Readonly<Record<string, T>>): Readonly<Record<string, T>> {
  return Object.keys(record).sort().reduce((result, key) => {
    result[key] = record[key];
    return result;
  }, {} as Record<string, T>);
}

function uniqueSorted<T>(values: readonly T[], key: (value: T) => string): readonly T[] {
  const byKey = new Map<string, T>();
  for (const value of values) byKey.set(key(value), value);
  return [...byKey.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, value]) => value);
}

function streamKey(streamType: string, streamId: string): string {
  return `${encodeURIComponent(streamType)}:${encodeURIComponent(streamId)}`;
}

function emptyReplayCursor(input: Partial<CausalReplayCursorV1> = {}): CausalReplayCursorV1 {
  return {
    eventCount: Math.max(0, Math.floor(Number(input.eventCount || 0))),
    ...(input.lastEventId ? { lastEventId: input.lastEventId } : {}),
    ...(input.lastEventHash ? { lastEventHash: input.lastEventHash } : {}),
    ...(input.lastRecordedAt ? { lastRecordedAt: input.lastRecordedAt } : {}),
    ...(typeof input.lastWorldMinute === "number" ? { lastWorldMinute: input.lastWorldMinute } : {}),
    streams: sortRecord(input.streams || {}),
  };
}

export function emptyCausalWorldSnapshot(worldId: string): CausalWorldSnapshotV1 {
  return createCausalWorldSnapshot({ worldId });
}

export function createCausalWorldSnapshot(input: CreateCausalWorldSnapshotInput): CausalWorldSnapshotV1 {
  const schemaRegistryHashValue = input.schemaRegistryHash || causalSchemaRegistryHash();
  const knowledgeRecords = uniqueSorted(input.knowledge?.records || [], (record) => record.id);
  const knowledgeById = sortRecord(input.knowledge?.byId || Object.fromEntries(knowledgeRecords.map((record) => [record.id, record])));
  const pressureById = sortRecord(input.pressure?.byId || Object.fromEntries((input.pressure?.active || []).map((pressure) => [pressure.pressureId, pressure])));
  const activePressure = uniqueSorted(input.pressure?.active || Object.values(pressureById), (pressure) => pressure.pressureId);
  const lodBySubject = sortRecord(input.actorMind?.lodBySubject || {});
  const mindsByActor = sortRecord(input.actorMind?.mindsByActor || {});
  const snapshot: CausalWorldSnapshotV1 = {
    snapshotSchemaVersion: CAUSAL_WORLD_SNAPSHOT_SCHEMA_VERSION,
    worldId: input.worldId,
    schemaRegistryVersion: input.schemaRegistryVersion || String(CAUSAL_SCHEMA_REGISTRY_VERSION),
    schemaRegistryHash: schemaRegistryHashValue,
    replayCursor: emptyReplayCursor(input.replayCursor),
    events: sortRecord(input.events || {}),
    eventHashes: sortRecord(input.eventHashes || {}),
    balances: normalizeBalances(input.balances),
    ownership: normalizeOwnership(input.ownership),
    pressure: {
      active: activePressure,
      byId: pressureById,
      backlog: pressureBacklog(activePressure, input.replayCursor?.lastWorldMinute),
    },
    knowledge: {
      records: knowledgeRecords,
      byId: knowledgeById,
      countsByKind: knowledgeCountsByKind(knowledgeRecords),
    },
    actorMind: {
      mindsByActor,
      lodBySubject,
      lodDistribution: lodDistribution(Object.values(lodBySubject), Object.values(mindsByActor)),
    },
    domains: normalizeDomains(input.domains),
    domainExtensions: uniqueSorted(input.domainExtensions || [], (slot) => slot.slotId)
      .map((slot) => ({ ...slot, hash: causalCanonicalJsonHash(slot.payload) })),
    ...(input.checkpoint ? { checkpoint: input.checkpoint } : {}),
  };
  return snapshot.checkpoint ? snapshot : { ...snapshot, checkpoint: causalCheckpointMetadata(snapshot) };
}

export function causalWorldSnapshotHash(snapshot: CausalWorldSnapshotV1): `sha256:${string}` {
  return causalCanonicalJsonHash(causalCheckpointHashPayload(snapshot));
}

export function causalCheckpointHashPayload(snapshot: CausalWorldSnapshotV1): Omit<CausalWorldSnapshotV1, "checkpoint"> {
  const { checkpoint: _checkpoint, ...withoutCheckpoint } = snapshot;
  return withoutCheckpoint;
}

export function causalWorldSnapshotCanonicalJson(snapshot: CausalWorldSnapshotV1): string {
  return causalCanonicalJson(causalCheckpointHashPayload(snapshot));
}

export function causalCheckpointMetadata(
  snapshot: CausalWorldSnapshotV1,
  input: { readonly checkpointId?: string; readonly createdAt?: string; readonly migrationVersion?: number } = {},
): CausalCheckpointMetadataV1 {
  const snapshotHash = causalWorldSnapshotHash(snapshot);
  return {
    checkpointId: input.checkpointId || `${snapshot.worldId}:${snapshot.replayCursor.eventCount}:${snapshotHash}`,
    snapshotSchemaVersion: CAUSAL_WORLD_SNAPSHOT_SCHEMA_VERSION,
    worldId: snapshot.worldId,
    snapshotHash,
    schemaRegistryVersion: snapshot.schemaRegistryVersion,
    schemaRegistryHash: snapshot.schemaRegistryHash,
    replayCursor: snapshot.replayCursor,
    ...(input.createdAt ? { createdAt: input.createdAt } : {}),
    ...(input.migrationVersion !== undefined ? { migrationVersion: input.migrationVersion } : {}),
  };
}

export function assertCausalWorldSnapshotV1(value: unknown): CausalWorldSnapshotV1 {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new CausalSnapshotError("CAUSAL_SNAPSHOT_SCHEMA_INVALID", { field: "snapshot" });
  }
  const record = value as Partial<CausalWorldSnapshotV1> & { readonly snapshotSchemaVersion?: unknown };
  if (typeof record.snapshotSchemaVersion === "number" && record.snapshotSchemaVersion > CAUSAL_WORLD_SNAPSHOT_SCHEMA_VERSION) {
    throw new CausalSnapshotError("CAUSAL_SNAPSHOT_FUTURE_VERSION", { version: record.snapshotSchemaVersion });
  }
  if (record.snapshotSchemaVersion !== CAUSAL_WORLD_SNAPSHOT_SCHEMA_VERSION || typeof record.worldId !== "string") {
    throw new CausalSnapshotError("CAUSAL_SNAPSHOT_SCHEMA_INVALID", { field: "snapshotSchemaVersion" });
  }
  if (record.schemaRegistryHash !== causalSchemaRegistryHash()) {
    throw new CausalSnapshotError("CAUSAL_SNAPSHOT_REGISTRY_HASH_MISMATCH", {
      expected: causalSchemaRegistryHash(),
      actual: record.schemaRegistryHash,
    });
  }
  if (record.domains) assertValidDomains(record.domains);
  const normalized = createCausalWorldSnapshot({
    ...(record as CreateCausalWorldSnapshotInput),
    checkpoint: undefined,
  });
  assertReplayCursorMatchesSnapshot(normalized);
  assertCheckpointMatchesSnapshot(record.checkpoint, normalized);
  return normalized;
}

export function causalWriteSnapshotFromWorldSnapshot(snapshot: CausalWorldSnapshotV1): {
  readonly knownEvents: Readonly<Record<string, CausalEventReference>>;
  readonly stream?: CausalStreamExpectation;
  readonly balances: CausalResourceBalanceSnapshot;
  readonly ownership: CausalTitleOwnershipSnapshot;
} {
  return {
    knownEvents: snapshot.events,
    stream: latestStreamExpectation(snapshot.replayCursor),
    balances: {
      balances: snapshot.balances.byAccount,
      creditLimits: snapshot.balances.creditLimitsByAccount,
    },
    ownership: {
      titleOwners: snapshot.ownership.titleOwners,
    },
  };
}

export function latestStreamExpectation(cursor: CausalReplayCursorV1): CausalStreamExpectation | undefined {
  const latest = Object.values(cursor.streams)
    .sort((left, right) =>
      (right.latestWorldMinute || 0) - (left.latestWorldMinute || 0)
      || right.latestVersion - left.latestVersion
      || left.streamType.localeCompare(right.streamType)
      || left.streamId.localeCompare(right.streamId))[0];
  if (!latest) return undefined;
  return {
    streamType: latest.streamType,
    streamId: latest.streamId,
    expectedNextVersion: latest.latestVersion + 1,
    latestWorldMinute: latest.latestWorldMinute,
  };
}

export function checkCausalReplayContinuity(
  snapshot: CausalWorldSnapshotV1,
  event: CausalWorldEventV1,
): CausalReplayContinuityResult {
  const errors: CausalSnapshotError[] = [];
  if (event.worldId !== snapshot.worldId) {
    errors.push(new CausalSnapshotError("CAUSAL_REPLAY_CURSOR_CONFLICT", { field: "worldId" }));
  }
  if (snapshot.eventHashes[event.eventId] && snapshot.eventHashes[event.eventId] !== event.proof.eventHash) {
    errors.push(new CausalSnapshotError("CAUSAL_REPLAY_EVENT_HASH_CONFLICT", { eventId: event.eventId }));
  } else if (snapshot.eventHashes[event.eventId] === event.proof.eventHash) {
    errors.push(new CausalSnapshotError("CAUSAL_REPLAY_EVENT_DUPLICATE", { eventId: event.eventId }));
    return {
      ok: false,
      expectedStreamVersion: event.stream.streamVersion,
      actualStreamVersion: event.stream.streamVersion,
      errors,
    };
  }
  const key = streamKey(event.stream.streamType, event.stream.streamId);
  const current = snapshot.replayCursor.streams[key];
  const expectedStreamVersion = (current?.latestVersion || 0) + 1;
  if (event.stream.streamVersion !== expectedStreamVersion) {
    errors.push(new CausalSnapshotError("CAUSAL_REPLAY_STREAM_GAP", {
      streamType: event.stream.streamType,
      expectedStreamVersion,
      actualStreamVersion: event.stream.streamVersion,
    }));
  }
  if (typeof current?.latestWorldMinute === "number" && event.occurredAtWorldMinute < current.latestWorldMinute) {
    errors.push(new CausalSnapshotError("CAUSAL_REPLAY_WORLD_TIME_REGRESSION", {
      streamType: event.stream.streamType,
      latestWorldMinute: current.latestWorldMinute,
      eventWorldMinute: event.occurredAtWorldMinute,
    }));
  }
  return {
    ok: errors.length === 0,
    expectedStreamVersion,
    actualStreamVersion: event.stream.streamVersion,
    errors,
  };
}

export function applyCausalEventToSnapshot(
  snapshot: CausalWorldSnapshotV1,
  event: CausalWorldEventV1,
  input: { readonly allowDuplicate?: boolean } = {},
): CausalWorldSnapshotV1 {
  const continuity = checkCausalReplayContinuity(snapshot, event);
  const blockingErrors = input.allowDuplicate
    ? continuity.errors.filter((error) => error.code !== "CAUSAL_REPLAY_EVENT_DUPLICATE")
    : continuity.errors;
  if (blockingErrors.length > 0) throw blockingErrors[0];
  if (continuity.errors.some((error) => error.code === "CAUSAL_REPLAY_EVENT_DUPLICATE")) return snapshot;

  const events = {
    ...snapshot.events,
    [event.eventId]: eventReference(event),
  };
  const eventHashes = {
    ...snapshot.eventHashes,
    [event.eventId]: event.proof.eventHash,
  };
  const replayCursor = advanceReplayCursor(snapshot.replayCursor, event);
  return createCausalWorldSnapshot({
    ...snapshot,
    replayCursor,
    events,
    eventHashes,
    balances: applyBalanceEffects(snapshot.balances, event.effects),
    ownership: applyOwnershipEffects(snapshot.ownership, event.effects, event.occurredAtWorldMinute),
    domains: applyDomainEvents(snapshot.domains, event),
    checkpoint: undefined,
  });
}

export function legacyCausalEventReference(legacy: LegacyCausalViewV1): CausalEventReference {
  return {
    eventId: legacy.originalEventId,
    worldId: legacy.inferredWorldId || "legacy:unknown",
    occurredAtWorldMinute: legacy.inferredWorldMinute || 0,
    causality: {
      causalParentEventIds: legacy.knownParentEventIds,
    },
    legacyCausalStatus: legacy.causalStatus as CausalEventReference["legacyCausalStatus"],
  };
}

function assertCheckpointMatchesSnapshot(
  checkpoint: CausalCheckpointMetadataV1 | undefined,
  snapshot: CausalWorldSnapshotV1,
): void {
  if (!checkpoint) return;
  const expectedSnapshotHash = causalWorldSnapshotHash(snapshot);
  if (
    checkpoint.snapshotSchemaVersion !== snapshot.snapshotSchemaVersion ||
    checkpoint.worldId !== snapshot.worldId ||
    checkpoint.snapshotHash !== expectedSnapshotHash ||
    checkpoint.schemaRegistryVersion !== snapshot.schemaRegistryVersion ||
    checkpoint.schemaRegistryHash !== snapshot.schemaRegistryHash ||
    causalCanonicalJson(checkpoint.replayCursor) !== causalCanonicalJson(snapshot.replayCursor)
  ) {
    throw new CausalSnapshotError("CAUSAL_SNAPSHOT_CHECKPOINT_MISMATCH", {
      expectedSnapshotHash,
      actualSnapshotHash: checkpoint.snapshotHash,
    });
  }
}

function assertReplayCursorMatchesSnapshot(snapshot: CausalWorldSnapshotV1): void {
  const eventIds = Object.keys(snapshot.events).sort();
  const eventHashIds = Object.keys(snapshot.eventHashes).sort();
  if (
    eventIds.length !== eventHashIds.length ||
    eventIds.some((eventId, index) => eventId !== eventHashIds[index])
  ) {
    throw new CausalSnapshotError("CAUSAL_REPLAY_EVENT_HASH_CONFLICT", {
      eventIds,
      eventHashIds,
    });
  }
  if (snapshot.replayCursor.eventCount !== eventIds.length) {
    throw new CausalSnapshotError("CAUSAL_REPLAY_CURSOR_CONFLICT", {
      field: "eventCount",
      expected: eventIds.length,
      actual: snapshot.replayCursor.eventCount,
    });
  }
  if (eventIds.length === 0) {
    if (
      snapshot.replayCursor.lastEventId ||
      snapshot.replayCursor.lastEventHash ||
      Object.keys(snapshot.replayCursor.streams).length > 0
    ) {
      throw new CausalSnapshotError("CAUSAL_REPLAY_CURSOR_CONFLICT", { field: "replayCursor" });
    }
    return;
  }

  for (const eventId of eventIds) {
    const event = snapshot.events[eventId];
    if (event.eventId !== eventId || event.worldId !== snapshot.worldId) {
      throw new CausalSnapshotError("CAUSAL_REPLAY_CURSOR_CONFLICT", { eventId });
    }
  }
  const lastEventId = snapshot.replayCursor.lastEventId;
  if (!lastEventId || !snapshot.events[lastEventId] || snapshot.replayCursor.lastEventHash !== snapshot.eventHashes[lastEventId]) {
    throw new CausalSnapshotError("CAUSAL_REPLAY_CURSOR_CONFLICT", { field: "lastEventId" });
  }
  const maxWorldMinute = Math.max(...eventIds.map((eventId) => snapshot.events[eventId].occurredAtWorldMinute));
  if (snapshot.replayCursor.lastWorldMinute !== maxWorldMinute) {
    throw new CausalSnapshotError("CAUSAL_REPLAY_WORLD_TIME_REGRESSION", {
      expected: maxWorldMinute,
      actual: snapshot.replayCursor.lastWorldMinute,
    });
  }

  const expectedStreams = expectedReplayStreams(snapshot.events, snapshot.eventHashes);
  const actualStreamKeys = Object.keys(snapshot.replayCursor.streams).sort();
  const expectedStreamKeys = Object.keys(expectedStreams).sort();
  if (
    actualStreamKeys.length !== expectedStreamKeys.length ||
    actualStreamKeys.some((key, index) => key !== expectedStreamKeys[index])
  ) {
    throw new CausalSnapshotError("CAUSAL_REPLAY_CURSOR_CONFLICT", {
      field: "streams",
      expected: expectedStreamKeys,
      actual: actualStreamKeys,
    });
  }
  for (const key of expectedStreamKeys) {
    if (causalCanonicalJson(snapshot.replayCursor.streams[key]) !== causalCanonicalJson(expectedStreams[key])) {
      throw new CausalSnapshotError("CAUSAL_REPLAY_CURSOR_CONFLICT", { field: `streams.${key}` });
    }
  }
}

function expectedReplayStreams(
  events: Readonly<Record<string, CausalEventReference>>,
  eventHashes: Readonly<Record<string, `sha256:${string}`>>,
): Readonly<Record<string, CausalStreamCursorV1>> {
  const byStream = new Map<string, CausalEventReference[]>();
  for (const event of Object.values(events)) {
    if (!event.stream) continue;
    const key = streamKey(event.stream.streamType, event.stream.streamId);
    byStream.set(key, [...(byStream.get(key) || []), event]);
  }
  const streams: Record<string, CausalStreamCursorV1> = {};
  for (const [key, streamEvents] of byStream.entries()) {
    const sorted = [...streamEvents].sort((left, right) =>
      left.stream!.streamVersion - right.stream!.streamVersion ||
      left.eventId.localeCompare(right.eventId));
    sorted.forEach((event, index) => {
      if (event.stream!.streamVersion !== index + 1) {
        throw new CausalSnapshotError("CAUSAL_REPLAY_STREAM_GAP", {
          streamType: event.stream!.streamType,
          expectedStreamVersion: index + 1,
          actualStreamVersion: event.stream!.streamVersion,
        });
      }
    });
    const latest = sorted[sorted.length - 1];
    streams[key] = {
      streamType: latest.stream!.streamType,
      streamId: latest.stream!.streamId,
      latestVersion: latest.stream!.streamVersion,
      latestEventId: latest.eventId,
      latestEventHash: eventHashes[latest.eventId],
      latestWorldMinute: latest.occurredAtWorldMinute,
    };
  }
  return sortRecord(streams);
}

function eventReference(event: CausalWorldEventV1): CausalEventReference {
  return {
    eventId: event.eventId,
    worldId: event.worldId,
    occurredAtWorldMinute: event.occurredAtWorldMinute,
    stream: event.stream,
    causality: {
      causalParentEventIds: event.causality.causalParentEventIds,
    },
  };
}

function advanceReplayCursor(cursor: CausalReplayCursorV1, event: CausalWorldEventV1): CausalReplayCursorV1 {
  const key = streamKey(event.stream.streamType, event.stream.streamId);
  const streams = {
    ...cursor.streams,
    [key]: {
      streamType: event.stream.streamType,
      streamId: event.stream.streamId,
      latestVersion: event.stream.streamVersion,
      latestEventId: event.eventId,
      latestEventHash: event.proof.eventHash,
      latestWorldMinute: event.occurredAtWorldMinute,
    },
  };
  return {
    eventCount: cursor.eventCount + 1,
    lastEventId: event.eventId,
    lastEventHash: event.proof.eventHash,
    lastRecordedAt: event.recordedAt,
    lastWorldMinute: Math.max(cursor.lastWorldMinute || 0, event.occurredAtWorldMinute),
    streams: sortRecord(streams),
  };
}

function normalizeBalances(input: Partial<CausalWorldBalancesV1> | undefined): CausalWorldBalancesV1 {
  const byAccount = sortNested(input?.byAccount || {});
  const creditLimitsByAccount = sortNested(input?.creditLimitsByAccount || {});
  const accountRows = input?.accounts || Object.entries(byAccount).flatMap(([accountRef, balances]) =>
    Object.entries(balances).map(([key, balanceMinor]) => {
      const { resourceKey, unit } = splitResourceBalanceKey(key);
      const creditLimitMinor = creditLimitsByAccount[accountRef]?.[key];
      return {
        accountRef,
        resourceKey,
        unit,
        balanceMinor,
        ...(creditLimitMinor !== undefined ? { creditLimitMinor } : {}),
      };
    }));
  const accounts = uniqueSorted(accountRows, (account) => `${account.accountRef}:${resourceBalanceKey(account.resourceKey, account.unit)}`);
  return { accounts, byAccount, creditLimitsByAccount };
}

function normalizeOwnership(input: Partial<CausalWorldOwnershipV1> | undefined): CausalWorldOwnershipV1 {
  const titleOwners = sortRecord(input?.titleOwners || {});
  const fromTitleOwners = Object.entries(titleOwners).map(([itemRef, titleOwnerRef]) => ({ itemRef, titleOwnerRef }));
  const items: readonly CausalOwnershipSnapshot[] = input?.items || fromTitleOwners;
  return {
    items: uniqueSorted(items, (item) => item.itemRef),
    titleOwners,
  };
}

function normalizeDomains(input: Partial<CausalWorldDomainsV1> | undefined): CausalWorldDomainsV1 {
  const domains = {
    resourceProductionNodes: uniqueSorted(input?.resourceProductionNodes || [], (node) => node.nodeId)
      .map((node) => stripUndefined(normalizeResourceProductionNode(node)) as ResourceProductionNode),
    resourceProductionAssignments: uniqueSorted(input?.resourceProductionAssignments || [], (assignment) => assignment.assignmentId)
      .map((assignment) => stripUndefined(assignment) as ResourceProductionAssignment),
    lifeProfiles: uniqueSorted(input?.lifeProfiles || [], (profile) => profile.profileId)
      .map((profile) => stripUndefined(profile) as CausalLifeProfileSnapshotV1),
  };
  assertValidDomains(domains);
  return domains;
}

function normalizeResourceProductionNode(node: ResourceProductionNode): ResourceProductionNode {
  const record = node as unknown as Readonly<Record<string, unknown>>;
  const capacity = normalizeQuantityString(record.capacity);
  const remainingUnits = normalizeQuantityString(record.remainingUnits ?? record.remaining);
  const yieldPerWorkUnit = normalizeQuantityString(record.yieldPerWorkUnit ?? record.yieldPerWorldMinute ?? record.yield);
  return {
    ...node,
    ...(capacity !== undefined ? { capacity } : {}),
    ...(remainingUnits !== undefined ? { remainingUnits } : {}),
    ...(yieldPerWorkUnit !== undefined ? { yieldPerWorkUnit } : {}),
  };
}

function assertValidDomains(domains: CausalWorldDomainsV1): void {
  const nodeIds = new Set<string>();
  const occupiedSlots = new Set<string>();
  const assignedWorkers = new Set<string>();

  domains.resourceProductionNodes.forEach((node, index) => {
    const path = `domains.resourceProductionNodes.${index}`;
    const record = node as unknown as Readonly<Record<string, unknown>>;
    const nodeId = record.nodeId;
    if (typeof nodeId !== "string" || nodeId.length === 0 || nodeIds.has(nodeId)) {
      throw new CausalSnapshotError("CAUSAL_SNAPSHOT_SCHEMA_INVALID", { field: `${path}.nodeId` });
    }
    nodeIds.add(nodeId);

    for (const field of ["resourceKey", "resourceClass", "unit"] as const) {
      if (typeof record[field] !== "string" || record[field].length === 0) {
        throw new CausalSnapshotError("CAUSAL_SNAPSHOT_SCHEMA_INVALID", { field: `${path}.${field}` });
      }
    }
    const capacity = requiredCanonicalBigintString(record.capacity, `${path}.capacity`, "positive");
    const remainingUnits = requiredCanonicalBigintString(record.remainingUnits, `${path}.remainingUnits`, "nonNegative");
    requiredCanonicalBigintString(record.yieldPerWorkUnit, `${path}.yieldPerWorkUnit`, "positive");
    const workerSlots = requiredFiniteNumber(record.workerSlots, `${path}.workerSlots`);
    requiredNonNegativeSafeInteger(record.registeredAtWorldTime, `${path}.registeredAtWorldTime`);
    if (remainingUnits > capacity) {
      throw new CausalSnapshotError("CAUSAL_SNAPSHOT_SCHEMA_INVALID", { field: `${path}.remainingUnits` });
    }
    if (!Number.isInteger(workerSlots) || workerSlots <= 0) {
      throw new CausalSnapshotError("CAUSAL_SNAPSHOT_SCHEMA_INVALID", { field: `${path}.workerSlots` });
    }

    const depletedAt = record.depletedAtWorldTime;
    if (depletedAt !== undefined && (!Number.isFinite(depletedAt) || remainingUnits > 0n)) {
      throw new CausalSnapshotError("CAUSAL_SNAPSHOT_SCHEMA_INVALID", { field: `${path}.depletedAtWorldTime` });
    }
  });

  domains.resourceProductionAssignments.forEach((assignment, index) => {
    const path = `domains.resourceProductionAssignments.${index}`;
    const record = assignment as unknown as Readonly<Record<string, unknown>>;
    const assignmentId = record.assignmentId;
    const nodeId = record.nodeId;
    const workerRef = record.workerRef;
    const slotIndex = record.slotIndex ?? record.workerSlot;
    const slotIndexNumber = typeof slotIndex === "number" ? slotIndex : NaN;
    if (typeof assignmentId !== "string" || assignmentId.length === 0) {
      throw new CausalSnapshotError("CAUSAL_SNAPSHOT_SCHEMA_INVALID", { field: `${path}.assignmentId` });
    }
    if (typeof nodeId !== "string" || !nodeIds.has(nodeId)) {
      throw new CausalSnapshotError("CAUSAL_SNAPSHOT_SCHEMA_INVALID", { field: `${path}.nodeId` });
    }
    if (typeof workerRef !== "string" || workerRef.length === 0 || assignedWorkers.has(workerRef)) {
      throw new CausalSnapshotError("CAUSAL_SNAPSHOT_SCHEMA_INVALID", { field: `${path}.workerRef` });
    }
    assignedWorkers.add(workerRef);

    const node = domains.resourceProductionNodes.find((item) => item.nodeId === nodeId) as unknown as Readonly<Record<string, unknown>> | undefined;
    const workerSlots = Number(node?.workerSlots);
    if (!Number.isInteger(slotIndexNumber) || slotIndexNumber < 0 || slotIndexNumber >= workerSlots) {
      throw new CausalSnapshotError("CAUSAL_SNAPSHOT_SCHEMA_INVALID", { field: `${path}.slotIndex` });
    }
    const slotKey = `${nodeId}:${slotIndexNumber}`;
    if (occupiedSlots.has(slotKey)) {
      throw new CausalSnapshotError("CAUSAL_SNAPSHOT_SCHEMA_INVALID", { field: `${path}.slotIndex` });
    }
    occupiedSlots.add(slotKey);
  });

  domains.lifeProfiles.forEach((profile, index) => {
    const path = `domains.lifeProfiles.${index}`;
    if (!profile.profileId || !isLifeProfileState(profile.state)) {
      throw new CausalSnapshotError("CAUSAL_SNAPSHOT_SCHEMA_INVALID", { field: path });
    }
    const errors = validateLifeProfile(profile.state);
    if (errors.length > 0) {
      throw new CausalSnapshotError("CAUSAL_SNAPSHOT_SCHEMA_INVALID", {
        field: `${path}.state`,
        lifeProfileErrors: errors,
      });
    }
  });
}

function normalizeQuantityString(value: unknown): string | undefined {
  return (typeof value === "number" && Number.isSafeInteger(value)) || typeof value === "bigint"
    ? value.toString()
    : typeof value === "string"
      ? value
      : undefined;
}

function requiredFiniteQuantity(value: unknown, field: string): number {
  if (
    (typeof value !== "number" && typeof value !== "string") ||
    (typeof value === "string" && value.trim().length === 0)
  ) {
    throw new CausalSnapshotError("CAUSAL_SNAPSHOT_SCHEMA_INVALID", { field });
  }
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    throw new CausalSnapshotError("CAUSAL_SNAPSHOT_SCHEMA_INVALID", { field });
  }
  return numeric;
}

function requiredCanonicalBigintString(
  value: unknown,
  field: string,
  kind: "nonNegative" | "positive",
): bigint {
  if (typeof value !== "string" || !/^(0|[1-9]\d*)$/.test(value)) {
    throw new CausalSnapshotError("CAUSAL_SNAPSHOT_SCHEMA_INVALID", { field });
  }
  const parsed = parseQuantityMinor(value);
  if (parsed === undefined || (kind === "positive" ? parsed <= 0n : parsed < 0n)) {
    throw new CausalSnapshotError("CAUSAL_SNAPSHOT_SCHEMA_INVALID", { field });
  }
  return parsed;
}

function requiredFiniteNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new CausalSnapshotError("CAUSAL_SNAPSHOT_SCHEMA_INVALID", { field });
  }
  return value;
}

function requiredNonNegativeSafeInteger(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || Number(value) < 0) {
    throw new CausalSnapshotError("CAUSAL_SNAPSHOT_SCHEMA_INVALID", { field });
  }
  return Number(value);
}

function applyDomainEvents(domains: CausalWorldDomainsV1, event: CausalWorldEventV1): CausalWorldDomainsV1 {
  const payload = event.payload as Readonly<Record<string, unknown>>;
  if (event.eventType === "resource_node_registered" || event.eventType === "resource_node_replenished") {
    const node = payload.node;
    if (isResourceProductionNode(node)) {
      return normalizeDomains({ ...domains, resourceProductionNodes: upsert(domains.resourceProductionNodes, node, (item) => item.nodeId) });
    }
  }
  if (event.eventType === "resource_production_assigned") {
    const assignment = payload.assignment;
    if (isResourceProductionAssignment(assignment)) {
      return normalizeDomains({ ...domains, resourceProductionAssignments: upsert(domains.resourceProductionAssignments, assignment, (item) => item.assignmentId) });
    }
  }
  if (event.eventType === "resource_production_committed") {
    const node = payload.node;
    if (isResourceProductionNode(node)) {
      return normalizeDomains({ ...domains, resourceProductionNodes: upsert(domains.resourceProductionNodes, node, (item) => item.nodeId) });
    }
  }
  if (event.eventType === "life_profile_created" || event.eventType === "life_profile_advanced") {
    const profileId = typeof payload.profileId === "string" ? payload.profileId : undefined;
    const state = payload.state;
    if (profileId && isLifeProfileState(state)) {
      return normalizeDomains({ ...domains, lifeProfiles: upsert(domains.lifeProfiles, { profileId, state }, (item) => item.profileId) });
    }
  }
  if (event.eventType === "ecology_tick_resolved" && Array.isArray(payload.lifeAdvances)) {
    const lifeProfiles = payload.lifeAdvances.reduce((items, entry) => {
      if (!entry || typeof entry !== "object") return items;
      const record = entry as { readonly profileId?: unknown; readonly state?: unknown };
      if (typeof record.profileId !== "string" || !isLifeProfileState(record.state)) return items;
      return upsert(items, { profileId: record.profileId, state: record.state }, (item) => item.profileId);
    }, domains.lifeProfiles);
    return normalizeDomains({ ...domains, lifeProfiles });
  }
  return domains;
}

function upsert<T>(items: readonly T[], item: T, key: (value: T) => string): readonly T[] {
  const itemKey = key(item);
  return [...items.filter((existing) => key(existing) !== itemKey), item];
}

function isResourceProductionNode(value: unknown): value is ResourceProductionNode {
  return Boolean(value && typeof value === "object" && typeof (value as { readonly nodeId?: unknown }).nodeId === "string");
}

function isResourceProductionAssignment(value: unknown): value is ResourceProductionAssignment {
  return Boolean(value && typeof value === "object" && typeof (value as { readonly assignmentId?: unknown }).assignmentId === "string");
}

function isLifeProfileState(value: unknown): value is LifeProfileState {
  return Boolean(value && typeof value === "object" && typeof (value as { readonly worldMinute?: unknown }).worldMinute === "number");
}

function stripUndefined(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((entry) => stripUndefined(entry));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value as Readonly<Record<string, unknown>>)
    .filter(([, entry]) => entry !== undefined)
    .map(([key, entry]) => [key, stripUndefined(entry)]));
}

function sortNested(record: Readonly<Record<string, Readonly<Record<string, string>>>>): Readonly<Record<string, Readonly<Record<string, string>>>> {
  return sortRecord(Object.fromEntries(Object.entries(record).map(([key, value]) => [key, sortRecord(value)])));
}

function splitResourceBalanceKey(key: string): { readonly resourceKey: string; readonly unit: string } {
  const index = key.lastIndexOf(":");
  return index <= 0 ? { resourceKey: key, unit: "unit" } : { resourceKey: key.slice(0, index), unit: key.slice(index + 1) };
}

function applyBalanceEffects(balances: CausalWorldBalancesV1, effects: readonly CausalEffectV1[]): CausalWorldBalancesV1 {
  const byAccount = mutableNested(balances.byAccount);
  for (const effect of effects) {
    if (effect.effectType !== "resource_ledger") continue;
    const after = effect.after as {
      readonly resourceKey?: unknown;
      readonly unit?: unknown;
      readonly entries?: readonly { readonly accountRef?: unknown; readonly quantityMinor?: unknown }[];
    };
    if (typeof after.resourceKey !== "string" || typeof after.unit !== "string" || !Array.isArray(after.entries)) continue;
    const key = resourceBalanceKey(after.resourceKey, after.unit);
    for (const entry of after.entries) {
      if (typeof entry.accountRef !== "string" || typeof entry.quantityMinor !== "string") continue;
      const delta = parseQuantityMinor(entry.quantityMinor);
      if (delta === undefined) continue;
      const account = byAccount[entry.accountRef] || {};
      const current = parseQuantityMinor(account[key] || "0") || 0n;
      account[key] = String(current + delta);
      byAccount[entry.accountRef] = account;
    }
  }
  return normalizeBalances({
    byAccount,
    creditLimitsByAccount: balances.creditLimitsByAccount,
  });
}

function applyOwnershipEffects(
  ownership: CausalWorldOwnershipV1,
  effects: readonly CausalEffectV1[],
  worldMinute: number,
): CausalWorldOwnershipV1 {
  const titleOwners = { ...ownership.titleOwners };
  const itemStates = new Map(ownership.items.map((item) => [item.itemRef, item]));
  for (const effect of effects) {
    if (effect.effectType === "ownership_interest") {
      const after = effect.after as {
        readonly itemRef?: unknown;
        readonly holderRef?: unknown;
        readonly interestType?: unknown;
        readonly status?: unknown;
        readonly validFromWorldMinute?: unknown;
        readonly validUntilWorldMinute?: unknown;
      };
      const itemRef = refKey(after.itemRef);
      const holderRef = refKey(after.holderRef);
      if (!itemRef || !holderRef || after.interestType !== "title") continue;
      const validFrom = typeof after.validFromWorldMinute === "number" ? after.validFromWorldMinute : 0;
      const validUntil = typeof after.validUntilWorldMinute === "number" ? after.validUntilWorldMinute : undefined;
      const active = after.status === "granted" && validFrom <= worldMinute && (validUntil === undefined || validUntil > worldMinute);
      if (active) titleOwners[itemRef] = holderRef;
      itemStates.set(itemRef, { ...(itemStates.get(itemRef) || { itemRef }), ...(active ? { titleOwnerRef: holderRef } : {}) });
    }
    if (effect.effectType === "unique_item_lifecycle") {
      const after = effect.after as {
        readonly itemId?: unknown;
        readonly itemType?: unknown;
        readonly toState?: unknown;
        readonly titleOwnerRef?: unknown;
      };
      const itemRef = typeof after.itemId === "string"
        ? `${typeof after.itemType === "string" ? after.itemType : "item"}:${after.itemId}`
        : undefined;
      if (!itemRef) continue;
      const titleOwnerRef = refKey(after.titleOwnerRef);
      if (titleOwnerRef) titleOwners[itemRef] = titleOwnerRef;
      itemStates.set(itemRef, {
        ...(itemStates.get(itemRef) || { itemRef }),
        ...(titleOwnerRef ? { titleOwnerRef } : {}),
        ...(typeof after.toState === "string" ? { lifecycleState: after.toState as UniqueItemLifecycleState } : {}),
      });
    }
  }
  return normalizeOwnership({
    titleOwners,
    items: [...itemStates.values()],
  });
}

function mutableNested(record: Readonly<Record<string, Readonly<Record<string, string>>>>): Record<string, Record<string, string>> {
  return Object.fromEntries(Object.entries(record).map(([key, value]) => [key, { ...value }]));
}

function refKey(ref: unknown): string | undefined {
  if (typeof ref === "string" && ref) return ref;
  if (!ref || typeof ref !== "object") return undefined;
  const record = ref as { readonly entityType?: unknown; readonly entityId?: unknown };
  return typeof record.entityType === "string" && typeof record.entityId === "string"
    ? `${record.entityType}:${record.entityId}`
    : undefined;
}

function pressureBacklog(pressures: readonly EpochWorldPressure[], currentWorldMinute = 0) {
  const open = pressures.filter((pressure) => !["resolved", "transformed"].includes(pressure.state));
  return {
    dueCount: open.filter((pressure) => pressure.reviewAtWorldMinute <= currentWorldMinute).length,
    criticalCount: open.filter((pressure) => pressure.severity >= 60).length,
    overdueCriticalCount: open.filter((pressure) => pressure.severity >= 60 && pressure.reviewAtWorldMinute <= currentWorldMinute).length,
  };
}

function knowledgeCountsByKind(records: readonly EpochKnowledgeRecord[]): Readonly<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const record of records) counts[record.kind] = (counts[record.kind] || 0) + 1;
  return sortRecord(counts);
}

function lodDistribution(
  subjects: readonly CausalSimulationLodSubjectState[],
  minds: readonly ActorMind[],
): Readonly<Record<CausalSimulationLod, number>> {
  const counts: Record<CausalSimulationLod, number> = { 0: 0, 1: 0, 2: 0, 3: 0 };
  for (const subject of subjects) counts[subject.simulationLod] += 1;
  for (const mind of minds) counts[mind.simulationLod] += 1;
  return counts;
}
