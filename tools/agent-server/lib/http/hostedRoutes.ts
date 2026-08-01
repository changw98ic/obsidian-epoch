import { type IncomingHttpHeaders } from "node:http";
import { type EpochHttpRouteContext } from "./httpRouteTypes.ts";

function firstHeaderValue(value: IncomingHttpHeaders[string]) {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw?.split(",")[0]?.trim();
}

function operatorKeyFromHeaders(headers: IncomingHttpHeaders) {
  return firstHeaderValue(headers["x-epoch-operator-key"]);
}

async function persistAndSend(context: EpochHttpRouteContext, result: unknown) {
  const { allowedOrigins, request, response } = context;
  await context.persistEpochEvents(result);
  context.sendJson(request, response, 200, result, allowedOrigins);
}

export async function handleEpochHostedRoutes(context: EpochHttpRouteContext): Promise<boolean> {
  const {
    allowedOrigins,
    method,
    pathname,
    request,
    response,
    runtime,
  } = context;

  if (method === "GET" && pathname === "/api/epoch/hosted/sessions") {
    const params = context.queryParams(request);
    context.sendJson(request, response, 200, runtime.epochHostedSessions({
      agentId: params.get("agentId") || undefined,
      status: params.get("status") || undefined,
      limit: params.get("limit") || undefined,
    }), allowedOrigins);
    return true;
  }

  if (method === "GET" && pathname === "/api/epoch/hosted/watch") {
    const params = context.queryParams(request);
    const watch = runtime.epochHostedSessionWatch({
      sessionId: params.get("sessionId") || undefined,
    });
    context.sendJson(request, response, watch.session ? 200 : 404, watch.session ? watch : {
      error: "hosted_session_not_found",
      ...watch,
    }, allowedOrigins);
    return true;
  }

  if (method === "POST" && pathname === "/api/epoch/hosted/start") {
    await persistAndSend(context, runtime.epochStartHostedSession(await context.readJsonBody(request, context.maxBodyBytes)));
    return true;
  }

  if (method === "POST" && pathname === "/api/epoch/hosted/action") {
    await persistAndSend(context, runtime.epochSubmitHostedAction(await context.readJsonBody(request, context.maxBodyBytes)));
    return true;
  }

  if (method === "POST" && pathname === "/api/epoch/hosted/intent") {
    await persistAndSend(context, runtime.epochSubmitHostedIntent(await context.readJsonBody(request, context.maxBodyBytes)));
    return true;
  }

  if (method === "POST" && pathname === "/api/epoch/journey/intent") {
    await persistAndSend(context, runtime.epochCommitJourneyIntent(await context.readJsonBody(request, context.maxBodyBytes)));
    return true;
  }

  if (method === "POST" && pathname === "/api/epoch/hosted/server-action") {
    await persistAndSend(context, runtime.epochRunServerHostedAction(await context.readJsonBody(request, context.maxBodyBytes)));
    return true;
  }

  if (method === "GET" && pathname === "/api/epoch/hosted/server-jobs") {
    const params = context.queryParams(request);
    context.sendJson(request, response, 200, runtime.epochServerHostedJobs({
      operatorKey: operatorKeyFromHeaders(request.headers),
      agentId: params.get("agentId") || undefined,
      status: params.get("status") || undefined,
    }), allowedOrigins);
    return true;
  }

  if (method === "POST" && pathname === "/api/epoch/hosted/server-jobs") {
    await persistAndSend(context, runtime.epochQueueServerHostedAction(await context.readJsonBody(request, context.maxBodyBytes)));
    return true;
  }

  if (method === "POST" && pathname === "/api/epoch/hosted/server-jobs/run") {
    await persistAndSend(context, runtime.epochRunServerHostedJob(await context.readJsonBody(request, context.maxBodyBytes)));
    return true;
  }

  if (method === "POST" && pathname === "/api/epoch/web-bridge/turn") {
    await persistAndSend(context, runtime.epochWebBridgeTurn(await context.readJsonBody(request, context.maxBodyBytes)));
    return true;
  }

  if (method === "POST" && pathname === "/api/epoch/web-bridge/action") {
    await persistAndSend(context, runtime.epochSubmitWebBridgeAction(await context.readJsonBody(request, context.maxBodyBytes)));
    return true;
  }

  if (method === "POST" && pathname === "/api/epoch/web-bridge/intent") {
    await persistAndSend(context, runtime.epochSubmitWebBridgeIntent(await context.readJsonBody(request, context.maxBodyBytes)));
    return true;
  }

  if (method === "POST" && pathname === "/api/epoch/attestation/challenge") {
    context.sendJson(request, response, 200, runtime.epochAttestationChallenge(await context.readJsonBody(request, context.maxBodyBytes)), allowedOrigins);
    return true;
  }

  if (method === "POST" && pathname === "/api/epoch/attestation/action") {
    await persistAndSend(context, runtime.epochSubmitAttestedAction(await context.readJsonBody(request, context.maxBodyBytes)));
    return true;
  }

  return false;
}
