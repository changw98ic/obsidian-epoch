import assert from "node:assert/strict";
import test from "node:test";

import { eventFactory } from "../lib/epoch/eventFactory.ts";
import {
  agentNpcBondFocusSpendPayload,
  agentNpcBondUpdatedPayload,
  agentNpcBondScoreDelta,
  assertChildNpcBondAllowed,
  consumedSocialHookIdsForAgentRegion,
  diplomacyProposalFocusSpendPayload,
  diplomacyProposedPayload,
  diplomacyResponseFocusSpendPayload,
  diplomacyRespondedPayload,
  diplomacySeed,
  diplomacyTracePayload,
  hostedSocialHookBondPayload,
  hostedSocialHookInfluencePayload,
  hostedSocialHookMemoryPayload,
  planDiplomacyAcceptedRelationshipTraceEvents,
  planDiplomacyProposalEvents,
  planDiplomacyResponseEvents,
  planHostedSocialHookSideEffectEvents,
  hostedSocialHookScoreDelta,
  isChildNpc,
  planAgentNpcBondUpdateEvents,
  relationshipFocusSpendPayload,
  planRelationshipUpdateEvents,
  relationshipUpdatedPayload,
  relationshipScoreDelta,
  socialHookCreatedPayload,
  socialHookDraftForLifecycle,
} from "../lib/epoch/agentInteractionRules.ts";
import { createSequentialEpochIdFactory } from "../lib/epoch/protocol.ts";

test("agent interaction rules score diplomacy and NPC bonds", () => {
  assert.equal(relationshipScoreDelta("alliance", 3), 6);
  assert.equal(relationshipScoreDelta("hostility", 3), -6);
  assert.equal(relationshipScoreDelta("reputation", 3), 3);

  assert.equal(agentNpcBondScoreDelta("enemy", 2), -4);
  assert.equal(agentNpcBondScoreDelta("friend", 2), 4);
  assert.equal(agentNpcBondScoreDelta("mentor", 2), 4);
});

test("agent interaction rules protect child NPCs from exploitative bond kinds", () => {
  const childNpc = { traits: ["灰港", "child"] };
  const adultNpc = { traits: ["灰港", "clerk"] };

  assert.equal(isChildNpc(childNpc), true);
  assert.equal(isChildNpc(adultNpc), false);
  assert.throws(() => assertChildNpcBondAllowed(childNpc, "enemy"), /child_npc_protected_relationship_kind/);
  assert.throws(() => assertChildNpcBondAllowed(childNpc, "creditor"), /child_npc_protected_relationship_kind/);
  assert.doesNotThrow(() => assertChildNpcBondAllowed(childNpc, "friend"));
  assert.doesNotThrow(() => assertChildNpcBondAllowed(adultNpc, "enemy"));
});

test("agent interaction rules score hosted social hooks and ignore unrelated consumed hooks", () => {
  assert.equal(hostedSocialHookScoreDelta("low"), 1);
  assert.equal(hostedSocialHookScoreDelta("medium"), 2);
  assert.equal(hostedSocialHookScoreDelta("high"), 3);

  const consumed = consumedSocialHookIdsForAgentRegion({
    hostedSessions: {
      sameAgentSameRegion: {
        agentId: "agent_a",
        regionId: "region_gray_harbor",
        actions: [
          { socialHookId: "hook_1" },
          { socialHookId: "hook_2" },
          {},
        ],
      },
      otherAgent: {
        agentId: "agent_b",
        regionId: "region_gray_harbor",
        actions: [{ socialHookId: "hook_ignored_agent" }],
      },
      otherRegion: {
        agentId: "agent_a",
        regionId: "region_rot_forest",
        actions: [{ socialHookId: "hook_ignored_region" }],
      },
    },
  }, "agent_a", "region_gray_harbor");

  assert.deepEqual([...consumed].sort(), ["hook_1", "hook_2"]);
});

