import {
  JOURNEY_RUN_SCORE_AUTHORITY,
  JOURNEY_RUN_SCORE_CONTRACT_VERSION,
  JOURNEY_RUN_SCORE_DIMENSIONS,
  JOURNEY_RUN_SCORE_FORMULA,
  JOURNEY_RUN_SCORE_WEIGHT_BPS,
  JOURNEY_RUN_SUITABILITY_DIMENSIONS,
  type JourneyRunReceiptMetric,
  type JourneyRunScore,
  type JourneyRunScoreDimension,
  type JourneyRunScoreMetric,
  type JourneyRunSuitability,
  type JourneyRunSuitabilityDimension,
} from "./journeyRunReceiptRules.ts";

export const PHASE6_SERVER_SCORING_RULESET_VERSION = "obsidian-epoch-phase6-server-scoring-v0.2.0" as const;
export const PHASE6_SERVER_SCORING_CALCULATION_VERSION = "phase6_server_score_suitability_v2" as const;

type UnknownRecord = Readonly<Record<string, unknown>>;

export type Phase6ServerScoringFindingCode =
  | "PHASE6_SERVER_SCORING_INPUT_INVALID"
  | "PHASE6_SERVER_SCORING_CLIENT_PRECOMPUTED_REJECTED"
  | "PHASE6_SERVER_SCORING_EVENT_EVIDENCE_MISSING"
  | "PHASE6_SERVER_SCORING_OUTCOME_EVIDENCE_MISSING"
  | "PHASE6_SERVER_SCORING_SUITABILITY_EVIDENCE_MISSING";

export interface Phase6ServerScoringFinding {
  readonly code: Phase6ServerScoringFindingCode;
  readonly severity: "error";
  readonly message: string;
  readonly path: string;
  readonly details?: UnknownRecord;
}

export interface Phase6ServerCanonicalEvent {
  readonly eventId?: string;
  readonly id?: string;
  readonly eventType?: string;
  readonly type?: string;
  readonly kind?: string;
  readonly tags?: readonly string[];
  readonly evidenceRefs?: readonly string[];
  readonly occurredAtWorldMinute?: number;
  readonly payload?: unknown;
  readonly deltas?: readonly unknown[];
  readonly effects?: readonly unknown[];
  readonly [key: string]: unknown;
}

export interface Phase6ServerScoringWorldCursor {
  readonly worldId: string;
  readonly regionId?: string;
  readonly worldTime?: string;
  readonly worldMinute?: number;
  readonly simulationVersion?: number;
}

export interface Phase6ServerScoringVersionBinding {
  readonly rulesetVersion: string;
  readonly catalogVersion: string;
  readonly codeVersion: string;
  readonly scenarioMatrixVersion?: string;
  readonly calculationVersion?: typeof PHASE6_SERVER_SCORING_CALCULATION_VERSION;
}

export interface Phase6ServerScoringEvidenceInput {
  readonly canonicalEvents: readonly Phase6ServerCanonicalEvent[];
  readonly beforeSnapshot: unknown;
  readonly afterSnapshot: unknown;
  readonly outcomeResolution: unknown;
  readonly actionResolutions: readonly unknown[];
  readonly worldCursor: Phase6ServerScoringWorldCursor;
  readonly versionBinding: Phase6ServerScoringVersionBinding;
}

export interface Phase6ServerScoringMetricBreakdown {
  readonly dimension: JourneyRunScoreDimension | JourneyRunSuitabilityDimension;
  readonly value: number;
  readonly evidence: readonly string[];
  readonly factors: Readonly<Record<string, number>>;
  readonly inputContributions?: Readonly<Record<string, number>>;
  readonly formula?: string;
  readonly reasonCode?: string;
}

export interface Phase6ServerScoringDecouplingAudit {
  readonly rejectedClientPrecomputedFields: readonly string[];
  readonly usesOnlyServerCanonicalInputs: true;
  readonly combatPowerIsSingleFactorOnly: true;
  readonly scoreInputsIncludeNonCombatEvidence: true;
  readonly suitabilityInputsIncludeDifficultyPerformanceCostInjuryEvidence: true;
  readonly stableEventOrder: readonly string[];
}

export interface Phase6ServerScoringSuccess {
  readonly ok: true;
  readonly rulesetVersion: typeof PHASE6_SERVER_SCORING_RULESET_VERSION;
  readonly deterministic: true;
  readonly calculationVersion: typeof PHASE6_SERVER_SCORING_CALCULATION_VERSION;
  readonly scoreInput: JourneyRunScore;
  readonly score: JourneyRunScore;
  readonly suitabilityInput: JourneyRunSuitability;
  readonly suitability: JourneyRunSuitability;
  readonly scoreBreakdown: readonly Phase6ServerScoringMetricBreakdown[];
  readonly suitabilityBreakdown: readonly Phase6ServerScoringMetricBreakdown[];
  readonly eventIds: readonly string[];
  readonly decouplingAudit: Phase6ServerScoringDecouplingAudit;
  readonly findings: readonly [];
}

