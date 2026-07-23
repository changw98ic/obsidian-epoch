import assert from "node:assert/strict";
import test from "node:test";

import { eventFactory } from "../lib/epoch/eventFactory.ts";
import {
  activeAgentOrganizationMembership,
  activeOrganizationMembershipForExplorer,
  activeOrganizationUpgradeIdsForAgentSeason,
  assertOrganizationMembershipStatus,
  organizationCreatedPayload,
  organizationBudgetApprovalCountAfter,
  organizationBudgetDecisionStillPending,
  organizationBudgetProposedPayload,
  organizationBudgetRequiresVoteRecord,
  organizationBudgetResolvedPayload,
  organizationBudgetTreasurySpendPayload,
  organizationBudgetVotePayload,
  organizationMembershipChangedPayload,
  planOrganizationBudgetProposedEvents,
  planOrganizationBudgetResolutionEvents,
  planOrganizationCreatedEvents,
  planOrganizationMembershipChangedEvents,
  planOrganizationTreasuryContributionEvents,
  planOrganizationUpgradePurchaseEvents,
  organizationPoliticsTickPlan,
  organizationPoliticsTickLimit,
  organizationPoliticsKindForIndex,
  organizationPoliticsRecordedPayload,
  planOrganizationPoliticsTickEvents,
  projectOrganizationPoliticsTickResult,
  organizationTreasuryContributionSpendPayload,
  organizationTreasuryContributionPayload,
  organizationUpgradePurchasedPayload,
  organizationUpgradeTreasurySpendPayload,
  selectOrganizationPoliticsTickTargets,
  organizationBudgetApprovalThresholdForBudget,
  organizationBudgetRejectionCountAfter,
  organizationBudgetRejectionThresholdForBudget,
  type OrganizationBudgetForRules,
} from "../lib/epoch/organizationTreasuryRules.ts";
import { createSequentialEpochIdFactory } from "../lib/epoch/protocol.ts";

const budget: OrganizationBudgetForRules = {
  budgetId: "budget_1",
  organizationId: "org_1",
  organizationName: "灰港商会",
  regionId: "region_gray_harbor",
  proposedByExplorerId: "explorer_proposer",
  resourceId: "coin",
  amount: 7,
  approvalThreshold: 2,
  rejectionThreshold: 2,
  approvalCount: 1,
  rejectionCount: 0,
  sourceEventIds: ["event_proposed"],
};

const upgradeEntry = {
  upgradeKey: "training_hall" as const,
  title: "训练厅",
  description: "成员共享训练设施。",
  costResourceId: "legend" as const,
  costAmount: 2,
};

test("organization treasury rules plan organization and membership payloads", () => {
  assert.deepEqual(organizationCreatedPayload({
    organizationId: "org_1",
    organizationName: "灰港商会",
    regionId: "region_gray_harbor",
    reason: "  operator_created  ",
    sourceEventIds: ["event_1"],
    recordedAt: "2026-07-07T05:50:00.000Z",
  }), {
    organizationId: "org_1",
    organizationName: "灰港商会",
    regionId: "region_gray_harbor",
    reason: "operator_created",
    sourceEventIds: ["event_1"],
    recordedAt: "2026-07-07T05:50:00.000Z",
  });
  assert.equal(organizationCreatedPayload({
    organizationId: "org_2",
    organizationName: "白塔测绘队",
    regionId: "region_white_tower",
    recordedAt: "2026-07-07T05:51:00.000Z",
  }).reason, "operator_created");

  assert.deepEqual(organizationMembershipChangedPayload({
    membershipId: "membership_1",
    organizationId: "org_1",
    organizationName: "灰港商会",
    memberType: "agent",
    agentId: "agent_1",
    explorerId: "explorer_1",
    regionId: "region_gray_harbor",
    role: "scribe",
    status: "active",
    sourceEventIds: ["event_1"],
    recordedAt: "2026-07-07T05:52:00.000Z",
  }), {
    membershipId: "membership_1",
    organizationId: "org_1",
    organizationName: "灰港商会",
    memberType: "agent",
    agentId: "agent_1",
    explorerId: "explorer_1",
    regionId: "region_gray_harbor",
    role: "scribe",
    status: "active",
    sourceEventIds: ["event_1"],
    recordedAt: "2026-07-07T05:52:00.000Z",
  });
  assert.deepEqual(organizationMembershipChangedPayload({
    membershipId: "membership_npc_1",
    organizationId: "org_1",
    organizationName: "灰港商会",
    memberType: "npc",
    npcId: "npc_clerk_1",
    regionId: "region_gray_harbor",
    role: "regional_clerk",
    status: "active",
    sourceEventIds: ["event_2"],
    recordedAt: "2026-07-07T05:53:00.000Z",
  }), {
    membershipId: "membership_npc_1",
    organizationId: "org_1",
    organizationName: "灰港商会",
    memberType: "npc",
    npcId: "npc_clerk_1",
    regionId: "region_gray_harbor",
    role: "regional_clerk",
    status: "active",
    sourceEventIds: ["event_2"],
    recordedAt: "2026-07-07T05:53:00.000Z",
  });
});

