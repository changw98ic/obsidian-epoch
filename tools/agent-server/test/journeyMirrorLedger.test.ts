import assert from "node:assert/strict";
import test from "node:test";

import {
  appendMirrorConsequence,
  assertNoDuplicatePromotion,
  deriveMirrorConsequenceDedupeKey,
  deriveMirrorConsequenceEntryId,
  discardAllMirrorConsequences,
  emptyMirrorConsequenceLedger,
  listMirrorConsequences,
  listPending,
  markMirrorConsequencePromoted,
  promoteMirrorConsequences,
  type MirrorConsequenceLedgerEntry,
  type MirrorConsequenceLedgerState,
} from "../lib/epoch/journeyMirrorLedger.ts";
import type {
  ConsequenceEffectKind,
  ConsequenceType,
} from "../lib/epoch/journeySettlementRules.ts";

/**
 * PR2 unit tests for the pure mirror-consequence ledger.
 *
 * Coverage focuses on the idempotency contract that downstream PRs
 * (gameCore integration, solidify rewrite) will rely on:
 *   - append idempotency by (actionEventId, dedupeKey)
 *   - discard finality (and promotion survival)
 *   - promotion selection + atomic marking
 *   - replay determinism for entryId / dedupeKey
 *   - defensive invariant assertions
 */

const JOURNEY_ID = "journey_001";
const RECORDED_AT_EPOCH = "1970-01-01T00:00:00.000Z";

interface BuildEntryOverrides {
  readonly effectKind: ConsequenceEffectKind;
  readonly targetEntityId: string;
  readonly actionEventId: string;
  readonly scopeKey?: string;
  readonly delta?: number;
  readonly consequenceType?: ConsequenceType;
  readonly recordedAt?: string;
  readonly effectBlueprint?: Readonly<Record<string, unknown>>;
  readonly sourceEventIds?: readonly string[];
  readonly dedupeKeyOverride?: string;
}

function buildEntry(overrides: BuildEntryOverrides): MirrorConsequenceLedgerEntry {
  const dedupeKey =
    overrides.dedupeKeyOverride ??
    deriveMirrorConsequenceDedupeKey({
      effectKind: overrides.effectKind,
      targetEntityId: overrides.targetEntityId,
      actionEventId: overrides.actionEventId,
      scopeKey: overrides.scopeKey,
    });
  return {
    actionEventId: overrides.actionEventId,
    effectKind: overrides.effectKind,
    targetEntityId: overrides.targetEntityId,
    delta: overrides.delta ?? 1,
    consequenceType: overrides.consequenceType ?? "collateral",
    sourceEventIds: overrides.sourceEventIds ?? [overrides.actionEventId],
    effectBlueprint: overrides.effectBlueprint ?? {},
    recordedAt: overrides.recordedAt ?? RECORDED_AT_EPOCH,
    dedupeKey,
  };
}

function buildRegionEntry(
  actionEventId: string,
  regionId: string,
  agentId: string,
  recordedAt: string = RECORDED_AT_EPOCH,
): MirrorConsequenceLedgerEntry {
  return buildEntry({
    effectKind: "region_influence_delta",
    targetEntityId: `region:${regionId}`,
    actionEventId,
    scopeKey: `agent:${agentId}`,
    recordedAt,
  });
}

function entryIdFor(
  journeyId: string,
  entry: MirrorConsequenceLedgerEntry,
): string {
  return deriveMirrorConsequenceEntryId({
    journeyId,
    actionEventId: entry.actionEventId,
    dedupeKey: entry.dedupeKey,
  });
}

// ---------------------------------------------------------------------------

test("emptyMirrorConsequenceLedger returns an empty state scoped to the journey id", () => {
  const ledger = emptyMirrorConsequenceLedger(JOURNEY_ID);
  assert.equal(ledger.journeyId, JOURNEY_ID);
  assert.deepEqual(ledger.entriesById, {});
  assert.deepEqual(ledger.promotedCanonicalEventIds, {});
  assert.equal(ledger.discardedEntryIds.size, 0);
});

