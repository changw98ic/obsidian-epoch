import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveEpochMediaRegionId } from "./regionAliases.ts";

export const EPOCH_AMBIENCE_SCENE_WIDTH = 1280;
export const EPOCH_AMBIENCE_SCENE_HEIGHT = 720;
export const EPOCH_AMBIENCE_SCENE_CONTENT_TYPE = "image/png" as const;

const serverRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const defaultPackageRoot = join(serverRoot, "package");

export type EpochAmbienceSceneKey =
  | "gray_harbor_night_watch"
  | "ash_outpost_training_yard"
  | "salt_mirror_tide_market"
  | "glass_archive_quiet_stacks"
  | "moonwell_hollow_meditation_grove"
  | "frontier_waystation_lazy_afternoon"
  | "black_harbor_night_ledger"
  | "forest_whispering_hollow"
  | "salt_gate_customs_dawn"
  | "ash_waste_cinder_camp"
  | "city_pipes_drip_market"
  | "abandoned_mine_echo_shaft"
  | "data_tower_cache_rain"
  | "orbit_city_docking_ring"
  | "trench_dream_current"
  | "collective_dream_pool_lanterns"
  | "space_rift_edge_lights"
  | "non_euclidean_cave_gravity_fold"
  | "starship_graveyard_drift_lights"
  | "abandoned_subway_signal_fog"
  | "holographic_theater_spectrum_stage"
  | "quantum_laboratory_probability_glass"
  | "reflective_city_mirror_boulevard"
  | "data_alley_cache_signs"
  | "prism_waters_spectrum_tide"
  | "probability_greenhouse_branch_lab"
  | "prophecy_server_cold_oracle"
  | "orbital_cathedral_bell_halo";

