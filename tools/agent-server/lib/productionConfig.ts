import { OBSIDIAN_EPOCH_PACKAGE_SIGNING_ENV_VAR } from "./packageArchive.ts";
import {
  RUNTIME_ACTION_SIGNING_ENV_VAR,
  RUNTIME_ACTION_VERIFICATION_KEYS_ENV_VAR,
  parseRuntimeActionVerificationPublicKeys,
} from "./runtimeActionSigning.ts";
import { attestedRunnersFromEnv } from "./attestedRunnerConfig.ts";
import { type EpochAttestedRunnerConfig } from "./epoch/runtime.ts";
import { createHash, createPrivateKey, createPublicKey } from "node:crypto";
import { readFileSync } from "node:fs";
import { isAbsolute } from "node:path";
import {
  type PublicRegistrationProtectionConfig,
  publicRegistrationInviteActorHash,
} from "./publicRegistrationProtection.ts";

const DEFAULT_ALLOWED_ORIGINS = ["http://127.0.0.1:5173", "http://localhost:5173", "null"];
const CONSOLE_MEDIA_BASE_URL_ENV_VAR = "AGENT_EPOCH_CONSOLE_MEDIA_BASE_URL";
const PUBLIC_SERVER_BASE_ENV_VAR = "AGENT_PUBLIC_SERVER_BASE";
const MCP_BEARER_TOKEN_ENV_VAR = "AGENT_SERVER_MCP_BEARER_TOKEN";
const MCP_PLAYER_TOKEN_JSONL_PATH_ENV_VAR = "AGENT_SERVER_MCP_PLAYER_TOKEN_JSONL_PATH";
const MCP_PLAYER_TOKEN_TTL_SECONDS_ENV_VAR = "AGENT_SERVER_MCP_PLAYER_TOKEN_TTL_SECONDS";
const OPERATOR_KEY_ENV_VAR = "AGENT_SERVER_OPERATOR_KEY";
const REGISTRATION_SECRET_ENV_VAR = "AGENT_SERVER_REGISTRATION_SECRET";
const PUBLIC_REGISTRATION_MODE_ENV_VAR = "AGENT_SERVER_PUBLIC_REGISTRATION_MODE";
const REGISTRATION_ACTOR_HASH_SECRET_ENV_VAR = "AGENT_SERVER_REGISTRATION_ACTOR_HASH_SECRET";
const REGISTRATION_TRUST_PROXY_HOPS_ENV_VAR = "AGENT_SERVER_REGISTRATION_TRUST_PROXY_HOPS";
const REGISTRATION_WINDOW_SECONDS_ENV_VAR = "AGENT_SERVER_REGISTRATION_WINDOW_SECONDS";
const REGISTRATION_MAX_ACTIONS_ENV_VAR = "AGENT_SERVER_REGISTRATION_MAX_ACTIONS";
const REGISTRATION_COOLDOWN_SECONDS_ENV_VAR = "AGENT_SERVER_REGISTRATION_COOLDOWN_SECONDS";
const REGISTRATION_DEVICE_CHALLENGE_TTL_SECONDS_ENV_VAR = "AGENT_SERVER_REGISTRATION_DEVICE_CHALLENGE_TTL_SECONDS";
const REGISTRATION_INVITES_ENV_VAR = "AGENT_SERVER_REGISTRATION_INVITES";
const PLACEHOLDER_ORIGINS = new Set(["*", "https://your-domain.example", "https://cdn.your-domain.example"]);
const LOCAL_TRUST_ROOT_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "host.docker.internal",
  "gateway.docker.internal",
  "docker.for.mac.localhost",
  "docker.for.win.localhost",
]);

export interface AgentServerStartupConfig {
  readonly allowedOrigins: string[];
  readonly consoleAssetBaseUrl?: string;
  readonly publicServerBase?: string;
  readonly mcpBearerToken?: string;
  readonly mcpPlayerTokenJsonlPath?: string;
  readonly mcpPlayerTokenTtlMs: number;
  readonly packageReleaseKeyId?: string;
  readonly runtimeActionKeyId?: string;
  readonly operatorKey?: string;
  readonly registrationSecret?: string;
  readonly attestedRunners: readonly EpochAttestedRunnerConfig[];
  readonly publicRegistrationProtection: PublicRegistrationProtectionConfig;
}

