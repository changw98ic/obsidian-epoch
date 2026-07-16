import type { EpochResultPage } from "../../types";

interface PublicReceiptDisclosureProps {
  readonly agentServerBase: string;
  readonly eventTypeLabel: (eventType: string) => string;
  readonly resultPage: EpochResultPage;
}

export function PublicReceiptDisclosure({
  agentServerBase,
  eventTypeLabel,
  resultPage,
}: PublicReceiptDisclosureProps) {
  return (
    <div className="agent-mini-list" aria-label="校验证明">
      {resultPage.receipt.canonicalEvents.slice(0, 3).map((event) => (
        <a
          className="agent-inline-link"
          href={`${agentServerBase}${event.auditUrl}`}
          target="_blank"
          rel="noreferrer"
          key={event.eventId}
        >
          校验记录 · {eventTypeLabel(event.eventType)}
        </a>
      ))}
    </div>
  );
}
