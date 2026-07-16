import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { OBJECT_STORAGE_ASSET_ROOT, OBJECT_STORAGE_MANIFEST_PATH } from "./object-storage-manifest";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workspaceRoot = path.resolve(appRoot, "../..");

export const DEFAULT_MAX_REPOSITORY_FILE_BYTES = 10 * 1024 * 1024;
export const DEFAULT_MAX_REPOSITORY_TOTAL_BYTES = 100 * 1024 * 1024;

const forbiddenExtensions = new Set([
  ".db",
  ".jsonl",
  ".key",
  ".log",
  ".p12",
  ".pem",
  ".pfx",
  ".pid",
  ".sqlite",
  ".sqlite3",
]);

const forbiddenDirectoryNames = new Set([
  ".codegraph",
  ".git",
  ".omc",
  ".omx",
  "__pycache__",
  "dist",
  "node_modules",
]);

const generatedExportPaths = new Set([
  "00_总览/黑曜纪元3D世界地图.html",
  "00_总览/黑曜纪元3D世界地图.http.html",
]);

const secretContentPatterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----\r?\n[A-Za-z0-9+/=\r\n]{40,}-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bgh[pousr]_[A-Za-z0-9]{36,}\b/,
  /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/,
] as const;

export type RepositoryImportViolationKind =
  | "aggregate_size"
  | "forbidden_path"
  | "large_file"
  | "missing_asset_manifest"
  | "secret_material"
  | "symlink";

export interface RepositoryImportViolation {
  readonly kind: RepositoryImportViolationKind;
  readonly path: string | undefined;
  readonly detail: string;
}

export interface RepositoryImportAudit {
  readonly fileCount: number;
  readonly totalBytes: number;
  readonly maxFileBytes: number;
  readonly violations: readonly RepositoryImportViolation[];
}

export interface RepositoryImportLimits {
  readonly maxFileBytes?: number;
  readonly maxTotalBytes?: number;
}

function unixPath(filePath: string) {
  return filePath.split(path.sep).join("/");
}

function forbiddenPathDetail(relativePath: string): string | undefined {
  const segments = relativePath.split("/");
  if (segments.some((segment) => forbiddenDirectoryNames.has(segment))) {
    return "local dependency, orchestration, cache, or generated directory";
  }

  const baseName = segments.at(-1) || "";
  if ((baseName === ".env" || baseName.startsWith(".env.")) && baseName !== ".env.example") {
    return "environment file other than .env.example";
  }
  if (/^(?:id_(?:rsa|dsa|ecdsa|ed25519)|credentials?|secrets?|private[-_.]?key)(?:\.|$)/i.test(baseName)) {
    return "secret-looking filename";
  }
  if (forbiddenExtensions.has(path.extname(baseName).toLowerCase())) {
    return "runtime ledger, private key, database, or log extension";
  }
  if (/^tools\/agent-server\/(?:data|backups?|restore)(?:\/|$)/.test(relativePath)) {
    return "agent-server runtime or recovery data";
  }
  if (
    relativePath.startsWith("00_总览/assets/")
    || relativePath.startsWith("00_总览/data/")
    || generatedExportPaths.has(relativePath)
  ) {
    return "generated browser export";
  }
  if (relativePath.startsWith("09_素材与图片/")) {
    const allowed = /^09_素材与图片\/ChatGPT批量生成\/(?:[^/]+-jobs\.json|object-storage-manifest\.json)$/.test(relativePath);
    if (!allowed) return "original media must remain in object storage or a reviewed Git LFS policy";
  }
  return undefined;
}

function containsSecretMaterial(content: Buffer) {
  if (content.includes(0)) return false;
  const text = content.toString("utf8");
  return secretContentPatterns.some((pattern) => pattern.test(text));
}

export function repositoryCandidatePaths(root = workspaceRoot): string[] {
  const result = spawnSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
    { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`repository_import_git_inventory_failed:${String(result.stderr).trim()}`);
  }
  return String(result.stdout)
    .split("\0")
    .filter(Boolean)
    .sort();
}

export async function auditRepositoryImport(
  root: string,
  candidatePaths: readonly string[],
  limits: RepositoryImportLimits = {},
): Promise<RepositoryImportAudit> {
  const maxAllowedFileBytes = limits.maxFileBytes ?? DEFAULT_MAX_REPOSITORY_FILE_BYTES;
  const maxAllowedTotalBytes = limits.maxTotalBytes ?? DEFAULT_MAX_REPOSITORY_TOTAL_BYTES;
  const violations: RepositoryImportViolation[] = [];
  let fileCount = 0;
  let totalBytes = 0;
  let maxFileBytes = 0;
  const uniqueCandidatePaths = [...new Set(candidatePaths)].sort();

  for (const candidatePath of uniqueCandidatePaths) {
    const relativePath = unixPath(candidatePath);
    if (!relativePath || path.isAbsolute(relativePath) || relativePath.split("/").includes("..")) {
      violations.push({ kind: "forbidden_path", path: relativePath || candidatePath, detail: "path escapes repository root" });
      continue;
    }

    const absolutePath = path.join(root, relativePath);
    let metadata;
    try {
      metadata = await fs.lstat(absolutePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
      throw error;
    }
    if (metadata.isSymbolicLink()) {
      violations.push({ kind: "symlink", path: relativePath, detail: "repository imports must not contain symbolic links" });
      continue;
    }
    if (!metadata.isFile()) continue;

    fileCount += 1;
    totalBytes += metadata.size;
    maxFileBytes = Math.max(maxFileBytes, metadata.size);

    const pathDetail = forbiddenPathDetail(relativePath);
    if (pathDetail) violations.push({ kind: "forbidden_path", path: relativePath, detail: pathDetail });
    if (metadata.size > maxAllowedFileBytes) {
      violations.push({ kind: "large_file", path: relativePath, detail: `${metadata.size} bytes exceeds ${maxAllowedFileBytes}` });
      continue;
    }

    const content = await fs.readFile(absolutePath);
    if (containsSecretMaterial(content)) {
      violations.push({ kind: "secret_material", path: relativePath, detail: "high-confidence private key or provider credential pattern" });
    }
  }

  try {
    const assetRoot = await fs.stat(path.join(root, OBJECT_STORAGE_ASSET_ROOT));
    if (assetRoot.isDirectory() && !uniqueCandidatePaths.includes(OBJECT_STORAGE_MANIFEST_PATH)) {
      violations.push({
        kind: "missing_asset_manifest",
        path: OBJECT_STORAGE_MANIFEST_PATH,
        detail: "original media requires a versioned checksum manifest",
      });
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }

  if (totalBytes > maxAllowedTotalBytes) {
    violations.push({
      kind: "aggregate_size",
      path: undefined,
      detail: `${totalBytes} bytes exceeds ${maxAllowedTotalBytes}`,
    });
  }

  return { fileCount, totalBytes, maxFileBytes, violations };
}

const entryPoint = process.argv[1];

if (entryPoint && import.meta.url === pathToFileURL(entryPoint).href) {
  const root = process.argv[2] ? path.resolve(process.argv[2]) : workspaceRoot;
  const audit = await auditRepositoryImport(root, repositoryCandidatePaths(root));
  if (audit.violations.length) {
    console.error("Repository import preflight failed:");
    for (const violation of audit.violations) {
      console.error(`- ${violation.kind}: ${violation.path ? `${violation.path}: ` : ""}${violation.detail}`);
    }
    process.exit(1);
  }

  console.log(
    `Repository import preflight passed: files=${audit.fileCount}; total_bytes=${audit.totalBytes}; max_file_bytes=${audit.maxFileBytes}`,
  );
}
