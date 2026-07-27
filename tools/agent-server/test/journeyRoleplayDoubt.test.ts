import assert from "node:assert/strict";
import test from "node:test";

import {
  APPROACH_TAGS,
  type ApproachTag,
} from "../lib/epoch/journeyStrategyRules.ts";
import {
  ROLEPLAY_PATTERN_VERSION,
  type ExpectedLifePattern,
  type RoleplayDeviationClassification,
  buildExpectedLifePattern,
  classifyRoleplayDeviation,
  compareApproachToLifePattern,
  deviationClassificationToDoubtStrength,
} from "../lib/epoch/journeyRoleplayRules.ts";
import {
  deriveMirrorConsequenceDedupeKey,
  deriveMirrorConsequenceEntryId,
} from "../lib/epoch/journeyMirrorLedger.ts";
import {
  planJourneyRoleplayDoubt,
} from "../lib/epoch/journeyMirrorConsequenceBlueprints.ts";
import { DOUBT_PENALTY_BPS } from "../lib/epoch/journeyViabilityRules.ts";
import {
  deriveActionApproachTags,
} from "../lib/epoch/journeyGeneratedTaskRules.ts";

/**
 * PR5b tests for the roleplay-doubt mirror-ledger planner.
 *
 * These tests cover the LLM-free contract documented in the spec:
 *   - forbidden hit → severe doubt
 *   - major/minor deviation thresholds → high/moderate doubt
 *   - aligned action → no doubt entry (zero array)
 *   - same actionEventId + identity → same entryId (ledger idempotency)
 *   - unknown approachTag in observed → fail-closed (no spurious doubt)
 *   - empty pattern (unknown role bucket at issuance) → fail-open (no doubt)
 *   - empty observed (legacy action) → fail-open (no doubt)
 *   - reincarnation does not inherit the previous identity's pattern
 *
 * Plus the action-approach-tag derivation coverage for the
 * {@link deriveActionApproachTags} helper used at task-action build time.
 */

const IDENTITY_ID = "identity_alpha_001";
const AGENT_ID = IDENTITY_ID;
const JOURNEY_ID = "journey_001";
const EPISODE_ID = "episode_001";
const REGION_ID = "region_grey_harbor";
const ACTION_EVENT_ID = "evt_action_001";
const RECORDED_AT = "2026-07-25T12:00:00.000Z";

/**
 * Combat-bucket pattern: expected = [combat, scout, preservation],
 * forbidden = [diplomacy, support, logistics]. Built via the deterministic
 * rule template using a role token in the 猎手|安全|生态|采样 bucket.
 */
function combatBucketPattern(overrides: Partial<ExpectedLifePattern> = {}): ExpectedLifePattern {
  return {
    identityId: IDENTITY_ID,
    patternVersion: ROLEPLAY_PATTERN_VERSION,
    expectedApproaches: ["combat", "scout", "preservation"] as readonly ApproachTag[],
    forbiddenApproaches: ["diplomacy", "support", "logistics"] as readonly ApproachTag[],
    factionRoleNorms: {},
    inputHash: "sha256:test_combat_bucket" as const,
    frozenAt: RECORDED_AT,
    ...overrides,
  };
}

test("forbidden hit produces one severe identity_doubt entry", () => {
  // Observed contains 'diplomacy' which is forbidden → forbidden_action → severe.
  const entries = planJourneyRoleplayDoubt({
    pattern: combatBucketPattern(),
    observed: ["diplomacy"],
    agentId: AGENT_ID,
    journeyId: JOURNEY_ID,
    episodeId: EPISODE_ID,
    regionId: REGION_ID,
    actionEventId: ACTION_EVENT_ID,
    recordedAt: RECORDED_AT,
  });
  assert.equal(entries.length, 1);
  const entry = entries[0]!;
  assert.equal(entry.effectKind, "identity_doubt");
  assert.equal(entry.consequenceType, "collateral");
  assert.equal(entry.actionEventId, ACTION_EVENT_ID);
  assert.equal(entry.targetEntityId, `identity:${AGENT_ID}`);
  assert.equal(entry.effectBlueprint["doubtStrength"], "severe");
  assert.equal(entry.effectBlueprint["reason"], "roleplay_forbidden_action");
  // delta is the negative bps magnitude of a severe doubt.
  assert.equal(entry.delta, -DOUBT_PENALTY_BPS.severe);
  // approachTags are recorded as an observation copy in the blueprint.
  assert.deepEqual(entry.effectBlueprint["approachTags"], ["diplomacy"]);
});

