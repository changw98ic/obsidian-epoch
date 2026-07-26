/**
 * journeyRoleplayRules.ts — PR1 pure type freeze.
 *
 * Defines the server-authoritative "expected life pattern" contract issued at
 * identity issuance, the NPC doubt events recorded against it during a mirror
 * journey, and the roleplay-deviation scoring + hidden-prerequisite link shape
 * used by settlement adjudication.
 *
 * PR1 scope: signatures only. No runtime logic is added or modified here; the
 * only runtime value is the frozen {@link ROLEPLAY_PATTERN_VERSION} constant.
 * Every persisted field is `readonly` and new optional fields are added with
 * `?` so existing construction sites do not break.
 *
 * Zero-bonus boundary: every type in this file is INTERNAL (server-issued
 * pattern, mirror-ledger doubt, scoring result, hidden-objective adjudication).
 * None of them is a Public client offer type (cf. PublicQuestOffer /
 * PublicActionOption), and accordingly none carries the public-leak fields
 * `taskFamilyId` / `strategyAffinity` / `fitBps` / `expectedApproach` (singular)
 * / bonus markers. The plural `expectedApproaches` / `forbiddenApproaches`
 * fields below are the server-owned roleplay norm and live exclusively on
 * Internal identity-payload types.
 */

import { createHash } from "node:crypto";

import {
  APPROACH_TAGS,
  type ApproachTag,
  type IdentityStrategyDisposition,
  type Strategy,
} from "./journeyStrategyRules.ts";
import { extractOriginUnitRole } from "./identityNameTokens.ts";
import { DOUBT_PENALTY_BPS } from "./journeyViabilityRules.ts";

/**
 * Schema version for the roleplay-pattern contract.
 *
 * Gates the persisted shape of {@link ExpectedLifePattern}, {@link RoleplayScore},
 * and {@link NpcDoubtEvent}. Persisted with the identity payload so a future
 * bump can be detected and the identity re-issued rather than silently
 * mis-scored against an obsolete template.
 */
export const ROLEPLAY_PATTERN_VERSION = 1 as const;

/**
 * Severity of a single NPC doubt observation recorded during a mirror journey.
 *
 * Ordered low < moderate < high < severe. Aggregated into
 * {@link RoleplayScore.deviationBps} by the scoring pass; never persisted to
 * the canonical world on its own — it lives in the mirror ledger until the
 * journey solidifies.
 */
export type DoubtStrength = "low" | "moderate" | "high" | "severe";

/**
 * Server-frozen roleplay norm for a single faction context.
 *
 * `expectedApproaches` / `forbiddenApproaches` constrain the same
 * {@link ApproachTag} space used by strategy adjudication. `toleranceBps`
 * is the per-faction leeway (in basis points, 0–10000) before a deviation
 * upgrades to the next {@link RoleplayDeviationClassification}.
 */
export interface RoleNorm {
  readonly factionId: string;
  readonly expectedApproaches: readonly ApproachTag[];
  readonly forbiddenApproaches: readonly ApproachTag[];
  readonly toleranceBps: number;
}

/**
 * Server-issued, immutable "expected life pattern" bound to one identity.
 *
 * Issued at identity issuance from the identity inputs (race / role / unit /
 * faction / background / lifeGoal / needs / personalityTraits). The first
 * version is produced by a deterministic rule template; server AI may only
 * enrich descriptive text/tags on top — it must never mutate the frozen
 * pattern fields. Carried on the identity payload and read by every
 * roleplay-scoring pass for that identity's lifetime.
 *
 * `patternVersion` ties this instance to {@link ROLEPLAY_PATTERN_VERSION} so an
 * obsolete pattern can be detected and re-issued rather than mis-scored.
 * `inputHash` is the `sha256:` of the deterministic input bundle that produced
 * this pattern, for audit and replay verification.
 */
export interface ExpectedLifePattern {
  readonly identityId: string;
  readonly patternVersion: typeof ROLEPLAY_PATTERN_VERSION;
  /** Server-owned roleplay norm; the plural form is distinct from the public `expectedApproach` bonus marker. */
  readonly expectedApproaches: readonly ApproachTag[];
  readonly forbiddenApproaches: readonly ApproachTag[];
  readonly factionRoleNorms: Readonly<Record<string, RoleNorm>>;
  readonly inputHash: `sha256:${string}`;
  readonly frozenAt: string;
}

