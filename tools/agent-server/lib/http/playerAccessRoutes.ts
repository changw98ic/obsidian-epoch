import { randomUUID } from "node:crypto";
import type { IncomingMessage } from "node:http";
import {
  renderEpochPairingCredentialPageHtml,
  renderEpochPairingPageHtml,
} from "../pairingPageHtml.ts";
import type { PlayerMcpAccessTokenStore } from "../playerMcpAccessTokenStore.ts";
import {
  type PublicCredentialAction,
  type PublicRegistrationProtectionConfig,
  PERMISSIVE_PUBLIC_REGISTRATION_PROTECTION,
  derivePublicRegistrationActor,
  deviceChallengeCookie,
  inviteCookieFromRequest,
  issuePublicRegistrationDeviceChallenge,
} from "../publicRegistrationProtection.ts";
import type { EpochHttpRouteContext } from "./httpRouteTypes.ts";

type PlayerAccessRouteContext = EpochHttpRouteContext & {
  readonly playerMcpAccessTokens?: PlayerMcpAccessTokenStore;
  readonly playerMcpTokenTtlMs: number;
  readonly publicServerBase: string;
  readonly publicRegistrationProtection?: PublicRegistrationProtectionConfig;
};

function requireTokenStore(store: PlayerMcpAccessTokenStore | undefined): PlayerMcpAccessTokenStore {
  if (!store) throw new Error("player_mcp_access_tokens_unavailable");
  return store;
}

async function readFormBody(request: IncomingMessage, maxBodyBytes: number): Promise<URLSearchParams> {
  const chunks: Buffer[] = [];
  let totalBytes = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buffer.byteLength;
    if (totalBytes > maxBodyBytes) throw new Error("json_body_too_large");
    chunks.push(buffer);
  }
  return new URLSearchParams(Buffer.concat(chunks).toString("utf8"));
}

function secureCredentialPageHeaders(context: PlayerAccessRouteContext): void {
  context.response.setHeader("cache-control", "no-store, max-age=0");
  context.response.setHeader("pragma", "no-cache");
  context.response.setHeader("referrer-policy", "no-referrer");
  context.response.setHeader("x-robots-tag", "noindex, nofollow");
}

function appendSetCookies(context: PlayerAccessRouteContext, cookies: readonly string[]): void {
  if (cookies.length === 0) return;
  const existing = context.response.getHeader("set-cookie");
  const existingCookies = Array.isArray(existing)
    ? existing.map(String)
    : typeof existing === "string"
      ? [existing]
      : [];
  context.response.setHeader("set-cookie", [...existingCookies, ...cookies]);
}

function requirePersistentProtectionStore(
  store: PlayerMcpAccessTokenStore | undefined,
  config: PublicRegistrationProtectionConfig,
): PlayerMcpAccessTokenStore {
  if (config.mode !== "enforce") throw new Error("public_registration_protection_unavailable");
  if (!store?.persistent) throw new Error("public_registration_protection_unavailable");
  return store;
}

async function admitPublicCredentialAction(
  request: IncomingMessage,
  store: PlayerMcpAccessTokenStore | undefined,
  config: PublicRegistrationProtectionConfig,
  action: PublicCredentialAction,
): Promise<void> {
  if (config.mode === "permissive") return;
  const persistentStore = requirePersistentProtectionStore(store, config);
  const actor = derivePublicRegistrationActor(request, config);
  await persistentStore.consumePublicCredentialAction({
    action,
    actorHashes: actor.actorHashes,
    windowMs: config.windowMs,
    maxActions: config.maxActions,
    cooldownMs: config.cooldownMs,
  });
}

