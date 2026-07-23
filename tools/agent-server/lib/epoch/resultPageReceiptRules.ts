import type { EpochEvent } from "./events.ts";
import type { EpochProjection } from "./gameCore.ts";
import { normalizeTrustClass, type EpochEventType, type EpochTrustClass } from "./protocol.ts";
import {
  JOURNEY_RUN_RECEIPT_AUTHORITY,
  JOURNEY_RUN_RECEIPT_VERSION,
  isLegacyJourneyRunReceiptV1,
  validateJourneyRunReceipt,
  type JourneyRunReceipt,
} from "./journeyRunReceiptRules.ts";
import {
  PHASE6_RESULT_PAGE_SCORE_DIMENSIONS,
  buildPhase6MachineReadableResultPage,
  phase6ResultPageScoreSummary,
  type Phase6MachineReadableResultPage,
  type Phase6ResultPageInput,
  type Phase6ResultPageChange,
  type Phase6ResultPageChangeSet,
  type Phase6ResultPageFinding,
  type Phase6ResultPageFindingCode,
  type Phase6ResultPageReceiptEventRef,
  type Phase6ResultPageScoreDetail,
} from "./phase6ResultPageRules.ts";
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

export interface EpochResultPagePhase6Sidecar {
  readonly ok: boolean;
  readonly verified: boolean;
  readonly page?: Phase6MachineReadableResultPage;
  readonly findings: readonly Phase6ResultPageFinding[];
}

export type EpochResultPageReceiptWithPhase6 = EpochResultPageReceipt & {
  readonly phase6?: EpochResultPagePhase6Sidecar;
};

function recordValue(value: unknown): AnyRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as AnyRecord : {};
}

function resultPagePhase6Finding(
  code: Phase6ResultPageFindingCode,
  message: string,
  path?: string,
  details?: Readonly<Record<string, unknown>>,
): Phase6ResultPageFinding {
  return { code, severity: "error", message, path, ...(details === undefined ? {} : { details }) };
}

function uniqueNonEmpty(values: readonly unknown[]): readonly string[] {
  return [...new Set(values.filter((value): value is string => typeof value === "string" && Boolean(value.trim())).map((value) => value.trim()))];
}

function journeyRunReceiptCanonicalEventIds(receipt: JourneyRunReceipt): readonly string[] {
  return uniqueNonEmpty([
    ...receipt.eventIds.source,
    ...receipt.eventIds.settlement,
    ...receipt.eventIds.derived,
  ]);
}

function journeyRunReceiptDeltasEventIds(receipt: JourneyRunReceipt): readonly string[] {
  return uniqueNonEmpty(receipt.deltas.flatMap((delta) => delta.eventIds));
}

