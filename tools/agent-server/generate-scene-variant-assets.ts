import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  EPOCH_SCENE_VARIANTS,
  EPOCH_SCENE_VARIANT_HEIGHT,
  EPOCH_SCENE_VARIANT_WIDTH,
  type EpochSceneVariantManifestEntry,
  type EpochSceneVariantRecord,
} from "./lib/sceneVariantAssets.ts";
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

function weatherTint(asset: EpochSceneVariantRecord, color: Rgb, accent: Rgb, trim: Rgb, u: number, v: number, seed: number) {
  const ripple = (Math.sin((u * 12 + v * 4 + seed * 6) * Math.PI) + 1) / 2;
  if (asset.weather === "rain") return mix(color, accent, 0.16 + ripple * 0.08);
  if (asset.weather === "mist" || asset.weather === "brine_fog") return mix(color, trim, 0.14 + Math.max(0, 0.72 - v) * 0.16);
  if (asset.weather === "emberstorm" || asset.weather === "ashfall") return mix(color, accent, 0.12 + Math.max(0, v - 0.38) * 0.16);
  if (asset.weather === "eclipse") return mix(color, hexToRgb("#020617"), 0.18 + Math.max(0, 0.54 - v) * 0.22);
  if (asset.weather === "silver_dust" || asset.weather === "moonlit") return mix(color, trim, 0.1 + ripple * 0.05);
  return color;
}