test("agent interaction rules plan social hooks from NPC lifecycle changes", () => {
  const npc = {
    displayName: "灰港书记",
    regionId: "region_gray_harbor",
  };

  assert.deepEqual(socialHookDraftForLifecycle(npc, { relationship_status: "spouse" }), {
    kind: "letter",
    title: "灰港书记 的家庭来信",
    body: "灰港书记 的伴侣关系刚被服务器记入世界账本，一封私人来信正在等待回应。",
    actionLabel: "回应家庭来信",
    risk: "medium",
  });

  assert.deepEqual(socialHookDraftForLifecycle(npc, { child_id: "npc_child" }), {
    kind: "obligation",
    title: "灰港书记 的家庭义务",
    body: "灰港书记 的家庭新增成员，区域账簿生成了一项需要处理的亲属义务。",
    actionLabel: "处理家庭义务",
    risk: "medium",
  });

  assert.deepEqual(socialHookDraftForLifecycle(npc, { health_status: "sick" }), {
    kind: "gossip",
    title: "灰港书记 的迁徙传闻",
    body: "灰港书记 的健康和行踪变化被区域居民议论，可能牵动下一次区域局势。",
    actionLabel: "追查迁徙传闻",
    risk: "low",
  });

  assert.equal(socialHookDraftForLifecycle(npc, { assets_delta: 1 }), null);
});

test("agent interaction rules plan social hook created payloads", () => {
  const draft = socialHookDraftForLifecycle({
    displayName: "灰港书记",
    regionId: "region_gray_harbor",
  }, { child_id: "npc_child" });
  assert.ok(draft);

  assert.deepEqual(socialHookCreatedPayload({
    hookId: "hook_1",
    regionId: "region_gray_harbor",
    npcId: "npc_1",
    draft,
    sourceEventIds: ["event_lifecycle"],
    createdAt: "2026-07-06T01:30:00.000Z",
  }), {
    hookId: "hook_1",
    regionId: "region_gray_harbor",
    npcId: "npc_1",
    kind: "obligation",
    title: "灰港书记 的家庭义务",
    body: "灰港书记 的家庭新增成员，区域账簿生成了一项需要处理的亲属义务。",
    actionLabel: "处理家庭义务",
    risk: "medium",
    sourceEventIds: ["event_lifecycle"],
    createdAt: "2026-07-06T01:30:00.000Z",
  });
});

test("agent interaction rules plan owner-authored NPC bond payloads", () => {
  assert.deepEqual(agentNpcBondFocusSpendPayload({
    bondId: "bond_1",
    focusSpent: 3,
    focusBalanceBefore: 10,
  }), {
    resourceId: "focus",
    amount: 3,
    reason: "agent_npc_bond:bond_1",
    balanceAfter: 7,
  });

  assert.deepEqual(agentNpcBondUpdatedPayload({
    bondId: "bond_1",
    agentId: "agent_1",
    explorerId: "explorer_1",
    npcId: "npc_1",
    npcRegionId: "region_gray_harbor",
    kind: "mentor",
    focusSpent: 3,
    previousScore: 5,
    reason: "mentor_training",
    updatedAt: "2026-07-06T01:15:00.000Z",
  }), {
    bondId: "bond_1",
    agentId: "agent_1",
    explorerId: "explorer_1",
    npcId: "npc_1",
    npcRegionId: "region_gray_harbor",
    kind: "mentor",
    focusSpent: 3,
    previousScore: 5,
    scoreDelta: 6,
    scoreAfter: 11,
    reason: "mentor_training",
    updatedAt: "2026-07-06T01:15:00.000Z",
  });
});

test("agent interaction rules plan owner-authored NPC bond event sequences", () => {
  const idFactory = createSequentialEpochIdFactory("agent_npc_bond_rules");
  const makeEvent = eventFactory(() => new Date("2026-07-06T01:15:00.000Z"), idFactory, {
    actorExplorerId: "explorer_1",
    trustClass: "user_verified_web",
    causationId: "cmd_agent_npc_bond",
    correlationId: "corr_agent_npc_bond",
  });

  const events = planAgentNpcBondUpdateEvents({
    makeEvent,
    bondId: "bond_1",
    agentId: "agent_1",
    explorerId: "explorer_1",
    npcId: "npc_1",
    npcRegionId: "region_gray_harbor",
    kind: "mentor",
    focusSpent: 3,
    focusBalanceBefore: 10,
    previousScore: 5,
    reason: "mentor_training",
    updatedAt: "2026-07-06T01:15:00.000Z",
  });

  assert.deepEqual(events.map((event) => event.eventType), [
    "resource_spent",
    "agent_npc_bond_updated",
  ]);
  assert.equal(events[0].aggregateType, "resource_account");
  assert.equal(events[0].agentId, "agent_1");
  assert.equal(events[1].aggregateType, "agent_npc_bond");
  assert.equal(events[1].agentId, "agent_1");
  assert.equal((events[1].payload as { readonly scoreAfter?: number }).scoreAfter, 11);
});

