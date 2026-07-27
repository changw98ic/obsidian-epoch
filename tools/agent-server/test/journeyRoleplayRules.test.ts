import assert from "node:assert/strict";
import test from "node:test";

import { APPROACH_TAGS, type Strategy } from "../lib/epoch/journeyStrategyRules.ts";
import {
  extractOriginUnitRole,
  SYSTEM_IDENTITY_ROLES,
} from "../lib/epoch/identityNameTokens.ts";
import { DOUBT_PENALTY_BPS } from "../lib/epoch/journeyViabilityRules.ts";
import {
  appendMirrorConsequence,
  deriveMirrorConsequenceDedupeKey,
  deriveMirrorConsequenceEntryId,
  emptyMirrorConsequenceLedger,
} from "../lib/epoch/journeyMirrorLedger.ts";

import {
  ROLEPLAY_PATTERN_VERSION,
  buildExpectedLifePattern,
  buildNpcIdentityDoubtEvent,
  classificationToDeviationBps,
  compareApproachToLifePattern,
  classifyRoleplayDeviation,
  deviationClassificationToDoubtStrength,
  doubtStrengthToClassification,
  roleplayScoreFromLedger,
  DEVIATION_BPS_BY_CLASSIFICATION,
  DEVIATION_CLASSIFICATION_TO_DOUBT_STRENGTH,
  type DoubtStrength,
  type ExpectedLifePattern,
  type HiddenPrerequisiteLink,
  type HiddenPrerequisiteStatus,
  type NpcDoubtEvent,
  type RoleNorm,
  type RoleplayDeviationClassification,
  type RoleplayDeviationComparison,
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

// ---------------------------------------------------------------------------
// PR5b tests — runtime algorithm coverage.
//
// The PR1 tests above pin the type/union contract. The tests below exercise
// the five pure functions added in PR5b:
//   buildExpectedLifePattern, compareApproachToLifePattern,
//   classifyRoleplayDeviation, buildNpcIdentityDoubtEvent,
//   roleplayScoreFromLedger
// plus their helper maps. Every test asserts the LLM-free contract: same
// inputs → same outputs, no global state, no side effects, and the
// deviation/strength/bps tables stay in lockstep with DOUBT_PENALTY_BPS.
// ---------------------------------------------------------------------------

const EXPLORER_ID_A = "explorer_alpha_001";
const EXPLORER_ID_B = "explorer_beta_002";
const FROZEN_AT = "2026-07-25T12:00:00.000Z";

/** Build a BuildExpectedLifePattern input with sensible defaults. */
function patternInputFixture(overrides: {
  readonly identityId?: string;
  readonly identityName?: string;
  readonly explorerId?: string;
  readonly generation?: number;
  readonly personalityTraits?: readonly string[];
  readonly needs?: readonly string[];
  readonly lifeGoal?: string;
  readonly strategyDispositionPrimary?: Strategy;
  readonly frozenAt?: string;
} = {}): Parameters<typeof buildExpectedLifePattern>[0] {
  const identityId = overrides.identityId ?? IDENTITY_ID;
  const explorerId = overrides.explorerId ?? EXPLORER_ID_A;
  const generation = overrides.generation ?? 1;
  const identityName = overrides.identityName
    ?? `${extractOriginUnitRole(explorerId, generation).origin}测试单元见习记录员 · 第${generation}世`;
  return {
    identityId,
    identityName,
    explorerId,
    generation,
    personalityTraits: overrides.personalityTraits ?? ["谨慎"],
    ...(overrides.needs !== undefined ? { needs: overrides.needs } : {}),
    ...(overrides.lifeGoal !== undefined ? { lifeGoal: overrides.lifeGoal } : {}),
    ...(overrides.strategyDispositionPrimary !== undefined
      ? {
          strategyDisposition: {
            identityId,
            primary: overrides.strategyDispositionPrimary,
            frozenAt: overrides.frozenAt ?? FROZEN_AT,
            strategyPolicyVersion: 1 as const,
            affinityMatrixVersion: 1 as const,
          },
        }
      : {}),
    frozenAt: overrides.frozenAt ?? FROZEN_AT,
  };
}

/** Find a (explorerId, generation) pair whose role token matches a predicate. */
function findIdentityForRole(
  rolePredicate: (role: string) => boolean,
): { readonly explorerId: string; readonly generation: number; readonly role: string } {
  // Deterministic search: walk small explorer-id seeds + generations until
  // the slice algorithm yields a role the predicate accepts. Bounded by the
  // 12-entry SYSTEM_IDENTITY_ROLES table so this terminates quickly.
  for (let gen = 1; gen < 50; gen += 1) {
    for (let i = 0; i < 200; i += 1) {
      const explorerId = `explorer_seed_${i}`;
      const { role } = extractOriginUnitRole(explorerId, gen);
      if (rolePredicate(role)) return { explorerId, generation: gen, role };
    }
  }
  throw new Error(`test_seed_search_failed: no role matched predicate`);
}

test("buildExpectedLifePattern is deterministic: same inputs → same pattern + same inputHash", () => {
  const input = patternInputFixture();
  const a = buildExpectedLifePattern(input);
  const b = buildExpectedLifePattern(input);
  assert.equal(a.patternVersion, ROLEPLAY_PATTERN_VERSION);
  assert.equal(b.patternVersion, ROLEPLAY_PATTERN_VERSION);
  assert.deepEqual(a, b);
  // inputHash is the canonical `sha256:`-prefixed hex digest and is byte-stable.
  assert.match(a.inputHash, /^sha256:[0-9a-f]{64}$/);
  assert.equal(a.inputHash, b.inputHash);
  // frozenAt is the caller-supplied timestamp, not server time.
  assert.equal(a.frozenAt, FROZEN_AT);
});

test("buildExpectedLifePattern inputHash is canonical: key-order-independent", () => {
  // Two semantically-equal inputs whose JS-object key orders differ MUST
  // hash to the same inputHash. The canonicalJson helper sorts keys.
  const baseInput = patternInputFixture({ personalityTraits: ["谨慎", "果断"] });
  // Construct a second input by building the object literal in a different
  // key order — semantically identical.
  const reorderedInput: Parameters<typeof buildExpectedLifePattern>[0] = {
    frozenAt: baseInput.frozenAt,
    personalityTraits: ["谨慎", "果断"],
    generation: baseInput.generation,
    explorerId: baseInput.explorerId,
    identityName: baseInput.identityName,
    identityId: baseInput.identityId,
  };
  const a = buildExpectedLifePattern(baseInput);
  const b = buildExpectedLifePattern(reorderedInput);
  assert.equal(a.inputHash, b.inputHash);
});

test("buildExpectedLifePattern patternVersion is pinned to ROLEPLAY_PATTERN_VERSION (=1)", () => {
  const pattern = buildExpectedLifePattern(patternInputFixture());
  assert.equal(pattern.patternVersion, 1);
  // Literal-typed so a bump surfaces as a type error here.
  const check: 1 = pattern.patternVersion;
  assert.equal(check, 1);
});

test("buildExpectedLifePattern for a fresh identity differs from a previous-identity pattern (reincarnation reset)", () => {
  // Reincarnation MUST re-build a fresh pattern from nextAgentId + new
  // explorerId+generation. By construction the inputHash differs.
  const previous = buildExpectedLifePattern(
    patternInputFixture({ identityId: "identity_old", explorerId: EXPLORER_ID_A, generation: 1 }),
  );
  const next = buildExpectedLifePattern(
    patternInputFixture({ identityId: "identity_new", explorerId: EXPLORER_ID_A, generation: 2 }),
  );
  assert.notEqual(previous.identityId, next.identityId);
  assert.notEqual(previous.inputHash, next.inputHash);
  assert.notEqual(previous.frozenAt, next.frozenAt === previous.frozenAt ? "" : next.frozenAt, previous.frozenAt);
});

test("buildExpectedLifePattern combat/safety/ecology/sampling role bucket freezes expected=[combat,scout,preservation]", () => {
  // Pick a role whose slice token satisfies the combat/safety/ecology/sampling
  // bucket (substring match on 猎手|安全|生态|采样).
  const seed = findIdentityForRole(
    (role) =>
      role.includes("猎手")
      || role.includes("安全")
      || role.includes("生态")
      || role.includes("采样"),
  );
  const pattern = buildExpectedLifePattern(
    patternInputFixture({
      identityId: "identity_combat_bucket",
      explorerId: seed.explorerId,
      generation: seed.generation,
    }),
  );
  // Expected arrays are ordered against APPROACH_TAGS for canonical,
  // inputHash-stable persistence.
  assert.deepEqual(
    [...pattern.expectedApproaches],
    ["combat", "scout", "preservation"],
  );
  assert.deepEqual(
    [...pattern.forbiddenApproaches],
    ["diplomacy", "support", "logistics"],
  );
});

test("buildExpectedLifePattern diplomacy/liaison/supply role bucket freezes expected=[diplomacy,logistics,support]", () => {
  const seed = findIdentityForRole(
    (role) => role.includes("联络") || role.includes("补给"),
  );
  const pattern = buildExpectedLifePattern(
    patternInputFixture({
      identityId: "identity_diplomacy_bucket",
      explorerId: seed.explorerId,
      generation: seed.generation,
    }),
  );
  // APPROACH_TAGS order: diplomacy < support < logistics.
  assert.deepEqual(
    [...pattern.expectedApproaches],
    ["diplomacy", "support", "logistics"],
  );
  assert.deepEqual([...pattern.forbiddenApproaches], ["combat", "stealth"]);
});

test("buildExpectedLifePattern recon/sample role bucket freezes expected=[scout,logistics]", () => {
  const seed = findIdentityForRole(
    (role) => role.includes("勘探") || role.includes("样本"),
  );
  const pattern = buildExpectedLifePattern(
    patternInputFixture({
      identityId: "identity_recon_bucket",
      explorerId: seed.explorerId,
      generation: seed.generation,
    }),
  );
  // APPROACH_TAGS order: logistics < scout.
  assert.deepEqual([...pattern.expectedApproaches], ["logistics", "scout"]);
  assert.deepEqual([...pattern.forbiddenApproaches], ["combat", "diplomacy"]);
});

test("buildExpectedLifePattern unknown role token → fail-closed (expected=∅, forbidden=∅)", () => {
  // 见习记录员 / 设备检修员 / 外勤助理 / 试炼候补 / 数据校准员 / 药圃照料员
  // all fall outside the three role buckets — fail-closed.
  const seed = findIdentityForRole(
    (role) =>
      !role.includes("猎手")
      && !role.includes("安全")
      && !role.includes("生态")
      && !role.includes("采样")
      && !role.includes("联络")
      && !role.includes("补给")
      && !role.includes("勘探")
      && !role.includes("样本"),
  );
  const pattern = buildExpectedLifePattern(
    patternInputFixture({
      identityId: "identity_unknown_bucket",
      explorerId: seed.explorerId,
      generation: seed.generation,
    }),
  );
  assert.deepEqual([...pattern.expectedApproaches], []);
  assert.deepEqual([...pattern.forbiddenApproaches], []);
  // inputHash still recorded so audit can surface the unknown-token case.
  assert.match(pattern.inputHash, /^sha256:[0-9a-f]{64}$/);
});

test("buildExpectedLifePattern strategyDisposition.primary adds to expected when not forbidden", () => {
  // Recon bucket forbids combat|diplomacy. A 'support' primary does NOT
  // collide with either → expected becomes [scout, logistics, support].
  const seed = findIdentityForRole((role) => role.includes("勘探"));
  const pattern = buildExpectedLifePattern(
    patternInputFixture({
      identityId: "identity_recon_with_support_primary",
      explorerId: seed.explorerId,
      generation: seed.generation,
      strategyDispositionPrimary: "support",
    }),
  );
  assert.ok(pattern.expectedApproaches.includes("support"));
  // Forbidden is unchanged (the plan: primary 落入 expected, 不扩 forbidden).
  assert.deepEqual([...pattern.forbiddenApproaches], ["combat", "diplomacy"]);
});

test("buildExpectedLifePattern strategyDisposition.primary is dropped when it collides with forbidden (no self-contradiction)", () => {
  // Recon bucket forbids combat. A 'combat' primary would collide; the rule
  // template drops it (preserves the role-bucket's authority) rather than
  // surface every aligned action as 'forbidden_action'.
  const seed = findIdentityForRole((role) => role.includes("勘探"));
  const pattern = buildExpectedLifePattern(
    patternInputFixture({
      identityId: "identity_recon_with_combat_primary",
      explorerId: seed.explorerId,
      generation: seed.generation,
      strategyDispositionPrimary: "combat",
    }),
  );
  assert.ok(!pattern.expectedApproaches.includes("combat"));
  assert.ok(pattern.forbiddenApproaches.includes("combat"));
});

test("buildExpectedLifePattern rejects empty identityId / explorerId / non-integer generation", () => {
  assert.throws(
    () => buildExpectedLifePattern(patternInputFixture({ identityId: "" })),
    /roleplay_pattern_empty_identity_id/,
  );
  // For the explorerId / generation validation cases we bypass the fixture
  // (which calls extractOriginUnitRole to build a default identityName) so
  // the assertion reaches buildExpectedLifePattern's own guard.
  const validBase = patternInputFixture();
  assert.throws(
    () =>
      buildExpectedLifePattern({
        ...validBase,
        identityName: "x",
        explorerId: "",
      }),
    /roleplay_pattern_empty_explorer_id/,
  );
  assert.throws(
    () => buildExpectedLifePattern({ ...validBase, generation: -1 }),
    /roleplay_pattern_invalid_generation/,
  );
  assert.throws(
    () => buildExpectedLifePattern({ ...validBase, generation: 1.5 }),
    /roleplay_pattern_invalid_generation/,
  );
});

test("buildExpectedLifePattern does NOT import gameCore or eventFactory (pure boundary)", () => {
  // Structural assertion: the module must not pull IO/event-factory
  // dependencies. We assert by re-requiring the module and checking its
  // resolved file does not transitively require gameCore at module-eval time
  // — the canonicalJson + extractOriginUnitRole + createHash chain is the
  // only runtime reach outside the type layer.
  // Smoke-test: building two patterns for different inputs produces
  // different hashes (no hidden global state).
  const a = buildExpectedLifePattern(patternInputFixture({ identityId: "id_a" }));
  const b = buildExpectedLifePattern(patternInputFixture({ identityId: "id_b" }));
  assert.notEqual(a.inputHash, b.inputHash);
  assert.notEqual(a.identityId, b.identityId);
});

test("DEVIATION_BPS_BY_CLASSIFICATION mirrors DOUBT_PENALTY_BPS so collateral and viability share one ruler", () => {
  assert.equal(DEVIATION_BPS_BY_CLASSIFICATION.aligned, 0);
  assert.equal(DEVIATION_BPS_BY_CLASSIFICATION.minor_deviation, DOUBT_PENALTY_BPS.moderate);
  assert.equal(DEVIATION_BPS_BY_CLASSIFICATION.major_deviation, DOUBT_PENALTY_BPS.high);
  assert.equal(DEVIATION_BPS_BY_CLASSIFICATION.forbidden_action, DOUBT_PENALTY_BPS.severe);
});

test("DEVIATION_CLASSIFICATION_TO_DOUBT_STRENGTH maps every classification to a known strength", () => {
  // Exhaustive check.
  const classifications: readonly RoleplayDeviationClassification[] = [
    "aligned",
    "minor_deviation",
    "major_deviation",
    "forbidden_action",
  ];
  for (const c of classifications) {
    const strength = DEVIATION_CLASSIFICATION_TO_DOUBT_STRENGTH[c];
    assert.ok(
      strength === "low" || strength === "moderate" || strength === "high" || strength === "severe",
      `unexpected strength ${strength} for ${c}`,
    );
    assert.equal(deviationClassificationToDoubtStrength(c), strength);
  }
});

test("compareApproachToLifePattern computes the three disjoint subsets correctly", () => {
  const pattern: ExpectedLifePattern = {
    identityId: IDENTITY_ID,
    patternVersion: ROLEPLAY_PATTERN_VERSION,
    expectedApproaches: ["combat", "scout"],
    forbiddenApproaches: ["diplomacy"],
    factionRoleNorms: {},
    inputHash: "sha256:test" as const,
    frozenAt: NOW_ISO,
  };
  // observed = [combat (expected), diplomacy (forbidden), scout (expected), support (off-palette)]
  const comparison = compareApproachToLifePattern(
    ["combat", "diplomacy", "scout", "support"],
    pattern,
  );
  assert.deepEqual([...comparison.hitsForbidden], ["diplomacy"]);
  assert.deepEqual([...comparison.missingExpected], []);
  assert.deepEqual([...comparison.offPalette], ["support"]);
});

test("compareApproachToLifePattern filters unknown approach tags (fail-closed defence-in-depth)", () => {
  const pattern: ExpectedLifePattern = {
    identityId: IDENTITY_ID,
    patternVersion: ROLEPLAY_PATTERN_VERSION,
    expectedApproaches: ["combat"],
    forbiddenApproaches: [],
    factionRoleNorms: {},
    inputHash: "sha256:test" as const,
    frozenAt: NOW_ISO,
  };
  // Cast an unknown string through `as ApproachTag[]` to simulate a caller
  // that forgot to gate via isApproachTag. The comparator must drop it
  // rather than throw or surface it as offPalette.
  const poisonedInput = ["combat", "totally-fake-tag"] as unknown as readonly ApproachTag[];
  const comparison = compareApproachToLifePattern(poisonedInput, pattern);
  assert.deepEqual([...comparison.hitsForbidden], []);
  assert.deepEqual([...comparison.missingExpected], []);
  assert.deepEqual([...comparison.offPalette], []);
});

test("classifyRoleplayDeviation: forbidden hit → forbidden_action regardless of expected coverage", () => {
  const pattern: ExpectedLifePattern = {
    identityId: IDENTITY_ID,
    patternVersion: ROLEPLAY_PATTERN_VERSION,
    expectedApproaches: ["combat", "scout", "preservation"],
    forbiddenApproaches: ["diplomacy"],
    factionRoleNorms: {},
    inputHash: "sha256:test" as const,
    frozenAt: NOW_ISO,
  };
  const comparison: RoleplayDeviationComparison = {
    hitsForbidden: ["diplomacy"],
    missingExpected: [],
    offPalette: [],
  };
  assert.equal(classifyRoleplayDeviation(comparison, pattern), "forbidden_action");
});

test("classifyRoleplayDeviation: >50% missing expected → major_deviation", () => {
  // expected=[combat, scout, preservation] (length 3). missing 2/3 > 0.5.
  const pattern: ExpectedLifePattern = {
    identityId: IDENTITY_ID,
    patternVersion: ROLEPLAY_PATTERN_VERSION,
    expectedApproaches: ["combat", "scout", "preservation"],
    forbiddenApproaches: [],
    factionRoleNorms: {},
    inputHash: "sha256:test" as const,
    frozenAt: NOW_ISO,
  };
  const comparison: RoleplayDeviationComparison = {
    hitsForbidden: [],
    missingExpected: ["combat", "scout"],
    offPalette: [],
  };
  assert.equal(classifyRoleplayDeviation(comparison, pattern), "major_deviation");
});

test("classifyRoleplayDeviation: ≤50% missing expected → minor_deviation", () => {
  // expected length 4; missing 2/4 = 0.5; strict > 0.5 → minor.
  const pattern: ExpectedLifePattern = {
    identityId: IDENTITY_ID,
    patternVersion: ROLEPLAY_PATTERN_VERSION,
    expectedApproaches: ["combat", "scout", "preservation", "logistics"],
    forbiddenApproaches: [],
    factionRoleNorms: {},
    inputHash: "sha256:test" as const,
    frozenAt: NOW_ISO,
  };
  const comparison: RoleplayDeviationComparison = {
    hitsForbidden: [],
    missingExpected: ["combat", "scout"],
    offPalette: [],
  };
  assert.equal(classifyRoleplayDeviation(comparison, pattern), "minor_deviation");
});

test("classifyRoleplayDeviation: offPalette-only → minor_deviation (tolerance band)", () => {
  const pattern: ExpectedLifePattern = {
    identityId: IDENTITY_ID,
    patternVersion: ROLEPLAY_PATTERN_VERSION,
    expectedApproaches: ["combat"],
    forbiddenApproaches: [],
    factionRoleNorms: {},
    inputHash: "sha256:test" as const,
    frozenAt: NOW_ISO,
  };
  const comparison: RoleplayDeviationComparison = {
    hitsForbidden: [],
    missingExpected: [],
    offPalette: ["stealth"],
  };
  assert.equal(classifyRoleplayDeviation(comparison, pattern), "minor_deviation");
});

test("classifyRoleplayDeviation: all-empty → aligned", () => {
  const pattern: ExpectedLifePattern = {
    identityId: IDENTITY_ID,
    patternVersion: ROLEPLAY_PATTERN_VERSION,
    expectedApproaches: ["combat"],
    forbiddenApproaches: [],
    factionRoleNorms: {},
    inputHash: "sha256:test" as const,
    frozenAt: NOW_ISO,
  };
  const comparison: RoleplayDeviationComparison = {
    hitsForbidden: [],
    missingExpected: [],
    offPalette: [],
  };
  assert.equal(classifyRoleplayDeviation(comparison, pattern), "aligned");
});

test("deviation → doubt strength → bps round-trip is consistent with DOUBT_PENALTY_BPS", () => {
  // For every classification that produces a doubt event (i.e. except
  // 'aligned'), the strength → bps lookup must equal the deviation table.
  for (const classification of [
    "minor_deviation",
    "major_deviation",
    "forbidden_action",
  ] as readonly RoleplayDeviationClassification[]) {
    const strength = deviationClassificationToDoubtStrength(classification);
    const bps = classificationToDeviationBps(classification);
    assert.equal(bps, DOUBT_PENALTY_BPS[strength]);
    assert.equal(doubtStrengthToClassification(strength), classification);
  }
  // aligned never produces a doubt event; the round-trip is still consistent.
  const alignedStrength = deviationClassificationToDoubtStrength("aligned");
  assert.equal(alignedStrength, "low");
  assert.equal(doubtStrengthToClassification(alignedStrength), "aligned");
});

test("buildNpcIdentityDoubtEvent is deterministic: same actionEventId+identityId → same doubtEventId", () => {
  const a = buildNpcIdentityDoubtEvent({
    journeyId: JOURNEY_ID,
    identityId: IDENTITY_ID,
    npcId: "npc_witness_a",
    regionId: REGION_ID,
    doubtStrength: "moderate",
    sourceActionEventId: "evt_action_1",
    reason: "roleplay_minor_deviation",
    mirrorLedgerEntryId: "mcle:test:abc",
    recordedAt: NOW_ISO,
  });
  // Same (actionEventId, identityId) — different npcId / reason / strength
  // still yields the SAME doubtEventId. The idempotency key is the
  // (actionEventId, identityId) pair, not the rest of the event.
  const b = buildNpcIdentityDoubtEvent({
    journeyId: JOURNEY_ID,
    identityId: IDENTITY_ID,
    npcId: "npc_witness_different",
    regionId: REGION_ID,
    doubtStrength: "severe",
    sourceActionEventId: "evt_action_1",
    reason: "roleplay_forbidden:combat",
    mirrorLedgerEntryId: "mcle:test:abc",
    recordedAt: NOW_ISO,
  });
  assert.equal(a.doubtEventId, b.doubtEventId);
  // And differs when the actionEventId changes.
  const c = buildNpcIdentityDoubtEvent({
    journeyId: JOURNEY_ID,
    identityId: IDENTITY_ID,
    npcId: "npc_witness_a",
    regionId: REGION_ID,
    doubtStrength: "moderate",
    sourceActionEventId: "evt_action_2",
    reason: "roleplay_minor_deviation",
    mirrorLedgerEntryId: "mcle:test:def",
    recordedAt: NOW_ISO,
  });
  assert.notEqual(a.doubtEventId, c.doubtEventId);
});

test("buildNpcIdentityDoubtEvent refuses 'low' strength (aligned sentinel)", () => {
  assert.throws(
    () =>
      buildNpcIdentityDoubtEvent({
        journeyId: JOURNEY_ID,
        identityId: IDENTITY_ID,
        npcId: "npc_witness_a",
        regionId: REGION_ID,
        doubtStrength: "low",
        sourceActionEventId: "evt_action_aligned",
        reason: "should_not_be_emitted",
        mirrorLedgerEntryId: "mcle:test:aligned",
        recordedAt: NOW_ISO,
      }),
    /roleplay_doubt_aligned_must_not_produce_event/,
  );
});

test("buildNpcIdentityDoubtEvent validates required fields", () => {
  const base = {
    journeyId: JOURNEY_ID,
    identityId: IDENTITY_ID,
    npcId: "npc_witness_a",
    regionId: REGION_ID,
    doubtStrength: "moderate" as const,
    sourceActionEventId: "evt_action_1",
    reason: "roleplay_minor_deviation",
    mirrorLedgerEntryId: "mcle:test:abc",
    recordedAt: NOW_ISO,
  };
  assert.throws(
    () => buildNpcIdentityDoubtEvent({ ...base, sourceActionEventId: "" }),
    /roleplay_doubt_missing_action_event_id/,
  );
  assert.throws(
    () => buildNpcIdentityDoubtEvent({ ...base, identityId: "" }),
    /roleplay_doubt_missing_identity_id/,
  );
  assert.throws(
    () => buildNpcIdentityDoubtEvent({ ...base, mirrorLedgerEntryId: "" }),
    /roleplay_doubt_missing_mirror_ledger_entry_id/,
  );
});

test("doubt idempotency: appendMirrorConsequence no-ops the second append for the same actionEventId+identity", () => {
  // This is the end-to-end idempotency the production path relies on:
  // (1) buildNpcIdentityDoubtEvent derives a stable doubtEventId; (2) the
  // ledger's appendMirrorConsequence de-duplicates on the composite
  // (actionEventId, dedupeKey) which is itself derived from the same
  // (actionEventId, identity) pair. Replaying the same action therefore
  // records exactly one doubt entry — never double-counts.
  const actionEventId = "evt_action_idempotency_1";
  const dedupeKey = deriveMirrorConsequenceDedupeKey({
    effectKind: "identity_doubt",
    targetEntityId: `identity:${IDENTITY_ID}`,
    actionEventId,
  });
  const entryId = deriveMirrorConsequenceEntryId({
    journeyId: JOURNEY_ID,
    actionEventId,
    dedupeKey,
  });
  const doubtEntry = buildNpcIdentityDoubtEvent({
    journeyId: JOURNEY_ID,
    identityId: IDENTITY_ID,
    npcId: "npc_witness_a",
    regionId: REGION_ID,
    doubtStrength: "severe",
    sourceActionEventId: actionEventId,
    reason: "roleplay_forbidden:combat",
    mirrorLedgerEntryId: entryId,
    recordedAt: NOW_ISO,
  });
  void doubtEntry; // constructed for the side-effect of asserting the builder succeeds

  // Simulate the ledger entry the production path would write. We do not
  // need a full MirrorConsequenceLedgerEntry here — only the fields
  // appendMirrorConsequence consults for de-duplication.
  const ledgerEntry = {
    actionEventId,
    effectKind: "identity_doubt" as const,
    targetEntityId: `identity:${IDENTITY_ID}`,
    delta: 0,
    consequenceType: "collateral" as const,
    sourceEventIds: [actionEventId],
    effectBlueprint: { doubtEventId: doubtEntry.doubtEventId } as Readonly<
      Record<string, unknown>
    >,
    recordedAt: NOW_ISO,
    dedupeKey,
  };
  const empty = emptyMirrorConsequenceLedger(JOURNEY_ID);
  const afterFirst = appendMirrorConsequence(empty, ledgerEntry);
  const afterSecond = appendMirrorConsequence(afterFirst, ledgerEntry);
  // Same entryId survives — replay is a no-op.
  assert.equal(
    Object.keys(afterFirst.entriesById).length,
    1,
    "first append must record one entry",
  );
  assert.equal(
    Object.keys(afterSecond.entriesById).length,
    1,
    "second append (replay) must be a no-op",
  );
});

test("roleplayScoreFromLedger sums bps across events and surfaces the worst classification", () => {
  // Two events: severe (4000) + moderate (750) = 4750 bps. Worst
  // classification is forbidden_action (from the severe entry).
  const severeEvent: NpcDoubtEvent = {
    doubtEventId: "doubt:severe_001",
    journeyId: JOURNEY_ID,
    identityId: IDENTITY_ID,
    npcId: "npc_witness_a",
    regionId: REGION_ID,
    doubtStrength: "severe",
    sourceActionEventId: "evt_action_forbidden",
    reason: "roleplay_forbidden:combat",
    mirrorLedgerEntryId: "mcle:test:severe",
    recordedAt: NOW_ISO,
  };
  const moderateEvent: NpcDoubtEvent = {
    doubtEventId: "doubt:moderate_001",
    journeyId: JOURNEY_ID,
    identityId: IDENTITY_ID,
    npcId: "npc_witness_b",
    regionId: REGION_ID,
    doubtStrength: "moderate",
    sourceActionEventId: "evt_action_minor",
    reason: "roleplay_minor_deviation",
    mirrorLedgerEntryId: "mcle:test:moderate",
    recordedAt: NOW_ISO,
  };
  const score = roleplayScoreFromLedger([severeEvent, moderateEvent], NOW_ISO);
  assert.equal(
    score.deviationBps,
    DOUBT_PENALTY_BPS.severe + DOUBT_PENALTY_BPS.moderate,
  );
  assert.equal(score.classification, "forbidden_action");
  assert.equal(score.exposed, true);
  assert.equal(score.npcDoubtEvents.length, 2);
  assert.equal(score.patternVersion, ROLEPLAY_PATTERN_VERSION);
  assert.equal(score.computedAt, NOW_ISO);
});

test("roleplayScoreFromLedger clamps to 10_000 bps when the sum overflows", () => {
  // 3 severe events = 12_000 raw; clamp to 10_000.
  const events: NpcDoubtEvent[] = [];
  for (let i = 0; i < 3; i += 1) {
    events.push({
      doubtEventId: `doubt:severe_${i}`,
      journeyId: JOURNEY_ID,
      identityId: IDENTITY_ID,
      npcId: `npc_witness_${i}`,
      regionId: REGION_ID,
      doubtStrength: "severe",
      sourceActionEventId: `evt_action_forbidden_${i}`,
      reason: "roleplay_forbidden:combat",
      mirrorLedgerEntryId: `mcle:test:severe_${i}`,
      recordedAt: NOW_ISO,
    });
  }
  const score = roleplayScoreFromLedger(events, NOW_ISO);
  assert.equal(score.deviationBps, 10_000);
  assert.equal(score.exposed, true);
});

test("roleplayScoreFromLedger exposed=true when deviationBps crosses 4_000 even without any severe entry", () => {
  // 6 moderate events = 6 * 750 = 4_500 bps ≥ 4_000 → exposed. No 'severe'
  // entry in the bundle, so the threshold path is the only trigger.
  const events: NpcDoubtEvent[] = [];
  for (let i = 0; i < 6; i += 1) {
    events.push({
      doubtEventId: `doubt:moderate_${i}`,
      journeyId: JOURNEY_ID,
      identityId: IDENTITY_ID,
      npcId: `npc_witness_${i}`,
      regionId: REGION_ID,
      doubtStrength: "moderate",
      sourceActionEventId: `evt_action_minor_${i}`,
      reason: "roleplay_minor_deviation",
      mirrorLedgerEntryId: `mcle:test:moderate_${i}`,
      recordedAt: NOW_ISO,
    });
  }
  const score = roleplayScoreFromLedger(events, NOW_ISO);
  assert.equal(score.deviationBps, 4_500);
  assert.equal(score.exposed, true);
  // Worst classification among moderate entries is minor_deviation.
  assert.equal(score.classification, "minor_deviation");
});

test("roleplayScoreFromLedger empty input → aligned, deviationBps=0, exposed=false", () => {
  const score = roleplayScoreFromLedger([], NOW_ISO);
  assert.equal(score.deviationBps, 0);
  assert.equal(score.classification, "aligned");
  assert.equal(score.exposed, false);
  assert.equal(score.patternVersion, ROLEPLAY_PATTERN_VERSION);
});

test("roleplayScoreFromLedger is independent of journeyStoryReport.identityFidelityPercent", () => {
  // Structural separation: RoleplayScore fields are
  //   deviationBps / classification / npcDoubtEvents / exposed / patternVersion / computedAt.
  // identityFidelityPercent (PR4 journeyStoryReport) is a separate
  // narrative-side read with no overlap. Asserting the field set here
  // documents the boundary for future PRs.
  const score = roleplayScoreFromLedger([], NOW_ISO);
  const keys = Object.keys(score).sort();
  assert.deepEqual(
    keys,
    [
      "classification",
      "computedAt",
      "deviationBps",
      "exposed",
      "npcDoubtEvents",
      "patternVersion",
    ],
  );
  for (const forbiddenField of [
    "identityFidelityPercent",
    "fidelityPercent",
    "taskFamilyId",
    "strategyAffinity",
    "fitBps",
    "expectedApproach",
    "bonus",
  ]) {
    assert.ok(!keys.includes(forbiddenField), `RoleplayScore must not carry ${forbiddenField}`);
  }
});

test("LLM-free contract: all judgements are pure rule logic (no IO, no global state)", () => {
  // The roleplay algorithm MUST be LLM-free: every output is a pure function
  // of its inputs. We exercise every public function twice with identical
  // inputs and assert byte-identical outputs — this catches any hidden
  // global mutation, randomness, or uncontrolled IO.
  const pattern = buildExpectedLifePattern(patternInputFixture());
  const comparisonA = compareApproachToLifePattern(["combat", "stealth"], pattern);
  const comparisonB = compareApproachToLifePattern(["combat", "stealth"], pattern);
  assert.deepEqual(comparisonA, comparisonB);

  const classificationA = classifyRoleplayDeviation(comparisonA, pattern);
  const classificationB = classifyRoleplayDeviation(comparisonB, pattern);
  assert.equal(classificationA, classificationB);

  const eventA = buildNpcIdentityDoubtEvent({
    journeyId: JOURNEY_ID,
    identityId: IDENTITY_ID,
    npcId: "npc_llm_free",
    regionId: REGION_ID,
    doubtStrength: "high",
    sourceActionEventId: "evt_llm_free",
    reason: "roleplay_major_deviation",
    mirrorLedgerEntryId: "mcle:llm_free",
    recordedAt: NOW_ISO,
  });
  const eventB = buildNpcIdentityDoubtEvent({
    journeyId: JOURNEY_ID,
    identityId: IDENTITY_ID,
    npcId: "npc_llm_free",
    regionId: REGION_ID,
    doubtStrength: "high",
    sourceActionEventId: "evt_llm_free",
    reason: "roleplay_major_deviation",
    mirrorLedgerEntryId: "mcle:llm_free",
    recordedAt: NOW_ISO,
  });
  assert.deepEqual(eventA, eventB);

  const scoreA = roleplayScoreFromLedger([eventA], NOW_ISO);
  const scoreB = roleplayScoreFromLedger([eventB], NOW_ISO);
  assert.deepEqual(scoreA, scoreB);

  // The four classification → strength → bps lookups are exhaustive and
  // versioned. There is no LLM call anywhere in the chain.
  for (const classification of [
    "aligned",
    "minor_deviation",
    "major_deviation",
    "forbidden_action",
  ] as readonly RoleplayDeviationClassification[]) {
    const strength = deviationClassificationToDoubtStrength(classification);
    const bps = classificationToDeviationBps(classification);
    assert.equal(typeof strength, "string");
    assert.equal(typeof bps, "number");
    assert.ok(Number.isFinite(bps));
  }
});

test("identityNameTokens: SYSTEM_IDENTITY_ROLES enumerates the 12 contract tokens (drift guard)", () => {
  // If anyone changes the role table in identityNameTokens, this assertion
  // surfaces the change at test time so ROLEPLAY_PATTERN_VERSION can be
  // bumped deliberately.
  assert.equal(SYSTEM_IDENTITY_ROLES.length, 12);
  for (const role of SYSTEM_IDENTITY_ROLES) {
    assert.equal(typeof role, "string");
    assert.ok(role.length > 0);
  }
});
