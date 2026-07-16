import { type EpochHttpRouteContext } from "./httpRouteTypes.ts";

async function persistAndSend(context: EpochHttpRouteContext, result: unknown) {
  const { allowedOrigins, request, response } = context;
  await context.persistEpochEvents(result);
  context.sendJson(request, response, 200, result, allowedOrigins);
}

export async function handleEpochSocietyRoutes(context: EpochHttpRouteContext): Promise<boolean> {
  const { allowedOrigins, method, pathname, request, response, runtime } = context;

  if (method === "POST" && pathname === "/api/epoch/downtime/set") {
    await persistAndSend(context, runtime.epochSetDowntime(await context.readJsonBody(request, context.maxBodyBytes)));
    return true;
  }

  if (method === "POST" && pathname === "/api/epoch/downtime/claim") {
    await persistAndSend(context, runtime.epochClaimDowntime(await context.readJsonBody(request, context.maxBodyBytes)));
    return true;
  }

  if (method === "POST" && pathname === "/api/epoch/downtime/tick") {
    await persistAndSend(context, runtime.epochTickDowntime(await context.readJsonBody(request, context.maxBodyBytes)));
    return true;
  }

  if (method === "POST" && pathname === "/api/epoch/npc/canonicalize") {
    await persistAndSend(context, runtime.epochNpcNote(await context.readJsonBody(request, context.maxBodyBytes)));
    return true;
  }

  if (method === "POST" && pathname === "/api/epoch/npc/candidates/submit") {
    await persistAndSend(context, runtime.epochSubmitNpcCandidate(await context.readJsonBody(request, context.maxBodyBytes)));
    return true;
  }

  if (method === "POST" && pathname === "/api/epoch/npc/candidates/review") {
    await persistAndSend(context, runtime.epochReviewNpcCandidate(await context.readJsonBody(request, context.maxBodyBytes)));
    return true;
  }

  if (method === "POST" && pathname === "/api/epoch/npc/lifecycle/tick") {
    await persistAndSend(context, runtime.epochTickNpcLifecycle(await context.readJsonBody(request, context.maxBodyBytes)));
    return true;
  }

  if (method === "GET" && pathname === "/api/epoch/npc/relationships") {
    const params = context.queryParams(request);
    context.sendJson(request, response, 200, runtime.epochNpcRelationships({
      regionId: params.get("regionId") || undefined,
      npcId: params.get("npcId") || undefined,
    }), allowedOrigins);
    return true;
  }

  if (method === "GET" && pathname === "/api/epoch/agent-npc-bonds") {
    const params = context.queryParams(request);
    context.sendJson(request, response, 200, runtime.epochAgentNpcBonds({
      agentId: params.get("agentId") || undefined,
      npcId: params.get("npcId") || undefined,
      regionId: params.get("regionId") || undefined,
      kind: params.get("kind") || undefined,
    }), allowedOrigins);
    return true;
  }

  if (method === "POST" && pathname === "/api/epoch/agent-npc-bonds/update") {
    await persistAndSend(context, runtime.epochUpdateAgentNpcBond(await context.readJsonBody(request, context.maxBodyBytes)));
    return true;
  }

  if (method === "GET" && pathname === "/api/epoch/npc/memories") {
    const params = context.queryParams(request);
    context.sendJson(request, response, 200, runtime.epochNpcMemories({
      regionId: params.get("regionId") || undefined,
      npcId: params.get("npcId") || undefined,
    }), allowedOrigins);
    return true;
  }

  if (method === "GET" && pathname === "/api/epoch/households") {
    const params = context.queryParams(request);
    context.sendJson(request, response, 200, runtime.epochHouseholds({
      regionId: params.get("regionId") || undefined,
      npcId: params.get("npcId") || undefined,
    }), allowedOrigins);
    return true;
  }

  if (method === "GET" && pathname === "/api/epoch/organizations") {
    const params = context.queryParams(request);
    context.sendJson(request, response, 200, runtime.epochOrganizations({
      regionId: params.get("regionId") || undefined,
      npcId: params.get("npcId") || undefined,
      agentId: params.get("agentId") || undefined,
      organizationId: params.get("organizationId") || undefined,
    }), allowedOrigins);
    return true;
  }

  if (method === "POST" && pathname === "/api/epoch/organizations/create") {
    await persistAndSend(context, runtime.epochCreateOrganization(await context.readJsonBody(request, context.maxBodyBytes)));
    return true;
  }

  if (method === "POST" && pathname === "/api/epoch/organizations/membership") {
    await persistAndSend(context, runtime.epochUpdateOrganizationMembership(await context.readJsonBody(request, context.maxBodyBytes)));
    return true;
  }

  if (method === "POST" && pathname === "/api/epoch/organizations/upgrades/purchase") {
    await persistAndSend(context, runtime.epochPurchaseOrganizationUpgrade(await context.readJsonBody(request, context.maxBodyBytes)));
    return true;
  }

  if (method === "POST" && pathname === "/api/epoch/organizations/treasury/contribute") {
    await persistAndSend(context, runtime.epochContributeOrganizationTreasury(await context.readJsonBody(request, context.maxBodyBytes)));
    return true;
  }

  if (method === "POST" && pathname === "/api/epoch/organizations/budgets/propose") {
    await persistAndSend(context, runtime.epochProposeOrganizationBudget(await context.readJsonBody(request, context.maxBodyBytes)));
    return true;
  }

  if (method === "POST" && pathname === "/api/epoch/organizations/budgets/resolve") {
    await persistAndSend(context, runtime.epochResolveOrganizationBudget(await context.readJsonBody(request, context.maxBodyBytes)));
    return true;
  }

  if (method === "GET" && pathname === "/api/epoch/organization-politics") {
    const params = context.queryParams(request);
    context.sendJson(request, response, 200, runtime.epochOrganizationPolitics({
      regionId: params.get("regionId") || undefined,
      npcId: params.get("npcId") || undefined,
      organizationId: params.get("organizationId") || undefined,
    }), allowedOrigins);
    return true;
  }

  if (method === "POST" && pathname === "/api/epoch/organization-politics/tick") {
    await persistAndSend(context, runtime.epochTickOrganizationPolitics(await context.readJsonBody(request, context.maxBodyBytes)));
    return true;
  }

  if (method === "GET" && pathname === "/api/epoch/npc/careers") {
    const params = context.queryParams(request);
    context.sendJson(request, response, 200, runtime.epochNpcCareers({
      regionId: params.get("regionId") || undefined,
      npcId: params.get("npcId") || undefined,
    }), allowedOrigins);
    return true;
  }

  if (method === "GET" && pathname === "/api/epoch/npc/locations") {
    const params = context.queryParams(request);
    context.sendJson(request, response, 200, runtime.epochNpcLocations({
      regionId: params.get("regionId") || undefined,
      npcId: params.get("npcId") || undefined,
    }), allowedOrigins);
    return true;
  }

  if (method === "GET" && pathname === "/api/epoch/npc/assets") {
    const params = context.queryParams(request);
    context.sendJson(request, response, 200, runtime.epochNpcAssets({
      regionId: params.get("regionId") || undefined,
      npcId: params.get("npcId") || undefined,
    }), allowedOrigins);
    return true;
  }

  if (method === "GET" && pathname === "/api/epoch/npc/health") {
    const params = context.queryParams(request);
    context.sendJson(request, response, 200, runtime.epochNpcHealth({
      regionId: params.get("regionId") || undefined,
      npcId: params.get("npcId") || undefined,
    }), allowedOrigins);
    return true;
  }

  if (method === "GET" && pathname === "/api/epoch/social-hooks") {
    const params = context.queryParams(request);
    context.sendJson(request, response, 200, runtime.epochSocialHooks({
      regionId: params.get("regionId") || undefined,
      npcId: params.get("npcId") || undefined,
    }), allowedOrigins);
    return true;
  }

  if (method === "GET" && pathname.startsWith("/api/epoch/region/")) {
    const regionId = decodeURIComponent(pathname.split("/").pop() || "");
    const params = context.queryParams(request);
    context.sendJson(request, response, 200, runtime.epochRegionInfo({
      regionId,
      npcCandidateReviewLevel: params.get("npcCandidateReviewLevel") || undefined,
    }), allowedOrigins);
    return true;
  }

  return false;
}
