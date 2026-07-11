import { type EpochHostedSession, type EpochTurnCard } from "./gameCore.ts";

export type EpochResultPageRunKind =
  | "single_turn"
  | "one_shot_journey"
  | "hosted_journey"
  | "agent_snapshot";

export type EpochResultPageRunEndingReason =
  | "completed"
  | "early_exit"
  | "archived"
  | "snapshot";

export interface EpochResultPageRunSummary {
  readonly runKind: EpochResultPageRunKind;
  readonly title: string;
  readonly startedAt: string;
  readonly settledAt: string;
  readonly stepCount: number;
  readonly endingReason: EpochResultPageRunEndingReason;
}

interface ResultRunSummaryEvent {
  readonly createdAt: string;
}

interface ResultRunSummaryProgress {
  readonly latestEvents: readonly ResultRunSummaryEvent[];
}

export function buildEpochResultPageRunSummary(input: Record<string, unknown>, {
  generatedAt,
  progress,
  focusTurnCard,
  focusHostedSession,
}: {
  readonly generatedAt: string;
  readonly progress: ResultRunSummaryProgress;
  readonly focusTurnCard?: EpochTurnCard;
  readonly focusHostedSession?: EpochHostedSession;
}): EpochResultPageRunSummary {
  const requestedStepCount = Number(input.stepCount);
  const requestedStepCountValue = Number.isFinite(requestedStepCount)
    ? Math.max(1, Math.min(Math.floor(requestedStepCount), 12))
    : 0;
  const focusedEventCount = Array.isArray(input.focusEventIds)
    ? input.focusEventIds.filter((eventId) => typeof eventId === "string" && eventId.trim().length > 0).length
    : 0;
  const hostedActionCount = focusHostedSession?.actions.length || 0;
  const visibleEventCount = progress.latestEvents.length;
  const stepCount = focusTurnCard
    ? 1
    : requestedStepCountValue || Math.max(
      hostedActionCount,
      Math.min(Math.max(focusedEventCount, visibleEventCount), 12),
      1,
    );
  const runKind: EpochResultPageRunKind = focusTurnCard
    ? "single_turn"
    : focusHostedSession
      ? "hosted_journey"
      : stepCount >= 8
        ? "one_shot_journey"
        : "agent_snapshot";
  const titleByKind: Record<EpochResultPageRunKind, string> = {
    single_turn: "单次行动记录",
    one_shot_journey: "完整探索历程",
    hosted_journey: "托管探索历程",
    agent_snapshot: "身份快照",
  };
  return {
    runKind,
    title: titleByKind[runKind],
    startedAt: focusHostedSession?.startedAt
      || focusTurnCard?.createdAt
      || progress.latestEvents.at(-1)?.createdAt
      || generatedAt,
    settledAt: focusHostedSession?.completedAt
      || focusTurnCard?.resolvedAt
      || progress.latestEvents[0]?.createdAt
      || generatedAt,
    stepCount,
    endingReason: runKind === "agent_snapshot" ? "snapshot" : "completed",
  };
}
