import { resolveEpochCanonicalRegionId } from "../regionAliases.ts";
import {
  assertNonEmptyString,
  type EpochCommandContext,
  type EpochAttributeId,
} from "./protocol.ts";
import type {
  EpochAgentIdentity,
  EpochHostedActionRecord,
  EpochHostedSession,
  EpochInventoryItem,
  EpochProjection,
  StartHostedSessionInput,
  SubmitHostedActionInput,
} from "./gameCore.ts";
import type { EpochEvent } from "./events.ts";
import { inventoryEquipmentBonus } from "./inventoryRules.ts";
import {
  calculateMissionIntensity,
  scoreMission,
} from "./missionConsequenceRules.ts";
import {
  PROGRESSION_BALANCE_VERSION,
  PROGRESSION_CONTENT_VERSION,
  PROGRESSION_RULESET_VERSION,
  convertRunReward,
  type ProgressionMaterialStack,
} from "./progressionRules.ts";
import { buildEpochResultPagePayload } from "./resultPagePayloadRules.ts";
import type {
  EpochExplorationMetrics,
  EpochExplorationRun,
  EpochResultPagePayload,
  EpochSharedResultPage,
} from "./runtime.ts";
import type { EpochRuntimeResult } from "./runtimePublicProjectionRules.ts";

type AnyRecord = Readonly<Record<string, unknown>>;
type ExplorationIntensity = EpochExplorationMetrics["intensity"];
type ExplorationMemoryDelta = EpochExplorationMetrics["memoryDelta"];
type NumericRecord = Readonly<Partial<Record<string, number>>>;

type ExplorationScoreBreakdown = Readonly<{
  objectiveCompletion: number;
  evidenceQuality: number;
  riskHandling: number;
  efficiencySurvival: number;
  resourceConservation: number;
  causalConsequences: number;
  combatReadinessFit: number;
  combatReadinessMaxContribution: number;
  antiFarmDecay: number;
  rawScore: number;
  finalScore: number;
  grade: string;
  explanation: readonly string[];
}>;

type ExplorationProgressionReward = Readonly<{
  rulesetVersion: typeof PROGRESSION_RULESET_VERSION;
  balanceVersion: typeof PROGRESSION_BALANCE_VERSION;
  contentVersion: typeof PROGRESSION_CONTENT_VERSION;
  source: string;
  sourceEventIds: readonly string[];
  evidence: {
    readonly confirmedClaimValue: number;
    readonly unconfirmedClaimValue: number;
    readonly practiceEvidenceXp: number;
    readonly insightEvidence: number;
    readonly repeatIndex: number;
  };
  rewards: {
    readonly functional_xp: number;
    readonly insight_points: number;
    readonly materials: readonly ProgressionMaterialStack[];
  };
  effects: readonly unknown[];
}>;

type ExplorationMetricsWithBreakdown = EpochExplorationMetrics & Readonly<{
  intensityBreakdown: ReturnType<typeof calculateMissionIntensity>;
  scoreBreakdown: ExplorationScoreBreakdown;
  progressionReward: ExplorationProgressionReward;
}>;

export interface ExplorationRuntime {
  readonly runExploration: (input?: AnyRecord) => EpochRuntimeResult<EpochExplorationRun>;
}

export interface ExplorationRuntimeOptions {
  readonly assertPublicTextSafe: (input: AnyRecord, value: unknown) => void;
  readonly idempotently: <TValue>(
    scope: string,
    input: AnyRecord,
    explorerId: string,
    run: () => EpochRuntimeResult<TValue>,
  ) => EpochRuntimeResult<TValue>;
  readonly requireIdentity: (agentId: string) => EpochAgentIdentity;
  readonly project: () => EpochProjection;
  readonly publicProjection: () => EpochProjection;
  readonly now: () => string;
  readonly maxDowntimeSeconds?: number;
  readonly ownerVerifiedContext: (input: AnyRecord, explorerId: string) => EpochCommandContext;
  readonly startHostedSession: (
    input: StartHostedSessionInput,
    context: EpochCommandContext,
  ) => EpochRuntimeResult<EpochHostedSession>;
  readonly submitHostedAction: (
    input: SubmitHostedActionInput,
    context: EpochCommandContext,
  ) => EpochRuntimeResult<EpochHostedActionRecord>;
  readonly grantAttributeProgression?: (
    input: {
      readonly agentId: string;
      readonly attributeId: EpochAttributeId;
      readonly amount: number;
      readonly reason: string;
      readonly sourceEventIds: readonly string[];
    },
    context: EpochCommandContext,
  ) => EpochRuntimeResult<unknown>;
  readonly createResultPageFromPayload: (
    input: AnyRecord,
    payload: EpochResultPagePayload,
  ) => { readonly page: EpochSharedResultPage };
  readonly memorySnapshot?: (
    projection: EpochProjection,
    input: {
      readonly agentId: string;
      readonly explorerId: string;
      readonly regionId: string;
    },
  ) => ExplorationMemoryDelta;
}

