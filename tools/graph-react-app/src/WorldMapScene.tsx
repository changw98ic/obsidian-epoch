import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import SpriteText from "three-spritetext";
import { layerPalette, threatPalette, valueLine } from "./worldMapUtils";
import type { Entity, Layer, Region, ViewState, VisibleWorld, WorldIndexes, WorldMapData } from "./types";

type HitResult = { type: "entity"; entity: Entity } | { type: "region"; region: Region; entity: Entity | null } | null;

function disposeObject(object: THREE.Object3D | undefined) {
  if (!object) return;
  object.traverse((child) => {
    const item = child as THREE.Object3D & { geometry?: THREE.BufferGeometry; material?: THREE.Material | THREE.Material[]; texture?: THREE.Texture };
    if (item.geometry) item.geometry.dispose();
    if (item.material) {
      if (Array.isArray(item.material)) item.material.forEach((material) => material.dispose());
      else item.material.dispose();
    }
    if (item.texture) item.texture.dispose();
  });
}

function displayYForLayer(layer: Layer | undefined, state: ViewState): number {
  if (!layer) return 0;
  if (state.layerMode === "single") return 0;
  if (state.layerMode === "stacked") return (layer.order - 4) * 54;
  return layer.elevation;
}

function projectPosition(position: readonly number[], layer: Layer | undefined, state: ViewState): THREE.Vector3 {
  const baseY = displayYForLayer(layer, state);
  const originalY = Array.isArray(position) ? Number(position[1]) || 0 : 0;
  const layerY = Number(layer?.elevation) || 0;
  return new THREE.Vector3(
    Array.isArray(position) ? Number(position[0]) || 0 : 0,
    baseY + (originalY - layerY) * 0.28,
    Array.isArray(position) ? Number(position[2]) || 0 : 0
  );
}

function colorForEntity(entity: Entity, state: ViewState): string {
  const details = entity.details || {};
  if (state.overlayMode === "ecology") return threatPalette[(valueLine(details.threat) as keyof typeof threatPalette)] || threatPalette["未知"];
  if (state.overlayMode === "conflict") {
    if ((entity.overlayRoles || []).includes("conflict")) return valueLine(details.threat) === "S" ? "#ff5a6f" : "#ff9f43";
    return "#8b95a7";
  }
  if (entity.kind === "faction") return "#ffd166";
  if (/势力|造物|眷族|族/.test(valueLine(details.type) + valueLine(details.base))) return "#66d6d1";
  return "#b690ff";
}

function sizeForEntity(entity: Entity): number {
  const details = entity.details || {};
  const threatSize = ({ S: 5.6, A: 4.8, B: 4.1, C: 3.4, D: 2.9, E: 2.45, "未知": 2.15 } as Record<string, number>)[valueLine(details.threat)] || 2.15;
  const rankBonus = ({ 世界级: 2.4, 首领: 1.8, 头目: 1.2, 精英: 0.7, 普通: 0, "未知": 0 } as Record<string, number>)[valueLine(details.rank_role) || "未知"] || 0;
  if (entity.kind === "place") return 5.4;
  if (entity.kind === "faction") return 5.0;
  return threatSize + rankBonus;
}

function makeLabel(text: string, color = "#f2eeda", size = 6) {
  const label = new SpriteText(text);
  label.color = color;
  label.textHeight = size;
  label.fontFace = "PingFang SC, Microsoft YaHei, sans-serif";
  label.backgroundColor = "rgba(3, 8, 9, 0.42)";
  label.borderColor = "rgba(242, 238, 218, 0.12)";
  label.borderWidth = 0.45;
  label.padding = 2.4;
  return label;
}

function routeLine(points: THREE.Vector3[], color: string) {
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.72 });
  return new THREE.Line(geometry, material);
}

