/**
 * journeyMirrorLedger.ts — PR2 pure mirror-consequence ledger.
 *
 * Single source of truth for the journey-scoped record of mirror-world
 * side effects produced by hosted actions. The ledger is a pure data
 * container: it does not construct canonical events, does not depend on
 * gameCore / eventFactory, and imports only type definitions from
 * {@link "./journeySettlementRules.ts"} (PR1) plus `node:crypto` for the
 * deterministic entry-id derivation.
 *
 * Invariants enforced here:
 * - **Append idempotency** — replaying the same action event must not
 *   double-count. The composite key `actionEventId + dedupeKey` is
 *   authoritative; {@link appendMirrorConsequence} is a no-op on hits.
 * - **Promotion atomicity** — once an entry has been promoted to a
 *   canonical event id, it cannot be re-appended or re-promoted to a
 *   different canonical id. {@link markMirrorConsequencePromoted} throws
 *   on the conflict case and is a no-op on identical re-play.
 * - **Discard finality** — discard marks every non-promoted entry as
 *   discarded. Promoted entries survive discard (promotion is an
 *   unrescindable commit).
 * - **Single derivation of dedupe keys** — callers MUST go through
 *   {@link deriveMirrorConsequenceDedupeKey}; free-text keys are
 *   rejected by contract. This keeps the idempotency key authoritative.
 *
 * Integration boundary: the ledger only stores and selects entries. The
 * solidify integration (PR3+) calls {@link promoteMirrorConsequences}
 * to read the promotion candidates, builds the canonical events itself,
 * and writes each promotion back through
 * {@link markMirrorConsequencePromoted}.
 */

import { createHash } from "node:crypto";

import type {
  ConsequenceEffectKind,
  ConsequenceType,
  MirrorConsequenceLedgerEntry,
} from "./journeySettlementRules.ts";

/**
 * Internal container shape for one journey's mirror ledger. Treat this
 * as opaque outside this module — readers must use the helpers below so
 * the idempotency / promotion invariants remain enforced.
 */
export interface MirrorConsequenceLedgerState {
  /** Owning journey id; scopes all entry-id derivations. */
  readonly journeyId: string;
  /** Entries indexed by their stable {@link deriveMirrorConsequenceEntryId}. */
  readonly entriesById: Readonly<Record<string, MirrorConsequenceLedgerEntry>>;
  /** entryId -> canonical event id that absorbed the entry on promotion. */
  readonly promotedCanonicalEventIds: Readonly<Record<string, string>>;
  /** entryIds discarded by {@link discardAllMirrorConsequences}. */
  readonly discardedEntryIds: ReadonlySet<string>;
}

/** Options accepted by {@link listMirrorConsequences}. */
export interface ListMirrorConsequencesOptions {
  /** Include discarded entries (default: false). */
  readonly includeDiscarded?: boolean;
  /** Include promoted entries (default: false). */
  readonly includePromoted?: boolean;
  /** Restrict to one effect kind. */
  readonly filterEffectKind?: ConsequenceEffectKind;
  /** Restrict to one consequence bucket. */
  readonly filterConsequenceType?: ConsequenceType;
}

/** Selection result returned by {@link promoteMirrorConsequences}. */
export interface PromoteMirrorConsequencesSelection {
  /**
   * Collateral entries that are not discarded and not yet promoted,
   * sorted by `recordedAt + entryId` for deterministic promotion order.
   */
  readonly entriesToPromote: readonly MirrorConsequenceLedgerEntry[];
  /**
   * Ledger reference after selection. Selection is a pure read; the
   * ledger state is unchanged. Promotion writes happen through
   * {@link markMirrorConsequencePromoted}.
   */
  readonly ledgerAfterSelection: MirrorConsequenceLedgerState;
}

/**
 * Return an empty ledger scoped to `journeyId`. Used when a journey has no
 * mirror consequences yet.
 */
export function emptyMirrorConsequenceLedger(journeyId: string): MirrorConsequenceLedgerState {
  return {
    journeyId,
    entriesById: {},
    promotedCanonicalEventIds: {},
    discardedEntryIds: new Set<string>(),
  };
}

