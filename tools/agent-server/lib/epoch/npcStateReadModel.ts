import type {
  EpochNpcAssetState,
  EpochNpcCareerRecord,
  EpochNpcHealthState,
  EpochNpcLocationRecord,
  EpochProjection,
} from "./gameCore.ts";
import { npcDisplayName } from "./relationshipReadModel.ts";

export interface EpochNpcCareerView extends EpochNpcCareerRecord {
  readonly npcDisplayName: string;
  readonly summary: string;
}

export interface EpochNpcLocationView extends EpochNpcLocationRecord {
  readonly npcDisplayName: string;
  readonly summary: string;
}

export interface EpochNpcAssetStateView extends EpochNpcAssetState {
  readonly npcDisplayName: string;
  readonly summary: string;
}

export interface EpochNpcHealthStateView extends EpochNpcHealthState {
  readonly npcDisplayName: string;
  readonly summary: string;
}

export function npcMemoriesView(
  projection: EpochProjection,
  input: { regionId?: string; npcId?: string } = {},
) {
  const memoryIds = input.npcId
    ? projection.npcMemoryIdsByNpc[input.npcId] || []
    : input.regionId
      ? projection.npcMemoryIdsByRegion[input.regionId] || []
      : Object.keys(projection.npcMemories);
  return memoryIds
    .map((memoryId) => projection.npcMemories[memoryId])
    .filter(Boolean)
    .sort((left, right) => right.recordedAt.localeCompare(left.recordedAt) || left.memoryId.localeCompare(right.memoryId));
}

export function withNpcCareerSummary(projection: EpochProjection, career: EpochNpcCareerRecord): EpochNpcCareerView {
  const npcName = npcDisplayName(projection, career.npcId);
  return {
    ...career,
    npcDisplayName: npcName,
    summary: `${npcName} 的职业更新为 ${career.title}（${career.status}）。`,
  };
}

export function withNpcLocationSummary(projection: EpochProjection, location: EpochNpcLocationRecord): EpochNpcLocationView {
  const npcName = npcDisplayName(projection, location.npcId);
  return {
    ...location,
    npcDisplayName: npcName,
    summary: `${npcName} 从 ${location.fromRegionId} 迁徙至 ${location.toRegionId}。`,
  };
}

export function withNpcAssetSummary(projection: EpochProjection, asset: EpochNpcAssetState): EpochNpcAssetStateView {
  const npcName = npcDisplayName(projection, asset.npcId);
  const direction = asset.delta >= 0 ? "增加" : "减少";
  return {
    ...asset,
    npcDisplayName: npcName,
    summary: `${npcName} 的资产 ${asset.assetKey} ${direction} ${Math.abs(asset.delta)}，当前 ${asset.balanceAfter}。`,
  };
}

export function withNpcHealthSummary(projection: EpochProjection, health: EpochNpcHealthState): EpochNpcHealthStateView {
  const npcName = npcDisplayName(projection, health.npcId);
  return {
    ...health,
    npcDisplayName: npcName,
    summary: `${npcName} 的健康变为 ${health.status}（${health.severity}）。`,
  };
}

export function npcCareersView(
  projection: EpochProjection,
  input: { regionId?: string; npcId?: string } = {},
): readonly EpochNpcCareerView[] {
  const careerIds = input.npcId
    ? projection.npcCareerIdsByNpc[input.npcId] || []
    : input.regionId
      ? projection.npcCareerIdsByRegion[input.regionId] || []
      : Object.keys(projection.npcCareerRecords);
  return careerIds
    .map((careerId) => projection.npcCareerRecords[careerId])
    .filter(Boolean)
    .sort((left, right) => right.recordedAt.localeCompare(left.recordedAt) || left.careerId.localeCompare(right.careerId))
    .map((career) => withNpcCareerSummary(projection, career));
}

export function npcLocationsView(
  projection: EpochProjection,
  input: { regionId?: string; npcId?: string } = {},
): readonly EpochNpcLocationView[] {
  const locationIds = input.npcId
    ? projection.npcLocationIdsByNpc[input.npcId] || []
    : input.regionId
      ? projection.npcLocationIdsByRegion[input.regionId] || []
      : Object.keys(projection.npcLocationRecords);
  return locationIds
    .map((locationId) => projection.npcLocationRecords[locationId])
    .filter(Boolean)
    .sort((left, right) => right.recordedAt.localeCompare(left.recordedAt) || left.locationId.localeCompare(right.locationId))
    .map((location) => withNpcLocationSummary(projection, location));
}

export function npcAssetsView(
  projection: EpochProjection,
  input: { regionId?: string; npcId?: string } = {},
): readonly EpochNpcAssetStateView[] {
  const assetIds = input.npcId
    ? projection.npcAssetIdsByNpc[input.npcId] || []
    : input.regionId
      ? projection.npcAssetIdsByRegion[input.regionId] || []
      : Object.keys(projection.npcAssetStates);
  return assetIds
    .map((assetId) => projection.npcAssetStates[assetId])
    .filter(Boolean)
    .sort((left, right) => right.recordedAt.localeCompare(left.recordedAt) || left.assetId.localeCompare(right.assetId))
    .map((asset) => withNpcAssetSummary(projection, asset));
}

export function npcHealthView(
  projection: EpochProjection,
  input: { regionId?: string; npcId?: string } = {},
): readonly EpochNpcHealthStateView[] {
  const healthIds = input.npcId
    ? projection.npcHealthIdsByNpc[input.npcId] || []
    : input.regionId
      ? projection.npcHealthIdsByRegion[input.regionId] || []
      : Object.keys(projection.npcHealthStates);
  return healthIds
    .map((healthId) => projection.npcHealthStates[healthId])
    .filter(Boolean)
    .sort((left, right) => right.recordedAt.localeCompare(left.recordedAt) || left.healthId.localeCompare(right.healthId))
    .map((health) => withNpcHealthSummary(projection, health));
}

export function socialHooksView(
  projection: EpochProjection,
  input: { regionId?: string; npcId?: string } = {},
) {
  const hookIds = input.npcId
    ? projection.socialHookIdsByNpc[input.npcId] || []
    : input.regionId
      ? projection.socialHookIdsByRegion[input.regionId] || []
      : Object.keys(projection.socialHooks);
  return hookIds
    .map((hookId) => projection.socialHooks[hookId])
    .filter(Boolean)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt) || left.hookId.localeCompare(right.hookId));
}