/**
 * One NPC doubt observation recorded against an identity's expected pattern.
 *
 * The observation lives in the mirror ledger (`mirrorLedgerEntryId`) and is
 * promoted to the canonical world only when (and if) the journey solidifies.
 * `sourceActionEventId` ties the doubt to the concrete action that triggered
 * it, enabling replay and audit.
 */
export interface NpcDoubtEvent {
  readonly doubtEventId: string;
  readonly journeyId: string;
  readonly identityId: string;
  readonly npcId: string;
  readonly factionId?: string;
  readonly regionId: string;
  readonly doubtStrength: DoubtStrength;
  readonly sourceActionEventId: string;
  readonly reason: string;
  /** Mirror-ledger entry that owns this doubt until solidify; canonical only after solidify. */
  readonly mirrorLedgerEntryId: string;
  readonly recordedAt: string;
}

/**
 * Discrete classification of how far an observed action sequence deviated from
 * the {@link ExpectedLifePattern}. Ordered worst → best as:
 * `forbidden_action` > `major_deviation` > `minor_deviation` > `aligned`.
 *
 * Feeds both collateral sizing and {@link RoleplayScore.exposed}.
 */
export type RoleplayDeviationClassification =
  | "aligned"
  | "minor_deviation"
  | "major_deviation"
  | "forbidden_action";

/**
 * Roleplay-deviation score produced by the scoring pass for one journey.
 *
 * `deviationBps` is the aggregate basis-point penalty (0–10000; higher = worse
 * roleplay) that feeds collateral and `viability.doubtedBy`.
 * `npcDoubtEvents` are the observations that produced the score, in ledger
 * order. `exposed` marks whether the deviation crossed the threshold to
 * surface to the player / canon.
 *
 * Distinct from `journeyStoryReport.identityFidelityPercent`: the story report
 * is a narrative-side fidelity read for presentation; this score is the
 * adjudication-side penalty input to settlement. The two must NOT be merged.
 */
export interface RoleplayScore {
  /** Higher = worse roleplay; feeds collateral + viability.doubtedBy. */
  readonly deviationBps: number;
  readonly classification: RoleplayDeviationClassification;
  readonly npcDoubtEvents: readonly NpcDoubtEvent[];
  readonly exposed: boolean;
  readonly patternVersion: typeof ROLEPLAY_PATTERN_VERSION;
  readonly computedAt: string;
}

/**
 * Lifecycle status of a hidden prerequisite object that an unrevealed
 * objective depends on.
 *
 * `intact` = untouched. `degraded` = partially compromised but still usable.
 * `destroyed` = irreversibly removed (first version: destruction is
 * irreversible — there is no `repaired` state yet).
 */
export type HiddenPrerequisiteStatus = "intact" | "destroyed" | "degraded";

/**
 * Adjudication link between a hidden objective and a prerequisite world object
 * whose status affects whether that objective can still be revealed/completed.
 *
 * Persists into the canonical world on solidify; future journeys read these
 * links for hidden-objective adjudication. In the first version, destruction
 * is irreversible — once `status === "destroyed"`, no later journey can
 * restore the prerequisite.
 */
export interface HiddenPrerequisiteLink {
  /** Hidden objective whose availability depends on this prerequisite. */
  readonly objectiveId: string;
  readonly prerequisiteObjectId: string;
  readonly status: HiddenPrerequisiteStatus;
  readonly destroyedAtActionEventId?: string;
  readonly degradedAtActionEventId?: string;
  /** Ledger entry that observed the status change; canonical only after solidify. */
  readonly sourceLedgerEntryId?: string;
  readonly observedAt: string;
}

// ---------------------------------------------------------------------------
// PR5b — first-version roleplay-deviation algorithm.
//
// The shapes above are locked by PR1. PR5b attaches the first runtime
// interpretation: a deterministic rule template that issues an
// {@link ExpectedLifePattern} at identity-issuance time, a pure set-based
// deviation comparator that classifies observed approach tags against the
// frozen pattern, and an aggregator that reduces a journey's promoted doubt
// entries into a {@link RoleplayScore} for collateral sizing and
// viability doubtedBy aggregation.
//
// LLM-free contract (spec §6.9): every function below is pure rule logic.
// No LLM call decides whether a doubt fires, what strength it carries, or
// what score it aggregates to. Server AI may only enrich descriptive
// text/tags on top of the frozen pattern (PR10); it must never mutate the
// frozen approach sets, the deviation classification, or the doubt
// strength mapping. Any change to a constant below MUST bump
// {@link ROLEPLAY_PATTERN_VERSION} (and, where noted,
// {@link VIABILITY_POLICY_VERSION} in journeyViabilityRules).
// ---------------------------------------------------------------------------

