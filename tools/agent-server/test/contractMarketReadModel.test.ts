import assert from "node:assert/strict";
import test from "node:test";

import {
  contractMarketBoardView,
  contractMarketContractView,
  contractMarketSummaryView,
} from "../lib/epoch/contractMarketReadModel.ts";
import type {
  ContractMarketContract,
  ContractMarketProjection,
} from "../lib/epoch/contractMarketRules.ts";

function contract(
  overrides: Partial<ContractMarketContract> = {},
): ContractMarketContract {
  return {
    contractId: "contract_default",
    contractType: "evidence",
    regionId: "region_gray_harbor",
    creatorAgentId: "agent_creator",
    creatorExplorerId: "explorer_creator_private",
    title: "Recover the ledger",
    description: "Submit canonical event evidence.",
    reward: { resourceId: "coin", amount: 50 },
    target: {
      kind: "agent",
      agentId: "agent_target",
      explorerId: "explorer_target_private",
    },
    status: "open",
    riskFlags: [],
    riskScore: 0,
    escrow: {
      status: "locked",
      reward: { resourceId: "coin", amount: 50 },
      sponsorAgentId: "agent_creator",
      sponsorExplorerId: "explorer_creator_private",
      lockedAt: "2026-07-10T01:00:00.000Z",
    },
    createdAt: "2026-07-10T01:00:00.000Z",
    expiresAt: "2026-07-11T01:00:00.000Z",
    ...overrides,
  };
}

function projection(contracts: readonly ContractMarketContract[]): ContractMarketProjection {
  return {
    contracts: Object.fromEntries(contracts.map((item) => [item.contractId, item])),
  };
}

test("contract market public view redacts explorer and NPC protection metadata", () => {
  const item = contract({
    contractId: "contract_protection / 1",
    contractType: "protection",
    contractorAgentId: "agent_contractor",
    contractorExplorerId: "explorer_contractor_private",
    sourceBountyId: "bounty / source",
    status: "submitted",
    target: {
      kind: "npc",
      npcId: "npc_child",
      traits: ["child", "quiet"],
      familyRole: "child",
      householdIds: ["household_private"],
    },
    riskFlags: ["high_value_contract"],
    riskScore: 2,
    acceptedAt: "2026-07-10T02:00:00.000Z",
    submission: {
      summary: "Protection route verified.",
      sourceEventIds: ["event / source"],
      submittedAt: "2026-07-10T03:00:00.000Z",
    },
    adjudication: {
      decisionId: "decision_1",
      resolution: "approved",
      reason: "Server evidence accepted.",
      sourceEventIds: ["event_decision"],
      adjudicatedBy: "system_adjudicator_private",
      adjudicatedAt: "2026-07-10T04:00:00.000Z",
    },
  });

  const view = contractMarketContractView(item);
  assert.deepEqual(view.target, { kind: "npc", npcId: "npc_child" });
  assert.equal(JSON.stringify(view).includes("explorer_creator_private"), false);
  assert.equal(JSON.stringify(view).includes("explorer_contractor_private"), false);
  assert.equal(JSON.stringify(view).includes("household_private"), false);
  assert.equal(JSON.stringify(view).includes("system_adjudicator_private"), false);
  assert.equal(view.reviewRequired, true);
  assert.deepEqual(view.submission?.sourceEvents, [{
    eventId: "event / source",
    audit: "/epoch/audit/event%20%2F%20source",
  }]);
  assert.deepEqual(view.publicPages, {
    contract: "/epoch/contract/contract_protection%20%2F%201",
    audit: "/epoch/audit?aggregateId=contract_protection%20%2F%201",
    region: "/epoch/region/region_gray_harbor",
    creator: "/epoch/agent/agent_creator",
    contractor: "/epoch/agent/agent_contractor",
    sourceBounty: "/epoch/bounty/bounty%20%2F%20source",
  });
});

