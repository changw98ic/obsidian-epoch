import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readEpochActivityAssetByFileName } from "../activityAssets.ts";
import { readEpochAmbienceSceneByFileName } from "../ambienceAssets.ts";
import { readEpochBossAssetByFileName } from "../bossAssets.ts";
import { readEpochCampaignKeyArtByFileName } from "../campaignAssets.ts";
import { readEpochEventStateByFileName } from "../eventStateAssets.ts";
import { readEpochFactionAssetByFileName, readEpochSeasonBannerAssetByFileName } from "../factionAssets.ts";
import { readEpochItemAssetByFileName } from "../itemAssets.ts";
import { readEpochLocationAssetByFileName } from "../locationAssets.ts";
import { readEpochNpcAssetByFileName } from "../npcAssets.ts";
import { readEpochPageSceneAssetByFileName } from "../pageSceneAssets.ts";
import { readEpochRelationshipAssetByFileName } from "../relationshipAssets.ts";
import { readEpochDowntimeAssetByFileName, readEpochResourceAssetByFileName } from "../resourceAssets.ts";
import { readEpochSceneVariantByFileName } from "../sceneVariantAssets.ts";
import { readEpochWorldSurfaceAssetByFileName } from "../worldSurfaceAssets.ts";
import { readEpochWorldSceneByFileName } from "../worldSceneAssets.ts";
import { type EpochHttpRouteContext, type SendBinary } from "./httpRouteTypes.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VAULT_ROOT = path.resolve(__dirname, "../../../..");
const EPOCH_CONSOLE_HTML_PATH = path.resolve(VAULT_ROOT, "00_总览/黑曜纪元3D世界地图.html");
const EPOCH_CONSOLE_ASSETS_DIR = path.resolve(VAULT_ROOT, "00_总览/assets");
const EPOCH_CONSOLE_ASSET_PREFIX = "/epoch/console/assets/";

type AssetRouteContext = EpochHttpRouteContext & {
  readonly consoleAssetBaseUrl?: string;
  readonly sendBinary: SendBinary;
};

type EpochAsset = {
  readonly content: Buffer;
  readonly asset: {
    readonly contentType: string;
  };
};

type EpochAssetRoute = {
  readonly prefix: string;
  readonly missingError: string;
  readonly readAsset: (fileName: string) => Promise<EpochAsset | null | undefined>;
};

const EPOCH_ASSET_ROUTES: readonly EpochAssetRoute[] = [
  { prefix: "/api/epoch/assets/boss/", missingError: "boss_asset_not_found", readAsset: readEpochBossAssetByFileName },
  { prefix: "/api/epoch/assets/location/", missingError: "location_asset_not_found", readAsset: readEpochLocationAssetByFileName },
  { prefix: "/api/epoch/assets/item/", missingError: "item_asset_not_found", readAsset: readEpochItemAssetByFileName },
  { prefix: "/api/epoch/assets/resource/", missingError: "resource_asset_not_found", readAsset: readEpochResourceAssetByFileName },
  { prefix: "/api/epoch/assets/downtime/", missingError: "downtime_asset_not_found", readAsset: readEpochDowntimeAssetByFileName },
  { prefix: "/api/epoch/assets/npc/", missingError: "npc_asset_not_found", readAsset: readEpochNpcAssetByFileName },
  { prefix: "/api/epoch/assets/activity/", missingError: "activity_asset_not_found", readAsset: readEpochActivityAssetByFileName },
  { prefix: "/api/epoch/assets/relationship/", missingError: "relationship_asset_not_found", readAsset: readEpochRelationshipAssetByFileName },
  { prefix: "/api/epoch/assets/surface/", missingError: "world_surface_asset_not_found", readAsset: readEpochWorldSurfaceAssetByFileName },
  { prefix: "/api/epoch/assets/page-scene/", missingError: "page_scene_asset_not_found", readAsset: readEpochPageSceneAssetByFileName },
  { prefix: "/api/epoch/assets/world-scene/", missingError: "world_scene_asset_not_found", readAsset: readEpochWorldSceneByFileName },
  { prefix: "/api/epoch/assets/scene-variant/", missingError: "scene_variant_asset_not_found", readAsset: readEpochSceneVariantByFileName },
  { prefix: "/api/epoch/assets/campaign/", missingError: "campaign_asset_not_found", readAsset: readEpochCampaignKeyArtByFileName },
  { prefix: "/api/epoch/assets/ambience/", missingError: "ambience_asset_not_found", readAsset: readEpochAmbienceSceneByFileName },
  { prefix: "/api/epoch/assets/event-state/", missingError: "event_state_asset_not_found", readAsset: readEpochEventStateByFileName },
  { prefix: "/api/epoch/assets/faction/", missingError: "faction_asset_not_found", readAsset: readEpochFactionAssetByFileName },
  { prefix: "/api/epoch/assets/season/", missingError: "season_asset_not_found", readAsset: readEpochSeasonBannerAssetByFileName },
];

