import { createHash } from "node:crypto";

import {
  runtimeActionKeyId,
  signRuntimeActionPayload,
} from "../runtimeActionSigning.ts";
import type { EpochAttributeId } from "./protocol.ts";
import { stableSignedEnvelopeJson } from "./turnActionEnvelopeRules.ts";

export const JOURNEY_ACTION_RESOLUTION_RULE_VERSION = "journey-action-resolution.v5";

export type JourneyActionRisk = "low" | "medium" | "high";

export interface JourneyActionRiskTerms {
  readonly resourceCost?: {
    readonly resourceId: "focus" | "stamina";
    readonly amount: 1;
  };
  readonly successReward?: {
    readonly resourceId: "coin";
    readonly amount: number;
  };
  readonly exceptionalSuccessReward?: {
    readonly resourceId: "coin";
    readonly amount: number;
  };
}

/** Granted once per identity when it enters its first Agent-native Journey. */
export const JOURNEY_FIRST_ENTRY_RESERVE = Object.freeze([
  Object.freeze({ resourceId: "focus" as const, amount: 2 }),
  Object.freeze({ resourceId: "stamina" as const, amount: 1 }),
]);

const RISK_TERMS: Readonly<Record<JourneyActionRisk, JourneyActionRiskTerms>> = Object.freeze({
  low: Object.freeze({}),
  medium: Object.freeze({
    resourceCost: Object.freeze({ resourceId: "focus", amount: 1 }),
    successReward: Object.freeze({ resourceId: "coin", amount: 1 }),
    exceptionalSuccessReward: Object.freeze({ resourceId: "coin", amount: 1 }),
  }),
  high: Object.freeze({
    resourceCost: Object.freeze({ resourceId: "stamina", amount: 1 }),
    successReward: Object.freeze({ resourceId: "coin", amount: 2 }),
    exceptionalSuccessReward: Object.freeze({ resourceId: "coin", amount: 3 }),
  }),
});

export function journeyActionRiskTerms(risk: JourneyActionRisk): JourneyActionRiskTerms {
  return RISK_TERMS[risk];
}

export function journeyRiskPremiumForOutcome(
  risk: JourneyActionRisk,
  outcome: JourneyActionResolutionOutcome,
): JourneyActionRiskTerms["successReward"] {
  const terms = journeyActionRiskTerms(risk);
  if (outcome === "exceptional_success") return terms.exceptionalSuccessReward;
  if (outcome === "success") return terms.successReward;
  return undefined;
}

export type JourneyActionCompletionKind = "complete" | "failed" | "skip";
export type JourneyActionResolutionOutcome =
  | "exceptional_success"
  | "success"
  | "partial_success"
  | "failure"
  | "skipped";

export interface JourneyActionResolutionFactors {
  readonly baseCompetence: number;
  readonly identity: number;
  readonly attributes: number;
  readonly resources: number;
  readonly equipment: number;
  readonly sceneSupport: number;
  readonly journeyPreparation: number;
  readonly condition: number;
  readonly goalAlignment: number;
  readonly deterministicVariance: number;
}

export interface JourneyActionResolution {
  readonly ruleVersion: typeof JOURNEY_ACTION_RESOLUTION_RULE_VERSION;
  readonly authority: "server";
  readonly decisionKeyId: string;
  readonly inputHash: `sha256:${string}`;
  readonly outcome: JourneyActionResolutionOutcome;
  readonly completionKind: JourneyActionCompletionKind;
  readonly score: number;
  readonly difficulty: number;
  readonly margin: number;
  readonly factors: JourneyActionResolutionFactors;
  readonly gatingFailure?: "required_resource_missing";
  readonly resourceCost?: {
    readonly resourceId: "focus" | "stamina";
    readonly amount: 1;
    /** False means the attempt had no required resource available to consume. */
    readonly paid: boolean;
  };
  readonly riskPremium?: {
    readonly resourceId: "coin";
    readonly amount: number;
  };
  readonly summary: string;
}