test("agent interaction rules plan hosted social hook side-effect payloads", () => {
  assert.deepEqual(hostedSocialHookBondPayload({
    bondId: "bond_1",
    agentId: "agent_1",
    explorerId: "explorer_1",
    npcId: "npc_1",
    npcRegionId: "region_gray_harbor",
    previousScore: 4,
    risk: "high",
    hookId: "hook_1",
    updatedAt: "2026-07-06T01:20:00.000Z",
  }), {
    bondId: "bond_1",
    agentId: "agent_1",
    explorerId: "explorer_1",
    npcId: "npc_1",
    npcRegionId: "region_gray_harbor",
    kind: "friend",
    focusSpent: 0,
    previousScore: 4,
    scoreDelta: 3,
    scoreAfter: 7,
    reason: "social_hook:hook_1",
    updatedAt: "2026-07-06T01:20:00.000Z",
  });

  assert.deepEqual(hostedSocialHookMemoryPayload({
    memoryId: "memory_1",
    npcId: "npc_1",
    regionId: "region_gray_harbor",
    npcDisplayName: "灰港书记",
    identityName: "调查员",
    hookTitle: "家庭义务",
    risk: "medium",
    sourceEventId: "event_action_1",
    recordedAt: "2026-07-06T01:20:00.000Z",
  }), {
    memoryId: "memory_1",
    npcId: "npc_1",
    regionId: "region_gray_harbor",
    summary: "灰港书记 记住了 调查员 处理人物事件“家庭义务”。",
    importance: "medium",
    sourceEventIds: ["event_action_1"],
    recordedAt: "2026-07-06T01:20:00.000Z",
  });

  assert.deepEqual(hostedSocialHookInfluencePayload({
    influenceId: "influence_1",
    regionId: "region_gray_harbor",
    agentId: "agent_1",
    explorerId: "explorer_1",
    previousInfluenceScore: 8,
    risk: "low",
    hookId: "hook_1",
    sourceEventId: "event_action_1",
    sourceAggregateId: "session_1",
    changedAt: "2026-07-06T01:20:00.000Z",
  }), {
    influenceId: "influence_1",
    regionId: "region_gray_harbor",
    agentId: "agent_1",
    explorerId: "explorer_1",
    influenceDelta: 1,
    influenceScoreAfter: 9,
    reason: "social_hook:hook_1",
    sourceEventId: "event_action_1",
    sourceEventType: "hosted_action_recorded",
    sourceAggregateId: "session_1",
    changedAt: "2026-07-06T01:20:00.000Z",
  });
});

test("agent interaction rules plan hosted social hook side-effect event sequences", () => {
  const idFactory = createSequentialEpochIdFactory("hosted_social_hook_rules");
  const makeEvent = eventFactory(() => new Date("2026-07-06T01:20:00.000Z"), idFactory, {
    actorExplorerId: "explorer_1",
    trustClass: "server_hosted_agent",
    causationId: "cmd_hosted_action",
    correlationId: "corr_hosted_action",
  });

  const events = planHostedSocialHookSideEffectEvents({
    makeEvent,
    bondId: "bond_1",
    memoryId: "memory_1",
    influenceId: "influence_1",
    regionId: "region_gray_harbor",
    agentId: "agent_1",
    explorerId: "explorer_1",
    npcId: "npc_1",
    npcRegionId: "region_gray_harbor",
    npcDisplayName: "灰港书记",
    identityName: "调查员",
    hookId: "hook_1",
    hookTitle: "家庭义务",
    risk: "medium",
    previousBondScore: 4,
    previousInfluenceScore: 8,
    sourceEventId: "event_action_1",
    sourceAggregateId: "session_1",
    recordedAt: "2026-07-06T01:20:00.000Z",
  });

  assert.deepEqual(events.map((event) => event.eventType), [
    "agent_npc_bond_updated",
    "npc_memory_recorded",
    "region_influence_changed",
  ]);
  assert.equal(events[0].aggregateType, "agent_npc_bond");
  assert.equal(events[0].agentId, "agent_1");
  assert.equal(events[1].aggregateType, "npc");
  assert.equal((events[1].payload as { readonly sourceEventIds?: readonly string[] }).sourceEventIds?.[0], "event_action_1");
  assert.equal(events[2].aggregateType, "region");
  assert.equal(events[2].agentId, "agent_1");
  assert.equal((events[2].payload as { readonly sourceEventType?: string }).sourceEventType, "hosted_action_recorded");
});

