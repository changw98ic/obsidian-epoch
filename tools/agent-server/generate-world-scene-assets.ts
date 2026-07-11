import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  EPOCH_WORLD_SCENES,
  EPOCH_WORLD_SCENE_HEIGHT,
  EPOCH_WORLD_SCENE_WIDTH,
  type EpochWorldSceneManifestEntry,
  type EpochWorldSceneRecord,
} from "./lib/worldSceneAssets.ts";
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

function drawMotif(asset: EpochWorldSceneRecord, pixels: Buffer, width: number, height: number, base: Rgb, mid: Rgb, accent: Rgb, light: Rgb) {
  if (asset.motif === "harbor-gate") {
    drawRect(pixels, width, height, width * 0.18, height * 0.42, width * 0.82, height * 0.73, mid, 145);
    drawRect(pixels, width, height, width * 0.56, height * 0.19, width * 0.61, height * 0.67, light, 180);
    drawCircle(pixels, width, height, width * 0.585, height * 0.18, width * 0.055, accent, 235);
    drawLine(pixels, width, height, width * 0.08, height * 0.72, width * 0.88, height * 0.58, width * 0.014, light, 115);
    drawRect(pixels, width, height, width * 0.28, height * 0.45, width * 0.42, height * 0.62, base, 180);
  } else if (asset.motif === "outpost-wall") {
    drawRect(pixels, width, height, width * 0.12, height * 0.48, width * 0.9, height * 0.68, mid, 170);
    for (let index = 0; index < 6; index += 1) {
      const x = width * (0.18 + index * 0.12);
      drawRect(pixels, width, height, x, height * 0.34, x + width * 0.055, height * 0.5, light, 155);
      drawTriangle(pixels, width, height, x, height * 0.34, x + width * 0.027, height * 0.25, x + width * 0.055, height * 0.34, accent, 190);
    }
    drawCircle(pixels, width, height, width * 0.22, height * 0.68, width * 0.075, accent, 165);
  } else if (asset.motif === "salt-causeway") {
    drawLine(pixels, width, height, width * 0.12, height * 0.72, width * 0.88, height * 0.5, width * 0.018, light, 185);
    drawLine(pixels, width, height, width * 0.08, height * 0.8, width * 0.92, height * 0.62, width * 0.007, accent, 125);
    for (let index = 0; index < 4; index += 1) {
      const x = width * (0.22 + index * 0.14);
      drawRect(pixels, width, height, x, height * 0.43, x + width * 0.09, height * 0.55, mid, 145);
      drawTriangle(pixels, width, height, x, height * 0.43, x + width * 0.045, height * 0.34, x + width * 0.09, height * 0.43, accent, 170);
    }
  } else if (asset.motif === "archive-district") {
    for (let index = 0; index < 8; index += 1) {
      const x = width * (0.14 + index * 0.09);
      drawRect(pixels, width, height, x, height * (0.22 + (index % 2) * 0.04), x + width * 0.045, height * 0.71, light, 120);
      drawLine(pixels, width, height, x + width * 0.022, height * 0.24, x + width * 0.022, height * 0.68, width * 0.003, accent, 150);
    }
    drawLine(pixels, width, height, width * 0.12, height * 0.46, width * 0.85, height * 0.34, width * 0.006, accent, 135);
    drawCircle(pixels, width, height, width * 0.68, height * 0.35, width * 0.11, accent, 70);
  } else if (asset.motif === "black-harbor") {
    drawRect(pixels, width, height, width * 0.1, height * 0.56, width * 0.9, height * 0.7, mid, 168);
    drawLine(pixels, width, height, width * 0.08, height * 0.78, width * 0.9, height * 0.54, width * 0.012, light, 130);
    drawRect(pixels, width, height, width * 0.2, height * 0.42, width * 0.42, height * 0.57, base, 178);
    drawRect(pixels, width, height, width * 0.62, height * 0.22, width * 0.66, height * 0.62, light, 170);
    drawCircle(pixels, width, height, width * 0.64, height * 0.2, width * 0.052, accent, 220);
    for (let index = 0; index < 5; index += 1) {
      const x = width * (0.34 + index * 0.07);
      drawTriangle(pixels, width, height, x, height * 0.38, x + width * 0.035, height * 0.5, x - width * 0.035, height * 0.5, accent, 126);
    }
  } else if (asset.motif === "forest-shrine") {
    for (let index = 0; index < 11; index += 1) {
      const x = width * (0.1 + index * 0.08);
      drawTriangle(pixels, width, height, x, height * 0.28, x - width * 0.045, height * 0.74, x + width * 0.045, height * 0.74, mid, 146);
      drawLine(pixels, width, height, x, height * 0.48, x, height * 0.74, width * 0.004, light, 98);
    }
    drawCircle(pixels, width, height, width * 0.52, height * 0.5, width * 0.13, accent, 92);
    drawRect(pixels, width, height, width * 0.43, height * 0.53, width * 0.61, height * 0.62, light, 126);
    drawLine(pixels, width, height, width * 0.2, height * 0.7, width * 0.82, height * 0.64, width * 0.007, accent, 110);
  } else if (asset.motif === "salt-gate") {
    drawLine(pixels, width, height, width * 0.08, height * 0.7, width * 0.92, height * 0.52, width * 0.016, light, 178);
    drawRect(pixels, width, height, width * 0.14, height * 0.47, width * 0.34, height * 0.62, mid, 154);
    drawRect(pixels, width, height, width * 0.63, height * 0.38, width * 0.82, height * 0.58, mid, 146);
    drawLine(pixels, width, height, width * 0.22, height * 0.34, width * 0.78, height * 0.34, width * 0.006, accent, 132);
    for (let index = 0; index < 5; index += 1) {
      const x = width * (0.26 + index * 0.12);
      drawRect(pixels, width, height, x, height * 0.31, x + width * 0.012, height * 0.6, light, 124);
      drawTriangle(pixels, width, height, x + width * 0.012, height * 0.32, x + width * 0.06, height * 0.38, x + width * 0.012, height * 0.45, accent, 140);
    }
    drawCircle(pixels, width, height, width * 0.54, height * 0.29, width * 0.055, accent, 152);
    drawCircle(pixels, width, height, width * 0.54, height * 0.29, width * 0.029, base, 188);
  } else if (asset.motif === "ash-waste") {
    drawLine(pixels, width, height, width * 0.06, height * 0.82, width * 0.94, height * 0.57, width * 0.019, mid, 170);
    drawLine(pixels, width, height, width * 0.12, height * 0.76, width * 0.88, height * 0.59, width * 0.006, light, 110);
    for (let index = 0; index < 7; index += 1) {
      const x = width * (0.13 + index * 0.115);
      drawTriangle(pixels, width, height, x, height * 0.46, x - width * 0.04, height * 0.68, x + width * 0.05, height * 0.68, base, 134);
      drawLine(pixels, width, height, x, height * 0.45, x + width * 0.025, height * 0.68, width * 0.0035, light, 92);
    }
    drawCircle(pixels, width, height, width * 0.68, height * 0.58, width * 0.1, accent, 104);
    drawCircle(pixels, width, height, width * 0.68, height * 0.58, width * 0.056, base, 190);
    drawRect(pixels, width, height, width * 0.6, height * 0.38, width * 0.63, height * 0.59, light, 126);
  } else if (asset.motif === "city-pipes") {
    drawRect(pixels, width, height, width * 0.08, height * 0.36, width * 0.92, height * 0.66, mid, 134);
    drawLine(pixels, width, height, width * 0.08, height * 0.66, width * 0.92, height * 0.58, width * 0.018, light, 132);
    drawLine(pixels, width, height, width * 0.14, height * 0.43, width * 0.86, height * 0.43, width * 0.014, accent, 98);
    for (let index = 0; index < 6; index += 1) {
      const x = width * (0.18 + index * 0.12);
      drawCircle(pixels, width, height, x, height * 0.48, width * 0.045, accent, 142);
      drawCircle(pixels, width, height, x, height * 0.48, width * 0.026, base, 190);
      drawRect(pixels, width, height, x - width * 0.01, height * 0.31, x + width * 0.01, height * 0.64, light, 108);
    }
    drawRect(pixels, width, height, width * 0.36, height * 0.54, width * 0.64, height * 0.64, base, 152);
  } else if (asset.motif === "mine") {
    drawTriangle(pixels, width, height, width * 0.14, height * 0.72, width * 0.36, height * 0.32, width * 0.58, height * 0.72, mid, 142);
    drawTriangle(pixels, width, height, width * 0.42, height * 0.72, width * 0.68, height * 0.28, width * 0.9, height * 0.72, base, 156);
    drawLine(pixels, width, height, width * 0.12, height * 0.72, width * 0.9, height * 0.58, width * 0.008, light, 118);
    drawLine(pixels, width, height, width * 0.2, height * 0.32, width * 0.2, height * 0.68, width * 0.01, light, 128);
    drawLine(pixels, width, height, width * 0.2, height * 0.32, width * 0.42, height * 0.62, width * 0.006, light, 96);
    drawLine(pixels, width, height, width * 0.2, height * 0.32, width * 0.05, height * 0.62, width * 0.006, light, 96);
    drawCircle(pixels, width, height, width * 0.66, height * 0.5, width * 0.088, accent, 100);
    drawCircle(pixels, width, height, width * 0.66, height * 0.5, width * 0.045, base, 182);
  } else if (asset.motif === "data-tower") {
    for (let index = 0; index < 7; index += 1) {
      const x = width * (0.18 + index * 0.085);
      const top = height * (0.18 + (index % 3) * 0.035);
      drawRect(pixels, width, height, x, top, x + width * 0.046, height * 0.72, light, 112);
      drawLine(pixels, width, height, x + width * 0.023, top + height * 0.02, x + width * 0.023, height * 0.69, width * 0.003, accent, 155);
    }
    drawLine(pixels, width, height, width * 0.12, height * 0.58, width * 0.86, height * 0.42, width * 0.008, accent, 134);
    drawLine(pixels, width, height, width * 0.16, height * 0.69, width * 0.82, height * 0.54, width * 0.006, light, 118);
    drawCircle(pixels, width, height, width * 0.62, height * 0.36, width * 0.12, accent, 86);
  } else if (asset.motif === "orbit-city") {
    drawCircle(pixels, width, height, width * 0.5, height * 0.48, width * 0.28, light, 74);
    drawCircle(pixels, width, height, width * 0.5, height * 0.48, width * 0.2, base, 132);
    drawLine(pixels, width, height, width * 0.16, height * 0.58, width * 0.84, height * 0.4, width * 0.01, accent, 150);
    for (let index = 0; index < 6; index += 1) {
      const x = width * (0.24 + index * 0.09);
      drawRect(pixels, width, height, x, height * 0.46, x + width * 0.055, height * 0.56, mid, 142);
      drawCircle(pixels, width, height, x + width * 0.028, height * 0.44, width * 0.028, accent, 176);
    }
    drawRect(pixels, width, height, width * 0.68, height * 0.22, width * 0.72, height * 0.62, light, 150);
    drawCircle(pixels, width, height, width * 0.7, height * 0.2, width * 0.055, accent, 208);
  } else if (asset.motif === "trench") {
    drawLine(pixels, width, height, width * 0.06, height * 0.8, width * 0.94, height * 0.56, width * 0.021, mid, 166);
    drawLine(pixels, width, height, width * 0.1, height * 0.66, width * 0.88, height * 0.48, width * 0.01, light, 126);
    drawTriangle(pixels, width, height, width * 0.12, height * 0.76, width * 0.34, height * 0.3, width * 0.56, height * 0.76, base, 150);
    drawTriangle(pixels, width, height, width * 0.46, height * 0.78, width * 0.72, height * 0.24, width * 0.96, height * 0.78, mid, 134);
    for (let index = 0; index < 8; index += 1) {
      const x = width * (0.15 + index * 0.095);
      drawLine(pixels, width, height, x, height * 0.25, x + width * 0.035, height * 0.72, width * 0.004, light, 94);
      drawCircle(pixels, width, height, x + width * 0.025, height * (0.33 + (index % 4) * 0.08), width * 0.026, accent, 172);
    }
    for (let index = 0; index < 7; index += 1) {
      const y = height * (0.32 + index * 0.064);
      drawLine(pixels, width, height, width * 0.1, y, width * 0.9, y + Math.sin(index * 1.3) * height * 0.032, width * 0.003, accent, 72);
    }
    drawCircle(pixels, width, height, width * 0.66, height * 0.42, width * 0.105, accent, 72);
  } else if (asset.motif === "dream-pool") {
    drawCircle(pixels, width, height, width * 0.5, height * 0.55, width * 0.26, accent, 96);
    drawCircle(pixels, width, height, width * 0.5, height * 0.55, width * 0.17, base, 156);
    drawCircle(pixels, width, height, width * 0.5, height * 0.55, width * 0.09, light, 80);
    for (let index = 0; index < 10; index += 1) {
      const angle = (Math.PI * 2 * index) / 10;
      const x = width * 0.5 + Math.cos(angle) * width * 0.28;
      const y = height * 0.55 + Math.sin(angle) * height * 0.19;
      drawCircle(pixels, width, height, x, y, width * 0.032, light, 142);
      drawLine(pixels, width, height, width * 0.5, height * 0.55, x, y, width * 0.002, accent, 92);
    }
    for (let index = 0; index < 6; index += 1) {
      const x = width * (0.18 + index * 0.13);
      drawTriangle(pixels, width, height, x, height * 0.27, x - width * 0.042, height * 0.47, x + width * 0.042, height * 0.47, mid, 122);
      drawCircle(pixels, width, height, x, height * 0.24, width * 0.026, accent, 174);
    }
    drawLine(pixels, width, height, width * 0.18, height * 0.7, width * 0.82, height * 0.66, width * 0.007, light, 114);
  } else if (asset.motif === "space-rift") {
    drawLine(pixels, width, height, width * 0.18, height * 0.17, width * 0.74, height * 0.79, width * 0.016, accent, 172);
    drawLine(pixels, width, height, width * 0.24, height * 0.2, width * 0.82, height * 0.73, width * 0.007, light, 132);
    drawLine(pixels, width, height, width * 0.3, height * 0.15, width * 0.64, height * 0.82, width * 0.004, accent, 112);
    for (let index = 0; index < 9; index += 1) {
      const y = height * (0.21 + index * 0.062);
      drawLine(pixels, width, height, width * (0.16 + index * 0.032), y, width * (0.58 + index * 0.04), y + height * 0.075, width * 0.003, light, 96);
      drawCircle(pixels, width, height, width * (0.25 + index * 0.07), height * (0.31 + (index % 4) * 0.085), width * 0.02, accent, 154);
    }
    for (let index = 0; index < 5; index += 1) {
      const x = width * (0.2 + index * 0.13);
      drawRect(pixels, width, height, x, height * 0.57, x + width * 0.058, height * 0.65, mid, 126);
      drawTriangle(pixels, width, height, x + width * 0.029, height * 0.48, x - width * 0.022, height * 0.57, x + width * 0.08, height * 0.57, accent, 138);
    }
    drawCircle(pixels, width, height, width * 0.66, height * 0.4, width * 0.1, accent, 74);
  } else if (asset.motif === "non-euclidean") {
    drawCircle(pixels, width, height, width * 0.58, height * 0.52, width * 0.17, accent, 78);
    drawCircle(pixels, width, height, width * 0.58, height * 0.52, width * 0.09, base, 148);
    for (let index = 0; index < 7; index += 1) {
      const x = width * (0.14 + index * 0.105);
      const y = height * (0.65 - (index % 4) * 0.065);
      drawRect(pixels, width, height, x, y, x + width * 0.13, y + height * 0.038, light, 122);
      drawLine(pixels, width, height, x + width * 0.018, y, x + width * 0.075, y - height * 0.115, width * 0.004, accent, 118);
    }
    drawLine(pixels, width, height, width * 0.19, height * 0.73, width * 0.82, height * 0.32, width * 0.009, mid, 158);
    drawLine(pixels, width, height, width * 0.17, height * 0.35, width * 0.84, height * 0.68, width * 0.004, accent, 100);
    drawTriangle(pixels, width, height, width * 0.22, height * 0.28, width * 0.42, height * 0.48, width * 0.28, height * 0.63, mid, 92);
    drawTriangle(pixels, width, height, width * 0.65, height * 0.26, width * 0.82, height * 0.5, width * 0.6, height * 0.66, base, 118);
    for (let index = 0; index < 5; index += 1) {
      const x = width * (0.28 + index * 0.105);
      drawCircle(pixels, width, height, x, height * (0.28 + index * 0.085), width * 0.026, light, 154);
    }
  } else if (asset.motif === "starship-graveyard") {
    drawLine(pixels, width, height, width * 0.08, height * 0.68, width * 0.92, height * 0.42, width * 0.007, light, 118);
    drawLine(pixels, width, height, width * 0.14, height * 0.78, width * 0.86, height * 0.58, width * 0.013, mid, 150);
    drawCircle(pixels, width, height, width * 0.62, height * 0.38, width * 0.13, accent, 70);
    for (let index = 0; index < 7; index += 1) {
      const x = width * (0.12 + index * 0.115);
      const y = height * (0.4 + (index % 3) * 0.075);
      drawRect(pixels, width, height, x, y, x + width * 0.12, y + height * 0.06, mid, 136);
      drawTriangle(pixels, width, height, x + width * 0.12, y, x + width * 0.18, y + height * 0.03, x + width * 0.12, y + height * 0.06, accent, 118);
      drawCircle(pixels, width, height, x + width * 0.034, y + height * 0.03, width * 0.017, light, 160);
    }
    for (let index = 0; index < 8; index += 1) {
      const x = width * (0.18 + index * 0.09);
      drawLine(pixels, width, height, x, height * 0.25, x + width * 0.05, height * 0.74, width * 0.0028, light, 84);
      drawCircle(pixels, width, height, x + width * 0.038, height * (0.32 + (index % 3) * 0.065), width * 0.019, accent, 152);
    }
  } else if (asset.motif === "abandoned-subway") {
    drawRect(pixels, width, height, width * 0.08, height * 0.48, width * 0.92, height * 0.71, mid, 146);
    drawLine(pixels, width, height, width * 0.08, height * 0.69, width * 0.9, height * 0.6, width * 0.012, light, 118);
    drawLine(pixels, width, height, width * 0.12, height * 0.77, width * 0.88, height * 0.67, width * 0.004, accent, 102);
    drawRect(pixels, width, height, width * 0.16, height * 0.33, width * 0.52, height * 0.47, base, 158);
    drawRect(pixels, width, height, width * 0.2, height * 0.36, width * 0.48, height * 0.39, light, 86);
    for (let index = 0; index < 6; index += 1) {
      const x = width * (0.18 + index * 0.075);
      drawRect(pixels, width, height, x, height * 0.51, x + width * 0.021, height * 0.67, light, 124);
      drawCircle(pixels, width, height, x + width * 0.011, height * 0.47, width * 0.017, accent, 168);
    }
    drawCircle(pixels, width, height, width * 0.72, height * 0.48, width * 0.13, accent, 66);
    drawCircle(pixels, width, height, width * 0.72, height * 0.48, width * 0.07, base, 148);
  } else if (asset.motif === "holographic-theater") {
    drawRect(pixels, width, height, width * 0.12, height * 0.57, width * 0.88, height * 0.72, mid, 150);
    drawRect(pixels, width, height, width * 0.2, height * 0.42, width * 0.8, height * 0.58, base, 132);
    drawLine(pixels, width, height, width * 0.2, height * 0.58, width * 0.8, height * 0.58, width * 0.008, accent, 132);
    drawTriangle(pixels, width, height, width * 0.26, height * 0.18, width * 0.46, height * 0.58, width * 0.12, height * 0.58, accent, 78);
    drawTriangle(pixels, width, height, width * 0.72, height * 0.18, width * 0.88, height * 0.58, width * 0.54, height * 0.58, light, 76);
    for (let index = 0; index < 9; index += 1) {
      const x = width * (0.18 + index * 0.08);
      drawLine(pixels, width, height, x, height * 0.27, x + width * 0.025, height * 0.66, width * 0.0025, light, 94);
      drawCircle(pixels, width, height, x + width * 0.016, height * 0.73, width * 0.017, accent, 144);
    }
    drawCircle(pixels, width, height, width * 0.5, height * 0.48, width * 0.12, accent, 70);
    drawRect(pixels, width, height, width * 0.42, height * 0.51, width * 0.58, height * 0.57, light, 96);
  } else if (asset.motif === "quantum-laboratory") {
    drawRect(pixels, width, height, width * 0.14, height * 0.34, width * 0.86, height * 0.69, mid, 118);
    drawRect(pixels, width, height, width * 0.23, height * 0.26, width * 0.37, height * 0.64, light, 82);
    drawRect(pixels, width, height, width * 0.63, height * 0.26, width * 0.77, height * 0.64, light, 82);
    drawCircle(pixels, width, height, width * 0.5, height * 0.45, width * 0.18, accent, 86);
    drawCircle(pixels, width, height, width * 0.5, height * 0.45, width * 0.105, base, 140);
    for (let index = 0; index < 10; index += 1) {
      const angle = (Math.PI * 2 * index) / 10;
      const x = width * 0.5 + Math.cos(angle) * width * 0.23;
      const y = height * 0.45 + Math.sin(angle) * height * 0.155;
      drawCircle(pixels, width, height, x, y, width * 0.017, light, 152);
      drawLine(pixels, width, height, width * 0.5, height * 0.45, x, y, width * 0.002, accent, 88);
    }
    drawLine(pixels, width, height, width * 0.18, height * 0.72, width * 0.84, height * 0.54, width * 0.01, light, 126);
    drawLine(pixels, width, height, width * 0.18, height * 0.53, width * 0.84, height * 0.73, width * 0.003, accent, 108);
    drawCircle(pixels, width, height, width * 0.72, height * 0.32, width * 0.055, accent, 116);
  } else if (asset.motif === "reflective-city") {
    for (let index = 0; index < 9; index += 1) {
      const x = width * (0.1 + index * 0.09);
      const top = height * (0.16 + (index % 4) * 0.035);
      drawRect(pixels, width, height, x, top, x + width * 0.06, height * 0.69, light, 102);
      drawLine(pixels, width, height, x + width * 0.03, top, x + width * 0.03, height * 0.69, width * 0.003, accent, 148);
      drawLine(pixels, width, height, x, height * 0.48, x + width * 0.06, height * 0.48, width * 0.002, base, 90);
    }
    drawRect(pixels, width, height, width * 0.08, height * 0.68, width * 0.92, height * 0.78, mid, 138);
    drawLine(pixels, width, height, width * 0.08, height * 0.72, width * 0.92, height * 0.58, width * 0.015, accent, 132);
    drawLine(pixels, width, height, width * 0.12, height * 0.79, width * 0.88, height * 0.68, width * 0.006, light, 100);
    for (let index = 0; index < 6; index += 1) {
      const x = width * (0.18 + index * 0.12);
      drawRect(pixels, width, height, x, height * 0.39, x + width * 0.1, height * 0.48, accent, 78);
      drawCircle(pixels, width, height, x + width * 0.05, height * 0.36, width * 0.025, light, 132);
    }
    drawCircle(pixels, width, height, width * 0.62, height * 0.34, width * 0.14, accent, 62);
  } else if (asset.motif === "data-alley") {
    drawRect(pixels, width, height, width * 0.1, height * 0.28, width * 0.9, height * 0.75, base, 106);
    drawLine(pixels, width, height, width * 0.12, height * 0.22, width * 0.88, height * 0.68, width * 0.003, light, 86);
    drawLine(pixels, width, height, width * 0.88, height * 0.22, width * 0.12, height * 0.68, width * 0.003, light, 74);
    for (let index = 0; index < 10; index += 1) {
      const x = width * (0.12 + index * 0.08);
      const y = height * (0.32 + (index % 5) * 0.05);
      drawRect(pixels, width, height, x, y, x + width * 0.065, y + height * 0.052, accent, 126);
      drawLine(pixels, width, height, x, y + height * 0.026, x + width * 0.065, y + height * 0.026, width * 0.002, base, 116);
    }
    drawRect(pixels, width, height, width * 0.18, height * 0.62, width * 0.82, height * 0.73, mid, 144);
    drawLine(pixels, width, height, width * 0.1, height * 0.75, width * 0.9, height * 0.62, width * 0.008, accent, 108);
    for (let index = 0; index < 6; index += 1) {
      const x = width * (0.22 + index * 0.1);
      drawCircle(pixels, width, height, x, height * 0.58, width * 0.026, light, 134);
      drawRect(pixels, width, height, x - width * 0.025, height * 0.64, x + width * 0.025, height * 0.7, mid, 128);
    }
  } else if (asset.motif === "prism-waters") {
    drawRect(pixels, width, height, width * 0.08, height * 0.6, width * 0.92, height * 0.78, mid, 128);
    for (let index = 0; index < 8; index += 1) {
      const y = height * (0.42 + index * 0.04);
      drawLine(pixels, width, height, width * 0.08, y, width * 0.92, y - height * 0.1, width * 0.004, index % 2 ? light : accent, 96);
    }
    for (let index = 0; index < 6; index += 1) {
      const x = width * (0.14 + index * 0.14);
      drawTriangle(pixels, width, height, x, height * 0.24, x - width * 0.04, height * 0.58, x + width * 0.06, height * 0.6, light, 124);
      drawLine(pixels, width, height, x, height * 0.25, x + width * 0.1, height * 0.74, width * 0.003, accent, 116);
      drawCircle(pixels, width, height, x + width * 0.06, height * 0.64, width * 0.02, accent, 124);
    }
    drawCircle(pixels, width, height, width * 0.74, height * 0.34, width * 0.12, accent, 62);
  } else if (asset.motif === "probability-greenhouse") {
    drawRect(pixels, width, height, width * 0.1, height * 0.3, width * 0.9, height * 0.76, base, 110);
    for (let index = 0; index < 9; index += 1) {
      const x = width * (0.14 + index * 0.085);
      drawLine(pixels, width, height, x, height * 0.3, x + width * 0.06, height * 0.76, width * 0.003, light, 86);
      drawCircle(pixels, width, height, x + width * 0.03, height * (0.43 + (index % 4) * 0.055), width * 0.026, accent, 132);
      drawRect(pixels, width, height, x - width * 0.02, height * 0.62, x + width * 0.05, height * 0.67, mid, 118);
    }
    drawTriangle(pixels, width, height, width * 0.5, height * 0.18, width * 0.12, height * 0.34, width * 0.88, height * 0.34, light, 82);
    drawLine(pixels, width, height, width * 0.18, height * 0.7, width * 0.82, height * 0.58, width * 0.012, mid, 136);
  } else if (asset.motif === "prophecy-server") {
    drawRect(pixels, width, height, width * 0.08, height * 0.26, width * 0.92, height * 0.74, base, 120);
    for (let index = 0; index < 8; index += 1) {
      const x = width * (0.13 + index * 0.09);
      const top = height * (0.2 + (index % 2) * 0.035);
      drawRect(pixels, width, height, x, top, x + width * 0.055, height * 0.7, mid, 138);
      drawLine(pixels, width, height, x + width * 0.027, top + height * 0.02, x + width * 0.027, height * 0.68, width * 0.003, light, 126);
      drawCircle(pixels, width, height, x + width * 0.027, height * (0.34 + (index % 4) * 0.08), width * 0.019, accent, 162);
    }
    drawCircle(pixels, width, height, width * 0.68, height * 0.4, width * 0.15, accent, 70);
    drawCircle(pixels, width, height, width * 0.68, height * 0.4, width * 0.085, base, 152);
    drawLine(pixels, width, height, width * 0.12, height * 0.78, width * 0.88, height * 0.57, width * 0.009, light, 118);
    drawLine(pixels, width, height, width * 0.22, height * 0.5, width * 0.76, height * 0.36, width * 0.005, accent, 106);
  } else if (asset.motif === "orbital-cathedral") {
    drawCircle(pixels, width, height, width * 0.5, height * 0.48, width * 0.3, light, 76);
    drawCircle(pixels, width, height, width * 0.5, height * 0.48, width * 0.22, base, 134);
    drawCircle(pixels, width, height, width * 0.5, height * 0.48, width * 0.13, accent, 66);
    drawRect(pixels, width, height, width * 0.16, height * 0.54, width * 0.84, height * 0.7, mid, 144);
    drawTriangle(pixels, width, height, width * 0.5, height * 0.2, width * 0.28, height * 0.56, width * 0.72, height * 0.56, light, 70);
    for (let index = 0; index < 7; index += 1) {
      const x = width * (0.18 + index * 0.105);
      drawLine(pixels, width, height, x, height * 0.25, x + width * 0.045, height * 0.68, width * 0.003, light, 104);
      drawCircle(pixels, width, height, x + width * 0.022, height * 0.3, width * 0.024, accent, 154);
    }
    drawLine(pixels, width, height, width * 0.16, height * 0.66, width * 0.84, height * 0.45, width * 0.008, accent, 112);
  } else {
    drawCircle(pixels, width, height, width * 0.52, height * 0.44, width * 0.16, accent, 108);
    drawCircle(pixels, width, height, width * 0.52, height * 0.44, width * 0.075, base, 210);
    for (let index = 0; index < 10; index += 1) {
      const x = width * (0.12 + index * 0.08);
      drawTriangle(pixels, width, height, x, height * 0.31, x - width * 0.035, height * 0.72, x + width * 0.035, height * 0.72, mid, 140);
    }
    drawLine(pixels, width, height, width * 0.22, height * 0.66, width * 0.78, height * 0.66, width * 0.006, light, 120);
  }
}

