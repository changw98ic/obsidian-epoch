import assert from "node:assert/strict";
import test from "node:test";

import type { EpochEvent } from "../lib/epoch/events.ts";
import {
  createEpochGameCore,
  type EpochAgentIdentity,
  type EpochProjection,
  type EpochSeasonCampaign,
} from "../lib/epoch/gameCore.ts";
import {
  EPOCH_PLAYER_DATA_EXPORT_SCHEMA_VERSION,
  playerDataExportView,
} from "../lib/epoch/playerDataExportReadModel.ts";

const explorerId = "explorer_owner";
const oldAgentId = "agent_owner_old";
const activeAgentId = "agent_owner_active";
const foreignAgentId = "agent_foreign";

function identity(input: {
  agentId: string;
  explorerId: string;
  generation: number;
  status: "active" | "archived";
  previousAgentId?: string;
  nextAgentId?: string;
}): EpochAgentIdentity {
  return {
    agentId: input.agentId,
    explorerId: input.explorerId,
    identityName: `Identity ${input.generation}`,
    generation: input.generation,
    status: input.status,
    ...(input.previousAgentId ? { previousAgentId: input.previousAgentId } : {}),
    ...(input.nextAgentId ? { nextAgentId: input.nextAgentId } : {}),
    lifetime: {
      max: 100,
      remaining: input.status === "active" ? 80 : 0,
      startedAt: `2026-07-0${input.generation}T00:00:00.000Z`,
      ...(input.status === "archived" ? {
        archivedAt: "2026-07-02T00:00:00.000Z",
        finalTitle: "Old Watcher",
      } : {}),
    },
    personality: {
      traits: ["careful"],
      driftIds: [],
    },
    createdAt: `2026-07-0${input.generation}T00:00:00.000Z`,
  };
}

function event(input: {
  eventId: string;
  agentId: string;
  explorerId: string;
  createdAt: string;
  payload?: Readonly<Record<string, unknown>>;
}): EpochEvent {
  return {
    eventId: input.eventId,
    eventType: "resource_granted",
    aggregateType: "resource_account",
    aggregateId: input.agentId,
    actorExplorerId: input.explorerId,
    agentId: input.agentId,
    trustClass: "system_worker",
    causationId: `cause_${input.eventId}`,
    correlationId: `correlation_${input.eventId}`,
    createdAt: input.createdAt,
    payload: input.payload || {
      resourceId: "coin",
      amount: 1,
      reason: "test",
      balanceAfter: 1,
    },
  } as unknown as EpochEvent;
}

function seasonCampaign(): EpochSeasonCampaign {
  return {
    seasonId: "season_gray_harbor",
    seasonKey: "gray_harbor",
    title: "Gray Harbor Season",
    description: "Export fixture",
    regionIds: ["region_gray_harbor"],
    factionIds: ["gray_watch"],
    resourceId: "coin",
    targetScore: 10,
    reward: { resourceId: "legend", amount: 1, reason: "season_reward" },
    createdAt: "2026-07-01T00:00:00.000Z",
    status: "active",
    phaseEvents: [],
    objectives: [],
    contributions: [{
      eventId: "event_owner_active",
      seasonId: "season_gray_harbor",
      agentId: activeAgentId,
      explorerId,
      factionId: "gray_watch",
      resourceId: "coin",
      amount: 2,
      baseScoreDelta: 3,
      organizationBonusScore: 0,
      regionControlBonusScore: 0,
      scoreDelta: 3,
      sourceOrganizationUpgradeIds: [],
      sourceRegionControlRegionIds: [],
      agentScoreAfter: 3,
      factionScoreAfter: 3,
      totalScoreAfter: 3,
      trustClass: "system_worker",
      recordedAt: "2026-07-04T00:00:00.000Z",
    }, {
      eventId: "event_foreign",
      seasonId: "season_gray_harbor",
      agentId: foreignAgentId,
      explorerId: "explorer_foreign",
      factionId: "gray_watch",
      resourceId: "coin",
      amount: 9,
      baseScoreDelta: 9,
      organizationBonusScore: 0,
      regionControlBonusScore: 0,
      scoreDelta: 9,
      sourceOrganizationUpgradeIds: [],
      sourceRegionControlRegionIds: [],
      agentScoreAfter: 9,
      factionScoreAfter: 12,
      totalScoreAfter: 12,
      trustClass: "system_worker",
      recordedAt: "2026-07-05T00:00:00.000Z",
    }],
    totalScore: 12,
    factionStandings: [],
    agentStandings: [],
  };
}

