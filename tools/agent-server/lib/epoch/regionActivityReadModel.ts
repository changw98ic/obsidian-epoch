import type {
  EpochAgentIdentity,
  EpochMessageRecord,
  EpochProjection,
} from "./gameCore.ts";
import type { EpochEventType, EpochResourceId } from "./protocol.ts";
import { regionLeaderboardView } from "./regionLeaderboardReadModel.ts";

export interface EpochRegionActiveAgent {
  readonly agentId: string;
  readonly explorerId: string;
  readonly identityName: string;
  readonly status: EpochAgentIdentity["status"];
  readonly generation: number;
  readonly lifetimeRemaining: number;
  readonly legend: number;
  readonly resources: Partial<Record<EpochResourceId, number>>;
  readonly lastActivity: {
    readonly sourceEventType: EpochEventType | "downtime_active";
    readonly sourceEventId?: string;
    readonly summary: string;
    readonly occurredAt: string;
  };
  readonly publicPages: {
    readonly agent: string;
    readonly explorer: string;
    readonly archive?: string;
  };
}

export interface EpochMessagesInfo {
  readonly regionId?: string;
  readonly agentId?: string;
  readonly worldMessages: readonly EpochMessageRecord[];
  readonly regionMessages: readonly EpochMessageRecord[];
}

export function influenceChangesView(
  projection: EpochProjection,
  input: { regionId?: string; agentId?: string; limit?: number } = {},
) {
  const influenceIds = input.regionId
    ? projection.regionInfluenceIdsByRegion[input.regionId] || []
    : input.agentId
      ? projection.regionInfluenceIdsByAgent[input.agentId] || []
      : Object.keys(projection.regionInfluenceChanges);
  return influenceIds
    .map((influenceId) => projection.regionInfluenceChanges[influenceId])
    .filter(Boolean)
    .filter((change) => !input.agentId || change.agentId === input.agentId)
    .sort((left, right) => right.changedAt.localeCompare(left.changedAt) || left.influenceId.localeCompare(right.influenceId))
    .slice(0, Math.max(1, Math.min(Number(input.limit || 20), 100)));
}

export function regionActivitiesView(projection: EpochProjection, input: { regionId: string; limit?: number }) {
  return (projection.regionActivityIdsByRegion[input.regionId] || [])
    .map((activityId) => projection.regionActivities[activityId])
    .filter(Boolean)
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt) || right.activityId.localeCompare(left.activityId))
    .slice(0, Math.max(1, Math.min(Number(input.limit || 20), 100)));
}

export function messagesView(
  projection: EpochProjection,
  input: { regionId?: string; agentId?: string; limit?: number } = {},
): EpochMessagesInfo {
  const limit = Math.max(1, Math.min(Number(input.limit || 30), 100));
  const byAgent = (message: EpochMessageRecord) => !input.agentId || message.agentId === input.agentId;
  const visible = (message: EpochMessageRecord) => message.moderationStatus === "visible";
  const newestFirst = (left: EpochMessageRecord, right: EpochMessageRecord) =>
    right.postedAt.localeCompare(left.postedAt) || right.messageId.localeCompare(left.messageId);
  const regionMessages = input.regionId
    ? projection.regionMessages[input.regionId] || []
    : Object.values(projection.regionMessages).flat();
  return {
    regionId: input.regionId,
    agentId: input.agentId,
    worldMessages: projection.worldMessages.filter(visible).filter(byAgent).sort(newestFirst).slice(0, limit),
    regionMessages: regionMessages.filter(visible).filter(byAgent).sort(newestFirst).slice(0, limit),
  };
}

export function activeAgentsView(
  projection: EpochProjection,
  input: { regionId: string; limit?: number },
): readonly EpochRegionActiveAgent[] {
  const activities = new Map<string, EpochRegionActiveAgent["lastActivity"]>();
  const leaderboardOrder = new Map(
    regionLeaderboardView(projection, { regionId: input.regionId, limit: 100 })
      .map((entry, index) => [entry.agentId, index]),
  );
  const remember = (agentId: string | undefined, activity: EpochRegionActiveAgent["lastActivity"]) => {
    if (!agentId) return;
    const previous = activities.get(agentId);
    if (!previous || previous.occurredAt.localeCompare(activity.occurredAt) < 0) {
      activities.set(agentId, activity);
    }
  };

  for (const activity of regionActivitiesView(projection, { regionId: input.regionId, limit: 100 })) {
    remember(activity.agentId, {
      sourceEventType: activity.sourceEventType,
      sourceEventId: activity.sourceEventId,
      summary: activity.summary,
      occurredAt: activity.occurredAt,
    });
  }
  for (const change of influenceChangesView(projection, { regionId: input.regionId, limit: 100 })) {
    remember(change.agentId, {
      sourceEventType: change.sourceEventType,
      sourceEventId: change.sourceEventId,
      summary: `${change.sourceEventType} +${change.influenceDelta}`,
      occurredAt: change.changedAt,
    });
  }
  for (const message of messagesView(projection, { regionId: input.regionId, limit: 100 }).regionMessages) {
    remember(message.agentId, {
      sourceEventType: "message_posted",
      summary: message.body,
      occurredAt: message.postedAt,
    });
  }
  for (const downtime of Object.values(projection.downtime)) {
    if (downtime.regionId !== input.regionId || !downtime.active) continue;
    remember(downtime.agentId, {
      sourceEventType: "downtime_active",
      summary: downtime.mode,
      occurredAt: downtime.lastTickedAt || downtime.startedAt,
    });
  }

  const agents: EpochRegionActiveAgent[] = [];
  for (const [agentId, lastActivity] of activities) {
    const identity = projection.identities[agentId];
    if (!identity || identity.status !== "active") continue;
    const legend = projection.resourceBalances[agentId]?.legend || 0;
    agents.push({
      agentId,
      explorerId: identity.explorerId,
      identityName: identity.identityName,
      status: identity.status,
      generation: identity.generation,
      lifetimeRemaining: identity.lifetime.remaining,
      legend,
      resources: projection.resourceBalances[agentId] || {},
      lastActivity,
      publicPages: {
        agent: `/epoch/agent/${encodeURIComponent(agentId)}`,
        explorer: `/epoch/explorer/${encodeURIComponent(identity.explorerId)}`,
        ...(identity.lifetime.archivedAt ? { archive: `/epoch/archive/${encodeURIComponent(agentId)}` } : {}),
      },
    });
  }

  return agents
    .sort((left, right) =>
      right.lastActivity.occurredAt.localeCompare(left.lastActivity.occurredAt)
      || (leaderboardOrder.get(left.agentId) ?? Number.MAX_SAFE_INTEGER) - (leaderboardOrder.get(right.agentId) ?? Number.MAX_SAFE_INTEGER)
      || right.legend - left.legend
      || left.agentId.localeCompare(right.agentId))
    .slice(0, Math.max(1, Math.min(Number(input.limit || 12), 50)));
}
