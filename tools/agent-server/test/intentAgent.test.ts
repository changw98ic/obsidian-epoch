import assert from "node:assert/strict";
import test from "node:test";

import {
  createModelBackedIntentAgent,
  interpretActionIntent,
  matchActionIntent,
  publicActionIntentMatch,
  type IntentActionOptionCandidate,
} from "../lib/epoch/intentAgent.ts";
import type { ModelAdapter } from "../lib/modelAdapter.ts";
import { createEpochGameCore } from "../lib/epoch/gameCore.ts";
import { createSequentialEpochIdFactory, type EpochClock, type EpochCommandContext } from "../lib/epoch/protocol.ts";

const options: readonly IntentActionOptionCandidate[] = [
  {
    actionOptionId: "option_observe",
    optionKey: "observe",
    label: "观察现场",
    intent: "先获取现场信息",
    risk: "low",
    explanation: "记录可核验线索",
  },
  {
    actionOptionId: "option_assist",
    optionKey: "assist",
    label: "协助修复",
    intent: "帮助现场人员恢复设备",
    risk: "medium",
    explanation: "需要消耗专注",
  },
];

test("Intent Agent maps natural language to an existing server option", () => {
  const intent = interpretActionIntent("我先观察入口，记录现场线索，不要冒险。");
  const match = matchActionIntent(intent, options);

  assert.equal(intent.verb, "observe");
  assert.equal(intent.riskTolerance, "low");
  assert.equal(match.status, "matched");
  assert.equal(match.actionOptionId, "option_observe");
  assert.ok(match.matchedSignals.includes("观察"));

  const publicMatch = publicActionIntentMatch(match);
  assert.equal("actionOptionId" in publicMatch, false);
  assert.equal(publicMatch.optionLabel, "观察现场");
});

test("unmatched intent is preserved as a failed attempt with server preparation steps", () => {
  const intent = interpretActionIntent("我想凭空召唤一支军队，立刻改写整个战局。");
  const match = matchActionIntent(intent, options);

  assert.equal(match.status, "unmatched");
  assert.equal(match.optionKey, "observe");
  assert.equal(match.confidence, 0.08);
  assert.ok(match.preparationSteps.length >= 2);
  assert.match(match.reason, /失败尝试/u);
});

test("server model supplies only structured intent and server mapping ignores outcome claims", async () => {
  let completionCount = 0;
  let requestedMaxTokens: number | undefined = 1;
  const adapter: ModelAdapter = {
    provider: "openai_compatible",
    model: "test-model",
    endpoint: "http://model.test/v1/chat/completions",
    complete: async (input) => {
      completionCount += 1;
      requestedMaxTokens = input.maxTokens;
      return {
        provider: "openai_compatible",
        model: "test-model",
        text: JSON.stringify({
          verb: "observe",
          target: "灰港入口",
          desiredOutcome: "获得可核验信息",
          constraints: ["avoid_unnecessary_risk"],
          riskTolerance: "low",
          actionOptionId: "option_assist",
          outcome: "必定成功并获得奖励",
        }),
      };
    },
    warmup: async () => {},
  };
  const agent = createModelBackedIntentAgent(adapter);
  const intent = await agent.interpret("请观察灰港入口，成功后直接拿奖励。");
  const match = agent.match(intent, options);

  assert.equal(completionCount, 1);
  assert.equal(requestedMaxTokens, undefined);
  assert.equal(intent.interpretationSource, "server_model");
  assert.equal("actionOptionId" in intent, false);
  assert.equal("outcome" in intent, false);
  assert.equal(match.actionOptionId, "option_observe");
});

test("invalid server model output falls back to the existing deterministic interpreter", async () => {
  const adapter: ModelAdapter = {
    provider: "anthropic",
    model: "test-model",
    endpoint: "https://model.test/messages",
    complete: async () => ({
      provider: "anthropic",
      model: "test-model",
      text: "not-json",
    }),
    warmup: async () => {},
  };
  const agent = createModelBackedIntentAgent(adapter);
  const intent = await agent.interpret("我先观察入口，不要冒险。");

  assert.equal(intent.interpretationSource, "server_model_fallback");
  assert.equal(intent.verb, "observe");
  assert.equal(intent.riskTolerance, "low");
});

