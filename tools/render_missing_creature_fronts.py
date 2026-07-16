#!/usr/bin/env python3
"""Render fallback front-view creature art for currently missing low-tier assets.

This is a deterministic local fallback for the three creatures that have no
accepted front image yet. AI-generated art can later overwrite these files with
the same names; dossier cards will automatically pick up the replacements.
"""

from __future__ import annotations

import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
ASSET_DIR = ROOT / "09_素材与图片"
SIZE = (1086, 1448)


def rgba(color: tuple[int, int, int], alpha: int) -> tuple[int, int, int, int]:
    return (*color, alpha)


def add_paper(draw: ImageDraw.ImageDraw, rng: random.Random, width: int, height: int, ink: tuple[int, int, int]) -> None:
    for _ in range(1800):
        x = rng.randrange(width)
        y = rng.randrange(height)
        shade = rng.randrange(-10, 16)
        base = max(0, min(255, 222 + shade))
        draw.point((x, y), fill=(base, base - 6, base - 18, rng.randrange(20, 58)))
    for _ in range(85):
        x = rng.randrange(-120, width)
        y = rng.randrange(height)
        length = rng.randrange(80, 420)
        draw.line(
            (x, y, x + length, y + rng.randrange(-24, 24)),
            fill=rgba(ink, rng.randrange(18, 44)),
            width=rng.randrange(1, 3),
        )


def canvas(seed: str, bg: tuple[int, int, int], ink: tuple[int, int, int]) -> tuple[Image.Image, ImageDraw.ImageDraw, random.Random]:
    rng = random.Random(seed)
    img = Image.new("RGBA", SIZE, (*bg, 255))
    draw = ImageDraw.Draw(img, "RGBA")
    add_paper(draw, rng, SIZE[0], SIZE[1], ink)
    for offset in (36, 54):
        draw.rectangle((offset, offset, SIZE[0] - offset, SIZE[1] - offset), outline=rgba(ink, 70), width=2)
    return img, draw, rng


def sketch_line(draw: ImageDraw.ImageDraw, points: list[tuple[int, int]], fill: tuple[int, int, int], width: int, rng: random.Random, repeats: int = 2) -> None:
    for _ in range(repeats):
        jittered = [(x + rng.randrange(-3, 4), y + rng.randrange(-3, 4)) for x, y in points]
        draw.line(jittered, fill=rgba(fill, 210), width=width, joint="curve")


def draw_steam(draw: ImageDraw.ImageDraw, rng: random.Random, center_x: int, top: int, bottom: int, color: tuple[int, int, int]) -> None:
    for index in range(8):
        phase = rng.random() * math.tau
        points = []
        for step in range(42):
            t = step / 41
            y = int(bottom - t * (bottom - top))
            x = int(center_x + math.sin(t * 8 + phase) * (18 + index * 4) + rng.randrange(-4, 5))
            points.append((x, y))
        draw.line(points, fill=rgba(color, 82), width=rng.randrange(2, 5), joint="curve")


