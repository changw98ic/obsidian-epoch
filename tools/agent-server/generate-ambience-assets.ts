import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  EPOCH_AMBIENCE_SCENES,
  EPOCH_AMBIENCE_SCENE_HEIGHT,
  EPOCH_AMBIENCE_SCENE_WIDTH,
  type EpochAmbienceSceneManifestEntry,
  type EpochAmbienceSceneRecord,
} from "./lib/ambienceAssets.ts";
import { encodePngRgba, hashSeed, hexToRgb, mix, setPixel, type Rgb } from "./lib/pngDrawing.ts";

const serverRoot = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(serverRoot, "package");

function drawCircle(pixels: Buffer, width: number, height: number, centerX: number, centerY: number, radius: number, color: Rgb, alpha = 255) {
  const startX = Math.max(0, Math.floor(centerX - radius));
  const endX = Math.min(width - 1, Math.ceil(centerX + radius));
  const startY = Math.max(0, Math.floor(centerY - radius));
  const endY = Math.min(height - 1, Math.ceil(centerY + radius));
  for (let y = startY; y <= endY; y += 1) {
    for (let x = startX; x <= endX; x += 1) {
      if (Math.hypot(x - centerX, y - centerY) <= radius) setPixel(pixels, width, x, y, color, alpha);
    }
  }
}

function drawRect(pixels: Buffer, width: number, height: number, x1: number, y1: number, x2: number, y2: number, color: Rgb, alpha = 255) {
  for (let y = Math.max(0, Math.floor(y1)); y <= Math.min(height - 1, Math.ceil(y2)); y += 1) {
    for (let x = Math.max(0, Math.floor(x1)); x <= Math.min(width - 1, Math.ceil(x2)); x += 1) {
      setPixel(pixels, width, x, y, color, alpha);
    }
  }
}

function drawLine(pixels: Buffer, width: number, height: number, x1: number, y1: number, x2: number, y2: number, thickness: number, color: Rgb, alpha = 255) {
  const steps = Math.max(1, Math.ceil(Math.hypot(x2 - x1, y2 - y1)));
  for (let step = 0; step <= steps; step += 1) {
    const t = step / steps;
    drawCircle(pixels, width, height, x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, thickness, color, alpha);
  }
}

function drawTriangle(pixels: Buffer, width: number, height: number, ax: number, ay: number, bx: number, by: number, cx: number, cy: number, color: Rgb, alpha = 255) {
  const minX = Math.max(0, Math.floor(Math.min(ax, bx, cx)));
  const maxX = Math.min(width - 1, Math.ceil(Math.max(ax, bx, cx)));
  const minY = Math.max(0, Math.floor(Math.min(ay, by, cy)));
  const maxY = Math.min(height - 1, Math.ceil(Math.max(ay, by, cy)));
  const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  if (area === 0) return;
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const w1 = ((bx - x) * (cy - y) - (by - y) * (cx - x)) / area;
      const w2 = ((cx - x) * (ay - y) - (cy - y) * (ax - x)) / area;
      const w3 = 1 - w1 - w2;
      if (w1 >= 0 && w2 >= 0 && w3 >= 0) setPixel(pixels, width, x, y, color, alpha);
    }
  }
}

