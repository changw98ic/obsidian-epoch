import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  EPOCH_FACTION_ASSETS,
  EPOCH_FACTION_ASSET_HEIGHT,
  EPOCH_FACTION_ASSET_WIDTH,
  EPOCH_SEASON_BANNER_ASSETS,
  EPOCH_SEASON_BANNER_ASSET_HEIGHT,
  EPOCH_SEASON_BANNER_ASSET_WIDTH,
  type EpochFactionAssetManifestEntry,
  type EpochFactionAssetRecord,
  type EpochSeasonBannerAssetManifestEntry,
  type EpochSeasonBannerAssetRecord,
} from "./lib/factionAssets.ts";
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

function drawTriangle(
  pixels: Buffer,
  width: number,
  height: number,
  centerX: number,
  topY: number,
  radiusX: number,
  radiusY: number,
  color: Rgb,
  alpha = 255,
) {
  for (let y = Math.max(0, Math.floor(topY)); y <= Math.min(height - 1, Math.ceil(topY + radiusY)); y += 1) {
    const progress = (y - topY) / Math.max(1, radiusY);
    const halfWidth = radiusX * progress;
    for (let x = Math.max(0, Math.floor(centerX - halfWidth)); x <= Math.min(width - 1, Math.ceil(centerX + halfWidth)); x += 1) {
      setPixel(pixels, width, x, y, color, alpha);
    }
  }
}

function drawBackground(
  pixels: Buffer,
  width: number,
  height: number,
  palette: readonly string[],
  accentColor: string,
  seedText: string,
) {
  const colors = palette.map(hexToRgb);
  const base = colors[0];
  const mid = colors[1] || base;
  const light = colors[2] || mid;
  const trim = colors[3] || light;
  const accent = hexToRgb(accentColor);
  const seed = hashSeed(seedText);
  for (let y = 0; y < height; y += 1) {
    const v = y / Math.max(1, height - 1);
    for (let x = 0; x < width; x += 1) {
      const u = x / Math.max(1, width - 1);
      const radial = Math.max(0, 1 - Math.hypot(u - 0.5, v - 0.48) * 1.45);
      const wave = (Math.sin((u * 7 + v * 3 + seed * 9) * Math.PI) + 1) / 2;
      const tide = (Math.sin((u - v + seed) * Math.PI * 6) + 1) / 2;
      let color = mix(base, mid, radial * 0.62 + wave * 0.08);
      color = mix(color, accent, Math.max(0, radial - 0.5) * 0.42);
      color = mix(color, trim, tide * 0.06);
      color = mix(color, base, Math.max(0, Math.hypot(u - 0.5, v - 0.5) - 0.58) * 1.45);
      setPixel(pixels, width, x, y, color);
    }
  }
}

function drawFactionEmblem(asset: EpochFactionAssetRecord) {
  const width = EPOCH_FACTION_ASSET_WIDTH;
  const height = EPOCH_FACTION_ASSET_HEIGHT;
  const pixels = Buffer.alloc(width * height * 4);
  const colors = asset.palette.map(hexToRgb);
  const base = colors[0];
  const mid = colors[1];
  const light = colors[2];
  const trim = colors[3] || light;
  const accent = hexToRgb(asset.accentColor);

  drawBackground(pixels, width, height, asset.palette, asset.accentColor, asset.factionId);
  drawCircle(pixels, width, height, width * 0.5, height * 0.5, width * 0.37, mix(base, mid, 0.4), 230);
  drawCircle(pixels, width, height, width * 0.5, height * 0.5, width * 0.31, mix(mid, accent, 0.28), 225);
  drawCircle(pixels, width, height, width * 0.5, height * 0.5, width * 0.24, mix(base, light, 0.28), 245);

  if (asset.sigil === "watch") {
    drawDiamond(pixels, width, height, width * 0.5, height * 0.48, width * 0.18, height * 0.24, light, 245);
    drawCircle(pixels, width, height, width * 0.5, height * 0.48, width * 0.09, accent, 250);
    drawCircle(pixels, width, height, width * 0.5, height * 0.48, width * 0.035, trim, 255);
    drawRect(pixels, width, height, width * 0.47, height * 0.64, width * 0.53, height * 0.8, trim, 230);
  } else if (asset.sigil === "archive") {
    drawRect(pixels, width, height, width * 0.35, height * 0.28, width * 0.65, height * 0.68, mix(base, trim, 0.38), 235);
    drawRect(pixels, width, height, width * 0.39, height * 0.34, width * 0.61, height * 0.39, light, 240);
    drawRect(pixels, width, height, width * 0.39, height * 0.45, width * 0.61, height * 0.5, accent, 240);
    drawCircle(pixels, width, height, width * 0.5, height * 0.7, width * 0.055, trim, 255);
  } else {
    drawTriangle(pixels, width, height, width * 0.5, height * 0.23, width * 0.22, height * 0.36, light, 238);
    drawRect(pixels, width, height, width * 0.42, height * 0.48, width * 0.58, height * 0.73, mix(trim, accent, 0.22), 245);
    drawRect(pixels, width, height, width * 0.32, height * 0.72, width * 0.68, height * 0.8, trim, 245);
    drawCircle(pixels, width, height, width * 0.5, height * 0.33, width * 0.045, accent, 255);
  }

  for (let index = 0; index < 12; index += 1) {
    const angle = (index / 12) * Math.PI * 2;
    const x = width * (0.5 + Math.cos(angle) * 0.35);
    const y = height * (0.5 + Math.sin(angle) * 0.35);
    drawCircle(pixels, width, height, x, y, width * 0.012, trim, 210);
  }

  return encodePngRgba(width, height, pixels);
}

