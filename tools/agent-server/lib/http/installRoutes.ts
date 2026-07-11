import { createHash } from "node:crypto";
import {
  epochActivityAssetManifestEntries,
} from "../activityAssets.ts";
import { epochAmbienceSceneManifestEntries } from "../ambienceAssets.ts";
import { epochBossAssetManifestEntries } from "../bossAssets.ts";
import { epochCampaignKeyArtManifestEntries } from "../campaignAssets.ts";
import { epochEventStateManifestEntries } from "../eventStateAssets.ts";
import {
  epochFactionAssetManifestEntries,
  epochSeasonBannerAssetManifestEntries,
} from "../factionAssets.ts";
import { resolveEpochFrontstageStatus } from "../frontstageStatus.ts";
import { epochHostConfigFiles, epochHostConfigManifestEntries, epochHostInstallEntries } from "../hostInstall.ts";
import { epochItemAssetManifestEntries } from "../itemAssets.ts";
import { epochLocationAssetManifestEntries } from "../locationAssets.ts";
import { AGENT_WORLD_TOOLS, MCP_PROTOCOL_VERSION } from "../mcpTools.ts";
import { epochNpcAssetManifestEntries } from "../npcAssets.ts";
import {
  OBSIDIAN_EPOCH_PACKAGE_FILE,
  OBSIDIAN_EPOCH_PACKAGE_INTEGRITY_FILE,
  OBSIDIAN_EPOCH_PACKAGE_SIGNATURE_ALGORITHM,
  createObsidianEpochPackageArchive,
  obsidianEpochPackageArchiveCacheKey,
  obsidianEpochInstallSurface,
  obsidianEpochPackageSigningKeySource,
  obsidianEpochPackageSigningTrust,
  obsidianEpochReleaseKeyId,
  obsidianEpochReleasePublicKey,
} from "../packageArchive.ts";
import { epochPageSceneAssetManifestEntries } from "../pageSceneAssets.ts";
import { renderEpochInstallPublicPageHtml } from "../publicWorldPageHtml.ts";
import { epochRelationshipAssetManifestEntries } from "../relationshipAssets.ts";
import {
  epochDowntimeAssetManifestEntries,
  epochResourceAssetManifestEntries,
} from "../resourceAssets.ts";
import { epochSceneVariantManifestEntries } from "../sceneVariantAssets.ts";
import { epochWorldSceneManifestEntries } from "../worldSceneAssets.ts";
import { epochWorldSurfaceAssetManifestEntries } from "../worldSurfaceAssets.ts";
import { type EpochHttpRouteContext, type SendBinary } from "./httpRouteTypes.ts";

const OBSIDIAN_EPOCH_INSTALL_NAME = "obsidian-epoch-agent-world";
const OBSIDIAN_EPOCH_INSTALL_VERSION = "0.1.0-alpha";

type InstallRouteContext = EpochHttpRouteContext & {
  readonly publicServerBase: string;
  readonly sendBinary: SendBinary;
};

type Runtime = EpochHttpRouteContext["runtime"];
type JsonRecord = Record<string, unknown>;

export interface EpochInstallPackageInfo {
  readonly fileName: string;
  readonly contentType: "application/gzip";
  readonly bytes: number;
  readonly sha256: string;
}

export interface EpochInstallPackageArtifact {
  readonly archive: Buffer;
  readonly packageInfo: EpochInstallPackageInfo;
}

