import { createHash, randomBytes } from "node:crypto";
import type { EpochAttributeId, EpochResourceId } from "./protocol.ts";
import type { JourneyActionResolution } from "./journeyActionResolutionRules.ts";
import type { JourneySceneType } from "./journeySceneCatalog.ts";
import type {
  JourneyAvailableWorldObject,
} from "./journeySceneRules.ts";
import {
  journeyTaskRouteForRegion,
  type JourneyTaskActionDefinition,
  type JourneyTaskEffectKind,
  type JourneyTaskRisk,
  type JourneyTaskRoute,
} from "./journeyTaskCatalog.ts";
import { type ApproachTag, isApproachTag } from "./journeyStrategyRules.ts";

type JsonRecord = Readonly<Record<string, unknown>>;

export const JOURNEY_TASK_PLAN_VERSION = 1 as const;
export const JOURNEY_TASK_ADJUDICATION_VERSION = 2 as const;
export const JOURNEY_TASK_OBJECTIVE_LIMITS = Object.freeze({
  mainMin: 3,
  mainMax: 9,
  sideMin: 2,
  sideMax: 4,
  choiceMax: 2,
  routeMax: 5,
  actionsPerObjective: 2,
});

export type JourneyTaskPlanSource = "model_sampling" | "server_fallback";
export type JourneyTaskObjectiveKind = "main" | "side" | "choice";
export type JourneyTaskGraphRouteKind = "choice" | "unlock";
export type JourneyCompletionTier = "未及格" | "及格" | "良好" | "优秀" | "惊世";
export type LegacyJourneyCompletionTier = JourneyCompletionTier | "完美";
export type JourneyCompletionResultKind = "item" | "knowledge" | "world_state" | "service" | "relationship";
export type JourneyCompletionReturnMode = "carry" | "report" | "none";

export interface JourneyCompletionResult {
  readonly kind: JourneyCompletionResultKind;
  readonly returnMode: JourneyCompletionReturnMode;
  readonly summary: string;
}

export interface JourneyTaskRequest {
  readonly taskType: string;
  readonly scenarioMapId: string;
  readonly generationRequested?: boolean;
  /**
   * PR1 additive. Server-side task-family binding for the request; absent on
   * legacy requests. INTERNAL-only — never surfaces on PublicQuestOffer /
   * PublicActionOption (zero-bonus boundary).
   */
  readonly taskFamilyId?: string;
  /**
   * PR1 additive. Quest-offer id that produced this request, when the request
   * was bound to a specific offer. INTERNAL-only.
   */
  readonly questOfferId?: string;
  /** PR1 additive. sha256 of the offer the request was bound to, for replay. */
  readonly offerHash?: `sha256:${string}`;
  /**
   * PR1 additive (journeyStrategyRules). Server-expected approach tag for
   * strategy auditing. INTERNAL-only; not the public `expectedApproach` bonus
   * marker — the plural {@link ExpectedLifePattern.expectedApproaches} lives
   * on the identity payload.
   */
  readonly expectedApproach?: ApproachTag;
  /** PR1 additive. Market-snapshot version the request was grounded against. */
  readonly marketSnapshotVersion?: number;
}

export interface JourneyGeneratedTaskAction {
  readonly optionKey: string;
  readonly label: string;
  readonly intent: string;
  readonly risk: "low" | "medium" | "high";
  readonly allowedEffectKinds: readonly JourneyTaskEffectKind[];
  readonly targetObjectIds: readonly string[];
  readonly outcomeSummary: string;
  /** Server-validated route selected only when this signed action completes. */
  readonly selectsRouteId?: string;
  /**
   * PR1 additive (journeyStrategyRules). Approach tags observed for this
   * action; recorded into the approach-snapshot log for audit-only strategy
   * consistency scoring. INTERNAL-only — never surfaces on PublicActionOption.
   */
  readonly approachTags?: readonly ApproachTag[];
  /**
   * PR1 additive (journeyStrategyRules). Single expected approach tag for
   * this action, when the server pre-declared one. INTERNAL-only; this is the
   * singular form distinct from the public plural
   * {@link ExpectedLifePattern.expectedApproaches}.
   */
  readonly expectedApproach?: ApproachTag;
  /**
   * PR1 additive. Server-side mechanic id this action instantiates; used for
   * audit correlation only. INTERNAL-only.
   */
  readonly mechanicId?: string;
}

export interface JourneyGeneratedTaskObjective {
  readonly objectiveId: string;
  readonly kind: JourneyTaskObjectiveKind;
  readonly sequence: number;
  /** Global task-graph order. Legacy linear plans omit this field. */
  readonly stage?: number;
  /** All listed objectives must have server completion evidence before this node is available. */
  readonly prerequisiteObjectiveIds?: readonly string[];
  readonly title: string;
  readonly objective: string;
  readonly completionCriteria: string;
  readonly sceneType: Exclude<JourneySceneType, "travel" | "relationship">;
  readonly locationId: string;
  readonly worldObjectIds: readonly string[];
  readonly actions: readonly JourneyGeneratedTaskAction[];
}

export interface JourneyTaskGraphRoute {
  readonly routeId: string;
  readonly kind: JourneyTaskGraphRouteKind;
  readonly title: string;
  /** Optional map-grounded organization or person represented by this route. */
  readonly factionObjectId?: string;
  readonly objectiveIds: readonly string[];
  /** `unlock` routes activate only after all of these side objectives complete. */
  readonly unlockedByObjectiveIds: readonly string[];
}

/**
 * Untrusted model output. Completion, grades, rewards and hidden objectives are
 * intentionally absent: accepting any of them from a client would cross the
 * server-authority boundary.
 */
export interface JourneyTaskProposal {
  readonly title: string;
  readonly premise: string;
  readonly primaryObjective: string;
  readonly successResult: string;
  readonly completionResult?: JourneyCompletionResult;
  readonly objectives: readonly JourneyGeneratedTaskObjective[];
  /** Optional additive graph contract. Omitted plans retain legacy linear execution. */
  readonly routes?: readonly JourneyTaskGraphRoute[];
}

export interface JourneyGeneratedTaskPlan extends JourneyTaskProposal {
  readonly completionResult: JourneyCompletionResult;
  readonly version: typeof JOURNEY_TASK_PLAN_VERSION;
  readonly source: JourneyTaskPlanSource;
  /** New plans use multi-factor server adjudication; omitted persisted plans retain v1 count semantics. */
  readonly adjudicationVersion?: typeof JOURNEY_TASK_ADJUDICATION_VERSION;
  readonly taskType: string;
  readonly scenarioMapId: string;
  /** SHA-256 commitment only. The hidden requirement is not sent before settlement. */
  readonly hiddenTaskCommitment: `sha256:${string}`;
}

export interface JourneyHiddenTaskSpec {
  readonly description: string;
  readonly requiredActions: readonly {
    readonly objectiveId: string;
    readonly optionKey: string;
  }[];
}

/** Server-only material persisted with the task-plan installation event. */
export interface JourneyHiddenTaskSeal {
  readonly version: 1;
  readonly commitment: `sha256:${string}`;
  readonly planHash: `sha256:${string}`;
  readonly nonce: string;
  readonly hiddenTask: JourneyHiddenTaskSpec;
}

/** Server-only installation material. Only `plan` may cross the public boundary. */
export interface JourneyTaskPlanInstallation {
  readonly plan: JourneyGeneratedTaskPlan;
  readonly hiddenTaskSeal: JourneyHiddenTaskSeal;
  /**
   * PR1 additive. Server-side task-family id the installed plan belongs to.
   * INTERNAL-only — never crosses the public boundary.
   */
  readonly taskFamilyId?: string;
  /**
   * PR1 additive. Quest-offer id that produced this installation, when bound
   * to a specific offer. INTERNAL-only.
   */
  readonly questOfferId?: string;
  /** PR1 additive. sha256 of the offer this installation was bound to. */
  readonly offerHash?: `sha256:${string}`;
  /** PR1 additive. Market-snapshot version the installation was grounded against. */
  readonly marketSnapshotVersion?: number;
  /** PR1 additive. sha256 of the world slice the installation was grounded against. */
  readonly worldSliceHash?: `sha256:${string}`;
  /**
   * PR1 additive. sha256 of the broader source context (world content,
   * region, narrative) the installation was generated from.
   */
  readonly sourceContextHash?: `sha256:${string}`;
  /** PR1 additive. Server-side generation batch id for audit correlation. */
  readonly generationBatchId?: string;
}

export type JourneyFallbackRiskProfile = "low" | "medium" | "high" | "dynamic";

export function journeyFallbackRiskForScenario(input: {
  readonly profile: JourneyFallbackRiskProfile;
  readonly objectiveKind: JourneyGeneratedTaskObjective["kind"];
  readonly objectiveSequence: number;
  readonly actionIndex: number;
  readonly baseRisk: JourneyTaskRisk;
}): JourneyTaskRisk {
  if (input.profile === "low") return "low";
  if (input.profile === "medium") {
    if (input.objectiveKind === "choice") return "low";
    return input.actionIndex === 0 ? "medium" : "low";
  }
  if (input.profile === "high") {
    if (input.objectiveKind === "choice") return input.actionIndex === 0 ? "medium" : "low";
    return input.actionIndex === 0 ? "high" : "medium";
  }
  const dynamic = ["low", "medium", "high"] as const;
  return dynamic[(input.objectiveSequence + input.actionIndex) % dynamic.length] ?? input.baseRisk;
}

export type JourneyHiddenTaskSealResolver = (
  journeyId: string,
  plan: JourneyGeneratedTaskPlan,
) => JourneyHiddenTaskSeal | undefined;

export interface JourneyTierReward {
  readonly resourceId: EpochResourceId;
  readonly amount: number;
}

export interface JourneyRewardItem {
  readonly itemKey: string;
  readonly displayName: string;
  readonly rarity: "common" | "rare" | "legendary";
}

export interface JourneyAttributeReward {
  readonly attributeId: EpochAttributeId;
  readonly amount: number;
}

export interface JourneyRewardBundle {
  readonly resources: readonly JourneyTierReward[];
  readonly items: readonly JourneyRewardItem[];
  readonly attributeProgression: {
    readonly mode: "no-direct-gain";
    readonly evidenceSystem: "progressionRules.attributeEvidenceXp";
    readonly summary: string;
  };
  /** Legacy-compatible field. New Journey settlement must keep this empty. */
  readonly attributes: readonly JourneyAttributeReward[];
}

export function normalizeJourneyCompletionTier(value: unknown): JourneyCompletionTier | undefined {
  if (value === "完美") return "优秀";
  return value === "未及格"
    || value === "及格"
    || value === "良好"
    || value === "优秀"
    || value === "惊世"
    ? value
    : undefined;
}

export const JOURNEY_TIER_REWARDS: Readonly<Record<Exclude<JourneyCompletionTier, "未及格">, JourneyTierReward>> = {
  及格: { resourceId: "coin", amount: 2 },
  良好: { resourceId: "coin", amount: 5 },
  优秀: { resourceId: "aether", amount: 3 },
  惊世: { resourceId: "legend", amount: 1 },
};

function rewardItemName(plan: JourneyGeneratedTaskPlan): string {
  const completion = plan.completionResult ?? inferJourneyCompletionResult(plan.successResult);
  switch (completion.kind) {
    case "knowledge": return `${plan.title}便携记录器`;
    case "relationship": return `${plan.title}引荐信物`;
    case "service": return `${plan.title}应急工具包`;
    case "item": return `${plan.title}回收装备`;
    default: return `${plan.title}纪念铭牌`;
  }
}

const ITEM_REWARD_RARITY_BY_TIER: Readonly<Record<Exclude<JourneyCompletionTier, "未及格">, JourneyRewardItem["rarity"] | undefined>> = {
  及格: undefined,
  良好: "common",
  优秀: "rare",
  惊世: "legendary",
};

