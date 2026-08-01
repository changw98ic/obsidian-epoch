/**
 * GM mode core rules — state builders, episode construction, data boundaries,
 * fact accounting, and settlement for the freeform GM-driven journey path.
 *
 * This module is pure/stateless; orchestration (LLM calls, mutation coordinator)
 * lives in the MCP tool handler that imports these helpers.
 */

import type { AgentCompanionRuntime } from "./agentCompanionRuntime.ts";
import type {
  JourneySceneEpisode,
  JourneyEpisodeFingerprint,
} from "./journeySceneRules.ts";
import type {
  JourneyNarrativeFact,
  JourneyNarrativeRumorFact,
  JourneyNarrativeStateChange,
  JourneyNarrativeVerificationAnchor,
  JourneyEpisodeStoryBeat,
  PersistedJourneyNarrative,
  GroundedJourneyInterpretation,
  GroundedJourneyPostcard,
} from "./journeyNarrativeRules.ts";
import type { EpochJourney } from "./journeyRules.ts";

// ── GM Types ────────────────────────────────────────────────────────

export interface GMResources {
  readonly money: number;
  readonly stamina: number;
  readonly health: number;
  readonly reputation: number;
  readonly socialCapital: number;
}

export interface GMAgentState {
  readonly id: string;
  readonly name: string;
  readonly resources: GMResources;
  readonly inventory: readonly string[];
  readonly location: string;
  readonly status: string;
}

export interface GMJourneyState {
  readonly id: string;
  readonly status: string;
  readonly version: number;
  readonly destinationRegionId: string;
  readonly episodeIds: readonly string[];
}

export interface GMWorldState {
  readonly agent: GMAgentState;
  readonly journey: GMJourneyState;
  readonly episodes: readonly JourneySceneEpisode[];
}

export interface GMNPCState {
  readonly id: string;
  readonly name: string;
  readonly location: string;
  readonly attitude: number;
  readonly personality: string;
  readonly currentAction: string;
}

export interface HardRules {
  readonly resourceBoundaries: {
    readonly money: { readonly min: number };
    readonly stamina: { readonly min: number; readonly max: number };
    readonly health: { readonly min: number; readonly max: number };
    readonly reputation: { readonly min: number; readonly max: number };
    readonly socialCapital: { readonly min: number; readonly max: number };
    readonly npcAttitude: { readonly min: number; readonly max: number };
  };
}

export const DEFAULT_HARD_RULES: HardRules = {
  resourceBoundaries: {
    money: { min: 0 },
    stamina: { min: 0, max: 100 },
    health: { min: 0, max: 100 },
    reputation: { min: -100, max: 100 },
    socialCapital: { min: 0, max: 100 },
    npcAttitude: { min: -100, max: 100 },
  },
};

export interface AdjudicatorPhysicalConsequences {
  readonly staminaCost: number;
  readonly healthChange: number;
  readonly timeElapsedMinutes: number;
  readonly moneySpent: number;
}

export interface AdjudicatorNPCChange {
  readonly attitudeChange: number;
  readonly newImpression: string | null;
  readonly willRemember: readonly string[];
}

export interface AdjudicatorDiscoveredInfo {
  readonly content: string;
  readonly source: string;
  readonly reliability: number;
  readonly reason: string;
}

export interface AdjudicatorNewEvent {
  readonly type: string;
  readonly description: string;
  readonly visible: boolean;
  readonly agentAware: boolean;
  readonly timeTrigger: string | null;
}

export interface AdjudicatorEnvironmentChange {
  readonly property: string;
  readonly newValue: string;
}

export interface AdjudicatorOutput {
  readonly actionValid: boolean;
  readonly invalidReason: string | null;
  readonly physicalConsequences: AdjudicatorPhysicalConsequences;
  readonly socialConsequences: {
    readonly npcChanges: Readonly<Record<string, AdjudicatorNPCChange>>;
  };
  readonly informationConsequences: {
    readonly discovered: readonly AdjudicatorDiscoveredInfo[];
    readonly confirmed: readonly string[];
    readonly contradicted: readonly string[];
  };
  readonly worldConsequences: {
    readonly newEvents: readonly AdjudicatorNewEvent[];
    readonly environmentChanges: readonly AdjudicatorEnvironmentChange[];
  };
  readonly npcAutonomousActions: Readonly<Record<string, {
    readonly action: string;
    readonly mood: string;
    readonly mightInitiateConversation: boolean;
    readonly conversationTopics: readonly string[];
  }>>;
  readonly availableReactions: readonly string[];
  readonly flagged?: boolean;
}

