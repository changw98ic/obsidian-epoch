import type {
  JourneyGeneratedTaskPlan,
  JourneyTaskRequest,
} from "./journeyGeneratedTaskRules.ts";

export const JOURNEY_STATUSES = [
  "draft",
  "prepared",
  "traveling",
  "awaiting_agent",
  "awaiting_user",
  "returning",
  "settling",
  "settled",
  "cancelled",
  "identity_ended",
] as const;

export type JourneyStatus = (typeof JOURNEY_STATUSES)[number];

export type JourneySocialPreference = "reserved" | "balanced" | "outgoing";
export type JourneyReturnCondition = "time" | "objective" | "resource_floor" | "user_recall";

export type JourneyWorldMode = "mirror";

export interface JourneyWorldCommitFactionStanding {
  readonly factionId: string;
  readonly routeId: string;
  readonly standingDelta: number;
  readonly standingAfter: number;
}

export interface JourneyWorldCommitNpcRelationship {
  readonly npcId: string;
  readonly displayName: string;
  readonly bondId: string;
  readonly scoreDelta: number;
  readonly scoreAfter: number;
  readonly memoryId: string;
}

/**
 * Final server decision for a mirror journey. A discarded mirror never writes
 * shared-world effects; a solidified mirror points at the canonical commit
 * marker and every effect event produced by that marker.
 */
export interface JourneyWorldCommit {
  readonly mode: "mirror";
  readonly status: "solidified" | "discarded";
  readonly reason: "main_completed_and_returned"
    | "main_incomplete_or_return_failed"
    | "quality_below_canon_threshold";
  readonly regionId: string;
  readonly committedAtWorldTime: string;
  readonly influenceDelta: number;
  readonly factionStandings: readonly JourneyWorldCommitFactionStanding[];
  readonly npcRelationships: readonly JourneyWorldCommitNpcRelationship[];
  readonly commitEventId?: string;
  readonly sourceEventIds: readonly string[];
}

export interface JourneyWorldSliceRegionState {
  readonly worldMinute: number;
  readonly stateHash: `sha256:${string}`;
  readonly controllerFactionId?: string;
  readonly population: number;
  readonly treasuryCoin: number;
  readonly securityBps: number;
  readonly unrestBps: number;
  readonly conflictPressureBps: number;
  readonly stocks: Readonly<Record<string, number>>;
  readonly priceMilliCoin: Readonly<Record<string, number>>;
  readonly coverageBps: Readonly<Record<string, number>>;
  readonly conflictPhases: readonly string[];
}

/** Server-signed macro constraints for the historical place/time used by a mirror run. */
export interface JourneyWorldSlice {
  readonly version: 1;
  readonly authority: "server_world_simulation";
  readonly regionId: string;
  readonly startedAtWorldTime: string;
  readonly endedAtWorldTime: string;
  readonly startedAtWorldMinute: number;
  readonly endedAtWorldMinute: number;
  readonly worldContentSourceHash: `sha256:${string}`;
  readonly start: JourneyWorldSliceRegionState;
  readonly end: JourneyWorldSliceRegionState;
  readonly direction: {
    readonly controllerChanged: boolean;
    readonly populationDelta: number;
    readonly treasuryCoinDelta: number;
    readonly securityDeltaBps: number;
    readonly unrestDeltaBps: number;
    readonly conflictPressureDeltaBps: number;
    readonly stockDelta: Readonly<Record<string, number>>;
    readonly priceDeltaMilliCoin: Readonly<Record<string, number>>;
  };
  readonly sourceEventIds: readonly string[];
  readonly sliceHash: `sha256:${string}`;
}

/** Replay-stable historical interval selected and frozen by the server before client generation. */
export interface JourneyMirrorWindow {
  readonly version: 1;
  readonly authority: "server_world_clock";
  readonly selection: "deterministic_random_history";
  readonly regionId: string;
  /** Journey CAS version that the first start command must bind and reuse on idempotent replay. */
  readonly startExpectedVersion: number;
  readonly startedAtWorldTime: string;
  readonly endedAtWorldTime: string;
}

