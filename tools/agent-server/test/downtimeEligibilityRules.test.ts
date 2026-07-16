import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_DOWNTIME_CLAIM_COOLDOWN_SECONDS,
  DEFAULT_DOWNTIME_SET_COOLDOWN_SECONDS,
  DOWNTIME_MODE_ELIGIBILITY_POLICIES,
  buildDowntimeClaimEligibilitySnapshot,
  buildDowntimeEligibilitySnapshot,
  evaluateDowntimeClaimEligibility,
  evaluateDowntimeSetEligibility,
  requireDowntimeClaimEligibility,
  requireDowntimeSetEligibility,
  type DowntimeEligibilityProjection,
  type DowntimeEligibilitySnapshot,
} from "../lib/epoch/downtimeEligibilityRules.ts";

function projection(
  overrides: Partial<DowntimeEligibilityProjection> = {},
): DowntimeEligibilityProjection {
  return {
    identities: {
      agent_1: { status: "active" },
    },
    resourceBalances: {
      agent_1: {
        coin: 20,
        aether: 5,
        stamina: 10,
        focus: 5,
      },
    },
    downtime: {},
    turnCards: {},
    hostedSessions: {},
    partyRuns: {},
    downtimeAgentStatuses: {
      agent_1: { custodyStatus: "free" },
    },
    regionSafetyStates: {
      region_gray_harbor: { level: "secure" },
    },
    ...overrides,
  };
}

function snapshot(
  overrides: Partial<DowntimeEligibilitySnapshot> = {},
): DowntimeEligibilitySnapshot {
  return {
    agentId: "agent_1",
    identityStatus: "active",
    custodyStatus: "free",
    regionId: "region_gray_harbor",
    regionSafety: "secure",
    resourceBalances: {
      coin: 20,
      aether: 5,
      stamina: 10,
      focus: 5,
    },
    openTurnCardIds: [],
    activeHostedSessionIds: [],
    openPartyRunIds: [],
    ...overrides,
  };
}

test("eligibility snapshot is derived only from authoritative projection fields", () => {
  const result = buildDowntimeEligibilitySnapshot({
    projection: projection({
      downtime: {
        agent_1: {
          mode: "travel",
          regionId: "region_gray_harbor",
          startedAt: "2026-07-10T10:00:00.000Z",
          active: true,
          lastClaimedAt: "2026-07-10T09:00:00.000Z",
        },
      },
      turnCards: {
        turn_other: { agentId: "agent_2", status: "open" },
        turn_resolved: { agentId: "agent_1", status: "resolved" },
        turn_open: { agentId: "agent_1", status: "open" },
      },
      hostedSessions: {
        session_done: { agentId: "agent_1", status: "completed" },
        session_active: { agentId: "agent_1", status: "active" },
      },
      partyRuns: {
        party_settled: {
          leaderAgentId: "agent_1",
          status: "settled",
          members: [{ agentId: "agent_1" }],
        },
        party_member: {
          leaderAgentId: "agent_2",
          status: "open",
          members: [{ agentId: "agent_1" }],
        },
        party_leader: {
          leaderAgentId: "agent_1",
          status: "open",
          members: [],
        },
      },
      downtimeAgentStatuses: {
        agent_1: { custodyStatus: "imprisoned" },
      },
      regionSafetyStates: {
        region_gray_harbor: { level: "guarded" },
      },
    }),
    agentId: "agent_1",
    regionId: "region_gray_harbor",
  });

  assert.deepEqual(result, {
    agentId: "agent_1",
    identityStatus: "active",
    custodyStatus: "imprisoned",
    regionId: "region_gray_harbor",
    regionSafety: "guarded",
    resourceBalances: {
      coin: 20,
      aether: 5,
      stamina: 10,
      focus: 5,
    },
    openTurnCardIds: ["turn_open"],
    activeHostedSessionIds: ["session_active"],
    openPartyRunIds: ["party_leader", "party_member"],
    downtime: {
      mode: "travel",
      regionId: "region_gray_harbor",
      startedAt: "2026-07-10T10:00:00.000Z",
      active: true,
      lastClaimedAt: "2026-07-10T09:00:00.000Z",
    },
  });
});

test("claim snapshot takes its region only from projected active downtime", () => {
  const result = buildDowntimeClaimEligibilitySnapshot({
    projection: projection({
      downtime: {
        agent_1: {
          mode: "travel",
          regionId: "region_claim_authority",
          startedAt: "2026-07-10T10:00:00.000Z",
          active: true,
        },
      },
      regionSafetyStates: {
        region_claim_authority: { level: "guarded" },
        region_client_claim: { level: "secure" },
      },
    }),
    agentId: "agent_1",
  });

  assert.equal(result.regionId, "region_claim_authority");
  assert.equal(result.regionSafety, "guarded");
});

