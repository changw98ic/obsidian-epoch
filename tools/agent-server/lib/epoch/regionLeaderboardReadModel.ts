import type { EpochProjection } from "./gameCore.ts";
import { normalizeTrustClass, type EpochTrustClass } from "./protocol.ts";

export interface EpochRegionLeaderboardEntry {
  readonly agentId: string;
  readonly explorerId: string;
  readonly influenceScore: number;
  readonly trustedInfluenceScore: number;
  readonly dominantTrustClass: EpochTrustClass;
  readonly trustBreakdown: Partial<Record<EpochTrustClass, number>>;
  readonly objectiveScore: number;
  readonly resourceNodeScore: number;
  readonly anomalyScore: number;
  readonly seasonScore: number;
  readonly legendScore: number;
  readonly bountyScore: number;
  readonly raidScore: number;
  readonly lastActiveAt: string;
  readonly sourceEventIds: readonly string[];
}

type MutableRegionLeaderboardEntry = {
  agentId: string;
  explorerId: string;
  influenceScore: number;
  trustedInfluenceScore: number;
  trustBreakdown: Partial<Record<EpochTrustClass, number>>;
  objectiveScore: number;
  resourceNodeScore: number;
  anomalyScore: number;
  seasonScore: number;
  legendScore: number;
  bountyScore: number;
  raidScore: number;
  lastActiveAt: string;
  sourceEventIds: string[];
};

const TRUSTED_LEADERBOARD_TRUST_CLASSES = new Set<EpochTrustClass>([
  "server_hosted_agent",
  "host_attested",
  "remote_attested_runner",
]);

const LEADERBOARD_TRUST_CLASS_ORDER: readonly EpochTrustClass[] = [
  "remote_attested_runner",
  "host_attested",
  "server_hosted_agent",
  "user_verified_web",
  "system_worker",
  "untrusted_client",
];

function dominantLeaderboardTrustClass(breakdown: Partial<Record<EpochTrustClass, number>>): EpochTrustClass {
  let dominant: EpochTrustClass = "untrusted_client";
  let dominantScore = -1;
  for (const trustClass of LEADERBOARD_TRUST_CLASS_ORDER) {
    const score = breakdown[trustClass] || 0;
    if (score > dominantScore) {
      dominant = trustClass;
      dominantScore = score;
    }
  }
  return dominant;
}