export interface ResolveJourneyActionInput {
  readonly agentId: string;
  readonly journeyId: string;
  readonly episodeId: string;
  readonly actionOptionId: string;
  readonly actionLabel: string;
  readonly objectiveTitle: string;
  readonly locationLabel: string;
  readonly successOutcomeSummary: string;
  readonly risk: JourneyActionRisk;
  readonly objectiveKind?: "main" | "side" | "choice";
  readonly journeyPreparationScore?: number;
  readonly signedCompletionKind?: "skip";
  readonly identity: {
    readonly lifetime: {
      readonly max: number;
    readonly remaining: number;
    };
    readonly traits: readonly string[];
    readonly needs?: {
      readonly levels?: Readonly<Record<string, number>>;
    };
    readonly lifeGoal?: {
      readonly category?: string;
      readonly description?: string;
      readonly motivation?: string;
    };
  };
  readonly resources: {
    readonly focus?: number;
    readonly stamina?: number;
    readonly aether?: number;
  };
  readonly attributes?: Partial<Record<EpochAttributeId, number>>;
  readonly inventoryItems: readonly {
    readonly itemId: string;
    readonly rarity: string;
    readonly bound: boolean;
  }[];
  readonly participantTargetCount: number;
}

const BASE_COMPETENCE = 32;
const DIFFICULTY_BY_RISK = { low: 40, medium: 53, high: 68 } as const;
const RARITY_READINESS: Readonly<Record<string, number>> = {
  common: 1,
  uncommon: 2,
  rare: 4,
  epic: 6,
  legendary: 8,
};

