import type {
  DowntimeClaimedPayload,
  DowntimeSetPayload,
  DowntimeTickResolvedPayload,
  EpochEvent,
  ResourceGrantedPayload,
} from "./events.ts";
import type { EpochEventFactory } from "./eventFactory.ts";
import type {
  EpochDowntimeMode,
  EpochResourceId,
  EpochServerReward,
} from "./protocol.ts";
import { stableKey } from "./protocol.ts";
import { resourceGrantedEvent } from "./resourceLedgerEvents.ts";

export const DEFAULT_MAX_DOWNTIME_SECONDS = 8 * 60 * 60;
export const DEFAULT_DOWNTIME_REGION_ID = "region_gray_harbor";

export type EpochDowntimeDiaryPhase = "tick" | "claim";

export interface EpochDowntimeDiaryEntry {
  readonly diaryId: string;
  readonly agentId: string;
  readonly mode: EpochDowntimeMode;
  readonly regionId: string;
  readonly phase: EpochDowntimeDiaryPhase;
  readonly title: string;
  readonly summary: string;
  readonly elapsedSeconds: number;
  readonly capped: boolean;
  readonly rewards: readonly EpochServerReward[];
  readonly occurredAt: string;
  readonly sourceEventId: string;
  readonly sourceEventType: "downtime_tick_resolved" | "downtime_claimed";
}

export interface DowntimeDiaryEntryInput {
  readonly diaryId: string;
  readonly agentId: string;
  readonly mode: EpochDowntimeMode;
  readonly regionId: string;
  readonly phase: EpochDowntimeDiaryPhase;
  readonly elapsedSeconds: number;
  readonly capped: boolean;
  readonly rewards: readonly EpochServerReward[];
  readonly occurredAt: string;
  readonly sourceEventId: string;
  readonly diaryEntry?: {
    readonly title?: string;
    readonly summary?: string;
  };
}

export interface EpochDowntimeState {
  readonly agentId: string;
  readonly mode: EpochDowntimeMode;
  readonly regionId: string;
  readonly startedAt: string;
  readonly active: boolean;
  readonly lastClaimedAt?: string;
  readonly lastRewards?: readonly EpochServerReward[];
  readonly lastClaimDiaryEntry?: EpochDowntimeDiaryEntry;
  readonly lastTickedAt?: string;
  readonly lastTickRewards?: readonly EpochServerReward[];
  readonly lastTickDiaryEntry?: EpochDowntimeDiaryEntry;
}

export interface EpochPendingDowntimePreview {
  readonly agentId: string;
  readonly mode: EpochDowntimeMode;
  readonly regionId: string;
  readonly startedAt: string;
  readonly previewedAt: string;
  readonly elapsedSecondsRaw: number;
  readonly elapsedSeconds: number;
  readonly maxSeconds: number;
  readonly capped: boolean;
  readonly rewards: readonly EpochServerReward[];
  readonly riskWarnings: readonly string[];
  readonly nextRewardAt?: string;
}

export interface PreviewEpochDowntimeInput {
  readonly downtime?: EpochDowntimeState | null;
  readonly now?: string;
  readonly maxDowntimeSeconds?: number;
}

export interface DowntimeSetPayloadInput {
  readonly mode: EpochDowntimeMode;
  readonly regionId?: string;
  readonly startedAt: string;
}

export interface DowntimeClaimedPayloadInput {
  readonly mode: EpochDowntimeMode;
  readonly regionId?: string;
  readonly startedAt: string;
  readonly claimedAt: string;
  readonly maxDowntimeSeconds: number;
}

export interface DowntimeTickResolvedPayloadInput {
  readonly mode: EpochDowntimeMode;
  readonly regionId?: string;
  readonly startedAt: string;
  readonly tickedAt: string;
  readonly maxDowntimeSeconds: number;
}

export interface DowntimeRewardGrantPayloadInput {
  readonly agentId: string;
  readonly reward: EpochServerReward;
  readonly balanceBefore: number;
}

export interface DowntimeStateForEventPlanning {
  readonly mode: EpochDowntimeMode;
  readonly regionId: string;
  readonly startedAt: string;
}

