import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const EPOCH_PAGE_SCENE_ASSET_WIDTH = 960;
export const EPOCH_PAGE_SCENE_ASSET_HEIGHT = 540;
export const EPOCH_PAGE_SCENE_ASSET_CONTENT_TYPE = "image/png" as const;

const serverRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const defaultPackageRoot = join(serverRoot, "package");

export type EpochPageSceneAssetKey =
  | "install_portal"
  | "explorer_dashboard"
  | "agent_status"
  | "region_state"
  | "season_archive"
  | "npc_profile"
  | "death_archive"
  | "audit_replay"
  | "result_page"
  | "web_bridge"
  | "market_board"
  | "operator_console";

export interface EpochPageSceneAssetRecord {
  readonly sceneKey: EpochPageSceneAssetKey;
  readonly title: string;
  readonly subtitle: string;
  readonly fileName: string;
  readonly path: string;
  readonly url: string;
  readonly contentType: typeof EPOCH_PAGE_SCENE_ASSET_CONTENT_TYPE;
  readonly width: number;
  readonly height: number;
  readonly palette: readonly string[];
  readonly accentColor: string;
  readonly publicAlt: string;
  readonly motif: "portal" | "dashboard" | "identity" | "region" | "season" | "portrait" | "archive" | "audit" | "result" | "bridge" | "market" | "operator";
}

export interface EpochPageSceneAssetManifestEntry {
  readonly sceneKey: EpochPageSceneAssetKey;
  readonly title: string;
  readonly subtitle: string;
  readonly path: string;
  readonly url: string;
  readonly contentType: typeof EPOCH_PAGE_SCENE_ASSET_CONTENT_TYPE;
  readonly width: number;
  readonly height: number;
  readonly sha256: string;
}

export interface EpochPageSceneMedia {
  readonly sceneKey: EpochPageSceneAssetKey;
  readonly title: string;
  readonly subtitle: string;
  readonly palette: readonly string[];
  readonly accentColor: string;
  readonly publicAlt: string;
  readonly assetPath: string;
  readonly imageUrl: string;
  readonly contentType: typeof EPOCH_PAGE_SCENE_ASSET_CONTENT_TYPE;
  readonly width: number;
  readonly height: number;
}

