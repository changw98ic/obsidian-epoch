/**
 * journeyConsequenceScoring.ts — PR4 pure additive-bucket scoring.
 *
 * Single responsibility: turn a {@link SettlementContext} into a frozen
 * {@link ConsequenceScore}. This is the ONLY module that derives
 * {@link ConsequenceBreakdown.resultScoreBps} / {@link ConsequenceBreakdown.selfLossScoreBps}
 * / {@link ConsequenceBreakdown.collateralScoreBps} / {@link ConsequenceBreakdown.totalBps}.
 * Downstream layers (tier / reward / world-commit, in
 * `journeySettlementDecision.ts`) read but never re-derive these numbers.
 *
 * Hard constraints enforced here:
 * - **Pure function.** No IO, no eventFactory, no gameCore imports. The module
 *   imports only type definitions and `node:crypto` for the canonical replay
 *   digest.
 * - **Zero-affinity / zero-strategy.** The function reads only
 *   {@link SettlementContext.resultComponentInputs},
 *   {@link SettlementContext.selfLossContributions} and
 *   {@link SettlementContext.mirrorLedgerEntries}. The audit-only
 *   `strategyConsistencySnapshot` field is structurally ignored.
 * - **Physical verdict floor.** `mainLineSucceeded === false` does NOT zero
 *   the result component here — the breakdown stays auditable. The
 *   {@link HiddenClamp} recorded on the score exposes the cap; the actual
 *   tier clamp is applied in `deriveSettlementDecision` (PR4).
 *
 * Self-loss de-duplication ({@link selfLossDedupRules}) is the caller's
 * responsibility: {@link SettlementContext.selfLossContributions} MUST arrive
 * pre-deduplicated per `(actionEventId, costKind)`. This module applies a
 * defensive second dedupe pass so a duplicated tuple cannot inflate the
 * score even if the upstream contract is violated.
 */

import { createHash } from "node:crypto";

import {
  CONSEQUENCE_SCORE_POLICY_VERSION,
  type ConsequenceBreakdown,
  type ConsequenceScore,
  type ConsequenceEffectKind,
  type HiddenClamp,
  type MirrorConsequenceLedgerEntry,
  type SelfLossContribution,
  type SelfLossSourceKind,
  type SettlementContext,
} from "./journeySettlementRules.ts";
import { DOUBT_PENALTY_BPS } from "./journeyViabilityRules.ts";
import type { DoubtStrength } from "./journeyRoleplayRules.ts";

// ---------------------------------------------------------------------------
// Versioned placeholder constants (Step 16 tunes; bumping ships as a policy
// version bump → replaySettlement divergence detection fires).
// ---------------------------------------------------------------------------

/**
 * Additive weights for the result bucket. Sum is exactly 1.0 so a perfect run
 * (10_000 bps on every component) saturates the result bucket at 10_000.
 *
 * Versioned via {@link CONSEQUENCE_SCORE_POLICY_VERSION}.
 */
export const RESULT_WEIGHT_MAIN = 0.6 as const;
export const RESULT_WEIGHT_SIDE = 0.2 as const;
export const RESULT_WEIGHT_EXEC = 0.2 as const;

/**
 * Bps charged per unit of paid resource (focus / stamina). Placeholder tuned
 * in Step 16; e.g. paying 5 focus yields `5 * 200 = 1000` bps of self-loss.
 */
export const RESOURCE_SELFLOSS_BPS_PER_UNIT = 200 as const;

/**
 * Bps charged per point of paid lifetime (negative `lifetimeDelta`).
 * Placeholder tuned in Step 16.
 */
export const LIFETIME_SELFLOSS_BPS_PER_POINT = 10 as const;

/**
 * Hard cap on the cumulative self-loss bucket. Self-loss is monotonic
 * non-decreasing across actions (Rule 7: no wash-trading); the cap bounds
 * the worst-case drain so a death-spiral cannot drag totalBps below zero
 * faster than the clamp can recover.
 */
export const SELFLOSS_CAP_BPS = 3_000 as const;

/**
 * Per-effect-kind weight table (in bps magnitude units) for the collateral
 * bucket. Signs are applied separately via `sign(delta)`; the magnitude
 * factor normalises the delta into `[0, 1]` so the entry contributes
 * `weight * sign * magnitudeFactor`.
 *
 * Heavily-negative kinds (`hidden_prerequisite_destroyed`, `identity_doubt`)
 * are PR4 placeholder weights; Step 16 calibrates the real numbers.
 *
 * `resource_spent` and `lifetime_adjusted` are intentionally absent: the
 * ledger refuses those kinds (they are self-loss, scored in the self-loss
 * bucket) and the scoring function throws if they ever surface here.
 */