function validateJourneyRunReceiptForResultPage(
  receipt: JourneyRunReceipt | undefined,
  knownEventIds: ReadonlySet<string>,
): readonly Phase6ResultPageFinding[] {
  const findings: Phase6ResultPageFinding[] = [];
  if (!receipt) {
    findings.push(resultPagePhase6Finding(
      "PHASE6_RESULT_PAGE_INPUT_MISSING",
      "JourneyRunReceipt is required for Phase 6 result page sidecar",
      "journeyRunReceipt",
    ));
    return findings;
  }
  if (isLegacyJourneyRunReceiptV1(receipt as unknown)) {
    findings.push(resultPagePhase6Finding(
      "PHASE6_RESULT_PAGE_SECTION_INVALID",
      "JourneyRunReceipt v1 is legacy read-only and is not strict enough for a verified Phase 6 result page",
      "journeyRunReceipt.version",
      { receiptType: (receipt as unknown as { receiptType: string }).receiptType, version: (receipt as unknown as { version: string }).version },
    ));
    return findings;
  }
  if (receipt.receiptType !== "journey_run_receipt" || receipt.version !== JOURNEY_RUN_RECEIPT_VERSION) {
    findings.push(resultPagePhase6Finding(
      "PHASE6_RESULT_PAGE_SECTION_INVALID",
      "JourneyRunReceipt type or version is invalid",
      "journeyRunReceipt.version",
      { receiptType: receipt.receiptType, version: receipt.version },
    ));
  }
  if (receipt.authority !== JOURNEY_RUN_RECEIPT_AUTHORITY) {
    findings.push(resultPagePhase6Finding(
      "PHASE6_RESULT_PAGE_AUDIT_INTEGRITY_FAILED",
      "JourneyRunReceipt authority must be server_settled",
      "journeyRunReceipt.authority",
      { authority: receipt.authority },
    ));
  }
  const strictValidation = validateJourneyRunReceipt(receipt);
  if (!strictValidation.ok) {
    for (const issue of strictValidation.issues) {
      findings.push(resultPagePhase6Finding(
        "PHASE6_RESULT_PAGE_AUDIT_INTEGRITY_FAILED",
        issue.code,
        `journeyRunReceipt${issue.path === "$" ? "" : issue.path.slice(1)}`,
      ));
    }
  }
  const canonicalEventIds = journeyRunReceiptCanonicalEventIds(receipt);
  if (canonicalEventIds.length === 0) {
    findings.push(resultPagePhase6Finding(
      "PHASE6_RESULT_PAGE_SECTION_INVALID",
      "JourneyRunReceipt must provide canonical eventIds",
      "journeyRunReceipt.eventIds",
    ));
  }
  for (const eventId of journeyRunReceiptDeltasEventIds(receipt)) {
    if (!canonicalEventIds.includes(eventId)) {
      findings.push(resultPagePhase6Finding(
        "PHASE6_RESULT_PAGE_RECEIPT_EVENT_MISMATCH",
        "JourneyRunReceipt delta eventId is not listed in canonical eventIds",
        "journeyRunReceipt.deltas",
        { eventId },
      ));
    }
  }
  for (const eventId of canonicalEventIds) {
    if (!knownEventIds.has(eventId)) {
      findings.push(resultPagePhase6Finding(
        "PHASE6_RESULT_PAGE_RECEIPT_EVENT_MISMATCH",
        "JourneyRunReceipt eventId is not present in the result page event stream",
        "journeyRunReceipt.eventIds",
        { eventId },
      ));
    }
  }
  return findings;
}

function phase6ChangeSet(
  label: string,
  changes: readonly Phase6ResultPageChange[],
  eventIds: readonly string[],
): Phase6ResultPageChangeSet {
  return changes.length > 0
    ? { mode: "changed", changes, eventIds }
    : { mode: "no_change", changes: [], noChangeReason: `${label} did not change in the server-settled receipt`, eventIds };
}

function phase6ChangesFromDeltas(
  receipt: JourneyRunReceipt,
  include: (delta: JourneyRunReceipt["deltas"][number]) => boolean,
): readonly Phase6ResultPageChange[] {
  return receipt.deltas.filter(include).map((delta, index) => ({
    id: `${delta.target.kind}:${delta.target.id}:${index}`,
    label: `${delta.op} ${delta.target.kind}/${delta.target.id} ${delta.path.join(".")}`,
    ...(delta.before !== undefined ? { before: delta.before } : {}),
    ...(delta.after !== undefined ? { after: delta.after } : {}),
    eventIds: delta.eventIds,
  }));
}

function phase6ScoreDetails(receipt: JourneyRunReceipt): readonly Phase6ResultPageScoreDetail[] {
  const canonicalEventIds = journeyRunReceiptCanonicalEventIds(receipt);
  const canonical = new Set(canonicalEventIds);
  return PHASE6_RESULT_PAGE_SCORE_DIMENSIONS.map((dimension) => {
    const metric = receipt.score.dimensions[dimension];
    const matched = metric.events.filter((eventId) => canonical.has(eventId));
    const eventIds = matched.length > 0 ? [...new Set(matched)] : [...new Set(canonicalEventIds)];
    return {
      dimension,
      score: metric.value,
      value: metric.value,
      weightBps: metric.weightBps,
      contribution: metric.contribution,
      reasonCode: metric.reasonCode,
      formula: metric.formula,
      inputs: metric.inputs,
      inputContributions: metric.inputContributions,
      basis: metric.evidence.join("; ") || "server-settled JourneyRunReceipt metric",
      source: "server_authoritative" as const,
      eventIds,
    };
  });
}

