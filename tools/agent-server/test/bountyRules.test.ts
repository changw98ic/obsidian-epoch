import assert from "node:assert/strict";
import test from "node:test";

import {
  bountyClaimInfluenceDelta,
  bountyClaimInfluencePayload,
  bountyClaimRewardPayload,
  bountyClaimTracePayload,
  bountyClaimedPayload,
  bountyCreatedPayload,
  bountyEscrowSpendPayload,
  bountyFulfillmentItemTransferPayload,
  planBountyClaimEvents,
  planBountyCreationEvents,
  projectBountyClaim,
  projectBountyCreation,
  requireBounty,
  requireOpenBounty,
  type BountyForRules,
} from "../lib/epoch/bountyRules.ts";
import { eventFactory } from "../lib/epoch/eventFactory.ts";
import { createSequentialEpochIdFactory } from "../lib/epoch/protocol.ts";

const bounty: BountyForRules = {
  bountyId: "bounty_1",
  regionId: "region_gray_harbor",
  sponsorAgentId: "agent_sponsor",
  sponsorExplorerId: "explorer_sponsor",
  title: "追回黑曜样本",
  rewardResourceId: "coin",
  rewardAmount: 7,
  requiredItemKey: "obsidian_sample",
};

test("bounty rules read bounty projection state", () => {
  const projection = {
    bounties: {
      bounty_open: { status: "open", marker: "open" },
      bounty_claimed: { status: "claimed", marker: "claimed" },
    },
  };

  assert.equal(requireBounty(projection, "bounty_open").marker, "open");
  assert.equal(requireOpenBounty(projection, "bounty_open").marker, "open");
  assert.throws(() => requireBounty(projection, "missing"), /bounty_not_found/);
  assert.throws(() => requireOpenBounty(projection, "bounty_claimed"), /bounty_not_open/);
});

test("bounty rules plan escrow and created payloads", () => {
  assert.deepEqual(bountyEscrowSpendPayload("coin", 7, "bounty_1", 3), {
    resourceId: "coin",
    amount: 7,
    reason: "bounty_lock:bounty_1",
    balanceAfter: 3,
  });
  assert.deepEqual(bountyCreatedPayload({
    bountyId: "bounty_1",
    regionId: "region_gray_harbor",
    sponsorAgentId: "agent_sponsor",
    sponsorExplorerId: "explorer_sponsor",
    title: "追回黑曜样本",
    description: "  带回失踪货箱  ",
    rewardResourceId: "coin",
    rewardAmount: 7,
    requiredItemKey: "obsidian_sample",
    createdAt: "2026-07-07T05:00:00.000Z",
  }), {
    bountyId: "bounty_1",
    regionId: "region_gray_harbor",
    sponsorAgentId: "agent_sponsor",
    sponsorExplorerId: "explorer_sponsor",
    title: "追回黑曜样本",
    description: "带回失踪货箱",
    rewardResourceId: "coin",
    rewardAmount: 7,
    requiredItemKey: "obsidian_sample",
    createdAt: "2026-07-07T05:00:00.000Z",
  });
});

test("bounty rules plan creation event sequences", () => {
  const createdAt = "2026-07-07T05:00:00.000Z";
  const idFactory = createSequentialEpochIdFactory("bounty_creation");
  const makeEvent = eventFactory(() => new Date(createdAt), idFactory, {
    actorExplorerId: "explorer_sponsor",
    trustClass: "user_verified_web" as const,
    causationId: "bounty_creation",
    correlationId: "corr_bounty_creation",
  });
  const events = planBountyCreationEvents({
    bountyId: "bounty_1",
    regionId: "region_gray_harbor",
    sponsorAgentId: "agent_sponsor",
    sponsorExplorerId: "explorer_sponsor",
    title: "追回黑曜样本",
    description: "带回失踪货箱",
    rewardResourceId: "coin",
    rewardAmount: 7,
    requiredItemKey: "obsidian_sample",
    createdAt,
    sponsorBalanceBefore: 10,
    makeEvent,
  });

  assert.deepEqual(events.map((event) => event.eventType), [
    "resource_spent",
    "bounty_created",
  ]);
  const [locked, created] = events;
  assert.equal(locked?.aggregateType, "resource_account");
  assert.equal(locked?.aggregateId, "agent_sponsor");
  assert.equal(created?.aggregateType, "bounty");
  assert.equal(created?.aggregateId, "bounty_1");
  if (locked?.eventType !== "resource_spent") throw new Error("expected_bounty_lock");
  if (created?.eventType !== "bounty_created") throw new Error("expected_bounty_created");
  assert.equal(locked.payload.reason, "bounty_lock:bounty_1");
  assert.equal(locked.payload.balanceAfter, 3);
  assert.equal(created.payload.requiredItemKey, "obsidian_sample");

  const projectedBounty = {
    bountyId: "bounty_1",
    status: "open",
    marker: "created",
  } as const;
  assert.equal(projectBountyCreation({
    events,
    projection: {
      bounties: {
        bounty_1: projectedBounty,
      },
    },
  }), projectedBounty);
  assert.throws(() => projectBountyCreation({
    events: [],
    projection: {
      bounties: {
        bounty_1: projectedBounty,
      },
    },
  }), /bounty_created_event_missing/);
  assert.throws(() => projectBountyCreation({
    events,
    projection: {
      bounties: {},
    },
  }), /bounty_projection_failed/);
});

