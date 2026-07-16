import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  EPOCH_PAGE_SCENE_ASSETS,
  EPOCH_PAGE_SCENE_ASSET_HEIGHT,
  EPOCH_PAGE_SCENE_ASSET_WIDTH,
  type EpochPageSceneAssetManifestEntry,
  type EpochPageSceneAssetRecord,
} from "./lib/pageSceneAssets.ts";
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

function drawDiamond(pixels: Buffer, width: number, height: number, centerX: number, centerY: number, radiusX: number, radiusY: number, color: Rgb, alpha = 255) {
  const startX = Math.max(0, Math.floor(centerX - radiusX));
  const endX = Math.min(width - 1, Math.ceil(centerX + radiusX));
  const startY = Math.max(0, Math.floor(centerY - radiusY));
  const endY = Math.min(height - 1, Math.ceil(centerY + radiusY));
  for (let y = startY; y <= endY; y += 1) {
    for (let x = startX; x <= endX; x += 1) {
      const dx = Math.abs(x - centerX) / radiusX;
      const dy = Math.abs(y - centerY) / radiusY;
      if (dx + dy <= 1) setPixel(pixels, width, x, y, color, alpha);
    }
  }
}

function drawCardGrid(pixels: Buffer, width: number, height: number, startX: number, startY: number, count: number, color: Rgb, alpha: number) {
  for (let index = 0; index < count; index += 1) {
    const x = startX + (index % 3) * width * 0.105;
    const y = startY + Math.floor(index / 3) * height * 0.13;
    drawRect(pixels, width, height, x, y, x + width * 0.075, y + height * 0.075, color, alpha);
  }
}

function drawMotif(asset: EpochPageSceneAssetRecord, pixels: Buffer, width: number, height: number, base: Rgb, accent: Rgb, light: Rgb, trim: Rgb) {
  if (asset.motif === "portal") {
    drawRect(pixels, width, height, width * 0.61, height * 0.18, width * 0.83, height * 0.78, trim, 210);
    drawRect(pixels, width, height, width * 0.65, height * 0.28, width * 0.79, height * 0.78, base, 225);
    drawCircle(pixels, width, height, width * 0.72, height * 0.44, width * 0.065, accent, 180);
  } else if (asset.motif === "dashboard") {
    drawCardGrid(pixels, width, height, width * 0.56, height * 0.22, 6, trim, 190);
    drawLine(pixels, width, height, width * 0.56, height * 0.72, width * 0.82, height * 0.46, width * 0.008, accent, 210);
  } else if (asset.motif === "identity") {
    drawCircle(pixels, width, height, width * 0.69, height * 0.38, width * 0.095, trim, 220);
    drawRect(pixels, width, height, width * 0.57, height * 0.56, width * 0.81, height * 0.7, trim, 200);
  } else if (asset.motif === "region") {
    drawLine(pixels, width, height, width * 0.52, height * 0.62, width * 0.82, height * 0.28, width * 0.012, trim, 220);
    drawLine(pixels, width, height, width * 0.52, height * 0.62, width * 0.83, height * 0.72, width * 0.012, trim, 220);
    drawCircle(pixels, width, height, width * 0.52, height * 0.62, width * 0.05, accent, 240);
    drawCircle(pixels, width, height, width * 0.82, height * 0.28, width * 0.04, light, 240);
    drawCircle(pixels, width, height, width * 0.83, height * 0.72, width * 0.04, light, 240);
  } else if (asset.motif === "season") {
    drawRect(pixels, width, height, width * 0.54, height * 0.28, width * 0.83, height * 0.55, trim, 205);
    drawLine(pixels, width, height, width * 0.54, height * 0.64, width * 0.83, height * 0.64, width * 0.018, accent, 230);
    drawDiamond(pixels, width, height, width * 0.69, height * 0.41, width * 0.08, height * 0.11, base, 210);
  } else if (asset.motif === "portrait") {
    drawRect(pixels, width, height, width * 0.58, height * 0.18, width * 0.79, height * 0.8, trim, 210);
    drawCircle(pixels, width, height, width * 0.685, height * 0.39, width * 0.07, base, 220);
    drawLine(pixels, width, height, width * 0.62, height * 0.6, width * 0.75, height * 0.6, width * 0.01, base, 230);
  } else if (asset.motif === "archive") {
    drawRect(pixels, width, height, width * 0.55, height * 0.31, width * 0.82, height * 0.68, trim, 210);
    drawRect(pixels, width, height, width * 0.59, height * 0.24, width * 0.7, height * 0.31, light, 220);
    drawLine(pixels, width, height, width * 0.6, height * 0.5, width * 0.77, height * 0.5, width * 0.01, base, 230);
  } else if (asset.motif === "audit") {
    drawCardGrid(pixels, width, height, width * 0.54, height * 0.23, 4, trim, 190);
    drawLine(pixels, width, height, width * 0.57, height * 0.32, width * 0.79, height * 0.63, width * 0.008, accent, 220);
    drawCircle(pixels, width, height, width * 0.79, height * 0.63, width * 0.045, light, 235);
  } else if (asset.motif === "result") {
    drawRect(pixels, width, height, width * 0.54, height * 0.23, width * 0.81, height * 0.7, trim, 210);
    drawLine(pixels, width, height, width * 0.59, height * 0.44, width * 0.68, height * 0.55, width * 0.012, base, 230);
    drawLine(pixels, width, height, width * 0.68, height * 0.55, width * 0.78, height * 0.35, width * 0.012, base, 230);
  } else if (asset.motif === "bridge") {
    drawCircle(pixels, width, height, width * 0.58, height * 0.5, width * 0.055, accent, 230);
    drawCircle(pixels, width, height, width * 0.78, height * 0.5, width * 0.055, light, 230);
    drawLine(pixels, width, height, width * 0.63, height * 0.5, width * 0.73, height * 0.5, width * 0.016, trim, 235);
  } else if (asset.motif === "market") {
    drawRect(pixels, width, height, width * 0.54, height * 0.36, width * 0.84, height * 0.62, trim, 210);
    drawLine(pixels, width, height, width * 0.59, height * 0.36, width * 0.65, height * 0.25, width * 0.01, light, 225);
    drawLine(pixels, width, height, width * 0.79, height * 0.36, width * 0.73, height * 0.25, width * 0.01, light, 225);
    drawCircle(pixels, width, height, width * 0.62, height * 0.7, width * 0.035, accent, 240);
    drawCircle(pixels, width, height, width * 0.76, height * 0.7, width * 0.035, accent, 240);
  } else {
    drawDiamond(pixels, width, height, width * 0.68, height * 0.45, width * 0.16, height * 0.11, trim, 215);
    drawCircle(pixels, width, height, width * 0.68, height * 0.45, width * 0.045, base, 230);
    drawRect(pixels, width, height, width * 0.59, height * 0.62, width * 0.77, height * 0.7, light, 180);
  }
}