export interface Phase6ServerScoringFailure {
  readonly ok: false;
  readonly rulesetVersion: typeof PHASE6_SERVER_SCORING_RULESET_VERSION;
  readonly deterministic: true;
  readonly calculationVersion: typeof PHASE6_SERVER_SCORING_CALCULATION_VERSION;
  readonly findings: readonly Phase6ServerScoringFinding[];
}

export type Phase6ServerScoringResult = Phase6ServerScoringSuccess | Phase6ServerScoringFailure;

interface EvidenceModel {
  readonly eventIds: readonly string[];
  readonly byTopic: Readonly<Record<string, readonly string[]>>;
  readonly difficulty: number;
  readonly objective: number;
  readonly survival: number;
  readonly efficiency: number;
  readonly discovery: number;
  readonly stealth: number;
  readonly diplomacy: number;
  readonly worldImpact: number;
  readonly integrity: number;
  readonly combatPower: number;
  readonly mobility: number;
  readonly knowledge: number;
  readonly social: number;
  readonly craft: number;
  readonly resources: number;
  readonly temperament: number;
  readonly resourceCost: number;
  readonly injuryCost: number;
  readonly performance: number;
  readonly success: number;
  readonly highRiskSuccess: number;
  readonly overmatchPenalty: number;
  readonly riskHandling: number;
  readonly repeatCount: number;
  readonly antiFarmDecay: number;
  readonly expectedPerformanceBaseline: number;
}

const FORBIDDEN_PRECOMPUTED_KEYS = new Set([
  "clientScore",
  "clientSuitability",
  "modelScore",
  "modelSuitability",
  "precomputedScore",
  "precomputedSuitability",
  "scoreInput",
  "suitabilityInput",
]);

const FORBIDDEN_GENERIC_PRECOMPUTED_KEYS = new Set([
  "score",
  "suitability",
]);

const FORBIDDEN_GENERIC_PRECOMPUTED_PATHS = [
  /^\$\.(?:score|suitability)$/,
  /^\$\.(?:beforeSnapshot|afterSnapshot)\.(?:score|suitability)$/,
  /^\$\.(?:receipt|runReceipt|resultPage|settlement|preSettlement|finalizedReceipt|finalizedResultPage)(?:\.|$).*\.(?:score|suitability)$/,
  /^\$\.(?:receipt|runReceipt|resultPage|settlement|preSettlement|finalizedReceipt|finalizedResultPage)\.(?:score|suitability)$/,
] as const;

const TOPIC_KEYWORDS: Readonly<Record<string, readonly string[]>> = {
  objective: ["objective", "mission", "goal", "resolved", "complete", "success", "failure", "outcome"],
  survival: ["survival", "alive", "death", "injury", "wound", "health", "medical"],
  efficiency: ["efficiency", "resource", "cost", "consume", "spend", "time", "delay", "ammo", "supplies"],
  discovery: ["discovery", "intel", "knowledge", "clue", "scan", "survey", "learn", "reveal"],
  stealth: ["stealth", "hidden", "alarm", "detected", "trace", "infiltration"],
  diplomacy: ["diplomacy", "social", "negotiate", "reputation", "faction", "trust"],
  world_impact: ["world", "pressure", "region", "stability", "consequence", "causal", "impact"],
  integrity: ["integrity", "canonical", "settlement", "receipt", "server", "audit"],
  combat: ["combat", "attack", "damage", "enemy", "hostile", "threat", "battle", "power"],
  mobility: ["mobility", "move", "travel", "speed", "evade", "position"],
  craft: ["craft", "repair", "build", "forge", "manufacture", "tool"],
  temperament: ["temperament", "morale", "panic", "discipline", "will", "stress"],
  difficulty: ["difficulty", "hazard", "risk", "threat", "challenge", "opposition"],
  performance: ["performance", "quality", "execution", "precision", "success", "objective"],
};

export function buildPhase6ServerScoringEvidence(
  input: Phase6ServerScoringEvidenceInput,
): Phase6ServerScoringResult {
  const findings = validateInput(input);
  if (findings.length > 0) return fail(findings);

  const model = buildEvidenceModel(input);
  const evidenceFindings = validateEvidenceModel(model);
  if (evidenceFindings.length > 0) return fail(evidenceFindings);

  const scoreBreakdown = buildScoreBreakdown(model);
  const suitabilityBreakdown = buildSuitabilityBreakdown(model);
  const score = canonicalScore(model, scoreBreakdown);
  const suitability = metricMap(suitabilityBreakdown, JOURNEY_RUN_SUITABILITY_DIMENSIONS) as JourneyRunSuitability;

  return {
    ok: true,
    rulesetVersion: PHASE6_SERVER_SCORING_RULESET_VERSION,
    deterministic: true,
    calculationVersion: PHASE6_SERVER_SCORING_CALCULATION_VERSION,
    scoreInput: score,
    score,
    suitabilityInput: suitability,
    suitability,
    scoreBreakdown,
    suitabilityBreakdown,
    eventIds: model.eventIds,
    decouplingAudit: {
      rejectedClientPrecomputedFields: [],
      usesOnlyServerCanonicalInputs: true,
      combatPowerIsSingleFactorOnly: true,
      scoreInputsIncludeNonCombatEvidence: true,
      suitabilityInputsIncludeDifficultyPerformanceCostInjuryEvidence: true,
      stableEventOrder: model.eventIds,
    },
    findings: [],
  };
}

