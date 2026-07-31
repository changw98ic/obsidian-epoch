import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_HIGH_RISK_SETTLED_ACTIONS_PER_IDENTITY,
  attestationRecordedPayload,
  assertRequiredPositiveInteger,
  deriveHostedDeliveryTrust,
  deriveHostedEventTrust,
  firstRunSettlementPolicy,
  hasOpenTurnCardForAgent,
  hostedActionOptions,
  hostedActionRecordedPayload,
  hostedSessionStartedPayload,
  includeHighRiskOptions,
  isHighRiskSettledEvent,
  isTurnCardExpiredAt,
  nextTurnCardSequence,
  planHostedActionSubmissionEvents,
  planHostedSessionStartEvents,
  planTurnCardCreationEvents,
  planTurnCardResolutionEvents,
  requireHostedTrust,
  requireServerHostedAgentTrust,
  requireTurnTrust,
  settlementPolicy,
  turnCardCreatedPayload,
  turnActionOptions,
  turnHostedActionRewardGrantPayload,
  turnResolvedPayload,
  turnOptionTemplate,
} from "../lib/epoch/turnHostedActionRules.ts";
import type { EpochEventFactory } from "../lib/epoch/eventFactory.ts";
import type { EpochProjection, EpochSocialHook } from "../lib/epoch/gameCore.ts";
import type { EpochEvent } from "../lib/epoch/events.ts";
import type { EpochCommandContext, EpochIdFactory, EpochTrustClass } from "../lib/epoch/protocol.ts";

const idFactory: EpochIdFactory = (prefix, seed) => `${prefix}_${String(seed).replace(/[^a-z0-9]+/gi, "_")}`;

function event(
  eventType: "turn_resolved" | "hosted_action_recorded",
  payload: Record<string, unknown>,
  agentId = "agent_1",
): EpochEvent {
  return {
    eventId: `${eventType}_${Math.random()}`,
    eventType,
    agentId,
    payload,
  } as unknown as EpochEvent;
}

let eventSequence = 0;

const makeEvent = ((eventType, aggregateId, payload, options = {}) => ({
  eventId: `${eventType}_${++eventSequence}`,
  eventType,
  aggregateId,
  aggregateType: options.aggregateType || "agent_identity",
  agentId: options.agentId,
  payload,
  createdAt: "2026-07-06T00:00:00.000Z",
})) as EpochEventFactory;

function projection(input: {
  readonly events?: readonly EpochEvent[];
  readonly remaining?: number;
  readonly generation?: number;
} = {}): EpochProjection {
  return {
    events: input.events || [],
    identities: {
      agent_1: {
        agentId: "agent_1",
        explorerId: "explorer_1",
        identityName: "调查员",
        generation: input.generation || 1,
        status: "active",
        lifetime: {
          max: 10,
          remaining: input.remaining ?? 3,
          startedAt: "2026-07-06T00:00:00.000Z",
        },
        personality: { traits: [], driftIds: [] },
        createdAt: "2026-07-06T00:00:00.000Z",
      },
    },
  } as unknown as EpochProjection;
}

function socialHook(overrides: Partial<EpochSocialHook> = {}): EpochSocialHook {
  return {
    hookId: "hook_1",
    regionId: "region_gray_harbor",
    kind: "obligation",
    title: "家庭义务",
    body: "有人请求协助。",
    actionLabel: "处理家庭义务",
    risk: "medium",
    sourceEventIds: ["event_1"],
    createdAt: "2026-07-06T00:00:00.000Z",
    ...overrides,
  };
}

function context(trustClass: EpochTrustClass): EpochCommandContext {
  return { trustClass, actorExplorerId: "explorer_1" };
}

