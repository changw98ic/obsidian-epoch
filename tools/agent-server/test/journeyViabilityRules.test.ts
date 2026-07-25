import assert from "node:assert/strict";
import test from "node:test";

import {
  VIABILITY_DEATH_THRESHOLD_BPS,
  VIABILITY_POLICY_VERSION,
  type IdentityViability,
  type IdentityViabilityProjection,
  type ViabilityStatus,
} from "../lib/epoch/journeyViabilityRules.ts";

/**
 * These tests cover the PR1 type freeze for journeyViabilityRules.ts:
 *  - Version + threshold constants are exported and pinned.
 *  - ViabilityStatus is exactly the three contract buckets (exhaustiveness).
 *  - IdentityViability / IdentityViabilityProjection are constructible with
 *    the contract field set.
 *  - Zero-bonus hard rule: neither Public type leaks strategy/affinity/fit
 *    fields (taskFamilyId, strategyAffinity, fitBps, expectedApproach).
 *
 * "Unknown tag fails closed" is enforced at the type layer (the ViabilityStatus
 * union has no escape hatch) — see "ViabilityStatus is exactly the three
 * contract buckets". A runtime throw-expectation test is not applicable here
 * because this file ships no runtime discriminator function; the closed-ness
 * is purely the TS union.
 */

const ALLOWED_STATUSES: readonly ViabilityStatus[] = [
  "healthy",
  "stressed",
  "social_death",
];

/**
 * Banned field names — strategy / affinity / fit signals must never leak into
 * Public viability types. These belong to Internal types only. Asserted on
 * every fixture below.
 */
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
    // doubtedBy is keyed by npcId; empty record is always assignable to
    // Readonly<Record<string, DoubtStrength>> regardless of DoubtStrength's
    // exact literal shape, which is owned by journeyRoleplayRules.
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

test("VIABILITY_POLICY_VERSION is exported and pinned at 1", () => {
  assert.equal(VIABILITY_POLICY_VERSION, 1);
  // `as const` literal: the const's own type is the literal 1, not number.
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
  // Build each literal; any other value would not type-check, so the
  // compiler is the closed-over-discriminator here.
  const healthy: ViabilityStatus = "healthy";
  const stressed: ViabilityStatus = "stressed";
  const dead: ViabilityStatus = "social_death";

  const actual = [healthy, stressed, dead].sort();
  const expected = ALLOWED_STATUSES.slice().sort();
  assert.deepEqual(actual, expected);

  // Exhaustiveness: Record<ViabilityStatus, _> requires every union member.
  // If a fourth status is ever added, this line forces the test to update.
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
