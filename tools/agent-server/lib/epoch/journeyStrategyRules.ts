/**
 * Journey strategy policy — type and constant freeze for PR1.
 *
 * This module is the single source of truth for the strategy taxonomy used by
 * the journey pipeline. It gates:
 *   - the canonical {@link STRATEGIES} and {@link APPROACH_TAGS} enums,
 *   - the {@link StrategyProfile} / {@link IdentityStrategyDisposition}
 *     records persisted alongside an identity, and
 *   - the {@link StrategyConsistencyScore} audit artifact.
 *
 * Hard contract (frozen for PR1):
 *   1. Zero affinity bonus. {@link StrategyConsistencyScore} is AUDIT ONLY.
 *      It MUST NOT be consumed as input by any ConsequenceScore, SettlementDecision,
 *      reward, or viability computation. There is deliberately no `fitBps`,
 *      `strategyAffinity`, `taskFamilyId`, or `expectedApproach` field anywhere
 *      in this file.
 *   2. {@link AFFINITY_MATRIX_VERSION} is carried ONLY on
 *      {@link IdentityStrategyDisposition} for audit replay. It MUST NOT enter
 *      any score type or any Public (client-facing) type.
 *   3. Unknown {@link ApproachTag} values MUST fail closed via {@link isApproachTag}.
 *      Untrusted clients cannot introduce new tags.
 *
 * PR1 is a pure type freeze: only types, constants, and the minimal fail-closed
 * type guard are exported. No existing runtime logic is touched.
 */

/**
 * Schema version for every type in this module whose shape is part of a
 * persisted record or signed audit artifact:
 * {@link Strategy}, {@link ApproachTag}, {@link StrategyProfile},
 * {@link IdentityStrategyDisposition}, {@link StrategyConsistencyScore}.
 *
 * Bumping this constant MUST accompany a migration for any persisted payload
 * that carries `policyVersion` / `strategyPolicyVersion` / `snapshotVersion`.
 */
export const STRATEGY_POLICY_VERSION = 1 as const;

/**
 * Audit-only version of the internal strategy-affinity matrix. Carried on
 * {@link IdentityStrategyDisposition} so a historical disposition can be
 * replayed against the matrix it was frozen with.
 *
 * Hard rule: this constant MUST NOT appear on any score type, reward, or
 * Public (client-facing) shape. It lives on {@link IdentityStrategyDisposition}
 * and nowhere else in this file.
 */
export const AFFINITY_MATRIX_VERSION = 1 as const;

/**
 * Canonical, server-authoritative strategy taxonomy. Order is stable and
 * semantically meaningful (primary-secondary affinity lookups rely on it).
 * Adding a new strategy requires bumping {@link STRATEGY_POLICY_VERSION}.
 */
export const STRATEGIES = [
  "combat",
  "cunning",
  "support",
  "logistics",
  "exploration",
] as const;

/** One of {@link STRATEGIES}. */
export type Strategy = (typeof STRATEGIES)[number];

/**
 * Canonical set of approach tags an offer/plan/action can carry. These are
 * the only values an untrusted client is permitted to send; anything else
 * MUST be rejected by {@link isApproachTag} (fail closed).
 *
 * Adding a new tag requires bumping {@link STRATEGY_POLICY_VERSION}.
 */
export const APPROACH_TAGS = [
  "combat",
  "stealth",
  "diplomacy",
  "support",
  "logistics",
  "scout",
  "preservation",
] as const;

/**
 * One of {@link APPROACH_TAGS}. Unknown values MUST fail closed: use
 * {@link isApproachTag} to validate untrusted input before narrowing.
 */
export type ApproachTag = (typeof APPROACH_TAGS)[number];

/**
 * Fail-closed type guard for {@link ApproachTag}. Returns `false` for any
 * value not in {@link APPROACH_TAGS} — including look-alike strings from an
 * untrusted client. Callers MUST treat a `false` result as a hard rejection,
 * never as a fallback to a default tag.
 */
export function isApproachTag(value: unknown): value is ApproachTag {
  if (typeof value !== "string") return false;
  for (const tag of APPROACH_TAGS) {
    if (value === tag) return true;
  }
  return false;
}

/**
 * Fail-closed type guard for {@link Strategy}. Returns `false` for any value
 * not in {@link STRATEGIES}. Callers MUST treat a `false` result as a hard
 * rejection of the untrusted input.
 */
export function isStrategy(value: unknown): value is Strategy {
  if (typeof value !== "string") return false;
  for (const strategy of STRATEGIES) {
    if (value === strategy) return true;
  }
  return false;
}

