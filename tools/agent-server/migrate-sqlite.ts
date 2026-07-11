import { join } from "node:path";
import { migrateJsonlDataDirToSqlite } from "./lib/sqliteStore.ts";
import { dataDir } from "./lib/store.ts";

const sourceDataDir = process.env.AGENT_SERVER_DATA_DIR || dataDir;
const dbPath = process.env.AGENT_SERVER_SQLITE_PATH || join(sourceDataDir, "agent-world.sqlite");

migrateJsonlDataDirToSqlite({ sourceDataDir, dbPath })
  .then((summary) => {
    console.log(JSON.stringify(summary, null, 2));
  })
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`sqlite migration failed: ${message}`);
    process.exitCode = 1;
  });
