import assert from "node:assert/strict";
import test from "node:test";
import type { EpochEvent } from "../lib/epoch/events.ts";
import type {
  EpochAttestationRecord,
  EpochHostedActionRecord,
  EpochHostedSession,
  EpochProjection,
} from "../lib/epoch/gameCore.ts";
import type { EpochEventType, EpochTrustClass } from "../lib/epoch/protocol.ts";
import {
  resultPageReceipt,
  resultPageReceiptFocus,
} from "../lib/epoch/resultPageReceiptRules.ts";
import { stableResultPageJson } from "../lib/epoch/resultPageRuntimeRules.ts";
import { sha256Hex } from "../lib/epoch/runtimeAuth.ts";
import type { EpochResultPagePayload } from "../lib/epoch/runtime.ts";

type EventFixture = {
  readonly eventId: string;
  readonly eventType: EpochEventType;
  readonly aggregateType?: string;
  readonly aggregateId?: string;
  readonly trustClass?: EpochTrustClass;
  readonly createdAt: string;
  readonly causationId?: string;
  readonly correlationId?: string;
  readonly payload?: Readonly<Record<string, unknown>>;
};

function event(input: EventFixture): EpochEvent {
  return {
    eventId: input.eventId,
    eventType: input.eventType,
    aggregateType: input.aggregateType || "agent",
    aggregateId: input.aggregateId || "agent_1",
    actorExplorerId: "explorer_1",
    trustClass: input.trustClass || "user_verified_web",
    causationId: input.causationId || "",
    correlationId: input.correlationId || "",
    createdAt: input.createdAt,
    payload: input.payload || {},
  } as unknown as EpochEvent;
}

function projection(
  events: readonly EpochEvent[],
  attestationRecords: Readonly<Record<string, EpochAttestationRecord>> = {},
): EpochProjection {
  return {
    events,
    attestationRecords,
  } as unknown as EpochProjection;
}

function hostedAction(overrides: Partial<EpochHostedActionRecord> = {}): EpochHostedActionRecord {
  return {
    actionId: "action_1",
    sessionId: "session_1",
    agentId: "agent_1",
    channelClass: "server_hosted",
    deliveryTrust: "remote_attested_runner",
    actionOptionId: "option_1",
    optionLabel: "观察裂隙",
    explanation: {
      title: "观察",
      body: "确认局势。",
    },
    outcomeSummary: "确认了裂隙边缘的变化。",
    recordedAt: "2026-07-06T00:03:00.000Z",
    signedEnvelope: {},
    ...overrides,
  } as unknown as EpochHostedActionRecord;
}

function hostedSession(overrides: Partial<EpochHostedSession> = {}): EpochHostedSession {
  return {
    sessionId: "session_1",
    agentId: "agent_1",
    explorerId: "explorer_1",
    regionId: "region_gray_harbor",
    mandate: "观察灰港异常。",
    channelClass: "server_hosted",
    deliveryTrust: "user_verified_web",
    status: "completed",
    actionOptions: [],
    actions: [],
    startedAt: "2026-07-06T00:00:00.000Z",
    completedAt: "2026-07-06T00:04:00.000Z",
    ...overrides,
  };
}

function attestation(overrides: Partial<EpochAttestationRecord> = {}): EpochAttestationRecord {
  return {
    attestationId: "att_1",
    runnerId: "runner_1",
    runnerKeyId: "runner_key_1",
    challengeId: "challenge_1",
    sessionId: "session_1",
    agentId: "agent_1",
    actionOptionId: "option_1",
    transcriptHash: "sha256:transcript",
    signature: "runner_signature",
    signatureBase: "challenge|session|action",
    signatureBaseHash: "sha256:signature_base",
    verifiedAt: "2026-07-06T00:04:00.000Z",
    ...overrides,
  };
}

function payload(overrides: Partial<Omit<EpochResultPagePayload, "receipt">> = {}): Omit<EpochResultPagePayload, "receipt"> {
  return {
    pageType: "agent_result",
    generatedAt: "2026-07-06T00:05:00.000Z",
    publicSafeSummary: {
      summaryType: "public_safe_summary",
      source: "server_public_summary",
      text: "灰港探索完成。",
      excludedSourceClasses: [],
    },
    progress: {
      agentId: "agent_1",
      explorerId: "explorer_1",
      identity: { agentId: "agent_1", explorerId: "explorer_1", identityName: "灰港调查员" },
      identities: [],
      resources: {},
      latestEvents: [],
    },
    ...overrides,
  } as unknown as Omit<EpochResultPagePayload, "receipt">;
}

