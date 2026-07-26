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

import type { DoubtStrength, NpcDoubtEvent } from "./journeyRoleplayRules.ts";

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

  /**
   * Region ids where this identity is currently flagged wanted.
   *
   * PR5a: the canonical event source that populates this set (e.g. a
   * `region_wanted_status_changed` event) is plumbed by the planner
   * integration PR, not by the algorithm-only PR5a. The viability projector
   * reads whatever the runtime hands it in
   * {@link ProjectIdentityViabilityInput.flaggedWanted}; it does not derive
   * the set itself.
   */
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

// ---------------------------------------------------------------------------
// PR5a — viability algorithm (first-version linear weighted sum).
//
// The shape above is locked by PR1. PR5a attaches the first runtime
// interpretation of viabilityScoreBps: a placeholder linear weighted sum whose
// weights, normalization, and threshold are versioned together via
// VIABILITY_POLICY_VERSION. Any change to a weight, a normalization, a
// threshold, or the cross-faction default below MUST bump
// VIABILITY_POLICY_VERSION and re-project every active identity.
//
// Anti-loop invariant (spec §6.8): every function below is computed AFTER a
// SettlementDecision completes. The lifetime acceleration implied by a
// projection feeds future lifetime projections only — it MUST NOT re-feed the
// ConsequenceScore of the settlement that produced it. The structural guard is
// that {@link projectIdentityViability} takes no "current-round lifetime delta"
// parameter; by construction the score cannot see the delta it just authored.
// ---------------------------------------------------------------------------

/**
 * Score in basis points above which an identity's status stays "healthy".
 * Placeholder (6_000 = 60%); will be calibrated against live journey telemetry
 * in Step 16. A score in (VIABILITY_DEATH_THRESHOLD_BPS, STRESSED_THRESHOLD_BPS]
 * lands the identity in "stressed". A score at or below
 * VIABILITY_DEATH_THRESHOLD_BPS lands the identity in "social_death".
 */
export const STRESSED_THRESHOLD_BPS = 6_000;

/**
 * First-version linear weights. The five weights sum to exactly 1.0 so that a
 * perfectly-healthy identity (every component at 10_000 bps) projects a
 * viabilityScoreBps of exactly 10_000. Step 16 tunes; any change MUST bump
 * VIABILITY_POLICY_VERSION.
 */
export const VIABILITY_WEIGHTS = Object.freeze({
  W_FACTION: 0.4,
  W_DOUBT: 0.3,
  W_WANTED: 0.15,
  W_EXPOSED: 0.1,
  W_BASE: 0.05,
} as const);

/**
 * Per-NPC doubt penalty in basis points, by {@link DoubtStrength}. The values
 * cap how much a single rumour can erode the doubt component: one severe
 * rumour costs 4_000 bps (40%), but the aggregate is also capped at 10_000 so
 * one severe rumour cannot solo-kill an identity. Step 16 tunes.
 */
export const DOUBT_PENALTY_BPS: Readonly<Record<DoubtStrength, number>> = Object.freeze({
  low: 250,
  moderate: 750,
  high: 2_000,
  severe: 4_000,
});

/**
 * Per-region "wanted" flag penalty in basis points. Each region in
 * {@link IdentityViability.flaggedWanted} subtracts this from the wanted
 * component; the aggregate is capped at 10_000. Placeholder; Step 16 tunes.
 */
export const WANTED_REGION_PENALTY_BPS = 3_000;

/**
 * Floor for the exposure component when {@link IdentityViability.identityExposed}
 * is true. Placeholder (2_000 = 20%); Step 16 tunes. Until PR7 supplies
 * RoleplayScore.exposed, identityExposed is derived from doubtedBy containing
 * at least one severe entry — see {@link deriveIdentityExposed}.
 */
export const EXPOSED_FLOOR_BPS = 2_000;

/**
 * Per-{@link DoubtStrength} faction-standing delta applied when a doubt
 * propagates within the same faction. Negative (standing drops). In basis
 * points of faction-standing scale. Placeholder; Step 16 tunes.
 */
