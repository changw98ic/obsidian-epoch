import assert from "node:assert/strict";
import test from "node:test";

import { eventFactory } from "../lib/epoch/eventFactory.ts";
import { createEpochGameCore, projectEpochEvents } from "../lib/epoch/gameCore.ts";
import {
  lifecycleMemorySummary,
  lifecycleMigrationRegionId,
  lifecycleOrganizationName,
  lifecycleTickLimit,
  lifecycleTickChanges,
  lifecycleHouseholdRecordPayload,
  lifecycleOrganizationMembershipRecordPayload,
  npcLifecycleRecordedPayload,
  npcAssetChangedPayload,
  npcCareerChangedPayload,
  npcHealthRecordedPayload,
  npcHouseholdRecordedPayload,
  npcLocationChangedPayload,
  npcMemoryRecordedPayload,
  npcRelationshipRecordedPayload,
  normalizeLifecycleChanges,
  planNpcLifecycleRecordEvents,
  planNpcMemoryRecordEvents,
  planNpcLifecycleTickEvents,
  projectNpcLifecycleTickResult,
  selectLifecycleTickNpcs,
} from "../lib/epoch/npcLifecycleRules.ts";
import { createSequentialEpochIdFactory } from "../lib/epoch/protocol.ts";

function npcWithLifecycle(length: number) {
  return {
    npcId: "npc_gray_harbor_clerk",
    displayName: "Gray Harbor Clerk",
    regionId: "region_gray_harbor",
    lifecycle: Array.from({ length }, (_, index) => ({
      occurredAt: `2026-07-07T00:0${index}:00.000Z`,
      changes: {},
      sourceEventIds: [],
    })),
  };
}

test("npc lifecycle rules plan deterministic lifecycle steps", () => {
  assert.deepEqual(lifecycleTickChanges(npcWithLifecycle(0)), {
    assets_delta: 10_000,
    work_status: "working",
  });
  assert.deepEqual(lifecycleTickChanges(npcWithLifecycle(1)), {
    married_to: "partner_npc_gray_h",
    relationship_status: "married",
  });
  assert.deepEqual(lifecycleTickChanges(npcWithLifecycle(2)), {
    child_id: "child_npc_gray_h",
    household_size_delta: 1,
  });
  assert.deepEqual(lifecycleTickChanges(npcWithLifecycle(3)), {
    assets_delta: -1_000,
    health_status: "sick",
  });

  assert.equal(
    lifecycleMemorySummary(npcWithLifecycle(0), { work_status: "working" }),
    "Gray Harbor Clerk 记住了一次区域工作状态变化：working",
  );
  assert.equal(
    lifecycleMemorySummary(npcWithLifecycle(0), { relationship_status: "married" }),
    "Gray Harbor Clerk 记住了一次家庭关系变化：married",
  );
  assert.equal(
    lifecycleMemorySummary(npcWithLifecycle(0), { child_id: "child_npc_gray_h" }),
    "Gray Harbor Clerk 记住了新家庭成员 child_npc_gray_h",
  );
  assert.equal(
    lifecycleMemorySummary(npcWithLifecycle(0), { health_status: "sick" }),
    "Gray Harbor Clerk 记住了一次健康状态变化：sick",
  );
  assert.equal(
    lifecycleMemorySummary(npcWithLifecycle(0), { assets_delta: 1 }),
    "Gray Harbor Clerk 记住了一次服务器生命周期变化",
  );
  assert.equal(lifecycleOrganizationName("region_gray_harbor"), "Gray Harbor Civic Ledger");
  assert.equal(lifecycleMigrationRegionId(npcWithLifecycle(3)), "region_gray_harbor_waystation_npc_gray");
});