test("organization treasury rules plan organization lifecycle event sequences", () => {
  const idFactory = createSequentialEpochIdFactory("organization_lifecycle");
  const makeEvent = eventFactory(() => new Date("2026-07-07T05:55:00.000Z"), idFactory, {
    actorExplorerId: "explorer_operator",
    trustClass: "system_worker",
    causationId: "cmd_create_organization",
    correlationId: "corr_create_organization",
  });

  const createdEvents = planOrganizationCreatedEvents({
    makeEvent,
    organizationId: "org_1",
    organizationName: "灰港商会",
    regionId: "region_gray_harbor",
    reason: "operator_created",
    sourceEventIds: ["event_source"],
    recordedAt: "2026-07-07T05:55:00.000Z",
  });

  assert.equal(createdEvents.length, 1);
  assert.equal(createdEvents[0].eventType, "organization_created");
  assert.equal(createdEvents[0].aggregateType, "organization");
  assert.equal(createdEvents[0].aggregateId, "org_1");
  assert.equal(createdEvents[0].agentId, "system");
  assert.deepEqual(createdEvents[0].payload, {
    organizationId: "org_1",
    organizationName: "灰港商会",
    regionId: "region_gray_harbor",
    reason: "operator_created",
    sourceEventIds: ["event_source"],
    recordedAt: "2026-07-07T05:55:00.000Z",
  });

  const membershipEvents = planOrganizationMembershipChangedEvents({
    makeEvent,
    membershipId: "membership_1",
    organizationId: "org_1",
    organizationName: "灰港商会",
    memberType: "agent",
    agentId: "agent_1",
    explorerId: "explorer_1",
    regionId: "region_gray_harbor",
    role: "scribe",
    status: "active",
    sourceEventIds: [],
    recordedAt: "2026-07-07T05:56:00.000Z",
  });

  assert.equal(membershipEvents.length, 1);
  assert.equal(membershipEvents[0].eventType, "organization_membership_changed");
  assert.equal(membershipEvents[0].aggregateType, "organization");
  assert.equal(membershipEvents[0].aggregateId, "membership_1");
  assert.equal(membershipEvents[0].agentId, "agent_1");
  assert.deepEqual(membershipEvents[0].payload, {
    membershipId: "membership_1",
    organizationId: "org_1",
    organizationName: "灰港商会",
    memberType: "agent",
    agentId: "agent_1",
    explorerId: "explorer_1",
    regionId: "region_gray_harbor",
    role: "scribe",
    status: "active",
    sourceEventIds: [],
    recordedAt: "2026-07-07T05:56:00.000Z",
  });
});

test("organization treasury rules plan treasury contribution event sequences", () => {
  const idFactory = createSequentialEpochIdFactory("organization_contribution");
  const makeEvent = eventFactory(() => new Date("2026-07-07T06:05:00.000Z"), idFactory, {
    actorExplorerId: "explorer_1",
    trustClass: "user_verified_web",
    causationId: "cmd_org_contribution",
    correlationId: "corr_org_contribution",
  });

  const events = planOrganizationTreasuryContributionEvents({
    makeEvent,
    treasuryEventId: "treasury_contribution_1",
    organizationId: "org_1",
    organizationName: "灰港商会",
    regionId: "region_gray_harbor",
    resourceId: "coin",
    amount: 5,
    memberBalanceBefore: 12,
    treasuryBalanceBefore: 20,
    contributingAgentId: "agent_1",
    contributedAt: "2026-07-07T06:05:00.000Z",
  });

  assert.deepEqual(events.map((event) => event.eventType), [
    "resource_spent",
    "organization_treasury_changed",
  ]);
  assert.equal(events[0].aggregateType, "resource_account");
  assert.equal(events[0].aggregateId, "agent_1");
  assert.equal(events[0].agentId, "agent_1");
  assert.deepEqual(events[0].payload, {
    resourceId: "coin",
    amount: 5,
    reason: "organization_treasury_contribution:org_1",
    balanceAfter: 7,
    accountRef: "agent:agent_1",
    assetKey: "resource:coin",
    unit: "unit",
    quantityMinor: "500",
  });
  assert.equal(events[1].aggregateType, "organization");
  assert.equal(events[1].aggregateId, "treasury_contribution_1");
  assert.equal(events[1].agentId, "agent_1");
  assert.deepEqual(events[1].payload, {
    treasuryEventId: "treasury_contribution_1",
    organizationId: "org_1",
    organizationName: "灰港商会",
    regionId: "region_gray_harbor",
    resourceId: "coin",
    amountDelta: 5,
    balanceAfter: 25,
    reason: "organization_contribution:agent_1",
    sourceEventIds: [events[0].eventId],
    recordedAt: "2026-07-07T06:05:00.000Z",
  });
});