export interface NarratorOutput {
  readonly narrative: string;
  readonly npcDialogue: Readonly<Record<string, string>>;
  readonly atmosphere: string;
  readonly innerThoughts?: string;
  readonly sensoryDetails: {
    readonly visual?: string;
    readonly auditory?: string;
    readonly olfactory?: string;
    readonly tactile?: string;
  };
  readonly summary?: string;
}

export interface ValidatedAgentChanges {
  readonly money: number;
  readonly stamina: number;
  readonly health: number;
  readonly reputation: number;
  readonly socialCapital: number;
  readonly location: string;
}

export interface ValidatedNPCChanges {
  readonly [npcId: string]: {
    readonly attitude: number;
    readonly newFacts: readonly string[];
  };
}

export interface ValidatedStateChanges {
  readonly agent: ValidatedAgentChanges;
  readonly npcs: ValidatedNPCChanges;
  readonly world: {
    readonly environmentChanges: readonly AdjudicatorEnvironmentChange[];
  };
}

// ── State Builders ──────────────────────────────────────────────────

interface GMStatusSnapshot {
  journey: {
    journeyId: string;
    status: string;
    version: number;
    destinationRegionId: string;
    episodeIds: readonly string[];
    agentId: string;
  };
  progress: {
    agentId: string;
    identity: { identityName: string; status: string };
    resources: Record<string, number>;
    inventoryItems: readonly { itemKey: string }[];
  };
  episodes: readonly JourneySceneEpisode[];
}

export function buildWorldState(
  companion: AgentCompanionRuntime,
  journeyId: string,
): GMWorldState {
  const statusValue = companion.status({ journeyId }) as unknown as GMStatusSnapshot;
  const status = statusValue;
  return {
    agent: {
      id: status.progress.agentId,
      name: status.progress.identity.identityName,
      resources: {
        money: status.progress.resources.money ?? 0,
        stamina: status.progress.resources.stamina ?? 100,
        health: status.progress.resources.health ?? 100,
        reputation: status.progress.resources.reputation ?? 0,
        socialCapital: status.progress.resources.socialCapital ?? 0,
      },
      inventory: status.progress.inventoryItems.map((i) => i.itemKey),
      location: status.journey.destinationRegionId,
      status: status.progress.identity.status,
    },
    journey: {
      id: status.journey.journeyId,
      status: status.journey.status,
      version: status.journey.version,
      destinationRegionId: status.journey.destinationRegionId,
      episodeIds: status.journey.episodeIds,
    },
    episodes: status.episodes,
  };
}

export function buildKnownFacts(
  episodes: readonly JourneySceneEpisode[],
): readonly string[] {
  const facts: string[] = [];
  for (const episode of episodes) {
    for (const fact of episode.serverFacts?.confirmedFacts ?? []) {
      facts.push(fact.text);
    }
    if (episode.serverFacts?.storyBeat) {
      facts.push(episode.serverFacts.storyBeat.outcomeSummary);
    }
  }
  return [...new Set(facts)];
}

// ── Hard Rule Pre-Check ─────────────────────────────────────────────

export interface HardRulePreCheckResult {
  readonly blocked: boolean;
  readonly reason?: string;
}

export function hardRulePreCheck(
  playerNarrative: string,
  snapshot: GMWorldState,
  hardRules: HardRules,
): HardRulePreCheckResult {
  const rb = hardRules.resourceBoundaries;

  // Spending check: "花5000块" pattern
  const spendingMatch = playerNarrative.match(/花[了]?(\d+)/);
  if (spendingMatch) {
    const amount = parseInt(spendingMatch[1]);
    if (amount > snapshot.agent.resources.money) {
      return {
        blocked: true,
        reason: `你只有${snapshot.agent.resources.money}元，不够花${amount}元。`,
      };
    }
  }

  // Stamina exhaustion check
  if (snapshot.agent.resources.stamina <= 0) {
    return { blocked: true, reason: "你已经精疲力竭，需要休息。" };
  }

  // Health check
  if (snapshot.agent.resources.health <= 0) {
    return { blocked: true, reason: "你已经无法行动。" };
  }

  return { blocked: false };
}

