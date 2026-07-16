import { createHash } from "node:crypto";

import type { EpochDowntimeMode } from "./protocol.ts";

export const EPOCH_ACTOR_NEED_KEYS = [
  "hunger",
  "thirst",
  "fatigue",
  "elimination",
  "hygiene",
  "clothing",
  "shelter",
  "mobility",
  "safety",
  "belonging",
  "intimacy",
  "esteem",
  "learning",
  "purpose",
] as const;

export type EpochActorNeedKey = typeof EPOCH_ACTOR_NEED_KEYS[number];
export type EpochActorNeedLevels = Readonly<Record<EpochActorNeedKey, number>>;
export type EpochActorKind = "agent" | "npc";
export type EpochActorNeedAction =
  | "eat"
  | "drink"
  | "sleep"
  | "relieve"
  | "wash"
  | "secure_clothing"
  | "seek_shelter"
  | "travel"
  | "seek_safety"
  | "socialize"
  | "seek_intimacy"
  | "work"
  | "study"
  | "pursue_goal";

export type EpochActorLifeGoalCategory =
  | "work"
  | "learning"
  | "love"
  | "revenge"
  | "wealth"
  | "service"
  | "exploration"
  | "mastery";

export interface EpochActorNeedsState {
  readonly actorKind: EpochActorKind;
  readonly actorId: string;
  readonly levels: EpochActorNeedLevels;
  readonly lastAction: EpochActorNeedAction;
  readonly recentActions: readonly EpochActorNeedAction[];
  /** Minutes accumulated toward the next four-hour behavior decision. */
  readonly actionRemainderMinutes: number;
  /** Fixed-point remainders keep need growth identical across tick partitioning. */
  readonly needIncreaseRemainders: EpochActorNeedLevels;
  readonly lastWorldMinute: number;
  readonly sourceEventId?: string;
}

export interface EpochActorLifeGoal {
  readonly goalId: string;
  readonly actorKind: EpochActorKind;
  readonly actorId: string;
  readonly category: EpochActorLifeGoalCategory;
  readonly description: string;
  readonly motivation: string;
  readonly effortWorldMinutes: number;
  readonly progressBps: number;
  readonly status: "active" | "achieved";
  readonly updatedWorldMinute: number;
  readonly sourceEventId?: string;
}

const DAILY_NEED_INCREASE: EpochActorNeedLevels = {
  hunger: 4_500,
  thirst: 6_000,
  fatigue: 4_000,
  elimination: 7_000,
  hygiene: 1_800,
  clothing: 250,
  shelter: 300,
  mobility: 500,
  safety: 600,
  belonging: 800,
  intimacy: 450,
  esteem: 550,
  learning: 650,
  purpose: 700,
};

const ACTION_FOR_NEED: Readonly<Record<EpochActorNeedKey, EpochActorNeedAction>> = {
  hunger: "eat",
  thirst: "drink",
  fatigue: "sleep",
  elimination: "relieve",
  hygiene: "wash",
  clothing: "secure_clothing",
  shelter: "seek_shelter",
  mobility: "travel",
  safety: "seek_safety",
  belonging: "socialize",
  intimacy: "seek_intimacy",
  esteem: "pursue_goal",
  learning: "study",
  purpose: "work",
};

const GOAL_ACTION: Readonly<Record<EpochActorLifeGoalCategory, EpochActorNeedAction>> = {
  work: "work",
  learning: "study",
  love: "seek_intimacy",
  revenge: "pursue_goal",
  wealth: "work",
  service: "work",
  exploration: "travel",
  mastery: "study",
};

const GOAL_COPY: Readonly<Record<EpochActorLifeGoalCategory, readonly [string, string]>> = {
  work: ["在自己的职业中站稳脚跟并承担更重要的职责", "稳定的工作能换来尊严、食宿与未来"],
  learning: ["系统掌握一门能够改变命运的知识", "理解世界比盲目服从更可靠"],
  love: ["建立一段彼此承诺且能够共同生活的亲密关系", "不愿在漫长人生中始终孤身一人"],
  revenge: ["查清旧怨并让造成伤害的人付出相称代价", "未清算的仇恨持续影响每一次选择"],
  wealth: ["积累足以保障衣食住行与自主选择的财富", "贫困会把人生交给别人支配"],
  service: ["长期保护、治疗或帮助自己认同的人群", "个人价值来自切实改善他人的处境"],
  exploration: ["亲自抵达未知地区并带回可靠见闻", "对边界之外的世界保持无法压抑的好奇"],
  mastery: ["把一项技艺磨炼到足以留下名声的程度", "只有反复实践才能把天赋变成真正能力"],
};

