import assert from "node:assert/strict";
import test from "node:test";

import {
  EPOCH_GOVERNANCE_ECOLOGY_RULE_VERSION,
  advanceEcologyTick,
  applyGovernanceAction,
  deriveGovernancePressures,
  sortGovernanceState,
  type EcologyCrossRegionFlow,
  type GovernanceActionKind,
  type GovernanceActionProposal,
  type GovernanceState,
  type RegionResourceStock,
  type SpeciesPopulation,
} from "../lib/epoch/governanceEcologyRules.ts";

const healthyMetrics = {
  legitimacy: 70,
  administrativeCapacity: 65,
  cohesion: 60,
  corruption: 15,
  fiscal: 80,
  influence: 55,
};

function governanceState(overrides: Partial<GovernanceState> = {}): GovernanceState {
  return {
    factions: [{
      factionId: "faction_alpha",
      status: "active",
      metrics: healthyMetrics,
      claimIds: ["claim_succession"],
      institutionIds: ["institution_council"],
    }, {
      factionId: "faction_beta",
      status: "active",
      metrics: { ...healthyMetrics, influence: 40 },
    }],
    institutions: [{
      institutionId: "institution_council",
      factionId: "faction_alpha",
      jurisdictionIds: ["jurisdiction_harbor"],
      authorityRefs: ["authority:council"],
      status: "active",
      metrics: healthyMetrics,
    }],
    jurisdictions: [{
      jurisdictionId: "jurisdiction_harbor",
      regionIds: ["region_harbor"],
      institutionIds: ["institution_council"],
      lawIds: ["law_charter"],
      taxRateBasisPoints: 600,
      status: "active",
    }],
    laws: [{
      lawId: "law_charter",
      jurisdictionId: "jurisdiction_harbor",
      sponsorRef: "faction:faction_alpha",
      status: "proposed",
      authorityRefs: ["authority:council"],
    }],
    policies: [{
      policyId: "policy_clinic",
      jurisdictionId: "jurisdiction_harbor",
      institutionId: "institution_council",
      status: "proposed",
      budgetMinor: "1000",
      publicServiceCapacity: 50,
      affectedActorRefs: ["actor:resident"],
      oppositionRefs: ["faction:faction_beta"],
    }],
    offices: [{
      officeId: "office_magistrate",
      institutionId: "institution_council",
      jurisdictionId: "jurisdiction_harbor",
      status: "proposed",
      authorityRefs: ["authority:council"],
      successionClaimIds: ["claim_succession"],
    }],
    claims: [{
      claimId: "claim_succession",
      claimantRef: "actor:heir",
      targetRef: "office:office_magistrate",
      claimType: "succession",
      status: "asserted",
      evidenceRefs: ["evidence_lineage"],
      priority: 10,
    }, {
      claimId: "claim_rival",
      claimantRef: "actor:rival",
      targetRef: "office:office_magistrate",
      claimType: "succession",
      status: "asserted",
      evidenceRefs: ["evidence_rival"],
      priority: 5,
    }],
    obligations: [{
      obligationId: "obligation_tax_receipt",
      debtorRef: "faction:faction_alpha",
      beneficiaryRef: "actor:resident",
      sourceRef: "law:law_charter",
      status: "open",
      dueAtWorldMinute: 900,
      costMinor: "250",
      transferable: true,
    }],
    ...overrides,
  };
}

function action(overrides: Partial<GovernanceActionProposal> = {}): GovernanceActionProposal {
  return {
    actionId: "action_test",
    kind: "appoint_office",
    actorRef: "faction:faction_alpha",
    targetRef: "office:office_magistrate",
    sourceRef: "event:hearing",
    worldMinute: 1_000,
    sourceEventIds: ["event_b", "event_a"],
    authorizationRefs: ["authority:council"],
    requiredAuthorityRefs: ["authority:council"],
    oppositionRefs: ["faction:faction_beta"],
    cost: {},
    ...overrides,
  };
}

