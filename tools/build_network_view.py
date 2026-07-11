from __future__ import annotations

import json
import math
import random
import re
from collections import Counter, defaultdict
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "00_总览"
SVG_OUT = OUT_DIR / "黑曜纪元知识图谱网状视图.svg"
HTML_OUT = OUT_DIR / "黑曜纪元知识图谱网状视图.html"
JSON_OUT = OUT_DIR / "graph-data.json"

EXCLUDED_DIRS = {".git", ".obsidian", "09_素材与图片", "tools"}
WIDTH = 1800
HEIGHT = 1200


def clean_target(target: str) -> str:
    return target.split("|", 1)[0].split("#", 1)[0].strip()


def note_type(path: Path) -> str:
    parts = path.relative_to(ROOT).parts
    folder = parts[0] if parts else ""
    mapping = {
        "00_总览": "overview",
        "01_世界底层": "world",
        "02_种族": "race",
        "03_势力组织": "faction",
        "04_异化生物": "creature",
        "05_地点生态": "place",
        "06_事件剧情": "event",
        "07_基底气质": "base",
        "08_关系网络": "relation",
        "_templates": "template",
    }
    return mapping.get(folder, "node")


def read_graph() -> tuple[list[dict[str, object]], list[dict[str, str]]]:
    note_paths = []
    for path in ROOT.rglob("*.md"):
        if any(part in EXCLUDED_DIRS for part in path.relative_to(ROOT).parts):
            continue
        note_paths.append(path)

    notes = {path.stem: path for path in note_paths}
    link_counter: Counter[tuple[str, str]] = Counter()

    for path in note_paths:
        text = path.read_text(encoding="utf-8")
        source = path.stem
        for raw_target in re.findall(r"\[\[([^\]]+)\]\]", text):
            target = clean_target(raw_target)
            if not target or target == source or target not in notes:
                continue
            link_counter[(source, target)] += 1

    degree: Counter[str] = Counter()
    for (source, target), weight in link_counter.items():
        degree[source] += weight
        degree[target] += weight

    nodes = []
    for name, path in sorted(notes.items()):
        if note_type(path) == "template":
            continue
        nodes.append(
            {
                "id": name,
                "label": name,
                "type": note_type(path),
                "path": str(path.relative_to(ROOT)),
                "degree": degree[name],
            }
        )

    node_ids = {node["id"] for node in nodes}
    links = [
        {"source": source, "target": target, "weight": weight}
        for (source, target), weight in sorted(link_counter.items())
        if source in node_ids and target in node_ids
    ]
    return nodes, links


def layout(nodes: list[dict[str, object]], links: list[dict[str, str]]) -> dict[str, tuple[float, float]]:
    random.seed(20260604)
    cluster_centers = {
        "world": (WIDTH * 0.50, HEIGHT * 0.18),
        "overview": (WIDTH * 0.50, HEIGHT * 0.06),
        "race": (WIDTH * 0.24, HEIGHT * 0.48),
        "faction": (WIDTH * 0.74, HEIGHT * 0.48),
        "creature": (WIDTH * 0.25, HEIGHT * 0.80),
        "place": (WIDTH * 0.50, HEIGHT * 0.88),
        "base": (WIDTH * 0.50, HEIGHT * 0.55),
        "event": (WIDTH * 0.50, HEIGHT * 0.73),
        "relation": (WIDTH * 0.78, HEIGHT * 0.80),
        "node": (WIDTH * 0.50, HEIGHT * 0.50),
    }

    grouped: dict[str, list[dict[str, object]]] = defaultdict(list)
    for node in nodes:
        grouped[str(node["type"])].append(node)

    pos: dict[str, tuple[float, float]] = {}
    for group, group_nodes in grouped.items():
        cx, cy = cluster_centers.get(group, cluster_centers["node"])
        count = len(group_nodes)
        radius = max(70, min(240, 32 * math.sqrt(max(count, 1))))
        for index, node in enumerate(sorted(group_nodes, key=lambda item: (-int(item["degree"]), str(item["id"])))):
            angle = 2 * math.pi * index / max(count, 1)
            ring = radius * (0.45 + 0.55 * ((index % 7) / 6 if count > 7 else 1))
            jitter_x = random.uniform(-28, 28)
            jitter_y = random.uniform(-28, 28)
            pos[str(node["id"])] = (cx + math.cos(angle) * ring + jitter_x, cy + math.sin(angle) * ring + jitter_y)

    adjacency: dict[str, set[str]] = defaultdict(set)
    for link in links:
        adjacency[str(link["source"])].add(str(link["target"]))
        adjacency[str(link["target"])].add(str(link["source"]))

    # A small deterministic force pass makes cross-cluster links feel more organic.
    ids = [str(node["id"]) for node in nodes]
    for _ in range(180):
        delta = {node_id: [0.0, 0.0] for node_id in ids}

        for i, a in enumerate(ids):
            ax, ay = pos[a]
            for b in ids[i + 1 :]:
                bx, by = pos[b]
                dx = ax - bx
                dy = ay - by
                dist2 = max(dx * dx + dy * dy, 1200)
                force = 9000 / dist2
                length = math.sqrt(dist2)
                fx = force * dx / length
                fy = force * dy / length
                delta[a][0] += fx
                delta[a][1] += fy
                delta[b][0] -= fx
                delta[b][1] -= fy

        for link in links:
            source = str(link["source"])
            target = str(link["target"])
            sx, sy = pos[source]
            tx, ty = pos[target]
            dx = tx - sx
            dy = ty - sy
            dist = max(math.sqrt(dx * dx + dy * dy), 1)
            desired = 145
            force = (dist - desired) * 0.003 * min(int(link["weight"]), 3)
            fx = force * dx / dist
            fy = force * dy / dist
            delta[source][0] += fx
            delta[source][1] += fy
            delta[target][0] -= fx
            delta[target][1] -= fy

        for node in nodes:
            node_id = str(node["id"])
            group = str(node["type"])
            cx, cy = cluster_centers.get(group, cluster_centers["node"])
            x, y = pos[node_id]
            delta[node_id][0] += (cx - x) * 0.012
            delta[node_id][1] += (cy - y) * 0.012

        for node_id in ids:
            x, y = pos[node_id]
            dx, dy = delta[node_id]
            pos[node_id] = (
                min(WIDTH - 70, max(70, x + max(-12, min(12, dx)))),
                min(HEIGHT - 70, max(70, y + max(-12, min(12, dy)))),
            )

    return pos


