import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";
import { epochActivityMediaForKey } from "../lib/activityAssets.ts";
import type { EpochProjection } from "../lib/epoch/gameCore.ts";

const modulePath = new URL("../lib/epoch/regionCommissionReadModel.ts", import.meta.url);

test("region commission read model classifies secret exposure and motif copy", async () => {
  assert.ok(existsSync(modulePath), "regionCommissionReadModel.ts should own commission exposure and motif rules");
  const rules = await import("../lib/epoch/regionCommissionReadModel.ts");

  assert.equal(rules.commissionSecretExposureTier({ sourceType: "objective" }), "T0_public");
  assert.equal(rules.commissionSecretExposureTier({ sourceType: "bounty" }), "T0_public");
  assert.equal(rules.commissionSecretExposureTier({ sourceType: "party_run" }), "T0_public");
  assert.equal(rules.commissionSecretExposureTier({ sourceType: "resource_node", risk: "medium" }), "T1_low_rumor");
  assert.equal(rules.commissionSecretExposureTier({ sourceType: "social_hook", risk: "low" }), "T1_low_rumor");
  assert.equal(rules.commissionSecretExposureTier({ sourceType: "social_hook", risk: "medium" }), "T0_public");
  assert.equal(rules.commissionSecretExposureTier({ sourceType: "anomaly", risk: "cataclysm" }), "T3_core_secret");
  assert.equal(rules.commissionSecretExposureTier({ sourceType: "anomaly", risk: "major" }), "T2_local_secret");
  assert.equal(rules.commissionSecretExposureTier({ sourceType: "anomaly", risk: "minor" }), "T1_low_rumor");

  assert.equal(rules.secretExposureTierCost("T0_public"), 0);
  assert.equal(rules.secretExposureTierCost("T3_core_secret"), 3);

  assert.deepEqual(rules.locationMotifQuota({
    regionId: "region_gray_harbor",
    motif: "faction",
    count: 3,
  }), {
    regionId: "region_gray_harbor",
    motif: "faction",
    label: "阵营",
    count: 3,
    quota: 2,
    status: "dense",
    displayMode: "aggregate",
    summary: "阵营母题 3/2，前台应聚合。",
  });

  assert.deepEqual(rules.locationMotifBiasForMotif("faction"), {
    motif: "faction",
    label: "阵营",
    taskBias: "阵营协商、组织博弈和声望争夺任务优先生成。",
    rewardResourceId: "legend",
    rewardBias: "奖励偏向阵营声望与传说收益。",
    summary: "阵营母题主导：阵营协商、组织博弈和声望争夺任务优先生成。奖励偏向阵营声望与传说收益。",
  });
});

test("region commission read model budgets secret reveal and prefile isolation", async () => {
  assert.ok(existsSync(modulePath), "regionCommissionReadModel.ts should own commission budget rules");
  const rules = await import("../lib/epoch/regionCommissionReadModel.ts");
  const media = epochActivityMediaForKey("anomaly");
  assert.ok(media);
  const reward = { resourceId: "legend" as const, amount: 1, reason: "reward" };
  const locationMotifBias = rules.locationMotifBiasForMotif("anomaly");
  const projection = {
    events: [],
    identities: {
      agent_a: { explorerId: "explorer_a" },
    },
  };

  const commissions = rules.addSecretRevealBudgets(projection, [{
    commissionId: "anomaly:one",
    regionId: "region_gray_harbor",
    sourceType: "anomaly",
    sourceId: "one",
    secretExposureTier: "T2_local_secret",
    locationMotifBias,
    media,
    title: "裂隙一",
    summary: "第一条线索。",
    status: "open",
    actionLabel: "压制异常",
    reward,
    risk: "major",
    leaderAgentId: "agent_a",
    canonical: true,
    createdAt: "2026-07-07T03:00:00.000Z",
  }, {
    commissionId: "anomaly:two",
    regionId: "region_gray_harbor",
    sourceType: "anomaly",
    sourceId: "two",
    secretExposureTier: "T2_local_secret",
    locationMotifBias,
    media,
    title: "裂隙二",
    summary: "第二条线索。",
    status: "open",
    actionLabel: "压制异常",
    reward,
    risk: "major",
    leaderAgentId: "agent_a",
    canonical: true,
    createdAt: "2026-07-07T03:10:00.000Z",
  }]);

  assert.equal(commissions[0].secretRevealBudget.spent, 2);
  assert.equal(commissions[0].secretRevealBudget.remaining, 0);
  assert.equal(commissions[0].secretRevealBudget.chapterLocked, false);
  assert.equal(commissions[0].prefileIsolation.layer, "prefile");
  assert.equal(commissions[0].prefileIsolation.reason, "low_exposure");
  assert.equal(commissions[0].reward, undefined);

  assert.equal(commissions[1].secretRevealBudget.spent, 4);
  assert.equal(commissions[1].secretRevealBudget.chapterLocked, true);
  assert.match(commissions[1].secretRevealBudget.lockReason || "", /章节锁/);
  assert.equal(commissions[1].actionLabel, "预档未来钩子");
  assert.equal(commissions[1].prefileIsolation.reason, "chapter_locked");
  assert.equal(commissions[1].prefileIsolation.futureHookOnly, true);
});