export interface JourneyMandate {
  readonly objective: string;
  readonly priorities: readonly string[];
  readonly avoid: readonly string[];
  readonly preferredActivities: readonly string[];
  readonly socialPreference: JourneySocialPreference;
  readonly returnCondition: JourneyReturnCondition;
}

export interface EpochJourney {
  readonly journeyId: string;
  readonly agentId: string;
  readonly explorerId: string;
  readonly correlationId?: string;
  readonly status: JourneyStatus;
  readonly originRegionId: string;
  readonly destinationRegionId: string;
  readonly taskRequest?: JourneyTaskRequest;
  readonly taskPlan?: JourneyGeneratedTaskPlan;
  readonly mandate: JourneyMandate;
  readonly policyVersion: number;
  /** New journeys run against an isolated snapshot. Missing means legacy direct-world behavior. */
  readonly worldMode?: JourneyWorldMode;
  /** Server-owned deterministic randomization rule used for the in-game mirror window. */
  readonly mirrorTimeRuleVersion?: 1 | 2;
  /** Frozen before model generation so the generated route cannot drift away from its historical slice. */
  readonly mirrorWindow?: JourneyMirrorWindow;
  readonly startedAtWorldTime?: string;
  readonly expectedReturnWorldTime?: string;
  readonly dueAtWorldTime?: string;
  readonly dueAtRealTime?: string;
  readonly nextPollAt?: string;
  readonly settledAtWorldTime?: string;
  readonly worldSlice?: JourneyWorldSlice;
  readonly worldCommit?: JourneyWorldCommit;
  readonly episodeIds: readonly string[];
  readonly interactionIds: readonly string[];
  readonly sourceEventIds: readonly string[];
  readonly verification?: {
    readonly pageId: string;
    readonly urlPath: string;
    readonly createdAt: string;
  };
  /** Number of synchronous game decisions presented during this journey. */
  readonly synchronousQuestionCount: number;
  /** Optimistic-concurrency revision. Every successful mutation increments it once. */
  readonly version: number;
}

export interface JourneyDueTimes {
  readonly startedAtWorldTime: string;
  readonly dueAtWorldTime: string;
  readonly dueAtRealTime: string;
  readonly nextPollAt: string;
}

export interface PrepareJourneyInput {
  readonly journey: EpochJourney;
  readonly expectedVersion: number;
  readonly journeys: readonly EpochJourney[];
}

export interface StartJourneyInput extends JourneyDueTimes {
  readonly journey: EpochJourney;
  readonly expectedVersion: number;
}

export interface TransitionJourneyInput {
  readonly journey: EpochJourney;
  readonly toStatus: JourneyStatus;
  readonly expectedVersion: number;
  /** Required only for prepared -> traveling. */
  readonly dueTimes?: JourneyDueTimes;
  /** Used when draft -> prepared to enforce one active journey per identity. */
  readonly journeys?: readonly EpochJourney[];
  readonly settledAtWorldTime?: string;
}

export interface RecallJourneyInput {
  readonly journey: EpochJourney;
  readonly expectedVersion: number;
}

export interface RecordJourneyEpisodeInput {
  readonly journey: EpochJourney;
  readonly expectedVersion: number;
  readonly episodeId: string;
  readonly sourceEventIds: readonly string[];
  readonly interactionIds?: readonly string[];
}

export interface LinkJourneyVerificationInput {
  readonly journey: EpochJourney;
  readonly expectedVersion: number;
  readonly verification: NonNullable<EpochJourney["verification"]>;
}

export interface RecordJourneyWorldCommitInput {
  readonly journey: EpochJourney;
  readonly expectedVersion: number;
  readonly worldCommit: JourneyWorldCommit;
}

export interface InstallJourneyTaskPlanInput {
  readonly journey: EpochJourney;
  readonly expectedVersion: number;
  readonly taskPlan: JourneyGeneratedTaskPlan;
}