interface EpochInstallPackageArchiveCacheOptions {
  readonly build?: (serverBase?: string) => Promise<EpochInstallPackageArtifact>;
  readonly maxEntries?: number;
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function recordValue(value: unknown): JsonRecord {
  return isRecord(value) ? value : {};
}

function optionalString(value: unknown) {
  return typeof value === "string" && value ? value : undefined;
}

function optionalNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function finalPathSegment(pathname: string) {
  return decodeURIComponent(pathname.split("/").pop() || "");
}

function streamableMcpEndpoint(serverBase: string) {
  return `${serverBase}/mcp`;
}

function epochInstallPackageInfo(archive: Buffer): EpochInstallPackageInfo {
  return {
    fileName: OBSIDIAN_EPOCH_PACKAGE_FILE,
    contentType: "application/gzip",
    bytes: archive.byteLength,
    sha256: createHash("sha256").update(archive).digest("hex"),
  };
}

async function buildEpochInstallPackageArchive(serverBase?: string): Promise<EpochInstallPackageArtifact> {
  const archive = serverBase
    ? await createObsidianEpochPackageArchive({ serverBase })
    : await createObsidianEpochPackageArchive();
  return {
    archive,
    packageInfo: epochInstallPackageInfo(archive),
  };
}

export function createEpochInstallPackageArchiveCache({
  build = buildEpochInstallPackageArchive,
  maxEntries = 2,
}: EpochInstallPackageArchiveCacheOptions = {}) {
  if (!Number.isSafeInteger(maxEntries) || maxEntries < 1) {
    throw new Error("package_archive_cache_max_entries_invalid");
  }
  const completed = new Map<string, EpochInstallPackageArtifact>();
  const inFlight = new Map<string, Promise<EpochInstallPackageArtifact>>();

  function keyFor(serverBase?: string) {
    return obsidianEpochPackageArchiveCacheKey(serverBase ? { serverBase } : undefined);
  }

  function remember(key: string, artifact: EpochInstallPackageArtifact) {
    completed.delete(key);
    completed.set(key, artifact);
    while (completed.size > maxEntries) {
      const oldestKey = completed.keys().next().value;
      if (typeof oldestKey !== "string") break;
      completed.delete(oldestKey);
    }
  }

  return {
    get(serverBase?: string): Promise<EpochInstallPackageArtifact> {
      const key = keyFor(serverBase);
      const cached = completed.get(key);
      if (cached) {
        remember(key, cached);
        return Promise.resolve(cached);
      }
      const active = inFlight.get(key);
      if (active) return active;

      let pending: Promise<EpochInstallPackageArtifact>;
      pending = build(serverBase)
        .then((artifact) => {
          remember(key, artifact);
          return artifact;
        })
        .finally(() => {
          if (inFlight.get(key) === pending) inFlight.delete(key);
        });
      inFlight.set(key, pending);
      return pending;
    },
  };
}

const epochInstallPackageArchiveCache = createEpochInstallPackageArchiveCache();

function epochInstallPackageArchive(serverBase?: string) {
  return epochInstallPackageArchiveCache.get(serverBase);
}

function epochInstallToolNames() {
  return AGENT_WORLD_TOOLS
    .map((tool) => tool.name)
    .filter((name) => name.startsWith("obsidian_epoch."));
}

function epochInstallVerification() {
  return {
    installSmokeCommand: "npm run agent:install-smoke -- --json",
    remoteInstallSmokeCommand: "npm run agent:install-smoke -- --server <serverBase> --json",
    releaseRehearsalCommand: "npm run agent:release-rehearsal -- --server <serverBase> --operator-key <operatorKey> --json",
    productionReleaseRehearsalCommand: "npm run agent:release-rehearsal -- --server <publicHttpsOrigin> --operator-key <operatorKey> --expected-release-key-id <releaseKeyId> --production --json",
    recoveryDrillCommand: "npm run agent:recovery-drill -- --json",
    backupCommand: "npm run agent:backup -- --json",
    restoreBackupCommand: "npm run agent:restore-backup -- --json",
    packageIntegrityManifest: OBSIDIAN_EPOCH_PACKAGE_INTEGRITY_FILE,
    packageSignatureAlgorithm: OBSIDIAN_EPOCH_PACKAGE_SIGNATURE_ALGORITHM,
    packageReleasePublicKey: obsidianEpochReleasePublicKey(),
    packageReleaseKeyId: obsidianEpochReleaseKeyId(),
    packageSigningTrust: obsidianEpochPackageSigningTrust(),
    packageSigningKeySource: obsidianEpochPackageSigningKeySource(),
  };
}

function epochInstallStatus(packageInfo: EpochInstallPackageInfo, serverBase = "http://127.0.0.1:8787") {
  const verification = epochInstallVerification();
  const packageUrl = `${serverBase}/api/epoch/package/${OBSIDIAN_EPOCH_PACKAGE_FILE}`;
  const hostInstall = epochHostInstallEntries(serverBase);
  const hostConfigFiles = epochHostConfigManifestEntries(serverBase);
  const mcpHosts = hostInstall.filter((entry) => entry.mcp).map((entry) => entry.host);
  const bridgeHosts = hostInstall.filter((entry) => entry.bridge).map((entry) => entry.host);
  return {
    ok: packageInfo.bytes > 0 && hostConfigFiles.length > 0 && Boolean(verification.packageReleaseKeyId),
    generatedAt: new Date().toISOString(),
    serverBase,
    truthLevel: "live_lightweight",
    frontstageStatus: resolveEpochFrontstageStatus(),
    manifest: {
      endpoint: "/api/epoch/install-manifest",
      name: OBSIDIAN_EPOCH_INSTALL_NAME,
      version: OBSIDIAN_EPOCH_INSTALL_VERSION,
      packageUrl,
    },
    package: {
      ...packageInfo,
      url: packageUrl,
      signatureAlgorithm: verification.packageSignatureAlgorithm,
      integrityManifest: verification.packageIntegrityManifest,
      releasePublicKey: verification.packageReleasePublicKey,
      releaseKeyId: verification.packageReleaseKeyId,
      signingTrust: verification.packageSigningTrust,
      signingKeySource: verification.packageSigningKeySource,
    },
    hostInstall: {
      status: "generated",
      hosts: hostInstall.map((entry) => entry.host),
      hostCount: hostInstall.length,
      mcpHosts,
      mcpHostCount: mcpHosts.length,
      bridgeHosts,
      hostConfigFiles,
    },
    smoke: {
      status: "not_run",
      lightweightOnly: true,
      installSmokeCommand: verification.installSmokeCommand,
      remoteInstallSmokeCommand: verification.remoteInstallSmokeCommand,
      proofRequired: "This endpoint does not run MCP/Skill smoke; run install-smoke to prove MCP, Skill, and one-turn flow.",
    },
    release: {
      status: "commands_available",
      rehearsalCommand: verification.releaseRehearsalCommand,
      productionRehearsalCommand: verification.productionReleaseRehearsalCommand,
      recoveryDrillCommand: verification.recoveryDrillCommand,
      backupCommand: verification.backupCommand,
      restoreBackupCommand: verification.restoreBackupCommand,
      signatureAlgorithm: verification.packageSignatureAlgorithm,
      releaseKeyId: verification.packageReleaseKeyId,
      signingTrust: verification.packageSigningTrust,
    },
  };
}

async function epochInstallManifest(packageInfo: EpochInstallPackageInfo, serverBase = "http://127.0.0.1:8787") {
  const bossAssets = await epochBossAssetManifestEntries();
  const itemAssets = await epochItemAssetManifestEntries();
  const locationAssets = await epochLocationAssetManifestEntries();
  const npcAssets = await epochNpcAssetManifestEntries();
  const resourceAssets = await epochResourceAssetManifestEntries();
  const downtimeAssets = await epochDowntimeAssetManifestEntries();
  const activityAssets = await epochActivityAssetManifestEntries();
  const relationshipAssets = await epochRelationshipAssetManifestEntries();
  const worldSurfaceAssets = await epochWorldSurfaceAssetManifestEntries();
  const worldSceneAssets = await epochWorldSceneManifestEntries();
  const sceneVariantAssets = await epochSceneVariantManifestEntries();
  const pageSceneAssets = await epochPageSceneAssetManifestEntries();
  const campaignKeyArtAssets = await epochCampaignKeyArtManifestEntries();
  const ambienceSceneAssets = await epochAmbienceSceneManifestEntries();
  const eventStateAssets = await epochEventStateManifestEntries();
  const factionAssets = await epochFactionAssetManifestEntries();
  const seasonBannerAssets = await epochSeasonBannerAssetManifestEntries();
  const installSurface = obsidianEpochInstallSurface(serverBase);
  return {
    name: OBSIDIAN_EPOCH_INSTALL_NAME,
    version: OBSIDIAN_EPOCH_INSTALL_VERSION,
    serverBase,
    mcpCommand: "node obsidian-epoch/bin/mcp-proxy.ts",
    transport: {
      streamableHttp: {
        endpoint: streamableMcpEndpoint(serverBase),
        protocolVersion: MCP_PROTOCOL_VERSION,
        sse: false,
      },
      stdio: {
        command: "node obsidian-epoch/bin/mcp-proxy.ts",
        env: {
          AGENT_WORLD_SERVER: serverBase,
        },
      },
    },
    packageUrl: `${serverBase}/api/epoch/package/${OBSIDIAN_EPOCH_PACKAGE_FILE}`,
    package: packageInfo,
    ...installSurface,
    verification: epochInstallVerification(),
    assets: {
      bosses: bossAssets,
      items: itemAssets,
      resources: resourceAssets,
      downtimeModes: downtimeAssets,
      activities: activityAssets,
      relationships: relationshipAssets,
      worldSurfaces: worldSurfaceAssets,
      worldScenes: worldSceneAssets,
      sceneVariants: sceneVariantAssets,
      pageScenes: pageSceneAssets,
      campaignKeyArt: campaignKeyArtAssets,
      ambienceScenes: ambienceSceneAssets,
      eventStates: eventStateAssets,
      locations: locationAssets,
      npcs: npcAssets,
      factions: factionAssets,
      seasonBanners: seasonBannerAssets,
    },
    hosts: ["Claude Code", "Codex", "Cursor", "Hermes", "OpenClaw", "Web LLM bridge"],
    hostInstall: epochHostInstallEntries(serverBase),
    hostConfigFiles: epochHostConfigManifestEntries(serverBase),
    tools: epochInstallToolNames(),
    skill: {
      name: "obsidian-epoch",
      recommendedPath: "$CODEX_HOME/skills/obsidian-epoch/SKILL.md",
    },
  };
}

function epochInstallFeed(runtime: Runtime) {
  const recentWorldNews = runtime.epochEvents({ eventType: "region_news_generated", limit: 6 }).events
    .filter((event) => {
      const payload = recordValue(recordValue(event).payload);
      return !payload.moderationStatus || payload.moderationStatus === "visible";
    })
    .map((event) => {
      const eventRecord = recordValue(event);
      const payload = recordValue(eventRecord.payload);
      const eventId = optionalString(eventRecord.eventId);
      const regionId = optionalString(payload.regionId);
      return {
        eventId,
        newsId: optionalString(payload.newsId),
        regionId,
        headline: optionalString(payload.headline),
        body: optionalString(payload.body),
        legendDelta: optionalNumber(payload.legendDelta),
        createdAt: optionalString(eventRecord.createdAt),
        publicPages: {
          region: regionId ? `/epoch/region/${encodeURIComponent(regionId)}` : undefined,
          audit: eventId ? `/epoch/audit/${encodeURIComponent(eventId)}` : undefined,
        },
      };
    })
    .filter((item) => item.headline);
  const legendaryDeaths = runtime.epochEvents({ eventType: "identity_archived", limit: 6 }).events
    .map((event) => {
      const eventRecord = recordValue(event);
      const payload = recordValue(eventRecord.payload);
      const eventId = optionalString(eventRecord.eventId);
      const aggregateId = optionalString(eventRecord.aggregateId);
      return {
        eventId,
        agentId: optionalString(eventRecord.agentId) || aggregateId,
        finalTitle: optionalString(payload.finalTitle),
        archiveReason: optionalString(payload.archiveReason),
        archivedAt: optionalString(payload.archivedAt) || optionalString(eventRecord.createdAt),
        publicPages: {
          archive: aggregateId ? `/epoch/archive/${encodeURIComponent(aggregateId)}` : undefined,
          audit: eventId ? `/epoch/audit/${encodeURIComponent(eventId)}` : undefined,
        },
      };
    })
    .filter((item) => item.agentId && item.finalTitle);
  return { recentWorldNews, legendaryDeaths };
}

export async function handleEpochInstallRoutes(context: InstallRouteContext): Promise<boolean> {
  const { allowedOrigins, method, pathname, publicServerBase, request, response, runtime } = context;

  if (method === "GET" && pathname === "/epoch/install") {
    const { packageInfo } = await epochInstallPackageArchive(publicServerBase);
    context.sendHtml(request, response, 200, renderEpochInstallPublicPageHtml({
      ...(await epochInstallManifest(packageInfo, publicServerBase)),
      ...epochInstallFeed(runtime),
    }), allowedOrigins);
    return true;
  }

  if (method === "GET" && pathname === "/api/epoch/install-manifest") {
    const { packageInfo } = await epochInstallPackageArchive(publicServerBase);
    context.sendJson(request, response, 200, await epochInstallManifest(packageInfo, publicServerBase), allowedOrigins);
    return true;
  }

  if (method === "GET" && pathname === "/api/epoch/install-status") {
    const { packageInfo } = await epochInstallPackageArchive(publicServerBase);
    context.sendJson(request, response, 200, epochInstallStatus(packageInfo, publicServerBase), allowedOrigins);
    return true;
  }

  if (method === "GET" && pathname.startsWith("/api/epoch/host-config/")) {
    const fileName = finalPathSegment(pathname);
    const file = epochHostConfigFiles(publicServerBase)
      .find((entry) => entry.path.split("/").pop() === fileName);
    if (!file) {
      context.sendJson(request, response, 404, { error: "host_config_not_found" }, allowedOrigins);
      return true;
    }
    context.sendBinary(request, response, 200, Buffer.from(file.content, "utf8"), allowedOrigins, {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=300",
    });
    return true;
  }

  if (method === "GET" && pathname === `/api/epoch/package/${OBSIDIAN_EPOCH_PACKAGE_FILE}`) {
    const { archive, packageInfo } = await epochInstallPackageArchive(publicServerBase);
    const entityTag = `"${packageInfo.sha256}"`;
    const headers = {
      "content-type": "application/gzip",
      "content-disposition": `attachment; filename="${OBSIDIAN_EPOCH_PACKAGE_FILE}"`,
      "x-obsidian-epoch-package-sha256": packageInfo.sha256,
      "cache-control": "public, max-age=300, must-revalidate",
      etag: entityTag,
    };
    const ifNoneMatch = request.headers["if-none-match"];
    if (typeof ifNoneMatch === "string" && ifNoneMatch.split(",").map((value) => value.trim()).includes(entityTag)) {
      context.sendBinary(request, response, 304, Buffer.alloc(0), allowedOrigins, headers);
      return true;
    }
    context.sendBinary(request, response, 200, archive, allowedOrigins, {
      ...headers,
    });
    return true;
  }

  return false;
}