COLORS = {
    "overview": "#d6c08d",
    "world": "#9ec5ff",
    "race": "#8fd3a8",
    "faction": "#e6a879",
    "creature": "#62c7a4",
    "place": "#94a3b8",
    "event": "#c4b5fd",
    "base": "#5eead4",
    "relation": "#f0abfc",
    "node": "#cbd5e1",
}


LABELS = {
    "overview": "总览",
    "world": "世界底层",
    "race": "种族",
    "faction": "势力组织",
    "creature": "异化生物",
    "place": "地点生态",
    "event": "事件剧情",
    "base": "基底气质",
    "relation": "关系网络",
    "node": "节点",
}


def escape(text: object) -> str:
    return (
        str(text)
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def write_svg(nodes: list[dict[str, object]], links: list[dict[str, str]], pos: dict[str, tuple[float, float]]) -> None:
    top_nodes = {str(node["id"]) for node in sorted(nodes, key=lambda item: -int(item["degree"]))[:80]}
    lines = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{WIDTH}" height="{HEIGHT}" viewBox="0 0 {WIDTH} {HEIGHT}">',
        "<defs>",
        '<radialGradient id="bg" cx="50%" cy="45%" r="70%"><stop offset="0%" stop-color="#102b28"/><stop offset="55%" stop-color="#081312"/><stop offset="100%" stop-color="#030605"/></radialGradient>',
        '<filter id="glow"><feGaussianBlur stdDeviation="3" result="coloredBlur"/><feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>',
        "</defs>",
        '<rect width="100%" height="100%" fill="url(#bg)"/>',
        '<text x="60" y="70" fill="#e8dcc2" font-size="34" font-family="PingFang SC, Heiti SC, sans-serif" font-weight="700">黑曜纪元知识图谱网状视图</text>',
        '<text x="60" y="104" fill="#91bdb2" font-size="18" font-family="PingFang SC, Heiti SC, sans-serif">由 Obsidian 双链生成：世界底层、种族、势力、异化生物、地点、基底与关系网络</text>',
        '<g opacity="0.42">',
    ]
    for link in links:
        sx, sy = pos[str(link["source"])]
        tx, ty = pos[str(link["target"])]
        width = 0.65 + min(int(link["weight"]), 4) * 0.25
        lines.append(f'<line x1="{sx:.1f}" y1="{sy:.1f}" x2="{tx:.1f}" y2="{ty:.1f}" stroke="#7dd3c7" stroke-width="{width:.2f}"/>')
    lines.append("</g>")

    for node in nodes:
        node_id = str(node["id"])
        x, y = pos[node_id]
        color = COLORS.get(str(node["type"]), COLORS["node"])
        radius = 5 + min(12, math.sqrt(max(int(node["degree"]), 1)) * 2.1)
        lines.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{radius:.1f}" fill="{color}" stroke="#f8ecd2" stroke-width="0.8" opacity="0.95" filter="url(#glow)"/>')
        if node_id in top_nodes or int(node["degree"]) >= 4:
            lines.append(f'<text x="{x + radius + 5:.1f}" y="{y + 4:.1f}" fill="#efe7d4" font-size="14" font-family="PingFang SC, Heiti SC, sans-serif">{escape(node_id)}</text>')

    legend_x = WIDTH - 280
    legend_y = 62
    lines.append(f'<g transform="translate({legend_x},{legend_y})">')
    lines.append('<rect x="-24" y="-28" width="250" height="300" rx="14" fill="#07100f" opacity="0.72" stroke="#31534e"/>')
    lines.append('<text x="0" y="0" fill="#e8dcc2" font-size="18" font-family="PingFang SC, Heiti SC, sans-serif" font-weight="700">图例</text>')
    for index, (node_type, label) in enumerate(LABELS.items()):
        y = 30 + index * 26
        lines.append(f'<circle cx="8" cy="{y}" r="7" fill="{COLORS[node_type]}"/>')
        lines.append(f'<text x="26" y="{y + 5}" fill="#d7e5df" font-size="14" font-family="PingFang SC, Heiti SC, sans-serif">{label}</text>')
    lines.append("</g>")
    lines.append("</svg>")
    SVG_OUT.write_text("\n".join(lines), encoding="utf-8")


