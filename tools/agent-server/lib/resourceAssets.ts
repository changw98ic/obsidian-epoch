import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { EpochDowntimeMode, EpochResourceId } from "./epoch/protocol.ts";

export const EPOCH_RESOURCE_ASSET_WIDTH = 512;
export const EPOCH_RESOURCE_ASSET_HEIGHT = 512;
export const EPOCH_RESOURCE_ASSET_CONTENT_TYPE = "image/png" as const;

const serverRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const defaultPackageRoot = join(serverRoot, "package");

interface EpochBaseIconAssetRecord {
  readonly title: string;
  readonly subtitle: string;
  readonly fileName: string;
  readonly path: string;
  readonly url: string;
  readonly contentType: typeof EPOCH_RESOURCE_ASSET_CONTENT_TYPE;
  readonly width: number;
  readonly height: number;
  readonly palette: readonly string[];
  readonly accentColor: string;
  readonly publicAlt: string;
}

export interface EpochResourceAssetRecord extends EpochBaseIconAssetRecord {
  readonly resourceId: EpochResourceId;
  readonly sigil: "coin" | "aether" | "stamina" | "focus" | "legend";
}

export interface EpochDowntimeAssetRecord extends EpochBaseIconAssetRecord {
  readonly mode: EpochDowntimeMode;
  readonly sigil: "circle" | "spire" | "band" | "cot" | "cup" | "road" | "stall" | "talk";
}

export interface EpochResourceAssetManifestEntry {
  readonly resourceId: EpochResourceId;
  readonly title: string;
  readonly subtitle: string;
  readonly path: string;
  readonly url: string;
  readonly contentType: typeof EPOCH_RESOURCE_ASSET_CONTENT_TYPE;
  readonly width: number;
  readonly height: number;
  readonly sha256: string;
}

export interface EpochDowntimeAssetManifestEntry {
  readonly mode: EpochDowntimeMode;
  readonly title: string;
  readonly subtitle: string;
  readonly path: string;
  readonly url: string;
  readonly contentType: typeof EPOCH_RESOURCE_ASSET_CONTENT_TYPE;
  readonly width: number;
  readonly height: number;
  readonly sha256: string;
}

interface EpochBaseIconMedia {
  readonly title: string;
  readonly subtitle: string;
  readonly palette: readonly string[];
  readonly accentColor: string;
  readonly publicAlt: string;
  readonly assetPath: string;
  readonly imageUrl: string;
  readonly contentType: typeof EPOCH_RESOURCE_ASSET_CONTENT_TYPE;
  readonly width: number;
  readonly height: number;
}

export interface EpochResourceMedia extends EpochBaseIconMedia {
  readonly resourceId: EpochResourceId;
}

export interface EpochDowntimeMedia extends EpochBaseIconMedia {
  readonly mode: EpochDowntimeMode;
}