export function recordJourneyWorldCommit(input: RecordJourneyWorldCommitInput): EpochJourney {
  const { journey, worldCommit } = input;
  if (journey.version !== input.expectedVersion) throw new Error("journey_version_conflict");
  if (journey.worldMode !== "mirror" || journey.status !== "settled") {
    throw new Error("journey_world_commit_not_ready");
  }
  if (journey.worldCommit) {
    if (JSON.stringify(journey.worldCommit) !== JSON.stringify(worldCommit)) {
      throw new Error("journey_world_commit_conflict");
    }
    return journey;
  }
  const committedAt = Date.parse(worldCommit.committedAtWorldTime);
  const settledAt = Date.parse(journey.settledAtWorldTime || "");
  const commitTimeValid = journey.mirrorTimeRuleVersion === 2
    ? Number.isFinite(committedAt) && Number.isFinite(settledAt) && committedAt >= settledAt
    : worldCommit.committedAtWorldTime === journey.settledAtWorldTime;
  if (worldCommit.mode !== "mirror"
    || worldCommit.regionId !== journey.destinationRegionId
    || !commitTimeValid) {
    throw new Error("journey_world_commit_invalid");
  }
  if (worldCommit.status === "solidified") {
    if (worldCommit.reason !== "main_completed_and_returned"
      || !worldCommit.commitEventId
      || !worldCommit.sourceEventIds.includes(worldCommit.commitEventId)) {
      throw new Error("journey_world_commit_invalid");
    }
  } else if (!["main_incomplete_or_return_failed", "quality_below_canon_threshold"].includes(worldCommit.reason)
    || worldCommit.commitEventId
    || worldCommit.sourceEventIds.length
    || worldCommit.influenceDelta !== 0
    || worldCommit.factionStandings.length
    || worldCommit.npcRelationships.length) {
    throw new Error("journey_world_commit_invalid");
  }
  return { ...journey, worldCommit, version: journey.version + 1 };
}

const TERMINAL_JOURNEY_STATUSES: ReadonlySet<JourneyStatus> = new Set([
  "settled",
  "cancelled",
  "identity_ended",
]);

const ACTIVE_JOURNEY_STATUSES: ReadonlySet<JourneyStatus> = new Set([
  "prepared",
  "traveling",
  "awaiting_agent",
  "awaiting_user",
  "returning",
  "settling",
]);

export const LEGAL_JOURNEY_TRANSITIONS: Readonly<Record<JourneyStatus, readonly JourneyStatus[]>> = {
  draft: ["prepared", "cancelled", "identity_ended"],
  prepared: ["traveling", "cancelled", "identity_ended"],
  traveling: ["awaiting_agent", "awaiting_user", "returning", "identity_ended"],
  awaiting_agent: ["traveling", "awaiting_user", "returning", "identity_ended"],
  awaiting_user: ["traveling", "awaiting_agent", "returning", "identity_ended"],
  returning: ["settling", "identity_ended"],
  settling: ["settled", "identity_ended"],
  settled: [],
  cancelled: [],
  identity_ended: [],
};

// Server timestamps use an unambiguous UTC ISO-8601 representation. Milliseconds
// may be omitted, but local timestamps and offset spellings are intentionally rejected.
const UTC_ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;

export function isIsoTimestamp(value: string): boolean {
  if (!UTC_ISO_TIMESTAMP.test(value)) return false;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return false;
  return new Date(parsed).toISOString().slice(0, 19) === value.slice(0, 19);
}

function assertIsoTimestamp(value: string | undefined, field: string, required: boolean): void {
  if (value === undefined) {
    if (required) throw new Error(`journey_${field}_required`);
    return;
  }
  if (!isIsoTimestamp(value)) throw new Error(`journey_${field}_invalid`);
}

function assertVersion(version: number, code: string): void {
  if (!Number.isSafeInteger(version) || version < 0) throw new Error(code);
}

function assertQuestionCount(count: number): void {
  if (!Number.isSafeInteger(count) || count < 0 || count > 1) {
    throw new Error("journey_synchronous_question_count_invalid");
  }
}

