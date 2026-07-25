import type {
  JourneyEpisodeStoryBeat,
  PersistedJourneyNarrative,
  ServerJourneyEpisodeFacts,
} from "./journeyNarrativeRules.ts";
import { buildJourneyMission, type JourneyMission } from "./journeyMissionReadModel.ts";
import { publicRegionLabel, publicText } from "./publicVocabulary.ts";
import {
  journeyTaskActionForOptionKey,
  journeyTaskRouteForRegion,
} from "./journeyTaskCatalog.ts";
import type {
  JourneyCompletionResult,
  JourneyGeneratedTaskObjective,
  JourneyGeneratedTaskPlan,
  JourneyHiddenTaskSeal,
  JourneyRewardBundle,
  JourneyTierReward,
} from "./journeyGeneratedTaskRules.ts";
import {
  adjudicateJourneyTask,
  deriveLegacyTerminalTierFromAdjudication,
  inferJourneyCompletionResult,
  JOURNEY_TIER_REWARDS,
  journeyRewardBundleForPlan,
  nextJourneyTaskObjective,
} from "./journeyGeneratedTaskRules.ts";
import { formatEpochWorldTimeRange } from "./worldCalendar.ts";
import type { JourneyWorldCommit } from "./journeyRules.ts";

export interface JourneyStoryEpisodeInput {
  readonly episodeId: string;
  readonly title: string;
  readonly phase?: "arrival" | "main" | "side" | "return";
  readonly generatedTaskObjective?: JourneyGeneratedTaskObjective;
  readonly serverFacts?: ServerJourneyEpisodeFacts;
  readonly narrative?: PersistedJourneyNarrative;
  readonly settlement?: {
    readonly reward?: {
      readonly resourceId?: JourneyTierReward["resourceId"];
      readonly amount?: number;
    };
  };
}

export type JourneyStoryChapterKey =
  | "departure"
  | "arrival"
  | "encounter"
  | "decision"
  | "consequence"
  | "return"
  | "aftermath"
  | "objective"
  | "side_quest";

export interface GroundedJourneyStoryChapter {
  readonly key: JourneyStoryChapterKey;
  readonly title: string;
  readonly text: string;
  readonly episodeIds: readonly string[];
  readonly sourceEventIds: readonly string[];
}

export interface GroundedJourneyStoryReport {
  readonly kind: "grounded_story_report";
  readonly version: 3;
  readonly storyId: string;
  readonly journeyId: string;
  readonly title: string;
  readonly summary: string;
  readonly profile: {
    readonly codeName: string;
    readonly reincarnation: string;
    readonly identity: string;
    readonly objective: string;
  };
  readonly storyElements: {
    readonly time: string;
    readonly place: string;
    readonly characters: readonly string[];
    readonly beginning: string;
    readonly event: string;
    readonly action: string;
    readonly result: string;
  };
  readonly storyContent: string;
  readonly evaluation: {
    readonly taskCompletionGrade: "C" | "F" | "未及格" | "及格" | "良好" | "优秀" | "惊世";
    readonly performanceScorePercent?: number;
    readonly gradeReason?: string;
    readonly identityFidelityPercent: number;
    readonly rewards: JourneyRewardBundle & { readonly summary: string };
    readonly playerImpact: {
      readonly scope: "none" | "direct" | "shared_world" | "direct_and_shared";
      readonly affectedPlayers: readonly string[];
      readonly summary: string;
    };
    readonly worldCommit?: {
      readonly status: JourneyWorldCommit["status"];
      readonly summary: string;
    };
    readonly npcRelationships?: readonly JourneyWorldCommit["npcRelationships"][number][];
    readonly rewardConversion: {
      readonly summary: string;
      readonly entries: readonly {
        readonly source: string;
        readonly effect: string;
      }[];
    };
    readonly warning?: string;
  };
  readonly narrative: string;
  readonly chapters: readonly GroundedJourneyStoryChapter[];
  readonly mission: JourneyMission;
  readonly structure: {
    readonly desire: string;
    readonly obstacle: string;
    readonly choice: string;
    readonly consequence: string;
  };
  readonly resolution: {
    readonly journeyStatus: "completed";
    readonly missionStatus: "completed" | "failed";
    readonly objectiveStatus: "progressed" | "unresolved";
    readonly confirmedOutcome: string;
    readonly unresolved: string;
  };
  readonly episodeIds: readonly string[];
  readonly sourceEventIds: readonly string[];
}

export interface JourneyStoryIdentityInput {
  readonly status?: string;
  readonly lifetime?: {
    readonly max?: number;
    readonly remaining?: number;
    readonly startedAt?: string;
    readonly archivedAt?: string;
    readonly finalTitle?: string;
  };
  readonly personality?: {
    readonly traits?: readonly string[];
    readonly driftIds?: readonly string[];
  };
}

export interface BuildGroundedJourneyStoryReportInput {
  readonly journeyId: string;
  readonly status: string;
  readonly objective: string;
  readonly regionId: string;
  readonly startedAtWorldTime?: string;
  readonly dueAtWorldTime?: string;
  readonly episodes: readonly JourneyStoryEpisodeInput[];
  readonly taskPlan?: JourneyGeneratedTaskPlan;
  readonly hiddenTaskSeal?: JourneyHiddenTaskSeal;
  readonly worldCommit?: JourneyWorldCommit;
  readonly identity?: JourneyStoryIdentityInput;
}

function clean(value: string): string {
  return publicText(value).trim();
}

function sentence(value: string): string {
  const text = clean(value).replace(/[。！？!?]+$/u, "");
  return text ? `${text}。` : "";
}

function withAgentName(value: string, agentName: string): string {
  return sentence(clean(value).replace(/身份/gu, agentName));
}

function secondPersonSentence(value: string, identityName: string): string {
  return sentence(clean(value).replaceAll(identityName, "你").replace(/身份/gu, "你"));
}

function secondPersonAction(value: string, identityName: string): string {
  const action = clean(value)
    .replaceAll(identityName, "你")
    .replace(/身份/gu, "你")
    .replace(/^[，,。\s]+/u, "")
    .replace(/[。！？!?]+$/u, "");
  if (!action) return "";
  return sentence(/^你/u.test(action) ? action : `你${action}`);
}

