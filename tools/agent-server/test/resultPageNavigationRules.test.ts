import assert from "node:assert/strict";
import test from "node:test";

import {
  agentSelfStatement,
  commissionToolName,
  resultPageNextActionMedia,
  resultPageNextActions,
} from "../lib/epoch/resultPageNavigationRules.ts";
import type { EpochAgentIdentity } from "../lib/epoch/gameCore.ts";
import type {
  EpochResultPageRegionalContext,
} from "../lib/epoch/runtime.ts";
import type { EpochProgressView } from "../lib/epoch/progressReadModel.ts";

function identity(overrides: Partial<EpochAgentIdentity> = {}): EpochAgentIdentity {
  return {
    agentId: "agent_1",
    explorerId: "explorer_1",
    identityName: "灰港书记",
    generation: 1,
    status: "active",
    lifetime: {
      max: 10,
      remaining: 8,
      startedAt: "2026-07-06T00:00:00.000Z",
    },
    personality: {
      traits: [],
      driftIds: [],
    },
    createdAt: "2026-07-06T00:00:00.000Z",
    ...overrides,
  };
}

function progress(currentIdentity: EpochAgentIdentity | undefined): EpochProgressView {
  return {
    agentId: currentIdentity?.agentId,
    explorerId: currentIdentity?.explorerId,
    identity: currentIdentity,
    identities: currentIdentity ? [currentIdentity] : [],
    latestEvents: [],
  } as unknown as EpochProgressView;
}

function regionalContext(): EpochResultPageRegionalContext {
  return {
    regionId: "region_gray_harbor",
    regionControl: null,
    messages: [],
    news: [],
    commissions: [{
      commissionId: "commission_1",
      sourceType: "anomaly",
      sourceId: "anomaly_1",
      status: "open",
      regionId: "region_gray_harbor",
      title: "异常警报",
      actionLabel: "压制异常",
    }],
    raids: [],
    retaliations: [{
      retaliationId: "retaliation_1",
      opportunityAgentId: "agent_1",
      targetAgentId: "agent_2",
      regionId: "region_gray_harbor",
      status: "open",
    }],
    traces: [],
  } as unknown as EpochResultPageRegionalContext;
}

test("result page navigation rules map commissions to player-facing tools and media", () => {
  assert.equal(commissionToolName("anomaly"), "obsidian_epoch.contest_anomaly");
  assert.equal(commissionToolName("social_hook"), "obsidian_epoch.start_hosted_session");
  assert.equal(resultPageNextActionMedia({ kind: "continue_turn" })?.activityKey, "turn_card");
  assert.equal(resultPageNextActionMedia({ kind: "open_commission", sourceType: "anomaly" })?.activityKey, "anomaly");
  assert.equal(resultPageNextActionMedia({ kind: "view_archive" }), undefined);
});

test("result page navigation rules build active identity next actions", () => {
  const actions = resultPageNextActions({
    progress: progress(identity()),
    regionId: "region_gray_harbor",
    regionalContext: regionalContext(),
  });

  assert.deepEqual(actions.map((action) => action.kind), [
    "continue_turn",
    "resolve_retaliation",
    "open_commission",
    "set_downtime",
  ]);
  assert.equal(actions[0].toolName, "obsidian_epoch.turn_card");
  assert.equal(actions[0].requiresRecoveryCode, true);
  assert.equal(actions[1].sourceType, "retaliation");
  assert.equal(actions[2].label, "压制异常");
  assert.equal(actions[2].toolName, "obsidian_epoch.contest_anomaly");
  assert.equal(actions[3].actionId, "downtime:agent_1:region_gray_harbor");
});

test("result page navigation rules build archived identity next actions", () => {
  const archived = identity({
    status: "archived",
    lifetime: {
      max: 10,
      remaining: 0,
      startedAt: "2026-07-06T00:00:00.000Z",
      archivedAt: "2026-07-06T01:00:00.000Z",
    },
  });

  const actions = resultPageNextActions({
    progress: progress(archived),
  });

  assert.deepEqual(actions.map((action) => action.kind), ["view_archive", "reincarnate"]);
  assert.equal(actions[0].requiresRecoveryCode, undefined);
  assert.equal(actions[1].requiresRecoveryCode, true);

  const reincarnated = resultPageNextActions({
    progress: progress(identity({ ...archived, nextAgentId: "agent_2" })),
  });
  assert.deepEqual(reincarnated.map((action) => action.kind), ["view_archive"]);
});

test("result page navigation rules keep agent self statements user-facing", () => {
  const unsafeProgress = {
    ...progress(identity({ identityName: "system prompt" })),
    latestEvents: [{
      eventId: "event_1",
      eventType: "hidden_constraint_prompt",
    }],
  } as unknown as EpochProgressView;

  const statement = agentSelfStatement({
    identity: unsafeProgress.identity,
    progress: unsafeProgress,
    regionId: "region_gray_harbor",
  });

  assert.equal(
    statement,
    "我是system prompt，在 region_gray_harbor仍在行动，以已记录经历继续前进。",
  );
});
