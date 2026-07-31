/**
 * journeySettlementRules.ts — PR1 type freeze for the single-point journey
 * settlement contract.
 *
 * Single derivation invariant: a journey's final tier, reward and world-commit
 * decision are all computed exactly once at settlement. Downstream layers
 * (chronicle, reward grantor, world commit, identity projection) only READ the
 * artifacts produced here; they MUST NOT re-derive or augment them.
 *
 * Zero-affinity / zero-strategy hard constraint: score inputs and reward
 * modifiers consumed by this contract are derived strictly from consequence
 * outcomes (result / self-loss / collateral). Affinity bonuses, strategy fit,
 * and expected-approach markers are forbidden as score inputs (banlist enforced
 * on {@link SettlementDecision}). Strategy data may be carried on
 * {@link SettlementContext.strategyConsistencySnapshot} for AUDIT ONLY and never
 * re-enters any score field.
 *
 * This file is intentionally type-only in PR1: it freezes the public schema and
 * policy versions so parallel PRs can code against a stable contract. Runtime
 * derivation is implemented in PR4.
 */

import type { ExpectedLifePattern, RoleplayScore } from "./journeyRoleplayRules.ts";
import type { IdentityViability, ViabilityStatus } from "./journeyViabilityRules.ts";
import type { StrategyConsistencyScore } from "./journeyStrategyRules.ts";

/**
 * Policy version gating the {@link ConsequenceScore}, {@link ConsequenceBreakdown}
 * and {@link MirrorConsequenceLedgerEntry} shape. Bumping this constant signals
 * a breaking change to downstream persisters and replays.
 */
export const CONSEQUENCE_SCORE_POLICY_VERSION = 1 as const;

/**
 * Policy version gating {@link SettlementDecision}, {@link WorldCommitDecision},
 * {@link RewardGrant} and the interpretation of {@link CANON_THRESHOLD_BPS}.
 */
export const SETTLEMENT_POLICY_VERSION = 1 as const;

/**
 * Minimum {@link ConsequenceBreakdown.totalBps} required for a journey's mirror
 * world to be canon-eligible (solidified into shared world state).
 *
 * Placeholder value; calibrated in Step 16. Interpretation is gated by
 * {@link SETTLEMENT_POLICY_VERSION} so recalibration ships as a version bump.
 */
export const CANON_THRESHOLD_BPS = 8500;

/**
 * Canonical effect kinds recorded on a {@link MirrorConsequenceLedgerEntry}.
 * Used to classify how an action mutated the mirror world so that consequence
 * scoring can aggregate by effect category.
 */
export type ConsequenceEffectKind =
  | "resource_spent"
  | "lifetime_adjusted"
  | "object_mutation"
  | "object_destroy"
  | "faction_standing_delta"
  | "npc_relationship_delta"
  | "region_influence_delta"
  | "hidden_prerequisite_destroyed"
  | "identity_doubt"
  | "trace_created";

/**
 * High-level classification of a consequence bucket used by the score
 * breakdown:
 * - `result` — forward progress toward objective completion.
 * - `self_loss` — deterministic cost paid by the acting identity (resource,
 *   lifetime). De-duplicated against the canonical self-loss event sources.
 * - `collateral` — side effects on the mirror world (objects, factions, NPCs,
 *   regions, traces). Summarised on the score but never re-fed as additive
 *   score inputs.
 */
export type ConsequenceType = "result" | "self_loss" | "collateral";

/**
 * Canonical event kinds that may surface as a self-loss cost. A self-loss cost
 * is de-duplicated against these four sources by event/action ID so that the
 * same underlying spend cannot inflate the breakdown via multiple paths.
 */
export type SelfLossSourceKind =
  | "resource_cost"
  | "resource_spent_event"
  | "hosted_action_lifetime_delta"
  | "lifetime_adjusted_event";

/**
 * Final settlement tier assigned at the single derivation point. The tier is
 * derived from {@link ConsequenceBreakdown.totalBps} after applying the
 * {@link HiddenClamp}; it is never re-derived downstream.
 *
 * `完美` is not a canonical tier and is rejected upstream.
 */
export type SettlementTier = "未及格" | "及格" | "良好" | "优秀" | "惊世";

