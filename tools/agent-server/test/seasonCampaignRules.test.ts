import assert from "node:assert/strict";
import test from "node:test";

import type { EpochEvent } from "../lib/epoch/events.ts";
import {
  REGION_CONTROL_SEASON_BONUS_MAX_SCORE,
  REGION_CONTROL_SEASON_BONUS_SCORE,
  REGION_REVOLT_DEFENDER_BASE_POWER,
  TRAINING_HALL_SEASON_BONUS_SCORE,
  addSeasonTrustScore,
  agentSeasonStandingForRegion,
  dominantSeasonTrustClass,
  latestRegionControlReleaseEvent,
  normalizeSeasonTrustBreakdown,
  planRegionControlDecayEvents,
  planReleasedRegionControlClaimEvents,
  planRegionRevoltResolutionEvents,
  planSeasonCampaignCreationEvents,
  planSeasonCampaignContributionEvents,
  planSeasonCampaignSettlementEvents,
  projectRegionControlDecays,
  projectReleasedRegionControlClaim,
  projectRegionRevoltResolution,
  projectSeasonCampaignCreation,
  projectSeasonCampaignContribution,
  projectSeasonCampaignSettlement,
  regionControlBonusRegionIdsForSeasonContribution,
  regionControlDecayAmount,
  regionControlDecayLimit,
  regionControlDecayMinAgeSeconds,
  regionControlDecayMinScore,
  regionControlDecayPayload,
  regionControlReleasePayload,
  regionControlScoreAfter,
  regionRevoltControlPayload,
  regionRevoltInfluenceDelta,
  regionRevoltInfluencePayload,
  regionRevoltResolvedPayload,
  regionRevoltSettlement,
  regionRevoltStaminaSpendPayload,
  regionRevoltTracePayload,
  releasedRegionClaimControlPayload,
  requireActiveSeasonCampaign,
  requireSeasonCampaign,
  seasonCampaignRewardGrantPayload,
  seasonCampaignCreatedPayload,
  seasonContributionOrganizationBonusScore,
  seasonContributionPayload,
  seasonContributionRegionControlBonusScore,
  seasonContributionSpendPayload,
  seasonCampaignResolvedPayload,
  seasonCampaignSettlementPlan,
  seasonObjectiveCreatedPayload,
  seasonOrganizationDividendAmount,
  seasonOrganizationDividendGrantPayload,
  seasonOrganizationPrestigeDelta,
  seasonOrganizationPrestigePayload,
  seasonOrganizationTreasuryPayload,
  seasonObjectiveCompletionPayloads,
  seasonRegionControlPayload,
  seasonRegionMonumentPayload,
  seasonStartedPayload,
  seasonResolvedPayload,
  selectRegionControlDecayTargets,
  trustedSeasonScoreDelta,
} from "../lib/epoch/seasonCampaignRules.ts";
import { eventFactory } from "../lib/epoch/eventFactory.ts";
import { createSequentialEpochIdFactory } from "../lib/epoch/protocol.ts";

test("season campaign rules read campaign projection state", () => {
  const projection = {
    seasonCampaigns: {
      season_active: { status: "active", marker: "active" },
      season_resolved: { status: "resolved", marker: "resolved" },
    },
  };

  assert.equal(requireSeasonCampaign(projection, "season_active").marker, "active");
  assert.equal(requireActiveSeasonCampaign(projection, "season_active").marker, "active");
  assert.throws(() => requireSeasonCampaign(projection, "missing"), /season_campaign_not_found/);
  assert.throws(() => requireActiveSeasonCampaign(projection, "season_resolved"), /season_campaign_resolved/);
});

test("season campaign rules plan creation and start payloads", () => {
  const created = seasonCampaignCreatedPayload({
    seasonId: "season_gray_tide",
    seasonKey: "gray_tide",
    title: "灰港潮汐季",
    description: "  海雾季节阵营战  ",
    regionIds: ["region_gray_harbor"],
    factionIds: ["gray_watch", "cinder_archive"],
    resourceId: "coin",
    targetScore: 12,
    reward: { resourceId: "legend", amount: 2, reason: "season_reward" },
    createdAt: "2026-07-07T02:00:00.000Z",
  });

  assert.deepEqual(created, {
    seasonId: "season_gray_tide",
    seasonKey: "gray_tide",
    title: "灰港潮汐季",
    description: "海雾季节阵营战",
    regionIds: ["region_gray_harbor"],
    factionIds: ["gray_watch", "cinder_archive"],
    resourceId: "coin",
    targetScore: 12,
    reward: { resourceId: "legend", amount: 2, reason: "season_reward" },
    createdAt: "2026-07-07T02:00:00.000Z",
  });

  assert.equal(seasonCampaignCreatedPayload({
    seasonId: "season_default",
    seasonKey: "default",
    title: "默认季",
    regionIds: ["region_gray_harbor"],
    factionIds: ["gray_watch", "cinder_archive"],
    resourceId: "coin",
    targetScore: 8,
    reward: { resourceId: "legend", amount: 1, reason: "season_reward" },
    createdAt: "2026-07-07T02:01:00.000Z",
  }).description, "季节阵营战");

  assert.deepEqual(seasonStartedPayload({
    campaign: created,
    sourceEventId: "event_created",
  }), {
    seasonId: "season_gray_tide",
    seasonKey: "gray_tide",
    title: "灰港潮汐季",
    regionIds: ["region_gray_harbor"],
    factionIds: ["gray_watch", "cinder_archive"],
    targetScore: 12,
    phase: "active",
    sourceEventId: "event_created",
    startedAt: "2026-07-07T02:00:00.000Z",
  });
});

test("season campaign rules plan created objective payloads", () => {
  assert.deepEqual(seasonObjectiveCreatedPayload({
    objectiveId: "objective_1",
    seasonId: "season_gray_tide",
    objectiveKey: "hold_harbor",
    title: "守住灰港",
    description: "完成港口协防",
    targetScore: 5,
    createdAt: "2026-07-07T02:00:00.000Z",
  }), {
    objectiveId: "objective_1",
    seasonId: "season_gray_tide",
    objectiveKey: "hold_harbor",
    title: "守住灰港",
    description: "完成港口协防",
    targetScore: 5,
    createdAt: "2026-07-07T02:00:00.000Z",
  });
});