/**
 * First-version basis-point penalty per {@link RoleplayDeviationClassification}.
 * The values mirror {@link DOUBT_PENALTY_BPS} in journeyViabilityRules exactly
 * (aligned → 0 / minor → 750 / major → 2_000 / forbidden → 4_000) so that
 * collateral (which reads mirror-ledger identity_doubt entries via
 * {@link roleplayScoreFromLedger}) and viability (which aggregates the same
 * entries into doubtedBy) use the SAME ruler.
 *
 * Bumping this table MUST bump BOTH {@link ROLEPLAY_PATTERN_VERSION} (the
 * pattern bytes change for every identity) AND {@link VIABILITY_POLICY_VERSION}
 * in journeyViabilityRules (the doubt aggregation changes). The two version
 * bumps must land together.
 */
export const DEVIATION_BPS_BY_CLASSIFICATION: Readonly<
  Record<RoleplayDeviationClassification, number>
> = Object.freeze({
  aligned: 0,
  minor_deviation: DOUBT_PENALTY_BPS.moderate,
  major_deviation: DOUBT_PENALTY_BPS.high,
  forbidden_action: DOUBT_PENALTY_BPS.severe,
});

/**
 * First-version classification → doubt strength mapping. Single source for
 * "how bad was this deviation" → {@link DoubtStrength}, used by
 * {@link buildNpcIdentityDoubtEvent}. The 'aligned' case never produces a
 * doubt event (callers MUST skip), so its 'low' entry is a sentinel that
 * exists only to keep the record exhaustive; {@link buildNpcIdentityDoubtEvent}
 * refuses to emit a doubt with strength 'low'.
 *
 * Bumping this map (e.g. downgrading forbidden_action from 'severe' to
 * 'high') MUST bump {@link ROLEPLAY_PATTERN_VERSION} and re-issue every
 * identity's pattern.
 */
export const DEVIATION_CLASSIFICATION_TO_DOUBT_STRENGTH: Readonly<
  Record<RoleplayDeviationClassification, DoubtStrength>
> = Object.freeze({
  aligned: "low",
  minor_deviation: "moderate",
  major_deviation: "high",
  forbidden_action: "severe",
});

/**
 * First-version strategy → approach tag map. Used by the roleplay-rule
 * template to fold {@link IdentityStrategyDisposition.primary} into the
 * frozen expectedApproaches set. Every member of {@link Strategy} has an
 * entry; if a new strategy is added without an entry, the rule template
 * silently drops it from the expectedApproaches computation (defensive
 * default). Bumping this map MUST bump {@link ROLEPLAY_PATTERN_VERSION}.
 */
const STRATEGY_TO_APPROACH_TAG: Readonly<Record<Strategy, ApproachTag>> = Object.freeze({
  combat: "combat",
  cunning: "stealth",
  support: "support",
  logistics: "logistics",
  exploration: "scout",
});

/**
 * Result of {@link compareApproachToLifePattern}. Three disjoint subsets of
 * the observed approach-tag set against the frozen
 * {@link ExpectedLifePattern}:
 *  - hitsForbidden: observed tags the pattern forbids. Any non-empty hit
 *    here upgrades the deviation to 'forbidden_action'.
 *  - missingExpected: pattern-expected tags the action did not take. Drives
 *    the major/minor deviation threshold.
 *  - offPalette: observed tags that are neither expected nor forbidden.
 *    Tolerated as 'minor_deviation' (spec §6.9 tolerance band).
 *
 * Pure data; classification is the caller's responsibility
 * ({@link classifyRoleplayDeviation}).
 */
export interface RoleplayDeviationComparison {
  readonly hitsForbidden: readonly ApproachTag[];
  readonly missingExpected: readonly ApproachTag[];
  readonly offPalette: readonly ApproachTag[];
}