function assertJourneyTemporalFields(journey: EpochJourney): void {
  assertIsoTimestamp(journey.startedAtWorldTime, "started_at_world_time", false);
  assertIsoTimestamp(journey.expectedReturnWorldTime, "expected_return_world_time", false);
  assertIsoTimestamp(journey.dueAtWorldTime, "due_at_world_time", false);
  assertIsoTimestamp(journey.dueAtRealTime, "due_at_real_time", false);
  assertIsoTimestamp(journey.nextPollAt, "next_poll_at", false);
  assertIsoTimestamp(journey.settledAtWorldTime, "settled_at_world_time", false);
  if (journey.mirrorWindow) {
    const window = journey.mirrorWindow;
    assertIsoTimestamp(window.startedAtWorldTime, "mirror_window_start", true);
    assertIsoTimestamp(window.endedAtWorldTime, "mirror_window_end", true);
    if (journey.worldMode !== "mirror"
      || journey.mirrorTimeRuleVersion !== 2
      || window.version !== 1
      || window.authority !== "server_world_clock"
      || window.selection !== "deterministic_random_history"
      || window.regionId !== journey.destinationRegionId
      || !Number.isSafeInteger(window.startExpectedVersion)
      || window.startExpectedVersion < 1
      || Date.parse(window.endedAtWorldTime) < Date.parse(window.startedAtWorldTime)) {
      throw new Error("journey_mirror_window_invalid");
    }
  }
  if (journey.worldSlice) {
    const slice = journey.worldSlice;
    if (!journey.mirrorWindow
      || slice.authority !== "server_world_simulation"
      || slice.regionId !== journey.destinationRegionId
      || slice.startedAtWorldTime !== journey.mirrorWindow.startedAtWorldTime
      || slice.endedAtWorldTime !== journey.mirrorWindow.endedAtWorldTime
      || !/^sha256:[0-9a-f]{64}$/u.test(slice.sliceHash)) {
      throw new Error("journey_world_slice_invalid");
    }
  }
}

function assertJourneyForTransition(journey: EpochJourney): void {
  assertVersion(journey.version, "journey_version_invalid");
  assertQuestionCount(journey.synchronousQuestionCount);
  assertJourneyTemporalFields(journey);
}

function assertExpectedVersion(journey: EpochJourney, expectedVersion: number): void {
  assertVersion(expectedVersion, "journey_expected_version_invalid");
  if (journey.version !== expectedVersion) throw new Error("journey_version_conflict");
}

export function isTerminalJourneyStatus(status: JourneyStatus): boolean {
  return TERMINAL_JOURNEY_STATUSES.has(status);
}

export function isActiveJourneyStatus(status: JourneyStatus): boolean {
  return ACTIVE_JOURNEY_STATUSES.has(status);
}

export function isActiveJourney(journey: EpochJourney): boolean {
  return isActiveJourneyStatus(journey.status);
}

export function activeJourneysForAgent(
  journeys: readonly EpochJourney[],
  agentId: string,
  excludingJourneyId?: string,
): readonly EpochJourney[] {
  return journeys.filter((candidate) =>
    candidate.agentId === agentId
    && candidate.journeyId !== excludingJourneyId
    && isActiveJourney(candidate)
  );
}

export function hasActiveJourneyForAgent(
  journeys: readonly EpochJourney[],
  agentId: string,
  excludingJourneyId?: string,
): boolean {
  return activeJourneysForAgent(journeys, agentId, excludingJourneyId).length > 0;
}

export function activeJourneyForAgent(
  journeys: readonly EpochJourney[],
  agentId: string,
): EpochJourney | undefined {
  const active = activeJourneysForAgent(journeys, agentId);
  if (active.length > 1) throw new Error("journey_active_projection_conflict");
  return active[0];
}

