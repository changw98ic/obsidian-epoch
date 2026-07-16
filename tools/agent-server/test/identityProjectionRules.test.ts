import assert from "node:assert/strict";
import test from "node:test";

import {
  IDENTITY_LEVEL_FOR_EXTRA_SLOT,
  IDENTITY_LEGEND_PER_EXTRA_SLOT,
  IDENTITY_REGION_FACTION_RANK_FOR_EXTRA_SLOT,
  IDENTITY_SPECIAL_SERVER_EVENTS_PER_EXTRA_SLOT,
  MAX_ACTIVE_IDENTITY_SLOTS,
  explorerIdentityIds,
  explorerLegend,
  identitySlotsForExplorer,
  requireActiveIdentity,
  requireIdentity,
  requireIdentitySlot,
} from "../lib/epoch/identityProjectionRules.ts";
import type { EpochEvent } from "../lib/epoch/events.ts";

function identityIssuedEvent(eventId: string, explorerId: string, agentId: string): EpochEvent {
  return {
    eventId,
    eventType: "identity_issued",
    aggregateType: "agent_identity",
    aggregateId: agentId,
    actorExplorerId: explorerId,
    agentId,
    trustClass: "system_worker",
    causationId: `cause_${eventId}`,
    correlationId: `correlation_${eventId}`,
    createdAt: "2026-07-10T00:00:00.000Z",
    payload: {
      agentId,
      explorerId,
      identityName: "服务器签发身份",
      generation: 1,
      status: "active",
      lifetime: {
        max: 100,
        remaining: 100,
        startedAt: "2026-07-10T00:00:00.000Z",
      },
    },
  };
}

function bountyClaimedEvent(eventId: string, explorerId: string, agentId: string): EpochEvent {
  return {
    eventId,
    eventType: "bounty_claimed",
    aggregateType: "bounty",
    aggregateId: `bounty_${eventId}`,
    actorExplorerId: explorerId,
    agentId,
    trustClass: "system_worker",
    causationId: `cause_${eventId}`,
    correlationId: `correlation_${eventId}`,
    createdAt: "2026-07-10T00:00:00.000Z",
    payload: {
      bountyId: `bounty_${eventId}`,
      claimantAgentId: agentId,
      claimantExplorerId: explorerId,
      evidence: "server-adjudicated claim",
      claimedAt: "2026-07-10T00:00:00.000Z",
    },
  };
}

function legendAwardedEvent(eventId: string, explorerId: string, agentId: string): EpochEvent {
  return {
    eventId,
    eventType: "legend_awarded",
    aggregateType: "legend_award",
    aggregateId: `award_${eventId}`,
    actorExplorerId: "system",
    agentId,
    trustClass: "system_worker",
    causationId: `cause_${eventId}`,
    correlationId: `correlation_${eventId}`,
    createdAt: "2026-07-10T00:00:00.000Z",
    payload: {
      awardId: `award_${eventId}`,
      newsId: `news_${eventId}`,
      regionId: "region_gray_harbor",
      agentId,
      explorerId,
      amount: 3,
      reason: "server legacy milestone",
      awardedAt: "2026-07-10T00:00:00.000Z",
    },
  };
}

function seasonObjectiveCompletedEvent(eventId: string, explorerId: string, agentId: string): EpochEvent {
  return {
    eventId,
    eventType: "season_objective_completed",
    aggregateType: "season_objective",
    aggregateId: `objective_${eventId}`,
    actorExplorerId: "system",
    agentId,
    trustClass: "system_worker",
    causationId: `cause_${eventId}`,
    correlationId: `correlation_${eventId}`,
    createdAt: "2026-07-10T00:00:00.000Z",
    payload: {
      objectiveId: `objective_${eventId}`,
      seasonId: "season_rank",
      completedByAgentId: agentId,
      completedByExplorerId: explorerId,
      completedByFactionId: "faction_wardens",
      progressScore: 10,
      targetScore: 10,
      sourceEventId: `source_${eventId}`,
      completedAt: "2026-07-10T00:00:00.000Z",
    },
  };
}

function anomalyResolvedEvent(eventId: string, explorerId: string, agentId: string): EpochEvent {
  return {
    eventId,
    eventType: "anomaly_event_resolved",
    aggregateType: "anomaly_event",
    aggregateId: `anomaly_${eventId}`,
    actorExplorerId: "system",
    agentId,
    trustClass: "system_worker",
    causationId: `cause_${eventId}`,
    correlationId: `correlation_${eventId}`,
    createdAt: "2026-07-10T00:00:00.000Z",
    payload: {
      anomalyId: `anomaly_${eventId}`,
      resolvedAt: "2026-07-10T00:00:00.000Z",
      outcome: "contained",
      winnerAgentId: agentId,
      winnerExplorerId: explorerId,
      winningScore: 12,
      reward: {
        resourceId: "legend",
        amount: 1,
        reason: "special server event",
      },
      lifetimeRisk: 2,
    },
  };
}