function stock(overrides: Partial<RegionResourceStock> = {}): RegionResourceStock {
  return {
    regionId: "region_a",
    resourceKey: "water",
    stock: 80,
    capacity: 100,
    regenerationPerTick: 10,
    extractionPerTick: 8,
    pollution: 10,
    degradation: 5,
    restorationPerTick: 1,
    irreversibleThreshold: 80,
    irreversible: false,
    ...overrides,
  };
}

function population(overrides: Partial<SpeciesPopulation> = {}): SpeciesPopulation {
  return {
    regionId: "region_a",
    speciesId: "heron",
    population: 40,
    carryingCapacity: 100,
    growthPerTick: 8,
    mortalityPerTick: 3,
    migrationOutPerTick: 0,
    irreversibleMinimum: 2,
    extinct: false,
    ...overrides,
  };
}

test("exports the governance ecology rule version", () => {
  assert.equal(EPOCH_GOVERNANCE_ECOLOGY_RULE_VERSION, "governance-ecology.v1");
});

test("sorts every governance entity directory deterministically", () => {
  const state = sortGovernanceState(governanceState({
    factions: [
      { factionId: "faction_z", status: "active", metrics: healthyMetrics },
      { factionId: "faction_a", status: "active", metrics: healthyMetrics },
    ],
    institutions: [
      { institutionId: "institution_z", jurisdictionIds: [], authorityRefs: [], status: "active", metrics: healthyMetrics },
      { institutionId: "institution_a", jurisdictionIds: [], authorityRefs: [], status: "active", metrics: healthyMetrics },
    ],
    jurisdictions: [
      { jurisdictionId: "jurisdiction_z", regionIds: [], institutionIds: [], lawIds: [], taxRateBasisPoints: 0, status: "active" },
      { jurisdictionId: "jurisdiction_a", regionIds: [], institutionIds: [], lawIds: [], taxRateBasisPoints: 0, status: "active" },
    ],
    laws: [
      { lawId: "law_z", jurisdictionId: "jurisdiction_a", sponsorRef: "faction:faction_alpha", status: "active", authorityRefs: [] },
      { lawId: "law_a", jurisdictionId: "jurisdiction_a", sponsorRef: "faction:faction_alpha", status: "active", authorityRefs: [] },
    ],
    policies: [
      { policyId: "policy_z", status: "active", budgetMinor: "0", publicServiceCapacity: 0, affectedActorRefs: [], oppositionRefs: [] },
      { policyId: "policy_a", status: "active", budgetMinor: "0", publicServiceCapacity: 0, affectedActorRefs: [], oppositionRefs: [] },
    ],
    offices: [
      { officeId: "office_z", institutionId: "institution_a", status: "active", authorityRefs: [], successionClaimIds: [] },
      { officeId: "office_a", institutionId: "institution_a", status: "active", authorityRefs: [], successionClaimIds: [] },
    ],
    claims: [
      { claimId: "claim_z", claimantRef: "actor:z", targetRef: "office:office_a", claimType: "office", status: "asserted", evidenceRefs: [], priority: 0 },
      { claimId: "claim_a", claimantRef: "actor:a", targetRef: "office:office_a", claimType: "office", status: "asserted", evidenceRefs: [], priority: 0 },
    ],
    obligations: [
      { obligationId: "obligation_z", debtorRef: "actor:z", beneficiaryRef: "actor:a", sourceRef: "law:law_a", status: "open", transferable: false },
      { obligationId: "obligation_a", debtorRef: "actor:a", beneficiaryRef: "actor:z", sourceRef: "law:law_a", status: "open", transferable: false },
    ],
  }));

  assert.deepEqual(state.factions.map((entry) => entry.factionId), ["faction_a", "faction_z"]);
  assert.deepEqual(state.institutions.map((entry) => entry.institutionId), ["institution_a", "institution_z"]);
  assert.deepEqual(state.jurisdictions.map((entry) => entry.jurisdictionId), ["jurisdiction_a", "jurisdiction_z"]);
  assert.deepEqual(state.laws.map((entry) => entry.lawId), ["law_a", "law_z"]);
  assert.deepEqual(state.policies.map((entry) => entry.policyId), ["policy_a", "policy_z"]);
  assert.deepEqual(state.offices.map((entry) => entry.officeId), ["office_a", "office_z"]);
  assert.deepEqual(state.claims.map((entry) => entry.claimId), ["claim_a", "claim_z"]);
  assert.deepEqual(state.obligations.map((entry) => entry.obligationId), ["obligation_a", "obligation_z"]);
});