type Env = Readonly<Record<string, string | undefined>>;

function configuredSecret(env: Env, name: string) {
  const inline = env[name]?.trim();
  const fileName = `${name}_FILE`;
  const filePath = env[fileName]?.trim();
  if (inline && filePath) throw new Error(`${name} and ${fileName} must not both be set`);
  if (!filePath) return inline;
  try {
    return readFileSync(filePath, "utf8").trim();
  } catch {
    throw new Error(`${fileName} must reference a readable secret file`);
  }
}

function parseAllowedOrigins(value: string | undefined) {
  return (value || DEFAULT_ALLOWED_ORIGINS.join(","))
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function isPrivateIpv4(host: string) {
  const octets = host.split(".");
  if (octets.length !== 4) return false;

  const numbers = octets.map((octet) => Number(octet));
  if (numbers.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) return false;

  const [first = 0, second = 0] = numbers;
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  );
}

function isLocalIpv6(host: string) {
  const normalized = host.toLowerCase().replace(/^\[/, "").replace(/\]$/, "");
  return normalized === "::1" || normalized.startsWith("fe80:");
}

function requireProductionAllowedOrigins(env: Env) {
  const configured = env.AGENT_SERVER_ALLOWED_ORIGINS;
  if (typeof configured !== "string" || !configured.trim()) {
    throw new Error("AGENT_SERVER_ALLOWED_ORIGINS must be set to exact HTTPS production origins when NODE_ENV=production");
  }

  const rawOrigins = configured.split(",").map((origin) => origin.trim());
  if (rawOrigins.some((origin) => !origin)) {
    throw new Error("AGENT_SERVER_ALLOWED_ORIGINS must not contain blank production trust roots");
  }

  for (const origin of rawOrigins) {
    if (PLACEHOLDER_ORIGINS.has(origin)) {
      throw new Error(`AGENT_SERVER_ALLOWED_ORIGINS contains placeholder production trust root: ${origin}`);
    }

    let parsed: URL;
    try {
      parsed = new URL(origin);
    } catch {
      throw new Error(`AGENT_SERVER_ALLOWED_ORIGINS contains invalid production origin: ${origin}`);
    }

    const host = parsed.hostname.toLowerCase();
    if (origin !== parsed.origin) {
      throw new Error(`AGENT_SERVER_ALLOWED_ORIGINS production origin must not include paths or query strings: ${origin}`);
    }
    if (parsed.protocol !== "https:") {
      throw new Error(`AGENT_SERVER_ALLOWED_ORIGINS production origin must use HTTPS: ${origin}`);
    }
    if (LOCAL_TRUST_ROOT_HOSTS.has(host) || isPrivateIpv4(host) || isLocalIpv6(host)) {
      throw new Error(`AGENT_SERVER_ALLOWED_ORIGINS contains local production trust root: ${origin}`);
    }
  }

  return rawOrigins;
}

