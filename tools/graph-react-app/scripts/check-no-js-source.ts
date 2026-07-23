import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workspaceRoot = path.resolve(appRoot, "../..");
const forbiddenExtensions = new Set([".js", ".jsx", ".mjs", ".cjs"]);
const ignoredDirectoryNames = new Set([
  ".git",
  ".obsidian",
  ".omc",
  ".omx",
  ".qoder",
  "node_modules",
  "__pycache__",
  "dist",
]);

function relativeUnix(root: string, current: string) {
  return path.relative(root, current).split(path.sep).join("/");
}

function isGeneratedExportAsset(relativePath: string) {
  return relativePath.startsWith("00_总览/assets/");
}

async function walk(root: string, dir: string, violations: string[]) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const current = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (ignoredDirectoryNames.has(entry.name)) continue;
      await walk(root, current, violations);
      continue;
    }
    if (!entry.isFile()) continue;
    if (forbiddenExtensions.has(path.extname(entry.name))) {
      const relativePath = relativeUnix(root, current);
      if (!isGeneratedExportAsset(relativePath)) violations.push(relativePath);
    }
  }
}

export async function findForbiddenJsFiles(root = workspaceRoot): Promise<string[]> {
  const violations: string[] = [];
  await walk(root, root, violations);
  return violations;
}

const entryPoint = process.argv[1];

if (entryPoint && import.meta.url === pathToFileURL(entryPoint).href) {
  const root = process.argv[2] ? path.resolve(process.argv[2]) : workspaceRoot;
  const violations = await findForbiddenJsFiles(root);

  if (violations.length) {
    console.error("JS/MJS/CJS/JSX source files are not allowed:");
    for (const file of violations) console.error(`- ${file}`);
    process.exit(1);
  }

  console.log("No JS/MJS/CJS/JSX source files found.");
}
