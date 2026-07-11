import {
  createHash,
  createPrivateKey,
  createPublicKey,
  randomUUID,
  sign as signPayload,
  verify as verifyPayload,
} from "node:crypto";
import { copyFile, lstat, mkdir, readdir, readFile, realpath, rename, rm, stat, writeFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { epochEventsFromPersistenceRecord } from "./epochPersistence.ts";
import { createAgentWorldRuntime } from "./mcpTools.ts";
import {
  validatePlayerMcpAccessTokenLedgerContent,
} from "./playerMcpAccessTokenStore.ts";
import {
  KNOWN_JSONL_FILES,
  loadAgentRuntimeOptionsFromSqlite,
  migrateJsonlDataDirToSqlite,
  readSqliteJsonlRecords,
  type SqliteMigrationSummary,
} from "./sqliteStore.ts";

type JsonRecord = Record<string, unknown>;
type KnownJsonlFileName = typeof KNOWN_JSONL_FILES[number];

export type RecoveryStatus = "ok" | "unavailable" | "error";
export type RecoveryStoreKind = "memory" | "jsonl" | "sqlite";
export const RECOVERY_BACKUP_SIGNING_PRIVATE_KEY_ENV_VAR = "AGENT_SERVER_BACKUP_SIGNING_PRIVATE_KEY_PEM";
export const RECOVERY_BACKUP_SIGNING_PRIVATE_KEY_FILE_ENV_VAR = "AGENT_SERVER_BACKUP_SIGNING_PRIVATE_KEY_FILE";
export const RECOVERY_BACKUP_VERIFICATION_PUBLIC_KEY_ENV_VAR = "AGENT_SERVER_BACKUP_VERIFICATION_PUBLIC_KEY";
export const RECOVERY_BACKUP_VERIFICATION_PUBLIC_KEY_FILE_ENV_VAR = "AGENT_SERVER_BACKUP_VERIFICATION_PUBLIC_KEY_FILE";
export const RECOVERY_BACKUP_TRUSTED_CHECKPOINT_FILE_ENV_VAR = "AGENT_SERVER_BACKUP_TRUSTED_CHECKPOINT_FILE";
export const RECOVERY_BACKUP_SIGNATURE_ALGORITHM = "Ed25519";

export interface RecoveryFileSummary {
  readonly fileName: KnownJsonlFileName;
  readonly records: number;
  readonly bytes: number;
  readonly sha256: string;
  readonly latestRecordType?: string;
  readonly latestEpochEventId?: string;
  readonly latestCreatedAt?: string;
}

export interface RecoveryManifest {
  readonly status: RecoveryStatus;
  readonly storeKind: RecoveryStoreKind;
  readonly persistent: boolean;
  readonly generatedAt: string;
  readonly records: number;
  readonly files: Record<KnownJsonlFileName, RecoveryFileSummary>;
  readonly epochEvents: {
    readonly records: number;
    readonly latestEventId?: string;
    readonly latestCreatedAt?: string;
  };
  readonly resultPages: {
    readonly records: number;
    readonly latestPageId?: string;
    readonly latestCreatedAt?: string;
  };
  readonly manifestSha256: string;
  readonly sqlitePath?: string;
  readonly dataDir?: string;
}

export interface RecoveryDrillSummary {
  readonly ok: boolean;
  readonly source: RecoveryManifest;
  readonly target: RecoveryManifest;
  readonly migration: SqliteMigrationSummary;
  readonly parity: {
    readonly ok: boolean;
    readonly mismatches: readonly string[];
  };
  readonly hydration: {
    readonly ok: boolean;
    readonly epochEvents: number;
    readonly resultPages: number;
    readonly latestEventId?: string;
    readonly latestResultPageId?: string;
    readonly expectedAgent?: {
      readonly agentId: string;
      readonly identityName?: string;
      readonly found: boolean;
    };
    readonly expectedResultPage?: {
      readonly pageId: string;
      readonly found: boolean;
    };
  };
}

export interface RecoveryDrillOptions {
  readonly sourceDataDir: string;
  readonly sqlitePath: string;
  readonly generatedAt?: Date;
  readonly migrate?: boolean;
  readonly expectedAgentId?: string;
  readonly expectedResultPageId?: string;
}

export interface SqliteRecoveryDrillOptions {
  readonly sqlitePath: string;
  readonly generatedAt?: Date;
  readonly expectedAgentId?: string;
  readonly expectedResultPageId?: string;
}

export interface RecoveryBackupFileSummary {
  readonly relativePath: string;
  readonly sourcePath: string;
  readonly bytes: number;
  readonly sha256: string;
}

export interface RecoveryAuxiliaryJsonlSummary extends RecoveryBackupFileSummary {
  readonly records: number;
}

export interface RecoveryBackupSignature {
  readonly type: "obsidian_epoch_recovery_backup_signature";
  readonly version: 1;
  readonly algorithm: typeof RECOVERY_BACKUP_SIGNATURE_ALGORITHM;
  readonly keyId: string;
  readonly manifestFile: "recovery-backup.json";
  readonly manifestBytes: number;
  readonly manifestSha256: string;
  readonly signature: string;
}

export interface RecoveryBackupTrustedCheckpoint {
  readonly type: "obsidian_epoch_recovery_backup_checkpoint";
  readonly version: 1;
  readonly backupId: string;
  readonly generatedAt: string;
  readonly manifestSha256: string;
  readonly keyId: string;
}

export interface RecoveryBackupSummary {
  readonly ok: boolean;
  readonly backupId: string;
  readonly backupPath: string;
  readonly manifestPath: string;
  readonly generatedAt: string;
  readonly sourceDataDir?: string;
  readonly sqlitePath?: string;
  readonly files: readonly RecoveryBackupFileSummary[];
  readonly auxiliary?: {
    readonly playerMcpAccessTokens?: RecoveryAuxiliaryJsonlSummary;
  };
  readonly manifests: {
    readonly jsonl?: {
      readonly source: RecoveryManifest;
      readonly backup: RecoveryManifest;
    };
    readonly sqlite?: {
      readonly source: RecoveryManifest;
      readonly backup: RecoveryManifest;
    };
  };
  readonly signature?: RecoveryBackupSignature;
  readonly checkpoint?: RecoveryBackupTrustedCheckpoint;
  readonly retention: {
    readonly keepLast: number;
    readonly kept: readonly string[];
    readonly removed: readonly string[];
  };
}

type MutableRecoveryBackupManifests = {
  jsonl?: {
    source: RecoveryManifest;
    backup: RecoveryManifest;
  };
  sqlite?: {
    source: RecoveryManifest;
    backup: RecoveryManifest;
  };
};

export interface RecoveryBackupOptions {
  readonly sourceDataDir?: string;
  readonly sqlitePath?: string;
  readonly playerMcpTokenJsonlPath?: string;
  readonly backupRoot: string;
  readonly generatedAt?: Date;
  readonly keepLast?: number;
  readonly signingPrivateKeyPem?: string;
  readonly retentionVerificationPublicKeys?: readonly string[];
  readonly requireSignature?: boolean;
}

export interface RecoveryRestoreSummary {
  readonly ok: boolean;
  readonly backupId: string;
  readonly backupPath: string;
  readonly manifestPath: string;
  readonly generatedAt: string;
  readonly verification: {
    readonly ok: boolean;
    readonly files: readonly RecoveryBackupFileSummary[];
    readonly signature?: {
      readonly verified: true;
      readonly algorithm: typeof RECOVERY_BACKUP_SIGNATURE_ALGORITHM;
      readonly keyId: string;
      readonly manifestSha256: string;
    };
    readonly checkpoint?: {
      readonly verified: true;
      readonly minimumBackupId: string;
      readonly minimumGeneratedAt: string;
    };
  };
  readonly restored: {
    readonly jsonl?: {
      readonly targetDataDir: string;
      readonly manifest: RecoveryManifest;
    };
    readonly sqlite?: {
      readonly targetSqlitePath: string;
      readonly manifest: RecoveryManifest;
    };
    readonly playerMcpAccessTokens?: {
      readonly targetPath: string;
      readonly records: number;
      readonly bytes: number;
      readonly sha256: string;
    };
  };
}

type MutableRecoveryRestoreTargets = {
  jsonl?: {
    targetDataDir: string;
    manifest: RecoveryManifest;
  };
  sqlite?: {
    targetSqlitePath: string;
    manifest: RecoveryManifest;
  };
  playerMcpAccessTokens?: {
    targetPath: string;
    records: number;
    bytes: number;
    sha256: string;
  };
};

export interface RecoveryRestoreOptions {
  readonly backupPath: string;
  readonly targetDataDir?: string;
  readonly targetSqlitePath?: string;
  readonly targetPlayerMcpTokenJsonlPath?: string;
  readonly generatedAt?: Date;
  readonly verificationPublicKey?: string;
  readonly verificationPublicKeys?: readonly string[];
  readonly trustedCheckpoint?: RecoveryBackupTrustedCheckpoint;
  readonly requireSignature?: boolean;
  readonly requireReplayProtection?: boolean;
}

function sha256(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

function normalizedKeyMaterial(value: string) {
  const trimmed = value.trim();
  let normalized = trimmed;
  if (normalized.startsWith('"')) {
    try {
      const parsed: unknown = JSON.parse(normalized);
      if (typeof parsed === "string") normalized = parsed;
    } catch {
      normalized = trimmed;
    }
  } else if (normalized.startsWith("'") && normalized.endsWith("'")) {
    normalized = normalized.slice(1, -1);
  }
  return normalized.replaceAll("\\n", "\n");
}

function recoveryBackupPrivateKey(value: string) {
  let privateKey;
  try {
    privateKey = createPrivateKey(normalizedKeyMaterial(value));
  } catch {
    throw new Error("recovery_backup_signing_private_key_invalid");
  }
  if (privateKey.asymmetricKeyType !== "ed25519") {
    throw new Error("recovery_backup_signing_private_key_must_be_ed25519");
  }
  return privateKey;
}

function recoveryBackupPublicKey(value: string) {
  const normalized = normalizedKeyMaterial(value);
  let publicKey;
  try {
    publicKey = normalized.includes("BEGIN PUBLIC KEY")
      ? createPublicKey(normalized)
      : createPublicKey({ key: Buffer.from(normalized, "base64"), type: "spki", format: "der" });
  } catch {
    throw new Error("recovery_backup_verification_public_key_invalid");
  }
  if (publicKey.asymmetricKeyType !== "ed25519") {
    throw new Error("recovery_backup_verification_public_key_must_be_ed25519");
  }
  return publicKey;
}

export function recoveryBackupVerificationPublicKeysFromConfig(value: string) {
  const trimmed = value.trim();
  if (!trimmed.startsWith("{")) return trimmed ? [trimmed] : [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed) as unknown;
  } catch {
    throw new Error("recovery_backup_verification_keyring_invalid_json");
  }
  const record = ensureJsonRecord(parsed, "recovery_backup_verification_keyring");
  if (record.version !== 1 || !Array.isArray(record.keys) || record.keys.length === 0) {
    throw new Error("recovery_backup_verification_keyring_invalid");
  }
  const seen = new Set<string>();
  return record.keys.map((entry, index) => {
    const key = ensureJsonRecord(entry, `recovery_backup_verification_keyring.keys[${index}]`);
    const configuredKeyId = stringField(key, "keyId");
    const publicKey = stringField(key, "publicKey");
    const status = stringField(key, "status");
    if (!configuredKeyId || !/^[a-f0-9]{64}$/.test(configuredKeyId) || !publicKey) {
      throw new Error("recovery_backup_verification_keyring_key_invalid");
    }
    if (status !== undefined && status !== "active" && status !== "retired") {
      throw new Error("recovery_backup_verification_keyring_key_invalid");
    }
    const parsedPublicKey = recoveryBackupPublicKey(publicKey);
    const actualKeyId = recoveryBackupKeyMetadata(parsedPublicKey).keyId;
    if (configuredKeyId !== actualKeyId) {
      throw new Error("recovery_backup_verification_keyring_key_id_mismatch");
    }
    if (seen.has(actualKeyId)) {
      throw new Error("recovery_backup_verification_keyring_key_duplicate");
    }
    seen.add(actualKeyId);
    return publicKey;
  });
}

const RECOVERY_BACKUP_MANIFEST_FILE = "recovery-backup.json";
const RECOVERY_BACKUP_SIGNATURE_FILE = "recovery-backup.signature.json";
const RECOVERY_BACKUP_SIGNATURE_DOMAIN = Buffer.from("obsidian-epoch/recovery-backup-manifest/v1\0", "utf8");
const MAX_RECOVERY_BACKUP_MANIFEST_BYTES = 1_048_576;
const MAX_RECOVERY_BACKUP_SIGNATURE_BYTES = 16_384;

function recoveryBackupKeyMetadata(publicKey: ReturnType<typeof createPublicKey>) {
  const publicKeyDer = publicKey.export({ type: "spki", format: "der" });
  return {
    publicKey: publicKeyDer.toString("base64"),
    keyId: sha256(publicKeyDer),
  };
}

function recoveryBackupSignedPayload(manifestBytes: Buffer) {
  return Buffer.concat([RECOVERY_BACKUP_SIGNATURE_DOMAIN, manifestBytes]);
}

function createRecoveryBackupSignature(manifestBytes: Buffer, signingPrivateKeyPem: string): RecoveryBackupSignature {
  const privateKey = recoveryBackupPrivateKey(signingPrivateKeyPem);
  const publicKey = createPublicKey(normalizedKeyMaterial(signingPrivateKeyPem));
  const key = recoveryBackupKeyMetadata(publicKey);
  return {
    type: "obsidian_epoch_recovery_backup_signature",
    version: 1,
    algorithm: RECOVERY_BACKUP_SIGNATURE_ALGORITHM,
    keyId: key.keyId,
    manifestFile: RECOVERY_BACKUP_MANIFEST_FILE,
    manifestBytes: manifestBytes.byteLength,
    manifestSha256: sha256(manifestBytes),
    signature: signPayload(null, recoveryBackupSignedPayload(manifestBytes), privateKey).toString("base64"),
  };
}

function recoveryBackupSignatureFromEnvelope(value: unknown) {
  if (value === undefined) return undefined;
  const record = ensureJsonRecord(value, RECOVERY_BACKUP_SIGNATURE_FILE);
  const type = stringField(record, "type");
  const algorithm = stringField(record, "algorithm");
  const keyId = stringField(record, "keyId");
  const manifestFile = stringField(record, "manifestFile");
  const manifestSha256 = stringField(record, "manifestSha256");
  const manifestBytes = record.manifestBytes;
  const signature = stringField(record, "signature");
  if (
    type !== "obsidian_epoch_recovery_backup_signature"
    || record.version !== 1
    || algorithm !== RECOVERY_BACKUP_SIGNATURE_ALGORITHM
    || manifestFile !== RECOVERY_BACKUP_MANIFEST_FILE
    || !Number.isSafeInteger(manifestBytes)
    || Number(manifestBytes) <= 0
    || !keyId
    || !manifestSha256
    || !signature
    || !/^[a-f0-9]{64}$/.test(keyId)
    || !/^[a-f0-9]{64}$/.test(manifestSha256)
  ) {
    throw new Error("recovery_backup_signature_invalid");
  }
  return {
    type,
    version: 1,
    algorithm,
    keyId,
    manifestFile,
    manifestBytes: Number(manifestBytes),
    manifestSha256,
    signature,
  } satisfies RecoveryBackupSignature;
}

export function recoveryBackupTrustedCheckpointFromConfig(value: string): RecoveryBackupTrustedCheckpoint {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value) as unknown;
  } catch {
    throw new Error("recovery_backup_trusted_checkpoint_invalid_json");
  }
  const record = ensureJsonRecord(parsed, "recovery_backup_trusted_checkpoint");
  const backupId = stringField(record, "backupId");
  const generatedAt = stringField(record, "generatedAt");
  const manifestSha256 = stringField(record, "manifestSha256");
  const keyId = stringField(record, "keyId");
  if (
    record.type !== "obsidian_epoch_recovery_backup_checkpoint"
    || record.version !== 1
    || !backupId
    || !generatedAt
    || !Number.isFinite(Date.parse(generatedAt))
    || !manifestSha256
    || !/^[a-f0-9]{64}$/.test(manifestSha256)
    || !keyId
    || !/^[a-f0-9]{64}$/.test(keyId)
  ) {
    throw new Error("recovery_backup_trusted_checkpoint_invalid");
  }
  return {
    type: "obsidian_epoch_recovery_backup_checkpoint",
    version: 1,
    backupId,
    generatedAt,
    manifestSha256,
    keyId,
  };
}

