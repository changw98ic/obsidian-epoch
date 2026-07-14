import { type EpochSharedResultPage } from "./runtime.ts";
import {
  publicEventTypeLabel,
  publicRegionLabel,
  publicResourceDescriptions,
  publicResourceLabel,
  publicSourceTypeLabel,
  publicText,
} from "./publicVocabulary.ts";

type ResultPagePayload = NonNullable<EpochSharedResultPage["payload"]>;

export interface PublicResultTimelineItem {
  readonly title: string;
  readonly body: string;
  readonly marker: string;
  readonly meta?: string;
}

export interface PublicResultConsequence {
  readonly label: string;
  readonly value: string;
  readonly note?: string;
}

export interface PublicResultNextAction {
  readonly label: string;
  readonly href: string;
  readonly note: string;
}

export interface PublicResultVerificationSummary {
  readonly label: string;
  readonly note: string;
  readonly eventCount: number;
  readonly payloadHash?: string;
}

export interface PublicResultViewModel {
  readonly pageTitle: string;
  readonly heroTitle: string;
  readonly heroSummary: string;
  readonly statusLabel: string;
  readonly agentName: string;
  readonly generatedAt: string;
  readonly timeline: readonly PublicResultTimelineItem[];
  readonly consequences: readonly PublicResultConsequence[];
  readonly nextActions: readonly PublicResultNextAction[];
  readonly verification: PublicResultVerificationSummary;
}

function payloadRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function payloadString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function isInternalResultName(value: string | undefined) {
  return !value
    || /^install[_\s-]?smoke/i.test(value)
    || /^epoch_agent_/i.test(value)
    || /^install_smoke_/i.test(value)
    || /^explorer_/i.test(value);
}

function publicIdentityName(payload: ResultPagePayload) {
  const identity = payload.progress.identity || payload.progress.identities.at(-1);
  const name = publicText(identity?.identityName || payload.progress.agentId || "行动身份");
  return isInternalResultName(name) ? "行动身份" : name;
}

function focusRegionId(payload: ResultPagePayload) {
  return payload.journey?.regionId
    || payload.focusHostedSession?.regionId
    || payload.focusTurnCard?.regionId
    || payload.regionalContext?.regionId;
}

function heroTitle(payload: ResultPagePayload) {
  const region = publicRegionLabel(focusRegionId(payload));
  if (payload.runSummary?.runKind === "one_shot_journey" && region !== "未知区域") {
    return `${region}探索历程`;
  }
  if (region !== "未知区域") return `${region}探索历程`;
  const identityName = publicIdentityName(payload);
  return identityName === "行动身份" ? "探索历程已更新" : `${identityName}的探索历程`;
}

function heroSummary(payload: ResultPagePayload) {
  const region = publicRegionLabel(focusRegionId(payload));
  const latestHostedAction = payload.focusHostedSession?.actions.at(-1);
  const outcome = payload.focusTurnCard?.resolution?.outcomeSummary
    || latestHostedAction?.outcomeSummary
    || payload.journey?.stateDelta?.outcomeSummary;
  if (outcome && outcome !== payload.publicSafeSummary.text) {
    return `${region} · ${publicText(outcome)}`;
  }
  const summary = publicText(payload.publicSafeSummary.text);
  return isInternalResultName(summary) || /install[_\s-]?smoke/i.test(summary)
    ? `${region} · 本次探索已整理为可分享的历程摘要。`
    : summary;
}

function eventBody(event: ResultPagePayload["progress"]["latestEvents"][number], index: number) {
  const payload = payloadRecord(event.payload);
  const summary = payloadString(payload.summary)
    || payloadString(payload.outcomeSummary)
    || payloadString(payload.visibleText)
    || payloadString(payload.reason)
    || `第 ${index + 1} 段探索已记录。`;
  return publicText(summary);
}

