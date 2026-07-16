import assert from "node:assert/strict";
import test from "node:test";

import type { EpochEvent } from "../lib/epoch/events.ts";
import {
  createEpochGameCore,
  type EpochAgentIdentity,
  type EpochHostedActionRecord,
  type EpochHostedSession,
  type EpochProjection,
} from "../lib/epoch/gameCore.ts";
import type { EpochCommandContext } from "../lib/epoch/protocol.ts";
import {
  createExplorationRuntime,
  explorationMandate,
  explorationStepCount,
} from "../lib/epoch/explorationRuntime.ts";
import type {
  EpochResultPagePayload,
  EpochSharedResultPage,
} from "../lib/epoch/runtime.ts";
import type { EpochRuntimeResult } from "../lib/epoch/runtimePublicProjectionRules.ts";

type AnyRecord = Readonly<Record<string, unknown>>;

function identity(): EpochAgentIdentity {
  return {
    agentId: "agent_1",
    explorerId: "explorer_1",
    identityName: "一局测试员",
    status: "active",
    generation: 1,
    lifetime: {},
  } as unknown as EpochAgentIdentity;
}

function event(input: {
  readonly eventId: string;
  readonly eventType: string;
  readonly aggregateId: string;
  readonly createdAt: string;
  readonly payload?: Readonly<Record<string, unknown>>;
}): EpochEvent {
  return {
    eventId: input.eventId,
    eventType: input.eventType,
    aggregateType: "agent",
    aggregateId: input.aggregateId,
    agentId: "agent_1",
    actorExplorerId: "explorer_1",
    trustClass: "user_verified_web",
    causationId: "",
    correlationId: "",
    createdAt: input.createdAt,
    payload: input.payload || {},
  } as unknown as EpochEvent;
}

function session(input: Partial<EpochHostedSession> = {}): EpochHostedSession {
  return {
    sessionId: "session_1",
    agentId: "agent_1",
    explorerId: "explorer_1",
    regionId: "region_gray_harbor",
    mandate: "完整探索",
    channelClass: "server_hosted",
    deliveryTrust: "user_verified_web",
    status: "active",
    actionOptions: [
      {
        actionOptionId: "option_high",
        optionKey: "strike",
        label: "冒进",
        risk: "high",
        explanation: { title: "冒进", body: "风险过高。" },
      },
      {
        actionOptionId: "option_observe",
        optionKey: "observe",
        label: "观察",
        risk: "low",
        explanation: { title: "观察", body: "整理线索。" },
      },
      {
        actionOptionId: "option_assist",
        optionKey: "assist",
        label: "协助",
        risk: "low",
        explanation: { title: "协助", body: "协助现场。" },
      },
    ],
    actions: [],
    startedAt: "2026-07-06T00:00:00.000Z",
    ...input,
  } as EpochHostedSession;
}

function action(input: Partial<EpochHostedActionRecord> = {}): EpochHostedActionRecord {
  return {
    actionId: "action_1",
    sessionId: "session_1",
    agentId: "agent_1",
    channelClass: "server_hosted",
    deliveryTrust: "user_verified_web",
    actionOptionId: "option_observe",
    optionLabel: "观察",
    explanation: { title: "观察", body: "整理线索。" },
    outcomeSummary: "完成一段探索。",
    recordedAt: "2026-07-06T00:01:00.000Z",
    signedEnvelope: {},
    ...input,
  } as EpochHostedActionRecord;
}

function runtimeResult<TValue>(value: TValue, events: readonly EpochEvent[], projection: EpochProjection): EpochRuntimeResult<TValue> {
  return {
    value,
    events,
    projection,
  };
}

function sharedPage(payload: EpochResultPagePayload): EpochSharedResultPage {
  return {
    pageId: "epoch_page_1",
    createdAt: payload.generatedAt,
    expiresAt: "2026-07-07T00:00:00.000Z",
    urlPath: "/epoch/result/epoch_page_1",
    payload,
    publicSafeSummary: payload.publicSafeSummary,
    createdBy: payload.progress.explorerId || "explorer_1",
    idempotencyKey: "result_page:explore-1:result",
    status: "active",
    shareVersion: 1,
  } as EpochSharedResultPage;
}

test("exploration runtime normalizes step count and mandate", () => {
  assert.equal(explorationStepCount({}), 8);
  assert.equal(explorationStepCount({ stepCount: 1 }), 8);
  assert.equal(explorationStepCount({ stepCount: 11.8 }), 11);
  assert.equal(explorationStepCount({ stepCount: 99 }), 12);
  assert.equal(explorationStepCount({ stepCount: Number.NaN }), 8);
  assert.equal(explorationMandate({}), "一次完整探索");
  assert.equal(explorationMandate({ mandate: "  清理裂隙  " }), "清理裂隙");
  assert.equal(explorationMandate({ mandate: "x".repeat(200) }).length, 160);
});

