import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  EPOCH_RELATIONSHIP_ASSETS,
  EPOCH_RELATIONSHIP_ASSET_HEIGHT,
  EPOCH_RELATIONSHIP_ASSET_WIDTH,
  type EpochRelationshipAssetManifestEntry,
  type EpochRelationshipAssetRecord,
} from "./lib/relationshipAssets.ts";
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

function drawLine(pixels: Buffer, width: number, height: number, x1: number, y1: number, x2: number, y2: number, thickness: number, color: Rgb, alpha = 255) {
  const steps = Math.max(1, Math.ceil(Math.hypot(x2 - x1, y2 - y1)));
  for (let step = 0; step <= steps; step += 1) {
    const t = step / steps;
    drawCircle(pixels, width, height, x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, thickness, color, alpha);
  }
}

function drawRelationshipIcon(asset: EpochRelationshipAssetRecord) {
  const width = EPOCH_RELATIONSHIP_ASSET_WIDTH;
  const height = EPOCH_RELATIONSHIP_ASSET_HEIGHT;
  const pixels = Buffer.alloc(width * height * 4);
  const colors = asset.palette.map(hexToRgb);
  const base = colors[0];
  const mid = colors[1];
  const light = colors[2];
  const trim = colors[3] || light;
  const accent = hexToRgb(asset.accentColor);
  const seed = hashSeed(asset.relationshipKey);

  for (let y = 0; y < height; y += 1) {
    const v = y / Math.max(1, height - 1);
    for (let x = 0; x < width; x += 1) {
      const u = x / Math.max(1, width - 1);
      const radial = Math.max(0, 1 - Math.hypot(u - 0.5, v - 0.5) * 1.48);
      const wave = (Math.sin((u * 4.8 + v * 3.8 + seed * 6) * Math.PI) + 1) / 2;
      let color = mix(base, mid, radial * 0.56 + wave * 0.07);
      color = mix(color, accent, Math.max(0, radial - 0.44) * 0.45);
      color = mix(color, base, Math.max(0, Math.hypot(u - 0.5, v - 0.5) - 0.57) * 1.5);
      setPixel(pixels, width, x, y, color);
    }
  }

  drawCircle(pixels, width, height, width * 0.5, height * 0.5, width * 0.32, mix(mid, base, 0.24), 220);
  drawCircle(pixels, width, height, width * 0.5, height * 0.5, width * 0.24, mix(accent, light, 0.2), 232);

  if (asset.sigil === "bond") {
    drawCircle(pixels, width, height, width * 0.42, height * 0.44, width * 0.09, trim, 245);
    drawCircle(pixels, width, height, width * 0.58, height * 0.44, width * 0.09, trim, 245);
    drawLine(pixels, width, height, width * 0.37, height * 0.5, width * 0.5, height * 0.68, width * 0.02, trim, 245);
    drawLine(pixels, width, height, width * 0.63, height * 0.5, width * 0.5, height * 0.68, width * 0.02, trim, 245);
  } else if (asset.sigil === "branch") {
    drawLine(pixels, width, height, width * 0.5, height * 0.28, width * 0.5, height * 0.72, width * 0.018, trim, 246);
    drawLine(pixels, width, height, width * 0.5, height * 0.42, width * 0.34, height * 0.56, width * 0.015, light, 240);
    drawLine(pixels, width, height, width * 0.5, height * 0.42, width * 0.66, height * 0.56, width * 0.015, light, 240);
    drawCircle(pixels, width, height, width * 0.34, height * 0.56, width * 0.04, accent, 250);
    drawCircle(pixels, width, height, width * 0.66, height * 0.56, width * 0.04, accent, 250);
  } else if (asset.sigil === "spark") {
    for (let index = 0; index < 6; index += 1) {
      const angle = (index / 6) * Math.PI * 2;
      drawLine(pixels, width, height, width * 0.5, height * 0.5, width * (0.5 + Math.cos(angle) * 0.2), height * (0.5 + Math.sin(angle) * 0.2), width * 0.014, trim, 246);
    }
    drawCircle(pixels, width, height, width * 0.5, height * 0.5, width * 0.065, light, 252);
  } else if (asset.sigil === "thorn") {
    drawLine(pixels, width, height, width * 0.34, height * 0.34, width * 0.66, height * 0.66, width * 0.023, trim, 248);
    drawLine(pixels, width, height, width * 0.66, height * 0.34, width * 0.34, height * 0.66, width * 0.023, trim, 248);
  } else if (asset.sigil === "crown") {
    drawRect(pixels, width, height, width * 0.34, height * 0.56, width * 0.66, height * 0.67, trim, 246);
    drawDiamond(pixels, width, height, width * 0.38, height * 0.48, width * 0.06, height * 0.16, light, 246);
    drawDiamond(pixels, width, height, width * 0.5, height * 0.43, width * 0.07, height * 0.2, light, 246);
    drawDiamond(pixels, width, height, width * 0.62, height * 0.48, width * 0.06, height * 0.16, light, 246);
  } else if (asset.sigil === "steps") {
    drawRect(pixels, width, height, width * 0.33, height * 0.62, width * 0.47, height * 0.7, trim, 246);
    drawRect(pixels, width, height, width * 0.45, height * 0.5, width * 0.59, height * 0.58, trim, 246);
    drawRect(pixels, width, height, width * 0.57, height * 0.38, width * 0.71, height * 0.46, trim, 246);
  } else if (asset.sigil === "shield") {
    drawDiamond(pixels, width, height, width * 0.5, height * 0.5, width * 0.17, height * 0.25, trim, 248);
    drawLine(pixels, width, height, width * 0.5, height * 0.28, width * 0.5, height * 0.72, width * 0.013, base, 230);
  } else if (asset.sigil === "rift") {
    drawLine(pixels, width, height, width * 0.39, height * 0.28, width * 0.58, height * 0.5, width * 0.02, trim, 252);
    drawLine(pixels, width, height, width * 0.58, height * 0.5, width * 0.42, height * 0.72, width * 0.02, trim, 252);
  } else if (asset.sigil === "star") {
    for (let index = 0; index < 5; index += 1) {
      const angle = -Math.PI / 2 + (index / 5) * Math.PI * 2;
      drawLine(pixels, width, height, width * 0.5, height * 0.5, width * (0.5 + Math.cos(angle) * 0.2), height * (0.5 + Math.sin(angle) * 0.2), width * 0.018, trim, 250);
    }
    drawCircle(pixels, width, height, width * 0.5, height * 0.5, width * 0.06, accent, 255);
  } else {
    drawRect(pixels, width, height, width * 0.34, height * 0.45, width * 0.66, height * 0.68, trim, 246);
    drawDiamond(pixels, width, height, width * 0.5, height * 0.38, width * 0.22, height * 0.12, light, 246);
    drawRect(pixels, width, height, width * 0.47, height * 0.56, width * 0.53, height * 0.68, base, 230);
  }

  return encodePngRgba(width, height, pixels);
}

async function writeStaticInstallManifest(manifestPath: string, relationships: readonly EpochRelationshipAssetManifestEntry[]) {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as Record<string, unknown>;
  const existingAssets = typeof manifest.assets === "object" && manifest.assets !== null
    ? manifest.assets as Record<string, unknown>
    : {};
  const next = {
    ...manifest,
    assets: {
      ...existingAssets,
      relationships,
    },
  };
  await writeFile(manifestPath, `${JSON.stringify(next, null, 2)}\n`);
}

async function main() {
  const relationships: EpochRelationshipAssetManifestEntry[] = [];
  for (const asset of EPOCH_RELATIONSHIP_ASSETS) {
    const content = drawRelationshipIcon(asset);
    const outputPath = join(packageRoot, asset.path);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, content);
    relationships.push({
      relationshipKey: asset.relationshipKey,
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

  await writeStaticInstallManifest(join(packageRoot, "install-manifest.json"), relationships);
  await writeStaticInstallManifest(join(packageRoot, "obsidian-epoch/assets/install-manifest.json"), relationships);
  if (process.argv.includes("--json")) {
    process.stdout.write(`${JSON.stringify({ relationships }, null, 2)}\n`);
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
