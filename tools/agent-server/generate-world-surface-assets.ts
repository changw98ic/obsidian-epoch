import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  EPOCH_WORLD_SURFACE_ASSETS,
  EPOCH_WORLD_SURFACE_ASSET_HEIGHT,
  EPOCH_WORLD_SURFACE_ASSET_WIDTH,
  type EpochWorldSurfaceAssetManifestEntry,
  type EpochWorldSurfaceAssetRecord,
} from "./lib/worldSurfaceAssets.ts";
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

function drawArc(
  pixels: Buffer,
  width: number,
  height: number,
  centerX: number,
  centerY: number,
  radius: number,
  startAngle: number,
  endAngle: number,
  thickness: number,
  color: Rgb,
  alpha = 255,
) {
  const steps = Math.max(12, Math.ceil(radius * Math.abs(endAngle - startAngle)));
  let previousX = centerX + Math.cos(startAngle) * radius;
  let previousY = centerY + Math.sin(startAngle) * radius;
  for (let index = 1; index <= steps; index += 1) {
    const angle = startAngle + (endAngle - startAngle) * (index / steps);
    const nextX = centerX + Math.cos(angle) * radius;
    const nextY = centerY + Math.sin(angle) * radius;
    drawLine(pixels, width, height, previousX, previousY, nextX, nextY, thickness, color, alpha);
    previousX = nextX;
    previousY = nextY;
  }
}

function drawSurfaceSigil(asset: EpochWorldSurfaceAssetRecord, pixels: Buffer, width: number, height: number, base: Rgb, accent: Rgb, light: Rgb, trim: Rgb) {
  if (asset.sigil === "broadcast") {
    drawCircle(pixels, width, height, width * 0.38, height * 0.5, width * 0.048, light, 255);
    drawArc(pixels, width, height, width * 0.38, height * 0.5, width * 0.13, -0.82, 0.82, width * 0.014, trim, 245);
    drawArc(pixels, width, height, width * 0.38, height * 0.5, width * 0.22, -0.78, 0.78, width * 0.013, trim, 235);
    drawLine(pixels, width, height, width * 0.38, height * 0.5, width * 0.65, height * 0.36, width * 0.012, accent, 230);
    drawLine(pixels, width, height, width * 0.38, height * 0.5, width * 0.65, height * 0.64, width * 0.012, accent, 230);
  } else if (asset.sigil === "ledger") {
    drawRect(pixels, width, height, width * 0.34, height * 0.28, width * 0.66, height * 0.72, trim, 245);
    drawRect(pixels, width, height, width * 0.39, height * 0.35, width * 0.61, height * 0.4, base, 220);
    drawRect(pixels, width, height, width * 0.39, height * 0.47, width * 0.61, height * 0.52, base, 220);
    drawRect(pixels, width, height, width * 0.39, height * 0.59, width * 0.55, height * 0.64, base, 220);
  } else if (asset.sigil === "market") {
    drawRect(pixels, width, height, width * 0.3, height * 0.43, width * 0.7, height * 0.66, trim, 245);
    drawLine(pixels, width, height, width * 0.34, height * 0.43, width * 0.42, height * 0.31, width * 0.012, light, 245);
    drawLine(pixels, width, height, width * 0.66, height * 0.43, width * 0.58, height * 0.31, width * 0.012, light, 245);
    drawCircle(pixels, width, height, width * 0.41, height * 0.72, width * 0.04, accent, 250);
    drawCircle(pixels, width, height, width * 0.59, height * 0.72, width * 0.04, accent, 250);
  } else if (asset.sigil === "watch") {
    drawDiamond(pixels, width, height, width * 0.5, height * 0.5, width * 0.24, height * 0.15, trim, 246);
    drawCircle(pixels, width, height, width * 0.5, height * 0.5, width * 0.075, base, 238);
    drawCircle(pixels, width, height, width * 0.5, height * 0.5, width * 0.036, accent, 255);
  } else if (asset.sigil === "page") {
    drawRect(pixels, width, height, width * 0.36, height * 0.25, width * 0.63, height * 0.74, trim, 245);
    drawDiamond(pixels, width, height, width * 0.63, height * 0.25, width * 0.07, height * 0.07, accent, 246);
    drawRect(pixels, width, height, width * 0.41, height * 0.39, width * 0.58, height * 0.43, base, 230);
    drawRect(pixels, width, height, width * 0.41, height * 0.51, width * 0.58, height * 0.55, base, 230);
  } else if (asset.sigil === "archive") {
    drawRect(pixels, width, height, width * 0.3, height * 0.38, width * 0.7, height * 0.67, trim, 245);
    drawRect(pixels, width, height, width * 0.35, height * 0.31, width * 0.52, height * 0.38, light, 245);
    drawLine(pixels, width, height, width * 0.36, height * 0.52, width * 0.64, height * 0.52, width * 0.012, base, 230);
  } else if (asset.sigil === "portal") {
    drawArc(pixels, width, height, width * 0.5, height * 0.56, width * 0.19, Math.PI, Math.PI * 2, width * 0.026, trim, 250);
    drawLine(pixels, width, height, width * 0.31, height * 0.56, width * 0.31, height * 0.72, width * 0.026, trim, 250);
    drawLine(pixels, width, height, width * 0.69, height * 0.56, width * 0.69, height * 0.72, width * 0.026, trim, 250);
    drawCircle(pixels, width, height, width * 0.5, height * 0.56, width * 0.07, accent, 220);
  } else {
    drawLine(pixels, width, height, width * 0.31, height * 0.62, width * 0.45, height * 0.39, width * 0.018, trim, 248);
    drawLine(pixels, width, height, width * 0.55, height * 0.39, width * 0.69, height * 0.62, width * 0.018, trim, 248);
    drawCircle(pixels, width, height, width * 0.31, height * 0.62, width * 0.055, accent, 252);
    drawCircle(pixels, width, height, width * 0.5, height * 0.34, width * 0.055, light, 252);
    drawCircle(pixels, width, height, width * 0.69, height * 0.62, width * 0.055, accent, 252);
  }
}

