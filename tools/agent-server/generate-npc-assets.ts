import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  EPOCH_NPC_ASSETS,
  EPOCH_NPC_ASSET_HEIGHT,
  EPOCH_NPC_ASSET_WIDTH,
  type EpochNpcAssetManifestEntry,
  type EpochNpcAssetRecord,
} from "./lib/npcAssets.ts";
import { encodePngRgba, hashSeed, hexToRgb, mix, setPixel, type Rgb } from "./lib/pngDrawing.ts";

const serverRoot = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(serverRoot, "package");

function ellipseMask(x: number, y: number, centerX: number, centerY: number, radiusX: number, radiusY: number) {
  return ((x - centerX) / radiusX) ** 2 + ((y - centerY) / radiusY) ** 2 <= 1;
}

function drawEllipse(
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
      if (ellipseMask(x, y, centerX, centerY, radiusX, radiusY)) setPixel(pixels, width, x, y, color, alpha);
    }
  }
}

function drawNpcPortrait(asset: EpochNpcAssetRecord) {
  const width = EPOCH_NPC_ASSET_WIDTH;
  const height = EPOCH_NPC_ASSET_HEIGHT;
  const pixels = Buffer.alloc(width * height * 4);
  const colors = asset.palette.map(hexToRgb);
  const base = colors[0];
  const mid = colors[1];
  const light = colors[2];
  const accent = hexToRgb(asset.accentColor);
  const gold = colors[3] || accent;
  const seed = hashSeed(asset.archetypeKey);

  for (let y = 0; y < height; y += 1) {
    const v = y / Math.max(1, height - 1);
    for (let x = 0; x < width; x += 1) {
      const u = x / Math.max(1, width - 1);
      const radial = Math.max(0, 1 - Math.hypot(u - 0.5, v - 0.42) * 1.8);
      const diagonal = (Math.sin((u * 4.5 + v * 3.5 + seed * 5) * Math.PI) + 1) / 2;
      const halo = Math.max(0, 1 - Math.hypot(u - 0.5, v - 0.32) * 3.3);
      let color = mix(base, mid, radial * 0.5 + diagonal * 0.12);
      color = mix(color, light, halo * 0.38);
      color = mix(color, accent, Math.max(0, radial - 0.62) * 0.42);
      color = mix(color, base, Math.max(0, Math.hypot(u - 0.5, v - 0.5) - 0.48) * 1.4);
      setPixel(pixels, width, x, y, color);
    }
  }

  const cloak = mix(mid, base, 0.36);
  const face = mix(light, gold, 0.18);
  const shadow = mix(base, mid, 0.2);
  const trim = mix(accent, gold, 0.34);
  drawEllipse(pixels, width, height, width * 0.5, height * 0.76, width * 0.29, height * 0.2, cloak);
  drawEllipse(pixels, width, height, width * (0.5 + (seed - 0.5) * 0.04), height * 0.43, width * 0.16, height * 0.19, face);
  drawEllipse(pixels, width, height, width * 0.5, height * 0.37, width * 0.2, height * 0.12, shadow);
  drawEllipse(pixels, width, height, width * 0.5, height * 0.44, width * 0.18, height * 0.2, mix(face, light, 0.22), 236);

  const tokenCount = 3 + Math.floor(seed * 3);
  for (let index = 0; index < tokenCount; index += 1) {
    const angle = (index / tokenCount) * Math.PI * 2 + seed;
    const x = width * (0.5 + Math.cos(angle) * 0.24);
    const y = height * (0.48 + Math.sin(angle) * 0.28);
    drawEllipse(pixels, width, height, x, y, width * 0.025, height * 0.025, trim);
  }

  for (let y = Math.floor(height * 0.67); y < Math.floor(height * 0.72); y += 1) {
    for (let x = Math.floor(width * 0.3); x < Math.floor(width * 0.7); x += 1) {
      const stripe = (Math.sin((x / width) * Math.PI * 12 + seed * 9) + 1) / 2;
      if (stripe > 0.45) setPixel(pixels, width, x, y, trim, 225);
    }
  }

  return encodePngRgba(width, height, pixels);
}

async function writeStaticInstallManifest(manifestPath: string, npcs: readonly EpochNpcAssetManifestEntry[]) {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as Record<string, unknown>;
  const existingAssets = typeof manifest.assets === "object" && manifest.assets !== null
    ? manifest.assets as Record<string, unknown>
    : {};
  const next = {
    ...manifest,
    assets: {
      ...existingAssets,
      npcs,
    },
  };
  await writeFile(manifestPath, `${JSON.stringify(next, null, 2)}\n`);
}

async function main() {
  const npcs: EpochNpcAssetManifestEntry[] = [];
  for (const asset of EPOCH_NPC_ASSETS) {
    const content = drawNpcPortrait(asset);
    const outputPath = join(packageRoot, asset.path);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, content);
    npcs.push({
      archetypeKey: asset.archetypeKey,
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
  await writeStaticInstallManifest(join(packageRoot, "install-manifest.json"), npcs);
  await writeStaticInstallManifest(join(packageRoot, "obsidian-epoch/assets/install-manifest.json"), npcs);
  if (process.argv.includes("--json")) {
    process.stdout.write(`${JSON.stringify({ npcs }, null, 2)}\n`);
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
