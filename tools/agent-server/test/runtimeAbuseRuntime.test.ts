import test from "node:test";
import assert from "node:assert/strict";

import type { EpochProjection } from "../lib/epoch/gameCore.ts";
import { createRuntimeAbuseRuntime } from "../lib/epoch/runtimeAbuseRuntime.ts";

function projection(abuseScores: EpochProjection["abuseScores"] = {}): EpochProjection {
  return { abuseScores } as EpochProjection;
}

test("runtime abuse runtime enforces per-actor state-change windows", () => {
  let now = new Date("2026-06-25T00:00:00.000Z");
  const runtime = createRuntimeAbuseRuntime({
    abuseLimits: { stateChangesPerWindow: 2, windowMs: 1000 },
    clock: () => now,
    project: () => projection(),
  });

  runtime.assertAllowed({ agentId: "agent_window" });
  runtime.assertAllowed({ agentId: "agent_window" });

  assert.deepEqual(runtime.status({ agentId: "agent_window" }), {
    actorKey: "agent_window",
    disabled: false,
    limit: 2,
    windowMs: 1000,
    count: 2,
    remaining: 0,
    limited: true,
    resetAt: "2026-06-25T00:00:01.000Z",
    abuseScore: 0,
    abuseLevel: "clear",
    latestAbuseEventId: undefined,
  });
  assert.throws(() => runtime.assertAllowed({ agentId: "agent_window" }), /epoch_abuse_limit_exceeded/);

  now = new Date("2026-06-25T00:00:01.001Z");
  assert.equal(runtime.status({ agentId: "agent_window" }).count, 0);
  runtime.assertAllowed({ agentId: "agent_window" });
  assert.equal(runtime.status({ agentId: "agent_window" }).count, 1);
});

test("runtime abuse runtime blocks restricted scores unless explicitly allowed", () => {
  const runtime = createRuntimeAbuseRuntime({
    abuseLimits: { stateChangesPerWindow: 3, windowMs: 60_000 },
    clock: () => new Date("2026-06-25T00:00:00.000Z"),
    project: () => projection({
      explorer_restricted: {
        actorKey: "explorer_restricted",
        explorerId: "explorer_restricted",
        score: 12,
        latestEventId: "epoch_event_restricted",
        reasons: { repeated_invalid_commands: 12 },
        sourceEventIds: ["epoch_event_restricted"],
        updatedAt: "2026-06-25T00:00:00.000Z",
      },
    }),
  });

  assert.throws(
    () => runtime.assertAllowed({ explorerId: "explorer_restricted" }),
    /epoch_abuse_score_restricted/,
  );
  runtime.assertAllowed({ explorerId: "explorer_restricted" }, { allowRestrictedScore: true });

  const status = runtime.status({ explorerId: "explorer_restricted" });
  assert.equal(status.count, 1);
  assert.equal(status.abuseScore, 12);
  assert.equal(status.abuseLevel, "restricted");
  assert.equal(status.latestAbuseEventId, "epoch_event_restricted");
});

test("runtime abuse runtime disabled mode preserves status without counting writes", () => {
  const runtime = createRuntimeAbuseRuntime({
    abuseLimits: { disabled: true, stateChangesPerWindow: 1, windowMs: 500 },
    clock: () => new Date("2026-06-25T00:00:00.000Z"),
    project: () => projection(),
  });

  runtime.assertAllowed({ agentId: "agent_disabled" });
  runtime.assertAllowed({ agentId: "agent_disabled" });

  assert.deepEqual(runtime.status({ agentId: "agent_disabled" }), {
    actorKey: "agent_disabled",
    disabled: true,
    limit: 1,
    windowMs: 500,
    count: 0,
    remaining: 1,
    limited: false,
    resetAt: undefined,
    abuseScore: 0,
    abuseLevel: "clear",
    latestAbuseEventId: undefined,
  });
});
