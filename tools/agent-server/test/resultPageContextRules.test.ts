import assert from "node:assert/strict";
import test from "node:test";

import type { EpochEvent } from "../lib/epoch/events.ts";
import { createEpochGameCore, type EpochHostedSession, type EpochTurnCard } from "../lib/epoch/gameCore.ts";
import type { EpochProgressView } from "../lib/epoch/progressReadModel.ts";
import {
  canonicalResultPageRegionIdFromInput,
  latestProgressRegionId,
  resultPageFocusHostedSession,
  resultPageFocusTurnCard,
  resultPageRegionId,
  resultPageRegionalContext,
} from "../lib/epoch/resultPageContextRules.ts";

function eventWithRegion(regionId: unknown): EpochEvent {
  return {
    eventId: "event_1",
    eventType: "turn_resolved",
    aggregateType: "agent",
    aggregateId: "agent_1",
    createdAt: "2026-07-06T00:00:00.000Z",
    trustClass: "server_settled",
    payload: { regionId },
  } as unknown as EpochEvent;
}

function progress(input: {
  readonly downtimeRegionId?: string;
  readonly events?: readonly EpochEvent[];
} = {}): EpochProgressView {
  return {
    latestEvents: input.events || [],
    ...(input.downtimeRegionId ? { downtime: { regionId: input.downtimeRegionId } } : {}),
  } as unknown as EpochProgressView;
}

test("result page context rules canonicalize requested region ids", () => {
  assert.equal(canonicalResultPageRegionIdFromInput("  region_gray_harbor  "), "region_gray_harbor");
  assert.equal(canonicalResultPageRegionIdFromInput(""), undefined);
  assert.equal(canonicalResultPageRegionIdFromInput(42), undefined);
});

test("result page context rules read the latest visible region from progress events", () => {
  assert.equal(latestProgressRegionId([
    eventWithRegion("region_mist_farms"),
    eventWithRegion("region_gray_harbor"),
  ]), "region_mist_farms");
  assert.equal(latestProgressRegionId([eventWithRegion("  ")]), undefined);
});

test("result page context rules choose the most specific result region", () => {
  assert.equal(resultPageRegionId({
    input: { regionId: "region_mist_farms" },
    progress: progress({
      downtimeRegionId: "region_bone_quarry",
      events: [eventWithRegion("region_gray_harbor")],
    }),
    focusTurnCard: { regionId: "region_turn_card" } as EpochTurnCard,
    focusHostedSession: { regionId: "region_hosted_session" } as EpochHostedSession,
  }), "region_turn_card");

  assert.equal(resultPageRegionId({
    input: { regionId: "region_mist_farms" },
    progress: progress({
      downtimeRegionId: "region_bone_quarry",
      events: [eventWithRegion("region_gray_harbor")],
    }),
    focusHostedSession: { regionId: "region_hosted_session" } as EpochHostedSession,
  }), "region_hosted_session");

  assert.equal(resultPageRegionId({
    input: { regionId: "region_mist_farms" },
    progress: progress({
      downtimeRegionId: "region_bone_quarry",
      events: [eventWithRegion("region_gray_harbor")],
    }),
  }), "region_mist_farms");

  assert.equal(resultPageRegionId({
    input: {},
    progress: progress({
      downtimeRegionId: "region_bone_quarry",
      events: [eventWithRegion("region_gray_harbor")],
    }),
  }), "region_bone_quarry");

  assert.equal(resultPageRegionId({
    input: {},
    progress: progress({ events: [eventWithRegion("region_gray_harbor")] }),
  }), "region_gray_harbor");
});

test("result page context rules validate focused turn cards", () => {
  const resolvedCard = {
    turnCardId: "turn_card_1",
    agentId: "agent_1",
    explorerId: "explorer_1",
    regionId: "region_gray_harbor",
    status: "resolved",
    resolution: { outcome: "accepted" },
  } as unknown as EpochTurnCard;
  const projection = { turnCards: { turn_card_1: resolvedCard } };

  assert.equal(resultPageFocusTurnCard(projection, {
    turnCardId: "turn_card_1",
    agentId: "agent_1",
    explorerId: "explorer_1",
  }), resolvedCard);
  assert.equal(resultPageFocusTurnCard(projection, {}), undefined);
  assert.throws(() => resultPageFocusTurnCard({ turnCards: {} }, { turnCardId: "missing" }), /turn_card_not_found/);
  assert.throws(() => resultPageFocusTurnCard(projection, { turnCardId: "turn_card_1", agentId: "agent_other" }), /turn_card_agent_mismatch/);
  assert.throws(() => resultPageFocusTurnCard({
    turnCards: { turn_card_1: { ...resolvedCard, status: "open", resolution: undefined } as EpochTurnCard },
  }, { turnCardId: "turn_card_1" }), /turn_card_not_resolved/);
});

test("result page context rules validate focused hosted sessions", () => {
  const completedSession = {
    sessionId: "session_1",
    agentId: "agent_1",
    explorerId: "explorer_1",
    regionId: "region_gray_harbor",
    status: "completed",
    actions: [{ actionId: "action_1" }],
  } as unknown as EpochHostedSession;
  const projection = { hostedSessions: { session_1: completedSession } };

  assert.equal(resultPageFocusHostedSession(projection, {
    hostedSessionId: "session_1",
    agentId: "agent_1",
    explorerId: "explorer_1",
  }), completedSession);
  assert.equal(resultPageFocusHostedSession(projection, {}), undefined);
  assert.throws(() => resultPageFocusHostedSession({ hostedSessions: {} }, { hostedSessionId: "missing" }), /hosted_session_not_found/);
  assert.throws(() => resultPageFocusHostedSession(projection, { hostedSessionId: "session_1", explorerId: "explorer_other" }), /hosted_session_explorer_mismatch/);
  assert.throws(() => resultPageFocusHostedSession({
    hostedSessions: { session_1: { ...completedSession, status: "active", actions: [] } as EpochHostedSession },
  }, { hostedSessionId: "session_1" }), /hosted_session_not_completed/);
});

test("result page context rules build bounded regional context", () => {
  const projection = createEpochGameCore().project();
  const context = resultPageRegionalContext(projection, "region_gray_harbor");

  assert.equal(context?.regionId, "region_gray_harbor");
  assert.equal(context?.regionControl, null);
  assert.deepEqual(context?.messages, []);
  assert.deepEqual(context?.news, []);
  assert.deepEqual(context?.commissions, []);
  assert.deepEqual(context?.raids, []);
  assert.deepEqual(context?.retaliations, []);
  assert.deepEqual(context?.traces, []);
  assert.equal(resultPageRegionalContext(projection), undefined);
});