test("season campaign rules plan creation event sequences", () => {
  const idFactory = createSequentialEpochIdFactory("season_creation");
  const createdAt = "2026-07-07T02:00:00.000Z";
  const reward = { resourceId: "legend" as const, amount: 2, reason: "season_reward" };
  const events = planSeasonCampaignCreationEvents({
    seasonId: "season_gray_tide",
    seasonKey: "gray_tide",
    title: "灰港潮汐季",
    description: "海雾季节阵营战",
    regionIds: ["region_gray_harbor"],
    factionIds: ["gray_watch", "cinder_archive"],
    resourceId: "coin",
    targetScore: 12,
    reward,
    createdAt,
    objectiveTemplates: [{
      objectiveKey: "hold_harbor",
      title: "守住灰港",
      description: "完成港口协防",
      targetScore: 5,
    }],
    idFactory,
    makeEvent: eventFactory(() => new Date(createdAt), idFactory, {
      actorExplorerId: "system",
      trustClass: "server_hosted_agent" as const,
      causationId: "season_creation",
      correlationId: "corr_season_creation",
    }),
  });

  assert.deepEqual(events.map((event) => event.eventType), [
    "season_campaign_created",
    "season_started",
    "season_objective_created",
  ]);
  const [created, started, objective] = events;
  assert.equal(created?.aggregateType, "season_campaign");
  assert.equal(created?.aggregateId, "season_gray_tide");
  assert.equal(started?.aggregateType, "season_campaign");
  assert.equal(started?.aggregateId, "season_gray_tide");
  assert.equal(objective?.aggregateType, "season_objective");
  if (created?.eventType !== "season_campaign_created") throw new Error("expected_season_campaign_created_event");
  if (started?.eventType !== "season_started") throw new Error("expected_season_started_event");
  if (objective?.eventType !== "season_objective_created") throw new Error("expected_season_objective_created_event");
  assert.equal(started.payload.sourceEventId, created.eventId);
  assert.equal(objective.payload.objectiveId, "season_creation_season_objective_season_gray_tidehold_harbor_0jte80d");
  assert.equal(objective.payload.createdAt, createdAt);

  const projectedCampaign = {
    seasonId: "season_gray_tide",
    status: "active",
    marker: "created",
  } as const;
  assert.equal(projectSeasonCampaignCreation({
    events,
    projection: {
      seasonCampaigns: {
        season_gray_tide: projectedCampaign,
      },
    },
  }), projectedCampaign);
  assert.throws(() => projectSeasonCampaignCreation({
    events: [],
    projection: {
      seasonCampaigns: {
        season_gray_tide: projectedCampaign,
      },
    },
  }), /season_campaign_created_event_missing/);
  assert.throws(() => projectSeasonCampaignCreation({
    events,
    projection: {
      seasonCampaigns: {},
    },
  }), /season_campaign_projection_failed/);
});

test("season campaign rules calculate score-only contribution bonuses", () => {
  assert.equal(TRAINING_HALL_SEASON_BONUS_SCORE, 1);
  assert.equal(REGION_CONTROL_SEASON_BONUS_SCORE, 1);
  assert.equal(REGION_CONTROL_SEASON_BONUS_MAX_SCORE, 3);
  assert.equal(seasonContributionOrganizationBonusScore([]), 0);
  assert.equal(seasonContributionOrganizationBonusScore(["upgrade_training_hall"]), 1);
  assert.equal(seasonContributionRegionControlBonusScore(["region_a", "region_b"]), 2);
  assert.equal(seasonContributionRegionControlBonusScore(["region_a", "region_b", "region_c", "region_d"]), 3);

  const projection = {
    regionControls: {
      region_b: { controllingFactionId: "gray_watch" },
      region_a: { controllingFactionId: "gray_watch" },
      region_c: { controllingFactionId: "cinder_archive" },
    },
    seasonCampaignIdsByRegion: {
      region_a: ["season_old", "season_zero", "season_new", "season_tie"],
    },
    seasonCampaigns: {
      season_old: {
        seasonId: "season_old",
        createdAt: "2026-07-07T01:00:00.000Z",
        agentStandings: [{ agentId: "agent_1", factionId: "gray_watch", score: 4 }],
      },
      season_zero: {
        seasonId: "season_zero",
        createdAt: "2026-07-07T03:00:00.000Z",
        agentStandings: [{ agentId: "agent_1", factionId: "gray_watch", score: 0 }],
      },
      season_new: {
        seasonId: "season_new",
        createdAt: "2026-07-07T02:00:00.000Z",
        agentStandings: [{ agentId: "agent_1", factionId: "gray_watch", score: 5 }],
      },
      season_tie: {
        seasonId: "season_tie",
        createdAt: "2026-07-07T02:00:00.000Z",
        agentStandings: [{ agentId: "agent_1", factionId: "cinder_archive", score: 5 }],
      },
    },
  };

  assert.deepEqual(regionControlBonusRegionIdsForSeasonContribution(projection, {
    factionId: "gray_watch",
    seasonRegionIds: ["region_c", "region_b", "region_a", "region_missing"],
  }), ["region_a", "region_b"]);
  assert.deepEqual(agentSeasonStandingForRegion(projection, {
    regionId: "region_a",
    agentId: "agent_1",
  }), {
    factionId: "cinder_archive",
    score: 5,
    seasonCreatedAt: "2026-07-07T02:00:00.000Z",
    seasonId: "season_tie",
  });
  assert.equal(agentSeasonStandingForRegion(projection, {
    regionId: "region_missing",
    agentId: "agent_1",
  }), undefined);
});

test("season campaign rules normalize contribution trust breakdowns", () => {
  assert.deepEqual(normalizeSeasonTrustBreakdown({
    remote_attested_runner: 0,
    host_attested: 3,
    server_hosted_agent: Number.NaN,
    user_verified_web: 2,
    system_worker: -1,
    untrusted_client: 1,
  }), {
    host_attested: 3,
    user_verified_web: 2,
    untrusted_client: 1,
  });

  assert.deepEqual(addSeasonTrustScore({
    user_verified_web: 2,
    untrusted_client: -5,
  }, "remote_attested_runner", 4), {
    remote_attested_runner: 4,
    user_verified_web: 2,
  });
  assert.deepEqual(addSeasonTrustScore({ user_verified_web: 2 }, "host_attested", 0), {
    user_verified_web: 2,
  });

  assert.equal(dominantSeasonTrustClass({
    user_verified_web: 4,
    host_attested: 4,
    untrusted_client: 9,
  }), "untrusted_client");
  assert.equal(dominantSeasonTrustClass({
    user_verified_web: 4,
    host_attested: 4,
  }), "host_attested");
  assert.equal(dominantSeasonTrustClass({}), "remote_attested_runner");

  assert.equal(trustedSeasonScoreDelta("remote_attested_runner", 5), 5);
  assert.equal(trustedSeasonScoreDelta("host_attested", 5), 5);
  assert.equal(trustedSeasonScoreDelta("server_hosted_agent", 5), 5);
  assert.equal(trustedSeasonScoreDelta("user_verified_web", 5), 0);
  assert.equal(trustedSeasonScoreDelta("system_worker", 5), 0);
  assert.equal(trustedSeasonScoreDelta("untrusted_client", 5), 0);
});

