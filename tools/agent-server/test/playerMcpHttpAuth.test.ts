import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createAgentHttpServer } from "../lib/httpServer.ts";
import { MCP_PROTOCOL_VERSION, createAgentWorldRuntime } from "../lib/mcpTools.ts";
import { PlayerMcpAccessTokenStore } from "../lib/playerMcpAccessTokenStore.ts";
import {
  type PublicRegistrationProtectionConfig,
  publicRegistrationInviteActorHash,
} from "../lib/publicRegistrationProtection.ts";

const BOOTSTRAP_TOKEN = "bootstrap-mcp-token-at-least-32-characters";

function recoveryCode(explorerId: string, localSecret: string): string {
  return Buffer.from(JSON.stringify({ explorerId, localSecret }), "utf8").toString("base64");
}

function issuedAgentId(result: ReturnType<ReturnType<typeof createAgentWorldRuntime>["epochIdentity"]>): string {
  assert.ok("value" in result);
  return result.value.agentId;
}

async function postTool(
  baseUrl: string,
  bearerToken: string,
  name: string,
  toolArguments: Record<string, unknown>,
) {
  const response = await fetch(`${baseUrl}/api/epoch/mcp/tools/call`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${bearerToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ name, arguments: toolArguments }),
  });
  return { status: response.status, body: await response.json() as Record<string, unknown> };
}

async function postMcpTool(
  baseUrl: string,
  bearerToken: string,
  name: string,
  toolArguments: Record<string, unknown>,
) {
  const commonHeaders = {
    accept: "application/json, text/event-stream",
    authorization: `Bearer ${bearerToken}`,
    "content-type": "application/json",
  };
  const initialize = await fetch(`${baseUrl}/mcp`, {
    method: "POST",
    headers: commonHeaders,
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "player-mcp-initialize",
      method: "initialize",
      params: {
        protocolVersion: MCP_PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: { name: "player-mcp-http-auth-test", version: "1" },
      },
    }),
  });
  const sessionId = initialize.headers.get("mcp-session-id") || "";
  assert.equal(initialize.status, 200);
  assert.ok(sessionId);
  const sessionHeaders = {
    ...commonHeaders,
    "mcp-protocol-version": MCP_PROTOCOL_VERSION,
    "mcp-session-id": sessionId,
  };
  const initialized = await fetch(`${baseUrl}/mcp`, {
    method: "POST",
    headers: sessionHeaders,
    body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
  });
  assert.equal(initialized.status, 202);
  const response = await fetch(`${baseUrl}/mcp`, {
    method: "POST",
    headers: sessionHeaders,
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name, arguments: toolArguments },
    }),
  });
  const result = { status: response.status, body: await response.json() as Record<string, unknown> };
  await fetch(`${baseUrl}/mcp`, { method: "DELETE", headers: sessionHeaders });
  return result;
}

async function postJson(
  baseUrl: string,
  path: string,
  body: Record<string, unknown>,
  extraHeaders: Readonly<Record<string, string>> = {},
) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...extraHeaders },
    body: JSON.stringify(body),
  });
  return {
    status: response.status,
    body: await response.json() as Record<string, unknown>,
    headers: response.headers,
  };
}

function enforcedProtection(
  secret: string,
  overrides: Partial<PublicRegistrationProtectionConfig> = {},
): PublicRegistrationProtectionConfig {
  return {
    mode: "enforce",
    actorHashSecret: secret,
    trustProxyHops: 1,
    windowMs: 60_000,
    maxActions: 2,
    cooldownMs: 30_000,
    deviceChallengeTtlMs: 300_000,
    inviteActorHashes: [],
    secureCookies: true,
    ...overrides,
  };
}