/**
 * Input shape for {@link buildExpectedLifePattern}. Every field is derived
 * from already-settled identity state at issuance time.
 *
 * `identityName` is the human-readable name runtime's
 * `systemAssignedIdentityName` produced; the pattern generator does NOT
 * re-derive it from origin/unit/role, it only re-derives the tokens (via
 * {@link extractOriginUnitRole}) to feed the rule template. If the caller
 * hands a mismatched identityName ↔ (explorerId, generation) pair, the
 * pattern is still internally consistent (tokens drive the rules, the name
 * is only audit text in inputHash) — but audit can flag the divergence
 * via inputHash replay.
 *
 * `personalityTraits` / `needs` / `lifeGoal` are recorded into the inputHash
 * bundle for future audit/enrichment but do NOT modify the frozen approach
 * sets in v1. Server AI text/tag enrichment is PR10.
 */
export interface BuildExpectedLifePatternInput {
  readonly identityId: string;
  readonly identityName: string;
  readonly explorerId: string;
  readonly generation: number;
  readonly personalityTraits: readonly string[];
  readonly needs?: readonly string[];
  readonly lifeGoal?: string;
  readonly strategyDisposition?: IdentityStrategyDisposition;
  readonly frozenAt: string;
}

/**
 * Input shape for {@link buildNpcIdentityDoubtEvent}. The `doubtEventId` is
 * DERIVED from `(sourceActionEventId, identityId)` — callers MUST NOT pass
 * it. The derivation is deterministic so replaying the same action against
 * the same identity always yields the same doubtEventId, which is what the
 * mirror-ledger append idempotency relies on (one doubt per
 * actionEventId+identity).
 */
export interface BuildNpcIdentityDoubtEventInput {
  readonly journeyId: string;
  readonly identityId: string;
  readonly npcId: string;
  readonly regionId: string;
  readonly doubtStrength: DoubtStrength;
  readonly sourceActionEventId: string;
  /** Fixed server-template reason (e.g. `roleplay_forbidden:combat`); never LLM text. */
  readonly reason: string;
  readonly factionId?: string;
  readonly mirrorLedgerEntryId: string;
  readonly recordedAt: string;
}

/**
 * Deterministic canonical JSON for inputHash. Sorts object keys recursively
 * and drops `undefined` fields so the hash is stable across map-iteration
 * orders and across runtimes that differ on `undefined` serialisation.
 *
 * Pure: same inputs → same output. No IO.
 */
