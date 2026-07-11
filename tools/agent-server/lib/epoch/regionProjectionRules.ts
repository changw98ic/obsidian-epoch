export interface RegionInfluenceChangeForProjectionRules {
  readonly regionId: string;
  readonly influenceDelta: number;
}

export interface RegionProjectionForRules<
  TRegionInfluenceChange extends RegionInfluenceChangeForProjectionRules = RegionInfluenceChangeForProjectionRules,
> {
  readonly regionInfluenceIdsByAgent: Readonly<Record<string, readonly string[]>>;
  readonly regionInfluenceChanges: Readonly<Record<string, TRegionInfluenceChange | undefined>>;
  readonly traceIdsByRegion: Readonly<Record<string, readonly string[]>>;
}

export function currentRegionInfluenceScore(
  projection: Pick<RegionProjectionForRules, "regionInfluenceIdsByAgent" | "regionInfluenceChanges">,
  regionId: string,
  agentId: string,
): number {
  return (projection.regionInfluenceIdsByAgent[agentId] || [])
    .map((influenceId) => projection.regionInfluenceChanges[influenceId])
    .filter((change): change is RegionInfluenceChangeForProjectionRules => {
      if (!change) return false;
      return change.regionId === regionId;
    })
    .reduce((total, change) => total + change.influenceDelta, 0);
}

export function latestTraceIdForRegion(
  projection: Pick<RegionProjectionForRules, "traceIdsByRegion">,
  regionId: string,
): string | undefined {
  return (projection.traceIdsByRegion[regionId] || []).at(-1);
}
