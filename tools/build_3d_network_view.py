from __future__ import annotations

import base64
import json
import re
from collections import Counter
from io import BytesIO
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "00_总览"
HTML_OUT = OUT_DIR / "黑曜纪元3D知识图谱.html"
JSON_OUT = OUT_DIR / "3d-graph-data.json"
VENDOR_DIR = OUT_DIR / "assets" / "vendor"
LOCAL_VENDOR_ASSETS = {
    "three": VENDOR_DIR / "three-0.160.1.min.js",
    "three-spritetext": VENDOR_DIR / "three-spritetext-1.9.1.min.js",
    "3d-force-graph": VENDOR_DIR / "3d-force-graph-1.73.6.min.js",
}

EXCLUDED_DIRS = {".git", ".obsidian", "tools"}

TYPE_LABELS = {
    "overview": "总览",
    "world": "世界底层",
    "race": "种族",
    "faction": "势力组织",
    "creature": "异化生物",
    "place": "地点生态",
    "event": "事件剧情",
    "base": "基底气质",
    "relation": "关系网络",
    "node": "图谱节点",
}

TYPE_COLORS = {
    "overview": "#d6c08d",
    "world": "#86b7ff",
    "race": "#7fd9a0",
    "faction": "#f0a66f",
    "creature": "#47d6a3",
    "place": "#9aa7b8",
    "event": "#c7b3ff",
    "base": "#58ead6",
    "relation": "#ee95ff",
    "node": "#cbd5e1",
}


def note_type(path: Path) -> str:
    folder = path.relative_to(ROOT).parts[0]
    return {
        "00_总览": "overview",
        "01_世界底层": "world",
        "02_种族": "race",
        "03_势力组织": "faction",
        "04_异化生物": "creature",
        "05_地点生态": "place",
        "06_事件剧情": "event",
        "07_基底气质": "base",
        "08_关系网络": "relation",
    }.get(folder, "node")


def clean_target(target: str) -> str:
    return target.split("|", 1)[0].split("#", 1)[0].strip()


def parse_frontmatter(text: str) -> dict[str, object]:
    if not text.startswith("---\n"):
        return {}
    end = text.find("\n---", 4)
    if end == -1:
        return {}
    lines = text[4:end].splitlines()
    data: dict[str, object] = {}
    current_key: str | None = None
    for line in lines:
        if not line.strip():
            continue
        if line.startswith("  - ") and current_key:
            value = line[4:].strip().strip('"')
            current = data.setdefault(current_key, [])
            if isinstance(current, list):
                current.append(value)
            continue
        if ":" in line:
            key, value = line.split(":", 1)
            key = key.strip()
            value = value.strip()
            current_key = key
            if value:
                data[key] = value.strip('"')
            else:
                data[key] = []
    return data


def first_summary(text: str) -> str:
    body = re.sub(r"^---\n.*?\n---\n", "", text, flags=re.S).strip()
    quote = re.search(r"^>\s*(.+)$", body, flags=re.M)
    if quote:
        return quote.group(1).strip()
    body = re.sub(r"^# .+$", "", body, flags=re.M)
    for paragraph in re.split(r"\n\s*\n", body):
        paragraph = paragraph.strip()
        if paragraph and not paragraph.startswith("##") and not paragraph.startswith("```") and not paragraph.startswith("![["):
            return re.sub(r"\s+", " ", paragraph)[:220]
    return ""


def resolve_embed_image(text: str) -> Path | None:
    match = re.search(r"!\[\[([^\]]+\.(?:png|jpe?g|webp|gif))(?:\|[^\]]*)?\]\]", text, flags=re.I)
    if not match:
        return None
    filename = clean_target(match.group(1))
    candidates = list(ROOT.rglob(filename))
    return candidates[0] if candidates else None


def image_data_uri(path: Path) -> str:
    with Image.open(path) as image:
        image = image.convert("RGB")
        width, height = image.size
        side = min(width, height)
        left = (width - side) // 2
        top = (height - side) // 2
        image = image.crop((left, top, left + side, top + side))
        image.thumbnail((256, 256), Image.Resampling.LANCZOS)
        out = BytesIO()
        image.save(out, format="JPEG", quality=82, optimize=True)
    return "data:image/jpeg;base64," + base64.b64encode(out.getvalue()).decode("ascii")


def read_notes() -> list[Path]:
    paths = []
    for path in ROOT.rglob("*.md"):
        rel = path.relative_to(ROOT).parts
        if any(part in EXCLUDED_DIRS for part in rel):
            continue
        if rel[0] == "_templates":
            continue
        paths.append(path)
    return sorted(paths)


