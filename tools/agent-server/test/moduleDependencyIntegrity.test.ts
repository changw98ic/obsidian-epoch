import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const libDir = resolve(__dirname, "../lib");
const epochDir = resolve(libDir, "epoch");

function readSource(relativePath: string): string {
  return readFileSync(resolve(__dirname, "..", relativePath), "utf-8");
}

test("mcpTools.ts does not re-export createAgentWorldRuntime", () => {
  const source = readSource("lib/mcpTools.ts");
  const reExportPattern = /export\s*\{[^}]*createAgentWorldRuntime[^}]*\}\s*from\s*["']\.\/mcpRuntimeCore\.ts["']/;
  assert.equal(
    reExportPattern.test(source),
    false,
    "mcpTools.ts must not re-export createAgentWorldRuntime; consumers should import from mcpRuntimeCore.ts directly",
  );
});

test("mcpConstants.ts does not import from mcpRuntimeCore.ts or mcpTools.ts", () => {
  const source = readSource("lib/mcpConstants.ts");
  const importFromRuntimeCore = /import\s+.*from\s*["']\.\/mcpRuntimeCore\.ts["']/;
  const importFromTools = /import\s+.*from\s*["']\.\/mcpTools\.ts["']/;
  assert.equal(
    importFromRuntimeCore.test(source),
    false,
    "mcpConstants.ts must not import from mcpRuntimeCore.ts",
  );
  assert.equal(
    importFromTools.test(source),
    false,
    "mcpConstants.ts must not import from mcpTools.ts",
  );
});

test("gameCoreComposition.ts does not import applyEvent, projectEpochEvents, or uniqueValues from gameCore.ts", () => {
  const source = readSource("lib/epoch/gameCoreComposition.ts");
  const importFromGameCore = /import\s+\{[^}]*\}\s*from\s*["']\.\/gameCore\.ts["']/;
  const match = source.match(importFromGameCore);
  if (match) {
    const importedNames = match[0];
    for (const forbidden of ["applyEvent", "projectEpochEvents", "uniqueValues"]) {
      assert.equal(
        importedNames.includes(forbidden),
        false,
        `gameCoreComposition.ts must not import ${forbidden} from gameCore.ts`,
      );
    }
  }
});
