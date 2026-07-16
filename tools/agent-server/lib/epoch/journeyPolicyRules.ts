export const JOURNEY_POLICY_PRESET_VERSION = "1" as const;
export const JOURNEY_SYNCHRONOUS_QUESTION_BUDGET = 1 as const;

export const JOURNEY_POLICY_PRESET_IDS = ["cautious", "balanced", "explorer"] as const;
export type JourneyPolicyPresetId = typeof JOURNEY_POLICY_PRESET_IDS[number];

export const JOURNEY_RISKS = ["low", "medium", "high"] as const;
export type JourneyRisk = typeof JOURNEY_RISKS[number];

export const JOURNEY_SOCIAL_PREFERENCES = ["reserved", "balanced", "outgoing"] as const;
export type JourneySocialPreference = typeof JOURNEY_SOCIAL_PREFERENCES[number];

export const JOURNEY_RETURN_CONDITIONS = ["time", "objective", "resource_floor", "user_recall"] as const;
export type JourneyReturnCondition = typeof JOURNEY_RETURN_CONDITIONS[number];

export const JOURNEY_TIMEOUT_POLICIES = ["safe_decline", "safe_retreat", "pause_branch"] as const;
export type JourneyTimeoutPolicy = typeof JOURNEY_TIMEOUT_POLICIES[number];

export const JOURNEY_ACTION_TRAITS = [
  "routine_work",
  "small_trade",
  "public_message",
  "agent_meeting",
  "party_join",
  "organization_join",
  "pvp",
  "permanent_relationship_change",
] as const;
export type JourneyActionTrait = typeof JOURNEY_ACTION_TRAITS[number];

export interface JourneyMandate {
  readonly objective: string;
  readonly priorities: readonly string[];
  readonly avoid: readonly string[];
  readonly preferredActivities: readonly string[];
  readonly socialPreference: JourneySocialPreference;
  readonly returnCondition: JourneyReturnCondition;
}

export interface JourneyAutonomyPolicy {
  readonly maxRisk: JourneyRisk;
  readonly maxSingleSpend: number;
  readonly maxJourneySpend: number;
  readonly maxAutomaticLifetimeLoss: number;
  readonly allowRoutineWork: boolean;
  readonly allowSmallTrades: boolean;
  readonly allowPublicMessages: boolean;
  readonly allowAgentMeetings: boolean;
  readonly allowPartyJoin: boolean;
  readonly allowOrganizationJoin: boolean;
  readonly allowPvP: boolean;
  readonly allowPermanentRelationshipChange: boolean;
  readonly timeoutPolicy: JourneyTimeoutPolicy;
}

export interface VersionedJourneyPolicyPreset {
  readonly presetId: JourneyPolicyPresetId;
  readonly version: typeof JOURNEY_POLICY_PRESET_VERSION;
  readonly policy: JourneyAutonomyPolicy;
}

export interface JourneyPolicySelection {
  readonly presetId: JourneyPolicyPresetId;
  readonly presetVersion: typeof JOURNEY_POLICY_PRESET_VERSION;
  readonly policy: JourneyAutonomyPolicy;
}

export interface JourneyActionOptionPolicyInput {
  readonly actionOptionId: string;
  readonly risk: JourneyRisk;
  readonly spend: number;
  readonly journeySpendBefore: number;
  readonly availableSpend?: number;
  readonly automaticLifetimeLoss: number;
  readonly traits: readonly JourneyActionTrait[];
  readonly serverEligible: boolean;
  readonly serverDenialCode?: string;
}

export const JOURNEY_ACTION_POLICY_BOUNDARIES = [
  "risk_above_policy",
  "single_spend_above_policy",
  "journey_spend_above_policy",
  "automatic_lifetime_loss_above_policy",
  "routine_work_not_allowed",
  "small_trade_not_allowed",
  "public_message_not_allowed",
  "agent_meeting_not_allowed",
  "party_join_not_allowed",
  "organization_join_not_allowed",
  "pvp_not_allowed",
  "permanent_relationship_change_not_allowed",
] as const;
export type JourneyActionPolicyBoundary = typeof JOURNEY_ACTION_POLICY_BOUNDARIES[number];

interface JourneyQuestionBudgetSnapshot {
  readonly maximum: typeof JOURNEY_SYNCHRONOUS_QUESTION_BUDGET;
  readonly asked: 0 | 1;
  readonly remaining: 0 | 1;
}