test("major deviation (>50% expected missing) produces one high doubt", () => {
  // Combat pattern: expected = [combat, scout, preservation] (3 tags).
  // Observed = [combat] → missing 2/3 > 0.5 → major_deviation → high.
  const entries = planJourneyRoleplayDoubt({
    pattern: combatBucketPattern(),
    observed: ["combat"],
    agentId: AGENT_ID,
    journeyId: JOURNEY_ID,
    episodeId: EPISODE_ID,
    regionId: REGION_ID,
    actionEventId: ACTION_EVENT_ID,
    recordedAt: RECORDED_AT,
  });
  assert.equal(entries.length, 1);
  assert.equal(entries[0]!.effectBlueprint["doubtStrength"], "high");
  assert.equal(entries[0]!.delta, -DOUBT_PENALTY_BPS.high);
});

test("minor deviation (≤50% expected missing OR off-palette only) produces one moderate doubt", () => {
  // Combat pattern: expected = [combat, scout, preservation] (3 tags).
  // Observed = [combat, scout] → missing 1/3 ≤ 0.5 → minor_deviation → moderate.
  const entries = planJourneyRoleplayDoubt({
    pattern: combatBucketPattern(),
    observed: ["combat", "scout"],
    agentId: AGENT_ID,
    journeyId: JOURNEY_ID,
    episodeId: EPISODE_ID,
    regionId: REGION_ID,
    actionEventId: ACTION_EVENT_ID,
    recordedAt: RECORDED_AT,
  });
  assert.equal(entries.length, 1);
  assert.equal(entries[0]!.effectBlueprint["doubtStrength"], "moderate");
  assert.equal(entries[0]!.delta, -DOUBT_PENALTY_BPS.moderate);
});

test("aligned action (all expected, no forbidden, no off-palette) produces NO doubt entry", () => {
  // Observed = [combat, scout, preservation] → matches expected exactly → aligned.
  const entries = planJourneyRoleplayDoubt({
    pattern: combatBucketPattern(),
    observed: ["combat", "scout", "preservation"],
    agentId: AGENT_ID,
    journeyId: JOURNEY_ID,
    episodeId: EPISODE_ID,
    regionId: REGION_ID,
    actionEventId: ACTION_EVENT_ID,
    recordedAt: RECORDED_AT,
  });
  assert.equal(entries.length, 0);
});

test("same actionEventId + identityId → same ledger entryId (idempotent append)", () => {
  // This is the idempotency guarantee the mirror-ledger append relies on.
  // Calling planJourneyRoleplayDoubt twice with the same inputs MUST yield
  // byte-identical entries (same dedupeKey, same recordedAt, same effectBlueprint).
  const args = {
    pattern: combatBucketPattern(),
    observed: ["diplomacy"] as readonly ApproachTag[],
    agentId: AGENT_ID,
    journeyId: JOURNEY_ID,
    episodeId: EPISODE_ID,
    regionId: REGION_ID,
    actionEventId: ACTION_EVENT_ID,
    recordedAt: RECORDED_AT,
  } as const;
  const a = planJourneyRoleplayDoubt(args);
  const b = planJourneyRoleplayDoubt(args);
  assert.deepEqual(a, b);
  // The entryId the ledger will derive matches the blueprint's
  // mirrorLedgerEntryId field — proof that solidify-time promotion will
  // resolve the same id.
  const expectedEntryId = deriveMirrorConsequenceEntryId({
    journeyId: JOURNEY_ID,
    actionEventId: ACTION_EVENT_ID,
    dedupeKey: deriveMirrorConsequenceDedupeKey({
      effectKind: "identity_doubt",
      targetEntityId: `identity:${AGENT_ID}`,
      actionEventId: ACTION_EVENT_ID,
    }),
  });
  assert.equal(a[0]!.effectBlueprint["mirrorLedgerEntryId"], expectedEntryId);
  // doubtEventId is also deterministic (sha256 of actionEventId + identityId).
  assert.match(String(a[0]!.effectBlueprint["doubtEventId"]), /^doubt:[0-9a-f]{16}$/);
});

