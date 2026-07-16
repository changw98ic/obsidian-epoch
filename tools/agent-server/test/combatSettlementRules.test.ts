import assert from "node:assert/strict";
import test from "node:test";

import {
  PARTY_INVITE_TOKEN_TTL_SECONDS,
  assertPartyJoinRequestResolution,
  assertPartyRole,
  assertPartyRunJoinPolicy,
  optionalInviteToken,
  partyInviteTokenExpiresAt,
  partyInviteTokenHash,
  partyInviteTokenUseLimit,
  partyInviteUpdatedPayload,
  partyJoinRequestResolvedPayload,
  partyJoinRequestedPayload,
  partyMemberJoinedPayload,
  planPartyInviteUpdateEvents,
  planPartyJoinRequestEvents,
  planPartyJoinRequestResolutionEvents,
  planPartyMemberJoinEvents,
  planPartyRunCreationEvents,
  planPartyRunSettlementEvents,
  planRaidResolutionEvents,
  planRetaliationResolutionEvents,
  projectPartyInviteUpdate,
  projectPartyJoinRequest,
  projectPartyJoinRequestResolution,
  projectPartyMemberJoin,
  projectPartyRunCreation,
  projectRaidResolution,
  projectRetaliationResolution,
  requireOpenPartyRun,
  requireOpenRetaliationOpportunity,
  requirePartyRun,
  requireRetaliationOpportunity,
  partyRunMemberSettlementResults,
  partyRunCreatedPayload,
  partyRunMemberInfluencePayload,
  partyRunMemberRewardGrantPayload,
  partyRunSettledPayload,
  partyRunTotalScore,
  partyRunTracePayload,
  latestRaidPairResolvedAt,
  raidAttackStaminaSpendPayload,
  raidPairResolvedCountSince,
  raidRegionalHeatScoreDelta,
  raidRewardGrantPayload,
  raidSettlementInfluencePayload,
  raidSettlementTracePayload,
  raidResolvedPayload,
  regionRaidHeatScoreSince,
  retaliationOpportunityCreatedPayload,
  retaliationRewardGrantPayload,
  retaliationSettlementInfluencePayload,
  retaliationSettlementTracePayload,
  retaliationResolvedPayload,
  retaliationStaminaSpendPayload,
} from "../lib/epoch/combatSettlementRules.ts";
import { eventFactory } from "../lib/epoch/eventFactory.ts";
import { createSequentialEpochIdFactory } from "../lib/epoch/protocol.ts";

test("combat settlement rules validate party lifecycle inputs", () => {
  assert.equal(PARTY_INVITE_TOKEN_TTL_SECONDS, 24 * 60 * 60);
  assert.equal(assertPartyRole("scout", "participant_role"), "scout");
  assert.throws(() => assertPartyRole(undefined, "participant_role"), /participant_role_invalid/);
  assert.equal(assertPartyRunJoinPolicy(undefined), "open");
  assert.equal(assertPartyRunJoinPolicy("invite_only"), "invite_only");
  assert.throws(() => assertPartyRunJoinPolicy("closed"), /party_join_policy_invalid/);
  assert.equal(assertPartyJoinRequestResolution("approved"), "approved");
  assert.throws(() => assertPartyJoinRequestResolution(undefined), /party_join_request_resolution_invalid/);
  assert.equal(optionalInviteToken("  secret  "), "  secret  ");
  assert.equal(optionalInviteToken("  "), undefined);
  assert.equal(
    partyInviteTokenHash("invite-secret"),
    "2a1ed5f04ebb12c50d33ea3031b46260a6d503e72c1d992b2fd3d9e048cd5c8f",
  );
  assert.equal(
    partyInviteTokenExpiresAt(undefined, "2026-07-07T01:00:00.000Z"),
    "2026-07-08T01:00:00.000Z",
  );
  assert.equal(
    partyInviteTokenExpiresAt("2026-07-07T03:00:00.000Z", "2026-07-07T01:00:00.000Z"),
    "2026-07-07T03:00:00.000Z",
  );
  assert.throws(() => partyInviteTokenExpiresAt("bad", "2026-07-07T01:00:00.000Z"), /party_invite_expires_at_invalid/);
  assert.throws(
    () => partyInviteTokenExpiresAt("2026-07-07T00:59:00.000Z", "2026-07-07T01:00:00.000Z"),
    /party_invite_expired/,
  );
  assert.equal(partyInviteTokenUseLimit(undefined), 3);
  assert.equal(partyInviteTokenUseLimit(2), 2);
  assert.throws(() => partyInviteTokenUseLimit(4), /party_invite_use_limit_invalid/);
});

test("combat settlement rules read party run projection state", () => {
  const projection = {
    partyRuns: {
      party_open: { status: "open", marker: "open" },
      party_settled: { status: "settled", marker: "settled" },
    },
  } as const;

  assert.equal(requirePartyRun(projection, "party_settled").marker, "settled");
  assert.equal(requireOpenPartyRun(projection, "party_open").marker, "open");
  assert.throws(() => requirePartyRun(projection, "party_missing"), /party_run_not_found/);
  assert.throws(() => requireOpenPartyRun(projection, "party_settled"), /party_run_not_open/);
});

test("combat settlement rules read retaliation opportunity projection state", () => {
  const projection = {
    retaliationOpportunities: {
      retaliation_open: { status: "open", marker: "open" },
      retaliation_resolved: { status: "resolved", marker: "resolved" },
    },
  } as const;

  assert.equal(requireRetaliationOpportunity(projection, "retaliation_resolved").marker, "resolved");
  assert.equal(requireOpenRetaliationOpportunity(projection, "retaliation_open").marker, "open");
  assert.throws(() => requireRetaliationOpportunity(projection, "retaliation_missing"), /retaliation_not_found/);
  assert.throws(
    () => requireOpenRetaliationOpportunity(projection, "retaliation_resolved"),
    /retaliation_not_open/,
  );
});

