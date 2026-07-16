import { type IncomingHttpHeaders } from "node:http";
import { type EpochHttpRouteContext } from "./httpRouteTypes.ts";

function firstHeaderValue(value: IncomingHttpHeaders[string]) {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw?.split(",")[0]?.trim();
}

function operatorKeyFromHeaders(headers: IncomingHttpHeaders) {
  return firstHeaderValue(headers["x-epoch-operator-key"]);
}

export async function handleEpochOperatorRoutes(context: EpochHttpRouteContext): Promise<boolean> {
  const { allowedOrigins, method, pathname, request, response, runtime } = context;

  if (method === "GET" && pathname === "/api/epoch/moderation") {
    const params = context.queryParams(request);
    context.sendJson(request, response, 200, runtime.epochModerationQueue({
      operatorKey: operatorKeyFromHeaders(request.headers),
      status: params.get("status") || undefined,
      subjectType: params.get("subjectType") || undefined,
    }), allowedOrigins);
    return true;
  }

  if (method === "POST" && pathname === "/api/epoch/moderation/resolve") {
    const result = runtime.epochResolveModeration(await context.readJsonBody(request, context.maxBodyBytes));
    await context.persistEpochEvents(result);
    context.sendJson(request, response, 200, result, allowedOrigins);
    return true;
  }

  if (method === "GET" && pathname === "/api/epoch/abuse/status") {
    const params = context.queryParams(request);
    context.sendJson(request, response, 200, runtime.epochAbuseStatus({
      explorerId: params.get("explorerId") || undefined,
      agentId: params.get("agentId") || undefined,
      actorExplorerId: params.get("actorExplorerId") || undefined,
      runnerId: params.get("runnerId") || undefined,
      sellerAgentId: params.get("sellerAgentId") || undefined,
      buyerAgentId: params.get("buyerAgentId") || undefined,
      attackerAgentId: params.get("attackerAgentId") || undefined,
      sessionId: params.get("sessionId") || undefined,
      challengeId: params.get("challengeId") || undefined,
    }), allowedOrigins);
    return true;
  }

  if (method === "GET" && pathname === "/api/epoch/abuse/profiles") {
    const params = context.queryParams(request);
    context.sendJson(request, response, 200, runtime.epochAbuseProfiles({
      operatorKey: operatorKeyFromHeaders(request.headers),
      level: params.get("level") || undefined,
      limit: params.get("limit") ? Number(params.get("limit")) : undefined,
    }), allowedOrigins);
    return true;
  }

  if (method === "GET" && pathname === "/api/epoch/operator/overview") {
    const params = context.queryParams(request);
    context.sendJson(request, response, 200, runtime.epochOperatorOverview({
      operatorKey: operatorKeyFromHeaders(request.headers),
      limit: params.get("limit") ? Number(params.get("limit")) : undefined,
    }), allowedOrigins);
    return true;
  }

  if (method === "POST" && pathname === "/api/epoch/maintenance/run") {
    const result = runtime.epochRunMaintenance(await context.readJsonBody(request, context.maxBodyBytes));
    const persistedEvents = await context.persistEpochEvents(result);
    context.sendJson(request, response, 200, {
      ...result,
      value: {
        ...result.value,
        persistedEvents,
      },
    }, allowedOrigins);
    return true;
  }

  if (method === "POST" && pathname === "/api/epoch/world-clock/advance") {
    const body = await context.readJsonBody(request, context.maxBodyBytes);
    const result = runtime.epochAdvanceWorldClock({
      ...body,
      operatorKey: operatorKeyFromHeaders(request.headers),
    });
    const persistedEvents = await context.persistEpochEvents(result);
    context.sendJson(request, response, 200, { ...result, persistedEvents }, allowedOrigins);
    return true;
  }

  if (method === "POST" && pathname === "/api/epoch/world-content/migrate") {
    const body = await context.readJsonBody(request, context.maxBodyBytes);
    const result = runtime.epochMigrateWorldContent({
      ...body,
      operatorKey: operatorKeyFromHeaders(request.headers),
    });
    const persistedEvents = await context.persistEpochEvents(result);
    context.sendJson(request, response, 200, { ...result, persistedEvents }, allowedOrigins);
    return true;
  }

  if (method === "POST" && pathname === "/api/epoch/abuse/release") {
    const result = runtime.epochReleaseAbuseRestriction(await context.readJsonBody(request, context.maxBodyBytes));
    await context.persistEpochEvents(result);
    context.sendJson(request, response, 200, result, allowedOrigins);
    return true;
  }

  return false;
}