test("unknown approachTag in observed is fail-closed (no spurious offPalette / forbidden hit)", () => {
  // The fail-closed guarantee in compareApproachToLifePattern is that an
  // unknown tag is DROPPED — it contributes to neither hitsForbidden nor
  // offPalette. To prove this, observe ALL expected tags plus an unknown
  // string: the classification stays 'aligned' (no missing-expected, no
  // offPalette hit, no forbidden hit) so the hook emits zero entries. If the
  // unknown tag leaked into offPalette, the classification would upgrade to
  // minor_deviation and emit a doubt.
  const poisoned = [
    "combat",
    "scout",
    "preservation",
    "totally-fake-tag",
  ] as unknown as readonly ApproachTag[];
  const entries = planJourneyRoleplayDoubt({
    pattern: combatBucketPattern(),
    observed: poisoned,
    agentId: AGENT_ID,
    journeyId: JOURNEY_ID,
    episodeId: EPISODE_ID,
    regionId: REGION_ID,
    actionEventId: ACTION_EVENT_ID,
    recordedAt: RECORDED_AT,
  });
  assert.equal(entries.length, 0);
});

test("empty observed (legacy action without approachTags) → fail-open (no doubt)", () => {
  // Legacy actions pre-PR5b carry no approachTags. The hook MUST NOT
  // fabricate a doubt from an empty observation — that would surface every
  // legacy action as 'aligned but missing all expected' and inflate doubt.
  const entries = planJourneyRoleplayDoubt({
    pattern: combatBucketPattern(),
    observed: [],
    agentId: AGENT_ID,
    journeyId: JOURNEY_ID,
    episodeId: EPISODE_ID,
    regionId: REGION_ID,
    actionEventId: ACTION_EVENT_ID,
    recordedAt: RECORDED_AT,
  });
  assert.equal(entries.length, 0);
});

test("empty pattern (unknown role bucket at issuance) → fail-open (no doubt)", () => {
  // Identity was issued for a role token that fell outside all rule-template
  // buckets → expected=∅, forbidden=∅. The hook MUST NOT emit a doubt — the
  // identity has no norm to deviate from.
  const emptyPattern: ExpectedLifePattern = {
    identityId: IDENTITY_ID,
    patternVersion: ROLEPLAY_PATTERN_VERSION,
    expectedApproaches: [],
    forbiddenApproaches: [],
    factionRoleNorms: {},
    inputHash: "sha256:empty" as const,
    frozenAt: RECORDED_AT,
  };
  const entries = planJourneyRoleplayDoubt({
    pattern: emptyPattern,
    observed: ["combat"],
    agentId: AGENT_ID,
    journeyId: JOURNEY_ID,
    episodeId: EPISODE_ID,
    regionId: REGION_ID,
    actionEventId: ACTION_EVENT_ID,
    recordedAt: RECORDED_AT,
  });
  assert.equal(entries.length, 0);
});

