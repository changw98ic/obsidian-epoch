import {
  createHash,
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  sign,
  verify,
} from "node:crypto";
import { readFileSync } from "node:fs";

export const RUNTIME_ACTION_SIGNATURE_ALGORITHM = "Ed25519";
export const RUNTIME_ACTION_SIGNING_ENV_VAR = "AGENT_RUNTIME_ACTION_SIGNING_PRIVATE_KEY_PEM";
export const RUNTIME_ACTION_SIGNING_FILE_ENV_VAR = "AGENT_RUNTIME_ACTION_SIGNING_PRIVATE_KEY_PEM_FILE";
export const RUNTIME_ACTION_VERIFICATION_KEYS_ENV_VAR = "AGENT_RUNTIME_ACTION_VERIFICATION_PUBLIC_KEYS";
export const RUNTIME_ACTION_VERIFICATION_KEYS_FILE_ENV_VAR = "AGENT_RUNTIME_ACTION_VERIFICATION_PUBLIC_KEYS_FILE";

const EPHEMERAL_RUNTIME_ACTION_KEY_PAIR = generateKeyPairSync("ed25519");

function configuredValue(inlineName: string, fileName: string) {
  const inline = process.env[inlineName]?.trim();
  const path = process.env[fileName]?.trim();
  if (inline && path) throw new Error(`runtime_action_key_source_ambiguous:${inlineName}`);
  if (!path) return inline;
  try {
    return readFileSync(path, "utf8").trim();
  } catch {
    throw new Error(`runtime_action_key_file_unreadable:${fileName}`);
  }
}

function normalizedPem(value: string) {
  let normalized = value.trim();
  if (normalized.startsWith('"')) {
    try {
      const parsed: unknown = JSON.parse(normalized);
      if (typeof parsed === "string") normalized = parsed;
    } catch {
      // The crypto parser below reports an invalid key without exposing it.
    }
  } else if (normalized.startsWith("'") && normalized.endsWith("'")) {
    normalized = normalized.slice(1, -1);
  }
  return normalized.replaceAll("\\n", "\n");
}

export function configuredRuntimeActionPrivateKeyPem() {
  const value = configuredValue(RUNTIME_ACTION_SIGNING_ENV_VAR, RUNTIME_ACTION_SIGNING_FILE_ENV_VAR);
  return value ? normalizedPem(value) : undefined;
}

function runtimeActionPrivateKey() {
  const configured = configuredRuntimeActionPrivateKeyPem();
  const key = configured ? createPrivateKey(configured) : EPHEMERAL_RUNTIME_ACTION_KEY_PAIR.privateKey;
  if (key.asymmetricKeyType !== "ed25519") throw new Error("runtime_action_signing_key_must_be_ed25519");
  return key;
}

export function runtimeActionPublicKey() {
  const configured = configuredRuntimeActionPrivateKeyPem();
  const key = configured ? createPublicKey(configured) : EPHEMERAL_RUNTIME_ACTION_KEY_PAIR.publicKey;
  return key.export({ type: "spki", format: "der" }).toString("base64");
}

export function runtimeActionKeyId(publicKey = runtimeActionPublicKey()) {
  return createHash("sha256").update(Buffer.from(normalizeRuntimeActionPublicKey(publicKey), "base64")).digest("hex");
}

export function signRuntimeActionPayload(payload: Uint8Array) {
  return sign(null, payload, runtimeActionPrivateKey()).toString("base64");
}

export function normalizeRuntimeActionPublicKey(value: string) {
  let key;
  try {
    const normalized = normalizedPem(value);
    if (normalized.includes("PRIVATE KEY")) {
      throw new Error("runtime_action_verification_keys_invalid");
    }
    key = normalized.includes("-----BEGIN")
      ? createPublicKey(normalized)
      : createPublicKey({
        key: Buffer.from(normalized, "base64"),
        type: "spki",
        format: "der",
      });
  } catch {
    throw new Error("runtime_action_verification_keys_invalid");
  }
  if (key.asymmetricKeyType !== "ed25519") {
    throw new Error("runtime_action_verification_keys_invalid");
  }
  return key.export({ type: "spki", format: "der" }).toString("base64");
}

export function parseRuntimeActionVerificationPublicKeys(raw: string) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("runtime_action_verification_keys_invalid");
  }
  let entries: readonly unknown[];
  if (Array.isArray(parsed)) {
    entries = parsed;
  } else if (parsed && typeof parsed === "object" && "keys" in parsed && Array.isArray(parsed.keys)) {
    entries = parsed.keys;
  } else {
    throw new Error("runtime_action_verification_keys_invalid");
  }
  const keys = new Set<string>();
  for (const entry of entries) {
    const publicKey = typeof entry === "string"
      ? entry
      : entry && typeof entry === "object" && "publicKey" in entry
        ? entry.publicKey
        : undefined;
    const declaredKeyId = entry && typeof entry === "object" && "keyId" in entry
      ? entry.keyId
      : undefined;
    if (typeof publicKey !== "string" || !publicKey.trim()) {
      throw new Error("runtime_action_verification_keys_invalid");
    }
    const normalized = normalizeRuntimeActionPublicKey(publicKey);
    const derivedKeyId = createHash("sha256").update(Buffer.from(normalized, "base64")).digest("hex");
    if (declaredKeyId !== undefined && declaredKeyId !== derivedKeyId) {
      throw new Error("runtime_action_verification_keys_invalid");
    }
    keys.add(normalized);
  }
  return keys;
}

function configuredVerificationPublicKeys() {
  const raw = configuredValue(
    RUNTIME_ACTION_VERIFICATION_KEYS_ENV_VAR,
    RUNTIME_ACTION_VERIFICATION_KEYS_FILE_ENV_VAR,
  );
  return raw ? parseRuntimeActionVerificationPublicKeys(raw) : new Set<string>();
}

export function trustedRuntimeActionPublicKeys() {
  return new Set([normalizeRuntimeActionPublicKey(runtimeActionPublicKey()), ...configuredVerificationPublicKeys()]);
}

export function verifyRuntimeActionPayload(input: {
  readonly payload: Uint8Array;
  readonly publicKey: string;
  readonly keyId: string;
  readonly signature: string;
}) {
  try {
    const normalizedPublicKey = normalizeRuntimeActionPublicKey(input.publicKey);
    if (runtimeActionKeyId(normalizedPublicKey) !== input.keyId) return false;
    if (!trustedRuntimeActionPublicKeys().has(normalizedPublicKey)) return false;
    const publicKey = createPublicKey({
      key: Buffer.from(normalizedPublicKey, "base64"),
      type: "spki",
      format: "der",
    });
    return verify(null, input.payload, publicKey, Buffer.from(input.signature, "base64"));
  } catch {
    return false;
  }
}
