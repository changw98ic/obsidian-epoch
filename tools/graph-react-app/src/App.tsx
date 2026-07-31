import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import {
  buildWorldIndexes,
  confidenceFilters,
  confidenceLabels,
  emptyWorldData,
  galleryForEntity,
  imageFilters,
  layerModes,
  layerSummaries,
  limitText,
  nearbyEntities,
  overlayModes,
  rankFilters,
  routeLabel,
  routeRegions,
  statusText,
  threatFilters,
  valueLine,
  visibleWorld,
} from "./worldMapUtils";
import type {
  Confidence,
  Entity,
  ImageFilter,
  LayerMode,
  Route,
  SelectedItem,
  Threat,
  ViewState,
  VisibleWorld,
  WorldIndexes,
  WorldMapData,
} from "./types";
import { parseWorldMapData } from "./validation";

const AgentExplorer = lazy(() => import("./agent/AgentExplorer"));
const WorldMapScene = lazy(() => import("./WorldMapScene"));

type ZoneStyle = CSSProperties & { "--zone-color": string };
type LayerSummary = WorldMapData["layers"][number] & { totalCount: number; visibleCount: number };
type ImageOverlay = { src: string; label: string };

function AtlasBrief({ data, visible, layers }: { data: WorldMapData; visible: VisibleWorld; layers: LayerSummary[] }) {
  return (
    <section className="atlas-brief">
      <div className="atlas-head">
        <b>世界读数</b>
        <span>{visible.visibleEntities.length} / {data.sourceStats.entities} 实体可见</span>
      </div>
      <div className="atlas-stats">
        <div><strong>{data.sourceStats.creatureUnits}</strong><span>生物单位</span></div>
        <div><strong>{data.sourceStats.regions}</strong><span>区域</span></div>
        <div><strong>{data.sourceStats.routes}</strong><span>冲突路线</span></div>
      </div>
      <div className="atlas-layer-strip">
        {layers.map((layer) => (
          <span key={layer.id} style={{ "--zone-color": layer.color } as ZoneStyle}>
            {layer.label}<em>{layer.visibleCount}</em>
          </span>
        ))}
      </div>
    </section>
  );
}

function HoverPeek({ entity, indexes }: { entity: Entity; indexes: WorldIndexes }) {
  const layer = indexes.layerById.get(entity.layer);
  return (
    <section className="hover-peek">
      <b>{entity.label}</b>
      <span>{entity.kind} · {layer?.label || entity.layer} · {entity.habitat || "未定"}</span>
    </section>
  );
}

function ConflictRibbon({ routes, selected, onSelectRoute }: { routes: Route[]; selected: SelectedItem; onSelectRoute: (route: Route) => void }) {
  return (
    <section className="story-ribbon">
      <b>冲突路线</b>
      <div className="story-path">
        {routes.slice(0, 9).map((route) => (
          <button
            className={`story-node ${selected?.type === "route" && selected.data.id === route.id ? "active" : ""}`}
            key={route.id}
            onClick={() => onSelectRoute(route)}
          >
            {route.label}
          </button>
        ))}
      </div>
    </section>
  );
}