test("combat settlement rules plan party lifecycle payloads", () => {
  const createdAt = "2026-07-07T01:00:00.000Z";
  const inviteTokenHash = partyInviteTokenHash("invite-secret");

  assert.deepEqual(partyRunCreatedPayload({
    partyRunId: "party_1",
    regionId: "region_gray_harbor",
    leaderAgentId: "agent_leader",
    leaderExplorerId: "explorer_leader",
    title: "灰港巡夜",
    objective: "保护钟楼",
    joinPolicy: "invite_only",
    inviteTokenHash,
    inviteTokenExpiresAt: partyInviteTokenExpiresAt(undefined, createdAt),
    inviteTokenUseLimit: partyInviteTokenUseLimit(undefined),
    inviteRecipientAgentId: "agent_scout",
    createdAt,
  }), {
    partyRunId: "party_1",
    regionId: "region_gray_harbor",
    leaderAgentId: "agent_leader",
    leaderExplorerId: "explorer_leader",
    title: "灰港巡夜",
    objective: "保护钟楼",
    joinPolicy: "invite_only",
    inviteTokenHash,
    inviteTokenExpiresAt: "2026-07-08T01:00:00.000Z",
    inviteTokenUseLimit: 3,
    inviteTokenUses: 0,
    inviteRecipientAgentId: "agent_scout",
    participantRole: "leader",
    createdAt,
  });

  assert.deepEqual(partyRunCreatedPayload({
    partyRunId: "party_open",
    regionId: "region_gray_harbor",
    leaderAgentId: "agent_leader",
    leaderExplorerId: "explorer_leader",
    title: "公开巡夜",
    objective: "开放报名",
    joinPolicy: "open",
    createdAt,
  }), {
    partyRunId: "party_open",
    regionId: "region_gray_harbor",
    leaderAgentId: "agent_leader",
    leaderExplorerId: "explorer_leader",
    title: "公开巡夜",
    objective: "开放报名",
    joinPolicy: "open",
    inviteTokenHash: undefined,
    inviteTokenExpiresAt: undefined,
    inviteTokenUseLimit: undefined,
    inviteTokenUses: undefined,
    inviteRecipientAgentId: undefined,
    participantRole: "leader",
    createdAt,
  });

  assert.deepEqual(partyInviteUpdatedPayload({
    partyRunId: "party_1",
    regionId: "region_gray_harbor",
    leaderAgentId: "agent_leader",
    leaderExplorerId: "explorer_leader",
    updateKind: "rotated",
    inviteTokenHash,
    inviteTokenExpiresAt: "2026-07-07T03:00:00.000Z",
    inviteTokenUseLimit: 2,
    inviteRecipientAgentId: "agent_scribe",
    updatedAt: "2026-07-07T02:00:00.000Z",
  }), {
    partyRunId: "party_1",
    regionId: "region_gray_harbor",
    leaderAgentId: "agent_leader",
    leaderExplorerId: "explorer_leader",
    updateKind: "rotated",
    inviteTokenHash,
    inviteTokenExpiresAt: "2026-07-07T03:00:00.000Z",
    inviteTokenUseLimit: 2,
    inviteTokenUses: 0,
    inviteRecipientAgentId: "agent_scribe",
    inviteTokenRevokedAt: undefined,
    updatedAt: "2026-07-07T02:00:00.000Z",
  });

  assert.deepEqual(partyInviteUpdatedPayload({
    partyRunId: "party_1",
    regionId: "region_gray_harbor",
    leaderAgentId: "agent_leader",
    leaderExplorerId: "explorer_leader",
    updateKind: "revoked",
    updatedAt: "2026-07-07T02:30:00.000Z",
  }), {
    partyRunId: "party_1",
    regionId: "region_gray_harbor",
    leaderAgentId: "agent_leader",
    leaderExplorerId: "explorer_leader",
    updateKind: "revoked",
    inviteTokenHash: undefined,
    inviteTokenExpiresAt: undefined,
    inviteTokenUseLimit: 0,
    inviteTokenUses: 0,
    inviteRecipientAgentId: undefined,
    inviteTokenRevokedAt: "2026-07-07T02:30:00.000Z",
    updatedAt: "2026-07-07T02:30:00.000Z",
  });

  assert.deepEqual(partyMemberJoinedPayload({
    partyRunId: "party_1",
    regionId: "region_gray_harbor",
    agentId: "agent_scout",
    explorerId: "explorer_scout",
    participantRole: "scout",
    joinedAt: "2026-07-07T02:40:00.000Z",
    inviteTokenUsed: true,
  }), {
    partyRunId: "party_1",
    regionId: "region_gray_harbor",
    agentId: "agent_scout",
    explorerId: "explorer_scout",
    participantRole: "scout",
    joinedAt: "2026-07-07T02:40:00.000Z",
    inviteTokenUsed: true,
  });

  assert.deepEqual(partyJoinRequestedPayload({
    requestId: "request_1",
    partyRunId: "party_1",
    regionId: "region_gray_harbor",
    agentId: "agent_support",
    explorerId: "explorer_support",
    participantRole: "support",
    requestNote: "  我来补位  ",
    requestedAt: "2026-07-07T02:45:00.000Z",
  }), {
    requestId: "request_1",
    partyRunId: "party_1",
    regionId: "region_gray_harbor",
    agentId: "agent_support",
    explorerId: "explorer_support",
    participantRole: "support",
    requestNote: "我来补位",
    requestedAt: "2026-07-07T02:45:00.000Z",
  });

  assert.deepEqual(partyJoinRequestResolvedPayload({
    requestId: "request_1",
    partyRunId: "party_1",
    regionId: "region_gray_harbor",
    agentId: "agent_support",
    explorerId: "explorer_support",
    participantRole: "support",
    resolution: "approved",
    resolvedByAgentId: "agent_leader",
    resolvedByExplorerId: "explorer_leader",
    resolutionNote: "  同意  ",
    resolvedAt: "2026-07-07T02:50:00.000Z",
  }), {
    requestId: "request_1",
    partyRunId: "party_1",
    regionId: "region_gray_harbor",
    agentId: "agent_support",
    explorerId: "explorer_support",
    participantRole: "support",
    resolution: "approved",
    resolvedByAgentId: "agent_leader",
    resolvedByExplorerId: "explorer_leader",
    resolutionNote: "同意",
    resolvedAt: "2026-07-07T02:50:00.000Z",
  });
});