function drawRegionalMotif(asset: EpochSceneVariantRecord, pixels: Buffer, width: number, height: number, base: Rgb, mid: Rgb, accent: Rgb, trim: Rgb) {
  if (asset.motif === "harbor") {
    drawRect(pixels, width, height, width * 0.12, height * 0.55, width * 0.88, height * 0.68, mid, 150);
    drawLine(pixels, width, height, width * 0.08, height * 0.72, width * 0.92, height * 0.58, width * 0.009, trim, 125);
    drawRect(pixels, width, height, width * 0.62, height * 0.24, width * 0.66, height * 0.63, trim, 180);
    drawCircle(pixels, width, height, width * 0.64, height * 0.22, width * 0.052, accent, 220);
    drawRect(pixels, width, height, width * 0.25, height * 0.45, width * 0.38, height * 0.58, base, 170);
  } else if (asset.motif === "outpost") {
    drawRect(pixels, width, height, width * 0.12, height * 0.51, width * 0.9, height * 0.68, mid, 178);
    for (let index = 0; index < 7; index += 1) {
      const x = width * (0.16 + index * 0.11);
      drawRect(pixels, width, height, x, height * 0.36, x + width * 0.05, height * 0.52, trim, 145);
      drawTriangle(pixels, width, height, x, height * 0.36, x + width * 0.025, height * 0.27, x + width * 0.05, height * 0.36, accent, 185);
    }
    drawCircle(pixels, width, height, width * 0.24, height * 0.67, width * 0.07, accent, 150);
  } else if (asset.motif === "coast") {
    drawLine(pixels, width, height, width * 0.09, height * 0.74, width * 0.91, height * 0.5, width * 0.017, trim, 180);
    for (let index = 0; index < 5; index += 1) {
      const x = width * (0.18 + index * 0.14);
      drawRect(pixels, width, height, x, height * 0.43, x + width * 0.08, height * 0.56, mid, 145);
      drawTriangle(pixels, width, height, x, height * 0.43, x + width * 0.04, height * 0.34, x + width * 0.08, height * 0.43, accent, 162);
    }
    drawLine(pixels, width, height, width * 0.05, height * 0.82, width * 0.95, height * 0.68, width * 0.005, accent, 112);
  } else if (asset.motif === "archive") {
    for (let index = 0; index < 9; index += 1) {
      const x = width * (0.12 + index * 0.085);
      drawRect(pixels, width, height, x, height * (0.23 + (index % 2) * 0.04), x + width * 0.044, height * 0.72, trim, 120);
      drawLine(pixels, width, height, x + width * 0.022, height * 0.25, x + width * 0.022, height * 0.69, width * 0.003, accent, 145);
    }
    drawLine(pixels, width, height, width * 0.11, height * 0.45, width * 0.86, height * 0.34, width * 0.006, accent, 132);
  } else if (asset.motif === "blackharbor") {
    drawRect(pixels, width, height, width * 0.1, height * 0.57, width * 0.88, height * 0.69, mid, 162);
    drawLine(pixels, width, height, width * 0.08, height * 0.78, width * 0.92, height * 0.58, width * 0.01, trim, 122);
    drawRect(pixels, width, height, width * 0.2, height * 0.43, width * 0.4, height * 0.57, base, 168);
    drawRect(pixels, width, height, width * 0.62, height * 0.24, width * 0.66, height * 0.63, trim, 174);
    drawCircle(pixels, width, height, width * 0.64, height * 0.22, width * 0.052, accent, 218);
    for (let index = 0; index < 5; index += 1) {
      const x = width * (0.34 + index * 0.07);
      drawTriangle(pixels, width, height, x, height * 0.39, x + width * 0.034, height * 0.51, x - width * 0.034, height * 0.51, accent, 116);
    }
  } else if (asset.motif === "forest") {
    for (let index = 0; index < 12; index += 1) {
      const x = width * (0.08 + index * 0.078);
      drawTriangle(pixels, width, height, x, height * 0.3, x - width * 0.042, height * 0.74, x + width * 0.042, height * 0.74, mid, 138);
      drawLine(pixels, width, height, x, height * 0.49, x, height * 0.74, width * 0.004, trim, 90);
    }
    drawCircle(pixels, width, height, width * 0.52, height * 0.5, width * 0.13, accent, 88);
    drawRect(pixels, width, height, width * 0.43, height * 0.54, width * 0.61, height * 0.62, trim, 118);
    drawLine(pixels, width, height, width * 0.2, height * 0.7, width * 0.82, height * 0.64, width * 0.007, accent, 102);
  } else if (asset.motif === "saltgate") {
    drawLine(pixels, width, height, width * 0.08, height * 0.71, width * 0.92, height * 0.53, width * 0.015, trim, 172);
    drawRect(pixels, width, height, width * 0.14, height * 0.48, width * 0.35, height * 0.63, mid, 148);
    drawRect(pixels, width, height, width * 0.64, height * 0.39, width * 0.82, height * 0.58, mid, 140);
    drawLine(pixels, width, height, width * 0.23, height * 0.35, width * 0.79, height * 0.35, width * 0.006, accent, 126);
    for (let index = 0; index < 5; index += 1) {
      const x = width * (0.25 + index * 0.12);
      drawRect(pixels, width, height, x, height * 0.32, x + width * 0.012, height * 0.61, trim, 118);
      drawTriangle(pixels, width, height, x + width * 0.012, height * 0.33, x + width * 0.058, height * 0.39, x + width * 0.012, height * 0.46, accent, 132);
    }
    drawCircle(pixels, width, height, width * 0.55, height * 0.3, width * 0.054, accent, 146);
    drawCircle(pixels, width, height, width * 0.55, height * 0.3, width * 0.028, base, 182);
  } else if (asset.motif === "ashwaste") {
    drawLine(pixels, width, height, width * 0.06, height * 0.82, width * 0.94, height * 0.58, width * 0.018, mid, 164);
    drawLine(pixels, width, height, width * 0.12, height * 0.77, width * 0.88, height * 0.6, width * 0.006, trim, 104);
    for (let index = 0; index < 7; index += 1) {
      const x = width * (0.13 + index * 0.115);
      drawTriangle(pixels, width, height, x, height * 0.47, x - width * 0.04, height * 0.69, x + width * 0.05, height * 0.69, base, 128);
      drawLine(pixels, width, height, x, height * 0.46, x + width * 0.025, height * 0.69, width * 0.0035, trim, 88);
    }
    drawCircle(pixels, width, height, width * 0.69, height * 0.59, width * 0.098, accent, 98);
    drawCircle(pixels, width, height, width * 0.69, height * 0.59, width * 0.055, base, 182);
    drawRect(pixels, width, height, width * 0.6, height * 0.39, width * 0.63, height * 0.6, trim, 118);
  } else if (asset.motif === "citypipes") {
    drawRect(pixels, width, height, width * 0.08, height * 0.37, width * 0.92, height * 0.67, mid, 128);
    drawLine(pixels, width, height, width * 0.08, height * 0.67, width * 0.92, height * 0.59, width * 0.017, trim, 126);
    drawLine(pixels, width, height, width * 0.14, height * 0.44, width * 0.86, height * 0.44, width * 0.013, accent, 92);
    for (let index = 0; index < 6; index += 1) {
      const x = width * (0.18 + index * 0.12);
      drawCircle(pixels, width, height, x, height * 0.49, width * 0.044, accent, 134);
      drawCircle(pixels, width, height, x, height * 0.49, width * 0.025, base, 184);
      drawRect(pixels, width, height, x - width * 0.01, height * 0.32, x + width * 0.01, height * 0.65, trim, 102);
    }
    drawRect(pixels, width, height, width * 0.36, height * 0.55, width * 0.64, height * 0.65, base, 146);
  } else if (asset.motif === "mine") {
    drawTriangle(pixels, width, height, width * 0.14, height * 0.73, width * 0.36, height * 0.33, width * 0.58, height * 0.73, mid, 136);
    drawTriangle(pixels, width, height, width * 0.42, height * 0.73, width * 0.68, height * 0.29, width * 0.9, height * 0.73, base, 148);
    drawLine(pixels, width, height, width * 0.12, height * 0.73, width * 0.9, height * 0.59, width * 0.008, trim, 112);
    drawLine(pixels, width, height, width * 0.2, height * 0.33, width * 0.2, height * 0.69, width * 0.01, trim, 122);
    drawLine(pixels, width, height, width * 0.2, height * 0.33, width * 0.42, height * 0.63, width * 0.006, trim, 92);
    drawLine(pixels, width, height, width * 0.2, height * 0.33, width * 0.05, height * 0.63, width * 0.006, trim, 92);
    drawCircle(pixels, width, height, width * 0.66, height * 0.51, width * 0.086, accent, 96);
    drawCircle(pixels, width, height, width * 0.66, height * 0.51, width * 0.044, base, 176);
  } else if (asset.motif === "data-tower") {
    for (let index = 0; index < 7; index += 1) {
      const x = width * (0.2 + index * 0.08);
      drawRect(pixels, width, height, x, height * (0.2 + (index % 2) * 0.04), x + width * 0.04, height * 0.7, trim, 112);
      drawLine(pixels, width, height, x + width * 0.02, height * 0.24, x + width * 0.02, height * 0.68, width * 0.003, accent, 150);
    }
    drawLine(pixels, width, height, width * 0.12, height * 0.6, width * 0.86, height * 0.46, width * 0.008, accent, 126);
    drawLine(pixels, width, height, width * 0.16, height * 0.7, width * 0.82, height * 0.55, width * 0.006, trim, 110);
    drawCircle(pixels, width, height, width * 0.62, height * 0.38, width * 0.12, accent, 80);
  } else if (asset.motif === "orbit-city") {
    drawCircle(pixels, width, height, width * 0.5, height * 0.49, width * 0.28, trim, 70);
    drawCircle(pixels, width, height, width * 0.5, height * 0.49, width * 0.2, base, 128);
    drawLine(pixels, width, height, width * 0.14, height * 0.6, width * 0.86, height * 0.43, width * 0.01, accent, 142);
    for (let index = 0; index < 6; index += 1) {
      const x = width * (0.24 + index * 0.09);
      drawRect(pixels, width, height, x, height * 0.47, x + width * 0.054, height * 0.57, mid, 134);
      drawCircle(pixels, width, height, x + width * 0.027, height * 0.45, width * 0.027, accent, 166);
    }
    drawRect(pixels, width, height, width * 0.68, height * 0.23, width * 0.72, height * 0.63, trim, 142);
    drawCircle(pixels, width, height, width * 0.7, height * 0.21, width * 0.054, accent, 198);
  } else if (asset.motif === "trench") {
    drawLine(pixels, width, height, width * 0.06, height * 0.81, width * 0.94, height * 0.57, width * 0.02, mid, 160);
    drawLine(pixels, width, height, width * 0.1, height * 0.66, width * 0.88, height * 0.48, width * 0.009, trim, 112);
    drawTriangle(pixels, width, height, width * 0.12, height * 0.77, width * 0.34, height * 0.31, width * 0.56, height * 0.77, base, 144);
    drawTriangle(pixels, width, height, width * 0.46, height * 0.78, width * 0.72, height * 0.25, width * 0.96, height * 0.78, mid, 128);
    for (let index = 0; index < 8; index += 1) {
      const x = width * (0.15 + index * 0.095);
      drawLine(pixels, width, height, x, height * 0.25, x + width * 0.034, height * 0.72, width * 0.004, trim, 86);
      drawCircle(pixels, width, height, x + width * 0.025, height * (0.34 + (index % 4) * 0.075), width * 0.025, accent, 160);
    }
    for (let index = 0; index < 7; index += 1) {
      const y = height * (0.32 + index * 0.064);
      drawLine(pixels, width, height, width * 0.1, y, width * 0.9, y + Math.sin(index * 1.3) * height * 0.032, width * 0.003, accent, 66);
    }
    drawCircle(pixels, width, height, width * 0.66, height * 0.42, width * 0.105, accent, 68);
  } else if (asset.motif === "dream-pool") {
    drawCircle(pixels, width, height, width * 0.5, height * 0.55, width * 0.26, accent, 90);
    drawCircle(pixels, width, height, width * 0.5, height * 0.55, width * 0.17, base, 150);
    drawCircle(pixels, width, height, width * 0.5, height * 0.55, width * 0.09, trim, 74);
    for (let index = 0; index < 10; index += 1) {
      const angle = (Math.PI * 2 * index) / 10;
      const x = width * 0.5 + Math.cos(angle) * width * 0.28;
      const y = height * 0.55 + Math.sin(angle) * height * 0.19;
      drawCircle(pixels, width, height, x, y, width * 0.032, trim, 130);
      drawLine(pixels, width, height, width * 0.5, height * 0.55, x, y, width * 0.002, accent, 82);
    }
    for (let index = 0; index < 6; index += 1) {
      const x = width * (0.18 + index * 0.13);
      drawTriangle(pixels, width, height, x, height * 0.27, x - width * 0.042, height * 0.47, x + width * 0.042, height * 0.47, mid, 116);
      drawCircle(pixels, width, height, x, height * 0.24, width * 0.026, accent, 164);
    }
    drawLine(pixels, width, height, width * 0.18, height * 0.7, width * 0.82, height * 0.66, width * 0.007, trim, 104);
  } else if (asset.motif === "space-rift") {
    drawLine(pixels, width, height, width * 0.18, height * 0.17, width * 0.74, height * 0.79, width * 0.015, accent, 166);
    drawLine(pixels, width, height, width * 0.24, height * 0.21, width * 0.82, height * 0.73, width * 0.006, trim, 126);
    drawLine(pixels, width, height, width * 0.31, height * 0.16, width * 0.64, height * 0.82, width * 0.0035, accent, 104);
    for (let index = 0; index < 9; index += 1) {
      const y = height * (0.21 + index * 0.062);
      drawLine(pixels, width, height, width * (0.16 + index * 0.032), y, width * (0.58 + index * 0.04), y + height * 0.075, width * 0.003, trim, 88);
      drawCircle(pixels, width, height, width * (0.25 + index * 0.07), height * (0.31 + (index % 4) * 0.085), width * 0.019, accent, 146);
    }
    for (let index = 0; index < 5; index += 1) {
      const x = width * (0.2 + index * 0.13);
      drawRect(pixels, width, height, x, height * 0.57, x + width * 0.058, height * 0.65, mid, 120);
      drawTriangle(pixels, width, height, x + width * 0.029, height * 0.48, x - width * 0.022, height * 0.57, x + width * 0.08, height * 0.57, accent, 128);
    }
    drawCircle(pixels, width, height, width * 0.66, height * 0.4, width * 0.098, accent, 68);
  } else if (asset.motif === "non-euclidean") {
    drawCircle(pixels, width, height, width * 0.58, height * 0.52, width * 0.17, accent, 72);
    drawCircle(pixels, width, height, width * 0.58, height * 0.52, width * 0.09, base, 140);
    for (let index = 0; index < 7; index += 1) {
      const x = width * (0.14 + index * 0.105);
      const y = height * (0.65 - (index % 4) * 0.065);
      drawRect(pixels, width, height, x, y, x + width * 0.13, y + height * 0.038, trim, 116);
      drawLine(pixels, width, height, x + width * 0.018, y, x + width * 0.075, y - height * 0.115, width * 0.004, accent, 108);
    }
    drawLine(pixels, width, height, width * 0.19, height * 0.73, width * 0.82, height * 0.32, width * 0.009, mid, 150);
    drawLine(pixels, width, height, width * 0.17, height * 0.35, width * 0.84, height * 0.68, width * 0.004, accent, 92);
    drawTriangle(pixels, width, height, width * 0.22, height * 0.28, width * 0.42, height * 0.48, width * 0.28, height * 0.63, mid, 86);
    drawTriangle(pixels, width, height, width * 0.65, height * 0.26, width * 0.82, height * 0.5, width * 0.6, height * 0.66, base, 110);
    for (let index = 0; index < 5; index += 1) {
      const x = width * (0.28 + index * 0.105);
      drawCircle(pixels, width, height, x, height * (0.28 + index * 0.085), width * 0.026, trim, 146);
    }
  } else if (asset.motif === "starship-graveyard") {
    drawLine(pixels, width, height, width * 0.08, height * 0.68, width * 0.92, height * 0.42, width * 0.007, trim, 110);
    drawLine(pixels, width, height, width * 0.14, height * 0.78, width * 0.86, height * 0.58, width * 0.012, mid, 140);
    drawCircle(pixels, width, height, width * 0.62, height * 0.38, width * 0.13, accent, 64);
    for (let index = 0; index < 7; index += 1) {
      const x = width * (0.12 + index * 0.115);
      const y = height * (0.4 + (index % 3) * 0.075);
      drawRect(pixels, width, height, x, y, x + width * 0.12, y + height * 0.06, mid, 126);
      drawTriangle(pixels, width, height, x + width * 0.12, y, x + width * 0.18, y + height * 0.03, x + width * 0.12, y + height * 0.06, accent, 108);
      drawCircle(pixels, width, height, x + width * 0.034, y + height * 0.03, width * 0.017, trim, 148);
    }
    for (let index = 0; index < 8; index += 1) {
      const x = width * (0.18 + index * 0.09);
      drawLine(pixels, width, height, x, height * 0.25, x + width * 0.05, height * 0.74, width * 0.0028, trim, 76);
      drawCircle(pixels, width, height, x + width * 0.038, height * (0.32 + (index % 3) * 0.065), width * 0.019, accent, 142);
    }
  } else if (asset.motif === "abandoned-subway") {
    drawRect(pixels, width, height, width * 0.08, height * 0.48, width * 0.92, height * 0.71, mid, 136);
    drawLine(pixels, width, height, width * 0.08, height * 0.69, width * 0.9, height * 0.6, width * 0.011, trim, 110);
    drawLine(pixels, width, height, width * 0.12, height * 0.77, width * 0.88, height * 0.67, width * 0.004, accent, 94);
    drawRect(pixels, width, height, width * 0.16, height * 0.33, width * 0.52, height * 0.47, base, 148);
    drawRect(pixels, width, height, width * 0.2, height * 0.36, width * 0.48, height * 0.39, trim, 80);
    for (let index = 0; index < 6; index += 1) {
      const x = width * (0.18 + index * 0.075);
      drawRect(pixels, width, height, x, height * 0.51, x + width * 0.021, height * 0.67, trim, 114);
      drawCircle(pixels, width, height, x + width * 0.011, height * 0.47, width * 0.017, accent, 156);
    }
    drawCircle(pixels, width, height, width * 0.72, height * 0.48, width * 0.13, accent, 58);
    drawCircle(pixels, width, height, width * 0.72, height * 0.48, width * 0.07, base, 138);
  } else if (asset.motif === "holographic-theater") {
    drawRect(pixels, width, height, width * 0.12, height * 0.57, width * 0.88, height * 0.72, mid, 142);
    drawRect(pixels, width, height, width * 0.2, height * 0.42, width * 0.8, height * 0.58, base, 124);
    drawTriangle(pixels, width, height, width * 0.26, height * 0.18, width * 0.46, height * 0.58, width * 0.12, height * 0.58, accent, 72);
    drawTriangle(pixels, width, height, width * 0.72, height * 0.18, width * 0.88, height * 0.58, width * 0.54, height * 0.58, trim, 70);
    drawLine(pixels, width, height, width * 0.2, height * 0.59, width * 0.8, height * 0.59, width * 0.006, accent, 120);
    for (let index = 0; index < 8; index += 1) {
      const x = width * (0.18 + index * 0.09);
      drawLine(pixels, width, height, x, height * 0.28, x + width * 0.028, height * 0.66, width * 0.0025, trim, 84);
      drawCircle(pixels, width, height, x + width * 0.018, height * 0.73, width * 0.017, accent, 128);
    }
    drawCircle(pixels, width, height, width * 0.5, height * 0.48, width * 0.115, accent, 62);
  } else if (asset.motif === "quantum-laboratory") {
    drawRect(pixels, width, height, width * 0.14, height * 0.34, width * 0.86, height * 0.69, mid, 110);
    drawRect(pixels, width, height, width * 0.23, height * 0.26, width * 0.37, height * 0.64, trim, 76);
    drawRect(pixels, width, height, width * 0.63, height * 0.26, width * 0.77, height * 0.64, trim, 76);
    drawCircle(pixels, width, height, width * 0.5, height * 0.45, width * 0.18, accent, 78);
    drawCircle(pixels, width, height, width * 0.5, height * 0.45, width * 0.105, base, 132);
    for (let index = 0; index < 10; index += 1) {
      const angle = (Math.PI * 2 * index) / 10;
      const x = width * 0.5 + Math.cos(angle) * width * 0.23;
      const y = height * 0.45 + Math.sin(angle) * height * 0.155;
      drawCircle(pixels, width, height, x, y, width * 0.017, trim, 140);
      drawLine(pixels, width, height, width * 0.5, height * 0.45, x, y, width * 0.002, accent, 80);
    }
    drawLine(pixels, width, height, width * 0.18, height * 0.72, width * 0.84, height * 0.54, width * 0.01, trim, 116);
    drawLine(pixels, width, height, width * 0.18, height * 0.53, width * 0.84, height * 0.73, width * 0.003, accent, 98);
  } else if (asset.motif === "reflective-city") {
    for (let index = 0; index < 9; index += 1) {
      const x = width * (0.1 + index * 0.09);
      const top = height * (0.17 + (index % 4) * 0.035);
      drawRect(pixels, width, height, x, top, x + width * 0.058, height * 0.69, trim, 96);
      drawLine(pixels, width, height, x + width * 0.029, top, x + width * 0.029, height * 0.69, width * 0.0028, accent, 136);
      drawLine(pixels, width, height, x, height * 0.5, x + width * 0.058, height * 0.5, width * 0.002, base, 88);
    }
    drawRect(pixels, width, height, width * 0.08, height * 0.68, width * 0.92, height * 0.78, mid, 130);
    drawLine(pixels, width, height, width * 0.08, height * 0.72, width * 0.92, height * 0.58, width * 0.014, accent, 122);
    drawLine(pixels, width, height, width * 0.12, height * 0.79, width * 0.88, height * 0.68, width * 0.006, trim, 92);
    for (let index = 0; index < 6; index += 1) {
      const x = width * (0.18 + index * 0.12);
      drawRect(pixels, width, height, x, height * 0.39, x + width * 0.1, height * 0.48, accent, 72);
      drawCircle(pixels, width, height, x + width * 0.05, height * 0.36, width * 0.023, trim, 120);
    }
  } else if (asset.motif === "data-alley") {
    drawRect(pixels, width, height, width * 0.1, height * 0.28, width * 0.9, height * 0.75, base, 96);
    drawLine(pixels, width, height, width * 0.12, height * 0.22, width * 0.88, height * 0.68, width * 0.003, trim, 76);
    drawLine(pixels, width, height, width * 0.88, height * 0.22, width * 0.12, height * 0.68, width * 0.003, trim, 66);
    for (let index = 0; index < 10; index += 1) {
      const x = width * (0.12 + index * 0.08);
      const y = height * (0.32 + (index % 5) * 0.05);
      drawRect(pixels, width, height, x, y, x + width * 0.064, y + height * 0.05, accent, 116);
      drawLine(pixels, width, height, x, y + height * 0.025, x + width * 0.064, y + height * 0.025, width * 0.002, base, 104);
    }
    drawRect(pixels, width, height, width * 0.18, height * 0.62, width * 0.82, height * 0.73, mid, 132);
    drawLine(pixels, width, height, width * 0.1, height * 0.75, width * 0.9, height * 0.62, width * 0.008, accent, 96);
    for (let index = 0; index < 6; index += 1) {
      const x = width * (0.22 + index * 0.1);
      drawCircle(pixels, width, height, x, height * 0.58, width * 0.024, trim, 122);
      drawRect(pixels, width, height, x - width * 0.024, height * 0.64, x + width * 0.024, height * 0.7, mid, 116);
    }
  } else if (asset.motif === "prism-waters") {
    drawRect(pixels, width, height, width * 0.08, height * 0.6, width * 0.92, height * 0.78, mid, 118);
    for (let index = 0; index < 8; index += 1) {
      const y = height * (0.42 + index * 0.04);
      drawLine(pixels, width, height, width * 0.08, y, width * 0.92, y - height * 0.1, width * 0.004, index % 2 ? trim : accent, 86);
    }
    for (let index = 0; index < 6; index += 1) {
      const x = width * (0.14 + index * 0.14);
      drawTriangle(pixels, width, height, x, height * 0.24, x - width * 0.04, height * 0.58, x + width * 0.06, height * 0.6, trim, 112);
      drawLine(pixels, width, height, x, height * 0.25, x + width * 0.1, height * 0.74, width * 0.003, accent, 104);
    }
    drawCircle(pixels, width, height, width * 0.74, height * 0.34, width * 0.11, accent, 58);
  } else if (asset.motif === "probability-greenhouse") {
    drawRect(pixels, width, height, width * 0.1, height * 0.3, width * 0.9, height * 0.76, base, 100);
    for (let index = 0; index < 9; index += 1) {
      const x = width * (0.14 + index * 0.085);
      drawLine(pixels, width, height, x, height * 0.3, x + width * 0.06, height * 0.76, width * 0.003, trim, 78);
      drawCircle(pixels, width, height, x + width * 0.03, height * (0.43 + (index % 4) * 0.055), width * 0.024, accent, 120);
      drawRect(pixels, width, height, x - width * 0.02, height * 0.62, x + width * 0.05, height * 0.67, mid, 108);
    }
    drawTriangle(pixels, width, height, width * 0.5, height * 0.18, width * 0.12, height * 0.34, width * 0.88, height * 0.34, trim, 76);
    drawLine(pixels, width, height, width * 0.18, height * 0.7, width * 0.82, height * 0.58, width * 0.012, mid, 124);
  } else if (asset.motif === "prophecy-server") {
    drawRect(pixels, width, height, width * 0.08, height * 0.25, width * 0.92, height * 0.75, base, 112);
    for (let index = 0; index < 8; index += 1) {
      const x = width * (0.13 + index * 0.09);
      const top = height * (0.2 + (index % 2) * 0.035);
      drawRect(pixels, width, height, x, top, x + width * 0.054, height * 0.7, mid, 130);
      drawLine(pixels, width, height, x + width * 0.027, top + height * 0.02, x + width * 0.027, height * 0.68, width * 0.003, trim, 116);
      drawCircle(pixels, width, height, x + width * 0.027, height * (0.35 + (index % 4) * 0.077), width * 0.019, accent, 154);
    }
    drawCircle(pixels, width, height, width * 0.68, height * 0.4, width * 0.15, accent, 66);
    drawCircle(pixels, width, height, width * 0.68, height * 0.4, width * 0.085, base, 148);
    drawLine(pixels, width, height, width * 0.12, height * 0.78, width * 0.88, height * 0.57, width * 0.009, trim, 110);
    drawLine(pixels, width, height, width * 0.22, height * 0.5, width * 0.76, height * 0.36, width * 0.004, accent, 98);
  } else if (asset.motif === "orbital-cathedral") {
    drawCircle(pixels, width, height, width * 0.5, height * 0.48, width * 0.3, trim, 72);
    drawCircle(pixels, width, height, width * 0.5, height * 0.48, width * 0.22, base, 130);
    drawCircle(pixels, width, height, width * 0.5, height * 0.48, width * 0.13, accent, 62);
    drawRect(pixels, width, height, width * 0.16, height * 0.54, width * 0.84, height * 0.7, mid, 136);
    drawTriangle(pixels, width, height, width * 0.5, height * 0.2, width * 0.28, height * 0.56, width * 0.72, height * 0.56, trim, 68);
    for (let index = 0; index < 7; index += 1) {
      const x = width * (0.18 + index * 0.105);
      drawLine(pixels, width, height, x, height * 0.25, x + width * 0.045, height * 0.68, width * 0.003, trim, 98);
      drawCircle(pixels, width, height, x + width * 0.022, height * 0.3, width * 0.024, accent, 146);
    }
    drawLine(pixels, width, height, width * 0.16, height * 0.66, width * 0.84, height * 0.45, width * 0.008, accent, 104);
  } else {
    drawCircle(pixels, width, height, width * 0.52, height * 0.45, width * 0.16, accent, 108);
    drawCircle(pixels, width, height, width * 0.52, height * 0.45, width * 0.075, base, 205);
    for (let index = 0; index < 10; index += 1) {
      const x = width * (0.12 + index * 0.08);
      drawTriangle(pixels, width, height, x, height * 0.32, x - width * 0.035, height * 0.73, x + width * 0.035, height * 0.73, mid, 136);
    }
    drawLine(pixels, width, height, width * 0.22, height * 0.67, width * 0.78, height * 0.67, width * 0.006, trim, 120);
  }
}