function storyFacingGeneratedText(value: string, taskPlan: JourneyGeneratedTaskPlan): string {
  const priorWork = clean(taskPlan.title).replace(/任务/gu, "工作") || "先前的事情";
  return clean(value)
    .replace(/暂不介入支线“[^”]+”，继续主线/gu, "不参加这次额外协助")
    .replace(
      /根据身份需求、资源和长期目标放弃这项可选支线，不把跳过伪装成完成/gu,
      "你决定不参加这次额外协助，把精力留给接下来的行动",
    )
    .replace(
      /身份衡量当前状态后没有介入支线“[^”]+”，保留精力继续主线；该支线被服务器记录为跳过/gu,
      "你没有参加这次额外协助，把精力留给接下来的行动",
    )
    .replace(
      /身份没有完成“[^”]+”，该目标被服务器记录为跳过，并开始收束本局行动/gu,
      "你没有继续眼前的行动，随后开始准备返程",
    )
    .replace(
      /身份在([^；。]+)尝试“([^”]+)”；虽然完成了前置步骤，但关键条件没有全部达成，只能收束行动，“[^”]+”未完成/gu,
      "你在$1尝试$2。前置步骤完成后，关键条件仍未全部满足，你只能停止操作，预定的结果没有取得",
    )
    .replace(/^由现场参与者/gu, "请现场参与者")
    .replace(/地图中已经登记的对象/gu, "现场已有登记的对象")
    .replace(/地图中已存在对象的编号/gu, "现场对象已有的编号")
    .replace(/后续只进入这一条互斥路线/gu, "之后只按这一种方案继续")
    .replace(/后续行动转入对应路线/gu, "接下来的行动按选定方案展开")
    .replace(/核对新增对象与原任务的对应关系/gu, `核对新发现的对象与${priorWork}之间的联系`)
    .replace(/确认其与原任务的对应关系/gu, `确认它与${priorWork}之间的联系`)
    .replace(/支线开启的追加主线/gu, "沿现场新线索继续调查")
    .replace(/支线开启的新增对象/gu, "现场新发现的对象")
    .replace(/支线确认的新条件/gu, "先前协助中发现的新情况")
    .replace(/支线完成记录/gu, "先前协助的记录")
    .replace(/新增对象/gu, "新发现的对象")
    .replace(/原任务/gu, `先前的${priorWork}`)
    .replace(/签名行动记录/gu, "现场记录")
    .replace(/签名行动/gu, "现场选择")
    .replace(/行动事件/gu, "现场记录")
    .replace(/本局行动记录/gu, "这次行动记录")
    .replace(/本局行动/gu, "这次行动")
    .replace(/本局/gu, "这次经历")
    .replace(/直接执行路线/gu, "直接执行方案")
    .replace(/审慎核验路线/gu, "审慎核验方案")
    .replace(/直接路线/gu, "直接执行方案")
    .replace(/审慎路线/gu, "审慎核验方案")
    .replace(/互斥路线/gu, "不同方案")
    .replace(/对应路线/gu, "选定方案")
    .replace(/路线/gu, "方案")
    .replace(/任务范围/gu, "处理范围")
    .replace(/主任务/gu, "眼前的工作")
    .replace(/追加主线/gu, "后续调查")
    .replace(/主线/gu, "主要工作")
    .replace(/支线/gu, "额外调查")
    .replace(/任务/gu, "工作")
    .replace(/服务器/gu, "现场记录")
    .replace(/服务端/gu, "现场记录");
}

function firstFact(episode: JourneyStoryEpisodeInput): string {
  return episode.serverFacts?.confirmedFacts[0]?.text?.trim() || "";
}

function legacyStoryBeat(episode: JourneyStoryEpisodeInput): JourneyEpisodeStoryBeat | undefined {
  const fact = firstFact(episode);
  const match = /选择了「([^」]+)」；服务器结算：(.*)$/u.exec(fact);
  const outcome = episode.serverFacts?.stateChanges.find((change) => change.stateChangeId.endsWith(":outcome"))
    ?.summary?.trim() || match?.[2]?.trim();
  const phase = episode.phase;
  if (!phase || !match?.[1]?.trim() || !outcome) return undefined;
  return {
    phase,
    sceneTitle: episode.title,
    selectedAction: { label: match[1].trim() },
    outcomeSummary: outcome,
  };
}

function storyBeat(episode: JourneyStoryEpisodeInput): JourneyEpisodeStoryBeat | undefined {
  return episode.serverFacts?.storyBeat ?? legacyStoryBeat(episode);
}

function episodePhase(episode: JourneyStoryEpisodeInput): JourneyEpisodeStoryBeat["phase"] | undefined {
  return storyBeat(episode)?.phase ?? episode.phase;
}

function phaseEpisode(
  episodes: readonly JourneyStoryEpisodeInput[],
  phase: JourneyEpisodeStoryBeat["phase"],
  fallbackIndex: number,
): JourneyStoryEpisodeInput | undefined {
  return episodes.find((episode) => episodePhase(episode) === phase) ?? episodes[fallbackIndex];
}

function publicAgentEntity(episodes: readonly JourneyStoryEpisodeInput[]) {
  return episodes.flatMap((episode) => episode.serverFacts?.allowedEntities || [])
    .find((candidate) => candidate.kind === "agent" && candidate.displayName.trim());
}

function publicAgentName(episodes: readonly JourneyStoryEpisodeInput[]): string {
  const entity = publicAgentEntity(episodes);
  return clean(entity?.displayName || "该身份") || "该身份";
}

function chineseNumber(value: number): string {
  const digits = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九"] as const;
  if (!Number.isSafeInteger(value) || value < 1) return "一";
  if (value < 10) return digits[value] || String(value);
  if (value === 10) return "十";
  if (value < 20) return `十${digits[value % 10]}`;
  if (value < 100) return `${digits[Math.floor(value / 10)]}十${value % 10 ? digits[value % 10] : ""}`;
  return String(value);
}

function storyProfile(input: {
  readonly agentId: string;
  readonly agentName: string;
  readonly objective: string;
  readonly journeyId: string;
}): GroundedJourneyStoryReport["profile"] {
  const identityMatch = /^(.*?)\s*·\s*第(\d+)世$/u.exec(input.agentName);
  const identity = clean(identityMatch?.[1] || input.agentName) || "未知身份";
  const generation = Number(identityMatch?.[2] || 1);
  const compactId = (input.agentId || input.journeyId).replace(/[^a-z0-9]/giu, "").slice(-6).toUpperCase();
  return {
    codeName: `X-${compactId || "000001"}`,
    reincarnation: `轮回第${chineseNumber(generation)}世`,
    identity,
    objective: input.objective,
  };
}

function storyTime(startedAt: string | undefined, dueAt: string | undefined): string {
  return formatEpochWorldTimeRange(startedAt, dueAt);
}

const RESOURCE_NAMES: Readonly<Record<string, string>> = {
  coin: "金币",
  aether: "以太",
  legend: "身份传说度",
  focus: "专注",
  stamina: "体力",
};

const ATTRIBUTE_NAMES: Readonly<Record<string, string>> = {
  strength: "力量",
  agility: "敏捷",
  physique: "体魄",
  intellect: "智识",
  willpower: "意志",
  spirituality: "灵性",
};

const ITEM_RARITY_NAMES: Readonly<Record<string, string>> = {
  common: "普通",
  rare: "稀有",
  legendary: "传奇",
};

function rewardEvaluation(
  bundle: JourneyRewardBundle | undefined,
  episodes: readonly JourneyStoryEpisodeInput[] = [],
): GroundedJourneyStoryReport["evaluation"]["rewards"] {
  const resourceTotals = new Map<JourneyTierReward["resourceId"], number>();
  for (const reward of [
    ...(bundle?.resources ?? []),
    ...episodes.flatMap((episode) => {
      const resourceId = episode.settlement?.reward?.resourceId;
      const amount = episode.settlement?.reward?.amount;
      return resourceId && typeof amount === "number" && Number.isFinite(amount) && amount > 0
        ? [{ resourceId, amount }]
        : [];
    }),
  ]) {
    resourceTotals.set(reward.resourceId, (resourceTotals.get(reward.resourceId) ?? 0) + reward.amount);
  }
  const resources = [...resourceTotals].map(([resourceId, amount]) => ({ resourceId, amount }));
  const items = bundle?.items ?? [];
  const attributes = bundle?.attributes ?? [];
  const parts = [
    ...resources.map((reward) => `${RESOURCE_NAMES[reward.resourceId] ?? reward.resourceId} +${reward.amount}`),
    ...attributes.map((reward) => `${ATTRIBUTE_NAMES[reward.attributeId] ?? reward.attributeId} +${reward.amount}`),
    ...items.map((item) => `道具“${item.displayName}”（${ITEM_RARITY_NAMES[item.rarity] ?? item.rarity}）`),
  ];
  return {
    resources,
    items,
    attributeProgression: bundle?.attributeProgression ?? {
      mode: "no-direct-gain",
      evidenceSystem: "progressionRules.attributeEvidenceXp",
      summary: "story_report_no_direct_attribute_gain",
    },
    attributes,
    summary: parts.length ? parts.join("；") : "未获得独立奖励",
  };
}