// ── Data Boundaries ─────────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function applyDataBoundaries(
  judgment: AdjudicatorOutput,
  current: GMWorldState,
  hardRules: HardRules,
): ValidatedStateChanges {
  const rb = hardRules.resourceBoundaries;
  return {
    agent: {
      money: Math.max(rb.money.min, current.agent.resources.money - judgment.physicalConsequences.moneySpent),
      stamina: clamp(
        current.agent.resources.stamina - judgment.physicalConsequences.staminaCost,
        rb.stamina.min, rb.stamina.max,
      ),
      health: clamp(
        current.agent.resources.health + judgment.physicalConsequences.healthChange,
        rb.health.min, rb.health.max,
      ),
      reputation: clamp(current.agent.resources.reputation, rb.reputation.min, rb.reputation.max),
      socialCapital: clamp(current.agent.resources.socialCapital, rb.socialCapital.min, rb.socialCapital.max),
      location: current.agent.location,
    },
    npcs: Object.fromEntries(
      Object.entries(judgment.socialConsequences.npcChanges).map(([id, npc]) => [
        id,
        {
          attitude: clamp(npc.attitudeChange, rb.npcAttitude.min, rb.npcAttitude.max),
          newFacts: npc.willRemember,
        },
      ]),
    ),
    world: {
      environmentChanges: judgment.worldConsequences.environmentChanges,
    },
  };
}

// ── State Changes Mapping ───────────────────────────────────────────

export function stateChangesFrom(
  validated: ValidatedStateChanges,
  episodeId: string,
  sourceEventIds: readonly string[],
): readonly JourneyNarrativeStateChange[] {
  const changes: JourneyNarrativeStateChange[] = [];
  const agentSummary = [
    validated.agent.money !== 0 ? `金钱${validated.agent.money > 0 ? "+" : ""}${validated.agent.money}` : "",
    validated.agent.stamina !== 0 ? `体力${validated.agent.stamina > 0 ? "+" : ""}${validated.agent.stamina}` : "",
    validated.agent.health !== 0 ? `生命${validated.agent.health > 0 ? "+" : ""}${validated.agent.health}` : "",
  ].filter(Boolean).join("，");
  if (agentSummary) {
    changes.push({
      stateChangeId: `${episodeId}:agent`,
      summary: agentSummary,
      entityIds: [],
      sourceEventIds,
    });
  }
  for (const [npcId, npc] of Object.entries(validated.npcs)) {
    if (npc.attitude !== 0) {
      changes.push({
        stateChangeId: `${episodeId}:npc:${npcId}`,
        summary: `NPC态度${npc.attitude > 0 ? "+" : ""}${npc.attitude}`,
        entityIds: [npcId],
        sourceEventIds,
      });
    }
  }
  return changes;
}

// ── Episode Construction ────────────────────────────────────────────