export interface PlanDowntimeSetEventsInput {
  readonly agentId: string;
  readonly mode: EpochDowntimeMode;
  readonly regionId?: string;
  readonly startedAt: string;
  readonly makeEvent: EpochEventFactory;
}

export type DowntimeBalanceBefore = (
  plannedGrantEvents: readonly EpochEvent[],
  agentId: string,
  resourceId: EpochResourceId,
) => number;

export interface PlanDowntimeClaimEventsInput {
  readonly agentId: string;
  readonly downtime: DowntimeStateForEventPlanning;
  readonly claimedAt: string;
  readonly maxDowntimeSeconds: number;
  readonly balanceBefore: DowntimeBalanceBefore;
  readonly makeEvent: EpochEventFactory;
}

export interface DowntimeTickTarget {
  readonly agentId: string;
  readonly downtime: DowntimeStateForEventPlanning;
}

export interface PlanDowntimeTickEventsInput {
  readonly targets: readonly DowntimeTickTarget[];
  readonly tickedAt: string;
  readonly maxDowntimeSeconds: number;
  readonly balanceBefore: DowntimeBalanceBefore;
  readonly makeEvent: EpochEventFactory;
}

export interface DowntimeProjectionForRules<TDowntime = unknown> {
  readonly downtime: Readonly<Record<string, TDowntime | undefined>>;
}

export interface ProjectDowntimeStateInput<TDowntime> {
  readonly projection: DowntimeProjectionForRules<TDowntime>;
  readonly events: readonly EpochEvent[];
  readonly agentId?: string;
}

export interface ProjectDowntimeTickResultInput<TDowntime> {
  readonly projection: DowntimeProjectionForRules<TDowntime>;
  readonly agentIds: readonly string[];
  readonly tickedAt: string;
}

export interface ProjectedDowntimeTickResult<TDowntime> {
  readonly tickedAt: string;
  readonly updated: readonly TDowntime[];
}

export const DOWNTIME_REWARD: Record<EpochDowntimeMode, { resourceId: EpochResourceId; secondsPerUnit: number; reason: string }> = {
  meditation: { resourceId: "focus", secondsPerUnit: 300, reason: "downtime_meditation" },
  cultivation: { resourceId: "aether", secondsPerUnit: 600, reason: "downtime_cultivation" },
  training: { resourceId: "stamina", secondsPerUnit: 300, reason: "downtime_training" },
  resting: { resourceId: "stamina", secondsPerUnit: 180, reason: "downtime_resting" },
  slacking: { resourceId: "coin", secondsPerUnit: 900, reason: "downtime_slacking" },
  travel: { resourceId: "legend", secondsPerUnit: 1_800, reason: "downtime_travel" },
  steward: { resourceId: "coin", secondsPerUnit: 600, reason: "downtime_steward" },
  socialize: { resourceId: "focus", secondsPerUnit: 900, reason: "downtime_socialize" },
};

export const DOWNTIME_DIARY_TITLES: Record<EpochDowntimeMode, string> = {
  meditation: "静心冥想",
  cultivation: "灵质修炼",
  training: "体能训练",
  resting: "安稳休整",
  slacking: "摸鱼闲逛",
  travel: "外出游历",
  steward: "看店打理",
  socialize: "街坊社交",
};

const DOWNTIME_DIARY_VERBS: Record<EpochDowntimeMode, string> = {
  meditation: "在静室里整理心绪",
  cultivation: "沿着灵质潮汐缓慢吐纳",
  training: "完成了一轮基础体能训练",
  resting: "补足睡眠并处理琐事",
  slacking: "在街角和熟人闲聊摸鱼",
  travel: "离开常驻地记录沿途见闻",
  steward: "整理货架、清点补给并照看店面",
  socialize: "拜访熟人、交换传闻并维护联系人",
};

function downtimeElapsedLabel(elapsedSeconds: number) {
  const minutes = Math.max(0, Math.floor(elapsedSeconds / 60));
  if (minutes >= 60) return `${Math.floor(minutes / 60)}小时${minutes % 60}分钟`;
  return `${minutes}分钟`;
}

