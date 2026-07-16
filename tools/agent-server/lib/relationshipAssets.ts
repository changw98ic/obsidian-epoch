import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { EpochNpcRelationshipKind, EpochRelationshipKind } from "./epoch/protocol.ts";

export const EPOCH_RELATIONSHIP_ASSET_WIDTH = 512;
export const EPOCH_RELATIONSHIP_ASSET_HEIGHT = 512;
export const EPOCH_RELATIONSHIP_ASSET_CONTENT_TYPE = "image/png" as const;

const serverRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const defaultPackageRoot = join(serverRoot, "package");

export type EpochRelationshipAssetKey = EpochNpcRelationshipKind | EpochRelationshipKind | "household";

export interface EpochRelationshipAssetRecord {
  readonly relationshipKey: EpochRelationshipAssetKey;
  readonly title: string;
  readonly subtitle: string;
  readonly fileName: string;
  readonly path: string;
  readonly url: string;
  readonly contentType: typeof EPOCH_RELATIONSHIP_ASSET_CONTENT_TYPE;
  readonly width: number;
  readonly height: number;
  readonly palette: readonly string[];
  readonly accentColor: string;
  readonly publicAlt: string;
  readonly sigil: "bond" | "branch" | "spark" | "thorn" | "crown" | "steps" | "shield" | "rift" | "star" | "home";
}

export interface EpochRelationshipAssetManifestEntry {
  readonly relationshipKey: EpochRelationshipAssetKey;
  readonly title: string;
  readonly subtitle: string;
  readonly path: string;
  readonly url: string;
  readonly contentType: typeof EPOCH_RELATIONSHIP_ASSET_CONTENT_TYPE;
  readonly width: number;
  readonly height: number;
  readonly sha256: string;
}

export interface EpochRelationshipMedia {
  readonly relationshipKey: EpochRelationshipAssetKey;
  readonly title: string;
  readonly subtitle: string;
  readonly palette: readonly string[];
  readonly accentColor: string;
  readonly publicAlt: string;
  readonly assetPath: string;
  readonly imageUrl: string;
  readonly contentType: typeof EPOCH_RELATIONSHIP_ASSET_CONTENT_TYPE;
  readonly width: number;
  readonly height: number;
}