test("npc lifecycle rules select tick targets and plan lifecycle payloads", () => {
  const npcA = {
    npcId: "npc_a",
    displayName: "A",
    regionId: "region_gray_harbor",
    lifecycle: [],
  };
  const npcB = {
    npcId: "npc_b",
    displayName: "B",
    regionId: "region_white_tower",
    lifecycle: [],
  };
  const npcC = {
    npcId: "npc_c",
    displayName: "C",
    regionId: "region_gray_harbor",
    lifecycle: [],
  };

  assert.equal(lifecycleTickLimit(undefined), 10);
  assert.equal(lifecycleTickLimit(0), 10);
  assert.equal(lifecycleTickLimit(-5), 1);
  assert.equal(lifecycleTickLimit(200), 100);
  assert.deepEqual(
    selectLifecycleTickNpcs({ npc_b: npcB, npc_c: npcC, npc_a: npcA }, { limit: 2 }).map((npc) => npc.npcId),
    ["npc_a", "npc_b"],
  );
  assert.deepEqual(
    selectLifecycleTickNpcs(
      { npc_b: npcB, npc_c: npcC, npc_a: npcA },
      { limit: 5, regionId: " region_gray_harbor " },
    ).map((npc) => npc.npcId),
    ["npc_a", "npc_c"],
  );
  assert.deepEqual(npcLifecycleRecordedPayload({
    npcId: "npc_a",
    occurredAt: "2026-07-07T01:00:00.000Z",
    changes: { " Work Status ": "working", ignored_object: { nested: true } as never },
    sourceEventIds: ["event_source_1"],
  }), {
    npcId: "npc_a",
    occurredAt: "2026-07-07T01:00:00.000Z",
    changes: { work_status: "working" },
    sourceEventIds: ["event_source_1"],
  });
  assert.deepEqual(normalizeLifecycleChanges({ " Work Status ": "working", ignored: undefined as never }), {
    work_status: "working",
  });
  assert.throws(() => normalizeLifecycleChanges({ ignored: undefined as never }), /npc_lifecycle_changes_required/);
});

test("npc lifecycle rules plan one tick side-effect event sequence", () => {
  const idFactory = createSequentialEpochIdFactory("npc_lifecycle_planner");
  const tickedAt = "2026-07-07T03:00:00.000Z";
  const clock = () => new Date(tickedAt);
  const context = {
    actorExplorerId: "system",
    trustClass: "system_worker" as const,
    causationId: "cmd_system",
    correlationId: "corr_system",
  };
  const core = createEpochGameCore({ clock, idFactory });
  const canonicalized = core.canonicalizeNpc({
    displayName: "Gray Harbor Clerk",
    regionId: "region_gray_harbor",
    traits: ["clerk"],
  }, context);
  const current = core.project();
  const npc = current.npcs[canonicalized.value.npcId];
  assert.ok(npc, "canonicalized NPC should be present in projection");

  const plannedEvents = planNpcLifecycleTickEvents({
    applyEvents: (_projection, events) => projectEpochEvents([...canonicalized.events, ...events]),
    current,
    idFactory,
    makeEvent: eventFactory(clock, idFactory, context),
    selectedNpcs: [npc],
    tickedAt,
  });

  assert.deepEqual(plannedEvents.map((event) => event.eventType), [
    "npc_lifecycle_recorded",
    "npc_memory_recorded",
    "npc_asset_changed",
    "organization_membership_changed",
    "npc_career_changed",
    "npc_canonicalized",
    "npc_canonicalized",
    "npc_canonicalized",
    "npc_canonicalized",
    "npc_relationship_recorded",
    "npc_relationship_recorded",
    "npc_relationship_recorded",
    "npc_relationship_recorded",
    "npc_relationship_recorded",
    "npc_relationship_recorded",
    "npc_relationship_recorded",
  ]);
  const lifecycleEvent = plannedEvents.find((event) => event.eventType === "npc_lifecycle_recorded");
  assert.ok(lifecycleEvent, "planner should emit a lifecycle event");
  assert.equal(lifecycleEvent.aggregateId, npc.npcId);
  assert.deepEqual(lifecycleEvent.payload.changes, {
    assets_delta: 10_000,
    work_status: "working",
  });
  assert.equal(plannedEvents.find((event) => event.eventType === "npc_memory_recorded")?.payload.sourceEventIds[0], lifecycleEvent.eventId);
  assert.equal(plannedEvents.find((event) => event.eventType === "organization_membership_changed")?.payload.role, "regional_clerk");

  const nextProjection = projectEpochEvents([...canonicalized.events, ...plannedEvents]);
  const result = projectNpcLifecycleTickResult({
    tickedAt,
    selectedNpcs: [npc],
    events: plannedEvents,
    projection: nextProjection,
  });
  assert.equal(result.tickedAt, tickedAt);
  assert.equal(result.updated[0]?.npcId, npc.npcId);
  assert.equal(result.memories.length, 1);
  assert.equal(result.memories[0]?.npcId, npc.npcId);
  assert.equal(result.relationships.length, 7);
  assert.equal(result.households.length, 0);
  assert.equal(result.organizationMemberships.length, 1);
  assert.equal(result.careers.length, 1);
  assert.equal(result.locations.length, 0);
  assert.equal(result.assetStates.length, 1);
  assert.equal(result.healthStates.length, 0);
  assert.equal(result.socialHooks.length, 0);
});