/**
 * Derive the canonical dedupe key for one effect.
 *
 * Callers MUST pass `targetEntityId` / `scopeKey` formatted per the
 * effect-kind convention documented inline below. The function is the
 * single derivation point: rejecting free-text keys here is what keeps
 * replay idempotent.
 *
 * Effect kinds `resource_spent` and `lifetime_adjusted` are refused —
 * those buckets never enter the ledger (their canonical event is the
 * sole source of truth for self-loss).
 */
export function deriveMirrorConsequenceDedupeKey(input: {
  readonly effectKind: ConsequenceEffectKind;
  readonly targetEntityId: string;
  readonly actionEventId: string;
  readonly scopeKey?: string;
}): string {
  const { effectKind, targetEntityId, actionEventId } = input;
  const scopeKey = input.scopeKey ?? "";
  if (!actionEventId) {
    throw new Error("journey_mirror_ledger_dedupe_key_empty_action_event_id");
  }
  switch (effectKind) {
    case "region_influence_delta": {
      // target=`region:${regionId}`, scope=`agent:${agentId}`
      const regionId = stripPrefix(targetEntityId, "region:");
      const agentId = stripPrefix(scopeKey, "agent:");
      requireCarrier(regionId, "regionId");
      requireCarrier(agentId, "agentId");
      return `region_influence:${regionId}:${agentId}:${actionEventId}`;
    }
    case "trace_created": {
      // target=`region:${regionId}`, scope=`${journeyId}:${episodeId}`
      const regionId = stripPrefix(targetEntityId, "region:");
      requireCarrier(regionId, "regionId");
      requireCarrier(scopeKey, "scopeKey");
      const sep = scopeKey.indexOf(":");
      if (sep <= 0) {
        throw new Error("journey_mirror_ledger_dedupe_key_invalid_trace_scope");
      }
      const journeyId = scopeKey.slice(0, sep);
      const episodeId = scopeKey.slice(sep + 1);
      if (!journeyId || !episodeId) {
        throw new Error("journey_mirror_ledger_dedupe_key_invalid_trace_scope");
      }
      return `trace:${regionId}:${journeyId}:${episodeId}:${actionEventId}`;
    }
    case "faction_standing_delta": {
      // target=`faction:${agentId}:${factionId}`, scope=`route:${routeId}`
      // (agentId embedded in target so the key can be assembled without
      // extending the input signature with extra fields.)
      const compound = stripPrefix(targetEntityId, "faction:");
      requireCarrier(compound, "factionTarget");
      const sep = compound.indexOf(":");
      if (sep <= 0) {
        throw new Error("journey_mirror_ledger_dedupe_key_invalid_faction_target");
      }
      const agentId = compound.slice(0, sep);
      const factionId = compound.slice(sep + 1);
      if (!agentId || !factionId) {
        throw new Error("journey_mirror_ledger_dedupe_key_invalid_faction_target");
      }
      const routeId = stripPrefix(scopeKey, "route:");
      requireCarrier(routeId, "routeId");
      return `faction_standing:${agentId}:${factionId}:${routeId}:${actionEventId}`;
    }
    case "npc_relationship_delta": {
      // target=`npc:${npcKey}`, scope=`${agentId}:${bondTier}:${journeyId}`
      // NPC relationship deltas accumulate per-action: the dedupeKey
      // includes actionEventId so two actions on the same NPC bond in one
      // journey land as distinct entries (matching the entryId derivation,
      // which hashes actionEventId+dedupeKey). PR3 may revisit this if
      // journey-level collapse is required — at that point both the
      // dedupeKey here AND deriveMirrorConsequenceEntryId must change in
      // lockstep, since dropping actionEventId from one but not the other
      // would create the very accumulation/expand asymmetry this module
      // exists to prevent.
      const npcKey = stripPrefix(targetEntityId, "npc:");
      requireCarrier(npcKey, "npcKey");
      requireCarrier(scopeKey, "scopeKey");
      const parts = scopeKey.split(":");
      if (parts.length !== 3 || parts.some((p) => !p)) {
        throw new Error("journey_mirror_ledger_dedupe_key_invalid_npc_scope");
      }
      const agentId = parts[0] as string;
      const bondTier = parts[1] as string;
      const journeyId = parts[2] as string;
      return `agent_npc_bond:${agentId}:${npcKey}:${bondTier}:${journeyId}:${actionEventId}`;
    }
    case "object_mutation":
    case "object_destroy": {
      const objectId = stripPrefix(targetEntityId, "object:");
      requireCarrier(objectId, "objectId");
      return `object_${effectKind}:${objectId}:${actionEventId}`;
    }
    case "hidden_prerequisite_destroyed": {
      const prereqObjectiveId = stripPrefix(targetEntityId, "hidden:");
      requireCarrier(prereqObjectiveId, "prereqObjectiveId");
      return `hidden_prereq:${prereqObjectiveId}:${actionEventId}`;
    }
    case "identity_doubt": {
      const agentId = stripPrefix(targetEntityId, "identity:");
      requireCarrier(agentId, "agentId");
      return `identity_doubt:${agentId}:${actionEventId}`;
    }
    case "resource_spent":
    case "lifetime_adjusted":
      throw new Error(
        `journey_mirror_ledger_dedupe_key_unsupported_effect_kind:${effectKind}`,
      );
    default: {
      const _exhaustive: never = effectKind;
      throw new Error(
        `journey_mirror_ledger_dedupe_key_unhandled_effect_kind:${String(_exhaustive)}`,
      );
    }
  }
}

