import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const EPOCH_BOSS_ASSET_WIDTH = 960;
export const EPOCH_BOSS_ASSET_HEIGHT = 540;
export const EPOCH_BOSS_ASSET_CONTENT_TYPE = "image/png" as const;

const serverRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const defaultPackageRoot = join(serverRoot, "package");

export interface EpochBossAssetRecord {
  readonly templateKey: string;
  readonly title: string;
  readonly fileName: string;
  readonly path: string;
  readonly url: string;
  readonly contentType: typeof EPOCH_BOSS_ASSET_CONTENT_TYPE;
  readonly width: number;
  readonly height: number;
  readonly palette: readonly string[];
  readonly accentColor: string;
  readonly dangerColor: string;
  readonly sigil: string;
}

export interface EpochBossAssetManifestEntry {
  readonly templateKey: string;
  readonly title: string;
  readonly path: string;
  readonly url: string;
  readonly contentType: typeof EPOCH_BOSS_ASSET_CONTENT_TYPE;
  readonly width: number;
  readonly height: number;
  readonly sha256: string;
}

export const EPOCH_BOSS_ASSETS = [
  {
    templateKey: "obsidian_wyrm_boss",
    title: "黑曜裂隙兽",
    fileName: "obsidian-wyrm-boss.png",
    path: "obsidian-epoch/assets/boss/obsidian-wyrm-boss.png",
    url: "/api/epoch/assets/boss/obsidian-wyrm-boss.png",
    contentType: EPOCH_BOSS_ASSET_CONTENT_TYPE,
    width: EPOCH_BOSS_ASSET_WIDTH,
    height: EPOCH_BOSS_ASSET_HEIGHT,
    palette: ["#0f172a", "#7c3aed", "#f97316", "#38bdf8"],
    accentColor: "#7c3aed",
    dangerColor: "#f97316",
    sigil: "fractured-horn",
  },
  {
    templateKey: "salt_mirror_leviathan_boss",
    title: "盐镜巡海巨兽",
    fileName: "salt-mirror-leviathan-boss.png",
    path: "obsidian-epoch/assets/boss/salt-mirror-leviathan-boss.png",
    url: "/api/epoch/assets/boss/salt-mirror-leviathan-boss.png",
    contentType: EPOCH_BOSS_ASSET_CONTENT_TYPE,
    width: EPOCH_BOSS_ASSET_WIDTH,
    height: EPOCH_BOSS_ASSET_HEIGHT,
    palette: ["#1e293b", "#f8fafc", "#0ea5e9", "#facc15"],
    accentColor: "#0ea5e9",
    dangerColor: "#facc15",
    sigil: "mirror-fin",
  },
  {
    templateKey: "glass_archive_seraph_boss",
    title: "玻璃档案炽使",
    fileName: "glass-archive-seraph-boss.png",
    path: "obsidian-epoch/assets/boss/glass-archive-seraph-boss.png",
    url: "/api/epoch/assets/boss/glass-archive-seraph-boss.png",
    contentType: EPOCH_BOSS_ASSET_CONTENT_TYPE,
    width: EPOCH_BOSS_ASSET_WIDTH,
    height: EPOCH_BOSS_ASSET_HEIGHT,
    palette: ["#111827", "#a7f3d0", "#f43f5e", "#f8fafc"],
    accentColor: "#a7f3d0",
    dangerColor: "#f43f5e",
    sigil: "glass-wing",
  },
  {
    templateKey: "ash_crown_titan_boss",
    title: "灰冠炉心巨像",
    fileName: "ash-crown-titan-boss.png",
    path: "obsidian-epoch/assets/boss/ash-crown-titan-boss.png",
    url: "/api/epoch/assets/boss/ash-crown-titan-boss.png",
    contentType: EPOCH_BOSS_ASSET_CONTENT_TYPE,
    width: EPOCH_BOSS_ASSET_WIDTH,
    height: EPOCH_BOSS_ASSET_HEIGHT,
    palette: ["#18181b", "#dc2626", "#fbbf24", "#94a3b8"],
    accentColor: "#fbbf24",
    dangerColor: "#dc2626",
    sigil: "crowned-furnace",
  },
  {
    templateKey: "moonwell_hollow_queen_boss",
    title: "月井空壳女王",
    fileName: "moonwell-hollow-queen-boss.png",
    path: "obsidian-epoch/assets/boss/moonwell-hollow-queen-boss.png",
    url: "/api/epoch/assets/boss/moonwell-hollow-queen-boss.png",
    contentType: EPOCH_BOSS_ASSET_CONTENT_TYPE,
    width: EPOCH_BOSS_ASSET_WIDTH,
    height: EPOCH_BOSS_ASSET_HEIGHT,
    palette: ["#0b1120", "#c084fc", "#e5e7eb", "#22c55e"],
    accentColor: "#c084fc",
    dangerColor: "#22c55e",
    sigil: "hollow-crown",
  },
] as const satisfies readonly EpochBossAssetRecord[];

export function epochBossAssetForTemplate(templateKey: string): EpochBossAssetRecord | undefined {
  return EPOCH_BOSS_ASSETS.find((asset) => asset.templateKey === templateKey);
}

export function epochBossAssetByFileName(fileName: string): EpochBossAssetRecord | undefined {
  return EPOCH_BOSS_ASSETS.find((asset) => asset.fileName === fileName);
}

export function epochBossAssetFilePath(asset: EpochBossAssetRecord, packageRoot = defaultPackageRoot) {
  return join(packageRoot, asset.path);
}

export async function readEpochBossAssetByFileName(fileName: string, packageRoot = defaultPackageRoot) {
  const asset = epochBossAssetByFileName(fileName);
  if (!asset) return undefined;
  const content = await readFile(epochBossAssetFilePath(asset, packageRoot));
  return { asset, content };
}

export async function epochBossAssetManifestEntries(packageRoot = defaultPackageRoot): Promise<EpochBossAssetManifestEntry[]> {
  return Promise.all(EPOCH_BOSS_ASSETS.map(async (asset) => {
    const content = await readFile(epochBossAssetFilePath(asset, packageRoot));
    return {
      templateKey: asset.templateKey,
      title: asset.title,
      path: asset.path,
      url: asset.url,
      contentType: asset.contentType,
      width: asset.width,
      height: asset.height,
      sha256: createHash("sha256").update(content).digest("hex"),
    };
  }));
}
