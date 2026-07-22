import assert from "node:assert/strict";
import test from "node:test";

import {
  EPOCH_WORLD_PRESSURE_OPPORTUNITY_THRESHOLD,
  EPOCH_WORLD_PRESSURE_STATES,
  EPOCH_WORLD_PRESSURE_TYPES,
  advanceEpochWorldPressures,
  deriveEpochWorldOpportunitySeeds,
  deriveEpochWorldPressuresFromFactSignals,
  deterministicEpochWorldPressureId,
  epochWorldPressureTypeForFactSignal,
  isEpochWorldPressureTerminal,
  isLegalEpochWorldPressureTransition,
  pressureMeetsEpochWorldOpportunityThreshold,
  projectEpochWorldPressureEvent,
  sortEpochWorldPressures,
  transitionEpochWorldPressure,
  type EpochWorldPressure,
  type EpochWorldPressureFactSignal,
} from "../lib/epoch/worldPressureRules.ts";

function signal(
  overrides: Partial<EpochWorldPressureFactSignal> = {},
): EpochWorldPressureFactSignal {
  return {
    signalId: "signal_1",
    kind: "food_shortage",
    scopeRef: "region:gray_harbor",
    observedAtWorldMinute: 1_000,
    sourceFactEventIds: ["fact_food"],
    ...overrides,
  };
}

function pressure(
  overrides: Partial<EpochWorldPressure> = {},
): EpochWorldPressure {
  const sourceFactEventIds = overrides.sourceFactEventIds ?? ["fact_food"];
  const type = overrides.type ?? "survival";
  const scopeRef = overrides.scopeRef ?? "region:gray_harbor";
  return {
    pressureId: overrides.pressureId ?? deterministicEpochWorldPressureId({
      type,
      scopeRef,
      sourceFactEventIds,
    }),
    type,
    scopeRef,
    sourceFactEventIds,
    affectedActorRefs: ["actor:settlers"],
    affectedResourceRefs: ["resource:grain"],
    severity: 40,
    urgency: 50,
    growthRate: 5,
    uncertainty: 30,
    visibility: 60,
    state: "detected",
    counterPressureIds: [],
    openedAtWorldMinute: 1_000,
    updatedAtWorldMinute: 1_000,
    reviewAtWorldMinute: 1_360,
    ...overrides,
  };
}

test("exports the nine world pressure types and nine lifecycle states", () => {
  assert.deepEqual(EPOCH_WORLD_PRESSURE_TYPES, [
    "survival",
    "economic",
    "social",
    "political",
    "legal",
    "ecological",
    "military",
    "informational",
    "supernatural",
  ]);
  assert.deepEqual(EPOCH_WORLD_PRESSURE_STATES, [
    "latent",
    "detected",
    "contested",
    "mobilized",
    "resolving",
    "resolved",
    "transformed",
    "dormant",
    "catastrophic",
  ]);
});

test("maps representative fact signals into every world pressure type", () => {
  assert.deepEqual([
    epochWorldPressureTypeForFactSignal(signal({ kind: "food_shortage" })),
    epochWorldPressureTypeForFactSignal(signal({ kind: "price_spike" })),
    epochWorldPressureTypeForFactSignal(signal({ kind: "trust_collapse" })),
    epochWorldPressureTypeForFactSignal(signal({ kind: "legitimacy_loss" })),
    epochWorldPressureTypeForFactSignal(signal({ kind: "rights_violation" })),
    epochWorldPressureTypeForFactSignal(signal({ kind: "pollution" })),
    epochWorldPressureTypeForFactSignal(signal({ kind: "security_breakdown" })),
    epochWorldPressureTypeForFactSignal(signal({ kind: "rumor_spread" })),
    epochWorldPressureTypeForFactSignal(signal({ kind: "anomaly" })),
  ], EPOCH_WORLD_PRESSURE_TYPES);
});

