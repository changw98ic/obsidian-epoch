import assert from "node:assert/strict";
import test from "node:test";
import {
  HOSTED_ACTION_ENVELOPE_PROTOCOL_VERSION,
  TURN_CARD_ENVELOPE_PROTOCOL_VERSION,
  TURN_RESOLUTION_ENVELOPE_PROTOCOL_VERSION,
  buildSignedHostedActionEnvelope,
  buildSignedTurnCardEnvelope,
  buildSignedTurnResolutionEnvelope,
  hostedActionSignedEnvelopeContent,
  signedEnvelopeContentHash,
  stableSignedEnvelopeJson,
  turnCardSignedEnvelopeContent,
  turnResolutionSignedEnvelopeContent,
} from "../lib/epoch/turnActionEnvelopeRules.ts";
import {
  OBSIDIAN_EPOCH_PACKAGE_SIGNATURE_ALGORITHM,
  obsidianEpochReleasePublicKey,
} from "../lib/packageArchive.ts";

const explanation = {
  brief: "观察",
  trigger: "发现可疑线索",
  choiceReason: "低风险且可确认线索。",
  rejectedAlternatives: ["直接冲突"],
  risk: "低",
  expectedBenefit: "获得下一步依据。",
};

test("turn action envelope rules build stable signed turn-card envelopes", () => {
  const input = {
    envelopeId: "challenge_turn_1",
    trustClass: "user_verified_web" as const,
    turnCardId: "turn_card_1",
    agentId: "agent_1",
    explorerId: "explorer_1",
    regionId: "region_gray_harbor",
    sequence: 3,
    nonce: "nonce_3",
    expiresAt: "2026-07-06T00:15:00.000Z",
    visibleContext: {
      regionId: "region_gray_harbor",
      prompt: "调查码头",
      identityName: "调查员",
    },
    actionOptions: [
      { actionOptionId: "observe", optionKey: "observe", label: "观察", risk: "low" as const, explanation },
      { actionOptionId: "push", optionKey: "push", label: "推进", risk: "medium" as const, explanation },
    ],
  };
  const content = turnCardSignedEnvelopeContent(input);
  const envelope = buildSignedTurnCardEnvelope(input);

  assert.deepEqual(content.actionOptionIds, ["observe", "push"]);
  assert.equal(content.protocolVersion, TURN_CARD_ENVELOPE_PROTOCOL_VERSION);
  assert.equal(envelope.protocolVersion, TURN_CARD_ENVELOPE_PROTOCOL_VERSION);
  assert.equal(envelope.signatureAlgorithm, OBSIDIAN_EPOCH_PACKAGE_SIGNATURE_ALGORITHM);
  assert.equal(envelope.serverPublicKey, obsidianEpochReleasePublicKey());
  assert.equal(envelope.contentHash, signedEnvelopeContentHash(content));
  assert.match(envelope.signature, /^[A-Za-z0-9+/=]+$/);
  assert.equal(envelope.runTicketId, null);
});

test("turn action envelope rules build stable signed turn resolution envelopes", () => {
  const input = {
    envelopeId: "challenge_resolution_1",
    trustClass: "user_verified_web" as const,
    turnCardId: "turn_card_1",
    agentId: "agent_1",
    originalEnvelopeId: "challenge_turn_1",
    sequence: 3,
    nonce: "nonce_3",
    actionOptionId: "observe",
    optionLabel: "观察",
    explanation,
    visibleText: "先确认码头痕迹",
    outcomeSummary: "发现了新线索。",
    reward: { resourceId: "focus" as const, amount: 1, reason: "turn_reward" },
    lifetimeDelta: -1,
    nonEvidence: false,
    resolvedAt: "2026-07-06T00:05:00.000Z",
  };
  const content = turnResolutionSignedEnvelopeContent(input);
  const envelope = buildSignedTurnResolutionEnvelope(input);

  assert.equal(content.protocolVersion, TURN_RESOLUTION_ENVELOPE_PROTOCOL_VERSION);
  assert.equal(content.channelClass, "user_verified_web");
  assert.equal(envelope.protocolVersion, TURN_RESOLUTION_ENVELOPE_PROTOCOL_VERSION);
  assert.equal(envelope.contentHash, signedEnvelopeContentHash(content));
  assert.equal(envelope.trustClass, "user_verified_web");
  assert.equal(envelope.runTicketId, null);
});

test("turn action envelope rules build stable signed hosted action envelopes", () => {
  const input = {
    envelopeId: "challenge_hosted_1",
    trustClass: "host_attested" as const,
    actionId: "action_1",
    sessionId: "session_1",
    agentId: "agent_1",
    channelClass: "server_hosted" as const,
    deliveryTrust: "host_attested" as const,
    actionOptionId: "social_hook_1",
    optionLabel: "处理线索",
    risk: "medium" as const,
    socialHookId: "hook_1",
    attestationId: "attestation_1",
    explanation,
    visibleText: "谨慎推进",
    outcomeSummary: "托管行动完成。",
    reward: { resourceId: "stamina" as const, amount: 1, reason: "hosted_reward" },
    lifetimeDelta: -1,
    nonEvidence: false,
    recordedAt: "2026-07-06T00:06:00.000Z",
  };
  const content = hostedActionSignedEnvelopeContent(input);
  const envelope = buildSignedHostedActionEnvelope(input);

  assert.equal(content.protocolVersion, HOSTED_ACTION_ENVELOPE_PROTOCOL_VERSION);
  assert.equal(content.deliveryTrust, "host_attested");
  assert.equal(envelope.protocolVersion, HOSTED_ACTION_ENVELOPE_PROTOCOL_VERSION);
  assert.equal(envelope.signatureAlgorithm, OBSIDIAN_EPOCH_PACKAGE_SIGNATURE_ALGORITHM);
  assert.equal(envelope.contentHash, signedEnvelopeContentHash(content));
  assert.equal(envelope.trustClass, "host_attested");
});

test("turn action envelope rules hash sorted json deterministically", () => {
  assert.equal(
    stableSignedEnvelopeJson({ b: 1, a: { d: 4, c: [3, { b: true, a: false }] } }),
    '{"a":{"c":[3,{"a":false,"b":true}],"d":4},"b":1}',
  );
  assert.equal(
    signedEnvelopeContentHash({ b: 1, a: 2 }),
    signedEnvelopeContentHash({ a: 2, b: 1 }),
  );
});