def write_html(nodes: list[dict[str, object]], links: list[dict[str, str]], pos: dict[str, tuple[float, float]]) -> None:
    graph = {
        "nodes": [{**node, "x": pos[str(node["id"])][0], "y": pos[str(node["id"])][1], "color": COLORS.get(str(node["type"]), COLORS["node"]), "typeLabel": LABELS.get(str(node["type"]), "节点")} for node in nodes],
        "links": links,
    }
    JSON_OUT.write_text(json.dumps(graph, ensure_ascii=False, indent=2), encoding="utf-8")
    html = f"""<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>黑曜纪元知识图谱网状视图</title>
  <style>
    body {{ margin: 0; background: #030605; color: #efe7d4; font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif; overflow: hidden; }}
    #toolbar {{ position: fixed; left: 20px; top: 18px; display: flex; gap: 10px; align-items: center; z-index: 2; background: rgba(3, 8, 7, .76); border: 1px solid #25443e; border-radius: 8px; padding: 10px 12px; backdrop-filter: blur(12px); }}
    input {{ width: 260px; color: #efe7d4; background: #0a1614; border: 1px solid #2e514a; border-radius: 6px; padding: 8px 10px; outline: none; }}
    button {{ color: #efe7d4; background: #132522; border: 1px solid #3c6b61; border-radius: 6px; padding: 8px 10px; cursor: pointer; }}
    #meta {{ position: fixed; right: 20px; top: 18px; z-index: 2; width: 280px; background: rgba(3, 8, 7, .78); border: 1px solid #25443e; border-radius: 8px; padding: 12px 14px; line-height: 1.55; }}
    #meta h1 {{ margin: 0 0 6px; font-size: 18px; }}
    #meta p {{ margin: 0; color: #a8c8bf; font-size: 13px; }}
    svg {{ width: 100vw; height: 100vh; display: block; background: radial-gradient(circle at 50% 45%, #102b28 0%, #081312 52%, #030605 100%); }}
    .edge {{ stroke: #7dd3c7; stroke-opacity: .28; }}
    .node {{ cursor: pointer; stroke: #f8ecd2; stroke-width: .8; }}
    .label {{ pointer-events: none; fill: #efe7d4; font-size: 13px; paint-order: stroke; stroke: #030605; stroke-width: 3px; }}
    .muted {{ opacity: .1; }}
    .hit {{ opacity: 1; stroke: #fff1b8; stroke-width: 3; }}
  </style>
</head>
<body>
  <div id="toolbar">
    <input id="search" placeholder="搜索节点，例如：孢雾巡猎者、雾绿腐生、星序族" />
    <button id="reset">重置视图</button>
  </div>
  <aside id="meta">
    <h1>黑曜纪元知识图谱</h1>
    <p>{len(nodes)} 个节点，{len(links)} 条关系。滚轮缩放，拖拽平移；点击节点可查看名称与路径。</p>
  </aside>
  <svg id="graph" viewBox="0 0 {WIDTH} {HEIGHT}" role="img" aria-label="黑曜纪元知识图谱网状视图"></svg>
  <script>
    const graph = {json.dumps(graph, ensure_ascii=False)};
    const svg = document.getElementById('graph');
    const NS = 'http://www.w3.org/2000/svg';
    const viewport = document.createElementNS(NS, 'g');
    svg.appendChild(viewport);

    const links = new Map();
    graph.links.forEach((link, i) => {{
      const source = graph.nodes.find(n => n.id === link.source);
      const target = graph.nodes.find(n => n.id === link.target);
      if (!source || !target) return;
      const line = document.createElementNS(NS, 'line');
      line.setAttribute('x1', source.x);
      line.setAttribute('y1', source.y);
      line.setAttribute('x2', target.x);
      line.setAttribute('y2', target.y);
      line.setAttribute('stroke-width', 0.7 + Math.min(link.weight, 4) * 0.3);
      line.classList.add('edge');
      viewport.appendChild(line);
      links.set(`${{link.source}}->${{link.target}}`, line);
    }});

    const nodeEls = new Map();
    const labelEls = new Map();
    graph.nodes.forEach(node => {{
      const g = document.createElementNS(NS, 'g');
      const radius = 5 + Math.min(13, Math.sqrt(Math.max(node.degree, 1)) * 2.1);
      const circle = document.createElementNS(NS, 'circle');
      circle.setAttribute('cx', node.x);
      circle.setAttribute('cy', node.y);
      circle.setAttribute('r', radius);
      circle.setAttribute('fill', node.color);
      circle.classList.add('node');
      const title = document.createElementNS(NS, 'title');
      title.textContent = `${{node.label}}\\n${{node.typeLabel}}\\n${{node.path}}`;
      circle.appendChild(title);
      g.appendChild(circle);
      if (node.degree >= 3 || ['黑曜纪元','诸天裂灾','孢雾巡猎者','雾绿腐生'].includes(node.id)) {{
        const text = document.createElementNS(NS, 'text');
        text.setAttribute('x', node.x + radius + 5);
        text.setAttribute('y', node.y + 4);
        text.textContent = node.label;
        text.classList.add('label');
        g.appendChild(text);
        labelEls.set(node.id, text);
      }}
      circle.addEventListener('click', () => {{
        document.getElementById('meta').innerHTML = `<h1>${{node.label}}</h1><p>类型：${{node.typeLabel}}<br>连接度：${{node.degree}}<br>路径：${{node.path}}</p>`;
      }});
      viewport.appendChild(g);
      nodeEls.set(node.id, circle);
    }});

    let view = {{ x: 0, y: 0, k: 1 }};
    function applyView() {{ viewport.setAttribute('transform', `translate(${{view.x}} ${{view.y}}) scale(${{view.k}})`); }}
    let dragging = false, last = null;
    svg.addEventListener('mousedown', e => {{ dragging = true; last = [e.clientX, e.clientY]; }});
    window.addEventListener('mouseup', () => dragging = false);
    window.addEventListener('mousemove', e => {{
      if (!dragging) return;
      view.x += e.clientX - last[0];
      view.y += e.clientY - last[1];
      last = [e.clientX, e.clientY];
      applyView();
    }});
    svg.addEventListener('wheel', e => {{
      e.preventDefault();
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      view.k = Math.max(0.35, Math.min(3.5, view.k * factor));
      applyView();
    }}, {{ passive: false }});
    document.getElementById('reset').addEventListener('click', () => {{ view = {{ x: 0, y: 0, k: 1 }}; applyView(); }});
    document.getElementById('search').addEventListener('input', e => {{
      const q = e.target.value.trim().toLowerCase();
      nodeEls.forEach((el, id) => {{
        const hit = q && id.toLowerCase().includes(q);
        el.classList.toggle('hit', Boolean(hit));
        el.classList.toggle('muted', Boolean(q && !hit));
      }});
      labelEls.forEach((el, id) => el.classList.toggle('muted', Boolean(q && !id.toLowerCase().includes(q))));
    }});
  </script>
</body>
</html>
"""
    HTML_OUT.write_text(html, encoding="utf-8")


def main() -> None:
    nodes, links = read_graph()
    pos = layout(nodes, links)
    write_svg(nodes, links, pos)
    write_html(nodes, links, pos)
    print(f"wrote {SVG_OUT}")
    print(f"wrote {HTML_OUT}")
    print(f"nodes={len(nodes)} links={len(links)}")


if __name__ == "__main__":
    main()
