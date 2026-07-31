import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_CAUSAL_SIMULATION_LOD_CONFIG,
  type CausalSimulationLod,
  type CausalSimulationLodSubjectState,
  type CausalSimulationLodDecisionInput,
  causalSimulationLodConfig,
  causalSimulationLodLevel,
  causalSimulationLodTickIntervalWorldMinutes,
  preservedCausalSimulationState,
  causalSimulationPromotionReasons,
  causalSimulationDemotionReasons,
  nextCausalSimulationLodDecision,
  shouldRunCausalSimulationLodTick,
} from "../lib/epoch/causalSimulationLodRules.js";

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function makeSubject(
  overrides: Partial<CausalSimulationLodSubjectState> = {},
): CausalSimulationLodSubjectState {
  return {
    subjectRef: "npc/alice",
    simulationLod: 1,
    activePressureSeverity: 10,
    playerProximity: false,
    hasIrreversibleEvent: false,
    commitments: [],
    debts: [],
    injuries: [],
    ownership: [],
    relationships: [],
    keyBeliefs: [],
    openCases: [],
    ...overrides,
  };
}

function makeInput(
  subjectOverrides: Partial<CausalSimulationLodSubjectState> = {},
  worldMinute = 1000,
  config?: Partial<import("../lib/epoch/causalSimulationLodRules.js").CausalSimulationLodConfig>,
): CausalSimulationLodDecisionInput {
  return {
    subject: makeSubject(subjectOverrides),
    currentWorldMinute: worldMinute,
    config,
  };
}

// ---------------------------------------------------------------------------
// DEFAULT_CAUSAL_SIMULATION_LOD_CONFIG
// ---------------------------------------------------------------------------

describe("DEFAULT_CAUSAL_SIMULATION_LOD_CONFIG", () => {
  it("defines exactly 4 LOD levels (0-3)", () => {
    assert.equal(DEFAULT_CAUSAL_SIMULATION_LOD_CONFIG.levels.length, 4);
    assert.deepEqual(
      DEFAULT_CAUSAL_SIMULATION_LOD_CONFIG.levels.map((l) => l.id),
      [0, 1, 2, 3],
    );
  });

  it("tick intervals decrease as LOD increases", () => {
    const intervals = DEFAULT_CAUSAL_SIMULATION_LOD_CONFIG.levels.map(
      (l) => l.tickIntervalWorldMinutes,
    );
    for (let i = 1; i < intervals.length; i++) {
      assert.ok(
        intervals[i]! < intervals[i - 1]!,
        `LOD ${i} interval should be less than LOD ${i - 1}`,
      );
    }
  });

  it("each level has a non-empty label and at least one model", () => {
    for (const level of DEFAULT_CAUSAL_SIMULATION_LOD_CONFIG.levels) {
      assert.ok(level.label.length > 0, `LOD ${level.id} label empty`);
      assert.ok(level.models.length > 0, `LOD ${level.id} models empty`);
    }
  });
});

// ---------------------------------------------------------------------------
// causalSimulationLodConfig
// ---------------------------------------------------------------------------

