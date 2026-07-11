import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { verifyReleaseSource } from "../lib/releaseSource.ts";

function git(root: string, ...args: string[]) {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return String(result.stdout).trim();
}

async function cleanRepository(t: test.TestContext) {
  const root = await mkdtemp(path.join(tmpdir(), "obsidian-epoch-release-source-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  git(root, "init", "--quiet");
  git(root, "config", "user.name", "Release Source Test");
  git(root, "config", "user.email", "release-source@example.test");
  await writeFile(path.join(root, "source.txt"), "source\n");
  git(root, "add", "source.txt");
  git(root, "commit", "--quiet", "-m", "test source");
  git(root, "remote", "add", "origin", "git@github.com:example/obsidian-epoch.git");
  return { root, revision: git(root, "rev-parse", "HEAD") };
}

test("release source verification proves clean revision, origin, and tracked inputs", async (t) => {
  const repository = await cleanRepository(t);
  const result = verifyReleaseSource({
    workspaceRoot: repository.root,
    expectedRevision: repository.revision,
    expectedRepositoryUrl: "https://github.com/example/obsidian-epoch",
    requiredPaths: ["source.txt"],
  });

  assert.deepEqual(result, {
    verified: true,
    clean: true,
    revision: repository.revision,
    repositoryUrl: "https://github.com/example/obsidian-epoch",
    trackedFileCount: 1,
    requiredPaths: ["source.txt"],
  });
});

test("release source verification rejects dirty, mismatched, and incomplete repositories", async (t) => {
  const repository = await cleanRepository(t);
  const base = {
    workspaceRoot: repository.root,
    expectedRevision: repository.revision,
    expectedRepositoryUrl: "https://github.com/example/obsidian-epoch",
    requiredPaths: ["source.txt"],
  };

  assert.throws(
    () => verifyReleaseSource({ ...base, expectedRevision: "a".repeat(40) }),
    /release_source_revision_mismatch/,
  );
  assert.throws(
    () => verifyReleaseSource({ ...base, expectedRepositoryUrl: "https://github.com/example/other" }),
    /release_source_repository_mismatch/,
  );
  assert.throws(
    () => verifyReleaseSource({ ...base, requiredPaths: ["missing.txt"] }),
    /release_source_required_paths_untracked:1/,
  );

  await writeFile(path.join(repository.root, "untracked.txt"), "dirty\n");
  assert.throws(() => verifyReleaseSource(base), /release_source_worktree_dirty:1/);
});
