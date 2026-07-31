import {
  RAID_PAIR_COOLDOWN_SECONDS,
  type EpochOrganizationMembership,
  type EpochProjection,
  type EpochRaidResult,
  type EpochRegionControl,
} from "./gameCore.ts";

export interface EpochRaidInfo {
  readonly regionId?: string;
  readonly raids: readonly EpochRaidResult[];
}

export type EpochRegionRaidHeatStatus = "quiet" | "warm" | "hot";

export interface EpochRegionRaidHeat {
  readonly regionId: string;
  readonly heatScore: number;
  readonly recentRaidCount: number;
  readonly activePairCount: number;
  readonly repeatRaidCount: number;
  readonly status: EpochRegionRaidHeatStatus;
  readonly latestRaidId?: string;
  readonly latestRaidAt?: string;
}

export interface EpochRegionEligibleRaidTarget {
  readonly eligibilityId: string;
  readonly regionId: string;
  readonly attackerAgentId: string;
  readonly attackerExplorerId: string;
  readonly attackerFactionId: string;
  readonly targetAgentId: string;
  readonly targetExplorerId: string;
  readonly targetFactionId: string;
  readonly targetSeasonScore: number;
  readonly targetDefensePower: number;
  readonly sourceSeasonIds: readonly string[];
  readonly latestPairRaidId?: string;
  readonly latestPairRaidAt?: string;
}

export type EpochRegionFactionPressureStatus = "controlling" | "challenging" | "active";

export interface EpochRegionFactionPressure {
  readonly regionId: string;
  readonly factionId: string;
  readonly pressureScore: number;
  readonly seasonScore: number;
  readonly raidPressure: number;
  readonly activeRaidCount: number;
  readonly controlStatus: EpochRegionFactionPressureStatus;
  readonly agentIds: readonly string[];
  readonly sourceSeasonIds: readonly string[];
  readonly latestRaidId?: string;
  readonly latestRaidAt?: string;
}

export type EpochRegionFrontlineStatus = "attacker_advancing" | "defender_holding" | "contested";

export interface EpochRegionFrontline {
  readonly frontlineId: string;
  readonly regionId: string;
  readonly attackerAgentId: string;
  readonly attackerExplorerId: string;
  readonly defenderAgentId: string;
  readonly defenderExplorerId: string;
  readonly attackerSideAgentIds: readonly string[];
  readonly defenderSideAgentIds: readonly string[];
  readonly attackerPressure: number;
  readonly defenderPressure: number;
  readonly pressureDelta: number;
  readonly status: EpochRegionFrontlineStatus;
  readonly latestRaidId: string;
  readonly latestTraceId?: string;
  readonly latestEventAt: string;
  readonly openRetaliationIds: readonly string[];
}

export function tracesView(projection: EpochProjection, input: { regionId?: string; agentId?: string; limit?: number } = {}) {
  const traceIds = input.regionId
    ? projection.traceIdsByRegion[input.regionId] || []
    : input.agentId
      ? projection.traceIdsByAgent[input.agentId] || []
      : Object.keys(projection.conflictTraces);
  return traceIds
    .map((traceId) => projection.conflictTraces[traceId])
    .filter(Boolean)
    .filter((trace) => !input.agentId || trace.participantAgentIds.includes(input.agentId))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt) || left.traceId.localeCompare(right.traceId))
    .slice(0, Math.max(1, Math.min(Number(input.limit || 20), 100)));
}

export function raidsView(projection: EpochProjection, input: { regionId?: string; agentId?: string } = {}) {
  const raidIds = input.regionId
    ? projection.raidIdsByRegion[input.regionId] || []
    : Object.keys(projection.raidResults);
  return raidIds
    .map((raidId) => projection.raidResults[raidId])
    .filter(Boolean)
    .filter((raid) => !input.agentId || raid.attackerAgentId === input.agentId || raid.defenderAgentId === input.agentId)
    .sort((left, right) => right.resolvedAt.localeCompare(left.resolvedAt));
}

function raidPairKey(raid: EpochRaidResult): string {
  return [raid.attackerAgentId, raid.defenderAgentId].sort((left, right) => left.localeCompare(right)).join(":");
}