export const COLLATERAL_WEIGHT_BPS_V1: Readonly<Record<Exclude<ConsequenceEffectKind, "resource_spent" | "lifetime_adjusted">, number>> = Object.freeze({
  object_mutation: 50,
  object_destroy: -300,
  faction_standing_delta: 80,
  npc_relationship_delta: 60,
  region_influence_delta: 40,
  hidden_prerequisite_destroyed: -1_500,
  identity_doubt: -1_000,
  trace_created: -100,
});

/** Lower bound on the collateral bucket; keeps totalBps bounded. */
export const COLLATERAL_FLOOR_BPS = -2_000 as const;
/**
 * PR5b cap on the cumulative identity_doubt contribution to the collateral
 * bucket. Spec §6.9: a single journey can contribute at most one severe
 * doubt's worth of collateral penalty (4_000 bps) so a solo-kill via doubt
 * accumulation is impossible. Doubt beyond this cap still aggregates into
 * RoleplayScore / viability doubtedBy (uncapped at the score layer) but the
 * CURRENT settlement's collateral bucket is bounded.
 *
 * Bumping this cap MUST bump BOTH {@link CONSEQUENCE_SCORE_POLICY_VERSION}
 * (the score bytes change) AND {@link VIABILITY_POLICY_VERSION} in
 * journeyViabilityRules (the doubt aggregation changes).
 */
export const IDENTITY_DOUBT_COLLATERAL_CAP_BPS = 4_000 as const;

/** Upper bound on the collateral bucket. */
export const COLLATERAL_CAP_BPS = 1_500 as const;

/**
 * Normalised magnitude factor for a signed delta. Maps `|delta|` into `[0, 1]`
 * via a soft clip so small deltas contribute fractionally while large deltas
 * saturate. PR4 placeholder: `min(1, |delta| / 10)`.
 */
export function collateralMagnitudeFactor(delta: number): number {
  if (!Number.isFinite(delta)) return 0;
  return Math.min(1, Math.abs(delta) / 10);
}

// ---------------------------------------------------------------------------
// BANLIST — enforced at runtime so a fabricated ctx cannot leak affinity or
// strategy into the score.
// ---------------------------------------------------------------------------

const SETTLEMENT_CONTEXT_BANNED_FIELDS = Object.freeze([
  "affinityBonusBps",
  "strategyRewardModifier",
  "strategyAffinity",
  "fitBps",
  "expectedApproach",
] as const);

const SETTLEMENT_CONTEXT_AUDIT_ONLY_FIELDS = Object.freeze([
  "strategyConsistencySnapshot",
] as const);

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function clamp(value: number, floor: number, ceil: number): number {
  if (!Number.isFinite(value)) return floor;
  if (value < floor) return floor;
  if (value > ceil) return ceil;
  return value;
}

/**
 * Assert that {@link ctx} carries no banned field. The check is structural
 * (it inspects own-keys) so an upstream bug that accidentally attaches a
 * banned field is caught before any score is computed.
 *
 * Audit-only fields ({@link SETTLEMENT_CONTEXT_AUDIT_ONLY_FIELDS}) are
 * permitted; the scoring function never reads them.
 */
function assertContextHasNoBannedFields(ctx: SettlementContext): void {
  const ownKeys = new Set(Object.keys(ctx));
  for (const banned of SETTLEMENT_CONTEXT_BANNED_FIELDS) {
    if (ownKeys.has(banned)) {
      throw new Error(`settlement_context_banned_field:${banned}`);
    }
  }
  for (const auditOnly of SETTLEMENT_CONTEXT_AUDIT_ONLY_FIELDS) {
    // Audit-only fields are tolerated; we never read them below.
    void auditOnly;
  }
}

/**
 * Compute {@link ConsequenceBreakdown.resultScoreBps}.
 *
 * Formula: `clamp(mainCompletionBps * W_MAIN + sideCompletionBps * W_SIDE
 * + executionQualityBps * W_EXEC - penaltyBps, 0, 10_000)`.
 *
 * `mainLineSucceeded === false` does NOT zero the component here — the
 * breakdown stays auditable. The HiddenClamp on the returned score records
 * the cap; the tier clamp is applied in `deriveSettlementDecision`.
 */
