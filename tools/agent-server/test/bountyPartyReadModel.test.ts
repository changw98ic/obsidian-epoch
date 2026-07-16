import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";
import type { EpochProjection } from "../lib/epoch/gameCore.ts";

const modulePath = new URL("../lib/epoch/bountyPartyReadModel.ts", import.meta.url);

function projectionFixture(): EpochProjection {
  return {
    bounties: {
      bounty_open_old: {
        bountyId: "bounty_open_old",
        regionId: "region_gray_harbor",
        sponsorAgentId: "agent_a",
        sponsorExplorerId: "explorer_a",
        title: "旧悬赏",
        description: "较早创建的开放悬赏。",
        rewardResourceId: "coin",
        rewardAmount: 2,
        status: "open",
        createdAt: "2026-07-07T01:00:00.000Z",
      },
      bounty_open_new: {
        bountyId: "bounty_open_new",
        regionId: "region_gray_harbor",
        sponsorAgentId: "agent_b",
        sponsorExplorerId: "explorer_b",
        title: "新悬赏",
        description: "较晚创建的开放悬赏。",
        rewardResourceId: "coin",
        rewardAmount: 4,
        status: "open",
        createdAt: "2026-07-07T03:00:00.000Z",
        claimantAgentId: "agent_a",
        claimantExplorerId: "explorer_a",
      },
      bounty_claimed: {
        bountyId: "bounty_claimed",
        regionId: "region_gray_harbor",
        sponsorAgentId: "agent_a",
        sponsorExplorerId: "explorer_a",
        title: "已领取悬赏",
        description: "已领取排在开放悬赏之后。",
        rewardResourceId: "legend",
        rewardAmount: 1,
        status: "claimed",
        createdAt: "2026-07-07T04:00:00.000Z",
        claimantAgentId: "agent_c",
        claimantExplorerId: "explorer_c",
        claimedAt: "2026-07-07T05:00:00.000Z",
      },
      bounty_other_agent: {
        bountyId: "bounty_other_agent",
        regionId: "region_gray_harbor",
        sponsorAgentId: "agent_b",
        sponsorExplorerId: "explorer_b",
        title: "他人悬赏",
        description: "agent 过滤时应排除。",
        rewardResourceId: "coin",
        rewardAmount: 6,
        status: "open",
        createdAt: "2026-07-07T02:00:00.000Z",
      },
    },
    bountyIdsByRegion: {
      region_gray_harbor: ["bounty_open_old", "bounty_open_new", "bounty_claimed", "bounty_other_agent"],
    },
    bountyIdsByAgent: {
      agent_a: ["bounty_open_old", "bounty_open_new", "bounty_claimed"],
    },
    partyRuns: {
      party_open_old: {
        partyRunId: "party_open_old",
        regionId: "region_gray_harbor",
        leaderAgentId: "agent_a",
        leaderExplorerId: "explorer_a",
        title: "旧小队",
        objective: "较早更新的小队。",
        joinPolicy: "invite_only",
        inviteTokenHash: "secret_hash_old",
        inviteTokenExpiresAt: "2026-07-08T00:00:00.000Z",
        status: "open",
        members: [{ agentId: "agent_a", explorerId: "explorer_a", participantRole: "vanguard", joinedAt: "2026-07-07T01:00:00.000Z" }],
        createdAt: "2026-07-07T01:00:00.000Z",
        updatedAt: "2026-07-07T02:00:00.000Z",
      },
      party_open_new: {
        partyRunId: "party_open_new",
        regionId: "region_gray_harbor",
        leaderAgentId: "agent_b",
        leaderExplorerId: "explorer_b",
        title: "新小队",
        objective: "较晚更新的小队。",
        joinPolicy: "open",
        inviteTokenHash: "secret_hash_new",
        status: "open",
        members: [{ agentId: "agent_b", explorerId: "explorer_b", participantRole: "scribe", joinedAt: "2026-07-07T01:30:00.000Z" }],
        createdAt: "2026-07-07T01:30:00.000Z",
        updatedAt: "2026-07-07T03:00:00.000Z",
      },
      party_settled: {
        partyRunId: "party_settled",
        regionId: "region_gray_harbor",
        leaderAgentId: "agent_a",
        leaderExplorerId: "explorer_a",
        title: "已结算小队",
        objective: "已结算排在开放小队后。",
        joinPolicy: "open",
        inviteTokenHash: "secret_hash_settled",
        status: "settled",
        members: [{ agentId: "agent_a", explorerId: "explorer_a", participantRole: "scout", joinedAt: "2026-07-07T00:30:00.000Z" }],
        totalScore: 7,
        createdAt: "2026-07-07T00:30:00.000Z",
        updatedAt: "2026-07-07T04:00:00.000Z",
        settledAt: "2026-07-07T05:00:00.000Z",
      },
    },
    partyRunIdsByRegion: {
      region_gray_harbor: ["party_open_old", "party_open_new", "party_settled"],
    },
  } as unknown as EpochProjection;
}

test("bounty party read model filters and sorts bounty views", async () => {
  assert.ok(existsSync(modulePath), "bountyPartyReadModel.ts should own bounty and party projections");
  const readModel = await import("../lib/epoch/bountyPartyReadModel.ts");
  const projection = projectionFixture();

  assert.deepEqual(
    readModel.bountiesView(projection, { agentId: "agent_a" }).map((bounty) => bounty.bountyId),
    ["bounty_open_new", "bounty_open_old", "bounty_claimed"],
  );
  assert.deepEqual(
    readModel.bountiesView(projection, { regionId: "region_gray_harbor", status: "open" }).map((bounty) => bounty.bountyId),
    ["bounty_open_new", "bounty_other_agent", "bounty_open_old"],
  );
});

test("bounty party read model filters and sanitizes party run views", async () => {
  assert.ok(existsSync(modulePath), "bountyPartyReadModel.ts should own public party run projection");
  const readModel = await import("../lib/epoch/bountyPartyReadModel.ts");
  const projection = projectionFixture();

  const agentPartyRuns = readModel.partyRunsView(projection, { agentId: "agent_a" });
  assert.deepEqual(agentPartyRuns.map((partyRun) => partyRun.partyRunId), ["party_open_old", "party_settled"]);
  assert.equal("inviteTokenHash" in agentPartyRuns[0], false);
  assert.equal("inviteTokenHash" in readModel.publicPartyRun(projection.partyRuns.party_open_new), false);

  assert.deepEqual(
    readModel.partyRunsView(projection, { regionId: "region_gray_harbor", status: "open" }).map((partyRun) => partyRun.partyRunId),
    ["party_open_new", "party_open_old"],
  );
});