function downtimeRewardSummary(rewards: readonly EpochServerReward[]) {
  if (!rewards.length) return "暂未获得可结算资源";
  return rewards
    .map((reward) => `${reward.resourceId}+${reward.amount}`)
    .join(" / ");
}

export function normalizeDowntimeRegionId(regionId: unknown): string {
  const normalized = typeof regionId === "string" && regionId.trim()
    ? stableKey(regionId)
    : "";
  return normalized || DEFAULT_DOWNTIME_REGION_ID;
}

export function downtimeSetPayload(input: DowntimeSetPayloadInput): DowntimeSetPayload {
  return {
    mode: input.mode,
    regionId: normalizeDowntimeRegionId(input.regionId),
    startedAt: input.startedAt,
  };
}

export function downtimeDiaryPayload(
  mode: EpochDowntimeMode,
  phase: EpochDowntimeDiaryPhase,
  elapsedSeconds: number,
  rewards: readonly EpochServerReward[],
  capped: boolean,
) {
  const prefix = phase === "tick" ? "服务器巡检" : "领取结算";
  const cappedText = capped ? "，已触达托管上限" : "";
  return {
    title: DOWNTIME_DIARY_TITLES[mode],
    summary: `${prefix}：${DOWNTIME_DIARY_VERBS[mode]}，持续${downtimeElapsedLabel(elapsedSeconds)}，${downtimeRewardSummary(rewards)}${cappedText}。`,
  };
}

export function downtimeDiaryEntry(input: DowntimeDiaryEntryInput): EpochDowntimeDiaryEntry {
  const payload = downtimeDiaryPayload(input.mode, input.phase, input.elapsedSeconds, input.rewards, input.capped);
  return {
    diaryId: input.diaryId,
    agentId: input.agentId,
    mode: input.mode,
    regionId: input.regionId,
    phase: input.phase,
    title: input.diaryEntry?.title || payload.title,
    summary: input.diaryEntry?.summary || payload.summary,
    elapsedSeconds: input.elapsedSeconds,
    capped: input.capped,
    rewards: input.rewards,
    occurredAt: input.occurredAt,
    sourceEventId: input.sourceEventId,
    sourceEventType: input.phase === "tick" ? "downtime_tick_resolved" : "downtime_claimed",
  };
}

export function downtimeRewards(
  mode: EpochDowntimeMode,
  elapsedSeconds: number,
  reasonPrefix: string,
): readonly EpochServerReward[] {
  const rewardRule = DOWNTIME_REWARD[mode];
  const amount = Math.floor(elapsedSeconds / rewardRule.secondsPerUnit);
  return amount > 0
    ? [{
        resourceId: rewardRule.resourceId,
        amount,
        reason: `${reasonPrefix}_${mode}`,
      }]
    : [];
}

export function downtimeRewardGrantPayload(input: DowntimeRewardGrantPayloadInput): ResourceGrantedPayload {
  return {
    resourceId: input.reward.resourceId,
    amount: input.reward.amount,
    reason: input.reward.reason,
    balanceAfter: input.balanceBefore + input.reward.amount,
    accountRef: `agent:${input.agentId}`,
    assetKey: `resource:${input.reward.resourceId}`,
    unit: "unit",
    quantityMinor: (BigInt(input.reward.amount) * 100n).toString(),
  };
}

export function planDowntimeSetEvents(input: PlanDowntimeSetEventsInput): readonly EpochEvent[] {
  const payload = downtimeSetPayload({
    mode: input.mode,
    regionId: input.regionId,
    startedAt: input.startedAt,
  });
  return [
    input.makeEvent("downtime_set", input.agentId, payload, {
      aggregateType: "downtime",
      agentId: input.agentId,
    }),
  ];
}