test("appoints an office into the active legal state", () => {
  const result = applyGovernanceAction({
    state: governanceState(),
    action: action({ kind: "appoint_office", payload: { holderRef: "actor:nominee" } }),
  });

  assert.equal(result.status, "accepted");
  assert.equal(result.state.offices.find((office) => office.officeId === "office_magistrate")?.status, "active");
  assert.equal(result.state.offices.find((office) => office.officeId === "office_magistrate")?.holderRef, "actor:nominee");
});

test("enacts a law into the active legal state", () => {
  const result = applyGovernanceAction({
    state: governanceState(),
    action: action({ kind: "enact_law", targetRef: "law:law_charter" }),
  });

  assert.equal(result.status, "accepted");
  assert.equal(result.state.laws.find((law) => law.lawId === "law_charter")?.status, "active");
  assert.equal(result.state.laws.find((law) => law.lawId === "law_charter")?.enactedAtWorldMinute, 1_000);
});

test("amends a law into the active legal state", () => {
  const result = applyGovernanceAction({
    state: governanceState({ laws: [{ ...governanceState().laws[0], status: "active", enactedAtWorldMinute: 800 }] }),
    action: action({ kind: "amend_law", targetRef: "law:law_charter" }),
  });

  assert.equal(result.status, "accepted");
  assert.equal(result.state.laws.find((law) => law.lawId === "law_charter")?.status, "active");
  assert.equal(result.state.laws.find((law) => law.lawId === "law_charter")?.enactedAtWorldMinute, 1_000);
});

test("repeals a law into the repealed legal state", () => {
  const result = applyGovernanceAction({
    state: governanceState({ laws: [{ ...governanceState().laws[0], status: "active", enactedAtWorldMinute: 800 }] }),
    action: action({ kind: "repeal_law", targetRef: "law:law_charter" }),
  });

  assert.equal(result.status, "accepted");
  assert.equal(result.state.laws.find((law) => law.lawId === "law_charter")?.status, "repealed");
  assert.equal(result.state.laws.find((law) => law.lawId === "law_charter")?.repealedAtWorldMinute, 1_000);
});

test("adopts a policy into the active legal state", () => {
  const result = applyGovernanceAction({
    state: governanceState(),
    action: action({ kind: "adopt_policy", targetRef: "policy:policy_clinic", payload: { capacityDelta: 75 } }),
  });

  assert.equal(result.status, "accepted");
  assert.equal(result.state.policies.find((policy) => policy.policyId === "policy_clinic")?.status, "active");
  assert.equal(result.state.policies.find((policy) => policy.policyId === "policy_clinic")?.publicServiceCapacity, 100);
});

test("levies tax as a balanced resource ledger effect", () => {
  const result = applyGovernanceAction({
    state: governanceState(),
    action: action({ kind: "levy_tax", targetRef: "jurisdiction:jurisdiction_harbor", payload: { amountMinor: "3000", treasuryRef: "faction:faction_alpha" } }),
  });

  const effect = result.effects.find((entry) => entry.operation === "levy_tax");
  assert.equal(result.status, "accepted");
  assert.deepEqual(effect?.after.entries, [
    { accountRef: "jurisdiction:jurisdiction_harbor", quantityMinor: "-3000" },
    { accountRef: "faction:faction_alpha", quantityMinor: "3000" },
  ]);
});

test("imposes a sanction into the active legal state", () => {
  const result = applyGovernanceAction({
    state: governanceState(),
    action: action({ kind: "impose_sanction", targetRef: "faction:faction_beta", payload: { sanctionClass: "trade_embargo" } }),
  });

  assert.equal(result.status, "accepted");
  assert.equal(result.effects.find((entry) => entry.operation === "impose_sanction")?.after.status, "active");
});

