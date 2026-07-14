import { projectEpochEvents, type EpochProjection } from "./gameCore.ts";
import type { EpochEvent } from "./events.ts";
import { progressView } from "./progressReadModel.ts";
import {
  resultPageFocusHostedSession,
  resultPageFocusTurnCard,
  resultPageRegionId,
  resultPageRegionalContext,
} from "./resultPageContextRules.ts";
import { resultPageNextActions } from "./resultPageNavigationRules.ts";
import { resultPageReceipt } from "./resultPageReceiptRules.ts";
import {
  focusedResultPageProgress,
  resultPagePayloadAgentId,
  resultPagePublicPages,
  resultPagePublicSafeSummary,
  stableResultPageJson,
} from "./resultPageRuntimeRules.ts";
import { buildEpochResultPageRunSummary } from "./resultRunSummary.ts";
import type { EpochResultPageJourney, EpochResultPagePayload } from "./runtime.ts";
import { revalidatePersistedJourneyNarrative } from "./journeyNarrativeRules.ts";
import { sha256Hex } from "./runtimeAuth.ts";

type AnyRecord = Readonly<Record<string, unknown>>;

export interface BuildEpochResultPagePayloadInput {
  readonly projection: EpochProjection;
  readonly input?: AnyRecord;
  readonly generatedAt: string;
  readonly maxDowntimeSeconds?: number;
}

function resultPageJourney(value: unknown): EpochResultPageJourney | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const source = value as Record<string, unknown>;
  const required = (entry: unknown, max = 200) => typeof entry === "string" && entry.trim() ? entry.trim().slice(0, max) : undefined;
  const journeyId = required(source.journeyId);
  const correlationId = required(source.correlationId);
  const status = required(source.status, 80);
  const objective = required(source.objective, 240);
  const regionId = required(source.regionId);
  if (!journeyId || !correlationId || !status || !objective || !regionId) return undefined;
  const episodes = Array.isArray(source.episodes) ? source.episodes.slice(0, 7).map((value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("result_page_journey_episode_invalid");
    const episode = value as Record<string, unknown>;
    const episodeId = required(episode.episodeId);
    const title = required(episode.title, 240);
    const outcomeKey = required(episode.outcomeKey, 120);
    if (!episodeId || !title || !outcomeKey) throw new Error("result_page_journey_episode_invalid");
    const participants = Array.isArray(episode.participants) ? episode.participants.slice(0, 12).flatMap((participantValue) => {
      if (!participantValue || typeof participantValue !== "object" || Array.isArray(participantValue)) return [];
      const participant = participantValue as Record<string, unknown>;
      const id = required(participant.id);
      const type = required(participant.type, 80);
      const label = required(participant.label, 160);
      return id && type && label ? [{ id, type, label }] : [];
    }) : [];
    const sourceEventIds = Array.isArray(episode.sourceEventIds)
      ? episode.sourceEventIds.filter((id): id is string => typeof id === "string" && Boolean(id.trim())).slice(0, 30)
      : [];
    const grounded = revalidatePersistedJourneyNarrative({
      serverFacts: episode.serverFacts,
      narrative: episode.narrative,
    });
    if (!grounded
      || grounded.serverFacts.journeyId !== journeyId
      || grounded.serverFacts.episodeId !== episodeId
      || !grounded.serverFacts.sourceEventIds.every((eventId) => sourceEventIds.includes(eventId))) {
      throw new Error("result_page_journey_grounding_invalid");
    }
    return {
      episodeId,
      title,
      outcomeKey,
      participants,
      sourceEventIds,
      ...grounded,
    };
  }) : [];
  const canonicalEventIds = Array.isArray(source.canonicalEventIds)
    ? source.canonicalEventIds.filter((id): id is string => typeof id === "string" && Boolean(id.trim())).slice(0, 30)
    : [];
  const delta = source.stateDelta && typeof source.stateDelta === "object" && !Array.isArray(source.stateDelta)
    ? source.stateDelta as Record<string, unknown>
    : undefined;
  const reward = delta?.reward && typeof delta.reward === "object" && !Array.isArray(delta.reward)
    ? delta.reward as Record<string, unknown>
    : undefined;
  const publicReward = reward ? {
    ...(required(reward.resourceId, 120) ? { resourceId: required(reward.resourceId, 120) } : {}),
    ...(typeof reward.amount === "number" && Number.isFinite(reward.amount)
      ? { amount: reward.amount }
      : {}),
  } : undefined;
  const groundedEventIds = [...new Set(episodes.flatMap((episode) => episode.serverFacts.sourceEventIds))];
  if (["settled", "completed"].includes(status)
    && (episodes.length !== 3 || !sameIds(canonicalEventIds, groundedEventIds))) {
    throw new Error("result_page_journey_grounding_invalid");
  }
  return {
    journeyId,
    correlationId,
    status,
    objective,
    regionId,
    ...(required(source.startedAtWorldTime) ? { startedAtWorldTime: required(source.startedAtWorldTime) } : {}),
    ...(required(source.dueAtWorldTime) ? { dueAtWorldTime: required(source.dueAtWorldTime) } : {}),
    episodes,
    canonicalEventIds,
    ...(delta ? { stateDelta: {
      ...(required(delta.outcomeSummary, 400) ? { outcomeSummary: required(delta.outcomeSummary, 400) } : {}),
      ...(publicReward && Object.keys(publicReward).length > 0 ? { reward: publicReward } : {}),
    } } : {}),
  };
}