test("turn hosted action rules validate trust classes and hosted delivery trust", () => {
  assert.equal(requireHostedTrust(context("user_verified_web")), "user_verified_web");
  assert.equal(requireHostedTrust(context("host_attested")), "host_attested");
  assert.throws(() => requireHostedTrust(context("untrusted_client")), /hosted_session_requires_server_trust/);

  assert.equal(requireServerHostedAgentTrust(context("server_hosted_agent")), "server_hosted_agent");
  assert.throws(() => requireServerHostedAgentTrust(context("user_verified_web")), /server_hosted_job_requires_server_trust/);

  assert.equal(requireTurnTrust(context("system_worker")), "system_worker");
  assert.throws(() => requireTurnTrust(context("untrusted_client")), /turn_card_requires_server_trust/);

  assert.equal(deriveHostedDeliveryTrust("browser_copy_paste", "host_attested"), "untrusted_client");
  assert.equal(deriveHostedEventTrust("server_hosted", "host_attested"), "host_attested");
});

test("turn hosted action rules validate turn card time and sequence inputs", () => {
  assert.equal(isTurnCardExpiredAt("2026-07-06T00:00:00.000Z", Date.parse("2026-07-06T00:00:01.000Z")), true);
  assert.equal(isTurnCardExpiredAt("2026-07-06T00:00:00.000Z", Date.parse("2026-07-06T00:00:00.000Z")), false);
  assert.equal(isTurnCardExpiredAt(undefined, Date.now()), false);

  assert.equal(assertRequiredPositiveInteger(3, "sequence_required"), 3);
  assert.throws(() => assertRequiredPositiveInteger("3", "sequence_required"), /sequence_required/);
  assert.throws(() => assertRequiredPositiveInteger(0, "sequence_required"), /sequence_required/);

  const turnCards = {
    old_open: {
      agentId: "agent_1",
      status: "open",
      sequence: 1,
      expiresAt: "2026-07-06T00:00:00.000Z",
    },
    settled: {
      agentId: "agent_1",
      status: "resolved",
      sequence: 4,
      expiresAt: "2026-07-07T00:00:00.000Z",
    },
    other_agent: {
      agentId: "agent_2",
      status: "open",
      sequence: 9,
      expiresAt: "2026-07-07T00:00:00.000Z",
    },
  };
  assert.equal(nextTurnCardSequence(turnCards, "agent_1"), 5);
  assert.equal(nextTurnCardSequence(turnCards, "agent_new"), 1);
  assert.equal(hasOpenTurnCardForAgent(turnCards, "agent_1", Date.parse("2026-07-06T00:00:01.000Z")), false);
  assert.equal(hasOpenTurnCardForAgent(turnCards, "agent_2", Date.parse("2026-07-06T00:00:01.000Z")), true);
});

test("turn hosted action rules build turn options from shared templates", () => {
  const lowOptions = turnActionOptions("turn_1", idFactory, false);
  assert.deepEqual(lowOptions.map((option) => option.optionKey), ["observe", "assist"]);
  assert.equal(lowOptions[0].actionOptionId, "action_turn_turn_1_observe");

  const allOptions = turnActionOptions("turn_1", idFactory, true);
  assert.deepEqual(allOptions.map((option) => option.optionKey), ["observe", "assist", "anomaly"]);
  assert.equal(turnOptionTemplate("anomaly").lifetimeDelta, -2);
  assert.throws(() => turnOptionTemplate("missing"), /turn_action_option_template_not_found/);
});

test("turn hosted action rules cap high-risk options after settled high-risk actions", () => {
  assert.equal(isHighRiskSettledEvent(event("turn_resolved", { risk: "high" })), true);
  assert.equal(isHighRiskSettledEvent(event("hosted_action_recorded", { lifetimeDelta: -1 })), true);
  assert.equal(isHighRiskSettledEvent(event("turn_resolved", { risk: "low" })), false);

  assert.equal(includeHighRiskOptions(projection({
    events: [event("turn_resolved", { risk: "high" })],
  }), "agent_1"), true);
  assert.equal(includeHighRiskOptions(projection({
    events: Array.from({ length: MAX_HIGH_RISK_SETTLED_ACTIONS_PER_IDENTITY }, () =>
      event("turn_resolved", { risk: "high" })),
  }), "agent_1"), false);
});

