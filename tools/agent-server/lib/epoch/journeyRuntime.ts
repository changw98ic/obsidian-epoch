import {
  activeJourneyForAgent,
  linkJourneyVerification,
  prepareJourney,
  recordJourneyEpisode,
  recallJourney,
  startJourney,
  transitionJourney,
  type EpochJourney,
} from "./journeyRules.ts";
import {
  buildJourneyPolicyPreview,
  normalizeJourneyMandate,
  normalizeJourneyPolicySelection,
  type JourneyPolicySelection,
} from "./journeyPolicyRules.ts";
import { revalidatePersistedJourneyNarrative } from "./journeyNarrativeRules.ts";
import type { EpochEvent } from "./events.ts";
import {
  generateJourneySceneEpisodes,
  generateThreePhaseJourneySceneEpisodes,
  type JourneySceneGenerationInput,
  type JourneySceneEpisode,
  type JourneyScenePlan,
} from "./journeySceneRules.ts";
import {
  applyJourneyRuntimeEvent,
  journeyRecordsForAgent,
  projectJourneyRuntimeEvents,
  type JourneyProjection,
  type JourneyRuntimeEvent,
  type JourneyRuntimeRecord,
} from "./journeyReadModel.ts";

type UnknownRecord = Readonly<Record<string, unknown>>;

export interface JourneyRuntimeOptions {
  readonly idFactory: (kind: "journey" | "event") => string;
  readonly nowReal?: () => string;
  readonly nowWorld?: () => string;
  readonly initialEvents?: readonly JourneyRuntimeEvent[];
  readonly appendEvents?: (events: readonly JourneyRuntimeEvent[]) => void;
  readonly canonicalEpochEvents?: () => readonly EpochEvent[];
  readonly defaultRealDurationMs?: number;
  readonly defaultWorldDurationMs?: number;
  readonly pollIntervalMs?: number;
}

export interface PrepareJourneyRuntimeInput {
  readonly agentId: string;
  readonly explorerId: string;
  readonly originRegionId: string;
  readonly destinationRegionId: string;
  readonly mandate?: unknown;
  readonly policy?: unknown;
  readonly expectedReturn?: string;
}

export interface StartJourneyRuntimeInput {
  readonly journeyId: string;
  readonly expectedVersion: number;
  readonly realDurationMs?: number;
  readonly worldDurationMs?: number;
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
  return canonicalEventIds.every((eventId) => {
    const event = epochEventsById.get(eventId);
    if (event?.eventType !== "hosted_action_recorded"
      || event.correlationId !== journey.correlationId
      || event.agentId !== journey.agentId) return false;
    return epochEvents.some((candidate) => candidate.eventType === "hosted_session_started"
      && candidate.correlationId === journey.correlationId
      && candidate.agentId === journey.agentId
      && candidate.payload.sessionId === event.payload.sessionId
      && candidate.payload.sceneContract?.journeyId === journey.journeyId
      && candidate.payload.sceneContract.episodeId === episode.episodeId);
  });
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
    const draft: EpochJourney = {
      journeyId,
      agentId,
      explorerId,
      correlationId: `journey:${journeyId}`,
      status: "draft",
      originRegionId: requiredText(input.originRegionId, "origin_region_id"),
      destinationRegionId: requiredText(input.destinationRegionId, "destination_region_id"),
      mandate,
      policyVersion: Number(policySelection.presetVersion),
      episodeIds: [],
      interactionIds: [],
      sourceEventIds: [],
      synchronousQuestionCount: 0,
      version: 0,
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

  start(input: StartJourneyRuntimeInput): JourneyRuntimeRecord {
    const current = this.#record(input.journeyId).journey;
    const nowReal = (this.#options.nowReal ?? (() => new Date().toISOString()))();
    const nowWorld = (this.#options.nowWorld ?? this.#options.nowReal ?? (() => new Date().toISOString()))();
    const realDuration = boundedDuration(input.realDurationMs, this.#options.defaultRealDurationMs, "real_duration");
    const worldDuration = boundedDuration(input.worldDurationMs, this.#options.defaultWorldDurationMs, "world_duration");
    const dueAtRealTime = plusMilliseconds(nowReal, realDuration);
    const dueAtWorldTime = plusMilliseconds(nowWorld, worldDuration);
    const started = startJourney({
      journey: current,
      expectedVersion: input.expectedVersion,
      startedAtWorldTime: nowWorld,
      dueAtWorldTime,
      dueAtRealTime,
      nextPollAt: earlierIso(plusMilliseconds(nowReal, this.#options.pollIntervalMs), dueAtRealTime),
    });
    const journey = { ...started, expectedReturnWorldTime: dueAtWorldTime };
    this.#append([this.#snapshotEvent("journey_started", journey)]);
    return this.#record(journey.journeyId);
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

  status(journeyId: string): JourneyRuntimeRecord {
    return this.#record(journeyId);
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
    const plan = generateThreePhaseJourneySceneEpisodes({ ...context, mandate: journey.mandate });
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
    for (const episode of episodes) {
      if (!episode.episodeId.startsWith(`${journey.journeyId}:`)) throw new Error("journey_episode_id_invalid");
      if (episode.phase) {
        const expectedPhase = (["arrival", "main", "return"] as const)[journey.episodeIds.length];
        if (episode.phase !== expectedPhase) throw new Error("journey_episode_phase_order_invalid");
        const expectedStatus = episode.phase === "arrival"
          ? "traveling"
          : episode.phase === "main"
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
          settledAtWorldTime: nowWorld,
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

  #hasGroundedThreePhase(journey: EpochJourney) {
    if (journey.episodeIds.length !== 3) return false;
    return journey.episodeIds.every((episodeId, index) => {
      const episode = this.#projection.episodes[episodeId];
      return episode?.phase === (["arrival", "main", "return"] as const)[index]
        && isGroundedJourneyEpisode(journey, episode, this.#options.canonicalEpochEvents);
    });
  }

  #snapshotEvent(
    eventType: "journey_prepared" | "journey_started" | "journey_episode_recorded" | "journey_verification_linked" | "journey_status_changed",
    journey: EpochJourney,
    policySelection?: JourneyPolicySelection,
    preview?: JourneyRuntimeRecord["preview"],
    episode?: JourneySceneEpisode,
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
