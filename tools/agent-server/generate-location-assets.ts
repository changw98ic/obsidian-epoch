import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  EPOCH_LOCATION_ASSETS,
  EPOCH_LOCATION_ASSET_HEIGHT,
  EPOCH_LOCATION_ASSET_WIDTH,
  type EpochLocationAssetManifestEntry,
  type EpochLocationAssetRecord,
} from "./lib/locationAssets.ts";
import { encodePngRgba, hashSeed, hexToRgb, mix, setPixel } from "./lib/pngDrawing.ts";

const serverRoot = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(serverRoot, "package");

function drawLocationSplash(asset: EpochLocationAssetRecord) {
  const width = EPOCH_LOCATION_ASSET_WIDTH;
  const height = EPOCH_LOCATION_ASSET_HEIGHT;
  const pixels = Buffer.alloc(width * height * 4);
  const colors = asset.palette.map(hexToRgb);
  const base = colors[0];
  const mid = colors[1];
  const accent = hexToRgb(asset.accentColor);
  const light = colors[2] || accent;
  const warm = colors[3] || light;
  const seed = hashSeed(asset.regionId);
  const horizonY = 0.5 + (seed - 0.5) * 0.08;
  const towerX = width * (0.18 + seed * 0.18);
  const towerWidth = width * 0.035;

  for (let y = 0; y < height; y += 1) {
    const v = y / Math.max(1, height - 1);
    for (let x = 0; x < width; x += 1) {
      const u = x / Math.max(1, width - 1);
      const skyAmount = Math.max(0, 1 - v / horizonY);
      const groundAmount = Math.max(0, (v - horizonY) / Math.max(0.001, 1 - horizonY));
      const tide = (Math.sin((u * 10 + seed * 5) * Math.PI + v * 7) + 1) / 2;
      const route = Math.max(0, 1 - Math.abs(v - (horizonY + Math.sin(u * Math.PI * 2 + seed) * 0.025)) * 28);
      const district = Math.max(0, 1 - Math.abs(((u * 6 + seed) % 1) - 0.5) * 4) * Math.max(0, 1 - Math.abs(v - horizonY) * 8);
      const tower = Math.abs(x - towerX) < towerWidth && v > horizonY - 0.28 && v < horizonY + 0.08;
      const beacon = Math.max(0, 1 - Math.hypot((x - towerX) / (width * 0.18), (v - (horizonY - 0.22)) / 0.12));
      let color = mix(base, mid, skyAmount * 0.55 + groundAmount * 0.22);
      color = mix(color, light, route * 0.42 + tide * groundAmount * 0.18);
      color = mix(color, accent, district * 0.35 + beacon * 0.62);
      color = mix(color, warm, tower ? 0.46 : Math.max(0, route - 0.55) * 0.22);
      const vignette = Math.max(0, Math.hypot(u - 0.5, v - 0.5) - 0.48) * 1.8;
      color = mix(color, base, vignette);
      setPixel(pixels, width, x, y, color);
    }
  }

  return encodePngRgba(width, height, pixels);
}

async function writeStaticInstallManifest(manifestPath: string, locations: readonly EpochLocationAssetManifestEntry[]) {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as Record<string, unknown>;
  const existingAssets = typeof manifest.assets === "object" && manifest.assets !== null
    ? manifest.assets as Record<string, unknown>
    : {};
  const next = {
    ...manifest,
    assets: {
      ...existingAssets,
      locations,
    },
  };
  await writeFile(manifestPath, `${JSON.stringify(next, null, 2)}\n`);
}

async function main() {
  const locations: EpochLocationAssetManifestEntry[] = [];
  for (const asset of EPOCH_LOCATION_ASSETS) {
    const content = drawLocationSplash(asset);
    const outputPath = join(packageRoot, asset.path);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, content);
    locations.push({
      regionId: asset.regionId,
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
  await writeStaticInstallManifest(join(packageRoot, "install-manifest.json"), locations);
  await writeStaticInstallManifest(join(packageRoot, "obsidian-epoch/assets/install-manifest.json"), locations);
  if (process.argv.includes("--json")) {
    process.stdout.write(`${JSON.stringify({ locations }, null, 2)}\n`);
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
