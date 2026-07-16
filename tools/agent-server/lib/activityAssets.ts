import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const EPOCH_ACTIVITY_ASSET_WIDTH = 512;
export const EPOCH_ACTIVITY_ASSET_HEIGHT = 512;
export const EPOCH_ACTIVITY_ASSET_CONTENT_TYPE = "image/png" as const;

const serverRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const defaultPackageRoot = join(serverRoot, "package");

export type EpochActivityAssetKey =
  | "objective"
  | "resource_node"
  | "anomaly"
  | "bounty"
  | "party_run"
  | "social_hook"
  | "retaliation"
  | "turn_card"
  | "downtime"
  | "reincarnation";

export interface EpochActivityAssetRecord {
  readonly activityKey: EpochActivityAssetKey;
  readonly title: string;
  readonly subtitle: string;
  readonly fileName: string;
  readonly path: string;
  readonly url: string;
  readonly contentType: typeof EPOCH_ACTIVITY_ASSET_CONTENT_TYPE;
  readonly width: number;
  readonly height: number;
  readonly palette: readonly string[];
  readonly accentColor: string;
  readonly publicAlt: string;
  readonly sigil: "standard" | "node" | "rift" | "seal" | "thread" | "blade" | "card" | "clock" | "spiral";
}

export interface EpochActivityAssetManifestEntry {
  readonly activityKey: EpochActivityAssetKey;
  readonly title: string;
  readonly subtitle: string;
  readonly path: string;
  readonly url: string;
  readonly contentType: typeof EPOCH_ACTIVITY_ASSET_CONTENT_TYPE;
  readonly width: number;
  readonly height: number;
  readonly sha256: string;
}

export interface EpochActivityMedia {
  readonly activityKey: EpochActivityAssetKey;
  readonly title: string;
  readonly subtitle: string;
  readonly palette: readonly string[];
  readonly accentColor: string;
  readonly publicAlt: string;
  readonly assetPath: string;
  readonly imageUrl: string;
  readonly contentType: typeof EPOCH_ACTIVITY_ASSET_CONTENT_TYPE;
  readonly width: number;
  readonly height: number;
}