export function explorationStepCount(input: AnyRecord) {
  const value = Number(input.stepCount ?? 8);
  if (!Number.isFinite(value)) return 8;
  return Math.max(8, Math.min(Math.floor(value), 12));
}

export function explorationMandate(input: AnyRecord) {
  const mandate = typeof input.mandate === "string" && input.mandate.trim()
    ? input.mandate.trim()
    : "一次完整探索";
  return mandate.slice(0, 160);
}

function boundedWhole(value: unknown) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return 0;
  return Math.max(0, Math.floor(numericValue));
}

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function numericDelta(before: NumericRecord, after: NumericRecord): Record<string, number> {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const delta: Record<string, number> = {};
  for (const key of [...keys].sort()) {
    const change = (after[key] ?? 0) - (before[key] ?? 0);
    if (change !== 0) delta[key] = change;
  }
  return delta;
}

function memoryDelta(before: ExplorationMemoryDelta, after: ExplorationMemoryDelta): ExplorationMemoryDelta {
  return {
    confirmed: after.confirmed - before.confirmed,
    rumor: after.rumor - before.rumor,
    private: after.private - before.private,
  };
}

function optionalMemorySnapshot(
  options: ExplorationRuntimeOptions,
  projection: EpochProjection,
  input: {
    readonly agentId: string;
    readonly explorerId: string;
    readonly regionId: string;
  },
): ExplorationMemoryDelta {
  return options.memorySnapshot?.(projection, input) ?? { confirmed: 0, rumor: 0, private: 0 };
}

function actionMemoryDelta(actions: readonly EpochHostedActionRecord[]): ExplorationMemoryDelta {
  return actions.reduce<ExplorationMemoryDelta>((total, action) => {
    if (action.channelClass === "browser_copy_paste") {
      return { ...total, private: total.private + 1 };
    }
    if (action.channelClass === "server_hosted") {
      return { ...total, confirmed: total.confirmed + 1 };
    }
    return total;
  }, { confirmed: 0, rumor: 0, private: 0 });
}

function agentInventoryItems(projection: EpochProjection, agentId: string, explorerId: string): readonly EpochInventoryItem[] {
  const itemIds = [
    ...(projection.inventoryItemIdsByAgent[agentId] ?? []),
    ...(projection.inventoryItemIdsByExplorer[explorerId] ?? []),
  ];
  const seen = new Set<string>();
  return itemIds
    .filter((itemId) => {
      if (seen.has(itemId)) return false;
      seen.add(itemId);
      return true;
    })
    .map((itemId) => projection.inventoryItems[itemId])
    .filter((item): item is EpochInventoryItem => Boolean(item));
}

export function explorationCombatPower(
  projection: EpochProjection,
  identity: EpochAgentIdentity,
) {
  const resources = projection.resourceBalances[identity.agentId] ?? {};
  const attributes = projection.attributeScores[identity.agentId] ?? {};
  const inventoryItems = agentInventoryItems(projection, identity.agentId, identity.explorerId);
  const equipment = inventoryEquipmentBonus(inventoryItems);
  const rarityPower = inventoryItems.reduce((total, item) => {
    const rarity = String(item.rarity || "common").toLowerCase();
    const value = rarity === "legendary" ? 13
      : rarity === "epic" ? 11
      : rarity === "rare" ? 8
      : rarity === "uncommon" ? 5
      : 2;
    return total + value + (item.bound ? 1 : 0);
  }, 0);
  const attributePower = Math.min(45, Object.values(attributes)
    .reduce((total, value) => total + boundedWhole(value) * 3, 0));
  const resourcePower = Math.min(28,
    boundedWhole(resources.stamina) * 1.4
      + boundedWhole(resources.focus) * 1.3
      + boundedWhole(resources.aether) * 1.8
      + boundedWhole(resources.legend) * 5
      + Math.min(10, boundedWhole(resources.coin) * 0.25));
  const inventoryPower = Math.min(27, rarityPower + equipment.equipmentScoreBonus * 4);
  const lifetimePower = Math.min(8, Math.max(0, boundedWhole(identity.lifetime?.remaining) - 4) * 0.5);
  return Math.round(10 + attributePower + resourcePower + inventoryPower + lifetimePower);
}