function computeResultScoreBps(ctx: SettlementContext): number {
  const { resultComponentInputs: rc } = ctx;
  const raw = rc.mainCompletionBps * RESULT_WEIGHT_MAIN
    + rc.sideCompletionBps * RESULT_WEIGHT_SIDE
    + rc.executionQualityBps * RESULT_WEIGHT_EXEC
    - rc.penaltyBps;
  return clamp(Math.round(raw), 0, 10_000);
}

/**
 * Defensive second-pass de-duplication of self-loss contributions per
 * `(actionEventId, costKind)`. Upstream is contractually required to apply
 * the dedup first (see selfLossDedupRules); this pass exists so a contract
 * violation cannot inflate the score. The FIRST occurrence per composite
 * key wins, mirroring Rule 2 / Rule 3's source-priority order.
 */
function dedupeSelfLossContributions(
  contributions: readonly SelfLossContribution[],
): readonly SelfLossContribution[] {
  const seen = new Set<string>();
  const out: SelfLossContribution[] = [];
  for (const contribution of contributions) {
    const key = `${contribution.actionEventId}::${contribution.costKind}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(contribution);
  }
  return out;
}

/**
 * Compute the self-loss additive bucket and the de-duplicated source-event
 * audit map. Applies Rules 1-8 from the PR4 spec:
 * - Rule 1: dedupe key is `(actionEventId, costKind)`.
 * - Rule 5: at most one source per tuple.
 * - Rule 7: lifetime gain does NOT offset loss (`max(0, -lifetimeDelta)`).
 * - Rule 8: a run with no paid contributions yields 0 bps and an empty map.
 *
 * Residual anti-loop risk (PR5a): this function is reason-blind. A
 * viability-triggered `lifetime_adjusted` event (reasons
 * `identity_viability_acceleration` /
 * `identity_viability_social_death`) carries a `viabilityTriggerRef` whose
 * `sourceSettlementId` MUST NOT match the current journey. If a future
 * integration bug fed such an event back into the SAME journey's
 * `ctx.selfLossContributions`, this bucket would score it as ordinary
 * self-loss and the settlement would pay for its own viability projection —
 * violating spec §6.8. PR5a cannot structurally prevent this: the
 * `SelfLossContribution` wire shape (frozen in PR4) carries no reason
 * field, so the scorer has no way to distinguish a viability-tagged event
 * from an ordinary one. The contract is enforced planner-side (see
 * `deriveViabilityTrigger` JSDoc) and defended at event-apply time in
 * `gameCore.ts` (reserved-reason guard + `sourceSettlementId` match check).
 *
 * Returns:
 * - `bps`: the SIGNED contribution to {@link ConsequenceBreakdown.selfLossScoreBps}.
 *   The magnitude is clamped to `[0, SELFLOSS_CAP_BPS]`; the contribution to
 *   `totalBps` is `-magnitude` (a cost reduces the score). PR1 fixtures
 *   encode the cost as a negative number; this implementation matches.
 * - `byKind`: audit map of which canonical event ids fell into each source
 *   bucket, for the breakdown record.
 */
function computeSelfLossBucket(
  ctx: SettlementContext,
): { readonly bps: number; readonly byKind: Readonly<Record<SelfLossSourceKind, readonly string[]>> } {
  const deduped = dedupeSelfLossContributions(ctx.selfLossContributions);
  const byKind: Record<SelfLossSourceKind, string[]> = {
    resource_cost: [],
    resource_spent_event: [],
    hosted_action_lifetime_delta: [],
    lifetime_adjusted_event: [],
  };
  let magnitude = 0;
  // Rule 1: dedup key is `(actionEventId, costKind)` (applied above). The
  // composite-key dedup is the only dedup pass — canonical-event-id overlap
  // across distinct (actionEventId, costKind) tuples is intentional and does
  // NOT collapse (a single canonical event may legitimately back two costs
  // of different kinds on the same action).
  for (const contribution of deduped) {
    if (contribution.costKind === "resource") {
      const units = contribution.resourceUnits ?? 0;
      if (units > 0) {
        magnitude += units * RESOURCE_SELFLOSS_BPS_PER_UNIT;
        byKind[contribution.sourceKind].push(...contribution.canonicalEventIds);
      }
    } else {
      // costKind === 'lifetime'
      const delta = contribution.lifetimeDelta ?? 0;
      // Rule 7: only the negative magnitude counts; gains do not offset.
      const paid = Math.max(0, -delta);
      if (paid > 0) {
        magnitude += paid * LIFETIME_SELFLOSS_BPS_PER_POINT;
        byKind[contribution.sourceKind].push(...contribution.canonicalEventIds);
      }
    }
    if (magnitude >= SELFLOSS_CAP_BPS) {
      magnitude = SELFLOSS_CAP_BPS;
      // Continue iterating so the byKind audit map still records every
      // contribution; the magnitude is capped.
    }
  }
  const clamped = clamp(magnitude, 0, SELFLOSS_CAP_BPS);
  // Contribution to totalBps is negative (a cost reduces the score). Adding
  // 0 avoids serialising -0 when there are no contributions (Rule 8).
  const contribution = clamped === 0 ? 0 : -clamped;
  return { bps: contribution, byKind };
}

/**
 * Apply the PR4 self-loss de-duplication rules to a raw contribution stream.
 * The rules are:
 * - Rule 1: dedupe key = `(actionEventId, costKind)`.
 * - Rule 5: at most one source per tuple (first occurrence wins).
 *
 * Exported so callers can validate an upstream dedup and so tests can
 * construct deduped inputs directly. The function is the canonical
 * reference implementation of the dedup rules; the scoring module applies a
 * defensive second pass internally.
 *
 * Sorting the input by source-priority BEFORE calling this function yields
 * the documented "Resource source priority" / "Lifetime source priority"
 * ordering (Rules 2 and 3). The function itself is priority-agnostic: it
 * takes whichever contribution wins the composite key first.
 */
export function applySelfLossDedupRules(
  contributions: readonly SelfLossContribution[],
): readonly SelfLossContribution[] {
  return dedupeSelfLossContributions(contributions);
}

/**
 * Compute the collateral additive bucket from the mirror ledger entries.
 *
 * Formula: `clamp(Σ COLLOERAL_WEIGHT_BPS[effectKind] * sign(delta)
 * * magnitudeFactor(delta), FLOOR, CAP)`. Per-kind weights come from the
 * versioned placeholder table {@link COLLATERAL_WEIGHT_BPS_V1}; the
 * magnitude factor normalises `|delta|` into `[0, 1]`.
 *
 * `resource_spent` and `lifetime_adjusted` entries are rejected at source by
 * the ledger's dedupe key derivation; defensively, this function throws if
 * such an entry reaches scoring (they are self-loss, not collateral).
 *
 * Returns the collateral bps and the contributing ledger entry IDs (for the
 * breakdown audit). Entry IDs are derived deterministically from the entry's
 * composite key so the audit list is replay-stable.
 */
function computeCollateralBucket(
  ctx: SettlementContext,
): { readonly bps: number; readonly entryIds: readonly string[] } {
  let cumulative = 0;
  let doubtCumulative = 0;
  const entryIds: string[] = [];
  for (const entry of ctx.mirrorLedgerEntries) {
    if (entry.consequenceType !== "collateral") continue;
    if (entry.effectKind === "resource_spent" || entry.effectKind === "lifetime_adjusted") {
      throw new Error(
        `journey_consequence_scoring_collateral_kind_is_self_loss:${entry.effectKind}`,
      );
    }
    if (entry.effectKind === "identity_doubt") {
      // PR5b: identity_doubt uses a special doubt-strength-driven path so the
      // collateral ruler matches viability doubtedBy aggregation exactly.
      // The blueprint's `effectBlueprint.doubtStrength` carries the
      // classification output; we sum DOUBT_PENALTY_BPS[strength] across all
      // promoted doubt entries and cap at IDENTITY_DOUBT_COLLATERAL_CAP_BPS
      // (single-journey severe cap, anti-solo-kill). The contribution to
      // cumulative is NEGATIVE (a doubt is a penalty). Anti-loop: doubt only
      // enters collateral from promoted mirror-ledger entries; it never
      // round-trips through the current settlement's selfLossContributions
      // (spec §6.8).
      const strength = entry.effectBlueprint["doubtStrength"] as DoubtStrength | undefined;
      if (strength === "low" || strength === "moderate" || strength === "high" || strength === "severe") {
        doubtCumulative += DOUBT_PENALTY_BPS[strength];
      }
      entryIds.push(deriveCollateralLedgerEntryId(ctx.journeyId, entry));
      continue;
    }
    const weight = COLLATERAL_WEIGHT_BPS_V1[entry.effectKind];
    const sign = Math.sign(entry.delta);
    const factor = collateralMagnitudeFactor(entry.delta);
    cumulative += weight * sign * factor;
    entryIds.push(deriveCollateralLedgerEntryId(ctx.journeyId, entry));
  }
  // Apply the per-journey identity_doubt cap BEFORE adding to cumulative so a
  // solo-kill via accumulated doubt is structurally impossible. The clamp is
  // on the magnitude; the contribution to cumulative is the negative
  // magnitude (penalty).
  const doubtMagnitude = clamp(doubtCumulative, 0, IDENTITY_DOUBT_COLLATERAL_CAP_BPS);
  cumulative += doubtMagnitude === 0 ? 0 : -doubtMagnitude;
  const bps = clamp(Math.round(cumulative), COLLATERAL_FLOOR_BPS, COLLATERAL_CAP_BPS);
  return { bps, entryIds };
}

/**
 * Deterministic entry ID for the collateral audit list. Mirrors the
 * {@link deriveMirrorConsequenceEntryId} composite-key derivation so the
 * breakdown audit list is stable under replay (any drift is caught by
 * `replaySettlement` in `journeySettlementDecision.ts`).
 */
function deriveCollateralLedgerEntryId(
  journeyId: string,
  entry: MirrorConsequenceLedgerEntry,
): string {
  const digest = createHash("sha256")
    .update(`${entry.actionEventId}${entry.dedupeKey}`, "utf8")
    .digest("hex")
    .slice(0, 16);
  return `mcle:${journeyId}:${digest}`;
}

/**
 * Derive the {@link HiddenClamp} for the score. The clamp is the only
 * mechanism that may downgrade a tier after the additive score is computed;
 * it is recorded on the score (not applied) so the breakdown stays auditable.
 *
 * - `mainLineSucceeded === false` → clamp to `未及格` (`reason: main_incomplete`).
 * - else `hiddenComplete === false` → clamp to `优秀` (`reason: hidden_incomplete`).
 * - else no clamp (`tierCap: 惊世`).
 *
 * {@link sourceHiddenObjectiveIds} is empty here because the source-hidden
 * objective IDs are derived upstream from the canonical hidden task seal;
 * the field is reserved for chronicle projection.
 */
function deriveHiddenClamp(ctx: SettlementContext): HiddenClamp {
  if (!ctx.mainLineSucceeded) {
    return {
      applied: true,
      reason: "main_incomplete",
      tierCap: "未及格",
      sourceHiddenObjectiveIds: [],
    };
  }
  if (!ctx.hiddenComplete) {
    return {
      applied: true,
      reason: "hidden_incomplete",
      tierCap: "优秀",
      sourceHiddenObjectiveIds: [...ctx.hiddenObjectiveIds],
    };
  }
  return { applied: false, tierCap: "惊世", sourceHiddenObjectiveIds: [] };
}

/**
 * Canonical JSON for the replay digest. Sorts keys recursively so the
 * digest is byte-stable across runs. Avoids `JSON.stringify`'s
 * insertion-order sensitivity.
 */
function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(record[k])}`).join(",")}}`;
}

/**
 * Compute the canonical replay digest for one {@link SettlementContext}. The
 * digest covers only the deterministic canonical subset (objective IDs,
 * completion flags, result-component inputs, self-loss contributions, mirror
 * ledger entries, canonical action event IDs). It excludes the audit-only
 * strategy snapshot and the optional roleplay / viability projections —
 * those are AFTER-settlement artifacts that do not affect the score.
 */
export function computeSettlementContextReplayDigest(
  ctx: SettlementContext,
): `sha256:${string}` {
  const canonicalSubset = {
    journeyId: ctx.journeyId,
    mainObjectiveIds: [...ctx.mainObjectiveIds].sort(),
    sideObjectiveIds: [...ctx.sideObjectiveIds].sort(),
    hiddenObjectiveIds: [...ctx.hiddenObjectiveIds].sort(),
    mainLineSucceeded: ctx.mainLineSucceeded,
    hiddenComplete: ctx.hiddenComplete,
    canonicalActionEventIds: [...ctx.canonicalActionEventIds].sort(),
    resultComponentInputs: ctx.resultComponentInputs,
    selfLossContributions: [...ctx.selfLossContributions].sort((a, b) => {
      const left = `${a.actionEventId}::${a.costKind}`;
      const right = `${b.actionEventId}::${b.costKind}`;
      return left < right ? -1 : left > right ? 1 : 0;
    }),
    mirrorLedgerEntries: [...ctx.mirrorLedgerEntries].sort((a, b) => {
      const left = `${a.actionEventId}${a.dedupeKey}`;
      const right = `${b.actionEventId}${b.dedupeKey}`;
      return left < right ? -1 : left > right ? 1 : 0;
    }),
    baseRewardBundle: ctx.baseRewardBundle,
    policyVersion: ctx.policyVersion,
  };
  const hash = createHash("sha256")
    .update(canonicalJson(canonicalSubset), "utf8")
    .digest("hex");
  return `sha256:${hash}`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build the frozen {@link ConsequenceScore} for one journey settlement.
 *
 * Contract:
 * - Pure function. No IO, no eventFactory, no gameCore.
 * - Reads only the additive-bucket inputs on {@link ctx}; ignores
 *   {@link SettlementContext.strategyConsistencySnapshot} (audit-only).
 * - Enforces the zero-affinity / zero-strategy banlist at runtime.
 * - `mainLineSucceeded === false` does NOT zero the result component; the
 *   HiddenClamp on the returned score records the cap.
 * - {@link ConsequenceBreakdown.totalBps} is computed exactly once here. No
 *   other field or module may re-derive it.
 *
 * @param ctx Frozen settlement context. See {@link SettlementContext}.
 * @returns Frozen consequence score with breakdown, hidden clamp, and policy
 *   version markers.
 */
export function buildConsequenceScore(ctx: SettlementContext): ConsequenceScore {
  assertContextHasNoBannedFields(ctx);

  const resultScoreBps = computeResultScoreBps(ctx);
  const selfLoss = computeSelfLossBucket(ctx);
  const collateral = computeCollateralBucket(ctx);
  // Defensive clamp on the sum; in normal ranges the sum already lies in
  // [0, 10_000]. The clamp guards against collateral-floor skewing the sum
  // below zero in a degenerate run.
  const totalBps = clamp(
    resultScoreBps + selfLoss.bps + collateral.bps,
    0,
    10_000,
  );

  const breakdown: ConsequenceBreakdown = {
    resultScoreBps,
    selfLossScoreBps: selfLoss.bps,
    collateralScoreBps: collateral.bps,
    totalBps,
    selfLossSourceEventsByKind: {
      resource_cost: Object.freeze([...selfLoss.byKind.resource_cost]),
      resource_spent_event: Object.freeze([...selfLoss.byKind.resource_spent_event]),
      hosted_action_lifetime_delta: Object.freeze([...selfLoss.byKind.hosted_action_lifetime_delta]),
      lifetime_adjusted_event: Object.freeze([...selfLoss.byKind.lifetime_adjusted_event]),
    },
    collateralLedgerEntryIds: Object.freeze([...collateral.entryIds]),
  };

  const hiddenClamp = deriveHiddenClamp(ctx);
  const roleplaySummary = ctx.roleplayScore
    ? {
        deviationBps: ctx.roleplayScore.deviationBps,
        doubtEventCount: ctx.roleplayScore.npcDoubtEvents.length,
        exposed: ctx.roleplayScore.exposed,
      }
    : undefined;

  return {
    breakdown,
    mainLineSucceeded: ctx.mainLineSucceeded,
    hiddenComplete: ctx.hiddenComplete,
    hiddenClamp,
    ...(roleplaySummary ? { roleplaySummary } : {}),
    policyVersion: CONSEQUENCE_SCORE_POLICY_VERSION,
    computedAt: canonicalTimestamp(ctx),
  };
}

/**
 * Deterministic timestamp source. PR4 uses a fixed epoch so the score is
 * byte-stable across replays; the chronicle layer rewrites the timestamp on
 * persistence (see journeyPersistence). The fixed epoch matches the
 * `generatedAt` convention used by `world-map-data.json`.
 */
function canonicalTimestamp(_ctx: SettlementContext): string {
  return "1970-01-01T00:00:00.000Z";
}