export default function WorldMapScene({
  data,
  indexes,
  visible,
  viewState,
  selectedEntityId,
  onHoverEntity,
  onSelectEntity,
}: {
  data: WorldMapData;
  indexes: WorldIndexes;
  visible: VisibleWorld;
  viewState: ViewState;
  selectedEntityId: string | null;
  onHoverEntity: (entity: Entity | null) => void;
  onSelectEntity: (entity: Entity | null) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [renderError, setRenderError] = useState("");
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const worldGroupRef = useRef<THREE.Group | null>(null);
  const contentGroupRef = useRef<THREE.Group | null>(null);
  const selectionGroupRef = useRef<THREE.Group | null>(null);
  const entityMeshRef = useRef<THREE.InstancedMesh | null>(null);
  const regionMeshesRef = useRef<THREE.Mesh[]>([]);
  const visibleRef = useRef(visible);
  const viewStateRef = useRef(viewState);
  const selectedIdRef = useRef(selectedEntityId);

  useEffect(() => {
    visibleRef.current = visible;
    viewStateRef.current = viewState;
    selectedIdRef.current = selectedEntityId;
  }, [visible, viewState, selectedEntityId]);

  useEffect(() => {
    if (!containerRef.current) return undefined;
    const container = containerRef.current;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#030606");
    scene.fog = new THREE.Fog("#030606", 430, 1040);

    const camera = new THREE.PerspectiveCamera(45, container.clientWidth / Math.max(1, container.clientHeight), 0.1, 1800);
    const compactCamera = container.clientWidth < 760;
    camera.position.set(compactCamera ? 420 : 330, compactCamera ? 360 : 300, compactCamera ? 540 : 420);
    camera.lookAt(0, 28, 0);

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      setRenderError(message);
      window.__WORLD_MAP_QA__ = {
        stats: () => ({
          layers: data?.layers?.length || 0,
          visibleLayers: visibleRef.current?.visibleLayers?.length || 0,
          visibleEntities: visibleRef.current?.visibleEntities?.length || 0,
          visibleRegions: visibleRef.current?.visibleRegions?.length || 0,
          visibleRoutes: visibleRef.current?.visibleRoutes?.length || 0,
          renderer: "unavailable",
          error: message,
        }),
        camera: () => null,
        visibleEntities: () => (visibleRef.current?.visibleEntities || []).map((entity) => entity.id),
        visibleLayers: () => (visibleRef.current?.visibleLayers || []).map((layer) => layer.id),
        selected: () => selectedIdRef.current,
      };
      return () => {
        delete window.__WORLD_MAP_QA__;
      };
    }
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = true;
    controls.screenSpacePanning = true;
    controls.minDistance = 120;
    controls.maxDistance = 900;
    controls.target.set(0, 28, 0);

    scene.add(new THREE.AmbientLight(0xe7f5ef, 1.0));
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.9);
    keyLight.position.set(150, 280, 220);
    scene.add(keyLight);
    const sideLight = new THREE.DirectionalLight(0x66d6d1, 0.6);
    sideLight.position.set(-260, 180, -180);
    scene.add(sideLight);
    const lowLight = new THREE.DirectionalLight(0xd7a35e, 0.24);
    lowLight.position.set(80, -120, 260);
    scene.add(lowLight);

    const worldGroup = new THREE.Group();
    const contentGroup = new THREE.Group();
    const selectionGroup = new THREE.Group();
    worldGroup.add(contentGroup);
    worldGroup.add(selectionGroup);
    scene.add(worldGroup);

    sceneRef.current = scene;
    cameraRef.current = camera;
    rendererRef.current = renderer;
    controlsRef.current = controls;
    worldGroupRef.current = worldGroup;
    contentGroupRef.current = contentGroup;
    selectionGroupRef.current = selectionGroup;

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    function pointerForEvent(event: PointerEvent | MouseEvent) {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    }

    function hitTest(event: PointerEvent | MouseEvent): HitResult {
      pointerForEvent(event);
      raycaster.setFromCamera(pointer, camera);
      const entityMesh = entityMeshRef.current;
      if (entityMesh) {
        const entityHits = raycaster.intersectObject(entityMesh, false);
        const firstHit = entityHits[0];
        if (firstHit?.instanceId !== undefined) {
          const entity = entityMesh.userData.entities?.[firstHit.instanceId];
          return entity ? { type: "entity", entity } : null;
        }
      }
      const regionHits = raycaster.intersectObjects(regionMeshesRef.current, false);
      if (regionHits.length) {
        const hit = regionHits[0]?.object.userData as { region: Region; entity: Entity | null } | undefined;
        if (!hit) return null;
        return { type: "region", region: hit.region, entity: hit.entity };
      }
      return null;
    }

    function handleMove(event: PointerEvent) {
      const hit = hitTest(event);
      renderer.domElement.style.cursor = hit ? "pointer" : "grab";
      onHoverEntity(hit?.entity || null);
    }

    function handleClick(event: MouseEvent) {
      const hit = hitTest(event);
      onSelectEntity(hit?.entity || null);
    }

    renderer.domElement.addEventListener("pointermove", handleMove);
    renderer.domElement.addEventListener("click", handleClick);

    function handleResize() {
      const width = container.clientWidth || 1;
      const height = container.clientHeight || 1;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    }
    window.addEventListener("resize", handleResize);

    let frame = 0;
    let raf = 0;
    function animate() {
      frame += 1;
      worldGroup.rotation.y = Math.sin(frame / 900) * 0.015;
      controls.update();
      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    }
    animate();

    window.__WORLD_MAP_QA__ = {
      stats: () => ({
        layers: data?.layers?.length || 0,
        visibleLayers: visibleRef.current?.visibleLayers?.length || 0,
        visibleEntities: visibleRef.current?.visibleEntities?.length || 0,
        visibleRegions: visibleRef.current?.visibleRegions?.length || 0,
        visibleRoutes: visibleRef.current?.visibleRoutes?.length || 0,
        overlayMode: viewStateRef.current?.overlayMode,
        layerMode: viewStateRef.current?.layerMode,
      }),
      camera: () => ({ x: camera.position.x, y: camera.position.y, z: camera.position.z }),
      visibleEntities: () => (visibleRef.current?.visibleEntities || []).map((entity) => entity.id),
      visibleLayers: () => (visibleRef.current?.visibleLayers || []).map((layer) => layer.id),
      selected: () => selectedIdRef.current,
    };

    return () => {
      cancelAnimationFrame(raf);
      renderer.domElement.removeEventListener("pointermove", handleMove);
      renderer.domElement.removeEventListener("click", handleClick);
      window.removeEventListener("resize", handleResize);
      controls.dispose();
      disposeObject(worldGroup);
      renderer.dispose();
      renderer.domElement.remove();
      delete window.__WORLD_MAP_QA__;
    };
  }, []);

  useEffect(() => {
    const contentGroup = contentGroupRef.current;
    if (!contentGroup || !data || !indexes || !visible) return;
    while (contentGroup.children.length) {
      const child = contentGroup.children.pop();
      disposeObject(child);
    }
    regionMeshesRef.current = [];
    entityMeshRef.current = null;

    const layerById = indexes.layerById;
    const regionCounts = new Map<string, number>();
    visible.visibleEntities.forEach((entity) => {
      regionCounts.set(entity.region, (regionCounts.get(entity.region) || 0) + 1);
    });

    visible.visibleLayers.forEach((layer) => {
      const y = displayYForLayer(layer, viewState);
      const color = new THREE.Color(layerPalette[layer.id as keyof typeof layerPalette] || layer.color || "#8b95a7");
      const platform = new THREE.Mesh(
        new THREE.BoxGeometry(438, 3.5, 298),
        new THREE.MeshStandardMaterial({
          color,
          transparent: true,
          opacity: viewState.layerMode === "single" ? 0.19 : 0.09,
          roughness: 0.72,
          metalness: 0.08,
          depthWrite: false,
        })
      );
      platform.position.set(0, y - 7, 0);
      contentGroup.add(platform);

      const line = new THREE.LineSegments(
        new THREE.EdgesGeometry(platform.geometry),
        new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.24 })
      );
      line.position.copy(platform.position);
      contentGroup.add(line);

      const label = makeLabel(`${layer.label} · ${(indexes.entitiesByLayer.get(layer.id) || []).length}`, layer.color, 6.6);
      label.position.set(-218, y + 14, -150);
      contentGroup.add(label);
    });

    const labelBudget = viewState.layerMode === "single" ? 18 : 12;
    const regionLabelIds = new Set(
      [...visible.visibleRegions]
        .sort((a, b) => (regionCounts.get(b.id) || 0) - (regionCounts.get(a.id) || 0))
        .slice(0, labelBudget)
        .map((region) => region.id)
    );

    visible.visibleRegions.forEach((region) => {
      const layer = layerById.get(region.layer);
      const center = projectPosition(region.position, layer, viewState);
      const count = regionCounts.get(region.id) || 0;
      const radius = Math.max(12, Math.min(54, Number(region.radius) || 24));
      const color = new THREE.Color(layerPalette[region.layer as keyof typeof layerPalette] || "#8b95a7");
      const mesh = new THREE.Mesh(
        new THREE.CircleGeometry(radius, 48),
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: region.confidence === "low" ? 0.09 : 0.16,
          depthWrite: false,
          side: THREE.DoubleSide,
        })
      );
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(center.x, center.y + 1.2, center.z);
      mesh.userData = { region, entity: indexes.placeByRegion.get(region.id) || null };
      regionMeshesRef.current.push(mesh);
      contentGroup.add(mesh);

      const shouldLabel = regionLabelIds.has(region.id) || count >= (viewState.layerMode === "single" ? 9 : 20);
      if (shouldLabel) {
        const label = makeLabel(`${region.label} ${count ? count : ""}`.trim(), "#edf7f2", count >= 20 ? 5.3 : 4.5);
        label.position.set(center.x, center.y + 12, center.z);
        contentGroup.add(label);
      }
    });

    if (visible.visibleEntities.length) {
      const geometry = new THREE.SphereGeometry(1, 12, 8);
      const material = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.48,
        metalness: 0.08,
        vertexColors: true,
        emissive: new THREE.Color("#101617"),
        emissiveIntensity: 0.26,
      });
      const mesh = new THREE.InstancedMesh(geometry, material, visible.visibleEntities.length);
      const matrix = new THREE.Matrix4();
      const scale = new THREE.Vector3();
      visible.visibleEntities.forEach((entity, index) => {
        const layer = layerById.get(entity.layer);
        const position = projectPosition(entity.position, layer, viewState);
        const size = sizeForEntity(entity) * (viewState.layerMode === "single" ? 1 : 0.84);
        scale.set(size, size, size);
        matrix.compose(position, new THREE.Quaternion(), scale);
        mesh.setMatrixAt(index, matrix);
        mesh.setColorAt(index, new THREE.Color(colorForEntity(entity, viewState)));
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.userData.entities = visible.visibleEntities;
      entityMeshRef.current = mesh;
      contentGroup.add(mesh);
    }

    visible.visibleRoutes.forEach((route) => {
      const points = (route.points || [])
        .map((id) => indexes.regionById.get(id))
        .filter((region): region is Region => Boolean(region))
        .map((region) => projectPosition(region.position, layerById.get(region.layer), viewState).add(new THREE.Vector3(0, 18, 0)));
      if (points.length >= 2) {
        const line = routeLine(points, route.confidence === "high" ? "#ff9f43" : "#b690ff");
        contentGroup.add(line);
      }
    });
  }, [data, indexes, visible, viewState]);

  useEffect(() => {
    const selectionGroup = selectionGroupRef.current;
    if (!selectionGroup || !indexes) return;
    while (selectionGroup.children.length) {
      const child = selectionGroup.children.pop();
      disposeObject(child);
    }
    const selected = selectedEntityId ? indexes.entityById.get(selectedEntityId) : null;
    if (selected) {
      const layer = indexes.layerById.get(selected.layer);
      const position = projectPosition(selected.position, layer, viewState);
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(10, 0.8, 10, 48),
        new THREE.MeshBasicMaterial({ color: "#f2eeda", transparent: true, opacity: 0.92 })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(position.x, position.y + 0.6, position.z);
      selectionGroup.add(ring);
      const label = makeLabel(selected.label, "#f2eeda", 7.4);
      label.position.set(position.x, position.y + 22, position.z);
      selectionGroup.add(label);
    }
  }, [indexes, selectedEntityId, viewState]);

  return (
    <div ref={containerRef} className={`world-map-canvas ${renderError ? "webgl-fallback" : ""}`}>
      {renderError ? (
        <div className="webgl-fallback-panel">
          <b>3D 渲染不可用</b>
          <span>浏览器没有提供 WebGL 上下文；地图数据和筛选仍已加载。错误：{renderError}</span>
        </div>
      ) : null}
    </div>
  );
}