function validateInput(input: Phase6ServerScoringEvidenceInput): readonly Phase6ServerScoringFinding[] {
  const findings: Phase6ServerScoringFinding[] = [];
  if (!isRecord(input)) {
    return [finding("PHASE6_SERVER_SCORING_INPUT_INVALID", "input must be an object", "$")];
  }
  const forbidden = collectForbiddenPrecomputedFields(input);
  if (forbidden.length > 0) {
    findings.push(finding(
      "PHASE6_SERVER_SCORING_CLIENT_PRECOMPUTED_REJECTED",
      "server scoring evidence must not accept client/model precomputed score or suitability",
      "$",
      { fields: forbidden },
    ));
  }
  if (!Array.isArray(input.canonicalEvents) || input.canonicalEvents.length === 0) {
    findings.push(finding(
      "PHASE6_SERVER_SCORING_EVENT_EVIDENCE_MISSING",
      "canonical server events are required for deterministic scoring",
      "$.canonicalEvents",
    ));
  }
  if (!isRecord(input.worldCursor) || !nonEmpty(input.worldCursor.worldId)) {
    findings.push(finding(
      "PHASE6_SERVER_SCORING_INPUT_INVALID",
      "world cursor with worldId is required",
      "$.worldCursor",
    ));
  }
  if (!isRecord(input.versionBinding) || !nonEmpty(input.versionBinding.rulesetVersion) || !nonEmpty(input.versionBinding.catalogVersion) || !nonEmpty(input.versionBinding.codeVersion)) {
    findings.push(finding(
      "PHASE6_SERVER_SCORING_INPUT_INVALID",
      "version binding requires rulesetVersion, catalogVersion, and codeVersion",
      "$.versionBinding",
    ));
  }
  if (input.versionBinding?.calculationVersion && input.versionBinding.calculationVersion !== PHASE6_SERVER_SCORING_CALCULATION_VERSION) {
    findings.push(finding(
      "PHASE6_SERVER_SCORING_INPUT_INVALID",
      "calculationVersion does not match this deterministic scoring module",
      "$.versionBinding.calculationVersion",
      { expected: PHASE6_SERVER_SCORING_CALCULATION_VERSION },
    ));
  }
  if (!isRecord(input.outcomeResolution)) {
    findings.push(finding(
      "PHASE6_SERVER_SCORING_OUTCOME_EVIDENCE_MISSING",
      "server outcome resolution is required",
      "$.outcomeResolution",
    ));
  }
  if (!Array.isArray(input.actionResolutions)) {
    findings.push(finding(
      "PHASE6_SERVER_SCORING_INPUT_INVALID",
      "server action resolutions must be provided as an array",
      "$.actionResolutions",
    ));
  }
  return findings;
}

