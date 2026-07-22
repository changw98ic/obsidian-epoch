import {
  assertCausalWorldEventV1,
  type CausalWorldEventV1,
  type LegacyCausalViewV1,
} from "./causalContracts.ts";
import { causalCanonicalJson } from "./causalCanonicalJson.ts";
import {
  assertNonEmptyString,
  type EpochAggregateType,
} from "./protocol.ts";
import type { EpochEvent } from "./events.ts";

export const CAUSAL_EPOCH_ADAPTER_VERSION = "causal-epoch-adapter-v1" as const;
export const CAUSAL_WORLD_EVENT_RECORDED_PAYLOAD_SCHEMA_VERSION = "1.0.0" as const;

export interface CausalWorldEventRecordedPayload {
  readonly schemaVersion: typeof CAUSAL_WORLD_EVENT_RECORDED_PAYLOAD_SCHEMA_VERSION;
  readonly adapterVersion: typeof CAUSAL_EPOCH_ADAPTER_VERSION;
  readonly causalEvent: CausalWorldEventV1;
  readonly worldTime: {
    readonly occurredAtWorldMinute: number;
    readonly recordedAt: string;
  };
}

export type CausalWorldEventRecordedEpochEvent = Extract<EpochEvent, {
  readonly eventType: "causal_world_event_recorded";
}>;

export type EpochCausalView = CausalWorldEventV1 | LegacyCausalViewV1;

export interface CausalWorldEventsReadInput {
  readonly eventType?: string;
  readonly worldId?: string;
  readonly namespace?: string;
  readonly agentId?: string;
  readonly explorerId?: string;
  readonly actorRef?: string;
  readonly subjectRef?: string;
  readonly regionId?: string;
  readonly limit?: number;
}

function entityRefKey(ref: { readonly entityType: string; readonly entityId: string }): string {
  return `${ref.entityType}:${ref.entityId}`;
}

function actorExplorerIdFor(event: CausalWorldEventV1): string {
  const playerActor = event.actorRefs.find((actor) => actor.actorType === "player_identity");
  if (playerActor) return playerActor.actorId;
  const firstActor = event.actorRefs[0];
  return firstActor ? `${firstActor.actorType}:${firstActor.actorId}` : "system";
}

function agentIdFor(event: CausalWorldEventV1): string | undefined {
  return event.actorRefs.find((actor) => actor.actorType === "player_identity")?.actorId;
}

function aggregateTypeFor(event: CausalWorldEventV1): EpochAggregateType {
  if (event.namespace === "identity" || event.namespace === "lineage") return "agent_identity";
  if (event.namespace === "run") return "party_run";
  return "world_simulation";
}

function aggregateIdFor(event: CausalWorldEventV1): string {
  return assertNonEmptyString(
    `${event.worldId}:${event.stream.streamType}:${event.stream.streamId}`,
    "causal_epoch_aggregate_id",
  );
}

export function assertCausalWorldEventRecordedPayload(value: unknown): CausalWorldEventRecordedPayload {
  if (!value || typeof value !== "object") {
    throw new Error("causal_world_event_payload_required");
  }
  const payload = value as {
    readonly schemaVersion?: unknown;
    readonly adapterVersion?: unknown;
    readonly causalEvent?: unknown;
    readonly worldTime?: unknown;
  };
  if (payload.schemaVersion !== CAUSAL_WORLD_EVENT_RECORDED_PAYLOAD_SCHEMA_VERSION) {
    throw new Error("causal_world_event_payload_schema_version_invalid");
  }
  if (payload.adapterVersion !== CAUSAL_EPOCH_ADAPTER_VERSION) {
    throw new Error("causal_world_event_adapter_version_invalid");
  }
  const causalEvent = assertCausalWorldEventV1(payload.causalEvent);
  if (!payload.worldTime || typeof payload.worldTime !== "object") {
    throw new Error("causal_world_event_world_time_required");
  }
  const worldTime = payload.worldTime as {
    readonly occurredAtWorldMinute?: unknown;
    readonly recordedAt?: unknown;
  };
  if (worldTime.occurredAtWorldMinute !== causalEvent.occurredAtWorldMinute
    || worldTime.recordedAt !== causalEvent.recordedAt) {
    throw new Error("causal_world_event_world_time_mismatch");
  }
  return {
    schemaVersion: CAUSAL_WORLD_EVENT_RECORDED_PAYLOAD_SCHEMA_VERSION,
    adapterVersion: CAUSAL_EPOCH_ADAPTER_VERSION,
    causalEvent,
    worldTime: {
      occurredAtWorldMinute: causalEvent.occurredAtWorldMinute,
      recordedAt: causalEvent.recordedAt,
    },
  };
}

