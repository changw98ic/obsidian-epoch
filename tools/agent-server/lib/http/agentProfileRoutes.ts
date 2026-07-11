import { type EpochHttpRouteContext } from "./httpRouteTypes.ts";

function finalPathSegment(pathname: string) {
  return decodeURIComponent(pathname.split("/").pop() || "");
}

function optionalLimit(value: string | null) {
  return value ? Number(value) : undefined;
}

export async function handleEpochAgentProfileRoutes(context: EpochHttpRouteContext): Promise<boolean> {
  const {
    allowedOrigins,
    maxBodyBytes,
    method,
    pathname,
    request,
    response,
    runtime,
  } = context;

  if (method === "POST" && pathname === "/api/epoch/personality/confirm") {
    const result = runtime.epochConfirmPersonalityDrift(await context.readJsonBody(request, maxBodyBytes));
    await context.persistEpochEvents(result);
    context.sendJson(request, response, 200, result, allowedOrigins);
    return true;
  }

  if (method === "POST" && pathname === "/api/epoch/player-data-export") {
    context.sendJson(
      request,
      response,
      200,
      runtime.epochPlayerDataExport(await context.readJsonBody(request, maxBodyBytes)),
      allowedOrigins,
    );
    return true;
  }

  if (method === "POST" && pathname === "/api/epoch/custody/change") {
    const result = runtime.epochChangeAgentCustody(await context.readJsonBody(request, maxBodyBytes));
    await context.persistEpochEvents(result);
    context.sendJson(request, response, 200, result, allowedOrigins);
    return true;
  }

  if (method === "GET" && pathname === "/api/epoch/agent-briefing") {
    const params = context.queryParams(request);
    context.sendJson(request, response, 200, runtime.epochAgentBriefing({
      agentId: params.get("agentId") || undefined,
      explorerId: params.get("explorerId") || undefined,
      regionId: params.get("regionId") || undefined,
      limit: optionalLimit(params.get("limit")),
    }), allowedOrigins);
    return true;
  }

  if (method === "GET" && pathname === "/api/epoch/agent-memory") {
    const params = context.queryParams(request);
    context.sendJson(request, response, 200, runtime.epochAgentMemory({
      agentId: params.get("agentId") || undefined,
      regionId: params.get("regionId") || undefined,
      limit: optionalLimit(params.get("limit")),
    }), allowedOrigins);
    return true;
  }

  if (method === "GET" && pathname === "/api/epoch/personal-migration-summary") {
    const params = context.queryParams(request);
    context.sendJson(request, response, 200, runtime.epochPersonalMigrationSummary({
      agentId: params.get("agentId") || undefined,
      explorerId: params.get("explorerId") || undefined,
      limit: optionalLimit(params.get("limit")),
    }), allowedOrigins);
    return true;
  }

  if (method === "GET" && pathname.startsWith("/api/epoch/explorer/")) {
    const explorerId = finalPathSegment(pathname);
    try {
      context.sendJson(request, response, 200, runtime.epochExplorerProfile({ explorerId, limit: 30 }), allowedOrigins);
    } catch (error) {
      if (error instanceof Error && error.message === "explorer_profile_not_found") {
        context.sendJson(request, response, 404, { error: "explorer_profile_not_found" }, allowedOrigins);
        return true;
      }
      throw error;
    }
    return true;
  }

  return false;
}
