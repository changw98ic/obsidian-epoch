import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveEpochMediaRegionId } from "./regionAliases.ts";

export const EPOCH_LOCATION_ASSET_WIDTH = 960;
export const EPOCH_LOCATION_ASSET_HEIGHT = 540;
export const EPOCH_LOCATION_ASSET_CONTENT_TYPE = "image/png" as const;

const serverRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const defaultPackageRoot = join(serverRoot, "package");

export interface EpochLocationAssetRecord {
  readonly regionId: string;
  readonly title: string;
  readonly subtitle: string;
  readonly fileName: string;
  readonly path: string;
  readonly url: string;
  readonly contentType: typeof EPOCH_LOCATION_ASSET_CONTENT_TYPE;
  readonly width: number;
  readonly height: number;
  readonly palette: readonly string[];
  readonly accentColor: string;
  readonly publicAlt: string;
}

export interface EpochLocationAssetManifestEntry {
  readonly regionId: string;
  readonly title: string;
  readonly subtitle: string;
  readonly path: string;
  readonly url: string;
  readonly contentType: typeof EPOCH_LOCATION_ASSET_CONTENT_TYPE;
  readonly width: number;
  readonly height: number;
  readonly sha256: string;
}

export const EPOCH_LOCATION_ASSETS = [
  {
    regionId: "region_gray_harbor",
    title: "灰港",
    subtitle: "黑曜潮线港",
    fileName: "region-gray-harbor.png",
    path: "obsidian-epoch/assets/location/region-gray-harbor.png",
    url: "/api/epoch/assets/location/region-gray-harbor.png",
    contentType: EPOCH_LOCATION_ASSET_CONTENT_TYPE,
    width: EPOCH_LOCATION_ASSET_WIDTH,
    height: EPOCH_LOCATION_ASSET_HEIGHT,
    palette: ["#0f172a", "#64748b", "#38bdf8", "#f97316"],
    accentColor: "#38bdf8",
    publicAlt: "灰港的黑曜潮线、旧灯塔和低空盐雾。",
  },
  {
    regionId: "region_ash_outpost",
    title: "灰烬前哨",
    subtitle: "旧炉与边境补给线",
    fileName: "region-ash-outpost.png",
    path: "obsidian-epoch/assets/location/region-ash-outpost.png",
    url: "/api/epoch/assets/location/region-ash-outpost.png",
    contentType: EPOCH_LOCATION_ASSET_CONTENT_TYPE,
    width: EPOCH_LOCATION_ASSET_WIDTH,
    height: EPOCH_LOCATION_ASSET_HEIGHT,
    palette: ["#18181b", "#7f1d1d", "#f59e0b", "#94a3b8"],
    accentColor: "#f59e0b",
    publicAlt: "灰烬前哨的旧炉、巡夜旗和边境补给灯。",
  },
  {
    regionId: "region_salt_mirror_coast",
    title: "盐镜海岸",
    subtitle: "镜化潮汐航路",
    fileName: "region-salt-mirror-coast.png",
    path: "obsidian-epoch/assets/location/region-salt-mirror-coast.png",
    url: "/api/epoch/assets/location/region-salt-mirror-coast.png",
    contentType: EPOCH_LOCATION_ASSET_CONTENT_TYPE,
    width: EPOCH_LOCATION_ASSET_WIDTH,
    height: EPOCH_LOCATION_ASSET_HEIGHT,
    palette: ["#1e293b", "#e0f2fe", "#0ea5e9", "#facc15"],
    accentColor: "#0ea5e9",
    publicAlt: "盐镜海岸的镜化水面、倒置潮线和折光航标。",
  },
  {
    regionId: "region_glass_archive",
    title: "玻璃档案馆",
    subtitle: "透明索引穹顶",
    fileName: "region-glass-archive.png",
    path: "obsidian-epoch/assets/location/region-glass-archive.png",
    url: "/api/epoch/assets/location/region-glass-archive.png",
    contentType: EPOCH_LOCATION_ASSET_CONTENT_TYPE,
    width: EPOCH_LOCATION_ASSET_WIDTH,
    height: EPOCH_LOCATION_ASSET_HEIGHT,
    palette: ["#111827", "#a7f3d0", "#f8fafc", "#f43f5e"],
    accentColor: "#a7f3d0",
    publicAlt: "玻璃档案馆的透明穹顶、破碎柜列和发光索引。",
  },
  {
    regionId: "region_moonwell_hollow",
    title: "月井空壳",
    subtitle: "银色低语井",
    fileName: "region-moonwell-hollow.png",
    path: "obsidian-epoch/assets/location/region-moonwell-hollow.png",
    url: "/api/epoch/assets/location/region-moonwell-hollow.png",
    contentType: EPOCH_LOCATION_ASSET_CONTENT_TYPE,
    width: EPOCH_LOCATION_ASSET_WIDTH,
    height: EPOCH_LOCATION_ASSET_HEIGHT,
    palette: ["#0b1120", "#c084fc", "#e5e7eb", "#22c55e"],
    accentColor: "#c084fc",
    publicAlt: "月井空壳的废井、银色回声和暗水蜂群。",
  },
  {
    regionId: "region_blackharbor",
    title: "黑港",
    subtitle: "封蜡账册与夜航税平码头",
    fileName: "region-black-harbor.png",
    path: "obsidian-epoch/assets/location/region-black-harbor.png",
    url: "/api/epoch/assets/location/region-black-harbor.png",
    contentType: EPOCH_LOCATION_ASSET_CONTENT_TYPE,
    width: EPOCH_LOCATION_ASSET_WIDTH,
    height: EPOCH_LOCATION_ASSET_HEIGHT,
    palette: ["#05080c", "#172554", "#38bdf8", "#d97706"],
    accentColor: "#38bdf8",
    publicAlt: "黑港的湿石税平、低蓝信号灯、夜航船影和封蜡账册。",
  },
  {
    regionId: "region_forest",
    title: "腐林",
    subtitle: "会回信树洞与苔光誓牌",
    fileName: "region-forest.png",
    path: "obsidian-epoch/assets/location/region-forest.png",
    url: "/api/epoch/assets/location/region-forest.png",
    contentType: EPOCH_LOCATION_ASSET_CONTENT_TYPE,
    width: EPOCH_LOCATION_ASSET_WIDTH,
    height: EPOCH_LOCATION_ASSET_HEIGHT,
    palette: ["#06110a", "#14532d", "#86efac", "#facc15"],
    accentColor: "#86efac",
    publicAlt: "腐林的苔光小径、会回信树洞、猎人誓牌和潮湿枝影。",
  },
  {
    regionId: "region_salt_gate",
    title: "盐门",
    subtitle: "盐风关税场与边境钟桥",
    fileName: "region-salt-gate.png",
    path: "obsidian-epoch/assets/location/region-salt-gate.png",
    url: "/api/epoch/assets/location/region-salt-gate.png",
    contentType: EPOCH_LOCATION_ASSET_CONTENT_TYPE,
    width: EPOCH_LOCATION_ASSET_WIDTH,
    height: EPOCH_LOCATION_ASSET_HEIGHT,
    palette: ["#08131a", "#0f4c5c", "#e0f2fe", "#d97706"],
    accentColor: "#f59e0b",
    publicAlt: "盐门的边境钟桥、盐风旗线、关税账棚和等待通行的车队。",
  },
  {
    regionId: "region_ash",
    title: "灰烬荒原",
    subtitle: "渣井营地与赤灰商道",
    fileName: "region-ash-waste.png",
    path: "obsidian-epoch/assets/location/region-ash-waste.png",
    url: "/api/epoch/assets/location/region-ash-waste.png",
    contentType: EPOCH_LOCATION_ASSET_CONTENT_TYPE,
    width: EPOCH_LOCATION_ASSET_WIDTH,
    height: EPOCH_LOCATION_ASSET_HEIGHT,
    palette: ["#0b0706", "#7f1d1d", "#f97316", "#cbd5e1"],
    accentColor: "#f97316",
    publicAlt: "灰烬荒原的赤灰车辙、黑铁渣井、补给棚和冷夜营火。",
  },
  {
    regionId: "region_city_pipes",
    title: "城市管道",
    subtitle: "阀门市集与回声排水廊",
    fileName: "region-city-pipes.png",
    path: "obsidian-epoch/assets/location/region-city-pipes.png",
    url: "/api/epoch/assets/location/region-city-pipes.png",
    contentType: EPOCH_LOCATION_ASSET_CONTENT_TYPE,
    width: EPOCH_LOCATION_ASSET_WIDTH,
    height: EPOCH_LOCATION_ASSET_HEIGHT,
    palette: ["#050807", "#14532d", "#5eead4", "#facc15"],
    accentColor: "#5eead4",
    publicAlt: "城市管道的阀门市集、冷凝水渠、钠灯检修桥和低声回音。",
  },
  {
    regionId: "region_abandoned_mine",
    title: "废弃矿区",
    subtitle: "旧升降井与蓝尘矿灯",
    fileName: "region-abandoned-mine.png",
    path: "obsidian-epoch/assets/location/region-abandoned-mine.png",
    url: "/api/epoch/assets/location/region-abandoned-mine.png",
    contentType: EPOCH_LOCATION_ASSET_CONTENT_TYPE,
    width: EPOCH_LOCATION_ASSET_WIDTH,
    height: EPOCH_LOCATION_ASSET_HEIGHT,
    palette: ["#0b0806", "#57534e", "#f59e0b", "#60a5fa"],
    accentColor: "#f59e0b",
    publicAlt: "废弃矿区的旧升降井、塌方轨道、蓝尘矿灯和封存警戒线。",
  },
  {
    regionId: "region_data_tower",
    title: "废弃数据塔",
    subtitle: "缓存雨与脑晶索引层",
    fileName: "region-data-tower.png",
    path: "obsidian-epoch/assets/location/region-data-tower.png",
    url: "/api/epoch/assets/location/region-data-tower.png",
    contentType: EPOCH_LOCATION_ASSET_CONTENT_TYPE,
    width: EPOCH_LOCATION_ASSET_WIDTH,
    height: EPOCH_LOCATION_ASSET_HEIGHT,
    palette: ["#050816", "#1e1b4b", "#67e8f9", "#a78bfa"],
    accentColor: "#67e8f9",
    publicAlt: "废弃数据塔的断裂索引层、缓存雨、脑晶灯列和高空维护桥。",
  },
  {
    regionId: "region_orbit_city",
    title: "轨道城",
    subtitle: "环站泊港与星历灯市",
    fileName: "region-orbit-city.png",
    path: "obsidian-epoch/assets/location/region-orbit-city.png",
    url: "/api/epoch/assets/location/region-orbit-city.png",
    contentType: EPOCH_LOCATION_ASSET_CONTENT_TYPE,
    width: EPOCH_LOCATION_ASSET_WIDTH,
    height: EPOCH_LOCATION_ASSET_HEIGHT,
    palette: ["#020617", "#0f172a", "#93c5fd", "#facc15"],
    accentColor: "#93c5fd",
    publicAlt: "轨道城的环形泊港、星历信标、低轨航道和悬空灯市。",
  },
  {
    regionId: "region_trench",
    title: "海沟",
    subtitle: "深海冷灯与古梦暗流",
    fileName: "region-trench.png",
    path: "obsidian-epoch/assets/location/region-trench.png",
    url: "/api/epoch/assets/location/region-trench.png",
    contentType: EPOCH_LOCATION_ASSET_CONTENT_TYPE,
    width: EPOCH_LOCATION_ASSET_WIDTH,
    height: EPOCH_LOCATION_ASSET_HEIGHT,
    palette: ["#020617", "#0f3f46", "#67e8f9", "#22c55e"],
    accentColor: "#67e8f9",
    publicAlt: "海沟的深海冷灯、断裂岩架、古梦暗流和低声漂游的守梦生物。",
  },
  {
    regionId: "region_collective_dream_pool",
    title: "集体梦池",
    subtitle: "共享睡眠与记忆浮岛",
    fileName: "region-collective-dream-pool.png",
    path: "obsidian-epoch/assets/location/region-collective-dream-pool.png",
    url: "/api/epoch/assets/location/region-collective-dream-pool.png",
    contentType: EPOCH_LOCATION_ASSET_CONTENT_TYPE,
    width: EPOCH_LOCATION_ASSET_WIDTH,
    height: EPOCH_LOCATION_ASSET_HEIGHT,
    palette: ["#090513", "#4c1d95", "#c084fc", "#22d3ee"],
    accentColor: "#c084fc",
    publicAlt: "集体梦池的共享睡眠水面、记忆浮岛、梦灯队列和服务器封存的身份倒影。",
  },
  {
    regionId: "region_space_rift",
    title: "空间裂缝",
    subtitle: "错位边缘与落尘牧道",
    fileName: "region-space-rift.png",
    path: "obsidian-epoch/assets/location/region-space-rift.png",
    url: "/api/epoch/assets/location/region-space-rift.png",
    contentType: EPOCH_LOCATION_ASSET_CONTENT_TYPE,
    width: EPOCH_LOCATION_ASSET_WIDTH,
    height: EPOCH_LOCATION_ASSET_HEIGHT,
    palette: ["#07021a", "#312e81", "#c084fc", "#67e8f9"],
    accentColor: "#c084fc",
    publicAlt: "空间裂缝的错位边缘、紫色裂光、落尘牧道和服务器封存的通行刻度。",
  },
  {
    regionId: "region_non_euclidean_cave",
    title: "非欧洞窟",
    subtitle: "错误楼梯与重力回声井",
    fileName: "region-non-euclidean-cave.png",
    path: "obsidian-epoch/assets/location/region-non-euclidean-cave.png",
    url: "/api/epoch/assets/location/region-non-euclidean-cave.png",
    contentType: EPOCH_LOCATION_ASSET_CONTENT_TYPE,
    width: EPOCH_LOCATION_ASSET_WIDTH,
    height: EPOCH_LOCATION_ASSET_HEIGHT,
    palette: ["#06030f", "#3b0764", "#a78bfa", "#facc15"],
    accentColor: "#a78bfa",
    publicAlt: "非欧洞窟的错误楼梯、折叠岩壁、重力回声井和无法对齐的黄铜测量灯。",
  },
  {
    regionId: "region_starship_graveyard",
    title: "星舰墓场",
    subtitle: "冷轨残骸与漂航信标",
    fileName: "region-starship-graveyard.png",
    path: "obsidian-epoch/assets/location/region-starship-graveyard.png",
    url: "/api/epoch/assets/location/region-starship-graveyard.png",
    contentType: EPOCH_LOCATION_ASSET_CONTENT_TYPE,
    width: EPOCH_LOCATION_ASSET_WIDTH,
    height: EPOCH_LOCATION_ASSET_HEIGHT,
    palette: ["#020617", "#172554", "#93c5fd", "#facc15"],
    accentColor: "#93c5fd",
    publicAlt: "星舰墓场的冷轨残骸、断裂船壳、漂航信标和被服务器标注的打捞禁线。",
  },
  {
    regionId: "region_abandoned_subway",
    title: "废弃地铁",
    subtitle: "信号雾与积水闸机",
    fileName: "region-abandoned-subway.png",
    path: "obsidian-epoch/assets/location/region-abandoned-subway.png",
    url: "/api/epoch/assets/location/region-abandoned-subway.png",
    contentType: EPOCH_LOCATION_ASSET_CONTENT_TYPE,
    width: EPOCH_LOCATION_ASSET_WIDTH,
    height: EPOCH_LOCATION_ASSET_HEIGHT,
    palette: ["#050807", "#1f2937", "#5eead4", "#f59e0b"],
    accentColor: "#5eead4",
    publicAlt: "废弃地铁的积水站台、旧信号灯、锈蚀闸机和被潮雾吞没的隧道口。",
  },
  {
    regionId: "region_holographic_theater",
    title: "全息剧场",
    subtitle: "光谱舞台与伪掌声席",
    fileName: "region-holographic-theater.png",
    path: "obsidian-epoch/assets/location/region-holographic-theater.png",
    url: "/api/epoch/assets/location/region-holographic-theater.png",
    contentType: EPOCH_LOCATION_ASSET_CONTENT_TYPE,
    width: EPOCH_LOCATION_ASSET_WIDTH,
    height: EPOCH_LOCATION_ASSET_HEIGHT,
    palette: ["#050816", "#4c1d95", "#f472b6", "#67e8f9"],
    accentColor: "#f472b6",
    publicAlt: "全息剧场的光谱舞台、伪掌声座席、折光后台和服务器封存的演出回声。",
  },
  {
    regionId: "region_quantum_laboratory",
    title: "量子实验室",
    subtitle: "概率玻璃与坍缩桥",
    fileName: "region-quantum-laboratory.png",
    path: "obsidian-epoch/assets/location/region-quantum-laboratory.png",
    url: "/api/epoch/assets/location/region-quantum-laboratory.png",
    contentType: EPOCH_LOCATION_ASSET_CONTENT_TYPE,
    width: EPOCH_LOCATION_ASSET_WIDTH,
    height: EPOCH_LOCATION_ASSET_HEIGHT,
    palette: ["#020617", "#164e63", "#67e8f9", "#facc15"],
    accentColor: "#67e8f9",
    publicAlt: "量子实验室的概率玻璃、纠缠舱、坍缩桥和被服务器锁定的实验观测窗。",
  },
  {
    regionId: "region_reflective_city",
    title: "反光城市",
    subtitle: "镜面街廓与屏幕水域",
    fileName: "region-reflective-city.png",
    path: "obsidian-epoch/assets/location/region-reflective-city.png",
    url: "/api/epoch/assets/location/region-reflective-city.png",
    contentType: EPOCH_LOCATION_ASSET_CONTENT_TYPE,
    width: EPOCH_LOCATION_ASSET_WIDTH,
    height: EPOCH_LOCATION_ASSET_HEIGHT,
    palette: ["#061018", "#0f766e", "#a5f3fc", "#f472b6"],
    accentColor: "#a5f3fc",
    publicAlt: "反光城市的镜面街廓、屏幕水域、霓虹反射和服务器标注的公开巡游线。",
  },
  {
    regionId: "region_data_alley",
    title: "数据巷",
    subtitle: "缓存小巷与走线招牌",
    fileName: "region-data-alley.png",
    path: "obsidian-epoch/assets/location/region-data-alley.png",
    url: "/api/epoch/assets/location/region-data-alley.png",
    contentType: EPOCH_LOCATION_ASSET_CONTENT_TYPE,
    width: EPOCH_LOCATION_ASSET_WIDTH,
    height: EPOCH_LOCATION_ASSET_HEIGHT,
    palette: ["#030712", "#1e1b4b", "#67e8f9", "#f59e0b"],
    accentColor: "#67e8f9",
    publicAlt: "数据巷的缓存招牌、走线墙、包市场摊位和被服务器照亮的通行标记。",
  },
  {
    regionId: "region_prism_waters",
    title: "棱镜水域",
    subtitle: "折光潮汐与镜帆码头",
    fileName: "region-prism-waters.png",
    path: "obsidian-epoch/assets/location/region-prism-waters.png",
    url: "/api/epoch/assets/location/region-prism-waters.png",
    contentType: EPOCH_LOCATION_ASSET_CONTENT_TYPE,
    width: EPOCH_LOCATION_ASSET_WIDTH,
    height: EPOCH_LOCATION_ASSET_HEIGHT,
    palette: ["#03111f", "#155e75", "#a7f3d0", "#f0abfc"],
    accentColor: "#a7f3d0",
    publicAlt: "棱镜水域的折光潮汐、镜帆码头、彩带水标和服务器校准的航行线。",
  },
  {
    regionId: "region_probability_greenhouse",
    title: "概率温室",
    subtitle: "分支花棚与种子市场",
    fileName: "region-probability-greenhouse.png",
    path: "obsidian-epoch/assets/location/region-probability-greenhouse.png",
    url: "/api/epoch/assets/location/region-probability-greenhouse.png",
    contentType: EPOCH_LOCATION_ASSET_CONTENT_TYPE,
    width: EPOCH_LOCATION_ASSET_WIDTH,
    height: EPOCH_LOCATION_ASSET_HEIGHT,
    palette: ["#04130a", "#166534", "#bef264", "#facc15"],
    accentColor: "#bef264",
    publicAlt: "概率温室的分支花棚、可能性种子、玻璃步道和服务器锁定的收获窗口。",
  },
  {
    regionId: "region_prophecy_server",
    title: "预言服务器",
    subtitle: "冷机房与判定神谕厅",
    fileName: "region-prophecy-server.png",
    path: "obsidian-epoch/assets/location/region-prophecy-server.png",
    url: "/api/epoch/assets/location/region-prophecy-server.png",
    contentType: EPOCH_LOCATION_ASSET_CONTENT_TYPE,
    width: EPOCH_LOCATION_ASSET_WIDTH,
    height: EPOCH_LOCATION_ASSET_HEIGHT,
    palette: ["#020617", "#1e1b4b", "#93c5fd", "#facc15"],
    accentColor: "#93c5fd",
    publicAlt: "预言服务器的冷机房、判定神谕厅、蓝白风扇光和服务器权威签印。",
  },
  {
    regionId: "region_orbital_cathedral",
    title: "轨道教堂",
    subtitle: "钟环中殿与低轨圣歌",
    fileName: "region-orbital-cathedral.png",
    path: "obsidian-epoch/assets/location/region-orbital-cathedral.png",
    url: "/api/epoch/assets/location/region-orbital-cathedral.png",
    contentType: EPOCH_LOCATION_ASSET_CONTENT_TYPE,
    width: EPOCH_LOCATION_ASSET_WIDTH,
    height: EPOCH_LOCATION_ASSET_HEIGHT,
    palette: ["#07030f", "#312e81", "#f8fafc", "#f59e0b"],
    accentColor: "#f8fafc",
    publicAlt: "轨道教堂的钟环中殿、低轨圣歌灯、漂浮祭台和服务器标定的公共航道。",
  },
] as const satisfies readonly EpochLocationAssetRecord[];

