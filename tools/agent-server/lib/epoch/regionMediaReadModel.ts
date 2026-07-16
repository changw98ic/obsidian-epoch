import { epochLocationAssetForRegion } from "../locationAssets.ts";

export interface EpochRegionMedia {
  readonly regionId: string;
  readonly title: string;
  readonly subtitle: string;
  readonly palette: readonly string[];
  readonly accentColor: string;
  readonly publicAlt: string;
  readonly assetPath: string;
  readonly imageUrl: string;
}

export function regionMediaAsset(regionId: string): EpochRegionMedia | undefined {
  const asset = epochLocationAssetForRegion(regionId);
  if (!asset) return undefined;
  return {
    regionId: asset.regionId,
    title: asset.title,
    subtitle: asset.subtitle,
    palette: asset.palette,
    accentColor: asset.accentColor,
    publicAlt: asset.publicAlt,
    assetPath: asset.path,
    imageUrl: asset.url,
  };
}