test("season campaign rules plan contribution payloads", () => {
  assert.deepEqual(seasonContributionSpendPayload({
    agentId: "agent_alpha",
    seasonId: "season_1",
    factionId: "gray_watch",
    resourceId: "coin",
    amount: 2,
    balanceBefore: 8,
  }), {
    resourceId: "coin",
    amount: 2,
    reason: "season_contribution:season_1:gray_watch",
    balanceAfter: 6,
    accountRef: "agent:agent_alpha",
    assetKey: "resource:coin",
    unit: "unit",
    quantityMinor: "200",
  });

  assert.deepEqual(seasonContributionPayload({
    seasonId: "season_1",
    agentId: "agent_alpha",
    explorerId: "explorer_alpha",
    factionId: "gray_watch",
    resourceId: "coin",
    amount: 2,
    previousAgentScore: 4,
    previousFactionScore: 6,
    totalScore: 10,
    sourceOrganizationUpgradeIds: ["upgrade_training_hall"],
    sourceRegionControlRegionIds: ["region_gray_harbor", "region_cinder"],
    recordedAt: "2026-07-07T01:00:00.000Z",
  }), {
    seasonId: "season_1",
    agentId: "agent_alpha",
    explorerId: "explorer_alpha",
    factionId: "gray_watch",
    resourceId: "coin",
    amount: 2,
    baseScoreDelta: 2,
    organizationBonusScore: 1,
    regionControlBonusScore: 2,
    scoreDelta: 5,
    sourceOrganizationUpgradeIds: ["upgrade_training_hall"],
    sourceRegionControlRegionIds: ["region_gray_harbor", "region_cinder"],
    agentScoreAfter: 9,
    factionScoreAfter: 11,
    totalScoreAfter: 15,
    recordedAt: "2026-07-07T01:00:00.000Z",
  });
});

test("season campaign rules plan objective completion payloads", () => {
  assert.deepEqual(seasonObjectiveCompletionPayloads({
    seasonId: "season_1",
    completedByAgentId: "agent_alpha",
    completedByExplorerId: "explorer_alpha",
    completedByFactionId: "gray_watch",
    totalScoreAfter: 8,
    sourceEventId: "event_contribution",
    completedAt: "2026-07-07T01:00:00.000Z",
    objectives: [
      { objectiveId: "objective_open_done", status: "open", targetScore: 5 },
      { objectiveId: "objective_open_later", status: "open", targetScore: 10 },
      { objectiveId: "objective_completed", status: "completed", targetScore: 3 },
    ],
  }), [{
    objectiveId: "objective_open_done",
    seasonId: "season_1",
    completedByAgentId: "agent_alpha",
    completedByExplorerId: "explorer_alpha",
    completedByFactionId: "gray_watch",
    progressScore: 5,
    targetScore: 5,
    sourceEventId: "event_contribution",
    completedAt: "2026-07-07T01:00:00.000Z",
  }]);
});

test("season campaign rules plan contribution event sequences", () => {
  const idFactory = createSequentialEpochIdFactory("season_contribution");
  const recordedAt = "2026-07-07T01:00:00.000Z";
  const events = planSeasonCampaignContributionEvents({
    seasonId: "season_1",
    agentId: "agent_alpha",
    explorerId: "explorer_alpha",
    factionId: "gray_watch",
    resourceId: "coin",
    amount: 2,
    previousAgentScore: 4,
    previousFactionScore: 6,
    totalScore: 10,
    sourceOrganizationUpgradeIds: ["upgrade_training_hall"],
    sourceRegionControlRegionIds: ["region_gray_harbor"],
    balanceBefore: 8,
    recordedAt,
    objectives: [
      { objectiveId: "objective_open_done", status: "open", targetScore: 5 },
      { objectiveId: "objective_open_later", status: "open", targetScore: 20 },
    ],
    makeEvent: eventFactory(() => new Date(recordedAt), idFactory, {
      actorExplorerId: "explorer_alpha",
      trustClass: "user_verified_web" as const,
      causationId: "season_contribution",
      correlationId: "corr_season_contribution",
    }),
  });

  assert.deepEqual(events.map((event) => event.eventType), [
    "resource_spent",
    "season_contribution_recorded",
    "season_objective_completed",
  ]);
  const [spent, contributed, completed] = events;
  assert.equal(spent?.aggregateType, "resource_account");
  assert.equal(spent?.aggregateId, "agent_alpha");
  assert.equal(contributed?.aggregateType, "season_campaign");
  assert.equal(contributed?.aggregateId, "season_1");
  assert.equal(completed?.aggregateType, "season_objective");
  assert.equal(completed?.aggregateId, "objective_open_done");
  if (spent?.eventType !== "resource_spent") throw new Error("expected_resource_spent_event");
  if (contributed?.eventType !== "season_contribution_recorded") {
    throw new Error("expected_season_contribution_recorded_event");
  }
  if (completed?.eventType !== "season_objective_completed") {
    throw new Error("expected_season_objective_completed_event");
  }
  assert.deepEqual(spent.payload, {
    resourceId: "coin",
    amount: 2,
    reason: "season_contribution:season_1:gray_watch",
    balanceAfter: 6,
    accountRef: "agent:agent_alpha",
    assetKey: "resource:coin",
    unit: "unit",
    quantityMinor: "200",
  });
  assert.equal(contributed.payload.totalScoreAfter, 14);
  assert.equal(completed.payload.sourceEventId, contributed.eventId);

  const projectedCampaign = {
    seasonId: "season_1",
    status: "active",
    marker: "contributed",
  } as const;
  assert.equal(projectSeasonCampaignContribution({
    events,
    projection: {
      seasonCampaigns: {
        season_1: projectedCampaign,
      },
    },
  }), projectedCampaign);
  assert.throws(() => projectSeasonCampaignContribution({
    events: [],
    projection: {
      seasonCampaigns: {
        season_1: projectedCampaign,
      },
    },
  }), /season_contribution_recorded_event_missing/);
  assert.throws(() => projectSeasonCampaignContribution({
    events,
    projection: {
      seasonCampaigns: {},
    },
  }), /season_campaign_projection_failed/);
});