export function journeyRewardBundleForPlan(
  plan: JourneyGeneratedTaskPlan,
  tier: Exclude<JourneyCompletionTier, "未及格">,
): JourneyRewardBundle {
  const reward = JOURNEY_TIER_REWARDS[tier];
  const itemRarity = ITEM_REWARD_RARITY_BY_TIER[tier];
  const itemHash = createHash("sha256")
    .update(`${plan.hiddenTaskCommitment}:${tier}`)
    .digest("hex")
    .slice(0, 20);
  return {
    resources: [reward],
    attributeProgression: {
      mode: "no-direct-gain",
      evidenceSystem: "progressionRules.attributeEvidenceXp",
      summary: "Journey completion records server evidence and material/resource rewards only; it does not directly grant permanent base attributes.",
    },
    attributes: [],
    items: itemRarity ? [{
      itemKey: `journey_reward_${itemHash}`,
      displayName: rewardItemName(plan),
      rarity: itemRarity,
    }] : [],
  };
}

export interface JourneyTaskAdjudication {
  readonly authority: "server";
  /**
   * Terminal tier for this adjudication. ABSENT on PR4 contract journeys
   * (post-settlement the authority tier lives on {@link SettlementDecision.tier});
   * the field stays on the type so legacy read models that still call
   * {@link deriveLegacyTerminalTier} can carry it without a parallel shape.
   * PR4 callers MUST NOT read this field — use SettlementDecision.tier.
   */
  readonly tier?: JourneyCompletionTier;
  readonly mainCompleted: number;
  readonly mainTotal: number;
  readonly bonusMainCompleted: number;
  readonly bonusMainTotal: number;
  readonly sideCompleted: number;
  readonly sideTotal: number;
  readonly completedObjectiveIds: readonly string[];
  readonly performance?: JourneyTaskPerformance;
  readonly hiddenTask: {
    readonly commitment: string;
    readonly revealed: boolean;
    readonly completed?: boolean;
    readonly description?: string;
    readonly requiredActions?: JourneyHiddenTaskSpec["requiredActions"];
  };
  readonly reward?: JourneyTierReward;
  readonly rewardBundle?: JourneyRewardBundle;
}

export interface JourneyTaskPerformance {
  readonly version: typeof JOURNEY_TASK_ADJUDICATION_VERSION;
  readonly scoreBps: number;
  readonly mainCompletionBps: number;
  readonly bonusMainCompletionBps: number;
  readonly sideCompletionBps: number;
  readonly executionQualityBps: number;
  readonly completedByRisk: Readonly<Record<JourneyTaskRisk, number>>;
  readonly exceptionalSuccesses: number;
  readonly failedActions: number;
  readonly skippedActions: number;
  readonly paidResourceCosts: number;
  readonly missingResolutionEvidence: number;
  readonly perfectEligible: boolean;
  readonly reasons: readonly string[];
}

export interface JourneyTaskEvidenceEpisode {
  readonly generatedTaskObjective?: JourneyGeneratedTaskObjective;
  readonly serverFacts?: {
    readonly storyBeat?: {
      readonly selectedAction: {
        readonly optionKey?: string;
        readonly taskObjectiveId?: string;
        readonly completionKind?: "complete" | "failed" | "skip";
        readonly resolution?: JourneyActionResolution;
      };
    };
  };
}

const PROPOSAL_FIELDS = new Set(["title", "premise", "primaryObjective", "successResult", "completionResult", "objectives", "routes"]);
const COMPLETION_RESULT_FIELDS = new Set(["kind", "returnMode", "summary"]);
const ROUTE_FIELDS = new Set([
  "routeId",
  "kind",
  "title",
  "factionObjectId",
  "objectiveIds",
  "unlockedByObjectiveIds",
]);
const OBJECTIVE_FIELDS = new Set([
  "objectiveId",
  "kind",
  "sequence",
  "stage",
  "prerequisiteObjectiveIds",
  "title",
  "objective",
  "completionCriteria",
  "sceneType",
  "locationId",
  "worldObjectIds",
  "actions",
]);
const ACTION_FIELDS = new Set([
  "optionKey",
  "label",
  "intent",
  "risk",
  "allowedEffectKinds",
  "targetObjectIds",
  "outcomeSummary",
  "selectsRouteId",
  // PR5b: approachTags is whitelisted so the fallback path can re-validate
  // its own calibrated proposal (which carries server-derived approachTags
  // from fallbackAction). The parser NEVER trusts a client-supplied value
  // — it ALWAYS re-derives approachTags from text + structured signals via
  // deriveActionApproachTags below. The whitelist entry only prevents the
  // field-not-allowed guard from firing on server-emitted proposals.
  "approachTags",
]);
const ALLOWED_SCENE_TYPES = new Set<JourneyGeneratedTaskObjective["sceneType"]>([
  "livelihood",
  "commission",
  "world_event",
  "discovery",
  "health",
  "conflict",
]);
const ALLOWED_EFFECT_KINDS = new Set<JourneyTaskEffectKind>([
  "commission_offer",
  "journey_progress",
  "resource_delta",
  "clue_created",
  "relationship_signal",
  "world_reference",
]);
const ALLOWED_COMPLETION_RESULT_KINDS = new Set<JourneyCompletionResultKind>([
  "item", "knowledge", "world_state", "service", "relationship",
]);
const ALLOWED_COMPLETION_RETURN_MODES = new Set<JourneyCompletionReturnMode>(["carry", "report", "none"]);

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function assertOnlyFields(value: JsonRecord, fields: ReadonlySet<string>, code: string): void {
  if (Object.keys(value).some((key) => !fields.has(key))) throw new Error(code);
}

function text(value: unknown, field: string, max = 600): string {
  if (typeof value !== "string" || !value.trim() || value.length > max) {
    throw new Error(`journey_task_${field}_invalid`);
  }
  return value.trim();
}

export function inferJourneyCompletionResult(successResult: string): JourneyCompletionResult {
  const summary = text(successResult, "success_result", 300);
  if (/记录|报告|数据|图谱|图|清单|复核单|凭证|档案|结论|回执/u.test(summary)) {
    return { kind: "knowledge", returnMode: "report", summary };
  }
  if (/样本|物资|器材|芯片|钥匙|药剂|战利品|兽核|道具|遗物/u.test(summary)) {
    return { kind: "item", returnMode: "carry", summary };
  }
  if (/许可|资格|信任|关系|盟约|引荐/u.test(summary)) {
    return { kind: "relationship", returnMode: "none", summary };
  }
  if (/修复|恢复|护送|交接|通过|救援|净化|稳定|供水|复航/u.test(summary)) {
    return { kind: "service", returnMode: "none", summary };
  }
  return { kind: "world_state", returnMode: "none", summary };
}

function completionResult(value: unknown, successResult: string): JourneyCompletionResult {
  if (value === undefined) return inferJourneyCompletionResult(successResult);
  if (!isRecord(value)) throw new Error("journey_task_completion_result_invalid");
  assertOnlyFields(value, COMPLETION_RESULT_FIELDS, "journey_task_completion_result_field_not_allowed");
  if (typeof value.kind !== "string" || !ALLOWED_COMPLETION_RESULT_KINDS.has(value.kind as JourneyCompletionResultKind)) {
    throw new Error("journey_task_completion_result_kind_invalid");
  }
  if (typeof value.returnMode !== "string"
    || !ALLOWED_COMPLETION_RETURN_MODES.has(value.returnMode as JourneyCompletionReturnMode)) {
    throw new Error("journey_task_completion_return_mode_invalid");
  }
  if (value.returnMode === "carry" && value.kind !== "item") {
    throw new Error("journey_task_completion_return_mode_invalid");
  }
  return {
    kind: value.kind as JourneyCompletionResultKind,
    returnMode: value.returnMode as JourneyCompletionReturnMode,
    summary: text(value.summary, "completion_result_summary", 300),
  };
}

function slug(value: unknown, field: string): string {
  const normalized = text(value, field, 96);
  if (!/^[a-z0-9][a-z0-9_-]*$/u.test(normalized)) throw new Error(`journey_task_${field}_invalid`);
  return normalized;
}

function uniqueTexts(value: unknown, field: string, min: number, max: number): readonly string[] {
  if (!Array.isArray(value) || value.length < min || value.length > max) {
    throw new Error(`journey_task_${field}_invalid`);
  }
  const values = value.map((entry) => text(entry, field, 128));
  if (new Set(values).size !== values.length) throw new Error(`journey_task_${field}_duplicate`);
  return values;
}

/**
 * Sampling may describe an action, but its risk label is not authoritative.
 * The server recomputes risk from semantics, persists that result in the task
 * plan, and signs it into every later scene contract.
 */
export function normalizeJourneyTaskActionRisk(input: {
  readonly proposedRisk: JourneyTaskRisk;
  readonly taskType: string;
  readonly actionText?: string;
  readonly objectiveKind?: JourneyTaskObjectiveKind;
  readonly objectiveStage?: number;
  readonly sceneType: JourneyGeneratedTaskObjective["sceneType"];
  readonly targetObjects: readonly JourneyAvailableWorldObject[];
  readonly allowedEffectKinds: readonly JourneyTaskEffectKind[];
}): JourneyTaskRisk {
  const objectText = input.targetObjects.map((object) =>
    `${object.type} ${object.label} ${(object.tags ?? []).join(" ")}`).join(" ");
  const taskText = input.taskType.toLocaleLowerCase("en-US");
  const actionText = `${input.actionText ?? ""} ${objectText}`.toLocaleLowerCase("en-US");
  const dangerousObject = input.targetObjects.some((object) =>
    /^(?:creature|monster|anomaly|hazard|weapon|mutant|beast|hostile)$/u.test(object.type.toLocaleLowerCase("en-US"))
    || (object.tags ?? []).some((tag) => /(?:hostile|hazard|anomaly|boss|mutant|combat|危险|敌对|异常|变异)/iu.test(tag)));
  const dangerousTask = /(?:猎杀|狩猎|清剿|战斗|突袭|镇压|击杀|活捉|变异兽|怪物|收容|异常|失控|污染|hostile|hunt|kill|combat|raid|mutant|beast|anomal|containment|hazard)/iu.test(taskText);
  const violentAction = /(?:猎杀|狩猎|清剿|战斗|突袭|镇压|击杀|活捉|攻击|hostile|hunt|kill|combat|raid|capture)/iu.test(actionText);
  const anomalyAction = /(?:高风险|危险|致命|收容|异常|失控|污染|爆炸|辐射|high-risk|danger|lethal|anomal|containment|hazard)/iu.test(actionText);
  if (input.objectiveKind === "choice") return "low";
  const preparationAction = input.objectiveStage === 1
    && /(?:核对.+(?:步骤|顺序|边界)|检查.+(?:状态|记录)|执行前准备|确认.+(?:条件|边界)|check|inspect|verify.+condition|prepar)/iu.test(actionText);
  if (preparationAction) return input.proposedRisk;
  let floor: JourneyTaskRisk = "low";
  if (["conflict", "world_event", "health"].includes(input.sceneType)
    || dangerousObject
    || dangerousTask
    || input.allowedEffectKinds.includes("resource_delta")) {
    floor = "medium";
  }
  if ((input.sceneType === "conflict" && (dangerousObject || violentAction))
    || (dangerousObject && (violentAction || anomalyAction))
    || (input.sceneType === "world_event" && (dangerousObject || anomalyAction))) {
    floor = "high";
  }
  const weight: Readonly<Record<JourneyTaskRisk, number>> = { low: 0, medium: 1, high: 2 };
  return weight[input.proposedRisk] >= weight[floor] ? input.proposedRisk : floor;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (!isRecord(value)) return JSON.stringify(value);
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
}

function unsignedPlanHash(plan: Omit<JourneyGeneratedTaskPlan, "hiddenTaskCommitment">): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(stableJson(plan)).digest("hex")}`;
}

function deriveHiddenFromUnsignedPlan(
  plan: Omit<JourneyGeneratedTaskPlan, "hiddenTaskCommitment">,
  entropy: Uint8Array,
): JourneyHiddenTaskSpec {
  const routedObjectiveIds = new Set((plan.routes ?? []).flatMap((route) => route.objectiveIds));
  const allMain = plan.objectives.filter((objective) => objective.kind === "main");
  // A hidden requirement must remain achievable regardless of which mutually
  // exclusive route is selected. Graph plans therefore seal a common main node.
  const commonMain = allMain.filter((objective) => !routedObjectiveIds.has(objective.objectiveId));
  const main = commonMain.length ? commonMain : allMain;
  const allSides = plan.objectives.filter((objective) => objective.kind === "side");
  const routeNeutralSides = allSides.filter((objective) =>
    !(objective.prerequisiteObjectiveIds ?? []).some((objectiveId) => routedObjectiveIds.has(objectiveId)));
  const sides = routeNeutralSides.length ? routeNeutralSides : allSides;
  const selected = [
    main[entropy[0] % main.length],
    sides[entropy[1] % sides.length],
  ];
  const requiredActions = selected.map((objective, index) => ({
    objectiveId: objective.objectiveId,
    optionKey: objective.actions[entropy[index + 2] % objective.actions.length].optionKey,
  }));
  return {
    description: `以服务器封存的特定方式完成“${selected[0].title}”与支线“${selected[1].title}”。`,
    requiredActions,
  };
}

function legacyHiddenCommitment(spec: JourneyHiddenTaskSpec): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(stableJson(spec)).digest("hex")}`;
}