function drawPageScene(asset: EpochPageSceneAssetRecord) {
  const width = EPOCH_PAGE_SCENE_ASSET_WIDTH;
  const height = EPOCH_PAGE_SCENE_ASSET_HEIGHT;
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
      const diagonal = (u * 0.62 + v * 0.38);
      const glow = Math.max(0, 1 - Math.hypot(u - 0.68, v - 0.48) * 1.9);
      const wave = (Math.sin((u * 4.2 + v * 2.6 + seed * 5.1) * Math.PI) + 1) / 2;
      let color = mix(base, mid, diagonal * 0.52 + wave * 0.08);
      color = mix(color, accent, glow * 0.38);
      color = mix(color, base, Math.max(0, Math.hypot(u - 0.5, v - 0.5) - 0.58) * 1.25);
      setPixel(pixels, width, x, y, color);
    }
  }

  drawCircle(pixels, width, height, width * 0.72, height * 0.48, width * (0.2 + seed * 0.04), mix(accent, light, 0.2), 84);
  drawLine(pixels, width, height, width * 0.06, height * 0.76, width * 0.5, height * 0.28, width * 0.006, mix(mid, light, 0.2), 145);
  drawLine(pixels, width, height, width * 0.12, height * 0.22, width * 0.9, height * 0.78, width * 0.004, mix(mid, accent, 0.25), 120);
  drawRect(pixels, width, height, width * 0.06, height * 0.17, width * 0.42, height * 0.77, mix(base, mid, 0.42), 172);
  drawRect(pixels, width, height, width * 0.1, height * 0.24, width * 0.38, height * 0.31, light, 128);
  drawRect(pixels, width, height, width * 0.1, height * 0.39, width * 0.35, height * 0.44, accent, 118);
  drawRect(pixels, width, height, width * 0.1, height * 0.53, width * 0.31, height * 0.58, trim, 110);
  drawMotif(asset, pixels, width, height, base, accent, light, trim);

  return encodePngRgba(width, height, pixels);
}

async function writeStaticInstallManifest(manifestPath: string, pageScenes: readonly EpochPageSceneAssetManifestEntry[]) {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as Record<string, unknown>;
  const existingAssets = typeof manifest.assets === "object" && manifest.assets !== null
    ? manifest.assets as Record<string, unknown>
    : {};
  const next = {
    ...manifest,
    assets: {
      ...existingAssets,
      pageScenes,
    },
  };
  await writeFile(manifestPath, `${JSON.stringify(next, null, 2)}\n`);
}

async function main() {
  const pageScenes: EpochPageSceneAssetManifestEntry[] = [];
  for (const asset of EPOCH_PAGE_SCENE_ASSETS) {
    const content = drawPageScene(asset);
    const outputPath = join(packageRoot, asset.path);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, content);
    pageScenes.push({
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

  await writeStaticInstallManifest(join(packageRoot, "install-manifest.json"), pageScenes);
  await writeStaticInstallManifest(join(packageRoot, "obsidian-epoch/assets/install-manifest.json"), pageScenes);
  if (process.argv.includes("--json")) {
    process.stdout.write(`${JSON.stringify({ pageScenes }, null, 2)}\n`);
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
