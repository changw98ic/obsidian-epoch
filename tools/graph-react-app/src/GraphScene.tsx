import { useEffect, useMemo, useRef } from "react";
import ForceGraph3D from "3d-force-graph";
import SpriteText from "three-spritetext";
import * as THREE from "three";
import {
  edgeKey,
  type GraphData,
  type GraphIndexes,
  type GraphLink,
  type GraphNode,
  type GraphViewState,
  graphForState,
  relationKind,
  relationPalette,
  rgba,
  randomOffset,
} from "./graphUtils";

type ForceGraphData = { nodes: GraphNode[]; links: GraphLink[] };
type GraphForce = {
  strength: (accessor: (node: GraphNode) => number) => void;
  distance: (accessor: (link: GraphLink) => number) => void;
};
type ForceGraphInstance = {
  controls: () => object;
  camera: () => THREE.Camera;
  cameraPosition: (position: { x: number; y: number; z: number }, lookAt?: { x: number; y: number; z: number }, transitionMs?: number) => ForceGraphInstance;
  d3Force: (forceName: string) => unknown;
  scene: () => THREE.Scene;
  width: (value: number) => ForceGraphInstance;
  height: (value: number) => ForceGraphInstance;
  backgroundColor: (value: string) => ForceGraphInstance;
  nodeId: (value: string) => ForceGraphInstance;
  nodeLabel: (accessor: (node: GraphNode) => string) => ForceGraphInstance;
  nodeThreeObject: (accessor: (node: GraphNode) => THREE.Object3D) => ForceGraphInstance;
  linkVisibility: (accessor: (link: GraphLink) => boolean) => ForceGraphInstance;
  linkWidth: (accessor: (link: GraphLink) => number) => ForceGraphInstance;
  linkOpacity: (value: number) => ForceGraphInstance;
  linkColor: (accessor: (link: GraphLink) => string) => ForceGraphInstance;
  linkMaterial: (accessor: (link: GraphLink) => THREE.Material) => ForceGraphInstance;
  linkDirectionalParticles: (accessor: (link: GraphLink) => number) => ForceGraphInstance;
  linkDirectionalParticleSpeed: (accessor: (link: GraphLink) => number) => ForceGraphInstance;
  linkDirectionalParticleWidth: (accessor: (link: GraphLink) => number) => ForceGraphInstance;
  linkDirectionalParticleColor: (accessor: (link: GraphLink) => string) => ForceGraphInstance;
  onNodeHover: (callback: (node: GraphNode | null, previousNode: GraphNode | null) => void) => ForceGraphInstance;
  onNodeClick: (callback: (node: GraphNode, event: MouseEvent) => void) => ForceGraphInstance;
  onBackgroundClick: (callback: (event: MouseEvent) => void) => ForceGraphInstance;
  graphData: {
    (): ForceGraphData;
    (data: ForceGraphData): ForceGraphInstance;
  };
  _destructor?: () => void;
};
type GraphControls = {
  enabled: boolean;
  enableRotate: boolean;
  enableZoom: boolean;
  enablePan: boolean;
  screenSpacePanning: boolean;
  autoRotate: boolean;
  autoRotateSpeed: number;
  mouseButtons?: Partial<Record<"LEFT" | "RIGHT", number>>;
  touches?: Partial<Record<"ONE" | "TWO", number>>;
};
type FocusRequest = { id?: string } | null | undefined;

function graphControls(graph: ForceGraphInstance): GraphControls {
  return graph.controls() as GraphControls;
}

function enableGraphNavigation(graph: ForceGraphInstance) {
  const controls = graphControls(graph);
  controls.enabled = true;
  controls.enableRotate = true;
  controls.enableZoom = true;
  controls.enablePan = true;
  controls.screenSpacePanning = true;
  controls.autoRotateSpeed = 0.28;
  if (controls.mouseButtons && THREE.MOUSE) {
    controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
    controls.mouseButtons.RIGHT = THREE.MOUSE.PAN;
  }
  if (controls.touches && THREE.TOUCH) {
    controls.touches.ONE = THREE.TOUCH.ROTATE;
    controls.touches.TWO = THREE.TOUCH.DOLLY_PAN;
  }
}