function drawWeatherLayer(asset: EpochSceneVariantRecord, pixels: Buffer, width: number, height: number, accent: Rgb, trim: Rgb, seed: number) {
  if (asset.weather === "rain") {
    for (let index = 0; index < 70; index += 1) {
      const x = width * (((index * 0.137) + seed) % 1);
      const y = height * (((index * 0.071) + seed * 0.41) % 1);
      drawLine(pixels, width, height, x, y, x + width * 0.025, y + height * 0.1, width * 0.002, trim, 92);
    }
  } else if (asset.weather === "emberstorm" || asset.weather === "ashfall" || asset.weather === "silver_dust") {
    for (let index = 0; index < 54; index += 1) {
      const x = width * (((index * 0.173) + seed * 0.33) % 1);
      const y = height * (((index * 0.097) + seed * 0.57) % 1);
      drawCircle(pixels, width, height, x, y, width * 0.0035, asset.weather === "silver_dust" ? trim : accent, 116);
    }
  } else if (asset.weather === "mist" || asset.weather === "brine_fog") {
    for (let index = 0; index < 6; index += 1) {
      const y = height * (0.3 + index * 0.08);
      drawLine(pixels, width, height, width * 0.04, y, width * 0.96, y + Math.sin(seed + index) * height * 0.03, width * 0.006, trim, 58);
    }
  } else if (asset.weather === "eclipse" || asset.weather === "moonlit") {
    drawCircle(pixels, width, height, width * 0.74, height * 0.22, width * 0.11, trim, asset.weather === "eclipse" ? 58 : 120);
  }
}

