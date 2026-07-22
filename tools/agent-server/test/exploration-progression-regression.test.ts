import assert from "node:assert/strict";
import test from "node:test";

import type { EpochEvent } from "../lib/epoch/events.ts";
import {
  createEpochGameCore,
  type EpochAgentIdentity,
  type EpochHostedActionRecord,
  type EpochHostedSession,
  type EpochInventoryItem,
  type EpochProjection,
} from "../lib/epoch/gameCore.ts";
import type { EpochCommandContext } from "../lib/epoch/protocol.ts";
import {
  createExplorationRuntime,
} from "../lib/epoch/explorationRuntime.ts";
import type {
  EpochExplorationMetrics,
  EpochResultPagePayload,
  EpochSharedResultPage,
} from "../lib/epoch/runtime.ts";
import type { EpochRuntimeResult } from "../lib/epoch/runtimePublicProjectionRules.ts";

type AnyRecord = Readonly<Record<string, unknown>>;
type Risk = EpochExplorationMetrics["intensity"];

type ExplorationRegressionMetrics = EpochExplorationMetrics & Readonly<{
  scoreBreakdown: {
    readonly combatReadinessMaxContribution: number;
    readonly antiFarmDecay: number;
    readonly finalScore: number;
  };
  progressionReward: {
    readonly source: string;
    readonly sourceEventIds: readonly string[];
    readonly evidence: {
      readonly repeatIndex: number;
    };
    readonly rewards: {
      readonly functional_xp: number;
      readonly insight_points: number;
      readonly materials: readonly { readonly materialId: string; readonly quantity: number }[];
    };
    readonly effects: readonly unknown[];
  };
}>;

function identity(): EpochAgentIdentity {
  return {
    agentId: "agent_1",
    explorerId: "explorer_1",
    identityName: "回归测试员",
    status: "active",
    generation: 1,
    lifetime: { remaining: 12 },
  } as unknown as EpochAgentIdentity;
}

function event(input: {
  readonly eventId: string;
  readonly eventType: string;
  readonly aggregateId: string;
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
    createdAt: "2026-07-20T00:00:00.000Z",
    payload: input.payload || {},
  } as unknown as EpochEvent;
}

function runtimeResult<TValue>(value: TValue, events: readonly EpochEvent[], projection: EpochProjection): EpochRuntimeResult<TValue> {
  return { value, events, projection };
}

function sharedPage(payload: EpochResultPagePayload): EpochSharedResultPage {
  return {
    pageId: "epoch_page_regression",
    createdAt: payload.generatedAt,
    expiresAt: "2026-07-21T00:00:00.000Z",
    urlPath: "/epoch/result/epoch_page_regression",
    payload,
    publicSafeSummary: payload.publicSafeSummary,
    createdBy: "explorer_1",
    idempotencyKey: "result_page:regression",
    status: "active",
    shareVersion: 1,
  } as EpochSharedResultPage;
}

