export interface GraphNode {
  id: string;
  label: string;
  type?: string;
  typeLabel?: string;
  summary?: string;
  cluster?: string;
  clusterLabel?: string;
  featured?: boolean;
  visualRank?: "core" | "major" | "secondary" | "micro" | string;
  defaultLabel?: boolean;
  nodeImage?: string;
  hasImage?: boolean;
  degree?: number;
  color?: string;
  x?: number;
  y?: number;
  z?: number;
  fx?: number;
  fy?: number;
  fz?: number;
}

export interface GraphLink {
  sourceId: string;
  targetId: string;
  label?: string;
  semantic?: boolean;
  source?: string;
  target?: string;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
  storyPath?: string[];
}

export interface GraphIndexes {
  nodeById: Map<string, GraphNode>;
  neighbors: Map<string, Set<string>>;
  storyPath: string[];
  storySet: Set<string>;
  storyEdges: Set<string>;
}

export interface GraphViewState {
  query: string;
  mode: string;
  activeKind: string;
  activeCluster: string;
}

type RelationKind = "tech" | "bio" | "industrial" | "corrupt" | "semantic" | "default";
type Vec3 = [number, number, number];

export const kindFilters = [
  ["all", "全部"],
  ["race", "族群"],
  ["faction", "组织"],
  ["ecology", "生态"],
  ["corruption", "污染"],
] as const;

export const relationPalette: Record<RelationKind, Vec3> = {
  tech: [127, 166, 255],
  bio: [68, 224, 164],
  industrial: [213, 138, 82],
  corrupt: [199, 204, 216],
  semantic: [235, 226, 156],
  default: [210, 220, 180],
};

export const clusterColors = {
  all: "#d58a52",
  core: "#d7bd84",
  tech: "#7fa6ff",
  mine: "#d58a52",
  corruption: "#c7ccd8",
  hunt: "#44e0a4",
  archive: "#7f8a99",
};

export const clusterPositions: Record<string, Vec3> = {
  core: [0, 0, 0],
  tech: [-220, -95, 42],
  mine: [-18, -28, 18],
  corruption: [132, 76, 52],
  hunt: [82, 198, 92],
  archive: [0, 0, -170],
};

export const rootPositions: Record<string, Vec3> = {
  "黑曜纪元": [0, 0, 0],
  "诸天裂灾": [0, -68, 38],
  "高科技文明": [-235, -110, 48],
  "赛博工业财团": [-118, -54, 20],
  "神尸矿区": [-96, 34, 58],
  "腐林": [100, 64, 48],
  "湿谷": [82, 166, 76],
  "孢雾巡猎者": [26, 226, 118],
};

export function edgeKey(source: string, target: string): string {
  return [source, target].sort().join("->");
}

export function buildIndexes(graph: GraphData): GraphIndexes {
  const nodes = graph?.nodes || [];
  const links = graph?.links || [];
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const neighbors = new Map<string, Set<string>>(nodes.map((node) => [node.id, new Set<string>()]));
  links.forEach((link) => {
    neighbors.get(link.sourceId)?.add(link.targetId);
    neighbors.get(link.targetId)?.add(link.sourceId);
  });
  const storyPath = graph?.storyPath || [];
  const storySet = new Set(storyPath);
  const storyEdges = new Set(storyPath.slice(1).flatMap((id, index) => {
    const previous = storyPath[index];
    return previous ? [edgeKey(previous, id)] : [];
  }));
  return { nodeById, neighbors, storyPath, storySet, storyEdges };
}

export function relationKind(link: GraphLink): RelationKind {
  const label = `${link.label || ""} ${link.sourceId || ""} ${link.targetId || ""}`;
  if (/技术|文明|族群|造物|高科技|星序|云脑|白械/.test(label)) return "tech";
  if (/工业|财团|矿|采集|开发|赛博/.test(label)) return "industrial";
  if (/污染|生态|栖息地|物种|生命|巡猎|湿谷|孢|腐林|腐/.test(label)) return "bio";
  if (/眷族|血|旧神|秘社|边缘|克苏鲁|管巢|黑书/.test(label)) return "corrupt";
  return link.semantic ? "semantic" : "default";
}

export function rgba(kind: RelationKind, alpha: number): string {
  const [r, g, b] = relationPalette[kind] || relationPalette.default;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function matchesKind(node: GraphNode, activeKind: string): boolean {
  if (activeKind === "all") return true;
  if (activeKind === "race") return node.type === "race";
  if (activeKind === "faction") return node.type === "faction";
  if (activeKind === "ecology") return node.type === "creature" || node.type === "place";
  if (activeKind === "corruption") {
    const text = `${node.label} ${node.summary || ""} ${node.clusterLabel || ""}`;
    return node.cluster === "corruption" || node.cluster === "hunt" || /污染|腐|孢|旧神|血契|眷族|克苏鲁|管巢/.test(text);
  }
  return true;
}

export function randomOffset(id: string, axis: number): number {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i) + axis * 97) % 9973;
  return (h / 9973 - 0.5) * (axis === 2 ? 70 : 95);
}

export function graphForState(graph: GraphData, indexes: GraphIndexes, state: GraphViewState): GraphData {
  const q = state.query.trim().toLowerCase();
  let nodes = (graph.nodes || []).filter((node) => (state.mode === "all" || node.featured) && matchesKind(node, state.activeKind));
  if (state.activeCluster !== "all") {
    nodes = nodes.filter((node) => node.cluster === state.activeCluster || node.cluster === "core");
  }
  if (q) {
    const hits = new Set(
      graph.nodes
        .filter((node) => matchesKind(node, state.activeKind))
        .filter((node) => node.label.toLowerCase().includes(q) || (node.summary || "").toLowerCase().includes(q) || (node.typeLabel || "").toLowerCase().includes(q))
        .map((node) => node.id)
    );
    [...hits].forEach((id) => indexes.neighbors.get(id)?.forEach((next) => hits.add(next)));
    nodes = graph.nodes.filter((node) => hits.has(node.id));
  }

  const ids = new Set(nodes.map((node) => node.id));
  const links = graph.links
    .filter((link) => ids.has(link.sourceId) && ids.has(link.targetId))
    .map((link) => ({ ...link, source: link.sourceId, target: link.targetId }));

  nodes = nodes.map((node) => {
    const rootPosition = rootPositions[node.id];
    if (rootPosition) {
      const [rx, ry, rz] = rootPosition;
      return { ...node, x: rx, y: ry, z: rz, fx: rx, fy: ry, fz: rz };
    }
    const archivePosition: Vec3 = [0, 0, -170];
    const [cx, cy, cz] = clusterPositions[node.cluster || ""] || clusterPositions.archive || archivePosition;
    return {
      ...node,
      x: cx + randomOffset(node.id, 0),
      y: cy + randomOffset(node.id, 1),
      z: cz + randomOffset(node.id, 2),
    };
  });

  return { nodes, links };
}

export function valueLine(value: unknown): string {
  if (Array.isArray(value)) return value.filter(Boolean).join(" / ");
  return value ? String(value) : "";
}

export function limitText(value: unknown, length = 360): string {
  const text = String(value || "").trim();
  if (text.length <= length) return text;
  return `${text.slice(0, length)}...`;
}

export function pathForNode(node: GraphNode | null | undefined, indexes: GraphIndexes): string[] {
  if (!node) return indexes.storyPath;
  if (indexes.storySet.has(node.id)) return indexes.storyPath;
  const related = [...(indexes.neighbors.get(node.id) || [])].filter((id) => indexes.nodeById.has(id)).slice(0, 4);
  return [node.id, ...related];
}