function sealedHiddenCommitment(input: {
  readonly nonce: string;
  readonly planHash: string;
  readonly hiddenTask: JourneyHiddenTaskSpec;
}): `sha256:${string}` {
  return `sha256:${createHash("sha256")
    .update(`${input.nonce}:${input.planHash}:${stableJson(input.hiddenTask)}`)
    .digest("hex")}`;
}

function assertHiddenTaskSpecForPlan(
  plan: Omit<JourneyGeneratedTaskPlan, "hiddenTaskCommitment">,
  spec: JourneyHiddenTaskSpec,
) {
  if (typeof spec.description !== "string" || !spec.description.trim()
    || !Array.isArray(spec.requiredActions) || spec.requiredActions.length !== 2) {
    throw new Error("journey_hidden_task_seal_invalid");
  }
  const selected = spec.requiredActions.map((required) => {
    const objective = plan.objectives.find((candidate) => candidate.objectiveId === required.objectiveId);
    if (!objective || !objective.actions.some((action) => action.optionKey === required.optionKey)) {
      throw new Error("journey_hidden_task_seal_invalid");
    }
    return objective;
  });
  if (selected[0]?.kind !== "main" || selected[1]?.kind !== "side"
    || spec.description !== `以服务器封存的特定方式完成“${selected[0].title}”与支线“${selected[1].title}”。`) {
    throw new Error("journey_hidden_task_seal_invalid");
  }
}

export function normalizeJourneyHiddenTaskSeal(
  plan: JourneyGeneratedTaskPlan,
  seal: JourneyHiddenTaskSeal,
): JourneyHiddenTaskSeal {
  const { hiddenTaskCommitment: _commitment, ...unsigned } = plan;
  if (seal.version !== 1
    || !/^[A-Za-z0-9_-]{32,128}$/u.test(seal.nonce)
    || !/^sha256:[a-f0-9]{64}$/u.test(seal.planHash)
    || !/^sha256:[a-f0-9]{64}$/u.test(seal.commitment)
    || seal.planHash !== unsignedPlanHash(unsigned)
    || seal.commitment !== plan.hiddenTaskCommitment) {
    throw new Error("journey_hidden_task_seal_invalid");
  }
  assertHiddenTaskSpecForPlan(unsigned, seal.hiddenTask);
  if (sealedHiddenCommitment(seal) !== seal.commitment) {
    throw new Error("journey_hidden_task_seal_invalid");
  }
  return {
    version: 1,
    commitment: seal.commitment,
    planHash: seal.planHash,
    nonce: seal.nonce,
    hiddenTask: {
      description: seal.hiddenTask.description,
      requiredActions: seal.hiddenTask.requiredActions.map((required) => ({ ...required })),
    },
  };
}

function legacyHiddenTaskForPlan(plan: JourneyGeneratedTaskPlan): JourneyHiddenTaskSpec | undefined {
  const main = plan.objectives.filter((objective) => objective.kind === "main");
  const sides = plan.objectives.filter((objective) => objective.kind === "side");
  for (const mainObjective of main) {
    for (const sideObjective of sides) {
      for (const mainAction of mainObjective.actions) {
        for (const sideAction of sideObjective.actions) {
          const candidate: JourneyHiddenTaskSpec = {
            description: `以服务器封存的特定方式完成“${mainObjective.title}”与支线“${sideObjective.title}”。`,
            requiredActions: [
              { objectiveId: mainObjective.objectiveId, optionKey: mainAction.optionKey },
              { objectiveId: sideObjective.objectiveId, optionKey: sideAction.optionKey },
            ],
          };
          if (legacyHiddenCommitment(candidate) === plan.hiddenTaskCommitment) return candidate;
        }
      }
    }
  }
  return undefined;
}

export function deriveJourneyHiddenTask(
  plan: JourneyGeneratedTaskPlan,
  hiddenTaskSeal?: JourneyHiddenTaskSeal,
): JourneyHiddenTaskSpec {
  if (hiddenTaskSeal) return normalizeJourneyHiddenTaskSeal(plan, hiddenTaskSeal).hiddenTask;
  const legacy = legacyHiddenTaskForPlan(plan);
  if (legacy) return legacy;
  throw new Error("journey_hidden_task_commitment_invalid");
}