test("appendMirrorConsequence inserts a new entry into entriesById", () => {
  const ledger = emptyMirrorConsequenceLedger(JOURNEY_ID);
  const entry = buildRegionEntry("evt_action_001", "region_001", "agent_001");
  const next = appendMirrorConsequence(ledger, entry);
  assert.notEqual(next, ledger, "append must return a new ledger reference");
  assert.equal(Object.keys(next.entriesById).length, 1);
  const id = entryIdFor(JOURNEY_ID, entry);
  assert.equal(next.entriesById[id]?.actionEventId, "evt_action_001");
  // Original ledger is untouched (immutability).
  assert.equal(Object.keys(ledger.entriesById).length, 0);
});

test("appendMirrorConsequence is idempotent on replay of the same actionEventId + dedupeKey", () => {
  const ledger = emptyMirrorConsequenceLedger(JOURNEY_ID);
  const entry = buildRegionEntry("evt_action_001", "region_001", "agent_001");
  const first = appendMirrorConsequence(ledger, entry);
  const second = appendMirrorConsequence(first, entry);
  assert.equal(second, first, "replay append must return the same ledger reference");
  assert.equal(Object.keys(second.entriesById).length, 1);
});

test("appendMirrorConsequence accepts distinct dedupeKeys from the same actionEventId", () => {
  // Same action may produce multiple side effects on different targets;
  // they must each land as their own entry.
  const ledger = emptyMirrorConsequenceLedger(JOURNEY_ID);
  const regionEntry = buildEntry({
    effectKind: "region_influence_delta",
    targetEntityId: "region:region_001",
    actionEventId: "evt_action_001",
    scopeKey: "agent:agent_001",
  });
  const identityEntry = buildEntry({
    effectKind: "identity_doubt",
    targetEntityId: "identity:agent_001",
    actionEventId: "evt_action_001",
  });
  const next = appendMirrorConsequence(appendMirrorConsequence(ledger, regionEntry), identityEntry);
  assert.equal(Object.keys(next.entriesById).length, 2);
});

test("appendMirrorConsequence treats different actionEventIds with the same target as distinct entries", () => {
  const ledger = emptyMirrorConsequenceLedger(JOURNEY_ID);
  const a = buildRegionEntry("evt_action_001", "region_001", "agent_001");
  const b = buildRegionEntry("evt_action_002", "region_001", "agent_001");
  const next = appendMirrorConsequence(appendMirrorConsequence(ledger, a), b);
  assert.equal(Object.keys(next.entriesById).length, 2);
});

test("appendMirrorConsequence is a no-op on replay of an already-promoted entry (rule 1 wins)", () => {
  // Spec rule order: (1) duplicate composite -> no-op is checked before
  // (3) promoted-entryId -> throw. Replaying the exact same entry always
  // hits rule (1) for replay safety, regardless of promotion state.
  const ledger = emptyMirrorConsequenceLedger(JOURNEY_ID);
  const entry = buildRegionEntry("evt_action_001", "region_001", "agent_001");
  const id = entryIdFor(JOURNEY_ID, entry);
  const after = markMirrorConsequencePromoted(
    appendMirrorConsequence(ledger, entry),
    id,
    "evt_canonical_region_001",
  );
  const replayed = appendMirrorConsequence(after, entry);
  assert.equal(replayed, after, "replay of promoted entry must no-op via rule (1)");
});

test("appendMirrorConsequence throws rule (3) when entryId is promoted but no live entry occupies it", () => {
  // Fabricated state: promoted entryId with no matching entriesById record.
  // Append then computes entryId, misses rule (1) (no entry at that id),
  // misses rule (2) (not discarded), and hits rule (3) (entryId in
  // promoted) -> throws. This is the defensive guard against inconsistent
  // ledger state; assertNoDuplicatePromotion would also flag the orphan.
  const entry = buildRegionEntry("evt_action_001", "region_001", "agent_001");
  const id = entryIdFor(JOURNEY_ID, entry);
  const forged: MirrorConsequenceLedgerState = {
    journeyId: JOURNEY_ID,
    entriesById: {},
    promotedCanonicalEventIds: { [id]: "evt_canonical_region_001" },
    discardedEntryIds: new Set<string>(),
  };
  assert.throws(
    () => appendMirrorConsequence(forged, entry),
    /journey_mirror_ledger_entry_already_promoted/,
  );
});