function eventTimeline(payload: ResultPagePayload): readonly PublicResultTimelineItem[] {
  if (payload.journey?.episodes.length) {
    return payload.journey.episodes.map((episode, index) => ({
      title: publicText(episode.title),
      body: episode.narrative
        ? publicText(episode.narrative.kind === "grounded_narrative" && episode.narrative.postcard
            ? episode.narrative.postcard.text
            : episode.narrative.confirmedFacts.map((fact) => fact.text).join("；"))
        : `${publicRegionLabel(payload.journey?.regionId)} · 服务器记录结果：${publicText(episode.outcomeKey)}`,
      marker: `第 ${index + 1} 段`,
      meta: payload.journey?.startedAtWorldTime || payload.generatedAt,
    }));
  }
  const entries = payload.progress.latestEvents.slice(0, 12).map((event, index) => ({
    title: publicEventTypeLabel(event.eventType),
    body: eventBody(event, index),
    marker: `第 ${index + 1} 段`,
    meta: event.createdAt,
  }));
  if (entries.length >= 4) return entries;
  return [
    { title: "身份入场", body: `${publicIdentityName(payload)}进入本次历程。`, marker: "开局", meta: payload.generatedAt },
    { title: "探索展开", body: "服务器整理了本局可见线索。", marker: "前段", meta: payload.generatedAt },
    { title: "行动结算", body: "关键行动已进入服务器记录。", marker: "中段", meta: payload.generatedAt },
    { title: "结果归档", body: "本页整理为可分享的公开战报。", marker: "结局", meta: payload.generatedAt },
  ];
}

function consequences(payload: ResultPagePayload): readonly PublicResultConsequence[] {
  const journeyOutcome = payload.journey?.stateDelta?.outcomeSummary;
  if (journeyOutcome) return [{ label: "旅程结果", value: publicText(journeyOutcome), note: "来自服务器结算的共同事实。" }];
  const resources = Object.entries(payload.progress.resources)
    .filter(([, amount]) => Number(amount || 0) !== 0)
    .map(([resourceId, amount]) => ({
      label: publicResourceLabel(resourceId),
      value: Number(amount) > 0 ? `+${amount}` : String(amount),
      note: publicResourceDescriptions[resourceId],
    }));
  if (resources.length) return resources;
  return [{ label: "结果", value: "已记录", note: "本局没有公开资源变化。" }];
}

function pageLinks(payload: ResultPagePayload) {
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

function nextActions(payload: ResultPagePayload): readonly PublicResultNextAction[] {
  const links = pageLinks(payload);
  return [
    {
      label: "继续这个 agent",
      href: links.console,
      note: "确认这是你的档案后，可以继续消耗寿命或处理后续行动。",
    },
    ...(links.agent ? [{
      label: "查看 agent 档案",
      href: links.agent,
      note: "查看公开身份档案和近期记录。",
    }] : []),
    {
      label: "返回世界入口",
      href: links.world,
      note: "查看世界新闻、区域和其他公开战报。",
    },
    {
      label: "安装或连接",
      href: "/epoch/install",
      note: "把黑曜纪元接到你的 coding agent。",
    },
    ...payload.nextActions.slice(0, 3).map((action) => ({
      label: publicText(action.label),
      href: links.console,
      note: `${action.requiresRecoveryCode ? "恢复身份后可继续" : "公开查看"}${action.sourceType ? ` · ${publicSourceTypeLabel(action.sourceType)}` : ""}`,
    })),
  ];
}

export function buildPublicResultViewModel(page: EpochSharedResultPage & { readonly payload: ResultPagePayload }): PublicResultViewModel {
  const payload = page.payload;
  const title = heroTitle(payload);
  const eventCount = payload.receipt.canonicalEvents.length;
  const statusLabel = payload.runSummary?.runKind === "one_shot_journey" && payload.runSummary.endingReason === "completed"
    ? "完整历程已结算"
    : eventCount
      ? "服务器已结算"
      : "服务器已记录";
  return {
    pageTitle: `${title} - 黑曜纪元结果页`,
    heroTitle: title,
    heroSummary: heroSummary(payload),
    statusLabel,
    agentName: publicIdentityName(payload),
    generatedAt: payload.generatedAt,
    timeline: eventTimeline(payload),
    consequences: consequences(payload),
    nextActions: nextActions(payload),
    verification: {
      label: statusLabel,
      note: "这些信息用于确认本页来自服务器结算，不影响阅读故事。",
      eventCount,
      payloadHash: payload.receipt.payloadHash,
    },
  };
}
