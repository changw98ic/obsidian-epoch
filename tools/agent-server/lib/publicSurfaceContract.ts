import { createHash } from "node:crypto";

export const OBSIDIAN_EPOCH_PUBLIC_PAGE_MARKER_NAME = "obsidian-epoch-public-surface";

export const OBSIDIAN_EPOCH_PUBLIC_PAGES = {
  console: "/epoch/web-play",
  webPlay: "/epoch/web-play",
  install: "/epoch/install",
  world: "/epoch/world",
  explorer: "/epoch/explorer/{explorerId}",
  agent: "/epoch/agent/{agentId}",
  hosted: "/epoch/hosted/{sessionId}",
  region: "/epoch/region/{regionId}",
  directTrade: "/epoch/direct-trade/{tradeId}",
  partyRun: "/epoch/party-run/{partyRunId}",
  season: "/epoch/season/{seasonId}",
  npc: "/epoch/npc/{npcId}",
  archive: "/epoch/archive/{agentId}",
  auditIndex: "/epoch/audit",
  audit: "/epoch/audit/{eventId}",
  result: "/epoch/result/{pageId}",
} as const;

const PUBLIC_SURFACE_DESCRIPTOR = {
  schemaVersion: 1,
  canonicalPlayerContinuePath: OBSIDIAN_EPOCH_PUBLIC_PAGES.webPlay,
  canonicalWebPlayAssetBasePath: "/epoch/web-play/",
  legacyPlayerContinuePaths: ["/epoch/console"],
  publicPages: OBSIDIAN_EPOCH_PUBLIC_PAGES,
  successfulResult: {
    rewardAuthority: "server_settled_state_delta",
    forbiddenFailurePanel: "Phase 6 结果页校验未通过",
  },
} as const;

export const OBSIDIAN_EPOCH_PUBLIC_SURFACE_VERSION = `sha256:${createHash("sha256")
  .update(JSON.stringify(PUBLIC_SURFACE_DESCRIPTOR))
  .digest("hex")}` as const;

export const OBSIDIAN_EPOCH_PUBLIC_SURFACE = {
  ...PUBLIC_SURFACE_DESCRIPTOR,
  version: OBSIDIAN_EPOCH_PUBLIC_SURFACE_VERSION,
} as const;

export function obsidianEpochPublicSurface() {
  return {
    ...OBSIDIAN_EPOCH_PUBLIC_SURFACE,
    legacyPlayerContinuePaths: [...OBSIDIAN_EPOCH_PUBLIC_SURFACE.legacyPlayerContinuePaths],
    publicPages: { ...OBSIDIAN_EPOCH_PUBLIC_SURFACE.publicPages },
    successfulResult: { ...OBSIDIAN_EPOCH_PUBLIC_SURFACE.successfulResult },
  };
}

export function obsidianEpochPublicSurfaceMarkerHtml() {
  return `<meta name="${OBSIDIAN_EPOCH_PUBLIC_PAGE_MARKER_NAME}" content="${OBSIDIAN_EPOCH_PUBLIC_SURFACE_VERSION}">`;
}
