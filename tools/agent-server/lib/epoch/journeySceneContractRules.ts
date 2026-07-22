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
import {
  journeyTaskActionForOptionKey,
  journeyTaskRouteForRegion,
  type JourneyTaskRoute,
} from "./journeyTaskCatalog.ts";
import {
  signedEnvelopeContentHash,
  stableSignedEnvelopeJson,
} from "./turnActionEnvelopeRules.ts";
import {
  journeyActionRiskTerms,
  type JourneyActionRiskTerms,
} from "./journeyActionResolutionRules.ts";

export const JOURNEY_SCENE_CONTRACT_RULE_VERSION = "journey-scene-contract.v2";
const LEGACY_JOURNEY_SCENE_CONTRACT_RULE_VERSION = "journey-scene-contract.v1";
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
  /** Present and signature-bound on v2 contracts; omitted only on persisted v1 contracts. */
  readonly riskTerms?: JourneyActionRiskTerms;
  readonly preconditionRefs: readonly string[];
  readonly allowedEffectKinds: readonly JourneySceneAllowedEffectKind[];
  readonly targetEntityIds: readonly string[];
  readonly outcomeSummary?: string;
  readonly taskObjectiveId?: string;
  readonly completionKind?: "complete" | "skip";
  readonly routeSelection?: {
    readonly routeId: string;
    readonly factionObjectId?: string;
  };
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
  /** Missing on persisted legacy contracts; new Agent-native journeys use an isolated mirror. */
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
  readonly ruleVersion: string;
  readonly taskObjective?: {
    readonly objectiveId: string;
    readonly kind: "main" | "side" | "choice";
    readonly title: string;
    readonly objective: string;
    readonly completionCriteria: string;
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
  readonly ruleVersion?: string;
  readonly generatedTaskObjective?: JourneyGeneratedTaskObjective;
  readonly taskRoutes?: readonly JourneyTaskGraphRoute[];
}

interface NormalizedWorldObject extends JourneySceneContractWorldObject {
  readonly regionId?: string;
  readonly tags: readonly string[];
}

interface GrayHarborLivelihoodContext {
  readonly location: NormalizedWorldObject;
  readonly organization: NormalizedWorldObject;
  readonly clerk: NormalizedWorldObject;
  readonly ledger?: NormalizedWorldObject;
  readonly manifest?: NormalizedWorldObject;
  readonly confirmedFactIds: readonly string[];
}

interface JourneyTaskRouteContext {
  readonly route: JourneyTaskRoute;
  readonly location: NormalizedWorldObject;
  readonly participants: readonly NormalizedWorldObject[];
  readonly objectsById: ReadonlyMap<string, NormalizedWorldObject>;
}

interface ResolvedJourneySceneRecipe {
  readonly label: string;
  readonly intent: string;
  readonly targetObjects: readonly NormalizedWorldObject[];
}

export interface GrayHarborLivelihoodActionRecipe {
  readonly optionKey: string;
  readonly risk: JourneySceneActionRisk;
  readonly allowedEffectKinds: readonly JourneySceneAllowedEffectKind[];
  readonly resolve: (context: GrayHarborLivelihoodContext) => ResolvedJourneySceneRecipe;
}

function uniqueSorted(values: readonly string[]): readonly string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort();
}

function publicRef(object: JourneySceneContractWorldObject): JourneyScenePublicEntityRef {
  return { id: object.id, type: object.type, label: object.label };
}

function tagMatches(object: NormalizedWorldObject, values: readonly string[]): boolean {
  const search = `${object.label} ${object.tags.join(" ")}`.toLocaleLowerCase("en-US");
  return values.some((value) => search.includes(value));
}

function objectsForRecipe(...objects: readonly (NormalizedWorldObject | undefined)[]): readonly NormalizedWorldObject[] {
  const seen = new Set<string>();
  return objects.filter((object): object is NormalizedWorldObject => {
    if (!object || seen.has(object.id)) return false;
    seen.add(object.id);
    return true;
  });
}