test("organization treasury rules read active agent memberships and season upgrades", () => {
  assert.equal(assertOrganizationMembershipStatus(undefined), "active");
  assert.equal(assertOrganizationMembershipStatus("left"), "left");
  assert.throws(() => assertOrganizationMembershipStatus("paused"), /organization_membership_status_invalid/);

  const projection = {
    organizationMembershipIdsByOrganization: {
      org_1: ["membership_agent", "membership_left", "membership_npc"],
      org_2: ["membership_other"],
    },
    organizationMembershipIdsByAgent: {
      agent_1: ["membership_agent", "membership_left"],
      agent_2: ["membership_other"],
    },
    organizationMemberships: {
      membership_agent: {
        membershipId: "membership_agent",
        organizationId: "org_1",
        memberType: "agent",
        agentId: "agent_1",
        explorerId: "explorer_1",
        regionId: "region_gray_harbor",
        status: "active",
      },
      membership_left: {
        membershipId: "membership_left",
        organizationId: "org_1",
        memberType: "agent",
        agentId: "agent_1",
        explorerId: "explorer_1",
        regionId: "region_salt_gate",
        status: "left",
      },
      membership_npc: {
        membershipId: "membership_npc",
        organizationId: "org_1",
        memberType: "npc",
        regionId: "region_gray_harbor",
        status: "active",
      },
      membership_other: {
        membershipId: "membership_other",
        organizationId: "org_2",
        memberType: "agent",
        agentId: "agent_2",
        explorerId: "explorer_2",
        regionId: "region_gray_harbor",
        status: "active",
      },
    },
    organizationUpgradeIdsByOrganization: {
      org_1: ["upgrade_training", "upgrade_wrong_region"],
      org_2: ["upgrade_other_org"],
    },
    organizationUpgrades: {
      upgrade_training: {
        upgradeId: "upgrade_training",
        organizationId: "org_1",
        regionId: "region_gray_harbor",
        upgradeKey: "training_hall",
      },
      upgrade_wrong_region: {
        upgradeId: "upgrade_wrong_region",
        organizationId: "org_1",
        regionId: "region_salt_gate",
        upgradeKey: "training_hall",
      },
      upgrade_other_org: {
        upgradeId: "upgrade_other_org",
        organizationId: "org_2",
        regionId: "region_gray_harbor",
        upgradeKey: "training_hall",
      },
    },
  };

  assert.equal(activeAgentOrganizationMembership(projection, "org_1", "agent_1")?.membershipId, "membership_agent");
  assert.equal(activeAgentOrganizationMembership(projection, "org_1", "agent_missing"), undefined);
  assert.equal(activeOrganizationMembershipForExplorer(projection, "org_1", "explorer_1")?.agentId, "agent_1");
  assert.equal(activeOrganizationMembershipForExplorer(projection, "org_1", "explorer_2"), undefined);
  assert.deepEqual(activeOrganizationUpgradeIdsForAgentSeason(
    projection,
    "agent_1",
    ["region_gray_harbor"],
    "training_hall",
  ), ["upgrade_training"]);
});

test("organization treasury rules plan budget proposal payloads", () => {
  assert.deepEqual(organizationBudgetProposedPayload({
    budgetId: "budget_1",
    organizationId: "org_1",
    organizationName: "灰港商会",
    regionId: "region_gray_harbor",
    proposedByAgentId: "agent_1",
    proposedByExplorerId: "explorer_1",
    title: "补给预算",
    description: "补足巡逻药剂",
    resourceId: "coin",
    amount: 7,
    sourceEventIds: ["membership_1"],
    proposedAt: "2026-07-07T06:00:00.000Z",
  }), {
    budgetId: "budget_1",
    organizationId: "org_1",
    organizationName: "灰港商会",
    regionId: "region_gray_harbor",
    proposedByAgentId: "agent_1",
    proposedByExplorerId: "explorer_1",
    title: "补给预算",
    description: "补足巡逻药剂",
    resourceId: "coin",
    amount: 7,
    status: "proposed",
    approvalThreshold: 2,
    rejectionThreshold: 2,
    sourceEventIds: ["membership_1"],
    proposedAt: "2026-07-07T06:00:00.000Z",
  });
});