function drawWorldScene(asset: EpochWorldSceneRecord) {
  const width = EPOCH_WORLD_SCENE_WIDTH;
  const height = EPOCH_WORLD_SCENE_HEIGHT;
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
      const horizon = Math.max(0, 1 - Math.abs(v - 0.48) * 2.7);
      const gateGlow = Math.max(0, 1 - Math.hypot(u - 0.55, v - 0.38) * 1.5);
      const strata = (Math.sin((u * 7.5 + v * 3.4 + seed * 4.8) * Math.PI) + 1) / 2;
      let color = mix(base, mid, v * 0.44 + horizon * 0.16 + strata * 0.045);
      color = mix(color, accent, gateGlow * 0.32);
      color = mix(color, trim, Math.max(0, v - 0.72) * 0.24);
      color = mix(color, base, Math.max(0, Math.hypot(u - 0.5, v - 0.48) - 0.65) * 1.08);
      setPixel(pixels, width, x, y, color);
    }
  }

  drawCircle(pixels, width, height, width * 0.58, height * 0.36, width * 0.23, mix(accent, trim, 0.2), 66);
  drawLine(pixels, width, height, width * 0.05, height * 0.79, width * 0.95, height * 0.61, width * 0.004, mix(mid, trim, 0.35), 120);
  drawLine(pixels, width, height, width * 0.1, height * 0.24, width * 0.9, height * 0.72, width * 0.003, mix(accent, trim, 0.22), 86);
  drawMotif(asset, pixels, width, height, base, mid, accent, light);
  return encodePngRgba(width, height, pixels);
}

async function writeStaticInstallManifest(manifestPath: string, worldScenes: readonly EpochWorldSceneManifestEntry[]) {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as Record<string, unknown>;
  const existingAssets = typeof manifest.assets === "object" && manifest.assets !== null
    ? manifest.assets as Record<string, unknown>
    : {};
  const next = {
    ...manifest,
    assets: {
      ...existingAssets,
      worldScenes,
    },
  };
  await writeFile(manifestPath, `${JSON.stringify(next, null, 2)}\n`);
}

async function main() {
  const worldScenes: EpochWorldSceneManifestEntry[] = [];
  for (const asset of EPOCH_WORLD_SCENES) {
    const content = drawWorldScene(asset);
    const outputPath = join(packageRoot, asset.path);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, content);
    worldScenes.push({
      sceneKey: asset.sceneKey,
      regionId: asset.regionId,
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

  await writeStaticInstallManifest(join(packageRoot, "install-manifest.json"), worldScenes);
  await writeStaticInstallManifest(join(packageRoot, "obsidian-epoch/assets/install-manifest.json"), worldScenes);
  if (process.argv.includes("--json")) {
    process.stdout.write(`${JSON.stringify({ worldScenes }, null, 2)}\n`);
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