export function regionLeaderboardView(
  projection: EpochProjection,
  input: { regionId: string; limit?: number },
): readonly EpochRegionLeaderboardEntry[] {
  const entries = new Map<string, MutableRegionLeaderboardEntry>();
  const addScore = (
    agentId: string | undefined,
    explorerId: string | undefined,
    scoreType: "objectiveScore" | "resourceNodeScore" | "anomalyScore" | "seasonScore" | "legendScore" | "bountyScore" | "raidScore",
    scoreDelta: number,
    eventId: string,
    occurredAt: string,
    trustClassInput: string,
  ) => {
    if (!agentId || !explorerId || scoreDelta <= 0) return;
    const trustClass = normalizeTrustClass(trustClassInput);
    const current = entries.get(agentId) || {
      agentId,
      explorerId,
      influenceScore: 0,
      trustedInfluenceScore: 0,
      trustBreakdown: {},
      objectiveScore: 0,
      resourceNodeScore: 0,
      anomalyScore: 0,
      seasonScore: 0,
      legendScore: 0,
      bountyScore: 0,
      raidScore: 0,
      lastActiveAt: occurredAt,
      sourceEventIds: [],
    };
    current.explorerId = explorerId;
    current[scoreType] += scoreDelta;
    current.influenceScore += scoreDelta;
    current.trustBreakdown[trustClass] = (current.trustBreakdown[trustClass] || 0) + scoreDelta;
    if (TRUSTED_LEADERBOARD_TRUST_CLASSES.has(trustClass)) current.trustedInfluenceScore += scoreDelta;
    current.lastActiveAt = current.lastActiveAt.localeCompare(occurredAt) >= 0 ? current.lastActiveAt : occurredAt;
    if (!current.sourceEventIds.includes(eventId)) current.sourceEventIds.push(eventId);
    entries.set(agentId, current);
  };

  for (const event of projection.events) {
    if (event.eventType === "contested_objective_contributed") {
      const objective = projection.contestedObjectives[event.payload.objectiveId];
      if (objective?.regionId !== input.regionId) continue;
      addScore(
        event.payload.agentId,
        event.payload.explorerId,
        "objectiveScore",
        event.payload.scoreDelta,
        event.eventId,
        event.createdAt,
        event.trustClass,
      );
      continue;
    }
    if (event.eventType === "resource_node_contested") {
      const node = projection.resourceNodes[event.payload.nodeId];
      if (node?.regionId !== input.regionId) continue;
      addScore(
        event.payload.agentId,
        event.payload.explorerId,
        "resourceNodeScore",
        event.payload.scoreDelta,
        event.eventId,
        event.payload.contestedAt || event.createdAt,
        event.trustClass,
      );
      continue;
    }
    if (event.eventType === "anomaly_event_contested") {
      const anomaly = projection.anomalyEvents[event.payload.anomalyId];
      if (anomaly?.regionId !== input.regionId) continue;
      addScore(
        event.payload.agentId,
        event.payload.explorerId,
        "anomalyScore",
        event.payload.scoreDelta,
        event.eventId,
        event.payload.contestedAt || event.createdAt,
        event.trustClass,
      );
      continue;
    }
    if (event.eventType === "season_contribution_recorded") {
      const campaign = projection.seasonCampaigns[event.payload.seasonId];
      if (!campaign?.regionIds.includes(input.regionId)) continue;
      addScore(
        event.payload.agentId,
        event.payload.explorerId,
        "seasonScore",
        event.payload.scoreDelta,
        event.eventId,
        event.payload.recordedAt || event.createdAt,
        event.trustClass,
      );
      continue;
    }
    if (event.eventType === "legend_awarded") {
      if (event.payload.regionId !== input.regionId) continue;
      addScore(
        event.payload.agentId,
        event.payload.explorerId,
        "legendScore",
        event.payload.amount * 8,
        event.eventId,
        event.payload.awardedAt || event.createdAt,
        event.trustClass,
      );
      continue;
    }
    if (event.eventType === "raid_resolved") {
      if (event.payload.regionId !== input.regionId) continue;
      const winnerAgentId = event.payload.outcome === "attacker_won"
        ? event.payload.attackerAgentId
        : event.payload.defenderAgentId;
      const winnerExplorerId = event.payload.outcome === "attacker_won"
        ? event.payload.attackerExplorerId
        : event.payload.defenderExplorerId;
      addScore(
        winnerAgentId,
        winnerExplorerId,
        "raidScore",
        event.payload.reward.amount * 8,
        event.eventId,
        event.payload.resolvedAt || event.createdAt,
        event.trustClass,
      );
      continue;
    }
    if (event.eventType === "region_influence_changed" && event.payload.sourceEventType === "bounty_claimed") {
      if (event.payload.regionId !== input.regionId) continue;
      addScore(
        event.payload.agentId,
        event.payload.explorerId,
        "bountyScore",
        event.payload.influenceDelta,
        event.payload.sourceEventId,
        event.payload.changedAt || event.createdAt,
        event.trustClass,
      );
    }
  }

  return [...entries.values()]
    .sort((left, right) =>
      right.influenceScore - left.influenceScore
      || right.lastActiveAt.localeCompare(left.lastActiveAt)
      || left.agentId.localeCompare(right.agentId))
    .slice(0, Math.max(1, input.limit || 20))
    .map((entry) => ({
      agentId: entry.agentId,
      explorerId: entry.explorerId,
      influenceScore: entry.influenceScore,
      trustedInfluenceScore: entry.trustedInfluenceScore,
      dominantTrustClass: dominantLeaderboardTrustClass(entry.trustBreakdown),
      trustBreakdown: { ...entry.trustBreakdown },
      objectiveScore: entry.objectiveScore,
      resourceNodeScore: entry.resourceNodeScore,
      anomalyScore: entry.anomalyScore,
      seasonScore: entry.seasonScore,
      legendScore: entry.legendScore,
      bountyScore: entry.bountyScore,
      raidScore: entry.raidScore,
      lastActiveAt: entry.lastActiveAt,
      sourceEventIds: entry.sourceEventIds,
    }));
}
