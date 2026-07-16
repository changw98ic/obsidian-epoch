import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveEpochMediaRegionId } from "./regionAliases.ts";

export const EPOCH_WORLD_SCENE_WIDTH = 1280;
export const EPOCH_WORLD_SCENE_HEIGHT = 720;
export const EPOCH_WORLD_SCENE_CONTENT_TYPE = "image/png" as const;

const serverRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const defaultPackageRoot = join(serverRoot, "package");

export type EpochWorldSceneKey =
  | "gray_harbor_gate"
  | "gray_harbor_lantern_market"
  | "ash_outpost_wall"
  | "ash_outpost_drill_yard"
  | "salt_mirror_causeway"
  | "salt_mirror_tide_market"
  | "glass_archive_outer_stacks"
  | "glass_archive_index_bridge"
  | "moonwell_hollow_threshold"
  | "moonwell_hollow_meditation_ring"
  | "black_harbor_toll_quay"
  | "black_harbor_signal_roof"
  | "forest_oath_crossing"
  | "forest_moss_shrine"
  | "salt_gate_customs_yard"
  | "salt_gate_bell_bridge"
  | "ash_waste_caravan_line"
  | "ash_waste_cinder_well"
  | "city_pipes_valve_market"
  | "city_pipes_maintenance_crawl"
  | "abandoned_mine_lift_yard"
  | "abandoned_mine_echo_shaft"
  | "data_tower_cache_spire"
  | "data_tower_index_bridge"
  | "orbit_city_ring_station"
  | "orbit_city_beacon_bazaar"
  | "trench_cold_lantern_shelf"
  | "trench_ancient_dream_current"
  | "collective_dream_pool_threshold"
  | "collective_dream_pool_memory_isles"
  | "space_rift_fracture_gate"
  | "space_rift_dust_shepherd_crossing"
  | "non_euclidean_cave_wrong_stair"
  | "non_euclidean_cave_gravity_well"
  | "starship_graveyard_broken_hulls"
  | "starship_graveyard_signal_wake"
  | "abandoned_subway_midnight_platform"
  | "abandoned_subway_flooded_turnstile"
  | "holographic_theater_false_applause"
  | "holographic_theater_spectrum_backstage"
  | "quantum_laboratory_entangled_chamber"
  | "quantum_laboratory_collapse_bridge"
  | "reflective_city_mirror_boulevard"
  | "reflective_city_screen_waterfront"
  | "data_alley_cache_signs"
  | "data_alley_packet_market"
  | "prism_waters_spectrum_tide"
  | "prism_waters_lens_dock"
  | "probability_greenhouse_branch_lab"
  | "probability_greenhouse_seed_market"
  | "prophecy_server_cold_oracle"
  | "prophecy_server_verdict_hall"
  | "orbital_cathedral_bell_halo"
  | "orbital_cathedral_nave_ring";

export interface EpochWorldSceneRecord {
  readonly sceneKey: EpochWorldSceneKey;
  readonly regionId: string;
  readonly title: string;
  readonly subtitle: string;
  readonly fileName: string;
  readonly path: string;
  readonly url: string;
  readonly contentType: typeof EPOCH_WORLD_SCENE_CONTENT_TYPE;
  readonly width: number;
  readonly height: number;
  readonly palette: readonly string[];
  readonly accentColor: string;
  readonly publicAlt: string;
  readonly motif:
    | "harbor-gate"
    | "outpost-wall"
    | "salt-causeway"
    | "archive-district"
    | "moonwell-threshold"
    | "black-harbor"
    | "forest-shrine"
    | "salt-gate"
    | "ash-waste"
    | "city-pipes"
    | "mine"
    | "data-tower"
    | "orbit-city"
    | "trench"
    | "dream-pool"
    | "space-rift"
    | "non-euclidean"
    | "starship-graveyard"
    | "abandoned-subway"
    | "holographic-theater"
    | "quantum-laboratory"
    | "reflective-city"
    | "data-alley"
    | "prism-waters"
    | "probability-greenhouse"
    | "prophecy-server"
    | "orbital-cathedral";
}

export interface EpochWorldSceneManifestEntry {
  readonly sceneKey: EpochWorldSceneKey;
  readonly regionId: string;
  readonly title: string;
  readonly subtitle: string;
  readonly path: string;
  readonly url: string;
  readonly contentType: typeof EPOCH_WORLD_SCENE_CONTENT_TYPE;
  readonly width: number;
  readonly height: number;
  readonly sha256: string;
}

export interface EpochWorldSceneMedia {
  readonly sceneKey: EpochWorldSceneKey;
  readonly regionId: string;
  readonly title: string;
  readonly subtitle: string;
  readonly palette: readonly string[];
  readonly accentColor: string;
  readonly publicAlt: string;
  readonly assetPath: string;
  readonly imageUrl: string;
  readonly contentType: typeof EPOCH_WORLD_SCENE_CONTENT_TYPE;
  readonly width: number;
  readonly height: number;
}

