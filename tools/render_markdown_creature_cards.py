#!/usr/bin/env python3
"""Render creature dossier cards from Markdown `档案卡内容` blocks.

The ChatGPT image workflow is good at creature art, but unreliable at exact
Chinese text. This renderer keeps card copy source-of-truth in Markdown and
builds deterministic PNG dossier cards from it.
"""

from __future__ import annotations

import argparse
import json
import random
import re
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont, ImageOps


ROOT = Path(__file__).resolve().parents[1]
CREATURE_DIR = ROOT / "04_异化生物"
ASSET_DIR = ROOT / "09_素材与图片"
STYLE_MAP_PATH = ROOT / "tools" / "creature_image_styles.json"
LOW_TIER_TYPE = "势力低级生物"

CARD_SIZE = (1080, 1920)
FONT_PATHS = [
    "/System/Library/Fonts/Hiragino Sans GB.ttc",
    "/System/Library/Fonts/STHeiti Light.ttc",
    "/System/Library/Fonts/Supplemental/Songti.ttc",
    "/Library/Fonts/Arial Unicode.ttf",
]

STYLE_PALETTES = {
    "HUB全息冷白": {
        "bg": (16, 24, 29),
        "paper": (213, 229, 232),
        "panel": (26, 39, 45),
        "ink": (239, 249, 248),
        "muted": (153, 185, 190),
        "accent": (126, 215, 230),
        "accent2": (90, 116, 126),
    },
    "宣纸水墨": {
        "bg": (24, 25, 22),
        "paper": (224, 218, 196),
        "panel": (36, 38, 34),
        "ink": (245, 239, 215),
        "muted": (164, 154, 126),
        "accent": (175, 193, 178),
        "accent2": (91, 108, 97),
    },
    "银白审判档案": {
        "bg": (18, 20, 22),
        "paper": (229, 231, 224),
        "panel": (32, 34, 36),
        "ink": (244, 245, 239),
        "muted": (164, 169, 166),
        "accent": (214, 221, 218),
        "accent2": (142, 38, 44),
    },
    "黑底涂鸦档案": {
        "bg": (14, 12, 12),
        "paper": (211, 197, 174),
        "panel": (28, 22, 20),
        "ink": (239, 226, 205),
        "muted": (159, 135, 112),
        "accent": (190, 66, 54),
        "accent2": (87, 126, 81),
    },
    "暗金书卷档案": {
        "bg": (18, 14, 19),
        "paper": (229, 211, 170),
        "panel": (34, 26, 34),
        "ink": (244, 226, 190),
        "muted": (166, 135, 112),
        "accent": (205, 153, 61),
        "accent2": (108, 72, 144),
    },
    "锈黑工业档案": {
        "bg": (18, 15, 13),
        "paper": (214, 202, 178),
        "panel": (34, 29, 25),
        "ink": (239, 227, 204),
        "muted": (154, 132, 105),
        "accent": (196, 130, 55),
        "accent2": (105, 70, 46),
    },
    "暗黑奇幻手绘设定": {
        "bg": (15, 14, 14),
        "paper": (214, 201, 178),
        "panel": (30, 25, 23),
        "ink": (239, 226, 205),
        "muted": (154, 136, 115),
        "accent": (183, 91, 57),
        "accent2": (94, 84, 73),
    },
}


@dataclass
class CreatureCard:
    name: str
    file_path: Path
    frontmatter: dict[str, object]
    fields: dict[str, str]
    traits: list[str]
    style_name: str


def first_font_path() -> str:
    for candidate in FONT_PATHS:
        if Path(candidate).exists():
            return candidate
    raise SystemExit("No usable Chinese font found for card rendering.")


FONT_PATH = first_font_path()