test("npc lifecycle rules plan canonical payloads", () => {
  const sourceEventIds = ["epoch_event_lifecycle_1"];
  const recordedAt = "2026-07-07T01:00:00.000Z";

  assert.deepEqual(npcMemoryRecordedPayload({
    memoryId: "npc_memory_1",
    npcId: "npc_gray_harbor_clerk",
    regionId: "region_gray_harbor",
    summary: "Gray Harbor Clerk 记住了一次服务器生命周期变化",
    importance: "medium",
    sourceEventIds,
    recordedAt,
  }), {
    memoryId: "npc_memory_1",
    npcId: "npc_gray_harbor_clerk",
    regionId: "region_gray_harbor",
    summary: "Gray Harbor Clerk 记住了一次服务器生命周期变化",
    importance: "medium",
    sourceEventIds,
    recordedAt,
  });

  assert.deepEqual(npcRelationshipRecordedPayload({
    relationshipId: "npc_relationship_1",
    sourceNpcId: "npc_gray_harbor_clerk",
    targetNpcId: "npc_gray_harbor_partner",
    sourceRegionId: "region_gray_harbor",
    targetRegionId: "region_gray_harbor",
    kind: "spouse",
    score: 80,
    reason: "lifecycle_marriage",
    sourceEventIds,
    recordedAt,
  }), {
    relationshipId: "npc_relationship_1",
    sourceNpcId: "npc_gray_harbor_clerk",
    targetNpcId: "npc_gray_harbor_partner",
    sourceRegionId: "region_gray_harbor",
    targetRegionId: "region_gray_harbor",
    kind: "spouse",
    score: 80,
    reason: "lifecycle_marriage",
    sourceEventIds,
    recordedAt,
  });

  assert.deepEqual(npcHouseholdRecordedPayload({
    householdId: "household_1",
    regionId: "region_gray_harbor",
    memberNpcIds: ["npc_gray_harbor_clerk", "npc_gray_harbor_partner"],
    reason: "lifecycle_marriage",
    sourceEventIds,
    recordedAt,
  }), {
    householdId: "household_1",
    regionId: "region_gray_harbor",
    memberNpcIds: ["npc_gray_harbor_clerk", "npc_gray_harbor_partner"],
    reason: "lifecycle_marriage",
    sourceEventIds,
    recordedAt,
  });

  assert.deepEqual(npcCareerChangedPayload({
    careerId: "npc_career_1",
    npcId: "npc_gray_harbor_clerk",
    regionId: "region_gray_harbor",
    title: "regional clerk",
    status: "working",
    organizationId: "organization_gray_harbor",
    sourceEventIds,
    recordedAt,
  }), {
    careerId: "npc_career_1",
    npcId: "npc_gray_harbor_clerk",
    regionId: "region_gray_harbor",
    title: "regional clerk",
    status: "working",
    organizationId: "organization_gray_harbor",
    sourceEventIds,
    recordedAt,
  });

  assert.deepEqual(npcLocationChangedPayload({
    locationId: "npc_location_1",
    npcId: "npc_gray_harbor_clerk",
    fromRegionId: "region_gray_harbor",
    toRegionId: "region_gray_harbor_waystation_npc_gray",
    reason: "lifecycle_relocation",
    sourceEventIds,
    recordedAt,
  }), {
    locationId: "npc_location_1",
    npcId: "npc_gray_harbor_clerk",
    fromRegionId: "region_gray_harbor",
    toRegionId: "region_gray_harbor_waystation_npc_gray",
    reason: "lifecycle_relocation",
    sourceEventIds,
    recordedAt,
  });

  assert.deepEqual(npcAssetChangedPayload({
    assetId: "npc_asset_1",
    npcId: "npc_gray_harbor_clerk",
    regionId: "region_gray_harbor",
    assetKey: "wealth",
    delta: -1_000,
    balanceAfter: 9_000,
    reason: "lifecycle_assets",
    sourceEventIds,
    recordedAt,
  }), {
    assetId: "npc_asset_1",
    npcId: "npc_gray_harbor_clerk",
    regionId: "region_gray_harbor",
    assetKey: "wealth",
    delta: -1_000,
    balanceAfter: 9_000,
    reason: "lifecycle_assets",
    sourceEventIds,
    recordedAt,
  });

  assert.deepEqual(npcHealthRecordedPayload({
    healthId: "npc_health_1",
    npcId: "npc_gray_harbor_clerk",
    regionId: "region_gray_harbor",
    status: "sick",
    reason: "lifecycle_health",
    sourceEventIds,
    recordedAt,
  }), {
    healthId: "npc_health_1",
    npcId: "npc_gray_harbor_clerk",
    regionId: "region_gray_harbor",
    status: "sick",
    severity: "minor",
    reason: "lifecycle_health",
    sourceEventIds,
    recordedAt,
  });

  assert.equal(npcHealthRecordedPayload({
    healthId: "npc_health_2",
    npcId: "npc_gray_harbor_clerk",
    regionId: "region_gray_harbor",
    status: "recovered",
    reason: "lifecycle_health",
    sourceEventIds,
    recordedAt,
  }).severity, "stable");
});

