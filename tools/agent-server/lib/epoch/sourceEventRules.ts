import type { EpochEvent } from "./events.ts";
import {
  assertNonEmptyString,
  normalizeTrustClass,
  sourceAuthorityForTrustClass,
  type EpochLoreSourceEventProvenance,
  type EpochSourceAuthority,
} from "./protocol.ts";

export interface SourceEventExplorerProjection {
  readonly identities: Readonly<Record<string, { readonly explorerId?: string } | undefined>>;
}

export interface KnownSourceEventsProjection {
  readonly events: readonly Pick<EpochEvent, "eventId">[];
}

export const LOW_AUTHORITY_REFUTATION_AUTHORITIES: ReadonlySet<EpochSourceAuthority> = new Set([
  "derived",
  "low-confidence",
]);

export function auditPageForEventId(eventId: string): string {
  return `/epoch/audit/${encodeURIComponent(eventId)}`;
}

export function riskReviewFlagsForEvent(event: EpochEvent): readonly string[] {
  const payload = event.payload as unknown as Record<string, unknown>;
  const flags = new Set<string>();
  if (Array.isArray(payload.tradeRiskFlags)) {
    for (const flag of payload.tradeRiskFlags) {
      if (typeof flag === "string" && flag.trim()) flags.add(flag.trim());
    }
  }
  if (event.eventType === "moderation_queued" && typeof payload.reason === "string" && payload.reason.trim()) {
    flags.add(`moderation:${payload.reason.trim()}`);
  }
  return [...flags];
}

export function riskReviewScoreForEvent(event: EpochEvent, flags = riskReviewFlagsForEvent(event)): number {
  const payload = event.payload as unknown as Record<string, unknown>;
  const score = Number(payload.tradeRiskScore);
  if (Number.isFinite(score) && score > 0) return score;
  if (event.eventType === "moderation_queued") return Math.max(1, flags.length);
  return flags.length;
}

export function riskReviewableEvent(event: EpochEvent): boolean {
  const flags = riskReviewFlagsForEvent(event);
  return flags.length > 0 || riskReviewScoreForEvent(event, flags) > 0;
}

export function riskReviewSourceEvent(input: {
  readonly events: readonly EpochEvent[];
  readonly sourceEventId: string;
}): EpochEvent {
  const sourceEvent = input.events.find((event) => event.eventId === input.sourceEventId);
  if (!sourceEvent) throw new Error("risk_review_source_event_not_found");
  return sourceEvent;
}

export function assertKnownSourceEvents(
  projection: KnownSourceEventsProjection,
  sourceEventIds: readonly string[],
): void {
  const known = new Set(projection.events.map((event) => event.eventId));
  for (const eventId of sourceEventIds) {
    if (!known.has(eventId)) throw new Error("source_event_not_found");
  }
}

export function normalizeSourceEventIds(sourceEventIds: readonly string[] | undefined, name: string): readonly string[] {
  const normalized = [...new Set((sourceEventIds || [])
    .map((eventId) => assertNonEmptyString(eventId, name)))];
  if (!normalized.length) throw new Error(`${name}_required`);
  return normalized;
}

export function riskReviewAnalysisForEvent(event: EpochEvent): {
  readonly reviewFlags: readonly string[];
  readonly reviewScore: number;
} {
  const reviewFlags = riskReviewFlagsForEvent(event);
  const reviewScore = riskReviewScoreForEvent(event, reviewFlags);
  if (!reviewFlags.length && reviewScore <= 0) throw new Error("risk_review_source_event_not_reviewable");
  return { reviewFlags, reviewScore };
}

export function sourceEventIsNonEvidence(event: EpochEvent): boolean {
  return (event.payload as { readonly nonEvidence?: unknown }).nonEvidence === true;
}

export function sourceAuthorityForEvent(event: EpochEvent): EpochSourceAuthority {
  if (event.eventType === "identity_issued" || event.eventType === "reincarnation_issued") return "official";
  if (event.eventType === "lore_contribution_recorded") {
    const payload = event.payload as { readonly category?: unknown; readonly revisionMode?: unknown };
    if (payload.category === "revision" && payload.revisionMode === "derived") return "derived";
  }
  if (sourceEventIsNonEvidence(event)) return "low-confidence";
  return sourceAuthorityForTrustClass(event.trustClass);
}

export function loreSourceEventProvenance(event: EpochEvent): EpochLoreSourceEventProvenance {
  return {
    eventId: event.eventId,
    eventType: event.eventType,
    aggregateType: event.aggregateType,
    aggregateId: event.aggregateId,
    agentId: event.agentId,
    actorExplorerId: event.actorExplorerId,
    trustClass: normalizeTrustClass(event.trustClass),
    sourceAuthority: sourceAuthorityForEvent(event),
    createdAt: event.createdAt,
    publicPages: {
      audit: auditPageForEventId(event.eventId),
    },
  };
}

export function sourceEventExplorerId(
  projection: SourceEventExplorerProjection,
  event: EpochEvent,
): string | undefined {
  const payloadAgentId = typeof (event.payload as { readonly agentId?: unknown }).agentId === "string"
    ? (event.payload as { readonly agentId: string }).agentId
    : undefined;
  const agentId = event.agentId || payloadAgentId;
  if (agentId) return projection.identities[agentId]?.explorerId;
  return event.actorExplorerId === "system" ? undefined : event.actorExplorerId;
}