function buildPhase6ResultPageSidecar(
  receipt: JourneyRunReceipt | undefined,
  legacyReceipt: EpochResultPageReceipt,
  knownEventIds: ReadonlySet<string>,
): EpochResultPagePhase6Sidecar {
  const findings = validateJourneyRunReceiptForResultPage(receipt, knownEventIds);
  if (!receipt || findings.length > 0) {
    return { ok: false, verified: false, findings };
  }
  const canonicalEventIds = journeyRunReceiptCanonicalEventIds(receipt);
  const canonicalEvents: readonly Phase6ResultPageReceiptEventRef[] = canonicalEventIds.map((eventId) => ({
    eventId,
    eventType: "journey_run_settlement",
    receiptId: receipt.receiptId,
    runId: receipt.runId,
    payloadHash: receipt.integrity.bodyHash,
  }));
  const worldChanges = phase6ChangesFromDeltas(receipt, (delta) =>
    delta.target.kind === "world" || delta.target.kind === "region" || delta.target.kind === "world_state");
  const identityChanges = phase6ChangesFromDeltas(receipt, (delta) =>
    delta.target.kind === "identity" || delta.path[0] === "identity");
  const progressionChanges = phase6ChangesFromDeltas(receipt, (delta) =>
    delta.target.kind === "progression" || delta.path[0] === "progression");
  const ragChanges = receipt.rag.claims.map((claim) => ({
    id: claim.claimId,
    label: `RAG claim ${claim.claimId}`,
    after: claim,
    eventIds: canonicalEventIds,
  }));
  const input: Phase6ResultPageInput = {
    receipt: {
      receiptId: receipt.receiptId,
      runId: receipt.runId,
      createdAt: receipt.generatedAt,
      payloadHash: receipt.integrity.bodyHash,
      canonicalEventIds,
      canonicalEvents,
    },
    events: canonicalEvents,
    world: phase6ChangeSet("World", worldChanges, receipt.eventIds.derived),
    identityProgression: {
      identity: phase6ChangeSet("Identity", identityChanges, receipt.eventIds.derived),
      progression: phase6ChangeSet("Progression", progressionChanges, receipt.eventIds.derived),
    },
    settlement: {
      status: "settled",
      settlementId: receipt.receiptId,
      eventIds: receipt.eventIds.settlement,
      economyConservation: {
        conserved: true,
        assets: [],
        auditFindingIds: [],
      },
    },
    scoreSummary: phase6ResultPageScoreSummary(receipt.score),
    scores: phase6ScoreDetails(receipt),
    rag: {
      ...phase6ChangeSet("RAG", ragChanges, canonicalEventIds),
      evidenceIds: receipt.rag.claims.map((claim) => claim.sourceId),
      retrievalSnapshotId: receipt.rag.queryHash,
    },
    audit: {
      auditId: receipt.receiptId,
      eventIds: canonicalEventIds,
      integrity: {
        ok: true,
        receiptPayloadHash: receipt.integrity.bodyHash,
        resultPagePayloadHash: legacyReceipt.payloadHash,
        canonicalEventIds,
        checkedAt: legacyReceipt.generatedAt,
      },
    },
  };
  const resultPage = buildPhase6MachineReadableResultPage(input);
  if (!resultPage.verified) {
    return { ok: false, verified: false, findings: resultPage.findings };
  }
  return {
    ok: true,
    verified: true,
    findings: [],
    page: resultPage.page,
  };
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
  journeyRunReceipt?: JourneyRunReceipt,
): EpochResultPageReceipt {
  const focus = resultPageReceiptFocus(payload);
  const canonicalEvents = resultPageReceiptEvents(projection, payload, focus);
  const mode = resultReceiptMode(payload, canonicalEvents);
  const trustLabels = resultReceiptTrustLabels(payload, canonicalEvents);
  const payloadHash = `sha256:${sha256Hex(stableResultPageJson(payload))}`;
  const receipt: EpochResultPageReceipt = {
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
  const knownEventIds = new Set([
    ...projection.events.map((event) => event.eventId),
    ...payload.progress.latestEvents.map((event) => event.eventId),
    ...canonicalEvents.map((event) => event.eventId),
  ]);
  return {
    ...receipt,
    phase6: buildPhase6ResultPageSidecar(journeyRunReceipt, receipt, knownEventIds),
  } as EpochResultPageReceiptWithPhase6;
}
