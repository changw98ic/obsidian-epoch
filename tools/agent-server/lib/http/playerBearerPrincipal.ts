import type { IncomingMessage } from "node:http";
import type { PlayerMcpAccessTokenStore } from "../playerMcpAccessTokenStore.ts";

export interface PlayerBearerPrincipal {
  readonly explorerId: string;
  readonly tokenId: string;
}

export type PlayerBearerAuthentication =
  | { readonly status: "authenticated"; readonly principal: PlayerBearerPrincipal }
  | { readonly status: "missing" }
  | { readonly status: "invalid" };

function singleHeader(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function bearerTokenFromRequest(request: IncomingMessage): string | undefined {
  const authorization = singleHeader(request.headers.authorization);
  if (!authorization?.startsWith("Bearer ")) return undefined;
  const token = authorization.slice("Bearer ".length).trim();
  return token || undefined;
}

export function authenticatePlayerBearerRequest(
  request: IncomingMessage,
  playerMcpAccessTokens: PlayerMcpAccessTokenStore | undefined,
): PlayerBearerAuthentication {
  const token = bearerTokenFromRequest(request);
  if (!token) {
    return singleHeader(request.headers.authorization)
      ? { status: "invalid" }
      : { status: "missing" };
  }
  const record = playerMcpAccessTokens?.authenticate(token);
  return record
    ? {
      status: "authenticated",
      principal: { explorerId: record.explorerId, tokenId: record.tokenId },
    }
    : { status: "invalid" };
}
