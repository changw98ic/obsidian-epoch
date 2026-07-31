import type { EpochEvent } from "./events.ts";

/**
 * A Phase 6 retrieval happens after the journey has started.  Its evidence
 * must cite the first canonical event for that exact journey, never an
 * arbitrary event from the identity's earlier history.
 */
export function phase6RagRunAnchorEventIds(
  events: readonly EpochEvent[],
  journeyId: string,
): readonly string[] {
  const normalizedJourneyId = journeyId.trim();
  if (!normalizedJourneyId) throw new Error("phase6_rag_trace_journey_binding_missing");

  const matches = events
    .filter((event) =>
      event.aggregateId === normalizedJourneyId
      || event.causationId === normalizedJourneyId
      || event.correlationId === `journey:${normalizedJourneyId}`)
    .sort((left, right) =>
      left.createdAt.localeCompare(right.createdAt)
      || left.eventId.localeCompare(right.eventId));

  return matches.length > 0 ? [matches[0]!.eventId] : [];
}