export function linkJourneyVerification(input: LinkJourneyVerificationInput): EpochJourney {
  assertJourneyForTransition(input.journey);
  assertExpectedVersion(input.journey, input.expectedVersion);
  const pageId = input.verification.pageId.trim();
  const urlPath = input.verification.urlPath.trim();
  if (!pageId) throw new Error("journey_verification_page_id_required");
  if (!urlPath.startsWith(`/epoch/result/${encodeURIComponent(pageId)}`)) {
    throw new Error("journey_verification_url_invalid");
  }
  assertIsoTimestamp(input.verification.createdAt, "verification_created_at", true);
  if (input.journey.verification) {
    if (input.journey.verification.pageId === pageId && input.journey.verification.urlPath === urlPath) return input.journey;
    if (input.journey.status !== "settled") throw new Error("journey_verification_conflict");
  }
  return {
    ...input.journey,
    verification: { pageId, urlPath, createdAt: input.verification.createdAt },
    version: input.journey.version + 1,
  };
}

export function canTransitionJourney(fromStatus: JourneyStatus, toStatus: JourneyStatus): boolean {
  return LEGAL_JOURNEY_TRANSITIONS[fromStatus].includes(toStatus);
}

export function assertJourneyDueTimes(dueTimes: JourneyDueTimes): void {
  assertIsoTimestamp(dueTimes.startedAtWorldTime, "started_at_world_time", true);
  assertIsoTimestamp(dueTimes.dueAtWorldTime, "due_at_world_time", true);
  assertIsoTimestamp(dueTimes.dueAtRealTime, "due_at_real_time", true);
  assertIsoTimestamp(dueTimes.nextPollAt, "next_poll_at", true);

  if (Date.parse(dueTimes.dueAtWorldTime) < Date.parse(dueTimes.startedAtWorldTime)) {
    throw new Error("journey_due_before_start");
  }
  if (Date.parse(dueTimes.nextPollAt) > Date.parse(dueTimes.dueAtRealTime)) {
    throw new Error("journey_next_poll_after_due");
  }
}

export function transitionJourney(input: TransitionJourneyInput): EpochJourney {
  const { journey } = input;
  assertJourneyForTransition(journey);
  assertExpectedVersion(journey, input.expectedVersion);

  if (isTerminalJourneyStatus(journey.status)) throw new Error("journey_terminal_immutable");
  if (!canTransitionJourney(journey.status, input.toStatus)) {
    throw new Error("journey_transition_invalid");
  }

  if (journey.status === "draft" && input.toStatus === "prepared") {
    if (journey.synchronousQuestionCount !== 0) {
      throw new Error("journey_prepare_question_count_invalid");
    }
    if (hasActiveJourneyForAgent(input.journeys || [], journey.agentId, journey.journeyId)) {
      throw new Error("journey_active_conflict");
    }
  }

  let duePatch: JourneyDueTimes | undefined;
  if (journey.status === "prepared" && input.toStatus === "traveling") {
    if (!input.dueTimes) throw new Error("journey_due_times_required");
    assertJourneyDueTimes(input.dueTimes);
    duePatch = input.dueTimes;
  } else if (input.dueTimes) {
    throw new Error("journey_due_times_not_allowed");
  }

  let settledAtWorldTime = journey.settledAtWorldTime;
  if (input.toStatus === "settled") {
    assertIsoTimestamp(input.settledAtWorldTime, "settled_at_world_time", true);
    settledAtWorldTime = input.settledAtWorldTime;
  } else if (input.settledAtWorldTime !== undefined) {
    throw new Error("journey_settled_at_world_time_not_allowed");
  }

  const enteringAwaitingUser = input.toStatus === "awaiting_user" && journey.status !== "awaiting_user";
  const synchronousQuestionCount = journey.synchronousQuestionCount + (enteringAwaitingUser ? 1 : 0);
  if (synchronousQuestionCount > 1) {
    throw new Error("journey_synchronous_question_limit_exceeded");
  }

  return {
    ...journey,
    ...duePatch,
    status: input.toStatus,
    synchronousQuestionCount,
    version: journey.version + 1,
    ...(settledAtWorldTime === undefined ? {} : { settledAtWorldTime }),
  };
}