export function buildGMEpisode(input: {
  readonly journeyId: string;
  readonly index: number;
  readonly playerNarrative: string;
  readonly snapshot: GMWorldState;
  readonly judgment: AdjudicatorOutput;
  readonly narration: NarratorOutput;
  readonly validatedChanges: ValidatedStateChanges;
  readonly sourceEventId?: string;
}): JourneySceneEpisode {
  const valid = input.judgment.actionValid;
  const sourceEventId = input.sourceEventId?.trim() || undefined;
  const episodeId = `${input.journeyId}:gm:${input.index}`;
  const locationId = input.snapshot.agent.location
    ?? input.snapshot.journey.destinationRegionId;

  const storyBeat: JourneyEpisodeStoryBeat = {
    phase: "main",
    sceneTitle: input.narration.atmosphere || "自由行动",
    selectedAction: {
      optionKey: "gm_free_action",
      label: input.playerNarrative,
      completionKind: valid ? "complete" : "failed",
    },
    outcomeSummary: input.narration.summary || input.narration.narrative.slice(0, 200),
  };

  const srcIds = sourceEventId ? [sourceEventId] : [];

  // confirmed array + discovered with reliability 1.0 → confirmedFacts
  const confirmedTexts = [
    ...input.judgment.informationConsequences.confirmed,
    ...input.judgment.informationConsequences.discovered
      .filter((f) => f.reliability >= 1.0)
      .map((f) => f.content),
  ];
  const confirmedFacts: JourneyNarrativeFact[] = confirmedTexts.map(
    (text, i) => ({
      factId: `fact:${episodeId}:${i}`,
      text,
      entityIds: [],
      sourceEventIds: srcIds,
    }),
  );

  // discovered with 0 < reliability < 1 → rumors
  const rumors: JourneyNarrativeRumorFact[] = input.judgment.informationConsequences.discovered
    .filter((f) => f.reliability > 0 && f.reliability < 1)
    .map((f, i) => ({
      factId: `rumor:${episodeId}:${i}`,
      status: "unconfirmed" as const,
      text: f.content,
      entityIds: [],
      sourceEventIds: srcIds,
    }));

  const verification: JourneyNarrativeVerificationAnchor = {
    url: `/epoch/journey/${encodeURIComponent(input.journeyId)}#episode-${encodeURIComponent(episodeId)}`,
    journeyId: input.journeyId,
    episodeId,
    fragment: `episode-${encodeURIComponent(episodeId)}`,
  };

  const narrative = buildGMPersistedNarrative({
    narration: input.narration,
    confirmedFacts,
    rumors,
    stateChanges: stateChangesFrom(input.validatedChanges, episodeId, srcIds),
    sourceEventIds: srcIds,
    verification,
  });

  const fingerprint: JourneyEpisodeFingerprint = {
    locationId,
    participantIds: [],
    optionIds: ["gm_free_action"],
    outcomeKey: valid ? "gm_action_success" : "gm_action_failed",
  };

  return {
    episodeId,
    candidateId: "scene:gm:free_action",
    type: "travel",
    phase: "main",
    title: input.narration.atmosphere || "自由行动",
    worldObjectRefs: [],
    sourceFactIds: sourceEventId ? [sourceEventId] : [],
    optionIds: ["gm_free_action"],
    outcomeKey: valid ? "gm_action_success" : "gm_action_failed",
    fingerprint,
    routine: false,
    serverFacts: {
      journeyId: input.journeyId,
      episodeId,
      allowedEntities: [],
      confirmedFacts,
      rumors,
      stateChanges: stateChangesFrom(input.validatedChanges, episodeId, srcIds),
      sourceEventIds: srcIds,
      verification,
      storyBeat,
    },
    narrative,
  };
}

function buildGMPersistedNarrative(input: {
  readonly narration: NarratorOutput;
  readonly confirmedFacts: readonly JourneyNarrativeFact[];
  readonly rumors: readonly JourneyNarrativeRumorFact[];
  readonly stateChanges: readonly JourneyNarrativeStateChange[];
  readonly sourceEventIds: readonly string[];
  readonly verification: JourneyNarrativeVerificationAnchor;
}): PersistedJourneyNarrative {
  const entityIds = input.confirmedFacts.flatMap((f) => f.entityIds);
  const factIds = input.confirmedFacts.map((f) => f.factId);
  const interpretations: GroundedJourneyInterpretation[] = factIds.length
    ? [{
        stance: "curious",
        text: input.narration.narrative,
        factIds,
        entityIds,
      }]
    : [];
  const postcard: GroundedJourneyPostcard | undefined = factIds.length
    ? {
        text: input.narration.narrative,
        factIds,
        entityIds,
        sourceEventIds: input.sourceEventIds,
        verification: input.verification,
      }
    : undefined;

  const rumorObjects = input.rumors.map((r) => ({
    rumorId: r.factId,
    status: "unconfirmed" as const,
    text: `【未确认传闻】${r.text}`,
    entityIds: r.entityIds,
    sourceEventIds: r.sourceEventIds,
  }));

  return {
    kind: "grounded_narrative",
    confirmedFacts: input.confirmedFacts,
    agentInterpretation: interpretations,
    rumors: rumorObjects,
    stateChanges: input.stateChanges,
    sourceEventIds: input.sourceEventIds,
    verification: input.verification,
    ...(postcard ? { postcard } : {}),
  };
}

// ── Settlement ──────────────────────────────────────────────────────