test("derives identical pressure records from equivalent fact signals regardless of input order", () => {
  const left = deriveEpochWorldPressuresFromFactSignals({
    signals: [
      signal({
        signalId: "signal_b",
        sourceFactEventIds: ["fact_b", "fact_a"],
        affectedActorRefs: ["actor:zeta", "actor:alpha", "actor:alpha"],
        affectedResourceRefs: ["resource:water"],
        counterPressureIds: ["pressure_counter_b"],
      }),
      signal({
        signalId: "signal_a",
        sourceFactEventIds: ["fact_c", "fact_a"],
        affectedActorRefs: ["actor:beta"],
        affectedResourceRefs: ["resource:grain"],
        counterPressureIds: ["pressure_counter_a"],
      }),
    ],
    openedAtWorldMinute: 9_999,
  })[0];
  const right = deriveEpochWorldPressuresFromFactSignals({
    signals: [
      signal({
        signalId: "signal_a",
        sourceFactEventIds: ["fact_a", "fact_c"],
        affectedActorRefs: ["actor:beta"],
        affectedResourceRefs: ["resource:grain"],
        counterPressureIds: ["pressure_counter_a"],
      }),
      signal({
        signalId: "signal_b",
        sourceFactEventIds: ["fact_a", "fact_b"],
        affectedActorRefs: ["actor:alpha", "actor:zeta"],
        affectedResourceRefs: ["resource:water"],
        counterPressureIds: ["pressure_counter_b"],
      }),
    ],
    openedAtWorldMinute: 9_999,
  })[0];

  assert.deepEqual(left, right);
  assert.equal(left.pressureId, deterministicEpochWorldPressureId({
    type: "survival",
    scopeRef: "region:gray_harbor",
    sourceFactEventIds: ["fact_c", "fact_b", "fact_a"],
  }));
  assert.deepEqual(left.sourceFactEventIds, ["fact_a", "fact_b", "fact_c"]);
  assert.deepEqual(left.affectedActorRefs, ["actor:alpha", "actor:beta", "actor:zeta"]);
  assert.deepEqual(left.affectedResourceRefs, ["resource:grain", "resource:water"]);
  assert.deepEqual(left.counterPressureIds, ["pressure_counter_a", "pressure_counter_b"]);
});

test("clamps derived metrics into the inclusive 0 to 100 score range", () => {
  const [result] = deriveEpochWorldPressuresFromFactSignals({
    signals: [signal({
      severity: 130,
      urgency: -10,
      growthRate: 140,
      uncertainty: -1,
      visibility: 101,
    })],
  });

  assert.equal(result.severity, 100);
  assert.equal(result.urgency, 0);
  assert.equal(result.growthRate, 100);
  assert.equal(result.uncertainty, 0);
  assert.equal(result.visibility, 100);
});

test("keeps legal state transitions deterministic and rejects illegal transitions", () => {
  const base = pressure({ state: "detected", sourceFactEventIds: ["fact_b"], counterPressureIds: ["counter_b"] });

  assert.equal(isLegalEpochWorldPressureTransition("detected", "mobilized"), true);
  assert.equal(isLegalEpochWorldPressureTransition("detected", "resolved"), false);
  assert.throws(() => transitionEpochWorldPressure({
    pressure: base,
    toState: "resolved",
    worldMinute: 1_200,
  }), /illegal_world_pressure_transition:detected->resolved/);

  const result = transitionEpochWorldPressure({
    pressure: base,
    toState: "mobilized",
    worldMinute: 1_200.9,
    sourceFactEventIds: ["fact_a"],
    counterPressureIds: ["counter_a"],
  });
  assert.equal(result.state, "mobilized");
  assert.deepEqual(result.sourceFactEventIds, ["fact_a", "fact_b"]);
  assert.deepEqual(result.counterPressureIds, ["counter_a", "counter_b"]);
  assert.equal(result.updatedAtWorldMinute, 1_200);
});

test("marks resolved pressures as terminal without scheduling another review", () => {
  const result = transitionEpochWorldPressure({
    pressure: pressure({ state: "resolving" }),
    toState: "resolved",
    worldMinute: 1_500,
  });

  assert.equal(isEpochWorldPressureTerminal(result.state), true);
  assert.equal(result.resolvedAtWorldMinute, 1_500);
  assert.equal(result.reviewAtWorldMinute, Number.MAX_SAFE_INTEGER);
});

test("advances unattended pressures by growth rate over elapsed world days", () => {
  const [result] = advanceEpochWorldPressures({
    pressures: [pressure({
      type: "survival",
      severity: 20,
      urgency: 20,
      growthRate: 10,
      uncertainty: 20,
      visibility: 20,
      state: "latent",
      updatedAtWorldMinute: 1_000,
    })],
    toWorldMinute: 2_440,
    sourceFactEventIds: ["fact_advance"],
  });

  assert.equal(result.severity, 30);
  assert.equal(result.urgency, 25);
  assert.equal(result.uncertainty, 21);
  assert.equal(result.visibility, 21);
  assert.deepEqual(result.sourceFactEventIds, ["fact_advance", "fact_food"]);
});

test("decays mobilized pressures when they are being addressed", () => {
  const [result] = advanceEpochWorldPressures({
    pressures: [pressure({
      severity: 50,
      urgency: 50,
      growthRate: 5,
      uncertainty: 30,
      state: "mobilized",
      updatedAtWorldMinute: 1_000,
    })],
    toWorldMinute: 2_440,
  });

  assert.equal(result.severity, 49);
  assert.equal(result.urgency, 49);
  assert.equal(result.uncertainty, 28);
  assert.equal(result.state, "mobilized");
});

