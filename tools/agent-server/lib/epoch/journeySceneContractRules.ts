import {
  RUNTIME_ACTION_SIGNATURE_ALGORITHM,
  runtimeActionKeyId,
  runtimeActionPublicKey,
  signRuntimeActionPayload,
  verifyRuntimeActionPayload,
} from "../runtimeActionSigning.ts";
import type { JourneyMandate } from "./journeyPolicyRules.ts";
import type { JourneySceneType } from "./journeySceneCatalog.ts";
import type { HostedActionOptionPayload } from "./events.ts";
import type { JourneyEpisodePhase } from "./journeySceneRules.ts";
import type {
  JourneyGeneratedTaskObjective,
  JourneyTaskGraphRoute,
} from "./journeyGeneratedTaskRules.ts";
import type { ApproachTag } from "./journeyStrategyRules.ts";
import {
  signedEnvelopeContentHash,
  stableSignedEnvelopeJson,
} from "./turnActionEnvelopeRules.ts";
import {
  journeyActionRiskTerms,
  type JourneyActionRiskTerms,
} from "./journeyActionResolutionRules.ts";
import type { JourneyActionObjectImpact } from "./journeyWorldImpactRules.ts";

export const JOURNEY_SCENE_CONTRACT_RULE_VERSION = "journey-scene-contract.v2";
export const JOURNEY_SCENE_ACTION_SIGNING_PURPOSE = "journey_scene_action";

export type JourneySceneActionRisk = "low" | "medium" | "high";

export type JourneySceneAllowedEffectKind =
  | "commission_offer"
  | "journey_progress"
  | "resource_delta"
  | "clue_created"
  | "relationship_signal"
  | "world_reference";

export interface JourneySceneContractWorldObject {
  readonly id: string;
  readonly type: string;
  readonly label: string;
  readonly sourceFactIds: readonly string[];
  readonly regionId?: string;
  readonly tags?: readonly string[];
}

export interface JourneyScenePublicEntityRef {
  readonly id: string;
  readonly type: string;
  readonly label: string;
}

export interface JourneySceneActionOption {
  readonly actionOptionId: string;
  readonly optionKey: string;
  readonly label: string;
  readonly intent: string;
  readonly risk: JourneySceneActionRisk;
  /** Server-owned risk terms, signature-bound on every contract. */
  readonly riskTerms: JourneyActionRiskTerms;
  readonly preconditionRefs: readonly string[];
  readonly allowedEffectKinds: readonly JourneySceneAllowedEffectKind[];
  readonly targetEntityIds: readonly string[];
  readonly outcomeSummary?: string;
  readonly taskObjectiveId?: string;
  readonly routeSelection?: {
    readonly routeId: string;
    readonly factionObjectId?: string;
  };
  /**
   * PR5b additive (journeyStrategyRules). Server-derived approach tags
   * observed for this signed action; copied verbatim from the originating
   * {@link JourneyGeneratedTaskAction.approachTags} when the scene contract
   * is built. The field IS serialised to clients on the public scene
   * contract (informational metadata; clients cannot mutate it to bypass
   * the roleplay check), but it is EXCLUDED from the action's signed
   * content (see {@link JourneySceneActionSignedContentInput.action} Pick
   * list) so a client cannot tamper with the tags and still produce a
   * valid signature. The roleplay-doubt hook in `submitHostedAction` reads
   * this field to classify the action against the identity's frozen
   * ExpectedLifePattern. Empty when no approach was observed.
   */
  readonly approachTags?: readonly ApproachTag[];
  /**
   * PR5c additive. Structured object-impact descriptor for this action.
   * INTERNAL-only — excluded from the signed content hash (like approachTags)
   * and from the public HostedActionOptionPayload. The mirror-mode submit
   * path reads this field to call planJourneyObjectImpactBlueprints.
   */
  readonly actionObjectImpact?: JourneyActionObjectImpact;
  readonly contentHash: `sha256:${string}`;
  readonly signatureAlgorithm: typeof RUNTIME_ACTION_SIGNATURE_ALGORITHM;
  readonly signatureVersion: 1;
  readonly signingPurpose: typeof JOURNEY_SCENE_ACTION_SIGNING_PURPOSE;
  readonly signingKeyId: string;
  readonly serverPublicKey: string;
  readonly signature: string;
}

