import type { EpochEvent } from "./events.ts";
import type { JourneyProjection } from "./journeyReadModel.ts";
import type { EpochJourney } from "./journeyRules.ts";
import { journeyNarrativeText } from "./journeyNarrativeRules.ts";
import type { JourneySceneEpisode } from "./journeySceneRules.ts";

type JsonRecord = Record<string, unknown>;

export type AgentInteractionStatus = "open" | "accepted" | "declined" | "expired" | "settled";
export type AgentInteractionConsentMode = "informational" | "recipient_accept" | "mutual" | "server_adjudicated";

export interface AgentInteractionEnvelope {
  readonly interactionId: string;
  readonly kind: string;
  readonly proposerAgentId: string;
  readonly recipientAgentIds: readonly string[];
  readonly payloadRef: string;
  readonly status: AgentInteractionStatus;
  readonly consentMode: AgentInteractionConsentMode;
  readonly createdAtWorldTime: string;
  readonly expiresAtWorldTime?: string;
  readonly sourceEventIds: readonly string[];
  readonly sharedEpisode?: {
    readonly journeyId: string;
    readonly episodeId: string;
    readonly title: string;
    readonly narrative: string;
    readonly sourceEventIds: readonly string[];
    readonly verificationUrl?: string;
  };
}

export interface AgentInteractionInboxItem {
  readonly envelope: AgentInteractionEnvelope;
  readonly priority: number;
  readonly whyRelevant: string;
}

export interface AgentInteractionInboxSummary {
  readonly kind: string;
  readonly count: number;
  readonly sourceEventIds: readonly string[];
  readonly message: string;
}

export interface AgentInteractionInboxView {
  readonly total: number;
  readonly featured?: AgentInteractionInboxItem;
  readonly items: readonly AgentInteractionEnvelope[];
  readonly summaries: readonly AgentInteractionInboxSummary[];
  readonly suppressedByRateLimit: number;
}

export const AGENT_INTERACTION_INFORMATIONAL_TTL_MS = 30 * 24 * 60 * 60 * 1_000;
export const AGENT_INTERACTION_MAX_PER_PROPOSER = 20;
export const AGENT_INTERACTION_MAX_INBOX = 100;
export const AGENT_INTERACTION_MAX_PROJECTED_PER_RECIPIENT = 200;
export const AGENT_INTERACTION_MAX_TERMINAL_TOMBSTONES_PER_RECIPIENT = 200;
export const AGENT_INTERACTION_MAX_SOURCE_EVENT_IDS = 20;
const AGENT_INTERACTION_MAX_RECIPIENTS = 20;
const AGENT_INTERACTION_MAX_TITLE_LENGTH = 160;
const AGENT_INTERACTION_MAX_NARRATIVE_LENGTH = 2_000;

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).map((item) => item.trim())
    : [];
}

function unique(values: readonly string[]) {
  return [...new Set(values.filter(Boolean))];
}

function boundedUnique(values: readonly string[], limit = AGENT_INTERACTION_MAX_SOURCE_EVENT_IDS) {
  const valuesUnique = unique(values);
  if (valuesUnique.length <= limit) return valuesUnique;
  return [valuesUnique[0], ...valuesUnique.slice(-(limit - 1))];
}

function boundedText(value: string, limit: number) {
  return value.length <= limit ? value : value.slice(0, limit);
}

function interactionKind(eventType: string) {
  if (eventType.startsWith("diplomacy_")) return "commission";
  if (eventType.startsWith("direct_trade_")) return "gift_or_trade";
  if (eventType.startsWith("party_") || eventType.startsWith("bounty_")) return "commission";
  if (eventType === "message_posted") return "message";
  if (eventType === "relationship_updated") return "relationship_change";
  if (eventType.includes("news")) return "world_reference";
  return "shared_event";
}

function interactionStatus(eventType: string, payload: JsonRecord): AgentInteractionStatus {
  const status = text(payload.status) || text(payload.response);
  if (status === "accepted") return "accepted";
  if (status === "declined" || status === "rejected") return "declined";
  if (status === "expired") return "expired";
  if (status === "settled" || status === "completed" || eventType.endsWith("_accepted") || eventType.endsWith("_settled")) return "settled";
  return eventType.endsWith("_proposed") || eventType.endsWith("_created") || eventType.endsWith("_requested") ? "open" : "settled";
}

function consentMode(eventType: string): AgentInteractionConsentMode {
  if (eventType.startsWith("diplomacy_") || eventType.startsWith("direct_trade_") || eventType.startsWith("party_")) return "recipient_accept";
  if (eventType.startsWith("bounty_")) return "server_adjudicated";
  return "informational";
}