function regionRaidHeatStatus(heatScore: number): EpochRegionRaidHeatStatus {
  if (heatScore <= 0) return "quiet";
  if (heatScore >= 3) return "hot";
  return "warm";
}

export function regionRaidHeatView(projection: EpochProjection, input: { regionId: string }): EpochRegionRaidHeat {
  const raids = raidsView(projection, { regionId: input.regionId });
  const latestRaid = raids[0];
  if (!latestRaid) {
    return {
      regionId: input.regionId,
      heatScore: 0,
      recentRaidCount: 0,
      activePairCount: 0,
      repeatRaidCount: 0,
      status: "quiet",
    };
  }
  const recentWindowStartMs = Date.parse(latestRaid.resolvedAt) - 86_400_000;
  const recentRaids = raids.filter((raid) => Date.parse(raid.resolvedAt) >= recentWindowStartMs);
  const activePairs = new Set(recentRaids.map(raidPairKey));
  const repeatRaidCount = recentRaids.filter((raid) => raid.reward.reason === "raid_repeat_reward_decayed").length;
  const heatScore = recentRaids.length + repeatRaidCount;
  return {
    regionId: input.regionId,
    heatScore,
    recentRaidCount: recentRaids.length,
    activePairCount: activePairs.size,
    repeatRaidCount,
    status: regionRaidHeatStatus(heatScore),
    latestRaidId: latestRaid.raidId,
    latestRaidAt: latestRaid.resolvedAt,
  };
}

type RegionRaidCandidateAgent = {
  agentId: string;
  explorerId: string;
  factionId: string;
  seasonScore: number;
  sourceSeasonIds: readonly string[];
};

function agentFactionIdForRegion(
  projection: EpochProjection,
  input: { regionId: string; agentId: string },
): string | undefined {
  let selected:
    | { factionId: string; score: number; seasonCreatedAt: string; seasonId: string }
    | undefined;
  for (const seasonId of projection.seasonCampaignIdsByRegion[input.regionId] || []) {
    const season = projection.seasonCampaigns[seasonId];
    if (!season) continue;
    for (const standing of season.agentStandings) {
      if (standing.agentId !== input.agentId || standing.score <= 0) continue;
      if (
        !selected
        || standing.score > selected.score
        || (
          standing.score === selected.score
          && (
            season.createdAt > selected.seasonCreatedAt
            || (season.createdAt === selected.seasonCreatedAt && season.seasonId > selected.seasonId)
          )
        )
      ) {
        selected = {
          factionId: standing.factionId,
          score: standing.score,
          seasonCreatedAt: season.createdAt,
          seasonId: season.seasonId,
        };
      }
    }
  }
  return selected?.factionId;
}

function regionRaidCandidateAgents(projection: EpochProjection, regionId: string): RegionRaidCandidateAgent[] {
  const candidates = new Map<string, {
    agentId: string;
    explorerId: string;
    factionId: string;
    seasonScore: number;
    sourceSeasonIds: Set<string>;
  }>();
  for (const seasonId of projection.seasonCampaignIdsByRegion[regionId] || []) {
    const season = projection.seasonCampaigns[seasonId];
    if (!season) continue;
    for (const standing of season.agentStandings) {
      if (standing.score <= 0) continue;
      const identity = projection.identities[standing.agentId];
      if (!identity || identity.status !== "active") continue;
      const factionId = agentFactionIdForRegion(projection, { regionId, agentId: standing.agentId });
      if (!factionId || standing.factionId !== factionId) continue;
      const existing = candidates.get(standing.agentId) || {
        agentId: standing.agentId,
        explorerId: identity.explorerId,
        factionId,
        seasonScore: 0,
        sourceSeasonIds: new Set<string>(),
      };
      existing.seasonScore += standing.score;
      existing.sourceSeasonIds.add(season.seasonId);
      candidates.set(standing.agentId, existing);
    }
  }
  return [...candidates.values()]
    .map((candidate) => ({
      agentId: candidate.agentId,
      explorerId: candidate.explorerId,
      factionId: candidate.factionId,
      seasonScore: candidate.seasonScore,
      sourceSeasonIds: [...candidate.sourceSeasonIds].sort(),
    }))
    .sort((left, right) =>
      right.seasonScore - left.seasonScore
      || left.agentId.localeCompare(right.agentId));
}