test("reincarnation does not inherit the previous identity's pattern", () => {
  // buildExpectedLifePattern is the canonical reset point. The new identity
  // (nextAgentId, generation+1) produces a different inputHash by construction.
  // planJourneyReincarnationEvents uses this builder; this test pins the
  // contract at the planner level.
  const previous = buildExpectedLifePattern({
    identityId: "identity_old",
    identityName: "灰港·第一代猎手",
    explorerId: "explorer_001",
    generation: 1,
    personalityTraits: ["谨慎"],
    frozenAt: RECORDED_AT,
  });
  const next = buildExpectedLifePattern({
    identityId: "identity_new",
    identityName: "灰港·第二代猎手",
    explorerId: "explorer_001",
    generation: 2,
    personalityTraits: ["谨慎"],
    frozenAt: RECORDED_AT,
  });
  assert.notEqual(previous.identityId, next.identityId);
  assert.notEqual(previous.inputHash, next.inputHash);
  // Both patterns still obey the same role-bucket mapping (both are '猎手'
  // role → combat bucket) so the approach sets match — only the inputHash
  // differs, which is the audit signal that the patterns are distinct
  // issuances.
  assert.deepEqual([...next.expectedApproaches], [...previous.expectedApproaches]);
});

test("doubt reason is a fixed enumeration (never LLM text)", () => {
  // The blueprint's `reason` field is one of three fixed strings keyed by
  // classification. Asserting the closed set here documents the LLM-free
  // boundary for downstream canonical-event promotion.
  const reasons = new Set<string>();
  for (const classification of [
    "minor_deviation",
    "major_deviation",
    "forbidden_action",
  ] as readonly RoleplayDeviationClassification[]) {
    const strength = deviationClassificationToDoubtStrength(classification);
    const observed: ApproachTag[] = classification === "forbidden_action"
      ? ["diplomacy"] // hits forbidden
      : classification === "major_deviation"
        ? ["combat"] // missing 2/3 > 0.5
        : ["combat", "scout"]; // missing 1/3 ≤ 0.5
    const entries = planJourneyRoleplayDoubt({
      pattern: combatBucketPattern(),
      observed,
      agentId: AGENT_ID,
      journeyId: JOURNEY_ID,
      episodeId: EPISODE_ID,
      regionId: REGION_ID,
      actionEventId: `evt_${classification}`,
      recordedAt: RECORDED_AT,
    });
    assert.equal(entries.length, 1);
    assert.equal(entries[0]!.effectBlueprint["doubtStrength"], strength);
    reasons.add(String(entries[0]!.effectBlueprint["reason"]));
  }
  assert.deepEqual(
    [...reasons].sort(),
    ["roleplay_forbidden_action", "roleplay_major_deviation", "roleplay_minor_deviation"],
  );
});

test("npcId is region-scoped (stable observer per region)", () => {
  // v1 attributes roleplay doubt to a stable system observer per region so
  // viability doubtedBy aggregates cleanly. The id is namespaced
  // (`npc:roleplay:*`) to avoid colliding with catalog-NPC ids.
  const entries = planJourneyRoleplayDoubt({
    pattern: combatBucketPattern(),
    observed: ["diplomacy"],
    agentId: AGENT_ID,
    journeyId: JOURNEY_ID,
    episodeId: EPISODE_ID,
    regionId: REGION_ID,
    actionEventId: ACTION_EVENT_ID,
    recordedAt: RECORDED_AT,
  });
  assert.equal(entries[0]!.effectBlueprint["npcId"], `npc:roleplay:${REGION_ID}`);
});

test("faction id propagation: when factionId supplied, it lands on the blueprint", () => {
  const entries = planJourneyRoleplayDoubt({
    pattern: combatBucketPattern(),
    observed: ["diplomacy"],
    agentId: AGENT_ID,
    journeyId: JOURNEY_ID,
    episodeId: EPISODE_ID,
    regionId: REGION_ID,
    factionId: "faction_grey_council",
    actionEventId: ACTION_EVENT_ID,
    recordedAt: RECORDED_AT,
  });
  assert.equal(entries[0]!.effectBlueprint["factionId"], "faction_grey_council");
});

