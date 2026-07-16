import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const EPOCH_ITEM_ASSET_WIDTH = 512;
export const EPOCH_ITEM_ASSET_HEIGHT = 512;
export const EPOCH_ITEM_ASSET_CONTENT_TYPE = "image/png" as const;

const serverRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const defaultPackageRoot = join(serverRoot, "package");

export interface EpochItemAssetRecord {
  readonly itemKey: string;
  readonly title: string;
  readonly subtitle: string;
  readonly fileName: string;
  readonly path: string;
  readonly url: string;
  readonly contentType: typeof EPOCH_ITEM_ASSET_CONTENT_TYPE;
  readonly width: number;
  readonly height: number;
  readonly palette: readonly string[];
  readonly accentColor: string;
  readonly publicAlt: string;
}

export interface EpochItemAssetManifestEntry {
  readonly itemKey: string;
  readonly title: string;
  readonly subtitle: string;
  readonly path: string;
  readonly url: string;
  readonly contentType: typeof EPOCH_ITEM_ASSET_CONTENT_TYPE;
  readonly width: number;
  readonly height: number;
  readonly sha256: string;
}

export interface EpochItemMedia {
  readonly itemKey: string;
  readonly title: string;
  readonly subtitle: string;
  readonly palette: readonly string[];
  readonly accentColor: string;
  readonly publicAlt: string;
  readonly assetPath: string;
  readonly imageUrl: string;
  readonly contentType: typeof EPOCH_ITEM_ASSET_CONTENT_TYPE;
  readonly width: number;
  readonly height: number;
}