export interface EpochAmbienceSceneRecord {
  readonly sceneKey: EpochAmbienceSceneKey;
  readonly title: string;
  readonly subtitle: string;
  readonly fileName: string;
  readonly path: string;
  readonly url: string;
  readonly contentType: typeof EPOCH_AMBIENCE_SCENE_CONTENT_TYPE;
  readonly width: number;
  readonly height: number;
  readonly palette: readonly string[];
  readonly accentColor: string;
  readonly publicAlt: string;
  readonly regionIds: readonly string[];
  readonly motif:
    | "harbor"
    | "training"
    | "mirror-market"
    | "archive"
    | "meditation"
    | "waystation"
    | "blackharbor"
    | "forest"
    | "saltgate"
    | "ashwaste"
    | "citypipes"
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

export interface EpochAmbienceSceneManifestEntry {
  readonly sceneKey: EpochAmbienceSceneKey;
  readonly title: string;
  readonly subtitle: string;
  readonly path: string;
  readonly url: string;
  readonly contentType: typeof EPOCH_AMBIENCE_SCENE_CONTENT_TYPE;
  readonly width: number;
  readonly height: number;
  readonly sha256: string;
}

export interface EpochAmbienceSceneMedia {
  readonly sceneKey: EpochAmbienceSceneKey;
  readonly title: string;
  readonly subtitle: string;
  readonly palette: readonly string[];
  readonly accentColor: string;
  readonly publicAlt: string;
  readonly assetPath: string;
  readonly imageUrl: string;
  readonly contentType: typeof EPOCH_AMBIENCE_SCENE_CONTENT_TYPE;
  readonly width: number;
  readonly height: number;
}

export const EPOCH_AMBIENCE_SCENES = [
  {
    sceneKey: "gray_harbor_night_watch",
    title: "灰港夜巡",
    subtitle: "盐雾、灯塔和午夜值守",
    fileName: "gray-harbor-night-watch-ambience.png",
    path: "obsidian-epoch/assets/ambience/gray-harbor-night-watch-ambience.png",
    url: "/api/epoch/assets/ambience/gray-harbor-night-watch-ambience.png",
    contentType: EPOCH_AMBIENCE_SCENE_CONTENT_TYPE,
    width: EPOCH_AMBIENCE_SCENE_WIDTH,
    height: EPOCH_AMBIENCE_SCENE_HEIGHT,
    palette: ["#06121a", "#155e75", "#67e8f9", "#d6b076"],
    accentColor: "#67e8f9",
    publicAlt: "灰港夜巡的盐雾码头、灯塔光束和远处巡逻剪影。",
    regionIds: ["region_gray_harbor"],
    motif: "harbor",
  },
  {
    sceneKey: "ash_outpost_training_yard",
    title: "灰烬前哨训练场",
    subtitle: "炉火、靶桩和夜间体能操练",
    fileName: "ash-outpost-training-yard-ambience.png",
    path: "obsidian-epoch/assets/ambience/ash-outpost-training-yard-ambience.png",
    url: "/api/epoch/assets/ambience/ash-outpost-training-yard-ambience.png",
    contentType: EPOCH_AMBIENCE_SCENE_CONTENT_TYPE,
    width: EPOCH_AMBIENCE_SCENE_WIDTH,
    height: EPOCH_AMBIENCE_SCENE_HEIGHT,
    palette: ["#171111", "#7f1d1d", "#f97316", "#94a3b8"],
    accentColor: "#f97316",
    publicAlt: "灰烬前哨训练场的旧炉火、木靶和边境操练灯。",
    regionIds: ["region_ash_outpost"],
    motif: "training",
  },
  {
    sceneKey: "salt_mirror_tide_market",
    title: "盐镜潮市",
    subtitle: "镜面潮汐、临时摊位和护送商队",
    fileName: "salt-mirror-tide-market-ambience.png",
    path: "obsidian-epoch/assets/ambience/salt-mirror-tide-market-ambience.png",
    url: "/api/epoch/assets/ambience/salt-mirror-tide-market-ambience.png",
    contentType: EPOCH_AMBIENCE_SCENE_CONTENT_TYPE,
    width: EPOCH_AMBIENCE_SCENE_WIDTH,
    height: EPOCH_AMBIENCE_SCENE_HEIGHT,
    palette: ["#0f1b2c", "#0369a1", "#bae6fd", "#facc15"],
    accentColor: "#bae6fd",
    publicAlt: "盐镜海岸潮市的反光水面、临时市棚和商队灯线。",
    regionIds: ["region_salt_mirror_coast"],
    motif: "mirror-market",
  },
  {
    sceneKey: "glass_archive_quiet_stacks",
    title: "玻璃档案静库",
    subtitle: "透明柜列、检索光和低声誓约",
    fileName: "glass-archive-quiet-stacks-ambience.png",
    path: "obsidian-epoch/assets/ambience/glass-archive-quiet-stacks-ambience.png",
    url: "/api/epoch/assets/ambience/glass-archive-quiet-stacks-ambience.png",
    contentType: EPOCH_AMBIENCE_SCENE_CONTENT_TYPE,
    width: EPOCH_AMBIENCE_SCENE_WIDTH,
    height: EPOCH_AMBIENCE_SCENE_HEIGHT,
    palette: ["#0f1720", "#0f766e", "#a7f3d0", "#f8fafc"],
    accentColor: "#a7f3d0",
    publicAlt: "玻璃档案静库的透明书架、索引光带和低声誓约座位。",
    regionIds: ["region_glass_archive"],
    motif: "archive",
  },
  {
    sceneKey: "moonwell_hollow_meditation_grove",
    title: "月井空壳冥想林",
    subtitle: "银井、低语树影和托管修炼",
    fileName: "moonwell-hollow-meditation-grove-ambience.png",
    path: "obsidian-epoch/assets/ambience/moonwell-hollow-meditation-grove-ambience.png",
    url: "/api/epoch/assets/ambience/moonwell-hollow-meditation-grove-ambience.png",
    contentType: EPOCH_AMBIENCE_SCENE_CONTENT_TYPE,
    width: EPOCH_AMBIENCE_SCENE_WIDTH,
    height: EPOCH_AMBIENCE_SCENE_HEIGHT,
    palette: ["#0b1020", "#581c87", "#c4b5fd", "#22c55e"],
    accentColor: "#c4b5fd",
    publicAlt: "月井空壳冥想林的银色废井、树影和托管修炼席位。",
    regionIds: ["region_moonwell_hollow"],
    motif: "meditation",
  },
  {
    sceneKey: "frontier_waystation_lazy_afternoon",
    title: "边境旅站午后",
    subtitle: "摸鱼、闲聊和出门前的补给",
    fileName: "frontier-waystation-lazy-afternoon-ambience.png",
    path: "obsidian-epoch/assets/ambience/frontier-waystation-lazy-afternoon-ambience.png",
    url: "/api/epoch/assets/ambience/frontier-waystation-lazy-afternoon-ambience.png",
    contentType: EPOCH_AMBIENCE_SCENE_CONTENT_TYPE,
    width: EPOCH_AMBIENCE_SCENE_WIDTH,
    height: EPOCH_AMBIENCE_SCENE_HEIGHT,
    palette: ["#11140f", "#365314", "#bef264", "#d6b076"],
    accentColor: "#bef264",
    publicAlt: "边境旅站午后的补给桌、闲聊角落和准备外出的背包。",
    regionIds: [
      "region_gray_harbor",
      "region_ash_outpost",
      "region_salt_mirror_coast",
      "region_glass_archive",
      "region_moonwell_hollow",
    ],
    motif: "waystation",
  },
  {
    sceneKey: "black_harbor_night_ledger",
    title: "黑港夜账",
    subtitle: "低蓝信号、封蜡账册和等待放行的夜航货队",
    fileName: "black-harbor-night-ledger-ambience.png",
    path: "obsidian-epoch/assets/ambience/black-harbor-night-ledger-ambience.png",
    url: "/api/epoch/assets/ambience/black-harbor-night-ledger-ambience.png",
    contentType: EPOCH_AMBIENCE_SCENE_CONTENT_TYPE,
    width: EPOCH_AMBIENCE_SCENE_WIDTH,
    height: EPOCH_AMBIENCE_SCENE_HEIGHT,
    palette: ["#04070b", "#172554", "#38bdf8", "#d97706"],
    accentColor: "#38bdf8",
    publicAlt: "黑港夜账的低蓝信号灯、封蜡账册、湿石税棚和夜航货队。",
    regionIds: ["region_blackharbor"],
    motif: "blackharbor",
  },
  {
    sceneKey: "forest_whispering_hollow",
    title: "腐林回信树洞",
    subtitle: "苔光树洞、猎人誓牌和会回信的低声林地",
    fileName: "forest-whispering-hollow-ambience.png",
    path: "obsidian-epoch/assets/ambience/forest-whispering-hollow-ambience.png",
    url: "/api/epoch/assets/ambience/forest-whispering-hollow-ambience.png",
    contentType: EPOCH_AMBIENCE_SCENE_CONTENT_TYPE,
    width: EPOCH_AMBIENCE_SCENE_WIDTH,
    height: EPOCH_AMBIENCE_SCENE_HEIGHT,
    palette: ["#03100a", "#14532d", "#86efac", "#facc15"],
    accentColor: "#86efac",
    publicAlt: "腐林回信树洞的苔光洞口、湿叶、猎人誓牌和低声回音。",
    regionIds: ["region_forest"],
    motif: "forest",
  },
  {
    sceneKey: "salt_gate_customs_dawn",
    title: "盐门晨关",
    subtitle: "晨盐雾、关税账棚和边境钟桥开闸",
    fileName: "salt-gate-customs-dawn-ambience.png",
    path: "obsidian-epoch/assets/ambience/salt-gate-customs-dawn-ambience.png",
    url: "/api/epoch/assets/ambience/salt-gate-customs-dawn-ambience.png",
    contentType: EPOCH_AMBIENCE_SCENE_CONTENT_TYPE,
    width: EPOCH_AMBIENCE_SCENE_WIDTH,
    height: EPOCH_AMBIENCE_SCENE_HEIGHT,
    palette: ["#06131f", "#155e75", "#e0f2fe", "#fbbf24"],
    accentColor: "#f59e0b",
    publicAlt: "盐门晨关的晨盐雾、关税账棚、钟桥旗线和等待通行的车队灯。",
    regionIds: ["region_salt_gate"],
    motif: "saltgate",
  },
  {
    sceneKey: "ash_waste_cinder_camp",
    title: "灰烬荒原渣井营",
    subtitle: "冷灰夜、黑铁吊架和托管者外出前的低火营地",
    fileName: "ash-waste-cinder-camp-ambience.png",
    path: "obsidian-epoch/assets/ambience/ash-waste-cinder-camp-ambience.png",
    url: "/api/epoch/assets/ambience/ash-waste-cinder-camp-ambience.png",
    contentType: EPOCH_AMBIENCE_SCENE_CONTENT_TYPE,
    width: EPOCH_AMBIENCE_SCENE_WIDTH,
    height: EPOCH_AMBIENCE_SCENE_HEIGHT,
    palette: ["#050506", "#7f1d1d", "#f97316", "#94a3b8"],
    accentColor: "#f97316",
    publicAlt: "灰烬荒原渣井营的冷灰夜色、黑铁吊架、低火补给棚和荒道车辙。",
    regionIds: ["region_ash"],
    motif: "ashwaste",
  },
  {
    sceneKey: "city_pipes_drip_market",
    title: "城市管道滴水市集",
    subtitle: "阀门摊位、冷凝水声和检修桥下的临时委托牌",
    fileName: "city-pipes-drip-market-ambience.png",
    path: "obsidian-epoch/assets/ambience/city-pipes-drip-market-ambience.png",
    url: "/api/epoch/assets/ambience/city-pipes-drip-market-ambience.png",
    contentType: EPOCH_AMBIENCE_SCENE_CONTENT_TYPE,
    width: EPOCH_AMBIENCE_SCENE_WIDTH,
    height: EPOCH_AMBIENCE_SCENE_HEIGHT,
    palette: ["#020605", "#14532d", "#5eead4", "#facc15"],
    accentColor: "#5eead4",
    publicAlt: "城市管道滴水市集的阀门摊位、冷凝水渠、钠灯和检修桥剪影。",
    regionIds: ["region_city_pipes"],
    motif: "citypipes",
  },
  {
    sceneKey: "abandoned_mine_echo_shaft",
    title: "废弃矿区回声井",
    subtitle: "旧升降架、蓝尘矿灯和封存警戒线",
    fileName: "abandoned-mine-echo-shaft-ambience.png",
    path: "obsidian-epoch/assets/ambience/abandoned-mine-echo-shaft-ambience.png",
    url: "/api/epoch/assets/ambience/abandoned-mine-echo-shaft-ambience.png",
    contentType: EPOCH_AMBIENCE_SCENE_CONTENT_TYPE,
    width: EPOCH_AMBIENCE_SCENE_WIDTH,
    height: EPOCH_AMBIENCE_SCENE_HEIGHT,
    palette: ["#080605", "#57534e", "#f59e0b", "#60a5fa"],
    accentColor: "#f59e0b",
    publicAlt: "废弃矿区回声井的旧升降架、蓝尘矿灯、塌方轨道和封存警戒线。",
    regionIds: ["region_abandoned_mine"],
    motif: "mine",
  },
  {
    sceneKey: "data_tower_cache_rain",
    title: "废弃数据塔缓存雨",
    subtitle: "断裂索引层、缓存雨和脑晶巡检灯列",
    fileName: "data-tower-cache-rain-ambience.png",
    path: "obsidian-epoch/assets/ambience/data-tower-cache-rain-ambience.png",
    url: "/api/epoch/assets/ambience/data-tower-cache-rain-ambience.png",
    contentType: EPOCH_AMBIENCE_SCENE_CONTENT_TYPE,
    width: EPOCH_AMBIENCE_SCENE_WIDTH,
    height: EPOCH_AMBIENCE_SCENE_HEIGHT,
    palette: ["#030712", "#1e1b4b", "#67e8f9", "#a78bfa"],
    accentColor: "#67e8f9",
    publicAlt: "废弃数据塔缓存雨中的断裂索引层、脑晶灯列、维护桥和闪烁数据雨。",
    regionIds: ["region_data_tower"],
    motif: "data-tower",
  },
  {
    sceneKey: "orbit_city_docking_ring",
    title: "轨道城泊港环",
    subtitle: "星历信标、环站泊位和低轨灯市",
    fileName: "orbit-city-docking-ring-ambience.png",
    path: "obsidian-epoch/assets/ambience/orbit-city-docking-ring-ambience.png",
    url: "/api/epoch/assets/ambience/orbit-city-docking-ring-ambience.png",
    contentType: EPOCH_AMBIENCE_SCENE_CONTENT_TYPE,
    width: EPOCH_AMBIENCE_SCENE_WIDTH,
    height: EPOCH_AMBIENCE_SCENE_HEIGHT,
    palette: ["#020617", "#0f172a", "#93c5fd", "#facc15"],
    accentColor: "#93c5fd",
    publicAlt: "轨道城泊港环的弧形站台、星历信标、低轨航道和悬空灯市。",
    regionIds: ["region_orbit_city"],
    motif: "orbit-city",
  },
  {
    sceneKey: "trench_dream_current",
    title: "海沟古梦暗流",
    subtitle: "深海冷灯、岩架与守梦生物的低频巡游",
    fileName: "trench-dream-current-ambience.png",
    path: "obsidian-epoch/assets/ambience/trench-dream-current-ambience.png",
    url: "/api/epoch/assets/ambience/trench-dream-current-ambience.png",
    contentType: EPOCH_AMBIENCE_SCENE_CONTENT_TYPE,
    width: EPOCH_AMBIENCE_SCENE_WIDTH,
    height: EPOCH_AMBIENCE_SCENE_HEIGHT,
    palette: ["#010814", "#0f3f46", "#67e8f9", "#22c55e"],
    accentColor: "#67e8f9",
    publicAlt: "海沟古梦暗流中的深海冷灯、断裂岩架、发光浮游带和守梦生物剪影。",
    regionIds: ["region_trench"],
    motif: "trench",
  },
  {
    sceneKey: "collective_dream_pool_lanterns",
    title: "集体梦池梦灯列",
    subtitle: "共享梦面、记忆浮岛与身份倒影",
    fileName: "collective-dream-pool-lanterns-ambience.png",
    path: "obsidian-epoch/assets/ambience/collective-dream-pool-lanterns-ambience.png",
    url: "/api/epoch/assets/ambience/collective-dream-pool-lanterns-ambience.png",
    contentType: EPOCH_AMBIENCE_SCENE_CONTENT_TYPE,
    width: EPOCH_AMBIENCE_SCENE_WIDTH,
    height: EPOCH_AMBIENCE_SCENE_HEIGHT,
    palette: ["#080414", "#4c1d95", "#c084fc", "#22d3ee"],
    accentColor: "#c084fc",
    publicAlt: "集体梦池的共享梦面、记忆浮岛、梦灯列和被服务器封存的身份倒影。",
    regionIds: ["region_collective_dream_pool"],
    motif: "dream-pool",
  },
  {
    sceneKey: "space_rift_edge_lights",
    title: "空间裂缝边缘灯",
    subtitle: "紫色裂光、落尘轨迹和临时通行刻度",
    fileName: "space-rift-edge-lights-ambience.png",
    path: "obsidian-epoch/assets/ambience/space-rift-edge-lights-ambience.png",
    url: "/api/epoch/assets/ambience/space-rift-edge-lights-ambience.png",
    contentType: EPOCH_AMBIENCE_SCENE_CONTENT_TYPE,
    width: EPOCH_AMBIENCE_SCENE_WIDTH,
    height: EPOCH_AMBIENCE_SCENE_HEIGHT,
    palette: ["#07021a", "#312e81", "#c084fc", "#67e8f9"],
    accentColor: "#c084fc",
    publicAlt: "空间裂缝边缘灯下的紫色裂光、落尘轨迹、错位路标和服务器通行刻度。",
    regionIds: ["region_space_rift"],
    motif: "space-rift",
  },
  {
    sceneKey: "non_euclidean_cave_gravity_fold",
    title: "非欧洞窟重力折页",
    subtitle: "错误楼梯、黄铜测量灯和回声井",
    fileName: "non-euclidean-cave-gravity-fold-ambience.png",
    path: "obsidian-epoch/assets/ambience/non-euclidean-cave-gravity-fold-ambience.png",
    url: "/api/epoch/assets/ambience/non-euclidean-cave-gravity-fold-ambience.png",
    contentType: EPOCH_AMBIENCE_SCENE_CONTENT_TYPE,
    width: EPOCH_AMBIENCE_SCENE_WIDTH,
    height: EPOCH_AMBIENCE_SCENE_HEIGHT,
    palette: ["#06030f", "#3b0764", "#a78bfa", "#facc15"],
    accentColor: "#a78bfa",
    publicAlt: "非欧洞窟重力折页中的错误楼梯、折叠岩壁、黄铜测量灯和深处回声井。",
    regionIds: ["region_non_euclidean_cave"],
    motif: "non-euclidean",
  },
  {
    sceneKey: "starship_graveyard_drift_lights",
    title: "星舰墓场漂航灯",
    subtitle: "冷轨残骸、打捞禁线和断续信标",
    fileName: "starship-graveyard-drift-lights-ambience.png",
    path: "obsidian-epoch/assets/ambience/starship-graveyard-drift-lights-ambience.png",
    url: "/api/epoch/assets/ambience/starship-graveyard-drift-lights-ambience.png",
    contentType: EPOCH_AMBIENCE_SCENE_CONTENT_TYPE,
    width: EPOCH_AMBIENCE_SCENE_WIDTH,
    height: EPOCH_AMBIENCE_SCENE_HEIGHT,
    palette: ["#020617", "#172554", "#93c5fd", "#facc15"],
    accentColor: "#93c5fd",
    publicAlt: "星舰墓场漂航灯下的断裂船壳、冷轨残骸、打捞禁线和服务器信标。",
    regionIds: ["region_starship_graveyard"],
    motif: "starship-graveyard",
  },
  {
    sceneKey: "abandoned_subway_signal_fog",
    title: "废弃地铁信号雾",
    subtitle: "旧站台、积水轨道和青色信号灯",
    fileName: "abandoned-subway-signal-fog-ambience.png",
    path: "obsidian-epoch/assets/ambience/abandoned-subway-signal-fog-ambience.png",
    url: "/api/epoch/assets/ambience/abandoned-subway-signal-fog-ambience.png",
    contentType: EPOCH_AMBIENCE_SCENE_CONTENT_TYPE,
    width: EPOCH_AMBIENCE_SCENE_WIDTH,
    height: EPOCH_AMBIENCE_SCENE_HEIGHT,
    palette: ["#050807", "#1f2937", "#5eead4", "#f59e0b"],
    accentColor: "#5eead4",
    publicAlt: "废弃地铁信号雾里的积水站台、旧信号灯、锈蚀闸机和远处隧道光。",
    regionIds: ["region_abandoned_subway"],
    motif: "abandoned-subway",
  },
  {
    sceneKey: "holographic_theater_spectrum_stage",
    title: "全息剧场光谱舞台",
    subtitle: "伪掌声、折光后台和循环演出的光幕",
    fileName: "holographic-theater-spectrum-stage-ambience.png",
    path: "obsidian-epoch/assets/ambience/holographic-theater-spectrum-stage-ambience.png",
    url: "/api/epoch/assets/ambience/holographic-theater-spectrum-stage-ambience.png",
    contentType: EPOCH_AMBIENCE_SCENE_CONTENT_TYPE,
    width: EPOCH_AMBIENCE_SCENE_WIDTH,
    height: EPOCH_AMBIENCE_SCENE_HEIGHT,
    palette: ["#050816", "#4c1d95", "#f472b6", "#67e8f9"],
    accentColor: "#f472b6",
    publicAlt: "全息剧场光谱舞台里的伪掌声席、折光后台、光幕和服务器封存的演出回声。",
    regionIds: ["region_holographic_theater"],
    motif: "holographic-theater",
  },
  {
    sceneKey: "quantum_laboratory_probability_glass",
    title: "量子实验室概率玻璃",
    subtitle: "纠缠舱、观测窗和坍缩桥前的警戒灯",
    fileName: "quantum-laboratory-probability-glass-ambience.png",
    path: "obsidian-epoch/assets/ambience/quantum-laboratory-probability-glass-ambience.png",
    url: "/api/epoch/assets/ambience/quantum-laboratory-probability-glass-ambience.png",
    contentType: EPOCH_AMBIENCE_SCENE_CONTENT_TYPE,
    width: EPOCH_AMBIENCE_SCENE_WIDTH,
    height: EPOCH_AMBIENCE_SCENE_HEIGHT,
    palette: ["#020617", "#164e63", "#67e8f9", "#facc15"],
    accentColor: "#67e8f9",
    publicAlt: "量子实验室概率玻璃后的纠缠舱、观测窗、坍缩桥和服务器实验封条。",
    regionIds: ["region_quantum_laboratory"],
    motif: "quantum-laboratory",
  },
  {
    sceneKey: "reflective_city_mirror_boulevard",
    title: "反光城市镜面大道",
    subtitle: "镜面塔楼、屏幕水域和霓虹巡游线",
    fileName: "reflective-city-mirror-boulevard-ambience.png",
    path: "obsidian-epoch/assets/ambience/reflective-city-mirror-boulevard-ambience.png",
    url: "/api/epoch/assets/ambience/reflective-city-mirror-boulevard-ambience.png",
    contentType: EPOCH_AMBIENCE_SCENE_CONTENT_TYPE,
    width: EPOCH_AMBIENCE_SCENE_WIDTH,
    height: EPOCH_AMBIENCE_SCENE_HEIGHT,
    palette: ["#061018", "#0f766e", "#a5f3fc", "#f472b6"],
    accentColor: "#a5f3fc",
    publicAlt: "反光城市镜面大道的玻璃街廓、屏幕水域、霓虹倒影和公开巡游灯线。",
    regionIds: ["region_reflective_city"],
    motif: "reflective-city",
  },
  {
    sceneKey: "data_alley_cache_signs",
    title: "数据巷缓存招牌",
    subtitle: "窄巷走线、缓存招牌和包市场灯箱",
    fileName: "data-alley-cache-signs-ambience.png",
    path: "obsidian-epoch/assets/ambience/data-alley-cache-signs-ambience.png",
    url: "/api/epoch/assets/ambience/data-alley-cache-signs-ambience.png",
    contentType: EPOCH_AMBIENCE_SCENE_CONTENT_TYPE,
    width: EPOCH_AMBIENCE_SCENE_WIDTH,
    height: EPOCH_AMBIENCE_SCENE_HEIGHT,
    palette: ["#030712", "#1e1b4b", "#67e8f9", "#f59e0b"],
    accentColor: "#67e8f9",
    publicAlt: "数据巷缓存招牌下的窄巷走线、包市场灯箱、临时摊位和服务器通行点。",
    regionIds: ["region_data_alley"],
    motif: "data-alley",
  },
  {
    sceneKey: "prism_waters_spectrum_tide",
    title: "棱镜水域光谱潮",
    subtitle: "折光潮面、镜帆码头和彩带航标",
    fileName: "prism-waters-spectrum-tide-ambience.png",
    path: "obsidian-epoch/assets/ambience/prism-waters-spectrum-tide-ambience.png",
    url: "/api/epoch/assets/ambience/prism-waters-spectrum-tide-ambience.png",
    contentType: EPOCH_AMBIENCE_SCENE_CONTENT_TYPE,
    width: EPOCH_AMBIENCE_SCENE_WIDTH,
    height: EPOCH_AMBIENCE_SCENE_HEIGHT,
    palette: ["#03111f", "#155e75", "#a7f3d0", "#f0abfc"],
    accentColor: "#a7f3d0",
    publicAlt: "棱镜水域光谱潮中的折光水面、镜帆码头、彩带航标和服务器航线标记。",
    regionIds: ["region_prism_waters"],
    motif: "prism-waters",
  },
  {
    sceneKey: "probability_greenhouse_branch_lab",
    title: "概率温室分支花棚",
    subtitle: "玻璃步道、分支花床和可能性种子灯",
    fileName: "probability-greenhouse-branch-lab-ambience.png",
    path: "obsidian-epoch/assets/ambience/probability-greenhouse-branch-lab-ambience.png",
    url: "/api/epoch/assets/ambience/probability-greenhouse-branch-lab-ambience.png",
    contentType: EPOCH_AMBIENCE_SCENE_CONTENT_TYPE,
    width: EPOCH_AMBIENCE_SCENE_WIDTH,
    height: EPOCH_AMBIENCE_SCENE_HEIGHT,
    palette: ["#04130a", "#166534", "#bef264", "#facc15"],
    accentColor: "#bef264",
    publicAlt: "概率温室分支花棚里的玻璃步道、可能性种子灯、分支花床和服务器收获窗口。",
    regionIds: ["region_probability_greenhouse"],
    motif: "probability-greenhouse",
  },
  {
    sceneKey: "prophecy_server_cold_oracle",
    title: "预言服务器冷神谕厅",
    subtitle: "低温机柜、判定环和可审计神谕屏",
    fileName: "prophecy-server-cold-oracle-ambience.png",
    path: "obsidian-epoch/assets/ambience/prophecy-server-cold-oracle-ambience.png",
    url: "/api/epoch/assets/ambience/prophecy-server-cold-oracle-ambience.png",
    contentType: EPOCH_AMBIENCE_SCENE_CONTENT_TYPE,
    width: EPOCH_AMBIENCE_SCENE_WIDTH,
    height: EPOCH_AMBIENCE_SCENE_HEIGHT,
    palette: ["#020617", "#1e1b4b", "#93c5fd", "#facc15"],
    accentColor: "#93c5fd",
    publicAlt: "预言服务器冷神谕厅里的低温机柜、判定环、蓝白风扇光和可审计神谕屏。",
    regionIds: ["region_prophecy_server"],
    motif: "prophecy-server",
  },
  {
    sceneKey: "orbital_cathedral_bell_halo",
    title: "轨道教堂钟环",
    subtitle: "低轨钟环、漂浮祭台和圣歌光带",
    fileName: "orbital-cathedral-bell-halo-ambience.png",
    path: "obsidian-epoch/assets/ambience/orbital-cathedral-bell-halo-ambience.png",
    url: "/api/epoch/assets/ambience/orbital-cathedral-bell-halo-ambience.png",
    contentType: EPOCH_AMBIENCE_SCENE_CONTENT_TYPE,
    width: EPOCH_AMBIENCE_SCENE_WIDTH,
    height: EPOCH_AMBIENCE_SCENE_HEIGHT,
    palette: ["#07030f", "#312e81", "#f8fafc", "#f59e0b"],
    accentColor: "#f8fafc",
    publicAlt: "轨道教堂钟环中的低轨钟列、漂浮祭台、圣歌光带和公共航道标记。",
    regionIds: ["region_orbital_cathedral"],
    motif: "orbital-cathedral",
  },
] as const satisfies readonly EpochAmbienceSceneRecord[];

function ambienceSceneFilePath(asset: EpochAmbienceSceneRecord, packageRoot = defaultPackageRoot) {
  return join(packageRoot, asset.path);
}

export function epochAmbienceSceneByFileName(fileName: string): EpochAmbienceSceneRecord | undefined {
  return EPOCH_AMBIENCE_SCENES.find((asset) => asset.fileName === fileName);
}

export function epochAmbienceScenesForRegion(regionId: string): readonly EpochAmbienceSceneRecord[] {
  const mediaRegionId = resolveEpochMediaRegionId(regionId);
  return EPOCH_AMBIENCE_SCENES.filter((asset) => {
    const regionIds: readonly string[] = asset.regionIds;
    return regionIds.includes(mediaRegionId);
  });
}

export async function readEpochAmbienceSceneByFileName(fileName: string, packageRoot = defaultPackageRoot) {
  const asset = epochAmbienceSceneByFileName(fileName);
  if (!asset) return undefined;
  const content = await readFile(ambienceSceneFilePath(asset, packageRoot));
  return { asset, content };
}

export async function epochAmbienceSceneManifestEntries(packageRoot = defaultPackageRoot): Promise<EpochAmbienceSceneManifestEntry[]> {
  return Promise.all(EPOCH_AMBIENCE_SCENES.map(async (asset) => {
    const content = await readFile(ambienceSceneFilePath(asset, packageRoot));
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

export function epochAmbienceSceneMedia(asset: EpochAmbienceSceneRecord): EpochAmbienceSceneMedia {
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