test("expires low-severity pressures into dormant state", () => {
  const [result] = advanceEpochWorldPressures({
    pressures: [pressure({
      severity: 40,
      expiresAtWorldMinute: 1_200,
    })],
    toWorldMinute: 1_200,
    sourceFactEventIds: ["fact_expired"],
  });

  assert.equal(result.state, "dormant");
  assert.deepEqual(result.sourceFactEventIds, ["fact_expired", "fact_food"]);
});

test("expires critical pressures into catastrophic state", () => {
  const [result] = advanceEpochWorldPressures({
    pressures: [pressure({
      severity: 75,
      expiresAtWorldMinute: 1_200,
    })],
    toWorldMinute: 1_200,
  });

  assert.equal(result.state, "catastrophic");
});

test("escalates unaddressed critical pressure into catastrophic state", () => {
  const [result] = advanceEpochWorldPressures({
    pressures: [pressure({
      type: "military",
      severity: 75,
      urgency: 75,
      growthRate: 5,
      openedAtWorldMinute: 0,
      updatedAtWorldMinute: 0,
      state: "detected",
    })],
    toWorldMinute: 4_320,
  });

  assert.equal(result.state, "catastrophic");
  assert.equal(result.reviewAtWorldMinute, 4_325);
});

test("transforms resolving pressure when severity remains beyond its transform threshold", () => {
  const [result] = advanceEpochWorldPressures({
    pressures: [pressure({
      type: "supernatural",
      severity: 80,
      urgency: 80,
      growthRate: 5,
      state: "resolving",
      updatedAtWorldMinute: 1_000,
    })],
    toWorldMinute: 2_440,
  });

  assert.equal(result.state, "transformed");
  assert.equal(result.reviewAtWorldMinute, Number.MAX_SAFE_INTEGER);
});

test("does not advance terminal pressures into duplicate derived states", () => {
  const terminal = pressure({
    pressureId: "world_pressure_terminal",
    severity: 95,
    urgency: 95,
    state: "transformed",
    updatedAtWorldMinute: 1_000,
    reviewAtWorldMinute: Number.MAX_SAFE_INTEGER,
    transformedFromPressureIds: ["world_pressure_root"],
  });

  const [result] = advanceEpochWorldPressures({
    pressures: [terminal],
    toWorldMinute: 10_000,
    sourceFactEventIds: ["fact_late"],
  });

  assert.deepEqual(result, terminal);
});

test("derives a fresh pressure when matching existing pressure is terminal", () => {
  const terminal = pressure({
    pressureId: "world_pressure_resolved_existing",
    state: "resolved",
    resolvedAtWorldMinute: 1_100,
  });
  const [result] = deriveEpochWorldPressuresFromFactSignals({
    existingPressures: [terminal],
    signals: [signal({ sourceFactEventIds: ["fact_new"] })],
  });

  assert.notEqual(result.pressureId, terminal.pressureId);
  assert.equal(result.state, "latent");
  assert.equal(result.resolvedAtWorldMinute, undefined);
});

test("applies opportunity threshold and excludes dormant or terminal pressures", () => {
  assert.equal(pressureMeetsEpochWorldOpportunityThreshold(
    pressure({ severity: EPOCH_WORLD_PRESSURE_OPPORTUNITY_THRESHOLD - 1, urgency: 0 }),
  ), false);
  assert.equal(pressureMeetsEpochWorldOpportunityThreshold(
    pressure({ severity: EPOCH_WORLD_PRESSURE_OPPORTUNITY_THRESHOLD, urgency: 0 }),
  ), true);
  assert.equal(pressureMeetsEpochWorldOpportunityThreshold(
    pressure({ severity: 100, state: "dormant" }),
  ), false);
  assert.equal(pressureMeetsEpochWorldOpportunityThreshold(
    pressure({ severity: 100, state: "resolved" }),
  ), false);
});

