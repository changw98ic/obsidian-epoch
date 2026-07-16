import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  EPOCH_EVENT_STATE_ASSETS,
  EPOCH_EVENT_STATE_HEIGHT,
  EPOCH_EVENT_STATE_WIDTH,
  type EpochEventStateManifestEntry,
  type EpochEventStateRecord,
} from "./lib/eventStateAssets.ts";
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

function drawDiamond(pixels: Buffer, width: number, height: number, centerX: number, centerY: number, radiusX: number, radiusY: number, color: Rgb, alpha = 255) {
  drawTriangle(pixels, width, height, centerX, centerY - radiusY, centerX - radiusX, centerY, centerX, centerY + radiusY, color, alpha);
  drawTriangle(pixels, width, height, centerX, centerY - radiusY, centerX, centerY + radiusY, centerX + radiusX, centerY, color, alpha);
}

function drawMotif(asset: EpochEventStateRecord, pixels: Buffer, width: number, height: number, base: Rgb, mid: Rgb, accent: Rgb, light: Rgb) {
  if (asset.motif === "resource-open") {
    for (let index = 0; index < 7; index += 1) {
      const x = width * (0.26 + index * 0.075);
      drawDiamond(pixels, width, height, x, height * 0.52, width * 0.035, height * (0.13 + index % 2 * 0.025), accent, 170);
      drawLine(pixels, width, height, x, height * 0.68, x, height * 0.38, width * 0.004, light, 120);
    }
    drawCircle(pixels, width, height, width * 0.5, height * 0.52, width * 0.2, accent, 60);
  } else if (asset.motif === "resource-contested") {
    drawLine(pixels, width, height, width * 0.18, height * 0.68, width * 0.82, height * 0.68, width * 0.014, light, 160);
    for (let index = 0; index < 4; index += 1) {
      const x = width * (0.27 + index * 0.15);
      drawRect(pixels, width, height, x, height * 0.28, x + width * 0.018, height * 0.66, mid, 190);
      drawTriangle(pixels, width, height, x + width * 0.018, height * 0.3, x + width * 0.13, height * 0.36, x + width * 0.018, height * 0.43, index % 2 ? accent : light, 185);
    }
    drawCircle(pixels, width, height, width * 0.5, height * 0.58, width * 0.16, accent, 80);
  } else if (asset.motif === "anomaly") {
    drawCircle(pixels, width, height, width * 0.52, height * 0.48, width * 0.22, accent, 105);
    for (let index = 0; index < 12; index += 1) {
      const angle = index * Math.PI / 6;
      drawLine(pixels, width, height, width * 0.52, height * 0.48, width * (0.52 + Math.cos(angle) * 0.32), height * (0.48 + Math.sin(angle) * 0.28), width * 0.006, light, 150);
    }
    drawCircle(pixels, width, height, width * 0.52, height * 0.48, width * 0.085, base, 225);
  } else if (asset.motif === "bounty") {
    drawRect(pixels, width, height, width * 0.27, height * 0.26, width * 0.72, height * 0.66, light, 160);
    drawRect(pixels, width, height, width * 0.31, height * 0.32, width * 0.68, height * 0.6, base, 185);
    drawCircle(pixels, width, height, width * 0.5, height * 0.46, width * 0.075, accent, 220);
    drawLine(pixels, width, height, width * 0.36, height * 0.37, width * 0.64, height * 0.37, width * 0.004, accent, 180);
    drawLine(pixels, width, height, width * 0.36, height * 0.55, width * 0.64, height * 0.55, width * 0.004, accent, 180);
  } else if (asset.motif === "market") {
    drawRect(pixels, width, height, width * 0.2, height * 0.43, width * 0.72, height * 0.58, mid, 185);
    drawTriangle(pixels, width, height, width * 0.72, height * 0.43, width * 0.86, height * 0.5, width * 0.72, height * 0.58, mid, 185);
    drawCircle(pixels, width, height, width * 0.31, height * 0.64, width * 0.052, accent, 225);
    drawCircle(pixels, width, height, width * 0.66, height * 0.64, width * 0.052, accent, 225);
    drawLine(pixels, width, height, width * 0.26, height * 0.38, width * 0.65, height * 0.24, width * 0.006, light, 150);
  } else {
    for (let index = 0; index < 3; index += 1) {
      const x = width * (0.34 + index * 0.16);
      drawRect(pixels, width, height, x, height * 0.3, x + width * 0.04, height * 0.68, light, 155);
      drawTriangle(pixels, width, height, x, height * 0.3, x + width * 0.02, height * 0.21, x + width * 0.04, height * 0.3, accent, 190);
    }
    drawRect(pixels, width, height, width * 0.22, height * 0.68, width * 0.78, height * 0.72, mid, 195);
    drawCircle(pixels, width, height, width * 0.5, height * 0.5, width * 0.16, accent, 70);
  }
}