/**
 * A settled strategy pair for a journey or proposal. Persisted on the journey
 * record; `secondary` is optional because not every journey has a meaningful
 * secondary posture.
 *
 * `policyVersion` MUST equal {@link STRATEGY_POLICY_VERSION} at write time;
 * readers MUST reject records that carry a foreign version.
 */
export interface StrategyProfile {
  readonly primary: Strategy;
  readonly secondary?: Strategy;
  readonly settledAt: string;
  readonly policyVersion: typeof STRATEGY_POLICY_VERSION;
}

/**
 * Strategy disposition frozen onto an identity. The identity layer carries
 * this so the journey pipeline can ground offers/plans in a stable primary
 * posture across journeys without re-deriving it from client input.
 *
 * Both {@link STRATEGY_POLICY_VERSION} and {@link AFFINITY_MATRIX_VERSION}
 * are persisted for replay determinism: a historical disposition MUST be
 * interpreted under the same policy and matrix that produced it.
 */
export interface IdentityStrategyDisposition {
  readonly identityId: string;
  readonly primary: Strategy;
  readonly secondary?: Strategy;
  readonly frozenAt: string;
  readonly strategyPolicyVersion: typeof STRATEGY_POLICY_VERSION;
  readonly affinityMatrixVersion: typeof AFFINITY_MATRIX_VERSION;
}

/**
 * Classification of how an observed set of approach tags relates to the
 * frozen {@link IdentityStrategyDisposition}. The `kind` discriminator drives
 * the weight split used by the (audit-only) consistency score.
 *
 * - `normal` — the primary posture is honored; secondary gets zero weight.
 * - `fully_violates` — the primary posture is fully violated by the observed
 *   approaches; the journey's classification is frozen at this value for its
 *   whole lifetime.
 *
 * The bps fields are fixed per `kind`; they are NOT tunable inputs. Changing
 * them requires bumping {@link STRATEGY_POLICY_VERSION}.
 */
export type PrimaryViolationClassification =
  | {
      readonly kind: "normal";
      readonly primaryWeightBps: 10000;
      readonly secondaryWeightBps: 0;
    }
  | {
      readonly kind: "fully_violates";
      readonly primaryWeightBps: 3000;
      readonly secondaryWeightBps: 7000;
    };

/** Provenance of an {@link ApproachSnapshotEntry}: which pipeline stage recorded it. */
export type ApproachSnapshotSource = "offer" | "plan" | "action";

/**
 * One observed approach-tag set, recorded at a specific pipeline stage.
 * `sourceId` references the offer/plan/action event that produced the entry
 * and is used for replay and audit correlation only.
 */
export interface ApproachSnapshotEntry {
  readonly source: ApproachSnapshotSource;
  readonly sourceId: string;
  readonly approachTags: readonly ApproachTag[];
  readonly recordedAt: string;
}

/**
 * Ordered log of approach-tag observations for a single journey. The order
 * is preserved across the offer → plan → action lifecycle so auditors can
 * reconstruct when the agent's posture shifted.
 *
 * `snapshotVersion` MUST equal {@link STRATEGY_POLICY_VERSION}.
 */
export interface ApproachSnapshot {
  readonly journeyId: string;
  readonly entries: readonly ApproachSnapshotEntry[];
  readonly snapshotVersion: typeof STRATEGY_POLICY_VERSION;
}

/**
 * Audit-only strategy consistency score. Produced from an
 * {@link ApproachSnapshot} and the journey's frozen strategy profile; it
 * describes how well the observed approaches matched the declared primary
 * posture over the lifetime of the journey.
 *
 * HARD ZERO-BONUS CONTRACT. This type MUST NOT be consumed as input by:
 *   - {@link ConsequenceScore} / ConsequenceBreakdown,
 *   - {@link SettlementDecision} / {@link WorldCommitDecision} / RewardGrant,
 *   - any viability, reward, or mirror-commit computation.
 *
 * There is deliberately no `fitBps`, `strategyAffinity`, `taskFamilyId`, or
 * `expectedApproach` field on this type or on any Public (client-facing)
 * type in this module. `matchBps` is the audit number; it never becomes a
 * reward multiplier.
 */
export interface StrategyConsistencyScore {
  /** 0-10000 match band. Audit-only — never an input to settlement or reward. */
  readonly matchBps: number;
  readonly snapshot: ApproachSnapshot;
  readonly classification: PrimaryViolationClassification;
  readonly strategyPolicyVersion: typeof STRATEGY_POLICY_VERSION;
  readonly computedAt: string;
}

// ─── PR6: Strategy consistency runtime ───────────────────────────────────────