function drawMotif(asset: EpochAmbienceSceneRecord, pixels: Buffer, width: number, height: number, base: Rgb, mid: Rgb, accent: Rgb, light: Rgb) {
  if (asset.motif === "harbor") {
    drawRect(pixels, width, height, width * 0.69, height * 0.18, width * 0.73, height * 0.7, light, 190);
    drawCircle(pixels, width, height, width * 0.71, height * 0.16, width * 0.055, accent, 230);
    drawLine(pixels, width, height, width * 0.06, height * 0.66, width * 0.94, height * 0.58, width * 0.012, mid, 190);
    drawLine(pixels, width, height, width * 0.25, height * 0.72, width * 0.92, height * 0.42, width * 0.004, light, 120);
  } else if (asset.motif === "training") {
    drawRect(pixels, width, height, width * 0.16, height * 0.62, width * 0.84, height * 0.74, mid, 170);
    for (let index = 0; index < 5; index += 1) {
      const x = width * (0.28 + index * 0.1);
      drawLine(pixels, width, height, x, height * 0.32, x, height * 0.64, width * 0.006, light, 180);
      drawCircle(pixels, width, height, x, height * 0.3, width * 0.032, accent, 210);
    }
    drawCircle(pixels, width, height, width * 0.18, height * 0.68, width * 0.07, accent, 160);
  } else if (asset.motif === "mirror-market") {
    drawLine(pixels, width, height, width * 0.08, height * 0.62, width * 0.92, height * 0.62, width * 0.01, light, 160);
    drawRect(pixels, width, height, width * 0.22, height * 0.38, width * 0.42, height * 0.58, mid, 160);
    drawTriangle(pixels, width, height, width * 0.2, height * 0.38, width * 0.32, height * 0.25, width * 0.44, height * 0.38, accent, 190);
    drawRect(pixels, width, height, width * 0.55, height * 0.42, width * 0.78, height * 0.57, mid, 155);
    drawLine(pixels, width, height, width * 0.18, height * 0.72, width * 0.85, height * 0.78, width * 0.004, accent, 120);
  } else if (asset.motif === "archive") {
    for (let index = 0; index < 7; index += 1) {
      const x = width * (0.2 + index * 0.085);
      drawRect(pixels, width, height, x, height * 0.24, x + width * 0.035, height * 0.7, light, 120);
      drawLine(pixels, width, height, x + width * 0.018, height * 0.26, x + width * 0.018, height * 0.68, width * 0.003, accent, 145);
    }
    drawCircle(pixels, width, height, width * 0.54, height * 0.38, width * 0.12, accent, 80);
  } else if (asset.motif === "meditation") {
    drawCircle(pixels, width, height, width * 0.52, height * 0.42, width * 0.16, accent, 110);
    drawCircle(pixels, width, height, width * 0.52, height * 0.42, width * 0.08, base, 200);
    for (let index = 0; index < 8; index += 1) {
      const x = width * (0.18 + index * 0.09);
      drawTriangle(pixels, width, height, x, height * 0.3, x - width * 0.035, height * 0.68, x + width * 0.035, height * 0.68, mid, 150);
    }
  } else if (asset.motif === "blackharbor") {
    drawRect(pixels, width, height, width * 0.1, height * 0.58, width * 0.88, height * 0.7, mid, 162);
    drawLine(pixels, width, height, width * 0.08, height * 0.78, width * 0.92, height * 0.58, width * 0.01, light, 122);
    drawRect(pixels, width, height, width * 0.2, height * 0.43, width * 0.4, height * 0.57, base, 168);
    drawRect(pixels, width, height, width * 0.62, height * 0.24, width * 0.66, height * 0.63, light, 174);
    drawCircle(pixels, width, height, width * 0.64, height * 0.22, width * 0.052, accent, 218);
    for (let index = 0; index < 5; index += 1) {
      const x = width * (0.34 + index * 0.07);
      drawTriangle(pixels, width, height, x, height * 0.39, x + width * 0.034, height * 0.51, x - width * 0.034, height * 0.51, accent, 116);
    }
  } else if (asset.motif === "forest") {
    for (let index = 0; index < 12; index += 1) {
      const x = width * (0.08 + index * 0.078);
      drawTriangle(pixels, width, height, x, height * 0.3, x - width * 0.042, height * 0.74, x + width * 0.042, height * 0.74, mid, 138);
      drawLine(pixels, width, height, x, height * 0.49, x, height * 0.74, width * 0.004, light, 90);
    }
    drawCircle(pixels, width, height, width * 0.52, height * 0.5, width * 0.13, accent, 88);
    drawRect(pixels, width, height, width * 0.43, height * 0.54, width * 0.61, height * 0.62, light, 118);
    drawLine(pixels, width, height, width * 0.2, height * 0.7, width * 0.82, height * 0.64, width * 0.007, accent, 102);
  } else if (asset.motif === "saltgate") {
    drawLine(pixels, width, height, width * 0.08, height * 0.71, width * 0.92, height * 0.53, width * 0.015, light, 172);
    drawRect(pixels, width, height, width * 0.14, height * 0.48, width * 0.35, height * 0.63, mid, 148);
    drawRect(pixels, width, height, width * 0.64, height * 0.39, width * 0.82, height * 0.58, mid, 140);
    drawLine(pixels, width, height, width * 0.23, height * 0.35, width * 0.79, height * 0.35, width * 0.006, accent, 126);
    for (let index = 0; index < 5; index += 1) {
      const x = width * (0.25 + index * 0.12);
      drawRect(pixels, width, height, x, height * 0.32, x + width * 0.012, height * 0.61, light, 118);
      drawTriangle(pixels, width, height, x + width * 0.012, height * 0.33, x + width * 0.058, height * 0.39, x + width * 0.012, height * 0.46, accent, 132);
    }
    drawCircle(pixels, width, height, width * 0.55, height * 0.3, width * 0.054, accent, 146);
    drawCircle(pixels, width, height, width * 0.55, height * 0.3, width * 0.028, base, 182);
  } else if (asset.motif === "ashwaste") {
    drawLine(pixels, width, height, width * 0.06, height * 0.82, width * 0.94, height * 0.58, width * 0.018, mid, 164);
    drawLine(pixels, width, height, width * 0.12, height * 0.77, width * 0.88, height * 0.6, width * 0.006, light, 104);
    for (let index = 0; index < 7; index += 1) {
      const x = width * (0.13 + index * 0.115);
      drawTriangle(pixels, width, height, x, height * 0.47, x - width * 0.04, height * 0.69, x + width * 0.05, height * 0.69, base, 128);
      drawLine(pixels, width, height, x, height * 0.46, x + width * 0.025, height * 0.69, width * 0.0035, light, 88);
    }
    drawCircle(pixels, width, height, width * 0.69, height * 0.59, width * 0.098, accent, 98);
    drawCircle(pixels, width, height, width * 0.69, height * 0.59, width * 0.055, base, 182);
    drawRect(pixels, width, height, width * 0.6, height * 0.39, width * 0.63, height * 0.6, light, 118);
  } else if (asset.motif === "citypipes") {
    drawRect(pixels, width, height, width * 0.08, height * 0.37, width * 0.92, height * 0.67, mid, 128);
    drawLine(pixels, width, height, width * 0.08, height * 0.67, width * 0.92, height * 0.59, width * 0.017, light, 126);
    drawLine(pixels, width, height, width * 0.14, height * 0.44, width * 0.86, height * 0.44, width * 0.013, accent, 92);
    for (let index = 0; index < 6; index += 1) {
      const x = width * (0.18 + index * 0.12);
      drawCircle(pixels, width, height, x, height * 0.49, width * 0.044, accent, 134);
      drawCircle(pixels, width, height, x, height * 0.49, width * 0.025, base, 184);
      drawRect(pixels, width, height, x - width * 0.01, height * 0.32, x + width * 0.01, height * 0.65, light, 102);
    }
    drawRect(pixels, width, height, width * 0.36, height * 0.55, width * 0.64, height * 0.65, base, 146);
  } else if (asset.motif === "mine") {
    drawTriangle(pixels, width, height, width * 0.14, height * 0.73, width * 0.36, height * 0.33, width * 0.58, height * 0.73, mid, 136);
    drawTriangle(pixels, width, height, width * 0.42, height * 0.73, width * 0.68, height * 0.29, width * 0.9, height * 0.73, base, 148);
    drawLine(pixels, width, height, width * 0.12, height * 0.73, width * 0.9, height * 0.59, width * 0.008, light, 112);
    drawLine(pixels, width, height, width * 0.2, height * 0.33, width * 0.2, height * 0.69, width * 0.01, light, 122);
    drawLine(pixels, width, height, width * 0.2, height * 0.33, width * 0.42, height * 0.63, width * 0.006, light, 92);
    drawLine(pixels, width, height, width * 0.2, height * 0.33, width * 0.05, height * 0.63, width * 0.006, light, 92);
    drawCircle(pixels, width, height, width * 0.66, height * 0.51, width * 0.086, accent, 96);
    drawCircle(pixels, width, height, width * 0.66, height * 0.51, width * 0.044, base, 176);
  } else if (asset.motif === "data-tower") {
    for (let index = 0; index < 7; index += 1) {
      const x = width * (0.2 + index * 0.08);
      drawRect(pixels, width, height, x, height * (0.2 + (index % 2) * 0.04), x + width * 0.04, height * 0.7, light, 112);
      drawLine(pixels, width, height, x + width * 0.02, height * 0.24, x + width * 0.02, height * 0.68, width * 0.003, accent, 150);
    }
    drawLine(pixels, width, height, width * 0.12, height * 0.6, width * 0.86, height * 0.46, width * 0.008, accent, 126);
    drawCircle(pixels, width, height, width * 0.62, height * 0.38, width * 0.12, accent, 80);
  } else if (asset.motif === "orbit-city") {
    drawCircle(pixels, width, height, width * 0.5, height * 0.49, width * 0.28, light, 70);
    drawCircle(pixels, width, height, width * 0.5, height * 0.49, width * 0.2, base, 128);
    drawLine(pixels, width, height, width * 0.14, height * 0.6, width * 0.86, height * 0.43, width * 0.01, accent, 142);
    for (let index = 0; index < 6; index += 1) {
      const x = width * (0.24 + index * 0.09);
      drawRect(pixels, width, height, x, height * 0.47, x + width * 0.054, height * 0.57, mid, 134);
      drawCircle(pixels, width, height, x + width * 0.027, height * 0.45, width * 0.027, accent, 166);
    }
    drawRect(pixels, width, height, width * 0.68, height * 0.23, width * 0.72, height * 0.63, light, 142);
    drawCircle(pixels, width, height, width * 0.7, height * 0.21, width * 0.054, accent, 198);
  } else if (asset.motif === "trench") {
    drawLine(pixels, width, height, width * 0.08, height * 0.78, width * 0.92, height * 0.54, width * 0.02, mid, 152);
    drawLine(pixels, width, height, width * 0.12, height * 0.62, width * 0.82, height * 0.46, width * 0.009, light, 120);
    for (let index = 0; index < 7; index += 1) {
      const x = width * (0.18 + index * 0.105);
      drawLine(pixels, width, height, x, height * 0.24, x + width * 0.025, height * 0.72, width * 0.004, light, 82);
      drawCircle(pixels, width, height, x + width * 0.018, height * (0.34 + (index % 3) * 0.1), width * 0.028, accent, 168);
      drawCircle(pixels, width, height, x + width * 0.018, height * (0.34 + (index % 3) * 0.1), width * 0.014, base, 120);
    }
    drawTriangle(pixels, width, height, width * 0.18, height * 0.77, width * 0.4, height * 0.38, width * 0.62, height * 0.77, base, 136);
    drawTriangle(pixels, width, height, width * 0.48, height * 0.78, width * 0.76, height * 0.3, width * 0.95, height * 0.78, mid, 126);
    for (let index = 0; index < 6; index += 1) {
      const y = height * (0.32 + index * 0.075);
      drawLine(pixels, width, height, width * 0.1, y, width * 0.88, y + Math.sin(index) * height * 0.025, width * 0.003, accent, 64);
    }
  } else if (asset.motif === "dream-pool") {
    drawCircle(pixels, width, height, width * 0.5, height * 0.55, width * 0.24, accent, 92);
    drawCircle(pixels, width, height, width * 0.5, height * 0.55, width * 0.16, base, 150);
    drawCircle(pixels, width, height, width * 0.5, height * 0.55, width * 0.1, light, 74);
    for (let index = 0; index < 8; index += 1) {
      const angle = (Math.PI * 2 * index) / 8;
      const x = width * 0.5 + Math.cos(angle) * width * 0.26;
      const y = height * 0.55 + Math.sin(angle) * height * 0.18;
      drawCircle(pixels, width, height, x, y, width * 0.035, light, 138);
      drawLine(pixels, width, height, width * 0.5, height * 0.55, x, y, width * 0.0025, accent, 86);
    }
    for (let index = 0; index < 5; index += 1) {
      const x = width * (0.22 + index * 0.14);
      drawTriangle(pixels, width, height, x, height * 0.28, x - width * 0.04, height * 0.46, x + width * 0.04, height * 0.46, mid, 118);
      drawCircle(pixels, width, height, x, height * 0.25, width * 0.026, accent, 172);
    }
  } else if (asset.motif === "space-rift") {
    drawLine(pixels, width, height, width * 0.2, height * 0.18, width * 0.72, height * 0.78, width * 0.014, accent, 160);
    drawLine(pixels, width, height, width * 0.24, height * 0.22, width * 0.78, height * 0.72, width * 0.006, light, 120);
    for (let index = 0; index < 8; index += 1) {
      const y = height * (0.22 + index * 0.065);
      drawLine(pixels, width, height, width * (0.18 + index * 0.035), y, width * (0.58 + index * 0.04), y + height * 0.07, width * 0.003, light, 92);
      drawCircle(pixels, width, height, width * (0.28 + index * 0.075), height * (0.35 + (index % 3) * 0.09), width * 0.018, accent, 150);
    }
    for (let index = 0; index < 5; index += 1) {
      const x = width * (0.2 + index * 0.13);
      drawRect(pixels, width, height, x, height * 0.56, x + width * 0.055, height * 0.64, mid, 118);
      drawTriangle(pixels, width, height, x + width * 0.027, height * 0.48, x - width * 0.02, height * 0.56, x + width * 0.075, height * 0.56, accent, 132);
    }
  } else if (asset.motif === "non-euclidean") {
    drawCircle(pixels, width, height, width * 0.58, height * 0.52, width * 0.16, accent, 74);
    for (let index = 0; index < 6; index += 1) {
      const x = width * (0.18 + index * 0.105);
      const y = height * (0.62 - (index % 3) * 0.075);
      drawRect(pixels, width, height, x, y, x + width * 0.14, y + height * 0.04, light, 118);
      drawLine(pixels, width, height, x + width * 0.02, y, x + width * 0.08, y - height * 0.12, width * 0.004, accent, 112);
    }
    drawLine(pixels, width, height, width * 0.22, height * 0.72, width * 0.8, height * 0.34, width * 0.008, mid, 150);
    drawLine(pixels, width, height, width * 0.18, height * 0.35, width * 0.82, height * 0.66, width * 0.004, accent, 94);
    for (let index = 0; index < 4; index += 1) {
      const x = width * (0.3 + index * 0.12);
      drawCircle(pixels, width, height, x, height * (0.3 + index * 0.09), width * 0.026, light, 150);
    }
  } else if (asset.motif === "starship-graveyard") {
    drawLine(pixels, width, height, width * 0.08, height * 0.68, width * 0.92, height * 0.42, width * 0.006, light, 110);
    drawLine(pixels, width, height, width * 0.14, height * 0.78, width * 0.86, height * 0.58, width * 0.012, mid, 142);
    for (let index = 0; index < 6; index += 1) {
      const x = width * (0.16 + index * 0.13);
      const y = height * (0.42 + (index % 3) * 0.07);
      drawRect(pixels, width, height, x, y, x + width * 0.11, y + height * 0.055, mid, 128);
      drawTriangle(pixels, width, height, x + width * 0.11, y, x + width * 0.17, y + height * 0.027, x + width * 0.11, y + height * 0.055, accent, 110);
      drawCircle(pixels, width, height, x + width * 0.03, y + height * 0.028, width * 0.016, light, 150);
    }
    for (let index = 0; index < 7; index += 1) {
      const x = width * (0.2 + index * 0.1);
      drawLine(pixels, width, height, x, height * 0.28, x + width * 0.04, height * 0.72, width * 0.0025, light, 78);
      drawCircle(pixels, width, height, x + width * 0.03, height * (0.32 + (index % 2) * 0.08), width * 0.018, accent, 144);
    }
  } else if (asset.motif === "abandoned-subway") {
    drawRect(pixels, width, height, width * 0.08, height * 0.48, width * 0.92, height * 0.7, mid, 138);
    drawLine(pixels, width, height, width * 0.08, height * 0.68, width * 0.9, height * 0.6, width * 0.01, light, 110);
    drawLine(pixels, width, height, width * 0.12, height * 0.75, width * 0.88, height * 0.67, width * 0.004, accent, 95);
    drawRect(pixels, width, height, width * 0.18, height * 0.34, width * 0.52, height * 0.47, base, 150);
    for (let index = 0; index < 5; index += 1) {
      const x = width * (0.2 + index * 0.08);
      drawRect(pixels, width, height, x, height * 0.5, x + width * 0.022, height * 0.66, light, 115);
      drawCircle(pixels, width, height, x + width * 0.011, height * 0.46, width * 0.017, accent, 160);
    }
    drawCircle(pixels, width, height, width * 0.72, height * 0.48, width * 0.12, accent, 62);
    drawCircle(pixels, width, height, width * 0.72, height * 0.48, width * 0.065, base, 140);
  } else if (asset.motif === "holographic-theater") {
    drawRect(pixels, width, height, width * 0.14, height * 0.58, width * 0.86, height * 0.7, mid, 142);
    drawRect(pixels, width, height, width * 0.22, height * 0.46, width * 0.78, height * 0.6, base, 118);
    drawTriangle(pixels, width, height, width * 0.3, height * 0.18, width * 0.47, height * 0.58, width * 0.18, height * 0.58, accent, 74);
    drawTriangle(pixels, width, height, width * 0.7, height * 0.18, width * 0.82, height * 0.58, width * 0.53, height * 0.58, light, 70);
    for (let index = 0; index < 8; index += 1) {
      const x = width * (0.18 + index * 0.09);
      drawLine(pixels, width, height, x, height * 0.28, x + width * 0.035, height * 0.62, width * 0.0025, light, 92);
      drawCircle(pixels, width, height, x + width * 0.02, height * 0.72, width * 0.018, accent, 138);
    }
    drawLine(pixels, width, height, width * 0.2, height * 0.62, width * 0.8, height * 0.62, width * 0.006, accent, 128);
    drawCircle(pixels, width, height, width * 0.5, height * 0.48, width * 0.11, accent, 64);
  } else if (asset.motif === "quantum-laboratory") {
    drawRect(pixels, width, height, width * 0.16, height * 0.34, width * 0.84, height * 0.68, mid, 112);
    drawRect(pixels, width, height, width * 0.24, height * 0.28, width * 0.38, height * 0.62, light, 78);
    drawRect(pixels, width, height, width * 0.62, height * 0.28, width * 0.76, height * 0.62, light, 78);
    drawCircle(pixels, width, height, width * 0.5, height * 0.46, width * 0.17, accent, 82);
    drawCircle(pixels, width, height, width * 0.5, height * 0.46, width * 0.1, base, 134);
    for (let index = 0; index < 8; index += 1) {
      const angle = (Math.PI * 2 * index) / 8;
      const x = width * 0.5 + Math.cos(angle) * width * 0.21;
      const y = height * 0.46 + Math.sin(angle) * height * 0.14;
      drawCircle(pixels, width, height, x, y, width * 0.018, light, 150);
      drawLine(pixels, width, height, width * 0.5, height * 0.46, x, y, width * 0.002, accent, 82);
    }
    drawLine(pixels, width, height, width * 0.2, height * 0.7, width * 0.82, height * 0.55, width * 0.009, light, 118);
    drawLine(pixels, width, height, width * 0.18, height * 0.52, width * 0.84, height * 0.72, width * 0.003, accent, 102);
  } else if (asset.motif === "reflective-city") {
    for (let index = 0; index < 8; index += 1) {
      const x = width * (0.12 + index * 0.095);
      const top = height * (0.18 + (index % 3) * 0.04);
      drawRect(pixels, width, height, x, top, x + width * 0.055, height * 0.68, light, 92);
      drawLine(pixels, width, height, x + width * 0.027, top, x + width * 0.027, height * 0.68, width * 0.0025, accent, 138);
    }
    drawLine(pixels, width, height, width * 0.08, height * 0.72, width * 0.92, height * 0.58, width * 0.014, accent, 130);
    drawLine(pixels, width, height, width * 0.1, height * 0.78, width * 0.9, height * 0.66, width * 0.006, light, 92);
    for (let index = 0; index < 5; index += 1) {
      const x = width * (0.22 + index * 0.13);
      drawRect(pixels, width, height, x, height * 0.42, x + width * 0.09, height * 0.5, accent, 82);
      drawLine(pixels, width, height, x, height * 0.52, x + width * 0.13, height * 0.74, width * 0.003, light, 86);
    }
    drawCircle(pixels, width, height, width * 0.62, height * 0.38, width * 0.14, accent, 62);
  } else if (asset.motif === "data-alley") {
    drawRect(pixels, width, height, width * 0.16, height * 0.26, width * 0.84, height * 0.72, base, 96);
    for (let index = 0; index < 9; index += 1) {
      const x = width * (0.13 + index * 0.085);
      drawLine(pixels, width, height, x, height * 0.22, x + width * 0.1, height * 0.72, width * 0.0028, light, 86);
      drawRect(pixels, width, height, x, height * (0.34 + (index % 4) * 0.055), x + width * 0.07, height * (0.4 + (index % 4) * 0.055), accent, 126);
    }
    drawLine(pixels, width, height, width * 0.08, height * 0.68, width * 0.92, height * 0.55, width * 0.011, mid, 140);
    drawLine(pixels, width, height, width * 0.14, height * 0.76, width * 0.86, height * 0.62, width * 0.004, accent, 104);
    for (let index = 0; index < 5; index += 1) {
      const x = width * (0.24 + index * 0.11);
      drawCircle(pixels, width, height, x, height * 0.58, width * 0.03, light, 132);
      drawRect(pixels, width, height, x - width * 0.03, height * 0.62, x + width * 0.03, height * 0.67, mid, 120);
    }
  } else if (asset.motif === "prism-waters") {
    for (let index = 0; index < 7; index += 1) {
      const y = height * (0.42 + index * 0.045);
      drawLine(pixels, width, height, width * 0.08, y, width * 0.92, y - height * 0.08, width * 0.004, index % 2 ? light : accent, 92);
    }
    for (let index = 0; index < 5; index += 1) {
      const x = width * (0.18 + index * 0.16);
      drawTriangle(pixels, width, height, x, height * 0.28, x - width * 0.045, height * 0.6, x + width * 0.055, height * 0.62, light, 118);
      drawLine(pixels, width, height, x, height * 0.3, x + width * 0.12, height * 0.74, width * 0.003, accent, 110);
    }
    drawCircle(pixels, width, height, width * 0.72, height * 0.36, width * 0.12, accent, 66);
  } else if (asset.motif === "probability-greenhouse") {
    drawRect(pixels, width, height, width * 0.12, height * 0.28, width * 0.88, height * 0.72, base, 104);
    for (let index = 0; index < 8; index += 1) {
      const x = width * (0.16 + index * 0.09);
      drawLine(pixels, width, height, x, height * 0.28, x + width * 0.05, height * 0.72, width * 0.003, light, 88);
      drawCircle(pixels, width, height, x + width * 0.025, height * (0.44 + (index % 3) * 0.06), width * 0.028, accent, 128);
    }
    drawLine(pixels, width, height, width * 0.18, height * 0.66, width * 0.82, height * 0.58, width * 0.01, mid, 136);
    drawTriangle(pixels, width, height, width * 0.38, height * 0.22, width * 0.18, height * 0.34, width * 0.62, height * 0.34, light, 86);
    drawTriangle(pixels, width, height, width * 0.62, height * 0.22, width * 0.42, height * 0.34, width * 0.86, height * 0.34, accent, 76);
  } else if (asset.motif === "prophecy-server") {
    drawRect(pixels, width, height, width * 0.1, height * 0.28, width * 0.9, height * 0.74, base, 118);
    for (let index = 0; index < 7; index += 1) {
      const x = width * (0.16 + index * 0.105);
      drawRect(pixels, width, height, x, height * 0.24, x + width * 0.05, height * 0.7, mid, 132);
      drawLine(pixels, width, height, x + width * 0.025, height * 0.27, x + width * 0.025, height * 0.68, width * 0.0025, light, 120);
      drawCircle(pixels, width, height, x + width * 0.025, height * (0.35 + (index % 3) * 0.1), width * 0.018, accent, 150);
    }
    drawCircle(pixels, width, height, width * 0.58, height * 0.43, width * 0.14, accent, 62);
    drawCircle(pixels, width, height, width * 0.58, height * 0.43, width * 0.075, base, 158);
    drawLine(pixels, width, height, width * 0.16, height * 0.75, width * 0.84, height * 0.58, width * 0.007, light, 108);
  } else if (asset.motif === "orbital-cathedral") {
    drawCircle(pixels, width, height, width * 0.5, height * 0.48, width * 0.28, light, 78);
    drawCircle(pixels, width, height, width * 0.5, height * 0.48, width * 0.2, base, 142);
    drawCircle(pixels, width, height, width * 0.5, height * 0.48, width * 0.11, accent, 62);
    drawRect(pixels, width, height, width * 0.18, height * 0.52, width * 0.82, height * 0.68, mid, 132);
    for (let index = 0; index < 6; index += 1) {
      const x = width * (0.22 + index * 0.11);
      drawLine(pixels, width, height, x, height * 0.26, x + width * 0.035, height * 0.64, width * 0.0035, light, 102);
      drawCircle(pixels, width, height, x + width * 0.018, height * 0.31, width * 0.025, accent, 146);
    }
    drawLine(pixels, width, height, width * 0.22, height * 0.62, width * 0.78, height * 0.46, width * 0.006, accent, 104);
  } else {
    drawRect(pixels, width, height, width * 0.18, height * 0.42, width * 0.76, height * 0.64, mid, 165);
    drawTriangle(pixels, width, height, width * 0.18, height * 0.42, width * 0.47, height * 0.24, width * 0.76, height * 0.42, light, 160);
    drawCircle(pixels, width, height, width * 0.32, height * 0.68, width * 0.045, accent, 210);
    drawCircle(pixels, width, height, width * 0.62, height * 0.68, width * 0.045, accent, 210);
    drawLine(pixels, width, height, width * 0.42, height * 0.51, width * 0.52, height * 0.51, width * 0.008, base, 210);
  }
}