export interface JourneySceneContract {
  readonly sceneId: string;
  readonly journeyId: string;
  readonly episodeId: string;
  readonly sceneType: JourneySceneType;
  readonly phase: JourneyEpisodePhase;
  readonly worldMode?: "mirror";
  readonly title: string;
  readonly premise: string;
  readonly location: JourneyScenePublicEntityRef;
  readonly participants: readonly JourneyScenePublicEntityRef[];
  readonly confirmedFactIds: readonly string[];
  readonly actionOptions: readonly JourneySceneActionOption[];
  readonly safeFallbackActionOptionId: string;
  readonly expectedVersion: number;
  readonly expiresAt: string;
  readonly ruleVersion: typeof JOURNEY_SCENE_CONTRACT_RULE_VERSION;
  readonly taskObjective?: {
    readonly objectiveId: string;
    readonly kind: "main" | "side" | "choice";
    readonly title: string;
    readonly objective: string;
    readonly completionCriteria: string;
    /** PR5c additive. Hidden prerequisite object ids for this objective. INTERNAL-only. */
    readonly hiddenPrerequisiteObjectIds?: readonly string[];
  };
}

export interface JourneySceneContractSeed {
  readonly seed: string;
  readonly journeyId: string;
  readonly episodeId: string;
  readonly sceneType: JourneySceneType;
  readonly phase: JourneyEpisodePhase;
  readonly worldMode?: "mirror";
  readonly title: string;
  readonly mandate: JourneyMandate;
  readonly worldObjects: readonly JourneySceneContractWorldObject[];
  readonly sourceFactIds: readonly string[];
  readonly expectedVersion: number;
  readonly generatedTaskObjective?: JourneyGeneratedTaskObjective;
  readonly taskRoutes?: readonly JourneyTaskGraphRoute[];
  /** Internal journey-level recall scene; it must never bind to a task objective. */
  readonly recallOnly?: boolean;
}

export interface JourneySceneContractBuildInput {
  readonly seed: string;
  readonly agentId: string;
  readonly journeyId: string;
  readonly episodeId: string;
  readonly sceneType: JourneySceneType;
  readonly phase?: JourneyEpisodePhase;
  readonly worldMode?: "mirror";
  readonly title: string;
  readonly mandate: JourneyMandate;
  readonly worldObjects: readonly JourneySceneContractWorldObject[];
  readonly sourceFactIds: readonly string[];
  readonly expectedVersion: number;
  readonly expiresAt: string;
  readonly ruleVersion?: typeof JOURNEY_SCENE_CONTRACT_RULE_VERSION;
  readonly generatedTaskObjective?: JourneyGeneratedTaskObjective;
  readonly taskRoutes?: readonly JourneyTaskGraphRoute[];
  /** Internal journey-level recall scene; it must never bind to a task objective. */
  readonly recallOnly?: boolean;
}

interface NormalizedWorldObject extends JourneySceneContractWorldObject {
  readonly regionId?: string;
  readonly tags: readonly string[];
}

interface ResolvedJourneySceneRecipe {
  readonly label: string;
  readonly intent: string;
  readonly targetObjects: readonly NormalizedWorldObject[];
}

function uniqueSorted(values: readonly string[]): readonly string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort();
}

function publicRef(object: JourneySceneContractWorldObject): JourneyScenePublicEntityRef {
  return { id: object.id, type: object.type, label: object.label };
}

interface JourneyTravelPhaseActionRecipe {
  readonly optionKey: string;
  readonly risk: JourneySceneActionRisk;
  readonly allowedEffectKinds: readonly JourneySceneAllowedEffectKind[];
  readonly label: (location: NormalizedWorldObject) => string;
  readonly intent: (location: NormalizedWorldObject) => string;
}

