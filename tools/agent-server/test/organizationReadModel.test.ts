import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";

import type {
  EpochDiplomacyRecord,
  EpochOrganization,
  EpochOrganizationBudget,
  EpochOrganizationMembership,
  EpochOrganizationPoliticsRecord,
  EpochOrganizationUpgrade,
  EpochProjection,
} from "../lib/epoch/gameCore.ts";
import type { EpochEvent } from "../lib/epoch/events.ts";
import {
  diplomacyView,
  organizationMembershipsView,
  organizationPoliticsView,
  organizationsView,
} from "../lib/epoch/organizationReadModel.ts";

const modulePath = new URL("../lib/epoch/organizationReadModel.ts", import.meta.url);

function projection(overrides: Partial<EpochProjection> = {}): EpochProjection {
  return {
    events: [],
    diplomacyRecords: {},
    diplomacyIdsByRegion: {},
    diplomacyIdsByAgent: {},
    organizations: {},
    organizationMemberships: {},
    organizationMembershipIdsByOrganization: {},
    organizationMembershipIdsByNpc: {},
    organizationMembershipIdsByAgent: {},
    organizationMembershipIdsByRegion: {},
    organizationPoliticalStandingByOrganization: {},
    organizationTreasuryBalances: {},
    organizationUpgradeIdsByOrganization: {},
    organizationUpgrades: {},
    organizationBudgetIdsByOrganization: {},
    organizationBudgets: {},
    organizationPolitics: {},
    organizationPoliticsIdsByNpc: {},
    organizationPoliticsIdsByOrganization: {},
    organizationPoliticsIdsByRegion: {},
    ...overrides,
  } as EpochProjection;
}

function organization(overrides: Partial<EpochOrganization> = {}): EpochOrganization {
  return {
    organizationId: "org_gray_watch",
    organizationKey: "gray_watch",
    displayName: "灰港守望会",
    regionId: "region_gray_harbor",
    memberNpcIds: ["npc_clerk"],
    memberAgentIds: ["agent_1"],
    recordedAt: "2026-07-06T00:00:00.000Z",
    ...overrides,
  };
}

function membership(overrides: Partial<EpochOrganizationMembership> = {}): EpochOrganizationMembership {
  return {
    membershipId: "membership_1",
    organizationId: "org_gray_watch",
    organizationName: "灰港守望会",
    memberType: "agent",
    agentId: "agent_1",
    explorerId: "explorer_1",
    regionId: "region_gray_harbor",
    role: "member",
    status: "active",
    sourceEventIds: ["event_1"],
    recordedAt: "2026-07-06T00:00:00.000Z",
    ...overrides,
  };
}

function diplomacy(overrides: Partial<EpochDiplomacyRecord> = {}): EpochDiplomacyRecord {
  return {
    diplomacyId: "diplomacy_1",
    regionId: "region_gray_harbor",
    sourceAgentId: "agent_1",
    sourceExplorerId: "explorer_1",
    targetAgentId: "agent_2",
    targetExplorerId: "explorer_2",
    kind: "alliance",
    focusSpent: 1,
    terms: "共同守港",
    status: "pending",
    proposedAt: "2026-07-06T00:00:00.000Z",
    ...overrides,
  };
}

function upgrade(overrides: Partial<EpochOrganizationUpgrade> = {}): EpochOrganizationUpgrade {
  return {
    upgradeId: "upgrade_1",
    organizationId: "org_gray_watch",
    organizationName: "灰港守望会",
    regionId: "region_gray_harbor",
    upgradeKey: "training_hall",
    title: "训练厅",
    description: "提升组织行动能力。",
    purchasedByAgentId: "agent_1",
    purchasedByExplorerId: "explorer_1",
    costResourceId: "coin",
    costAmount: 3,
    sourceEventIds: ["event_1"],
    purchasedAt: "2026-07-06T00:00:00.000Z",
    ...overrides,
  };
}

function budget(overrides: Partial<EpochOrganizationBudget> = {}): EpochOrganizationBudget {
  return {
    budgetId: "budget_1",
    organizationId: "org_gray_watch",
    organizationName: "灰港守望会",
    regionId: "region_gray_harbor",
    proposedByAgentId: "agent_1",
    proposedByExplorerId: "explorer_1",
    title: "修补码头灯",
    resourceId: "coin",
    amount: 4,
    status: "proposed",
    approvalThreshold: 2,
    rejectionThreshold: 2,
    approvalCount: 0,
    rejectionCount: 0,
    votes: [],
    sourceEventIds: ["event_1"],
    proposedAt: "2026-07-06T00:00:00.000Z",
    ...overrides,
  };
}

function politics(overrides: Partial<EpochOrganizationPoliticsRecord> = {}): EpochOrganizationPoliticsRecord {
  return {
    politicsId: "politics_1",
    organizationId: "org_gray_watch",
    organizationName: "灰港守望会",
    regionId: "region_gray_harbor",
    npcId: "npc_clerk",
    kind: "reform",
    title: "章程修订",
    summary: "守望会调整巡夜章程。",
    standingDelta: 1,
    standingAfter: 2,
    sourceEventIds: ["event_1"],
    recordedAt: "2026-07-06T00:00:00.000Z",
    ...overrides,
  };
}

