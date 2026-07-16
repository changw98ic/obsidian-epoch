import {
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

import {
  compileWorldContentRegistry,
  DEFAULT_WORLD_CONTENT_REGISTRY_PATH,
  DEFAULT_WORLD_VAULT_ROOT,
} from "./lib/epoch/worldContentRegistry.ts";

const checkOnly = process.argv.includes("--check");
const positional = process.argv.slice(2).filter((argument) => argument !== "--check");
const vaultRoot = path.resolve(positional[0] || DEFAULT_WORLD_VAULT_ROOT);
const outputPath = path.resolve(positional[1] || DEFAULT_WORLD_CONTENT_REGISTRY_PATH);
const registry = compileWorldContentRegistry(vaultRoot);
const serialized = `${JSON.stringify(registry, null, 2)}\n`;
if (checkOnly) {
  if (readFileSync(outputPath, "utf8") !== serialized) throw new Error("world_content_registry_stale");
  process.stdout.write(`${JSON.stringify({ checked: outputPath, sourceHash: registry.sourceHash, counts: registry.counts })}\n`);
  process.exit(0);
}
const temporaryPath = `${outputPath}.tmp`;
mkdirSync(path.dirname(outputPath), { recursive: true });
writeFileSync(temporaryPath, serialized, "utf8");
renameSync(temporaryPath, outputPath);
process.stdout.write(`${JSON.stringify({ outputPath, sourceHash: registry.sourceHash, counts: registry.counts })}\n`);
