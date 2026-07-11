import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const EPOCH_EVENT_STATE_WIDTH = 960;
export const EPOCH_EVENT_STATE_HEIGHT = 540;
export const EPOCH_EVENT_STATE_CONTENT_TYPE = "image/png" as const;

const serverRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const defaultPackageRoot = join(serverRoot, "package");

export type EpochEventStateKey =
  | "resource_node_open"
  | "resource_node_contested"
  | "anomaly_containment"
  | "bounty_contract"
  | "market_convoy"
  | "season_resolution";

export interface EpochEventStateRecord {
  readonly stateKey: EpochEventStateKey;
  readonly title: string;
  readonly subtitle: string;
  readonly fileName: string;
  readonly path: string;
  readonly url: string;
  readonly contentType: typeof EPOCH_EVENT_STATE_CONTENT_TYPE;
  readonly width: number;
  readonly height: number;
  readonly palette: readonly string[];
  readonly accentColor: string;
  readonly publicAlt: string;
  readonly motif: "resource-open" | "resource-contested" | "anomaly" | "bounty" | "market" | "season";
}

export interface EpochEventStateManifestEntry {
  readonly stateKey: EpochEventStateKey;
  readonly title: string;
  readonly subtitle: string;
  readonly path: string;
  readonly url: string;
  readonly contentType: typeof EPOCH_EVENT_STATE_CONTENT_TYPE;
  readonly width: number;
  readonly height: number;
  readonly sha256: string;
}

export interface EpochEventStateMedia {
  readonly stateKey: EpochEventStateKey;
  readonly title: string;
  readonly subtitle: string;
  readonly palette: readonly string[];
  readonly accentColor: string;
  readonly publicAlt: string;
  readonly assetPath: string;
  readonly imageUrl: string;
  readonly contentType: typeof EPOCH_EVENT_STATE_CONTENT_TYPE;
  readonly width: number;
  readonly height: number;
}

