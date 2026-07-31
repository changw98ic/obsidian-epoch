import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { applyUpcasters, upcastEvent } from "../lib/epoch/eventUpcasters.ts";
import type { EpochEvent } from "../lib/epoch/events.ts";

function makeEvent(eventType: string, payload: Record<string, unknown>): EpochEvent {
  return {
    eventId: `evt-${Date.now()}`,
    eventType,
    aggregateId: "agg-1",
    agentId: "agent-1",
    createdAt: new Date().toISOString(),
    payload,
  } as EpochEvent;
}

describe("event upcasters", () => {
  it("v2 journey_world_solidified is not modified", () => {
    const payload = {
      schemaVersion: 2,
      journeyId: "j-1",
      solidifiedAt: new Date().toISOString(),
      mirrorLedgerPromotions: [{ entryId: "e1", canonicalEventId: "c1" }],
    };
    const result = applyUpcasters("journey_world_solidified", payload);
    assert.strictEqual(result, payload, "should return same object reference");
    assert.equal(result.schemaVersion, 2);
  });

  it("v1 journey_world_solidified with mirrorLedgerPromotedEntryIds is marked unresolved", () => {
    const payload = {
      journeyId: "j-2",
      solidifiedAt: new Date().toISOString(),
      mirrorLedgerPromotedEntryIds: ["entry-1", "entry-2"],
      effectEventIds: ["effect-1", "effect-2"],
    };
    const result = applyUpcasters("journey_world_solidified", payload);
    assert.equal(result.schemaVersion, 2);
    assert.deepEqual(result.mirrorLedgerPromotions, []);
    assert.equal(result._unresolvedV1Migration, true);
    assert.ok(typeof result._unresolvedReason === "string");
    // Original field preserved for downstream fallback
    assert.deepEqual(result.mirrorLedgerPromotedEntryIds, ["entry-1", "entry-2"]);
  });

  it("v1 journey_world_solidified without mirrorLedgerPromotedEntryIds gets schemaVersion 2", () => {
    const payload = {
      journeyId: "j-3",
      solidifiedAt: new Date().toISOString(),
    };
    const result = applyUpcasters("journey_world_solidified", payload);
    assert.equal(result.schemaVersion, 2);
    assert.equal(result._unresolvedV1Migration, undefined);
  });

  it("upcastEvent returns new event when payload changes", () => {
    const event = makeEvent("journey_world_solidified", {
      journeyId: "j-4",
      mirrorLedgerPromotedEntryIds: ["e1"],
    });
    const result = upcastEvent(event);
    assert.notStrictEqual(result, event, "should return new event object");
    assert.equal((result.payload as Record<string, unknown>).schemaVersion, 2);
    assert.equal((result.payload as Record<string, unknown>)._unresolvedV1Migration, true);
  });

  it("upcastEvent returns same event when no upcast needed", () => {
    const event = makeEvent("journey_world_solidified", {
      schemaVersion: 2,
      journeyId: "j-5",
      mirrorLedgerPromotions: [],
    });
    const result = upcastEvent(event);
    assert.strictEqual(result, event, "should return same event reference");
  });

  it("upcastEvent ignores unknown event types", () => {
    const event = makeEvent("unknown_event_type", {
      agentId: "a-1",
      explorerId: "e-1",
    });
    const result = upcastEvent(event);
    assert.strictEqual(result, event);
  });

  it("upcasters are idempotent", () => {
    const payload = {
      journeyId: "j-6",
      mirrorLedgerPromotedEntryIds: ["e1"],
    };
    const first = applyUpcasters("journey_world_solidified", payload);
    const second = applyUpcasters("journey_world_solidified", first);
    assert.equal(first.schemaVersion, 2);
    assert.equal(second.schemaVersion, 2);
    assert.equal(second._unresolvedV1Migration, true);
  });

  it("mixed v1/v2 batch each handled correctly", () => {
    const v1Payload = {
      journeyId: "j-7",
      mirrorLedgerPromotedEntryIds: ["e1"],
    };
    const v2Payload = {
      schemaVersion: 2,
      journeyId: "j-8",
      mirrorLedgerPromotions: [{ entryId: "e2", canonicalEventId: "c2" }],
    };

    const v1Result = applyUpcasters("journey_world_solidified", v1Payload);
    const v2Result = applyUpcasters("journey_world_solidified", v2Payload);

    assert.equal(v1Result.schemaVersion, 2);
    assert.equal(v1Result._unresolvedV1Migration, true);
    assert.equal(v2Result.schemaVersion, 2);
    assert.equal(v2Result._unresolvedV1Migration, undefined);
    assert.deepEqual(v2Result.mirrorLedgerPromotions, [{ entryId: "e2", canonicalEventId: "c2" }]);
  });
});