function fixtureProjection(): EpochProjection {
  const base = createEpochGameCore().project();
  const oldIdentity = identity({
    agentId: oldAgentId,
    explorerId,
    generation: 1,
    status: "archived",
    nextAgentId: activeAgentId,
  });
  const activeIdentity = identity({
    agentId: activeAgentId,
    explorerId,
    generation: 2,
    status: "active",
    previousAgentId: oldAgentId,
  });
  const foreignIdentity = identity({
    agentId: foreignAgentId,
    explorerId: "explorer_foreign",
    generation: 1,
    status: "active",
  });
  const ownerOldEvent = event({
    eventId: "event_owner_old",
    agentId: oldAgentId,
    explorerId,
    createdAt: "2026-07-02T00:00:00.000Z",
  });
  const ownerActiveEvent = event({
    eventId: "event_owner_active",
    agentId: activeAgentId,
    explorerId,
    createdAt: "2026-07-04T00:00:00.000Z",
    payload: {
      explorerSecretHash: "secret-owner-hash",
      confirmationToken: "confirmation-owner-token",
      signature: "owner-signature",
      hiddenOutcomeTables: { jackpot: "never-export-this" },
      privateDirectTrade: { tradeId: "owner-private-trade" },
    },
  });
  const foreignEvent = event({
    eventId: "event_foreign",
    agentId: foreignAgentId,
    explorerId: "explorer_foreign",
    createdAt: "2026-07-05T00:00:00.000Z",
    payload: {
      confirmationToken: "foreign-confirmation-token",
      privateDirectTrade: { tradeId: "foreign-private-trade" },
    },
  });

  return {
    ...base,
    events: [ownerOldEvent, ownerActiveEvent, foreignEvent],
    identities: {
      [oldAgentId]: oldIdentity,
      [activeAgentId]: activeIdentity,
      [foreignAgentId]: foreignIdentity,
    },
    lineage: {
      [explorerId]: [oldAgentId, activeAgentId],
      explorer_foreign: [foreignAgentId],
    },
    resourceBalances: {
      [oldAgentId]: { coin: 2 },
      [activeAgentId]: { coin: 7, legend: 1 },
      [foreignAgentId]: { coin: 999 },
    },
    inventoryItems: {
      item_old: {
        itemId: "item_old",
        agentId: oldAgentId,
        explorerId,
        itemKey: "old_compass",
        displayName: "Old Compass",
        rarity: "common",
        sourceEventIds: ["event_owner_old"],
        createdAt: "2026-07-02T00:00:00.000Z",
        bound: true,
      },
      item_active: {
        itemId: "item_active",
        agentId: activeAgentId,
        explorerId,
        itemKey: "gray_lantern",
        displayName: "Gray Lantern",
        rarity: "rare",
        sourceEventIds: ["event_owner_active"],
        createdAt: "2026-07-04T00:00:00.000Z",
        bound: false,
      },
      item_foreign: {
        itemId: "item_foreign",
        agentId: foreignAgentId,
        explorerId: "explorer_foreign",
        itemKey: "foreign_relic",
        displayName: "Foreign Relic",
        rarity: "legendary",
        sourceEventIds: ["event_foreign"],
        createdAt: "2026-07-05T00:00:00.000Z",
        bound: false,
      },
    },
    inventoryItemIdsByAgent: {
      [oldAgentId]: ["item_old"],
      [activeAgentId]: ["item_active"],
      [foreignAgentId]: ["item_foreign"],
    },
    inventoryItemIdsByExplorer: {
      [explorerId]: ["item_old", "item_active"],
      explorer_foreign: ["item_foreign"],
    },
    downtime: {
      [activeAgentId]: {
        agentId: activeAgentId,
        mode: "meditation",
        regionId: "region_gray_harbor",
        startedAt: "2026-07-04T00:00:00.000Z",
        active: true,
      },
      [foreignAgentId]: {
        agentId: foreignAgentId,
        mode: "slacking",
        regionId: "region_gray_harbor",
        startedAt: "2026-07-05T00:00:00.000Z",
        active: true,
      },
    },
    downtimeDiaryEntries: {
      diary_owner: {
        diaryId: "diary_owner",
        agentId: activeAgentId,
        mode: "meditation",
        regionId: "region_gray_harbor",
        phase: "tick",
        title: "Quiet Watch",
        summary: "The harbor stayed calm.",
        elapsedSeconds: 60,
        capped: false,
        rewards: [],
        occurredAt: "2026-07-04T01:00:00.000Z",
        sourceEventId: "event_owner_active",
        sourceEventType: "downtime_tick_resolved",
      },
    },
    downtimeDiaryIdsByAgent: {
      [activeAgentId]: ["diary_owner"],
    },
    npcs: {
      npc_clerk: {
        npcId: "npc_clerk",
        npcKey: "clerk",
        displayName: "Harbor Clerk",
        regionId: "region_gray_harbor",
        traits: ["careful"],
        createdAt: "2026-07-01T00:00:00.000Z",
        lifecycle: [],
      },
    },
    agentNpcBonds: {
      bond_owner: {
        bondId: "bond_owner",
        agentId: activeAgentId,
        explorerId,
        npcId: "npc_clerk",
        npcRegionId: "region_gray_harbor",
        kind: "friend",
        score: 2,
        previousScore: 0,
        scoreDelta: 2,
        focusSpent: 1,
        reason: "Shared watch",
        updatedAt: "2026-07-04T00:00:00.000Z",
      },
      bond_foreign: {
        bondId: "bond_foreign",
        agentId: foreignAgentId,
        explorerId: "explorer_foreign",
        npcId: "npc_clerk",
        npcRegionId: "region_gray_harbor",
        kind: "enemy",
        score: -2,
        previousScore: 0,
        scoreDelta: -2,
        focusSpent: 1,
        reason: "Foreign dispute",
        updatedAt: "2026-07-05T00:00:00.000Z",
      },
    },
    agentNpcBondIdsByAgent: {
      [activeAgentId]: ["bond_owner"],
      [foreignAgentId]: ["bond_foreign"],
    },
    worldMessages: [{
      messageId: "message_owner_world",
      scope: "world",
      agentId: oldAgentId,
      explorerId,
      body: "Old identity checking in.",
      postedAt: "2026-07-03T00:00:00.000Z",
      moderationStatus: "visible",
    }, {
      messageId: "message_foreign_world",
      scope: "world",
      agentId: foreignAgentId,
      explorerId: "explorer_foreign",
      body: "Foreign private chatter.",
      postedAt: "2026-07-05T00:00:00.000Z",
      moderationStatus: "visible",
    }],
    regionMessages: {
      region_gray_harbor: [{
        messageId: "message_owner_region",
        scope: "region",
        agentId: activeAgentId,
        explorerId,
        regionId: "region_gray_harbor",
        body: "The harbor is clear.",
        postedAt: "2026-07-04T00:00:00.000Z",
        moderationStatus: "visible",
      }, {
        messageId: "message_owner_hidden",
        scope: "region",
        agentId: activeAgentId,
        explorerId,
        regionId: "region_gray_harbor",
        body: "Moderated owner message.",
        postedAt: "2026-07-04T01:00:00.000Z",
        moderationStatus: "hidden",
      }],
    },
    regionNews: {
      region_gray_harbor: [{
        newsId: "news_owner",
        regionId: "region_gray_harbor",
        headline: "Watcher protects the harbor",
        body: "A local watcher kept the lamps burning.",
        legendDelta: 1,
        sourceEventIds: ["event_owner_active"],
        createdAt: "2026-07-04T02:00:00.000Z",
        moderationStatus: "visible",
      }, {
        newsId: "news_foreign",
        regionId: "region_gray_harbor",
        headline: "Foreign report",
        body: "Unrelated activity.",
        legendDelta: 1,
        sourceEventIds: ["event_foreign"],
        createdAt: "2026-07-05T00:00:00.000Z",
        moderationStatus: "visible",
      }],
    },
    seasonCampaigns: {
      season_gray_harbor: seasonCampaign(),
    },
    directTrades: {
      foreign_private_trade: {
        tradeId: "foreign-private-trade",
        regionId: "region_gray_harbor",
        proposerAgentId: foreignAgentId,
        proposerExplorerId: "explorer_foreign",
        counterpartyAgentId: "agent_foreign_two",
        counterpartyExplorerId: "explorer_foreign_two",
        offeredAsset: { kind: "resource", resourceId: "coin", amount: 50 },
        requestedAsset: { kind: "resource", resourceId: "legend", amount: 2 },
        status: "open",
        createdAt: "2026-07-05T00:00:00.000Z",
      },
    },
  };
}

