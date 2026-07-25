import type { EpochJourney } from "./journeyRules.ts";
import type { JourneyPolicyPreview, JourneyPolicySelection } from "./journeyPolicyRules.ts";
import type { JourneySceneEpisode } from "./journeySceneRules.ts";
import {
  deriveJourneyHiddenTask,
  normalizeJourneyHiddenTaskSeal,
  type JourneyHiddenTaskSeal,
} from "./journeyGeneratedTaskRules.ts";
import type { MirrorConsequenceLedgerEntry } from "./journeySettlementRules.ts";
import {
  appendMirrorConsequence,
  discardAllMirrorConsequences,
  emptyMirrorConsequenceLedger,
  markMirrorConsequencePromoted,
  type MirrorConsequenceLedgerState,
} from "./journeyMirrorLedger.ts";

export type JourneyRuntimeEventType =
  | "journey_prepared"
  | "journey_world_window_reserved"
  | "journey_task_plan_installed"
  | "journey_started"
  | "journey_episode_recorded"
  | "journey_world_commit_recorded"
  | "journey_verification_linked"
  | "journey_status_changed"
  | "journey_return_delivered"
  | "journey_mirror_consequence_recorded"
  | "journey_mirror_consequence_promoted"
  | "journey_mirror_consequence_discarded";

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
  readonly eventType: "journey_prepared" | "journey_world_window_reserved" | "journey_task_plan_installed" | "journey_started" | "journey_episode_recorded" | "journey_world_commit_recorded" | "journey_verification_linked" | "journey_status_changed" | "journey_mirror_consequence_recorded" | "journey_mirror_consequence_promoted" | "journey_mirror_consequence_discarded";
  readonly journey: EpochJourney;
  readonly episode?: JourneySceneEpisode;
  readonly policySelection?: JourneyPolicySelection;
  readonly preview?: JourneyPolicyPreview;
  /** Server-only; present only on journey_task_plan_installed. */
  readonly hiddenTaskSeal?: JourneyHiddenTaskSeal;
  /** Present only on journey_mirror_consequence_recorded. */
  readonly mirrorConsequenceEntries?: readonly MirrorConsequenceLedgerEntry[];
  /** Present only on journey_mirror_consequence_promoted. */
  readonly mirrorConsequencePromotions?: readonly {
    readonly entryId: string;
    readonly canonicalEventId: string;
  }[];
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
  /** Server-only seal material, scoped to the runtime projection and journey. */
  readonly hiddenTaskSeals: Readonly<Record<string, JourneyHiddenTaskSeal>>;
  /**
   * PR2 mirror-consequence ledgers, scoped by journeyId. Append/promote/discard
   * transitions flow through {@link applyJourneyRuntimeEvent} so the projection
   * is the single in-memory truth for mirror collateral.
   */
  readonly mirrorLedgers: Readonly<Record<string, MirrorConsequenceLedgerState>>;
}

