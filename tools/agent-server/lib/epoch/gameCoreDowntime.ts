import type {
  EpochCommandContext,
  EpochClock,
  EpochIdFactory,
  EpochDowntimeMode,
  EpochResourceId,
} from "./protocol.ts";
import type { EpochEvent } from "./events.ts";
import {
  assertNonEmptyString,
  assertDowntimeMode,
  normalizeTrustClass,
  serverIsoTime,
} from "./protocol.ts";
import { eventFactory } from "./eventFactory.ts";
import {
  requireActiveIdentity,
  requireIdentity,
} from "./identityProjectionRules.ts";
import {
  assertIdentityOwner,
} from "./identityAuthorizationRules.ts";
import {
  normalizeDowntimeRegionId,
  planDowntimeSetEvents,
  planDowntimeClaimEvents,
  planDowntimeTickEvents,
  selectDowntimeTickAgentIds,
  projectDowntimeState,
  projectDowntimeTickResult,
  type EpochDowntimeState,
} from "./downtimeRules.ts";
import {
  buildDowntimeEligibilitySnapshot,
  buildDowntimeClaimEligibilitySnapshot,
  requireDowntimeSetEligibility,
  requireDowntimeClaimEligibility,
  requireDowntimeTickEligibility,
  type DowntimeRegionSafetyLevel,
} from "./downtimeEligibilityRules.ts";
import {
  currentBalance,
} from "./resourceRules.ts";

export interface SetDowntimeInput {
  readonly agentId: string;
  readonly mode: EpochDowntimeMode;
  readonly regionId?: string;
}

export interface ClaimDowntimeInput {
  readonly agentId: string;
}

export interface ChangeAgentCustodyInput {
  readonly agentId: string;
  readonly custodyStatus: "free" | "imprisoned";
  readonly reason?: string;
}

export interface TickDowntimeInput {
  readonly agentId?: string;
  readonly limit?: number;
}

export interface TickDowntimeResult {
  readonly tickedAt: string;
  readonly updated: readonly EpochDowntimeState[];
}

export interface GameCoreDowntimeContext<TProjection> {
  readonly projection: () => TProjection;
  readonly commit: <T>(events: readonly EpochEvent[], value: T) => { readonly events: readonly EpochEvent[]; readonly value: T; readonly projection: TProjection };
  readonly applyEvents: (projection: TProjection, events: readonly EpochEvent[]) => TProjection;
  readonly clock: EpochClock;
  readonly idFactory: EpochIdFactory;
  readonly maxDowntimeSeconds: number;
}

function requireServerTrust(context: EpochCommandContext, errorCode: string) {
  const trustClass = normalizeTrustClass(context.trustClass);
  if (trustClass === "untrusted_client") throw new Error(errorCode);
  return trustClass;
}

export function createDowntimeCommands<
  TProjection extends
    { readonly identities: Readonly<Record<string, { readonly agentId: string; readonly status: "active" | "archived"; readonly explorerId: string } | undefined>> } &
    { readonly agentCustody: Readonly<Record<string, { readonly agentId: string; readonly custodyStatus: "free" | "imprisoned" } | undefined>> } &
    { readonly downtime: Readonly<Record<string, EpochDowntimeState | undefined>> } &
    { readonly anomalyEventIdsByRegion: Readonly<Record<string, readonly string[] | undefined>> } &
    { readonly anomalyEvents: Readonly<Record<string, { readonly status: string; readonly severity: string } | undefined>> } &
    { readonly objectiveIdsByRegion: Readonly<Record<string, readonly string[] | undefined>> } &
    { readonly contestedObjectives: Readonly<Record<string, { readonly status: string } | undefined>> } &
    { readonly resourceNodeIdsByRegion: Readonly<Record<string, readonly string[] | undefined>> } &
    { readonly resourceNodes: Readonly<Record<string, { readonly status: string } | undefined>> } &
    { readonly resourceBalances: Readonly<Record<string, Partial<Record<EpochResourceId, number>>>> } &
    { readonly turnCards: Readonly<Record<string, { readonly agentId: string; readonly status: "open" | "resolved" } | undefined>> } &
    { readonly hostedSessions: Readonly<Record<string, { readonly agentId: string; readonly status: "active" | "completed" } | undefined>> } &
    { readonly partyRuns: Readonly<Record<string, { readonly leaderAgentId: string; readonly status: "open" | "settled"; readonly members: ReadonlyArray<{ readonly agentId: string }> } | undefined>> },
