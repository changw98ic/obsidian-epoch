import assert from "node:assert/strict";
import test from "node:test";

import { APPROACH_TAGS } from "../lib/epoch/journeyStrategyRules.ts";

import {
  ROLEPLAY_PATTERN_VERSION,
  type DoubtStrength,
  type ExpectedLifePattern,
  type HiddenPrerequisiteLink,
  type HiddenPrerequisiteStatus,
  type NpcDoubtEvent,
  type RoleNorm,
  type RoleplayDeviationClassification,
  type RoleplayScore,
} from "../lib/epoch/journeyRoleplayRules.ts";

/**
 * Exhaustive records for each string-literal union. Assigning the value `true`
 * to every key forces a compile-time error if a union member is added or
 * removed, and gives the runtime fail-closed guards a single source of truth.
 */
const DOUBT_STRENGTH_VALUES: Readonly<Record<DoubtStrength, true>> = Object.freeze({
  low: true,
  moderate: true,
  high: true,
  severe: true,
});
const DEVIATION_VALUES: Readonly<Record<RoleplayDeviationClassification, true>> = Object.freeze({
  aligned: true,
  minor_deviation: true,
  major_deviation: true,
  forbidden_action: true,
});
const HIDDEN_PREREQ_VALUES: Readonly<Record<HiddenPrerequisiteStatus, true>> = Object.freeze({
  intact: true,
  destroyed: true,
  degraded: true,
});

/** Runtime fail-closed guard — any value outside the literal union throws. */
function asDoubtStrength(value: unknown): DoubtStrength {
  if (typeof value === "string" && Object.prototype.hasOwnProperty.call(DOUBT_STRENGTH_VALUES, value)) {
    return value as DoubtStrength;
  }
  throw new Error(`Unknown DoubtStrength: ${String(value)}`);
}
function asDeviationClassification(value: unknown): RoleplayDeviationClassification {
  if (typeof value === "string" && Object.prototype.hasOwnProperty.call(DEVIATION_VALUES, value)) {
    return value as RoleplayDeviationClassification;
  }
  throw new Error(`Unknown RoleplayDeviationClassification: ${String(value)}`);
}
function asHiddenPrerequisiteStatus(value: unknown): HiddenPrerequisiteStatus {
  if (typeof value === "string" && Object.prototype.hasOwnProperty.call(HIDDEN_PREREQ_VALUES, value)) {
    return value as HiddenPrerequisiteStatus;
  }
  throw new Error(`Unknown HiddenPrerequisiteStatus: ${String(value)}`);
}

const IDENTITY_ID = "identity_1";
const JOURNEY_ID = "journey_1";
const REGION_ID = "region_grey_harbor";
const NOW_ISO = "2026-07-25T00:00:00.000Z";
const SHA256 = "sha256:abc123def456" as const;

/**
 * Minimal fixture for ExpectedLifePattern. Built without any of the bonus
 * marker fields (taskFamilyId / strategyAffinity / fitBps / expectedApproach /
 * bonus) — the interface is Internal-only and must remain marker-free.
 *
 * `expectedApproaches` / `forbiddenApproaches` are left empty: the element
 * type {@link ApproachTag} lives in a sibling PR file, and the empty array is
 * assignable to `readonly ApproachTag[]` regardless of its final member set,
 * so the fixture does not have to guess the union.
 */
function expectedLifePatternFixture(
  overrides: Partial<ExpectedLifePattern> = {},
): ExpectedLifePattern {
  // Use real tags sliced from the sibling journeyStrategyRules taxonomy so the
  // fixture also exercises the cross-file ApproachTag wiring. `.slice` keeps
  // the element type as ApproachTag (no `| undefined` from indexed access).
  const expectedTags = APPROACH_TAGS.slice(0, 2);
  const forbiddenTags = APPROACH_TAGS.slice(0, 1);
  const factionNorm: RoleNorm = {
    factionId: "faction_grey_council",
    expectedApproaches: expectedTags,
    forbiddenApproaches: forbiddenTags,
    toleranceBps: 1500,
  };
  return {
    identityId: IDENTITY_ID,
    patternVersion: ROLEPLAY_PATTERN_VERSION,
    expectedApproaches: expectedTags,
    forbiddenApproaches: forbiddenTags,
    factionRoleNorms: { [factionNorm.factionId]: factionNorm },
    inputHash: SHA256,
    frozenAt: NOW_ISO,
    ...overrides,
  } satisfies ExpectedLifePattern;
}

