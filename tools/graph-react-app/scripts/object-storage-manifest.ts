import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultWorkspaceRoot = path.resolve(appRoot, "../..");

export const OBJECT_STORAGE_ASSET_ROOT = "09_素材与图片";
export const OBJECT_STORAGE_MANIFEST_PATH = `${OBJECT_STORAGE_ASSET_ROOT}/ChatGPT批量生成/object-storage-manifest.json`;
export const OBJECT_STORAGE_SELECTION_POLICY = "exclude_batch_runtime_and_local_metadata";
export const OBJECT_STORAGE_BASE_URL_ENV_VAR = "OBSIDIAN_EPOCH_ASSET_BASE_URL";

export interface ObjectStorageManifestEntry {
  readonly path: string;
  readonly bytes: number;
  readonly sha256: string;
}

export interface ObjectStorageManifest {
  readonly type: "obsidian_epoch_object_storage_manifest";
  readonly version: 1;
  readonly algorithm: "sha256";
  readonly root: typeof OBJECT_STORAGE_ASSET_ROOT;
  readonly selectionPolicy: typeof OBJECT_STORAGE_SELECTION_POLICY;
  readonly objectCount: number;
  readonly totalBytes: number;
  readonly objects: readonly ObjectStorageManifestEntry[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function unixPath(filePath: string) {
  return filePath.split(path.sep).join("/");
}

function isSelectedAsset(relativePath: string) {
  return relativePath !== ".DS_Store"
    && !relativePath.endsWith("/.DS_Store")
    && !relativePath.startsWith("ChatGPT批量生成/");
}

async function selectedAssetPaths(assetRoot: string): Promise<string[]> {
  const selected: string[] = [];

  async function walk(directory: string) {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      const absolutePath = path.join(directory, entry.name);
      const relativePath = unixPath(path.relative(assetRoot, absolutePath));
      if (entry.isSymbolicLink()) throw new Error(`object_storage_asset_symlink_forbidden:${relativePath}`);
      if (entry.isDirectory()) {
        if (relativePath === "ChatGPT批量生成") continue;
        await walk(absolutePath);
        continue;
      }
      if (entry.isFile() && isSelectedAsset(relativePath)) selected.push(relativePath);
    }
  }

  await walk(assetRoot);
  return selected.sort();
}

async function sha256File(filePath: string) {
  const digest = createHash("sha256");
  for await (const chunk of createReadStream(filePath)) digest.update(chunk);
  return digest.digest("hex");
}

export async function buildObjectStorageManifest(
  workspaceRoot = defaultWorkspaceRoot,
): Promise<ObjectStorageManifest> {
  const assetRoot = path.join(workspaceRoot, OBJECT_STORAGE_ASSET_ROOT);
  const objects: ObjectStorageManifestEntry[] = [];
  for (const relativePath of await selectedAssetPaths(assetRoot)) {
    const absolutePath = path.join(assetRoot, relativePath);
    const metadata = await fs.stat(absolutePath);
    objects.push({
      path: relativePath,
      bytes: metadata.size,
      sha256: await sha256File(absolutePath),
    });
  }
  return {
    type: "obsidian_epoch_object_storage_manifest",
    version: 1,
    algorithm: "sha256",
    root: OBJECT_STORAGE_ASSET_ROOT,
    selectionPolicy: OBJECT_STORAGE_SELECTION_POLICY,
    objectCount: objects.length,
    totalBytes: objects.reduce((total, entry) => total + entry.bytes, 0),
    objects,
  };
}

export function validateObjectStorageManifest(value: unknown): ObjectStorageManifest {
  if (!isRecord(value) || (
    value.type !== "obsidian_epoch_object_storage_manifest"
    || value.version !== 1
    || value.algorithm !== "sha256"
    || value.root !== OBJECT_STORAGE_ASSET_ROOT
    || value.selectionPolicy !== OBJECT_STORAGE_SELECTION_POLICY
    || !Number.isSafeInteger(value.objectCount)
    || !Number.isSafeInteger(value.totalBytes)
    || !Array.isArray(value.objects)
  )) {
    throw new Error("object_storage_manifest_invalid");
  }

  const objects = value.objects.map((entry): ObjectStorageManifestEntry => {
    if (!isRecord(entry) || (
      typeof entry.path !== "string"
      || !Number.isSafeInteger(entry.bytes)
      || Number(entry.bytes) <= 0
      || typeof entry.sha256 !== "string"
      || !/^[a-f0-9]{64}$/.test(entry.sha256)
    )) {
      throw new Error("object_storage_manifest_entry_invalid");
    }
    const segments = entry.path.split("/");
    if (
      path.isAbsolute(entry.path)
      || entry.path.includes("\\")
      || segments.includes("..")
      || !isSelectedAsset(entry.path)
    ) {
      throw new Error(`object_storage_manifest_path_invalid:${entry.path}`);
    }
    return { path: entry.path, bytes: Number(entry.bytes), sha256: entry.sha256 };
  });

  const paths = objects.map((entry) => entry.path);
  if (new Set(paths).size !== paths.length || JSON.stringify(paths) !== JSON.stringify([...paths].sort())) {
    throw new Error("object_storage_manifest_paths_not_unique_and_sorted");
  }
  if (value.objectCount !== objects.length) throw new Error("object_storage_manifest_count_mismatch");
  const totalBytes = objects.reduce((total, entry) => total + entry.bytes, 0);
  if (value.totalBytes !== totalBytes) throw new Error("object_storage_manifest_size_mismatch");
  if (objects.length === 0) throw new Error("object_storage_manifest_empty");

  return {
    type: "obsidian_epoch_object_storage_manifest",
    version: 1,
    algorithm: "sha256",
    root: OBJECT_STORAGE_ASSET_ROOT,
    selectionPolicy: OBJECT_STORAGE_SELECTION_POLICY,
    objectCount: objects.length,
    totalBytes,
    objects,
  };
}

export function serializeObjectStorageManifest(manifest: ObjectStorageManifest) {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

export async function readObjectStorageManifest(workspaceRoot = defaultWorkspaceRoot) {
  const manifestPath = path.join(workspaceRoot, OBJECT_STORAGE_MANIFEST_PATH);
  return validateObjectStorageManifest(JSON.parse(await fs.readFile(manifestPath, "utf8")) as unknown);
}

export async function writeObjectStorageManifest(workspaceRoot = defaultWorkspaceRoot) {
  const manifest = await buildObjectStorageManifest(workspaceRoot);
  const manifestPath = path.join(workspaceRoot, OBJECT_STORAGE_MANIFEST_PATH);
  const temporaryPath = `${manifestPath}.tmp`;
  await fs.mkdir(path.dirname(manifestPath), { recursive: true });
  await fs.writeFile(temporaryPath, serializeObjectStorageManifest(manifest), { mode: 0o600 });
  await fs.rename(temporaryPath, manifestPath);
  return manifest;
}

export async function verifyLocalObjectStorageManifest(workspaceRoot = defaultWorkspaceRoot) {
  const expected = await buildObjectStorageManifest(workspaceRoot);
  const actual = await readObjectStorageManifest(workspaceRoot);
  if (serializeObjectStorageManifest(actual) !== serializeObjectStorageManifest(expected)) {
    throw new Error("object_storage_manifest_local_mismatch");
  }
  return actual;
}

function remoteObjectUrl(baseUrl: URL, objectPath: string) {
  const encodedPath = objectPath.split("/").map((segment) => encodeURIComponent(segment)).join("/");
  return new URL(encodedPath, baseUrl).toString();
}

export async function verifyRemoteObjectStorageManifest(
  baseUrlValue: string,
  workspaceRoot = defaultWorkspaceRoot,
  fetcher: typeof fetch = fetch,
) {
  let baseUrl: URL;
  try {
    baseUrl = new URL(baseUrlValue.endsWith("/") ? baseUrlValue : `${baseUrlValue}/`);
  } catch {
    throw new Error("object_storage_base_url_invalid");
  }
  if (
    baseUrl.protocol !== "https:"
    || baseUrl.username
    || baseUrl.password
    || baseUrl.search
    || baseUrl.hash
  ) {
    throw new Error("object_storage_base_url_must_be_public_https");
  }

  const manifest = await readObjectStorageManifest(workspaceRoot);
  let nextIndex = 0;
  const workerCount = Math.min(4, manifest.objects.length);
  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (nextIndex < manifest.objects.length) {
      const index = nextIndex;
      nextIndex += 1;
      const entry = manifest.objects[index];
      if (!entry) continue;
      const response = await fetcher(remoteObjectUrl(baseUrl, entry.path), {
        headers: { accept: "application/octet-stream" },
        redirect: "error",
      });
      if (!response.ok) throw new Error(`object_storage_remote_status:${entry.path}:${response.status}`);
      const declaredLength = response.headers.get("content-length");
      if (declaredLength && Number.parseInt(declaredLength, 10) !== entry.bytes) {
        throw new Error(`object_storage_remote_size:${entry.path}`);
      }
      const content = Buffer.from(await response.arrayBuffer());
      if (content.byteLength !== entry.bytes) throw new Error(`object_storage_remote_size:${entry.path}`);
      if (createHash("sha256").update(content).digest("hex") !== entry.sha256) {
        throw new Error(`object_storage_remote_sha256:${entry.path}`);
      }
    }
  }));
  return manifest;
}

const entryPoint = process.argv[1];

if (entryPoint && import.meta.url === pathToFileURL(entryPoint).href) {
  const operation = process.argv[2] || "--check";
  const workspaceRoot = process.argv[3] ? path.resolve(process.argv[3]) : defaultWorkspaceRoot;
  const manifest = operation === "--write"
    ? await writeObjectStorageManifest(workspaceRoot)
    : operation === "--verify-local"
      ? await verifyLocalObjectStorageManifest(workspaceRoot)
      : operation === "--verify-remote"
        ? await verifyRemoteObjectStorageManifest(process.env[OBJECT_STORAGE_BASE_URL_ENV_VAR] || "", workspaceRoot)
      : operation === "--check"
        ? await readObjectStorageManifest(workspaceRoot)
        : undefined;
  if (!manifest) throw new Error(`object_storage_manifest_operation_invalid:${operation}`);
  console.log(
    `Object storage manifest ${operation.slice(2)} passed: objects=${manifest.objectCount}; total_bytes=${manifest.totalBytes}`,
  );
}
