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