test("organization treasury rules plan budget proposal event sequences", () => {
  const idFactory = createSequentialEpochIdFactory("organization_budget_proposal");
  const makeEvent = eventFactory(() => new Date("2026-07-07T06:00:00.000Z"), idFactory, {
    actorExplorerId: "explorer_1",
    trustClass: "user_verified_web",
    causationId: "cmd_budget_proposal",
    correlationId: "corr_budget_proposal",
  });

  const events = planOrganizationBudgetProposedEvents({
    makeEvent,
    budgetId: "budget_1",
    organizationId: "org_1",
    organizationName: "灰港商会",
    regionId: "region_gray_harbor",
    proposedByAgentId: "agent_1",
    proposedByExplorerId: "explorer_1",
    title: "补给预算",
    description: "补足巡逻药剂",
    resourceId: "coin",
    amount: 7,
    sourceEventIds: ["membership_1"],
    proposedAt: "2026-07-07T06:00:00.000Z",
  });

  assert.deepEqual(events.map((event) => event.eventType), ["organization_budget_proposed"]);
  assert.equal(events[0].aggregateType, "organization");
  assert.equal(events[0].aggregateId, "budget_1");
  assert.equal(events[0].agentId, "agent_1");
  assert.deepEqual(events[0].payload, {
    budgetId: "budget_1",
    organizationId: "org_1",
    organizationName: "灰港商会",
    regionId: "region_gray_harbor",
    proposedByAgentId: "agent_1",
    proposedByExplorerId: "explorer_1",
    title: "补给预算",
    description: "补足巡逻药剂",
    resourceId: "coin",
    amount: 7,
    status: "proposed",
    approvalThreshold: 2,
    rejectionThreshold: 2,
    sourceEventIds: ["membership_1"],
    proposedAt: "2026-07-07T06:00:00.000Z",
  });
});

test("organization treasury rules plan contribution and upgrade payloads", () => {
  assert.deepEqual(organizationTreasuryContributionSpendPayload({
    agentId: "agent_1",
    organizationId: "org_1",
    resourceId: "coin",
    amount: 5,
    memberBalanceBefore: 9,
  }), {
    resourceId: "coin",
    amount: 5,
    reason: "organization_treasury_contribution:org_1",
    balanceAfter: 4,
    accountRef: "agent:agent_1",
    assetKey: "resource:coin",
    unit: "unit",
    quantityMinor: "500",
  });

  assert.deepEqual(organizationTreasuryContributionPayload({
    treasuryEventId: "treasury_contribution_1",
    organizationId: "org_1",
    organizationName: "灰港商会",
    regionId: "region_gray_harbor",
    resourceId: "coin",
    amount: 5,
    balanceAfter: 12,
    contributingAgentId: "agent_1",
    sourceEventIds: ["resource_spent_1"],
    recordedAt: "2026-07-07T06:20:00.000Z",
  }), {
    treasuryEventId: "treasury_contribution_1",
    organizationId: "org_1",
    organizationName: "灰港商会",
    regionId: "region_gray_harbor",
    resourceId: "coin",
    amountDelta: 5,
    balanceAfter: 12,
    reason: "organization_contribution:agent_1",
    sourceEventIds: ["resource_spent_1"],
    recordedAt: "2026-07-07T06:20:00.000Z",
  });

  assert.deepEqual(organizationUpgradeTreasurySpendPayload({
    treasuryEventId: "treasury_upgrade_1",
    organizationId: "org_1",
    organizationName: "灰港商会",
    regionId: "region_gray_harbor",
    catalogEntry: upgradeEntry,
    balanceAfter: 4,
    sourceEventIds: ["membership_1"],
    recordedAt: "2026-07-07T06:25:00.000Z",
  }), {
    treasuryEventId: "treasury_upgrade_1",
    organizationId: "org_1",
    organizationName: "灰港商会",
    regionId: "region_gray_harbor",
    resourceId: "legend",
    amountDelta: -2,
    balanceAfter: 4,
    reason: "organization_upgrade:training_hall",
    sourceEventIds: ["membership_1"],
    recordedAt: "2026-07-07T06:25:00.000Z",
  });

  assert.deepEqual(organizationUpgradePurchasedPayload({
    upgradeId: "upgrade_1",
    organizationId: "org_1",
    organizationName: "灰港商会",
    regionId: "region_gray_harbor",
    catalogEntry: upgradeEntry,
    purchasedByAgentId: "agent_1",
    purchasedByExplorerId: "explorer_1",
    sourceEventIds: ["treasury_upgrade_1"],
    purchasedAt: "2026-07-07T06:25:00.000Z",
  }), {
    upgradeId: "upgrade_1",
    organizationId: "org_1",
    organizationName: "灰港商会",
    regionId: "region_gray_harbor",
    upgradeKey: "training_hall",
    title: "训练厅",
    description: "成员共享训练设施。",
    purchasedByAgentId: "agent_1",
    purchasedByExplorerId: "explorer_1",
    costResourceId: "legend",
    costAmount: 2,
    sourceEventIds: ["treasury_upgrade_1"],
    purchasedAt: "2026-07-07T06:25:00.000Z",
  });
});