test("season campaign rules plan settlement winner selection", () => {
  const reward = { resourceId: "legend", amount: 4, reason: "season_reward" } as const;
  assert.deepEqual(seasonCampaignSettlementPlan({
    factionStandings: [
      { factionId: "gray_watch", score: 7 },
      { factionId: "cinder_archive", score: 3 },
    ],
    agentStandings: [
      { agentId: "agent_winner", explorerId: "explorer_winner", factionId: "gray_watch" },
      { agentId: "agent_rival", explorerId: "explorer_rival", factionId: "cinder_archive" },
    ],
    reward,
  }), {
    winningFaction: { factionId: "gray_watch", score: 7 },
    contestedByFaction: { factionId: "cinder_archive", score: 3 },
    winner: { agentId: "agent_winner", explorerId: "explorer_winner", factionId: "gray_watch" },
    reward,
  });

  assert.deepEqual(seasonCampaignSettlementPlan({
    factionStandings: [{ factionId: "gray_watch", score: 0 }],
    agentStandings: [{ agentId: "agent_winner", explorerId: "explorer_winner", factionId: "gray_watch" }],
    reward,
  }), {
    winningFaction: undefined,
    contestedByFaction: undefined,
    winner: undefined,
    reward: undefined,
  });
});

test("season campaign rules plan resolved season payloads", () => {
  const reward = { resourceId: "legend", amount: 4, reason: "season_reward" } as const;
  const winningFaction = { factionId: "gray_watch", score: 7 };
  const winner = { agentId: "agent_winner", explorerId: "explorer_winner", factionId: "gray_watch" };

  assert.deepEqual(seasonCampaignRewardGrantPayload({
    agentId: "agent_winner",
    reward,
    winnerRewardBalanceBefore: 3,
  }), {
    resourceId: "legend",
    amount: 4,
    reason: "season_reward",
    balanceAfter: 7,
    accountRef: "agent:agent_winner",
    assetKey: "resource:legend",
    unit: "unit",
    quantityMinor: "400",
  });

  assert.deepEqual(seasonCampaignResolvedPayload({
    seasonId: "season_1",
    resolvedAt: "2026-07-07T02:00:00.000Z",
    winningFaction,
    winner,
    reward,
  }), {
    seasonId: "season_1",
    resolvedAt: "2026-07-07T02:00:00.000Z",
    winningFactionId: "gray_watch",
    winnerAgentId: "agent_winner",
    winnerExplorerId: "explorer_winner",
    winningScore: 7,
    reward,
  });

  assert.deepEqual(seasonResolvedPayload({
    seasonId: "season_1",
    sourceEventId: "event_resolved",
    relatedEventIds: ["event_reward", "event_control"],
    winningFaction,
    winner,
    resolvedAt: "2026-07-07T02:00:00.000Z",
  }), {
    seasonId: "season_1",
    phase: "resolved",
    sourceEventId: "event_resolved",
    relatedEventIds: ["event_reward", "event_control"],
    winningFactionId: "gray_watch",
    winnerAgentId: "agent_winner",
    winnerExplorerId: "explorer_winner",
    winningScore: 7,
    resolvedAt: "2026-07-07T02:00:00.000Z",
  });
});

test("season campaign rules plan organization dividend and prestige payloads", () => {
  assert.equal(seasonOrganizationDividendAmount(1), 1);
  assert.equal(seasonOrganizationDividendAmount(5), 2);
  assert.equal(seasonOrganizationPrestigeDelta(0), 1);
  assert.equal(seasonOrganizationPrestigeDelta(7), 7);

  assert.deepEqual(seasonOrganizationDividendGrantPayload({
    agentId: "agent_member",
    seasonId: "season_1",
    organizationId: "org_1",
    resourceId: "legend",
    amount: 2,
    memberBalanceBefore: 5,
  }), {
    resourceId: "legend",
    amount: 2,
    reason: "organization_season_dividend:season_1:org_1",
    balanceAfter: 7,
    accountRef: "agent:agent_member",
    assetKey: "resource:legend",
    unit: "unit",
    quantityMinor: "200",
  });

  assert.deepEqual(seasonOrganizationTreasuryPayload({
    treasuryEventId: "treasury_event",
    organizationId: "org_1",
    organizationName: "灰港巡夜会",
    regionId: "region_gray_harbor",
    resourceId: "legend",
    amount: 4,
    balanceAfter: 9,
    seasonId: "season_1",
    sourceEventIds: ["event_resolved", "event_member", "event_member"],
    recordedAt: "2026-07-07T02:00:00.000Z",
  }), {
    treasuryEventId: "treasury_event",
    organizationId: "org_1",
    organizationName: "灰港巡夜会",
    regionId: "region_gray_harbor",
    resourceId: "legend",
    amountDelta: 4,
    balanceAfter: 9,
    reason: "season_campaign:season_1",
    sourceSeasonId: "season_1",
    sourceEventIds: ["event_resolved", "event_member"],
    recordedAt: "2026-07-07T02:00:00.000Z",
  });

  assert.deepEqual(seasonOrganizationPrestigePayload({
    prestigeId: "prestige_event",
    organizationId: "org_1",
    organizationName: "灰港巡夜会",
    regionId: "region_gray_harbor",
    agentId: "agent_winner",
    standingDelta: 7,
    standingAfter: 10,
    seasonId: "season_1",
    sourceEventIds: ["event_resolved", "event_member", "event_member"],
    recordedAt: "2026-07-07T02:00:00.000Z",
  }), {
    prestigeId: "prestige_event",
    organizationId: "org_1",
    organizationName: "灰港巡夜会",
    regionId: "region_gray_harbor",
    agentId: "agent_winner",
    sourceSeasonId: "season_1",
    standingDelta: 7,
    standingAfter: 10,
    reason: "season_campaign:season_1",
    sourceEventIds: ["event_resolved", "event_member"],
    recordedAt: "2026-07-07T02:00:00.000Z",
  });
});

