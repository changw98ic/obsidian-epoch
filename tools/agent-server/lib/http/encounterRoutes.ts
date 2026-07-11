import { type EpochHttpRouteContext } from "./httpRouteTypes.ts";

async function persistAndSend(context: EpochHttpRouteContext, result: unknown) {
  const { allowedOrigins, request, response } = context;
  await context.persistEpochEvents(result);
  context.sendJson(request, response, 200, result, allowedOrigins);
}

export async function handleEpochEncounterRoutes(context: EpochHttpRouteContext): Promise<boolean> {
  const { allowedOrigins, method, pathname, request, response, runtime } = context;

  if (method === "GET" && pathname === "/api/epoch/objectives") {
    const params = context.queryParams(request);
    context.sendJson(request, response, 200, runtime.epochObjectives({
      regionId: params.get("regionId") || undefined,
    }), allowedOrigins);
    return true;
  }

  if (method === "POST" && pathname === "/api/epoch/objectives/seed") {
    await persistAndSend(context, runtime.epochSeedObjective(await context.readJsonBody(request, context.maxBodyBytes)));
    return true;
  }

  if (method === "POST" && pathname === "/api/epoch/objectives/contribute") {
    await persistAndSend(context, runtime.epochContributeObjective(await context.readJsonBody(request, context.maxBodyBytes)));
    return true;
  }

  if (method === "POST" && pathname === "/api/epoch/objectives/settle") {
    await persistAndSend(context, runtime.epochSettleObjective(await context.readJsonBody(request, context.maxBodyBytes)));
    return true;
  }

  if (method === "GET" && pathname === "/api/epoch/resource-nodes") {
    const params = context.queryParams(request);
    context.sendJson(request, response, 200, runtime.epochResourceNodes({
      regionId: params.get("regionId") || undefined,
      agentId: params.get("agentId") || undefined,
      status: params.get("status") || undefined,
    }), allowedOrigins);
    return true;
  }

  if (method === "POST" && pathname === "/api/epoch/resource-nodes/spawn") {
    await persistAndSend(context, runtime.epochSpawnResourceNode(await context.readJsonBody(request, context.maxBodyBytes)));
    return true;
  }

  if (method === "POST" && pathname === "/api/epoch/resource-nodes/contest") {
    await persistAndSend(context, runtime.epochContestResourceNode(await context.readJsonBody(request, context.maxBodyBytes)));
    return true;
  }

  if (method === "POST" && pathname === "/api/epoch/resource-nodes/settle") {
    await persistAndSend(context, runtime.epochSettleResourceNode(await context.readJsonBody(request, context.maxBodyBytes)));
    return true;
  }

  if (method === "GET" && pathname === "/api/epoch/anomalies") {
    const params = context.queryParams(request);
    context.sendJson(request, response, 200, runtime.epochAnomalies({
      regionId: params.get("regionId") || undefined,
      agentId: params.get("agentId") || undefined,
      status: params.get("status") || undefined,
    }), allowedOrigins);
    return true;
  }

  if (method === "POST" && pathname === "/api/epoch/anomalies/spawn") {
    await persistAndSend(context, runtime.epochSpawnAnomaly(await context.readJsonBody(request, context.maxBodyBytes)));
    return true;
  }

  if (method === "POST" && pathname === "/api/epoch/anomalies/contest") {
    await persistAndSend(context, runtime.epochContestAnomaly(await context.readJsonBody(request, context.maxBodyBytes)));
    return true;
  }

  if (method === "POST" && pathname === "/api/epoch/anomalies/resolve") {
    await persistAndSend(context, runtime.epochResolveAnomaly(await context.readJsonBody(request, context.maxBodyBytes)));
    return true;
  }

  if (method === "GET" && pathname === "/api/epoch/bounties") {
    const params = context.queryParams(request);
    context.sendJson(request, response, 200, runtime.epochBounties({
      regionId: params.get("regionId") || undefined,
      agentId: params.get("agentId") || undefined,
      status: params.get("status") || undefined,
    }), allowedOrigins);
    return true;
  }

  if (method === "POST" && pathname === "/api/epoch/bounties/create") {
    await persistAndSend(context, runtime.epochCreateBounty(await context.readJsonBody(request, context.maxBodyBytes)));
    return true;
  }

  if (method === "POST" && pathname === "/api/epoch/bounties/claim") {
    await persistAndSend(context, runtime.epochClaimBounty(await context.readJsonBody(request, context.maxBodyBytes)));
    return true;
  }

  return false;
}