test("set eligibility rejects missing authority state, archived identities, and imprisonment", () => {
  const now = "2026-07-10T10:10:00.000Z";

  assert.deepEqual(evaluateDowntimeSetEligibility({
    snapshot: snapshot({ identityStatus: "missing" }),
    mode: "resting",
    serverNow: now,
  }), { eligible: false, code: "downtime_identity_not_found" });
  assert.deepEqual(evaluateDowntimeSetEligibility({
    snapshot: snapshot({ identityStatus: "archived" }),
    mode: "resting",
    serverNow: now,
  }), { eligible: false, code: "downtime_identity_inactive" });
  assert.deepEqual(evaluateDowntimeSetEligibility({
    snapshot: snapshot({ custodyStatus: "unknown" }),
    mode: "resting",
    serverNow: now,
  }), { eligible: false, code: "downtime_imprisonment_state_unknown" });
  assert.deepEqual(evaluateDowntimeSetEligibility({
    snapshot: snapshot({ custodyStatus: "imprisoned" }),
    mode: "resting",
    serverNow: now,
  }), { eligible: false, code: "downtime_agent_imprisoned" });
});

test("set eligibility rejects every active run source with stable precedence", () => {
  const serverNow = "2026-07-10T10:10:00.000Z";
  const input = { mode: "resting" as const, serverNow };

  assert.deepEqual(evaluateDowntimeSetEligibility({
    ...input,
    snapshot: snapshot({
      openTurnCardIds: ["turn_1"],
      activeHostedSessionIds: ["session_1"],
      openPartyRunIds: ["party_1"],
    }),
  }), {
    eligible: false,
    code: "downtime_active_turn_card",
    blockingId: "turn_1",
  });
  assert.deepEqual(evaluateDowntimeSetEligibility({
    ...input,
    snapshot: snapshot({ activeHostedSessionIds: ["session_1"] }),
  }), {
    eligible: false,
    code: "downtime_active_hosted_session",
    blockingId: "session_1",
  });
  assert.deepEqual(evaluateDowntimeSetEligibility({
    ...input,
    snapshot: snapshot({ openPartyRunIds: ["party_1"] }),
  }), {
    eligible: false,
    code: "downtime_open_party_run",
    blockingId: "party_1",
  });
});

test("mode policies enforce safety and preparation balances at exact boundaries", () => {
  assert.equal(DOWNTIME_MODE_ELIGIBILITY_POLICIES.resting.minimumSafety, "hazardous");
  assert.equal(DOWNTIME_MODE_ELIGIBILITY_POLICIES.travel.minimumSafety, "guarded");
  assert.deepEqual(DOWNTIME_MODE_ELIGIBILITY_POLICIES.travel.preparation, [
    { resourceId: "stamina", minimumBalance: 2 },
  ]);
  assert.deepEqual(DOWNTIME_MODE_ELIGIBILITY_POLICIES.steward.preparation, [
    { resourceId: "coin", minimumBalance: 5 },
  ]);

  assert.deepEqual(evaluateDowntimeSetEligibility({
    snapshot: snapshot({ regionSafety: "unknown" }),
    mode: "travel",
    serverNow: "2026-07-10T10:10:00.000Z",
  }), {
    eligible: false,
    code: "downtime_region_safety_unknown",
    requiredSafety: "guarded",
  });
  assert.deepEqual(evaluateDowntimeSetEligibility({
    snapshot: snapshot({ regionSafety: "unstable" }),
    mode: "travel",
    serverNow: "2026-07-10T10:10:00.000Z",
  }), {
    eligible: false,
    code: "downtime_region_safety_insufficient",
    actualSafety: "unstable",
    requiredSafety: "guarded",
  });
  assert.deepEqual(evaluateDowntimeSetEligibility({
    snapshot: snapshot({ resourceBalances: { stamina: 1 } }),
    mode: "travel",
    serverNow: "2026-07-10T10:10:00.000Z",
  }), {
    eligible: false,
    code: "downtime_preparation_resource_insufficient",
    resourceId: "stamina",
    actualBalance: 1,
    requiredBalance: 2,
  });
  assert.deepEqual(evaluateDowntimeSetEligibility({
    snapshot: snapshot({
      regionSafety: "guarded",
      resourceBalances: { stamina: 2 },
    }),
    mode: "travel",
    serverNow: "2026-07-10T10:10:00.000Z",
  }), { eligible: true });
});