function targetIntensity(input: {
  readonly combatPower: number;
  readonly explorerId: string;
  readonly agentId: string;
  readonly regionId: string;
  readonly mandate: string;
  readonly index: number;
  readonly completedSessionCount: number;
}): ExplorationIntensity {
  if (input.combatPower < 18) return "low";
  const seed = stableHash([
    input.explorerId,
    input.agentId,
    input.regionId,
    input.mandate,
    input.index,
    input.completedSessionCount,
  ].join(":"));
  const intensity = explorationMissionIntensity({
    combatPower: input.combatPower,
    mandate: input.mandate,
    regionId: input.regionId,
    completedSessionCount: input.completedSessionCount,
    seed,
  });
  if (intensity.band === "extreme") return "high";
  return intensity.band;
}

function chooseExplorationOption(
  session: EpochHostedSession,
  input: {
    readonly combatPower: number;
    readonly explorerId: string;
    readonly agentId: string;
    readonly regionId: string;
    readonly mandate: string;
    readonly index: number;
    readonly completedSessionCount: number;
  },
) {
  const desiredRisk = targetIntensity(input);
  const byRisk = session.actionOptions.filter((option) => option.risk === desiredRisk);
  const fallbackRisks: readonly ExplorationIntensity[] = desiredRisk === "high"
    ? ["medium", "low"]
    : desiredRisk === "medium" ? ["low", "high"] : ["medium", "high"];
  const candidateOptions = byRisk.length
    ? byRisk
    : fallbackRisks.flatMap((risk) => session.actionOptions.filter((option) => option.risk === risk));
  const pool = candidateOptions.length ? candidateOptions : session.actionOptions;
  if (!pool.length) return undefined;
  const offset = stableHash(`${input.explorerId}:${input.regionId}:${input.index}:${input.combatPower}`);
  return pool[offset % pool.length];
}

