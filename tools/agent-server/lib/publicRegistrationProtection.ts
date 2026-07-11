import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { IncomingMessage } from "node:http";
import { isIP } from "node:net";

const ACTOR_HASH_PREFIX = "hmac-sha256:";
const DEVICE_CHALLENGE_VERSION = "v1";
const DEVICE_CHALLENGE_HEADER = "x-obsidian-epoch-device-challenge";
const INVITE_HEADER = "x-obsidian-epoch-registration-invite";
const DEVICE_CHALLENGE_COOKIE = "obsidian_epoch_device_challenge";
const INVITE_COOKIE = "obsidian_epoch_registration_invite";

export type PublicRegistrationProtectionMode = "enforce" | "permissive";
export type PublicCredentialAction = "pairing_registration" | "player_token_issuance";

export interface PublicRegistrationProtectionConfig {
  readonly mode: PublicRegistrationProtectionMode;
  readonly actorHashSecret?: string;
  readonly trustProxyHops: number;
  readonly windowMs: number;
  readonly maxActions: number;
  readonly cooldownMs: number;
  readonly deviceChallengeTtlMs: number;
  readonly inviteActorHashes: readonly string[];
  readonly secureCookies: boolean;
}

export interface PublicRegistrationActor {
  readonly actorHashes: readonly string[];
  readonly sources: readonly ("trusted_ip" | "device_challenge" | "invite")[];
}

export interface IssuedDeviceChallenge {
  readonly challenge: string;
  readonly expiresAt: string;
}

export const PERMISSIVE_PUBLIC_REGISTRATION_PROTECTION: PublicRegistrationProtectionConfig = {
  mode: "permissive",
  trustProxyHops: 0,
  windowMs: 24 * 60 * 60 * 1_000,
  maxActions: 8,
  cooldownMs: 30_000,
  deviceChallengeTtlMs: 24 * 60 * 60 * 1_000,
  inviteActorHashes: [],
  secureCookies: false,
};

export function hashPublicRegistrationActor(secret: string, source: string, value: string): string {
  const normalizedSecret = requireActorHashSecret(secret);
  return `${ACTOR_HASH_PREFIX}${createHmac("sha256", normalizedSecret)
    .update(`obsidian-epoch/public-registration/${source}\0${value}`, "utf8")
    .digest("hex")}`;
}

export function publicRegistrationInviteActorHash(secret: string, invite: string): string {
  const normalizedInvite = invite.trim();
  if (normalizedInvite.length < 16 || normalizedInvite.length > 512) {
    throw new Error("public_registration_invite_invalid");
  }
  return hashPublicRegistrationActor(secret, "invite", normalizedInvite);
}

export function issuePublicRegistrationDeviceChallenge(
  config: PublicRegistrationProtectionConfig,
  now: Date = new Date(),
): IssuedDeviceChallenge {
  const secret = requireEnforcedSecret(config);
  const expiresAtMs = now.getTime() + config.deviceChallengeTtlMs;
  const unsigned = `${DEVICE_CHALLENGE_VERSION}.${expiresAtMs}.${randomBytes(24).toString("base64url")}`;
  const signature = createHmac("sha256", secret)
    .update(`obsidian-epoch/device-challenge\0${unsigned}`, "utf8")
    .digest("base64url");
  return {
    challenge: `${unsigned}.${signature}`,
    expiresAt: new Date(expiresAtMs).toISOString(),
  };
}

export function derivePublicRegistrationActor(
  request: IncomingMessage,
  config: PublicRegistrationProtectionConfig,
  now: Date = new Date(),
): PublicRegistrationActor {
  const secret = requireEnforcedSecret(config);
  const trustedIp = trustedClientIp(request, config.trustProxyHops);
  const actorHashes = [hashPublicRegistrationActor(secret, "ip", trustedIp)];
  const sources: Array<"trusted_ip" | "device_challenge" | "invite"> = ["trusted_ip"];
  const cookies = requestCookies(request);

  const rawChallenge = singleHeader(request, DEVICE_CHALLENGE_HEADER) || cookies.get(DEVICE_CHALLENGE_COOKIE);
  if (rawChallenge) {
    const nonce = verifyDeviceChallenge(rawChallenge, secret, now);
    actorHashes.push(hashPublicRegistrationActor(secret, "device", nonce));
    sources.push("device_challenge");
  }

  const rawInvite = singleHeader(request, INVITE_HEADER);
  const cookieInviteHash = cookies.get(INVITE_COOKIE);
  if (rawInvite || cookieInviteHash) {
    const inviteHash = rawInvite
      ? publicRegistrationInviteActorHash(secret, rawInvite)
      : requireActorHash(cookieInviteHash || "", "public_registration_invite_invalid");
    if (!config.inviteActorHashes.some((configured) => constantTimeActorHashEquals(configured, inviteHash))) {
      throw new Error("public_registration_invite_invalid");
    }
    actorHashes.push(inviteHash);
    sources.push("invite");
  }

  return { actorHashes: [...new Set(actorHashes)], sources };
}

export function deviceChallengeCookie(
  challenge: IssuedDeviceChallenge,
  config: PublicRegistrationProtectionConfig,
): string {
  const maxAgeSeconds = Math.max(1, Math.floor(config.deviceChallengeTtlMs / 1_000));
  return cookieValue(DEVICE_CHALLENGE_COOKIE, challenge.challenge, maxAgeSeconds, config.secureCookies);
}