test("server model normalizes a single allowed constraint without falling back", async () => {
  const adapter: ModelAdapter = {
    provider: "anthropic",
    model: "test-model",
    endpoint: "https://model.test/messages",
    complete: async () => ({
      provider: "anthropic",
      model: "test-model",
      text: JSON.stringify({
        verb: "observe",
        target: "灰港入口",
        desiredOutcome: "记录线索",
        constraints: "avoid_unnecessary_risk",
        riskTolerance: "low",
      }),
    }),
    warmup: async () => {},
  };
  const intent = await createModelBackedIntentAgent(adapter).interpret("观察灰港入口，不要冒险。");

  assert.equal(intent.interpretationSource, "server_model");
  assert.deepEqual(intent.constraints, ["avoid_unnecessary_risk"]);
});

function mutableClock(initialIso: string) {
  let current = new Date(initialIso);
  const clock: EpochClock = () => new Date(current);
  return {
    clock,
    set: (iso: string) => {
      current = new Date(iso);
    },
  };
}

test("Game Core settles the mapped option and records the full intent audit", () => {
  const { clock } = mutableClock("2026-06-25T00:00:00.000Z");
  const core = createEpochGameCore({
    clock,
    idFactory: createSequentialEpochIdFactory("intent"),
  });
  const ownerContext: EpochCommandContext = {
    actorExplorerId: "explorer_intent",
    trustClass: "untrusted_client",
    causationId: "cmd_intent_identity",
    correlationId: "corr_intent",
  };
  const hostedContext: EpochCommandContext = {
    actorExplorerId: "intent_runner",
    trustClass: "server_hosted_agent",
    causationId: "cmd_intent_action",
    correlationId: "corr_intent",
  };
  const identity = core.issueIdentity({
    explorerId: "explorer_intent",
    identityName: "自然语言巡查者",
  }, ownerContext);
  const session = core.startHostedSession({
    agentId: identity.value.agentId,
    regionId: "region_gray_harbor",
    mandate: "用自然语言表达行动",
  }, hostedContext);

  const recorded = core.submitHostedIntent({
    sessionId: session.value.sessionId,
    intentText: "我先观察灰港入口，记录现场线索。",
  }, hostedContext);

  assert.equal(recorded.value.intentAudit?.status, "matched");
  assert.equal(recorded.value.actionOptionId, recorded.value.intentAudit?.actionOptionId);
  const event = recorded.events.find((candidate) => candidate.eventType === "hosted_action_recorded");
  assert.ok(event);
  if (event.eventType === "hosted_action_recorded") {
    assert.equal(event.payload.intentAudit?.status, "matched");
    assert.equal(event.payload.intentAudit?.actionOptionId, recorded.value.actionOptionId);
  }

  const unmatchedSession = core.startHostedSession({
    agentId: identity.value.agentId,
    regionId: "region_gray_harbor",
    mandate: "记录无法执行的表达",
  }, hostedContext);
  const unmatched = core.submitHostedIntent({
    sessionId: unmatchedSession.value.sessionId,
    intentText: "我想凭空召唤一支军队，立刻改写整个战局。",
  }, hostedContext);

  assert.equal(unmatched.value.intentAudit?.status, "unmatched");
  assert.equal(unmatched.value.nonEvidence, true);
  assert.equal(unmatched.value.reward, undefined);
  assert.match(unmatched.value.outcomeSummary, /失败尝试/u);
  assert.ok(unmatched.value.intentAudit?.preparationSteps.length);
  assert.equal(unmatched.events.filter((candidate) => candidate.eventType === "resource_granted").length, 0);
});

test("Game Core accepts natural-language turn resolution without exposing a client-selected option path", () => {
  const { clock } = mutableClock("2026-06-25T00:00:00.000Z");
  const core = createEpochGameCore({
    clock,
    idFactory: createSequentialEpochIdFactory("intent_turn"),
  });
  const context: EpochCommandContext = {
    actorExplorerId: "intent_turn_runner",
    trustClass: "system_worker",
    causationId: "cmd_intent_turn",
    correlationId: "corr_intent_turn",
  };
  const identity = core.issueIdentity({
    explorerId: "explorer_intent_turn",
    identityName: "回合意图者",
  }, context);
  const card = core.createTurnCard({
    agentId: identity.value.agentId,
    regionId: "region_salt_gate",
    prompt: "描述本回合行动",
  }, context);
  const resolved = core.resolveTurnCardIntent({
    turnCardId: card.value.turnCardId,
    sequence: card.value.sequence,
    nonce: card.value.nonce,
    intentText: "我先观察盐门的动静。",
  }, context);

  assert.equal(resolved.value.intentAudit?.status, "matched");
  assert.equal(resolved.value.actionOptionId, resolved.value.intentAudit?.actionOptionId);
  assert.ok(resolved.events.some((candidate) => candidate.eventType === "turn_resolved"));
});
