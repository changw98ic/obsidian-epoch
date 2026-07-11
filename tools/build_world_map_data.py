from __future__ import annotations

import hashlib
import json
import math
import re
from collections import Counter, defaultdict
from datetime import datetime, timezone, timedelta
from pathlib import Path
from urllib.parse import quote


ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "00_总览"
JSON_OUT = OUT_DIR / "world-map-data.json"
IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".gif"}


LAYERS = [
    {
        "id": "sky_orbit",
        "label": "高空轨道层",
        "elevation": 150,
        "order": 1,
        "color": "#9fc9ff",
        "summary": "低轨残骸、云端墓园、星外坠落和轨道污染。",
        "keywords": ["高空", "低轨", "轨道", "云端", "云墓", "星历", "坠落", "天空", "舰", "高科技", "云脑", "白械"],
    },
    {
        "id": "surface_city",
        "label": "地表城市层",
        "elevation": 70,
        "order": 2,
        "color": "#66d6d1",
        "summary": "城市管网、赛博工业、实验室、数据巷、全息剧场和废弃地铁。",
        "keywords": ["城市", "管道", "工业", "数据", "全息", "地铁", "实验室", "黑诊所", "服务器", "街", "剧场", "接口", "屏幕", "娱乐"],
    },
    {
        "id": "surface_ecology",
        "label": "地表生态层",
        "elevation": 0,
        "order": 3,
        "color": "#5fc779",
        "summary": "腐林、湿谷、山海森林、荒原、墓园和野外异化生态。",
        "keywords": ["腐林", "湿谷", "森林", "山海", "荒原", "墓园", "草场", "巢", "菌", "苔", "藤", "林", "原"],
    },
    {
        "id": "underground_mine",
        "label": "地下矿区层",
        "elevation": -75,
        "order": 4,
        "color": "#d29a5f",
        "summary": "废弃矿区、神尸矿脉、地下根系和采掘污染。",
        "keywords": ["矿", "地下", "神尸", "根下", "洞穴", "骨脉", "煤", "井", "矿脉"],
    },
    {
        "id": "deep_sea",
        "label": "深海层",
        "elevation": -150,
        "order": 5,
        "color": "#4f7fca",
        "summary": "深海尸骸、盐化、溺湾、海沟和旧神低语。",
        "keywords": ["深海", "海", "湾", "盐", "渊", "尸骸", "海沟", "潮", "溺"],
    },
    {
        "id": "alien_dimension",
        "label": "异维梦境层",
        "elevation": 225,
        "order": 6,
        "color": "#b690ff",
        "summary": "梦境、量子实验、非三维空间、裂隙和时间线异常。",
        "keywords": ["梦", "量子", "裂隙", "非三维", "高维", "时间", "旧神", "克苏鲁", "星外", "星序", "星遗", "星瘤", "修行", "修士", "魔法", "神秘", "神系", "北欧", "世界树", "东方", "西方", "镜", "回声", "记忆"],
    },
    {
        "id": "archive_frontier",
        "label": "未归档边界",
        "elevation": -225,
        "order": 7,
        "color": "#8b95a7",
        "summary": "缺少明确栖息地或只能弱推断的条目。",
        "keywords": [],
    },
]

LAYER_BY_ID = {layer["id"]: layer for layer in LAYERS}
PLACE_ROOTS = {
    "高空低轨": "sky_orbit",
    "城市管道": "surface_city",
    "工业废液": "surface_city",
    "腐林": "surface_ecology",
    "腐化森林": "surface_ecology",
    "湿谷": "surface_ecology",
    "山海森林": "surface_ecology",
    "废弃矿区": "underground_mine",
    "神尸矿区": "underground_mine",
    "深海尸骸": "deep_sea",
    "非三维空间": "alien_dimension",
}

THREAT_ORDER = {"未知": 0, "E": 1, "D": 2, "C": 3, "B": 4, "A": 5, "S": 6}
CREATURE_REQUIRED_FIELDS = [
    "serial",
    "habitat",
    "threat",
    "rank_role",
    "alignment",
    "visual_tendency",
    "visual_style",
    "image_ready",
]


