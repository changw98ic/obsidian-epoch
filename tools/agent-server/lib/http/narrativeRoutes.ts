import { type EpochHttpRouteContext } from "./httpRouteTypes.ts";

async function persistAndSend(context: EpochHttpRouteContext, result: unknown) {
  const { allowedOrigins, request, response } = context;
  await context.persistEpochEvents(result);
  context.sendJson(request, response, 200, result, allowedOrigins);
}

export async function handleEpochNarrativeRoutes(context: EpochHttpRouteContext): Promise<boolean> {
  const { allowedOrigins, method, pathname, request, response, runtime } = context;

  if (method === "GET" && pathname === "/api/epoch/messages") {
    const params = context.queryParams(request);
    context.sendJson(request, response, 200, runtime.epochMessages({
      regionId: params.get("regionId") || undefined,
      agentId: params.get("agentId") || undefined,
      limit: params.get("limit") || undefined,
    }), allowedOrigins);
    return true;
  }

  if (method === "POST" && pathname === "/api/epoch/confirmations/request") {
    await persistAndSend(context, runtime.epochRequestConfirmation(await context.readJsonBody(request, context.maxBodyBytes)));
    return true;
  }

  if (method === "POST" && pathname === "/api/epoch/confirmations/list") {
    context.sendJson(request, response, 200, runtime.epochConfirmations(await context.readJsonBody(request, context.maxBodyBytes)), allowedOrigins);
    return true;
  }

  if (method === "POST" && pathname === "/api/epoch/confirmations/confirm") {
    await persistAndSend(context, runtime.epochConfirmAction(await context.readJsonBody(request, context.maxBodyBytes)));
    return true;
  }

  if (method === "POST" && pathname === "/api/epoch/messages/post") {
    await persistAndSend(context, runtime.epochPostMessage(await context.readJsonBody(request, context.maxBodyBytes)));
    return true;
  }

  if (method === "POST" && pathname === "/api/epoch/news/generate") {
    await persistAndSend(context, runtime.epochGenerateRegionNews(await context.readJsonBody(request, context.maxBodyBytes)));
    return true;
  }

  if (method === "POST" && pathname === "/api/epoch/news/claim-legend") {
    await persistAndSend(context, runtime.epochClaimNewsLegend(await context.readJsonBody(request, context.maxBodyBytes)));
    return true;
  }

  if (method === "POST" && pathname === "/api/epoch/lore/contribution") {
    await persistAndSend(context, runtime.epochRecordLoreContribution(await context.readJsonBody(request, context.maxBodyBytes)));
    return true;
  }

  if (method === "POST" && pathname === "/api/epoch/lore/adjudicate") {
    await persistAndSend(context, runtime.epochAdjudicateLoreTarget(await context.readJsonBody(request, context.maxBodyBytes)));
    return true;
  }

  if (method === "GET" && pathname === "/api/epoch/events") {
    const params = context.queryParams(request);
    context.sendJson(request, response, 200, runtime.epochEvents({
      agentId: params.get("agentId") || undefined,
      eventType: params.get("eventType") || undefined,
      limit: params.get("limit") || undefined,
    }), allowedOrigins);
    return true;
  }

  if (method === "GET" && pathname === "/api/epoch/lore/contributions") {
    const params = context.queryParams(request);
    context.sendJson(request, response, 200, runtime.epochLoreContributions({
      agentId: params.get("agentId") || undefined,
      category: params.get("category") || undefined,
      targetId: params.get("targetId") || undefined,
      limit: params.get("limit") || undefined,
    }), allowedOrigins);
    return true;
  }

  if (method === "GET" && pathname === "/api/epoch/lore/targets") {
    const params = context.queryParams(request);
    context.sendJson(request, response, 200, runtime.epochLoreTargets({
      targetId: params.get("targetId") || undefined,
      status: params.get("status") || undefined,
      limit: params.get("limit") || undefined,
    }), allowedOrigins);
    return true;
  }

  return false;
}