/**
 * Derive the stable primary key for a ledger entry. Replays of the same
 * `(journeyId, actionEventId, dedupeKey)` triple MUST yield the same
 * entryId so that {@link appendMirrorConsequence} can de-duplicate via
 * the entriesById index.
 *
 * Format: `mcle:${journeyId}:${sha256(actionEventId + dedupeKey)[:16]}`
 */
export function deriveMirrorConsequenceEntryId(input: {
  readonly journeyId: string;
  readonly actionEventId: string;
  readonly dedupeKey: string;
}): string {
  if (!input.journeyId) {
    throw new Error("journey_mirror_ledger_entry_id_empty_journey_id");
  }
  if (!input.actionEventId) {
    throw new Error("journey_mirror_ledger_entry_id_empty_action_event_id");
  }
  if (!input.dedupeKey) {
    throw new Error("journey_mirror_ledger_entry_id_empty_dedupe_key");
  }
  const digest = createHash("sha256")
    .update(`${input.actionEventId}${input.dedupeKey}`, "utf8")
    .digest("hex")
    .slice(0, 16);
  return `mcle:${input.journeyId}:${digest}`;
}

/**
 * Append `entry` to the ledger idempotently.
 *
 * Decision tree (in order):
 * 1. If an entry with the same `actionEventId + dedupeKey` already
 *    exists, this is a replay — return the ledger unchanged.
 * 2. If the entry's id is in `discardedEntryIds`, the entry was
 *    discarded — no-op (defensive; should not happen on a healthy
 *    stream).
 * 3. If the entry's id is in `promotedCanonicalEventIds`, the entry
 *    was already promoted — appending after promotion is a contract
 *    violation; throw.
 * 4. Otherwise, insert into `entriesById`.
 *
 * Note: because {@link deriveMirrorConsequenceEntryId} is deterministic
 * on `(actionEventId, dedupeKey)`, rule (1) and an entryId collision
 * are equivalent — the same composite key always lands at the same
 * entryId.
 */
export function appendMirrorConsequence(
  ledger: MirrorConsequenceLedgerState,
  entry: MirrorConsequenceLedgerEntry,
): MirrorConsequenceLedgerState {
  const entryId = deriveMirrorConsequenceEntryId({
    journeyId: ledger.journeyId,
    actionEventId: entry.actionEventId,
    dedupeKey: entry.dedupeKey,
  });

  // Rule (1): replay of the same composite key is a no-op.
  const existing = ledger.entriesById[entryId];
  if (existing !== undefined) {
    if (
      existing.actionEventId === entry.actionEventId &&
      existing.dedupeKey === entry.dedupeKey
    ) {
      return ledger;
    }
    // entryId collision with a different composite key — should be
    // impossible given the derivation, but fail loud if we ever hit it.
    throw new Error("journey_mirror_ledger_entry_id_collision");
  }

  // Rule (2): discarded entries are not re-added.
  if (ledger.discardedEntryIds.has(entryId)) {
    return ledger;
  }

  // Rule (3): promotion is final; appending afterwards is invalid.
  if (Object.prototype.hasOwnProperty.call(ledger.promotedCanonicalEventIds, entryId)) {
    throw new Error("journey_mirror_ledger_entry_already_promoted");
  }

  // Rule (4): insert.
  return {
    ...ledger,
    entriesById: { ...ledger.entriesById, [entryId]: entry },
  };
}