test("bounty rules plan claimed reward and event payloads", () => {
  assert.deepEqual(bountyClaimRewardPayload(bounty, 12), {
    resourceId: "coin",
    amount: 7,
    reason: "bounty_claim:bounty_1",
    balanceAfter: 12,
  });
  assert.deepEqual(bountyClaimedPayload({
    bountyId: "bounty_1",
    claimantAgentId: "agent_hunter",
    claimantExplorerId: "explorer_hunter",
    transferredItemId: "item_1",
    evidence: "server_verified_bounty_claim",
    claimedAt: "2026-07-07T05:10:00.000Z",
  }), {
    bountyId: "bounty_1",
    claimantAgentId: "agent_hunter",
    claimantExplorerId: "explorer_hunter",
    transferredItemId: "item_1",
    evidence: "server_verified_bounty_claim",
    claimedAt: "2026-07-07T05:10:00.000Z",
  });
  assert.deepEqual(bountyFulfillmentItemTransferPayload({
    bounty,
    itemId: "item_1",
    claimantAgentId: "agent_hunter",
    claimantExplorerId: "explorer_hunter",
    transferredAt: "2026-07-07T05:10:00.000Z",
  }), {
    itemId: "item_1",
    fromAgentId: "agent_hunter",
    fromExplorerId: "explorer_hunter",
    toAgentId: "agent_sponsor",
    toExplorerId: "explorer_sponsor",
    sourceOrderId: "bounty_1",
    transferredAt: "2026-07-07T05:10:00.000Z",
  });
});