test("listMirrorConsequences defaults to live entries only (no discarded, no promoted)", () => {
  const base = emptyMirrorConsequenceLedger(JOURNEY_ID);
  const live = buildRegionEntry("evt_live", "region_001", "agent_001");
  const promoted = buildRegionEntry("evt_promote", "region_002", "agent_001");
  let ledger = appendMirrorConsequence(appendMirrorConsequence(base, live), promoted);
  const promoteId = entryIdFor(JOURNEY_ID, promoted);
  ledger = markMirrorConsequencePromoted(ledger, promoteId, "evt_canonical_promote");

  // Default: excludes promoted; live still listed.
  const listed = listMirrorConsequences(ledger);
  assert.equal(listed.length, 1);
  assert.equal(listed[0]?.actionEventId, "evt_live");
  // includePromoted surfaces the promoted entry too.
  assert.equal(listMirrorConsequences(ledger, { includePromoted: true }).length, 2);

  // discardAllMirrorConsequences marks every non-promoted entry (including
  // the live one) as discarded; the default listing empties out.
  const discarded = discardAllMirrorConsequences(ledger);
  assert.equal(listMirrorConsequences(discarded).length, 0);
  // includeDiscarded surfaces the discarded live entry; the promoted entry
  // is still filtered because includePromoted defaults to false.
  assert.equal(listMirrorConsequences(discarded, { includeDiscarded: true }).length, 1);
});

test("listMirrorConsequences honors includeDiscarded and includePromoted simultaneously", () => {
  const base = emptyMirrorConsequenceLedger(JOURNEY_ID);
  const live = buildRegionEntry("evt_live", "region_001", "agent_001");
  const promoted = buildRegionEntry("evt_promote", "region_002", "agent_001");
  let ledger = appendMirrorConsequence(appendMirrorConsequence(base, live), promoted);
  const promoteId = entryIdFor(JOURNEY_ID, promoted);
  ledger = markMirrorConsequencePromoted(ledger, promoteId, "evt_canonical_promote");
  // After discardAll: live entry is discarded, promoted entry survives.
  ledger = discardAllMirrorConsequences(ledger);

  // Default: empty (live is discarded, promoted is filtered).
  assert.equal(listMirrorConsequences(ledger).length, 0);
  // includeDiscarded: live (discarded) + promoted is still filtered.
  assert.equal(listMirrorConsequences(ledger, { includeDiscarded: true }).length, 1);
  // includePromoted: promoted + live is still filtered (it's discarded).
  assert.equal(listMirrorConsequences(ledger, { includePromoted: true }).length, 1);
  // Both: all 2 entries.
  assert.equal(
    listMirrorConsequences(ledger, { includeDiscarded: true, includePromoted: true }).length,
    2,
  );
});

test("listMirrorConsequences applies effect-kind and consequence-type filters", () => {
  const base = emptyMirrorConsequenceLedger(JOURNEY_ID);
  const region = buildEntry({
    effectKind: "region_influence_delta",
    targetEntityId: "region:region_001",
    actionEventId: "evt_region",
    scopeKey: "agent:agent_001",
  });
  const identity = buildEntry({
    effectKind: "identity_doubt",
    targetEntityId: "identity:agent_001",
    actionEventId: "evt_identity",
    consequenceType: "self_loss",
  });
  const ledger = appendMirrorConsequence(appendMirrorConsequence(base, region), identity);
  const byKind = listMirrorConsequences(ledger, { filterEffectKind: "identity_doubt" });
  assert.equal(byKind.length, 1);
  assert.equal(byKind[0]?.actionEventId, "evt_identity");
  const byType = listMirrorConsequences(ledger, { filterConsequenceType: "self_loss" });
  assert.equal(byType.length, 1);
  assert.equal(byType[0]?.actionEventId, "evt_identity");
});