const PHYSIOLOGICAL_NEEDS = new Set<EpochActorNeedKey>([
  "hunger",
  "thirst",
  "fatigue",
  "elimination",
  "hygiene",
]);

const ACTION_SLOT_WORLD_MINUTES = 240;
const RECENT_ACTION_LIMIT = 16;
const PHYSIOLOGICAL_ACTION_THRESHOLD = 4_000;
const OTHER_ACTION_THRESHOLD = 6_500;
const GOAL_PROGRESS_PER_FULL_DAY_BPS = 600;

function boundedBps(value: number) {
  return Math.max(0, Math.min(10_000, Math.round(value)));
}

function deterministicBps(actorId: string, key: EpochActorNeedKey) {
  const digest = createHash("sha256").update(`${actorId}:${key}`).digest();
  return 800 + (digest.readUInt16BE(0) % 2_401);
}

function goalCategory(descriptor: string, traits: readonly string[]): EpochActorLifeGoalCategory {
  const text = `${descriptor} ${traits.join(" ")}`.toLowerCase();
  if (/enemy|rival|仇|敌|复仇/u.test(text)) return "revenge";
  if (/partner|spouse|lover|爱|恋|伴侣/u.test(text)) return "love";
  if (/救援|照料|治疗|医|保护|service|care/u.test(text)) return "service";
  if (/猎|外勤|勘探|测绘|旅行|探索|explor|scout/u.test(text)) return "exploration";
  if (/实验|研究|记录|校准|学习|见习|study|research/u.test(text)) return "learning";
  if (/工匠|技师|修炼|训练|craft|master/u.test(text)) return "mastery";
  if (/商|钱|财|wealth|trade/u.test(text)) return "wealth";
  return "work";
}

export function initialActorNeeds(
  actorKind: EpochActorKind,
  actorId: string,
  worldMinute = 0,
): EpochActorNeedsState {
  const levels = Object.fromEntries(EPOCH_ACTOR_NEED_KEYS.map((key) => [
    key,
    deterministicBps(actorId, key),
  ])) as unknown as EpochActorNeedLevels;
  const needIncreaseRemainders = Object.fromEntries(EPOCH_ACTOR_NEED_KEYS.map((key) => [
    key,
    0,
  ])) as unknown as EpochActorNeedLevels;
  return {
    actorKind,
    actorId,
    levels,
    lastAction: "pursue_goal",
    recentActions: [],
    actionRemainderMinutes: 0,
    needIncreaseRemainders,
    lastWorldMinute: Math.max(0, Math.floor(worldMinute)),
  };
}

export function initialActorLifeGoal(input: {
  readonly actorKind: EpochActorKind;
  readonly actorId: string;
  readonly descriptor: string;
  readonly traits?: readonly string[];
  readonly worldMinute?: number;
}): EpochActorLifeGoal {
  const category = goalCategory(input.descriptor, input.traits || []);
  const [description, motivation] = GOAL_COPY[category];
  return {
    goalId: `life_goal_${createHash("sha256").update(`${input.actorKind}:${input.actorId}:${category}`).digest("hex").slice(0, 24)}`,
    actorKind: input.actorKind,
    actorId: input.actorId,
    category,
    description,
    motivation,
    effortWorldMinutes: 0,
    progressBps: 0,
    status: "active",
    updatedWorldMinute: Math.max(0, Math.floor(input.worldMinute ?? 0)),
  };
}

function downtimeAction(mode: EpochDowntimeMode | undefined): EpochActorNeedAction | undefined {
  if (mode === "resting" || mode === "slacking") return "sleep";
  if (mode === "socialize") return "socialize";
  if (mode === "travel") return "travel";
  if (mode === "steward") return "work";
  if (mode === "meditation" || mode === "cultivation" || mode === "training") return "study";
  return undefined;
}

function actionRelief(action: EpochActorNeedAction): Partial<Record<EpochActorNeedKey, number>> {
  if (action === "eat") return { hunger: 7_500 };
  if (action === "drink") return { thirst: 8_500 };
  if (action === "sleep") return { fatigue: 8_000, safety: 600 };
  if (action === "relieve") return { elimination: 9_000, hygiene: 300 };
  if (action === "wash") return { hygiene: 8_000 };
  if (action === "secure_clothing") return { clothing: 6_000, safety: 500 };
  if (action === "seek_shelter") return { shelter: 6_500, safety: 1_000 };
  if (action === "travel") return { mobility: 6_000, purpose: 400 };
  if (action === "seek_safety") return { safety: 6_000 };
  if (action === "socialize") return { belonging: 6_000, esteem: 800 };
  if (action === "seek_intimacy") return { intimacy: 5_000, belonging: 1_500 };
  if (action === "work") return { purpose: 4_000, esteem: 1_000, clothing: 300, shelter: 300 };
  if (action === "study") return { learning: 5_000, purpose: 800, esteem: 400 };
  return { purpose: 3_500, esteem: 1_000 };
}