test("result page receipt rules build attested hosted-session receipts", () => {
  const sessionEvent = event({
    eventId: "epoch_event_session",
    eventType: "hosted_session_started",
    aggregateType: "hosted_session",
    aggregateId: "session_1",
    trustClass: "user_verified_web",
    createdAt: "2026-07-06T00:01:00.000Z",
    payload: { sessionId: "session_1" },
  });
  const actionEvent = event({
    eventId: "epoch_event_action",
    eventType: "hosted_action_recorded",
    aggregateType: "hosted_session",
    aggregateId: "session_1",
    trustClass: "remote_attested_runner",
    createdAt: "2026-07-06T00:03:00.000Z",
    payload: { actionId: "action_1", sessionId: "session_1" },
  });
  const attestationEvent = event({
    eventId: "epoch_event_attestation",
    eventType: "attestation_recorded",
    aggregateType: "hosted_session",
    aggregateId: "session_1",
    trustClass: "host_attested",
    createdAt: "2026-07-06T00:04:00.000Z",
    payload: { attestationId: "att_1", sessionId: "session_1" },
  });
  const resultPayload = payload({
    focusHostedSession: hostedSession({
      actions: [hostedAction({ attestationId: "att_1" })],
    }),
    progress: {
      ...payload().progress,
      latestEvents: [sessionEvent],
    },
  });

  const receipt = resultPageReceipt(
    projection([sessionEvent, actionEvent, attestationEvent], { att_1: attestation() }),
    resultPayload,
  );

  assert.deepEqual(receipt.focus, { kind: "hosted_session", id: "session_1" });
  assert.equal(receipt.playMode, "verified");
  assert.equal(receipt.trustTier, "verified_autonomous");
  assert.equal(receipt.channelClass, "server_hosted");
  assert.equal(receipt.deliveryTrust, "remote_attested_runner");
  assert.equal("phase6" in receipt, false);
  assert.deepEqual(
    receipt.canonicalEvents.map((canonicalEvent) => canonicalEvent.eventId),
    ["epoch_event_attestation", "epoch_event_action", "epoch_event_session"],
  );
  assert.deepEqual(receipt.trustClasses, ["host_attested", "remote_attested_runner", "user_verified_web"]);
  assert.equal(receipt.payloadHash, `sha256:${sha256Hex(stableResultPageJson(resultPayload))}`);
  assert.equal(receipt.trustedExecution.length, 1);
  assert.deepEqual(receipt.trustedExecution[0], {
    receiptType: "trusted_execution_receipt",
    attestationId: "att_1",
    runnerId: "runner_1",
    runnerKeyId: "runner_key_1",
    challengeId: "challenge_1",
    sessionId: "session_1",
    actionId: "action_1",
    actionOptionId: "option_1",
    optionLabel: "观察裂隙",
    transcriptHash: "sha256:transcript",
    signatureBase: "challenge|session|action",
    signatureHash: `sha256:${sha256Hex("runner_signature")}`,
    signatureBaseHash: "sha256:signature_base",
    resultPagePayloadHash: receipt.payloadHash,
    attestationAuditUrl: "/epoch/audit/epoch_event_attestation",
    actionAuditUrl: "/epoch/audit/epoch_event_action",
  });
});

test("result page receipt rules classify sandbox, casual, and fallback focus", () => {
  const browserPayload = payload({
    focusHostedSession: hostedSession({
      channelClass: "browser_copy_paste",
      deliveryTrust: "untrusted_client",
    }),
  });
  const browserReceipt = resultPageReceipt(projection([]), browserPayload);

  assert.equal(browserReceipt.playMode, "casual");
  assert.equal(browserReceipt.trustTier, "untrusted_capped");
  assert.equal(browserReceipt.deliveryTrust, "untrusted_client");

  const sandboxPayload = payload({
    progress: {
      ...payload().progress,
      agentId: undefined,
      explorerId: "explorer_1",
    },
  });
  const sandboxReceipt = resultPageReceipt(projection([]), sandboxPayload);

  assert.deepEqual(resultPageReceiptFocus(sandboxPayload), { kind: "explorer_snapshot", id: "explorer_1" });
  assert.deepEqual(sandboxReceipt.focus, { kind: "explorer_snapshot", id: "explorer_1" });
  assert.equal(sandboxReceipt.playMode, "sandbox");
  assert.equal(sandboxReceipt.trustTier, "private_sandbox");
});
