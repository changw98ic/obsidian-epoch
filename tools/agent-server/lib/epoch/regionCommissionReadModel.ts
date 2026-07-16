import {
  epochActivityMediaForKey,
  type EpochActivityAssetKey,
  type EpochActivityMedia,
} from "../activityAssets.ts";
import { bountiesView, partyRunsView } from "./bountyPartyReadModel.ts";
import { MAX_PARTY_RUN_MEMBERS } from "./combatSettlementRules.ts";
import {
  anomaliesView,
  objectivesView,
  resourceNodesView,
} from "./encounterReadModel.ts";
import { type HostedActionRisk } from "./events.ts";
import type {
  EpochProjection,
} from "./gameCore.ts";
import { npcCandidatesView } from "./npcCandidateReadModel.ts";
import { socialHooksView } from "./npcStateReadModel.ts";
import { organizationsView } from "./organizationReadModel.ts";
import {
  type EpochAnomalySeverity,
  type EpochResourceId,
  type EpochServerReward,
} from "./protocol.ts";
import { activeAgentsView } from "./regionActivityReadModel.ts";
import { regionFactionPressureView } from "./regionConflictReadModel.ts";
import { monumentsView } from "./regionMonumentReadModel.ts";

export type EpochRegionCommissionSourceType = "objective" | "resource_node" | "anomaly" | "bounty" | "party_run" | "social_hook";
export type EpochSecretExposureTier =
  | "T0_public"
  | "T1_low_rumor"
  | "T2_local_secret"
  | "T3_core_secret"
  | "T4_forbidden_core";

export interface EpochSecretRevealBudget {
  readonly budgetKey: string;
  readonly topic: EpochRegionCommissionSourceType;
  readonly explorerId: string;
  readonly agentId: string;
  readonly locationId: string;
  readonly chapterKey: string;
  readonly threshold: number;
  readonly spent: number;
  readonly remaining: number;
  readonly chapterLocked: boolean;
  readonly lockReason?: string;
}

export type EpochPrefileIsolationLayer = "active" | "prefile";
export type EpochPrefileIsolationReason = "public" | "low_exposure" | "chapter_locked";

export interface EpochPrefileIsolation {
  readonly layer: EpochPrefileIsolationLayer;
  readonly reason: EpochPrefileIsolationReason;
  readonly settlementEligible: boolean;
  readonly rewardEligible: boolean;
  readonly territoryEligible: boolean;
  readonly battleEligible: boolean;
  readonly futureHookOnly: boolean;
  readonly futureHook: string;
}

export type EpochLocationMotif = "ecology" | "creature" | "faction" | "anomaly" | "resource" | "character";
export type EpochLocationMotifDensityStatus = "within_quota" | "dense";
export type EpochLocationMotifDisplayMode = "normal" | "aggregate" | "downrank";

export interface EpochLocationMotifBias {
  readonly motif: EpochLocationMotif;
  readonly label: string;
  readonly taskBias: string;
  readonly rewardResourceId: EpochResourceId;
  readonly rewardBias: string;
  readonly summary: string;
}

export interface EpochRegionCommission {
  readonly commissionId: string;
  readonly regionId: string;
  readonly sourceType: EpochRegionCommissionSourceType;
  readonly sourceId: string;
  readonly secretExposureTier: EpochSecretExposureTier;
  readonly secretRevealBudget: EpochSecretRevealBudget;
  readonly prefileIsolation: EpochPrefileIsolation;
  readonly locationMotifBias: EpochLocationMotifBias;
  readonly media: EpochActivityMedia;
  readonly title: string;
  readonly summary: string;
  readonly status: "open" | "settled";
  readonly actionLabel: string;
  readonly reward?: EpochServerReward;
  readonly risk?: HostedActionRisk | EpochAnomalySeverity;
  readonly progress?: {
    readonly current: number;
    readonly target?: number;
  };
  readonly leaderAgentId?: string;
  readonly canonical: true;
  readonly createdAt: string;
}

export interface EpochLocationMotifQuota {
  readonly regionId: string;
  readonly motif: EpochLocationMotif;
  readonly label: string;
  readonly count: number;
  readonly quota: number;
  readonly status: EpochLocationMotifDensityStatus;
  readonly displayMode: EpochLocationMotifDisplayMode;
  readonly summary: string;
}