test("set cooldown uses server time and opens exactly at the boundary", () => {
  assert.equal(DEFAULT_DOWNTIME_SET_COOLDOWN_SECONDS, 300);
  const recentlyClaimed = snapshot({
    downtime: {
      mode: "resting",
      regionId: "region_gray_harbor",
      startedAt: "2026-07-10T10:00:00.000Z",
      active: false,
      lastClaimedAt: "2026-07-10T10:05:00.000Z",
    },
  });

  assert.deepEqual(evaluateDowntimeSetEligibility({
    snapshot: recentlyClaimed,
    mode: "resting",
    serverNow: "2026-07-10T10:09:59.999Z",
  }), {
    eligible: false,
    code: "downtime_set_rate_limited",
    retryAt: "2026-07-10T10:10:00.000Z",
  });
  assert.deepEqual(evaluateDowntimeSetEligibility({
    snapshot: recentlyClaimed,
    mode: "resting",
    serverNow: "2026-07-10T10:10:00.000Z",
  }), { eligible: true });
  assert.deepEqual(evaluateDowntimeSetEligibility({
    snapshot: recentlyClaimed,
    mode: "resting",
    serverNow: "not-a-server-time",
  }), { eligible: false, code: "downtime_server_time_invalid" });
});

test("claim eligibility uses projected stance, safety, preparation, and cooldown", () => {
  assert.equal(DEFAULT_DOWNTIME_CLAIM_COOLDOWN_SECONDS, 300);
  const activeTravel = snapshot({
    regionId: "region_gray_harbor",
    regionSafety: "hazardous",
    resourceBalances: { stamina: 0 },
    downtime: {
      mode: "travel",
      regionId: "region_gray_harbor",
      startedAt: "2026-07-10T10:00:00.000Z",
      active: true,
    },
  });

  assert.deepEqual(evaluateDowntimeClaimEligibility({
    snapshot: activeTravel,
    serverNow: "2026-07-10T10:10:00.000Z",
  }), {
    eligible: false,
    code: "downtime_region_safety_insufficient",
    actualSafety: "hazardous",
    requiredSafety: "guarded",
  });
  assert.deepEqual(evaluateDowntimeClaimEligibility({
    snapshot: snapshot({
      resourceBalances: { stamina: 1 },
      downtime: {
        mode: "travel",
        regionId: "region_gray_harbor",
        startedAt: "2026-07-10T10:00:00.000Z",
        active: true,
      },
    }),
    serverNow: "2026-07-10T10:10:00.000Z",
  }), {
    eligible: false,
    code: "downtime_preparation_resource_insufficient",
    resourceId: "stamina",
    actualBalance: 1,
    requiredBalance: 2,
  });
  const atBoundary = snapshot({
    downtime: {
      mode: "travel",
      regionId: "region_gray_harbor",
      startedAt: "2026-07-10T10:00:00.000Z",
      active: true,
    },
    regionSafety: "guarded",
    resourceBalances: { stamina: 2 },
  });
  assert.deepEqual(evaluateDowntimeClaimEligibility({
    snapshot: atBoundary,
    serverNow: "2026-07-10T10:04:59.999Z",
  }), {
    eligible: false,
    code: "downtime_claim_rate_limited",
    retryAt: "2026-07-10T10:05:00.000Z",
  });
  assert.deepEqual(evaluateDowntimeClaimEligibility({
    snapshot: atBoundary,
    serverNow: "2026-07-10T10:05:00.000Z",
  }), { eligible: true });
  assert.deepEqual(evaluateDowntimeClaimEligibility({
    snapshot: snapshot(),
    serverNow: "2026-07-10T10:05:00.000Z",
  }), { eligible: false, code: "downtime_not_active" });
  assert.deepEqual(evaluateDowntimeClaimEligibility({
    snapshot: snapshot({
      regionId: "region_client_claim",
      downtime: {
        mode: "resting",
        regionId: "region_gray_harbor",
        startedAt: "2026-07-10T10:00:00.000Z",
        active: true,
      },
    }),
    serverNow: "2026-07-10T10:05:00.000Z",
  }), { eligible: false, code: "downtime_region_projection_mismatch" });
});

test("require helpers throw stable denial codes", () => {
  assert.throws(() => requireDowntimeSetEligibility({
    snapshot: snapshot({ custodyStatus: "imprisoned" }),
    mode: "resting",
    serverNow: "2026-07-10T10:10:00.000Z",
  }), /^Error: downtime_agent_imprisoned$/);
  assert.throws(() => requireDowntimeClaimEligibility({
    snapshot: snapshot(),
    serverNow: "2026-07-10T10:10:00.000Z",
  }), /^Error: downtime_not_active$/);
});