test("player export covers the complete lineage while excluding unrelated player data", () => {
  const result = playerDataExportView(fixtureProjection(), {
    explorerId,
    limit: 20,
    exportedAt: "2026-07-10T12:34:56.000Z",
  });

  assert.equal(result.schemaVersion, EPOCH_PLAYER_DATA_EXPORT_SCHEMA_VERSION);
  assert.equal(result.exportedAt, "2026-07-10T12:34:56.000Z");
  assert.deepEqual(result.identities.map((item) => item.agentId), [oldAgentId, activeAgentId]);
  assert.deepEqual(Object.keys(result.resources), [oldAgentId, activeAgentId]);
  assert.deepEqual(result.inventoryItems.map((item) => item.itemId), ["item_active", "item_old"]);
  assert.deepEqual(Object.keys(result.downtime), [oldAgentId, activeAgentId]);
  assert.equal(result.downtime[oldAgentId], null);
  assert.deepEqual(result.downtimeDiaryEntries.map((entry) => entry.diaryId), ["diary_owner"]);
  assert.deepEqual(result.npcBonds.map((bond) => bond.bondId), ["bond_owner"]);
  assert.deepEqual(result.messages.world.map((message) => message.messageId), ["message_owner_world"]);
  assert.deepEqual(result.messages.region.map((message) => message.messageId), ["message_owner_region"]);
  assert.deepEqual(result.newsMentions.map((news) => news.newsId), ["news_owner"]);
  assert.deepEqual(result.seasonContributions.map((contribution) => contribution.eventId), ["event_owner_active"]);
  assert.deepEqual(result.replay.eventIds, ["event_owner_old", "event_owner_active"]);
  assert.equal(result.counts.identities, 2);
  assert.equal(result.counts.replayEvents, 2);
});