function normalizedPackageSigningPrivateKey(value: string) {
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

function requireProductionPackageSigningKey(env: Env) {
  const configured = configuredSecret(env, OBSIDIAN_EPOCH_PACKAGE_SIGNING_ENV_VAR);
  if (typeof configured !== "string" || !configured.trim()) {
    throw new Error(`${OBSIDIAN_EPOCH_PACKAGE_SIGNING_ENV_VAR} must be set when NODE_ENV=production`);
  }
  const privateKeyPem = normalizedPackageSigningPrivateKey(configured);
  let privateKey;
  try {
    privateKey = createPrivateKey(privateKeyPem);
  } catch {
    throw new Error(`${OBSIDIAN_EPOCH_PACKAGE_SIGNING_ENV_VAR} must contain a valid Ed25519 private key`);
  }
  if (privateKey.asymmetricKeyType !== "ed25519") {
    throw new Error(`${OBSIDIAN_EPOCH_PACKAGE_SIGNING_ENV_VAR} must contain an Ed25519 private key`);
  }
  const publicKeyDer = createPublicKey(privateKeyPem).export({ type: "spki", format: "der" });
  return {
    privateKeyPem,
    releaseKeyId: createHash("sha256").update(publicKeyDer).digest("hex"),
  };
}

function requireProductionRuntimeActionSigningKey(env: Env) {
  const configured = configuredSecret(env, RUNTIME_ACTION_SIGNING_ENV_VAR);
  if (typeof configured !== "string" || !configured.trim()) {
    throw new Error(`${RUNTIME_ACTION_SIGNING_ENV_VAR} must be set when NODE_ENV=production`);
  }
  const privateKeyPem = normalizedPackageSigningPrivateKey(configured);
  let privateKey;
  try {
    privateKey = createPrivateKey(privateKeyPem);
  } catch {
    throw new Error(`${RUNTIME_ACTION_SIGNING_ENV_VAR} must contain a valid Ed25519 private key`);
  }
  if (privateKey.asymmetricKeyType !== "ed25519") {
    throw new Error(`${RUNTIME_ACTION_SIGNING_ENV_VAR} must contain an Ed25519 private key`);
  }
  const publicKeyDer = createPublicKey(privateKeyPem).export({ type: "spki", format: "der" });
  return {
    privateKeyPem,
    keyId: createHash("sha256").update(publicKeyDer).digest("hex"),
  };
}

function normalizedProductionOperatorKey(env: Env) {
  const operatorKey = configuredSecret(env, OPERATOR_KEY_ENV_VAR) || "";
  if (operatorKey.length < 32) {
    throw new Error(`${OPERATOR_KEY_ENV_VAR} must contain at least 32 characters when NODE_ENV=production`);
  }
  return operatorKey;
}

function requireIndependentOperatorKey(
  operatorKey: string,
  credentials: readonly { readonly name: string; readonly value?: string }[],
) {
  for (const credential of credentials) {
    if (credential.value?.trim() === operatorKey) {
      throw new Error(`${OPERATOR_KEY_ENV_VAR} must be independent from ${credential.name}`);
    }
  }
}

function normalizedPublicServerBase(env: Env, required: boolean) {
  const raw = env[PUBLIC_SERVER_BASE_ENV_VAR];
  if (typeof raw !== "string" || !raw.trim()) {
    if (!required) return undefined;
    throw new Error(`${PUBLIC_SERVER_BASE_ENV_VAR} must be set to the canonical HTTPS server origin when NODE_ENV=production`);
  }

  const value = raw.trim().replace(/\/+$/, "");
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${PUBLIC_SERVER_BASE_ENV_VAR} must be an absolute server origin`);
  }

  const host = parsed.hostname.toLowerCase();
  if (value !== parsed.origin) {
    throw new Error(`${PUBLIC_SERVER_BASE_ENV_VAR} must not include paths, query strings or fragments`);
  }
  if (required && parsed.protocol !== "https:") {
    throw new Error(`${PUBLIC_SERVER_BASE_ENV_VAR} must use HTTPS when NODE_ENV=production`);
  }
  if (required && (PLACEHOLDER_ORIGINS.has(parsed.origin) || LOCAL_TRUST_ROOT_HOSTS.has(host) || isPrivateIpv4(host) || isLocalIpv6(host))) {
    throw new Error(`${PUBLIC_SERVER_BASE_ENV_VAR} must be a public production origin`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`${PUBLIC_SERVER_BASE_ENV_VAR} must use HTTP or HTTPS`);
  }

  return parsed.origin;
}

function normalizedMcpBearerToken(env: Env, required: boolean) {
  const raw = configuredSecret(env, MCP_BEARER_TOKEN_ENV_VAR);
  const token = typeof raw === "string" ? raw.trim() : "";
  if (!token) {
    if (!required) return undefined;
    throw new Error(`${MCP_BEARER_TOKEN_ENV_VAR} must be set when NODE_ENV=production`);
  }
  if (token.length < 32) {
    throw new Error(`${MCP_BEARER_TOKEN_ENV_VAR} must contain at least 32 characters`);
  }
  return token;
}

function normalizedMcpPlayerTokenJsonlPath(env: Env, required: boolean) {
  const raw = env[MCP_PLAYER_TOKEN_JSONL_PATH_ENV_VAR];
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value) {
    if (!required) return undefined;
    throw new Error(`${MCP_PLAYER_TOKEN_JSONL_PATH_ENV_VAR} must be set when NODE_ENV=production`);
  }
  if (!isAbsolute(value)) {
    throw new Error(`${MCP_PLAYER_TOKEN_JSONL_PATH_ENV_VAR} must be an absolute path`);
  }
  return value;
}

function normalizedMcpPlayerTokenTtlMs(env: Env) {
  const raw = env[MCP_PLAYER_TOKEN_TTL_SECONDS_ENV_VAR];
  const seconds = raw === undefined || raw.trim() === "" ? 43_200 : Number(raw);
  if (!Number.isSafeInteger(seconds) || seconds < 300 || seconds > 86_400) {
    throw new Error(`${MCP_PLAYER_TOKEN_TTL_SECONDS_ENV_VAR} must be an integer from 300 to 86400`);
  }
  return seconds * 1_000;
}

function normalizedRegistrationSecret(env: Env, required: boolean) {
  const raw = configuredSecret(env, REGISTRATION_SECRET_ENV_VAR);
  const secret = typeof raw === "string" ? raw.trim() : "";
  if (!secret) {
    if (!required) return undefined;
    throw new Error(`${REGISTRATION_SECRET_ENV_VAR} must be set when NODE_ENV=production`);
  }
  if (secret.length < 32) {
    throw new Error(`${REGISTRATION_SECRET_ENV_VAR} must contain at least 32 characters`);
  }
  return secret;
}

function normalizedPublicRegistrationProtection(
  env: Env,
  production: boolean,
  credentials: readonly (string | undefined)[],
): PublicRegistrationProtectionConfig {
  const rawMode = env[PUBLIC_REGISTRATION_MODE_ENV_VAR]?.trim();
  const mode = rawMode || (production ? "enforce" : "permissive");
  if (mode !== "enforce" && mode !== "permissive") {
    throw new Error(`${PUBLIC_REGISTRATION_MODE_ENV_VAR} must be enforce or permissive`);
  }
  if (production && mode !== "enforce") {
    throw new Error(`${PUBLIC_REGISTRATION_MODE_ENV_VAR} must be enforce when NODE_ENV=production`);
  }

  const rawSecret = configuredSecret(env, REGISTRATION_ACTOR_HASH_SECRET_ENV_VAR);
  const actorHashSecret = typeof rawSecret === "string" ? rawSecret.trim() : "";
  if (mode === "enforce" && actorHashSecret.length < 32) {
    throw new Error(`${REGISTRATION_ACTOR_HASH_SECRET_ENV_VAR} must contain at least 32 characters when registration protection is enforced`);
  }
  if (actorHashSecret && credentials.some((credential) => credential?.trim() === actorHashSecret)) {
    throw new Error(`${REGISTRATION_ACTOR_HASH_SECRET_ENV_VAR} must be independent from MCP, operator, and registration credentials`);
  }

  const trustProxyHops = normalizedIntegerEnv(
    env,
    REGISTRATION_TRUST_PROXY_HOPS_ENV_VAR,
    production ? undefined : 0,
    0,
    16,
  );
  const windowSeconds = normalizedIntegerEnv(env, REGISTRATION_WINDOW_SECONDS_ENV_VAR, 86_400, 300, 604_800);
  const maxActions = normalizedIntegerEnv(env, REGISTRATION_MAX_ACTIONS_ENV_VAR, 8, 2, 100);
  const cooldownSeconds = normalizedIntegerEnv(env, REGISTRATION_COOLDOWN_SECONDS_ENV_VAR, 30, 1, 3_600);
  if (cooldownSeconds > windowSeconds) {
    throw new Error(`${REGISTRATION_COOLDOWN_SECONDS_ENV_VAR} must not exceed ${REGISTRATION_WINDOW_SECONDS_ENV_VAR}`);
  }
  const challengeTtlSeconds = normalizedIntegerEnv(
    env,
    REGISTRATION_DEVICE_CHALLENGE_TTL_SECONDS_ENV_VAR,
    86_400,
    300,
    604_800,
  );
  const invites = (configuredSecret(env, REGISTRATION_INVITES_ENV_VAR) || "")
    .split(",")
    .map((invite) => invite.trim())
    .filter(Boolean);
  const inviteActorHashes = actorHashSecret
    ? [...new Set(invites.map((invite) => publicRegistrationInviteActorHash(actorHashSecret, invite)))]
    : [];

  return {
    mode,
    ...(actorHashSecret ? { actorHashSecret } : {}),
    trustProxyHops,
    windowMs: windowSeconds * 1_000,
    maxActions,
    cooldownMs: cooldownSeconds * 1_000,
    deviceChallengeTtlMs: challengeTtlSeconds * 1_000,
    inviteActorHashes,
    secureCookies: production,
  };
}

function normalizedIntegerEnv(
  env: Env,
  name: string,
  fallback: number | undefined,
  minimum: number,
  maximum: number,
): number {
  const raw = env[name];
  if (raw === undefined || raw.trim() === "") {
    if (fallback !== undefined) return fallback;
    throw new Error(`${name} must be explicitly configured`);
  }
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be an integer from ${minimum} to ${maximum}`);
  }
  return value;
}

