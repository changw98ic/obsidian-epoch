import type { EpochProjection, EpochSocialHook } from "./gameCore.ts";
import type {
  EpochChannelClass,
  EpochCommandContext,
  EpochEventType,
  EpochIdFactory,
  EpochServerReward,
  EpochTrustClass,
} from "./protocol.ts";
import { assertNonEmptyString, normalizeTrustClass } from "./protocol.ts";
import type { EpochEventFactory } from "./eventFactory.ts";
import type {
  AttestationRecordedPayload,
  EpochEvent,
  HostedActionRecordedPayload,
  HostedActionOptionPayload,
  HostedActionRisk,
  HostedSessionStartedPayload,
  ResourceGrantedPayload,
  TurnActionOptionPayload,
  TurnCardCreatedPayload,
  TurnResolvedPayload,
} from "./events.ts";
import {
  buildSignedHostedActionEnvelope,
  buildSignedTurnCardEnvelope,
  buildSignedTurnResolutionEnvelope,
} from "./turnActionEnvelopeRules.ts";
import { resourceGrantedEvent } from "./resourceLedgerEvents.ts";
import type { JourneySceneContract } from "./journeySceneContractRules.ts";

export const TURN_OPTION_TEMPLATES: readonly Omit<HostedActionOptionPayload, "actionOptionId">[] = [
  {
    optionKey: "observe",
    label: "观察区域势态",
    risk: "low",
    explanation: {
      brief: "先观察局势，把可见线索整理成下一步依据。",
      trigger: "当前区域有未整理的公开信息，但没有必须立刻介入的服务器事件。",
      choiceReason: "低风险观察适合在信息不足时推进，避免把本地叙事直接变成世界状态。",
      rejectedAlternatives: ["不直接卷入资源或异常冲突。", "不把可见文字当成奖励或头衔声明。"],
      risk: "低风险：通常不制造敌意，也不消耗寿命。",
      expectedBenefit: "获得少量专注，并为后续行动保留更清楚的区域判断。",
    },
    outcomeSummary: "服务器记录为一次稳健观察，区域信息被整理。",
    reward: { resourceId: "focus", amount: 1, reason: "turn_observe" },
  },
  {
    optionKey: "assist",
    label: "协助区域事务",
    risk: "medium",
    explanation: {
      brief: "投入行动帮助当地事务，换取较稳的现实收益。",
      trigger: "区域事务允许身份以有限代价提供帮助。",
      choiceReason: "中风险协助比纯观察更主动，但仍受服务器资源和身份边界约束。",
      rejectedAlternatives: ["不宣称超出身份的官职或军权。", "不触碰高风险异常来换取强奖励。"],
      risk: "中风险：可能产生公开行动记录，但不会按客户端文字扩大权力。",
      expectedBenefit: "获得少量钱币，并在区域活动中留下可审计行动。",
    },
    outcomeSummary: "服务器结算为一次有效协助，获得少量钱币。",
    reward: { resourceId: "coin", amount: 1, reason: "turn_assist" },
  },
  {
    optionKey: "anomaly",
    label: "接触低阶异常",
    risk: "high",
    explanation: {
      brief: "冒险接触低阶异常，用寿命风险换取稀有资源。",
      trigger: "区域存在可由服务器结算的低阶异常接触机会。",
      choiceReason: "高风险路线适合明确愿意承受代价的身份，收益和折寿都由服务器裁定。",
      rejectedAlternatives: ["不把爽文胜利当成异常结算。", "不跳过寿命代价领取灵质。"],
      risk: "高风险：可能折损寿命，且首局保护会抑制强奖励。",
      expectedBenefit: "若服务器允许，可获得灵质；同时留下可审计的高风险记录。",
    },
    outcomeSummary: "服务器结算为高风险异常接触，获得灵质但折损寿命。",
    reward: { resourceId: "aether", amount: 1, reason: "turn_anomaly" },
    lifetimeDelta: -2,
  },
];