export const EPOCH_PAGE_SCENE_ASSETS = [
  {
    sceneKey: "install_portal",
    title: "安装入口场景",
    subtitle: "多宿主 MCP 与 Skill 包入口",
    fileName: "install-portal-page-scene.png",
    path: "obsidian-epoch/assets/page-scene/install-portal-page-scene.png",
    url: "/api/epoch/assets/page-scene/install-portal-page-scene.png",
    contentType: EPOCH_PAGE_SCENE_ASSET_CONTENT_TYPE,
    width: EPOCH_PAGE_SCENE_ASSET_WIDTH,
    height: EPOCH_PAGE_SCENE_ASSET_HEIGHT,
    palette: ["#071315", "#0f766e", "#a7f3d0", "#f8fafc"],
    accentColor: "#a7f3d0",
    motif: "portal",
    publicAlt: "黑曜纪元安装入口的服务器打包页面场景图。",
  },
  {
    sceneKey: "explorer_dashboard",
    title: "玩家档案场景",
    subtitle: "同一 Explorer 的身份世系总览",
    fileName: "explorer-dashboard-page-scene.png",
    path: "obsidian-epoch/assets/page-scene/explorer-dashboard-page-scene.png",
    url: "/api/epoch/assets/page-scene/explorer-dashboard-page-scene.png",
    contentType: EPOCH_PAGE_SCENE_ASSET_CONTENT_TYPE,
    width: EPOCH_PAGE_SCENE_ASSET_WIDTH,
    height: EPOCH_PAGE_SCENE_ASSET_HEIGHT,
    palette: ["#101820", "#475569", "#d6b076", "#f8fafc"],
    accentColor: "#d6b076",
    motif: "dashboard",
    publicAlt: "黑曜纪元玩家档案仪表盘的服务器打包页面场景图。",
  },
  {
    sceneKey: "agent_status",
    title: "身份状态场景",
    subtitle: "单个 agent 身份的公开进度页",
    fileName: "agent-status-page-scene.png",
    path: "obsidian-epoch/assets/page-scene/agent-status-page-scene.png",
    url: "/api/epoch/assets/page-scene/agent-status-page-scene.png",
    contentType: EPOCH_PAGE_SCENE_ASSET_CONTENT_TYPE,
    width: EPOCH_PAGE_SCENE_ASSET_WIDTH,
    height: EPOCH_PAGE_SCENE_ASSET_HEIGHT,
    palette: ["#0b1120", "#334155", "#93c5fd", "#f8fafc"],
    accentColor: "#93c5fd",
    motif: "identity",
    publicAlt: "黑曜纪元身份状态公开页的服务器打包页面场景图。",
  },
  {
    sceneKey: "region_state",
    title: "区域状态场景",
    subtitle: "区域新闻、委托、NPC 与冲突投影",
    fileName: "region-state-page-scene.png",
    path: "obsidian-epoch/assets/page-scene/region-state-page-scene.png",
    url: "/api/epoch/assets/page-scene/region-state-page-scene.png",
    contentType: EPOCH_PAGE_SCENE_ASSET_CONTENT_TYPE,
    width: EPOCH_PAGE_SCENE_ASSET_WIDTH,
    height: EPOCH_PAGE_SCENE_ASSET_HEIGHT,
    palette: ["#08111f", "#0f766e", "#67e8f9", "#f8fafc"],
    accentColor: "#67e8f9",
    motif: "region",
    publicAlt: "黑曜纪元区域状态公开页的服务器打包页面场景图。",
  },
  {
    sceneKey: "season_archive",
    title: "赛季档案场景",
    subtitle: "阵营战争与赛季归档页面",
    fileName: "season-archive-page-scene.png",
    path: "obsidian-epoch/assets/page-scene/season-archive-page-scene.png",
    url: "/api/epoch/assets/page-scene/season-archive-page-scene.png",
    contentType: EPOCH_PAGE_SCENE_ASSET_CONTENT_TYPE,
    width: EPOCH_PAGE_SCENE_ASSET_WIDTH,
    height: EPOCH_PAGE_SCENE_ASSET_HEIGHT,
    palette: ["#18120f", "#7c2d12", "#f59e0b", "#f8fafc"],
    accentColor: "#f59e0b",
    motif: "season",
    publicAlt: "黑曜纪元赛季档案公开页的服务器打包页面场景图。",
  },
  {
    sceneKey: "npc_profile",
    title: "NPC 档案场景",
    subtitle: "服务器 canonical NPC 的公开资料页",
    fileName: "npc-profile-page-scene.png",
    path: "obsidian-epoch/assets/page-scene/npc-profile-page-scene.png",
    url: "/api/epoch/assets/page-scene/npc-profile-page-scene.png",
    contentType: EPOCH_PAGE_SCENE_ASSET_CONTENT_TYPE,
    width: EPOCH_PAGE_SCENE_ASSET_WIDTH,
    height: EPOCH_PAGE_SCENE_ASSET_HEIGHT,
    palette: ["#130f18", "#7c3aed", "#c4b5fd", "#f8fafc"],
    accentColor: "#c4b5fd",
    motif: "portrait",
    publicAlt: "黑曜纪元 NPC 档案公开页的服务器打包页面场景图。",
  },
  {
    sceneKey: "death_archive",
    title: "死亡归档场景",
    subtitle: "身份定档、终局头衔与下一世",
    fileName: "death-archive-page-scene.png",
    path: "obsidian-epoch/assets/page-scene/death-archive-page-scene.png",
    url: "/api/epoch/assets/page-scene/death-archive-page-scene.png",
    contentType: EPOCH_PAGE_SCENE_ASSET_CONTENT_TYPE,
    width: EPOCH_PAGE_SCENE_ASSET_WIDTH,
    height: EPOCH_PAGE_SCENE_ASSET_HEIGHT,
    palette: ["#140f12", "#7f1d1d", "#f97316", "#f8fafc"],
    accentColor: "#f97316",
    motif: "archive",
    publicAlt: "黑曜纪元死亡归档公开页的服务器打包页面场景图。",
  },
  {
    sceneKey: "audit_replay",
    title: "审计回放场景",
    subtitle: "脱敏事件证据链和高影响回放",
    fileName: "audit-replay-page-scene.png",
    path: "obsidian-epoch/assets/page-scene/audit-replay-page-scene.png",
    url: "/api/epoch/assets/page-scene/audit-replay-page-scene.png",
    contentType: EPOCH_PAGE_SCENE_ASSET_CONTENT_TYPE,
    width: EPOCH_PAGE_SCENE_ASSET_WIDTH,
    height: EPOCH_PAGE_SCENE_ASSET_HEIGHT,
    palette: ["#111112", "#52525b", "#e5e7eb", "#d6b076"],
    accentColor: "#e5e7eb",
    motif: "audit",
    publicAlt: "黑曜纪元审计回放公开页的服务器打包页面场景图。",
  },
  {
    sceneKey: "result_page",
    title: "结果页面场景",
    subtitle: "一次性分享、区域上下文和服务器结算",
    fileName: "result-page-page-scene.png",
    path: "obsidian-epoch/assets/page-scene/result-page-page-scene.png",
    url: "/api/epoch/assets/page-scene/result-page-page-scene.png",
    contentType: EPOCH_PAGE_SCENE_ASSET_CONTENT_TYPE,
    width: EPOCH_PAGE_SCENE_ASSET_WIDTH,
    height: EPOCH_PAGE_SCENE_ASSET_HEIGHT,
    palette: ["#0b1020", "#1d4ed8", "#bfdbfe", "#f8fafc"],
    accentColor: "#bfdbfe",
    motif: "result",
    publicAlt: "黑曜纪元服务器结果页的打包页面场景图。",
  },
  {
    sceneKey: "web_bridge",
    title: "网页桥接场景",
    subtitle: "网页端大模型安全参与回合",
    fileName: "web-bridge-page-scene.png",
    path: "obsidian-epoch/assets/page-scene/web-bridge-page-scene.png",
    url: "/api/epoch/assets/page-scene/web-bridge-page-scene.png",
    contentType: EPOCH_PAGE_SCENE_ASSET_CONTENT_TYPE,
    width: EPOCH_PAGE_SCENE_ASSET_WIDTH,
    height: EPOCH_PAGE_SCENE_ASSET_HEIGHT,
    palette: ["#130f18", "#4c1d95", "#c4b5fd", "#f8fafc"],
    accentColor: "#c4b5fd",
    motif: "bridge",
    publicAlt: "黑曜纪元网页桥接流程的服务器打包页面场景图。",
  },
  {
    sceneKey: "market_board",
    title: "市场看板场景",
    subtitle: "区域交易、费用和风控状态",
    fileName: "market-board-page-scene.png",
    path: "obsidian-epoch/assets/page-scene/market-board-page-scene.png",
    url: "/api/epoch/assets/page-scene/market-board-page-scene.png",
    contentType: EPOCH_PAGE_SCENE_ASSET_CONTENT_TYPE,
    width: EPOCH_PAGE_SCENE_ASSET_WIDTH,
    height: EPOCH_PAGE_SCENE_ASSET_HEIGHT,
    palette: ["#18120f", "#7c2d12", "#facc15", "#f8fafc"],
    accentColor: "#facc15",
    motif: "market",
    publicAlt: "黑曜纪元市场看板的服务器打包页面场景图。",
  },
  {
    sceneKey: "operator_console",
    title: "运营控制台场景",
    subtitle: "审核、维护、滥用和风险队列",
    fileName: "operator-console-page-scene.png",
    path: "obsidian-epoch/assets/page-scene/operator-console-page-scene.png",
    url: "/api/epoch/assets/page-scene/operator-console-page-scene.png",
    contentType: EPOCH_PAGE_SCENE_ASSET_CONTENT_TYPE,
    width: EPOCH_PAGE_SCENE_ASSET_WIDTH,
    height: EPOCH_PAGE_SCENE_ASSET_HEIGHT,
    palette: ["#0f1115", "#4b5563", "#f8fafc", "#f97316"],
    accentColor: "#f8fafc",
    motif: "operator",
    publicAlt: "黑曜纪元运营控制台的服务器打包页面场景图。",
  },
] as const satisfies readonly EpochPageSceneAssetRecord[];