function playerImpactEvaluation(
  episodes: readonly JourneyStoryEpisodeInput[],
  protagonistId: string,
  worldCommit?: JourneyWorldCommit,
): GroundedJourneyStoryReport["evaluation"]["playerImpact"] {
  const affectedPlayers = [...new Set(episodes.flatMap((episode) => {
    const selectedTargetIds = new Set(storyBeat(episode)?.selectedAction.targetEntityIds ?? []);
    return (episode.serverFacts?.allowedEntities ?? [])
      .filter((entity) => entity.kind === "agent"
        && entity.entityId !== protagonistId
        && (!episode.generatedTaskObjective || selectedTargetIds.has(entity.entityId)))
      .map((entity) => clean(entity.displayName))
      .filter(Boolean);
  }))];
  const sharedWorldChanges = episodes.flatMap((episode) =>
    (episode.serverFacts?.stateChanges ?? []).filter((change) =>
      change.stateChangeId.endsWith(":shared_world_impact")));
  const sharedWorldSummary = [...new Set(sharedWorldChanges
    .map((change) => clean(change.summary).replace(/[。；;\s]+$/u, ""))
    .filter(Boolean))]
    .join("；");
  if (worldCommit?.status === "solidified") {
    const regionLabel = clean(publicRegionLabel(worldCommit.regionId)) || "当地";
    const factionSummary = worldCommit.factionStandings.map((standing) => {
      const factionLabel = episodes
        .map((episode) => entityLabelById(episode, standing.factionId))
        .find(Boolean) || "相关阵营";
      return `${factionLabel}声望 +${standing.standingDelta}`;
    }).join("、");
    const relationshipSummary = worldCommit.npcRelationships.map((relationship) =>
      `与${relationship.displayName}的关系 +${relationship.scoreDelta}`).join("、");
    const committedSummary = [
      `主线完成后，本局已固化进真实世界，${regionLabel}地区影响 +${worldCommit.influenceDelta}`,
      factionSummary,
      relationshipSummary,
    ].filter(Boolean).join("；");
    return {
      scope: affectedPlayers.length ? "direct_and_shared" : "shared_world",
      affectedPlayers,
      summary: affectedPlayers.length
        ? `${naturalList(affectedPlayers)}直接参与了本局；${committedSummary}。`
        : `${committedSummary}；其他玩家之后会看到这些变化。`,
    };
  }
  if (worldCommit?.status === "discarded") {
    const discardSummary = worldCommit.reason === "quality_below_canon_threshold"
      ? "主线虽已完成，但服务端评分未达到正史固化门槛，镜像结果未写入真实世界"
      : "主线未完成，镜像结果未写入真实世界";
    return {
      scope: affectedPlayers.length ? "direct" : "none",
      affectedPlayers,
      summary: affectedPlayers.length
        ? `${naturalList(affectedPlayers)}直接参与过镜像对局；${discardSummary}。`
        : `${discardSummary}；真实世界的地区、阵营与 NPC 关系均未改变。`,
    };
  }
  if (affectedPlayers.length && sharedWorldChanges.length) return {
    scope: "direct_and_shared",
    affectedPlayers,
    summary: `${naturalList(affectedPlayers)}直接参与了本局，相关相遇记录已进入对方的交互收件箱；${sharedWorldSummary}。`,
  };
  if (affectedPlayers.length) return {
    scope: "direct",
    affectedPlayers,
    summary: `${naturalList(affectedPlayers)}直接参与了本局；相关相遇记录已进入对方的交互收件箱，未记录的资源或身份变化不会被补写。`,
  };
  if (sharedWorldChanges.length) return {
    scope: "shared_world",
    affectedPlayers: [],
    summary: `${sharedWorldSummary}。其他玩家会在地区活动、影响记录与后续世界状态中看到这项结果。`,
  };
  return {
    scope: "none",
    affectedPlayers: [],
    summary: "未记录其他玩家直接参与；本局没有对其他玩家增减资源或改写身份。",
  };
}

function worldCommitEvaluation(worldCommit: JourneyWorldCommit | undefined) {
  if (!worldCommit) return {};
  return {
    worldCommit: {
      status: worldCommit.status,
      summary: worldCommit.status === "solidified"
        ? `主线完成并安全返程，本局已固化；地区影响 +${worldCommit.influenceDelta}，NPC 关系 ${worldCommit.npcRelationships.length} 项。`
        : worldCommit.reason === "quality_below_canon_threshold"
          ? "主线已完成，但服务端评分低于正史固化门槛，本局镜像未固化。"
          : "主线未完成或未形成安全返程闭环，本局镜像未固化。",
    },
    npcRelationships: worldCommit.npcRelationships,
  } as const;
}

