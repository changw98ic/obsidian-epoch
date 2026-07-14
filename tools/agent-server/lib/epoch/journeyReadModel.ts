import type { EpochJourney } from "./journeyRules.ts";
import type { JourneyPolicyPreview, JourneyPolicySelection } from "./journeyPolicyRules.ts";
import type { JourneySceneEpisode } from "./journeySceneRules.ts";

export type JourneyRuntimeEventType =
  | "journey_prepared"
  | "journey_started"
  | "journey_episode_recorded"
  | "journey_verification_linked"
  | "journey_status_changed"
  | "journey_return_delivered";

interface JourneyRuntimeEventBase {
  readonly eventId: string;
  readonly eventType: JourneyRuntimeEventType;
  readonly journeyId: string;
  readonly agentId: string;
  readonly explorerId: string;
  readonly occurredAt: string;
  readonly command?: {
    readonly scope: string;
    readonly ownerId?: string;
    readonly idempotencyKey: string;
    readonly subjectHash: string;
  };
}

export interface JourneySnapshotEvent extends JourneyRuntimeEventBase {
  readonly eventType: "journey_prepared" | "journey_started" | "journey_episode_recorded" | "journey_verification_linked" | "journey_status_changed";
  readonly journey: EpochJourney;
  readonly episode?: JourneySceneEpisode;
  readonly policySelection?: JourneyPolicySelection;
  readonly preview?: JourneyPolicyPreview;
}

export interface JourneyReturnDeliveredEvent extends JourneyRuntimeEventBase {
  readonly eventType: "journey_return_delivered";
  readonly deliveredAt: string;
}

export type JourneyRuntimeEvent = JourneySnapshotEvent | JourneyReturnDeliveredEvent;

export interface JourneyRuntimeRecord {
  readonly journey: EpochJourney;
  readonly policySelection: JourneyPolicySelection;
  readonly preview: JourneyPolicyPreview;
}

export interface JourneyProjection {
  readonly events: readonly JourneyRuntimeEvent[];
  readonly journeys: Readonly<Record<string, JourneyRuntimeRecord>>;
  readonly episodes: Readonly<Record<string, JourneySceneEpisode>>;
  readonly journeyIdsByAgent: Readonly<Record<string, readonly string[]>>;
  readonly deliveredReturnIds: ReadonlySet<string>;
}

export function emptyJourneyProjection(): JourneyProjection {
  return {
    events: [],
    journeys: {},
    episodes: {},
    journeyIdsByAgent: {},
    deliveredReturnIds: new Set(),
  };
}

export function applyJourneyRuntimeEvent(
  projection: JourneyProjection,
  event: JourneyRuntimeEvent,
): JourneyProjection {
  if (event.eventType === "journey_return_delivered") {
    const record = projection.journeys[event.journeyId];
    if (!record || record.journey.status !== "settled") throw new Error("journey_delivery_not_settled");
    if (projection.deliveredReturnIds.has(event.journeyId)) return projection;
    return {
      ...projection,
      events: [...projection.events, event],
      deliveredReturnIds: new Set([...projection.deliveredReturnIds, event.journeyId]),
    };
  }

  if (event.journey.journeyId !== event.journeyId
    || event.journey.agentId !== event.agentId
    || event.journey.explorerId !== event.explorerId) {
    throw new Error("journey_event_identity_mismatch");
  }
  const previous = projection.journeys[event.journeyId];
  if (!previous && event.eventType !== "journey_prepared") throw new Error("journey_event_prepare_required");
  if (previous && event.journey.version !== previous.journey.version + 1) {
    throw new Error("journey_event_version_gap");
  }
  const policySelection = event.policySelection ?? previous?.policySelection;
  const preview = event.preview ?? previous?.preview;
  if (!policySelection || !preview) throw new Error("journey_event_policy_required");
  if (event.eventType === "journey_episode_recorded") {
    if (!event.episode || !event.journey.episodeIds.includes(event.episode.episodeId)) {
      throw new Error("journey_event_episode_required");
    }
    if (projection.episodes[event.episode.episodeId]) throw new Error("journey_event_episode_duplicate");
  } else if (event.episode) {
    throw new Error("journey_event_episode_not_allowed");
  }
  const ids = projection.journeyIdsByAgent[event.agentId] ?? [];
  return {
    ...projection,
    events: [...projection.events, event],
    journeys: {
      ...projection.journeys,
      [event.journeyId]: { journey: event.journey, policySelection, preview },
    },
    episodes: event.episode ? {
      ...projection.episodes,
      [event.episode.episodeId]: event.episode,
    } : projection.episodes,
    journeyIdsByAgent: {
      ...projection.journeyIdsByAgent,
      [event.agentId]: ids.includes(event.journeyId) ? ids : [...ids, event.journeyId],
    },
  };
}

export function projectJourneyRuntimeEvents(events: readonly JourneyRuntimeEvent[]): JourneyProjection {
  return events.reduce(applyJourneyRuntimeEvent, emptyJourneyProjection());
}

export function journeyRecordsForAgent(projection: JourneyProjection, agentId: string) {
  return (projection.journeyIdsByAgent[agentId] ?? [])
    .map((journeyId) => projection.journeys[journeyId])
    .filter((record): record is JourneyRuntimeRecord => Boolean(record));
}