export const DOUBT_TO_STANDING_BPS: Readonly<Record<DoubtStrength, number>> = Object.freeze({
  low: 25,
  moderate: 75,
  high: 200,
  severe: 400,
});

/**
 * Cap on the "stressed" lifetime-acceleration value (in bps). Prevents a
 * stressed death-spiral from skipping the archive/reincarnation narrative.
 * The single social-death flip is bounded separately at 10_000 bps.
 */
export const STRESSED_LIFETIME_ACCELERATION_CAP_BPS = 5_000;

/**
 * Lifetime acceleration applied on the single projection that flips an
 * identity's status to "social_death". Drains remaining lifetime to 0 on the
 * next tick, giving the archive/reincarnation narrative a deterministic trigger.
 */
export const SOCIAL_DEATH_LIFETIME_ACCELERATION_BPS = 10_000;

/**
 * Reason strings reserved for the runtime's `lifetime_adjusted` events. These
 * are server-attested: MCP tools that call lifetimeAdjustmentEvents with these
 * reasons MUST be rejected unless the runtime passes a ViabilityTriggerRef
 * carrying the sourceSettlementId. See lifetimeTriggerRules in the spec.
 */
export const LIFETIME_REASON_IDENTITY_VIABILITY_ACCELERATION =
  "identity_viability_acceleration" as const;
export const LIFETIME_REASON_IDENTITY_VIABILITY_SOCIAL_DEATH =
  "identity_viability_social_death" as const;

/**
 * Default cross-faction info-sharing mode. PR5a hard-codes "none" — no
 * cross-faction intel flow. Flipping the default is a balance change and MUST
 * bump VIABILITY_POLICY_VERSION because it changes the interpretation of
 * factionStanding for cross-faction pairs.
 */
export const DEFAULT_FACTION_INFO_SHARING = "none" as const;

/**
 * Cross-faction intel-sharing mode for a single faction.
 *
 *  - "none" — the faction does not share doubt intel with any other faction.
 *  - "bloc" — the faction shares doubt intel with factions in its
 *             {@link FactionDoubtPropagationInput.factionBlocs} peer list.
 *
 * PR5a routes every faction at "none". The "bloc" branch is shipped so the
 * future balance flip is data-driven, not code-driven.
 */
export type FactionInfoSharingMode = typeof DEFAULT_FACTION_INFO_SHARING | "bloc";

/**
 * Multiplier applied to the originating faction's standing delta when a doubt
 * propagates across to a bloc-peer faction. The cross-faction hit is always
 * strictly smaller than the in-faction hit so the originating faction remains
 * the canonical seat of notoriety.
 */
export const CROSS_FACTION_DOUBT_MULTIPLIER = 0.5;

/**
 * Input to {@link projectIdentityViability}. Every field is derived from
 * already-settled world state — nothing here is the player's claim or the
 * model's suggestion. Anti-loop: there is no field for "current-round
 * lifetime delta" because the projector must not see the delta it just
 * authored (spec §6.8).
 */
export interface ProjectIdentityViabilityInput {
  readonly identityId: string;
  /** Per-faction signed standing score (signed, higher = friendlier). */
  readonly factionStanding: Readonly<Record<string, number>>;
  /** Region ids where this identity is currently flagged wanted. */
  readonly flaggedWanted: ReadonlySet<string>;
  /** True when the identity's cover has been blown in any region. */
  readonly identityExposed: boolean;
  /** Per-NPC doubt strength keyed by npcId. */
  readonly doubtedBy: Readonly<Record<string, DoubtStrength>>;
  /**
   * Lifetime ratio input. `max` MUST be > 0 for a live identity; if a caller
   * passes max === 0 the base component degrades to 0 (no perfect score for a
   * zero-lifetime identity).
   */
  readonly lifetime: { readonly max: number; readonly remaining: number };
  /** ISO-8601 timestamp the projection is anchored at. */
  readonly projectedAt: string;
}

/**
 * Pre-computed component breakdown. Returned alongside the projection so tests
 * and telemetry can inspect how the score was assembled without re-deriving
 * it. Persisting this breakdown is OPTIONAL; it is NOT part of the wire shape.
 */
