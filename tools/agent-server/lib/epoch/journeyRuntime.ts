import { createHash } from "node:crypto";

import {
  activeJourneyForAgent,
  installJourneyTaskPlan,
  linkJourneyVerification,
  prepareJourney,
  recordJourneyWorldCommit,
  recordJourneyEpisode,
  recallJourney,
  startJourney,
  transitionJourney,
  type EpochJourney,
  type JourneyMirrorWindow,
  type JourneyWorldSlice,
  type JourneyWorldCommit,
} from "./journeyRules.ts";
import {
  buildJourneyPolicyPreview,
  normalizeJourneyMandate,
  normalizeJourneyPolicySelection,
  type JourneyPolicySelection,
} from "./journeyPolicyRules.ts";
import { revalidatePersistedJourneyNarrative } from "./journeyNarrativeRules.ts";
import type { EpochEvent } from "./events.ts";
import type { MirrorConsequenceLedgerEntry } from "./journeySettlementRules.ts";
import {
  generateJourneySceneEpisodes,
  generateTaskPlanJourneySceneEpisodes,
  generateThreePhaseJourneySceneEpisodes,
  type JourneySceneGenerationInput,
  type JourneySceneEpisode,
  type JourneyScenePlan,
} from "./journeySceneRules.ts";
import {
  nextJourneyTaskObjective,
  normalizeJourneyHiddenTaskSeal,
  type JourneyGeneratedTaskPlan,
  type JourneyHiddenTaskSeal,
  type JourneyTaskPlanInstallation,
} from "./journeyGeneratedTaskRules.ts";
import type { InternalQuestOffer } from "./journeyOfferRules.ts";
import {
  applyJourneyRuntimeEvent,
  journeyRecordsForAgent,
  projectJourneyRuntimeEvents,
  type JourneyProjection,
  type JourneyRuntimeEvent,
  type JourneyRuntimeRecord,
} from "./journeyReadModel.ts";
import {
  epochWorldMinuteFromTime,
  epochWorldTimeFromMinute,
} from "./worldCalendar.ts";

type UnknownRecord = Readonly<Record<string, unknown>>;

export interface JourneyRuntimeOptions {
  readonly idFactory: (kind: "journey" | "event") => string;
  readonly nowReal?: () => string;
  readonly nowWorld?: () => string;
  readonly initialEvents?: readonly JourneyRuntimeEvent[];
  readonly appendEvents?: (events: readonly JourneyRuntimeEvent[]) => void;
  readonly canonicalEpochEvents?: () => readonly EpochEvent[];
  readonly worldSliceForWindow?: (input: {
    readonly regionId: string;
    readonly startedAtWorldTime: string;
    readonly endedAtWorldTime: string;
  }) => JourneyWorldSlice | undefined;
  readonly defaultRealDurationMs?: number;
  readonly defaultWorldDurationMs?: number;
  readonly pollIntervalMs?: number;
}

export interface PrepareJourneyRuntimeInput {
  readonly agentId: string;
  readonly explorerId: string;
  readonly originRegionId: string;
  readonly destinationRegionId: string;
  readonly taskType?: string;
  readonly mandate?: unknown;
  readonly policy?: unknown;
  readonly expectedReturn?: string;
  /**
   * PR3. Quest-offer id echoing the public snapshot the client read from.
   * Presence switches the journey into offer-driven mode. The resolved
   * {@link InternalQuestOffer} MUST be supplied via {@link questOffer}; the
   * runtime never performs async IO itself, so the caller is responsible for
   * running `claimQuestOffer` + `getInternalOffer` upstream and passing the
   * result in. INTERNAL-only — never crosses the public boundary.
   */
  readonly questOfferId?: string;
  /**
   * PR3. Pre-resolved internal offer. When present together with
   * {@link questOfferId}, the runtime derives taskRequest from
   * `questOffer.publicView` and stamps {@link EpochJourney.questOfferId} /
   * {@link EpochJourney.offerHash} / {@link EpochJourney.marketSnapshotVersion}
   * onto the journey. Caller-supplied `destinationRegionId` / `taskType`
   * MUST equal the offer's `region.regionId` / `taskTypeText` else the
   * runtime throws `offer_region_mismatch` / `offer_task_type_mismatch`.
   */
  readonly questOffer?: InternalQuestOffer;
  /** PR3. Echo of the offer hash the client read; rejected on mismatch. */
  readonly offerHash?: `sha256:${string}`;
  /** PR3. Market snapshot version the offer was read under. */
  readonly marketSnapshotVersion?: number;
}

export interface InstallJourneyTaskPlanRuntimeInput {
  readonly journeyId: string;
  readonly expectedVersion: number;
  /**
   * PR3. Full source-binding installation. The runtime delegates the
   * tuple-lock assertion to {@link installJourneyTaskPlan} and writes any
   * absent source-binding fields onto the journey. The legacy
   * `taskPlan` + `hiddenTaskSeal` shorthand remains supported for non-offer
   * journeys via {@link taskPlanLegacy} / {@link hiddenTaskSealLegacy}.
   */
  readonly installation?: JourneyTaskPlanInstallation;
  /** Legacy shorthand for non-offer journeys; mutually exclusive with `installation`. */
  readonly taskPlan?: JourneyGeneratedTaskPlan;
  /** Legacy shorthand; required when `taskPlan` is used. */
  readonly hiddenTaskSeal?: JourneyHiddenTaskSeal;
}

export interface StartJourneyRuntimeInput {
  readonly journeyId: string;
  readonly expectedVersion: number;
  readonly realDurationMs?: number;
  readonly worldDurationMs?: number;
}

export interface ReserveJourneyMirrorWindowRuntimeInput {
  readonly journeyId: string;
  readonly expectedVersion: number;
}

export interface JourneyTickResult {
  readonly events: readonly JourneyRuntimeEvent[];
  readonly settledJourneyIds: readonly string[];
}

export interface LinkJourneyVerificationRuntimeInput {
  readonly journeyId: string;
  readonly expectedVersion: number;
  readonly pageId: string;
  readonly urlPath: string;
  readonly createdAt: string;
}