export interface JourneyActionAutomaticDecision {
  readonly outcome: "automatic";
  readonly reason: "within_policy";
  readonly boundaries: readonly [];
  readonly questionBudget: JourneyQuestionBudgetSnapshot;
}

export interface JourneyActionRequiresUserDecision {
  readonly outcome: "requires_user";
  readonly reason: JourneyActionPolicyBoundary;
  readonly boundaries: readonly JourneyActionPolicyBoundary[];
  readonly questionBudget: JourneyQuestionBudgetSnapshot;
}

export interface JourneyActionSafeRejectDecision {
  readonly outcome: "safe_reject";
  readonly reason: "server_ineligible" | "resource_insufficient" | "question_budget_exhausted";
  readonly boundaries: readonly JourneyActionPolicyBoundary[];
  readonly fallback: JourneyTimeoutPolicy | "server_denial";
  readonly serverDenialCode?: string;
  readonly questionBudget: JourneyQuestionBudgetSnapshot;
}

export type JourneyActionPolicyDecision =
  | JourneyActionAutomaticDecision
  | JourneyActionRequiresUserDecision
  | JourneyActionSafeRejectDecision;

export interface JourneyPolicyPreview {
  readonly presetId: JourneyPolicyPresetId;
  readonly presetVersion: typeof JOURNEY_POLICY_PRESET_VERSION;
  readonly plan: string;
  readonly expectedReturn: string;
  readonly automaticSpend: string;
  readonly askWhen: readonly string[];
  readonly text: string;
}

type UnknownRecord = Record<string, unknown>;

const MANDATE_KEYS = new Set([
  "objective",
  "priorities",
  "avoid",
  "preferredActivities",
  "socialPreference",
  "returnCondition",
]);

const POLICY_KEYS = new Set([
  "maxRisk",
  "maxSingleSpend",
  "maxJourneySpend",
  "maxAutomaticLifetimeLoss",
  "allowRoutineWork",
  "allowSmallTrades",
  "allowPublicMessages",
  "allowAgentMeetings",
  "allowPartyJoin",
  "allowOrganizationJoin",
  "allowPvP",
  "allowPermanentRelationshipChange",
  "timeoutPolicy",
]);

const POLICY_SELECTION_KEYS = new Set(["presetId", "overrides"]);

const ACTION_OPTION_KEYS = new Set([
  "actionOptionId",
  "risk",
  "spend",
  "journeySpendBefore",
  "availableSpend",
  "automaticLifetimeLoss",
  "traits",
  "serverEligible",
  "serverDenialCode",
]);

const RISK_RANK: Readonly<Record<JourneyRisk, number>> = {
  low: 0,
  medium: 1,
  high: 2,
};

const TRAIT_POLICY: Readonly<Record<JourneyActionTrait, {
  readonly policyKey: keyof Pick<
    JourneyAutonomyPolicy,
    | "allowRoutineWork"
    | "allowSmallTrades"
    | "allowPublicMessages"
    | "allowAgentMeetings"
    | "allowPartyJoin"
    | "allowOrganizationJoin"
    | "allowPvP"
    | "allowPermanentRelationshipChange"
  >;
  readonly boundary: JourneyActionPolicyBoundary;
  readonly previewLabel: string;
}>> = {
  routine_work: {
    policyKey: "allowRoutineWork",
    boundary: "routine_work_not_allowed",
    previewLabel: "普通工作",
  },
  small_trade: {
    policyKey: "allowSmallTrades",
    boundary: "small_trade_not_allowed",
    previewLabel: "小额交易",
  },
  public_message: {
    policyKey: "allowPublicMessages",
    boundary: "public_message_not_allowed",
    previewLabel: "公开发言",
  },
  agent_meeting: {
    policyKey: "allowAgentMeetings",
    boundary: "agent_meeting_not_allowed",
    previewLabel: "与其他 Agent 会面",
  },
  party_join: {
    policyKey: "allowPartyJoin",
    boundary: "party_join_not_allowed",
    previewLabel: "加入队伍",
  },
  organization_join: {
    policyKey: "allowOrganizationJoin",
    boundary: "organization_join_not_allowed",
    previewLabel: "加入组织",
  },
  pvp: {
    policyKey: "allowPvP",
    boundary: "pvp_not_allowed",
    previewLabel: "与其他身份对抗",
  },
  permanent_relationship_change: {
    policyKey: "allowPermanentRelationshipChange",
    boundary: "permanent_relationship_change_not_allowed",
    previewLabel: "永久关系变化",
  },
};

