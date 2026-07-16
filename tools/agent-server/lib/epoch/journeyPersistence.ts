import type { JourneyRuntimeEvent } from "./journeyReadModel.ts";

const JOURNEY_EVENTS_FOR_PERSISTENCE = Symbol("journeyEventsForPersistence");

type ResultWithJourneyEvents = {
  readonly [JOURNEY_EVENTS_FOR_PERSISTENCE]?: readonly JourneyRuntimeEvent[];
  readonly journeyEvents?: readonly JourneyRuntimeEvent[];
};

export function journeyEventsForPersistence(result: unknown): readonly JourneyRuntimeEvent[] {
  if (!result || typeof result !== "object") return [];
  const record = result as ResultWithJourneyEvents;
  return record[JOURNEY_EVENTS_FOR_PERSISTENCE]
    || (Array.isArray(record.journeyEvents) ? record.journeyEvents : []);
}

export function attachJourneyEventsForPersistence<TResult extends object>(
  result: TResult,
  events: readonly JourneyRuntimeEvent[],
): TResult {
  Object.defineProperty(result, JOURNEY_EVENTS_FOR_PERSISTENCE, {
    value: events,
    enumerable: false,
    configurable: true,
  });
  return result;
}

export function mergeJourneyEventsForPersistence<TResult extends object>(
  result: TResult,
  ...sources: readonly unknown[]
): TResult {
  const seen = new Set<string>();
  const events: JourneyRuntimeEvent[] = [];
  for (const source of sources) {
    for (const event of journeyEventsForPersistence(source)) {
      if (seen.has(event.eventId)) continue;
      seen.add(event.eventId);
      events.push(event);
    }
  }
  return attachJourneyEventsForPersistence(result, events);
}
