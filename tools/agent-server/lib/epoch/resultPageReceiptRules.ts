import type { EpochEvent } from "./events.ts";
import type { EpochProjection } from "./gameCore.ts";
import { normalizeTrustClass, type EpochEventType, type EpochTrustClass } from "./protocol.ts";
import {
  stableResultPageJson,
} from "./resultPageRuntimeRules.ts";
import type {
  EpochResultPagePayload,
  EpochResultPageReceipt,
  EpochResultPageReceiptEvent,
  EpochTrustedExecutionReceipt,
} from "./runtime.ts";
import { sha256Hex } from "./runtimeAuth.ts";

type AnyRecord = Readonly<Record<string, unknown>>;

function recordValue(value: unknown): AnyRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as AnyRecord : {};
}

export function resultPageReceiptFocus(payload: Omit<EpochResultPagePayload, "receipt">): EpochResultPageReceipt["focus"] {
  if (payload.focusTurnCard) {
    return {
      kind: "turn_card",
      id: payload.focusTurnCard.turnCardId,
    };
  }
  if (payload.focusHostedSession) {
    return {
      kind: "hosted_session",
      id: payload.focusHostedSession.sessionId,
    };
  }
  if (payload.progress.agentId) {
    return {
      kind: "agent_snapshot",
      id: payload.progress.agentId,
    };
  }
  return {
    kind: "explorer_snapshot",
    id: payload.progress.explorerId || "unknown_explorer",
  };
}

function eventMatchesResultFocus(event: EpochEvent, focus: EpochResultPageReceipt["focus"]) {
  const payload = recordValue(event.payload);
  return event.aggregateId === focus.id
    || event.causationId === focus.id
    || event.correlationId === focus.id
    || payload.turnCardId === focus.id
    || payload.sessionId === focus.id
    || payload.hostedSessionId === focus.id
    || payload.agentId === focus.id
    || payload.explorerId === focus.id;
}

function resultPageReceiptEvents(
  projection: EpochProjection,
  payload: Omit<EpochResultPagePayload, "receipt">,
  focus: EpochResultPageReceipt["focus"],
): readonly EpochResultPageReceiptEvent[] {
  const byId = new Map<string, EpochEvent>();
  const addEvent = (event: EpochEvent | undefined) => {
    if (event) byId.set(event.eventId, event);
  };
  projection.events.filter((event) => eventMatchesResultFocus(event, focus)).forEach(addEvent);
  payload.progress.latestEvents.forEach(addEvent);
  return [...byId.values()]
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt) || right.eventId.localeCompare(left.eventId))
    .slice(0, 12)
    .map((event) => ({
      eventId: event.eventId,
      eventType: event.eventType,
      aggregateType: event.aggregateType,
      aggregateId: event.aggregateId,
      trustClass: event.trustClass,
      createdAt: event.createdAt,
      auditUrl: `/epoch/audit/${encodeURIComponent(event.eventId)}`,
    }));
}

function eventByPayloadField(
  projection: EpochProjection,
  eventType: EpochEventType,
  field: string,
  value: string,
) {
  return projection.events.find((event) => {
    if (event.eventType !== eventType) return false;
    const payload = recordValue(event.payload);
    return payload[field] === value;
  });
}

function resultPageTrustedExecutionReceipts(
  projection: EpochProjection,
  payload: Omit<EpochResultPagePayload, "receipt">,
  resultPagePayloadHash: string,
): readonly EpochTrustedExecutionReceipt[] {
  const session = payload.focusHostedSession;
  if (!session) return [];
  return session.actions.flatMap((action) => {
    if (!action.attestationId) return [];
    const attestation = projection.attestationRecords[action.attestationId];
    if (!attestation) return [];
    const attestationEvent = eventByPayloadField(projection, "attestation_recorded", "attestationId", attestation.attestationId);
    const actionEvent = eventByPayloadField(projection, "hosted_action_recorded", "actionId", action.actionId);
    return [{
      receiptType: "trusted_execution_receipt",
      attestationId: attestation.attestationId,
      runnerId: attestation.runnerId,
      runnerKeyId: attestation.runnerKeyId,
      challengeId: attestation.challengeId,
      sessionId: attestation.sessionId,
      actionId: action.actionId,
      actionOptionId: action.actionOptionId,
      optionLabel: action.optionLabel,
      transcriptHash: attestation.transcriptHash,
      signatureBase: attestation.signatureBase,
      signatureHash: `sha256:${sha256Hex(attestation.signature)}`,
      signatureBaseHash: attestation.signatureBaseHash,
      resultPagePayloadHash,
      attestationAuditUrl: attestationEvent ? `/epoch/audit/${encodeURIComponent(attestationEvent.eventId)}` : undefined,
      actionAuditUrl: actionEvent ? `/epoch/audit/${encodeURIComponent(actionEvent.eventId)}` : undefined,
    } satisfies EpochTrustedExecutionReceipt];
  });
}