function DetailShell({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return (
    <aside className="panel">
      <button className="panel-close" onClick={onClose}>关闭</button>
      {children}
    </aside>
  );
}

function RailResults({ entities, onSelectEntity }: { entities: Entity[]; onSelectEntity: (entity: Entity) => void }) {
  if (!entities.length) {
    return (
      <div className="entity-result-list empty-results">
        <span>没有匹配的实体</span>
      </div>
    );
  }
  return (
    <div className="entity-result-list">
      {entities.slice(0, 9).map((entity) => (
        <button key={entity.id} onClick={() => onSelectEntity(entity)}>
          <b>{entity.label}</b>
          <span>{entity.kind} · {entity.habitat}</span>
        </button>
      ))}
    </div>
  );
}

function RoutePanel({ route, indexes }: { route: Route; indexes: WorldIndexes }) {
  const regions = routeRegions(route, indexes);
  return (
    <>
      <div className="panel-hero empty-hero conflict-hero">
        <div className="route-mark" />
      </div>
      <div className="panel-body">
        <h1>{route.label}</h1>
        <div className="meta">{route.kind} · {route.confidence === "high" ? "高置信度" : "低置信度"}</div>
        <p className="summary">{route.summary || "这条路线来自关系网络，坐标由相关区域自动推断。"}</p>
        <div className="section-title">路径</div>
        <div className="info-block">{routeLabel(route, indexes)}</div>
        <div className="section-title">区域节点</div>
        <div className="mini-list">
          {regions.map((region) => (
            <div key={region.id}>
              <b>{region.label}</b>
              <span>{region.layer} · {region.confidence}</span>
            </div>
          ))}
        </div>
        <div className="footer-note">来源：{route.sourcePath || "关系网络推断"}</div>
      </div>
    </>
  );
}

function EntityPanel({
  entity,
  indexes,
  onRequestEntity,
  onOpenImage,
}: {
  entity: Entity;
  indexes: WorldIndexes;
  onRequestEntity: (id: string) => void;
  onOpenImage: (src: string, label: string) => void;
}) {
  const details = entity.details || {};
  const layer = indexes.layerById.get(entity.layer);
  const nearby = nearbyEntities(entity, indexes, 10);
  const gallery = galleryForEntity(entity);
  const hero = gallery[0];
  const rows = [
    ["类型", valueLine(details.type) || entity.kind],
    ["世界层", layer?.label || entity.layer],
    ["栖息地", entity.habitat || "未定"],
    ["威胁", valueLine(details.threat) || "未知"],
    ["职能", valueLine(details.rank_role) || "未知"],
    ["倾向", valueLine(details.alignment) || "未知"],
    ["外观", valueLine(details.visual_tendency) || "未定"],
    ["风格", valueLine(details.visual_style) || "未定"],
    ["状态", valueLine(details.status) || "未定"],
    ["置信度", confidenceLabels[entity.confidence] || entity.confidence],
    ["图像就绪", valueLine(details.image_ready)],
    ["来源", entity.sourceKind],
  ];

  return (
    <>
      <div className="panel-hero">
        {hero ? (
          <button className="image-open" onClick={() => onOpenImage(hero.image, `${entity.label} · ${hero.label}`)}>
            <img src={hero.image} alt={`${entity.label} · ${hero.label}`} />
          </button>
        ) : (
          <div className="map-sigil" />
        )}
      </div>
      <div className="panel-body">
        <h1 className="node-title">
          {hero ? <img className="title-thumb" src={hero.image} alt="" /> : null}
          <span>{entity.label}</span>
        </h1>
        <div className="meta">{entity.kind} · {entity.habitat} · {entity.placementReason}</div>
        <p className="summary">{details.summary || "这个实体目前只有结构化字段，后续可扩写完整档案。"}</p>
        <div className="chips">
          {[entity.habitat, details.threat, details.rank_role, details.visual_style, entity.confidence].filter(Boolean).map((tag) => <span className="chip" key={tag}>{valueLine(tag)}</span>)}
        </div>
        <div className="section-title">结构化字段</div>
        <div className="kv">
          {rows.map(([label, value]) => (
            <div key={label}><b>{label}</b>{String(value ?? "")}</div>
          ))}
        </div>
        <div className="detail-grid">
          <InfoBlock title="关系" value={details.relation} />
          <InfoBlock title="外观" value={details.appearance} />
          <InfoBlock title="能力" value={details.ability} />
          <InfoBlock title="弱点 / 代价" value={details.weakness} />
          <InfoBlock title="行为" value={details.behavior} />
          <InfoBlock title="资源" value={details.resources} />
        </div>
        {nearby.length ? (
          <>
            <div className="section-title">同域实体</div>
            <div className="neighbor-list">
              {nearby.map((item) => (
                <button key={item.id} onClick={() => onRequestEntity(item.id)}>{item.label} · {item.kind}</button>
              ))}
            </div>
          </>
        ) : null}
        <div className="footer-note">路径：{entity.sourcePath}</div>
      </div>
    </>
  );
}

function InfoBlock({ title, value }: { title: string; value?: unknown }) {
  if (!value) return null;
  return (
    <div>
      <div className="section-title">{title}</div>
      <div className="info-block compact">{limitText(value, 560)}</div>
    </div>
  );
}

function SelectFilter({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly (string | readonly [string, string])[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="select-filter">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => {
          const item = Array.isArray(option) ? option : [option, option === "all" ? "全部" : option];
          return <option key={item[0]} value={item[0]}>{item[1]}</option>;
        })}
      </select>
    </label>
  );
}