test("season campaign rules plan region control and monument payloads", () => {
  assert.deepEqual(seasonRegionControlPayload({
    regionId: "region_gray_harbor",
    seasonId: "season_1",
    winningFaction: { factionId: "gray_watch", score: 7 },
    contestedByFaction: { factionId: "cinder_archive", score: 3 },
    previousControllingFactionId: "old_faction",
    changedAt: "2026-07-07T02:00:00.000Z",
  }), {
    regionId: "region_gray_harbor",
    controllingFactionId: "gray_watch",
    previousControllingFactionId: "old_faction",
    controlScore: 7,
    contestedByFactionId: "cinder_archive",
    controlMargin: 4,
    sourceSeasonId: "season_1",
    changedAt: "2026-07-07T02:00:00.000Z",
  });

  assert.deepEqual(seasonRegionMonumentPayload({
    monumentId: "monument_1",
    regionId: "region_gray_harbor",
    seasonId: "season_1",
    campaignTitle: "灰港潮汐季",
    winningFactionId: "gray_watch",
    winner: { agentId: "agent_winner", explorerId: "explorer_winner", factionId: "gray_watch" },
    controlScore: 7,
    builtAt: "2026-07-07T02:00:00.000Z",
  }), {
    monumentId: "monument_1",
    regionId: "region_gray_harbor",
    title: "灰港潮汐季胜利纪念碑",
    description: "gray_watch 在 灰港潮汐季 中取得区域控制，explorer_winner 的身份被刻入赛季档案。",
    controllingFactionId: "gray_watch",
    winnerAgentId: "agent_winner",
    winnerExplorerId: "explorer_winner",
    sourceSeasonId: "season_1",
    controlScore: 7,
    builtAt: "2026-07-07T02:00:00.000Z",
  });
});

test("season campaign rules plan settlement event sequences", () => {
  const idFactory = createSequentialEpochIdFactory("season_settlement");
  const resolvedAt = "2026-07-07T02:00:00.000Z";
  const reward = { resourceId: "legend" as const, amount: 4, reason: "season_reward" };
  const events = planSeasonCampaignSettlementEvents({
    seasonId: "season_1",
    campaignTitle: "灰港潮汐季",
    settlement: {
      winningFaction: { factionId: "gray_watch", score: 7 },
      contestedByFaction: { factionId: "cinder_archive", score: 3 },
      winner: { agentId: "agent_winner", explorerId: "explorer_winner", factionId: "gray_watch" },
      reward,
    },
    organizations: [{
      organizationId: "org_1",
      organizationName: "灰港巡夜会",
      regionId: "region_gray_harbor",
      activeAgentIds: ["agent_winner", "agent_support"],
      sourceEventIds: ["membership_1", "membership_1", "membership_2"],
    }],
    regionControls: [{
      regionId: "region_gray_harbor",
      previousControllingFactionId: "old_faction",
    }],
    resolvedAt,
    idFactory,
    makeEvent: eventFactory(() => new Date(resolvedAt), idFactory, {
      actorExplorerId: "system",
      trustClass: "server_hosted_agent" as const,
      causationId: "season_settlement",
      correlationId: "corr_season_settlement",
    }),
    resourceBalanceBefore: (eventsSoFar, agentId, resourceId) => {
      let balance = agentId === "agent_winner" ? 3 : 5;
      for (const event of eventsSoFar) {
        if (
          event.eventType === "resource_granted"
          && event.aggregateId === agentId
          && event.payload.resourceId === resourceId
        ) {
          balance = event.payload.balanceAfter;
        }
      }
      return balance;
    },
    organizationTreasuryBalanceBefore: () => 9,
    organizationStandingBefore: () => 10,
  });

  assert.deepEqual(events.map((event) => event.eventType), [
    "season_campaign_resolved",
    "resource_granted",
    "resource_granted",
    "resource_granted",
    "organization_treasury_changed",
    "organization_prestige_changed",
    "region_control_changed",
    "region_monument_built",
    "season_resolved",
  ]);
  const [resolved, winnerReward, winnerDividend, supporterDividend, treasury, prestige, control, monument, phase] = events;
  if (resolved?.eventType !== "season_campaign_resolved") throw new Error("expected_season_campaign_resolved");
  if (winnerReward?.eventType !== "resource_granted") throw new Error("expected_winner_resource_granted");
  if (winnerDividend?.eventType !== "resource_granted") throw new Error("expected_winner_dividend_granted");
  if (supporterDividend?.eventType !== "resource_granted") throw new Error("expected_supporter_dividend_granted");
  if (treasury?.eventType !== "organization_treasury_changed") throw new Error("expected_treasury_changed");
  if (prestige?.eventType !== "organization_prestige_changed") throw new Error("expected_prestige_changed");
  if (control?.eventType !== "region_control_changed") throw new Error("expected_region_control_changed");
  if (monument?.eventType !== "region_monument_built") throw new Error("expected_region_monument_built");
  if (phase?.eventType !== "season_resolved") throw new Error("expected_season_resolved");

  assert.equal(resolved.aggregateType, "season_campaign");
  assert.equal(winnerReward.payload.balanceAfter, 7);
  assert.equal(winnerDividend.payload.balanceAfter, 9);
  assert.equal(supporterDividend.payload.balanceAfter, 7);
  assert.equal(treasury.payload.balanceAfter, 13);
  assert.deepEqual(treasury.payload.sourceEventIds, [resolved.eventId, "membership_1", "membership_2"]);
  assert.equal(prestige.payload.standingAfter, 17);
  assert.equal(control.payload.previousControllingFactionId, "old_faction");
  assert.equal(monument.payload.winnerAgentId, "agent_winner");
  assert.deepEqual(phase.payload.relatedEventIds, events.slice(1, -1).map((event) => event.eventId));

  const projectedCampaign = {
    seasonId: "season_1",
    status: "resolved",
    marker: "settled",
  } as const;
  assert.equal(projectSeasonCampaignSettlement({
    events,
    projection: {
      seasonCampaigns: {
        season_1: projectedCampaign,
      },
    },
  }), projectedCampaign);
  assert.throws(() => projectSeasonCampaignSettlement({
    events: [],
    projection: {
      seasonCampaigns: {
        season_1: projectedCampaign,
      },
    },
  }), /season_campaign_resolved_event_missing/);
  assert.throws(() => projectSeasonCampaignSettlement({
    events,
    projection: {
      seasonCampaigns: {},
    },
  }), /season_campaign_projection_failed/);
});