/**
 * List entries from the ledger, optionally including discarded and
 * promoted entries. Default scope is "live collateral candidates":
 * entries that are neither discarded nor promoted.
 *
 * Output is sorted by `recordedAt + entryId` for deterministic
 * downstream consumption.
 */
export function listMirrorConsequences(
  ledger: MirrorConsequenceLedgerState,
  options?: ListMirrorConsequencesOptions,
): readonly MirrorConsequenceLedgerEntry[] {
  const includeDiscarded = options?.includeDiscarded ?? false;
  const includePromoted = options?.includePromoted ?? false;
  const filterEffectKind = options?.filterEffectKind;
  const filterConsequenceType = options?.filterConsequenceType;

  const collected: MirrorConsequenceLedgerEntry[] = [];
  for (const [entryId, entry] of Object.entries(ledger.entriesById)) {
    if (!includeDiscarded && ledger.discardedEntryIds.has(entryId)) continue;
    if (
      !includePromoted &&
      Object.prototype.hasOwnProperty.call(ledger.promotedCanonicalEventIds, entryId)
    ) {
      continue;
    }
    if (filterEffectKind !== undefined && entry.effectKind !== filterEffectKind) continue;
    if (filterConsequenceType !== undefined && entry.consequenceType !== filterConsequenceType) {
      continue;
    }
    collected.push(entry);
  }
  // Decorate-sort-undecorate: derive each entryId exactly once rather than
  // recomputing the sha256 inside the comparator (which would scale
  // O(n log n) hash computations). The entryId is the documented stable
  // tiebreaker after `recordedAt`.
  const decorated = collected.map((entry) => ({
    entry,
    entryId: deriveMirrorConsequenceEntryId({
      journeyId: ledger.journeyId,
      actionEventId: entry.actionEventId,
      dedupeKey: entry.dedupeKey,
    }),
  }));
  decorated.sort((a, b) => {
    const byTime = a.entry.recordedAt < b.entry.recordedAt
      ? -1
      : a.entry.recordedAt > b.entry.recordedAt
        ? 1
        : 0;
    if (byTime !== 0) return byTime;
    return a.entryId < b.entryId ? -1 : a.entryId > b.entryId ? 1 : 0;
  });
  return decorated.map((item) => item.entry);
}

/**
 * Convenience helper: collateral entries that are still pending
 * promotion (not discarded, not promoted). Equivalent to
 * `listMirrorConsequences(ledger, { filterConsequenceType: 'collateral' })`.
 */
export function listPending(
  ledger: MirrorConsequenceLedgerState,
): readonly MirrorConsequenceLedgerEntry[] {
  return listMirrorConsequences(ledger, { filterConsequenceType: "collateral" });
}

/**
 * Mark every non-promoted entry as discarded. Promoted entries survive:
 * promotion is an unrescindable commit to shared world state and cannot
 * be reverted by discard.
 */
export function discardAllMirrorConsequences(
  ledger: MirrorConsequenceLedgerState,
): MirrorConsequenceLedgerState {
  const next = new Set(ledger.discardedEntryIds);
  for (const entryId of Object.keys(ledger.entriesById)) {
    if (Object.prototype.hasOwnProperty.call(ledger.promotedCanonicalEventIds, entryId)) {
      continue;
    }
    next.add(entryId);
  }
  if (next.size === ledger.discardedEntryIds.size) {
    return ledger;
  }
  return { ...ledger, discardedEntryIds: next };
}

