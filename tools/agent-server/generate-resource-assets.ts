import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  EPOCH_DOWNTIME_ASSETS,
  EPOCH_RESOURCE_ASSETS,
  EPOCH_RESOURCE_ASSET_HEIGHT,
  EPOCH_RESOURCE_ASSET_WIDTH,
  type EpochDowntimeAssetManifestEntry,
  type EpochDowntimeAssetRecord,
  type EpochResourceAssetManifestEntry,
  type EpochResourceAssetRecord,
} from "./lib/resourceAssets.ts";
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

function drawTriangle(
  pixels: Buffer,
  width: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
  color: Rgb,
  alpha = 255,
) {
  const minX = Math.max(0, Math.floor(Math.min(ax, bx, cx)));
  const maxX = Math.min(width - 1, Math.ceil(Math.max(ax, bx, cx)));
  const minY = Math.max(0, Math.floor(Math.min(ay, by, cy)));
  const maxY = Math.min(width - 1, Math.ceil(Math.max(ay, by, cy)));
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

function drawLine(
  pixels: Buffer,
  width: number,
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
    drawCircle(pixels, width, x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, thickness, color, alpha);
  }
}

function drawBaseIcon(asset: { readonly palette: readonly string[]; readonly accentColor: string; readonly title: string }) {
  const width = EPOCH_RESOURCE_ASSET_WIDTH;
  const height = EPOCH_RESOURCE_ASSET_HEIGHT;
  const pixels = Buffer.alloc(width * height * 4);
  const colors = asset.palette.map(hexToRgb);
  const base = colors[0];
  const mid = colors[1];
  const light = colors[2];
  const trim = colors[3] || light;
  const accent = hexToRgb(asset.accentColor);
  const seed = hashSeed(asset.title);

  for (let y = 0; y < height; y += 1) {
    const v = y / Math.max(1, height - 1);
    for (let x = 0; x < width; x += 1) {
      const u = x / Math.max(1, width - 1);
      const radial = Math.max(0, 1 - Math.hypot(u - 0.5, v - 0.47) * 1.5);
      const ripple = (Math.sin((u * 6 + v * 4 + seed * 5) * Math.PI) + 1) / 2;
      let color = mix(base, mid, radial * 0.62 + ripple * 0.08);
      color = mix(color, accent, Math.max(0, radial - 0.42) * 0.42);
      color = mix(color, base, Math.max(0, Math.hypot(u - 0.5, v - 0.52) - 0.54) * 1.7);
      setPixel(pixels, width, x, y, color);
    }
  }

  drawCircle(pixels, width, width * 0.5, height * 0.5, width * 0.32, mix(mid, base, 0.25), 220);
  drawCircle(pixels, width, width * 0.5, height * 0.5, width * 0.25, mix(accent, light, 0.22), 232);
  drawCircle(pixels, width, width * 0.5, height * 0.5, width * 0.18, mix(light, trim, 0.18), 232);

  return { pixels, width, height, accent, light, trim, mid, base };
}

function drawResourceGlyph(asset: EpochResourceAssetRecord) {
  const icon = drawBaseIcon(asset);
  const { pixels, width, height, accent, light, trim, mid, base } = icon;

  if (asset.sigil === "coin") {
    drawCircle(pixels, width, width * 0.5, height * 0.5, width * 0.16, trim, 250);
    drawCircle(pixels, width, width * 0.5, height * 0.5, width * 0.1, mix(accent, light, 0.25), 255);
  } else if (asset.sigil === "aether") {
    drawDiamond(pixels, width, width * 0.5, height * 0.48, width * 0.13, height * 0.28, light, 248);
    drawDiamond(pixels, width, width * 0.5, height * 0.48, width * 0.07, height * 0.18, accent, 255);
  } else if (asset.sigil === "stamina") {
    drawRect(pixels, width, width * 0.28, height * 0.48, width * 0.72, height * 0.56, trim, 245);
    drawCircle(pixels, width, width * 0.32, height * 0.52, width * 0.08, light, 240);
    drawCircle(pixels, width, width * 0.68, height * 0.52, width * 0.08, light, 240);
  } else if (asset.sigil === "focus") {
    drawCircle(pixels, width, width * 0.5, height * 0.5, width * 0.12, base, 245);
    drawCircle(pixels, width, width * 0.5, height * 0.5, width * 0.045, light, 255);
    drawLine(pixels, width, width * 0.3, height * 0.5, width * 0.7, height * 0.5, width * 0.012, trim, 240);
  } else {
    for (let index = 0; index < 5; index += 1) {
      const angle = -Math.PI / 2 + (index / 5) * Math.PI * 2;
      const outerX = width * (0.5 + Math.cos(angle) * 0.19);
      const outerY = height * (0.5 + Math.sin(angle) * 0.19);
      drawLine(pixels, width, width * 0.5, height * 0.5, outerX, outerY, width * 0.018, trim, 250);
    }
    drawCircle(pixels, width, width * 0.5, height * 0.5, width * 0.07, mix(accent, mid, 0.25), 255);
  }

  return encodePngRgba(width, height, pixels);
}