export const EPOCH_RELATIONSHIP_ASSETS = [
  {
    relationshipKey: "spouse",
    title: "配偶誓约",
    subtitle: "服务器记录的婚姻与伴侣关系",
    fileName: "spouse-relationship.png",
    path: "obsidian-epoch/assets/relationship/spouse-relationship.png",
    url: "/api/epoch/assets/relationship/spouse-relationship.png",
    contentType: EPOCH_RELATIONSHIP_ASSET_CONTENT_TYPE,
    width: EPOCH_RELATIONSHIP_ASSET_WIDTH,
    height: EPOCH_RELATIONSHIP_ASSET_HEIGHT,
    palette: ["#140f12", "#7f1d1d", "#f97316", "#f8fafc"],
    accentColor: "#f97316",
    sigil: "bond",
    publicAlt: "黑曜纪元配偶关系图标。",
  },
  {
    relationshipKey: "parent",
    title: "父母血缘",
    subtitle: "服务器记录的亲代关系",
    fileName: "parent-relationship.png",
    path: "obsidian-epoch/assets/relationship/parent-relationship.png",
    url: "/api/epoch/assets/relationship/parent-relationship.png",
    contentType: EPOCH_RELATIONSHIP_ASSET_CONTENT_TYPE,
    width: EPOCH_RELATIONSHIP_ASSET_WIDTH,
    height: EPOCH_RELATIONSHIP_ASSET_HEIGHT,
    palette: ["#101820", "#475569", "#d6b076", "#f8fafc"],
    accentColor: "#d6b076",
    sigil: "branch",
    publicAlt: "黑曜纪元父母关系图标。",
  },
  {
    relationshipKey: "child",
    title: "子女血缘",
    subtitle: "服务器记录的子代关系",
    fileName: "child-relationship.png",
    path: "obsidian-epoch/assets/relationship/child-relationship.png",
    url: "/api/epoch/assets/relationship/child-relationship.png",
    contentType: EPOCH_RELATIONSHIP_ASSET_CONTENT_TYPE,
    width: EPOCH_RELATIONSHIP_ASSET_WIDTH,
    height: EPOCH_RELATIONSHIP_ASSET_HEIGHT,
    palette: ["#071315", "#0f766e", "#67e8f9", "#f8fafc"],
    accentColor: "#67e8f9",
    sigil: "spark",
    publicAlt: "黑曜纪元子女关系图标。",
  },
  {
    relationshipKey: "relative",
    title: "亲族纽带",
    subtitle: "服务器记录的亲人关系",
    fileName: "relative-relationship.png",
    path: "obsidian-epoch/assets/relationship/relative-relationship.png",
    url: "/api/epoch/assets/relationship/relative-relationship.png",
    contentType: EPOCH_RELATIONSHIP_ASSET_CONTENT_TYPE,
    width: EPOCH_RELATIONSHIP_ASSET_WIDTH,
    height: EPOCH_RELATIONSHIP_ASSET_HEIGHT,
    palette: ["#18120f", "#7c2d12", "#f59e0b", "#f8fafc"],
    accentColor: "#f59e0b",
    sigil: "branch",
    publicAlt: "黑曜纪元亲族关系图标。",
  },
  {
    relationshipKey: "friend",
    title: "朋友交情",
    subtitle: "服务器记录的友好关系",
    fileName: "friend-relationship.png",
    path: "obsidian-epoch/assets/relationship/friend-relationship.png",
    url: "/api/epoch/assets/relationship/friend-relationship.png",
    contentType: EPOCH_RELATIONSHIP_ASSET_CONTENT_TYPE,
    width: EPOCH_RELATIONSHIP_ASSET_WIDTH,
    height: EPOCH_RELATIONSHIP_ASSET_HEIGHT,
    palette: ["#08111f", "#1d4ed8", "#93c5fd", "#f8fafc"],
    accentColor: "#93c5fd",
    sigil: "spark",
    publicAlt: "黑曜纪元朋友关系图标。",
  },
  {
    relationshipKey: "enemy",
    title: "仇敌裂痕",
    subtitle: "服务器记录的敌对 NPC 关系",
    fileName: "enemy-relationship.png",
    path: "obsidian-epoch/assets/relationship/enemy-relationship.png",
    url: "/api/epoch/assets/relationship/enemy-relationship.png",
    contentType: EPOCH_RELATIONSHIP_ASSET_CONTENT_TYPE,
    width: EPOCH_RELATIONSHIP_ASSET_WIDTH,
    height: EPOCH_RELATIONSHIP_ASSET_HEIGHT,
    palette: ["#11070a", "#7f1d1d", "#fb7185", "#f8fafc"],
    accentColor: "#fb7185",
    sigil: "thorn",
    publicAlt: "黑曜纪元仇敌关系图标。",
  },
  {
    relationshipKey: "superior",
    title: "上级权责",
    subtitle: "服务器记录的上级关系",
    fileName: "superior-relationship.png",
    path: "obsidian-epoch/assets/relationship/superior-relationship.png",
    url: "/api/epoch/assets/relationship/superior-relationship.png",
    contentType: EPOCH_RELATIONSHIP_ASSET_CONTENT_TYPE,
    width: EPOCH_RELATIONSHIP_ASSET_WIDTH,
    height: EPOCH_RELATIONSHIP_ASSET_HEIGHT,
    palette: ["#111112", "#52525b", "#e5e7eb", "#d6b076"],
    accentColor: "#e5e7eb",
    sigil: "crown",
    publicAlt: "黑曜纪元上级关系图标。",
  },
  {
    relationshipKey: "subordinate",
    title: "下属职责",
    subtitle: "服务器记录的下属关系",
    fileName: "subordinate-relationship.png",
    path: "obsidian-epoch/assets/relationship/subordinate-relationship.png",
    url: "/api/epoch/assets/relationship/subordinate-relationship.png",
    contentType: EPOCH_RELATIONSHIP_ASSET_CONTENT_TYPE,
    width: EPOCH_RELATIONSHIP_ASSET_WIDTH,
    height: EPOCH_RELATIONSHIP_ASSET_HEIGHT,
    palette: ["#0b1020", "#334155", "#bfdbfe", "#f8fafc"],
    accentColor: "#bfdbfe",
    sigil: "steps",
    publicAlt: "黑曜纪元下属关系图标。",
  },
  {
    relationshipKey: "mentor",
    title: "导师传承",
    subtitle: "服务器记录的师承与教导关系",
    fileName: "mentor-relationship.png",
    path: "obsidian-epoch/assets/relationship/mentor-relationship.png",
    url: "/api/epoch/assets/relationship/mentor-relationship.png",
    contentType: EPOCH_RELATIONSHIP_ASSET_CONTENT_TYPE,
    width: EPOCH_RELATIONSHIP_ASSET_WIDTH,
    height: EPOCH_RELATIONSHIP_ASSET_HEIGHT,
    palette: ["#101820", "#2563eb", "#bfdbfe", "#f8fafc"],
    accentColor: "#bfdbfe",
    sigil: "star",
    publicAlt: "黑曜纪元导师关系图标。",
  },
  {
    relationshipKey: "apprentice",
    title: "学徒契约",
    subtitle: "服务器记录的学徒与训练关系",
    fileName: "apprentice-relationship.png",
    path: "obsidian-epoch/assets/relationship/apprentice-relationship.png",
    url: "/api/epoch/assets/relationship/apprentice-relationship.png",
    contentType: EPOCH_RELATIONSHIP_ASSET_CONTENT_TYPE,
    width: EPOCH_RELATIONSHIP_ASSET_WIDTH,
    height: EPOCH_RELATIONSHIP_ASSET_HEIGHT,
    palette: ["#071315", "#0f766e", "#a7f3d0", "#f8fafc"],
    accentColor: "#a7f3d0",
    sigil: "steps",
    publicAlt: "黑曜纪元学徒关系图标。",
  },
  {
    relationshipKey: "creditor",
    title: "债权账册",
    subtitle: "服务器记录的债权与担保关系",
    fileName: "creditor-relationship.png",
    path: "obsidian-epoch/assets/relationship/creditor-relationship.png",
    url: "/api/epoch/assets/relationship/creditor-relationship.png",
    contentType: EPOCH_RELATIONSHIP_ASSET_CONTENT_TYPE,
    width: EPOCH_RELATIONSHIP_ASSET_WIDTH,
    height: EPOCH_RELATIONSHIP_ASSET_HEIGHT,
    palette: ["#111112", "#7c2d12", "#facc15", "#f8fafc"],
    accentColor: "#facc15",
    sigil: "crown",
    publicAlt: "黑曜纪元债权关系图标。",
  },
  {
    relationshipKey: "debtor",
    title: "债务压力",
    subtitle: "服务器记录的欠款与义务关系",
    fileName: "debtor-relationship.png",
    path: "obsidian-epoch/assets/relationship/debtor-relationship.png",
    url: "/api/epoch/assets/relationship/debtor-relationship.png",
    contentType: EPOCH_RELATIONSHIP_ASSET_CONTENT_TYPE,
    width: EPOCH_RELATIONSHIP_ASSET_WIDTH,
    height: EPOCH_RELATIONSHIP_ASSET_HEIGHT,
    palette: ["#11070a", "#7f1d1d", "#fb7185", "#f8fafc"],
    accentColor: "#fb7185",
    sigil: "rift",
    publicAlt: "黑曜纪元债务关系图标。",
  },
  {
    relationshipKey: "alliance",
    title: "玩家联盟",
    subtitle: "服务器结算的 agent 联盟关系",
    fileName: "alliance-relationship.png",
    path: "obsidian-epoch/assets/relationship/alliance-relationship.png",
    url: "/api/epoch/assets/relationship/alliance-relationship.png",
    contentType: EPOCH_RELATIONSHIP_ASSET_CONTENT_TYPE,
    width: EPOCH_RELATIONSHIP_ASSET_WIDTH,
    height: EPOCH_RELATIONSHIP_ASSET_HEIGHT,
    palette: ["#071315", "#0f766e", "#a7f3d0", "#f8fafc"],
    accentColor: "#a7f3d0",
    sigil: "shield",
    publicAlt: "黑曜纪元玩家联盟关系图标。",
  },
  {
    relationshipKey: "hostility",
    title: "玩家敌对",
    subtitle: "服务器结算的 agent 敌对关系",
    fileName: "hostility-relationship.png",
    path: "obsidian-epoch/assets/relationship/hostility-relationship.png",
    url: "/api/epoch/assets/relationship/hostility-relationship.png",
    contentType: EPOCH_RELATIONSHIP_ASSET_CONTENT_TYPE,
    width: EPOCH_RELATIONSHIP_ASSET_WIDTH,
    height: EPOCH_RELATIONSHIP_ASSET_HEIGHT,
    palette: ["#140f12", "#7f1d1d", "#f43f5e", "#f8fafc"],
    accentColor: "#f43f5e",
    sigil: "rift",
    publicAlt: "黑曜纪元玩家敌对关系图标。",
  },
  {
    relationshipKey: "reputation",
    title: "玩家声望",
    subtitle: "服务器结算的 agent 声望边",
    fileName: "reputation-relationship.png",
    path: "obsidian-epoch/assets/relationship/reputation-relationship.png",
    url: "/api/epoch/assets/relationship/reputation-relationship.png",
    contentType: EPOCH_RELATIONSHIP_ASSET_CONTENT_TYPE,
    width: EPOCH_RELATIONSHIP_ASSET_WIDTH,
    height: EPOCH_RELATIONSHIP_ASSET_HEIGHT,
    palette: ["#18120f", "#7c2d12", "#facc15", "#f8fafc"],
    accentColor: "#facc15",
    sigil: "star",
    publicAlt: "黑曜纪元玩家声望关系图标。",
  },
  {
    relationshipKey: "household",
    title: "家庭共同体",
    subtitle: "服务器记录的家庭成员关系",
    fileName: "household-relationship.png",
    path: "obsidian-epoch/assets/relationship/household-relationship.png",
    url: "/api/epoch/assets/relationship/household-relationship.png",
    contentType: EPOCH_RELATIONSHIP_ASSET_CONTENT_TYPE,
    width: EPOCH_RELATIONSHIP_ASSET_WIDTH,
    height: EPOCH_RELATIONSHIP_ASSET_HEIGHT,
    palette: ["#101820", "#475569", "#d6b076", "#f8fafc"],
    accentColor: "#d6b076",
    sigil: "home",
    publicAlt: "黑曜纪元家庭关系图标。",
  },
] as const satisfies readonly EpochRelationshipAssetRecord[];