def stable_int(value: str, modulo: int = 10_000) -> int:
    digest = hashlib.sha256(value.encode("utf-8")).hexdigest()
    return int(digest[:12], 16) % modulo


def clean_target(value: object) -> str:
    text = str(value or "").strip().strip('"')
    text = re.sub(r"^!?\[\[", "", text)
    text = re.sub(r"\]\]$", "", text)
    return text.split("|", 1)[0].split("#", 1)[0].strip()


def clean_text(value: object) -> str:
    text = str(value or "")
    text = re.sub(r"!\[\[[^\]]+\]\]", "", text)
    text = re.sub(r"\[\[([^|\]]+)\|([^\]]+)\]\]", r"\2", text)
    text = re.sub(r"\[\[([^\]]+)\]\]", r"\1", text)
    text = re.sub(r"`([^`]+)`", r"\1", text)
    text = re.sub(r"\*\*([^*]+)\*\*", r"\1", text)
    text = re.sub(r"^[-*]\s+", "", text, flags=re.M)
    return re.sub(r"\s+", " ", text).strip()


def parse_scalar(value: str) -> object:
    value = value.strip()
    if not value:
        return ""
    if value[0:1] in {"'", '"'} and value[-1:] == value[0]:
        value = value[1:-1]
    if value.lower() == "true":
        return True
    if value.lower() == "false":
        return False
    return value


def parse_frontmatter(text: str) -> dict[str, object]:
    if not text.startswith("---\n"):
        return {}
    end = text.find("\n---", 4)
    if end == -1:
        return {}
    data: dict[str, object] = {}
    current_key: str | None = None
    for raw_line in text[4:end].splitlines():
        if not raw_line.strip():
            continue
        if raw_line.startswith("  - ") and current_key:
            data.setdefault(current_key, [])
            if isinstance(data[current_key], list):
                data[current_key].append(parse_scalar(raw_line[4:]))
            continue
        if ":" in raw_line and not raw_line.startswith(" "):
            key, value = raw_line.split(":", 1)
            current_key = key.strip()
            value = value.strip()
            data[current_key] = parse_scalar(value) if value else []
    return data


def strip_frontmatter(text: str) -> str:
    return re.sub(r"^---\n.*?\n---\n", "", text, flags=re.S).strip()


def note_title(path: Path, text: str) -> str:
    body = strip_frontmatter(text)
    match = re.search(r"^#\s+(.+)$", body, flags=re.M)
    if match:
        return match.group(1).strip()
    return re.sub(r"^B\d+_", "", path.stem)


def first_summary(text: str) -> str:
    body = strip_frontmatter(text)
    quote = re.search(r"^>\s*(.+)$", body, flags=re.M)
    if quote:
        return clean_text(quote.group(1))[:260]
    body = re.sub(r"^# .+$", "", body, flags=re.M)
    for paragraph in re.split(r"\n\s*\n", body):
        paragraph = paragraph.strip()
        if paragraph and not paragraph.startswith(("##", "```", "![[", "|")):
            return clean_text(paragraph)[:260]
    return ""


def extract_sections(text: str) -> dict[str, str]:
    body = strip_frontmatter(text)
    matches = list(re.finditer(r"^##\s+(.+)$", body, flags=re.M))
    sections: dict[str, str] = {}
    for index, match in enumerate(matches):
        title = match.group(1).strip()
        start = match.end()
        end = matches[index + 1].start() if index + 1 < len(matches) else len(body)
        value = clean_text(body[start:end])
        if value:
            sections[title] = value
    return sections


def list_value(value: object) -> list[str]:
    if isinstance(value, list):
        raw_items = value
    elif value:
        raw_items = re.split(r"\s*/\s*|\s*、\s*|\s*,\s*", str(value))
    else:
        raw_items = []
    items: list[str] = []
    for item in raw_items:
        item = clean_target(item)
        if item and item not in items:
            items.append(item)
    return items


