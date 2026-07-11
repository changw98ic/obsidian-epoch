import { createHash } from "node:crypto";
import {
  OBSIDIAN_EPOCH_PACKAGE_SIGNATURE_ALGORITHM,
  createTarGzArchive,
  obsidianEpochPackageSigningKeySource,
  obsidianEpochPackageSigningTrust,
  obsidianEpochReleaseKeyId,
  obsidianEpochReleasePublicKey,
  signObsidianEpochReleasePayload,
} from "../packageArchive.ts";
import {
  renderEpochAuditPublicPageHtml,
  renderEpochSeasonPublicPageHtml,
} from "../publicWorldPageHtml.ts";
import {
  type EpochHttpRouteContext,
  type SendBinary,
  type SendJsonDownload,
  type SendTextDownload,
} from "./httpRouteTypes.ts";
import { type EpochAuditInfo } from "../epoch/runtime.ts";

function publicAuditPayloadValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(publicAuditPayloadValue);
  if (typeof value === "string" && value.startsWith("explorer_")) return "private";
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).flatMap(([key, nestedValue]) =>
    /explorer.?id|causation.?id|correlation.?id|idempotency.?key/i.test(key)
      ? []
      : [[key, publicAuditPayloadValue(nestedValue)]]));
}

function publicAuditInfo(info: EpochAuditInfo): EpochAuditInfo {
  const publicEvent = (event: EpochAuditInfo["events"][number]) => ({
    ...event,
    actorExplorerId: "private",
    causationId: "private",
    correlationId: "private",
    idempotencyKey: undefined,
    payload: publicAuditPayloadValue(event.payload) as Record<string, unknown>,
  });
  return {
    ...info,
    events: info.events.map(publicEvent),
    selectedEvent: info.selectedEvent ? publicEvent(info.selectedEvent) : undefined,
    riskProfile: {
      ...info.riskProfile,
      agents: info.riskProfile.agents.map((agent) => ({ ...agent, explorerId: "private" })),
    },
  };
}

type AuditRouteContext = EpochHttpRouteContext & {
  readonly sendBinary: SendBinary;
  readonly sendJsonDownload: SendJsonDownload;
  readonly sendTextDownload: SendTextDownload;
};

type Runtime = EpochHttpRouteContext["runtime"];
type EpochSeasonArchiveView = ReturnType<Runtime["epochSeasonArchive"]>;
type EpochSeasonContributionAuditRow = EpochSeasonArchiveView["contributions"][number];

function finalPathSegment(pathname: string) {
  return decodeURIComponent(pathname.split("/").pop() || "");
}

function seasonAuditExportRequest(pathname: string) {
  const match = pathname.match(/^\/epoch\/season\/([^/]+)\/audit-export\.(json|csv|manifest\.json|bundle\.json|tar\.gz|tar\.gz\.signature\.json)$/);
  if (!match) return undefined;
  return {
    seasonId: decodeURIComponent(match[1]),
    format: match[2] === "manifest.json"
      ? "manifest"
      : match[2] === "bundle.json"
        ? "bundle"
        : match[2] === "tar.gz"
          ? "tarGz"
          : match[2] === "tar.gz.signature.json"
            ? "tarGzSignature"
            : match[2] as "json" | "csv",
  };
}

function downloadFileNameToken(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 96) || "season";
}

function seasonArchiveFilterInput(seasonId: string, params: URLSearchParams) {
  return {
    seasonId,
    factionId: params.get("factionId") || undefined,
    agentId: params.get("agentId") || undefined,
  };
}

function seasonContributionAuditExport(runtime: Runtime, seasonId: string, params: URLSearchParams) {
  const input = seasonArchiveFilterInput(seasonId, params);
  const firstPage = runtime.epochSeasonArchive({
    ...input,
    contributionLimit: 50,
    contributionOffset: 0,
  });
  const contributions: EpochSeasonContributionAuditRow[] = [...firstPage.contributions];
  while (contributions.length < firstPage.contributionPagination.total) {
    const page = runtime.epochSeasonArchive({
      ...input,
      contributionLimit: 50,
      contributionOffset: contributions.length,
    });
    if (!page.contributions.length) break;
    contributions.push(...page.contributions);
  }
  return {
    type: "obsidian_epoch_season_contribution_audit_export",
    version: 1,
    seasonId,
    season: firstPage.season,
    contributionFilters: firstPage.contributionFilters,
    contributionCount: contributions.length,
    scoreDeltaTotal: contributions.reduce((total, contribution) => total + contribution.scoreDelta, 0),
    resourceAmountTotal: contributions.reduce((total, contribution) => total + contribution.amount, 0),
    dailyTotals: firstPage.contributionDailyTotals,
    contributions,
    publicPages: firstPage.publicPages,
  };
}