/**
 * Reason a {@link HiddenClamp} was applied. A journey whose main line did not
 * succeed is capped at `未及格`; a journey whose hidden objective set was not
 * fully completed is capped at `优秀` (cannot reach `惊世`).
 */
export type HiddenClampReason = "main_incomplete" | "hidden_incomplete";

/**
 * Final world-commit outcome for a mirror journey. `solidified` writes the
 * mirror's effects into shared canonical world state; `discarded` leaves the
 * shared world untouched.
 */
export type WorldCommitStatus = "solidified" | "discarded";

/**
 * Machine-readable justification for a {@link WorldCommitDecision}. Combines
 * with {@link WorldCommitDecision.canonEligible} to explain why a mirror was
 * solidified or discarded.
 */
export type WorldCommitReason =
  | "main_completed_and_above_threshold"
  | "main_incomplete"
  | "below_canon_threshold";

/**
 * Immutable ledger entry recording one mirror-world consequence produced by a
 * journey action. Append is idempotent on the composite
 * `actionEventId + dedupeKey` key so that replay cannot double-count.
 *
 * On {@link WorldCommitStatus.solidified}, the
 * {@link promotedCanonicalEventId} field is set atomically to point at the
 * canonical event that absorbed this mirror effect into shared world state.
 */
export interface MirrorConsequenceLedgerEntry {
  /** Action event that produced this consequence in the mirror world. */
  readonly actionEventId: string;
  /** Canonical effect category; see {@link ConsequenceEffectKind}. */
  readonly effectKind: ConsequenceEffectKind;
  /** Entity (resource, object, faction, npc, region, identity) mutated. */
  readonly targetEntityId: string;
  /** Signed magnitude of the effect in the effect's native unit. */
  readonly delta: number;
  /** High-level bucket used by the consequence score; see {@link ConsequenceType}. */
  readonly consequenceType: ConsequenceType;
  /**
   * Mirror event ids that contributed evidence to this entry. Used for replay
   * attestation; never re-entered as a score input.
   */
  readonly sourceEventIds: readonly string[];
  /** Effect blueprint payload (shape depends on {@link effectKind}); opaque to scoring. */
  readonly effectBlueprint: Readonly<Record<string, unknown>>;
  /** ISO timestamp the entry was recorded. */
  readonly recordedAt: string;
  /**
   * Composite de-duplication key. Append is idempotent on
   * `actionEventId + dedupeKey` so replay cannot inflate the ledger.
   */
  readonly dedupeKey: string;
  /**
   * Set atomically when the owning journey solidifies, pointing at the
   * canonical event that absorbed this mirror effect into shared world state.
   * Absent while the mirror is still pending or has been discarded.
   */
  readonly promotedCanonicalEventId?: string;
}

/**
 * Additive consequence score breakdown in basis points (bps). The three buckets
 * are de-duplicated and mutually exclusive at the source level:
 * - {@link resultScoreBps} — main/side objective completion weight.
 * - {@link selfLossScoreBps} — net self-loss cost (already de-duplicated against
 *   {@link selfLossSourceEventsByKind}).
 * - {@link collateralScoreBps} — collateral bonus/penalty summarised from the
 *   mirror ledger (see {@link collateralLedgerEntryIds}); never re-feeds the
 *   additive total via another path.
 *
 * {@link totalBps} is the single source of truth consumed by tier derivation
 * and {@link WorldCommitDecision.canonEligible}.
 */
export interface ConsequenceBreakdown {
  readonly resultScoreBps: number;
  readonly selfLossScoreBps: number;
  readonly collateralScoreBps: number;
  readonly totalBps: number;
  /** Self-loss source event IDs grouped by canonical kind; drives de-duplication. */
  readonly selfLossSourceEventsByKind: Readonly<Record<SelfLossSourceKind, readonly string[]>>;
  /** Mirror ledger entry IDs aggregated into the collateral bucket. */
  readonly collateralLedgerEntryIds: readonly string[];
}

/**
 * Hidden-objective clamp applied to the settlement tier. The clamp is the
 * only mechanism that may downgrade a tier after the additive score is
 * computed; downstream layers must respect the clamped tier.
 *
 * - Main-line failure: tier capped at `未及格`, regardless of additive score.
 * - Hidden objective set incomplete: tier capped at `优秀` (no `惊世`).
 */