function recoveryBackupCheckpoint(
  backupId: string,
  generatedAt: string,
  signature: RecoveryBackupSignature,
): RecoveryBackupTrustedCheckpoint {
  return {
    type: "obsidian_epoch_recovery_backup_checkpoint",
    version: 1,
    backupId,
    generatedAt,
    manifestSha256: signature.manifestSha256,
    keyId: signature.keyId,
  };
}

function verifyRecoveryBackupCheckpoint({
  backupId,
  generatedAt,
  signature,
  trustedCheckpoint,
  requireReplayProtection,
}: {
  readonly backupId: string;
  readonly generatedAt: string;
  readonly signature: RecoveryBackupSignature | undefined;
  readonly trustedCheckpoint: RecoveryBackupTrustedCheckpoint | undefined;
  readonly requireReplayProtection: boolean;
}) {
  if (!trustedCheckpoint) {
    if (requireReplayProtection) throw new Error("recovery_backup_trusted_checkpoint_required");
    return undefined;
  }
  if (!signature) throw new Error("recovery_backup_signature_required_for_checkpoint");
  const candidateTime = Date.parse(generatedAt);
  const minimumTime = Date.parse(trustedCheckpoint.generatedAt);
  if (!Number.isFinite(candidateTime) || !Number.isFinite(minimumTime)) {
    throw new Error("recovery_backup_trusted_checkpoint_invalid");
  }
  if (candidateTime < minimumTime) throw new Error("recovery_backup_rollback_detected");
  if (
    candidateTime === minimumTime
    && (
      backupId !== trustedCheckpoint.backupId
      || signature.keyId !== trustedCheckpoint.keyId
      || signature.manifestSha256 !== trustedCheckpoint.manifestSha256
    )
  ) {
    throw new Error("recovery_backup_checkpoint_mismatch");
  }
  return {
    verified: true,
    minimumBackupId: trustedCheckpoint.backupId,
    minimumGeneratedAt: trustedCheckpoint.generatedAt,
  } as const;
}