test("bounty rules plan claim event sequences", () => {
  const claimedAt = "2026-07-07T05:10:00.000Z";
  const idFactory = createSequentialEpochIdFactory("bounty_claim");
  const makeEvent = eventFactory(() => new Date(claimedAt), idFactory, {
    actorExplorerId: "explorer_hunter",
    trustClass: "user_verified_web" as const,
    causationId: "bounty_claim",
    correlationId: "corr_bounty_claim",
  });
  const events = planBountyClaimEvents({
    bounty,
    claimantAgentId: "agent_hunter",
    claimantExplorerId: "explorer_hunter",
    claimantRewardBalanceBefore: 5,
    transferredItemId: "item_1",
    evidence: "server_verified_bounty_claim",
    influenceId: "influence_1",
    influenceScoreBefore: 12,
    traceId: "trace_1",
    participantAgentIds: ["agent_sponsor", "agent_hunter"],
    participantExplorerIds: ["explorer_sponsor", "explorer_hunter"],
    parentTraceId: "trace_parent",
    claimedAt,
    makeEvent,
  });

  assert.deepEqual(events.map((event) => event.eventType), [
    "resource_granted",
    "item_transferred",
    "bounty_claimed",
    "region_influence_changed",
    "trace_created",
  ]);
  const [rewardGranted, itemTransferred, claimed, influenceChanged, traceCreated] = events;
  assert.equal(rewardGranted?.aggregateId, "agent_hunter");
  assert.equal(itemTransferred?.aggregateId, "item_1");
  assert.equal(claimed?.aggregateType, "bounty");
  assert.equal(influenceChanged?.aggregateType, "region");
  assert.equal(traceCreated?.aggregateType, "trace");
  if (rewardGranted?.eventType !== "resource_granted") throw new Error("expected_reward_granted");
  if (itemTransferred?.eventType !== "item_transferred") throw new Error("expected_item_transferred");
  if (claimed?.eventType !== "bounty_claimed") throw new Error("expected_bounty_claimed");
  if (influenceChanged?.eventType !== "region_influence_changed") throw new Error("expected_region_influence_changed");
  if (traceCreated?.eventType !== "trace_created") throw new Error("expected_trace_created");
  assert.equal(rewardGranted.payload.balanceAfter, 12);
  assert.equal(itemTransferred.payload.toAgentId, "agent_sponsor");
  assert.equal(influenceChanged.payload.sourceEventId, claimed.eventId);
  assert.equal(influenceChanged.payload.influenceScoreAfter, 19);
  assert.deepEqual(traceCreated.payload.sourceEventIds, [claimed.eventId, influenceChanged.eventId]);
  assert.equal(traceCreated.payload.parentTraceId, "trace_parent");

  assert.deepEqual(planBountyClaimEvents({
    bounty,
    claimantAgentId: "agent_hunter",
    claimantExplorerId: "explorer_hunter",
    claimantRewardBalanceBefore: 5,
    evidence: "server_verified_bounty_claim",
    influenceId: "influence_1",
    influenceScoreBefore: 12,
    traceId: "trace_1",
    participantAgentIds: ["agent_sponsor", "agent_hunter"],
    participantExplorerIds: ["explorer_sponsor", "explorer_hunter"],
    claimedAt,
    makeEvent,
  }).map((event) => event.eventType), [
    "resource_granted",
    "bounty_claimed",
    "region_influence_changed",
    "trace_created",
  ]);

  const projectedBounty = {
    bountyId: "bounty_1",
    status: "claimed",
    marker: "claimed",
  } as const;
  assert.equal(projectBountyClaim({
    events,
    projection: {
      bounties: {
        bounty_1: projectedBounty,
      },
    },
  }), projectedBounty);
  assert.throws(() => projectBountyClaim({
    events: [],
    projection: {
      bounties: {
        bounty_1: projectedBounty,
      },
    },
  }), /bounty_claimed_event_missing/);
  assert.throws(() => projectBountyClaim({
    events,
    projection: {
      bounties: {},
    },
  }), /bounty_projection_failed/);
});

test("bounty rules plan influence and trace payloads", () => {
  assert.equal(bountyClaimInfluenceDelta(bounty), 7);
  assert.deepEqual(bountyClaimInfluencePayload({
    influenceId: "influence_1",
    bounty,
    claimantAgentId: "agent_hunter",
    claimantExplorerId: "explorer_hunter",
    influenceScoreAfter: 19,
    sourceEventId: "event_claimed",
    claimedAt: "2026-07-07T05:10:00.000Z",
  }), {
    influenceId: "influence_1",
    regionId: "region_gray_harbor",
    agentId: "agent_hunter",
    explorerId: "explorer_hunter",
    influenceDelta: 7,
    influenceScoreAfter: 19,
    reason: "bounty_claim:bounty_1",
    sourceEventId: "event_claimed",
    sourceEventType: "bounty_claimed",
    sourceAggregateId: "bounty_1",
    changedAt: "2026-07-07T05:10:00.000Z",
  });
  assert.deepEqual(bountyClaimTracePayload({
    traceId: "trace_1",
    bounty,
    claimantAgentId: "agent_hunter",
    claimedEventId: "event_claimed",
    influenceEventId: "event_influence",
    influenceId: "influence_1",
    participantAgentIds: ["agent_sponsor", "agent_hunter"],
    participantExplorerIds: ["explorer_sponsor", "explorer_hunter"],
    parentTraceId: "trace_parent",
    createdAt: "2026-07-07T05:10:00.000Z",
  }), {
    traceId: "trace_1",
    regionId: "region_gray_harbor",
    title: "追回黑曜样本完成",
    summary: "agent_hunter 领取了 追回黑曜样本 的悬赏。",
    sourceEventType: "bounty_claimed",
    sourceEventIds: ["event_claimed", "event_influence"],
    sourceAggregateId: "bounty_1",
    relatedInfluenceIds: ["influence_1"],
    participantAgentIds: ["agent_sponsor", "agent_hunter"],
    participantExplorerIds: ["explorer_sponsor", "explorer_hunter"],
    parentTraceId: "trace_parent",
    createdAt: "2026-07-07T05:10:00.000Z",
  });
});
