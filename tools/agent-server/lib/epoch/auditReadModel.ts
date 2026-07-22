import { type EpochEvent } from "./events.ts";
import { type EpochProjection, type EpochRiskReview } from "./gameCore.ts";
import { type EpochEventType, type EpochTrustClass } from "./protocol.ts";
import {
  extractJourneyRunReceiptEventIds,
  validateJourneyRunReceipt,
  type JourneyRunReceipt,
} from "./journeyRunReceiptRules.ts";

type AnyRecord = Record<string, unknown>;

type JourneyAuditLifecycleStage = "start" | "propose" | "commit" | "settled";
type JourneyAuditSourceType = "canonical_event" | "validated_result_receipt" | "legacy_mission_audit";

export interface EpochTenRunJourneyAuditEventLink {
  readonly eventId: string;
  readonly eventType: string;
  readonly stage?: JourneyAuditLifecycleStage;
  readonly sourceType: JourneyAuditSourceType;
}

export interface EpochTenRunJourneyAuditReceiptLink {
  readonly receiptId: string;
  readonly runId: string;
  readonly journeyId: string;
  readonly sourceType: "validated_result_receipt";
  readonly eventIds: readonly string[];
  readonly matchedEventIds: readonly string[];
}

export interface EpochTenRunJourneyAuditExclusion {
  readonly sourceType: JourneyAuditSourceType | "model_narrative" | "unknown";
  readonly reason: string;
  readonly runId?: string;
  readonly journeyId?: string;
  readonly eventId?: string;
  readonly eventType?: string;
  readonly receiptId?: string;
}

export interface EpochTenRunJourneyAuditEntry {
  readonly runId: string;
  readonly journeyId: string;
  readonly sourceTypes: readonly JourneyAuditSourceType[];
  readonly mirrorMode: boolean;
  readonly completed: true;
  readonly completionBasis: "canonical_settled_event" | "validated_result_receipt";
  readonly startedAt?: string;
  readonly settledAt?: string;
  readonly receipt?: EpochTenRunJourneyAuditReceiptLink;
  readonly events: readonly EpochTenRunJourneyAuditEventLink[];
  readonly excluded: readonly EpochTenRunJourneyAuditExclusion[];
}

export interface EpochTenRunJourneyAudit {
  readonly ok: boolean;
  readonly available: number;
  readonly required: 10;
  readonly runs: readonly EpochTenRunJourneyAuditEntry[];
  readonly sourceTypes: readonly JourneyAuditSourceType[];
  readonly receiptEventLinks: readonly EpochTenRunJourneyAuditReceiptLink[];
  readonly excluded: readonly EpochTenRunJourneyAuditExclusion[];
  readonly reason?: string;
}

type JourneyAuditRunAccumulator = {
  runId: string;
  journeyId: string;
  sourceTypes: Set<JourneyAuditSourceType>;
  mirrorMode: boolean;
  settledEvent?: EpochProjection["events"][number];
  receipt?: EpochTenRunJourneyAuditReceiptLink;
  events: EpochTenRunJourneyAuditEventLink[];
  excluded: EpochTenRunJourneyAuditExclusion[];
  startedAt?: string;
  settledAt?: string;
};

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

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function booleanValue(value: unknown): boolean {
  return value === true || value === "true";
}