export type RegionCommissionSeed = Omit<EpochRegionCommission, "secretRevealBudget" | "prefileIsolation" | "locationMotifBias">;
export type RegionCommissionWithoutSecretRevealBudget = Omit<EpochRegionCommission, "secretRevealBudget" | "prefileIsolation">;
export type RegionCommissionWithSecretRevealBudget = Omit<EpochRegionCommission, "prefileIsolation">;

export interface RegionCommissionIdentityProjection {
  readonly identities: Readonly<Record<string, { readonly explorerId: string }>>;
}

export const SECRET_REVEAL_CHAPTER_THRESHOLD = 2;

export function commissionSecretExposureTier(input: {
  readonly sourceType: EpochRegionCommissionSourceType;
  readonly risk?: HostedActionRisk | EpochAnomalySeverity;
}): EpochSecretExposureTier {
  if (input.sourceType === "objective" || input.sourceType === "bounty" || input.sourceType === "party_run") {
    return "T0_public";
  }
  if (input.sourceType === "resource_node") return "T1_low_rumor";
  if (input.sourceType === "social_hook") return input.risk === "low" ? "T1_low_rumor" : "T0_public";
  if (input.risk === "cataclysm") return "T3_core_secret";
  if (input.risk === "major" || input.risk === "high") return "T2_local_secret";
  return "T1_low_rumor";
}

export function secretExposureTierCost(tier: EpochSecretExposureTier): number {
  switch (tier) {
    case "T0_public":
      return 0;
    case "T1_low_rumor":
      return 1;
    case "T2_local_secret":
      return 2;
    case "T3_core_secret":
      return 3;
    case "T4_forbidden_core":
      return 4;
  }
}

export function secretRevealChapterKey(commission: RegionCommissionWithoutSecretRevealBudget): string {
  const chapterDate = commission.createdAt.slice(0, 7) || "unknown_chapter";
  return `${commission.regionId}:${chapterDate}`;
}

export function secretRevealBudgetKey(input: {
  readonly topic: EpochRegionCommissionSourceType;
  readonly explorerId: string;
  readonly agentId: string;
  readonly locationId: string;
  readonly chapterKey: string;
}): string {
  return [
    input.topic,
    input.explorerId,
    input.agentId,
    input.locationId,
    input.chapterKey,
  ].join(":");
}

export function prefileIsolationForCommission(commission: RegionCommissionWithSecretRevealBudget): EpochPrefileIsolation {
  const lowExposure = commission.secretExposureTier !== "T0_public";
  const chapterLocked = commission.secretRevealBudget.chapterLocked;
  if (!lowExposure && !chapterLocked) {
    return {
      layer: "active",
      reason: "public",
      settlementEligible: true,
      rewardEligible: Boolean(commission.reward),
      territoryEligible: true,
      battleEligible: true,
      futureHookOnly: false,
      futureHook: "公开委托可进入当前章节结算。",
    };
  }
  return {
    layer: "prefile",
    reason: chapterLocked ? "chapter_locked" : "low_exposure",
    settlementEligible: false,
    rewardEligible: false,
    territoryEligible: false,
    battleEligible: false,
    futureHookOnly: true,
    futureHook: `未来钩子：${commission.title} 已进入预档层，待章节开放后再结算。`,
  };
}

export function addSecretRevealBudgets(
  projection: RegionCommissionIdentityProjection,
  commissions: readonly RegionCommissionWithoutSecretRevealBudget[],
): readonly EpochRegionCommission[] {
  const spentByBudgetKey = new Map<string, number>();
  return commissions.map((commission) => {
    const topic = commission.sourceType;
    const agentId = commission.leaderAgentId || "unassigned_agent";
    const explorerId = projection.identities[agentId]?.explorerId || "shared_world";
    const locationId = commission.regionId;
    const chapterKey = secretRevealChapterKey(commission);
    const budgetKey = secretRevealBudgetKey({ topic, explorerId, agentId, locationId, chapterKey });
    const spent = (spentByBudgetKey.get(budgetKey) || 0) + secretExposureTierCost(commission.secretExposureTier);
    spentByBudgetKey.set(budgetKey, spent);
    const remaining = Math.max(0, SECRET_REVEAL_CHAPTER_THRESHOLD - spent);
    const chapterLocked = spent > SECRET_REVEAL_CHAPTER_THRESHOLD;
    const withBudget: RegionCommissionWithSecretRevealBudget = {
      ...commission,
      secretRevealBudget: {
        budgetKey,
        topic,
        explorerId,
        agentId,
        locationId,
        chapterKey,
        threshold: SECRET_REVEAL_CHAPTER_THRESHOLD,
        spent,
        remaining,
        chapterLocked,
        ...(chapterLocked ? {
          lockReason: `章节锁：${chapterKey} 的 ${topic} 秘密线索已超过揭露预算。`,
        } : {}),
      },
    };
    const prefileIsolation = prefileIsolationForCommission(withBudget);
    return {
      ...withBudget,
      prefileIsolation,
      ...(prefileIsolation.layer === "prefile" ? {
        actionLabel: "预档未来钩子",
        reward: undefined,
      } : {}),
    };
  });
}