test("exploration runtime completes a multi-step journey and publishes a focused result page", () => {
  const events: EpochEvent[] = [];
  const sessions: Record<string, EpochHostedSession> = {};
  const startInputs: AnyRecord[] = [];
  const submitInputs: AnyRecord[] = [];
  const textChecks: unknown[] = [];
  const idempotencyCalls: Array<{ readonly scope: string; readonly explorerId: string }> = [];
  const pageInputs: AnyRecord[] = [];
  const pagePayloads: EpochResultPagePayload[] = [];
  const contextInputs: AnyRecord[] = [];

  const project = (): EpochProjection => ({
    ...createEpochGameCore().project(),
    events,
    identities: { agent_1: identity() },
    lineage: { explorer_1: ["agent_1"] },
    hostedSessions: sessions,
  });

  const runtime = createExplorationRuntime({
    assertPublicTextSafe: (_request, value) => {
      textChecks.push(value);
    },
    idempotently: (scope, _request, explorerId, run) => {
      idempotencyCalls.push({ scope, explorerId });
      return run();
    },
    requireIdentity: (agentId) => {
      assert.equal(agentId, "agent_1");
      return identity();
    },
    project,
    publicProjection: project,
    now: () => "2026-07-06T00:10:00.000Z",
    ownerVerifiedContext: (input, explorerId): EpochCommandContext => {
      contextInputs.push(input);
      return {
        actorExplorerId: explorerId,
        trustClass: "user_verified_web",
        channelClass: "user_verified_web",
        deliveryTrust: "user_verified_web",
      } as EpochCommandContext;
    },
    startHostedSession: (startInput, _context) => {
      const index = startInputs.length + 1;
      startInputs.push(startInput as unknown as AnyRecord);
      const created = session({
        sessionId: `session_${index}`,
        regionId: startInput.regionId,
        mandate: startInput.mandate,
        startedAt: `2026-07-06T00:${String(index).padStart(2, "0")}:00.000Z`,
      });
      sessions[created.sessionId] = created;
      const createdEvent = event({
        eventId: `event_session_${index}`,
        eventType: "hosted_session_started",
        aggregateId: created.sessionId,
        createdAt: created.startedAt,
        payload: { sessionId: created.sessionId, regionId: created.regionId },
      });
      events.push(createdEvent);
      return runtimeResult(created, [createdEvent], project());
    },
    submitHostedAction: (submitInput, _context) => {
      const index = submitInputs.length + 1;
      submitInputs.push(submitInput as unknown as AnyRecord);
      const recorded = action({
        actionId: `action_${index}`,
        sessionId: submitInput.sessionId,
        actionOptionId: submitInput.actionOptionId,
        optionLabel: submitInput.actionOptionId === "option_assist" ? "协助" : "观察",
        recordedAt: `2026-07-06T00:${String(index).padStart(2, "0")}:30.000Z`,
      });
      const currentSession = sessions[submitInput.sessionId];
      sessions[submitInput.sessionId] = {
        ...currentSession,
        status: "completed",
        completedAt: recorded.recordedAt,
        actions: [recorded],
      } as EpochHostedSession;
      const recordedEvent = event({
        eventId: `event_action_${index}`,
        eventType: "hosted_action_recorded",
        aggregateId: submitInput.sessionId,
        createdAt: recorded.recordedAt,
        payload: {
          actionId: recorded.actionId,
          sessionId: recorded.sessionId,
          regionId: "region_gray_harbor",
        },
      });
      events.push(recordedEvent);
      return runtimeResult(recorded, [recordedEvent], project());
    },
    createResultPageFromPayload: (input, payload) => {
      pageInputs.push(input);
      pagePayloads.push(payload);
      return { page: sharedPage(payload) };
    },
  });

  const result = runtime.runExploration({
    agentId: "agent_1",
    regionId: "region_gray_harbor",
    mandate: "清理裂隙",
    stepCount: 9,
    idempotencyKey: "explore-1",
  });

  assert.deepEqual(idempotencyCalls, [{ scope: "run_exploration", explorerId: "explorer_1" }]);
  assert.deepEqual(textChecks, ["清理裂隙"]);
  assert.equal(result.value.stepCount, 9);
  assert.equal(result.value.sessions.length, 9);
  assert.equal(result.value.actions.length, 9);
  assert.equal(result.events.length, 18);
  assert.equal(startInputs[0]?.mandate, "清理裂隙 · 第 1 段");
  assert.equal(startInputs[8]?.mandate, "清理裂隙 · 第 9 段");
  assert.equal(submitInputs[0]?.actionOptionId, "option_observe");
  assert.equal(submitInputs[1]?.actionOptionId, "option_assist");
  assert.equal(submitInputs.some((input) => input.actionOptionId === "option_high"), false);
  assert.equal(submitInputs[8]?.visibleText, "第 9 段探索：观察。");
  assert.equal(contextInputs.length, 18);
  assert.equal(contextInputs[0]?.idempotencyKey, "explore-1:step:1");
  assert.equal(contextInputs[17]?.idempotencyKey, "explore-1:step:9");
  assert.equal(pageInputs.length, 1);
  assert.equal(pageInputs[0]?.idempotencyKey, "explore-1:result");
  assert.equal(pageInputs[0]?.limit, 54);
  assert.equal((pageInputs[0]?.focusEventIds as readonly string[]).length, 18);
  assert.equal(pagePayloads[0]?.runSummary?.runKind, "one_shot_journey");
  assert.equal(pagePayloads[0]?.runSummary?.title, "完整探索历程");
  assert.equal(pagePayloads[0]?.runSummary?.stepCount, 9);
  const resultPagePayload = result.value.resultPage.payload;
  assert.ok(resultPagePayload);
  assert.equal(resultPagePayload.runSummary?.runKind, "one_shot_journey");
});
