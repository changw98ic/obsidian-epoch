import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  EPOCH_ITEM_ASSETS,
  EPOCH_ITEM_ASSET_HEIGHT,
  EPOCH_ITEM_ASSET_WIDTH,
  type EpochItemAssetManifestEntry,
  type EpochItemAssetRecord,
} from "./lib/itemAssets.ts";
import { encodePngRgba, hashSeed, hexToRgb, mix, setPixel, type Rgb } from "./lib/pngDrawing.ts";

const serverRoot = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(serverRoot, "package");

function drawCircle(
  pixels: Buffer,
  width: number,
  centerX: number,
  centerY: number,
  radius: number,
  color: Rgb,
  alpha = 255,
) {
  const startX = Math.max(0, Math.floor(centerX - radius));
  const endX = Math.min(width - 1, Math.ceil(centerX + radius));
  const startY = Math.max(0, Math.floor(centerY - radius));
  const endY = Math.min(width - 1, Math.ceil(centerY + radius));
  for (let y = startY; y <= endY; y += 1) {
    for (let x = startX; x <= endX; x += 1) {
      if (Math.hypot(x - centerX, y - centerY) <= radius) setPixel(pixels, width, x, y, color, alpha);
    }
  }
}

function drawRect(
  pixels: Buffer,
  width: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: Rgb,
  alpha = 255,
) {
  for (let y = Math.max(0, Math.floor(y1)); y <= Math.min(width - 1, Math.ceil(y2)); y += 1) {
    for (let x = Math.max(0, Math.floor(x1)); x <= Math.min(width - 1, Math.ceil(x2)); x += 1) {
      setPixel(pixels, width, x, y, color, alpha);
    }
  }
}

function drawDiamond(
  pixels: Buffer,
  width: number,
  centerX: number,
  centerY: number,
  radiusX: number,
  radiusY: number,
  color: Rgb,
  alpha = 255,
) {
  const startX = Math.max(0, Math.floor(centerX - radiusX));
  const endX = Math.min(width - 1, Math.ceil(centerX + radiusX));
  const startY = Math.max(0, Math.floor(centerY - radiusY));
  const endY = Math.min(width - 1, Math.ceil(centerY + radiusY));
  for (let y = startY; y <= endY; y += 1) {
    for (let x = startX; x <= endX; x += 1) {
      const dx = Math.abs(x - centerX) / radiusX;
      const dy = Math.abs(y - centerY) / radiusY;
      if (dx + dy <= 1) setPixel(pixels, width, x, y, color, alpha);
    }
  }
}

