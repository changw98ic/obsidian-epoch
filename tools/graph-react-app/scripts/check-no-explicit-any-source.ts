import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workspaceRoot = path.resolve(appRoot, "../..");

const sourceRoots = [
  "tools/agent-server",
  "tools/graph-react-app/src",
  "tools/graph-react-app/scripts",
];

const ignoredDirectoryNames = new Set([
  ".git",
  ".obsidian",
  ".omc",
  ".omx",
  "node_modules",
  "__pycache__",
  "dist",
  "test",
]);

const dynamicBoundaryAllowlist = new Set<string>();

export interface ExplicitAnyViolation {
  readonly file: string;
  readonly line: number;
  readonly column: number;
}

function relativeUnix(root: string, current: string) {
  return path.relative(root, current).split(path.sep).join("/");
}

async function pathExists(current: string) {
  try {
    await fs.access(current);
    return true;
  } catch {
    return false;
  }
}

async function walk(root: string, dir: string, files: string[]) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const current = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (ignoredDirectoryNames.has(entry.name)) continue;
      await walk(root, current, files);
      continue;
    }
    if (entry.isFile() && (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx"))) {
      const relativePath = relativeUnix(root, current);
      if (!dynamicBoundaryAllowlist.has(relativePath)) files.push(current);
    }
  }
}

function collectAnyKeywords(root: string, file: string, sourceText: string): ExplicitAnyViolation[] {
  const scriptKind = file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(file, sourceText, ts.ScriptTarget.Latest, true, scriptKind);
  const violations: ExplicitAnyViolation[] = [];

  function visit(node: ts.Node) {
    if (node.kind === ts.SyntaxKind.AnyKeyword) {
      const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
      violations.push({
        file: relativeUnix(root, file),
        line: position.line + 1,
        column: position.character + 1,
      });
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return violations;
}

export async function findExplicitAnyViolations(root = workspaceRoot): Promise<ExplicitAnyViolation[]> {
  const files: string[] = [];
  for (const sourceRoot of sourceRoots) {
    const absoluteRoot = path.join(root, sourceRoot);
    if (await pathExists(absoluteRoot)) await walk(root, absoluteRoot, files);
  }

  const violations: ExplicitAnyViolation[] = [];
  for (const file of files) {
    violations.push(...collectAnyKeywords(root, file, await fs.readFile(file, "utf8")));
  }
  return violations;
}

const entryPoint = process.argv[1];

if (entryPoint && import.meta.url === pathToFileURL(entryPoint).href) {
  const root = process.argv[2] ? path.resolve(process.argv[2]) : workspaceRoot;
  const violations = await findExplicitAnyViolations(root);

  if (violations.length) {
    console.error("Explicit any is not allowed in production TypeScript source:");
    for (const violation of violations) {
      console.error(`- ${violation.file}:${violation.line}:${violation.column}`);
    }
    process.exit(1);
  }

  console.log("No explicit any in production TypeScript source.");
}