test("turn hosted action rules protect first-run high risk and suppress repeated basic rewards", () => {
  const protectedSettlement = firstRunSettlementPolicy(projection({ remaining: 1 }), "agent_1", {
    risk: "high",
    reward: { resourceId: "aether", amount: 1, reason: "turn_anomaly" },
    lifetimeDelta: -2,
  });
  assert.deepEqual(protectedSettlement, {
    reward: undefined,
    lifetimeDelta: undefined,
    nonEvidence: true,
  });

  const lowFirstAction = firstRunSettlementPolicy(projection(), "agent_1", {
    risk: "low",
    reward: { resourceId: "focus", amount: 1, reason: "turn_observe" },
  });
  assert.equal(lowFirstAction.nonEvidence, true);
  assert.deepEqual(lowFirstAction.reward, { resourceId: "focus", amount: 1, reason: "turn_observe" });

  const repeatedReward = settlementPolicy(projection({
    events: [
      event("turn_resolved", { reward: { resourceId: "focus", amount: 1, reason: "turn_observe" } }),
      event("hosted_action_recorded", { reward: { resourceId: "focus", amount: 1, reason: "hosted_observe" } }),
    ],
    generation: 2,
  }), "agent_1", {
    risk: "low",
    reward: { resourceId: "focus", amount: 1, reason: "turn_observe" },
  });
  assert.equal(repeatedReward.reward, undefined);
  assert.equal(repeatedReward.nonEvidence, undefined);
});

test("turn hosted action rules build hosted options with social hooks and visible reward caps", () => {
  const options = hostedActionOptions({
    sessionId: "session_1",
    idFactory,
    socialHooks: [
      socialHook({ hookId: "hook_1", risk: "medium" }),
      socialHook({ hookId: "hook_2", risk: "high" }),
      socialHook({ hookId: "hook_3", risk: "low" }),
      socialHook({ hookId: "hook_4", risk: "low" }),
    ],
    includeHighRisk: false,
    current: projection({
      events: [
        event("turn_resolved", { reward: { resourceId: "focus", amount: 1, reason: "turn_observe" } }),
        event("hosted_action_recorded", { reward: { resourceId: "focus", amount: 1, reason: "hosted_observe" } }),
      ],
      generation: 2,
    }),
    agentId: "agent_1",
  });

  assert.deepEqual(options.map((option) => option.optionKey), [
    "observe",
    "assist",
    "social_hook:hook_1",
    "social_hook:hook_3",
  ]);
  assert.equal(options.find((option) => option.optionKey === "observe")?.reward, undefined);
  assert.equal(options.find((option) => option.optionKey === "assist")?.reward?.reason, "hosted_assist");
  const socialOption = options.find((option) => option.optionKey === "social_hook:hook_1");
  assert.equal(socialOption?.socialHookId, "hook_1");
  assert.match(socialOption?.explanation.brief || "", /人物事件/);
  assert.match(socialOption?.outcomeSummary || "", /人物事件/);
  assert.doesNotMatch(JSON.stringify(socialOption), /社交钩子/);
});