function seasonContributionExportPath(
  seasonId: string,
  params: URLSearchParams,
  extension: "json" | "csv" | "manifest.json" | "bundle.json" | "tar.gz" | "tar.gz.signature.json",
) {
  const filterParams = new URLSearchParams();
  const factionId = params.get("factionId");
  const agentId = params.get("agentId");
  if (factionId) filterParams.set("factionId", factionId);
  if (agentId) filterParams.set("agentId", agentId);
  const query = filterParams.toString();
  return `/epoch/season/${encodeURIComponent(seasonId)}/audit-export.${extension}${query ? `?${query}` : ""}`;
}

function sha256Hex(value: string | Uint8Array) {
  return createHash("sha256").update(value).digest("hex");
}

const SEASON_CONTRIBUTION_AUDIT_CSV_COLUMNS = [
  "eventId",
  "seasonId",
  "recordedAt",
  "recordedDate",
  "agentId",
  "explorerId",
  "factionId",
  "resourceId",
  "amount",
  "baseScoreDelta",
  "organizationBonusScore",
  "sourceOrganizationUpgradeIds",
  "scoreDelta",
  "trustClass",
  "auditUrl",
  "agentUrl",
  "explorerUrl",
] as const;

function csvCell(value: string | number | undefined) {
  const text = value === undefined ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll("\"", "\"\"")}"` : text;
}

function csvRow(values: readonly (string | number | undefined)[]) {
  return values.map(csvCell).join(",");
}

function seasonContributionAuditCsv(auditExport: ReturnType<typeof seasonContributionAuditExport>) {
  const rows = [SEASON_CONTRIBUTION_AUDIT_CSV_COLUMNS.join(",")];
  for (const contribution of auditExport.contributions) {
    rows.push(csvRow([
      contribution.eventId,
      contribution.seasonId,
      contribution.recordedAt,
      contribution.recordedAt.slice(0, 10),
      contribution.agentId,
      contribution.explorerId,
      contribution.factionId,
      contribution.resourceId,
      contribution.amount,
      contribution.baseScoreDelta,
      contribution.organizationBonusScore,
      contribution.sourceOrganizationUpgradeIds.join(";"),
      contribution.scoreDelta,
      contribution.trustClass,
      contribution.publicPages.audit,
      contribution.publicPages.agent,
      contribution.publicPages.explorer,
    ]));
  }
  return `${rows.join("\n")}\n`;
}

function seasonContributionAuditExportManifest(
  auditExport: ReturnType<typeof seasonContributionAuditExport>,
  params: URLSearchParams,
) {
  const jsonPayload = `${JSON.stringify(auditExport, null, 2)}\n`;
  const csvPayload = seasonContributionAuditCsv(auditExport);
  const unsignedManifest = {
    type: "obsidian_epoch_season_contribution_audit_export_manifest",
    version: 1,
    algorithm: "sha256",
    signatureAlgorithm: OBSIDIAN_EPOCH_PACKAGE_SIGNATURE_ALGORITHM,
    releasePublicKey: obsidianEpochReleasePublicKey(),
    releaseKeyId: obsidianEpochReleaseKeyId(),
    packageSigningTrust: obsidianEpochPackageSigningTrust(),
    packageSigningKeySource: obsidianEpochPackageSigningKeySource(),
    seasonId: auditExport.seasonId,
    contributionFilters: auditExport.contributionFilters,
    contributionCount: auditExport.contributionCount,
    scoreDeltaTotal: auditExport.scoreDeltaTotal,
    resourceAmountTotal: auditExport.resourceAmountTotal,
    exports: [
      {
        format: "json",
        path: seasonContributionExportPath(auditExport.seasonId, params, "json"),
        contentType: "application/json; charset=utf-8",
        bytes: Buffer.byteLength(jsonPayload),
        sha256: sha256Hex(jsonPayload),
      },
      {
        format: "csv",
        path: seasonContributionExportPath(auditExport.seasonId, params, "csv"),
        contentType: "text/csv; charset=utf-8",
        bytes: Buffer.byteLength(csvPayload),
        sha256: sha256Hex(csvPayload),
      },
    ],
  } as const;
  return {
    ...unsignedManifest,
    signature: signObsidianEpochReleasePayload(Buffer.from(JSON.stringify(unsignedManifest), "utf8")),
  };
}

