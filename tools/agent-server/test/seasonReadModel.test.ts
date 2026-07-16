import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";
import type {
  EpochProjection,
  EpochSeasonCampaign,
  EpochSeasonContribution,
} from "../lib/epoch/gameCore.ts";

const modulePath = new URL("../lib/epoch/seasonReadModel.ts", import.meta.url);

function contributionFixture(input: {
  eventId: string;
  agentId: string;
  factionId: string;
  amount: number;
  scoreDelta: number;
  recordedAt: string;
}): EpochSeasonContribution {
  return {
    eventId: input.eventId,
    seasonId: "season_active_high",
    agentId: input.agentId,
    explorerId: `${input.agentId}_explorer`,
    factionId: input.factionId,
    resourceId: "coin",
    amount: input.amount,
    baseScoreDelta: input.scoreDelta,
    organizationBonusScore: 0,
    regionControlBonusScore: 0,
    scoreDelta: input.scoreDelta,
    sourceOrganizationUpgradeIds: [],
    sourceRegionControlRegionIds: [],
    agentScoreAfter: input.scoreDelta,
    factionScoreAfter: input.scoreDelta,
    totalScoreAfter: input.scoreDelta,
    trustClass: "system_worker",
    recordedAt: input.recordedAt,
  };
}

function seasonFixture(input: {
  seasonId: string;
  regionIds: readonly string[];
  factionIds: readonly string[];
  status: "active" | "resolved";
  totalScore: number;
}): EpochSeasonCampaign {
  return {
    seasonId: input.seasonId,
    seasonKey: "gray_harbor_faction_season",
    title: input.seasonId,
    description: "赛季读模型测试。",
    regionIds: input.regionIds,
    factionIds: input.factionIds,
    resourceId: "coin",
    targetScore: 10,
    reward: { resourceId: "legend", amount: 1, reason: "season_reward" },
    createdAt: "2026-07-07T00:00:00.000Z",
    status: input.status,
    phaseEvents: [],
    objectives: [],
    contributions: [],
    totalScore: input.totalScore,
    factionStandings: input.factionIds.map((factionId, index) => ({
      factionId,
      score: input.totalScore - index,
      trustedScore: input.totalScore - index,
      dominantTrustClass: "system_worker",
      trustBreakdown: { system_worker: input.totalScore - index },
    })),
    agentStandings: [],
    ...(input.status === "resolved" ? { resolvedAt: "2026-07-08T00:00:00.000Z" } : {}),
  };
}

function projectionFixture(): EpochProjection {
  return {
    seasonCampaigns: {
      season_active_low: seasonFixture({
        seasonId: "season_active_low",
        regionIds: ["region_gray_harbor"],
        factionIds: ["gray_watch"],
        status: "active",
        totalScore: 4,
      }),
      season_active_high: seasonFixture({
        seasonId: "season_active_high",
        regionIds: ["region_gray_harbor"],
        factionIds: ["gray_watch", "white_tower_compact"],
        status: "active",
        totalScore: 9,
      }),
      season_resolved: seasonFixture({
        seasonId: "season_resolved",
        regionIds: ["region_gray_harbor"],
        factionIds: ["white_tower_compact"],
        status: "resolved",
        totalScore: 20,
      }),
      season_other_region: seasonFixture({
        seasonId: "season_other_region",
        regionIds: ["region_salt_gate"],
        factionIds: ["gray_watch"],
        status: "active",
        totalScore: 12,
      }),
    },
    seasonCampaignIdsByRegion: {
      region_gray_harbor: ["season_active_low", "season_resolved", "season_active_high"],
      region_salt_gate: ["season_other_region"],
    },
    seasonCampaignIdsByFaction: {
      gray_watch: ["season_active_low", "season_active_high", "season_other_region"],
      white_tower_compact: ["season_resolved", "season_active_high"],
    },
  } as unknown as EpochProjection;
}

test("season read model filters and sorts season campaign views", async () => {
  assert.ok(existsSync(modulePath), "seasonReadModel.ts should own season campaign projection");
  const readModel = await import("../lib/epoch/seasonReadModel.ts");
  const projection = projectionFixture();

  assert.deepEqual(
    readModel.seasonsView(projection, { regionId: "region_gray_harbor" }).map((season) => season.seasonId),
    ["season_active_high", "season_active_low", "season_resolved"],
  );
  assert.deepEqual(
    readModel.seasonsView(projection, { factionId: "gray_watch", status: "active" }).map((season) => season.seasonId),
    ["season_other_region", "season_active_high", "season_active_low"],
  );
});

test("season read model attaches campaign and faction media", async () => {
  assert.ok(existsSync(modulePath), "seasonReadModel.ts should decorate season media");
  const readModel = await import("../lib/epoch/seasonReadModel.ts");
  const projection = projectionFixture();
  const view = readModel.seasonCampaignView(projection.seasonCampaigns.season_active_high);

  assert.equal(view.media.factions[0].factionId, "gray_watch");
  assert.equal(view.factionStandings[0].media?.factionId, "gray_watch");
});

test("season read model projects contribution audit ratios and date groups", async () => {
  assert.ok(existsSync(modulePath), "seasonReadModel.ts should own contribution audit projections");
  const readModel = await import("../lib/epoch/seasonReadModel.ts");
  const contributions = [
    contributionFixture({
      eventId: "event_a",
      agentId: "agent_a",
      factionId: "gray_watch",
      amount: 2,
      scoreDelta: 4,
      recordedAt: "2026-07-07T01:00:00.000Z",
    }),
    contributionFixture({
      eventId: "event_b",
      agentId: "agent_b",
      factionId: "gray_watch",
      amount: 3,
      scoreDelta: 8,
      recordedAt: "2026-07-07T03:00:00.000Z",
    }),
    contributionFixture({
      eventId: "event_c",
      agentId: "agent_c",
      factionId: "white_tower_compact",
      amount: 5,
      scoreDelta: 2,
      recordedAt: "2026-07-08T01:00:00.000Z",
    }),
  ];
  const audits = contributions.map((contribution) => readModel.seasonContributionAuditView(contribution, 8));

  assert.equal(audits[0].scoreDeltaRatio, 0.5);
  assert.equal(audits[0].publicPages.audit, "/epoch/audit/event_a");
  assert.deepEqual(
    readModel.seasonContributionAuditGroups(audits).map((group) => [group.recordedDate, group.contributionCount, group.scoreDeltaTotal]),
    [["2026-07-07", 2, 12], ["2026-07-08", 1, 2]],
  );
  assert.deepEqual(
    readModel.seasonContributionDailyTotals(contributions).map((total) => [
      total.recordedDate,
      total.contributionCount,
      total.resourceAmountTotal,
      total.scoreDeltaRatio,
    ]),
    [["2026-07-07", 2, 5, 1], ["2026-07-08", 1, 5, 2 / 12]],
  );
});