test("combat settlement rules plan party lifecycle event sequences", () => {
  const occurredAt = "2026-07-07T03:00:00.000Z";
  const idFactory = createSequentialEpochIdFactory("party_lifecycle");
  const makeEvent = eventFactory(() => new Date(occurredAt), idFactory, {
    actorExplorerId: "explorer_leader",
    trustClass: "user_verified_web" as const,
    causationId: "party_lifecycle",
    correlationId: "corr_party_lifecycle",
  });
  const projectedPartyRun = {
    partyRunId: "party_1",
    status: "open",
    marker: "projected",
  } as const;

  const createdEvents = planPartyRunCreationEvents({
    partyRunId: "party_1",
    regionId: "region_gray_harbor",
    leaderAgentId: "agent_leader",
    leaderExplorerId: "explorer_leader",
    title: "灰港巡夜",
    objective: "保护钟楼",
    joinPolicy: "invite_only",
    inviteTokenHash: "hash_invite",
    inviteTokenExpiresAt: "2026-07-08T03:00:00.000Z",
    inviteTokenUseLimit: 3,
    inviteRecipientAgentId: "agent_support",
    createdAt: occurredAt,
    makeEvent,
  });
  assert.deepEqual(createdEvents.map((event) => event.eventType), ["party_run_created"]);
  assert.equal(createdEvents[0]?.aggregateId, "party_1");
  assert.equal(projectPartyRunCreation({
    events: createdEvents,
    projection: { partyRuns: { party_1: projectedPartyRun } },
  }), projectedPartyRun);
  assert.throws(() => projectPartyRunCreation({
    events: [],
    projection: { partyRuns: { party_1: projectedPartyRun } },
  }), /party_run_created_event_missing/);

  const inviteEvents = planPartyInviteUpdateEvents({
    inviteEventId: "party_1:invite:rotated",
    partyRunId: "party_1",
    regionId: "region_gray_harbor",
    leaderAgentId: "agent_leader",
    leaderExplorerId: "explorer_leader",
    updateKind: "rotated",
    inviteTokenHash: "hash_invite",
    inviteTokenExpiresAt: "2026-07-08T03:00:00.000Z",
    inviteTokenUseLimit: 3,
    inviteRecipientAgentId: "agent_support",
    updatedAt: occurredAt,
    makeEvent,
  });
  assert.deepEqual(inviteEvents.map((event) => event.eventType), ["party_invite_updated"]);
  assert.equal(inviteEvents[0]?.aggregateId, "party_1:invite:rotated");
  assert.equal(projectPartyInviteUpdate({
    events: inviteEvents,
    projection: { partyRuns: { party_1: projectedPartyRun } },
  }), projectedPartyRun);

  const joinedEvents = planPartyMemberJoinEvents({
    partyRunId: "party_1",
    regionId: "region_gray_harbor",
    agentId: "agent_support",
    explorerId: "explorer_support",
    participantRole: "support",
    joinedAt: occurredAt,
    inviteTokenUsed: true,
    makeEvent,
  });
  assert.deepEqual(joinedEvents.map((event) => event.eventType), ["party_member_joined"]);
  assert.equal(joinedEvents[0]?.aggregateId, "party_1");
  assert.equal(projectPartyMemberJoin({
    events: joinedEvents,
    projection: { partyRuns: { party_1: projectedPartyRun } },
  }), projectedPartyRun);

  const requestedEvents = planPartyJoinRequestEvents({
    requestId: "request_1",
    partyRunId: "party_1",
    regionId: "region_gray_harbor",
    agentId: "agent_support",
    explorerId: "explorer_support",
    participantRole: "support",
    requestNote: "我来补位",
    requestedAt: occurredAt,
    makeEvent,
  });
  assert.deepEqual(requestedEvents.map((event) => event.eventType), ["party_join_requested"]);
  assert.equal(requestedEvents[0]?.aggregateId, "request_1");
  assert.equal(projectPartyJoinRequest({
    events: requestedEvents,
    projection: { partyRuns: { party_1: projectedPartyRun } },
  }), projectedPartyRun);

  const approvedEvents = planPartyJoinRequestResolutionEvents({
    requestId: "request_1",
    partyRunId: "party_1",
    regionId: "region_gray_harbor",
    agentId: "agent_support",
    explorerId: "stale_explorer",
    participantRole: "support",
    resolution: "approved",
    resolvedByAgentId: "agent_leader",
    resolvedByExplorerId: "explorer_leader",
    resolutionNote: "同意",
    resolvedAt: occurredAt,
    approvedMemberExplorerId: "explorer_support",
    makeEvent,
  });
  assert.deepEqual(approvedEvents.map((event) => event.eventType), [
    "party_join_request_resolved",
    "party_member_joined",
  ]);
  const [resolved, approvedJoin] = approvedEvents;
  if (resolved?.eventType !== "party_join_request_resolved") throw new Error("expected_party_join_request_resolved");
  if (approvedJoin?.eventType !== "party_member_joined") throw new Error("expected_party_member_joined");
  assert.equal(resolved.aggregateId, "request_1");
  assert.equal(approvedJoin.payload.explorerId, "explorer_support");
  assert.equal(projectPartyJoinRequestResolution({
    events: approvedEvents,
    projection: { partyRuns: { party_1: projectedPartyRun } },
  }), projectedPartyRun);
  assert.throws(() => projectPartyJoinRequestResolution({
    events: approvedEvents,
    projection: { partyRuns: {} },
  }), /party_run_projection_failed/);

  const rejectedEvents = planPartyJoinRequestResolutionEvents({
    requestId: "request_2",
    partyRunId: "party_1",
    regionId: "region_gray_harbor",
    agentId: "agent_vanguard",
    explorerId: "explorer_vanguard",
    participantRole: "vanguard",
    resolution: "rejected",
    resolvedByAgentId: "agent_leader",
    resolvedByExplorerId: "explorer_leader",
    resolvedAt: occurredAt,
    makeEvent,
  });
  assert.deepEqual(rejectedEvents.map((event) => event.eventType), ["party_join_request_resolved"]);
});

