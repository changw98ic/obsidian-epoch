const epochRegionAliases: Readonly<Record<string, string>> = {
  灰港: "region_gray_harbor",
  灰烬前哨: "region_ash_outpost",
  盐镜海岸: "region_salt_mirror_coast",
  玻璃档案馆: "region_glass_archive",
  月井空壳: "region_moonwell_hollow",
  黑港: "region_blackharbor",
  腐林: "region_forest",
  盐门: "region_salt_gate",
  灰烬荒原: "region_ash",
  城市管道: "region_city_pipes",
  废弃矿区: "region_abandoned_mine",
  废弃数据塔: "region_data_tower",
  轨道城: "region_orbit_city",
  海沟: "region_trench",
  集体梦池: "region_collective_dream_pool",
  空间裂缝: "region_space_rift",
  非欧洞窟: "region_non_euclidean_cave",
  星舰墓场: "region_starship_graveyard",
  废弃地铁: "region_abandoned_subway",
  全息剧场: "region_holographic_theater",
  量子实验室: "region_quantum_laboratory",
  反光城市: "region_reflective_city",
  数据巷: "region_data_alley",
  棱镜水域: "region_prism_waters",
  概率温室: "region_probability_greenhouse",
  预言服务器: "region_prophecy_server",
  轨道教堂: "region_orbital_cathedral",
};

export function resolveEpochCanonicalRegionId(regionId: string): string {
  const trimmed = regionId.trim();
  const label = trimmed.startsWith("region:") ? trimmed.slice("region:".length).trim() : trimmed;
  return epochRegionAliases[label] || trimmed;
}

export function resolveEpochMediaRegionId(regionId: string): string {
  return resolveEpochCanonicalRegionId(regionId);
}
