import assert from "node:assert/strict";
import test from "node:test";

import type {
  FeedbackDoubtEntry,
  FeedbackProjectionInput,
  FactionStandingDelta,
  WorldFeedbackSignal,
} from "../lib/epoch/journeyFeedbackRules.ts";
import {
  projectFeedbackSignals,
  toAgentFeedbackPromptContext,
} from "../lib/epoch/journeyFeedbackRules.ts";

const ISO = "2026-07-25T00:00:00.000Z";

function baseInput(overrides: Partial<FeedbackProjectionInput> = {}): FeedbackProjectionInput {
  return {
    identityId: "id_1",
    doubtEntries: [],
    viability: { flaggedWanted: new Set<string>(), identityExposed: false },
    factionStandingDeltas: [],
    projectedAt: ISO,
    ...overrides,
  };
}

// ─── projectFeedbackSignals ─────────────────────────────────────────────────

test("empty inputs produce no signals", () => {
  const signals = projectFeedbackSignals(baseInput());
  assert.equal(signals.length, 0);
});

test("viability flaggedWanted produces shut_out signal", () => {
  const signals = projectFeedbackSignals(baseInput({
    viability: { flaggedWanted: new Set(["region_alpha"]), identityExposed: false },
  }));
  assert.equal(signals.length, 1);
  assert.equal(signals[0]!.kind, "shut_out");
  assert.equal(signals[0]!.audienceIdentityId, "id_1");
  assert.equal(signals[0]!.worldFactRef, "region_alpha");
});

test("viability flaggedWanted with multiple regions produces one shut_out signal", () => {
  const signals = projectFeedbackSignals(baseInput({
    viability: { flaggedWanted: new Set(["region_a", "region_b"]), identityExposed: false },
  }));
  // Dedup: only one shut_out signal despite multiple regions
  const shutOutSignals = signals.filter((s) => s.kind === "shut_out");
  assert.equal(shutOutSignals.length, 1);
});

test("moderate doubt produces npc_cold signal", () => {
  const doubt: FeedbackDoubtEntry = {
    npcId: "npc_1",
    doubtStrength: "moderate",
    sourceActionEventId: "action_1",
  };
  const signals = projectFeedbackSignals(baseInput({
    doubtEntries: [doubt],
  }));
  assert.equal(signals.length, 1);
  assert.equal(signals[0]!.kind, "npc_cold");
  assert.equal(signals[0]!.sourceEventId, "action_1");
});

test("high doubt with region produces followed signal", () => {
  const doubt: FeedbackDoubtEntry = {
    npcId: "npc_1",
    doubtStrength: "high",
    sourceActionEventId: "action_1",
    regionId: "region_alpha",
  };
  const signals = projectFeedbackSignals(baseInput({
    doubtEntries: [doubt],
  }));
  assert.equal(signals.length, 1);
  assert.equal(signals[0]!.kind, "followed");
  assert.equal(signals[0]!.worldFactRef, "region_alpha");
});

test("high doubt without region falls through to npc_cold", () => {
  const doubt: FeedbackDoubtEntry = {
    npcId: "npc_1",
    doubtStrength: "high",
    sourceActionEventId: "action_1",
  };
  const signals = projectFeedbackSignals(baseInput({
    doubtEntries: [doubt],
  }));
  // No region → not followed → falls to npc_cold (moderate+ threshold)
  assert.equal(signals.length, 1);
  assert.equal(signals[0]!.kind, "npc_cold");
});

test("severe doubt + identityExposed produces identity_exposed signal", () => {
  const doubt: FeedbackDoubtEntry = {
    npcId: "npc_1",
    doubtStrength: "severe",
    sourceActionEventId: "action_1",
    regionId: "region_alpha",
  };
  const signals = projectFeedbackSignals(baseInput({
    doubtEntries: [doubt],
    viability: { flaggedWanted: new Set<string>(), identityExposed: true },
  }));
  const exposed = signals.find((s) => s.kind === "identity_exposed");
  assert.ok(exposed, "should have identity_exposed signal");
  assert.equal(exposed.sourceEventId, "action_1");
});

