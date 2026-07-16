import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { type EpochCampaignKeyArtMedia } from "./campaignAssets.ts";

export const EPOCH_FACTION_ASSET_WIDTH = 512;
export const EPOCH_FACTION_ASSET_HEIGHT = 512;
export const EPOCH_SEASON_BANNER_ASSET_WIDTH = 960;
export const EPOCH_SEASON_BANNER_ASSET_HEIGHT = 540;
export const EPOCH_FACTION_ASSET_CONTENT_TYPE = "image/png" as const;

const serverRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const defaultPackageRoot = join(serverRoot, "package");

export interface EpochFactionAssetRecord {
  readonly factionId: string;
  readonly title: string;
  readonly subtitle: string;
  readonly fileName: string;
  readonly path: string;
  readonly url: string;
  readonly contentType: typeof EPOCH_FACTION_ASSET_CONTENT_TYPE;
  readonly width: number;
  readonly height: number;
  readonly palette: readonly string[];
  readonly accentColor: string;
  readonly sigil: "watch" | "archive" | "tower";
  readonly publicAlt: string;
}

export interface EpochSeasonBannerAssetRecord {
  readonly seasonKey: string;
  readonly title: string;
  readonly subtitle: string;
  readonly fileName: string;
  readonly path: string;
  readonly url: string;
  readonly contentType: typeof EPOCH_FACTION_ASSET_CONTENT_TYPE;
  readonly width: number;
  readonly height: number;
  readonly palette: readonly string[];
  readonly accentColor: string;
  readonly publicAlt: string;
}

export interface EpochFactionAssetManifestEntry {
  readonly factionId: string;
  readonly title: string;
  readonly subtitle: string;
  readonly path: string;
  readonly url: string;
  readonly contentType: typeof EPOCH_FACTION_ASSET_CONTENT_TYPE;
  readonly width: number;
  readonly height: number;
  readonly sha256: string;
}

export interface EpochSeasonBannerAssetManifestEntry {
  readonly seasonKey: string;
  readonly title: string;
  readonly subtitle: string;
  readonly path: string;
  readonly url: string;
  readonly contentType: typeof EPOCH_FACTION_ASSET_CONTENT_TYPE;
  readonly width: number;
  readonly height: number;
  readonly sha256: string;
}

export interface EpochFactionMedia {
  readonly factionId: string;
  readonly title: string;
  readonly subtitle: string;
  readonly palette: readonly string[];
  readonly accentColor: string;
  readonly publicAlt: string;
  readonly assetPath: string;
  readonly imageUrl: string;
  readonly contentType: typeof EPOCH_FACTION_ASSET_CONTENT_TYPE;
  readonly width: number;
  readonly height: number;
}

export interface EpochSeasonBannerMedia {
  readonly seasonKey: string;
  readonly title: string;
  readonly subtitle: string;
  readonly palette: readonly string[];
  readonly accentColor: string;
  readonly publicAlt: string;
  readonly assetPath: string;
  readonly imageUrl: string;
  readonly contentType: typeof EPOCH_FACTION_ASSET_CONTENT_TYPE;
  readonly width: number;
  readonly height: number;
}

export interface EpochSeasonCampaignMedia {
  readonly banner?: EpochSeasonBannerMedia;
  readonly campaignKeyArt?: EpochCampaignKeyArtMedia;
  readonly factions: readonly EpochFactionMedia[];
}

