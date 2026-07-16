import { type EpochHttpRouteContext } from "./httpRouteTypes.ts";

type IdentityRouteContext = EpochHttpRouteContext & {
  readonly allowLegacyHttpIdentityRegistration: boolean;
};

function serverAssignedIdentityInput(input: Record<string, unknown>) {
  const sanitized = { ...input };
  delete sanitized.identityName;
  delete sanitized.maxLifetime;
  return sanitized;
}

export async function handleEpochIdentityRoutes(context: IdentityRouteContext): Promise<boolean> {
  const {
    allowedOrigins,
    maxBodyBytes,
    method,
    pathname,
    request,
    response,
    runtime,
  } = context;

  if (method === "POST" && pathname === "/api/epoch/identity/issue") {
    const input = await context.readJsonBody(request, maxBodyBytes);
    if (!context.allowLegacyHttpIdentityRegistration) runtime.epochVerifyExplorerAuth(input);
    const result = runtime.epochIdentity(
      context.allowLegacyHttpIdentityRegistration ? input : serverAssignedIdentityInput(input),
    );
    await context.persistEpochEvents(result);
    context.sendJson(request, response, 200, result, allowedOrigins);
    return true;
  }

  if (method === "POST" && pathname === "/api/epoch/recovery/rotate") {
    const result = runtime.epochRotateRecovery(await context.readJsonBody(request, maxBodyBytes));
    await context.persistEpochEvents(result);
    context.sendJson(request, response, 200, result, allowedOrigins);
    return true;
  }

  if (method === "POST" && pathname === "/api/epoch/identity/archive") {
    const result = runtime.epochArchiveIdentity(await context.readJsonBody(request, maxBodyBytes));
    await context.persistEpochEvents(result);
    context.sendJson(request, response, 200, result, allowedOrigins);
    return true;
  }

  if (method === "POST" && pathname === "/api/epoch/identity/reincarnate") {
    const result = runtime.epochReincarnate(await context.readJsonBody(request, maxBodyBytes));
    await context.persistEpochEvents(result);
    context.sendJson(request, response, 200, result, allowedOrigins);
    return true;
  }

  if (method === "GET" && pathname.startsWith("/api/epoch/identity/")) {
    const agentId = decodeURIComponent(pathname.split("/").pop() || "");
    const result = runtime.epochProgress({ agentId });
    context.sendJson(
      request,
      response,
      result.identity ? 200 : 404,
      result.identity ? result : { error: "agent_identity_not_found" },
      allowedOrigins,
    );
    return true;
  }

  return false;
}