/**
 * Frozen snapshot of a journey's strategy disposition. Created at journey start
 * from the identity's {@link IdentityStrategyDisposition} and immutable for the
 * journey's lifetime. Carries `dispositionRef` (the identityId) for audit
 * traceability.
 */
export interface JourneyStrategySnapshot {
  readonly journeyId: string;
  readonly primary: Strategy;
  readonly secondary?: Strategy;
  readonly frozenAt: string;
  /** IdentityId whose disposition this snapshot was derived from. */
  readonly dispositionRef: string;
  readonly snapshotVersion: typeof STRATEGY_POLICY_VERSION;
}

/**
 * Internal affinity matrix: approachTag × strategy → raw affinity score.
 *
 * Values:
 *   100 = bonus  (approach naturally aligns with strategy)
 *    50 = neutral (approach is compatible but not a signature move)
 *     0 = penalty (approach contradicts the strategy)
 *
 * Used by {@link scoreStrategyConsistency} and {@link classifyPrimaryViolation}.
 * AUDIT-ONLY: these values MUST NOT enter ConsequenceScore, SettlementDecision,
 * reward, or viability computations.
 *
 * Known risk (spec §14): logistics has 5 non-penalty entries (1 bonus + 4 neutral),
 * giving it broader tolerance than other strategies. Balance validation deferred
 * to Step 16.
 */
export const AFFINITY_MATRIX: Readonly<Record<ApproachTag, Readonly<Record<Strategy, number>>>> =
  Object.freeze({
    combat:       Object.freeze({ combat: 100, cunning: 0,   support: 0,   logistics: 50, exploration: 50 }),
    stealth:      Object.freeze({ combat: 0,   cunning: 100, support: 50,  logistics: 0,  exploration: 50 }),
    diplomacy:    Object.freeze({ combat: 50,  cunning: 50,  support: 50,  logistics: 50, exploration: 0 }),
    support:      Object.freeze({ combat: 0,   cunning: 0,   support: 100, logistics: 50, exploration: 0 }),
    logistics:    Object.freeze({ combat: 50,  cunning: 0,   support: 50,  logistics: 100, exploration: 0 }),
    scout:        Object.freeze({ combat: 50,  cunning: 50,  support: 0,   logistics: 0,  exploration: 100 }),
    preservation: Object.freeze({ combat: 0,   cunning: 0,   support: 50,  logistics: 50, exploration: 50 }),
  });

/**
 * Clamp a number to the 0-10000 basis-point range. Local to this module;
 * not exported (same contract as journeyViabilityRules.clampBps).
 */
function clampBps(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(10_000, Math.round(value)));
}

/**
 * PR6: Freeze an identity's strategy disposition from mandate/policy inputs.
 * Pure: same inputs → same output. The returned object is immutable and carries
 * both {@link STRATEGY_POLICY_VERSION} and {@link AFFINITY_MATRIX_VERSION} for
 * replay determinism.
 */
export function freezeIdentityStrategyDisposition(
  identityId: string,
  primary: Strategy,
  secondary: Strategy | undefined,
  frozenAt: string,
): IdentityStrategyDisposition {
  return {
    identityId,
    primary,
    secondary,
    frozenAt,
    strategyPolicyVersion: STRATEGY_POLICY_VERSION,
    affinityMatrixVersion: AFFINITY_MATRIX_VERSION,
  };
}

/**
 * PR6: Create a frozen journey strategy snapshot from an identity's disposition.
 * Called once at journey start; the snapshot is immutable for the journey's
 * lifetime.
 */
export function snapshotJourneyStrategy(
  journeyId: string,
  disposition: IdentityStrategyDisposition,
): JourneyStrategySnapshot {
  return {
    journeyId,
    primary: disposition.primary,
    secondary: disposition.secondary,
    frozenAt: disposition.frozenAt,
    dispositionRef: disposition.identityId,
    snapshotVersion: STRATEGY_POLICY_VERSION,
  };
}

/**
 * PR6: Return the approach tags that carry bonus affinity for a given primary
 * strategy. Pure read-only lookup against {@link AFFINITY_MATRIX}.
 *
 * Used for prompt injection (narrative "you excel at X") and storyReport audit.
 * Does NOT enter any score computation.
 */
export function expectedApproachForTask(primary: Strategy): readonly ApproachTag[] {
  const result: ApproachTag[] = [];
  for (const tag of APPROACH_TAGS) {
    if (AFFINITY_MATRIX[tag]![primary] === 100) {
      result.push(tag);
    }
  }
  return result;
}

