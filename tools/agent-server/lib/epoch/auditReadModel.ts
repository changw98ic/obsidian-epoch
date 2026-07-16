import { type EpochEvent } from "./events.ts";
import { type EpochProjection, type EpochRiskReview } from "./gameCore.ts";
import { type EpochEventType, type EpochTrustClass } from "./protocol.ts";

type AnyRecord = Record<string, unknown>;

export interface EpochAuditEventSummary {
  readonly eventId: string;
  readonly eventType: EpochEventType;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly actorExplorerId: string;
  readonly agentId?: string;
  readonly trustClass: EpochTrustClass | string;
  readonly causationId: string;
  readonly correlationId: string;
  readonly idempotencyKey?: string;
  readonly createdAt: string;
  readonly highImpact: boolean;
  readonly reviewFlags: readonly string[];
  readonly reviewScore: number;
  readonly riskReview?: EpochAuditRiskReviewSummary;
  readonly payload: AnyRecord;
  readonly publicPages: {
    readonly audit: string;
  };
}

export interface EpochAuditRiskAgentProfile {
  readonly agentId: string;
  readonly explorerId: string;
  readonly eventCount: number;
  readonly reviewScore: number;
  readonly flags: Readonly<Record<string, number>>;
  readonly latestEventId: string;
  readonly latestReviewedAt: string;
}

export interface EpochAuditRiskProfile {
  readonly eventCount: number;
  readonly reviewScore: number;
  readonly flags: Readonly<Record<string, number>>;
  readonly agents: readonly EpochAuditRiskAgentProfile[];
  readonly latestEventId?: string;
  readonly latestReviewedAt?: string;
}

export interface EpochAuditRiskReviewSummary {
  readonly reviewId: string;
  readonly sourceEventId: string;
  readonly resolution: EpochRiskReview["resolution"];
  readonly reviewFlags: readonly string[];
  readonly reviewScore: number;
  readonly reviewedAt: string;
}

export interface EpochAuditInfo {
  readonly agentId?: string;
  readonly eventType?: string;
  readonly eventId?: string;
  readonly aggregateId?: string;
  readonly highImpactOnly: boolean;
  readonly riskOnly: boolean;
  readonly total: number;
  readonly events: readonly EpochAuditEventSummary[];
  readonly selectedEvent?: EpochAuditEventSummary;
  readonly riskProfile: EpochAuditRiskProfile;
  readonly replay: {
    readonly eventIds: readonly string[];
    readonly aggregateIds: readonly string[];
    readonly trustClasses: readonly string[];
    readonly highImpactEventTypes: readonly string[];
  };
  readonly publicPages: {
    readonly index: string;
    readonly audit?: string;
  };
}

const HIGH_IMPACT_EVENT_TYPES = new Set<EpochEventType>([
  "explorer_recovery_rotated",
  "identity_archived",
  "agent_custody_changed",
  "reincarnation_issued",
  "resource_granted",
  "resource_spent",
  "race_commission_completed",
  "downtime_claimed",
  "downtime_tick_resolved",
  "contested_objective_contributed",
  "contested_objective_settled",
  "resource_node_spawned",
  "resource_node_contested",
  "resource_node_settled",
  "item_created",
  "item_bound",
  "item_transferred",
  "market_order_created",
  "market_order_filled",
  "market_order_cancelled",
  "market_order_expired",
  "bounty_created",
  "bounty_claimed",
  "raid_resolved",
  "relationship_updated",
  "hosted_action_recorded",
  "journey_world_solidified",
  "attestation_recorded",
  "legend_awarded",
  "moderation_queued",
  "moderation_resolved",
  "command_rejected",
  "abuse_score_changed",
  "abuse_score_released",
  "season_contribution_recorded",
  "season_campaign_resolved",
  "region_control_changed",
  "region_monument_built",
]);

const AUDIT_REDACTED_KEYS = /api.?key|secret|token|signature|visibleText|transcript|private/i;

function recordValue(value: unknown): AnyRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value) ? value as AnyRecord : {};
}