function drawAmbienceScene(asset: EpochAmbienceSceneRecord) {
  const width = EPOCH_AMBIENCE_SCENE_WIDTH;
  const height = EPOCH_AMBIENCE_SCENE_HEIGHT;
  const pixels = Buffer.alloc(width * height * 4);
  const colors = asset.palette.map(hexToRgb);
  const base = colors[0];
  const mid = colors[1];
  const light = colors[2];
  const trim = colors[3] || light;
  const accent = hexToRgb(asset.accentColor);
  const seed = hashSeed(asset.sceneKey);

  for (let y = 0; y < height; y += 1) {
    const v = y / Math.max(1, height - 1);
    for (let x = 0; x < width; x += 1) {
      const u = x / Math.max(1, width - 1);
      const horizon = Math.max(0, 1 - Math.abs(v - 0.55) * 2.4);
      const glow = Math.max(0, 1 - Math.hypot(u - 0.56, v - 0.38) * 1.55);
      const mist = (Math.sin((u * 5.6 + v * 2.8 + seed * 6.4) * Math.PI) + 1) / 2;
      let color = mix(base, mid, v * 0.48 + horizon * 0.14 + mist * 0.05);
      color = mix(color, accent, glow * 0.3);
      color = mix(color, base, Math.max(0, Math.hypot(u - 0.5, v - 0.5) - 0.64) * 1.15);
      setPixel(pixels, width, x, y, color);
    }
  }

  drawCircle(pixels, width, height, width * 0.62, height * 0.38, width * 0.2, mix(accent, trim, 0.18), 70);
  drawLine(pixels, width, height, width * 0.04, height * 0.76, width * 0.96, height * 0.62, width * 0.004, mix(mid, trim, 0.35), 120);
  drawLine(pixels, width, height, width * 0.1, height * 0.26, width * 0.9, height * 0.72, width * 0.003, mix(accent, trim, 0.22), 90);
  drawMotif(asset, pixels, width, height, base, mid, accent, light);
  return encodePngRgba(width, height, pixels);
}