export default function App() {
  const isWebPlayPath = window.location.pathname === "/epoch/web-play" || window.location.pathname === "/epoch/web-play/";
  const [appMode, setAppMode] = useState<"map" | "agent">(() => (
    isWebPlayPath || new URLSearchParams(window.location.search).get("agent") === "1" ? "agent" : "map"
  ));
  const [data, setData] = useState<WorldMapData | null>(null);
  const [error, setError] = useState("");
  const [overlayMode, setOverlayMode] = useState<ViewState["overlayMode"]>("ecology");
  const [layerMode, setLayerMode] = useState<LayerMode>("expanded");
  const [activeLayer, setActiveLayer] = useState("all");
  const [hiddenLayers, setHiddenLayers] = useState<Set<string>>(() => new Set());
  const [query, setQuery] = useState("");
  const [threat, setThreat] = useState<Threat | "all">("all");
  const [rank, setRank] = useState("all");
  const [confidence, setConfidence] = useState<Confidence | "all">("all");
  const [image, setImage] = useState<ImageFilter>("all");
  const [selected, setSelected] = useState<SelectedItem>(null);
  const [hoverEntity, setHoverEntity] = useState<Entity | null>(null);
  const [imageOverlay, setImageOverlay] = useState<ImageOverlay | null>(null);

  useEffect(() => {
    if (window.__WORLD_MAP_DATA__) {
      setData(parseWorldMapData(window.__WORLD_MAP_DATA__));
      return;
    }
    fetch("./data/world-map-data.json")
      .then((response) => {
        if (!response.ok) throw new Error(`地图数据加载失败：${response.status}`);
        return response.json();
      })
      .then((payload: unknown) => setData(parseWorldMapData(payload)))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  const mapData = data ?? emptyWorldData();
  const indexes = useMemo(() => buildWorldIndexes(mapData), [mapData]);
  const viewState = useMemo<ViewState>(() => ({ overlayMode, layerMode, activeLayer, hiddenLayers, query, threat, rank, confidence, image }), [overlayMode, layerMode, activeLayer, hiddenLayers, query, threat, rank, confidence, image]);
  const visible = useMemo(() => visibleWorld(mapData, indexes, viewState), [mapData, indexes, viewState]);
  const layers = useMemo(() => (data ? layerSummaries(data, indexes, visible) : []), [data, indexes, visible]);
  const focusEntity = selected?.type === "entity" ? selected.data : null;
  const selectedEntityId = selected?.type === "entity" ? selected.data.id : null;
  const hasActiveFilters = Boolean(query.trim()) || threat !== "all" || rank !== "all" || confidence !== "all" || image !== "all";

  function clearSelection() {
    setSelected(null);
    setHoverEntity(null);
  }

  function resetFilters() {
    setQuery("");
    setThreat("all");
    setRank("all");
    setConfidence("all");
    setImage("all");
    setActiveLayer("all");
    setHiddenLayers(new Set());
    clearSelection();
  }

  function setLayerModeSafely(nextMode: LayerMode) {
    setLayerMode(nextMode);
    if (nextMode === "single" && activeLayer === "all") {
      setActiveLayer(mapData.layers[0]?.id || "all");
    }
    clearSelection();
  }

  function requestEntity(id: string) {
    const entity = indexes.entityById.get(id);
    if (entity) {
      setSelected({ type: "entity", data: entity });
      setQuery(entity.label);
    }
  }

  function toggleLayer(layerId: string) {
    setHiddenLayers((current) => {
      const next = new Set(current);
      if (next.has(layerId)) next.delete(layerId);
      else next.add(layerId);
      return next;
    });
    clearSelection();
  }

  function openAgentConsole() {
    window.history.replaceState(null, "", "?agent=1");
    setAppMode("agent");
  }

  function openMap() {
    window.history.replaceState(null, "", isWebPlayPath ? "/" : window.location.pathname);
    setAppMode("map");
  }

  if (appMode === "agent") {
    return (
      <Suspense fallback={<main className="loading-page"><h1>正在加载 Agent 探索控制台</h1></main>}>
        <AgentExplorer onBack={openMap} initialSurface="web-bridge" />
      </Suspense>
    );
  }

  if (error) {
    return <main className="loading-page"><h1>地图启动失败</h1><p>{error}</p></main>;
  }

  if (!data) {
    return <main className="loading-page"><h1>正在加载黑曜纪元 3D 世界地图</h1></main>;
  }

  const status = statusText(data, visible, selected, hoverEntity, viewState);
  const detailPanel = selected?.type === "route"
    ? <RoutePanel route={selected.data} indexes={indexes} />
    : focusEntity
      ? <EntityPanel entity={focusEntity} indexes={indexes} onRequestEntity={requestEntity} onOpenImage={(src, label) => setImageOverlay({ src, label })} />
      : null;

  return (
    <main className="app-shell">
      <Suspense fallback={<div className="scene-loading">正在加载 3D 场景</div>}>
        <WorldMapScene
          data={data}
          indexes={indexes}
          visible={visible}
          viewState={viewState}
          selectedEntityId={selectedEntityId}
          onHoverEntity={setHoverEntity}
          onSelectEntity={(entity) => setSelected(entity ? { type: "entity", data: entity } : null)}
        />
      </Suspense>
      <div className="scene-vignette" />

      <nav className="nav">
        <div className="brand">
          <strong>黑曜纪元 3D 世界地图</strong>
          <span>{status}</span>
        </div>
        <input value={query} onChange={(event) => { setQuery(event.target.value); setSelected(null); }} placeholder="搜索：云墓低语螺、数据巷、神尸矿区、HUB全息冷白" />
        <div className="actions">
          <button onClick={openAgentConsole}>Agent 探索</button>
          {overlayModes.map(([key, label]) => (
            <button key={key} className={overlayMode === key ? "primary active" : ""} onClick={() => { setOverlayMode(key); clearSelection(); }}>{label}</button>
          ))}
          <button onClick={resetFilters}>重置</button>
        </div>
      </nav>

      <section className="rail">
        <div className="rail-title">
          <b>结构化层级</b>
          <span>{visible.visibleEntities.length} 个可见实体 / {data.sourceStats.entities} 总实体</span>
        </div>

        <div className="rail-section">
          <h2>层级状态</h2>
          <div className="filter-group three">
            {layerModes.map(([key, label]) => (
              <button key={key} className={`filter-button ${layerMode === key ? "active" : ""}`} onClick={() => setLayerModeSafely(key)}>{label}</button>
            ))}
          </div>
        </div>

        <div className="rail-section">
          <h2>世界层</h2>
          <div className="layer-list">
            {layers.map((layer) => {
              const hidden = hiddenLayers.has(layer.id);
              const active = activeLayer === layer.id || (layerMode !== "single" && !hidden);
              return (
                <button
                  key={layer.id}
                  className={`layer-button ${active ? "active" : ""} ${hidden ? "muted" : ""}`}
                  style={{ "--zone-color": layer.color } as ZoneStyle}
                  onClick={() => {
                    if (layerMode === "single") setActiveLayer(layer.id);
                    else toggleLayer(layer.id);
                  }}
                >
                  <b>{layer.label}</b>
                  <span>{layer.visibleCount}/{layer.totalCount}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="rail-section filter-panel">
          <h2>过滤</h2>
          <div className="select-grid">
            <SelectFilter label="威胁" value={threat} options={threatFilters} onChange={(value) => setThreat(value as Threat | "all")} />
            <SelectFilter label="职能" value={rank} options={rankFilters} onChange={setRank} />
            <SelectFilter label="置信度" value={confidence} options={confidenceFilters.map((item) => [item, item === "all" ? "全部" : confidenceLabels[item]])} onChange={(value) => setConfidence(value as Confidence | "all")} />
            <SelectFilter label="图像" value={image} options={imageFilters} onChange={(value) => setImage(value as ImageFilter)} />
          </div>
        </div>

        {hasActiveFilters ? (
        <div className="rail-section result-panel">
          <h2>可见实体</h2>
          <RailResults entities={visible.visibleEntities} onSelectEntity={(entity) => setSelected({ type: "entity", data: entity })} />
        </div>
        ) : null}
      </section>

      {detailPanel ? <DetailShell onClose={clearSelection}>{detailPanel}</DetailShell> : <AtlasBrief data={data} visible={visible} layers={layers} />}
      {hoverEntity && !selected ? <HoverPeek entity={hoverEntity} indexes={indexes} /> : null}
      {overlayMode === "conflict" ? (
        <ConflictRibbon routes={data.routes} selected={selected} onSelectRoute={(route) => setSelected({ type: "route", data: route })} />
      ) : null}

      {imageOverlay ? (
        <div className="image-overlay" onClick={() => setImageOverlay(null)}>
          <button>关闭</button>
          <img src={imageOverlay.src} alt={imageOverlay.label} />
        </div>
      ) : null}
    </main>
  );
}
