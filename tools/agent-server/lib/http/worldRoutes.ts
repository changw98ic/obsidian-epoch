import {
  renderEpochAgentPublicPageHtml,
  renderEpochArchivePublicPageHtml,
  renderEpochDirectTradePublicPageHtml,
  renderEpochExplorerPublicPageHtml,
  renderEpochHostedSessionWatchPageHtml,
  renderEpochNpcPublicPageHtml,
  renderEpochPartyRunPublicPageHtml,
  renderEpochRegionPublicPageHtml,
  renderEpochWorldOverviewPublicPageHtml,
} from "../publicWorldPageHtml.ts";
import { type EpochHttpRouteContext } from "./httpRouteTypes.ts";

function finalPathSegment(pathname: string) {
  return decodeURIComponent(pathname.split("/").pop() || "");
}

export async function handleEpochWorldRoutes(context: EpochHttpRouteContext): Promise<boolean> {
  const { allowedOrigins, method, pathname, request, response, runtime } = context;

  if (method === "GET" && pathname === "/api/epoch/world-overview") {
    const params = context.queryParams(request);
    context.sendJson(request, response, 200, runtime.epochWorldOverview({
      limit: params.get("limit") || undefined,
    }), allowedOrigins);
    return true;
  }

  if (method === "GET" && pathname.startsWith("/api/epoch/archive/")) {
    const agentId = finalPathSegment(pathname);
    const archive = runtime.epochIdentityArchive({ agentId, limit: 30 });
    context.sendJson(
      request,
      response,
      archive.identity ? 200 : 404,
      archive.identity ? archive : { error: "agent_identity_not_found" },
      allowedOrigins,
    );
    return true;
  }

  if (method === "GET" && (pathname === "/epoch/world" || pathname === "/epoch/world/")) {
    context.sendHtml(request, response, 200, renderEpochWorldOverviewPublicPageHtml(runtime.epochWorldOverview({
      limit: context.queryParams(request).get("limit") || undefined,
    })), allowedOrigins);
    return true;
  }

  if (method === "GET" && pathname.startsWith("/epoch/agent/")) {
    const agentId = finalPathSegment(pathname);
    const briefing = runtime.epochAgentBriefing({ agentId, limit: 30 });
    if (briefing.identityExists !== true || briefing.canonicalAgentId !== agentId) {
      context.sendHtml(request, response, 404, "<!doctype html><title>Agent not found</title><p>agent_not_found</p>", allowedOrigins);
      return true;
    }
    context.sendHtml(request, response, 200, renderEpochAgentPublicPageHtml(briefing), allowedOrigins);
    return true;
  }

  if (method === "GET" && pathname.startsWith("/epoch/direct-trade/")) {
    const tradeId = finalPathSegment(pathname);
    const trade = runtime.epochDirectTrades({}).trades.find((entry) => entry.tradeId === tradeId);
    if (!trade) {
      context.sendHtml(request, response, 404, "<!doctype html><title>Direct trade not found</title><p>direct_trade_not_found</p>", allowedOrigins);
      return true;
    }
    context.sendHtml(request, response, 200, renderEpochDirectTradePublicPageHtml(
      trade,
      runtime.epochAudit({ aggregateId: tradeId, limit: 50 }),
    ), allowedOrigins);
    return true;
  }

  if (method === "GET" && pathname.startsWith("/epoch/party-run/")) {
    const partyRunId = finalPathSegment(pathname);
    const partyRun = runtime.epochPartyRuns({}).partyRuns.find((entry) => entry.partyRunId === partyRunId);
    if (!partyRun) {
      context.sendHtml(request, response, 404, "<!doctype html><title>Party run not found</title><p>party_run_not_found</p>", allowedOrigins);
      return true;
    }
    context.sendHtml(request, response, 200, renderEpochPartyRunPublicPageHtml(
      partyRun,
      runtime.epochAudit({ aggregateId: partyRunId, limit: 50 }),
    ), allowedOrigins);
    return true;
  }

  if (method === "GET" && pathname.startsWith("/epoch/hosted/")) {
    const sessionId = finalPathSegment(pathname);
    const watch = runtime.epochHostedSessionWatch({ sessionId });
    if (!watch.session) {
      context.sendHtml(request, response, 404, "<!doctype html><title>Hosted session not found</title><p>hosted_session_not_found</p>", allowedOrigins);
      return true;
    }
    context.sendHtml(request, response, 200, renderEpochHostedSessionWatchPageHtml(watch), allowedOrigins);
    return true;
  }

  if (method === "GET" && pathname.startsWith("/epoch/explorer/")) {
    const explorerId = finalPathSegment(pathname);
    try {
      context.sendHtml(request, response, 200, renderEpochExplorerPublicPageHtml(runtime.epochExplorerProfile({
        explorerId,
        limit: 30,
      })), allowedOrigins);
    } catch (error) {
      if (error instanceof Error && error.message === "explorer_profile_not_found") {
        context.sendHtml(request, response, 404, "<!doctype html><title>Explorer not found</title><p>explorer_profile_not_found</p>", allowedOrigins);
        return true;
      }
      throw error;
    }
    return true;
  }

  if (method === "GET" && pathname.startsWith("/epoch/region/")) {
    const regionId = finalPathSegment(pathname);
    context.sendHtml(request, response, 200, renderEpochRegionPublicPageHtml(runtime.epochRegionInfo({
      regionId,
      limit: 30,
    })), allowedOrigins);
    return true;
  }

  if (method === "GET" && pathname.startsWith("/epoch/npc/")) {
    const npcId = finalPathSegment(pathname);
    const npcInfo = runtime.epochNpcInfo({ npcId });
    if (!npcInfo.npc) {
      context.sendHtml(request, response, 404, "<!doctype html><title>NPC not found</title><p>npc_not_found</p>", allowedOrigins);
      return true;
    }
    context.sendHtml(request, response, 200, renderEpochNpcPublicPageHtml(npcInfo), allowedOrigins);
    return true;
  }

  if (method === "GET" && pathname.startsWith("/epoch/archive/")) {
    const agentId = finalPathSegment(pathname);
    const archive = runtime.epochIdentityArchive({ agentId, limit: 30 });
    if (!archive.identity) {
      context.sendHtml(request, response, 404, "<!doctype html><title>Archive not found</title><p>agent_identity_not_found</p>", allowedOrigins);
      return true;
    }
    context.sendHtml(request, response, 200, renderEpochArchivePublicPageHtml(archive), allowedOrigins);
    return true;
  }

  return false;
}