test("agent interaction rules plan diplomacy payloads", () => {
  const seedInput = {
    regionId: "region_gray_harbor",
    sourceAgentId: "agent_source",
    targetAgentId: "agent_target",
    kind: "alliance" as const,
    terms: "guard the pier",
  };

  assert.equal(
    diplomacySeed(seedInput),
    "region_gray_harbor:alliance:agent_source:agent_target:guard the pier",
  );

  assert.deepEqual(diplomacyProposalFocusSpendPayload({
    diplomacyId: "diplomacy_1",
    focusSpent: 2,
    focusBalanceBefore: 8,
  }), {
    resourceId: "focus",
    amount: 2,
    reason: "diplomacy_propose:diplomacy_1",
    balanceAfter: 6,
  });

  assert.deepEqual(diplomacyProposedPayload({
    diplomacyId: "diplomacy_1",
    ...seedInput,
    sourceExplorerId: "explorer_source",
    targetExplorerId: "explorer_target",
    focusSpent: 2,
    proposedAt: "2026-07-06T01:00:00.000Z",
  }), {
    diplomacyId: "diplomacy_1",
    regionId: "region_gray_harbor",
    sourceAgentId: "agent_source",
    sourceExplorerId: "explorer_source",
    targetAgentId: "agent_target",
    targetExplorerId: "explorer_target",
    kind: "alliance",
    focusSpent: 2,
    terms: "guard the pier",
    status: "pending",
    proposedAt: "2026-07-06T01:00:00.000Z",
  });

  assert.deepEqual(diplomacyResponseFocusSpendPayload({
    diplomacyId: "diplomacy_1",
    focusSpent: 1,
    focusBalanceBefore: 6,
  }), {
    resourceId: "focus",
    amount: 1,
    reason: "diplomacy_response:diplomacy_1",
    balanceAfter: 5,
  });

  assert.deepEqual(diplomacyRespondedPayload({
    diplomacyId: "diplomacy_1",
    regionId: "region_gray_harbor",
    sourceAgentId: "agent_source",
    sourceExplorerId: "explorer_source",
    targetAgentId: "agent_target",
    targetExplorerId: "explorer_target",
    kind: "alliance",
    response: "accepted",
    focusSpent: 1,
    note: "accepted at the gate",
    relationshipId: "relationship_1",
    respondedAt: "2026-07-06T01:05:00.000Z",
  }), {
    diplomacyId: "diplomacy_1",
    regionId: "region_gray_harbor",
    sourceAgentId: "agent_source",
    sourceExplorerId: "explorer_source",
    targetAgentId: "agent_target",
    targetExplorerId: "explorer_target",
    kind: "alliance",
    response: "accepted",
    status: "accepted",
    focusSpent: 1,
    note: "accepted at the gate",
    relationshipId: "relationship_1",
    respondedAt: "2026-07-06T01:05:00.000Z",
  });

  assert.deepEqual(diplomacyTracePayload({
    traceId: "trace_1",
    diplomacyId: "diplomacy_1",
    regionId: "region_gray_harbor",
    sourceAgentId: "agent_source",
    sourceExplorerId: "explorer_source",
    targetAgentId: "agent_target",
    targetExplorerId: "explorer_target",
    kind: "alliance",
    sourceEventIds: ["event_response", "event_relationship"],
    parentTraceId: "trace_parent",
    createdAt: "2026-07-06T01:05:00.000Z",
  }), {
    traceId: "trace_1",
    regionId: "region_gray_harbor",
    title: "外交链 diplomacy_1",
    summary: "agent_target 接受 agent_source 的 alliance 提案。",
    sourceEventType: "diplomacy_responded",
    sourceEventIds: ["event_response", "event_relationship"],
    sourceAggregateId: "diplomacy_1",
    relatedInfluenceIds: [],
    participantAgentIds: ["agent_source", "agent_target"],
    participantExplorerIds: ["explorer_source", "explorer_target"],
    parentTraceId: "trace_parent",
    createdAt: "2026-07-06T01:05:00.000Z",
  });
});