test("season campaign rules plan region control decay and release payloads", () => {
  assert.equal(regionControlScoreAfter(7, 2), 5);
  assert.equal(regionControlScoreAfter(1, 2), 0);

  assert.deepEqual(regionControlDecayPayload({
    decayId: "decay_1",
    regionId: "region_gray_harbor",
    controllingFactionId: "gray_watch",
    previousScore: 3,
    scoreAfter: 1,
    previousControlMargin: 2,
    sourceSeasonId: "season_1",
    decayedBy: "operator",
    decayedAt: "2026-07-07T03:00:00.000Z",
  }), {
    decayId: "decay_1",
    regionId: "region_gray_harbor",
    controllingFactionId: "gray_watch",
    previousScore: 3,
    scoreAfter: 1,
    decayAmount: 2,
    previousControlMargin: 2,
    controlMarginAfter: 0,
    sourceSeasonId: "season_1",
    decayedBy: "operator",
    decayedAt: "2026-07-07T03:00:00.000Z",
    reason: "maintenance_decay",
  });

  assert.deepEqual(regionControlReleasePayload({
    releaseId: "release_1",
    regionId: "region_gray_harbor",
    previousControllingFactionId: "gray_watch",
    previousScore: 3,
    sourceSeasonId: "season_1",
    releasedBy: "operator",
    releasedAt: "2026-07-07T03:00:00.000Z",
  }), {
    releaseId: "release_1",
    regionId: "region_gray_harbor",
    previousControllingFactionId: "gray_watch",
    previousScore: 3,
    sourceSeasonId: "season_1",
    releasedBy: "operator",
    releasedAt: "2026-07-07T03:00:00.000Z",
    reason: "maintenance_decay_zero",
  });

  const releaseEvent = (eventId: string, regionId: string, releasedAt: string): EpochEvent => ({
    eventId,
    eventType: "region_control_released",
    aggregateType: "region",
    aggregateId: regionId,
    actorExplorerId: "operator",
    trustClass: "system_worker",
    createdAt: releasedAt,
    payload: regionControlReleasePayload({
      releaseId: eventId,
      regionId,
      previousControllingFactionId: "gray_watch",
      previousScore: 1,
      sourceSeasonId: "season_1",
      releasedBy: "operator",
      releasedAt,
    }),
  } as unknown as EpochEvent);

  assert.equal(latestRegionControlReleaseEvent({
    events: [
      releaseEvent("release_old", "region_gray_harbor", "2026-07-07T02:00:00.000Z"),
      releaseEvent("release_other", "region_rot_forest", "2026-07-07T04:00:00.000Z"),
      releaseEvent("release_new", "region_gray_harbor", "2026-07-07T03:00:00.000Z"),
    ],
  }, "region_gray_harbor")?.eventId, "release_new");
  assert.equal(latestRegionControlReleaseEvent({ events: [] }, "region_gray_harbor"), undefined);
});

test("season campaign rules plan region control decay event sequences", () => {
  const decayedAt = "2026-07-07T03:00:00.000Z";
  const idFactory = createSequentialEpochIdFactory("region_control_decay");
  const makeEvent = eventFactory(() => new Date(decayedAt), idFactory, {
    actorExplorerId: "operator",
    trustClass: "system_worker" as const,
    causationId: "region_control_decay",
    correlationId: "corr_region_control_decay",
  });
  const events = planRegionControlDecayEvents({
    targets: [
      {
        regionId: "region_gray_harbor",
        controllingFactionId: "gray_watch",
        controlScore: 3,
        controlMargin: 2,
        sourceSeasonId: "season_1",
        updatedAt: "2026-07-01T03:00:00.000Z",
      },
      {
        regionId: "region_salt_gate",
        controllingFactionId: "salt_court",
        controlScore: 1,
        controlMargin: 1,
        sourceSeasonId: "season_1",
        updatedAt: "2026-07-01T03:00:00.000Z",
      },
    ],
    amount: 1,
    decayedBy: "operator",
    decayedAt,
    idFactory,
    makeEvent,
  });
  assert.deepEqual(events.map((event) => event.eventType), [
    "region_control_decayed",
    "region_control_decayed",
    "region_control_released",
  ]);
  assert.deepEqual(projectRegionControlDecays({ events }).map((payload) => payload.regionId), [
    "region_gray_harbor",
    "region_salt_gate",
  ]);
  const released = events.find((event) => event.eventType === "region_control_released");
  if (!released || released.eventType !== "region_control_released") {
    throw new Error("expected_region_control_released");
  }
  assert.equal(released.payload.previousControllingFactionId, "salt_court");
});

test("season campaign rules select region control decay targets", () => {
  const control = (regionId: string, controlScore: number, updatedAt: string) => ({
    regionId,
    controlScore,
    updatedAt,
  });

  assert.equal(regionControlDecayLimit(undefined), 25);
  assert.equal(regionControlDecayLimit(-5), 0);
  assert.equal(regionControlDecayLimit(200), 100);
  assert.equal(regionControlDecayAmount(undefined), 1);
  assert.equal(regionControlDecayAmount(0), 1);
  assert.equal(regionControlDecayAmount(200), 100);
  assert.equal(regionControlDecayMinAgeSeconds(undefined), 7 * 24 * 60 * 60);
  assert.equal(regionControlDecayMinAgeSeconds(-1), 0);
  assert.equal(regionControlDecayMinAgeSeconds(400 * 24 * 60 * 60), 365 * 24 * 60 * 60);
  assert.equal(regionControlDecayMinScore(undefined), 1);
  assert.equal(regionControlDecayMinScore(0), 1);
  assert.deepEqual(
    selectRegionControlDecayTargets({
      too_recent: control("region_too_recent", 9, "2026-07-07T11:30:00.000Z"),
      too_low: control("region_too_low", 1, "2026-07-07T08:00:00.000Z"),
      same_b: control("region_same_b", 3, "2026-07-07T08:00:00.000Z"),
      same_a: control("region_same_a", 4, "2026-07-07T08:00:00.000Z"),
      oldest: control("region_oldest", 2, "2026-07-07T07:00:00.000Z"),
    }, {
      decayedAt: "2026-07-07T12:00:00.000Z",
      limit: 3,
      minAgeSeconds: 60 * 60,
      minScore: 2,
    }).map((item) => item.regionId),
    ["region_oldest", "region_same_a", "region_same_b"],
  );
});