// ---------------------------------------------------------------------------
// deriveActionApproachTags coverage.
//
// The approach-tag derivation drives the roleplay comparator. These tests
// pin the v1 keyword + signal ordering so a future regex change is caught
// before it silently re-maps existing actions.
// ---------------------------------------------------------------------------

test("deriveActionApproachTags: combat keyword signal → ['combat']", () => {
  const tags = deriveActionApproachTags({
    actionLabel: "猎杀变异兽",
    actionIntent: "战斗并清除威胁",
    allowedEffectKinds: ["journey_progress"],
  });
  assert.deepEqual([...tags], ["combat"]);
});

test("deriveActionApproachTags: scout keyword signal OR discovery scene → ['scout']", () => {
  const tagsKeyword = deriveActionApproachTags({
    actionLabel: "勘探现场",
    actionIntent: "调查异常",
    allowedEffectKinds: ["clue_created"],
  });
  assert.deepEqual([...tagsKeyword], ["scout"]);
  const tagsScene = deriveActionApproachTags({
    actionLabel: "抵达现场",
    actionIntent: "查看情况",
    sceneType: "discovery",
    allowedEffectKinds: ["journey_progress"],
  });
  assert.deepEqual([...tagsScene], ["scout"]);
});

test("deriveActionApproachTags: support keyword signal wins first (escort/rescue)", () => {
  const tags = deriveActionApproachTags({
    actionLabel: "护送学者",
    actionIntent: "保护目标安全撤离",
    allowedEffectKinds: ["journey_progress"],
    sceneType: "conflict", // would otherwise map to combat
  });
  assert.deepEqual([...tags], ["support"]);
});

test("deriveActionApproachTags: faction route selection without diplomacy text → [] (v1 conservative)", () => {
  // PR5b v1 does NOT auto-derive 'diplomacy' from route selection alone.
  // Only explicit diplomacy text triggers the tag. This keeps generic
  // routing actions from inflating roleplay doubt against non-diplomacy
  // identities; the text-mining path is the single v1 signal.
  const tags = deriveActionApproachTags({
    actionLabel: "选择路线",
    actionIntent: "接受提案",
    allowedEffectKinds: ["journey_progress"],
    selectsRouteId: "route_direct",
    routeFactionObjectId: "faction_grey_council",
  });
  assert.deepEqual([...tags], []);
});

test("deriveActionApproachTags: diplomacy keyword → ['diplomacy']", () => {
  const tags = deriveActionApproachTags({
    actionLabel: "联络灰港议会",
    actionIntent: "外交斡旋以争取支持",
    allowedEffectKinds: ["relationship_signal"],
  });
  assert.deepEqual([...tags], ["diplomacy"]);
});

test("deriveActionApproachTags: no signal → empty array (legacy action, roleplay fail-open)", () => {
  const tags = deriveActionApproachTags({
    actionLabel: "查看",
    actionIntent: "观察",
    allowedEffectKinds: ["journey_progress"],
  });
  assert.deepEqual([...tags], []);
});

test("deriveActionApproachTags: output is gated by isApproachTag (defence-in-depth)", () => {
  // Every emitted tag MUST be a member of APPROACH_TAGS. The internal
  // filterTags helper enforces this even if the regex matches a non-tag
  // substring.
  const tags = deriveActionApproachTags({
    actionLabel: "战斗",
    actionIntent: "x",
    allowedEffectKinds: ["journey_progress"],
  });
  for (const tag of tags) {
    assert.ok((APPROACH_TAGS as readonly string[]).includes(tag));
  }
});