function treasuryEvent(overrides: Partial<Extract<EpochEvent, { readonly eventType: "organization_treasury_changed" }>> = {}): EpochEvent {
  return {
    eventId: "treasury_event_1",
    eventType: "organization_treasury_changed",
    aggregateType: "organization",
    aggregateId: "org_gray_watch",
    actorExplorerId: "explorer_1",
    agentId: "agent_1",
    trustClass: "server_hosted_agent",
    causationId: "cause_1",
    correlationId: "corr_1",
    createdAt: "2026-07-06T00:00:00.000Z",
    payload: {
      treasuryEventId: "treasury_1",
      organizationId: "org_gray_watch",
      organizationName: "灰港守望会",
      regionId: "region_gray_harbor",
      resourceId: "coin",
      amountDelta: 5,
      balanceAfter: 12,
      reason: "contribution",
      sourceEventIds: ["event_1"],
      recordedAt: "2026-07-06T00:00:00.000Z",
    },
    ...overrides,
  } as EpochEvent;
}

test("organization read model filters diplomacy by agent and status newest first", () => {
  assert.ok(existsSync(modulePath), "organizationReadModel.ts should own diplomacy and organization projections");
  const view = diplomacyView(projection({
    diplomacyRecords: {
      old: diplomacy({ diplomacyId: "old", status: "accepted", proposedAt: "2026-07-05T00:00:00.000Z" }),
      new: diplomacy({ diplomacyId: "new", status: "pending", proposedAt: "2026-07-07T00:00:00.000Z" }),
    },
    diplomacyIdsByAgent: {
      agent_1: ["old", "new"],
    },
  }), { agentId: "agent_1", status: "pending" });

  assert.deepEqual(view.map((item) => item.diplomacyId), ["new"]);
});

test("organization read model builds organization views with ledger, budgets, upgrades and influence", () => {
  const view = organizationsView(projection({
    events: [treasuryEvent()],
    organizations: {
      org_gray_watch: organization(),
    },
    organizationMemberships: {
      membership_1: membership(),
    },
    organizationMembershipIdsByAgent: {
      agent_1: ["membership_1"],
    },
    organizationPoliticalStandingByOrganization: {
      org_gray_watch: 2,
    },
    organizationTreasuryBalances: {
      org_gray_watch: { coin: 12, aether: 5, legend: 5 },
    },
    organizationUpgradeIdsByOrganization: {
      org_gray_watch: ["upgrade_1"],
    },
    organizationUpgrades: {
      upgrade_1: upgrade(),
    },
    organizationBudgetIdsByOrganization: {
      org_gray_watch: ["old_budget", "budget_1"],
    },
    organizationBudgets: {
      old_budget: budget({ budgetId: "old_budget", proposedAt: "2026-07-05T00:00:00.000Z" }),
      budget_1: budget({ proposedAt: "2026-07-07T00:00:00.000Z" }),
    },
    diplomacyRecords: {
      diplomacy_1: diplomacy(),
    },
    diplomacyIdsByRegion: {
      region_gray_harbor: ["diplomacy_1"],
    },
  }), { agentId: "agent_1" });

  assert.equal(view[0]?.organizationId, "org_gray_watch");
  assert.deepEqual(view[0]?.upgradeKeys, ["training_hall"]);
  assert.deepEqual(view[0]?.budgets.map((item) => item.budgetId), ["budget_1", "old_budget"]);
  assert.deepEqual(view[0]?.treasuryLedger.map((item) => item.ledgerId), ["treasury_1"]);
  assert.equal(view[0]?.influenceScore.memberScore, 4);
  assert.equal(view[0]?.influenceScore.resourceScore, 2);
  assert.equal(view[0]?.influenceScore.armedScore, 3);
  assert.equal(view[0]?.influenceScore.territoryScore, 2);
  assert.equal(view[0]?.influenceScore.diplomacyScore, 2);
  assert.equal(view[0]?.influenceScore.supernaturalScore, 3);
  assert.equal(view[0]?.influenceScore.factionReviewRequired, true);
});

test("organization read model deduplicates organizations from memberships", () => {
  const view = organizationsView(projection({
    organizations: {
      org_gray_watch: organization(),
    },
    organizationMemberships: {
      membership_a: membership({ membershipId: "membership_a", npcId: "npc_clerk", memberType: "npc", agentId: undefined }),
      membership_b: membership({ membershipId: "membership_b", npcId: "npc_clerk", memberType: "npc", agentId: undefined }),
    },
    organizationMembershipIdsByNpc: {
      npc_clerk: ["membership_a", "membership_b"],
    },
  }), { npcId: "npc_clerk" });

  assert.deepEqual(view.map((item) => item.organizationId), ["org_gray_watch"]);
});

test("organization read model sorts memberships and politics newest first", () => {
  const base = projection({
    organizationMemberships: {
      old: membership({ membershipId: "old", recordedAt: "2026-07-05T00:00:00.000Z" }),
      new: membership({ membershipId: "new", recordedAt: "2026-07-07T00:00:00.000Z" }),
    },
    organizationMembershipIdsByOrganization: {
      org_gray_watch: ["old", "new"],
    },
    organizationPolitics: {
      old: politics({ politicsId: "old", recordedAt: "2026-07-05T00:00:00.000Z" }),
      new: politics({ politicsId: "new", recordedAt: "2026-07-07T00:00:00.000Z" }),
    },
    organizationPoliticsIdsByOrganization: {
      org_gray_watch: ["old", "new", "new"],
    },
  });

  assert.deepEqual(
    organizationMembershipsView(base, { organizationId: "org_gray_watch" }).map((item) => item.membershipId),
    ["new", "old"],
  );
  assert.deepEqual(
    organizationPoliticsView(base, { organizationId: "org_gray_watch" }).map((item) => item.politicsId),
    ["new", "old"],
  );
});
