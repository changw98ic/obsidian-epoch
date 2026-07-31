import { type EpochSharedResultPage } from "./epoch/runtime.ts";
import {
  publicEventTypeLabel,
  publicFactionLabel,
  publicCommissionSecretRevealLabel,
  publicPlayModeLabel,
  publicRarityLabel,
  publicReceiptFocusLabel,
  publicRegionLabel,
  publicResourceDescriptions,
  publicResourceLabels,
  publicSecretTierLabel,
  publicSourceTypeLabel,
  publicStatusLabel,
  publicText,
  publicTrustedRunnerLabel,
  publicTrustTierLabel,
} from "./epoch/publicVocabulary.ts";
import { buildPublicResultViewModel } from "./epoch/publicResultViewModel.ts";
import { epochPageSceneMediaForKey } from "./pageSceneAssets.ts";
import { obsidianEpochPublicSurfaceMarkerHtml } from "./publicSurfaceContract.ts";

type ResultPagePayload = NonNullable<EpochSharedResultPage["payload"]>;
type RenderableResultPage = EpochSharedResultPage & {
  readonly payload: ResultPagePayload;
};

const resourceLabels = publicResourceLabels;
const resourceDescriptions = publicResourceDescriptions;
const shortRegionLabel = publicRegionLabel;
const secretTierLabel = publicSecretTierLabel;
const sourceTypeLabel = publicSourceTypeLabel;
const playModeLabel = publicPlayModeLabel;
const trustTierLabel = publicTrustTierLabel;
const receiptFocusLabel = publicReceiptFocusLabel;
const trustedRunnerLabel = publicTrustedRunnerLabel;
const eventTypeLabel = publicEventTypeLabel;
const statusLabel = publicStatusLabel;
const factionLabel = publicFactionLabel;
const rarityLabel = publicRarityLabel;

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeJsonScript(value: unknown) {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function dateLabel(value: string) {
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

function shortTimeLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return escapeHtml(value);
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Shanghai",
  }).format(date);
}

function publicNarrativeText(value: unknown) {
  const text = publicText(value)
    .replace(/\s*地点母题偏向：.*$/s, "")
    .replace(/\s*奖励偏向.*$/s, "")
    .replace(/^服务器记录为一次稳健观察，区域信息被整理。$/, "灰港局势与可见线索已整理为服务器记录。")
    .replace(/^服务器结算为一次有效协助，获得少量钱币。$/, "协助处理区域事务，换来少量钱币和更清楚的地方关系。")
    .replace(/^服务器记录了这一段探索。$/, "这一段探索已归入当前历程。")
    .trim();
  return text || "服务器已记录这条线索。";
}

function publicIdentityLabel(value: unknown) {
  const text = publicText(value);
  return isInternalResultName(text) ? "行动身份" : text;
}

function eventPayload(event: ResultPagePayload["progress"]["latestEvents"][number]) {
  return event.payload && typeof event.payload === "object" && !Array.isArray(event.payload)
    ? event.payload as unknown as Record<string, unknown>
    : {};
}

function stringPayload(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  return typeof value === "string" ? value : undefined;
}

