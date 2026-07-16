import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  EPOCH_BOSS_ASSETS,
  EPOCH_BOSS_ASSET_HEIGHT,
  EPOCH_BOSS_ASSET_WIDTH,
  type EpochBossAssetManifestEntry,
  type EpochBossAssetRecord,
} from "./lib/bossAssets.ts";
import { encodePngRgba, hashSeed, hexToRgb, mix, setPixel } from "./lib/pngDrawing.ts";

const serverRoot = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(serverRoot, "package");

function drawBossSplash(asset: EpochBossAssetRecord) {
  const width = EPOCH_BOSS_ASSET_WIDTH;
  const height = EPOCH_BOSS_ASSET_HEIGHT;
  const pixels = Buffer.alloc(width * height * 4);
  const colors = asset.palette.map(hexToRgb);
  const base = colors[0];
  const mid = colors[1];
  const danger = hexToRgb(asset.dangerColor);
  const accent = hexToRgb(asset.accentColor);
  const light = colors[3] || colors[2] || accent;
  const seed = hashSeed(asset.templateKey);
  const centerX = width * (0.48 + (seed - 0.5) * 0.12);
  const centerY = height * 0.55;
  const radiusX = width * 0.3;
  const radiusY = height * 0.22;
  const points = 5 + Math.floor(seed * 5);

  for (let y = 0; y < height; y += 1) {
    const v = y / Math.max(1, height - 1);
    for (let x = 0; x < width; x += 1) {
      const u = x / Math.max(1, width - 1);
      const dx = (x - centerX) / radiusX;
      const dy = (y - centerY) / radiusY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx);
      const horizon = Math.max(0, 1 - Math.abs(v - 0.56) * 3.2);
      const diagonal = (Math.sin((u * 8 + v * 5 + seed * 3) * Math.PI) + 1) / 2;
      const storm = (Math.sin((angle * points) + distance * 8 + seed * 9) + 1) / 2;
      const ring = Math.max(0, 1 - Math.abs(distance - 1.02) * 10);
      const core = Math.max(0, 1 - distance);
      const slash = Math.max(0, 1 - Math.abs((u - v * 0.7 - seed * 0.35) % 0.42) * 42);
      let color = mix(base, mid, u * 0.44 + v * 0.28 + diagonal * 0.18);
      color = mix(color, light, horizon * 0.2);
      color = mix(color, danger, slash * 0.28);
      color = mix(color, accent, ring * 0.72);
      color = mix(color, mix(danger, accent, storm), core * (0.55 + storm * 0.3));

      const spine = Math.abs(Math.sin(angle * points + seed * 11)) > 0.93 && distance > 0.62 && distance < 1.35;
      if (spine) color = mix(color, light, 0.72);

      const vignette = Math.max(0, Math.hypot(u - 0.5, v - 0.5) - 0.42) * 1.7;
      color = mix(color, base, vignette);
      setPixel(pixels, width, x, y, color);
    }
  }

  return encodePngRgba(width, height, pixels);
}

async function writeStaticInstallManifest(manifestPath: string, bosses: readonly EpochBossAssetManifestEntry[]) {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as Record<string, unknown>;
  const existingAssets = typeof manifest.assets === "object" && manifest.assets !== null
    ? manifest.assets as Record<string, unknown>
    : {};
  const next = {
    ...manifest,
    assets: {
      ...existingAssets,
      bosses,
    },
  };
  await writeFile(manifestPath, `${JSON.stringify(next, null, 2)}\n`);
}

async function main() {
  const bosses: EpochBossAssetManifestEntry[] = [];
  for (const asset of EPOCH_BOSS_ASSETS) {
    const content = drawBossSplash(asset);
    const outputPath = join(packageRoot, asset.path);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, content);
    bosses.push({
      templateKey: asset.templateKey,
      title: asset.title,
      path: asset.path,
      url: asset.url,
      contentType: asset.contentType,
      width: asset.width,
      height: asset.height,
      sha256: createHash("sha256").update(content).digest("hex"),
    });
  }
  await writeStaticInstallManifest(join(packageRoot, "install-manifest.json"), bosses);
  await writeStaticInstallManifest(join(packageRoot, "obsidian-epoch/assets/install-manifest.json"), bosses);
  if (process.argv.includes("--json")) {
    process.stdout.write(`${JSON.stringify({ bosses }, null, 2)}\n`);
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