export const GENERIC_JOURNEY_ARRIVAL_ACTION_RECIPES: readonly JourneyTravelPhaseActionRecipe[] = [
  {
    optionKey: "enter_destination",
    risk: "low",
    allowedEffectKinds: ["journey_progress", "world_reference"],
    label: (location) => `沿已确认路线进入${location.label}`,
    intent: (location) => `沿服务器确认的路线抵达${location.label}，随后前往本局任务地点。`,
  },
  {
    optionKey: "review_arrival_route",
    risk: "low",
    allowedEffectKinds: ["journey_progress", "clue_created"],
    label: (location) => `在${location.label}入口复核来路与返程时间`,
    intent: (location) => `在${location.label}入口核对已确认路线和返程时间。`,
  },
  {
    optionKey: "turn_back_before_entry",
    risk: "low",
    allowedEffectKinds: ["journey_progress"],
    label: (location) => `在进入${location.label}前原路返回`,
    intent: (location) => `不进入${location.label}，沿已确认路线返回。`,
  },
];

export const GENERIC_JOURNEY_RETURN_ACTION_RECIPES: readonly JourneyTravelPhaseActionRecipe[] = [
  {
    optionKey: "return_by_known_route",
    risk: "low",
    allowedEffectKinds: ["journey_progress", "world_reference"],
    label: (location) => `沿已确认路线离开${location.label}返程`,
    intent: (location) => `只沿已确认路线离开${location.label}，不追加未经结算的遭遇。`,
  },
  {
    optionKey: "record_verified_facts",
    risk: "low",
    allowedEffectKinds: ["journey_progress", "clue_created"],
    label: (location) => `离开${location.label}前整理已核验记录`,
    intent: (location) => `只整理${location.label}之行已有 source facts，不把推测写成经历。`,
  },
  {
    optionKey: "wait_for_safe_departure",
    risk: "low",
    allowedEffectKinds: ["journey_progress"],
    label: (location) => `在${location.label}等待安全时机再返程`,
    intent: (location) => `不冒险改道，在${location.label}等待服务器确认的安全返程窗口。`,
  },
];

export function journeySceneHostedActionOptions(
  contract: JourneySceneContract,
): readonly HostedActionOptionPayload[] {
  return contract.actionOptions.map((action) => {
    const riskTerms = action.riskTerms;
    const costText = riskTerms.resourceCost
      ? `需消耗${riskTerms.resourceCost.resourceId === "stamina" ? "体力" : "专注"} ${riskTerms.resourceCost.amount}`
      : "无额外风险资源成本";
    const successText = riskTerms.successReward
      ? `成功另得金币 ${riskTerms.successReward.amount}`
      : "无独立风险报酬";
    const exceptionalText = riskTerms.exceptionalSuccessReward
      && riskTerms.exceptionalSuccessReward.amount !== riskTerms.successReward?.amount
      ? `，卓越成功可得金币 ${riskTerms.exceptionalSuccessReward.amount}`
      : "";
    const hiddenAdjudicationHint = action.risk === "high"
      ? "高风险会由服务端隐藏结算；携带或绑定的道具、装备、可用资源、身份状态和前序准备都可能改善判定，但客户端不会看到具体计算过程。"
      : "服务端会隐藏计算身份状态、资源、道具装备与前序准备；客户端只看到风险等级、成本和可验证收益。";
    return {
      actionOptionId: action.actionOptionId,
      optionKey: action.optionKey,
      label: action.label,
      risk: action.risk,
      explanation: {
        brief: action.intent,
        trigger: contract.premise,
        choiceReason: `服务器合同签发的具体行动是“${action.label}”，目标和前置事实不可由客户端改写。`,
        rejectedAlternatives: [
          "不采用客户端自行声明的结果、奖励或世界事实。",
          "不执行合同允许效果之外的状态变更。",
        ],
        risk: `${action.risk === "low" ? "低" : action.risk === "medium" ? "中" : "高"}风险；服务器只按签名合同结算。${hiddenAdjudicationHint}`,
        expectedBenefit: `${hostedActionOutcome(contract, action.optionKey)} 风险条款：${costText}；${successText}${exceptionalText}；失败不发放风险报酬。`,
      },
      outcomeSummary: hostedActionOutcome(contract, action.optionKey),
    };
  });
}