function eventRecipients(payload: JsonRecord, proposerAgentId: string) {
  const members = Array.isArray(payload.members)
    ? payload.members.map(record).map((member) => text(member.agentId)).filter((value): value is string => Boolean(value))
    : [];
  return unique([
    text(payload.targetAgentId) || "",
    text(payload.counterpartyAgentId) || "",
    text(payload.recipientAgentId) || "",
    ...strings(payload.recipientAgentIds),
    ...strings(payload.participantAgentIds),
    ...strings(payload.mentionedAgentIds),
    ...members,
  ]).filter((agentId) => agentId !== proposerAgentId).slice(0, AGENT_INTERACTION_MAX_RECIPIENTS);
}

function defaultExpiry(createdAt: string) {
  const createdAtMs = Date.parse(createdAt);
  return Number.isFinite(createdAtMs)
    ? new Date(createdAtMs + AGENT_INTERACTION_INFORMATIONAL_TTL_MS).toISOString()
    : undefined;
}

function envelopeForEpochEvent(event: EpochEvent, targetAgentId: string): AgentInteractionEnvelope | undefined {
  const payload = record(event.payload);
  const isDiplomacyResponse = event.eventType === "diplomacy_responded";
  const sourceAgentId = text(payload.sourceAgentId);
  const responderAgentId = event.agentId || text(payload.targetAgentId);
  const isResponseNotification = isDiplomacyResponse && targetAgentId === sourceAgentId;
  const proposerAgentId = isDiplomacyResponse
    ? isResponseNotification
      ? responderAgentId || "system"
      : sourceAgentId || "system"
    : text(payload.sourceAgentId)
      || text(payload.proposerAgentId)
      || text(payload.leaderAgentId)
      || event.agentId
      || "system";
  const recipientAgentIds = isDiplomacyResponse
    ? [targetAgentId]
    : eventRecipients(payload, proposerAgentId);
  if (!recipientAgentIds.includes(targetAgentId)) return undefined;
  const mode = isResponseNotification ? "informational" : consentMode(event.eventType);
  const explicitExpiry = text(payload.expiresAt);
  const expiresAtWorldTime = explicitExpiry && Number.isFinite(Date.parse(explicitExpiry))
    ? explicitExpiry
    : defaultExpiry(event.createdAt);
  return {
    interactionId: `interaction:${event.aggregateId}:${targetAgentId}`,
    kind: interactionKind(event.eventType),
    proposerAgentId,
    recipientAgentIds,
    payloadRef: `epoch:${event.aggregateType}:${event.aggregateId}`,
    status: interactionStatus(event.eventType, payload),
    consentMode: mode,
    createdAtWorldTime: event.createdAt,
    ...(expiresAtWorldTime ? { expiresAtWorldTime } : {}),
    sourceEventIds: boundedUnique([event.eventId]),
  };
}

function envelopeForJourneyEpisode(
  journey: EpochJourney,
  episode: JourneySceneEpisode,
  targetAgentId: string,
  createdAtWorldTime: string,
  verificationUrlPath?: string,
): AgentInteractionEnvelope | undefined {
  if (!episode.fingerprint.participantIds.includes(targetAgentId) || journey.agentId === targetAgentId) return undefined;
  const sourceEventIds = boundedUnique(episode.serverFacts?.sourceEventIds
    ?? episode.settlement?.canonicalEventIds
    ?? [episode.episodeId]);
  const fragment = episode.serverFacts?.verification.fragment
    ?? `episode-${encodeURIComponent(episode.episodeId)}`;
  return {
    interactionId: `interaction:${journey.journeyId}:${episode.episodeId}:${targetAgentId}`,
    kind: "encounter",
    proposerAgentId: journey.agentId,
    recipientAgentIds: [targetAgentId],
    payloadRef: `journey:${journey.journeyId}:episode:${episode.episodeId}`,
    status: "settled",
    consentMode: "informational",
    createdAtWorldTime,
    expiresAtWorldTime: defaultExpiry(createdAtWorldTime),
    sourceEventIds,
    ...(episode.narrative ? { sharedEpisode: {
      journeyId: journey.journeyId,
      episodeId: episode.episodeId,
      title: boundedText(episode.title, AGENT_INTERACTION_MAX_TITLE_LENGTH),
      narrative: boundedText(journeyNarrativeText(episode.narrative), AGENT_INTERACTION_MAX_NARRATIVE_LENGTH),
      sourceEventIds,
      ...(verificationUrlPath ? { verificationUrl: `${verificationUrlPath}#${fragment}` } : {}),
    } } : {}),
  };
}