function regressionRun(input: {
  readonly risk: Risk;
  readonly stepCount?: number;
  readonly nonEvidence?: boolean;
  readonly highCombat?: boolean;
  readonly reuseState?: {
    readonly events: EpochEvent[];
    readonly sessions: Record<string, EpochHostedSession>;
  };
}) {
  const events = input.reuseState?.events ?? [];
  const sessions = input.reuseState?.sessions ?? {};
  const submissions: AnyRecord[] = [];
  const attributeProgressionCalls: AnyRecord[] = [];
  const inventoryItems: Record<string, EpochInventoryItem> = input.highCombat
    ? Object.fromEntries(Array.from({ length: 6 }, (_unused, index) => [`item_${index}`, {
        itemId: `item_${index}`,
        agentId: "agent_1",
        ownerAgentId: "agent_1",
        itemKey: `legendary_${index}`,
        name: `Legendary ${index}`,
        rarity: "legendary",
        bound: true,
        createdAt: "2026-07-20T00:00:00.000Z",
      } as unknown as EpochInventoryItem]))
    : {};
  const project = (): EpochProjection => ({
    ...createEpochGameCore().project(),
    events,
    identities: { agent_1: identity() },
    lineage: { explorer_1: ["agent_1"] },
    hostedSessions: sessions,
    attributeScores: input.highCombat
      ? { agent_1: { physique: 80, intellect: 80, willpower: 80 } }
      : { agent_1: { physique: 8, intellect: 8, willpower: 8 } },
    resourceBalances: input.highCombat
      ? { agent_1: { stamina: 20, focus: 20, aether: 12, legend: 3, coin: 80 } }
      : { agent_1: { stamina: 2, focus: 2 } },
    inventoryItemIdsByAgent: input.highCombat ? { agent_1: Object.keys(inventoryItems) } : {},
    inventoryItems,
  } as unknown as EpochProjection);
  const runtime = createExplorationRuntime({
    assertPublicTextSafe: () => undefined,
    idempotently: (_scope, _request, _explorerId, run) => run(),
    requireIdentity: () => identity(),
    project,
    publicProjection: project,
    now: () => "2026-07-20T00:10:00.000Z",
    ownerVerifiedContext: (_contextInput, explorerId): EpochCommandContext => ({
      actorExplorerId: explorerId,
      trustClass: "user_verified_web",
      channelClass: "user_verified_web",
      deliveryTrust: "user_verified_web",
    } as EpochCommandContext),
    startHostedSession: (startInput) => {
      const index = Object.keys(sessions).length + 1;
      const created = {
        sessionId: `session_${index}`,
        agentId: "agent_1",
        explorerId: "explorer_1",
        regionId: startInput.regionId,
        mandate: startInput.mandate,
        channelClass: "server_hosted",
        deliveryTrust: "user_verified_web",
        status: "active",
        actionOptions: [{
          actionOptionId: `option_${input.risk}`,
          optionKey: input.risk,
          label: `${input.risk} action`,
          risk: input.risk,
          explanation: { title: input.risk, body: input.risk },
        }],
        actions: [],
        startedAt: "2026-07-20T00:00:00.000Z",
      } as EpochHostedSession;
      sessions[created.sessionId] = created;
      const createdEvent = event({
        eventId: `event_session_${index}`,
        eventType: "hosted_session_started",
        aggregateId: created.sessionId,
        payload: { sessionId: created.sessionId },
      });
      events.push(createdEvent);
      return runtimeResult(created, [createdEvent], project());
    },
    submitHostedAction: (submitInput) => {
      const index = submissions.length + 1;
      submissions.push(submitInput as unknown as AnyRecord);
      const recorded = {
        actionId: `action_${index}`,
        sessionId: submitInput.sessionId,
        agentId: "agent_1",
        channelClass: "server_hosted",
        deliveryTrust: "user_verified_web",
        actionOptionId: submitInput.actionOptionId,
        optionLabel: `${input.risk} action`,
        explanation: { title: input.risk, body: input.risk },
        outcomeSummary: "完成一段探索。",
        recordedAt: "2026-07-20T00:01:00.000Z",
        signedEnvelope: {},
        nonEvidence: input.nonEvidence,
      } as unknown as EpochHostedActionRecord;
      sessions[submitInput.sessionId] = {
        ...sessions[submitInput.sessionId],
        status: "completed",
        completedAt: recorded.recordedAt,
        actions: [recorded],
      } as EpochHostedSession;
      const recordedEvent = event({
        eventId: `event_action_${index}_${Object.keys(sessions).length}`,
        eventType: "hosted_action_recorded",
        aggregateId: submitInput.sessionId,
        payload: { actionId: recorded.actionId, source: "server_evidence" },
      });
      events.push(recordedEvent);
      return runtimeResult(recorded, [recordedEvent], project());
    },
    grantAttributeProgression: (progressionInput) => {
      attributeProgressionCalls.push(progressionInput as unknown as AnyRecord);
      throw new Error("legacy_attribute_progression_must_not_run");
    },
    createResultPageFromPayload: (_pageInput, payload) => ({ page: sharedPage(payload) }),
  });
  const result = runtime.runExploration({
    agentId: "agent_1",
    regionId: "region_gray_harbor",
    mandate: "清理同一片安全街区",
    stepCount: input.stepCount ?? 10,
    idempotencyKey: `regression:${input.risk}:${events.length}:${input.nonEvidence ? "poor" : "good"}`,
  });
  return {
    result,
    metrics: result.value.metrics as ExplorationRegressionMetrics,
    attributeProgressionCalls,
    state: { events, sessions },
  };
}

