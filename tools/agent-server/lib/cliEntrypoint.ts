import { realpathSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function isDirectEntrypoint(moduleUrl: string, argvEntry = process.argv[1]) {
  if (!argvEntry) return false;
  try {
    return realpathSync.native(fileURLToPath(moduleUrl)) === realpathSync.native(resolve(argvEntry));
  } catch {
    return false;
  }
}