test("npc lifecycle rules plan household record merge behavior", () => {
  const recordedAt = "2026-07-07T01:00:00.000Z";
  const npcsById = {
    npc_clerk: { npcId: "npc_clerk", regionId: "region_gray_harbor" },
    npc_partner: { npcId: "npc_partner", regionId: "region_gray_harbor" },
    npc_child: { npcId: "npc_child", regionId: "region_gray_harbor" },
  };

  assert.deepEqual(lifecycleHouseholdRecordPayload({
    memberNpcIds: ["npc_clerk", "npc_partner", "npc_clerk"],
    householdsById: {},
    householdIdsByNpc: {},
    npcsById,
    householdIdFor: (regionId, firstMemberNpcId) => `household_${regionId}_${firstMemberNpcId}`,
    reason: "lifecycle_marriage",
    sourceEventIds: ["event_marriage"],
    recordedAt,
  }), {
    householdId: "household_region_gray_harbor_npc_clerk",
    regionId: "region_gray_harbor",
    memberNpcIds: ["npc_clerk", "npc_partner"],
    reason: "lifecycle_marriage",
    sourceEventIds: ["event_marriage"],
    recordedAt,
  });

  assert.deepEqual(lifecycleHouseholdRecordPayload({
    memberNpcIds: ["npc_clerk", "npc_child", "npc_clerk"],
    householdsById: {
      household_existing: {
        householdId: "household_existing",
        memberNpcIds: ["npc_clerk", "npc_partner"],
        sourceEventIds: ["event_marriage"],
      },
    },
    householdIdsByNpc: {
      npc_clerk: ["household_existing"],
    },
    npcsById,
    householdIdFor: (regionId, firstMemberNpcId) => `household_${regionId}_${firstMemberNpcId}`,
    reason: "lifecycle_child",
    sourceEventIds: ["event_child", "event_marriage"],
    recordedAt,
  }), {
    householdId: "household_existing",
    regionId: "region_gray_harbor",
    memberNpcIds: ["npc_clerk", "npc_partner", "npc_child"],
    reason: "lifecycle_child",
    sourceEventIds: ["event_marriage", "event_child"],
    recordedAt,
  });

  assert.equal(lifecycleHouseholdRecordPayload({
    memberNpcIds: ["npc_clerk", "npc_partner"],
    householdsById: {
      household_existing: {
        householdId: "household_existing",
        memberNpcIds: ["npc_clerk", "npc_partner"],
        sourceEventIds: ["event_marriage"],
      },
    },
    householdIdsByNpc: {
      npc_clerk: ["household_existing"],
      npc_partner: ["household_existing"],
    },
    npcsById,
    householdIdFor: (regionId, firstMemberNpcId) => `household_${regionId}_${firstMemberNpcId}`,
    reason: "lifecycle_marriage",
    sourceEventIds: ["event_repeat"],
    recordedAt,
  }), undefined);

  assert.throws(() => lifecycleHouseholdRecordPayload({
    memberNpcIds: ["  "],
    householdsById: {},
    householdIdsByNpc: {},
    npcsById,
    householdIdFor: (regionId, firstMemberNpcId) => `household_${regionId}_${firstMemberNpcId}`,
    reason: "lifecycle_marriage",
    sourceEventIds: ["event_marriage"],
    recordedAt,
  }), /household_member_npc_id_required/);
});

