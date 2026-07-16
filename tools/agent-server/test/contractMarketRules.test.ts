import assert from "node:assert/strict";
import test from "node:test";

import {
  CONTRACT_MARKET_HIGH_VALUE_THRESHOLD,
  CONTRACT_MARKET_REPEAT_OPPONENT_THRESHOLD,
  CONTRACT_MARKET_TYPES,
  contractMarketAcceptanceRisk,
  contractMarketCreationRisk,
  isProtectedFamilyNpcTarget,
  planContractMarketAcceptance,
  planContractMarketCancellation,
  planContractMarketCreation,
  planContractMarketExpiry,
  planContractMarketSubmission,
  planServerContractAdjudication,
  projectContractMarketEvents,
  selectExpirableContractMarketContracts,
  type ContractMarketContract,
  type ContractMarketCreateRequest,
  type ContractMarketHistoryRecord,
  type ContractMarketPlannedEvent,
  type ContractMarketProjectableEvent,
  type ContractMarketProjection,
  type ContractMarketSourceBounty,
  type ContractMarketTarget,
} from "../lib/epoch/contractMarketRules.ts";

const createdAt = "2026-07-10T01:00:00.000Z";
const acceptedAt = "2026-07-10T02:00:00.000Z";
const submittedAt = "2026-07-10T03:00:00.000Z";
const adjudicatedAt = "2026-07-10T04:00:00.000Z";
const expiresAt = "2026-07-11T01:00:00.000Z";

const huntedAgent: ContractMarketTarget = {
  kind: "agent",
  agentId: "agent_hunted",
  explorerId: "explorer_hunted",
};

const sourceBounty: ContractMarketSourceBounty = {
  bountyId: "bounty_source",
  regionId: "region_gray_harbor",
  sponsorAgentId: "agent_bounty_sponsor",
  sponsorExplorerId: "explorer_bounty_sponsor",
  target: huntedAgent,
  status: "open",
};

function baseCreate(overrides: Partial<ContractMarketCreateRequest> = {}): ContractMarketCreateRequest {
  return {
    contractId: "contract_evidence",
    contractType: "evidence",
    regionId: "region_gray_harbor",
    creatorAgentId: "agent_creator",
    creatorExplorerId: "explorer_creator",
    title: "Recover the harbor ledger",
    description: "Submit canonical evidence from the harbor event ledger.",
    reward: { resourceId: "coin", amount: 50 },
    target: { kind: "region", regionId: "region_gray_harbor" },
    createdAt,
    expiresAt,
    ...overrides,
  };
}

function projectable(
  events: readonly ContractMarketPlannedEvent[],
  prefix: string,
): readonly ContractMarketProjectableEvent[] {
  return events.map((event, index) => ({
    ...event,
    eventId: `${prefix}_${index + 1}`,
  })) as readonly ContractMarketProjectableEvent[];
}

function applyPlans(
  projection: ContractMarketProjection,
  plans: readonly ContractMarketPlannedEvent[],
  prefix: string,
): ContractMarketProjection {
  return projectContractMarketEvents(projection, projectable(plans, prefix));
}

function createProjectedContract(
  overrides: Partial<ContractMarketCreateRequest> = {},
  source?: ContractMarketSourceBounty,
): ContractMarketContract {
  const request = baseCreate(overrides);
  const projection = applyPlans({ contracts: {} }, planContractMarketCreation({
    ...request,
    sponsorBalanceBefore: 500,
    sourceBounty: source,
  }), `event_${request.contractId}`);
  const contract = projection.contracts[request.contractId];
  if (!contract) throw new Error("test_contract_projection_missing");
  return contract;
}

function acceptedContract(overrides: Partial<ContractMarketCreateRequest> = {}): ContractMarketContract {
  const contract = createProjectedContract(overrides);
  const projection = applyPlans({ contracts: { [contract.contractId]: contract } }, planContractMarketAcceptance({
    contract,
    contractId: contract.contractId,
    contractorAgentId: "agent_contractor",
    contractorExplorerId: "explorer_contractor",
    acceptedAt,
  }), "event_accept");
  const accepted = projection.contracts[contract.contractId];
  if (!accepted) throw new Error("test_accepted_contract_missing");
  return accepted;
}

