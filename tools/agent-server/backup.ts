import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import {
  RECOVERY_BACKUP_SIGNING_PRIVATE_KEY_ENV_VAR,
  RECOVERY_BACKUP_SIGNING_PRIVATE_KEY_FILE_ENV_VAR,
  RECOVERY_BACKUP_VERIFICATION_PUBLIC_KEY_ENV_VAR,
  RECOVERY_BACKUP_VERIFICATION_PUBLIC_KEY_FILE_ENV_VAR,
  createRecoveryBackup,
  recoveryBackupVerificationPublicKeysFromConfig,
} from "./lib/recovery.ts";
import { dataDir } from "./lib/store.ts";

function valueAfterFlag(args: readonly string[], flag: string) {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

function hasFlag(args: readonly string[], flag: string) {
  return args.includes(flag);
}

function truthy(value: string | undefined) {
  return /^(1|true|yes|on)$/i.test(value?.trim() || "");
}

async function configuredSigningPrivateKey() {
  const inline = process.env[RECOVERY_BACKUP_SIGNING_PRIVATE_KEY_ENV_VAR]?.trim();
  const filePath = process.env[RECOVERY_BACKUP_SIGNING_PRIVATE_KEY_FILE_ENV_VAR]?.trim();
  if (inline && filePath) throw new Error("recovery_backup_signing_private_key_source_ambiguous");
  if (filePath) return readFile(filePath, "utf8");
  return inline;
}

async function configuredRetentionVerificationPublicKeys() {
  const inline = process.env[RECOVERY_BACKUP_VERIFICATION_PUBLIC_KEY_ENV_VAR]?.trim();
  const filePath = process.env[RECOVERY_BACKUP_VERIFICATION_PUBLIC_KEY_FILE_ENV_VAR]?.trim();
  if (inline && filePath) throw new Error("recovery_backup_verification_public_key_source_ambiguous");
  const configured = filePath ? await readFile(filePath, "utf8") : inline;
  return configured ? recoveryBackupVerificationPublicKeysFromConfig(configured) : undefined;
}

function positiveInteger(value: string | undefined, fallback: number) {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

async function fileExists(filePath: string) {
  try {
    const entry = await stat(filePath);
    return entry.isFile();
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return false;
    throw error;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const baseDataDir = valueAfterFlag(args, "--source")
    || process.env.AGENT_SERVER_DATA_DIR
    || dataDir;
  const explicitSqlitePath = valueAfterFlag(args, "--sqlite")
    || process.env.AGENT_SERVER_SQLITE_PATH;
  const backupRoot = valueAfterFlag(args, "--backup-root")
    || process.env.AGENT_SERVER_BACKUP_DIR
    || join(baseDataDir, "backups");
  const playerMcpTokenJsonlPath = valueAfterFlag(args, "--player-mcp-tokens")
    || process.env.AGENT_SERVER_MCP_PLAYER_TOKEN_JSONL_PATH;
  const keepLast = positiveInteger(
    valueAfterFlag(args, "--keep-last") || process.env.AGENT_SERVER_BACKUP_KEEP_LAST,
    7,
  );
  const jsonlOnly = hasFlag(args, "--jsonl-only");
  const sqliteOnly = hasFlag(args, "--sqlite-only");
  const defaultSqlitePath = join(baseDataDir, "agent-world.sqlite");
  const sqlitePath = jsonlOnly
    ? undefined
    : explicitSqlitePath || (await fileExists(defaultSqlitePath) ? defaultSqlitePath : undefined);
  const signingPrivateKeyPem = await configuredSigningPrivateKey();
  const retentionVerificationPublicKeys = await configuredRetentionVerificationPublicKeys();
  const backup = await createRecoveryBackup({
    sourceDataDir: sqliteOnly ? undefined : baseDataDir,
    sqlitePath,
    playerMcpTokenJsonlPath,
    backupRoot,
    keepLast,
    signingPrivateKeyPem,
    retentionVerificationPublicKeys,
    requireSignature: hasFlag(args, "--require-signature")
      || process.env.NODE_ENV === "production"
      || truthy(process.env.AGENT_SERVER_BACKUP_SIGNATURE_REQUIRED),
  });
  const output = hasFlag(args, "--json")
    ? JSON.stringify(backup)
    : JSON.stringify(backup, null, 2);
  console.log(output);
  if (!backup.ok) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`backup failed: ${message}`);
  process.exitCode = 1;
});