test("npc lifecycle rules plan organization membership records", () => {
  const recordedAt = "2026-07-07T01:00:00.000Z";
  const organizationIdFor = (regionId: string, organizationName: string) => `organization_${regionId}_${organizationName}`;
  const membershipIdFor = (organizationId: string, npcId: string, role: string) =>
    `membership_${organizationId}_${npcId}_${role}`;

  assert.deepEqual(lifecycleOrganizationMembershipRecordPayload({
    npc: {
      npcId: "npc_clerk",
      regionId: "region_gray_harbor",
    },
    role: "regional_clerk",
    membershipsById: {},
    membershipIdsByNpc: {},
    organizationIdFor,
    membershipIdFor,
    sourceEventIds: ["event_work"],
    recordedAt,
  }), {
    organizationId: "organization_region_gray_harbor_Gray Harbor Civic Ledger",
    payload: {
      membershipId: "membership_organization_region_gray_harbor_Gray Harbor Civic Ledger_npc_clerk_regional_clerk",
      organizationId: "organization_region_gray_harbor_Gray Harbor Civic Ledger",
      organizationName: "Gray Harbor Civic Ledger",
      npcId: "npc_clerk",
      regionId: "region_gray_harbor",
      role: "regional_clerk",
      status: "active",
      sourceEventIds: ["event_work"],
      recordedAt,
    },
  });

  assert.deepEqual(lifecycleOrganizationMembershipRecordPayload({
    npc: {
      npcId: "npc_clerk",
      regionId: "region_gray_harbor",
    },
    role: "regional_clerk",
    membershipsById: {
      membership_existing: {
        organizationId: "organization_region_gray_harbor_Gray Harbor Civic Ledger",
      },
    },
    membershipIdsByNpc: {
      npc_clerk: ["membership_existing"],
    },
    organizationIdFor,
    membershipIdFor,
    sourceEventIds: ["event_repeat"],
    recordedAt,
  }), {
    organizationId: "organization_region_gray_harbor_Gray Harbor Civic Ledger",
    payload: undefined,
  });
});

test("npc lifecycle rules plan manual lifecycle record event sequences", () => {
  const idFactory = createSequentialEpochIdFactory("npc_lifecycle_record_rules");
  const makeEvent = eventFactory(() => new Date("2026-07-07T06:00:00.000Z"), idFactory, {
    actorExplorerId: "system",
    trustClass: "system_worker",
    causationId: "cmd_npc_lifecycle",
    correlationId: "corr_npc_lifecycle",
  });

  const events = planNpcLifecycleRecordEvents({
    makeEvent,
    npcId: "npc_gray_harbor_clerk",
    occurredAt: "2026-07-07T06:00:00.000Z",
    changes: { " Work Status ": "working" },
    sourceEventIds: ["event_source_1"],
  });

  assert.equal(events.length, 1);
  assert.equal(events[0].eventType, "npc_lifecycle_recorded");
  assert.equal(events[0].aggregateType, "npc");
  assert.equal(events[0].aggregateId, "npc_gray_harbor_clerk");
  assert.deepEqual(events[0].payload.changes, { work_status: "working" });
});

test("npc lifecycle rules plan manual memory record event sequences", () => {
  const idFactory = createSequentialEpochIdFactory("npc_memory_record_rules");
  const makeEvent = eventFactory(() => new Date("2026-07-07T06:10:00.000Z"), idFactory, {
    actorExplorerId: "system",
    trustClass: "system_worker",
    causationId: "cmd_npc_memory",
    correlationId: "corr_npc_memory",
  });

  const events = planNpcMemoryRecordEvents({
    makeEvent,
    memoryId: "npc_memory_1",
    npcId: "npc_gray_harbor_clerk",
    regionId: "region_gray_harbor",
    summary: "灰港书记员记住了灯塔异常。",
    importance: "medium",
    sourceEventIds: ["event_source_1"],
    recordedAt: "2026-07-07T06:10:00.000Z",
  });

  assert.equal(events.length, 1);
  assert.equal(events[0].eventType, "npc_memory_recorded");
  assert.equal(events[0].aggregateType, "npc");
  assert.equal(events[0].aggregateId, "npc_memory_1");
  assert.equal(events[0].payload.regionId, "region_gray_harbor");
  assert.equal(events[0].payload.importance, "medium");
});