export function validateJourneyTaskProposal(input: {
  readonly proposal: unknown;
  readonly taskType: string;
  readonly scenarioMapId: string;
  readonly availableWorldObjects: readonly JourneyAvailableWorldObject[];
  readonly source: JourneyTaskPlanSource;
}): JourneyTaskPlanInstallation {
  if (!isRecord(input.proposal)) throw new Error("journey_task_proposal_invalid");
  assertOnlyFields(input.proposal, PROPOSAL_FIELDS, "journey_task_proposal_field_not_allowed");
  const knownObjects = new Map(input.availableWorldObjects.map((object) => [object.id, object]));
  if (!knownObjects.has(input.scenarioMapId)) throw new Error("journey_task_scenario_map_not_grounded");
  const normalizedTaskType = text(input.taskType, "task_type", 160);
  if (!Array.isArray(input.proposal.objectives)) throw new Error("journey_task_objectives_invalid");
  const rawObjectives = input.proposal.objectives;
  const objectiveIds = new Set<string>();
  const optionKeys = new Set<string>();
  const objectives = rawObjectives.map((rawObjective, index): JourneyGeneratedTaskObjective => {
    if (!isRecord(rawObjective)) throw new Error("journey_task_objective_invalid");
    assertOnlyFields(rawObjective, OBJECTIVE_FIELDS, "journey_task_objective_field_not_allowed");
    const objectiveId = slug(rawObjective.objectiveId, `objective_id_${index}`);
    if (objectiveIds.has(objectiveId)) throw new Error("journey_task_objective_id_duplicate");
    objectiveIds.add(objectiveId);
    if (rawObjective.kind !== "main" && rawObjective.kind !== "side" && rawObjective.kind !== "choice") {
      throw new Error("journey_task_objective_kind_invalid");
    }
    const objectiveKind = rawObjective.kind;
    if (!Number.isSafeInteger(rawObjective.sequence) || Number(rawObjective.sequence) < 1) {
      throw new Error("journey_task_objective_sequence_invalid");
    }
    const stage = rawObjective.stage === undefined ? undefined : Number(rawObjective.stage);
    if (stage !== undefined && (!Number.isSafeInteger(stage) || stage < 1 || stage > 32)) {
      throw new Error("journey_task_objective_stage_invalid");
    }
    const prerequisiteObjectiveIds = rawObjective.prerequisiteObjectiveIds === undefined
      ? undefined
      : uniqueTexts(rawObjective.prerequisiteObjectiveIds, `prerequisite_objective_ids_${index}`, 0, 8);
    if (typeof rawObjective.sceneType !== "string" || !ALLOWED_SCENE_TYPES.has(rawObjective.sceneType as JourneyGeneratedTaskObjective["sceneType"])) {
      throw new Error("journey_task_scene_type_invalid");
    }
    const locationId = text(rawObjective.locationId, `location_id_${index}`, 128);
    if (!knownObjects.has(locationId)) throw new Error(`journey_task_location_not_grounded:${locationId}`);
    const worldObjectIds = uniqueTexts(rawObjective.worldObjectIds, `world_object_ids_${index}`, 1, 8);
    const ungroundedObjectIds = worldObjectIds.filter((objectId) => !knownObjects.has(objectId));
    const locationMissingFromObjects = !worldObjectIds.includes(locationId);
    if (locationMissingFromObjects || ungroundedObjectIds.length > 0) {
      const detail: string[] = [];
      if (locationMissingFromObjects) detail.push(`locationId:${locationId}`);
      if (ungroundedObjectIds.length > 0) detail.push(`objects:${ungroundedObjectIds.join(",")}`);
      throw new Error(`journey_task_world_object_not_grounded:${detail.join(";")}`);
    }
    if (!Array.isArray(rawObjective.actions)
      || rawObjective.actions.length !== JOURNEY_TASK_OBJECTIVE_LIMITS.actionsPerObjective) {
      throw new Error("journey_task_actions_invalid");
    }
    const actions = rawObjective.actions.map((rawAction, actionIndex): JourneyGeneratedTaskAction => {
      if (!isRecord(rawAction)) throw new Error("journey_task_action_invalid");
      assertOnlyFields(rawAction, ACTION_FIELDS, "journey_task_action_field_not_allowed");
      const optionKey = slug(rawAction.optionKey, `option_key_${index}_${actionIndex}`);
      if (optionKeys.has(optionKey)) throw new Error("journey_task_option_key_duplicate");
      optionKeys.add(optionKey);
      if (rawAction.risk !== "low" && rawAction.risk !== "medium" && rawAction.risk !== "high") {
        throw new Error("journey_task_action_risk_invalid");
      }
      const allowedEffectKinds = uniqueTexts(rawAction.allowedEffectKinds, `allowed_effect_kinds_${index}_${actionIndex}`, 1, 4);
      if (allowedEffectKinds.some((kind) => !ALLOWED_EFFECT_KINDS.has(kind as JourneyTaskEffectKind))) {
        throw new Error("journey_task_action_effect_invalid");
      }
      const targetObjectIds = uniqueTexts(rawAction.targetObjectIds, `target_object_ids_${index}_${actionIndex}`, 1, 6);
      if (targetObjectIds.some((objectId) => !worldObjectIds.includes(objectId))) {
        throw new Error("journey_task_action_target_not_grounded");
      }
      const selectsRouteId = rawAction.selectsRouteId === undefined
        ? undefined
        : slug(rawAction.selectsRouteId, `selects_route_id_${index}_${actionIndex}`);
      const actionLabel = text(rawAction.label, `action_label_${index}_${actionIndex}`, 220);
      const actionIntent = text(rawAction.intent, `action_intent_${index}_${actionIndex}`, 500);
      const actionOutcomeSummary = text(rawAction.outcomeSummary, `outcome_summary_${index}_${actionIndex}`, 900);
      // PR5b: derive approach tags server-side from text + structured signals.
      // INTERNAL-only — the field never appears in PublicActionOption and is
      // never accepted from the raw proposal (ACTION_FIELDS gates it out).
      const approachTags = deriveActionApproachTags({
        actionLabel,
        actionIntent,
        actionOutcomeSummary,
        sceneType: rawObjective.sceneType as JourneyGeneratedTaskObjective["sceneType"],
        objectiveKind,
        allowedEffectKinds: allowedEffectKinds as readonly JourneyTaskEffectKind[],
        ...(selectsRouteId ? { selectsRouteId } : {}),
      });
      return {
        optionKey,
        label: actionLabel,
        intent: actionIntent,
        risk: input.source === "server_fallback"
          ? rawAction.risk
          : normalizeJourneyTaskActionRisk({
              proposedRisk: rawAction.risk,
              taskType: normalizedTaskType,
              actionText: `${String(rawAction.label ?? "")} ${String(rawAction.intent ?? "")}`,
              objectiveKind,
              objectiveStage: stage,
              sceneType: rawObjective.sceneType as JourneyGeneratedTaskObjective["sceneType"],
              targetObjects: targetObjectIds
                .map((objectId) => knownObjects.get(objectId))
                .filter((object): object is JourneyAvailableWorldObject => Boolean(object)),
              allowedEffectKinds: allowedEffectKinds as readonly JourneyTaskEffectKind[],
            }),
        allowedEffectKinds: allowedEffectKinds as readonly JourneyTaskEffectKind[],
        targetObjectIds,
        outcomeSummary: actionOutcomeSummary,
        ...(selectsRouteId ? { selectsRouteId } : {}),
        ...(approachTags.length > 0 ? { approachTags } : {}),
      };
    });
    return {
      objectiveId,
      kind: objectiveKind,
      sequence: Number(rawObjective.sequence),
      ...(stage === undefined ? {} : { stage }),
      ...(prerequisiteObjectiveIds?.length ? { prerequisiteObjectiveIds } : {}),
      title: text(rawObjective.title, `objective_title_${index}`, 180),
      objective: text(rawObjective.objective, `objective_${index}`, 500),
      completionCriteria: text(rawObjective.completionCriteria, `completion_criteria_${index}`, 500),
      sceneType: rawObjective.sceneType as JourneyGeneratedTaskObjective["sceneType"],
      locationId,
      worldObjectIds,
      actions,
    };
  });
  const main = objectives.filter((objective) => objective.kind === "main");
  const side = objectives.filter((objective) => objective.kind === "side");
  const choices = objectives.filter((objective) => objective.kind === "choice");
  if (main.length < JOURNEY_TASK_OBJECTIVE_LIMITS.mainMin || main.length > JOURNEY_TASK_OBJECTIVE_LIMITS.mainMax) {
    throw new Error("journey_task_main_objective_count_invalid");
  }
  if (side.length < JOURNEY_TASK_OBJECTIVE_LIMITS.sideMin || side.length > JOURNEY_TASK_OBJECTIVE_LIMITS.sideMax) {
    throw new Error("journey_task_side_objective_count_invalid");
  }
  if (choices.length > JOURNEY_TASK_OBJECTIVE_LIMITS.choiceMax) {
    throw new Error("journey_task_choice_objective_count_invalid");
  }
  for (const kind of ["main", "side", "choice"] as const) {
    const sequences = objectives.filter((objective) => objective.kind === kind).map((objective) => objective.sequence).sort((a, b) => a - b);
    if (sequences.some((sequence, index) => sequence !== index + 1)) {
      throw new Error(`journey_task_${kind}_sequence_invalid`);
    }
  }

  let routes: readonly JourneyTaskGraphRoute[] | undefined;
  if (input.proposal.routes !== undefined) {
    if (!Array.isArray(input.proposal.routes)
      || input.proposal.routes.length < 1
      || input.proposal.routes.length > JOURNEY_TASK_OBJECTIVE_LIMITS.routeMax) {
      throw new Error("journey_task_routes_invalid");
    }
    const routeIds = new Set<string>();
    routes = input.proposal.routes.map((rawRoute, routeIndex): JourneyTaskGraphRoute => {
      if (!isRecord(rawRoute)) throw new Error("journey_task_route_invalid");
      assertOnlyFields(rawRoute, ROUTE_FIELDS, "journey_task_route_field_not_allowed");
      const routeId = slug(rawRoute.routeId, `route_id_${routeIndex}`);
      if (routeIds.has(routeId)) throw new Error("journey_task_route_id_duplicate");
      routeIds.add(routeId);
      if (rawRoute.kind !== "choice" && rawRoute.kind !== "unlock") {
        throw new Error("journey_task_route_kind_invalid");
      }
      const objectiveIdsForRoute = uniqueTexts(rawRoute.objectiveIds, `route_objective_ids_${routeIndex}`, 1, 4);
      const unlockedByObjectiveIds = uniqueTexts(
        rawRoute.unlockedByObjectiveIds,
        `route_unlocked_by_objective_ids_${routeIndex}`,
        rawRoute.kind === "unlock" ? 1 : 0,
        4,
      );
      const factionObjectId = rawRoute.factionObjectId === undefined
        ? undefined
        : text(rawRoute.factionObjectId, `route_faction_object_id_${routeIndex}`, 128);
      if (factionObjectId && !knownObjects.has(factionObjectId)) {
        throw new Error("journey_task_route_faction_not_grounded");
      }
      return {
        routeId,
        kind: rawRoute.kind,
        title: text(rawRoute.title, `route_title_${routeIndex}`, 180),
        ...(factionObjectId ? { factionObjectId } : {}),
        objectiveIds: objectiveIdsForRoute,
        unlockedByObjectiveIds,
      };
    });

    if (objectives.some((objective) => objective.stage === undefined)) {
      throw new Error("journey_task_graph_stage_required");
    }
    const objectiveById = new Map(objectives.map((objective) => [objective.objectiveId, objective]));
    const objectiveRouteIds = new Map<string, string>();
    for (const route of routes) {
      if (route.kind === "choice" && route.unlockedByObjectiveIds.length > 0) {
        throw new Error("journey_task_choice_route_unlock_invalid");
      }
      if (route.kind === "choice" && route.objectiveIds.length < 2) {
        throw new Error("journey_task_choice_route_too_short");
      }
      for (const objectiveId of route.objectiveIds) {
        const objective = objectiveById.get(objectiveId);
        if (!objective || objective.kind !== "main") throw new Error("journey_task_route_objective_invalid");
        if (objectiveRouteIds.has(objectiveId)) throw new Error("journey_task_route_objective_duplicate");
        objectiveRouteIds.set(objectiveId, route.routeId);
      }
      for (const unlockId of route.unlockedByObjectiveIds) {
        const unlock = objectiveById.get(unlockId);
        if (!unlock || unlock.kind !== "side") throw new Error("journey_task_route_unlock_objective_invalid");
        if (route.objectiveIds.some((objectiveId) =>
          Number(objectiveById.get(objectiveId)?.stage) <= Number(unlock.stage))) {
          throw new Error("journey_task_route_unlock_stage_invalid");
        }
      }
    }
    if (!main.some((objective) => !objectiveRouteIds.has(objective.objectiveId))) {
      throw new Error("journey_task_graph_common_main_required");
    }
    const selectedRouteIds = new Set<string>();
    for (const objective of objectives) {
      for (const prerequisiteId of objective.prerequisiteObjectiveIds ?? []) {
        const prerequisite = objectiveById.get(prerequisiteId);
        if (!prerequisite || prerequisite.objectiveId === objective.objectiveId) {
          throw new Error("journey_task_prerequisite_invalid");
        }
        if (Number(prerequisite.stage) >= Number(objective.stage)) {
          throw new Error("journey_task_prerequisite_stage_invalid");
        }
      }
      const routeSelections = objective.actions.map((action) => action.selectsRouteId).filter(Boolean) as string[];
      if (objective.kind === "choice") {
        if (routeSelections.length !== objective.actions.length || new Set(routeSelections).size !== routeSelections.length) {
          throw new Error("journey_task_choice_routes_invalid");
        }
        for (const routeId of routeSelections) {
          const route = routes.find((candidate) => candidate.routeId === routeId);
          if (!route || route.kind !== "choice") throw new Error("journey_task_choice_route_invalid");
          if (route.objectiveIds.some((objectiveId) =>
            Number(objectiveById.get(objectiveId)?.stage) <= Number(objective.stage))) {
            throw new Error("journey_task_choice_route_stage_invalid");
          }
          const factionObjectId = route.factionObjectId;
          const action = objective.actions.find((candidate) => candidate.selectsRouteId === routeId);
          if (factionObjectId && !action?.targetObjectIds.includes(factionObjectId)) {
            throw new Error("journey_task_choice_faction_target_invalid");
          }
          selectedRouteIds.add(routeId);
        }
      } else if (routeSelections.length > 0) {
        throw new Error("journey_task_route_selection_not_allowed");
      }
    }
    if (routes.some((route) => route.kind === "choice" && !selectedRouteIds.has(route.routeId))) {
      throw new Error("journey_task_choice_route_unreachable");
    }
  } else if (choices.length > 0
    || objectives.some((objective) => objective.stage !== undefined
      || objective.prerequisiteObjectiveIds?.length
      || objective.actions.some((action) => action.selectsRouteId))) {
    throw new Error("journey_task_routes_required");
  }
  const successResult = text(input.proposal.successResult, "success_result", 300);
  const unsigned: Omit<JourneyGeneratedTaskPlan, "hiddenTaskCommitment"> = {
    version: JOURNEY_TASK_PLAN_VERSION,
    source: input.source,
    adjudicationVersion: JOURNEY_TASK_ADJUDICATION_VERSION,
    taskType: normalizedTaskType,
    scenarioMapId: text(input.scenarioMapId, "scenario_map_id", 128),
    title: text(input.proposal.title, "title", 180),
    premise: text(input.proposal.premise, "premise", 900),
    primaryObjective: text(input.proposal.primaryObjective, "primary_objective", 600),
    successResult,
    completionResult: completionResult(input.proposal.completionResult, successResult),
    objectives: [
      ...(routes
        ? objectives.sort((left, right) => Number(left.stage) - Number(right.stage)
          || left.sequence - right.sequence
          || left.objectiveId.localeCompare(right.objectiveId))
        : [
            ...main.sort((left, right) => left.sequence - right.sequence),
            ...side.sort((left, right) => left.sequence - right.sequence),
          ]),
    ],
    ...(routes ? { routes } : {}),
  };
  const hiddenTask = deriveHiddenFromUnsignedPlan(unsigned, randomBytes(4));
  const nonce = randomBytes(32).toString("base64url");
  const planHash = unsignedPlanHash(unsigned);
  const commitment = sealedHiddenCommitment({ nonce, planHash, hiddenTask });
  const plan = Object.freeze({ ...unsigned, hiddenTaskCommitment: commitment });
  const hiddenTaskSeal = normalizeJourneyHiddenTaskSeal(plan, {
    version: 1,
    commitment,
    planHash,
    nonce,
    hiddenTask,
  });
  return { plan, hiddenTaskSeal };
}

/**
 * PR5b additive (journeyRoleplayRules integration). Internal-only approach-tag
 * derivation for a single journey task action.
 *
 * The function is the single server-owned source for the `approachTags`
 * field written onto {@link JourneyGeneratedTaskAction}. The derivation is
 * deterministic and LLM-free: it inspects the action's text + structured
 * signals (allowed effect kinds, scene type, objective kind, selected route)
 * and emits at most one approach tag for the first signal that fires. The
 * output is gated through {@link isApproachTag} so any heuristic drift
 * surfaces as an empty array (fail-closed) rather than an invalid tag.
 *
 * Zero-bonus boundary: this field is INTERNAL — it does NOT surface on
 * `PublicActionOption` / `PublicQuestOffer`. The roleplay-doubt hook in
 * `submitHostedAction` reads it server-side; legacy actions that omit the
 * field cause the roleplay hook to fail-open (skip), never block settlement.
 *
 * Mapping v1 (PR5b spec §6.9):
 *  - escort/aid/rescue/protect signal → ['support']
 *  - stealth/avoid/sneak signal → ['stealth']
 *  - supply/logistics/deliver signal → ['logistics']
 *  - scout/recon/investigate signal OR discovery scene → ['scout']
 *  - faction route selection (factionObjectId present) → ['diplomacy']
 *  - diplomacy/negotiate/liaison signal → ['diplomacy']
 *  - combat/fight/strike/hunt signal OR conflict scene → ['combat']
 *  - no signal → [] (legacy action; roleplay hook fail-opens)
 *
 * Bumping the signal regexes / ordering MUST bump
 * {@link ROLEPLAY_PATTERN_VERSION} in journeyRoleplayRules so existing
 * identities re-issue their patterns against the new mapping (action tags
 * feed the comparator).
 */
export interface DeriveActionApproachTagsInput {
  /** Action label and intent — mined for approach-tag signal keywords. */
  readonly actionLabel?: string;
  readonly actionIntent?: string;
  readonly actionOutcomeSummary?: string;
  readonly sceneType?: JourneyGeneratedTaskObjective["sceneType"];
  readonly objectiveKind?: JourneyTaskObjectiveKind;
  readonly allowedEffectKinds: readonly JourneyTaskEffectKind[];
  /**
   * Route selection signal. PR5b v1 does NOT auto-derive 'diplomacy' from
   * route selection alone — only explicit text signals trigger the diplomacy
   * tag. The spec's "faction route → ['diplomacy'] 或按
   * routeSelection.factionObjectId" is permissive; v1 picks the
   * text-only path so generic routing actions (e.g. "接受 faction 提出的
   * 路线") do not drag the acting identity into a roleplay-doubt penalty
   * before the text-mining is calibrated against live telemetry. These
   * fields are accepted for forward compatibility but not consulted here.
   */
  readonly selectsRouteId?: string;
  readonly routeFactionObjectId?: string;
}

