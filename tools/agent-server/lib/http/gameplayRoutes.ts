import { type EpochHttpRouteContext } from "./httpRouteTypes.ts";

function finalPathSegment(pathname: string) {
  return decodeURIComponent(pathname.split("/").pop() || "");
}

async function persistAndSend(context: EpochHttpRouteContext, result: unknown) {
  const { allowedOrigins, request, response } = context;
  await context.persistEpochEvents(result);
  context.sendJson(request, response, 200, result, allowedOrigins);
}

export async function handleEpochGameplayRoutes(context: EpochHttpRouteContext): Promise<boolean> {
  const { allowedOrigins, method, pathname, request, response, runtime } = context;

  if (method === "GET" && pathname === "/api/epoch/party-runs") {
    const params = context.queryParams(request);
    context.sendJson(request, response, 200, runtime.epochPartyRuns({
      regionId: params.get("regionId") || undefined,
      agentId: params.get("agentId") || undefined,
      status: params.get("status") || undefined,
    }), allowedOrigins);
    return true;
  }

  if (method === "GET" && pathname.startsWith("/api/epoch/party-runs/")) {
    const partyRunId = finalPathSegment(pathname);
    const partyRun = runtime.epochPartyRuns({}).partyRuns.find((entry) => entry.partyRunId === partyRunId);
    if (!partyRun) {
      context.sendJson(request, response, 404, { error: "party_run_not_found" }, allowedOrigins);
      return true;
    }
    const audit = runtime.epochAudit({ aggregateId: partyRunId, limit: 50 });
    context.sendJson(request, response, 200, {
      partyRun,
      audit: {
        total: audit.total,
        events: audit.events.map((event) => ({
          eventId: event.eventId,
          eventType: event.eventType,
          createdAt: event.createdAt,
          highImpact: event.highImpact,
          reviewFlagCount: event.reviewFlags.length,
          publicPages: event.publicPages,
        })),
        publicPages: {
          index: audit.publicPages.index,
          partyRun: partyRun.publicPages.audit,
        },
      },
      publicPages: partyRun.publicPages,
    }, allowedOrigins);
    return true;
  }

  if (method === "POST" && pathname === "/api/epoch/party-runs/create") {
    await persistAndSend(context, runtime.epochCreatePartyRun(await context.readJsonBody(request, context.maxBodyBytes)));
    return true;
  }

  if (method === "POST" && pathname === "/api/epoch/party-runs/invite") {
    await persistAndSend(context, runtime.epochUpdatePartyInvite(await context.readJsonBody(request, context.maxBodyBytes)));
    return true;
  }

  if (method === "POST" && pathname === "/api/epoch/party-runs/join") {
    await persistAndSend(context, runtime.epochJoinPartyRun(await context.readJsonBody(request, context.maxBodyBytes)));
    return true;
  }

  if (method === "POST" && pathname === "/api/epoch/party-runs/request-join") {
    await persistAndSend(context, runtime.epochRequestPartyJoin(await context.readJsonBody(request, context.maxBodyBytes)));
    return true;
  }

  if (method === "POST" && pathname === "/api/epoch/party-runs/resolve-join-request") {
    await persistAndSend(context, runtime.epochResolvePartyJoinRequest(await context.readJsonBody(request, context.maxBodyBytes)));
    return true;
  }

  if (method === "POST" && pathname === "/api/epoch/party-runs/settle") {
    await persistAndSend(context, runtime.epochSettlePartyRun(await context.readJsonBody(request, context.maxBodyBytes)));
    return true;
  }

  if (method === "GET" && pathname === "/api/epoch/raids") {
    const params = context.queryParams(request);
    context.sendJson(request, response, 200, runtime.epochRaids({
      regionId: params.get("regionId") || undefined,
      agentId: params.get("agentId") || undefined,
    }), allowedOrigins);
    return true;
  }

  if (method === "POST" && pathname === "/api/epoch/raids/resolve") {
    await persistAndSend(context, runtime.epochResolveRaid(await context.readJsonBody(request, context.maxBodyBytes)));
    return true;
  }

  if (method === "POST" && pathname === "/api/epoch/region-control/revolt") {
    await persistAndSend(context, runtime.epochResolveRegionRevolt(await context.readJsonBody(request, context.maxBodyBytes)));
    return true;
  }

  if (method === "POST" && pathname === "/api/epoch/retaliations/resolve") {
    await persistAndSend(context, runtime.epochResolveRetaliation(await context.readJsonBody(request, context.maxBodyBytes)));
    return true;
  }

  if (method === "GET" && pathname === "/api/epoch/diplomacy") {
    const params = context.queryParams(request);
    context.sendJson(request, response, 200, runtime.epochDiplomacy({
      regionId: params.get("regionId") || undefined,
      agentId: params.get("agentId") || undefined,
      status: params.get("status") || undefined,
    }), allowedOrigins);
    return true;
  }

  if (method === "POST" && pathname === "/api/epoch/diplomacy/propose") {
    await persistAndSend(context, runtime.epochProposeDiplomacy(await context.readJsonBody(request, context.maxBodyBytes)));
    return true;
  }

  if (method === "POST" && pathname === "/api/epoch/diplomacy/respond") {
    await persistAndSend(context, runtime.epochRespondDiplomacy(await context.readJsonBody(request, context.maxBodyBytes)));
    return true;
  }

  if (method === "GET" && pathname === "/api/epoch/relationships") {
    const params = context.queryParams(request);
    context.sendJson(request, response, 200, runtime.epochRelationships({
      agentId: params.get("agentId") || undefined,
      kind: params.get("kind") || undefined,
    }), allowedOrigins);
    return true;
  }

  if (method === "POST" && pathname === "/api/epoch/relationships/update") {
    await persistAndSend(context, runtime.epochUpdateRelationship(await context.readJsonBody(request, context.maxBodyBytes)));
    return true;
  }

  if (method === "POST" && pathname === "/api/epoch/turns/create") {
    await persistAndSend(context, runtime.epochTurnCard(await context.readJsonBody(request, context.maxBodyBytes)));
    return true;
  }

  if (method === "POST" && pathname === "/api/epoch/turns/resolve") {
    await persistAndSend(context, runtime.epochResolveTurn(await context.readJsonBody(request, context.maxBodyBytes)));
    return true;
  }

  return false;
}