export const FIRST_RUN_SETTLED_EVENT_TYPES: ReadonlySet<EpochEventType> = new Set([
  "turn_resolved",
  "hosted_action_recorded",
]);
export const MAX_HIGH_RISK_SETTLED_ACTIONS_PER_IDENTITY = 2;
export const SETTLED_ACTION_WINDOW_SIZE = 8;
export const MAX_REPEATABLE_BASIC_REWARDS_PER_WINDOW = 2;
// Retained as a compatibility export. The limit now applies to the rolling
// action window instead of permanently capping an identity's progression.
export const MAX_REPEATABLE_BASIC_REWARDS_PER_IDENTITY = MAX_REPEATABLE_BASIC_REWARDS_PER_WINDOW;

export const REPEATABLE_BASIC_REWARD_KEYS: Readonly<Record<string, string>> = {
  hosted_assist: "assist",
  hosted_observe: "observe",
  turn_assist: "assist",
  turn_observe: "observe",
};

export interface TurnHostedActionRewardGrantPayloadInput {
  readonly agentId: string;
  readonly reward: EpochServerReward;
  readonly balanceBefore: number;
}

export function isTurnCardExpiredAt(expiresAt: string | undefined, nowMs: number): boolean {
  const expiresAtMs = expiresAt ? Date.parse(expiresAt) : Number.NaN;
  return Number.isFinite(expiresAtMs) && nowMs > expiresAtMs;
}

export interface TurnCardSequenceLike {
  readonly agentId: string;
  readonly sequence?: number;
  readonly status?: string;
  readonly expiresAt?: string;
}

export function nextTurnCardSequence(
  turnCardsById: Readonly<Record<string, TurnCardSequenceLike>>,
  agentId: string,
): number {
  return Math.max(
    0,
    ...Object.values(turnCardsById)
      .filter((card) => card.agentId === agentId)
      .map((card) => card.sequence || 0),
  ) + 1;
}

export function hasOpenTurnCardForAgent(
  turnCardsById: Readonly<Record<string, TurnCardSequenceLike>>,
  agentId: string,
  nowMs: number,
): boolean {
  return Object.values(turnCardsById).some((card) =>
    card.agentId === agentId
    && card.status === "open"
    && !isTurnCardExpiredAt(card.expiresAt, nowMs));
}

export function assertRequiredPositiveInteger(value: unknown, errorCode: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) throw new Error(errorCode);
  return value;
}

export function requireHostedTrust(context: EpochCommandContext) {
  const trustClass = normalizeTrustClass(context.trustClass);
  if (!["user_verified_web", "server_hosted_agent", "host_attested", "remote_attested_runner"].includes(trustClass)) {
    throw new Error("hosted_session_requires_server_trust");
  }
  return trustClass;
}

export function requireServerHostedAgentTrust(context: EpochCommandContext) {
  const trustClass = normalizeTrustClass(context.trustClass);
  if (trustClass !== "server_hosted_agent") {
    throw new Error("server_hosted_job_requires_server_trust");
  }
  return trustClass;
}

export function deriveHostedDeliveryTrust(channelClass: EpochChannelClass, trustClass: EpochTrustClass): EpochTrustClass {
  return channelClass === "browser_copy_paste" ? "untrusted_client" : trustClass;
}

export function deriveHostedEventTrust(channelClass: EpochChannelClass, trustClass: EpochTrustClass): EpochTrustClass {
  return channelClass === "browser_copy_paste" ? "untrusted_client" : trustClass;
}

export function requireTurnTrust(context: EpochCommandContext) {
  const trustClass = normalizeTrustClass(context.trustClass);
  if (!["user_verified_web", "server_hosted_agent", "host_attested", "remote_attested_runner", "system_worker"].includes(trustClass)) {
    throw new Error("turn_card_requires_server_trust");
  }
  return trustClass;
}

export function turnActionOptions(
  turnCardId: string,
  idFactory: EpochIdFactory,
  includeHighRisk: boolean,
): readonly TurnActionOptionPayload[] {
  return TURN_OPTION_TEMPLATES.filter((template) => includeHighRisk || template.risk !== "high").map((template) => ({
    actionOptionId: idFactory("action", `turn:${turnCardId}:${template.optionKey}`),
    optionKey: template.optionKey,
    label: template.label,
    risk: template.risk,
    socialHookId: template.socialHookId,
    explanation: template.explanation,
  }));
}

