import assert from "node:assert/strict";
import { createHash, createPublicKey, generateKeyPairSync } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { OBSIDIAN_EPOCH_PACKAGE_SIGNING_ENV_VAR } from "../lib/packageArchive.ts";
import { productionAgentServerConfigFromEnv } from "../lib/productionConfig.ts";

const VALID_PRIVATE_KEY = generateKeyPairSync("ed25519").privateKey
  .export({ type: "pkcs8", format: "pem" })
  .toString();

function releaseKeyId(privateKeyPem: string) {
  const publicKeyDer = createPublicKey(privateKeyPem).export({ type: "spki", format: "der" });
  return createHash("sha256").update(publicKeyDer).digest("hex");
}

function productionEnv(overrides: Record<string, string | undefined> = {}) {
  return {
    NODE_ENV: "production",
    AGENT_SERVER_ALLOWED_ORIGINS: "https://epoch.example",
    AGENT_PUBLIC_SERVER_BASE: "https://epoch.example",
    AGENT_SERVER_MCP_BEARER_TOKEN: "production-mcp-token-at-least-32-characters",
    AGENT_SERVER_OPERATOR_KEY: "production-operator-key-at-least-32-characters",
    AGENT_SERVER_MCP_PLAYER_TOKEN_JSONL_PATH: "/data/player-mcp-access-tokens.jsonl",
    AGENT_SERVER_REGISTRATION_SECRET: "production-registration-secret-at-least-32-characters",
    AGENT_SERVER_REGISTRATION_ACTOR_HASH_SECRET: "production-registration-actor-hash-secret-at-least-32-characters",
    AGENT_SERVER_REGISTRATION_TRUST_PROXY_HOPS: "1",
    [OBSIDIAN_EPOCH_PACKAGE_SIGNING_ENV_VAR]: VALID_PRIVATE_KEY,
    ...overrides,
  };
}