test("organization treasury rules plan upgrade purchase event sequences", () => {
  const idFactory = createSequentialEpochIdFactory("organization_upgrade_purchase");
  const makeEvent = eventFactory(() => new Date("2026-07-07T06:25:00.000Z"), idFactory, {
    actorExplorerId: "explorer_1",
    trustClass: "user_verified_web",
    causationId: "cmd_upgrade_purchase",
    correlationId: "corr_upgrade_purchase",
  });

  const events = planOrganizationUpgradePurchaseEvents({
    makeEvent,
    idFactory,
    organizationId: "org_1",
    organizationName: "灰港商会",
    regionId: "region_gray_harbor",
    catalogEntry: upgradeEntry,
    treasuryBalanceBefore: 6,
    sourceEventIds: ["membership_1"],
    purchasedByAgentId: "agent_1",
    purchasedByExplorerId: "explorer_1",
    purchasedAt: "2026-07-07T06:25:00.000Z",
  });

  assert.deepEqual(events.map((event) => event.eventType), [
    "organization_treasury_changed",
    "organization_upgrade_purchased",
  ]);
  assert.equal(events[0].aggregateType, "organization");
  assert.equal(events[0].agentId, "agent_1");
  assert.deepEqual(events[0].payload, {
    treasuryEventId: events[0].aggregateId,
    organizationId: "org_1",
    organizationName: "灰港商会",
    regionId: "region_gray_harbor",
    resourceId: "legend",
    amountDelta: -2,
    balanceAfter: 4,
    reason: "organization_upgrade:training_hall",
    sourceEventIds: ["membership_1"],
    recordedAt: "2026-07-07T06:25:00.000Z",
  });
  assert.equal(events[1].aggregateType, "organization");
  assert.equal(events[1].agentId, "agent_1");
  assert.deepEqual(events[1].payload, {
    upgradeId: events[1].aggregateId,
    organizationId: "org_1",
    organizationName: "灰港商会",
    regionId: "region_gray_harbor",
    upgradeKey: "training_hall",
    title: "训练厅",
    description: "成员共享训练设施。",
    purchasedByAgentId: "agent_1",
    purchasedByExplorerId: "explorer_1",
    costResourceId: "legend",
    costAmount: 2,
    sourceEventIds: [events[0].eventId],
    purchasedAt: "2026-07-07T06:25:00.000Z",
  });
});

test("organization treasury rules select politics tick targets", () => {
  const organizationA = {
    organizationId: "organization_a",
    organizationName: "灰港账簿会",
    regionId: "region_gray_harbor",
  };
  const organizationB = {
    organizationId: "organization_b",
    organizationName: "白塔测绘局",
    regionId: "region_white_tower",
  };
  const organizationC = {
    organizationId: "organization_c",
    organizationName: "灰港巡夜队",
    regionId: "region_gray_harbor",
  };

  assert.equal(organizationPoliticsTickLimit(undefined), 10);
  assert.equal(organizationPoliticsTickLimit(0), 10);
  assert.equal(organizationPoliticsTickLimit(-5), 1);
  assert.equal(organizationPoliticsTickLimit(200), 100);
  assert.deepEqual(
    selectOrganizationPoliticsTickTargets(
      { organization_b: organizationB, organization_c: organizationC, organization_a: organizationA },
      { limit: 2 },
    ).map((organization) => organization.organizationId),
    ["organization_a", "organization_b"],
  );
  assert.deepEqual(
    selectOrganizationPoliticsTickTargets(
      { organization_b: organizationB, organization_c: organizationC, organization_a: organizationA },
      { limit: 5, regionId: " region_gray_harbor " },
    ).map((organization) => organization.organizationId),
    ["organization_a", "organization_c"],
  );
});

test("organization treasury rules plan politics payloads from rotating templates", () => {
  assert.equal(organizationPoliticsKindForIndex(0), "promotion");
  assert.equal(organizationPoliticsKindForIndex(1), "patronage");
  assert.equal(organizationPoliticsKindForIndex(4), "reform");

  assert.deepEqual(organizationPoliticsRecordedPayload({
    politicsId: "politics_1",
    organizationId: "org_1",
    organizationName: "灰港商会",
    regionId: "region_gray_harbor",
    npcId: "npc_1",
    npcName: "书记员",
    counterpartyNpcId: "npc_2",
    counterpartyName: "巡逻队长",
    templateIndex: 1,
    standingBefore: 4,
    sourceEventIds: ["event_membership"],
    recordedAt: "2026-07-07T06:30:00.000Z",
  }), {
    politicsId: "politics_1",
    organizationId: "org_1",
    organizationName: "灰港商会",
    regionId: "region_gray_harbor",
    npcId: "npc_1",
    counterpartyNpcId: "npc_2",
    kind: "patronage",
    title: "灰港商会 建立庇护链",
    summary: "书记员 在 灰港商会 内获得 巡逻队长 的庇护，短期秩序增强。",
    standingDelta: 1,
    standingAfter: 5,
    sourceEventIds: ["event_membership"],
    recordedAt: "2026-07-07T06:30:00.000Z",
  });

  assert.deepEqual(organizationPoliticsRecordedPayload({
    politicsId: "politics_2",
    organizationId: "org_1",
    organizationName: "灰港商会",
    regionId: "region_gray_harbor",
    npcId: "npc_1",
    npcName: "书记员",
    templateIndex: 4,
    standingBefore: -1,
    sourceEventIds: ["event_membership"],
    recordedAt: "2026-07-07T06:35:00.000Z",
  }), {
    politicsId: "politics_2",
    organizationId: "org_1",
    organizationName: "灰港商会",
    regionId: "region_gray_harbor",
    npcId: "npc_1",
    counterpartyNpcId: undefined,
    kind: "reform",
    title: "灰港商会 调整内部章程",
    summary: "书记员 推动 灰港商会 进行一次温和改革，派系关系被重新校准。",
    standingDelta: 1,
    standingAfter: 0,
    sourceEventIds: ["event_membership"],
    recordedAt: "2026-07-07T06:35:00.000Z",
  });
});

