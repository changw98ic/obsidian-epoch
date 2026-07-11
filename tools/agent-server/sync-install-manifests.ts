import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  epochHostConfigFiles,
  epochHostInstallEntries,
} from "./lib/hostInstall.ts";
import { synchronizeObsidianEpochInstallManifest } from "./lib/packageArchive.ts";

const PACKAGE_DIR = path.resolve(import.meta.dirname, "package");
const MANIFEST_PATHS = [
  path.join(PACKAGE_DIR, "install-manifest.json"),
  path.join(PACKAGE_DIR, "obsidian-epoch/assets/install-manifest.json"),
] as const;

async function main() {
  for (const manifestPath of MANIFEST_PATHS) {
    const source = JSON.parse(await readFile(manifestPath, "utf8")) as unknown;
    const synchronized = synchronizeObsidianEpochInstallManifest(source);
    await writeFile(manifestPath, `${JSON.stringify(synchronized, null, 2)}\n`, "utf8");
  }
  const serverBase = "http://127.0.0.1:8787";
  const hostConfigFiles = epochHostConfigFiles(serverBase);
  for (const file of hostConfigFiles) {
    await writeFile(path.join(PACKAGE_DIR, file.path), file.content, "utf8");
  }
  const codexEntry = epochHostInstallEntries(serverBase).find((entry) => entry.host === "Codex");
  const codexPlugin = codexEntry?.configSnippets?.find((snippet) => snippet.label === "Codex plugin manifest");
  const codexMcp = codexEntry?.configSnippets?.find((snippet) => snippet.label === "Codex MCP JSON");
  if (!codexPlugin) throw new Error("codex_plugin_manifest_missing");
  if (!codexMcp) throw new Error("codex_mcp_manifest_missing");
  await writeFile(
    path.join(PACKAGE_DIR, ".codex-plugin/plugin.json"),
    `${JSON.stringify(codexPlugin.body, null, 2)}\n`,
    "utf8",
  );
  await writeFile(
    path.join(PACKAGE_DIR, ".mcp.json"),
    `${JSON.stringify(codexMcp.body, null, 2)}\n`,
    "utf8",
  );
  console.log(`synchronized ${MANIFEST_PATHS.length} install manifests and ${hostConfigFiles.length} host configs`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`install manifest synchronization failed: ${message}`);
  process.exitCode = 1;
});