test("combat settlement rules plan party run settlement payloads", () => {
  const plannedMemberResults = partyRunMemberSettlementResults("party_1", [
    { agentId: "agent_leader", explorerId: "explorer_leader", participantRole: "leader" },
    { agentId: "agent_vanguard", explorerId: "explorer_vanguard", participantRole: "vanguard" },
    { agentId: "agent_support", explorerId: "explorer_support", participantRole: "support" },
  ]);

  assert.deepEqual(plannedMemberResults, [
    {
      agentId: "agent_leader",
      explorerId: "explorer_leader",
      participantRole: "leader",
      score: 4,
      reward: {
        resourceId: "coin",
        amount: 4,
        reason: "party_run_settlement:party_1",
      },
    },
    {
      agentId: "agent_vanguard",
      explorerId: "explorer_vanguard",
      participantRole: "vanguard",
      score: 4,
      reward: {
        resourceId: "coin",
        amount: 4,
        reason: "party_run_settlement:party_1",
      },
    },
    {
      agentId: "agent_support",
      explorerId: "explorer_support",
      participantRole: "support",
      score: 3,
      reward: {
        resourceId: "coin",
        amount: 3,
        reason: "party_run_settlement:party_1",
      },
    },
  ]);
  assert.equal(partyRunTotalScore(plannedMemberResults), 11);

  assert.deepEqual(partyRunMemberRewardGrantPayload({
    member: plannedMemberResults[1],
    balanceBefore: 6,
  }), {
    resourceId: "coin",
    amount: 4,
    reason: "party_run_settlement:party_1",
    balanceAfter: 10,
  });

  const memberResults = [
    {
      agentId: "agent_leader",
      explorerId: "explorer_leader",
      participantRole: "leader",
      score: 3,
      reward: {
        resourceId: "coin",
        amount: 3,
        reason: "party_run_settlement:party_1",
      },
    },
    {
      agentId: "agent_vanguard",
      explorerId: "explorer_vanguard",
      participantRole: "vanguard",
      score: 4,
      reward: {
        resourceId: "coin",
        amount: 4,
        reason: "party_run_settlement:party_1",
      },
    },
    {
      agentId: "agent_scout",
      explorerId: "explorer_scout",
      participantRole: "scout",
      score: 2,
      reward: {
        resourceId: "coin",
        amount: 2,
        reason: "party_run_settlement:party_1",
      },
    },
  ] as const;

  assert.deepEqual(partyRunSettledPayload({
    partyRunId: "party_1",
    regionId: "region_gray_harbor",
    totalScore: 9,
    memberResults,
    traceId: "trace_1",
    newsId: "news_1",
    settledAt: "2026-07-07T01:00:00.000Z",
  }), {
    partyRunId: "party_1",
    regionId: "region_gray_harbor",
    totalScore: 9,
    memberResults,
    traceId: "trace_1",
    newsId: "news_1",
    settledAt: "2026-07-07T01:00:00.000Z",
  });

  assert.deepEqual(partyRunMemberInfluencePayload({
    influenceId: "influence_1",
    partyRunId: "party_1",
    regionId: "region_gray_harbor",
    member: memberResults[1],
    previousInfluenceScore: 5,
    sourceEventId: "event_party_settled",
    changedAt: "2026-07-07T01:00:00.000Z",
  }), {
    influenceId: "influence_1",
    regionId: "region_gray_harbor",
    agentId: "agent_vanguard",
    explorerId: "explorer_vanguard",
    influenceDelta: 5,
    influenceScoreAfter: 10,
    reason: "party_run_settlement:party_1",
    sourceEventId: "event_party_settled",
    sourceEventType: "party_run_settled",
    sourceAggregateId: "party_1",
    changedAt: "2026-07-07T01:00:00.000Z",
  });

  assert.deepEqual(partyRunTracePayload({
    traceId: "trace_1",
    partyRunId: "party_1",
    regionId: "region_gray_harbor",
    partyTitle: "灰港巡夜",
    totalScore: 9,
    memberResults,
    sourceEventIds: ["event_party_settled", "event_influence_1"],
    relatedInfluenceIds: ["influence_1"],
    parentTraceId: "trace_parent",
    createdAt: "2026-07-07T01:00:00.000Z",
  }), {
    traceId: "trace_1",
    regionId: "region_gray_harbor",
    title: "灰港巡夜结算",
    summary: "灰港巡夜 完成小队行动，总分 9，成员 3 名。",
    sourceEventType: "party_run_settled",
    sourceEventIds: ["event_party_settled", "event_influence_1"],
    sourceAggregateId: "party_1",
    relatedInfluenceIds: ["influence_1"],
    participantAgentIds: ["agent_leader", "agent_vanguard", "agent_scout"],
    participantExplorerIds: ["explorer_leader", "explorer_vanguard", "explorer_scout"],
    scoutAgentIds: ["agent_scout"],
    parentTraceId: "trace_parent",
    createdAt: "2026-07-07T01:00:00.000Z",
  });
});