def build_graph() -> dict[str, object]:
    note_paths = read_notes()
    notes = {path.stem: path for path in note_paths}
    node_meta: dict[str, dict[str, object]] = {}
    edge_counter: Counter[tuple[str, str]] = Counter()

    for path in note_paths:
        text = path.read_text(encoding="utf-8")
        source = path.stem
        for raw_target in re.findall(r"\[\[([^\]]+)\]\]", text):
            target = clean_target(raw_target)
            if target in notes and target != source:
                edge_counter[(source, target)] += 1

    degree: Counter[str] = Counter()
    for (source, target), weight in edge_counter.items():
        degree[source] += weight
        degree[target] += weight

    for name, path in notes.items():
        text = path.read_text(encoding="utf-8")
        fm = parse_frontmatter(text)
        image_path = resolve_embed_image(text)
        image_uri = image_data_uri(image_path) if image_path else ""
        node_type = note_type(path)
        node_meta[name] = {
            "id": name,
            "label": name,
            "type": node_type,
            "typeLabel": TYPE_LABELS[node_type],
            "color": TYPE_COLORS[node_type],
            "path": str(path.relative_to(ROOT)),
            "degree": degree[name],
            "summary": first_summary(text),
            "frontmatter": fm,
            "image": image_uri,
            "hasImage": bool(image_uri),
        }

    nodes = [node for node in node_meta.values() if not str(node["path"]).startswith("_templates/")]
    node_ids = {str(node["id"]) for node in nodes}
    links = [
        {
            "source": source,
            "target": target,
            "sourceId": source,
            "targetId": target,
            "weight": weight,
        }
        for (source, target), weight in edge_counter.items()
        if source in node_ids and target in node_ids
    ]

    return {"nodes": nodes, "links": links, "types": TYPE_LABELS}