function drawSceneVariant(asset: EpochSceneVariantRecord) {
  const width = EPOCH_SCENE_VARIANT_WIDTH;
  const height = EPOCH_SCENE_VARIANT_HEIGHT;
  const pixels = Buffer.alloc(width * height * 4);
  const colors = asset.palette.map(hexToRgb);
  const base = colors[0];
  const mid = colors[1];
  const light = colors[2];
  const trim = colors[3] || light;
  const accent = hexToRgb(asset.accentColor);
  const seed = hashSeed(asset.variantKey);

  for (let y = 0; y < height; y += 1) {
    const v = y / Math.max(1, height - 1);
    for (let x = 0; x < width; x += 1) {
      const u = x / Math.max(1, width - 1);
      const horizon = Math.max(0, 1 - Math.abs(v - 0.48) * 2.8);
      const glow = Math.max(0, 1 - Math.hypot(u - 0.62, v - 0.34) * 1.8);
      const strata = (Math.sin((u * 8.3 + v * 3.7 + seed * 5.2) * Math.PI) + 1) / 2;
      const timeLift = asset.timeOfDay === "dawn" || asset.timeOfDay === "morning" ? 0.1 : asset.timeOfDay === "night" ? -0.04 : 0.04;
      let color = mix(base, mid, v * 0.42 + horizon * 0.16 + strata * 0.04 + timeLift);
      color = mix(color, accent, glow * 0.26);
      color = mix(color, trim, Math.max(0, v - 0.72) * 0.2);
      color = mix(color, base, Math.max(0, Math.hypot(u - 0.5, v - 0.48) - 0.65) * 1.05);
      color = weatherTint(asset, color, accent, trim, u, v, seed);
      setPixel(pixels, width, x, y, color);
    }
  }

  drawCircle(pixels, width, height, width * 0.63, height * 0.34, width * 0.24, mix(accent, trim, 0.22), 58);
  drawLine(pixels, width, height, width * 0.06, height * 0.8, width * 0.94, height * 0.62, width * 0.004, mix(mid, trim, 0.35), 118);
  drawRegionalMotif(asset, pixels, width, height, base, mid, accent, light);
  drawWeatherLayer(asset, pixels, width, height, accent, trim, seed);
  return encodePngRgba(width, height, pixels);
}