export interface RecordJourneyWorldCommitRuntimeInput {
  readonly journeyId: string;
  readonly expectedVersion: number;
  readonly worldCommit: JourneyWorldCommit;
}

export type JourneyEpisodeContext = Omit<JourneySceneGenerationInput, "mandate">;

function requiredText(value: unknown, field: string) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`journey_${field}_required`);
  return value.trim();
}

function boundedDuration(value: number | undefined, fallback: number, field: string) {
  const duration = value ?? fallback;
  if (!Number.isSafeInteger(duration) || duration < 1_000 || duration > 7 * 24 * 60 * 60 * 1_000) {
    throw new Error(`journey_${field}_invalid`);
  }
  return duration;
}

function plusMilliseconds(iso: string, duration: number) {
  const time = Date.parse(iso);
  if (!Number.isFinite(time)) throw new Error("journey_clock_invalid");
  return new Date(time + duration).toISOString();
}

function earlierIso(left: string, right: string) {
  return Date.parse(left) <= Date.parse(right) ? left : right;
}

const MIRROR_TIME_SLOT_MS = 15 * 60 * 1_000;
const MIRROR_TIME_SLOT_WORLD_MINUTES = 15;
const MIRROR_START_SLOT_COUNT = 24 * 4;
const MIRROR_MIN_DURATION_SLOTS = 3;
const MIRROR_MAX_DURATION_SLOTS = 12 * 4;

function deterministicSlot(seed: string, slotCount: number) {
  const digest = createHash("sha256").update(seed).digest();
  return digest.readUInt32BE(0) % slotCount;
}

function legacyMirrorTimeWindow(journey: EpochJourney, canonicalNowWorld: string) {
  const startOffsetSlots = deterministicSlot(
    `${journey.journeyId}:${journey.destinationRegionId}:${canonicalNowWorld}:mirror-start.v1`,
    MIRROR_START_SLOT_COUNT,
  );
  const durationSlots = MIRROR_MIN_DURATION_SLOTS + deterministicSlot(
    `${journey.journeyId}:${journey.taskRequest?.taskType ?? journey.mandate.objective}:mirror-duration.v1`,
    MIRROR_MAX_DURATION_SLOTS - MIRROR_MIN_DURATION_SLOTS + 1,
  );
  const startedAtWorldTime = plusMilliseconds(canonicalNowWorld, startOffsetSlots * MIRROR_TIME_SLOT_MS);
  return {
    startedAtWorldTime,
    dueAtWorldTime: plusMilliseconds(startedAtWorldTime, durationSlots * MIRROR_TIME_SLOT_MS),
  };
}

function historicalMirrorTimeWindow(journey: EpochJourney, canonicalNowWorld: string) {
  const canonicalWorldMinute = epochWorldMinuteFromTime(canonicalNowWorld);
  const availableSlots = Math.floor(canonicalWorldMinute / MIRROR_TIME_SLOT_WORLD_MINUTES);
  if (availableSlots < MIRROR_MIN_DURATION_SLOTS) {
    throw new Error("journey_mirror_history_not_ready");
  }
  const maximumDurationSlots = Math.min(MIRROR_MAX_DURATION_SLOTS, availableSlots);
  const durationSlots = MIRROR_MIN_DURATION_SLOTS + deterministicSlot(
    `${journey.journeyId}:${journey.taskRequest?.taskType ?? journey.mandate.objective}:mirror-duration.v2`,
    maximumDurationSlots - MIRROR_MIN_DURATION_SLOTS + 1,
  );
  const possibleEndSlots = availableSlots - durationSlots + 1;
  const endSlot = durationSlots + deterministicSlot(
    `${journey.journeyId}:${journey.destinationRegionId}:${canonicalNowWorld}:mirror-end.v2`,
    possibleEndSlots,
  );
  return {
    startedAtWorldTime: epochWorldTimeFromMinute(
      (endSlot - durationSlots) * MIRROR_TIME_SLOT_WORLD_MINUTES,
    ),
    dueAtWorldTime: epochWorldTimeFromMinute(endSlot * MIRROR_TIME_SLOT_WORLD_MINUTES),
  };
}

function serverMirrorWindow(
  journey: EpochJourney,
  canonicalNowWorld: string,
  startExpectedVersion: number,
): JourneyMirrorWindow {
  const selected = historicalMirrorTimeWindow(journey, canonicalNowWorld);
  return {
    version: 1,
    authority: "server_world_clock",
    selection: "deterministic_random_history",
    regionId: journey.destinationRegionId,
    startExpectedVersion,
    startedAtWorldTime: selected.startedAtWorldTime,
    endedAtWorldTime: selected.dueAtWorldTime,
  };
}

function sameIds(left: readonly string[], right: readonly string[]) {
  return left.length === right.length && new Set(left).size === left.length
    && left.every((id) => right.includes(id));
}

