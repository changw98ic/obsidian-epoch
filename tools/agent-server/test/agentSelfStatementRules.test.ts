import assert from "node:assert/strict";
import test from "node:test";

import { agentSelfStatement } from "../lib/epoch/agentSelfStatementRules.ts";
import type { EpochAgentIdentity } from "../lib/epoch/gameCore.ts";
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

test("agent self statements contain only identity, region, and recorded-event facts", () => {
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
