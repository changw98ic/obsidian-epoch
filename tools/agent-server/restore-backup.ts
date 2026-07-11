import { readFile } from "node:fs/promises";
import {
  RECOVERY_BACKUP_VERIFICATION_PUBLIC_KEY_ENV_VAR,
  RECOVERY_BACKUP_VERIFICATION_PUBLIC_KEY_FILE_ENV_VAR,
  RECOVERY_BACKUP_TRUSTED_CHECKPOINT_FILE_ENV_VAR,
  recoveryBackupTrustedCheckpointFromConfig,
  recoveryBackupVerificationPublicKeysFromConfig,
  restoreRecoveryBackup,
} from "./lib/recovery.ts";

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

async function configuredVerificationPublicKeys() {
  const inline = process.env[RECOVERY_BACKUP_VERIFICATION_PUBLIC_KEY_ENV_VAR]?.trim();
  const filePath = process.env[RECOVERY_BACKUP_VERIFICATION_PUBLIC_KEY_FILE_ENV_VAR]?.trim();
  if (inline && filePath) throw new Error("recovery_backup_verification_public_key_source_ambiguous");
  const configured = filePath ? await readFile(filePath, "utf8") : inline;
  return configured ? recoveryBackupVerificationPublicKeysFromConfig(configured) : undefined;
}

async function configuredTrustedCheckpoint(args: readonly string[]) {
  const filePath = valueAfterFlag(args, "--trusted-checkpoint")
    || process.env[RECOVERY_BACKUP_TRUSTED_CHECKPOINT_FILE_ENV_VAR]?.trim();
  if (!filePath) return undefined;
  return recoveryBackupTrustedCheckpointFromConfig(await readFile(filePath, "utf8"));
}

async function main() {
  const args = process.argv.slice(2);
  const backupPath = valueAfterFlag(args, "--backup") || process.env.AGENT_SERVER_RESTORE_BACKUP;
  if (!backupPath) {
    throw new Error("restore_backup_required");
  }
  const verificationPublicKey = valueAfterFlag(args, "--verification-public-key");
  const verificationPublicKeys = verificationPublicKey ? undefined : await configuredVerificationPublicKeys();
  const trustedCheckpoint = await configuredTrustedCheckpoint(args);
  const restore = await restoreRecoveryBackup({
    backupPath,
    targetDataDir: valueAfterFlag(args, "--target-source") || process.env.AGENT_SERVER_RESTORE_DATA_DIR,
    targetSqlitePath: valueAfterFlag(args, "--target-sqlite") || process.env.AGENT_SERVER_RESTORE_SQLITE_PATH,
    targetPlayerMcpTokenJsonlPath: valueAfterFlag(args, "--target-player-mcp-tokens")
      || process.env.AGENT_SERVER_RESTORE_MCP_PLAYER_TOKEN_JSONL_PATH,
    verificationPublicKey,
    verificationPublicKeys,
    trustedCheckpoint,
    requireSignature: hasFlag(args, "--require-signature")
      || process.env.NODE_ENV === "production"
      || truthy(process.env.AGENT_SERVER_BACKUP_SIGNATURE_REQUIRED),
    requireReplayProtection: hasFlag(args, "--require-replay-protection")
      || process.env.NODE_ENV === "production"
      || truthy(process.env.AGENT_SERVER_BACKUP_REPLAY_PROTECTION_REQUIRED),
  });
  const output = hasFlag(args, "--json")
    ? JSON.stringify(restore)
    : JSON.stringify(restore, null, 2);
  console.log(output);
  if (!restore.ok) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`restore failed: ${message}`);
  process.exitCode = 1;
});
