import assert from "node:assert/strict";
import test from "node:test";

import type { EpochEvent } from "../lib/epoch/events.ts";
import { phase6JourneyMaterialRewardForTaskFamily } from "../lib/epoch/phase6MaterialRewardRules.ts";
import { projectPhase6PersistentRagPanel } from "../lib/epoch/phase6PersistentMemoryRules.ts";
import { buildPhase6RagDelta } from "../lib/epoch/phase6ProjectionDeltaRules.ts";

test("Phase 6 material reward definitions are server-owned and task-family specific", () => {
  assert.deepEqual(phase6JourneyMaterialRewardForTaskFamily("cultivation_material"), {
    taskFamilyId: "cultivation_material",
    resourceId: "material_cultivation_essence",
    materialId: "cultivation-essence",
    materialClass: "cultivation_advancement_material",
    amount: 1,
    usageRefs: [{
      system: "cultivation_breakthrough",
      targetRef: "cultivation-stage:2",
    }],
  });
  assert.equal(phase6JourneyMaterialRewardForTaskFamily("client_supplied_material"), undefined);
});

test("Phase 6 persistent route memory is a canonical-event projection and deduplicates a repeat", () => {
  const first = solidification("event-solidified-1", "journey-1", "2026-07-30T00:00:00.000Z");
  const repeated = solidification("event-solidified-2", "journey-2", "2026-07-30T01:00:00.000Z");
  const base = {
    hits: [],
    countsByKind: { memory: 0 },
    page: { total: 0 },
    retrieval: { visibleTotal: 0 },
  };
  const before = projectPhase6PersistentRagPanel({
    ragPanel: base,
    canonicalEvents: [first],
    agentId: "agent-1",
  });
  const after = projectPhase6PersistentRagPanel({
    ragPanel: base,
    canonicalEvents: [first, repeated],
    agentId: "agent-1",
  });
  const hit = (after.hits as readonly Record<string, unknown>[])[0]!;
  assert.equal((after.hits as readonly unknown[]).length, 1);
  assert.equal(hit.memoryId, "phase6-memory:route:region-gray:route-direct");
  assert.deepEqual(hit.sourceEventIds, ["event-solidified-2"]);

  const delta = buildPhase6RagDelta(
    { rag: before },
    { rag: after },
    [repeated] as unknown as Parameters<typeof buildPhase6RagDelta>[2],
  );
  assert.equal(delta.memories.length, 1);
  assert.equal(delta.memories[0]?.kind, "changed");
  assert.deepEqual(delta.memories[0]?.sourceEvents.map((event) => event.eventId), ["event-solidified-2"]);
});

function solidification(eventId: string, journeyId: string, createdAt: string): EpochEvent {
  return {
    eventId,
    eventType: "journey_world_solidified",
    aggregateType: "journey",
    aggregateId: journeyId,
    agentId: "agent-1",
    actorExplorerId: "explorer-1",
    trustClass: "system_worker",
    createdAt,
    payload: {
      journeyId,
      agentId: "agent-1",
      explorerId: "explorer-1",
      regionId: "region-gray",
      completedObjectiveIds: ["objective-1"],
      requiredMainObjectiveIds: ["objective-1"],
      mirrorStartedAtWorldTime: createdAt,
      mirrorEndedAtWorldTime: createdAt,
      committedAtWorldTime: createdAt,
      completionTier: "优秀",
      completionScoreBps: 9000,
      influenceDelta: 3,
      routeIds: ["route-direct"],
      factionStandings: [],
      npcRelationships: [],
      sourceEventIds: [eventId],
      effectEventIds: [],
      solidifiedAt: createdAt,
      mirrorLedgerPromotions: [],
      settlementPolicyVersion: "test",
      consequenceScorePolicyVersion: "test",
      canonThresholdBps: 0,
      selfLossScoreBps: 0,
      collateralScoreBps: 0,
    },
  } as unknown as EpochEvent;
}
