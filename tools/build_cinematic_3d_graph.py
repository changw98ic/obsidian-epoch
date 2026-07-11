from __future__ import annotations

import base64
import json
import re
from collections import Counter
from io import BytesIO
from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "00_总览"
HTML_OUT = OUT_DIR / "黑曜纪元星图3D.html"
STRATEGIC_HTML_OUT = OUT_DIR / "黑曜纪元战略关系图.html"
JSON_OUT = OUT_DIR / "cinematic-3d-graph-data.json"
LEGACY_HTML_OUT = OUT_DIR / "黑曜纪元3D知识图谱.html"
VENDOR_DIR = OUT_DIR / "assets" / "vendor"
LOCAL_VENDOR_ASSETS = {
    "three": VENDOR_DIR / "three-0.160.1.min.js",
    "three-spritetext": VENDOR_DIR / "three-spritetext-1.9.1.min.js",
    "3d-force-graph": VENDOR_DIR / "3d-force-graph-1.73.6.min.js",
}

EXCLUDED_DIRS = {".git", ".obsidian", "tools"}
GRAPH_ENTITY_TYPES = {"world", "race", "faction", "creature", "place", "relation"}
NON_ENTITY_NOTE_NAMES = {"势力低级生物", "合并建议"}
RELATION_CLUSTER_TYPES = {"冲突轴", "整理建议", "主轴规划", "索引节点"}
DISPLAY_PLACE_ANCHORS = {
    "城市管道",
    "深海尸骸",
    "山海森林",
    "工业废液",
    "非三维空间",
    "高空低轨",
    "腐化森林",
}
INTERNAL_BASE_TERMS = [
    "暗金",
    "钻石白",
    "月白青墨",
    "血红",
    "骨白灰",
    "深黑不可名状",
    "雾绿腐生",
    "幽紫王权",
    "锈黑",
    "视觉基底",
    "视觉基底索引",
    "基底气质",
    "世界关系可视化",
    "合并建议",
    "优先主轴",
]

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
    "overview": "#d7c08b",
    "world": "#8fb9ff",
    "race": "#74d99a",
    "faction": "#f0a16a",
    "creature": "#42d7a5",
    "place": "#a6b0bf",
    "event": "#c7b0ff",
    "base": "#5eead4",
    "relation": "#f09cff",
    "node": "#cbd5e1",
}

FEATURED_CLUSTERS = {
    "core": ["黑曜纪元", "诸天裂灾"],
    "tech": ["高科技文明", "星序族", "云脑族", "白械天使"],
    "mine": ["赛博工业财团", "赛博工业文明", "废弃矿区", "神尸矿区"],
    "corruption": ["管巢族", "腐林", "原生异化生物", "黑书会", "血契贵族"],
    "hunt": ["湿谷", "梦蛹族", "星瘤裔", "孢雾巡猎者"],
    "faction_creatures": ["东方修行者", "丹鼎肉仙门", "百相妖庭", "丹瘤药鼠", "借面狸奴", "北欧原始神系", "霜巨原民", "冰腔雪虱"],
}

CLUSTER_LABELS = {
    "core": "核心",
    "tech": "科技文明",
    "mine": "神尸矿区",
    "corruption": "管巢腐林",
    "hunt": "异化巡猎链",
    "faction_creatures": "势力附庸链",
    "conflict": "冲突关系",
}

SEMANTIC_COLORS = {
    "core": "#d7bd84",
    "tech": "#7fa6ff",
    "mine": "#d58a52",
    "corruption": "#c7ccd8",
    "hunt": "#44e0a4",
    "faction_creatures": "#66d9e8",
    "conflict": "#f09cff",
    "archive": "#7f8a99",
}

RACE_PARENT_BY_TYPE = {
    "高科技种族": "高科技文明",
    "赛博工业种族": "赛博工业文明",
    "克苏鲁眷族": "克苏鲁眷族",
    "诡秘种族": "所有神秘体系",
}

CREATURE_PARENT_BY_SOURCE_SECTION = {
    "10.1": "城市管道",
    "城市": "城市管道",
    "10.2": "深海尸骸",
    "深海": "深海尸骸",
    "10.3": "山海森林",
    "森林": "山海森林",
    "山海": "山海森林",
    "10.4": "神尸矿区",
    "矿区": "神尸矿区",
    "10.5": "非三维空间",
    "星外": "非三维空间",
}

SEMANTIC_EDGES = [
    ("黑曜纪元", "诸天裂灾", "母事件"),
    ("黑曜纪元", "高科技文明", "文明体系"),
    ("黑曜纪元", "赛博工业文明", "文明体系"),
    ("黑曜纪元", "克苏鲁眷族", "文明体系"),
    ("黑曜纪元", "东方修行者", "文明体系"),
    ("黑曜纪元", "西方魔法师", "文明体系"),
    ("黑曜纪元", "北欧原始神系", "文明体系"),
    ("黑曜纪元", "原生异化生物", "生命谱系"),
    ("高科技文明", "星序族", "族群"),
    ("高科技文明", "云脑族", "族群"),
    ("高科技文明", "白械天使", "造物"),
    ("赛博工业文明", "锈裔", "族群"),
    ("赛博工业文明", "肉件族", "族群"),
    ("赛博工业文明", "管巢族", "族群"),
    ("赛博工业财团", "孢雾巡猎者", "采集孢囊"),
    ("克苏鲁眷族", "渊眠族", "眷族"),
    ("克苏鲁眷族", "梦蛹族", "眷族"),
    ("克苏鲁眷族", "星瘤裔", "眷族"),
    ("东方修行者", "斩念剑庭", "宗门"),
    ("东方修行者", "万机符宗", "宗门"),
    ("东方修行者", "丹鼎肉仙门", "宗门"),
    ("东方修行者", "百相妖庭", "妖族联盟"),
    ("西方魔法师", "白塔秘法学院", "学院"),
    ("西方魔法师", "黑书会", "秘社"),
    ("西方魔法师", "血契贵族", "血脉"),
    ("北欧原始神系", "霜巨原民", "部族"),
    ("北欧原始神系", "狼灾血裔", "部族"),
    ("北欧原始神系", "根下三女巫", "巫群"),
    ("原生异化生物", "孢雾巡猎者", "物种"),
    ("孢雾巡猎者", "腐林", "栖息地"),
    ("孢雾巡猎者", "湿谷", "巡猎链"),
    ("孢雾巡猎者", "废弃矿区", "栖息地"),
    ("孢雾巡猎者", "神尸矿区", "边缘生态"),
    ("高科技文明", "赛博工业财团", "技术输送"),
    ("赛博工业财团", "神尸矿区", "矿区开发"),
    ("神尸矿区", "腐林", "污染扩散"),
    ("腐林", "湿谷", "生态侵蚀"),
    ("丹鼎肉仙门", "丹瘤药鼠", "试药耗材"),
    ("百相妖庭", "借面狸奴", "妖市侦察"),
    ("霜巨原民", "冰腔雪虱", "冰层共生"),
]

STORY_PATHS = [
    {
        "key": "place-creature",
        "label": "地点生态路径",
        "summary": "黑曜纪元 → 地点生态 → 具体生物",
        "nodes": ["黑曜纪元", "神尸矿区", "腐林", "湿谷", "孢雾巡猎者"],
    },
    {
        "key": "tech",
        "label": "科技扩散路径",
        "summary": "黑曜纪元 → 科技/工业文明 → 财团/造物 → 生物",
        "nodes": ["黑曜纪元", "高科技文明", "赛博工业文明", "赛博工业财团", "神尸矿区", "孢雾巡猎者"],
    },
    {
        "key": "cthulhu",
        "label": "克苏鲁污染路径",
        "summary": "黑曜纪元 → 克苏鲁相关 → 眷族/污染生物",
        "nodes": ["黑曜纪元", "克苏鲁眷族", "渊眠族", "梦蛹族", "星瘤裔", "孢雾巡猎者"],
    },
    {
        "key": "cultivation",
        "label": "东方修行路径",
        "summary": "黑曜纪元 → 修行文明 → 宗门/妖庭 → 附庸生物",
        "nodes": ["黑曜纪元", "东方修行者", "斩念剑庭", "万机符宗", "丹鼎肉仙门", "丹瘤药鼠", "百相妖庭", "借面狸奴"],
    },
    {
        "key": "magic",
        "label": "西方魔法路径",
        "summary": "黑曜纪元 → 魔法体系 → 学院/秘社/血脉 → 生物与修士",
        "nodes": ["黑曜纪元", "西方魔法师", "白塔秘法学院", "塔灯书蛾", "黑书会", "黑页书虱", "血契贵族"],
    },
    {
        "key": "norse",
        "label": "北欧原始路径",
        "summary": "黑曜纪元 → 北欧原始神系 → 部族/巫群 → 共生生物",
        "nodes": ["黑曜纪元", "北欧原始神系", "霜巨原民", "冰腔雪虱", "根下三女巫", "命线根蛛", "狼灾血裔"],
    },
]

CORE_NODE_NAMES = {"黑曜纪元"}


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
            data[key] = value.strip('"') if value else []
    return data


def first_summary(text: str) -> str:
    body = re.sub(r"^---\n.*?\n---\n", "", text, flags=re.S).strip()
    quote = re.search(r"^>\s*(.+)$", body, flags=re.M)
    if quote:
        return quote.group(1).strip()
    body = re.sub(r"^# .+$", "", body, flags=re.M)
    for paragraph in re.split(r"\n\s*\n", body):
        paragraph = paragraph.strip()
        if paragraph and not paragraph.startswith(("##", "```", "![[", "|")):
            return re.sub(r"\s+", " ", paragraph)[:240]
    return ""


def clean_markdown(text: str) -> str:
    text = re.sub(r"!\[\[[^\]]+\]\]", "", text)
    text = re.sub(r"\[\[([^|\]]+)\|([^\]]+)\]\]", r"\2", text)
    text = re.sub(r"\[\[([^\]]+)\]\]", r"\1", text)
    text = re.sub(r"`([^`]+)`", r"\1", text)
    text = re.sub(r"\*\*([^*]+)\*\*", r"\1", text)
    text = re.sub(r"^[-*]\s+", "", text, flags=re.M)
    return re.sub(r"\s+", " ", text).strip()


def scrub_internal_metadata(text: str) -> str:
    text = clean_markdown(text)
    text = re.sub(r"基底：.*?(?=(分类：|来源章节：|栖息地：|可能冲突：|可被利用：|$))", "", text)
    text = re.sub(r"推荐基底：.*?(?=(分类：|来源章节：|栖息地：|可能冲突：|可被利用：|$))", "", text)
    text = re.sub(r"来源章节：\S+", "", text)
    for term in INTERNAL_BASE_TERMS:
        text = text.replace(term, "")
    text = re.sub(r"适合\s*基底", "", text)
    text = re.sub(r"推荐\s*基底", "", text)
    text = re.sub(r"\s*/\s*/\s*", " / ", text)
    text = re.sub(r"、\s*、", "、", text)
    text = re.sub(r"\s+", " ", text)
    text = re.sub(r"：\s+(?=(分类|来源|栖息地|可能冲突|可被利用)：)", " ", text)
    return text.strip(" 、/；，。")


def public_text(value: object) -> str:
    return scrub_internal_metadata(str(value)) if value else ""


def public_status(value: object) -> str:
    status = public_text(value)
    return "" if status == "占位" else status


def extract_sections(text: str) -> dict[str, str]:
    body = re.sub(r"^---\n.*?\n---\n", "", text, flags=re.S).strip()
    matches = list(re.finditer(r"^##\s+(.+)$", body, flags=re.M))
    sections: dict[str, str] = {}
    for index, match in enumerate(matches):
        title = match.group(1).strip()
        start = match.end()
        end = matches[index + 1].start() if index + 1 < len(matches) else len(body)
        value = clean_markdown(body[start:end].strip())
        if value:
            sections[title] = value
    return sections


def pick_section(sections: dict[str, str], *names: str) -> str:
    for name in names:
        if name in sections:
            return sections[name]
    return ""


def compact_list(value: object) -> list[str]:
    if isinstance(value, list):
        items = value
    elif value:
        items = re.split(r"\s*/\s*|\s*、\s*|\s*,\s*", str(value))
    else:
        items = []
    cleaned = []
    for item in items:
        item = scrub_internal_metadata(str(item)).strip()
        if item and item not in cleaned:
            cleaned.append(item)
    return cleaned


_RELATION_SIDE_NAMES: set[str] | None = None


def relation_side_names() -> set[str]:
    global _RELATION_SIDE_NAMES
    if _RELATION_SIDE_NAMES is not None:
        return _RELATION_SIDE_NAMES
    names: set[str] = set()
    relation_dir = ROOT / "08_关系网络"
    if relation_dir.exists():
        for path in relation_dir.glob("*.md"):
            text = path.read_text(encoding="utf-8")
            fm = parse_frontmatter(text)
            if public_text(fm.get("type")) != "冲突轴":
                continue
            for side in compact_list(fm.get("sides")):
                side_id = clean_target(side)
                if side_id:
                    names.add(side_id)
    _RELATION_SIDE_NAMES = names
    return names


def include_graph_note(path: Path) -> bool:
    if path.stem in NON_ENTITY_NOTE_NAMES:
        return False
    node_type = note_type(path)
    if node_type not in GRAPH_ENTITY_TYPES:
        return False
    text = path.read_text(encoding="utf-8")
    fm = parse_frontmatter(text)
    is_display_place_anchor = node_type == "place" and path.stem in DISPLAY_PLACE_ANCHORS
    if public_text(fm.get("status")) == "占位" and cluster_for(path.stem, node_type, fm) == "archive" and not is_display_place_anchor:
        return False
    return True


def resolve_image_reference(value: object) -> Path | None:
    if not value:
        return None
    filename = str(value).strip().strip('"')
    filename = re.sub(r"^!?\[\[", "", filename)
    filename = re.sub(r"\]\]$", "", filename)
    filename = clean_target(filename)
    if not filename:
        return None
    candidates = list(ROOT.rglob(filename))
    return candidates[0] if candidates else None


def resolve_embed_images(text: str) -> list[Path]:
    images: list[Path] = []
    for match in re.finditer(r"!\[\[([^\]]+\.(?:png|jpe?g|webp|gif))(?:\|[^\]]*)?\]\]", text, flags=re.I):
        path = resolve_image_reference(match.group(1))
        if path and path not in images:
            images.append(path)
    return images