export type GMCompletionTier = "未及格" | "及格" | "良好" | "优秀" | "惊世";

export interface GMSettlementResult {
  readonly journeyId: string;
  readonly episodes: readonly JourneySceneEpisode[];
  readonly settledAt: string;
  readonly completionTier: GMCompletionTier;
  readonly gmEpisodeCount: number;
  readonly completedCount: number;
  readonly failedCount: number;
  readonly completionRatio: number;
  readonly reward: GMSettlementReward;
}

export interface GMSettlementReward {
  readonly resourceId: string;
  readonly amount: number;
}

const GM_TIER_REWARDS: Readonly<Record<GMCompletionTier, GMSettlementReward>> = {
  "未及格": { resourceId: "coin", amount: 0 },
  "及格": { resourceId: "coin", amount: 2 },
  "良好": { resourceId: "coin", amount: 5 },
  "优秀": { resourceId: "aether", amount: 3 },
  "惊世": { resourceId: "legend", amount: 1 },
};

export function classifyGMTier(completedCount: number, totalCount: number): GMCompletionTier {
  if (totalCount === 0) return "未及格";
  const ratio = completedCount / totalCount;
  if (ratio >= 1.0) return "惊世";
  if (ratio >= 0.8) return "优秀";
  if (ratio >= 0.6) return "良好";
  if (ratio > 0) return "及格";
  return "未及格";
}

export function settleGMJourney(input: {
  readonly companion: AgentCompanionRuntime;
  readonly journeyId: string;
}): GMSettlementResult {
  const statusValue = input.companion.status({ journeyId: input.journeyId });
  const status = statusValue as {
    journey: EpochJourney;
  };
  const journey = status.journey;
  const projection = input.companion.journeyRuntime().projection();
  const episodes = journey.episodeIds
    .map((id) => projection.episodes[id])
    .filter((ep): ep is JourneySceneEpisode => Boolean(ep));

  const gmEpisodes = episodes.filter((ep) => ep.candidateId === "scene:gm:free_action");
  const completedCount = gmEpisodes.filter(
    (ep) => ep.serverFacts?.storyBeat?.selectedAction.completionKind === "complete",
  ).length;
  const failedCount = gmEpisodes.filter(
    (ep) => ep.serverFacts?.storyBeat?.selectedAction.completionKind === "failed",
  ).length;
  const completionTier = classifyGMTier(completedCount, gmEpisodes.length);
  const reward = GM_TIER_REWARDS[completionTier];

  return {
    journeyId: input.journeyId,
    episodes,
    settledAt: new Date().toISOString(),
    completionTier,
    gmEpisodeCount: gmEpisodes.length,
    completedCount,
    failedCount,
    completionRatio: gmEpisodes.length > 0 ? completedCount / gmEpisodes.length : 0,
    reward,
  };
}

// ── Prompt Builders ─────────────────────────────────────────────────

export function buildAdjudicatorSystemPrompt(input: {
  readonly hardRules: HardRules;
  readonly snapshot: GMWorldState;
  readonly knownFacts: readonly string[];
}): string {
  const rb = input.hardRules.resourceBoundaries;
  const agent = input.snapshot.agent;
  return `你是黑曜纪元的裁决者。你的工作是判定玩家行动的后果。你不是故事作者，你是世界模拟器。

# 不可违反的规则（代码注入，LLM不可覆盖）

- 角色装备: ${agent.inventory.length > 0 ? agent.inventory.join(", ") : "无"}
- 角色金钱: ${agent.resources.money}元（下限${rb.money.min}）
- 角色体力: ${agent.resources.stamina}/${rb.stamina.max}
- 角色生命: ${agent.resources.health}/${rb.health.max}
- 角色位置: ${agent.location}
- 行动需要时间
- 角色只能使用已确认的信息

已确认的事实:
${input.knownFacts.length > 0 ? input.knownFacts.map((f) => `- ${f}`).join("\n") : "- （暂无）"}

# 判定原则

## 社会约束
- 陌生人不会无缘无故信任你
- 问敏感问题会引起警觉
- 威胁别人有后果
- 帮忙会增加好感，但不是有限的
- NPC有自己的性格和动机

## 资源约束
- 钱花完就没了
- 体力会消耗
- 受伤会影响后续行动

# 你不能做的事
- 你不能让角色使用他没有的装备
- 你不能让角色花费超过他拥有的金钱
- 你不能让角色消耗超过他当前的体力

# 输出格式

严格输出以下JSON结构，不要输出任何其他内容。

{
  "actionValid": true,
  "invalidReason": null,
  "physicalConsequences": {
    "staminaCost": 0,
    "healthChange": 0,
    "timeElapsedMinutes": 0,
    "moneySpent": 0
  },
  "socialConsequences": { "npcChanges": {} },
  "informationConsequences": { "discovered": [], "confirmed": [], "contradicted": [] },
  "worldConsequences": { "newEvents": [], "environmentChanges": [] },
  "npcAutonomousActions": {},
  "availableReactions": []
}`;
}

