export interface Phase6EventWindowCursor {
  readonly eventCount: number;
  readonly lastEventId?: string;
  readonly lastCreatedAt?: string;
}

export interface Phase6EventWindowEvent {
  readonly eventId: string;
  readonly createdAt: string;
}

function compareEvents(left: Phase6EventWindowEvent, right: Phase6EventWindowEvent): number {
  return left.createdAt.localeCompare(right.createdAt) || left.eventId.localeCompare(right.eventId);
}

export function phase6EventsAfterCursor<TEvent extends Phase6EventWindowEvent>(
  events: readonly TEvent[],
  cursor: Phase6EventWindowCursor,
): readonly TEvent[] {
  if (!Number.isSafeInteger(cursor.eventCount) || cursor.eventCount < 0) {
    throw new Error("phase6_event_window_cursor_event_count_invalid");
  }
  const sorted = [...events].sort(compareEvents);
  if (cursor.eventCount === 0) return sorted;

  const lastEventId = cursor.lastEventId?.trim();
  const lastCreatedAt = cursor.lastCreatedAt?.trim();
  if (lastEventId) {
    const baselineIndex = sorted.findIndex((event) => event.eventId === lastEventId);
    if (baselineIndex >= 0) return sorted.slice(baselineIndex + 1);
  }
  if (!lastCreatedAt) {
    throw new Error("phase6_event_window_cursor_watermark_missing");
  }
  return sorted.filter((event) =>
    event.createdAt > lastCreatedAt
      || (event.createdAt === lastCreatedAt && Boolean(lastEventId) && event.eventId > lastEventId!),
  );
}