def wiki_links(text: str) -> list[str]:
    links: list[str] = []
    for match in re.finditer(r"\[\[([^|\]#]+)(?:[|#][^\]]*)?\]\]", text):
        target = clean_target(match.group(1))
        if target and target not in links:
            links.append(target)
    return links


def image_index() -> dict[str, Path]:
    index: dict[str, Path] = {}
    for path in ROOT.rglob("*"):
        if path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS:
            index.setdefault(path.name, path)
    return index


def image_asset(path: Path, assets: dict[str, dict[str, str]]) -> str:
    digest = hashlib.sha1(str(path.relative_to(ROOT)).encode("utf-8")).hexdigest()[:10]
    target = f"assets/media/{digest}_{path.name}"
    assets[target] = {
        "sourcePath": str(path.relative_to(ROOT)),
        "targetPath": target,
    }
    return f"./{quote(target, safe='./')}"


def resolve_image(value: object, images: dict[str, Path], assets: dict[str, dict[str, str]]) -> str:
    filename = clean_target(value)
    if not filename:
        return ""
    path = images.get(Path(filename).name)
    return image_asset(path, assets) if path else ""


def resolve_embeds(text: str, images: dict[str, Path], assets: dict[str, dict[str, str]]) -> list[dict[str, str]]:
    gallery: list[dict[str, str]] = []
    seen: set[str] = set()
    for match in re.finditer(r"!\[\[([^\]]+\.(?:png|jpe?g|webp|gif))(?:\|[^\]]*)?\]\]", text, flags=re.I):
        filename = clean_target(match.group(1))
        path = images.get(Path(filename).name)
        if not path:
            continue
        url = image_asset(path, assets)
        if url in seen:
            continue
        seen.add(url)
        label = "档案卡" if "档案" in path.stem else "节点图" if ("正面" in path.stem or "节点" in path.stem) else "图片"
        gallery.append({"label": label, "image": url})
    return gallery


def classify_layer(*parts: object) -> tuple[str, str, str]:
    haystack = " ".join(clean_text(part) for part in parts if part)
    if not haystack:
        return "archive_frontier", "low", "missing habitat"
    for place, layer_id in PLACE_ROOTS.items():
        if place in haystack:
            return layer_id, "high", f"known place: {place}"
    best_layer = "archive_frontier"
    best_score = 0
    best_keyword = ""
    for layer in LAYERS:
        score = 0
        keyword_hit = ""
        for keyword in layer["keywords"]:
            if keyword and keyword in haystack:
                score += 1
                keyword_hit = keyword_hit or keyword
        if score > best_score:
            best_layer = layer["id"]
            best_score = score
            best_keyword = keyword_hit
    if best_score:
        return best_layer, "medium", f"keyword: {best_keyword}"
    return "archive_frontier", "low", "no layer keyword"


def region_position(label: str, layer_id: str, index: int) -> list[float]:
    layer = LAYER_BY_ID[layer_id]
    orbit = 120 + (index % 4) * 36
    angle = (stable_int(label, 3600) / 3600) * math.tau
    x = math.cos(angle) * orbit
    z = math.sin(angle) * orbit
    return [round(x, 2), float(layer["elevation"]), round(z, 2)]


def entity_position(entity_id: str, center: list[float]) -> list[float]:
    angle = (stable_int(entity_id, 3600) / 3600) * math.tau
    radius = 7 + stable_int(f"{entity_id}:r", 1900) / 100
    y_jitter = (stable_int(f"{entity_id}:y", 900) / 100) - 4.5
    return [
        round(center[0] + math.cos(angle) * radius, 2),
        round(center[1] + y_jitter, 2),
        round(center[2] + math.sin(angle) * radius, 2),
    ]


def threat_value(value: object) -> str:
    text = clean_text(value).upper()
    for threat in ["S", "A", "B", "C", "D", "E"]:
        if threat in text:
            return threat
    return "未知"