export const EPOCH_RESOURCE_ASSETS = [
  {
    resourceId: "coin",
    title: "灰港钱币",
    subtitle: "服务器结算的通用货币",
    fileName: "coin-resource.png",
    path: "obsidian-epoch/assets/resource/coin-resource.png",
    url: "/api/epoch/assets/resource/coin-resource.png",
    contentType: EPOCH_RESOURCE_ASSET_CONTENT_TYPE,
    width: EPOCH_RESOURCE_ASSET_WIDTH,
    height: EPOCH_RESOURCE_ASSET_HEIGHT,
    palette: ["#101820", "#6b7280", "#d6b076", "#f8fafc"],
    accentColor: "#d6b076",
    sigil: "coin",
    publicAlt: "黑曜纪元灰港钱币资源图标。",
  },
  {
    resourceId: "aether",
    title: "灵质晶簇",
    subtitle: "异常与修炼产出的灵质",
    fileName: "aether-resource.png",
    path: "obsidian-epoch/assets/resource/aether-resource.png",
    url: "/api/epoch/assets/resource/aether-resource.png",
    contentType: EPOCH_RESOURCE_ASSET_CONTENT_TYPE,
    width: EPOCH_RESOURCE_ASSET_WIDTH,
    height: EPOCH_RESOURCE_ASSET_HEIGHT,
    palette: ["#08111f", "#0f766e", "#67e8f9", "#f8fafc"],
    accentColor: "#67e8f9",
    sigil: "aether",
    publicAlt: "黑曜纪元灵质晶簇资源图标。",
  },
  {
    resourceId: "stamina",
    title: "体力刻符",
    subtitle: "争抢、训练与对抗消耗",
    fileName: "stamina-resource.png",
    path: "obsidian-epoch/assets/resource/stamina-resource.png",
    url: "/api/epoch/assets/resource/stamina-resource.png",
    contentType: EPOCH_RESOURCE_ASSET_CONTENT_TYPE,
    width: EPOCH_RESOURCE_ASSET_WIDTH,
    height: EPOCH_RESOURCE_ASSET_HEIGHT,
    palette: ["#18181b", "#7c2d12", "#f59e0b", "#e5e7eb"],
    accentColor: "#f59e0b",
    sigil: "stamina",
    publicAlt: "黑曜纪元体力刻符资源图标。",
  },
  {
    resourceId: "focus",
    title: "专注盐线",
    subtitle: "冥想、异常压制与社交行动燃料",
    fileName: "focus-resource.png",
    path: "obsidian-epoch/assets/resource/focus-resource.png",
    url: "/api/epoch/assets/resource/focus-resource.png",
    contentType: EPOCH_RESOURCE_ASSET_CONTENT_TYPE,
    width: EPOCH_RESOURCE_ASSET_WIDTH,
    height: EPOCH_RESOURCE_ASSET_HEIGHT,
    palette: ["#0b1120", "#1d4ed8", "#bfdbfe", "#f8fafc"],
    accentColor: "#bfdbfe",
    sigil: "focus",
    publicAlt: "黑曜纪元专注盐线资源图标。",
  },
  {
    resourceId: "legend",
    title: "传说星印",
    subtitle: "新闻、战报与高阶身份槽进度",
    fileName: "legend-resource.png",
    path: "obsidian-epoch/assets/resource/legend-resource.png",
    url: "/api/epoch/assets/resource/legend-resource.png",
    contentType: EPOCH_RESOURCE_ASSET_CONTENT_TYPE,
    width: EPOCH_RESOURCE_ASSET_WIDTH,
    height: EPOCH_RESOURCE_ASSET_HEIGHT,
    palette: ["#140f12", "#7f1d1d", "#f97316", "#f8fafc"],
    accentColor: "#f97316",
    sigil: "legend",
    publicAlt: "黑曜纪元传说星印资源图标。",
  },
] as const satisfies readonly EpochResourceAssetRecord[];