export function planDowntimeClaimEvents(input: PlanDowntimeClaimEventsInput): readonly EpochEvent[] {
  const claimedPayload = downtimeClaimedPayload({
    mode: input.downtime.mode,
    regionId: input.downtime.regionId,
    startedAt: input.downtime.startedAt,
    claimedAt: input.claimedAt,
    maxDowntimeSeconds: input.maxDowntimeSeconds,
  });
  const nextEvents: EpochEvent[] = [
    input.makeEvent("downtime_claimed", input.agentId, claimedPayload, {
      aggregateType: "downtime",
      agentId: input.agentId,
    }),
  ];
  const grantEvents: EpochEvent[] = [];
  for (const reward of claimedPayload.rewards) {
    const granted = resourceGrantedEvent(input.makeEvent, input.agentId, downtimeRewardGrantPayload({
      agentId: input.agentId,
      reward,
      balanceBefore: input.balanceBefore(grantEvents, input.agentId, reward.resourceId),
    }));
    nextEvents.push(granted);
    grantEvents.push(granted);
  }
  return nextEvents;
}

export function planDowntimeTickEvents(input: PlanDowntimeTickEventsInput): readonly EpochEvent[] {
  const nextEvents: EpochEvent[] = [];
  const grantEvents: EpochEvent[] = [];
  for (const target of input.targets) {
    const payload = downtimeTickResolvedPayload({
      mode: target.downtime.mode,
      regionId: target.downtime.regionId,
      startedAt: target.downtime.startedAt,
      tickedAt: input.tickedAt,
      maxDowntimeSeconds: input.maxDowntimeSeconds,
    });
    nextEvents.push(input.makeEvent("downtime_tick_resolved", target.agentId, payload, {
      aggregateType: "downtime",
      agentId: target.agentId,
    }));
    for (const reward of payload.rewards) {
      const granted = resourceGrantedEvent(input.makeEvent, target.agentId, downtimeRewardGrantPayload({
        agentId: target.agentId,
        reward,
        balanceBefore: input.balanceBefore(grantEvents, target.agentId, reward.resourceId),
      }));
      nextEvents.push(granted);
      grantEvents.push(granted);
    }
  }
  return nextEvents;
}

export function projectDowntimeState<TDowntime>(
  input: ProjectDowntimeStateInput<TDowntime>,
): TDowntime {
  const downtimeEvent = input.events.find((event) =>
    event.eventType === "downtime_set" || event.eventType === "downtime_claimed");
  const agentId = input.agentId || downtimeEvent?.agentId || downtimeEvent?.aggregateId;
  const downtime = agentId ? input.projection.downtime[agentId] : undefined;
  if (!downtime) throw new Error("downtime_projection_failed");
  return downtime;
}

export function projectDowntimeTickResult<TDowntime>(
  input: ProjectDowntimeTickResultInput<TDowntime>,
): ProjectedDowntimeTickResult<TDowntime> {
  return {
    tickedAt: input.tickedAt,
    updated: input.agentIds
      .map((agentId) => input.projection.downtime[agentId])
      .filter((downtime): downtime is TDowntime => Boolean(downtime)),
  };
}

function downtimeSettlementTiming(
  mode: EpochDowntimeMode,
  startedAt: string,
  occurredAt: string,
  maxDowntimeSeconds: number,
  reasonPrefix: string,
) {
  const elapsedSecondsRaw = Math.max(0, Math.floor((Date.parse(occurredAt) - Date.parse(startedAt)) / 1_000));
  const elapsedSeconds = Math.min(elapsedSecondsRaw, maxDowntimeSeconds);
  const capped = elapsedSecondsRaw > maxDowntimeSeconds;
  const rewards = downtimeRewards(mode, elapsedSeconds, reasonPrefix);
  return {
    elapsedSeconds,
    capped,
    rewards,
  };
}

export function downtimeClaimedPayload(input: DowntimeClaimedPayloadInput): DowntimeClaimedPayload {
  const settlement = downtimeSettlementTiming(
    input.mode,
    input.startedAt,
    input.claimedAt,
    input.maxDowntimeSeconds,
    "downtime",
  );
  return {
    mode: input.mode,
    regionId: normalizeDowntimeRegionId(input.regionId),
    startedAt: input.startedAt,
    claimedAt: input.claimedAt,
    elapsedSeconds: settlement.elapsedSeconds,
    capped: settlement.capped,
    rewards: settlement.rewards,
    diaryEntry: downtimeDiaryPayload(input.mode, "claim", settlement.elapsedSeconds, settlement.rewards, settlement.capped),
  };
}

