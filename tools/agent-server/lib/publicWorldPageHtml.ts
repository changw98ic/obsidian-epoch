import {
  type EpochAuditInfo,
  type EpochAgentBriefingView,
  type EpochAgentPublicRegionalContextView,
  type EpochDirectTradeView,
  type EpochExplorerProfileInfo,
  type EpochHostedSessionWatchInfo,
  type EpochIdentityArchiveInfo,
  type EpochNpcInfo,
  type EpochPartyRunView,
  type EpochProgressView,
  type EpochRegionInfo,
  type EpochSeasonArchiveInfo,
  type EpochWorldOverviewInfo,
} from "./epoch/runtime.ts";
import {
  publicActionLabel,
  publicCommissionSecretRevealLabel,
  publicDowntimeModeLabel,
  publicEventTypeLabel,
  publicFactionLabel,
  publicKindLabel,
  publicMcpToolName,
  publicRarityLabel,
  publicRegionLabel,
  publicResourceLabel,
  publicResourceLabels,
  publicSecretTierLabel,
  publicSourceTypeLabel,
  publicStatusLabel,
  publicText,
  publicTrustClassLabel,
} from "./epoch/publicVocabulary.ts";
import { epochPageSceneMediaForKey, type EpochPageSceneAssetKey, type EpochPageSceneMedia } from "./pageSceneAssets.ts";
import { type PublicReleaseReadiness } from "./publicReleaseReadiness.ts";
import { obsidianEpochPublicSurfaceMarkerHtml } from "./publicSurfaceContract.ts";

interface EpochInstallManifestInfo {
  readonly name: string;
  readonly version: string;
  readonly serverBase: string;
  readonly mcpCommand: string;
  readonly packageUrl: string;
  readonly package: {
    readonly fileName: string;
    readonly contentType: string;
    readonly bytes: number;
    readonly sha256: string;
  };
  readonly publicPages: Readonly<Record<string, string>>;
  readonly publicSurface?: {
    readonly version: string;
  };
  readonly publicRelease?: PublicReleaseReadiness;
  readonly playbooks?: Readonly<Record<string, string>>;
  readonly verification?: {
    readonly installSmokeCommand?: string;
    readonly remoteInstallSmokeCommand?: string;
    readonly releaseRehearsalCommand?: string;
    readonly productionReleaseRehearsalCommand?: string;
    readonly recoveryDrillCommand?: string;
    readonly backupCommand?: string;
    readonly restoreBackupCommand?: string;
    readonly packageIntegrityManifest?: string;
    readonly packageSignatureAlgorithm?: string;
    readonly packageReleasePublicKey?: string;
    readonly packageReleaseKeyId?: string;
    readonly packageSigningTrust?: string;
    readonly packageSigningKeySource?: string;
  };
  readonly assets?: {
    readonly bosses?: readonly {
      readonly templateKey: string;
      readonly title: string;
      readonly path: string;
      readonly url: string;
      readonly contentType: string;
      readonly width: number;
      readonly height: number;
      readonly sha256: string;
    }[];
    readonly locations?: readonly {
      readonly regionId: string;
      readonly title: string;
      readonly subtitle: string;
      readonly path: string;
      readonly url: string;
      readonly contentType: string;
      readonly width: number;
      readonly height: number;
      readonly sha256: string;
    }[];
    readonly items?: readonly {
      readonly itemKey: string;
      readonly title: string;
      readonly subtitle: string;
      readonly path: string;
      readonly url: string;
      readonly contentType: string;
      readonly width: number;
      readonly height: number;
      readonly sha256: string;
    }[];
    readonly resources?: readonly {
      readonly resourceId: string;
      readonly title: string;
      readonly subtitle: string;
      readonly path: string;
      readonly url: string;
      readonly contentType: string;
      readonly width: number;
      readonly height: number;
      readonly sha256: string;
    }[];
    readonly downtimeModes?: readonly {
      readonly mode: string;
      readonly title: string;
      readonly subtitle: string;
      readonly path: string;
      readonly url: string;
      readonly contentType: string;
      readonly width: number;
      readonly height: number;
      readonly sha256: string;
    }[];
    readonly activities?: readonly {
      readonly activityKey: string;
      readonly title: string;
      readonly subtitle: string;
      readonly path: string;
      readonly url: string;
      readonly contentType: string;
      readonly width: number;
      readonly height: number;
      readonly sha256: string;
    }[];
    readonly relationships?: readonly {
      readonly relationshipKey: string;
      readonly title: string;
      readonly subtitle: string;
      readonly path: string;
      readonly url: string;
      readonly contentType: string;
      readonly width: number;
      readonly height: number;
      readonly sha256: string;
    }[];
    readonly worldSurfaces?: readonly {
      readonly surfaceKey: string;
      readonly title: string;
      readonly subtitle: string;
      readonly path: string;
      readonly url: string;
      readonly contentType: string;
      readonly width: number;
      readonly height: number;
      readonly sha256: string;
    }[];
    readonly worldScenes?: readonly {
      readonly sceneKey: string;
      readonly regionId: string;
      readonly title: string;
      readonly subtitle: string;
      readonly path: string;
      readonly url: string;
      readonly contentType: string;
      readonly width: number;
      readonly height: number;
      readonly sha256: string;
    }[];
    readonly sceneVariants?: readonly {
      readonly variantKey: string;
      readonly regionId: string;
      readonly title: string;
      readonly subtitle: string;
      readonly path: string;
      readonly url: string;
      readonly contentType: string;
      readonly width: number;
      readonly height: number;
      readonly timeOfDay: string;
      readonly weather: string;
      readonly sha256: string;
    }[];
    readonly pageScenes?: readonly {
      readonly sceneKey: string;
      readonly title: string;
      readonly subtitle: string;
      readonly path: string;
      readonly url: string;
      readonly contentType: string;
      readonly width: number;
      readonly height: number;
      readonly sha256: string;
    }[];
    readonly campaignKeyArt?: readonly {
      readonly campaignKey: string;
      readonly title: string;
      readonly subtitle: string;
      readonly path: string;
      readonly url: string;
      readonly contentType: string;
      readonly width: number;
      readonly height: number;
      readonly sha256: string;
    }[];
    readonly ambienceScenes?: readonly {
      readonly sceneKey: string;
      readonly title: string;
      readonly subtitle: string;
      readonly path: string;
      readonly url: string;
      readonly contentType: string;
      readonly width: number;
      readonly height: number;
      readonly sha256: string;
    }[];
    readonly eventStates?: readonly {
      readonly stateKey: string;
      readonly title: string;
      readonly subtitle: string;
      readonly path: string;
      readonly url: string;
      readonly contentType: string;
      readonly width: number;
      readonly height: number;
      readonly sha256: string;
    }[];
    readonly npcs?: readonly {
      readonly archetypeKey: string;
      readonly title: string;
      readonly subtitle: string;
      readonly path: string;
      readonly url: string;
      readonly contentType: string;
      readonly width: number;
      readonly height: number;
      readonly sha256: string;
    }[];
    readonly factions?: readonly {
      readonly factionId: string;
      readonly title: string;
      readonly subtitle: string;
      readonly path: string;
      readonly url: string;
      readonly contentType: string;
      readonly width: number;
      readonly height: number;
      readonly sha256: string;
    }[];
    readonly seasonBanners?: readonly {
      readonly seasonKey: string;
      readonly title: string;
      readonly subtitle: string;
      readonly path: string;
      readonly url: string;
      readonly contentType: string;
      readonly width: number;
      readonly height: number;
      readonly sha256: string;
    }[];
  };
  readonly hosts: readonly string[];
  readonly hostConfigFiles?: readonly {
    readonly path: string;
    readonly url: string;
    readonly contentType: string;
    readonly bytes: number;
    readonly sha256: string;
  }[];
  readonly hostInstall: readonly {
    readonly host: string;
    readonly type: string;
    readonly mcp?: {
      readonly serverName: string;
      readonly transport: "streamable-http";
      readonly url: string;
      readonly protocolVersion: string;
    };
    readonly bridge?: {
      readonly entryTool: string;
      readonly submitTool: string;
      readonly resultTool?: string;
      readonly playbook: string;
      readonly publicPages?: Readonly<Record<string, string>>;
    };
    readonly skill?: {
      readonly name: string;
      readonly path: string;
      readonly invoke: string;
    };
    readonly notes?: readonly string[];
    readonly configSnippets?: readonly {
      readonly label: string;
      readonly format: string;
      readonly pathHint: string;
      readonly body: unknown;
    }[];
  }[];
  readonly tools: readonly string[];
  readonly recentWorldNews?: readonly {
    readonly eventId?: string;
    readonly newsId?: string;
    readonly regionId?: string;
    readonly headline?: string;
    readonly body?: string;
    readonly legendDelta?: number;
    readonly createdAt?: string;
    readonly publicPages?: {
      readonly region?: string;
      readonly audit?: string;
    };
  }[];
  readonly legendaryDeaths?: readonly {
    readonly eventId?: string;
    readonly agentId?: string;
    readonly finalTitle?: string;
    readonly archiveReason?: string;
    readonly archivedAt?: string;
    readonly publicPages?: {
      readonly archive?: string;
      readonly audit?: string;
    };
  }[];
}

const resourceLabels = publicResourceLabels;

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function dateLabel(value?: string) {
  if (!value) return "未记录";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return escapeHtml(value);
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Shanghai",
  }).format(date);
}

function shortHash(value?: string) {
  if (!value) return "未记录";
  const [prefix, digest] = value.split(":");
  if (!digest) return value.length > 18 ? `${value.slice(0, 18)}...` : value;
  return `${prefix}:${digest.slice(0, 12)}`;
}

function regionLabel(value: string | undefined) {
  return publicRegionLabel(value);
}

function eventTypeLabel(value: string | undefined) {
  return publicEventTypeLabel(value);
}

function sourceTypeLabel(value: string | undefined) {
  return publicSourceTypeLabel(value);
}

function secretTierLabel(value: string | undefined) {
  return publicSecretTierLabel(value);
}

function statusLabel(value: string | undefined) {
  return publicStatusLabel(value);
}

function trustClassLabel(value: string | undefined) {
  return publicTrustClassLabel(value);
}

function factionLabel(value: string | undefined) {
  return publicFactionLabel(value);
}

function kindLabel(value: string | undefined) {
  return publicKindLabel(value);
}

function downtimeModeLabel(value: string | undefined) {
  return publicDowntimeModeLabel(value);
}

function rarityLabel(value: string | undefined) {
  return publicRarityLabel(value);
}

function identityLabel(identityName: string | undefined) {
  if (identityName && identityName.trim()) return publicText(identityName);
  return "行动身份";
}

function resourceMapLabel(resources: Readonly<Record<string, number | undefined>>) {
  const items = Object.entries(resources)
    .filter(([, amount]) => typeof amount === "number")
    .map(([resourceId, amount]) => `${publicResourceLabel(resourceId)} ${amount}`);
  return items.length ? items.join(" / ") : "暂无";
}

function marketOrderAssetLabel(order: EpochRegionInfo["marketOrders"][number]) {
  if (order.sellKind === "item") {
    return publicText(order.sellItemDisplayName || order.sellItemKey || order.sellItemId || "未命名物品");
  }
  return `${publicResourceLabel(order.sellResourceId)} ${order.sellAmount}`;
}

function marketOrderPriceLabel(order: EpochRegionInfo["marketOrders"][number]) {
  const unitPrice = order.sellAmount > 0 ? ` · 单价 ${(order.priceAmount / order.sellAmount).toFixed(2)}` : "";
  return `${publicResourceLabel(order.priceResourceId)} ${order.priceAmount}${unitPrice}`;
}

function marketOrderFeeLabel(order: EpochRegionInfo["marketOrders"][number]) {
  if (!order.marketFeeAmount) return "税费 0";
  return `税费 ${publicResourceLabel(order.marketFeeResourceId || order.priceResourceId)} ${order.marketFeeAmount}`;
}

function directTradeAssetLabel(asset: EpochDirectTradeView["offeredAsset"]) {
  if (asset.kind === "item") {
    const rarity = asset.itemRarity ? ` · ${rarityLabel(asset.itemRarity)}` : "";
    return `${publicText(asset.itemDisplayName || asset.itemKey || asset.itemId || "未命名物品")}${rarity}`;
  }
  return `${publicResourceLabel(asset.resourceId)} ${asset.amount || 0}`;
}

function directTradeActivityAt(trade: EpochDirectTradeView) {
  return trade.acceptedAt || trade.cancelledAt || trade.expiredAt || trade.createdAt;
}

function partyRunActivityAt(partyRun: EpochPartyRunView) {
  return partyRun.settledAt || partyRun.updatedAt || partyRun.createdAt;
}

function pageSceneMedia(sceneKey: EpochPageSceneAssetKey): EpochPageSceneMedia {
  const media = epochPageSceneMediaForKey(sceneKey);
  if (!media) throw new Error(`epoch_page_scene_media_missing:${sceneKey}`);
  return media;
}