const verifiedResultTrustClasses = new Set<EpochTrustClass>([
  "server_hosted_agent",
  "host_attested",
  "remote_attested_runner",
]);

const resultDeliveryTrustPriority: readonly EpochTrustClass[] = [
  "remote_attested_runner",
  "host_attested",
  "server_hosted_agent",
  "system_worker",
  "user_verified_web",
  "untrusted_client",
];

function strongestResultDeliveryTrust(
  events: readonly EpochResultPageReceiptEvent[],
  fallback: EpochTrustClass | string,
): EpochTrustClass | string {
  const normalized = new Set(events.map((event) => normalizeTrustClass(event.trustClass)));
  normalized.add(normalizeTrustClass(fallback));
  for (const trustClass of resultDeliveryTrustPriority) {
    if (normalized.has(trustClass)) return trustClass;
  }
  return fallback;
}

function resultReceiptMode(
  payload: Omit<EpochResultPagePayload, "receipt">,
  canonicalEvents: readonly EpochResultPageReceiptEvent[],
): Pick<EpochResultPageReceipt, "playMode" | "trustTier"> {
  const focusedSession = payload.focusHostedSession;
  if (focusedSession?.channelClass === "browser_copy_paste" || focusedSession?.deliveryTrust === "untrusted_client") {
    return { playMode: "casual", trustTier: "untrusted_capped" };
  }
  const normalizedTrustClasses = canonicalEvents.map((event) => normalizeTrustClass(event.trustClass));
  if (
    focusedSession
    && normalizedTrustClasses.some((trustClass) => verifiedResultTrustClasses.has(trustClass))
  ) {
    return { playMode: "verified", trustTier: "verified_autonomous" };
  }
  if (canonicalEvents.length === 0) {
    return { playMode: "sandbox", trustTier: "private_sandbox" };
  }
  if (normalizedTrustClasses.length > 0 && normalizedTrustClasses.every((trustClass) => trustClass === "untrusted_client")) {
    return { playMode: "casual", trustTier: "untrusted_capped" };
  }
  return { playMode: "ranked", trustTier: "server_settled" };
}

function resultReceiptTrustLabels(
  payload: Omit<EpochResultPagePayload, "receipt">,
  canonicalEvents: readonly EpochResultPageReceiptEvent[],
): Pick<EpochResultPageReceipt, "channelClass" | "deliveryTrust"> {
  if (payload.focusHostedSession) {
    const hostedSettlementEvents = canonicalEvents.filter((event) =>
      event.eventType === "hosted_action_recorded"
      || event.eventType === "attestation_recorded"
      || event.eventType === "hosted_session_started");
    return {
      channelClass: payload.focusHostedSession.channelClass || "server_hosted",
      deliveryTrust: strongestResultDeliveryTrust(
        hostedSettlementEvents,
        payload.focusHostedSession.deliveryTrust || "user_verified_web",
      ),
    };
  }
  if (payload.focusTurnCard?.resolution) {
    return {
      channelClass: payload.focusTurnCard.resolution.channelClass,
      deliveryTrust: payload.focusTurnCard.resolution.channelClass,
    };
  }
  const primaryTrust = canonicalEvents[0]?.trustClass || "untrusted_client";
  return {
    channelClass: primaryTrust,
    deliveryTrust: primaryTrust,
  };
}

export function resultPageReceipt(
  projection: EpochProjection,
  payload: Omit<EpochResultPagePayload, "receipt">,
): EpochResultPageReceipt {
  const focus = resultPageReceiptFocus(payload);
  const canonicalEvents = resultPageReceiptEvents(projection, payload, focus);
  const mode = resultReceiptMode(payload, canonicalEvents);
  const trustLabels = resultReceiptTrustLabels(payload, canonicalEvents);
  const payloadHash = `sha256:${sha256Hex(stableResultPageJson(payload))}`;
  return {
    receiptType: "server_result_receipt",
    payloadHash,
    generatedAt: payload.generatedAt,
    channelClass: trustLabels.channelClass,
    deliveryTrust: trustLabels.deliveryTrust,
    playMode: mode.playMode,
    trustTier: mode.trustTier,
    agentId: payload.progress.agentId,
    explorerId: payload.progress.explorerId,
    focus,
    trustClasses: [...new Set(canonicalEvents.map((event) => event.trustClass))],
    trustedExecution: resultPageTrustedExecutionReceipts(projection, payload, payloadHash),
    canonicalEvents,
  };
}
