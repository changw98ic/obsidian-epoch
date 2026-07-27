/**
 * journeyFeedbackRules.ts — PR6 world-feedback signal projection.
 *
 * Projects non-numeric, narrative-only feedback signals from the mirror ledger,
 * viability state, and canonical faction standing events. These signals are
 * injected into the agent's prompt so the agent can *feel* world reactions
 * without seeing any numeric score, bps value, or affinity number.
 *
 * Hard contracts (spec §5.2):
 * 1. NEVER leak score/bps/tier/affinity/fit values into prompt text.
 * 2. Feedback signals are deduplicated by `sourceEventId` — the same canonical
 *    event never produces two injections.
 * 3. Signals are journey-scoped: they accumulate within a journey and are
 *    cleaned up when the journey ends. Cross-journey canonical state (viability,
 *    standing) is carried by the identity layer, not through feedback projection.
 * 4. `toAgentFeedbackPromptContext` returns a pure narrative string with no
 *    numeric content. No LLM call — it is a static template mapper.
 *
 * Zero-bonus contract: this module does not participate in ConsequenceScore,
 * SettlementDecision, reward, or viability computation.
 */

import type { DoubtStrength } from "./journeyRoleplayRules.ts";

// ─── Types ──────────────────────────────────────────────────────────────────

/**
 * Discriminator for the kind of world feedback signal. Each kind maps to a
 * distinct narrative template in {@link toAgentFeedbackPromptContext}.
 */
export type FeedbackSignalKind =
  | "npc_cold"
  | "shut_out"
  | "followed"
  | "questioned"
  | "relationship_deteriorated"
  | "standing_changed"
  | "identity_exposed";

/**
 * One world-feedback signal, produced by {@link projectFeedbackSignals}.
 * Carries `sourceEventId` for deduplication (same event → same signal, never
 * double-injected) and `audienceIdentityId` for routing.
 */
export interface WorldFeedbackSignal {
  readonly kind: FeedbackSignalKind;
  /** Canonical event id that produced this signal. Used for dedup. */
  readonly sourceEventId: string;
  /** Identity that should perceive this signal. */
  readonly audienceIdentityId: string;
  /**
   * Template key for the narrative text. Not user-facing — used by
   * {@link toAgentFeedbackPromptContext} to select the narrative template.
   */
  readonly narrativeTextKey: FeedbackSignalKind;
  /** Optional reference to a world fact for audit. */
  readonly worldFactRef?: string;
  readonly createdAt: string;
}

/**
 * One NPC doubt entry extracted from the mirror ledger for feedback projection.
 * The caller is responsible for extracting these from the mirror ledger's
 * promoted identity_doubt entries; this module does not import mirror ledger
 * internals.
 */
export interface FeedbackDoubtEntry {
  readonly npcId: string;
  readonly doubtStrength: DoubtStrength;
  /** Source action event id that triggered this doubt. Used for dedup. */
  readonly sourceActionEventId: string;
  /** Optional region context. */
  readonly regionId?: string;
}

/**
 * One canonical faction standing delta event, post-solidify. Extracted by the
 * caller from the canonical event store.
 */
export interface FactionStandingDelta {
  readonly factionId: string;
  readonly delta: number;
  /** Canonical event id. Used for dedup. */
  readonly sourceEventId: string;
}

/**
 * Input to {@link projectFeedbackSignals}. All fields are already-settled world
 * state — nothing here is the player's claim.
 */
export interface FeedbackProjectionInput {
  readonly identityId: string;
  /**
   * NPC doubt entries from the mirror ledger (promoted identity_doubt entries).
   * The projector filters by doubtStrength threshold per signal kind.
   */
  readonly doubtEntries: readonly FeedbackDoubtEntry[];
  /**
   * Viability flags. The projector reads `flaggedWanted` for shut_out signals
   * and `identityExposed` for identity_exposed signals.
   */
  readonly viability: {
    readonly flaggedWanted: ReadonlySet<string>;
    readonly identityExposed: boolean;
  };
  /**
   * Canonical faction standing deltas (post-solidify). Each produces a
   * standing_changed signal.
   */
  readonly factionStandingDeltas: readonly FactionStandingDelta[];
  readonly projectedAt: string;
}

// ─── Doubt strength ordering ────────────────────────────────────────────────

/**
 * Numeric weight for doubt strength comparison. Higher = more severe.
 * Used internally for threshold checks; never exported to prompt text.
 */
const DOUBT_STRENGTH_WEIGHT: Readonly<Record<DoubtStrength, number>> = Object.freeze({
  low: 0,
  moderate: 1,
  high: 2,
  severe: 3,
});

function doubtAtLeast(actual: DoubtStrength, threshold: DoubtStrength): boolean {
  return DOUBT_STRENGTH_WEIGHT[actual] >= DOUBT_STRENGTH_WEIGHT[threshold];
}

// ─── Projection ─────────────────────────────────────────────────────────────

/**
 * PR6: Project world-feedback signals from already-settled world state.
 *
 * Sources:
 * - `doubtEntries` (mirror ledger identity_doubt promoted):
 *   - doubtStrength >= moderate → npc_cold
 *   - doubtStrength >= high, region-level → followed
 *   - doubtStrength moderate|high, npc-level → questioned
 *   - doubtStrength severe + viability.identityExposed → identity_exposed
 * - `viability.flaggedWanted` (non-empty) → shut_out
 * - `factionStandingDeltas` (each entry) → standing_changed
 * - doubtEntries with strength low (relationship delta < 0 proxy) →
 *   relationship_deteriorated (when doubt exists but is below moderate)
 *
 * Dedup: each `sourceEventId` produces at most one signal. If the same event
 * would produce multiple signal kinds, the most severe one wins (identity_exposed
 * > followed > npc_cold > questioned > relationship_deteriorated).
 *
 * Pure: same inputs → same output (modulo Set iteration order, which is
 * insertion-ordered in V8).
 */