test("agent interaction rules plan diplomacy proposal event sequences", () => {
  const idFactory = createSequentialEpochIdFactory("diplomacy_rules");
  const makeEvent = eventFactory(() => new Date("2026-07-06T01:00:00.000Z"), idFactory, {
    actorExplorerId: "explorer_source",
    trustClass: "user_verified_web",
    causationId: "cmd_diplomacy",
    correlationId: "corr_diplomacy",
  });

  const events = planDiplomacyProposalEvents({
    makeEvent,
    diplomacyId: "diplomacy_1",
    regionId: "region_gray_harbor",
    sourceAgentId: "agent_source",
    sourceExplorerId: "explorer_source",
    targetAgentId: "agent_target",
    targetExplorerId: "explorer_target",
    kind: "alliance",
    focusSpent: 2,
    focusBalanceBefore: 8,
    terms: "guard the pier",
    proposedAt: "2026-07-06T01:00:00.000Z",
  });

  assert.deepEqual(events.map((event) => event.eventType), [
    "resource_spent",
    "diplomacy_proposed",
  ]);
  assert.equal(events[0].aggregateType, "resource_account");
  assert.equal(events[0].agentId, "agent_source");
  assert.equal(events[1].aggregateType, "diplomacy");
  assert.equal(events[1].agentId, "agent_source");
  assert.equal((events[1].payload as { readonly status?: string }).status, "pending");
});

test("agent interaction rules plan diplomacy response event sequences", () => {
  const acceptedIdFactory = createSequentialEpochIdFactory("diplomacy_response_accept");
  const acceptedMakeEvent = eventFactory(() => new Date("2026-07-06T01:05:00.000Z"), acceptedIdFactory, {
    actorExplorerId: "explorer_target",
    trustClass: "user_verified_web",
    causationId: "cmd_diplomacy_response",
    correlationId: "corr_diplomacy_response",
  });

  const acceptedEvents = planDiplomacyResponseEvents({
    makeEvent: acceptedMakeEvent,
    diplomacyId: "diplomacy_1",
    regionId: "region_gray_harbor",
    sourceAgentId: "agent_source",
    sourceExplorerId: "explorer_source",
    targetAgentId: "agent_target",
    targetExplorerId: "explorer_target",
    responderAgentId: "agent_target",
    kind: "alliance",
    response: "accepted",
    focusSpent: 1,
    focusBalanceBefore: 6,
    note: "accepted at the gate",
    relationshipId: "relationship_1",
    respondedAt: "2026-07-06T01:05:00.000Z",
  });

  assert.deepEqual(acceptedEvents.map((event) => event.eventType), [
    "resource_spent",
    "diplomacy_responded",
  ]);
  assert.equal(acceptedEvents[0].aggregateType, "resource_account");
  assert.equal(acceptedEvents[0].agentId, "agent_target");
  assert.equal(acceptedEvents[1].aggregateType, "diplomacy");
  assert.equal(acceptedEvents[1].agentId, "agent_target");
  assert.equal((acceptedEvents[1].payload as { readonly status?: string }).status, "accepted");

  const rejectedIdFactory = createSequentialEpochIdFactory("diplomacy_response_reject");
  const rejectedMakeEvent = eventFactory(() => new Date("2026-07-06T01:06:00.000Z"), rejectedIdFactory, {
    actorExplorerId: "explorer_target",
    trustClass: "user_verified_web",
    causationId: "cmd_diplomacy_reject",
    correlationId: "corr_diplomacy_reject",
  });

  const rejectedEvents = planDiplomacyResponseEvents({
    makeEvent: rejectedMakeEvent,
    diplomacyId: "diplomacy_1",
    regionId: "region_gray_harbor",
    sourceAgentId: "agent_source",
    sourceExplorerId: "explorer_source",
    targetAgentId: "agent_target",
    targetExplorerId: "explorer_target",
    responderAgentId: "agent_target",
    kind: "alliance",
    response: "rejected",
    focusSpent: 0,
    focusBalanceBefore: 6,
    note: "not today",
    respondedAt: "2026-07-06T01:06:00.000Z",
  });

  assert.deepEqual(rejectedEvents.map((event) => event.eventType), [
    "diplomacy_responded",
  ]);
  assert.equal(rejectedEvents[0].aggregateType, "diplomacy");
  assert.equal(rejectedEvents[0].agentId, "agent_target");
  assert.equal((rejectedEvents[0].payload as { readonly status?: string }).status, "rejected");
});