test("severe doubt without identityExposed does not produce identity_exposed", () => {
  const doubt: FeedbackDoubtEntry = {
    npcId: "npc_1",
    doubtStrength: "severe",
    sourceActionEventId: "action_1",
  };
  const signals = projectFeedbackSignals(baseInput({
    doubtEntries: [doubt],
    viability: { flaggedWanted: new Set<string>(), identityExposed: false },
  }));
  const exposed = signals.find((s) => s.kind === "identity_exposed");
  assert.equal(exposed, undefined);
  // Falls through to npc_cold (moderate+)
  assert.ok(signals.some((s) => s.kind === "npc_cold"));
});

test("low doubt produces relationship_deteriorated signal", () => {
  const doubt: FeedbackDoubtEntry = {
    npcId: "npc_1",
    doubtStrength: "low",
    sourceActionEventId: "action_1",
  };
  const signals = projectFeedbackSignals(baseInput({
    doubtEntries: [doubt],
  }));
  assert.equal(signals.length, 1);
  assert.equal(signals[0]!.kind, "relationship_deteriorated");
});

test("faction standing delta produces standing_changed signal", () => {
  const delta: FactionStandingDelta = {
    factionId: "faction_1",
    delta: -500,
    sourceEventId: "event_standing_1",
  };
  const signals = projectFeedbackSignals(baseInput({
    factionStandingDeltas: [delta],
  }));
  assert.equal(signals.length, 1);
  assert.equal(signals[0]!.kind, "standing_changed");
  assert.equal(signals[0]!.worldFactRef, "faction_1");
});

test("dedup: same sourceEventId produces only one signal", () => {
  // Two doubt entries with the same sourceActionEventId
  const doubts: FeedbackDoubtEntry[] = [
    { npcId: "npc_1", doubtStrength: "moderate", sourceActionEventId: "action_1" },
    { npcId: "npc_2", doubtStrength: "high", sourceActionEventId: "action_1", regionId: "r_1" },
  ];
  const signals = projectFeedbackSignals(baseInput({
    doubtEntries: doubts,
  }));
  // Only one signal despite two doubt entries (same sourceEventId)
  assert.equal(signals.length, 1);
});

test("mixed sources produce multiple signal kinds", () => {
  const signals = projectFeedbackSignals(baseInput({
    doubtEntries: [
      { npcId: "npc_1", doubtStrength: "moderate", sourceActionEventId: "a_1" },
      { npcId: "npc_2", doubtStrength: "high", sourceActionEventId: "a_2", regionId: "r_1" },
    ],
    viability: { flaggedWanted: new Set(["r_2"]), identityExposed: false },
    factionStandingDeltas: [
      { factionId: "f_1", delta: -200, sourceEventId: "e_1" },
    ],
  }));
  const kinds = new Set(signals.map((s) => s.kind));
  assert.ok(kinds.has("npc_cold"), "should have npc_cold");
  assert.ok(kinds.has("followed"), "should have followed");
  assert.ok(kinds.has("shut_out"), "should have shut_out");
  assert.ok(kinds.has("standing_changed"), "should have standing_changed");
});

test("all signals carry audienceIdentityId and createdAt", () => {
  const signals = projectFeedbackSignals(baseInput({
    doubtEntries: [
      { npcId: "npc_1", doubtStrength: "moderate", sourceActionEventId: "a_1" },
    ],
    viability: { flaggedWanted: new Set(["r_1"]), identityExposed: false },
    factionStandingDeltas: [
      { factionId: "f_1", delta: -100, sourceEventId: "e_1" },
    ],
  }));
  for (const signal of signals) {
    assert.equal(signal.audienceIdentityId, "id_1");
    assert.equal(signal.createdAt, ISO);
  }
});

// ─── toAgentFeedbackPromptContext ───────────────────────────────────────────

test("toAgentFeedbackPromptContext: empty signals → empty string", () => {
  assert.equal(toAgentFeedbackPromptContext([]), "");
});