describe("causalSimulationLodConfig", () => {
  it("returns defaults when called with no argument", () => {
    const config = causalSimulationLodConfig();
    assert.deepEqual(config, DEFAULT_CAUSAL_SIMULATION_LOD_CONFIG);
  });

  it("returns defaults when called with empty object", () => {
    const config = causalSimulationLodConfig({});
    assert.equal(config.levels.length, 4);
    assert.equal(config.promotion.criticalPressureSeverity, 75);
  });

  it("merges custom promotion fields with defaults", () => {
    const config = causalSimulationLodConfig({
      promotion: { criticalPressureSeverity: 50 },
    });
    assert.equal(config.promotion.criticalPressureSeverity, 50);
    // other promotion defaults preserved
    assert.equal(config.promotion.playerProximity, true);
    assert.equal(config.promotion.irreversibleEvent, true);
  });

  it("merges custom demotion fields with defaults", () => {
    const config = causalSimulationLodConfig({
      demotion: { minimumQuietWorldMinutes: 5000 },
    });
    assert.equal(config.demotion.minimumQuietWorldMinutes, 5000);
    assert.equal(config.demotion.maximumActivePressureSeverity, 29);
  });

  it("replaces levels when custom levels are provided", () => {
    const customLevels: import("../lib/epoch/causalSimulationLodRules.js").CausalSimulationLodLevel[] =
      [
        { id: 0, label: "off", tickIntervalWorldMinutes: 9999, models: ["a"] },
        { id: 1, label: "low", tickIntervalWorldMinutes: 100, models: ["b"] },
        { id: 2, label: "mid", tickIntervalWorldMinutes: 50, models: ["c"] },
        { id: 3, label: "high", tickIntervalWorldMinutes: 10, models: ["d"] },
      ];
    const config = causalSimulationLodConfig({ levels: customLevels });
    assert.equal(config.levels.length, 4);
    assert.equal(config.levels[0]!.tickIntervalWorldMinutes, 9999);
  });

  it("uses default levels when custom levels array is empty", () => {
    const config = causalSimulationLodConfig({ levels: [] });
    assert.equal(config.levels.length, 4);
  });

  it("replaces preserve list when custom demotion.preserve is provided", () => {
    const config = causalSimulationLodConfig({
      demotion: { preserve: ["commitments", "debts"] },
    });
    assert.deepEqual(config.demotion.preserve, ["commitments", "debts"]);
  });
});

// ---------------------------------------------------------------------------
// causalSimulationLodLevel
// ---------------------------------------------------------------------------

describe("causalSimulationLodLevel", () => {
  it("returns the correct level for each LOD id", () => {
    for (const expected of DEFAULT_CAUSAL_SIMULATION_LOD_CONFIG.levels) {
      const level = causalSimulationLodLevel(expected.id as CausalSimulationLod);
      assert.equal(level.id, expected.id);
      assert.equal(level.label, expected.label);
    }
  });

  it("throws for a missing LOD level in custom config", () => {
    assert.throws(
      () => causalSimulationLodLevel(3, { levels: [{ id: 0, label: "x", tickIntervalWorldMinutes: 1, models: [] }] }),
      /causal_simulation_lod_level_missing/,
    );
  });
});

// ---------------------------------------------------------------------------
// causalSimulationLodTickIntervalWorldMinutes
// ---------------------------------------------------------------------------

describe("causalSimulationLodTickIntervalWorldMinutes", () => {
  it("returns default intervals for each LOD", () => {
    assert.equal(causalSimulationLodTickIntervalWorldMinutes(0), 1440);
    assert.equal(causalSimulationLodTickIntervalWorldMinutes(1), 360);
    assert.equal(causalSimulationLodTickIntervalWorldMinutes(2), 60);
    assert.equal(causalSimulationLodTickIntervalWorldMinutes(3), 5);
  });

  it("returns custom interval when config overrides it", () => {
    assert.equal(
      causalSimulationLodTickIntervalWorldMinutes(3, {
        levels: [
          { id: 0, label: "a", tickIntervalWorldMinutes: 1, models: [] },
          { id: 1, label: "b", tickIntervalWorldMinutes: 2, models: [] },
          { id: 2, label: "c", tickIntervalWorldMinutes: 3, models: [] },
          { id: 3, label: "d", tickIntervalWorldMinutes: 99, models: [] },
        ],
      }),
      99,
    );
  });
});

// ---------------------------------------------------------------------------
// preservedCausalSimulationState
// ---------------------------------------------------------------------------

