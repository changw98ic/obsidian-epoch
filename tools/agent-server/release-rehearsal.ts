import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runEpochInstallSmoke } from "./install-smoke.ts";
import { isDirectEntrypoint } from "./lib/cliEntrypoint.ts";
import {
  RECOVERY_BACKUP_SIGNING_PRIVATE_KEY_ENV_VAR,
  RECOVERY_BACKUP_SIGNING_PRIVATE_KEY_FILE_ENV_VAR,
  RECOVERY_BACKUP_VERIFICATION_PUBLIC_KEY_ENV_VAR,
  RECOVERY_BACKUP_VERIFICATION_PUBLIC_KEY_FILE_ENV_VAR,
  createRecoveryBackup,
  restoreRecoveryBackup,
  runJsonlToSqliteRecoveryDrill,
  runSqliteRecoveryDrill,
} from "./lib/recovery.ts";
import { OBSIDIAN_EPOCH_PACKAGE_FILE } from "./lib/packageArchive.ts";
import { verifyReleaseSource } from "./lib/releaseSource.ts";
import { dataDir } from "./lib/store.ts";

type JsonRecord = Record<string, unknown>;

export interface ReleaseRehearsalOptions {
  readonly serverBase?: string;
  readonly mcpToken?: string;
  readonly operatorKey?: string;
  readonly production?: boolean;
  readonly requireOperatorSigning?: boolean;
  readonly expectedReleaseKeyId?: string;
  readonly requireExternalConsoleMedia?: boolean;
  readonly expectedConsoleMediaBaseUrl?: string;
  readonly imageDigest?: string;
  readonly imageReference?: string;
  readonly sourceRevision?: string;
  readonly sourceRepositoryUrl?: string;
  readonly sourceWorkspaceRoot?: string;
  readonly sourceDataDir?: string;
  readonly sqlitePath?: string;
  readonly backupRoot?: string;
  readonly restoreTargetDataDir?: string;
  readonly restoreTargetSqlitePath?: string;
  readonly playerMcpTokenJsonlPath?: string;
  readonly restoreTargetPlayerMcpTokenJsonlPath?: string;
  readonly backupSigningPrivateKeyPem?: string;
  readonly backupVerificationPublicKey?: string;
  readonly keepLast?: number;
}

