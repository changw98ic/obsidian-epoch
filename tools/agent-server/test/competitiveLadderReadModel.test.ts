import assert from "node:assert/strict";
import test from "node:test";

import type { EpochEvent } from "../lib/epoch/events.ts";
import {
  createEpochGameCore,
  type EpochProjection,
  type EpochSeasonCampaign,
  type EpochSeasonContribution,
  type EpochSeasonAgentStanding,
} from "../lib/epoch/gameCore.ts";
import {
  competitiveLadderView,
  EPOCH_COMPETITIVE_LADDER_MAX_LIMIT,
} from "../lib/epoch/competitiveLadderReadModel.ts";
import type { EpochTrustClass } from "../lib/epoch/protocol.ts";

const regionId = "region_gray_harbor";
const objectiveId = "objective_gray_harbor";

function event(input: {
  eventId: string;
  agentId: string;
  explorerId: string;
  scoreDelta: number;
  trustClass: EpochTrustClass;
  createdAt: string;
}): EpochEvent {
  return {
    eventId: input.eventId,
    eventType: "contested_objective_contributed",
    aggregateType: "objective",
    aggregateId: objectiveId,
    actorExplorerId: input.explorerId,
    agentId: input.agentId,
    trustClass: input.trustClass,
    causationId: `cause_${input.eventId}`,
    correlationId: `correlation_${input.eventId}`,
    createdAt: input.createdAt,
    payload: {
      objectiveId,
      agentId: input.agentId,
      explorerId: input.explorerId,
      scoreDelta: input.scoreDelta,
    },
  } as unknown as EpochEvent;
}

function regionProjection(events: readonly EpochEvent[]): EpochProjection {
  const base = createEpochGameCore().project();
  return {
    ...base,
    events,
    contestedObjectives: {
      ...base.contestedObjectives,
      [objectiveId]: {
        objectiveId,
        regionId,
        title: "Gray Harbor Objective",
        description: "Competitive read-model fixture.",
        resourceId: "coin",
        targetScore: 100,
        mode: "contribution",
        reward: { resourceId: "legend", amount: 1, reason: "objective_reward" },
        createdAt: "2026-07-01T00:00:00.000Z",
        status: "active",
        totalScore: 0,
        leaderboard: [],
        raceCompletions: [],
      },
    },
  };
}

function contribution(input: {
  eventId: string;
  agentId: string;
  explorerId: string;
  scoreDelta: number;
  trustClass: EpochTrustClass;
  recordedAt: string;
}): EpochSeasonContribution {
  return {
    eventId: input.eventId,
    seasonId: "season_harbor",
    agentId: input.agentId,
    explorerId: input.explorerId,
    factionId: "faction_watch",
    resourceId: "coin",
    amount: input.scoreDelta,
    baseScoreDelta: input.scoreDelta,
    organizationBonusScore: 0,
    regionControlBonusScore: 0,
    scoreDelta: input.scoreDelta,
    sourceOrganizationUpgradeIds: [],
    sourceRegionControlRegionIds: [],
    agentScoreAfter: input.scoreDelta,
    factionScoreAfter: input.scoreDelta,
    totalScoreAfter: input.scoreDelta,
    trustClass: input.trustClass,
    recordedAt: input.recordedAt,
  };
}

function standing(input: {
  agentId: string;
  explorerId: string;
  score: number;
  trustedScore: number;
  dominantTrustClass: EpochTrustClass;
  trustBreakdown: Partial<Record<EpochTrustClass, number>>;
}): EpochSeasonAgentStanding {
  return {
    agentId: input.agentId,
    explorerId: input.explorerId,
    factionId: "faction_watch",
    amount: input.score,
    score: input.score,
    trustedScore: input.trustedScore,
    dominantTrustClass: input.dominantTrustClass,
    trustBreakdown: input.trustBreakdown,
  };
}

function campaign(input: {
  contributions: readonly EpochSeasonContribution[];
  agentStandings: readonly EpochSeasonAgentStanding[];
}): EpochSeasonCampaign {
  return {
    seasonId: "season_harbor",
    seasonKey: "harbor",
    title: "Harbor Control Season",
    description: "Server campaign used as the tournament ledger.",
    regionIds: [regionId],
    factionIds: ["faction_watch"],
    resourceId: "coin",
    targetScore: 100,
    reward: { resourceId: "legend", amount: 1, reason: "season_reward" },
    createdAt: "2026-07-01T00:00:00.000Z",
    status: "resolved",
    phaseEvents: [],
    objectives: [],
    contributions: input.contributions,
    totalScore: input.agentStandings.reduce((total, item) => total + item.score, 0),
    factionStandings: [],
    agentStandings: input.agentStandings,
    resolvedAt: "2026-07-10T00:00:00.000Z",
  };
}

