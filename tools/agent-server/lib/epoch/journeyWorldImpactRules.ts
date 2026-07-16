import type { EpochEvent } from "./events.ts";
import type { EpochEventFactory } from "./eventFactory.ts";
import type { JourneyTaskEffectKind } from "./journeyTaskCatalog.ts";
import type { JourneyTaskObjectiveKind } from "./journeyGeneratedTaskRules.ts";
import type { JourneyActionResolution } from "./journeyActionResolutionRules.ts";
import type { EpochIdFactory } from "./protocol.ts";
import {
  regionInfluenceChangedEvent,
  traceCreatedEvent,
} from "./regionEventLedgerEvents.ts";

export interface PlanJourneyWorldImpactEventsInput {
  readonly makeEvent: EpochEventFactory;
  readonly idFactory: EpochIdFactory;
  readonly regionId: string;
  readonly agentId: string;
  readonly explorerId: string;
  readonly identityName: string;
  readonly journeyId: string;
  readonly episodeId: string;
  readonly objectiveId: string;
  readonly objectiveKind: JourneyTaskObjectiveKind;
  readonly objectiveTitle: string;
  readonly actionLabel: string;
  readonly actionRisk: "low" | "medium" | "high";
  readonly allowedEffectKinds: readonly JourneyTaskEffectKind[];
  readonly resolution: JourneyActionResolution;
  readonly previousInfluenceScore: number;
  readonly previousFactionStandingScore?: number;
  readonly routeSelection?: {
    readonly routeId: string;
    readonly factionObjectId?: string;
  };
  readonly sourceEventId: string;
  readonly sourceAggregateId: string;
  readonly recordedAt: string;
  readonly worldMinute: number;
}

export interface JourneyWorldImpactPreview {
  readonly influenceDelta: number;
  readonly reason: string;
  readonly title: string;
  readonly summary: string;
}

function boundedInfluenceDelta(input: PlanJourneyWorldImpactEventsInput) {
  const objectiveWeight = input.objectiveKind === "main" ? 2 : 1;
  const riskWeight = input.actionRisk === "high" ? 1 : 0;
  const exceptionalWeight = input.resolution.outcome === "exceptional_success" ? 1 : 0;
  const substantiveEffects = new Set(input.allowedEffectKinds.filter((kind) => kind !== "journey_progress")).size;
  return Math.max(1, Math.min(5, objectiveWeight + riskWeight + exceptionalWeight + Math.min(1, substantiveEffects)));
}

export function journeyWorldImpactPreview(
  input: PlanJourneyWorldImpactEventsInput,
): JourneyWorldImpactPreview | undefined {
  if (input.resolution.completionKind !== "complete") return undefined;
  const influenceDelta = boundedInfluenceDelta(input);
  return {
    influenceDelta,
    reason: `journey_objective:${input.journeyId}:${input.objectiveId}:${input.resolution.outcome}`,
    title: `旅程留下影响：${input.objectiveTitle}`,
    summary: `${input.identityName}完成了“${input.actionLabel}”；服务器将“${input.objectiveTitle}”记为已完成，并在当地留下 +${influenceDelta} 地区影响。`,
  };
}

/**
 * Converts only a server-settled successful objective into shared-world state.
 * Client/model effect prose is never interpreted as authority.
 */
export function planJourneyWorldImpactEvents(
  input: PlanJourneyWorldImpactEventsInput,
): readonly EpochEvent[] {
  const impact = journeyWorldImpactPreview(input);
  if (!impact) return [];
  const influenceId = input.idFactory(
    "region_influence",
    `${input.regionId}:${input.agentId}:${input.journeyId}:${input.objectiveId}:${input.sourceEventId}`,
  );
  const traceId = input.idFactory(
    "trace",
    `${input.regionId}:${input.journeyId}:${input.episodeId}:${input.sourceEventId}`,
  );
  const regionEvents: EpochEvent[] = [
    regionInfluenceChangedEvent(input.makeEvent, input.regionId, {
      influenceId,
      regionId: input.regionId,
      agentId: input.agentId,
      explorerId: input.explorerId,
      influenceDelta: impact.influenceDelta,
      influenceScoreAfter: input.previousInfluenceScore + impact.influenceDelta,
      reason: impact.reason,
      sourceEventId: input.sourceEventId,
      sourceEventType: "hosted_action_recorded",
      sourceAggregateId: input.sourceAggregateId,
      changedAt: input.recordedAt,
      worldMinute: Math.max(0, Math.floor(input.worldMinute)),
    }, input.agentId),
    traceCreatedEvent(input.makeEvent, traceId, {
      traceId,
      regionId: input.regionId,
      title: impact.title,
      summary: impact.summary,
      sourceEventType: "hosted_action_recorded",
      sourceEventIds: [input.sourceEventId],
      sourceAggregateId: input.sourceAggregateId,
      relatedInfluenceIds: [influenceId],
      participantAgentIds: [input.agentId],
      participantExplorerIds: [input.explorerId],
      createdAt: input.recordedAt,
    }, input.agentId),
  ];
  const factionId = input.objectiveKind === "choice"
    ? input.routeSelection?.factionObjectId
    : undefined;
  if (!factionId || !input.routeSelection) return regionEvents;
  const standingBefore = Math.max(-10_000, Math.min(10_000,
    Math.floor(input.previousFactionStandingScore ?? 0)));
  const requestedDelta = input.resolution.outcome === "exceptional_success" ? 150 : 100;
  const standingAfter = Math.min(10_000, standingBefore + requestedDelta);
  const standingDelta = standingAfter - standingBefore;
  if (standingDelta <= 0) return regionEvents;
  const standingId = input.idFactory(
    "faction_standing",
    `${input.agentId}:${factionId}`,
  );
  return [
    ...regionEvents,
    input.makeEvent("agent_faction_standing_changed", standingId, {
      standingId,
      agentId: input.agentId,
      explorerId: input.explorerId,
      factionId,
      standingDelta,
      standingAfter,
      journeyId: input.journeyId,
      episodeId: input.episodeId,
      objectiveId: input.objectiveId,
      routeId: input.routeSelection.routeId,
      sourceEventId: input.sourceEventId,
      changedAt: input.recordedAt,
      worldMinute: Math.max(0, Math.floor(input.worldMinute)),
    }, {
      aggregateType: "agent_identity",
      agentId: input.agentId,
    }),
  ];
}
