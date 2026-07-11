import type {
  EpochHostedActionRecord,
  EpochHostedSession,
  EpochProjection,
} from "./gameCore.ts";

export interface EpochHostedSessionWatchAction {
  readonly actionId: string;
  readonly label: string;
  readonly reason: string;
  readonly toolName: string;
  readonly requiresRecoveryCode?: boolean;
}

export function hostedSessionsView(
  projection: EpochProjection,
  input: { agentId?: string; status?: string } = {},
): readonly EpochHostedSession[] {
  return Object.values(projection.hostedSessions)
    .filter((session) => !input.agentId || session.agentId === input.agentId)
    .filter((session) => !input.status || session.status === input.status)
    .sort((left, right) => right.startedAt.localeCompare(left.startedAt) || left.sessionId.localeCompare(right.sessionId));
}

export function publicHostedAction(action: EpochHostedActionRecord): EpochHostedActionRecord {
  return {
    actionId: action.actionId,
    sessionId: action.sessionId,
    agentId: action.agentId,
    channelClass: action.channelClass,
    deliveryTrust: action.deliveryTrust,
    actionOptionId: action.actionOptionId,
    optionLabel: action.optionLabel,
    ...(action.risk ? { risk: action.risk } : {}),
    ...(action.socialHookId ? { socialHookId: action.socialHookId } : {}),
    ...(action.attestationId ? { attestationId: action.attestationId } : {}),
    explanation: action.explanation,
    outcomeSummary: action.outcomeSummary,
    ...(action.reward ? { reward: action.reward } : {}),
    ...(typeof action.lifetimeDelta === "number" ? { lifetimeDelta: action.lifetimeDelta } : {}),
    recordedAt: action.recordedAt,
    signedEnvelope: action.signedEnvelope,
  };
}

export function publicHostedSession(session: EpochHostedSession): EpochHostedSession {
  return {
    ...session,
    actionOptions: [],
    actions: session.status === "completed" ? session.actions.map(publicHostedAction) : [],
  };
}

export function publicHostedSessionsView(
  projection: EpochProjection,
  input: { agentId?: string; status?: string; limit?: number } = {},
): readonly EpochHostedSession[] {
  return hostedSessionsView(projection, input)
    .slice(0, input.limit ?? 20)
    .map(publicHostedSession);
}

export function hostedSessionWatchActions(session: EpochHostedSession): readonly EpochHostedSessionWatchAction[] {
  if (session.status === "active") {
    return [{
      actionId: `watch:${session.sessionId}:active`,
      label: "等待结算",
      reason: "公开观战页会隐藏未结算行动选项；拥有者可从开局响应或授权控制台选择行动。",
      toolName: "obsidian_epoch.hosted_sessions",
    }];
  }
  return [{
    actionId: `result_page:${session.sessionId}`,
    label: "发布托管结果",
    reason: "拥有者可预览并发布为公开结果页，页面底部会保留校验证明。",
    toolName: "obsidian_epoch.result_page",
    requiresRecoveryCode: true,
  }];
}