function latestRaidPairView(
  projection: EpochProjection,
  input: { regionId: string; attackerAgentId: string; targetAgentId: string },
): EpochRaidResult | undefined {
  return raidsView(projection, { regionId: input.regionId })
    .find((raid) => {
      const sameDirection = raid.attackerAgentId === input.attackerAgentId && raid.defenderAgentId === input.targetAgentId;
      const reverseDirection = raid.attackerAgentId === input.targetAgentId && raid.defenderAgentId === input.attackerAgentId;
      return sameDirection || reverseDirection;
    });
}

function raidPairCooldownActive(latestPairRaid: EpochRaidResult | undefined, nowIso: string): boolean {
  if (!latestPairRaid) return false;
  const elapsedSeconds = Math.floor((Date.parse(nowIso) - Date.parse(latestPairRaid.resolvedAt)) / 1_000);
  return elapsedSeconds < RAID_PAIR_COOLDOWN_SECONDS;
}

export function regionEligibleRaidTargetsView(
  projection: EpochProjection,
  input: { regionId: string; attackerAgentId?: string; limit?: number; nowIso: string },
): EpochRegionEligibleRaidTarget[] {
  const limit = Math.max(1, Math.min(Number(input.limit || 8), 20));
  const candidates = regionRaidCandidateAgents(projection, input.regionId);
  const attackers = input.attackerAgentId
    ? candidates.filter((candidate) => candidate.agentId === input.attackerAgentId)
    : candidates;
  const targets: EpochRegionEligibleRaidTarget[] = [];
  for (const attacker of attackers) {
    for (const target of candidates) {
      if (attacker.agentId === target.agentId) continue;
      if (attacker.explorerId === target.explorerId) continue;
      if (attacker.factionId === target.factionId) continue;
      const latestPairRaid = latestRaidPairView(projection, {
        regionId: input.regionId,
        attackerAgentId: attacker.agentId,
        targetAgentId: target.agentId,
      });
      if (raidPairCooldownActive(latestPairRaid, input.nowIso)) continue;
      const targetBalances = projection.resourceBalances[target.agentId] || {};
      const targetDefensePower = ((targetBalances.focus || 0) * 3) + (targetBalances.legend || 0);
      targets.push({
        eligibilityId: `${input.regionId}:${attacker.agentId}:${target.agentId}`,
        regionId: input.regionId,
        attackerAgentId: attacker.agentId,
        attackerExplorerId: attacker.explorerId,
        attackerFactionId: attacker.factionId,
        targetAgentId: target.agentId,
        targetExplorerId: target.explorerId,
        targetFactionId: target.factionId,
        targetSeasonScore: target.seasonScore,
        targetDefensePower,
        sourceSeasonIds: [...new Set([...attacker.sourceSeasonIds, ...target.sourceSeasonIds])].sort(),
        latestPairRaidId: latestPairRaid?.raidId,
        latestPairRaidAt: latestPairRaid?.resolvedAt,
      });
    }
  }
  return targets
    .sort((left, right) =>
      left.attackerAgentId.localeCompare(right.attackerAgentId)
      || left.targetAgentId.localeCompare(right.targetAgentId))
    .slice(0, limit);
}

type MutableRegionFactionPressure = {
  regionId: string;
  factionId: string;
  seasonScore: number;
  raidPressure: number;
  activeRaidCount: number;
  agentIds: Set<string>;
  sourceSeasonIds: Set<string>;
  latestRaidId?: string;
  latestRaidAt?: string;
};

function ensureRegionFactionPressureEntry(
  entries: Map<string, MutableRegionFactionPressure>,
  input: { regionId: string; factionId: string },
): MutableRegionFactionPressure {
  const existing = entries.get(input.factionId);
  if (existing) return existing;
  const entry: MutableRegionFactionPressure = {
    regionId: input.regionId,
    factionId: input.factionId,
    seasonScore: 0,
    raidPressure: 0,
    activeRaidCount: 0,
    agentIds: new Set(),
    sourceSeasonIds: new Set(),
  };
  entries.set(input.factionId, entry);
  return entry;
}