test("season campaign rules plan released region claim payloads", () => {
  assert.deepEqual(releasedRegionClaimControlPayload({
    regionId: "region_gray_harbor",
    controllingFactionId: "cinder_archive",
    controlScore: 9,
    contestedByFaction: { factionId: "gray_watch", score: 4 },
    sourceSeasonId: "season_2",
    sourceReleaseId: "release_1",
    previousControllingFactionId: "gray_watch",
    previousControlSourceSeasonId: "season_1",
    claimingAgentId: "agent_claimant",
    claimingExplorerId: "explorer_claimant",
    changedAt: "2026-07-07T03:10:00.000Z",
  }), {
    regionId: "region_gray_harbor",
    controllingFactionId: "cinder_archive",
    previousControllingFactionId: "gray_watch",
    controlScore: 9,
    contestedByFactionId: "gray_watch",
    controlMargin: 5,
    sourceSeasonId: "season_2",
    sourceReleaseId: "release_1",
    previousControlSourceSeasonId: "season_1",
    claimingAgentId: "agent_claimant",
    claimingExplorerId: "explorer_claimant",
    reason: "released_region_claim",
    changedAt: "2026-07-07T03:10:00.000Z",
  });
});

test("season campaign rules plan released region claim event sequence", () => {
  const changedAt = "2026-07-07T03:10:00.000Z";
  const idFactory = createSequentialEpochIdFactory("region_control_claim");
  const makeEvent = eventFactory(() => new Date(changedAt), idFactory, {
    actorExplorerId: "explorer_claimant",
    trustClass: "system_worker" as const,
    causationId: "region_control_claim",
    correlationId: "corr_region_control_claim",
  });
  const events = planReleasedRegionControlClaimEvents({
    makeEvent,
    regionId: "region_gray_harbor",
    controllingFactionId: "cinder_archive",
    controlScore: 9,
    contestedByFaction: { factionId: "gray_watch", score: 4 },
    sourceSeasonId: "season_2",
    sourceReleaseId: "release_1",
    previousControllingFactionId: "gray_watch",
    previousControlSourceSeasonId: "season_1",
    claimingAgentId: "agent_claimant",
    claimingExplorerId: "explorer_claimant",
    changedAt,
  });
  assert.deepEqual(events.map((event) => event.eventType), ["region_control_changed"]);
  const projected = {
    regionId: "region_gray_harbor",
    controllingFactionId: "cinder_archive",
    marker: "projected",
  } as const;
  assert.equal(projectReleasedRegionControlClaim({
    events,
    projection: { regionControls: { region_gray_harbor: projected } },
  }), projected);
  assert.throws(() => projectReleasedRegionControlClaim({
    events: [],
    projection: { regionControls: { region_gray_harbor: projected } },
  }), /region_control_changed_event_missing/);
  assert.throws(() => projectReleasedRegionControlClaim({
    events,
    projection: { regionControls: {} },
  }), /region_control_projection_failed/);
});

test("season campaign rules plan region revolt settlement and payloads", () => {
  assert.equal(REGION_REVOLT_DEFENDER_BASE_POWER, 2);
  const settlement = regionRevoltSettlement({
    staminaSpent: 3,
    agentStandingScore: 2,
    previousControlScore: 5,
  });
  assert.deepEqual(settlement, {
    rebelPower: 8,
    defenderPower: 7,
    outcome: "revolt_succeeded",
  });
  assert.equal(regionRevoltInfluenceDelta("revolt_succeeded"), 10);
  assert.equal(regionRevoltInfluenceDelta("revolt_defended"), 2);

  assert.deepEqual(regionRevoltStaminaSpendPayload({
    agentId: "agent_rebel",
    revoltId: "revolt_1",
    staminaSpent: 3,
    staminaBalanceBefore: 8,
  }), {
    resourceId: "stamina",
    amount: 3,
    reason: "region_revolt:revolt_1",
    balanceAfter: 5,
    accountRef: "agent:agent_rebel",
    assetKey: "resource:stamina",
    unit: "unit",
    quantityMinor: "300",
  });

  assert.deepEqual(regionRevoltResolvedPayload({
    revoltId: "revolt_1",
    regionId: "region_gray_harbor",
    sourceReleaseId: "release_1",
    previousControllingFactionId: "gray_watch",
    previousControlSourceSeasonId: "season_1",
    rebelAgentId: "agent_rebel",
    rebelExplorerId: "explorer_rebel",
    rebelFactionId: "cinder_archive",
    sourceSeasonId: "season_2",
    factionScore: 2,
    staminaSpent: 3,
    settlement,
    resolvedAt: "2026-07-07T03:20:00.000Z",
  }), {
    revoltId: "revolt_1",
    regionId: "region_gray_harbor",
    sourceReleaseId: "release_1",
    previousControllingFactionId: "gray_watch",
    previousControlSourceSeasonId: "season_1",
    rebelAgentId: "agent_rebel",
    rebelExplorerId: "explorer_rebel",
    rebelFactionId: "cinder_archive",
    sourceSeasonId: "season_2",
    factionScore: 2,
    staminaSpent: 3,
    rebelPower: 8,
    defenderPower: 7,
    outcome: "revolt_succeeded",
    resolvedAt: "2026-07-07T03:20:00.000Z",
  });

  assert.deepEqual(regionRevoltControlPayload({
    regionId: "region_gray_harbor",
    controllingFactionId: "cinder_archive",
    factionScore: 2,
    staminaSpent: 3,
    contestedByFactionId: "gray_watch",
    settlement,
    sourceSeasonId: "season_2",
    sourceReleaseId: "release_1",
    previousControllingFactionId: "gray_watch",
    previousControlSourceSeasonId: "season_1",
    claimingAgentId: "agent_rebel",
    claimingExplorerId: "explorer_rebel",
    changedAt: "2026-07-07T03:20:00.000Z",
  }), {
    regionId: "region_gray_harbor",
    controllingFactionId: "cinder_archive",
    previousControllingFactionId: "gray_watch",
    controlScore: 5,
    contestedByFactionId: "gray_watch",
    controlMargin: 1,
    sourceSeasonId: "season_2",
    sourceReleaseId: "release_1",
    previousControlSourceSeasonId: "season_1",
    claimingAgentId: "agent_rebel",
    claimingExplorerId: "explorer_rebel",
    reason: "released_region_revolt",
    changedAt: "2026-07-07T03:20:00.000Z",
  });

  assert.deepEqual(regionRevoltInfluencePayload({
    influenceId: "influence_1",
    regionId: "region_gray_harbor",
    revoltId: "revolt_1",
    rebelAgentId: "agent_rebel",
    rebelExplorerId: "explorer_rebel",
    previousInfluenceScore: 4,
    sourceEventId: "event_revolt_resolved",
    settlement,
    changedAt: "2026-07-07T03:20:00.000Z",
  }), {
    influenceId: "influence_1",
    regionId: "region_gray_harbor",
    agentId: "agent_rebel",
    explorerId: "explorer_rebel",
    influenceDelta: 10,
    influenceScoreAfter: 14,
    reason: "region_revolt:revolt_1",
    sourceEventId: "event_revolt_resolved",
    sourceEventType: "region_revolt_resolved",
    sourceAggregateId: "revolt_1",
    changedAt: "2026-07-07T03:20:00.000Z",
  });

  assert.deepEqual(regionRevoltTracePayload({
    traceId: "trace_1",
    regionId: "region_gray_harbor",
    revoltId: "revolt_1",
    rebelAgentId: "agent_rebel",
    rebelExplorerId: "explorer_rebel",
    rebelFactionId: "cinder_archive",
    settlement,
    sourceEventIds: ["event_revolt_resolved", "event_influence_changed"],
    relatedInfluenceIds: ["influence_1"],
    parentTraceId: "trace_parent",
    createdAt: "2026-07-07T03:20:00.000Z",
  }), {
    traceId: "trace_1",
    regionId: "region_gray_harbor",
    title: "区域起义 revolt_1",
    summary: "agent_rebel 代表 cinder_archive 发起区域起义，结果 revolt_succeeded。",
    sourceEventType: "region_revolt_resolved",
    sourceEventIds: ["event_revolt_resolved", "event_influence_changed"],
    sourceAggregateId: "revolt_1",
    relatedInfluenceIds: ["influence_1"],
    participantAgentIds: ["agent_rebel"],
    participantExplorerIds: ["explorer_rebel"],
    parentTraceId: "trace_parent",
    createdAt: "2026-07-07T03:20:00.000Z",
  });
});