test("listMirrorConsequences is sorted by recordedAt then entryId for stable ordering", () => {
  const base = emptyMirrorConsequenceLedger(JOURNEY_ID);
  // Same recordedAt, different actionEventIds -> entryId is the tiebreaker.
  const a = buildRegionEntry("evt_a", "region_001", "agent_001", "2025-01-01T00:00:00.000Z");
  const b = buildRegionEntry("evt_b", "region_001", "agent_001", "2025-01-01T00:00:00.000Z");
  const c = buildRegionEntry("evt_c", "region_001", "agent_001", "2024-12-31T00:00:00.000Z");
  const ledger = appendMirrorConsequence(appendMirrorConsequence(appendMirrorConsequence(base, a), b), c);
  const listed = listMirrorConsequences(ledger);
  assert.equal(listed.length, 3);
  // c has the earliest recordedAt -> first.
  assert.equal(listed[0]?.actionEventId, "evt_c");
  // Between a and b, entryId (derived from actionEventId) is the tiebreaker.
  const aId = entryIdFor(JOURNEY_ID, a);
  const bId = entryIdFor(JOURNEY_ID, b);
  const expectedAB = aId < bId ? "evt_a" : "evt_b";
  assert.equal(listed[1]?.actionEventId, expectedAB);
});

test("discardAllMirrorConsequences marks every non-promoted entry as discarded", () => {
  const base = emptyMirrorConsequenceLedger(JOURNEY_ID);
  const live = buildRegionEntry("evt_live", "region_001", "agent_001");
  const promote = buildRegionEntry("evt_promote", "region_002", "agent_001");
  let ledger = appendMirrorConsequence(appendMirrorConsequence(base, live), promote);
  const promoteId = entryIdFor(JOURNEY_ID, promote);
  ledger = markMirrorConsequencePromoted(ledger, promoteId, "evt_canonical_promote");
  ledger = discardAllMirrorConsequences(ledger);
  // Promoted entry survives discard; live entry is discarded.
  const all = listMirrorConsequences(ledger, { includeDiscarded: true, includePromoted: true });
  assert.equal(all.length, 2);
  assert.equal(ledger.discardedEntryIds.has(entryIdFor(JOURNEY_ID, live)), true);
  assert.equal(ledger.discardedEntryIds.has(promoteId), false);
});

test("discardAllMirrorConsequences is a no-op when there is nothing new to discard", () => {
  const base = emptyMirrorConsequenceLedger(JOURNEY_ID);
  const entry = buildRegionEntry("evt_a", "region_001", "agent_001");
  const after = discardAllMirrorConsequences(appendMirrorConsequence(base, entry));
  const twice = discardAllMirrorConsequences(after);
  assert.equal(twice, after, "second discard with no new entries must return the same reference");
});

test("promoteMirrorConsequences selects only collateral non-discarded non-promoted entries", () => {
  const base = emptyMirrorConsequenceLedger(JOURNEY_ID);
  const collateral = buildRegionEntry("evt_collateral", "region_001", "agent_001");
  const selfLoss = buildEntry({
    effectKind: "identity_doubt",
    targetEntityId: "identity:agent_001",
    actionEventId: "evt_self_loss",
    consequenceType: "self_loss",
  });
  const result = buildEntry({
    effectKind: "region_influence_delta",
    targetEntityId: "region:region_002",
    actionEventId: "evt_result",
    scopeKey: "agent:agent_001",
    consequenceType: "result",
  });
  const alreadyPromoted = buildRegionEntry("evt_promoted", "region_003", "agent_001");
  let ledger = appendMirrorConsequence(
    appendMirrorConsequence(
      appendMirrorConsequence(appendMirrorConsequence(base, collateral), selfLoss),
      result,
    ),
    alreadyPromoted,
  );
  const promotedId = entryIdFor(JOURNEY_ID, alreadyPromoted);
  ledger = markMirrorConsequencePromoted(ledger, promotedId, "evt_canonical_promoted");

  const selection = promoteMirrorConsequences(ledger);
  // Only the collateral, non-promoted entry is eligible. self_loss and
  // result buckets are filtered out by consequenceType; alreadyPromoted
  // is filtered out by promoted status.
  assert.equal(selection.entriesToPromote.length, 1);
  assert.equal(selection.entriesToPromote[0]?.actionEventId, "evt_collateral");
  // Selection is a pure read — ledger reference is unchanged.
  assert.equal(selection.ledgerAfterSelection, ledger);

  // Discard-after-promote keeps the promoted entry; promote selection is
  // now empty because the collateral candidate was discarded.
  const discarded = discardAllMirrorConsequences(ledger);
  const afterDiscard = promoteMirrorConsequences(discarded);
  assert.equal(afterDiscard.entriesToPromote.length, 0);
});

