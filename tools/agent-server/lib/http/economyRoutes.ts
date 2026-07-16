import { type EpochHttpRouteContext } from "./httpRouteTypes.ts";

function finalPathSegment(pathname: string) {
  return decodeURIComponent(pathname.split("/").pop() || "");
}

async function persistAndSend(context: EpochHttpRouteContext, result: unknown) {
  const { allowedOrigins, request, response } = context;
  await context.persistEpochEvents(result);
  context.sendJson(request, response, 200, result, allowedOrigins);
}

export async function handleEpochEconomyRoutes(context: EpochHttpRouteContext): Promise<boolean> {
  const { allowedOrigins, method, pathname, request, response, runtime } = context;

  if (method === "GET" && pathname === "/api/epoch/inventory") {
    const params = context.queryParams(request);
    context.sendJson(request, response, 200, runtime.epochInventory({
      agentId: params.get("agentId") || undefined,
      explorerId: params.get("explorerId") || undefined,
      bound: params.get("bound") || undefined,
      tradable: params.get("tradable") || undefined,
    }), allowedOrigins);
    return true;
  }

  if (method === "GET" && pathname === "/api/epoch/shop") {
    const params = context.queryParams(request);
    context.sendJson(request, response, 200, runtime.epochShop({
      regionId: params.get("regionId") || undefined,
    }), allowedOrigins);
    return true;
  }

  if (method === "POST" && pathname === "/api/epoch/inventory/create") {
    await persistAndSend(context, runtime.epochCreateItem(await context.readJsonBody(request, context.maxBodyBytes)));
    return true;
  }

  if (method === "POST" && pathname === "/api/epoch/inventory/craft") {
    await persistAndSend(context, runtime.epochCraftItem(await context.readJsonBody(request, context.maxBodyBytes)));
    return true;
  }

  if (method === "POST" && pathname === "/api/epoch/shop/purchase") {
    await persistAndSend(context, runtime.epochPurchaseShopOffer(await context.readJsonBody(request, context.maxBodyBytes)));
    return true;
  }

  if (method === "POST" && pathname === "/api/epoch/inventory/bind") {
    await persistAndSend(context, runtime.epochBindItem(await context.readJsonBody(request, context.maxBodyBytes)));
    return true;
  }

  if (method === "GET" && pathname === "/api/epoch/market") {
    const params = context.queryParams(request);
    context.sendJson(request, response, 200, runtime.epochMarket({
      agentId: params.get("agentId") || undefined,
      regionId: params.get("regionId") || undefined,
      status: params.get("status") || undefined,
    }), allowedOrigins);
    return true;
  }

  if (method === "GET" && pathname === "/api/epoch/direct-trades") {
    const params = context.queryParams(request);
    context.sendJson(request, response, 200, runtime.epochDirectTrades({
      agentId: params.get("agentId") || undefined,
      regionId: params.get("regionId") || undefined,
      status: params.get("status") || undefined,
    }), allowedOrigins);
    return true;
  }

  if (method === "GET" && pathname.startsWith("/api/epoch/direct-trades/")) {
    const tradeId = finalPathSegment(pathname);
    const trade = runtime.epochDirectTrades({}).trades.find((entry) => entry.tradeId === tradeId);
    if (!trade) {
      context.sendJson(request, response, 404, { error: "direct_trade_not_found" }, allowedOrigins);
      return true;
    }
    const audit = runtime.epochAudit({ aggregateId: tradeId, limit: 50 });
    context.sendJson(request, response, 200, {
      trade,
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
          trade: trade.publicPages.audit,
        },
      },
      publicPages: trade.publicPages,
    }, allowedOrigins);
    return true;
  }

  if (method === "POST" && pathname === "/api/epoch/market/risk-restrictions/release") {
    await persistAndSend(context, runtime.epochReleaseMarketRiskRestriction(await context.readJsonBody(request, context.maxBodyBytes)));
    return true;
  }

  if (method === "POST" && pathname === "/api/epoch/market/orders") {
    await persistAndSend(context, runtime.epochCreateMarketOrder(await context.readJsonBody(request, context.maxBodyBytes)));
    return true;
  }

  if (method === "POST" && pathname === "/api/epoch/market/fill") {
    await persistAndSend(context, runtime.epochFillMarketOrder(await context.readJsonBody(request, context.maxBodyBytes)));
    return true;
  }

  if (method === "POST" && pathname === "/api/epoch/market/cancel") {
    await persistAndSend(context, runtime.epochCancelMarketOrder(await context.readJsonBody(request, context.maxBodyBytes)));
    return true;
  }

  if (method === "POST" && pathname === "/api/epoch/direct-trades/create") {
    await persistAndSend(context, runtime.epochCreateDirectTrade(await context.readJsonBody(request, context.maxBodyBytes)));
    return true;
  }

  if (method === "POST" && pathname === "/api/epoch/direct-trades/accept") {
    await persistAndSend(context, runtime.epochAcceptDirectTrade(await context.readJsonBody(request, context.maxBodyBytes)));
    return true;
  }

  if (method === "POST" && pathname === "/api/epoch/direct-trades/cancel") {
    await persistAndSend(context, runtime.epochCancelDirectTrade(await context.readJsonBody(request, context.maxBodyBytes)));
    return true;
  }

  if (method === "POST" && pathname === "/api/epoch/direct-trades/expiry/tick") {
    await persistAndSend(context, runtime.epochTickDirectTradeExpiry(await context.readJsonBody(request, context.maxBodyBytes)));
    return true;
  }

  if (method === "POST" && pathname === "/api/epoch/market/expiry/tick") {
    await persistAndSend(context, runtime.epochTickMarketExpiry(await context.readJsonBody(request, context.maxBodyBytes)));
    return true;
  }

  return false;
}
