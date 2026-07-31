import type { EpochEvent } from "./events.ts";
import type { JourneyTaskEvidenceEpisode } from "./journeyGeneratedTaskRules.ts";
import {
  applySelfLossDedupRules,
} from "./journeyConsequenceScoring.ts";
import type {
  SelfLossContribution,
  SelfLossSourceKind,
} from "./journeySettlementRules.ts";

type JourneyActionResolution = NonNullable<
  NonNullable<
    NonNullable<JourneyTaskEvidenceEpisode["serverFacts"]>["storyBeat"]
  >["selectedAction"]["resolution"]
>;

export interface JourneySettlementActionResolution {
  readonly actionEventId: string;
  readonly resultKind: string;
  readonly succeeded: boolean;
}

export interface JourneySettlementActionEvidence {
  readonly actionResolutions: readonly JourneySettlementActionResolution[];
  readonly canonicalActionEventIds: readonly string[];
  readonly selfLossContributions: readonly SelfLossContribution[];
  readonly selfLossSourceEventsByKind: Readonly<Record<SelfLossSourceKind, readonly string[]>>;
}

function hostedActionForResolution(
  resolution: JourneyActionResolution,
  canonicalEvents: readonly EpochEvent[],
): Extract<EpochEvent, { readonly eventType: "hosted_action_recorded" }> | undefined {
  return canonicalEvents.find((event): event is Extract<EpochEvent, { readonly eventType: "hosted_action_recorded" }> => (
    event.eventType === "hosted_action_recorded"
    && event.payload.journeyResolution !== undefined
    && (
      event.payload.journeyResolution.decisionKeyId === resolution.decisionKeyId
      || event.payload.journeyResolution.inputHash === resolution.inputHash
    )
  ));
}

function linkedToHostedAction(
  event: EpochEvent,
  actionEventId: string,
  hostedAction: Extract<EpochEvent, { readonly eventType: "hosted_action_recorded" }>,
  fallbackMatches: boolean,
): boolean {
  if (event.eventType === "resource_spent" && event.payload.sourceEventId === actionEventId) return true;
  if (event.eventType === "lifetime_adjusted" && event.payload.sourceEventId === actionEventId) return true;
  if (event.causationId === actionEventId) return true;
  return Boolean(
    fallbackMatches
    && hostedAction.correlationId
    && event.correlationId === hostedAction.correlationId,
  );
}

function sourceEventIdsByKind(
  contributions: readonly SelfLossContribution[],
): Readonly<Record<SelfLossSourceKind, readonly string[]>> {
  const grouped: Record<SelfLossSourceKind, string[]> = {
    resource_cost: [],
    resource_spent_event: [],
    hosted_action_lifetime_delta: [],
    lifetime_adjusted_event: [],
  };
  for (const contribution of contributions) {
    for (const eventId of contribution.canonicalEventIds) {
      if (!grouped[contribution.sourceKind].includes(eventId)) {
        grouped[contribution.sourceKind].push(eventId);
      }
    }
  }
  return grouped;
}

/**
 * Build the settlement-side action evidence from signed hosted actions and
 * the canonical event stream. The contribution order is deliberate: the
 * signed action resolution wins over its resource/lifetime projection event,
 * and the hosted-action payload wins over the later lifetime event. The
 * shared dedup rule then enforces one source per action and cost kind.
 */
export function buildJourneySettlementActionEvidence(input: {
  readonly episodes: readonly JourneyTaskEvidenceEpisode[];
  readonly canonicalEvents: readonly EpochEvent[];
}): JourneySettlementActionEvidence {
  const contributions: SelfLossContribution[] = [];
  const actionResolutions: JourneySettlementActionResolution[] = [];
  const canonicalActionEventIds: string[] = [];
  const seenActionIds = new Set<string>();

  for (const episode of input.episodes) {
    const resolution = episode.serverFacts?.storyBeat?.selectedAction.resolution;
    if (!resolution) continue;
    const hostedAction = hostedActionForResolution(resolution, input.canonicalEvents);
    const actionEventId = hostedAction?.eventId ?? resolution.decisionKeyId;
    if (!seenActionIds.has(actionEventId)) {
      seenActionIds.add(actionEventId);
      actionResolutions.push({
        actionEventId,
        resultKind: resolution.outcome,
        succeeded: resolution.completionKind === "complete",
      });
      if (hostedAction) canonicalActionEventIds.push(hostedAction.eventId);
    }

    const actionCanonicalEventIds = hostedAction
      ? [hostedAction.eventId]
      : [resolution.inputHash];
    if (resolution.resourceCost?.paid) {
      contributions.push({
        actionEventId,
        costKind: "resource",
        sourceKind: "resource_cost",
        canonicalEventIds: actionCanonicalEventIds,
        resourceUnits: resolution.resourceCost.amount,
      });
    }
    if (hostedAction && typeof hostedAction.payload.lifetimeDelta === "number"
      && Number.isFinite(hostedAction.payload.lifetimeDelta)
      && hostedAction.payload.lifetimeDelta !== 0) {
      contributions.push({
        actionEventId,
        costKind: "lifetime",
        sourceKind: "hosted_action_lifetime_delta",
        canonicalEventIds: [hostedAction.eventId],
        lifetimeDelta: hostedAction.payload.lifetimeDelta,
      });
    }

    const resourceEvents = input.canonicalEvents.filter((event): event is Extract<EpochEvent, { readonly eventType: "resource_spent" }> => (
      event.eventType === "resource_spent"
      && hostedAction?.agentId !== undefined
      && event.agentId === hostedAction.agentId
      && linkedToHostedAction(
        event,
        actionEventId,
        hostedAction,
        event.payload.reason.startsWith("journey_action_cost:"),
      )
      && Number.isFinite(event.payload.amount)
      && event.payload.amount > 0
    ));
    for (const event of resourceEvents) {
      contributions.push({
        actionEventId,
        costKind: "resource",
        sourceKind: "resource_spent_event",
        canonicalEventIds: [event.eventId],
        resourceUnits: event.payload.amount,
      });
    }

    const lifetimeEvents = input.canonicalEvents.filter((event): event is Extract<EpochEvent, { readonly eventType: "lifetime_adjusted" }> => (
      event.eventType === "lifetime_adjusted"
      && hostedAction?.agentId !== undefined
      && event.agentId === hostedAction.agentId
      && linkedToHostedAction(
        event,
        actionEventId,
        hostedAction,
        event.payload.reason === "hosted_action_risk",
      )
      && Number.isFinite(event.payload.delta)
      && event.payload.delta !== 0
    ));
    for (const event of lifetimeEvents) {
      contributions.push({
        actionEventId,
        costKind: "lifetime",
        sourceKind: "lifetime_adjusted_event",
        canonicalEventIds: [event.eventId],
        lifetimeDelta: event.payload.delta,
      });
    }
  }

  const selfLossContributions = applySelfLossDedupRules(contributions);
  return {
    actionResolutions,
    canonicalActionEventIds,
    selfLossContributions,
    selfLossSourceEventsByKind: sourceEventIdsByKind(selfLossContributions),
  };
}