test("turn hosted action rules build turn and hosted action payloads", () => {
  assert.deepEqual(turnHostedActionRewardGrantPayload({
    agentId: "agent_1",
    reward: { resourceId: "focus", amount: 1, reason: "turn_observe" },
    balanceBefore: 4,
  }), {
    resourceId: "focus",
    amount: 1,
    reason: "turn_observe",
    balanceAfter: 5,
    accountRef: "agent:agent_1",
    assetKey: "resource:focus",
    unit: "unit",
    quantityMinor: "100",
  });

  const turnOptions = turnActionOptions("turn_1", idFactory, true);
  const turnCard = turnCardCreatedPayload({
    envelopeId: "challenge_turn_1",
    trustClass: "user_verified_web",
    turnCardId: "turn_1",
    agentId: "agent_1",
    explorerId: "explorer_1",
    regionId: "region_gray_harbor",
    sequence: 1,
    nonce: "nonce_1",
    prompt: "巡查码头",
    visibleContext: {
      regionId: "region_gray_harbor",
      prompt: "巡查码头",
      identityName: "调查员",
    },
    actionOptions: turnOptions,
    createdAt: "2026-07-06T00:00:00.000Z",
    expiresAt: "2026-07-06T00:15:00.000Z",
  });
  assert.equal(turnCard.signedEnvelope.envelopeId, "challenge_turn_1");
  assert.deepEqual(turnCard.actionOptions.map((option) => option.optionKey), ["observe", "assist", "anomaly"]);

  const resolved = turnResolvedPayload({
    responseEnvelopeId: "challenge_resolution_1",
    trustClass: "user_verified_web",
    turnCardId: "turn_1",
    agentId: "agent_1",
    originalEnvelopeId: turnCard.signedEnvelope.envelopeId,
    sequence: turnCard.sequence,
    nonce: turnCard.nonce,
    actionOptionId: turnOptions[0].actionOptionId,
    optionLabel: turnOptions[0].label,
    risk: "low",
    explanation: turnOptions[0].explanation,
    visibleText: "  先观察  ",
    outcomeSummary: "观察完成。",
    reward: { resourceId: "focus", amount: 1, reason: "turn_observe" },
    nonEvidence: true,
    resolvedAt: "2026-07-06T00:01:00.000Z",
  });
  assert.equal(resolved.visibleText, "先观察");
  assert.equal(resolved.envelopeId, "challenge_turn_1");
  assert.equal(resolved.signedEnvelope.envelopeId, "challenge_resolution_1");

  const hostedSession = hostedSessionStartedPayload({
    sessionId: "session_1",
    agentId: "agent_1",
    explorerId: "explorer_1",
    regionId: "region_gray_harbor",
    mandate: "服务器托管行动",
    channelClass: "server_hosted",
    deliveryTrust: "server_hosted_agent",
    actionOptions: hostedActionOptions({ sessionId: "session_1", idFactory }),
    startedAt: "2026-07-06T00:02:00.000Z",
  });
  assert.equal(hostedSession.deliveryTrust, "server_hosted_agent");
  assert.equal(hostedSession.actionOptions[0].optionKey, "observe");

  const hostedAction = hostedActionRecordedPayload({
    envelopeId: "challenge_hosted_1",
    actionId: "action_1",
    sessionId: hostedSession.sessionId,
    agentId: hostedSession.agentId,
    channelClass: hostedSession.channelClass,
    deliveryTrust: hostedSession.deliveryTrust,
    actionOptionId: hostedSession.actionOptions[0].actionOptionId,
    optionLabel: hostedSession.actionOptions[0].label,
    risk: hostedSession.actionOptions[0].risk,
    explanation: hostedSession.actionOptions[0].explanation,
    visibleText: "   ",
    outcomeSummary: hostedSession.actionOptions[0].outcomeSummary,
    reward: hostedSession.actionOptions[0].reward,
    recordedAt: "2026-07-06T00:03:00.000Z",
  });
  assert.equal(hostedAction.visibleText, undefined);
  assert.equal(hostedAction.signedEnvelope.envelopeId, "challenge_hosted_1");
  assert.equal(hostedAction.signedEnvelope.trustClass, "server_hosted_agent");
});