function pageSceneAssetFilePath(asset: EpochPageSceneAssetRecord, packageRoot = defaultPackageRoot) {
  return join(packageRoot, asset.path);
}

export function epochPageSceneAssetByFileName(fileName: string): EpochPageSceneAssetRecord | undefined {
  return EPOCH_PAGE_SCENE_ASSETS.find((asset) => asset.fileName === fileName);
}

export function epochPageSceneAssetForKey(sceneKey: EpochPageSceneAssetKey): EpochPageSceneAssetRecord | undefined {
  return EPOCH_PAGE_SCENE_ASSETS.find((asset) => asset.sceneKey === sceneKey);
}

export async function readEpochPageSceneAssetByFileName(fileName: string, packageRoot = defaultPackageRoot) {
  const asset = epochPageSceneAssetByFileName(fileName);
  if (!asset) return undefined;
  const content = await readFile(pageSceneAssetFilePath(asset, packageRoot));
  return { asset, content };
}

export async function epochPageSceneAssetManifestEntries(packageRoot = defaultPackageRoot): Promise<EpochPageSceneAssetManifestEntry[]> {
  return Promise.all(EPOCH_PAGE_SCENE_ASSETS.map(async (asset) => {
    const content = await readFile(pageSceneAssetFilePath(asset, packageRoot));
    return {
      sceneKey: asset.sceneKey,
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

export function epochPageSceneMediaForKey(sceneKey: EpochPageSceneAssetKey): EpochPageSceneMedia | undefined {
  const asset = epochPageSceneAssetForKey(sceneKey);
  if (!asset) return undefined;
  return {
    sceneKey: asset.sceneKey,
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