test("production server config loads long-lived secrets from files and rejects ambiguous precedence", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "epoch-production-secret-files-"));
  const values = {
    AGENT_SERVER_MCP_BEARER_TOKEN: "file-mcp-token-at-least-32-characters-long",
    AGENT_SERVER_OPERATOR_KEY: "file-operator-key-at-least-32-characters-long",
    AGENT_SERVER_REGISTRATION_SECRET: "file-registration-secret-at-least-32-characters",
    AGENT_SERVER_REGISTRATION_ACTOR_HASH_SECRET: "file-actor-hash-secret-at-least-32-characters",
    [OBSIDIAN_EPOCH_PACKAGE_SIGNING_ENV_VAR]: VALID_PRIVATE_KEY,
  };
  const overrides: Record<string, string | undefined> = {};
  try {
    for (const [name, value] of Object.entries(values)) {
      const filePath = join(tempDir, `${name}.txt`);
      writeFileSync(filePath, value, { mode: 0o600 });
      overrides[name] = undefined;
      overrides[`${name}_FILE`] = filePath;
    }
    const config = productionAgentServerConfigFromEnv(productionEnv(overrides));
    assert.equal(config.mcpBearerToken, values.AGENT_SERVER_MCP_BEARER_TOKEN);
    assert.equal(config.operatorKey, values.AGENT_SERVER_OPERATOR_KEY);
    assert.equal(config.registrationSecret, values.AGENT_SERVER_REGISTRATION_SECRET);
    assert.equal(config.packageReleaseKeyId, releaseKeyId(VALID_PRIVATE_KEY));

    assert.throws(
      () => productionAgentServerConfigFromEnv(productionEnv({
        ...overrides,
        AGENT_SERVER_OPERATOR_KEY: values.AGENT_SERVER_OPERATOR_KEY,
      })),
      /AGENT_SERVER_OPERATOR_KEY and AGENT_SERVER_OPERATOR_KEY_FILE must not both be set/,
    );
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("production server config loads attested runner and invite bundles from files", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "epoch-production-runner-files-"));
  const runnersFile = join(tempDir, "runners.json");
  const invitesFile = join(tempDir, "invites.txt");
  const runnerSecret = "file-attested-runner-secret-at-least-32-characters";
  writeFileSync(runnersFile, JSON.stringify([{
    runnerId: "runner_file_1",
    keyId: "runner-file-key-1",
    secret: runnerSecret,
    trustClass: "remote_attested_runner",
  }]), { mode: 0o600 });
  writeFileSync(invitesFile, "invite-file-one-0001,invite-file-two-0002\n", { mode: 0o600 });
  try {
    const config = productionAgentServerConfigFromEnv(productionEnv({
      AGENT_SERVER_ATTESTED_RUNNERS_FILE: runnersFile,
      AGENT_SERVER_REGISTRATION_INVITES_FILE: invitesFile,
    }));
    assert.equal(config.attestedRunners[0]?.runnerId, "runner_file_1");
    assert.equal(config.attestedRunners[0]?.secret, runnerSecret);
    assert.equal(config.publicRegistrationProtection.inviteActorHashes.length, 2);
    assert.throws(() => productionAgentServerConfigFromEnv(productionEnv({
      AGENT_SERVER_ATTESTED_RUNNERS: JSON.stringify([{ runnerId: "short", secret: "short" }]),
    })), /at least 32 characters/);
    assert.throws(() => productionAgentServerConfigFromEnv(productionEnv({
      AGENT_SERVER_ATTESTED_RUNNERS: JSON.stringify([{
        runnerId: "reused",
        secret: "production-operator-key-at-least-32-characters",
      }]),
    })), /independent/);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("production server config accepts exact HTTPS origins and operator signing key", () => {
  const config = productionAgentServerConfigFromEnv(productionEnv({
    AGENT_SERVER_ALLOWED_ORIGINS: " https://epoch.example,https://console.epoch.example ",
    AGENT_EPOCH_CONSOLE_MEDIA_BASE_URL: " https://cdn.epoch.example/obsidian-epoch/assets/media/ ",
  }));

  assert.deepEqual(config.allowedOrigins, ["https://epoch.example", "https://console.epoch.example"]);
  assert.equal(config.consoleAssetBaseUrl, "https://cdn.epoch.example/obsidian-epoch/assets/media");
  assert.equal(config.publicServerBase, "https://epoch.example");
  assert.equal(config.mcpBearerToken, "production-mcp-token-at-least-32-characters");
  assert.equal(config.mcpPlayerTokenJsonlPath, "/data/player-mcp-access-tokens.jsonl");
  assert.equal(config.mcpPlayerTokenTtlMs, 43_200_000);
  assert.equal(config.packageReleaseKeyId, releaseKeyId(VALID_PRIVATE_KEY));
  assert.equal(config.registrationSecret, "production-registration-secret-at-least-32-characters");
  assert.equal(config.publicRegistrationProtection.mode, "enforce");
  assert.equal(config.publicRegistrationProtection.trustProxyHops, 1);
  assert.equal(config.publicRegistrationProtection.maxActions, 8);
  assert.equal(config.publicRegistrationProtection.windowMs, 86_400_000);
  assert.equal(config.publicRegistrationProtection.cooldownMs, 30_000);
  assert.equal(config.publicRegistrationProtection.secureCookies, true);
});

test("production server config requires a strong MCP bearer token", () => {
  for (const mcpBearerToken of [undefined, "", "short-token"]) {
    assert.throws(
      () => productionAgentServerConfigFromEnv(productionEnv({ AGENT_SERVER_MCP_BEARER_TOKEN: mcpBearerToken })),
      /AGENT_SERVER_MCP_BEARER_TOKEN/,
      `expected MCP bearer token ${String(mcpBearerToken)} to be rejected`,
    );
  }
});

test("production server config requires a strong independent operator key", () => {
  for (const operatorKey of [undefined, "", "short-operator-key"]) {
    assert.throws(
      () => productionAgentServerConfigFromEnv(productionEnv({ AGENT_SERVER_OPERATOR_KEY: operatorKey })),
      /AGENT_SERVER_OPERATOR_KEY/,
      `expected operator key ${String(operatorKey)} to be rejected`,
    );
  }

  const reused = "reused-production-operator-key-at-least-32-characters";
  for (const { operatorKey, credentials } of [
    { operatorKey: reused, credentials: { AGENT_SERVER_MCP_BEARER_TOKEN: reused } },
    { operatorKey: reused, credentials: { AGENT_SERVER_REGISTRATION_SECRET: reused } },
    { operatorKey: reused, credentials: { AGENT_SERVER_REGISTRATION_ACTOR_HASH_SECRET: reused } },
    {
      operatorKey: VALID_PRIVATE_KEY.trim(),
      credentials: { [OBSIDIAN_EPOCH_PACKAGE_SIGNING_ENV_VAR]: VALID_PRIVATE_KEY },
    },
  ]) {
    assert.throws(
      () => productionAgentServerConfigFromEnv(productionEnv({
        AGENT_SERVER_OPERATOR_KEY: operatorKey,
        ...credentials,
      })),
      /independent/,
    );
  }
});

test("production server config requires an absolute player MCP token ledger path", () => {
  for (const tokenPath of [undefined, "", "tokens.jsonl"]) {
    assert.throws(
      () => productionAgentServerConfigFromEnv(productionEnv({ AGENT_SERVER_MCP_PLAYER_TOKEN_JSONL_PATH: tokenPath })),
      /AGENT_SERVER_MCP_PLAYER_TOKEN_JSONL_PATH/,
      `expected player token ledger path ${String(tokenPath)} to be rejected`,
    );
  }
});

test("player MCP access token TTL stays short and bounded", () => {
  assert.equal(productionAgentServerConfigFromEnv(productionEnv({
    AGENT_SERVER_MCP_PLAYER_TOKEN_TTL_SECONDS: "300",
  })).mcpPlayerTokenTtlMs, 300_000);
  for (const ttl of ["299", "86401", "1.5", "invalid"]) {
    assert.throws(
      () => productionAgentServerConfigFromEnv(productionEnv({ AGENT_SERVER_MCP_PLAYER_TOKEN_TTL_SECONDS: ttl })),
      /AGENT_SERVER_MCP_PLAYER_TOKEN_TTL_SECONDS/,
    );
  }
});

test("production server config requires an independent strong registration secret", () => {
  for (const secret of [undefined, "", "short-secret"]) {
    assert.throws(
      () => productionAgentServerConfigFromEnv(productionEnv({ AGENT_SERVER_REGISTRATION_SECRET: secret })),
      /AGENT_SERVER_REGISTRATION_SECRET/,
    );
  }
  const reused = "reused-production-secret-at-least-32-characters";
  assert.throws(
    () => productionAgentServerConfigFromEnv(productionEnv({
      AGENT_SERVER_MCP_BEARER_TOKEN: reused,
      AGENT_SERVER_REGISTRATION_SECRET: reused,
    })),
    /independent/,
  );
  assert.throws(
    () => productionAgentServerConfigFromEnv(productionEnv({
      AGENT_SERVER_OPERATOR_KEY: reused,
      AGENT_SERVER_REGISTRATION_SECRET: reused,
    })),
    /independent/,
  );
});

test("production registration protection fails closed without persistent actor hashing configuration", () => {
  for (const secret of [undefined, "", "short-secret"]) {
    assert.throws(
      () => productionAgentServerConfigFromEnv(productionEnv({ AGENT_SERVER_REGISTRATION_ACTOR_HASH_SECRET: secret })),
      /AGENT_SERVER_REGISTRATION_ACTOR_HASH_SECRET/,
    );
  }
  assert.throws(
    () => productionAgentServerConfigFromEnv(productionEnv({ AGENT_SERVER_REGISTRATION_TRUST_PROXY_HOPS: undefined })),
    /AGENT_SERVER_REGISTRATION_TRUST_PROXY_HOPS/,
  );
  assert.throws(
    () => productionAgentServerConfigFromEnv(productionEnv({ AGENT_SERVER_PUBLIC_REGISTRATION_MODE: "permissive" })),
    /AGENT_SERVER_PUBLIC_REGISTRATION_MODE/,
  );
});

test("registration actor hash secret is independent and policy limits stay bounded", () => {
  const reused = "production-registration-secret-at-least-32-characters";
  assert.throws(
    () => productionAgentServerConfigFromEnv(productionEnv({ AGENT_SERVER_REGISTRATION_ACTOR_HASH_SECRET: reused })),
    /independent/,
  );
  for (const [name, value] of [
    ["AGENT_SERVER_REGISTRATION_TRUST_PROXY_HOPS", "17"],
    ["AGENT_SERVER_REGISTRATION_WINDOW_SECONDS", "299"],
    ["AGENT_SERVER_REGISTRATION_MAX_ACTIONS", "1"],
    ["AGENT_SERVER_REGISTRATION_COOLDOWN_SECONDS", "0"],
    ["AGENT_SERVER_REGISTRATION_DEVICE_CHALLENGE_TTL_SECONDS", "604801"],
  ] as const) {
    assert.throws(
      () => productionAgentServerConfigFromEnv(productionEnv({ [name]: value })),
      new RegExp(name),
    );
  }
  assert.throws(
    () => productionAgentServerConfigFromEnv(productionEnv({
      AGENT_SERVER_REGISTRATION_WINDOW_SECONDS: "300",
      AGENT_SERVER_REGISTRATION_COOLDOWN_SECONDS: "301",
    })),
    /AGENT_SERVER_REGISTRATION_COOLDOWN_SECONDS/,
  );
});

test("production invite material is converted to keyed hashes before entering runtime config", () => {
  const invite = "launch-invite-secret-value";
  const config = productionAgentServerConfigFromEnv(productionEnv({
    AGENT_SERVER_REGISTRATION_INVITES: invite,
  }));
  assert.equal(config.publicRegistrationProtection.inviteActorHashes.length, 1);
  assert.match(config.publicRegistrationProtection.inviteActorHashes[0] || "", /^hmac-sha256:[a-f0-9]{64}$/);
  assert.equal(JSON.stringify(config.publicRegistrationProtection).includes(invite), false);
});

test("production server config requires a canonical public server origin", () => {
  for (const publicServerBase of [
    undefined,
    "",
    "http://epoch.example",
    "https://localhost:8787",
    "https://10.0.0.1",
    "https://your-domain.example",
    "https://epoch.example/path",
  ]) {
    assert.throws(
      () => productionAgentServerConfigFromEnv(productionEnv({ AGENT_PUBLIC_SERVER_BASE: publicServerBase })),
      /AGENT_PUBLIC_SERVER_BASE/,
      `expected public server base ${String(publicServerBase)} to be rejected`,
    );
  }
});

test("production server config rejects blank or placeholder trust roots", () => {
  const rejectedOrigins = [
    undefined,
    "",
    "   ",
    "*",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://host.docker.internal:8787",
    "https://0.0.0.0",
    "https://10.0.0.1",
    "https://172.16.0.2",
    "https://172.31.255.255",
    "https://192.168.1.10",
    "https://169.254.1.1",
    "https://[::1]",
    "https://your-domain.example",
    "https://epoch.example/path",
  ];

  for (const origin of rejectedOrigins) {
    assert.throws(
      () => productionAgentServerConfigFromEnv(productionEnv({ AGENT_SERVER_ALLOWED_ORIGINS: origin })),
      /AGENT_SERVER_ALLOWED_ORIGINS/,
      `expected production origin ${String(origin)} to be rejected`,
    );
  }
});

test("production server config rejects blank package signing private key", () => {
  for (const privateKey of [undefined, "", "   "]) {
    assert.throws(
      () => productionAgentServerConfigFromEnv(productionEnv({ [OBSIDIAN_EPOCH_PACKAGE_SIGNING_ENV_VAR]: privateKey })),
      /AGENT_PACKAGE_SIGNING_PRIVATE_KEY_PEM/,
      `expected production signing key ${String(privateKey)} to be rejected`,
    );
  }
});

test("production server config parses an Ed25519 signing key and rejects invalid or wrong key types", () => {
  const expectedKeyId = releaseKeyId(VALID_PRIVATE_KEY);
  for (const privateKey of [
    VALID_PRIVATE_KEY.replaceAll("\n", "\\n"),
    JSON.stringify(VALID_PRIVATE_KEY),
  ]) {
    assert.equal(
      productionAgentServerConfigFromEnv(productionEnv({
        [OBSIDIAN_EPOCH_PACKAGE_SIGNING_ENV_VAR]: privateKey,
      })).packageReleaseKeyId,
      expectedKeyId,
    );
  }

  for (const privateKey of [
    "not-an-ed25519-private-key-but-long-enough",
    "-----BEGIN PRIVATE KEY-----\ninvalid\n-----END PRIVATE KEY-----",
  ]) {
    assert.throws(
      () => productionAgentServerConfigFromEnv(productionEnv({
        [OBSIDIAN_EPOCH_PACKAGE_SIGNING_ENV_VAR]: privateKey,
      })),
      /valid Ed25519 private key/,
    );
  }

  const { privateKey: ecPrivateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  assert.throws(
    () => productionAgentServerConfigFromEnv(productionEnv({
      [OBSIDIAN_EPOCH_PACKAGE_SIGNING_ENV_VAR]: ecPrivateKey.export({ type: "pkcs8", format: "pem" }).toString(),
    })),
    /must contain an Ed25519 private key/,
  );
});

test("production server config rejects unsafe console media base URLs", () => {
  const rejectedMediaBaseUrls = [
    "",
    "   ",
    "http://cdn.epoch.example/obsidian-epoch/assets/media",
    "https://localhost/assets/media",
    "https://127.0.0.1/assets/media",
    "https://10.0.0.1/assets/media",
    "https://your-domain.example/assets/media",
    "https://cdn.your-domain.example/obsidian-epoch/assets/media",
    "https://cdn.epoch.example/assets/media?token=secret",
    "not-a-url",
  ];

  for (const mediaBaseUrl of rejectedMediaBaseUrls) {
    assert.throws(
      () => productionAgentServerConfigFromEnv(productionEnv({ AGENT_EPOCH_CONSOLE_MEDIA_BASE_URL: mediaBaseUrl })),
      /AGENT_EPOCH_CONSOLE_MEDIA_BASE_URL/,
      `expected production console media base ${String(mediaBaseUrl)} to be rejected`,
    );
  }
});

test("non-production server config preserves local development defaults", () => {
  const config = productionAgentServerConfigFromEnv({
    NODE_ENV: "development",
    AGENT_SERVER_OPERATOR_KEY: "short-development-key",
  });

  assert.deepEqual(config.allowedOrigins, ["http://127.0.0.1:5173", "http://localhost:5173", "null"]);
  assert.equal(config.publicServerBase, undefined);
  assert.equal(config.mcpBearerToken, undefined);
  assert.equal(config.mcpPlayerTokenJsonlPath, undefined);
  assert.equal(config.mcpPlayerTokenTtlMs, 43_200_000);
  assert.equal(config.registrationSecret, undefined);
  assert.equal(config.publicRegistrationProtection.mode, "permissive");
  assert.equal(config.publicRegistrationProtection.actorHashSecret, undefined);
  assert.equal(config.publicRegistrationProtection.trustProxyHops, 0);
  assert.equal(config.publicRegistrationProtection.secureCookies, false);
});

test("non-production server config accepts an explicit local public server base", () => {
  const config = productionAgentServerConfigFromEnv({
    NODE_ENV: "development",
    AGENT_PUBLIC_SERVER_BASE: "http://127.0.0.1:8789/",
  });

  assert.equal(config.publicServerBase, "http://127.0.0.1:8789");
});