export function downtimeTickResolvedPayload(input: DowntimeTickResolvedPayloadInput): DowntimeTickResolvedPayload {
  const settlement = downtimeSettlementTiming(
    input.mode,
    input.startedAt,
    input.tickedAt,
    input.maxDowntimeSeconds,
    "downtime_tick",
  );
  return {
    mode: input.mode,
    regionId: normalizeDowntimeRegionId(input.regionId),
    startedAt: input.startedAt,
    tickedAt: input.tickedAt,
    elapsedSeconds: settlement.elapsedSeconds,
    capped: settlement.capped,
    rewards: settlement.rewards,
    diaryEntry: downtimeDiaryPayload(input.mode, "tick", settlement.elapsedSeconds, settlement.rewards, settlement.capped),
  };
}

export function downtimeTickLimit(value: number | undefined): number {
  return Math.max(1, Math.min(Math.floor(Number(value || 25)), 100));
}

export function selectDowntimeTickAgentIds(
  downtimeByAgentId: Readonly<Record<string, unknown>>,
  limit: number | undefined,
): readonly string[] {
  return Object.keys(downtimeByAgentId)
    .sort()
    .slice(0, downtimeTickLimit(limit));
}

function downtimeRiskWarnings(
  mode: EpochDowntimeMode,
  elapsedSeconds: number,
  capped: boolean,
  rewards: readonly EpochServerReward[],
) {
  const rewardRule = DOWNTIME_REWARD[mode];
  const warnings: string[] = [];
  if (!rewards.length) {
    warnings.push(`尚未达到${Math.ceil(rewardRule.secondsPerUnit / 60)}分钟结算间隔，立即领取不会产出资源。`);
  }
  if (capped) {
    warnings.push("已触达托管上限，继续等待不会增加收益。");
  }
  if (mode === "slacking") {
    warnings.push("摸鱼只产出低额钱币，适合保底但成长较慢。");
  }
  if (mode === "travel" && elapsedSeconds < rewardRule.secondsPerUnit) {
    warnings.push("外出游历结算间隔较长，短时领取可能没有传说度。");
  }
  if (mode === "steward") {
    warnings.push("看店只产出稳定钱币，不会直接生成稀有物品或市场优势。");
  }
  if (mode === "socialize" && elapsedSeconds < rewardRule.secondsPerUnit) {
    warnings.push("社交需要完整拜访窗口，短时领取可能没有专注收益。");
  }
  return warnings;
}

export function previewEpochDowntime(input: PreviewEpochDowntimeInput): EpochPendingDowntimePreview | null {
  const downtime = input.downtime;
  if (!downtime?.active) return null;
  const previewedAt = input.now || new Date().toISOString();
  const maxSeconds = Math.max(0, Math.floor(Number(input.maxDowntimeSeconds || DEFAULT_MAX_DOWNTIME_SECONDS)));
  const elapsedSecondsRaw = Math.max(0, Math.floor((Date.parse(previewedAt) - Date.parse(downtime.startedAt)) / 1_000));
  const elapsedSeconds = Math.min(elapsedSecondsRaw, maxSeconds);
  const capped = elapsedSecondsRaw > maxSeconds;
  const rewards = downtimeRewards(downtime.mode, elapsedSeconds, "downtime");
  const rewardRule = DOWNTIME_REWARD[downtime.mode];
  const nextRewardSeconds = (Math.floor(elapsedSeconds / rewardRule.secondsPerUnit) + 1) * rewardRule.secondsPerUnit;
  const nextRewardAt = !capped && nextRewardSeconds <= maxSeconds
    ? new Date(Date.parse(downtime.startedAt) + nextRewardSeconds * 1_000).toISOString()
    : undefined;
  return {
    agentId: downtime.agentId,
    mode: downtime.mode,
    regionId: downtime.regionId,
    startedAt: downtime.startedAt,
    previewedAt,
    elapsedSecondsRaw,
    elapsedSeconds,
    maxSeconds,
    capped,
    rewards,
    riskWarnings: downtimeRiskWarnings(downtime.mode, elapsedSeconds, capped, rewards),
    nextRewardAt,
  };
}