/**
 * PR6: Classify whether the observed approach tags violate the primary strategy.
 *
 * Computes `primaryAffinityScore` = average raw affinity of observed tags
 * against the primary strategy column, scaled to bps (* 100).
 *
 * - `primaryAffinityScore < 2000` → `fully_violates` (all/most tags are penalty)
 * - otherwise → `normal`
 *
 * Called once at journey end (inside {@link scoreStrategyConsistency}).
 * Pure: same inputs → same output.
 */
export function classifyPrimaryViolation(
  primary: Strategy,
  observedTags: readonly ApproachTag[],
): PrimaryViolationClassification {
  if (observedTags.length === 0) {
    // No observations: default to normal (legacy compatible).
    return { kind: "normal", primaryWeightBps: 10000, secondaryWeightBps: 0 };
  }
  let sum = 0;
  for (const tag of observedTags) {
    sum += AFFINITY_MATRIX[tag]![primary] ?? 0;
  }
  const primaryAffinityScoreBps = (sum / observedTags.length) * 100;
  if (primaryAffinityScoreBps < 2000) {
    return { kind: "fully_violates", primaryWeightBps: 3000, secondaryWeightBps: 7000 };
  }
  return { kind: "normal", primaryWeightBps: 10000, secondaryWeightBps: 0 };
}

/**
 * PR6: Compute the audit-only strategy consistency score for a journey.
 *
 * Algorithm:
 * 1. Flatten all observed approach tags from the entries.
 * 2. For each tag, look up its affinity to the primary strategy (100/50/0).
 * 3. `matchBps = clamp(sum(affinity) / max(1, tagCount) * 100, 0, 10000)`.
 * 4. Classify the primary violation.
 *
 * HARD ZERO-BONUS CONTRACT: this score is audit-only. It MUST NOT be consumed
 * by ConsequenceScore, SettlementDecision, reward, or viability.
 *
 * Pure: same inputs → same output.
 */
export function scoreStrategyConsistency(
  snapshot: JourneyStrategySnapshot,
  observedEntries: readonly ApproachSnapshotEntry[],
  computedAt: string,
): StrategyConsistencyScore {
  const allTags: ApproachTag[] = [];
  for (const entry of observedEntries) {
    for (const tag of entry.approachTags) {
      allTags.push(tag);
    }
  }
  const tagCount = allTags.length;
  let sum = 0;
  for (const tag of allTags) {
    sum += AFFINITY_MATRIX[tag]![snapshot.primary] ?? 0;
  }
  const matchBps = tagCount === 0
    ? 10000  // no observations: legacy default full match
    : clampBps((sum / tagCount) * 100);
  const classification = classifyPrimaryViolation(snapshot.primary, allTags);
  const approachSnapshot: ApproachSnapshot = {
    journeyId: snapshot.journeyId,
    entries: observedEntries,
    snapshotVersion: STRATEGY_POLICY_VERSION,
  };
  return {
    matchBps,
    snapshot: approachSnapshot,
    classification,
    strategyPolicyVersion: STRATEGY_POLICY_VERSION,
    computedAt,
  };
}

/**
 * PR6: Produce narrative text for prompt injection based on the violation
 * classification and disposition. Returns human-readable strings that describe
 * the agent's strategy tendencies without leaking any numeric scores.
 *
 * - `normal`: "你一贯擅长{primary}风格的行动"
 * - `fully_violates`: "你本局偏离了{primary}作风，更多依赖{secondary}来弥补"
 *
 * Pure narrative output. No bps/score/affinity values are exposed.
 */
export function dispositionWeights(
  classification: PrimaryViolationClassification,
  disposition: IdentityStrategyDisposition,
): { readonly primaryNarrative: string; readonly secondaryNarrative: string } {
  const STRATEGY_LABEL_CN: Readonly<Record<Strategy, string>> = Object.freeze({
    combat: "战斗",
    cunning: "诡计",
    support: "支援",
    logistics: "后勤",
    exploration: "探索",
  });
  const primaryLabel = STRATEGY_LABEL_CN[disposition.primary];
  const secondaryLabel = disposition.secondary
    ? STRATEGY_LABEL_CN[disposition.secondary]
    : undefined;
  if (classification.kind === "normal") {
    return {
      primaryNarrative: `你一贯擅长${primaryLabel}风格的行动`,
      secondaryNarrative: secondaryLabel
        ? `你偶尔也会运用${secondaryLabel}的手段`
        : "",
    };
  }
  // fully_violates
  return {
    primaryNarrative: secondaryLabel
      ? `你本局偏离了${primaryLabel}作风，更多依赖${secondaryLabel}来弥补`
      : `你本局偏离了惯常的${primaryLabel}作风`,
    secondaryNarrative: secondaryLabel
      ? `${secondaryLabel}成为你本局的主要依靠`
      : "",
  };
}