test("identity projection rules calculate explorer identity slots", () => {
  const projection = {
    lineage: {
      explorer_1: ["agent_active", "agent_archived", "agent_missing"],
      explorer_2: ["agent_other"],
    },
    identities: {
      agent_active: { status: "active" },
      agent_archived: { status: "archived" },
      agent_other: { status: "active" },
    },
    resourceBalances: {
      agent_active: { legend: 2 },
      agent_archived: { legend: 4 },
      agent_other: { legend: 9 },
    },
  };

  assert.equal(IDENTITY_LEGEND_PER_EXTRA_SLOT, 3);
  assert.equal(IDENTITY_LEVEL_FOR_EXTRA_SLOT, 5);
  assert.equal(IDENTITY_REGION_FACTION_RANK_FOR_EXTRA_SLOT, 2);
  assert.equal(IDENTITY_SPECIAL_SERVER_EVENTS_PER_EXTRA_SLOT, 1);
  assert.equal(MAX_ACTIVE_IDENTITY_SLOTS, 3);
  assert.deepEqual(explorerIdentityIds(projection, "explorer_1"), ["agent_active", "agent_archived", "agent_missing"]);
  assert.deepEqual(explorerIdentityIds(projection, "explorer_missing"), []);
  assert.equal(explorerLegend(projection, "explorer_1"), 6);
  assert.deepEqual(identitySlotsForExplorer(projection, "explorer_1"), {
    explorerId: "explorer_1",
    active: 1,
    max: 1,
    available: 0,
    legend: 6,
    legendPerSlot: 3,
    nextUnlockLegend: 3,
    legendToNextSlot: 3,
    capped: false,
    entitlementBreakdown: {
      legend: {
        source: "legend",
        value: 0,
        threshold: 3,
        unlockCount: 0,
        sourceEventIds: [],
      },
      level: {
        source: "level",
        value: 0,
        threshold: 5,
        unlockCount: 0,
        sourceEventIds: [],
      },
      legacyAchievement: {
        source: "legacyAchievement",
        value: 0,
        threshold: 3,
        unlockCount: 0,
        sourceEventIds: [],
      },
      regionFactionRank: {
        source: "regionFactionRank",
        value: 0,
        threshold: 2,
        unlockCount: 0,
        sourceEventIds: [],
      },
      specialServerEvent: {
        source: "specialServerEvent",
        value: 0,
        threshold: 1,
        unlockCount: 0,
        sourceEventIds: [],
      },
      totalUnlockCount: 0,
      appliedUnlockCount: 0,
    },
  });
  assert.deepEqual(identitySlotsForExplorer(projection, "explorer_missing"), {
    explorerId: "explorer_missing",
    active: 0,
    max: 1,
    available: 1,
    legend: 0,
    legendPerSlot: 3,
    nextUnlockLegend: 3,
    legendToNextSlot: 3,
    capped: false,
    entitlementBreakdown: {
      legend: {
        source: "legend",
        value: 0,
        threshold: 3,
        unlockCount: 0,
        sourceEventIds: [],
      },
      level: {
        source: "level",
        value: 0,
        threshold: 5,
        unlockCount: 0,
        sourceEventIds: [],
      },
      legacyAchievement: {
        source: "legacyAchievement",
        value: 0,
        threshold: 3,
        unlockCount: 0,
        sourceEventIds: [],
      },
      regionFactionRank: {
        source: "regionFactionRank",
        value: 0,
        threshold: 2,
        unlockCount: 0,
        sourceEventIds: [],
      },
      specialServerEvent: {
        source: "specialServerEvent",
        value: 0,
        threshold: 1,
        unlockCount: 0,
        sourceEventIds: [],
      },
      totalUnlockCount: 0,
      appliedUnlockCount: 0,
    },
  });
});