export function turnOptionTemplate(optionKey: string): Omit<HostedActionOptionPayload, "actionOptionId"> {
  const template = TURN_OPTION_TEMPLATES.find((candidate) => candidate.optionKey === optionKey);
  if (!template) throw new Error("turn_action_option_template_not_found");
  return template;
}

export function hasSettledPlayableAction(current: EpochProjection, agentId: string): boolean {
  return current.events.some((event) => event.agentId === agentId && FIRST_RUN_SETTLED_EVENT_TYPES.has(event.eventType));
}

export function isHighRiskSettledEvent(event: EpochEvent): boolean {
  if (event.eventType !== "turn_resolved" && event.eventType !== "hosted_action_recorded") return false;
  return event.payload.risk === "high"
    || (typeof event.payload.lifetimeDelta === "number" && event.payload.lifetimeDelta < 0);
}

function recentSettledPlayableActions(current: EpochProjection, agentId: string): readonly EpochEvent[] {
  return current.events
    .filter((event) => event.agentId === agentId && FIRST_RUN_SETTLED_EVENT_TYPES.has(event.eventType))
    .slice(-SETTLED_ACTION_WINDOW_SIZE);
}

export function highRiskSettledActionCount(current: EpochProjection, agentId: string): number {
  return recentSettledPlayableActions(current, agentId).filter(isHighRiskSettledEvent).length;
}

export function includeHighRiskOptions(current: EpochProjection, agentId: string): boolean {
  return highRiskSettledActionCount(current, agentId) < MAX_HIGH_RISK_SETTLED_ACTIONS_PER_IDENTITY;
}

export function repeatableBasicRewardKey(reward: EpochServerReward | undefined): string | undefined {
  return reward ? REPEATABLE_BASIC_REWARD_KEYS[reward.reason] : undefined;
}

export function repeatableBasicRewardCount(current: EpochProjection, agentId: string, rewardKey: string): number {
  return recentSettledPlayableActions(current, agentId).filter((event) => {
    if (event.eventType !== "turn_resolved" && event.eventType !== "hosted_action_recorded") return false;
    return repeatableBasicRewardKey(event.payload.reward) === rewardKey;
  }).length;
}

export function includeRepeatableBasicReward(
  current: EpochProjection,
  agentId: string,
  reward: EpochServerReward | undefined,
): boolean {
  const rewardKey = repeatableBasicRewardKey(reward);
  if (!rewardKey) return true;
  return repeatableBasicRewardCount(current, agentId, rewardKey) < MAX_REPEATABLE_BASIC_REWARDS_PER_WINDOW;
}

export function visibleHostedReward(
  current: EpochProjection | undefined,
  agentId: string | undefined,
  reward: EpochServerReward | undefined,
): EpochServerReward | undefined {
  if (!current || !agentId) return reward;
  return includeRepeatableBasicReward(current, agentId, reward) ? reward : undefined;
}

export function settledOutcomeSummary(
  originalSummary: string,
  intendedReward: EpochServerReward | undefined,
  grantedReward: EpochServerReward | undefined,
  lifetimeDelta?: number,
): string {
  if (!intendedReward || grantedReward) return originalSummary;
  if (typeof lifetimeDelta === "number" && lifetimeDelta < 0) {
    return "服务器已结算高风险行动并记录寿命代价；基础奖励受保护或处于冷却，本次未发放资源。";
  }
  return "服务器已记录并结算该行动；重复基础奖励处于冷却，本次未发放资源。";
}

function rewardAwareExplanation(
  explanation: HostedActionOptionPayload["explanation"],
  intendedReward: EpochServerReward,
  grantedReward: EpochServerReward | undefined,
): HostedActionOptionPayload["explanation"] {
  if (grantedReward) return explanation;
  return {
    ...explanation,
    expectedBenefit: `留下可审计行动记录；${intendedReward.resourceId} 基础奖励处于冷却，本次不发放资源。`,
  };
}