test("combat settlement rules plan party run settlement event sequences", () => {
  const occurredAt = "2026-07-07T01:00:00.000Z";
  const idFactory = createSequentialEpochIdFactory("party_settlement");
  const makeEvent = eventFactory(() => new Date(occurredAt), idFactory, {
    actorExplorerId: "operator",
    trustClass: "system_worker",
  });
  const memberResults = partyRunMemberSettlementResults("party_1", [
    {
      agentId: "agent_leader",
      explorerId: "explorer_leader",
      participantRole: "leader",
    },
    {
      agentId: "agent_scout",
      explorerId: "explorer_scout",
      participantRole: "scout",
    },
  ]);

  const events = planPartyRunSettlementEvents({
    makeEvent,
    idFactory,
    partyRunId: "party_1",
    regionId: "region_gray_harbor",
    leaderAgentId: "agent_leader",
    partyTitle: "灰港巡夜",
    partyObjective: "巡查码头",
    partyMemberCount: 2,
    memberResults,
    totalScore: partyRunTotalScore(memberResults),
    traceId: "trace_1",
    newsId: "news_1",
    parentTraceId: "trace_parent",
    settledAt: occurredAt,
    rewardBalanceBefore: () => 5,
    previousInfluenceScore: () => 2,
  });

  assert.deepEqual(events.map((event) => event.eventType), [
    "party_run_settled",
    "resource_granted",
    "resource_granted",
    "region_influence_changed",
    "region_influence_changed",
    "trace_created",
    "region_news_generated",
  ]);
  assert.equal(events[0].aggregateType, "party_run");
  assert.equal(events[1].aggregateType, "resource_account");
  const influencePayload = events[3].payload as { readonly sourceEventId?: string };
  const tracePayload = events[5].payload as { readonly parentTraceId?: string };
  const newsPayload = events[6].payload as { readonly sourceEventIds?: readonly string[] };
  assert.equal(influencePayload.sourceEventId, events[0].eventId);
  assert.equal(tracePayload.parentTraceId, "trace_parent");
  assert.deepEqual(newsPayload.sourceEventIds, [events[0].eventId, events[5].eventId]);
});

test("combat settlement rules read raid cooldown and heat projections", () => {
  const projection = {
    raidIdsByRegion: {
      region_gray_harbor: ["raid_old", "raid_recent", "missing", "raid_reverse", "raid_other"],
    },
    raidResults: {
      raid_old: {
        attackerAgentId: "agent_attacker",
        defenderAgentId: "agent_defender",
        resolvedAt: "2026-07-07T01:00:00.000Z",
        reward: { resourceId: "legend", amount: 1, reason: "raid_attack_success" },
      },
      raid_recent: {
        attackerAgentId: "agent_attacker",
        defenderAgentId: "agent_defender",
        resolvedAt: "2026-07-07T02:00:00.000Z",
        reward: { resourceId: "legend", amount: 0, reason: "raid_repeat_reward_decayed" },
      },
      raid_reverse: {
        attackerAgentId: "agent_defender",
        defenderAgentId: "agent_attacker",
        resolvedAt: "2026-07-07T03:00:00.000Z",
        reward: { resourceId: "legend", amount: 0, reason: "raid_region_heat_reward_decayed" },
      },
      raid_other: {
        attackerAgentId: "agent_other",
        defenderAgentId: "agent_guard",
        resolvedAt: "2026-07-07T04:00:00.000Z",
        reward: { resourceId: "legend", amount: 1, reason: "raid_defense_success" },
      },
    },
  } as const;

  assert.equal(raidRegionalHeatScoreDelta(projection.raidResults.raid_recent), 2);
  assert.equal(latestRaidPairResolvedAt(
    projection,
    "region_gray_harbor",
    "agent_attacker",
    "agent_defender",
  ), "2026-07-07T03:00:00.000Z");
  assert.equal(latestRaidPairResolvedAt(
    projection,
    "region_gray_harbor",
    "agent_missing",
    "agent_defender",
  ), undefined);
  assert.equal(raidPairResolvedCountSince(
    projection,
    "region_gray_harbor",
    "agent_attacker",
    "agent_defender",
    "2026-07-07T01:30:00.000Z",
  ), 2);
  assert.equal(regionRaidHeatScoreSince(
    projection,
    "region_gray_harbor",
    "2026-07-07T01:30:00.000Z",
  ), 4);
  assert.equal(regionRaidHeatScoreSince(
    projection,
    "region_missing",
    "2026-07-07T01:30:00.000Z",
  ), 0);
});