test("agent interaction rules plan accepted diplomacy relationship and trace event sequences", () => {
  const idFactory = createSequentialEpochIdFactory("diplomacy_acceptance");
  const makeEvent = eventFactory(() => new Date("2026-07-06T01:05:00.000Z"), idFactory, {
    actorExplorerId: "explorer_target",
    trustClass: "user_verified_web",
    causationId: "cmd_diplomacy_accept",
    correlationId: "corr_diplomacy_accept",
  });

  const events = planDiplomacyAcceptedRelationshipTraceEvents({
    makeEvent,
    traceId: "trace_1",
    diplomacyId: "diplomacy_1",
    relationshipId: "relationship_1",
    regionId: "region_gray_harbor",
    sourceAgentId: "agent_source",
    sourceExplorerId: "explorer_source",
    targetAgentId: "agent_target",
    targetExplorerId: "explorer_target",
    kind: "alliance",
    focusSpent: 2,
    previousScore: 4,
    respondedEventId: "event_response",
    parentTraceId: "trace_parent",
    respondedAt: "2026-07-06T01:05:00.000Z",
  });

  assert.deepEqual(events.map((event) => event.eventType), [
    "relationship_updated",
    "trace_created",
  ]);
  assert.equal(events[0].aggregateType, "relationship");
  assert.equal(events[0].agentId, "agent_source");
  assert.equal((events[0].payload as { readonly scoreAfter?: number }).scoreAfter, 8);
  assert.equal(events[1].aggregateType, "trace");
  assert.equal(events[1].agentId, "agent_source");
  assert.deepEqual((events[1].payload as { readonly sourceEventIds?: readonly string[] }).sourceEventIds, [
    "event_response",
    events[0].eventId,
  ]);
  assert.equal((events[1].payload as { readonly parentTraceId?: string }).parentTraceId, "trace_parent");
});

test("agent interaction rules plan relationship payloads", () => {
  assert.deepEqual(relationshipFocusSpendPayload({
    relationshipId: "relationship_1",
    focusSpent: 3,
    focusBalanceBefore: 9,
  }), {
    resourceId: "focus",
    amount: 3,
    reason: "relationship_update:relationship_1",
    balanceAfter: 6,
  });

  assert.deepEqual(relationshipUpdatedPayload({
    relationshipId: "relationship_1",
    sourceAgentId: "agent_source",
    sourceExplorerId: "explorer_source",
    targetAgentId: "agent_target",
    targetExplorerId: "explorer_target",
    kind: "hostility",
    focusSpent: 3,
    previousScore: -2,
    reason: "relationship_hostility",
    updatedAt: "2026-07-06T01:10:00.000Z",
  }), {
    relationshipId: "relationship_1",
    sourceAgentId: "agent_source",
    sourceExplorerId: "explorer_source",
    targetAgentId: "agent_target",
    targetExplorerId: "explorer_target",
    kind: "hostility",
    focusSpent: 3,
    previousScore: -2,
    scoreDelta: -6,
    scoreAfter: -8,
    reason: "relationship_hostility",
    updatedAt: "2026-07-06T01:10:00.000Z",
  });
});

test("agent interaction rules plan relationship update event sequences", () => {
  const idFactory = createSequentialEpochIdFactory("relationship_rules");
  const makeEvent = eventFactory(() => new Date("2026-07-06T01:10:00.000Z"), idFactory, {
    actorExplorerId: "explorer_source",
    trustClass: "user_verified_web",
    causationId: "cmd_relationship",
    correlationId: "corr_relationship",
  });

  const events = planRelationshipUpdateEvents({
    makeEvent,
    relationshipId: "relationship_1",
    sourceAgentId: "agent_source",
    sourceExplorerId: "explorer_source",
    targetAgentId: "agent_target",
    targetExplorerId: "explorer_target",
    kind: "hostility",
    focusSpent: 3,
    focusBalanceBefore: 9,
    previousScore: -2,
    reason: "relationship_hostility",
    updatedAt: "2026-07-06T01:10:00.000Z",
  });

  assert.deepEqual(events.map((event) => event.eventType), [
    "resource_spent",
    "relationship_updated",
  ]);
  assert.equal(events[0].aggregateType, "resource_account");
  assert.equal(events[0].agentId, "agent_source");
  assert.equal(events[1].aggregateType, "relationship");
  assert.equal(events[1].agentId, "agent_source");
  assert.equal((events[1].payload as { readonly scoreAfter?: number }).scoreAfter, -8);
});