def overlay_roles(kind: str, details: dict[str, object], text: str) -> list[str]:
    roles: list[str] = []
    if kind in {"creature", "place"}:
        roles.append("ecology")
    if kind == "faction" or re.search(r"势力|造物|眷族|宗|庭|会|财团|学院|族|所属势力", text):
        roles.append("faction")
    threat = threat_value(details.get("threat"))
    if kind == "route" or threat in {"A", "S"} or re.search(r"冲突|污染|灾|裂隙|旧神|神尸|血契|克苏鲁", text):
        roles.append("conflict")
    return roles or ["ecology"]


def detail_subset(frontmatter: dict[str, object], sections: dict[str, str], summary: str) -> dict[str, object]:
    details: dict[str, object] = {
        "summary": summary,
        "serial": frontmatter.get("serial", ""),
        "seed_id": frontmatter.get("seed_id", ""),
        "source": frontmatter.get("source", ""),
        "type": frontmatter.get("type", ""),
        "base": list_value(frontmatter.get("base")),
        "habitat": clean_text(frontmatter.get("habitat")),
        "threat": threat_value(frontmatter.get("threat")),
        "rank_role": clean_text(frontmatter.get("rank_role")),
        "alignment": clean_text(frontmatter.get("alignment")),
        "visual_tendency": clean_text(frontmatter.get("visual_tendency")),
        "visual_style": clean_text(frontmatter.get("visual_style")),
        "weakness": clean_text(frontmatter.get("weakness")) or sections.get("弱点", ""),
        "status": clean_text(frontmatter.get("status")),
        "image_ready": bool(frontmatter.get("image_ready")),
        "relation": sections.get("关系", ""),
        "appearance": sections.get("外观", ""),
        "ability": sections.get("能力", ""),
        "behavior": sections.get("行为", ""),
        "resources": sections.get("可采集资源", ""),
    }
    return details


def markdown_files(folder: str) -> list[Path]:
    root = ROOT / folder
    return sorted(root.glob("*.md")) if root.exists() else []


def read_note(path: Path) -> tuple[str, dict[str, object], dict[str, str], str, str]:
    text = path.read_text(encoding="utf-8")
    frontmatter = parse_frontmatter(text)
    sections = extract_sections(text)
    return text, frontmatter, sections, note_title(path, text), first_summary(text)