/**
 * Select the entries eligible for promotion. Pure read — the ledger
 * state is returned unchanged as {@link PromoteMirrorConsequencesSelection.ledgerAfterSelection}.
 * The caller writes each promotion back through
 * {@link markMirrorConsequencePromoted} after constructing the
 * matching canonical event.
 *
 * Eligible: `consequenceType === 'collateral'` AND not discarded AND
 * not already promoted.
 */
export function promoteMirrorConsequences(
  ledger: MirrorConsequenceLedgerState,
): PromoteMirrorConsequencesSelection {
  const entriesToPromote = listMirrorConsequences(ledger, {
    filterConsequenceType: "collateral",
  });
  return {
    entriesToPromote,
    ledgerAfterSelection: ledger,
  };
}

/**
 * Atomically mark one entry as promoted to `canonicalEventId`.
 *
 * - Idempotent: re-marking the same entryId with the same canonical id
 *   is a no-op.
 * - Conflict: re-marking with a different canonical id throws
 *   (`journey_mirror_ledger_entry_already_promoted`).
 * - Unknown entryId throws (`journey_mirror_ledger_entry_not_found`).
 * - Discarded entryId throws (`journey_mirror_ledger_entry_discarded`).
 */
export function markMirrorConsequencePromoted(
  ledger: MirrorConsequenceLedgerState,
  entryId: string,
  canonicalEventId: string,
): MirrorConsequenceLedgerState {
  if (!entryId) {
    throw new Error("journey_mirror_ledger_promote_empty_entry_id");
  }
  if (!canonicalEventId) {
    throw new Error("journey_mirror_ledger_promote_empty_canonical_event_id");
  }
  if (!Object.prototype.hasOwnProperty.call(ledger.entriesById, entryId)) {
    throw new Error("journey_mirror_ledger_entry_not_found");
  }
  if (ledger.discardedEntryIds.has(entryId)) {
    throw new Error("journey_mirror_ledger_entry_discarded");
  }
  const existing = ledger.promotedCanonicalEventIds[entryId];
  if (existing !== undefined) {
    if (existing === canonicalEventId) {
      return ledger;
    }
    throw new Error("journey_mirror_ledger_entry_already_promoted");
  }
  return {
    ...ledger,
    promotedCanonicalEventIds: { ...ledger.promotedCanonicalEventIds, [entryId]: canonicalEventId },
  };
}

/**
 * Defensive invariant check. Call before solidify commit and from test
 * harnesses.
 *
 * Verifies:
 * 1. Every promoted entryId resolves to exactly one canonical id (the
 *    record shape guarantees this structurally; this is a no-op
 *    assertion documented for clarity).
 * 2. No two entries share the same `actionEventId + dedupeKey` composite
 *    (append enforces this for live entries; this scan iterates ALL
 *    entries in `entriesById`, including discarded ones, as a
 *    belt-and-braces catch against fabricated state).
 * 3. Every promoted entryId is present in `entriesById` (no orphan
 *    promotion records).
 */
export function assertNoDuplicatePromotion(ledger: MirrorConsequenceLedgerState): void {
  // (3) promotion keys must be a subset of entriesById.
  for (const entryId of Object.keys(ledger.promotedCanonicalEventIds)) {
    if (!Object.prototype.hasOwnProperty.call(ledger.entriesById, entryId)) {
      throw new Error("journey_mirror_ledger_promoted_entry_missing");
    }
  }

  // (2) no duplicate composite keys across ALL entries (including
  // discarded ones — append enforces uniqueness for live inserts, this
  // scan is the belt-and-braces catch against fabricated state).
  const seen = new Set<string>();
  for (const entry of Object.values(ledger.entriesById)) {
    const composite = `${entry.actionEventId} ${entry.dedupeKey}`;
    if (seen.has(composite)) {
      throw new Error("journey_mirror_ledger_duplicate_composite_key");
    }
    seen.add(composite);
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function stripPrefix(value: string, prefix: string): string | undefined {
  if (value === prefix) return undefined;
  if (!value.startsWith(prefix)) return undefined;
  return value.slice(prefix.length);
}

function requireCarrier(value: string | undefined, name: string): asserts value is string {
  if (value === undefined || value.length === 0) {
    throw new Error(`journey_mirror_ledger_dedupe_key_missing_carrier:${name}`);
  }
}