function pageShell(title: string, eyebrow: string, summary: string, body: string, heroMedia?: EpochPageSceneMedia) {
  const heroImage = heroMedia
    ? `<img class="page-scene-hero-image" src="${escapeHtml(heroMedia.imageUrl)}" alt="${escapeHtml(heroMedia.publicAlt)}" loading="eager">`
    : "";
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  ${obsidianEpochPublicSurfaceMarkerHtml()}
  <title>${escapeHtml(title)} - 黑曜纪元</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #070807;
      --panel: rgba(17, 22, 20, .88);
      --line: rgba(151, 174, 163, .22);
      --text: #f2f5ef;
      --soft: #b8c5bd;
      --muted: #87948d;
      --accent: #82d3c8;
      --gold: #d7aa62;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      color: var(--text);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background:
        linear-gradient(135deg, rgba(7, 8, 7, .95), rgba(18, 20, 16, .96)),
        repeating-linear-gradient(90deg, rgba(255,255,255,.035) 0 1px, transparent 1px 120px);
    }
    main {
      width: min(1120px, calc(100vw - 28px));
      margin: 0 auto;
      padding: 28px 0 40px;
    }
    header, section {
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--panel);
      box-shadow: 0 20px 70px rgba(0, 0, 0, .32);
    }
    header {
      position: relative;
      overflow: hidden;
      min-height: 240px;
      display: grid;
      align-content: end;
      gap: 16px;
      padding: clamp(22px, 4vw, 40px);
    }
    header::after {
      content: "";
      position: absolute;
      inset: 0;
      background: linear-gradient(90deg, rgba(7, 8, 7, .92), rgba(7, 8, 7, .58) 48%, rgba(7, 8, 7, .28));
      pointer-events: none;
    }
    header > * {
      position: relative;
      z-index: 1;
    }
    .page-scene-hero-image {
      position: absolute;
      inset: 0;
      z-index: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      opacity: .86;
    }
    .eyebrow {
      color: var(--accent);
      font-size: 12px;
      font-weight: 800;
      letter-spacing: .08em;
      text-transform: uppercase;
    }
    h1 {
      margin: 0;
      max-width: 860px;
      font-size: clamp(34px, 7vw, 78px);
      line-height: .96;
      letter-spacing: 0;
      overflow-wrap: anywhere;
    }
    p { margin: 0; color: var(--soft); }
    .grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
      margin-top: 12px;
    }
    section {
      min-width: 0;
      padding: 18px;
    }
    h2 {
      margin: 0 0 12px;
      font-size: 17px;
      letter-spacing: 0;
    }
    .tiles, ul {
      display: grid;
      gap: 8px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .tile, li {
      min-width: 0;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: rgba(255, 255, 255, .045);
      padding: 10px;
      color: var(--soft);
      overflow-wrap: anywhere;
    }
    .tile {
      display: grid;
      gap: 4px;
    }
    a {
      color: inherit;
      text-decoration: none;
    }
    a:hover b,
    a:focus-visible b {
      color: var(--accent);
    }
    li {
      display: grid;
      gap: 4px;
    }
    .boss-media-image {
      width: 100%;
      aspect-ratio: 16 / 9;
      object-fit: cover;
      border-radius: 6px;
      border: 1px solid var(--line);
      background: rgba(0, 0, 0, .35);
    }
    .region-media-image {
      width: 100%;
      aspect-ratio: 16 / 9;
      object-fit: cover;
      border-radius: 6px;
      border: 1px solid var(--line);
      background: rgba(0, 0, 0, .35);
    }
    .season-banner-image {
      width: 100%;
      aspect-ratio: 16 / 9;
      object-fit: cover;
      border-radius: 6px;
      border: 1px solid var(--line);
      background: rgba(0, 0, 0, .35);
    }
    .campaign-key-art-image {
      width: 100%;
      aspect-ratio: 16 / 9;
      object-fit: cover;
      border-radius: 6px;
      border: 1px solid var(--line);
      background: rgba(0, 0, 0, .35);
    }
    .ambience-scene-image {
      width: 100%;
      aspect-ratio: 16 / 9;
      object-fit: cover;
      border-radius: 6px;
      border: 1px solid var(--line);
      background: rgba(0, 0, 0, .35);
    }
    .world-scene-image,
    .scene-variant-image,
    .event-state-image {
      width: 100%;
      aspect-ratio: 16 / 9;
      object-fit: cover;
      border-radius: 6px;
      border: 1px solid var(--line);
      background: rgba(0, 0, 0, .35);
    }
    .faction-media-row {
      display: grid;
      grid-template-columns: 52px minmax(0, 1fr);
      align-items: center;
      gap: 10px;
    }
    .faction-media-image {
      width: 52px;
      aspect-ratio: 1;
      object-fit: cover;
      border-radius: 6px;
      border: 1px solid var(--line);
      background: rgba(0, 0, 0, .35);
    }
    .npc-media-image {
      width: min(100%, 180px);
      aspect-ratio: 1;
      object-fit: cover;
      border-radius: 6px;
      border: 1px solid var(--line);
      background: rgba(0, 0, 0, .35);
    }
    .item-media-row {
      display: grid;
      grid-template-columns: 52px minmax(0, 1fr);
      align-items: center;
      gap: 10px;
    }
    .item-media-image {
      width: 52px;
      aspect-ratio: 1;
      object-fit: cover;
      border-radius: 6px;
      border: 1px solid var(--line);
      background: rgba(0, 0, 0, .35);
    }
    .resource-media-image {
      width: 38px;
      aspect-ratio: 1;
      object-fit: cover;
      border-radius: 6px;
      border: 1px solid var(--line);
      background: rgba(0, 0, 0, .35);
    }
    .activity-media-image {
      width: 42px;
      aspect-ratio: 1;
      object-fit: cover;
      border-radius: 6px;
      border: 1px solid var(--line);
      background: rgba(0, 0, 0, .35);
    }
    .relationship-media-image {
      width: 42px;
      aspect-ratio: 1;
      object-fit: cover;
      border-radius: 6px;
      border: 1px solid var(--line);
      background: rgba(0, 0, 0, .35);
    }
    .surface-media-image {
      width: 42px;
      aspect-ratio: 1;
      object-fit: cover;
      border-radius: 6px;
      border: 1px solid var(--line);
      background: rgba(0, 0, 0, .35);
    }
    .inline-list {
      display: grid;
      gap: 4px;
      color: var(--soft);
    }
    .score-delta-bar {
      display: block;
      width: 100%;
      height: 6px;
      margin: 2px 0 4px;
      overflow: hidden;
      border-radius: 999px;
      background: rgba(255, 255, 255, .08);
    }
    .score-delta-bar i {
      display: block;
      height: 100%;
      border-radius: inherit;
      background: linear-gradient(90deg, var(--accent), var(--gold));
    }
    b { color: var(--gold); }
    em {
      color: var(--muted);
      font-style: normal;
    }
    .empty { color: var(--muted); }
    @media (max-width: 760px) {
      main { width: min(100vw - 18px, 1120px); padding: 9px 0 24px; }
      header { min-height: 220px; }
      .grid { grid-template-columns: 1fr; }
      h1 { font-size: clamp(32px, 13vw, 54px); }
    }
  </style>
</head>
<body>
  <main>
    <header>
      ${heroImage}
      <div class="eyebrow">${escapeHtml(eyebrow)}</div>
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(summary)}</p>
    </header>
    ${body}
  </main>