describe("preservedCausalSimulationState", () => {
  it("preserves all state kinds by default", () => {
    const subject = makeSubject({
      commitments: ["c1", "c2"],
      debts: ["d1"],
      injuries: ["i1"],
      ownership: ["o1"],
      relationships: ["r1"],
      keyBeliefs: ["b1"],
      openCases: ["case1"],
    });
    const preserved = preservedCausalSimulationState(subject);
    assert.deepEqual(preserved.commitments, ["c1", "c2"]);
    assert.deepEqual(preserved.debts, ["d1"]);
    assert.deepEqual(preserved.injuries, ["i1"]);
    assert.deepEqual(preserved.ownership, ["o1"]);
    assert.deepEqual(preserved.relationships, ["r1"]);
    assert.deepEqual(preserved.keyBeliefs, ["b1"]);
    assert.deepEqual(preserved.openCases, ["case1"]);
  });

  it("returns empty arrays for kinds not in preserveKinds", () => {
    const subject = makeSubject({
      commitments: ["c1"],
      debts: ["d1"],
      injuries: ["i1"],
    });
    const preserved = preservedCausalSimulationState(subject, ["commitments"]);
    assert.deepEqual(preserved.commitments, ["c1"]);
    assert.deepEqual(preserved.debts, []);
    assert.deepEqual(preserved.injuries, []);
  });

  it("deduplicates and sorts preserved values", () => {
    const subject = makeSubject({
      commitments: ["b", "a", "b", "a"],
      debts: ["z", "a", "z"],
    });
    const preserved = preservedCausalSimulationState(subject);
    assert.deepEqual(preserved.commitments, ["a", "b"]);
    assert.deepEqual(preserved.debts, ["a", "z"]);
  });

  it("filters out empty strings", () => {
    const subject = makeSubject({
      commitments: ["", "  ", "valid"],
    });
    const preserved = preservedCausalSimulationState(subject);
    assert.deepEqual(preserved.commitments, ["valid"]);
  });
});

// ---------------------------------------------------------------------------
// causalSimulationPromotionReasons
// ---------------------------------------------------------------------------

describe("causalSimulationPromotionReasons", () => {
  it("returns empty when no promotion conditions met", () => {
    const reasons = causalSimulationPromotionReasons(makeInput());
    assert.deepEqual(reasons, []);
  });

  it("returns player_proximity when subject is near player", () => {
    const reasons = causalSimulationPromotionReasons(
      makeInput({ playerProximity: true }),
    );
    assert.ok(reasons.includes("player_proximity"));
  });

  it("returns critical_pressure when severity >= threshold", () => {
    const reasons = causalSimulationPromotionReasons(
      makeInput({ activePressureSeverity: 75 }),
    );
    assert.ok(reasons.includes("critical_pressure"));
  });

  it("returns critical_pressure when severity exceeds threshold", () => {
    const reasons = causalSimulationPromotionReasons(
      makeInput({ activePressureSeverity: 100 }),
    );
    assert.ok(reasons.includes("critical_pressure"));
  });

  it("does not return critical_pressure below threshold", () => {
    const reasons = causalSimulationPromotionReasons(
      makeInput({ activePressureSeverity: 74 }),
    );
    assert.ok(!reasons.includes("critical_pressure"));
  });

  it("returns irreversible_event when subject has irreversible event", () => {
    const reasons = causalSimulationPromotionReasons(
      makeInput({ hasIrreversibleEvent: true }),
    );
    assert.ok(reasons.includes("irreversible_event"));
  });

  it("returns commitment_due when commitment is due within window", () => {
    const reasons = causalSimulationPromotionReasons(
      makeInput({ nextCommitmentDueAtWorldMinute: 2000 }, 1000),
    );
    assert.ok(reasons.includes("commitment_due"));
  });

  it("does not return commitment_due when commitment is outside window", () => {
    // default window is 1440 minutes; 1000 + 1440 = 2440, so due at 2500 is outside
    const reasons = causalSimulationPromotionReasons(
      makeInput({ nextCommitmentDueAtWorldMinute: 2500 }, 1000),
    );
    assert.ok(!reasons.includes("commitment_due"));
  });

  it("does not return commitment_due when no commitment is set", () => {
    const reasons = causalSimulationPromotionReasons(makeInput());
    assert.ok(!reasons.includes("commitment_due"));
  });

  it("returns multiple reasons sorted alphabetically", () => {
    const reasons = causalSimulationPromotionReasons(
      makeInput({
        playerProximity: true,
        activePressureSeverity: 80,
        hasIrreversibleEvent: true,
      }),
    );
    assert.deepEqual(reasons, ["critical_pressure", "irreversible_event", "player_proximity"]);
  });

  it("respects custom promotion config", () => {
    const reasons = causalSimulationPromotionReasons(
      makeInput({ playerProximity: true }, 1000, {
        promotion: { playerProximity: false },
      }),
    );
    assert.ok(!reasons.includes("player_proximity"));
  });
});