test("combat settlement rules plan raid resolved payloads", () => {
  const reward = {
    resourceId: "legend",
    amount: 1,
    reason: "raid_attack_success",
  } as const;

  assert.deepEqual(raidAttackStaminaSpendPayload({
    raidId: "raid_1",
    staminaSpent: 3,
    attackerStaminaBefore: 8,
  }), {
    resourceId: "stamina",
    amount: 3,
    reason: "raid_attack:raid_1",
    balanceAfter: 5,
  });

  assert.deepEqual(raidRewardGrantPayload({
    reward,
    winnerRewardBalanceBefore: 4,
  }), {
    resourceId: "legend",
    amount: 1,
    reason: "raid_attack_success",
    balanceAfter: 5,
  });

  assert.deepEqual(raidResolvedPayload({
    raidId: "raid_1",
    regionId: "region_gray_harbor",
    attackerAgentId: "agent_attacker",
    attackerExplorerId: "explorer_attacker",
    defenderAgentId: "agent_defender",
    defenderExplorerId: "explorer_defender",
    staminaSpent: 3,
    attackerPower: 8,
    defenderPower: 6,
    outcome: "attacker_won",
    reward,
    resolvedAt: "2026-07-07T01:00:00.000Z",
  }), {
    raidId: "raid_1",
    regionId: "region_gray_harbor",
    attackerAgentId: "agent_attacker",
    attackerExplorerId: "explorer_attacker",
    defenderAgentId: "agent_defender",
    defenderExplorerId: "explorer_defender",
    staminaSpent: 3,
    attackerPower: 8,
    defenderPower: 6,
    outcome: "attacker_won",
    reward,
    resolvedAt: "2026-07-07T01:00:00.000Z",
  });

  assert.deepEqual(raidSettlementInfluencePayload({
    influenceId: "influence_raid",
    raidId: "raid_1",
    regionId: "region_gray_harbor",
    winnerAgentId: "agent_attacker",
    winnerExplorerId: "explorer_attacker",
    previousInfluenceScore: 3,
    reward,
    sourceEventId: "event_raid",
    changedAt: "2026-07-07T01:00:00.000Z",
  }), {
    influenceId: "influence_raid",
    regionId: "region_gray_harbor",
    agentId: "agent_attacker",
    explorerId: "explorer_attacker",
    influenceDelta: 8,
    influenceScoreAfter: 11,
    reason: "raid_settlement:raid_1",
    sourceEventId: "event_raid",
    sourceEventType: "raid_resolved",
    sourceAggregateId: "raid_1",
    changedAt: "2026-07-07T01:00:00.000Z",
  });

  assert.deepEqual(raidSettlementTracePayload({
    traceId: "trace_raid",
    raidId: "raid_1",
    regionId: "region_gray_harbor",
    winnerAgentId: "agent_attacker",
    outcome: "attacker_won",
    sourceEventIds: ["event_raid", "event_influence"],
    relatedInfluenceIds: ["influence_raid"],
    attackerAgentId: "agent_attacker",
    attackerExplorerId: "explorer_attacker",
    defenderAgentId: "agent_defender",
    defenderExplorerId: "explorer_defender",
    parentTraceId: "trace_parent",
    createdAt: "2026-07-07T01:00:00.000Z",
  }), {
    traceId: "trace_raid",
    regionId: "region_gray_harbor",
    title: "突袭结算 raid_1",
    summary: "agent_attacker 在突袭中胜出，结果为 attacker_won。",
    sourceEventType: "raid_resolved",
    sourceEventIds: ["event_raid", "event_influence"],
    sourceAggregateId: "raid_1",
    relatedInfluenceIds: ["influence_raid"],
    participantAgentIds: ["agent_attacker", "agent_defender"],
    participantExplorerIds: ["explorer_attacker", "explorer_defender"],
    parentTraceId: "trace_parent",
    createdAt: "2026-07-07T01:00:00.000Z",
  });
});

test("combat settlement rules plan retaliation opportunity payloads", () => {
  assert.deepEqual(retaliationOpportunityCreatedPayload({
    retaliationId: "retaliation_1",
    regionId: "region_gray_harbor",
    sourceRaidId: "raid_1",
    sourceTraceId: "trace_1",
    opportunityAgentId: "agent_defender",
    opportunityExplorerId: "explorer_defender",
    targetAgentId: "agent_attacker",
    targetExplorerId: "explorer_attacker",
    reason: "raid_defender_retaliation",
    sourceEventIds: ["event_raid", "event_trace"],
    createdAt: "2026-07-07T01:00:00.000Z",
  }), {
    retaliationId: "retaliation_1",
    regionId: "region_gray_harbor",
    sourceRaidId: "raid_1",
    sourceTraceId: "trace_1",
    opportunityAgentId: "agent_defender",
    opportunityExplorerId: "explorer_defender",
    targetAgentId: "agent_attacker",
    targetExplorerId: "explorer_attacker",
    status: "open",
    reason: "raid_defender_retaliation",
    sourceEventIds: ["event_raid", "event_trace"],
    createdAt: "2026-07-07T01:00:00.000Z",
  });
});