export function emptyJourneyProjection(): JourneyProjection {
  return {
    events: [],
    journeys: {},
    episodes: {},
    journeyIdsByAgent: {},
    deliveredReturnIds: new Set(),
    hiddenTaskSeals: {},
    mirrorLedgers: {},
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
  let hiddenTaskSeals = projection.hiddenTaskSeals;
  if (event.eventType === "journey_task_plan_installed") {
    if (!event.journey.taskPlan) throw new Error("journey_event_task_plan_required");
    if (event.hiddenTaskSeal) {
      const normalized = normalizeJourneyHiddenTaskSeal(event.journey.taskPlan, event.hiddenTaskSeal);
      hiddenTaskSeals = { ...hiddenTaskSeals, [event.journeyId]: normalized };
    } else {
      // Legacy task-plan events used a directly enumerable commitment. New
      // sealed plans fail closed when their installation seal is absent.
      deriveJourneyHiddenTask(event.journey.taskPlan);
    }
  } else if (event.hiddenTaskSeal) {
    throw new Error("journey_event_hidden_task_seal_not_allowed");
  }
  const ids = projection.journeyIdsByAgent[event.agentId] ?? [];
  const baseProjection = {
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
    hiddenTaskSeals,
  };

  if (event.eventType === "journey_mirror_consequence_recorded") {
    const entries = event.mirrorConsequenceEntries ?? [];
    const current = baseProjection.mirrorLedgers[event.journeyId]
      ?? emptyMirrorConsequenceLedger(event.journeyId);
    let nextLedger = current;
    for (const entry of entries) {
      nextLedger = appendMirrorConsequence(nextLedger, entry);
    }
    return {
      ...baseProjection,
      mirrorLedgers: {
        ...baseProjection.mirrorLedgers,
        [event.journeyId]: nextLedger,
      },
    };
  }
  if (event.eventType === "journey_mirror_consequence_promoted") {
    const promotions = event.mirrorConsequencePromotions ?? [];
    const current = baseProjection.mirrorLedgers[event.journeyId]
      ?? emptyMirrorConsequenceLedger(event.journeyId);
    let nextLedger = current;
    for (const promotion of promotions) {
      nextLedger = markMirrorConsequencePromoted(
        nextLedger,
        promotion.entryId,
        promotion.canonicalEventId,
      );
    }
    return {
      ...baseProjection,
      mirrorLedgers: {
        ...baseProjection.mirrorLedgers,
        [event.journeyId]: nextLedger,
      },
    };
  }
  if (event.eventType === "journey_mirror_consequence_discarded") {
    const current = baseProjection.mirrorLedgers[event.journeyId]
      ?? emptyMirrorConsequenceLedger(event.journeyId);
    const nextLedger = discardAllMirrorConsequences(current);
    return {
      ...baseProjection,
      mirrorLedgers: {
        ...baseProjection.mirrorLedgers,
        [event.journeyId]: nextLedger,
      },
    };
  }
  return baseProjection;
}

export function projectJourneyRuntimeEvents(events: readonly JourneyRuntimeEvent[]): JourneyProjection {
  return events.reduce(applyJourneyRuntimeEvent, emptyJourneyProjection());
}

export function journeyRecordsForAgent(projection: JourneyProjection, agentId: string) {
  return (projection.journeyIdsByAgent[agentId] ?? [])
    .map((journeyId) => projection.journeys[journeyId])
    .filter((record): record is JourneyRuntimeRecord => Boolean(record));
}

/**
 * PR3 zero-bonus scrubber. Returns a copy of `journey` with every
 * strategy/bonus marker stripped from both the top-level record and the
 * embedded `taskRequest`. Internal paths (settlement, persistence, server
 * logs) keep the full record; this function is applied only at the public
 * projection edge — when a journey crosses into MCP result pages,
 * `agent_console`, or the transparency stream.
 *
 * Stripped fields:
 *   - journey.questOfferId, journey.offerHash, journey.marketSnapshotVersion
 *   - journey.taskRequest.taskFamilyId
 *   - journey.taskRequest.questOfferId
 *   - journey.taskRequest.offerHash
 *   - journey.taskRequest.expectedApproach
 *   - journey.taskRequest.marketSnapshotVersion
 *
 * The full {@link EpochJourney} type is preserved so existing callers can
 * spread the result; only the internal fields become `undefined`. The
 * hidden task seal material is server-only and never appears on the journey
 * record, so it is not touched here.
 */
export function scrubJourneyForPublicView<T extends EpochJourney>(journey: T): EpochJourney {
  const { questOfferId: _q, offerHash: _o, marketSnapshotVersion: _m, taskRequest, ...rest } = journey;
  if (taskRequest === undefined) return rest;
  const {
    taskFamilyId: _tf,
    questOfferId: _tq,
    offerHash: _to,
    expectedApproach: _ea,
    marketSnapshotVersion: _tmv,
    ...publicTaskRequest
  } = taskRequest;
  return { ...rest, taskRequest: publicTaskRequest };
}

/**
 * PR3 zero-bonus scrubber for a {@link JourneyRuntimeRecord}. Returns a copy
 * with `journey` replaced by its scrubbed projection. `policySelection` and
 * `preview` are already public-shaped and need no scrubbing.
 */
export function scrubJourneyRecordForPublicView(record: JourneyRuntimeRecord): JourneyRuntimeRecord {
  return { ...record, journey: scrubJourneyForPublicView(record.journey) };
}