export const EPOCH_FACTION_ASSETS = [
  {
    factionId: "gray_watch",
    title: "灰港守望",
    subtitle: "潮线巡夜者与灰灯契约",
    fileName: "gray-watch-emblem.png",
    path: "obsidian-epoch/assets/faction/gray-watch-emblem.png",
    url: "/api/epoch/assets/faction/gray-watch-emblem.png",
    contentType: EPOCH_FACTION_ASSET_CONTENT_TYPE,
    width: EPOCH_FACTION_ASSET_WIDTH,
    height: EPOCH_FACTION_ASSET_HEIGHT,
    palette: ["#08111f", "#334155", "#94a3b8", "#82d3c8"],
    accentColor: "#82d3c8",
    sigil: "watch",
    publicAlt: "黑曜纪元灰港守望阵营徽记。",
  },
  {
    factionId: "cinder_archive",
    title: "余烬档案会",
    subtitle: "封存火印与记忆誓册",
    fileName: "cinder-archive-emblem.png",
    path: "obsidian-epoch/assets/faction/cinder-archive-emblem.png",
    url: "/api/epoch/assets/faction/cinder-archive-emblem.png",
    contentType: EPOCH_FACTION_ASSET_CONTENT_TYPE,
    width: EPOCH_FACTION_ASSET_WIDTH,
    height: EPOCH_FACTION_ASSET_HEIGHT,
    palette: ["#140f12", "#7f1d1d", "#f97316", "#f8fafc"],
    accentColor: "#f97316",
    sigil: "archive",
    publicAlt: "黑曜纪元余烬档案会阵营徽记。",
  },
  {
    factionId: "white_tower_compact",
    title: "白塔契盟",
    subtitle: "冷光测绘与灵质宪章",
    fileName: "white-tower-compact-emblem.png",
    path: "obsidian-epoch/assets/faction/white-tower-compact-emblem.png",
    url: "/api/epoch/assets/faction/white-tower-compact-emblem.png",
    contentType: EPOCH_FACTION_ASSET_CONTENT_TYPE,
    width: EPOCH_FACTION_ASSET_WIDTH,
    height: EPOCH_FACTION_ASSET_HEIGHT,
    palette: ["#0b1120", "#1d4ed8", "#bfdbfe", "#f8fafc"],
    accentColor: "#bfdbfe",
    sigil: "tower",
    publicAlt: "黑曜纪元白塔契盟阵营徽记。",
  },
] as const satisfies readonly EpochFactionAssetRecord[];

export const EPOCH_SEASON_BANNER_ASSETS = [
  {
    seasonKey: "gray_harbor_faction_season",
    title: "灰港潮汐季",
    subtitle: "三方阵营在退潮窗口争夺灰港控制权",
    fileName: "gray-harbor-faction-season-banner.png",
    path: "obsidian-epoch/assets/season/gray-harbor-faction-season-banner.png",
    url: "/api/epoch/assets/season/gray-harbor-faction-season-banner.png",
    contentType: EPOCH_FACTION_ASSET_CONTENT_TYPE,
    width: EPOCH_SEASON_BANNER_ASSET_WIDTH,
    height: EPOCH_SEASON_BANNER_ASSET_HEIGHT,
    palette: ["#070807", "#1f2937", "#0f766e", "#d7aa62"],
    accentColor: "#82d3c8",
    publicAlt: "黑曜纪元灰港潮汐季赛季横幅。",
  },
  {
    seasonKey: "cinder_archive_season",
    title: "余烬档案季",
    subtitle: "火印档案在封存期争夺失落记忆册",
    fileName: "cinder-archive-season-banner.png",
    path: "obsidian-epoch/assets/season/cinder-archive-season-banner.png",
    url: "/api/epoch/assets/season/cinder-archive-season-banner.png",
    contentType: EPOCH_FACTION_ASSET_CONTENT_TYPE,
    width: EPOCH_SEASON_BANNER_ASSET_WIDTH,
    height: EPOCH_SEASON_BANNER_ASSET_HEIGHT,
    palette: ["#11070a", "#3f1418", "#b45309", "#f8fafc"],
    accentColor: "#f97316",
    publicAlt: "黑曜纪元余烬档案季赛季横幅。",
  },
  {
    seasonKey: "white_tower_compact_season",
    title: "白塔测绘季",
    subtitle: "冷光契盟围绕灵质测绘权展开赛季推进",
    fileName: "white-tower-compact-season-banner.png",
    path: "obsidian-epoch/assets/season/white-tower-compact-season-banner.png",
    url: "/api/epoch/assets/season/white-tower-compact-season-banner.png",
    contentType: EPOCH_FACTION_ASSET_CONTENT_TYPE,
    width: EPOCH_SEASON_BANNER_ASSET_WIDTH,
    height: EPOCH_SEASON_BANNER_ASSET_HEIGHT,
    palette: ["#060b16", "#1e3a8a", "#67e8f9", "#f8fafc"],
    accentColor: "#bfdbfe",
    publicAlt: "黑曜纪元白塔测绘季赛季横幅。",
  },
] as const satisfies readonly EpochSeasonBannerAssetRecord[];