export interface HiddenClamp {
  readonly applied: boolean;
  readonly reason?: HiddenClampReason;
  /** Effective tier ceiling enforced by the clamp. */
  readonly tierCap: SettlementTier;
  /** Hidden objective IDs that were incomplete when the clamp fired. */
  readonly sourceHiddenObjectiveIds: readonly string[];
}

/**
 * Frozen snapshot of the consequence score for one journey. Produced exactly
 * once at settlement; downstream layers read but never mutate it.
 *
 * The optional summaries ({@link roleplaySummary}, {@link viabilitySummary})
 * are projected AFTER settlement and are carried for chronicle / display use
 * only. They MUST NOT re-feed the additive score on this object — doing so
 * would violate the single-derivation invariant.
 */
export interface ConsequenceScore {
  readonly breakdown: ConsequenceBreakdown;
  /** True iff every main objective has server completion evidence. */
  readonly mainLineSucceeded: boolean;
  /** True iff every hidden objective has server completion evidence. */
  readonly hiddenComplete: boolean;
  readonly hiddenClamp: HiddenClamp;
  /**
   * Roleplay-derived summary (deviation bps, doubt event count, exposed flag).
   * Projection of a {@link RoleplayScore}; not an additive score input here.
   */
  readonly roleplaySummary?: {
    readonly deviationBps: number;
    readonly doubtEventCount: number;
    readonly exposed: boolean;
  };
  /**
   * Viability-derived summary (before/after bps, status). Projection of an
   * {@link IdentityViability} computed AFTER settlement; never re-feeds this
   * score.
   *
   * The pre-settlement scorer intentionally leaves this optional display field
   * unset: the before/after pair does not exist until the settlement pipeline
   * emits `identity_viability_projected`. Result-page assembly copies that
   * persisted event into this summary without changing the additive score.
   */
  readonly viabilitySummary?: {
    readonly viabilityScoreBpsBefore: number;
    readonly viabilityScoreBpsAfter: number;
    readonly status: ViabilityStatus;
  };
  readonly policyVersion: typeof CONSEQUENCE_SCORE_POLICY_VERSION;
  readonly computedAt: string;
}

/**
 * Decision to solidify or discard the journey's mirror world. Canon-eligibility
 * is `mainLineSucceeded && breakdown.totalBps >= thresholdBps`; the threshold
 * interpretation is gated by {@link SETTLEMENT_POLICY_VERSION}.
 */
export interface WorldCommitDecision {
  readonly status: WorldCommitStatus;
  /** True iff main line succeeded and total bps cleared {@link thresholdBps}. */
  readonly canonEligible: boolean;
  readonly thresholdBps: number;
  readonly policyVersion: typeof SETTLEMENT_POLICY_VERSION;
  readonly reason: WorldCommitReason;
}

/**
 * Modifier applied to the base reward bundle. Inputs are score-derived only;
 * affinity and strategy MUST NOT influence this modifier. Multiplier is
 * clamped to `[5000, 15000]` bps (i.e. `[0.5x, 1.5x]`) and negative rewards
 * are forbidden.
 */
export interface RewardModifier {
  readonly modifierBps: number;
  /** Multiplier in bps, clamped to `[5000, 15000]` (`[0.5x, 1.5x]`). */
  readonly multiplierBps: number;
  readonly reason: "strategy_score_modifier" | "journey_grade";
}

/**
 * Idempotent reward grant produced at the single derivation point. Grant is
 * idempotent per journey/settlement via {@link idempotencyKey}. Negative
 * rewards are explicitly forbidden — the {@link negativeRewardForbidden}
 * marker is a permanent contract invariant.
 */
export interface RewardGrant {
  readonly tier: SettlementTier;
  /** Reference to the base reward bundle selected by tier. */
  readonly baseBundleRef: string;
  readonly modifier: RewardModifier;
  readonly resourceGrants: Readonly<Record<string, number>>;
  readonly itemGrants: readonly {
    readonly itemId: string;
    readonly quantity: number;
    readonly rarityTier: number;
  }[];
  /** Idempotency key scoped to the owning journey settlement. */
  readonly idempotencyKey: string;
  /** Permanent invariant: negative rewards are not expressible. */
  readonly negativeRewardForbidden: true;
}

