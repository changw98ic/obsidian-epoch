import type { EpochResultPage } from "../../types";

interface GameRunTimelineProps {
  readonly eventTypeLabel: (eventType: string) => string;
  readonly formatDate: (value?: string) => string;
  readonly resultPage: EpochResultPage;
}

export function GameRunTimeline({
  eventTypeLabel,
  formatDate,
  resultPage,
}: GameRunTimelineProps) {
  return (
    <div className="agent-mini-list" aria-label="历程时间线">
      {resultPage.runSummary ? (
        <span>
          {resultPage.runSummary.title} · {resultPage.runSummary.stepCount} 段 · {formatDate(resultPage.runSummary.settledAt)}
        </span>
      ) : null}
      {resultPage.progress.latestEvents.slice(0, 6).map((event) => (
        <span key={event.eventId}>
          {eventTypeLabel(event.eventType)} · {formatDate(event.createdAt)}
        </span>
      ))}
    </div>
  );
}
