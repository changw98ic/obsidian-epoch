import assert from "node:assert/strict";
import test from "node:test";

import {
  CROSS_FACTION_DOUBT_MULTIPLIER,
  DEFAULT_FACTION_INFO_SHARING,
  DOUBT_PENALTY_BPS,
  DOUBT_TO_STANDING_BPS,
  EXPOSED_FLOOR_BPS,
  LIFETIME_REASON_IDENTITY_VIABILITY_ACCELERATION,
  LIFETIME_REASON_IDENTITY_VIABILITY_SOCIAL_DEATH,
  SOCIAL_DEATH_LIFETIME_ACCELERATION_BPS,
  STRESSED_LIFETIME_ACCELERATION_CAP_BPS,
  STRESSED_THRESHOLD_BPS,
  VIABILITY_DEATH_THRESHOLD_BPS,
  VIABILITY_POLICY_VERSION,
  VIABILITY_WEIGHTS,
  WANTED_REGION_PENALTY_BPS,
  applyFactionDoubtPropagation,
  computeLifetimeAcceleration,
  computeViabilityScore,
  deriveIdentityExposed,
  deriveViabilityProjection,
  deriveViabilityTrigger,
  initialIdentityViability,
  projectIdentityViability,
  viabilityStatus,
  type FactionDoubtPropagationInput,
  type FactionStandingPropagationDelta,
  type IdentityViability,
  type IdentityViabilityProjection,
  type ProjectIdentityViabilityInput,
  type ViabilityStatus,
} from "../lib/epoch/journeyViabilityRules.ts";
import type { DoubtStrength, NpcDoubtEvent } from "../lib/epoch/journeyRoleplayRules.ts";

/**
 * PR1 + PR5a tests for journeyViabilityRules.ts.
 *
 * PR1 (locked):
 *  - Version + threshold constants are exported and pinned.
 *  - ViabilityStatus is exactly the three contract buckets (exhaustiveness).
 *  - IdentityViability / IdentityViabilityProjection are constructible with
 *    the contract field set.
 *  - Zero-bonus hard rule: neither Public type leaks strategy/affinity/fit
 *    fields (taskFamilyId, strategyAffinity, fitBps, expectedApproach).
 *
 * PR5a (this file extends):
 *  - Linear weighted score: every dimension contributes the contract-specified
 *    bps, weights sum to 1.0, output clamped to [0, 10_000].
 *  - Same-faction doubt propagation reduces faction standing; cross-faction
 *    propagation is gated by infoSharing (PR5a default "none" = no flow).
 *  - Faction standing reduction is GLOBAL across regions (one standing per
 *    faction, so fleeing a region cannot evade same-faction notoriety).
 *  - status bucket + social_death trigger fire exactly once on threshold
 *    crossing.
 *  - Lifetime acceleration: quadratic for stressed, fixed 10_000 for the
 *    single social-death flip, 0 for healthy.
 *  - Anti-loop: projectIdentityViability takes no current-round lifetime
 *    delta, so by construction the score cannot feed back into the round
 *    that produced it.
 */

const ALLOWED_STATUSES: readonly ViabilityStatus[] = [
  "healthy",
  "stressed",
  "social_death",
];

const BANNED_FIELDS = [
  "taskFamilyId",
  "strategyAffinity",
  "fitBps",
  "expectedApproach",
] as const;

const PROJECTED_AT = "2026-07-25T00:00:00.000Z";

function sampleIdentityViability(
  overrides: Partial<IdentityViability> = {},
): IdentityViability {
  return {
    identityId: "identity_1",
    factionStanding: { faction_traders: 12, faction_watch: -7 },
    flaggedWanted: new Set<string>(["region_border_wilds"]),
    identityExposed: false,
    doubtedBy: {},
    viabilityScoreBps: 7800,
    status: "healthy",
    policyVersion: VIABILITY_POLICY_VERSION,
    projectedAt: PROJECTED_AT,
    ...overrides,
  };
}

function sampleProjection(
  overrides: Partial<IdentityViabilityProjection> = {},
): IdentityViabilityProjection {
  const before = sampleIdentityViability({
    status: "healthy",
    viabilityScoreBps: 7800,
  });
  const after = sampleIdentityViability({
    status: "stressed",
    viabilityScoreBps: 3100,
    projectedAt: PROJECTED_AT,
  });
  return {
    identityId: "identity_1",
    before,
    after,
    deltaBps: after.viabilityScoreBps - before.viabilityScoreBps,
    lifetimeAccelerationBps: 500,
    socialDeathTriggered: false,
    sourceSettlementId: "settlement_1",
    policyVersion: VIABILITY_POLICY_VERSION,
    ...overrides,
  };
}

// Minimal NpcDoubtEvent factory for propagation tests. The full type lives in
// journeyRoleplayRules; we construct it directly so the test does not depend
// on a fixture builder.
function doubtEvent(overrides: Partial<NpcDoubtEvent> & { doubtEventId: string; npcId: string; doubtStrength: DoubtStrength }): NpcDoubtEvent {
  return {
    doubtEventId: overrides.doubtEventId,
    journeyId: overrides.journeyId ?? "journey_1",
    identityId: overrides.identityId ?? "identity_1",
    npcId: overrides.npcId,
    factionId: overrides.factionId,
    regionId: overrides.regionId ?? "region_border_wilds",
    doubtStrength: overrides.doubtStrength,
    sourceActionEventId: overrides.sourceActionEventId ?? "action_1",
    reason: overrides.reason ?? "rumour",
    mirrorLedgerEntryId: overrides.mirrorLedgerEntryId ?? "ledger_1",
    recordedAt: overrides.recordedAt ?? PROJECTED_AT,
  };
}