export const EPOCH_EVENT_STATE_ASSETS = [
  {
    stateKey: "resource_node_open",
    title: "资源点开放",
    subtitle: "服务器开放限时采集窗口，agent 可争夺贡献。",
    fileName: "resource-node-open-event-state.png",
    path: "obsidian-epoch/assets/event-state/resource-node-open-event-state.png",
    url: "/api/epoch/assets/event-state/resource-node-open-event-state.png",
    contentType: EPOCH_EVENT_STATE_CONTENT_TYPE,
    width: EPOCH_EVENT_STATE_WIDTH,
    height: EPOCH_EVENT_STATE_HEIGHT,
    palette: ["#10160d", "#3f6212", "#bef264", "#facc15"],
    accentColor: "#bef264",
    publicAlt: "资源点开放状态图，显示发光矿脉、采集窗口和服务器倒计时标记。",
    motif: "resource-open",
  },
  {
    stateKey: "resource_node_contested",
    title: "资源点争夺",
    subtitle: "多个身份围绕公开资源点竞争，结算由服务器执行。",
    fileName: "resource-node-contested-event-state.png",
    path: "obsidian-epoch/assets/event-state/resource-node-contested-event-state.png",
    url: "/api/epoch/assets/event-state/resource-node-contested-event-state.png",
    contentType: EPOCH_EVENT_STATE_CONTENT_TYPE,
    width: EPOCH_EVENT_STATE_WIDTH,
    height: EPOCH_EVENT_STATE_HEIGHT,
    palette: ["#151006", "#92400e", "#fde68a", "#ef4444"],
    accentColor: "#fde68a",
    publicAlt: "资源点争夺状态图，显示竞价旗、贡献轨迹和服务器结算光环。",
    motif: "resource-contested",
  },
  {
    stateKey: "anomaly_containment",
    title: "异常压制",
    subtitle: "区域异常链进入压制阶段，风险和寿命损耗需要服务器判定。",
    fileName: "anomaly-containment-event-state.png",
    path: "obsidian-epoch/assets/event-state/anomaly-containment-event-state.png",
    url: "/api/epoch/assets/event-state/anomaly-containment-event-state.png",
    contentType: EPOCH_EVENT_STATE_CONTENT_TYPE,
    width: EPOCH_EVENT_STATE_WIDTH,
    height: EPOCH_EVENT_STATE_HEIGHT,
    palette: ["#120f18", "#581c87", "#c4b5fd", "#f43f5e"],
    accentColor: "#c4b5fd",
    publicAlt: "异常压制状态图，显示裂隙、压制阵列和服务器风险封条。",
    motif: "anomaly",
  },
  {
    stateKey: "bounty_contract",
    title: "悬赏契约",
    subtitle: "玩家发布或领取悬赏，资源托管在服务器账本。",
    fileName: "bounty-contract-event-state.png",
    path: "obsidian-epoch/assets/event-state/bounty-contract-event-state.png",
    url: "/api/epoch/assets/event-state/bounty-contract-event-state.png",
    contentType: EPOCH_EVENT_STATE_CONTENT_TYPE,
    width: EPOCH_EVENT_STATE_WIDTH,
    height: EPOCH_EVENT_STATE_HEIGHT,
    palette: ["#17100f", "#7f1d1d", "#f97316", "#f8fafc"],
    accentColor: "#f97316",
    publicAlt: "悬赏契约状态图，显示封蜡契约、托管赏金和目标剪影。",
    motif: "bounty",
  },
  {
    stateKey: "market_convoy",
    title: "市场护送",
    subtitle: "区域交易、护送委托和风险审核正在等待服务器确认。",
    fileName: "market-convoy-event-state.png",
    path: "obsidian-epoch/assets/event-state/market-convoy-event-state.png",
    url: "/api/epoch/assets/event-state/market-convoy-event-state.png",
    contentType: EPOCH_EVENT_STATE_CONTENT_TYPE,
    width: EPOCH_EVENT_STATE_WIDTH,
    height: EPOCH_EVENT_STATE_HEIGHT,
    palette: ["#18120f", "#854d0e", "#facc15", "#f8fafc"],
    accentColor: "#facc15",
    publicAlt: "市场护送状态图，显示货车、市场账本和服务器风险审核灯。",
    motif: "market",
  },
  {
    stateKey: "season_resolution",
    title: "赛季结算",
    subtitle: "阵营、榜单、纪念碑和传说奖励由服务器归档。",
    fileName: "season-resolution-event-state.png",
    path: "obsidian-epoch/assets/event-state/season-resolution-event-state.png",
    url: "/api/epoch/assets/event-state/season-resolution-event-state.png",
    contentType: EPOCH_EVENT_STATE_CONTENT_TYPE,
    width: EPOCH_EVENT_STATE_WIDTH,
    height: EPOCH_EVENT_STATE_HEIGHT,
    palette: ["#0b1120", "#1d4ed8", "#bfdbfe", "#f8fafc"],
    accentColor: "#bfdbfe",
    publicAlt: "赛季结算状态图，显示阵营横幅、榜单石碑和服务器归档印记。",
    motif: "season",
  },
] as const satisfies readonly EpochEventStateRecord[];

function eventStateFilePath(asset: EpochEventStateRecord, packageRoot = defaultPackageRoot) {
  return join(packageRoot, asset.path);
}

export function epochEventStateByFileName(fileName: string): EpochEventStateRecord | undefined {
  return EPOCH_EVENT_STATE_ASSETS.find((asset) => asset.fileName === fileName);
}

export async function readEpochEventStateByFileName(fileName: string, packageRoot = defaultPackageRoot) {
  const asset = epochEventStateByFileName(fileName);
  if (!asset) return undefined;
  const content = await readFile(eventStateFilePath(asset, packageRoot));
  return { asset, content };
}

export async function epochEventStateManifestEntries(packageRoot = defaultPackageRoot): Promise<EpochEventStateManifestEntry[]> {
  return Promise.all(EPOCH_EVENT_STATE_ASSETS.map(async (asset) => {
    const content = await readFile(eventStateFilePath(asset, packageRoot));
    return {
      stateKey: asset.stateKey,
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

export function epochEventStateMedia(asset: EpochEventStateRecord): EpochEventStateMedia {
  return {
    stateKey: asset.stateKey,
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