function buildEvidenceModel(input: Phase6ServerScoringEvidenceInput): EvidenceModel {
  const events = input.canonicalEvents
    .map((event, index) => ({ event, index, id: eventId(event, index) }))
    .sort((left, right) => left.id.localeCompare(right.id) || left.index - right.index);
  const eventIds = events.map((entry) => entry.id);
  const byTopic = Object.fromEntries(
    Object.keys(TOPIC_KEYWORDS).map((topic) => [
      topic,
      evidenceForTopic(topic, events.map((entry) => entry.event), eventIds),
    ]),
  );
  const before = numericSummary(input.beforeSnapshot);
  const after = numericSummary(input.afterSnapshot);
  const outcome = numericSummary(input.outcomeResolution);
  const actions = numericSummary(input.actionResolutions);
  const canonical = numericSummary(input.canonicalEvents);

  const difficulty = firstKnown([
    readNamedNumber(input.outcomeResolution, ["difficulty", "challenge", "threat", "risk"]),
    readNamedNumber(input.canonicalEvents, ["difficulty", "challenge", "threat", "risk", "hazard", "opposition"]),
    scaled(canonical.positive + canonical.negative, 0, 120),
  ]);
  const resourceCost = clamp01(firstKnown([
    readNamedNumber(input.outcomeResolution, ["resourceCost", "resource_cost", "cost", "spent"]),
    readNamedNumber(input.actionResolutions, ["resourceCost", "resource_cost", "cost", "spent", "consumed"]),
    Math.max(0, before.resource - after.resource) / 100,
  ]));
  const injuryCost = clamp01(firstKnown([
    readNamedNumber(input.outcomeResolution, ["injuryCost", "injury_cost", "injury", "wound", "damageTaken"]),
    readNamedNumber(input.actionResolutions, ["injuryCost", "injury_cost", "injury", "wound", "damageTaken"]),
    Math.max(0, after.injury - before.injury) / 100,
  ]));
  const performance = clamp01(firstKnown([
    // `completion` only says that the settlement record was finalized.  It is
    // not execution quality, and treating it as such flattened every settled
    // run to 100 before the real server performance field was reached.
    readNamedNumber(input.outcomeResolution, ["performance", "quality", "executionQuality"]),
    readNamedNumber(input.actionResolutions, ["performance", "quality", "executionQuality"]),
    0.5 + (outcome.positive - outcome.negative + actions.positive - actions.negative) / 80,
  ]));
  const objective = clamp01(firstKnown([
    readNamedNumber(input.outcomeResolution, ["objective", "objectiveCompletion", "completion", "success"]),
    0.5 + (outcome.positive - outcome.negative) / 60,
  ]));
  const survival = clamp01(1 - injuryCost * 0.7 - hasDeathEvidence(input) * 0.8);
  const efficiency = clamp01(1 - resourceCost * 0.55 - injuryCost * 0.25 - scaled(actions.negative, 0, 80) * 0.2);
  const discovery = topicValue(input, "discovery", canonical, 0.45);
  const stealth = topicValue(input, "stealth", canonical, 0.5);
  const diplomacy = topicValue(input, "diplomacy", canonical, 0.5);
  const worldImpact = clamp01(firstKnown([
    readNamedNumber(input.outcomeResolution, ["worldImpact", "world_impact", "impact", "stability"]),
    0.5 + (canonical.positive - canonical.negative) / 100,
  ]));
  const integrity = clamp01(0.75 + Math.min(eventIds.length, 10) / 40);
  const combatPower = clamp01(firstKnown([
    readNamedNumber(input.afterSnapshot, ["combatPower", "combat_power", "readiness", "power"]),
    readNamedNumber(input.beforeSnapshot, ["combatPower", "combat_power", "readiness", "power"]),
    scaled(after.combat + before.combat, 0, 200),
  ]));
  const success = successSignal(input);
  const highRiskSuccess = clamp01(success * difficulty);
  const overmatchPenalty = clamp01(Math.max(0, combatPower - difficulty) * (1 - success) + Math.max(0, combatPower - difficulty - 0.2) * success * 0.35);
  const riskHandling = clamp01(firstKnown([
    readNamedNumber(input.outcomeResolution, ["riskHandling", "riskManagement", "hazardControl", "riskMitigation"]),
    readNamedNumber(input.actionResolutions, ["riskHandling", "riskManagement", "hazardControl", "riskMitigation"]),
    performance * 0.45 + survival * 0.35 + efficiency * 0.2,
  ]));
  const repeatCount = Math.max(1, Math.round(firstKnown([
    readNamedRawNumber(input.outcomeResolution, ["repeatCount", "routeRepeatCount", "farmCount", "repeatedRouteCount"]),
    readNamedRawNumber(input.canonicalEvents, ["repeatCount", "routeRepeatCount", "farmCount", "repeatedRouteCount"]),
    1,
  ])));
  const antiFarmDecay = Math.max(0.65, Math.min(1, 1 - Math.max(0, repeatCount - 1) * 0.06));
  const expectedPerformanceBaseline = clamp01(
    0.5 + difficulty * 0.2 + Math.max(0, difficulty - combatPower) * 0.1,
  );

  return {
    eventIds,
    byTopic,
    difficulty,
    objective,
    survival,
    efficiency,
    discovery,
    stealth,
    diplomacy,
    worldImpact,
    integrity,
    combatPower,
    mobility: topicSnapshotValue(input, "mobility", before, after),
    knowledge: Math.max(discovery, topicSnapshotValue(input, "discovery", before, after)),
    social: Math.max(diplomacy, topicSnapshotValue(input, "diplomacy", before, after)),
    craft: topicSnapshotValue(input, "craft", before, after),
    resources: clamp01(1 - resourceCost),
    temperament: clamp01(0.45 + performance * 0.3 + survival * 0.2 - injuryCost * 0.15),
    resourceCost,
    injuryCost,
    performance,
    success,
    highRiskSuccess,
    overmatchPenalty,
    riskHandling,
    repeatCount,
    antiFarmDecay,
    expectedPerformanceBaseline,
  };
}