function valueAfterFlag(args: readonly string[], flag: string) {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

function hasFlag(args: readonly string[], flag: string) {
  return args.includes(flag);
}

function positiveInteger(value: string | undefined, fallback: number) {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeServerBase(value: string | undefined) {
  const raw = String(value || "").trim();
  if (!raw) throw new Error("release_rehearsal_server_required");
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error("release_rehearsal_server_invalid");
  }
  if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("release_rehearsal_server_invalid");
  return parsed.toString().replace(/\/+$/, "");
}

function normalizeExpectedReleaseKeyId(value: string | undefined) {
  const keyId = String(value || "").trim().toLowerCase();
  if (!keyId) return undefined;
  if (!/^[a-f0-9]{64}$/.test(keyId)) throw new Error("release_rehearsal_expected_release_key_id_invalid");
  return keyId;
}

function normalizeImageDigest(value: string | undefined) {
  const digest = String(value || "").trim().toLowerCase();
  if (!digest) return undefined;
  if (!/^sha256:[a-f0-9]{64}$/.test(digest)) throw new Error("release_rehearsal_image_digest_invalid");
  return digest;
}

function resultPageIdFromUrl(urlPath: unknown) {
  if (typeof urlPath !== "string") return undefined;
  const pageId = new URL(urlPath, "http://127.0.0.1").pathname.split("/").filter(Boolean).at(-1);
  return pageId || undefined;
}

async function readJsonResponse(response: Response) {
  const payload = await response.json().catch(() => ({}));
  return isRecord(payload) ? payload : {};
}

async function verifyOperatorOverview(serverBase: string, operatorKey: string) {
  const response = await fetch(`${serverBase}/api/epoch/operator/overview`, {
    headers: {
      "x-epoch-operator-key": operatorKey,
    },
  });
  const body = await readJsonResponse(response);
  if (response.status !== 200) {
    const error = typeof body.error === "string" ? body.error : `status_${response.status}`;
    throw new Error(`release_rehearsal_operator_overview_failed:${error}`);
  }
  return {
    verified: true,
    status: response.status,
  };
}

async function defaultRestoreDataDir() {
  return mkdtemp(join(tmpdir(), "epoch-release-rehearsal-restore-jsonl-"));
}

function defaultRestoreSqlitePath() {
  return join(tmpdir(), `epoch-release-rehearsal-restore-${process.pid}-${Date.now()}.sqlite`);
}

function defaultRestorePlayerMcpTokenPath() {
  return join(tmpdir(), `epoch-release-rehearsal-player-tokens-${process.pid}-${Date.now()}.jsonl`);
}

async function configuredRecoveryKey(inlineName: string, fileName: string) {
  const inline = process.env[inlineName]?.trim();
  const filePath = process.env[fileName]?.trim();
  if (inline && filePath) throw new Error(`release_rehearsal_key_source_ambiguous:${inlineName}`);
  if (filePath) return readFile(filePath, "utf8");
  return inline;
}

export async function runEpochReleaseRehearsal(options: ReleaseRehearsalOptions = {}) {
  const production = Boolean(options.production);
  const expectedReleaseKeyId = normalizeExpectedReleaseKeyId(
    options.expectedReleaseKeyId || process.env.AGENT_RELEASE_REHEARSAL_EXPECTED_RELEASE_KEY_ID,
  );
  if (production && !expectedReleaseKeyId) {
    throw new Error("release_rehearsal_expected_release_key_id_required");
  }
  const imageDigest = normalizeImageDigest(
    options.imageDigest || process.env.AGENT_RELEASE_IMAGE_DIGEST,
  );
  if (production && !imageDigest) throw new Error("release_rehearsal_image_digest_required");
  const imageReference = String(
    options.imageReference || process.env.AGENT_RELEASE_IMAGE_REFERENCE || "",
  ).trim() || undefined;
  const operatorKey = options.operatorKey || process.env.AGENT_RELEASE_REHEARSAL_OPERATOR_KEY || process.env.AGENT_SERVER_OPERATOR_KEY;
  if (!operatorKey) throw new Error("release_rehearsal_operator_key_required");

  const serverBase = normalizeServerBase(options.serverBase || process.env.AGENT_WORLD_SERVER);
  const sourceDataDir = options.sourceDataDir || process.env.AGENT_SERVER_DATA_DIR || dataDir;
  const sqlitePath = options.sqlitePath || process.env.AGENT_SERVER_SQLITE_PATH || join(sourceDataDir, "agent-world.sqlite");
  const backupRoot = options.backupRoot || process.env.AGENT_SERVER_BACKUP_DIR || join(sourceDataDir, "backups");
  const restoreTargetDataDir = options.restoreTargetDataDir || process.env.AGENT_SERVER_RESTORE_DATA_DIR || await defaultRestoreDataDir();
  const restoreTargetSqlitePath = options.restoreTargetSqlitePath || process.env.AGENT_SERVER_RESTORE_SQLITE_PATH || defaultRestoreSqlitePath();
  const playerMcpTokenJsonlPath = options.playerMcpTokenJsonlPath
    || process.env.AGENT_SERVER_MCP_PLAYER_TOKEN_JSONL_PATH;
  const restoreTargetPlayerMcpTokenJsonlPath = options.restoreTargetPlayerMcpTokenJsonlPath
    || process.env.AGENT_SERVER_RESTORE_MCP_PLAYER_TOKEN_JSONL_PATH
    || (playerMcpTokenJsonlPath ? defaultRestorePlayerMcpTokenPath() : undefined);
  const backupSigningPrivateKeyPem = options.backupSigningPrivateKeyPem
    || await configuredRecoveryKey(
      RECOVERY_BACKUP_SIGNING_PRIVATE_KEY_ENV_VAR,
      RECOVERY_BACKUP_SIGNING_PRIVATE_KEY_FILE_ENV_VAR,
    );
  const backupVerificationPublicKey = options.backupVerificationPublicKey
    || await configuredRecoveryKey(
      RECOVERY_BACKUP_VERIFICATION_PUBLIC_KEY_ENV_VAR,
      RECOVERY_BACKUP_VERIFICATION_PUBLIC_KEY_FILE_ENV_VAR,
    );
  if (production && !playerMcpTokenJsonlPath) {
    throw new Error("release_rehearsal_player_mcp_token_ledger_required");
  }
  if (production && !backupSigningPrivateKeyPem?.trim()) {
    throw new Error("release_rehearsal_backup_signing_private_key_required");
  }
  if (production && !backupVerificationPublicKey?.trim()) {
    throw new Error("release_rehearsal_backup_verification_public_key_required");
  }
  const keepLast = options.keepLast || positiveInteger(process.env.AGENT_SERVER_BACKUP_KEEP_LAST, 7);
  const releaseSource = production
    ? verifyReleaseSource({
      workspaceRoot: options.sourceWorkspaceRoot
        || process.env.AGENT_RELEASE_SOURCE_WORKSPACE
        || join(import.meta.dirname, "../.."),
      expectedRevision: options.sourceRevision || process.env.AGENT_IMAGE_REVISION || "",
      expectedRepositoryUrl: options.sourceRepositoryUrl || process.env.AGENT_IMAGE_SOURCE || "",
    })
    : undefined;

  const installSmoke = await runEpochInstallSmoke({
    serverBase,
    mcpToken: options.mcpToken,
    production,
    requireOperatorSigning: options.requireOperatorSigning || production,
    expectedReleaseKeyId,
    requireExternalConsoleMedia: options.requireExternalConsoleMedia || production,
    expectedConsoleMediaBaseUrl: options.expectedConsoleMediaBaseUrl,
  });
  const operatorOverview = await verifyOperatorOverview(serverBase, operatorKey);
  const expectedResultPageId = resultPageIdFromUrl(installSmoke.resultPageUrl);
  let recoveryDrill = production
    ? undefined
    : await runJsonlToSqliteRecoveryDrill({
      sourceDataDir,
      sqlitePath,
      expectedAgentId: installSmoke.agentId,
      expectedResultPageId,
    });
  if (recoveryDrill && !recoveryDrill.ok) throw new Error("release_rehearsal_recovery_drill_failed");
  const backup = await createRecoveryBackup({
    sourceDataDir: production ? undefined : sourceDataDir,
    sqlitePath,
    playerMcpTokenJsonlPath,
    backupRoot,
    keepLast,
    signingPrivateKeyPem: backupSigningPrivateKeyPem,
    requireSignature: production,
  });
  if (!backup.ok) throw new Error("release_rehearsal_backup_failed");
  const restore = await restoreRecoveryBackup({
    backupPath: backup.backupPath,
    targetDataDir: production ? undefined : restoreTargetDataDir,
    targetSqlitePath: restoreTargetSqlitePath,
    targetPlayerMcpTokenJsonlPath: restoreTargetPlayerMcpTokenJsonlPath,
    verificationPublicKey: backupVerificationPublicKey,
    trustedCheckpoint: production ? backup.checkpoint : undefined,
    requireSignature: production,
    requireReplayProtection: production,
  });
  if (!restore.ok) throw new Error("release_rehearsal_restore_failed");
  if (production) {
    recoveryDrill = await runSqliteRecoveryDrill({
      sqlitePath: restoreTargetSqlitePath,
      expectedAgentId: installSmoke.agentId,
      expectedResultPageId,
    });
  }
  if (!recoveryDrill?.ok) throw new Error("release_rehearsal_recovery_drill_failed");

  return {
    ok: true,
    serverBase,
    mode: production ? "production" : "rehearsal",
    checks: {
      installSmoke: installSmoke.ok === true,
      operatorOverview: operatorOverview.verified,
      recoveryDrill: recoveryDrill.ok,
      backup: backup.ok,
      restore: restore.ok,
      artifactDigests: /^[a-f0-9]{64}$/.test(installSmoke.packageSha256)
        && (!production || imageDigest !== undefined),
      ...(releaseSource ? { releaseSource: releaseSource.verified } : {}),
    },
    installSmoke: {
      ok: installSmoke.ok,
      mode: installSmoke.mode,
      via: installSmoke.via,
      agentId: installSmoke.agentId,
      resultPageUrl: installSmoke.resultPageUrl,
      webBridgeDeliveryTrust: installSmoke.webBridgeDeliveryTrust,
      webBridgePostResultMutationRejected: installSmoke.webBridgePostResultMutationRejected,
      packageSigningTrust: installSmoke.packageSigningTrust,
      packageReleaseKeyId: installSmoke.packageReleaseKeyId,
      releaseKeyPinned: installSmoke.releaseKeyPinned,
      packageSha256: installSmoke.packageSha256,
      packageBytes: installSmoke.packageBytes,
    },
    artifacts: {
      package: {
        file: OBSIDIAN_EPOCH_PACKAGE_FILE,
        digest: `sha256:${installSmoke.packageSha256}`,
        bytes: installSmoke.packageBytes,
        evidence: "live-package-download",
      },
      image: {
        reference: imageReference || null,
        digest: imageDigest || null,
        evidence: imageDigest ? "operator-supplied-registry-digest" : "not-provided-for-local-rehearsal",
      },
    },
    releaseSource: releaseSource || null,
    operatorOverview,
    recoveryDrill: {
      ok: recoveryDrill.ok,
      sourceManifestSha256: recoveryDrill.source.manifestSha256,
      targetManifestSha256: recoveryDrill.target.manifestSha256,
      migrationRecords: recoveryDrill.migration.records,
      parityOk: recoveryDrill.parity.ok,
      hydrationOk: recoveryDrill.hydration.ok,
      expectedAgentFound: recoveryDrill.hydration.expectedAgent?.found === true,
      expectedResultPageFound: recoveryDrill.hydration.expectedResultPage?.found === true,
    },
    backup: {
      ok: backup.ok,
      backupId: backup.backupId,
      backupPath: backup.backupPath,
      manifestPath: backup.manifestPath,
      fileCount: backup.files.length,
      retention: backup.retention,
      signatureVerified: restore.verification.signature?.verified === true,
      signatureKeyId: restore.verification.signature?.keyId || null,
      replayProtectionVerified: restore.verification.checkpoint?.verified === true,
    },
    restore: {
      ok: restore.ok,
      backupId: restore.backupId,
      jsonlRestored: Boolean(restore.restored.jsonl),
      sqliteRestored: Boolean(restore.restored.sqlite),
      playerMcpTokensRestored: Boolean(restore.restored.playerMcpAccessTokens),
    },
  };
}

function optionsFromArgs(args: readonly string[]): ReleaseRehearsalOptions {
  return {
    serverBase: valueAfterFlag(args, "--server"),
    mcpToken: valueAfterFlag(args, "--mcp-token"),
    operatorKey: valueAfterFlag(args, "--operator-key"),
    production: hasFlag(args, "--production"),
    requireOperatorSigning: hasFlag(args, "--require-operator-signing"),
    expectedReleaseKeyId: valueAfterFlag(args, "--expected-release-key-id"),
    requireExternalConsoleMedia: hasFlag(args, "--require-external-console-media"),
    expectedConsoleMediaBaseUrl: valueAfterFlag(args, "--console-media-base-url"),
    imageDigest: valueAfterFlag(args, "--image-digest"),
    imageReference: valueAfterFlag(args, "--image-reference"),
    sourceRevision: valueAfterFlag(args, "--source-revision"),
    sourceRepositoryUrl: valueAfterFlag(args, "--source-repository"),
    sourceWorkspaceRoot: valueAfterFlag(args, "--source-workspace"),
    sourceDataDir: valueAfterFlag(args, "--source"),
    sqlitePath: valueAfterFlag(args, "--sqlite"),
    backupRoot: valueAfterFlag(args, "--backup-root"),
    restoreTargetDataDir: valueAfterFlag(args, "--restore-target-source"),
    restoreTargetSqlitePath: valueAfterFlag(args, "--restore-target-sqlite"),
    playerMcpTokenJsonlPath: valueAfterFlag(args, "--player-mcp-tokens"),
    restoreTargetPlayerMcpTokenJsonlPath: valueAfterFlag(args, "--restore-target-player-mcp-tokens"),
    backupVerificationPublicKey: valueAfterFlag(args, "--backup-verification-public-key"),
    keepLast: positiveInteger(valueAfterFlag(args, "--keep-last"), 7),
  };
}

if (isDirectEntrypoint(import.meta.url)) {
  const args = process.argv.slice(2);
  runEpochReleaseRehearsal(optionsFromArgs(args))
    .then((result) => {
      if (hasFlag(args, "--json")) {
        console.log(JSON.stringify(result));
      } else {
        console.log(
          `Obsidian Epoch release rehearsal passed: ${result.serverBase} -> ${result.backup.backupId} `
          + `(${result.artifacts.package.digest}, ${result.artifacts.image.digest || "image digest not provided"})`,
        );
      }
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      if (hasFlag(args, "--json")) {
        console.log(JSON.stringify({ ok: false, error: message }));
      } else {
        console.error(`release rehearsal failed: ${message}`);
      }
      process.exitCode = 1;
    });
}