const PRESET_POLICIES: Readonly<Record<JourneyPolicyPresetId, JourneyAutonomyPolicy>> = {
  cautious: {
    maxRisk: "low",
    maxSingleSpend: 2,
    maxJourneySpend: 6,
    maxAutomaticLifetimeLoss: 0,
    allowRoutineWork: true,
    allowSmallTrades: true,
    allowPublicMessages: false,
    allowAgentMeetings: true,
    allowPartyJoin: false,
    allowOrganizationJoin: false,
    allowPvP: false,
    allowPermanentRelationshipChange: false,
    timeoutPolicy: "safe_retreat",
  },
  balanced: {
    maxRisk: "medium",
    maxSingleSpend: 5,
    maxJourneySpend: 15,
    maxAutomaticLifetimeLoss: 0,
    allowRoutineWork: true,
    allowSmallTrades: true,
    allowPublicMessages: true,
    allowAgentMeetings: true,
    allowPartyJoin: true,
    allowOrganizationJoin: false,
    allowPvP: false,
    allowPermanentRelationshipChange: false,
    timeoutPolicy: "safe_decline",
  },
  explorer: {
    maxRisk: "medium",
    maxSingleSpend: 8,
    maxJourneySpend: 24,
    maxAutomaticLifetimeLoss: 0,
    allowRoutineWork: true,
    allowSmallTrades: true,
    allowPublicMessages: true,
    allowAgentMeetings: true,
    allowPartyJoin: true,
    allowOrganizationJoin: false,
    allowPvP: false,
    allowPermanentRelationshipChange: false,
    timeoutPolicy: "safe_retreat",
  },
};

export const JOURNEY_POLICY_PRESETS: Readonly<Record<JourneyPolicyPresetId, VersionedJourneyPolicyPreset>> = {
  cautious: {
    presetId: "cautious",
    version: JOURNEY_POLICY_PRESET_VERSION,
    policy: PRESET_POLICIES.cautious,
  },
  balanced: {
    presetId: "balanced",
    version: JOURNEY_POLICY_PRESET_VERSION,
    policy: PRESET_POLICIES.balanced,
  },
  explorer: {
    presetId: "explorer",
    version: JOURNEY_POLICY_PRESET_VERSION,
    policy: PRESET_POLICIES.explorer,
  },
};

function recordFromUnknown(value: unknown, errorCode: string): UnknownRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(errorCode);
  return value as UnknownRecord;
}

function assertKnownKeys(record: UnknownRecord, allowed: ReadonlySet<string>, errorCode: string) {
  const unknownKey = Object.keys(record).find((key) => !allowed.has(key));
  if (unknownKey) throw new Error(`${errorCode}:${unknownKey}`);
}

function normalizedString(value: unknown, errorCode: string, maximumLength = 500): string {
  if (typeof value !== "string") throw new Error(errorCode);
  const normalized = value.trim();
  if (!normalized || normalized.length > maximumLength) throw new Error(errorCode);
  return normalized;
}

function normalizedStringList(value: unknown, errorCode: string): readonly string[] {
  if (!Array.isArray(value) || value.length > 12) throw new Error(errorCode);
  const normalized = value.map((entry) => normalizedString(entry, errorCode, 120));
  return [...new Set(normalized)];
}

function enumValue<T extends string>(
  value: unknown,
  values: readonly T[],
  errorCode: string,
): T {
  if (typeof value !== "string" || !values.includes(value as T)) throw new Error(errorCode);
  return value as T;
}

function nonNegativeInteger(value: unknown, errorCode: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) throw new Error(errorCode);
  return value;
}

function booleanValue(value: unknown, errorCode: string): boolean {
  if (typeof value !== "boolean") throw new Error(errorCode);
  return value;
}

function clonePolicy(policy: JourneyAutonomyPolicy): JourneyAutonomyPolicy {
  return { ...policy };
}

export function journeyPolicyPreset(presetId: unknown = "cautious"): VersionedJourneyPolicyPreset {
  const normalizedId = enumValue(presetId, JOURNEY_POLICY_PRESET_IDS, "journey_policy_preset_invalid");
  return {
    presetId: normalizedId,
    version: JOURNEY_POLICY_PRESET_VERSION,
    policy: clonePolicy(PRESET_POLICIES[normalizedId]),
  };
}