function validateEvidenceModel(model: EvidenceModel): readonly Phase6ServerScoringFinding[] {
  const findings: Phase6ServerScoringFinding[] = [];
  if (model.eventIds.length === 0) {
    findings.push(finding(
      "PHASE6_SERVER_SCORING_EVENT_EVIDENCE_MISSING",
      "at least one canonical event id is required",
      "$.canonicalEvents",
    ));
  }
  if (!hasAnyEvidence(model.byTopic, ["objective", "survival", "world_impact", "performance"])) {
    findings.push(finding(
      "PHASE6_SERVER_SCORING_OUTCOME_EVIDENCE_MISSING",
      "outcome scoring requires objective, survival, world impact, or performance event evidence",
      "$.canonicalEvents",
    ));
  }
  if (!hasAnyEvidence(model.byTopic, ["difficulty", "combat"])) {
    findings.push(finding(
      "PHASE6_SERVER_SCORING_SUITABILITY_EVIDENCE_MISSING",
      "suitability requires actual difficulty or combat/threat evidence",
      "$.canonicalEvents",
    ));
  }
  if (!hasAnyEvidence(model.byTopic, ["efficiency", "survival"]) || model.performance === 0.5) {
    findings.push(finding(
      "PHASE6_SERVER_SCORING_SUITABILITY_EVIDENCE_MISSING",
      "suitability requires performance, resource cost, injury, or survival cost evidence",
      "$.canonicalEvents",
    ));
  }
  return findings;
}

function buildScoreBreakdown(model: EvidenceModel): readonly Phase6ServerScoringMetricBreakdown[] {
  const objectiveScore = clamp01(model.objective * 0.7 + model.success * 0.2 + model.performance * 0.1);
  const causalImpactScore = clamp01(model.worldImpact * 0.65 + model.objective * 0.2 + model.discovery * 0.15);
  const executionScore = clamp01(model.performance * 0.6 + model.objective * 0.2 + model.efficiency * 0.12 + model.survival * 0.08);
  const riskScore = clamp01(model.riskHandling * 0.65 + model.survival * 0.2 + model.efficiency * 0.15);
  const survivalScore = clamp01(model.survival * 0.82 + model.performance * 0.1 + model.success * 0.08);
  const efficiencyScore = clamp01(model.efficiency * 0.78 + model.performance * 0.12 + model.success * 0.1);
  return [
    scoreMetric("objective", objectiveScore, model.byTopic.objective, {
      objective: model.objective,
      success: model.success,
      performance: model.performance,
    }, { objective: 0.7, success: 0.2, performance: 0.1 },
    "objective * 0.70 + success * 0.20 + performance * 0.10", "objective_resolution_quality"),
    scoreMetric("causalImpact", causalImpactScore, model.byTopic.world_impact, {
      worldImpact: model.worldImpact,
      objective: model.objective,
      discovery: model.discovery,
    }, { worldImpact: 0.65, objective: 0.2, discovery: 0.15 },
    "worldImpact * 0.65 + objective * 0.20 + discovery * 0.15", "canonical_causal_impact"),
    scoreMetric("execution", executionScore, model.byTopic.performance, {
      performance: model.performance,
      objective: model.objective,
      efficiency: model.efficiency,
      survival: model.survival,
    }, { performance: 0.6, objective: 0.2, efficiency: 0.12, survival: 0.08 },
    "performance * 0.60 + objective * 0.20 + efficiency * 0.12 + survival * 0.08", "execution_quality"),
    scoreMetric("risk", riskScore, [...model.byTopic.performance, ...model.byTopic.survival], {
      riskHandling: model.riskHandling,
      survival: model.survival,
      efficiency: model.efficiency,
    }, { riskHandling: 0.65, survival: 0.2, efficiency: 0.15 },
    "riskHandling * 0.65 + survival * 0.20 + efficiency * 0.15", "risk_management_quality"),
    scoreMetric("integrity", model.integrity, model.eventIds, { integrity: model.integrity }, { integrity: 1 },
      "integrity", "canonical_evidence_integrity"),
    scoreMetric("efficiency", efficiencyScore, model.byTopic.efficiency, {
      efficiency: model.efficiency,
      performance: model.performance,
      success: model.success,
    }, { efficiency: 0.78, performance: 0.12, success: 0.1 },
    "efficiency * 0.78 + performance * 0.12 + success * 0.10", "resource_efficiency"),
    scoreMetric("survival", survivalScore, model.byTopic.survival, {
      survival: model.survival,
      performance: model.performance,
      success: model.success,
    }, { survival: 0.82, performance: 0.1, success: 0.08 },
    "survival * 0.82 + performance * 0.10 + success * 0.08", "survival_quality"),
    scoreMetric("antiFarmDecay", model.antiFarmDecay, model.eventIds, {
      repeatCount: model.repeatCount,
      decay: model.antiFarmDecay,
    }, { decay: 1 },
    "max(0.65, 1 - max(0, repeatCount - 1) * 0.06)", "anti_farm_repeat_decay"),
  ];
}

function scoreMetric(
  dimension: JourneyRunScoreDimension,
  rawValue: number,
  evidence: readonly string[],
  inputs: Readonly<Record<string, number>>,
  coefficients: Readonly<Record<string, number>>,
  formula: string,
  reasonCode: string,
): Phase6ServerScoringMetricBreakdown {
  return {
    dimension,
    value: toReceiptValue(rawValue),
    evidence,
    factors: Object.fromEntries(Object.entries(inputs).map(([key, value]) => [key, round4(value)])),
    inputContributions: Object.fromEntries(Object.entries(coefficients).map(([key, coefficient]) => [
      key,
      round4((inputs[key] ?? 0) * coefficient * 100),
    ])),
    formula,
    reasonCode,
  };
}

