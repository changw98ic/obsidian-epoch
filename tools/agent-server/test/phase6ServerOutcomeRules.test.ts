import assert from "node:assert/strict";
import test from "node:test";

import type { EpochEvent } from "../lib/epoch/events.ts";
import { buildPhase6ServerOutcomeEvidence } from "../lib/epoch/phase6ServerOutcomeRules.ts";

function hostedAction(actionId: string, actionOptionId: string): EpochEvent {
  return {
    eventId: "event-safe-recall",
    eventType: "hosted_action_recorded",
    aggregateType: "hosted_session",
    aggregateId: "session-safe-recall",
    causationId: "command-safe-recall",
    payload: {
      actionId,
      actionOptionId,
      optionLabel: "接受召回并安全离开",
      outcomeSummary: "服务器记录安全离开；本次主线任务未完成。",
      phase: "main",
    },
  } as unknown as EpochEvent;
}

function evidenceInput(committedResults: readonly unknown[]) {
  return {
    canonicalEvents: [hostedAction("action-safe-recall", "option-safe-recall")],
    committedResults,
    journeyBinding: {
      journeyId: "journey-safe-recall",
      agentId: "agent-safe-recall",
      status: "settled",
    },
    worldCursor: { worldId: "world-safe-recall" },
  };
}

test("server-signed safe recall is accepted as a failed objective outcome", () => {
  const evidence = buildPhase6ServerOutcomeEvidence(evidenceInput([{
    recalled: true,
    recallMode: "server_safe_return",
    idempotencyKey: "command-safe-recall",
    journey: { status: "settled" },
    settledAction: {
      actionId: "action-safe-recall",
      actionOptionId: "option-safe-recall",
    },
    episodes: [{
      serverFacts: {
        storyBeat: {
          selectedAction: { optionKey: "recall_without_objective" },
        },
      },
    }],
  }]));

  assert.equal(evidence.ok, true, JSON.stringify(evidence));
  if (!evidence.ok) return;
  const [action] = evidence.value.serverActionResolutions;
  assert.equal(action?.resolutionKind, "safe_recall");
  assert.equal(action?.recallMode, "server_safe_return");
  assert.equal(action?.outcome, "failure");
  assert.equal(action?.completionKind, "failed");
  assert.equal(action?.score, 0);
  assert.equal(evidence.value.serverOutcomeResolution.objective, 0);
});

test("an unbound hosted action is not upgraded to a safe recall by its text", () => {
  const evidence = buildPhase6ServerOutcomeEvidence(evidenceInput([{
    idempotencyKey: "command-safe-recall",
    journey: { status: "settled" },
    settledAction: {
      actionId: "action-safe-recall",
      actionOptionId: "option-safe-recall",
    },
    episodes: [{
      serverFacts: {
        storyBeat: {
          selectedAction: { optionKey: "recall_without_objective" },
        },
      },
    }],
  }]));

  assert.equal(evidence.ok, false, JSON.stringify(evidence));
  if (evidence.ok) return;
  assert.ok(evidence.findings.some((entry) =>
    entry.code === "PHASE6_SERVER_OUTCOME_ACTION_BINDING_MISSING"));
});