function submittedContract(overrides: Partial<ContractMarketCreateRequest> = {}): ContractMarketContract {
  const contract = acceptedContract(overrides);
  const projection = applyPlans({ contracts: { [contract.contractId]: contract } }, planContractMarketSubmission({
    contract,
    contractId: contract.contractId,
    contractorAgentId: "agent_contractor",
    contractorExplorerId: "explorer_contractor",
    summary: "The canonical harbor ledger confirms the route.",
    sourceEventIds: ["event_canonical_1"],
    canonicalSourceEventIds: ["event_canonical_1"],
    submittedAt,
  }), "event_submit");
  const submitted = projection.contracts[contract.contractId];
  if (!submitted) throw new Error("test_submitted_contract_missing");
  return submitted;
}

test("contract market covers all five contract types and locks rewards before creation", () => {
  assert.deepEqual(CONTRACT_MARKET_TYPES, [
    "scouting",
    "evidence",
    "protection",
    "bounty",
    "counter_bounty",
  ]);
  const cases: readonly {
    request: ContractMarketCreateRequest;
    source?: ContractMarketSourceBounty;
  }[] = [
    {
      request: baseCreate({
        contractId: "contract_scouting",
        contractType: "scouting",
        target: { kind: "region", regionId: "region_gray_harbor" },
      }),
    },
    { request: baseCreate() },
    {
      request: baseCreate({
        contractId: "contract_protection",
        contractType: "protection",
        target: huntedAgent,
        sourceBountyId: sourceBounty.bountyId,
      }),
      source: sourceBounty,
    },
    {
      request: baseCreate({
        contractId: "contract_bounty",
        contractType: "bounty",
        target: huntedAgent,
      }),
    },
    {
      request: baseCreate({
        contractId: "contract_counter",
        contractType: "counter_bounty",
        target: {
          kind: "agent",
          agentId: sourceBounty.sponsorAgentId,
          explorerId: sourceBounty.sponsorExplorerId,
        },
        sourceBountyId: sourceBounty.bountyId,
      }),
      source: sourceBounty,
    },
  ];

  for (const item of cases) {
    const plans = planContractMarketCreation({
      ...item.request,
      sponsorBalanceBefore: 120,
      sourceBounty: item.source,
    });
    assert.deepEqual(plans.map((event) => event.eventType), [
      "contract_reward_escrow_locked",
      "contract_created",
    ]);
    const locked = plans[0];
    if (locked?.eventType !== "contract_reward_escrow_locked") throw new Error("expected_escrow_lock");
    assert.equal(locked.payload.reward.amount, 50);
    assert.equal(locked.payload.balanceAfter, 70);
    const projected = applyPlans({ contracts: {} }, plans, item.request.contractId);
    assert.equal(projected.contracts[item.request.contractId]?.status, "open");
    assert.equal(projected.contracts[item.request.contractId]?.escrow.status, "locked");
  }
});

test("protection and counter-bounty contracts require exact open source-bounty bindings", () => {
  assert.throws(() => planContractMarketCreation({
    ...baseCreate({ contractType: "protection", target: huntedAgent }),
    sponsorBalanceBefore: 100,
  }), /contract_source_bounty_required/);
  assert.throws(() => planContractMarketCreation({
    ...baseCreate({
      contractType: "protection",
      target: { kind: "agent", agentId: "agent_wrong", explorerId: "explorer_wrong" },
      sourceBountyId: sourceBounty.bountyId,
    }),
    sponsorBalanceBefore: 100,
    sourceBounty,
  }), /protection_contract_target_mismatch/);
  assert.throws(() => planContractMarketCreation({
    ...baseCreate({
      contractType: "counter_bounty",
      target: huntedAgent,
      sourceBountyId: sourceBounty.bountyId,
    }),
    sponsorBalanceBefore: 100,
    sourceBounty,
  }), /counter_bounty_target_mismatch/);
  assert.throws(() => planContractMarketCreation({
    ...baseCreate({
      contractType: "protection",
      target: huntedAgent,
      sourceBountyId: sourceBounty.bountyId,
    }),
    sponsorBalanceBefore: 100,
    sourceBounty: { ...sourceBounty, status: "claimed" },
  }), /contract_source_bounty_not_open/);
});

test("bounty contracts cannot harvest child or family NPC targets", () => {
  const childTarget: ContractMarketTarget = {
    kind: "npc",
    npcId: "npc_child",
    traits: ["quiet", "child"],
  };
  const familyTarget: ContractMarketTarget = {
    kind: "npc",
    npcId: "npc_partner",
    traits: ["archivist"],
    familyRole: "partner",
  };
  const householdTarget: ContractMarketTarget = {
    kind: "npc",
    npcId: "npc_household",
    traits: ["merchant"],
    householdIds: ["household_1"],
  };
  assert.equal(isProtectedFamilyNpcTarget(childTarget), true);
  assert.equal(isProtectedFamilyNpcTarget(familyTarget), true);
  assert.equal(isProtectedFamilyNpcTarget(householdTarget), true);
  for (const target of [childTarget, familyTarget, householdTarget]) {
    assert.throws(() => planContractMarketCreation({
      ...baseCreate({ contractType: "bounty", target }),
      sponsorBalanceBefore: 100,
    }), /contract_family_npc_target_protected/);
  }
});