const APPROACH_SIGNAL_COMBAT = /combat|fight|strike|assault|hunt|battle|战斗|猎杀|袭击|刺杀|攻击|交战|剿|突围/iu;
const APPROACH_SIGNAL_SCOUT = /scout|recon|investigate|survey|勘探|侦察|调查|勘测|测绘|监控/iu;
const APPROACH_SIGNAL_LOGISTICS = /supply|logistics|deliver|cargo|补给|物流|运送|交付|运输|调度/iu;
const APPROACH_SIGNAL_SUPPORT = /escort|aid|rescue|assist|protect|护送|救援|协助|援助|保护|照料|治疗/iu;
const APPROACH_SIGNAL_STEALTH = /stealth|avoid|sneak|hide|evade|潜行|回避|避开|隐匿|悄|无声/iu;
const APPROACH_SIGNAL_DIPLOMACY = /diplomacy|negotiate|parley|liaison|外交|谈判|联络|斡旋|交涉/iu;

export function deriveActionApproachTags(input: DeriveActionApproachTagsInput): readonly ApproachTag[] {
  const text = `${input.actionLabel ?? ""} ${input.actionIntent ?? ""} ${input.actionOutcomeSummary ?? ""}`;
  // Ordered checks: support/stealth/logistics/diplomacy by text first (the
  // highest-signal action verbs), then scout/combat (text or scene-type
  // inference), then effect-kind fallbacks. First match wins. The order is
  // versioned via ROLEPLAY_PATTERN_VERSION.
  if (APPROACH_SIGNAL_SUPPORT.test(text)) return filterTags(["support"]);
  if (APPROACH_SIGNAL_STEALTH.test(text)) return filterTags(["stealth"]);
  if (APPROACH_SIGNAL_LOGISTICS.test(text)) return filterTags(["logistics"]);
  if (APPROACH_SIGNAL_DIPLOMACY.test(text)) return filterTags(["diplomacy"]);
  if (APPROACH_SIGNAL_SCOUT.test(text) || input.sceneType === "discovery") {
    return filterTags(["scout"]);
  }
  if (APPROACH_SIGNAL_COMBAT.test(text) || input.sceneType === "conflict") {
    return filterTags(["combat"]);
  }
  // resource_delta effect on a non-combat/non-scout scene defaults to
  // logistics (procurement / foraging). relationship_signal defaults to
  // diplomacy. These are weak signals — they only fire when no stronger
  // text/scene signal matched.
  if (input.allowedEffectKinds.includes("resource_delta")) return filterTags(["logistics"]);
  if (input.allowedEffectKinds.includes("relationship_signal")) return filterTags(["diplomacy"]);
  // No signal: legacy action — roleplay hook fail-opens.
  return [];
}

/** Defence-in-depth: drop any tag that is not a member of APPROACH_TAGS. */
function filterTags(tags: readonly string[]): readonly ApproachTag[] {
  const out: ApproachTag[] = [];
  for (const tag of tags) {
    if (isApproachTag(tag)) out.push(tag);
  }
  return out;
}

/**
 * Extended context for {@link fallbackAction} so the PR5b approach-tag
 * derivation has access to scene / objective / route signals. All fields
 * are optional; when absent the corresponding signal is skipped (the
 * derivation falls back to text + effect-kind signals).
 */
export interface FallbackActionContext {
  readonly sceneType?: JourneyGeneratedTaskObjective["sceneType"];
  readonly objectiveKind?: JourneyTaskObjectiveKind;
  /**
   * Faction object id of the route this action selects, when the action
   * carries a `selectsRouteId` that resolves to a faction-bearing route.
   * Drives the diplomacy signal in {@link deriveActionApproachTags}.
   */
  readonly routeFactionObjectId?: string;
}

function fallbackAction(
  action: JourneyTaskActionDefinition,
  optionKey: string,
  label: string,
  intent: string,
  outcomeSummary: string,
  context: FallbackActionContext = {},
): JourneyGeneratedTaskAction {
  const approachTags = deriveActionApproachTags({
    actionLabel: label,
    actionIntent: intent,
    actionOutcomeSummary: outcomeSummary,
    sceneType: context.sceneType,
    objectiveKind: context.objectiveKind,
    allowedEffectKinds: action.allowedEffectKinds,
    ...(action.targetObjectIds ? {} : {}),
    routeFactionObjectId: context.routeFactionObjectId,
  });
  return {
    optionKey,
    label,
    intent,
    risk: action.risk,
    allowedEffectKinds: action.allowedEffectKinds,
    targetObjectIds: action.targetObjectIds,
    outcomeSummary,
    // PR5b: server-derived approach tags for the roleplay-doubt hook.
    // INTERNAL-only — never surfaces on PublicActionOption.
    ...(approachTags.length > 0 ? { approachTags } : {}),
  };
}

function fallbackObjective(input: {
  readonly route: JourneyTaskRoute;
  readonly kind: JourneyTaskObjectiveKind;
  readonly sequence: number;
  readonly stage?: number;
  readonly prerequisiteObjectiveIds?: readonly string[];
  readonly suffix: string;
  readonly title: string;
  readonly objective: string;
  readonly completionCriteria: string;
  readonly sceneType?: JourneyGeneratedTaskObjective["sceneType"];
  readonly actions: readonly JourneyGeneratedTaskAction[];
}): JourneyGeneratedTaskObjective {
  const objectIds = [...new Set([input.route.locationId, ...input.actions.flatMap((action) => action.targetObjectIds)])];
  return {
    objectiveId: `${input.kind}_${input.sequence}_${input.suffix}`,
    kind: input.kind,
    sequence: input.sequence,
    ...(input.stage === undefined ? {} : { stage: input.stage }),
    ...(input.prerequisiteObjectiveIds?.length
      ? { prerequisiteObjectiveIds: input.prerequisiteObjectiveIds }
      : {}),
    title: input.title,
    objective: input.objective,
    completionCriteria: input.completionCriteria,
    sceneType: input.sceneType ?? input.route.sceneType,
    locationId: input.route.locationId,
    worldObjectIds: objectIds,
    actions: input.actions,
  };
}

const CATALOG_TASK_SIGNALS = [
  /实验|研究|样本|校准/iu,
  /试炼|考核|入门/iu,
  /猎杀|狩猎|变异兽|悬赏/iu,
  /救援|受困|撤离/iu,
  /护送|药品|交付/iu,
  /收容|失控|隔离/iu,
  /修复|中继|通信|维护/iu,
  /打捞|回收|残骸/iu,
  /清障|通道|绕行/iu,
  /调查|勘测|测绘|异常/iu,
  /档案|修复页|玻璃页/iu,
  /采样|月井|光质/iu,
  /车队|护卫|补给/iu,
  /预言|校验|审计/iu,
  /排练|剧场|演出/iu,
  /商队|贸易|查验/iu,
] as const;

function finalName(label: string): string {
  return [...label].slice(-2).join("");
}

function catalogFallbackRoute(input: {
  readonly taskType: string;
  readonly scenarioMapId: string;
  readonly availableWorldObjects: readonly JourneyAvailableWorldObject[];
}): JourneyTaskRoute | undefined {
  const catalog = journeyTaskRouteForRegion(input.scenarioMapId);
  if (!catalog) return undefined;
  const availableById = new Map(input.availableWorldObjects.map((object) => [object.id, object]));
  if (!availableById.has(catalog.locationId)) return undefined;
  const catalogText = [
    catalog.title,
    catalog.premise,
    catalog.mission.primaryObjective,
    ...catalog.actions.map((action) => `${action.label} ${action.intent}`),
  ].join(" ");
  if (!CATALOG_TASK_SIGNALS.some((signal) => signal.test(input.taskType) && signal.test(catalogText))) {
    return undefined;
  }

  const fixedPeople = catalog.worldObjects.filter((object) => ["npc", "agent"].includes(object.type));
  const dynamicPeople = input.availableWorldObjects.filter((object) =>
    ["npc", "agent"].includes(object.type) && (object.tags ?? []).includes("journey_scoped_cast"));
  const replacementById = new Map<string, JourneyAvailableWorldObject>();
  const labelReplacements: { readonly from: string; readonly to: string }[] = [];
  fixedPeople.forEach((person, index) => {
    const replacement = dynamicPeople[index % Math.max(1, dynamicPeople.length)] ?? availableById.get(person.id);
    if (!replacement) return;
    replacementById.set(person.id, replacement);
    labelReplacements.push(
      { from: person.label, to: replacement.label },
      { from: finalName(person.label), to: finalName(replacement.label) },
    );
  });
  const replacePeople = (value: string) => labelReplacements.reduce((textValue, replacement) =>
    textValue.split(replacement.from).join(replacement.to), value);
  const mapTargets = (targetObjectIds: readonly string[]) => [...new Set(targetObjectIds
    .map((objectId) => replacementById.get(objectId)?.id ?? objectId)
    .filter((objectId) => availableById.has(objectId)))];
  const replacedFixedIds = new Set(dynamicPeople.length ? fixedPeople.map((person) => person.id) : []);
  const worldObjects = input.availableWorldObjects.filter((object) => !replacedFixedIds.has(object.id));
  const participantIds = dynamicPeople.length
    ? dynamicPeople.map((person) => person.id)
    : catalog.participantIds.filter((participantId) => availableById.has(participantId));
  return {
    ...catalog,
    title: replacePeople(catalog.title),
    premise: replacePeople(catalog.premise),
    participantIds,
    worldObjects,
    actions: catalog.actions.map((action) => ({
      ...action,
      label: replacePeople(action.label),
      intent: replacePeople(action.intent),
      targetObjectIds: mapTargets(action.targetObjectIds),
      outcomeSummary: replacePeople(action.outcomeSummary),
      chapterTitle: replacePeople(action.chapterTitle),
      actionNarrative: replacePeople(action.actionNarrative),
    })),
    mission: {
      briefing: replacePeople(catalog.mission.briefing),
      primaryObjective: replacePeople(catalog.mission.primaryObjective),
      completionCriteria: replacePeople(catalog.mission.completionCriteria),
      successResult: replacePeople(catalog.mission.successResult),
    },
  };
}