def font(size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(FONT_PATH, size)


def parse_frontmatter(text: str) -> tuple[dict[str, object], str]:
    if not text.startswith("---\n"):
        return {}, text
    end = text.find("\n---", 4)
    if end == -1:
        return {}, text

    data: dict[str, object] = {}
    current_key = ""
    for line in text[4:end].splitlines():
        if not line.strip():
            continue
        if line.startswith("  - ") and current_key:
            values = data.setdefault(current_key, [])
            if isinstance(values, list):
                values.append(clean_text(line[4:]))
            continue
        if ":" not in line:
            continue
        key, raw = line.split(":", 1)
        current_key = key.strip()
        value = raw.strip()
        data[current_key] = clean_text(value) if value else []

    return data, text[end + 5 :]


def extract_h1(text: str, fallback: str) -> str:
    match = re.search(r"^#\s+(.+?)\s*$", text, re.MULTILINE)
    return match.group(1).strip() if match else fallback


def extract_section(text: str, heading: str) -> str:
    match = re.search(rf"^##\s+{re.escape(heading)}\s*\n([\s\S]*?)(?=^##\s+|\Z)", text, re.MULTILINE)
    return match.group(1).strip() if match else ""


def clean_text(value: object) -> str:
    text = str(value or "").strip().strip('"').strip("'")
    text = re.sub(r"!\[\[[^\]]+\]\]", "", text)
    text = re.sub(r"\[\[([^|\]]+)\|([^\]]+)\]\]", r"\2", text)
    text = re.sub(r"\[\[([^\]]+)\]\]", r"\1", text)
    text = re.sub(r"\*\*([^*]+)\*\*", r"\1", text)
    return re.sub(r"\s+", " ", text).strip()


def compact_trait_text(value: str) -> str:
    clauses = [part.strip() for part in re.split(r"[，；。]", clean_text(value)) if part.strip()]
    if not clauses:
        return clean_text(value)
    return clauses[0]


def parse_card_section(section: str) -> tuple[dict[str, str], list[str]]:
    fields: dict[str, str] = {}
    traits: list[str] = []
    current_label = ""

    for raw_line in section.splitlines():
        line = raw_line.rstrip()
        stripped = line.strip()
        if not stripped:
            continue

        nested = re.match(r"^\s+-\s+(.+)$", line)
        if nested and current_label == "局部特性" and not line.startswith("- "):
            traits.append(clean_text(nested.group(1)))
            continue

        top = re.match(r"^[-*]\s*([^：:]+)[：:]\s*(.*)$", stripped)
        if top:
            current_label = clean_text(top.group(1))
            value = clean_text(top.group(2))
            if current_label != "局部特性":
                fields[current_label] = value

    return fields, traits


def load_style_map() -> dict[str, str]:
    try:
        data = json.loads(STYLE_MAP_PATH.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return {}
    return data.get("creatures", {})


def read_cards(names: set[str] | None = None) -> list[CreatureCard]:
    style_map = load_style_map()
    cards: list[CreatureCard] = []
    for file_path in sorted(CREATURE_DIR.glob("*.md")):
        text = file_path.read_text(encoding="utf-8")
        frontmatter, body = parse_frontmatter(text)
        if frontmatter.get("type") != LOW_TIER_TYPE:
            continue
        name = extract_h1(body, file_path.stem)
        if names and name not in names:
            continue
        section = extract_section(body, "档案卡内容")
        if not section:
            raise SystemExit(f"Missing 档案卡内容: {file_path}")
        fields, traits = parse_card_section(section)
        cards.append(
            CreatureCard(
                name=name,
                file_path=file_path,
                frontmatter=frontmatter,
                fields=fields,
                traits=traits,
                style_name=style_map.get(name, "暗黑奇幻手绘设定"),
            )
        )
    return cards


def text_size(draw: ImageDraw.ImageDraw, text: str, fnt: ImageFont.FreeTypeFont) -> tuple[int, int]:
    if not text:
        return 0, 0
    left, top, right, bottom = draw.textbbox((0, 0), text, font=fnt)
    return right - left, bottom - top


def wrap_text(draw: ImageDraw.ImageDraw, text: str, fnt: ImageFont.FreeTypeFont, max_width: int) -> list[str]:
    text = clean_text(text)
    if not text:
        return []

    lines: list[str] = []
    for paragraph in re.split(r"\s*\n\s*", text):
        current = ""
        for char in paragraph:
            candidate = current + char
            if current and text_size(draw, candidate, fnt)[0] > max_width:
                lines.append(current)
                current = char
            else:
                current = candidate
        if current:
            lines.append(current)
    return lines


def draw_wrapped_text(
    draw: ImageDraw.ImageDraw,
    xy: tuple[int, int],
    text: str,
    fnt: ImageFont.FreeTypeFont,
    fill: tuple[int, int, int],
    max_width: int,
    *,
    max_lines: int | None = None,
    spacing: int = 8,
    stroke_fill: tuple[int, int, int] | None = None,
    stroke_width: int = 0,
) -> int:
    x, y = xy
    lines = wrap_text(draw, text, fnt, max_width)
    if max_lines is not None and len(lines) > max_lines:
        lines = lines[:max_lines]
        if lines:
            lines[-1] = lines[-1].rstrip("，。；、") + "…"
    line_height = text_size(draw, "国", fnt)[1] + spacing
    for line in lines:
        draw.text(
            (x, y),
            line,
            font=fnt,
            fill=fill,
            stroke_width=stroke_width,
            stroke_fill=stroke_fill or fill,
        )
        y += line_height
    return y


def fit_text(draw: ImageDraw.ImageDraw, text: str, max_width: int, start_size: int, min_size: int) -> ImageFont.FreeTypeFont:
    for size in range(start_size, min_size - 1, -2):
        fnt = font(size)
        if text_size(draw, text, fnt)[0] <= max_width:
            return fnt
    return font(min_size)


def blend(a: tuple[int, int, int], b: tuple[int, int, int], amount: float) -> tuple[int, int, int]:
    return tuple(round(x * (1 - amount) + y * amount) for x, y in zip(a, b))


def add_texture(img: Image.Image, palette: dict[str, tuple[int, int, int]], seed: str) -> None:
    rng = random.Random(seed)
    draw = ImageDraw.Draw(img, "RGBA")
    width, height = img.size
    for _ in range(1250):
        x = rng.randrange(width)
        y = rng.randrange(height)
        alpha = rng.randrange(9, 28)
        color = (*palette["paper"], alpha) if rng.random() < 0.55 else (0, 0, 0, alpha)
        draw.point((x, y), fill=color)
    for _ in range(55):
        x = rng.randrange(-120, width)
        y = rng.randrange(height)
        length = rng.randrange(80, 360)
        color = (*palette["accent2"], rng.randrange(28, 70))
        draw.line((x, y, x + length, y + rng.randrange(-22, 22)), fill=color, width=rng.randrange(1, 3))


def front_image_path(card: CreatureCard) -> Path | None:
    candidates: list[Path] = []
    for key in ("node_image", "panel_image"):
        value = card.frontmatter.get(key)
        if isinstance(value, str) and value:
            candidates.append(ASSET_DIR / value)
    candidates.extend(
        [
            ASSET_DIR / f"{card.name}_正面设定图.png",
            ASSET_DIR / f"{card.name}_节点正面.png",
            ASSET_DIR / f"{card.name}_概念展示.png",
        ]
    )
    for candidate in candidates:
        if candidate.exists():
            return candidate
    return None


def paste_cover(base: Image.Image, image: Image.Image, box: tuple[int, int, int, int]) -> None:
    x1, y1, x2, y2 = box
    fitted = ImageOps.fit(image.convert("RGB"), (x2 - x1, y2 - y1), method=Image.Resampling.LANCZOS, centering=(0.5, 0.45))
    fitted = ImageEnhance.Contrast(fitted).enhance(1.08)
    fitted = ImageEnhance.Brightness(fitted).enhance(1.04)
    base.paste(fitted, (x1, y1))


def draw_missing_front(base: Image.Image, box: tuple[int, int, int, int], card: CreatureCard, palette: dict[str, tuple[int, int, int]]) -> None:
    draw = ImageDraw.Draw(base, "RGBA")
    x1, y1, x2, y2 = box
    draw.rectangle(box, fill=blend(palette["panel"], palette["bg"], 0.35), outline=palette["accent2"], width=3)
    cx = (x1 + x2) // 2
    cy = (y1 + y2) // 2
    rng = random.Random(card.name)
    for radius in range(210, 50, -34):
        color = (*palette["accent"], 26 + radius // 10)
        draw.ellipse((cx - radius, cy - radius, cx + radius, cy + radius), outline=color, width=3)
    for _ in range(18):
        angle = rng.random() * 6.283
        length = rng.randrange(120, 260)
        x = cx + int(length * 0.72 * rng.uniform(-1, 1))
        y = cy + int(length * 0.72 * rng.uniform(-1, 1))
        draw.line((cx, cy, x, y), fill=(*palette["accent2"], 90), width=rng.randrange(2, 5))
    draw.text((x1 + 34, y1 + 34), "正面设定图待补", font=font(36), fill=palette["ink"])
    draw_wrapped_text(
        draw,
        (x1 + 42, y2 - 150),
        card.fields.get("生态位", ""),
        font(30),
        palette["muted"],
        x2 - x1 - 84,
        max_lines=3,
    )


def draw_section_label(draw: ImageDraw.ImageDraw, xy: tuple[int, int], label: str, palette: dict[str, tuple[int, int, int]]) -> None:
    x, y = xy
    draw.rectangle((x, y + 8, x + 10, y + 42), fill=palette["accent"])
    draw.text((x + 20, y), label, font=font(34), fill=palette["ink"])


def draw_info_row(
    draw: ImageDraw.ImageDraw,
    y: int,
    label: str,
    value: str,
    palette: dict[str, tuple[int, int, int]],
    *,
    max_lines: int = 2,
) -> int:
    if not value:
        return y
    label_font = font(30)
    body_font = font(28)
    x = 58
    width = 964
    body_x = x + 188
    body_width = width - 220
    lines = wrap_text(draw, value, body_font, body_width)
    if max_lines is not None and len(lines) > max_lines:
        lines = lines[:max_lines]
        if lines:
            lines[-1] = lines[-1].rstrip("，。；、") + "…"
    line_height = text_size(draw, "国", body_font)[1] + 7
    row_height = max(78, 28 + len(lines) * line_height)
    draw.rectangle(
        (x, y, x + width, y + row_height),
        outline=palette["accent2"],
        width=2,
        fill=blend(palette["panel"], palette["bg"], 0.22),
    )
    draw.text((x + 22, y + 20), label, font=label_font, fill=palette["accent"])
    text_y = y + max(18, (row_height - len(lines) * line_height) // 2)
    for line in lines:
        draw.text((body_x, text_y), line, font=body_font, fill=palette["ink"])
        text_y += line_height
    return y + row_height + 12


def render_card(card: CreatureCard) -> Image.Image:
    palette = STYLE_PALETTES.get(card.style_name, STYLE_PALETTES["暗黑奇幻手绘设定"])
    width, height = CARD_SIZE
    base = Image.new("RGB", CARD_SIZE, palette["bg"])
    add_texture(base, palette, card.name)
    draw = ImageDraw.Draw(base, "RGBA")

    for offset, color in ((22, palette["accent2"]), (34, palette["muted"]), (46, palette["accent2"])):
        draw.rectangle((offset, offset, width - offset, height - offset), outline=color, width=2)

    title = card.fields.get("标题", card.name)
    subtitle = card.fields.get("副标题", f"{LOW_TIER_TYPE} / {card.frontmatter.get('threat', 'D')}级")
    title_font = fit_text(draw, title, 620, 90, 62)
    draw.text((58, 54), title, font=title_font, fill=palette["ink"], stroke_width=4, stroke_fill=palette["bg"])
    draw.text((62, 158), subtitle, font=font(36), fill=palette["muted"])
    draw.text((62, 205), f"所属势力：{card.fields.get('所属势力', clean_text(card.frontmatter.get('faction', '')))}", font=font(31), fill=palette["ink"])

    threat = str(card.frontmatter.get("threat") or subtitle.split("/")[-1].replace("级", "").strip() or "?")
    draw.rectangle((838, 70, 986, 184), outline=palette["accent"], width=4, fill=blend(palette["panel"], palette["bg"], 0.18))
    draw.text((862, 80), "威胁", font=font(28), fill=palette["muted"])
    draw.text((898, 112), threat, font=font(60), fill=palette["accent"], stroke_width=2, stroke_fill=palette["bg"])

    image_box = (58, 282, 700, 910)
    image_path = front_image_path(card)
    if image_path:
        image = Image.open(image_path)
        paste_cover(base, image, image_box)
        veil = Image.new("RGBA", (image_box[2] - image_box[0], image_box[3] - image_box[1]), (0, 0, 0, 28))
        base.paste(veil, image_box[:2], veil)
    else:
        draw_missing_front(base, image_box, card, palette)
    draw.rectangle(image_box, outline=palette["accent"], width=4)

    traits_box = (724, 282, 1022, 910)
    draw.rectangle(traits_box, outline=palette["accent2"], width=3, fill=blend(palette["panel"], palette["bg"], 0.12))
    draw_section_label(draw, (746, 304), "局部特性", palette)
    trait_y = 368
    trait_font = font(23)
    for index, trait in enumerate(card.traits[:6], start=1):
        draw.text((750, trait_y), f"{index:02d}", font=font(22), fill=palette["accent"])
        trait_y = draw_wrapped_text(
            draw,
            (794, trait_y - 2),
            compact_trait_text(trait),
            trait_font,
            palette["ink"],
            198,
            max_lines=3,
            spacing=4,
        )
        trait_y += 16

    stamp = f"{card.style_name} / {card.fields.get('生物倾向', '')}"
    draw.text((64, 925), stamp, font=font(24), fill=palette["muted"])
    draw.line((58, 966, 1022, 966), fill=palette["accent"], width=4)

    y = 992
    info_rows = [
        ("分类", card.fields.get("分类", LOW_TIER_TYPE)),
        ("生物倾向", card.fields.get("生物倾向", "")),
        ("生态位", card.fields.get("生态位", "")),
        ("职能标签", card.fields.get("职能标签", "")),
        ("典型行为", card.fields.get("典型行为", "")),
        ("可利用素材", card.fields.get("可利用素材", "")),
        ("弱点", card.fields.get("弱点", "")),
    ]
    for label, value in info_rows:
        y = draw_info_row(draw, y, label, value, palette, max_lines=3 if label in {"典型行为", "可利用素材", "弱点"} else 2)

    footer = "黑曜纪元 / 生物档案卡 / Markdown Canon"
    draw.line((58, 1812, 1022, 1812), fill=palette["accent2"], width=2)
    draw.text((60, 1832), footer, font=font(24), fill=palette["muted"])
    draw.text((792, 1832), card.name, font=font(32), fill=palette["accent"])

    return base


def render_one(card: CreatureCard, *, dry_run: bool) -> Path:
    output_path = ASSET_DIR / f"{card.name}_档案卡.png"
    if dry_run:
        print(f"would render {card.name} -> {output_path.relative_to(ROOT)}")
        return output_path
    image = render_card(card)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    image.save(output_path)
    print(f"rendered {card.name} -> {output_path.relative_to(ROOT)}")
    return output_path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("names", nargs="*", help="Creature names to render. Defaults to all low-tier creature cards.")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    cards = read_cards(set(args.names) if args.names else None)
    if args.names and len(cards) != len(set(args.names)):
        found = {card.name for card in cards}
        missing = sorted(set(args.names) - found)
        raise SystemExit(f"unknown or non-low-tier creature(s): {', '.join(missing)}")
    for card in cards:
        render_one(card, dry_run=args.dry_run)


if __name__ == "__main__":
    main()