export const EPOCH_WORLD_SCENES = [
  {
    sceneKey: "gray_harbor_gate",
    regionId: "region_gray_harbor",
    title: "灰港外门",
    subtitle: "巡游者进入灰港前看到的灯塔、税闸和潮湿石路",
    fileName: "gray-harbor-gate-world-scene.png",
    path: "obsidian-epoch/assets/world-scene/gray-harbor-gate-world-scene.png",
    url: "/api/epoch/assets/world-scene/gray-harbor-gate-world-scene.png",
    contentType: EPOCH_WORLD_SCENE_CONTENT_TYPE,
    width: EPOCH_WORLD_SCENE_WIDTH,
    height: EPOCH_WORLD_SCENE_HEIGHT,
    palette: ["#07151d", "#164e63", "#67e8f9", "#d6b076"],
    accentColor: "#67e8f9",
    publicAlt: "灰港外门的潮湿石路、灯塔光束、港口税闸和远处黑曜海雾。",
    motif: "harbor-gate",
  },
  {
    sceneKey: "gray_harbor_lantern_market",
    regionId: "region_gray_harbor",
    title: "灰港灯市",
    subtitle: "潮线集市、临时摊棚和等待托管者归来的委托牌",
    fileName: "gray-harbor-lantern-market-world-scene.png",
    path: "obsidian-epoch/assets/world-scene/gray-harbor-lantern-market-world-scene.png",
    url: "/api/epoch/assets/world-scene/gray-harbor-lantern-market-world-scene.png",
    contentType: EPOCH_WORLD_SCENE_CONTENT_TYPE,
    width: EPOCH_WORLD_SCENE_WIDTH,
    height: EPOCH_WORLD_SCENE_HEIGHT,
    palette: ["#061015", "#155e75", "#f59e0b", "#67e8f9"],
    accentColor: "#f59e0b",
    publicAlt: "灰港灯市的潮线摊棚、挂灯、委托牌和等待托管者归来的集市人群。",
    motif: "harbor-gate",
  },
  {
    sceneKey: "ash_outpost_wall",
    regionId: "region_ash_outpost",
    title: "灰烬前哨城墙",
    subtitle: "训练号角、炉光和巡逻者等待下一次委托",
    fileName: "ash-outpost-wall-world-scene.png",
    path: "obsidian-epoch/assets/world-scene/ash-outpost-wall-world-scene.png",
    url: "/api/epoch/assets/world-scene/ash-outpost-wall-world-scene.png",
    contentType: EPOCH_WORLD_SCENE_CONTENT_TYPE,
    width: EPOCH_WORLD_SCENE_WIDTH,
    height: EPOCH_WORLD_SCENE_HEIGHT,
    palette: ["#17100f", "#7f1d1d", "#f97316", "#94a3b8"],
    accentColor: "#f97316",
    publicAlt: "灰烬前哨城墙的炉光、训练旗、瞭望塔和等待出发的巡逻队。",
    motif: "outpost-wall",
  },
  {
    sceneKey: "ash_outpost_drill_yard",
    regionId: "region_ash_outpost",
    title: "灰烬前哨操练场",
    subtitle: "旧炉火、靶桩和等待托管行动的夜训队列",
    fileName: "ash-outpost-drill-yard-world-scene.png",
    path: "obsidian-epoch/assets/world-scene/ash-outpost-drill-yard-world-scene.png",
    url: "/api/epoch/assets/world-scene/ash-outpost-drill-yard-world-scene.png",
    contentType: EPOCH_WORLD_SCENE_CONTENT_TYPE,
    width: EPOCH_WORLD_SCENE_WIDTH,
    height: EPOCH_WORLD_SCENE_HEIGHT,
    palette: ["#130907", "#7c2d12", "#fb923c", "#cbd5e1"],
    accentColor: "#fb923c",
    publicAlt: "灰烬前哨操练场的旧炉火、靶桩、巡夜旗和等待托管行动的队列。",
    motif: "outpost-wall",
  },
  {
    sceneKey: "salt_mirror_causeway",
    regionId: "region_salt_mirror_coast",
    title: "盐镜堤道",
    subtitle: "商队穿过反光盐潮和临时市场之间的狭长路",
    fileName: "salt-mirror-causeway-world-scene.png",
    path: "obsidian-epoch/assets/world-scene/salt-mirror-causeway-world-scene.png",
    url: "/api/epoch/assets/world-scene/salt-mirror-causeway-world-scene.png",
    contentType: EPOCH_WORLD_SCENE_CONTENT_TYPE,
    width: EPOCH_WORLD_SCENE_WIDTH,
    height: EPOCH_WORLD_SCENE_HEIGHT,
    palette: ["#0f1b2c", "#0369a1", "#bae6fd", "#facc15"],
    accentColor: "#bae6fd",
    publicAlt: "盐镜堤道的反光潮面、商队灯线、临时市棚和远处的海岸标塔。",
    motif: "salt-causeway",
  },
  {
    sceneKey: "salt_mirror_tide_market",
    regionId: "region_salt_mirror_coast",
    title: "盐镜潮市",
    subtitle: "潮汐退去后的临时摊棚、竞价旗和护送队列",
    fileName: "salt-mirror-tide-market-world-scene.png",
    path: "obsidian-epoch/assets/world-scene/salt-mirror-tide-market-world-scene.png",
    url: "/api/epoch/assets/world-scene/salt-mirror-tide-market-world-scene.png",
    contentType: EPOCH_WORLD_SCENE_CONTENT_TYPE,
    width: EPOCH_WORLD_SCENE_WIDTH,
    height: EPOCH_WORLD_SCENE_HEIGHT,
    palette: ["#071827", "#0369a1", "#a5f3fc", "#fde68a"],
    accentColor: "#a5f3fc",
    publicAlt: "盐镜潮市的退潮盐面、临时摊棚、竞价旗和等待护送的商队灯线。",
    motif: "salt-causeway",
  },
  {
    sceneKey: "glass_archive_outer_stacks",
    regionId: "region_glass_archive",
    title: "玻璃档案外库",
    subtitle: "透明书塔、索引桥和被服务器记录的公开誓言",
    fileName: "glass-archive-outer-stacks-world-scene.png",
    path: "obsidian-epoch/assets/world-scene/glass-archive-outer-stacks-world-scene.png",
    url: "/api/epoch/assets/world-scene/glass-archive-outer-stacks-world-scene.png",
    contentType: EPOCH_WORLD_SCENE_CONTENT_TYPE,
    width: EPOCH_WORLD_SCENE_WIDTH,
    height: EPOCH_WORLD_SCENE_HEIGHT,
    palette: ["#0f1720", "#0f766e", "#a7f3d0", "#f8fafc"],
    accentColor: "#a7f3d0",
    publicAlt: "玻璃档案外库的透明书塔、索引桥、检索光和安静的誓言阶梯。",
    motif: "archive-district",
  },
  {
    sceneKey: "glass_archive_index_bridge",
    regionId: "region_glass_archive",
    title: "玻璃档案索引桥",
    subtitle: "悬空索引桥、誓言灯和服务器封存的公开档案",
    fileName: "glass-archive-index-bridge-world-scene.png",
    path: "obsidian-epoch/assets/world-scene/glass-archive-index-bridge-world-scene.png",
    url: "/api/epoch/assets/world-scene/glass-archive-index-bridge-world-scene.png",
    contentType: EPOCH_WORLD_SCENE_CONTENT_TYPE,
    width: EPOCH_WORLD_SCENE_WIDTH,
    height: EPOCH_WORLD_SCENE_HEIGHT,
    palette: ["#07131a", "#0f766e", "#99f6e4", "#f8fafc"],
    accentColor: "#99f6e4",
    publicAlt: "玻璃档案索引桥的悬空桥面、誓言灯、透明书塔和公开档案封存光。",
    motif: "archive-district",
  },
  {
    sceneKey: "moonwell_hollow_threshold",
    regionId: "region_moonwell_hollow",
    title: "月井空壳入口",
    subtitle: "银井、低语树影和托管修炼者的静默边界",
    fileName: "moonwell-hollow-threshold-world-scene.png",
    path: "obsidian-epoch/assets/world-scene/moonwell-hollow-threshold-world-scene.png",
    url: "/api/epoch/assets/world-scene/moonwell-hollow-threshold-world-scene.png",
    contentType: EPOCH_WORLD_SCENE_CONTENT_TYPE,
    width: EPOCH_WORLD_SCENE_WIDTH,
    height: EPOCH_WORLD_SCENE_HEIGHT,
    palette: ["#0b1020", "#581c87", "#c4b5fd", "#22c55e"],
    accentColor: "#c4b5fd",
    publicAlt: "月井空壳入口的银色废井、低语树影、苔光台阶和静默修炼席。",
    motif: "moonwell-threshold",
  },
  {
    sceneKey: "moonwell_hollow_meditation_ring",
    regionId: "region_moonwell_hollow",
    title: "月井修炼环",
    subtitle: "围绕银井的托管修炼席、苔光标记和亲友祈愿牌",
    fileName: "moonwell-hollow-meditation-ring-world-scene.png",
    path: "obsidian-epoch/assets/world-scene/moonwell-hollow-meditation-ring-world-scene.png",
    url: "/api/epoch/assets/world-scene/moonwell-hollow-meditation-ring-world-scene.png",
    contentType: EPOCH_WORLD_SCENE_CONTENT_TYPE,
    width: EPOCH_WORLD_SCENE_WIDTH,
    height: EPOCH_WORLD_SCENE_HEIGHT,
    palette: ["#08111f", "#4c1d95", "#c4b5fd", "#34d399"],
    accentColor: "#c4b5fd",
    publicAlt: "月井修炼环的银井、托管修炼席、苔光标记和亲友留下的祈愿牌。",
    motif: "moonwell-threshold",
  },
  {
    sceneKey: "black_harbor_toll_quay",
    regionId: "region_blackharbor",
    title: "黑港税平码头",
    subtitle: "潮湿税棚、封蜡账册和等待服务器放行的夜航货队",
    fileName: "black-harbor-toll-quay-world-scene.png",
    path: "obsidian-epoch/assets/world-scene/black-harbor-toll-quay-world-scene.png",
    url: "/api/epoch/assets/world-scene/black-harbor-toll-quay-world-scene.png",
    contentType: EPOCH_WORLD_SCENE_CONTENT_TYPE,
    width: EPOCH_WORLD_SCENE_WIDTH,
    height: EPOCH_WORLD_SCENE_HEIGHT,
    palette: ["#05080c", "#172554", "#38bdf8", "#d97706"],
    accentColor: "#38bdf8",
    publicAlt: "黑港税平码头的湿石岸、封蜡账册、低蓝哨灯和等待服务器放行的夜航货队。",
    motif: "black-harbor",
  },
  {
    sceneKey: "black_harbor_signal_roof",
    regionId: "region_blackharbor",
    title: "黑港信号屋顶",
    subtitle: "雾中旗灯、走私传闻和公开榜单下的守夜人",
    fileName: "black-harbor-signal-roof-world-scene.png",
    path: "obsidian-epoch/assets/world-scene/black-harbor-signal-roof-world-scene.png",
    url: "/api/epoch/assets/world-scene/black-harbor-signal-roof-world-scene.png",
    contentType: EPOCH_WORLD_SCENE_CONTENT_TYPE,
    width: EPOCH_WORLD_SCENE_WIDTH,
    height: EPOCH_WORLD_SCENE_HEIGHT,
    palette: ["#04070b", "#1e293b", "#60a5fa", "#f59e0b"],
    accentColor: "#60a5fa",
    publicAlt: "黑港信号屋顶的雾中旗灯、屋脊巡线、公开榜单和等待托管行动的守夜人。",
    motif: "black-harbor",
  },
  {
    sceneKey: "forest_oath_crossing",
    regionId: "region_forest",
    title: "誓林岔路",
    subtitle: "树根路标、猎人誓牌和通往深林委托的潮湿小径",
    fileName: "forest-oath-crossing-world-scene.png",
    path: "obsidian-epoch/assets/world-scene/forest-oath-crossing-world-scene.png",
    url: "/api/epoch/assets/world-scene/forest-oath-crossing-world-scene.png",
    contentType: EPOCH_WORLD_SCENE_CONTENT_TYPE,
    width: EPOCH_WORLD_SCENE_WIDTH,
    height: EPOCH_WORLD_SCENE_HEIGHT,
    palette: ["#07120b", "#14532d", "#86efac", "#facc15"],
    accentColor: "#86efac",
    publicAlt: "誓林岔路的树根路标、猎人誓牌、潮湿小径和远处低亮的深林委托灯。",
    motif: "forest-shrine",
  },
  {
    sceneKey: "forest_moss_shrine",
    regionId: "region_forest",
    title: "苔光小祠",
    subtitle: "林中亲友祈牌、疗养席和等待归档的地方传闻",
    fileName: "forest-moss-shrine-world-scene.png",
    path: "obsidian-epoch/assets/world-scene/forest-moss-shrine-world-scene.png",
    url: "/api/epoch/assets/world-scene/forest-moss-shrine-world-scene.png",
    contentType: EPOCH_WORLD_SCENE_CONTENT_TYPE,
    width: EPOCH_WORLD_SCENE_WIDTH,
    height: EPOCH_WORLD_SCENE_HEIGHT,
    palette: ["#06110a", "#166534", "#bbf7d0", "#a7f3d0"],
    accentColor: "#bbf7d0",
    publicAlt: "苔光小祠的亲友祈牌、疗养席、树冠光斑和等待服务器归档的地方传闻。",
    motif: "forest-shrine",
  },
  {
    sceneKey: "salt_gate_customs_yard",
    regionId: "region_salt_gate",
    title: "盐门关税场",
    subtitle: "盐风关卡、封蜡账棚和等待通行许可的边境车队",
    fileName: "salt-gate-customs-yard-world-scene.png",
    path: "obsidian-epoch/assets/world-scene/salt-gate-customs-yard-world-scene.png",
    url: "/api/epoch/assets/world-scene/salt-gate-customs-yard-world-scene.png",
    contentType: EPOCH_WORLD_SCENE_CONTENT_TYPE,
    width: EPOCH_WORLD_SCENE_WIDTH,
    height: EPOCH_WORLD_SCENE_HEIGHT,
    palette: ["#08131a", "#0f4c5c", "#e0f2fe", "#d97706"],
    accentColor: "#f59e0b",
    publicAlt: "盐门关税场的盐风关卡、封蜡账棚、账册灯和等待服务器放行的边境车队。",
    motif: "salt-gate",
  },
  {
    sceneKey: "salt_gate_bell_bridge",
    regionId: "region_salt_gate",
    title: "盐门钟桥",
    subtitle: "悬钟桥、盐雾旗线和通往边境市集的审查队列",
    fileName: "salt-gate-bell-bridge-world-scene.png",
    path: "obsidian-epoch/assets/world-scene/salt-gate-bell-bridge-world-scene.png",
    url: "/api/epoch/assets/world-scene/salt-gate-bell-bridge-world-scene.png",
    contentType: EPOCH_WORLD_SCENE_CONTENT_TYPE,
    width: EPOCH_WORLD_SCENE_WIDTH,
    height: EPOCH_WORLD_SCENE_HEIGHT,
    palette: ["#071827", "#155e75", "#bae6fd", "#fbbf24"],
    accentColor: "#bae6fd",
    publicAlt: "盐门钟桥的悬钟、盐雾旗线、桥面审查队列和边境市集灯火。",
    motif: "salt-gate",
  },
  {
    sceneKey: "ash_waste_caravan_line",
    regionId: "region_ash",
    title: "灰烬荒道商队线",
    subtitle: "赤灰荒道、补给车辙和穿越落灰带的护送队",
    fileName: "ash-waste-caravan-line-world-scene.png",
    path: "obsidian-epoch/assets/world-scene/ash-waste-caravan-line-world-scene.png",
    url: "/api/epoch/assets/world-scene/ash-waste-caravan-line-world-scene.png",
    contentType: EPOCH_WORLD_SCENE_CONTENT_TYPE,
    width: EPOCH_WORLD_SCENE_WIDTH,
    height: EPOCH_WORLD_SCENE_HEIGHT,
    palette: ["#120b08", "#7c2d12", "#fb923c", "#94a3b8"],
    accentColor: "#fb923c",
    publicAlt: "灰烬荒道商队线的赤灰车辙、补给旗、落灰带和等待护送的货车队。",
    motif: "ash-waste",
  },
  {
    sceneKey: "ash_waste_cinder_well",
    regionId: "region_ash",
    title: "灰烬荒原渣井",
    subtitle: "冷却渣井、黑铁吊架和荒道旅人的夜间补给点",
    fileName: "ash-waste-cinder-well-world-scene.png",
    path: "obsidian-epoch/assets/world-scene/ash-waste-cinder-well-world-scene.png",
    url: "/api/epoch/assets/world-scene/ash-waste-cinder-well-world-scene.png",
    contentType: EPOCH_WORLD_SCENE_CONTENT_TYPE,
    width: EPOCH_WORLD_SCENE_WIDTH,
    height: EPOCH_WORLD_SCENE_HEIGHT,
    palette: ["#0b0706", "#7f1d1d", "#f97316", "#cbd5e1"],
    accentColor: "#f97316",
    publicAlt: "灰烬荒原渣井的黑铁吊架、冷却井光、夜间补给棚和荒道旅人剪影。",
    motif: "ash-waste",
  },
  {
    sceneKey: "city_pipes_valve_market",
    regionId: "region_city_pipes",
    title: "城市管道阀门市集",
    subtitle: "废城下方的阀门摊位、冷凝水渠和临时委托灯",
    fileName: "city-pipes-valve-market-world-scene.png",
    path: "obsidian-epoch/assets/world-scene/city-pipes-valve-market-world-scene.png",
    url: "/api/epoch/assets/world-scene/city-pipes-valve-market-world-scene.png",
    contentType: EPOCH_WORLD_SCENE_CONTENT_TYPE,
    width: EPOCH_WORLD_SCENE_WIDTH,
    height: EPOCH_WORLD_SCENE_HEIGHT,
    palette: ["#020605", "#14532d", "#5eead4", "#facc15"],
    accentColor: "#5eead4",
    publicAlt: "城市管道阀门市集的冷凝水渠、钠灯摊棚、阀门桥和临时委托灯。",
    motif: "city-pipes",
  },
  {
    sceneKey: "city_pipes_maintenance_crawl",
    regionId: "region_city_pipes",
    title: "城市管道检修爬廊",
    subtitle: "低矮维修道、滴水回声和等待托管行动的工具箱",
    fileName: "city-pipes-maintenance-crawl-world-scene.png",
    path: "obsidian-epoch/assets/world-scene/city-pipes-maintenance-crawl-world-scene.png",
    url: "/api/epoch/assets/world-scene/city-pipes-maintenance-crawl-world-scene.png",
    contentType: EPOCH_WORLD_SCENE_CONTENT_TYPE,
    width: EPOCH_WORLD_SCENE_WIDTH,
    height: EPOCH_WORLD_SCENE_HEIGHT,
    palette: ["#030807", "#0f3f2f", "#2dd4bf", "#eab308"],
    accentColor: "#2dd4bf",
    publicAlt: "城市管道检修爬廊的低矮维修道、滴水回声、工具箱和远处钠灯。",
    motif: "city-pipes",
  },
  {
    sceneKey: "abandoned_mine_lift_yard",
    regionId: "region_abandoned_mine",
    title: "废弃矿区升降井场",
    subtitle: "旧升降塔、塌方轨道和等待清点的矿车队列",
    fileName: "abandoned-mine-lift-yard-world-scene.png",
    path: "obsidian-epoch/assets/world-scene/abandoned-mine-lift-yard-world-scene.png",
    url: "/api/epoch/assets/world-scene/abandoned-mine-lift-yard-world-scene.png",
    contentType: EPOCH_WORLD_SCENE_CONTENT_TYPE,
    width: EPOCH_WORLD_SCENE_WIDTH,
    height: EPOCH_WORLD_SCENE_HEIGHT,
    palette: ["#0b0806", "#57534e", "#f59e0b", "#60a5fa"],
    accentColor: "#f59e0b",
    publicAlt: "废弃矿区升降井场的旧升降塔、塌方轨道、矿车队列和封存警戒灯。",
    motif: "mine",
  },
  {
    sceneKey: "abandoned_mine_echo_shaft",
    regionId: "region_abandoned_mine",
    title: "废弃矿区回声竖井",
    subtitle: "蓝尘矿灯、深井回声和服务器封存的塌方区域",
    fileName: "abandoned-mine-echo-shaft-world-scene.png",
    path: "obsidian-epoch/assets/world-scene/abandoned-mine-echo-shaft-world-scene.png",
    url: "/api/epoch/assets/world-scene/abandoned-mine-echo-shaft-world-scene.png",
    contentType: EPOCH_WORLD_SCENE_CONTENT_TYPE,
    width: EPOCH_WORLD_SCENE_WIDTH,
    height: EPOCH_WORLD_SCENE_HEIGHT,
    palette: ["#070605", "#44403c", "#60a5fa", "#f59e0b"],
    accentColor: "#60a5fa",
    publicAlt: "废弃矿区回声竖井的蓝尘矿灯、深井回声、塌方警戒线和残旧轨道。",
    motif: "mine",
  },
  {
    sceneKey: "data_tower_cache_spire",
    regionId: "region_data_tower",
    title: "废弃数据塔缓存尖顶",
    subtitle: "断裂缓存层、脑晶灯列和高空维护桥",
    fileName: "data-tower-cache-spire-world-scene.png",
    path: "obsidian-epoch/assets/world-scene/data-tower-cache-spire-world-scene.png",
    url: "/api/epoch/assets/world-scene/data-tower-cache-spire-world-scene.png",
    contentType: EPOCH_WORLD_SCENE_CONTENT_TYPE,
    width: EPOCH_WORLD_SCENE_WIDTH,
    height: EPOCH_WORLD_SCENE_HEIGHT,
    palette: ["#030712", "#1e1b4b", "#67e8f9", "#a78bfa"],
    accentColor: "#67e8f9",
    publicAlt: "废弃数据塔缓存尖顶的断裂楼层、脑晶灯列、维护桥和数据雨。",
    motif: "data-tower",
  },
  {
    sceneKey: "data_tower_index_bridge",
    regionId: "region_data_tower",
    title: "废弃数据塔索引桥",
    subtitle: "摇晃索引桥、封存缓存和被星风刮亮的塔脊",
    fileName: "data-tower-index-bridge-world-scene.png",
    path: "obsidian-epoch/assets/world-scene/data-tower-index-bridge-world-scene.png",
    url: "/api/epoch/assets/world-scene/data-tower-index-bridge-world-scene.png",
    contentType: EPOCH_WORLD_SCENE_CONTENT_TYPE,
    width: EPOCH_WORLD_SCENE_WIDTH,
    height: EPOCH_WORLD_SCENE_HEIGHT,
    palette: ["#050816", "#312e81", "#a5f3fc", "#c4b5fd"],
    accentColor: "#a5f3fc",
    publicAlt: "废弃数据塔索引桥的悬空桥面、封存缓存、星风和脑晶巡检灯。",
    motif: "data-tower",
  },
  {
    sceneKey: "orbit_city_ring_station",
    regionId: "region_orbit_city",
    title: "轨道城环站",
    subtitle: "低轨泊位、环形街区和星历交通灯",
    fileName: "orbit-city-ring-station-world-scene.png",
    path: "obsidian-epoch/assets/world-scene/orbit-city-ring-station-world-scene.png",
    url: "/api/epoch/assets/world-scene/orbit-city-ring-station-world-scene.png",
    contentType: EPOCH_WORLD_SCENE_CONTENT_TYPE,
    width: EPOCH_WORLD_SCENE_WIDTH,
    height: EPOCH_WORLD_SCENE_HEIGHT,
    palette: ["#020617", "#0f172a", "#93c5fd", "#facc15"],
    accentColor: "#93c5fd",
    publicAlt: "轨道城环站的弧形泊位、低轨航道、星历交通灯和悬空街区。",
    motif: "orbit-city",
  },
  {
    sceneKey: "orbit_city_beacon_bazaar",
    regionId: "region_orbit_city",
    title: "轨道城信标灯市",
    subtitle: "信标塔、悬浮摊位和等待放行的迁徙航道",
    fileName: "orbit-city-beacon-bazaar-world-scene.png",
    path: "obsidian-epoch/assets/world-scene/orbit-city-beacon-bazaar-world-scene.png",
    url: "/api/epoch/assets/world-scene/orbit-city-beacon-bazaar-world-scene.png",
    contentType: EPOCH_WORLD_SCENE_CONTENT_TYPE,
    width: EPOCH_WORLD_SCENE_WIDTH,
    height: EPOCH_WORLD_SCENE_HEIGHT,
    palette: ["#020617", "#1e293b", "#bfdbfe", "#facc15"],
    accentColor: "#bfdbfe",
    publicAlt: "轨道城信标灯市的星历信标塔、悬浮摊位、迁徙航道和公开许可牌。",
    motif: "orbit-city",
  },
  {
    sceneKey: "trench_cold_lantern_shelf",
    regionId: "region_trench",
    title: "海沟冷灯岩架",
    subtitle: "深海岩架、冷光灯标和等待服务器放行的下潜路径",
    fileName: "trench-cold-lantern-shelf-world-scene.png",
    path: "obsidian-epoch/assets/world-scene/trench-cold-lantern-shelf-world-scene.png",
    url: "/api/epoch/assets/world-scene/trench-cold-lantern-shelf-world-scene.png",
    contentType: EPOCH_WORLD_SCENE_CONTENT_TYPE,
    width: EPOCH_WORLD_SCENE_WIDTH,
    height: EPOCH_WORLD_SCENE_HEIGHT,
    palette: ["#010814", "#0f3f46", "#67e8f9", "#22c55e"],
    accentColor: "#67e8f9",
    publicAlt: "海沟冷灯岩架的深海裂壁、冷光灯标、下潜绳桥和守梦生物远影。",
    motif: "trench",
  },
  {
    sceneKey: "trench_ancient_dream_current",
    regionId: "region_trench",
    title: "海沟古梦暗流",
    subtitle: "古梦水流、浮游光带和折寿风险标记",
    fileName: "trench-ancient-dream-current-world-scene.png",
    path: "obsidian-epoch/assets/world-scene/trench-ancient-dream-current-world-scene.png",
    url: "/api/epoch/assets/world-scene/trench-ancient-dream-current-world-scene.png",
    contentType: EPOCH_WORLD_SCENE_CONTENT_TYPE,
    width: EPOCH_WORLD_SCENE_WIDTH,
    height: EPOCH_WORLD_SCENE_HEIGHT,
    palette: ["#020617", "#134e4a", "#5eead4", "#a7f3d0"],
    accentColor: "#5eead4",
    publicAlt: "海沟古梦暗流的发光浮游带、折寿风险标记、古老水压裂纹和低频梦流。",
    motif: "trench",
  },
  {
    sceneKey: "collective_dream_pool_threshold",
    regionId: "region_collective_dream_pool",
    title: "集体梦池门槛",
    subtitle: "共享梦面、入梦阶梯和服务器身份封条",
    fileName: "collective-dream-pool-threshold-world-scene.png",
    path: "obsidian-epoch/assets/world-scene/collective-dream-pool-threshold-world-scene.png",
    url: "/api/epoch/assets/world-scene/collective-dream-pool-threshold-world-scene.png",
    contentType: EPOCH_WORLD_SCENE_CONTENT_TYPE,
    width: EPOCH_WORLD_SCENE_WIDTH,
    height: EPOCH_WORLD_SCENE_HEIGHT,
    palette: ["#080414", "#4c1d95", "#c084fc", "#22d3ee"],
    accentColor: "#c084fc",
    publicAlt: "集体梦池门槛的入梦阶梯、共享梦面、身份封条和等待托管行动的梦灯。",
    motif: "dream-pool",
  },
  {
    sceneKey: "collective_dream_pool_memory_isles",
    regionId: "region_collective_dream_pool",
    title: "集体梦池记忆浮岛",
    subtitle: "梦面浮岛、公共回忆灯和可被新闻引用的传说倒影",
    fileName: "collective-dream-pool-memory-isles-world-scene.png",
    path: "obsidian-epoch/assets/world-scene/collective-dream-pool-memory-isles-world-scene.png",
    url: "/api/epoch/assets/world-scene/collective-dream-pool-memory-isles-world-scene.png",
    contentType: EPOCH_WORLD_SCENE_CONTENT_TYPE,
    width: EPOCH_WORLD_SCENE_WIDTH,
    height: EPOCH_WORLD_SCENE_HEIGHT,
    palette: ["#090513", "#312e81", "#a78bfa", "#67e8f9"],
    accentColor: "#a78bfa",
    publicAlt: "集体梦池记忆浮岛的公共回忆灯、梦面倒影、新闻传说标记和漂浮阶梯。",
    motif: "dream-pool",
  },
  {
    sceneKey: "space_rift_fracture_gate",
    regionId: "region_space_rift",
    title: "空间裂缝断面门",
    subtitle: "错位门框、紫色裂光和服务器通行封条",
    fileName: "space-rift-fracture-gate-world-scene.png",
    path: "obsidian-epoch/assets/world-scene/space-rift-fracture-gate-world-scene.png",
    url: "/api/epoch/assets/world-scene/space-rift-fracture-gate-world-scene.png",
    contentType: EPOCH_WORLD_SCENE_CONTENT_TYPE,
    width: EPOCH_WORLD_SCENE_WIDTH,
    height: EPOCH_WORLD_SCENE_HEIGHT,
    palette: ["#07021a", "#312e81", "#c084fc", "#67e8f9"],
    accentColor: "#c084fc",
    publicAlt: "空间裂缝断面门的错位门框、紫色裂光、通行封条和悬浮落尘。",
    motif: "space-rift",
  },
  {
    sceneKey: "space_rift_dust_shepherd_crossing",
    regionId: "region_space_rift",
    title: "空间裂缝落尘牧道",
    subtitle: "落尘羊影、裂隙路标和临时跨维桥",
    fileName: "space-rift-dust-shepherd-crossing-world-scene.png",
    path: "obsidian-epoch/assets/world-scene/space-rift-dust-shepherd-crossing-world-scene.png",
    url: "/api/epoch/assets/world-scene/space-rift-dust-shepherd-crossing-world-scene.png",
    contentType: EPOCH_WORLD_SCENE_CONTENT_TYPE,
    width: EPOCH_WORLD_SCENE_WIDTH,
    height: EPOCH_WORLD_SCENE_HEIGHT,
    palette: ["#080414", "#3730a3", "#a78bfa", "#bfdbfe"],
    accentColor: "#a78bfa",
    publicAlt: "空间裂缝落尘牧道的悬浮尘羊、错位路标、跨维桥和远处裂光。",
    motif: "space-rift",
  },
  {
    sceneKey: "non_euclidean_cave_wrong_stair",
    regionId: "region_non_euclidean_cave",
    title: "非欧洞窟错误楼梯",
    subtitle: "无法对齐的阶梯、折叠岩壁和黄铜测量灯",
    fileName: "non-euclidean-cave-wrong-stair-world-scene.png",
    path: "obsidian-epoch/assets/world-scene/non-euclidean-cave-wrong-stair-world-scene.png",
    url: "/api/epoch/assets/world-scene/non-euclidean-cave-wrong-stair-world-scene.png",
    contentType: EPOCH_WORLD_SCENE_CONTENT_TYPE,
    width: EPOCH_WORLD_SCENE_WIDTH,
    height: EPOCH_WORLD_SCENE_HEIGHT,
    palette: ["#06030f", "#3b0764", "#a78bfa", "#facc15"],
    accentColor: "#a78bfa",
    publicAlt: "非欧洞窟错误楼梯的折叠岩壁、反向阶梯、黄铜测量灯和重力标尺。",
    motif: "non-euclidean",
  },
  {
    sceneKey: "non_euclidean_cave_gravity_well",
    regionId: "region_non_euclidean_cave",
    title: "非欧洞窟重力回声井",
    subtitle: "重力回声、倒置绳桥和无法闭合的路径",
    fileName: "non-euclidean-cave-gravity-well-world-scene.png",
    path: "obsidian-epoch/assets/world-scene/non-euclidean-cave-gravity-well-world-scene.png",
    url: "/api/epoch/assets/world-scene/non-euclidean-cave-gravity-well-world-scene.png",
    contentType: EPOCH_WORLD_SCENE_CONTENT_TYPE,
    width: EPOCH_WORLD_SCENE_WIDTH,
    height: EPOCH_WORLD_SCENE_HEIGHT,
    palette: ["#05020d", "#581c87", "#c4b5fd", "#fde68a"],
    accentColor: "#c4b5fd",
    publicAlt: "非欧洞窟重力回声井的倒置绳桥、折叠路径、黄铜灯和深处紫色回声。",
    motif: "non-euclidean",
  },
  {
    sceneKey: "starship_graveyard_broken_hulls",
    regionId: "region_starship_graveyard",
    title: "星舰墓场断壳带",
    subtitle: "断裂船壳、冷轨碎片和打捞禁线",
    fileName: "starship-graveyard-broken-hulls-world-scene.png",
    path: "obsidian-epoch/assets/world-scene/starship-graveyard-broken-hulls-world-scene.png",
    url: "/api/epoch/assets/world-scene/starship-graveyard-broken-hulls-world-scene.png",
    contentType: EPOCH_WORLD_SCENE_CONTENT_TYPE,
    width: EPOCH_WORLD_SCENE_WIDTH,
    height: EPOCH_WORLD_SCENE_HEIGHT,
    palette: ["#020617", "#172554", "#93c5fd", "#facc15"],
    accentColor: "#93c5fd",
    publicAlt: "星舰墓场断壳带的破碎船体、冷轨碎片、打捞禁线和漂航信标。",
    motif: "starship-graveyard",
  },
  {
    sceneKey: "starship_graveyard_signal_wake",
    regionId: "region_starship_graveyard",
    title: "星舰墓场信标尾流",
    subtitle: "冷白信标、漂航尾迹和残骸导航灯",
    fileName: "starship-graveyard-signal-wake-world-scene.png",
    path: "obsidian-epoch/assets/world-scene/starship-graveyard-signal-wake-world-scene.png",
    url: "/api/epoch/assets/world-scene/starship-graveyard-signal-wake-world-scene.png",
    contentType: EPOCH_WORLD_SCENE_CONTENT_TYPE,
    width: EPOCH_WORLD_SCENE_WIDTH,
    height: EPOCH_WORLD_SCENE_HEIGHT,
    palette: ["#030712", "#1e3a8a", "#bfdbfe", "#fde68a"],
    accentColor: "#bfdbfe",
    publicAlt: "星舰墓场信标尾流中的冷白导航灯、漂航残骸、牵引线和高空碎星。",
    motif: "starship-graveyard",
  },
  {
    sceneKey: "abandoned_subway_midnight_platform",
    regionId: "region_abandoned_subway",
    title: "废弃地铁午夜站台",
    subtitle: "旧广告灯、积水轨道和封存站名牌",
    fileName: "abandoned-subway-midnight-platform-world-scene.png",
    path: "obsidian-epoch/assets/world-scene/abandoned-subway-midnight-platform-world-scene.png",
    url: "/api/epoch/assets/world-scene/abandoned-subway-midnight-platform-world-scene.png",
    contentType: EPOCH_WORLD_SCENE_CONTENT_TYPE,
    width: EPOCH_WORLD_SCENE_WIDTH,
    height: EPOCH_WORLD_SCENE_HEIGHT,
    palette: ["#050807", "#1f2937", "#5eead4", "#f59e0b"],
    accentColor: "#5eead4",
    publicAlt: "废弃地铁午夜站台的旧广告灯、积水轨道、锈蚀闸机和封存站名牌。",
    motif: "abandoned-subway",
  },
  {
    sceneKey: "abandoned_subway_flooded_turnstile",
    regionId: "region_abandoned_subway",
    title: "废弃地铁积水闸机",
    subtitle: "半淹闸机、青色信号雾和远处隧道光",
    fileName: "abandoned-subway-flooded-turnstile-world-scene.png",
    path: "obsidian-epoch/assets/world-scene/abandoned-subway-flooded-turnstile-world-scene.png",
    url: "/api/epoch/assets/world-scene/abandoned-subway-flooded-turnstile-world-scene.png",
    contentType: EPOCH_WORLD_SCENE_CONTENT_TYPE,
    width: EPOCH_WORLD_SCENE_WIDTH,
    height: EPOCH_WORLD_SCENE_HEIGHT,
    palette: ["#030705", "#374151", "#67e8f9", "#fbbf24"],
    accentColor: "#67e8f9",
    publicAlt: "废弃地铁积水闸机的半淹入口、青色信号雾、远处隧道灯和倒影轨道。",
    motif: "abandoned-subway",
  },
  {
    sceneKey: "holographic_theater_false_applause",
    regionId: "region_holographic_theater",
    title: "全息剧场伪掌声厅",
    subtitle: "空座席、循环喝彩和服务器封存的演出评分",
    fileName: "holographic-theater-false-applause-world-scene.png",
    path: "obsidian-epoch/assets/world-scene/holographic-theater-false-applause-world-scene.png",
    url: "/api/epoch/assets/world-scene/holographic-theater-false-applause-world-scene.png",
    contentType: EPOCH_WORLD_SCENE_CONTENT_TYPE,
    width: EPOCH_WORLD_SCENE_WIDTH,
    height: EPOCH_WORLD_SCENE_HEIGHT,
    palette: ["#050816", "#4c1d95", "#f472b6", "#67e8f9"],
    accentColor: "#f472b6",
    publicAlt: "全息剧场伪掌声厅的空座席、粉紫光幕、循环喝彩灯和服务器封存评分。",
    motif: "holographic-theater",
  },
  {
    sceneKey: "holographic_theater_spectrum_backstage",
    regionId: "region_holographic_theater",
    title: "全息剧场光谱后台",
    subtitle: "折光幕布、角色残影和区域传闻采集台",
    fileName: "holographic-theater-spectrum-backstage-world-scene.png",
    path: "obsidian-epoch/assets/world-scene/holographic-theater-spectrum-backstage-world-scene.png",
    url: "/api/epoch/assets/world-scene/holographic-theater-spectrum-backstage-world-scene.png",
    contentType: EPOCH_WORLD_SCENE_CONTENT_TYPE,
    width: EPOCH_WORLD_SCENE_WIDTH,
    height: EPOCH_WORLD_SCENE_HEIGHT,
    palette: ["#07021a", "#701a75", "#f0abfc", "#67e8f9"],
    accentColor: "#f0abfc",
    publicAlt: "全息剧场光谱后台的折光幕布、角色残影、传闻采集台和伪掌声管线。",
    motif: "holographic-theater",
  },
  {
    sceneKey: "quantum_laboratory_entangled_chamber",
    regionId: "region_quantum_laboratory",
    title: "量子实验室纠缠舱",
    subtitle: "概率玻璃、同步观测环和实验封条",
    fileName: "quantum-laboratory-entangled-chamber-world-scene.png",
    path: "obsidian-epoch/assets/world-scene/quantum-laboratory-entangled-chamber-world-scene.png",
    url: "/api/epoch/assets/world-scene/quantum-laboratory-entangled-chamber-world-scene.png",
    contentType: EPOCH_WORLD_SCENE_CONTENT_TYPE,
    width: EPOCH_WORLD_SCENE_WIDTH,
    height: EPOCH_WORLD_SCENE_HEIGHT,
    palette: ["#020617", "#164e63", "#67e8f9", "#facc15"],
    accentColor: "#67e8f9",
    publicAlt: "量子实验室纠缠舱的概率玻璃、同步观测环、金色警戒灯和服务器实验封条。",
    motif: "quantum-laboratory",
  },
  {
    sceneKey: "quantum_laboratory_collapse_bridge",
    regionId: "region_quantum_laboratory",
    title: "量子实验室坍缩桥",
    subtitle: "可疑桥面、观测标尺和即将坍缩的概率线",
    fileName: "quantum-laboratory-collapse-bridge-world-scene.png",
    path: "obsidian-epoch/assets/world-scene/quantum-laboratory-collapse-bridge-world-scene.png",
    url: "/api/epoch/assets/world-scene/quantum-laboratory-collapse-bridge-world-scene.png",
    contentType: EPOCH_WORLD_SCENE_CONTENT_TYPE,
    width: EPOCH_WORLD_SCENE_WIDTH,
    height: EPOCH_WORLD_SCENE_HEIGHT,
    palette: ["#030712", "#0f766e", "#99f6e4", "#fde68a"],
    accentColor: "#99f6e4",
    publicAlt: "量子实验室坍缩桥的可疑桥面、观测标尺、概率线和锁定中的实验门。",
    motif: "quantum-laboratory",
  },
  {
    sceneKey: "reflective_city_mirror_boulevard",
    regionId: "region_reflective_city",
    title: "反光城市镜面大道",
    subtitle: "镜面街廓、巡游光带和高楼屏幕倒影",
    fileName: "reflective-city-mirror-boulevard-world-scene.png",
    path: "obsidian-epoch/assets/world-scene/reflective-city-mirror-boulevard-world-scene.png",
    url: "/api/epoch/assets/world-scene/reflective-city-mirror-boulevard-world-scene.png",
    contentType: EPOCH_WORLD_SCENE_CONTENT_TYPE,
    width: EPOCH_WORLD_SCENE_WIDTH,
    height: EPOCH_WORLD_SCENE_HEIGHT,
    palette: ["#061018", "#0f766e", "#a5f3fc", "#f472b6"],
    accentColor: "#a5f3fc",
    publicAlt: "反光城市镜面大道的玻璃楼面、霓虹巡游线、屏幕倒影和公开路标。",
    motif: "reflective-city",
  },
  {
    sceneKey: "reflective_city_screen_waterfront",
    regionId: "region_reflective_city",
    title: "反光城市屏幕水岸",
    subtitle: "水面屏幕、广告倒影和可被新闻引用的公开广场",
    fileName: "reflective-city-screen-waterfront-world-scene.png",
    path: "obsidian-epoch/assets/world-scene/reflective-city-screen-waterfront-world-scene.png",
    url: "/api/epoch/assets/world-scene/reflective-city-screen-waterfront-world-scene.png",
    contentType: EPOCH_WORLD_SCENE_CONTENT_TYPE,
    width: EPOCH_WORLD_SCENE_WIDTH,
    height: EPOCH_WORLD_SCENE_HEIGHT,
    palette: ["#030712", "#0f766e", "#99f6e4", "#f0abfc"],
    accentColor: "#99f6e4",
    publicAlt: "反光城市屏幕水岸的发光水面、广告倒影、公开广场和服务器新闻牌。",
    motif: "reflective-city",
  },
  {
    sceneKey: "data_alley_cache_signs",
    regionId: "region_data_alley",
    title: "数据巷缓存招牌",
    subtitle: "密集招牌、走线墙和临时认证灯",
    fileName: "data-alley-cache-signs-world-scene.png",
    path: "obsidian-epoch/assets/world-scene/data-alley-cache-signs-world-scene.png",
    url: "/api/epoch/assets/world-scene/data-alley-cache-signs-world-scene.png",
    contentType: EPOCH_WORLD_SCENE_CONTENT_TYPE,
    width: EPOCH_WORLD_SCENE_WIDTH,
    height: EPOCH_WORLD_SCENE_HEIGHT,
    palette: ["#030712", "#1e1b4b", "#67e8f9", "#f59e0b"],
    accentColor: "#67e8f9",
    publicAlt: "数据巷缓存招牌的密集灯箱、走线墙、临时认证灯和窄巷通行点。",
    motif: "data-alley",
  },
  {
    sceneKey: "data_alley_packet_market",
    regionId: "region_data_alley",
    title: "数据巷包市场",
    subtitle: "包摊位、线缆天幕和服务器结算价目牌",
    fileName: "data-alley-packet-market-world-scene.png",
    path: "obsidian-epoch/assets/world-scene/data-alley-packet-market-world-scene.png",
    url: "/api/epoch/assets/world-scene/data-alley-packet-market-world-scene.png",
    contentType: EPOCH_WORLD_SCENE_CONTENT_TYPE,
    width: EPOCH_WORLD_SCENE_WIDTH,
    height: EPOCH_WORLD_SCENE_HEIGHT,
    palette: ["#050816", "#312e81", "#67e8f9", "#fbbf24"],
    accentColor: "#67e8f9",
    publicAlt: "数据巷包市场的线缆天幕、数据包摊位、价目灯牌和服务器结算标记。",
    motif: "data-alley",
  },
  {
    sceneKey: "prism_waters_spectrum_tide",
    regionId: "region_prism_waters",
    title: "棱镜水域光谱潮",
    subtitle: "折光水面、彩带航标和可被榜单引用的镜帆航路",
    fileName: "prism-waters-spectrum-tide-world-scene.png",
    path: "obsidian-epoch/assets/world-scene/prism-waters-spectrum-tide-world-scene.png",
    url: "/api/epoch/assets/world-scene/prism-waters-spectrum-tide-world-scene.png",
    contentType: EPOCH_WORLD_SCENE_CONTENT_TYPE,
    width: EPOCH_WORLD_SCENE_WIDTH,
    height: EPOCH_WORLD_SCENE_HEIGHT,
    palette: ["#03111f", "#155e75", "#a7f3d0", "#f0abfc"],
    accentColor: "#a7f3d0",
    publicAlt: "棱镜水域光谱潮的折光水面、彩带航标、镜帆航路和服务器校准浮标。",
    motif: "prism-waters",
  },
  {
    sceneKey: "prism_waters_lens_dock",
    regionId: "region_prism_waters",
    title: "棱镜水域透镜码头",
    subtitle: "镜帆停泊、透镜税棚和折光交易线",
    fileName: "prism-waters-lens-dock-world-scene.png",
    path: "obsidian-epoch/assets/world-scene/prism-waters-lens-dock-world-scene.png",
    url: "/api/epoch/assets/world-scene/prism-waters-lens-dock-world-scene.png",
    contentType: EPOCH_WORLD_SCENE_CONTENT_TYPE,
    width: EPOCH_WORLD_SCENE_WIDTH,
    height: EPOCH_WORLD_SCENE_HEIGHT,
    palette: ["#05131a", "#0e7490", "#99f6e4", "#e879f9"],
    accentColor: "#99f6e4",
    publicAlt: "棱镜水域透镜码头的镜帆、透镜税棚、折光交易线和公开航路牌。",
    motif: "prism-waters",
  },
  {
    sceneKey: "probability_greenhouse_branch_lab",
    regionId: "region_probability_greenhouse",
    title: "概率温室分支实验棚",
    subtitle: "分支花床、玻璃步道和未坍缩的收获格",
    fileName: "probability-greenhouse-branch-lab-world-scene.png",
    path: "obsidian-epoch/assets/world-scene/probability-greenhouse-branch-lab-world-scene.png",
    url: "/api/epoch/assets/world-scene/probability-greenhouse-branch-lab-world-scene.png",
    contentType: EPOCH_WORLD_SCENE_CONTENT_TYPE,
    width: EPOCH_WORLD_SCENE_WIDTH,
    height: EPOCH_WORLD_SCENE_HEIGHT,
    palette: ["#04130a", "#166534", "#bef264", "#facc15"],
    accentColor: "#bef264",
    publicAlt: "概率温室分支实验棚的玻璃步道、可能性种子、未坍缩收获格和服务器观测灯。",
    motif: "probability-greenhouse",
  },
  {
    sceneKey: "probability_greenhouse_seed_market",
    regionId: "region_probability_greenhouse",
    title: "概率温室种子市场",
    subtitle: "种子摊、概率价签和公开收获窗口",
    fileName: "probability-greenhouse-seed-market-world-scene.png",
    path: "obsidian-epoch/assets/world-scene/probability-greenhouse-seed-market-world-scene.png",
    url: "/api/epoch/assets/world-scene/probability-greenhouse-seed-market-world-scene.png",
    contentType: EPOCH_WORLD_SCENE_CONTENT_TYPE,
    width: EPOCH_WORLD_SCENE_WIDTH,
    height: EPOCH_WORLD_SCENE_HEIGHT,
    palette: ["#052e16", "#15803d", "#d9f99d", "#fde68a"],
    accentColor: "#d9f99d",
    publicAlt: "概率温室种子市场的分支种子摊、概率价签、玻璃棚光和公开收获倒计时。",
    motif: "probability-greenhouse",
  },
  {
    sceneKey: "prophecy_server_cold_oracle",
    regionId: "region_prophecy_server",
    title: "预言服务器冷神谕厅",
    subtitle: "低温机柜、判定环和审计屏风",
    fileName: "prophecy-server-cold-oracle-world-scene.png",
    path: "obsidian-epoch/assets/world-scene/prophecy-server-cold-oracle-world-scene.png",
    url: "/api/epoch/assets/world-scene/prophecy-server-cold-oracle-world-scene.png",
    contentType: EPOCH_WORLD_SCENE_CONTENT_TYPE,
    width: EPOCH_WORLD_SCENE_WIDTH,
    height: EPOCH_WORLD_SCENE_HEIGHT,
    palette: ["#020617", "#1e1b4b", "#93c5fd", "#facc15"],
    accentColor: "#93c5fd",
    publicAlt: "预言服务器冷神谕厅的低温机柜、蓝白判定环、审计屏风和服务器签印。",
    motif: "prophecy-server",
  },
  {
    sceneKey: "prophecy_server_verdict_hall",
    regionId: "region_prophecy_server",
    title: "预言服务器判定大厅",
    subtitle: "裁决队列、结果石碑和冷光风扇墙",
    fileName: "prophecy-server-verdict-hall-world-scene.png",
    path: "obsidian-epoch/assets/world-scene/prophecy-server-verdict-hall-world-scene.png",
    url: "/api/epoch/assets/world-scene/prophecy-server-verdict-hall-world-scene.png",
    contentType: EPOCH_WORLD_SCENE_CONTENT_TYPE,
    width: EPOCH_WORLD_SCENE_WIDTH,
    height: EPOCH_WORLD_SCENE_HEIGHT,
    palette: ["#030712", "#1d4ed8", "#bfdbfe", "#fbbf24"],
    accentColor: "#bfdbfe",
    publicAlt: "预言服务器判定大厅的裁决队列、结果石碑、冷光风扇墙和公开复核灯。",
    motif: "prophecy-server",
  },
  {
    sceneKey: "orbital_cathedral_bell_halo",
    regionId: "region_orbital_cathedral",
    title: "轨道教堂钟环外廊",
    subtitle: "低轨钟列、圣歌灯和漂浮航标",
    fileName: "orbital-cathedral-bell-halo-world-scene.png",
    path: "obsidian-epoch/assets/world-scene/orbital-cathedral-bell-halo-world-scene.png",
    url: "/api/epoch/assets/world-scene/orbital-cathedral-bell-halo-world-scene.png",
    contentType: EPOCH_WORLD_SCENE_CONTENT_TYPE,
    width: EPOCH_WORLD_SCENE_WIDTH,
    height: EPOCH_WORLD_SCENE_HEIGHT,
    palette: ["#07030f", "#312e81", "#f8fafc", "#f59e0b"],
    accentColor: "#f8fafc",
    publicAlt: "轨道教堂钟环外廊的低轨钟列、圣歌灯、漂浮航标和金色校准线。",
    motif: "orbital-cathedral",
  },
  {
    sceneKey: "orbital_cathedral_nave_ring",
    regionId: "region_orbital_cathedral",
    title: "轨道教堂中殿环",
    subtitle: "漂浮祭台、环形中殿和月白唱诗席",
    fileName: "orbital-cathedral-nave-ring-world-scene.png",
    path: "obsidian-epoch/assets/world-scene/orbital-cathedral-nave-ring-world-scene.png",
    url: "/api/epoch/assets/world-scene/orbital-cathedral-nave-ring-world-scene.png",
    contentType: EPOCH_WORLD_SCENE_CONTENT_TYPE,
    width: EPOCH_WORLD_SCENE_WIDTH,
    height: EPOCH_WORLD_SCENE_HEIGHT,
    palette: ["#0b1026", "#3730a3", "#e0f2fe", "#fbbf24"],
    accentColor: "#e0f2fe",
    publicAlt: "轨道教堂中殿环的漂浮祭台、环形中殿、月白唱诗席和服务器航道标记。",
    motif: "orbital-cathedral",
  },
] as const satisfies readonly EpochWorldSceneRecord[];