// ---------------------------------------------------------------------------
// causalSimulationDemotionReasons
// ---------------------------------------------------------------------------

describe("causalSimulationDemotionReasons", () => {
  it("returns quiet_long_enough when subject has been quiet past threshold", () => {
    const reasons = causalSimulationDemotionReasons(
      makeInput({ lastInteractionWorldMinute: 0 }, 10080),
    );
    assert.ok(reasons.includes("quiet_long_enough"));
  });

  it("does not return quiet_long_enough when recently active", () => {
    const reasons = causalSimulationDemotionReasons(
      makeInput({ lastInteractionWorldMinute: 5000 }, 5500),
    );
    assert.ok(!reasons.includes("quiet_long_enough"));
  });

  it("uses lastChangedWorldMinute when it is more recent than lastInteraction", () => {
    const reasons = causalSimulationDemotionReasons(
      makeInput(
        { lastInteractionWorldMinute: 0, lastChangedWorldMinute: 9000 },
        10080,
      ),
    );
    // quiet = 10080 - 9000 = 1080 < 10080 => not quiet enough
    assert.ok(!reasons.includes("quiet_long_enough"));
  });

  it("returns low_pressure when pressure is at or below threshold", () => {
    const reasons = causalSimulationDemotionReasons(
      makeInput({ activePressureSeverity: 29 }),
    );
    assert.ok(reasons.includes("low_pressure"));
  });

  it("does not return low_pressure when pressure exceeds threshold", () => {
    const reasons = causalSimulationDemotionReasons(
      makeInput({ activePressureSeverity: 30 }),
    );
    assert.ok(!reasons.includes("low_pressure"));
  });

  it("returns not_player_proximate when subject is not near player", () => {
    const reasons = causalSimulationDemotionReasons(
      makeInput({ playerProximity: false }),
    );
    assert.ok(reasons.includes("not_player_proximate"));
  });

  it("does not return not_player_proximate when near player", () => {
    const reasons = causalSimulationDemotionReasons(
      makeInput({ playerProximity: true }),
    );
    assert.ok(!reasons.includes("not_player_proximate"));
  });

  it("returns no_irreversible_event when subject has no irreversible event", () => {
    const reasons = causalSimulationDemotionReasons(
      makeInput({ hasIrreversibleEvent: false }),
    );
    assert.ok(reasons.includes("no_irreversible_event"));
  });

  it("does not return no_irreversible_event when subject has irreversible event", () => {
    const reasons = causalSimulationDemotionReasons(
      makeInput({ hasIrreversibleEvent: true }),
    );
    assert.ok(!reasons.includes("no_irreversible_event"));
  });

  it("returns all demotion reasons sorted alphabetically when all conditions met", () => {
    const reasons = causalSimulationDemotionReasons(
      makeInput(
        {
          lastInteractionWorldMinute: 0,
          activePressureSeverity: 0,
          playerProximity: false,
          hasIrreversibleEvent: false,
        },
        10080,
      ),
    );
    assert.deepEqual(reasons, [
      "low_pressure",
      "no_irreversible_event",
      "not_player_proximate",
      "quiet_long_enough",
    ]);
  });

  it("treats undefined lastInteraction and lastChanged as minute 0", () => {
    // currentWorldMinute=10080, lastActive=0 => quiet=10080, meets threshold
    const reasons = causalSimulationDemotionReasons(
      makeInput({}, 10080),
    );
    assert.ok(reasons.includes("quiet_long_enough"));
  });
});

// ---------------------------------------------------------------------------
// nextCausalSimulationLodDecision
// ---------------------------------------------------------------------------