test("organization treasury rules plan politics tick participants and source evidence", () => {
  const plan = organizationPoliticsTickPlan({
    organizationId: "org_1",
    membershipIds: ["membership_late", "membership_agent", "membership_first", "membership_inactive"],
    membershipsById: {
      membership_late: {
        membershipId: "membership_late",
        memberType: "npc",
        npcId: "npc_2",
        status: "active",
        recordedAt: "2026-07-07T06:10:00.000Z",
        sourceEventIds: ["event_counterparty"],
      },
      membership_agent: {
        membershipId: "membership_agent",
        memberType: "agent",
        agentId: "agent_1",
        status: "active",
        recordedAt: "2026-07-07T06:05:00.000Z",
        sourceEventIds: ["event_agent"],
      },
      membership_first: {
        membershipId: "membership_first",
        memberType: "npc",
        npcId: "npc_1",
        status: "active",
        recordedAt: "2026-07-07T06:00:00.000Z",
        sourceEventIds: ["event_membership", "event_career_new"],
      },
      membership_inactive: {
        membershipId: "membership_inactive",
        memberType: "npc",
        npcId: "npc_3",
        status: "inactive",
        recordedAt: "2026-07-07T05:00:00.000Z",
        sourceEventIds: ["event_inactive"],
      },
    },
    npcsById: {
      npc_1: { npcId: "npc_1", displayName: "书记员" },
      npc_2: { npcId: "npc_2", displayName: "巡逻队长" },
    },
    careerIdsByNpc: {
      npc_1: ["career_old", "career_new", "career_other_org"],
    },
    careersById: {
      career_old: {
        careerId: "career_old",
        organizationId: "org_1",
        recordedAt: "2026-07-07T05:00:00.000Z",
        sourceEventIds: ["event_career_old"],
      },
      career_new: {
        careerId: "career_new",
        organizationId: "org_1",
        recordedAt: "2026-07-07T07:00:00.000Z",
        sourceEventIds: ["event_career_new", "event_career_extra"],
      },
      career_other_org: {
        careerId: "career_other_org",
        organizationId: "org_2",
        recordedAt: "2026-07-07T08:00:00.000Z",
        sourceEventIds: ["event_other_org"],
      },
    },
    politicsIds: ["politics_1", "politics_2"],
    standingBefore: -1,
  });

  assert.ok(plan);
  assert.equal(plan.membership.membershipId, "membership_first");
  assert.equal(plan.counterpartyMembership?.membershipId, "membership_late");
  assert.equal(plan.career?.careerId, "career_new");
  assert.equal(plan.templateIndex, 2);
  assert.equal(plan.politicsKind, "rivalry");
  assert.equal(plan.standingBefore, -1);
  assert.deepEqual(plan.sourceEventIds, ["event_membership", "event_career_new", "event_career_extra"]);

  assert.equal(organizationPoliticsTickPlan({
    organizationId: "org_1",
    membershipIds: ["membership_empty"],
    membershipsById: {
      membership_empty: {
        membershipId: "membership_empty",
        memberType: "npc",
        npcId: "npc_1",
        status: "active",
        recordedAt: "2026-07-07T06:00:00.000Z",
        sourceEventIds: [],
      },
    },
    npcsById: { npc_1: { npcId: "npc_1", displayName: "书记员" } },
    careerIdsByNpc: {},
    careersById: {},
    politicsIds: [],
    standingBefore: 0,
  }), undefined);
});