function regionFactionPressureStatus(
  regionControl: EpochRegionControl | undefined,
  entry: MutableRegionFactionPressure,
): EpochRegionFactionPressureStatus {
  if (regionControl?.controllingFactionId === entry.factionId) return "controlling";
  if (
    regionControl?.contestedByFactionId === entry.factionId
    || (Boolean(regionControl) && entry.raidPressure > 0)
  ) {
    return "challenging";
  }
  return "active";
}

export function regionFactionPressureView(projection: EpochProjection, input: { regionId: string }): EpochRegionFactionPressure[] {
  const entries = new Map<string, MutableRegionFactionPressure>();
  const seasonIds = projection.seasonCampaignIdsByRegion[input.regionId] || [];
  for (const seasonId of seasonIds) {
    const season = projection.seasonCampaigns[seasonId];
    if (!season) continue;
    for (const factionId of season.factionIds) {
      const entry = ensureRegionFactionPressureEntry(entries, { regionId: input.regionId, factionId });
      entry.sourceSeasonIds.add(season.seasonId);
    }
    for (const standing of season.factionStandings) {
      const entry = ensureRegionFactionPressureEntry(entries, {
        regionId: input.regionId,
        factionId: standing.factionId,
      });
      entry.seasonScore += standing.score;
      entry.sourceSeasonIds.add(season.seasonId);
    }
    for (const standing of season.agentStandings) {
      if (standing.score <= 0) continue;
      const entry = ensureRegionFactionPressureEntry(entries, {
        regionId: input.regionId,
        factionId: standing.factionId,
      });
      entry.agentIds.add(standing.agentId);
      entry.sourceSeasonIds.add(season.seasonId);
    }
  }

  const regionControl = projection.regionControls[input.regionId];
  if (regionControl) {
    ensureRegionFactionPressureEntry(entries, {
      regionId: input.regionId,
      factionId: regionControl.controllingFactionId,
    });
    if (regionControl.contestedByFactionId) {
      ensureRegionFactionPressureEntry(entries, {
        regionId: input.regionId,
        factionId: regionControl.contestedByFactionId,
      });
    }
  }

  const raids = raidsView(projection, { regionId: input.regionId });
  const latestRaid = raids[0];
  const recentWindowStartMs = latestRaid ? Date.parse(latestRaid.resolvedAt) - 86_400_000 : undefined;
  const recentRaids = typeof recentWindowStartMs === "number"
    ? raids.filter((raid) => Date.parse(raid.resolvedAt) >= recentWindowStartMs)
    : [];
  for (const raid of recentRaids) {
    const winnerAgentId = raid.outcome === "attacker_won" ? raid.attackerAgentId : raid.defenderAgentId;
    const winnerFactionId = agentFactionIdForRegion(projection, { regionId: input.regionId, agentId: winnerAgentId });
    if (!winnerFactionId) continue;
    const entry = ensureRegionFactionPressureEntry(entries, {
      regionId: input.regionId,
      factionId: winnerFactionId,
    });
    entry.raidPressure += 8;
    entry.activeRaidCount += 1;
    entry.agentIds.add(winnerAgentId);
    if (!entry.latestRaidAt || raid.resolvedAt >= entry.latestRaidAt) {
      entry.latestRaidId = raid.raidId;
      entry.latestRaidAt = raid.resolvedAt;
    }
  }

  const statusRank: Record<EpochRegionFactionPressureStatus, number> = {
    controlling: 0,
    challenging: 1,
    active: 2,
  };
  return [...entries.values()]
    .map((entry) => {
      const controlStatus = regionFactionPressureStatus(regionControl, entry);
      return {
        regionId: entry.regionId,
        factionId: entry.factionId,
        pressureScore: entry.seasonScore + entry.raidPressure,
        seasonScore: entry.seasonScore,
        raidPressure: entry.raidPressure,
        activeRaidCount: entry.activeRaidCount,
        controlStatus,
        agentIds: [...entry.agentIds].sort(),
        sourceSeasonIds: [...entry.sourceSeasonIds].sort(),
        latestRaidId: entry.latestRaidId,
        latestRaidAt: entry.latestRaidAt,
      } satisfies EpochRegionFactionPressure;
    })
    .sort((left, right) =>
      right.pressureScore - left.pressureScore
      || statusRank[left.controlStatus] - statusRank[right.controlStatus]
      || left.factionId.localeCompare(right.factionId));
}