/** Server-owned, map-grounded fallback used only when Sampling is unavailable or invalid. */
export function buildFallbackJourneyTaskPlan(input: {
  readonly taskType: string;
  readonly scenarioMapId: string;
  readonly availableWorldObjects: readonly JourneyAvailableWorldObject[];
  readonly riskProfile?: JourneyFallbackRiskProfile;
  /**
   * PR3. Optional world slice the fallback is grounded against. Used only to
   * carry `sliceHash` into the installation's `worldSliceHash`; absence
   * produces a deterministic sentinel hash. NEVER influences the plan content
   * itself (the plan is grounded on `availableWorldObjects` only).
   */
  readonly worldSlice?: { readonly sliceHash: `sha256:${string}` };
}): JourneyTaskPlanInstallation {
  const catalogRoute = catalogFallbackRoute(input);
  const route = catalogRoute ?? fallbackRouteFromMap(input);
  if (process.env.EPOCH_DIAG) console.error("[region-fallback]", JSON.stringify({
    scenarioMapId: input.scenarioMapId, taskType: input.taskType,
    catalogHit: Boolean(catalogRoute), catalogRouteKey: catalogRoute?.routeKey, catalogRegionId: catalogRoute?.regionId,
    finalRouteKey: route.routeKey, finalRegionId: route.regionId, locationId: route.locationId,
    objectsCount: route.worldObjects.length, actionsCount: route.actions.length,
    worldObjectsIds: route.worldObjects.map((o) => o.id).slice(0, 5),
  }));
  const primary = route.actions.find((action) => action.completesMission) ?? route.actions[0];
  const alternate = route.actions.find((action) => action.completesMission && action.optionKey !== primary.optionKey)
    ?? route.actions[1]
    ?? primary;
  const cautiousActions = [primary, alternate].sort((left, right) => {
    const riskWeight: Readonly<Record<JourneyTaskRisk, number>> = { low: 0, medium: 1, high: 2 };
    return riskWeight[left.risk] - riskWeight[right.risk] || left.optionKey.localeCompare(right.optionKey);
  });
  const cautiousPrimary = cautiousActions[0] ?? primary;
  const cautiousAlternate = cautiousActions[1] ?? alternate;
  const materialTargetIds = [...new Set(route.actions.flatMap((action) => action.targetObjectIds))]
    .filter((objectId) => objectId !== route.locationId && !route.participantIds.includes(objectId));
  const stageTargets = (stage: number) => [...new Set([
    route.locationId,
    route.participantIds[stage % Math.max(1, route.participantIds.length)],
    materialTargetIds[stage % Math.max(1, materialTargetIds.length)],
  ].filter((value): value is string => Boolean(value)))];
  const stageAction = (
    action: JourneyTaskActionDefinition,
    stage: number,
    optionKey: string,
    label: string,
    intent: string,
    outcomeSummary: string,
    risk: JourneyTaskRisk = action.risk,
    context: FallbackActionContext = {},
  ) => fallbackAction(
    { ...action, risk, targetObjectIds: stageTargets(stage) },
    optionKey,
    label,
    intent,
    outcomeSummary,
    { sceneType: route.sceneType, ...context },
  );
  const branchObjects = route.worldObjects.filter((object) =>
    object.id !== route.locationId && ["organization", "faction", "npc", "agent"].includes(object.type));
  const affiliationSponsors = branchObjects.filter((object) =>
    object.type === "organization" || object.type === "faction")
    .sort((left, right) => Number(right.tags?.includes("agent_affiliated")) - Number(left.tags?.includes("agent_affiliated"))
      || Number(right.type === "faction") - Number(left.type === "faction")
      || left.id.localeCompare(right.id));
  const primarySponsor = affiliationSponsors[0] ?? branchObjects[0];
  const alternateSponsor = affiliationSponsors.find((object) => object.id !== primarySponsor?.id)
    ?? branchObjects.find((object) => object.id !== primarySponsor?.id);
  const primaryRouteId = `${route.routeKey}_route_direct`;
  const alternateRouteId = `${route.routeKey}_route_cautious`;
  const unlockedRouteId = `${route.routeKey}_route_unlocked`;
  const prepareId = "main_1_prepare";
  const choiceId = "choice_1_route";
  const sideUnlockId = "side_1_assist";
  const primaryExecuteId = "main_2_direct_execute";
  const primaryVerifyId = "main_3_direct_verify";
  const alternateExecuteId = "main_4_cautious_execute";
  const alternateVerifyId = "main_5_cautious_verify";
  const unlockedMainId = "main_6_unlocked_followup";
  const choiceAction = (
    action: JourneyTaskActionDefinition,
    sponsor: JourneyAvailableWorldObject | undefined,
    routeId: string,
    suffix: string,
    routeLabel: string,
  ): JourneyGeneratedTaskAction => {
    // PR5b: a choice action selects a route; when the sponsor is a faction /
    // organization, propagate its id so deriveActionApproachTags emits
    // 'diplomacy' for the roleplay-doubt comparator. The choice action's
    // risk stays at "low" (matching the pre-PR5b behaviour: stageAction's
    // risk parameter defaults to action.risk where action is the already-
    // merged `{...action, risk: "low"}`).
    const sponsorFactionId = sponsor && ["organization", "faction"].includes(sponsor.type)
      ? sponsor.id
      : undefined;
    const base = stageAction(
      { ...action, risk: "low" },
      1,
      `${route.routeKey}_choose_${suffix}`,
      sponsor ? `接受${sponsor.label}提出的${routeLabel}` : `选择${routeLabel}`,
      `确认${routeLabel}的执行边界，后续只进入这一条互斥路线。`,
      sponsor
        ? `身份与${sponsor.label}确认了${routeLabel}，后续行动转入对应路线。`
        : `身份确认采用${routeLabel}，后续行动转入对应路线。`,
      // Explicit risk "low" preserves pre-PR5b behaviour (the merged action
      // already sets risk: "low"; passing it explicitly here keeps the
      // stageAction signature's risk parameter unambiguous when we also
      // pass the new context argument).
      "low",
      {
        objectiveKind: "choice",
        ...(sponsorFactionId ? { routeFactionObjectId: sponsorFactionId } : {}),
      },
    );
    return {
      ...base,
      targetObjectIds: [...new Set([route.locationId, ...(sponsor ? [sponsor.id] : [])])],
      selectsRouteId: routeId,
    };
  };
  const objectives: JourneyGeneratedTaskObjective[] = [
    fallbackObjective({
      route, kind: "main", sequence: 1, stage: 1, suffix: "prepare", title: "确认现场与执行条件",
      objective: `抵达${route.title}现场，依据可核验对象完成准备。`,
      completionCriteria: "现场对象、执行顺序与安全边界均完成确认。",
      actions: [
        stageAction(primary, 0, `${route.routeKey}_prepare_primary`, `与现场人员核对${route.title}的执行顺序`, "核对目标对象、步骤与安全边界后再进入执行。", `身份与现场人员逐项核对${route.title}涉及的对象、步骤与安全边界，完成执行前准备。`, "low"),
        stageAction(alternate, 0, `${route.routeKey}_prepare_alternate`, `检查${route.title}所需对象的当前状态`, "只检查地图中已经登记的对象并保留检查记录。", `身份检查了${route.title}所需对象的当前状态，把可核验项目写入现场记录。`, "low"),
      ],
    }),
    fallbackObjective({
      route, kind: "choice", sequence: 1, stage: 2, prerequisiteObjectiveIds: [prepareId], suffix: "route",
      title: "决定合作方与执行路线",
      objective: "在两条互斥路线中选择一条，后续结果由该选择产生。",
      completionCriteria: "一条路线由签名行动明确选定，另一条路线同时锁定。",
      sceneType: "commission",
      actions: [
        choiceAction(primary, primarySponsor, primaryRouteId, "direct", "直接执行路线"),
        choiceAction(alternate, alternateSponsor, alternateRouteId, "cautious", "审慎核验路线"),
      ],
    }),
    fallbackObjective({
      route, kind: "side", sequence: 1, stage: 3, prerequisiteObjectiveIds: [choiceId], suffix: "assist", title: "协助现场人员",
      objective: "在不妨碍主任务的前提下完成一次现场协助；完成后可打开额外主线。",
      completionCriteria: "协助行动留下独立签名记录，并满足额外路线的服务端解锁条件。",
      sceneType: "commission",
      actions: [
        stageAction(alternate, 3, `${route.routeKey}_side_assist_primary`, `协助处理${route.title}的辅助步骤`, "只处理现场人员明确交付的辅助步骤。", `身份完成了${route.title}的一项辅助步骤，并由现场记录确认。`, "medium"),
        stageAction(primary, 3, `${route.routeKey}_side_assist_alternate`, `复查${route.title}的安全边界`, "复查已经登记的安全边界，不扩大任务范围。", `身份复查了${route.title}的安全边界，把一项需要注意的现场条件加入记录。`, "low"),
      ],
    }),
    fallbackObjective({
      route, kind: "main", sequence: 2, stage: 4, prerequisiteObjectiveIds: [choiceId], suffix: "direct_execute", title: `${route.title}：直接执行`,
      objective: route.mission.primaryObjective,
      completionCriteria: route.mission.completionCriteria,
      actions: [
        stageAction(primary, 1, `${route.routeKey}_direct_execute_primary`, primary.label, primary.intent, primary.outcomeSummary),
        stageAction(alternate, 2, `${route.routeKey}_direct_execute_alternate`, alternate.label, alternate.intent, alternate.outcomeSummary),
      ],
    }),
    fallbackObjective({
      route, kind: "main", sequence: 4, stage: 4, prerequisiteObjectiveIds: [choiceId], suffix: "cautious_execute", title: `${route.title}：审慎核验`,
      objective: `先核验关键对象，再以较稳妥的方式完成“${route.mission.primaryObjective}”。`,
      completionCriteria: route.mission.completionCriteria,
      actions: [
        stageAction(cautiousPrimary, 1, `${route.routeKey}_cautious_execute_primary`, cautiousPrimary.label, cautiousPrimary.intent, cautiousPrimary.outcomeSummary),
        stageAction(cautiousAlternate, 2, `${route.routeKey}_cautious_execute_alternate`, cautiousAlternate.label, cautiousAlternate.intent, cautiousAlternate.outcomeSummary),
      ],
    }),
    fallbackObjective({
      route, kind: "main", sequence: 6, stage: 5, prerequisiteObjectiveIds: [sideUnlockId], suffix: "unlocked_followup", title: "支线开启的追加主线",
      objective: `利用现场协助取得的新条件，补做${route.title}的追加目标。`,
      completionCriteria: "追加目标由支线完成记录解锁，并留下独立结果。",
      sceneType: "discovery",
      actions: [
        stageAction(primary, 4, `${route.routeKey}_unlocked_followup_primary`, `追查${route.title}中刚显现的额外线索`, "只沿支线确认的新条件继续调查。", `身份沿支线确认的新条件完成了追加调查，并留下独立结果。`),
        stageAction(alternate, 4, `${route.routeKey}_unlocked_followup_alternate`, `复核支线开启的新增对象`, "核对新增对象与原任务的对应关系。", `身份复核了支线开启的新增对象，确认其与原任务的对应关系。`),
      ],
    }),
    fallbackObjective({
      route, kind: "main", sequence: 3, stage: 6, prerequisiteObjectiveIds: [primaryExecuteId], suffix: "direct_verify", title: "直接路线：核验结果",
      objective: `核验${route.mission.successResult}并完成直接路线交付。`,
      completionCriteria: `${route.mission.successResult}能够对应直接路线的签名行动记录。`,
      actions: [
        stageAction(primary, 2, `${route.routeKey}_direct_verify_primary`, `与现场负责人复核${route.mission.successResult}`, "逐项对应执行记录，不补写未经证实的结果。", `身份与现场负责人逐项复核执行记录，确认${route.mission.successResult}可以追溯到本局行动。`),
        stageAction(primary, 3, `${route.routeKey}_direct_verify_alternate`, `整理直接路线的交付记录`, "整理已执行步骤并提交记录。", `身份整理了直接路线涉及的对象与步骤，提交了可追溯的交付记录。`, "low"),
      ],
    }),
    fallbackObjective({
      route, kind: "main", sequence: 5, stage: 6, prerequisiteObjectiveIds: [alternateExecuteId], suffix: "cautious_verify", title: "审慎路线：核验结果",
      objective: `核验${route.mission.successResult}并完成审慎路线交付。`,
      completionCriteria: `${route.mission.successResult}能够对应审慎路线的签名行动记录。`,
      actions: [
        stageAction(alternate, 2, `${route.routeKey}_cautious_verify_primary`, `逐项复核${route.mission.successResult}`, "把核验结果对应到已执行步骤。", `身份逐项复核了执行结果，确认${route.mission.successResult}可以追溯到本局行动。`),
        stageAction(alternate, 3, `${route.routeKey}_cautious_verify_alternate`, `请现场人员共同确认核验记录`, "由现场参与者确认能够证明的部分。", `身份与现场人员共同核对记录，确认了能够由行动事件证明的部分。`, "medium"),
      ],
    }),
    fallbackObjective({
      route, kind: "side", sequence: 2, stage: 7, prerequisiteObjectiveIds: [sideUnlockId], suffix: "evidence", title: "补全可追溯证据",
      objective: "为本局行动补全一份独立核验记录。",
      completionCriteria: "关键对象和执行结果均具有可追溯对应关系。",
      sceneType: "discovery",
      actions: [
        stageAction(primary, 4, `${route.routeKey}_side_evidence_primary`, `复核${route.mission.successResult}的对象编号`, "只记录地图中已存在对象的编号和本局行动。", `身份复核了${route.mission.successResult}对应的对象编号，并与本局行动记录完成匹配。`),
        stageAction(alternate, 4, `${route.routeKey}_side_evidence_alternate`, `请现场人员共同确认交付记录`, "由现场参与者核对记录，不替任何人虚构表态。", `身份请现场参与者共同核对交付记录，双方确认了其中能够由行动事件证明的部分。`),
      ],
    }),
  ];
  const routes: readonly JourneyTaskGraphRoute[] = [
    {
      routeId: primaryRouteId,
      kind: "choice",
      title: primarySponsor ? `${primarySponsor.label}的直接执行路线` : "直接执行路线",
      ...(primarySponsor && ["organization", "faction"].includes(primarySponsor.type)
        ? { factionObjectId: primarySponsor.id }
        : {}),
      objectiveIds: [primaryExecuteId, primaryVerifyId],
      unlockedByObjectiveIds: [],
    },
    {
      routeId: alternateRouteId,
      kind: "choice",
      title: alternateSponsor ? `${alternateSponsor.label}的审慎核验路线` : "审慎核验路线",
      ...(alternateSponsor && ["organization", "faction"].includes(alternateSponsor.type)
        ? { factionObjectId: alternateSponsor.id }
        : {}),
      objectiveIds: [alternateExecuteId, alternateVerifyId],
      unlockedByObjectiveIds: [],
    },
    {
      routeId: unlockedRouteId,
      kind: "unlock",
      title: "现场协助开启的追加主线",
      objectiveIds: [unlockedMainId],
      unlockedByObjectiveIds: [sideUnlockId],
    },
  ];
  const proposal: JourneyTaskProposal = {
    title: route.title,
    premise: route.premise,
    primaryObjective: route.mission.primaryObjective,
    successResult: route.mission.successResult,
    completionResult: inferJourneyCompletionResult(route.mission.successResult),
    objectives,
    routes,
  };
  const calibratedProposal: JourneyTaskProposal = input.riskProfile
    ? {
        ...proposal,
        objectives: proposal.objectives.map((objective) => ({
          ...objective,
          actions: objective.actions.map((action, actionIndex) => ({
            ...action,
            risk: journeyFallbackRiskForScenario({
              profile: input.riskProfile as JourneyFallbackRiskProfile,
              objectiveKind: objective.kind,
              objectiveSequence: objective.sequence,
              actionIndex,
              baseRisk: action.risk,
            }),
          })),
        })),
      }
    : proposal;
  const installation = validateJourneyTaskProposal({
    ...input,
    proposal: calibratedProposal,
    source: "server_fallback",
  });
  // PR3: the fallback path populates every PR1 additive source-binding field
  // so the journeyRules.ts source-binding lock treats fallback and
  // offer-driven plans by the same rule. The distinction is journey.questOfferId
  // (set for offer-driven; UNDEF for fallback). The fallback's `questOfferId`
  // is intentionally omitted on the installation: this is a grounded seed,
  // NOT a market claim. No time salt is mixed into the hashes so restart
  // replay produces bit-identical installations.
  const fallbackTaskFamilyId = `catalog:${route.routeKey}`;
  const fallbackOfferHash = `sha256:${installation.hiddenTaskSeal.planHash.slice("sha256:".length)}:${input.scenarioMapId}` as `sha256:${string}`;
  const fallbackWorldSliceHash = input.worldSlice?.sliceHash
    ?? (`sha256:fallback:${input.scenarioMapId}` as `sha256:${string}`);
  const fallbackSourceContextHash = `sha256:${createHash("sha256")
    .update(`catalog-fallback:${route.routeKey}:${route.regionId}:${route.locationId}`)
    .digest("hex")}` as `sha256:${string}`;
  const fallbackGenerationBatchId = `fallback:${input.scenarioMapId}:${input.taskType}`;
  // marketSnapshotVersion = 0 is the sentinel meaning "no published snapshot;
  // fallback seed". Offer-driven journeys always carry a real snapshot version.
  return {
    ...installation,
    taskFamilyId: fallbackTaskFamilyId,
    offerHash: fallbackOfferHash,
    worldSliceHash: fallbackWorldSliceHash,
    marketSnapshotVersion: 0,
    sourceContextHash: fallbackSourceContextHash,
    generationBatchId: fallbackGenerationBatchId,
  };
}