function relationshipAssetFilePath(asset: EpochRelationshipAssetRecord, packageRoot = defaultPackageRoot) {
  return join(packageRoot, asset.path);
}

export function epochRelationshipAssetByFileName(fileName: string): EpochRelationshipAssetRecord | undefined {
  return EPOCH_RELATIONSHIP_ASSETS.find((asset) => asset.fileName === fileName);
}

export function epochRelationshipAssetForKey(relationshipKey: EpochRelationshipAssetKey): EpochRelationshipAssetRecord | undefined {
  return EPOCH_RELATIONSHIP_ASSETS.find((asset) => asset.relationshipKey === relationshipKey);
}

export async function readEpochRelationshipAssetByFileName(fileName: string, packageRoot = defaultPackageRoot) {
  const asset = epochRelationshipAssetByFileName(fileName);
  if (!asset) return undefined;
  const content = await readFile(relationshipAssetFilePath(asset, packageRoot));
  return { asset, content };
}

export async function epochRelationshipAssetManifestEntries(packageRoot = defaultPackageRoot): Promise<EpochRelationshipAssetManifestEntry[]> {
  return Promise.all(EPOCH_RELATIONSHIP_ASSETS.map(async (asset) => {
    const content = await readFile(relationshipAssetFilePath(asset, packageRoot));
    return {
      relationshipKey: asset.relationshipKey,
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

export function epochRelationshipMediaForKey(relationshipKey: EpochRelationshipAssetKey): EpochRelationshipMedia | undefined {
  const asset = epochRelationshipAssetForKey(relationshipKey);
  if (!asset) return undefined;
  return {
    relationshipKey: asset.relationshipKey,
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