export function advanceActorNeeds(input: {
  readonly current: EpochActorNeedsState;
  readonly goal: EpochActorLifeGoal;
  readonly elapsedWorldMinutes: number;
  readonly toWorldMinute: number;
  readonly downtimeMode?: EpochDowntimeMode;
  readonly sourceEventId: string;
}) {
  const elapsed = Math.max(1, Math.floor(input.elapsedWorldMinutes));
  const levels = { ...input.current.levels } as Record<EpochActorNeedKey, number>;
  const needIncreaseRemainders = Object.fromEntries(EPOCH_ACTOR_NEED_KEYS.map((key) => [
    key,
    Math.max(0, Math.floor(input.current.needIncreaseRemainders?.[key] ?? 0)) % 1_440,
  ])) as Record<EpochActorNeedKey, number>;
  const actions: EpochActorNeedAction[] = [];
  let goalEffortMinutes = 0;
  let remainingMinutes = elapsed;
  let actionRemainderMinutes = Number.isFinite(input.current.actionRemainderMinutes)
    ? Math.max(0, Math.floor(input.current.actionRemainderMinutes)) % ACTION_SLOT_WORLD_MINUTES
    : 0;
  while (remainingMinutes > 0) {
    const minutesUntilAction = ACTION_SLOT_WORLD_MINUTES - actionRemainderMinutes;
    const slotMinutes = Math.min(remainingMinutes, minutesUntilAction);
    remainingMinutes -= slotMinutes;
    actionRemainderMinutes += slotMinutes;
    for (const key of EPOCH_ACTOR_NEED_KEYS) {
      const scaledIncrease = DAILY_NEED_INCREASE[key] * slotMinutes + needIncreaseRemainders[key];
      levels[key] = boundedBps(levels[key] + Math.floor(scaledIncrease / 1_440));
      needIncreaseRemainders[key] = scaledIncrease % 1_440;
    }
    if (actionRemainderMinutes < ACTION_SLOT_WORLD_MINUTES) continue;
    actionRemainderMinutes = 0;
    const urgentNeeds = [...EPOCH_ACTOR_NEED_KEYS]
      .sort((left, right) => levels[right] - levels[left] || left.localeCompare(right));
    const physiologicalNeed = urgentNeeds.find((key) =>
      PHYSIOLOGICAL_NEEDS.has(key) && levels[key] >= PHYSIOLOGICAL_ACTION_THRESHOLD);
    const otherNeed = urgentNeeds.find((key) => levels[key] >= OTHER_ACTION_THRESHOLD);
    const action = physiologicalNeed
      ? ACTION_FOR_NEED[physiologicalNeed]
      : otherNeed
        ? ACTION_FOR_NEED[otherNeed]
        : downtimeAction(input.downtimeMode) || GOAL_ACTION[input.goal.category];
    actions.push(action);
    for (const [key, relief] of Object.entries(actionRelief(action)) as [EpochActorNeedKey, number][]) {
      levels[key] = boundedBps(levels[key] - relief);
    }
    if (action === GOAL_ACTION[input.goal.category]) goalEffortMinutes += ACTION_SLOT_WORLD_MINUTES;
  }
  const previousEffort = Number.isFinite(input.goal.effortWorldMinutes)
    ? Math.max(0, Math.floor(input.goal.effortWorldMinutes))
    : Math.floor(input.goal.progressBps * 1_440 / GOAL_PROGRESS_PER_FULL_DAY_BPS);
  const effortWorldMinutes = previousEffort + goalEffortMinutes;
  const progressBps = boundedBps(
    Math.floor(effortWorldMinutes * GOAL_PROGRESS_PER_FULL_DAY_BPS / 1_440),
  );
  const recentActions = [
    ...(input.current.recentActions || []),
    ...actions,
  ].slice(-RECENT_ACTION_LIMIT);
  const lastAction = actions.at(-1) || input.current.lastAction;
  return {
    needs: {
      ...input.current,
      levels,
      lastAction,
      recentActions,
      actionRemainderMinutes,
      needIncreaseRemainders,
      lastWorldMinute: input.toWorldMinute,
      sourceEventId: input.sourceEventId,
    } satisfies EpochActorNeedsState,
    goal: {
      ...input.goal,
      effortWorldMinutes,
      progressBps,
      status: progressBps >= 10_000 ? "achieved" : "active",
      updatedWorldMinute: input.toWorldMinute,
      sourceEventId: input.sourceEventId,
    } satisfies EpochActorLifeGoal,
  };
}
