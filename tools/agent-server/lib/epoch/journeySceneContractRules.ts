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
import {
  signedEnvelopeContentHash,
  stableSignedEnvelopeJson,
} from "./turnActionEnvelopeRules.ts";

export const JOURNEY_SCENE_CONTRACT_RULE_VERSION = "journey-scene-contract.v1";
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
  readonly preconditionRefs: readonly string[];
  readonly allowedEffectKinds: readonly JourneySceneAllowedEffectKind[];
  readonly targetEntityIds: readonly string[];
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
}

export interface JourneySceneContractSeed {
  readonly seed: string;
  readonly journeyId: string;
  readonly episodeId: string;
  readonly sceneType: JourneySceneType;
  readonly phase: JourneyEpisodePhase;
  readonly title: string;
  readonly mandate: JourneyMandate;
  readonly worldObjects: readonly JourneySceneContractWorldObject[];
  readonly sourceFactIds: readonly string[];
  readonly expectedVersion: number;
}

export interface JourneySceneContractBuildInput {
  readonly seed: string;
  readonly agentId: string;
  readonly journeyId: string;
  readonly episodeId: string;
  readonly sceneType: JourneySceneType;
  readonly phase?: JourneyEpisodePhase;
  readonly title: string;
  readonly mandate: JourneyMandate;
  readonly worldObjects: readonly JourneySceneContractWorldObject[];
  readonly sourceFactIds: readonly string[];
  readonly expectedVersion: number;
  readonly expiresAt: string;
  readonly ruleVersion?: string;
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
  enter_gray_harbor: "身份沿登记路线抵达灰港，入口与来路被记录为可核验的到达事实。",
  review_arrival_route: "身份在灰港入口复核了来路与返程时间，没有虚构途中遭遇。",
  turn_back_before_entry: "身份在进入灰港前选择原路返回，没有接受新的承诺。",
  ask_for_shift: "珂岚核对了灰港民务所的当日登记，并给出一项可继续确认的短工班次。",
  verify_salt_ledger: "盐票账册已按登记逐项核对，差额被保留为可追溯记录。",
  carry_manifest: "药品运送清单已送到当班书记手中，交接责任与内容均有记录。",
  ask_about_recent_travelers: "珂岚只从公开登记中确认了近日旅人消息，没有把传闻写成事实。",
  report_discrepancy: "清单差额已交由珂岚复核，未经确认的推测没有进入世界状态。",
  leave_without_commitment: "身份在说明后安全离开灰港民务账房，没有接受未核实的条件。",
  return_by_known_route: "身份沿已确认路线离开灰港，返程开始且没有追加未经结算的事件。",
  record_verified_facts: "身份在返程前整理了本次灰港之行的已核验记录。",
  wait_for_safe_departure: "身份在灰港等待安全窗口后返程，没有冒险改道。",
  greet_participant: "身份在灰港完成了一次不带承诺的礼貌问候。",
  exchange_public_news: "双方只交换了服务器已有的公开消息，没有暴露私密信息。",
  leave_conversation: "身份礼貌结束会面，没有替对方作出承诺。",
};

export function journeySceneHostedActionOptions(
  contract: JourneySceneContract,
): readonly HostedActionOptionPayload[] {
  return contract.actionOptions.map((action) => ({
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
      risk: `${action.risk === "low" ? "低" : action.risk === "medium" ? "中" : "高"}风险；服务器只按签名合同结算。`,
      expectedBenefit: GRAY_HARBOR_LIVELIHOOD_OUTCOMES[action.optionKey] ?? "形成一条可审计的旅程行动记录。",
    },
    outcomeSummary: GRAY_HARBOR_LIVELIHOOD_OUTCOMES[action.optionKey]
      ?? "服务器记录了一次符合场景合同的旅程行动。",
  }));
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

function compactHash(value: unknown): string {
  return signedEnvelopeContentHash(value).slice("sha256:".length, "sha256:".length + 24);
}

