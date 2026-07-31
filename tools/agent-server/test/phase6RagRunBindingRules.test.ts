import assert from "node:assert/strict";
import test from "node:test";

import type { EpochEvent } from "../lib/epoch/events.ts";
import { phase6RagRunAnchorEventIds } from "../lib/epoch/phase6RagRunBindingRules.ts";

function event(input: {
  readonly eventId: string;
  readonly createdAt: string;
  readonly aggregateId?: string;
  readonly causationId?: string;
  readonly correlationId?: string;
}): EpochEvent {
  return {
    eventId: input.eventId,
    eventType: "identity_issued",
    aggregateType: "identity",
    aggregateId: input.aggregateId ?? "identity-1",
    actorExplorerId: "explorer-1",
    trustClass: "system_worker",
    causationId: input.causationId ?? "unrelated-command",
    correlationId: input.correlationId ?? "unrelated-correlation",
    createdAt: input.createdAt,
    payload: {
      agentId: "agent-1",
      explorerId: "explorer-1",
      identityName: "Phase 6 test identity",
      status: "active",
      reincarnation: 1,
    },
  } as EpochEvent;
}

test("Phase 6 RAG run anchors select only the first canonical event for the current journey", () => {
  const anchors = phase6RagRunAnchorEventIds([
    event({
      eventId: "old-run-event",
      createdAt: "2026-07-21T00:00:00.000Z",
      causationId: "journey-old",
      correlationId: "journey:journey-old",
    }),
    event({
      eventId: "current-later",
      createdAt: "2026-07-21T00:02:00.000Z",
      causationId: "journey-current",
      correlationId: "journey:journey-current",
    }),
    event({
      eventId: "current-start",
      createdAt: "2026-07-21T00:01:00.000Z",
      causationId: "journey-current",
      correlationId: "journey:journey-current",
    }),
  ], "journey-current");

  assert.deepEqual(anchors, ["current-start"]);
});

test("Phase 6 RAG run anchors reject an empty journey binding and do not fall back to identity history", () => {
  const historical = [event({
    eventId: "identity-history",
    createdAt: "2026-07-21T00:00:00.000Z",
  })];

  assert.deepEqual(phase6RagRunAnchorEventIds(historical, "journey-current"), []);
  assert.throws(
    () => phase6RagRunAnchorEventIds(historical, ""),
    /phase6_rag_trace_journey_binding_missing/,
  );
});