async function writeStaticInstallManifest(manifestPath: string, ambienceScenes: readonly EpochAmbienceSceneManifestEntry[]) {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as Record<string, unknown>;
  const existingAssets = typeof manifest.assets === "object" && manifest.assets !== null
    ? manifest.assets as Record<string, unknown>
    : {};
  const next = {
    ...manifest,
    assets: {
      ...existingAssets,
      ambienceScenes,
    },
  };
  await writeFile(manifestPath, `${JSON.stringify(next, null, 2)}\n`);
}

async function main() {
  const ambienceScenes: EpochAmbienceSceneManifestEntry[] = [];
  for (const asset of EPOCH_AMBIENCE_SCENES) {
    const content = drawAmbienceScene(asset);
    const outputPath = join(packageRoot, asset.path);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, content);
    ambienceScenes.push({
      sceneKey: asset.sceneKey,
      title: asset.title,
      subtitle: asset.subtitle,
      path: asset.path,
      url: asset.url,
      contentType: asset.contentType,
      width: asset.width,
      height: asset.height,
      sha256: createHash("sha256").update(content).digest("hex"),
    });
  }

  await writeStaticInstallManifest(join(packageRoot, "install-manifest.json"), ambienceScenes);
  await writeStaticInstallManifest(join(packageRoot, "obsidian-epoch/assets/install-manifest.json"), ambienceScenes);
  if (process.argv.includes("--json")) {
    process.stdout.write(`${JSON.stringify({ ambienceScenes }, null, 2)}\n`);
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