async function writeStaticInstallManifest(manifestPath: string, sceneVariants: readonly EpochSceneVariantManifestEntry[]) {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as Record<string, unknown>;
  const existingAssets = typeof manifest.assets === "object" && manifest.assets !== null
    ? manifest.assets as Record<string, unknown>
    : {};
  const next = {
    ...manifest,
    assets: {
      ...existingAssets,
      sceneVariants,
    },
  };
  await writeFile(manifestPath, `${JSON.stringify(next, null, 2)}\n`);
}

async function main() {
  const sceneVariants: EpochSceneVariantManifestEntry[] = [];
  for (const asset of EPOCH_SCENE_VARIANTS) {
    const content = drawSceneVariant(asset);
    const outputPath = join(packageRoot, asset.path);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, content);
    sceneVariants.push({
      variantKey: asset.variantKey,
      regionId: asset.regionId,
      title: asset.title,
      subtitle: asset.subtitle,
      path: asset.path,
      url: asset.url,
      contentType: asset.contentType,
      width: asset.width,
      height: asset.height,
      timeOfDay: asset.timeOfDay,
      weather: asset.weather,
      sha256: createHash("sha256").update(content).digest("hex"),
    });
  }

  await writeStaticInstallManifest(join(packageRoot, "install-manifest.json"), sceneVariants);
  await writeStaticInstallManifest(join(packageRoot, "obsidian-epoch/assets/install-manifest.json"), sceneVariants);
  if (process.argv.includes("--json")) {
    process.stdout.write(`${JSON.stringify({ sceneVariants }, null, 2)}\n`);
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