test("region commission read model projects commissions and motif quotas from projection", async () => {
  assert.ok(existsSync(modulePath), "regionCommissionReadModel.ts should own commission projection assembly");
  const rules = await import("../lib/epoch/regionCommissionReadModel.ts");
  const projection = {
    events: [],
    identities: {
      agent_a: {
        agentId: "agent_a",
        explorerId: "explorer_a",
        displayName: "探索者甲",
        status: "active",
        generation: 1,
        lifetimeRemaining: 9,
        issuedAt: "2026-07-07T00:00:00.000Z",
      },
    },
    resourceBalances: { agent_a: { focus: 1 } },
    downtime: {},
    regionActivities: {},
    regionActivityIdsByRegion: { region_gray_harbor: [] },
    regionInfluenceChanges: {},
    regionInfluenceIdsByRegion: { region_gray_harbor: [] },
    worldMessages: [],
    regionMessages: { region_gray_harbor: [] },
    contestedObjectives: {
      objective_one: {
        objectiveId: "objective_one",
        regionId: "region_gray_harbor",
        title: "封存潮汐档案",
        description: "整理公开线索。",
        resourceId: "focus",
        targetScore: 5,
        reward: { resourceId: "legend", amount: 1, reason: "objective_reward" },
        createdAt: "2026-07-07T01:00:00.000Z",
        status: "active",
        totalScore: 2,
        leaderboard: [{ agentId: "agent_a", explorerId: "explorer_a", amount: 2, score: 2 }],
      },
    },
    objectiveIdsByRegion: { region_gray_harbor: ["objective_one"] },
    resourceNodes: {
      node_one: {
        nodeId: "node_one",
        regionId: "region_gray_harbor",
        title: "回收蓝盐补给",
        description: "码头补给点开放。",
        resourceId: "coin",
        reward: { resourceId: "coin", amount: 2, reason: "resource_node_reward" },
        spawnedAt: "2026-07-07T02:00:00.000Z",
        status: "open",
        totalScore: 4,
        leaderboard: [{ agentId: "agent_a", explorerId: "explorer_a", staminaSpent: 1, score: 4 }],
      },
    },
    resourceNodeIdsByRegion: { region_gray_harbor: ["node_one"] },
    anomalyEvents: {
      anomaly_one: {
        anomalyId: "anomaly_one",
        regionId: "region_gray_harbor",
        title: "黑曜裂隙兽",
        description: "裂隙在港口下方扩大。",
        severity: "major",
        targetScore: 8,
        reward: { resourceId: "aether", amount: 2, reason: "anomaly_reward" },
        lifetimeRisk: 1,
        spawnedAt: "2026-07-07T03:00:00.000Z",
        status: "open",
        totalScore: 7,
        leaderboard: [{ agentId: "agent_a", explorerId: "explorer_a", focusSpent: 2, score: 7 }],
      },
    },
    anomalyEventIdsByRegion: { region_gray_harbor: ["anomaly_one"] },
    bounties: {
      bounty_one: {
        bountyId: "bounty_one",
        regionId: "region_gray_harbor",
        sponsorAgentId: "agent_a",
        sponsorExplorerId: "explorer_a",
        title: "找回沉箱钥匙",
        description: "钥匙遗失在下层栈桥。",
        rewardResourceId: "coin",
        rewardAmount: 3,
        status: "open",
        createdAt: "2026-07-07T01:30:00.000Z",
      },
    },
    bountyIdsByRegion: { region_gray_harbor: ["bounty_one"] },
    partyRuns: {
      party_one: {
        partyRunId: "party_one",
        regionId: "region_gray_harbor",
        leaderAgentId: "agent_a",
        leaderExplorerId: "explorer_a",
        title: "夜潮小队",
        objective: "结伴巡查灯塔。",
        joinPolicy: "open",
        status: "open",
        members: [{ agentId: "agent_a", explorerId: "explorer_a", participantRole: "vanguard", joinedAt: "2026-07-07T01:10:00.000Z" }],
        createdAt: "2026-07-07T01:10:00.000Z",
        updatedAt: "2026-07-07T01:10:00.000Z",
      },
    },
    partyRunIdsByRegion: { region_gray_harbor: ["party_one"] },
    socialHooks: {
      hook_one: {
        hookId: "hook_one",
        regionId: "region_gray_harbor",
        npcId: "npc_one",
        title: "书记员求助",
        body: "书记员需要有人整理家庭债务。",
        actionLabel: "处理家庭义务",
        risk: "low",
        createdAt: "2026-07-07T00:30:00.000Z",
      },
    },
    socialHookIdsByRegion: { region_gray_harbor: ["hook_one"] },
    socialHookIdsByNpc: { npc_one: ["hook_one"] },
    regionControls: { region_gray_harbor: { regionId: "region_gray_harbor", controllingFactionId: "faction_tide", controlScore: 2, updatedAt: "2026-07-07T00:00:00.000Z" } },
    regionMonuments: {
      monument_one: {
        monumentId: "monument_one",
        regionId: "region_gray_harbor",
        title: "潮汐纪念碑",
        description: "旧港纪念碑。",
        controllingFactionId: "faction_tide",
        winnerAgentId: "agent_a",
        winnerExplorerId: "explorer_a",
        sourceSeasonId: "season_one",
        controlScore: 2,
        builtAt: "2026-07-07T00:00:00.000Z",
      },
    },
    regionMonumentIdsByRegion: { region_gray_harbor: ["monument_one"] },
    npcs: {
      npc_one: { npcId: "npc_one", regionId: "region_gray_harbor", displayName: "港口书记员", archetype: "clerk", createdAt: "2026-07-07T00:00:00.000Z" },
    },
    npcCandidates: {
      candidate_one: { candidateId: "candidate_one", regionId: "region_gray_harbor", agentId: "agent_a", displayName: "候补书记员", reviewLevel: "rumor", submittedAt: "2026-07-07T00:00:00.000Z" },
    },
    npcCandidateIdsByRegion: { region_gray_harbor: ["candidate_one"] },
    npcCandidateIdsByAgent: { agent_a: ["candidate_one"] },
    organizations: {
      org_one: {
        organizationId: "org_one",
        organizationKey: "gray_harbor_union",
        regionId: "region_gray_harbor",
        displayName: "灰港工会",
        memberNpcIds: [],
        memberAgentIds: ["agent_a"],
        recordedAt: "2026-07-07T00:00:00.000Z",
      },
      org_two: {
        organizationId: "org_two",
        organizationKey: "tide_merchants",
        regionId: "region_gray_harbor",
        displayName: "潮汐商会",
        memberNpcIds: [],
        memberAgentIds: [],
        recordedAt: "2026-07-07T00:10:00.000Z",
      },
      org_three: {
        organizationId: "org_three",
        organizationKey: "lighthouse_archive",
        regionId: "region_gray_harbor",
        displayName: "灯塔档案局",
        memberNpcIds: ["npc_one"],
        memberAgentIds: [],
        recordedAt: "2026-07-07T00:20:00.000Z",
      },
    },
    organizationMemberships: {},
    organizationMembershipIdsByNpc: {},
    organizationMembershipIdsByAgent: {},
    organizationMembershipIdsByRegion: {},
    organizationMembershipIdsByOrganization: {},
    organizationPolitics: {},
    organizationPoliticsIdsByRegion: {},
    organizationPoliticsIdsByOrganization: {},
    organizationPoliticsIdsByNpc: {},
    organizationPoliticalStandingByOrganization: {},
    organizationTreasuryBalances: {},
    organizationUpgrades: {},
    organizationUpgradeIdsByOrganization: {},
    organizationBudgets: {},
    organizationBudgetIdsByOrganization: {},
    diplomacyRecords: {},
    diplomacyIdsByRegion: { region_gray_harbor: [] },
    diplomacyIdsByAgent: {},
    seasonCampaigns: {},
    seasonCampaignIdsByRegion: { region_gray_harbor: [] },
    raids: {},
    raidIdsByRegion: { region_gray_harbor: [] },
  } as unknown as EpochProjection;

  const commissions = rules.regionCommissionsView(projection, { regionId: "region_gray_harbor" });
  assert.deepEqual(commissions.map((commission) => commission.sourceType), [
    "anomaly",
    "resource_node",
    "bounty",
    "party_run",
    "objective",
    "social_hook",
  ]);
  assert.equal(commissions[0].commissionId, "anomaly:anomaly_one");
  assert.equal(commissions[0].secretExposureTier, "T2_local_secret");
  assert.equal(commissions[0].prefileIsolation.layer, "prefile");
  assert.match(commissions[0].summary, /地点母题偏向/);

  const quotas = rules.locationMotifQuotasView(projection, { regionId: "region_gray_harbor" });
  const factionQuota = quotas.find((quota) => quota.motif === "faction");
  assert.equal(factionQuota?.count, 4);
  assert.equal(factionQuota?.status, "dense");
  assert.equal(factionQuota?.displayMode, "aggregate");
  const characterQuota = quotas.find((quota) => quota.motif === "character");
  assert.equal(characterQuota?.count, 2);
});