function canonicalScore(
  model: EvidenceModel,
  breakdown: readonly Phase6ServerScoringMetricBreakdown[],
): JourneyRunScore {
  const dimensions = Object.fromEntries(JOURNEY_RUN_SCORE_DIMENSIONS.map((dimension) => {
    const entry = breakdown.find((candidate) => candidate.dimension === dimension);
    const value = entry?.value ?? 0;
    const evidence = unique(entry?.evidence.length ? entry.evidence : model.eventIds);
    const weightBps = JOURNEY_RUN_SCORE_WEIGHT_BPS[dimension];
    return [dimension, {
      value,
      evidence,
      events: evidence,
      weightBps,
      contribution: round6(value * weightBps / 10_000),
      reasonCode: entry?.reasonCode ?? "server_scoring_missing_reason",
      formula: entry?.formula ?? "0",
      inputs: entry?.factors ?? {},
      inputContributions: entry?.inputContributions ?? {},
    } satisfies JourneyRunScoreMetric];
  })) as Readonly<Record<JourneyRunScoreDimension, JourneyRunScoreMetric>>;
  const weightedTotal = round6(Object.values(dimensions).reduce((sum, metric) => sum + metric.contribution, 0));
  const decay = round4(model.antiFarmDecay);
  return {
    contractVersion: JOURNEY_RUN_SCORE_CONTRACT_VERSION,
    authority: JOURNEY_RUN_SCORE_AUTHORITY,
    provenance: "server_canonical",
    formula: JOURNEY_RUN_SCORE_FORMULA,
    dimensions,
    weightedTotal,
    decay,
    total: round6(weightedTotal * decay),
    context: {
      difficultyBaseline: round4(model.difficulty * 100),
      combatPowerBaseline: round4(model.combatPower * 100),
      expectedPerformanceBaseline: round4(model.expectedPerformanceBaseline * 100),
      observedPerformance: round4(model.performance * 100),
      performanceDeltaFromBaseline: round4((model.performance - model.expectedPerformanceBaseline) * 100),
      scoringUse: "context_only_not_weighted",
    },
  };
}

function buildSuitabilityBreakdown(model: EvidenceModel): readonly Phase6ServerScoringMetricBreakdown[] {
  const costAdjustedPerformance = clamp01(model.performance * 0.5 + model.efficiency * 0.28 + model.survival * 0.22);
  const combatAdvantage = clamp01((model.combatPower - model.difficulty + 1) / 2);
  return [
    metric("combat", model.combatPower * 0.25 + combatAdvantage * 0.1 + costAdjustedPerformance * 0.42 + model.highRiskSuccess * 0.23, model.byTopic.combat, {
      combatPower: model.combatPower,
      difficulty: model.difficulty,
      combatAdvantage,
      performance: model.performance,
      highRiskSuccess: model.highRiskSuccess,
      resourceCost: model.resourceCost,
      injuryCost: model.injuryCost,
    }),
    metric("mobility", model.mobility * 0.55 + costAdjustedPerformance * 0.45, model.byTopic.mobility, { mobility: model.mobility, performance: model.performance }),
    metric("survival", model.survival * 0.72 + model.resources * 0.18 + costAdjustedPerformance * 0.1, model.byTopic.survival, { survival: model.survival, resources: model.resources, injuryCost: model.injuryCost }),
    metric("knowledge", model.knowledge * 0.6 + model.discovery * 0.25 + costAdjustedPerformance * 0.15, model.byTopic.discovery, { knowledge: model.knowledge, discovery: model.discovery }),
    metric("social", model.social * 0.6 + model.diplomacy * 0.3 + costAdjustedPerformance * 0.1, model.byTopic.diplomacy, { social: model.social, diplomacy: model.diplomacy }),
    metric("stealth", model.stealth * 0.65 + model.efficiency * 0.2 + model.survival * 0.15, model.byTopic.stealth, { stealth: model.stealth, efficiency: model.efficiency }),
    metric("craft", model.craft * 0.55 + model.resources * 0.25 + model.efficiency * 0.2, model.byTopic.craft, { craft: model.craft, resources: model.resources }),
    metric("resources", model.resources * 0.7 + model.efficiency * 0.3, model.byTopic.efficiency, { resources: model.resources, resourceCost: model.resourceCost }),
    metric("temperament", model.temperament, model.byTopic.temperament, { temperament: model.temperament, performance: model.performance, injuryCost: model.injuryCost }),
    metric("world_fit", model.worldImpact * 0.42 + costAdjustedPerformance * 0.3 + model.highRiskSuccess * 0.28, model.byTopic.world_impact, { worldImpact: model.worldImpact, difficulty: model.difficulty, success: model.success }),
  ];
}

