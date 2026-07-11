import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  EPOCH_ACTIVITY_ASSETS,
  EPOCH_ACTIVITY_ASSET_HEIGHT,
  EPOCH_ACTIVITY_ASSET_WIDTH,
  type EpochActivityAssetManifestEntry,
  type EpochActivityAssetRecord,
} from "./lib/activityAssets.ts";
import { encodePngRgba, hashSeed, hexToRgb, mix, setPixel, type Rgb } from "./lib/pngDrawing.ts";

const serverRoot = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(serverRoot, "package");

function drawCircle(
  pixels: Buffer,
  width: number,
  height: number,
  centerX: number,
  centerY: number,
  radius: number,
  color: Rgb,
  alpha = 255,
) {
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

function drawRect(
  pixels: Buffer,
  width: number,
  height: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: Rgb,
  alpha = 255,
) {
  for (let y = Math.max(0, Math.floor(y1)); y <= Math.min(height - 1, Math.ceil(y2)); y += 1) {
    for (let x = Math.max(0, Math.floor(x1)); x <= Math.min(width - 1, Math.ceil(x2)); x += 1) {
      setPixel(pixels, width, x, y, color, alpha);
    }
  }
}

function drawDiamond(
  pixels: Buffer,
  width: number,
  height: number,
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
  const endY = Math.min(height - 1, Math.ceil(centerY + radiusY));
  for (let y = startY; y <= endY; y += 1) {
    for (let x = startX; x <= endX; x += 1) {
      const dx = Math.abs(x - centerX) / radiusX;
      const dy = Math.abs(y - centerY) / radiusY;
      if (dx + dy <= 1) setPixel(pixels, width, x, y, color, alpha);
    }
  }
}

function drawLine(
  pixels: Buffer,
  width: number,
  height: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  thickness: number,
  color: Rgb,
  alpha = 255,
) {
  const steps = Math.max(1, Math.ceil(Math.hypot(x2 - x1, y2 - y1)));
  for (let step = 0; step <= steps; step += 1) {
    const t = step / steps;
    drawCircle(pixels, width, height, x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, thickness, color, alpha);
  }
}

function drawActivityIcon(asset: EpochActivityAssetRecord) {
  const width = EPOCH_ACTIVITY_ASSET_WIDTH;
  const height = EPOCH_ACTIVITY_ASSET_HEIGHT;
  const pixels = Buffer.alloc(width * height * 4);
  const colors = asset.palette.map(hexToRgb);
  const base = colors[0];
  const mid = colors[1];
  const light = colors[2];
  const trim = colors[3] || light;
  const accent = hexToRgb(asset.accentColor);
  const seed = hashSeed(asset.activityKey);

  for (let y = 0; y < height; y += 1) {
    const v = y / Math.max(1, height - 1);
    for (let x = 0; x < width; x += 1) {
      const u = x / Math.max(1, width - 1);
      const radial = Math.max(0, 1 - Math.hypot(u - 0.5, v - 0.48) * 1.46);
      const diagonal = (Math.sin((u * 5.4 - v * 3.6 + seed * 8) * Math.PI) + 1) / 2;
      let color = mix(base, mid, radial * 0.58 + diagonal * 0.08);
      color = mix(color, accent, Math.max(0, radial - 0.46) * 0.48);
      color = mix(color, base, Math.max(0, Math.hypot(u - 0.5, v - 0.5) - 0.56) * 1.55);
      setPixel(pixels, width, x, y, color);
    }
  }

  drawCircle(pixels, width, height, width * 0.5, height * 0.5, width * 0.32, mix(mid, base, 0.25), 218);
  drawCircle(pixels, width, height, width * 0.5, height * 0.5, width * 0.25, mix(accent, light, 0.2), 232);
  drawDiamond(pixels, width, height, width * 0.5, height * 0.5, width * 0.22, height * 0.22, mix(light, trim, 0.2), 226);

  if (asset.sigil === "standard") {
    drawRect(pixels, width, height, width * 0.36, height * 0.27, width * 0.64, height * 0.64, trim, 242);
    drawLine(pixels, width, height, width * 0.34, height * 0.36, width * 0.66, height * 0.36, width * 0.014, base, 220);
  } else if (asset.sigil === "node") {
    drawCircle(pixels, width, height, width * 0.5, height * 0.5, width * 0.09, trim, 250);
    for (let index = 0; index < 6; index += 1) {
      const angle = (index / 6) * Math.PI * 2;
      const x = width * (0.5 + Math.cos(angle) * 0.21);
      const y = height * (0.5 + Math.sin(angle) * 0.21);
      drawLine(pixels, width, height, width * 0.5, height * 0.5, x, y, width * 0.014, light, 240);
      drawCircle(pixels, width, height, x, y, width * 0.037, accent, 245);
    }
  } else if (asset.sigil === "rift") {
    drawLine(pixels, width, height, width * 0.48, height * 0.22, width * 0.4, height * 0.47, width * 0.019, trim, 252);
    drawLine(pixels, width, height, width * 0.4, height * 0.47, width * 0.58, height * 0.54, width * 0.019, trim, 252);
    drawLine(pixels, width, height, width * 0.58, height * 0.54, width * 0.46, height * 0.78, width * 0.019, trim, 252);
  } else if (asset.sigil === "seal") {
    drawCircle(pixels, width, height, width * 0.5, height * 0.5, width * 0.14, trim, 248);
    drawCircle(pixels, width, height, width * 0.5, height * 0.5, width * 0.08, mix(accent, mid, 0.2), 255);
    drawLine(pixels, width, height, width * 0.39, height * 0.67, width * 0.61, height * 0.67, width * 0.018, light, 242);
  } else if (asset.sigil === "thread") {
    drawCircle(pixels, width, height, width * 0.34, height * 0.42, width * 0.055, trim, 245);
    drawCircle(pixels, width, height, width * 0.66, height * 0.42, width * 0.055, trim, 245);
    drawCircle(pixels, width, height, width * 0.5, height * 0.65, width * 0.055, trim, 245);
    drawLine(pixels, width, height, width * 0.34, height * 0.42, width * 0.66, height * 0.42, width * 0.013, light, 238);
    drawLine(pixels, width, height, width * 0.34, height * 0.42, width * 0.5, height * 0.65, width * 0.013, light, 238);
    drawLine(pixels, width, height, width * 0.66, height * 0.42, width * 0.5, height * 0.65, width * 0.013, light, 238);
  } else if (asset.sigil === "blade") {
    drawLine(pixels, width, height, width * 0.34, height * 0.7, width * 0.66, height * 0.3, width * 0.026, trim, 252);
    drawLine(pixels, width, height, width * 0.36, height * 0.3, width * 0.64, height * 0.7, width * 0.02, accent, 240);
  } else if (asset.sigil === "card") {
    drawRect(pixels, width, height, width * 0.36, height * 0.26, width * 0.64, height * 0.74, mix(light, trim, 0.18), 248);
    drawRect(pixels, width, height, width * 0.4, height * 0.34, width * 0.6, height * 0.39, base, 210);
    drawRect(pixels, width, height, width * 0.4, height * 0.48, width * 0.6, height * 0.53, base, 210);
  } else if (asset.sigil === "clock") {
    drawCircle(pixels, width, height, width * 0.5, height * 0.5, width * 0.15, trim, 244);
    drawCircle(pixels, width, height, width * 0.5, height * 0.5, width * 0.105, base, 230);
    drawLine(pixels, width, height, width * 0.5, height * 0.5, width * 0.5, height * 0.4, width * 0.012, light, 255);
    drawLine(pixels, width, height, width * 0.5, height * 0.5, width * 0.59, height * 0.55, width * 0.012, light, 255);
  } else {
    for (let index = 0; index < 3; index += 1) {
      const radius = width * (0.06 + index * 0.045);
      drawCircle(pixels, width, height, width * 0.5, height * 0.5, radius, index % 2 ? accent : trim, 155);
    }
    drawLine(pixels, width, height, width * 0.5, height * 0.5, width * 0.64, height * 0.48, width * 0.018, light, 252);
  }

  return encodePngRgba(width, height, pixels);
}

async function writeStaticInstallManifest(manifestPath: string, activities: readonly EpochActivityAssetManifestEntry[]) {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as Record<string, unknown>;
  const existingAssets = typeof manifest.assets === "object" && manifest.assets !== null
    ? manifest.assets as Record<string, unknown>
    : {};
  const next = {
    ...manifest,
    assets: {
      ...existingAssets,
      activities,
    },
  };
  await writeFile(manifestPath, `${JSON.stringify(next, null, 2)}\n`);
}

async function main() {
  const activities: EpochActivityAssetManifestEntry[] = [];
  for (const asset of EPOCH_ACTIVITY_ASSETS) {
    const content = drawActivityIcon(asset);
    const outputPath = join(packageRoot, asset.path);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, content);
    activities.push({
      activityKey: asset.activityKey,
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

  await writeStaticInstallManifest(join(packageRoot, "install-manifest.json"), activities);
  await writeStaticInstallManifest(join(packageRoot, "obsidian-epoch/assets/install-manifest.json"), activities);
  if (process.argv.includes("--json")) {
    process.stdout.write(`${JSON.stringify({ activities }, null, 2)}\n`);
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