test("markMirrorConsequencePromoted writes the canonical event id atomically", () => {
  const ledger = appendMirrorConsequence(
    emptyMirrorConsequenceLedger(JOURNEY_ID),
    buildRegionEntry("evt_a", "region_001", "agent_001"),
  );
  const entry = listMirrorConsequences(ledger)[0];
  assert.ok(entry);
  const id = entryIdFor(JOURNEY_ID, entry);
  const promoted = markMirrorConsequencePromoted(ledger, id, "evt_canonical_a");
  assert.equal(promoted.promotedCanonicalEventIds[id], "evt_canonical_a");
  // Promoted entry disappears from the default listing.
  assert.equal(listMirrorConsequences(promoted).length, 0);
  assert.equal(listMirrorConsequences(promoted, { includePromoted: true }).length, 1);
});

test("markMirrorConsequencePromoted is idempotent on identical canonical event id", () => {
  const ledger = appendMirrorConsequence(
    emptyMirrorConsequenceLedger(JOURNEY_ID),
    buildRegionEntry("evt_a", "region_001", "agent_001"),
  );
  const id = entryIdFor(JOURNEY_ID, listMirrorConsequences(ledger)[0] as MirrorConsequenceLedgerEntry);
  const first = markMirrorConsequencePromoted(ledger, id, "evt_canonical_a");
  const second = markMirrorConsequencePromoted(first, id, "evt_canonical_a");
  assert.equal(second, first, "idempotent re-promote must return the same reference");
});

test("markMirrorConsequencePromoted throws when re-marking with a different canonical event id", () => {
  const ledger = appendMirrorConsequence(
    emptyMirrorConsequenceLedger(JOURNEY_ID),
    buildRegionEntry("evt_a", "region_001", "agent_001"),
  );
  const id = entryIdFor(JOURNEY_ID, listMirrorConsequences(ledger)[0] as MirrorConsequenceLedgerEntry);
  const first = markMirrorConsequencePromoted(ledger, id, "evt_canonical_a");
  assert.throws(
    () => markMirrorConsequencePromoted(first, id, "evt_canonical_b"),
    /journey_mirror_ledger_entry_already_promoted/,
  );
});

test("markMirrorConsequencePromoted throws for unknown entryId", () => {
  const ledger = appendMirrorConsequence(
    emptyMirrorConsequenceLedger(JOURNEY_ID),
    buildRegionEntry("evt_a", "region_001", "agent_001"),
  );
  assert.throws(
    () => markMirrorConsequencePromoted(ledger, "mcle:journey_001:deadbeef", "evt_canonical"),
    /journey_mirror_ledger_entry_not_found/,
  );
});

test("markMirrorConsequencePromoted throws for discarded entry", () => {
  const entry = buildRegionEntry("evt_a", "region_001", "agent_001");
  const ledger = discardAllMirrorConsequences(
    appendMirrorConsequence(emptyMirrorConsequenceLedger(JOURNEY_ID), entry),
  );
  const id = entryIdFor(JOURNEY_ID, entry);
  assert.throws(
    () => markMirrorConsequencePromoted(ledger, id, "evt_canonical_a"),
    /journey_mirror_ledger_entry_discarded/,
  );
});