function metric(
  dimension: JourneyRunScoreDimension | JourneyRunSuitabilityDimension,
  rawValue: number,
  evidence: readonly string[],
  factors: Readonly<Record<string, number>>,
): Phase6ServerScoringMetricBreakdown {
  return {
    dimension,
    value: toReceiptValue(rawValue),
    evidence: evidence.length > 0 ? evidence : ["server_snapshot_delta"],
    factors: Object.fromEntries(Object.entries(factors).map(([key, value]) => [key, round4(value)])),
  };
}

function metricMap<TDimension extends string>(
  breakdown: readonly Phase6ServerScoringMetricBreakdown[],
  dimensions: readonly TDimension[],
): Readonly<Record<TDimension, JourneyRunReceiptMetric>> {
  return Object.fromEntries(dimensions.map((dimension) => {
    const entry = breakdown.find((candidate) => candidate.dimension === dimension);
    return [dimension, { value: entry?.value ?? 0, evidence: entry?.evidence ?? ["server_scoring_missing_dimension"] }];
  })) as Readonly<Record<TDimension, JourneyRunReceiptMetric>>;
}

function evidenceForTopic(
  topic: string,
  events: readonly Phase6ServerCanonicalEvent[],
  _fallbackEventIds: readonly string[],
): readonly string[] {
  const keywords = TOPIC_KEYWORDS[topic] ?? [topic];
  const matches = events
    .map((event, index) => ({ id: eventId(event, index), text: searchableText(event) }))
    .filter((entry) => keywords.some((keyword) => entry.text.includes(keyword)))
    .map((entry) => entry.id);
  return unique(matches);
}

function topicValue(
  input: Phase6ServerScoringEvidenceInput,
  topic: string,
  summary: NumericSummary,
  neutral: number,
): number {
  return clamp01(firstKnown([
    readNamedNumber(input.outcomeResolution, [topic]),
    readNamedNumber(input.actionResolutions, [topic]),
    neutral + (summary.positive - summary.negative) / 120,
  ]));
}

function topicSnapshotValue(
  input: Phase6ServerScoringEvidenceInput,
  topic: string,
  before: NumericSummary,
  after: NumericSummary,
): number {
  return clamp01(firstKnown([
    readNamedNumber(input.afterSnapshot, [topic]),
    readNamedNumber(input.beforeSnapshot, [topic]),
    0.45 + (after.positive - before.negative) / 120,
  ]));
}

interface NumericSummary {
  readonly positive: number;
  readonly negative: number;
  readonly resource: number;
  readonly injury: number;
  readonly combat: number;
}

function numericSummary(value: unknown): NumericSummary {
  const numbers = collectNamedNumbers(value);
  let positive = 0;
  let negative = 0;
  let resource = 0;
  let injury = 0;
  let combat = 0;
  for (const entry of numbers) {
    const name = entry.path.toLowerCase();
    const amount = normalizeNumber(entry.value);
    if (/(success|complete|gain|heal|stability|trust|quality|performance|benefit|reward)/.test(name)) positive += amount;
    if (/(fail|loss|damage|injury|wound|cost|spend|consume|debt|pollution|alarm|death)/.test(name)) negative += amount;
    if (/(resource|suppl|ammo|currency|material|stamina|energy|reserve|cost|spend|consume)/.test(name)) resource += amount;
    if (/(injury|wound|damage|trauma|death|health)/.test(name)) injury += amount;
    if (/(combat|power|attack|defense|readiness|threat|enemy|hostile)/.test(name)) combat += amount;
  }
  return { positive, negative, resource, injury, combat };
}

function readNamedNumber(value: unknown, names: readonly string[]): number | undefined {
  const wanted = names.map((name) => name.toLowerCase());
  for (const entry of collectNamedNumbers(value)) {
    const path = entry.path.toLowerCase();
    if (wanted.some((name) => path.endsWith(name) || path.includes(`.${name}`) || path.includes(`_${name}`))) {
      return normalizeNumber(entry.value);
    }
  }
  return undefined;
}

function readNamedRawNumber(value: unknown, names: readonly string[]): number | undefined {
  const wanted = names.map((name) => name.toLowerCase());
  for (const entry of collectNamedNumbers(value)) {
    const path = entry.path.toLowerCase();
    if (wanted.some((name) => path.endsWith(name) || path.includes(`.${name}`) || path.includes(`_${name}`))) {
      return entry.value;
    }
  }
  return undefined;
}

function collectNamedNumbers(value: unknown, path = "$", seen = new WeakSet<object>()): readonly { readonly path: string; readonly value: number }[] {
  if (typeof value === "number" && Number.isFinite(value)) return [{ path, value }];
  if (!value || typeof value !== "object") return [];
  if (seen.has(value)) return [];
  seen.add(value);
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) => collectNamedNumbers(entry, `${path}.${index}`, seen));
  }
  return Object.entries(value as Record<string, unknown>).flatMap(([key, entry]) => collectNamedNumbers(entry, `${path}.${key}`, seen));
}