function exposeQaBridge(graph: ForceGraphInstance | null) {
  if (!graph) return;
  window.__OBSIDIAN_GRAPH_QA__ = {
    camera: () => ({
      x: graph.camera().position.x,
      y: graph.camera().position.y,
      z: graph.camera().position.z,
    }),
    controls: () => ({
      enabled: graphControls(graph).enabled,
      enableRotate: graphControls(graph).enableRotate,
      enableZoom: graphControls(graph).enableZoom,
      enablePan: graphControls(graph).enablePan,
      autoRotate: graphControls(graph).autoRotate,
    }),
  };
}

function addNebula(scene: THREE.Scene) {
  const starGeo = new THREE.BufferGeometry();
  const count = 1200;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    positions[i * 3] = (Math.random() - 0.5) * 1200;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 1200;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 1200;
  }
  starGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0x7de6d0, size: 0.75, transparent: true, opacity: 0.32 })));

  const ringGeo = new THREE.TorusGeometry(170, 0.45, 12, 220);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xd7bd84, transparent: true, opacity: 0.18 });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = Math.PI / 2.15;
  ring.rotation.z = Math.PI / 7;
  scene.add(ring);
}

export default function GraphScene({
  graph,
  indexes,
  viewState,
  selectedNode,
  hoverNode,
  focusRequest,
  onHoverNode,
  onSelectNode,
  onClearFocus,
}: {
  graph: GraphData;
  indexes: GraphIndexes;
  viewState: GraphViewState;
  selectedNode: GraphNode | null;
  hoverNode: GraphNode | null;
  focusRequest?: FocusRequest;
  onHoverNode: (node: GraphNode | null) => void;
  onSelectNode: (node: GraphNode) => void;
  onClearFocus: () => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const graphRef = useRef<ForceGraphInstance | null>(null);
  const textureCacheRef = useRef<Map<string, THREE.Texture>>(new Map());
  const occlusionTextureCacheRef = useRef<Map<string, THREE.Texture>>(new Map());
  const animatedObjectsRef = useRef<Set<THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>>>(new Set());
  const selectedRef = useRef<GraphNode | null>(selectedNode);
  const hoverRef = useRef<GraphNode | null>(hoverNode);
  const indexesRef = useRef<GraphIndexes>(indexes);

  const storyEdges = indexes.storyEdges;
  const storySet = indexes.storySet;
  const storyPath = indexes.storyPath;

  useEffect(() => {
    selectedRef.current = selectedNode;
    hoverRef.current = hoverNode;
    indexesRef.current = indexes;
    updateVisuals();
  }, [selectedNode, hoverNode, indexes]);

  const graphData = useMemo(() => graphForState(graph, indexes, viewState), [graph, indexes, viewState]);

  function activeFocusNode(): GraphNode | null {
    return selectedRef.current || hoverRef.current;
  }

  function isStoryLink(link: GraphLink) {
    return storyEdges.has(edgeKey(link.sourceId, link.targetId));
  }

  function focusIds(): Set<string> {
    const focus = activeFocusNode();
    const ids = new Set<string>();
    if (!focus) return ids;
    ids.add(focus.id);
    indexesRef.current.neighbors.get(focus.id)?.forEach((id) => ids.add(id));
    if (indexesRef.current.storySet.has(focus.id)) indexesRef.current.storyPath.forEach((id) => ids.add(id));
    return ids;
  }

  function linkIsNearFocus(link: GraphLink) {
    const focus = activeFocusNode();
    if (!focus) return false;
    return link.sourceId === focus.id || link.targetId === focus.id;
  }

  function linkIsActive(link: GraphLink) {
    const focus = activeFocusNode();
    if (!focus) return false;
    if (storySet.has(focus.id) && isStoryLink(link)) return true;
    return linkIsNearFocus(link);
  }

  function linkVisibleFor(link: GraphLink) {
    const focus = activeFocusNode();
    if (!focus) return isStoryLink(link);
    if (storySet.has(focus.id)) return isStoryLink(link) || linkIsNearFocus(link);
    return linkIsNearFocus(link) || isStoryLink(link);
  }

  function linkAlphaFor(link: GraphLink) {
    if (!linkVisibleFor(link)) return 0;
    if (linkIsActive(link)) return isStoryLink(link) ? 0.86 : 0.58;
    if (linkIsNearFocus(link)) return 0.34;
    if (isStoryLink(link)) return 0.42;
    return 0.1;
  }

  function linkColorFor(link: GraphLink) {
    return rgba(relationKind(link), linkAlphaFor(link));
  }

  function linkMaterialFor(link: GraphLink) {
    const [r, g, b] = relationPalette[relationKind(link)] || relationPalette.default;
    return new THREE.MeshBasicMaterial({
      color: new THREE.Color(r / 255, g / 255, b / 255),
      transparent: true,
      opacity: linkAlphaFor(link),
      depthTest: true,
      depthWrite: false,
      toneMapped: false,
      blending: THREE.NormalBlending,
    });
  }

  function linkWidthFor(link: GraphLink) {
    if (!linkVisibleFor(link)) return 0;
    if (linkIsActive(link)) return isStoryLink(link) ? 3.4 : 1.55;
    if (linkIsNearFocus(link)) return 1.15;
    if (isStoryLink(link)) return 2.0;
    return 0.5;
  }

  function particleCountFor(link: GraphLink) {
    if (!linkVisibleFor(link)) return 0;
    if (linkIsActive(link) && isStoryLink(link)) return 4;
    if (linkIsActive(link) && relationKind(link) === "bio") return 2;
    return 0;
  }

  function nodeOpacity(node: GraphNode) {
    const focus = activeFocusNode();
    if (focus) {
      const ids = focusIds();
      if (node.id === focus.id) return 1;
      if (storySet.has(focus.id) && storySet.has(node.id)) return 0.86;
      if (ids.has(node.id)) return 0.68;
      if (node.cluster === "core") return 0.36;
      return 0.16;
    }
    if (node.visualRank === "core") return 0.92;
    if (node.visualRank === "major") return 0.74;
    if (node.visualRank === "secondary") return 0.34;
    return 0.18;
  }

  function shouldShowLabel(node: GraphNode) {
    const focus = activeFocusNode();
    if (!focus) return Boolean(node.defaultLabel);
    const ids = focusIds();
    return node.id === focus.id || ids.has(node.id) || (storySet.has(focus.id) && storySet.has(node.id));
  }

  function textureForNode(node: GraphNode) {
    const key = node.nodeImage ? `img:${node.id}` : `sigil:${node.id}`;
    const textureCache = textureCacheRef.current;
    if (textureCache.has(key)) return textureCache.get(key);
    if (node.nodeImage) {
      const texture = new THREE.TextureLoader().load(node.nodeImage);
      texture.colorSpace = THREE.SRGBColorSpace;
      textureCache.set(key, texture);
      return texture;
    }

    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas_context_unavailable");
    const color = node.color || "#57d7be";
    ctx.clearRect(0, 0, 256, 256);
    ctx.save();
    ctx.beginPath();
    ctx.arc(128, 128, 106, 0, Math.PI * 2);
    ctx.clip();
    const gradient = ctx.createRadialGradient(128, 96, 12, 128, 128, 132);
    gradient.addColorStop(0, `${color}f2`);
    gradient.addColorStop(0.52, "rgba(7, 18, 17, .58)");
    gradient.addColorStop(1, "rgba(2, 4, 3, .04)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 256, 256);
    ctx.restore();
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 18;
    ctx.strokeStyle = "rgba(239, 231, 212, .72)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(128, 128, 92, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(128, 36);
    ctx.lineTo(204, 128);
    ctx.lineTo(128, 220);
    ctx.lineTo(52, 128);
    ctx.closePath();
    ctx.stroke();
    ctx.fillStyle = "#efe7d4";
    ctx.font = "700 42px PingFang SC, Microsoft YaHei, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(node.label.slice(0, 2), 128, 123);
    ctx.fillStyle = "rgba(239,231,212,.72)";
    ctx.font = "500 18px PingFang SC, Microsoft YaHei, sans-serif";
    ctx.fillText(node.typeLabel || node.type || "", 128, 170);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    textureCache.set(key, texture);
    return texture;
  }

  function occlusionTextureForNode(node: GraphNode & { hasImage?: boolean }) {
    const key = node.hasImage ? "image-node-occluder" : "sigil-node-occluder";
    const occlusionTextureCache = occlusionTextureCacheRef.current;
    if (occlusionTextureCache.has(key)) return occlusionTextureCache.get(key);
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas_context_unavailable");
    const gradient = ctx.createRadialGradient(128, 128, 40, 128, 128, 126);
    gradient.addColorStop(0, "rgba(5, 9, 10, .98)");
    gradient.addColorStop(0.66, "rgba(5, 9, 10, .92)");
    gradient.addColorStop(0.84, "rgba(5, 9, 10, .58)");
    gradient.addColorStop(1, "rgba(5, 9, 10, 0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(128, 128, 126, 0, Math.PI * 2);
    ctx.fill();
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    occlusionTextureCache.set(key, texture);
    return texture;
  }

  function makeNodeObject(node: GraphNode & { degree?: number; hasImage?: boolean }) {
    const group = new THREE.Group();
    const degree = Math.max(1, node.degree || 1);
    const focus = activeFocusNode();
    const active = focus && node.id === focus.id;
    const opacity = nodeOpacity(node);
    const rankBase = ({ core: 23, major: 16, secondary: 10, micro: 7 } as Record<string, number>)[node.visualRank || ""] || 8;
    const size = (rankBase + Math.min(10, Math.sqrt(degree) * 1.2)) * (active ? 1.18 : opacity < 0.24 ? 0.82 : 1);
    const imageScale = node.hasImage ? (active ? 1.72 : 1.16) : 1.34;
    const occlusionScale = size * imageScale * (node.hasImage ? 1.24 : 1.34);

    const depthShield = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: occlusionTextureForNode(node),
        alphaTest: 0.2,
        depthWrite: true,
        depthTest: true,
        colorWrite: false,
        transparent: false,
      })
    );
    depthShield.scale.set(occlusionScale * 1.03, occlusionScale * 1.03, 1);
    depthShield.renderOrder = -20;
    group.add(depthShield);

    const occlusionSprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: occlusionTextureForNode(node),
        transparent: true,
        opacity: Math.min(0.98, Math.max(0.48, opacity + 0.24)),
        alphaTest: 0.16,
        depthWrite: true,
        depthTest: true,
      })
    );
    occlusionSprite.scale.set(occlusionScale, occlusionScale, 1);
    occlusionSprite.renderOrder = -10;
    group.add(occlusionSprite);

    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: textureForNode(node),
        transparent: true,
        opacity,
        alphaTest: 0.08,
        depthWrite: true,
        depthTest: true,
      })
    );
    sprite.scale.set(size * imageScale, size * imageScale, 1);
    sprite.renderOrder = 10;
    group.add(sprite);

    if ((node.visualRank === "core" || active) && !node.hasImage) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(size * 0.88, 0.34, 10, 64),
        new THREE.MeshBasicMaterial({ color: node.color, transparent: true, opacity: Math.max(0.18, opacity * 0.58) })
      );
      ring.rotation.x = Math.PI / 2;
      ring.userData.spinSpeed = active ? 0.014 : 0.0035;
      ring.userData.pulse = Boolean(active);
      ring.userData.baseOpacity = Math.max(0.18, opacity * 0.58);
      ring.userData.phase = randomOffset(node.id, 2);
      animatedObjectsRef.current.add(ring);
      group.add(ring);
    }

    if (shouldShowLabel(node)) {
      const label = new SpriteText(node.label);
      label.color = "#efe7d4";
      label.textHeight = node.visualRank === "core" ? 5.0 : 3.8;
      label.backgroundColor = active ? "rgba(5, 9, 10, .62)" : "rgba(5, 9, 10, .34)";
      label.padding = 1.2;
      label.borderRadius = 3;
      label.position.y = -size * 1.15;
      label.renderOrder = 20;
      group.add(label);
    }
    return group;
  }

  function updateVisuals() {
    const fg = graphRef.current;
    if (!fg) return;
    fg
      .nodeThreeObject((node: GraphNode) => makeNodeObject(node))
      .linkVisibility((link: GraphLink) => linkVisibleFor(link))
      .linkWidth((link: GraphLink) => linkWidthFor(link))
      .linkColor((link: GraphLink) => linkColorFor(link))
      .linkMaterial((link: GraphLink) => linkMaterialFor(link))
      .linkDirectionalParticles((link: GraphLink) => particleCountFor(link));
  }

  function focusCamera(node: GraphNode | null | undefined) {
    const fg = graphRef.current;
    if (!fg || !node) return;
    enableGraphNavigation(fg);
    graphControls(fg).autoRotate = false;
    const distance = node.hasImage ? 190 : 155;
    const len = Math.hypot(node.x || 1, node.y || 1, node.z || 1);
    const ratio = 1 + distance / len;
    const target = { x: node.x || 0, y: node.y || 0, z: node.z || 0 };
    fg.cameraPosition({ x: (node.x || 1) * ratio, y: (node.y || 1) * ratio, z: (node.z || 1) * ratio }, target, 760);
    window.setTimeout(() => enableGraphNavigation(fg), 800);
  }

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;
    const fg = (ForceGraph3D()(el) as unknown as ForceGraphInstance)
      .backgroundColor("rgba(0,0,0,0)")
      .nodeId("id")
      .nodeLabel((node) => `${node.label}\n${node.typeLabel}\n${node.summary || ""}`)
      .nodeThreeObject((node) => makeNodeObject(node))
      .linkVisibility((link) => linkVisibleFor(link))
      .linkWidth((link) => linkWidthFor(link))
      .linkOpacity(1)
      .linkColor((link) => linkColorFor(link))
      .linkMaterial((link) => linkMaterialFor(link))
      .linkDirectionalParticles((link) => particleCountFor(link))
      .linkDirectionalParticleSpeed((link) => (isStoryLink(link) ? 0.0024 : 0.0014))
      .linkDirectionalParticleWidth((link) => (isStoryLink(link) ? 2.35 : 1.25))
      .linkDirectionalParticleColor((link) => linkColorFor(link))
      .onNodeHover((node) => {
        onHoverNode(node || null);
        el.style.cursor = node ? "pointer" : "default";
      })
      .onNodeClick((node) => {
        onSelectNode(node);
        focusCamera(node);
      })
      .onBackgroundClick(() => {
        onClearFocus();
        enableGraphNavigation(fg);
        graphControls(fg).autoRotate = viewState.mode === "featured";
      });

    graphRef.current = fg;
    exposeQaBridge(fg);
    const chargeForce = fg.d3Force("charge") as Pick<GraphForce, "strength"> | undefined;
    const linkForce = fg.d3Force("link") as Pick<GraphForce, "distance"> | undefined;
    const centerForce = fg.d3Force("center") as { strength: (value: number) => void } | undefined;
    chargeForce?.strength((node) => (node.featured ? -150 : -48));
    linkForce?.distance((link) => (isStoryLink(link) ? 68 : link.semantic ? 86 : 46));
    centerForce?.strength(0.02);
    fg.cameraPosition({ x: 0, y: -44, z: 520 }, { x: 0, y: 58, z: 20 });
    enableGraphNavigation(fg);
    graphControls(fg).autoRotate = true;
    graphControls(fg).autoRotateSpeed = 0.28;

    fg.scene().fog = new THREE.FogExp2(0x05090a, 0.00145);
    fg.scene().add(new THREE.AmbientLight(0xc7ccd8, 1.05));
    const keyLight = new THREE.PointLight(0xd58a52, 1.15, 900);
    keyLight.position.set(180, -240, 320);
    fg.scene().add(keyLight);
    const rimLight = new THREE.PointLight(0x44e0a4, 0.95, 1000);
    rimLight.position.set(-280, 160, 240);
    fg.scene().add(rimLight);
    addNebula(fg.scene());

    const resize = () => {
      fg.width(el.clientWidth || window.innerWidth);
      fg.height(el.clientHeight || window.innerHeight);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(el);
    resize();

    let running = true;
    const tick = () => {
      if (!running) return;
      animatedObjectsRef.current.forEach((object) => {
        if (!object.parent) {
          animatedObjectsRef.current.delete(object);
          return;
        }
        object.rotation.z += object.userData.spinSpeed || 0.003;
        if (object.material && object.userData.pulse) {
          const base = object.userData.baseOpacity || 0.42;
          object.material.opacity = base + Math.sin(Date.now() * 0.0022 + object.userData.phase) * 0.12;
        }
      });
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);

    return () => {
      running = false;
      observer.disconnect();
      if (window.__OBSIDIAN_GRAPH_QA__) delete window.__OBSIDIAN_GRAPH_QA__;
      fg._destructor?.();
      graphRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!graphRef.current) return;
    graphRef.current.graphData(graphData);
    updateVisuals();
    enableGraphNavigation(graphRef.current);
    exposeQaBridge(graphRef.current);
    graphControls(graphRef.current).autoRotate = viewState.mode === "featured" && !selectedRef.current;
  }, [graphData, viewState.mode]);

  useEffect(() => {
    if (!focusRequest?.id || !graphRef.current) return;
    const timer = window.setTimeout(() => {
      const node = graphRef.current?.graphData().nodes.find((item: GraphNode) => item.id === focusRequest.id);
      if (!node) return;
      onSelectNode(node);
      focusCamera(node);
    }, 160);
    return () => window.clearTimeout(timer);
  }, [focusRequest]);

  return <div ref={containerRef} className="graph-canvas" />;
}
