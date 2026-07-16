import { createHash, randomUUID } from "node:crypto";

import {
  createEpochEvent,
  type EpochEvent,
  type WorldClockAdvancedPayload,
} from "./events.ts";
import {
  EPOCH_WORLD_MINUTES_PER_YEAR,
  epochWorldCalendarMoment,
  epochWorldTimeFromMinute,
  formatEpochWorldTime,
} from "./worldCalendar.ts";
import { attachEpochEventsForPersistence } from "./runtimePublicProjectionRules.ts";
import type { EpochCommandContext, EpochIdFactory } from "./protocol.ts";

export const EPOCH_WORLD_CLOCK_ID = "world_clock:canonical";
export const EPOCH_WORLD_CLOCK_LEGACY_RULE_VERSION = "world-clock.v1";
export const EPOCH_WORLD_CLOCK_RULE_VERSION = "world-clock.v2";
export const EPOCH_WORLD_CLOCK_SPEED_RATIO = 1_440;
export const EPOCH_WORLD_CLOCK_TIME_BASIS = "server_elapsed" as const;
export const EPOCH_TIMELINE_CYCLE_YEARS = 60;
export const EPOCH_TIMELINE_CYCLE_WORLD_MINUTES = EPOCH_TIMELINE_CYCLE_YEARS
  * EPOCH_WORLD_MINUTES_PER_YEAR;
export const EPOCH_TIMELINE_CYCLE_REAL_MINUTES = EPOCH_TIMELINE_CYCLE_WORLD_MINUTES
  / EPOCH_WORLD_CLOCK_SPEED_RATIO;
export const MAX_WORLD_CLOCK_ADVANCE_MINUTES = 30 * 24 * 60;

export type EpochWorldClockRuleVersion = typeof EPOCH_WORLD_CLOCK_LEGACY_RULE_VERSION
  | typeof EPOCH_WORLD_CLOCK_RULE_VERSION;

export interface EpochTimelineCycleState {
  readonly cycleId: string;
  readonly index: number;
  readonly yearsPerCycle: typeof EPOCH_TIMELINE_CYCLE_YEARS;
  readonly startsAtWorldMinute: number;
  readonly endsAtWorldMinute: number;
  readonly minuteInCycle: number;
  readonly completedCycles: number;
  readonly realMinutesPerCycle: number;
}

export interface EpochWorldClockState {
  readonly clockId: typeof EPOCH_WORLD_CLOCK_ID;
  readonly initialized: boolean;
  readonly worldMinute: number;
  /** Last event-materialized minute. World simulation and aggregation replay to this cursor. */
  readonly persistedWorldMinute: number;
  readonly pendingCatchUpWorldMinutes: number;
  readonly worldTime: string;
  readonly displayTime: string;
  readonly calendar: ReturnType<typeof epochWorldCalendarMoment>;
  readonly timeBasis: typeof EPOCH_WORLD_CLOCK_TIME_BASIS | "legacy_event_tick";
  readonly speedRatio: number;
  readonly serverEpochAt?: string;
  readonly observedAtRealTime?: string;
  readonly timelineCycle: EpochTimelineCycleState;
  readonly version: number;
  readonly lastEventId?: string;
  readonly lastAdvancedAt?: string;
  readonly lastReason?: string;
  readonly ruleVersion: EpochWorldClockRuleVersion;
}

export interface AdvanceEpochWorldClockInput {
  readonly elapsedWorldMinutes: number;
  readonly reason: string;
  readonly processedDomains: readonly string[];
  readonly sourceEventIds?: readonly string[];
  readonly idempotencyKey: string;
  readonly causationId?: string;
  readonly correlationId?: string;
}

export interface SyncEpochWorldClockInput {
  readonly reason: string;
  readonly processedDomains: readonly string[];
  readonly sourceEventIds?: readonly string[];
  readonly idempotencyKey: string;
  readonly causationId?: string;
  readonly correlationId?: string;
}

export interface EpochWorldClockAdvanceResult {
  readonly clock: EpochWorldClockState;
  readonly events: readonly EpochEvent[];
  readonly duplicate: boolean;
}