function nonNegative(value: number) {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function cappedWhole(value: number | undefined, cap: number) {
  return Math.min(cap, Math.floor(nonNegative(value ?? 0)));
}

function normalizedText(value: string, fallback: string) {
  return value.trim() || fallback;
}

function normalizedNeeds(
  needs: ResolveJourneyActionInput["identity"]["needs"],
): Readonly<Record<string, number>> {
  const entries = Object.entries(needs?.levels ?? {})
    .filter((entry): entry is [string, number] => typeof entry[1] === "number" && Number.isFinite(entry[1]))
    .map(([key, value]): [string, number] => [key, Math.max(0, Math.min(10_000, Math.round(value)))])
    .sort((left, right) => left[0].localeCompare(right[0]));
  return Object.fromEntries(entries);
}

function resolutionInput(input: ResolveJourneyActionInput) {
  return {
    actionOptionId: normalizedText(input.actionOptionId, "unknown_action"),
    agentId: normalizedText(input.agentId, "unknown_agent"),
    episodeId: normalizedText(input.episodeId, "unknown_episode"),
    inventoryItems: input.inventoryItems
      .map((item) => ({
        bound: item.bound,
        itemId: normalizedText(item.itemId, "unknown_item"),
        rarity: normalizedText(item.rarity, "common").toLocaleLowerCase("en-US"),
      }))
      .sort((left, right) => left.itemId.localeCompare(right.itemId)),
    journeyId: normalizedText(input.journeyId, "unknown_journey"),
    lifetime: {
      max: nonNegative(input.identity.lifetime.max),
      remaining: nonNegative(input.identity.lifetime.remaining),
    },
    lifeGoal: {
      category: normalizedText(input.identity.lifeGoal?.category ?? "", ""),
      description: normalizedText(input.identity.lifeGoal?.description ?? "", ""),
      motivation: normalizedText(input.identity.lifeGoal?.motivation ?? "", ""),
    },
    needs: normalizedNeeds(input.identity.needs),
    objectiveText: normalizedText(input.actionLabel, "该行动"),
    objectiveKind: input.objectiveKind ?? "main",
    journeyPreparationScore: cappedWhole(input.journeyPreparationScore, 16),
    participantTargetCount: cappedWhole(input.participantTargetCount, 8),
    resources: {
      aether: nonNegative(input.resources.aether ?? 0),
      focus: nonNegative(input.resources.focus ?? 0),
      stamina: nonNegative(input.resources.stamina ?? 0),
    },
    attributes: Object.fromEntries(Object.entries(input.attributes ?? {})
      .filter((entry): entry is [EpochAttributeId, number] =>
        typeof entry[1] === "number" && Number.isFinite(entry[1]))
      .sort((left, right) => left[0].localeCompare(right[0]))
      .map(([key, value]) => [key, Math.max(0, Math.min(10_000, Math.round(value)))])
    ) as Partial<Record<EpochAttributeId, number>>,
    risk: input.risk,
    signedCompletionKind: input.signedCompletionKind,
    traits: [...new Set(input.identity.traits.map((trait) => trait.trim()).filter(Boolean))].sort(),
  };
}

function deterministicVariance(canonicalInput: ReturnType<typeof resolutionInput>) {
  const payload = Buffer.from(stableSignedEnvelopeJson({
    ruleVersion: JOURNEY_ACTION_RESOLUTION_RULE_VERSION,
    input: canonicalInput,
  }), "utf8");
  const proof = signRuntimeActionPayload(payload);
  return (createHash("sha256").update(proof).digest().readUInt16BE(0) % 17) - 8;
}

const GOAL_SIGNALS: Readonly<Record<string, RegExp>> = {
  work: /工作|职责|事务|委托|修复|生产|work|job|duty/iu,
  learning: /学习|研究|实验|记录|分析|核验|校准|study|learn|research|experiment/iu,
  love: /伴侣|爱|亲密|照顾|团聚|love|partner|intimacy/iu,
  revenge: /复仇|旧怨|仇敌|追踪|清算|revenge|enemy|rival/iu,
  wealth: /报酬|赚钱|货物|贸易|悬赏|财富|coin|wealth|trade|bounty/iu,
  service: /协助|保护|救援|治疗|照料|护送|service|assist|rescue|care/iu,
  exploration: /探索|调查|追查|勘察|测绘|未知|explore|discover|survey/iu,
  mastery: /技艺|训练|试炼|制作|修炼|精通|mastery|craft|trial|train/iu,
};

function identityCondition(canonicalInput: ReturnType<typeof resolutionInput>): number {
  const physiologicalKeys = new Set(["hunger", "thirst", "fatigue", "elimination", "safety"]);
  const pressure = Object.entries(canonicalInput.needs)
    .filter(([key]) => physiologicalKeys.has(key))
    .reduce((highest, [, value]) => Math.max(highest, value), 0);
  if (pressure >= 9_000) return -12;
  if (pressure >= 7_500) return -8;
  if (pressure >= 6_000) return -4;
  return 0;
}

function lifeGoalAlignment(canonicalInput: ReturnType<typeof resolutionInput>): number {
  const category = canonicalInput.lifeGoal.category.toLocaleLowerCase("en-US");
  if (!category) return 0;
  const signal = GOAL_SIGNALS[category];
  if (!signal) return 0;
  return signal.test(canonicalInput.objectiveText) ? 6 : 0;
}

function actionSummary(
  input: ResolveJourneyActionInput,
  outcome: JourneyActionResolutionOutcome,
  gatingFailure?: JourneyActionResolution["gatingFailure"],
) {
  const success = normalizedText(input.successOutcomeSummary, "该行动完成，并留下了可核验结果。");
  if (outcome === "skipped" || outcome === "success" || outcome === "exceptional_success") return success;
  const action = normalizedText(input.actionLabel, "执行该行动");
  const objective = normalizedText(input.objectiveTitle, "该目标");
  const location = normalizedText(input.locationLabel, "现场");
  if (gatingFailure === "required_resource_missing") {
    const resourceName = input.risk === "high" ? "体力" : "专注";
    const riskName = input.risk === "high" ? "高" : "中";
    return `身份在${location}准备“${action}”，但可用${resourceName}不足，无法承担这次${riskName}风险行动；身份没有越过现场安全边界，“${objective}”未完成。`;
  }
  if (outcome === "partial_success") {
    return `身份在${location}尝试“${action}”；虽然完成了前置步骤，但关键条件没有全部达成，只能收束行动，“${objective}”未完成。`;
  }
  return `身份在${location}开始“${action}”，但准备与现场条件不足以支撑这次行动；为避免扩大后果，身份中止操作，“${objective}”未完成。`;
}

export function resolveJourneyAction(input: ResolveJourneyActionInput): JourneyActionResolution {
  const canonicalInput = resolutionInput(input);
  const inputHash = `sha256:${createHash("sha256")
    .update(stableSignedEnvelopeJson(canonicalInput))
    .digest("hex")}` as const;
  const zeroFactors: JourneyActionResolutionFactors = {
    baseCompetence: 0,
    identity: 0,
    attributes: 0,
    resources: 0,
    equipment: 0,
    sceneSupport: 0,
    journeyPreparation: 0,
    condition: 0,
    goalAlignment: 0,
    deterministicVariance: 0,
  };
  if (input.signedCompletionKind === "skip") {
    return {
      ruleVersion: JOURNEY_ACTION_RESOLUTION_RULE_VERSION,
      authority: "server",
      decisionKeyId: runtimeActionKeyId(),
      inputHash,
      outcome: "skipped",
      completionKind: "skip",
      score: 0,
      difficulty: 0,
      margin: 0,
      factors: zeroFactors,
      summary: actionSummary(input, "skipped"),
    };
  }
  if (canonicalInput.objectiveKind === "choice") {
    return {
      ruleVersion: JOURNEY_ACTION_RESOLUTION_RULE_VERSION,
      authority: "server",
      decisionKeyId: runtimeActionKeyId(),
      inputHash,
      outcome: "success",
      completionKind: "complete",
      score: 0,
      difficulty: 0,
      margin: 0,
      factors: zeroFactors,
      summary: actionSummary(input, "success"),
    };
  }

  const lifetimeMax = canonicalInput.lifetime.max;
  const lifetimeRatio = lifetimeMax > 0
    ? Math.min(1, canonicalInput.lifetime.remaining / lifetimeMax)
    : 0;
  const identity = Math.round(lifetimeRatio * 6) + Math.min(6, canonicalInput.traits.length * 2);
  const attributes = Math.min(12, Object.values(canonicalInput.attributes)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value))
    .sort((left, right) => right - left)
    .slice(0, 3)
    .reduce((total, value) => total + Math.floor(value), 0));
  const resources = cappedWhole(canonicalInput.resources.focus, 4)
    + cappedWhole(canonicalInput.resources.stamina, 4)
    + cappedWhole(canonicalInput.resources.aether, 4);
  const equipment = Math.min(12, canonicalInput.inventoryItems
    .map((item) => (RARITY_READINESS[item.rarity] ?? 1) + (item.bound ? 1 : 0))
    .sort((left, right) => right - left)
    .slice(0, 2)
    .reduce((total, value) => total + value, 0));
  const sceneSupport = Math.min(10, canonicalInput.participantTargetCount * 5);
  const journeyPreparation = canonicalInput.journeyPreparationScore;
  const condition = identityCondition(canonicalInput);
  const goalAlignment = lifeGoalAlignment(canonicalInput);
  const deterministicRoll = deterministicVariance(canonicalInput);
  const factors: JourneyActionResolutionFactors = {
    baseCompetence: BASE_COMPETENCE,
    identity,
    attributes,
    resources,
    equipment,
    sceneSupport,
    journeyPreparation,
    condition,
    goalAlignment,
    deterministicVariance: deterministicRoll,
  };
  const score = Object.values(factors).reduce((total, value) => total + value, 0);
  const difficulty = DIFFICULTY_BY_RISK[input.risk];
  const margin = score - difficulty;
  const riskTerms = journeyActionRiskTerms(input.risk);
  const requiredCost = riskTerms.resourceCost;
  const resourceCost = requiredCost ? {
    ...requiredCost,
    paid: nonNegative(canonicalInput.resources[requiredCost.resourceId]) >= requiredCost.amount,
  } : undefined;
  const gatingFailure = resourceCost && !resourceCost.paid
    ? "required_resource_missing" as const
    : undefined;
  const scoredOutcome: JourneyActionResolutionOutcome = margin >= 16 && input.risk !== "low"
    ? "exceptional_success"
    : margin >= 0
      ? "success"
      : margin >= -8
        ? "partial_success"
        : "failure";
  const outcome: JourneyActionResolutionOutcome = gatingFailure ? "failure" : scoredOutcome;
  const riskPremium = journeyRiskPremiumForOutcome(input.risk, outcome);
  return {
    ruleVersion: JOURNEY_ACTION_RESOLUTION_RULE_VERSION,
    authority: "server",
    decisionKeyId: runtimeActionKeyId(),
    inputHash,
    outcome,
    completionKind: outcome === "success" || outcome === "exceptional_success" ? "complete" : "failed",
    score,
    difficulty,
    margin,
    factors,
    ...(gatingFailure ? { gatingFailure } : {}),
    ...(resourceCost ? { resourceCost } : {}),
    ...(riskPremium ? { riskPremium } : {}),
    summary: actionSummary(input, outcome, gatingFailure),
  };
}