function eventIsForAgent(event: EpochProjection["events"][number], agentId: string) {
  return event.agentId === agentId || event.aggregateId === agentId;
}

function auditPayloadValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => auditPayloadValue(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(recordValue(value)).map(([key, nestedValue]) => [
      key,
      AUDIT_REDACTED_KEYS.test(key) ? "[redacted]" : auditPayloadValue(nestedValue),
    ]));
  }
  if (typeof value === "string" && AUDIT_REDACTED_KEYS.test(value)) return "[redacted]";
  return value;
}

function auditPayload(payload: EpochEvent["payload"]): AnyRecord {
  return Object.fromEntries(Object.entries(recordValue(payload)).map(([key, value]) => [
    key,
    AUDIT_REDACTED_KEYS.test(key) ? "[redacted]" : auditPayloadValue(value),
  ]));
}

function isHighImpactEvent(event: EpochProjection["events"][number]) {
  return HIGH_IMPACT_EVENT_TYPES.has(event.eventType);
}

function auditReviewFlags(event: EpochProjection["events"][number]): readonly string[] {
  const payload = recordValue(event.payload);
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

function auditReviewScore(event: EpochProjection["events"][number], flags = auditReviewFlags(event)): number {
  const payload = recordValue(event.payload);
  const declaredScore = Number(payload.tradeRiskScore);
  if (Number.isFinite(declaredScore) && declaredScore > 0) return declaredScore;
  if (event.eventType === "moderation_queued") return Math.max(1, flags.length);
  return flags.length;
}

export function eventNeedsRiskReview(event: EpochProjection["events"][number]) {
  const flags = auditReviewFlags(event);
  return auditReviewScore(event, flags) > 0 || flags.length > 0;
}

function incrementFlagCounts(target: Record<string, number>, flags: readonly string[]) {
  for (const flag of flags) {
    target[flag] = (target[flag] || 0) + 1;
  }
}

export function auditRiskProfile(events: readonly EpochProjection["events"][number][]): EpochAuditRiskProfile {
  const riskEvents = events.filter(eventNeedsRiskReview);
  const flags: Record<string, number> = {};
  const agents = new Map<string, {
    agentId: string;
    explorerId: string;
    eventCount: number;
    reviewScore: number;
    flags: Record<string, number>;
    latestEventId: string;
    latestReviewedAt: string;
  }>();
  let reviewScore = 0;
  let latestEventId: string | undefined;
  let latestReviewedAt: string | undefined;
  for (const event of riskEvents) {
    const eventFlags = auditReviewFlags(event);
    const eventScore = auditReviewScore(event, eventFlags);
    reviewScore += eventScore;
    incrementFlagCounts(flags, eventFlags);
    if (!latestReviewedAt || event.createdAt >= latestReviewedAt) {
      latestEventId = event.eventId;
      latestReviewedAt = event.createdAt;
    }
    const agentId = event.agentId || event.aggregateId;
    const explorerId = event.actorExplorerId;
    const existing = agents.get(agentId) || {
      agentId,
      explorerId,
      eventCount: 0,
      reviewScore: 0,
      flags: {},
      latestEventId: event.eventId,
      latestReviewedAt: event.createdAt,
    };
    existing.eventCount += 1;
    existing.reviewScore += eventScore;
    incrementFlagCounts(existing.flags, eventFlags);
    if (event.createdAt >= existing.latestReviewedAt) {
      existing.latestEventId = event.eventId;
      existing.latestReviewedAt = event.createdAt;
    }
    agents.set(agentId, existing);
  }
  return {
    eventCount: riskEvents.length,
    reviewScore,
    flags,
    agents: [...agents.values()]
      .sort((left, right) =>
        right.reviewScore - left.reviewScore
        || right.eventCount - left.eventCount
        || right.latestReviewedAt.localeCompare(left.latestReviewedAt)),
    latestEventId,
    latestReviewedAt,
  };
}

function latestRiskReviewSummary(projection: EpochProjection, sourceEventId: string): EpochAuditRiskReviewSummary | undefined {
  const reviewId = projection.riskReviewIdsBySourceEvent[sourceEventId]?.at(-1);
  const review = reviewId ? projection.riskReviews[reviewId] : undefined;
  if (!review) return undefined;
  return {
    reviewId: review.reviewId,
    sourceEventId: review.sourceEventId,
    resolution: review.resolution,
    reviewFlags: review.reviewFlags,
    reviewScore: review.reviewScore,
    reviewedAt: review.reviewedAt,
  };
}

function auditEventSummary(projection: EpochProjection, event: EpochProjection["events"][number]): EpochAuditEventSummary {
  const reviewFlags = auditReviewFlags(event);
  return {
    eventId: event.eventId,
    eventType: event.eventType,
    aggregateType: event.aggregateType,
    aggregateId: event.aggregateId,
    actorExplorerId: event.actorExplorerId,
    agentId: event.agentId,
    trustClass: event.trustClass,
    causationId: event.causationId,
    correlationId: event.correlationId,
    idempotencyKey: event.idempotencyKey,
    createdAt: event.createdAt,
    highImpact: isHighImpactEvent(event),
    reviewFlags,
    reviewScore: auditReviewScore(event, reviewFlags),
    riskReview: latestRiskReviewSummary(projection, event.eventId),
    payload: auditPayload(event.payload),
    publicPages: {
      audit: `/epoch/audit/${encodeURIComponent(event.eventId)}`,
    },
  };
}

export function auditView(
  projection: EpochProjection,
  input: { agentId?: string; eventType?: string; eventId?: string; aggregateId?: string; highImpactOnly?: boolean; riskOnly?: boolean; limit?: number },
): EpochAuditInfo {
  const limit = Math.max(1, Math.min(Number(input.limit || 50), 100));
  const selectedRawEvent = input.eventId
    ? projection.events.find((event) => event.eventId === input.eventId)
    : undefined;
  const highImpactOnly = input.highImpactOnly === true;
  const riskOnly = input.riskOnly === true;
  const filteredEvents = projection.events
    .filter((event) => !input.agentId || eventIsForAgent(event, input.agentId))
    .filter((event) => !input.eventType || event.eventType === input.eventType)
    .filter((event) => !input.aggregateId || event.aggregateId === input.aggregateId)
    .filter((event) => !highImpactOnly || isHighImpactEvent(event))
    .filter((event) => !riskOnly || eventNeedsRiskReview(event));
  const listedEvents = filteredEvents.slice(-limit).reverse().map((event) => auditEventSummary(projection, event));
  const selectedEvent = selectedRawEvent ? auditEventSummary(projection, selectedRawEvent) : undefined;
  const replayRawEvents = selectedRawEvent ? projection.events.filter((event) =>
    event.eventId === selectedRawEvent.eventId
    || event.correlationId === selectedRawEvent.correlationId
    || event.aggregateId === selectedRawEvent.aggregateId
    || (selectedRawEvent.agentId && eventIsForAgent(event, selectedRawEvent.agentId))) : filteredEvents;
  const replayEvents = replayRawEvents.slice(-limit);
  const riskProfileEvents = selectedRawEvent ? [selectedRawEvent] : filteredEvents;
  return {
    agentId: input.agentId,
    eventType: input.eventType,
    eventId: input.eventId,
    aggregateId: input.aggregateId,
    highImpactOnly,
    riskOnly,
    total: filteredEvents.length,
    events: selectedEvent ? [selectedEvent] : listedEvents,
    selectedEvent,
    riskProfile: auditRiskProfile(riskProfileEvents),
    replay: {
      eventIds: replayEvents.map((event) => event.eventId),
      aggregateIds: [...new Set(replayEvents.map((event) => event.aggregateId))],
      trustClasses: [...new Set(replayEvents.map((event) => event.trustClass))],
      highImpactEventTypes: [...new Set(replayEvents.filter(isHighImpactEvent).map((event) => event.eventType))],
    },
    publicPages: {
      index: "/epoch/audit",
      audit: input.eventId ? `/epoch/audit/${encodeURIComponent(input.eventId)}` : undefined,
    },
  };
}