function resourceKeys(effects: readonly unknown[]) {
  return effects.map((effect) => {
    const record = effect as { readonly after?: { readonly resourceKey?: string } };
    return record.after?.resourceKey;
  });
}

test("exploration progression rewards low medium and high ten-step runs without direct attribute gains", () => {
  for (const risk of ["low", "medium", "high"] as const) {
    const { result, metrics, attributeProgressionCalls } = regressionRun({ risk, stepCount: 10 });
    assert.equal(result.value.stepCount, 10);
    assert.equal(metrics.intensity, risk);
    assert.deepEqual(attributeProgressionCalls, []);
    assert.equal(result.events.some((item) => item.eventType === "attribute_gained"), false);
    assert.deepEqual(metrics.attributeDelta, {});
    assert.ok(metrics.progressionReward.source);
    assert.equal(metrics.progressionReward.sourceEventIds.length, 10);
    assert.ok(metrics.progressionReward.rewards.functional_xp > 0);
    assert.ok(metrics.progressionReward.rewards.insight_points > 0);
    assert.ok(metrics.progressionReward.rewards.materials.some((material) => material.materialId.startsWith("cultivation_")));
    assert.ok(metrics.progressionReward.rewards.materials.some((material) => material.materialId.startsWith("skill_")));
    const keys = resourceKeys(metrics.progressionReward.effects);
    assert.ok(keys.includes("functional_xp"));
    assert.ok(keys.includes("insight_points"));
    assert.ok(keys.some((key) => key?.startsWith("material.")));
  }
});

test("repeated low-risk exploration decays score and progression reward", () => {
  const first = regressionRun({ risk: "low", stepCount: 10 });
  const second = regressionRun({ risk: "low", stepCount: 10, reuseState: first.state });
  assert.equal(first.metrics.progressionReward.evidence.repeatIndex, 0);
  assert.equal(second.metrics.progressionReward.evidence.repeatIndex, 1);
  assert.ok(second.metrics.scoreBreakdown.antiFarmDecay > first.metrics.scoreBreakdown.antiFarmDecay);
  assert.ok(second.metrics.rating < first.metrics.rating);
  assert.ok(second.metrics.progressionReward.rewards.functional_xp < first.metrics.progressionReward.rewards.functional_xp);
});

test("exploration scoring is execution-sensitive and combat readiness is capped", () => {
  const clean = regressionRun({ risk: "high", stepCount: 10, highCombat: true });
  const sloppy = regressionRun({ risk: "high", stepCount: 10, highCombat: true, nonEvidence: true });
  assert.equal(clean.metrics.combatPower, sloppy.metrics.combatPower);
  assert.ok(clean.metrics.rating > sloppy.metrics.rating);
  assert.equal(clean.metrics.scoreBreakdown.combatReadinessMaxContribution, 25);

  const lowRiskOvermatch = regressionRun({ risk: "low", stepCount: 10, highCombat: true });
  assert.ok(lowRiskOvermatch.metrics.combatPower >= clean.metrics.combatPower);
  assert.ok(lowRiskOvermatch.metrics.rating < 70);
});