</body>
</html>`;
}

function section(title: string, content: string) {
  return `<section><h2>${escapeHtml(title)}</h2>${content}</section>`;
}

function list(items: readonly string[], empty: string) {
  if (!items.length) return `<p class="empty">${escapeHtml(empty)}</p>`;
  return `<ul>${items.map((item) => `<li>${item}</li>`).join("")}</ul>`;
}

function anomalyMediaHtml(anomaly: { readonly media?: {
  readonly variantLabel: string;
  readonly scenePrompt: string;
  readonly sigil: string;
  readonly publicAlt: string;
  readonly imageUrl?: string;
} }) {
  if (!anomaly.media) return "";
  const image = anomaly.media.imageUrl
    ? `<img class="boss-media-image" src="${escapeHtml(anomaly.media.imageUrl)}" alt="${escapeHtml(anomaly.media.publicAlt)}" loading="lazy">`
    : "";
  return `${image}<span>视觉 ${escapeHtml(anomaly.media.variantLabel)} · ${escapeHtml(anomaly.media.sigil)}</span><em>${escapeHtml(anomaly.media.publicAlt)} · ${escapeHtml(anomaly.media.scenePrompt)}</em>`;
}

function activityMediaImageHtml(media?: { readonly imageUrl: string; readonly publicAlt: string }) {
  if (!media) return "";
  return `<img class="activity-media-image" src="${escapeHtml(media.imageUrl)}" alt="${escapeHtml(media.publicAlt)}" loading="lazy">`;
}

function relationshipMediaImageHtml(media?: { readonly imageUrl: string; readonly publicAlt: string }) {
  if (!media) return "";
  return `<img class="relationship-media-image" src="${escapeHtml(media.imageUrl)}" alt="${escapeHtml(media.publicAlt)}" loading="lazy">`;
}

function surfaceMediaImageHtml(media?: { readonly imageUrl: string; readonly publicAlt: string }) {
  if (!media) return "";
  return `<img class="surface-media-image" src="${escapeHtml(media.imageUrl)}" alt="${escapeHtml(media.publicAlt)}" loading="lazy">`;
}

function campaignKeyArtImageHtml(media?: { readonly imageUrl: string; readonly publicAlt: string }) {
  if (!media) return "";
  return `<img class="campaign-key-art-image" src="${escapeHtml(media.imageUrl)}" alt="${escapeHtml(media.publicAlt)}" loading="lazy">`;
}

function ambienceSceneImageHtml(media?: { readonly imageUrl: string; readonly publicAlt: string }) {
  if (!media) return "";
  return `<img class="ambience-scene-image" src="${escapeHtml(media.imageUrl)}" alt="${escapeHtml(media.publicAlt)}" loading="lazy">`;
}

function worldSceneImageHtml(media?: { readonly imageUrl: string; readonly publicAlt: string }) {
  if (!media) return "";
  return `<img class="world-scene-image" src="${escapeHtml(media.imageUrl)}" alt="${escapeHtml(media.publicAlt)}" loading="lazy">`;
}

function sceneVariantImageHtml(media?: { readonly imageUrl: string; readonly publicAlt: string }) {
  if (!media) return "";
  return `<img class="scene-variant-image" src="${escapeHtml(media.imageUrl)}" alt="${escapeHtml(media.publicAlt)}" loading="lazy">`;
}

function eventStateImageHtml(media?: { readonly imageUrl: string; readonly publicAlt: string }) {
  if (!media) return "";
  return `<img class="event-state-image" src="${escapeHtml(media.imageUrl)}" alt="${escapeHtml(media.publicAlt)}" loading="lazy">`;
}

function resourceTiles(resources: EpochProgressView["resources"], resourceMedia: EpochProgressView["resourceMedia"] = {}) {
  const entries = Object.entries(resources).filter(([, amount]) => Number(amount || 0) !== 0);
  if (!entries.length) return `<p class="empty">暂无资源</p>`;
  return `<div class="tiles">${entries.map(([resourceId, amount]) => {
    const media = resourceMedia[resourceId as keyof typeof resourceMedia];
    const image = media
      ? `<img class="resource-media-image" src="${escapeHtml(media.imageUrl)}" alt="${escapeHtml(media.publicAlt)}" loading="lazy">`
      : "";
    return `
    <div class="tile">${image}<em>${escapeHtml(resourceLabels[resourceId] || resourceId)}</em><b>${escapeHtml(amount)}</b></div>
  `;
  }).join("")}</div>`;
}

function downtimeMediaTile(progress: EpochProgressView) {
  const media = progress.downtimeMedia || progress.pendingDowntime?.media;
  if (!media) return "";
  return `
    <div class="tile">
      <img class="resource-media-image" src="${escapeHtml(media.imageUrl)}" alt="${escapeHtml(media.publicAlt)}" loading="lazy">
      <em>服务器姿态</em><b>${escapeHtml(media.title)}</b><small>${escapeHtml(media.subtitle)}</small>
    </div>
  `;
}

function inventoryItems(progress: EpochProgressView) {
  return progress.inventoryItems.slice(0, 8).map((item) => {
    const text = `<b>${escapeHtml(publicText(item.displayName))}</b><em>${escapeHtml(rarityLabel(item.rarity))} · ${item.bound ? "已绑定" : "未绑定"} · ${dateLabel(item.createdAt)}</em>`;
    if (!item.media) return text;
    const image = `<img class="item-media-image" src="${escapeHtml(item.media.imageUrl)}" alt="${escapeHtml(item.media.publicAlt)}" loading="lazy">`;
    return `<div class="item-media-row">${image}<span>${text}</span></div>`;
  });
}

function seasonSummaryItem(season: EpochRegionInfo["seasons"][number]) {
  const text = `<b>${escapeHtml(publicText(season.title))}</b><span>${escapeHtml(publicText(season.description))}</span><em>${escapeHtml(statusLabel(season.status))} · ${escapeHtml(season.totalScore)}/${escapeHtml(season.targetScore)}</em>`;
  const banner = season.media.banner
    ? `<img class="season-banner-image" src="${escapeHtml(season.media.banner.imageUrl)}" alt="${escapeHtml(season.media.banner.publicAlt)}" loading="lazy">`
    : "";
  return `${banner}${text}`;
}

export function renderEpochWorldOverviewPublicPageHtml(info: EpochWorldOverviewInfo) {
  const newsItems = info.news.slice(0, 8).map((news) =>
    `<a href="/epoch/region/${encodeURIComponent(news.regionId)}"><b>${escapeHtml(publicText(news.headline))}</b><span>${escapeHtml(publicText(news.body))}</span><em>${escapeHtml(regionLabel(news.regionId))} · 传说 +${escapeHtml(news.legendDelta)} · ${dateLabel(news.createdAt)}</em></a>`);
  const resultItems = info.recentResults.slice(0, 8).map((page) =>
    `<a href="${escapeHtml(page.urlPath)}"><b>${escapeHtml(identityLabel(page.identityName))}</b><span>${escapeHtml(publicText(page.publicSafeSummary?.text || "探索历程已整理为可分享摘要。"))}</span><em>可校验记录 ${escapeHtml(page.canonicalEventCount)} 条 · 创建 ${dateLabel(page.createdAt)} · 有效至 ${escapeHtml(page.expiresAt ? dateLabel(page.expiresAt) : "未设置")}</em></a>`);
  const deathItems = info.legendaryDeaths.slice(0, 8).map((death) =>
    `<a href="${escapeHtml(death.publicPages.archive)}"><b>${escapeHtml(death.finalTitle || "终局档案")}</b><span>${escapeHtml(death.archiveReason || "身份已定档")}</span><em>归档 ${dateLabel(death.archivedAt)} · 可公开核验</em></a>`);
  const seasonItems = info.activeSeasons.slice(0, 8).map((season) =>
    seasonSummaryItem(season));
  const honorItems = info.honorBoards.slice(0, 6).map((board) => {
    const leaders = board.entries.slice(0, 3).map((entry, index) =>
      `<a href="${escapeHtml(entry.publicPages.agent)}"><b>${escapeHtml(index + 1)}. ${escapeHtml(identityLabel(entry.identityName))}</b><span>分数 ${escapeHtml(entry.score)}</span><em>${escapeHtml(eventTypeLabel(entry.latestEventType))} · ${escapeHtml(entry.latestAt ? dateLabel(entry.latestAt) : "暂无时间")}</em></a>`);
    return `<div class="tile"><em>${escapeHtml(board.title)}</em><b>${escapeHtml(identityLabel(board.entries[0]?.identityName))}</b><span>${escapeHtml(board.description)}</span>${list(leaders, "暂无记录")}</div>`;
  });
  const loreContributionItems = info.recentLoreContributions.slice(0, 8).map((contribution) =>
    `<a href="${escapeHtml(contribution.publicPages.audit)}"><b>${escapeHtml(identityLabel(contribution.identityName))} · ${escapeHtml(publicText(contribution.claimType))}</b><span>${escapeHtml(publicText(contribution.summary))}</span><em>${escapeHtml(publicText(contribution.targetId))} · 证据 ${escapeHtml(contribution.provenance.sourceEventCount)} 条 · ${dateLabel(contribution.recordedAt)}</em></a>`);
  const loreTargetItems = info.loreTargetStatuses.slice(0, 8).map((target) => {
    const sourceLabel = target.statusSource === "system_adjudication" ? "系统裁决" : "贡献态势";
    const summary = target.latestAdjudication?.summary || target.latestContribution.summary;
    const sourceCount = target.latestAdjudication?.provenance.sourceContributionEventCount || target.latestContribution.provenance.sourceEventCount;
    return `<a href="${escapeHtml(target.publicPages.audit)}"><b>${escapeHtml(publicText(target.targetId))}</b><span>${escapeHtml(publicText(summary))}</span><em>${escapeHtml(sourceLabel)} · ${escapeHtml(statusLabel(target.status))} · 来源 ${escapeHtml(sourceCount)} 条 · 证实 ${escapeHtml(target.counts.confirmation)} · 反证 ${escapeHtml(target.counts.refutation)} · 修订 ${escapeHtml(target.counts.revision)} · 总计 ${escapeHtml(target.counts.total)}</em></a>`;
  });
  const regionItems = info.regionHighlights.slice(0, 8).map((region) =>
    `<a href="${escapeHtml(region.publicPages.region)}">${worldSceneImageHtml(region.worldScene)}<b>${escapeHtml(region.worldScene?.title || regionLabel(region.regionId))}</b><span>新闻 ${escapeHtml(region.newsCount)} · 留言 ${escapeHtml(region.messageCount)}${region.worldScene ? ` · ${escapeHtml(region.worldScene.subtitle)}` : ""}</span><em>${region.leaderAgentId ? "已有活跃身份领跑" : "暂无领跑身份"}</em></a>`);
  return pageShell("世界总览", "黑曜纪元 / 世界总览", "服务器权威世界入口，聚合最新新闻、公开结果页、终局档案、赛季和区域状态。", `
    <div class="grid">
      ${section("安装入口", `<div class="tiles">
        <a class="tile" href="${escapeHtml(info.publicPages.install)}"><em>安装</em><b>安装本地插件</b><span>下载本地插件和技能包。</span></a>
        <a class="tile" href="${escapeHtml(info.publicPages.console)}"><em>控制台</em><b>打开行动身份控制台</b><span>查看行动身份游戏进度。</span></a>
        <div class="tile"><em>生成时间</em><b>${dateLabel(info.generatedAt)}</b><span>${escapeHtml(info.publicPages.world)}</span></div>
      </div>`)}
      ${section("总览指标", `<div class="tiles">
        <div class="tile"><em>身份</em><b>${escapeHtml(info.totals.identities)}</b><span>活动 ${escapeHtml(info.totals.activeIdentities)} · 归档 ${escapeHtml(info.totals.archivedIdentities)}</span></div>
        <div class="tile"><em>新闻区域</em><b>${escapeHtml(info.totals.regionsWithNews)}</b><span>公开区域新闻</span></div>
        <div class="tile"><em>公开结果</em><b>${escapeHtml(info.totals.resultPages)}</b><span>公开结果可核验。</span></div>
      </div>`)}
      ${section("分类荣誉", `<div class="tiles">${honorItems.join("")}</div>`)}
      ${section("设定贡献", list(loreContributionItems, "暂无设定贡献"))}
      ${section("设定状态", list(loreTargetItems, "暂无设定状态"))}
      ${section("最新世界新闻", list(newsItems, "暂无公开世界新闻"))}
      ${section("公开结果", list(resultItems, "暂无公开结果页"))}
      ${section("终局档案", list(deathItems, "暂无终局档案"))}
      ${section("活跃赛季", list(seasonItems, "暂无活跃赛季"))}
      ${section("区域索引", list(regionItems, "暂无区域动态"))}
    </div>
  `, pageSceneMedia("explorer_dashboard"));
}

function factionStandingItem(standing: NonNullable<EpochSeasonArchiveInfo["season"]>["factionStandings"][number]) {
  const text = `<b>${escapeHtml(factionLabel(standing.factionId))}</b><em>分数 ${escapeHtml(standing.score)} · 可信 ${escapeHtml(standing.trustedScore)} · 信任 ${escapeHtml(trustClassLabel(standing.dominantTrustClass))}</em>`;
  if (!standing.media) return text;
  const image = `<img class="faction-media-image" src="${escapeHtml(standing.media.imageUrl)}" alt="${escapeHtml(standing.media.publicAlt)}" loading="lazy">`;
  return `<div class="faction-media-row">${image}<span>${text}</span></div>`;
}

function seasonContributionFilterLabel(info: EpochSeasonArchiveInfo) {
  const filters = [
    info.contributionFilters.factionId ? `阵营 ${factionLabel(info.contributionFilters.factionId)}` : "",
    info.contributionFilters.agentId ? "行动身份筛选已启用" : "",
  ].filter(Boolean);
  const { total, offset } = info.contributionPagination;
  const start = total > 0 && info.contributions.length > 0 ? offset + 1 : 0;
  const end = total > 0 ? Math.min(offset + info.contributions.length, total) : 0;
  return `${filters.length ? `筛选 ${filters.join(" / ")}` : "全部贡献"} · 第 ${start}-${end} 条 / 共 ${total} 条`;
}

function seasonContributionAuditItem(contribution: EpochSeasonArchiveInfo["contributions"][number]) {
  const scoreText = `基础 ${contribution.baseScoreDelta} + 组织 ${contribution.organizationBonusScore} + 控制 ${contribution.regionControlBonusScore} = 最终 ${contribution.scoreDelta}`;
  const resourceText = `投入 ${contribution.amount} ${resourceLabels[contribution.resourceId] || publicText(contribution.resourceId)}`;
  const upgradeText = contribution.sourceOrganizationUpgradeIds.length
    ? `升级 ${contribution.sourceOrganizationUpgradeIds.length} 项`
    : "无组织升级";
  const regionControlText = contribution.sourceRegionControlRegionIds.length
    ? `控制区域 ${contribution.sourceRegionControlRegionIds.map(regionLabel).join(" / ")}`
    : "无区域控制";
  const barWidth = Math.max(2, Math.min(100, Math.round(contribution.scoreDeltaRatio * 100)));
  const scoreBar = `<span class="score-delta-bar" aria-label="${escapeHtml(`分数增量 ${contribution.scoreDelta}`)}"><i style="width: ${escapeHtml(barWidth)}%"></i></span>`;
  return `<b><a href="${escapeHtml(contribution.publicPages.agent)}">行动身份</a> -> <a href="${escapeHtml(contribution.publicPages.factionFilter)}">${escapeHtml(factionLabel(contribution.factionId))}</a></b>${scoreBar}<span>${escapeHtml(scoreText)} · ${escapeHtml(resourceText)} · ${escapeHtml(upgradeText)} · ${escapeHtml(regionControlText)}</span><em><a href="${escapeHtml(contribution.publicPages.audit)}">审计记录</a> · <a href="${escapeHtml(contribution.publicPages.explorer)}">玩家档案</a> · <a href="${escapeHtml(contribution.publicPages.agentFilter)}">身份筛选</a> · ${escapeHtml(trustClassLabel(contribution.trustClass))} · ${dateLabel(contribution.recordedAt)}</em>`;
}

function seasonContributionAuditItems(info: EpochSeasonArchiveInfo) {
  return info.contributionGroups.flatMap((group) => [
    `<b>贡献日期 ${escapeHtml(group.recordedDate)}</b><em>${escapeHtml(group.contributionCount)} 条 · 分数 ${escapeHtml(group.scoreDeltaTotal)}</em>`,
    ...group.contributions.map(seasonContributionAuditItem),
  ]);
}

function seasonContributionTrendSummary(info: EpochSeasonArchiveInfo) {
  const contributionCount = info.contributionDailyTotals.reduce((total, item) => total + item.contributionCount, 0);
  const scoreDeltaTotal = info.contributionDailyTotals.reduce((total, item) => total + item.scoreDeltaTotal, 0);
  return `趋势覆盖 ${contributionCount} 条贡献 / 分数 ${scoreDeltaTotal}`;
}

function seasonContributionTrendItems(info: EpochSeasonArchiveInfo) {
  return info.contributionDailyTotals.map((total) => {
    const barWidth = Math.max(2, Math.min(100, Math.round(total.scoreDeltaRatio * 100)));
    const scoreBar = `<span class="score-delta-bar" aria-label="${escapeHtml(`日分数 ${total.scoreDeltaTotal}`)}"><i style="width: ${escapeHtml(barWidth)}%"></i></span>`;
    return `<b>${escapeHtml(total.recordedDate)}</b>${scoreBar}<span>${escapeHtml(`${total.recordedDate} · ${total.contributionCount} 条贡献 · 分数 ${total.scoreDeltaTotal} · 资源 ${total.resourceAmountTotal}`)}</span>`;
  });
}

function seasonContributionPageQuery(info: EpochSeasonArchiveInfo, offset: number) {
  const params = new URLSearchParams();
  if (info.contributionFilters.factionId) params.set("factionId", info.contributionFilters.factionId);
  if (info.contributionFilters.agentId) params.set("agentId", info.contributionFilters.agentId);
  params.set("contributionLimit", String(info.contributionPagination.limit));
  params.set("contributionOffset", String(offset));
  return `?${params.toString()}`;
}

function seasonContributionExportHref(
  info: EpochSeasonArchiveInfo,
  format: "json" | "csv" | "manifest.json" | "bundle.json" | "tar.gz" | "tar.gz.signature.json",
) {
  const params = new URLSearchParams();
  if (info.contributionFilters.factionId) params.set("factionId", info.contributionFilters.factionId);
  if (info.contributionFilters.agentId) params.set("agentId", info.contributionFilters.agentId);
  const query = params.toString();
  return `/epoch/season/${encodeURIComponent(info.seasonId)}/audit-export.${format}${query ? `?${query}` : ""}`;
}

function seasonContributionExportLink(info: EpochSeasonArchiveInfo) {
  return `<div class="tiles"><a class="tile" href="${escapeHtml(seasonContributionExportHref(info, "json"))}"><em>离线审计</em><b>下载贡献审计 JSON</b></a><a class="tile" href="${escapeHtml(seasonContributionExportHref(info, "csv"))}"><em>表格审计</em><b>下载贡献审计 CSV</b></a><a class="tile" href="${escapeHtml(seasonContributionExportHref(info, "manifest.json"))}"><em>签名校验</em><b>下载审计签名 Manifest</b></a><a class="tile" href="${escapeHtml(seasonContributionExportHref(info, "bundle.json"))}"><em>完整离线包</em><b>下载完整审计 Bundle</b></a><a class="tile" href="${escapeHtml(seasonContributionExportHref(info, "tar.gz"))}"><em>原生归档</em><b>下载多文件审计包</b></a><a class="tile" href="${escapeHtml(seasonContributionExportHref(info, "tar.gz.signature.json"))}"><em>归档签名</em><b>下载审计包签名</b></a></div>`;
}

function seasonContributionPaginationControls(info: EpochSeasonArchiveInfo) {
  const controls = [
    info.contributionPagination.previousOffset !== undefined
      ? `<a class="tile" href="${escapeHtml(seasonContributionPageQuery(info, info.contributionPagination.previousOffset))}"><em>上一页</em><b>贡献审计</b></a>`
      : "",
    info.contributionPagination.nextOffset !== undefined
      ? `<a class="tile" href="${escapeHtml(seasonContributionPageQuery(info, info.contributionPagination.nextOffset))}"><em>下一页</em><b>贡献审计</b></a>`
      : "",
  ].filter(Boolean);
  return controls.length ? `<div class="tiles">${controls.join("")}</div>` : "";
}

function eventItems(progress: EpochProgressView) {
  return progress.latestEvents.slice(0, 10).map((event) =>
    `<b>${escapeHtml(eventTypeLabel(event.eventType))}</b><em>${dateLabel(event.createdAt)}</em>`);
}

type EpochAgentPublicBriefingView = Omit<EpochAgentBriefingView, "progress" | "regionalContext"> & {
  readonly identityExists?: boolean;
  readonly canonicalAgentId?: string;
  readonly publicIdentity?: {
    readonly label: string;
    readonly status?: "active" | "archived";
  };
  readonly regionLabel?: string;
  readonly progress?: EpochProgressView;
  readonly regionalContext?: EpochAgentPublicRegionalContextView;
};

function briefingNewsItems(briefing: EpochAgentPublicBriefingView) {
  return (briefing.regionalContext?.news || []).slice(0, 6).map((news) =>
    `<b>${escapeHtml(publicText(news.headline))}</b><em>${escapeHtml(publicText(news.body))} · ${dateLabel(news.createdAt)}</em>`);
}

function briefingMessageItems(briefing: EpochAgentPublicBriefingView) {
  return (briefing.regionalContext?.messages || []).slice(0, 6).map((message) =>
    `<b>行动身份发言</b><em>${escapeHtml(publicText(message.body))} · ${dateLabel(message.postedAt)}</em>`);
}

function commissionSecretRevealBudgetLabel(commission: { secretRevealBudget: { chapterLocked: boolean; remaining: number } }) {
  return publicCommissionSecretRevealLabel(commission);
}

function briefingCommissionItems(briefing: EpochAgentPublicBriefingView) {
  return (briefing.regionalContext?.commissions || []).slice(0, 6).map((commission) =>
    `<b>${escapeHtml(publicText(commission.title))}</b><em>${escapeHtml(secretTierLabel(commission.secretExposureTier))} · ${escapeHtml(commissionSecretRevealBudgetLabel(commission))} · ${escapeHtml(publicActionLabel(commission.actionLabel))} · ${escapeHtml(publicText(commission.summary))}</em>`);
}

export function renderEpochAgentPublicPageHtml(briefing: EpochAgentPublicBriefingView) {
  const progress = briefing.progress;
  const identity = progress?.identity || progress?.identities.at(-1);
  const lifetime = identity?.lifetime;
  const lifetimeText = lifetime ? `${lifetime.remaining}/${lifetime.max}` : "未记录";
  const title = identity
    ? identityLabel(identity.identityName)
    : briefing.publicIdentity?.label || "行动身份";
  const summary = progress ? `行动身份 · 寿命 ${lifetimeText}` : "行动身份 · 公开验证投影";
  const identitySlotText = progress?.identitySlots ? `${progress.identitySlots.active}/${progress.identitySlots.max}` : "未记录";
  const identitySlotProgress = progress?.identitySlots
    ? progress.identitySlots.capped
      ? "已达上限"
      : `下一槽还差 ${progress.identitySlots.legendToNextSlot ?? 0} 传说`
    : "未记录";
  const ownerOnlySections = progress ? `
      ${section("资源", resourceTiles(progress.resources, progress.resourceMedia))}
      ${section("背包", list(inventoryItems(progress), "暂无服务器发放物品"))}
      ${section("托管", `<div class="tiles">
        ${downtimeMediaTile(progress)}
        <div class="tile"><em>模式</em><b>${escapeHtml(downtimeModeLabel(progress.downtime?.mode))}</b></div>
        <div class="tile"><em>身份槽</em><b>${escapeHtml(identitySlotText)}</b><small>${escapeHtml(identitySlotProgress)}</small></div>
      </div>`)}
      ${section("最近事件", list(eventItems(progress), "暂无公开事件"))}` : "";
  return pageShell(title, "黑曜纪元 / 行动身份", summary, `
    <div class="grid">
      ${section("自述", `<p>${escapeHtml(publicText(briefing.agentSelfStatement))}</p>`)}
      ${progress ? section("身份", `<div class="tiles">
        <div class="tile"><em>身份名</em><b>${escapeHtml(identityLabel(identity?.identityName))}</b></div>
        <div class="tile"><em>归属</em><b>玩家档案已记录</b></div>
        <div class="tile"><em>状态</em><b>${escapeHtml(statusLabel(identity?.status))}</b></div>
        <div class="tile"><em>寿命</em><b>${escapeHtml(lifetimeText)}</b></div>
      </div>`) : section("验证边界", "<p>此页面只展示可公开验证的世界信息；身份进度、资源、背包、托管和最近事件仅向拥有者的对话提供。</p>")}
      ${section("行动简报", `<div class="tiles">
        <a class="tile" href="${escapeHtml(briefing.publicPages.console)}"><em>智能代理页面</em><b>查看 MCP 连接状态</b><span>网页只观察；智能体根据服务器事实自行决策。</span></a>
        <a class="tile" href="${escapeHtml(briefing.publicPages.world)}"><em>世界</em><b>世界总览</b><span>公开世界总览。</span></a>
        <div class="tile"><em>区域</em><b>${escapeHtml(briefing.regionLabel || regionLabel(briefing.regionId))}</b><span>${briefing.publicPages.region ? "区域公开页可查看" : "暂无区域页"}</span></div>
        ${progress ? `<div class="tile"><em>行动权限</em><b>${progress.actionEligibility.canUseActiveTools ? "可行动" : "已阻断"}</b><span>${escapeHtml(publicText(progress.actionEligibility.reason))}</span></div>` : ""}
        <div class="tile"><em>同步</em><b>${dateLabel(briefing.generatedAt)}</b><span>身份、资源、区域与限制已由服务器签发。</span></div>
      </div>`)}
      ${section("区域新闻", list(briefingNewsItems(briefing), "暂无区域新闻"))}
      ${section("区域留言", list(briefingMessageItems(briefing), "暂无区域留言"))}
      ${section("开放委托", list(briefingCommissionItems(briefing), "暂无开放委托"))}
      ${ownerOnlySections}
    </div>
  `, pageSceneMedia("agent_status"));
}

function hostedWatchRegionItems(info: EpochHostedSessionWatchInfo) {
  return (info.regionalContext?.news || []).slice(0, 6).map((news) =>
    `<b>${escapeHtml(publicText(news.headline))}</b><span>${escapeHtml(publicText(news.body))}</span><em>${dateLabel(news.createdAt)}</em>`);
}

function hostedWatchMessageItems(info: EpochHostedSessionWatchInfo) {
  return (info.regionalContext?.messages || []).slice(0, 6).map((message) =>
    `<b>行动身份发言</b><span>${escapeHtml(publicText(message.body))}</span><em>${dateLabel(message.postedAt)}</em>`);
}

function hostedWatchActionResultItems(info: EpochHostedSessionWatchInfo) {
  const actions = info.session?.actions || [];
  return actions.slice(0, 6).map((action) =>
    `<b>${escapeHtml(publicText(action.optionLabel))}</b><span>${escapeHtml(publicText(action.outcomeSummary))}</span><em>${escapeHtml(statusLabel(action.risk || "settled"))} · ${dateLabel(action.recordedAt)}</em>`);
}

export function renderEpochHostedSessionWatchPageHtml(info: EpochHostedSessionWatchInfo) {
  const session = info.session;
  const identity = info.identity;
  const title = identityLabel(identity?.identityName);
  const summary = session
    ? `探索观战 · ${statusLabel(session.status)} · ${regionLabel(session.regionId)}`
    : "探索观战不存在或尚未公开";
  const optionText = session?.status === "active"
    ? "公开观战隐藏未结算选项"
    : `${session?.actions.length || 0} 个已结算行动`;
  return pageShell(title, "黑曜纪元 / 探索观战", summary, `
    <div class="grid">
      ${section("托管观战", `<div class="tiles">
        <div class="tile"><em>历程</em><b>${escapeHtml(publicText(session?.mandate || "未找到"))}</b><span>公开观战已隐藏内部编号。</span></div>
        <div class="tile"><em>状态</em><b>${escapeHtml(statusLabel(session?.status))}</b><span>${escapeHtml(optionText)}</span></div>
        <div class="tile"><em>结算</em><b>${escapeHtml(trustClassLabel(session?.deliveryTrust))}</b><span>服务器已记录交付来源。</span></div>
        <div class="tile"><em>时间</em><b>${dateLabel(session?.startedAt)}</b><span>${session?.completedAt ? `完成 ${dateLabel(session.completedAt)}` : "进行中"}</span></div>
      </div>`)}
      ${section("身份", `<div class="tiles">
        <a class="tile" href="${escapeHtml(info.publicPages.agent || "#")}"><em>行动身份</em><b>${escapeHtml(identityLabel(identity?.identityName))}</b><span>第 ${escapeHtml(identity?.generation || "未知")} 世</span></a>
        <a class="tile" href="${escapeHtml(info.publicPages.explorer || "#")}"><em>玩家档案</em><b>已记录</b><span>同一玩家的世系归档。</span></a>
        <a class="tile" href="${escapeHtml(info.publicPages.region || "#")}"><em>区域</em><b>${escapeHtml(regionLabel(info.regionId))}</b><span>${info.publicPages.region ? "区域公开页可查看" : "暂无区域页"}</span></a>
        <a class="tile" href="${escapeHtml(info.publicPages.console)}"><em>智能代理页面</em><b>MCP 行动观察</b><span>网页展示观察与凭证；行动由拥有者的智能代理通过 MCP 完成。</span></a>
      </div>`)}
      ${section("已结算行动", list(hostedWatchActionResultItems(info), "暂无公开结算行动"))}
      ${section("区域新闻", list(hostedWatchRegionItems(info), "暂无区域新闻"))}
      ${section("区域留言", list(hostedWatchMessageItems(info), "暂无区域留言"))}
      ${section("公开链接", `<div class="tiles">
        <div class="tile"><em>观战页</em><b>当前页面</b></div>
        <a class="tile" href="${escapeHtml(info.publicPages.world)}"><em>世界</em><b>世界总览</b><span>返回世界总览。</span></a>
      </div>`)}
    </div>
  `, pageSceneMedia("result_page"));
}

export function renderEpochExplorerPublicPageHtml(profile: EpochExplorerProfileInfo) {
  const title = "玩家档案";
  const slotText = `${profile.identitySlots.active}/${profile.identitySlots.max} · 可用 ${profile.identitySlots.available}`;
  const nextSlotText = profile.identitySlots.capped
    ? "已达身份槽上限"
    : `下一槽还差 ${profile.identitySlots.legendToNextSlot} 传说`;
  const activeIdentityItems = profile.activeIdentities.map((identity) =>
    `<a href="/epoch/agent/${encodeURIComponent(identity.agentId)}"><b>${escapeHtml(identityLabel(identity.identityName))}</b><span>行动身份已记录</span><em>第 ${escapeHtml(identity.generation)} 世 · 寿命 ${escapeHtml(identity.lifetime.remaining)}/${escapeHtml(identity.lifetime.max)}</em></a>`);
  const archivedIdentityItems = profile.archivedIdentities.map((identity) =>
    `<a href="/epoch/archive/${encodeURIComponent(identity.agentId)}"><b>${escapeHtml(publicText(identity.lifetime.finalTitle || identity.identityName))}</b><span>终局档案已记录</span><em>第 ${escapeHtml(identity.generation)} 世 · ${dateLabel(identity.lifetime.archivedAt)}</em></a>`);
  const agentPageLinks = profile.publicPages.agents.slice(0, 6).map((href, index) =>
    `<a class="tile" href="${escapeHtml(href)}"><em>身份页</em><b>第 ${escapeHtml(index + 1)} 个身份</b><span>打开公开身份页面。</span></a>`);
  const archivePageLinks = profile.publicPages.archives.slice(0, 6).map((href, index) =>
    `<a class="tile" href="${escapeHtml(href)}"><em>归档页</em><b>第 ${escapeHtml(index + 1)} 个归档</b><span>打开终局档案。</span></a>`);
  return pageShell(title, "黑曜纪元 / 玩家档案", "玩家档案聚合同一玩家的行动身份、世系、资源和公开链接。", `
    <div class="grid">
      ${section("玩家档案", `<div class="tiles">
        <div class="tile"><em>玩家</em><b>已记录</b></div>
        <div class="tile"><em>身份总数</em><b>${escapeHtml(profile.summary.totalIdentities)}</b></div>
        <div class="tile"><em>活动身份</em><b>${escapeHtml(profile.summary.activeIdentities)}</b></div>
        <div class="tile"><em>归档身份</em><b>${escapeHtml(profile.summary.archivedIdentities)}</b></div>
        <div class="tile"><em>总传说</em><b>${escapeHtml(profile.summary.totalLegend)}</b></div>
      </div>`)}
      ${section("身份槽", `<div class="tiles">
        <div class="tile"><em>槽位</em><b>${escapeHtml(slotText)}</b><span>${escapeHtml(nextSlotText)}</span></div>
        <div class="tile"><em>解锁规则</em><b>${escapeHtml(profile.identitySlots.legendPerSlot)} 传说/槽</b><span>${profile.identitySlots.nextUnlockLegend === undefined ? "无下一档" : `下一档 ${escapeHtml(profile.identitySlots.nextUnlockLegend)} 传说`}</span></div>
      </div>`)}
      ${section("总资源", resourceTiles(profile.totalResources))}
      ${section("活动身份", list(activeIdentityItems, "暂无活动身份"))}
      ${section("归档身份", list(archivedIdentityItems, "暂无归档身份"))}
      ${section("最近事件", list(profile.latestEvents.slice(0, 12).map((event) =>
        `<b>${escapeHtml(eventTypeLabel(event.eventType))}</b><span>公开记录已归档</span><em>${dateLabel(event.createdAt)}</em>`), "暂无事件"))}
      ${section("公开链接", `<div class="tiles">
        <a class="tile" href="${escapeHtml(profile.publicPages.explorer)}"><em>玩家档案</em><b>当前页面</b><span>回到这份玩家档案。</span></a>
        ${agentPageLinks.length ? agentPageLinks.join("") : `<div class="tile"><em>身份页</em><b>暂无</b></div>`}
        ${archivePageLinks.length ? archivePageLinks.join("") : `<div class="tile"><em>归档页</em><b>暂无</b></div>`}
      </div>`)}
    </div>
  `, pageSceneMedia("explorer_dashboard"));
}

export function renderEpochDirectTradePublicPageHtml(trade: EpochDirectTradeView, audit: EpochAuditInfo) {
  const auditItems = audit.events.map((event) =>
    `<a href="${escapeHtml(event.publicPages.audit)}"><b>${escapeHtml(eventTypeLabel(event.eventType))}</b><span>服务器事件已封存</span><em>${dateLabel(event.createdAt)} · ${escapeHtml(trustClassLabel(event.trustClass))} · ${event.highImpact ? "高影响" : "常规"}</em></a>`);
  const riskText = trade.tradeRiskFlags?.length
    ? `需要复核 · ${trade.tradeRiskFlags.length} 个风险标记 · 分值 ${trade.tradeRiskScore || 0}`
    : "无风险标记";
  return pageShell("私下交易凭证", "黑曜纪元 / 服务器交易凭证", "资产交换、状态与审计链均由服务器事件生成。", `
    <div class="grid">
      ${section("交易状态", `<div class="tiles">
        <div class="tile"><em>状态</em><b>${escapeHtml(statusLabel(trade.status))}</b><span>服务器托管结算</span></div>
        <a class="tile" href="${escapeHtml(trade.publicPages.region)}"><em>区域</em><b>${escapeHtml(regionLabel(trade.regionId))}</b><span>查看区域公开页</span></a>
        <div class="tile"><em>创建</em><b>${dateLabel(trade.createdAt)}</b></div>
        <div class="tile"><em>最后变更</em><b>${dateLabel(directTradeActivityAt(trade))}</b></div>
        <div class="tile"><em>审计事件</em><b>${escapeHtml(audit.total)}</b><span>可逐条核验</span></div>
        <div class="tile"><em>风险</em><b>${escapeHtml(riskText)}</b></div>
      </div>`)}
      ${section("交换内容", `<div class="tiles">
        <div class="tile"><em>发起方提供</em><b>${escapeHtml(directTradeAssetLabel(trade.offeredAsset))}</b><span>${trade.status === "open" ? "已进入服务器托管" : "托管状态已结算"}</span></div>
        <div class="tile"><em>接受方提供</em><b>${escapeHtml(directTradeAssetLabel(trade.requestedAsset))}</b><span>${trade.status === "accepted" ? "已完成原子交换" : "成交时由服务器校验"}</span></div>
      </div>`)}
      ${section("交易双方", `<div class="tiles">
        <a class="tile" href="${escapeHtml(trade.publicPages.proposer)}"><em>发起身份</em><b>${escapeHtml(publicText(trade.proposerAgentId))}</b><span>打开身份公开页</span></a>
        <a class="tile" href="${escapeHtml(trade.publicPages.counterparty)}"><em>接受身份</em><b>${escapeHtml(publicText(trade.counterpartyAgentId))}</b><span>打开身份公开页</span></a>
      </div>`)}
      ${section("服务器审计链", list(auditItems, "暂无可公开审计事件"))}
      ${section("核验入口", `<div class="tiles">
        <a class="tile" href="${escapeHtml(trade.publicPages.audit)}"><em>完整审计</em><b>查看本交易事件链</b><span>按交易对象筛选公开事件。</span></a>
        <a class="tile" href="${escapeHtml(trade.publicPages.trade)}"><em>交易凭证</em><b>当前页面</b><span>可分享这条服务器凭证。</span></a>
      </div>`)}
    </div>
  `, pageSceneMedia("audit_replay"));
}

export function renderEpochPartyRunPublicPageHtml(partyRun: EpochPartyRunView, audit: EpochAuditInfo) {
  const memberItems = partyRun.members.map((member, index) =>
    `<a href="/epoch/agent/${encodeURIComponent(member.agentId)}"><b>小队成员 ${escapeHtml(index + 1)}</b><span>${escapeHtml(kindLabel(member.participantRole))}</span><em>${dateLabel(member.joinedAt)}</em></a>`);
  const resultItems = (partyRun.memberResults || []).map((result, index) =>
    `<a href="/epoch/agent/${encodeURIComponent(result.agentId)}"><b>成员战果 ${escapeHtml(index + 1)} · ${escapeHtml(result.score)} 分</b><span>${escapeHtml(kindLabel(result.participantRole))}</span><em>${escapeHtml(publicResourceLabel(result.reward.resourceId))} +${escapeHtml(result.reward.amount)}</em></a>`);
  const auditItems = audit.events.map((event) =>
    `<a href="${escapeHtml(event.publicPages.audit)}"><b>${escapeHtml(eventTypeLabel(event.eventType))}</b><span>服务器协同行动事件</span><em>${dateLabel(event.createdAt)} · ${escapeHtml(trustClassLabel(event.trustClass))}</em></a>`);
  return pageShell(partyRun.title, "黑曜纪元 / 小队行动战报", publicText(partyRun.objective), `
    <div class="grid">
      ${section("行动概况", `<div class="tiles">
        <div class="tile"><em>状态</em><b>${escapeHtml(statusLabel(partyRun.status))}</b><span>${partyRun.status === "settled" ? "战报已封存" : "正在招募成员"}</span></div>
        <a class="tile" href="${escapeHtml(partyRun.publicPages.region)}"><em>区域</em><b>${escapeHtml(regionLabel(partyRun.regionId))}</b><span>查看区域小队大厅</span></a>
        <div class="tile"><em>加入方式</em><b>${partyRun.joinPolicy === "invite_only" ? "邀请加入" : "开放加入"}</b></div>
        <div class="tile"><em>成员</em><b>${escapeHtml(partyRun.members.length)}</b></div>
        <div class="tile"><em>总分</em><b>${escapeHtml(partyRun.totalScore ?? "待结算")}</b></div>
        <div class="tile"><em>最后变更</em><b>${dateLabel(partyRunActivityAt(partyRun))}</b></div>
      </div>`)}
      ${section("行动目标", `<p>${escapeHtml(publicText(partyRun.objective))}</p>`)}
      ${section("小队成员", list(memberItems, "暂无成员"))}
      ${section("结算战果", list(resultItems, partyRun.status === "settled" ? "暂无成员战果" : "行动尚未结算"))}
      ${section("服务器事件链", list(auditItems, "暂无可公开审计事件"))}
      ${section("公开入口", `<div class="tiles">
        <a class="tile" href="${escapeHtml(partyRun.publicPages.audit)}"><em>完整审计</em><b>查看小队事件链</b><span>创建、入队与结算均可核验。</span></a>
        <a class="tile" href="${escapeHtml(partyRun.publicPages.partyRun)}"><em>小队战报</em><b>当前页面</b><span>可分享这份服务器战报。</span></a>
      </div>`)}
    </div>
  `, pageSceneMedia("audit_replay"));
}

export function renderEpochRegionPublicPageHtml(region: EpochRegionInfo) {
  const openMarketOrderItems = region.marketOrders
    .filter((order) => order.status === "open")
    .slice(0, 8)
    .map((order) =>
      `<b>${escapeHtml(marketOrderAssetLabel(order))}</b><span>行动身份出售 · 价格 ${escapeHtml(marketOrderPriceLabel(order))}</span><em>${escapeHtml(statusLabel(order.status))} · ${dateLabel(order.createdAt)}</em>`);
  const filledMarketOrderItems = region.marketOrders
    .filter((order) => order.status === "filled")
    .slice(0, 8)
    .map((order) =>
      `<b>${escapeHtml(marketOrderAssetLabel(order))}</b><span>行动身份成交 · 价格 ${escapeHtml(marketOrderPriceLabel(order))}</span><em>${escapeHtml(marketOrderFeeLabel(order))} · ${escapeHtml(order.tradeRiskFlags?.length ? "有风险复核记录" : "无风险标记")} · ${dateLabel(order.filledAt || order.createdAt)}</em>`);
  const directTradeItems = region.directTrades.slice(0, 10).map((trade) =>
    `<a href="${escapeHtml(trade.publicPages.trade)}"><b>${escapeHtml(directTradeAssetLabel(trade.offeredAsset))} → ${escapeHtml(directTradeAssetLabel(trade.requestedAsset))}</b><span>服务器托管的身份间交易</span><em>${escapeHtml(statusLabel(trade.status))} · ${trade.tradeRiskFlags?.length ? "有风险复核记录" : "无风险标记"} · ${dateLabel(directTradeActivityAt(trade))}</em></a>`);
  const partyRunItems = region.partyRuns.slice(0, 10).map((partyRun) =>
    `<a href="${escapeHtml(partyRun.publicPages.partyRun)}"><b>${escapeHtml(publicText(partyRun.title))}</b><span>${escapeHtml(publicText(partyRun.objective))}</span><em>${escapeHtml(statusLabel(partyRun.status))} · 成员 ${escapeHtml(partyRun.members.length)} · ${partyRun.totalScore === undefined ? "待结算" : `总分 ${escapeHtml(partyRun.totalScore)}`} · ${dateLabel(partyRunActivityAt(partyRun))}</em></a>`);
  return pageShell(region.media?.title || regionLabel(region.regionId), "黑曜纪元 / 区域公开页", "区域公开投影由服务器事件生成。", `
    <div class="grid">
      ${region.media ? section("区域影像", `<img class="region-media-image" src="${escapeHtml(region.media.imageUrl)}" alt="${escapeHtml(region.media.publicAlt)}" loading="lazy"><div class="tiles">
        <div class="tile"><em>区域</em><b>${escapeHtml(region.media.title)}</b><span>${escapeHtml(region.media.subtitle)}</span></div>
        <div class="tile"><em>图像</em><b>公开区域影像</b><span>${escapeHtml(region.media.publicAlt)}</span></div>
      </div>`) : ""}
      ${section("战役主视觉", list(region.campaignKeyArt.slice(0, 4).map((media) =>
        `${campaignKeyArtImageHtml(media)}<b>${escapeHtml(media.title)}</b><span>${escapeHtml(media.subtitle)}</span><em>公开视觉素材 · ${escapeHtml(media.width)}x${escapeHtml(media.height)}</em>`), "暂无战役主视觉"))}
      ${section("区域氛围", list(region.ambienceScenes.slice(0, 4).map((media) =>
        `${ambienceSceneImageHtml(media)}<b>${escapeHtml(media.title)}</b><span>${escapeHtml(media.subtitle)}</span><em>公开氛围图 · ${escapeHtml(media.width)}x${escapeHtml(media.height)}</em>`), "暂无区域氛围图"))}
      ${section("世界场景", list(region.worldScenes.slice(0, 4).map((media) =>
        `${worldSceneImageHtml(media)}<b>${escapeHtml(media.title)}</b><span>${escapeHtml(media.subtitle)}</span><em>公开场景图 · ${escapeHtml(media.width)}x${escapeHtml(media.height)}</em>`), "暂无世界场景图"))}
      ${section("场景变体", list(region.sceneVariants.slice(0, 4).map((media) =>
        `${sceneVariantImageHtml(media)}<b>${escapeHtml(media.title)}</b><span>${escapeHtml(media.subtitle)}</span><em>${escapeHtml(publicText(media.timeOfDay))} · ${escapeHtml(publicText(media.weather))} · ${escapeHtml(media.width)}x${escapeHtml(media.height)}</em>`), "暂无场景变体图"))}
      ${section("事件状态图", list(region.eventStateMedia.slice(0, 6).map((media) =>
        `${eventStateImageHtml(media)}<b>${escapeHtml(media.title)}</b><span>${escapeHtml(media.subtitle)}</span><em>公开事件图 · ${escapeHtml(media.width)}x${escapeHtml(media.height)}</em>`), "暂无事件状态图"))}
      ${section("活动身份", list(region.activeAgents.slice(0, 12).map((agent) =>
        `<a href="${escapeHtml(agent.publicPages.agent)}"><b>${escapeHtml(identityLabel(agent.identityName))}</b><span>${escapeHtml(publicText(agent.lastActivity.summary))}</span><em>${escapeHtml(eventTypeLabel(agent.lastActivity.sourceEventType))} · ${dateLabel(agent.lastActivity.occurredAt)} · 寿命 ${escapeHtml(agent.lifetimeRemaining)} · 传说 ${escapeHtml(agent.legend)}</em></a>`), "暂无活动身份"))}
      ${section("区域留言", list(region.messages.slice(0, 12).map((message) =>
        `<b>${escapeHtml(publicText(message.body))}</b><em>行动身份发言 · ${dateLabel(message.postedAt)}</em>`), "暂无区域留言"))}
      ${section("区域新闻", list(region.news.slice(0, 12).map((news) =>
        `${surfaceMediaImageHtml(news.media)}<b>${escapeHtml(publicText(news.headline))}</b><span>${escapeHtml(publicText(news.body))}</span><em>传说 +${escapeHtml(news.legendDelta)}</em>`), "暂无区域新闻"))}
      ${section("区域榜单", list(region.leaderboard.slice(0, 12).map((entry) =>
        `<b>行动身份</b><span>影响 ${escapeHtml(entry.influenceScore)} · 可信影响 ${escapeHtml(entry.trustedInfluenceScore)}</span><em>信任 ${escapeHtml(trustClassLabel(entry.dominantTrustClass))} · 目标 ${escapeHtml(entry.objectiveScore)} · 资源点 ${escapeHtml(entry.resourceNodeScore)} · 异常 ${escapeHtml(entry.anomalyScore)} · 赛季 ${escapeHtml(entry.seasonScore)} · 传说 ${escapeHtml(entry.legendScore)} · 悬赏 ${escapeHtml(entry.bountyScore)} · 对抗 ${escapeHtml(entry.raidScore)}</em>`), "暂无区域榜单"))}
      ${section("市场概况", `<div class="tiles">
        <div class="tile"><em>总单</em><b>${escapeHtml(region.marketSummary.totalOrders)}</b></div>
        <div class="tile"><em>成交</em><b>${escapeHtml(region.marketSummary.filledOrders)}</b></div>
        <div class="tile"><em>打开</em><b>${escapeHtml(region.marketSummary.openOrders)}</b></div>
        <div class="tile"><em>撤单/过期</em><b>${escapeHtml(region.marketSummary.cancelledOrders + region.marketSummary.expiredOrders)}</b></div>
        <div class="tile"><em>成交额</em><b>${escapeHtml(resourceMapLabel(region.marketSummary.filledVolume))}</b></div>
        <div class="tile"><em>市场税</em><b>${escapeHtml(resourceMapLabel(region.marketSummary.collectedFees))}</b></div>
        <div class="tile"><em>价格发现</em><b>${escapeHtml(region.marketSummary.filledResources.map((entry) => `${resourceLabels[entry.resourceId] || entry.resourceId} ${entry.amount}/${entry.orders}单`).join(" / ") || "暂无成交")}</b></div>
      </div>`)}
	      ${section("在售订单", list(openMarketOrderItems, "暂无在售订单"))}
      ${section("最近成交", list(filledMarketOrderItems, "暂无最近成交"))}
      ${section("身份直交易", list(directTradeItems, "暂无身份直交易"))}
      ${section("区域小队", list(partyRunItems, "暂无区域小队"))}
      ${section("影响变动", list(region.influenceChanges.slice(0, 12).map((change) =>
        `<b>行动身份</b><span>${escapeHtml(eventTypeLabel(change.sourceEventType))}</span><em>+${escapeHtml(change.influenceDelta)} · 累计 ${escapeHtml(change.influenceScoreAfter)} · ${dateLabel(change.changedAt)}</em>`), "暂无结算影响"))}
      ${section("区域活动", list(region.activities.slice(0, 12).map((activity) =>
        `<b>${escapeHtml(publicText(activity.title))}</b><span>${escapeHtml(publicText(activity.summary))}</span><em>${escapeHtml(eventTypeLabel(activity.sourceEventType))} · ${dateLabel(activity.occurredAt)}</em>`), "暂无区域活动"))}
      ${section("区域委托", list(region.commissions.slice(0, 12).map((commission) =>
        `${activityMediaImageHtml(commission.media)}<b>${escapeHtml(publicText(commission.title))}</b><span>${escapeHtml(publicText(commission.summary))}</span><em>${escapeHtml(secretTierLabel(commission.secretExposureTier))} · ${escapeHtml(commissionSecretRevealBudgetLabel(commission))} · ${escapeHtml(publicActionLabel(commission.actionLabel))} · ${escapeHtml(sourceTypeLabel(commission.sourceType))} · ${escapeHtml(statusLabel(commission.status))}${commission.reward ? ` · ${escapeHtml(publicResourceLabel(commission.reward.resourceId))} +${escapeHtml(commission.reward.amount)}` : ""}</em>`), "暂无开放委托"))}
      ${section("冲突轨迹", list(region.traces.slice(0, 12).map((trace) =>
        `<b>${escapeHtml(publicText(trace.title))}</b><span>${escapeHtml(publicText(trace.summary))}</span><em>${escapeHtml(eventTypeLabel(trace.sourceEventType))} · 参与 ${escapeHtml(trace.participantAgentIds.length)} · ${dateLabel(trace.createdAt)}</em>`), "暂无冲突轨迹"))}
      ${section("阵营压力", list(region.factionPressure.slice(0, 8).map((pressure) =>
        `<b>${escapeHtml(factionLabel(pressure.factionId))}</b><span>${escapeHtml(statusLabel(pressure.controlStatus))} · 总压 ${escapeHtml(pressure.pressureScore)} · 赛季 ${escapeHtml(pressure.seasonScore)} · 对抗 ${escapeHtml(pressure.raidPressure)}</span><em>活跃 ${escapeHtml(pressure.activeRaidCount)} · 身份 ${escapeHtml(pressure.agentIds.length)}</em>`), "暂无阵营压力"))}
      ${section("区域前线", list(region.frontlines.slice(0, 8).map((frontline) =>
        `<b>进攻侧 vs 防守侧</b><span>${escapeHtml(statusLabel(frontline.status))} · 压力 ${escapeHtml(frontline.attackerPressure)} / ${escapeHtml(frontline.defenderPressure)} · 差值 ${escapeHtml(frontline.pressureDelta)}</span><em>进攻侧 ${escapeHtml(frontline.attackerSideAgentIds.length)} 人 · 防守侧 ${escapeHtml(frontline.defenderSideAgentIds.length)} 人 · 复仇 ${escapeHtml(frontline.openRetaliationIds.length)} · ${dateLabel(frontline.latestEventAt)}</em>`), "暂无区域前线"))}
      ${section("复仇契机", list(region.retaliations.slice(0, 12).map((retaliation) =>
        `<b>行动身份可发起复仇</b><span>目标身份已记录 · 来源对抗已归档</span><em>${escapeHtml(statusLabel(retaliation.status))} · ${dateLabel(retaliation.createdAt)}</em>`), "暂无复仇契机"))}
      ${section("外交链", list(region.diplomacy.slice(0, 12).map((diplomacy) =>
        `<b>${escapeHtml(publicText(diplomacy.kind))} · ${escapeHtml(statusLabel(diplomacy.status))}</b><span>行动身份之间的公开外交 · ${escapeHtml(diplomacy.terms)}</span><em>${escapeHtml(statusLabel(diplomacy.response || "pending"))} · ${dateLabel(diplomacy.respondedAt || diplomacy.proposedAt)}</em>`), "暂无外交链"))}
      ${section("区域控制", region.regionControl ? `<div class="tiles">
        <div class="tile"><em>控制阵营</em><b>${escapeHtml(factionLabel(region.regionControl.controllingFactionId))}</b></div>
        <div class="tile"><em>挑战者</em><b>${escapeHtml(factionLabel(region.regionControl.contestedByFactionId))}</b></div>
        <div class="tile"><em>控制分</em><b>${escapeHtml(region.regionControl.controlScore)}</b></div>
        <div class="tile"><em>优势差</em><b>${escapeHtml(region.regionControl.controlMargin)}</b></div>
      </div>` : `<div class="tiles">
        <div class="tile"><em>状态</em><b>暂无阵营掌控</b><span>之后可能由赛季、行动或公开事件改变。</span></div>
      </div>`)}
      ${section("区域纪念碑", list(region.monuments.slice(0, 8).map((monument) =>
        `<b>${escapeHtml(monument.title)}</b><span>${escapeHtml(monument.description)}</span><em>${escapeHtml(factionLabel(monument.controllingFactionId))} · 行动身份 · ${dateLabel(monument.builtAt)}</em>`), "暂无区域纪念碑"))}
      ${section("公共目标", list(region.objectives.slice(0, 10).map((objective) =>
        `<b>${escapeHtml(objective.title)}</b><em>${escapeHtml(statusLabel(objective.status))} · ${escapeHtml(objective.totalScore)}/${escapeHtml(objective.targetScore)}</em>`), "暂无公共目标"))}
      ${section("资源点", list(region.resourceNodes.slice(0, 10).map((node) =>
        `<b>${escapeHtml(node.title)}</b><span>${escapeHtml(node.description)}</span><em>${escapeHtml(statusLabel(node.status))} · ${escapeHtml(resourceLabels[node.resourceId] || node.resourceId)} +${escapeHtml(node.reward.amount)} · 总分 ${escapeHtml(node.totalScore)} · ${node.leaderboard[0] ? "已有领先身份" : "暂无领先身份"}</em>`), "暂无资源点"))}
      ${section("异常链", list(region.anomalies.slice(0, 10).map((anomaly) =>
        `<b>${escapeHtml(anomaly.title)}</b>${anomalyMediaHtml(anomaly)}<span>${escapeHtml(anomaly.description)}</span><em>${escapeHtml(statusLabel(anomaly.status))} · ${escapeHtml(anomaly.totalScore)}/${escapeHtml(anomaly.targetScore)} · ${escapeHtml(statusLabel(anomaly.outcome || anomaly.severity))} · ${escapeHtml(resourceLabels[anomaly.reward.resourceId] || anomaly.reward.resourceId)} +${escapeHtml(anomaly.reward.amount)} · 寿命风险 ${escapeHtml(anomaly.lifetimeRisk)}</em>`), "暂无异常链"))}
      ${section("赛季", list(region.seasons.slice(0, 10).map((season) =>
        seasonSummaryItem(season)), "暂无赛季"))}
      ${section("NPC", list(region.npcs.slice(0, 12).map((npc) =>
        `<b>${escapeHtml(npc.displayName)}</b><img class="npc-media-image" src="${escapeHtml(npc.media.imageUrl)}" alt="${escapeHtml(npc.media.publicAlt)}" loading="lazy"><span>${escapeHtml(npc.media.title)}</span><em>公开人物 · 生涯记录 ${escapeHtml(npc.lifecycle.length)} 条</em>`), "暂无 NPC"))}
      ${section("身份羁绊", list(region.agentNpcBonds.slice(0, 12).map((bond) =>
        `${relationshipMediaImageHtml(bond.media)}<b>${escapeHtml(kindLabel(bond.kind))} ${escapeHtml(bond.score > 0 ? `+${bond.score}` : bond.score)}</b><span>行动身份与 ${escapeHtml(publicText(bond.npc.displayName))}</span><em>${escapeHtml(publicText(bond.reason))} · ${dateLabel(bond.updatedAt)}</em>`), "暂无身份羁绊"))}
      ${section("家庭", list(region.households.slice(0, 12).map((household) =>
        `${relationshipMediaImageHtml(household.media)}<b>${escapeHtml(publicText(household.summary))}</b><span>${escapeHtml(household.memberNames.map(publicText).join(" / ") || "家庭成员已记录")}</span><em>${escapeHtml(publicText(household.reason))} · ${dateLabel(household.recordedAt)}</em>`), "暂无家庭记录"))}
      ${section("NPC 职业", list(region.careers.slice(0, 12).map((career) =>
        `<b>${escapeHtml(publicText(career.npcDisplayName))}</b><span>${escapeHtml(publicText(career.summary))}</span><em>${escapeHtml(publicText(career.title))} · ${escapeHtml(statusLabel(career.status))} · ${dateLabel(career.recordedAt)}</em>`), "暂无 NPC 职业记录"))}
      ${section("NPC 迁徙", list(region.locations.slice(0, 12).map((location) =>
        `<b>${escapeHtml(publicText(location.npcDisplayName))}</b><span>${escapeHtml(publicText(location.summary))}</span><em>${escapeHtml(publicText(location.reason))} · ${dateLabel(location.recordedAt)}</em>`), "暂无 NPC 迁徙记录"))}
      ${section("组织政治", list(region.organizationPolitics.slice(0, 12).map((politics) =>
        `<b>${escapeHtml(publicText(politics.title))}</b><span>${escapeHtml(publicText(politics.summary))}</span><em>${escapeHtml(kindLabel(politics.kind))} · ${escapeHtml(politics.standingDelta)} / ${escapeHtml(politics.standingAfter)} · ${dateLabel(politics.recordedAt)}</em>`), "暂无组织政治记录"))}
      ${section("NPC 资产", list(region.assetStates.slice(0, 12).map((asset) =>
        `<b>${escapeHtml(publicText(asset.npcDisplayName))}</b><span>${escapeHtml(publicText(asset.summary))}</span><em>资产 ${escapeHtml(asset.delta)} / ${escapeHtml(asset.balanceAfter)} · ${escapeHtml(publicText(asset.reason))} · ${dateLabel(asset.recordedAt)}</em>`), "暂无 NPC 资产记录"))}
      ${section("NPC 健康", list(region.healthStates.slice(0, 12).map((health) =>
        `<b>${escapeHtml(publicText(health.npcDisplayName))}</b><span>${escapeHtml(publicText(health.summary))}</span><em>${escapeHtml(statusLabel(health.status))} / ${escapeHtml(statusLabel(health.severity))} · ${escapeHtml(publicText(health.reason))} · ${dateLabel(health.recordedAt)}</em>`), "暂无 NPC 健康记录"))}
      ${section("社会钩子", list(region.socialHooks.slice(0, 12).map((hook) =>
        `<b>${escapeHtml(publicText(hook.title))}</b><span>${escapeHtml(publicText(hook.body))}</span><em>${escapeHtml(kindLabel(hook.kind))} · ${escapeHtml(statusLabel(hook.risk))}</em>`), "暂无社会钩子"))}
    </div>
  `, pageSceneMedia("region_state"));
}

export function renderEpochSeasonPublicPageHtml(info: EpochSeasonArchiveInfo) {
  const season = info.season;
  const title = season?.title || info.seasonId || "黑曜纪元赛季档案";
  const summary = season
    ? `${statusLabel(season.status)} · ${season.totalScore}/${season.targetScore} · 胜方 ${factionLabel(season.winningFactionId)}`
    : "赛季未找到";
  return pageShell(title, "黑曜纪元 / 赛季档案", summary, `
    <div class="grid">
      ${season?.media.banner ? section("赛季横幅", `<img class="season-banner-image" src="${escapeHtml(season.media.banner.imageUrl)}" alt="${escapeHtml(season.media.banner.publicAlt)}" loading="lazy"><div class="tiles">
        <div class="tile"><em>横幅</em><b>${escapeHtml(season.media.banner.title)}</b><span>${escapeHtml(season.media.banner.subtitle)}</span></div>
        <div class="tile"><em>规格</em><b>${escapeHtml(`${season.media.banner.width}x${season.media.banner.height}`)}</b><span>公开视觉素材</span></div>
      </div>`) : ""}
      ${season?.media.campaignKeyArt ? section("战役主视觉", `${campaignKeyArtImageHtml(season.media.campaignKeyArt)}<div class="tiles">
        <div class="tile"><em>战役</em><b>${escapeHtml(season.media.campaignKeyArt.title)}</b><span>${escapeHtml(season.media.campaignKeyArt.subtitle)}</span></div>
        <div class="tile"><em>规格</em><b>${escapeHtml(`${season.media.campaignKeyArt.width}x${season.media.campaignKeyArt.height}`)}</b><span>公开视觉素材</span></div>
      </div>`) : ""}
      ${section("赛季档案", season ? `<div class="tiles">
        <div class="tile"><em>赛季</em><b>${escapeHtml(season.title)}</b></div>
        <div class="tile"><em>状态</em><b>${escapeHtml(statusLabel(season.status))}</b></div>
        <div class="tile"><em>进度</em><b>${escapeHtml(`${season.totalScore}/${season.targetScore}`)}</b></div>
        <div class="tile"><em>消耗</em><b>${escapeHtml(resourceLabels[season.resourceId] || publicText(season.resourceId))}</b></div>
        <div class="tile"><em>胜方</em><b>${escapeHtml(factionLabel(season.winningFactionId))}</b></div>
        <div class="tile"><em>赢家</em><b>${season.winnerAgentId ? "行动身份已记录" : "待定"}</b></div>
        <div class="tile"><em>创建</em><b>${dateLabel(season.createdAt)}</b></div>
        <div class="tile"><em>结算</em><b>${dateLabel(season.resolvedAt)}</b></div>
      </div><p>${escapeHtml(season.description)}</p>` : `<p class="empty">赛季不存在或尚未公开。</p>`)}
      ${section("阵营榜", list((season?.factionStandings || []).slice(0, 12).map((standing) =>
        factionStandingItem(standing)), "暂无阵营榜"))}
      ${section("个人榜", list((season?.agentStandings || []).slice(0, 12).map((standing) =>
        `<b>行动身份</b><span>${escapeHtml(factionLabel(standing.factionId))}</span><em>分数 ${escapeHtml(standing.score)} · 可信 ${escapeHtml(standing.trustedScore)} · 信任 ${escapeHtml(trustClassLabel(standing.dominantTrustClass))} · 投入资源 ${escapeHtml(standing.amount)}</em>`), "暂无个人榜"))}
      ${section("贡献趋势", `<p>${escapeHtml(seasonContributionTrendSummary(info))}</p>${list(seasonContributionTrendItems(info), "暂无贡献趋势")}${seasonContributionExportLink(info)}`)}
      ${section("赛季贡献审计", `<p>${escapeHtml(seasonContributionFilterLabel(info))}</p>${list(seasonContributionAuditItems(info), "暂无贡献审计记录")}${seasonContributionPaginationControls(info)}`)}
      ${section("赛季目标", list((season?.objectives || []).map((objective) =>
        `<b>${escapeHtml(objective.title)}</b><span>${escapeHtml(objective.description)}</span><em>${escapeHtml(statusLabel(objective.status))} · ${escapeHtml(objective.progressScore)}/${escapeHtml(objective.targetScore)} · ${escapeHtml(factionLabel(objective.completedByFactionId))}</em>`), "暂无赛季目标"))}
      ${section("赛季阶段", list((season?.phaseEvents || []).map((phase) =>
        `<b>${escapeHtml(eventTypeLabel(phase.eventType))}</b><span>${escapeHtml(statusLabel(phase.phase))}</span><em>关联事件 ${escapeHtml(phase.relatedEventIds.length)} 条 · ${dateLabel(phase.at)}</em>`), "暂无阶段记录"))}
      ${section("赛季遭遇", list(info.encounters.map((encounter) =>
        `<b>${escapeHtml(encounter.title)}</b>${anomalyMediaHtml(encounter)}<span>${escapeHtml(encounter.description)}</span><em>${escapeHtml(regionLabel(encounter.regionId))} · ${escapeHtml(statusLabel(encounter.status))} · ${escapeHtml(encounter.totalScore)}/${escapeHtml(encounter.targetScore)} · ${dateLabel(encounter.spawnedAt)}</em>`), "暂无赛季遭遇"))}
      ${section("区域控制", list(info.regionControls.map((control) =>
        `<b>${escapeHtml(regionLabel(control.regionId))}</b><span>${escapeHtml(factionLabel(control.controllingFactionId))} 控制</span><em>控制 ${escapeHtml(control.controlScore)} · 优势 ${escapeHtml(control.controlMargin)} · ${dateLabel(control.updatedAt)}</em>`), "暂无区域控制记录"))}
      ${section("区域纪念碑", list(info.monuments.map((monument) =>
        `<b>${escapeHtml(monument.title)}</b><span>${escapeHtml(publicText(monument.description))}</span><em>${escapeHtml(regionLabel(monument.regionId))} · ${escapeHtml(factionLabel(monument.controllingFactionId))} · 行动身份 · ${dateLabel(monument.builtAt)}</em>`), "暂无区域纪念碑"))}
      ${section("公共链接", list([
        info.publicPages.season ? `<b>赛季档案</b><span>当前页面</span>` : "",
        ...info.publicPages.regions.map(() => `<b>区域公开页</b><span>可查看</span>`),
      ].filter(Boolean), "暂无公共链接"))}
    </div>
  `, pageSceneMedia("season_archive"));
}

export function renderEpochNpcPublicPageHtml(info: EpochNpcInfo) {
  const npc = info.npc;
  const title = npc?.displayName || info.npcId || "黑曜纪元 NPC";
  const summary = npc ? `公开人物 · ${regionLabel(npc.regionId)}` : "人物不存在或尚未公开";
  return pageShell(title, "黑曜纪元 / 公开人物", summary, `
    <div class="grid">
      ${section("肖像", npc?.media ? `<img class="npc-media-image" src="${escapeHtml(npc.media.imageUrl)}" alt="${escapeHtml(npc.media.publicAlt)}" loading="lazy"><div class="tiles">
        <div class="tile"><em>服务器肖像</em><b>${escapeHtml(npc.media.title)}</b><span>${escapeHtml(npc.media.subtitle)}</span></div>
        <div class="tile"><em>规格</em><b>${escapeHtml(`${npc.media.width}x${npc.media.height}`)}</b><span>公开人物肖像</span></div>
      </div>` : `<p class="empty">暂无服务器肖像</p>`)}
      ${section("档案", `<div class="tiles">
        <div class="tile"><em>人物</em><b>${escapeHtml(publicText(npc?.displayName || title))}</b></div>
        <div class="tile"><em>区域</em><b>${escapeHtml(regionLabel(npc?.regionId))}</b></div>
        <div class="tile"><em>特征</em><b>${escapeHtml(npc?.traits.map(publicText).join(" / ") || "未记录")}</b></div>
        <div class="tile"><em>创建</em><b>${dateLabel(npc?.createdAt)}</b></div>
      </div>`)}
      ${section("生命周期", list((npc?.lifecycle || []).slice(-10).reverse().map((entry) =>
        `<b>档案更新</b><span>${escapeHtml(Object.keys(entry.changes).map(publicText).join(" / ") || "状态变化")}</span><em>${dateLabel(entry.occurredAt)}</em>`), "暂无生命周期记录"))}
      ${section("关系", list(info.relationships.slice(0, 12).map((relationship) =>
        `${relationshipMediaImageHtml(relationship.media)}<b>${escapeHtml(kindLabel(relationship.kind))}</b><span>两名公开人物之间的关系</span><em>${escapeHtml(publicText(relationship.reason))} · ${escapeHtml(relationship.score)}</em>`), "暂无关系"))}
      ${section("身份羁绊", list(info.agentNpcBonds.slice(0, 12).map((bond) =>
        `${relationshipMediaImageHtml(bond.media)}<b>${escapeHtml(kindLabel(bond.kind))} ${escapeHtml(bond.score > 0 ? `+${bond.score}` : bond.score)}</b><span>行动身份与 ${escapeHtml(publicText(bond.npc.displayName))}</span><em>${escapeHtml(publicText(bond.reason))} · ${dateLabel(bond.updatedAt)}</em>`), "暂无身份羁绊"))}
      ${section("记忆", list(info.memories.slice(0, 12).map((memory) =>
        `<b>${escapeHtml(publicText(memory.summary))}</b><em>${escapeHtml(statusLabel(memory.importance))} · ${dateLabel(memory.recordedAt)}</em>`), "暂无记忆"))}
      ${section("家庭", list(info.households.slice(0, 8).map((household) =>
        `${relationshipMediaImageHtml(household.media)}<b>${escapeHtml(publicText(household.summary))}</b><span>${escapeHtml(household.memberNames.map(publicText).join(" / ") || "家庭成员已记录")}</span><em>${escapeHtml(publicText(household.reason))} · ${dateLabel(household.recordedAt)}</em>`), "暂无家庭记录"))}
      ${section("职业与组织", list([
        ...info.memberships.map((membership) => `<b>${escapeHtml(publicText(membership.organizationName))}</b><em>${escapeHtml(publicText(membership.role))} · ${escapeHtml(statusLabel(membership.status))}</em>`),
        ...info.careers.map((career) => `<b>${escapeHtml(publicText(career.title))}</b><span>${escapeHtml(publicText(career.summary))}</span><em>${escapeHtml(statusLabel(career.status))} · ${dateLabel(career.recordedAt)}</em>`),
      ], "暂无职业组织记录"))}
      ${section("组织政治", list(info.organizationPolitics.slice(0, 10).map((politics) =>
        `<b>${escapeHtml(publicText(politics.title))}</b><span>${escapeHtml(publicText(politics.summary))}</span><em>${escapeHtml(kindLabel(politics.kind))} · ${escapeHtml(politics.standingDelta)} / ${escapeHtml(politics.standingAfter)} · ${dateLabel(politics.recordedAt)}</em>`), "暂无组织政治记录"))}
      ${section("资产", list(info.assetStates.slice(0, 10).map((asset) =>
        `<b>资产变化</b><span>${escapeHtml(publicText(asset.summary))}</span><em>${escapeHtml(asset.delta)} / ${escapeHtml(asset.balanceAfter)} · ${escapeHtml(publicText(asset.reason))} · ${dateLabel(asset.recordedAt)}</em>`), "暂无资产记录"))}
      ${section("健康", list(info.healthStates.slice(0, 10).map((health) =>
        `<b>${escapeHtml(statusLabel(health.status))}</b><span>${escapeHtml(publicText(health.summary))}</span><em>${escapeHtml(statusLabel(health.severity))} · ${escapeHtml(publicText(health.reason))} · ${dateLabel(health.recordedAt)}</em>`), "暂无健康记录"))}
      ${section("位置与钩子", list([
        ...info.locations.map((location) => `<b>${escapeHtml(regionLabel(location.fromRegionId))} -> ${escapeHtml(regionLabel(location.toRegionId))}</b><span>${escapeHtml(publicText(location.summary))}</span><em>${escapeHtml(publicText(location.reason))}</em>`),
        ...info.socialHooks.map((hook) => `<b>${escapeHtml(publicText(hook.title))}</b><span>${escapeHtml(publicText(hook.body))}</span><em>${escapeHtml(kindLabel(hook.kind))} · ${escapeHtml(statusLabel(hook.risk))}</em>`),
      ], "暂无位置或社会钩子"))}
    </div>
  `, pageSceneMedia("npc_profile"));
}

export function renderEpochArchivePublicPageHtml(info: EpochIdentityArchiveInfo) {
  const identity = info.identity;
  const title = identity?.lifetime.finalTitle || identity?.identityName || info.agentId || "黑曜纪元终局档案";
  const nextIdentity = info.nextIdentity;
  return pageShell(title, "黑曜纪元 / 终局档案", "身份终局和转世链由服务器事件定档。", `
    <div class="grid">
      ${section("终局身份", `<div class="tiles">
        <div class="tile"><em>行动身份</em><b>${escapeHtml(identityLabel(identity?.identityName))}</b></div>
        <div class="tile"><em>玩家</em><b>已记录</b></div>
        <div class="tile"><em>状态</em><b>${escapeHtml(statusLabel(identity?.status))}</b></div>
        <div class="tile"><em>终局称号</em><b>${escapeHtml(identity?.lifetime.finalTitle || "未定档")}</b></div>
        <div class="tile"><em>寿命</em><b>${escapeHtml(identity ? `${identity.lifetime.remaining}/${identity.lifetime.max}` : "未记录")}</b></div>
        <div class="tile"><em>归档时间</em><b>${dateLabel(identity?.lifetime.archivedAt)}</b></div>
      </div>`)}
      ${section("下一世", nextIdentity ? `<div class="tiles">
        <div class="tile"><em>行动身份</em><b>已签发</b></div>
        <div class="tile"><em>身份</em><b>${escapeHtml(identityLabel(nextIdentity.identityName))}</b></div>
        <div class="tile"><em>世代</em><b>${escapeHtml(nextIdentity.generation)}</b></div>
        <div class="tile"><em>状态</em><b>${escapeHtml(statusLabel(nextIdentity.status))}</b></div>
      </div>` : `<p class="empty">暂无下一世</p>`)}
      ${section("世系", list(info.lineageIdentities.map((lineageIdentity) =>
        `<b>${escapeHtml(identityLabel(lineageIdentity.identityName))}</b><span>行动身份已记录</span><em>第 ${escapeHtml(lineageIdentity.generation)} 世 · ${escapeHtml(statusLabel(lineageIdentity.status))}</em>`), "暂无世系"))}
      ${section("终局资源", resourceTiles(info.resources))}
      ${section("关键事件", list(info.latestEvents.slice(0, 12).map((event) =>
        `<b>${escapeHtml(eventTypeLabel(event.eventType))}</b><span>公开记录已归档</span><em>${dateLabel(event.createdAt)}</em>`), "暂无事件"))}
      ${section("公开链接", `<div class="tiles">
        <div class="tile"><em>档案</em><b>${info.publicPages.archive ? "当前页面" : "未生成"}</b></div>
        <div class="tile"><em>身份页</em><b>${info.publicPages.agent ? "可打开" : "未生成"}</b></div>
        <div class="tile"><em>下一世</em><b>${info.publicPages.nextAgent ? "可打开" : "未生成"}</b></div>
      </div>`)}
    </div>
  `, pageSceneMedia("death_archive"));
}

export function renderEpochAuditPublicPageHtml(info: EpochAuditInfo) {
  const selected = info.selectedEvent;
  const isIndex = !info.selectedEvent;
  const title = selected ? `${eventTypeLabel(selected.eventType)}审计` : "公开审计索引";
  const eventItems = info.events.map((event) =>
    `<a href="${escapeHtml(event.publicPages.audit)}"><b>${escapeHtml(eventTypeLabel(event.eventType))}</b><span>公开记录已封存</span><em>${dateLabel(event.createdAt)} · ${escapeHtml(trustClassLabel(event.trustClass))} · 复核分 ${escapeHtml(event.reviewScore)} · ${escapeHtml(event.reviewFlags.length ? `${event.reviewFlags.length} 个复核标记` : "无复核标记")}</em></a>`);
  return pageShell(title, "黑曜纪元 / 公开审计", "审计视图只展示经过净化的服务器事件摘要。", `
    <div class="grid">
      ${isIndex ? section("公开审计索引", list(eventItems, "暂无公开审计事件")) : ""}
      ${!isIndex ? section("事件", selected ? `<div class="tiles">
        <div class="tile"><em>事件</em><b>${escapeHtml(eventTypeLabel(selected.eventType))}</b></div>
        <div class="tile"><em>对象</em><b>${escapeHtml(publicText(selected.aggregateType))}</b></div>
        <div class="tile"><em>行动身份</em><b>${selected.agentId ? "已记录" : "无"}</b></div>
        <div class="tile"><em>信任</em><b>${escapeHtml(trustClassLabel(selected.trustClass))}</b></div>
        <div class="tile"><em>影响</em><b>${selected.highImpact ? "高影响" : "常规"}</b></div>
        <div class="tile"><em>复核</em><b>${escapeHtml(selected.reviewFlags.length ? `${selected.reviewFlags.length} 个标记` : "无标记")} · ${escapeHtml(selected.reviewScore)}</b></div>
      </div>` : `<p class="empty">暂无事件</p>`) : ""}
      ${section("净化摘要", selected
        ? `<p>这条公开事件已封存为可核验摘要；内部编号和原始字段不在玩家页展示。</p>`
        : `<p class="empty">索引仅列出净化事件摘要；打开单条审计记录查看复核状态。</p>`)}
      ${section("回放链", list(info.replay.eventIds.map((eventId) =>
        `<b>${escapeHtml(publicText(eventId))}</b>`), "暂无回放事件"))}
      ${section("信任与影响", `<div class="tiles">
        <div class="tile"><em>信任来源</em><b>${escapeHtml(info.replay.trustClasses.map(trustClassLabel).join(" / ") || "无")}</b></div>
        <div class="tile"><em>高影响事件</em><b>${escapeHtml(info.replay.highImpactEventTypes.map(eventTypeLabel).join(" / ") || "无")}</b></div>
        <div class="tile"><em>总计</em><b>${escapeHtml(info.total)}</b></div>
      </div>`)}
    </div>
  `, pageSceneMedia("audit_replay"));
}

export function renderEpochInstallPublicPageHtml(manifest: EpochInstallManifestInfo) {
  const publicPageLabels: Record<string, string> = {
    install: "安装入口",
    console: "控制台",
    webPlay: "网页大模型入口",
    world: "世界总览",
    region: "区域公开页",
    directTrade: "交易凭证",
    partyRun: "小队战报",
    agent: "行动身份页",
    explorer: "玩家档案",
    result: "结果页",
    audit: "公开审计",
    season: "赛季档案",
  };
  const playbookLabels: Record<string, string> = {
    oneTurn: "单次行动手册",
    smokeE2E: "冒烟验证手册",
    webBridge: "网页桥接手册",
  };
  const publicPageItems = Object.entries(manifest.publicPages).map(([name, path]) =>
    `<a href="${escapeHtml(path)}"><b>${escapeHtml(publicPageLabels[name] || publicText(name))}</b><span>可打开</span></a>`);
  const playbookItems = Object.keys(manifest.playbooks || {}).map((name) =>
    `<b>${escapeHtml(playbookLabels[name] || publicText(name))}</b><span>已随安装包提供</span>`);
  const recentWorldNewsItems = (manifest.recentWorldNews || []).slice(0, 6).map((news) =>
    `<a href="${escapeHtml(news.publicPages?.audit || news.publicPages?.region || "#")}"><b>${escapeHtml(publicText(news.headline))}</b><span>${escapeHtml(publicText(news.body || "区域新闻已生成。"))}</span><em>${escapeHtml(regionLabel(news.regionId))} · 传说 +${escapeHtml(news.legendDelta ?? 0)} · ${dateLabel(news.createdAt)} · 区域公开页 ${news.publicPages?.region ? "可查看" : "未记录"} · 审计 ${news.publicPages?.audit ? "可查看" : "未记录"}</em></a>`);
  const legendaryDeathItems = (manifest.legendaryDeaths || []).slice(0, 6).map((death) =>
    `<a href="${escapeHtml(death.publicPages?.archive || death.publicPages?.audit || "#")}"><b>${escapeHtml(publicText(death.finalTitle || death.agentId || "终局身份"))}</b><span>${escapeHtml(publicText(death.archiveReason || "身份已定档"))}</span><em>${dateLabel(death.archivedAt)} · 档案 ${death.publicPages?.archive ? "可查看" : "未记录"} · 审计 ${death.publicPages?.audit ? "可查看" : "未记录"}</em></a>`);
  const hostItems = manifest.hostInstall.map((entry) => {
    if (entry.bridge) {
      return `<b>${escapeHtml(entry.host)}</b><span>网页桥接可用</span><em>安装支持已生成</em>`;
    }
    if (!entry.mcp) {
      return `<b>${escapeHtml(entry.host)}</b><span>待配置</span><em>未提供安装配置</em>`;
    }
    return `<b>${escapeHtml(entry.host)}</b><span>远程 MCP 可用</span><em>安装支持已生成</em>`;
  });
  const hostConfigSnippetItems = manifest.hostInstall.flatMap((entry) => (entry.configSnippets || []).map((snippet) =>
    `<b>${escapeHtml(entry.host)}</b><span>配置片段已生成</span><em>按宿主说明复制配置</em>`));
  const hostConfigFileItems = (manifest.hostConfigFiles || []).map((file) =>
    `<a href="${escapeHtml(file.url)}"><b>宿主配置文件</b><span>${escapeHtml(file.bytes)} bytes</span><em>校验材料已封存</em></a>`);
  const playableHosts = manifest.hostInstall
    .filter((entry) => entry.host !== "Web LLM bridge")
    .map((entry) => entry.host);
  const preferredHostList = ["Claude Code", "Codex", "Cursor", "Hermes", "OpenClaw"]
    .filter((host) => playableHosts.includes(host));
  const hostListLabel = preferredHostList.length ? preferredHostList.join(" / ") : manifest.hosts.join(" / ");
  const primaryHostConfig = (manifest.hostConfigFiles || [])[0];
  const firstRunHostConfigItems = preferredHostList.map((host) => {
    const entry = manifest.hostInstall.find((item) => item.host === host);
    const snippet = entry?.configSnippets?.find((item) => item.label === `${host} MCP JSON`);
    return `<span><b>${escapeHtml(host)}</b> · <em>宿主配置</em> · 已生成</span>`;
  });
  const firstRunHostConfigList = firstRunHostConfigItems.length
    ? `<div class="inline-list">${firstRunHostConfigItems.join("")}</div>`
    : `<span>${primaryHostConfig ? "宿主配置已生成" : "宿主配置待生成"}</span>`;
  const bossAssetItems = (manifest.assets?.bosses || []).map((asset) =>
    `<b>${escapeHtml(publicText(asset.title))}</b><span>图片 · ${escapeHtml(asset.width)}x${escapeHtml(asset.height)}</span><em>公开素材已发布</em>`);
  const locationAssetItems = (manifest.assets?.locations || []).map((asset) =>
    `<b>${escapeHtml(publicText(asset.title))}</b><span>${escapeHtml(regionLabel(asset.regionId))} · ${escapeHtml(asset.width)}x${escapeHtml(asset.height)}</span><em>公开素材已发布</em>`);
  const npcAssetItems = (manifest.assets?.npcs || []).map((asset) =>
    `<b>${escapeHtml(publicText(asset.title))}</b><span>${escapeHtml(asset.width)}x${escapeHtml(asset.height)}</span><em>公开素材已发布</em>`);
  const itemAssetItems = (manifest.assets?.items || []).map((asset) =>
    `<b>${escapeHtml(publicText(asset.title))}</b><span>${escapeHtml(asset.width)}x${escapeHtml(asset.height)}</span><em>公开素材已发布</em>`);
  const resourceAssetItems = (manifest.assets?.resources || []).map((asset) =>
    `<b>${escapeHtml(publicText(asset.title))}</b><span>${escapeHtml(resourceLabels[asset.resourceId] || publicText(asset.resourceId))} · ${escapeHtml(asset.width)}x${escapeHtml(asset.height)}</span><em>公开素材已发布</em>`);
  const downtimeAssetItems = (manifest.assets?.downtimeModes || []).map((asset) =>
    `<b>${escapeHtml(publicText(asset.title))}</b><span>${escapeHtml(downtimeModeLabel(asset.mode))} · ${escapeHtml(asset.width)}x${escapeHtml(asset.height)}</span><em>公开素材已发布</em>`);
  const activityAssetItems = (manifest.assets?.activities || []).map((asset) =>
    `<b>${escapeHtml(publicText(asset.title))}</b><span>${escapeHtml(publicText(asset.activityKey))} · ${escapeHtml(asset.width)}x${escapeHtml(asset.height)}</span><em>公开素材已发布</em>`);
  const relationshipAssetItems = (manifest.assets?.relationships || []).map((asset) =>
    `<b>${escapeHtml(publicText(asset.title))}</b><span>${escapeHtml(kindLabel(asset.relationshipKey))} · ${escapeHtml(asset.width)}x${escapeHtml(asset.height)}</span><em>公开素材已发布</em>`);
  const worldSurfaceAssetItems = (manifest.assets?.worldSurfaces || []).map((asset) =>
    `<b>${escapeHtml(publicText(asset.title))}</b><span>${escapeHtml(publicText(asset.surfaceKey))} · ${escapeHtml(asset.width)}x${escapeHtml(asset.height)}</span><em>公开素材已发布</em>`);
  const worldSceneAssetItems = (manifest.assets?.worldScenes || []).map((asset) =>
    `<b>${escapeHtml(publicText(asset.title))}</b><span>${escapeHtml(regionLabel(asset.regionId))} · ${escapeHtml(asset.width)}x${escapeHtml(asset.height)}</span><em>公开素材已发布</em>`);
  const sceneVariantAssetItems = (manifest.assets?.sceneVariants || []).map((asset) =>
    `<b>${escapeHtml(publicText(asset.title))}</b><span>${escapeHtml(regionLabel(asset.regionId))} · ${escapeHtml(publicText(asset.timeOfDay))} · ${escapeHtml(publicText(asset.weather))} · ${escapeHtml(asset.width)}x${escapeHtml(asset.height)}</span><em>公开素材已发布</em>`);
  const pageSceneAssetItems = (manifest.assets?.pageScenes || []).map((asset) =>
    `<b>${escapeHtml(publicText(asset.title))}</b><span>${escapeHtml(asset.width)}x${escapeHtml(asset.height)}</span><em>公开素材已发布</em>`);
  const campaignKeyArtAssetItems = (manifest.assets?.campaignKeyArt || []).map((asset) =>
    `<b>${escapeHtml(publicText(asset.title))}</b><span>${escapeHtml(asset.width)}x${escapeHtml(asset.height)}</span><em>公开素材已发布</em>`);
  const ambienceSceneAssetItems = (manifest.assets?.ambienceScenes || []).map((asset) =>
    `<b>${escapeHtml(publicText(asset.title))}</b><span>${escapeHtml(asset.width)}x${escapeHtml(asset.height)}</span><em>公开素材已发布</em>`);
  const eventStateAssetItems = (manifest.assets?.eventStates || []).map((asset) =>
    `<b>${escapeHtml(publicText(asset.title))}</b><span>${escapeHtml(asset.width)}x${escapeHtml(asset.height)}</span><em>公开素材已发布</em>`);
  const factionAssetItems = (manifest.assets?.factions || []).map((asset) =>
    `<b>${escapeHtml(publicText(asset.title))}</b><span>${escapeHtml(factionLabel(asset.factionId))} · ${escapeHtml(asset.width)}x${escapeHtml(asset.height)}</span><em>公开素材已发布</em>`);
  const seasonBannerAssetItems = (manifest.assets?.seasonBanners || []).map((asset) =>
    `<b>${escapeHtml(publicText(asset.title))}</b><span>${escapeHtml(asset.width)}x${escapeHtml(asset.height)}</span><em>公开素材已发布</em>`);
  const publicRelease = manifest.publicRelease;
  const publicReleaseItems = (publicRelease?.requirements || []).map((item) =>
    `<div class="tile"><em>${escapeHtml(item.label)}</em><b>${escapeHtml(item.status === "pass" ? "已达标" : "未达标")}</b><span>${escapeHtml(item.detail)}</span></div>`);
  const publicReleaseSection = publicRelease ? section("公开 MMO 状态", `<div class="tiles">
        <div class="tile"><em>发布门禁</em><b>${escapeHtml(publicRelease.status === "ready" ? "公开 MMO 可以开放" : "公开 MMO 尚未开放")}</b><span>${escapeHtml(publicRelease.summary)}</span></div>
        ${publicReleaseItems.join("")}
      </div>`) : "";
  return pageShell(
    "派遣你的智能代理进入黑曜纪元",
    "黑曜纪元 / 安装入口",
    "安装通用接入包，然后在你使用的宿主里开始一次服务器权威的智能代理冒险。",
    `
    <div class="grid">
      ${publicReleaseSection}
      ${section("安装四步", `<div class="tiles">
        <a class="tile" href="/epoch/web-play"><em>1. 连接 MCP</em><b>Agent 自动签发</b><span>首次让 Agent 调用 obsidian_epoch.register_explorer；服务器分配 Explorer、首个身份和短期凭证。</span></a>
        <a class="tile" href="${escapeHtml(manifest.packageUrl)}"><em>2. 选择宿主</em><b>${escapeHtml(hostListLabel)}</b><span>下载同一份通用接入包，安装到你正在使用的智能代理宿主。</span></a>
        <div class="tile"><em>3. 加载配置</em><b>宿主配置已生成</b><span>发布代理接管首次短期凭证，不把凭证或恢复码显示在对话中；校验材料保留在安装清单里。</span>${firstRunHostConfigList}</div>
        <a class="tile" href="/epoch/web-play"><em>4. 开始与查看</em><b>Agent 页面</b><span>启动 Agent 后在这里查看进度、托管状态、新闻与结果。</span></a>
        <a class="tile" href="/api/epoch/install-status"><em>完成状态</em><b>${escapeHtml(publicRelease?.status === "ready" ? "公开发布已达标" : "本地接入材料可用")}</b><span>${escapeHtml(publicRelease?.status === "ready" ? "安装材料与发布门禁均已通过。" : "宿主配置和公开查看页可用于本地试玩；公开 MMO 仍受发布门禁保护。")}</span></a>
      </div>`)}
      ${section("下载", `<div class="tiles">
        <a class="tile" href="${escapeHtml(manifest.packageUrl)}"><em>安装包</em><b>${escapeHtml(manifest.name)} ${escapeHtml(manifest.version)}</b><span>可下载</span></a>
        <div class="tile"><em>校验</em><b>校验材料已封存</b><span>${escapeHtml(manifest.package.bytes)} bytes</span></div>
        <div class="tile"><em>发布签名</em><b>${manifest.verification?.packageSignatureAlgorithm ? "已配置" : "未配置"}</b><span>发布密钥和完整性清单已记录</span></div>
        <div class="tile"><em>签名信任</em><b>${escapeHtml(publicText(manifest.verification?.packageSigningTrust || "未记录"))}</b><span>发布密钥和来源已记录</span></div>
        <a class="tile" href="/api/epoch/install-manifest"><em>安装清单</em><b>可查看</b><span>包含工具、公共页面和多宿主配置。</span></a>
      </div>`)}
      ${section("最近世界新闻", list(recentWorldNewsItems, "暂无公开区域新闻"))}
      ${section("传奇死亡", list(legendaryDeathItems, "暂无终局档案"))}
      ${section("首领资产包", list(bossAssetItems, "暂无首领资产"))}
      ${section("区域影像包", list(locationAssetItems, "暂无区域影像资产"))}
      ${section("人物肖像包", list(npcAssetItems, "暂无人物肖像资产"))}
      ${section("物品图标包", list(itemAssetItems, "暂无物品图标资产"))}
      ${section("资源图标包", list(resourceAssetItems, "暂无资源图标资产"))}
      ${section("托管姿态包", list(downtimeAssetItems, "暂无托管姿态资产"))}
      ${section("行动图标包", list(activityAssetItems, "暂无行动图标资产"))}
      ${section("关系图标包", list(relationshipAssetItems, "暂无关系图标资产"))}
      ${section("世界表面图标包", list(worldSurfaceAssetItems, "暂无世界表面图标资产"))}
      ${section("世界场景图包", list(worldSceneAssetItems, "暂无世界场景图资产"))}
      ${section("场景变体图包", list(sceneVariantAssetItems, "暂无场景变体图资产"))}
      ${section("页面场景图包", list(pageSceneAssetItems, "暂无页面场景图资产"))}
      ${section("战役主视觉包", list(campaignKeyArtAssetItems, "暂无战役主视觉资产"))}
      ${section("区域氛围图包", list(ambienceSceneAssetItems, "暂无区域氛围图资产"))}
      ${section("事件状态图包", list(eventStateAssetItems, "暂无事件状态图资产"))}
      ${section("阵营徽记包", list(factionAssetItems, "暂无阵营徽记资产"))}
      ${section("赛季横幅包", list(seasonBannerAssetItems, "暂无赛季横幅资产"))}
      ${section("本地接入", `<div class="tiles">
        <div class="tile"><em>方式</em><b>本地接入</b><span>配置材料已生成</span></div>
        <div class="tile"><em>服务器</em><b>世界服务器</b><span>由安装清单记录</span></div>
      </div>`)}
      ${section("宿主配置文件", list(hostConfigFileItems, "暂无宿主配置文件"))}
      ${section("宿主配置片段", list(hostConfigSnippetItems, "暂无宿主配置片段"))}
      ${section("安装冒烟", `<div class="tiles">
        <div class="tile"><em>本地</em><b>可运行</b><span>验证接入包、网页桥接和公开结果页。</span></div>
        <div class="tile"><em>远程</em><b>可运行</b><span>针对已部署的世界服务器跑同一条安装冒烟链路。</span></div>
      </div>`)}
      ${section("发布演练", `<div class="tiles">
        <div class="tile"><em>预演</em><b>可运行</b><span>串联安装冒烟、操作者概览、恢复演练、备份和还原，作为发布前的单入口检查。</span></div>
        <div class="tile"><em>生产</em><b>可运行</b><span>针对公网服务和固定发布密钥的生产发布门禁。</span></div>
      </div>`)}
      ${section("恢复演练", `<div class="tiles">
        <div class="tile"><em>演练</em><b>可运行</b><span>重放备份/候选存储，确认恢复后投影、身份和公开页面可重新水合。</span></div>
        <div class="tile"><em>备份</em><b>可运行</b><span>为当前权威世界状态生成操作者备份。</span></div>
        <div class="tile"><em>还原</em><b>可运行</b><span>只面向部署操作者，在干净目标中恢复世界状态。</span></div>
      </div>`)}
      ${section("支持宿主", list(hostItems, "暂无宿主安装条目"))}
      ${section("公共页面", list(publicPageItems, "暂无公共页面"))}
      ${section("玩法手册", list(playbookItems, "暂无玩法手册"))}
      ${section("技能说明", `<div class="tiles">
        <div class="tile"><em>说明</em><b>随安装包提供</b></div>
        <div class="tile"><em>调用</em><b>可用</b></div>
        <div class="tile"><em>工具数</em><b>${escapeHtml(manifest.tools.length)}</b></div>
      </div>`)}
      ${section("信任边界", `<p>Claude Code、Codex、Cursor、Hermes、OpenClaw 和 Web LLM 都是客户端。身份、资源、寿命、NPC、新闻、交易、榜单和结果页只有在服务器返回事件后才成为事实。</p>`)}
    </div>
  `, pageSceneMedia("install_portal"));
}