export function inviteCookieFromRequest(
  request: IncomingMessage,
  config: PublicRegistrationProtectionConfig,
): string | null {
  const requestUrl = new URL(request.url || "/", "http://127.0.0.1");
  const invite = requestUrl.searchParams.get("invite")?.trim();
  if (!invite) return null;
  const secret = requireEnforcedSecret(config);
  const inviteHash = publicRegistrationInviteActorHash(secret, invite);
  if (!config.inviteActorHashes.some((configured) => constantTimeActorHashEquals(configured, inviteHash))) {
    throw new Error("public_registration_invite_invalid");
  }
  const maxAgeSeconds = Math.max(1, Math.floor(config.deviceChallengeTtlMs / 1_000));
  return cookieValue(INVITE_COOKIE, inviteHash, maxAgeSeconds, config.secureCookies);
}

export function isPublicRegistrationActorHash(value: string): boolean {
  return value.startsWith(ACTOR_HASH_PREFIX)
    && /^[a-f0-9]{64}$/.test(value.slice(ACTOR_HASH_PREFIX.length));
}

function trustedClientIp(request: IncomingMessage, trustProxyHops: number): string {
  if (!Number.isSafeInteger(trustProxyHops) || trustProxyHops < 0 || trustProxyHops > 16) {
    throw new Error("public_registration_actor_metadata_invalid");
  }

  if (trustProxyHops === 0) {
    return normalizeIp(request.socket.remoteAddress || "");
  }

  const forwardedFor = singleHeader(request, "x-forwarded-for");
  if (!forwardedFor) throw new Error("public_registration_actor_metadata_invalid");
  const chain = forwardedFor.split(",").map((part) => part.trim()).filter(Boolean);
  if (chain.length < trustProxyHops) throw new Error("public_registration_actor_metadata_invalid");
  return normalizeIp(chain[chain.length - trustProxyHops] || "");
}

function normalizeIp(value: string): string {
  let normalized = value.trim().toLowerCase();
  if (normalized.startsWith("::ffff:")) normalized = normalized.slice("::ffff:".length);
  const zoneIndex = normalized.indexOf("%");
  if (zoneIndex >= 0) normalized = normalized.slice(0, zoneIndex);
  if (isIP(normalized) === 4) return normalized;
  if (isIP(normalized) === 6) {
    try {
      return new URL(`http://[${normalized}]/`).hostname.replace(/^\[/, "").replace(/\]$/, "");
    } catch {
      throw new Error("public_registration_actor_metadata_invalid");
    }
  }
  throw new Error("public_registration_actor_metadata_invalid");
}

function verifyDeviceChallenge(value: string, secret: string, now: Date): string {
  const parts = value.trim().split(".");
  if (parts.length !== 4) throw new Error("public_registration_device_challenge_invalid");
  const [version = "", expiresAtRaw = "", nonce = "", signature = ""] = parts;
  const expiresAtMs = Number(expiresAtRaw);
  if (
    version !== DEVICE_CHALLENGE_VERSION
    || !Number.isSafeInteger(expiresAtMs)
    || expiresAtMs <= now.getTime()
    || expiresAtMs > now.getTime() + 7 * 24 * 60 * 60 * 1_000
    || !/^[A-Za-z0-9_-]{32}$/.test(nonce)
    || !/^[A-Za-z0-9_-]{43}$/.test(signature)
  ) {
    throw new Error("public_registration_device_challenge_invalid");
  }
  const unsigned = `${version}.${expiresAtRaw}.${nonce}`;
  const expected = createHmac("sha256", secret)
    .update(`obsidian-epoch/device-challenge\0${unsigned}`, "utf8")
    .digest("base64url");
  if (!constantTimeTextEquals(expected, signature)) {
    throw new Error("public_registration_device_challenge_invalid");
  }
  return nonce;
}

function singleHeader(request: IncomingMessage, name: string): string | undefined {
  const value = request.headers[name];
  if (Array.isArray(value)) throw new Error("public_registration_actor_metadata_invalid");
  const normalized = value?.trim();
  return normalized || undefined;
}

function requestCookies(request: IncomingMessage): Map<string, string> {
  const result = new Map<string, string>();
  const raw = request.headers.cookie;
  if (!raw) return result;
  for (const part of raw.split(";")) {
    const separator = part.indexOf("=");
    if (separator <= 0) continue;
    const name = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    try {
      result.set(name, decodeURIComponent(value));
    } catch {
      throw new Error("public_registration_actor_metadata_invalid");
    }
  }
  return result;
}

function cookieValue(name: string, value: string, maxAgeSeconds: number, secure: boolean): string {
  return `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAgeSeconds}; HttpOnly; SameSite=Strict${secure ? "; Secure" : ""}`;
}

function requireEnforcedSecret(config: PublicRegistrationProtectionConfig): string {
  if (config.mode !== "enforce") throw new Error("public_registration_protection_unavailable");
  return requireActorHashSecret(config.actorHashSecret || "");
}

function requireActorHashSecret(value: string): string {
  const normalized = value.trim();
  if (normalized.length < 32) throw new Error("public_registration_protection_unavailable");
  return normalized;
}

function requireActorHash(value: string, errorCode: string): string {
  if (!isPublicRegistrationActorHash(value)) throw new Error(errorCode);
  return value;
}

function constantTimeActorHashEquals(left: string, right: string): boolean {
  if (!isPublicRegistrationActorHash(left) || !isPublicRegistrationActorHash(right)) return false;
  return constantTimeTextEquals(left, right);
}

function constantTimeTextEquals(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left, "utf8");
  const rightBytes = Buffer.from(right, "utf8");
  return leftBytes.byteLength === rightBytes.byteLength && timingSafeEqual(leftBytes, rightBytes);
}