function drawWorldSurfaceIcon(asset: EpochWorldSurfaceAssetRecord) {
  const width = EPOCH_WORLD_SURFACE_ASSET_WIDTH;
  const height = EPOCH_WORLD_SURFACE_ASSET_HEIGHT;
  const pixels = Buffer.alloc(width * height * 4);
  const colors = asset.palette.map(hexToRgb);
  const base = colors[0];
  const mid = colors[1];
  const light = colors[2];
  const trim = colors[3] || light;
  const accent = hexToRgb(asset.accentColor);
  const seed = hashSeed(asset.surfaceKey);

  for (let y = 0; y < height; y += 1) {
    const v = y / Math.max(1, height - 1);
    for (let x = 0; x < width; x += 1) {
      const u = x / Math.max(1, width - 1);
      const radial = Math.max(0, 1 - Math.hypot(u - 0.5, v - 0.48) * 1.42);
      const sweep = (Math.sin((u * 5.6 - v * 3.2 + seed * 5.4) * Math.PI) + 1) / 2;
      let color = mix(base, mid, radial * 0.55 + sweep * 0.08);
      color = mix(color, accent, Math.max(0, radial - 0.4) * 0.34);
      color = mix(color, base, Math.max(0, Math.hypot(u - 0.5, v - 0.5) - 0.58) * 1.5);
      setPixel(pixels, width, x, y, color);
    }
  }

  drawCircle(pixels, width, height, width * 0.5, height * 0.5, width * 0.32, mix(mid, base, 0.28), 218);
  drawCircle(pixels, width, height, width * 0.5, height * 0.5, width * 0.24, mix(accent, light, 0.22), 228);
  drawSurfaceSigil(asset, pixels, width, height, base, accent, light, trim);
  drawCircle(pixels, width, height, width * 0.78, height * 0.22, width * 0.025 + seed * width * 0.018, light, 180);

  return encodePngRgba(width, height, pixels);
}

async function writeStaticInstallManifest(manifestPath: string, worldSurfaces: readonly EpochWorldSurfaceAssetManifestEntry[]) {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as Record<string, unknown>;
  const existingAssets = typeof manifest.assets === "object" && manifest.assets !== null
    ? manifest.assets as Record<string, unknown>
    : {};
  const next = {
    ...manifest,
    assets: {
      ...existingAssets,
      worldSurfaces,
    },
  };
  await writeFile(manifestPath, `${JSON.stringify(next, null, 2)}\n`);
}

async function main() {
  const worldSurfaces: EpochWorldSurfaceAssetManifestEntry[] = [];
  for (const asset of EPOCH_WORLD_SURFACE_ASSETS) {
    const content = drawWorldSurfaceIcon(asset);
    const outputPath = join(packageRoot, asset.path);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, content);
    worldSurfaces.push({
      surfaceKey: asset.surfaceKey,
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

  await writeStaticInstallManifest(join(packageRoot, "install-manifest.json"), worldSurfaces);
  await writeStaticInstallManifest(join(packageRoot, "obsidian-epoch/assets/install-manifest.json"), worldSurfaces);
  if (process.argv.includes("--json")) {
    process.stdout.write(`${JSON.stringify({ worldSurfaces }, null, 2)}\n`);
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