test("LLM-free contract: planJourneyRoleplayDoubt is pure (same inputs → same outputs)", () => {
  // Same inputs → same output including deterministically derived entryId
  // and doubtEventId. This is what the mirror-ledger append idempotency
  // relies on: a replayed action MUST produce the same composite key.
  const args = {
    pattern: combatBucketPattern(),
    observed: ["diplomacy", "support"] as readonly ApproachTag[],
    agentId: AGENT_ID,
    journeyId: JOURNEY_ID,
    episodeId: EPISODE_ID,
    regionId: REGION_ID,
    actionEventId: ACTION_EVENT_ID,
    recordedAt: RECORDED_AT,
  } as const;
  const a = planJourneyRoleplayDoubt(args);
  const b = planJourneyRoleplayDoubt(args);
  assert.deepEqual(a, b);
  // And the comparator + classifier agree on the classification that
  // produced the entry.
  const comparison = compareApproachToLifePattern(args.observed, args.pattern);
  const classification = classifyRoleplayDeviation(comparison, args.pattern);
  assert.equal(classification, "forbidden_action");
  assert.equal(
    a[0]!.effectBlueprint["doubtStrength"],
    deviationClassificationToDoubtStrength(classification),
  );
});

// ---------------------------------------------------------------------------
// PR5b fix: mission-sanctioned approach override (spec §6.9).
//
// When the caller supplies missionSanctionedApproaches (the union of
// approachTags across the current scene contract's actionOptions), and the
// action's observed tags are all members of that set, the action is
// mission-aligned and emits NO doubt entry. This is the principled fix for
// the regression where a combat-role identity on a support mission fires a
// severe doubt on every action because the pattern's static forbidden set
// cannot see the mission context.
// ---------------------------------------------------------------------------

test("mission-sanctioned override: combat identity on support mission emits NO doubt", () => {
  // Combat pattern: expected = [combat, scout, preservation],
  // forbidden = [diplomacy, support, logistics]. Observed = [support,
  // logistics] — both forbidden under the static pattern. WITHOUT the
  // override this would fire a severe doubt. WITH the override (mission
  // sanctioned support + logistics), the action is mission-aligned.
  const entries = planJourneyRoleplayDoubt({
    pattern: combatBucketPattern(),
    observed: ["support", "logistics"],
    missionSanctionedApproaches: ["support", "logistics"],
    agentId: AGENT_ID,
    journeyId: JOURNEY_ID,
    episodeId: EPISODE_ID,
    regionId: REGION_ID,
    actionEventId: ACTION_EVENT_ID,
    recordedAt: RECORDED_AT,
  });
  assert.equal(entries.length, 0);
});

test("mission-sanctioned override: partial overlap still classifies via static pattern", () => {
  // Observed = [support, stealth]. support is mission-sanctioned, stealth
  // is NOT. Because not every observed tag is sanctioned, the override
  // does NOT fire and the static-pattern classification runs. support hits
  // forbidden → forbidden_action → severe.
  const entries = planJourneyRoleplayDoubt({
    pattern: combatBucketPattern(),
    observed: ["support", "stealth"],
    missionSanctionedApproaches: ["support", "logistics"],
    agentId: AGENT_ID,
    journeyId: JOURNEY_ID,
    episodeId: EPISODE_ID,
    regionId: REGION_ID,
    actionEventId: ACTION_EVENT_ID,
    recordedAt: RECORDED_AT,
  });
  assert.equal(entries.length, 1);
  assert.equal(entries[0]!.effectBlueprint["doubtStrength"], "severe");
});

test("mission-sanctioned override: empty sanctioned set falls back to static pattern", () => {
  // Empty missionSanctionedApproaches must NOT trigger the override (the
  // planner guards on length > 0). The static-pattern classification runs.
  const entries = planJourneyRoleplayDoubt({
    pattern: combatBucketPattern(),
    observed: ["diplomacy"],
    missionSanctionedApproaches: [],
    agentId: AGENT_ID,
    journeyId: JOURNEY_ID,
    episodeId: EPISODE_ID,
    regionId: REGION_ID,
    actionEventId: ACTION_EVENT_ID,
    recordedAt: RECORDED_AT,
  });
  assert.equal(entries.length, 1);
  assert.equal(entries[0]!.effectBlueprint["doubtStrength"], "severe");
});

