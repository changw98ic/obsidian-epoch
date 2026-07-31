import type {
  EpochHostedActionRecord,
  EpochHostedSession,
  EpochProjection,
} from "./gameCore.ts";

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
  const { sceneContract: _sceneContract, ...publicSession } = session;
  return {
    ...publicSession,
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