test("acceptance rejects same-explorer self dealing even across different agent ids", () => {
  const contract = createProjectedContract();
  assert.throws(() => planContractMarketAcceptance({
    contract,
    contractId: contract.contractId,
    contractorAgentId: "agent_creator_alt",
    contractorExplorerId: contract.creatorExplorerId,
    acceptedAt,
  }), /contract_self_dealing_forbidden/);
});

test("risk assessment flags high value and repeated opponents or counterparties", () => {
  assert.equal(CONTRACT_MARKET_HIGH_VALUE_THRESHOLD, 1_000);
  assert.equal(CONTRACT_MARKET_REPEAT_OPPONENT_THRESHOLD, 2);
  const historyDates = [
    "2026-07-08T01:00:00.000Z",
    "2026-07-09T01:00:00.000Z",
  ] as const;
  const history: readonly ContractMarketHistoryRecord[] = historyDates.map((historyCreatedAt, index) => ({
    contractId: `contract_old_${index}`,
    contractType: "bounty",
    creatorExplorerId: "explorer_creator",
    contractorExplorerId: "explorer_contractor",
    target: huntedAgent,
    status: "completed",
    createdAt: historyCreatedAt,
  }));
  assert.deepEqual(contractMarketCreationRisk({
    reward: { resourceId: "coin", amount: 1_000 },
    creatorExplorerId: "explorer_creator",
    target: huntedAgent,
    evaluatedAt: createdAt,
    history,
  }), {
    flags: ["high_value_contract", "repeat_opponent_contract"],
    score: 3,
  });
  const contract = createProjectedContract();
  assert.deepEqual(contractMarketAcceptanceRisk({
    contract,
    contractorExplorerId: "explorer_contractor",
    acceptedAt,
    history,
  }), {
    flags: ["repeat_opponent_contract"],
    score: 1,
  });
});

test("evidence submission accepts only canonical source events and cannot declare completion or reward", () => {
  const contract = acceptedContract();
  assert.throws(() => planContractMarketSubmission({
    contract,
    contractId: contract.contractId,
    contractorAgentId: "agent_contractor",
    contractorExplorerId: "explorer_contractor",
    summary: "Unbacked client claim",
    sourceEventIds: ["event_forged"],
    canonicalSourceEventIds: ["event_canonical"],
    submittedAt,
  }), /contract_source_event_not_canonical/);
  assert.throws(() => planContractMarketSubmission({
    contract,
    contractId: contract.contractId,
    contractorAgentId: "agent_contractor",
    contractorExplorerId: "explorer_contractor",
    summary: "No evidence",
    canonicalSourceEventIds: ["event_canonical"],
    submittedAt,
  }), /contract_source_event_ids_required/);

  const forgedClientRequest = {
    contractId: contract.contractId,
    contractorAgentId: "agent_contractor",
    contractorExplorerId: "explorer_contractor",
    summary: "Canonical evidence only",
    sourceEventIds: ["event_canonical"],
    submittedAt,
    status: "completed",
    reward: { resourceId: "legend", amount: 999_999 },
  };
  const plans = planContractMarketSubmission({
    ...forgedClientRequest,
    contract,
    canonicalSourceEventIds: ["event_canonical"],
  });
  assert.deepEqual(plans.map((event) => event.eventType), ["contract_submitted"]);
  const submitted = plans[0];
  if (submitted?.eventType !== "contract_submitted") throw new Error("expected_contract_submitted");
  assert.equal("status" in submitted.payload, false);
  assert.equal("reward" in submitted.payload, false);
});