export interface CreateEpochWorldClockRuntimeOptions {
  readonly initialEvents?: readonly EpochEvent[];
  readonly idFactory?: EpochIdFactory;
  readonly nowReal?: () => Date | string;
  readonly speedRatio?: number;
  readonly onEvents?: (events: readonly EpochEvent[]) => void;
}

export function epochTimelineCycleState(worldMinute: number): EpochTimelineCycleState {
  if (!Number.isSafeInteger(worldMinute) || worldMinute < 0) throw new Error("world_minute_invalid");
  const completedCycles = Math.floor(worldMinute / EPOCH_TIMELINE_CYCLE_WORLD_MINUTES);
  const startsAtWorldMinute = completedCycles * EPOCH_TIMELINE_CYCLE_WORLD_MINUTES;
  return {
    cycleId: `timeline_cycle_${String(completedCycles + 1).padStart(4, "0")}`,
    index: completedCycles + 1,
    yearsPerCycle: EPOCH_TIMELINE_CYCLE_YEARS,
    startsAtWorldMinute,
    endsAtWorldMinute: startsAtWorldMinute + EPOCH_TIMELINE_CYCLE_WORLD_MINUTES,
    minuteInCycle: worldMinute - startsAtWorldMinute,
    completedCycles,
    realMinutesPerCycle: EPOCH_TIMELINE_CYCLE_REAL_MINUTES,
  };
}

function crossedTimelineCycleIds(fromWorldMinute: number, toWorldMinute: number): readonly string[] {
  const firstBoundary = Math.floor(fromWorldMinute / EPOCH_TIMELINE_CYCLE_WORLD_MINUTES) + 1;
  const lastBoundary = Math.floor(toWorldMinute / EPOCH_TIMELINE_CYCLE_WORLD_MINUTES);
  if (lastBoundary < firstBoundary) return [];
  return Array.from({ length: lastBoundary - firstBoundary + 1 }, (_, index) =>
    `timeline_cycle_${String(firstBoundary + index).padStart(4, "0")}`);
}

function publicState(input: {
  readonly initialized: boolean;
  readonly worldMinute: number;
  readonly persistedWorldMinute?: number;
  readonly version: number;
  readonly ruleVersion?: EpochWorldClockRuleVersion;
  readonly timeBasis?: EpochWorldClockState["timeBasis"];
  readonly speedRatio?: number;
  readonly serverEpochAt?: string;
  readonly observedAtRealTime?: string;
  readonly last?: {
    readonly eventId: string;
    readonly createdAt: string;
    readonly reason?: string;
  };
}): EpochWorldClockState {
  const persistedWorldMinute = input.persistedWorldMinute ?? input.worldMinute;
  const worldTime = epochWorldTimeFromMinute(input.worldMinute);
  return {
    clockId: EPOCH_WORLD_CLOCK_ID,
    initialized: input.initialized,
    worldMinute: input.worldMinute,
    persistedWorldMinute,
    pendingCatchUpWorldMinutes: Math.max(0, input.worldMinute - persistedWorldMinute),
    worldTime,
    displayTime: formatEpochWorldTime(worldTime),
    calendar: epochWorldCalendarMoment(worldTime),
    timeBasis: input.timeBasis ?? EPOCH_WORLD_CLOCK_TIME_BASIS,
    speedRatio: input.speedRatio ?? EPOCH_WORLD_CLOCK_SPEED_RATIO,
    ...(input.serverEpochAt ? { serverEpochAt: input.serverEpochAt } : {}),
    ...(input.observedAtRealTime ? { observedAtRealTime: input.observedAtRealTime } : {}),
    timelineCycle: epochTimelineCycleState(input.worldMinute),
    version: input.version,
    ...(input.last ? {
      lastEventId: input.last.eventId,
      lastAdvancedAt: input.last.createdAt,
      ...(input.last.reason ? { lastReason: input.last.reason } : {}),
    } : {}),
    ruleVersion: input.ruleVersion ?? EPOCH_WORLD_CLOCK_RULE_VERSION,
  };
}