export function causalWorldEventToEpochEvent(event: CausalWorldEventV1): CausalWorldEventRecordedEpochEvent {
  const causalEvent = assertCausalWorldEventV1(event);
  const payload: CausalWorldEventRecordedPayload = {
    schemaVersion: CAUSAL_WORLD_EVENT_RECORDED_PAYLOAD_SCHEMA_VERSION,
    adapterVersion: CAUSAL_EPOCH_ADAPTER_VERSION,
    causalEvent,
    worldTime: {
      occurredAtWorldMinute: causalEvent.occurredAtWorldMinute,
      recordedAt: causalEvent.recordedAt,
    },
  };
  return {
    eventId: causalEvent.eventId,
    eventType: "causal_world_event_recorded",
    aggregateType: aggregateTypeFor(causalEvent),
    aggregateId: aggregateIdFor(causalEvent),
    actorExplorerId: actorExplorerIdFor(causalEvent),
    agentId: agentIdFor(causalEvent),
    trustClass: "system_worker",
    causationId: causalEvent.command.commandId,
    correlationId: causalEvent.command.idempotencyKey,
    idempotencyKey: causalEvent.command.idempotencyKey,
    createdAt: causalEvent.recordedAt,
    payload,
  } as CausalWorldEventRecordedEpochEvent;
}

export function epochEventToCausalView(event: EpochEvent): EpochCausalView {
  if (event.eventType === "causal_world_event_recorded") {
    return assertCausalWorldEventRecordedPayload(event.payload).causalEvent;
  }
  return legacyCausalViewForEpochEvent(event);
}

export function causalWorldEventFromEpochEvent(event: EpochEvent): CausalWorldEventV1 | undefined {
  if (event.eventType !== "causal_world_event_recorded") return undefined;
  return assertCausalWorldEventRecordedPayload(event.payload).causalEvent;
}

export function causalEpochEventCanonicalJson(event: EpochEvent): string {
  return causalCanonicalJson(event);
}

export function legacyCausalViewForEpochEvent(event: EpochEvent): LegacyCausalViewV1 {
  const payload = event.payload as unknown as Record<string, unknown>;
  const actorRefs = [
    event.agentId ? `player_identity:${event.agentId}` : undefined,
    event.actorExplorerId ? `explorer:${event.actorExplorerId}` : undefined,
  ].filter((entry): entry is string => Boolean(entry));
  const sourceEventIds = Array.isArray(payload.sourceEventIds)
    ? payload.sourceEventIds.filter((entry): entry is string => typeof entry === "string" && entry.length > 0)
    : [];
  const inferredWorldMinute = typeof payload.worldMinute === "number" && Number.isSafeInteger(payload.worldMinute)
    ? payload.worldMinute
    : undefined;
  return {
    originalEventId: event.eventId,
    originalEventType: event.eventType,
    sourceLedger: "epoch",
    sourcePosition: event.eventId,
    inferredActorRefs: actorRefs,
    inferredSubjectRefs: [`${event.aggregateType}:${event.aggregateId}`],
    inferredWorldMinute,
    knownParentEventIds: sourceEventIds,
    causalStatus: sourceEventIds.length > 0 || actorRefs.length > 0
      ? "legacy_partially_attributed"
      : "legacy_unattributed",
    adapterVersion: CAUSAL_EPOCH_ADAPTER_VERSION,
    warnings: ["legacy_epoch_event_read_only_view_not_canonical_causal_fact"],
  };
}

function matchesReadInput(event: CausalWorldEventV1, input: CausalWorldEventsReadInput): boolean {
  if (input.eventType && event.eventType !== input.eventType) return false;
  if (input.worldId && event.worldId !== input.worldId) return false;
  if (input.namespace && event.namespace !== input.namespace) return false;
  if (input.agentId && !event.actorRefs.some((actor) => actor.actorType === "player_identity" && actor.actorId === input.agentId)) {
    return false;
  }
  if (input.explorerId && !event.actorRefs.some((actor) => actor.actorId === input.explorerId)) return false;
  if (input.actorRef && !event.actorRefs.some((actor) => `${actor.actorType}:${actor.actorId}` === input.actorRef)) {
    return false;
  }
  if (input.subjectRef && !event.subjectRefs.some((subject) => entityRefKey(subject) === input.subjectRef)) return false;
  if (input.regionId && !event.regionRefs.includes(input.regionId)) return false;
  return true;
}

export function causalWorldEventsFromEpochEvents(
  events: readonly EpochEvent[],
  input: CausalWorldEventsReadInput = {},
): readonly CausalWorldEventV1[] {
  const limit = Number.isFinite(Number(input.limit)) && Number(input.limit) > 0
    ? Number(input.limit)
    : 50;
  const results: CausalWorldEventV1[] = [];
  for (let index = events.length - 1; index >= 0 && results.length < limit; index -= 1) {
    const event = causalWorldEventFromEpochEvent(events[index]);
    if (event && matchesReadInput(event, input)) results.push(event);
  }
  return results;
}