function isGroundedJourneyEpisode(
  journey: EpochJourney,
  episode: JourneySceneEpisode,
  canonicalEpochEvents?: () => readonly EpochEvent[],
) {
  const validated = revalidatePersistedJourneyNarrative({
    serverFacts: episode.serverFacts,
    narrative: episode.narrative,
  });
  if (!validated || validated.serverFacts.journeyId !== journey.journeyId
    || validated.serverFacts.episodeId !== episode.episodeId) return false;
  const canonicalEventIds = episode.settlement?.canonicalEventIds ?? [];
  const internallyGrounded = validated.serverFacts.confirmedFacts.length > 0
    && validated.serverFacts.stateChanges.length > 0
    && validated.serverFacts.sourceEventIds.length > 0
    && sameIds(canonicalEventIds, validated.serverFacts.sourceEventIds)
    && canonicalEventIds.every((eventId) => episode.sourceFactIds.includes(eventId));
  if (!internallyGrounded || !canonicalEpochEvents) return false;
  const epochEvents = canonicalEpochEvents();
  const epochEventsById = new Map(epochEvents.map((event) => [event.eventId, event]));
  const beat = validated.serverFacts.storyBeat;
  if (!beat) return false;
  const canonicalEvents = canonicalEventIds
    .map((eventId) => epochEventsById.get(eventId))
    .filter((event): event is EpochEvent => Boolean(event));
  if (canonicalEvents.length !== canonicalEventIds.length
    || canonicalEvents.some((event) => event.correlationId !== journey.correlationId)) return false;
  const hostedEvents = canonicalEvents.filter((event): event is Extract<EpochEvent, { readonly eventType: "hosted_action_recorded" }> =>
    event.eventType === "hosted_action_recorded");
  if (hostedEvents.length !== 1) return false;
  const event = hostedEvents[0];
  if (event.agentId !== journey.agentId) return false;
  const influenceEvents = canonicalEvents.filter((candidate): candidate is Extract<EpochEvent, { readonly eventType: "region_influence_changed" }> =>
    candidate.eventType === "region_influence_changed");
  const traceEvents = canonicalEvents.filter((candidate): candidate is Extract<EpochEvent, { readonly eventType: "trace_created" }> =>
    candidate.eventType === "trace_created");
  const factionStandingEvents = canonicalEvents.filter((candidate): candidate is Extract<EpochEvent, { readonly eventType: "agent_faction_standing_changed" }> =>
    candidate.eventType === "agent_faction_standing_changed");
  if (canonicalEvents.some((candidate) => ![
    "hosted_action_recorded",
    "agent_faction_standing_changed",
    "region_influence_changed",
    "trace_created",
  ].includes(candidate.eventType))) return false;
  if (influenceEvents.some((candidate) =>
    candidate.agentId !== journey.agentId
    || candidate.payload.agentId !== journey.agentId
    || candidate.payload.sourceEventId !== event.eventId
    || candidate.payload.sourceEventType !== "hosted_action_recorded")) return false;
  const influenceIds = new Set(influenceEvents.map((candidate) => candidate.payload.influenceId));
  if (traceEvents.some((candidate) =>
    candidate.agentId !== journey.agentId
    || !candidate.payload.participantAgentIds.includes(journey.agentId)
    || !candidate.payload.sourceEventIds.includes(event.eventId)
    || candidate.payload.relatedInfluenceIds.some((influenceId) => !influenceIds.has(influenceId)))) return false;
  if ((influenceEvents.length === 0) !== (traceEvents.length === 0)) return false;
  if (factionStandingEvents.length > 1 || factionStandingEvents.some((candidate) =>
    candidate.agentId !== journey.agentId
    || candidate.payload.agentId !== journey.agentId
    || candidate.payload.journeyId !== journey.journeyId
    || candidate.payload.episodeId !== episode.episodeId
    || candidate.payload.sourceEventId !== event.eventId
    || candidate.payload.standingDelta <= 0)) return false;
  const started = epochEvents.find((candidate) => candidate.eventType === "hosted_session_started"
      && candidate.correlationId === journey.correlationId
      && candidate.agentId === journey.agentId
      && candidate.payload.sessionId === event.payload.sessionId
      && candidate.payload.sceneContract?.journeyId === journey.journeyId
      && candidate.payload.sceneContract.episodeId === episode.episodeId);
  const signedAction = started?.eventType === "hosted_session_started"
    ? started.payload.sceneContract?.actionOptions?.find((action) =>
        action.actionOptionId === event.payload.actionOptionId)
    : undefined;
  const legacyUnsignedAction = started?.eventType === "hosted_session_started"
    && started.payload.sceneContract?.actionOptions === undefined
    && event.payload.actionOptionId === undefined
    && event.payload.optionLabel === undefined
    && event.payload.outcomeSummary === undefined
    && event.payload.journeyResolution === undefined
    && episode.generatedTaskObjective === undefined;
  if (legacyUnsignedAction) {
    return influenceEvents.length === 0
      && traceEvents.length === 0
      && factionStandingEvents.length === 0
      && beat.selectedAction.taskObjectiveId === undefined
      && beat.selectedAction.completionKind === undefined;
  }
  if (!signedAction
    || event.payload.optionLabel !== beat.selectedAction.label
    || event.payload.outcomeSummary !== beat.outcomeSummary
    || signedAction.optionKey !== beat.selectedAction.optionKey
    || signedAction.label !== beat.selectedAction.label
    || !sameIds(signedAction.targetEntityIds, beat.selectedAction.targetEntityIds ?? [])) return false;
  if (episode.generatedTaskObjective) {
    const objectiveId = episode.generatedTaskObjective.objectiveId;
    const resolution = event.payload.journeyResolution;
    const completionKind = resolution?.completionKind ?? signedAction.completionKind;
    if (!completionKind
      || (resolution && (resolution.authority !== "server" || resolution.summary !== event.payload.outcomeSummary))
      || (signedAction.completionKind === "skip" && completionKind !== "skip")
      || (!resolution && signedAction.completionKind !== completionKind)) return false;
    if (beat.selectedAction.resolution !== undefined
      && JSON.stringify(beat.selectedAction.resolution) !== JSON.stringify(resolution)) return false;
    const mirrorMode = journey.worldMode === "mirror";
    if (mirrorMode && (influenceEvents.length || traceEvents.length || factionStandingEvents.length)) return false;
    if (!mirrorMode && completionKind === "complete" && influenceEvents.length !== 1) return false;
    if (!mirrorMode && completionKind !== "complete" && influenceEvents.length !== 0) return false;
    const expectedFactionStanding = !mirrorMode && completionKind === "complete"
      && episode.generatedTaskObjective.kind === "choice"
      && Boolean(signedAction.routeSelection?.factionObjectId);
    if (expectedFactionStanding !== (factionStandingEvents.length === 1)) return false;
    if (factionStandingEvents[0]
      && (factionStandingEvents[0].payload.routeId !== signedAction.routeSelection?.routeId
        || factionStandingEvents[0].payload.factionId !== signedAction.routeSelection?.factionObjectId)) return false;
    return signedAction.taskObjectiveId === objectiveId
      && beat.selectedAction.taskObjectiveId === objectiveId
      && completionKind === beat.selectedAction.completionKind
      && episode.settlement?.taskObjective?.objectiveId === objectiveId
      && episode.settlement.taskObjective.completionKind === completionKind;
  }
  return influenceEvents.length === 0
    && factionStandingEvents.length === 0
    && beat.selectedAction.taskObjectiveId === undefined
    && beat.selectedAction.completionKind === undefined;
}

