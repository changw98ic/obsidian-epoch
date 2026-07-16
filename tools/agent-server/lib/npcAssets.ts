import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const EPOCH_NPC_ASSET_WIDTH = 640;
export const EPOCH_NPC_ASSET_HEIGHT = 640;
export const EPOCH_NPC_ASSET_CONTENT_TYPE = "image/png" as const;

const serverRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const defaultPackageRoot = join(serverRoot, "package");

export interface EpochNpcAssetRecord {
  readonly archetypeKey: string;
  readonly title: string;
  readonly subtitle: string;
  readonly fileName: string;
  readonly path: string;
  readonly url: string;
  readonly contentType: typeof EPOCH_NPC_ASSET_CONTENT_TYPE;
  readonly width: number;
  readonly height: number;
  readonly palette: readonly string[];
  readonly accentColor: string;
  readonly publicAlt: string;
}

export interface EpochNpcAssetManifestEntry {
  readonly archetypeKey: string;
  readonly title: string;
  readonly subtitle: string;
  readonly path: string;
  readonly url: string;
  readonly contentType: typeof EPOCH_NPC_ASSET_CONTENT_TYPE;
  readonly width: number;
  readonly height: number;
  readonly sha256: string;
}

export interface EpochNpcMedia {
  readonly archetypeKey: string;
  readonly title: string;
  readonly subtitle: string;
  readonly palette: readonly string[];
  readonly accentColor: string;
  readonly publicAlt: string;
  readonly assetPath: string;
  readonly imageUrl: string;
  readonly contentType: typeof EPOCH_NPC_ASSET_CONTENT_TYPE;
  readonly width: number;
  readonly height: number;
}

interface NpcLike {
  readonly npcId: string;
  readonly npcKey: string;
  readonly displayName: string;
  readonly regionId: string;
  readonly traits: readonly string[];
}

export const EPOCH_NPC_ASSETS = [
  {
    archetypeKey: "harbor_ledger_keeper",
    title: "港账书记",
    subtitle: "灰港账本与码头小印",
    fileName: "harbor-ledger-keeper.png",
    path: "obsidian-epoch/assets/npc/harbor-ledger-keeper.png",
    url: "/api/epoch/assets/npc/harbor-ledger-keeper.png",
    contentType: EPOCH_NPC_ASSET_CONTENT_TYPE,
    width: EPOCH_NPC_ASSET_WIDTH,
    height: EPOCH_NPC_ASSET_HEIGHT,
    palette: ["#0f172a", "#64748b", "#38bdf8", "#d7aa62"],
    accentColor: "#38bdf8",
    publicAlt: "黑曜纪元港账书记的服务器分配肖像。",
  },
  {
    archetypeKey: "ash_forge_runner",
    title: "灰炉信差",
    subtitle: "灰烬前哨的炉光与短途令牌",
    fileName: "ash-forge-runner.png",
    path: "obsidian-epoch/assets/npc/ash-forge-runner.png",
    url: "/api/epoch/assets/npc/ash-forge-runner.png",
    contentType: EPOCH_NPC_ASSET_CONTENT_TYPE,
    width: EPOCH_NPC_ASSET_WIDTH,
    height: EPOCH_NPC_ASSET_HEIGHT,
    palette: ["#18181b", "#7f1d1d", "#f59e0b", "#94a3b8"],
    accentColor: "#f59e0b",
    publicAlt: "黑曜纪元灰炉信差的服务器分配肖像。",
  },
  {
    archetypeKey: "salt_mirror_witness",
    title: "盐镜见证人",
    subtitle: "盐镜海岸的折光证词",
    fileName: "salt-mirror-witness.png",
    path: "obsidian-epoch/assets/npc/salt-mirror-witness.png",
    url: "/api/epoch/assets/npc/salt-mirror-witness.png",
    contentType: EPOCH_NPC_ASSET_CONTENT_TYPE,
    width: EPOCH_NPC_ASSET_WIDTH,
    height: EPOCH_NPC_ASSET_HEIGHT,
    palette: ["#1e293b", "#e0f2fe", "#0ea5e9", "#facc15"],
    accentColor: "#0ea5e9",
    publicAlt: "黑曜纪元盐镜见证人的服务器分配肖像。",
  },
  {
    archetypeKey: "glass_archive_scribe",
    title: "玻璃档案抄录员",
    subtitle: "透明索引与破碎柜列",
    fileName: "glass-archive-scribe.png",
    path: "obsidian-epoch/assets/npc/glass-archive-scribe.png",
    url: "/api/epoch/assets/npc/glass-archive-scribe.png",
    contentType: EPOCH_NPC_ASSET_CONTENT_TYPE,
    width: EPOCH_NPC_ASSET_WIDTH,
    height: EPOCH_NPC_ASSET_HEIGHT,
    palette: ["#111827", "#a7f3d0", "#f8fafc", "#f43f5e"],
    accentColor: "#a7f3d0",
    publicAlt: "黑曜纪元玻璃档案抄录员的服务器分配肖像。",
  },
  {
    archetypeKey: "moonwell_field_mender",
    title: "月井野医",
    subtitle: "银色低语与应急药囊",
    fileName: "moonwell-field-mender.png",
    path: "obsidian-epoch/assets/npc/moonwell-field-mender.png",
    url: "/api/epoch/assets/npc/moonwell-field-mender.png",
    contentType: EPOCH_NPC_ASSET_CONTENT_TYPE,
    width: EPOCH_NPC_ASSET_WIDTH,
    height: EPOCH_NPC_ASSET_HEIGHT,
    palette: ["#0b1120", "#c084fc", "#e5e7eb", "#22c55e"],
    accentColor: "#c084fc",
    publicAlt: "黑曜纪元月井野医的服务器分配肖像。",
  },
] as const satisfies readonly EpochNpcAssetRecord[];

export function epochNpcAssetByFileName(fileName: string): EpochNpcAssetRecord | undefined {
  return EPOCH_NPC_ASSETS.find((asset) => asset.fileName === fileName);
}

export function epochNpcAssetFilePath(asset: EpochNpcAssetRecord, packageRoot = defaultPackageRoot) {
  return join(packageRoot, asset.path);
}

export async function readEpochNpcAssetByFileName(fileName: string, packageRoot = defaultPackageRoot) {
  const asset = epochNpcAssetByFileName(fileName);
  if (!asset) return undefined;
  const content = await readFile(epochNpcAssetFilePath(asset, packageRoot));
  return { asset, content };
}

export async function epochNpcAssetManifestEntries(packageRoot = defaultPackageRoot): Promise<EpochNpcAssetManifestEntry[]> {
  return Promise.all(EPOCH_NPC_ASSETS.map(async (asset) => {
    const content = await readFile(epochNpcAssetFilePath(asset, packageRoot));
    return {
      archetypeKey: asset.archetypeKey,
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

function npcAssetIndex(npc: NpcLike) {
  const basis = [
    npc.npcKey,
    npc.npcId,
    npc.regionId,
    npc.traits.join("|"),
    npc.displayName,
  ].join(":");
  const hash = createHash("sha256").update(basis).digest();
  return hash.readUInt32BE(0) % EPOCH_NPC_ASSETS.length;
}

export function epochNpcMediaForRecord(npc: NpcLike): EpochNpcMedia {
  const asset = EPOCH_NPC_ASSETS[npcAssetIndex(npc)];
  return {
    archetypeKey: asset.archetypeKey,
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