function drawItemIcon(asset: EpochItemAssetRecord) {
  const width = EPOCH_ITEM_ASSET_WIDTH;
  const height = EPOCH_ITEM_ASSET_HEIGHT;
  const pixels = Buffer.alloc(width * height * 4);
  const colors = asset.palette.map(hexToRgb);
  const base = colors[0];
  const mid = colors[1];
  const light = colors[2];
  const trim = colors[3] || light;
  const accent = hexToRgb(asset.accentColor);
  const seed = hashSeed(asset.itemKey);

  for (let y = 0; y < height; y += 1) {
    const v = y / Math.max(1, height - 1);
    for (let x = 0; x < width; x += 1) {
      const u = x / Math.max(1, width - 1);
      const radial = Math.max(0, 1 - Math.hypot(u - 0.5, v - 0.45) * 1.55);
      const diagonal = (Math.sin((u * 5 + v * 4 + seed * 7) * Math.PI) + 1) / 2;
      let color = mix(base, mid, radial * 0.55 + diagonal * 0.1);
      color = mix(color, accent, Math.max(0, radial - 0.56) * 0.5);
      color = mix(color, base, Math.max(0, Math.hypot(u - 0.5, v - 0.5) - 0.55) * 1.5);
      setPixel(pixels, width, x, y, color);
    }
  }

  drawCircle(pixels, width, width * 0.5, height * 0.5, width * 0.31, mix(mid, base, 0.2), 220);
  drawCircle(pixels, width, width * 0.5, height * 0.5, width * 0.25, mix(accent, light, 0.22), 235);
  drawDiamond(pixels, width, width * 0.5, height * 0.5, width * 0.2, height * 0.27, mix(light, trim, 0.25), 238);
  drawDiamond(pixels, width, width * 0.5, height * 0.5, width * 0.13, height * 0.19, mix(accent, trim, 0.28), 250);

  const notchCount = 5 + Math.floor(seed * 4);
  for (let index = 0; index < notchCount; index += 1) {
    const angle = (index / notchCount) * Math.PI * 2 + seed * Math.PI;
    const x = width * (0.5 + Math.cos(angle) * 0.32);
    const y = height * (0.5 + Math.sin(angle) * 0.32);
    drawCircle(pixels, width, x, y, width * 0.025, trim, 230);
  }

  if (asset.itemKey.includes("lantern")) {
    drawRect(pixels, width, width * 0.42, height * 0.23, width * 0.58, height * 0.7, mix(base, trim, 0.42), 210);
    drawCircle(pixels, width, width * 0.5, height * 0.48, width * 0.11, light, 245);
  } else if (asset.itemKey.includes("relic")) {
    drawDiamond(pixels, width, width * 0.5, height * 0.5, width * 0.09, height * 0.35, trim, 240);
    drawCircle(pixels, width, width * 0.5, height * 0.52, width * 0.05, accent, 255);
  } else if (asset.itemKey.includes("ration")) {
    drawRect(pixels, width, width * 0.34, height * 0.38, width * 0.66, height * 0.68, mix(mid, trim, 0.3), 235);
    drawRect(pixels, width, width * 0.38, height * 0.32, width * 0.62, height * 0.43, trim, 230);
  } else if (asset.itemKey.includes("valve")) {
    drawCircle(pixels, width, width * 0.5, height * 0.49, width * 0.15, mix(base, trim, 0.5), 238);
    drawCircle(pixels, width, width * 0.5, height * 0.49, width * 0.08, mix(light, accent, 0.35), 250);
    drawRect(pixels, width, width * 0.22, height * 0.46, width * 0.78, height * 0.53, trim, 225);
    drawRect(pixels, width, width * 0.46, height * 0.21, width * 0.54, height * 0.78, trim, 225);
  } else if (asset.itemKey.includes("mine-echo")) {
    drawDiamond(pixels, width, width * 0.5, height * 0.5, width * 0.11, height * 0.32, mix(light, accent, 0.2), 246);
    drawCircle(pixels, width, width * 0.5, height * 0.5, width * 0.17, accent, 110);
    drawCircle(pixels, width, width * 0.5, height * 0.5, width * 0.24, trim, 70);
  } else {
    drawRect(pixels, width, width * 0.46, height * 0.25, width * 0.54, height * 0.75, trim, 215);
    drawRect(pixels, width, width * 0.28, height * 0.46, width * 0.72, height * 0.54, trim, 215);
  }

  return encodePngRgba(width, height, pixels);
}

async function writeStaticInstallManifest(manifestPath: string, items: readonly EpochItemAssetManifestEntry[]) {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as Record<string, unknown>;
  const existingAssets = typeof manifest.assets === "object" && manifest.assets !== null
    ? manifest.assets as Record<string, unknown>
    : {};
  const next = {
    ...manifest,
    assets: {
      ...existingAssets,
      items,
    },
  };
  await writeFile(manifestPath, `${JSON.stringify(next, null, 2)}\n`);
}

async function main() {
  const items: EpochItemAssetManifestEntry[] = [];
  for (const asset of EPOCH_ITEM_ASSETS) {
    const content = drawItemIcon(asset);
    const outputPath = join(packageRoot, asset.path);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, content);
    items.push({
      itemKey: asset.itemKey,
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
  await writeStaticInstallManifest(join(packageRoot, "install-manifest.json"), items);
  await writeStaticInstallManifest(join(packageRoot, "obsidian-epoch/assets/install-manifest.json"), items);
  if (process.argv.includes("--json")) {
    process.stdout.write(`${JSON.stringify({ items }, null, 2)}\n`);
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