function seasonContributionAuditExportBundle(
  auditExport: ReturnType<typeof seasonContributionAuditExport>,
  params: URLSearchParams,
) {
  const manifest = seasonContributionAuditExportManifest(auditExport, params);
  const jsonEntry = manifest.exports.find((entry) => entry.format === "json");
  const csvEntry = manifest.exports.find((entry) => entry.format === "csv");
  const csvPayload = seasonContributionAuditCsv(auditExport);
  return {
    type: "obsidian_epoch_season_contribution_audit_export_bundle",
    version: 1,
    seasonId: auditExport.seasonId,
    contributionFilters: auditExport.contributionFilters,
    contributionCount: auditExport.contributionCount,
    scoreDeltaTotal: auditExport.scoreDeltaTotal,
    resourceAmountTotal: auditExport.resourceAmountTotal,
    manifest,
    files: [
      {
        format: "json",
        path: jsonEntry?.path || seasonContributionExportPath(auditExport.seasonId, params, "json"),
        contentType: jsonEntry?.contentType || "application/json; charset=utf-8",
        sha256: jsonEntry?.sha256 || sha256Hex(`${JSON.stringify(auditExport, null, 2)}\n`),
        body: auditExport,
      },
      {
        format: "csv",
        path: csvEntry?.path || seasonContributionExportPath(auditExport.seasonId, params, "csv"),
        contentType: csvEntry?.contentType || "text/csv; charset=utf-8",
        sha256: csvEntry?.sha256 || sha256Hex(csvPayload),
        body: csvPayload,
      },
    ],
  };
}

function seasonContributionAuditArchive(
  auditExport: ReturnType<typeof seasonContributionAuditExport>,
  params: URLSearchParams,
) {
  const manifest = seasonContributionAuditExportManifest(auditExport, params);
  return createTarGzArchive([
    {
      path: "audit-export.json",
      content: Buffer.from(`${JSON.stringify(auditExport, null, 2)}\n`, "utf8"),
    },
    {
      path: "audit-export.csv",
      content: Buffer.from(seasonContributionAuditCsv(auditExport), "utf8"),
    },
    {
      path: "audit-export.manifest.json",
      content: Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, "utf8"),
    },
  ], { mtime: 0 });
}

function seasonContributionAuditArchiveSignature(
  auditExport: ReturnType<typeof seasonContributionAuditExport>,
  params: URLSearchParams,
) {
  const archive = seasonContributionAuditArchive(auditExport, params);
  const unsignedSignature = {
    type: "obsidian_epoch_season_contribution_audit_archive_signature",
    version: 1,
    algorithm: "sha256",
    signatureAlgorithm: OBSIDIAN_EPOCH_PACKAGE_SIGNATURE_ALGORITHM,
    releasePublicKey: obsidianEpochReleasePublicKey(),
    releaseKeyId: obsidianEpochReleaseKeyId(),
    packageSigningTrust: obsidianEpochPackageSigningTrust(),
    packageSigningKeySource: obsidianEpochPackageSigningKeySource(),
    seasonId: auditExport.seasonId,
    contributionFilters: auditExport.contributionFilters,
    contributionCount: auditExport.contributionCount,
    scoreDeltaTotal: auditExport.scoreDeltaTotal,
    resourceAmountTotal: auditExport.resourceAmountTotal,
    archive: {
      format: "tar.gz",
      path: seasonContributionExportPath(auditExport.seasonId, params, "tar.gz"),
      contentType: "application/gzip",
      bytes: archive.byteLength,
      sha256: sha256Hex(archive),
    },
  } as const;
  return {
    ...unsignedSignature,
    signature: signObsidianEpochReleasePayload(Buffer.from(JSON.stringify(unsignedSignature), "utf8")),
  };
}

