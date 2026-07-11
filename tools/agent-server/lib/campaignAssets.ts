import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveEpochMediaRegionId } from "./regionAliases.ts";

export const EPOCH_CAMPAIGN_KEY_ART_WIDTH = 1280;
export const EPOCH_CAMPAIGN_KEY_ART_HEIGHT = 720;
export const EPOCH_CAMPAIGN_KEY_ART_CONTENT_TYPE = "image/png" as const;

const serverRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const defaultPackageRoot = join(serverRoot, "package");

export type EpochCampaignKeyArtKey =
  | "gray_harbor_faction_war"
  | "cinder_archive_expedition"
  | "white_tower_compact"
  | "anomaly_containment"
  | "resource_node_rush"
  | "market_convoy";

export interface EpochCampaignKeyArtRecord {
  readonly campaignKey: EpochCampaignKeyArtKey;
  readonly title: string;
  readonly subtitle: string;
  readonly fileName: string;
  readonly path: string;
  readonly url: string;
  readonly contentType: typeof EPOCH_CAMPAIGN_KEY_ART_CONTENT_TYPE;
  readonly width: number;
  readonly height: number;
  readonly palette: readonly string[];
  readonly accentColor: string;
  readonly publicAlt: string;
  readonly regionIds: readonly string[];
  readonly factionIds: readonly string[];
  readonly motif: "harbor-war" | "archive-expedition" | "tower-compact" | "anomaly" | "resource-rush" | "convoy";
}

export interface EpochCampaignKeyArtManifestEntry {
  readonly campaignKey: EpochCampaignKeyArtKey;
  readonly title: string;
  readonly subtitle: string;
  readonly path: string;
  readonly url: string;
  readonly contentType: typeof EPOCH_CAMPAIGN_KEY_ART_CONTENT_TYPE;
  readonly width: number;
  readonly height: number;
  readonly sha256: string;
}

export interface EpochCampaignKeyArtMedia {
  readonly campaignKey: EpochCampaignKeyArtKey;
  readonly title: string;
  readonly subtitle: string;
  readonly palette: readonly string[];
  readonly accentColor: string;
  readonly publicAlt: string;
  readonly assetPath: string;
  readonly imageUrl: string;
  readonly contentType: typeof EPOCH_CAMPAIGN_KEY_ART_CONTENT_TYPE;
  readonly width: number;
  readonly height: number;
}