function drawSeasonBanner(asset: EpochSeasonBannerAssetRecord) {
  const width = EPOCH_SEASON_BANNER_ASSET_WIDTH;
  const height = EPOCH_SEASON_BANNER_ASSET_HEIGHT;
  const pixels = Buffer.alloc(width * height * 4);
  const colors = asset.palette.map(hexToRgb);
  const base = colors[0];
  const mid = colors[1];
  const teal = colors[2];
  const gold = colors[3];
  const accent = hexToRgb(asset.accentColor);

  drawBackground(pixels, width, height, asset.palette, asset.accentColor, asset.seasonKey);
  drawRect(pixels, width, height, 0, height * 0.64, width, height, mix(base, mid, 0.35), 238);
  for (let index = 0; index < 9; index += 1) {
    const y = height * (0.66 + index * 0.035);
    drawRect(pixels, width, height, 0, y, width, y + 3, mix(teal, accent, index / 12), 130);
  }
  drawCircle(pixels, width, height, width * 0.18, height * 0.38, height * 0.22, mix(mid, teal, 0.38), 218);
  drawCircle(pixels, width, height, width * 0.5, height * 0.34, height * 0.24, mix(mid, gold, 0.24), 210);
  drawCircle(pixels, width, height, width * 0.82, height * 0.38, height * 0.22, mix(mid, accent, 0.32), 218);
  drawDiamond(pixels, width, height, width * 0.18, height * 0.38, width * 0.07, height * 0.17, accent, 238);
  drawRect(pixels, width, height, width * 0.43, height * 0.2, width * 0.57, height * 0.57, mix(gold, accent, 0.18), 235);
  drawTriangle(pixels, width, height, width * 0.82, height * 0.19, width * 0.1, height * 0.27, mix(teal, gold, 0.32), 235);
  drawRect(pixels, width, height, width * 0.05, height * 0.08, width * 0.95, height * 0.1, gold, 190);
  drawRect(pixels, width, height, width * 0.05, height * 0.9, width * 0.95, height * 0.92, accent, 160);

  return encodePngRgba(width, height, pixels);
}

async function writeStaticInstallManifest(
  manifestPath: string,
  factions: readonly EpochFactionAssetManifestEntry[],
  seasonBanners: readonly EpochSeasonBannerAssetManifestEntry[],
) {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as Record<string, unknown>;
  const existingAssets = typeof manifest.assets === "object" && manifest.assets !== null
    ? manifest.assets as Record<string, unknown>
    : {};
  const next = {
    ...manifest,
    assets: {
      ...existingAssets,
      factions,
      seasonBanners,
    },
  };
  await writeFile(manifestPath, `${JSON.stringify(next, null, 2)}\n`);
}

async function main() {
  const factions: EpochFactionAssetManifestEntry[] = [];
  const seasonBanners: EpochSeasonBannerAssetManifestEntry[] = [];

  for (const asset of EPOCH_FACTION_ASSETS) {
    const content = drawFactionEmblem(asset);
    const outputPath = join(packageRoot, asset.path);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, content);
    factions.push({
      factionId: asset.factionId,
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

  for (const asset of EPOCH_SEASON_BANNER_ASSETS) {
    const content = drawSeasonBanner(asset);
    const outputPath = join(packageRoot, asset.path);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, content);
    seasonBanners.push({
      seasonKey: asset.seasonKey,
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

  await writeStaticInstallManifest(join(packageRoot, "install-manifest.json"), factions, seasonBanners);
  await writeStaticInstallManifest(join(packageRoot, "obsidian-epoch/assets/install-manifest.json"), factions, seasonBanners);
  if (process.argv.includes("--json")) {
    process.stdout.write(`${JSON.stringify({ factions, seasonBanners }, null, 2)}\n`);
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
