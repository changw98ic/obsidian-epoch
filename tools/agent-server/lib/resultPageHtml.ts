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
    .replace(/^服务器记录为一次稳健观察，区域信息被整理。$/, "先观察灰港局势，把可见线索整理成下一步依据。")
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
    console: payload.publicPages?.console || "/epoch/console",
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
      label: "继续操作",
      detail: "恢复身份后继续派遣或托管。",
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
        <h2>接下来去哪</h2>
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
            <li>
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

function nextActionReason(action: ResultPagePayload["nextActions"][number]) {
  if (action.kind === "continue_turn") {
    return "回到控制台，恢复身份后继续派遣这个行动身份探索当前区域。";
  }
  if (action.kind === "set_downtime") {
    return "回到控制台设置托管，让行动身份在服务器时间里继续推进长期历程。";
  }
  return publicText(action.reason);
}

function nextActionRows(actions: ResultPagePayload["nextActions"]) {
  if (!actions.length) return "<li class=\"empty\">暂无服务器建议行动</li>";
  return actions
    .map((action) => {
      const source = action.sourceType ? ` · ${sourceTypeLabel(action.sourceType)}` : "";
      const recovery = action.requiresRecoveryCode ? "恢复身份后可继续" : "公开查看";
      return `
        <li>
          ${activityMediaImageHtml(action.media)}
          <b>${escapeHtml(publicActionLabel(action.label))}</b>
          <span>${escapeHtml(`${recovery}${source}`)}</span>
          <em>${escapeHtml(nextActionReason(action))}</em>
        </li>
      `;
    })
    .join("");
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
  const title = view.heroTitle;
  const heroSummary = view.heroSummary;
  const trustLabel = view.verification.label;
  const heroMedia = epochPageSceneMediaForKey("result_page");
  if (!heroMedia) throw new Error("epoch_page_scene_media_missing:result_page");

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
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
      .grid, .context-grid, .nav-grid { grid-template-columns: 1fr; }
      .journey-timeline li, .receipt-events li { grid-template-columns: 1fr; }
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
        <span><em>行动</em><b>${escapeHtml(publicActionLabel(focus.actionLabel))}</b></span>
        <span><em>区域</em><b>${escapeHtml(shortRegionLabel(focus.regionId))}</b></span>
        <span><em>奖励</em><b>${escapeHtml(`${focus.reward} / ${focus.lifetime}`)}</b></span>
        <span><em>结算</em><b>${escapeHtml(`${trustLabel} · ${playModeLabel(page.payload.receipt.playMode)}`)}</b></span>
        <span><em>生成</em><b>${dateLabel(page.createdAt)}</b></span>
      </div>
      <div class="meta">这是一张可分享的探索历程摘要。</div>
    </header>
    ${navigationSection(page.payload)}
    ${journeyTimelineSection(page.payload)}
    ${turnCardSection(page.payload.focusTurnCard)}
    ${hostedSessionSection(page.payload.focusHostedSession)}
    <section class="next-actions">
      <div>
        <span class="eyebrow">下一步</span>
        <h2>下一步建议</h2>
      </div>
      <ul>${nextActionRows(page.payload.nextActions)}</ul>
    </section>
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
  </main>
</body>
</html>`;
}