function hostedActionOutcome(contract: JourneySceneContract, optionKey: string): string {
  const generatedOutcome = contract.actionOptions.find((action) => action.optionKey === optionKey)?.outcomeSummary;
  if (generatedOutcome) return generatedOutcome;
  const place = contract.location.label;
  const genericTravelOutcomes: Readonly<Record<string, string>> = {
    enter_destination: `身份沿已确认路线抵达${place}入口，完成到达记录后进入该区域，并前往本局任务地点。`,
    review_arrival_route: `身份在${place}入口复核来路、抵达时间与返程窗口，随后保留到达记录。`,
    turn_back_before_entry: `身份在${place}入口停止前进，沿已确认路线返回；本局主要任务没有开始。`,
    return_by_known_route: `身份沿已确认路线离开${place}，带着本局已经结算的直接结果返程。`,
    record_verified_facts: `身份在离开${place}前整理本局已经结算的行动与结果，随后带着记录返程。`,
    wait_for_safe_departure: `身份在${place}等待安全返程窗口，窗口到来后沿已确认路线离开。`,
  };
  const outcome = genericTravelOutcomes[optionKey];
  if (!outcome) throw new Error(`journey_scene_action_outcome_missing:${optionKey}`);
  return outcome;
}

const GENERIC_JOURNEY_LABELS = new Set([
  "观察区域态势",
  "协助区域事务",
  "接触低阶异常",
]);

export function isJourneySceneActionLabelSpecific(
  label: string,
  knownEntityLabels: readonly string[],
): boolean {
  const normalized = label.trim();
  if (!normalized || GENERIC_JOURNEY_LABELS.has(normalized)) return false;
  return knownEntityLabels.some((entityLabel) => {
    const known = entityLabel.trim();
    return known.length > 0 && normalized.includes(known);
  });
}

function requiredText(value: string, errorCode: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(errorCode);
  return normalized;
}

function normalizedWorldObjects(
  objects: readonly JourneySceneContractWorldObject[],
): readonly NormalizedWorldObject[] {
  const seen = new Set<string>();
  return objects.map((object) => {
    const id = requiredText(object.id, "journey_scene_world_object_id_required");
    if (seen.has(id)) throw new Error("journey_scene_world_object_duplicate");
    seen.add(id);
    const sourceFactIds = uniqueSorted(object.sourceFactIds);
    if (!sourceFactIds.length) throw new Error("journey_scene_world_object_source_fact_required");
    return {
      id,
      type: requiredText(object.type, "journey_scene_world_object_type_required").toLocaleLowerCase("en-US"),
      label: requiredText(object.label, "journey_scene_world_object_label_required"),
      sourceFactIds,
      regionId: object.regionId?.trim() || undefined,
      tags: uniqueSorted(object.tags ?? []).map((tag) => tag.toLocaleLowerCase("en-US")),
    };
  }).sort((left, right) => left.id.localeCompare(right.id, "en-US"));
}

function normalizedMandate(mandate: JourneyMandate): JourneyMandate {
  return {
    objective: requiredText(mandate.objective, "journey_scene_mandate_objective_required"),
    priorities: uniqueSorted(mandate.priorities),
    avoid: uniqueSorted(mandate.avoid),
    preferredActivities: uniqueSorted(mandate.preferredActivities),
    socialPreference: mandate.socialPreference,
    returnCondition: mandate.returnCondition,
  };
}

function compactHash(value: unknown): string {
  return signedEnvelopeContentHash(value).slice("sha256:".length, "sha256:".length + 24);
}

interface JourneySceneActionSignedContentInput {
  readonly agentId: string;
  readonly sceneId: string;
  readonly expectedVersion: number;
  readonly expiresAt: string;
  readonly ruleVersion: string;
  readonly worldMode?: "mirror";
  readonly signatureVersion: 1;
  readonly signingPurpose: typeof JOURNEY_SCENE_ACTION_SIGNING_PURPOSE;
  readonly signingKeyId: string;
  readonly action: Pick<JourneySceneActionOption,
    "actionOptionId" | "optionKey" | "label" | "intent" | "risk" | "riskTerms" | "preconditionRefs" | "allowedEffectKinds" | "targetEntityIds" | "outcomeSummary" | "taskObjectiveId" | "routeSelection">;
}

