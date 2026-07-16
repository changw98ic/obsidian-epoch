import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildObjectStorageManifest,
  OBJECT_STORAGE_BASE_URL_ENV_VAR,
  OBJECT_STORAGE_MANIFEST_PATH,
  readObjectStorageManifest,
  serializeObjectStorageManifest,
  validateObjectStorageManifest,
  verifyLocalObjectStorageManifest,
  verifyRemoteObjectStorageManifest,
  writeObjectStorageManifest,
} from "./object-storage-manifest";

async function write(root: string, relativePath: string, content: string) {
  const absolutePath = path.join(root, relativePath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, content);
}

test("object storage manifest hashes curated assets and excludes batch runtime state", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "obsidian-epoch-object-manifest-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await write(root, "09_素材与图片/a.png", "alpha");
  await write(root, "09_素材与图片/参考母版/b.png", "beta");
  await write(root, "09_素材与图片/.DS_Store", "local");
  await write(root, "09_素材与图片/ChatGPT批量生成/diagnostics/debug.png", "diagnostic");

  const manifest = await buildObjectStorageManifest(root);
  assert.equal(manifest.objectCount, 2);
  assert.deepEqual(manifest.objects.map((entry) => entry.path), ["a.png", "参考母版/b.png"]);
  assert.equal(manifest.totalBytes, 9);
  assert.match(manifest.objects[0]?.sha256 || "", /^[a-f0-9]{64}$/);
});

test("object storage manifest writes atomically and verifies local bytes", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "obsidian-epoch-object-manifest-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await write(root, "09_素材与图片/asset.png", "asset");

  const written = await writeObjectStorageManifest(root);
  assert.deepEqual(await readObjectStorageManifest(root), written);
  assert.deepEqual(await verifyLocalObjectStorageManifest(root), written);
  assert.equal(
    await readFile(path.join(root, OBJECT_STORAGE_MANIFEST_PATH), "utf8"),
    serializeObjectStorageManifest(written),
  );

  await write(root, "09_素材与图片/asset.png", "changed");
  await assert.rejects(() => verifyLocalObjectStorageManifest(root), /object_storage_manifest_local_mismatch/);
});

test("object storage manifest rejects unsorted, duplicated, and inconsistent entries", () => {
  const entry = { path: "asset.png", bytes: 5, sha256: "a".repeat(64) };
  assert.throws(() => validateObjectStorageManifest({
    type: "obsidian_epoch_object_storage_manifest",
    version: 1,
    algorithm: "sha256",
    root: "09_素材与图片",
    selectionPolicy: "exclude_batch_runtime_and_local_metadata",
    objectCount: 2,
    totalBytes: 10,
    objects: [entry, entry],
  }), /paths_not_unique_and_sorted/);
  assert.throws(() => validateObjectStorageManifest({
    type: "obsidian_epoch_object_storage_manifest",
    version: 1,
    algorithm: "sha256",
    root: "09_素材与图片",
    selectionPolicy: "exclude_batch_runtime_and_local_metadata",
    objectCount: 1,
    totalBytes: 6,
    objects: [entry],
  }), /size_mismatch/);
});

test("remote object storage verification checks encoded paths, sizes, and hashes", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "obsidian-epoch-object-manifest-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await write(root, "09_素材与图片/asset.png", "asset");
  await write(root, "09_素材与图片/参考母版/母版.png", "reference");
  await writeObjectStorageManifest(root);
  const bodies = new Map([
    ["https://assets.example/asset.png", "asset"],
    ["https://assets.example/%E5%8F%82%E8%80%83%E6%AF%8D%E7%89%88/%E6%AF%8D%E7%89%88.png", "reference"],
  ]);
  const requested: string[] = [];
  const fetcher: typeof fetch = async (input) => {
    const url = String(input);
    requested.push(url);
    const body = bodies.get(url);
    return body === undefined
      ? new Response("missing", { status: 404 })
      : new Response(body, { status: 200, headers: { "content-length": String(Buffer.byteLength(body)) } });
  };

  const verified = await verifyRemoteObjectStorageManifest("https://assets.example", root, fetcher);
  assert.equal(verified.objectCount, 2);
  assert.deepEqual(requested.sort(), [...bodies.keys()].sort());

  await assert.rejects(
    () => verifyRemoteObjectStorageManifest("http://assets.example", root, fetcher),
    /must_be_public_https/,
  );
  assert.equal(OBJECT_STORAGE_BASE_URL_ENV_VAR, "OBSIDIAN_EPOCH_ASSET_BASE_URL");
});

test("remote object storage verification rejects changed bytes", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "obsidian-epoch-object-manifest-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await write(root, "09_素材与图片/asset.png", "asset");
  await writeObjectStorageManifest(root);
  const fetcher: typeof fetch = async () => new Response("other", {
    status: 200,
    headers: { "content-length": "5" },
  });

  await assert.rejects(
    () => verifyRemoteObjectStorageManifest("https://assets.example/", root, fetcher),
    /object_storage_remote_sha256:asset\.png/,
  );
});