function consoleAssetContentType(filePath: string) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".png") return "image/png";
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".webp") return "image/webp";
  if (extension === ".gif") return "image/gif";
  if (extension === ".svg") return "image/svg+xml";
  if (extension === ".css") return "text/css; charset=utf-8";
  if (extension === ".js") return "text/javascript; charset=utf-8";
  return "application/octet-stream";
}

function consoleHtmlWithBase(html: string) {
  if (html.includes("<base href=\"/epoch/console/\">")) return html;
  return html.replace("<head>", "<head>\n    <base href=\"/epoch/console/\">");
}

function normalizedConsoleAssetBaseUrl(baseUrl: string | undefined) {
  return baseUrl?.trim().replace(/\/+$/, "");
}

function rewriteConsoleMediaAssetUrls(html: string, consoleAssetBaseUrl: string | undefined) {
  const assetBaseUrl = normalizedConsoleAssetBaseUrl(consoleAssetBaseUrl);
  if (!assetBaseUrl) return html;
  return html.replace(/(?<![A-Za-z][A-Za-z0-9+.-]*:\/\/)(?:\.\/)?assets\/media\//g, `${assetBaseUrl}/`);
}

async function readEpochConsoleHtml(consoleAssetBaseUrl?: string) {
  return rewriteConsoleMediaAssetUrls(
    consoleHtmlWithBase(await fs.readFile(EPOCH_CONSOLE_HTML_PATH, "utf8")),
    consoleAssetBaseUrl,
  );
}

async function readEpochConsoleAsset(pathname: string) {
  const relativePath = decodeURIComponent(pathname.slice(EPOCH_CONSOLE_ASSET_PREFIX.length));
  if (!relativePath || relativePath.includes("\0")) return null;
  const assetPath = path.resolve(EPOCH_CONSOLE_ASSETS_DIR, relativePath);
  const relativeToAssets = path.relative(EPOCH_CONSOLE_ASSETS_DIR, assetPath);
  if (relativeToAssets.startsWith("..") || path.isAbsolute(relativeToAssets)) return null;
  const stat = await fs.stat(assetPath).catch(() => null);
  if (!stat?.isFile()) return null;
  return {
    contentType: consoleAssetContentType(assetPath),
    body: await fs.readFile(assetPath),
  };
}

function finalPathSegment(pathname: string) {
  return decodeURIComponent(pathname.split("/").pop() || "");
}

async function sendEpochAssetRoute(context: AssetRouteContext, assetRoute: EpochAssetRoute) {
  const { allowedOrigins, pathname, request, response } = context;
  const fileName = finalPathSegment(pathname);

  try {
    const asset = await assetRoute.readAsset(fileName);
    if (!asset) {
      context.sendJson(request, response, 404, { error: assetRoute.missingError }, allowedOrigins);
      return true;
    }
    context.sendBinary(request, response, 200, asset.content, allowedOrigins, {
      "content-type": asset.asset.contentType,
      "cache-control": "public, max-age=3600",
    });
    return true;
  } catch {
    context.sendJson(request, response, 404, { error: assetRoute.missingError }, allowedOrigins);
    return true;
  }
}

export async function handleEpochAssetRoutes(context: AssetRouteContext): Promise<boolean> {
  const { allowedOrigins, method, pathname, request, response } = context;

  if (method === "GET" && (
    pathname === "/epoch/console"
    || pathname === "/epoch/console/"
    || pathname === "/epoch/web-play"
    || pathname === "/epoch/web-play/"
  )) {
    context.sendHtml(request, response, 200, await readEpochConsoleHtml(context.consoleAssetBaseUrl), allowedOrigins);
    return true;
  }

  if (method === "GET" && pathname.startsWith(EPOCH_CONSOLE_ASSET_PREFIX)) {
    const asset = await readEpochConsoleAsset(pathname);
    if (!asset) {
      context.sendJson(request, response, 404, { error: "console_asset_not_found" }, allowedOrigins);
      return true;
    }
    context.sendBinary(request, response, 200, asset.body, allowedOrigins, {
      "content-type": asset.contentType,
      "cache-control": "public, max-age=3600",
    });
    return true;
  }

  if (method !== "GET") return false;

  const assetRoute = EPOCH_ASSET_ROUTES.find((route) => pathname.startsWith(route.prefix));
  if (assetRoute) return sendEpochAssetRoute(context, assetRoute);

  return false;
}