test("turn hosted action rules plan turn card creation and resolution event sequences", () => {
  const actionOptions = turnActionOptions("turn_1", idFactory, true);
  const creationEvents = planTurnCardCreationEvents({
    makeEvent,
    envelopeId: "challenge_turn_1",
    trustClass: "user_verified_web",
    turnCardId: "turn_1",
    agentId: "agent_1",
    explorerId: "explorer_1",
    regionId: "region_gray_harbor",
    sequence: 1,
    nonce: "nonce_1",
    prompt: "巡查码头",
    visibleContext: {
      regionId: "region_gray_harbor",
      prompt: "巡查码头",
      identityName: "调查员",
    },
    actionOptions,
    createdAt: "2026-07-06T00:00:00.000Z",
    expiresAt: "2026-07-06T00:15:00.000Z",
  });

  assert.equal(creationEvents.length, 1);
  assert.equal(creationEvents[0].eventType, "turn_card_created");
  assert.equal(creationEvents[0].aggregateType, "turn_card");
  assert.equal(creationEvents[0].agentId, "agent_1");
  assert.equal(creationEvents[0].payload.signedEnvelope.envelopeId, "challenge_turn_1");

  const anomalyTemplate = turnOptionTemplate("anomaly");
  const lifetimeRequests: Array<{ delta: number; reason: string; finalTitle: string }> = [];
  const resolutionEvents = planTurnCardResolutionEvents({
    makeEvent,
    responseEnvelopeId: "challenge_resolution_1",
    trustClass: "user_verified_web",
    turnCardId: "turn_1",
    agentId: "agent_1",
    originalEnvelopeId: "challenge_turn_1",
    sequence: 1,
    nonce: "nonce_1",
    actionOptionId: actionOptions[2].actionOptionId,
    optionLabel: actionOptions[2].label,
    risk: actionOptions[2].risk,
    explanation: actionOptions[2].explanation,
    visibleText: "接触异常",
    outcomeSummary: anomalyTemplate.outcomeSummary,
    reward: { resourceId: "aether", amount: 1, reason: "turn_anomaly" },
    lifetimeDelta: -2,
    resolvedAt: "2026-07-06T00:01:00.000Z",
    balanceBefore: () => 3,
    lifetimeEventsForDelta: (request) => {
      lifetimeRequests.push(request);
      return [{
        eventId: "lifetime_adjusted_1",
        eventType: "lifetime_adjusted",
        agentId: "agent_1",
        payload: { delta: request.delta, reason: request.reason },
      } as unknown as EpochEvent];
    },
  });

  assert.deepEqual(resolutionEvents.map((event) => event.eventType), [
    "turn_resolved",
    "resource_granted",
    "lifetime_adjusted",
  ]);
  assert.equal(resolutionEvents[0].aggregateType, "turn_card");
  assert.equal(resolutionEvents[1].aggregateType, "resource_account");
  assert.deepEqual(resolutionEvents[1].payload, {
    resourceId: "aether",
    amount: 1,
    reason: "turn_anomaly",
    balanceAfter: 4,
    accountRef: "agent:agent_1",
    assetKey: "resource:aether",
    unit: "unit",
    quantityMinor: "100",
  });
  assert.deepEqual(lifetimeRequests, [{
    delta: -2,
    reason: "turn_action_risk",
    finalTitle: "高风险回合定档身份",
    sourceEventId: "turn_resolved_2",
  }]);
});

