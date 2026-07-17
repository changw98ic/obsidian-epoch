import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import ts from "typescript";
import { findExplicitAnyViolations } from "./check-no-explicit-any-source";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workspaceRoot = path.resolve(appRoot, "../..");

function loadTypecheckConfig(configName: string) {
  const configPath = path.join(appRoot, configName);
  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  assert.equal(config.error, undefined, ts.flattenDiagnosticMessageText(config.error?.messageText ?? "", "\n"));

  const parsed = ts.parseJsonConfigFileContent(
    config.config,
    ts.sys,
    path.dirname(configPath),
    undefined,
    configPath,
  );
  assert.deepEqual(
    parsed.errors,
    [],
    parsed.errors.map((error) => ts.flattenDiagnosticMessageText(error.messageText, "\n")).join("\n"),
  );
  return parsed;
}

function workspacePaths(fileNames: readonly string[]) {
  return fileNames.map((fileName) => path.relative(workspaceRoot, fileName).split(path.sep).join("/"));
}

function isTestModule(fileName: string) {
  return fileName.includes("/test/") || /\.(?:test|spec)\.(?:ts|tsx)$/.test(fileName);
}

test("web production typecheck enables noImplicitAny and excludes test modules", () => {
  const config = loadTypecheckConfig("tsconfig.json");
  const files = workspacePaths(config.fileNames);

  assert.equal(config.options.noImplicitAny, true);
  assert.ok(files.includes("tools/graph-react-app/src/App.tsx"));
  assert.ok(files.includes("tools/graph-react-app/scripts/copy-data.ts"));
  assert.equal(files.some(isTestModule), false, files.filter(isTestModule).join("\n"));
});

test("agent production typecheck excludes the server test suite", () => {
  const config = loadTypecheckConfig("tsconfig.agent-server.json");
  const files = workspacePaths(config.fileNames);

  assert.equal(config.options.noImplicitAny, true);
  assert.ok(files.includes("tools/agent-server/server.ts"));
  assert.ok(files.includes("tools/agent-server/lib/httpServer.ts"));
  assert.ok(files.includes("tools/agent-server/package/obsidian-epoch/bin/mcp-proxy.ts"));
  assert.equal(files.some(isTestModule), false, files.filter(isTestModule).join("\n"));
});

test("agent audit typecheck covers the changed server regression suites", () => {
  const config = loadTypecheckConfig("tsconfig.agent-tests.json");
  const files = workspacePaths(config.fileNames);

  assert.equal(config.options.noImplicitAny, true);
  assert.equal(config.options.noUncheckedIndexedAccess, false);
  assert.ok(files.includes("tools/agent-server/test/communityQuota.test.ts"));
  assert.ok(files.includes("tools/agent-server/test/communityAuthorityContext.test.ts"));
  assert.ok(files.includes("tools/agent-server/test/communityPersistenceGuard.test.ts"));
  assert.ok(files.includes("tools/agent-server/test/deploy-config.test.ts"));
  assert.ok(files.includes("tools/agent-server/test/server-transport-shutdown.test.ts"));
  assert.ok(files.every(isTestModule), files.filter((file) => !isTestModule(file)).join("\n"));
});

test("dedicated UI test typecheck covers the fast regression suite without broadening production configs", () => {
  const config = loadTypecheckConfig("tsconfig.tests.json");
  const files = workspacePaths(config.fileNames);

  assert.equal(config.options.noImplicitAny, true);
  assert.ok(files.includes("tools/graph-react-app/src/agent/api.test.ts"));
  assert.ok(files.includes("tools/graph-react-app/scripts/typecheck-config.test.ts"));
  assert.equal(files.some((file) => file.startsWith("tools/agent-server/test/")), false);
  assert.equal(files.includes("tools/chatgpt_creature_image_batch_core.test.ts"), false);
  assert.ok(files.some(isTestModule));
});

test("explicit-any gate includes frontend TSX source", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "obsidian-epoch-explicit-any-tsx-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const sourceDir = path.join(root, "tools", "graph-react-app", "src");
  await mkdir(sourceDir, { recursive: true });
  await writeFile(path.join(sourceDir, "unsafe.tsx"), "export const unsafe: any = <div />;\n", "utf8");

  const violations = await findExplicitAnyViolations(root);
  assert.deepEqual(
    violations.map((violation) => violation.file),
    ["tools/graph-react-app/src/unsafe.tsx"],
  );
});