test("season campaign rules plan region revolt resolution event sequences", () => {
  const resolvedAt = "2026-07-07T03:20:00.000Z";
  const idFactory = createSequentialEpochIdFactory("region_revolt_resolution");
  const makeEvent = eventFactory(() => new Date(resolvedAt), idFactory, {
    actorExplorerId: "explorer_rebel",
    trustClass: "user_verified_web" as const,
    causationId: "region_revolt_resolution",
    correlationId: "corr_region_revolt_resolution",
  });
  const succeededSettlement = {
    rebelPower: 8,
    defenderPower: 7,
    outcome: "revolt_succeeded",
  } as const;
  const succeededEvents = planRegionRevoltResolutionEvents({
    makeEvent,
    revoltId: "revolt_1",
    regionId: "region_gray_harbor",
    sourceReleaseId: "release_1",
    previousControllingFactionId: "gray_watch",
    previousControlSourceSeasonId: "season_1",
    rebelAgentId: "agent_rebel",
    rebelExplorerId: "explorer_rebel",
    rebelFactionId: "cinder_archive",
    sourceSeasonId: "season_2",
    factionScore: 2,
    staminaSpent: 3,
    settlement: succeededSettlement,
    resolvedAt,
    staminaBalanceBefore: 8,
    influenceId: "influence_1",
    previousInfluenceScore: 4,
    traceId: "trace_1",
    parentTraceId: "trace_parent",
    contestedByFactionId: "gray_watch",
  });
  assert.deepEqual(succeededEvents.map((event) => event.eventType), [
    "resource_spent",
    "region_revolt_resolved",
    "region_influence_changed",
    "trace_created",
    "region_control_changed",
  ]);
  const revoltResolved = succeededEvents.find((event) => event.eventType === "region_revolt_resolved");
  const influenceChanged = succeededEvents.find((event) => event.eventType === "region_influence_changed");
  const traceCreated = succeededEvents.find((event) => event.eventType === "trace_created");
  const controlChanged = succeededEvents.find((event) => event.eventType === "region_control_changed");
  if (!revoltResolved || revoltResolved.eventType !== "region_revolt_resolved") {
    throw new Error("expected_region_revolt_resolved");
  }
  if (!influenceChanged || influenceChanged.eventType !== "region_influence_changed") {
    throw new Error("expected_region_revolt_influence");
  }
  if (!traceCreated || traceCreated.eventType !== "trace_created") {
    throw new Error("expected_region_revolt_trace");
  }
  if (!controlChanged || controlChanged.eventType !== "region_control_changed") {
    throw new Error("expected_region_control_changed");
  }
  assert.equal(succeededEvents[0]?.aggregateId, "agent_rebel");
  assert.equal(revoltResolved.aggregateId, "revolt_1");
  assert.equal(controlChanged.payload.controllingFactionId, "cinder_archive");
  assert.equal(controlChanged.payload.reason, "released_region_revolt");
  assert.deepEqual(traceCreated.payload.sourceEventIds, [
    revoltResolved.eventId,
    influenceChanged.eventId,
  ]);
  assert.deepEqual(projectRegionRevoltResolution({ events: succeededEvents }), revoltResolved.payload);
  assert.throws(() => projectRegionRevoltResolution({ events: [] }), /region_revolt_resolved_event_missing/);

  const defendedEvents = planRegionRevoltResolutionEvents({
    makeEvent,
    revoltId: "revolt_defended",
    regionId: "region_gray_harbor",
    sourceReleaseId: "release_1",
    previousControllingFactionId: "gray_watch",
    previousControlSourceSeasonId: "season_1",
    rebelAgentId: "agent_rebel",
    rebelExplorerId: "explorer_rebel",
    rebelFactionId: "cinder_archive",
    sourceSeasonId: "season_2",
    factionScore: 2,
    staminaSpent: 1,
    settlement: {
      rebelPower: 4,
      defenderPower: 7,
      outcome: "revolt_defended",
    },
    resolvedAt,
    staminaBalanceBefore: 8,
    influenceId: "influence_defended",
    previousInfluenceScore: 4,
    traceId: "trace_defended",
  });
  assert.deepEqual(defendedEvents.map((event) => event.eventType), [
    "resource_spent",
    "region_revolt_resolved",
    "region_influence_changed",
    "trace_created",
  ]);
});