test("public pairing server-issues identity before minting a short-lived player token", async () => {
  const runtime = createAgentWorldRuntime();
  const tokenStore = await PlayerMcpAccessTokenStore.open();
  const persistedEpochEvents: Record<string, unknown>[] = [];
  const server = createAgentHttpServer({
    runtime,
    playerMcpAccessTokens: tokenStore,
    playerMcpTokenTtlMs: 300_000,
    persistJsonl: async (fileName, record) => {
      if (fileName === "epoch-events.jsonl" && record && typeof record === "object" && !Array.isArray(record)) {
        persistedEpochEvents.push(record as Record<string, unknown>);
      }
    },
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const pairingPage = await fetch(`${baseUrl}/epoch/pair`);
    const pairingHtml = await pairingPage.text();
    assert.equal(pairingPage.status, 200);
    assert.match(pairingPage.headers.get("cache-control") || "", /no-store/);
    assert.match(pairingHtml, /action="\/epoch\/pair\/register"/);
    assert.doesNotMatch(pairingHtml, /name="identityName"/);
    assert.match(pairingHtml, /身份名称、初始寿命与第一世经历由服务器规则签发/);
    assert.doesNotMatch(pairingHtml, /<script/i);

    const crossSiteForm = await fetch(`${baseUrl}/epoch/pair/register`, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "sec-fetch-site": "cross-site",
      },
      body: new URLSearchParams({ identityName: "跨站批量注册" }),
    });
    assert.equal(crossSiteForm.status, 403);

    const formResponse = await fetch(`${baseUrl}/epoch/pair/register`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(),
    });
    const credentialHtml = await formResponse.text();
    assert.equal(formResponse.status, 201);
    assert.match(formResponse.headers.get("cache-control") || "", /no-store/);
    assert.equal(formResponse.headers.get("referrer-policy"), "no-referrer");
    assert.match(credentialHtml, /AGENT_WORLD_MCP_TOKEN/);
    assert.doesNotMatch(credentialHtml, /<script/i);

    const legacyIssue = await postJson(baseUrl, "/api/epoch/identity/issue", {
      explorerId: "explorer_caller_chosen",
      recoveryCode: recoveryCode("explorer_caller_chosen", "local_caller_chosen_secret"),
      idempotencyKey: "caller-chosen-registration",
    });
    assert.equal(legacyIssue.status, 401);

    const paired = await postJson(baseUrl, "/api/epoch/pairing/register", {
      explorerId: "explorer_caller_chosen",
      localSecret: "local_caller_chosen_secret",
      actorExplorerId: "empire_commander",
      identityName: "帝国统帅",
      maxLifetime: 999_999,
      idempotencyKey: "server-issued-pairing",
    });
    assert.equal(paired.status, 201, JSON.stringify(paired.body));
    assert.match(String(paired.body.explorerId), /^explorer_[a-f0-9]{32}$/);
    assert.notEqual(paired.body.explorerId, "explorer_caller_chosen");
    assert.equal(typeof paired.body.recoveryCode, "string");
    assert.match(String(paired.body.agentId), /agent_/);
    assert.notEqual(paired.body.identityName, "帝国统帅");
    assert.doesNotMatch(JSON.stringify(paired.body), /caller_chosen_secret|empire_commander/);
    const persistedIdentity = persistedEpochEvents
      .map((entry) => entry.event)
      .find((event) => event && typeof event === "object" && (event as Record<string, unknown>).eventType === "identity_issued") as Record<string, unknown>;
    const persistedIdentityPayload = persistedIdentity.payload as Record<string, unknown>;
    assert.match(String(persistedIdentityPayload.explorerSecretHash), /^sha256:[a-f0-9]{64}$/);

    const token = await postJson(baseUrl, "/api/epoch/mcp/access-tokens", {
      explorerId: paired.body.explorerId,
      recoveryCode: paired.body.recoveryCode,
    });
    assert.equal(token.status, 201, JSON.stringify(token.body));
    assert.equal(token.body.tokenType, "Bearer");
    assert.match(String(token.body.accessToken), /^[A-Za-z0-9_-]{43}$/);
    assert.equal(
      Date.parse(String(token.body.expiresAt)) - Date.parse(String(token.body.issuedAt)),
      300_000,
    );

    const ownerWrite = await postTool(baseUrl, String(token.body.accessToken), "obsidian_epoch.set_downtime", {
      agentId: paired.body.agentId,
      mode: "meditation",
      idempotencyKey: "paired-player-write",
    });
    assert.equal(ownerWrite.status, 200, JSON.stringify(ownerWrite.body));

    const rotatedRecoveryCode = recoveryCode(String(paired.body.explorerId), "local_rotated_http_recovery_secret_1234567890");
    const rotated = await postJson(baseUrl, "/api/epoch/recovery/rotate", {
      explorerId: paired.body.explorerId,
      recoveryCode: paired.body.recoveryCode,
      newRecoveryCode: rotatedRecoveryCode,
      idempotencyKey: "paired-http-recovery-rotate",
    });
    assert.equal(rotated.status, 200, JSON.stringify(rotated.body));
    assert.doesNotMatch(JSON.stringify(rotated.body), /explorerSecretHash|sha256:/);
    const persistedRotation = persistedEpochEvents
      .map((entry) => entry.event)
      .find((event) => event && typeof event === "object" && (event as Record<string, unknown>).eventType === "explorer_recovery_rotated") as Record<string, unknown>;
    const persistedRotationPayload = persistedRotation.payload as Record<string, unknown>;
    assert.match(String(persistedRotationPayload.explorerSecretHash), /^sha256:[a-f0-9]{64}$/);

    const revoked = await postJson(baseUrl, "/api/epoch/mcp/access-tokens/revoke", {
      explorerId: paired.body.explorerId,
      recoveryCode: rotatedRecoveryCode,
      tokenId: token.body.tokenId,
    });
    assert.equal(revoked.status, 200, JSON.stringify(revoked.body));
    const rejectedAfterRevoke = await postTool(baseUrl, String(token.body.accessToken), "obsidian_epoch.progress", {
      agentId: paired.body.agentId,
    });
    assert.equal(rejectedAfterRevoke.status, 401);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("player MCP bearer authorizes only its explorer without exposing owner secrets to tool arguments", async () => {
  const runtime = createAgentWorldRuntime({
    journey: { worldNow: () => "2026-01-01T08:00:00.000Z" },
  });
  const explorerA = "explorer_player_token_a";
  const explorerB = "explorer_player_token_b";
  const issuedA = runtime.epochIdentity({
    explorerId: explorerA,
    recoveryCode: recoveryCode(explorerA, "local_player_token_a"),
    idempotencyKey: "issue-player-token-a",
  });
  const issuedB = runtime.epochIdentity({
    explorerId: explorerB,
    recoveryCode: recoveryCode(explorerB, "local_player_token_b"),
    idempotencyKey: "issue-player-token-b",
  });
  const agentA = issuedAgentId(issuedA);
  const agentB = issuedAgentId(issuedB);
  const tokenStore = await PlayerMcpAccessTokenStore.open();
  const playerToken = await tokenStore.issue({ explorerId: explorerA, ttlMs: 60_000 });
  const server = createAgentHttpServer({
    runtime,
    mcpBearerToken: BOOTSTRAP_TOKEN,
    playerMcpAccessTokens: tokenStore,
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const businessRuleDenial = await postTool(baseUrl, playerToken.bearerToken, "obsidian_epoch.set_downtime", {
      agentId: agentA,
      mode: "training",
      idempotencyKey: "player-token-downtime-without-preparation",
    });
    assert.equal(businessRuleDenial.status, 400);
    assert.equal(businessRuleDenial.body.error, "downtime_preparation_resource_insufficient");

    const accepted = await postTool(baseUrl, playerToken.bearerToken, "obsidian_epoch.set_downtime", {
      agentId: agentA,
      mode: "meditation",
      idempotencyKey: "player-token-set-downtime",
    });
    assert.equal(accepted.status, 200, JSON.stringify(accepted.body));

    const streamableAccepted = await postMcpTool(baseUrl, playerToken.bearerToken, "obsidian_epoch.progress", {
      agentId: agentA,
    });
    assert.equal(streamableAccepted.status, 200, JSON.stringify(streamableAccepted.body));
    assert.equal(streamableAccepted.body.jsonrpc, "2.0");

    const prepared = await postTool(baseUrl, playerToken.bearerToken, "obsidian_epoch.prepare_journey", {
      agentId: agentA,
      destinationRegionId: "region_gray_harbor",
      idempotencyKey: "player-token-prepare-journey",
    });
    assert.equal(prepared.status, 200, JSON.stringify(prepared.body));
    const preparedPayload = JSON.parse(String((prepared.body.content as Array<{ text: string }>)[0]?.text));
    const started = await postTool(baseUrl, playerToken.bearerToken, "obsidian_epoch.start_journey", {
      journeyId: preparedPayload.journey.journeyId,
      expectedVersion: preparedPayload.journey.version,
      idempotencyKey: "player-token-start-journey",
    });
    assert.equal(started.status, 200, JSON.stringify(started.body));
    const briefing = await postTool(baseUrl, playerToken.bearerToken, "obsidian_epoch.agent_briefing", {
      agentId: agentA,
    });
    assert.equal(briefing.status, 200, JSON.stringify(briefing.body));
    const briefingPayload = JSON.parse(String((briefing.body.content as Array<{ text: string }>)[0]?.text));
    assert.equal(briefingPayload.currentJourney.agentId, agentA);
    assert.equal(briefingPayload.recentEpisodes[0].phase, "arrival");

    const foreignBriefing = await postTool(baseUrl, playerToken.bearerToken, "obsidian_epoch.agent_briefing", {
      agentId: agentB,
    });
    assert.equal(foreignBriefing.status, 200);
    const foreignPayload = JSON.parse(String((foreignBriefing.body.content as Array<{ text: string }>)[0]?.text));
    assert.equal(foreignPayload.currentJourney, undefined);
    assert.equal(foreignPayload.interactionInboxTotal, 0);

    const impersonation = await postTool(baseUrl, playerToken.bearerToken, "obsidian_epoch.set_downtime", {
      agentId: agentB,
      mode: "training",
      idempotencyKey: "player-token-cross-explorer",
    });
    assert.equal(impersonation.status, 401);

    const forgedExplorerRegistration = await postTool(baseUrl, playerToken.bearerToken, "obsidian_epoch.identity", {
      explorerId: "explorer_player_token_forged",
      recoveryCode: recoveryCode("explorer_player_token_forged", "local_player_token_forged"),
      identityName: "帝国统帅",
      maxLifetime: 999_999,
      idempotencyKey: "player-token-forged-explorer-registration",
    });
    assert.equal(forgedExplorerRegistration.status, 401);

    const bootstrapWithoutOwnerProof = await postTool(baseUrl, BOOTSTRAP_TOKEN, "obsidian_epoch.set_downtime", {
      agentId: agentA,
      mode: "training",
      idempotencyKey: "bootstrap-cannot-impersonate",
    });
    assert.equal(bootstrapWithoutOwnerProof.status, 401);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("public pairing and player token issuance share a restart-safe trusted-metadata quota", async () => {
  const directory = await mkdtemp(join(tmpdir(), "public-registration-protection-"));
  const jsonlPath = join(directory, "player-access.jsonl");
  const actorHashSecret = "http-registration-actor-hash-secret-at-least-32-characters";
  const invite = "private-launch-invite-2026";
  const protection = enforcedProtection(actorHashSecret, {
    inviteActorHashes: [publicRegistrationInviteActorHash(actorHashSecret, invite)],
  });
  const persistedEpochRecords: Record<string, unknown>[] = [];
  let now = new Date("2026-01-01T00:00:00.000Z");

  async function start() {
    const tokenStore = await PlayerMcpAccessTokenStore.open({ jsonlPath, now: () => now });
    const server = createAgentHttpServer({
      runtime: createAgentWorldRuntime(),
      playerMcpAccessTokens: tokenStore,
      playerMcpTokenTtlMs: 300_000,
      publicRegistrationProtection: protection,
      persistJsonl: async (fileName, record) => {
        if (fileName === "epoch-events.jsonl" && record && typeof record === "object" && !Array.isArray(record)) {
          persistedEpochRecords.push(record as Record<string, unknown>);
        }
      },
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address() as AddressInfo;
    return { server, baseUrl: `http://127.0.0.1:${address.port}` };
  }

  const first = await start();
  try {
    const healthResponse = await fetch(`${first.baseUrl}/api/health`);
    const health = await healthResponse.json() as {
      readonly ok: boolean;
      readonly checks: { readonly publicRegistration: Record<string, unknown> };
    };
    assert.equal(health.ok, true);
    assert.deepEqual(health.checks.publicRegistration, {
      status: "enforce",
      mode: "enforce",
      persistent: true,
      trustedProxyHops: 1,
      windowMs: 60_000,
      maxActions: 2,
      cooldownMs: 30_000,
      deviceChallengeTtlMs: 300_000,
      invitesConfigured: 1,
      actorHashSecretConfigured: true,
    });

    const challengeResponse = await fetch(`${first.baseUrl}/api/epoch/pairing/challenge?invite=${encodeURIComponent(invite)}`);
    const challengeBody = await challengeResponse.json() as Record<string, unknown>;
    assert.equal(challengeResponse.status, 200);
    assert.equal(challengeBody.mode, "enforce");
    assert.match(String(challengeBody.challenge), /^v1\.\d+\.[A-Za-z0-9_-]{32}\.[A-Za-z0-9_-]{43}$/);
    assert.match(challengeResponse.headers.get("set-cookie") || "", /HttpOnly/);
    assert.match(challengeResponse.headers.get("set-cookie") || "", /Secure/);

    const trustedHeaders = {
      "x-forwarded-for": "203.0.113.10",
      "x-obsidian-epoch-device-challenge": String(challengeBody.challenge),
      "x-obsidian-epoch-registration-invite": invite,
    };
    const paired = await postJson(first.baseUrl, "/api/epoch/pairing/register", {
      actorKey: "body-controlled-actor-must-be-ignored",
      actorExplorerId: "body-controlled-explorer",
      idempotencyKey: "protected-pairing-first",
    }, trustedHeaders);
    assert.equal(paired.status, 201, JSON.stringify(paired.body));

    const token = await postJson(first.baseUrl, "/api/epoch/mcp/access-tokens", {
      explorerId: paired.body.explorerId,
      recoveryCode: paired.body.recoveryCode,
      actorKey: "different-body-actor-must-still-be-ignored",
    }, trustedHeaders);
    assert.equal(token.status, 201, JSON.stringify(token.body));

    const bodyForgery = await postJson(first.baseUrl, "/api/epoch/pairing/register", {
      actorKey: "fresh-body-actor",
      deviceId: "fresh-body-device",
      invite: "fresh-body-invite",
      idempotencyKey: "protected-pairing-body-forgery",
    }, trustedHeaders);
    assert.equal(bodyForgery.status, 429, JSON.stringify(bodyForgery.body));
    assert.equal(bodyForgery.body.error, "public_registration_rate_limited");
    assert.equal(bodyForgery.body.retryAfterMs, 60_000);
    assert.equal(bodyForgery.body.retryAt, "2026-01-01T00:01:00.000Z");
    assert.equal(bodyForgery.headers.get("retry-after"), "60");

    const invalidInvite = await postJson(first.baseUrl, "/api/epoch/pairing/register", {}, {
      "x-forwarded-for": "198.51.100.20",
      "x-obsidian-epoch-registration-invite": "invalid-invite-value",
    });
    assert.equal(invalidInvite.status, 403);
    assert.equal(invalidInvite.body.error, "public_registration_invite_invalid");

    const invalidChallenge = await postJson(first.baseUrl, "/api/epoch/pairing/register", {}, {
      "x-forwarded-for": "198.51.100.21",
      "x-obsidian-epoch-device-challenge": "v1.invalid.challenge.signature",
    });
    assert.equal(invalidChallenge.status, 403);
    assert.equal(invalidChallenge.body.error, "public_registration_device_challenge_invalid");

    const missingTrustedProxyMetadata = await postJson(first.baseUrl, "/api/epoch/pairing/register", {}, {});
    assert.equal(missingTrustedProxyMetadata.status, 400);
    assert.equal(missingTrustedProxyMetadata.body.error, "public_registration_actor_metadata_invalid");
  } finally {
    await new Promise<void>((resolve, reject) => first.server.close((error) => error ? reject(error) : resolve()));
  }

  try {
    const persisted = await readFile(jsonlPath, "utf8");
    assert.equal(persisted.includes("203.0.113.10"), false);
    assert.equal(persisted.includes(invite), false);
    assert.equal(persisted.includes(actorHashSecret), false);
    assert.doesNotMatch(persisted, /body-controlled|fresh-body/);
    assert.match(persisted, /"publicCredentialAdmission"/);
    assert.match(persisted, /"actorHashes":\["hmac-sha256:[a-f0-9]{64}"/);
    const persistedEpochJson = JSON.stringify(persistedEpochRecords);
    assert.doesNotMatch(persistedEpochJson, /body-controlled|fresh-body|private-launch-invite/);
    assert.match(persistedEpochJson, /public_credential_input/);

    now = new Date("2026-01-01T00:00:15.000Z");
    const restarted = await start();
    try {
      const afterRestart = await postJson(restarted.baseUrl, "/api/epoch/pairing/register", {
        actorKey: "another-forged-body-actor",
      }, { "x-forwarded-for": "203.0.113.10" });
      assert.equal(afterRestart.status, 429, JSON.stringify(afterRestart.body));
      assert.equal(afterRestart.body.retryAfterMs, 45_000);
    } finally {
      await new Promise<void>((resolve, reject) => restarted.server.close((error) => error ? reject(error) : resolve()));
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("enforced registration protection fails closed when its ledger is not persistent", async () => {
  const tokenStore = await PlayerMcpAccessTokenStore.open();
  const server = createAgentHttpServer({
    runtime: createAgentWorldRuntime(),
    playerMcpAccessTokens: tokenStore,
    publicRegistrationProtection: enforcedProtection(
      "fail-closed-registration-secret-at-least-32-characters",
      { trustProxyHops: 0 },
    ),
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const healthResponse = await fetch(`${baseUrl}/api/health`);
    assert.equal(healthResponse.status, 503);
    const health = await healthResponse.json() as {
      readonly ok: boolean;
      readonly checks: { readonly publicRegistration: Record<string, unknown> };
    };
    assert.equal(health.ok, false);
    assert.equal(health.checks.publicRegistration.status, "error");
    assert.equal(health.checks.publicRegistration.persistent, false);

    const rejected = await postJson(baseUrl, "/api/epoch/pairing/register", {
      actorKey: "cannot-disable-fail-closed-with-body",
    });
    assert.equal(rejected.status, 503);
    assert.equal(rejected.body.error, "public_registration_protection_unavailable");
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