describe("nextCausalSimulationLodDecision", () => {
  it("holds at LOD 0 when no promotion reasons and cannot demote below 0", () => {
    const decision = nextCausalSimulationLodDecision(
      makeInput({ simulationLod: 0 }),
    );
    assert.equal(decision.action, "hold");
    assert.equal(decision.fromLod, 0);
    assert.equal(decision.toLod, 0);
    assert.deepEqual(decision.reasons, []);
  });

  it("promotes from LOD 0 to LOD 1 when promotion reasons exist", () => {
    const decision = nextCausalSimulationLodDecision(
      makeInput({ simulationLod: 0, playerProximity: true }),
    );
    assert.equal(decision.action, "promote");
    assert.equal(decision.fromLod, 0);
    assert.equal(decision.toLod, 1);
    assert.ok(decision.reasons.includes("player_proximity"));
  });

  it("promotes from LOD 1 to LOD 2 on critical pressure", () => {
    const decision = nextCausalSimulationLodDecision(
      makeInput({ simulationLod: 1, activePressureSeverity: 75 }),
    );
    assert.equal(decision.action, "promote");
    assert.equal(decision.fromLod, 1);
    assert.equal(decision.toLod, 2);
  });

  it("promotes from LOD 2 to LOD 3 (max)", () => {
    const decision = nextCausalSimulationLodDecision(
      makeInput({ simulationLod: 2, playerProximity: true }),
    );
    assert.equal(decision.action, "promote");
    assert.equal(decision.fromLod, 2);
    assert.equal(decision.toLod, 3);
  });

  it("holds at LOD 3 even with promotion reasons (cannot promote past max)", () => {
    const decision = nextCausalSimulationLodDecision(
      makeInput({ simulationLod: 3, playerProximity: true }),
    );
    assert.equal(decision.action, "hold");
    assert.equal(decision.fromLod, 3);
    assert.equal(decision.toLod, 3);
  });

  it("demotes from LOD 1 to LOD 0 when all demotion conditions met", () => {
    const decision = nextCausalSimulationLodDecision(
      makeInput(
        {
          simulationLod: 1,
          lastInteractionWorldMinute: 0,
          activePressureSeverity: 0,
          playerProximity: false,
          hasIrreversibleEvent: false,
        },
        10080,
      ),
    );
    assert.equal(decision.action, "demote");
    assert.equal(decision.fromLod, 1);
    assert.equal(decision.toLod, 0);
  });

  it("demotes from LOD 3 to LOD 2 when all demotion conditions met", () => {
    const decision = nextCausalSimulationLodDecision(
      makeInput(
        {
          simulationLod: 3,
          lastInteractionWorldMinute: 0,
          activePressureSeverity: 0,
          playerProximity: false,
          hasIrreversibleEvent: false,
        },
        10080,
      ),
    );
    assert.equal(decision.action, "demote");
    assert.equal(decision.fromLod, 3);
    assert.equal(decision.toLod, 2);
  });

  it("holds when demotion conditions partially met (missing quiet_long_enough)", () => {
    const decision = nextCausalSimulationLodDecision(
      makeInput(
        {
          simulationLod: 2,
          lastInteractionWorldMinute: 9000,
          activePressureSeverity: 0,
          playerProximity: false,
          hasIrreversibleEvent: false,
        },
        10080,
      ),
    );
    assert.equal(decision.action, "hold");
    assert.equal(decision.fromLod, 2);
    assert.equal(decision.toLod, 2);
  });

  it("holds when demotion conditions partially met (missing low_pressure)", () => {
    const decision = nextCausalSimulationLodDecision(
      makeInput(
        {
          simulationLod: 2,
          lastInteractionWorldMinute: 0,
          activePressureSeverity: 50,
          playerProximity: false,
          hasIrreversibleEvent: false,
        },
        10080,
      ),
    );
    assert.equal(decision.action, "hold");
  });

  it("holds when demotion conditions partially met (player is proximate blocks demotion at LOD 3)", () => {
    // At LOD 3, promotion is impossible (already max), so playerProximity
    // only blocks demotion (not_player_proximate is absent from reasons).
    const decision = nextCausalSimulationLodDecision(
      makeInput(
        {
          simulationLod: 3,
          lastInteractionWorldMinute: 0,
          activePressureSeverity: 0,
          playerProximity: true,
          hasIrreversibleEvent: false,
        },
        10080,
      ),
    );
    assert.equal(decision.action, "hold");
    assert.equal(decision.fromLod, 3);
    assert.equal(decision.toLod, 3);
  });

  it("promotion takes priority over demotion when both sets of reasons exist", () => {
    // Subject at LOD 1 is quiet and low-pressure (demotion conditions),
    // but also near the player (promotion condition).
    const decision = nextCausalSimulationLodDecision(
      makeInput(
        {
          simulationLod: 1,
          lastInteractionWorldMinute: 0,
          activePressureSeverity: 0,
          playerProximity: true,
          hasIrreversibleEvent: false,
        },
        10080,
      ),
    );
    assert.equal(decision.action, "promote");
    assert.equal(decision.toLod, 2);
  });

  it("returns correct tickIntervalWorldMinutes for the target LOD", () => {
    const decision = nextCausalSimulationLodDecision(
      makeInput({ simulationLod: 0 }),
    );
    // LOD 0 hold => tick interval = 1440
    assert.equal(decision.tickIntervalWorldMinutes, 1440);
  });

  it("includes preservedState in the decision", () => {
    const decision = nextCausalSimulationLodDecision(
      makeInput({ commitments: ["c1"], debts: ["d1"] }),
    );
    assert.deepEqual(decision.preservedState.commitments, ["c1"]);
    assert.deepEqual(decision.preservedState.debts, ["d1"]);
  });

  it("clamps negative LOD to 0", () => {
    const decision = nextCausalSimulationLodDecision(
      makeInput({ simulationLod: -5 as CausalSimulationLod }),
    );
    assert.equal(decision.fromLod, 0);
  });

  it("clamps LOD > 3 to 3", () => {
    const decision = nextCausalSimulationLodDecision(
      makeInput({ simulationLod: 10 as unknown as CausalSimulationLod }),
    );
    assert.equal(decision.fromLod, 3);
    assert.equal(decision.action, "hold");
  });
});