test("server approval releases the escrowed reward and is the only completion plan", () => {
  const contract = submittedContract();
  const plans = planServerContractAdjudication({
    contract,
    authority: { kind: "server", actorId: "system_adjudicator", decisionId: "decision_approved" },
    resolution: "approved",
    reason: "Canonical evidence satisfies the contract.",
    sourceEventIds: ["event_canonical_1"],
    canonicalSourceEventIds: ["event_canonical_1"],
    recipientBalanceBefore: 25,
    adjudicatedAt,
  });
  assert.deepEqual(plans.map((event) => event.eventType), [
    "contract_server_adjudicated",
    "contract_reward_escrow_released",
    "contract_completed",
  ]);
  const release = plans[1];
  if (release?.eventType !== "contract_reward_escrow_released") throw new Error("expected_escrow_release");
  assert.deepEqual(release.payload.reward, contract.reward);
  assert.equal(release.payload.recipientAgentId, contract.contractorAgentId);
  assert.equal(release.payload.balanceAfter, 75);

  const projection = applyPlans({ contracts: { [contract.contractId]: contract } }, plans, "event_approve");
  assert.equal(projection.contracts[contract.contractId]?.status, "completed");
  assert.equal(projection.contracts[contract.contractId]?.escrow.status, "released");
  assert.equal(projection.contracts[contract.contractId]?.escrow.recipientExplorerId, "explorer_contractor");
});

test("server rejection refunds the creator and ends in rejected state", () => {
  const contract = submittedContract();
  const plans = planServerContractAdjudication({
    contract,
    authority: { kind: "server", actorId: "system_adjudicator", decisionId: "decision_rejected" },
    resolution: "rejected",
    reason: "The evidence does not establish the claimed route.",
    sourceEventIds: ["event_canonical_1"],
    canonicalSourceEventIds: ["event_canonical_1"],
    recipientBalanceBefore: 100,
    adjudicatedAt,
  });
  assert.deepEqual(plans.map((event) => event.eventType), [
    "contract_server_adjudicated",
    "contract_reward_escrow_refunded",
    "contract_rejected",
  ]);
  const refund = plans[1];
  if (refund?.eventType !== "contract_reward_escrow_refunded") throw new Error("expected_escrow_refund");
  assert.equal(refund.payload.sponsorExplorerId, contract.creatorExplorerId);
  assert.equal(refund.payload.balanceAfter, 150);
  assert.equal(refund.payload.reason, "rejected");

  const projection = applyPlans({ contracts: { [contract.contractId]: contract } }, plans, "event_reject");
  assert.equal(projection.contracts[contract.contractId]?.status, "rejected");
  assert.equal(projection.contracts[contract.contractId]?.escrow.status, "refunded");
});

test("open contracts can be owner-cancelled while open or accepted contracts can expire", () => {
  const open = createProjectedContract({ contractId: "contract_open" });
  assert.throws(() => planContractMarketCancellation({
    contract: open,
    requesterExplorerId: "explorer_other",
    sponsorBalanceBefore: 10,
    cancelledAt: acceptedAt,
  }), /contract_cancel_owner_required/);
  const cancelPlans = planContractMarketCancellation({
    contract: open,
    requesterExplorerId: open.creatorExplorerId,
    sponsorBalanceBefore: 10,
    cancelledAt: acceptedAt,
  });
  const cancelled = applyPlans({ contracts: { [open.contractId]: open } }, cancelPlans, "event_cancel");
  assert.equal(cancelled.contracts[open.contractId]?.status, "cancelled");
  assert.equal(cancelled.contracts[open.contractId]?.escrow.settlementReason, "cancelled");

  const accepted = acceptedContract({ contractId: "contract_expiring" });
  assert.throws(() => planContractMarketExpiry({
    contract: accepted,
    sponsorBalanceBefore: 10,
    expiredAt: submittedAt,
  }), /contract_not_expired/);
  const expiryPlans = planContractMarketExpiry({
    contract: accepted,
    sponsorBalanceBefore: 10,
    expiredAt: expiresAt,
  });
  const expired = applyPlans({ contracts: { [accepted.contractId]: accepted } }, expiryPlans, "event_expire");
  assert.equal(expired.contracts[accepted.contractId]?.status, "expired");
  assert.equal(expired.contracts[accepted.contractId]?.escrow.settlementReason, "expired");
});

test("expiry selection is deterministic, bounded, and excludes submitted contracts", () => {
  const first = createProjectedContract({
    contractId: "contract_first",
    expiresAt: "2026-07-10T05:00:00.000Z",
  });
  const second = acceptedContract({
    contractId: "contract_second",
    expiresAt: "2026-07-10T06:00:00.000Z",
  });
  const submitted = submittedContract({
    contractId: "contract_submitted",
    expiresAt: "2026-07-10T07:00:00.000Z",
  });
  assert.deepEqual(selectExpirableContractMarketContracts({
    [second.contractId]: second,
    [submitted.contractId]: submitted,
    [first.contractId]: first,
  }, {
    expiredAt: "2026-07-10T08:00:00.000Z",
    limit: 10,
  }).map((contract) => contract.contractId), ["contract_first", "contract_second"]);
});