def render_steam_bottle() -> Image.Image:
    bg = (218, 211, 192)
    ink = (43, 34, 25)
    brass = (153, 105, 48)
    bone = (216, 218, 203)
    glass = (86, 100, 92)
    img, draw, rng = canvas("蒸魂瓶俑", bg, ink)

    # Ash shadow and hose tail.
    draw.ellipse((330, 1175, 770, 1250), fill=rgba((40, 34, 30), 34))
    hose = [(560, 1005), (640, 1110), (720, 1166), (826, 1196), (900, 1260)]
    sketch_line(draw, hose, ink, 18, rng, 3)
    sketch_line(draw, hose, brass, 8, rng, 2)
    draw.ellipse((872, 1232, 955, 1304), outline=rgba(ink, 210), width=8, fill=rgba((64, 55, 47), 90))
    draw.ellipse((892, 1250, 940, 1288), outline=rgba(brass, 210), width=5)

    # Thin spider-leg brass limbs.
    limbs = [
        [(410, 565), (300, 675), (244, 830), (192, 945)],
        [(675, 565), (790, 690), (835, 850), (900, 954)],
        [(415, 838), (330, 930), (292, 1070), (240, 1180)],
        [(670, 838), (760, 930), (802, 1070), (858, 1180)],
    ]
    for limb in limbs:
        sketch_line(draw, limb, ink, 13, rng, 3)
        sketch_line(draw, limb, brass, 6, rng, 2)
        for x, y in limb[1:-1]:
            draw.ellipse((x - 18, y - 18, x + 18, y + 18), outline=rgba(brass, 230), width=5, fill=rgba((80, 55, 36), 88))

    # Bottle torso.
    torso = [(405, 440), (680, 440), (744, 1010), (642, 1160), (448, 1160), (342, 1010)]
    draw.polygon(torso, fill=rgba(glass, 112), outline=rgba(ink, 235))
    sketch_line(draw, torso + [torso[0]], ink, 8, rng, 3)
    for y in (505, 730, 975):
        draw.rounded_rectangle((366, y, 720, y + 42), radius=20, outline=rgba(brass, 230), width=7, fill=rgba((98, 68, 40), 36))
        for x in range(390, 705, 58):
            draw.ellipse((x - 7, y + 14, x + 7, y + 28), fill=rgba(ink, 210))
    draw_steam(draw, rng, 544, 492, 1085, bone)
    for face_x, face_y, scale in ((510, 650, 1.0), (596, 835, 0.8), (488, 980, 0.7)):
        draw.ellipse((face_x - 34 * scale, face_y - 44 * scale, face_x + 34 * scale, face_y + 44 * scale), outline=rgba(bone, 76), width=3)
        draw.ellipse((face_x - 15, face_y - 8, face_x - 5, face_y + 2), fill=rgba(bone, 90))
        draw.ellipse((face_x + 8, face_y - 8, face_x + 18, face_y + 2), fill=rgba(bone, 90))
        draw.arc((face_x - 18, face_y + 10, face_x + 22, face_y + 30), 8, 172, fill=rgba(bone, 70), width=3)

    # Pressure gauge head and neck.
    draw.rectangle((505, 360, 585, 444), fill=rgba(brass, 180), outline=rgba(ink, 230), width=6)
    draw.ellipse((405, 194, 685, 474), fill=rgba((207, 189, 142), 235), outline=rgba(ink, 245), width=10)
    draw.ellipse((448, 238, 642, 432), fill=rgba((225, 211, 168), 230), outline=rgba(brass, 235), width=8)
    for angle in range(215, 506, 32):
        rad = math.radians(angle)
        x1 = 545 + int(math.cos(rad) * 72)
        y1 = 335 + int(math.sin(rad) * 72)
        x2 = 545 + int(math.cos(rad) * 86)
        y2 = 335 + int(math.sin(rad) * 86)
        draw.line((x1, y1, x2, y2), fill=rgba(ink, 160), width=3)
    draw.line((545, 335, 608, 298), fill=rgba((120, 28, 23), 230), width=7)
    draw.ellipse((532, 322, 558, 348), fill=rgba(ink, 220))

    return img.convert("RGB")