export function normalizeJourneyMandate(input: unknown = {}): JourneyMandate {
  const record = recordFromUnknown(input, "journey_mandate_invalid");
  assertKnownKeys(record, MANDATE_KEYS, "journey_mandate_unknown_field");

  return {
    objective: record.objective === undefined
      ? "安全地了解当地情况并按时返回"
      : normalizedString(record.objective, "journey_mandate_objective_invalid"),
    priorities: record.priorities === undefined
      ? []
      : normalizedStringList(record.priorities, "journey_mandate_priorities_invalid"),
    avoid: record.avoid === undefined
      ? []
      : normalizedStringList(record.avoid, "journey_mandate_avoid_invalid"),
    preferredActivities: record.preferredActivities === undefined
      ? []
      : normalizedStringList(record.preferredActivities, "journey_mandate_preferred_activities_invalid"),
    socialPreference: record.socialPreference === undefined
      ? "balanced"
      : enumValue(
        record.socialPreference,
        JOURNEY_SOCIAL_PREFERENCES,
        "journey_mandate_social_preference_invalid",
      ),
    returnCondition: record.returnCondition === undefined
      ? "time"
      : enumValue(record.returnCondition, JOURNEY_RETURN_CONDITIONS, "journey_mandate_return_condition_invalid"),
  };
}

export function normalizeJourneyAutonomyPolicy(
  input: unknown = {},
  presetId: JourneyPolicyPresetId = "cautious",
): JourneyAutonomyPolicy {
  const record = recordFromUnknown(input, "journey_autonomy_policy_invalid");
  assertKnownKeys(record, POLICY_KEYS, "journey_autonomy_policy_unknown_field");
  const base = journeyPolicyPreset(presetId).policy;

  const policy: JourneyAutonomyPolicy = {
    maxRisk: record.maxRisk === undefined
      ? base.maxRisk
      : enumValue(record.maxRisk, JOURNEY_RISKS, "journey_policy_max_risk_invalid"),
    maxSingleSpend: record.maxSingleSpend === undefined
      ? base.maxSingleSpend
      : nonNegativeInteger(record.maxSingleSpend, "journey_policy_max_single_spend_invalid"),
    maxJourneySpend: record.maxJourneySpend === undefined
      ? base.maxJourneySpend
      : nonNegativeInteger(record.maxJourneySpend, "journey_policy_max_journey_spend_invalid"),
    maxAutomaticLifetimeLoss: record.maxAutomaticLifetimeLoss === undefined
      ? base.maxAutomaticLifetimeLoss
      : nonNegativeInteger(
        record.maxAutomaticLifetimeLoss,
        "journey_policy_max_automatic_lifetime_loss_invalid",
      ),
    allowRoutineWork: record.allowRoutineWork === undefined
      ? base.allowRoutineWork
      : booleanValue(record.allowRoutineWork, "journey_policy_allow_routine_work_invalid"),
    allowSmallTrades: record.allowSmallTrades === undefined
      ? base.allowSmallTrades
      : booleanValue(record.allowSmallTrades, "journey_policy_allow_small_trades_invalid"),
    allowPublicMessages: record.allowPublicMessages === undefined
      ? base.allowPublicMessages
      : booleanValue(record.allowPublicMessages, "journey_policy_allow_public_messages_invalid"),
    allowAgentMeetings: record.allowAgentMeetings === undefined
      ? base.allowAgentMeetings
      : booleanValue(record.allowAgentMeetings, "journey_policy_allow_agent_meetings_invalid"),
    allowPartyJoin: record.allowPartyJoin === undefined
      ? base.allowPartyJoin
      : booleanValue(record.allowPartyJoin, "journey_policy_allow_party_join_invalid"),
    allowOrganizationJoin: record.allowOrganizationJoin === undefined
      ? base.allowOrganizationJoin
      : booleanValue(record.allowOrganizationJoin, "journey_policy_allow_organization_join_invalid"),
    allowPvP: record.allowPvP === undefined
      ? base.allowPvP
      : booleanValue(record.allowPvP, "journey_policy_allow_pvp_invalid"),
    allowPermanentRelationshipChange: record.allowPermanentRelationshipChange === undefined
      ? base.allowPermanentRelationshipChange
      : booleanValue(
        record.allowPermanentRelationshipChange,
        "journey_policy_allow_permanent_relationship_change_invalid",
      ),
    timeoutPolicy: record.timeoutPolicy === undefined
      ? base.timeoutPolicy
      : enumValue(record.timeoutPolicy, JOURNEY_TIMEOUT_POLICIES, "journey_policy_timeout_policy_invalid"),
  };

  if (policy.maxSingleSpend > policy.maxJourneySpend) {
    throw new Error("journey_policy_spend_limits_invalid");
  }
  if (policy.maxAutomaticLifetimeLoss !== 0) {
    throw new Error("journey_policy_automatic_lifetime_loss_must_be_zero");
  }
  return policy;
}