function lowerText(...values: readonly unknown[]): string {
  return values
    .map((value) => typeof value === "string" ? value : "")
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function uniqueStrings(values: readonly string[]): readonly string[] {
  return [...new Set(values.filter((value) => value.trim()))];
}

function canonicalJourneyStage(event: EpochProjection["events"][number]): JourneyAuditLifecycleStage | undefined {
  const payload = recordValue(event.payload);
  const actionText = lowerText(
    event.eventType,
    payload.eventType,
    payload.action,
    payload.actionType,
    payload.command,
    payload.kind,
    payload.phase,
    payload.status,
    payload.lifecycle,
  );
  const journeyText = lowerText(event.eventType, payload.journeyId, payload.runId, payload.mode, payload.playMode);
  const isJourney = journeyText.includes("journey") || actionText.includes("journey");
  if (!isJourney) return undefined;
  if (actionText.includes("start_journey") || actionText.includes("journey_started") || actionText.includes("journey_start")) return "start";
  if (actionText.includes("propose") || actionText.includes("proposed") || actionText.includes("proposal")) return "propose";
  if (actionText.includes("commit") || actionText.includes("committed")) return "commit";
  if (actionText.includes("settled") || actionText.includes("settlement") || actionText.includes("solidified")) return "settled";
  return undefined;
}

function journeyIdFromRecord(record: AnyRecord): string | undefined {
  return stringValue(record.journeyId)
    || stringValue(record.journey_id)
    || stringValue(record.missionJourneyId)
    || stringValue(record.contextJourneyId);
}

function runIdFromRecord(record: AnyRecord): string | undefined {
  return stringValue(record.runId)
    || stringValue(record.run_id)
    || stringValue(record.partyRunId)
    || stringValue(record.missionRunId);
}

function journeyEventIdentity(event: EpochProjection["events"][number]) {
  const payload = recordValue(event.payload);
  const journeyId = journeyIdFromRecord(payload)
    || (lowerText(event.aggregateType).includes("journey") ? event.aggregateId : undefined)
    || stringValue(payload.missionId);
  const runId = runIdFromRecord(payload)
    || (lowerText(event.aggregateType).includes("run") ? event.aggregateId : undefined)
    || journeyId;
  return { journeyId, runId };
}

function mirrorModeFromRecord(record: AnyRecord): boolean {
  const mode = lowerText(record.mode, record.playMode, record.runMode, record.journeyMode);
  return mode.includes("mirror") || booleanValue(record.mirrorMode) || booleanValue(record.isMirror);
}

function findJourneyRunReceipt(value: unknown, depth = 0): JourneyRunReceipt | undefined {
  if (depth > 5 || !value || typeof value !== "object") return undefined;
  if (Array.isArray(value)) {
    for (const item of value) {
      const nested = findJourneyRunReceipt(item, depth + 1);
      if (nested) return nested;
    }
    return undefined;
  }
  const record = value as AnyRecord;
  if (record.receiptType === "journey_run_receipt" && validateJourneyRunReceipt(record).ok) {
    return record as unknown as JourneyRunReceipt;
  }
  for (const nested of Object.values(record)) {
    const receipt = findJourneyRunReceipt(nested, depth + 1);
    if (receipt) return receipt;
  }
  return undefined;
}

function exclusionForNonCanonicalEvent(event: EpochProjection["events"][number]): EpochTenRunJourneyAuditExclusion | undefined {
  const payload = recordValue(event.payload);
  const text = lowerText(event.eventType, payload.kind, payload.type, payload.source, payload.summary, payload.narrative);
  if (text.includes("fake") || text.includes("mock") || text.includes("fixture")) {
    return {
      sourceType: "legacy_mission_audit",
      reason: "legacy_fake_run_not_completion_basis",
      eventId: event.eventId,
      eventType: event.eventType,
      runId: runIdFromRecord(payload),
      journeyId: journeyIdFromRecord(payload),
    };
  }
  if (text.includes("narrative") || text.includes("model")) {
    return {
      sourceType: "model_narrative",
      reason: "model_narrative_not_completion_basis",
      eventId: event.eventId,
      eventType: event.eventType,
      runId: runIdFromRecord(payload),
      journeyId: journeyIdFromRecord(payload),
    };
  }
  if (lowerText(event.eventType, payload.missionId).includes("mission")) {
    return {
      sourceType: "legacy_mission_audit",
      reason: "legacy_mission_audit_retained_but_not_completion_basis",
      eventId: event.eventId,
      eventType: event.eventType,
      runId: runIdFromRecord(payload),
      journeyId: journeyIdFromRecord(payload) || stringValue(payload.missionId),
    };
  }
  return undefined;
}

export function epochTenRunJourneyAudit(projection: EpochProjection): EpochTenRunJourneyAudit {
  const required = 10 as const;
  const byRun = new Map<string, JourneyAuditRunAccumulator>();
  const receiptEventLinks: EpochTenRunJourneyAuditReceiptLink[] = [];
  const excluded: EpochTenRunJourneyAuditExclusion[] = [];
  const canonicalEventIds = new Set(projection.events.map((event) => event.eventId));

  function entryFor(runId: string, journeyId: string) {
    const existing = byRun.get(runId);
    if (existing) return existing;
    const created: JourneyAuditRunAccumulator = {
      runId,
      journeyId,
      sourceTypes: new Set<JourneyAuditSourceType>(),
      mirrorMode: false,
      events: [],
      excluded: [],
    };
    byRun.set(runId, created);
    return created;
  }

  for (const event of projection.events) {
    const payload = recordValue(event.payload);
    const receipt = findJourneyRunReceipt(payload);
    if (receipt) {
      const eventIds = extractJourneyRunReceiptEventIds(receipt);
      const link: EpochTenRunJourneyAuditReceiptLink = {
        receiptId: receipt.receiptId,
        runId: receipt.runId,
        journeyId: receipt.journeyId,
        sourceType: "validated_result_receipt",
        eventIds,
        matchedEventIds: eventIds.filter((eventId) => canonicalEventIds.has(eventId)),
      };
      const entry = entryFor(receipt.runId, receipt.journeyId);
      entry.sourceTypes.add("validated_result_receipt");
      entry.receipt = link;
      entry.mirrorMode = entry.mirrorMode || mirrorModeFromRecord(payload) || mirrorModeFromRecord(receipt as unknown as AnyRecord);
      entry.settledAt = entry.settledAt || receipt.generatedAt || event.createdAt;
      receiptEventLinks.push(link);
    } else {
      const nestedReceipt = recordValue(payload.receipt);
      if (lowerText(payload.receiptType, nestedReceipt.receiptType).includes("receipt")) {
        const badReceiptId = stringValue(payload.receiptId) || stringValue(nestedReceipt.receiptId);
        excluded.push({
        sourceType: "unknown",
        reason: "result_receipt_failed_validation",
        eventId: event.eventId,
        eventType: event.eventType,
        receiptId: badReceiptId,
        });
      }
    }

    const stage = canonicalJourneyStage(event);
    const identity = journeyEventIdentity(event);
    if (stage && identity.runId && identity.journeyId) {
      const entry = entryFor(identity.runId, identity.journeyId);
      entry.sourceTypes.add("canonical_event");
      entry.mirrorMode = entry.mirrorMode || mirrorModeFromRecord(payload);
      entry.events.push({
        eventId: event.eventId,
        eventType: event.eventType,
        stage,
        sourceType: "canonical_event",
      });
      if (stage === "start") entry.startedAt = entry.startedAt || event.createdAt;
      if (stage === "settled") {
        entry.settledEvent = event;
        entry.settledAt = entry.settledAt || event.createdAt;
      }
      continue;
    }

    const nonCanonical = exclusionForNonCanonicalEvent(event);
    if (nonCanonical) excluded.push(nonCanonical);
  }

  const completed = [...byRun.values()]
    .map((entry) => {
      if (!entry.settledEvent && !entry.receipt) {
        entry.excluded.push({
          sourceType: entry.sourceTypes.has("canonical_event") ? "canonical_event" : "unknown",
          reason: "journey_started_or_committed_without_settlement",
          runId: entry.runId,
          journeyId: entry.journeyId,
        });
        return undefined;
      }
      return {
        runId: entry.runId,
        journeyId: entry.journeyId,
        sourceTypes: [...entry.sourceTypes],
        mirrorMode: entry.mirrorMode,
        completed: true,
        completionBasis: entry.receipt ? "validated_result_receipt" : "canonical_settled_event",
        startedAt: entry.startedAt,
        settledAt: entry.settledAt,
        receipt: entry.receipt,
        events: entry.events,
        excluded: entry.excluded,
      } satisfies EpochTenRunJourneyAuditEntry;
    })
    .filter((entry): entry is EpochTenRunJourneyAuditEntry => Boolean(entry))
    .sort((left, right) => (right.settledAt || "").localeCompare(left.settledAt || ""))
    .slice(0, required);

  const allExcluded = [
    ...excluded,
    ...[...byRun.values()].flatMap((entry) => entry.excluded),
  ];
  const sourceTypes = uniqueStrings(completed.flatMap((entry) => entry.sourceTypes)) as readonly JourneyAuditSourceType[];
  return {
    ok: completed.length === required,
    available: completed.length,
    required,
    runs: completed,
    sourceTypes,
    receiptEventLinks,
    excluded: allExcluded,
    reason: completed.length === required ? undefined : "ten_run_audit_requires_exactly_ten_settled_journeys",
  };
}

export const phase6TenRunJourneyAudit = epochTenRunJourneyAudit;
export const tenRunJourneyAudit = epochTenRunJourneyAudit;

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