function worldClockEvent(event: EpochEvent) {
  return event.aggregateType === "world_clock" && event.aggregateId === EPOCH_WORLD_CLOCK_ID;
}

function commandHash(input: Omit<AdvanceEpochWorldClockInput, "idempotencyKey" | "causationId" | "correlationId">) {
  const payload = JSON.stringify({
    elapsedWorldMinutes: input.elapsedWorldMinutes,
    processedDomains: [...input.processedDomains].sort(),
    reason: input.reason,
    sourceEventIds: [...(input.sourceEventIds || [])].sort(),
  });
  return `sha256:${createHash("sha256").update(payload).digest("hex")}` as const;
}

function syncCommandHash(input: Omit<SyncEpochWorldClockInput, "idempotencyKey" | "causationId" | "correlationId">) {
  const payload = JSON.stringify({
    processedDomains: [...input.processedDomains].sort(),
    reason: input.reason,
    sourceEventIds: [...(input.sourceEventIds || [])].sort(),
    timeBasis: EPOCH_WORLD_CLOCK_TIME_BASIS,
  });
  return `sha256:${createHash("sha256").update(payload).digest("hex")}` as const;
}

function assertWholeMinute(value: unknown): number {
  if (!Number.isSafeInteger(value) || Number(value) < 1 || Number(value) > MAX_WORLD_CLOCK_ADVANCE_MINUTES) {
    throw new Error("world_clock_elapsed_minutes_invalid");
  }
  return Number(value);
}

function assertText(value: unknown, error: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(error);
  return value.trim();
}

function normalizedStringList(value: readonly string[] | undefined, error: string, required: boolean): readonly string[] {
  if (!Array.isArray(value)) throw new Error(error);
  const result = [...new Set(value.map((item) => assertText(item, error)))].sort();
  if (required && result.length === 0) throw new Error(error);
  return result;
}

function validSpeedRatio(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 1 && Number(value) <= 100_000;
}

function assertInitializedPayload(event: EpochEvent) {
  if (event.eventType !== "world_clock_initialized") throw new Error("world_clock_initialization_event_required");
  const payload = event.payload;
  if (payload.clockId !== EPOCH_WORLD_CLOCK_ID
    || payload.worldMinute !== 0
    || payload.worldTime !== epochWorldTimeFromMinute(0)
    || (payload.ruleVersion !== EPOCH_WORLD_CLOCK_RULE_VERSION
      && payload.ruleVersion !== EPOCH_WORLD_CLOCK_LEGACY_RULE_VERSION)) {
    throw new Error("world_clock_initialization_invalid");
  }
  if (payload.ruleVersion === EPOCH_WORLD_CLOCK_RULE_VERSION
    && (payload.timeBasis !== EPOCH_WORLD_CLOCK_TIME_BASIS
      || !validSpeedRatio(payload.speedRatio)
      || !payload.serverEpochAt
      || !Number.isFinite(Date.parse(payload.serverEpochAt))
      || payload.timelineCycleYears !== EPOCH_TIMELINE_CYCLE_YEARS
      || !payload.commandHash
      || !/^sha256:[0-9a-f]{64}$/u.test(payload.commandHash))) {
    throw new Error("world_clock_initialization_invalid");
  }
}