export function normalizeJourneyPolicySelection(input: unknown = {}): JourneyPolicySelection {
  const record = recordFromUnknown(input, "journey_policy_selection_invalid");
  assertKnownKeys(record, POLICY_SELECTION_KEYS, "journey_policy_selection_unknown_field");
  const preset = journeyPolicyPreset(record.presetId === undefined ? "cautious" : record.presetId);
  return {
    presetId: preset.presetId,
    presetVersion: preset.version,
    policy: normalizeJourneyAutonomyPolicy(record.overrides === undefined ? {} : record.overrides, preset.presetId),
  };
}

export function normalizeJourneyActionOption(input: unknown): JourneyActionOptionPolicyInput {
  const record = recordFromUnknown(input, "journey_action_option_invalid");
  assertKnownKeys(record, ACTION_OPTION_KEYS, "journey_action_option_unknown_field");
  const serverEligible = record.serverEligible === undefined
    ? true
    : booleanValue(record.serverEligible, "journey_action_option_server_eligible_invalid");
  const serverDenialCode = record.serverDenialCode === undefined
    ? undefined
    : normalizedString(record.serverDenialCode, "journey_action_option_server_denial_code_invalid", 120);
  if (serverEligible && serverDenialCode !== undefined) {
    throw new Error("journey_action_option_server_denial_code_unexpected");
  }

  const traits = record.traits === undefined
    ? []
    : Array.isArray(record.traits) && record.traits.length <= JOURNEY_ACTION_TRAITS.length
      ? [...new Set(record.traits.map((trait) =>
        enumValue(trait, JOURNEY_ACTION_TRAITS, "journey_action_option_trait_invalid")))]
      : (() => { throw new Error("journey_action_option_traits_invalid"); })();

  return {
    actionOptionId: normalizedString(record.actionOptionId, "journey_action_option_id_invalid", 120),
    risk: enumValue(record.risk, JOURNEY_RISKS, "journey_action_option_risk_invalid"),
    spend: record.spend === undefined
      ? 0
      : nonNegativeInteger(record.spend, "journey_action_option_spend_invalid"),
    journeySpendBefore: record.journeySpendBefore === undefined
      ? 0
      : nonNegativeInteger(record.journeySpendBefore, "journey_action_option_journey_spend_invalid"),
    availableSpend: record.availableSpend === undefined
      ? undefined
      : nonNegativeInteger(record.availableSpend, "journey_action_option_available_spend_invalid"),
    automaticLifetimeLoss: record.automaticLifetimeLoss === undefined
      ? 0
      : nonNegativeInteger(
        record.automaticLifetimeLoss,
        "journey_action_option_automatic_lifetime_loss_invalid",
      ),
    traits,
    serverEligible,
    serverDenialCode,
  };
}

function questionBudgetSnapshot(value: unknown): JourneyQuestionBudgetSnapshot {
  const asked = value === undefined ? 0 : nonNegativeInteger(value, "journey_question_budget_asked_invalid");
  if (asked !== 0 && asked !== 1) throw new Error("journey_question_budget_asked_invalid");
  return {
    maximum: JOURNEY_SYNCHRONOUS_QUESTION_BUDGET,
    asked,
    remaining: asked === 0 ? 1 : 0,
  };
}

function actionPolicyBoundaries(
  policy: JourneyAutonomyPolicy,
  option: JourneyActionOptionPolicyInput,
): readonly JourneyActionPolicyBoundary[] {
  const boundaries: JourneyActionPolicyBoundary[] = [];
  if (RISK_RANK[option.risk] > RISK_RANK[policy.maxRisk]) boundaries.push("risk_above_policy");
  if (option.spend > policy.maxSingleSpend) boundaries.push("single_spend_above_policy");
  if (option.journeySpendBefore + option.spend > policy.maxJourneySpend) {
    boundaries.push("journey_spend_above_policy");
  }
  if (option.automaticLifetimeLoss > policy.maxAutomaticLifetimeLoss) {
    boundaries.push("automatic_lifetime_loss_above_policy");
  }
  for (const trait of option.traits) {
    const traitPolicy = TRAIT_POLICY[trait];
    if (!policy[traitPolicy.policyKey]) boundaries.push(traitPolicy.boundary);
  }
  return boundaries;
}