function verifyRecoveryBackupSignature(
  manifestBytes: Buffer,
  signature: RecoveryBackupSignature | undefined,
  verificationPublicKeys: readonly string[] | undefined,
  requireSignature: boolean,
) {
  if (!signature) {
    if (requireSignature) throw new Error("recovery_backup_signature_required");
    return undefined;
  }
  if (!verificationPublicKeys?.length) {
    throw new Error("recovery_backup_verification_public_key_required");
  }
  const trustedKeys = new Map<string, ReturnType<typeof recoveryBackupPublicKey>>();
  for (const configuredKey of verificationPublicKeys) {
    const publicKey = recoveryBackupPublicKey(configuredKey);
    trustedKeys.set(recoveryBackupKeyMetadata(publicKey).keyId, publicKey);
  }
  const publicKey = trustedKeys.get(signature.keyId);
  if (!publicKey) {
    throw new Error("recovery_backup_signature_key_mismatch");
  }
  if (manifestBytes.byteLength !== signature.manifestBytes || sha256(manifestBytes) !== signature.manifestSha256) {
    throw new Error("recovery_backup_signature_manifest_mismatch");
  }
  if (!verifyPayload(
    null,
    recoveryBackupSignedPayload(manifestBytes),
    publicKey,
    Buffer.from(signature.signature, "base64"),
  )) {
    throw new Error("recovery_backup_signature_verification_failed");
  }
  return {
    verified: true,
    algorithm: RECOVERY_BACKUP_SIGNATURE_ALGORITHM,
    keyId: signature.keyId,
    manifestSha256: signature.manifestSha256,
  } as const;
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function recordField(record: JsonRecord | undefined, key: string) {
  const value = record?.[key];
  return isRecord(value) ? value : undefined;
}

function stringField(record: JsonRecord | undefined, key: string) {
  const value = record?.[key];
  return typeof value === "string" ? value : undefined;
}

function ensureJsonRecord(value: unknown, source: string) {
  if (!isRecord(value)) throw new Error(`recovery_record_object_required:${source}`);
  return value;
}

function canonicalJsonl(records: readonly JsonRecord[]) {
  return records.length ? `${records.map((record) => JSON.stringify(record)).join("\n")}\n` : "";
}

function logicalFileRecords(fileName: KnownJsonlFileName, records: readonly JsonRecord[]) {
  if (fileName !== "epoch-events.jsonl") return records;
  return records.flatMap((record) => epochEventsFromPersistenceRecord(record)
    .map((event) => ({ type: "epoch_event", event })));
}

function createdAtFromRecord(record: JsonRecord | undefined) {
  if (!record) return undefined;
  return stringField(record, "createdAt")
    || stringField(record, "submittedAt")
    || stringField(recordField(record, "event"), "createdAt")
    || stringField(recordField(record, "page"), "createdAt");
}

function epochEventIdFromRecord(record: JsonRecord | undefined) {
  return stringField(recordField(record, "event"), "eventId");
}

function resultPageIdFromRecord(record: JsonRecord | undefined) {
  return stringField(recordField(record, "page"), "pageId");
}

function fileSummary(fileName: KnownJsonlFileName, records: readonly JsonRecord[]): RecoveryFileSummary {
  const logicalRecords = logicalFileRecords(fileName, records);
  const latestRecord = logicalRecords.at(-1);
  const latestEpochEvent = [...logicalRecords].reverse().find((record) => epochEventIdFromRecord(record));
  const content = canonicalJsonl(logicalRecords);
  return {
    fileName,
    records: logicalRecords.length,
    bytes: Buffer.byteLength(content, "utf8"),
    sha256: sha256(content),
    latestRecordType: stringField(latestRecord, "type"),
    latestEpochEventId: epochEventIdFromRecord(latestEpochEvent),
    latestCreatedAt: createdAtFromRecord(latestRecord),
  };
}

function buildManifest(input: {
  readonly storeKind: "jsonl" | "sqlite";
  readonly generatedAt: Date;
  readonly files: Record<KnownJsonlFileName, readonly JsonRecord[]>;
  readonly sqlitePath?: string;
  readonly dataDir?: string;
}): RecoveryManifest {
  const fileSummaries = Object.fromEntries(KNOWN_JSONL_FILES.map((fileName) => [
    fileName,
    fileSummary(fileName, input.files[fileName] || []),
  ])) as Record<KnownJsonlFileName, RecoveryFileSummary>;
  const records = Object.values(fileSummaries).reduce((total, file) => total + file.records, 0);
  const epochEventRecords = logicalFileRecords("epoch-events.jsonl", input.files["epoch-events.jsonl"] || []);
  const latestEpochRecord = [...epochEventRecords]
    .reverse()
    .find((record) => epochEventIdFromRecord(record));
  const resultPageRecords = input.files["result-pages.jsonl"] || [];
  const latestResultPage = [...resultPageRecords]
    .reverse()
    .find((record) => resultPageIdFromRecord(record));
  const contentProof = {
    files: fileSummaries,
    records,
    epochEvents: {
      records: epochEventRecords.length,
      latestEventId: epochEventIdFromRecord(latestEpochRecord),
      latestCreatedAt: createdAtFromRecord(latestEpochRecord),
    },
    resultPages: {
      records: resultPageRecords.length,
      latestPageId: resultPageIdFromRecord(latestResultPage),
      latestCreatedAt: createdAtFromRecord(latestResultPage),
    },
  };
  return {
    status: "ok",
    storeKind: input.storeKind,
    persistent: true,
    generatedAt: input.generatedAt.toISOString(),
    ...contentProof,
    manifestSha256: sha256(JSON.stringify(contentProof)),
    sqlitePath: input.sqlitePath,
    dataDir: input.dataDir,
  };
}

async function readJsonlRecords(sourceDataDir: string, fileName: KnownJsonlFileName): Promise<JsonRecord[]> {
  try {
    const raw = await readFile(join(sourceDataDir, fileName), "utf8");
    return raw
      .split("\n")
      .filter(Boolean)
      .map((line) => ensureJsonRecord(JSON.parse(line) as unknown, fileName));
  } catch (error) {
    if (isRecord(error) && error.code === "ENOENT") return [];
    throw error;
  }
}

function emptyRecoveryFileMap(): Record<KnownJsonlFileName, readonly JsonRecord[]> {
  return {
    "tickets.jsonl": [],
    "runs.jsonl": [],
    "lore.jsonl": [],
    "progression.jsonl": [],
    "factions.jsonl": [],
    "community.jsonl": [],
    "experience.jsonl": [],
    "transparency.jsonl": [],
    "epoch-events.jsonl": [],
    "result-pages.jsonl": [],
    "context-snapshots.jsonl": [],
    "outbox.jsonl": [],
  };
}

async function readJsonlRecoveryFiles(sourceDataDir: string) {
  const files = emptyRecoveryFileMap();
  await Promise.all(KNOWN_JSONL_FILES.map(async (fileName) => {
    files[fileName] = await readJsonlRecords(sourceDataDir, fileName);
  }));
  return files;
}

function readSqliteRecoveryFiles(dbPath: string) {
  const files = emptyRecoveryFileMap();
  for (const fileName of KNOWN_JSONL_FILES) {
    files[fileName] = readSqliteJsonlRecords(dbPath, fileName)
      .map((record) => ensureJsonRecord(record, fileName));
  }
  return files;
}

export async function createJsonlRecoveryManifest(
  sourceDataDir: string,
  generatedAt = new Date(),
): Promise<RecoveryManifest> {
  const files = await readJsonlRecoveryFiles(sourceDataDir);
  return buildManifest({
    storeKind: "jsonl",
    generatedAt,
    files,
    dataDir: sourceDataDir,
  });
}

export async function createSqliteRecoveryManifest(
  dbPath: string,
  generatedAt = new Date(),
): Promise<RecoveryManifest> {
  const files = readSqliteRecoveryFiles(dbPath);
  return buildManifest({
    storeKind: "sqlite",
    generatedAt,
    files,
    sqlitePath: dbPath,
  });
}

export function unavailableRecoveryManifest(storeKind: RecoveryStoreKind): RecoveryManifest {
  const files = Object.fromEntries(KNOWN_JSONL_FILES.map((fileName) => [
    fileName,
    fileSummary(fileName, []),
  ])) as Record<KnownJsonlFileName, RecoveryFileSummary>;
  const contentProof = {
    files,
    records: 0,
    epochEvents: { records: 0 },
    resultPages: { records: 0 },
  };
  return {
    status: "unavailable",
    storeKind,
    persistent: false,
    generatedAt: new Date(0).toISOString(),
    ...contentProof,
    manifestSha256: sha256(JSON.stringify(contentProof)),
  };
}

function parityMismatches(source: RecoveryManifest, target: RecoveryManifest) {
  const mismatches: string[] = [];
  for (const fileName of KNOWN_JSONL_FILES) {
    const sourceFile = source.files[fileName];
    const targetFile = target.files[fileName];
    if (sourceFile.records !== targetFile.records) {
      mismatches.push(`${fileName}:records:${sourceFile.records}:${targetFile.records}`);
    }
    if (sourceFile.sha256 !== targetFile.sha256) {
      mismatches.push(`${fileName}:sha256:${sourceFile.sha256}:${targetFile.sha256}`);
    }
  }
  if (source.manifestSha256 !== target.manifestSha256) {
    mismatches.push(`manifest:${source.manifestSha256}:${target.manifestSha256}`);
  }
  return mismatches;
}

function emptyMigrationSummary(sqlitePath: string): SqliteMigrationSummary {
  return {
    dbPath: sqlitePath,
    records: 0,
    files: Object.fromEntries(KNOWN_JSONL_FILES.map((fileName) => [fileName, 0])),
  };
}

function arrayField(record: JsonRecord, key: string) {
  const value = record[key];
  return Array.isArray(value) ? value : [];
}

function backupIdFromDate(date: Date) {
  return date.toISOString().replace(/[:.]/g, "-");
}

function normalizeKeepLast(value: number | undefined) {
  return Math.max(1, Math.floor(Number.isFinite(value) ? Number(value) : 7));
}

async function fileExists(filePath: string) {
  try {
    const entry = await stat(filePath);
    return entry.isFile();
  } catch (error) {
    if (isRecord(error) && error.code === "ENOENT") return false;
    throw error;
  }
}

async function pathExists(targetPath: string) {
  try {
    await lstat(targetPath);
    return true;
  } catch (error) {
    if (isRecord(error) && error.code === "ENOENT") return false;
    throw error;
  }
}

const ALLOWED_JSONL_BACKUP_PATHS = new Set<string>(
  KNOWN_JSONL_FILES.map((fileName) => `jsonl/${fileName}`),
);
const PLAYER_MCP_TOKEN_BACKUP_PATH = "auxiliary/player-mcp-access-tokens.jsonl";

function validateBackupRelativePath(relativePath: string) {
  const segments = relativePath.split("/");
  const isSqlitePath = segments.length === 2
    && segments[0] === "sqlite"
    && segments[1] !== ""
    && segments[1] !== "."
    && segments[1] !== "..";
  const allowed = ALLOWED_JSONL_BACKUP_PATHS.has(relativePath)
    || relativePath === PLAYER_MCP_TOKEN_BACKUP_PATH
    || isSqlitePath;
  if (
    !allowed
    || isAbsolute(relativePath)
    || relativePath.includes("\\")
    || segments.some((segment) => segment === "" || segment === "." || segment === "..")
  ) {
    throw new Error(`recovery_backup_relative_path_invalid:${relativePath}`);
  }
}

function isContainedPath(rootPath: string, candidatePath: string) {
  const relativePath = relative(rootPath, candidatePath);
  return relativePath === ""
    || (!isAbsolute(relativePath) && relativePath !== ".." && !relativePath.startsWith(`..${sep}`));
}

async function resolveBackupRegularFile(
  backupPath: string,
  relativePath: string,
  validateLayout = true,
) {
  if (validateLayout) validateBackupRelativePath(relativePath);
  const rootPath = await realpath(backupPath);
  const candidatePath = resolve(rootPath, relativePath);
  if (!isContainedPath(rootPath, candidatePath)) {
    throw new Error(`recovery_backup_file_outside_root:${relativePath}`);
  }
  const entry = await lstat(candidatePath);
  if (entry.isSymbolicLink()) {
    throw new Error(`recovery_backup_file_symlink:${relativePath}`);
  }
  if (!entry.isFile()) {
    throw new Error(`recovery_backup_file_not_regular:${relativePath}`);
  }
  const resolvedPath = await realpath(candidatePath);
  if (!isContainedPath(rootPath, resolvedPath)) {
    throw new Error(`recovery_backup_file_outside_root:${relativePath}`);
  }
  return candidatePath;
}

async function backupFileSummary({
  backupPath,
  relativePath,
  sourcePath,
}: {
  readonly backupPath: string;
  readonly relativePath: string;
  readonly sourcePath: string;
}): Promise<RecoveryBackupFileSummary> {
  const content = await readFile(join(backupPath, relativePath));
  return {
    relativePath,
    sourcePath,
    bytes: content.byteLength,
    sha256: sha256(content),
  };
}

async function readValidatedPlayerMcpTokenLedger(ledgerPath: string) {
  const content = await readFile(ledgerPath);
  const validation = validatePlayerMcpAccessTokenLedgerContent(content.toString("utf8"));
  return {
    content,
    records: validation.records,
    issuedExplorerIds: validation.issuedExplorerIds,
  };
}

async function backupPlayerMcpAccessTokenLedger({
  sourcePath,
  backupPath,
}: {
  readonly sourcePath: string;
  readonly backupPath: string;
}): Promise<RecoveryAuxiliaryJsonlSummary & { readonly issuedExplorerIds: readonly string[] }> {
  if (!await fileExists(sourcePath)) {
    throw new Error(`player_mcp_access_token_ledger_not_found:${sourcePath}`);
  }
  const { content, records } = await readValidatedPlayerMcpTokenLedger(sourcePath);
  const relativePath = PLAYER_MCP_TOKEN_BACKUP_PATH;
  const targetPath = join(backupPath, relativePath);
  await mkdir(dirname(targetPath), { recursive: true });
  await writeFile(targetPath, content, { mode: 0o600 });
  const validatedBackup = await readValidatedPlayerMcpTokenLedger(targetPath);
  if (validatedBackup.records !== records) {
    throw new Error("player_mcp_access_token_ledger_backup_mismatch");
  }
  return {
    relativePath,
    sourcePath,
    records,
    bytes: content.byteLength,
    sha256: sha256(content),
    issuedExplorerIds: validatedBackup.issuedExplorerIds,
  };
}

function backupFileFromRecord(value: unknown) {
  const record = ensureJsonRecord(value, "recovery-backup.files[]");
  const relativePath = stringField(record, "relativePath");
  const sourcePath = stringField(record, "sourcePath") || "";
  const sha = stringField(record, "sha256");
  const bytes = record.bytes;
  if (
    !relativePath
    || !sha
    || !Number.isSafeInteger(bytes)
    || Number(bytes) < 0
    || !/^[a-f0-9]{64}$/.test(sha)
  ) {
    throw new Error("recovery_backup_file_invalid");
  }
  return {
    relativePath,
    sourcePath,
    bytes: Number(bytes),
    sha256: sha,
  };
}

function playerMcpAccessTokenLedgerFromManifest(manifest: JsonRecord) {
  const auxiliary = recordField(manifest, "auxiliary");
  const record = recordField(auxiliary, "playerMcpAccessTokens");
  if (!record) return undefined;
  const file = backupFileFromRecord(record);
  const records = record.records;
  if (!Number.isSafeInteger(records) || Number(records) < 0) {
    throw new Error("recovery_backup_player_mcp_access_token_ledger_invalid");
  }
  return {
    ...file,
    records: Number(records),
  } satisfies RecoveryAuxiliaryJsonlSummary;
}

function validateRecoveryBackupConsistency(manifest: JsonRecord) {
  const consistency = recordField(manifest, "consistency");
  if (!consistency) throw new Error("recovery_backup_consistency_proof_missing");
  const mode = stringField(consistency, "mode");
  const authoritativeStoreKind = stringField(consistency, "authoritativeStoreKind");
  const worldManifestSha256 = stringField(consistency, "worldManifestSha256");
  const verifiedAt = stringField(consistency, "verifiedAt");
  const manifests = recordField(manifest, "manifests");
  const jsonl = recordField(manifests, "jsonl");
  const sqlite = recordField(manifests, "sqlite");
  const expectedStoreKind = sqlite ? (jsonl ? "dual" : "sqlite") : "jsonl";
  const authoritative = recordField(sqlite || jsonl, "backup");
  const expectedWorldManifestSha256 = stringField(authoritative, "manifestSha256");
  const jsonlWorldManifestSha256 = stringField(recordField(jsonl, "backup"), "manifestSha256");
  const sqliteWorldManifestSha256 = stringField(recordField(sqlite, "backup"), "manifestSha256");
  const playerMcpAccessTokens = recordField(recordField(manifest, "auxiliary"), "playerMcpAccessTokens");
  const expectedPlayerTokenSha256 = stringField(playerMcpAccessTokens, "sha256") || null;
  if (
    mode !== "token_before_after_world"
    || authoritativeStoreKind !== expectedStoreKind
    || !worldManifestSha256
    || worldManifestSha256 !== expectedWorldManifestSha256
    || (expectedStoreKind === "dual" && jsonlWorldManifestSha256 !== sqliteWorldManifestSha256)
    || !verifiedAt
    || consistency.playerTokenLedgerSha256 !== expectedPlayerTokenSha256
  ) {
    throw new Error("recovery_backup_consistency_proof_invalid");
  }
}

function validateBackupFileEntries(files: readonly RecoveryBackupFileSummary[]) {
  const seen = new Set<string>();
  let sqliteFiles = 0;
  for (const file of files) {
    validateBackupRelativePath(file.relativePath);
    if (seen.has(file.relativePath)) {
      throw new Error(`recovery_backup_file_duplicate:${file.relativePath}`);
    }
    seen.add(file.relativePath);
    if (file.relativePath.startsWith("sqlite/")) sqliteFiles += 1;
  }
  if (sqliteFiles > 1) throw new Error("recovery_backup_sqlite_file_duplicate");
}

async function readOptionalRecoveryBackupSignature(backupPath: string) {
  const candidatePath = join(backupPath, RECOVERY_BACKUP_SIGNATURE_FILE);
  if (!await pathExists(candidatePath)) return undefined;
  const signaturePath = await resolveBackupRegularFile(backupPath, RECOVERY_BACKUP_SIGNATURE_FILE, false);
  const signatureBytes = await readFile(signaturePath);
  if (signatureBytes.byteLength > MAX_RECOVERY_BACKUP_SIGNATURE_BYTES) {
    throw new Error("recovery_backup_signature_too_large");
  }
  return recoveryBackupSignatureFromEnvelope(JSON.parse(signatureBytes.toString("utf8")) as unknown);
}

async function readRecoveryBackupManifest(backupPath: string, validateBackupId = true) {
  const manifestPath = await resolveBackupRegularFile(backupPath, RECOVERY_BACKUP_MANIFEST_FILE, false);
  const manifestBytes = await readFile(manifestPath);
  if (manifestBytes.byteLength > MAX_RECOVERY_BACKUP_MANIFEST_BYTES) {
    throw new Error("recovery_backup_manifest_too_large");
  }
  const manifest = ensureJsonRecord(
    JSON.parse(manifestBytes.toString("utf8")) as unknown,
    RECOVERY_BACKUP_MANIFEST_FILE,
  );
  const legacy = manifest.type === undefined && manifest.version === undefined;
  if (!legacy && (manifest.type !== "obsidian_epoch_recovery_backup" || manifest.version !== 2)) {
    throw new Error("recovery_backup_manifest_version_unsupported");
  }
  if (!legacy) validateRecoveryBackupConsistency(manifest);
  const backupId = stringField(manifest, "backupId");
  const generatedAt = stringField(manifest, "generatedAt");
  const files = manifest.files;
  if (manifest.ok !== true || !backupId || !generatedAt || !Array.isArray(files)) {
    throw new Error("recovery_backup_manifest_invalid");
  }
  if (validateBackupId && backupId !== basename(resolve(backupPath))) {
    throw new Error("recovery_backup_id_path_mismatch");
  }
  const parsedFiles = files.map(backupFileFromRecord);
  validateBackupFileEntries(parsedFiles);
  const signature = await readOptionalRecoveryBackupSignature(backupPath);
  const playerMcpAccessTokens = playerMcpAccessTokenLedgerFromManifest(manifest);
  if (playerMcpAccessTokens && !parsedFiles.some((file) => (
    file.relativePath === playerMcpAccessTokens.relativePath
    && file.bytes === playerMcpAccessTokens.bytes
    && file.sha256 === playerMcpAccessTokens.sha256
  ))) {
    throw new Error("recovery_backup_player_mcp_access_token_ledger_unlisted");
  }
  return {
    backupId,
    generatedAt,
    manifestPath,
    manifestBytes,
    legacy,
    raw: {
      ...manifest,
      backupPath,
      manifestPath,
      files: parsedFiles,
      signature,
      retention: { keepLast: 1, kept: [backupId], removed: [] },
    } as unknown as RecoveryBackupSummary,
    files: parsedFiles,
    playerMcpAccessTokens,
    signature,
  };
}

async function verifyBackupFiles(backupPath: string, files: readonly RecoveryBackupFileSummary[]) {
  const verified: RecoveryBackupFileSummary[] = [];
  for (const file of files) {
    const filePath = await resolveBackupRegularFile(backupPath, file.relativePath);
    const content = await readFile(filePath);
    const actual = {
      relativePath: file.relativePath,
      sourcePath: file.sourcePath,
      bytes: content.byteLength,
      sha256: sha256(content),
    };
    if (actual.bytes !== file.bytes || actual.sha256 !== file.sha256) {
      throw new Error(`recovery_backup_file_hash_mismatch:${file.relativePath}`);
    }
    verified.push(actual);
  }
  return {
    ok: true,
    files: verified,
  };
}

async function copyJsonlRestoreFiles({
  backupPath,
  targetDataDir,
  files,
}: {
  readonly backupPath: string;
  readonly targetDataDir: string;
  readonly files: readonly RecoveryBackupFileSummary[];
}) {
  if (await pathExists(targetDataDir)) {
    throw new Error(`restore_target_exists:${targetDataDir}`);
  }
  await mkdir(targetDataDir, { recursive: true });
  const listedPaths = new Set(files.map((file) => file.relativePath));
  for (const fileName of KNOWN_JSONL_FILES) {
    const relativePath = `jsonl/${fileName}`;
    if (!listedPaths.has(relativePath)) continue;
    const sourcePath = await resolveBackupRegularFile(backupPath, relativePath);
    await copyFile(sourcePath, join(targetDataDir, fileName));
  }
}

function sqliteBackupRelativePath(files: readonly RecoveryBackupFileSummary[]) {
  return files.find((file) => file.relativePath.startsWith("sqlite/"))?.relativePath;
}

async function copySqliteRestoreFile({
  backupPath,
  targetSqlitePath,
  files,
}: {
  readonly backupPath: string;
  readonly targetSqlitePath: string;
  readonly files: readonly RecoveryBackupFileSummary[];
}) {
  if (await pathExists(targetSqlitePath)) {
    throw new Error(`restore_target_exists:${targetSqlitePath}`);
  }
  const relativePath = sqliteBackupRelativePath(files);
  if (!relativePath) {
    throw new Error("restore_backup_sqlite_missing");
  }
  await mkdir(dirname(targetSqlitePath), { recursive: true });
  const sourcePath = await resolveBackupRegularFile(backupPath, relativePath);
  await copyFile(sourcePath, targetSqlitePath);
}

async function copyPlayerMcpAccessTokenRestoreFile({
  backupPath,
  targetPath,
  manifest,
}: {
  readonly backupPath: string;
  readonly targetPath: string;
  readonly manifest: RecoveryAuxiliaryJsonlSummary;
}) {
  if (await pathExists(targetPath)) {
    throw new Error(`restore_target_exists:${targetPath}`);
  }
  const sourcePath = await resolveBackupRegularFile(backupPath, manifest.relativePath);
  const content = await readFile(sourcePath);
  await mkdir(dirname(targetPath), { recursive: true });
  await writeFile(targetPath, content, { mode: 0o600 });
  try {
    const validated = await readValidatedPlayerMcpTokenLedger(targetPath);
    const restored = {
      targetPath,
      records: validated.records,
      bytes: validated.content.byteLength,
      sha256: sha256(validated.content),
    };
    if (
      restored.records !== manifest.records
      || restored.bytes !== manifest.bytes
      || restored.sha256 !== manifest.sha256
    ) {
      throw new Error("restore_backup_player_mcp_access_token_ledger_mismatch");
    }
    return restored;
  } catch (error) {
    await rm(targetPath, { force: true });
    throw error;
  }
}

function restoreOk(input: RecoveryRestoreSummary["restored"], backup: RecoveryBackupSummary) {
  const jsonlOk = !input.jsonl
    || !backup.manifests.jsonl
    || input.jsonl.manifest.manifestSha256 === backup.manifests.jsonl.backup.manifestSha256;
  const sqliteOk = !input.sqlite
    || !backup.manifests.sqlite
    || input.sqlite.manifest.manifestSha256 === backup.manifests.sqlite.backup.manifestSha256;
  const expectedPlayerTokens = backup.auxiliary?.playerMcpAccessTokens;
  const playerTokensOk = !expectedPlayerTokens || (
    input.playerMcpAccessTokens?.records === expectedPlayerTokens.records
    && input.playerMcpAccessTokens.bytes === expectedPlayerTokens.bytes
    && input.playerMcpAccessTokens.sha256 === expectedPlayerTokens.sha256
  );
  return jsonlOk && sqliteOk && playerTokensOk;
}

function restoreStagingPath(targetPath: string, restoreId: string) {
  return join(dirname(targetPath), `.${basename(targetPath)}.restore-${restoreId}`);
}

export async function restoreRecoveryBackup({
  backupPath,
  targetDataDir,
  targetSqlitePath,
  targetPlayerMcpTokenJsonlPath,
  generatedAt = new Date(),
  verificationPublicKey,
  verificationPublicKeys,
  trustedCheckpoint,
  requireSignature = false,
  requireReplayProtection = false,
}: RecoveryRestoreOptions): Promise<RecoveryRestoreSummary> {
  if (!targetDataDir && !targetSqlitePath && !targetPlayerMcpTokenJsonlPath) {
    throw new Error("restore_target_required");
  }
  if (verificationPublicKey && verificationPublicKeys?.length) {
    throw new Error("recovery_backup_verification_public_key_source_ambiguous");
  }
  const trustedPublicKeys = verificationPublicKeys?.length
    ? verificationPublicKeys
    : verificationPublicKey
      ? [verificationPublicKey]
      : undefined;
  const manifest = await readRecoveryBackupManifest(backupPath);
  const signature = verifyRecoveryBackupSignature(
    manifest.manifestBytes,
    manifest.signature,
    trustedPublicKeys,
    requireSignature,
  );
  const checkpoint = verifyRecoveryBackupCheckpoint({
    backupId: manifest.backupId,
    generatedAt: manifest.generatedAt,
    signature: manifest.signature,
    trustedCheckpoint,
    requireReplayProtection,
  });
  const fileVerification = await verifyBackupFiles(backupPath, manifest.files);
  const verification = {
    ...fileVerification,
    ...(signature ? { signature } : {}),
    ...(checkpoint ? { checkpoint } : {}),
  };
  const restored: MutableRecoveryRestoreTargets = {};
  const playerMcpTokenTargetPath = targetPlayerMcpTokenJsonlPath
    || (targetDataDir && manifest.playerMcpAccessTokens
      ? join(targetDataDir, "player-mcp-access-tokens.jsonl")
      : undefined);
  if (targetPlayerMcpTokenJsonlPath && !manifest.playerMcpAccessTokens) {
    throw new Error("restore_backup_player_mcp_access_token_ledger_missing");
  }
  if (manifest.playerMcpAccessTokens && !playerMcpTokenTargetPath) {
    throw new Error("restore_player_mcp_access_token_target_required");
  }
  for (const targetPath of [targetDataDir, targetSqlitePath, playerMcpTokenTargetPath]) {
    if (targetPath && await pathExists(targetPath)) throw new Error(`restore_target_exists:${targetPath}`);
  }
  const tokenInsideDataDir = Boolean(
    targetDataDir
    && playerMcpTokenTargetPath
    && !targetPlayerMcpTokenJsonlPath,
  );
  if (
    targetDataDir
    && targetPlayerMcpTokenJsonlPath
    && isContainedPath(resolve(targetDataDir), resolve(targetPlayerMcpTokenJsonlPath))
  ) {
    throw new Error("restore_target_overlap");
  }
  const restoreId = randomUUID();
  const stagingDataDir = targetDataDir ? restoreStagingPath(targetDataDir, restoreId) : undefined;
  const stagingSqlitePath = targetSqlitePath ? restoreStagingPath(targetSqlitePath, restoreId) : undefined;
  const stagingPlayerTokenPath = playerMcpTokenTargetPath
    ? (tokenInsideDataDir && stagingDataDir
      ? join(stagingDataDir, basename(playerMcpTokenTargetPath))
      : restoreStagingPath(playerMcpTokenTargetPath, restoreId))
    : undefined;
  const published: string[] = [];
  try {
    if (targetDataDir && stagingDataDir) {
      await copyJsonlRestoreFiles({ backupPath, targetDataDir: stagingDataDir, files: manifest.files });
      const restoredManifest = await createJsonlRecoveryManifest(stagingDataDir, generatedAt);
      restored.jsonl = {
        targetDataDir,
        manifest: { ...restoredManifest, dataDir: targetDataDir },
      };
    }
    if (targetSqlitePath && stagingSqlitePath) {
      await copySqliteRestoreFile({
        backupPath,
        targetSqlitePath: stagingSqlitePath,
        files: manifest.files,
      });
      const restoredManifest = await createSqliteRecoveryManifest(stagingSqlitePath, generatedAt);
      restored.sqlite = {
        targetSqlitePath,
        manifest: { ...restoredManifest, sqlitePath: targetSqlitePath },
      };
    }
    if (manifest.playerMcpAccessTokens && playerMcpTokenTargetPath && stagingPlayerTokenPath) {
      const restoredTokens = await copyPlayerMcpAccessTokenRestoreFile({
        backupPath,
        targetPath: stagingPlayerTokenPath,
        manifest: manifest.playerMcpAccessTokens,
      });
      restored.playerMcpAccessTokens = {
        ...restoredTokens,
        targetPath: playerMcpTokenTargetPath,
      };
    }
    if (!verification.ok || !restoreOk(restored, manifest.raw)) {
      throw new Error("restore_backup_verification_failed");
    }
    if (stagingDataDir && targetDataDir) {
      await rename(stagingDataDir, targetDataDir);
      published.push(targetDataDir);
    }
    if (stagingSqlitePath && targetSqlitePath) {
      await rename(stagingSqlitePath, targetSqlitePath);
      published.push(targetSqlitePath);
    }
    if (stagingPlayerTokenPath && playerMcpTokenTargetPath && !tokenInsideDataDir) {
      await rename(stagingPlayerTokenPath, playerMcpTokenTargetPath);
      published.push(playerMcpTokenTargetPath);
    }
    return {
      ok: true,
      backupId: manifest.backupId,
      backupPath,
      manifestPath: manifest.manifestPath,
      generatedAt: generatedAt.toISOString(),
      verification,
      restored,
    };
  } catch (error) {
    for (const targetPath of [stagingDataDir, stagingSqlitePath, stagingPlayerTokenPath, ...published]) {
      if (targetPath) await rm(targetPath, { recursive: true, force: true });
    }
    throw error;
  }
}

async function copyJsonlBackupFiles({
  sourceDataDir,
  backupPath,
}: {
  readonly sourceDataDir: string;
  readonly backupPath: string;
}) {
  const files: RecoveryBackupFileSummary[] = [];
  const jsonlBackupDir = join(backupPath, "jsonl");
  await mkdir(jsonlBackupDir, { recursive: true });
  for (const fileName of KNOWN_JSONL_FILES) {
    const sourcePath = join(sourceDataDir, fileName);
    if (!await fileExists(sourcePath)) continue;
    const relativePath = join("jsonl", fileName);
    await copyFile(sourcePath, join(backupPath, relativePath));
    files.push(await backupFileSummary({ backupPath, relativePath, sourcePath }));
  }
  return files;
}

function explorerIdsFromEpochPersistenceRecords(records: readonly JsonRecord[]) {
  const explorerIds = new Set<string>();
  for (const record of records) {
    for (const event of epochEventsFromPersistenceRecord(record)) {
      if (event.eventType !== "identity_issued") continue;
      const payload = isRecord(event.payload) ? event.payload : undefined;
      const explorerId = stringField(payload, "explorerId");
      if (explorerId) explorerIds.add(explorerId);
    }
  }
  return explorerIds;
}

async function backupWorldExplorerIds({
  jsonlBackupDir,
  sqliteBackupPath,
}: {
  readonly jsonlBackupDir?: string;
  readonly sqliteBackupPath?: string;
}) {
  if (sqliteBackupPath) {
    return explorerIdsFromEpochPersistenceRecords(
      readSqliteJsonlRecords(sqliteBackupPath, "epoch-events.jsonl"),
    );
  }
  if (jsonlBackupDir) {
    return explorerIdsFromEpochPersistenceRecords(
      await readJsonlRecords(jsonlBackupDir, "epoch-events.jsonl"),
    );
  }
  return new Set<string>();
}

function sqlStringLiteral(value: string) {
  return `'${value.replace(/'/g, "''")}'`;
}

async function snapshotSqliteBackupFile({
  sqlitePath,
  backupPath,
}: {
  readonly sqlitePath: string;
  readonly backupPath: string;
}) {
  if (!await fileExists(sqlitePath)) {
    throw new Error(`sqlite_backup_source_not_found:${sqlitePath}`);
  }
  const relativePath = join("sqlite", basename(sqlitePath));
  const targetPath = join(backupPath, relativePath);
  await mkdir(dirname(targetPath), { recursive: true });
  const db = new DatabaseSync(sqlitePath);
  try {
    db.exec(`VACUUM INTO ${sqlStringLiteral(targetPath)}`);
  } finally {
    db.close();
  }
  return {
    summary: await backupFileSummary({ backupPath, relativePath, sourcePath: sqlitePath }),
    sqliteBackupPath: targetPath,
  };
}

async function pruneRecoveryBackups({
  backupRoot,
  keepLast,
  verificationPublicKeys,
  requireSignature = false,
}: {
  readonly backupRoot: string;
  readonly keepLast: number;
  readonly verificationPublicKeys?: readonly string[];
  readonly requireSignature?: boolean;
}) {
  const entries = await readdir(backupRoot, { withFileTypes: true });
  const candidates = await Promise.all(entries
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
    .map(async (entry) => {
      const backupPath = join(backupRoot, entry.name);
      try {
        if (requireSignature) {
          const parsed = await readRecoveryBackupManifest(backupPath);
          verifyRecoveryBackupSignature(
            parsed.manifestBytes,
            parsed.signature,
            verificationPublicKeys,
            true,
          );
          return {
            backupId: parsed.backupId,
            backupPath,
            generatedAt: parsed.generatedAt,
          };
        }
        const manifestPath = await resolveBackupRegularFile(
          backupPath,
          "recovery-backup.json",
          false,
        );
        const manifest = ensureJsonRecord(
          JSON.parse(await readFile(manifestPath, "utf8")) as unknown,
          "recovery-backup.json",
        );
        if (
          stringField(manifest, "backupId") !== entry.name
          || manifest.ok !== true
          || !Array.isArray(manifest.files)
        ) {
          return null;
        }
        return {
          backupId: entry.name,
          backupPath,
          generatedAt: stringField(manifest, "generatedAt") || entry.name,
        };
      } catch {
        return null;
      }
    }));
  const backupDirs = candidates.filter((entry): entry is NonNullable<typeof entry> => entry !== null);
  const sorted = [...backupDirs].sort((a, b) => b.generatedAt.localeCompare(a.generatedAt));
  const kept = sorted.slice(0, keepLast).map((entry) => entry.backupId).sort();
  const keepSet = new Set(kept);
  const removed: string[] = [];
  for (const entry of sorted) {
    if (keepSet.has(entry.backupId)) continue;
    await rm(entry.backupPath, { recursive: true, force: true });
    removed.push(entry.backupId);
  }
  return {
    keepLast,
    kept,
    removed: removed.sort(),
  };
}

function portableRecoveryManifest(manifest: RecoveryManifest): RecoveryManifest {
  const { dataDir: _dataDir, sqlitePath: _sqlitePath, ...portable } = manifest;
  return portable;
}

function recoveryBackupManifest(summary: RecoveryBackupSummary) {
  const portableFile = (file: RecoveryBackupFileSummary) => ({
    relativePath: file.relativePath,
    bytes: file.bytes,
    sha256: file.sha256,
  });
  const playerMcpAccessTokens = summary.auxiliary?.playerMcpAccessTokens;
  const authoritativeStoreKind = summary.manifests.sqlite
    ? (summary.manifests.jsonl ? "dual" : "sqlite")
    : "jsonl";
  const worldManifestSha256 = summary.manifests.sqlite?.backup.manifestSha256
    || summary.manifests.jsonl?.backup.manifestSha256
    || "";
  return {
    type: "obsidian_epoch_recovery_backup",
    version: 2,
    ok: summary.ok,
    backupId: summary.backupId,
    generatedAt: summary.generatedAt,
    consistency: {
      mode: "token_before_after_world",
      authoritativeStoreKind,
      worldManifestSha256,
      playerTokenLedgerSha256: playerMcpAccessTokens?.sha256 || null,
      verifiedAt: summary.generatedAt,
    },
    files: summary.files.map(portableFile),
    auxiliary: playerMcpAccessTokens ? {
      playerMcpAccessTokens: {
        ...portableFile(playerMcpAccessTokens),
        records: playerMcpAccessTokens.records,
      },
    } : {},
    manifests: {
      ...(summary.manifests.jsonl ? {
        jsonl: {
          source: portableRecoveryManifest(summary.manifests.jsonl.source),
          backup: portableRecoveryManifest(summary.manifests.jsonl.backup),
        },
      } : {}),
      ...(summary.manifests.sqlite ? {
        sqlite: {
          source: portableRecoveryManifest(summary.manifests.sqlite.source),
          backup: portableRecoveryManifest(summary.manifests.sqlite.backup),
        },
      } : {}),
    },
  } as const;
}

async function writeBackupManifest(summary: RecoveryBackupSummary, manifestPath = summary.manifestPath) {
  const content = Buffer.from(`${JSON.stringify(recoveryBackupManifest(summary), null, 2)}\n`, "utf8");
  await writeFile(manifestPath, content, { mode: 0o600 });
  return content;
}

async function writeBackupSignature(signature: RecoveryBackupSignature, backupPath: string) {
  const signaturePath = join(backupPath, RECOVERY_BACKUP_SIGNATURE_FILE);
  await writeFile(signaturePath, `${JSON.stringify(signature, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  return signaturePath;
}

function backupOk(manifests: RecoveryBackupSummary["manifests"]) {
  const jsonlOk = !manifests.jsonl
    || manifests.jsonl.source.manifestSha256 === manifests.jsonl.backup.manifestSha256;
  const sqliteOk = !manifests.sqlite
    || manifests.sqlite.source.manifestSha256 === manifests.sqlite.backup.manifestSha256;
  const dualStoreParity = !manifests.jsonl
    || !manifests.sqlite
    || manifests.jsonl.backup.manifestSha256 === manifests.sqlite.backup.manifestSha256;
  return jsonlOk && sqliteOk && dualStoreParity;
}

export async function createRecoveryBackup({
  sourceDataDir,
  sqlitePath,
  playerMcpTokenJsonlPath,
  backupRoot,
  generatedAt = new Date(),
  keepLast,
  signingPrivateKeyPem,
  retentionVerificationPublicKeys,
  requireSignature = false,
}: RecoveryBackupOptions): Promise<RecoveryBackupSummary> {
  if (!sourceDataDir && !sqlitePath) {
    throw new Error("recovery_backup_source_required");
  }
  if (requireSignature && !signingPrivateKeyPem?.trim()) {
    throw new Error("recovery_backup_signing_private_key_required");
  }
  if (signingPrivateKeyPem?.trim()) recoveryBackupPrivateKey(signingPrivateKeyPem);
  const signingVerificationPublicKey = signingPrivateKeyPem?.trim()
    ? recoveryBackupKeyMetadata(createPublicKey(normalizedKeyMaterial(signingPrivateKeyPem))).publicKey
    : undefined;
  const backupId = backupIdFromDate(generatedAt);
  const backupPath = join(backupRoot, backupId);
  const manifestPath = join(backupPath, "recovery-backup.json");
  const stagingPath = join(backupRoot, `.${backupId}.staging-${randomUUID()}`);
  const files: RecoveryBackupFileSummary[] = [];
  const manifests: MutableRecoveryBackupManifests = {};
  const auxiliary: { playerMcpAccessTokens?: RecoveryAuxiliaryJsonlSummary } = {};
  let playerMcpIssuedExplorerIds: readonly string[] = [];
  let stagedJsonlBackupDir: string | undefined;
  let stagedSqliteBackupPath: string | undefined;

  await mkdir(backupRoot, { recursive: true });
  if (await pathExists(backupPath)) throw new Error(`recovery_backup_target_exists:${backupPath}`);
  await mkdir(stagingPath);
  try {
    // Capture the credential ledger first. Token issuance is causally downstream
    // of persisted explorer creation, so the later world snapshot contains every
    // explorer referenced by this point-in-time token snapshot.
    if (playerMcpTokenJsonlPath) {
      const playerMcpAccessTokens = await backupPlayerMcpAccessTokenLedger({
        sourcePath: playerMcpTokenJsonlPath,
        backupPath: stagingPath,
      });
      playerMcpIssuedExplorerIds = playerMcpAccessTokens.issuedExplorerIds;
      auxiliary.playerMcpAccessTokens = {
        relativePath: playerMcpAccessTokens.relativePath,
        sourcePath: playerMcpAccessTokens.sourcePath,
        records: playerMcpAccessTokens.records,
        bytes: playerMcpAccessTokens.bytes,
        sha256: playerMcpAccessTokens.sha256,
      };
      files.push(auxiliary.playerMcpAccessTokens);
    }
    if (sourceDataDir) {
      const sourceBefore = await createJsonlRecoveryManifest(sourceDataDir, generatedAt);
      files.push(...await copyJsonlBackupFiles({ sourceDataDir, backupPath: stagingPath }));
      const jsonlBackupDir = join(stagingPath, "jsonl");
      stagedJsonlBackupDir = jsonlBackupDir;
      const sourceAfter = await createJsonlRecoveryManifest(sourceDataDir, generatedAt);
      if (sourceBefore.manifestSha256 !== sourceAfter.manifestSha256) {
        throw new Error("recovery_backup_world_changed_during_snapshot");
      }
      manifests.jsonl = {
        source: sourceAfter,
        backup: await createJsonlRecoveryManifest(jsonlBackupDir, generatedAt),
      };
    }
    if (sqlitePath) {
      const { summary, sqliteBackupPath } = await snapshotSqliteBackupFile({ sqlitePath, backupPath: stagingPath });
      stagedSqliteBackupPath = sqliteBackupPath;
      manifests.sqlite = {
        source: await createSqliteRecoveryManifest(sqlitePath, generatedAt),
        backup: await createSqliteRecoveryManifest(sqliteBackupPath, generatedAt),
      };
      files.push(await backupFileSummary({
        backupPath: stagingPath,
        relativePath: summary.relativePath,
        sourcePath: sqlitePath,
      }));
    }
    if (playerMcpTokenJsonlPath && auxiliary.playerMcpAccessTokens) {
      const finalTokenLedger = await readValidatedPlayerMcpTokenLedger(playerMcpTokenJsonlPath);
      if (
        finalTokenLedger.records !== auxiliary.playerMcpAccessTokens.records
        || finalTokenLedger.content.byteLength !== auxiliary.playerMcpAccessTokens.bytes
        || sha256(finalTokenLedger.content) !== auxiliary.playerMcpAccessTokens.sha256
      ) {
        throw new Error("recovery_backup_player_mcp_access_token_ledger_changed_during_snapshot");
      }
      const worldExplorerIds = await backupWorldExplorerIds({
        jsonlBackupDir: stagedJsonlBackupDir,
        sqliteBackupPath: stagedSqliteBackupPath,
      });
      const missingExplorerId = playerMcpIssuedExplorerIds.find((explorerId) => !worldExplorerIds.has(explorerId));
      if (missingExplorerId) {
        throw new Error(`recovery_backup_cross_domain_inconsistent:${missingExplorerId}`);
      }
    }
    const initialRetention = {
      keepLast: normalizeKeepLast(keepLast),
      kept: [backupId],
      removed: [],
    };
    const unsignedSummary: RecoveryBackupSummary = {
      ok: backupOk(manifests),
      backupId,
      backupPath,
      manifestPath,
      generatedAt: generatedAt.toISOString(),
      sourceDataDir,
      sqlitePath,
      files,
      auxiliary,
      manifests,
      retention: initialRetention,
    };
    if (!unsignedSummary.ok) throw new Error("recovery_backup_verification_failed");
    const stagingManifestPath = join(stagingPath, RECOVERY_BACKUP_MANIFEST_FILE);
    const manifestBytes = await writeBackupManifest(unsignedSummary, stagingManifestPath);
    const signature = signingPrivateKeyPem?.trim()
      ? createRecoveryBackupSignature(manifestBytes, signingPrivateKeyPem)
      : undefined;
    if (signature) await writeBackupSignature(signature, stagingPath);
    const initialSummary: RecoveryBackupSummary = signature
      ? {
        ...unsignedSummary,
        signature,
        checkpoint: recoveryBackupCheckpoint(unsignedSummary.backupId, unsignedSummary.generatedAt, signature),
      }
      : unsignedSummary;
    const stagedManifest = await readRecoveryBackupManifest(stagingPath, false);
    if (stagedManifest.signature && signingPrivateKeyPem) {
      verifyRecoveryBackupSignature(
        stagedManifest.manifestBytes,
        stagedManifest.signature,
        signingVerificationPublicKey ? [signingVerificationPublicKey] : undefined,
        true,
      );
    } else if (requireSignature) {
      throw new Error("recovery_backup_signature_required");
    }
    await verifyBackupFiles(stagingPath, stagedManifest.files);
    await rename(stagingPath, backupPath);

    const retention = await pruneRecoveryBackups({
      backupRoot,
      keepLast: initialRetention.keepLast,
      verificationPublicKeys: [
        ...(retentionVerificationPublicKeys || []),
        ...(signingVerificationPublicKey ? [signingVerificationPublicKey] : []),
      ],
      requireSignature: Boolean(signature),
    });
    const summary: RecoveryBackupSummary = {
      ...initialSummary,
      retention,
    };
    return summary;
  } catch (error) {
    await rm(stagingPath, { recursive: true, force: true });
    throw error;
  }
}

async function sqliteHydrationProof(
  sqlitePath: string,
  target: RecoveryManifest,
  expectedAgentId?: string,
  expectedResultPageId?: string,
): Promise<RecoveryDrillSummary["hydration"]> {
  const loadedOptions = await loadAgentRuntimeOptionsFromSqlite(sqlitePath);
  const loadedOptionRecord = isRecord(loadedOptions) ? loadedOptions : {};
  const loadedEpochEvents = arrayField(loadedOptionRecord, "epochEvents");
  const loadedResultPages = arrayField(loadedOptionRecord, "resultPages");
  const runtime = createAgentWorldRuntime(loadedOptions);
  const eventsResponse = runtime.epochEvents({ limit: 1 }) as unknown;
  const latestEvent = isRecord(eventsResponse) && Array.isArray(eventsResponse.events) && isRecord(eventsResponse.events[0])
    ? eventsResponse.events[0]
    : undefined;
  const expectedAgent = expectedAgentId
    ? (() => {
      const progress = runtime.epochProgress({ agentId: expectedAgentId }) as unknown;
      const identity = isRecord(progress) ? recordField(progress, "identity") : undefined;
      return {
        agentId: expectedAgentId,
        identityName: stringField(identity, "identityName"),
        found: stringField(identity, "agentId") === expectedAgentId,
      };
    })()
    : undefined;
  const expectedResultPage = expectedResultPageId
    ? (() => {
      const page = runtime.epochGetResultPage({ pageId: expectedResultPageId }) as unknown;
      return {
        pageId: expectedResultPageId,
        found: stringField(isRecord(page) ? page : undefined, "pageId") === expectedResultPageId,
      };
    })()
    : undefined;
  const hydrationOk = loadedEpochEvents.length === target.epochEvents.records
    && loadedResultPages.length === target.resultPages.records
    && (!expectedAgent || expectedAgent.found)
    && (!expectedResultPage || expectedResultPage.found);
  return {
    ok: hydrationOk,
    epochEvents: loadedEpochEvents.length,
    resultPages: loadedResultPages.length,
    latestEventId: stringField(latestEvent, "eventId"),
    latestResultPageId: target.resultPages.latestPageId,
    expectedAgent,
    expectedResultPage,
  };
}

export async function runSqliteRecoveryDrill({
  sqlitePath,
  generatedAt = new Date(),
  expectedAgentId,
  expectedResultPageId,
}: SqliteRecoveryDrillOptions): Promise<RecoveryDrillSummary> {
  const target = await createSqliteRecoveryManifest(sqlitePath, generatedAt);
  const hydration = await sqliteHydrationProof(
    sqlitePath,
    target,
    expectedAgentId,
    expectedResultPageId,
  );
  return {
    ok: hydration.ok,
    source: target,
    target,
    migration: emptyMigrationSummary(sqlitePath),
    parity: { ok: true, mismatches: [] },
    hydration,
  };
}

export async function runJsonlToSqliteRecoveryDrill({
  sourceDataDir,
  sqlitePath,
  generatedAt = new Date(),
  migrate = true,
  expectedAgentId,
  expectedResultPageId,
}: RecoveryDrillOptions): Promise<RecoveryDrillSummary> {
  const migration = migrate
    ? await migrateJsonlDataDirToSqlite({ sourceDataDir, dbPath: sqlitePath })
    : emptyMigrationSummary(sqlitePath);
  const source = await createJsonlRecoveryManifest(sourceDataDir, generatedAt);
  const target = await createSqliteRecoveryManifest(sqlitePath, generatedAt);
  const mismatches = parityMismatches(source, target);
  const hydration = await sqliteHydrationProof(
    sqlitePath,
    target,
    expectedAgentId,
    expectedResultPageId,
  );
  return {
    ok: mismatches.length === 0 && hydration.ok,
    source,
    target,
    migration,
    parity: {
      ok: mismatches.length === 0,
      mismatches,
    },
    hydration,
  };
}