def render_prayer_worm() -> Image.Image:
    bg = (220, 218, 208)
    ink = (33, 32, 31)
    steel = (188, 191, 185)
    rust = (106, 62, 40)
    white = (235, 236, 228)
    img, draw, rng = canvas("钉环祈虫", bg, ink)

    center_x = 543
    segment_count = 16
    top = 235
    segment_h = 60
    widths = [178, 198, 222, 246, 266, 284, 298, 306, 300, 284, 262, 238, 212, 188, 162, 132]
    spine: list[tuple[int, int]] = []
    for index in range(segment_count):
        y = top + index * segment_h
        wobble = int(math.sin(index * 0.85) * 24)
        cx = center_x + wobble
        spine.append((cx, y + 30))
        w = widths[index]
        box = (cx - w // 2, y, cx + w // 2, y + segment_h + 18)
        fill = (188 + index % 2 * 14, 189 + index % 2 * 12, 181 + index % 2 * 8)
        draw.ellipse(box, fill=rgba(fill, 224), outline=rgba(ink, 230), width=5)
        draw.arc((box[0] + 18, box[1] + 8, box[2] - 18, box[3] - 8), 0, 180, fill=rgba(rust, 190), width=4)
        draw.line((box[0] + 20, y + 34, box[2] - 20, y + 34), fill=rgba(rust, 150), width=3)
        for side in (-1, 1):
            leg_base = (cx + side * (w // 2 - 16), y + 42)
            leg_mid = (leg_base[0] + side * (54 + index % 3 * 8), leg_base[1] + 20)
            leg_tip = (leg_mid[0] + side * 34, leg_mid[1] + 44)
            sketch_line(draw, [leg_base, leg_mid, leg_tip], ink, 7, rng, 2)
            draw.line((leg_tip[0] - side * 10, leg_tip[1], leg_tip[0] + side * 18, leg_tip[1] + 18), fill=rgba(ink, 190), width=4)
        # Pierced iron rings along belly.
        for rx in (-52, 0, 52):
            draw.ellipse((cx + rx - 18, y + 22, cx + rx + 18, y + 52), outline=rgba(rust, 220), width=5)
            draw.ellipse((cx + rx - 8, y + 30, cx + rx + 8, y + 45), outline=rgba(ink, 120), width=2)

    sketch_line(draw, spine, ink, 5, rng, 2)

    # Halo-bound eyeless head.
    hx, hy = spine[0]
    draw.ellipse((hx - 142, hy - 145, hx + 142, hy + 104), fill=rgba(white, 238), outline=rgba(ink, 240), width=7)
    draw.ellipse((hx - 184, hy - 174, hx + 184, hy + 136), outline=rgba(rust, 230), width=12)
    for dx in (-38, 0, 38):
        draw.ellipse((hx + dx - 11, hy - 16, hx + dx + 11, hy + 6), fill=rgba((250, 250, 239), 230), outline=rgba(ink, 160), width=2)
    draw.line((hx - 82, hy + 28, hx + 82, hy + 28), fill=rgba(rust, 170), width=4)
    draw.line((hx - 64, hy + 52, hx + 64, hy + 42), fill=rgba(ink, 120), width=3)
    for dx in (-72, -24, 24, 72):
        draw.line((hx + dx, hy + 18, hx + dx + rng.randrange(-7, 8), hy + 62), fill=rgba(ink, 90), width=2)

    # Tail prayer beads and pain bell.
    tx, ty = spine[-1]
    chain = [(tx, ty + 45), (tx - 20, ty + 105), (tx + 20, ty + 168), (tx - 10, ty + 230)]
    sketch_line(draw, chain, ink, 4, rng, 2)
    for x, y in chain[1:]:
        draw.ellipse((x - 15, y - 15, x + 15, y + 15), outline=rgba(rust, 230), width=4)
    draw.ellipse((tx - 45, ty + 220, tx + 45, ty + 296), fill=rgba(rust, 200), outline=rgba(ink, 230), width=5)
    draw.arc((tx - 34, ty + 238, tx + 34, ty + 316), 0, 180, fill=rgba(white, 130), width=3)

    return img.filter(ImageFilter.UnsharpMask(radius=1.2, percent=120)).convert("RGB")


def snake_point(t: float) -> tuple[int, int]:
    y = 1080 - int(t * 780)
    x = 543 + int(math.sin(t * math.tau * 1.65) * (250 - t * 90))
    return x, y


def render_mist_snake() -> Image.Image:
    bg = (207, 216, 204)
    ink = (17, 28, 29)
    green = (76, 143, 105)
    black = (20, 29, 31)
    mist = (211, 230, 220)
    img, draw, rng = canvas("雾鳞环蛇", bg, ink)

    # Suspended sea mist.
    for _ in range(55):
        y = rng.randrange(170, 1220)
        x = rng.randrange(-80, 960)
        draw.arc((x, y, x + rng.randrange(180, 420), y + rng.randrange(34, 90)), 190, 350, fill=rgba(mist, rng.randrange(45, 86)), width=rng.randrange(3, 8))

    body = [snake_point(i / 115) for i in range(116)]
    for width, color, alpha in ((82, (12, 20, 22), 180), (60, (31, 67, 62), 220), (38, (46, 105, 84), 210), (16, (120, 190, 142), 160)):
        draw.line(body, fill=(*color, alpha), width=width, joint="curve")

    # Scale dashes along body.
    for index, (x, y) in enumerate(body[8:-8:4]):
        normal = math.sin(index * 0.9)
        dx = int(normal * 22)
        draw.line((x - dx, y - 13, x + dx, y + 13), fill=rgba(green, 130), width=3)
        if index % 3 == 0:
            draw.ellipse((x - 20, y - 16, x + 20, y + 16), outline=rgba((170, 225, 180), 45), width=2)

    # Coiling rings.
    for box in ((248, 880, 840, 1268), (318, 776, 764, 1086), (392, 688, 690, 918)):
        draw.ellipse(box, outline=rgba(green, 105), width=7)
        draw.ellipse(tuple(v + (8 if i < 2 else -8) for i, v in enumerate(box)), outline=rgba(black, 70), width=3)

    # Head and ring bone spurs.
    hx, hy = body[-1]
    head = [(hx - 80, hy + 45), (hx - 42, hy - 80), (hx, hy - 128), (hx + 42, hy - 80), (hx + 80, hy + 45), (hx, hy + 86)]
    draw.polygon(head, fill=rgba((28, 62, 58), 235), outline=rgba(ink, 245))
    sketch_line(draw, head + [head[0]], ink, 7, rng, 3)
    draw.ellipse((hx - 46, hy - 42, hx - 18, hy - 12), fill=rgba((7, 13, 13), 240), outline=rgba(mist, 100), width=2)
    draw.ellipse((hx + 18, hy - 42, hx + 46, hy - 12), fill=rgba((7, 13, 13), 240), outline=rgba(mist, 100), width=2)
    draw.line((hx - 31, hy - 27, hx - 23, hy - 17), fill=rgba(green, 190), width=2)
    draw.line((hx + 31, hy - 27, hx + 23, hy - 17), fill=rgba(green, 190), width=2)
    for side in (-1, 1):
        cx = hx + side * 96
        cy = hy - 40
        draw.ellipse((cx - 56, cy - 66, cx + 56, cy + 66), outline=rgba((194, 206, 180), 220), width=8)
        draw.arc((cx - 42, cy - 50, cx + 42, cy + 50), 40, 320, fill=rgba(green, 150), width=4)

    # Paddle tail and closed ripples.
    tx, ty = body[0]
    draw.ellipse((tx - 96, ty + 10, tx + 96, ty + 86), fill=rgba((31, 73, 67), 215), outline=rgba(ink, 220), width=5)
    for radius in (95, 150, 215):
        draw.ellipse((tx - radius, ty - radius // 3, tx + radius, ty + radius // 3), outline=rgba(green, 58), width=4)

    return img.filter(ImageFilter.UnsharpMask(radius=1.1, percent=115)).convert("RGB")


RENDERERS = {
    "蒸魂瓶俑": render_steam_bottle,
    "钉环祈虫": render_prayer_worm,
    "雾鳞环蛇": render_mist_snake,
}


def main() -> None:
    ASSET_DIR.mkdir(parents=True, exist_ok=True)
    for name, renderer in RENDERERS.items():
        output_path = ASSET_DIR / f"{name}_正面设定图.png"
        renderer().save(output_path)
        print(f"rendered {name} -> {output_path.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
