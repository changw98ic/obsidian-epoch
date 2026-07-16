import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const EPOCH_WORLD_SURFACE_ASSET_WIDTH = 512;
export const EPOCH_WORLD_SURFACE_ASSET_HEIGHT = 512;
export const EPOCH_WORLD_SURFACE_ASSET_CONTENT_TYPE = "image/png" as const;

const serverRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const defaultPackageRoot = join(serverRoot, "package");

export type EpochWorldSurfaceAssetKey =
  | "world_news"
  | "audit_replay"
  | "market_board"
  | "operator_watch"
  | "result_page"
  | "death_archive"
  | "install_portal"
  | "web_bridge";

export interface EpochWorldSurfaceAssetRecord {
  readonly surfaceKey: EpochWorldSurfaceAssetKey;
  readonly title: string;
  readonly subtitle: string;
  readonly fileName: string;
  readonly path: string;
  readonly url: string;
  readonly contentType: typeof EPOCH_WORLD_SURFACE_ASSET_CONTENT_TYPE;
  readonly width: number;
  readonly height: number;
  readonly palette: readonly string[];
  readonly accentColor: string;
  readonly publicAlt: string;
  readonly sigil: "broadcast" | "ledger" | "market" | "watch" | "page" | "archive" | "portal" | "bridge";
}

export interface EpochWorldSurfaceAssetManifestEntry {
  readonly surfaceKey: EpochWorldSurfaceAssetKey;
  readonly title: string;
  readonly subtitle: string;
  readonly path: string;
  readonly url: string;
  readonly contentType: typeof EPOCH_WORLD_SURFACE_ASSET_CONTENT_TYPE;
  readonly width: number;
  readonly height: number;
  readonly sha256: string;
}

export interface EpochWorldSurfaceMedia {
  readonly surfaceKey: EpochWorldSurfaceAssetKey;
  readonly title: string;
  readonly subtitle: string;
  readonly palette: readonly string[];
  readonly accentColor: string;
  readonly publicAlt: string;
  readonly assetPath: string;
  readonly imageUrl: string;
  readonly contentType: typeof EPOCH_WORLD_SURFACE_ASSET_CONTENT_TYPE;
  readonly width: number;
  readonly height: number;
}