function baseProjectionInput(
  overrides: Partial<ProjectIdentityViabilityInput> = {},
): ProjectIdentityViabilityInput {
  return {
    identityId: "identity_1",
    factionStanding: {},
    flaggedWanted: new Set<string>(),
    identityExposed: false,
    doubtedBy: {},
    lifetime: { max: 1000, remaining: 1000 },
    projectedAt: PROJECTED_AT,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// PR1 — locked assertions (unchanged)
// ---------------------------------------------------------------------------

test("VIABILITY_POLICY_VERSION is exported and pinned at 1", () => {
  assert.equal(VIABILITY_POLICY_VERSION, 1);
  const _compileTimeLiteralCheck: 1 = VIABILITY_POLICY_VERSION;
  void _compileTimeLiteralCheck;
});

test("VIABILITY_DEATH_THRESHOLD_BPS is exported and matches the Step 16 placeholder", () => {
  assert.equal(VIABILITY_DEATH_THRESHOLD_BPS, 3000);
  assert.ok(
    VIABILITY_DEATH_THRESHOLD_BPS > 0 && VIABILITY_DEATH_THRESHOLD_BPS <= 10000,
    "threshold must be a valid bps value",
  );
});

test("ViabilityStatus is exactly the three contract buckets", () => {
  const healthy: ViabilityStatus = "healthy";
  const stressed: ViabilityStatus = "stressed";
  const dead: ViabilityStatus = "social_death";

  const actual = [healthy, stressed, dead].sort();
  const expected = ALLOWED_STATUSES.slice().sort();
  assert.deepEqual(actual, expected);

  const exhaustive: Record<ViabilityStatus, true> = {
    healthy: true,
    stressed: true,
    social_death: true,
  };
  for (const status of Object.keys(exhaustive) as ViabilityStatus[]) {
    assert.ok(
      ALLOWED_STATUSES.includes(status),
      `unexpected ViabilityStatus member: ${status}`,
    );
  }
});

test("IdentityViability is constructible with all contract fields", () => {
  const v = sampleIdentityViability();
  assert.equal(v.identityId, "identity_1");
  assert.equal(v.identityExposed, false);
  assert.equal(v.status, "healthy");
  assert.equal(v.policyVersion, VIABILITY_POLICY_VERSION);
  assert.equal(v.projectedAt, PROJECTED_AT);
  assert.deepEqual(Array.from(v.flaggedWanted.values()), ["region_border_wilds"]);
  assert.deepEqual(v.factionStanding, { faction_traders: 12, faction_watch: -7 });
  assert.deepEqual(v.doubtedBy, {});
  assert.equal(v.viabilityScoreBps, 7800);
});

test("IdentityViabilityProjection carries before/after, signed delta, and source id", () => {
  const p = sampleProjection();
  assert.equal(p.identityId, "identity_1");
  assert.equal(p.before.status, "healthy");
  assert.equal(p.after.status, "stressed");
  assert.equal(
    p.deltaBps,
    p.after.viabilityScoreBps - p.before.viabilityScoreBps,
    "deltaBps must equal after - before",
  );
  assert.equal(p.socialDeathTriggered, false);
  assert.equal(p.sourceSettlementId, "settlement_1");
  assert.equal(p.policyVersion, VIABILITY_POLICY_VERSION);
  assert.ok(p.lifetimeAccelerationBps >= 0, "acceleration is non-negative");
});

test("projection flags social death when after status crosses the threshold", () => {
  const p = sampleProjection({
    before: sampleIdentityViability({
      status: "stressed",
      viabilityScoreBps: 3100,
    }),
    after: sampleIdentityViability({
      status: "social_death",
      viabilityScoreBps: VIABILITY_DEATH_THRESHOLD_BPS,
    }),
    deltaBps: -100,
    lifetimeAccelerationBps: 2000,
    socialDeathTriggered: true,
    sourceSettlementId: "settlement_2",
  });
  assert.equal(p.after.status, "social_death");
  assert.equal(p.socialDeathTriggered, true);
  assert.ok(
    p.after.viabilityScoreBps <= VIABILITY_DEATH_THRESHOLD_BPS,
    "social_death status must coincide with score at/below threshold",
  );
});

test("zero-bonus: IdentityViability exposes no strategy/affinity/fit fields", () => {
  const v = sampleIdentityViability();
  for (const banned of BANNED_FIELDS) {
    assert.ok(
      !(banned in v),
      `IdentityViability must not expose "${banned}" (zero-bonus hard rule)`,
    );
  }
});

test("zero-bonus: IdentityViabilityProjection exposes no strategy/affinity/fit fields", () => {
  const p = sampleProjection();
  for (const banned of BANNED_FIELDS) {
    assert.ok(
      !(banned in p),
      `IdentityViabilityProjection must not expose "${banned}"`,
    );
    assert.ok(
      !(banned in p.before),
      `IdentityViability.before must not expose "${banned}"`,
    );
    assert.ok(
      !(banned in p.after),
      `IdentityViability.after must not expose "${banned}"`,
    );
  }
});

// ---------------------------------------------------------------------------
// PR5a — placeholder constants
// ---------------------------------------------------------------------------

test("PR5a exports the linear-weight placeholder constants pinned at the spec values", () => {
  assert.equal(STRESSED_THRESHOLD_BPS, 6_000);
  assert.equal(WANTED_REGION_PENALTY_BPS, 3_000);
  assert.equal(EXPOSED_FLOOR_BPS, 2_000);
  assert.equal(SOCIAL_DEATH_LIFETIME_ACCELERATION_BPS, 10_000);
  assert.equal(STRESSED_LIFETIME_ACCELERATION_CAP_BPS, 5_000);
  assert.equal(CROSS_FACTION_DOUBT_MULTIPLIER, 0.5);
  assert.equal(DEFAULT_FACTION_INFO_SHARING, "none");
  assert.equal(
    LIFETIME_REASON_IDENTITY_VIABILITY_ACCELERATION,
    "identity_viability_acceleration",
  );
  assert.equal(
    LIFETIME_REASON_IDENTITY_VIABILITY_SOCIAL_DEATH,
    "identity_viability_social_death",
  );

  // Weights sum to exactly 1.0 so a perfectly-healthy identity projects 10_000.
  const sum =
    VIABILITY_WEIGHTS.W_FACTION +
    VIABILITY_WEIGHTS.W_DOUBT +
    VIABILITY_WEIGHTS.W_WANTED +
    VIABILITY_WEIGHTS.W_EXPOSED +
    VIABILITY_WEIGHTS.W_BASE;
  assert.equal(Number(sum.toFixed(10)), 1.0);

  assert.deepEqual(DOUBT_PENALTY_BPS, {
    low: 250,
    moderate: 750,
    high: 2_000,
    severe: 4_000,
  });
  assert.deepEqual(DOUBT_TO_STANDING_BPS, {
    low: 25,
    moderate: 75,
    high: 200,
    severe: 400,
  });
});

// ---------------------------------------------------------------------------
// PR5a — viabilityStatus
// ---------------------------------------------------------------------------

test("viabilityStatus: score > STRESSED_THRESHOLD_BPS → healthy", () => {
  assert.equal(viabilityStatus(10_000), "healthy");
  assert.equal(viabilityStatus(STRESSED_THRESHOLD_BPS + 1), "healthy");
});

test("viabilityStatus: threshold < score ≤ STRESSED → stressed", () => {
  assert.equal(viabilityStatus(STRESSED_THRESHOLD_BPS), "stressed");
  assert.equal(viabilityStatus(VIABILITY_DEATH_THRESHOLD_BPS + 1), "stressed");
});

test("viabilityStatus: score ≤ VIABILITY_DEATH_THRESHOLD_BPS → social_death", () => {
  assert.equal(viabilityStatus(VIABILITY_DEATH_THRESHOLD_BPS), "social_death");
  assert.equal(viabilityStatus(0), "social_death");
});

test("viabilityStatus: clamps out-of-range scores into [0, 10_000]", () => {
  assert.equal(viabilityStatus(-5_000), "social_death");
  assert.equal(viabilityStatus(99_999), "healthy");
  assert.ok(Number.isNaN(Number.NaN) === true);
  assert.equal(viabilityStatus(Number.NaN), "social_death");
});

// ---------------------------------------------------------------------------
// PR5a — computeViabilityScore / projectIdentityViability
// ---------------------------------------------------------------------------

test("computeViabilityScore: perfectly-healthy identity projects 10_000 bps", () => {
  const { scoreBps, breakdown } = computeViabilityScore({
    factionStanding: { faction_a: 10_000 },
    flaggedWanted: new Set<string>(),
    doubtedBy: {},
    lifetime: { max: 1_000, remaining: 1_000 },
    identityExposed: false,
  });
  assert.equal(scoreBps, 10_000);
  assert.equal(breakdown.factionComponentBps, 10_000);
  assert.equal(breakdown.doubtComponentBps, 10_000);
  assert.equal(breakdown.wantedComponentBps, 10_000);
  assert.equal(breakdown.exposedComponentBps, 10_000);
  assert.equal(breakdown.baseComponentBps, 10_000);
});

test("computeViabilityScore: zero factions → factionComponentBps=10_000 (neutral healthy)", () => {
  const { breakdown } = computeViabilityScore({
    factionStanding: {},
    flaggedWanted: new Set<string>(),
    doubtedBy: {},
    lifetime: { max: 1_000, remaining: 1_000 },
  });
  assert.equal(breakdown.factionComponentBps, 10_000);
});

test("computeViabilityScore: factionComponentBps maps signed scores to [0, 10_000] linearly", () => {
  // score=0 (neutral) → 5_000; score=10_000 (exalted) → 10_000; score=-10_000 (hostile) → 0.
  const neutral = computeViabilityScore({
    factionStanding: { f: 0 },
    flaggedWanted: new Set<string>(),
    doubtedBy: {},
    lifetime: { max: 1_000, remaining: 1_000 },
  });
  assert.equal(neutral.breakdown.factionComponentBps, 5_000);

  const hostile = computeViabilityScore({
    factionStanding: { f: -10_000 },
    flaggedWanted: new Set<string>(),
    doubtedBy: {},
    lifetime: { max: 1_000, remaining: 1_000 },
  });
  assert.equal(hostile.breakdown.factionComponentBps, 0);

  const exalted = computeViabilityScore({
    factionStanding: { f: 10_000 },
    flaggedWanted: new Set<string>(),
    doubtedBy: {},
    lifetime: { max: 1_000, remaining: 1_000 },
  });
  assert.equal(exalted.breakdown.factionComponentBps, 10_000);
});

test("computeViabilityScore: faction scores outside [-10_000, 10_000] are clamped", () => {
  const huge = computeViabilityScore({
    factionStanding: { f: 50_000 },
    flaggedWanted: new Set<string>(),
    doubtedBy: {},
    lifetime: { max: 1_000, remaining: 1_000 },
  });
  assert.equal(huge.breakdown.factionComponentBps, 10_000);

  const deep = computeViabilityScore({
    factionStanding: { f: -50_000 },
    flaggedWanted: new Set<string>(),
    doubtedBy: {},
    lifetime: { max: 1_000, remaining: 1_000 },
  });
  assert.equal(deep.breakdown.factionComponentBps, 0);
});

test("computeViabilityScore: doubtComponentBps = 10_000 - min(10_000, Σ DOUBT_PENALTY_BPS[strength])", () => {
  const oneSevere = computeViabilityScore({
    factionStanding: {},
    flaggedWanted: new Set<string>(),
    doubtedBy: { npc_a: "severe" },
    lifetime: { max: 1_000, remaining: 1_000 },
  });
  assert.equal(
    oneSevere.breakdown.doubtComponentBps,
    10_000 - DOUBT_PENALTY_BPS.severe,
  );

  // Multiple doubts accumulate but cannot push the penalty past 10_000.
  const many = computeViabilityScore({
    factionStanding: {},
    flaggedWanted: new Set<string>(),
    doubtedBy: {
      a: "severe",
      b: "high",
      c: "moderate",
      d: "low",
      e: "severe",
    },
    lifetime: { max: 1_000, remaining: 1_000 },
  });
  const expectedPenalty = Math.min(
    10_000,
    DOUBT_PENALTY_BPS.severe * 2 +
      DOUBT_PENALTY_BPS.high +
      DOUBT_PENALTY_BPS.moderate +
      DOUBT_PENALTY_BPS.low,
  );
  assert.equal(many.breakdown.doubtComponentBps, 10_000 - expectedPenalty);
  assert.ok(many.breakdown.doubtComponentBps >= 0);
});

test("computeViabilityScore: wantedComponentBps = 10_000 - min(10_000, |flaggedWanted| * WANTED_REGION_PENALTY_BPS)", () => {
  const two = computeViabilityScore({
    factionStanding: {},
    flaggedWanted: new Set<string>(["r1", "r2"]),
    doubtedBy: {},
    lifetime: { max: 1_000, remaining: 1_000 },
  });
  assert.equal(
    two.breakdown.wantedComponentBps,
    10_000 - 2 * WANTED_REGION_PENALTY_BPS,
  );

  // Cap at 10_000 penalty: an identity flagged in 10 regions still shows 0,
  // never negative.
  const many = computeViabilityScore({
    factionStanding: {},
    flaggedWanted: new Set<string>(["r1", "r2", "r3", "r4"]),
    doubtedBy: {},
    lifetime: { max: 1_000, remaining: 1_000 },
  });
  assert.equal(many.breakdown.wantedComponentBps, 0);
});

test("computeViabilityScore: exposed identity floors exposedComponentBps at EXPOSED_FLOOR_BPS", () => {
  const hidden = computeViabilityScore({
    factionStanding: {},
    flaggedWanted: new Set<string>(),
    doubtedBy: {},
    lifetime: { max: 1_000, remaining: 1_000 },
    identityExposed: false,
  });
  assert.equal(hidden.breakdown.exposedComponentBps, 10_000);

  const exposed = computeViabilityScore({
    factionStanding: {},
    flaggedWanted: new Set<string>(),
    doubtedBy: {},
    lifetime: { max: 1_000, remaining: 1_000 },
    identityExposed: true,
  });
  assert.equal(exposed.breakdown.exposedComponentBps, EXPOSED_FLOOR_BPS);
});

test("computeViabilityScore: baseComponentBps = 10_000 * clamp(remaining/max, 0, 1)", () => {
  const full = computeViabilityScore({
    factionStanding: {},
    flaggedWanted: new Set<string>(),
    doubtedBy: {},
    lifetime: { max: 1_000, remaining: 1_000 },
  });
  assert.equal(full.breakdown.baseComponentBps, 10_000);

  const half = computeViabilityScore({
    factionStanding: {},
    flaggedWanted: new Set<string>(),
    doubtedBy: {},
    lifetime: { max: 1_000, remaining: 500 },
  });
  assert.equal(half.breakdown.baseComponentBps, 5_000);

  const zero = computeViabilityScore({
    factionStanding: {},
    flaggedWanted: new Set<string>(),
    doubtedBy: {},
    lifetime: { max: 1_000, remaining: 0 },
  });
  assert.equal(zero.breakdown.baseComponentBps, 0);
});

test("computeViabilityScore: zero-lifetime identity cannot carry a perfect score even when other components are clean", () => {
  const { scoreBps, breakdown } = computeViabilityScore({
    factionStanding: { f: 10_000 },
    flaggedWanted: new Set<string>(),
    doubtedBy: {},
    lifetime: { max: 1_000, remaining: 0 },
  });
  assert.equal(breakdown.baseComponentBps, 0);
  // W_BASE * 0 eats 500 bps off the perfect score.
  assert.equal(scoreBps, 10_000 - VIABILITY_WEIGHTS.W_BASE * 10_000);
});

test("computeViabilityScore: zero-max lifetime degrades baseComponentBps to 0 (no NaN)", () => {
  const { breakdown } = computeViabilityScore({
    factionStanding: {},
    flaggedWanted: new Set<string>(),
    doubtedBy: {},
    lifetime: { max: 0, remaining: 0 },
  });
  assert.equal(breakdown.baseComponentBps, 0);
  assert.ok(Number.isFinite(breakdown.baseComponentBps));
});

test("computeViabilityScore: weighted sum produces clamped composite", () => {
  // Hostile faction, severe doubt, two regions wanted, exposed, half lifetime.
  const { scoreBps } = computeViabilityScore({
    factionStanding: { f: -10_000 },
    flaggedWanted: new Set<string>(["r1", "r2"]),
    doubtedBy: { npc_a: "severe" },
    lifetime: { max: 1_000, remaining: 500 },
    identityExposed: true,
  });
  const expected =
    VIABILITY_WEIGHTS.W_FACTION * 0 +
    VIABILITY_WEIGHTS.W_DOUBT * (10_000 - DOUBT_PENALTY_BPS.severe) +
    VIABILITY_WEIGHTS.W_WANTED * (10_000 - 2 * WANTED_REGION_PENALTY_BPS) +
    VIABILITY_WEIGHTS.W_EXPOSED * EXPOSED_FLOOR_BPS +
    VIABILITY_WEIGHTS.W_BASE * 5_000;
  assert.equal(scoreBps, Math.max(0, Math.min(10_000, Math.round(expected))));
});

test("deriveIdentityExposed: only severe doubt exposes the identity (until PR7)", () => {
  assert.equal(deriveIdentityExposed({}), false);
  assert.equal(deriveIdentityExposed({ a: "low" }), false);
  assert.equal(deriveIdentityExposed({ a: "moderate", b: "high" }), false);
  assert.equal(deriveIdentityExposed({ a: "severe" }), true);
  assert.equal(
    deriveIdentityExposed({ a: "low", b: "severe", c: "high" }),
    true,
  );
});

test("projectIdentityViability: derives identityExposed from doubtedBy when caller omits it", () => {
  // Caller passes identityExposed=false but doubtedBy has a severe entry.
  // projectIdentityViability composes identityExposed = callerValue || derived.
  const { viability, breakdown } = projectIdentityViability(
    baseProjectionInput({
      doubtedBy: { npc_a: "severe" },
      identityExposed: false,
    }),
  );
  assert.equal(viability.identityExposed, true);
  // The breakdown reflects the derived exposure: component floored at EXPOSED_FLOOR_BPS.
  assert.equal(breakdown.exposedComponentBps, EXPOSED_FLOOR_BPS);
});

test("projectIdentityViability: returns breakdown + viability with policyVersion and projectedAt", () => {
  const { viability, breakdown } = projectIdentityViability(
    baseProjectionInput({
      factionStanding: { f: 0 },
      doubtedBy: { npc_a: "low" },
      lifetime: { max: 1_000, remaining: 800 },
    }),
  );
  assert.equal(viability.policyVersion, VIABILITY_POLICY_VERSION);
  assert.equal(viability.projectedAt, PROJECTED_AT);
  assert.equal(viability.identityId, "identity_1");
  assert.equal(breakdown.factionComponentBps, 5_000);
  assert.equal(
    breakdown.doubtComponentBps,
    10_000 - DOUBT_PENALTY_BPS.low,
  );
  assert.equal(viability.status, viabilityStatus(viability.viabilityScoreBps));
});

test("projectIdentityViability: pure — same input always yields same output", () => {
  const input = baseProjectionInput({
    factionStanding: { f: -3_000 },
    flaggedWanted: new Set<string>(["r1"]),
    doubtedBy: { a: "moderate" },
    lifetime: { max: 2_000, remaining: 1_500 },
  });
  const a = projectIdentityViability(input);
  const b = projectIdentityViability(input);
  assert.deepEqual(a, b);
});

test("initialIdentityViability: fresh identity is perfectly healthy with empty maps", () => {
  const v = initialIdentityViability("identity_new", PROJECTED_AT);
  assert.equal(v.identityId, "identity_new");
  assert.equal(v.viabilityScoreBps, 10_000);
  assert.equal(v.status, "healthy");
  assert.equal(v.identityExposed, false);
  assert.equal(v.policyVersion, VIABILITY_POLICY_VERSION);
  assert.equal(v.projectedAt, PROJECTED_AT);
  assert.deepEqual(v.factionStanding, {});
  assert.deepEqual(v.doubtedBy, {});
  assert.equal(v.flaggedWanted.size, 0);
});

// ---------------------------------------------------------------------------
// PR5a — applyFactionDoubtPropagation
// ---------------------------------------------------------------------------

function propagationInput(
  overrides: Partial<FactionDoubtPropagationInput> = {},
): FactionDoubtPropagationInput {
  return {
    identityId: "identity_1",
    journeyId: "journey_1",
    doubtEvents: [],
    factionStanding: {},
    doubtedBy: {},
    ...overrides,
  };
}

test("applyFactionDoubtPropagation: each doubt reduces same-faction standing by DOUBT_TO_STANDING_BPS[strength]", () => {
  const baseDoubtedBy = { npc_a: "moderate" as DoubtStrength, npc_b: "severe" as DoubtStrength };
  const input: FactionDoubtPropagationInput = propagationInput({
    doubtEvents: [
      doubtEvent({
        doubtEventId: "d1",
        npcId: "npc_a",
        factionId: "faction_traders",
        doubtStrength: "moderate",
      }),
      doubtEvent({
        doubtEventId: "d2",
        npcId: "npc_b",
        factionId: "faction_traders",
        doubtStrength: "severe",
      }),
    ],
    factionStanding: { faction_traders: 100 },
    doubtedBy: baseDoubtedBy,
  });
  const result = applyFactionDoubtPropagation(input);
  assert.equal(
    result.factionStanding.faction_traders,
    100 - DOUBT_TO_STANDING_BPS.moderate - DOUBT_TO_STANDING_BPS.severe,
  );
  // doubtedBy is returned by reference, unchanged — propagation does not
  // touch the doubt map, only the standing map.
  assert.equal(result.doubtedBy, baseDoubtedBy);
  assert.equal(result.standingDeltas.length, 2);
  const sameFactionDeltas = result.standingDeltas.filter((d) => !d.crossFaction);
  assert.equal(sameFactionDeltas.length, 2);
  assert.equal(sameFactionDeltas[0].factionId, "faction_traders");
  assert.equal(sameFactionDeltas[0].standingDelta, -DOUBT_TO_STANDING_BPS.moderate);
  assert.equal(sameFactionDeltas[1].standingDelta, -DOUBT_TO_STANDING_BPS.severe);
});

test("applyFactionDoubtPropagation: multiple doubts in the same journey accumulate on the same faction", () => {
  const result = applyFactionDoubtPropagation(propagationInput({
    doubtEvents: [
      doubtEvent({
        doubtEventId: "d1",
        npcId: "n1",
        factionId: "f",
        doubtStrength: "low",
      }),
      doubtEvent({
        doubtEventId: "d2",
        npcId: "n2",
        factionId: "f",
        doubtStrength: "low",
      }),
      doubtEvent({
        doubtEventId: "d3",
        npcId: "n3",
        factionId: "f",
        doubtStrength: "low",
      }),
    ],
    factionStanding: { f: 1_000 },
  }));
  assert.equal(
    result.factionStanding.f,
    1_000 - 3 * DOUBT_TO_STANDING_BPS.low,
  );
  assert.equal(result.standingDeltas.length, 3);
});

test("applyFactionDoubtPropagation: standing reduction is global across regions (no region key)", () => {
  // Two doubt events for the same faction in DIFFERENT regions both hit the
  // single faction_traders standing entry. factionStanding is keyed by
  // factionId only, so fleeing a region cannot evade same-faction notoriety.
  const result = applyFactionDoubtPropagation(propagationInput({
    doubtEvents: [
      doubtEvent({
        doubtEventId: "d1",
        npcId: "n1",
        factionId: "faction_traders",
        regionId: "region_north",
        doubtStrength: "high",
      }),
      doubtEvent({
        doubtEventId: "d2",
        npcId: "n2",
        factionId: "faction_traders",
        regionId: "region_south",
        doubtStrength: "high",
      }),
    ],
    factionStanding: { faction_traders: 500 },
  }));
  assert.equal(
    result.factionStanding.faction_traders,
    500 - 2 * DOUBT_TO_STANDING_BPS.high,
  );
  // Confirm the dedupeKey carries the factionId, NOT the regionId — so the
  // canonical event is keyed globally per faction.
  for (const delta of result.standingDeltas) {
    assert.ok(
      delta.dedupeKey.includes(":faction_traders:"),
      `dedupeKey must key on factionId: ${delta.dedupeKey}`,
    );
    assert.ok(
      !delta.dedupeKey.includes("region_"),
      `dedupeKey must NOT key on regionId: ${delta.dedupeKey}`,
    );
  }
});

test("applyFactionDoubtPropagation: PR5a default — cross-faction propagation NEVER fires", () => {
  // Even with a severe doubt and a "bloc" peer configured, PR5a routes every
  // cross-faction pair as "none" because the default is "none" and the
  // caller here does not opt any faction into "bloc".
  const result = applyFactionDoubtPropagation(propagationInput({
    doubtEvents: [
      doubtEvent({
        doubtEventId: "d1",
        npcId: "n1",
        factionId: "faction_a",
        doubtStrength: "severe",
      }),
    ],
    factionStanding: { faction_a: 100, faction_b: 100 },
    factionBlocs: { faction_a: ["faction_b"] },
    // factionInfoSharing omitted → both default to "none".
  }));
  assert.equal(result.factionStanding.faction_a, 100 - DOUBT_TO_STANDING_BPS.severe);
  assert.equal(result.factionStanding.faction_b, 100);
  assert.equal(result.standingDeltas.length, 1);
  assert.equal(result.standingDeltas[0].crossFaction, false);
});

test("applyFactionDoubtPropagation: cross-faction fires only when BOTH sides are 'bloc' peers and the doubt is severe/high", () => {
  const result = applyFactionDoubtPropagation(propagationInput({
    doubtEvents: [
      doubtEvent({
        doubtEventId: "d1",
        npcId: "n1",
        factionId: "faction_a",
        doubtStrength: "severe",
      }),
      doubtEvent({
        doubtEventId: "d2",
        npcId: "n2",
        factionId: "faction_a",
        doubtStrength: "moderate", // excluded from cross-faction
      }),
    ],
    factionStanding: { faction_a: 1_000, faction_b: 1_000 },
    factionInfoSharing: { faction_a: "bloc", faction_b: "bloc" },
    factionBlocs: { faction_a: ["faction_b"] },
  }));
  // Severe doubt → in-faction hit on a PLUS cross-faction hit on b.
  // Moderate doubt → in-faction hit on a only.
  const expectedA =
    1_000 -
    DOUBT_TO_STANDING_BPS.severe -
    DOUBT_TO_STANDING_BPS.moderate;
  const expectedB =
    1_000 -
    Math.round(DOUBT_TO_STANDING_BPS.severe * CROSS_FACTION_DOUBT_MULTIPLIER);
  assert.equal(result.factionStanding.faction_a, expectedA);
  assert.equal(result.factionStanding.faction_b, expectedB);

  const cross = result.standingDeltas.filter((d) => d.crossFaction);
  assert.equal(cross.length, 1);
  assert.equal(cross[0].factionId, "faction_b");
  assert.equal(cross[0].sourceFactionId, "faction_a");
});

test("applyFactionDoubtPropagation: a bloc-side faction at 'none' blocks the cross-faction hit", () => {
  // Originator is 'bloc', but the peer is at the default 'none'. No cross.
  const result = applyFactionDoubtPropagation(propagationInput({
    doubtEvents: [
      doubtEvent({
        doubtEventId: "d1",
        npcId: "n1",
        factionId: "faction_a",
        doubtStrength: "severe",
      }),
    ],
    factionStanding: { faction_a: 1_000, faction_b: 1_000 },
    factionInfoSharing: { faction_a: "bloc" }, // faction_b defaults to "none"
    factionBlocs: { faction_a: ["faction_b"] },
  }));
  assert.equal(result.factionStanding.faction_b, 1_000);
  assert.equal(result.standingDeltas.filter((d) => d.crossFaction).length, 0);
});

test("applyFactionDoubtPropagation: doubt events without a factionId do not propagate", () => {
  const result = applyFactionDoubtPropagation(propagationInput({
    doubtEvents: [
      doubtEvent({
        doubtEventId: "d1",
        npcId: "n1",
        factionId: undefined,
        doubtStrength: "severe",
      }),
    ],
    factionStanding: {},
  }));
  assert.equal(result.standingDeltas.length, 0);
  assert.deepEqual(result.factionStanding, {});
});

test("applyFactionDoubtPropagation: doubtedBy is returned unchanged", () => {
  const doubtedBy = { npc_a: "severe" as DoubtStrength };
  const result = applyFactionDoubtPropagation(propagationInput({
    doubtEvents: [
      doubtEvent({
        doubtEventId: "d1",
        npcId: "npc_a",
        factionId: "f",
        doubtStrength: "severe",
      }),
    ],
    factionStanding: { f: 0 },
    doubtedBy,
  }));
  assert.equal(result.doubtedBy, doubtedBy);
});

test("applyFactionDoubtPropagation: dedupeKey is per journey/identity/faction/doubtEvent", () => {
  const result = applyFactionDoubtPropagation(propagationInput({
    journeyId: "journey_42",
    identityId: "identity_7",
    doubtEvents: [
      doubtEvent({
        doubtEventId: "doubt_99",
        npcId: "n1",
        factionId: "faction_x",
        doubtStrength: "high",
      }),
    ],
    factionStanding: { faction_x: 0 },
  }));
  assert.equal(
    result.standingDeltas[0].dedupeKey,
    "journey_42:identity_7:faction_x:doubt_99",
  );
});

// ---------------------------------------------------------------------------
// PR5a — computeLifetimeAcceleration
// ---------------------------------------------------------------------------

test("computeLifetimeAcceleration: healthy → 0", () => {
  assert.equal(
    computeLifetimeAcceleration({
      status: "healthy",
      viabilityScoreBps: 10_000,
      socialDeathTriggered: false,
    }),
    0,
  );
  assert.equal(
    computeLifetimeAcceleration({
      status: "healthy",
      viabilityScoreBps: STRESSED_THRESHOLD_BPS + 1,
      socialDeathTriggered: false,
    }),
    0,
  );
});

test("computeLifetimeAcceleration: single social_death flip → 10_000", () => {
  assert.equal(
    computeLifetimeAcceleration({
      status: "social_death",
      viabilityScoreBps: VIABILITY_DEATH_THRESHOLD_BPS,
      socialDeathTriggered: true,
    }),
    SOCIAL_DEATH_LIFETIME_ACCELERATION_BPS,
  );
});

test("computeLifetimeAcceleration: stressed → quadratic curve capped at STRESSED_LIFETIME_ACCELERATION_CAP_BPS", () => {
  // Just below STRESSED: minimal acceleration.
  const mild = computeLifetimeAcceleration({
    status: "stressed",
    viabilityScoreBps: STRESSED_THRESHOLD_BPS - 1,
    socialDeathTriggered: false,
  });
  assert.equal(mild, Math.round(1 ** 2 / 10_000)); // 0 (rounds to 0)

  // Mid-stress: noticeable but bounded.
  const mid = computeLifetimeAcceleration({
    status: "stressed",
    viabilityScoreBps: 4_000,
    socialDeathTriggered: false,
  });
  const midDeficit = STRESSED_THRESHOLD_BPS - 4_000; // 2_000
  assert.equal(mid, Math.min(STRESSED_LIFETIME_ACCELERATION_CAP_BPS, Math.round((midDeficit * midDeficit) / 10_000)));

  // Near social_death (deficit near STRESSED): the cap kicks in.
  const near = computeLifetimeAcceleration({
    status: "stressed",
    viabilityScoreBps: VIABILITY_DEATH_THRESHOLD_BPS + 1,
    socialDeathTriggered: false,
  });
  assert.ok(near <= STRESSED_LIFETIME_ACCELERATION_CAP_BPS);
  assert.ok(near >= 0);
});

test("computeLifetimeAcceleration: quadratic is monotonically worse as score drops, capped at STRESSED_LIFETIME_ACCELERATION_CAP_BPS", () => {
  // For a valid "stressed" score, deficit = STRESSED_THRESHOLD_BPS - score is
  // in (0, STRESSED_THRESHOLD_BPS - VIABILITY_DEATH_THRESHOLD_BPS]. The
  // quadratic (deficit^2)/10_000 is monotonic in the deficit, so dropping the
  // score strictly increases acceleration until the cap clamps it.
  const highScore = computeLifetimeAcceleration({
    status: "stressed",
    viabilityScoreBps: STRESSED_THRESHOLD_BPS - 10,
    socialDeathTriggered: false,
  });
  const lowScore = computeLifetimeAcceleration({
    status: "stressed",
    viabilityScoreBps: VIABILITY_DEATH_THRESHOLD_BPS + 1,
    socialDeathTriggered: false,
  });
  assert.ok(lowScore > highScore, "lower score → larger acceleration");
  assert.ok(
    lowScore <= STRESSED_LIFETIME_ACCELERATION_CAP_BPS,
    "acceleration never exceeds the cap",
  );

  // Even for an out-of-range input (status="stressed" with score far below
  // the death threshold), the cap still holds — it is a defensive bound.
  const extreme = computeLifetimeAcceleration({
    status: "stressed",
    viabilityScoreBps: -50_000,
    socialDeathTriggered: false,
  });
  assert.ok(extreme <= STRESSED_LIFETIME_ACCELERATION_CAP_BPS);
});

test("computeLifetimeAcceleration: socialDeathTriggered takes precedence over status=='stressed'", () => {
  // Edge case: status="stressed" but socialDeathTriggered=true (shouldn't happen
  // in practice, but the rule must be unambiguous). The single social-death
  // flip wins.
  assert.equal(
    computeLifetimeAcceleration({
      status: "stressed",
      viabilityScoreBps: 4_000,
      socialDeathTriggered: true,
    }),
    SOCIAL_DEATH_LIFETIME_ACCELERATION_BPS,
  );
});

// ---------------------------------------------------------------------------
// PR5a — deriveViabilityProjection (composes before/after + acceleration)
// ---------------------------------------------------------------------------

test("deriveViabilityProjection: socialDeathTriggered fires exactly once on the threshold crossing", () => {
  const before = sampleIdentityViability({
    status: "stressed",
    viabilityScoreBps: 3_200,
  });
  const after = sampleIdentityViability({
    status: "social_death",
    viabilityScoreBps: VIABILITY_DEATH_THRESHOLD_BPS,
  });
  const projection = deriveViabilityProjection(
    "identity_1",
    before,
    after,
    "settlement_1",
  );
  assert.equal(projection.socialDeathTriggered, true);
  assert.equal(
    projection.lifetimeAccelerationBps,
    SOCIAL_DEATH_LIFETIME_ACCELERATION_BPS,
  );
  assert.equal(projection.deltaBps, after.viabilityScoreBps - before.viabilityScoreBps);
  assert.equal(projection.sourceSettlementId, "settlement_1");
});

test("deriveViabilityProjection: already-social-death before → no second trigger", () => {
  const before = sampleIdentityViability({
    status: "social_death",
    viabilityScoreBps: 1_000,
  });
  const after = sampleIdentityViability({
    status: "social_death",
    viabilityScoreBps: 0,
  });
  const projection = deriveViabilityProjection(
    "identity_1",
    before,
    after,
    "settlement_2",
  );
  // Threshold was already crossed in a prior projection; this projection does
  // NOT re-fire the side-effect.
  assert.equal(projection.socialDeathTriggered, false);
  assert.equal(projection.lifetimeAccelerationBps, 0);
});

test("deriveViabilityProjection: healthy → stressed emits non-zero acceleration", () => {
  const before = sampleIdentityViability({
    status: "healthy",
    viabilityScoreBps: 7_000,
  });
  const after = sampleIdentityViability({
    status: "stressed",
    viabilityScoreBps: 4_000,
  });
  const projection = deriveViabilityProjection(
    "identity_1",
    before,
    after,
    "settlement_3",
  );
  assert.equal(projection.socialDeathTriggered, false);
  const deficit = STRESSED_THRESHOLD_BPS - 4_000;
  assert.equal(
    projection.lifetimeAccelerationBps,
    Math.min(STRESSED_LIFETIME_ACCELERATION_CAP_BPS, Math.round((deficit * deficit) / 10_000)),
  );
});

test("deriveViabilityProjection: healthy → healthy emits no acceleration", () => {
  const before = sampleIdentityViability({
    status: "healthy",
    viabilityScoreBps: 9_000,
  });
  const after = sampleIdentityViability({
    status: "healthy",
    viabilityScoreBps: 8_000,
  });
  const projection = deriveViabilityProjection(
    "identity_1",
    before,
    after,
    "settlement_4",
  );
  assert.equal(projection.socialDeathTriggered, false);
  assert.equal(projection.lifetimeAccelerationBps, 0);
});

// ---------------------------------------------------------------------------
// PR5a — anti-loop invariant (structural)
// ---------------------------------------------------------------------------

test("anti-loop: projectIdentityViability takes no current-round lifetime delta parameter", () => {
  // The structural anti-loop rule (spec §6.8) is that the score cannot see
  // the lifetime delta it just authored. We assert it by REFLECTION: the
  // ProjectIdentityViabilityInput shape must NOT carry any field whose name
  // suggests current-round feedback.
  const bannedInputFields = [
    "currentRoundLifetimeDelta",
    "settlementContext",
    "consequenceScore",
    "lifetimeDelta",
    "sourceSettlementId",
  ];
  const sample = baseProjectionInput();
  for (const banned of bannedInputFields) {
    assert.ok(
      !(banned in sample),
      `ProjectIdentityViabilityInput must not accept "${banned}" (anti-loop)`,
    );
  }
});

test("anti-loop: computeLifetimeAcceleration output never re-enters the score (composition check)", () => {
  // Demonstrate the anti-loop end-to-end:
  //   1. project before-snapshot → score_before
  //   2. project after-snapshot (independent of any acceleration) → score_after
  //   3. acceleration is derived from after.status/score only
  //   4. re-running step (2) with the acceleration value plumbed back as a
  //      "current delta" MUST be impossible because the projector's signature
  //      has no such parameter.
  const beforeInput = baseProjectionInput({
    factionStanding: { f: -8_000 },
    doubtedBy: { npc_a: "severe" },
    lifetime: { max: 1_000, remaining: 1_000 },
  });
  const afterInput = baseProjectionInput({
    factionStanding: { f: -8_000 },
    doubtedBy: { npc_a: "severe", npc_b: "severe" },
    lifetime: { max: 1_000, remaining: 1_000 },
  });
  const before = projectIdentityViability(beforeInput).viability;
  const after = projectIdentityViability(afterInput).viability;
  const projection = deriveViabilityProjection(
    "identity_1",
    before,
    after,
    "settlement_anti_loop",
  );

  // Re-project the after-snapshot WITHOUT feeding the acceleration back in.
  // (We cannot even pass it in — there is no parameter for it.)
  const afterReprojected = projectIdentityViability(afterInput).viability;
  assert.deepEqual(afterReprojected, after);
  // The acceleration is a one-way output: it lives on the projection only.
  assert.ok(projection.lifetimeAccelerationBps >= 0);
  assert.ok(
    !("lifetimeAccelerationBps" in afterReprojected),
    "acceleration must NOT be attached to the IdentityViability snapshot",
  );
});

test("anti-loop: propagation result has no SettlementContext reference (cross-journey effect only)", () => {
  // The canonical standing deltas emitted by applyFactionDoubtPropagation
  // appear in the NEXT journey's ctx, never the current one. Assert the
  // returned shape does not carry any settlement/score reference.
  const result = applyFactionDoubtPropagation(propagationInput({
    doubtEvents: [
      doubtEvent({
        doubtEventId: "d1",
        npcId: "n1",
        factionId: "f",
        doubtStrength: "high",
      }),
    ],
    factionStanding: { f: 0 },
  }));
  const bannedResultFields = [
    "settlementContext",
    "consequenceScoreBps",
    "sourceSettlementId",
    "currentRoundDeltaBps",
  ];
  for (const banned of bannedResultFields) {
    assert.ok(
      !(banned in result),
      `FactionDoubtPropagationResult must not expose "${banned}" (anti-loop)`,
    );
  }
  for (const delta of result.standingDeltas as readonly FactionStandingPropagationDelta[]) {
    assert.ok(
      !("consequenceScoreBps" in delta),
      "standing delta must not carry a ConsequenceScore reference",
    );
  }
});

// ---------------------------------------------------------------------------
// PR5a — placeholder nature (no .js / no explicit any)
// ---------------------------------------------------------------------------

test("PR5a shapes carry no explicit any (structural check via assignable types)", () => {
  // Compile-time check; the test file uses `type` imports exclusively. The
  // fact that this file type-checks under strict + noImplicitAny is the
  // assertion. We add a runtime smoke check that the exports are functions.
  assert.equal(typeof projectIdentityViability, "function");
  assert.equal(typeof computeViabilityScore, "function");
  assert.equal(typeof viabilityStatus, "function");
  assert.equal(typeof applyFactionDoubtPropagation, "function");
  assert.equal(typeof computeLifetimeAcceleration, "function");
  assert.equal(typeof deriveViabilityProjection, "function");
  assert.equal(typeof deriveIdentityExposed, "function");
  assert.equal(typeof initialIdentityViability, "function");
  assert.equal(typeof deriveViabilityTrigger, "function");
});

// ---------------------------------------------------------------------------
// PR5a — deriveViabilityTrigger
//
// Covers the lifetimeTriggerRules in the spec:
//  - social_death flip → drain remaining lifetime to 0 with the social-death
//    reason and the server-attested ref carrying socialDeathTriggered=true.
//  - stressed (NOT first-flip into social_death) → negative delta with the
//    acceleration reason; minimum magnitude of 1 when accel > 0.
//  - healthy → null (no viability-driven adjustment this settlement).
//  - the returned viabilityTriggerRef is anchored at the projection's
//    sourceSettlementId so the apply path can defensively verify it.
// ---------------------------------------------------------------------------

function buildProjection(overrides: Partial<IdentityViabilityProjection>): IdentityViabilityProjection {
  const before: IdentityViability = initialIdentityViability("identity_a", "2026-07-07T00:00:00.000Z");
  const after: IdentityViability = initialIdentityViability("identity_a", "2026-07-07T01:00:00.000Z");
  return {
    identityId: "identity_a",
    before,
    after,
    deltaBps: after.viabilityScoreBps - before.viabilityScoreBps,
    lifetimeAccelerationBps: 0,
    socialDeathTriggered: false,
    sourceSettlementId: "settlement:journey_1:v1",
    policyVersion: VIABILITY_POLICY_VERSION,
    ...overrides,
  };
}

test("deriveViabilityTrigger: social-death flip drains remaining to 0 with the social-death reason", () => {
  const projection = buildProjection({
    socialDeathTriggered: true,
    lifetimeAccelerationBps: SOCIAL_DEATH_LIFETIME_ACCELERATION_BPS,
    after: { ...initialIdentityViability("identity_a", "2026-07-07T01:00:00.000Z"), status: "social_death", viabilityScoreBps: 1_000 },
  });
  const trigger = deriveViabilityTrigger(projection, { max: 100, remaining: 47 });
  assert.ok(trigger);
  assert.equal(trigger!.reason, LIFETIME_REASON_IDENTITY_VIABILITY_SOCIAL_DEATH);
  assert.equal(trigger!.delta, -47);
  assert.deepEqual(trigger!.viabilityTriggerRef, {
    sourceSettlementId: "settlement:journey_1:v1",
    lifetimeAccelerationBps: SOCIAL_DEATH_LIFETIME_ACCELERATION_BPS,
    socialDeathTriggered: true,
  });
});

test("deriveViabilityTrigger: stressed emits negative delta with acceleration reason and minimum magnitude of 1", () => {
  const projection = buildProjection({
    after: { ...initialIdentityViability("identity_a", "2026-07-07T01:00:00.000Z"), status: "stressed", viabilityScoreBps: STRESSED_THRESHOLD_BPS - 1_000 },
    lifetimeAccelerationBps: 500,
  });
  // max=100, accel=500 → ceil(100*500/1_000_000) = 1 → magnitude 1.
  const trigger = deriveViabilityTrigger(projection, { max: 100, remaining: 50 });
  assert.ok(trigger);
  assert.equal(trigger!.reason, LIFETIME_REASON_IDENTITY_VIABILITY_ACCELERATION);
  assert.equal(trigger!.delta, -1);
  assert.equal(trigger!.viabilityTriggerRef.socialDeathTriggered, false);
  assert.equal(trigger!.viabilityTriggerRef.lifetimeAccelerationBps, 500);
});

test("deriveViabilityTrigger: stressed magnitude scales with max lifetime and acceleration bps", () => {
  const projection = buildProjection({
    after: { ...initialIdentityViability("identity_a", "2026-07-07T01:00:00.000Z"), status: "stressed", viabilityScoreBps: 1_000 },
    // Near the cap: ceil(10_000 * 5_000 / 1_000_000) = 50.
    lifetimeAccelerationBps: STRESSED_LIFETIME_ACCELERATION_CAP_BPS,
  });
  const trigger = deriveViabilityTrigger(projection, { max: 10_000, remaining: 1_000 });
  assert.ok(trigger);
  // magnitude = ceil(10000 * 5000 / 1_000_000) = 50, well under remaining.
  assert.equal(trigger!.delta, -50);
});

test("deriveViabilityTrigger: stressed delta is clamped to remaining lifetime", () => {
  const projection = buildProjection({
    after: { ...initialIdentityViability("identity_a", "2026-07-07T01:00:00.000Z"), status: "stressed", viabilityScoreBps: 1_000 },
    lifetimeAccelerationBps: STRESSED_LIFETIME_ACCELERATION_CAP_BPS,
  });
  // remaining=3 → magnitude would be 50 but clamped to 3.
  const trigger = deriveViabilityTrigger(projection, { max: 10_000, remaining: 3 });
  assert.ok(trigger);
  assert.equal(trigger!.delta, -3);
});

test("deriveViabilityTrigger: stressed with zero acceleration returns null (no movement)", () => {
  const projection = buildProjection({
    after: { ...initialIdentityViability("identity_a", "2026-07-07T01:00:00.000Z"), status: "stressed" },
    lifetimeAccelerationBps: 0,
  });
  const trigger = deriveViabilityTrigger(projection, { max: 100, remaining: 50 });
  assert.equal(trigger, null);
});

test("deriveViabilityTrigger: stressed with zero remaining returns null (no negative delta to apply)", () => {
  const projection = buildProjection({
    after: { ...initialIdentityViability("identity_a", "2026-07-07T01:00:00.000Z"), status: "stressed" },
    lifetimeAccelerationBps: 4_000,
  });
  const trigger = deriveViabilityTrigger(projection, { max: 100, remaining: 0 });
  assert.equal(trigger, null);
});

test("deriveViabilityTrigger: healthy projection returns null (no viability-driven adjustment)", () => {
  const projection = buildProjection({
    after: { ...initialIdentityViability("identity_a", "2026-07-07T01:00:00.000Z"), status: "healthy", viabilityScoreBps: 9_000 },
    lifetimeAccelerationBps: 0,
  });
  const trigger = deriveViabilityTrigger(projection, { max: 100, remaining: 50 });
  assert.equal(trigger, null);
});

test("deriveViabilityTrigger: socialDeathTriggered takes precedence over stressed status", () => {
  // Defensive shape: if a projection is somehow flagged socialDeathTriggered
  // but the after.status is 'stressed', the social-death branch wins.
  const projection = buildProjection({
    socialDeathTriggered: true,
    after: { ...initialIdentityViability("identity_a", "2026-07-07T01:00:00.000Z"), status: "stressed" },
    lifetimeAccelerationBps: SOCIAL_DEATH_LIFETIME_ACCELERATION_BPS,
  });
  const trigger = deriveViabilityTrigger(projection, { max: 100, remaining: 30 });
  assert.ok(trigger);
  assert.equal(trigger!.reason, LIFETIME_REASON_IDENTITY_VIABILITY_SOCIAL_DEATH);
  assert.equal(trigger!.delta, -30);
  assert.equal(trigger!.viabilityTriggerRef.socialDeathTriggered, true);
});

test("deriveViabilityTrigger: pure — same inputs always yield same output", () => {
  const projection = buildProjection({
    after: { ...initialIdentityViability("identity_a", "2026-07-07T01:00:00.000Z"), status: "stressed", viabilityScoreBps: 4_000 },
    lifetimeAccelerationBps: 2_000,
  });
  const lifetime = { max: 100, remaining: 80 };
  const a = deriveViabilityTrigger(projection, lifetime);
  const b = deriveViabilityTrigger(projection, lifetime);
  assert.deepEqual(a, b);
});

test("deriveViabilityTrigger: anti-loop — output never references a SettlementContext", () => {
  // Structural check: the returned ref only carries the sourceSettlementId
  // string + accel + flag. No back-reference into the current settlement's
  // ctx is expressible on this shape (anti-loop rule §6.8).
  const projection = buildProjection({
    socialDeathTriggered: true,
    after: { ...initialIdentityViability("identity_a", "2026-07-07T01:00:00.000Z"), status: "social_death", viabilityScoreBps: 1_000 },
    lifetimeAccelerationBps: SOCIAL_DEATH_LIFETIME_ACCELERATION_BPS,
  });
  const trigger = deriveViabilityTrigger(projection, { max: 100, remaining: 25 });
  assert.ok(trigger);
  const ref = trigger!.viabilityTriggerRef;
  assert.equal(Object.keys(ref).sort().join(","), "lifetimeAccelerationBps,socialDeathTriggered,sourceSettlementId");
});

// ---------------------------------------------------------------------------
// PR5a — Verify-round-1 adversarial findings (NON-BLOCKING) locked as
// regression tests so any silent drift is caught without a POLICY bump.
// ---------------------------------------------------------------------------

test("PR5a balance: faction component AVERAGES — one hostile faction is diluted by N friendly factions (Verify finding 1, documented)", () => {
  // The first-version aggregation choice (computeViabilityScore JSDoc) is to
  // AVERAGE per-faction component bps across ALL factions. This locks in the
  // exact worked example from the Verify report so any future change to the
  // aggregation (without a VIABILITY_POLICY_VERSION bump) is caught here.
  //
  // Example: 1 hostile (-10_000 → 0 bps) + 3 exalted (10_000 each → 10_000)
  // averages to (0 + 10_000·3) / 4 = 7_500, NOT 0.
  const hostile = computeViabilityScore({
    factionStanding: { hostile_f: -10_000 },
    flaggedWanted: new Set<string>(),
    doubtedBy: {},
    lifetime: { max: 1_000, remaining: 1_000 },
  });
  assert.equal(hostile.breakdown.factionComponentBps, 0);

  const oneHostilePlusThreeExalted = computeViabilityScore({
    factionStanding: {
      hostile_f: -10_000,
      friend_a: 10_000,
      friend_b: 10_000,
      friend_c: 10_000,
    },
    flaggedWanted: new Set<string>(),
    doubtedBy: {},
    lifetime: { max: 1_000, remaining: 1_000 },
  });
  // (0 + 10_000 + 10_000 + 10_000) / 4 = 7_500
  assert.equal(oneHostilePlusThreeExalted.breakdown.factionComponentBps, 7_500);

  // Sanity: the pure-hostile case hits 0 only because there are no friends to
  // dilute with. Adding ANY friendly faction lifts the component off zero.
  const hostilePlusOneExalted = computeViabilityScore({
    factionStanding: { hostile_f: -10_000, friend_a: 10_000 },
    flaggedWanted: new Set<string>(),
    doubtedBy: {},
    lifetime: { max: 1_000, remaining: 1_000 },
  });
  // (0 + 10_000) / 2 = 5_000
  assert.equal(hostilePlusOneExalted.breakdown.factionComponentBps, 5_000);

  // The "worst-faction wins" alternative was REJECTED for v1 — explicitly
  // assert that averaging (not min) is the rule, so a silent flip is caught.
  assert.ok(
    hostilePlusOneExalted.breakdown.factionComponentBps
      > hostile.breakdown.factionComponentBps,
    "averaging must not collapse to worst-faction-wins (v1 contract)",
  );
});