test("organization treasury rules plan politics tick events and project results", () => {
  const idFactory = createSequentialEpochIdFactory("organization_politics_planner");
  const tickedAt = "2026-07-07T06:40:00.000Z";
  const context = {
    actorExplorerId: "system",
    trustClass: "system_worker" as const,
    causationId: "cmd_system",
    correlationId: "corr_system",
  };
  const current = {
    organizationMembershipIdsByOrganization: {
      org_1: ["membership_first", "membership_late"],
    },
    organizationMemberships: {
      membership_first: {
        membershipId: "membership_first",
        memberType: "npc",
        npcId: "npc_1",
        status: "active",
        recordedAt: "2026-07-07T06:00:00.000Z",
        sourceEventIds: ["event_membership"],
      },
      membership_late: {
        membershipId: "membership_late",
        memberType: "npc",
        npcId: "npc_2",
        status: "active",
        recordedAt: "2026-07-07T06:10:00.000Z",
        sourceEventIds: ["event_counterparty"],
      },
    },
    npcs: {
      npc_1: { npcId: "npc_1", displayName: "书记员" },
      npc_2: { npcId: "npc_2", displayName: "巡逻队长" },
    },
    npcCareerIdsByNpc: {
      npc_1: ["career_1"],
    },
    npcCareerRecords: {
      career_1: {
        careerId: "career_1",
        organizationId: "org_1",
        recordedAt: "2026-07-07T06:20:00.000Z",
        sourceEventIds: ["event_career"],
      },
    },
    organizationPoliticsIdsByOrganization: {
      org_1: [],
    },
    organizationPolitics: {},
    organizationPoliticalStandingByOrganization: {
      org_1: -1,
    },
  };

  const plannedEvents = planOrganizationPoliticsTickEvents({
    applyEvents: (_projection, _events) => current,
    current,
    idFactory,
    makeEvent: eventFactory(() => new Date(tickedAt), idFactory, context),
    selectedOrganizations: [{
      organizationId: "org_1",
      displayName: "灰港商会",
      regionId: "region_gray_harbor",
    }],
    tickedAt,
  });

  assert.equal(plannedEvents.length, 1);
  const politicsEvent = plannedEvents[0];
  assert.equal(politicsEvent.eventType, "organization_politics_recorded");
  assert.equal(politicsEvent.aggregateType, "organization_politics");
  assert.equal(politicsEvent.payload.kind, "promotion");
  assert.equal(politicsEvent.payload.title, "灰港商会 记录一次任命");
  assert.equal(politicsEvent.payload.standingAfter, 1);
  assert.deepEqual(politicsEvent.payload.sourceEventIds, ["event_membership", "event_career"]);

  const projected = {
    ...current,
    organizationPolitics: {
      [politicsEvent.aggregateId]: {
        politicsId: politicsEvent.aggregateId,
        title: politicsEvent.payload.title,
      },
    },
  };
  const result = projectOrganizationPoliticsTickResult({
    tickedAt,
    events: plannedEvents,
    projection: projected,
  });
  assert.equal(result.tickedAt, tickedAt);
  assert.deepEqual(result.politics, [{
    politicsId: politicsEvent.aggregateId,
    title: "灰港商会 记录一次任命",
  }]);
});

test("organization treasury rules calculate budget voting thresholds and pending state", () => {
  assert.equal(organizationBudgetApprovalThresholdForBudget(budget), 2);
  assert.equal(organizationBudgetRejectionThresholdForBudget(budget), 2);
  assert.equal(organizationBudgetApprovalCountAfter(budget, "approved"), 2);
  assert.equal(organizationBudgetRejectionCountAfter(budget, "rejected"), 1);
  assert.equal(organizationBudgetRequiresVoteRecord(budget), true);
  assert.equal(organizationBudgetDecisionStillPending(budget, "approved"), false);
  assert.equal(organizationBudgetDecisionStillPending(budget, "rejected"), true);
});

test("organization treasury rules plan vote treasury and resolution payloads", () => {
  assert.deepEqual(organizationBudgetVotePayload({
    voteId: "vote_1",
    budget,
    decision: "approved",
    voterAgentId: "agent_voter",
    voterExplorerId: "explorer_voter",
    voterRole: "scribe",
    note: "同意",
    votedAt: "2026-07-07T06:10:00.000Z",
  }), {
    voteId: "vote_1",
    budgetId: "budget_1",
    organizationId: "org_1",
    organizationName: "灰港商会",
    regionId: "region_gray_harbor",
    resourceId: "coin",
    amount: 7,
    decision: "approved",
    voterAgentId: "agent_voter",
    voterExplorerId: "explorer_voter",
    voterRole: "scribe",
    approvalCount: 2,
    rejectionCount: 0,
    approvalThreshold: 2,
    rejectionThreshold: 2,
    note: "同意",
    sourceEventIds: ["event_proposed"],
    votedAt: "2026-07-07T06:10:00.000Z",
  });
  assert.deepEqual(organizationBudgetTreasurySpendPayload({
    treasuryEventId: "treasury_1",
    budget,
    balanceAfter: 5,
    sourceEventIds: ["vote_1"],
    recordedAt: "2026-07-07T06:10:00.000Z",
  }), {
    treasuryEventId: "treasury_1",
    organizationId: "org_1",
    organizationName: "灰港商会",
    regionId: "region_gray_harbor",
    resourceId: "coin",
    amountDelta: -7,
    balanceAfter: 5,
    reason: "organization_budget:budget_1",
    sourceEventIds: ["vote_1"],
    recordedAt: "2026-07-07T06:10:00.000Z",
  });
  assert.deepEqual(organizationBudgetResolvedPayload({
    budget,
    resolution: "approved",
    resolvedByAgentId: "agent_voter",
    resolvedByExplorerId: "explorer_voter",
    note: "同意",
    treasuryEventId: "treasury_1",
    sourceEventIds: ["treasury_1"],
    resolvedAt: "2026-07-07T06:10:00.000Z",
  }), {
    budgetId: "budget_1",
    organizationId: "org_1",
    organizationName: "灰港商会",
    regionId: "region_gray_harbor",
    resourceId: "coin",
    amount: 7,
    resolution: "approved",
    resolvedByAgentId: "agent_voter",
    resolvedByExplorerId: "explorer_voter",
    note: "同意",
    treasuryEventId: "treasury_1",
    sourceEventIds: ["treasury_1"],
    resolvedAt: "2026-07-07T06:10:00.000Z",
  });
});