// ---------------------------------------------------------------------------
// shouldRunCausalSimulationLodTick
// ---------------------------------------------------------------------------

describe("shouldRunCausalSimulationLodTick", () => {
  it("returns true when lastTickWorldMinute is undefined (first tick)", () => {
    assert.equal(shouldRunCausalSimulationLodTick(0, undefined, 1000), true);
    assert.equal(shouldRunCausalSimulationLodTick(3, undefined, 0), true);
  });

  it("returns true when elapsed time meets interval for LOD 0", () => {
    // LOD 0 interval = 1440
    assert.equal(shouldRunCausalSimulationLodTick(0, 0, 1440), true);
  });

  it("returns false when elapsed time is below interval for LOD 0", () => {
    assert.equal(shouldRunCausalSimulationLodTick(0, 0, 1439), false);
  });

  it("returns true when elapsed time meets interval for LOD 1", () => {
    // LOD 1 interval = 360
    assert.equal(shouldRunCausalSimulationLodTick(1, 1000, 1360), true);
  });

  it("returns false when elapsed time is below interval for LOD 1", () => {
    assert.equal(shouldRunCausalSimulationLodTick(1, 1000, 1359), false);
  });

  it("returns true when elapsed time meets interval for LOD 2", () => {
    // LOD 2 interval = 60
    assert.equal(shouldRunCausalSimulationLodTick(2, 500, 560), true);
  });

  it("returns true when elapsed time meets interval for LOD 3", () => {
    // LOD 3 interval = 5
    assert.equal(shouldRunCausalSimulationLodTick(3, 100, 105), true);
  });

  it("returns false when elapsed time is below interval for LOD 3", () => {
    assert.equal(shouldRunCausalSimulationLodTick(3, 100, 104), false);
  });

  it("returns true when elapsed time exceeds interval by a lot", () => {
    assert.equal(shouldRunCausalSimulationLodTick(3, 0, 10000), true);
  });

  it("returns true at exact interval boundary", () => {
    assert.equal(shouldRunCausalSimulationLodTick(2, 200, 260), true);
  });

  it("respects custom config intervals", () => {
    const custom = {
      levels: [
        { id: 0, label: "a", tickIntervalWorldMinutes: 100, models: [] },
        { id: 1, label: "b", tickIntervalWorldMinutes: 50, models: [] },
        { id: 2, label: "c", tickIntervalWorldMinutes: 25, models: [] },
        { id: 3, label: "d", tickIntervalWorldMinutes: 10, models: [] },
      ],
    };
    assert.equal(shouldRunCausalSimulationLodTick(0, 0, 99, custom), false);
    assert.equal(shouldRunCausalSimulationLodTick(0, 0, 100, custom), true);
  });
});