def image_label(path: Path) -> str:
    name = path.stem
    if "概念" in name or "三视图" in name:
        return "三视图"
    if "档案" in name:
        return "档案卡"
    if "节点" in name or "正面" in name:
        return "节点图"
    return "图片"


def resolve_graph_images(text: str, frontmatter: dict[str, object]) -> tuple[Path | None, Path | None, list[Path]]:
    embeds = resolve_embed_images(text)
    node_image = resolve_image_reference(frontmatter.get("node_image"))
    panel_image = resolve_image_reference(frontmatter.get("panel_image"))
    if not node_image and embeds:
        node_image = embeds[0]
    if not panel_image:
        panel_image = embeds[1] if len(embeds) > 1 else node_image
    gallery_images = [path for path in embeds if path != node_image]
    if panel_image and panel_image not in gallery_images:
        gallery_images.insert(0, panel_image)
    return node_image, panel_image, gallery_images


def data_uri(image: Image.Image, image_format: str = "PNG", **save_kwargs: object) -> str:
    out = BytesIO()
    image.save(out, format=image_format, **save_kwargs)
    mime = "image/png" if image_format.upper() == "PNG" else "image/jpeg"
    return f"data:{mime};base64," + base64.b64encode(out.getvalue()).decode("ascii")


def transparent_node_image_uri(path: Path) -> str:
    with Image.open(path) as image:
        image = image.convert("RGBA")
        width, height = image.size
        side = min(width, height)
        left = (width - side) // 2
        top = (height - side) // 2
        image = image.crop((left, top, left + side, top + side))
        image = image.resize((320, 320), Image.Resampling.LANCZOS)

        mask = Image.new("L", (320, 320), 0)
        pixels = mask.load()
        center = 159.5
        inner = 112.0
        outer = 159.5
        for y in range(320):
            for x in range(320):
                dist = ((x - center) ** 2 + (y - center) ** 2) ** 0.5
                if dist <= inner:
                    alpha = 255
                elif dist >= outer:
                    alpha = 0
                else:
                    alpha = int(255 * (1 - (dist - inner) / (outer - inner)) ** 1.7)
                pixels[x, y] = alpha

        image.putalpha(mask)
        return data_uri(image, "PNG", optimize=True)


def panel_image_uri(path: Path) -> str:
    with Image.open(path) as image:
        image = image.convert("RGB")
        image.thumbnail((960, 1280), Image.Resampling.LANCZOS)
        return data_uri(image, "JPEG", quality=88, optimize=True)


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


def cluster_for(name: str, node_type: str = "", frontmatter: dict[str, object] | None = None) -> str:
    if node_type == "relation" and public_text((frontmatter or {}).get("type")) in RELATION_CLUSTER_TYPES:
        return "conflict"
    for cluster, names in FEATURED_CLUSTERS.items():
        if name in names:
            return cluster
    if name in relation_side_names():
        return "conflict"
    return "archive"


def visual_rank_for(name: str, cluster: str, degree: int) -> str:
    if name in CORE_NODE_NAMES:
        return "core"
    if cluster == "conflict":
        return "secondary"
    if cluster != "archive":
        return "major"
    if degree >= 8:
        return "secondary"
    return "micro"


def relation_axis_links(notes: dict[str, Path]) -> list[dict[str, object]]:
    links: list[dict[str, object]] = []
    seen: set[tuple[str, str, str]] = set()
    for axis_name, path in notes.items():
        if note_type(path) != "relation":
            continue
        text = path.read_text(encoding="utf-8")
        fm = parse_frontmatter(text)
        if public_text(fm.get("type")) != "冲突轴":
            continue
        sides = []
        for side in compact_list(fm.get("sides")):
            side_id = clean_target(side)
            if side_id in notes and side_id != axis_name and side_id not in sides:
                sides.append(side_id)
        if len(sides) < 2:
            continue
        label = axis_name.replace("_vs_", " vs ")
        for index, source in enumerate(sides):
            for target in sides[index + 1 :]:
                key = (*sorted((source, target)), axis_name)
                if key in seen:
                    continue
                seen.add(key)
                links.append(
                    {
                        "source": source,
                        "target": target,
                        "sourceId": source,
                        "targetId": target,
                        "weight": 2,
                        "label": label,
                        "semantic": True,
                        "relationAxis": axis_name,
                    }
                )
    return links


def connected_names(edge_counter: Counter[tuple[str, str]]) -> set[str]:
    names: set[str] = set()
    for source, target in edge_counter:
        names.add(source)
        names.add(target)
    return names


def inferred_parent_for(name: str, path: Path, notes: dict[str, Path]) -> tuple[str, str] | None:
    text = path.read_text(encoding="utf-8")
    fm = parse_frontmatter(text)
    node_type = note_type(path)
    if node_type == "race":
        race_type = public_text(fm.get("type"))
        for marker, parent in RACE_PARENT_BY_TYPE.items():
            if marker in race_type and parent in notes and parent != name:
                return parent, "谱系归属"
    if node_type == "creature":
        for habitat in compact_list(fm.get("habitat")):
            habitat_id = clean_target(habitat)
            if habitat_id in notes and habitat_id != name:
                return habitat_id, "栖息地"
        source_section = public_text(fm.get("source_section"))
        hint = " ".join(
            [
                source_section,
                public_text(fm.get("ecology")),
                first_summary(text),
                name,
            ]
        )
        for marker, parent in CREATURE_PARENT_BY_SOURCE_SECTION.items():
            if marker in hint and parent in notes and parent != name:
                return parent, "来源生态"
    return None


def inferred_mount_links(notes: dict[str, Path], edge_counter: Counter[tuple[str, str]]) -> list[dict[str, object]]:
    links: list[dict[str, object]] = []
    connected = connected_names(edge_counter)
    for name, path in notes.items():
        if name in connected:
            continue
        parent = inferred_parent_for(name, path, notes)
        if not parent:
            continue
        source, label = parent
        links.append(
            {
                "source": source,
                "target": name,
                "sourceId": source,
                "targetId": name,
                "weight": 1,
                "label": label,
                "semantic": True,
                "inferred": True,
            }
        )
        edge_counter[(source, name)] += 1
        connected.add(source)
        connected.add(name)
    return links


def build_graph() -> dict[str, object]:
    note_paths = read_notes()
    notes = {path.stem: path for path in note_paths if include_graph_note(path)}
    edge_counter: Counter[tuple[str, str]] = Counter()

    for path in notes.values():
        text = path.read_text(encoding="utf-8")
        source = path.stem
        for raw_target in re.findall(r"\[\[([^\]]+)\]\]", text):
            target = clean_target(raw_target)
            if target in notes and target != source:
                edge_counter[(source, target)] += 1

    semantic_links = []
    for source, target, label in SEMANTIC_EDGES:
        if source in notes and target in notes:
            semantic_links.append({"source": source, "target": target, "sourceId": source, "targetId": target, "weight": 3, "label": label, "semantic": True})
            edge_counter[(source, target)] += 2
    for link in relation_axis_links(notes):
        semantic_links.append(link)
        edge_counter[(str(link["source"]), str(link["target"]))] += int(link["weight"])
    existing_pairs = {tuple(sorted((source, target))) for source, target in edge_counter}
    for path in STORY_PATHS:
        visible_nodes = [name for name in path["nodes"] if name in notes]
        for source, target in zip(visible_nodes, visible_nodes[1:]):
            pair = tuple(sorted((source, target)))
            if pair in existing_pairs:
                continue
            semantic_links.append(
                {
                    "source": source,
                    "target": target,
                    "sourceId": source,
                    "targetId": target,
                    "weight": 2,
                    "label": path["label"],
                    "semantic": True,
                    "routeKey": path["key"],
                }
            )
            edge_counter[(source, target)] += 2
            existing_pairs.add(pair)
    semantic_links.extend(inferred_mount_links(notes, edge_counter))

    degree: Counter[str] = Counter()
    for (source, target), weight in edge_counter.items():
        degree[source] += weight
        degree[target] += weight

    nodes = []
    for name, path in notes.items():
        text = path.read_text(encoding="utf-8")
        fm = parse_frontmatter(text)
        sections = extract_sections(text)
        node_image_path, panel_image_path, gallery_paths = resolve_graph_images(text, fm)
        node_image_uri = transparent_node_image_uri(node_image_path) if node_image_path else ""
        panel_image = panel_image_uri(panel_image_path) if panel_image_path else ""
        gallery = [
            {"label": image_label(gallery_path), "image": panel_image_uri(gallery_path)}
            for gallery_path in gallery_paths
        ]
        node_type = note_type(path)
        cluster = cluster_for(name, node_type, fm)
        details = {
            "relation": scrub_internal_metadata(pick_section(sections, "关系")),
            "appearance": scrub_internal_metadata(pick_section(sections, "外观", "外观与气质")),
            "ability": scrub_internal_metadata(pick_section(sections, "能力", "核心能力")),
            "weakness": scrub_internal_metadata(pick_section(sections, "弱点", "代价与弱点")),
            "story": scrub_internal_metadata(pick_section(sections, "剧情用途")),
            "habitat": compact_list(fm.get("habitat")),
            "weaknessTags": compact_list(fm.get("weakness")),
            "status": public_status(fm.get("status")),
            "threat": public_text(fm.get("threat")),
            "source": public_text(fm.get("source")),
        }
        public_frontmatter = {
            "type": public_text(fm.get("type")),
            "status": public_status(fm.get("status")),
            "source": public_text(fm.get("source")),
        }
        public_frontmatter = {key: value for key, value in public_frontmatter.items() if value}
        semantic_color = SEMANTIC_COLORS.get(cluster, TYPE_COLORS[node_type])
        visual_rank = visual_rank_for(name, cluster, degree[name])
        nodes.append(
            {
                "id": name,
                "label": name,
                "type": node_type,
                "typeLabel": TYPE_LABELS[node_type],
                "color": semantic_color,
                "typeColor": TYPE_COLORS[node_type],
                "path": str(path.relative_to(ROOT)),
                "degree": degree[name],
                "summary": scrub_internal_metadata(first_summary(text)),
                "frontmatter": public_frontmatter,
                "image": node_image_uri,
                "nodeImage": node_image_uri,
                "panelImage": panel_image,
                "gallery": gallery,
                "hasImage": bool(node_image_uri),
                "details": details,
                "featured": name in CORE_NODE_NAMES or (cluster != "archive" and degree[name] > 0),
                "visualRank": visual_rank,
                "defaultLabel": visual_rank in {"core", "major"},
                "cluster": cluster,
                "clusterLabel": CLUSTER_LABELS.get(cluster, "档案层"),
            }
        )

    node_ids = {node["id"] for node in nodes}
    links = [
        {"source": source, "target": target, "sourceId": source, "targetId": target, "weight": weight, "label": "", "semantic": False}
        for (source, target), weight in edge_counter.items()
        if source in node_ids and target in node_ids
    ]

    # Prefer the curated semantic edge when a normal note link covers the same pair.
    semantic_pairs = {tuple(sorted((link["source"], link["target"]))) for link in semantic_links}
    links = [link for link in links if tuple(sorted((link["source"], link["target"]))) not in semantic_pairs] + semantic_links

    story_paths = [
        {**path, "nodes": [name for name in path["nodes"] if name in node_ids]}
        for path in STORY_PATHS
    ]
    story_paths = [path for path in story_paths if len(path["nodes"]) >= 2]

    return {
        "nodes": nodes,
        "links": links,
        "types": {key: TYPE_LABELS[key] for key in sorted(GRAPH_ENTITY_TYPES)},
        "clusters": CLUSTER_LABELS,
        "storyPath": story_paths[0]["nodes"] if story_paths else [],
        "storyPaths": story_paths,
    }