function mergeEnvelope(previous: AgentInteractionEnvelope | undefined, next: AgentInteractionEnvelope) {
  if (!previous) return next;
  return {
    ...next,
    status: previous.status === "open" ? next.status : previous.status,
    createdAtWorldTime: previous.createdAtWorldTime,
    sourceEventIds: boundedUnique([...previous.sourceEventIds, ...next.sourceEventIds]),
  };
}

function priorityFor(envelope: AgentInteractionEnvelope, nowWorld: string, currentJourney?: EpochJourney) {
  let priority = 0;
  const expiresAt = envelope.expiresAtWorldTime ? Date.parse(envelope.expiresAtWorldTime) : Number.NaN;
  const now = Date.parse(nowWorld);
  if (Number.isFinite(expiresAt) && Number.isFinite(now)) {
    const remaining = expiresAt - now;
    if (remaining > 0 && remaining <= 24 * 60 * 60 * 1_000) priority += 100;
    else if (remaining <= 3 * 24 * 60 * 60 * 1_000) priority += 70;
  }
  if (envelope.status === "open") priority += 50;
  if (currentJourney && envelope.sourceEventIds.some((id) => id.includes(currentJourney.destinationRegionId))) priority += 40;
  if (envelope.kind === "commission" || envelope.kind === "gift_or_trade") priority += 25;
  if (envelope.kind === "relationship_change" || envelope.kind === "world_reference") priority += 15;
  return priority;
}

function relevanceReason(envelope: AgentInteractionEnvelope, priority: number) {
  if (envelope.status === "open" && envelope.expiresAtWorldTime) return "这是需要你决定且会到期的交互。";
  if (envelope.status === "open") return "这是等待你回应的交互。";
  if (envelope.kind === "encounter") return "另一名 Agent 的真实旅程把你记录为共同参与者。";
  if (envelope.kind === "world_reference") return "其他 Agent 或地区事件引用了你的经历。";
  return priority > 0 ? "这项共同世界事件直接涉及你的身份。" : "这项事件把你的身份列为参与者。";
}

function buildInboxFromEnvelopes(input: {
  readonly envelopes: readonly AgentInteractionEnvelope[];
  readonly explorerId: string;
  readonly nowWorld: string;
  readonly currentJourney?: EpochJourney;
  readonly ownerForAgent: (agentId: string) => string | undefined;
}): AgentInteractionInboxView {
  const now = Date.parse(input.nowWorld);
  const eligible = input.envelopes
    .filter((envelope) => {
      const proposerOwner = input.ownerForAgent(envelope.proposerAgentId);
      return envelope.proposerAgentId === "system" || Boolean(proposerOwner && proposerOwner !== input.explorerId);
    })
    .filter((envelope) => !envelope.expiresAtWorldTime
      || !Number.isFinite(now)
      || Date.parse(envelope.expiresAtWorldTime) > now)
    .map((envelope) => {
      const priority = priorityFor(envelope, input.nowWorld, input.currentJourney);
      return { envelope, priority, whyRelevant: relevanceReason(envelope, priority) };
    })
    .sort((left, right) => right.priority - left.priority
      || Date.parse(right.envelope.createdAtWorldTime) - Date.parse(left.envelope.createdAtWorldTime)
      || left.envelope.interactionId.localeCompare(right.envelope.interactionId));
  const proposerCounts = new Map<string, number>();
  const ranked: typeof eligible = [];
  const suppressed: typeof eligible = [];
  for (const item of eligible) {
    const count = proposerCounts.get(item.envelope.proposerAgentId) || 0;
    if (count >= AGENT_INTERACTION_MAX_PER_PROPOSER || ranked.length >= AGENT_INTERACTION_MAX_INBOX) {
      suppressed.push(item);
      continue;
    }
    proposerCounts.set(item.envelope.proposerAgentId, count + 1);
    ranked.push(item);
  }
  const featured = ranked[0];
  const grouped = new Map<string, AgentInteractionEnvelope[]>();
  for (const item of [...ranked.slice(featured ? 1 : 0), ...suppressed]) {
    const group = grouped.get(item.envelope.kind) || [];
    group.push(item.envelope);
    grouped.set(item.envelope.kind, group);
  }
  return {
    total: ranked.length,
    ...(featured ? { featured } : {}),
    items: featured ? [featured.envelope] : [],
    summaries: [...grouped.entries()].map(([kind, envelopes]) => ({
      kind,
      count: envelopes.length,
      sourceEventIds: boundedUnique(envelopes.flatMap((envelope) => envelope.sourceEventIds)),
      message: `${envelopes.length} 项较低优先级的${kind}交互已聚合，不会逐项打断对话。`,
    })),
    suppressedByRateLimit: suppressed.length,
  };
}

