import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPhase6ServerScoringEvidence,
  type Phase6ServerScoringEvidenceInput,
} from "../lib/epoch/phase6ServerScoringRules.ts";
import { JOURNEY_RUN_SCORE_DIMENSIONS } from "../lib/epoch/journeyRunReceiptRules.ts";

function validInput(): Phase6ServerScoringEvidenceInput {
  return {
    canonicalEvents: [{
      eventId: "event_phase6_scoring_1",
      eventType: "journey_objective_completed",
      tags: ["objective", "survival", "difficulty", "combat", "performance", "efficiency", "world_impact"],
      payload: {
        objectiveCompletion: 1,
        survival: 1,
        difficulty: 0.6,
        threat: 0.6,
        performance: 0.8,
        resourceCost: 0.1,
        injuryCost: 0,
        worldImpact: 0.4,
      },
    }],
    beforeSnapshot: {
      player: { combatReadiness: { combatPower: 0.5 } },
      progress: { factionStandings: [{ factionId: "faction_1", score: 10 }] },
    },
    afterSnapshot: {
      player: { combatReadiness: { combatPower: 0.55 } },
      progress: { factionStandings: [{ factionId: "faction_1", score: 18 }] },
    },
    outcomeResolution: {
      objectiveCompletion: 1,
      difficulty: 0.6,
      performance: 0.8,
      resourceCost: 0.1,
      injuryCost: 0,
      worldImpact: 0.4,
    },
    actionResolutions: [{ actionId: "action_1", performance: 0.8, resourceCost: 0.1 }],
    worldCursor: { worldId: "world_1", regionId: "region_forest", worldTime: "day_1" },
    versionBinding: {
      rulesetVersion: "rules_v1",
      catalogVersion: "catalog_v1",
      codeVersion: "code_v1",
      scenarioMatrixVersion: "matrix_v1",
    },
  };
}

function scenarioInput(overrides: {
  readonly combatPower?: number;
  readonly difficulty?: number;
  readonly performance?: number;
  readonly resourceCost?: number;
  readonly injuryCost?: number;
  readonly objective?: number;
  readonly worldImpact?: number;
  readonly success?: boolean;
} = {}): Phase6ServerScoringEvidenceInput {
  const combatPower = overrides.combatPower ?? 0.55;
  const difficulty = overrides.difficulty ?? 0.6;
  const performance = overrides.performance ?? 0.8;
  const resourceCost = overrides.resourceCost ?? 0.1;
  const injuryCost = overrides.injuryCost ?? 0;
  const objective = overrides.objective ?? 1;
  const worldImpact = overrides.worldImpact ?? 0.5;
  const success = overrides.success ?? true;
  return {
    ...validInput(),
    canonicalEvents: [{
      eventId: "event_phase6_scoring_scenario",
      eventType: success ? "journey_clean_success" : "journey_failure",
      tags: ["objective", "survival", "difficulty", "combat", "performance", "efficiency", "world_impact", "resource", "injury"],
      payload: {
        objective,
        survival: Math.max(0, 1 - injuryCost),
        difficulty,
        threat: difficulty,
        performance,
        resourceCost,
        injuryCost,
        worldImpact,
        success,
      },
    }],
    beforeSnapshot: {
      player: { combatReadiness: { combatPower } },
      resources: { reserve: 1 },
    },
    afterSnapshot: {
      player: { combatReadiness: { combatPower } },
      injury: injuryCost,
      resources: { reserve: Math.max(0, 1 - resourceCost) },
    },
    outcomeResolution: {
      objective,
      difficulty,
      performance,
      resourceCost,
      injuryCost,
      worldImpact,
      success,
    },
    actionResolutions: [{ actionId: "action_scenario", performance, resourceCost, injuryCost }],
  };
}

function successful(input: Phase6ServerScoringEvidenceInput) {
  const result = buildPhase6ServerScoringEvidence(input);
  assert.equal(result.ok, true);
  return result;
}

function scoreMean(input: Phase6ServerScoringEvidenceInput): number {
  const result = successful(input);
  return result.score.total;
}

function correlation(left: readonly number[], right: readonly number[]): number {
  const leftMean = left.reduce((sum, value) => sum + value, 0) / left.length;
  const rightMean = right.reduce((sum, value) => sum + value, 0) / right.length;
  const numerator = left.reduce((sum, value, index) => sum + (value - leftMean) * (right[index] - rightMean), 0);
  const denominator = Math.sqrt(
    left.reduce((sum, value) => sum + (value - leftMean) ** 2, 0)
      * right.reduce((sum, value) => sum + (value - rightMean) ** 2, 0),
  );
  return numerator / denominator;
}

test("Phase 6 scoring accepts authoritative domain scores such as faction standing", () => {
  const result = buildPhase6ServerScoringEvidence(validInput());

  assert.equal(result.ok, true);
  assert.deepEqual(result.findings, []);
});

test("Phase 6 scoring rejects a root-level precomputed run score", () => {
  const result = buildPhase6ServerScoringEvidence({
    ...validInput(),
    score: { objective: 10_000 },
  } as Phase6ServerScoringEvidenceInput);

  assert.equal(result.ok, false);
  assert.ok(result.findings.some((finding) =>
    finding.code === "PHASE6_SERVER_SCORING_CLIENT_PRECOMPUTED_REJECTED"
      && Array.isArray(finding.details?.fields)
      && finding.details.fields.includes("$.score")
  ));
});