function assertAdvancePayload(event: EpochEvent, state: EpochWorldClockState) {
  if (event.eventType !== "world_clock_advanced") throw new Error("world_clock_advance_event_required");
  const payload = event.payload;
  const elapsed = assertWholeMinute(payload.elapsedWorldMinutes);
  if (payload.clockId !== EPOCH_WORLD_CLOCK_ID
    || (payload.ruleVersion !== EPOCH_WORLD_CLOCK_RULE_VERSION
      && payload.ruleVersion !== EPOCH_WORLD_CLOCK_LEGACY_RULE_VERSION)
    || (state.ruleVersion === EPOCH_WORLD_CLOCK_RULE_VERSION
      && payload.ruleVersion !== EPOCH_WORLD_CLOCK_RULE_VERSION)
    || payload.fromWorldMinute !== state.persistedWorldMinute
    || payload.toWorldMinute !== state.persistedWorldMinute + elapsed
    || payload.fromWorldTime !== epochWorldTimeFromMinute(payload.fromWorldMinute)
    || payload.toWorldTime !== epochWorldTimeFromMinute(payload.toWorldMinute)
    || !/^sha256:[0-9a-f]{64}$/u.test(payload.commandHash)) {
    throw new Error(`world_clock_event_sequence_invalid:${event.eventId}`);
  }
  if (payload.ruleVersion === EPOCH_WORLD_CLOCK_RULE_VERSION) {
    const expectedCycles = crossedTimelineCycleIds(payload.fromWorldMinute, payload.toWorldMinute);
    if (payload.timeBasis !== EPOCH_WORLD_CLOCK_TIME_BASIS
      || !validSpeedRatio(payload.speedRatio)
      || !payload.serverEpochAt
      || !Number.isFinite(Date.parse(payload.serverEpochAt))
      || payload.timelineCycleYears !== EPOCH_TIMELINE_CYCLE_YEARS
      || JSON.stringify(payload.crossedTimelineCycleIds || []) !== JSON.stringify(expectedCycles)
      || (state.serverEpochAt && payload.serverEpochAt !== state.serverEpochAt)) {
      throw new Error(`world_clock_event_sequence_invalid:${event.eventId}`);
    }
  }
  assertText(payload.reason, "world_clock_reason_required");
  normalizedStringList(payload.processedDomains, "world_clock_processed_domains_required", true);
  normalizedStringList(payload.sourceEventIds, "world_clock_source_events_invalid", false);
}

export function projectEpochWorldClock(events: readonly EpochEvent[]): EpochWorldClockState {
  let state = publicState({ initialized: false, worldMinute: 0, version: 0 });
  let last: { eventId: string; createdAt: string; reason?: string } | undefined;
  for (const event of events.filter(worldClockEvent)) {
    if (event.eventType === "world_clock_initialized") {
      if (state.initialized) throw new Error("world_clock_initialized_twice");
      assertInitializedPayload(event);
      last = { eventId: event.eventId, createdAt: event.createdAt };
      const isCurrent = event.payload.ruleVersion === EPOCH_WORLD_CLOCK_RULE_VERSION;
      const ruleVersion = isCurrent
        ? EPOCH_WORLD_CLOCK_RULE_VERSION
        : EPOCH_WORLD_CLOCK_LEGACY_RULE_VERSION;
      state = publicState({
        initialized: true,
        worldMinute: 0,
        version: state.version + 1,
        last,
        ruleVersion,
        timeBasis: isCurrent ? EPOCH_WORLD_CLOCK_TIME_BASIS : "legacy_event_tick",
        speedRatio: isCurrent ? Number(event.payload.speedRatio) : 1,
        ...(isCurrent ? { serverEpochAt: event.payload.serverEpochAt } : {}),
      });
      continue;
    }
    if (event.eventType === "world_clock_advanced") {
      if (!state.initialized) throw new Error("world_clock_advance_before_initialization");
      assertAdvancePayload(event, state);
      last = { eventId: event.eventId, createdAt: event.createdAt, reason: event.payload.reason };
      const isCurrent = event.payload.ruleVersion === EPOCH_WORLD_CLOCK_RULE_VERSION;
      const ruleVersion = isCurrent
        ? EPOCH_WORLD_CLOCK_RULE_VERSION
        : EPOCH_WORLD_CLOCK_LEGACY_RULE_VERSION;
      state = publicState({
        initialized: true,
        worldMinute: event.payload.toWorldMinute,
        version: state.version + 1,
        last,
        ruleVersion,
        timeBasis: isCurrent ? EPOCH_WORLD_CLOCK_TIME_BASIS : "legacy_event_tick",
        speedRatio: isCurrent ? Number(event.payload.speedRatio) : 1,
        ...(isCurrent ? { serverEpochAt: event.payload.serverEpochAt } : {}),
      });
      continue;
    }
    throw new Error(`world_clock_event_type_invalid:${event.eventType}`);
  }
  return state;
}