test("player export is JSON serializable and never carries secrets, signatures, hidden outcomes, or foreign direct trades", () => {
  const result = playerDataExportView(fixtureProjection(), {
    explorerId,
    limit: 20,
    exportedAt: "2026-07-10T12:34:56.000Z",
  });
  const serialized = JSON.stringify(result);

  assert.deepEqual(JSON.parse(serialized), result);
  assert.doesNotMatch(serialized, /secret-owner-hash/);
  assert.doesNotMatch(serialized, /confirmation-owner-token/);
  assert.doesNotMatch(serialized, /owner-signature/);
  assert.doesNotMatch(serialized, /never-export-this/);
  assert.doesNotMatch(serialized, /foreign-private-trade/);
  assert.doesNotMatch(serialized, /foreign-confirmation-token/);
  assert.doesNotMatch(serialized, /explorer_foreign/);
  assert.equal("payload" in result.replay.events[0], false);
});

test("player export applies one bounded limit to owner timelines and reports truncation", () => {
  const result = playerDataExportView(fixtureProjection(), {
    explorerId,
    limit: 1,
    exportedAt: "2026-07-10T12:34:56.000Z",
  });

  assert.equal(result.inventoryItems.length, 1);
  assert.equal(result.replay.limit, 1);
  assert.equal(result.replay.events.length, 1);
  assert.equal(result.replay.events[0]?.eventId, "event_owner_active");
  assert.equal(result.replay.truncated, true);
});

test("player export rejects missing explorers and invalid export timestamps", () => {
  const projection = fixtureProjection();

  assert.throws(
    () => playerDataExportView(projection, { explorerId: "explorer_missing" }),
    /explorer_profile_not_found/,
  );
  assert.throws(
    () => playerDataExportView(projection, { explorerId, exportedAt: "not-a-date" }),
    /player_data_export_invalid_exported_at/,
  );
});