test("derives opportunity seeds with deterministic IDs and sorted pressure order", () => {
  const lower = pressure({
    pressureId: "world_pressure_lower",
    type: "economic",
    severity: 40,
    urgency: 40,
    affectedActorRefs: ["actor:merchant"],
    counterPressureIds: ["pressure_counter"],
    uncertainty: 60,
    reviewAtWorldMinute: 2_000,
  });
  const higher = pressure({
    pressureId: "world_pressure_higher",
    type: "military",
    severity: 80,
    urgency: 70,
    affectedActorRefs: ["actor:guards"],
    sourceFactEventIds: ["fact_military"],
    uncertainty: 20,
    reviewAtWorldMinute: 1_500,
  });

  const seeds = deriveEpochWorldOpportunitySeeds([lower, higher]);

  assert.deepEqual(seeds.map((seed) => seed.rootPressureIds[0]), [
    "world_pressure_higher",
    "world_pressure_lower",
  ]);
  assert.equal(seeds[0].opportunityId, deriveEpochWorldOpportunitySeeds([higher])[0].opportunityId);
  assert.deepEqual(seeds[0], {
    opportunityId: seeds[0].opportunityId,
    rootPressureIds: ["world_pressure_higher"],
    beneficiaryRefs: ["actor:guards"],
    oppositionRefs: [],
    interventionType: "relieve_military_pressure",
    availableEvidenceRefs: ["fact_military"],
    hiddenInformationRefs: [],
    worldIntensity: 52,
    expiresAtWorldMinute: 1_500,
  });
  assert.deepEqual(seeds[1].hiddenInformationRefs, ["hidden:world_pressure_lower"]);
});

test("sorts pressures by severity, urgency, review minute, and deterministic ID tiebreakers", () => {
  const sorted = sortEpochWorldPressures([
    pressure({ pressureId: "pressure_d", severity: 50, urgency: 30, reviewAtWorldMinute: 300 }),
    pressure({ pressureId: "pressure_c", severity: 50, urgency: 40, reviewAtWorldMinute: 300 }),
    pressure({ pressureId: "pressure_b", severity: 50, urgency: 40, reviewAtWorldMinute: 200 }),
    pressure({ pressureId: "pressure_a", severity: 70, urgency: 10, reviewAtWorldMinute: 400 }),
  ]);

  assert.deepEqual(sorted.map((entry) => entry.pressureId), [
    "pressure_a",
    "pressure_b",
    "pressure_c",
    "pressure_d",
  ]);
});

test("projects world pressure events with deterministic IDs and canonical payload fields", () => {
  const base = pressure({
    pressureId: "world_pressure_projected",
    type: "economic",
    scopeRef: "region:market_row",
    sourceFactEventIds: ["fact_b", "fact_a"],
    affectedActorRefs: ["actor:zeta", "actor:alpha"],
    affectedResourceRefs: ["resource:coin"],
    counterPressureIds: ["counter_b"],
    transformedToPressureIds: ["world_pressure_child"],
    expiresAtWorldMinute: 2_000,
    resolvedAtWorldMinute: 1_700,
    updatedAtWorldMinute: 1_700,
  });

  const projected = projectEpochWorldPressureEvent({
    eventType: "world_pressure_updated",
    worldId: "world_1",
    pressure: base,
    recordedAt: "2026-07-20T00:00:00.000Z",
    causalParentEventIds: ["event_b", "event_a", "event_a"],
    actorRefs: ["actor:zeta", "actor:alpha"],
  });

  assert.equal(projected.eventId, projectEpochWorldPressureEvent({
    eventType: "world_pressure_updated",
    worldId: "world_1",
    pressure: base,
    recordedAt: "2026-07-20T00:00:00.000Z",
  }).eventId);
  assert.equal(projected.schemaVersion, "1.0.0");
  assert.deepEqual(projected.actorRefs, ["actor:alpha", "actor:zeta"]);
  assert.deepEqual(projected.subjectRefs, [
    "actor:alpha",
    "actor:zeta",
    "region:market_row",
    "resource:coin",
  ]);
  assert.deepEqual(projected.regionRefs, ["market_row"]);
  assert.deepEqual(projected.causalParentEventIds, ["event_a", "event_b"]);
  assert.deepEqual(projected.rootPressureIds, ["world_pressure_projected"]);
  assert.deepEqual(projected.payload, {
    ruleVersion: "world-pressure.v1",
    pressureId: "world_pressure_projected",
    type: "economic",
    scopeRef: "region:market_row",
    state: "detected",
    sourceFactEventIds: ["fact_b", "fact_a"],
    affectedActorRefs: ["actor:zeta", "actor:alpha"],
    affectedResourceRefs: ["resource:coin"],
    severity: 40,
    urgency: 50,
    growthRate: 5,
    uncertainty: 30,
    visibility: 60,
    counterPressureIds: ["counter_b"],
    openedAtWorldMinute: 1_000,
    updatedAtWorldMinute: 1_700,
    reviewAtWorldMinute: 1_360,
    expiresAtWorldMinute: 2_000,
    transformedToPressureIds: ["world_pressure_child"],
    resolvedAtWorldMinute: 1_700,
  });
});