function isoNow(nowReal: () => Date | string): string {
  const value = nowReal();
  const timestamp = value instanceof Date ? value.getTime() : Date.parse(value);
  if (!Number.isFinite(timestamp)) throw new Error("world_clock_audit_time_invalid");
  return new Date(timestamp).toISOString();
}

export function createEpochWorldClockRuntime(options: CreateEpochWorldClockRuntimeOptions = {}) {
  const idFactory: EpochIdFactory = options.idFactory || ((kind) => `${kind}_world_clock_${randomUUID()}`);
  const nowReal = options.nowReal || (() => new Date());
  const speedRatio = options.speedRatio ?? EPOCH_WORLD_CLOCK_SPEED_RATIO;
  if (!validSpeedRatio(speedRatio)) throw new Error("world_clock_speed_ratio_invalid");
  const bootObservedAt = isoNow(nowReal);
  const clockEvents: EpochEvent[] = (options.initialEvents || []).filter(worldClockEvent);
  let state = projectEpochWorldClock(clockEvents);
  const priorCommands = new Map<string, {
    readonly commandHash: string;
    readonly toWorldMinute: number;
    readonly clock: EpochWorldClockState;
  }>();

  function serverEpochAtFor(projected: EpochWorldClockState) {
    if (projected.serverEpochAt) return projected.serverEpochAt;
    const anchorAt = projected.lastAdvancedAt || bootObservedAt;
    const anchorMs = Date.parse(anchorAt);
    const elapsedRealMs = projected.persistedWorldMinute * 60_000 / speedRatio;
    return new Date(anchorMs - elapsedRealMs).toISOString();
  }

  function authoritativeWorldMinute(projected: EpochWorldClockState, observedAt: string) {
    const elapsedRealMs = Math.max(0, Date.parse(observedAt) - Date.parse(serverEpochAtFor(projected)));
    const minute = Math.floor(elapsedRealMs * speedRatio / 60_000);
    if (!Number.isSafeInteger(minute)) throw new Error("world_minute_invalid");
    return Math.max(projected.persistedWorldMinute, minute);
  }

  function runtimeState(projected = state, observedAt = isoNow(nowReal)) {
    return publicState({
      initialized: projected.initialized,
      worldMinute: authoritativeWorldMinute(projected, observedAt),
      persistedWorldMinute: projected.persistedWorldMinute,
      version: projected.version,
      ruleVersion: EPOCH_WORLD_CLOCK_RULE_VERSION,
      timeBasis: EPOCH_WORLD_CLOCK_TIME_BASIS,
      speedRatio,
      serverEpochAt: serverEpochAtFor(projected),
      observedAtRealTime: observedAt,
      ...(projected.lastEventId && projected.lastAdvancedAt ? { last: {
        eventId: projected.lastEventId,
        createdAt: projected.lastAdvancedAt,
        ...(projected.lastReason ? { reason: projected.lastReason } : {}),
      } } : {}),
    });
  }

  function rebuild() {
    state = projectEpochWorldClock(clockEvents);
    priorCommands.clear();
    const replayedEvents: EpochEvent[] = [];
    for (const event of clockEvents) {
      replayedEvents.push(event);
      if (event.eventType === "world_clock_advanced" && event.idempotencyKey) {
        const existing = priorCommands.get(event.idempotencyKey);
        if (existing && (existing.commandHash !== event.payload.commandHash
          || existing.toWorldMinute !== event.payload.toWorldMinute)) {
          throw new Error(`world_clock_idempotency_history_conflict:${event.idempotencyKey}`);
        }
        priorCommands.set(event.idempotencyKey, {
          commandHash: event.payload.commandHash,
          toWorldMinute: event.payload.toWorldMinute,
          clock: runtimeState(projectEpochWorldClock(replayedEvents), event.createdAt),
        });
      } else if (event.eventType === "world_clock_initialized"
        && event.idempotencyKey
        && event.payload.commandHash) {
        priorCommands.set(event.idempotencyKey, {
          commandHash: event.payload.commandHash,
          toWorldMinute: 0,
          clock: runtimeState(projectEpochWorldClock(replayedEvents), event.createdAt),
        });
      }
    }
  }
  rebuild();

  function rollback(eventCount: number) {
    if (!Number.isSafeInteger(eventCount) || eventCount < 0 || eventCount > clockEvents.length) {
      throw new Error("world_clock_checkpoint_invalid");
    }
    clockEvents.splice(eventCount);
    rebuild();
  }

  function context(input: AdvanceEpochWorldClockInput | SyncEpochWorldClockInput, suffix = ""): EpochCommandContext {
    return {
      actorExplorerId: "system-world-clock",
      trustClass: "system_worker",
      idempotencyKey: `${input.idempotencyKey}${suffix}`,
      causationId: input.causationId,
      correlationId: input.correlationId,
    };
  }

  function apply(events: readonly EpochEvent[]) {
    const nextState = projectEpochWorldClock([...clockEvents, ...events]);
    options.onEvents?.(events);
    clockEvents.push(...events);
    state = nextState;
  }

  function initialize(
    input: AdvanceEpochWorldClockInput | SyncEpochWorldClockInput,
    createdAt: string,
    expectedHash: `sha256:${string}`,
    suffix: string,
  ) {
    if (state.initialized) return undefined;
    const initialized = createEpochEvent({
      eventType: "world_clock_initialized",
      aggregateType: "world_clock",
      aggregateId: EPOCH_WORLD_CLOCK_ID,
      context: context(input, suffix),
      createdAt,
      idFactory,
      payload: {
        clockId: EPOCH_WORLD_CLOCK_ID,
        worldMinute: 0,
        worldTime: epochWorldTimeFromMinute(0),
        ruleVersion: EPOCH_WORLD_CLOCK_RULE_VERSION,
        timeBasis: EPOCH_WORLD_CLOCK_TIME_BASIS,
        speedRatio,
        serverEpochAt: serverEpochAtFor(state),
        timelineCycleYears: EPOCH_TIMELINE_CYCLE_YEARS,
        commandHash: expectedHash,
      },
    });
    apply([initialized]);
    return initialized;
  }

  function advancedEvent(input: {
    readonly command: AdvanceEpochWorldClockInput | SyncEpochWorldClockInput;
    readonly elapsedWorldMinutes: number;
    readonly reason: string;
    readonly processedDomains: readonly string[];
    readonly sourceEventIds: readonly string[];
    readonly expectedHash: `sha256:${string}`;
    readonly createdAt: string;
  }) {
    const fromWorldMinute = state.persistedWorldMinute;
    const toWorldMinute = fromWorldMinute + input.elapsedWorldMinutes;
    const payload: WorldClockAdvancedPayload = {
      clockId: EPOCH_WORLD_CLOCK_ID,
      fromWorldMinute,
      toWorldMinute,
      fromWorldTime: epochWorldTimeFromMinute(fromWorldMinute),
      toWorldTime: epochWorldTimeFromMinute(toWorldMinute),
      elapsedWorldMinutes: input.elapsedWorldMinutes,
      reason: input.reason,
      processedDomains: input.processedDomains,
      sourceEventIds: input.sourceEventIds,
      ruleVersion: EPOCH_WORLD_CLOCK_RULE_VERSION,
      commandHash: input.expectedHash,
      timeBasis: EPOCH_WORLD_CLOCK_TIME_BASIS,
      speedRatio,
      serverEpochAt: serverEpochAtFor(state),
      timelineCycleYears: EPOCH_TIMELINE_CYCLE_YEARS,
      crossedTimelineCycleIds: crossedTimelineCycleIds(fromWorldMinute, toWorldMinute),
    };
    return createEpochEvent({
      eventType: "world_clock_advanced",
      aggregateType: "world_clock",
      aggregateId: EPOCH_WORLD_CLOCK_ID,
      context: context(input.command),
      createdAt: input.createdAt,
      idFactory,
      payload,
    });
  }

  function advance(input: AdvanceEpochWorldClockInput): EpochWorldClockAdvanceResult {
    const elapsedWorldMinutes = assertWholeMinute(input.elapsedWorldMinutes);
    const reason = assertText(input.reason, "world_clock_reason_required");
    const processedDomains = normalizedStringList(
      input.processedDomains,
      "world_clock_processed_domains_required",
      true,
    );
    const sourceEventIds = normalizedStringList(
      input.sourceEventIds || [],
      "world_clock_source_events_invalid",
      false,
    );
    const idempotencyKey = assertText(input.idempotencyKey, "idempotency_key_required");
    const expectedHash = commandHash({ elapsedWorldMinutes, reason, processedDomains, sourceEventIds });
    const prior = priorCommands.get(idempotencyKey);
    if (prior) {
      if (prior.commandHash !== expectedHash) throw new Error("idempotency_key_conflict");
      return attachEpochEventsForPersistence({ clock: prior.clock, events: [], duplicate: true }, []);
    }
    const createdAt = isoNow(nowReal);
    const events: EpochEvent[] = [];
    const initialized = initialize({ ...input, idempotencyKey }, createdAt, expectedHash, ":initialize");
    if (initialized) events.push(initialized);
    const advanced = advancedEvent({
      command: { ...input, idempotencyKey },
      elapsedWorldMinutes,
      reason,
      processedDomains,
      sourceEventIds,
      expectedHash,
      createdAt,
    });
    events.push(advanced);
    apply([advanced]);
    const clock = runtimeState(state, createdAt);
    priorCommands.set(idempotencyKey, {
      commandHash: expectedHash,
      toWorldMinute: advanced.payload.toWorldMinute,
      clock,
    });
    return attachEpochEventsForPersistence({ clock, events, duplicate: false }, events);
  }

  function sync(input: SyncEpochWorldClockInput): EpochWorldClockAdvanceResult {
    const reason = assertText(input.reason, "world_clock_reason_required");
    const processedDomains = normalizedStringList(
      input.processedDomains,
      "world_clock_processed_domains_required",
      true,
    );
    const sourceEventIds = normalizedStringList(
      input.sourceEventIds || [],
      "world_clock_source_events_invalid",
      false,
    );
    const idempotencyKey = assertText(input.idempotencyKey, "idempotency_key_required");
    const expectedHash = syncCommandHash({ reason, processedDomains, sourceEventIds });
    const prior = priorCommands.get(idempotencyKey);
    if (prior) {
      if (prior.commandHash !== expectedHash) throw new Error("idempotency_key_conflict");
      return attachEpochEventsForPersistence({ clock: prior.clock, events: [], duplicate: true }, []);
    }
    const createdAt = isoNow(nowReal);
    const targetWorldMinute = authoritativeWorldMinute(state, createdAt);
    const pendingWorldMinutes = Math.max(0, targetWorldMinute - state.persistedWorldMinute);
    const elapsedWorldMinutes = Math.min(pendingWorldMinutes, MAX_WORLD_CLOCK_ADVANCE_MINUTES);
    const events: EpochEvent[] = [];
    const initialized = initialize(
      { ...input, idempotencyKey },
      createdAt,
      expectedHash,
      elapsedWorldMinutes > 0 ? ":initialize" : "",
    );
    if (initialized) events.push(initialized);
    if (elapsedWorldMinutes > 0) {
      const advanced = advancedEvent({
        command: { ...input, idempotencyKey },
        elapsedWorldMinutes,
        reason,
        processedDomains,
        sourceEventIds,
        expectedHash,
        createdAt,
      });
      events.push(advanced);
      apply([advanced]);
    }
    const clock = runtimeState(state, createdAt);
    priorCommands.set(idempotencyKey, {
      commandHash: expectedHash,
      toWorldMinute: state.persistedWorldMinute,
      clock,
    });
    return attachEpochEventsForPersistence({ clock, events, duplicate: false }, events);
  }

  return {
    status: () => runtimeState(),
    nowWorldTime: () => runtimeState().worldTime,
    advance,
    sync,
    checkpoint: () => clockEvents.length,
    rollback,
    resultForIdempotencyKey: (idempotencyKey: string) => priorCommands.get(idempotencyKey),
    events: () => [...clockEvents],
  };
}
