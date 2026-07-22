import assert from "node:assert/strict";
import test from "node:test";

import { phase6EventsAfterCursor } from "../lib/epoch/phase6EventWindowRules.ts";

const event = (eventId: string, createdAt: string) => ({ eventId, createdAt });

test("Phase 6 event window returns only events after the persisted baseline", () => {
  const result = phase6EventsAfterCursor([
    event("event_0004", "2026-01-01T00:00:02.000Z"),
    event("event_0001", "2026-01-01T00:00:00.000Z"),
    event("event_0003", "2026-01-01T00:00:01.000Z"),
    event("event_0002", "2026-01-01T00:00:01.000Z"),
  ], {
    eventCount: 2,
    lastEventId: "event_0002",
    lastCreatedAt: "2026-01-01T00:00:01.000Z",
  });

  assert.deepEqual(result.map((entry) => entry.eventId), ["event_0003", "event_0004"]);
});

test("Phase 6 event window falls back to the cursor watermark when history is truncated", () => {
  const result = phase6EventsAfterCursor([
    event("event_0102", "2026-01-01T00:10:01.000Z"),
    event("event_0101", "2026-01-01T00:10:00.000Z"),
  ], {
    eventCount: 100,
    lastEventId: "event_0100",
    lastCreatedAt: "2026-01-01T00:09:59.000Z",
  });

  assert.deepEqual(result.map((entry) => entry.eventId), ["event_0101", "event_0102"]);
});

test("Phase 6 event window fails closed when a non-empty cursor has no watermark", () => {
  assert.throws(
    () => phase6EventsAfterCursor([event("event_0002", "2026-01-01T00:00:01.000Z")], { eventCount: 1 }),
    /phase6_event_window_cursor_watermark_missing/,
  );
});