function sameIds(left: readonly string[], right: readonly string[]) {
  return left.length === right.length && new Set(left).size === left.length
    && left.every((id) => right.includes(id));
}

export function assertEpochResultPagePayload(
  payload: EpochResultPagePayload,
  canonicalEpochEvents: readonly EpochEvent[],
) {
  const { receipt, ...body } = payload;
  const referencedEventIds = [
    ...receipt.canonicalEvents.map((event) => event.eventId),
    ...payload.progress.latestEvents.map((event) => event.eventId),
  ];
  let receiptEventBoundary = -1;
  for (const eventId of referencedEventIds) {
    const eventIndex = canonicalEpochEvents.findIndex((event) => event.eventId === eventId);
    if (eventIndex < 0 || canonicalEpochEvents[eventIndex]!.createdAt > payload.generatedAt) {
      throw new Error("result_page_receipt_invalid");
    }
    receiptEventBoundary = Math.max(receiptEventBoundary, eventIndex);
  }
  for (const event of payload.progress.latestEvents) {
    const canonicalEvent = canonicalEpochEvents.find((candidate) => candidate.eventId === event.eventId);
    if (!canonicalEvent || stableResultPageJson(canonicalEvent) !== stableResultPageJson(event)) {
      throw new Error("result_page_receipt_invalid");
    }
  }
  const expectedReceipt = resultPageReceipt(
    projectEpochEvents(canonicalEpochEvents.slice(0, receiptEventBoundary + 1)),
    body,
  );
  if (receipt.receiptType !== "server_result_receipt"
    || receipt.generatedAt !== payload.generatedAt
    || receipt.payloadHash !== `sha256:${sha256Hex(stableResultPageJson(body))}`
    || stableResultPageJson(receipt) !== stableResultPageJson(expectedReceipt)) {
    throw new Error("result_page_receipt_invalid");
  }
  if (!payload.journey) return;
  const journey = resultPageJourney(payload.journey);
  if (!journey) throw new Error("result_page_journey_grounding_invalid");
  const eventsById = new Map(canonicalEpochEvents.map((event) => [event.eventId, event]));
  const agentId = resultPagePayloadAgentId(payload);
  for (const eventId of journey.canonicalEventIds) {
    const event = eventsById.get(eventId);
    if (!event
      || event.eventType !== "hosted_action_recorded"
      || event.correlationId !== journey.correlationId
      || (agentId && event.agentId !== agentId)) {
      throw new Error("result_page_journey_provenance_invalid");
    }
    const episode = journey.episodes.find((candidate) => candidate.serverFacts?.sourceEventIds.includes(eventId));
    const session = canonicalEpochEvents.find((candidate) => candidate.eventType === "hosted_session_started"
      && candidate.correlationId === journey.correlationId
      && (!agentId || candidate.agentId === agentId)
      && candidate.payload.sessionId === event.payload.sessionId
      && candidate.payload.sceneContract?.journeyId === journey.journeyId
      && candidate.payload.sceneContract.episodeId === episode?.episodeId);
    if (!episode || !session) throw new Error("result_page_journey_provenance_invalid");
  }
}

export function buildEpochResultPagePayload(options: BuildEpochResultPagePayloadInput): EpochResultPagePayload {
  const input = options.input || {};
  const focusTurnCard = resultPageFocusTurnCard(options.projection, input);
  const focusHostedSession = resultPageFocusHostedSession(options.projection, input);
  if (focusTurnCard && focusHostedSession) throw new Error("result_page_focus_conflict");

  const agentId = typeof input.agentId === "string" && input.agentId.trim()
    ? input.agentId.trim()
    : focusTurnCard?.agentId || focusHostedSession?.agentId;
  const explorerId = typeof input.explorerId === "string" && input.explorerId.trim()
    ? input.explorerId.trim()
    : focusTurnCard?.explorerId || focusHostedSession?.explorerId;
  const progress = focusedResultPageProgress(progressView(options.projection, {
    agentId,
    explorerId,
    limit: Number(input.limit || 30),
    now: options.generatedAt,
    maxDowntimeSeconds: options.maxDowntimeSeconds,
  }), input);
  const regionId = resultPageRegionId({
    input,
    progress,
    focusTurnCard,
    focusHostedSession,
  });
  const regionalContext = resultPageRegionalContext(options.projection, regionId);
  const journey = resultPageJourney(input.journeyVerification);
  if (input.journeyVerification !== undefined && !journey) {
    throw new Error("result_page_journey_grounding_invalid");
  }
  const payload: Omit<EpochResultPagePayload, "receipt"> = {
    pageType: "agent_result",
    generatedAt: options.generatedAt,
    publicSafeSummary: resultPagePublicSafeSummary({
      progress,
      regionId,
      focusTurnCard,
      focusHostedSession,
    }),
    progress,
    runSummary: buildEpochResultPageRunSummary(input, {
      generatedAt: options.generatedAt,
      progress,
      focusTurnCard,
      focusHostedSession,
    }),
    publicPages: resultPagePublicPages(progress),
    nextActions: resultPageNextActions({ progress, regionId, regionalContext }),
    ...(regionalContext ? { regionalContext } : {}),
    ...(focusTurnCard ? { focusTurnCard } : {}),
    ...(focusHostedSession ? { focusHostedSession } : {}),
    ...(journey ? { journey } : {}),
  };
  return {
    ...payload,
    receipt: resultPageReceipt(options.projection, payload),
  };
}