export const EPOCH_DOWNTIME_ASSETS = [
  {
    mode: "meditation",
    title: "静心冥想",
    subtitle: "整理心绪并缓慢积累专注",
    fileName: "meditation-downtime.png",
    path: "obsidian-epoch/assets/downtime/meditation-downtime.png",
    url: "/api/epoch/assets/downtime/meditation-downtime.png",
    contentType: EPOCH_RESOURCE_ASSET_CONTENT_TYPE,
    width: EPOCH_RESOURCE_ASSET_WIDTH,
    height: EPOCH_RESOURCE_ASSET_HEIGHT,
    palette: ["#08111f", "#1d4ed8", "#82d3c8", "#f8fafc"],
    accentColor: "#82d3c8",
    sigil: "circle",
    publicAlt: "黑曜纪元静心冥想托管姿态图标。",
  },
  {
    mode: "cultivation",
    title: "灵质修炼",
    subtitle: "沿灵质潮汐吐纳",
    fileName: "cultivation-downtime.png",
    path: "obsidian-epoch/assets/downtime/cultivation-downtime.png",
    url: "/api/epoch/assets/downtime/cultivation-downtime.png",
    contentType: EPOCH_RESOURCE_ASSET_CONTENT_TYPE,
    width: EPOCH_RESOURCE_ASSET_WIDTH,
    height: EPOCH_RESOURCE_ASSET_HEIGHT,
    palette: ["#070807", "#0f766e", "#67e8f9", "#facc15"],
    accentColor: "#67e8f9",
    sigil: "spire",
    publicAlt: "黑曜纪元灵质修炼托管姿态图标。",
  },
  {
    mode: "training",
    title: "体能训练",
    subtitle: "锻炼并恢复可用体力",
    fileName: "training-downtime.png",
    path: "obsidian-epoch/assets/downtime/training-downtime.png",
    url: "/api/epoch/assets/downtime/training-downtime.png",
    contentType: EPOCH_RESOURCE_ASSET_CONTENT_TYPE,
    width: EPOCH_RESOURCE_ASSET_WIDTH,
    height: EPOCH_RESOURCE_ASSET_HEIGHT,
    palette: ["#18181b", "#7c2d12", "#f59e0b", "#e5e7eb"],
    accentColor: "#f59e0b",
    sigil: "band",
    publicAlt: "黑曜纪元体能训练托管姿态图标。",
  },
  {
    mode: "resting",
    title: "安稳休整",
    subtitle: "睡眠、清点与低风险恢复",
    fileName: "resting-downtime.png",
    path: "obsidian-epoch/assets/downtime/resting-downtime.png",
    url: "/api/epoch/assets/downtime/resting-downtime.png",
    contentType: EPOCH_RESOURCE_ASSET_CONTENT_TYPE,
    width: EPOCH_RESOURCE_ASSET_WIDTH,
    height: EPOCH_RESOURCE_ASSET_HEIGHT,
    palette: ["#0b1120", "#334155", "#bfdbfe", "#f8fafc"],
    accentColor: "#bfdbfe",
    sigil: "cot",
    publicAlt: "黑曜纪元安稳休整托管姿态图标。",
  },
  {
    mode: "slacking",
    title: "摸鱼闲逛",
    subtitle: "街角闲聊与小额钱币",
    fileName: "slacking-downtime.png",
    path: "obsidian-epoch/assets/downtime/slacking-downtime.png",
    url: "/api/epoch/assets/downtime/slacking-downtime.png",
    contentType: EPOCH_RESOURCE_ASSET_CONTENT_TYPE,
    width: EPOCH_RESOURCE_ASSET_WIDTH,
    height: EPOCH_RESOURCE_ASSET_HEIGHT,
    palette: ["#101820", "#475569", "#d6b076", "#f8fafc"],
    accentColor: "#d6b076",
    sigil: "cup",
    publicAlt: "黑曜纪元摸鱼闲逛托管姿态图标。",
  },
  {
    mode: "travel",
    title: "外出游历",
    subtitle: "离开常驻地积累传说线索",
    fileName: "travel-downtime.png",
    path: "obsidian-epoch/assets/downtime/travel-downtime.png",
    url: "/api/epoch/assets/downtime/travel-downtime.png",
    contentType: EPOCH_RESOURCE_ASSET_CONTENT_TYPE,
    width: EPOCH_RESOURCE_ASSET_WIDTH,
    height: EPOCH_RESOURCE_ASSET_HEIGHT,
    palette: ["#11070a", "#3f1418", "#f97316", "#f8fafc"],
    accentColor: "#f97316",
    sigil: "road",
    publicAlt: "黑曜纪元外出游历托管姿态图标。",
  },
  {
    mode: "steward",
    title: "看店打理",
    subtitle: "维护店面、补给和小额钱币",
    fileName: "steward-downtime.png",
    path: "obsidian-epoch/assets/downtime/steward-downtime.png",
    url: "/api/epoch/assets/downtime/steward-downtime.png",
    contentType: EPOCH_RESOURCE_ASSET_CONTENT_TYPE,
    width: EPOCH_RESOURCE_ASSET_WIDTH,
    height: EPOCH_RESOURCE_ASSET_HEIGHT,
    palette: ["#11140f", "#365314", "#bef264", "#d6b076"],
    accentColor: "#bef264",
    sigil: "stall",
    publicAlt: "黑曜纪元看店打理托管姿态图标。",
  },
  {
    mode: "socialize",
    title: "街坊社交",
    subtitle: "拜访熟人并积累联系人线索",
    fileName: "socialize-downtime.png",
    path: "obsidian-epoch/assets/downtime/socialize-downtime.png",
    url: "/api/epoch/assets/downtime/socialize-downtime.png",
    contentType: EPOCH_RESOURCE_ASSET_CONTENT_TYPE,
    width: EPOCH_RESOURCE_ASSET_WIDTH,
    height: EPOCH_RESOURCE_ASSET_HEIGHT,
    palette: ["#130f18", "#7c3aed", "#c4b5fd", "#f8fafc"],
    accentColor: "#c4b5fd",
    sigil: "talk",
    publicAlt: "黑曜纪元街坊社交托管姿态图标。",
  },
] as const satisfies readonly EpochDowntimeAssetRecord[];

