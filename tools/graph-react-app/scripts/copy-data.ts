import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, "..");
const vaultRoot = path.resolve(appRoot, "../..");
const overviewDir = path.resolve(vaultRoot, "00_总览");
const dataSource = path.resolve(overviewDir, "world-map-data.json");
const distDir = path.resolve(appRoot, "dist");
const overviewDataDir = path.resolve(overviewDir, "data");
const overviewDataTarget = path.resolve(overviewDataDir, "world-map-data.json");
const exportedHtml = path.resolve(overviewDir, "黑曜纪元3D世界地图.html");
const exportedHttpHtml = path.resolve(overviewDir, "黑曜纪元3D世界地图.http.html");
const overviewAssets = path.resolve(overviewDir, "assets");
const transientCopyErrorCodes = new Set(["EIO", "EBUSY", "EMFILE", "ENFILE", "ETIMEDOUT"]);

type CopyFileFunction = (source: string, destination: string) => Promise<void>;

export interface CopyFileRetryOptions {
  readonly copyFile?: CopyFileFunction;
  readonly delayMs?: number;
  readonly maxAttempts?: number;
}

export interface CopyDataOptions {
  readonly includeMedia?: boolean;
}

function errorCode(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) return "";
  const code = (error as { readonly code?: unknown }).code;
  return typeof code === "string" ? code : "";
}

async function wait(ms: number) {
  if (ms <= 0) return;
  await new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function copyFileWithRetry(source: string, destination: string, options: CopyFileRetryOptions = {}) {
  const copyFile = options.copyFile || fs.copyFile;
  const maxAttempts = Math.max(1, options.maxAttempts ?? 4);
  const delayMs = Math.max(0, options.delayMs ?? 120);

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await copyFile(source, destination);
      return;
    } catch (error) {
      if (attempt >= maxAttempts || !transientCopyErrorCodes.has(errorCode(error))) throw error;
      await wait(delayMs * attempt);
    }
  }
}

async function removeBuildArtifacts(dir: string) {
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    const current = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await removeBuildArtifacts(current);
      const remaining = await fs.readdir(current).catch(() => []);
      if (!remaining.length) await fs.rmdir(current);
      continue;
    }
    if (entry.isFile() && [".css", ".js", ".mjs", ".jsx", ".map"].includes(path.extname(entry.name))) {
      await fs.rm(current);
    }
  }
}

async function copyDirectory(sourceDir: string, targetDir: string) {
  const entries = await fs.readdir(sourceDir, { withFileTypes: true }).catch(() => []);
  await fs.mkdir(targetDir, { recursive: true });
  for (const entry of entries) {
    const source = path.join(sourceDir, entry.name);
    const target = path.join(targetDir, entry.name);
    if (entry.isDirectory()) {
      await copyDirectory(source, target);
      continue;
    }
    if (entry.isFile()) {
      await copyFileWithRetry(source, target);
    }
  }
}

export function includeMediaForArgs(args: readonly string[]) {
  return !args.includes("--skip-media");
}

export async function copyData(options: CopyDataOptions = {}) {
  const data = JSON.parse(await fs.readFile(dataSource, "utf8"));
  const dataText = await fs.readFile(dataSource, "utf8");

  await fs.mkdir(overviewDataDir, { recursive: true });
  await copyFileWithRetry(dataSource, overviewDataTarget);
  await removeBuildArtifacts(overviewAssets);

  if (options.includeMedia !== false) {
    for (const asset of data.assetManifest || []) {
      const source = path.resolve(vaultRoot, asset.sourcePath);
      const overviewTarget = path.resolve(overviewDir, asset.targetPath);
      await fs.mkdir(path.dirname(overviewTarget), { recursive: true });
      await copyFileWithRetry(source, overviewTarget);
    }
  }

  const indexHtml = await fs.readFile(path.resolve(distDir, "index.html"), "utf8");
  const scriptMatch = indexHtml.match(/<script type="module"[^>]*src="([^"]+)"[^>]*><\/script>/);
  const styleMatch = indexHtml.match(/<link rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/);
  const scriptAsset = scriptMatch?.[1];
  const styleAsset = styleMatch?.[1];
  if (!scriptAsset || !styleAsset) {
    throw new Error("Could not find Vite script/style assets in dist/index.html");
  }
  const scriptPath = path.resolve(distDir, scriptAsset.replace(/^\.\//, ""));
  const stylePath = path.resolve(distDir, styleAsset.replace(/^\.\//, ""));
  const style = (await fs.readFile(stylePath, "utf8")).replace(/<\/style/gi, "<\\/style");
  await fs.access(scriptPath);
  await copyDirectory(path.resolve(distDir, "assets"), overviewAssets);
  const inlineData = dataText
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
  const inlineHtml = `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>黑曜纪元 3D 世界地图</title>
    <style>${style}</style>
  </head>
  <body>
    <div id="root"></div>
    <script>window.__WORLD_MAP_DATA__ = ${inlineData};</script>
    <script type="module" src="${scriptAsset}"></script>
  </body>
</html>
`;

  await fs.writeFile(exportedHtml, inlineHtml, "utf8");
  await fs.writeFile(exportedHttpHtml, inlineHtml, "utf8");
  await fs.rm(distDir, { recursive: true, force: true });
  console.log(`exported ${path.relative(vaultRoot, exportedHtml)}`);
  console.log("removed transient Vite dist output");
}

const entryPoint = process.argv[1];

if (entryPoint && import.meta.url === pathToFileURL(entryPoint).href) {
  await copyData({ includeMedia: includeMediaForArgs(process.argv.slice(2)) });
}
