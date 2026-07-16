import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { generateKeyPairSync } from "node:crypto";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  auditRepositoryImport,
  repositoryCandidatePaths,
} from "./check-repository-import";

async function write(root: string, relativePath: string, content: string | Buffer) {
  const absolutePath = path.join(root, relativePath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, content);
}

test("repository import preflight accepts source, env examples, and asset manifests", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "obsidian-epoch-repository-import-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const files = [
    ".env.example",
    "tools/source.ts",
    "09_素材与图片/ChatGPT批量生成/example-jobs.json",
    "09_素材与图片/ChatGPT批量生成/object-storage-manifest.json",
  ];
  for (const file of files) await write(root, file, "safe\n");

  const audit = await auditRepositoryImport(root, files);
  assert.equal(audit.fileCount, files.length);
  assert.equal(audit.violations.length, 0);
});

test("repository import preflight rejects runtime files, generated media, large files, and symlinks", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "obsidian-epoch-repository-import-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const files = [
    ".env.production",
    "tools/agent-server/data/world.sqlite",
    "00_总览/assets/app.js",
    "09_素材与图片/raw.png",
    "large.bin",
    "linked-source",
  ];
  for (const file of files.slice(0, -1)) await write(root, file, file === "large.bin" ? "0123456789" : "safe\n");
  await write(root, "source.txt", "safe\n");
  await symlink("source.txt", path.join(root, "linked-source"));

  const audit = await auditRepositoryImport(root, files, { maxFileBytes: 8, maxTotalBytes: 20 });
  const kinds = new Set(audit.violations.map((violation) => violation.kind));
  assert.ok(kinds.has("forbidden_path"));
  assert.ok(kinds.has("large_file"));
  assert.ok(kinds.has("aggregate_size"));
  assert.ok(kinds.has("symlink"));
  assert.ok(kinds.has("missing_asset_manifest"));
});

test("repository import preflight detects generated private keys and provider credentials", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "obsidian-epoch-repository-import-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const privateKey = generateKeyPairSync("ed25519").privateKey
    .export({ type: "pkcs8", format: "pem" })
    .toString();
  await write(root, "private-material.txt", privateKey);
  await write(root, "provider-token.txt", `AKIA${"A".repeat(16)}\n`);

  const audit = await auditRepositoryImport(root, ["private-material.txt", "provider-token.txt"]);
  assert.deepEqual(
    audit.violations.map((violation) => violation.kind),
    ["secret_material", "secret_material"],
  );
});

test("repository candidate inventory respects gitignore before the initial commit", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "obsidian-epoch-repository-inventory-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const initialized = spawnSync("git", ["init", "--quiet"], { cwd: root });
  assert.equal(initialized.status, 0);
  await write(root, ".gitignore", "ignored.bin\n");
  await write(root, "source.ts", "export {};\n");
  await write(root, "ignored.bin", "not source\n");

  assert.deepEqual(repositoryCandidatePaths(root), [".gitignore", "source.ts"]);
});