function drawDowntimeGlyph(asset: EpochDowntimeAssetRecord) {
  const icon = drawBaseIcon(asset);
  const { pixels, width, height, accent, light, trim, mid, base } = icon;

  if (asset.sigil === "circle") {
    drawCircle(pixels, width, width * 0.5, height * 0.5, width * 0.16, base, 235);
    drawCircle(pixels, width, width * 0.5, height * 0.5, width * 0.1, mix(accent, light, 0.2), 245);
  } else if (asset.sigil === "spire") {
    drawDiamond(pixels, width, width * 0.5, height * 0.45, width * 0.1, height * 0.31, light, 248);
    drawLine(pixels, width, width * 0.42, height * 0.68, width * 0.58, height * 0.68, width * 0.018, trim, 248);
  } else if (asset.sigil === "band") {
    drawLine(pixels, width, width * 0.3, height * 0.56, width * 0.7, height * 0.44, width * 0.035, trim, 245);
    drawLine(pixels, width, width * 0.3, height * 0.44, width * 0.7, height * 0.56, width * 0.035, trim, 245);
  } else if (asset.sigil === "cot") {
    drawRect(pixels, width, width * 0.28, height * 0.45, width * 0.72, height * 0.58, mix(light, trim, 0.25), 248);
    drawRect(pixels, width, width * 0.28, height * 0.58, width * 0.34, height * 0.72, mid, 245);
    drawRect(pixels, width, width * 0.66, height * 0.58, width * 0.72, height * 0.72, mid, 245);
  } else if (asset.sigil === "cup") {
    drawRect(pixels, width, width * 0.38, height * 0.42, width * 0.6, height * 0.62, trim, 242);
    drawCircle(pixels, width, width * 0.64, height * 0.52, width * 0.055, trim, 238);
    drawLine(pixels, width, width * 0.42, height * 0.68, width * 0.58, height * 0.68, width * 0.018, light, 245);
  } else if (asset.sigil === "road") {
    drawLine(pixels, width, width * 0.3, height * 0.68, width * 0.7, height * 0.35, width * 0.024, trim, 245);
    drawCircle(pixels, width, width * 0.34, height * 0.65, width * 0.045, accent, 255);
    drawCircle(pixels, width, width * 0.68, height * 0.37, width * 0.045, light, 255);
  } else if (asset.sigil === "stall") {
    drawRect(pixels, width, width * 0.3, height * 0.44, width * 0.7, height * 0.64, trim, 245);
    drawTriangle(pixels, width, width * 0.28, height * 0.44, width * 0.5, height * 0.29, width * 0.72, height * 0.44, light, 245);
    drawRect(pixels, width, width * 0.35, height * 0.64, width * 0.41, height * 0.74, mid, 245);
    drawRect(pixels, width, width * 0.59, height * 0.64, width * 0.65, height * 0.74, mid, 245);
  } else {
    drawCircle(pixels, width, width * 0.41, height * 0.48, width * 0.08, light, 245);
    drawCircle(pixels, width, width * 0.61, height * 0.48, width * 0.08, trim, 245);
    drawLine(pixels, width, width * 0.44, height * 0.62, width * 0.58, height * 0.62, width * 0.018, accent, 245);
    drawLine(pixels, width, width * 0.5, height * 0.36, width * 0.5, height * 0.28, width * 0.012, light, 230);
  }

  return encodePngRgba(width, height, pixels);
}

async function writeStaticInstallManifest(
  manifestPath: string,
  resources: readonly EpochResourceAssetManifestEntry[],
  downtimeModes: readonly EpochDowntimeAssetManifestEntry[],
) {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as Record<string, unknown>;
  const existingAssets = typeof manifest.assets === "object" && manifest.assets !== null
    ? manifest.assets as Record<string, unknown>
    : {};
  const next = {
    ...manifest,
    assets: {
      ...existingAssets,
      resources,
      downtimeModes,
    },
  };
  await writeFile(manifestPath, `${JSON.stringify(next, null, 2)}\n`);
}

async function main() {
  const resources: EpochResourceAssetManifestEntry[] = [];
  const downtimeModes: EpochDowntimeAssetManifestEntry[] = [];

  for (const asset of EPOCH_RESOURCE_ASSETS) {
    const content = drawResourceGlyph(asset);
    const outputPath = join(packageRoot, asset.path);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, content);
    resources.push({
      resourceId: asset.resourceId,
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

  for (const asset of EPOCH_DOWNTIME_ASSETS) {
    const content = drawDowntimeGlyph(asset);
    const outputPath = join(packageRoot, asset.path);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, content);
    downtimeModes.push({
      mode: asset.mode,
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

  await writeStaticInstallManifest(join(packageRoot, "install-manifest.json"), resources, downtimeModes);
  await writeStaticInstallManifest(join(packageRoot, "obsidian-epoch/assets/install-manifest.json"), resources, downtimeModes);
  if (process.argv.includes("--json")) {
    process.stdout.write(`${JSON.stringify({ resources, downtimeModes }, null, 2)}\n`);
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