function collectForbiddenPrecomputedFields(value: unknown, path = "$", seen = new WeakSet<object>()): readonly string[] {
  if (!value || typeof value !== "object") return [];
  if (seen.has(value)) return [];
  seen.add(value);
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) => collectForbiddenPrecomputedFields(entry, `${path}.${index}`, seen));
  }
  return Object.entries(value as Record<string, unknown>).flatMap(([key, entry]) => {
    const childPath = `${path}.${key}`;
    const forbidden = FORBIDDEN_PRECOMPUTED_KEYS.has(key)
      || (FORBIDDEN_GENERIC_PRECOMPUTED_KEYS.has(key)
        && FORBIDDEN_GENERIC_PRECOMPUTED_PATHS.some((pattern) => pattern.test(childPath)));
    return [
      ...(forbidden ? [childPath] : []),
      ...collectForbiddenPrecomputedFields(entry, childPath, seen),
    ];
  });
}

function eventId(event: Phase6ServerCanonicalEvent, index: number): string {
  if (nonEmpty(event.eventId)) return event.eventId;
  if (nonEmpty(event.id)) return event.id;
  return `canonical_event_${String(index).padStart(4, "0")}`;
}

function searchableText(value: unknown): string {
  if (typeof value === "string") return value.toLowerCase();
  if (typeof value === "number" || typeof value === "boolean") return String(value).toLowerCase();
  if (!value || typeof value !== "object") return "";
  if (Array.isArray(value)) return value.map(searchableText).join(" ");
  return Object.entries(value as Record<string, unknown>)
    .map(([key, entry]) => `${key} ${searchableText(entry)}`)
    .join(" ")
    .toLowerCase();
}

function hasDeathEvidence(input: Phase6ServerScoringEvidenceInput): 0 | 1 {
  return /death|dead|server_confirmed_death/.test(searchableText(input.outcomeResolution)) ? 1 : 0;
}

function successSignal(input: Phase6ServerScoringEvidenceInput): number {
  const explicit = readNamedBoolean(input.outcomeResolution, ["success", "succeeded", "resolved", "completed"])
    ?? readNamedBoolean(input.canonicalEvents, ["success", "succeeded", "resolved", "completed"]);
  if (explicit !== undefined) return explicit ? 1 : 0;
  const text = searchableText(input.outcomeResolution) || searchableText(input.canonicalEvents);
  if (/clean_success|costly_success|partial_success|success|succeeded|resolved|completed/.test(text)) return 1;
  if (/catastrophe|failure|failed|timeout|withdrawal|stalemate/.test(text)) return 0;
  return 0.5;
}

function readNamedBoolean(value: unknown, names: readonly string[]): boolean | undefined {
  const wanted = names.map((name) => name.toLowerCase());
  for (const entry of collectNamedBooleans(value)) {
    const path = entry.path.toLowerCase();
    if (wanted.some((name) => path.endsWith(name) || path.includes(`.${name}`) || path.includes(`_${name}`))) {
      return entry.value;
    }
  }
  return undefined;
}

function collectNamedBooleans(value: unknown, path = "$", seen = new WeakSet<object>()): readonly { readonly path: string; readonly value: boolean }[] {
  if (typeof value === "boolean") return [{ path, value }];
  if (!value || typeof value !== "object") return [];
  if (seen.has(value)) return [];
  seen.add(value);
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) => collectNamedBooleans(entry, `${path}.${index}`, seen));
  }
  return Object.entries(value as Record<string, unknown>).flatMap(([key, entry]) => collectNamedBooleans(entry, `${path}.${key}`, seen));
}

function hasAnyEvidence(byTopic: Readonly<Record<string, readonly string[]>>, topics: readonly string[]): boolean {
  return topics.some((topic) => (byTopic[topic] ?? []).length > 0);
}

function firstKnown(values: readonly (number | undefined)[]): number {
  return values.find((value): value is number => typeof value === "number" && Number.isFinite(value)) ?? 0;
}

function scaled(value: number, min: number, max: number): number {
  if (max <= min) return 0;
  return clamp01((value - min) / (max - min));
}

function normalizeNumber(value: number): number {
  const amount = Math.abs(value);
  if (amount > 100) return Math.min(amount / 10000, 1);
  if (amount > 1) return Math.min(amount / 100, 1);
  return amount;
}

function toReceiptValue(value: number): number {
  return Math.round(clamp01(value) * 100);
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function round6(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function unique(values: readonly string[]): readonly string[] {
  return [...new Set(values)].sort();
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function finding(
  code: Phase6ServerScoringFindingCode,
  message: string,
  path: string,
  details?: UnknownRecord,
): Phase6ServerScoringFinding {
  return { code, severity: "error", message, path, details };
}

function fail(findings: readonly Phase6ServerScoringFinding[]): Phase6ServerScoringFailure {
  return {
    ok: false,
    rulesetVersion: PHASE6_SERVER_SCORING_RULESET_VERSION,
    deterministic: true,
    calculationVersion: PHASE6_SERVER_SCORING_CALCULATION_VERSION,
    findings,
  };
}
