import { renderEpochResultPageHtml } from "../resultPageHtml.ts";
import { type EpochHttpRouteContext } from "./httpRouteTypes.ts";

function escapeStatusHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderResultPageStatusHtml(status: string) {
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>Result unavailable</title></head><body><main><h1>结果页不可用</h1><p>${escapeStatusHtml(status)}</p></main></body></html>`;
}

export async function handleEpochResultRoutes(context: EpochHttpRouteContext): Promise<boolean> {
  const {
    allowedOrigins,
    maxBodyBytes,
    method,
    pathname,
    request,
    response,
    runtime,
  } = context;

  if (method === "POST" && pathname === "/api/epoch/exploration/run") {
    const result = runtime.epochRunExploration(await context.readJsonBody(request, maxBodyBytes));
    await context.persistEpochResultPage({
      commandPersistence: {
        command: "POST /api/epoch/exploration/run",
        sourceResult: result,
        pageResult: {
          page: result.value.resultPage,
          duplicate: result.duplicate,
        },
      },
    });
    context.sendJson(request, response, 200, result, allowedOrigins);
    return true;
  }

  if (method === "GET" && pathname === "/api/epoch/result-page") {
    const params = context.queryParams(request);
    context.sendJson(request, response, 200, runtime.epochResultPage({
      agentId: params.get("agentId") || undefined,
      explorerId: params.get("explorerId") || undefined,
      turnCardId: params.get("turnCardId") || params.get("focusTurnCardId") || undefined,
      hostedSessionId: params.get("hostedSessionId") || params.get("focusHostedSessionId") || undefined,
      limit: params.get("limit") || undefined,
    }), allowedOrigins);
    return true;
  }

  if (method === "POST" && pathname === "/api/epoch/result-page/create") {
    const result = runtime.epochCreateResultPage(await context.readJsonBody(request, maxBodyBytes));
    await context.persistEpochResultPage({
      commandPersistence: {
        command: "POST /api/epoch/result-page/create",
        sourceResult: result,
        pageResult: result,
      },
    });
    context.sendJson(request, response, 200, result, allowedOrigins);
    return true;
  }

  if (method === "POST" && pathname === "/api/epoch/result-page/revoke") {
    const result = runtime.epochRevokeResultPage(await context.readJsonBody(request, maxBodyBytes));
    await context.persistEpochResultPage({
      commandPersistence: {
        command: "POST /api/epoch/result-page/revoke",
        sourceResult: result,
        pageResult: result,
      },
    });
    context.sendJson(request, response, 200, result, allowedOrigins);
    return true;
  }

  if (method === "POST" && pathname === "/api/epoch/result-page/delete") {
    const result = runtime.epochDeleteResultPage(await context.readJsonBody(request, maxBodyBytes));
    await context.persistEpochResultPage({
      commandPersistence: {
        command: "POST /api/epoch/result-page/delete",
        sourceResult: result,
        pageResult: result,
      },
    });
    context.sendJson(request, response, 200, result, allowedOrigins);
    return true;
  }

  if (method === "GET" && pathname.startsWith("/epoch/result/")) {
    const access = runtime.epochGetPublicResultPage({
      pageId: decodeURIComponent(pathname.split("/").pop() || ""),
      shareToken: context.queryParams(request).get("shareToken") || undefined,
      shareVersion: context.queryParams(request).get("shareVersion") || undefined,
    });
    if (access.status === "missing" || !access.page) {
      context.sendHtml(request, response, 404, "<!doctype html><title>Result not found</title><p>result_page_not_found</p>", allowedOrigins);
      return true;
    }
    if (access.status !== "available") {
      context.sendHtml(request, response, access.statusCode, renderResultPageStatusHtml(`result_page_${access.status}`), allowedOrigins);
      return true;
    }
    if (!access.page.payload) {
      context.sendHtml(request, response, 410, renderResultPageStatusHtml("result_page_deleted"), allowedOrigins);
      return true;
    }
    context.sendHtml(request, response, 200, renderEpochResultPageHtml({
      ...access.page,
      payload: access.page.payload,
    }), allowedOrigins);
    return true;
  }

  return false;
}