test("mission-sanctioned override: omitted field preserves legacy contract", () => {
  // When missionSanctionedApproaches is omitted entirely, the planner
  // behaves identically to the pre-override contract. This is the legacy
  // / unit-test path.
  const entries = planJourneyRoleplayDoubt({
    pattern: combatBucketPattern(),
    observed: ["support"],
    agentId: AGENT_ID,
    journeyId: JOURNEY_ID,
    episodeId: EPISODE_ID,
    regionId: REGION_ID,
    actionEventId: ACTION_EVENT_ID,
    recordedAt: RECORDED_AT,
  });
  assert.equal(entries.length, 1);
  assert.equal(entries[0]!.effectBlueprint["doubtStrength"], "severe");
});

test("mission-sanctioned override is pure (same inputs → same outputs)", () => {
  const args = {
    pattern: combatBucketPattern(),
    observed: ["support", "logistics"] as readonly ApproachTag[],
    missionSanctionedApproaches: ["support", "logistics"] as readonly ApproachTag[],
    agentId: AGENT_ID,
    journeyId: JOURNEY_ID,
    episodeId: EPISODE_ID,
    regionId: REGION_ID,
    actionEventId: ACTION_EVENT_ID,
    recordedAt: RECORDED_AT,
  } as const;
  const a = planJourneyRoleplayDoubt(args);
  const b = planJourneyRoleplayDoubt(args);
  assert.deepEqual(a, b);
  assert.equal(a.length, 0);
});

// ---------------------------------------------------------------------------
// PR5b conservative-rollout production contract:
// In v1, gameCore.submitHostedAction derives `missionSanctionedApproaches`
// as the UNION of approachTags across every actionOption the scene contract
// offers (see collectSceneMissionSanctionedApproaches). By construction, a
// server-offered action's tags are a SUBSET of this union, so the override
// fires and every offered action emits 0 doubt. The roleplay-doubt hook is
// therefore effectively inert for normal v1 play; doubt only fires for
// future non-offered actions whose tags fall outside the offered palette.
// This test pins the contract so a future loosening of the override
// regresses loudly.
// ---------------------------------------------------------------------------

test("production contract: every server-offered action emits 0 doubt (conservative rollout v1)", () => {
  // Simulate a scene contract whose actionOptions collectively offer a
  // palette of approach tags. Each entry's tags are server-derived at task
  // build time (see deriveActionApproachTags) — clients cannot mutate them.
  const offeredActions: readonly { readonly approachTags?: readonly ApproachTag[] }[] = [
    { approachTags: ["combat", "scout"] },
    { approachTags: ["support", "logistics"] },
    { approachTags: ["diplomacy"] },
  ];
  // Mirror gameCore.collectSceneMissionSanctionedApproaches: union across
  // options, filtered against APPROACH_TAGS, reordered canonically.
  const sanctioned = new Set<ApproachTag>();
  for (const option of offeredActions) {
    for (const tag of option.approachTags ?? []) sanctioned.add(tag);
  }
  const missionSanctionedApproaches = APPROACH_TAGS.filter((tag) => sanctioned.has(tag));

  // Combat-bucket pattern: expected = [combat, scout, preservation],
  // forbidden = [diplomacy, support, logistics]. Under the static pattern,
  // the support/logistics and diplomacy options would fire forbidden_action
  // → severe doubt. Under the production wiring, every offered action is
  // mission-aligned and emits 0 doubt.
  const pattern = combatBucketPattern();
  for (const option of offeredActions) {
    const observed = option.approachTags ?? [];
    const entries = planJourneyRoleplayDoubt({
      pattern,
      observed,
      missionSanctionedApproaches,
      agentId: AGENT_ID,
      journeyId: JOURNEY_ID,
      episodeId: EPISODE_ID,
      regionId: REGION_ID,
      actionEventId: `evt_offered_${observed.join("_")}`,
      recordedAt: RECORDED_AT,
    });
    assert.equal(
      entries.length,
      0,
      `offered action with tags [${observed.join(", ")}] must emit 0 doubt under the production wiring`,
    );
  }
});