export const EPOCH_WORLD_SURFACE_ASSETS = [
  {
    surfaceKey: "world_news",
    title: "世界新闻",
    subtitle: "服务器整理的区域新闻与传说提醒",
    fileName: "world-news-surface.png",
    path: "obsidian-epoch/assets/surface/world-news-surface.png",
    url: "/api/epoch/assets/surface/world-news-surface.png",
    contentType: EPOCH_WORLD_SURFACE_ASSET_CONTENT_TYPE,
    width: EPOCH_WORLD_SURFACE_ASSET_WIDTH,
    height: EPOCH_WORLD_SURFACE_ASSET_HEIGHT,
    palette: ["#08111f", "#0f766e", "#67e8f9", "#f8fafc"],
    accentColor: "#67e8f9",
    sigil: "broadcast",
    publicAlt: "黑曜纪元世界新闻公共表面图标。",
  },
  {
    surfaceKey: "audit_replay",
    title: "审计回放",
    subtitle: "高影响事件的公开脱敏证据链",
    fileName: "audit-replay-surface.png",
    path: "obsidian-epoch/assets/surface/audit-replay-surface.png",
    url: "/api/epoch/assets/surface/audit-replay-surface.png",
    contentType: EPOCH_WORLD_SURFACE_ASSET_CONTENT_TYPE,
    width: EPOCH_WORLD_SURFACE_ASSET_WIDTH,
    height: EPOCH_WORLD_SURFACE_ASSET_HEIGHT,
    palette: ["#101820", "#475569", "#d6b076", "#f8fafc"],
    accentColor: "#d6b076",
    sigil: "ledger",
    publicAlt: "黑曜纪元审计回放公共表面图标。",
  },
  {
    surfaceKey: "market_board",
    title: "市场看板",
    subtitle: "区域订单、费用和风控状态",
    fileName: "market-board-surface.png",
    path: "obsidian-epoch/assets/surface/market-board-surface.png",
    url: "/api/epoch/assets/surface/market-board-surface.png",
    contentType: EPOCH_WORLD_SURFACE_ASSET_CONTENT_TYPE,
    width: EPOCH_WORLD_SURFACE_ASSET_WIDTH,
    height: EPOCH_WORLD_SURFACE_ASSET_HEIGHT,
    palette: ["#18120f", "#7c2d12", "#f59e0b", "#f8fafc"],
    accentColor: "#f59e0b",
    sigil: "market",
    publicAlt: "黑曜纪元市场看板公共表面图标。",
  },
  {
    surfaceKey: "operator_watch",
    title: "运营观察",
    subtitle: "审核、滥用、维护和风险队列",
    fileName: "operator-watch-surface.png",
    path: "obsidian-epoch/assets/surface/operator-watch-surface.png",
    url: "/api/epoch/assets/surface/operator-watch-surface.png",
    contentType: EPOCH_WORLD_SURFACE_ASSET_CONTENT_TYPE,
    width: EPOCH_WORLD_SURFACE_ASSET_WIDTH,
    height: EPOCH_WORLD_SURFACE_ASSET_HEIGHT,
    palette: ["#111112", "#52525b", "#e5e7eb", "#d6b076"],
    accentColor: "#e5e7eb",
    sigil: "watch",
    publicAlt: "黑曜纪元运营观察公共表面图标。",
  },
  {
    surfaceKey: "result_page",
    title: "结果页面",
    subtitle: "一次性分享和继续行动入口",
    fileName: "result-page-surface.png",
    path: "obsidian-epoch/assets/surface/result-page-surface.png",
    url: "/api/epoch/assets/surface/result-page-surface.png",
    contentType: EPOCH_WORLD_SURFACE_ASSET_CONTENT_TYPE,
    width: EPOCH_WORLD_SURFACE_ASSET_WIDTH,
    height: EPOCH_WORLD_SURFACE_ASSET_HEIGHT,
    palette: ["#0b1020", "#1d4ed8", "#bfdbfe", "#f8fafc"],
    accentColor: "#bfdbfe",
    sigil: "page",
    publicAlt: "黑曜纪元结果页面公共表面图标。",
  },
  {
    surfaceKey: "death_archive",
    title: "死亡归档",
    subtitle: "寿命结束后的身份定档和下一世",
    fileName: "death-archive-surface.png",
    path: "obsidian-epoch/assets/surface/death-archive-surface.png",
    url: "/api/epoch/assets/surface/death-archive-surface.png",
    contentType: EPOCH_WORLD_SURFACE_ASSET_CONTENT_TYPE,
    width: EPOCH_WORLD_SURFACE_ASSET_WIDTH,
    height: EPOCH_WORLD_SURFACE_ASSET_HEIGHT,
    palette: ["#140f12", "#7f1d1d", "#f97316", "#f8fafc"],
    accentColor: "#f97316",
    sigil: "archive",
    publicAlt: "黑曜纪元死亡归档公共表面图标。",
  },
  {
    surfaceKey: "install_portal",
    title: "安装入口",
    subtitle: "通用 MCP + Skill 包下载与多宿主配置",
    fileName: "install-portal-surface.png",
    path: "obsidian-epoch/assets/surface/install-portal-surface.png",
    url: "/api/epoch/assets/surface/install-portal-surface.png",
    contentType: EPOCH_WORLD_SURFACE_ASSET_CONTENT_TYPE,
    width: EPOCH_WORLD_SURFACE_ASSET_WIDTH,
    height: EPOCH_WORLD_SURFACE_ASSET_HEIGHT,
    palette: ["#071315", "#0f766e", "#a7f3d0", "#f8fafc"],
    accentColor: "#a7f3d0",
    sigil: "portal",
    publicAlt: "黑曜纪元安装入口公共表面图标。",
  },
  {
    surfaceKey: "web_bridge",
    title: "网页桥接",
    subtitle: "网页端大模型也能参与的安全回合",
    fileName: "web-bridge-surface.png",
    path: "obsidian-epoch/assets/surface/web-bridge-surface.png",
    url: "/api/epoch/assets/surface/web-bridge-surface.png",
    contentType: EPOCH_WORLD_SURFACE_ASSET_CONTENT_TYPE,
    width: EPOCH_WORLD_SURFACE_ASSET_WIDTH,
    height: EPOCH_WORLD_SURFACE_ASSET_HEIGHT,
    palette: ["#130f18", "#7c3aed", "#c4b5fd", "#f8fafc"],
    accentColor: "#c4b5fd",
    sigil: "bridge",
    publicAlt: "黑曜纪元网页桥接公共表面图标。",
  },
] as const satisfies readonly EpochWorldSurfaceAssetRecord[];

function worldSurfaceAssetFilePath(asset: EpochWorldSurfaceAssetRecord, packageRoot = defaultPackageRoot) {
  return join(packageRoot, asset.path);
}

export function epochWorldSurfaceAssetByFileName(fileName: string): EpochWorldSurfaceAssetRecord | undefined {
  return EPOCH_WORLD_SURFACE_ASSETS.find((asset) => asset.fileName === fileName);
}

export function epochWorldSurfaceAssetForKey(surfaceKey: EpochWorldSurfaceAssetKey): EpochWorldSurfaceAssetRecord | undefined {
  return EPOCH_WORLD_SURFACE_ASSETS.find((asset) => asset.surfaceKey === surfaceKey);
}

export async function readEpochWorldSurfaceAssetByFileName(fileName: string, packageRoot = defaultPackageRoot) {
  const asset = epochWorldSurfaceAssetByFileName(fileName);
  if (!asset) return undefined;
  const content = await readFile(worldSurfaceAssetFilePath(asset, packageRoot));
  return { asset, content };
}

export async function epochWorldSurfaceAssetManifestEntries(packageRoot = defaultPackageRoot): Promise<EpochWorldSurfaceAssetManifestEntry[]> {
  return Promise.all(EPOCH_WORLD_SURFACE_ASSETS.map(async (asset) => {
    const content = await readFile(worldSurfaceAssetFilePath(asset, packageRoot));
    return {
      surfaceKey: asset.surfaceKey,
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

export function epochWorldSurfaceMediaForKey(surfaceKey: EpochWorldSurfaceAssetKey): EpochWorldSurfaceMedia | undefined {
  const asset = epochWorldSurfaceAssetForKey(surfaceKey);
  if (!asset) return undefined;
  return {
    surfaceKey: asset.surfaceKey,
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