test("contract market board filters participants and prioritizes actionable states", () => {
  const open = contract({
    contractId: "contract_open",
    contractType: "scouting",
    target: { kind: "region", regionId: "region_gray_harbor" },
    createdAt: "2026-07-10T04:00:00.000Z",
  });
  const accepted = contract({
    contractId: "contract_accepted",
    contractType: "protection",
    status: "accepted",
    contractorAgentId: "agent_participant",
    contractorExplorerId: "explorer_participant_private",
    acceptedAt: "2026-07-10T05:00:00.000Z",
  });
  const submitted = contract({
    contractId: "contract_submitted",
    contractType: "bounty",
    status: "submitted",
    target: {
      kind: "agent",
      agentId: "agent_participant",
      explorerId: "explorer_target_private",
    },
    contractorAgentId: "agent_hunter",
    contractorExplorerId: "explorer_hunter_private",
    submission: {
      summary: "Canonical result.",
      sourceEventIds: ["event_result"],
      submittedAt: "2026-07-10T06:00:00.000Z",
    },
  });
  const completed = contract({
    contractId: "contract_completed",
    regionId: "region_other",
    status: "completed",
    completedAt: "2026-07-10T07:00:00.000Z",
  });
  const world = projection([open, accepted, submitted, completed]);

  const participantView = contractMarketBoardView(world, {
    regionId: "region_gray_harbor",
    agentId: "agent_participant",
    limit: 1,
  });
  assert.equal(participantView.total, 2);
  assert.equal(participantView.truncated, true);
  assert.deepEqual(participantView.contracts.map((item) => item.contractId), ["contract_submitted"]);

  const protectionView = contractMarketBoardView(world, {
    contractType: "protection",
    status: "accepted",
  });
  assert.deepEqual(protectionView.contracts.map((item) => item.contractId), ["contract_accepted"]);
});

test("contract market summary reports state, type, risk, and escrow reward totals", () => {
  const locked = contract({
    contractId: "contract_locked",
    contractType: "scouting",
    reward: { resourceId: "coin", amount: 20 },
    escrow: {
      status: "locked",
      reward: { resourceId: "coin", amount: 20 },
      sponsorAgentId: "agent_creator",
      sponsorExplorerId: "explorer_creator_private",
      lockedAt: "2026-07-10T01:00:00.000Z",
    },
  });
  const released = contract({
    contractId: "contract_released",
    contractType: "evidence",
    status: "completed",
    reward: { resourceId: "coin", amount: 50 },
    riskFlags: ["high_value_contract"],
    riskScore: 2,
    escrow: {
      status: "released",
      reward: { resourceId: "coin", amount: 50 },
      sponsorAgentId: "agent_creator",
      sponsorExplorerId: "explorer_creator_private",
      lockedAt: "2026-07-10T01:00:00.000Z",
      recipientAgentId: "agent_contractor",
      recipientExplorerId: "explorer_contractor_private",
      settledAt: "2026-07-10T06:00:00.000Z",
      settlementReason: "completed",
    },
    completedAt: "2026-07-10T06:00:00.000Z",
  });
  const refunded = contract({
    contractId: "contract_refunded",
    contractType: "counter_bounty",
    status: "rejected",
    reward: { resourceId: "aether", amount: 7 },
    escrow: {
      status: "refunded",
      reward: { resourceId: "aether", amount: 7 },
      sponsorAgentId: "agent_creator",
      sponsorExplorerId: "explorer_creator_private",
      lockedAt: "2026-07-10T01:00:00.000Z",
      recipientAgentId: "agent_creator",
      recipientExplorerId: "explorer_creator_private",
      settledAt: "2026-07-10T07:00:00.000Z",
      settlementReason: "rejected",
    },
    rejectedAt: "2026-07-10T07:00:00.000Z",
  });

  assert.deepEqual(contractMarketSummaryView(projection([locked, released, refunded]), {
    regionId: "region_gray_harbor",
  }), {
    regionId: "region_gray_harbor",
    totalContracts: 3,
    byType: {
      scouting: 1,
      evidence: 1,
      protection: 0,
      bounty: 0,
      counter_bounty: 1,
    },
    byStatus: {
      open: 1,
      accepted: 0,
      submitted: 0,
      completed: 1,
      rejected: 1,
      cancelled: 0,
      expired: 0,
    },
    escrowCounts: { locked: 1, released: 1, refunded: 1 },
    lockedRewardTotals: { coin: 20 },
    releasedRewardTotals: { coin: 50 },
    refundedRewardTotals: { aether: 7 },
    riskFlaggedContracts: 1,
    latestActivityAt: "2026-07-10T07:00:00.000Z",
  });
});
