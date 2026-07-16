import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  EPOCH_CAMPAIGN_KEY_ART_ASSETS,
  EPOCH_CAMPAIGN_KEY_ART_HEIGHT,
  EPOCH_CAMPAIGN_KEY_ART_WIDTH,
  type EpochCampaignKeyArtManifestEntry,
  type EpochCampaignKeyArtRecord,
} from "./lib/campaignAssets.ts";
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

function drawBanner(pixels: Buffer, width: number, height: number, x: number, y: number, color: Rgb, alpha: number) {
  drawRect(pixels, width, height, x, y, x + width * 0.09, y + height * 0.33, color, alpha);
  drawTriangle(pixels, width, height, x, y + height * 0.33, x + width * 0.045, y + height * 0.27, x + width * 0.09, y + height * 0.33, color, alpha);
}

function drawMotif(asset: EpochCampaignKeyArtRecord, pixels: Buffer, width: number, height: number, base: Rgb, mid: Rgb, accent: Rgb, light: Rgb) {
  if (asset.motif === "harbor-war") {
    drawLine(pixels, width, height, width * 0.1, height * 0.68, width * 0.9, height * 0.56, width * 0.012, accent, 190);
    drawRect(pixels, width, height, width * 0.69, height * 0.2, width * 0.73, height * 0.64, light, 190);
    drawCircle(pixels, width, height, width * 0.71, height * 0.18, width * 0.04, accent, 210);
    drawBanner(pixels, width, height, width * 0.22, height * 0.24, mid, 210);
    drawBanner(pixels, width, height, width * 0.43, height * 0.2, accent, 200);
    drawBanner(pixels, width, height, width * 0.58, height * 0.26, light, 190);
  } else if (asset.motif === "archive-expedition") {
    drawRect(pixels, width, height, width * 0.2, height * 0.34, width * 0.78, height * 0.7, mid, 150);
    for (let index = 0; index < 5; index += 1) {
      const x = width * (0.26 + index * 0.09);
      drawRect(pixels, width, height, x, height * 0.25, x + width * 0.035, height * 0.7, light, 125);
      drawCircle(pixels, width, height, x + width * 0.017, height * 0.24, width * 0.025, accent, 185);
    }
  } else if (asset.motif === "tower-compact") {
    drawTriangle(pixels, width, height, width * 0.5, height * 0.14, width * 0.34, height * 0.7, width * 0.66, height * 0.7, light, 185);
    drawRect(pixels, width, height, width * 0.47, height * 0.24, width * 0.53, height * 0.72, base, 180);
    drawCircle(pixels, width, height, width * 0.5, height * 0.23, width * 0.05, accent, 220);
    drawLine(pixels, width, height, width * 0.18, height * 0.66, width * 0.82, height * 0.34, width * 0.006, accent, 160);
  } else if (asset.motif === "anomaly") {
    drawCircle(pixels, width, height, width * 0.52, height * 0.42, width * 0.2, accent, 118);
    for (let index = 0; index < 10; index += 1) {
      const angle = index * Math.PI * 0.2;
      drawLine(pixels, width, height, width * 0.52, height * 0.42, width * (0.52 + Math.cos(angle) * 0.33), height * (0.42 + Math.sin(angle) * 0.28), width * 0.008, light, 165);
    }
    drawCircle(pixels, width, height, width * 0.52, height * 0.42, width * 0.08, base, 220);
  } else if (asset.motif === "resource-rush") {
    drawLine(pixels, width, height, width * 0.12, height * 0.72, width * 0.88, height * 0.72, width * 0.016, light, 165);
    for (let index = 0; index < 6; index += 1) {
      const x = width * (0.24 + index * 0.09);
      drawTriangle(pixels, width, height, x, height * 0.34, x - width * 0.04, height * 0.68, x + width * 0.04, height * 0.68, accent, 175);
      drawCircle(pixels, width, height, x, height * 0.32, width * 0.025, light, 210);
    }
  } else {
    drawRect(pixels, width, height, width * 0.17, height * 0.45, width * 0.78, height * 0.62, mid, 180);
    drawTriangle(pixels, width, height, width * 0.78, height * 0.45, width * 0.91, height * 0.54, width * 0.78, height * 0.62, mid, 180);
    drawCircle(pixels, width, height, width * 0.28, height * 0.66, width * 0.045, accent, 220);
    drawCircle(pixels, width, height, width * 0.68, height * 0.66, width * 0.045, accent, 220);
    drawLine(pixels, width, height, width * 0.2, height * 0.42, width * 0.7, height * 0.24, width * 0.006, light, 160);
  }
}