export async function handleEpochAuditRoutes(context: AuditRouteContext): Promise<boolean> {
  const { allowedOrigins, method, pathname, request, response, runtime } = context;

  if (method === "GET" && pathname === "/api/epoch/audit") {
    const params = context.queryParams(request);
    context.sendJson(request, response, 200, publicAuditInfo(runtime.epochAudit({
      agentId: params.get("agentId") || undefined,
      eventType: params.get("eventType") || undefined,
      eventId: params.get("eventId") || undefined,
      aggregateId: params.get("aggregateId") || undefined,
      highImpactOnly: params.get("highImpactOnly") || undefined,
      riskOnly: params.get("riskOnly") || undefined,
      limit: params.get("limit") || undefined,
    })), allowedOrigins);
    return true;
  }

  if (method === "GET" && pathname.startsWith("/api/epoch/audit/")) {
    const eventId = finalPathSegment(pathname);
    const audit = runtime.epochAudit({ eventId, limit: 50 });
    context.sendJson(request, response, audit.selectedEvent ? 200 : 404, audit.selectedEvent ? publicAuditInfo(audit) : { error: "epoch_audit_event_not_found" }, allowedOrigins);
    return true;
  }

  if (method === "POST" && pathname === "/api/epoch/audit/risk-review") {
    const result = runtime.epochRecordRiskReview(await context.readJsonBody(request, context.maxBodyBytes));
    await context.persistEpochEvents(result);
    context.sendJson(request, response, 200, result, allowedOrigins);
    return true;
  }

  const seasonExport = method === "GET" ? seasonAuditExportRequest(pathname) : undefined;
  if (seasonExport) {
    const params = context.queryParams(request);
    const auditExport = seasonContributionAuditExport(runtime, seasonExport.seasonId, params);
    if (!auditExport.season) {
      context.sendJson(request, response, 404, { error: "season_not_found" }, allowedOrigins);
      return true;
    }
    if (seasonExport.format === "manifest") {
      context.sendJsonDownload(
        request,
        response,
        200,
        seasonContributionAuditExportManifest(auditExport, params),
        allowedOrigins,
        `season-contribution-audit-${downloadFileNameToken(seasonExport.seasonId)}.manifest.json`,
      );
      return true;
    }
    if (seasonExport.format === "bundle") {
      context.sendJsonDownload(
        request,
        response,
        200,
        seasonContributionAuditExportBundle(auditExport, params),
        allowedOrigins,
        `season-contribution-audit-${downloadFileNameToken(seasonExport.seasonId)}.bundle.json`,
      );
      return true;
    }
    if (seasonExport.format === "tarGzSignature") {
      context.sendJsonDownload(
        request,
        response,
        200,
        seasonContributionAuditArchiveSignature(auditExport, params),
        allowedOrigins,
        `season-contribution-audit-${downloadFileNameToken(seasonExport.seasonId)}.tar.gz.signature.json`,
      );
      return true;
    }
    if (seasonExport.format === "tarGz") {
      context.sendBinary(request, response, 200, seasonContributionAuditArchive(auditExport, params), allowedOrigins, {
        "content-type": "application/gzip",
        "cache-control": "no-store",
        "content-disposition": `attachment; filename="season-contribution-audit-${downloadFileNameToken(seasonExport.seasonId)}.tar.gz"`,
      });
      return true;
    }
    if (seasonExport.format === "csv") {
      context.sendTextDownload(
        request,
        response,
        200,
        seasonContributionAuditCsv(auditExport),
        allowedOrigins,
        `season-contribution-audit-${downloadFileNameToken(seasonExport.seasonId)}.csv`,
        "text/csv; charset=utf-8",
      );
      return true;
    }
    context.sendJsonDownload(
      request,
      response,
      200,
      auditExport,
      allowedOrigins,
      `season-contribution-audit-${downloadFileNameToken(seasonExport.seasonId)}.json`,
    );
    return true;
  }

  if (method === "GET" && pathname.startsWith("/epoch/season/")) {
    const seasonId = finalPathSegment(pathname);
    const params = context.queryParams(request);
    const archive = runtime.epochSeasonArchive({
      seasonId,
      factionId: params.get("factionId") || undefined,
      agentId: params.get("agentId") || undefined,
      contributionLimit: params.get("contributionLimit") || undefined,
      contributionOffset: params.get("contributionOffset") || undefined,
    });
    if (!archive.season) {
      context.sendHtml(request, response, 404, "<!doctype html><title>Season not found</title><p>season_not_found</p>", allowedOrigins);
      return true;
    }
    context.sendHtml(request, response, 200, renderEpochSeasonPublicPageHtml(archive), allowedOrigins);
    return true;
  }

  if (method === "GET" && (pathname === "/epoch/audit" || pathname === "/epoch/audit/")) {
    const params = context.queryParams(request);
    context.sendHtml(request, response, 200, renderEpochAuditPublicPageHtml(runtime.epochAudit({
      agentId: params.get("agentId") || undefined,
      eventType: params.get("eventType") || undefined,
      aggregateId: params.get("aggregateId") || undefined,
      highImpactOnly: params.get("highImpactOnly") || (params.has("riskOnly") || params.has("aggregateId") ? undefined : "true"),
      riskOnly: params.get("riskOnly") || undefined,
      limit: params.get("limit") || undefined,
    })), allowedOrigins);
    return true;
  }

  if (method === "GET" && pathname.startsWith("/epoch/audit/")) {
    const eventId = finalPathSegment(pathname);
    const audit = runtime.epochAudit({ eventId, limit: 50 });
    if (!audit.selectedEvent) {
      context.sendHtml(request, response, 404, "<!doctype html><title>Audit event not found</title><p>epoch_audit_event_not_found</p>", allowedOrigins);
      return true;
    }
    context.sendHtml(request, response, 200, renderEpochAuditPublicPageHtml(audit), allowedOrigins);
    return true;
  }

  return false;
}