function seasonProjection(season: EpochSeasonCampaign): EpochProjection {
  const base = createEpochGameCore().project();
  return {
    ...base,
    seasonCampaigns: { [season.seasonId]: season },
    seasonCampaignIdsByRegion: { [regionId]: [season.seasonId] },
  };
}

test("casual region ladder includes every canonical source and exposes provenance", () => {
  const projection = regionProjection([
    event({
      eventId: "event_hosted",
      agentId: "agent_mixed",
      explorerId: "explorer_mixed",
      scoreDelta: 5,
      trustClass: "server_hosted_agent",
      createdAt: "2026-07-02T00:00:00.000Z",
    }),
    event({
      eventId: "event_web",
      agentId: "agent_mixed",
      explorerId: "explorer_mixed",
      scoreDelta: 7,
      trustClass: "user_verified_web",
      createdAt: "2026-07-03T00:00:00.000Z",
    }),
    event({
      eventId: "event_worker",
      agentId: "agent_mixed",
      explorerId: "explorer_mixed",
      scoreDelta: 3,
      trustClass: "system_worker",
      createdAt: "2026-07-04T00:00:00.000Z",
    }),
  ]);

  const view = competitiveLadderView(projection, {
    mode: "casual",
    dimension: { kind: "region", regionId },
  });

  assert.equal(view.entries[0]?.score, 15);
  assert.equal(view.entries[0]?.verifiedScore, 5);
  assert.equal(view.entries[0]?.deliveryClass, "mixed");
  assert.deepEqual(view.entries[0]?.sourceTrustClasses, [
    "user_verified_web",
    "server_hosted_agent",
    "system_worker",
  ]);
  assert.deepEqual(view.entries[0]?.sourceEventIds, ["event_hosted", "event_web", "event_worker"]);
  assert.deepEqual(view.entries[0]?.auditLinks, [
    { eventId: "event_hosted", audit: "/epoch/audit/event_hosted" },
    { eventId: "event_web", audit: "/epoch/audit/event_web" },
    { eventId: "event_worker", audit: "/epoch/audit/event_worker" },
  ]);
  assert.deepEqual(view.entries[0]?.eligibilityReasons, ["casual_accepts_all_canonical_sources"]);
});

test("ranked region ladder counts server-settled events while labelling non-verified delivery", () => {
  const projection = regionProjection([
    event({
      eventId: "event_attested",
      agentId: "agent_ranked",
      explorerId: "explorer_ranked",
      scoreDelta: 4,
      trustClass: "host_attested",
      createdAt: "2026-07-02T00:00:00.000Z",
    }),
    event({
      eventId: "event_untrusted",
      agentId: "agent_ranked",
      explorerId: "explorer_ranked",
      scoreDelta: 8,
      trustClass: "untrusted_client",
      createdAt: "2026-07-03T00:00:00.000Z",
    }),
  ]);

  const view = competitiveLadderView(projection, {
    mode: "ranked",
    dimension: { kind: "region", regionId },
  });

  assert.equal(view.dimension.serverSettled, true);
  assert.equal(view.entries[0]?.score, 12);
  assert.equal(view.entries[0]?.excludedScore, 8);
  assert.deepEqual(view.entries[0]?.eligibilityReasons, [
    "server_settled_canonical_events",
    "non_verified_delivery_counted",
  ]);
});

test("verified region ladder admits only hosted or attested scores and source events", () => {
  const trustCases: readonly {
    trustClass: EpochTrustClass;
    verified: boolean;
  }[] = [
    { trustClass: "server_hosted_agent", verified: true },
    { trustClass: "host_attested", verified: true },
    { trustClass: "remote_attested_runner", verified: true },
    { trustClass: "user_verified_web", verified: false },
    { trustClass: "untrusted_client", verified: false },
    { trustClass: "system_worker", verified: false },
  ];
  const projection = regionProjection(trustCases.map((item, index) => event({
    eventId: `event_${item.trustClass}`,
    agentId: `agent_${item.trustClass}`,
    explorerId: `explorer_${item.trustClass}`,
    scoreDelta: 10 + index,
    trustClass: item.trustClass,
    createdAt: `2026-07-0${index + 1}T00:00:00.000Z`,
  })));

  const view = competitiveLadderView(projection, {
    mode: "verified",
    dimension: { kind: "region", regionId },
  });

  assert.deepEqual(view.entries.map((entry) => entry.dominantTrustClass).sort(), [
    "host_attested",
    "remote_attested_runner",
    "server_hosted_agent",
  ]);
  assert.deepEqual(view.entries.flatMap((entry) => entry.countedTrustClasses).sort(), [
    "host_attested",
    "remote_attested_runner",
    "server_hosted_agent",
  ]);
  assert.ok(view.entries.every((entry) => entry.excludedTrustClasses.length === 0));
  assert.ok(view.entries.every((entry) => entry.sourceEventIds.every((eventId) =>
    !eventId.includes("user_verified_web")
    && !eventId.includes("untrusted_client")
    && !eventId.includes("system_worker"))));
  assert.ok(view.entries.every((entry) => entry.eligibilityReasons.includes("verified_delivery_accepted")));
});

