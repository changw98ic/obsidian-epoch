import type {
  EpochProjection,
  EpochRegionMonument,
} from "./gameCore.ts";

export function monumentsView(
  projection: EpochProjection,
  input: { regionId?: string } = {},
): readonly EpochRegionMonument[] {
  const monumentIds = input.regionId
    ? projection.regionMonumentIdsByRegion[input.regionId] || []
    : Object.keys(projection.regionMonuments);
  return monumentIds
    .map((monumentId) => projection.regionMonuments[monumentId])
    .filter((monument): monument is EpochRegionMonument => Boolean(monument))
    .sort((left, right) => right.builtAt.localeCompare(left.builtAt) || left.monumentId.localeCompare(right.monumentId));
}