test("Phase 6 scoring rejects explicit model/client precomputed fields at any depth", () => {
  const result = buildPhase6ServerScoringEvidence({
    ...validInput(),
    afterSnapshot: {
      ...validInput().afterSnapshot as Record<string, unknown>,
      debug: { modelSuitability: 0.99 },
    },
  });

  assert.equal(result.ok, false);
  assert.ok(result.findings.some((finding) =>
    finding.code === "PHASE6_SERVER_SCORING_CLIENT_PRECOMPUTED_REJECTED"
      && Array.isArray(finding.details?.fields)
      && finding.details.fields.includes("$.afterSnapshot.debug.modelSuitability")
  ));
});

test("combat suitability remains monotonic but does not dominate server scoring", () => {
  const weak = successful(scenarioInput({ combatPower: 0.25, difficulty: 0.6 }));
  const strong = successful(scenarioInput({ combatPower: 0.85, difficulty: 0.6 }));
  const weakCombat = weak.suitability.combat.value;
  const strongCombat = strong.suitability.combat.value;
  const weakScoreMean = weak.score.total;
  const strongScoreMean = strong.score.total;

  assert.equal(strongCombat > weakCombat, true);
  assert.equal(Math.abs(strongScoreMean - weakScoreMean) <= 2, true);
});

test("successful outcomes score above failures even when failure has higher combat power", () => {
  const success = scoreMean(scenarioInput({ combatPower: 0.45, objective: 0.82, performance: 0.72, success: true }));
  const failure = scoreMean(scenarioInput({ combatPower: 0.95, objective: 0.08, performance: 0.35, success: false, injuryCost: 0.35 }));

  assert.equal(success > failure, true);
});

test("difficulty changes the expected baseline audit but never directly bonuses canonical score", () => {
  const routine = scoreMean(scenarioInput({ difficulty: 0.25, success: true, objective: 0.82, performance: 0.72, worldImpact: 0.5 }));
  const highRisk = scoreMean(scenarioInput({ difficulty: 0.9, success: true, objective: 0.82, performance: 0.72, worldImpact: 0.5 }));
  const routineContext = successful(scenarioInput({ difficulty: 0.25 })).score.context;
  const highRiskContext = successful(scenarioInput({ difficulty: 0.9 })).score.context;

  assert.equal(highRisk, routine);
  assert.equal(highRiskContext.expectedPerformanceBaseline > routineContext.expectedPerformanceBaseline, true);
  assert.equal(routineContext.scoringUse, "context_only_not_weighted");
});

test("resource cost and injury penalize score and suitability evidence", () => {
  const clean = successful(scenarioInput({ resourceCost: 0.04, injuryCost: 0.02 }));
  const costly = successful(scenarioInput({ resourceCost: 0.7, injuryCost: 0.55 }));
  const cleanScoreMean = clean.score.total;
  const costlyScoreMean = costly.score.total;

  assert.equal(clean.score.dimensions.efficiency.value > costly.score.dimensions.efficiency.value, true);
  assert.equal(clean.score.dimensions.survival.value > costly.score.dimensions.survival.value, true);
  assert.equal(clean.suitability.resources.value > costly.suitability.resources.value, true);
  assert.equal(cleanScoreMean > costlyScoreMean, true);
});

test("combat suitability breakdown is exactly recomputable from deterministic factors", () => {
  const result = successful(scenarioInput({ combatPower: 0.7, difficulty: 0.6, performance: 0.8, resourceCost: 0.1, injuryCost: 0.05 }));
  const combat = result.suitabilityBreakdown.find((entry) => entry.dimension === "combat");
  assert.ok(combat);
  const expected = Math.round((
    combat.factors.combatPower * 0.25
      + combat.factors.combatAdvantage * 0.1
      + (combat.factors.performance * 0.5 + (1 - combat.factors.resourceCost * 0.55 - combat.factors.injuryCost * 0.25) * 0.28 + (1 - combat.factors.injuryCost * 0.7) * 0.22) * 0.42
      + combat.factors.highRiskSuccess * 0.23
  ) * 100);

  assert.equal(combat.value, expected);
});

test("canonical score has exactly eight explainable dimensions and a stable server total", () => {
  const result = successful(scenarioInput());
  assert.deepEqual(Object.keys(result.score.dimensions), [...JOURNEY_RUN_SCORE_DIMENSIONS]);
  assert.equal(result.score.authority, "server_authoritative");
  assert.equal(result.score.provenance, "server_canonical");
  assert.equal(Number.isFinite(result.score.total), true);
  assert.equal(result.score.total >= 0 && result.score.total <= 100, true);
  const weighted = Object.values(result.score.dimensions).reduce((sum, metric) => {
    assert.equal(metric.events.length > 0, true);
    assert.equal(metric.formula.length > 0, true);
    assert.equal(Object.keys(metric.inputs).length > 0, true);
    assert.equal(Object.keys(metric.inputContributions).length > 0, true);
    assert.equal(metric.contribution, metric.value * metric.weightBps / 10_000);
    return sum + metric.contribution;
  }, 0);
  assert.equal(Math.abs(result.score.weightedTotal - weighted) <= 1e-6, true);
  assert.equal(Math.abs(result.score.total - result.score.weightedTotal * result.score.decay) <= 1e-6, true);
});

test("balanced ten-run quality varies while score-intensity correlation stays below 0.15", () => {
  const difficulties = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1];
  const quality = [0.6, 0.8, 0.65, 0.75, 0.7, 0.7, 0.75, 0.65, 0.8, 0.6];
  const totals = difficulties.map((difficulty, index) => scoreMean(scenarioInput({
    difficulty,
    performance: quality[index],
    objective: quality[index],
    worldImpact: quality[index] * 0.7,
    resourceCost: (1 - quality[index]) * 0.25,
    injuryCost: (1 - quality[index]) * 0.1,
  })));
  assert.equal(new Set(totals).size > 1, true);
  assert.equal(Math.abs(correlation(difficulties, totals)) < 0.15, true);
});