test("toAgentFeedbackPromptContext: single signal → narrative with period", () => {
  const signals: WorldFeedbackSignal[] = [{
    kind: "npc_cold",
    sourceEventId: "e_1",
    audienceIdentityId: "id_1",
    narrativeTextKey: "npc_cold",
    createdAt: ISO,
  }];
  const text = toAgentFeedbackPromptContext(signals);
  assert.match(text, /态度.*冷淡/);
  assert.match(text, /。$/);
});

test("toAgentFeedbackPromptContext: multiple signals → joined with semicolons", () => {
  const signals: WorldFeedbackSignal[] = [
    {
      kind: "npc_cold",
      sourceEventId: "e_1",
      audienceIdentityId: "id_1",
      narrativeTextKey: "npc_cold",
      createdAt: ISO,
    },
    {
      kind: "shut_out",
      sourceEventId: "e_2",
      audienceIdentityId: "id_1",
      narrativeTextKey: "shut_out",
      createdAt: ISO,
    },
  ];
  const text = toAgentFeedbackPromptContext(signals);
  assert.match(text, /；/);
  assert.match(text, /态度/);
  assert.match(text, /拒之门外/);
});

test("toAgentFeedbackPromptContext: deduplicates by kind", () => {
  const signals: WorldFeedbackSignal[] = [
    {
      kind: "npc_cold",
      sourceEventId: "e_1",
      audienceIdentityId: "id_1",
      narrativeTextKey: "npc_cold",
      createdAt: ISO,
    },
    {
      kind: "npc_cold",
      sourceEventId: "e_2",
      audienceIdentityId: "id_1",
      narrativeTextKey: "npc_cold",
      createdAt: ISO,
    },
  ];
  const text = toAgentFeedbackPromptContext(signals);
  // Should only appear once despite two signals of same kind
  const matches = text.match(/冷淡/gu);
  assert.equal(matches?.length, 1);
});

test("toAgentFeedbackPromptContext: never contains numeric values", () => {
  const allKinds: WorldFeedbackSignal["kind"][] = [
    "npc_cold", "shut_out", "followed", "questioned",
    "relationship_deteriorated", "standing_changed", "identity_exposed",
  ];
  const signals: WorldFeedbackSignal[] = allKinds.map((kind, i) => ({
    kind,
    sourceEventId: `e_${i}`,
    audienceIdentityId: "id_1",
    narrativeTextKey: kind,
    createdAt: ISO,
  }));
  const text = toAgentFeedbackPromptContext(signals);
  // No digits in the output
  assert.equal(/\d/u.test(text), false, `narrative must not contain digits: ${text}`);
});

test("toAgentFeedbackPromptContext: contains no bps/score/tier/affinity keywords", () => {
  const signals: WorldFeedbackSignal[] = [
    {
      kind: "identity_exposed",
      sourceEventId: "e_1",
      audienceIdentityId: "id_1",
      narrativeTextKey: "identity_exposed",
      createdAt: ISO,
    },
  ];
  const text = toAgentFeedbackPromptContext(signals);
  const forbidden = ["bps", "score", "tier", "affinity", "fit", "viability", "penalty"];
  for (const word of forbidden) {
    assert.equal(
      text.toLowerCase().includes(word),
      false,
      `narrative must not contain "${word}": ${text}`,
    );
  }
});

test("toAgentFeedbackPromptContext: all 7 signal kinds have narratives", () => {
  const allKinds: WorldFeedbackSignal["kind"][] = [
    "npc_cold", "shut_out", "followed", "questioned",
    "relationship_deteriorated", "standing_changed", "identity_exposed",
  ];
  for (const kind of allKinds) {
    const signals: WorldFeedbackSignal[] = [{
      kind,
      sourceEventId: `e_${kind}`,
      audienceIdentityId: "id_1",
      narrativeTextKey: kind,
      createdAt: ISO,
    }];
    const text = toAgentFeedbackPromptContext(signals);
    assert.ok(text.length > 0, `kind ${kind} should produce non-empty narrative`);
    assert.match(text, /。$/);
  }
});