export class JourneyRuntime {
  readonly #options: Required<Pick<
    JourneyRuntimeOptions,
    "defaultRealDurationMs" | "defaultWorldDurationMs" | "pollIntervalMs"
  >> & JourneyRuntimeOptions;
  #projection: JourneyProjection;

  constructor(options: JourneyRuntimeOptions) {
    this.#options = {
      ...options,
      defaultRealDurationMs: options.defaultRealDurationMs ?? 30 * 60 * 1_000,
      defaultWorldDurationMs: options.defaultWorldDurationMs ?? 60 * 60 * 1_000,
      pollIntervalMs: options.pollIntervalMs ?? 5 * 60 * 1_000,
    };
    this.#projection = projectJourneyRuntimeEvents(options.initialEvents ?? []);
    for (const record of Object.values(this.#projection.journeys)) {
      if (["settling", "settled"].includes(record.journey.status) && !this.#hasGroundedThreePhase(record.journey)) {
        throw new Error("journey_settlement_grounding_invalid");
      }
    }
  }

  projection() {
    return this.#projection;
  }

  nowReal() {
    return (this.#options.nowReal ?? (() => new Date().toISOString()))();
  }

  nowWorld() {
    return (this.#options.nowWorld ?? this.#options.nowReal ?? (() => new Date().toISOString()))();
  }

  tagEvents(
    eventIds: ReadonlySet<string>,
    command: { readonly scope: string; readonly ownerId: string; readonly idempotencyKey: string; readonly subjectHash: string },
  ): readonly JourneyRuntimeEvent[] {
    const events = this.#projection.events.map((event) => eventIds.has(event.eventId) ? { ...event, command } : event);
    this.#projection = { ...this.#projection, events };
    return events.filter((event) => eventIds.has(event.eventId));
  }

  prepare(input: PrepareJourneyRuntimeInput): JourneyRuntimeRecord {
    const agentId = requiredText(input.agentId, "agent_id");
    const explorerId = requiredText(input.explorerId, "explorer_id");
    const mandate = normalizeJourneyMandate(input.mandate ?? {});
    const policySelection = normalizeJourneyPolicySelection(input.policy ?? {});
    const journeyId = this.#options.idFactory("journey");

    // PR3: offer-driven mode. The caller (HTTP layer) is responsible for the
    // async claim against the offer store BEFORE invoking prepare, then
    // passing in the resolved InternalQuestOffer. The runtime never performs
    // IO itself — keeping prepare synchronous preserves every existing test.
    const offerDriven = input.questOfferId !== undefined;
    if (offerDriven && input.questOffer === undefined) {
      throw new Error("journey_offer_resolution_required");
    }
    const resolvedOffer = input.questOffer;
    if (resolvedOffer !== undefined && resolvedOffer.questOfferId !== input.questOfferId) {
      throw new Error("offer_id_mismatch");
    }
    if (resolvedOffer !== undefined && input.offerHash !== undefined && resolvedOffer.offerHash !== input.offerHash) {
      throw new Error("offer_hash_mismatch");
    }
    const offerTaskType = resolvedOffer?.publicView.taskTypeText;
    const offerRegionId = resolvedOffer?.publicView.region.regionId;
    const offerScenarioMapId = resolvedOffer?.publicView.scenarioMapId;

    const destinationRegionId = requiredText(input.destinationRegionId, "destination_region_id");
    const originRegionId = requiredText(input.originRegionId, "origin_region_id");
    const clientTaskType = input.taskType ?? mandate.objective;

    // PR3: client-supplied region/taskType MUST equal the offer binding when
    // both are present. The offer is authoritative; the client echo is a
    // safety check.
    if (offerRegionId !== undefined && offerRegionId !== destinationRegionId) {
      throw new Error("offer_region_mismatch");
    }
    if (offerTaskType !== undefined && offerTaskType !== clientTaskType) {
      throw new Error("offer_task_type_mismatch");
    }

    const taskRequest = resolvedOffer !== undefined
      ? {
          taskType: offerTaskType ?? clientTaskType,
          // scenarioMapId is decoupled from destinationRegionId: the offer
          // pins it from its region.scenarioMapId.
          scenarioMapId: offerScenarioMapId ?? destinationRegionId,
          generationRequested: true,
          taskFamilyId: resolvedOffer.taskFamilyId,
          questOfferId: resolvedOffer.questOfferId,
          offerHash: resolvedOffer.offerHash,
          expectedApproach: resolvedOffer.expectedApproach[0],
          marketSnapshotVersion: resolvedOffer.marketSnapshotVersion,
        }
      : {
          taskType: requiredText(clientTaskType, "task_type"),
          scenarioMapId: destinationRegionId,
          generationRequested: input.taskType !== undefined,
        };

    const draft: EpochJourney = {
      journeyId,
      agentId,
      explorerId,
      correlationId: `journey:${journeyId}`,
      status: "draft",
      originRegionId,
      destinationRegionId,
      taskRequest,
      mandate,
      policyVersion: Number(policySelection.presetVersion),
      worldMode: "mirror",
      mirrorTimeRuleVersion: 2,
      episodeIds: [],
      interactionIds: [],
      sourceEventIds: [],
      synchronousQuestionCount: 0,
      version: 0,
      ...(resolvedOffer !== undefined ? {
        questOfferId: resolvedOffer.questOfferId,
        offerHash: resolvedOffer.offerHash,
        marketSnapshotVersion: resolvedOffer.marketSnapshotVersion,
      } : {}),
    };
    const existingJourneys = Object.values(this.#projection.journeys).map((record) => record.journey);
    const journey = prepareJourney({ journey: draft, expectedVersion: 0, journeys: existingJourneys });
    const expectedReturn = input.expectedReturn ?? "约半小时后";
    const preview = buildJourneyPolicyPreview({
      mandate,
      policySelection: { presetId: policySelection.presetId, overrides: policySelection.policy },
      expectedReturn,
    });
    this.#append([this.#snapshotEvent("journey_prepared", journey, policySelection, preview)]);
    return this.#record(journey.journeyId);
  }

  reserveMirrorWindow(input: ReserveJourneyMirrorWindowRuntimeInput): JourneyRuntimeRecord {
    const current = this.#record(input.journeyId).journey;
    if (current.version !== input.expectedVersion) throw new Error("journey_version_conflict");
    if (current.status !== "prepared" || current.worldMode !== "mirror") {
      throw new Error("journey_mirror_window_reservation_invalid");
    }
    if (current.mirrorWindow) return this.#record(current.journeyId);
    if (current.mirrorTimeRuleVersion !== 2) return this.#record(current.journeyId);
    const mirrorWindow = serverMirrorWindow(current, this.nowWorld(), current.version + 1);
    const worldSlice = this.#options.worldSliceForWindow?.({
      regionId: current.destinationRegionId,
      startedAtWorldTime: mirrorWindow.startedAtWorldTime,
      endedAtWorldTime: mirrorWindow.endedAtWorldTime,
    });
    const journey: EpochJourney = {
      ...current,
      mirrorWindow,
      ...(worldSlice ? { worldSlice } : {}),
      version: current.version + 1,
    };
    this.#append([this.#snapshotEvent("journey_world_window_reserved", journey)]);
    return this.#record(journey.journeyId);
  }

  start(input: StartJourneyRuntimeInput): JourneyRuntimeRecord {
    const current = this.#record(input.journeyId).journey;
    const nowReal = (this.#options.nowReal ?? (() => new Date().toISOString()))();
    const nowWorld = (this.#options.nowWorld ?? this.#options.nowReal ?? (() => new Date().toISOString()))();
    const realDuration = boundedDuration(input.realDurationMs, this.#options.defaultRealDurationMs, "real_duration");
    const dueAtRealTime = plusMilliseconds(nowReal, realDuration);
    const mirrorWindow = current.worldMode === "mirror"
      ? current.mirrorTimeRuleVersion === 2
        ? current.mirrorWindow
          ? {
              startedAtWorldTime: current.mirrorWindow.startedAtWorldTime,
              dueAtWorldTime: current.mirrorWindow.endedAtWorldTime,
            }
          : historicalMirrorTimeWindow(current, nowWorld)
        : legacyMirrorTimeWindow(current, nowWorld)
      : {
          startedAtWorldTime: nowWorld,
          dueAtWorldTime: plusMilliseconds(
            nowWorld,
            boundedDuration(input.worldDurationMs, this.#options.defaultWorldDurationMs, "world_duration"),
          ),
        };
    const started = startJourney({
      journey: current,
      expectedVersion: input.expectedVersion,
      startedAtWorldTime: mirrorWindow.startedAtWorldTime,
      dueAtWorldTime: mirrorWindow.dueAtWorldTime,
      dueAtRealTime,
      nextPollAt: earlierIso(plusMilliseconds(nowReal, this.#options.pollIntervalMs), dueAtRealTime),
    });
    const worldSlice = current.worldSlice ?? (current.worldMode === "mirror"
      ? this.#options.worldSliceForWindow?.({
          regionId: current.destinationRegionId,
          startedAtWorldTime: mirrorWindow.startedAtWorldTime,
          endedAtWorldTime: mirrorWindow.dueAtWorldTime,
        })
      : undefined);
    const journey = {
      ...started,
      ...(current.mirrorTimeRuleVersion === 2 && !current.mirrorWindow ? {
        mirrorWindow: {
          version: 1 as const,
          authority: "server_world_clock" as const,
          selection: "deterministic_random_history" as const,
          regionId: current.destinationRegionId,
          startExpectedVersion: current.version,
          startedAtWorldTime: mirrorWindow.startedAtWorldTime,
          endedAtWorldTime: mirrorWindow.dueAtWorldTime,
        },
      } : {}),
      expectedReturnWorldTime: mirrorWindow.dueAtWorldTime,
      ...(worldSlice ? { worldSlice } : {}),
    };
    this.#append([this.#snapshotEvent("journey_started", journey)]);
    return this.#record(journey.journeyId);
  }

  installTaskPlan(input: InstallJourneyTaskPlanRuntimeInput): JourneyRuntimeRecord {
    const current = this.#record(input.journeyId).journey;
    const hasInstallation = input.installation !== undefined;
    const hasLegacy = input.taskPlan !== undefined;
    if (!hasInstallation && !hasLegacy) {
      throw new Error("journey_task_plan_input_required");
    }
    if (hasInstallation && hasLegacy) {
      throw new Error("journey_task_plan_input_conflict");
    }
    const journey = installJourneyTaskPlan({
      journey: current,
      expectedVersion: input.expectedVersion,
      ...(hasInstallation ? { installation: input.installation } : { taskPlan: input.taskPlan }),
    });
    if (journey !== current) {
      // PR3: prefer the installation's hiddenTaskSeal when present (carries
      // the source-binding tuple); fall back to the legacy shorthand.
      const planForSeal = hasInstallation ? input.installation!.plan : input.taskPlan!;
      const sealSource = hasInstallation ? input.installation!.hiddenTaskSeal : input.hiddenTaskSeal!;
      const hiddenTaskSeal = normalizeJourneyHiddenTaskSeal(planForSeal, sealSource);
      this.#append([this.#snapshotEvent(
        "journey_task_plan_installed",
        journey,
        undefined,
        undefined,
        undefined,
        hiddenTaskSeal,
      )]);
    }
    return this.#record(input.journeyId);
  }

  hiddenTaskSealForJourney(
    journeyId: string,
    taskPlan?: JourneyGeneratedTaskPlan,
  ): JourneyHiddenTaskSeal | undefined {
    const record = this.#record(journeyId);
    if (taskPlan && record.journey.taskPlan?.hiddenTaskCommitment !== taskPlan.hiddenTaskCommitment) {
      throw new Error("journey_hidden_task_plan_mismatch");
    }
    return this.#projection.hiddenTaskSeals[journeyId];
  }

  recall(journeyId: string, expectedVersion: number): JourneyRuntimeRecord {
    const journey = recallJourney({ journey: this.#record(journeyId).journey, expectedVersion });
    if (journey !== this.#record(journeyId).journey) {
      this.#append([this.#snapshotEvent("journey_status_changed", journey)]);
    }
    return this.#record(journeyId);
  }

  awaitAgent(journeyId: string, expectedVersion: number): JourneyRuntimeRecord {
    const current = this.#record(journeyId).journey;
    if (current.status === "awaiting_agent") return this.#record(journeyId);
    const journey = transitionJourney({
      journey: current,
      toStatus: "awaiting_agent",
      expectedVersion,
    });
    this.#append([this.#snapshotEvent("journey_status_changed", journey)]);
    return this.#record(journeyId);
  }

  beginReturn(journeyId: string, expectedVersion: number): JourneyRuntimeRecord {
    const current = this.#record(journeyId).journey;
    if (current.status === "returning") return this.#record(journeyId);
    const journey = transitionJourney({
      journey: current,
      toStatus: "returning",
      expectedVersion,
    });
    this.#append([this.#snapshotEvent("journey_status_changed", journey)]);
    return this.#record(journeyId);
  }

  settleCompleted(journeyId: string, expectedVersion: number): JourneyRuntimeRecord {
    let journey = this.#record(journeyId).journey;
    if (journey.version !== expectedVersion) throw new Error("journey_version_conflict");
    if (journey.status === "settled") return this.#record(journeyId);
    if (journey.status !== "returning" || !this.#hasGroundedThreePhase(journey)) {
      throw new Error("journey_settlement_not_ready");
    }
    const events: JourneyRuntimeEvent[] = [];
    journey = transitionJourney({ journey, toStatus: "settling", expectedVersion: journey.version });
    events.push(this.#snapshotEvent("journey_status_changed", journey));
    journey = transitionJourney({
      journey,
      toStatus: "settled",
      expectedVersion: journey.version,
      settledAtWorldTime: journey.worldMode === "mirror" ? journey.dueAtWorldTime : this.nowWorld(),
    });
    events.push(this.#snapshotEvent("journey_status_changed", journey));
    this.#append(events);
    return this.#record(journeyId);
  }

  status(journeyId: string): JourneyRuntimeRecord {
    return this.#record(journeyId);
  }

  recordWorldCommit(input: RecordJourneyWorldCommitRuntimeInput): JourneyRuntimeRecord {
    const current = this.#record(input.journeyId).journey;
    const journey = recordJourneyWorldCommit({
      journey: current,
      expectedVersion: input.expectedVersion,
      worldCommit: input.worldCommit,
    });
    if (journey !== current) {
      this.#append([this.#snapshotEvent("journey_world_commit_recorded", journey)]);
    }
    return this.#record(input.journeyId);
  }

  /**
   * PR2 mirror-consequence ledger integration. Persists `entries` to the
   * journey-scoped mirror ledger through the runtime-event channel so the
   * projection remains the single in-memory truth. Replay is idempotent:
   * re-applying the same entries is a no-op at the ledger layer
   * ({@link appendMirrorConsequence}).
   *
   * `expectedVersion` is the pre-call `journey.version`; the method emits a
   * snapshot event with `journey.version + 1` to preserve the runtime
   * projection's version monotonicity, matching the {@link recordWorldCommit}
   * pattern.
   */
  recordMirrorConsequences(input: {
    readonly journeyId: string;
    readonly expectedVersion: number;
    readonly entries: readonly MirrorConsequenceLedgerEntry[];
  }): JourneyRuntimeRecord {
    const current = this.#record(input.journeyId).journey;
    if (current.version !== input.expectedVersion) throw new Error("journey_version_conflict");
    if (input.entries.length === 0) return this.#record(input.journeyId);
    const journey: EpochJourney = { ...current, version: current.version + 1 };
    this.#append([
      this.#snapshotEvent("journey_mirror_consequence_recorded", journey, undefined, undefined, undefined, undefined, input.entries),
    ]);
    return this.#record(input.journeyId);
  }

  /**
   * Mark ledger entries as promoted to canonical event ids. Promotions are
   * atomic per entry; re-marking the same entryId with the same canonical id
   * is a no-op.
   */
  promoteMirrorConsequences(input: {
    readonly journeyId: string;
    readonly expectedVersion: number;
    readonly promotions: readonly { readonly entryId: string; readonly canonicalEventId: string }[];
  }): JourneyRuntimeRecord {
    const current = this.#record(input.journeyId).journey;
    if (current.version !== input.expectedVersion) throw new Error("journey_version_conflict");
    if (input.promotions.length === 0) return this.#record(input.journeyId);
    const journey: EpochJourney = { ...current, version: current.version + 1 };
    this.#append([
      this.#snapshotEvent("journey_mirror_consequence_promoted", journey, undefined, undefined, undefined, undefined, undefined, input.promotions),
    ]);
    return this.#record(input.journeyId);
  }

  /**
   * Discard every non-promoted entry on the journey's mirror ledger. Used
   * when a mirror world is rejected at settlement (below canon threshold or
   * main-line incomplete). Promoted entries survive discard.
   */
  discardMirrorConsequences(input: {
    readonly journeyId: string;
    readonly expectedVersion: number;
  }): JourneyRuntimeRecord {
    const current = this.#record(input.journeyId).journey;
    if (current.version !== input.expectedVersion) throw new Error("journey_version_conflict");
    const journey: EpochJourney = { ...current, version: current.version + 1 };
    this.#append([
      this.#snapshotEvent("journey_mirror_consequence_discarded", journey),
    ]);
    return this.#record(input.journeyId);
  }