function worldSceneFilePath(asset: EpochWorldSceneRecord, packageRoot = defaultPackageRoot) {
  return join(packageRoot, asset.path);
}

export function epochWorldSceneByFileName(fileName: string): EpochWorldSceneRecord | undefined {
  return EPOCH_WORLD_SCENES.find((asset) => asset.fileName === fileName);
}

export function epochWorldScenesForRegion(regionId: string): readonly EpochWorldSceneRecord[] {
  const mediaRegionId = resolveEpochMediaRegionId(regionId);
  return EPOCH_WORLD_SCENES.filter((asset) => asset.regionId === mediaRegionId);
}

export async function readEpochWorldSceneByFileName(fileName: string, packageRoot = defaultPackageRoot) {
  const asset = epochWorldSceneByFileName(fileName);
  if (!asset) return undefined;
  const content = await readFile(worldSceneFilePath(asset, packageRoot));
  return { asset, content };
}

export async function epochWorldSceneManifestEntries(packageRoot = defaultPackageRoot): Promise<EpochWorldSceneManifestEntry[]> {
  return Promise.all(EPOCH_WORLD_SCENES.map(async (asset) => {
    const content = await readFile(worldSceneFilePath(asset, packageRoot));
    return {
      sceneKey: asset.sceneKey,
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

export function epochWorldSceneMedia(asset: EpochWorldSceneRecord): EpochWorldSceneMedia {
  return {
    sceneKey: asset.sceneKey,
    regionId: asset.regionId,
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
