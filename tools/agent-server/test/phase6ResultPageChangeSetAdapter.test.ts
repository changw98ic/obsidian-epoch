import assert from "node:assert/strict";
import test from "node:test";

import { buildPhase6RagDelta } from "../lib/epoch/phase6ProjectionDeltaRules.ts";
import { buildPhase6ProgressionChangeSet } from "../lib/epoch/phase6ResultPageChangeSetAdapter.ts";

test("Phase 6 progression ignores practice event history and cursor metadata", () => {
  const canonicalProgression = {
    skills: { learnedNodeIds: ["skill_survey"], proficiency: { skill_survey: 3 } },
    talents: [{ talentId: "talent_patient" }],
    cultivation: {
      functionalStage: { stageId: "stage_1", bottleneck: "none" },
      resources: { insight: 12 },
    },
    injuries: { status: { injured: false }, injuries: [] },
  };
  const before = {
    attributes: { strength: 10, agility: 11 },
    progression: {
      ...canonicalProgression,
      practice: {
        latestEvents: [{ eventId: "event_before" }],
        cursor: { eventId: "event_before", sequence: 6 },
      },
    },
  };
  const after = {
    attributes: { strength: 10, agility: 11 },
    progression: {
      ...canonicalProgression,
      cultivation: {
        ...canonicalProgression.cultivation,
        resources: {
          insight: 99,
          materials: [{ materialId: "cultivation-core", quantity: 1 }],
        },
      },
      injuries: { status: { injured: true }, injuries: [{ id: "injury_after" }] },
      practice: {
        latestEvents: [{ eventId: "event_after" }],
        cursor: { eventId: "event_after", sequence: 7 },
      },
    },
  };

  const metadataOnly = buildPhase6ProgressionChangeSet({
    receiptId: "receipt_progression_metadata",
    beforeSnapshotBody: before,
    afterSnapshotBody: after,
    canonicalEventIds: ["event_after"],
  });
  assert.equal(metadataOnly.mode, "no_change");
  assert.equal(metadataOnly.noChangeReason, "canonical_progression_equal");
  assert.deepEqual(metadataOnly.changes, []);

  const realGrowth = buildPhase6ProgressionChangeSet({
    receiptId: "receipt_progression_growth",
    beforeSnapshotBody: before,
    afterSnapshotBody: { ...after, attributes: { strength: 11, agility: 11 } },
    canonicalEventIds: ["event_growth"],
  });
  assert.equal(realGrowth.mode, "changed");
  assert.equal(realGrowth.changes.length, 1);
  assert.doesNotMatch(JSON.stringify(realGrowth), /latestEvents|cursor/);
});

test("Phase 6 RAG ignores projection metadata and requires canonical memory evidence", () => {
  const existingMemory = {
    id: "memory_gray_harbor",
    kind: "world_memory",
    subject: "gray harbor",
    text: "The civic ledger remains open.",
    evidence: {
      sourceEventIds: ["event_memory_original"],
      status: "active",
    },
    retrieval: { score: 0.9, rank: 1, matchedQuery: true },
  };
  const before = {
    rag: {
      hits: [existingMemory],
      countsByKind: { world_memory: 1 },
      page: { limit: 3, cursor: "before" },
      retrieval: { note: "before projection", visibleTotal: 1 },
    },
  };
  const afterMetadataOnly = {
    rag: {
      hits: [{ ...existingMemory, retrieval: { score: 0.7, rank: 2, matchedQuery: false } }],
      countsByKind: { world_memory: 9, rumor: 4 },
      page: { limit: 10, cursor: "after" },
      retrieval: { note: "after projection", visibleTotal: 13 },
    },
  };
  const canonicalEvent = {
    eventId: "event_memory_update",
    eventType: "knowledge_recorded",
    aggregateType: "journey",
    aggregateId: "journey_rag_metadata",
    createdAt: "2026-07-22T00:00:00.000Z",
    trustClass: "server",
  };

  const metadataOnly = buildPhase6RagDelta(before, afterMetadataOnly, [canonicalEvent]);
  assert.equal(metadataOnly.changed, false);
  assert.equal(metadataOnly.noChangeReason, "projection_equal");
  assert.deepEqual(metadataOnly.memories, []);

  const actualMemoryUpdate = buildPhase6RagDelta(before, {
    rag: {
      ...afterMetadataOnly.rag,
      hits: [{
        ...existingMemory,
        text: "The civic ledger closed after settlement.",
        evidence: {
          sourceEventIds: ["event_memory_original", canonicalEvent.eventId],
          status: "active",
        },
      }],
    },
  }, [canonicalEvent]);
  assert.equal(actualMemoryUpdate.changed, true);
  assert.equal(actualMemoryUpdate.memories.length, 1);
  assert.deepEqual(actualMemoryUpdate.memories[0]?.sourceEvents.map((event) => event.eventId), [canonicalEvent.eventId]);
  assert.ok(actualMemoryUpdate.memories.length <= 3);
});