function canonicalJson(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  if (typeof value === "object") {
    const record = value as Readonly<Record<string, unknown>>;
    const keys = Object.keys(record).sort();
    return `{${keys
      .filter((k) => record[k] !== undefined)
      .map((k) => `${JSON.stringify(k)}:${canonicalJson(record[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

/**
 * First-version deterministic rule template. Maps the role token (the
 * occupational suffix baked into every system identity name) plus the
 * optional strategy-primary into the (expectedApproaches, forbiddenApproaches)
 * pair. Mapping skeleton from PR5b spec §6.9:
 *
 *  - combat/safety/ecology/sampling role bucket (substring match on the
 *    role token for `猎手` | `安全` | `生态` | `采样`) →
 *    expected = [combat, scout, preservation],
 *    forbidden = [diplomacy, logistics, support].
 *  - diplomacy/liaison/supply role bucket (`联络` | `补给`) →
 *    expected = [diplomacy, logistics, support],
 *    forbidden = [combat, stealth].
 *  - recon/sample role bucket (`勘探` | `样本`) →
 *    expected = [scout, logistics],
 *    forbidden = [combat, diplomacy].
 *  - Unknown role token → fail-closed: expected=∅, forbidden=∅. The pattern
 *    is still issued (with the recorded inputHash) so audit can surface the
 *    unknown-token case rather than silently fabricating a norm.
 *
 * `strategyDisposition.primary`, when it maps via
 * {@link STRATEGY_TO_APPROACH_TAG} to a known {@link ApproachTag}, is added
 * to expectedApproaches without extending forbiddenApproaches. Per spec §6.9
 * the role-bucket's authority over forbidden is preserved — a strategy
 * primary that conflicts with a forbidden tag is dropped (not added to
 * expected) to avoid a self-contradictory pattern that would surface every
 * aligned action as 'forbidden_action'.
 *
 * `personalityTraits` / `lifeGoal` / `needs` do NOT modify the frozen
 * approach sets in v1 — they ride along in the inputHash bundle for future
 * enrichment (PR10). The function signature accepts them so the caller
 * cannot forget to pass them, but the rule output ignores them.
 *
 * Pure: same inputs → same output. No IO, no LLM.
 */
function deriveRoleplayTagsFromTokens(input: {
  readonly role: string;
  readonly strategyPrimary?: Strategy;
}): { readonly expectedApproaches: readonly ApproachTag[]; readonly forbiddenApproaches: readonly ApproachTag[] } {
  const expected = new Set<ApproachTag>();
  const forbidden = new Set<ApproachTag>();

  if (
    input.role.includes("猎手")
    || input.role.includes("安全")
    || input.role.includes("生态")
    || input.role.includes("采样")
  ) {
    for (const tag of ["combat", "scout", "preservation"] as const) expected.add(tag);
    for (const tag of ["diplomacy", "logistics", "support"] as const) forbidden.add(tag);
  } else if (input.role.includes("联络") || input.role.includes("补给")) {
    for (const tag of ["diplomacy", "logistics", "support"] as const) expected.add(tag);
    for (const tag of ["combat", "stealth"] as const) forbidden.add(tag);
  } else if (input.role.includes("勘探") || input.role.includes("样本")) {
    for (const tag of ["scout", "logistics"] as const) expected.add(tag);
    for (const tag of ["combat", "diplomacy"] as const) forbidden.add(tag);
  }
  // else: unknown role token → fail-closed (expected=∅, forbidden=∅). The
  // pattern is still issued (with the recorded inputHash) so audit can
  // surface the unknown-token case rather than silently fabricating a norm.

  if (input.strategyPrimary !== undefined) {
    const primaryTag = STRATEGY_TO_APPROACH_TAG[input.strategyPrimary];
    if (primaryTag !== undefined && !forbidden.has(primaryTag)) {
      expected.add(primaryTag);
    }
  }

  // Reorder both sets against APPROACH_TAGS so the persisted arrays are
  // canonical and inputHash-stable regardless of the insertion order above.
  return {
    expectedApproaches: APPROACH_TAGS.filter((tag) => expected.has(tag)),
    forbiddenApproaches: APPROACH_TAGS.filter((tag) => forbidden.has(tag)),
  };
}

/**
 * Build an immutable {@link ExpectedLifePattern} for one identity at
 * issuance. Pure: same inputs → same output, including the deterministic
 * `inputHash`. No IO, no gameCore/eventFactory import. Replayable: the
 * inputHash pins the exact input bundle that produced this pattern.
 *
 * Reincarnation reset: callers MUST pass fresh (explorerId, generation,
 * identityName, identityId) for the new identity. The previous identity's
 * pattern is NOT inherited — by construction the new bundle hashes to a
 * different inputHash. Callers (identityLifecycleRules.
 * planIdentityReincarnationEvents) MUST NOT forward the previous identity's
 * pattern or doubtedBy; they re-call this builder.
 *
 * `factionRoleNorms` is `{}` in v1: faction/background are not grounded at
 * issuance time (factionStanding initialises empty — see
 * `initialIdentityViability`). PR10/planner enriches this map after the
 * identity joins a faction. The empty v1 shape is versioned: populating it
 * MUST bump {@link ROLEPLAY_PATTERN_VERSION}.
 */
export function buildExpectedLifePattern(
  input: BuildExpectedLifePatternInput,
): ExpectedLifePattern {
  if (!input.identityId) throw new Error("roleplay_pattern_empty_identity_id");
  if (!input.identityName) throw new Error("roleplay_pattern_empty_identity_name");
  if (!input.explorerId) throw new Error("roleplay_pattern_empty_explorer_id");
  if (!Number.isInteger(input.generation) || input.generation < 0) {
    throw new Error(`roleplay_pattern_invalid_generation:${String(input.generation)}`);
  }
  if (!input.frozenAt) throw new Error("roleplay_pattern_empty_frozen_at");

  const { origin, unit, role } = extractOriginUnitRole(input.explorerId, input.generation);
  const tags = deriveRoleplayTagsFromTokens({
    role,
    ...(input.strategyDisposition ? { strategyPrimary: input.strategyDisposition.primary } : {}),
  });

  const inputBundle = {
    patternVersion: ROLEPLAY_PATTERN_VERSION,
    identityId: input.identityId,
    identityName: input.identityName,
    explorerId: input.explorerId,
    generation: input.generation,
    origin,
    unit,
    role,
    personalityTraits: [...input.personalityTraits],
    ...(input.needs ? { needs: [...input.needs] } : {}),
    ...(input.lifeGoal !== undefined ? { lifeGoal: input.lifeGoal } : {}),
    ...(input.strategyDisposition
      ? {
          strategyDisposition: {
            primary: input.strategyDisposition.primary,
            ...(input.strategyDisposition.secondary !== undefined
              ? { secondary: input.strategyDisposition.secondary }
              : {}),
          },
        }
      : {}),
    frozenAt: input.frozenAt,
  };
  const inputHash = `sha256:${createHash("sha256").update(canonicalJson(inputBundle), "utf8").digest("hex")}` as const;

  return {
    identityId: input.identityId,
    patternVersion: ROLEPLAY_PATTERN_VERSION,
    expectedApproaches: tags.expectedApproaches,
    forbiddenApproaches: tags.forbiddenApproaches,
    factionRoleNorms: {},
    inputHash,
    frozenAt: input.frozenAt,
  };
}

/**
 * Compare observed action approach tags to the frozen pattern. Pure set
 * math on the {@link APPROACH_TAGS} universe. No IO, no LLM.
 *
 * Returns three disjoint subsets (see {@link RoleplayDeviationComparison}):
 * `hitsForbidden`, `missingExpected`, `offPalette`. Callers feed this into
 * {@link classifyRoleplayDeviation} for the discrete verdict.
 *
 * Unknown tags (strings outside {@link APPROACH_TAGS}) are ignored: the
 * function's input type is `readonly ApproachTag[]`, but defence-in-depth
 * filters anything that is not a member of APPROACH_TAGS so a caller that
 * forgot to gate via `isApproachTag` cannot corrupt the comparison. The
 * filtered-out tag contributes to neither hitsForbidden nor missingExpected
 * nor offPalette — i.e. fail-closed toward "no signal" rather than toward
 * "spurious deviation". (The roleplay hook upstream fails CLOSED at the
 * action level by skipping entirely when approachTags is missing/empty;
 * individual unknown tags inside a valid array are treated as transparent
 * because by the time we reach this function, approachTags has already
 * passed `verifyJourneySceneActionSignature` + `isApproachTag` gating.)
 */
export function compareApproachToLifePattern(
  observed: readonly ApproachTag[],
  pattern: ExpectedLifePattern,
): RoleplayDeviationComparison {
  const expectedSet = new Set(pattern.expectedApproaches);
  const forbiddenSet = new Set(pattern.forbiddenApproaches);
  const observedSet = new Set<ApproachTag>();
  for (const tag of observed) {
    // Defence-in-depth: drop anything outside APPROACH_TAGS. The persisted
    // arrays already only contain valid tags; this guard exists so a future
    // caller cannot break the comparator by feeding untrusted strings.
    if (isApproachTagMember(tag)) observedSet.add(tag);
  }

  const hitsForbidden = APPROACH_TAGS.filter((tag) => forbiddenSet.has(tag) && observedSet.has(tag));
  const missingExpected = APPROACH_TAGS.filter((tag) => expectedSet.has(tag) && !observedSet.has(tag));
  const offPalette = APPROACH_TAGS.filter(
    (tag) => observedSet.has(tag) && !expectedSet.has(tag) && !forbiddenSet.has(tag),
  );

  return { hitsForbidden, missingExpected, offPalette };
}

/**
 * Classify a comparison into the four-bucket deviation taxonomy. Pure,
 * deterministic; the thresholds are versioned via
 * {@link ROLEPLAY_PATTERN_VERSION}.
 *
 *  - `hitsForbidden.length > 0` → 'forbidden_action' (any forbidden hit is
 *    severe regardless of expected coverage).
 *  - else `missingExpected.length / max(1, expectedApproaches.length) > 0.5`
 *    → 'major_deviation'.
 *  - else `missingExpected.length > 0` → 'minor_deviation'.
 *  - else `offPalette.length > 0` → 'minor_deviation' (tolerance band).
 *  - else 'aligned'.
 *
 * Threshold is fixed at >0.5 (strict). Changing the threshold or its
 * strictness MUST bump {@link ROLEPLAY_PATTERN_VERSION}.
 */
export function classifyRoleplayDeviation(
  comparison: RoleplayDeviationComparison,
  pattern: ExpectedLifePattern,
): RoleplayDeviationClassification {
  if (comparison.hitsForbidden.length > 0) return "forbidden_action";
  const expectedCount = Math.max(1, pattern.expectedApproaches.length);
  const missingRatio = comparison.missingExpected.length / expectedCount;
  if (missingRatio > 0.5) return "major_deviation";
  if (comparison.missingExpected.length > 0) return "minor_deviation";
  if (comparison.offPalette.length > 0) return "minor_deviation";
  return "aligned";
}

/**
 * Map a classification to a {@link DoubtStrength} for the
 * {@link NpcDoubtEvent}. 'aligned' returns the 'low' sentinel — callers
 * MUST skip producing a doubt event when classification === 'aligned'
 * ({@link buildNpcIdentityDoubtEvent} enforces this by refusing to emit a
 * 'low'-strength doubt).
 *
 * Single source for "how strong a doubt does this classification produce";
 * bumping this map MUST bump {@link ROLEPLAY_PATTERN_VERSION}.
 */
export function deviationClassificationToDoubtStrength(
  classification: RoleplayDeviationClassification,
): DoubtStrength {
  return DEVIATION_CLASSIFICATION_TO_DOUBT_STRENGTH[classification];
}

/**
 * Inverse of {@link deviationClassificationToDoubtStrength} for the score
 * aggregation. Maps a {@link NpcDoubtEvent}'s doubtStrength back to the
 * classification that produced it, so {@link roleplayScoreFromLedger} can
 * take the worst classification across multiple events.
 *
 * 'low' (the sentinel for 'aligned') maps to 'aligned' so a stray low doubt
 * in the ledger does not contaminate the worst-classification read.
 */
export function doubtStrengthToClassification(
  strength: DoubtStrength,
): RoleplayDeviationClassification {
  switch (strength) {
    case "severe":
      return "forbidden_action";
    case "high":
      return "major_deviation";
    case "moderate":
      return "minor_deviation";
    case "low":
      return "aligned";
  }
}

/**
 * Basis-point contribution of one classification. Pure lookup into
 * {@link DEVIATION_BPS_BY_CLASSIFICATION}. Bumping the table MUST bump
 * BOTH {@link ROLEPLAY_PATTERN_VERSION} AND {@link VIABILITY_POLICY_VERSION}.
 */
export function classificationToDeviationBps(
  classification: RoleplayDeviationClassification,
): number {
  return DEVIATION_BPS_BY_CLASSIFICATION[classification];
}

/**
 * Build one {@link NpcDoubtEvent} from the deviation classification and
 * positional context. Pure: same inputs → same output, including the
 * deterministically-derived `doubtEventId`. No IO, no LLM.
 *
 * `doubtEventId` derivation: `doubt:${sha256(sourceActionEventId + identityId)[:16]}`.
 * This is the idempotency key the mirror ledger relies on — replaying the
 * same action against the same identity always yields the same id, so a
 * re-derivation never double-counts. The mirror-ledger entry id
 * (`mirrorLedgerEntryId`) is separately derived from
 * (journeyId, actionEventId, dedupeKey) by `deriveMirrorConsequenceEntryId`
 * — see journeyMirrorLedger.
 *
 * Refuses to emit a 'low'-strength doubt: 'low' is the sentinel for
 * 'aligned' actions, and aligned actions MUST NOT produce a doubt event
 * (no entry, no ledger write). Callers check classification BEFORE calling
 * this builder.
 */
export function buildNpcIdentityDoubtEvent(
  input: BuildNpcIdentityDoubtEventInput,
): NpcDoubtEvent {
  if (input.doubtStrength === "low") {
    // 'low' is the sentinel for 'aligned' in
    // DEVIATION_CLASSIFICATION_TO_DOUBT_STRENGTH. Aligned actions must not
    // produce a doubt event — fail loud so the caller fixes the upstream
    // classification check.
    throw new Error(
      `roleplay_doubt_aligned_must_not_produce_event:${input.sourceActionEventId}`,
    );
  }
  if (!input.sourceActionEventId) {
    throw new Error("roleplay_doubt_missing_action_event_id");
  }
  if (!input.identityId) {
    throw new Error("roleplay_doubt_missing_identity_id");
  }
  if (!input.mirrorLedgerEntryId) {
    throw new Error("roleplay_doubt_missing_mirror_ledger_entry_id");
  }
  const digest = createHash("sha256")
    .update(`${input.sourceActionEventId}${input.identityId}`, "utf8")
    .digest("hex")
    .slice(0, 16);
  const doubtEventId = `doubt:${digest}`;
  return {
    doubtEventId,
    journeyId: input.journeyId,
    identityId: input.identityId,
    npcId: input.npcId,
    ...(input.factionId ? { factionId: input.factionId } : {}),
    regionId: input.regionId,
    doubtStrength: input.doubtStrength,
    sourceActionEventId: input.sourceActionEventId,
    reason: input.reason,
    mirrorLedgerEntryId: input.mirrorLedgerEntryId,
    recordedAt: input.recordedAt,
  };
}

/**
 * Aggregate a journey's promoted doubt entries into a {@link RoleplayScore}.
 * Pure: same inputs → same output. No IO, no LLM.
 *
 *  - `deviationBps` = `clamp(sum(DOUBT_PENALTY_BPS[strength]), 0, 10_000)`.
 *    The table is owned by journeyViabilityRules; we import
 *    {@link DOUBT_PENALTY_BPS} so collateral (this score) and viability
 *    (doubtedBy aggregation) use the SAME ruler. Changing the table MUST
 *    bump BOTH {@link ROLEPLAY_PATTERN_VERSION} AND
 *    {@link VIABILITY_POLICY_VERSION}.
 *  - `classification` = worst classification across all entries (via
 *    {@link doubtStrengthToClassification}). Worst-order is
 *    forbidden_action > major_deviation > minor_deviation > aligned.
 *  - `npcDoubtEvents` = the entries in the order received (caller guarantees
 *    ledger order — listMirrorConsequences already sorts by
 *    recordedAt+entryId).
 *  - `exposed` = (deviationBps >= 4_000) OR any entry is 'severe'. Matches
 *    the journeyViabilityRules EXPOSED threshold (4_000 bps = severe) so
 *    the story report and the viability snapshot agree on "this identity
 *    is exposed".
 *  - `patternVersion` = {@link ROLEPLAY_PATTERN_VERSION}.
 *  - `computedAt` = `recordedAt`.
 *
 * RoleplayScore is distinct from `journeyStoryReport.identityFidelityPercent`:
 * the story report is a narrative-side read for presentation; this score is
 * the adjudication-side input to settlement. The two MUST NOT be merged
 * (spec §6.9, zero-bonus boundary).
 */
export function roleplayScoreFromLedger(
  promotedDoubtEntries: readonly NpcDoubtEvent[],
  recordedAt: string,
): RoleplayScore {
  let deviationBps = 0;
  let anySevere = false;
  let worstClassification: RoleplayDeviationClassification = "aligned";
  const classificationRank: Readonly<Record<RoleplayDeviationClassification, number>> = {
    aligned: 0,
    minor_deviation: 1,
    major_deviation: 2,
    forbidden_action: 3,
  };
  for (const entry of promotedDoubtEntries) {
    deviationBps += DOUBT_PENALTY_BPS[entry.doubtStrength];
    if (entry.doubtStrength === "severe") anySevere = true;
    const entryClassification = doubtStrengthToClassification(entry.doubtStrength);
    if (classificationRank[entryClassification] > classificationRank[worstClassification]) {
      worstClassification = entryClassification;
    }
  }
  if (!Number.isFinite(deviationBps)) deviationBps = 0;
  if (deviationBps > 10_000) deviationBps = 10_000;
  if (deviationBps < 0) deviationBps = 0;
  const exposed = deviationBps >= 4_000 || anySevere;
  return {
    deviationBps,
    classification: worstClassification,
    npcDoubtEvents: promotedDoubtEntries,
    exposed,
    patternVersion: ROLEPLAY_PATTERN_VERSION,
    computedAt: recordedAt,
  };
}

// ---------------------------------------------------------------------------
// Internal helpers (not exported).
// ---------------------------------------------------------------------------

/**
 * Inline membership check for {@link ApproachTag}. Used inside
 * {@link compareApproachToLifePattern} as defence-in-depth against a caller
 * that forgot to gate untrusted strings via `isApproachTag`. We do not
 * import `isApproachTag` here to keep the roleplay module's dependency
 * surface minimal (ApproachTag the type is fine; the runtime guard stays
 * the caller's responsibility at the public API boundary).
 */
function isApproachTagMember(value: unknown): value is ApproachTag {
  if (typeof value !== "string") return false;
  for (const tag of APPROACH_TAGS) {
    if (value === tag) return true;
  }
  return false;
}