test("combat settlement rules plan retaliation resolved payloads", () => {
  const reward = {
    resourceId: "legend",
    amount: 1,
    reason: "retaliation_success",
  } as const;

  assert.deepEqual(retaliationStaminaSpendPayload({
    retaliationId: "retaliation_1",
    staminaSpent: 2,
    retaliatorStaminaBefore: 7,
  }), {
    resourceId: "stamina",
    amount: 2,
    reason: "retaliation:retaliation_1",
    balanceAfter: 5,
  });

  assert.deepEqual(retaliationRewardGrantPayload({
    reward,
    winnerRewardBalanceBefore: 9,
  }), {
    resourceId: "legend",
    amount: 1,
    reason: "retaliation_success",
    balanceAfter: 10,
  });

  assert.deepEqual(retaliationResolvedPayload({
    retaliationId: "retaliation_1",
    regionId: "region_gray_harbor",
    sourceRaidId: "raid_1",
    sourceTraceId: "trace_1",
    opportunityAgentId: "agent_defender",
    opportunityExplorerId: "explorer_defender",
    targetAgentId: "agent_attacker",
    targetExplorerId: "explorer_attacker",
    staminaSpent: 2,
    retaliatorPower: 7,
    targetPower: 5,
    outcome: "retaliator_won",
    winnerAgentId: "agent_defender",
    winnerExplorerId: "explorer_defender",
    reward,
    resolvedAt: "2026-07-07T02:00:00.000Z",
  }), {
    retaliationId: "retaliation_1",
    regionId: "region_gray_harbor",
    sourceRaidId: "raid_1",
    sourceTraceId: "trace_1",
    opportunityAgentId: "agent_defender",
    opportunityExplorerId: "explorer_defender",
    targetAgentId: "agent_attacker",
    targetExplorerId: "explorer_attacker",
    staminaSpent: 2,
    retaliatorPower: 7,
    targetPower: 5,
    outcome: "retaliator_won",
    winnerAgentId: "agent_defender",
    winnerExplorerId: "explorer_defender",
    reward,
    resolvedAt: "2026-07-07T02:00:00.000Z",
  });

  assert.deepEqual(retaliationSettlementInfluencePayload({
    influenceId: "influence_retaliation",
    retaliationId: "retaliation_1",
    regionId: "region_gray_harbor",
    winnerAgentId: "agent_defender",
    winnerExplorerId: "explorer_defender",
    previousInfluenceScore: 4,
    reward,
    sourceEventId: "event_retaliation",
    changedAt: "2026-07-07T02:00:00.000Z",
  }), {
    influenceId: "influence_retaliation",
    regionId: "region_gray_harbor",
    agentId: "agent_defender",
    explorerId: "explorer_defender",
    influenceDelta: 6,
    influenceScoreAfter: 10,
    reason: "retaliation_settlement:retaliation_1",
    sourceEventId: "event_retaliation",
    sourceEventType: "retaliation_resolved",
    sourceAggregateId: "retaliation_1",
    changedAt: "2026-07-07T02:00:00.000Z",
  });

  assert.deepEqual(retaliationSettlementTracePayload({
    traceId: "trace_retaliation",
    retaliationId: "retaliation_1",
    regionId: "region_gray_harbor",
    winnerAgentId: "agent_defender",
    outcome: "retaliator_won",
    sourceEventIds: ["event_retaliation", "event_influence"],
    relatedInfluenceIds: ["influence_retaliation"],
    opportunityAgentId: "agent_defender",
    opportunityExplorerId: "explorer_defender",
    targetAgentId: "agent_attacker",
    targetExplorerId: "explorer_attacker",
    parentTraceId: "trace_parent",
    createdAt: "2026-07-07T02:00:00.000Z",
  }), {
    traceId: "trace_retaliation",
    regionId: "region_gray_harbor",
    title: "复仇结算 retaliation_1",
    summary: "agent_defender 在复仇中胜出，结果为 retaliator_won。",
    sourceEventType: "retaliation_resolved",
    sourceEventIds: ["event_retaliation", "event_influence"],
    sourceAggregateId: "retaliation_1",
    relatedInfluenceIds: ["influence_retaliation"],
    participantAgentIds: ["agent_defender", "agent_attacker"],
    participantExplorerIds: ["explorer_defender", "explorer_attacker"],
    parentTraceId: "trace_parent",
    createdAt: "2026-07-07T02:00:00.000Z",
  });
});