export function prepareJourney(input: PrepareJourneyInput): EpochJourney {
  if (input.journey.status !== "draft") throw new Error("journey_prepare_status_invalid");
  return transitionJourney({
    journey: input.journey,
    toStatus: "prepared",
    expectedVersion: input.expectedVersion,
    journeys: input.journeys,
  });
}

export function installJourneyTaskPlan(input: InstallJourneyTaskPlanInput): EpochJourney {
  assertJourneyForTransition(input.journey);
  assertExpectedVersion(input.journey, input.expectedVersion);
  if (input.journey.status !== "prepared") throw new Error("journey_task_plan_install_status_invalid");
  if (input.journey.taskPlan) {
    if (JSON.stringify(input.journey.taskPlan) === JSON.stringify(input.taskPlan)) return input.journey;
    throw new Error("journey_task_plan_conflict");
  }
  if (input.journey.taskRequest
    && (input.journey.taskRequest.taskType !== input.taskPlan.taskType
      || input.journey.taskRequest.scenarioMapId !== input.taskPlan.scenarioMapId)) {
    throw new Error("journey_task_plan_request_mismatch");
  }
  return {
    ...input.journey,
    taskPlan: input.taskPlan,
    version: input.journey.version + 1,
  };
}

export function startJourney(input: StartJourneyInput): EpochJourney {
  if (input.journey.status !== "prepared") throw new Error("journey_start_status_invalid");
  return transitionJourney({
    journey: input.journey,
    toStatus: "traveling",
    expectedVersion: input.expectedVersion,
    dueTimes: {
      startedAtWorldTime: input.startedAtWorldTime,
      dueAtWorldTime: input.dueAtWorldTime,
      dueAtRealTime: input.dueAtRealTime,
      nextPollAt: input.nextPollAt,
    },
  });
}

export function recallJourney(input: RecallJourneyInput): EpochJourney {
  assertJourneyForTransition(input.journey);
  assertExpectedVersion(input.journey, input.expectedVersion);

  if (input.journey.status === "returning") return input.journey;
  if (
    input.journey.status !== "traveling"
    && input.journey.status !== "awaiting_agent"
    && input.journey.status !== "awaiting_user"
  ) {
    if (isTerminalJourneyStatus(input.journey.status)) throw new Error("journey_terminal_immutable");
    throw new Error("journey_recall_not_in_world");
  }

  return transitionJourney({
    journey: input.journey,
    toStatus: "returning",
    expectedVersion: input.expectedVersion,
  });
}

export function recordJourneyEpisode(input: RecordJourneyEpisodeInput): EpochJourney {
  assertJourneyForTransition(input.journey);
  assertExpectedVersion(input.journey, input.expectedVersion);
  if (input.journey.status !== "traveling"
    && input.journey.status !== "awaiting_agent"
    && input.journey.status !== "awaiting_user"
    && input.journey.status !== "returning") {
    if (isTerminalJourneyStatus(input.journey.status)) throw new Error("journey_terminal_immutable");
    throw new Error("journey_episode_status_invalid");
  }
  const episodeId = input.episodeId.trim();
  if (!episodeId) throw new Error("journey_episode_id_required");
  if (input.journey.episodeIds.includes(episodeId)) throw new Error("journey_episode_duplicate");
  const sourceEventIds = input.sourceEventIds.map((value) => value.trim());
  if (sourceEventIds.length === 0 || sourceEventIds.some((value) => !value)) {
    throw new Error("journey_episode_source_event_ids_required");
  }
  const interactionIds = (input.interactionIds ?? []).map((value) => value.trim());
  if (interactionIds.some((value) => !value)) throw new Error("journey_episode_interaction_id_invalid");
  return {
    ...input.journey,
    episodeIds: [...input.journey.episodeIds, episodeId],
    sourceEventIds: [...new Set([...input.journey.sourceEventIds, ...sourceEventIds])],
    interactionIds: [...new Set([...input.journey.interactionIds, ...interactionIds])],
    version: input.journey.version + 1,
  };
}
