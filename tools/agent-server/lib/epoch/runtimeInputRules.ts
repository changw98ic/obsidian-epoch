import { resolveEpochCanonicalRegionId } from "../regionAliases.ts";
import type { EpochObjectiveMode, EpochResourceId, EpochServerReward } from "./protocol.ts";

export type RuntimeInputRecord = Record<string, unknown>;

export interface EpochRuntimeObjectiveTemplate {
  readonly title: string;
  readonly description: string;
  readonly resourceId: EpochResourceId;
  readonly targetScore: number;
  readonly mode: EpochObjectiveMode;
  readonly reward: EpochServerReward;
  readonly consolationReward?: EpochServerReward;
}

export interface EpochRuntimeSeasonTemplate {
  readonly title: string;
  readonly description: string;
  readonly factionIds: readonly string[];
  readonly resourceId: EpochResourceId;
  readonly targetScore: number;
  readonly reward: EpochServerReward;
  readonly objectives?: readonly {
    readonly objectiveKey: string;
    readonly title: string;
    readonly description: string;
    readonly targetScore: number;
  }[];
}

export const EPOCH_RUNTIME_OBJECTIVE_TEMPLATES: Readonly<Record<string, EpochRuntimeObjectiveTemplate>> = {
  supply_drive: {
    title: "区域补给竞标",
    description: "投入钱币支援区域补给线，贡献最高的身份会进入区域榜并获得传说奖励。",
    resourceId: "coin",
    targetScore: 20,
    mode: "contribution",
    reward: { resourceId: "legend", amount: 2, reason: "objective_supply_drive_winner" },
  },
  archive_focus: {
    title: "档案校准会战",
    description: "投入专注整理区域异常档案，贡献最高的身份会获得灵质奖励。",
    resourceId: "focus",
    targetScore: 18,
    mode: "contribution",
    reward: { resourceId: "aether", amount: 3, reason: "objective_archive_focus_winner" },
  },
  trace_race: {
    title: "灰痕竞速委托",
    description: "率先投入足够专注并越过服务器目标线的身份获得主奖励；后续完成者只获得小额见证回报。",
    resourceId: "focus",
    targetScore: 9,
    mode: "race",
    reward: { resourceId: "legend", amount: 4, reason: "race_trace_first_completion" },
    consolationReward: { resourceId: "aether", amount: 1, reason: "race_trace_later_completion" },
  },
};

export const EPOCH_RUNTIME_SEASON_TEMPLATES: Readonly<Record<string, EpochRuntimeSeasonTemplate>> = {
  gray_harbor_faction_season: {
    title: "灰港潮汐季",
    description: "阵营投入钱币维护灰港潮汐防线，赛季结算时贡献最高阵营获胜，阵营内最高贡献身份获得传说奖励。",
    factionIds: ["gray_watch", "cinder_archive", "white_tower_compact"],
    resourceId: "coin",
    targetScore: 12,
    reward: { resourceId: "legend", amount: 2, reason: "season_gray_harbor_winner" },
    objectives: [{
      objectiveKey: "raise_tide_beacon",
      title: "潮汐信标",
      description: "任一阵营推进赛季总分达到 1 点后，服务器完成灰港潮汐信标目标。",
      targetScore: 1,
    }],
  },
  cinder_archive_season: {
    title: "余烬档案季",
    description: "阵营投入灵质修复火印档案，赛季结算时贡献最高阵营取得封存权，阵营内最高贡献身份获得传说奖励。",
    factionIds: ["cinder_archive", "gray_watch", "white_tower_compact"],
    resourceId: "aether",
    targetScore: 10,
    reward: { resourceId: "legend", amount: 2, reason: "season_cinder_archive_winner" },
    objectives: [{
      objectiveKey: "seal_memory_ledger",
      title: "封存记忆册",
      description: "任一阵营推进赛季总分达到 1 点后，服务器完成余烬记忆册封存目标。",
      targetScore: 1,
    }],
  },
  white_tower_compact_season: {
    title: "白塔测绘季",
    description: "阵营投入专注校准灵质测绘网，赛季结算时贡献最高阵营取得测绘权，阵营内最高贡献身份获得传说奖励。",
    factionIds: ["white_tower_compact", "gray_watch", "cinder_archive"],
    resourceId: "focus",
    targetScore: 10,
    reward: { resourceId: "legend", amount: 2, reason: "season_white_tower_winner" },
    objectives: [{
      objectiveKey: "calibrate_aether_grid",
      title: "校准灵质测绘网",
      description: "任一阵营推进赛季总分达到 1 点后，服务器完成白塔灵质测绘目标。",
      targetScore: 1,
    }],
  },
};

export function canonicalRegionIdFromInput(regionId: unknown): string | undefined {
  if (typeof regionId !== "string") return undefined;
  const trimmed = regionId.trim();
  return trimmed ? resolveEpochCanonicalRegionId(trimmed) : undefined;
}

export function canonicalRegionIdOrDefault(regionId: unknown, fallback: string): string {
  return canonicalRegionIdFromInput(regionId) || fallback;
}

export function hostedSessionStatusFromInput(value: unknown): "active" | "completed" | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const status = value.trim();
  if (status === "active" || status === "completed") return status;
  throw new Error("hosted_session_status_invalid");
}

export function runtimeObjectiveTemplate(input: RuntimeInputRecord = {}) {
  const objectiveKey = typeof input.objectiveKey === "string" && EPOCH_RUNTIME_OBJECTIVE_TEMPLATES[input.objectiveKey]
    ? input.objectiveKey
    : "supply_drive";
  return {
    objectiveKey,
    template: EPOCH_RUNTIME_OBJECTIVE_TEMPLATES[objectiveKey],
  };
}

export function runtimeSeasonTemplate(input: RuntimeInputRecord = {}) {
  const seasonKey = typeof input.seasonKey === "string" && EPOCH_RUNTIME_SEASON_TEMPLATES[input.seasonKey]
    ? input.seasonKey
    : "gray_harbor_faction_season";
  return {
    seasonKey,
    template: EPOCH_RUNTIME_SEASON_TEMPLATES[seasonKey],
  };
}

export function runtimeAbuseActorKey(input: RuntimeInputRecord) {
  return String(
    input.actorExplorerId
      || input.explorerId
      || input.agentId
      || input.runnerId
      || input.sourceAgentId
      || input.sellerAgentId
      || input.buyerAgentId
      || input.attackerAgentId
      || input.sessionId
      || input.challengeId
      || "system",
  );
}
