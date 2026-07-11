import type {
  Confidence,
  Entity,
  GalleryItem,
  Habitat,
  ImageFilter,
  Layer,
  LayerMode,
  Region,
  Route,
  SelectedItem,
  Threat,
  ViewState,
  VisibleWorld,
  WorldIndexes,
  WorldMapData,
} from "./types";

export const overlayModes = [
  ["ecology", "生态"],
  ["faction", "势力"],
  ["conflict", "冲突"],
] as const;

export const layerModes = [
  ["expanded", "展开"],
  ["stacked", "叠层"],
  ["single", "单层"],
] as const;

export const threatFilters = ["all", "S", "A", "B", "C", "D", "E", "未知"] as const;
export const rankFilters = ["all", "世界级", "首领", "头目", "精英", "普通", "未知"] as const;
export const confidenceFilters = ["all", "high", "medium", "low"] as const;
export const imageFilters = [
  ["all", "全部"],
  ["ready", "可生图"],
  ["hasImage", "有图"],
  ["missing", "无图"],
] as const satisfies readonly (readonly [ImageFilter, string])[];

export const confidenceLabels = {
  high: "高",
  medium: "中",
  low: "低",
} as const satisfies Record<Confidence, string>;

export const layerPalette = {
  sky_orbit: "#9fc9ff",
  surface_city: "#66d6d1",
  surface_ecology: "#5fc779",
  underground_mine: "#d29a5f",
  deep_sea: "#4f7fca",
  alien_dimension: "#b690ff",
  archive_frontier: "#8b95a7",
} as const;

export const threatPalette = {
  S: "#ff6b6b",
  A: "#ff9f43",
  B: "#ffd166",
  C: "#7bd88f",
  D: "#66d6d1",
  E: "#9fc9ff",
  "未知": "#8b95a7",
} as const satisfies Record<Threat, string>;

export function valueLine(value: unknown): string {
  if (Array.isArray(value)) return value.filter(Boolean).join(" / ");
  if (typeof value === "boolean") return value ? "是" : "否";
  return value ? String(value) : "";
}

export function limitText(value: unknown, length = 420): string {
  const text = String(value || "").trim();
  if (text.length <= length) return text;
  return `${text.slice(0, length)}...`;
}

export function normalizeText(value: unknown): string {
  return String(value || "").toLowerCase().trim();
}

export function emptyWorldData(): WorldMapData {
  return {
    schemaVersion: 1,
    generatedAt: "",
    sourceStats: {
      creatureUnits: 0,
      legacyCreatures: 0,
      worldSystems: 0,
      races: 0,
      places: 0,
      factions: 0,
      regions: 0,
      habitats: 0,
      entities: 0,
      routes: 0,
      assets: 0,
    },
    layers: [],
    regions: [],
    habitats: [],
    entities: [],
    routes: [],
    assetManifest: [],
  };
}

export function buildWorldIndexes(data: WorldMapData): WorldIndexes {
  const layers = data?.layers || [];
  const regions = data?.regions || [];
  const habitats = data?.habitats || [];
  const entities = data?.entities || [];
  const routes = data?.routes || [];
  const layerById = new Map(layers.map((layer) => [layer.id, layer]));
  const regionById = new Map(regions.map((region) => [region.id, region]));
  const habitatById = new Map(habitats.map((habitat) => [habitat.id, habitat]));
  const entityById = new Map(entities.map((entity) => [entity.id, entity]));
  const routeById = new Map(routes.map((route) => [route.id, route]));
  const entitiesByLayer = new Map<string, Entity[]>(layers.map((layer) => [layer.id, []]));
  const entitiesByRegion = new Map<string, Entity[]>(regions.map((region) => [region.id, []]));
  const entitiesByHabitat = new Map<string, Entity[]>(habitats.map((habitat) => [habitat.id, []]));
  const placeByRegion = new Map<string, Entity>();

  entities.forEach((entity) => {
    if (!entitiesByLayer.has(entity.layer)) entitiesByLayer.set(entity.layer, []);
    entitiesByLayer.get(entity.layer)?.push(entity);
    if (!entitiesByRegion.has(entity.region)) entitiesByRegion.set(entity.region, []);
    entitiesByRegion.get(entity.region)?.push(entity);
    const habitatId = `habitat:${entity.habitat}`;
    if (!entitiesByHabitat.has(habitatId)) entitiesByHabitat.set(habitatId, []);
    entitiesByHabitat.get(habitatId)?.push(entity);
    if (entity.kind === "place") placeByRegion.set(entity.region, entity);
  });

  return {
    layerById,
    regionById,
    habitatById,
    entityById,
    routeById,
    entitiesByLayer,
    entitiesByRegion,
    entitiesByHabitat,
    placeByRegion,
  };
}

export function hasImage(entity: Entity | null | undefined): boolean {
  return Boolean(entity?.panelImage || entity?.nodeImage || entity?.cardImage || (entity?.gallery || []).length);
}

export function entityMatchesQuery(entity: Entity, query: string): boolean {
  const q = normalizeText(query);
  if (!q) return true;
  const details = entity.details || {};
  const haystack = normalizeText([
    entity.label,
    entity.habitat,
    entity.sourcePath,
    entity.searchText,
    details.summary,
    details.type,
    details.base,
    details.threat,
    details.rank_role,
    details.alignment,
    details.visual_tendency,
    details.visual_style,
    details.weakness,
    details.status,
  ].flat().join(" "));
  return haystack.includes(q);
}