function resourceAssetFilePath(asset: EpochResourceAssetRecord, packageRoot = defaultPackageRoot) {
  return join(packageRoot, asset.path);
}

function downtimeAssetFilePath(asset: EpochDowntimeAssetRecord, packageRoot = defaultPackageRoot) {
  return join(packageRoot, asset.path);
}

export function epochResourceAssetByFileName(fileName: string): EpochResourceAssetRecord | undefined {
  return EPOCH_RESOURCE_ASSETS.find((asset) => asset.fileName === fileName);
}

export function epochDowntimeAssetByFileName(fileName: string): EpochDowntimeAssetRecord | undefined {
  return EPOCH_DOWNTIME_ASSETS.find((asset) => asset.fileName === fileName);
}

export function epochResourceAssetForId(resourceId: EpochResourceId): EpochResourceAssetRecord | undefined {
  return EPOCH_RESOURCE_ASSETS.find((asset) => asset.resourceId === resourceId);
}

export function epochDowntimeAssetForMode(mode: EpochDowntimeMode): EpochDowntimeAssetRecord | undefined {
  return EPOCH_DOWNTIME_ASSETS.find((asset) => asset.mode === mode);
}

export async function readEpochResourceAssetByFileName(fileName: string, packageRoot = defaultPackageRoot) {
  const asset = epochResourceAssetByFileName(fileName);
  if (!asset) return undefined;
  const content = await readFile(resourceAssetFilePath(asset, packageRoot));
  return { asset, content };
}

export async function readEpochDowntimeAssetByFileName(fileName: string, packageRoot = defaultPackageRoot) {
  const asset = epochDowntimeAssetByFileName(fileName);
  if (!asset) return undefined;
  const content = await readFile(downtimeAssetFilePath(asset, packageRoot));
  return { asset, content };
}

export async function epochResourceAssetManifestEntries(packageRoot = defaultPackageRoot): Promise<EpochResourceAssetManifestEntry[]> {
  return Promise.all(EPOCH_RESOURCE_ASSETS.map(async (asset) => {
    const content = await readFile(resourceAssetFilePath(asset, packageRoot));
    return {
      resourceId: asset.resourceId,
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

export async function epochDowntimeAssetManifestEntries(packageRoot = defaultPackageRoot): Promise<EpochDowntimeAssetManifestEntry[]> {
  return Promise.all(EPOCH_DOWNTIME_ASSETS.map(async (asset) => {
    const content = await readFile(downtimeAssetFilePath(asset, packageRoot));
    return {
      mode: asset.mode,
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

export function epochResourceMediaForId(resourceId: EpochResourceId): EpochResourceMedia | undefined {
  const asset = epochResourceAssetForId(resourceId);
  if (!asset) return undefined;
  return {
    resourceId: asset.resourceId,
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

export function epochDowntimeMediaForMode(mode: EpochDowntimeMode): EpochDowntimeMedia | undefined {
  const asset = epochDowntimeAssetForMode(mode);
  if (!asset) return undefined;
  return {
    mode: asset.mode,
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

export function epochResourceMediaMap(): Partial<Record<EpochResourceId, EpochResourceMedia>> {
  const media: Partial<Record<EpochResourceId, EpochResourceMedia>> = {};
  for (const asset of EPOCH_RESOURCE_ASSETS) {
    const entry = epochResourceMediaForId(asset.resourceId);
    if (entry) media[asset.resourceId] = entry;
  }
  return media;
}
