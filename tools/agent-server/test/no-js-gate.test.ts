import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

test("no-JS gate does not blindly ignore every directory named data", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "no-js-gate-"));
  try {
    const dataDir = path.join(root, "feature", "data");
    await mkdir(dataDir, { recursive: true });
    await writeFile(path.join(dataDir, "leak.js"), "console.log('forbidden')\n", "utf8");

    const result = spawnSync(process.execPath, [
      "--import",
      "tsx",
      "scripts/check-no-js-source.ts",
      root,
    ], {
      cwd: new URL("../../graph-react-app/", import.meta.url),
      encoding: "utf8",
    });

    assert.notEqual(result.status, 0);
    assert.match(`${result.stderr}\n${result.stdout}`, /feature\/data\/leak\.js/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("no-JS gate rejects CommonJS source files", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "no-cjs-gate-"));
  try {
    const toolDir = path.join(root, "tools", "agent-server", "lib");
    await mkdir(toolDir, { recursive: true });
    await writeFile(path.join(toolDir, "legacy.cjs"), "module.exports = {}\n", "utf8");

    const result = spawnSync(process.execPath, [
      "--import",
      "tsx",
      "scripts/check-no-js-source.ts",
      root,
    ], {
      cwd: new URL("../../graph-react-app/", import.meta.url),
      encoding: "utf8",
    });

    assert.notEqual(result.status, 0);
    assert.match(`${result.stderr}\n${result.stdout}`, /tools\/agent-server\/lib\/legacy\.cjs/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("no-JS gate allows generated exported Vite chunks only under overview assets", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "no-js-export-assets-"));
  try {
    const exportDir = path.join(root, "00_总览", "assets");
    const sourceAssetDir = path.join(root, "tools", "graph-react-app", "src", "assets");
    await mkdir(exportDir, { recursive: true });
    await mkdir(sourceAssetDir, { recursive: true });
    await writeFile(path.join(exportDir, "index-generated.js"), "console.log('generated')\n", "utf8");
    await writeFile(path.join(sourceAssetDir, "leak.js"), "console.log('forbidden')\n", "utf8");

    const result = spawnSync(process.execPath, [
      "--import",
      "tsx",
      "scripts/check-no-js-source.ts",
      root,
    ], {
      cwd: new URL("../../graph-react-app/", import.meta.url),
      encoding: "utf8",
    });

    assert.notEqual(result.status, 0);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.doesNotMatch(output, /00_总览\/assets\/index-generated\.js/);
    assert.match(output, /tools\/graph-react-app\/src\/assets\/leak\.js/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("explicit-any gate reports production TypeScript outside dynamic boundaries", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "no-explicit-any-gate-"));
  try {
    const sourceDir = path.join(root, "tools", "agent-server", "lib");
    await mkdir(sourceDir, { recursive: true });
    await writeFile(path.join(sourceDir, "unsafe.ts"), "export type Unsafe = any;\n", "utf8");

    const result = spawnSync(process.execPath, [
      "--import",
      "tsx",
      "scripts/check-no-explicit-any-source.ts",
      root,
    ], {
      cwd: new URL("../../graph-react-app/", import.meta.url),
      encoding: "utf8",
    });

    assert.notEqual(result.status, 0);
    assert.match(`${result.stderr}\n${result.stdout}`, /tools\/agent-server\/lib\/unsafe\.ts:1:22/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("explicit-any gate covers persistence boundary source files", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "no-explicit-any-persistence-"));
  try {
    const libDir = path.join(root, "tools", "agent-server", "lib");
    await mkdir(libDir, { recursive: true });
    await writeFile(path.join(libDir, "store.ts"), "export type StoreLeak = any;\n", "utf8");
    await writeFile(path.join(libDir, "sqliteStore.ts"), "export function leak(value: any) { return value; }\n", "utf8");

    const result = spawnSync(process.execPath, [
      "--import",
      "tsx",
      "scripts/check-no-explicit-any-source.ts",
      root,
    ], {
      cwd: new URL("../../graph-react-app/", import.meta.url),
      encoding: "utf8",
    });

    assert.notEqual(result.status, 0);
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(output, /tools\/agent-server\/lib\/store\.ts:1:25/);
    assert.match(output, /tools\/agent-server\/lib\/sqliteStore\.ts:1:29/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("explicit-any gate covers MCP tool dispatch source file", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "no-explicit-any-mcp-tools-"));
  try {
    const libDir = path.join(root, "tools", "agent-server", "lib");
    await mkdir(libDir, { recursive: true });
    await writeFile(path.join(libDir, "mcpTools.ts"), "export function dispatch(args: any) { return args; }\n", "utf8");

    const result = spawnSync(process.execPath, [
      "--import",
      "tsx",
      "scripts/check-no-explicit-any-source.ts",
      root,
    ], {
      cwd: new URL("../../graph-react-app/", import.meta.url),
      encoding: "utf8",
    });

    assert.notEqual(result.status, 0);
    assert.match(`${result.stderr}\n${result.stdout}`, /tools\/agent-server\/lib\/mcpTools\.ts:1:32/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("explicit-any gate covers HTTP server boundary source file", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "no-explicit-any-http-server-"));
  try {
    const libDir = path.join(root, "tools", "agent-server", "lib");
    await mkdir(libDir, { recursive: true });
    await writeFile(path.join(libDir, "httpServer.ts"), "export type RequestLeak = Record<string, any>;\n", "utf8");

    const result = spawnSync(process.execPath, [
      "--import",
      "tsx",
      "scripts/check-no-explicit-any-source.ts",
      root,
    ], {
      cwd: new URL("../../graph-react-app/", import.meta.url),
      encoding: "utf8",
    });

    assert.notEqual(result.status, 0);
    assert.match(`${result.stderr}\n${result.stdout}`, /tools\/agent-server\/lib\/httpServer\.ts:1:42/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("explicit-any gate covers install smoke source file", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "no-explicit-any-install-smoke-"));
  try {
    const serverDir = path.join(root, "tools", "agent-server");
    await mkdir(serverDir, { recursive: true });
    await writeFile(path.join(serverDir, "install-smoke.ts"), "export type SmokeLeak = Record<string, any>;\n", "utf8");

    const result = spawnSync(process.execPath, [
      "--import",
      "tsx",
      "scripts/check-no-explicit-any-source.ts",
      root,
    ], {
      cwd: new URL("../../graph-react-app/", import.meta.url),
      encoding: "utf8",
    });

    assert.notEqual(result.status, 0);
    assert.match(`${result.stderr}\n${result.stdout}`, /tools\/agent-server\/install-smoke\.ts:1:40/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("explicit-any gate covers Epoch runtime source file", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "no-explicit-any-epoch-runtime-"));
  try {
    const epochDir = path.join(root, "tools", "agent-server", "lib", "epoch");
    await mkdir(epochDir, { recursive: true });
    await writeFile(path.join(epochDir, "runtime.ts"), "export type RuntimeLeak = Record<string, any>;\n", "utf8");

    const result = spawnSync(process.execPath, [
      "--import",
      "tsx",
      "scripts/check-no-explicit-any-source.ts",
      root,
    ], {
      cwd: new URL("../../graph-react-app/", import.meta.url),
      encoding: "utf8",
    });

    assert.notEqual(result.status, 0);
    assert.match(`${result.stderr}\n${result.stdout}`, /tools\/agent-server\/lib\/epoch\/runtime\.ts:1:42/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