export function buildNarratorSystemPrompt(): string {
  return `你是黑曜纪元的叙事者。你的工作是把裁决结果转化为有质感的故事文本。

# 写作原则

## 1. 感官优先
先写看到/听到/闻到/触到的，再写发生的事。

## 2. 细节具体化
不要写"一个男人"，写"一个穿灰色夹克、头发油腻的男人"。

## 3. NPC 是活人
NPC有自己的情绪、习惯、当前在做的事。他们不会等玩家来才开始存在。

## 4. 角色有内心
角色不是机器人。他会犹豫、会担心、会想起过去。

## 5. 对话要像人说话
不要书面语，不要解释性对话。

## 6. 时间在流动
行动不是瞬间完成的。

## 7. 失败比成功更有故事
失败不是"未完成"。失败是角色尝试了但世界没有配合。

## 8. 不要总结，要展示
不要告诉玩家发生了什么，让玩家自己感受到。

## 9. 处理无效行动
如果裁决结果是行动无效，用角色视角解释为什么失败。

## 10. 不要提及任何数值
不要说"你消耗了15元"、"你的体力下降了"。用叙事暗示资源变化。

# 输出格式

严格输出以下JSON结构，不要输出任何其他内容。

{
  "narrative": "完整的叙事文本...",
  "npcDialogue": {},
  "atmosphere": "一句话描述当前氛围",
  "innerThoughts": "角色的内心活动，如果有的话",
  "sensoryDetails": {
    "visual": "视觉细节",
    "auditory": "听觉细节",
    "olfactory": "嗅觉细节",
    "tactile": "触觉细节"
  },
  "summary": "一句话总结本次行动结果"
}`;
}

export function buildAdjudicatorUserPrompt(input: {
  readonly playerNarrative: string;
  readonly snapshot: GMWorldState;
  readonly recentHistory: readonly string[];
}): string {
  const agent = input.snapshot.agent;
  return `## 角色状态
- 名称: ${agent.name}
- 位置: ${agent.location}
- 装备: ${agent.inventory.join(", ") || "无"}
- 金钱: ${agent.resources.money}
- 体力: ${agent.resources.stamina}/100
- 生命: ${agent.resources.health}/100

## 最近历史
${input.recentHistory.length > 0 ? input.recentHistory.join("\n") : "（无）"}

## 玩家行动
${input.playerNarrative}

请判定这个行动的后果。`;
}

export function buildNarratorUserPrompt(input: {
  readonly judgment: AdjudicatorOutput;
  readonly playerNarrative: string;
  readonly agentName: string;
}): string {
  return `## 裁决结果
- 行动有效: ${input.judgment.actionValid}
${input.judgment.invalidReason ? `- 无效原因: ${input.judgment.invalidReason}` : ""}
- 体力消耗: ${input.judgment.physicalConsequences.staminaCost}
- 金钱花费: ${input.judgment.physicalConsequences.moneySpent}
- 时间流逝: ${input.judgment.physicalConsequences.timeElapsedMinutes}分钟
${input.judgment.informationConsequences.discovered.length > 0
    ? `- 发现信息: ${input.judgment.informationConsequences.discovered.map((d) => d.content).join("；")}`
    : ""}
${input.judgment.informationConsequences.confirmed.length > 0
    ? `- 确认事实: ${input.judgment.informationConsequences.confirmed.join("；")}`
    : ""}

## 玩家行动原文
${input.playerNarrative}

## 角色名称
${input.agentName}

请生成叙事文本。`;
}