function npcDoubtEventFixture(overrides: Partial<NpcDoubtEvent> = {}): NpcDoubtEvent {
  return {
    doubtEventId: "doubt_1",
    journeyId: JOURNEY_ID,
    identityId: IDENTITY_ID,
    npcId: "npc_harbor_master",
    factionId: "faction_grey_council",
    regionId: REGION_ID,
    doubtStrength: "moderate",
    sourceActionEventId: "evt_action_1",
    reason: "探索者在外交场合突然威胁了议员。",
    mirrorLedgerEntryId: "ledger_mirror_1",
    recordedAt: NOW_ISO,
    ...overrides,
  } satisfies NpcDoubtEvent;
}

function roleplayScoreFixture(overrides: Partial<RoleplayScore> = {}): RoleplayScore {
  return {
    deviationBps: 2750,
    classification: "minor_deviation",
    npcDoubtEvents: [npcDoubtEventFixture()],
    exposed: false,
    patternVersion: ROLEPLAY_PATTERN_VERSION,
    computedAt: NOW_ISO,
    ...overrides,
  } satisfies RoleplayScore;
}

function hiddenPrerequisiteLinkFixture(
  overrides: Partial<HiddenPrerequisiteLink> = {},
): HiddenPrerequisiteLink {
  return {
    objectiveId: "obj_hidden_smuggler_ledger",
    prerequisiteObjectId: "obj_ledger_book_in_archive",
    status: "intact",
    sourceLedgerEntryId: "ledger_mirror_2",
    observedAt: NOW_ISO,
    ...overrides,
  } satisfies HiddenPrerequisiteLink;
}

test("ROLEPLAY_PATTERN_VERSION is exported and pinned to 1", () => {
  assert.equal(ROLEPLAY_PATTERN_VERSION, 1);
  // `as const` narrows the literal type; confirm typeof is the literal 1, not number.
  const check: 1 = ROLEPLAY_PATTERN_VERSION;
  assert.equal(check, 1);
});

test("ExpectedLifePattern is constructible with all contract fields", () => {
  const pattern = expectedLifePatternFixture();
  assert.equal(pattern.identityId, IDENTITY_ID);
  assert.equal(pattern.patternVersion, ROLEPLAY_PATTERN_VERSION);
  assert.equal(pattern.inputHash, SHA256);
  assert.equal(pattern.frozenAt, NOW_ISO);
  assert.ok(Object.keys(pattern.factionRoleNorms).includes("faction_grey_council"));
  assert.equal(pattern.factionRoleNorms["faction_grey_council"]?.toleranceBps, 1500);
});

test("NpcDoubtEvent is constructible and carries mirror ledger entry id", () => {
  const event = npcDoubtEventFixture();
  assert.equal(event.doubtStrength, "moderate");
  assert.equal(event.mirrorLedgerEntryId, "ledger_mirror_1");
  assert.equal(event.sourceActionEventId, "evt_action_1");
  assert.equal(event.factionId, "faction_grey_council");
});

test("RoleplayScore is constructible and carries patternVersion from the same constant", () => {
  const score = roleplayScoreFixture();
  assert.equal(score.deviationBps, 2750);
  assert.equal(score.classification, "minor_deviation");
  assert.equal(score.exposed, false);
  assert.equal(score.patternVersion, ROLEPLAY_PATTERN_VERSION);
  assert.equal(score.npcDoubtEvents.length, 1);
});

test("HiddenPrerequisiteLink is constructible with optional degradation/destroy event ids absent by default", () => {
  const link = hiddenPrerequisiteLinkFixture();
  assert.equal(link.status, "intact");
  assert.equal(link.destroyedAtActionEventId, undefined);
  assert.equal(link.degradedAtActionEventId, undefined);
  assert.equal(link.sourceLedgerEntryId, "ledger_mirror_2");
});

test("HiddenPrerequisiteLink records a destroyed prerequisite with its action event id", () => {
  const link = hiddenPrerequisiteLinkFixture({
    status: "destroyed",
    destroyedAtActionEventId: "evt_action_burn_archive",
  });
  assert.equal(link.status, "destroyed");
  assert.equal(link.destroyedAtActionEventId, "evt_action_burn_archive");
});