test("turn hosted action rules plan hosted session and action event sequences", () => {
  const actionOptions = hostedActionOptions({ sessionId: "session_1", idFactory });
  const sessionEvents = planHostedSessionStartEvents({
    makeEvent,
    sessionId: "session_1",
    agentId: "agent_1",
    explorerId: "explorer_1",
    regionId: "region_gray_harbor",
    mandate: "服务器托管行动",
    channelClass: "server_hosted",
    deliveryTrust: "server_hosted_agent",
    actionOptions,
    startedAt: "2026-07-06T00:02:00.000Z",
  });

  assert.equal(sessionEvents.length, 1);
  assert.equal(sessionEvents[0].eventType, "hosted_session_started");
  assert.equal(sessionEvents[0].aggregateType, "hosted_session");
  assert.equal(sessionEvents[0].agentId, "agent_1");
  assert.equal(sessionEvents[0].payload.actionOptions[0].optionKey, "observe");

  const lifetimeRequests: Array<{ delta: number; reason: string; finalTitle: string }> = [];
  const actionEvents = planHostedActionSubmissionEvents({
    makeEvent,
    envelopeId: "challenge_hosted_1",
    actionId: "action_1",
    sessionId: "session_1",
    agentId: "agent_1",
    channelClass: "server_hosted",
    deliveryTrust: "server_hosted_agent",
    actionOptionId: actionOptions[2].actionOptionId,
    optionLabel: actionOptions[2].label,
    risk: actionOptions[2].risk,
    socialHookId: "hook_1",
    attestation: {
      attestationId: "attestation_1",
      runnerId: "runner_1",
      challengeId: "challenge_1",
      sessionId: "session_1",
      agentId: "agent_1",
      actionOptionId: actionOptions[2].actionOptionId,
      transcriptHash: "sha256:transcript",
      signature: "signature",
      signatureBase: "base",
      signatureBaseHash: "sha256:base",
      verifiedAt: "2026-07-06T00:03:00.000Z",
    },
    explanation: actionOptions[2].explanation,
    visibleText: "接触异常",
    outcomeSummary: actionOptions[2].outcomeSummary,
    reward: { resourceId: "aether", amount: 1, reason: "hosted_anomaly" },
    lifetimeDelta: -2,
    recordedAt: "2026-07-06T00:03:00.000Z",
    sideEffectEvents: (actionRecorded) => [{
      eventId: "agent_npc_bond_updated_1",
      eventType: "agent_npc_bond_updated",
      agentId: actionRecorded.agentId,
      payload: { sourceEventId: actionRecorded.eventId },
    } as unknown as EpochEvent],
    balanceBefore: () => 7,
    lifetimeEventsForDelta: (request) => {
      lifetimeRequests.push(request);
      return [{
        eventId: "lifetime_adjusted_2",
        eventType: "lifetime_adjusted",
        agentId: "agent_1",
        payload: { delta: request.delta, reason: request.reason },
      } as unknown as EpochEvent];
    },
  });

  assert.deepEqual(actionEvents.map((event) => event.eventType), [
    "attestation_recorded",
    "hosted_action_recorded",
    "agent_npc_bond_updated",
    "resource_granted",
    "lifetime_adjusted",
  ]);
  assert.equal(actionEvents[0].aggregateType, "attestation");
  assert.equal(actionEvents[1].aggregateType, "hosted_session");
  const hostedActionPayload = actionEvents[1].payload as { readonly attestationId?: string };
  const sideEffectPayload = actionEvents[2].payload as { readonly sourceEventId?: string };
  assert.equal(hostedActionPayload.attestationId, "attestation_1");
  assert.equal(sideEffectPayload.sourceEventId, actionEvents[1].eventId);
  assert.deepEqual(actionEvents[3].payload, {
    resourceId: "aether",
    amount: 1,
    reason: "hosted_anomaly",
    balanceAfter: 8,
    accountRef: "agent:agent_1",
    assetKey: "resource:aether",
    unit: "unit",
    quantityMinor: "100",
  });
  assert.deepEqual(lifetimeRequests, [{
    delta: -2,
    reason: "hosted_action_risk",
    finalTitle: "托管行动定档身份",
    sourceEventId: "hosted_action_recorded_6",
  }]);
});

test("turn hosted action rules normalize hosted runner attestation payloads", () => {
  const payload = attestationRecordedPayload({
    attestationId: "attestation_1",
    runnerId: "runner_1",
    runnerKeyId: "  key_1  ",
    challengeId: "challenge_1",
    sessionId: "session_1",
    agentId: "agent_1",
    actionOptionId: "action_1",
    transcriptHash: "sha256:transcript",
    signature: "signature",
    signatureBase: "base",
    signatureBaseHash: "sha256:base",
    verifiedAt: "2026-07-06T00:04:00.000Z",
  });

  assert.deepEqual(payload, {
    attestationId: "attestation_1",
    runnerId: "runner_1",
    runnerKeyId: "key_1",
    challengeId: "challenge_1",
    sessionId: "session_1",
    agentId: "agent_1",
    actionOptionId: "action_1",
    transcriptHash: "sha256:transcript",
    signature: "signature",
    signatureBase: "base",
    signatureBaseHash: "sha256:base",
    verifiedAt: "2026-07-06T00:04:00.000Z",
  });

  assert.equal(attestationRecordedPayload({
    ...payload,
    runnerKeyId: "   ",
  }).runnerKeyId, undefined);
  assert.throws(() => attestationRecordedPayload({
    ...payload,
    transcriptHash: "",
  }), /attestation_transcript_hash/);
});