def write_html(graph: dict[str, object]) -> None:
    graph_json = json.dumps(graph, ensure_ascii=False)
    html = f"""<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>黑曜纪元 3D 知识图谱</title>
  <style>
    :root {{
      color-scheme: dark;
      --panel: rgba(5, 13, 12, .78);
      --line: rgba(113, 216, 196, .28);
      --text: #efe7d4;
      --muted: #9bbdb4;
    }}
    * {{ box-sizing: border-box; }}
    html, body, #graph {{ width: 100%; height: 100%; margin: 0; overflow: hidden; }}
    body {{
      background: radial-gradient(circle at 50% 40%, #102d29 0%, #071110 56%, #020403 100%);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif;
    }}
    #graph canvas {{ display: block; }}
    .topbar {{
      position: fixed;
      top: 18px;
      left: 18px;
      right: 380px;
      z-index: 2;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px;
      background: var(--panel);
      border: 1px solid #25433e;
      border-radius: 8px;
      backdrop-filter: blur(14px);
      box-shadow: 0 18px 50px rgba(0, 0, 0, .32);
    }}
    .brand {{
      font-weight: 700;
      white-space: nowrap;
      color: #f1dfb9;
      margin-right: 8px;
    }}
    input {{
      min-width: 220px;
      flex: 1;
      height: 34px;
      padding: 0 10px;
      border: 1px solid #315951;
      border-radius: 6px;
      background: #081514;
      color: var(--text);
      outline: none;
    }}
    button {{
      height: 34px;
      padding: 0 10px;
      border: 1px solid #3b6e63;
      border-radius: 6px;
      background: #132522;
      color: var(--text);
      cursor: pointer;
    }}
    button.active {{ background: #1f6b59; border-color: #64d6b8; }}
    .chips {{
      position: fixed;
      left: 18px;
      bottom: 18px;
      z-index: 2;
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      max-width: 760px;
      padding: 10px;
      background: var(--panel);
      border: 1px solid #25433e;
      border-radius: 8px;
      backdrop-filter: blur(14px);
    }}
    .chip {{
      display: inline-flex;
      align-items: center;
      gap: 6px;
      height: 28px;
      padding: 0 9px;
      border: 1px solid #315951;
      border-radius: 999px;
      color: #dbeee7;
      background: rgba(255,255,255,.04);
      font-size: 12px;
      cursor: pointer;
    }}
    .chip.off {{ opacity: .38; }}
    .dot {{ width: 9px; height: 9px; border-radius: 50%; display: inline-block; }}
    aside {{
      position: fixed;
      z-index: 3;
      top: 18px;
      right: 18px;
      width: 340px;
      max-height: calc(100vh - 36px);
      overflow: auto;
      background: var(--panel);
      border: 1px solid #25433e;
      border-radius: 8px;
      backdrop-filter: blur(16px);
      box-shadow: 0 18px 60px rgba(0, 0, 0, .42);
    }}
    .hero {{
      width: 100%;
      aspect-ratio: 16 / 9;
      background: linear-gradient(135deg, #102d29, #080f0e);
      object-fit: cover;
      border-bottom: 1px solid #25433e;
    }}
    .panel-body {{ padding: 14px 16px 16px; }}
    h1 {{ margin: 0 0 6px; font-size: 22px; line-height: 1.25; }}
    .meta {{ color: var(--muted); font-size: 13px; line-height: 1.55; }}
    .summary {{ margin-top: 12px; color: #d7e7e0; line-height: 1.65; font-size: 14px; }}
    .kv {{ margin-top: 14px; display: grid; gap: 8px; }}
    .kv div {{
      padding: 8px 9px;
      border: 1px solid rgba(80, 130, 119, .55);
      border-radius: 6px;
      background: rgba(255,255,255,.035);
      font-size: 13px;
      line-height: 1.5;
    }}
    .kv b {{ color: #f1dfb9; }}
    .legend-note {{
      margin-top: 12px;
      color: #8fb8ae;
      font-size: 12px;
      line-height: 1.55;
    }}
    .loading {{
      position: fixed;
      inset: 0;
      display: grid;
      place-items: center;
      color: #e9d7b6;
      background: #020403;
      z-index: 10;
      transition: opacity .35s ease;
      pointer-events: none;
    }}
    .loading.done {{ opacity: 0; }}
    @media (max-width: 900px) {{
      .topbar {{ right: 18px; flex-wrap: wrap; }}
      aside {{ top: auto; bottom: 92px; left: 18px; right: 18px; width: auto; max-height: 38vh; }}
      .chips {{ right: 18px; max-width: none; }}
    }}
  </style>
</head>
<body>
  <div id="loading" class="loading">加载 3D 知识图谱...</div>
  <div id="graph"></div>
  <div class="topbar">
    <div class="brand">黑曜纪元 3D 图谱</div>
    <input id="search" placeholder="搜索节点：孢雾巡猎者 / 雾绿腐生 / 星序族" />
    <button id="focusSpore">孢雾巡猎者</button>
    <button id="reset">重置</button>
  </div>
  <div id="chips" class="chips"></div>
  <aside id="panel">
    <div class="panel-body">
      <h1>选择一个节点</h1>
      <div class="meta">旋转、缩放或搜索图谱；点击节点后这里会展示设定信息、路径、frontmatter 与图片。</div>
      <p class="summary">当前图谱来自 Obsidian 双链，包含世界底层、种族、势力、异化生物、地点生态、基底气质和冲突关系。</p>
      <div class="legend-note">带真实图片的节点会显示为图片贴片；暂时只有已经关联素材的节点会使用真实图像。</div>
    </div>
  </aside>

  <script src="assets/vendor/three-0.160.1.min.js"></script>
  <script src="assets/vendor/three-spritetext-1.9.1.min.js"></script>
  <script src="assets/vendor/3d-force-graph-1.73.6.min.js"></script>
  <script>
    const sourceGraph = {graph_json};
    const fullNodes = sourceGraph.nodes;
    const fullLinks = sourceGraph.links;
    const typeLabels = sourceGraph.types;
    const activeTypes = new Set(Object.keys(typeLabels));
    const neighbors = new Map();
    const linkedPairs = new Set();
    let selectedNode = null;
    let searchText = '';

    fullNodes.forEach(node => neighbors.set(node.id, new Set()));
    fullLinks.forEach(link => {{
      neighbors.get(link.sourceId)?.add(link.targetId);
      neighbors.get(link.targetId)?.add(link.sourceId);
      linkedPairs.add(`${{link.sourceId}}->${{link.targetId}}`);
      linkedPairs.add(`${{link.targetId}}->${{link.sourceId}}`);
    }});

    const elem = document.getElementById('graph');
    const Graph = ForceGraph3D()(elem)
      .backgroundColor('#020403')
      .nodeId('id')
      .nodeLabel(node => `${{node.label}}\\n${{node.typeLabel}}\\n${{node.summary || ''}}`)
      .linkOpacity(.28)
      .linkWidth(link => Math.max(.35, Math.min(2.2, link.weight * .38)))
      .linkDirectionalParticles(link => selectedNode && (link.source.id === selectedNode.id || link.target.id === selectedNode.id) ? 2 : 0)
      .linkDirectionalParticleWidth(1.7)
      .linkColor(link => {{
        if (!selectedNode) return 'rgba(113, 216, 196, .34)';
        return link.source.id === selectedNode.id || link.target.id === selectedNode.id ? '#f4d38a' : 'rgba(113, 216, 196, .08)';
      }})
      .nodeThreeObject(node => buildNodeObject(node))
      .onNodeHover(node => elem.style.cursor = node ? 'pointer' : null)
      .onNodeClick(node => selectNode(node, true));

    Graph.d3Force('charge').strength(-86);
    Graph.d3Force('link').distance(link => 46 + Math.min(90, (link.weight || 1) * 9));

    const ambient = new THREE.AmbientLight(0x8fbeb4, 1.4);
    Graph.scene().add(ambient);
    const pointLight = new THREE.PointLight(0xb8fff0, 1.1, 900);
    pointLight.position.set(120, 220, 260);
    Graph.scene().add(pointLight);
    addStarfield();

    function buildNodeObject(node) {{
      const group = new THREE.Group();
      const degree = Math.max(1, node.degree || 1);
      const scale = 4.4 + Math.min(11, Math.sqrt(degree) * 2.1);
      if (node.image) {{
        const texture = new THREE.TextureLoader().load(node.image);
        texture.colorSpace = THREE.SRGBColorSpace;
        const material = new THREE.SpriteMaterial({{ map: texture, transparent: true, depthWrite: false }});
        const sprite = new THREE.Sprite(material);
        sprite.scale.set(scale * 2.4, scale * 2.4, 1);
        group.add(sprite);
        const haloGeo = new THREE.SphereGeometry(scale * 1.28, 32, 16);
        const haloMat = new THREE.MeshBasicMaterial({{ color: node.color, wireframe: true, transparent: true, opacity: .42 }});
        group.add(new THREE.Mesh(haloGeo, haloMat));
      }} else {{
        const geometry = new THREE.SphereGeometry(scale, 24, 16);
        const material = new THREE.MeshLambertMaterial({{
          color: node.color,
          emissive: node.color,
          emissiveIntensity: .22,
          transparent: true,
          opacity: .94
        }});
        group.add(new THREE.Mesh(geometry, material));
      }}
      const label = new SpriteText(node.label);
      label.color = '#efe7d4';
      label.textHeight = node.degree >= 5 || node.id === '黑曜纪元' || node.id === '诸天裂灾' ? 4.8 : 3.1;
      label.backgroundColor = 'rgba(2, 4, 3, .48)';
      label.padding = 1.6;
      label.borderRadius = 3;
      label.position.y = -scale * 1.75;
      group.add(label);
      return group;
    }}

    function addStarfield() {{
      const geometry = new THREE.BufferGeometry();
      const count = 900;
      const positions = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {{
        positions[i * 3] = (Math.random() - .5) * 1400;
        positions[i * 3 + 1] = (Math.random() - .5) * 1400;
        positions[i * 3 + 2] = (Math.random() - .5) * 1400;
      }}
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const material = new THREE.PointsMaterial({{ color: 0x6dd6c3, size: .8, transparent: true, opacity: .35 }});
      Graph.scene().add(new THREE.Points(geometry, material));
    }}

    function showPanel(node) {{
      const panel = document.getElementById('panel');
      const fm = node.frontmatter || {{}};
      const rows = [];
      const push = (label, value) => {{
        if (Array.isArray(value) && value.length) rows.push(`<div><b>${{label}}</b><br>${{value.join(' / ')}}</div>`);
        else if (value) rows.push(`<div><b>${{label}}</b><br>${{value}}</div>`);
      }};
      push('类型', node.typeLabel);
      push('路径', node.path);
      push('连接度', node.degree);
      push('基底', fm.base);
      push('栖息地', fm.habitat);
      push('威胁等级', fm.threat);
      push('状态', fm.status);
      panel.innerHTML = `
        ${{node.image ? `<img class="hero" src="${{node.image}}" alt="${{node.label}}">` : ''}}
        <div class="panel-body">
          <h1>${{node.label}}</h1>
          <div class="meta">${{node.typeLabel}} · ${{node.degree}} 条连接</div>
          <p class="summary">${{node.summary || '这个节点目前是关系占位，可继续扩写设定正文。'}}</p>
          <div class="kv">${{rows.join('')}}</div>
          <div class="legend-note">相邻节点数量：${{neighbors.get(node.id)?.size || 0}}。图片节点来自笔记中的 Obsidian 图片嵌入。</div>
        </div>`;
    }}

    function selectNode(node, moveCamera) {{
      selectedNode = node;
      showPanel(node);
      Graph.linkDirectionalParticles(Graph.linkDirectionalParticles());
      Graph.linkColor(Graph.linkColor());
      if (moveCamera) {{
        const distance = 150;
        const distRatio = 1 + distance / Math.hypot(node.x || 1, node.y || 1, node.z || 1);
        Graph.cameraPosition(
          {{ x: (node.x || 1) * distRatio, y: (node.y || 1) * distRatio, z: (node.z || 1) * distRatio }},
          node,
          1000
        );
      }}
    }}

    function filteredGraph() {{
      const query = searchText.trim().toLowerCase();
      const visible = new Set(
        fullNodes
          .filter(node => activeTypes.has(node.type))
          .filter(node => !query || node.label.toLowerCase().includes(query) || node.summary.toLowerCase().includes(query))
          .map(node => node.id)
      );
      if (query) {{
        [...visible].forEach(id => neighbors.get(id)?.forEach(next => {{
          const node = fullNodes.find(item => item.id === next);
          if (node && activeTypes.has(node.type)) visible.add(next);
        }}));
      }}
      return {{
        nodes: fullNodes.filter(node => visible.has(node.id)),
        links: fullLinks
          .filter(link => visible.has(link.sourceId) && visible.has(link.targetId))
          .map(link => ({{ source: link.sourceId, target: link.targetId, sourceId: link.sourceId, targetId: link.targetId, weight: link.weight }}))
      }};
    }}

    function applyFilters() {{
      selectedNode = null;
      Graph.graphData(filteredGraph());
    }}

    function buildChips() {{
      const chips = document.getElementById('chips');
      Object.entries(typeLabels).forEach(([type, label]) => {{
        const color = fullNodes.find(node => node.type === type)?.color || '#cbd5e1';
        const chip = document.createElement('button');
        chip.className = 'chip';
        chip.innerHTML = `<span class="dot" style="background:${{color}}"></span>${{label}}`;
        chip.addEventListener('click', () => {{
          if (activeTypes.has(type)) activeTypes.delete(type);
          else activeTypes.add(type);
          chip.classList.toggle('off', !activeTypes.has(type));
          applyFilters();
        }});
        chips.appendChild(chip);
      }});
    }}

    document.getElementById('search').addEventListener('input', event => {{
      searchText = event.target.value;
      applyFilters();
    }});

    document.getElementById('reset').addEventListener('click', () => {{
      searchText = '';
      document.getElementById('search').value = '';
      selectedNode = null;
      activeTypes.clear();
      Object.keys(typeLabels).forEach(type => activeTypes.add(type));
      document.querySelectorAll('.chip').forEach(chip => chip.classList.remove('off'));
      applyFilters();
      Graph.cameraPosition({{ x: 0, y: 0, z: 520 }}, {{ x: 0, y: 0, z: 0 }}, 900);
    }});

    document.getElementById('focusSpore').addEventListener('click', () => {{
      searchText = '孢雾巡猎者';
      document.getElementById('search').value = searchText;
      applyFilters();
      setTimeout(() => {{
        const node = Graph.graphData().nodes.find(item => item.id === '孢雾巡猎者');
        if (node) selectNode(node, true);
      }}, 500);
    }});

    buildChips();
    applyFilters();
    setTimeout(() => {{
      document.getElementById('loading').classList.add('done');
      const node = Graph.graphData().nodes.find(item => item.id === '孢雾巡猎者');
      if (node) selectNode(node, false);
    }}, 800);
  </script>
</body>
</html>
"""
    HTML_OUT.write_text(html, encoding="utf-8")


def ensure_local_vendor_assets() -> None:
    missing = [str(path.relative_to(ROOT)) for path in LOCAL_VENDOR_ASSETS.values() if not path.exists()]
    if missing:
        missing_list = "\n".join(f"- {path}" for path in missing)
        raise FileNotFoundError(f"Missing local vendor assets:\n{missing_list}")


def main() -> None:
    ensure_local_vendor_assets()
    graph = build_graph()
    JSON_OUT.write_text(json.dumps(graph, ensure_ascii=False, indent=2), encoding="utf-8")
    write_html(graph)
    print(f"wrote {HTML_OUT}")
    print(f"wrote {JSON_OUT}")
    print(f"nodes={len(graph['nodes'])} links={len(graph['links'])}")
    print(f"image_nodes={sum(1 for node in graph['nodes'] if node['hasImage'])}")


if __name__ == "__main__":
    main()