function drawEventState(asset: EpochEventStateRecord) {
  const width = EPOCH_EVENT_STATE_WIDTH;
  const height = EPOCH_EVENT_STATE_HEIGHT;
  const pixels = Buffer.alloc(width * height * 4);
  const colors = asset.palette.map(hexToRgb);
  const base = colors[0];
  const mid = colors[1];
  const light = colors[2] || mid;
  const trim = colors[3] || light;
  const accent = hexToRgb(asset.accentColor);
  const seed = hashSeed(asset.stateKey);

  for (let y = 0; y < height; y += 1) {
    const v = y / Math.max(1, height - 1);
    for (let x = 0; x < width; x += 1) {
      const u = x / Math.max(1, width - 1);
      const glow = Math.max(0, 1 - Math.hypot(u - 0.52, v - 0.48) * 1.65);
      const band = Math.max(0, 1 - Math.abs(v - 0.64) * 4.2);
      const grain = (Math.sin((u * 9.2 + v * 7.4 + seed * 5.8) * Math.PI) + 1) / 2;
      let color = mix(base, mid, v * 0.48 + band * 0.12 + grain * 0.045);
      color = mix(color, accent, glow * 0.34);
      color = mix(color, trim, Math.max(0, u - 0.68) * 0.16);
      color = mix(color, base, Math.max(0, Math.hypot(u - 0.5, v - 0.48) - 0.68) * 1.08);
      setPixel(pixels, width, x, y, color);
    }
  }

  drawRect(pixels, width, height, width * 0.12, height * 0.72, width * 0.88, height * 0.75, mix(mid, trim, 0.25), 155);
  drawLine(pixels, width, height, width * 0.08, height * 0.22, width * 0.92, height * 0.66, width * 0.004, mix(accent, trim, 0.2), 90);
  drawLine(pixels, width, height, width * 0.09, height * 0.78, width * 0.91, height * 0.52, width * 0.004, mix(light, trim, 0.2), 115);
  drawMotif(asset, pixels, width, height, base, mid, accent, light);
  return encodePngRgba(width, height, pixels);
}

async function writeStaticInstallManifest(manifestPath: string, eventStates: readonly EpochEventStateManifestEntry[]) {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as Record<string, unknown>;
  const existingAssets = typeof manifest.assets === "object" && manifest.assets !== null
    ? manifest.assets as Record<string, unknown>
    : {};
  const next = {
    ...manifest,
    assets: {
      ...existingAssets,
      eventStates,
    },
  };
  await writeFile(manifestPath, `${JSON.stringify(next, null, 2)}\n`);
}

async function main() {
  const eventStates: EpochEventStateManifestEntry[] = [];
  for (const asset of EPOCH_EVENT_STATE_ASSETS) {
    const content = drawEventState(asset);
    const outputPath = join(packageRoot, asset.path);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, content);
    eventStates.push({
      stateKey: asset.stateKey,
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

  await writeStaticInstallManifest(join(packageRoot, "install-manifest.json"), eventStates);
  await writeStaticInstallManifest(join(packageRoot, "obsidian-epoch/assets/install-manifest.json"), eventStates);
  if (process.argv.includes("--json")) {
    process.stdout.write(`${JSON.stringify({ eventStates }, null, 2)}\n`);
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