export const EPOCH_ACTIVITY_ASSETS = [
  {
    activityKey: "objective",
    title: "区域目标",
    subtitle: "多人贡献推进的公开目标",
    fileName: "objective-activity.png",
    path: "obsidian-epoch/assets/activity/objective-activity.png",
    url: "/api/epoch/assets/activity/objective-activity.png",
    contentType: EPOCH_ACTIVITY_ASSET_CONTENT_TYPE,
    width: EPOCH_ACTIVITY_ASSET_WIDTH,
    height: EPOCH_ACTIVITY_ASSET_HEIGHT,
    palette: ["#101820", "#475569", "#d6b076", "#f8fafc"],
    accentColor: "#d6b076",
    sigil: "standard",
    publicAlt: "黑曜纪元区域目标行动图标。",
  },
  {
    activityKey: "resource_node",
    title: "资源争夺",
    subtitle: "开放资源点的竞争行动",
    fileName: "resource-node-activity.png",
    path: "obsidian-epoch/assets/activity/resource-node-activity.png",
    url: "/api/epoch/assets/activity/resource-node-activity.png",
    contentType: EPOCH_ACTIVITY_ASSET_CONTENT_TYPE,
    width: EPOCH_ACTIVITY_ASSET_WIDTH,
    height: EPOCH_ACTIVITY_ASSET_HEIGHT,
    palette: ["#071315", "#0f766e", "#67e8f9", "#f8fafc"],
    accentColor: "#67e8f9",
    sigil: "node",
    publicAlt: "黑曜纪元资源争夺行动图标。",
  },
  {
    activityKey: "anomaly",
    title: "异常压制",
    subtitle: "处理区域异常链的高风险行动",
    fileName: "anomaly-activity.png",
    path: "obsidian-epoch/assets/activity/anomaly-activity.png",
    url: "/api/epoch/assets/activity/anomaly-activity.png",
    contentType: EPOCH_ACTIVITY_ASSET_CONTENT_TYPE,
    width: EPOCH_ACTIVITY_ASSET_WIDTH,
    height: EPOCH_ACTIVITY_ASSET_HEIGHT,
    palette: ["#0b1020", "#1d4ed8", "#bfdbfe", "#f8fafc"],
    accentColor: "#bfdbfe",
    sigil: "rift",
    publicAlt: "黑曜纪元异常压制行动图标。",
  },
  {
    activityKey: "bounty",
    title: "悬赏契约",
    subtitle: "玩家发布并由服务器结算的悬赏",
    fileName: "bounty-activity.png",
    path: "obsidian-epoch/assets/activity/bounty-activity.png",
    url: "/api/epoch/assets/activity/bounty-activity.png",
    contentType: EPOCH_ACTIVITY_ASSET_CONTENT_TYPE,
    width: EPOCH_ACTIVITY_ASSET_WIDTH,
    height: EPOCH_ACTIVITY_ASSET_HEIGHT,
    palette: ["#18120f", "#7c2d12", "#f59e0b", "#f8fafc"],
    accentColor: "#f59e0b",
    sigil: "seal",
    publicAlt: "黑曜纪元悬赏契约行动图标。",
  },
  {
    activityKey: "party_run",
    title: "小队任务",
    subtitle: "多个 agent 身份共同加入的开放任务",
    fileName: "social-hook-activity.png",
    path: "obsidian-epoch/assets/activity/social-hook-activity.png",
    url: "/api/epoch/assets/activity/social-hook-activity.png",
    contentType: EPOCH_ACTIVITY_ASSET_CONTENT_TYPE,
    width: EPOCH_ACTIVITY_ASSET_WIDTH,
    height: EPOCH_ACTIVITY_ASSET_HEIGHT,
    palette: ["#101820", "#0f766e", "#d6b076", "#f8fafc"],
    accentColor: "#d6b076",
    sigil: "thread",
    publicAlt: "黑曜纪元小队任务行动图标。",
  },
  {
    activityKey: "social_hook",
    title: "人物事件",
    subtitle: "NPC、组织与关系网触发的行动",
    fileName: "social-hook-activity.png",
    path: "obsidian-epoch/assets/activity/social-hook-activity.png",
    url: "/api/epoch/assets/activity/social-hook-activity.png",
    contentType: EPOCH_ACTIVITY_ASSET_CONTENT_TYPE,
    width: EPOCH_ACTIVITY_ASSET_WIDTH,
    height: EPOCH_ACTIVITY_ASSET_HEIGHT,
    palette: ["#130f18", "#7c3aed", "#c4b5fd", "#f8fafc"],
    accentColor: "#c4b5fd",
    sigil: "thread",
    publicAlt: "黑曜纪元人物事件行动图标。",
  },
  {
    activityKey: "retaliation",
    title: "复仇契机",
    subtitle: "被袭击后由服务器开放的反击窗口",
    fileName: "retaliation-activity.png",
    path: "obsidian-epoch/assets/activity/retaliation-activity.png",
    url: "/api/epoch/assets/activity/retaliation-activity.png",
    contentType: EPOCH_ACTIVITY_ASSET_CONTENT_TYPE,
    width: EPOCH_ACTIVITY_ASSET_WIDTH,
    height: EPOCH_ACTIVITY_ASSET_HEIGHT,
    palette: ["#140f12", "#7f1d1d", "#f97316", "#f8fafc"],
    accentColor: "#f97316",
    sigil: "blade",
    publicAlt: "黑曜纪元复仇契机行动图标。",
  },
  {
    activityKey: "turn_card",
    title: "继续回合",
    subtitle: "服务器发放的新回合卡",
    fileName: "turn-card-activity.png",
    path: "obsidian-epoch/assets/activity/turn-card-activity.png",
    url: "/api/epoch/assets/activity/turn-card-activity.png",
    contentType: EPOCH_ACTIVITY_ASSET_CONTENT_TYPE,
    width: EPOCH_ACTIVITY_ASSET_WIDTH,
    height: EPOCH_ACTIVITY_ASSET_HEIGHT,
    palette: ["#0b1120", "#334155", "#93c5fd", "#f8fafc"],
    accentColor: "#93c5fd",
    sigil: "card",
    publicAlt: "黑曜纪元继续回合行动图标。",
  },
  {
    activityKey: "downtime",
    title: "设置托管",
    subtitle: "离线时的冥想、修炼、锻炼或外出",
    fileName: "downtime-activity.png",
    path: "obsidian-epoch/assets/activity/downtime-activity.png",
    url: "/api/epoch/assets/activity/downtime-activity.png",
    contentType: EPOCH_ACTIVITY_ASSET_CONTENT_TYPE,
    width: EPOCH_ACTIVITY_ASSET_WIDTH,
    height: EPOCH_ACTIVITY_ASSET_HEIGHT,
    palette: ["#08111f", "#0f766e", "#82d3c8", "#f8fafc"],
    accentColor: "#82d3c8",
    sigil: "clock",
    publicAlt: "黑曜纪元设置托管行动图标。",
  },
  {
    activityKey: "reincarnation",
    title: "下一世身份",
    subtitle: "寿命结束后的服务器新身份",
    fileName: "reincarnation-activity.png",
    path: "obsidian-epoch/assets/activity/reincarnation-activity.png",
    url: "/api/epoch/assets/activity/reincarnation-activity.png",
    contentType: EPOCH_ACTIVITY_ASSET_CONTENT_TYPE,
    width: EPOCH_ACTIVITY_ASSET_WIDTH,
    height: EPOCH_ACTIVITY_ASSET_HEIGHT,
    palette: ["#111112", "#52525b", "#e5e7eb", "#d6b076"],
    accentColor: "#e5e7eb",
    sigil: "spiral",
    publicAlt: "黑曜纪元下一世身份行动图标。",
  },
] as const satisfies readonly EpochActivityAssetRecord[];

function activityAssetFilePath(asset: EpochActivityAssetRecord, packageRoot = defaultPackageRoot) {
  return join(packageRoot, asset.path);
}

export function epochActivityAssetByFileName(fileName: string): EpochActivityAssetRecord | undefined {
  return EPOCH_ACTIVITY_ASSETS.find((asset) => asset.fileName === fileName);
}

export function epochActivityAssetForKey(activityKey: EpochActivityAssetKey): EpochActivityAssetRecord | undefined {
  return EPOCH_ACTIVITY_ASSETS.find((asset) => asset.activityKey === activityKey);
}

export async function readEpochActivityAssetByFileName(fileName: string, packageRoot = defaultPackageRoot) {
  const asset = epochActivityAssetByFileName(fileName);
  if (!asset) return undefined;
  const content = await readFile(activityAssetFilePath(asset, packageRoot));
  return { asset, content };
}

export async function epochActivityAssetManifestEntries(packageRoot = defaultPackageRoot): Promise<EpochActivityAssetManifestEntry[]> {
  return Promise.all(EPOCH_ACTIVITY_ASSETS.map(async (asset) => {
    const content = await readFile(activityAssetFilePath(asset, packageRoot));
    return {
      activityKey: asset.activityKey,
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

export function epochActivityMediaForKey(activityKey: EpochActivityAssetKey): EpochActivityMedia | undefined {
  const asset = epochActivityAssetForKey(activityKey);
  if (!asset) return undefined;
  return {
    activityKey: asset.activityKey,
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