function fallbackRouteFromMap(input: {
  readonly taskType: string;
  readonly scenarioMapId: string;
  readonly availableWorldObjects: readonly JourneyAvailableWorldObject[];
}): JourneyTaskRoute {
  const region = input.availableWorldObjects.find((object) => object.id === input.scenarioMapId);
  if (!region) throw new Error("journey_task_fallback_map_missing");
  const location = input.availableWorldObjects.find((object) =>
    object.id !== region.id && ["location", "workplace", "commission", "objective"].includes(object.type)) ?? region;
  const people = input.availableWorldObjects.filter((object) =>
    object.id !== region.id && object.id !== location.id && ["npc", "agent"].includes(object.type));
  const otherObjects = input.availableWorldObjects.filter((object) =>
    object.id !== region.id && object.id !== location.id && !["npc", "agent"].includes(object.type));
  const supporting = [...people.slice(0, 3), ...otherObjects].slice(0, 5);
  const targetObjectIds = [...new Set([location.id, ...supporting.map((object) => object.id)])];
  const routeKey = `map_${input.scenarioMapId.replace(/[^a-z0-9_-]/giu, "_").toLocaleLowerCase("en-US")}`;
  const baseAction = (
    suffix: string,
    label: string,
    intent: string,
    outcomeSummary: string,
    risk: JourneyTaskRisk,
  ): JourneyTaskActionDefinition => ({
    optionKey: `${routeKey}_${suffix}`,
    label,
    intent,
    risk,
    allowedEffectKinds: ["journey_progress", "world_reference"],
    targetObjectIds,
    outcomeSummary,
    completesMission: true,
    chapterTitle: label,
    actionNarrative: intent,
  });
  return {
    routeKey,
    regionId: region.id,
    sceneType: "commission",
    title: `${input.taskType}：${location.label}`,
    premise: `${location.label}正在处理“${input.taskType}”，现场人员和可用对象均以本局地图为准。`,
    locationId: location.id,
    participantIds: supporting.filter((object) => ["npc", "agent"].includes(object.type)).map((object) => object.id),
    worldObjects: input.availableWorldObjects,
    actions: [
      baseAction(
        "execute",
        `在${location.label}按登记步骤完成现场事务`,
        `只使用${location.label}已经登记的对象，逐步执行并保留记录。`,
        `身份在${location.label}按登记步骤完成了现场事务，并留下可追溯记录。`,
        "medium",
      ),
      baseAction(
        "verify",
        `在${location.label}核验对象状态并提交记录`,
        `逐项核验${location.label}的地图对象，不补写未经证实的变化。`,
        `身份逐项核验了${location.label}的对象状态，并提交了对应记录。`,
        "low",
      ),
    ],
    safeFallbackOptionKey: `${routeKey}_skip`,
    mission: {
      briefing: `${location.label}需要有人完成“${input.taskType}”。`,
      primaryObjective: `在${location.label}完成“${input.taskType}”并取得现场认可的结果。`,
      completionCriteria: `${location.label}的执行步骤与对象状态均进入签名记录。`,
      successResult: `${location.label}现场处理记录`,
    },
  };
}

function selectedActionByObjective(
  plan: JourneyGeneratedTaskPlan,
  episodes: readonly JourneyTaskEvidenceEpisode[],
): ReadonlyMap<string, {
  readonly optionKey: string;
  readonly completionKind: "complete" | "failed" | "skip";
  readonly resolution?: JourneyActionResolution;
}> {
  const objectiveIds = new Set(plan.objectives.map((objective) => objective.objectiveId));
  return new Map(episodes.flatMap((episode) => {
    const objectiveId = episode.generatedTaskObjective?.objectiveId;
    const selectedAction = episode.serverFacts?.storyBeat?.selectedAction;
    const optionKey = selectedAction?.optionKey;
    const completionKind = selectedAction?.completionKind;
    const signedObjectiveId = selectedAction?.taskObjectiveId;
    return objectiveId
      && signedObjectiveId === objectiveId
      && optionKey
      && (completionKind === "complete" || completionKind === "failed" || completionKind === "skip")
      && objectiveIds.has(objectiveId)
      ? [[objectiveId, {
          optionKey,
          completionKind,
          ...(selectedAction.resolution?.authority === "server"
            && selectedAction.resolution.completionKind === completionKind
            ? { resolution: selectedAction.resolution }
            : {}),
        }] as const]
      : [];
  }));
}

function completedActionQualityBps(
  risk: JourneyTaskRisk,
  resolution: JourneyActionResolution | undefined,
): number {
  if (!resolution || resolution.completionKind !== "complete") return 0;
  if (resolution.outcome === "exceptional_success") return 10_000;
  if (resolution.outcome !== "success") return 0;
  const cap: Readonly<Record<JourneyTaskRisk, number>> = {
    low: 7_000,
    medium: 8_500,
    high: 9_500,
  };
  return Math.min(cap[risk], 5_500 + Math.max(0, Math.min(3_500, resolution.margin * 200)));
}

function journeyTaskPerformance(input: {
  readonly plan: JourneyGeneratedTaskPlan;
  readonly selected: ReturnType<typeof selectedActionByObjective>;
  readonly requiredMainObjectiveIds: readonly string[];
  readonly bonusMainObjectiveIds: readonly string[];
  readonly relevantSideObjectiveIds: readonly string[];
}): JourneyTaskPerformance {
  const mainSet = new Set(input.requiredMainObjectiveIds);
  const bonusMainSet = new Set(input.bonusMainObjectiveIds);
  const sideSet = new Set(input.relevantSideObjectiveIds);
  const relevant = input.plan.objectives.filter((objective) =>
    mainSet.has(objective.objectiveId)
      || bonusMainSet.has(objective.objectiveId)
      || sideSet.has(objective.objectiveId));
  const mainCompleted = input.requiredMainObjectiveIds.filter((objectiveId) =>
    input.selected.get(objectiveId)?.completionKind === "complete").length;
  const bonusMainCompleted = input.bonusMainObjectiveIds.filter((objectiveId) =>
    input.selected.get(objectiveId)?.completionKind === "complete").length;
  const sideCompleted = input.relevantSideObjectiveIds.filter((objectiveId) =>
    input.selected.get(objectiveId)?.completionKind === "complete").length;
  const completedByRisk: Record<JourneyTaskRisk, number> = { low: 0, medium: 0, high: 0 };
  const qualities: number[] = [];
  let exceptionalSuccesses = 0;
  let failedActions = 0;
  let skippedActions = 0;
  let paidResourceCosts = 0;
  let missingResolutionEvidence = 0;
  for (const objective of relevant) {
    const evidence = input.selected.get(objective.objectiveId);
    if (!evidence) continue;
    if (evidence.completionKind === "failed") failedActions += 1;
    if (evidence.completionKind === "skip") skippedActions += 1;
    if (evidence.completionKind !== "complete") continue;
    const action = objective.actions.find((candidate) => candidate.optionKey === evidence.optionKey);
    if (!action) continue;
    completedByRisk[action.risk] += 1;
    if (!evidence.resolution) missingResolutionEvidence += 1;
    if (evidence.resolution?.outcome === "exceptional_success") exceptionalSuccesses += 1;
    if (evidence.resolution?.resourceCost?.paid) paidResourceCosts += 1;
    qualities.push(completedActionQualityBps(action.risk, evidence.resolution));
  }
  const ratio = (count: number, total: number) => total > 0 ? Math.round(count / total * 10_000) : 0;
  const mainCompletionBps = ratio(mainCompleted, input.requiredMainObjectiveIds.length);
  const bonusMainCompletionBps = ratio(bonusMainCompleted, input.bonusMainObjectiveIds.length);
  const sideCompletionBps = ratio(sideCompleted, input.relevantSideObjectiveIds.length);
  const executionQualityBps = qualities.length
    ? Math.round(qualities.reduce((sum, quality) => sum + quality, 0) / qualities.length)
    : 0;
  const penaltyBps = failedActions * 750 + skippedActions * 250;
  const scoreBps = Math.max(0, Math.min(10_000, Math.round(
    mainCompletionBps * 0.6 + sideCompletionBps * 0.2 + executionQualityBps * 0.2 - penaltyBps,
  )));
  const perfectEligible = mainCompletionBps === 10_000
    && (input.bonusMainObjectiveIds.length === 0 || bonusMainCompletionBps === 10_000)
    && sideCompletionBps === 10_000
    && failedActions === 0
    && skippedActions === 0
    && missingResolutionEvidence === 0
    && exceptionalSuccesses > 0
    && executionQualityBps >= 7_500
    && scoreBps >= 9_400;
  const reasons = [
    `主线完成 ${mainCompleted}/${input.requiredMainObjectiveIds.length}`,
    ...(input.bonusMainObjectiveIds.length
      ? [`解锁主线完成 ${bonusMainCompleted}/${input.bonusMainObjectiveIds.length}`]
      : []),
    `支线完成 ${sideCompleted}/${input.relevantSideObjectiveIds.length}`,
    `执行质量 ${Math.round(executionQualityBps / 100)}%`,
    `卓越成功 ${exceptionalSuccesses} 次`,
    ...(failedActions ? [`失败行动 ${failedActions} 次`] : []),
    ...(skippedActions ? [`主动跳过 ${skippedActions} 次`] : []),
    ...(missingResolutionEvidence ? [`缺少服务端行动质量证据 ${missingResolutionEvidence} 项`] : []),
    perfectEligible ? "满足优秀评价条件" : "未满足优秀评价条件",
  ];
  return {
    version: JOURNEY_TASK_ADJUDICATION_VERSION,
    scoreBps,
    mainCompletionBps,
    bonusMainCompletionBps,
    sideCompletionBps,
    executionQualityBps,
    completedByRisk,
    exceptionalSuccesses,
    failedActions,
    skippedActions,
    paidResourceCosts,
    missingResolutionEvidence,
    perfectEligible,
    reasons,
  };
}