function numberPayload(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function publicActionLabel(value: unknown) {
  const text = publicText(value);
  const labels: Record<string, string> = {
    预档未来钩子: "整理后续线索",
  };
  return labels[text] || text;
}

function isInternalResultName(value: string | undefined) {
  return !value
    || /^install[_\s-]?smoke/i.test(value)
    || /^epoch_agent_/i.test(value)
    || /^install_smoke_/i.test(value)
    || /^explorer_/i.test(value);
}

function commissionSecretRevealBudgetLabel(commission: { secretRevealBudget: { chapterLocked: boolean; remaining: number } }) {
  return publicCommissionSecretRevealLabel(commission);
}

function resourceRewardLabel(reward?: { readonly resourceId: string; readonly amount: number }) {
  if (!reward) return "无公开奖励";
  return `${resourceLabels[reward.resourceId] || publicText(reward.resourceId)} +${reward.amount}`;
}

function journeyRewardLabel(journey: NonNullable<ResultPagePayload["journey"]>) {
  const settlementResources = Object.entries(journey.settlement?.reward?.resourceGrants || {})
    .filter(([, amount]) => typeof amount === "number" && Number.isFinite(amount) && amount !== 0)
    .map(([resourceId, amount]) => resourceRewardLabel({ resourceId, amount }));
  const settlementItems = (journey.settlement?.reward?.itemGrants || [])
    .filter((item) => item.quantity > 0)
    .map((item) => `${publicText(item.itemId)} ×${item.quantity}`);
  const episodeRewards = journey.episodes.flatMap((episode) => {
    const reward = episode.settlement?.reward;
    return reward && typeof reward.amount === "number" && reward.amount !== 0
      ? [resourceRewardLabel(reward)]
      : [];
  });
  const rewards = [
    ...settlementResources,
    ...settlementItems,
    ...(journey.stateDelta?.reward?.resourceId && typeof journey.stateDelta.reward.amount === "number"
      ? [resourceRewardLabel({
          resourceId: journey.stateDelta.reward.resourceId,
          amount: journey.stateDelta.reward.amount,
        })]
      : []),
    ...(journey.stateDelta?.rewardBundle?.resources.map(resourceRewardLabel) || []),
    ...(journey.stateDelta?.rewardBundle?.items.map((item) =>
      `${publicText(item.displayName)}（${rarityLabel(item.rarity)}）`) || []),
    ...episodeRewards,
  ];
  const uniqueRewards = [...new Set(rewards)];
  return uniqueRewards.length > 0 ? uniqueRewards.join("；") : "无公开奖励";
}

function riskLabel(value: string | undefined) {
  const labels: Record<string, string> = {
    low: "低",
    medium: "中",
    high: "高",
  };
  return labels[value || ""] || value || "未知";
}

function lifetimeDeltaLabel(value: number | undefined) {
  return value ? `寿命 ${value}` : "寿命无公开变化";
}

function publicVisibleText(value: string | undefined) {
  if (!value) return "";
  return /install[_\s-]?smoke/i.test(value) ? "" : value;
}

function journeyStepPrefix(value: string | undefined) {
  const match = publicText(value).match(/第\s*(\d+)\s*段/);
  return match ? `第 ${match[1]} 段：` : "";
}

function actionPlainSummary(actionLabel: string, outcome: string) {
  if (/观察/.test(actionLabel)) {
    return "这一段探索先查看区域局势，整理出可以继续行动的线索。";
  }
  if (/托管|冥想|修炼|锻炼|摸鱼|外出/.test(actionLabel)) {
    return "这一段把空档时间交给服务器结算，稍后再回来看收益。";
  }
  return outcome || "服务器已经记录本次行动。";
}

function resultFocusSummary(payload: ResultPagePayload) {
  if (payload.focusTurnCard?.resolution) {
    const selectedOption = payload.focusTurnCard.actionOptions.find((option) =>
      option.actionOptionId === payload.focusTurnCard?.resolution?.actionOptionId);
    return {
      regionId: payload.focusTurnCard.regionId,
      actionLabel: payload.focusTurnCard.resolution.optionLabel,
      risk: riskLabel(selectedOption?.risk),
      reward: resourceRewardLabel(payload.focusTurnCard.resolution.reward),
      lifetime: lifetimeDeltaLabel(payload.focusTurnCard.resolution.lifetimeDelta),
      outcome: payload.focusTurnCard.resolution.outcomeSummary,
    };
  }
  const session = payload.focusHostedSession;
  const latestAction = session?.actions.at(-1);
  if (session && latestAction) {
    const selectedOption = session.actionOptions.find((option) => option.actionOptionId === latestAction.actionOptionId);
    return {
      regionId: session.regionId,
      actionLabel: latestAction.optionLabel,
      risk: riskLabel(selectedOption?.risk),
      reward: resourceRewardLabel(latestAction.reward),
      lifetime: lifetimeDeltaLabel(latestAction.lifetimeDelta),
      outcome: latestAction.outcomeSummary,
    };
  }
  if (payload.journey) {
    return {
      regionId: payload.journey.regionId,
      actionLabel: "完整旅程",
      risk: "已结算",
      reward: journeyRewardLabel(payload.journey),
      lifetime: "寿命无公开变化",
      outcome: payload.journey.stateDelta?.outcomeSummary || payload.publicSafeSummary.text,
    };
  }
  return {
    regionId: payload.regionalContext?.regionId,
    actionLabel: "公开结果",
    risk: "未知",
    reward: "无公开奖励",
    lifetime: "寿命无公开变化",
    outcome: payload.publicSafeSummary.text,
  };
}

function resultHeroTitle(payload: ResultPagePayload) {
  const focus = resultFocusSummary(payload);
  const region = shortRegionLabel(focus.regionId);
  if (region !== "未知区域") return `${region}探索历程`;
  const identity = payload.progress.identity || payload.progress.identities.at(-1);
  if (!isInternalResultName(identity?.identityName)) return `${identity?.identityName}的探索历程`;
  return "探索历程已更新";
}

function resultHeroSummary(payload: ResultPagePayload) {
  const focus = resultFocusSummary(payload);
  const region = shortRegionLabel(focus.regionId);
  if (focus.outcome && focus.outcome !== payload.publicSafeSummary.text) {
    return `${region} · ${publicText(focus.outcome)}`;
  }
  const summary = payload.publicSafeSummary.text;
  return isInternalResultName(summary) || /install[_\s-]?smoke/i.test(summary)
    ? `${region} · 本次探索已整理为可分享的历程摘要。`
    : publicText(summary);
}

function resourceRows(
  resources: ResultPagePayload["progress"]["resources"],
  resourceMedia: ResultPagePayload["progress"]["resourceMedia"] = {},
) {
  const entries = Object.entries(resources).filter(([, amount]) => Number(amount || 0) !== 0);
  if (!entries.length) return "<span class=\"empty\">暂无资源变化</span>";
  return entries
    .map(([resourceId, amount]) => {
      const media = resourceMedia[resourceId as keyof typeof resourceMedia];
      const image = media
        ? `<img class="resource-media-image" src="${escapeHtml(media.imageUrl)}" alt="${escapeHtml(media.publicAlt)}" loading="lazy">`
        : "";
      const label = resourceLabels[resourceId] || publicText(resourceId);
      const description = resourceDescriptions[resourceId];
      return `<span>${image}<b>${escapeHtml(amount)}</b><em>${escapeHtml(label)}</em>${description ? `<small>${escapeHtml(description)}</small>` : ""}</span>`;
    })
    .join("");
}

function inventoryRows(items: ResultPagePayload["progress"]["inventoryItems"]) {
  if (!items.length) return "<span class=\"empty\">暂无服务器发放物品</span>";
  return items
    .slice(0, 8)
    .map((item) => {
      const text = `<b>${escapeHtml(publicText(item.displayName))}</b><em>${escapeHtml(rarityLabel(item.rarity))} · ${item.bound ? "已绑定" : "未绑定"}</em>`;
      if (!item.media) return `<span>${text}</span>`;
      const image = `<img class="item-media-image" src="${escapeHtml(item.media.imageUrl)}" alt="${escapeHtml(item.media.publicAlt)}" loading="lazy">`;
      return `<span class="item-media-row">${image}<span>${text}</span></span>`;
    })
    .join("");
}

function activityMediaImageHtml(media?: { readonly imageUrl: string; readonly publicAlt: string }) {
  if (!media) return "";
  return `<img class="activity-media-image" src="${escapeHtml(media.imageUrl)}" alt="${escapeHtml(media.publicAlt)}" loading="lazy">`;
}

function surfaceMediaImageHtml(media?: { readonly imageUrl: string; readonly publicAlt: string }) {
  if (!media) return "";
  return `<img class="surface-media-image" src="${escapeHtml(media.imageUrl)}" alt="${escapeHtml(media.publicAlt)}" loading="lazy">`;
}

function resultPageLinks(payload: ResultPagePayload) {
  const identity = payload.progress.identity || payload.progress.identities.at(-1);
  return {
    world: payload.publicPages?.world || "/epoch/world",
    console: payload.publicPages?.console || "/epoch/web-play",
    agent: payload.publicPages?.agent
      || (payload.progress.agentId || identity?.agentId
        ? `/epoch/agent/${encodeURIComponent(payload.progress.agentId || identity?.agentId || "")}`
        : undefined),
    explorer: payload.publicPages?.explorer
      || (payload.progress.explorerId || identity?.explorerId
        ? `/epoch/explorer/${encodeURIComponent(payload.progress.explorerId || identity?.explorerId || "")}`
        : undefined),
  };
}

function navigationSection(payload: ResultPagePayload) {
  const links = resultPageLinks(payload);
  const tiles = [
    {
      href: links.console,
      label: "MCP 观察",
      detail: "网页只查看进度和凭证；已连接的 Agent 可读取服务器状态，并依据自己的计划决定行动。",
    },
    {
      href: links.world,
      label: "世界概览",
      detail: "查看公开世界、新闻和其他历程。",
    },
    ...(links.agent ? [{
      href: links.agent,
      label: "行动身份档案",
      detail: "查看这个行动身份的公开状态。",
    }] : []),
    ...(links.explorer ? [{
      href: links.explorer,
      label: "探索者档案",
      detail: "查看探索者名下的公开记录。",
    }] : []),
  ];
  return `
    <section class="journey-navigation">
      <div>
        <span class="eyebrow">页面入口</span>
        <h2>相关页面</h2>
      </div>
      <div class="nav-grid">
        ${tiles.map((tile) => `
          <a class="nav-tile" href="${escapeHtml(tile.href)}">
            <b>${escapeHtml(tile.label)}</b>
            <span>${escapeHtml(tile.detail)}</span>
          </a>
        `).join("")}
      </div>
    </section>
  `;
}

interface JourneyTimelineEntry {
  readonly entryId: string;
  readonly occurredAt: string;
  readonly title: string;
  readonly body: string;
  readonly meta?: string;
}

function rewardBody(resourceId: string | undefined, amount: number | undefined) {
  if (!resourceId || typeof amount !== "number") return "服务器记录了一项探索收获。";
  const label = resourceLabels[resourceId] || publicText(resourceId);
  return `${label} +${amount}`;
}

function journeyEventEntry(event: ResultPagePayload["progress"]["latestEvents"][number]): JourneyTimelineEntry | undefined {
  const payload = eventPayload(event);
  const region = shortRegionLabel(stringPayload(payload, "regionId"));
  const occurredAt = stringPayload(payload, "resolvedAt")
    || stringPayload(payload, "createdAt")
    || event.createdAt;
  switch (event.eventType) {
    case "identity_issued": {
      const name = stringPayload(payload, "identityName") || stringPayload(payload, "agentId") || event.agentId || event.aggregateId;
      return {
        entryId: event.eventId,
        occurredAt,
        title: "身份入场",
        body: `${publicIdentityLabel(name)} 获得行动身份，探索历程开始。`,
      };
    }
    case "turn_card_created":
      return {
        entryId: event.eventId,
        occurredAt,
        title: "探索节点生成",
        body: `${region} 出现新的可行动线索。`,
      };
    case "turn_resolved": {
      const action = publicActionLabel(stringPayload(payload, "optionLabel") || "行动完成");
      return {
        entryId: event.eventId,
        occurredAt,
        title: `完成行动：${action}`,
        body: publicNarrativeText(stringPayload(payload, "outcomeSummary") || stringPayload(payload, "visibleText")),
      };
    }
    case "hosted_action_recorded": {
      const action = publicActionLabel(stringPayload(payload, "optionLabel") || "托管行动");
      const stepPrefix = journeyStepPrefix(stringPayload(payload, "visibleText"));
      return {
        entryId: event.eventId,
        occurredAt,
        title: `${stepPrefix}${action}`,
        body: publicNarrativeText(stringPayload(payload, "outcomeSummary") || stringPayload(payload, "visibleText")),
      };
    }
    case "journey_world_solidified":
      return {
        entryId: event.eventId,
        occurredAt,
        title: "镜像对局固化",
        body: `主线完成并安全返程，${region}地区影响 +${numberPayload(payload, "influenceDelta")}，NPC 关系 ${Array.isArray(payload.npcRelationships) ? payload.npcRelationships.length : 0} 项。`,
      };
    case "hosted_session_started":
      return undefined;
    case "resource_granted":
      return {
        entryId: event.eventId,
        occurredAt,
        title: "收获入账",
        body: rewardBody(stringPayload(payload, "resourceId"), numberPayload(payload, "amount")),
      };
    case "identity_archived":
      return {
        entryId: event.eventId,
        occurredAt,
        title: "身份定档",
        body: publicNarrativeText(stringPayload(payload, "archiveReason") || stringPayload(payload, "finalTitle")),
      };
    default:
      return {
        entryId: event.eventId,
        occurredAt,
        title: eventTypeLabel(event.eventType),
        body: "服务器记录了这一段探索。",
      };
  }
}

function hostedActionEntry(action: NonNullable<ResultPagePayload["focusHostedSession"]>["actions"][number]): JourneyTimelineEntry {
  const stepPrefix = journeyStepPrefix(action.visibleText);
  return {
    entryId: action.actionId,
    occurredAt: action.recordedAt,
    title: `${stepPrefix}${publicActionLabel(action.optionLabel)}`,
    body: publicNarrativeText(action.outcomeSummary || action.visibleText),
    meta: action.reward ? rewardBody(action.reward.resourceId, action.reward.amount) : undefined,
  };
}

function journeyTimelineEntries(payload: ResultPagePayload) {
  const entries = new Map<string, JourneyTimelineEntry>();
  const addEntry = (entry: JourneyTimelineEntry | undefined) => {
    if (!entry) return;
    entries.set(entry.entryId, entry);
  };
  payload.progress.latestEvents.forEach((event) => addEntry(journeyEventEntry(event)));
  payload.focusHostedSession?.actions.forEach((action) => addEntry(hostedActionEntry(action)));
  payload.journey?.episodes.forEach((episode, index) => addEntry({
    entryId: episode.episodeId,
    occurredAt: payload.journey?.startedAtWorldTime || payload.generatedAt,
    title: `第 ${index + 1} 段：${publicNarrativeText(episode.title)}`,
    body: episode.narrative
      ? publicNarrativeText(episode.narrative.kind === "grounded_narrative" && episode.narrative.postcard
          ? episode.narrative.postcard.text
          : episode.narrative.confirmedFacts.map((fact) => fact.text).join("；"))
      : payload.journey?.status === "settled"
        ? `${shortRegionLabel(payload.journey?.regionId)} · 服务器记录结果：${publicNarrativeText(episode.outcomeKey)}`
      : `${shortRegionLabel(payload.journey?.regionId)} · 已验证的出发阶段记录：${publicNarrativeText(episode.outcomeKey)}`,
    meta: episode.participants.length
      ? `共同参与：${episode.participants.map((participant) => publicIdentityLabel(participant.label)).join("、")}`
      : undefined,
  }));
  return [...entries.values()]
    .sort((left, right) => left.occurredAt.localeCompare(right.occurredAt) || left.entryId.localeCompare(right.entryId))
    .slice(-24);
}

function journeyTimelineDisplay(entry: JourneyTimelineEntry) {
  const stepMatch = /^第\s*(\d+)\s*段：\s*(.+)$/.exec(entry.title);
  if (!stepMatch) {
    return {
      marker: shortTimeLabel(entry.occurredAt),
      title: entry.title,
    };
  }
  return {
    marker: `第 ${stepMatch[1]} 段`,
    title: stepMatch[2],
  };
}

function journeyTimelineSection(payload: ResultPagePayload) {
  const entries = journeyTimelineEntries(payload);
  if (!entries.length) return "";
  return `
    <section class="journey-timeline">
      <div>
        <span class="eyebrow">探索历程</span>
        <h2>历程时间线</h2>
      </div>
      <ol>
        ${entries.map((entry) => {
          const display = journeyTimelineDisplay(entry);
          return `
            <li id="episode-${escapeHtml(encodeURIComponent(entry.entryId))}">
              <time>${escapeHtml(display.marker)}</time>
              <b>${escapeHtml(display.title)}</b>
              <span>${escapeHtml(entry.body)}</span>
              ${entry.meta ? `<em>${escapeHtml(entry.meta)}</em>` : ""}
            </li>
          `;
        }).join("")}
      </ol>
    </section>
  `;
}

function journeyStorySection(payload: ResultPagePayload) {
  const report = payload.journey?.storyReport;
  if (!report) return "";
  if (!report.profile || !report.evaluation) {
    return `
      <section class="journey-story">
        <div>
          <span class="eyebrow">服务器叙事</span>
          <h2>完整故事报告</h2>
        </div>
        <h3>${escapeHtml(report.title)}</h3>
        <p class="journey-story-summary">${escapeHtml(report.summary)}</p>
        <div class="journey-story-body">
          ${report.chapters.map((chapter) => `
            <article class="journey-story-chapter">
              <h4>${escapeHtml(chapter.title)}</h4>
              <p>${escapeHtml(chapter.text)}</p>
            </article>`).join("")}
        </div>
      </section>`;
  }
  return `
    <section class="journey-story">
      <div>
        <span class="eyebrow">服务器叙事</span>
        <h2>完整故事报告</h2>
      </div>
      <div class="journey-story-profile">
        <p><b>代号：</b>${escapeHtml(report.profile.codeName)}</p>
        <p>${escapeHtml(report.profile.reincarnation)}。</p>
        <p><b>身份：</b>${escapeHtml(report.profile.identity)}</p>
        <p><b>该局目标：</b>${escapeHtml(report.profile.objective)}</p>
      </div>
      <h3 class="journey-story-content-heading">故事内容：</h3>
      <div class="journey-story-body">
        ${report.chapters.map((chapter) => `
          <article class="journey-story-chapter">
            <h4>${escapeHtml(chapter.title)}</h4>
            <p>${escapeHtml(chapter.text)}</p>
          </article>`).join("")}
      </div>
      <div class="journey-story-evaluation">
        <h3>评价：</h3>
        <p><b>任务完成度：</b>${escapeHtml(report.evaluation.taskCompletionGrade)}</p>
        <p><b>身份还原度：</b>${escapeHtml(String(report.evaluation.identityFidelityPercent))}%</p>
        ${report.evaluation.rewards
          ? `<p><b>获得奖励：</b>${escapeHtml(report.evaluation.rewards.summary)}</p>`
          : ""}
        ${report.evaluation.rewardConversion
          ? `<p><b>能力转化：</b>${escapeHtml(report.evaluation.rewardConversion.summary)}</p>`
          : ""}
        ${report.evaluation.playerImpact
          ? `<p><b>其他玩家影响：</b>${escapeHtml(report.evaluation.playerImpact.summary)}</p>`
          : ""}
        ${report.evaluation.warning
          ? `<p class="journey-story-warning"><b>警告：</b>${escapeHtml(report.evaluation.warning)}</p>`
          : ""}
      </div>
    </section>`;
}

function regionalContextSection(context: ResultPagePayload["regionalContext"]) {
  if (!context) return "";
  const news = context.news.length
    ? context.news.slice(0, 4).map((item) => `<li>${surfaceMediaImageHtml(item.media)}<b>区域新闻</b><span>${escapeHtml(publicText(item.headline))}</span><em>传说 +${escapeHtml(item.legendDelta)}</em></li>`).join("")
    : "<li class=\"empty\">暂无区域新闻</li>";
  const commissions = context.commissions.length
    ? context.commissions.slice(0, 4).map((commission) => `
      <li>
        ${activityMediaImageHtml(commission.media)}
        <b>${escapeHtml(publicText(commission.title))}</b>
        <span>${escapeHtml(`${secretTierLabel(commission.secretExposureTier)} · ${commissionSecretRevealBudgetLabel(commission)} · ${publicActionLabel(commission.actionLabel)} · ${sourceTypeLabel(commission.sourceType)}`)}</span>
        <em>${escapeHtml(publicNarrativeText(commission.summary))}</em>
      </li>
    `).join("")
    : "<li class=\"empty\">暂无公开委托</li>";
  const regionControl = context.regionControl
    ? `
      <li>
        <b>控制阵营</b>
        <span>${escapeHtml(factionLabel(context.regionControl.controllingFactionId))}</span>
        <em>${escapeHtml(`控制分 ${context.regionControl.controlScore} · 优势差 ${context.regionControl.controlMargin}`)}</em>
      </li>
      ${context.regionControl.contestedByFactionId ? `
        <li>
          <b>挑战者</b>
          <span>${escapeHtml(factionLabel(context.regionControl.contestedByFactionId))}</span>
          <em>赛季压力已记录</em>
        </li>
      ` : ""}
    `
    : `
      <li>
        <b>暂无阵营掌控</b>
        <span>当前区域还没有公开控制者</span>
        <em>之后可能由赛季、行动或公开事件改变。</em>
      </li>
    `;
  const conflicts = [
    ...context.raids.slice(0, 3).map((raid) => `
      <li>
        <b>对抗战报</b>
        <span>${escapeHtml(statusLabel(raid.outcome))}</span>
        <em>${escapeHtml(`双方行动身份已记录 · 传说 +${raid.reward.amount}`)}</em>
      </li>
    `),
    ...context.retaliations.slice(0, 3).map((retaliation) => `
      <li>
        <b>复仇契机</b>
        <span>${escapeHtml(statusLabel(retaliation.status))}</span>
        <em>相关行动身份已记录</em>
      </li>
    `),
    ...context.traces.slice(0, 3).map((trace) => `
      <li>
        <b>冲突轨迹</b>
        <span>${escapeHtml(eventTypeLabel(trace.sourceEventType))}</span>
        <em>${escapeHtml(publicText(trace.summary))}</em>
      </li>
    `),
  ].slice(0, 6).join("") || "<li class=\"empty\">暂无公开对抗记录</li>";

  return `
    <section class="regional-context">
      <div>
        <span class="eyebrow">区域动态</span>
        <h2>区域动态</h2>
        <p>${escapeHtml(shortRegionLabel(context.regionId))}</p>
      </div>
      <div class="context-grid">
        <div><h3>最新新闻</h3><ul>${news}</ul></div>
        <div><h3>区域委托</h3><ul>${commissions}</ul></div>
        <div><h3>区域控制</h3><ul>${regionControl}</ul></div>
        <div><h3>对抗战报</h3><ul>${conflicts}</ul></div>
      </div>
    </section>
  `;
}

function turnCardSection(card: ResultPagePayload["focusTurnCard"]) {
  if (!card?.resolution) return "";
  const selectedOption = card.actionOptions.find((option) => option.actionOptionId === card.resolution?.actionOptionId);
  const reward = resourceRewardLabel(card.resolution.reward);
  const lifetime = lifetimeDeltaLabel(card.resolution.lifetimeDelta);
  const visibleText = publicVisibleText(card.resolution.visibleText);
  const plainSummary = actionPlainSummary(card.resolution.optionLabel, card.resolution.outcomeSummary);

  return `
    <section class="turn-card">
      <div>
        <span class="eyebrow">探索历程</span>
        <h2>历程节点</h2>
      </div>
      <dl>
        <div><dt>区域</dt><dd>${escapeHtml(shortRegionLabel(card.regionId))}</dd></div>
        <div><dt>行动</dt><dd>${escapeHtml(publicActionLabel(card.resolution.optionLabel))}</dd></div>
        <div><dt>风险</dt><dd>${escapeHtml(riskLabel(selectedOption?.risk))}</dd></div>
        <div><dt>行动说明</dt><dd>${escapeHtml(plainSummary)}</dd></div>
        <div><dt>结算</dt><dd>${escapeHtml(publicText(card.resolution.outcomeSummary))}</dd></div>
        <div><dt>奖励</dt><dd>${escapeHtml(`${reward} / ${lifetime}`)}</dd></div>
      </dl>
      ${visibleText ? `<p>${escapeHtml(publicText(visibleText))}</p>` : ""}
    </section>
  `;
}

function hostedSessionSection(session: ResultPagePayload["focusHostedSession"]) {
  if (!session?.actions.length) return "";
  const latestAction = session.actions.at(-1);
  if (!latestAction) return "";
  const heading = session.channelClass === "browser_copy_paste" ? "网页桥接结算" : "托管行动结算";
  const selectedOption = session.actionOptions.find((option) => option.actionOptionId === latestAction.actionOptionId);
  const reward = resourceRewardLabel(latestAction.reward);
  const lifetime = lifetimeDeltaLabel(latestAction.lifetimeDelta);
  const visibleText = publicVisibleText(latestAction.visibleText);
  const plainSummary = actionPlainSummary(latestAction.optionLabel, latestAction.outcomeSummary);

  return `
    <section class="turn-card">
      <div>
        <span class="eyebrow">探索历程</span>
        <h2>${escapeHtml(heading)}</h2>
      </div>
      <dl>
        <div><dt>区域</dt><dd>${escapeHtml(shortRegionLabel(session.regionId))}</dd></div>
        <div><dt>行动</dt><dd>${escapeHtml(publicActionLabel(latestAction.optionLabel))}</dd></div>
        <div><dt>风险</dt><dd>${escapeHtml(riskLabel(selectedOption?.risk))}</dd></div>
        <div><dt>行动说明</dt><dd>${escapeHtml(plainSummary)}</dd></div>
        <div><dt>结算</dt><dd>${escapeHtml(publicText(latestAction.outcomeSummary))}</dd></div>
        <div><dt>奖励</dt><dd>${escapeHtml(`${reward} / ${lifetime}`)}</dd></div>
      </dl>
      ${visibleText ? `<p>${escapeHtml(publicText(visibleText))}</p>` : ""}
    </section>
  `;
}

function trustedExecutionRows(receipt: ResultPagePayload["receipt"]) {
  if (!receipt.trustedExecution.length) return "";
  const rows = receipt.trustedExecution.map((trusted) => `
    <li>
      <b>${escapeHtml(trustedRunnerLabel(trusted.runnerId))}</b>
      <span>凭据已通过服务器验签</span>
      <em>执行记录、签名摘要和页面校验已封存</em>
      <span>${trusted.attestationAuditUrl ? `<a href="${escapeHtml(trusted.attestationAuditUrl)}">凭据审计</a>` : ""}${trusted.actionAuditUrl ? ` · <a href="${escapeHtml(trusted.actionAuditUrl)}">行动审计</a>` : ""}</span>
    </li>
  `).join("");
  return `
    <div>
      <h3>受信执行凭据</h3>
      <ul class="receipt-events trusted-execution">${rows}</ul>
    </div>
  `;
}

type Phase6Record = Readonly<Record<string, unknown>>;
type Phase6SidecarLike = {
  readonly ok?: unknown;
  readonly page?: unknown;
  readonly findings?: unknown;
};

const phase6ScoreLabels: Record<string, string> = {
  world_impact: "世界影响",
  identity_continuity: "身份连续性",
  progression_delta: "进度变化",
  economy_integrity: "经济完整性",
  settlement_quality: "结算质量",
  rag_grounding: "RAG 依据",
  auditability: "可审计性",
  integrity: "完整性",
};

function phase6Record(value: unknown): Phase6Record {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Phase6Record : {};
}

function phase6Array(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? value : [];
}

function phase6Text(value: unknown) {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function phase6TextList(value: unknown, limit = 8) {
  return phase6Array(value)
    .map(phase6Text)
    .filter(Boolean)
    .slice(0, limit);
}

function phase6SecretLikeKey(key: string) {
  return /(secret|token|password|private|credential|signature|runnerKey|apiKey|challenge)/i.test(key);
}

function phase6PublicDetails(details: unknown) {
  const record = phase6Record(details);
  const rows = Object.entries(record)
    .filter(([key, value]) => !phase6SecretLikeKey(key) && ["string", "number", "boolean"].includes(typeof value))
    .slice(0, 6);
  if (!rows.length) return "";
  return rows.map(([key, value]) => `${key}: ${phase6Text(value)}`).join(" · ");
}

function phase6EventRefs(eventIds: readonly string[]) {
  if (!eventIds.length) return "<em>event refs: none</em>";
  return `<em>event refs: ${escapeHtml(eventIds.join(" / "))}</em>`;
}

function phase6ChangeRows(changeSet: Phase6Record) {
  const changes = phase6Array(changeSet.changes);
  if (changes.length === 0) {
    return `<li class="empty"><b>无变化</b><span>${escapeHtml(phase6Text(changeSet.noChangeReason) || "server-settled receipt reported no change")}</span>${phase6EventRefs(phase6TextList(changeSet.eventIds))}</li>`;
  }
  return changes.slice(0, 6).map((change) => {
    const record = phase6Record(change);
    const eventIds = phase6TextList(record.eventIds);
    return `
      <li>
        <b>${escapeHtml(phase6Text(record.label) || phase6Text(record.id) || "变更")}</b>
        <span>${escapeHtml(phase6Text(record.id))}</span>
        ${phase6EventRefs(eventIds)}
      </li>
    `;
  }).join("");
}

function phase6ChangeBlock(title: string, changeSet: unknown) {
  return `
    <div>
      <h3>${escapeHtml(title)}</h3>
      <ul class="phase6-list">${phase6ChangeRows(phase6Record(changeSet))}</ul>
    </div>
  `;
}

function phase6SettlementBlock(settlement: unknown) {
  const record = phase6Record(settlement);
  const economy = phase6Record(record.economyConservation);
  const eventIds = phase6TextList(record.eventIds);
  const assets = phase6Array(economy.assets).length;
  const auditFindings = phase6Array(economy.auditFindingIds).length;
  return `
    <div>
      <h3>Run / Economy</h3>
      <dl>
        <div><dt>状态</dt><dd>${escapeHtml(phase6Text(record.status) || "unknown")}</dd></div>
        <div><dt>结算</dt><dd>${escapeHtml(phase6Text(record.settlementId) || "unavailable")}</dd></div>
        <div><dt>守恒</dt><dd>${escapeHtml(economy.conserved === true ? "通过" : "未通过或未声明")}</dd></div>
        <div><dt>经济项</dt><dd>${escapeHtml(`${assets} assets · ${auditFindings} audit findings`)}</dd></div>
      </dl>
      <ul class="phase6-list"><li><b>event refs</b><span>${escapeHtml(eventIds.join(" / ") || "none")}</span></li></ul>
    </div>
  `;
}

function phase6ScoresBlock(scores: unknown) {
  const rows = phase6Array(scores).slice(0, 8).map((score) => {
    const record = phase6Record(score);
    const dimension = phase6Text(record.dimension);
    const value = typeof record.score === "number" ? record.score : phase6Text(record.score);
    const eventIds = phase6TextList(record.eventIds, 4);
    return `
      <li>
        <b>${escapeHtml(phase6ScoreLabels[dimension] || dimension || "score")}</b>
        <span>${escapeHtml(value === "" ? "未声明" : value)}</span>
        <em>${escapeHtml(phase6Text(record.basis) || phase6Text(record.source) || "server-settled metric")}</em>
        ${phase6EventRefs(eventIds)}
      </li>
    `;
  }).join("");
  return `
    <div>
      <h3>八维 Score</h3>
      <ul class="phase6-scores">${rows || "<li class=\"empty\"><b>无 score</b><span>Phase 6 sidecar 未提供评分</span></li>"}</ul>
    </div>
  `;
}

function phase6RagBlock(rag: unknown) {
  const record = phase6Record(rag);
  const evidenceIds = phase6TextList(record.evidenceIds, 8);
  return `
    <div>
      <h3>RAG</h3>
      <dl>
        <div><dt>检索快照</dt><dd>${escapeHtml(phase6Text(record.retrievalSnapshotId) || "unavailable")}</dd></div>
        <div><dt>证据</dt><dd>${escapeHtml(evidenceIds.join(" / ") || "none")}</dd></div>
      </dl>
      <ul class="phase6-list">${phase6ChangeRows(record)}</ul>
    </div>
  `;
}

function phase6AuditBlock(audit: unknown) {
  const record = phase6Record(audit);
  const integrity = phase6Record(record.integrity);
  const eventIds = phase6TextList(integrity.canonicalEventIds || record.eventIds);
  return `
    <div>
      <h3>Audit / Integrity</h3>
      <dl>
        <div><dt>审计</dt><dd>${escapeHtml(phase6Text(record.auditId) || "unavailable")}</dd></div>
        <div><dt>完整性</dt><dd>${escapeHtml(integrity.ok === true ? "通过" : "未通过或未声明")}</dd></div>
        <div><dt>Receipt Hash</dt><dd>${escapeHtml(phase6Text(integrity.receiptPayloadHash) || "unavailable")}</dd></div>
        <div><dt>Page Hash</dt><dd>${escapeHtml(phase6Text(integrity.resultPagePayloadHash) || "unavailable")}</dd></div>
        <div><dt>检查时间</dt><dd>${escapeHtml(phase6Text(integrity.checkedAt) || "unavailable")}</dd></div>
      </dl>
      <ul class="phase6-list"><li><b>event refs</b><span>${escapeHtml(eventIds.join(" / ") || "none")}</span></li></ul>
    </div>
  `;
}

function phase6EventRefBlock(receipt: Phase6Record) {
  const canonicalEvents = phase6Array(receipt.canonicalEvents);
  const rows = canonicalEvents.slice(0, 8).map((event) => {
    const record = phase6Record(event);
    return `
      <li>
        <b>${escapeHtml(phase6Text(record.eventType) || "event")}</b>
        <span>${escapeHtml(phase6Text(record.eventId) || "unknown_event")}</span>
        <em>${escapeHtml(phase6Text(record.runId) || phase6Text(receipt.runId) || "unknown_run")}</em>
      </li>
    `;
  }).join("");
  return `
    <div>
      <h3>Event Refs</h3>
      <ul class="phase6-list">${rows || "<li class=\"empty\"><b>无事件引用</b><span>Phase 6 sidecar 未提供 canonical events</span></li>"}</ul>
    </div>
  `;
}

function phase6FindingsRows(findings: unknown) {
  const rows = phase6Array(findings).map((finding) => {
    const record = phase6Record(finding);
    const publicDetails = phase6PublicDetails(record.details);
    return `
      <li>
        <b>${escapeHtml(phase6Text(record.code) || "PHASE6_FINDING")}</b>
        <span>${escapeHtml(phase6Text(record.message) || "Phase 6 sidecar rejected this result page")}</span>
        <em>${escapeHtml([phase6Text(record.path), publicDetails].filter(Boolean).join(" · ") || phase6Text(record.severity) || "error")}</em>
      </li>
    `;
  }).join("");
  return rows || "<li class=\"empty\"><b>Phase 6 未通过</b><span>未提供 findings；不会按成功结果展示。</span></li>";
}

function phase6ResultSection(page: RenderableResultPage) {
  const phase6 = (page.payload.receipt as { readonly phase6?: Phase6SidecarLike }).phase6;
  if (!phase6) return "";
  if (phase6.ok !== true) {
    return `
      <details class="server-receipt phase6-receipt" open>
        <summary>
          <b>Phase 6 结果页校验未通过</b>
          <span>仅展示 findings；不显示默认分数或成功状态</span>
        </summary>
        <ul class="phase6-list phase6-findings">${phase6FindingsRows(phase6.findings)}</ul>
      </details>
    `;
  }
  const phase6Page = phase6Record(phase6.page);
  const sections = phase6Record(phase6Page.sections);
  const identityProgression = phase6Record(sections.identityProgression);
  const receipt = phase6Record(phase6Page.receipt);
  return `
    <details class="server-receipt phase6-receipt" open>
      <summary>
        <b>Phase 6 机器可读结果</b>
        <span>六域、八维 score、RAG 和完整性依据来自 server-settled sidecar</span>
      </summary>
      <dl>
        <div><dt>规则</dt><dd>${escapeHtml(phase6Text(phase6Page.rulesetVersion) || "unknown")}</dd></div>
        <div><dt>确定性</dt><dd>${escapeHtml(phase6Page.deterministic === true ? "true" : "false")}</dd></div>
        <div><dt>Receipt</dt><dd>${escapeHtml(phase6Text(receipt.receiptId) || "unavailable")}</dd></div>
        <div><dt>Run</dt><dd>${escapeHtml(phase6Text(receipt.runId) || "unavailable")}</dd></div>
      </dl>
      <div class="phase6-grid">
        ${phase6ChangeBlock("World", sections.world)}
        ${phase6ChangeBlock("Identity", identityProgression.identity)}
        ${phase6ChangeBlock("Progression", identityProgression.progression)}
        ${phase6SettlementBlock(sections.settlement)}
        ${phase6ScoresBlock(sections.scores)}
        ${phase6RagBlock(sections.rag)}
        ${phase6AuditBlock(sections.audit)}
        ${phase6EventRefBlock(receipt)}
      </div>
    </details>
  `;
}

function receiptSection(page: RenderableResultPage) {
  const receipt = page.payload.receipt;
  if (!receipt) return "";
  const events = receipt.canonicalEvents.length
    ? receipt.canonicalEvents.slice(0, 8).map((event, index) => `
      <li>
        <b>${escapeHtml(eventTypeLabel(event.eventType))}</b>
        <span>审计记录 ${escapeHtml(index + 1)}</span>
        <a href="${escapeHtml(event.auditUrl)}">查看审计</a>
      </li>
    `).join("")
    : "<li class=\"empty\">暂无可公开审计事件</li>";
  return `
    <details class="server-receipt">
      <summary>
        <b>校验证明</b>
        <span>给需要核验结果的人展开查看</span>
      </summary>
      <dl>
        <div><dt>结果</dt><dd>校验材料已封存</dd></div>
        <div><dt>结算对象</dt><dd>${escapeHtml(receiptFocusLabel(receipt.focus.kind))}</dd></div>
        <div><dt>模式</dt><dd>${escapeHtml(playModeLabel(receipt.playMode))}</dd></div>
        <div><dt>可信度</dt><dd>${escapeHtml(trustTierLabel(receipt.trustTier))}</dd></div>
        <div><dt>生成时间</dt><dd>${dateLabel(receipt.generatedAt)}</dd></div>
      </dl>
      ${trustedExecutionRows(receipt)}
      <ul class="receipt-events">${events}</ul>
    </details>
  `;
}

function receiptJsonScript(receipt: ResultPagePayload["receipt"] | undefined) {
  if (!receipt) return "";
  const publicReceipt = {
    receiptType: "公开校验证明",
    generatedAt: receipt.generatedAt,
    playMode: playModeLabel(receipt.playMode),
    trustTier: trustTierLabel(receipt.trustTier),
    focus: {
      kind: receiptFocusLabel(receipt.focus.kind),
    },
    events: receipt.canonicalEvents.map((event, index) => ({
      labelIndex: index + 1,
      label: eventTypeLabel(event.eventType),
      auditUrl: event.auditUrl,
    })),
  };
  return `<script id="obsidian-epoch-result-receipt-json" type="application/json">${escapeJsonScript(publicReceipt)}</script>`;
}

export function renderEpochResultPageHtml(page: RenderableResultPage) {
  const progress = page.payload.progress;
  const focus = resultFocusSummary(page.payload);
  const view = buildPublicResultViewModel(page);
  const playerStory = page.payload.journey?.storyReport;
  const title = playerStory?.title || view.heroTitle;
  const heroSummary = playerStory?.summary || view.heroSummary;
  const trustLabel = view.verification.label;
  const heroMedia = epochPageSceneMediaForKey("result_page");
  if (!heroMedia) throw new Error("epoch_page_scene_media_missing:result_page");

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  ${obsidianEpochPublicSurfaceMarkerHtml()}
  <title>${escapeHtml(title)} - 黑曜纪元结果页</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #050706;
      --panel: rgba(12, 17, 16, .82);
      --line: rgba(135, 169, 161, .22);
      --text: #eef5ee;
      --soft: #aec1ba;
      --muted: #7f928d;
      --cyan: #72d8ce;
      --gold: #d8a65e;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      color: var(--text);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: radial-gradient(circle at 20% 0%, rgba(114, 216, 206, .14), transparent 30%),
        linear-gradient(135deg, #050706 0%, #101312 58%, #14120d 100%);
      overflow-x: hidden;
    }
    :where(h1, h2, h3, p, b, span, em, dd, a, li, summary, time) {
      overflow-wrap: anywhere;
      word-break: break-word;
    }
    main {
      width: min(1040px, calc(100vw - 32px));
      margin: 0 auto;
      padding: 36px 0;
    }
    header, section, .server-receipt {
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--panel);
      box-shadow: 0 24px 80px rgba(0, 0, 0, .42);
      backdrop-filter: blur(16px);
    }
    header {
      position: relative;
      overflow: hidden;
      min-height: 260px;
      display: grid;
      align-content: end;
      gap: 20px;
      padding: clamp(22px, 4vw, 42px);
    }
    header::after {
      content: "";
      position: absolute;
      inset: 0;
      z-index: 0;
      background: linear-gradient(90deg, rgba(5, 7, 6, .92), rgba(5, 7, 6, .62) 46%, rgba(5, 7, 6, .3));
      pointer-events: none;
    }
    header > * {
      position: relative;
      z-index: 1;
    }
    .page-scene-hero-image {
      position: absolute;
      right: 28px;
      bottom: 24px;
      z-index: 0;
      width: min(360px, 42%);
      max-height: 72%;
      object-fit: contain;
      opacity: .2;
      filter: saturate(.85);
    }
    .eyebrow {
      color: var(--cyan);
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0;
      text-transform: none;
    }
    h1 {
      margin: 0;
      max-width: 720px;
      font-size: clamp(34px, 6vw, 68px);
      line-height: 1;
      letter-spacing: 0;
      overflow-wrap: anywhere;
    }
    .public-safe-summary {
      margin: 0;
      max-width: 760px;
      color: var(--soft);
      line-height: 1.6;
      overflow-wrap: anywhere;
    }
    .summary {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 10px;
    }
    .summary span, .resource-grid span, li {
      min-width: 0;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: rgba(255, 255, 255, .04);
    }
    .summary span, .resource-grid span {
      display: grid;
      gap: 4px;
      padding: 12px;
    }
    dl {
      display: grid;
      gap: 8px;
      margin: 0;
    }
    dl div {
      display: grid;
      grid-template-columns: 92px minmax(0, 1fr);
      gap: 12px;
    }
    dt {
      color: var(--muted);
    }
    dd {
      margin: 0;
      color: var(--soft);
      overflow-wrap: anywhere;
    }
    b { color: var(--gold); }
    small {
      color: var(--muted);
      line-height: 1.4;
    }
    em {
      color: var(--muted);
      font-style: normal;
    }
    .grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      gap: 14px;
      margin-top: 14px;
    }
    section {
      padding: 20px;
    }
    .turn-card {
      display: grid;
      gap: 14px;
      margin-top: 14px;
    }
    .turn-card p {
      margin: 0;
      color: var(--soft);
      line-height: 1.6;
      overflow-wrap: anywhere;
    }
    .journey-navigation, .journey-timeline, .next-actions, .regional-context {
      display: grid;
      gap: 14px;
      margin-top: 14px;
    }
    .server-receipt {
      gap: 14px;
      margin-top: 14px;
      padding: 20px;
    }
    .server-receipt[open] {
      display: grid;
    }
    .server-receipt > summary {
      cursor: pointer;
      display: grid;
      gap: 4px;
      color: var(--soft);
    }
    .server-receipt > summary b {
      color: var(--text);
    }
    .server-receipt > summary span {
      color: var(--muted);
      font-size: 14px;
    }
    .technical-receipt {
      border: 1px solid var(--line);
      border-radius: 6px;
      padding: 10px 12px;
      background: rgba(255, 255, 255, .035);
    }
    .technical-receipt summary {
      cursor: pointer;
      color: var(--soft);
      font-weight: 700;
    }
    .server-receipt > dl,
    .technical-receipt dl {
      margin-top: 10px;
    }
    .journey-timeline ol, .next-actions ul, .regional-context ul {
      align-content: start;
    }
    .journey-timeline li, .next-actions li, .regional-context li {
      display: grid;
      align-items: start;
      justify-content: stretch;
    }
    .journey-timeline li {
      grid-template-columns: 72px minmax(160px, .55fr) minmax(0, 1fr);
    }
    .journey-timeline li em {
      grid-column: 3;
    }
    .journey-story h3 {
      margin: 22px 0 8px;
      font-size: clamp(20px, 3vw, 28px);
    }
    .journey-story-profile, .journey-story-evaluation {
      margin-top: 20px;
      padding: 16px 18px;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: rgba(255, 255, 255, .025);
    }
    .journey-story-profile p, .journey-story-evaluation p {
      margin: 6px 0;
      color: var(--text);
      line-height: 1.65;
    }
    .journey-story-content-heading { color: var(--gold); }
    .journey-story-evaluation h3 { margin-top: 0; }
    .journey-story-warning { color: #eea08f !important; }
    .journey-story-summary {
      color: var(--soft);
      font-size: 16px;
      line-height: 1.7;
    }
    .journey-story-body {
      margin-top: 20px;
      padding-left: 18px;
      border-left: 2px solid rgba(216, 166, 94, .48);
    }
    .journey-story-chapter + .journey-story-chapter { margin-top: 24px; }
    .journey-story-chapter h4 {
      margin: 0 0 8px;
      color: var(--gold);
      font-size: 14px;
      letter-spacing: .08em;
    }
    .journey-story-chapter p {
      margin: 0;
      color: var(--text);
      font-size: 17px;
      line-height: 1.9;
    }
    .journey-timeline time {
      color: var(--muted);
      font-size: 13px;
    }
    .receipt-events li {
      display: grid;
      grid-template-columns: minmax(110px, .65fr) minmax(0, 1fr) auto;
      align-items: center;
    }
    .trusted-execution li {
      grid-template-columns: 1fr;
      align-items: start;
    }
    .server-receipt h3 {
      margin: 6px 0 8px;
      color: var(--soft);
      font-size: 14px;
      letter-spacing: 0;
    }
    .phase6-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
      margin-top: 14px;
    }
    .phase6-grid > div {
      min-width: 0;
      border: 1px solid var(--line);
      border-radius: 6px;
      padding: 12px;
      background: rgba(255, 255, 255, .025);
    }
    .phase6-list, .phase6-scores {
      margin-top: 8px;
    }
    .phase6-list li, .phase6-scores li {
      display: grid;
      grid-template-columns: minmax(120px, .55fr) minmax(0, 1fr);
      align-items: start;
    }
    .phase6-list li em, .phase6-scores li em {
      grid-column: 1 / -1;
    }
    .phase6-findings li b {
      color: #eea08f;
    }
    a {
      color: var(--cyan);
      text-decoration: none;
    }
    .nav-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 10px;
    }
    .nav-tile {
      min-width: 0;
      display: grid;
      gap: 6px;
      border: 1px solid var(--line);
      border-radius: 6px;
      padding: 12px;
      background: rgba(255, 255, 255, .04);
    }
    .nav-tile b {
      color: var(--gold);
    }
    .nav-tile span {
      color: var(--muted);
      line-height: 1.45;
    }
    .context-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 12px;
    }
    .context-grid h3 {
      margin: 0 0 8px;
      color: var(--soft);
      font-size: 14px;
      letter-spacing: 0;
    }
    .regional-context p {
      margin: 0;
      color: var(--muted);
    }
    h2 {
      margin: 0 0 12px;
      font-size: 18px;
      letter-spacing: 0;
    }
    .resource-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
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
      width: 36px;
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
      flex: 0 0 auto;
      border-radius: 6px;
      border: 1px solid var(--line);
      background: rgba(0, 0, 0, .35);
    }
    .surface-media-image {
      width: 42px;
      aspect-ratio: 1;
      object-fit: cover;
      flex: 0 0 auto;
      border-radius: 6px;
      border: 1px solid var(--line);
      background: rgba(0, 0, 0, .35);
    }
    ul, ol {
      display: grid;
      gap: 8px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    li {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 10px;
      color: var(--soft);
      overflow-wrap: anywhere;
    }
    li span, .meta {
      color: var(--muted);
    }
    .empty {
      color: var(--muted);
    }
    @media (max-width: 720px) {
      main { width: min(100vw - 20px, 1040px); padding: 10px 0; }
      header { min-height: 240px; }
      .summary { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .grid, .context-grid, .nav-grid, .phase6-grid { grid-template-columns: 1fr; }
      .journey-timeline li, .receipt-events li { grid-template-columns: 1fr; }
      .phase6-list li, .phase6-scores li { grid-template-columns: 1fr; }
      .journey-timeline li em { grid-column: auto; }
      dl div { grid-template-columns: 1fr; }
      h1 { font-size: clamp(32px, 10vw, 48px); }
      .page-scene-hero-image {
        right: 10px;
        bottom: 46px;
        width: min(58%, 300px);
        opacity: .12;
      }
    }
    @media (max-width: 460px) {
      .summary { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <main>
    <header class="result-hero-shell">
      <img class="page-scene-hero-image" src="${escapeHtml(heroMedia.imageUrl)}" alt="${escapeHtml(heroMedia.publicAlt)}" loading="eager">
      <div class="eyebrow">黑曜纪元 / 公共结果页</div>
      <h1>${escapeHtml(title)}</h1>
      <p class="public-safe-summary">${escapeHtml(heroSummary)}</p>
      <div class="summary">
        <span><em>${playerStory ? "身份" : "行动"}</em><b>${escapeHtml(playerStory?.profile?.identity || publicActionLabel(focus.actionLabel))}</b></span>
        <span><em>区域</em><b>${escapeHtml(shortRegionLabel(focus.regionId))}</b></span>
        <span><em>奖励</em><b>${escapeHtml(`${focus.reward} / ${focus.lifetime}`)}</b></span>
        <span><em>结算</em><b>${escapeHtml(`${trustLabel} · ${playModeLabel(page.payload.receipt.playMode)}`)}</b></span>
        <span><em>生成</em><b>${dateLabel(page.createdAt)}</b></span>
      </div>
      <div class="meta">${playerStory ? "这是一份面向玩家的完整故事。" : "这是一张可分享的探索历程摘要。"}</div>
    </header>
    ${navigationSection(page.payload)}
    ${journeyStorySection(page.payload)}
    ${page.payload.journey ? "" : journeyTimelineSection(page.payload)}
    ${turnCardSection(page.payload.focusTurnCard)}
    ${page.payload.journey ? "" : hostedSessionSection(page.payload.focusHostedSession)}
    ${regionalContextSection(page.payload.regionalContext)}
    ${receiptJsonScript(page.payload.receipt)}
    <div class="grid">
      <section>
        <h2>资源</h2>
        <div class="resource-grid">${resourceRows(progress.resources, progress.resourceMedia)}</div>
      </section>
      <section>
        <h2>背包</h2>
        <div class="resource-grid">${inventoryRows(progress.inventoryItems)}</div>
      </section>
    </div>
    ${receiptSection(page)}
    ${phase6ResultSection(page)}
  </main>
</body>
</html>`;
}