/**
 * Single-point settlement decision for one journey. Produced exactly once;
 * tier, reward and world-commit are all derived from {@link score} here.
 * Downstream layers only READ this artifact.
 *
 * BANLIST (forbidden fields — affinity/strategy must not appear on this
 * object): `affinityBonusBps`, `strategyRewardModifier`, `strategyAffinity`,
 * `fitBps`, `expectedApproach`. Adding any of these breaks the
 * zero-affinity / zero-strategy hard constraint.
 */
export interface SettlementDecision {
  /** Owning journey ID; scopes the idempotency keys of nested artifacts. */
  readonly journeyId: string;
  readonly score: ConsequenceScore;
  readonly tier: SettlementTier;
  readonly reward: RewardGrant;
  readonly worldCommit: WorldCommitDecision;
  readonly hiddenClamp: HiddenClamp;
  readonly policyVersion: typeof SETTLEMENT_POLICY_VERSION;
  readonly settledAt: string;
  /** Optional replay digest binding this decision to its input snapshot. */
  readonly replayDigest?: `sha256:${string}`;
}

/**
 * Cost-kind classification for one self-loss contribution. Mirrors the
 * two-bucket structure of {@link SelfLossSourceKind}:
 * - `resource` — `focus` / `stamina` paid via `JourneyActionResolution.resourceCost`
 *   or the matching `resource_spent` side-effect event.
 * - `lifetime` — signed lifetime delta paid via the canonical
 *   `hosted_action_recorded` event or the matching `lifetime_adjusted` event.
 */
export type SelfLossCostKind = "resource" | "lifetime";

/**
 * Server-adjudicated breakdown feeding the {@link ConsequenceBreakdown.resultScoreBps}
 * additive bucket. PR4 derives this from {@link JourneyTaskPerformance} (in
 * `journeyGeneratedTaskRules.ts`); the values are the four canonical bps
 * components plus the failed-action penalty.
 *
 * The composite `scoreBps` summary on `JourneyTaskPerformance` is NOT carried
 * here — only the four physical-adjudication components. This enforces the
 * "never reads model-supplied score" constraint at the type level.
 */
export interface ResultComponentInputs {
  /** Ratio of completed required-main objectives, in `[0, 10000]`. */
  readonly mainCompletionBps: number;
  /** Ratio of completed bonus-main objectives, in `[0, 10000]`. */
  readonly bonusMainCompletionBps: number;
  /** Ratio of completed relevant-side objectives, in `[0, 10000]`. */
  readonly sideCompletionBps: number;
  /** Average execution quality across completed actions, in `[0, 10000]`. */
  readonly executionQualityBps: number;
  /** Failed-action penalty (750 bps per failed action). */
  readonly penaltyBps: number;
}

/**
 * Pre-deduplicated self-loss contribution for one `(actionEventId, costKind)`
 * tuple. Upstream layers MUST apply {@link selfLossDedupRules} (PR4) before
 * populating this field so that PR4 sees exactly one source per tuple.
 *
 * Rule 5 (single source per cost-kind) is enforced structurally here: the
 * {@link sourceKind} field records WHICH source won for audit, and
 * {@link canonicalEventIds} collapses the underlying event ids into a Set.
 */
export interface SelfLossContribution {
  /** Canonical `hosted_action_recorded` event id for the owning action. */
  readonly actionEventId: string;
  /** Cost bucket; see {@link SelfLossCostKind}. */
  readonly costKind: SelfLossCostKind;
  /** Which canonical source won the dedup; see {@link SelfLossSourceKind}. */
  readonly sourceKind: SelfLossSourceKind;
  /** Canonical event ids backing this contribution (for breakdown audit). */
  readonly canonicalEventIds: readonly string[];
  /**
   * Magnitude for `costKind === 'resource'`. Integer count of resource units
   * paid (focus / stamina). Absent or zero for `lifetime` contributions.
   */
  readonly resourceUnits?: number;
  /**
   * Signed lifetime delta for `costKind === 'lifetime'`. Negative = lifetime
   * paid; only the negative magnitude contributes to the score
   * (`max(0, -lifetimeDelta)`). Absent for `resource` contributions.
   */
  readonly lifetimeDelta?: number;
}