export interface JourneyTaskGraphState {
  readonly recordedObjectiveIds: readonly string[];
  readonly completedObjectiveIds: readonly string[];
  readonly selectedRouteIds: readonly string[];
  readonly activeRouteIds: readonly string[];
  readonly lockedRouteIds: readonly string[];
  readonly availableObjectiveIds: readonly string[];
  readonly requiredMainObjectiveIds: readonly string[];
  readonly bonusMainObjectiveIds: readonly string[];
  readonly relevantSideObjectiveIds: readonly string[];
}

/** Derives all route state from signed objective evidence; no mutable client route flag is trusted. */
export function journeyTaskGraphState(
  plan: JourneyGeneratedTaskPlan,
  episodes: readonly JourneyTaskEvidenceEpisode[],
): JourneyTaskGraphState {
  const selected = selectedActionByObjective(plan, episodes);
  const validSelection = (objective: JourneyGeneratedTaskObjective) => {
    const evidence = selected.get(objective.objectiveId);
    return evidence && (objective.actions.some((action) => action.optionKey === evidence.optionKey)
      || (evidence.completionKind === "skip" && evidence.optionKey === `skip_${objective.objectiveId}`))
      ? evidence
      : undefined;
  };
  const recordedObjectiveIds = plan.objectives
    .filter((objective) => validSelection(objective))
    .map((objective) => objective.objectiveId);
  const recorded = new Set(recordedObjectiveIds);
  const completedObjectiveIds = plan.objectives
    .filter((objective) => validSelection(objective)?.completionKind === "complete")
    .map((objective) => objective.objectiveId);
  const completed = new Set(completedObjectiveIds);
  const routes = plan.routes ?? [];
  const routeById = new Map(routes.map((route) => [route.routeId, route]));
  const routeIdByObjectiveId = new Map(routes.flatMap((route) =>
    route.objectiveIds.map((objectiveId) => [objectiveId, route.routeId] as const)));
  const selectedRouteIds = [...new Set(plan.objectives.flatMap((objective) => {
    const evidence = validSelection(objective);
    if (objective.kind !== "choice" || evidence?.completionKind !== "complete") return [];
    const routeId = objective.actions.find((action) => action.optionKey === evidence.optionKey)?.selectsRouteId;
    return routeId && routeById.get(routeId)?.kind === "choice" ? [routeId] : [];
  }))];
  const activeRouteIds = [...new Set([
    ...selectedRouteIds,
    ...routes.filter((route) => route.kind === "unlock"
      && route.unlockedByObjectiveIds.every((objectiveId) => completed.has(objectiveId)))
      .map((route) => route.routeId),
  ])];
  const activeRoutes = new Set(activeRouteIds);
  const lockedRouteIds = routes.filter((route) => !activeRoutes.has(route.routeId)).map((route) => route.routeId);
  const graph = routes.length > 0;
  const objectiveIsRelevant = (objective: JourneyGeneratedTaskObjective) => {
    const routeId = routeIdByObjectiveId.get(objective.objectiveId);
    if (routeId && !activeRoutes.has(routeId)) return false;
    return !(objective.prerequisiteObjectiveIds ?? []).some((prerequisiteId) => {
      const prerequisiteRouteId = routeIdByObjectiveId.get(prerequisiteId);
      return prerequisiteRouteId && !activeRoutes.has(prerequisiteRouteId);
    });
  };
  const requiredMainObjectiveIds = plan.objectives.filter((objective) =>
    (objective.kind === "main" || objective.kind === "choice")
      && objectiveIsRelevant(objective)
      && routeById.get(routeIdByObjectiveId.get(objective.objectiveId) ?? "")?.kind !== "unlock")
    .map((objective) => objective.objectiveId);
  const bonusMainObjectiveIds = plan.objectives.filter((objective) =>
    objective.kind === "main"
      && objectiveIsRelevant(objective)
      && routeById.get(routeIdByObjectiveId.get(objective.objectiveId) ?? "")?.kind === "unlock")
    .map((objective) => objective.objectiveId);
  const relevantSideObjectiveIds = plan.objectives.filter((objective) =>
    objective.kind === "side" && objectiveIsRelevant(objective))
    .map((objective) => objective.objectiveId);
  const availableObjectiveIds = graph
    ? plan.objectives.filter((objective) =>
        !recorded.has(objective.objectiveId)
        && objectiveIsRelevant(objective)
        && (objective.prerequisiteObjectiveIds ?? []).every((objectiveId) => completed.has(objectiveId)))
      .map((objective) => objective.objectiveId)
    : plan.objectives.filter((objective) => !recorded.has(objective.objectiveId)).slice(0, 1)
      .map((objective) => objective.objectiveId);
  return {
    recordedObjectiveIds,
    completedObjectiveIds,
    selectedRouteIds,
    activeRouteIds,
    lockedRouteIds,
    availableObjectiveIds,
    requiredMainObjectiveIds,
    bonusMainObjectiveIds,
    relevantSideObjectiveIds,
  };
}

export function nextJourneyTaskObjective(
  plan: JourneyGeneratedTaskPlan,
  episodes: readonly JourneyTaskEvidenceEpisode[],
): JourneyGeneratedTaskObjective | undefined {
  const nextId = journeyTaskGraphState(plan, episodes).availableObjectiveIds[0];
  return nextId ? plan.objectives.find((objective) => objective.objectiveId === nextId) : undefined;
}

export function adjudicateJourneyTask(input: {
  readonly plan: JourneyGeneratedTaskPlan;
  readonly episodes: readonly JourneyTaskEvidenceEpisode[];
  readonly hiddenTaskSeal?: JourneyHiddenTaskSeal;
  readonly revealHidden?: boolean;
}): JourneyTaskAdjudication {
  const selected = selectedActionByObjective(input.plan, input.episodes);
  const graphState = journeyTaskGraphState(input.plan, input.episodes);
  const completedObjectiveIds = graphState.completedObjectiveIds;
  const completed = new Set(completedObjectiveIds);
  const requiredMain = new Set(graphState.requiredMainObjectiveIds);
  const relevantSides = new Set(graphState.relevantSideObjectiveIds);
  const main = input.plan.objectives.filter((objective) => requiredMain.has(objective.objectiveId));
  const bonusMain = input.plan.objectives.filter((objective) =>
    graphState.bonusMainObjectiveIds.includes(objective.objectiveId));
  const sides = input.plan.objectives.filter((objective) => relevantSides.has(objective.objectiveId));
  const mainCompleted = main.filter((objective) => completed.has(objective.objectiveId)).length;
  const bonusMainCompleted = bonusMain.filter((objective) => completed.has(objective.objectiveId)).length;
  const sideCompleted = sides.filter((objective) => completed.has(objective.objectiveId)).length;
  const hidden = deriveJourneyHiddenTask(input.plan, input.hiddenTaskSeal);
  const hiddenCompleted = hidden.requiredActions.every((required) => {
    const action = selected.get(required.objectiveId);
    return action?.completionKind === "complete" && action.optionKey === required.optionKey;
  });
  const performance = input.plan.adjudicationVersion === JOURNEY_TASK_ADJUDICATION_VERSION
    ? journeyTaskPerformance({
        plan: input.plan,
        selected,
        requiredMainObjectiveIds: graphState.requiredMainObjectiveIds,
        bonusMainObjectiveIds: graphState.bonusMainObjectiveIds,
        relevantSideObjectiveIds: graphState.relevantSideObjectiveIds,
      })
    : undefined;
  const revealHidden = input.revealHidden === true;
  return {
    authority: "server",
    mainCompleted,
    mainTotal: main.length,
    bonusMainCompleted,
    bonusMainTotal: bonusMain.length,
    sideCompleted,
    sideTotal: sides.length,
    completedObjectiveIds,
    ...(performance ? { performance } : {}),
    hiddenTask: revealHidden
      ? {
        commitment: input.plan.hiddenTaskCommitment,
        revealed: true,
        completed: hiddenCompleted,
        description: hidden.description,
        requiredActions: hidden.requiredActions,
      }
      : {
        commitment: input.plan.hiddenTaskCommitment,
        revealed: false,
      },
  };
}

/**
 * Derive the legacy terminal tier for a journey task plan from its physical
 * adjudication components. This is the SAME derivation that used to live
 * inside {@link adjudicateJourneyTask}; it has been extracted so that
 * adjudicateJourneyTask no longer computes tier (PR4 spec: "adjudicateJourneyTask
 * 不再算 tier"). The authority tier for PR4 contract journeys lives on
 * {@link SettlementDecision.tier} (computed in deriveSettlementDecision).
 *
 * Callers that need a tier for non-PR4 contexts (e.g. the mission read model
 * for a terminal journey without a settlementDecision, or for tests asserting
 * the legacy tier mapping) SHOULD call this helper. PR4 code paths MUST NOT
 * call this — they read SettlementDecision.tier instead.
 *
 * The `revealHidden` flag mirrors the {@link adjudicateJourneyTask} input:
 * when false, a tier that would be `惊世` is masked down to `优秀` (the
 * hidden task seal stays unrevealed to the player).
 */
export function deriveLegacyTerminalTier(input: {
  readonly mainCompleted: number;
  readonly mainTotal: number;
  readonly sideCompleted: number;
  readonly sideTotal: number;
  readonly hiddenCompleted: boolean;
  readonly perfectEligible: boolean;
  readonly revealHidden: boolean;
}): JourneyCompletionTier {
  const terminalTier: JourneyCompletionTier = input.mainCompleted < input.mainTotal
    ? "未及格"
    : input.sideCompleted === 0
      ? "及格"
      : input.sideCompleted < input.sideTotal || !input.perfectEligible
        ? "良好"
        : input.hiddenCompleted
          ? "惊世"
          : "优秀";
  return input.revealHidden
    ? terminalTier
    : terminalTier === "惊世" ? "优秀" : terminalTier;
}

/**
 * Convenience wrapper: derive the legacy terminal tier from an already-built
 * {@link JourneyTaskAdjudication}. Reads the physical components (main/side
 * counts, hidden completion, performance) and forwards to
 * {@link deriveLegacyTerminalTier}. PR4 callers SHOULD NOT use this — read
 * {@link SettlementDecision.tier} directly.
 */
export function deriveLegacyTerminalTierFromAdjudication(
  adjudication: JourneyTaskAdjudication,
  revealHidden: boolean,
): JourneyCompletionTier {
  return deriveLegacyTerminalTier({
    mainCompleted: adjudication.mainCompleted,
    mainTotal: adjudication.mainTotal,
    sideCompleted: adjudication.sideCompleted,
    sideTotal: adjudication.sideTotal,
    hiddenCompleted: Boolean(adjudication.hiddenTask.completed),
    perfectEligible: adjudication.performance?.perfectEligible ?? false,
    revealHidden,
  });
}