export interface ViabilityComponentBreakdown {
  readonly factionComponentBps: number;
  readonly doubtComponentBps: number;
  readonly wantedComponentBps: number;
  readonly exposedComponentBps: number;
  readonly baseComponentBps: number;
}

/**
 * Output of {@link projectIdentityViability}. Combines the canonical
 * {@link IdentityViability} snapshot with the per-component breakdown so
 * downstream systems can branch on status while telemetry keeps the raw
 * decomposition.
 */
export interface ProjectIdentityViabilityResult {
  readonly viability: IdentityViability;
  readonly breakdown: ViabilityComponentBreakdown;
}

/**
 * Input to {@link applyFactionDoubtPropagation}. Consumes the promoted
 * identity_doubt entries (one per NPC observation) and the identity's
 * pre-propagation factionStanding, and produces the canonical standing deltas
 * the runtime emits at solidify time.
 *
 * Anti-loop: propagation must NOT loop back into the current ConsequenceScore.
 * The canonical `agent_faction_standing_changed` events are emitted AFTER
 * deriveSettlementDecision completes, so they appear in the NEXT journey's
 * ctx.mirrorLedgerEntries / faction standing read, never the current one.
 */
export interface FactionDoubtPropagationInput {
  readonly identityId: string;
  readonly journeyId: string;
  /** Promoted NpcDoubtEvent entries; only factionId-bearing entries propagate. */
  readonly doubtEvents: readonly NpcDoubtEvent[];
  /** Pre-propagation faction standing map (signed scores keyed by factionId). */
  readonly factionStanding: Readonly<Record<string, number>>;
  /** doubtedBy map (keyed by npcId). Unchanged by propagation. */
  readonly doubtedBy: Readonly<Record<string, DoubtStrength>>;
  /**
   * Per-faction info-sharing mode. PR5a defaults every faction to
   * {@link DEFAULT_FACTION_INFO_SHARING} ("none"); the input may omit factions
   * and they will be treated as "none".
   */
  readonly factionInfoSharing?: Readonly<Record<string, FactionInfoSharingMode>>;
  /**
   * Bloc membership: factionId → peer factionIds that share intel when both
   * sides are in "bloc" mode. Unused in PR5a (default "none") but plumbed so
   * the future balance flip is data-driven.
   */
  readonly factionBlocs?: Readonly<Record<string, readonly string[]>>;
}

/**
 * One canonical standing delta to be emitted as an
 * `agent_faction_standing_changed` event at solidify time. The dedupe key
 * matches the spec: `${journeyId}:${identityId}:${factionId}:${doubtEventId}`.
 */
export interface FactionStandingPropagationDelta {
  readonly factionId: string;
  /** Signed delta applied to the faction standing (≤ 0 for doubt propagation). */
  readonly standingDelta: number;
  /** Standing value after the delta is applied (post-propagation). */
  readonly standingAfter: number;
  readonly doubtEventId: string;
  readonly npcId: string;
  /** Faction the doubt originated in; same as factionId for same-faction propagation. */
  readonly sourceFactionId: string;
  /** True when this delta is a cross-faction propagation. */
  readonly crossFaction: boolean;
  /** Canonical dedupe key for the emitted `agent_faction_standing_changed` event. */
  readonly dedupeKey: string;
}

/**
 * Result of {@link applyFactionDoubtPropagation}.
 */
export interface FactionDoubtPropagationResult {
  /** Post-propagation faction standing map (same key set as input). */
  readonly factionStanding: Readonly<Record<string, number>>;
  /** doubtedBy unchanged — doubt itself does not propagate, only standing does. */
  readonly doubtedBy: Readonly<Record<string, DoubtStrength>>;
  /** Canonical standing deltas the runtime should emit at solidify time. */
  readonly standingDeltas: readonly FactionStandingPropagationDelta[];
}

/**
 * Input to {@link computeLifetimeAcceleration}.
 */
