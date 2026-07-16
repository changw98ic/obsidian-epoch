import { type EpochHttpRouteContext } from "./httpRouteTypes.ts";

async function persistAndSend(context: EpochHttpRouteContext, result: unknown) {
  const { allowedOrigins, request, response } = context;
  await context.persistEpochEvents(result);
  context.sendJson(request, response, 200, result, allowedOrigins);
}

export async function handleEpochSeasonRoutes(context: EpochHttpRouteContext): Promise<boolean> {
  const { allowedOrigins, method, pathname, request, response, runtime } = context;

  if (method === "GET" && pathname === "/api/epoch/seasons") {
    const params = context.queryParams(request);
    context.sendJson(request, response, 200, runtime.epochSeasons({
      regionId: params.get("regionId") || undefined,
      factionId: params.get("factionId") || undefined,
      status: params.get("status") || undefined,
    }), allowedOrigins);
    return true;
  }

  if (method === "GET" && pathname === "/api/epoch/competitive-ladder") {
    const params = context.queryParams(request);
    context.sendJson(request, response, 200, runtime.epochCompetitiveLadder({
      mode: params.get("mode") || "ranked",
      regionId: params.get("regionId") || undefined,
      seasonId: params.get("seasonId") || undefined,
      tournamentId: params.get("tournamentId") || undefined,
      limit: params.get("limit") ? Number(params.get("limit")) : undefined,
    }), allowedOrigins);
    return true;
  }

  if (method === "POST" && pathname === "/api/epoch/seasons/seed") {
    await persistAndSend(context, runtime.epochSeedSeason(await context.readJsonBody(request, context.maxBodyBytes)));
    return true;
  }

  if (method === "POST" && pathname === "/api/epoch/seasons/contribute") {
    await persistAndSend(context, runtime.epochContributeSeason(await context.readJsonBody(request, context.maxBodyBytes)));
    return true;
  }

  if (method === "POST" && pathname === "/api/epoch/seasons/settle") {
    await persistAndSend(context, runtime.epochSettleSeason(await context.readJsonBody(request, context.maxBodyBytes)));
    return true;
  }

  return false;
}