test("recognizes an asserted succession claim and supersedes rivals", () => {
  const result = applyGovernanceAction({
    state: governanceState(),
    action: action({
      kind: "resolve_succession",
      targetRef: "claim:claim_succession",
      payload: { successionTargetRef: "office:office_magistrate" },
    }),
  });

  assert.equal(result.status, "accepted");
  assert.equal(result.state.claims.find((claim) => claim.claimId === "claim_succession")?.status, "recognized");
  assert.equal(result.state.claims.find((claim) => claim.claimId === "claim_rival")?.status, "superseded");
});

test("splits a faction into the split legal state", () => {
  const result = applyGovernanceAction({
    state: governanceState(),
    action: action({ kind: "split_faction", targetRef: "faction:faction_alpha" }),
  });

  assert.equal(result.status, "accepted");
  assert.equal(result.state.factions.find((faction) => faction.factionId === "faction_alpha")?.status, "split");
});

test("merges opposed factions into the merged legal state", () => {
  const result = applyGovernanceAction({
    state: governanceState(),
    action: action({ kind: "merge_factions", targetRef: "faction:faction_alpha" }),
  });

  assert.equal(result.status, "accepted");
  assert.equal(result.state.factions.find((faction) => faction.factionId === "faction_beta")?.status, "merged");
});

test("rejects governance action when authority is missing", () => {
  const result = applyGovernanceAction({
    state: governanceState(),
    action: action({ authorizationRefs: ["authority:wrong"] }),
  });

  assert.equal(result.status, "rejected");
  assert.equal(result.errors[0]?.code, "GOVERNANCE_PERMISSION_DENIED");
});

test("rejects governance action when cost is unfunded", () => {
  const result = applyGovernanceAction({
    state: governanceState({ factions: [{ ...governanceState().factions[0], metrics: { ...healthyMetrics, fiscal: 1 } }] }),
    action: action({ cost: { treasuryMinor: "5000" } }),
  });

  assert.equal(result.status, "rejected");
  assert.equal(result.errors[0]?.code, "GOVERNANCE_COST_UNFUNDED");
});

test("rejects governance action when source ref is missing", () => {
  const result = applyGovernanceAction({
    state: governanceState(),
    action: action({ sourceRef: "" }),
  });

  assert.equal(result.status, "rejected");
  assert.equal(result.errors[0]?.code, "GOVERNANCE_SOURCE_REQUIRED");
});

test("rejects governance action when opposition is missing", () => {
  const result = applyGovernanceAction({
    state: governanceState(),
    action: action({ oppositionRefs: [] }),
  });

  assert.equal(result.status, "rejected");
  assert.equal(result.errors[0]?.code, "GOVERNANCE_OPPOSITION_REQUIRED");
});

test("rejects succession resolution when target claim is not asserted", () => {
  const result = applyGovernanceAction({
    state: governanceState({ claims: [{ ...governanceState().claims[0], status: "recognized" }] }),
    action: action({ kind: "resolve_succession", targetRef: "claim:claim_succession" }),
  });

  assert.equal(result.status, "rejected");
  assert.equal(result.errors[0]?.code, "GOVERNANCE_CLAIM_INVALID");
});

test("clamps governance legitimacy corruption cohesion fiscal and influence after costs", () => {
  const result = applyGovernanceAction({
    state: governanceState({
      factions: [{
        ...governanceState().factions[0],
        metrics: {
          legitimacy: 3,
          administrativeCapacity: 3,
          cohesion: 3,
          corruption: 95,
          fiscal: 100,
          influence: 3,
        },
      }],
    }),
    action: action({
      cost: {
        treasuryMinor: "100000",
        legitimacy: 999,
        administrativeCapacity: 999,
        cohesion: 999,
        influence: 999,
      },
    }),
  });

  assert.equal(result.status, "accepted");
  assert.deepEqual(result.state.factions.find((faction) => faction.factionId === "faction_alpha")?.metrics, {
    legitimacy: 0,
    administrativeCapacity: 0,
    cohesion: 0,
    corruption: 100,
    fiscal: 0,
    influence: 0,
  });
});