export function firstRunSettlementPolicy(
  current: EpochProjection,
  agentId: string,
  input: {
    readonly risk: HostedActionRisk;
    readonly reward?: EpochServerReward;
    readonly lifetimeDelta?: number;
  },
) {
  const identity = current.identities[agentId];
  const starterFirstPlayableAction = Boolean(
    identity
    && identity.generation === 1
    && !hasSettledPlayableAction(current, agentId),
  );
  const protectedStarterHighRisk = Boolean(
    starterFirstPlayableAction
    && input.risk === "high"
  );
  if (!protectedStarterHighRisk) {
    return {
      reward: input.reward,
      lifetimeDelta: input.lifetimeDelta,
      nonEvidence: starterFirstPlayableAction || undefined,
    };
  }
  const safeLifetimeDelta = input.lifetimeDelta && identity.lifetime.remaining + input.lifetimeDelta <= 0
    ? 1 - identity.lifetime.remaining
    : input.lifetimeDelta;
  return {
    reward: undefined,
    lifetimeDelta: safeLifetimeDelta === 0 ? undefined : safeLifetimeDelta,
    nonEvidence: true,
  };
}

export function settlementPolicy(
  current: EpochProjection,
  agentId: string,
  input: {
    readonly risk: HostedActionRisk;
    readonly reward?: EpochServerReward;
    readonly lifetimeDelta?: number;
  },
) {
  const settlement = firstRunSettlementPolicy(current, agentId, input);
  if (!includeRepeatableBasicReward(current, agentId, settlement.reward)) {
    return {
      ...settlement,
      reward: undefined,
    };
  }
  return settlement;
}