export const GRAY_HARBOR_LIVELIHOOD_ACTION_RECIPES: readonly GrayHarborLivelihoodActionRecipe[] = [
  {
    optionKey: "ask_for_shift",
    risk: "low",
    allowedEffectKinds: ["commission_offer", "journey_progress", "relationship_signal"],
    resolve: ({ location, organization, clerk }) => ({
      label: `向${clerk.label}询问${organization.label}在${location.label}的当日短工`,
      intent: `只询问${organization.label}已登记的班次与条件，不擅自开工。`,
      targetObjects: objectsForRecipe(clerk, organization, location),
    }),
  },
  {
    optionKey: "verify_salt_ledger",
    risk: "low",
    allowedEffectKinds: ["journey_progress", "clue_created", "resource_delta"],
    resolve: ({ location, organization, ledger }) => ({
      label: `在${location.label}核对${ledger?.label ?? `${organization.label}的盐票账目`}`,
      intent: `按${organization.label}的登记记录逐项核对，只报告可验证的差额。`,
      targetObjects: objectsForRecipe(location, organization, ledger),
    }),
  },
  {
    optionKey: "carry_manifest",
    risk: "medium",
    allowedEffectKinds: ["journey_progress", "resource_delta", "world_reference"],
    resolve: ({ organization, clerk, manifest }) => ({
      label: `为${organization.label}向${clerk.label}递送${manifest?.label ?? "当日货物清单"}`,
      intent: `仅递送${organization.label}已登记的清单，不代替收货人确认内容。`,
      targetObjects: objectsForRecipe(organization, clerk, manifest),
    }),
  },
  {
    optionKey: "ask_about_recent_travelers",
    risk: "low",
    allowedEffectKinds: ["journey_progress", "clue_created", "relationship_signal"],
    resolve: ({ location, clerk }) => ({
      label: `向${clerk.label}询问${location.label}近日登记的旅人消息`,
      intent: `只记录${clerk.label}能从公开登记中确认的旅人消息。`,
      targetObjects: objectsForRecipe(clerk, location),
    }),
  },
  {
    optionKey: "report_discrepancy",
    risk: "medium",
    allowedEffectKinds: ["journey_progress", "clue_created", "relationship_signal", "world_reference"],
    resolve: ({ organization, clerk, manifest }) => ({
      label: `向${clerk.label}报告${manifest?.label ?? `${organization.label}登记清单`}的差额`,
      intent: `把差额交给${clerk.label}复核，不把未确认猜测写入世界事实。`,
      targetObjects: objectsForRecipe(clerk, organization, manifest),
    }),
  },
  {
    optionKey: "leave_without_commitment",
    risk: "low",
    allowedEffectKinds: ["journey_progress"],
    resolve: ({ location, clerk }) => ({
      label: `向${clerk.label}说明后离开${location.label}，不承诺接工`,
      intent: `不接受尚未核实的条件，从${location.label}安全返回。`,
      targetObjects: objectsForRecipe(clerk, location),
    }),
  },
];

interface GrayHarborTravelPhaseActionRecipe {
  readonly optionKey: string;
  readonly risk: JourneySceneActionRisk;
  readonly allowedEffectKinds: readonly JourneySceneAllowedEffectKind[];
  readonly label: (location: NormalizedWorldObject) => string;
  readonly intent: (location: NormalizedWorldObject) => string;
}

export const GRAY_HARBOR_ARRIVAL_ACTION_RECIPES: readonly GrayHarborTravelPhaseActionRecipe[] = [
  {
    optionKey: "enter_gray_harbor",
    risk: "low",
    allowedEffectKinds: ["journey_progress", "world_reference"],
    label: (location) => `沿登记路线进入${location.label}`,
    intent: (location) => `只沿服务器确认的路线进入${location.label}，不声明途中出现额外事件。`,
  },
  {
    optionKey: "review_arrival_route",
    risk: "low",
    allowedEffectKinds: ["journey_progress", "clue_created"],
    label: (location) => `在${location.label}入口复核来路与返程时间`,
    intent: (location) => `在${location.label}入口核对已确认路线和时间，不扩写世界事实。`,
  },
  {
    optionKey: "turn_back_before_entry",
    risk: "low",
    allowedEffectKinds: ["journey_progress"],
    label: (location) => `在进入${location.label}前原路返回`,
    intent: (location) => `不接受新承诺，从${location.label}入口安全返回。`,
  },
];