test("derives pressure from overdue obligations and low legitimacy", () => {
  const result = deriveGovernancePressures(governanceState({
    factions: [{ ...governanceState().factions[0], metrics: { ...healthyMetrics, legitimacy: 20 } }],
  }), 1_000, ["event_clock"]);

  assert.deepEqual(result.map((signal) => signal.kind).sort(), ["legitimacy_loss", "rights_violation"]);
  assert.ok(result.every((signal) => signal.sourceFactEventIds.includes("event_clock")));
});

test("updates ecology stock with capacity regeneration extraction pollution degradation and restoration", () => {
  const result = advanceEcologyTick({
    worldMinute: 1_000,
    sourceEventIds: ["event_tick"],
    stocks: [stock()],
    populations: [],
    governance: {
      extractionLimitByRegionResource: { "region_a:water": 5 },
      restorationBonusByRegion: { region_a: 2 },
      pollutionPenaltyByRegion: { region_a: 30 },
    },
  });

  assert.equal(result.status, "accepted");
  assert.deepEqual(result.stocks[0], {
    ...stock(),
    stock: 85,
    capacity: 99,
    pollution: 40,
    degradation: 3,
  });
});

test("conserves resource quantity across region flow", () => {
  const inputStocks = [
    stock({ regionId: "region_a", stock: 80, capacity: 100, regenerationPerTick: 0, extractionPerTick: 0 }),
    stock({ regionId: "region_b", stock: 10, capacity: 50, regenerationPerTick: 0, extractionPerTick: 0 }),
  ];

  const result = advanceEcologyTick({
    worldMinute: 1_000,
    sourceEventIds: ["event_tick"],
    stocks: inputStocks,
    populations: [],
    flows: [{ fromRegionId: "region_a", toRegionId: "region_b", resourceKey: "water", quantity: 30 }],
  });

  assert.equal(result.status, "accepted");
  assert.equal(result.stocks.reduce((total, entry) => total + entry.stock, 0), 90);
  assert.equal(result.stocks.find((entry) => entry.regionId === "region_a")?.stock, 50);
  assert.equal(result.stocks.find((entry) => entry.regionId === "region_b")?.stock, 40);
});

test("applies carrying capacity pressure and migration without exceeding capacity", () => {
  const result = advanceEcologyTick({
    worldMinute: 1_000,
    sourceEventIds: ["event_tick"],
    stocks: [stock({ stock: 20, capacity: 100, regenerationPerTick: 0, extractionPerTick: 0, pollution: 60, degradation: 40 })],
    populations: [
      population({ regionId: "region_a", population: 90, carryingCapacity: 100, migrationOutPerTick: 0, migrationPreference: { region_b: 100 } }),
      population({ regionId: "region_b", population: 10, carryingCapacity: 60, growthPerTick: 0, mortalityPerTick: 0 }),
    ],
    flows: [{ fromRegionId: "region_a", toRegionId: "region_b", speciesId: "heron", quantity: 10 }],
  });

  assert.equal(result.status, "accepted");
  assert.equal(result.populations.find((entry) => entry.regionId === "region_a")?.carryingCapacity, 63);
  assert.ok((result.populations.find((entry) => entry.regionId === "region_a")?.population ?? 0) <= 63);
  assert.equal(result.populations.find((entry) => entry.regionId === "region_a")?.population, 53);
  assert.equal(result.populations.find((entry) => entry.regionId === "region_b")?.population, 20);
});

test("does not clear irreversible resource threshold with ordinary restoration", () => {
  const result = advanceEcologyTick({
    worldMinute: 1_000,
    sourceEventIds: ["event_tick"],
    stocks: [stock({
      stock: 40,
      capacity: 100,
      regenerationPerTick: 20,
      extractionPerTick: 0,
      pollution: 0,
      degradation: 90,
      restorationPerTick: 100,
      irreversibleThreshold: 80,
      irreversible: true,
    })],
    populations: [],
    governance: { restorationBonusByRegion: { region_a: 100 } },
  });

  assert.equal(result.status, "accepted");
  assert.equal(result.stocks[0]?.irreversible, true);
  assert.equal(result.stocks[0]?.capacity, 40);
  assert.equal(result.stocks[0]?.stock, 40);
});