export interface LifetimeAccelerationInput {
  readonly status: ViabilityStatus;
  readonly viabilityScoreBps: number;
  /**
   * True when THIS projection is the one that flipped status to
   * "social_death". Downstream systems read this flag rather than re-deriving
   * the transition from before/after, so the social-death side-effect fires
   * exactly once across the identity's lifetime.
   */
  readonly socialDeathTriggered: boolean;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function clampBps(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 10_000) return 10_000;
  return value;
}

function clampSignedBps(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < -10_000) return -10_000;
  if (value > 10_000) return 10_000;
  return value;
}

/**
 * Map a signed faction score (clamped to [-10_000, 10_000]) linearly to
 * [0, 10_000]. Caps match currentAgentFactionStandingScore cap (gameCore.ts).
 * A score of 0 (neutral) maps to 5_000; a score of 10_000 (exalted) maps to
 * 10_000; a score of -10_000 (hostile) maps to 0.
 */
function factionScoreToComponentBps(score: number): number {
  const capped = clampSignedBps(score);
  return ((capped + 10_000) / 20_000) * 10_000;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Derive identityExposed from doubtedBy when no canonical source exists yet
 * (PR7 RoleplayScore.exposed). Until PR7 lands, an identity is "exposed" iff
 * at least one NPC recorded a "severe" doubt observation against it. Step 16
 * may relocate this derivation; until then, centralise it here.
 */
export function deriveIdentityExposed(
  doubtedBy: Readonly<Record<string, DoubtStrength>>,
): boolean {
  for (const npcId of Object.keys(doubtedBy)) {
    if (doubtedBy[npcId] === "severe") return true;
  }
  return false;
}

/**
 * Compute the coarse status bucket from a viabilityScoreBps against the
 * STRESSED_THRESHOLD_BPS and VIABILITY_DEATH_THRESHOLD_BPS cut-offs. This is
 * the only viability field downstream systems should branch on; the raw score
 * is for telemetry and projection math.
 *
 *  - score > STRESSED_THRESHOLD_BPS (6_000) → "healthy"
 *  - VIABILITY_DEATH_THRESHOLD_BPS (3_000) < score ≤ STRESSED → "stressed"
 *  - score ≤ VIABILITY_DEATH_THRESHOLD_BPS → "social_death"
 */
export function viabilityStatus(score: number): ViabilityStatus {
  const capped = clampBps(score);
  if (capped <= VIABILITY_DEATH_THRESHOLD_BPS) return "social_death";
  if (capped <= STRESSED_THRESHOLD_BPS) return "stressed";
  return "healthy";
}

/**
 * Compute the first-version linear weighted viability score for one identity.
 * Pure: same inputs → same output. Anti-loop: takes no current-round lifetime
 * delta parameter, so the score cannot see the delta it just authored.
 *
 * First-version aggregation choice (PR5a): the faction component AVERAGES
 * per-faction component bps across ALL factions on {@link factionStanding}.
 * A single hostile faction (-10_000 → 0 bps) CAN therefore be diluted by
 * friendly factions: e.g. 1 hostile (0) + 3 exalted (10_000) projects
 * (0 + 10_000·3) / 4 = 7_500 bps, NOT 0. The alternative "worst-faction
 * wins" rule was rejected for v1 because it would let one angry faction
 * solo-kill an otherwise-beloved identity. Aggregation tuning belongs to
 * Step 16 calibration; any change to the aggregation MUST bump
 * {@link VIABILITY_POLICY_VERSION} and re-project every active identity.
 *
 * Returns the score AND the per-component breakdown so telemetry can inspect
 * how the score was assembled without re-deriving it.
 */
export function computeViabilityScore(
  input: Omit<
    ProjectIdentityViabilityInput,
    "identityId" | "projectedAt" | "identityExposed"
  > & { readonly identityExposed?: boolean },
): { readonly scoreBps: number; readonly breakdown: ViabilityComponentBreakdown } {
  const factionScores = Object.values(input.factionStanding);
  const factionComponentBps =
    factionScores.length === 0
      ? 10_000
      : factionScores.reduce((sum, score) => sum + factionScoreToComponentBps(score), 0) /
        factionScores.length;

  let doubtPenalty = 0;
  for (const npcId of Object.keys(input.doubtedBy)) {
    const strength = input.doubtedBy[npcId];
    doubtPenalty += DOUBT_PENALTY_BPS[strength];
  }
  const doubtComponentBps = 10_000 - Math.min(10_000, doubtPenalty);

  const wantedRegionCount = input.flaggedWanted.size;
  const wantedComponentBps = 10_000 - Math.min(10_000, wantedRegionCount * WANTED_REGION_PENALTY_BPS);

  const identityExposed =
    input.identityExposed ?? deriveIdentityExposed(input.doubtedBy);
  const exposedComponentBps = identityExposed ? EXPOSED_FLOOR_BPS : 10_000;

  const lifetimeRatio =
    input.lifetime.max > 0
      ? clampBps(input.lifetime.remaining / input.lifetime.max)
      : 0;
  const baseComponentBps = 10_000 * lifetimeRatio;

  const raw =
    VIABILITY_WEIGHTS.W_FACTION * factionComponentBps +
    VIABILITY_WEIGHTS.W_DOUBT * doubtComponentBps +
    VIABILITY_WEIGHTS.W_WANTED * wantedComponentBps +
    VIABILITY_WEIGHTS.W_EXPOSED * exposedComponentBps +
    VIABILITY_WEIGHTS.W_BASE * baseComponentBps;

  return {
    scoreBps: clampBps(raw),
    breakdown: {
      factionComponentBps,
      doubtComponentBps,
      wantedComponentBps,
      exposedComponentBps,
      baseComponentBps,
    },
  };
}

/**
 * Project one identity's viability snapshot. Pure: same inputs → same output.
 * Composes {@link computeViabilityScore} and {@link viabilityStatus}; attaches
 * the policy version and projection timestamp.
 *
 * Anti-loop invariant: the function signature carries no "current-round
 * lifetime delta" parameter, so the score cannot see the delta it just
 * authored. Lifetime acceleration derived from this snapshot feeds future
 * lifetime projections only.
 */
export function projectIdentityViability(
  input: ProjectIdentityViabilityInput,
): ProjectIdentityViabilityResult {
  const identityExposed =
    input.identityExposed || deriveIdentityExposed(input.doubtedBy);
  const { scoreBps, breakdown } = computeViabilityScore({
    factionStanding: input.factionStanding,
    flaggedWanted: input.flaggedWanted,
    doubtedBy: input.doubtedBy,
    lifetime: input.lifetime,
    identityExposed,
  });
  const status = viabilityStatus(scoreBps);
  const viability: IdentityViability = {
    identityId: input.identityId,
    factionStanding: input.factionStanding,
    flaggedWanted: input.flaggedWanted,
    identityExposed,
    doubtedBy: input.doubtedBy,
    viabilityScoreBps: scoreBps,
    status,
    policyVersion: VIABILITY_POLICY_VERSION,
    projectedAt: input.projectedAt,
  };
  return { viability, breakdown };
}

/**
 * Apply same-faction and (data-driven) cross-faction doubt propagation.
 *
 * Same-faction: every promoted identity_doubt entry whose NpcDoubtEvent has a
 * factionId produces ONE canonical standing delta of
 * `-DOUBT_TO_STANDING_BPS[doubtStrength]` on that faction. Multiple doubts in
 * the same journey accumulate. The reduction is GLOBAL across regions for that
 * faction (factionStanding is keyed by factionId only, not by region) —
 * fleeing to a new region does NOT evade same-faction notoriety (spec §6.8).
 *
 * Cross-faction: gated by the per-faction {@link FactionInfoSharingMode}. When
 * both the originating faction and the peer faction are in "bloc" mode and
 * belong to the same bloc, a severe/high doubt in faction A also emits a
 * reduced (×{@link CROSS_FACTION_DOUBT_MULTIPLIER}) standing delta on the peer
 * faction B. PR5a routes every faction at "none" so no cross-faction event
 * fires; the branch is shipped so the future balance flip is data-driven.
 *
 * Anti-loop: the returned deltas are intended to be emitted AFTER
 * deriveSettlementDecision completes, so they appear in the NEXT journey's
 * ctx, never the current one. This function does not take a SettlementContext
 * parameter — by construction it cannot feed back into the current score.
 */
export function applyFactionDoubtPropagation(
  input: FactionDoubtPropagationInput,
): FactionDoubtPropagationResult {
  const infoSharing = input.factionInfoSharing ?? {};
  const blocs = input.factionBlocs ?? {};
  const standing = { ...input.factionStanding };
  const deltas: FactionStandingPropagationDelta[] = [];

  for (const doubt of input.doubtEvents) {
    const sourceFactionId = doubt.factionId;
    if (!sourceFactionId) continue;
    const magnitude = DOUBT_TO_STANDING_BPS[doubt.doubtStrength];

    // Same-faction: always propagate.
    const sameFactionDelta = -magnitude;
    const sameFactionBefore = standing[sourceFactionId] ?? 0;
    const sameFactionAfter = sameFactionBefore + sameFactionDelta;
    standing[sourceFactionId] = sameFactionAfter;
    deltas.push({
      factionId: sourceFactionId,
      standingDelta: sameFactionDelta,
      standingAfter: sameFactionAfter,
      doubtEventId: doubt.doubtEventId,
      npcId: doubt.npcId,
      sourceFactionId,
      crossFaction: false,
      dedupeKey: `${input.journeyId}:${input.identityId}:${sourceFactionId}:${doubt.doubtEventId}`,
    });

    // Cross-faction: only severe/high, only when both sides are "bloc" peers.
    if (
      doubt.doubtStrength === "severe" ||
      doubt.doubtStrength === "high"
    ) {
      if ((infoSharing[sourceFactionId] ?? DEFAULT_FACTION_INFO_SHARING) !== "bloc") {
        continue;
      }
      const peers = blocs[sourceFactionId] ?? [];
      for (const peerFactionId of peers) {
        if (peerFactionId === sourceFactionId) continue;
        if ((infoSharing[peerFactionId] ?? DEFAULT_FACTION_INFO_SHARING) !== "bloc") {
          continue;
        }
        const crossDelta = -Math.round(magnitude * CROSS_FACTION_DOUBT_MULTIPLIER);
        const crossBefore = standing[peerFactionId] ?? 0;
        const crossAfter = crossBefore + crossDelta;
        standing[peerFactionId] = crossAfter;
        deltas.push({
          factionId: peerFactionId,
          standingDelta: crossDelta,
          standingAfter: crossAfter,
          doubtEventId: doubt.doubtEventId,
          npcId: doubt.npcId,
          sourceFactionId,
          crossFaction: true,
          dedupeKey: `${input.journeyId}:${input.identityId}:${peerFactionId}:${doubt.doubtEventId}`,
        });
      }
    }
  }

  return {
    factionStanding: standing,
    doubtedBy: input.doubtedBy,
    standingDeltas: deltas,
  };
}

/**
 * Compute the lifetime acceleration (in bps) implied by a viability snapshot.
 *
 *  - social_death flip → {@link SOCIAL_DEATH_LIFETIME_ACCELERATION_BPS}
 *    (10_000; drains remaining lifetime to 0 next tick). Fires exactly once,
 *    guarded by socialDeathTriggered.
 *  - stressed (NOT first-flip into social_death) → quadratic curve
 *    `clamp(round((STRESSED_THRESHOLD_BPS - score)^2 / 10_000), 0, 5_000)`.
 *    Mild stress barely accelerates; severe stress (score near 0) hits the
 *    5_000 bps cap. The cap prevents a stressed death-spiral from skipping
 *    the archive/reincarnation narrative.
 *  - healthy (or social_death without trigger) → 0.
 *
 * This is the ONLY field downstream systems consume to age an identity faster;
 * they must not re-derive it from before/after. Anti-loop: the acceleration
 * derived here feeds future lifetime projections only — it never re-enters the
 * current settlement's ConsequenceScore.
 */
export function computeLifetimeAcceleration(
  input: LifetimeAccelerationInput,
): number {
  if (input.socialDeathTriggered) {
    return SOCIAL_DEATH_LIFETIME_ACCELERATION_BPS;
  }
  if (input.status === "stressed") {
    const deficit = STRESSED_THRESHOLD_BPS - clampBps(input.viabilityScoreBps);
    if (deficit <= 0) return 0;
    const raw = Math.round((deficit * deficit) / 10_000);
    return Math.min(STRESSED_LIFETIME_ACCELERATION_CAP_BPS, Math.max(0, raw));
  }
  return 0;
}

/**
 * Compose a full {@link IdentityViabilityProjection} from a before/after pair.
 * Computes {@link IdentityViabilityProjection.deltaBps},
 * {@link IdentityViabilityProjection.lifetimeAccelerationBps}, and
 * {@link IdentityViabilityProjection.socialDeathTriggered} from the pair.
 *
 * socialDeathTriggered is true iff before.status !== "social_death" AND
 * after.status === "social_death". This guarantees the side-effect fires
 * exactly once across the identity's lifetime (the projection that crosses
 * the threshold), regardless of how many settlements occur afterwards.
 *
 * Anti-loop: this helper takes no SettlementContext parameter and reads no
 * current-round lifetime delta — the projection is composed purely from
 * pre/post snapshots, so the acceleration it implies cannot feed back into
 * the settlement that produced it.
 */
export function deriveViabilityProjection(
  identityId: string,
  before: IdentityViability,
  after: IdentityViability,
  sourceSettlementId: string,
): IdentityViabilityProjection {
  const socialDeathTriggered =
    before.status !== "social_death" && after.status === "social_death";
  const lifetimeAccelerationBps = computeLifetimeAcceleration({
    status: after.status,
    viabilityScoreBps: after.viabilityScoreBps,
    socialDeathTriggered,
  });
  return {
    identityId,
    before,
    after,
    deltaBps: after.viabilityScoreBps - before.viabilityScoreBps,
    lifetimeAccelerationBps,
    socialDeathTriggered,
    sourceSettlementId,
    policyVersion: VIABILITY_POLICY_VERSION,
  };
}

/**
 * Initial viability snapshot issued at identity creation / reincarnation.
 * Fresh identity: viabilityScoreBps=10_000, status="healthy",
 * factionStanding={}, flaggedWanted=∅, identityExposed=false, doubtedBy={}.
 *
 * Reincarnation reset: on `reincarnation_issued`, the new identity is created
 * with this snapshot. The old identity's projection history is sealed in the
 * archive; factionStanding / doubtedBy / flaggedWanted / identityExposed are
 * NOT inherited via EpochLineageInheritance (spec §11 '社会恶名不继承').
 */
export function initialIdentityViability(
  identityId: string,
  projectedAt: string,
): IdentityViability {
  return {
    identityId,
    factionStanding: {},
    flaggedWanted: new Set<string>(),
    identityExposed: false,
    doubtedBy: {},
    viabilityScoreBps: 10_000,
    status: "healthy",
    policyVersion: VIABILITY_POLICY_VERSION,
    projectedAt,
  };
}

/**
 * Server-attested reference to the viability projection that triggered a
 * lifetime_adjusted event. Required for the reserved reason strings; the
 * lifetimeAdjustedPayload helper refuses to emit the reserved reasons
 * without it.
 *
 * Anti-loop: the ref is anchored at the projection's source settlement id
 * so the apply path can defensively verify that a preceding
 * identity_viability_projected event exists on the same identity.
 */
export interface ViabilityTriggerRef {
  /** Settlement decision that produced the triggering projection. */
  readonly sourceSettlementId: string;
  /** The projection's lifetimeAccelerationBps value, frozen for replay audit. */
  readonly lifetimeAccelerationBps: number;
  /** True when the trigger is a social-death flip; false for stressed acceleration. */
  readonly socialDeathTriggered: boolean;
}

/**
 * Output of {@link deriveViabilityTrigger}. Describes the lifetime_adjusted
 * event the runtime should emit (or `null` when no viability-driven
 * adjustment applies).
 *
 *  - `delta` is the signed lifetime delta to apply. Social-death drains
 *    remaining lifetime to 0; stressed acceleration is
 *    `-ceil(max * lifetimeAccelerationBps / 1_000_000)` with a minimum
 *    magnitude of 1 when `lifetimeAccelerationBps > 0` and `remaining > 0`.
 *  - `reason` is one of the two reserved server-only reason strings.
 *  - `viabilityTriggerRef` is the server-attested ref the planner forwards
 *    to {@link LifetimeAdjustedPayload.viabilityTriggerRef}; MCP callers
 *    cannot forge this channel because they cannot supply the ref.
 */
export interface ViabilityLifetimeTrigger {
  readonly delta: number;
  readonly reason:
    | typeof LIFETIME_REASON_IDENTITY_VIABILITY_ACCELERATION
    | typeof LIFETIME_REASON_IDENTITY_VIABILITY_SOCIAL_DEATH;
  readonly viabilityTriggerRef: ViabilityTriggerRef;
}

/**
 * Derive the lifetime adjustment (if any) that the runtime should emit for
 * one identity given a completed viability projection.
 *
 * Rules (mirrors lifetimeTriggerRules in the spec):
 *  - social-death flip (projection.socialDeathTriggered): emit ONE
 *    lifetime_adjusted with delta = -remaining and reason
 *    `identity_viability_social_death`. The existing lifetimeAdjustmentEvents
 *    path then archives the identity (remaining === 0) and triggers
 *    reincarnation_issued.
 *  - stressed (status === 'stressed', NOT first-flip into social_death):
 *    emit lifetime_adjusted with delta =
 *    `-ceil(max * lifetimeAccelerationBps / 1_000_000)` and reason
 *    `identity_viability_acceleration`. Minimum magnitude of 1 when
 *    lifetimeAccelerationBps > 0 and remaining > 0 so a stressed identity
 *    always moves.
 *  - healthy: no-op (return null). Normal lifetime tick (if any) continues
 *    unchanged.
 *
 * Anti-loop: this function is computed AFTER SettlementDecision completes.
 * The delta it returns feeds the NEXT journey's lifetime tick, not the
 * current settlement's selfLossContributions. The runtime MUST NOT push an
 * entry into ctx.selfLossContributions for the returned delta.
 *
 * Acceleration is bounded: lifetimeAccelerationBps is capped at 5_000 for
 * 'stressed' and at 10_000 for the single social-death flip. An identity
 * cannot lose more than `remaining` lifetime in one settlement (the caller
 * clamps via Math.max(0, ...) downstream).
 *
 * Pure: same inputs → same output. No IO, no gameCore import.
 */
export function deriveViabilityTrigger(
  projection: IdentityViabilityProjection,
  lifetime: { readonly max: number; readonly remaining: number },
): ViabilityLifetimeTrigger | null {
  if (projection.socialDeathTriggered) {
    return {
      delta: -Math.max(0, lifetime.remaining),
      reason: LIFETIME_REASON_IDENTITY_VIABILITY_SOCIAL_DEATH,
      viabilityTriggerRef: {
        sourceSettlementId: projection.sourceSettlementId,
        lifetimeAccelerationBps: projection.lifetimeAccelerationBps,
        socialDeathTriggered: true,
      },
    };
  }
  if (projection.after.status === "stressed" && projection.lifetimeAccelerationBps > 0) {
    if (lifetime.remaining <= 0) return null;
    const raw = Math.ceil((lifetime.max * projection.lifetimeAccelerationBps) / 1_000_000);
    // Minimum magnitude of 1 so a stressed identity always moves.
    const magnitude = Math.max(1, raw);
    return {
      delta: -Math.min(lifetime.remaining, magnitude),
      reason: LIFETIME_REASON_IDENTITY_VIABILITY_ACCELERATION,
      viabilityTriggerRef: {
        sourceSettlementId: projection.sourceSettlementId,
        lifetimeAccelerationBps: projection.lifetimeAccelerationBps,
        socialDeathTriggered: false,
      },
    };
  }
  return null;
}