test("listPending returns only collateral non-discarded non-promoted entries", () => {
  const base = emptyMirrorConsequenceLedger(JOURNEY_ID);
  const collateral = buildRegionEntry("evt_collateral", "region_001", "agent_001");
  const selfLoss = buildEntry({
    effectKind: "identity_doubt",
    targetEntityId: "identity:agent_001",
    actionEventId: "evt_self_loss",
    consequenceType: "self_loss",
  });
  const ledger = appendMirrorConsequence(appendMirrorConsequence(base, collateral), selfLoss);
  const pending = listPending(ledger);
  assert.equal(pending.length, 1);
  assert.equal(pending[0]?.actionEventId, "evt_collateral");
});

test("assertNoDuplicatePromotion passes on a clean ledger", () => {
  const ledger = appendMirrorConsequence(
    emptyMirrorConsequenceLedger(JOURNEY_ID),
    buildRegionEntry("evt_a", "region_001", "agent_001"),
  );
  // Does not throw.
  assertNoDuplicatePromotion(ledger);
});

test("assertNoDuplicatePromotion detects fabricated duplicate composite keys", () => {
  const entry = buildRegionEntry("evt_a", "region_001", "agent_001");
  const id = entryIdFor(JOURNEY_ID, entry);
  // Forge a ledger state where the same composite key appears under two
  // distinct entryIds — append would never allow this, so the invariant
  // guard is our belt-and-braces catch.
  const forged: MirrorConsequenceLedgerState = {
    journeyId: JOURNEY_ID,
    entriesById: {
      [id]: entry,
      "mcle:journey_001:fabricated": { ...entry },
    },
    promotedCanonicalEventIds: {},
    discardedEntryIds: new Set<string>(),
  };
  assert.throws(
    () => assertNoDuplicatePromotion(forged),
    /journey_mirror_ledger_duplicate_composite_key/,
  );
});

test("assertNoDuplicatePromotion detects orphan promotion records", () => {
  const forged: MirrorConsequenceLedgerState = {
    journeyId: JOURNEY_ID,
    entriesById: {},
    promotedCanonicalEventIds: { "mcle:journey_001:deadbeef": "evt_canonical_orphan" },
    discardedEntryIds: new Set<string>(),
  };
  assert.throws(
    () => assertNoDuplicatePromotion(forged),
    /journey_mirror_ledger_promoted_entry_missing/,
  );
});

test("deriveMirrorConsequenceEntryId is deterministic and stable on replay", () => {
  const a = deriveMirrorConsequenceEntryId({
    journeyId: JOURNEY_ID,
    actionEventId: "evt_action_001",
    dedupeKey: "region_influence:region_001:agent_001:evt_action_001",
  });
  const b = deriveMirrorConsequenceEntryId({
    journeyId: JOURNEY_ID,
    actionEventId: "evt_action_001",
    dedupeKey: "region_influence:region_001:agent_001:evt_action_001",
  });
  assert.equal(a, b);
  assert.match(a, /^mcle:journey_001:[a-f0-9]{16}$/);
  // Distinct inputs produce distinct ids.
  const c = deriveMirrorConsequenceEntryId({
    journeyId: JOURNEY_ID,
    actionEventId: "evt_action_002",
    dedupeKey: "region_influence:region_001:agent_001:evt_action_001",
  });
  assert.notEqual(a, c);
});

test("deriveMirrorConsequenceEntryId throws on empty inputs", () => {
  assert.throws(
    () =>
      deriveMirrorConsequenceEntryId({
        journeyId: "",
        actionEventId: "evt_action_001",
        dedupeKey: "k",
      }),
    /journey_mirror_ledger_entry_id_empty_journey_id/,
  );
  assert.throws(
    () =>
      deriveMirrorConsequenceEntryId({
        journeyId: JOURNEY_ID,
        actionEventId: "",
        dedupeKey: "k",
      }),
    /journey_mirror_ledger_entry_id_empty_action_event_id/,
  );
  assert.throws(
    () =>
      deriveMirrorConsequenceEntryId({
        journeyId: JOURNEY_ID,
        actionEventId: "evt_action_001",
        dedupeKey: "",
      }),
    /journey_mirror_ledger_entry_id_empty_dedupe_key/,
  );
});