export const EPOCH_ITEM_ASSETS = [
  {
    itemKey: "crafted:field-kit",
    title: "灰行者工具包",
    subtitle: "绳结、灰盐与折叠探针",
    fileName: "field-kit.png",
    path: "obsidian-epoch/assets/item/field-kit.png",
    url: "/api/epoch/assets/item/field-kit.png",
    contentType: EPOCH_ITEM_ASSET_CONTENT_TYPE,
    width: EPOCH_ITEM_ASSET_WIDTH,
    height: EPOCH_ITEM_ASSET_HEIGHT,
    palette: ["#0f172a", "#475569", "#94a3b8", "#d7aa62"],
    accentColor: "#d7aa62",
    publicAlt: "黑曜纪元灰行者工具包的服务器物品图标。",
  },
  {
    itemKey: "crafted:focus-charm",
    title: "静心盐线护符",
    subtitle: "盐线环与低声护纹",
    fileName: "focus-charm.png",
    path: "obsidian-epoch/assets/item/focus-charm.png",
    url: "/api/epoch/assets/item/focus-charm.png",
    contentType: EPOCH_ITEM_ASSET_CONTENT_TYPE,
    width: EPOCH_ITEM_ASSET_WIDTH,
    height: EPOCH_ITEM_ASSET_HEIGHT,
    palette: ["#111827", "#1d4ed8", "#a7f3d0", "#f8fafc"],
    accentColor: "#a7f3d0",
    publicAlt: "黑曜纪元静心盐线护符的服务器物品图标。",
  },
  {
    itemKey: "crafted:training-band",
    title: "巡夜训练缚带",
    subtitle: "磨损皮带与刻度铜扣",
    fileName: "training-band.png",
    path: "obsidian-epoch/assets/item/training-band.png",
    url: "/api/epoch/assets/item/training-band.png",
    contentType: EPOCH_ITEM_ASSET_CONTENT_TYPE,
    width: EPOCH_ITEM_ASSET_WIDTH,
    height: EPOCH_ITEM_ASSET_HEIGHT,
    palette: ["#1c1917", "#7c2d12", "#f59e0b", "#e5e7eb"],
    accentColor: "#f59e0b",
    publicAlt: "黑曜纪元巡夜训练缚带的服务器物品图标。",
  },
  {
    itemKey: "shop:gray-ration-pack",
    title: "灰市补给包",
    subtitle: "蜡封口粮与粗布背袋",
    fileName: "gray-ration-pack.png",
    path: "obsidian-epoch/assets/item/gray-ration-pack.png",
    url: "/api/epoch/assets/item/gray-ration-pack.png",
    contentType: EPOCH_ITEM_ASSET_CONTENT_TYPE,
    width: EPOCH_ITEM_ASSET_WIDTH,
    height: EPOCH_ITEM_ASSET_HEIGHT,
    palette: ["#101820", "#4b5563", "#a3a3a3", "#d6b076"],
    accentColor: "#d6b076",
    publicAlt: "黑曜纪元灰市补给包的服务器物品图标。",
  },
  {
    itemKey: "shop:aether-survey-lantern",
    title: "灵质探勘灯",
    subtitle: "青焰灯芯与测绘外环",
    fileName: "aether-survey-lantern.png",
    path: "obsidian-epoch/assets/item/aether-survey-lantern.png",
    url: "/api/epoch/assets/item/aether-survey-lantern.png",
    contentType: EPOCH_ITEM_ASSET_CONTENT_TYPE,
    width: EPOCH_ITEM_ASSET_WIDTH,
    height: EPOCH_ITEM_ASSET_HEIGHT,
    palette: ["#08111f", "#0f766e", "#67e8f9", "#facc15"],
    accentColor: "#67e8f9",
    publicAlt: "黑曜纪元灵质探勘灯的服务器物品图标。",
  },
  {
    itemKey: "shop:ashen-oath-relic",
    title: "灰誓遗物",
    subtitle: "裂纹誓牌与封存火印",
    fileName: "ashen-oath-relic.png",
    path: "obsidian-epoch/assets/item/ashen-oath-relic.png",
    url: "/api/epoch/assets/item/ashen-oath-relic.png",
    contentType: EPOCH_ITEM_ASSET_CONTENT_TYPE,
    width: EPOCH_ITEM_ASSET_WIDTH,
    height: EPOCH_ITEM_ASSET_HEIGHT,
    palette: ["#140f12", "#7f1d1d", "#f97316", "#f8fafc"],
    accentColor: "#f97316",
    publicAlt: "黑曜纪元灰誓遗物的服务器物品图标。",
  },
  {
    itemKey: "shop:pipewarden-valve-kit",
    title: "管网阀钥工具",
    subtitle: "铜阀钥、密封圈与短柄扳手",
    fileName: "pipewarden-valve-kit.png",
    path: "obsidian-epoch/assets/item/pipewarden-valve-kit.png",
    url: "/api/epoch/assets/item/pipewarden-valve-kit.png",
    contentType: EPOCH_ITEM_ASSET_CONTENT_TYPE,
    width: EPOCH_ITEM_ASSET_WIDTH,
    height: EPOCH_ITEM_ASSET_HEIGHT,
    palette: ["#07151a", "#155e75", "#22d3ee", "#fbbf24"],
    accentColor: "#22d3ee",
    publicAlt: "黑曜纪元管网阀钥工具的服务器物品图标。",
  },
  {
    itemKey: "shop:mine-echo-relic",
    title: "矿脉回声遗物",
    subtitle: "黑矿晶核与回声刻痕",
    fileName: "mine-echo-relic.png",
    path: "obsidian-epoch/assets/item/mine-echo-relic.png",
    url: "/api/epoch/assets/item/mine-echo-relic.png",
    contentType: EPOCH_ITEM_ASSET_CONTENT_TYPE,
    width: EPOCH_ITEM_ASSET_WIDTH,
    height: EPOCH_ITEM_ASSET_HEIGHT,
    palette: ["#120f18", "#3f3f46", "#a78bfa", "#f8fafc"],
    accentColor: "#a78bfa",
    publicAlt: "黑曜纪元矿脉回声遗物的服务器物品图标。",
  },
] as const satisfies readonly EpochItemAssetRecord[];

export function epochItemAssetByFileName(fileName: string): EpochItemAssetRecord | undefined {
  return EPOCH_ITEM_ASSETS.find((asset) => asset.fileName === fileName);
}

export function epochItemAssetForKey(itemKey: string): EpochItemAssetRecord | undefined {
  return EPOCH_ITEM_ASSETS.find((asset) => asset.itemKey === itemKey);
}

export function epochItemAssetFilePath(asset: EpochItemAssetRecord, packageRoot = defaultPackageRoot) {
  return join(packageRoot, asset.path);
}

export async function readEpochItemAssetByFileName(fileName: string, packageRoot = defaultPackageRoot) {
  const asset = epochItemAssetByFileName(fileName);
  if (!asset) return undefined;
  const content = await readFile(epochItemAssetFilePath(asset, packageRoot));
  return { asset, content };
}

export async function epochItemAssetManifestEntries(packageRoot = defaultPackageRoot): Promise<EpochItemAssetManifestEntry[]> {
  return Promise.all(EPOCH_ITEM_ASSETS.map(async (asset) => {
    const content = await readFile(epochItemAssetFilePath(asset, packageRoot));
    return {
      itemKey: asset.itemKey,
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

export function epochItemMediaForKey(itemKey: string): EpochItemMedia | undefined {
  const asset = epochItemAssetForKey(itemKey);
  if (!asset) return undefined;
  return {
    itemKey: asset.itemKey,
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
