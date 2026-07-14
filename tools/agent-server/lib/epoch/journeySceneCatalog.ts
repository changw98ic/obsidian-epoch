export const JOURNEY_SCENE_TYPES = [
  "livelihood",
  "travel",
  "relationship",
  "commission",
  "world_event",
  "discovery",
  "health",
  "conflict",
] as const;

export type JourneySceneType = (typeof JOURNEY_SCENE_TYPES)[number];

export interface JourneySceneCatalogEntry {
  readonly type: JourneySceneType;
  readonly label: string;
  readonly baseScore: number;
  readonly objectTypes: readonly string[];
  readonly signals: readonly string[];
  readonly optionIds: readonly string[];
  readonly routineOutcome: string;
}

export const JOURNEY_SCENE_CATALOG: Readonly<Record<JourneySceneType, JourneySceneCatalogEntry>> = {
  livelihood: {
    type: "livelihood",
    label: "生计",
    baseScore: 30,
    objectTypes: ["location", "organization", "resource", "resource_node", "workplace"],
    signals: ["livelihood", "work", "job", "trade", "生计", "工作", "谋生", "交易", "资源"],
    optionIds: ["work_safely", "observe_conditions"],
    routineOutcome: "routine_work_recorded",
  },
  travel: {
    type: "travel",
    label: "行旅",
    baseScore: 28,
    objectTypes: ["region", "location", "route", "transport"],
    signals: ["travel", "route", "journey", "explore", "旅行", "路线", "赶路", "探索"],
    optionIds: ["follow_known_route", "survey_route"],
    routineOutcome: "route_progress_recorded",
  },
  relationship: {
    type: "relationship",
    label: "关系",
    baseScore: 24,
    objectTypes: ["npc", "agent", "relationship", "household"],
    signals: ["relationship", "friend", "meet", "social", "关系", "朋友", "会面", "社交"],
    optionIds: ["listen", "exchange_public_news"],
    routineOutcome: "meeting_recorded",
  },
  commission: {
    type: "commission",
    label: "委托",
    baseScore: 27,
    objectTypes: ["commission", "objective", "bounty", "contract"],
    signals: ["commission", "objective", "bounty", "contract", "委托", "目标", "悬赏", "契约"],
    optionIds: ["review_terms", "perform_safe_step"],
    routineOutcome: "commission_progress_recorded",
  },
  world_event: {
    type: "world_event",
    label: "世界事件",
    baseScore: 22,
    objectTypes: ["world_event", "event", "anomaly", "season", "campaign"],
    signals: ["world_event", "event", "anomaly", "season", "世界事件", "事件", "异常", "季节"],
    optionIds: ["observe_public_effects", "assist_within_policy"],
    routineOutcome: "world_event_observed",
  },
  discovery: {
    type: "discovery",
    label: "发现",
    baseScore: 25,
    objectTypes: ["clue", "location", "resource_node", "monument", "trace"],
    signals: ["discovery", "clue", "investigate", "trace", "发现", "线索", "调查", "痕迹"],
    optionIds: ["verify_clue", "record_observation"],
    routineOutcome: "verified_observation_recorded",
  },
  health: {
    type: "health",
    label: "健康",
    baseScore: 20,
    objectTypes: ["health", "health_record", "clinic", "healer"],
    signals: ["health", "rest", "recover", "heal", "健康", "休息", "恢复", "治疗"],
    optionIds: ["rest", "seek_verified_care"],
    routineOutcome: "health_routine_recorded",
  },
  conflict: {
    type: "conflict",
    label: "冲突",
    baseScore: 16,
    objectTypes: ["conflict", "frontline", "retaliation", "raid", "anomaly"],
    signals: ["conflict", "fight", "frontline", "raid", "冲突", "战斗", "前线", "突袭"],
    optionIds: ["avoid_escalation", "assess_safe_response"],
    routineOutcome: "conflict_assessment_recorded",
  },
};

export function journeySceneCatalog(): readonly JourneySceneCatalogEntry[] {
  return JOURNEY_SCENE_TYPES.map((type) => JOURNEY_SCENE_CATALOG[type]);
}
