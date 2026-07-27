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
import { buildFallbackJourneyTaskPlan } from "../lib/epoch/journeyGeneratedTaskRules.ts";

const GENERATED_AT = "2026-07-06T00:05:00.000Z";
const journeyInstallation = buildFallbackJourneyTaskPlan({
  taskType: "探访灰港",
  scenarioMapId: "region_gray_harbor",
  availableWorldObjects: [{
    id: "region_gray_harbor",
    type: "region",
    label: "灰港",
    regionId: "region_gray_harbor",
    sourceFactIds: ["world:region:region_gray_harbor"],
  }, {
    id: "workplace_gray_harbor",
    type: "workplace",
    label: "灰港现场",
    regionId: "region_gray_harbor",
    sourceFactIds: ["world:workplace:gray_harbor"],
  }],
});
const journeySealResolver = (_journeyId: string, _plan: unknown) => journeyInstallation.hiddenTaskSeal;

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
    resolveJourneyHiddenTaskSeal: journeySealResolver,
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
    resolveJourneyHiddenTaskSeal: journeySealResolver,
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

test("result page payload rules expose only allowlisted Journey reward fields", () => {
  const built = buildEpochResultPagePayload({
    projection: projection(),
    input: {
      journeyVerification: {
        journeyId: "journey_1",
        correlationId: "journey:journey_1",
        status: "traveling",
        objective: "探访灰港",
        regionId: "region_gray_harbor",
        taskPlan: journeyInstallation.plan,
        episodes: [],
        canonicalEventIds: [],
        stateDelta: {
          outcomeSummary: "带回了港口见闻。",
          reward: {
            resourceId: "resource_obsidian",
            amount: 2,
            internalGrantToken: "must-not-leak",
          },
          rewardBundle: {
            resources: [{ resourceId: "coin", amount: 2 }],
            attributeProgression: {
              mode: "no-direct-gain",
              evidenceSystem: "progressionRules.attributeEvidenceXp",
              summary: "没有直接增加基础属性。",
            },
            items: [{ itemKey: "journey_reward_alpha", displayName: "实验核验凭章", rarity: "common" }],
          },
        },
      },
    },
    generatedAt: GENERATED_AT,
    resolveJourneyHiddenTaskSeal: journeySealResolver,
  });

  assert.deepEqual(built.journey?.stateDelta?.reward, {
    resourceId: "resource_obsidian",
    amount: 2,
  });
  assert.deepEqual(built.journey?.stateDelta?.rewardBundle, {
    resources: [{ resourceId: "coin", amount: 2 }],
    attributeProgression: {
      mode: "no-direct-gain",
      evidenceSystem: "progressionRules.attributeEvidenceXp",
      summary: "没有直接增加基础属性。",
    },
    items: [{ itemKey: "journey_reward_alpha", displayName: "实验核验凭章", rarity: "common" }],
  });
  assert.doesNotMatch(JSON.stringify(built), /must-not-leak|internalGrantToken/);
});

test("result page payload rules reject malformed Journey reward bundles", () => {
  assert.throws(() => buildEpochResultPagePayload({
    projection: projection(),
    input: {
      journeyVerification: {
        journeyId: "journey_reward_polluted",
        correlationId: "journey:journey_reward_polluted",
        status: "traveling",
        objective: "探访灰港",
        regionId: "region_gray_harbor",
        taskPlan: journeyInstallation.plan,
        episodes: [],
        canonicalEventIds: [],
        stateDelta: {
          rewardBundle: {
            resources: [{ resourceId: "legend", amount: 999, forged: true }],
            items: [],
          },
        },
      },
    },
    generatedAt: GENERATED_AT,
    resolveJourneyHiddenTaskSeal: journeySealResolver,
  }), /result_page_journey_reward_bundle_invalid/u);
});

test("result page payload preserves authoritative no-direct-gain progression and rejects forged modes", () => {
  const attributeProgression = {
    mode: "no-direct-gain" as const,
    evidenceSystem: "progressionRules.attributeEvidenceXp" as const,
    summary: "Journey records attribute evidence XP without directly changing permanent base attributes.",
  };
  const built = buildEpochResultPagePayload({
    projection: projection(),
    input: {
      journeyVerification: {
        journeyId: "journey_reward_progression",
        correlationId: "journey:journey_reward_progression",
        status: "traveling",
        objective: "核验成长证据",
        regionId: "region_forest",
        taskPlan: journeyInstallation.plan,
        episodes: [],
        canonicalEventIds: [],
        stateDelta: {
          rewardBundle: {
            resources: [{ resourceId: "coin", amount: 5 }],
            attributeProgression,
            items: [{ itemKey: "journey_reward_forest", displayName: "腐林记录器", rarity: "common" }],
          },
        },
      },
    },
    generatedAt: GENERATED_AT,
    resolveJourneyHiddenTaskSeal: journeySealResolver,
  });
  assert.deepEqual(built.journey?.stateDelta?.rewardBundle?.attributeProgression, attributeProgression);

  assert.throws(() => buildEpochResultPagePayload({
    projection: projection(),
    input: {
      journeyVerification: {
        journeyId: "journey_reward_progression_forged",
        correlationId: "journey:journey_reward_progression_forged",
        status: "traveling",
        objective: "伪造成长模式",
        regionId: "region_forest",
        taskPlan: journeyInstallation.plan,
        episodes: [],
        canonicalEventIds: [],
        stateDelta: {
          rewardBundle: {
            resources: [{ resourceId: "coin", amount: 5 }],
            attributeProgression: {
              mode: "direct-base-stat-gain",
              evidenceSystem: "client_override",
              summary: "forged",
            },
            items: [],
          },
        },
      },
    },
    generatedAt: GENERATED_AT,
    resolveJourneyHiddenTaskSeal: journeySealResolver,
  }), /result_page_journey_reward_bundle_invalid/u);
});

test("settled Journey result pages fail closed instead of degrading invalid episodes to metadata", () => {
  assert.throws(() => buildEpochResultPagePayload({
    projection: projection(),
    input: {
      journeyVerification: {
        journeyId: "journey_polluted",
        correlationId: "journey:journey_polluted",
        status: "settled",
        objective: "伪造已结算旅程",
        regionId: "region_gray_harbor",
        taskPlan: journeyInstallation.plan,
        canonicalEventIds: ["event_polluted"],
        episodes: [{
          episodeId: "journey_polluted:arrival",
          title: "伪造抵达",
          outcomeKey: "polluted",
          participants: [],
          sourceEventIds: ["event_polluted"],
          serverFacts: { sourceEventIds: ["event_polluted"] },
          narrative: {},
        }],
      },
    },
    generatedAt: GENERATED_AT,
    resolveJourneyHiddenTaskSeal: journeySealResolver,
  }), /result_page_journey_grounding_invalid/);
});