function normalizedConsoleMediaBaseUrl(env: Env) {
  const raw = env[CONSOLE_MEDIA_BASE_URL_ENV_VAR];
  if (typeof raw !== "string") return undefined;

  const value = raw.trim().replace(/\/+$/, "");
  if (!value) throw new Error(`${CONSOLE_MEDIA_BASE_URL_ENV_VAR} must not be blank when set`);

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${CONSOLE_MEDIA_BASE_URL_ENV_VAR} must be an absolute HTTPS URL`);
  }

  const host = parsed.hostname.toLowerCase();
  if (PLACEHOLDER_ORIGINS.has(parsed.origin)) {
    throw new Error(`${CONSOLE_MEDIA_BASE_URL_ENV_VAR} contains placeholder media origin: ${parsed.origin}`);
  }
  if (parsed.protocol !== "https:") {
    throw new Error(`${CONSOLE_MEDIA_BASE_URL_ENV_VAR} must use HTTPS`);
  }
  if (LOCAL_TRUST_ROOT_HOSTS.has(host) || isPrivateIpv4(host) || isLocalIpv6(host)) {
    throw new Error(`${CONSOLE_MEDIA_BASE_URL_ENV_VAR} contains local media origin: ${parsed.origin}`);
  }
  if (parsed.search || parsed.hash) {
    throw new Error(`${CONSOLE_MEDIA_BASE_URL_ENV_VAR} must not include query strings or fragments`);
  }

  return value;
}

export function productionAgentServerConfigFromEnv(env: Env): AgentServerStartupConfig {
  const consoleAssetBaseUrl = normalizedConsoleMediaBaseUrl(env);
  const attestedRunners = attestedRunnersFromEnv(env);

  if (env.NODE_ENV === "production") {
    const packageSigning = requireProductionPackageSigningKey(env);
    const runtimeActionSigning = requireProductionRuntimeActionSigningKey(env);
    const runtimeActionVerificationKeys = configuredSecret(env, RUNTIME_ACTION_VERIFICATION_KEYS_ENV_VAR);
    if (runtimeActionVerificationKeys) {
      parseRuntimeActionVerificationPublicKeys(runtimeActionVerificationKeys);
    }
    if (runtimeActionSigning.keyId === packageSigning.releaseKeyId) {
      throw new Error(`${RUNTIME_ACTION_SIGNING_ENV_VAR} must be independent from ${OBSIDIAN_EPOCH_PACKAGE_SIGNING_ENV_VAR}`);
    }
    const operatorKey = normalizedProductionOperatorKey(env);
    const mcpBearerToken = normalizedMcpBearerToken(env, true);
    const registrationSecret = normalizedRegistrationSecret(env, true);
    if (registrationSecret === mcpBearerToken || registrationSecret === operatorKey) {
      throw new Error(`${REGISTRATION_SECRET_ENV_VAR} must be independent from MCP and operator credentials`);
    }
    const publicRegistrationProtection = normalizedPublicRegistrationProtection(env, true, [
      mcpBearerToken,
      registrationSecret,
      operatorKey,
      packageSigning.privateKeyPem,
      runtimeActionSigning.privateKeyPem,
    ]);
    requireIndependentOperatorKey(operatorKey, [
      { name: MCP_BEARER_TOKEN_ENV_VAR, value: mcpBearerToken },
      { name: REGISTRATION_SECRET_ENV_VAR, value: registrationSecret },
      { name: REGISTRATION_ACTOR_HASH_SECRET_ENV_VAR, value: publicRegistrationProtection.actorHashSecret },
      { name: OBSIDIAN_EPOCH_PACKAGE_SIGNING_ENV_VAR, value: packageSigning.privateKeyPem },
      { name: RUNTIME_ACTION_SIGNING_ENV_VAR, value: runtimeActionSigning.privateKeyPem },
    ]);
    const protectedCredentials = new Set([
      mcpBearerToken,
      registrationSecret,
      operatorKey,
      publicRegistrationProtection.actorHashSecret,
      packageSigning.privateKeyPem,
      runtimeActionSigning.privateKeyPem,
    ]);
    const runnerIds = new Set<string>();
    const runnerSecrets = new Set<string>();
    for (const runner of attestedRunners) {
      if (runner.secret.trim().length < 32) {
        throw new Error("AGENT_SERVER_ATTESTED_RUNNER secret must contain at least 32 characters when NODE_ENV=production");
      }
      if (runnerIds.has(runner.runnerId)) throw new Error("AGENT_SERVER_ATTESTED_RUNNER runnerId values must be unique");
      if (runnerSecrets.has(runner.secret)) throw new Error("AGENT_SERVER_ATTESTED_RUNNER secrets must be unique");
      if (protectedCredentials.has(runner.secret)) {
        throw new Error("AGENT_SERVER_ATTESTED_RUNNER secrets must be independent from server credentials");
      }
      runnerIds.add(runner.runnerId);
      runnerSecrets.add(runner.secret);
    }
    return {
      allowedOrigins: requireProductionAllowedOrigins(env),
      consoleAssetBaseUrl,
      publicServerBase: normalizedPublicServerBase(env, true),
      mcpBearerToken,
      mcpPlayerTokenJsonlPath: normalizedMcpPlayerTokenJsonlPath(env, true),
      mcpPlayerTokenTtlMs: normalizedMcpPlayerTokenTtlMs(env),
      packageReleaseKeyId: packageSigning.releaseKeyId,
      runtimeActionKeyId: runtimeActionSigning.keyId,
      operatorKey,
      registrationSecret,
      attestedRunners,
      publicRegistrationProtection,
    };
  }

  const mcpBearerToken = normalizedMcpBearerToken(env, false);
  const registrationSecret = normalizedRegistrationSecret(env, false);
  const operatorKey = configuredSecret(env, OPERATOR_KEY_ENV_VAR);

  return {
    allowedOrigins: parseAllowedOrigins(env.AGENT_SERVER_ALLOWED_ORIGINS),
    consoleAssetBaseUrl,
    publicServerBase: normalizedPublicServerBase(env, false),
    mcpBearerToken,
    mcpPlayerTokenJsonlPath: normalizedMcpPlayerTokenJsonlPath(env, false),
    mcpPlayerTokenTtlMs: normalizedMcpPlayerTokenTtlMs(env),
    operatorKey,
    registrationSecret,
    attestedRunners,
    publicRegistrationProtection: normalizedPublicRegistrationProtection(env, false, [
      mcpBearerToken,
      registrationSecret,
      operatorKey,
    ]),
  };
}