export function journeySceneActionSignedContent(input: JourneySceneActionSignedContentInput) {
  return {
    actionOptionId: input.action.actionOptionId,
    agentId: input.agentId,
    allowedEffectKinds: input.action.allowedEffectKinds,
    expectedVersion: input.expectedVersion,
    expiresAt: input.expiresAt,
    intent: input.action.intent,
    label: input.action.label,
    optionKey: input.action.optionKey,
    outcomeSummary: input.action.outcomeSummary,
    preconditionRefs: input.action.preconditionRefs,
    risk: input.action.risk,
    ruleVersion: input.ruleVersion,
    ...(input.worldMode ? { worldMode: input.worldMode } : {}),
    sceneId: input.sceneId,
    signatureVersion: input.signatureVersion,
    signingKeyId: input.signingKeyId,
    signingPurpose: input.signingPurpose,
    targetEntityIds: input.action.targetEntityIds,
    taskObjectiveId: input.action.taskObjectiveId,
    routeSelection: input.action.routeSelection,
    riskTerms: input.action.riskTerms,
  };
}

function buildSignedAction(input: JourneySceneActionSignedContentInput): JourneySceneActionOption {
  const content = journeySceneActionSignedContent(input);
  const contentHash = signedEnvelopeContentHash(content);
  return {
    ...input.action,
    contentHash,
    signatureAlgorithm: RUNTIME_ACTION_SIGNATURE_ALGORITHM,
    signatureVersion: input.signatureVersion,
    signingPurpose: input.signingPurpose,
    signingKeyId: input.signingKeyId,
    serverPublicKey: runtimeActionPublicKey(),
    signature: signRuntimeActionPayload(Buffer.from(contentHash, "utf8")),
  };
}

export function verifyJourneySceneActionSignature(input: {
  readonly agentId: string;
  readonly contract: JourneySceneContract;
  readonly action: JourneySceneActionOption;
}): boolean {
  try {
    if (input.action.signatureAlgorithm !== RUNTIME_ACTION_SIGNATURE_ALGORITHM) return false;
    if (input.action.signingPurpose !== JOURNEY_SCENE_ACTION_SIGNING_PURPOSE) return false;
    if (input.action.signatureVersion !== 1) return false;
    if (!input.action.riskTerms) return false;
    const content = journeySceneActionSignedContent({
      agentId: input.agentId,
      sceneId: input.contract.sceneId,
      expectedVersion: input.contract.expectedVersion,
      expiresAt: input.contract.expiresAt,
      ruleVersion: input.contract.ruleVersion,
      worldMode: input.contract.worldMode,
      signatureVersion: input.action.signatureVersion,
      signingPurpose: input.action.signingPurpose,
      signingKeyId: input.action.signingKeyId,
      action: input.action,
    });
    const contentHash = signedEnvelopeContentHash(content);
    if (contentHash !== input.action.contentHash) return false;
    return verifyRuntimeActionPayload({
      payload: Buffer.from(contentHash, "utf8"),
      publicKey: input.action.serverPublicKey,
      keyId: input.action.signingKeyId,
      signature: input.action.signature,
    });
  } catch {
    return false;
  }
}