test("deriveMirrorConsequenceDedupeKey produces the documented shape for each in-ledger effect kind", () => {
  const regionKey = deriveMirrorConsequenceDedupeKey({
    effectKind: "region_influence_delta",
    targetEntityId: "region:region_001",
    actionEventId: "evt_a",
    scopeKey: "agent:agent_001",
  });
  assert.equal(regionKey, "region_influence:region_001:agent_001:evt_a");

  const traceKey = deriveMirrorConsequenceDedupeKey({
    effectKind: "trace_created",
    targetEntityId: "region:region_001",
    actionEventId: "evt_a",
    scopeKey: "journey_001:episode_001",
  });
  assert.equal(traceKey, "trace:region_001:journey_001:episode_001:evt_a");

  const factionKey = deriveMirrorConsequenceDedupeKey({
    effectKind: "faction_standing_delta",
    targetEntityId: "faction:agent_001:faction_001",
    actionEventId: "evt_a",
    scopeKey: "route:route_001",
  });
  assert.equal(factionKey, "faction_standing:agent_001:faction_001:route_001:evt_a");

  const npcKey = deriveMirrorConsequenceDedupeKey({
    effectKind: "npc_relationship_delta",
    targetEntityId: "npc:npc_blacksmith",
    actionEventId: "evt_a",
    scopeKey: "agent_001:bond_sworn:journey_001",
  });
  // actionEventId is included so two actions on the same NPC bond in one
  // journey land as distinct entries (aligns with deriveMirrorConsequenceEntryId).
  assert.equal(npcKey, "agent_npc_bond:agent_001:npc_blacksmith:bond_sworn:journey_001:evt_a");

  const objectMutationKey = deriveMirrorConsequenceDedupeKey({
    effectKind: "object_mutation",
    targetEntityId: "object:obj_relic_001",
    actionEventId: "evt_a",
  });
  assert.equal(objectMutationKey, "object_object_mutation:obj_relic_001:evt_a");

  const objectDestroyKey = deriveMirrorConsequenceDedupeKey({
    effectKind: "object_destroy",
    targetEntityId: "object:obj_relic_001",
    actionEventId: "evt_a",
  });
  assert.equal(objectDestroyKey, "object_object_destroy:obj_relic_001:evt_a");

  const hiddenKey = deriveMirrorConsequenceDedupeKey({
    effectKind: "hidden_prerequisite_destroyed",
    targetEntityId: "hidden:prereq_obj_001",
    actionEventId: "evt_a",
  });
  assert.equal(hiddenKey, "hidden_prereq:prereq_obj_001:evt_a");

  const identityKey = deriveMirrorConsequenceDedupeKey({
    effectKind: "identity_doubt",
    targetEntityId: "identity:agent_001",
    actionEventId: "evt_a",
  });
  assert.equal(identityKey, "identity_doubt:agent_001:evt_a");
});

test("deriveMirrorConsequenceDedupeKey refuses self-loss kinds that never enter the ledger", () => {
  assert.throws(
    () =>
      deriveMirrorConsequenceDedupeKey({
        effectKind: "resource_spent",
        targetEntityId: "res:stamina",
        actionEventId: "evt_a",
      }),
    /journey_mirror_ledger_dedupe_key_unsupported_effect_kind:resource_spent/,
  );
  assert.throws(
    () =>
      deriveMirrorConsequenceDedupeKey({
        effectKind: "lifetime_adjusted",
        targetEntityId: "identity:agent_001",
        actionEventId: "evt_a",
      }),
    /journey_mirror_ledger_dedupe_key_unsupported_effect_kind:lifetime_adjusted/,
  );
});