function normalizeSeasonKey(seasonKey: string) {
  const colonPrefix = seasonKey.split(":")[0] || seasonKey;
  const matchedTemplate = EPOCH_SEASON_BANNER_ASSETS.find((asset) =>
    colonPrefix === asset.seasonKey || colonPrefix.startsWith(asset.seasonKey));
  return matchedTemplate?.seasonKey || colonPrefix;
}

export function epochFactionAssetByFileName(fileName: string): EpochFactionAssetRecord | undefined {
  return EPOCH_FACTION_ASSETS.find((asset) => asset.fileName === fileName);
}

export function epochSeasonBannerAssetByFileName(fileName: string): EpochSeasonBannerAssetRecord | undefined {
  return EPOCH_SEASON_BANNER_ASSETS.find((asset) => asset.fileName === fileName);
}

export function epochFactionAssetForId(factionId: string): EpochFactionAssetRecord | undefined {
  return EPOCH_FACTION_ASSETS.find((asset) => asset.factionId === factionId);
}

export function epochSeasonBannerAssetForKey(seasonKey: string): EpochSeasonBannerAssetRecord | undefined {
  const normalized = normalizeSeasonKey(seasonKey);
  return EPOCH_SEASON_BANNER_ASSETS.find((asset) => asset.seasonKey === normalized);
}

export function epochFactionAssetFilePath(asset: EpochFactionAssetRecord, packageRoot = defaultPackageRoot) {
  return join(packageRoot, asset.path);
}

export function epochSeasonBannerAssetFilePath(asset: EpochSeasonBannerAssetRecord, packageRoot = defaultPackageRoot) {
  return join(packageRoot, asset.path);
}

export async function readEpochFactionAssetByFileName(fileName: string, packageRoot = defaultPackageRoot) {
  const asset = epochFactionAssetByFileName(fileName);
  if (!asset) return undefined;
  const content = await readFile(epochFactionAssetFilePath(asset, packageRoot));
  return { asset, content };
}

export async function readEpochSeasonBannerAssetByFileName(fileName: string, packageRoot = defaultPackageRoot) {
  const asset = epochSeasonBannerAssetByFileName(fileName);
  if (!asset) return undefined;
  const content = await readFile(epochSeasonBannerAssetFilePath(asset, packageRoot));
  return { asset, content };
}

export async function epochFactionAssetManifestEntries(packageRoot = defaultPackageRoot): Promise<EpochFactionAssetManifestEntry[]> {
  return Promise.all(EPOCH_FACTION_ASSETS.map(async (asset) => {
    const content = await readFile(epochFactionAssetFilePath(asset, packageRoot));
    return {
      factionId: asset.factionId,
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

export async function epochSeasonBannerAssetManifestEntries(packageRoot = defaultPackageRoot): Promise<EpochSeasonBannerAssetManifestEntry[]> {
  return Promise.all(EPOCH_SEASON_BANNER_ASSETS.map(async (asset) => {
    const content = await readFile(epochSeasonBannerAssetFilePath(asset, packageRoot));
    return {
      seasonKey: asset.seasonKey,
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

export function epochFactionMediaForId(factionId: string): EpochFactionMedia | undefined {
  const asset = epochFactionAssetForId(factionId);
  if (!asset) return undefined;
  return {
    factionId: asset.factionId,
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

export function epochSeasonBannerMediaForKey(seasonKey: string): EpochSeasonBannerMedia | undefined {
  const asset = epochSeasonBannerAssetForKey(seasonKey);
  if (!asset) return undefined;
  return {
    seasonKey: asset.seasonKey,
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

export function epochSeasonCampaignMediaForRecord(input: {
  readonly seasonKey: string;
  readonly factionIds: readonly string[];
}): EpochSeasonCampaignMedia {
  return {
    banner: epochSeasonBannerMediaForKey(input.seasonKey),
    factions: input.factionIds.map(epochFactionMediaForId).filter((media): media is EpochFactionMedia => Boolean(media)),
  };
}