export function buildJourneySceneContract(input: JourneySceneContractBuildInput): JourneySceneContract {
  const phase = input.phase ?? "main";
  const recallOnly = input.recallOnly === true;
  if (phase !== "main" && phase !== "side" && input.sceneType !== "travel") {
    throw new Error("journey_scene_contract_phase_type_invalid");
  }
  const seed = requiredText(input.seed, "journey_scene_seed_required");
  const agentId = requiredText(input.agentId, "journey_scene_agent_id_required");
  const journeyId = requiredText(input.journeyId, "journey_scene_journey_id_required");
  const episodeId = requiredText(input.episodeId, "journey_scene_episode_id_required");
  const title = requiredText(input.title, "journey_scene_title_required");
  const ruleVersion = input.ruleVersion ?? JOURNEY_SCENE_CONTRACT_RULE_VERSION;
  if (ruleVersion !== JOURNEY_SCENE_CONTRACT_RULE_VERSION) {
    throw new Error("journey_scene_rule_version_unsupported");
  }
  if (!Number.isSafeInteger(input.expectedVersion) || input.expectedVersion < 0) {
    throw new Error("journey_scene_expected_version_invalid");
  }
  const expiresAtMs = Date.parse(input.expiresAt);
  if (!Number.isFinite(expiresAtMs)) throw new Error("journey_scene_expiry_invalid");
  const expiresAt = new Date(expiresAtMs).toISOString();
  const mandate = normalizedMandate(input.mandate);
  const worldObjects = normalizedWorldObjects(input.worldObjects);
  const groundedFacts = new Set(worldObjects.flatMap((object) => object.sourceFactIds));
  const confirmedFactIds = uniqueSorted(input.sourceFactIds);
  if (!confirmedFactIds.length) throw new Error("journey_scene_source_fact_required");
  if (confirmedFactIds.some((factId) => !groundedFacts.has(factId))) {
    throw new Error("journey_scene_source_fact_not_grounded");
  }
  const sceneRegion = worldObjects.find((object) => object.type === "region");
  if (!sceneRegion) throw new Error("journey_scene_region_required");
  const generatedTaskObjective = recallOnly ? undefined : input.generatedTaskObjective;
  if (recallOnly && input.generatedTaskObjective) {
    throw new Error("journey_recall_scene_task_objective_forbidden");
  }
  if (!recallOnly && (phase === "main" || phase === "side") && !generatedTaskObjective) {
    throw new Error("journey_generated_task_objective_required");
  }
  if (generatedTaskObjective && !["main", "side"].includes(phase)) {
    throw new Error("journey_generated_task_phase_invalid");
  }
  const taskRoutes = [...(recallOnly ? [] : (input.taskRoutes ?? []))]
    .map((route) => ({
      ...route,
      objectiveIds: uniqueSorted(route.objectiveIds),
      unlockedByObjectiveIds: uniqueSorted(route.unlockedByObjectiveIds),
    }))
    .sort((left, right) => left.routeId.localeCompare(right.routeId, "en-US"));
  const taskRoutesById = new Map(taskRoutes.map((route) => [route.routeId, route]));
  if ((phase === "main" || phase === "side") && generatedTaskObjective) {
    const objectivePhase = generatedTaskObjective.kind === "side" ? "side" : "main";
    if (objectivePhase !== phase || generatedTaskObjective.sceneType !== input.sceneType) {
      throw new Error("journey_generated_task_scene_mismatch");
    }
    if (generatedTaskObjective.worldObjectIds.some((objectId) => !worldObjects.some((object) => object.id === objectId))) {
      throw new Error("journey_generated_task_object_missing");
    }
  }
  const stateBinding = {
    seed,
    agentId,
    journeyId,
    episodeId,
    sceneType: input.sceneType,
    phase,
    worldMode: input.worldMode,
    title,
    mandate,
    worldObjects,
    confirmedFactIds,
    expectedVersion: input.expectedVersion,
    expiresAt,
    ruleVersion,
    ...(recallOnly ? { recallOnly: true } : {}),
    generatedTaskObjective,
    taskRoutes,
  };
  const sceneId = `scene_${compactHash(stateBinding)}`;
  const signedResolvedAction = (inputAction: {
    readonly optionKey: string;
    readonly risk: JourneySceneActionRisk;
    readonly allowedEffectKinds: readonly JourneySceneAllowedEffectKind[];
    readonly resolved: ResolvedJourneySceneRecipe;
    readonly outcomeSummary?: string;
    readonly taskObjectiveId?: string;
    readonly routeSelection?: JourneySceneActionOption["routeSelection"];
    readonly approachTags?: readonly ApproachTag[];
    readonly actionObjectImpact?: JourneyActionObjectImpact;
  }) => {
    const { resolved } = inputAction;
    const targetEntityIds = uniqueSorted(resolved.targetObjects.map((object) => object.id));
    const targetFacts = uniqueSorted(resolved.targetObjects.flatMap((object) => object.sourceFactIds)
      .filter((factId) => confirmedFactIds.includes(factId)));
    const preconditionRefs = targetFacts.length ? targetFacts : [confirmedFactIds[0]];
    const unsignedAction = {
      actionOptionId: "",
      optionKey: inputAction.optionKey,
      label: resolved.label,
      intent: resolved.intent,
      risk: inputAction.risk,
      riskTerms: journeyActionRiskTerms(inputAction.risk),
      preconditionRefs,
      allowedEffectKinds: inputAction.allowedEffectKinds,
      targetEntityIds,
      ...(inputAction.outcomeSummary ? { outcomeSummary: inputAction.outcomeSummary } : {}),
      ...(inputAction.taskObjectiveId ? { taskObjectiveId: inputAction.taskObjectiveId } : {}),
      ...(inputAction.routeSelection ? { routeSelection: inputAction.routeSelection } : {}),
      // PR5b: approachTags is INTERNAL — server-derived at task-action build
      // time and copied verbatim into the signed scene action. It is NOT part
      // of the action's signed content (see JourneySceneActionSignedContentInput.Pick),
      // so changing it does not invalidate the signature. The roleplay-doubt
      // hook reads it as audit-only metadata.
      ...(inputAction.approachTags && inputAction.approachTags.length > 0
        ? { approachTags: inputAction.approachTags }
        : {}),
      // PR5c: actionObjectImpact is INTERNAL — server-derived at task-action
      // build time. It is NOT part of the action's signed content (excluded
      // from JourneySceneActionSignedContentInput.Pick), so changing it does
      // not invalidate the signature. The mirror-mode submit path reads it
      // to call planJourneyObjectImpactBlueprints.
      ...(inputAction.actionObjectImpact
        ? { actionObjectImpact: inputAction.actionObjectImpact }
        : {}),
    } as const;
    const actionOptionId = `action_${compactHash({ sceneId, ...unsignedAction, actionOptionId: undefined })}`;
    return buildSignedAction({
      agentId,
      sceneId,
      expectedVersion: input.expectedVersion,
      expiresAt,
      ruleVersion,
      worldMode: input.worldMode,
      signatureVersion: 1,
      signingPurpose: JOURNEY_SCENE_ACTION_SIGNING_PURPOSE,
      signingKeyId: runtimeActionKeyId(),
      action: { ...unsignedAction, actionOptionId },
    });
  };
  const travelRecipes = phase === "arrival"
    ? GENERIC_JOURNEY_ARRIVAL_ACTION_RECIPES
    : GENERIC_JOURNEY_RETURN_ACTION_RECIPES;
  const actionOptions = recallOnly
    ? [signedResolvedAction({
        optionKey: "recall_without_objective",
        risk: "low",
        allowedEffectKinds: ["journey_progress"],
        outcomeSummary: `服务器记录身份从${sceneRegion.label}安全离开；本次主线任务未完成。`,
        resolved: {
          label: `接受召回并从${sceneRegion.label}安全离开`,
          intent: `不再执行当前任务动作，保留现有事实并结束本次旅程。`,
          targetObjects: [sceneRegion],
        },
      })]
    : generatedTaskObjective
      ? [
          ...generatedTaskObjective.actions.map((action) => {
            const selectedRoute = action.selectsRouteId
              ? taskRoutesById.get(action.selectsRouteId)
              : undefined;
            if (action.selectsRouteId && !selectedRoute) {
              throw new Error("journey_generated_task_route_missing");
            }
            if (selectedRoute?.factionObjectId
              && !action.targetObjectIds.includes(selectedRoute.factionObjectId)) {
              throw new Error("journey_generated_task_route_faction_not_targeted");
            }
            return signedResolvedAction({
              optionKey: action.optionKey,
              risk: action.risk,
              allowedEffectKinds: action.allowedEffectKinds,
              outcomeSummary: action.outcomeSummary,
              taskObjectiveId: generatedTaskObjective.objectiveId,
              ...(selectedRoute ? { routeSelection: {
                routeId: selectedRoute.routeId,
                ...(selectedRoute.factionObjectId
                  ? { factionObjectId: selectedRoute.factionObjectId }
                  : {}),
              } } : {}),
              // PR5b: forward server-derived approach tags so the roleplay
              // hook can read them off the signed action.
              ...(action.approachTags && action.approachTags.length > 0
                ? { approachTags: action.approachTags }
                : {}),
              // PR5c: forward object impact metadata so the mirror-mode
              // submit path can call planJourneyObjectImpactBlueprints.
              ...(action.objectImpact
                ? { actionObjectImpact: action.objectImpact }
                : {}),
              resolved: {
                label: action.label,
                intent: action.intent,
                targetObjects: action.targetObjectIds.map((objectId) =>
                  worldObjects.find((object) => object.id === objectId) as NormalizedWorldObject),
              },
            });
          }),
        ]
    : travelRecipes.map((recipe) => signedResolvedAction({
        optionKey: recipe.optionKey,
        risk: recipe.risk,
        allowedEffectKinds: recipe.allowedEffectKinds,
        resolved: {
          label: recipe.label(sceneRegion),
          intent: recipe.intent(sceneRegion),
          targetObjects: [sceneRegion],
        },
      }));
  const location = recallOnly
    ? sceneRegion
    : generatedTaskObjective
    ? worldObjects.find((object) => object.id === generatedTaskObjective.locationId) as NormalizedWorldObject
    : sceneRegion;
  const safeFallbackOptionKey = recallOnly
    ? "recall_without_objective"
    : phase === "arrival"
    ? "turn_back_before_entry"
    : phase === "return"
      ? "wait_for_safe_departure"
      : generatedTaskObjective
        ? actionOptions[0]?.optionKey ?? "leave_without_commitment"
      : "wait_for_safe_departure";
  return {
    sceneId,
    journeyId,
    episodeId,
    sceneType: input.sceneType,
    phase,
    ...(input.worldMode ? { worldMode: input.worldMode } : {}),
    title,
    premise: recallOnly
      ? `身份在${sceneRegion.label}接到服务器召回指令；本次任务不再执行，现有事实仅作为未完成记录保留。`
      : generatedTaskObjective
      ? `${generatedTaskObjective.objective} 完成条件：${generatedTaskObjective.completionCriteria}`
      : phase === "arrival"
        ? `身份已抵达${sceneRegion.label}入口；只能从服务器签发的到达行动中选择。此行目标：${mandate.objective}。`
        : `身份准备从${sceneRegion.label}返程；只能整理已核验事实并选择已确认路线。`,
    location: publicRef(location),
    participants: recallOnly
      ? []
      : generatedTaskObjective
      ? worldObjects.filter((object) => generatedTaskObjective.worldObjectIds.includes(object.id)
          && ["npc", "agent", "group", "organization"].includes(object.type)).map(publicRef)
      : [],
    confirmedFactIds,
    actionOptions,
    safeFallbackActionOptionId: actionOptions.find((action) => action.optionKey === safeFallbackOptionKey)
      ?.actionOptionId ?? actionOptions[0].actionOptionId,
    expectedVersion: input.expectedVersion,
    expiresAt,
    ruleVersion,
    ...(generatedTaskObjective ? { taskObjective: {
      objectiveId: generatedTaskObjective.objectiveId,
      kind: generatedTaskObjective.kind,
      title: generatedTaskObjective.title,
      objective: generatedTaskObjective.objective,
      completionCriteria: generatedTaskObjective.completionCriteria,
      ...(generatedTaskObjective.hiddenPrerequisiteObjectIds
        ? { hiddenPrerequisiteObjectIds: generatedTaskObjective.hiddenPrerequisiteObjectIds }
        : {}),
    } } : {}),
  };
}

// Keep the canonical serializer reachable for callers that need to persist the exact
// deterministic scene binding without inventing a second object-key ordering rule.
export function stableJourneySceneContractJson(contract: JourneySceneContract): string {
  return stableSignedEnvelopeJson(contract);
}