interface JourneySceneActionSignedContentInput {
  readonly agentId: string;
  readonly sceneId: string;
  readonly expectedVersion: number;
  readonly expiresAt: string;
  readonly ruleVersion: string;
  readonly signatureVersion: 1;
  readonly signingPurpose: typeof JOURNEY_SCENE_ACTION_SIGNING_PURPOSE;
  readonly signingKeyId: string;
  readonly action: Pick<JourneySceneActionOption,
    "actionOptionId" | "optionKey" | "label" | "intent" | "risk" | "preconditionRefs" | "allowedEffectKinds" | "targetEntityIds">;
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
    const content = journeySceneActionSignedContent({
      agentId: input.agentId,
      sceneId: input.contract.sceneId,
      expectedVersion: input.contract.expectedVersion,
      expiresAt: input.contract.expiresAt,
      ruleVersion: input.contract.ruleVersion,
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
  if (phase === "main" && !["livelihood", "relationship"].includes(input.sceneType)) {
    throw new Error("journey_scene_contract_type_not_supported");
  }
  if (phase !== "main" && input.sceneType !== "travel") {
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
  const grayHarborRegion = worldObjects.find((object) => object.type === "region"
    && (object.id === "region_gray_harbor" || object.label === "灰港"));
  if (!grayHarborRegion) throw new Error("gray_harbor_scene_region_required");
  const context = phase === "main" && input.sceneType === "livelihood"
    ? grayHarborContext(worldObjects, confirmedFactIds)
    : undefined;
  const relationshipParticipant = phase === "main" && input.sceneType === "relationship"
    ? worldObjects.find((object) => ["agent", "npc"].includes(object.type))
    : undefined;
  if (phase === "main" && input.sceneType === "relationship" && !relationshipParticipant) {
    throw new Error("gray_harbor_relationship_scene_incomplete");
  }
  const stateBinding = {
    seed,
    agentId,
    journeyId,
    episodeId,
    sceneType: input.sceneType,
    phase,
    title,
    mandate,
    worldObjects,
    confirmedFactIds,
    expectedVersion: input.expectedVersion,
    expiresAt,
    ruleVersion,
  };
  const sceneId = `scene_${compactHash(stateBinding)}`;
  const knownLabels = worldObjects.map((object) => object.label);
  const signedResolvedAction = (inputAction: {
    readonly optionKey: string;
    readonly risk: JourneySceneActionRisk;
    readonly allowedEffectKinds: readonly JourneySceneAllowedEffectKind[];
    readonly resolved: ResolvedJourneySceneRecipe;
  }) => {
    const { resolved } = inputAction;
    if (!isJourneySceneActionLabelSpecific(resolved.label, knownLabels)) {
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
      preconditionRefs,
      allowedEffectKinds: inputAction.allowedEffectKinds,
      targetEntityIds,
    } as const;
    const actionOptionId = `action_${compactHash({ sceneId, ...unsignedAction, actionOptionId: undefined })}`;
    return buildSignedAction({
      agentId,
      sceneId,
      expectedVersion: input.expectedVersion,
      expiresAt,
      ruleVersion,
      signatureVersion: 1,
      signingPurpose: JOURNEY_SCENE_ACTION_SIGNING_PURPOSE,
      signingKeyId: runtimeActionKeyId(),
      action: { ...unsignedAction, actionOptionId },
    });
  };
  const travelRecipes = phase === "arrival"
    ? GRAY_HARBOR_ARRIVAL_ACTION_RECIPES
    : GRAY_HARBOR_RETURN_ACTION_RECIPES;
  const actionOptions = phase === "main" && input.sceneType === "livelihood"
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
            label: recipe.label(relationshipParticipant, grayHarborRegion),
            intent: recipe.intent(relationshipParticipant, grayHarborRegion),
            targetObjects: [relationshipParticipant, grayHarborRegion],
          },
        }))
    : travelRecipes.map((recipe) => signedResolvedAction({
        optionKey: recipe.optionKey,
        risk: recipe.risk,
        allowedEffectKinds: recipe.allowedEffectKinds,
        resolved: {
          label: recipe.label(grayHarborRegion),
          intent: recipe.intent(grayHarborRegion),
          targetObjects: [grayHarborRegion],
        },
      }));
  const location = context?.location ?? grayHarborRegion;
  const safeFallbackOptionKey = phase === "arrival"
    ? "turn_back_before_entry"
    : phase === "return"
      ? "wait_for_safe_departure"
      : input.sceneType === "relationship"
        ? "leave_conversation"
        : "leave_without_commitment";
  return {
    sceneId,
    journeyId,
    episodeId,
    sceneType: input.sceneType,
    phase,
    title,
    premise: context
      ? `${context.organization.label}在${context.location.label}登记了一组可核验的生计行动；${context.clerk.label}负责当班复核。此行目标：${mandate.objective}。`
      : relationshipParticipant
        ? `${relationshipParticipant.label}当前位于${grayHarborRegion.label}；只能选择不替对方作出承诺的会面行动。此行目标：${mandate.objective}。`
      : phase === "arrival"
        ? `身份已抵达${grayHarborRegion.label}入口；只能从服务器签发的到达行动中选择。此行目标：${mandate.objective}。`
        : `身份准备从${grayHarborRegion.label}返程；只能整理已核验事实并选择已确认路线。`,
    location: publicRef(location),
    participants: context
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
  };
}

// Keep the canonical serializer reachable for callers that need to persist the exact
// deterministic scene binding without inventing a second object-key ordering rule.
export function stableJourneySceneContractJson(contract: JourneySceneContract): string {
  return stableSignedEnvelopeJson(contract);
}
