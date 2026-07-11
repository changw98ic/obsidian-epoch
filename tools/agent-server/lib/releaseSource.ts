import { spawnSync } from "node:child_process";
import { realpathSync } from "node:fs";
import path from "node:path";

export const RELEASE_SOURCE_REQUIRED_PATHS = [
  ".dockerignore",
  ".github/workflows/ci.yml",
  "00_总览/world-map-data.json",
  "tools/agent-server/deploy/Dockerfile",
  "tools/agent-server/deploy/Dockerfile.caddy",
  "tools/graph-react-app/package-lock.json",
] as const;

export interface ReleaseSourceVerificationOptions {
  readonly workspaceRoot: string;
  readonly expectedRevision: string;
  readonly expectedRepositoryUrl: string;
  readonly requiredPaths?: readonly string[];
}

export interface ReleaseSourceVerification {
  readonly verified: true;
  readonly clean: true;
  readonly revision: string;
  readonly repositoryUrl: string;
  readonly trackedFileCount: number;
  readonly requiredPaths: readonly string[];
}

function runGit(workspaceRoot: string, args: readonly string[]) {
  const result = spawnSync("git", [...args], {
    cwd: workspaceRoot,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error || result.status !== 0) {
    throw new Error(`release_source_git_command_failed:${args[0] || "unknown"}`);
  }
  return String(result.stdout);
}

function normalizedRevision(value: string) {
  const revision = value.trim().toLowerCase();
  if (!/^[a-f0-9]{40}$/.test(revision)) throw new Error("release_source_revision_invalid");
  return revision;
}

function normalizedRepositoryUrl(value: string, allowSsh: boolean) {
  const raw = value.trim();
  let httpsValue = raw;
  const scpStyle = raw.match(/^git@([^:]+):(.+)$/);
  const sshStyle = raw.match(/^ssh:\/\/git@([^/]+)\/(.+)$/);
  if (allowSsh && scpStyle) httpsValue = `https://${scpStyle[1]}/${scpStyle[2]}`;
  if (allowSsh && sshStyle) httpsValue = `https://${sshStyle[1]}/${sshStyle[2]}`;

  let parsed: URL;
  try {
    parsed = new URL(httpsValue);
  } catch {
    throw new Error("release_source_repository_url_invalid");
  }
  if (
    parsed.protocol !== "https:"
    || parsed.username
    || parsed.password
    || parsed.search
    || parsed.hash
  ) {
    throw new Error("release_source_repository_url_invalid");
  }
  const pathname = parsed.pathname.replace(/\.git$/i, "").replace(/\/+$/, "");
  if (!pathname || pathname === "/") throw new Error("release_source_repository_url_invalid");
  return `https://${parsed.host.toLowerCase()}${pathname}`;
}

export function verifyReleaseSource(
  options: ReleaseSourceVerificationOptions,
): ReleaseSourceVerification {
  const workspaceRoot = realpathSync(path.resolve(options.workspaceRoot));
  const expectedRevision = normalizedRevision(options.expectedRevision);
  const expectedRepositoryUrl = normalizedRepositoryUrl(options.expectedRepositoryUrl, false);
  const repositoryRoot = realpathSync(path.resolve(runGit(workspaceRoot, ["rev-parse", "--show-toplevel"]).trim()));
  if (repositoryRoot !== workspaceRoot) throw new Error("release_source_workspace_not_repository_root");

  const actualRevision = normalizedRevision(runGit(workspaceRoot, ["rev-parse", "HEAD"]));
  if (actualRevision !== expectedRevision) throw new Error("release_source_revision_mismatch");
  const origin = normalizedRepositoryUrl(runGit(workspaceRoot, ["remote", "get-url", "origin"]), true);
  if (origin !== expectedRepositoryUrl) throw new Error("release_source_repository_mismatch");

  const statusLines = runGit(workspaceRoot, [
    "status",
    "--porcelain=v1",
    "--untracked-files=all",
  ]).split(/\r?\n/).filter(Boolean);
  if (statusLines.length) throw new Error(`release_source_worktree_dirty:${statusLines.length}`);

  const trackedPaths = runGit(workspaceRoot, ["ls-files", "-z"]).split("\0").filter(Boolean);
  const trackedPathSet = new Set(trackedPaths);
  const requiredPaths = [...(options.requiredPaths || RELEASE_SOURCE_REQUIRED_PATHS)].sort();
  const missingPaths = requiredPaths.filter((requiredPath) => !trackedPathSet.has(requiredPath));
  if (missingPaths.length) throw new Error(`release_source_required_paths_untracked:${missingPaths.length}`);

  return {
    verified: true,
    clean: true,
    revision: actualRevision,
    repositoryUrl: expectedRepositoryUrl,
    trackedFileCount: trackedPaths.length,
    requiredPaths,
  };
}