export const LOCATION_MOTIFS: readonly EpochLocationMotif[] = [
  "ecology",
  "creature",
  "faction",
  "anomaly",
  "resource",
  "character",
];

export const LOCATION_MOTIF_LABELS: Record<EpochLocationMotif, string> = {
  ecology: "生态",
  creature: "生物",
  faction: "阵营",
  anomaly: "异常",
  resource: "资源",
  character: "人物",
};

export const LOCATION_MOTIF_QUOTAS: Record<EpochLocationMotif, number> = {
  ecology: 2,
  creature: 2,
  faction: 2,
  anomaly: 2,
  resource: 2,
  character: 4,
};

export const LOCATION_MOTIF_DENSE_DISPLAY: Record<EpochLocationMotif, Exclude<EpochLocationMotifDisplayMode, "normal">> = {
  ecology: "downrank",
  creature: "downrank",
  faction: "aggregate",
  anomaly: "aggregate",
  resource: "aggregate",
  character: "aggregate",
};

export const LOCATION_MOTIF_BIAS_COPY: Record<EpochLocationMotif, {
  readonly taskBias: string;
  readonly rewardResourceId: EpochResourceId;
  readonly rewardBias: string;
}> = {
  ecology: {
    taskBias: "生态巡护、栖地修复和环境稳定任务优先生成。",
    rewardResourceId: "focus",
    rewardBias: "奖励偏向专注与长期稳定收益。",
  },
  creature: {
    taskBias: "生物追踪、巢群处置和样本回收任务优先生成。",
    rewardResourceId: "aether",
    rewardBias: "奖励偏向灵质与生物异常材料。",
  },
  faction: {
    taskBias: "阵营协商、组织博弈和声望争夺任务优先生成。",
    rewardResourceId: "legend",
    rewardBias: "奖励偏向阵营声望与传说收益。",
  },
  anomaly: {
    taskBias: "异常压制、裂隙校准和风险隔离任务优先生成。",
    rewardResourceId: "aether",
    rewardBias: "奖励偏向灵质与异常压制收益。",
  },
  resource: {
    taskBias: "资源勘探、节点争夺和补给护送任务优先生成。",
    rewardResourceId: "coin",
    rewardBias: "奖励偏向货币与可交易资源收益。",
  },
  character: {
    taskBias: "人物关系、委托牵线和本地声誉任务优先生成。",
    rewardResourceId: "focus",
    rewardBias: "奖励偏向专注与社交线索收益。",
  },
};

export const LOCATION_MOTIF_TIE_BREAKER: Record<EpochLocationMotif, number> = {
  faction: 0,
  resource: 1,
  anomaly: 2,
  character: 3,
  ecology: 4,
  creature: 5,
};

export function locationMotifBiasForMotif(motif: EpochLocationMotif): EpochLocationMotifBias {
  const copy = LOCATION_MOTIF_BIAS_COPY[motif];
  const label = LOCATION_MOTIF_LABELS[motif];
  return {
    motif,
    label,
    taskBias: copy.taskBias,
    rewardResourceId: copy.rewardResourceId,
    rewardBias: copy.rewardBias,
    summary: `${label}母题主导：${copy.taskBias}${copy.rewardBias}`,
  };
}