export async function handleEpochPlayerAccessRoutes(context: PlayerAccessRouteContext): Promise<boolean> {
  const {
    allowedOrigins,
    maxBodyBytes,
    method,
    pathname,
    playerMcpAccessTokens,
    playerMcpTokenTtlMs,
    publicServerBase,
    publicRegistrationProtection = PERMISSIVE_PUBLIC_REGISTRATION_PROTECTION,
    request,
    response,
    runtime,
  } = context;

  if (method === "GET" && pathname === "/epoch/pair") {
    secureCredentialPageHeaders(context);
    if (publicRegistrationProtection.mode === "enforce") {
      const challenge = issuePublicRegistrationDeviceChallenge(publicRegistrationProtection);
      const inviteCookie = inviteCookieFromRequest(request, publicRegistrationProtection);
      appendSetCookies(context, [
        deviceChallengeCookie(challenge, publicRegistrationProtection),
        ...(inviteCookie ? [inviteCookie] : []),
      ]);
    }
    context.sendHtml(request, response, 200, renderEpochPairingPageHtml(), allowedOrigins);
    return true;
  }

  if (method === "GET" && pathname === "/api/epoch/pairing/challenge") {
    secureCredentialPageHeaders(context);
    if (publicRegistrationProtection.mode === "permissive") {
      context.sendJson(request, response, 200, { mode: "permissive" }, allowedOrigins);
      return true;
    }
    const challenge = issuePublicRegistrationDeviceChallenge(publicRegistrationProtection);
    const inviteCookie = inviteCookieFromRequest(request, publicRegistrationProtection);
    appendSetCookies(context, [
      deviceChallengeCookie(challenge, publicRegistrationProtection),
      ...(inviteCookie ? [inviteCookie] : []),
    ]);
    context.sendJson(request, response, 200, {
      mode: "enforce",
      challenge: challenge.challenge,
      expiresAt: challenge.expiresAt,
      headerName: "x-obsidian-epoch-device-challenge",
    }, allowedOrigins);
    return true;
  }

  if (method === "POST" && pathname === "/epoch/pair/register") {
    const fetchSite = request.headers["sec-fetch-site"];
    if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") {
      throw new Error("pairing_origin_forbidden");
    }
    const store = requireTokenStore(playerMcpAccessTokens);
    await readFormBody(request, maxBodyBytes);
    await admitPublicCredentialAction(
      request,
      playerMcpAccessTokens,
      publicRegistrationProtection,
      "pairing_registration",
    );
    const registration = runtime.epochRegisterExplorer({
      idempotencyKey: `web-pair-${randomUUID()}`,
    });
    await context.persistEpochEvents(registration);
    const access = await store.issue({ explorerId: registration.explorerId, ttlMs: playerMcpTokenTtlMs });
    secureCredentialPageHeaders(context);
    context.sendHtml(request, response, 201, renderEpochPairingCredentialPageHtml({
      explorerId: registration.explorerId,
      agentId: registration.value.agentId,
      recoveryCode: registration.recoveryCode,
      accessToken: access.bearerToken,
      expiresAt: access.record.expiresAt,
      serverBase: publicServerBase,
    }), allowedOrigins);
    return true;
  }

  if (method === "POST" && pathname === "/api/epoch/pairing/register") {
    const input = await context.readJsonBody(request, maxBodyBytes);
    await admitPublicCredentialAction(
      request,
      playerMcpAccessTokens,
      publicRegistrationProtection,
      "pairing_registration",
    );
    const result = runtime.epochRegisterExplorer(input);
    await context.persistEpochEvents(result);
    secureCredentialPageHeaders(context);
    context.sendJson(request, response, result.duplicate ? 200 : 201, {
      explorerId: result.explorerId,
      agentId: result.value.agentId,
      identityName: result.value.identityName,
      recoveryCode: result.recoveryCode,
      duplicate: Boolean(result.duplicate),
    }, allowedOrigins);
    return true;
  }

  if (method === "POST" && pathname === "/api/epoch/mcp/access-tokens") {
    const store = requireTokenStore(playerMcpAccessTokens);
    const input = await context.readJsonBody(request, maxBodyBytes);
    const verified = runtime.epochVerifyExplorerAuth(input);
    await admitPublicCredentialAction(
      request,
      playerMcpAccessTokens,
      publicRegistrationProtection,
      "player_token_issuance",
    );
    const issued = await store.issue({ explorerId: verified.explorerId, ttlMs: playerMcpTokenTtlMs });
    secureCredentialPageHeaders(context);
    context.sendJson(request, response, 201, {
      accessToken: issued.bearerToken,
      tokenType: "Bearer",
      tokenId: issued.record.tokenId,
      explorerId: issued.record.explorerId,
      issuedAt: issued.record.issuedAt,
      expiresAt: issued.record.expiresAt,
    }, allowedOrigins);
    return true;
  }

  if (method === "POST" && pathname === "/api/epoch/mcp/access-tokens/revoke") {
    const store = requireTokenStore(playerMcpAccessTokens);
    const input = await context.readJsonBody(request, maxBodyBytes);
    const verified = runtime.epochVerifyExplorerAuth(input);
    const tokenId = typeof input.tokenId === "string" ? input.tokenId.trim() : "";
    if (tokenId) {
      const existing = store.get(tokenId);
      if (!existing || existing.explorerId !== verified.explorerId) throw new Error("player_mcp_access_token_not_found");
      const revoked = await store.revokeToken(tokenId);
      context.sendJson(request, response, 200, { revoked: revoked ? [revoked] : [] }, allowedOrigins);
      return true;
    }
    const revoked = await store.revokeExplorer(verified.explorerId);
    context.sendJson(request, response, 200, { revoked }, allowedOrigins);
    return true;
  }

  return false;
}
