import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export interface ExplorerAuthCredential {
  readonly explorerId: string;
  readonly explorerSecretHash: string;
}

export interface ServerIssuedExplorerCredential extends ExplorerAuthCredential {
  readonly localSecret: string;
  readonly recoveryCode: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function recordValue(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

export function sha256Hex(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function signaturesMatch(left: string, right: string) {
  const leftBuffer = Buffer.from(left, "hex");
  const rightBuffer = Buffer.from(right, "hex");
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function constantTimeTextEqual(left: string, right: string) {
  const leftDigest = createHash("sha256").update(left, "utf8").digest();
  const rightDigest = createHash("sha256").update(right, "utf8").digest();
  return timingSafeEqual(leftDigest, rightDigest);
}

export function explorerSecretHash(explorerId: string, localSecret: string) {
  return `sha256:${sha256Hex(`${explorerId}:${localSecret}`)}`;
}

export function encodeExplorerRecoveryCode(explorerId: string, localSecret: string) {
  return Buffer.from(JSON.stringify({ explorerId, localSecret }), "utf8").toString("base64");
}

export function createServerIssuedExplorerCredential(input: {
  readonly registrationSecret?: string;
  readonly idempotencyKey?: string;
} = {}): ServerIssuedExplorerCredential {
  const deterministic = Boolean(input.registrationSecret && input.idempotencyKey);
  const explorerHex = deterministic
    ? createHmac("sha256", String(input.registrationSecret))
      .update(`obsidian-epoch:explorer:${String(input.idempotencyKey)}`)
      .digest("hex")
      .slice(0, 32)
    : randomBytes(16).toString("hex");
  const localSecretHex = deterministic
    ? createHmac("sha256", String(input.registrationSecret))
      .update(`obsidian-epoch:recovery:${String(input.idempotencyKey)}`)
      .digest("hex")
    : randomBytes(32).toString("hex");
  const explorerId = `explorer_${explorerHex}`;
  const localSecret = `local_${localSecretHex}`;
  return {
    explorerId,
    localSecret,
    recoveryCode: encodeExplorerRecoveryCode(explorerId, localSecret),
    explorerSecretHash: explorerSecretHash(explorerId, localSecret),
  };
}

export function hashValuesMatch(left: string, right: string) {
  const leftHex = left.startsWith("sha256:") ? left.slice("sha256:".length) : left;
  const rightHex = right.startsWith("sha256:") ? right.slice("sha256:".length) : right;
  if (!/^[a-f0-9]{64}$/i.test(leftHex) || !/^[a-f0-9]{64}$/i.test(rightHex)) return false;
  return signaturesMatch(leftHex.toLowerCase(), rightHex.toLowerCase());
}

export function decodeExplorerRecoveryCode(recoveryCode: string): Record<string, unknown> {
  try {
    const decoded = Buffer.from(recoveryCode, "base64").toString("utf8");
    const parsed = JSON.parse(decoded);
    if (!parsed || typeof parsed !== "object") throw new Error("invalid_recovery_payload");
    return recordValue(parsed);
  } catch {
    throw new Error("explorer_auth_invalid");
  }
}

export function explorerAuthCredentialFromInput(
  input: Record<string, unknown>,
  expectedExplorerId?: string,
): ExplorerAuthCredential | null {
  if (typeof input.recoveryCode === "string" && input.recoveryCode.trim().length > 0) {
    const payload = decodeExplorerRecoveryCode(input.recoveryCode.trim());
    const explorerId = typeof payload.explorerId === "string" ? payload.explorerId.trim() : "";
    const localSecret = typeof payload.localSecret === "string" ? payload.localSecret.trim() : "";
    if (!explorerId || !localSecret) throw new Error("explorer_auth_invalid");
    if (expectedExplorerId && explorerId !== expectedExplorerId) throw new Error("explorer_auth_invalid");
    return {
      explorerId,
      explorerSecretHash: explorerSecretHash(explorerId, localSecret),
    };
  }
  if (typeof input.localSecret === "string" && input.localSecret.trim().length > 0) {
    const explorerId = typeof input.explorerId === "string" && input.explorerId.trim()
      ? input.explorerId.trim()
      : expectedExplorerId || "";
    if (!explorerId) throw new Error("explorer_auth_invalid");
    if (expectedExplorerId && explorerId !== expectedExplorerId) throw new Error("explorer_auth_invalid");
    return {
      explorerId,
      explorerSecretHash: explorerSecretHash(explorerId, input.localSecret.trim()),
    };
  }
  return null;
}