def write_html(graph: dict[str, object]) -> None:
    graph_json = json.dumps(graph, ensure_ascii=False)
    html = f"""<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>黑曜纪元星图 3D</title>
  <style>
    :root {{
      color-scheme: dark;
      --bg-void: #05090a;
      --bg-nebula-green: #06271f;
      --bg-nebula-purple: #11101c;
      --tech-blue: #7fa6ff;
      --bio-green: #44e0a4;
      --industrial-amber: #d58a52;
      --corrupt-silver: #c7ccd8;
      --ivory: rgba(242, 238, 218, .92);
      --text-secondary: rgba(242, 238, 218, .62);
      --text-muted: rgba(242, 238, 218, .36);
      --panel: rgba(5, 12, 13, .76);
      --panel-strong: rgba(5, 11, 13, .92);
      --panel-line: rgba(199, 204, 216, .18);
      --card: rgba(255, 255, 255, .045);
      --card-line: rgba(199, 204, 216, .16);
      --edge-default: rgba(210, 220, 180, .14);
      --edge-active: rgba(235, 226, 156, .72);
      --glass-highlight: rgba(242, 238, 218, .08);
      --glass-strong: rgba(9, 18, 20, .86);
      --shadow-deep: 0 26px 80px rgba(0, 0, 0, .58);
    }}
    * {{ box-sizing: border-box; }}
    html, body, #graph {{ width: 100%; height: 100%; margin: 0; overflow: hidden; }}
    body {{
      background:
        radial-gradient(circle at 18% 28%, rgba(6, 39, 31, .82), transparent 34%),
        radial-gradient(circle at 68% 24%, rgba(17, 16, 28, .88), transparent 38%),
        radial-gradient(circle at 55% 82%, rgba(213, 138, 82, .10), transparent 34%),
        var(--bg-void);
      color: var(--ivory);
      font-family: Satoshi, Geist, "SF Pro Display", -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif;
    }}
    body::before {{
      content: "";
      position: fixed;
      inset: 0;
      pointer-events: none;
      z-index: 1;
      background-image:
        linear-gradient(rgba(255,255,255,.025) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255,255,255,.025) 1px, transparent 1px);
      background-size: 96px 96px;
      opacity: .52;
      mask-image: radial-gradient(circle at center, black, transparent 78%);
    }}
    body::after {{
      content: "";
      position: fixed;
      inset: 0;
      pointer-events: none;
      z-index: 2;
      background:
        linear-gradient(90deg, rgba(5,9,10,.48), transparent 23%, transparent 70%, rgba(5,9,10,.58)),
        radial-gradient(circle at 50% 50%, transparent 0, rgba(0,0,0,.24) 88%);
    }}
    #graph {{ position: fixed; inset: 0; z-index: 0; }}
    #graph::after {{
      content: "";
      position: absolute;
      inset: 0;
      pointer-events: none;
      background:
        linear-gradient(180deg, rgba(242,238,218,.035), transparent 18%, transparent 72%, rgba(5,9,10,.38)),
        repeating-linear-gradient(0deg, rgba(255,255,255,.018) 0 1px, transparent 1px 5px);
      opacity: .44;
      mix-blend-mode: screen;
    }}
    #graph canvas {{ display: block; }}
    .scene-container {{ filter: saturate(1.07) contrast(1.04); }}
    .nav {{
      position: fixed;
      top: 16px;
      left: 284px;
      right: 462px;
      z-index: 5;
      display: grid;
      grid-template-columns: minmax(170px, .72fr) minmax(240px, 1fr) auto;
      gap: 10px;
      align-items: center;
      padding: 10px;
      border: 1px solid var(--panel-line);
      border-radius: 10px;
      background: linear-gradient(135deg, rgba(7, 15, 17, .86), rgba(5, 12, 13, .70));
      backdrop-filter: blur(18px);
      box-shadow: 0 24px 70px rgba(0, 0, 0, .38);
    }}
    .nav::before, .rail::before, aside::before, .story-ribbon::before {{
      content: "";
      position: absolute;
      inset: 0;
      pointer-events: none;
      border-radius: inherit;
      background:
        linear-gradient(135deg, var(--glass-highlight), transparent 34%),
        linear-gradient(180deg, rgba(255,255,255,.045), transparent 48%);
      opacity: .7;
    }}
    .brand {{
      display: grid;
      gap: 1px;
      padding: 0 6px;
      min-width: 170px;
    }}
    .brand strong {{ font-size: 18px; letter-spacing: 0; color: var(--ivory); }}
    .brand span {{ font-size: 12px; color: var(--text-secondary); }}
    .focus-hud {{
      display: grid;
      gap: 2px;
      min-width: 0;
      padding: 0 4px;
      color: var(--text-secondary);
      font-size: 12px;
      line-height: 1.35;
    }}
    .focus-hud b {{
      color: var(--ivory);
      font-size: 13px;
      font-weight: 650;
    }}
    .focus-hud span {{
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }}
    input {{
      width: 100%;
      height: 38px;
      padding: 0 12px;
      border: 1px solid var(--panel-line);
      border-radius: 6px;
      background: rgba(2, 8, 9, .74);
      color: var(--ivory);
      outline: none;
      transition: border-color .22s ease, box-shadow .22s ease, background .22s ease;
    }}
    input:focus {{
      border-color: rgba(127, 166, 255, .62);
      box-shadow: 0 0 0 3px rgba(127, 166, 255, .10);
      background: rgba(2, 8, 9, .9);
    }}
    .actions {{ display: flex; gap: 8px; justify-content: flex-end; }}
    button {{
      height: 38px;
      padding: 0 12px;
      border: 1px solid var(--panel-line);
      border-radius: 6px;
      background: rgba(18, 26, 29, .82);
      color: var(--ivory);
      cursor: pointer;
      font-weight: 600;
      transition: transform .22s ease, border-color .22s ease, background .22s ease, box-shadow .22s ease, color .22s ease;
      position: relative;
    }}
    button:hover {{
      transform: translateY(-1px);
      border-color: rgba(242, 238, 218, .34);
      background: rgba(30, 42, 46, .92);
    }}
    button.primary {{
      border-color: rgba(213, 138, 82, .72);
      background: linear-gradient(135deg, #d58a52, #855538);
      color: #080706;
    }}
    button.primary:hover {{
      box-shadow: 0 10px 30px rgba(213, 138, 82, .22);
    }}
    button.active {{
      border-color: rgba(127, 166, 255, .82);
      box-shadow: inset 0 0 0 1px rgba(127, 166, 255, .28), 0 0 22px rgba(68, 224, 164, .10);
    }}
    .rail {{
      position: fixed;
      top: 16px;
      left: 16px;
      bottom: 16px;
      z-index: 5;
      width: 250px;
      display: flex;
      flex-direction: column;
      gap: 14px;
      padding: 12px;
      border: 1px solid var(--panel-line);
      border-radius: 10px;
      background: linear-gradient(180deg, rgba(7, 16, 18, .82), rgba(5, 11, 13, .68));
      backdrop-filter: blur(18px);
      box-shadow: 0 24px 70px rgba(0, 0, 0, .36);
      overflow: auto;
      position: fixed;
    }}
    .rail-title {{
      display: grid;
      gap: 3px;
      padding: 2px 2px 0;
    }}
    .rail-title b {{
      color: var(--ivory);
      font-size: 15px;
      line-height: 1.2;
    }}
    .rail-title span {{
      color: var(--text-secondary);
      font-size: 12px;
      line-height: 1.4;
    }}
    .rail-section {{
      display: grid;
      gap: 8px;
    }}
    .rail-section h2 {{
      margin: 0;
      color: var(--text-secondary);
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0;
    }}
    .filter-group {{
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 7px;
    }}
    .filter-button {{
      height: 32px;
      padding: 0 8px;
      color: var(--text-secondary);
      background: rgba(255, 255, 255, .035);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }}
    .filter-button.active {{
      color: var(--ivory);
      border-color: rgba(68, 224, 164, .48);
      background: rgba(68, 224, 164, .09);
    }}
    .clusters {{
      display: grid;
      grid-template-columns: 1fr;
      gap: 7px;
    }}
    .cluster {{
      min-height: 52px;
      padding: 9px 10px;
      border: 1px solid var(--card-line);
      border-radius: 7px;
      background: rgba(255,255,255,.035);
      cursor: pointer;
      overflow: hidden;
      position: relative;
      transition: min-height .25s ease, transform .22s ease, border-color .22s ease, background .22s ease;
    }}
    .cluster::before {{
      content: "";
      position: absolute;
      inset: 0 auto 0 0;
      width: 3px;
      background: var(--zone-color, var(--industrial-amber));
      opacity: .72;
    }}
    .cluster:hover {{
      min-height: 72px;
      transform: translateX(2px);
      border-color: color-mix(in srgb, var(--zone-color, var(--industrial-amber)) 58%, transparent);
      background: color-mix(in srgb, var(--zone-color, var(--industrial-amber)) 12%, rgba(255,255,255,.035));
    }}
    .cluster.active {{ border-color: var(--zone-color, rgba(213, 138, 82, .74)); background: color-mix(in srgb, var(--zone-color, #d58a52) 15%, transparent); }}
    .cluster b {{ display: block; color: var(--ivory); font-size: 13px; line-height: 1.2; }}
    .cluster span {{ display: block; color: var(--text-secondary); font-size: 11px; margin-top: 4px; line-height: 1.35; }}
    .legend {{
      display: grid;
      gap: 7px;
    }}
    .legend-row {{
      display: grid;
      grid-template-columns: 18px 1fr;
      gap: 8px;
      align-items: center;
      color: var(--text-secondary);
      font-size: 12px;
      line-height: 1.3;
    }}
    .swatch {{
      width: 10px;
      height: 10px;
      border-radius: 50%;
      box-shadow: 0 0 16px currentColor;
    }}
    .line-sample {{
      width: 18px;
      height: 1px;
      background: currentColor;
      opacity: .72;
    }}
    .line-sample.dashed {{
      background: repeating-linear-gradient(90deg, currentColor 0 5px, transparent 5px 8px);
      height: 2px;
    }}
    .line-sample.wavy {{
      height: 2px;
      background: linear-gradient(90deg, transparent, currentColor, transparent);
      box-shadow: 0 0 8px currentColor;
    }}
    .line-sample.broken {{
      background: repeating-linear-gradient(90deg, currentColor 0 3px, transparent 3px 7px);
      height: 2px;
    }}
    aside {{
      position: fixed;
      top: 16px;
      right: 16px;
      bottom: 16px;
      z-index: 6;
      width: 430px;
      display: flex;
      flex-direction: column;
      border: 1px solid var(--panel-line);
      border-radius: 10px;
      background: linear-gradient(180deg, rgba(7, 14, 16, .94), rgba(4, 9, 11, .88));
      overflow: hidden;
      box-shadow: 0 26px 80px rgba(0, 0, 0, .58);
      position: fixed;
    }}
    .hero-media {{
      position: relative;
      width: 100%;
      height: min(34vh, 310px);
      min-height: 214px;
      background:
        radial-gradient(circle at 50% 42%, rgba(68, 224, 164, .16), transparent 38%),
        linear-gradient(135deg, rgba(17, 16, 28, .96), rgba(5, 9, 10, .96));
      overflow: hidden;
      border-bottom: 1px solid var(--panel-line);
    }}
    .hero-media img {{
      width: 100%;
      height: 100%;
      object-fit: contain;
      padding: 10px;
      opacity: .94;
      filter: contrast(1.08) saturate(.88);
    }}
    .image-open {{
      width: 100%;
      height: 100%;
      padding: 0;
      border: 0;
      background: transparent;
      display: block;
      overflow: hidden;
    }}
    .image-open img {{
      transform: scale(.96);
      transition: transform .7s ease, filter .7s ease, opacity .7s ease;
    }}
    .image-open:hover img {{
      transform: scale(1.035);
      filter: contrast(1.18) saturate(1.02);
    }}
    .gallery-tabs {{
      position: absolute;
      left: 10px;
      right: 10px;
      bottom: 10px;
      display: flex;
      justify-content: flex-end;
      gap: 6px;
      pointer-events: none;
    }}
    .gallery-tab {{
      height: 28px;
      padding: 0 9px;
      border-radius: 6px;
      border-color: rgba(239, 231, 212, .34);
      background: rgba(2, 7, 7, .82);
      color: #efe7d4;
      font-size: 12px;
      pointer-events: auto;
      box-shadow: 0 8px 22px rgba(0, 0, 0, .42);
    }}
    .gallery-tab.active {{
      border-color: rgba(95, 232, 199, .88);
      background: rgba(10, 42, 37, .92);
      color: #bff8eb;
    }}
    .hero-media .sigil {{
      position: absolute;
      inset: 50% auto auto 50%;
      width: 152px;
      height: 152px;
      transform: translate(-50%, -50%);
      border-radius: 14px;
      clip-path: polygon(50% 0, 91% 16%, 100% 50%, 91% 84%, 50% 100%, 9% 84%, 0 50%, 9% 16%);
      border: 1px solid rgba(240, 156, 255, .58);
      background:
        linear-gradient(135deg, rgba(240,156,255,.30), rgba(68,224,164,.13) 48%, rgba(213,138,82,.18)),
        rgba(8, 16, 18, .96);
      box-shadow: inset 0 0 34px rgba(242, 238, 218, .12), 0 0 58px rgba(240, 156, 255, .24);
    }}
    .hero-media .sigil::before, .hero-media .sigil::after {{
      content: "";
      position: absolute;
      inset: 22px;
      clip-path: inherit;
      border: 1px solid rgba(242, 238, 218, .46);
      box-shadow: inset 0 0 20px rgba(68, 224, 164, .08);
      opacity: .92;
    }}
    .hero-media .sigil::after {{
      inset: 39px;
      clip-path: none;
      border: 0;
      background:
        linear-gradient(90deg, transparent 47%, rgba(239,231,212,.58) 49%, rgba(239,231,212,.58) 51%, transparent 53%),
        linear-gradient(0deg, transparent 47%, rgba(68,224,164,.45) 49%, rgba(68,224,164,.45) 51%, transparent 53%);
      transform: rotate(45deg);
      box-shadow: none;
    }}
    .panel-body {{
      padding: 13px 14px 16px;
      overflow: auto;
    }}
    h1 {{
      margin: 0;
      font-size: 27px;
      line-height: 1.18;
      letter-spacing: 0;
    }}
    .node-title {{
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 0;
    }}
    .title-thumb {{
      width: 54px;
      height: 28px;
      flex: 0 0 auto;
      border-radius: 999px;
      object-fit: cover;
      border: 1px solid rgba(242, 238, 218, .28);
      filter: contrast(1.08) saturate(.88);
      box-shadow: 0 0 26px rgba(68, 224, 164, .12);
    }}
    .node-title span {{
      min-width: 0;
      overflow-wrap: anywhere;
    }}
    .meta {{
      margin-top: 5px;
      color: var(--text-secondary);
      font-size: 13px;
      line-height: 1.5;
    }}
    .summary {{
      margin: 10px 0 0;
      color: #edf7f2;
      font-size: 14px;
      line-height: 1.58;
    }}
    .chips {{
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 10px;
    }}
    .chip {{
      display: inline-flex;
      min-height: 23px;
      align-items: center;
      padding: 3px 7px;
      border: 1px solid var(--card-line);
      border-radius: 999px;
      background: rgba(255,255,255,.04);
      color: #d7e9e2;
      font-size: 12px;
    }}
    .section-title {{
      margin: 12px 0 6px;
      color: var(--industrial-amber);
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0;
    }}
    .kv {{
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 6px;
      margin-top: 6px;
    }}
    .kv div {{
      padding: 7px 8px;
      border: 1px solid var(--card-line);
      border-radius: 7px;
      background: var(--card);
      color: #eef8f3;
      font-size: 12px;
      line-height: 1.35;
      min-width: 0;
    }}
    .kv b {{ display: block; color: var(--industrial-amber); margin-bottom: 2px; font-size: 11px; }}
    .detail-grid {{
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
      margin-top: 8px;
    }}
    .detail-grid .section-title {{
      margin-top: 0;
    }}
    .info-block {{
      padding: 8px 9px;
      border: 1px solid var(--card-line);
      border-radius: 7px;
      background: var(--card);
      color: #e5f1ec;
      font-size: 12px;
      line-height: 1.52;
      margin-top: 6px;
    }}
    .info-block.compact {{
      display: -webkit-box;
      -webkit-line-clamp: 4;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }}
    .neighbor-list {{
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 6px;
      margin-top: 6px;
    }}
    .neighbor-list button {{
      width: 100%;
      justify-content: flex-start;
      text-align: left;
      color: #eef8f3;
      background: var(--card);
      border-color: var(--card-line);
      height: 32px;
      padding: 0 8px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }}
    .story-ribbon {{
      position: fixed;
      left: 284px;
      right: 462px;
      bottom: 16px;
      z-index: 5;
      min-height: 64px;
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 12px;
      align-items: start;
      padding: 10px 12px;
      border: 1px solid var(--panel-line);
      border-radius: 10px;
      background: linear-gradient(135deg, rgba(7, 15, 17, .84), rgba(5, 12, 13, .66));
      backdrop-filter: blur(18px);
      box-shadow: 0 24px 70px rgba(0, 0, 0, .34);
    }}
    .story-ribbon b {{
      color: var(--text-secondary);
      font-size: 12px;
      font-weight: 700;
      white-space: nowrap;
    }}
    .story-path {{
      display: flex;
      gap: 7px;
      align-items: center;
      flex-wrap: wrap;
      min-width: 0;
      overflow: visible;
    }}
    .story-route {{
      height: 28px;
      padding: 0 9px;
      color: var(--text-secondary);
      background: rgba(255,255,255,.035);
      border-color: var(--card-line);
      font-size: 12px;
    }}
    .story-route.active {{
      color: #05090a;
      border-color: rgba(242, 238, 218, .42);
      background: linear-gradient(135deg, rgba(213, 138, 82, .92), rgba(240, 156, 255, .78));
    }}
    .story-divider {{
      width: 1px;
      height: 28px;
      background: var(--panel-line);
      margin: 0 2px;
    }}
    .story-node {{
      height: 34px;
      padding: 0 10px;
      flex: 0 1 auto;
      min-width: 0;
      color: var(--ivory);
      background: rgba(255,255,255,.04);
      border-color: var(--card-line);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }}
    .story-node.active {{
      color: #05090a;
      background: linear-gradient(135deg, rgba(68, 224, 164, .92), rgba(127, 166, 255, .78));
      border-color: rgba(242, 238, 218, .42);
    }}
    .story-arrow {{
      color: var(--text-muted);
      font-size: 12px;
      flex: 0 0 auto;
    }}
    .footer-note {{
      margin-top: 10px;
      color: var(--text-secondary);
      font-size: 12px;
      line-height: 1.55;
    }}
    .loading {{
      position: fixed;
      inset: 0;
      z-index: 20;
      display: grid;
      place-items: center;
      background: var(--bg-void);
      color: var(--ivory);
      transition: opacity .45s ease;
      pointer-events: none;
    }}
    .loading.done {{ opacity: 0; }}
    .image-overlay {{
      position: fixed;
      inset: 0;
      z-index: 30;
      display: grid;
      place-items: center;
      padding: 28px;
      background: rgba(1, 4, 5, .92);
    }}
    .image-overlay[hidden] {{ display: none; }}
    .image-overlay img {{
      max-width: min(92vw, 820px);
      max-height: 92vh;
      object-fit: contain;
      border: 1px solid var(--panel-line);
      border-radius: 8px;
      box-shadow: 0 28px 110px rgba(0, 0, 0, .72);
      background: var(--bg-void);
    }}
    .image-overlay button {{
      position: fixed;
      top: 22px;
      right: 22px;
      min-width: 72px;
    }}
    .fallback-link {{
      color: var(--industrial-amber);
      text-decoration: none;
    }}
    @media (max-width: 1180px) {{
      .nav {{
        left: 18px;
        right: 18px;
        grid-template-columns: minmax(150px, .72fr) minmax(220px, 1fr) auto;
        padding: 9px;
      }}
      .brand strong {{ font-size: 16px; }}
      .actions {{ justify-content: flex-end; }}
      aside {{
        left: auto;
        right: 18px;
        top: 84px;
        bottom: 16px;
        height: auto;
        max-height: none;
        width: min(340px, 38vw);
      }}
      aside .hero-media {{ height: 164px; min-height: 148px; }}
      aside .panel-body {{ max-height: calc(100vh - 264px); overflow: auto; }}
      .rail {{ display: none; }}
      .story-ribbon {{
        left: 18px;
        right: calc(min(340px, 38vw) + 32px);
        top: auto;
        bottom: 16px;
        z-index: 7;
        grid-template-columns: auto 1fr;
        max-height: 116px;
        overflow: auto;
      }}
    }}
    @media (max-width: 880px) {{
      .nav {{
        grid-template-columns: minmax(130px, .62fr) minmax(190px, 1fr);
      }}
      .actions {{
        grid-column: 1 / -1;
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }}
      aside {{
        width: min(300px, 36vw);
        top: 128px;
      }}
      aside .hero-media {{ display: none; }}
      aside .panel-body {{ max-height: calc(100vh - 160px); }}
      .story-ribbon {{
        right: calc(min(300px, 36vw) + 32px);
        grid-template-columns: 1fr;
      }}
      .story-ribbon b {{ display: none; }}
    }}
    @media (max-width: 760px) {{
      .nav {{ top: 10px; left: 10px; right: 10px; padding: 8px; }}
      .actions {{ display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); }}
      button {{ padding: 0 8px; }}
      aside {{
        left: 10px;
        right: 10px;
        top: auto;
        bottom: 10px;
        width: auto;
        height: auto;
        max-height: 24vh;
        border-radius: 8px;
      }}
      aside .panel-body {{ max-height: 24vh; padding: 10px 11px 12px; }}
      aside h1 {{ font-size: 19px; }}
      .story-ribbon {{
        left: 10px;
        right: 10px;
        top: auto;
        bottom: calc(24vh + 22px);
        max-height: 18vh;
        padding: 8px;
      }}
      .story-route, .story-node {{ height: 30px; max-width: 42vw; }}
      .story-divider {{ flex-basis: 100%; width: 100%; height: 1px; margin: 2px 0; }}
      aside .summary {{
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }}
      aside .chips, aside .detail-grid, aside .neighbor-list, aside .kv {{ display: none; }}
      .hero-media {{ display: none; }}
      .kv, .detail-grid, .neighbor-list {{ grid-template-columns: 1fr; }}
    }}
  </style>
</head>
<body>
  <div id="loading" class="loading">正在生成黑曜纪元星图</div>
  <div id="imageOverlay" class="image-overlay" hidden>
    <button id="closeImageOverlay">关闭</button>
    <img id="imageOverlayImg" alt="完整图片预览">
  </div>
  <div id="graph"></div>
  <nav class="nav">
    <div class="brand">
      <strong>黑曜纪元星图</strong>
      <span id="focusStatus">第三观测层 · 多路径星图</span>
    </div>
    <input id="search" placeholder="搜索：孢雾巡猎者、星序族、赛博工业财团、渊眠族" />
    <div class="actions">
      <button id="modeFeatured" class="primary active">核心星图</button>
      <button id="modeAll">全量图谱</button>
      <button id="reset">重置视角</button>
    </div>
  </nav>
  <section class="rail">
    <div class="rail-title">
      <b>战略关系 HUD</b>
      <span>默认只保留核心节点、四个观测区和关键污染路径。</span>
    </div>
    <div class="rail-section">
      <h2>数据过滤</h2>
      <div id="kindFilters" class="filter-group"></div>
    </div>
    <div class="rail-section">
      <h2>观测区</h2>
      <div id="clusters" class="clusters"></div>
    </div>
    <div class="rail-section">
      <h2>语义颜色</h2>
      <div class="legend">
        <div class="legend-row" style="color: var(--tech-blue)"><span class="swatch"></span><span>科技文明</span></div>
        <div class="legend-row" style="color: var(--bio-green)"><span class="swatch"></span><span>原生生态 / 巡猎链</span></div>
        <div class="legend-row" style="color: var(--industrial-amber)"><span class="swatch"></span><span>工业财团 / 矿区</span></div>
        <div class="legend-row" style="color: var(--corrupt-silver)"><span class="swatch"></span><span>管巢腐化 / 血契残响</span></div>
        <div class="legend-row" style="color: #f09cff"><span class="swatch"></span><span>冲突关系 / 合并轴</span></div>
      </div>
    </div>
    <div class="rail-section">
      <h2>边类型</h2>
      <div class="legend">
        <div class="legend-row" style="color: var(--corrupt-silver)"><span class="line-sample"></span><span>控制 / 血契</span></div>
        <div class="legend-row" style="color: var(--tech-blue)"><span class="line-sample dashed"></span><span>技术传播</span></div>
        <div class="legend-row" style="color: var(--bio-green)"><span class="line-sample wavy"></span><span>污染扩散</span></div>
        <div class="legend-row" style="color: var(--industrial-amber)"><span class="line-sample broken"></span><span>采集 / 冲突</span></div>
        <div class="legend-row" style="color: #f09cff"><span class="line-sample dashed"></span><span>关系轴合并</span></div>
      </div>
    </div>
  </section>
  <aside id="panel">
    <div class="hero-media"><div class="sigil"></div></div>
    <div class="panel-body">
      <h1>多路径世界图谱</h1>
      <div class="meta">黑曜纪元 → 文明 / 地点 / 势力 / 生物</div>
      <p class="summary">点击底部路径可在地点生态、科技扩散、克苏鲁污染、东方修行、西方魔法和北欧原始几条路线之间切换。节点仍共享同一张世界关系网。</p>
      <div class="footer-note">鼠标左键旋转，滚轮缩放，右键平移。高饱和色只服务当前路径，不再让每一条线都抢戏。</div>
    </div>
  </aside>
  <section class="story-ribbon">
      <b>路径导航</b>
    <div id="storyPath" class="story-path"></div>
  </section>
  <script src="assets/vendor/three-0.160.1.min.js"></script>
  <script src="assets/vendor/three-spritetext-1.9.1.min.js"></script>
  <script src="assets/vendor/3d-force-graph-1.73.6.min.js"></script>
  <script>
    const sourceGraph = {graph_json};
    const allNodes = sourceGraph.nodes;
    const allLinks = sourceGraph.links;
    const clusterLabels = sourceGraph.clusters;
    const storyPaths = Array.isArray(sourceGraph.storyPaths) && sourceGraph.storyPaths.length
      ? sourceGraph.storyPaths
      : [{{ key: "main", label: "当前主轴", summary: "核心关系路径", nodes: sourceGraph.storyPath || [] }}];
    let activeStoryKey = storyPaths[0]?.key || "main";
    const storyNodeIds = new Set(storyPaths.flatMap(path => path.nodes || []));
    const allStoryEdges = new Set(storyPaths.flatMap(path => (path.nodes || []).slice(1).map((id, index) => edgeKey((path.nodes || [])[index], id))));
    const nodeById = new Map(allNodes.map(node => [node.id, node]));
    const nodeIndexById = new Map(allNodes.map((node, index) => [node.id, index]));
    const neighbors = new Map(allNodes.map(node => [node.id, new Set()]));
    allLinks.forEach(link => {{
      neighbors.get(link.sourceId)?.add(link.targetId);
      neighbors.get(link.targetId)?.add(link.sourceId);
    }});

    let mode = "featured";
    let query = "";
    let activeCluster = "all";
    let activeKind = "all";
    let selectedNode = null;
    let hoverNode = null;
    const textureCache = new Map();
    const occlusionTextureCache = new Map();
    const animatedObjects = new Set();
    const breathingObjects = new Set();
    const graphEl = document.getElementById("graph");
    const relationPalette = {{
      tech: [127, 166, 255],
      bio: [68, 224, 164],
      industrial: [213, 138, 82],
      corrupt: [199, 204, 216],
      conflict: [240, 156, 255],
      semantic: [235, 226, 156],
      default: [210, 220, 180],
    }};
    const clusterColors = {{
      all: "#d58a52",
      core: "#d7bd84",
      tech: "#7fa6ff",
      mine: "#d58a52",
      corruption: "#c7ccd8",
      hunt: "#44e0a4",
      conflict: "#f09cff",
      archive: "#7f8a99",
    }};
    const kindFilters = [
      ["all", "全部"],
      ["race", "族群"],
      ["faction", "组织"],
      ["ecology", "生态"],
      ["corruption", "污染"],
      ["relation", "关系"],
    ];

    const orbitLayerGuides = [
      {{ label: "根节点", radius: 78, color: 0xd7bd84, opacity: .34, tube: .72, yScale: .78, tiltX: .12, tiltY: -.08, tiltZ: .02, beads: 8 }},
      {{ label: "文明层", radius: 245, color: 0x7fa6ff, opacity: .30, tube: .76, yScale: .70, tiltX: .58, tiltY: -.22, tiltZ: -.18, beads: 14 }},
      {{ label: "地点层", radius: 360, color: 0xd58a52, opacity: .27, tube: .68, yScale: .64, tiltX: .88, tiltY: .16, tiltZ: .28, beads: 16 }},
      {{ label: "势力/种族层", radius: 475, color: 0x66d9e8, opacity: .24, tube: .60, yScale: .70, tiltX: 1.08, tiltY: -.34, tiltZ: .72, beads: 18 }},
      {{ label: "生物层", radius: 625, color: 0x44e0a4, opacity: .23, tube: .56, yScale: .74, tiltX: 1.30, tiltY: .28, tiltZ: 1.10, beads: 22 }},
      {{ label: "关系轴", radius: 745, color: 0xf09cff, opacity: .21, tube: .52, yScale: .58, tiltX: 1.62, tiltY: -.12, tiltZ: 1.55, beads: 18 }},
    ];
    const orbitClusterPlanes = {{
      core: {{ tiltX: .12, tiltY: -.08, tiltZ: .02 }},
      tech: {{ tiltX: .58, tiltY: -.32, tiltZ: -.28 }},
      mine: {{ tiltX: .88, tiltY: .14, tiltZ: .34 }},
      corruption: {{ tiltX: 1.18, tiltY: -.18, tiltZ: .94 }},
      hunt: {{ tiltX: 1.30, tiltY: .28, tiltZ: 1.10 }},
      faction_creatures: {{ tiltX: 1.06, tiltY: -.36, tiltZ: .68 }},
      conflict: {{ tiltX: 1.62, tiltY: -.12, tiltZ: 1.55 }},
      archive: {{ tiltX: 1.42, tiltY: .36, tiltZ: -1.08 }},
    }};
    const orbitFallbackBands = {{
      world: {{ radius: 245, yScale: .70, zAmp: 28, radiusJitter: .13, zJitter: .22, twist: 1.18, phase: .20, tiltX: .58, tiltY: -.22, tiltZ: -.18 }},
      place: {{ radius: 360, yScale: .64, zAmp: 42, radiusJitter: .12, zJitter: .24, twist: 1.42, phase: .70, tiltX: .88, tiltY: .16, tiltZ: .28 }},
      faction: {{ radius: 475, yScale: .70, zAmp: 56, radiusJitter: .12, zJitter: .26, twist: 1.16, phase: 1.20, tiltX: 1.08, tiltY: -.34, tiltZ: .72 }},
      race: {{ radius: 520, yScale: .72, zAmp: 66, radiusJitter: .12, zJitter: .26, twist: 1.30, phase: 1.85, tiltX: 1.06, tiltY: -.36, tiltZ: .68 }},
      creature: {{ radius: 625, yScale: .74, zAmp: 88, radiusJitter: .10, zJitter: .30, twist: 1.52, phase: 2.35, tiltX: 1.30, tiltY: .28, tiltZ: 1.10 }},
      relation: {{ radius: 745, yScale: .58, zAmp: 78, radiusJitter: .08, zJitter: .24, twist: 1.06, phase: 2.90, tiltX: 1.62, tiltY: -.12, tiltZ: 1.55 }},
      overview: {{ radius: 785, yScale: .58, zAmp: 82, radiusJitter: .08, zJitter: .20, twist: 1.10, phase: .45, tiltX: 1.42, tiltY: .36, tiltZ: -1.08 }},
      base: {{ radius: 820, yScale: .66, zAmp: 80, radiusJitter: .08, zJitter: .20, twist: 1.22, phase: 1.55, tiltX: 1.34, tiltY: -.26, tiltZ: -1.28 }},
      node: {{ radius: 790, yScale: .66, zAmp: 82, radiusJitter: .10, zJitter: .22, twist: 1.16, phase: 2.10, tiltX: 1.28, tiltY: .22, tiltZ: -.96 }},
    }};
    const orbitClusterPhase = {{
      core: 0,
      tech: -0.74,
      mine: .18,
      corruption: .96,
      hunt: 1.72,
      faction_creatures: 2.46,
      conflict: 3.22,
      archive: -1.38,
    }};
    const orbitNamedLayers = [
      {{ radius: 0, yScale: 1, zAmp: 0, names: ["黑曜纪元"] }},
      {{ radius: 130, yScale: .72, zAmp: 14, phase: -Math.PI / 2, tiltX: .26, tiltY: -.08, tiltZ: .10, names: ["诸天裂灾"] }},
      {{ radius: 245, yScale: .70, zAmp: 28, phase: -.35, tiltX: .58, tiltY: -.22, tiltZ: -.18, names: ["高科技文明", "赛博工业文明", "克苏鲁眷族", "东方修行者", "西方魔法师", "北欧原始神系", "所有神秘体系", "东方修士"] }},
      {{ radius: 360, yScale: .64, zAmp: 42, phase: .25, tiltX: .88, tiltY: .16, tiltZ: .28, names: ["神尸矿区", "腐林", "湿谷", "废弃矿区", "城市管道", "深海尸骸", "山海森林", "非三维空间", "工业废液", "高空低轨", "腐化森林"] }},
      {{ radius: 475, yScale: .70, zAmp: 56, phase: .88, tiltX: 1.08, tiltY: -.34, tiltZ: .72, names: ["赛博工业财团", "斩念剑庭", "万机符宗", "丹鼎肉仙门", "百相妖庭", "白塔秘法学院", "黑书会", "血契贵族", "霜巨原民", "根下三女巫", "狼灾血裔"] }},
      {{ radius: 625, yScale: .74, zAmp: 88, phase: 1.45, tiltX: 1.30, tiltY: .28, tiltZ: 1.10, names: ["星序族", "云脑族", "白械天使", "渊眠族", "梦蛹族", "星瘤裔", "孢雾巡猎者", "丹瘤药鼠", "借面狸奴", "塔灯书蛾", "黑页书虱", "冰腔雪虱", "命线根蛛"] }},
      {{ radius: 745, yScale: .58, zAmp: 78, phase: 2.05, tiltX: 1.62, tiltY: -.12, tiltZ: 1.55, names: ["东方修行者_vs_克苏鲁眷族", "北欧原始神系_vs_高科技文明", "西方魔法师_vs_东方修士", "赛博工业财团_vs_所有神秘体系", "亡者体系内斗", "星外体系互相污染"] }},
    ];
    const rootPositions = buildOrbitalPositions();

    const Graph = ForceGraph3D({{ controlType: "orbit", rendererConfig: {{ antialias: true, alpha: true }} }})(graphEl)
      .backgroundColor("rgba(0,0,0,0)")
      .showNavInfo(false)
      .nodeId("id")
      .nodeLabel(node => `${{node.label}}\\n${{node.typeLabel}}\\n${{node.summary || ""}}`)
      .nodeThreeObject(node => makeNodeObject(node))
      .linkLabel(link => link.label || "")
      .linkVisibility(link => linkVisibleFor(link))
      .linkWidth(link => linkWidthFor(link))
      .linkOpacity(1)
      .linkColor(link => linkColorFor(link))
      .linkMaterial(link => linkMaterialFor(link))
      .linkCurvature(link => linkCurvatureFor(link))
      .linkCurveRotation(link => linkCurveRotationFor(link))
      .linkResolution(link => linkCurvatureFor(link) > 0 ? 18 : 3)
      .linkDirectionalParticles(link => particleCountFor(link))
      .linkDirectionalParticleSpeed(link => particleSpeedFor(link))
      .linkDirectionalParticleWidth(link => particleWidthFor(link))
      .linkDirectionalParticleColor(link => linkColorFor(link))
      .onNodeHover(node => {{
        hoverNode = node;
        graphEl.style.cursor = node ? "pointer" : "default";
        updateFocusVisuals();
        updateFocusStatus();
      }})
      .onNodeClick(node => selectNode(node, true))
      .onBackgroundClick(() => clearFocus());

    Graph.d3Force("charge").strength(node => node.featured ? -90 : -24);
    Graph.d3Force("link").distance(link => isStoryLink(link) ? 92 : (link.semantic ? 118 : 74));
    Graph.d3Force("center").strength(.006);
    Graph.cameraPosition({{ x: 130, y: -520, z: 920 }}, {{ x: 0, y: 0, z: 0 }});
    enableGraphNavigation();
    Graph.controls().autoRotate = true;
    Graph.controls().autoRotateSpeed = .28;

    Graph.scene().fog = new THREE.FogExp2(0x05090a, .00092);
    Graph.scene().add(new THREE.AmbientLight(0xc7ccd8, 1.30));
    const keyLight = new THREE.PointLight(0xd58a52, 1.55, 1250);
    keyLight.position.set(180, -240, 320);
    Graph.scene().add(keyLight);
    const rimLight = new THREE.PointLight(0x44e0a4, 1.28, 1360);
    rimLight.position.set(-320, 190, 280);
    Graph.scene().add(rimLight);
    const coolLight = new THREE.PointLight(0x7fa6ff, 1.02, 1150);
    coolLight.position.set(260, 320, -360);
    Graph.scene().add(coolLight);
    addNebula();
    buildKindFilters();
    buildClusterRail();
    buildStoryRibbon();
    startMotionLoop();
    applyGraph();

    function addNebula() {{
      const starGeo = new THREE.BufferGeometry();
      const count = 2200;
      const positions = new Float32Array(count * 3);
      const colors = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {{
        const shell = 900 + Math.random() * 520;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        positions[i * 3] = Math.sin(phi) * Math.cos(theta) * shell;
        positions[i * 3 + 1] = Math.sin(phi) * Math.sin(theta) * shell * .82;
        positions[i * 3 + 2] = Math.cos(phi) * shell;
        const warm = Math.random();
        colors[i * 3] = warm > .72 ? .84 : .50;
        colors[i * 3 + 1] = warm > .72 ? .62 : .90;
        colors[i * 3 + 2] = warm > .72 ? .42 : .82;
      }}
      starGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      starGeo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      Graph.scene().add(new THREE.Points(starGeo, new THREE.PointsMaterial({{ size: .82, transparent: true, opacity: .40, vertexColors: true, depthWrite: false }})));

      addWorldCore();
      addOrbitRings();
    }}

    function addWorldCore() {{
      const group = new THREE.Group();
      const coreGeo = new THREE.SphereGeometry(26, 48, 24);
      const coreMat = new THREE.MeshBasicMaterial({{ color: 0xd7bd84, transparent: true, opacity: .34, blending: THREE.AdditiveBlending, depthWrite: false }});
      const core = new THREE.Mesh(coreGeo, coreMat);
      group.add(core);

      [180, 310, 460].forEach((scale, index) => {{
        const halo = new THREE.Sprite(new THREE.SpriteMaterial({{
          map: softGlowTexture(),
          color: index === 0 ? 0xd7bd84 : (index === 1 ? 0x44e0a4 : 0x7fa6ff),
          transparent: true,
          opacity: [.18, .10, .07][index],
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          depthTest: false,
        }}));
        halo.scale.set(scale, scale, 1);
        halo.renderOrder = -60 - index;
        halo.userData.baseScale = scale;
        halo.userData.breathAmp = .025 + index * .012;
        halo.userData.phase = index * 1.7;
        breathingObjects.add(halo);
        group.add(halo);
      }});

      const crownGeo = new THREE.TorusGeometry(68, .72, 8, 160);
      const crownMat = new THREE.MeshBasicMaterial({{ color: 0xd7bd84, transparent: true, opacity: .26, blending: THREE.AdditiveBlending, depthWrite: false }});
      const crown = new THREE.Mesh(crownGeo, crownMat);
      crown.rotation.x = .62;
      crown.rotation.y = -.18;
      crown.userData.spinSpeed = .0018;
      crown.userData.pulse = true;
      crown.userData.baseOpacity = .22;
      crown.userData.phase = .8;
      animatedObjects.add(crown);
      group.add(crown);

      Graph.scene().add(group);
    }}

    function addOrbitRings() {{
      orbitLayerGuides.forEach((ringSpec, layerIndex) => {{
        const group = new THREE.Group();
        group.rotation.set(ringSpec.tiltX || 0, ringSpec.tiltY || 0, ringSpec.tiltZ || 0);
        const ringGeo = new THREE.TorusGeometry(ringSpec.radius, ringSpec.tube || .44, 8, 300);
        const ringMat = new THREE.MeshBasicMaterial({{ color: ringSpec.color, transparent: true, opacity: ringSpec.opacity, blending: THREE.AdditiveBlending, depthWrite: false }});
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.scale.y = ringSpec.yScale || 1;
        ring.renderOrder = -42;
        group.add(ring);

        const railGeo = new THREE.TorusGeometry(ringSpec.radius + 7, .12, 6, 240);
        const railMat = new THREE.MeshBasicMaterial({{ color: ringSpec.color, transparent: true, opacity: ringSpec.opacity * .55, blending: THREE.AdditiveBlending, depthWrite: false }});
        const rail = new THREE.Mesh(railGeo, railMat);
        rail.scale.y = ringSpec.yScale || 1;
        rail.renderOrder = -43;
        group.add(rail);

        const beadGeo = new THREE.SphereGeometry(layerIndex === 0 ? 1.8 : 1.35, 12, 8);
        const beadMat = new THREE.MeshBasicMaterial({{ color: ringSpec.color, transparent: true, opacity: Math.min(.42, ringSpec.opacity * 2.1), blending: THREE.AdditiveBlending, depthWrite: false }});
        for (let i = 0; i < (ringSpec.beads || 12); i++) {{
          const angle = Math.PI * 2 * (i / (ringSpec.beads || 12));
          const bead = new THREE.Mesh(beadGeo, beadMat);
          bead.position.set(Math.cos(angle) * ringSpec.radius, Math.sin(angle) * ringSpec.radius * (ringSpec.yScale || 1), Math.sin(angle * 2 + layerIndex) * 7);
          group.add(bead);
        }}

        const label = new SpriteText(ringSpec.label);
        label.color = "#efe7d4";
        label.textHeight = layerIndex === 0 ? 5.2 : 4.4;
        label.backgroundColor = "rgba(5, 9, 10, .36)";
        label.padding = 1.0;
        label.borderRadius = 3;
        label.position.set(ringSpec.radius + 28, -12, 0);
        label.renderOrder = -20;
        group.add(label);

        group.userData.spinSpeed = layerIndex === 0 ? .0012 : (.00016 + layerIndex * .000035);
        group.userData.pulse = false;
        animatedObjects.add(group);
        Graph.scene().add(group);
      }});
    }}

    function edgeKey(source, target) {{
      return [source, target].sort().join("→");
    }}

    function rotateOrbitPoint(x, y, z, options = {{}}) {{
      const tiltX = options.tiltX || 0;
      const tiltY = options.tiltY || 0;
      const tiltZ = options.tiltZ || 0;
      let ry = y * Math.cos(tiltX) - z * Math.sin(tiltX);
      let rz = y * Math.sin(tiltX) + z * Math.cos(tiltX);
      let rx = x;
      const nx = rx * Math.cos(tiltY) + rz * Math.sin(tiltY);
      const nz = -rx * Math.sin(tiltY) + rz * Math.cos(tiltY);
      rx = nx;
      rz = nz;
      const fx = rx * Math.cos(tiltZ) - ry * Math.sin(tiltZ);
      const fy = rx * Math.sin(tiltZ) + ry * Math.cos(tiltZ);
      return [fx, fy, rz];
    }}

    function orbitPoint(radius, index, count, options = {{}}) {{
      if (radius === 0) return [0, 0, 0];
      const safeCount = Math.max(1, count);
      const offset = options.offset === undefined ? .5 : options.offset;
      const phase = options.phase || 0;
      const angle = Math.PI * 2 * ((index + offset) / safeCount) + phase;
      const yScale = options.yScale === undefined ? .72 : options.yScale;
      const zAmp = options.zAmp === undefined ? radius * .12 : options.zAmp;
      const twist = options.twist || 1.28;
      const zPhase = options.zPhase || 0;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius * yScale;
      const z = Math.sin(angle * twist + zPhase) * zAmp + Math.cos(angle * .5 + zPhase) * zAmp * .10;
      const rotated = rotateOrbitPoint(x, y, z, options);
      return rotated.map(value => Math.round(value));
    }}

    function buildOrbitalPositions() {{
      const positions = {{}};
      orbitNamedLayers.forEach(layer => {{
        const names = layer.names.filter(id => nodeById.has(id));
        names.forEach((id, index) => {{
          positions[id] = orbitPoint(layer.radius, index, names.length, layer);
        }});
      }});
      positions["黑曜纪元"] = [0, 0, 0];
      return positions;
    }}

    function hashAngle(id, axis = 0) {{
      let h = 0;
      for (let i = 0; i < id.length; i++) h = (h * 33 + id.charCodeAt(i) + axis * 131) % 104729;
      return (h / 104729) * Math.PI * 2;
    }}

    function orbitalFallbackPosition(node) {{
      const band = orbitFallbackBands[node.type] || orbitFallbackBands.node;
      const plane = orbitClusterPlanes[node.cluster] || {{}};
      const spec = {{ ...band, ...plane }};
      const clusterPhase = orbitClusterPhase[node.cluster] || 0;
      const angle = hashAngle(node.id, 0) + clusterPhase + (spec.phase || 0);
      const radius = spec.radius + randomOffset(node.id, 0) * (spec.radiusJitter || .10);
      const indexLift = ((nodeIndexById.get(node.id) || 0) % 9 - 4) * 8;
      const [x, y, z] = orbitPoint(radius, 0, 1, {{ ...spec, offset: 0, phase: angle, zPhase: hashAngle(node.id, 2) * .25 }});
      return [
        Math.round(x + randomOffset(node.id, 1) * .16),
        Math.round(y + randomOffset(node.id, 0) * .10),
        Math.round(z + randomOffset(node.id, 2) * (spec.zJitter || .22) + indexLift),
      ];
    }}

    function orbitalPositionForNode(node) {{
      return rootPositions[node.id] || orbitalFallbackPosition(node);
    }}

    function activeStory() {{
      return storyPaths.find(path => path.key === activeStoryKey) || storyPaths[0] || {{ key: "main", label: "核心路径", summary: "核心关系路径", nodes: [] }};
    }}

    function activeStoryPath() {{
      return activeStory().nodes || [];
    }}

    function activeStorySet() {{
      return new Set(activeStoryPath());
    }}

    function activeStoryEdges() {{
      const path = activeStoryPath();
      return new Set(path.slice(1).map((id, index) => edgeKey(path[index], id)));
    }}

    function activeFocusNode() {{
      return selectedNode || hoverNode;
    }}

    function enableGraphNavigation() {{
      const controls = Graph.controls();
      controls.enabled = true;
      controls.enableRotate = true;
      controls.enableZoom = true;
      controls.enablePan = true;
      controls.screenSpacePanning = true;
      controls.autoRotateSpeed = .28;
      if (controls.mouseButtons && THREE.MOUSE) {{
        controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
        controls.mouseButtons.RIGHT = THREE.MOUSE.PAN;
      }}
      if (controls.touches && THREE.TOUCH) {{
        controls.touches.ONE = THREE.TOUCH.ROTATE;
        controls.touches.TWO = THREE.TOUCH.DOLLY_PAN;
      }}
    }}

    function isStoryLink(link) {{
      return allStoryEdges.has(edgeKey(link.sourceId, link.targetId));
    }}

    function isActiveStoryLink(link) {{
      return activeStoryEdges().has(edgeKey(link.sourceId, link.targetId));
    }}

    function focusIds() {{
      const focus = activeFocusNode();
      const ids = new Set();
      if (!focus) return ids;
      ids.add(focus.id);
      neighbors.get(focus.id)?.forEach(id => ids.add(id));
      if (activeStorySet().has(focus.id)) activeStoryPath().forEach(id => ids.add(id));
      return ids;
    }}

    function relationKind(link) {{
      const label = `${{link.label || ""}} ${{link.sourceId || ""}} ${{link.targetId || ""}}`;
      if (link.relationAxis || /冲突|关系|\\bvs\\b/i.test(label)) return "conflict";
      if (/技术|文明|族群|造物|高科技|星序|云脑|白械/.test(label)) return "tech";
      if (/工业|财团|矿|采集|开发|赛博/.test(label)) return "industrial";
      if (/污染|生态|栖息地|物种|生命|巡猎|湿谷|孢|腐林|腐/.test(label)) return "bio";
      if (/眷族|血|旧神|秘社|边缘|克苏鲁|管巢|黑书/.test(label)) return "corrupt";
      return link.semantic ? "semantic" : "default";
    }}

    function rgba(kind, alpha) {{
      const [r, g, b] = relationPalette[kind] || relationPalette.default;
      return `rgba(${{r}}, ${{g}}, ${{b}}, ${{alpha}})`;
    }}

    function linkIsNearFocus(link) {{
      const focus = activeFocusNode();
      if (!focus) return false;
      return link.sourceId === focus.id || link.targetId === focus.id;
    }}

    function linkIsActive(link) {{
      const focus = activeFocusNode();
      if (!focus) return false;
      if (activeStorySet().has(focus.id) && isActiveStoryLink(link)) return true;
      return linkIsNearFocus(link);
    }}

    function linkVisibleFor(link) {{
      const focus = activeFocusNode();
      if (!focus) return isStoryLink(link) || Boolean(link.relationAxis);
      if (activeStorySet().has(focus.id)) return isStoryLink(link) || linkIsNearFocus(link);
      return linkIsNearFocus(link) || isStoryLink(link);
    }}

    function linkAlphaFor(link) {{
      if (!linkVisibleFor(link)) return 0;
      if (linkIsActive(link)) return isActiveStoryLink(link) ? .96 : .68;
      if (linkIsNearFocus(link)) return .44;
      if (link.relationAxis) return .46;
      if (isStoryLink(link)) return isActiveStoryLink(link) ? .62 : .34;
      return .16;
    }}

    function linkColorFor(link) {{
      return rgba(relationKind(link), linkAlphaFor(link));
    }}

    function linkMaterialFor(link) {{
      const kind = relationKind(link);
      const [r, g, b] = relationPalette[kind] || relationPalette.default;
      const alpha = linkAlphaFor(link);
      return new THREE.MeshBasicMaterial({{
        color: new THREE.Color(r / 255, g / 255, b / 255),
        transparent: true,
        opacity: alpha,
        depthTest: true,
        depthWrite: false,
        toneMapped: false,
        blending: linkIsActive(link) || isStoryLink(link) ? THREE.AdditiveBlending : THREE.NormalBlending,
      }});
    }}

    function linkCurvatureFor(link) {{
      if (!linkVisibleFor(link)) return 0;
      if (isActiveStoryLink(link)) return .34;
      if (link.relationAxis) return .26;
      if (link.semantic) return .16;
      if (isStoryLink(link)) return .20;
      return .08;
    }}

    function linkCurveRotationFor(link) {{
      const kind = relationKind(link);
      const base = {{
        tech: -.34,
        bio: .86,
        industrial: .28,
        corrupt: 1.46,
        conflict: 2.10,
        semantic: -1.08,
        default: .52,
      }}[kind] ?? .52;
      return base + Math.sin(hashAngle(`${{link.sourceId}}:${{link.targetId}}`, 4)) * .72;
    }}

    function linkWidthFor(link) {{
      if (!linkVisibleFor(link)) return 0;
      if (linkIsActive(link)) return isActiveStoryLink(link) ? 3.8 : 1.85;
      if (linkIsNearFocus(link)) return 1.35;
      if (link.relationAxis) return 1.55;
      if (isStoryLink(link)) return isActiveStoryLink(link) ? 2.7 : 1.35;
      return .7;
    }}

    function particleCountFor(link) {{
      if (!linkVisibleFor(link)) return 0;
      if (linkIsActive(link) && isActiveStoryLink(link)) return 4;
      if (linkIsActive(link) && relationKind(link) === "bio") return 2;
      return 0;
    }}

    function particleSpeedFor(link) {{
      return isActiveStoryLink(link) ? .0024 : .0014;
    }}

    function particleWidthFor(link) {{
      if (isActiveStoryLink(link)) return 2.35;
      return 1.25;
    }}

    function nodeOpacity(node) {{
      const focus = activeFocusNode();
      if (focus) {{
        const ids = focusIds();
        if (node.id === focus.id) return 1;
        if (activeStorySet().has(focus.id) && activeStorySet().has(node.id)) return .92;
        if (ids.has(node.id)) return .78;
        if (node.cluster === "core") return .48;
        return .25;
      }}
      if (node.visualRank === "core") return .98;
      if (node.visualRank === "major") return .86;
      if (node.visualRank === "secondary") return .48;
      return .28;
    }}

    function shouldShowLabel(node) {{
      const focus = activeFocusNode();
      if (!focus) return Boolean(node.defaultLabel);
      const ids = focusIds();
      return node.id === focus.id || ids.has(node.id) || (activeStorySet().has(focus.id) && activeStorySet().has(node.id));
    }}

    function updateFocusVisuals() {{
      Graph
        .nodeThreeObject(node => makeNodeObject(node))
        .linkVisibility(link => linkVisibleFor(link))
        .linkWidth(link => linkWidthFor(link))
        .linkColor(link => linkColorFor(link))
        .linkMaterial(link => linkMaterialFor(link))
        .linkCurvature(link => linkCurvatureFor(link))
        .linkCurveRotation(link => linkCurveRotationFor(link))
        .linkResolution(link => linkCurvatureFor(link) > 0 ? 18 : 3)
        .linkDirectionalParticles(link => particleCountFor(link));
      document.querySelectorAll(".story-node").forEach(button => {{
        const isActive = selectedNode ? pathForNode(selectedNode).includes(button.dataset.node) : false;
        button.classList.toggle("active", isActive);
      }});
    }}

    function startMotionLoop() {{
      const tick = () => {{
        const now = Date.now();
        animatedObjects.forEach(object => {{
          if (!object.parent) {{
            animatedObjects.delete(object);
            return;
          }}
          if (Number.isFinite(object.userData.spinSpeed) && object.userData.spinSpeed !== 0) {{
            object.rotation.z += object.userData.spinSpeed;
          }}
          if (object.material && object.userData.pulse) {{
            const base = object.userData.baseOpacity || .42;
            object.material.opacity = base + Math.sin(now * .0022 + object.userData.phase) * .12;
          }}
        }});
        breathingObjects.forEach(object => {{
          if (!object.parent) {{
            breathingObjects.delete(object);
            return;
          }}
          const baseScale = object.userData.baseScale || 1;
          const breathAmp = object.userData.breathAmp || .02;
          const breath = 1 + Math.sin(now * .0016 + (object.userData.phase || 0)) * breathAmp;
          object.scale.set(baseScale * breath, baseScale * breath, 1);
          if (object.material && Number.isFinite(object.material.opacity)) {{
            object.material.opacity = Math.max(.02, object.material.opacity);
          }}
        }});
        requestAnimationFrame(tick);
      }};
      requestAnimationFrame(tick);
    }}

    function hexToRgb(color) {{
      const value = String(color || "#57d7be").replace("#", "").trim();
      const normalized = value.length === 3 ? value.split("").map(char => char + char).join("") : value.padEnd(6, "0").slice(0, 6);
      const numeric = Number.parseInt(normalized, 16);
      if (Number.isNaN(numeric)) return {{ r: 87, g: 215, b: 190 }};
      return {{ r: (numeric >> 16) & 255, g: (numeric >> 8) & 255, b: numeric & 255 }};
    }}

    function colorWithAlpha(color, alpha) {{
      const rgb = hexToRgb(color);
      return `rgba(${{rgb.r}}, ${{rgb.g}}, ${{rgb.b}}, ${{alpha}})`;
    }}

    function softGlowTexture() {{
      const key = "soft-glow";
      if (textureCache.has(key)) return textureCache.get(key);
      const canvas = document.createElement("canvas");
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext("2d");
      const gradient = ctx.createRadialGradient(128, 128, 0, 128, 128, 126);
      gradient.addColorStop(0, "rgba(255,255,255,.92)");
      gradient.addColorStop(.30, "rgba(255,255,255,.42)");
      gradient.addColorStop(.62, "rgba(255,255,255,.10)");
      gradient.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 256, 256);
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.needsUpdate = true;
      textureCache.set(key, texture);
      return texture;
    }}

    function drawOctagon(ctx, cx, cy, radius, inset = .34) {{
      const cut = radius * inset;
      ctx.beginPath();
      ctx.moveTo(cx - cut, cy - radius);
      ctx.lineTo(cx + cut, cy - radius);
      ctx.lineTo(cx + radius, cy - cut);
      ctx.lineTo(cx + radius, cy + cut);
      ctx.lineTo(cx + cut, cy + radius);
      ctx.lineTo(cx - cut, cy + radius);
      ctx.lineTo(cx - radius, cy + cut);
      ctx.lineTo(cx - radius, cy - cut);
      ctx.closePath();
    }}

    function glyphForNode(node) {{
      const glyphs = {{
        world: "界",
        race: "族",
        faction: "势",
        creature: "生",
        place: "域",
        relation: "轴",
        overview: "览",
        event: "事",
        base: "基",
        node: "点",
      }};
      return glyphs[node.type] || node.label.slice(0, 1);
    }}

    function drawGlyphMotif(ctx, node, color) {{
      ctx.save();
      ctx.strokeStyle = colorWithAlpha(color, .72);
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      if (node.type === "relation") {{
        ctx.beginPath();
        ctx.moveTo(82, 128);
        ctx.lineTo(174, 128);
        ctx.moveTo(128, 82);
        ctx.lineTo(128, 174);
        ctx.moveTo(96, 96);
        ctx.lineTo(160, 160);
        ctx.moveTo(160, 96);
        ctx.lineTo(96, 160);
        ctx.stroke();
      }} else if (node.type === "place") {{
        for (let i = 0; i < 4; i++) {{
          ctx.beginPath();
          const y = 100 + i * 18;
          ctx.moveTo(76, y);
          ctx.bezierCurveTo(104, y - 16, 132, y + 16, 180, y - 2);
          ctx.stroke();
        }}
      }} else if (node.type === "faction") {{
        ctx.beginPath();
        ctx.moveTo(84, 168);
        ctx.lineTo(128, 82);
        ctx.lineTo(172, 168);
        ctx.moveTo(101, 136);
        ctx.lineTo(155, 136);
        ctx.stroke();
      }} else if (node.type === "race") {{
        [98, 128, 158].forEach((x, index) => {{
          ctx.beginPath();
          ctx.moveTo(x, 92 + index * 6);
          ctx.lineTo(x, 166 - index * 6);
          ctx.stroke();
        }});
      }} else if (node.type === "creature") {{
        ctx.beginPath();
        ctx.moveTo(91, 94);
        ctx.quadraticCurveTo(128, 77, 165, 94);
        ctx.moveTo(94, 162);
        ctx.quadraticCurveTo(128, 184, 162, 162);
        ctx.moveTo(104, 112);
        ctx.lineTo(152, 160);
        ctx.moveTo(152, 112);
        ctx.lineTo(104, 160);
        ctx.stroke();
      }} else {{
        ctx.beginPath();
        ctx.arc(128, 128, 40, 0, Math.PI * 2);
        ctx.moveTo(128, 78);
        ctx.lineTo(128, 178);
        ctx.moveTo(78, 128);
        ctx.lineTo(178, 128);
        ctx.stroke();
      }}
      ctx.restore();
    }}

    function textureForNode(node) {{
      const key = node.nodeImage ? `img:${{node.id}}` : `sigil:${{node.id}}`;
      if (textureCache.has(key)) return textureCache.get(key);
      if (node.nodeImage) {{
        const texture = new THREE.TextureLoader().load(node.nodeImage);
        texture.colorSpace = THREE.SRGBColorSpace;
        textureCache.set(key, texture);
        return texture;
      }}
      const canvas = document.createElement("canvas");
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext("2d");
      const color = node.color || "#57d7be";
      ctx.clearRect(0, 0, 256, 256);

      ctx.save();
      ctx.shadowColor = colorWithAlpha(color, .45);
      ctx.shadowBlur = 22;
      drawOctagon(ctx, 128, 128, 106, .30);
      const baseGradient = ctx.createLinearGradient(48, 44, 206, 212);
      baseGradient.addColorStop(0, colorWithAlpha(color, .30));
      baseGradient.addColorStop(.42, "rgba(4, 10, 12, .94)");
      baseGradient.addColorStop(1, "rgba(18, 24, 28, .90)");
      ctx.fillStyle = baseGradient;
      ctx.fill();
      ctx.restore();

      ctx.save();
      drawOctagon(ctx, 128, 128, 106, .30);
      ctx.strokeStyle = colorWithAlpha(color, .88);
      ctx.lineWidth = 3.4;
      ctx.stroke();
      drawOctagon(ctx, 128, 128, 82, .30);
      ctx.strokeStyle = "rgba(239, 231, 212, .32)";
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.strokeStyle = "rgba(239, 231, 212, .26)";
      ctx.lineWidth = 1;
      for (let i = 0; i < 8; i++) {{
        const angle = (Math.PI * 2 * i) / 8;
        const inner = 91;
        const outer = 104;
        ctx.beginPath();
        ctx.moveTo(128 + Math.cos(angle) * inner, 128 + Math.sin(angle) * inner);
        ctx.lineTo(128 + Math.cos(angle) * outer, 128 + Math.sin(angle) * outer);
        ctx.stroke();
      }}
      ctx.restore();

      drawGlyphMotif(ctx, node, color);

      ctx.save();
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "rgba(239,231,212,.94)";
      ctx.font = "700 54px PingFang SC, Microsoft YaHei, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowColor = colorWithAlpha(color, .50);
      ctx.shadowBlur = 12;
      ctx.fillText(glyphForNode(node), 128, 124);
      ctx.restore();

      ctx.fillStyle = "#efe7d4";
      ctx.font = "700 15px PingFang SC, Microsoft YaHei, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(node.typeLabel, 128, 183);

      ctx.save();
      ctx.strokeStyle = colorWithAlpha(color, .56);
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(89, 196);
      ctx.lineTo(167, 196);
      ctx.stroke();
      ctx.restore();

      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.needsUpdate = true;
      textureCache.set(key, texture);
      return texture;
    }}

    function occlusionTextureForNode(node) {{
      const key = node.hasImage ? "image-node-occluder" : "sigil-node-occluder";
      if (occlusionTextureCache.has(key)) return occlusionTextureCache.get(key);
      const canvas = document.createElement("canvas");
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext("2d");
      const gradient = ctx.createRadialGradient(128, 128, 40, 128, 128, 126);
      gradient.addColorStop(0, "rgba(5, 9, 10, .98)");
      gradient.addColorStop(.66, "rgba(5, 9, 10, .92)");
      gradient.addColorStop(.84, "rgba(5, 9, 10, .58)");
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
    }}

    function makeNodeObject(node) {{
      const group = new THREE.Group();
      const degree = Math.max(1, node.degree || 1);
      const focus = activeFocusNode();
      const active = focus && node.id === focus.id;
      const opacity = nodeOpacity(node);
      const rankBase = {{ core: 34, major: 22, secondary: 14, micro: 10 }}[node.visualRank] || 11;
      const size = (rankBase + Math.min(12, Math.sqrt(degree) * 1.35)) * (active ? 1.20 : (opacity < .30 ? .88 : 1));
      const imageScale = node.hasImage ? (active ? 1.72 : 1.16) : 1.34;
      const occlusionScale = size * imageScale * (node.hasImage ? 1.24 : 1.34);
      const depthShieldMaterial = new THREE.SpriteMaterial({{
        map: occlusionTextureForNode(node),
        alphaTest: .20,
        depthWrite: true,
        depthTest: true,
        colorWrite: false,
        transparent: false,
      }});
      const depthShield = new THREE.Sprite(depthShieldMaterial);
      depthShield.scale.set(occlusionScale * 1.03, occlusionScale * 1.03, 1);
      depthShield.renderOrder = -20;
      group.add(depthShield);
      const glowOpacity = Math.min(active ? .54 : .32, opacity * (node.visualRank === "core" ? .54 : (node.featured ? .38 : .22)));
      if (glowOpacity > .025) {{
        const glowScale = occlusionScale * (node.visualRank === "core" ? 2.15 : (active ? 1.96 : 1.58));
        const glow = new THREE.Sprite(new THREE.SpriteMaterial({{
          map: softGlowTexture(),
          color: new THREE.Color(node.color || "#57d7be"),
          transparent: true,
          opacity: glowOpacity,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          depthTest: false,
        }}));
        glow.scale.set(glowScale, glowScale, 1);
        glow.renderOrder = -16;
        glow.userData.baseScale = glowScale;
        glow.userData.breathAmp = active ? .045 : .022;
        glow.userData.phase = randomOffset(node.id, 2);
        breathingObjects.add(glow);
        group.add(glow);
      }}
      const occlusionMaterial = new THREE.SpriteMaterial({{
        map: occlusionTextureForNode(node),
        transparent: true,
        opacity: Math.min(.98, Math.max(.48, opacity + .24)),
        alphaTest: .16,
        depthWrite: true,
        depthTest: true,
      }});
      const occlusionSprite = new THREE.Sprite(occlusionMaterial);
      occlusionSprite.scale.set(occlusionScale, occlusionScale, 1);
      occlusionSprite.renderOrder = -10;
      group.add(occlusionSprite);
      const texture = textureForNode(node);
      const material = new THREE.SpriteMaterial({{
        map: texture,
        transparent: true,
        opacity,
        alphaTest: .08,
        depthWrite: true,
        depthTest: true,
      }});
      const sprite = new THREE.Sprite(material);
      sprite.scale.set(size * imageScale, size * imageScale, 1);
      sprite.renderOrder = 10;
      group.add(sprite);
      if (node.visualRank === "core" || active) {{
        const ringGeo = new THREE.TorusGeometry(size * .88, .34, 10, 64);
        const ringMat = new THREE.MeshBasicMaterial({{ color: node.color, transparent: true, opacity: Math.max(.18, opacity * .58) }});
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = Math.PI / 2;
        ring.userData.spinSpeed = active ? .014 : .0035;
        ring.userData.pulse = Boolean(active);
        ring.userData.baseOpacity = Math.max(.18, opacity * .58);
        ring.userData.phase = randomOffset(node.id, 2);
        animatedObjects.add(ring);
        group.add(ring);
        if (active) {{
          const haloGeo = new THREE.TorusGeometry(size * 1.24, .18, 8, 96);
          const haloMat = new THREE.MeshBasicMaterial({{ color: node.color, transparent: true, opacity: .34 }});
          const halo = new THREE.Mesh(haloGeo, haloMat);
          halo.rotation.x = Math.PI / 2;
          halo.rotation.y = Math.PI / 10;
          halo.userData.spinSpeed = -.009;
          halo.userData.pulse = true;
          halo.userData.baseOpacity = .32;
          halo.userData.phase = randomOffset(node.id, 1);
          animatedObjects.add(halo);
          group.add(halo);
        }}
      }}
      if (shouldShowLabel(node)) {{
        const label = new SpriteText(node.label);
        label.color = "#efe7d4";
        label.textHeight = node.visualRank === "core" ? 5.0 : 3.8;
        label.backgroundColor = active ? "rgba(5, 9, 10, .62)" : "rgba(5, 9, 10, .34)";
        label.padding = 1.2;
        label.borderRadius = 3;
        label.position.y = -size * 1.15;
        label.renderOrder = 20;
        group.add(label);
      }}
      return group;
    }}

    function graphForCurrentState() {{
      const q = query.trim().toLowerCase();
      let nodes = allNodes.filter(node => (mode === "all" || node.featured || storyNodeIds.has(node.id)) && matchesKind(node));
      if (activeCluster !== "all") {{
        nodes = nodes.filter(node => node.cluster === activeCluster || node.cluster === "core");
      }}
      if (q) {{
        const searchBase = allNodes.filter(node => matchesKind(node));
        const hits = new Set(searchBase.filter(node =>
          node.label.toLowerCase().includes(q) ||
          (node.summary || "").toLowerCase().includes(q) ||
          node.typeLabel.toLowerCase().includes(q)
        ).map(node => node.id));
        [...hits].forEach(id => neighbors.get(id)?.forEach(next => hits.add(next)));
        nodes = allNodes.filter(node => hits.has(node.id));
      }}
      const ids = new Set(nodes.map(node => node.id));
      const links = allLinks
        .filter(link => ids.has(link.sourceId) && ids.has(link.targetId))
        .map(link => ({{ ...link, source: link.sourceId, target: link.targetId }}));
      nodes = nodes.map(node => {{
        const [rx, ry, rz] = orbitalPositionForNode(node);
        return {{ ...node, x: rx, y: ry, z: rz, fx: rx, fy: ry, fz: rz }};
      }});
      return {{ nodes, links }};
    }}

    function matchesKind(node) {{
      if (activeKind === "all") return true;
      if (activeKind === "race") return node.type === "race";
      if (activeKind === "faction") return node.type === "faction";
      if (activeKind === "ecology") return node.type === "creature" || node.type === "place";
      if (activeKind === "relation") return node.type === "relation";
      if (activeKind === "corruption") {{
        const text = `${{node.label}} ${{node.summary || ""}} ${{node.clusterLabel || ""}}`;
        return node.cluster === "corruption" || node.cluster === "hunt" || /污染|腐|孢|旧神|血契|眷族|克苏鲁|管巢/.test(text);
      }}
      return true;
    }}

    function randomOffset(id, axis) {{
      let h = 0;
      for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i) + axis * 97) % 9973;
      return ((h / 9973) - .5) * (axis === 2 ? 70 : 95);
    }}

    function applyGraph() {{
      selectedNode = null;
      hoverNode = null;
      const data = graphForCurrentState();
      Graph.graphData(data);
      showOverviewPanel();
      updateFocusStatus();
      updateFocusVisuals();
      const q = query.trim().toLowerCase();
      if (q) {{
        setTimeout(() => {{
          const exact = Graph.graphData().nodes.find(node => node.label.toLowerCase() === q);
          if (exact) selectNode(exact, true);
        }}, 450);
      }}
    }}

    function buildKindFilters() {{
      const wrap = document.getElementById("kindFilters");
      kindFilters.forEach(([key, label]) => {{
        const button = document.createElement("button");
        button.className = `filter-button ${{key === activeKind ? "active" : ""}}`;
        button.dataset.kind = key;
        button.textContent = label;
        button.addEventListener("click", () => {{
          activeKind = key;
          document.querySelectorAll(".filter-button").forEach(item => item.classList.toggle("active", item.dataset.kind === key));
          applyGraph();
        }});
        wrap.appendChild(button);
      }});
    }}

    function buildClusterRail() {{
      const rail = document.getElementById("clusters");
      const entries = [["all", "全部", "核心与档案"], ...Object.entries(clusterLabels)];
      entries.forEach(([key, label]) => {{
        const count = key === "all" ? allNodes.length : allNodes.filter(node => node.cluster === key).length;
        const button = document.createElement("button");
        button.className = `cluster ${{key === "all" ? "active" : ""}}`;
        button.dataset.cluster = key;
        button.style.setProperty("--zone-color", clusterColors[key] || clusterColors.archive);
        button.innerHTML = `<b>${{label}}</b><span>${{count}} 个节点</span>`;
        button.addEventListener("click", () => {{
          activeCluster = key;
          document.querySelectorAll(".cluster").forEach(item => item.classList.toggle("active", item.dataset.cluster === key));
          applyGraph();
        }});
        rail.appendChild(button);
      }});
    }}

    function buildStoryRibbon() {{
      const wrap = document.getElementById("storyPath");
      wrap.innerHTML = "";
      storyPaths.forEach(path => {{
        const button = document.createElement("button");
        button.className = `story-route ${{path.key === activeStoryKey ? "active" : ""}}`;
        button.dataset.route = path.key;
        button.textContent = path.label;
        button.addEventListener("click", () => {{
          activeStoryKey = path.key;
          selectedNode = null;
          hoverNode = null;
          buildStoryRibbon();
          showOverviewPanel();
          updateFocusStatus();
          updateFocusVisuals();
        }});
        wrap.appendChild(button);
      }});
      const divider = document.createElement("span");
      divider.className = "story-divider";
      wrap.appendChild(divider);
      activeStoryPath().forEach((id, index) => {{
        if (index > 0) {{
          const arrow = document.createElement("span");
          arrow.className = "story-arrow";
          arrow.textContent = "→";
          wrap.appendChild(arrow);
        }}
        const node = nodeById.get(id);
        const button = document.createElement("button");
        button.className = "story-node";
        button.dataset.node = id;
        button.textContent = node?.label || id;
        button.addEventListener("click", () => {{
          const visible = Graph.graphData().nodes.find(item => item.id === id);
          if (visible) {{
            selectNode(visible, true);
            return;
          }}
          query = id;
          document.getElementById("search").value = id;
          applyGraph();
          setTimeout(() => {{
            const next = Graph.graphData().nodes.find(item => item.id === id);
            if (next) selectNode(next, true);
          }}, 450);
        }});
        wrap.appendChild(button);
      }});
    }}

    function pathForNode(node) {{
      if (activeStorySet().has(node.id)) return activeStoryPath();
      const relatedPath = storyPaths.find(path => (path.nodes || []).includes(node.id));
      if (relatedPath) return relatedPath.nodes || [node.id];
      const related = [...(neighbors.get(node.id) || [])].filter(id => nodeById.has(id)).slice(0, 4);
      return [node.id, ...related];
    }}

    function clearFocus() {{
      selectedNode = null;
      hoverNode = null;
      enableGraphNavigation();
      Graph.controls().autoRotate = mode === "featured";
      showOverviewPanel();
      updateFocusStatus();
      updateFocusVisuals();
    }}

    function updateFocusStatus() {{
      const status = document.getElementById("focusStatus");
      const focus = activeFocusNode();
      if (selectedNode) {{
        status.textContent = `当前聚焦：${{selectedNode.label}}`;
      }} else if (hoverNode) {{
        status.textContent = `预览：${{hoverNode.label}}`;
      }} else {{
        const modeText = mode === "featured" ? "核心星图" : "全量图谱";
        const kindText = kindFilters.find(([key]) => key === activeKind)?.[1] || "全部";
        status.textContent = `第三观测层 · ${{modeText}} · ${{kindText}} · ${{activeStory().label}}`;
      }}
    }}

    function showOverviewPanel() {{
      const story = activeStory();
      const path = activeStoryPath().join(" → ");
      document.getElementById("panel").innerHTML = `
        <div class="hero-media"><div class="sigil"></div></div>
        <div class="panel-body">
          <h1>${{escapeHtml(story.label || "多路径世界图谱")}}</h1>
          <div class="meta">${{escapeHtml(path || story.summary || "核心关系路径")}}</div>
          <p class="summary">${{escapeHtml(story.summary || "默认视图保留核心节点、观测区、关键路径与已合并的冲突关系轴。")}}。点击节点锁定焦点后，相关路径与一跳邻居会高亮，其余节点和关系线自动降噪。</p>
          <div class="section-title">当前读图方式</div>
          <div class="info-block">底部路径按钮负责展示叙事入口，左侧类型和观测区负责检索过滤；它们共享同一张关系网，但展示路径会主动降噪。蓝色代表科技文明，绿色代表原生生态和巡猎链，铜橙代表工业财团与矿区，灰白代表管巢腐化与血契残响，紫色代表冲突关系和合并轴。</div>
          <div class="footer-note">点击空白处退出聚焦；使用左侧过滤区切换族群、组织、生态、污染或关系节点。</div>
        </div>`;
    }}

    function valueLine(value) {{
      if (Array.isArray(value)) return value.filter(Boolean).join(" / ");
      return value || "";
    }}

    function escapeHtml(value) {{
      return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;");
    }}

    function limitText(value, length = 360) {{
      const text = String(value || "").trim();
      if (text.length <= length) return text;
      return `${{text.slice(0, length)}}…`;
    }}

    function tagHtml(items) {{
      return items
        .filter(Boolean)
        .slice(0, 10)
        .map(item => `<span class="chip">${{escapeHtml(item)}}</span>`)
        .join("");
    }}

    function sectionBlock(title, text, compact = false) {{
      if (!text) return "";
      return `<div class="section-title">${{escapeHtml(title)}}</div><div class="info-block ${{compact ? "compact" : ""}}">${{escapeHtml(limitText(text, compact ? 520 : 780))}}</div>`;
    }}

    function openImageOverlay(src, label) {{
      if (!src) return;
      const overlay = document.getElementById("imageOverlay");
      const image = document.getElementById("imageOverlayImg");
      image.src = src;
      image.alt = `${{label}} 完整图片预览`;
      overlay.hidden = false;
    }}

    function selectNode(node, moveCamera) {{
      selectedNode = node;
      hoverNode = null;
      showPanel(node);
      updateFocusStatus();
      updateFocusVisuals();
      if (moveCamera) {{
        enableGraphNavigation();
        Graph.controls().autoRotate = false;
        const target = {{ x: node.x || 0, y: node.y || 0, z: node.z || 0 }};
        const len = Math.hypot(node.x || 0, node.y || 0, node.z || 0);
        const distance = node.hasImage ? 240 : 205;
        if (len < 18) {{
          Graph.cameraPosition({{ x: 72, y: -280, z: 360 }}, target, 760);
        }} else {{
          const ratio = 1 + distance / len;
          Graph.cameraPosition({{ x: (node.x || 1) * ratio, y: (node.y || 1) * ratio, z: (node.z || 1) * ratio }}, target, 760);
        }}
        setTimeout(enableGraphNavigation, 800);
      }}
    }}

    function showPanel(node) {{
      const details = node.details || {{}};
      const gallery = Array.isArray(node.gallery) && node.gallery.length
        ? node.gallery
        : (node.panelImage ? [{{ label: "图片", image: node.panelImage }}] : []);
      const hero = gallery[0] || null;
      const related = [...(neighbors.get(node.id) || [])]
        .map(id => nodeById.get(id))
        .filter(Boolean)
        .sort((a, b) => (b.featured - a.featured) || b.degree - a.degree)
        .slice(0, 7);
      const chips = [node.typeLabel, node.clusterLabel, valueLine(details.habitat), valueLine(details.weaknessTags)]
        .filter(Boolean)
        .flatMap(item => String(item).split(" / ").filter(Boolean))
        .slice(0, 8);
      const currentPath = pathForNode(node);
      const rows = [
        ["类型", node.typeLabel],
        ["归属", node.clusterLabel],
        ["层级", node.visualRank],
        ["连接度", node.degree],
        ["威胁", valueLine(details.threat) || "未定"],
        ["状态", valueLine(details.status) || "未定"],
        ["来源", valueLine(details.source) || "Obsidian"],
      ].filter(([, value]) => value !== "" && value !== undefined);
      document.getElementById("panel").innerHTML = `
        <div class="hero-media">
          ${{hero ? `<button class="image-open" data-image="${{hero.image}}" data-label="${{escapeHtml(node.label)}} · ${{escapeHtml(hero.label)}}"><img src="${{hero.image}}" alt="${{escapeHtml(node.label)}} · ${{escapeHtml(hero.label)}}"></button>${{gallery.length > 1 ? `<div class="gallery-tabs">${{gallery.map((item, index) => `<button class="gallery-tab ${{index === 0 ? "active" : ""}}" data-index="${{index}}">${{escapeHtml(item.label)}}</button>`).join("")}}</div>` : ""}}` : `<div class="sigil"></div>`}}
        </div>
        <div class="panel-body">
          <h1 class="node-title">${{hero ? `<img class="title-thumb" src="${{hero.image}}" alt="">` : ""}}<span>${{escapeHtml(node.label)}}</span></h1>
          <div class="meta">${{escapeHtml(node.typeLabel)}} · ${{escapeHtml(node.clusterLabel)}} · ${{node.degree}} 条连接</div>
          <p class="summary">${{escapeHtml(node.summary || "这个节点目前是图谱占位，后续可以扩写为完整设定条目。")}}</p>
          <div class="chips">${{tagHtml(chips)}}</div>
          <div class="section-title">当前路径</div>
          <div class="info-block">${{escapeHtml(currentPath.join(" → "))}}</div>
          <div class="section-title">核心资料</div>
          <div class="kv">${{rows.map(([label, value]) => `<div><b>${{escapeHtml(label)}}</b>${{escapeHtml(value)}}</div>`).join("")}}</div>
          <div class="detail-grid">
            <div>${{sectionBlock("外观", details.appearance, true)}}</div>
            <div>${{sectionBlock("能力", details.ability, true)}}</div>
            <div>${{sectionBlock("弱点 / 代价", details.weakness, true)}}</div>
            <div>${{sectionBlock("关系", details.relation, true)}}</div>
          </div>
          <div class="section-title">相邻节点</div>
          <div class="neighbor-list">
            ${{related.map(item => `<button data-node="${{escapeHtml(item.id)}}">${{escapeHtml(item.label)}} · ${{escapeHtml(item.typeLabel)}}</button>`).join("")}}
          </div>
          <div class="footer-note">路径：${{escapeHtml(node.path)}}。点击顶部图片可查看完整大图。</div>
        </div>`;
      const imageOpen = document.querySelector(".image-open");
      const heroImg = document.querySelector(".hero-media img");
      document.querySelectorAll(".gallery-tab").forEach(button => {{
        button.addEventListener("click", () => {{
          const item = gallery[Number(button.dataset.index)];
          if (!item || !imageOpen || !heroImg) return;
          heroImg.src = item.image;
          heroImg.alt = `${{node.label}} · ${{item.label}}`;
          imageOpen.dataset.image = item.image;
          imageOpen.dataset.label = `${{node.label}} · ${{item.label}}`;
          document.querySelectorAll(".gallery-tab").forEach(tab => tab.classList.toggle("active", tab === button));
        }});
      }});
      imageOpen?.addEventListener("click", event => {{
        openImageOverlay(event.currentTarget.dataset.image, event.currentTarget.dataset.label);
      }});
      document.querySelectorAll(".neighbor-list button").forEach(button => {{
        button.addEventListener("click", () => {{
          const id = button.dataset.node;
          const next = Graph.graphData().nodes.find(item => item.id === id) || nodeById.get(id);
          if (next) {{
            if (!Graph.graphData().nodes.find(item => item.id === id)) {{
              query = id;
              document.getElementById("search").value = id;
              applyGraph();
              setTimeout(() => {{
                const visible = Graph.graphData().nodes.find(item => item.id === id);
                if (visible) selectNode(visible, true);
              }}, 700);
            }} else {{
              selectNode(next, true);
            }}
          }}
        }});
      }});
    }}

    document.getElementById("search").addEventListener("input", event => {{
      query = event.target.value;
      applyGraph();
    }});
    document.getElementById("modeFeatured").addEventListener("click", () => {{
      mode = "featured";
      document.getElementById("modeFeatured").classList.add("active");
      document.getElementById("modeAll").classList.remove("active");
      enableGraphNavigation();
      Graph.controls().autoRotate = true;
      applyGraph();
    }});
    document.getElementById("modeAll").addEventListener("click", () => {{
      mode = "all";
      document.getElementById("modeAll").classList.add("active");
      document.getElementById("modeFeatured").classList.remove("active");
      enableGraphNavigation();
      Graph.controls().autoRotate = false;
      applyGraph();
    }});
    document.getElementById("reset").addEventListener("click", () => {{
      query = "";
      activeCluster = "all";
      activeKind = "all";
      document.getElementById("search").value = "";
      document.querySelectorAll(".cluster").forEach(item => item.classList.toggle("active", item.dataset.cluster === "all"));
      document.querySelectorAll(".filter-button").forEach(item => item.classList.toggle("active", item.dataset.kind === "all"));
      enableGraphNavigation();
      Graph.controls().autoRotate = mode === "featured";
      Graph.cameraPosition({{ x: 130, y: -520, z: 920 }}, {{ x: 0, y: 0, z: 0 }}, 900);
      applyGraph();
    }});
    document.getElementById("closeImageOverlay").addEventListener("click", () => {{
      document.getElementById("imageOverlay").hidden = true;
    }});
    document.getElementById("imageOverlay").addEventListener("click", event => {{
      if (event.target.id === "imageOverlay") event.currentTarget.hidden = true;
    }});

    setTimeout(() => document.getElementById("loading").classList.add("done"), 900);
  </script>
</body>
</html>
"""
    HTML_OUT.write_text(html, encoding="utf-8")
    STRATEGIC_HTML_OUT.write_text(html, encoding="utf-8")