export function entityMatchesFilters(entity: Entity, state: ViewState): boolean {
  const details = entity.details || {};
  const hasQuery = Boolean(normalizeText(state.query));
  if (!hasQuery && state.overlayMode && !(entity.overlayRoles || []).includes(state.overlayMode)) return false;
  if (state.layerMode === "single" && state.activeLayer !== "all" && entity.layer !== state.activeLayer) return false;
  if (state.hiddenLayers?.has(entity.layer)) return false;
  if (state.threat !== "all" && valueLine(details.threat) !== state.threat) return false;
  if (state.rank !== "all" && (valueLine(details.rank_role) || "未知") !== state.rank) return false;
  if (state.confidence !== "all" && entity.confidence !== state.confidence) return false;
  if (state.image === "ready" && details.image_ready !== true) return false;
  if (state.image === "hasImage" && !hasImage(entity)) return false;
  if (state.image === "missing" && hasImage(entity)) return false;
  if (!entityMatchesQuery(entity, state.query)) return false;
  return true;
}

export function visibleWorld(data: WorldMapData, indexes: WorldIndexes, state: ViewState): VisibleWorld {
  const visibleEntities = (data?.entities || []).filter((entity) => entityMatchesFilters(entity, state));
  const visibleEntityIds = new Set(visibleEntities.map((entity) => entity.id));
  const visibleRegions = (data?.regions || []).filter((region) => {
    if (state.layerMode === "single" && state.activeLayer !== "all" && region.layer !== state.activeLayer) return false;
    if (state.hiddenLayers?.has(region.layer)) return false;
    return (indexes.entitiesByRegion.get(region.id) || []).some((entity) => visibleEntityIds.has(entity.id)) || region.sourcePath;
  });
  const visibleRegionIds = new Set(visibleRegions.map((region) => region.id));
  const visibleRoutes = (data?.routes || []).filter((route) => {
    if (state.overlayMode !== "conflict") return false;
    if (!route.points?.length) return true;
    return route.points.some((id) => visibleRegionIds.has(id));
  });
  const visibleLayers = (data?.layers || []).filter((layer) => {
    if (state.layerMode === "single" && state.activeLayer !== "all" && layer.id !== state.activeLayer) return false;
    return !state.hiddenLayers?.has(layer.id);
  });
  return { visibleEntities, visibleRegions, visibleRoutes, visibleLayers, visibleEntityIds, visibleRegionIds };
}

export function layerSummaries(data: WorldMapData, indexes: WorldIndexes, visible?: VisibleWorld): (Layer & { totalCount: number; visibleCount: number })[] {
  const visibleIds = visible ? new Set(visible.visibleEntities.map((entity) => entity.id)) : null;
  return (data?.layers || []).map((layer) => {
    const all = indexes.entitiesByLayer.get(layer.id) || [];
    const visibleCount = visibleIds ? all.filter((entity) => visibleIds.has(entity.id)).length : all.length;
    return { ...layer, totalCount: all.length, visibleCount };
  });
}

export function nearbyEntities(entity: Entity | null | undefined, indexes: WorldIndexes, limit = 10): Entity[] {
  if (!entity) return [];
  return (indexes.entitiesByRegion.get(entity.region) || [])
    .filter((item) => item.id !== entity.id)
    .sort((a, b) => {
      const kindScore = (item: Entity) => (item.kind === "place" ? 3 : item.kind === "faction" ? 2 : 1);
      return kindScore(b) - kindScore(a) || String(a.label).localeCompare(String(b.label), "zh-CN");
    })
    .slice(0, limit);
}

export function galleryForEntity(entity: Entity): GalleryItem[] {
  const gallery: GalleryItem[] = Array.isArray(entity?.gallery) ? [...entity.gallery] : [];
  const directImages: GalleryItem[] = [
    { label: "节点图", image: entity?.nodeImage || "" },
    { label: "档案卡", image: entity?.cardImage || "" },
    { label: "图片", image: entity?.panelImage || "" },
  ];
  for (const { label, image } of directImages) {
    if (image && !gallery.some((item) => item.image === image)) gallery.unshift({ label, image });
  }
  return gallery.filter((item) => item.image);
}

export function routeRegions(route: Route | null | undefined, indexes: WorldIndexes): Region[] {
  return (route?.points || []).map((id) => indexes.regionById.get(id)).filter((region): region is Region => Boolean(region));
}

export function routeLabel(route: Route | null | undefined, indexes: WorldIndexes): string {
  const regions = routeRegions(route, indexes).map((region) => region.label);
  return regions.length ? regions.join(" -> ") : route?.summary || "冲突路线待补坐标";
}

export function statusText(data: WorldMapData, visible: VisibleWorld, selected: SelectedItem, hovered: Entity | null, state: ViewState): string {
  if (selected?.type === "route") return `路线：${selected.data.label}`;
  if (selected?.type === "entity") return `聚焦：${selected.data.label}`;
  if (hovered) return `预览：${hovered.label}`;
  const modeLabel = overlayModes.find(([key]) => key === state.overlayMode)?.[1] || "生态";
  return `${modeLabel}视图 · ${visible.visibleEntities.length}/${data?.sourceStats?.entities || 0} 个实体`;
}