function runIntensity(breakdown: EpochExplorationMetrics["riskBreakdown"]): ExplorationIntensity {
  if (breakdown.high > 0) return "high";
  if (breakdown.medium > 0) return "medium";
  return "low";
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function explorationMissionIntensity(input: {
  readonly combatPower: number;
  readonly mandate: string;
  readonly regionId: string;
  readonly completedSessionCount: number;
  readonly seed: number;
}) {
  const seedA = input.seed % 100;
  const seedB = Math.floor(input.seed / 101) % 100;
  const seedC = Math.floor(input.seed / 10_007) % 100;
  const lowRiskRepeatPressure = Math.min(30, input.completedSessionCount * 2);
  const objectiveComplexity = clampPercent(28 + input.mandate.length * 0.35 + seedA * 0.18);
  const environmentalHazard = clampPercent(18 + seedB * 0.32 + (input.regionId.includes("rift") ? 16 : 0));
  const enemyHostilePower = clampPercent(16 + objectiveComplexity * 0.42 + environmentalHazard * 0.28 + seedC * 0.2);
  const resourcePressure = clampPercent(20 + lowRiskRepeatPressure + seedB * 0.12);
  const worldPressure = clampPercent(22 + environmentalHazard * 0.35 + objectiveComplexity * 0.25 + lowRiskRepeatPressure);
  return calculateMissionIntensity({
    enemyHostilePower,
    enemyCoordination: clampPercent(35 + seedC * 0.4),
    environmentalHazard,
    objectiveComplexity,
    informationUncertainty: clampPercent(25 + seedA * 0.25),
    logisticalBurden: resourcePressure,
    legalPoliticalRisk: clampPercent(10 + seedB * 0.18),
    irreversibility: clampPercent(12 + objectiveComplexity * 0.45),
    resourcePressure,
    worldPressure,
    playerCombatPower: input.combatPower,
  });
}

function explorationRating(input: {
  readonly stepCount: number;
  readonly actions: readonly EpochHostedActionRecord[];
  readonly riskBreakdown: EpochExplorationMetrics["riskBreakdown"];
  readonly resourceDelta: Record<string, number>;
  readonly memoryDelta: ExplorationMemoryDelta;
  readonly intensityBreakdown: ReturnType<typeof calculateMissionIntensity>;
  readonly repeatedRunCount: number;
}): ExplorationScoreBreakdown {
  const completedRatio = input.stepCount > 0 ? input.actions.length / input.stepCount : 0;
  const objectiveCompletionBps = clampPercent(completedRatio * 100) * 100;
  const nonEvidenceCount = input.actions.filter((action) => action.nonEvidence).length;
  const serverEvidenceCount = input.actions.filter((action) => action.channelClass === "server_hosted" && !action.nonEvidence).length;
  const evidenceQualityBps = clampPercent((serverEvidenceCount / Math.max(1, input.actions.length)) * 100) * 100;
  const meaningfulRiskBps = clampPercent(
    (input.riskBreakdown.medium * 48 + input.riskBreakdown.high * 86 + input.riskBreakdown.low * 18) / Math.max(1, input.stepCount),
  ) * 100;
  const riskExposureBps = clampPercent(
    (input.riskBreakdown.medium * 45 + input.riskBreakdown.high * 85 + input.riskBreakdown.low * 16) / Math.max(1, input.stepCount),
  ) * 100;
  const resourceLoss = Object.values(input.resourceDelta).reduce((total, value) => total + Math.max(0, -value), 0);
  const resourceEfficiencyBps = clampPercent(100 - resourceLoss * 5 - nonEvidenceCount * 6) * 100;
  const survivalBps = input.actions.length === input.stepCount
    ? 10_000
    : clampPercent(completedRatio * 85) * 100;
  const causalImpactBps = clampPercent(
    input.memoryDelta.confirmed * 9
      + input.memoryDelta.rumor * 5
      + input.memoryDelta.private * 3
      + input.intensityBreakdown.worldPressure * 0.35,
  ) * 100;
  const sideEffectControlBps = clampPercent(100 - resourceLoss * 4 - nonEvidenceCount * 8) * 100;
  const combatFitBps = clampPercent(
    100 - Math.min(70, Math.abs(input.intensityBreakdown.playerCombatRatio - 1) * 28),
  ) * 100;
  const score = scoreMission({
    objectiveCompletionBps,
    pressureReliefBps: causalImpactBps,
    sideEffectControlBps,
    executionQualityBps: evidenceQualityBps,
    riskExposureBps,
    meaningfulRiskBps,
    resourceEfficiencyBps,
    survivalBps,
    integrityBps: evidenceQualityBps,
    recentSimilarCompletionCount: input.repeatedRunCount,
    repeatedResolutionFamilyCount: runIntensity(input.riskBreakdown) === "low" ? input.repeatedRunCount : 0,
  });
  return {
    objectiveCompletion: score.objective,
    evidenceQuality: score.integrity,
    riskHandling: score.risk,
    efficiencySurvival: Math.round(score.efficiency * 0.56 + score.survival * 0.44),
    resourceConservation: score.efficiency,
    causalConsequences: score.causalImpact,
    combatReadinessFit: clampPercent(combatFitBps / 100),
    combatReadinessMaxContribution: 0,
    antiFarmDecay: score.antiFarmDecay,
    rawScore: score.rawScore,
    finalScore: score.finalScore,
    grade: score.grade,
    explanation: score.explanation,
  };
}

function progressionMaterialsForIntensity(intensity: ExplorationIntensity): readonly ProgressionMaterialStack[] {
  if (intensity === "high") {
    return [
      { materialId: "cultivation_catalyst", quantity: 3 },
      { materialId: "skill_primer", quantity: 2 },
    ];
  }
  if (intensity === "medium") {
    return [
      { materialId: "cultivation_stabilizer", quantity: 2 },
      { materialId: "skill_primer", quantity: 1 },
    ];
  }
  return [
    { materialId: "cultivation_primary", quantity: 1 },
    { materialId: "skill_thread", quantity: 1 },
  ];
}

function progressionRewardForExploration(input: {
  readonly agentId: string;
  readonly regionId: string;
  readonly mandate: string;
  readonly intensity: ExplorationIntensity;
  readonly stepCount: number;
  readonly actionEventIds: readonly string[];
  readonly scoreBreakdown: ExplorationScoreBreakdown;
  readonly memoryDelta: ExplorationMemoryDelta;
  readonly repeatedRunCount: number;
}): ExplorationProgressionReward {
  const decayMultiplier = 1 - Math.min(0.45, input.repeatedRunCount * 0.12);
  const confirmedClaimValue = Math.max(1, Math.round(input.scoreBreakdown.objectiveCompletion * decayMultiplier / 10));
  const unconfirmedClaimValue = Math.max(0, Math.round((input.memoryDelta.rumor + input.memoryDelta.private) * decayMultiplier));
  const practiceEvidenceXp = Math.max(1, Math.round((input.stepCount + input.scoreBreakdown.riskHandling / 12) * decayMultiplier));
  const insightEvidence = Math.max(1, Math.round((input.memoryDelta.confirmed + (input.intensity === "high" ? 4 : input.intensity === "medium" ? 2 : 1)) * decayMultiplier));
  const materials = progressionMaterialsForIntensity(input.intensity).map((material) => ({
    ...material,
    quantity: Math.max(1, Math.round(material.quantity * decayMultiplier)),
  }));
  const source = `exploration:${input.regionId}:${stableHash(`${input.agentId}:${input.regionId}:${input.mandate}`)}`;
  const proposal = convertRunReward({
    identityId: input.agentId,
    outcome: "full_completion",
    rewardSourceRef: source,
    confirmedClaimValue,
    unconfirmedClaimValue,
    practiceEvidenceXp,
    insightEvidence,
    materials,
    sourceEventIds: input.actionEventIds,
  });
  const rewardByKey = new Map(proposal.effects.map((effect) => {
    const record = effect as {
      readonly after?: {
        readonly resourceKey?: string;
        readonly entries?: readonly { readonly quantityMinor?: string }[];
      };
    };
    return [record.after?.resourceKey, Number(record.after?.entries?.[0]?.quantityMinor ?? 0)];
  }));
  return {
    rulesetVersion: PROGRESSION_RULESET_VERSION,
    balanceVersion: PROGRESSION_BALANCE_VERSION,
    contentVersion: PROGRESSION_CONTENT_VERSION,
    source,
    sourceEventIds: input.actionEventIds,
    evidence: {
      confirmedClaimValue,
      unconfirmedClaimValue,
      practiceEvidenceXp,
      insightEvidence,
      repeatIndex: input.repeatedRunCount,
    },
    rewards: {
      functional_xp: rewardByKey.get("functional_xp") ?? 0,
      insight_points: rewardByKey.get("insight_points") ?? 0,
      materials: materials.map((material) => ({
        materialId: material.materialId,
        quantity: rewardByKey.get(`material.${material.materialId}`) ?? material.quantity,
      })),
    },
    effects: proposal.effects,
  };
}

export function createExplorationRuntime(options: ExplorationRuntimeOptions): ExplorationRuntime {
  function runExploration(input: AnyRecord = {}): EpochRuntimeResult<EpochExplorationRun> {
    const agentId = assertNonEmptyString(input.agentId, "agent_id");
    const identity = options.requireIdentity(agentId);
    const regionId = resolveEpochCanonicalRegionId(assertNonEmptyString(input.regionId, "region_id"));
    const stepCount = explorationStepCount(input);
    const mandate = explorationMandate(input);
    options.assertPublicTextSafe(input, mandate);
    return options.idempotently("run_exploration", input, identity.explorerId, () => {
      const beforeProjection = options.publicProjection();
      const beforeResources = beforeProjection.resourceBalances[identity.agentId] ?? {};
      const beforeAttributes = beforeProjection.attributeScores[identity.agentId] ?? {};
      const beforeMemory = optionalMemorySnapshot(options, beforeProjection, { agentId, explorerId: identity.explorerId, regionId });
      const combatPower = explorationCombatPower(beforeProjection, identity);
      const priorCompletedSessionCount = Object.values(beforeProjection.hostedSessions)
        .filter((session) => session.agentId === agentId && session.regionId === regionId && session.status === "completed")
        .length;
      const repeatedRunCount = Math.floor(priorCompletedSessionCount / stepCount);
      const events: EpochEvent[] = [];
      const sessions: EpochHostedSession[] = [];
      const actions: EpochHostedActionRecord[] = [];
      const actionEventIds: string[] = [];
      const riskBreakdown = { low: 0, medium: 0, high: 0 };
      const baseIdempotencyKey = String(input.idempotencyKey).trim();
      for (let index = 0; index < stepCount; index += 1) {
        const contextInput = {
          ...input,
          idempotencyKey: `${baseIdempotencyKey}:step:${index + 1}`,
        };
        const sessionResult = options.startHostedSession({
          agentId,
          regionId,
          mandate: `${mandate} · 第 ${index + 1} 段`,
        }, options.ownerVerifiedContext(contextInput, identity.explorerId));
        events.push(...sessionResult.events);
        const option = chooseExplorationOption(sessionResult.value, {
          combatPower,
          explorerId: identity.explorerId,
          agentId,
          regionId,
          mandate,
          index,
          completedSessionCount: priorCompletedSessionCount + sessions.length,
        });
        if (!option) throw new Error("hosted_action_option_not_found");
        riskBreakdown[option.risk] += 1;
        const actionResult = options.submitHostedAction({
          sessionId: sessionResult.value.sessionId,
          actionOptionId: option.actionOptionId,
          visibleText: `第 ${index + 1} 段探索：${option.label}。`,
        }, options.ownerVerifiedContext(contextInput, identity.explorerId));
        events.push(...actionResult.events);
        actionEventIds.push(...actionResult.events.map((event) => event.eventId));
        const completedSession = actionResult.projection.hostedSessions[sessionResult.value.sessionId];
        if (!completedSession) throw new Error("hosted_session_not_found");
        sessions.push(completedSession);
        actions.push(actionResult.value);
      }
      const intensity = runIntensity(riskBreakdown);
      const afterProjection = options.publicProjection();
      const resourceDelta = numericDelta(beforeResources, afterProjection.resourceBalances[identity.agentId] ?? {});
      const attributeDelta = numericDelta(beforeAttributes, afterProjection.attributeScores[identity.agentId] ?? {});
      const memoryChange = options.memorySnapshot
        ? memoryDelta(beforeMemory, optionalMemorySnapshot(options, afterProjection, {
            agentId,
            explorerId: identity.explorerId,
            regionId,
          }))
        : actionMemoryDelta(actions);
      const intensityBreakdown = explorationMissionIntensity({
        combatPower,
        mandate,
        regionId,
        completedSessionCount: priorCompletedSessionCount,
        seed: stableHash(`${identity.explorerId}:${agentId}:${regionId}:${mandate}:${intensity}`),
      });
      const scoreBreakdown = explorationRating({
        stepCount,
        actions,
        riskBreakdown,
        resourceDelta,
        memoryDelta: memoryChange,
        intensityBreakdown,
        repeatedRunCount,
      });
      const progressionReward = progressionRewardForExploration({
        agentId,
        regionId,
        mandate,
        intensity,
        stepCount,
        actionEventIds,
        scoreBreakdown,
        memoryDelta: memoryChange,
        repeatedRunCount,
      });
      const pageInput = {
        ...input,
        agentId,
        explorerId: identity.explorerId,
        regionId,
        limit: Math.max(30, stepCount * 6),
        focusEventIds: events.map((event) => event.eventId),
        idempotencyKey: `${baseIdempotencyKey}:result`,
      };
      const resultPayload = buildEpochResultPagePayload({
        projection: options.project(),
        input: pageInput,
        generatedAt: options.now(),
        maxDowntimeSeconds: options.maxDowntimeSeconds,
      });
      const resultPage = options.createResultPageFromPayload(pageInput, resultPayload).page;
      const finalProjection = options.publicProjection();
      const metrics: ExplorationMetricsWithBreakdown = {
        combatPower,
        rating: scoreBreakdown.finalScore,
        intensity,
        riskBreakdown,
        resourceDelta,
        attributeDelta,
        memoryDelta: memoryChange,
        intensityBreakdown,
        scoreBreakdown,
        progressionReward,
      };
      return {
        events,
        value: {
          agentId,
          explorerId: identity.explorerId,
          regionId,
          mandate,
          stepCount,
          sessions,
          actions,
          resultPage,
          metrics,
        },
        projection: finalProjection,
      };
    });
  }

  return {
    runExploration,
  };
}