export function projectFeedbackSignals(
  input: FeedbackProjectionInput,
): readonly WorldFeedbackSignal[] {
  const signals: WorldFeedbackSignal[] = [];
  const seenEventIds = new Set<string>();

  function addSignal(
    kind: FeedbackSignalKind,
    sourceEventId: string,
    worldFactRef?: string,
  ): void {
    if (seenEventIds.has(sourceEventId)) return;
    seenEventIds.add(sourceEventId);
    signals.push({
      kind,
      sourceEventId,
      audienceIdentityId: input.identityId,
      narrativeTextKey: kind,
      ...(worldFactRef !== undefined ? { worldFactRef } : {}),
      createdAt: input.projectedAt,
    });
  }

  // ── Viability-based signals ──

  // shut_out: identity is wanted in at least one region
  if (input.viability.flaggedWanted.size > 0) {
    // Use the first wanted region as the source reference.
    const firstRegion = [...input.viability.flaggedWanted][0]!;
    addSignal("shut_out", `wanted:${firstRegion}`, firstRegion);
  }

  // identity_exposed: identity is exposed AND has severe doubt
  if (input.viability.identityExposed) {
    const severeDoubt = input.doubtEntries.find(
      (entry) => entry.doubtStrength === "severe",
    );
    if (severeDoubt) {
      addSignal(
        "identity_exposed",
        severeDoubt.sourceActionEventId,
        severeDoubt.regionId,
      );
    }
  }

  // ── Doubt-based signals ──

  for (const entry of input.doubtEntries) {
    // Return if already consumed by identity_exposed
    if (seenEventIds.has(entry.sourceActionEventId)) continue;

    // followed: high+ doubt with region context
    if (doubtAtLeast(entry.doubtStrength, "high") && entry.regionId) {
      addSignal("followed", entry.sourceActionEventId, entry.regionId);
      continue;
    }

    // npc_cold: moderate+ doubt (general NPC coldness)
    if (doubtAtLeast(entry.doubtStrength, "moderate")) {
      addSignal("npc_cold", entry.sourceActionEventId, entry.npcId);
      continue;
    }
  }

  // questioned: separate pass for moderate|high doubt at NPC level
  // (not already consumed by followed/identity_exposed)
  for (const entry of input.doubtEntries) {
    if (seenEventIds.has(entry.sourceActionEventId)) continue;
    if (doubtAtLeast(entry.doubtStrength, "moderate") && !doubtAtLeast(entry.doubtStrength, "severe")) {
      addSignal("questioned", entry.sourceActionEventId, entry.npcId);
    }
  }

  // relationship_deteriorated: low doubt entries that haven't been consumed
  // (low doubt = relationship is strained but not yet cold)
  for (const entry of input.doubtEntries) {
    if (seenEventIds.has(entry.sourceActionEventId)) continue;
    if (entry.doubtStrength === "low") {
      addSignal("relationship_deteriorated", entry.sourceActionEventId, entry.npcId);
    }
  }

  // ── Faction standing signals ──

  for (const delta of input.factionStandingDeltas) {
    addSignal("standing_changed", delta.sourceEventId, delta.factionId);
  }

  return signals;
}

// ─── Prompt injection ───────────────────────────────────────────────────────

/**
 * Narrative templates for each signal kind. Chinese text; no numeric values.
 * The agent reads these as world feedback, not as data.
 */
const SIGNAL_NARRATIVE: Readonly<Record<FeedbackSignalKind, string>> = Object.freeze({
  npc_cold: "NPC对你的态度明显冷淡，不再主动回应你的招呼",
  shut_out: "你被当地势力拒之门外，无法正常进入该区域",
  followed: "你感觉有人在暗中跟踪你，当地人对你的行踪格外关注",
  questioned: "NPC向你追问身份和来历，你的回答未能完全消除对方的疑虑",
  relationship_deteriorated: "你与某位NPC的关系出现了裂痕，对方对你的信任有所下降",
  standing_changed: "你在该阵营中的声望发生了变化，阵营成员对你的态度随之调整",
  identity_exposed: "你的身份在当地已经暴露，继续使用该身份行动将面临更大风险",
});

/**
 * PR6: Convert an array of world-feedback signals into a non-numeric narrative
 * string for prompt injection. Each signal maps to a fixed Chinese template
 * via {@link SIGNAL_NARRATIVE}.
 *
 * Output example: "NPC对你态度冷淡；你被当地势力盘问过；你的身份在当地已被标记。"
 *
 * HARD CONTRACT: the output contains NO numeric values — no bps, scores, tiers,
 * affinity numbers, fit values, or viability scores. Only narrative text.
 *
 * Pure: same signals → same string (order-stable by input order).
 */
export function toAgentFeedbackPromptContext(
  signals: readonly WorldFeedbackSignal[],
): string {
  if (signals.length === 0) return "";
  const parts: string[] = [];
  const seen = new Set<FeedbackSignalKind>();
  for (const signal of signals) {
    if (seen.has(signal.kind)) continue; // dedup by kind for readability
    seen.add(signal.kind);
    const narrative = SIGNAL_NARRATIVE[signal.kind];
    if (narrative) parts.push(narrative);
  }
  if (parts.length === 0) return "";
  return parts.join("；") + "。";
}
