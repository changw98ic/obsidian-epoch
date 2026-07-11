import assert from "node:assert/strict";
import test from "node:test";

import type { EpochEvent } from "../lib/epoch/events.ts";
import {
  createEpochGameCore,
  type EpochAgentIdentity,
  type EpochHostedSession,
  type EpochProjection,
  type EpochTurnCard,
} from "../lib/epoch/gameCore.ts";
import { buildEpochResultPagePayload } from "../lib/epoch/resultPagePayloadRules.ts";

const GENERATED_AT = "2026-07-06T00:05:00.000Z";

function projection(overrides: Partial<EpochProjection> = {}): EpochProjection {
  return {
    ...createEpochGameCore().project(),
    ...overrides,
  };
}

function identity(overrides: Partial<EpochAgentIdentity> = {}): EpochAgentIdentity {
  return {
    agentId: "agent_1",
    explorerId: "explorer_1",
    identityName: "灰港调查员",
    status: "active",
    generation: 1,
    lifetime: {},
    ...overrides,
  } as unknown as EpochAgentIdentity;
}

function event(input: {
  readonly eventId: string;
  readonly eventType?: string;
  readonly aggregateId?: string;
  readonly createdAt?: string;
  readonly payload?: Readonly<Record<string, unknown>>;
}): EpochEvent {
  return {
    eventId: input.eventId,
    eventType: input.eventType || "turn_resolved",
    aggregateType: "agent",
    aggregateId: input.aggregateId || "agent_1",
    agentId: input.aggregateId || "agent_1",
    actorExplorerId: "explorer_1",
    trustClass: "user_verified_web",
    causationId: "",
    correlationId: "",
    createdAt: input.createdAt || GENERATED_AT,
    payload: input.payload || {},
  } as unknown as EpochEvent;
}

function resolvedTurnCard(overrides: Partial<EpochTurnCard> = {}): EpochTurnCard {
  return {
    turnCardId: "turn_card_1",
    agentId: "agent_1",
    explorerId: "explorer_1",
    regionId: "region_gray_harbor",
    status: "resolved",
    resolution: { outcome: "accepted" },
    ...overrides,
  } as unknown as EpochTurnCard;
}

function completedSession(overrides: Partial<EpochHostedSession> = {}): EpochHostedSession {
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
    actions: [{
      actionId: "action_1",
      sessionId: "session_1",
      agentId: "agent_1",
      channelClass: "server_hosted",
      deliveryTrust: "user_verified_web",
      actionOptionId: "option_1",
      optionLabel: "观察",
      explanation: { title: "观察", body: "整理线索。" },
      outcomeSummary: "整理了灰港线索。",
      recordedAt: "2026-07-06T00:04:00.000Z",
      signedEnvelope: {},
    }],
    startedAt: "2026-07-06T00:00:00.000Z",
    completedAt: "2026-07-06T00:04:00.000Z",
    ...overrides,
  } as EpochHostedSession;
}

test("result page payload rules build a focused turn-card payload with receipt and regional context", () => {
  const keepEvent = event({
    eventId: "event_keep",
    payload: { turnCardId: "turn_card_1", regionId: "region_gray_harbor" },
  });
  const dropEvent = event({
    eventId: "event_drop",
    createdAt: "2026-07-06T00:04:00.000Z",
    payload: { regionId: "region_gray_harbor" },
  });
  const built = buildEpochResultPagePayload({
    projection: projection({
      events: [dropEvent, keepEvent],
      identities: { agent_1: identity() },
      lineage: { explorer_1: ["agent_1"] },
      turnCards: { turn_card_1: resolvedTurnCard() },
    }),
    input: {
      turnCardId: "turn_card_1",
      focusEventIds: ["event_keep"],
    },
    generatedAt: GENERATED_AT,
  });

  assert.equal(built.pageType, "agent_result");
  assert.equal(built.generatedAt, GENERATED_AT);
  assert.equal(built.progress.agentId, "agent_1");
  assert.equal(built.progress.explorerId, "explorer_1");
  assert.equal(built.progress.latestEvents.length, 1);
  assert.equal(built.progress.latestEvents[0]?.eventId, "event_keep");
  assert.equal(built.focusTurnCard?.turnCardId, "turn_card_1");
  assert.equal(built.regionalContext?.regionId, "region_gray_harbor");
  assert.equal(built.publicPages?.agent, "/epoch/agent/agent_1");
  assert.equal(built.receipt.focus.kind, "turn_card");
  assert.equal(built.receipt.focus.id, "turn_card_1");
  assert.equal(built.receipt.canonicalEvents.some((item) => item.eventId === "event_keep"), true);
});

test("result page payload rules derive hosted-session focus and next actions", () => {
  const built = buildEpochResultPagePayload({
    projection: projection({
      identities: { agent_1: identity() },
      lineage: { explorer_1: ["agent_1"] },
      hostedSessions: { session_1: completedSession() },
    }),
    input: {
      hostedSessionId: "session_1",
      limit: 8,
    },
    generatedAt: GENERATED_AT,
  });

  assert.equal(built.focusHostedSession?.sessionId, "session_1");
  assert.equal(built.regionalContext?.regionId, "region_gray_harbor");
  assert.equal(built.receipt.focus.kind, "hosted_session");
  assert.equal(built.receipt.focus.id, "session_1");
  assert.equal(built.nextActions.some((action) => action.kind === "continue_turn"), true);
  assert.equal(built.nextActions.some((action) => action.kind === "set_downtime"), true);
});

test("result page payload rules reject conflicting focus inputs", () => {
  assert.throws(() => buildEpochResultPagePayload({
    projection: projection({
      turnCards: { turn_card_1: resolvedTurnCard() },
      hostedSessions: { session_1: completedSession() },
    }),
    input: {
      turnCardId: "turn_card_1",
      hostedSessionId: "session_1",
    },
    generatedAt: GENERATED_AT,
  }), /result_page_focus_conflict/);
});