export function locationMotifQuota(input: {
  readonly regionId: string;
  readonly motif: EpochLocationMotif;
  readonly count: number;
}): EpochLocationMotifQuota {
  const quota = LOCATION_MOTIF_QUOTAS[input.motif];
  const dense = input.count > quota;
  const displayMode = dense ? LOCATION_MOTIF_DENSE_DISPLAY[input.motif] : "normal";
  const label = LOCATION_MOTIF_LABELS[input.motif];
  return {
    regionId: input.regionId,
    motif: input.motif,
    label,
    count: input.count,
    quota,
    status: dense ? "dense" : "within_quota",
    displayMode,
    summary: dense
      ? `${label}母题 ${input.count}/${quota}，前台应${displayMode === "aggregate" ? "聚合" : "降权"}。`
      : `${label}母题 ${input.count}/${quota}，保持正常展示。`,
  };
}

export function dominantLocationMotifBias(quotas: readonly EpochLocationMotifQuota[]): EpochLocationMotifBias {
  const [dominant] = [...quotas].sort((left, right) =>
    Number(right.status === "dense") - Number(left.status === "dense")
    || (right.count / Math.max(1, right.quota)) - (left.count / Math.max(1, left.quota))
    || right.count - left.count
    || LOCATION_MOTIF_TIE_BREAKER[left.motif] - LOCATION_MOTIF_TIE_BREAKER[right.motif]);
  return locationMotifBiasForMotif(dominant?.motif || "resource");
}

export function applyLocationMotifBiasToCommission(
  commission: RegionCommissionSeed,
  locationMotifBias: EpochLocationMotifBias,
): RegionCommissionWithoutSecretRevealBudget {
  return {
    ...commission,
    locationMotifBias,
    summary: `${commission.summary} 地点母题偏向：${locationMotifBias.summary}`,
  };
}

function activityMedia(activityKey: EpochActivityAssetKey): EpochActivityMedia {
  const media = epochActivityMediaForKey(activityKey);
  if (!media) throw new Error(`epoch_activity_media_missing:${activityKey}`);
  return media;
}