def ensure_local_vendor_assets() -> None:
    missing = [str(path.relative_to(ROOT)) for path in LOCAL_VENDOR_ASSETS.values() if not path.exists()]
    if missing:
        missing_list = "\n".join(f"- {path}" for path in missing)
        raise FileNotFoundError(f"Missing local vendor assets:\n{missing_list}")


def write_legacy_redirect() -> None:
    redirect = """<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta http-equiv="refresh" content="0; url=黑曜纪元星图3D.html">
  <title>跳转到黑曜纪元星图 3D</title>
  <style>
    html, body { margin: 0; min-height: 100%; background: #020403; color: #efe7d4; font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif; }
    main { min-height: 100vh; display: grid; place-items: center; text-align: center; padding: 32px; }
    a { color: #d7bd84; }
  </style>
</head>
<body>
  <main>
    <div>
      <h1>正在打开新版星图 3D</h1>
      <p>如果没有自动跳转，请打开 <a href="黑曜纪元星图3D.html">黑曜纪元星图3D.html</a>。</p>
    </div>
  </main>
</body>
</html>
"""
    LEGACY_HTML_OUT.write_text(redirect, encoding="utf-8")


def main() -> None:
    ensure_local_vendor_assets()
    graph = build_graph()
    JSON_OUT.write_text(json.dumps(graph, ensure_ascii=False, indent=2), encoding="utf-8")
    write_html(graph)
    write_legacy_redirect()
    featured = sum(1 for node in graph["nodes"] if node["featured"])
    images = sum(1 for node in graph["nodes"] if node["hasImage"])
    print(f"wrote {HTML_OUT}")
    print(f"wrote {STRATEGIC_HTML_OUT}")
    print(f"wrote {JSON_OUT}")
    print(f"nodes={len(graph['nodes'])} links={len(graph['links'])} featured={featured} image_nodes={images}")


if __name__ == "__main__":
    main()