test("combat settlement rules plan raid and retaliation resolution event sequences", () => {
  const occurredAt = "2026-07-07T04:00:00.000Z";
  const idFactory = createSequentialEpochIdFactory("raid_resolution");
  const makeEvent = eventFactory(() => new Date(occurredAt), idFactory, {
    actorExplorerId: "explorer_attacker",
    trustClass: "user_verified_web" as const,
    causationId: "raid_resolution",
    correlationId: "corr_raid_resolution",
  });
  const raidReward = {
    resourceId: "legend",
    amount: 1,
    reason: "raid_attack_success",
  } as const;
  const raidEvents = planRaidResolutionEvents({
    makeEvent,
    raidId: "raid_1",
    regionId: "region_gray_harbor",
    attackerAgentId: "agent_attacker",
    attackerExplorerId: "explorer_attacker",
    defenderAgentId: "agent_defender",
    defenderExplorerId: "explorer_defender",
    staminaSpent: 3,
    attackerPower: 8,
    defenderPower: 6,
    outcome: "attacker_won",
    reward: raidReward,
    resolvedAt: occurredAt,
    attackerStaminaBefore: 9,
    winnerRewardBalanceBefore: 2,
    influenceId: "influence_raid",
    previousInfluenceScore: 4,
    traceId: "trace_raid",
    parentTraceId: "trace_parent",
    retaliationId: "retaliation_1",
  });
  assert.deepEqual(raidEvents.map((event) => event.eventType), [
    "resource_spent",
    "resource_granted",
    "raid_resolved",
    "region_influence_changed",
    "trace_created",
    "retaliation_opportunity_created",
  ]);
  const raidResolved = raidEvents.find((event) => event.eventType === "raid_resolved");
  const raidInfluence = raidEvents.find((event) => event.eventType === "region_influence_changed");
  const raidTrace = raidEvents.find((event) => event.eventType === "trace_created");
  const retaliationCreated = raidEvents.find((event) => event.eventType === "retaliation_opportunity_created");
  if (!raidResolved || raidResolved.eventType !== "raid_resolved") throw new Error("expected_raid_resolved");
  if (!raidInfluence || raidInfluence.eventType !== "region_influence_changed") throw new Error("expected_raid_influence");
  if (!raidTrace || raidTrace.eventType !== "trace_created") throw new Error("expected_raid_trace");
  if (!retaliationCreated || retaliationCreated.eventType !== "retaliation_opportunity_created") {
    throw new Error("expected_retaliation_created");
  }
  assert.equal(raidEvents[0]?.aggregateId, "agent_attacker");
  assert.equal(raidResolved.aggregateId, "raid_1");
  assert.equal(retaliationCreated.aggregateId, "retaliation_1");
  assert.equal(retaliationCreated.payload.opportunityAgentId, "agent_defender");
  assert.equal(retaliationCreated.payload.targetAgentId, "agent_attacker");
  assert.equal(retaliationCreated.payload.sourceTraceId, "trace_raid");
  assert.deepEqual(retaliationCreated.payload.sourceEventIds, [
    raidResolved.eventId,
    raidInfluence.eventId,
    raidTrace.eventId,
  ]);
  const projectedRaid = {
    raidId: "raid_1",
    attackerAgentId: "agent_attacker",
    defenderAgentId: "agent_defender",
    resolvedAt: occurredAt,
    reward: raidReward,
    marker: "projected",
  } as const;
  assert.equal(projectRaidResolution({
    events: raidEvents,
    projection: { raidResults: { raid_1: projectedRaid } },
  }), projectedRaid);
  assert.throws(() => projectRaidResolution({
    events: [],
    projection: { raidResults: { raid_1: projectedRaid } },
  }), /raid_resolved_event_missing/);
  assert.throws(() => projectRaidResolution({
    events: raidEvents,
    projection: { raidResults: {} },
  }), /raid_projection_failed/);

  const noRewardRaidEvents = planRaidResolutionEvents({
    makeEvent,
    raidId: "raid_no_reward",
    regionId: "region_gray_harbor",
    attackerAgentId: "agent_attacker",
    attackerExplorerId: "explorer_attacker",
    defenderAgentId: "agent_defender",
    defenderExplorerId: "explorer_defender",
    staminaSpent: 3,
    attackerPower: 6,
    defenderPower: 8,
    outcome: "defender_won",
    reward: {
      resourceId: "legend",
      amount: 0,
      reason: "raid_repeat_reward_decayed",
    },
    resolvedAt: occurredAt,
    attackerStaminaBefore: 9,
    traceId: "trace_raid_no_reward",
    retaliationId: "retaliation_no_reward",
  });
  assert.deepEqual(noRewardRaidEvents.map((event) => event.eventType), [
    "resource_spent",
    "raid_resolved",
    "trace_created",
    "retaliation_opportunity_created",
  ]);

  const retaliationReward = {
    resourceId: "legend",
    amount: 1,
    reason: "retaliation_success",
  } as const;
  const retaliationEvents = planRetaliationResolutionEvents({
    makeEvent,
    retaliationId: "retaliation_1",
    regionId: "region_gray_harbor",
    sourceRaidId: "raid_1",
    sourceTraceId: "trace_raid",
    opportunityAgentId: "agent_defender",
    opportunityExplorerId: "explorer_defender",
    targetAgentId: "agent_attacker",
    targetExplorerId: "explorer_attacker",
    staminaSpent: 2,
    retaliatorPower: 7,
    targetPower: 5,
    outcome: "retaliator_won",
    winnerAgentId: "agent_defender",
    winnerExplorerId: "explorer_defender",
    reward: retaliationReward,
    resolvedAt: occurredAt,
    retaliatorStaminaBefore: 6,
    winnerRewardBalanceBefore: 3,
    influenceId: "influence_retaliation",
    previousInfluenceScore: 5,
    traceId: "trace_retaliation",
    parentTraceId: "trace_parent",
  });
  assert.deepEqual(retaliationEvents.map((event) => event.eventType), [
    "resource_spent",
    "resource_granted",
    "retaliation_resolved",
    "region_influence_changed",
    "trace_created",
  ]);
  const retaliationResolved = retaliationEvents.find((event) => event.eventType === "retaliation_resolved");
  const retaliationInfluence = retaliationEvents.find((event) => event.eventType === "region_influence_changed");
  const retaliationTrace = retaliationEvents.find((event) => event.eventType === "trace_created");
  if (!retaliationResolved || retaliationResolved.eventType !== "retaliation_resolved") {
    throw new Error("expected_retaliation_resolved");
  }
  if (!retaliationInfluence || retaliationInfluence.eventType !== "region_influence_changed") {
    throw new Error("expected_retaliation_influence");
  }
  if (!retaliationTrace || retaliationTrace.eventType !== "trace_created") {
    throw new Error("expected_retaliation_trace");
  }
  assert.deepEqual(retaliationTrace.payload.sourceEventIds, [
    retaliationResolved.eventId,
    retaliationInfluence.eventId,
  ]);
  const projectedRetaliation = {
    retaliationId: "retaliation_1",
    status: "resolved",
    marker: "projected",
  } as const;
  assert.equal(projectRetaliationResolution({
    events: retaliationEvents,
    projection: { retaliationOpportunities: { retaliation_1: projectedRetaliation } },
  }), projectedRetaliation);
  assert.throws(() => projectRetaliationResolution({
    events: [],
    projection: { retaliationOpportunities: { retaliation_1: projectedRetaliation } },
  }), /retaliation_resolved_event_missing/);
  assert.throws(() => projectRetaliationResolution({
    events: retaliationEvents,
    projection: { retaliationOpportunities: {} },
  }), /retaliation_projection_failed/);
});