test("season and tournament ladders use campaign score and trustedScore", () => {
  const contributions = [
    contribution({
      eventId: "event_season_hosted",
      agentId: "agent_season",
      explorerId: "explorer_season",
      scoreDelta: 11,
      trustClass: "server_hosted_agent",
      recordedAt: "2026-07-02T00:00:00.000Z",
    }),
    contribution({
      eventId: "event_season_web",
      agentId: "agent_season",
      explorerId: "explorer_season",
      scoreDelta: 10,
      trustClass: "user_verified_web",
      recordedAt: "2026-07-03T00:00:00.000Z",
    }),
    contribution({
      eventId: "event_season_worker",
      agentId: "agent_season",
      explorerId: "explorer_season",
      scoreDelta: 9,
      trustClass: "system_worker",
      recordedAt: "2026-07-04T00:00:00.000Z",
    }),
  ];
  const season = campaign({
    contributions,
    agentStandings: [standing({
      agentId: "agent_season",
      explorerId: "explorer_season",
      score: 30,
      trustedScore: 11,
      dominantTrustClass: "server_hosted_agent",
      trustBreakdown: {
        server_hosted_agent: 11,
        user_verified_web: 10,
        system_worker: 9,
      },
    })],
  });
  const projection = seasonProjection(season);

  const ranked = competitiveLadderView(projection, {
    mode: "ranked",
    dimension: { kind: "season", seasonId: season.seasonId },
  });
  const verified = competitiveLadderView(projection, {
    mode: "verified",
    dimension: { kind: "tournament", tournamentId: season.seasonId },
  });

  assert.equal(ranked.entries[0]?.score, 30);
  assert.equal(verified.entries[0]?.score, 11);
  assert.deepEqual(verified.entries[0]?.sourceEventIds, ["event_season_hosted"]);
  assert.deepEqual(verified.entries[0]?.countedTrustClasses, ["server_hosted_agent"]);
  assert.deepEqual(verified.entries[0]?.excludedTrustClasses, ["user_verified_web", "system_worker"]);
  assert.equal(verified.dimension.kind, "tournament");
  assert.equal(verified.dimension.sourceKind, "season_campaign");
  assert.equal(verified.dimension.serverTournament, true);
});

test("limit is bounded and the complete view is JSON safe", () => {
  const agentStandings = Array.from({ length: 105 }, (_, index) => standing({
    agentId: `agent_${String(index).padStart(3, "0")}`,
    explorerId: `explorer_${String(index).padStart(3, "0")}`,
    score: index + 1,
    trustedScore: index + 1,
    dominantTrustClass: "remote_attested_runner",
    trustBreakdown: { remote_attested_runner: index + 1 },
  }));
  const season = campaign({ contributions: [], agentStandings });
  const view = competitiveLadderView(seasonProjection(season), {
    mode: "verified",
    dimension: { kind: "tournament", tournamentId: season.seasonId },
    limit: 10_000,
  });

  assert.equal(view.limit, EPOCH_COMPETITIVE_LADDER_MAX_LIMIT);
  assert.equal(view.entries.length, EPOCH_COMPETITIVE_LADDER_MAX_LIMIT);
  assert.equal(view.total, 105);
  assert.equal(view.truncated, true);
  assert.deepEqual(JSON.parse(JSON.stringify(view)), view);
});

test("missing season campaign fails closed", () => {
  const projection = createEpochGameCore().project();
  assert.throws(() => competitiveLadderView(projection, {
    mode: "verified",
    dimension: { kind: "tournament", tournamentId: "missing" },
  }), /competitive_ladder_season_campaign_not_found/);
});