export function epochLocationAssetForRegion(regionId: string): EpochLocationAssetRecord | undefined {
  const mediaRegionId = resolveEpochMediaRegionId(regionId);
  return EPOCH_LOCATION_ASSETS.find((asset) => asset.regionId === mediaRegionId);
}

export function epochLocationAssetByFileName(fileName: string): EpochLocationAssetRecord | undefined {
  return EPOCH_LOCATION_ASSETS.find((asset) => asset.fileName === fileName);
}

export function epochLocationAssetFilePath(asset: EpochLocationAssetRecord, packageRoot = defaultPackageRoot) {
  return join(packageRoot, asset.path);
}

export async function readEpochLocationAssetByFileName(fileName: string, packageRoot = defaultPackageRoot) {
  const asset = epochLocationAssetByFileName(fileName);
  if (!asset) return undefined;
  const content = await readFile(epochLocationAssetFilePath(asset, packageRoot));
  return { asset, content };
}

export async function epochLocationAssetManifestEntries(packageRoot = defaultPackageRoot): Promise<EpochLocationAssetManifestEntry[]> {
  return Promise.all(EPOCH_LOCATION_ASSETS.map(async (asset) => {
    const content = await readFile(epochLocationAssetFilePath(asset, packageRoot));
    return {
      regionId: asset.regionId,
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
