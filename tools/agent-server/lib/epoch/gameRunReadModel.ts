import type { EpochEventType } from "./protocol.ts";
import type {
  EpochResultPagePayload,
  EpochSharedResultPage,
} from "./runtime.ts";
import type { EpochResultPageRunEndingReason } from "./resultRunSummary.ts";
import {
  publicEventTypeLabel,
  publicText,
} from "./publicVocabulary.ts";

export type EpochGameRunStatus =
  | "draft"
  | "running"
  | "settling"
  | "settled"
  | "published"
  | "archived";

export interface EpochGameRunAct {
  readonly actIndex: number;
  readonly title: string;
  readonly summary: string;
  readonly startedAt?: string;
  readonly settledAt?: string;
  readonly sourceKind: "journey_step" | "turn_card" | "hosted_action" | "event" | "snapshot";
  readonly sourceId?: string;
  readonly auditUrl?: string;
}

export interface EpochGameRunOutcome {
  readonly summary: string;
  readonly endingReason: EpochResultPageRunEndingReason;
  readonly settledAt?: string;
}

export interface EpochGameRunReadModel {
  readonly runId: string;
  readonly agentId?: string;
  readonly explorerId?: string;
  readonly title: string;
  readonly status: EpochGameRunStatus;
  readonly startedAt: string;
  readonly settledAt?: string;
  readonly publishedAt?: string;
  readonly stepCount: number;
  readonly acts: readonly EpochGameRunAct[];
  readonly finalOutcome?: EpochGameRunOutcome;
}

type ResultPagePayload = NonNullable<EpochSharedResultPage["payload"]>;
type ResultPageEvent = ResultPagePayload["progress"]["latestEvents"][number];

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function eventSummary(event: ResultPageEvent | undefined, actIndex: number) {
  if (!event) return `第 ${actIndex} 段探索已结算。`;
  const payload = recordValue(event.payload);
  return publicText(
    stringValue(payload.outcomeSummary)
      || stringValue(payload.summary)
      || stringValue(payload.visibleText)
      || stringValue(payload.reason)
      || `${publicEventTypeLabel(event.eventType)}已记录。`,
  );
}

function eventTitle(event: ResultPageEvent | undefined, actIndex: number) {
  if (!event) return `第 ${actIndex} 段探索`;
  const payload = recordValue(event.payload);
  return publicText(
    stringValue(payload.optionLabel)
      || stringValue(payload.actionLabel)
      || stringValue(payload.actionOptionLabel)
      || publicEventTypeLabel(event.eventType),
  );
}

function sourceKind(eventType: EpochEventType | string | undefined): EpochGameRunAct["sourceKind"] {
  if (eventType === "hosted_action_recorded") return "hosted_action";
  if (eventType === "turn_resolved" || eventType === "turn_card_created") return "turn_card";
  if (eventType) return "event";
  return "journey_step";
}

function sourceEventsForActs(payload: EpochResultPagePayload) {
  const events = [...payload.progress.latestEvents]
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.eventId.localeCompare(right.eventId));
  const hostedActions = events.filter((event) => event.eventType === "hosted_action_recorded");
  if (hostedActions.length) return hostedActions;
  const resolvedTurns = events.filter((event) => event.eventType === "turn_resolved");
  if (resolvedTurns.length) return resolvedTurns;
  return events;
}

function runStatusForPage(page: EpochSharedResultPage): EpochGameRunStatus {
  if ((page.status || "active") === "deleted" || (page.status || "active") === "revoked") return "archived";
  if (page.payload?.runSummary?.settledAt) return "settled";
  return "published";
}

function finalOutcomeSummary(payload: EpochResultPagePayload) {
  if (payload.journey?.mission?.outcome?.summary) return publicText(payload.journey.mission.outcome.summary);
  if (payload.runSummary?.runKind === "one_shot_journey" && payload.runSummary.endingReason === "completed") {
    return "完整历程已结算。";
  }
  if (payload.focusTurnCard?.resolution?.outcomeSummary) return publicText(payload.focusTurnCard.resolution.outcomeSummary);
  const latestHostedAction = payload.focusHostedSession?.actions.at(-1);
  if (latestHostedAction?.outcomeSummary) return publicText(latestHostedAction.outcomeSummary);
  return `${payload.runSummary?.title || "探索历程"}已结算。`;
}

export function buildEpochGameRunReadModelForResultPage(
  page: EpochSharedResultPage,
): EpochGameRunReadModel | undefined {
  const payload = page.payload;
  if (!payload) return undefined;
  const runSummary = payload.runSummary;
  const sourceEvents = sourceEventsForActs(payload);
  const stepCount = Math.max(1, runSummary?.stepCount || sourceEvents.length || 1);
  const acts: EpochGameRunAct[] = Array.from({ length: stepCount }, (_, index) => {
    const event = sourceEvents[index];
    const actIndex = index + 1;
    return {
      actIndex,
      title: eventTitle(event, actIndex),
      summary: eventSummary(event, actIndex),
      startedAt: event?.createdAt,
      settledAt: event?.createdAt,
      sourceKind: sourceKind(event?.eventType),
      sourceId: event?.eventId,
      auditUrl: event ? `/epoch/audit/${encodeURIComponent(event.eventId)}` : undefined,
    };
  });
  return {
    runId: page.pageId,
    agentId: payload.progress.agentId || payload.receipt.agentId,
    explorerId: payload.progress.explorerId || payload.receipt.explorerId,
    title: runSummary?.title || "探索历程",
    status: runStatusForPage(page),
    startedAt: runSummary?.startedAt || acts[0]?.startedAt || page.createdAt,
    settledAt: runSummary?.settledAt || acts.at(-1)?.settledAt || page.createdAt,
    publishedAt: page.createdAt,
    stepCount,
    acts,
    finalOutcome: {
      summary: finalOutcomeSummary(payload),
      endingReason: runSummary?.endingReason || "snapshot",
      settledAt: runSummary?.settledAt || acts.at(-1)?.settledAt || page.createdAt,
    },
  };
}