export function turnHostedActionRewardGrantPayload(
  input: TurnHostedActionRewardGrantPayloadInput,
): ResourceGrantedPayload {
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

export function hostedActionOptions(input: {
  readonly sessionId: string;
  readonly idFactory: EpochIdFactory;
  readonly socialHooks?: readonly EpochSocialHook[];
  readonly includeHighRisk?: boolean;
  readonly current?: EpochProjection;
  readonly agentId?: string;
}): readonly HostedActionOptionPayload[] {
  const {
    sessionId,
    idFactory,
    socialHooks = [],
    includeHighRisk = true,
    current,
    agentId,
  } = input;
  const observeReward: EpochServerReward = { resourceId: "focus", amount: 1, reason: "hosted_observe" };
  const assistReward: EpochServerReward = { resourceId: "coin", amount: 1, reason: "hosted_assist" };
  const visibleObserveReward = visibleHostedReward(current, agentId, observeReward);
  const visibleAssistReward = visibleHostedReward(current, agentId, assistReward);
  const baseOptions: readonly HostedActionOptionPayload[] = [
    {
      actionOptionId: idFactory("action", `observe:${sessionId}`),
      optionKey: "observe",
      label: "观察区域势态",
      risk: "low",
      explanation: rewardAwareExplanation(TURN_OPTION_TEMPLATES[0].explanation, observeReward, visibleObserveReward),
      outcomeSummary: settledOutcomeSummary(
        "服务器记录为一次稳健观察，区域信息被整理并获得少量专注。",
        observeReward,
        visibleObserveReward,
      ),
      reward: visibleObserveReward,
    },
    {
      actionOptionId: idFactory("action", `assist:${sessionId}`),
      optionKey: "assist",
      label: "协助区域事务",
      risk: "medium",
      explanation: rewardAwareExplanation(TURN_OPTION_TEMPLATES[1].explanation, assistReward, visibleAssistReward),
      outcomeSummary: settledOutcomeSummary(
        "服务器结算为一次有效协助，获得少量钱币。",
        assistReward,
        visibleAssistReward,
      ),
      reward: visibleAssistReward,
    },
    {
      actionOptionId: idFactory("action", `anomaly:${sessionId}`),
      optionKey: "anomaly",
      label: "接触低阶异常",
      risk: "high",
      explanation: TURN_OPTION_TEMPLATES[2].explanation,
      outcomeSummary: "服务器结算为高风险异常接触，获得灵质但折损寿命。",
      reward: { resourceId: "aether", amount: 1, reason: "hosted_anomaly" },
      lifetimeDelta: -2,
    },
  ];
  const socialOptions = socialHooks.slice(0, 3).map((hook) => ({
    actionOptionId: idFactory("action", `social_hook:${sessionId}:${hook.hookId}`),
    optionKey: `social_hook:${hook.hookId}`,
    label: hook.actionLabel,
    risk: hook.risk,
    socialHookId: hook.hookId,
    explanation: {
      brief: `处理人物事件：${hook.title}`,
      trigger: `${hook.title} 已进入区域人物记录。`,
      choiceReason: "该行动只处理服务器已记录的人物机会，不把新关系或奖励交给客户端声明。",
      rejectedAlternatives: ["不凭本地故事直接改写 NPC 关系。", "不伪造家族、上司或仇敌身份。"],
      risk: `${hook.risk} 风险：按人物事件的服务器风险等级结算。`,
      expectedBenefit: "推进一条可审计人物线索，并让后续关系变化继续走服务器规则。",
    },
    outcomeSummary: `服务器结算为处理人物事件：${hook.title}`,
  }));
  const options = [...baseOptions, ...socialOptions];
  return includeHighRisk ? options : options.filter((option) => option.risk !== "high");
}

function optionalTrimmedString(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export interface TurnCardCreatedPayloadInput {
  readonly envelopeId: string;
  readonly trustClass: EpochTrustClass;
  readonly turnCardId: string;
  readonly agentId: string;
  readonly explorerId: string;
  readonly regionId: string;
  readonly sequence: number;
  readonly nonce: string;
  readonly prompt: string;
  readonly visibleContext: TurnCardCreatedPayload["visibleContext"];
  readonly actionOptions: readonly TurnActionOptionPayload[];
  readonly createdAt: string;
  readonly expiresAt: string;
}

export function turnCardCreatedPayload(input: TurnCardCreatedPayloadInput): TurnCardCreatedPayload {
  return {
    turnCardId: input.turnCardId,
    agentId: input.agentId,
    explorerId: input.explorerId,
    regionId: input.regionId,
    sequence: input.sequence,
    nonce: input.nonce,
    prompt: input.prompt,
    visibleContext: input.visibleContext,
    actionOptions: input.actionOptions,
    createdAt: input.createdAt,
    expiresAt: input.expiresAt,
    signedEnvelope: buildSignedTurnCardEnvelope({
      envelopeId: input.envelopeId,
      trustClass: input.trustClass,
      turnCardId: input.turnCardId,
      agentId: input.agentId,
      explorerId: input.explorerId,
      regionId: input.regionId,
      sequence: input.sequence,
      nonce: input.nonce,
      expiresAt: input.expiresAt,
      visibleContext: input.visibleContext,
      actionOptions: input.actionOptions,
    }),
  };
}

export interface PlanTurnCardCreationEventsInput extends TurnCardCreatedPayloadInput {
  readonly makeEvent: EpochEventFactory;
}

export function planTurnCardCreationEvents(input: PlanTurnCardCreationEventsInput): readonly EpochEvent[] {
  const payload = turnCardCreatedPayload(input);
  return [input.makeEvent("turn_card_created", input.turnCardId, payload, {
    aggregateType: "turn_card",
    agentId: input.agentId,
  })];
}

export interface TurnResolvedPayloadInput {
  readonly responseEnvelopeId: string;
  readonly trustClass: EpochTrustClass;
  readonly turnCardId: string;
  readonly agentId: string;
  readonly originalEnvelopeId: string;
  readonly sequence: number;
  readonly nonce: string;
  readonly actionOptionId: string;
  readonly optionLabel: string;
  readonly risk?: HostedActionRisk;
  readonly explanation: TurnResolvedPayload["explanation"];
  readonly visibleText?: string;
  readonly outcomeSummary: string;
  readonly reward?: EpochServerReward;
  readonly lifetimeDelta?: number;
  readonly nonEvidence?: boolean;
  readonly resolvedAt: string;
}

export function turnResolvedPayload(input: TurnResolvedPayloadInput): TurnResolvedPayload {
  const visibleText = optionalTrimmedString(input.visibleText);
  return {
    turnCardId: input.turnCardId,
    agentId: input.agentId,
    channelClass: input.trustClass,
    envelopeId: input.originalEnvelopeId,
    sequence: input.sequence,
    nonce: input.nonce,
    actionOptionId: input.actionOptionId,
    optionLabel: input.optionLabel,
    risk: input.risk,
    explanation: input.explanation,
    visibleText,
    outcomeSummary: input.outcomeSummary,
    reward: input.reward,
    lifetimeDelta: input.lifetimeDelta,
    nonEvidence: input.nonEvidence,
    resolvedAt: input.resolvedAt,
    signedEnvelope: buildSignedTurnResolutionEnvelope({
      envelopeId: input.responseEnvelopeId,
      trustClass: input.trustClass,
      turnCardId: input.turnCardId,
      agentId: input.agentId,
      originalEnvelopeId: input.originalEnvelopeId,
      sequence: input.sequence,
      nonce: input.nonce,
      actionOptionId: input.actionOptionId,
      optionLabel: input.optionLabel,
      explanation: input.explanation,
      visibleText,
      outcomeSummary: input.outcomeSummary,
      reward: input.reward,
      lifetimeDelta: input.lifetimeDelta,
      nonEvidence: input.nonEvidence,
      resolvedAt: input.resolvedAt,
    }),
  };
}

export interface TurnCardLifetimeDeltaEventRequest {
  readonly delta: number;
  readonly reason: string;
  readonly finalTitle: string;
}

export interface PlanTurnCardResolutionEventsInput extends TurnResolvedPayloadInput {
  readonly makeEvent: EpochEventFactory;
  readonly balanceBefore?: (agentId: string, resourceId: EpochServerReward["resourceId"]) => number;
  readonly lifetimeEventsForDelta?: (request: TurnCardLifetimeDeltaEventRequest) => readonly EpochEvent[];
}

export function planTurnCardResolutionEvents(input: PlanTurnCardResolutionEventsInput): readonly EpochEvent[] {
  const payload = turnResolvedPayload(input);
  const resolved = input.makeEvent("turn_resolved", input.turnCardId, payload, {
    aggregateType: "turn_card",
    agentId: input.agentId,
  });
  const nextEvents: EpochEvent[] = [resolved];
  if (input.reward) {
    if (!input.balanceBefore) throw new Error("turn_resolution_reward_balance_required");
    nextEvents.push(resourceGrantedEvent(input.makeEvent, input.agentId, turnHostedActionRewardGrantPayload({
      agentId: input.agentId,
      reward: input.reward,
      balanceBefore: input.balanceBefore(input.agentId, input.reward.resourceId),
    })));
  }
  if (input.lifetimeDelta) {
    if (!input.lifetimeEventsForDelta) throw new Error("turn_resolution_lifetime_events_required");
    nextEvents.push(...input.lifetimeEventsForDelta({
      delta: input.lifetimeDelta,
      reason: "turn_action_risk",
      finalTitle: "高风险回合定档身份",
    }));
  }
  return nextEvents;
}

export interface HostedSessionStartedPayloadInput {
  readonly sessionId: string;
  readonly agentId: string;
  readonly explorerId: string;
  readonly regionId: string;
  readonly mandate: string;
  readonly channelClass: EpochChannelClass;
  readonly deliveryTrust: EpochTrustClass;
  readonly actionOptions: readonly HostedActionOptionPayload[];
  readonly sceneContract?: JourneySceneContract;
  readonly startedAt: string;
}

export function hostedSessionStartedPayload(input: HostedSessionStartedPayloadInput): HostedSessionStartedPayload {
  return {
    sessionId: input.sessionId,
    agentId: input.agentId,
    explorerId: input.explorerId,
    regionId: input.regionId,
    mandate: input.mandate,
    channelClass: input.channelClass,
    deliveryTrust: input.deliveryTrust,
    actionOptions: input.actionOptions,
    ...(input.sceneContract ? { sceneContract: input.sceneContract } : {}),
    startedAt: input.startedAt,
  };
}

export interface PlanHostedSessionStartEventsInput extends HostedSessionStartedPayloadInput {
  readonly makeEvent: EpochEventFactory;
}

export function planHostedSessionStartEvents(input: PlanHostedSessionStartEventsInput): readonly EpochEvent[] {
  const payload = hostedSessionStartedPayload(input);
  return [input.makeEvent("hosted_session_started", input.sessionId, payload, {
    aggregateType: "hosted_session",
    agentId: input.agentId,
  })];
}

export interface HostedActionRecordedPayloadInput {
  readonly envelopeId: string;
  readonly actionId: string;
  readonly sessionId: string;
  readonly agentId: string;
  readonly channelClass: EpochChannelClass;
  readonly deliveryTrust: EpochTrustClass;
  readonly actionOptionId: string;
  readonly optionLabel: string;
  readonly risk?: HostedActionRisk;
  readonly socialHookId?: string;
  readonly attestationId?: string;
  readonly explanation: HostedActionRecordedPayload["explanation"];
  readonly visibleText?: string;
  readonly outcomeSummary: string;
  readonly journeyResolution?: HostedActionRecordedPayload["journeyResolution"];
  readonly reward?: EpochServerReward;
  readonly lifetimeDelta?: number;
  readonly nonEvidence?: boolean;
  readonly recordedAt: string;
}

export function hostedActionRecordedPayload(input: HostedActionRecordedPayloadInput): HostedActionRecordedPayload {
  const visibleText = optionalTrimmedString(input.visibleText);
  return {
    actionId: input.actionId,
    sessionId: input.sessionId,
    agentId: input.agentId,
    channelClass: input.channelClass,
    deliveryTrust: input.deliveryTrust,
    actionOptionId: input.actionOptionId,
    optionLabel: input.optionLabel,
    risk: input.risk,
    socialHookId: input.socialHookId,
    attestationId: input.attestationId,
    explanation: input.explanation,
    visibleText,
    outcomeSummary: input.outcomeSummary,
    ...(input.journeyResolution ? { journeyResolution: input.journeyResolution } : {}),
    reward: input.reward,
    lifetimeDelta: input.lifetimeDelta,
    nonEvidence: input.nonEvidence,
    recordedAt: input.recordedAt,
    signedEnvelope: buildSignedHostedActionEnvelope({
      envelopeId: input.envelopeId,
      trustClass: input.deliveryTrust,
      actionId: input.actionId,
      sessionId: input.sessionId,
      agentId: input.agentId,
      channelClass: input.channelClass,
      deliveryTrust: input.deliveryTrust,
      actionOptionId: input.actionOptionId,
      optionLabel: input.optionLabel,
      risk: input.risk,
      socialHookId: input.socialHookId,
      attestationId: input.attestationId,
      explanation: input.explanation,
      visibleText,
      outcomeSummary: input.outcomeSummary,
      ...(input.journeyResolution ? { journeyResolution: input.journeyResolution } : {}),
      reward: input.reward,
      lifetimeDelta: input.lifetimeDelta,
      nonEvidence: input.nonEvidence,
      recordedAt: input.recordedAt,
    }),
  };
}

export interface AttestationRecordedPayloadInput {
  readonly attestationId: string;
  readonly runnerId: string;
  readonly runnerKeyId?: string;
  readonly challengeId: string;
  readonly sessionId: string;
  readonly agentId: string;
  readonly actionOptionId: string;
  readonly transcriptHash: string;
  readonly signature: string;
  readonly signatureBase: string;
  readonly signatureBaseHash: string;
  readonly verifiedAt: string;
}

export function attestationRecordedPayload(input: AttestationRecordedPayloadInput): AttestationRecordedPayload {
  return {
    attestationId: assertNonEmptyString(input.attestationId, "attestation_id"),
    runnerId: assertNonEmptyString(input.runnerId, "attestation_runner_id"),
    runnerKeyId: optionalTrimmedString(input.runnerKeyId),
    challengeId: assertNonEmptyString(input.challengeId, "attestation_challenge_id"),
    sessionId: input.sessionId,
    agentId: input.agentId,
    actionOptionId: input.actionOptionId,
    transcriptHash: assertNonEmptyString(input.transcriptHash, "attestation_transcript_hash"),
    signature: assertNonEmptyString(input.signature, "attestation_signature"),
    signatureBase: assertNonEmptyString(input.signatureBase, "attestation_signature_base"),
    signatureBaseHash: assertNonEmptyString(input.signatureBaseHash, "attestation_signature_base_hash"),
    verifiedAt: input.verifiedAt,
  };
}

export interface HostedActionLifetimeDeltaEventRequest {
  readonly delta: number;
  readonly reason: string;
  readonly finalTitle: string;
}

export interface PlanHostedActionSubmissionEventsInput extends Omit<HostedActionRecordedPayloadInput, "attestationId"> {
  readonly makeEvent: EpochEventFactory;
  readonly attestation?: AttestationRecordedPayloadInput;
  readonly sideEffectEvents?: (actionRecorded: EpochEvent) => readonly EpochEvent[];
  readonly balanceBefore?: (agentId: string, resourceId: EpochServerReward["resourceId"]) => number;
  readonly lifetimeEventsForDelta?: (request: HostedActionLifetimeDeltaEventRequest) => readonly EpochEvent[];
}

export function planHostedActionSubmissionEvents(input: PlanHostedActionSubmissionEventsInput): readonly EpochEvent[] {
  const nextEvents: EpochEvent[] = [];
  if (input.attestation) {
    const attestationPayload = attestationRecordedPayload(input.attestation);
    nextEvents.push(input.makeEvent("attestation_recorded", input.attestation.attestationId, attestationPayload, {
      aggregateType: "attestation",
      agentId: input.agentId,
    }));
  }
  const payload = hostedActionRecordedPayload({
    envelopeId: input.envelopeId,
    actionId: input.actionId,
    sessionId: input.sessionId,
    agentId: input.agentId,
    channelClass: input.channelClass,
    deliveryTrust: input.deliveryTrust,
    actionOptionId: input.actionOptionId,
    optionLabel: input.optionLabel,
    risk: input.risk,
    socialHookId: input.socialHookId,
    attestationId: input.attestation?.attestationId,
    explanation: input.explanation,
    visibleText: input.visibleText,
    outcomeSummary: input.outcomeSummary,
    ...(input.journeyResolution ? { journeyResolution: input.journeyResolution } : {}),
    reward: input.reward,
    lifetimeDelta: input.lifetimeDelta,
    nonEvidence: input.nonEvidence,
    recordedAt: input.recordedAt,
  });
  const actionRecorded = input.makeEvent("hosted_action_recorded", input.sessionId, payload, {
    aggregateType: "hosted_session",
    agentId: input.agentId,
  });
  nextEvents.push(actionRecorded);
  if (input.sideEffectEvents) {
    nextEvents.push(...input.sideEffectEvents(actionRecorded));
  }
  if (input.reward) {
    if (!input.balanceBefore) throw new Error("hosted_action_reward_balance_required");
    nextEvents.push(resourceGrantedEvent(input.makeEvent, input.agentId, turnHostedActionRewardGrantPayload({
      agentId: input.agentId,
      reward: input.reward,
      balanceBefore: input.balanceBefore(input.agentId, input.reward.resourceId),
    })));
  }
  if (input.lifetimeDelta) {
    if (!input.lifetimeEventsForDelta) throw new Error("hosted_action_lifetime_events_required");
    nextEvents.push(...input.lifetimeEventsForDelta({
      delta: input.lifetimeDelta,
      reason: "hosted_action_risk",
      finalTitle: "托管行动定档身份",
    }));
  }
  return nextEvents;
}