def build_world_map() -> dict[str, object]:
    images = image_index()
    assets: dict[str, dict[str, str]] = {}
    places: dict[str, dict[str, object]] = {}
    regions_by_label: dict[str, dict[str, object]] = {}
    habitat_counts: Counter[str] = Counter()
    habitat_entities: defaultdict[str, list[str]] = defaultdict(list)
    region_index_by_layer: defaultdict[str, int] = defaultdict(int)
    entities: list[dict[str, object]] = []
    routes: list[dict[str, object]] = []

    for path in markdown_files("05_地点生态"):
        text, frontmatter, sections, label, summary = read_note(path)
        layer_id, confidence, reason = classify_layer(label, summary, frontmatter.get("type"))
        region_id = f"region:{label}"
        position = region_position(label, layer_id, region_index_by_layer[layer_id])
        region_index_by_layer[layer_id] += 1
        region = {
            "id": region_id,
            "label": label,
            "layer": layer_id,
            "position": position,
            "radius": 38 + stable_int(label, 2400) / 100,
            "terrain": layer_id,
            "confidence": confidence,
            "placementReason": reason,
            "sourcePath": str(path.relative_to(ROOT)),
            "summary": summary,
        }
        places[label] = region
        regions_by_label[label] = region
        entities.append(
            {
                "id": f"place:{label}",
                "label": label,
                "kind": "place",
                "sourceKind": "place",
                "layer": layer_id,
                "region": region_id,
                "habitat": label,
                "position": position,
                "overlayRoles": ["ecology", "conflict"] if re.search(r"污染|神尸|腐|裂隙", text) else ["ecology"],
                "confidence": confidence,
                "placementReason": reason,
                "sourcePath": str(path.relative_to(ROOT)),
                "details": {"summary": summary, "type": clean_text(frontmatter.get("type")), "status": clean_text(frontmatter.get("status")), "relation": sections.get("关系", "")},
                "gallery": [],
            }
        )

    def ensure_region(habitat: str, layer_id: str, confidence: str, reason: str) -> dict[str, object]:
        label = habitat or "未归档边界"
        if label in regions_by_label:
            return regions_by_label[label]
        region_id = f"region:{label}"
        position = region_position(label, layer_id, region_index_by_layer[layer_id])
        region_index_by_layer[layer_id] += 1
        region = {
            "id": region_id,
            "label": label,
            "layer": layer_id,
            "position": position,
            "radius": 28 + stable_int(label, 1800) / 100,
            "terrain": layer_id,
            "confidence": confidence,
            "placementReason": reason,
            "sourcePath": "",
            "summary": "由生物栖息地自动生成的地图区域。",
        }
        regions_by_label[label] = region
        return region

    def add_anchor_note(path: Path, kind: str, source_kind: str, default_type: str, roles: list[str]) -> None:
        text, frontmatter, sections, label, summary = read_note(path)
        layer_id, confidence, reason = classify_layer(label, summary, text[:1000], frontmatter.get("type"))
        region = ensure_region(label, layer_id, confidence, reason)
        entity_id = f"{kind}:{label}"
        entities.append(
            {
                "id": entity_id,
                "label": label,
                "kind": kind,
                "sourceKind": source_kind,
                "layer": layer_id,
                "region": region["id"],
                "habitat": label,
                "position": entity_position(entity_id, region["position"]),
                "overlayRoles": roles,
                "confidence": confidence,
                "placementReason": reason,
                "sourcePath": str(path.relative_to(ROOT)),
                "details": {
                    "summary": summary,
                    "type": clean_text(frontmatter.get("type")) or default_type,
                    "base": list_value(frontmatter.get("base")),
                    "threat": "未知",
                    "rank_role": "未知",
                    "alignment": "",
                    "visual_tendency": "",
                    "visual_style": "",
                    "weakness": "",
                    "status": clean_text(frontmatter.get("status")),
                    "image_ready": False,
                    "relation": sections.get("关系", "") or sections.get("双方", ""),
                    "appearance": sections.get("风格", ""),
                },
                "gallery": [],
                "links": wiki_links(text)[:24],
                "searchText": clean_text(f"{label} {summary} {text[:800]}"),
            }
        )

    def add_creature(path: Path, source_kind: str) -> None:
        text, frontmatter, sections, label, summary = read_note(path)
        details = detail_subset(frontmatter, sections, summary)
        habitat = clean_text(frontmatter.get("habitat")) or clean_text(frontmatter.get("ecology")) or "未归档边界"
        layer_id, confidence, reason = classify_layer(habitat, details.get("base"), text[:800])
        if source_kind == "legacy_creature" and confidence != "high":
            confidence = "low"
        region = ensure_region(habitat, layer_id, confidence, reason)
        entity_id = path.stem if source_kind == "creature_unit" else f"legacy:{path.stem}"
        position = entity_position(entity_id, region["position"])
        node_image = resolve_image(frontmatter.get("node_image"), images, assets)
        panel_image = resolve_image(frontmatter.get("panel_image"), images, assets) or node_image
        card_image = resolve_image(frontmatter.get("card_image"), images, assets)
        gallery = resolve_embeds(text, images, assets)
        for label_name, image in [("节点图", node_image), ("档案卡", card_image), ("图片", panel_image)]:
            if image and all(item["image"] != image for item in gallery):
                gallery.insert(0, {"label": label_name, "image": image})
        entity = {
            "id": entity_id,
            "label": label,
            "kind": "creature",
            "sourceKind": source_kind,
            "layer": layer_id,
            "region": region["id"],
            "habitat": habitat,
            "position": position,
            "overlayRoles": overlay_roles("creature", details, text),
            "confidence": confidence,
            "placementReason": reason,
            "sourcePath": str(path.relative_to(ROOT)),
            "details": details,
            "nodeImage": node_image,
            "panelImage": panel_image,
            "cardImage": card_image,
            "gallery": gallery[:4],
            "links": wiki_links(text)[:24],
            "searchText": clean_text(" ".join([label, habitat, summary, str(details.get("base")), str(details.get("visual_style")), str(details.get("weakness"))])),
        }
        habitat_counts[habitat] += 1
        habitat_entities[habitat].append(entity_id)
        entities.append(entity)

    for path in markdown_files("01_世界底层"):
        add_anchor_note(path, "world", "world_system", "世界底层", ["ecology", "faction", "conflict"])

    for path in markdown_files("02_种族"):
        add_anchor_note(path, "race", "race", "种族", ["ecology", "faction", "conflict"])

    for path in markdown_files("03_势力组织"):
        add_anchor_note(path, "faction", "faction", "势力组织", ["faction", "conflict"])

    for path in markdown_files("04_生物单位"):
        add_creature(path, "creature_unit")

    for path in markdown_files("04_异化生物"):
        add_creature(path, "legacy_creature")

    for label, count in habitat_counts.items():
        region = regions_by_label.get(label)
        if region:
            region["entityCount"] = count
            threats = [threat_value(entity["details"].get("threat")) for entity in entities if entity.get("habitat") == label and entity.get("kind") == "creature"]
            dominant = Counter(threats).most_common(1)
            region["dominantThreat"] = dominant[0][0] if dominant else "未知"

    for path in markdown_files("08_关系网络"):
        text, frontmatter, sections, label, summary = read_note(path)
        sides = list_value(frontmatter.get("sides"))
        if "_vs_" in label and not sides:
            sides = [part.strip() for part in label.split("_vs_") if part.strip()]
        points: list[str] = []
        endpoint_labels: list[str] = []
        for side in sides:
            region = regions_by_label.get(side) or places.get(side)
            if not region:
                layer_id, side_confidence, side_reason = classify_layer(side, text[:800])
                confidence = "low" if side_confidence != "high" else "medium"
                region = ensure_region(side, layer_id, confidence, f"route side: {side_reason}")
            if region:
                endpoint_labels.append(side)
                if region["id"] not in points:
                    points.append(region["id"])
        if len(points) < 2:
            for place_label in places:
                if place_label in text and places[place_label]["id"] not in points:
                    points.append(places[place_label]["id"])
                    endpoint_labels.append(place_label)
        if len(points) >= 2 or clean_text(frontmatter.get("type")) == "冲突轴":
            routes.append(
                {
                    "id": f"route:{label}",
                    "label": label.replace("_vs_", " vs "),
                    "mode": "conflict",
                    "kind": clean_text(frontmatter.get("type")) or "关系网络",
                    "points": points[:8],
                    "endpointLabels": endpoint_labels[:8],
                    "confidence": "high" if len(points) >= 2 else "low",
                    "sourcePath": str(path.relative_to(ROOT)),
                    "summary": summary or sections.get("概述", ""),
                }
            )

    regions = list(regions_by_label.values())
    habitats = []
    for label, ids in sorted(habitat_entities.items()):
        region = regions_by_label.get(label)
        if not region:
            continue
        threats = [threat_value(entity["details"].get("threat")) for entity in entities if entity["id"] in ids]
        rank_roles = [clean_text(entity["details"].get("rank_role")) or "未知" for entity in entities if entity["id"] in ids]
        habitats.append(
            {
                "id": f"habitat:{label}",
                "label": label,
                "layer": region["layer"],
                "region": region["id"],
                "position": region["position"],
                "entityCount": len(ids),
                "dominantThreat": max(threats or ["未知"], key=lambda item: THREAT_ORDER.get(item, 0)),
                "dominantRankRole": Counter(rank_roles).most_common(1)[0][0] if rank_roles else "未知",
                "confidence": region["confidence"],
                "placementReason": region["placementReason"],
                "entities": ids[:160],
            }
        )

    hierarchy = []
    for layer in LAYERS:
        layer_regions = []
        for region in regions:
            if region["layer"] != layer["id"]:
                continue
            region_habitats = [habitat for habitat in habitats if habitat["region"] == region["id"]]
            layer_regions.append(
                {
                    "id": region["id"],
                    "label": region["label"],
                    "children": [{"id": habitat["id"], "label": habitat["label"], "children": habitat["entities"][:80]} for habitat in region_habitats],
                }
            )
        hierarchy.append({"id": layer["id"], "label": layer["label"], "children": layer_regions})

    creature_units = [entity for entity in entities if entity.get("sourceKind") == "creature_unit"]
    legacy_creatures = [entity for entity in entities if entity.get("sourceKind") == "legacy_creature"]
    source_stats = {
        "creatureUnits": len(creature_units),
        "legacyCreatures": len(legacy_creatures),
        "worldSystems": len(markdown_files("01_世界底层")),
        "races": len(markdown_files("02_种族")),
        "places": len(markdown_files("05_地点生态")),
        "factions": len(markdown_files("03_势力组织")),
        "regions": len(regions),
        "habitats": len(habitats),
        "entities": len(entities),
        "routes": len(routes),
        "assets": len(assets),
    }

    return {
        "schemaVersion": 1,
        "generatedAt": datetime.now(timezone(timedelta(hours=8))).isoformat(timespec="seconds"),
        "sourceStats": source_stats,
        "layers": [{key: value for key, value in layer.items() if key != "keywords"} for layer in LAYERS],
        "regions": sorted(regions, key=lambda item: (LAYER_BY_ID[item["layer"]]["order"], item["label"])),
        "habitats": habitats,
        "entities": entities,
        "routes": routes,
        "hierarchy": hierarchy,
        "assetManifest": sorted(assets.values(), key=lambda item: item["targetPath"]),
    }