  linkVerification(input: LinkJourneyVerificationRuntimeInput): JourneyRuntimeRecord {
    const current = this.#record(input.journeyId).journey;
    const journey = linkJourneyVerification({
      journey: current,
      expectedVersion: input.expectedVersion,
      verification: {
        pageId: input.pageId,
        urlPath: input.urlPath,
        createdAt: input.createdAt,
      },
    });
    if (journey !== current) {
      this.#append([this.#snapshotEvent("journey_verification_linked", journey)]);
    }
    return this.#record(input.journeyId);
  }

  activeForAgent(agentId: string): JourneyRuntimeRecord | undefined {
    const active = activeJourneyForAgent(
      journeyRecordsForAgent(this.#projection, agentId).map((record) => record.journey),
      agentId,
    );
    return active ? this.#projection.journeys[active.journeyId] : undefined;
  }

  composeEpisodes(
    journeyId: string,
    expectedVersion: number,
    context: JourneyEpisodeContext,
  ): JourneyScenePlan {
    let journey = this.#record(journeyId).journey;
    if (journey.version !== expectedVersion) throw new Error("journey_version_conflict");
    const plan = generateJourneySceneEpisodes({ ...context, mandate: journey.mandate });
    const episodes = plan.episodes.map((episode) => ({
      ...episode,
      episodeId: `${journey.journeyId}:${episode.episodeId}`,
    }));
    return { ...plan, episodes };
  }

  composeThreePhaseEpisodes(
    journeyId: string,
    expectedVersion: number,
    context: JourneyEpisodeContext,
  ): JourneyScenePlan {
    const journey = this.#record(journeyId).journey;
    if (journey.version !== expectedVersion) throw new Error("journey_version_conflict");
    const plan = journey.taskPlan
      ? generateTaskPlanJourneySceneEpisodes({
          plan: journey.taskPlan,
          region: context.region,
          availableWorldObjects: context.availableWorldObjects,
        })
      : generateThreePhaseJourneySceneEpisodes({ ...context, mandate: journey.mandate });
    const episodes = plan.episodes.map((episode) => ({
      ...episode,
      episodeId: `${journey.journeyId}:${episode.episodeId}`,
    }));
    return { ...plan, episodes };
  }

  commitEpisodes(
    journeyId: string,
    expectedVersion: number,
    episodes: readonly JourneySceneEpisode[],
  ): JourneyRuntimeRecord {
    let journey = this.#record(journeyId).journey;
    if (journey.version !== expectedVersion) throw new Error("journey_version_conflict");
    const events: JourneyRuntimeEvent[] = [];
    for (let episodeIndex = 0; episodeIndex < episodes.length; episodeIndex += 1) {
      const episode = episodes[episodeIndex];
      if (!episode.episodeId.startsWith(`${journey.journeyId}:`)) throw new Error("journey_episode_id_invalid");
      if (episode.phase) {
        const recordedEpisodes = journey.episodeIds
          .map((episodeId) => this.#projection.episodes[episodeId])
          .filter(Boolean);
        const expected = this.#expectedEpisode(journey, recordedEpisodes);
        const expectedPhase = expected.phase;
        if (episode.phase !== expectedPhase) throw new Error("journey_episode_phase_order_invalid");
        if (expected.objectiveId !== episode.generatedTaskObjective?.objectiveId) {
          throw new Error("journey_episode_objective_order_invalid");
        }
        const expectedStatus = episode.phase === "arrival"
          ? "traveling"
          : episode.phase === "main" || episode.phase === "side"
            ? "awaiting_agent"
            : "returning";
        if (journey.status !== expectedStatus) throw new Error("journey_episode_phase_status_invalid");
        if (!isGroundedJourneyEpisode(journey, episode, this.#options.canonicalEpochEvents)) {
          throw new Error("journey_episode_grounding_invalid");
        }
      }
      journey = recordJourneyEpisode({
        journey,
        expectedVersion: journey.version,
        episodeId: episode.episodeId,
        sourceEventIds: episode.sourceFactIds,
      });
      const nextPhase = episodes[episodeIndex + 1]?.phase;
      journey = { ...journey, status: episode.phase === "return" || nextPhase === "return" ? "returning" : "awaiting_agent" } as typeof journey;
      events.push(this.#snapshotEvent("journey_episode_recorded", journey, undefined, undefined, episode));
    }
    this.#append(events);
    return this.#record(journeyId);
  }

  tick(input: UnknownRecord = {}): JourneyTickResult {
    const nowReal = typeof input.nowReal === "string"
      ? input.nowReal
      : (this.#options.nowReal ?? (() => new Date().toISOString()))();
    const nowWorld = typeof input.nowWorld === "string"
      ? input.nowWorld
      : (this.#options.nowWorld ?? this.#options.nowReal ?? (() => new Date().toISOString()))();
    if (!Number.isFinite(Date.parse(nowReal)) || !Number.isFinite(Date.parse(nowWorld))) throw new Error("journey_tick_time_invalid");
    const events: JourneyRuntimeEvent[] = [];
    const settledJourneyIds: string[] = [];

    for (const record of Object.values(this.#projection.journeys)) {
      let journey = record.journey;
      const due = journey.dueAtRealTime && Date.parse(journey.dueAtRealTime) <= Date.parse(nowReal);
      if (journey.status === "traveling" && due) {
        journey = transitionJourney({ journey, toStatus: "returning", expectedVersion: journey.version });
        events.push(this.#snapshotEvent("journey_status_changed", journey));
      }
      if (journey.status === "returning") {
        if (!due || !this.#hasGroundedThreePhase(journey)) continue;
        journey = transitionJourney({ journey, toStatus: "settling", expectedVersion: journey.version });
        events.push(this.#snapshotEvent("journey_status_changed", journey));
      }
      if (journey.status === "settling") {
        if (!this.#hasGroundedThreePhase(journey)) continue;
        journey = transitionJourney({
          journey,
          toStatus: "settled",
          expectedVersion: journey.version,
          settledAtWorldTime: journey.worldMode === "mirror" ? journey.dueAtWorldTime : nowWorld,
        });
        events.push(this.#snapshotEvent("journey_status_changed", journey));
        settledJourneyIds.push(journey.journeyId);
      }
    }
    this.#append(events);
    return { events, settledJourneyIds };
  }

  catchUp(input: UnknownRecord = {}) {
    return this.tick(input);
  }

  claimReturnedJourneys(explorerId: string): readonly JourneyRuntimeRecord[] {
    const records = this.pendingReturnedJourneys(explorerId);
    this.deliverReturnedJourneys(explorerId, records.map((record) => record.journey.journeyId));
    return records;
  }

  pendingReturnedJourneys(explorerId: string): readonly JourneyRuntimeRecord[] {
    const owner = requiredText(explorerId, "explorer_id");
    return Object.values(this.#projection.journeys).filter((record) =>
      record.journey.explorerId === owner
      && record.journey.status === "settled"
      && !this.#projection.deliveredReturnIds.has(record.journey.journeyId)
    );
  }

  deliverReturnedJourneys(explorerId: string, journeyIds: readonly string[]) {
    const owner = requiredText(explorerId, "explorer_id");
    const requested = new Set(journeyIds.map((journeyId) => requiredText(journeyId, "id")));
    const records = this.pendingReturnedJourneys(owner).filter((record) => requested.has(record.journey.journeyId));
    const deliveredAt = (this.#options.nowReal ?? (() => new Date().toISOString()))();
    this.#append(records.map((record): JourneyRuntimeEvent => ({
      eventId: this.#options.idFactory("event"),
      eventType: "journey_return_delivered",
      journeyId: record.journey.journeyId,
      agentId: record.journey.agentId,
      explorerId: record.journey.explorerId,
      occurredAt: deliveredAt,
      deliveredAt,
    })));
    return records.map((record) => record.journey.journeyId);
  }

  #record(journeyId: string): JourneyRuntimeRecord {
    const record = this.#projection.journeys[requiredText(journeyId, "id")];
    if (!record) throw new Error("journey_not_found");
    return record;
  }

  #expectedEpisode(
    journey: EpochJourney,
    recordedEpisodes: readonly JourneySceneEpisode[],
  ): { readonly phase: "arrival" | "main" | "side" | "return"; readonly objectiveId?: string } {
    if (!journey.taskPlan) {
      const phase = (["arrival", "main", "return"] as const)[recordedEpisodes.length];
      if (!phase) throw new Error("journey_steps_complete");
      return { phase };
    }
    if (recordedEpisodes.length === 0) return { phase: "arrival" };
    if (journey.status === "returning") return { phase: "return" };
    const objective = nextJourneyTaskObjective(journey.taskPlan, recordedEpisodes);
    if (!objective) throw new Error("journey_steps_complete");
    return {
      phase: objective.kind === "side" ? "side" : "main",
      objectiveId: objective.objectiveId,
    };
  }

  #hasGroundedThreePhase(journey: EpochJourney) {
    const episodes = journey.episodeIds
      .map((episodeId) => this.#projection.episodes[episodeId])
      .filter((episode): episode is JourneySceneEpisode => Boolean(episode));
    if (episodes.length !== journey.episodeIds.length) return false;
    if (!journey.taskPlan) {
      const expectedPhases = ["arrival", "main", "return"] as const;
      return episodes.length === expectedPhases.length && episodes.every((episode, index) =>
        episode.phase === expectedPhases[index]
        && isGroundedJourneyEpisode(journey, episode, this.#options.canonicalEpochEvents));
    }
    const evidence: JourneySceneEpisode[] = [];
    for (const [index, episode] of episodes.entries()) {
      const final = index === episodes.length - 1;
      if (index === 0) {
        if (episode.phase !== "arrival" || episode.generatedTaskObjective) return false;
      } else if (episode.phase === "return") {
        if (!final || nextJourneyTaskObjective(journey.taskPlan, evidence)) return false;
      } else {
        const expected = nextJourneyTaskObjective(journey.taskPlan, evidence);
        if (!expected
          || episode.generatedTaskObjective?.objectiveId !== expected.objectiveId
          || episode.phase !== (expected.kind === "side" ? "side" : "main")) return false;
      }
      if (!isGroundedJourneyEpisode(journey, episode, this.#options.canonicalEpochEvents)) return false;
      evidence.push(episode);
    }
    return episodes.length >= 3
      && episodes[0]?.phase === "arrival"
      && episodes.at(-1)?.phase === "return";
  }

  #snapshotEvent(
    eventType: "journey_prepared" | "journey_world_window_reserved" | "journey_task_plan_installed" | "journey_started" | "journey_episode_recorded" | "journey_verification_linked" | "journey_status_changed" | "journey_world_commit_recorded" | "journey_mirror_consequence_recorded" | "journey_mirror_consequence_promoted" | "journey_mirror_consequence_discarded",
    journey: EpochJourney,
    policySelection?: JourneyPolicySelection,
    preview?: JourneyRuntimeRecord["preview"],
    episode?: JourneySceneEpisode,
    hiddenTaskSeal?: JourneyHiddenTaskSeal,
    mirrorConsequenceEntries?: readonly MirrorConsequenceLedgerEntry[],
    mirrorConsequencePromotions?: readonly { readonly entryId: string; readonly canonicalEventId: string }[],
  ): JourneyRuntimeEvent {
    return {
      eventId: this.#options.idFactory("event"),
      eventType,
      journeyId: journey.journeyId,
      agentId: journey.agentId,
      explorerId: journey.explorerId,
      occurredAt: (this.#options.nowReal ?? (() => new Date().toISOString()))(),
      journey,
      ...(policySelection ? { policySelection } : {}),
      ...(preview ? { preview } : {}),
      ...(episode ? { episode } : {}),
      ...(hiddenTaskSeal ? { hiddenTaskSeal } : {}),
      ...(mirrorConsequenceEntries ? { mirrorConsequenceEntries } : {}),
      ...(mirrorConsequencePromotions ? { mirrorConsequencePromotions } : {}),
    };
  }

  #append(events: readonly JourneyRuntimeEvent[]) {
    if (events.length === 0) return;
    let next = this.#projection;
    for (const event of events) next = applyJourneyRuntimeEvent(next, event);
    this.#options.appendEvents?.(events);
    this.#projection = next;
  }
}

export function createJourneyRuntime(options: JourneyRuntimeOptions) {
  return new JourneyRuntime(options);
}
