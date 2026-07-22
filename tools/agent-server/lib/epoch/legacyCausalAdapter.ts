import type { EpochEvent } from "./events.ts";

export type LegacyCausalAttribution = "attributed" | "partial" | "unattributed";

export interface LegacyCausalSource {
  readonly ledger?: string;
  readonly position?: string | number;
  readonly warnings: readonly string[];
}

export interface LegacyCausalView {
  readonly attribution: LegacyCausalAttribution;
  readonly eventId?: string;
  readonly eventType?: string;
  readonly aggregateType?: string;
  readonly aggregateId?: string;
  readonly actorRef?: string;
  readonly causationId?: string;
  readonly correlationId?: string;
  readonly idempotencyKey?: string;
  readonly createdAt?: string;
  readonly source: LegacyCausalSource;
  readonly raw: unknown;
}

export interface LegacyCausalViewInput {
  readonly record: EpochEvent | Readonly<Record<string, unknown>> | unknown;
  readonly sourceLedger?: string;
  readonly sourcePosition?: string | number;
  readonly warnings?: readonly string[];
}

export function legacyCausalViewFromEpochEvent(
  event: EpochEvent,
  source: Omit<LegacyCausalSource, "warnings"> & { readonly warnings?: readonly string[] } = {},
): LegacyCausalView {
  return legacyCausalViewFromRecord({
    record: event,
    sourceLedger: source.ledger,
    sourcePosition: source.position,
    warnings: source.warnings,
  });
}

export function legacyCausalViewFromRecord(input: LegacyCausalViewInput): LegacyCausalView {
  const record = isRecord(input.record) ? input.record : undefined;
  const recordSource = isRecord(record?.source) ? record.source : undefined;
  const eventId = readString(record, "eventId");
  const eventType = readString(record, "eventType");
  const aggregateType = readString(record, "aggregateType");
  const aggregateId = readString(record, "aggregateId");
  const actorRef = readString(record, "actorExplorerId") ?? readString(record, "actorRef");
  const causationId = readString(record, "causationId");
  const correlationId = readString(record, "correlationId");
  const idempotencyKey = readString(record, "idempotencyKey");
  const createdAt = readString(record, "createdAt");
  const sourceLedger = input.sourceLedger ?? readString(record, "sourceLedger") ?? readString(record, "ledger")
    ?? readString(recordSource, "ledger");
  const sourcePosition = input.sourcePosition ?? readStringOrNumber(record, "sourcePosition")
    ?? readStringOrNumber(record, "position") ?? readStringOrNumber(recordSource, "position");
  const warnings = [...readWarnings(record), ...readWarnings(recordSource), ...(input.warnings ?? [])];

  if (!record) warnings.push("legacy_record_not_object");
  if (!eventId) warnings.push("legacy_event_id_missing");
  if (!eventType) warnings.push("legacy_event_type_missing");
  if (!actorRef) warnings.push("legacy_actor_missing");
  if (!causationId) warnings.push("legacy_causation_id_missing");
  if (!correlationId) warnings.push("legacy_correlation_id_missing");

  return {
    attribution: attributionFor({ eventId, eventType, actorRef, causationId, correlationId }),
    ...(eventId !== undefined ? { eventId } : {}),
    ...(eventType !== undefined ? { eventType } : {}),
    ...(aggregateType !== undefined ? { aggregateType } : {}),
    ...(aggregateId !== undefined ? { aggregateId } : {}),
    ...(actorRef !== undefined ? { actorRef } : {}),
    ...(causationId !== undefined ? { causationId } : {}),
    ...(correlationId !== undefined ? { correlationId } : {}),
    ...(idempotencyKey !== undefined ? { idempotencyKey } : {}),
    ...(createdAt !== undefined ? { createdAt } : {}),
    source: {
      ...(sourceLedger !== undefined ? { ledger: sourceLedger } : {}),
      ...(sourcePosition !== undefined ? { position: sourcePosition } : {}),
      warnings,
    },
    raw: input.record,
  };
}

export function legacyCausalViewsFromRecords(
  records: readonly (EpochEvent | Readonly<Record<string, unknown>> | unknown)[],
  source: Omit<LegacyCausalSource, "warnings"> & { readonly warnings?: readonly string[] } = {},
): LegacyCausalView[] {
  return records.map((record, index) => legacyCausalViewFromRecord({
    record,
    sourceLedger: source.ledger,
    sourcePosition: source.position ?? index,
    warnings: source.warnings,
  }));
}

function attributionFor(input: {
  readonly eventId?: string;
  readonly eventType?: string;
  readonly actorRef?: string;
  readonly causationId?: string;
  readonly correlationId?: string;
}): LegacyCausalAttribution {
  if (!input.eventId || !input.eventType) return "unattributed";
  if (input.actorRef && input.causationId && input.correlationId) return "attributed";
  return "partial";
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function readString(record: Readonly<Record<string, unknown>> | undefined, key: string): string | undefined {
  const value = record?.[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function readStringOrNumber(
  record: Readonly<Record<string, unknown>> | undefined,
  key: string,
): string | number | undefined {
  const value = record?.[key];
  if (typeof value === "string" && value.length > 0) return value;
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function readWarnings(record: Readonly<Record<string, unknown>> | undefined): string[] {
  const value = record?.warnings;
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}