test("DoubtStrength union enumerates exactly the four contracted severities", () => {
  assert.deepEqual(
    Object.keys(DOUBT_STRENGTH_VALUES).sort(),
    ["high", "low", "moderate", "severe"],
  );
});

test("RoleplayDeviationClassification union enumerates exactly the four contracted classes", () => {
  assert.deepEqual(
    Object.keys(DEVIATION_VALUES).sort(),
    ["aligned", "forbidden_action", "major_deviation", "minor_deviation"],
  );
});

test("HiddenPrerequisiteStatus union enumerates exactly the three contracted statuses", () => {
  assert.deepEqual(
    Object.keys(HIDDEN_PREREQ_VALUES).sort(),
    ["degraded", "destroyed", "intact"],
  );
});

test("unknown DoubtStrength fails closed", () => {
  assert.throws(() => asDoubtStrength("critical"), /Unknown DoubtStrength: critical/);
  assert.throws(() => asDoubtStrength(undefined), /Unknown DoubtStrength: undefined/);
  assert.throws(() => asDoubtStrength(null), /Unknown DoubtStrength: null/);
  // Valid members pass through unchanged.
  for (const value of Object.keys(DOUBT_STRENGTH_VALUES) as readonly DoubtStrength[]) {
    assert.equal(asDoubtStrength(value), value);
  }
});

test("unknown RoleplayDeviationClassification fails closed", () => {
  assert.throws(
    () => asDeviationClassification("catastrophic"),
    /Unknown RoleplayDeviationClassification: catastrophic/,
  );
  assert.throws(() => asDeviationClassification(42), /Unknown RoleplayDeviationClassification: 42/);
  for (const value of Object.keys(DEVIATION_VALUES) as readonly RoleplayDeviationClassification[]) {
    assert.equal(asDeviationClassification(value), value);
  }
});

test("unknown HiddenPrerequisiteStatus fails closed", () => {
  assert.throws(
    () => asHiddenPrerequisiteStatus("repaired"),
    /Unknown HiddenPrerequisiteStatus: repaired/,
  );
  assert.throws(
    () => asHiddenPrerequisiteStatus({ status: "intact" }),
    /Unknown HiddenPrerequisiteStatus/,
  );
  for (const value of Object.keys(HIDDEN_PREREQ_VALUES) as readonly HiddenPrerequisiteStatus[]) {
    assert.equal(asHiddenPrerequisiteStatus(value), value);
  }
});

test("zero-bonus: ExpectedLifePattern carries no public bonus-marker field", () => {
  // The Internal identity-payload type must NOT surface the public-offer
  // marker fields. Constructing it via the fixture and inspecting keys proves
  // the canonical shape requires none of them.
  const pattern = expectedLifePatternFixture();
  const keys = Object.keys(pattern);
  for (const forbidden of [
    "taskFamilyId",
    "strategyAffinity",
    "fitBps",
    "expectedApproach", // singular — the public bonus marker
    "bonus",
  ]) {
    assert.ok(!keys.includes(forbidden), `ExpectedLifePattern must not carry ${forbidden}`);
  }
  // The plural `expectedApproaches` is the server-owned roleplay norm and is permitted.
  assert.ok(keys.includes("expectedApproaches"));
  assert.ok(keys.includes("forbiddenApproaches"));
});

test("zero-bonus: RoleNorm carries no public bonus-marker field", () => {
  const norm: RoleNorm = {
    factionId: "faction_grey_council",
    expectedApproaches: [],
    forbiddenApproaches: [],
    toleranceBps: 0,
  } satisfies RoleNorm;
  const keys = Object.keys(norm);
  for (const forbidden of ["taskFamilyId", "strategyAffinity", "fitBps", "expectedApproach", "bonus"]) {
    assert.ok(!keys.includes(forbidden), `RoleNorm must not carry ${forbidden}`);
  }
});

test("zero-bonus: every constructed Internal fixture is free of bonus-marker keys", () => {
  const fixtures: ReadonlyArray<Record<string, unknown>> = [
    expectedLifePatternFixture(),
    npcDoubtEventFixture(),
    roleplayScoreFixture(),
    hiddenPrerequisiteLinkFixture(),
  ];
  const forbidden = ["taskFamilyId", "strategyAffinity", "fitBps", "expectedApproach", "bonus"];
  for (const fixture of fixtures) {
    const keys = Object.keys(fixture);
    for (const key of forbidden) {
      assert.ok(!keys.includes(key), `fixture must not carry ${key}`);
    }
  }
});