test("identity projection rules combine four server-authoritative entitlement sources", () => {
  const explorerId = "explorer_entitlements";
  const agentId = "agent_entitlements";
  const events = [
    identityIssuedEvent("event_identity", explorerId, agentId),
    bountyClaimedEvent("event_level_1", explorerId, agentId),
    bountyClaimedEvent("event_level_2", explorerId, agentId),
    bountyClaimedEvent("event_level_3", explorerId, agentId),
    bountyClaimedEvent("event_level_4", explorerId, agentId),
    legendAwardedEvent("event_legacy", explorerId, agentId),
    seasonObjectiveCompletedEvent("event_rank", explorerId, agentId),
    anomalyResolvedEvent("event_special", explorerId, agentId),
    anomalyResolvedEvent("event_foreign", "explorer_foreign", "agent_foreign"),
  ] as const;
  const slots = identitySlotsForExplorer({
    events,
    lineage: {
      [explorerId]: [agentId],
      explorer_foreign: ["agent_foreign"],
    },
    identities: {
      [agentId]: { status: "active" },
      agent_foreign: { status: "active" },
    },
    resourceBalances: {
      [agentId]: { legend: 3 },
      agent_foreign: { legend: 99 },
    },
  }, explorerId);

  assert.equal(slots.max, MAX_ACTIVE_IDENTITY_SLOTS);
  assert.equal(slots.available, 2);
  assert.equal(slots.capped, true);
  assert.deepEqual(slots.entitlementBreakdown, {
    legend: {
      source: "legend",
      value: 0,
      threshold: 3,
      unlockCount: 0,
      sourceEventIds: [],
    },
    level: {
      source: "level",
      value: 7,
      threshold: 5,
      unlockCount: 1,
      sourceEventIds: [
        "event_identity",
        "event_level_1",
        "event_level_2",
        "event_level_3",
        "event_level_4",
        "event_rank",
        "event_special",
      ],
    },
    legacyAchievement: {
      source: "legacyAchievement",
      value: 3,
      threshold: 3,
      unlockCount: 1,
      sourceEventIds: ["event_legacy"],
    },
    regionFactionRank: {
      source: "regionFactionRank",
      value: 2,
      threshold: 2,
      unlockCount: 1,
      sourceEventIds: ["event_rank"],
    },
    specialServerEvent: {
      source: "specialServerEvent",
      value: 1,
      threshold: 1,
      unlockCount: 1,
      sourceEventIds: ["event_special"],
    },
    totalUnlockCount: 4,
    appliedUnlockCount: 2,
  });
});

test("identity projection rules ignore client-declared entitlement fields", () => {
  const projection = {
    lineage: { explorer_forged: ["agent_forged"] },
    identities: { agent_forged: { status: "active" } },
    resourceBalances: { agent_forged: { legend: 999 } },
    entitlement: {
      level: 999,
      legacyAchievement: 999,
      regionFactionRank: 999,
      specialServerEvent: 999,
    },
  };

  const slots = identitySlotsForExplorer(projection, "explorer_forged");
  assert.equal(slots.max, 1);
  assert.equal(slots.available, 0);
  assert.equal(slots.entitlementBreakdown.totalUnlockCount, 0);
  assert.deepEqual(slots.entitlementBreakdown.level.sourceEventIds, []);
  assert.deepEqual(slots.entitlementBreakdown.legend.sourceEventIds, []);
  assert.deepEqual(slots.entitlementBreakdown.legacyAchievement.sourceEventIds, []);
  assert.deepEqual(slots.entitlementBreakdown.regionFactionRank.sourceEventIds, []);
  assert.deepEqual(slots.entitlementBreakdown.specialServerEvent.sourceEventIds, []);
});

test("identity projection rules read identity projection state", () => {
  const projection = {
    lineage: {
      explorer_full: ["agent_active", "agent_other", "agent_third"],
      explorer_available: [],
    },
    identities: {
      agent_active: { status: "active", marker: "active" },
      agent_archived: { status: "archived", marker: "archived" },
      agent_other: { status: "active", marker: "other" },
      agent_third: { status: "active", marker: "third" },
    },
    resourceBalances: {
      agent_active: { legend: 0 },
      agent_other: { legend: 9 },
      agent_third: { legend: 0 },
    },
  } as const;

  assert.equal(requireIdentity(projection, "agent_archived").marker, "archived");
  assert.equal(requireActiveIdentity(projection, "agent_active").marker, "active");
  assert.equal(requireIdentitySlot(projection, "explorer_available").available, 1);
  assert.throws(() => requireIdentity(projection, "agent_missing"), /agent_identity_not_found/);
  assert.throws(() => requireActiveIdentity(projection, "agent_archived"), /agent_identity_archived/);
  assert.throws(() => requireIdentitySlot(projection, "explorer_full"), /identity_slot_limit_reached/);
});