export const EPOCH_CAMPAIGN_KEY_ART_ASSETS = [
  {
    campaignKey: "gray_harbor_faction_war",
    title: "灰港阵营战争",
    subtitle: "潮线、灯塔和三阵营争夺",
    fileName: "gray-harbor-faction-war-campaign.png",
    path: "obsidian-epoch/assets/campaign/gray-harbor-faction-war-campaign.png",
    url: "/api/epoch/assets/campaign/gray-harbor-faction-war-campaign.png",
    contentType: EPOCH_CAMPAIGN_KEY_ART_CONTENT_TYPE,
    width: EPOCH_CAMPAIGN_KEY_ART_WIDTH,
    height: EPOCH_CAMPAIGN_KEY_ART_HEIGHT,
    palette: ["#07141b", "#164e63", "#67e8f9", "#d6b076"],
    accentColor: "#67e8f9",
    publicAlt: "黑曜纪元灰港阵营战争战役主视觉。",
    regionIds: ["region_gray_harbor"],
    factionIds: ["gray_watch", "cinder_archive", "white_tower_compact"],
    motif: "harbor-war",
  },
  {
    campaignKey: "cinder_archive_expedition",
    title: "余烬档案远征",
    subtitle: "火印、誓册和失落索引",
    fileName: "cinder-archive-expedition-campaign.png",
    path: "obsidian-epoch/assets/campaign/cinder-archive-expedition-campaign.png",
    url: "/api/epoch/assets/campaign/cinder-archive-expedition-campaign.png",
    contentType: EPOCH_CAMPAIGN_KEY_ART_CONTENT_TYPE,
    width: EPOCH_CAMPAIGN_KEY_ART_WIDTH,
    height: EPOCH_CAMPAIGN_KEY_ART_HEIGHT,
    palette: ["#160f12", "#7f1d1d", "#f97316", "#f8fafc"],
    accentColor: "#f97316",
    publicAlt: "黑曜纪元余烬档案远征战役主视觉。",
    regionIds: ["region_ash_outpost", "region_glass_archive"],
    factionIds: ["cinder_archive"],
    motif: "archive-expedition",
  },
  {
    campaignKey: "white_tower_compact",
    title: "白塔契盟测绘",
    subtitle: "冷光测绘、灵质宪章和区域控制",
    fileName: "white-tower-compact-campaign.png",
    path: "obsidian-epoch/assets/campaign/white-tower-compact-campaign.png",
    url: "/api/epoch/assets/campaign/white-tower-compact-campaign.png",
    contentType: EPOCH_CAMPAIGN_KEY_ART_CONTENT_TYPE,
    width: EPOCH_CAMPAIGN_KEY_ART_WIDTH,
    height: EPOCH_CAMPAIGN_KEY_ART_HEIGHT,
    palette: ["#0b1120", "#1d4ed8", "#bfdbfe", "#f8fafc"],
    accentColor: "#bfdbfe",
    publicAlt: "黑曜纪元白塔契盟测绘战役主视觉。",
    regionIds: ["region_salt_mirror_coast", "region_moonwell_hollow"],
    factionIds: ["white_tower_compact"],
    motif: "tower-compact",
  },
  {
    campaignKey: "anomaly_containment",
    title: "异常围猎",
    subtitle: "多人压制 Boss 和区域污染",
    fileName: "anomaly-containment-campaign.png",
    path: "obsidian-epoch/assets/campaign/anomaly-containment-campaign.png",
    url: "/api/epoch/assets/campaign/anomaly-containment-campaign.png",
    contentType: EPOCH_CAMPAIGN_KEY_ART_CONTENT_TYPE,
    width: EPOCH_CAMPAIGN_KEY_ART_WIDTH,
    height: EPOCH_CAMPAIGN_KEY_ART_HEIGHT,
    palette: ["#120f18", "#581c87", "#c4b5fd", "#f43f5e"],
    accentColor: "#c4b5fd",
    publicAlt: "黑曜纪元异常围猎多人战役主视觉。",
    regionIds: ["region_gray_harbor", "region_salt_mirror_coast", "region_glass_archive"],
    factionIds: [],
    motif: "anomaly",
  },
  {
    campaignKey: "resource_node_rush",
    title: "资源点争夺",
    subtitle: "限时采掘窗口和区域竞速委托",
    fileName: "resource-node-rush-campaign.png",
    path: "obsidian-epoch/assets/campaign/resource-node-rush-campaign.png",
    url: "/api/epoch/assets/campaign/resource-node-rush-campaign.png",
    contentType: EPOCH_CAMPAIGN_KEY_ART_CONTENT_TYPE,
    width: EPOCH_CAMPAIGN_KEY_ART_WIDTH,
    height: EPOCH_CAMPAIGN_KEY_ART_HEIGHT,
    palette: ["#11140f", "#3f6212", "#bef264", "#facc15"],
    accentColor: "#bef264",
    publicAlt: "黑曜纪元资源点争夺多人战役主视觉。",
    regionIds: ["region_ash_outpost", "region_moonwell_hollow"],
    factionIds: [],
    motif: "resource-rush",
  },
  {
    campaignKey: "market_convoy",
    title: "市场护送",
    subtitle: "区域交易、护送和风险审计",
    fileName: "market-convoy-campaign.png",
    path: "obsidian-epoch/assets/campaign/market-convoy-campaign.png",
    url: "/api/epoch/assets/campaign/market-convoy-campaign.png",
    contentType: EPOCH_CAMPAIGN_KEY_ART_CONTENT_TYPE,
    width: EPOCH_CAMPAIGN_KEY_ART_WIDTH,
    height: EPOCH_CAMPAIGN_KEY_ART_HEIGHT,
    palette: ["#18120f", "#854d0e", "#facc15", "#f8fafc"],
    accentColor: "#facc15",
    publicAlt: "黑曜纪元市场护送经济战役主视觉。",
    regionIds: ["region_gray_harbor", "region_ash_outpost", "region_salt_mirror_coast"],
    factionIds: [],
    motif: "convoy",
  },
] as const satisfies readonly EpochCampaignKeyArtRecord[];