/**
 * Base reward bundle used by the PR4 reward derivation. Resources are indexed
 * by `resourceId` so the derivation can apply the score modifier uniformly.
 *
 * Items carry a numeric base rarity tier so the modifier-bump rule can be
 * applied without parsing string labels:
 * - 0 = none / no item
 * - 1 = common
 * - 2 = rare
 * - 3 = legendary
 *
 * The bundle reference is opaque to scoring; it is copied verbatim onto
 * {@link RewardGrant.baseBundleRef}.
 */
export interface BaseRewardBundle {
  readonly baseBundleRef: string;
  readonly resources: Readonly<Record<string, number>>;
  readonly items: readonly {
    readonly itemId: string;
    readonly quantity: number;
    readonly baseRarityTier: 0 | 1 | 2 | 3;
  }[];
}

/**
 * Frozen input shape consumed by the single-point settlement entry point
 * (implemented in PR4). The shape is constructed by upstream journey runtime
 * layers and validated before {@link SettlementDecision} derivation.
 *
 * Audit-only fields:
 * - {@link strategyConsistencySnapshot} — carried for chronicle / replay
 *   audit; MUST NOT enter any score field.
 *
 * Projection inputs (read-only):
 * - {@link roleplayScore}, {@link identityViability} — feed the
 *   AFTER-settlement summaries on {@link ConsequenceScore}, never the
 *   additive breakdown.
 *
 * PR4 additive-bucket inputs (required):
 * - {@link resultComponentInputs} — feeds {@link ConsequenceBreakdown.resultScoreBps}.
 * - {@link selfLossContributions} — feeds {@link ConsequenceBreakdown.selfLossScoreBps}.
 *   Pre-deduplicated per `(actionEventId, costKind)` upstream.
 * - {@link baseRewardBundle} — feeds {@link RewardGrant.resourceGrants} / {@link RewardGrant.itemGrants}.
 */
export interface SettlementContext {
  readonly journeyId: string;
  readonly mainObjectiveIds: readonly string[];
  readonly sideObjectiveIds: readonly string[];
  readonly hiddenObjectiveIds: readonly string[];
  readonly mainLineSucceeded: boolean;
  readonly hiddenComplete: boolean;
  /** Action resolutions indexed by their result kind and success flag. */
  readonly actionResolutions: readonly {
    readonly actionEventId: string;
    readonly resultKind: string;
    readonly succeeded: boolean;
  }[];
  /** Self-loss source events pre-grouped by canonical kind for de-duplication. */
  readonly selfLossSourceEventsByKind: Readonly<Record<SelfLossSourceKind, readonly string[]>>;
  /** Mirror ledger entries produced during the journey run. */
  readonly mirrorLedgerEntries: readonly MirrorConsequenceLedgerEntry[];
  /** Canonical action event IDs that survived de-duplication. */
  readonly canonicalActionEventIds: readonly string[];
  /** PR4: server-adjudicated breakdown feeding the result additive bucket. */
  readonly resultComponentInputs: ResultComponentInputs;
  /** PR4: pre-deduplicated self-loss contributions feeding the self-loss bucket. */
  readonly selfLossContributions: readonly SelfLossContribution[];
  /** PR4: base reward bundle feeding the reward derivation. */
  readonly baseRewardBundle: BaseRewardBundle;
  /** Optional expected-life-pattern consumed by roleplay projection. */
  readonly expectedLifePattern?: ExpectedLifePattern;
  /** Optional roleplay score; projects the {@link ConsequenceScore.roleplaySummary}. */
  readonly roleplayScore?: RoleplayScore;
  /**
   * Optional identity viability; projects the {@link ConsequenceScore.viabilitySummary}.
   *
   * This field is retained for typed chronicle adapters. The authoritative
   * settlement path supplies the paired before/after data through the
   * persisted `identity_viability_projected` event, after the score is frozen;
   * it never changes `breakdown.totalBps`.
   */
  readonly identityViability?: IdentityViability;
  /**
   * AUDIT-ONLY strategy snapshot. Never re-enters any score / reward / tier
   * field on this contract.
   */
  readonly strategyConsistencySnapshot?: StrategyConsistencyScore;
  /** Optional quest offer hash for replay binding. */
  readonly offerHash?: `sha256:${string}`;
  readonly policyVersion: typeof SETTLEMENT_POLICY_VERSION;
}
