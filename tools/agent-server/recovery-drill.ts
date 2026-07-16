import { join } from "node:path";
import { runJsonlToSqliteRecoveryDrill } from "./lib/recovery.ts";
import { dataDir } from "./lib/store.ts";

function valueAfterFlag(args: readonly string[], flag: string) {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

function hasFlag(args: readonly string[], flag: string) {
  return args.includes(flag);
}

async function main() {
  const args = process.argv.slice(2);
  const sourceDataDir = valueAfterFlag(args, "--source")
    || process.env.AGENT_SERVER_DATA_DIR
    || dataDir;
  const sqlitePath = valueAfterFlag(args, "--sqlite")
    || process.env.AGENT_SERVER_SQLITE_PATH
    || join(sourceDataDir, "agent-world.sqlite");
  const drill = await runJsonlToSqliteRecoveryDrill({
    sourceDataDir,
    sqlitePath,
    migrate: !hasFlag(args, "--no-migrate"),
    expectedAgentId: valueAfterFlag(args, "--expected-agent"),
    expectedResultPageId: valueAfterFlag(args, "--expected-result-page"),
  });
  const output = hasFlag(args, "--json")
    ? JSON.stringify(drill)
    : JSON.stringify(drill, null, 2);
  console.log(output);
  if (!drill.ok) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`recovery drill failed: ${message}`);
  process.exitCode = 1;
});
