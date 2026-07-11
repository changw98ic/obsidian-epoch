import path from "node:path";
import { fileURLToPath } from "node:url";
import { verifyReleaseSource } from "./lib/releaseSource.ts";

function valueAfterFlag(args: readonly string[], flag: string) {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

const args = process.argv.slice(2);
const defaultWorkspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

try {
  const result = verifyReleaseSource({
    workspaceRoot: valueAfterFlag(args, "--workspace") || defaultWorkspaceRoot,
    expectedRevision: valueAfterFlag(args, "--revision") || process.env.AGENT_IMAGE_REVISION || "",
    expectedRepositoryUrl: valueAfterFlag(args, "--repository") || process.env.AGENT_IMAGE_SOURCE || "",
  });
  if (args.includes("--json")) console.log(JSON.stringify({ ok: true, ...result }));
  else console.log(
    `Release source verified: revision=${result.revision}; tracked_files=${result.trackedFileCount}; repository=${result.repositoryUrl}`,
  );
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  if (args.includes("--json")) console.log(JSON.stringify({ ok: false, error: message }));
  else console.error(`release source verification failed: ${message}`);
  process.exitCode = 1;
}