export function evaluateJourneyActionPolicy(input: {
  readonly policy: unknown;
  readonly actionOption: unknown;
  readonly synchronousQuestionsAsked?: unknown;
  readonly presetId?: JourneyPolicyPresetId;
}): JourneyActionPolicyDecision {
  const policy = normalizeJourneyAutonomyPolicy(input.policy, input.presetId || "cautious");
  const option = normalizeJourneyActionOption(input.actionOption);
  const questionBudget = questionBudgetSnapshot(input.synchronousQuestionsAsked);

  if (!option.serverEligible) {
    return {
      outcome: "safe_reject",
      reason: "server_ineligible",
      boundaries: [],
      fallback: "server_denial",
      serverDenialCode: option.serverDenialCode,
      questionBudget,
    };
  }
  if (option.availableSpend !== undefined && option.spend > option.availableSpend) {
    return {
      outcome: "safe_reject",
      reason: "resource_insufficient",
      boundaries: [],
      fallback: policy.timeoutPolicy,
      questionBudget,
    };
  }

  const boundaries = actionPolicyBoundaries(policy, option);
  if (boundaries.length === 0) {
    return {
      outcome: "automatic",
      reason: "within_policy",
      boundaries: [],
      questionBudget,
    };
  }
  if (questionBudget.remaining === 1) {
    return {
      outcome: "requires_user",
      reason: boundaries[0] as JourneyActionPolicyBoundary,
      boundaries,
      questionBudget,
    };
  }
  return {
    outcome: "safe_reject",
    reason: "question_budget_exhausted",
    boundaries,
    fallback: policy.timeoutPolicy,
    questionBudget,
  };
}

function planText(mandate: JourneyMandate): string {
  const details = [
    mandate.priorities.length ? `优先 ${mandate.priorities.join("、")}` : "",
    mandate.preferredActivities.length ? `偏好 ${mandate.preferredActivities.join("、")}` : "",
    mandate.avoid.length ? `避开 ${mandate.avoid.join("、")}` : "",
  ].filter(Boolean);
  return details.length ? `${mandate.objective}；${details.join("；")}` : mandate.objective;
}

function policyQuestions(policy: JourneyAutonomyPolicy): readonly string[] {
  const questions = [
    `风险高于${policy.maxRisk === "low" ? "低" : policy.maxRisk === "medium" ? "中" : "高"}风险`,
    `单次花费超过 ${policy.maxSingleSpend} 或旅程总花费超过 ${policy.maxJourneySpend}`,
    "任何寿命损失",
  ];
  const disabledTraits = JOURNEY_ACTION_TRAITS
    .filter((trait) => !policy[TRAIT_POLICY[trait].policyKey])
    .map((trait) => TRAIT_POLICY[trait].previewLabel);
  if (disabledTraits.length) questions.push(disabledTraits.join("、"));
  return questions;
}

export function buildJourneyPolicyPreview(input: {
  readonly mandate: unknown;
  readonly policySelection?: unknown;
  readonly expectedReturn?: unknown;
}): JourneyPolicyPreview {
  const mandate = normalizeJourneyMandate(input.mandate);
  const selection = normalizeJourneyPolicySelection(input.policySelection === undefined ? {} : input.policySelection);
  const expectedReturn = input.expectedReturn === undefined
    ? "由服务器在出发时计算"
    : normalizedString(input.expectedReturn, "journey_preview_expected_return_invalid", 120);
  const plan = planText(mandate);
  const automaticSpend = `单次最多 ${selection.policy.maxSingleSpend}，全程最多 ${selection.policy.maxJourneySpend}`;
  const askWhen = policyQuestions(selection.policy);
  return {
    presetId: selection.presetId,
    presetVersion: selection.presetVersion,
    plan,
    expectedReturn,
    automaticSpend,
    askWhen,
    text: [
      `计划：${plan}`,
      `预计返程：${expectedReturn}`,
      `自动花费：${automaticSpend}`,
      `回来询问：${askWhen.join("；")}`,
    ].join("\n"),
  };
}
