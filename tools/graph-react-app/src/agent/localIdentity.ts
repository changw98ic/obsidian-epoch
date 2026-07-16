import type { ExplorerIdentity } from "../types";

const STORAGE_KEY = "obsidian_epoch_agent_explorer";
const PENDING_RECOVERY_ROTATION_KEY = "obsidian_epoch_pending_recovery_rotation";
const ARCHIVE_TYPE = "obsidian_epoch_explorer_identity_archive";
const ARCHIVE_VERSION = 1;
const ARCHIVE_KDF = "PBKDF2-SHA256";
const ARCHIVE_CIPHER = "AES-256-GCM";
const ARCHIVE_ITERATIONS = 210_000;
const ARCHIVE_SALT_BYTES = 16;
const ARCHIVE_IV_BYTES = 12;

interface EncryptedExplorerArchive {
  readonly type: typeof ARCHIVE_TYPE;
  readonly version: typeof ARCHIVE_VERSION;
  readonly kdf: typeof ARCHIVE_KDF;
  readonly cipher: typeof ARCHIVE_CIPHER;
  readonly iterations: typeof ARCHIVE_ITERATIONS;
  readonly salt: string;
  readonly iv: string;
  readonly ciphertext: string;
  readonly exportedAt: string;
}

interface ExplorerArchivePayload {
  readonly type: typeof ARCHIVE_TYPE;
  readonly version: typeof ARCHIVE_VERSION;
  readonly explorer: ExplorerIdentity;
  readonly exportedAt: string;
}

export interface ServerIssuedExplorerRegistration {
  readonly explorerId: string;
  readonly recoveryCode: string;
}

export interface PendingExplorerRecoveryRotation {
  readonly previous: ExplorerIdentity;
  readonly next: ExplorerIdentity;
  readonly idempotencyKey: string;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("invalid_explorer_archive");
  }
  return value as Record<string, unknown>;
}

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

function encodeBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function decodeBase64(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function arrayBufferFor(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function getSubtleCrypto(): SubtleCrypto {
  const subtle = crypto.subtle;
  if (!subtle) throw new Error("secure_crypto_unavailable");
  return subtle;
}

function passphraseBytes(passphrase: string): Uint8Array {
  const normalized = passphrase.normalize("NFKC");
  if (normalized.trim().length < 12) throw new Error("explorer_archive_passphrase_too_short");
  return new TextEncoder().encode(normalized);
}

async function deriveArchiveKey(passphrase: string, salt: Uint8Array, keyUsages: KeyUsage[]): Promise<CryptoKey> {
  const subtle = getSubtleCrypto();
  const keyMaterial = await subtle.importKey(
    "raw",
    arrayBufferFor(passphraseBytes(passphrase)),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: arrayBufferFor(salt),
      iterations: ARCHIVE_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    keyUsages,
  );
}

function decodeRecoveryCode(value: string): { explorerId: string; localSecret: string } {
  try {
    const decoded = asRecord(JSON.parse(atob(value)));
    if (typeof decoded.explorerId !== "string" || typeof decoded.localSecret !== "string") {
      throw new Error("invalid_explorer_identity");
    }
    return {
      explorerId: decoded.explorerId,
      localSecret: decoded.localSecret,
    };
  } catch {
    throw new Error("invalid_explorer_identity");
  }
}

function validateExplorerIdentity(value: unknown): ExplorerIdentity {
  const record = asRecord(value);
  const preferencesRecord = record.preferences && typeof record.preferences === "object" && !Array.isArray(record.preferences)
    ? record.preferences as Record<string, unknown>
    : undefined;
  const explorer = {
    explorerId: record.explorerId,
    displayName: record.displayName,
    localSecret: record.localSecret,
    recoveryCode: record.recoveryCode,
    createdAt: record.createdAt,
    ...(preferencesRecord
      ? {
        preferences: {
          lowStimulusMode: preferencesRecord.lowStimulusMode === true,
        },
      }
      : {}),
  };
  if (
    typeof explorer.explorerId !== "string"
    || !explorer.explorerId.startsWith("explorer_")
    || typeof explorer.displayName !== "string"
    || explorer.displayName.trim().length === 0
    || typeof explorer.localSecret !== "string"
    || !explorer.localSecret.startsWith("local_")
    || typeof explorer.recoveryCode !== "string"
    || typeof explorer.createdAt !== "string"
    || Number.isNaN(Date.parse(explorer.createdAt))
  ) {
    throw new Error("invalid_explorer_identity");
  }
  const recovered = decodeRecoveryCode(explorer.recoveryCode);
  if (recovered.explorerId !== explorer.explorerId || recovered.localSecret !== explorer.localSecret) {
    throw new Error("invalid_explorer_identity");
  }
  return explorer as ExplorerIdentity;
}

function parseEncryptedExplorerArchive(archiveText: string): EncryptedExplorerArchive {
  const record = asRecord(JSON.parse(archiveText));
  if (
    record.type !== ARCHIVE_TYPE
    || record.version !== ARCHIVE_VERSION
    || record.kdf !== ARCHIVE_KDF
    || record.cipher !== ARCHIVE_CIPHER
    || record.iterations !== ARCHIVE_ITERATIONS
    || typeof record.salt !== "string"
    || typeof record.iv !== "string"
    || typeof record.ciphertext !== "string"
    || typeof record.exportedAt !== "string"
    || Number.isNaN(Date.parse(record.exportedAt))
  ) {
    throw new Error("invalid_explorer_archive");
  }
  return {
    type: ARCHIVE_TYPE,
    version: ARCHIVE_VERSION,
    kdf: ARCHIVE_KDF,
    cipher: ARCHIVE_CIPHER,
    iterations: ARCHIVE_ITERATIONS,
    salt: record.salt,
    iv: record.iv,
    ciphertext: record.ciphertext,
    exportedAt: record.exportedAt,
  };
}

function randomToken(prefix: string): string {
  const bytes = randomBytes(8);
  return `${prefix}_${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

function recoveryCodeFor(explorerId: string, localSecret: string): string {
  return btoa(JSON.stringify({ explorerId, localSecret }));
}

export function saveExplorerIdentity(explorer: ExplorerIdentity): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(validateExplorerIdentity(explorer)));
}

export function loadExplorerIdentity(): ExplorerIdentity | null {
  const existing = localStorage.getItem(STORAGE_KEY);
  return existing ? validateExplorerIdentity(JSON.parse(existing)) : null;
}

function validatePendingExplorerRecoveryRotation(value: unknown): PendingExplorerRecoveryRotation {
  const record = asRecord(value);
  const previous = validateExplorerIdentity(record.previous);
  const next = validateExplorerIdentity(record.next);
  const idempotencyKey = typeof record.idempotencyKey === "string" ? record.idempotencyKey.trim() : "";
  if (
    previous.explorerId !== next.explorerId
    || previous.recoveryCode === next.recoveryCode
    || !idempotencyKey
  ) {
    throw new Error("invalid_explorer_recovery_rotation");
  }
  return { previous, next, idempotencyKey };
}

export function savePendingExplorerRecoveryRotation(rotation: PendingExplorerRecoveryRotation): void {
  localStorage.setItem(
    PENDING_RECOVERY_ROTATION_KEY,
    JSON.stringify(validatePendingExplorerRecoveryRotation(rotation)),
  );
}

export function loadPendingExplorerRecoveryRotation(): PendingExplorerRecoveryRotation | null {
  const stored = localStorage.getItem(PENDING_RECOVERY_ROTATION_KEY);
  return stored ? validatePendingExplorerRecoveryRotation(JSON.parse(stored)) : null;
}

export function clearPendingExplorerRecoveryRotation(): boolean {
  try {
    localStorage.removeItem(PENDING_RECOVERY_ROTATION_KEY);
    return true;
  } catch {
    return false;
  }
}

export function createExplorerIdentityFromRegistration(
  registration: ServerIssuedExplorerRegistration,
): ExplorerIdentity {
  const recovered = decodeRecoveryCode(registration.recoveryCode);
  if (recovered.explorerId !== registration.explorerId) {
    throw new Error("invalid_explorer_identity");
  }
  return validateExplorerIdentity({
    explorerId: registration.explorerId,
    displayName: `探索者 ${registration.explorerId.slice(-4)}`,
    localSecret: recovered.localSecret,
    recoveryCode: registration.recoveryCode,
    createdAt: new Date().toISOString(),
  });
}

export function createRotatedExplorerRecovery(explorer: ExplorerIdentity): ExplorerIdentity {
  const localSecret = randomToken("local");
  return {
    ...explorer,
    localSecret,
    recoveryCode: recoveryCodeFor(explorer.explorerId, localSecret),
  };
}

export function exportRecoveryCode(explorer: ExplorerIdentity): string {
  return explorer.recoveryCode;
}

export async function exportEncryptedExplorerArchive(explorer: ExplorerIdentity, passphrase: string): Promise<string> {
  const safeExplorer = validateExplorerIdentity(explorer);
  const exportedAt = new Date().toISOString();
  const salt = randomBytes(ARCHIVE_SALT_BYTES);
  const iv = randomBytes(ARCHIVE_IV_BYTES);
  const key = await deriveArchiveKey(passphrase, salt, ["encrypt"]);
  const payload: ExplorerArchivePayload = {
    type: ARCHIVE_TYPE,
    version: ARCHIVE_VERSION,
    explorer: safeExplorer,
    exportedAt,
  };
  const plaintext = new TextEncoder().encode(JSON.stringify(payload));
  const ciphertext = new Uint8Array(await getSubtleCrypto().encrypt(
    { name: "AES-GCM", iv: arrayBufferFor(iv) },
    key,
    arrayBufferFor(plaintext),
  ));
  const archive: EncryptedExplorerArchive = {
    type: ARCHIVE_TYPE,
    version: ARCHIVE_VERSION,
    kdf: ARCHIVE_KDF,
    cipher: ARCHIVE_CIPHER,
    iterations: ARCHIVE_ITERATIONS,
    salt: encodeBase64(salt),
    iv: encodeBase64(iv),
    ciphertext: encodeBase64(ciphertext),
    exportedAt,
  };
  return JSON.stringify(archive);
}

export async function importEncryptedExplorerArchive(archiveText: string, passphrase: string): Promise<ExplorerIdentity> {
  let archive: EncryptedExplorerArchive;
  try {
    archive = parseEncryptedExplorerArchive(archiveText);
  } catch {
    throw new Error("invalid_explorer_archive");
  }
  const salt = decodeBase64(archive.salt);
  const iv = decodeBase64(archive.iv);
  const key = await deriveArchiveKey(passphrase, salt, ["decrypt"]);
  let plaintext: ArrayBuffer;
  try {
    plaintext = await getSubtleCrypto().decrypt(
      { name: "AES-GCM", iv: arrayBufferFor(iv) },
      key,
      arrayBufferFor(decodeBase64(archive.ciphertext)),
    );
  } catch {
    throw new Error("explorer_archive_decrypt_failed");
  }
  const payload = asRecord(JSON.parse(new TextDecoder().decode(plaintext)));
  if (payload.type !== ARCHIVE_TYPE || payload.version !== ARCHIVE_VERSION) {
    throw new Error("invalid_explorer_archive");
  }
  return validateExplorerIdentity(payload.explorer);
}