export function regionCommissionsView(projection: EpochProjection, input: { regionId: string }): readonly EpochRegionCommission[] {
  const objectives: RegionCommissionSeed[] = objectivesView(projection, { regionId: input.regionId })
    .filter((objective) => objective.status === "active")
    .map((objective) => ({
      commissionId: `objective:${objective.objectiveId}`,
      regionId: objective.regionId,
      sourceType: "objective",
      sourceId: objective.objectiveId,
      secretExposureTier: commissionSecretExposureTier({ sourceType: "objective" }),
      media: activityMedia("objective"),
      title: objective.title,
      summary: objective.description,
      status: "open",
      actionLabel: "贡献资源",
      reward: objective.reward,
      progress: {
        current: objective.totalScore,
        target: objective.targetScore,
      },
      leaderAgentId: objective.leaderboard[0]?.agentId,
      canonical: true,
      createdAt: objective.createdAt,
    }));
  const resourceNodes: RegionCommissionSeed[] = resourceNodesView(projection, { regionId: input.regionId, status: "open" })
    .map((node) => ({
      commissionId: `resource_node:${node.nodeId}`,
      regionId: node.regionId,
      sourceType: "resource_node",
      sourceId: node.nodeId,
      secretExposureTier: commissionSecretExposureTier({ sourceType: "resource_node", risk: "medium" }),
      media: activityMedia("resource_node"),
      title: node.title,
      summary: node.description,
      status: "open",
      actionLabel: "争抢资源",
      reward: node.reward,
      risk: "medium",
      progress: {
        current: node.totalScore,
      },
      leaderAgentId: node.leaderboard[0]?.agentId,
      canonical: true,
      createdAt: node.spawnedAt,
    }));
  const anomalies: RegionCommissionSeed[] = anomaliesView(projection, { regionId: input.regionId, status: "open" })
    .map((anomaly) => ({
      commissionId: `anomaly:${anomaly.anomalyId}`,
      regionId: anomaly.regionId,
      sourceType: "anomaly",
      sourceId: anomaly.anomalyId,
      secretExposureTier: commissionSecretExposureTier({ sourceType: "anomaly", risk: anomaly.severity }),
      media: activityMedia("anomaly"),
      title: anomaly.title,
      summary: anomaly.description,
      status: "open",
      actionLabel: "压制异常",
      reward: anomaly.reward,
      risk: anomaly.severity,
      progress: {
        current: anomaly.totalScore,
        target: anomaly.targetScore,
      },
      leaderAgentId: anomaly.leaderboard[0]?.agentId,
      canonical: true,
      createdAt: anomaly.spawnedAt,
    }));
  const bounties: RegionCommissionSeed[] = bountiesView(projection, { regionId: input.regionId, status: "open" })
    .map((bounty) => ({
      commissionId: `bounty:${bounty.bountyId}`,
      regionId: bounty.regionId,
      sourceType: "bounty",
      sourceId: bounty.bountyId,
      secretExposureTier: commissionSecretExposureTier({ sourceType: "bounty" }),
      media: activityMedia("bounty"),
      title: bounty.title,
      summary: bounty.description,
      status: "open",
      actionLabel: "领取悬赏",
      reward: {
        resourceId: bounty.rewardResourceId,
        amount: bounty.rewardAmount,
        reason: "bounty_reward",
      },
      canonical: true,
      createdAt: bounty.createdAt,
    }));
  const partyRuns: RegionCommissionSeed[] = partyRunsView(projection, { regionId: input.regionId, status: "open" })
    .map((partyRun) => ({
      commissionId: `party_run:${partyRun.partyRunId}`,
      regionId: partyRun.regionId,
      sourceType: "party_run",
      sourceId: partyRun.partyRunId,
      secretExposureTier: commissionSecretExposureTier({ sourceType: "party_run" }),
      media: activityMedia("party_run"),
      title: partyRun.title,
      summary: partyRun.objective,
      status: "open",
      actionLabel: "加入小队",
      progress: {
        current: partyRun.members.length,
        target: MAX_PARTY_RUN_MEMBERS,
      },
      leaderAgentId: partyRun.leaderAgentId,
      canonical: true,
      createdAt: partyRun.createdAt,
    }));
  const socialHooks: RegionCommissionSeed[] = socialHooksView(projection, { regionId: input.regionId })
    .map((hook) => ({
      commissionId: `social_hook:${hook.hookId}`,
      regionId: hook.regionId,
      sourceType: "social_hook",
      sourceId: hook.hookId,
      secretExposureTier: commissionSecretExposureTier({ sourceType: "social_hook", risk: hook.risk }),
      media: activityMedia("social_hook"),
      title: hook.title,
      summary: hook.body,
      status: "open",
      actionLabel: hook.actionLabel,
      risk: hook.risk,
      canonical: true,
      createdAt: hook.createdAt,
    }));
  const priority: Record<EpochRegionCommissionSourceType, number> = {
    anomaly: 0,
    resource_node: 1,
    bounty: 2,
    party_run: 3,
    objective: 4,
    social_hook: 5,
  };
  const sorted = [...anomalies, ...resourceNodes, ...bounties, ...partyRuns, ...objectives, ...socialHooks]
    .sort((left, right) =>
      priority[left.sourceType] - priority[right.sourceType]
      || (right.progress?.current || 0) - (left.progress?.current || 0)
      || right.createdAt.localeCompare(left.createdAt)
      || left.commissionId.localeCompare(right.commissionId));
  const locationMotifBias = dominantLocationMotifBias(locationMotifQuotasView(projection, { regionId: input.regionId }));
  return addSecretRevealBudgets(
    projection,
    sorted.map((commission) => applyLocationMotifBiasToCommission(commission, locationMotifBias)),
  );
}

export function locationMotifQuotasView(projection: EpochProjection, input: { regionId: string }): readonly EpochLocationMotifQuota[] {
  const regionNpcCount = Object.values(projection.npcs)
    .filter((npc) => npc.regionId === input.regionId).length;
  const counts: Record<EpochLocationMotif, number> = {
    ecology: monumentsView(projection, { regionId: input.regionId }).length + (projection.regionControls[input.regionId] ? 1 : 0),
    creature: 0,
    faction: regionFactionPressureView(projection, { regionId: input.regionId }).length
      + organizationsView(projection, { regionId: input.regionId }).length,
    anomaly: anomaliesView(projection, { regionId: input.regionId }).length,
    resource: resourceNodesView(projection, { regionId: input.regionId }).length,
    character: regionNpcCount
      + npcCandidatesView(projection, { regionId: input.regionId }).length
      + activeAgentsView(projection, { regionId: input.regionId }).length,
  };
  return LOCATION_MOTIFS
    .map((motif) => locationMotifQuota({ regionId: input.regionId, motif, count: counts[motif] }));
}