test("rejects invalid ecology capacity inputs", () => {
  const result = advanceEcologyTick({
    worldMinute: 1_000,
    sourceEventIds: ["event_tick"],
    stocks: [stock({ capacity: -1 })],
    populations: [],
  });

  assert.equal(result.status, "rejected");
  assert.equal(result.errors[0]?.code, "ECOLOGY_CAPACITY_INVALID");
});

test("rejects ecology flows with missing endpoints", () => {
  const result = advanceEcologyTick({
    worldMinute: 1_000,
    sourceEventIds: ["event_tick"],
    stocks: [stock({ regionId: "region_a" })],
    populations: [],
    flows: [{ fromRegionId: "region_a", toRegionId: "region_missing", resourceKey: "water", quantity: 5 }],
  });

  assert.equal(result.status, "rejected");
  assert.equal(result.errors[0]?.code, "ECOLOGY_ENTITY_MISSING");
});

test("keeps multi tick ecology deterministic without negative stock or excess capacity", () => {
  const flows: readonly EcologyCrossRegionFlow[] = [
    { fromRegionId: "region_a", toRegionId: "region_b", resourceKey: "water", quantity: 7 },
    { fromRegionId: "region_b", toRegionId: "region_a", speciesId: "heron", quantity: 3 },
  ];
  const initialStocks = [
    stock({ regionId: "region_b", stock: 40, capacity: 80 }),
    stock({ regionId: "region_a", stock: 80, capacity: 100 }),
  ];
  const initialPopulations = [
    population({ regionId: "region_b", population: 20, carryingCapacity: 60, migrationPreference: { region_a: 100 } }),
    population({ regionId: "region_a", population: 40, carryingCapacity: 100, migrationPreference: { region_b: 100 } }),
  ];
  const run = () => {
    let stocks = initialStocks;
    let populations = initialPopulations;
    for (let tick = 0; tick < 4; tick += 1) {
      const result = advanceEcologyTick({
        worldMinute: 1_000 + tick,
        sourceEventIds: ["event_tick"],
        stocks,
        populations,
        flows,
      });
      assert.equal(result.status, "accepted");
      stocks = result.stocks;
      populations = result.populations;
    }
    return { stocks, populations };
  };

  const first = run();
  const second = run();
  assert.deepEqual(first, second);
  assert.ok(first.stocks.every((entry) => entry.stock >= 0 && entry.stock <= entry.capacity));
  assert.ok(first.populations.every((entry) => entry.population >= 0 && entry.population <= entry.carryingCapacity));
});

test("preserves proposal source metadata on governance effects and pressures", () => {
  const result = applyGovernanceAction({
    state: governanceState(),
    action: action({ kind: "split_faction", targetRef: "faction:faction_alpha", sourceEventIds: ["event_z", "event_a"] }),
  });

  assert.equal(result.status, "accepted");
  assert.ok(result.effects.length > 0);
  assert.ok(result.effects.every((effect) => effect.sourceEventIds?.join(",") === "event_a,event_z"));
  assert.ok(result.effects.every((effect) => effect.authorizationRefs?.includes("authority:council")));
  assert.ok(result.effects.some((effect) => effect.after.sourceRef === "event:hearing" || effect.after.reasonCode === "governance_split"));
  assert.ok(result.pressureSignals.every((signal) => signal.sourceFactEventIds.join(",") === "event_a,event_z"));
});

test("preserves source metadata on ecology effects and pressures", () => {
  const result = advanceEcologyTick({
    worldMinute: 1_000,
    sourceEventIds: ["event_z", "event_a"],
    stocks: [stock({ pollution: 80 })],
    populations: [population()],
  });

  assert.equal(result.status, "accepted");
  assert.ok(result.effects.length > 0);
  assert.ok(result.effects.every((effect) => effect.sourceEventIds?.join(",") === "event_a,event_z"));
  assert.ok(result.effects.every((effect) => effect.authorizationRefs?.join(",") === "auth:system:ecology_tick"));
  assert.ok(result.pressureSignals.length > 0);
  assert.ok(result.pressureSignals.every((signal) => signal.sourceFactEventIds.join(",") === "event_a,event_z"));
});