test("organization treasury rules plan budget resolution event sequences", () => {
  const idFactory = createSequentialEpochIdFactory("organization_budget_resolution");
  const makeEvent = eventFactory(() => new Date("2026-07-07T06:10:00.000Z"), idFactory, {
    actorExplorerId: "explorer_voter",
    trustClass: "user_verified_web",
    causationId: "cmd_budget_resolution",
    correlationId: "corr_budget_resolution",
  });

  const events = planOrganizationBudgetResolutionEvents({
    makeEvent,
    idFactory,
    budget,
    resolution: "approved",
    resolvedByAgentId: "agent_voter",
    resolvedByExplorerId: "explorer_voter",
    resolverRole: "scribe",
    note: "同意",
    treasuryBalanceBefore: 20,
    resolvedAt: "2026-07-07T06:10:00.000Z",
  });

  assert.deepEqual(events.map((event) => event.eventType), [
    "organization_budget_vote_recorded",
    "organization_treasury_changed",
    "organization_budget_resolved",
  ]);
  assert.equal(events[0].aggregateType, "organization");
  assert.equal(events[0].agentId, "agent_voter");
  assert.deepEqual(events[0].payload, {
    voteId: events[0].aggregateId,
    budgetId: "budget_1",
    organizationId: "org_1",
    organizationName: "灰港商会",
    regionId: "region_gray_harbor",
    resourceId: "coin",
    amount: 7,
    decision: "approved",
    voterAgentId: "agent_voter",
    voterExplorerId: "explorer_voter",
    voterRole: "scribe",
    approvalCount: 2,
    rejectionCount: 0,
    approvalThreshold: 2,
    rejectionThreshold: 2,
    note: "同意",
    sourceEventIds: ["event_proposed"],
    votedAt: "2026-07-07T06:10:00.000Z",
  });
  assert.equal(events[1].aggregateType, "organization");
  assert.equal(events[1].agentId, "agent_voter");
  assert.deepEqual(events[1].payload, {
    treasuryEventId: events[1].aggregateId,
    organizationId: "org_1",
    organizationName: "灰港商会",
    regionId: "region_gray_harbor",
    resourceId: "coin",
    amountDelta: -7,
    balanceAfter: 13,
    reason: "organization_budget:budget_1",
    sourceEventIds: [events[0].eventId],
    recordedAt: "2026-07-07T06:10:00.000Z",
  });
  assert.equal(events[2].aggregateType, "organization");
  assert.equal(events[2].aggregateId, "budget_1");
  assert.equal(events[2].agentId, "agent_voter");
  assert.deepEqual(events[2].payload, {
    budgetId: "budget_1",
    organizationId: "org_1",
    organizationName: "灰港商会",
    regionId: "region_gray_harbor",
    resourceId: "coin",
    amount: 7,
    resolution: "approved",
    resolvedByAgentId: "agent_voter",
    resolvedByExplorerId: "explorer_voter",
    note: "同意",
    treasuryEventId: events[1].aggregateId,
    sourceEventIds: [events[1].eventId],
    resolvedAt: "2026-07-07T06:10:00.000Z",
  });

  const pendingEvents = planOrganizationBudgetResolutionEvents({
    makeEvent,
    idFactory,
    budget,
    resolution: "rejected",
    resolvedByAgentId: "agent_voter",
    resolvedByExplorerId: "explorer_voter",
    resolverRole: "scribe",
    note: "反对",
    resolvedAt: "2026-07-07T06:11:00.000Z",
  });

  assert.deepEqual(pendingEvents.map((event) => event.eventType), ["organization_budget_vote_recorded"]);
  assert.deepEqual(pendingEvents[0].payload, {
    voteId: pendingEvents[0].aggregateId,
    budgetId: "budget_1",
    organizationId: "org_1",
    organizationName: "灰港商会",
    regionId: "region_gray_harbor",
    resourceId: "coin",
    amount: 7,
    decision: "rejected",
    voterAgentId: "agent_voter",
    voterExplorerId: "explorer_voter",
    voterRole: "scribe",
    approvalCount: 1,
    rejectionCount: 1,
    approvalThreshold: 2,
    rejectionThreshold: 2,
    note: "反对",
    sourceEventIds: ["event_proposed"],
    votedAt: "2026-07-07T06:11:00.000Z",
  });
});