function retentionOrder(left: AgentInteractionEnvelope, right: AgentInteractionEnvelope) {
  const leftOpen = left.status === "open" ? 1 : 0;
  const rightOpen = right.status === "open" ? 1 : 0;
  return rightOpen - leftOpen
    || Date.parse(right.createdAtWorldTime) - Date.parse(left.createdAtWorldTime)
    || left.interactionId.localeCompare(right.interactionId);
}

interface AgentInteractionTerminalTombstone {
  readonly interactionId: string;
  readonly terminalSequence: number;
}

export function createDurableAgentInteractionProjection() {
  const byRecipient = new Map<string, Map<string, AgentInteractionEnvelope>>();
  const terminalByRecipient = new Map<string, Map<string, AgentInteractionTerminalTombstone>>();
  const terminalReplayFloorByRecipient = new Map<string, number>();
  let retentionWatermark = Number.NEGATIVE_INFINITY;

  const advanceRetentionWatermark = (values: readonly (string | undefined)[]) => {
    for (const value of values) {
      const parsed = value ? Date.parse(value) : Number.NaN;
      if (Number.isFinite(parsed)) retentionWatermark = Math.max(retentionWatermark, parsed);
    }
  };

  const rememberTerminal = (
    recipientAgentId: string,
    envelope: AgentInteractionEnvelope,
    terminalSequence: number,
  ) => {
    const tombstones = terminalByRecipient.get(recipientAgentId)
      ?? new Map<string, AgentInteractionTerminalTombstone>();
    const previousTerminalSequence = tombstones.get(envelope.interactionId)?.terminalSequence
      ?? Number.NEGATIVE_INFINITY;
    tombstones.set(envelope.interactionId, {
      interactionId: envelope.interactionId,
      terminalSequence: Math.max(previousTerminalSequence, terminalSequence),
    });
    if (tombstones.size > AGENT_INTERACTION_MAX_TERMINAL_TOMBSTONES_PER_RECIPIENT) {
      const ordered = [...tombstones.values()].sort((left, right) =>
        right.terminalSequence - left.terminalSequence
        || left.interactionId.localeCompare(right.interactionId));
      const retained = ordered.slice(0, AGENT_INTERACTION_MAX_TERMINAL_TOMBSTONES_PER_RECIPIENT);
      const evicted = ordered.slice(AGENT_INTERACTION_MAX_TERMINAL_TOMBSTONES_PER_RECIPIENT);
      let replayFloor = terminalReplayFloorByRecipient.get(recipientAgentId) ?? Number.NEGATIVE_INFINITY;
      for (const tombstone of evicted) {
        replayFloor = Math.max(replayFloor, tombstone.terminalSequence);
      }
      terminalReplayFloorByRecipient.set(recipientAgentId, replayFloor);
      tombstones.clear();
      for (const tombstone of retained) tombstones.set(tombstone.interactionId, tombstone);
    }
    terminalByRecipient.set(recipientAgentId, tombstones);
  };

  const store = (
    recipientAgentId: string,
    envelope: AgentInteractionEnvelope,
    sourceSequence?: number,
  ) => {
    if (envelope.status === "open") {
      const terminal = terminalByRecipient.get(recipientAgentId)?.has(envelope.interactionId);
      const replayFloor = terminalReplayFloorByRecipient.get(recipientAgentId);
      if (terminal || (typeof replayFloor === "number"
        && typeof sourceSequence === "number"
        && sourceSequence <= replayFloor)) return;
    }
    const existing = byRecipient.get(recipientAgentId) ?? new Map<string, AgentInteractionEnvelope>();
    const merged = mergeEnvelope(existing.get(envelope.interactionId), envelope);
    existing.set(envelope.interactionId, merged);
    if (merged.status !== "open"
      && merged.consentMode !== "informational"
      && typeof sourceSequence === "number") {
      rememberTerminal(recipientAgentId, merged, sourceSequence);
    }
    for (const [interactionId, retained] of existing) {
      const expiresAt = retained.expiresAtWorldTime ? Date.parse(retained.expiresAtWorldTime) : Number.NaN;
      if (retained.status === "open" && Number.isFinite(expiresAt) && expiresAt <= retentionWatermark) {
        existing.delete(interactionId);
      }
    }
    if (existing.size > AGENT_INTERACTION_MAX_PROJECTED_PER_RECIPIENT) {
      const retained = [...existing.values()]
        .sort(retentionOrder)
        .slice(0, AGENT_INTERACTION_MAX_PROJECTED_PER_RECIPIENT);
      existing.clear();
      for (const item of retained) existing.set(item.interactionId, item);
    }
    byRecipient.set(recipientAgentId, existing);
  };

  const update = (input: {
    readonly epochEvents: readonly EpochEvent[];
    readonly epochEventOffset: number;
    readonly journeyProjection: JourneyProjection;
    readonly changedJourneyIds?: readonly string[];
  }) => {
    if (!Number.isSafeInteger(input.epochEventOffset) || input.epochEventOffset < 0) {
      throw new Error("agent_interaction_epoch_event_offset_invalid");
    }
    const journeyIds = input.changedJourneyIds
      ? unique(input.changedJourneyIds)
      : Object.keys(input.journeyProjection.journeys);
    advanceRetentionWatermark([
      ...input.epochEvents.map((event) => event.createdAt),
      ...journeyIds.flatMap((journeyId) => {
        const journey = input.journeyProjection.journeys[journeyId]?.journey;
        return journey ? [journey.settledAtWorldTime, journey.startedAtWorldTime] : [];
      }),
    ]);
    for (const [eventIndex, event] of input.epochEvents.entries()) {
      const sourceSequence = input.epochEventOffset + eventIndex;
      const payload = record(event.payload);
      const proposerAgentId = event.eventType === "diplomacy_responded"
        ? event.agentId || text(payload.targetAgentId) || "system"
        : text(payload.sourceAgentId)
          || text(payload.proposerAgentId)
          || text(payload.leaderAgentId)
          || event.agentId
          || "system";
      const recipientAgentIds = event.eventType === "diplomacy_responded"
        ? boundedUnique([
            text(payload.targetAgentId) || event.agentId || "",
            text(payload.sourceAgentId) || "",
          ], AGENT_INTERACTION_MAX_RECIPIENTS)
        : eventRecipients(payload, proposerAgentId);
      for (const recipientAgentId of recipientAgentIds) {
        const envelope = envelopeForEpochEvent(event, recipientAgentId);
        if (envelope) store(recipientAgentId, envelope, sourceSequence);
      }
    }

    for (const journeyId of journeyIds) {
      const journey = input.journeyProjection.journeys[journeyId]?.journey;
      if (!journey || journey.status !== "settled") continue;
      const createdAtWorldTime = journey.settledAtWorldTime || journey.startedAtWorldTime;
      if (!createdAtWorldTime) continue;
      for (const episodeId of journey.episodeIds) {
        const episode = input.journeyProjection.episodes[episodeId];
        if (!episode) continue;
        for (const recipientAgentId of episode.fingerprint.participantIds) {
          const envelope = envelopeForJourneyEpisode(
            journey,
            episode,
            recipientAgentId,
            createdAtWorldTime,
            journey.verification?.urlPath,
          );
          if (envelope) store(recipientAgentId, envelope);
        }
      }
    }
  };

  const envelopesForRecipient = (agentId: string) => [...(byRecipient.get(agentId)?.values() ?? [])]
    .sort(retentionOrder);

  return {
    update,
    envelopesForRecipient,
    countForRecipient: (agentId: string) => byRecipient.get(agentId)?.size ?? 0,
    inbox: (input: {
      readonly agentId: string;
      readonly explorerId: string;
      readonly nowWorld: string;
      readonly currentJourney?: EpochJourney;
      readonly ownerForAgent: (agentId: string) => string | undefined;
    }) => buildInboxFromEnvelopes({
      envelopes: envelopesForRecipient(input.agentId),
      explorerId: input.explorerId,
      nowWorld: input.nowWorld,
      currentJourney: input.currentJourney,
      ownerForAgent: input.ownerForAgent,
    }),
  };
}

export function buildAgentInteractionInbox(input: {
  readonly agentId: string;
  readonly explorerId: string;
  readonly nowWorld: string;
  readonly currentJourney?: EpochJourney;
  readonly journeyProjection: JourneyProjection;
  readonly epochEvents: readonly EpochEvent[];
  readonly ownerForAgent: (agentId: string) => string | undefined;
}): AgentInteractionInboxView {
  const projection = createDurableAgentInteractionProjection();
  projection.update({
    epochEvents: input.epochEvents,
    epochEventOffset: 0,
    journeyProjection: input.journeyProjection,
  });
  return projection.inbox(input);
}