test("deriveMirrorConsequenceDedupeKey throws on missing or malformed carriers", () => {
  // Missing scope on region_influence_delta.
  assert.throws(
    () =>
      deriveMirrorConsequenceDedupeKey({
        effectKind: "region_influence_delta",
        targetEntityId: "region:region_001",
        actionEventId: "evt_a",
      }),
    /journey_mirror_ledger_dedupe_key_missing_carrier:agentId/,
  );
  // Wrong prefix on target.
  assert.throws(
    () =>
      deriveMirrorConsequenceDedupeKey({
        effectKind: "region_influence_delta",
        targetEntityId: "unknown:region_001",
        actionEventId: "evt_a",
        scopeKey: "agent:agent_001",
      }),
    /journey_mirror_ledger_dedupe_key_missing_carrier:regionId/,
  );
  // Malformed trace scope (missing episode separator).
  assert.throws(
    () =>
      deriveMirrorConsequenceDedupeKey({
        effectKind: "trace_created",
        targetEntityId: "region:region_001",
        actionEventId: "evt_a",
        scopeKey: "journey_only",
      }),
    /journey_mirror_ledger_dedupe_key_invalid_trace_scope/,
  );
  // Empty actionEventId.
  assert.throws(
    () =>
      deriveMirrorConsequenceDedupeKey({
        effectKind: "identity_doubt",
        targetEntityId: "identity:agent_001",
        actionEventId: "",
      }),
    /journey_mirror_ledger_dedupe_key_empty_action_event_id/,
  );
});

test("replay determinism: appending the same entry sequence twice yields the same ledger state", () => {
  const a = buildRegionEntry("evt_a", "region_001", "agent_001");
  const b = buildEntry({
    effectKind: "identity_doubt",
    targetEntityId: "identity:agent_001",
    actionEventId: "evt_a",
  });
  const c = buildRegionEntry("evt_b", "region_002", "agent_001");

  const runOnce = appendMirrorConsequence(
    appendMirrorConsequence(appendMirrorConsequence(emptyMirrorConsequenceLedger(JOURNEY_ID), a), b),
    c,
  );
  const runTwice = appendMirrorConsequence(
    appendMirrorConsequence(
      appendMirrorConsequence(
        appendMirrorConsequence(
          appendMirrorConsequence(emptyMirrorConsequenceLedger(JOURNEY_ID), a),
          b,
        ),
        c,
      ),
      a,
    ),
    b,
  );

  // Same entriesById keys.
  assert.deepEqual(
    Object.keys(runOnce.entriesById).sort(),
    Object.keys(runTwice.entriesById).sort(),
  );
  assert.equal(Object.keys(runOnce.entriesById).length, 3);
});

test("promote -> mark -> assert invariants: full solidify-equivalent flow", () => {
  const base = emptyMirrorConsequenceLedger(JOURNEY_ID);
  const region = buildEntry({
    effectKind: "region_influence_delta",
    targetEntityId: "region:region_001",
    actionEventId: "evt_action_001",
    scopeKey: "agent:agent_001",
  });
  const trace = buildEntry({
    effectKind: "trace_created",
    targetEntityId: "region:region_001",
    actionEventId: "evt_action_001",
    scopeKey: "journey_001:episode_001",
  });
  const faction = buildEntry({
    effectKind: "faction_standing_delta",
    targetEntityId: "faction:agent_001:faction_001",
    actionEventId: "evt_action_001",
    scopeKey: "route:route_001",
  });

  let ledger = appendMirrorConsequence(appendMirrorConsequence(appendMirrorConsequence(base, region), trace), faction);
  const selection = promoteMirrorConsequences(ledger);
  assert.equal(selection.entriesToPromote.length, 3);

  // Caller acts as the solidify integration: build canonical event and
  // mark each entry atomically.
  for (const entry of selection.entriesToPromote) {
    const id = entryIdFor(JOURNEY_ID, entry);
    const canonical = `evt_canonical_${entry.effectKind}`;
    ledger = markMirrorConsequencePromoted(ledger, id, canonical);
  }

  // Every entry is promoted.
  assert.equal(listMirrorConsequences(ledger).length, 0);
  assert.equal(
    listMirrorConsequences(ledger, { includePromoted: true }).length,
    3,
  );
  // Invariant guard still passes.
  assertNoDuplicatePromotion(ledger);

  // Re-promoting the same entries with different canonical ids must fail.
  const firstEntry = selection.entriesToPromote[0] as MirrorConsequenceLedgerEntry;
  const firstId = entryIdFor(JOURNEY_ID, firstEntry);
  assert.throws(
    () => markMirrorConsequencePromoted(ledger, firstId, "evt_canonical_different"),
    /journey_mirror_ledger_entry_already_promoted/,
  );
});