def validate_world_map(data: dict[str, object]) -> list[str]:
    errors: list[str] = []
    layers = data.get("layers", [])
    entities = data.get("entities", [])
    stats = data.get("sourceStats", {})
    if len(layers) != 7:
        errors.append(f"expected 7 layers, got {len(layers)}")
    if int(stats.get("creatureUnits", 0)) < 1000:
        errors.append(f"expected at least 1000 creature units, got {stats.get('creatureUnits')}")
    for entity in entities:
        for key in ["layer", "position", "sourcePath", "confidence", "overlayRoles"]:
            if key not in entity or entity[key] in ("", [], None):
                errors.append(f"{entity.get('id')} missing {key}")
                break
    by_id = {entity.get("id"): entity for entity in entities}
    b0001 = by_id.get("B0001_云墓低语螺")
    if not b0001:
        errors.append("missing B0001_云墓低语螺")
    else:
        details = b0001.get("details", {})
        for key in CREATURE_REQUIRED_FIELDS:
            if key not in details or details[key] in ("", [], None):
                errors.append(f"B0001_云墓低语螺 missing details.{key}")
    region_by_id = {region.get("id"): region for region in data.get("regions", [])}
    for route in data.get("routes", []):
        points = route.get("points", [])
        endpoint_labels = route.get("endpointLabels", [])
        if len(points) < 2:
            errors.append(f"{route.get('id')} has fewer than 2 route points")
            continue
        for point in points:
            if point not in region_by_id:
                errors.append(f"{route.get('id')} route point {point} is missing from regions")
        if len(endpoint_labels) != len(points):
            errors.append(f"{route.get('id')} endpointLabels count does not match points count")
        else:
            for label, point in zip(endpoint_labels, points):
                region = region_by_id.get(point)
                if region and region.get("label") != label:
                    errors.append(f"{route.get('id')} endpoint label {label} does not match region {region.get('label')}")
    return errors


def main() -> None:
    data = build_world_map()
    errors = validate_world_map(data)
    if errors:
        raise SystemExit("world-map validation failed:\n" + "\n".join(f"- {error}" for error in errors[:40]))
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    JSON_OUT.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    stats = data["sourceStats"]
    print(
        "generated world map:",
        JSON_OUT.relative_to(ROOT),
        f"layers={len(data['layers'])}",
        f"creatureUnits={stats['creatureUnits']}",
        f"entities={stats['entities']}",
        f"regions={stats['regions']}",
        f"routes={stats['routes']}",
    )


if __name__ == "__main__":
    main()