export function retaliationsView(projection: EpochProjection, input: { regionId?: string; agentId?: string; status?: string } = {}) {
  const retaliationIds = input.regionId
    ? projection.retaliationIdsByRegion[input.regionId] || []
    : input.agentId
      ? projection.retaliationIdsByAgent[input.agentId] || []
      : Object.keys(projection.retaliationOpportunities);
  return retaliationIds
    .map((retaliationId) => projection.retaliationOpportunities[retaliationId])
    .filter(Boolean)
    .filter((retaliation) => !input.agentId || retaliation.opportunityAgentId === input.agentId || retaliation.targetAgentId === input.agentId)
    .filter((retaliation) => !input.status || retaliation.status === input.status)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt) || left.retaliationId.localeCompare(right.retaliationId));
}

function alliedAgentIds(projection: EpochProjection, agentId: string): string[] {
  const allies = new Set<string>([agentId]);
  for (const relationship of Object.values(projection.relationshipEdges)) {
    if (relationship.kind !== "alliance" || relationship.score <= 0) continue;
    if (relationship.sourceAgentId === agentId) allies.add(relationship.targetAgentId);
    if (relationship.targetAgentId === agentId) allies.add(relationship.sourceAgentId);
  }
  return [...allies].sort((left, right) => {
    if (left === agentId) return -1;
    if (right === agentId) return 1;
    return left.localeCompare(right);
  });
}

function organizationSideAgentIds(projection: EpochProjection, agentId: string, regionId: string): string[] {
  const activeOrganizationIds = (projection.organizationMembershipIdsByAgent[agentId] || [])
    .map((membershipId) => projection.organizationMemberships[membershipId])
    .filter((membership): membership is EpochOrganizationMembership =>
      Boolean(membership)
      && membership.memberType === "agent"
      && membership.agentId === agentId
      && membership.status === "active"
      && membership.regionId === regionId)
    .map((membership) => membership.organizationId);
  if (!activeOrganizationIds.length) return [];
  const organizationIds = new Set(activeOrganizationIds);
  const sideAgentIds = new Set<string>([agentId]);
  for (const organizationId of organizationIds) {
    for (const membershipId of projection.organizationMembershipIdsByOrganization[organizationId] || []) {
      const membership = projection.organizationMemberships[membershipId];
      if (
        membership?.memberType === "agent"
        && membership.status === "active"
        && membership.agentId
        && membership.regionId === regionId
      ) {
        sideAgentIds.add(membership.agentId);
      }
    }
  }
  return [...sideAgentIds].sort((left, right) => {
    if (left === agentId) return -1;
    if (right === agentId) return 1;
    return left.localeCompare(right);
  });
}

function frontlineSideAgentIds(projection: EpochProjection, agentId: string, regionId: string): string[] {
  const organizationSide = organizationSideAgentIds(projection, agentId, regionId);
  return organizationSide.length ? organizationSide : alliedAgentIds(projection, agentId);
}

function sortWithPrimaryAgent(agentIds: readonly string[], primaryAgentId: string): string[] {
  return [...new Set(agentIds)].sort((left, right) => {
    if (left === primaryAgentId) return -1;
    if (right === primaryAgentId) return 1;
    return left.localeCompare(right);
  });
}

function disjointFrontlineSideAgentIds(input: {
  attackerAgentId: string;
  defenderAgentId: string;
  attackerSideAgentIds: readonly string[];
  defenderSideAgentIds: readonly string[];
}): { attackerSideAgentIds: string[]; defenderSideAgentIds: string[] } {
  const attackerSideAgentIds = new Set(input.attackerSideAgentIds);
  const defenderSideAgentIds = new Set(input.defenderSideAgentIds);
  attackerSideAgentIds.add(input.attackerAgentId);
  defenderSideAgentIds.add(input.defenderAgentId);
  attackerSideAgentIds.delete(input.defenderAgentId);
  defenderSideAgentIds.delete(input.attackerAgentId);
  for (const agentId of attackerSideAgentIds) {
    if (agentId !== input.attackerAgentId) defenderSideAgentIds.delete(agentId);
  }
  return {
    attackerSideAgentIds: sortWithPrimaryAgent([...attackerSideAgentIds], input.attackerAgentId),
    defenderSideAgentIds: sortWithPrimaryAgent([...defenderSideAgentIds], input.defenderAgentId),
  };
}

