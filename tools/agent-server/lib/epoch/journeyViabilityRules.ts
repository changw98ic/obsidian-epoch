/**
 * journeyViabilityRules.ts
 *
 * Identity viability model. Tracks how close an identity is to "social death"
 * (the point at which the identity can no longer credibly operate under that
 * name). Social death is a soft projection, not a hard kill: when status
 * degrades, the identity's lifetime accelerates rather than being cut short.
 *
 * PR1 (pure type freeze): shape is locked here. Runtime calibration — e.g. the
 * concrete value of VIABILITY_DEATH_THRESHOLD_BPS, the weight decomposition
 * behind viabilityScoreBps, and the lifetime acceleration curve — lands in
 * later PRs and must bump VIABILITY_POLICY_VERSION whenever the interpretation
 * of any field below changes.
 *
 * Anti-loop invariant: every projection in this file is computed AFTER a
 * SettlementDecision completes. Its lifetime delta feeds future lifetime
 * projections only — it MUST NOT re-feed the ConsequenceScore of the
 * settlement that produced it (that would let a settlement pay for itself).
 */

import type { DoubtStrength } from "./journeyRoleplayRules.ts";

/**
 * Version of the viability policy. Gates the shape of IdentityViability,
 * IdentityViabilityProjection, the interpretation of viabilityScoreBps, and
 * the VIABILITY_DEATH_THRESHOLD_BPS cut-off.
 *
 * Bump when:
 *  - The field set of IdentityViability / IdentityViabilityProjection changes.
 *  - The decomposition of viabilityScoreBps changes (e.g. we move off the
 *    first-version linear weighted sum).
 *  - The meaning of VIABILITY_DEATH_THRESHOLD_BPS shifts.
 *  - The anti-loop rule around projectedAt / sourceSettlementId is relaxed
 *    or tightened.
 */
export const VIABILITY_POLICY_VERSION = 1 as const;

/**
 * Cut-off in basis points at which an identity's status flips to
 * "social_death". Placeholder value (3000 bps = 30%); will be calibrated
 * against live journey telemetry in Step 16 and re-versioned via
 * VIABILITY_POLICY_VERSION if the interpretation changes.
 *
 * Identities whose viabilityScoreBps lands at or below this threshold can no
 * longer credibly operate and must be retired or reborn.
 */
export const VIABILITY_DEATH_THRESHOLD_BPS = 3000;

/**
 * Coarse status bucket derived from viabilityScoreBps against
 * VIABILITY_DEATH_THRESHOLD_BPS. This is the only viability field downstream
 * systems should branch on; the raw score is for telemetry and projection
 * math.
 *
 *  - "healthy"      — score comfortably above threshold; identity operates
 *                     freely.
 *  - "stressed"     — score approaching threshold; the world starts pushing
 *                     back (NPCs refuse, factions revoke hospitality, etc.).
 *  - "social_death" — score at/below threshold; identity can no longer
 *                     operate under this name.
 */
export type ViabilityStatus = "healthy" | "stressed" | "social_death";

/**
 * Server-authoritative snapshot of one identity's viability at a single
 * point in time. Every field is derived from already-settled world state —
 * nothing here is the player's claim or the model's suggestion.
 *
 * The identity is the addressed party, not the agent: lifetime, exposure and
 * doubt attach to the long-lived identity that survives across explorer
 * sessions.
 */
export interface IdentityViability {
  /** Stable identity id this projection is about. */
  readonly identityId: string;

  /**
   * Per-faction standing, keyed by factionId. Values use whatever scale the
   * faction module already publishes (signed, higher = friendlier). Read-only
   * map; do not mutate.
   */
  readonly factionStanding: Readonly<Record<string, number>>;

  /** Region ids where this identity is currently flagged wanted. */
  readonly flaggedWanted: ReadonlySet<string>;

  /** True when the identity's cover has been blown in any region. */
  readonly identityExposed: boolean;

  /**
   * Per-NPC doubt strength keyed by npcId. DoubtStrength is owned by the
   * roleplay rules module (journeyRoleplayRules) so that doubt semantics stay
   * co-located with the roleplay score that produces them.
   */
  readonly doubtedBy: Readonly<Record<string, DoubtStrength>>;

  /**
   * First-version viability score in basis points: a linear weighted sum of
   * all contributors (faction standing, exposure, doubt, wanted flags, …).
   * Higher is healthier. The weight decomposition is intentionally NOT
   * modelled here — it is an internal detail of the projector and may change
   * without breaking the wire shape, as long as the bps interpretation stays
   * stable (or VIABILITY_POLICY_VERSION bumps).
   */
  readonly viabilityScoreBps: number;

  /** Coarse bucket; the only branch target for downstream systems. */
  readonly status: ViabilityStatus;

  /** Policy version used to compute this snapshot. */
  readonly policyVersion: typeof VIABILITY_POLICY_VERSION;

  /**
   * ISO-8601 timestamp. Projected AFTER SettlementDecision completes; the
   * lifetime delta implied by this snapshot never re-feeds the current
   * ConsequenceScore (anti-loop).
   */
  readonly projectedAt: string;
}

/**
 * Paired before/after viability snapshots produced by a single settlement.
 * Captures how one settlement moved the needle on an identity's life —
 * without letting that movement leak back into the score that authorised it.
 *
 * Projections are append-only history. Once written, they are not recomputed;
 * any policy change requires a VIABILITY_POLICY_VERSION bump and a fresh
 * migration pass.
 */
export interface IdentityViabilityProjection {
  /** Identity this projection concerns. */
  readonly identityId: string;

  /** Viability immediately before the settlement was applied. */
  readonly before: IdentityViability;

  /** Viability immediately after the settlement was applied. */
  readonly after: IdentityViability;

  /** Signed delta of viabilityScoreBps (after - before). May be positive. */
  readonly deltaBps: number;

  /**
   * Acceleration applied to the identity's lifetime when status degrades.
   * In basis points. A value of 0 means "no acceleration" (status stayed
   * healthy, or the policy chose not to penalise this transition). This is
   * the ONLY field downstream systems consume to age an identity faster —
   * they must not re-derive it from before/after.
   */
  readonly lifetimeAccelerationBps: number;

  /**
   * True when this projection is the one that flipped status to
   * "social_death". Downstream systems read this flag rather than
   * re-deriving the transition from before/after, so that the social-death
   * side-effect (e.g. retirement cinematic, inheritance handoff) fires
   * exactly once.
   */
  readonly socialDeathTriggered: boolean;

  /** Settlement decision that produced this projection. */
  readonly sourceSettlementId: string;

  /** Policy version under which this projection was computed. */
  readonly policyVersion: typeof VIABILITY_POLICY_VERSION;
}