function rewardConversionEvaluation(
  rewards: GroundedJourneyStoryReport["evaluation"]["rewards"],
  worldCommit: JourneyWorldCommit | undefined,
): GroundedJourneyStoryReport["evaluation"]["rewardConversion"] {
  const entries: { source: string; effect: string }[] = [];
  for (const reward of rewards.resources) {
    const label = `${RESOURCE_NAMES[reward.resourceId] ?? reward.resourceId} +${reward.amount}`;
    switch (reward.resourceId) {
      case "focus":
        entries.push({
          source: label,
          effect: "直接进入突袭防守公式：每 1 点专注约等于 +3 防守力；也可用于社交托管和部分道具条件。",
        });
        break;
      case "stamina":
        entries.push({
          source: label,
          effect: "可投入主动突袭或反击：每 1 点体力约等于 +2 进攻强度；也支撑训练、旅行和体能类制作。",
        });
        break;
      case "legend":
        entries.push({
          source: label,
          effect: "直接进入防守/反击公式：每 1 点身份传说度约等于 +1 威慑或反击强度。",
        });
        break;
      case "aether":
        entries.push({
          source: label,
          effect: "用于修炼、灵质制作与异常处理，偏长期能力成长，不直接按点数进入普通突袭公式。",
        });
        break;
      case "coin":
        entries.push({
          source: label,
          effect: "用于交易、补给、商店购买和制作材料；金币本身不直接增加突袭战斗力，但可间接换成装备或准备资源。",
        });
        break;
      default:
        entries.push({
          source: label,
          effect: "已进入身份资源账，可在后续服务端规则允许的行动中消耗或转化。",
        });
        break;
    }
  }
  for (const reward of rewards.attributes) {
    const label = `${ATTRIBUTE_NAMES[reward.attributeId] ?? reward.attributeId} +${reward.amount}`;
    const effectByAttribute: Readonly<Record<string, string>> = {
      strength: "提升力量属性；服务端高风险判定会读取属性账本，属性总值会作为隐藏能力分的一部分。",
      agility: "提升敏捷属性；服务端高风险判定会读取属性账本，属性总值会作为隐藏能力分的一部分。",
      physique: "提升体魄属性；服务端高风险判定会读取属性账本，属性总值会作为隐藏能力分的一部分。",
      intellect: "提升智识属性；服务端高风险判定会读取属性账本，属性总值会作为隐藏能力分的一部分。",
      willpower: "提升意志属性；服务端高风险判定会读取属性账本，属性总值会作为隐藏能力分的一部分。",
      spirituality: "提升灵性属性；服务端高风险判定会读取属性账本，属性总值会作为隐藏能力分的一部分。",
    };
    entries.push({
      source: label,
      effect: effectByAttribute[reward.attributeId] ?? "已进入人物属性账本，会影响后续服务端能力判定。",
    });
  }
  for (const item of rewards.items) {
    const rarityName = ITEM_RARITY_NAMES[item.rarity] ?? item.rarity;
    entries.push({
      source: `道具/装备“${item.displayName}”（${rarityName}）`,
      effect: item.rarity === "legendary"
        ? "传奇物品会进入物品栏；后续高风险行动会按库存中最高稀有度的两件道具/装备计入服务端隐藏装备分，也可作为身份传说与高阶路线证据。"
        : item.rarity === "rare"
          ? "稀有物品会进入物品栏；后续高风险行动会按库存中最高稀有度的两件道具/装备计入服务端隐藏装备分，也可用于制作、交易、证明或路线解锁。"
          : "普通物品会进入物品栏；后续高风险行动会按库存中最高稀有度的两件道具/装备计入服务端隐藏装备分，也可用于基础制作、交易或证明。",
    });
  }
  if (worldCommit?.status === "solidified") {
    for (const standing of worldCommit.factionStandings) {
      const powerBonus = Math.min(3, Math.floor(standing.standingAfter / 2));
      entries.push({
        source: `阵营声望 +${standing.standingDelta}`,
        effect: `已固化为真实世界阵营记录；跨阵营战斗会按赛季声望提供战力加成，当前可计算加成约 +${powerBonus}（封顶 +3）。`,
      });
    }
    for (const relationship of worldCommit.npcRelationships) {
      entries.push({
        source: `${relationship.displayName}关系 +${relationship.scoreDelta}`,
        effect: "已固化为 NPC 关系与记忆，偏情报、协助、引荐和后续路线解锁；当前不直接加入突袭伤害公式。",
      });
    }
  }
  if (!entries.length) {
    return {
      summary: "本局没有获得可转化奖励；身份能力没有新增直接数值来源。",
      entries,
    };
  }
  const conversionParts = entries.map((entry) =>
    `${entry.source}：${entry.effect.replace(/[。；;\s]+$/u, "")}`);
  return {
    summary: `${conversionParts.join("；")}。`,
    entries,
  };
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function identityFidelityEvaluation(input: {
  readonly identity?: JourneyStoryIdentityInput;
  readonly journeyStatus: string;
  readonly missionStatus: JourneyMission["status"];
  readonly worldCommit?: JourneyWorldCommit;
}): Pick<GroundedJourneyStoryReport["evaluation"], "identityFidelityPercent" | "warning"> {
  if (!input.identity) {
    const identityEnded = input.journeyStatus === "identity_ended";
    const fallbackPercent = identityEnded
      ? 0
      : input.worldCommit?.status === "solidified"
        ? 72
        : input.missionStatus === "completed"
          ? 60
          : 35;
    return {
      identityFidelityPercent: fallbackPercent,
      ...(identityEnded ? { warning: "该身份已经终结，无法继续保留。" } : {}),
    };
  }

  const lifetimeMax = finiteNumber(input.identity.lifetime?.max);
  const lifetimeRemaining = finiteNumber(input.identity.lifetime?.remaining);
  const hasLifetime = lifetimeMax !== undefined && lifetimeMax > 0 && lifetimeRemaining !== undefined;
  const lifetimePercent = hasLifetime
    ? clampPercent((Math.max(0, lifetimeRemaining) / lifetimeMax) * 100)
    : 60;
  const traitCount = input.identity.personality?.traits?.filter((trait) => clean(trait)).length ?? 0;
  const traitBonus = Math.min(8, traitCount * 2);
  const missionAdjustment = input.missionStatus === "completed" ? 6 : -8;
  const commitAdjustment = input.worldCommit?.status === "solidified"
    ? 6
    : input.worldCommit?.status === "discarded"
      ? -6
      : 0;
  const archived = input.identity.status === "archived" || Boolean(input.identity.lifetime?.archivedAt);
  const identityEnded = input.journeyStatus === "identity_ended";
  let percent = clampPercent((lifetimePercent * 0.82) + traitBonus + missionAdjustment + commitAdjustment);
  if (hasLifetime && lifetimeRemaining <= 0) percent = 0;
  if (archived || identityEnded) percent = Math.min(percent, hasLifetime && lifetimeRemaining <= 0 ? 0 : 20);

  const remainingRatio = hasLifetime ? Math.max(0, lifetimeRemaining) / lifetimeMax : undefined;
  let warning: string | undefined;
  if (identityEnded) warning = "该身份已经终结，无法继续保留。";
  else if (archived && input.missionStatus === "failed") warning = "本局未及格，身份已经剧情终结并归档，无法继续保留。";
  else if (archived) warning = "该身份已经归档，后续只能作为历史身份保留。";
  else if (hasLifetime && lifetimeRemaining <= 0) warning = "该身份寿命已耗尽，无法继续保留。";
  else if (remainingRatio !== undefined && remainingRatio <= 0.15) warning = "该身份寿命濒危，建议尽快归档或转生。";

  return {
    identityFidelityPercent: percent,
    ...(warning ? { warning } : {}),
  };
}

function sourceEventIds(episodes: readonly JourneyStoryEpisodeInput[]): readonly string[] {
  return [...new Set(episodes.flatMap((episode) => episode.serverFacts?.sourceEventIds || []))];
}

function reportSourceEventIds(
  episodes: readonly JourneyStoryEpisodeInput[],
  worldCommit: JourneyWorldCommit | undefined,
): readonly string[] {
  return [...new Set([...sourceEventIds(episodes), ...(worldCommit?.sourceEventIds ?? [])])];
}

function entityLabels(
  episode: JourneyStoryEpisodeInput,
  kind: ServerJourneyEpisodeFacts["allowedEntities"][number]["kind"],
  targetOnly = false,
): readonly string[] {
  const targetIds = new Set(storyBeat(episode)?.selectedAction.targetEntityIds || []);
  return [...new Set((episode.serverFacts?.allowedEntities || [])
    .filter((entity) => entity.kind === kind
      && (!targetOnly || targetIds.size === 0 || targetIds.has(entity.entityId)))
    .map((entity) => clean(entity.displayName))
    .filter(Boolean))];
}

function entityLabelById(episode: JourneyStoryEpisodeInput, entityId: string): string | undefined {
  const entity = episode.serverFacts?.allowedEntities.find((candidate) => candidate.entityId === entityId);
  const label = clean(entity?.displayName || "");
  return label || undefined;
}

function carryObjectText(value: string) {
  return clean(value)
    .replace(/^(?:带回|携带|获得|取得)\s*/u, "")
    .replace(/(?:并)?安全返程[。.]?$/u, "")
    || "任务物品";
}

function archivedResultText(value: string) {
  const result = clean(value).replace(/[。！？!?]+$/u, "");
  return /归档(?:完成|完毕)?$/u.test(result) ? result : `${result}已经在现场归档`;
}

function naturalList(values: readonly string[]): string {
  if (values.length <= 1) return values[0] || "";
  if (values.length === 2) return `${values[0]}和${values[1]}`;
  return `${values.slice(0, -1).join("、")}和${values.at(-1)}`;
}

function arrivalStoryOutcome(
  beat: JourneyEpisodeStoryBeat,
  agentName: string,
  regionName: string,
  identityName: string,
): string {
  switch (beat.selectedAction.optionKey) {
    case "enter_gray_harbor":
      return `${agentName}沿登记路线通过入口。来路和抵达信息完成登记后，${agentName}进入${regionName}城区。`;
    case "enter_destination":
      return `${agentName}沿已确认路线通过入口，完成到达记录后进入${regionName}。`;
    case "review_arrival_route":
      return `${agentName}在入口重新核对来路与返程时间，确认自己仍有足够时间进城办事。`;
    case "turn_back_before_entry":
      return `${agentName}最终没有进城，而是从入口沿原路返回。`;
    default:
      return secondPersonSentence(beat.outcomeSummary, identityName);
  }
}

function mainStoryOutcome(input: {
  readonly beat: JourneyEpisodeStoryBeat;
  readonly agentName: string;
  readonly place: string;
  readonly organization: string;
  readonly person: string;
  readonly item: string;
  readonly identityName: string;
}): string {
  const { beat, agentName, place, organization, person, item, identityName } = input;
  switch (beat.selectedAction.optionKey) {
    case "verify_salt_ledger":
      return `${agentName}依照${organization}的登记逐项核对${item}。核对中出现一处差额，${agentName}把原条目和对应记录标在一起，保留了核对结果。`;
    case "carry_manifest":
      return `${agentName}把${item}送到${person}手中，清单内容、递送人和当班接收人完成登记。`;
    case "report_discrepancy":
      return `${agentName}把${item}中的差额指给${person}，并对应到${organization}的原始登记。${person}接手复核。`;
    case "ask_for_shift":
      return `${person}查阅${organization}的当日登记，向${agentName}指出一项仍需确认工时与条件的短工。`;
    case "ask_about_recent_travelers":
      return `${agentName}向${person}询问近日旅人的消息。${person}只说出了公开登记中能对上的姓名和来路。`;
    case "leave_without_commitment":
      return `${agentName}没有接受条件尚不清楚的事务。${agentName}向${person}说明决定，随后离开${place}；这次会面没有变成一份工作。`;
    default:
      return secondPersonSentence(beat.outcomeSummary, identityName);
  }
}

function returnStoryOutcome(
  beat: JourneyEpisodeStoryBeat,
  agentName: string,
  regionName: string,
  identityName: string,
  completionResult?: JourneyCompletionResult,
): string {
  switch (beat.selectedAction.optionKey) {
    case "return_by_known_route": {
      const result = completionResult ?? inferJourneyCompletionResult("现场结果");
      if (result.returnMode === "carry") {
        return `${agentName}沿来时确认过的路线离开${regionName}，带着${carryObjectText(result.summary)}回到落脚处。`;
      }
      if (result.returnMode === "report") {
        return `${agentName}确认${archivedResultText(result.summary)}，记下交付回执后沿来时确认过的路线离开${regionName}，回到落脚处。`;
      }
      return `${agentName}确认${clean(result.summary).replace(/[。！？!?]+$/u, "")}，随后沿来时确认过的路线离开${regionName}，回到落脚处。`;
    }
    case "record_verified_facts":
      return `${agentName}在离开前整理好抵达经过、所作选择和直接后果，随后带着这份记录返程。`;
    case "wait_for_safe_departure":
      return `${agentName}等到安全的返程时机才离开${regionName}，没有为了赶路冒险改道。`;
    default:
      return secondPersonSentence(beat.outcomeSummary, identityName);
  }
}

function returnStoryLead(input: {
  readonly optionKey?: string;
  readonly item: string;
  readonly person: string;
  readonly place: string;
  readonly resultArtifact?: string;
}): string {
  switch (input.optionKey) {
    case "verify_salt_ledger":
      return `你带上标着差额的核对记录，离开${input.place}。`;
    case "carry_manifest":
      return `确认${input.item}已交到${input.person}手中后，你离开${input.place}。`;
    case "report_discrepancy":
      return `你记下${input.person}已接手复核的结果，离开${input.place}。`;
    case "ask_for_shift":
      return `你把问到的工时和条件记好，离开${input.place}。`;
    case "ask_about_recent_travelers":
      return `你带上能够对上登记的姓名和来路，离开${input.place}。`;
    case "leave_without_commitment":
      return `你没有接下任何事，直接离开${input.place}。`;
    default:
      return input.resultArtifact
        ? `你带上${input.resultArtifact}，离开${input.place}。`
        : `你收好这次留下的记录，离开${input.place}。`;
  }
}

function decisionStoryAction(input: {
  readonly beat: JourneyEpisodeStoryBeat;
  readonly person: string;
  readonly item: string;
  readonly place: string;
}): string {
  const taskAction = journeyTaskActionForOptionKey(input.beat.selectedAction.optionKey);
  if (taskAction) return sentence(taskAction.actionNarrative);
  switch (input.beat.selectedAction.optionKey) {
    case "verify_salt_ledger":
      return `你开始逐项核对${input.item}和原始登记。`;
    case "carry_manifest":
      return `你接过${input.item}，核对递送对象后动身交接。`;
    case "report_discrepancy":
      return `你把${input.item}和原始登记并排放好，再把差额指给${input.person}。`;
    case "ask_for_shift":
      return `你向${input.person}询问当日仍缺人手的班次。`;
    case "ask_about_recent_travelers":
      return `你请${input.person}翻查近期公开的旅人登记。`;
    case "leave_without_commitment":
      return `你向${input.person}说明决定，随后转身离开${input.place}。`;
    default:
      return sentence(clean(input.beat.outcomeSummary).replace(/身份/gu, "你"));
  }
}

function aftermathStoryOutcome(input: {
  readonly optionKey?: string;
  readonly mainSucceeded: boolean;
  readonly item: string;
  readonly person: string;
  readonly regionName: string;
  readonly resultArtifact?: string;
}): string {
  if (!input.mainSucceeded) {
    return `你回到落脚处，手里只有沿途记录，没有带回一件已经办完的事情。`;
  }
  switch (input.optionKey) {
    case "verify_salt_ledger":
      return `你在返程时限前回到落脚处，带回了标着差额的核对记录。`;
    case "carry_manifest":
      return `你在返程时限前回到落脚处，带回了${input.item}已经交到${input.person}手中的明确结果。`;
    case "report_discrepancy":
      return `你在返程时限前回到落脚处，带回了${input.item}差额已交给${input.person}复核的记录。`;
    default:
      return input.resultArtifact
        ? `你在返程时限前回到落脚处，带回了${input.resultArtifact}。`
        : `你在返程时限前回到落脚处，把这次在${input.regionName}得到的结果和沿途记录一起带了回来。`;
  }
}

function mainChapterTitles(optionKey: string | undefined, fallbackTitle: string) {
  const taskAction = journeyTaskActionForOptionKey(optionKey);
  if (taskAction) {
    return {
      encounter: `三、${fallbackTitle}`,
      decision: `四、${taskAction.chapterTitle}`,
      consequence: "五、行动结果",
    };
  }
  switch (optionKey) {
    case "verify_salt_ledger":
      return { encounter: "三、账房里的盐账", decision: "四、核对盐账", consequence: "五、发现差额" };
    case "carry_manifest":
      return { encounter: "三、等待递送的清单", decision: "四、接下差事", consequence: "五、完成交接" };
    case "report_discrepancy":
      return { encounter: "三、清单上的缺口", decision: "四、指出差额", consequence: "五、进入复核" };
    case "ask_for_shift":
      return { encounter: "三、当日短工", decision: "四、询问条件", consequence: "五、尚未落定" };
    case "ask_about_recent_travelers":
      return { encounter: "三、登记里的旅人", decision: "四、追问消息", consequence: "五、传闻止步" };
    case "leave_without_commitment":
      return { encounter: "三、条件未明的差事", decision: "四、拒绝承诺", consequence: "五、空手离开" };
    default:
      return { encounter: `三、${fallbackTitle}`, decision: "四、作出选择", consequence: "五、选择的后果" };
  }
}

function chapter(input: {
  readonly key: JourneyStoryChapterKey;
  readonly title: string;
  readonly text: string;
  readonly episodes: readonly JourneyStoryEpisodeInput[];
}): GroundedJourneyStoryChapter {
  return {
    key: input.key,
    title: input.title,
    text: input.text,
    episodeIds: input.episodes.map((episode) => episode.episodeId),
    sourceEventIds: sourceEventIds(input.episodes),
  };
}

function storyReady(input: BuildGroundedJourneyStoryReportInput): boolean {
  if (!["settled", "completed"].includes(input.status)) return false;
  if (input.taskPlan) {
    if (input.episodes.length < 3 || nextJourneyTaskObjective(input.taskPlan, input.episodes)) return false;
  } else if (input.episodes.length !== 3) return false;
  return input.episodes.every((episode) => episode.serverFacts
    && episode.narrative
    && storyBeat(episode)
    && episode.serverFacts.journeyId === input.journeyId
    && episode.serverFacts.episodeId === episode.episodeId
    && episode.serverFacts.sourceEventIds.length > 0);
}

export function buildGroundedJourneyStoryReport(
  input: BuildGroundedJourneyStoryReportInput,
): GroundedJourneyStoryReport | undefined {
  if (!storyReady(input)) return undefined;
  if (input.taskPlan) return buildGeneratedJourneyStoryReport(input, input.taskPlan);
  const arrival = phaseEpisode(input.episodes, "arrival", 0);
  const main = phaseEpisode(input.episodes, "main", 1);
  const returning = phaseEpisode(input.episodes, "return", 2);
  if (!arrival || !main || !returning) return undefined;
  const arrivalBeat = storyBeat(arrival);
  const mainBeat = storyBeat(main);
  const returnBeat = storyBeat(returning);
  if (!arrivalBeat || !mainBeat || !returnBeat) return undefined;

  const protagonist = publicAgentEntity(input.episodes);
  const agentName = publicAgentName(input.episodes);
  const actorName = "你";
  const regionName = clean(publicRegionLabel(input.regionId)) || "未知区域";
  const taskRoute = journeyTaskRouteForRegion(input.regionId);
  const objective = clean(input.objective) || "完成这次旅程";
  const profile = storyProfile({
    agentId: protagonist?.entityId || "",
    agentName,
    objective,
    journeyId: input.journeyId,
  });
  const mission = buildJourneyMission({
    journeyId: input.journeyId,
    journeyStatus: input.status,
    playerObjective: objective,
    regionId: input.regionId,
    episodes: input.episodes,
  });
  const missionObjective = clean(mission.primaryObjective).replace(/[。！？!?]+$/u, "");
  const mainTitle = clean(mainBeat.sceneTitle) || `${regionName}主事件`;
  const routeLocation = taskRoute?.worldObjects.find((object) => object.id === taskRoute.locationId)?.label;
  const mainPlaces = entityLabels(main, "place", true).filter((label) => label !== regionName);
  const mainPlace = routeLocation || mainPlaces[0] || regionName;
  const organizations = entityLabels(main, "organization", true);
  const people = [...new Set([
    ...entityLabels(main, "person"),
    ...entityLabels(main, "agent").filter((label) => label !== agentName),
  ])];
  const items = entityLabels(main, "item", true);
  const mainOutcome = withAgentName(mainBeat.outcomeSummary, agentName);
  const arrivalProse = arrivalStoryOutcome(arrivalBeat, actorName, regionName, agentName);
  const organization = naturalList(organizations) || "当地任务方";
  const person = naturalList(people) || "现场负责人";
  const item = naturalList(items) || "任务对象";
  const mainProse = mainStoryOutcome({
    beat: mainBeat,
    agentName: actorName,
    place: mainPlace,
    organization,
    person,
    item,
    identityName: agentName,
  });
  const returnProse = returnStoryOutcome(
    returnBeat,
    actorName,
    regionName,
    agentName,
    taskRoute?.mission.successResult
      ? inferJourneyCompletionResult(taskRoute.mission.successResult)
      : undefined,
  );
  const decisionProse = decisionStoryAction({ beat: mainBeat, person, item, place: mainPlace });
  const returnLead = returnStoryLead({
    optionKey: mainBeat.selectedAction.optionKey,
    item,
    person,
    place: mainPlace,
    resultArtifact: taskRoute?.mission.successResult,
  });
  const objectiveStatus = mission.status === "completed" ? "progressed" : "unresolved";
  const unresolved = mission.status === "completed"
    ? `这次任务已经完成；“${objective}”仍可以在后续旅程中继续展开。`
    : `这次任务已经失败；“${objective}”仍等待下一次行动。`;
  const mainSucceeded = mission.status === "completed";
  const rewards = rewardEvaluation(undefined, input.episodes);
  const evaluation: GroundedJourneyStoryReport["evaluation"] = {
    taskCompletionGrade: mainSucceeded ? "C" : "F",
    ...identityFidelityEvaluation({
      identity: input.identity,
      journeyStatus: input.status,
      missionStatus: mission.status,
      worldCommit: input.worldCommit,
    }),
    rewards,
    rewardConversion: rewardConversionEvaluation(rewards, input.worldCommit),
    playerImpact: playerImpactEvaluation(input.episodes, protagonist?.entityId || "", input.worldCommit),
    ...worldCommitEvaluation(input.worldCommit),
  };
  const chapterTitles = mainChapterTitles(mainBeat.selectedAction.optionKey, mainTitle);
  const time = storyTime(input.startedAtWorldTime, input.dueAtWorldTime);
  const aftermathProse = aftermathStoryOutcome({
    optionKey: mainBeat.selectedAction.optionKey,
    mainSucceeded,
    item,
    person,
    regionName,
    resultArtifact: taskRoute?.mission.successResult,
  });
  const resultProse = `${returnProse}${aftermathProse}`;
  const beginning = `你现在已经转生成为${profile.identity}。${time}。你离开落脚处，沿着通往${regionName}的登记路线出发。`;
  const storyElements: GroundedJourneyStoryReport["storyElements"] = {
    time,
    place: `${regionName}、${mainPlace}`,
    characters: [...new Set([profile.identity, ...people])],
    beginning,
    event: mainProse,
    action: decisionProse,
    result: resultProse,
  };

  const chapters = [
    chapter({
      key: "departure",
      title: "一、转生与出发",
      episodes: [arrival],
      text: beginning,
    }),
    chapter({
      key: "arrival",
      title: `二、抵达${regionName}`,
      episodes: [arrival],
      text: `你沿登记路线抵达${regionName}入口。${arrivalProse}手续结束后，你没有停留，直接前往${mainPlace}。`,
    }),
    chapter({
      key: "encounter",
      title: chapterTitles.encounter,
      episodes: [main],
      text: `抵达${regionName}后，你来到${mainPlace}。${person}已经在这里等候。`,
    }),
    chapter({
      key: "decision",
      title: chapterTitles.decision,
      episodes: [main],
      text: decisionProse,
    }),
    chapter({
      key: "consequence",
      title: chapterTitles.consequence,
      episodes: [main],
      text: mainProse,
    }),
    chapter({
      key: "return",
      title: "六、返程",
      episodes: [returning],
      text: `${returnLead}${returnProse}`,
    }),
    chapter({
      key: "aftermath",
      title: "七、结果",
      episodes: input.episodes,
      text: aftermathProse,
    }),
  ] as const;

  const desire = `${agentName}的长期愿望是“${objective}”，本局主任务是“${missionObjective}”。`;
  const obstacle = `${agentName}必须完成三项阶段任务，其中核心关卡是在${mainPlace}完成${taskRoute?.title ?? "登记事务"}。`;
  const choice = `${agentName}选择了「${clean(mainBeat.selectedAction.label)}」。`;
  const consequence = `${mainProse}${returnProse}`;
  const summary = mainSucceeded
    ? `${profile.identity}进入${regionName}，选择了「${clean(mainBeat.selectedAction.label)}」，随后带着处理结果返回。`
    : `${profile.identity}进入${regionName}后选择了「${clean(mainBeat.selectedAction.label)}」，随后没有带回对应的处理结果。`;
  const storyContent = chapters.map((entry) => entry.text).join("\n\n");
  const header = [
    `代号：${profile.codeName}`,
    `${profile.reincarnation}。`,
    `身份：${profile.identity}`,
    `该局目标：${profile.objective}`,
  ].join("\n");
  const evaluationText = [
    "评价：",
    `任务完成度：${evaluation.taskCompletionGrade}`,
    `身份还原度：${evaluation.identityFidelityPercent}%`,
    `获得奖励：${evaluation.rewards.summary}`,
    `能力转化：${evaluation.rewardConversion.summary}`,
    ...(evaluation.worldCommit ? [`世界固化：${evaluation.worldCommit.summary}`] : []),
    ...(evaluation.npcRelationships?.length ? [
      `NPC关系：${evaluation.npcRelationships.map((relationship) =>
        `${relationship.displayName} +${relationship.scoreDelta}（当前 ${relationship.scoreAfter}）`).join("；")}`,
    ] : []),
    `其他玩家影响：${evaluation.playerImpact.summary}`,
    ...(evaluation.warning ? [`警告：${evaluation.warning}`] : []),
  ].join("\n");

  return {
    kind: "grounded_story_report",
    version: 3,
    storyId: `story:${input.journeyId}`,
    journeyId: input.journeyId,
    title: `代号 ${profile.codeName}：${profile.identity}的${profile.reincarnation}`,
    summary,
    profile,
    storyElements,
    storyContent,
    evaluation,
    narrative: [header, "故事内容：", storyContent, evaluationText].join("\n\n"),
    chapters,
    mission,
    structure: { desire, obstacle, choice, consequence },
    resolution: {
      journeyStatus: "completed",
      missionStatus: mission.status === "completed" ? "completed" : "failed",
      objectiveStatus,
      confirmedOutcome: mainOutcome,
      unresolved,
    },
    episodeIds: input.episodes.map((episode) => episode.episodeId),
    sourceEventIds: reportSourceEventIds(input.episodes, input.worldCommit),
  };
}

function buildGeneratedJourneyStoryReport(
  input: BuildGroundedJourneyStoryReportInput,
  taskPlan: JourneyGeneratedTaskPlan,
): GroundedJourneyStoryReport | undefined {
  const arrival = input.episodes.find((episode) => episodePhase(episode) === "arrival");
  const returning = input.episodes.find((episode) => episodePhase(episode) === "return");
  if (!arrival || !returning || !storyBeat(arrival) || !storyBeat(returning)) return undefined;
  const planObjectiveIds = new Set(taskPlan.objectives.map((objective) => objective.objectiveId));
  const groundedObjectives = input.episodes.filter((episode) =>
    episode.generatedTaskObjective
    && planObjectiveIds.has(episode.generatedTaskObjective.objectiveId));
  if (!groundedObjectives.length || groundedObjectives.some((episode) => !storyBeat(episode))) return undefined;
  const protagonist = publicAgentEntity(input.episodes);
  const agentName = publicAgentName(input.episodes);
  const regionName = clean(publicRegionLabel(input.regionId)) || "未知区域";
  const objective = clean(input.objective) || taskPlan.taskType;
  const profile = storyProfile({
    agentId: protagonist?.entityId || "",
    agentName,
    objective,
    journeyId: input.journeyId,
  });
  const mission = buildJourneyMission({
    journeyId: input.journeyId,
    journeyStatus: input.status,
    playerObjective: objective,
    regionId: input.regionId,
    episodes: input.episodes,
    taskPlan,
    hiddenTaskSeal: input.hiddenTaskSeal,
  });
  const adjudication = adjudicateJourneyTask({
    plan: taskPlan,
    episodes: input.episodes,
    hiddenTaskSeal: input.hiddenTaskSeal,
    revealHidden: true,
  });
  // PR4: adjudication no longer carries tier/rewardBundle (the authority tier
  // lives on SettlementDecision.tier). This story report is for terminal
  // journey narrative; derive the legacy tier from the physical adjudication
  // via the legacy helper. PR4 callers reading the worldCommit block read
  // SettlementDecision.tier through the world commit's reason, not this.
  const legacyTerminalTier = deriveLegacyTerminalTierFromAdjudication(adjudication, true);
  // PR4: adjudication no longer carries rewardBundle either; rebuild it via
  // the legacy helper so the story report's reward evaluation stays aligned
  // with the public taskAdjudication projection (which goes through the same
  // journeyRewardBundleForPlan in agentCompanionRuntime.withLegacyTierProjection).
  const legacyRewardBundle = legacyTerminalTier === "未及格"
    ? undefined
    : journeyRewardBundleForPlan(taskPlan, legacyTerminalTier);
  const legacyReward = legacyTerminalTier === "未及格"
    ? undefined
    : JOURNEY_TIER_REWARDS[legacyTerminalTier];
  const arrivalBeat = storyBeat(arrival) as JourneyEpisodeStoryBeat;
  const returnBeat = storyBeat(returning) as JourneyEpisodeStoryBeat;
  const time = storyTime(input.startedAtWorldTime, input.dueAtWorldTime);
  const premise = secondPersonSentence(storyFacingGeneratedText(taskPlan.premise, taskPlan), agentName);
  const primaryObjective = storyFacingGeneratedText(taskPlan.primaryObjective, taskPlan)
    .replace(/^你/u, "")
    .replace(/[。！？!?]+$/u, "");
  const beginning = `你现在已经转生成为${profile.identity}。${time}。${premise}为了${primaryObjective}，你离开落脚处，沿已确认路线前往${regionName}。`;
  const arrivalText = arrivalStoryOutcome(arrivalBeat, "你", regionName, agentName);
  const storyFacts = groundedObjectives.map((episode) => {
    const taskObjective = episode.generatedTaskObjective as JourneyGeneratedTaskObjective;
    const beat = storyBeat(episode) as JourneyEpisodeStoryBeat;
    const objectivePlace = entityLabelById(episode, taskObjective.locationId);
    const places = entityLabels(episode, "place").filter((label) => label !== regionName);
    const place = objectivePlace || places[0] || regionName;
    const participantPeople = [...new Set([
      ...entityLabels(episode, "person", true),
      ...entityLabels(episode, "agent", true).filter((label) => label !== agentName),
    ])];
    const participantOrganizations = [...new Set(entityLabels(episode, "organization", true))];
    return {
      episode,
      objective: taskObjective,
      beat,
      place,
      participantPeople,
      participantOrganizations,
      participantKey: [
        ...participantPeople.map((label) => `person:${label}`),
        ...participantOrganizations.map((label) => `organization:${label}`),
      ].join("\u001f"),
      chapterTitle: storyFacingGeneratedText(beat.selectedAction.label || taskObjective.title, taskPlan),
      action: secondPersonAction(
        storyFacingGeneratedText(beat.selectedAction.intent || beat.selectedAction.label, taskPlan),
        agentName,
      ),
      outcome: secondPersonSentence(storyFacingGeneratedText(beat.outcomeSummary, taskPlan), agentName),
    };
  });
  const mainFacts = storyFacts.filter((entry) => entry.objective.kind === "main");
  const firstMain = mainFacts[0];
  if (!firstMain) return undefined;
  const people = [...new Set(input.episodes.flatMap((episode) => [
    ...entityLabels(episode, "person"),
    ...entityLabels(episode, "agent").filter((label) => label !== agentName),
  ]))];
  const completionResult = taskPlan.completionResult ?? inferJourneyCompletionResult(taskPlan.successResult);
  const mainSucceeded = adjudication.mainCompleted === adjudication.mainTotal;
  const returnText = mainSucceeded
    ? returnStoryOutcome(returnBeat, "你", regionName, agentName, completionResult)
    : `你沿来时确认过的路线离开${regionName}，回到落脚处。原本想取得的${carryObjectText(completionResult.summary)}没有出现，你没有把沿途留下的记录当成已经办成的结果。`;
  const objectiveChapters = storyFacts.map((entry, index) => {
    const previous = storyFacts[index - 1];
    const samePlaceTransitions = ["随后，", "接下来，", "之后，", "再往后，", "临近收尾时，", "在离开前，"] as const;
    const locationLead = index === 0
      ? `进入${regionName}后，你来到${entry.place}。`
      : previous?.place === entry.place
        ? samePlaceTransitions[index - 1] ?? "随后，"
        : `离开${previous?.place || regionName}后，你来到${entry.place}。`;
    const participantLead = entry.participantKey === previous?.participantKey
      ? ""
      : entry.participantPeople.length && entry.participantOrganizations.length
        ? `${naturalList(entry.participantPeople)}在现场，${naturalList(entry.participantOrganizations)}的人员也在场。`
        : entry.participantPeople.length
          ? `${naturalList(entry.participantPeople)}在现场。`
          : entry.participantOrganizations.length
            ? `${naturalList(entry.participantOrganizations)}的人员在现场。`
            : "";
    return chapter({
      key: entry.objective.kind === "side" ? "side_quest" : index === 0 ? "encounter" : "objective",
      title: `${chineseNumber(index + 3)}、${entry.chapterTitle}`,
      text: `${locationLead}${participantLead}${entry.action}${entry.outcome}`,
      episodes: [entry.episode],
    });
  });
  const chapters: readonly GroundedJourneyStoryChapter[] = [
    chapter({ key: "departure", title: "一、这一世的开端", text: beginning, episodes: [arrival] }),
    chapter({
      key: "arrival",
      title: `二、进入${regionName}`,
      text: `出发后，${arrivalText}`,
      episodes: [arrival],
    }),
    ...objectiveChapters,
    chapter({
      key: "return",
      title: `${chineseNumber(objectiveChapters.length + 3)}、归途`,
      text: returnText,
      episodes: [returning],
    }),
  ];
  const rewards = rewardEvaluation(legacyRewardBundle, input.episodes);
  const evaluation: GroundedJourneyStoryReport["evaluation"] = {
    taskCompletionGrade: legacyTerminalTier,
    ...(adjudication.performance ? {
      performanceScorePercent: Math.round(adjudication.performance.scoreBps / 100),
      gradeReason: adjudication.performance.reasons.join("；"),
    } : {}),
    ...identityFidelityEvaluation({
      identity: input.identity,
      journeyStatus: input.status,
      missionStatus: mission.status,
      worldCommit: input.worldCommit,
    }),
    rewards,
    rewardConversion: rewardConversionEvaluation(rewards, input.worldCommit),
    playerImpact: playerImpactEvaluation(input.episodes, protagonist?.entityId || "", input.worldCommit),
    ...worldCommitEvaluation(input.worldCommit),
  };
  const storyContent = chapters.map((entry) => entry.text).join("\n\n");
  const header = [
    `代号：${profile.codeName}`,
    `${profile.reincarnation}。`,
    `身份：${profile.identity}`,
    `该局目标：${profile.objective}`,
  ].join("\n");
  const evaluationText = [
    "评价：",
    `任务完成度：${evaluation.taskCompletionGrade}`,
    ...(evaluation.performanceScorePercent === undefined ? [] : [
      `综合表现：${evaluation.performanceScorePercent}%`,
      `评分依据：${evaluation.gradeReason}`,
    ]),
    `身份还原度：${evaluation.identityFidelityPercent}%`,
    `获得奖励：${evaluation.rewards.summary}`,
    `能力转化：${evaluation.rewardConversion.summary}`,
    ...(evaluation.worldCommit ? [`世界固化：${evaluation.worldCommit.summary}`] : []),
    ...(evaluation.npcRelationships?.length ? [
      `NPC关系：${evaluation.npcRelationships.map((relationship) =>
        `${relationship.displayName} +${relationship.scoreDelta}（当前 ${relationship.scoreAfter}）`).join("；")}`,
    ] : []),
    `其他玩家影响：${evaluation.playerImpact.summary}`,
    ...(evaluation.warning ? [`警告：${evaluation.warning}`] : []),
  ].join("\n");
  const confirmedOutcomes = storyFacts.map((entry) => entry.outcome);
  const actionStory = objectiveChapters.map((entry) => entry.text).join("");
  const places = [...new Set([regionName, ...storyFacts.map((entry) => entry.place)])];
  const characters = [...new Set([
    profile.identity,
    ...people,
  ])];
  return {
    kind: "grounded_story_report",
    version: 3,
    storyId: `story:${input.journeyId}`,
    journeyId: input.journeyId,
    title: `代号 ${profile.codeName}：${profile.identity}在${regionName}的${profile.reincarnation}`,
    summary: mainSucceeded
      ? `${profile.identity}前往${regionName}，依次经历${storyFacts.map((entry) => entry.chapterTitle).join("、")}，随后返回落脚处。`
      : `${profile.identity}前往${regionName}，经历${storyFacts.map((entry) => entry.chapterTitle).join("、")}后返回，但没有取得原本想要的结果。`,
    profile,
    storyElements: {
      time,
      place: places.join("、"),
      characters,
      beginning,
      event: premise,
      action: actionStory,
      result: returnText,
    },
    storyContent,
    evaluation,
    narrative: [header, "故事内容：", storyContent, evaluationText].join("\n\n"),
    chapters,
    mission,
    structure: {
      desire: `${agentName}为了“${objective}”前往${regionName}。`,
      obstacle: premise,
      choice: !mainSucceeded
        ? `${agentName}作出了${storyFacts.length}次有记录的选择，但没有完成全部必要行动。`
        : completionResult.returnMode === "carry"
        ? `${agentName}在${firstMain.place}完成行动并取得${carryObjectText(completionResult.summary)}。`
        : completionResult.returnMode === "report"
          ? `${agentName}在${firstMain.place}完成行动，并确认${archivedResultText(completionResult.summary)}。`
          : `${agentName}在${firstMain.place}完成行动，并确认${clean(completionResult.summary).replace(/[。！？!?]+$/u, "")}。`,
      consequence: `${confirmedOutcomes.join("")}${returnText}`,
    },
    resolution: {
      journeyStatus: "completed",
      missionStatus: mission.status === "completed" ? "completed" : "failed",
      objectiveStatus: mission.status === "completed" ? "progressed" : "unresolved",
      confirmedOutcome: confirmedOutcomes.join(""),
      unresolved: mission.status === "completed"
        ? `本局已经结算为“${legacyTerminalTier}”；长期目标仍可在下一世继续。`
        : "本局主线未闭环，未完成部分不会由叙述补写为成功。",
    },
    episodeIds: input.episodes.map((episode) => episode.episodeId),
    sourceEventIds: reportSourceEventIds(input.episodes, input.worldCommit),
  };
}