export const GENERIC_JOURNEY_ARRIVAL_ACTION_RECIPES: readonly GrayHarborTravelPhaseActionRecipe[] = [
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

export const GENERIC_JOURNEY_MAIN_ACTION_RECIPES: readonly GrayHarborTravelPhaseActionRecipe[] = [
  {
    optionKey: "inspect_confirmed_scene",
    risk: "low",
    allowedEffectKinds: ["journey_progress", "clue_created"],
    label: (location) => `在${location.label}核验当前可见环境与已确认线索`,
    intent: (location) => `只记录${location.label}已有 source facts，不把推测写成世界事实。`,
  },
  {
    optionKey: "advance_mandate_carefully",
    risk: "medium",
    allowedEffectKinds: ["journey_progress", "world_reference"],
    label: (location) => `在${location.label}沿已确认路径谨慎推进当前目标`,
    intent: (location) => `围绕本局 mandate 在${location.label}推进一步，不声明未由服务器结算的成果。`,
  },
  {
    optionKey: "leave_without_commitment",
    risk: "low",
    allowedEffectKinds: ["journey_progress"],
    label: (location) => `离开${location.label}，不接受未经核验的承诺`,
    intent: (location) => `保留已确认记录并从${location.label}安全退出，不虚构任务完成。`,
  },
];

export const GRAY_HARBOR_RETURN_ACTION_RECIPES: readonly GrayHarborTravelPhaseActionRecipe[] = [
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

interface GrayHarborRelationshipActionRecipe {
  readonly optionKey: string;
  readonly risk: JourneySceneActionRisk;
  readonly allowedEffectKinds: readonly JourneySceneAllowedEffectKind[];
  readonly label: (participant: NormalizedWorldObject, location: NormalizedWorldObject) => string;
  readonly intent: (participant: NormalizedWorldObject, location: NormalizedWorldObject) => string;
}

export const GRAY_HARBOR_RELATIONSHIP_ACTION_RECIPES: readonly GrayHarborRelationshipActionRecipe[] = [
  {
    optionKey: "greet_participant",
    risk: "low",
    allowedEffectKinds: ["journey_progress", "relationship_signal"],
    label: (participant, location) => `在${location.label}向${participant.label}礼貌问候`,
    intent: (participant) => `只向${participant.label}发出不带承诺的问候，不替对方作出回应。`,
  },
  {
    optionKey: "exchange_public_news",
    risk: "low",
    allowedEffectKinds: ["journey_progress", "relationship_signal", "world_reference"],
    label: (participant, location) => `在${location.label}与${participant.label}交换公开消息`,
    intent: (participant) => `只交换服务器已有的公开消息，不把${participant.label}的私密信息写入世界。`,
  },
  {
    optionKey: "leave_conversation",
    risk: "low",
    allowedEffectKinds: ["journey_progress"],
    label: (participant, location) => `向${participant.label}告别并离开${location.label}`,
    intent: (participant) => `不要求${participant.label}继续互动，安全结束本次会面。`,
  },
];

const GRAY_HARBOR_LIVELIHOOD_OUTCOMES: Readonly<Record<string, string>> = {
  enter_gray_harbor: "身份沿登记路线通过灰港入口；来路与抵达信息被写入入口记录，确认无误后才进入城区。",
  review_arrival_route: "身份停在灰港入口复核来路、抵达时间与预定返程窗口；记录完成后，没有把途中未发生的遭遇补进旅程。",
  turn_back_before_entry: "身份在灰港入口核对现状后决定不再入城，沿原路返程，也没有接受任何新的工作或关系承诺。",
  ask_for_shift: "夜班书记珂岚查阅灰港民务所的当日登记，指出一项仍需本人确认工时与条件的短工班次，并把对应登记留作后续核对。",
  verify_salt_ledger: "在夜班书记珂岚当班的账房里，身份依照灰港民务所登记逐项核对灰港盐票账册；发现差额后只标记原条目与对应记录，没有作未经证实的归因，复核结果被保留为可追溯记录。",
  carry_manifest: "身份把药品运送清单送到夜班书记珂岚手中；清单内容、递送人和当班接收人都完成登记，没有替收货方虚构验收结果。",
  ask_about_recent_travelers: "身份向夜班书记珂岚询问近日旅人，珂岚只核对公开登记里已经出现的姓名与来路；无法确认的传闻被留在记录之外。",
  report_discrepancy: "身份把药品运送清单中的差额指给夜班书记珂岚，并对应到灰港民务所的原始登记；差额进入复核流程，原因仍保持未确认。",
  leave_without_commitment: "身份向夜班书记珂岚说明不接受尚未核实的条件，随后安全离开灰港民务账房；本次会面没有生成工作、报酬或长期关系承诺。",
  return_by_known_route: "身份沿已确认路线离开灰港；入口记录与返程方向完成对应后，旅程进入归途，没有追加新的途中事件。",
  record_verified_facts: "身份在离开灰港前依次整理抵达记录、主事件行动和直接后果，只把能够对应来源事件的内容带回归档。",
  wait_for_safe_departure: "身份留在灰港等待已确认的安全返程窗口，窗口到来后沿登记路线离开，没有冒险改道。",
  greet_participant: "身份在灰港向对方作了礼貌问候；会面被记录为一次不附带请求、交易或关系承诺的接触。",
  exchange_public_news: "双方只交换了服务器已经公开的地区消息；对话结束时，没有把私密信息、推测或替对方作出的表态写入记录。",
  leave_conversation: "身份向对方告别并结束会面；双方没有新增承诺，身份随后按原定安排离开现场。",
};

export function journeySceneHostedActionOptions(
  contract: JourneySceneContract,
): readonly HostedActionOptionPayload[] {
  return contract.actionOptions.map((action) => {
    const riskTerms = action.riskTerms ?? journeyActionRiskTerms(action.risk);
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
  const taskOutcome = journeyTaskActionForOptionKey(optionKey)?.outcomeSummary;
  if (taskOutcome) return taskOutcome;
  const place = contract.location.label;
  const genericTravelOutcomes: Readonly<Record<string, string>> = {
    enter_destination: `身份沿已确认路线抵达${place}入口，完成到达记录后进入该区域，并前往本局任务地点。`,
    review_arrival_route: `身份在${place}入口复核来路、抵达时间与返程窗口，随后保留到达记录。`,
    turn_back_before_entry: `身份在${place}入口停止前进，沿已确认路线返回；本局主要任务没有开始。`,
    return_by_known_route: `身份沿已确认路线离开${place}，带着本局已经结算的直接结果返程。`,
    record_verified_facts: `身份在离开${place}前整理本局已经结算的行动与结果，随后带着记录返程。`,
    wait_for_safe_departure: `身份在${place}等待安全返程窗口，窗口到来后沿已确认路线离开。`,
  };
  const legacyOutcome = GRAY_HARBOR_LIVELIHOOD_OUTCOMES[optionKey];
  if (contract.location.id === "region_gray_harbor" && legacyOutcome) return legacyOutcome;
  return genericTravelOutcomes[optionKey]
    ?? legacyOutcome
    ?? "服务器记录了一次符合场景合同的旅程行动。";
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

function grayHarborContext(
  objects: readonly NormalizedWorldObject[],
  confirmedFactIds: readonly string[],
): GrayHarborLivelihoodContext {
  const region = objects.find((object) => object.type === "region"
    && (object.id === "region_gray_harbor" || object.label === "灰港"));
  const organization = objects.find((object) => object.type === "organization"
    && (object.regionId === region?.id || tagMatches(object, ["livelihood", "employer", "民务"])));
  const clerk = objects.find((object) => object.type === "npc"
    && (object.regionId === region?.id || tagMatches(object, ["clerk", "书记"])));
  const location = objects.find((object) => ["location", "workplace"].includes(object.type)
    && (object.regionId === region?.id || tagMatches(object, ["workplace", "livelihood", "账房"]))) ?? region;
  if (!region || !organization || !clerk || !location) {
    throw new Error("gray_harbor_livelihood_scene_incomplete");
  }
  return {
    location,
    organization,
    clerk,
    ledger: objects.find((object) => tagMatches(object, ["salt_ledger", "bookkeeping", "盐票", "账册"])),
    manifest: objects.find((object) => tagMatches(object, ["medicine_manifest", "cargo_manifest", "药品", "清单"])),
    confirmedFactIds,
  };
}

function journeyTaskContext(
  objects: readonly NormalizedWorldObject[],
  route: JourneyTaskRoute,
): JourneyTaskRouteContext {
  const objectsById = new Map(objects.map((object) => [object.id, object]));
  const location = objectsById.get(route.locationId);
  if (!location) throw new Error(`journey_task_scene_location_missing:${route.routeKey}`);
  const requiredObjectIds = uniqueSorted(route.actions.flatMap((action) => action.targetObjectIds));
  if (requiredObjectIds.some((objectId) => !objectsById.has(objectId))) {
    throw new Error(`journey_task_scene_object_missing:${route.routeKey}`);
  }
  const participants = route.participantIds.map((participantId) => objectsById.get(participantId))
    .filter((object): object is NormalizedWorldObject => Boolean(object));
  if (participants.length !== route.participantIds.length) {
    throw new Error(`journey_task_scene_participant_missing:${route.routeKey}`);
  }
  return { route, location, participants, objectsById };
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
    "actionOptionId" | "optionKey" | "label" | "intent" | "risk" | "riskTerms" | "preconditionRefs" | "allowedEffectKinds" | "targetEntityIds" | "outcomeSummary" | "taskObjectiveId" | "completionKind" | "routeSelection">;
}

export function journeySceneActionSignedContent(input: JourneySceneActionSignedContentInput) {
  if (input.ruleVersion === LEGACY_JOURNEY_SCENE_CONTRACT_RULE_VERSION) {
    return {
      actionOptionId: input.action.actionOptionId,
      agentId: input.agentId,
      allowedEffectKinds: input.action.allowedEffectKinds,
      expectedVersion: input.expectedVersion,
      expiresAt: input.expiresAt,
      intent: input.action.intent,
      label: input.action.label,
      optionKey: input.action.optionKey,
      preconditionRefs: input.action.preconditionRefs,
      risk: input.action.risk,
      ruleVersion: input.ruleVersion,
      sceneId: input.sceneId,
      signatureVersion: input.signatureVersion,
      signingKeyId: input.signingKeyId,
      signingPurpose: input.signingPurpose,
      targetEntityIds: input.action.targetEntityIds,
    };
  }
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
    completionKind: input.action.completionKind,
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
    if (input.contract.ruleVersion !== LEGACY_JOURNEY_SCENE_CONTRACT_RULE_VERSION
      && !input.action.riskTerms) return false;
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
  if (phase !== "main" && phase !== "side" && input.sceneType !== "travel") {
    throw new Error("journey_scene_contract_phase_type_invalid");
  }
  const seed = requiredText(input.seed, "journey_scene_seed_required");
  const agentId = requiredText(input.agentId, "journey_scene_agent_id_required");
  const journeyId = requiredText(input.journeyId, "journey_scene_journey_id_required");
  const episodeId = requiredText(input.episodeId, "journey_scene_episode_id_required");
  const title = requiredText(input.title, "journey_scene_title_required");
  const ruleVersion = requiredText(input.ruleVersion ?? JOURNEY_SCENE_CONTRACT_RULE_VERSION,
    "journey_scene_rule_version_required");
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
  const taskRoute = journeyTaskRouteForRegion(sceneRegion.id);
  const generatedTaskObjective = input.generatedTaskObjective;
  const taskRoutes = [...(input.taskRoutes ?? [])]
    .map((route) => ({
      ...route,
      objectiveIds: uniqueSorted(route.objectiveIds),
      unlockedByObjectiveIds: uniqueSorted(route.unlockedByObjectiveIds),
    }))
    .sort((left, right) => left.routeId.localeCompare(right.routeId, "en-US"));
  const taskRoutesById = new Map(taskRoutes.map((route) => [route.routeId, route]));
  const legacyGrayHarborScene = sceneRegion.id === "region_gray_harbor";
  if ((phase === "main" || phase === "side") && generatedTaskObjective) {
    const objectivePhase = generatedTaskObjective.kind === "side" ? "side" : "main";
    if (objectivePhase !== phase || generatedTaskObjective.sceneType !== input.sceneType) {
      throw new Error("journey_generated_task_scene_mismatch");
    }
    if (generatedTaskObjective.worldObjectIds.some((objectId) => !worldObjects.some((object) => object.id === objectId))) {
      throw new Error("journey_generated_task_object_missing");
    }
  }
  if (phase === "main" && !generatedTaskObjective && taskRoute && taskRoute.sceneType !== input.sceneType) {
    throw new Error("journey_task_scene_type_mismatch");
  }
  if (phase === "main" && !generatedTaskObjective && legacyGrayHarborScene && !["livelihood", "relationship"].includes(input.sceneType)) {
    throw new Error("journey_scene_contract_type_not_supported");
  }
  const context = phase === "main" && !generatedTaskObjective && legacyGrayHarborScene && input.sceneType === "livelihood"
    ? grayHarborContext(worldObjects, confirmedFactIds)
    : undefined;
  const taskContext = phase === "main" && !generatedTaskObjective && taskRoute
    ? journeyTaskContext(worldObjects, taskRoute)
    : undefined;
  const relationshipParticipant = phase === "main" && !generatedTaskObjective && legacyGrayHarborScene && input.sceneType === "relationship"
    ? worldObjects.find((object) => ["agent", "npc"].includes(object.type))
    : undefined;
  if (phase === "main" && legacyGrayHarborScene && input.sceneType === "relationship" && !relationshipParticipant) {
    throw new Error("gray_harbor_relationship_scene_incomplete");
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
    generatedTaskObjective,
    taskRoutes,
  };
  const sceneId = `scene_${compactHash(stateBinding)}`;
  const knownLabels = worldObjects.map((object) => object.label);
  const signedResolvedAction = (inputAction: {
    readonly optionKey: string;
    readonly risk: JourneySceneActionRisk;
    readonly allowedEffectKinds: readonly JourneySceneAllowedEffectKind[];
    readonly resolved: ResolvedJourneySceneRecipe;
    readonly outcomeSummary?: string;
    readonly taskObjectiveId?: string;
    readonly completionKind?: "complete" | "skip";
    readonly routeSelection?: JourneySceneActionOption["routeSelection"];
  }) => {
    const { resolved } = inputAction;
    if (!taskContext && !generatedTaskObjective && !isJourneySceneActionLabelSpecific(resolved.label, knownLabels)) {
      throw new Error("journey_scene_action_label_too_generic");
    }
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
      ...(ruleVersion === LEGACY_JOURNEY_SCENE_CONTRACT_RULE_VERSION
        ? {}
        : { riskTerms: journeyActionRiskTerms(inputAction.risk) }),
      preconditionRefs,
      allowedEffectKinds: inputAction.allowedEffectKinds,
      targetEntityIds,
      ...(inputAction.outcomeSummary ? { outcomeSummary: inputAction.outcomeSummary } : {}),
      ...(inputAction.taskObjectiveId ? { taskObjectiveId: inputAction.taskObjectiveId } : {}),
      ...(inputAction.completionKind ? { completionKind: inputAction.completionKind } : {}),
      ...(inputAction.routeSelection ? { routeSelection: inputAction.routeSelection } : {}),
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
    ? legacyGrayHarborScene
      ? GRAY_HARBOR_ARRIVAL_ACTION_RECIPES
      : GENERIC_JOURNEY_ARRIVAL_ACTION_RECIPES
    : GRAY_HARBOR_RETURN_ACTION_RECIPES;
  const actionOptions = taskContext
    ? taskContext.route.actions.map((action) => signedResolvedAction({
        optionKey: action.optionKey,
        risk: action.risk,
        allowedEffectKinds: action.allowedEffectKinds,
        resolved: {
          label: action.label,
          intent: action.intent,
          targetObjects: action.targetObjectIds.map((objectId) => taskContext.objectsById.get(objectId) as NormalizedWorldObject),
        },
      }))
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
              resolved: {
                label: action.label,
                intent: action.intent,
                targetObjects: action.targetObjectIds.map((objectId) =>
                  worldObjects.find((object) => object.id === objectId) as NormalizedWorldObject),
              },
            });
          }),
          signedResolvedAction({
            optionKey: `skip_${generatedTaskObjective.objectiveId}`,
            risk: "low",
            allowedEffectKinds: ["journey_progress"],
            outcomeSummary: generatedTaskObjective.kind === "side"
              ? `身份衡量当前状态后没有介入支线“${generatedTaskObjective.title}”，保留精力继续主线；该支线被服务器记录为跳过。`
              : `身份没有完成“${generatedTaskObjective.title}”，该目标被服务器记录为跳过，并开始收束本局行动。`,
            taskObjectiveId: generatedTaskObjective.objectiveId,
            completionKind: "skip",
            resolved: {
              label: generatedTaskObjective.kind === "side"
                ? `暂不介入支线“${generatedTaskObjective.title}”，继续主线`
                : `停止“${generatedTaskObjective.title}”并离开现场`,
              intent: generatedTaskObjective.kind === "side"
                ? "根据身份需求、资源和长期目标放弃这项可选支线，不把跳过伪装成完成。"
                : "不虚构完成结果，保留已经发生的行动记录后离开。",
              targetObjects: [worldObjects.find((object) => object.id === generatedTaskObjective.locationId) as NormalizedWorldObject],
            },
          }),
        ]
    : phase === "main" && !taskRoute && !legacyGrayHarborScene
    ? GENERIC_JOURNEY_MAIN_ACTION_RECIPES.map((recipe) => signedResolvedAction({
        optionKey: recipe.optionKey,
        risk: recipe.risk,
        allowedEffectKinds: recipe.allowedEffectKinds,
        resolved: {
          label: recipe.label(sceneRegion),
          intent: recipe.intent(sceneRegion),
          targetObjects: [sceneRegion],
        },
      }))
    : phase === "main" && input.sceneType === "livelihood"
    ? GRAY_HARBOR_LIVELIHOOD_ACTION_RECIPES.map((recipe) => signedResolvedAction({
        optionKey: recipe.optionKey,
        risk: recipe.risk,
        allowedEffectKinds: recipe.allowedEffectKinds,
        resolved: recipe.resolve(context as GrayHarborLivelihoodContext),
      }))
    : phase === "main" && relationshipParticipant
      ? GRAY_HARBOR_RELATIONSHIP_ACTION_RECIPES.map((recipe) => signedResolvedAction({
          optionKey: recipe.optionKey,
          risk: recipe.risk,
          allowedEffectKinds: recipe.allowedEffectKinds,
          resolved: {
            label: recipe.label(relationshipParticipant, sceneRegion),
            intent: recipe.intent(relationshipParticipant, sceneRegion),
            targetObjects: [relationshipParticipant, sceneRegion],
          },
        }))
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
  const location = generatedTaskObjective
    ? worldObjects.find((object) => object.id === generatedTaskObjective.locationId) as NormalizedWorldObject
    : taskContext?.location ?? context?.location ?? sceneRegion;
  const safeFallbackOptionKey = phase === "arrival"
    ? "turn_back_before_entry"
    : phase === "return"
      ? "wait_for_safe_departure"
      : generatedTaskObjective
        ? `skip_${generatedTaskObjective.objectiveId}`
      : taskContext
        ? taskContext.route.safeFallbackOptionKey
      : input.sceneType === "relationship"
        ? "leave_conversation"
        : "leave_without_commitment";
  return {
    sceneId,
    journeyId,
    episodeId,
    sceneType: input.sceneType,
    phase,
    ...(input.worldMode ? { worldMode: input.worldMode } : {}),
    title,
    premise: generatedTaskObjective
      ? `${generatedTaskObjective.objective} 完成条件：${generatedTaskObjective.completionCriteria}`
      : taskContext
      ? `${taskContext.route.premise} 此行目标：${mandate.objective}。`
      : context
      ? `${context.organization.label}在${context.location.label}登记了一组可核验的生计行动；${context.clerk.label}负责当班复核。此行目标：${mandate.objective}。`
      : relationshipParticipant
        ? `${relationshipParticipant.label}当前位于${sceneRegion.label}；只能选择不替对方作出承诺的会面行动。此行目标：${mandate.objective}。`
        : phase === "main"
        ? `身份正在${sceneRegion.label}执行当前 mandate；只能选择基于已确认区域事实的通用行动。此行目标：${mandate.objective}。`
        : phase === "arrival"
        ? `身份已抵达${sceneRegion.label}入口；只能从服务器签发的到达行动中选择。此行目标：${mandate.objective}。`
        : `身份准备从${sceneRegion.label}返程；只能整理已核验事实并选择已确认路线。`,
    location: publicRef(location),
    participants: generatedTaskObjective
      ? worldObjects.filter((object) => generatedTaskObjective.worldObjectIds.includes(object.id)
          && ["npc", "agent", "group", "organization"].includes(object.type)).map(publicRef)
      : taskContext
      ? taskContext.participants.map(publicRef)
      : context
      ? [context.organization, context.clerk].map(publicRef)
      : relationshipParticipant
        ? [publicRef(relationshipParticipant)]
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
    } } : {}),
  };
}

// Keep the canonical serializer reachable for callers that need to persist the exact
// deterministic scene binding without inventing a second object-key ordering rule.
export function stableJourneySceneContractJson(contract: JourneySceneContract): string {
  return stableSignedEnvelopeJson(contract);
}