function drawCampaignKeyArt(asset: EpochCampaignKeyArtRecord) {
  const width = EPOCH_CAMPAIGN_KEY_ART_WIDTH;
  const height = EPOCH_CAMPAIGN_KEY_ART_HEIGHT;
  const pixels = Buffer.alloc(width * height * 4);
  const colors = asset.palette.map(hexToRgb);
  const base = colors[0];
  const mid = colors[1];
  const accent = hexToRgb(asset.accentColor);
  const light = colors[2] || accent;
  const trim = colors[3] || light;
  const seed = hashSeed(asset.campaignKey);

  for (let y = 0; y < height; y += 1) {
    const v = y / Math.max(1, height - 1);
    for (let x = 0; x < width; x += 1) {
      const u = x / Math.max(1, width - 1);
      const horizon = Math.max(0, 1 - Math.abs(v - 0.58) * 2.7);
      const glow = Math.max(0, 1 - Math.hypot(u - 0.58, v - 0.42) * 1.65);
      const grain = (Math.sin((u * 8.4 + v * 6.2 + seed * 7.1) * Math.PI) + 1) / 2;
      let color = mix(base, mid, v * 0.52 + horizon * 0.12 + grain * 0.05);
      color = mix(color, accent, glow * 0.35);
      color = mix(color, base, Math.max(0, Math.hypot(u - 0.5, v - 0.5) - 0.66));
      setPixel(pixels, width, x, y, color);
    }
  }

  drawCircle(pixels, width, height, width * 0.66, height * 0.42, width * 0.22, mix(accent, trim, 0.22), 72);
  drawLine(pixels, width, height, width * 0.05, height * 0.76, width * 0.95, height * 0.62, width * 0.005, mix(mid, trim, 0.3), 120);
  drawLine(pixels, width, height, width * 0.08, height * 0.23, width * 0.92, height * 0.68, width * 0.004, mix(accent, trim, 0.25), 95);
  drawMotif(asset, pixels, width, height, base, mid, accent, trim);
  return encodePngRgba(width, height, pixels);
}

async function writeStaticInstallManifest(manifestPath: string, campaignKeyArt: readonly EpochCampaignKeyArtManifestEntry[]) {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as Record<string, unknown>;
  const existingAssets = typeof manifest.assets === "object" && manifest.assets !== null
    ? manifest.assets as Record<string, unknown>
    : {};
  const next = {
    ...manifest,
    assets: {
      ...existingAssets,
      campaignKeyArt,
    },
  };
  await writeFile(manifestPath, `${JSON.stringify(next, null, 2)}\n`);
}

async function main() {
  const campaignKeyArt: EpochCampaignKeyArtManifestEntry[] = [];
  for (const asset of EPOCH_CAMPAIGN_KEY_ART_ASSETS) {
    const content = drawCampaignKeyArt(asset);
    const outputPath = join(packageRoot, asset.path);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, content);
    campaignKeyArt.push({
      campaignKey: asset.campaignKey,
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

  await writeStaticInstallManifest(join(packageRoot, "install-manifest.json"), campaignKeyArt);
  await writeStaticInstallManifest(join(packageRoot, "obsidian-epoch/assets/install-manifest.json"), campaignKeyArt);
  if (process.argv.includes("--json")) {
    process.stdout.write(`${JSON.stringify({ campaignKeyArt }, null, 2)}\n`);
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