>(
  ctx: GameCoreDowntimeContext<TProjection>,
) {
  function downtimeRegionSafety(current: TProjection, regionId: string): DowntimeRegionSafetyLevel {
    const openAnomalies = (current.anomalyEventIdsByRegion[regionId] || [])
      .map((anomalyId) => current.anomalyEvents[anomalyId])
      .filter((anomaly) => anomaly?.status === "open");
    if (openAnomalies.some((anomaly) => anomaly?.severity === "major" || anomaly?.severity === "cataclysm")) {
      return "hazardous";
    }
    if (openAnomalies.length) return "unstable";
    const hasOpenContest = (current.objectiveIdsByRegion[regionId] || [])
      .some((objectiveId) => current.contestedObjectives[objectiveId]?.status === "active")
      || (current.resourceNodeIdsByRegion[regionId] || [])
        .some((nodeId) => current.resourceNodes[nodeId]?.status === "open");
    if (hasOpenContest) return "guarded";
    return "secure";
  }

  function downtimeEligibilityProjection(current: TProjection, agentId: string, regionId: string) {
    return {
      ...current,
      downtimeAgentStatuses: {
        [agentId]: current.agentCustody[agentId],
      },
      regionSafetyStates: {
        [regionId]: { level: downtimeRegionSafety(current, regionId) },
      },
    };
  }

  function changeAgentCustody(
    input: ChangeAgentCustodyInput,
    context: EpochCommandContext,
  ) {
    const trustClass = requireServerTrust(context, "agent_custody_requires_server_trust");
    const current = ctx.projection();
    const agentId = assertNonEmptyString(input.agentId, "agent_id");
    requireIdentity(current, agentId);
    const custodyStatus = input.custodyStatus;
    if (custodyStatus !== "free" && custodyStatus !== "imprisoned") {
      throw new Error("agent_custody_status_invalid");
    }
    const changedAt = serverIsoTime(ctx.clock);
    const changed = eventFactory(ctx.clock, ctx.idFactory, { ...context, trustClass })("agent_custody_changed", agentId, {
      agentId,
      custodyStatus,
      reason: input.reason?.trim() || `custody_${custodyStatus}`,
      changedAt,
    }, { agentId });
    const nextProjection = ctx.applyEvents(current, [changed]);
    return ctx.commit([changed], nextProjection.agentCustody[agentId]);
  }

  function setDowntime(input: SetDowntimeInput, context: EpochCommandContext) {
    const current = ctx.projection();
    const agentId = assertNonEmptyString(input.agentId, "agent_id");
    const identity = requireActiveIdentity(current, agentId);
    assertIdentityOwner(identity, context, "downtime_owner_mismatch");
    const mode = assertDowntimeMode(input.mode);
    const regionId = normalizeDowntimeRegionId(input.regionId);
    const startedAt = serverIsoTime(ctx.clock);
    requireDowntimeSetEligibility({
      snapshot: buildDowntimeEligibilitySnapshot({
        projection: downtimeEligibilityProjection(current, agentId, regionId),
        agentId,
        regionId,
      }),
      mode,
      serverNow: startedAt,
    });
    const makeEvent = eventFactory(ctx.clock, ctx.idFactory, context);
    const nextEvents = planDowntimeSetEvents({
      agentId,
      mode,
      regionId,
      startedAt,
      makeEvent,
    });
    const nextProjection = ctx.applyEvents(current, nextEvents);
    return ctx.commit(nextEvents, projectDowntimeState({
      events: nextEvents,
      projection: nextProjection,
      agentId,
    }));
  }

  function claimDowntime(input: ClaimDowntimeInput, context: EpochCommandContext) {
    const current = ctx.projection();
    const agentId = assertNonEmptyString(input.agentId, "agent_id");
    const identity = requireActiveIdentity(current, agentId);
    assertIdentityOwner(identity, context, "downtime_owner_mismatch");
    const currentDowntime = current.downtime[agentId];
    if (!currentDowntime?.active) throw new Error("downtime_not_active");
    const claimedAt = serverIsoTime(ctx.clock);
    requireDowntimeClaimEligibility({
      snapshot: buildDowntimeClaimEligibilitySnapshot({
        projection: downtimeEligibilityProjection(current, agentId, currentDowntime.regionId),
        agentId,
      }),
      serverNow: claimedAt,
    });
    const makeEvent = eventFactory(ctx.clock, ctx.idFactory, context);
    const nextEvents = planDowntimeClaimEvents({
      agentId,
      downtime: currentDowntime,
      claimedAt,
      maxDowntimeSeconds: ctx.maxDowntimeSeconds,
      balanceBefore: (plannedGrantEvents: readonly EpochEvent[], targetAgentId: string, resourceId: EpochResourceId) =>
        currentBalance(ctx.applyEvents(current, plannedGrantEvents), targetAgentId, resourceId),
      makeEvent,
    });
    const nextProjection = ctx.applyEvents(current, nextEvents);
    return ctx.commit(nextEvents, projectDowntimeState({
      events: nextEvents,
      projection: nextProjection,
      agentId,
    }));
  }

  function tickDowntime(input: TickDowntimeInput, context: EpochCommandContext) {
    const trustClass = requireServerTrust(context, "downtime_tick_requires_server_trust");
    const current = ctx.projection();
    const tickedAt = serverIsoTime(ctx.clock);
    const agentIds = input.agentId
      ? [assertNonEmptyString(input.agentId, "agent_id")]
      : selectDowntimeTickAgentIds(current.downtime, input.limit);
    const makeEvent = eventFactory(ctx.clock, ctx.idFactory, { ...context, trustClass });
    const targets: Array<{ agentId: string; downtime: EpochDowntimeState }> = [];
    for (const agentId of agentIds) {
      requireActiveIdentity(current, agentId);
      const currentDowntime = current.downtime[agentId];
      if (!currentDowntime?.active) continue;
      try {
        requireDowntimeTickEligibility({
          snapshot: buildDowntimeClaimEligibilitySnapshot({
            projection: downtimeEligibilityProjection(current, agentId, currentDowntime.regionId),
            agentId,
          }),
        });
      } catch (error) {
        if (input.agentId) throw error;
        continue;
      }
      targets.push({ agentId, downtime: currentDowntime });
    }
    const nextEvents = planDowntimeTickEvents({
      targets,
      tickedAt,
      maxDowntimeSeconds: ctx.maxDowntimeSeconds,
      balanceBefore: (plannedGrantEvents: readonly EpochEvent[], targetAgentId: string, resourceId: EpochResourceId) =>
        currentBalance(ctx.applyEvents(current, plannedGrantEvents), targetAgentId, resourceId),
      makeEvent,
    });
    const nextProjection = ctx.applyEvents(current, nextEvents);
    const result = projectDowntimeTickResult({
      agentIds,
      tickedAt,
      projection: nextProjection,
    });
    if (input.agentId && result.updated.length === 0) throw new Error("downtime_not_active");
    return ctx.commit(nextEvents, result);
  }

  return {
    changeAgentCustody,
    setDowntime,
    claimDowntime,
    tickDowntime,
  };
}