function campaignAssetFilePath(asset: EpochCampaignKeyArtRecord, packageRoot = defaultPackageRoot) {
  return join(packageRoot, asset.path);
}

export function epochCampaignKeyArtByFileName(fileName: string): EpochCampaignKeyArtRecord | undefined {
  return EPOCH_CAMPAIGN_KEY_ART_ASSETS.find((asset) => asset.fileName === fileName);
}

export function epochCampaignKeyArtForKey(campaignKey: EpochCampaignKeyArtKey): EpochCampaignKeyArtRecord | undefined {
  return EPOCH_CAMPAIGN_KEY_ART_ASSETS.find((asset) => asset.campaignKey === campaignKey);
}

export function epochCampaignKeyArtForRegion(regionId: string): readonly EpochCampaignKeyArtRecord[] {
  const mediaRegionId = resolveEpochMediaRegionId(regionId);
  return EPOCH_CAMPAIGN_KEY_ART_ASSETS.filter((asset) => {
    const regionIds: readonly string[] = asset.regionIds;
    return regionIds.includes(mediaRegionId);
  });
}

export function epochCampaignKeyArtForSeason(input: { readonly regionIds?: readonly string[]; readonly factionIds?: readonly string[] }): EpochCampaignKeyArtRecord | undefined {
  const regionMatch = (input.regionIds || [])
    .flatMap((regionId) => [...epochCampaignKeyArtForRegion(regionId)])
    .at(0);
  if (regionMatch) return regionMatch;
  const factionIds = new Set(input.factionIds || []);
  return EPOCH_CAMPAIGN_KEY_ART_ASSETS.find((asset) => {
    const assetFactionIds: readonly string[] = asset.factionIds;
    return assetFactionIds.some((factionId) => factionIds.has(factionId));
  });
}

export async function readEpochCampaignKeyArtByFileName(fileName: string, packageRoot = defaultPackageRoot) {
  const asset = epochCampaignKeyArtByFileName(fileName);
  if (!asset) return undefined;
  const content = await readFile(campaignAssetFilePath(asset, packageRoot));
  return { asset, content };
}

export async function epochCampaignKeyArtManifestEntries(packageRoot = defaultPackageRoot): Promise<EpochCampaignKeyArtManifestEntry[]> {
  return Promise.all(EPOCH_CAMPAIGN_KEY_ART_ASSETS.map(async (asset) => {
    const content = await readFile(campaignAssetFilePath(asset, packageRoot));
    return {
      campaignKey: asset.campaignKey,
      title: asset.title,
      subtitle: asset.subtitle,
      path: asset.path,
      url: asset.url,
      contentType: asset.contentType,
      width: asset.width,
      height: asset.height,
      sha256: createHash("sha256").update(content).digest("hex"),
    };
  }));
}

export function epochCampaignKeyArtMedia(asset: EpochCampaignKeyArtRecord): EpochCampaignKeyArtMedia {
  return {
    campaignKey: asset.campaignKey,
    title: asset.title,
    subtitle: asset.subtitle,
    palette: asset.palette,
    accentColor: asset.accentColor,
    publicAlt: asset.publicAlt,
    assetPath: asset.path,
    imageUrl: asset.url,
    contentType: asset.contentType,
    width: asset.width,
    height: asset.height,
  };
}
