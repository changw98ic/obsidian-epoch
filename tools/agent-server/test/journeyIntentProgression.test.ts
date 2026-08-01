import assert from "node:assert/strict";
import test from "node:test";

import { createAgentWorldMcpRuntime } from "../lib/mcpTools.ts";
import type { ModelAdapter } from "../lib/modelAdapter.ts";
import { createSequentialEpochIdFactory } from "../lib/epoch/protocol.ts";

interface JourneyState {
  readonly journeyId: string;
  readonly version: number;
}

interface IdentityPayload {
  readonly value: { readonly agentId: string };
}

interface JourneyProposalPayload {
  readonly journey: JourneyState;
  readonly proposal: {
    readonly expectedVersion: number;
    readonly episode: { readonly episodeId: string };
    readonly sceneContract: { readonly sceneId: string };
  };
}

interface JourneyCommitPayload {
  readonly value: {
    readonly match: { readonly status: string };
    readonly action: Record<string, unknown>;
  };
  readonly journey: JourneyState;
  readonly episode: { readonly episodeId: string };
  readonly episodes: readonly { readonly episodeId: string }[];
}

interface CompactJourneyCommitPayload {
  readonly journey: JourneyState;
  readonly episode: { readonly episodeId: string };
  readonly action: Record<string, unknown>;
}

function payload<T>(result: { readonly content: readonly { readonly text: string }[] }): T {
  return JSON.parse(result.content[0]?.text ?? "null") as T;
}

function recoveryCode(explorerId: string, localSecret: string) {
  return Buffer.from(JSON.stringify({ explorerId, localSecret }), "utf8").toString("base64");
}

test("natural-language Journey commit records an episode and returns the next version", async () => {
  const modelAdapter: ModelAdapter = {
    provider: "openai_compatible",
    model: "journey-intent-test-model",
    endpoint: "http://model.test/v1/chat/completions",
    complete: async () => ({
      provider: "openai_compatible",
      model: "journey-intent-test-model",
      text: JSON.stringify({
        verb: "observe",
        target: "灰港入口",
        desiredOutcome: "记录可核验线索",
        constraints: ["avoid_unnecessary_risk"],
        riskTolerance: "low",
      }),
    }),
    warmup: async () => {},
  };
  const mcp = createAgentWorldMcpRuntime({
    epoch: {
      idFactory: createSequentialEpochIdFactory("journey_intent_progression"),
      modelAdapter,
      clock: () => new Date("2026-07-12T00:00:00.000Z"),
    },
    journey: {
      now: () => "2026-07-12T00:00:00.000Z",
      worldNow: () => "2026-01-01T08:00:00.000Z",
      defaultRealDurationMs: 30 * 60 * 1_000,
      defaultWorldDurationMs: 60 * 60 * 1_000,
    },
  });
  const explorerId = "explorer_journey_intent_progression";
  const ownerRecovery = recoveryCode(explorerId, "journey-intent-progression-secret");
  const identity = payload<IdentityPayload>(await mcp.callTool("obsidian_epoch.identity", {
    explorerId,
    recoveryCode: ownerRecovery,
    identityName: "自然语言旅者",
    idempotencyKey: "journey-intent-identity-1",
  }));
  const prepared = payload<{ readonly journey: JourneyState }>(await mcp.callTool("obsidian_epoch.prepare_journey", {
    agentId: identity.value.agentId,
    destinationRegionId: "灰港",
    mandate: { objective: "找稳定工作", priorities: ["work"], avoid: ["conflict"] },
    presetId: "cautious",
    recoveryCode: ownerRecovery,
    idempotencyKey: "journey-intent-prepare-1",
  }));
  const started = payload<JourneyProposalPayload>(await mcp.callTool("obsidian_epoch.start_journey", {
    journeyId: prepared.journey.journeyId,
    expectedVersion: prepared.journey.version,
    recoveryCode: ownerRecovery,
    idempotencyKey: "journey-intent-start-1",
  }));
  const proposed = payload<JourneyProposalPayload>(await mcp.callTool("obsidian_epoch.propose_journey_step", {
    journeyId: started.journey.journeyId,
    expectedVersion: started.journey.version,
    recoveryCode: ownerRecovery,
    idempotencyKey: "journey-intent-propose-1",
  }));

  const committed = payload<JourneyCommitPayload>(await mcp.callTool("obsidian_epoch.commit_journey_intent", {
    journeyId: started.journey.journeyId,
    sceneId: proposed.proposal.sceneContract.sceneId,
    episodeId: proposed.proposal.episode.episodeId,
    expectedVersion: proposed.proposal.expectedVersion,
    intentText: "我先观察灰港入口，记录现场线索，不要冒险。",
    recoveryCode: ownerRecovery,
    idempotencyKey: "journey-intent-commit-1",
  }));

  assert.equal(committed.value.match.status, "matched");
  assert.ok(committed.journey.version > proposed.proposal.expectedVersion);
  assert.equal(committed.episode.episodeId, proposed.proposal.episode.episodeId);
  assert.equal(committed.episodes.some((episode: { episodeId: string }) =>
    episode.episodeId === proposed.proposal.episode.episodeId), true);
  assert.equal("actionOptionId" in committed.value.action, false);

  const nextProposal = payload<JourneyProposalPayload>(await mcp.callTool("obsidian_epoch.propose_journey_step", {
    journeyId: committed.journey.journeyId,
    expectedVersion: committed.journey.version,
    recoveryCode: ownerRecovery,
    idempotencyKey: "journey-intent-propose-2",
  }));
  assert.notEqual(nextProposal.proposal.episode.episodeId, proposed.proposal.episode.episodeId);

  const compactCommitted = payload<CompactJourneyCommitPayload>(await mcp.callTool("obsidian_epoch.commit_journey_intent_compact", {
    journeyId: nextProposal.journey.journeyId,
    sceneId: nextProposal.proposal.sceneContract.sceneId,
    episodeId: nextProposal.proposal.episode.episodeId,
    expectedVersion: nextProposal.proposal.expectedVersion,
    intentText: "继续观察现场，记录新的核验线索。",
    recoveryCode: ownerRecovery,
    idempotencyKey: "journey-intent-commit-2-compact",
  }));
  assert.ok(compactCommitted.journey.version > committed.journey.version);
  assert.equal(compactCommitted.episode.episodeId, nextProposal.proposal.episode.episodeId);
  assert.equal("actionOptionId" in compactCommitted.action, false);
});