function regionFrontlineStatus(attackerPressure: number, defenderPressure: number): EpochRegionFrontlineStatus {
  if (attackerPressure > defenderPressure) return "attacker_advancing";
  if (defenderPressure > attackerPressure) return "defender_holding";
  return "contested";
}

export function regionFrontlinesView(projection: EpochProjection, input: { regionId: string; limit?: number }): EpochRegionFrontline[] {
  const limit = Math.max(1, Math.min(Number(input.limit || 8), 20));
  const frontlines = new Map<string, {
    pressureByAgent: Record<string, number>;
    latestRaid: EpochRaidResult;
  }>();
  for (const raid of raidsView(projection, { regionId: input.regionId })) {
    const pairKey = [raid.attackerAgentId, raid.defenderAgentId].sort((left, right) => left.localeCompare(right)).join(":");
    const existing = frontlines.get(pairKey);
    const winnerAgentId = raid.outcome === "attacker_won" ? raid.attackerAgentId : raid.defenderAgentId;
    const next = existing || {
      pressureByAgent: {},
      latestRaid: raid,
    };
    next.pressureByAgent[winnerAgentId] = (next.pressureByAgent[winnerAgentId] || 0) + 8;
    if (raid.resolvedAt >= next.latestRaid.resolvedAt) next.latestRaid = raid;
    frontlines.set(pairKey, next);
  }
  return [...frontlines.values()]
    .map((frontline) => {
      const latestRaid = frontline.latestRaid;
      const latestTrace = tracesView(projection, { regionId: latestRaid.regionId, limit: 20 })
        .find((trace) => trace.sourceAggregateId === latestRaid.raidId);
      const openRetaliationIds = retaliationsView(projection, { regionId: latestRaid.regionId, status: "open" })
        .filter((retaliation) => retaliation.sourceRaidId === latestRaid.raidId)
        .map((retaliation) => retaliation.retaliationId);
      const attackerPressure = frontline.pressureByAgent[latestRaid.attackerAgentId] || 0;
      const defenderPressure = frontline.pressureByAgent[latestRaid.defenderAgentId] || 0;
      const sideAgentIds = disjointFrontlineSideAgentIds({
        attackerAgentId: latestRaid.attackerAgentId,
        defenderAgentId: latestRaid.defenderAgentId,
        attackerSideAgentIds: frontlineSideAgentIds(projection, latestRaid.attackerAgentId, latestRaid.regionId),
        defenderSideAgentIds: frontlineSideAgentIds(projection, latestRaid.defenderAgentId, latestRaid.regionId),
      });
      return {
        frontlineId: `${latestRaid.regionId}:${latestRaid.attackerAgentId}:${latestRaid.defenderAgentId}`,
        regionId: latestRaid.regionId,
        attackerAgentId: latestRaid.attackerAgentId,
        attackerExplorerId: latestRaid.attackerExplorerId,
        defenderAgentId: latestRaid.defenderAgentId,
        defenderExplorerId: latestRaid.defenderExplorerId,
        attackerSideAgentIds: sideAgentIds.attackerSideAgentIds,
        defenderSideAgentIds: sideAgentIds.defenderSideAgentIds,
        attackerPressure,
        defenderPressure,
        pressureDelta: Math.abs(attackerPressure - defenderPressure),
        status: regionFrontlineStatus(attackerPressure, defenderPressure),
        latestRaidId: latestRaid.raidId,
        latestTraceId: latestTrace?.traceId,
        latestEventAt: latestRaid.resolvedAt,
        openRetaliationIds,
      } satisfies EpochRegionFrontline;
    })
    .sort((left, right) =>
      right.latestEventAt.localeCompare(left.latestEventAt)
      || right.pressureDelta - left.pressureDelta
      || left.frontlineId.localeCompare(right.frontlineId))
    .slice(0, limit);
}
