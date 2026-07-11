import { type EpochHttpRouteContext } from "./httpRouteTypes.ts";

type LegacyRecord = Record<string, unknown>;

export const LEGACY_MUTATION_DISABLED_ERROR = "legacy_mutation_disabled_in_production";

export interface LegacyRuntimeRouteContext extends EpochHttpRouteContext {
  readonly persistRunSettlement: (body: LegacyRecord, settlement: unknown) => Promise<void>;
  readonly persistContextSnapshot: (contextPackage: unknown) => Promise<void>;
  readonly persistStateSnapshot: (fileName: string, record: unknown) => Promise<void>;
  readonly persistOutboxEntries: (entries: readonly LegacyRecord[]) => Promise<number>;
}

function isRecord(value: unknown): value is LegacyRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function recordValue(value: unknown): LegacyRecord {
  return isRecord(value) ? value : {};
}

function optionalString(value: unknown) {
  return typeof value === "string" && value ? value : undefined;
}

function finalPathSegment(context: LegacyRuntimeRouteContext) {
  const pathname = new URL(context.request.url || "/", "http://127.0.0.1").pathname;
  return decodeURIComponent(pathname.split("/").pop() || "");
}

export async function handleLegacyRuntimeRoutes(context: LegacyRuntimeRouteContext): Promise<boolean> {
  const { allowedOrigins, maxBodyBytes, method, pathname, request, response, runtime } = context;
  const url = request.url || "/";

  if (
    process.env.NODE_ENV === "production"
    && method === "POST"
    && (url === "/api/runs/start" || url === "/api/runs/submit")
  ) {
    context.sendJson(request, response, 403, {
      error: LEGACY_MUTATION_DISABLED_ERROR,
      message: "Use server-authoritative obsidian_epoch turn tools.",
    }, allowedOrigins);
    return true;
  }

  if (method === "POST" && url === "/api/runs/start") {
    const body = await context.readJsonBody(request, maxBodyBytes);
    const ticket = runtime.startRun(body);
    await context.persistStateSnapshot("tickets.jsonl", { type: "ticket_issued", ...ticket });
    context.sendJson(request, response, 200, ticket, allowedOrigins);
    return true;
  }

  if (method === "POST" && url === "/api/runs/heartbeat") {
    const body = await context.readJsonBody(request, maxBodyBytes);
    const ticket = runtime.runHeartbeat(body);
    await context.persistStateSnapshot("tickets.jsonl", { type: "ticket_heartbeat", ...ticket });
    context.sendJson(request, response, 200, ticket, allowedOrigins);
    return true;
  }

  if (method === "POST" && url === "/api/runs/submit") {
    const body = await context.readJsonBody(request, maxBodyBytes);
    const settlement = runtime.submitBattleReport(body);
    if (recordValue(settlement).state === "review_delayed") {
      context.sendJson(request, response, 202, settlement, allowedOrigins);
      return true;
    }
    await context.persistRunSettlement(body, settlement);
    context.sendJson(request, response, 200, settlement, allowedOrigins);
    return true;
  }

  if (method === "POST" && url === "/api/runs/archive") {
    const body = await context.readJsonBody(request, maxBodyBytes);
    const settlement = runtime.archiveLocalReport(body);
    await context.persistRunSettlement(body, settlement);
    context.sendJson(request, response, 200, settlement, allowedOrigins);
    return true;
  }

  if (method === "POST" && url === "/api/context/package") {
    const contextPackage = runtime.getContext(await context.readJsonBody(request, maxBodyBytes));
    await context.persistContextSnapshot(contextPackage);
    context.sendJson(request, response, 200, contextPackage, allowedOrigins);
    return true;
  }

  if (method === "GET" && pathname === "/api/world/public-context") {
    const params = context.queryParams(request);
    const contextPackage = runtime.getContext({
      agentId: params.get("agentId") || undefined,
      explorerId: params.get("explorerId") || undefined,
      mandate: params.get("mandate") || undefined,
      additionalInstruction: params.get("additionalInstruction") || undefined,
    });
    await context.persistContextSnapshot(contextPackage);
    context.sendJson(request, response, 200, contextPackage, allowedOrigins);
    return true;
  }

  if (method === "POST" && pathname === "/api/world/public-context") {
    const contextPackage = runtime.getContext(await context.readJsonBody(request, maxBodyBytes));
    await context.persistContextSnapshot(contextPackage);
    context.sendJson(request, response, 200, contextPackage, allowedOrigins);
    return true;
  }

  if (method === "GET" && pathname === "/api/context/snapshots") {
    const params = context.queryParams(request);
    context.sendJson(request, response, 200, runtime.contextSnapshots({
      limit: params.get("limit") ? Number(params.get("limit")) : undefined,
    }), allowedOrigins);
    return true;
  }

  if (method === "GET" && url === "/api/lore/public") {
    context.sendJson(request, response, 200, runtime.loreState(), allowedOrigins);
    return true;
  }

  if (method === "GET" && url.startsWith("/api/progression/state")) {
    const explorerId = context.queryParams(request).get("explorerId");
    context.sendJson(request, response, explorerId ? 200 : 400, explorerId
      ? runtime.progressionState({ explorerId })
      : { error: "explorer_id_required" }, allowedOrigins);
    return true;
  }

  if (method === "GET" && url.startsWith("/api/progression/check")) {
    const params = context.queryParams(request);
    const explorerId = params.get("explorerId");
    context.sendJson(request, response, explorerId ? 200 : 400, explorerId
      ? runtime.operationCheck({
          explorerId,
          factionId: params.get("factionId") || "腐林档案会",
          operation: params.get("operation") || "high_risk_mandate",
        })
      : { error: "explorer_id_required" }, allowedOrigins);
    return true;
  }

  if (method === "GET" && url === "/api/factions/public") {
    context.sendJson(request, response, 200, runtime.factionState(), allowedOrigins);
    return true;
  }

  if (method === "POST" && url === "/api/factions/propose") {
    const body = await context.readJsonBody(request, maxBodyBytes);
    const result = runtime.proposeFaction(body);
    await context.persistStateSnapshot("factions.jsonl", {
      type: "faction_proposal",
      explorerId: body.explorerId,
      runTicket: body.runTicket,
      result,
      state: runtime.factionState(),
    });
    context.sendJson(request, response, result.status === "rejected" ? 400 : 200, result, allowedOrigins);
    return true;
  }

  if (method === "POST" && url === "/api/factions/support") {
    const body = await context.readJsonBody(request, maxBodyBytes);
    const result = runtime.supportFaction(body);
    await context.persistStateSnapshot("factions.jsonl", {
      type: "faction_support",
      factionId: body.factionId,
      explorerId: body.explorerId,
      runTicket: body.runTicket,
      result,
      state: runtime.factionState(),
    });
    context.sendJson(request, response, result.status === "rejected" ? 400 : 200, result, allowedOrigins);
    return true;
  }

  if (method === "POST" && url === "/api/factions/reference") {
    const body = await context.readJsonBody(request, maxBodyBytes);
    const result = runtime.referenceFaction(body);
    await context.persistStateSnapshot("factions.jsonl", {
      type: "faction_reference",
      factionId: body.factionId,
      explorerId: body.explorerId,
      runTicket: body.runTicket,
      result,
      state: runtime.factionState(),
    });
    context.sendJson(request, response, result.status === "rejected" ? 400 : 200, result, allowedOrigins);
    return true;
  }

  if (method === "GET" && url === "/api/feedback/repair") {
    context.sendJson(request, response, 200, runtime.repairTickets(), allowedOrigins);
    return true;
  }

  if (method === "GET" && url === "/api/feedback/events") {
    context.sendJson(request, response, 200, runtime.feedbackEvents(), allowedOrigins);
    return true;
  }

  if (method === "GET" && url.startsWith("/api/feedback/digest")) {
    context.sendJson(request, response, 200, runtime.feedbackDigest({
      date: context.queryParams(request).get("date"),
    }), allowedOrigins);
    return true;
  }

  if (method === "GET" && pathname === "/api/outbox") {
    const params = context.queryParams(request);
    context.sendJson(request, response, 200, runtime.outbox({
      status: params.get("status") || undefined,
      limit: params.get("limit") ? Number(params.get("limit")) : undefined,
    }), allowedOrigins);
    return true;
  }

  if (method === "GET" && pathname === "/api/review-queue") {
    const params = context.queryParams(request);
    context.sendJson(request, response, 200, runtime.reviewQueue({
      limit: params.get("limit") ? Number(params.get("limit")) : undefined,
    }), allowedOrigins);
    return true;
  }

  if (method === "POST" && pathname === "/api/outbox/replay") {
    const result = runtime.replayOutbox(await context.readJsonBody(request, maxBodyBytes));
    await context.persistOutboxEntries([recordValue(recordValue(result).entry)]);
    context.sendJson(request, response, 200, result, allowedOrigins);
    return true;
  }

  if (method === "GET" && url === "/api/world/browser") {
    context.sendJson(request, response, 200, runtime.publicWorld(), allowedOrigins);
    return true;
  }

  if (method === "GET" && url === "/api/world/runs") {
    context.sendJson(request, response, 200, { archive: runtime.publicWorld().archive }, allowedOrigins);
    return true;
  }

  if (method === "GET" && url === "/api/world/source-graph") {
    context.sendJson(request, response, 200, runtime.publicWorld().sourceGraph, allowedOrigins);
    return true;
  }

  if (method === "GET" && url.startsWith("/api/world/claims/")) {
    const detail = runtime.publicWorld().claimDetails[finalPathSegment(context)];
    context.sendJson(request, response, detail ? 200 : 404, detail || { error: "claim_not_found" }, allowedOrigins);
    return true;
  }

  if (method === "GET" && url.startsWith("/api/world/conflicts/")) {
    const detail = runtime.publicWorld().conflictDetails[finalPathSegment(context)];
    context.sendJson(request, response, detail ? 200 : 404, detail || { error: "conflict_not_found" }, allowedOrigins);
    return true;
  }

  if (method === "GET" && url.startsWith("/api/world/factions/")) {
    const detail = runtime.publicWorld().factionDetails[finalPathSegment(context)];
    context.sendJson(request, response, detail ? 200 : 404, detail || { error: "faction_not_found" }, allowedOrigins);
    return true;
  }

  if (method === "POST" && url === "/api/community/reaction") {
    const result = runtime.communityReact(await context.readJsonBody(request, maxBodyBytes));
    await context.persistStateSnapshot("community.jsonl", {
      type: "community_state",
      action: "reaction",
      result,
      state: runtime.communityState(),
    });
    context.sendJson(request, response, 200, result, allowedOrigins);
    return true;
  }

  if (method === "POST" && url === "/api/community/comment") {
    const result = runtime.communityComment(await context.readJsonBody(request, maxBodyBytes));
    await context.persistStateSnapshot("community.jsonl", {
      type: "community_state",
      action: "comment",
      result,
      state: runtime.communityState(),
    });
    context.sendJson(request, response, 200, result, allowedOrigins);
    return true;
  }

  if (method === "POST" && url === "/api/community/flag") {
    const result = runtime.communityFlag(await context.readJsonBody(request, maxBodyBytes));
    await context.persistStateSnapshot("community.jsonl", {
      type: "community_state",
      action: "flag",
      result,
      state: runtime.communityState(),
    });
    context.sendJson(request, response, 200, result, allowedOrigins);
    return true;
  }

  if (method === "GET" && url.startsWith("/api/community/thread")) {
    const targetId = context.queryParams(request).get("targetId");
    context.sendJson(request, response, targetId ? 200 : 400, targetId
      ? runtime.communityThread({ targetId })
      : { error: "target_id_required" }, allowedOrigins);
    return true;
  }

  if (method === "GET" && url === "/api/community/moderation") {
    context.sendJson(request, response, 200, runtime.communityModeration(), allowedOrigins);
    return true;
  }

  if (method === "GET" && url.startsWith("/api/experience/state")) {
    const explorerId = context.queryParams(request).get("explorerId");
    context.sendJson(request, response, explorerId ? 200 : 400, explorerId
      ? runtime.experienceState({ explorerId })
      : { error: "explorer_id_required" }, allowedOrigins);
    return true;
  }

  if (method === "POST" && url === "/api/experience/voice") {
    const body = await context.readJsonBody(request, maxBodyBytes);
    const explorerId = optionalString(body.explorerId);
    const result = runtime.selectVoiceProfile(body);
    await context.persistStateSnapshot("experience.jsonl", {
      type: "experience_state",
      explorerId: body.explorerId,
      result,
      state: runtime.experienceState({ explorerId }),
    });
    context.sendJson(request, response, 200, result, allowedOrigins);
    return true;
  }

  if (method === "GET" && url.startsWith("/api/experience/sound-style")) {
    context.sendJson(request, response, 200, runtime.soundStyle({
      factionId: context.queryParams(request).get("factionId") || "腐林档案会",
    }), allowedOrigins);
    return true;
  }

  if (method === "GET" && url === "/api/transparency/verify") {
    context.sendJson(request, response, 200, runtime.transparencyVerify(), allowedOrigins);
    return true;
  }

  if (method === "GET" && url === "/api/transparency/export") {
    context.sendJson(request, response, 200, runtime.transparencyExport(), allowedOrigins);
    return true;
  }

  if (method === "POST" && url === "/api/transparency/anchor") {
    const anchor = runtime.transparencyAnchor(await context.readJsonBody(request, maxBodyBytes));
    await context.persistStateSnapshot("transparency.jsonl", {
      type: "transparency_anchor",
      anchor,
    });
    context.sendJson(request, response, 200, anchor, allowedOrigins);
    return true;
  }

  return false;
}
