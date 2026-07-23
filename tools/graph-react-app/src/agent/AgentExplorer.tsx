import { useEffect, useMemo, useRef, useState } from "react";
import { AGENT_SERVER_BASE, DEFAULT_AGENT, DEMO_CONTRACT } from "./agentTypes";
import { BountyPanel } from "./components/BountyPanel";
import { CompetitiveLadderPanel } from "./components/CompetitiveLadderPanel";
import { DirectTradePanel } from "./components/DirectTradePanel";
import { EncounterPanel } from "./components/EncounterPanel";
import { GameRunTimeline } from "./components/GameRunTimeline";
import { InventoryPanel } from "./components/InventoryPanel";
import { MarketPanel } from "./components/MarketPanel";
import { PartyRunPanel } from "./components/PartyRunPanel";
import { PublicReceiptDisclosure } from "./components/PublicReceiptDisclosure";
import { PublicWorldPanel } from "./components/PublicWorldPanel";
import { RaidRetaliationPanel } from "./components/RaidRetaliationPanel";
import { RelationshipDiplomacyPanel } from "./components/RelationshipDiplomacyPanel";
import { RegionOverviewPanel } from "./components/RegionOverviewPanel";
import { ResourcePanel } from "./components/ResourcePanel";
import { ResultNavigation } from "./components/ResultNavigation";
import { SeasonPanel } from "./components/SeasonPanel";
import { TurnHostedActionPanel } from "./components/TurnHostedActionPanel";
import { WorldOverviewPanel } from "./components/WorldOverviewPanel";
import { WebBridgePlaySurface } from "./components/WebBridgePlaySurface";
import { runAgentAction } from "./agentActionController";
import { createAgentInstallReadiness } from "./agentInstallReadinessController";
import { createAgentPlayerActionReadiness } from "./agentPlayerActionReadinessController";
import {
  AGENT_WORLD_TOOLS,
  DOWNTIME_OPTIONS,
  EPOCH_TOOLS,
  PLAYER_DOWNTIME_OPTIONS,
  PLAYER_RESOURCE_LABELS,
  playerActionLabel,
  playerAgentLabel,
  playerCommonStatusLabel,
  playerDowntimeLabel,
  playerEventLabel,
  playerEventTypeLabel,
  playerFactionLabel,
  playerHostedStatusLabel,
  playerIdentityStatusLabel,
  playerLoreAdjudicationStatusLabel,
  playerLoreContributionCategoryLabel,
  playerPublicSummaryText,
  playerRecordLabel,
  playerRegionLabel,
  playerRelationshipKindLabel,
  playerResourceCaption,
  playerSourceTypeLabel,
  playerToolLabel,
  playerTrustClassLabel,
} from "./agentPlayerLabels";
import { defaultAgentProgressRefreshApi, refreshAgentProgress } from "./agentProgressController";
import { applyAgentRegionSnapshot, createAgentRegionSnapshot } from "./agentRegionController";
import type { AgentRegionSnapshotOptions } from "./agentRegionController";
import {
  adjudicateEpochLoreTarget,
  acceptEpochDirectTrade,
  archiveEpochIdentity,
  cancelEpochMarketOrder,
  cancelEpochDirectTrade,
  claimEpochNewsLegend,
  claimEpochDowntime,
  confirmEpochPersonalityDrift,
  confirmEpochAction,
  contributeEpochObjective,
  contributeEpochOrganizationTreasury,
  contributeEpochSeason,
  contestEpochAnomaly,
  contestEpochResourceNode,
  createEpochAttestationChallenge,
  createEpochBounty,
  craftEpochInventoryItem,
  createEpochDirectTrade,
  createEpochMarketOrder,
  createEpochOrganization,
  createEpochPartyRun,
  createEpochPlayerDataExport,
  createEpochResultPage,
  createEpochTurnCard,
  downloadEpochPackage,
  fillEpochMarketOrder,
  getEpochAbuseProfiles,
  getEpochAbuseStatus,
  getEpochAnomalies,
  getEpochAudit,
  getEpochBounties,
  getEpochConfirmations,
  getEpochCompetitiveLadder,
  getEpochDiplomacy,
  getEpochExplorerProfile,
  getEpochHostedSessions,
  getEpochInstallManifest,
  getEpochInstallStatus,
  getEpochInventory,
  getEpochDirectTrades,
  getEpochMarket,
  getEpochMessages,
  getEpochModerationQueue,
  getEpochObjectives,
  getEpochOperatorOverview,
  getEpochPartyRuns,
  getEpochRaids,
  getEpochRelationships,
  getEpochResourceNodes,
  getEpochRegionInfo,
  getEpochResultPage,
  getEpochSeasons,
  getEpochServerHostedJobs,
  getEpochShop,
  getEpochWorldOverview,
  getPublicWorld,
  generateEpochRegionNews,
  issueEpochIdentity,
  joinEpochPartyRun,
  postEpochMessage,
  proposeEpochOrganizationBudget,
  proposeEpochDiplomacy,
  purchaseEpochOrganizationUpgrade,
  purchaseEpochShopOffer,
  queueEpochServerHostedAction,
  releaseEpochAbuseRestriction,
  recordEpochRiskReview,
  registerEpochExplorer,
  releaseEpochMarketRiskRestriction,
  reviewEpochNpcCandidate,
  requestEpochConfirmation,
  requestEpochPartyJoin,
  resolveEpochPartyJoinRequest,
  rotateEpochRecovery,
  runEpochExploration,
  runEpochMaintenance,
  runEpochServerHostedAction,
  runEpochServerHostedJob,
  claimEpochBounty,
  reincarnateEpochIdentity,
  revokeEpochResultPage,
  resolveEpochModeration,
  resolveEpochOrganizationBudget,
  resolveEpochAnomaly,
  resolveEpochRaid,
  resolveEpochRegionRevolt,
  resolveEpochRetaliation,
  resolveEpochTurn,
  respondEpochDiplomacy,
  seedEpochObjective,
  seedEpochSeason,
  settleEpochResourceNode,
  settleEpochObjective,
  settleEpochPartyRun,
  settleEpochSeason,
  setEpochDowntime,
  spawnEpochAnomaly,
  spawnEpochResourceNode,
  submitEpochNpcCandidate,
  startEpochHostedSession,
  startEpochWebBridgeTurn,
  submitEpochAttestedAction,
  submitEpochHostedAction,
  submitEpochWebBridgeAction,
  tickEpochDowntime,
  tickEpochDirectTradeExpiry,
  tickEpochMarketExpiry,
  tickEpochNpcLifecycle,
  tickEpochOrganizationPolitics,
  updateEpochPartyInvite,
  updateEpochOrganizationMembership,
  updateEpochRelationship,
} from "./api";
import type { EpochInstallStatus } from "./api";
import {
  clearPendingExplorerRecoveryRotation,
  createExplorerIdentityFromRegistration,
  createRotatedExplorerRecovery,
  exportEncryptedExplorerArchive,
  exportRecoveryCode,
  importEncryptedExplorerArchive,
  loadExplorerIdentity,
  loadPendingExplorerRecoveryRotation,
  savePendingExplorerRecoveryRotation,
  saveExplorerIdentity,
  type PendingExplorerRecoveryRotation,
} from "./localIdentity";
import { sanitizeKeyMaterialErrorMessage } from "./keyIsolation";
import { completeExplorerRecoveryRotationTransaction } from "./recoveryRotationController";
import type {
  AgentPublicWorld,
  EpochAbuseProfilesInfo,
  EpochAbuseStatus,
  EpochAgentIdentity,
  EpochAgentBriefingView,
  EpochAgentMemoryInfo,
  EpochPersonalMigrationSummary,
  EpochAttestationChallenge,
  EpochAuditEventSummary,
  EpochAuditInfo,
  EpochAnomalyEvent,
  EpochBounty,
  EpochCompetitiveLadderMode,
  EpochCompetitiveLadderView,
  EpochContestedObjective,
  EpochDirectTrade,
  EpochDirectTradeStatus,
  EpochDiplomacyRecord,
  EpochDowntimeMode,
  EpochEvent,
  EpochExplorationMetrics,
  EpochExplorerProfileInfo,
  EpochHostedActionOption,
  EpochHostedSession,
  EpochHighValueConfirmation,
  EpochInstallManifest,
  EpochInventoryItem,
  EpochMarketOrder,
  EpochMarketRiskRestriction,
  EpochMarketTradeRiskFlag,
  EpochMaintenanceRunSummary,
  EpochMessageRecord,
  EpochModerationInfo,
  EpochModerationItem,
  EpochModerationResolution,
  EpochOperatorOverview,
  EpochPartyRun,
  EpochProgressView,
  EpochPublicSafeSummary,
  EpochRaidResult,
  EpochRelationshipEdge,
  EpochRelationshipKind,
  EpochRegionInfo,
  EpochResourceId,
  EpochResourceNode,
  EpochRiskReviewResolution,
  EpochResultPage,
  EpochSeasonCampaign,
  EpochSeasonContribution,
  EpochServerHostedActionRun,
  EpochServerHostedJob,
  EpochSharedResultPage,
  EpochShopOffer,
  EpochTurnActionOption,
  EpochTurnCard,
  EpochWebBridgeActionResult,
  EpochWebBridgeActionOption,
  EpochWebBridgeTurn,
  EpochLoreTargetStatus,
  EpochWorldOverviewInfo,
  ExplorerIdentity,
} from "../types";

const CURRENT_AGENT_KEY = "obsidian_epoch_current_agent_id";
const PENDING_REGISTRATION_KEY = "obsidian_epoch_pending_registration_idempotency_key";
const EXPLORER_BACKUP_KEY_PREFIX = "obsidian_epoch_explorer_archive_backed_up:";
const LOW_STIMULUS_PREFERENCE_KEY = "obsidian_epoch_low_stimulus_mode";
const LOW_STIMULUS_GUIDANCE = "低刺激模式：避免惊吓、闪烁、身体异化、低语音效和过强恐怖描写；保留清晰选择与退出路径。";
const SENSITIVE_KEY_CALL_NOTICE = "首次模型调用前：不要输入真实身份、联系方式、学校、住址；第三方模型或供应商日志可能保留请求。";
const HIGH_STIMULUS_COMPLIANCE_REGIONS = [
  { value: "US", label: "US / 默认" },
  { value: "CN", label: "CN / 中国大陆" },
  { value: "EU", label: "EU / 欧盟" },
] as const;
const CONTENT_SAFETY_BOUNDARY_COPY = {
  allowed: "黑暗幻想、异化、怪物、非写实恐怖氛围属于世界观允许边界。",
  disallowed: "现实伤害指令、露骨性内容、仇恨骚扰、违法操作不属于世界观豁免。",
  appeal: "如果世界观内容被误拦，可以提交给运营复核。",
} as const;
const MCP_COMMAND = "npm run agent:mcp";
const INSTALL_CHECK_IDEMPOTENCY_SCOPE = "web_install_check";
const PLAYER_PRIMARY_ACTION_BUSY_REASON = "正在执行上一项操作，完成后可继续。";
const AGENT_BRIEFING_REFRESH_MS = 15000;
const RESULT_PUBLISH_AUTHORIZATION_COPY = "故事署名归你；入档发现会成为共享世界资料，可被他人引用。";
const FRONTSTAGE_LORE_OUTPUT_LABEL = "可入档发现";
const BASE_INTERVENTION_BUDGET = 1;
const HIGH_RISK_REQUEST_LIMIT = 1;

interface WorldInternalGoal {
  readonly scope: "近期" | "长期";
  readonly title: string;
  readonly unlock: string;
  readonly proof: string;
}

const WORLD_INTERNAL_GOALS: readonly WorldInternalGoal[] = [
  {
    scope: "近期",
    title: "灰港边缘巡查证",
    unlock: "完成一次档案馆推荐委托",
    proof: "拿到首份可入档发现",
  },
  {
    scope: "近期",
    title: "腐林见习证实者",
    unlock: "让腐林地点出现在结算影响切片",
    proof: "公开页记录地点影响",
  },
  {
    scope: "近期",
    title: "云脑族临时信使",
    unlock: "接续一次云脑族相关消息或委托",
    proof: "获得断线线索权限",
  },
  {
    scope: "长期",
    title: "腐林证实者 II",
    unlock: "累计证实三条腐林可入档发现",
    proof: "解锁云脑族断线委托",
  },
];

const STARTER_RISK_PREFERENCE_OPTIONS = [
  {
    value: "cautious",
    label: "谨慎",
    caption: "低风险观察，优先撤退和封存线索",
    mandate: "档案馆推荐委托：灰港边缘巡查。风险偏好：谨慎，只观察公开异常和安全路线。",
  },
  {
    value: "balanced",
    label: "均衡",
    caption: "标准巡查，允许有限接触和证据补全",
    mandate: "档案馆推荐委托：灰港边缘巡查。风险偏好：均衡，优先完成可审档线索。",
  },
  {
    value: "bold",
    label: "冒险",
    caption: "更主动接近异常，但仍受首局保护",
    mandate: "档案馆推荐委托：灰港边缘巡查。风险偏好：冒险，可尝试低阶异常接触。",
  },
] as const;

const STARTER_DEATH_PROTECTION = {
  label: "首局非永久死亡",
  summary: "首局默认不永久死亡；最坏结局为重伤封存或失踪待找回。",
  escalation: "永久死亡从第二局或高风险委托开始。",
  mandate: "首局保护：本委托不得永久死亡；最坏结局为重伤封存或失踪待找回。永久死亡从第二局或高风险委托开始；若本委托升级到高风险，必须先明确授权永久死亡风险。",
} as const;

const STARTER_REWARD_ISOLATION = {
  label: "首局收益隔离",
  summary: "首局保护只保 agent；不给可迁移声望、源流或强外物。",
  verification: "首局产物需通过后续真实委托证实才有世界影响。",
  mandate: "首局收益隔离：本委托只保护 agent，不给可迁移声望、源流奖励或强外物；产物只能作为 nonEvidence 线索，需通过后续真实委托证实才有世界影响。",
} as const;

const STARTER_SECRET_EXPOSURE_POLICY = {
  label: "首局秘密等级",
  allowed: ["T0_public", "T1_low_rumor"] as const,
  summary: "首局只允许公开信息或低阶传闻，不触及核心秘密。",
  mandate: "首局秘密等级：只允许 T0_public/T1_low_rumor（公开或低阶传闻）；不得触及 T2_local_secret、T3_core_secret 或 T4_forbidden_core。",
} as const;

type StarterRiskPreference = (typeof STARTER_RISK_PREFERENCE_OPTIONS)[number]["value"];

type RevisitPrimaryActionKind = "审档" | "修正" | "接续" | "找回" | "领取";

interface RevisitPrimaryAction {
  readonly kind: RevisitPrimaryActionKind;
  readonly label: string;
  readonly disabled: boolean;
}

type ResultSettlementScreenKey = "ending" | "score" | "drop" | "next";

interface ResultImpactMapItem {
  readonly kind: "地点" | "阵营" | "委托" | "争议";
  readonly label: string;
  readonly detail: string;
}

interface AgentNarrativeHomepage {
  readonly timeline: readonly string[];
  readonly scar: string;
  readonly relationshipChange: string;
  readonly selfLine: string;
}

interface ShareCardStatus {
  readonly level: "证实" | "传闻" | "争议";
  readonly sourceBattleReport: string;
  readonly confirmedLabel: "已证实" | "未证实";
  readonly visualState: "confirmed" | "provisional";
  readonly note: string;
  readonly publicSafeSummary: EpochPublicSafeSummary;
}

const DEFAULT_RESULT_SETTLEMENT_SCREEN = {
  key: "ending",
  label: "结局",
  caption: "确认本次结局和校验证明，再决定是否公开。",
  primaryAction: "审档",
} as const;

const RESULT_SETTLEMENT_SCREENS: readonly {
  readonly key: ResultSettlementScreenKey;
  readonly label: string;
  readonly caption: string;
  readonly primaryAction: "审档" | "修正" | "领取" | "接续";
}[] = [
  DEFAULT_RESULT_SETTLEMENT_SCREEN,
  {
    key: "score",
    label: "评分",
    caption: "复核事件、可信度和资源变化，发现异常就修正。",
    primaryAction: "修正",
  },
  {
    key: "drop",
    label: "掉落",
    caption: "查看可领取收益、资源变化和未领取托管收益。",
    primaryAction: "领取",
  },
  {
    key: "next",
    label: "下一步",
    caption: "选择接续、回访或刷新服务器建议行动。",
    primaryAction: "接续",
  },
] as const;

interface DemoModeReport {
  readonly title: string;
  readonly mandate: string;
  readonly anchors: readonly string[];
  readonly discoveries: readonly string[];
  readonly isolation: {
    readonly uploadable: false;
    readonly settleable: false;
    readonly reputationEligible: false;
    readonly graphEligible: false;
  };
}

type InterventionMode = "running" | "paused" | "instruction_appended" | "takeover";
type RiskStrategy = "谨慎" | "均衡" | "冒险";
type HighRiskPackageKind = "turn_card" | "resolve_turn";
type HighRiskPackageStatus = "pending" | "authorized" | "rejected";

interface HighRiskPackage {
  readonly kind: HighRiskPackageKind;
  readonly label: string;
  readonly requestCount: number;
  readonly status: HighRiskPackageStatus;
  readonly strategy: RiskStrategy;
}

const INTERVENTION_MODE_LABELS: Record<InterventionMode, string> = {
  running: "运行中",
  paused: "已暂停",
  instruction_appended: "已追加指令",
  takeover: "接管本轮",
};

const RISK_STRATEGIES: readonly RiskStrategy[] = ["谨慎", "均衡", "冒险"];

const SEASON_TEMPLATE_OPTIONS = [
  { value: "gray_harbor_faction_season", label: "灰港潮汐季" },
  { value: "cinder_archive_season", label: "余烬档案季" },
  { value: "white_tower_compact_season", label: "白塔测绘季" },
] as const;

const CRAFT_RECIPE_OPTIONS = [
  { value: "field-kit", label: "灰行者工具包", cost: "钱币5 / 灵质1" },
  { value: "focus-charm", label: "静心盐线护符", cost: "专注点3 / 灵质2" },
  { value: "training-band", label: "巡夜训练缚带", cost: "体力4 / 钱币2" },
] as const;

const ORGANIZATION_MEMBERSHIP_ROLE_OPTIONS = [
  { value: "member", label: "成员" },
  { value: "scout", label: "斥候" },
  { value: "vanguard", label: "先锋" },
  { value: "support", label: "支援" },
  { value: "artisan", label: "工匠" },
  { value: "scribe", label: "书记" },
  { value: "clerk", label: "办事员" },
] as const;
const ORGANIZATION_BUDGET_GOVERNANCE_ROLES = new Set(["vanguard", "scribe", "clerk"]);

const ORGANIZATION_UPGRADE_OPTIONS = [
  { value: "training_hall", label: "训练厅", cost: "传说2", effect: "本区域赛季贡献 +1 分，只加分不产出资源" },
] as const;

const LORE_ADJUDICATION_STATUS_OPTIONS: { value: EpochLoreTargetStatus; label: string }[] = [
  { value: "confirmed", label: "确认" },
  { value: "refuted", label: "驳回" },
  { value: "revised", label: "修订" },
  { value: "contested", label: "争议" },
];

type SeasonContributionResult = EpochSeasonContribution;

function payloadString(payload: Record<string, unknown>, key: string): string | null {
  const value = payload[key];
  return typeof value === "string" && value.trim() ? value : null;
}

function payloadNumber(payload: Record<string, unknown>, key: string): number | null {
  const value = payload[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function payloadStringArray(payload: Record<string, unknown>, key: string): readonly string[] {
  const value = payload[key];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && Boolean(item)) : [];
}

function isEpochResourceId(value: string): value is EpochResourceId {
  return Object.prototype.hasOwnProperty.call(PLAYER_RESOURCE_LABELS, value);
}

function seasonContributionResultFromEvent(event: EpochEvent): SeasonContributionResult | null {
  if (event.eventType !== "season_contribution_recorded") return null;
  const payload = event.payload;
  const seasonId = payloadString(payload, "seasonId");
  const agentId = payloadString(payload, "agentId");
  const explorerId = payloadString(payload, "explorerId");
  const factionId = payloadString(payload, "factionId");
  const resourceId = payloadString(payload, "resourceId");
  const amount = payloadNumber(payload, "amount");
  const baseScoreDelta = payloadNumber(payload, "baseScoreDelta");
  const organizationBonusScore = payloadNumber(payload, "organizationBonusScore");
  const regionControlBonusScore = payloadNumber(payload, "regionControlBonusScore") ?? 0;
  const scoreDelta = payloadNumber(payload, "scoreDelta");
  const agentScoreAfter = payloadNumber(payload, "agentScoreAfter");
  const factionScoreAfter = payloadNumber(payload, "factionScoreAfter");
  const totalScoreAfter = payloadNumber(payload, "totalScoreAfter");
  if (
    !seasonId
    || !agentId
    || !explorerId
    || !factionId
    || !resourceId
    || !isEpochResourceId(resourceId)
    || amount === null
    || baseScoreDelta === null
    || organizationBonusScore === null
    || scoreDelta === null
    || agentScoreAfter === null
    || factionScoreAfter === null
    || totalScoreAfter === null
  ) {
    return null;
  }
  return {
    eventId: event.eventId,
    seasonId,
    agentId,
    explorerId,
    factionId,
    resourceId,
    amount,
    baseScoreDelta,
    organizationBonusScore,
    regionControlBonusScore,
    scoreDelta,
    sourceOrganizationUpgradeIds: payloadStringArray(payload, "sourceOrganizationUpgradeIds"),
    sourceRegionControlRegionIds: payloadStringArray(payload, "sourceRegionControlRegionIds"),
    agentScoreAfter,
    factionScoreAfter,
    totalScoreAfter,
    trustClass: event.trustClass as EpochSeasonContribution["trustClass"],
    recordedAt: payloadString(payload, "recordedAt") || event.createdAt,
  };
}

const MARKET_TRADE_RISK_LABELS: Record<EpochMarketTradeRiskFlag, string> = {
  repeat_counterparty_trade: "重复对手方交易",
  suspicious_low_price: "异常低价",
  suspicious_high_price: "异常高价",
};

const MARKET_RESTRICTION_LABELS: Record<EpochMarketRiskRestriction["reason"], string> = {
  risk_review_escalated: "风险升级",
};

const DIRECT_TRADE_STATUS_LABELS: Record<EpochDirectTradeStatus, string> = {
  open: "待处理",
  accepted: "已成交",
  cancelled: "已撤回",
  expired: "已过期",
};

const DIRECT_TRADE_AUDIT_EVENT_TYPES = [
  "direct_trade_created",
  "direct_trade_accepted",
  "direct_trade_cancelled",
  "direct_trade_expired",
] as const;

const OPERATOR_HEALTH_LABELS: Record<EpochOperatorOverview["health"]["status"], string> = {
  ok: "正常",
  attention: "需关注",
  critical: "异常",
};

const MAINTENANCE_WORKER_HEALTH_LABELS: Record<EpochOperatorOverview["maintenance"]["health"]["workers"]["npcLifecycle"]["status"], string> = {
  ok: "正常",
  stale: "过期",
  missing: "缺失",
};

function errorMessage(error: unknown) {
  return sanitizeKeyMaterialErrorMessage(error);
}

const SEASON_PHASE_LABELS = {
  season_started: "赛季启动",
  season_resolved: "赛季结算",
} as const;

const SEASON_OBJECTIVE_EVENT_LABELS = {
  season_objective_created: "目标生成",
  season_objective_completed: "目标完成",
} as const;

const RISK_REVIEW_RESOLUTIONS: EpochRiskReviewResolution[] = ["cleared", "watchlisted", "escalated"];

const RISK_REVIEW_RESOLUTION_LABELS: Record<EpochRiskReviewResolution, string> = {
  cleared: "清除",
  watchlisted: "观察",
  escalated: "升级",
};

const HOSTED_RISK_LABELS: Record<EpochHostedActionOption["risk"], string> = {
  low: "低风险",
  medium: "中风险",
  high: "高风险",
};

const SERVER_HOSTED_OPTION_KEYS = [
  { value: "observe", label: "观察" },
  { value: "assist", label: "协助" },
  { value: "anomaly", label: "异常" },
] as const;

type ServerHostedOptionKey = (typeof SERVER_HOSTED_OPTION_KEYS)[number]["value"];

function explorerBackupKey(explorerId: string) {
  return `${EXPLORER_BACKUP_KEY_PREFIX}${explorerId}`;
}

function loadExplorerBackupStatus(explorerId: string) {
  return localStorage.getItem(explorerBackupKey(explorerId)) === "true";
}

function saveExplorerBackupStatus(explorerId: string, backedUp: boolean) {
  if (backedUp) {
    localStorage.setItem(explorerBackupKey(explorerId), "true");
  } else {
    localStorage.removeItem(explorerBackupKey(explorerId));
  }
}

function withLowStimulusGuidance(value: string, enabled: boolean) {
  const text = value.trim();
  if (!enabled || text.includes("低刺激模式：")) return text;
  return `${text}\n${LOW_STIMULUS_GUIDANCE}`;
}

function idempotencyKey(scope: string) {
  const random = typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}_${Math.random()}`;
  return `${scope}_${random}`;
}

function formatDate(value?: string) {
  if (!value) return "未记录";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function serverHostedOptionLabel(value?: string | null) {
  return SERVER_HOSTED_OPTION_KEYS.find((option) => option.value === value)?.label || value || "行动";
}

function serverHostedJobStatusLabel(value?: string | null) {
  const labels: Record<string, string> = {
    queued: "排队中",
    completed: "已完成",
    skipped: "已跳过",
    failed: "失败",
  };
  return labels[value || ""] || value || "待处理";
}

function playerEventDetail(event: EpochEvent) {
  const regionId = typeof event.payload.regionId === "string" ? event.payload.regionId : "";
  const region = playerRegionLabel(regionId);
  return region === "世界" ? formatDate(event.createdAt) : `${region} · ${formatDate(event.createdAt)}`;
}

function agentNarrativeHomepage({
  identity,
  progress,
  primaryRelationship,
  regionId,
}: {
  readonly identity: EpochAgentIdentity;
  readonly progress: EpochProgressView | null;
  readonly primaryRelationship: EpochRelationshipEdge | null;
  readonly regionId: string;
}): AgentNarrativeHomepage {
  const recentTimeline = (progress?.latestEvents || []).slice(0, 2).map((event) =>
    `${formatDate(event.createdAt)} · ${playerEventLabel(event)}`);
  const timeline = [
    `第 ${identity.generation} 世签发 · ${formatDate(identity.createdAt)}`,
    ...recentTimeline,
  ];
  const personalityTraits = identity.personality?.traits || [];
  const latestPersonalitySourceEventId = identity.personality?.latestSourceEventId;
  const scar = latestPersonalitySourceEventId
    ? `最近伤痕来自 ${playerRecordLabel(latestPersonalitySourceEventId, "事件")}；等待你确认是否写入性格漂移。`
    : personalityTraits.length
      ? `已写入 ${personalityTraits.join(" / ")}，暂无新的未确认伤痕。`
      : "暂无伤痕记录；重大伤痕、污染或背叛会先生成确认提案。";
  const relationshipChange = primaryRelationship
    ? `${playerRelationshipKindLabel(primaryRelationship.kind)} · ${playerAgentLabel(primaryRelationship.targetAgentId)} · ${primaryRelationship.scoreDelta >= 0 ? "+" : ""}${primaryRelationship.scoreDelta} · ${primaryRelationship.reason}`
    : "暂无新增关系边；下一次同行、冲突或外交会写入这里。";

  return {
    timeline,
    scar,
    relationshipChange,
    selfLine: `我叫${identity.identityName}，第 ${identity.generation} 世，正在${playerRegionLabel(regionId)}把见过的事留成可入档发现。`,
  };
}

function shortHash(value?: string) {
  if (!value) return "未记录";
  const [prefix, digest] = value.split(":");
  if (!digest) return value.length > 18 ? `${value.slice(0, 18)}...` : value;
  return `${prefix}:${digest.slice(0, 12)}`;
}

function epochAssetUrl(pathOrUrl: string) {
  if (/^https?:\/\//.test(pathOrUrl)) return pathOrUrl;
  return `${AGENT_SERVER_BASE}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`;
}

function resourceEntries(
  resources: EpochProgressView["resources"],
  resourceMedia: EpochProgressView["resourceMedia"] = {},
) {
  return (Object.keys(PLAYER_RESOURCE_LABELS) as EpochResourceId[]).map((resourceId) => ({
    resourceId,
    label: PLAYER_RESOURCE_LABELS[resourceId],
    caption: playerResourceCaption(resourceId),
    amount: resources[resourceId] || 0,
    media: resourceMedia[resourceId],
  }));
}

function normalizeProgressView(progress?: EpochProgressView | null): EpochProgressView {
  const base = progress || ({} as EpochProgressView);
  const fallbackEligibility: EpochProgressView["actionEligibility"] = {
    statusField: "progress.identity.status",
    status: base.identity?.status || "missing",
    canUseActiveTools: base.identity?.status === "active",
    reason: base.identity ? "服务器未返回行动权限投影，已按身份状态兜底。" : "等待服务器签发身份。",
    activeOnlyTools: [],
    blockedTools: [],
    recommendedTools: [],
  };
  return {
    ...base,
    lineage: base.lineage || [],
    identities: base.identities || [],
    resources: base.resources || {},
    resourceMedia: base.resourceMedia || {},
    inventoryItems: base.inventoryItems || [],
    equipmentEffects: base.equipmentEffects || [],
    downtime: base.downtime || null,
    custody: base.custody || null,
    pendingDowntime: base.pendingDowntime || null,
    actionEligibility: base.actionEligibility || fallbackEligibility,
    claimableLegendNews: base.claimableLegendNews || [],
    downtimeDiaryEntries: base.downtimeDiaryEntries || [],
    personalityDrifts: base.personalityDrifts || [],
    latestEvents: base.latestEvents || [],
  };
}

function normalizeResultPage(resultPage: EpochResultPage): EpochResultPage {
  const receipt = resultPage.receipt || ({} as EpochResultPage["receipt"]);
  return {
    ...resultPage,
    progress: normalizeProgressView(resultPage.progress),
    nextActions: resultPage.nextActions || [],
    receipt: {
      ...receipt,
      focus: receipt.focus || {
        kind: "agent_snapshot",
        id: resultPage.progress?.agentId || "missing",
      },
      trustClasses: receipt.trustClasses || [],
      canonicalEvents: receipt.canonicalEvents || [],
    },
    regionalContext: resultPage.regionalContext
      ? {
        ...resultPage.regionalContext,
        messages: resultPage.regionalContext.messages || [],
        news: resultPage.regionalContext.news || [],
        commissions: resultPage.regionalContext.commissions || [],
        raids: resultPage.regionalContext.raids || [],
        retaliations: resultPage.regionalContext.retaliations || [],
        traces: resultPage.regionalContext.traces || [],
      }
      : undefined,
  };
}

function signedDelta(value: number) {
  return value > 0 ? `+${value}` : `${value}`;
}

function formatDeltaRecord(delta?: Record<string, number>) {
  const entries = Object.entries(delta || {}).filter(([, value]) => value !== 0);
  return entries.length ? entries.map(([key, value]) => `${key} ${signedDelta(value)}`).join(" / ") : "无变化";
}

function normalizeExplorationMetrics(metrics?: EpochExplorationMetrics | null): EpochExplorationMetrics | null {
  if (!metrics) return null;
  return {
    combatPower: metrics.combatPower || 0,
    rating: metrics.rating || 0,
    intensity: metrics.intensity || "low",
    riskBreakdown: {
      low: metrics.riskBreakdown?.low || 0,
      medium: metrics.riskBreakdown?.medium || 0,
      high: metrics.riskBreakdown?.high || 0,
    },
    resourceDelta: metrics.resourceDelta || {},
    attributeDelta: metrics.attributeDelta || {},
    memoryDelta: {
      confirmed: metrics.memoryDelta?.confirmed || 0,
      rumor: metrics.memoryDelta?.rumor || 0,
      private: metrics.memoryDelta?.private || 0,
    },
  };
}

function memoryTotals(memory: EpochAgentMemoryInfo | null) {
  return {
    confirmed: memory?.totals?.confirmed ?? memory?.confirmedMemory?.length ?? 0,
    rumor: memory?.totals?.rumor ?? memory?.rumorMemory?.length ?? 0,
    privateRun: memory?.totals?.privateRun ?? memory?.privateRunMemory?.length ?? 0,
  };
}

function hostedOptionSummary(option: EpochHostedActionOption) {
  const reward = option.reward ? `${PLAYER_RESOURCE_LABELS[option.reward.resourceId]} +${option.reward.amount}` : "";
  const lifetime = option.lifetimeDelta ? `寿命 ${option.lifetimeDelta}` : "";
  return [HOSTED_RISK_LABELS[option.risk], reward, lifetime].filter(Boolean).join(" / ");
}

function organizationTreasuryReasonLabel(reason: string) {
  if (reason === "organization_upgrade:training_hall") return "升级支出 · 训练厅";
  if (reason.startsWith("organization_contribution:")) return "成员捐献";
  if (reason.startsWith("organization_budget:")) return "预算审批支出";
  if (reason.startsWith("season_campaign:")) return "赛季入账";
  return reason;
}

function isOrganizationBudgetGovernanceRole(role?: string) {
  return Boolean(role && ORGANIZATION_BUDGET_GOVERNANCE_ROLES.has(role));
}

function organizationBudgetVoteLabel(decision: "approved" | "rejected") {
  return decision === "approved" ? "赞成" : "反对";
}

function marketSellLabel(order: EpochMarketOrder) {
  if (order.sellKind === "item") {
    return `${order.sellItemDisplayName || order.sellItemId || "未知物品"} · 物品`;
  }
  const resourceId = order.sellResourceId || "coin";
  return `${PLAYER_RESOURCE_LABELS[resourceId]} ${order.sellAmount}`;
}

function directTradeAssetLabel(trade: EpochDirectTrade, side: "offer" | "request") {
  const asset = side === "offer" ? trade.offeredAsset : trade.requestedAsset;
  if (asset.kind === "item") {
    return `${asset.itemDisplayName || asset.itemId || "指定物品"}${asset.itemRarity ? ` · ${asset.itemRarity}` : ""}`;
  }
  return `${PLAYER_RESOURCE_LABELS[asset.resourceId || "coin"]} ${asset.amount || 0}`;
}

function directTradeMatchesSearch(trade: EpochDirectTrade, search: string) {
  const query = search.trim().toLowerCase();
  if (!query) return true;
  const riskLabels = (trade.tradeRiskFlags || []).map((flag) => MARKET_TRADE_RISK_LABELS[flag] || flag);
  return [
    trade.tradeId,
    trade.proposerAgentId,
    trade.counterpartyAgentId,
    trade.regionId,
    trade.status,
    DIRECT_TRADE_STATUS_LABELS[trade.status],
    directTradeAssetLabel(trade, "offer"),
    directTradeAssetLabel(trade, "request"),
    trade.offeredAsset.kind,
    trade.requestedAsset.kind,
    trade.offeredAsset.resourceId,
    trade.requestedAsset.resourceId,
    trade.offeredAsset.itemId,
    trade.offeredAsset.itemDisplayName,
    trade.offeredAsset.itemRarity,
    trade.requestedAsset.itemId,
    trade.requestedAsset.itemDisplayName,
    trade.requestedAsset.itemRarity,
    ...riskLabels,
  ]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(query));
}

function inventoryItemMatchesSearch(item: EpochInventoryItem, search: string) {
  const query = search.trim().toLowerCase();
  if (!query) return true;
  return [item.displayName, item.rarity, item.itemKey, item.itemId]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(query));
}

function organizationMatchesSearch(organization: EpochRegionInfo["organizations"][number], search: string) {
  const query = search.trim().toLowerCase();
  if (!query) return true;
  return [
    organization.organizationId,
    organization.organizationKey,
    organization.displayName,
    organization.regionId,
    String(organization.standing),
    `standing ${organization.standing}`,
    resourceAmountSummary(organization.treasury),
    ...organization.memberNpcIds,
    ...organization.memberAgentIds,
    ...organization.upgradeKeys,
  ]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(query));
}

function resourceAmountSummary(resources: Partial<Record<EpochResourceId, number>>) {
  const items = (Object.keys(PLAYER_RESOURCE_LABELS) as EpochResourceId[])
    .filter((resourceId) => typeof resources[resourceId] === "number")
    .map((resourceId) => `${PLAYER_RESOURCE_LABELS[resourceId]} ${resources[resourceId]}`);
  return items.length ? items.join(" / ") : "暂无";
}

function rewardSummary(rewards: readonly { resourceId: EpochResourceId; amount: number }[]) {
  return rewards.length
    ? rewards.map((reward) => `${PLAYER_RESOURCE_LABELS[reward.resourceId]} +${reward.amount}`).join(" / ")
    : "暂无可领取资源";
}

function reputationInterventionBonus({
  legend,
  seasonScore,
  organizationStanding,
}: {
  readonly legend: number;
  readonly seasonScore: number;
  readonly organizationStanding: number;
}) {
  const reputationScore = Math.max(legend, seasonScore, organizationStanding);
  if (reputationScore >= 12) return 2;
  if (reputationScore >= 5) return 1;
  return 0;
}

function frontstageDiscoverySummary(discoveries: readonly string[]) {
  return discoveries.length
    ? discoveries.map((discovery) => `${FRONTSTAGE_LORE_OUTPUT_LABEL}：${discovery}`).join(" / ")
    : `暂无${FRONTSTAGE_LORE_OUTPUT_LABEL}`;
}

function resultImpactMapItems(resultPage: EpochResultPage): readonly ResultImpactMapItem[] {
  if (!resultPage.regionalContext) return [];
  const context = resultPage.regionalContext;
  const items: ResultImpactMapItem[] = [
    {
      kind: "地点",
      label: playerRegionLabel(resultPage.regionalContext.regionId),
      detail: context.regionControl
        ? `控制 ${playerFactionLabel(context.regionControl.controllingFactionId)} · 分值 ${context.regionControl.controlScore}`
        : "暂无公开控制者",
    },
  ];

  if (context.regionControl?.contestedByFactionId) {
    items.push({
      kind: "阵营",
      label: playerFactionLabel(context.regionControl.contestedByFactionId),
      detail: `争夺 ${playerFactionLabel(context.regionControl.controllingFactionId)} · 差值 ${context.regionControl.controlMargin}`,
    });
  } else if (context.regionControl?.controllingFactionId) {
    items.push({
      kind: "阵营",
      label: playerFactionLabel(context.regionControl.controllingFactionId),
      detail: `控制分 ${context.regionControl.controlScore}`,
    });
  }

  const commission = (context.commissions || [])[0];
  if (commission) {
    items.push({
      kind: "委托",
      label: commission.actionLabel,
      detail: `${playerSourceTypeLabel(commission.sourceType)} · ${playerCommonStatusLabel(commission.status)}`,
    });
  }

  const raid = (context.raids || [])[0];
  if (raid) {
    items.push({
      kind: "争议",
      label: playerCommonStatusLabel(raid.outcome),
      detail: `攻 ${raid.attackerPower} / 防 ${raid.defenderPower}`,
    });
  }

  const retaliation = (context.retaliations || [])[0];
  if (retaliation) {
    items.push({
      kind: "争议",
      label: `目标 ${shortHash(retaliation.targetAgentId)}`,
      detail: `复仇 ${playerCommonStatusLabel(retaliation.status)}`,
    });
  }

  const trace = (context.traces || [])[0];
  if (trace) {
    items.push({
      kind: "争议",
      label: playerEventTypeLabel(trace.sourceEventType),
      detail: trace.summary,
    });
  }

  return items.slice(0, 4);
}

function shareCardStatusForResult(resultPage: EpochResultPage): ShareCardStatus {
  const canonicalEvents = resultPage.receipt?.canonicalEvents || [];
  const isConfirmed = canonicalEvents.length > 0;
  const hasContestedContext = Boolean(
    (resultPage.regionalContext?.traces || []).length
      || (resultPage.regionalContext?.raids || []).length
      || (resultPage.regionalContext?.retaliations || []).length,
  );
  const level = isConfirmed ? "证实" : hasContestedContext ? "争议" : "传闻";

  return {
    level,
    sourceBattleReport: resultPage.receipt?.focus ? `${resultPage.receipt.focus.kind}:${resultPage.receipt.focus.id}` : "server_result_receipt:missing",
    confirmedLabel: isConfirmed ? "已证实" : "未证实",
    visualState: isConfirmed ? "confirmed" : "provisional",
    note: isConfirmed
      ? `校验证明包含 ${canonicalEvents.length} 条可审计事件`
      : "传闻/争议只显示为未证实",
    publicSafeSummary: resultPage.publicSafeSummary,
  };
}

function formatShopCosts(costs: EpochShopOffer["costs"]) {
  return costs.map((cost) => `${PLAYER_RESOURCE_LABELS[cost.resourceId]}${cost.amount}`).join(" / ");
}

function downloadJson(fileName: string, value: unknown) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function downloadBlob(fileName: string, value: Blob) {
  const url = URL.createObjectURL(value);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

export default function AgentExplorer({
  onBack,
  initialSurface,
}: {
  onBack: () => void;
  initialSurface?: "web-bridge";
}) {
  const briefingRequestSeq = useRef(0);
  const recoveryRotationResumeRef = useRef("");
  const currentAgentIdRef = useRef("");
  const regionIdRef = useRef("region_gray_harbor");
  const [explorer, setExplorer] = useState<ExplorerIdentity | null>(null);
  const [currentAgentId, setCurrentAgentId] = useState("");
  const [error, setError] = useState("");
  const [lastAgentRequest, setLastAgentRequest] = useState("尚未发起请求");
  const [busyAction, setBusyAction] = useState("");
  const [publicWorld, setPublicWorld] = useState<AgentPublicWorld | null>(null);
  const [worldOverview, setWorldOverview] = useState<EpochWorldOverviewInfo | null>(null);
  const [progress, setProgress] = useState<EpochProgressView | null>(null);
  const [agentBriefing, setAgentBriefing] = useState<EpochAgentBriefingView | null>(null);
  const [agentBriefingSyncedAt, setAgentBriefingSyncedAt] = useState("");
  const [agentMemory, setAgentMemory] = useState<EpochAgentMemoryInfo | null>(null);
  const [lastExplorationMetrics, setLastExplorationMetrics] = useState<EpochExplorationMetrics | null>(null);
  const [personalMigrationSummary, setPersonalMigrationSummary] = useState<EpochPersonalMigrationSummary | null>(null);
  const [explorerProfile, setExplorerProfile] = useState<EpochExplorerProfileInfo | null>(null);
  const [competitiveLadderMode, setCompetitiveLadderMode] = useState<EpochCompetitiveLadderMode>("ranked");
  const [competitiveLadder, setCompetitiveLadder] = useState<EpochCompetitiveLadderView | null>(null);
  const [abuseStatus, setAbuseStatus] = useState<EpochAbuseStatus | null>(null);
  const [region, setRegion] = useState<EpochRegionInfo | null>(null);
  const [regionMessages, setRegionMessages] = useState<readonly EpochMessageRecord[]>([]);
  const [moderationQueue, setModerationQueue] = useState<EpochModerationInfo | null>(null);
  const [riskAudit, setRiskAudit] = useState<EpochAuditInfo | null>(null);
  const [partyInviteAudit, setPartyInviteAudit] = useState<EpochAuditInfo | null>(null);
  const [abuseProfiles, setAbuseProfiles] = useState<EpochAbuseProfilesInfo | null>(null);
  const [operatorOverview, setOperatorOverview] = useState<EpochOperatorOverview | null>(null);
  const [maintenanceRun, setMaintenanceRun] = useState<EpochMaintenanceRunSummary | null>(null);
  const [objectives, setObjectives] = useState<readonly EpochContestedObjective[]>([]);
  const [resourceNodes, setResourceNodes] = useState<readonly EpochResourceNode[]>([]);
  const [anomalies, setAnomalies] = useState<readonly EpochAnomalyEvent[]>([]);
  const [seasons, setSeasons] = useState<readonly EpochSeasonCampaign[]>([]);
  const [marketOrders, setMarketOrders] = useState<readonly EpochMarketOrder[]>([]);
  const [marketRiskRestrictions, setMarketRiskRestrictions] = useState<readonly EpochMarketRiskRestriction[]>([]);
  const [directTrades, setDirectTrades] = useState<readonly EpochDirectTrade[]>([]);
  const [bounties, setBounties] = useState<readonly EpochBounty[]>([]);
  const [partyRuns, setPartyRuns] = useState<readonly EpochPartyRun[]>([]);
  const [raids, setRaids] = useState<readonly EpochRaidResult[]>([]);
  const [relationships, setRelationships] = useState<readonly EpochRelationshipEdge[]>([]);
  const [diplomacy, setDiplomacy] = useState<readonly EpochDiplomacyRecord[]>([]);
  const [hostedSessions, setHostedSessions] = useState<readonly EpochHostedSession[]>([]);
  const [serverHostedJobs, setServerHostedJobs] = useState<readonly EpochServerHostedJob[]>([]);
  const [lastServerHostedRun, setLastServerHostedRun] = useState<EpochServerHostedActionRun | null>(null);
  const [webBridgeTurn, setWebBridgeTurn] = useState<EpochWebBridgeTurn | null>(null);
  const [lastWebBridgeAction, setLastWebBridgeAction] = useState<EpochWebBridgeActionResult | null>(null);
  const [currentTurnCard, setCurrentTurnCard] = useState<EpochTurnCard | null>(null);
  const [resultPage, setResultPage] = useState<EpochResultPage | null>(null);
  const [resultSettlementScreen, setResultSettlementScreen] = useState<ResultSettlementScreenKey>("ending");
  const [sharedResultPage, setSharedResultPage] = useState<EpochSharedResultPage | null>(null);
  const [installManifest, setInstallManifest] = useState<EpochInstallManifest | null>(null);
  const [installStatus, setInstallStatus] = useState<EpochInstallStatus | null>(null);
  const [installStatusError, setInstallStatusError] = useState("");
  const [highValueConfirmation, setHighValueConfirmation] = useState<EpochHighValueConfirmation | null>(null);
  const [highValueConfirmations, setHighValueConfirmations] = useState<readonly EpochHighValueConfirmation[]>([]);
  const [confirmationToken, setConfirmationToken] = useState("");
  const [showRecoveryCode, setShowRecoveryCode] = useState(false);
  const [recoveryCodeRevealUsed, setRecoveryCodeRevealUsed] = useState(false);
  const [archivePassphrase, setArchivePassphrase] = useState("");
  const [archiveImportText, setArchiveImportText] = useState("");
  const [archiveStatus, setArchiveStatus] = useState("");
  const [archiveExportArmed, setArchiveExportArmed] = useState(false);
  const [hasExplorerBackup, setHasExplorerBackup] = useState(false);
  const [lowStimulusMode, setLowStimulusMode] = useState(false);
  const [highStimulusComplianceConfirmed, setHighStimulusComplianceConfirmed] = useState(false);
  const [contentPolicyRegion, setContentPolicyRegion] = useState<(typeof HIGH_STIMULUS_COMPLIANCE_REGIONS)[number]["value"]>("US");
  const [demoModeReport, setDemoModeReport] = useState<DemoModeReport | null>(null);
  const [downtimeMode, setDowntimeMode] = useState<EpochDowntimeMode>("meditation");
  const [starterRiskPreference, setStarterRiskPreference] = useState<StarterRiskPreference>("balanced");
  const [craftRecipeId, setCraftRecipeId] = useState("field-kit");
  const [shopOfferId, setShopOfferId] = useState("gray-ration-pack");
  const [shopOffers, setShopOffers] = useState<readonly EpochShopOffer[]>([]);
  const [regionId, setRegionId] = useState("region_gray_harbor");
  const [npcName, setNpcName] = useState("Gray Harbor Clerk");
  const [messageBody, setMessageBody] = useState("灰港边缘巡查完成，未见高阶异常。");
  const [newsSourceEventId, setNewsSourceEventId] = useState("");
  const [operatorKey, setOperatorKey] = useState("");
  const [moderationNote, setModerationNote] = useState("");
  const [riskReviewNote, setRiskReviewNote] = useState("");
  const [loreAdjudicationTargetId, setLoreAdjudicationTargetId] = useState("");
  const [loreAdjudicationStatus, setLoreAdjudicationStatus] = useState<EpochLoreTargetStatus>("confirmed");
  const [loreAdjudicationSummary, setLoreAdjudicationSummary] = useState("");
  const [loreAdjudicationSourceIds, setLoreAdjudicationSourceIds] = useState("");
  const [loreCanonCandidateRequested, setLoreCanonCandidateRequested] = useState(false);
  const [loreCanonChapterReviewId, setLoreCanonChapterReviewId] = useState("");
  const [loreCanonCuratorApprovedBy, setLoreCanonCuratorApprovedBy] = useState("");
  const [loreCanonMigrationSummary, setLoreCanonMigrationSummary] = useState("");
  const [loreCanonAdoptedText, setLoreCanonAdoptedText] = useState("");
  const [loreCanonBoundaryNote, setLoreCanonBoundaryNote] = useState("");
  const [objectiveAmount, setObjectiveAmount] = useState(1);
  const [objectiveTemplateKey, setObjectiveTemplateKey] = useState<"supply_drive" | "archive_focus" | "trace_race">("supply_drive");
  const [resourceNodeStamina, setResourceNodeStamina] = useState(1);
  const [anomalyFocus, setAnomalyFocus] = useState(1);
  const [seasonTemplateKey, setSeasonTemplateKey] = useState<(typeof SEASON_TEMPLATE_OPTIONS)[number]["value"]>("gray_harbor_faction_season");
  const [seasonFactionId, setSeasonFactionId] = useState("gray_watch");
  const [seasonAmount, setSeasonAmount] = useState(1);
  const [lastSeasonContribution, setLastSeasonContribution] = useState<SeasonContributionResult | null>(null);
  const [seasonContributionHistory, setSeasonContributionHistory] = useState<readonly SeasonContributionResult[]>([]);
  const [marketSellMode, setMarketSellMode] = useState<"resource" | "item">("resource");
  const [sellResourceId, setSellResourceId] = useState<EpochResourceId>("coin");
  const [sellItemId, setSellItemId] = useState("");
  const [priceResourceId, setPriceResourceId] = useState<EpochResourceId>("aether");
  const [sellAmount, setSellAmount] = useState(1);
  const [priceAmount, setPriceAmount] = useState(1);
  const [directTradeCounterpartyAgentId, setDirectTradeCounterpartyAgentId] = useState("");
  const [directTradeOfferMode, setDirectTradeOfferMode] = useState<"resource" | "item">("resource");
  const [directTradeOfferResourceId, setDirectTradeOfferResourceId] = useState<EpochResourceId>("aether");
  const [directTradeOfferAmount, setDirectTradeOfferAmount] = useState(1);
  const [directTradeOfferItemId, setDirectTradeOfferItemId] = useState("");
  const [directTradeRequestMode, setDirectTradeRequestMode] = useState<"resource" | "item">("resource");
  const [directTradeRequestResourceId, setDirectTradeRequestResourceId] = useState<EpochResourceId>("coin");
  const [directTradeRequestAmount, setDirectTradeRequestAmount] = useState(1);
  const [directTradeRequestItemId, setDirectTradeRequestItemId] = useState("");
  const [directTradeCounterpartyItems, setDirectTradeCounterpartyItems] = useState<readonly EpochInventoryItem[]>([]);
  const [directTradeCounterpartyItemStatus, setDirectTradeCounterpartyItemStatus] = useState("");
  const [directTradeStatusFilter, setDirectTradeStatusFilter] = useState<"open" | "accepted" | "cancelled" | "expired">("open");
  const [directTradeDirectionFilter, setDirectTradeDirectionFilter] = useState<"all" | "incoming" | "outgoing">("all");
  const [directTradeOfferItemSearch, setDirectTradeOfferItemSearch] = useState("");
  const [directTradeRequestItemSearch, setDirectTradeRequestItemSearch] = useState("");
  const [directTradeListSearch, setDirectTradeListSearch] = useState("");
  const [directTradeAuditTradeId, setDirectTradeAuditTradeId] = useState("");
  const [directTradeAuditEvents, setDirectTradeAuditEvents] = useState<readonly EpochAuditEventSummary[]>([]);
  const [bountyTitle, setBountyTitle] = useState("追查灰港偷渡痕迹");
  const [bountyRewardAmount, setBountyRewardAmount] = useState(1);
  const [bountyRequiredItemKey, setBountyRequiredItemKey] = useState("shop:gray-ration-pack");
  const [bountyFulfillmentItemId, setBountyFulfillmentItemId] = useState("");
  const [bountyEvidence, setBountyEvidence] = useState("提交服务器可审计的区域线索。");
  const [partyTitle, setPartyTitle] = useState("灰港夜巡小队");
  const [partyObjective, setPartyObjective] = useState("同步巡查潮汐门与灯市暗巷。");
  const [participantRole, setParticipantRole] = useState("scout");
  const [partyJoinRequestNote, setPartyJoinRequestNote] = useState("申请跟随本轮区域行动。");
  const [partyInviteToken, setPartyInviteToken] = useState("gray-harbor-invite");
  const [partyInviteRecipientAgentId, setPartyInviteRecipientAgentId] = useState("");
  const [partyInviteTokenUseLimit, setPartyInviteTokenUseLimit] = useState(1);
  const [organizationCreateName, setOrganizationCreateName] = useState("灰港守夜会");
  const [organizationSearch, setOrganizationSearch] = useState("");
  const [organizationMembershipRole, setOrganizationMembershipRole] = useState("scout");
  const [organizationUpgradeKey, setOrganizationUpgradeKey] = useState<(typeof ORGANIZATION_UPGRADE_OPTIONS)[number]["value"]>("training_hall");
  const [organizationContributionResourceId, setOrganizationContributionResourceId] = useState<EpochResourceId>("coin");
  const [organizationContributionAmount, setOrganizationContributionAmount] = useState(1);
  const [organizationBudgetTitle, setOrganizationBudgetTitle] = useState("修补灰港灯塔");
  const [organizationBudgetDescription, setOrganizationBudgetDescription] = useState("给区域公共工程申请组织金库预算。");
  const [organizationBudgetResourceId, setOrganizationBudgetResourceId] = useState<EpochResourceId>("coin");
  const [organizationBudgetAmount, setOrganizationBudgetAmount] = useState(1);
  const [defenderAgentId, setDefenderAgentId] = useState("");
  const [raidStamina, setRaidStamina] = useState(1);
  const [revoltStamina, setRevoltStamina] = useState(3);
  const [retaliationStamina, setRetaliationStamina] = useState(1);
  const [relationshipTargetAgentId, setRelationshipTargetAgentId] = useState("");
  const [relationshipKind, setRelationshipKind] = useState<EpochRelationshipKind>("alliance");
  const [relationshipFocus, setRelationshipFocus] = useState(1);
  const [diplomacyTerms, setDiplomacyTerms] = useState("share_gray_harbor_patrols");
  const [diplomacyResponseFocus, setDiplomacyResponseFocus] = useState(1);
  const [hostedMandate, setHostedMandate] = useState("档案馆推荐委托：灰港边缘巡查。风险偏好：均衡，优先完成可审档线索。");
  const [hostedVisibleText, setHostedVisibleText] = useState("按服务器选项行动，记录可见过程。");
  const [interventionInstruction, setInterventionInstruction] = useState("优先保留可审计线索，避免扩大风险。");
  const [interventionMode, setInterventionMode] = useState<InterventionMode>("running");
  const [interventionTakeoversUsed, setInterventionTakeoversUsed] = useState(0);
  const [riskStrategy, setRiskStrategy] = useState<RiskStrategy>("均衡");
  const [highRiskPackages, setHighRiskPackages] = useState<readonly HighRiskPackage[]>([]);
  const [serverHostedOptionKey, setServerHostedOptionKey] = useState<ServerHostedOptionKey>("observe");
  const [turnPrompt, setTurnPrompt] = useState("巡查当前区域");
  const [turnVisibleText, setTurnVisibleText] = useState("按服务器回合卡选项行动，记录可见过程。");
  const [attestedRunnerId, setAttestedRunnerId] = useState("runner_remote_1");
  const [attestedTranscriptHash, setAttestedTranscriptHash] = useState("sha256:paste_transcript_hash");
  const [attestedSignature, setAttestedSignature] = useState("");
  const [attestationChallenge, setAttestationChallenge] = useState<EpochAttestationChallenge | null>(null);

  currentAgentIdRef.current = currentAgentId;
  regionIdRef.current = regionId;

  useEffect(() => {
    const nextExplorer = loadExplorerIdentity();
    const pendingRecoveryRotation = loadPendingExplorerRecoveryRotation();
    setExplorer(nextExplorer);
    setHasExplorerBackup(nextExplorer ? loadExplorerBackupStatus(nextExplorer.explorerId) : false);
    const storedLowStimulusMode = localStorage.getItem(LOW_STIMULUS_PREFERENCE_KEY) === "true";
    setLowStimulusMode(nextExplorer?.preferences?.lowStimulusMode ?? storedLowStimulusMode);
    if (nextExplorer) {
      localStorage.removeItem(PENDING_REGISTRATION_KEY);
      setCurrentAgentId(localStorage.getItem(CURRENT_AGENT_KEY) || "");
      if (pendingRecoveryRotation?.next.recoveryCode === nextExplorer.recoveryCode) {
        clearPendingExplorerRecoveryRotation();
      } else if (
        pendingRecoveryRotation?.previous.recoveryCode === nextExplorer.recoveryCode
        && recoveryRotationResumeRef.current !== pendingRecoveryRotation.idempotencyKey
      ) {
        recoveryRotationResumeRef.current = pendingRecoveryRotation.idempotencyKey;
        void resumePendingRecoveryRotation(pendingRecoveryRotation).finally(() => {
          if (recoveryRotationResumeRef.current === pendingRecoveryRotation.idempotencyKey) {
            recoveryRotationResumeRef.current = "";
          }
        });
      }
    } else {
      localStorage.removeItem(CURRENT_AGENT_KEY);
      setCurrentAgentId("");
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    void getEpochInstallStatus()
      .then((status) => {
        if (mounted) {
          setInstallStatus(status);
          setInstallStatusError("");
        }
      })
      .catch((err: unknown) => {
        if (mounted) setInstallStatusError(errorMessage(err));
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    void getEpochWorldOverview({ limit: 4 })
      .then((overview) => {
        if (mounted) setWorldOverview(overview);
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!currentAgentId) return;
    void refreshProgress(currentAgentId).catch((err: unknown) => {
      setError(errorMessage(err));
    });
  }, [currentAgentId, regionId]);

  useEffect(() => {
    if (!currentAgentId || busyAction) return;
    const timer = window.setInterval(() => {
      void refreshProgress(currentAgentId, { quiet: true }).catch(() => undefined);
    }, AGENT_BRIEFING_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [currentAgentId, regionId, busyAction]);

  useEffect(() => {
    if (!explorer) return;
    let mounted = true;
    void getEpochExplorerProfile(explorer.explorerId)
      .then((profile) => {
        if (mounted) setExplorerProfile(profile);
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, [explorer]);

  useEffect(() => {
    let mounted = true;
    void getEpochShop(regionId)
      .then((shop) => {
        if (mounted) setShopState(shop);
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, [regionId]);

  const recoveryCode = useMemo(() => (explorer ? exportRecoveryCode(explorer) : ""), [explorer]);
  const isBusy = Boolean(busyAction);
  const selectedStarterRiskPreference = STARTER_RISK_PREFERENCE_OPTIONS.find((risk) => risk.value === starterRiskPreference)
    || STARTER_RISK_PREFERENCE_OPTIONS[1];
  const identity = progress?.identity;
  const actionEligibility = progress?.actionEligibility;
  const isIdentityActive = identity?.status === "active";
  const canUseActiveIdentity = Boolean(currentAgentId && (actionEligibility?.canUseActiveTools ?? isIdentityActive));
  const activeIdentityDisabled = !canUseActiveIdentity;
  const showBackupRisk = Boolean(explorer && currentAgentId && !hasExplorerBackup);
  const lifetimePercent = identity ? Math.max(0, Math.min(100, Math.round((identity.lifetime.remaining / identity.lifetime.max) * 100))) : 0;
  const primaryObjective = objectives[0] || region?.objectives[0] || null;
  const primaryResourceNode = resourceNodes[0] || region?.resourceNodes[0] || null;
  const primaryAnomaly = anomalies[0] || region?.anomalies[0] || null;
  const primarySeason = seasons[0] || region?.seasons[0] || null;
  const seasonContributionEventIds = new Set(primarySeason?.contributions.map((contribution) => contribution.eventId) || []);
  const seasonContributionReceipts = primarySeason
    ? [
      ...primarySeason.contributions,
      ...seasonContributionHistory.filter((item) =>
        item.seasonId === primarySeason.seasonId && !seasonContributionEventIds.has(item.eventId)),
    ].sort((left, right) => right.recordedAt.localeCompare(left.recordedAt) || right.eventId.localeCompare(left.eventId))
    : [];
  const primaryMarketOrder = marketOrders[0] || null;
  const currentMarketRestriction = marketRiskRestrictions.find((restriction) => restriction.agentId === currentAgentId) || null;
  const tradableInventoryItems = (progress?.inventoryItems || []).filter((item) =>
    item.agentId === currentAgentId && !item.bound && !item.marketLockedByOrderId);
  const filteredDirectTradeOfferItems = tradableInventoryItems.filter((item) =>
    inventoryItemMatchesSearch(item, directTradeOfferItemSearch));
  const filteredDirectTradeCounterpartyItems = directTradeCounterpartyItems.filter((item) =>
    inventoryItemMatchesSearch(item, directTradeRequestItemSearch));
  const visibleDirectTrades = directTrades.filter((trade) => {
    const directionMatches = directTradeDirectionFilter === "incoming"
      ? trade.counterpartyAgentId === currentAgentId
      : directTradeDirectionFilter === "outgoing"
        ? trade.proposerAgentId === currentAgentId
        : true;
    return directionMatches && directTradeMatchesSearch(trade, directTradeListSearch);
  });
  const primaryDirectTrade = visibleDirectTrades[0] || directTrades[0] || null;
  const actionableDirectTrades = visibleDirectTrades.filter((trade) =>
    trade.status === "open" && (trade.counterpartyAgentId === currentAgentId || trade.proposerAgentId === currentAgentId));
  const incomingDirectTradeCount = directTrades.filter((trade) => trade.counterpartyAgentId === currentAgentId).length;
  const outgoingDirectTradeCount = directTrades.filter((trade) => trade.proposerAgentId === currentAgentId).length;
  const visibleOrganizations = region?.organizations.filter((organization) =>
    organizationMatchesSearch(organization, organizationSearch)) || [];
  const selectedShopOffer = shopOffers.find((offer) => offer.offerId === shopOfferId) || null;
  const primaryBounty = bounties[0] || null;
  const primaryPartyRun = partyRuns[0] || region?.partyRuns[0] || null;
  const pendingPartyJoinRequestCount = partyRuns.reduce(
    (count, partyRun) => count + (partyRun.joinRequests || []).filter((request) => request.status === "pending").length,
    0,
  );
  const primaryRaid = raids[0] || null;
  const primaryRetaliation = region?.retaliations.find((retaliation) =>
    retaliation.status === "open" && retaliation.opportunityAgentId === currentAgentId)
    || region?.retaliations.find((retaliation) => retaliation.status === "open")
    || null;
  const primaryRelationship = relationships[0] || null;
  const primaryDiplomacy = diplomacy.find((item) => item.status === "pending" && item.targetAgentId === currentAgentId)
    || diplomacy.find((item) => item.status === "pending")
    || diplomacy[0]
    || null;
  const agentNarrativeProfile = identity ? agentNarrativeHomepage({
    identity,
    progress,
    primaryRelationship,
    regionId,
  }) : null;
  const activeHostedSession = hostedSessions.find((session) => session.status === "active") || null;
  const primaryHostedSession = activeHostedSession || hostedSessions[0] || null;
  const currentAgentSeasonStanding = primarySeason?.agentStandings.find((standing) => standing.agentId === currentAgentId);
  const currentAgentOrganizationStanding = Math.max(
    0,
    ...visibleOrganizations
      .filter((organization) => organization.memberAgentIds.includes(currentAgentId))
      .map((organization) => organization.standing),
  );
  const interventionBudget = BASE_INTERVENTION_BUDGET + reputationInterventionBonus({
    legend: progress?.resources.legend || 0,
    seasonScore: currentAgentSeasonStanding?.trustedScore || currentAgentSeasonStanding?.score || 0,
    organizationStanding: currentAgentOrganizationStanding,
  });
  const interventionRemaining = Math.max(0, interventionBudget - interventionTakeoversUsed);
  const autonomyEvaluation = interventionTakeoversUsed === 0
    ? "自主评价：完整"
    : interventionRemaining > 0
      ? "自主评价：轻微下降"
      : "自主评价：下降，继续接管会降低 agent 自主评价";
  const hasHighRiskAuthorization = Boolean(
    (currentTurnCard?.status === "open" && currentTurnCard.actionOptions.some((option) => option.risk === "high"))
    || (primaryHostedSession?.status === "active" && primaryHostedSession.actionOptions.some((option) => option.risk === "high")),
  );
  const primaryBriefingAction = agentBriefing?.pendingActions[0];
  const revisitPrimaryAction: RevisitPrimaryAction = (() => {
    if (progress?.pendingDowntime) {
      return {
        kind: "领取",
        label: "领取托管收益",
        disabled: isBusy || activeIdentityDisabled || !progress?.downtime?.active,
      };
    }
    if (identity?.status === "archived") {
      return {
        kind: "找回",
        label: identity.nextAgentId ? "已找回" : "找回身份",
        disabled: isBusy || Boolean(identity.nextAgentId) || !explorer,
      };
    }
    if (currentAgentId && !actionEligibility?.canUseActiveTools) {
      return {
        kind: "修正",
        label: "修正状态",
        disabled: isBusy || !explorer,
      };
    }
    if (primaryBriefingAction || (resultPage?.nextActions || []).length || primaryHostedSession?.status === "active") {
      return {
        kind: "接续",
        label: "接续下一步",
        disabled: isBusy || activeIdentityDisabled || !currentAgentId,
      };
    }
    return {
      kind: "审档",
      label: "审档预览",
      disabled: isBusy || !currentAgentId,
    };
  })();
  const activeSettlementScreen = RESULT_SETTLEMENT_SCREENS.find((screen) => screen.key === resultSettlementScreen)
    || DEFAULT_RESULT_SETTLEMENT_SCREEN;
  const resultSettlementSummary = resultPage
    ? (() => {
      switch (activeSettlementScreen.key) {
        case "ending":
          return resultPage.focusTurnCard?.resolution?.outcomeSummary
            || resultPage.focusHostedSession?.actions.at(-1)?.outcomeSummary
            || "本次结果已生成，可继续审档或公开。";
        case "score":
          return `历程 ${(resultPage.progress.latestEvents || []).length} 条 · 服务器已结算 · 收获项 ${resourceEntries(resultPage.progress.resources || {}).filter((item) => item.amount > 0).length}`;
        case "drop":
          return resourceEntries(resultPage.progress.resources || {}).filter((item) => item.amount > 0).map((item) => `${item.label}${item.amount}`).join(" / ")
            || "暂无可领取资源，继续托管或接续行动。";
        case "next": {
          const nextAction = (resultPage.nextActions || [])[0];
          return nextAction
            ? `${nextAction.label} · ${playerToolLabel(nextAction.toolName)}`
            : "暂无服务器建议行动，可刷新进度或接续托管。";
        }
      }
    })()
    : "生成预览后显示结算。";
  const resultImpactItems = resultPage ? resultImpactMapItems(resultPage) : [];
  const shareCardStatus = resultPage
    ? shareCardStatusForResult(resultPage)
    : sharedResultPage?.payload ? shareCardStatusForResult(sharedResultPage.payload) : null;
  const displayedRegionMessages = region?.messages?.length ? region.messages : regionMessages;
  const openModerationItems = moderationQueue?.open || [];
  const riskAuditEvents = riskAudit?.events || [];
  const partyInviteAuditPartyRunIds = new Set(partyRuns.map((partyRun) => partyRun.partyRunId));
  const partyInviteAuditEvents = (partyInviteAudit?.events || []).filter((event) => {
    const partyRunId = typeof event.payload.partyRunId === "string" ? event.payload.partyRunId : "";
    return !partyInviteAuditPartyRunIds.size || !partyRunId || partyInviteAuditPartyRunIds.has(partyRunId);
  });
  const identityPersonalityDrifts = (progress?.personalityDrifts || []).filter((drift) => drift.agentId === currentAgentId);
  const activePersonalityTraits = identity?.personality?.traits || [];
  const activePersonalitySourceEventId = identity?.personality?.latestSourceEventId;
  const attributeEntries = Object.entries(progress?.attributes || {});
  const skillEntries = progress?.skills || [];
  const agentMemoryTotals = memoryTotals(agentMemory);
  const worldOverviewPage = worldOverview
    ? worldOverview.publicPages.world
    : installManifest?.publicPages.world || "/epoch/world";
  const installReadiness = createAgentInstallReadiness({
    installStatus,
    installStatusError,
    hasInstallManifest: Boolean(installManifest),
    hasWorldOverview: Boolean(worldOverview),
    declaredToolCount: AGENT_WORLD_TOOLS.length + EPOCH_TOOLS.length,
    mcpCommand: MCP_COMMAND,
    operatorKey,
    currentAgentId,
    idempotencyScope: INSTALL_CHECK_IDEMPOTENCY_SCOPE,
    busyAction,
    lastAgentRequest,
    error,
    actionLabel: playerActionLabel,
  });
  const frontstageStatus = installStatus?.frontstageStatus;
  const playerActionReadiness = createAgentPlayerActionReadiness({
    isBusy,
    busyReason: PLAYER_PRIMARY_ACTION_BUSY_REASON,
    currentAgentId,
    hasExplorer: Boolean(explorer),
    identitySlotsAvailable: progress?.identitySlots?.available,
    canUseActiveIdentity,
    actionEligibilityReason: actionEligibility?.reason,
  });
  const playerIdentityActionDisabledReason = playerActionReadiness.identity;
  const playerDowntimeActionDisabledReason = playerActionReadiness.downtime;
  const playerCompleteRunActionDisabledReason = playerActionReadiness.completeRun;
  const playerResultActionDisabledReason = playerActionReadiness.result;
  const playerInstallStatusActionDisabledReason = playerActionReadiness.installStatus;
  const queuedServerHostedJobCount = serverHostedJobs.filter((job) => job.status === "queued").length;
  const liveIdentityValue = identity?.identityName
    ? `${identity.identityName} · ${currentAgentId}`
    : currentAgentId || "等待签发";
  const liveActivityValue = busyAction
    ? `${playerActionLabel(busyAction)} · 运行中`
    : activeHostedSession
      ? `${playerHostedStatusLabel(activeHostedSession.status)} · ${activeHostedSession.mandate}`
      : progress?.downtime?.active
        ? `托管中 · ${playerDowntimeLabel(progress.downtime.mode)}`
        : queuedServerHostedJobCount
          ? `排队中 · ${queuedServerHostedJobCount} 条行动`
          : "待选择";

  async function runAction(label: string, action: () => Promise<void>) {
    await runAgentAction(label, action, {
      getBusyAction: () => busyAction,
      setBusyAction,
      setError,
      setLastAgentRequest,
      actionLabel: playerActionLabel,
      errorMessage,
    });
  }

  function setMarketState(market: Awaited<ReturnType<typeof getEpochMarket>>) {
    setMarketOrders(market.orders);
    setMarketRiskRestrictions(market.riskRestrictions);
  }

  function setShopState(shop: Awaited<ReturnType<typeof getEpochShop>>) {
    setShopOffers(shop.offers);
    setShopOfferId((current) =>
      shop.offers.some((offer) => offer.offerId === current)
        ? current
        : shop.offers[0]?.offerId || "gray-ration-pack");
  }

  function commitRegionSnapshot(nextRegion: EpochRegionInfo, options: AgentRegionSnapshotOptions = {}) {
    applyAgentRegionSnapshot(createAgentRegionSnapshot(nextRegion, options), {
      setRegion,
      setRegionMessages,
      setObjectives,
      setResourceNodes,
      setAnomalies,
      setSeasons,
      setDiplomacy,
    });
  }

  async function refreshProgress(agentId = currentAgentId, options: { quiet?: boolean } = {}) {
    await refreshAgentProgress({
      agentId,
      regionId,
      explorerId: explorer?.explorerId,
      quiet: options.quiet,
      nextRequestSeq: () => ++briefingRequestSeq.current,
      currentRequestSeq: () => briefingRequestSeq.current,
      getLatestSnapshot: () => ({
        currentAgentId: currentAgentIdRef.current,
        regionId: regionIdRef.current,
      }),
      clearBriefingSyncedAt: () => setAgentBriefingSyncedAt(""),
      commit: ({ briefing, memory, personalMigrationSummary, abuseStatus }) => {
        const normalizedBriefing = {
          ...briefing,
          progress: normalizeProgressView(briefing.progress),
          pendingActions: briefing.pendingActions || [],
        };
        setAgentBriefing(normalizedBriefing);
        setAgentBriefingSyncedAt(briefing.generatedAt);
        setProgress(normalizedBriefing.progress);
        setAgentMemory(memory);
        setPersonalMigrationSummary(personalMigrationSummary);
        setAbuseStatus(abuseStatus);
      },
      api: defaultAgentProgressRefreshApi,
    });
  }

  async function confirmPersonalityDrift(driftId: string) {
    if (!explorer || !driftId) return;
    await runAction("confirm-personality-drift", async () => {
      await confirmEpochPersonalityDrift({
        driftId,
        recoveryCode: explorer.recoveryCode,
        idempotencyKey: idempotencyKey("web_confirm_personality_drift"),
      });
      await refreshProgress();
    });
  }

  async function loadAbuseStatus() {
    const agentId = currentAgentId || progress?.agentId;
    const explorerId = !agentId ? explorer?.explorerId : undefined;
    if (!agentId && !explorerId) return;
    await runAction("abuse-status", async () => {
      setAbuseStatus(await getEpochAbuseStatus({ agentId, explorerId }));
    });
  }

  async function loadExplorerProfile() {
    if (!explorer) return;
    await runAction("explorer-profile", async () => {
      setExplorerProfile(await getEpochExplorerProfile(explorer.explorerId));
    });
  }

  async function downloadPlayerDataExport() {
    if (!explorer) return;
    await runAction("player-data-export", async () => {
      const exported = await createEpochPlayerDataExport({
        explorerId: explorer.explorerId,
        recoveryCode: explorer.recoveryCode,
        limit: 100,
      });
      downloadJson(`obsidian-epoch-player-data-${explorer.explorerId}.json`, exported);
    });
  }

  function clearAgentScopedState() {
    setHostedSessions([]);
    setServerHostedJobs([]);
    setLastServerHostedRun(null);
    setWebBridgeTurn(null);
    setLastWebBridgeAction(null);
    setCurrentTurnCard(null);
    setResultPage(null);
    setLastExplorationMetrics(null);
    setSharedResultPage(null);
    setAgentBriefing(null);
    setAgentBriefingSyncedAt("");
    setAgentMemory(null);
    setPersonalMigrationSummary(null);
    setHighValueConfirmation(null);
    setConfirmationToken("");
    setAttestationChallenge(null);
    setAttestedSignature("");
  }

  function updateLowStimulusMode(enabled: boolean) {
    setLowStimulusMode(enabled);
    localStorage.setItem(LOW_STIMULUS_PREFERENCE_KEY, enabled ? "true" : "false");
    if (explorer) {
      const nextExplorer: ExplorerIdentity = {
        ...explorer,
        preferences: {
          ...explorer.preferences,
          lowStimulusMode: enabled,
        },
      };
      saveExplorerIdentity(nextExplorer);
      setExplorer(nextExplorer);
    }
  }

  function runRevisitPrimaryAction() {
    switch (revisitPrimaryAction.kind) {
      case "领取":
        void claimDowntime();
        return;
      case "找回":
        void reincarnateCurrentIdentity();
        return;
      case "修正":
        if (explorer) {
          void loadExplorerProfile();
        } else {
          void refreshProgress();
        }
        return;
      case "接续":
        void refreshProgress();
        return;
      case "审档":
        void loadResultPage();
        return;
    }
  }

  function runSettlementPrimaryAction() {
    switch (resultSettlementScreen) {
      case "ending":
        void loadResultPage();
        return;
      case "score":
        void loadResultPage();
        return;
      case "drop":
        if (progress?.pendingDowntime) {
          void claimDowntime();
        } else {
          void refreshProgress();
        }
        return;
      case "next":
        runRevisitPrimaryAction();
        return;
    }
  }

  function runLocalDemoMode() {
    setDemoModeReport({
      title: "本地演示样例",
      mandate: DEMO_CONTRACT.mandate,
      anchors: DEMO_CONTRACT.anchors.map((anchor) => anchor.label),
      discoveries: [...DEMO_CONTRACT.allowedClaimTypes],
      isolation: {
        uploadable: false,
        settleable: false,
        reputationEligible: false,
        graphEligible: false,
      },
    });
    setLastAgentRequest("本地演示模式：未上传、未结算、未获得声望、未进入图谱");
  }

  function pauseExploration() {
    setInterventionMode("paused");
    setLastAgentRequest("本地介入：已暂停，不提交下一步行动。");
  }

  function resetInterventionBudgetForNewRun() {
    setInterventionMode("running");
    setInterventionTakeoversUsed(0);
    setHighRiskPackages([]);
  }

  function isRiskPackageAuthorized(kind: HighRiskPackageKind) {
    return highRiskPackages.some((item) => item.kind === kind && item.status === "authorized");
  }

  function stageHighRiskPackage(input: { readonly kind: HighRiskPackageKind; readonly label: string }) {
    const existingPackage = highRiskPackages.find((item) => item.kind === input.kind);
    const accepted = Boolean(existingPackage) || highRiskPackages.length < HIGH_RISK_REQUEST_LIMIT;
    setHighRiskPackages((packages) => {
      const existing = packages.find((item) => item.kind === input.kind);
      if (existing) {
        return packages.map((item) => item.kind === input.kind
          ? { ...item, label: input.label, requestCount: item.requestCount + 1 }
          : item);
      }
      if (packages.length >= HIGH_RISK_REQUEST_LIMIT) return packages;
      return [...packages, {
        kind: input.kind,
        label: input.label,
        requestCount: 1,
        status: "pending",
        strategy: riskStrategy,
      }];
    });
    setLastAgentRequest(accepted
      ? `高危请求已合并为风险包：${input.label}`
      : "高危请求已达到本局上限，请处理现有风险包。");
    return accepted;
  }

  function authorizeHighRiskPackage(kind: HighRiskPackageKind) {
    setHighRiskPackages((packages) => packages.map((item) => item.kind === kind
      ? { ...item, status: "authorized", strategy: riskStrategy }
      : item));
    setLastAgentRequest("高危风险包已授权，可再次提交同类高危请求。");
  }

  function rejectHighRiskPackage(kind: HighRiskPackageKind) {
    setHighRiskPackages((packages) => packages.map((item) => item.kind === kind
      ? { ...item, status: "rejected", strategy: riskStrategy }
      : item));
    setLastAgentRequest("高危风险包已拒绝，本局不提交该类高危请求。");
  }

  function changeRiskStrategy() {
    const nextIndex = (RISK_STRATEGIES.indexOf(riskStrategy) + 1) % RISK_STRATEGIES.length;
    const nextStrategy: RiskStrategy = RISK_STRATEGIES[nextIndex] || "谨慎";
    setRiskStrategy(nextStrategy);
    setHighRiskPackages((packages) => packages.map((item) => ({ ...item, strategy: nextStrategy, status: "pending" })));
    setLastAgentRequest(`风险策略已改为：${nextStrategy}`);
  }

  function appendInterventionInstruction() {
    const instruction = interventionInstruction.trim();
    if (!instruction) return;
    setHostedVisibleText((value) => `${value}\n追加指令：${instruction}`.trim());
    setTurnVisibleText((value) => `${value}\n追加指令：${instruction}`.trim());
    setInterventionMode("instruction_appended");
    setLastAgentRequest("本地介入：已追加指令，等待下一次行动提交。");
  }

  function takeOverCurrentTurn() {
    if (interventionRemaining <= 0) return;
    const instruction = interventionInstruction.trim() || "用户接管本轮";
    setHostedVisibleText(`用户接管本轮：${instruction}`);
    setTurnVisibleText(`用户接管本轮：${instruction}`);
    setInterventionMode("takeover");
    setInterventionTakeoversUsed((count) => count + 1);
    setLastAgentRequest("本地介入：用户接管本轮，下一次提交将使用接管文本。");
  }

  async function issueIdentity() {
    await runAction("issue", async () => {
      if (!explorer) {
        const pendingIdempotencyKey = localStorage.getItem(PENDING_REGISTRATION_KEY)
          || idempotencyKey("web_register_explorer");
        localStorage.setItem(PENDING_REGISTRATION_KEY, pendingIdempotencyKey);
        const registration = await registerEpochExplorer({
          idempotencyKey: pendingIdempotencyKey,
        });
        const nextExplorer = createExplorerIdentityFromRegistration(registration);
        saveExplorerIdentity(nextExplorer);
        saveExplorerBackupStatus(nextExplorer.explorerId, false);
        localStorage.removeItem(PENDING_REGISTRATION_KEY);
        clearAgentScopedState();
        localStorage.setItem(CURRENT_AGENT_KEY, registration.agentId);
        setExplorer(nextExplorer);
        setHasExplorerBackup(false);
        setShowRecoveryCode(false);
        setRecoveryCodeRevealUsed(false);
        setCurrentAgentId(registration.agentId);
        currentAgentIdRef.current = registration.agentId;
        await refreshProgress(registration.agentId);
        setExplorerProfile(await getEpochExplorerProfile(nextExplorer.explorerId));
        return;
      }
      const issued = await issueEpochIdentity({
        explorerId: explorer.explorerId,
        recoveryCode: explorer.recoveryCode,
        idempotencyKey: idempotencyKey("web_identity"),
      });
      clearAgentScopedState();
      localStorage.setItem(CURRENT_AGENT_KEY, issued.value.agentId);
      setCurrentAgentId(issued.value.agentId);
      currentAgentIdRef.current = issued.value.agentId;
      await refreshProgress(issued.value.agentId);
      setExplorerProfile(await getEpochExplorerProfile(explorer.explorerId));
    });
  }

  function revealRecoveryCodeOnce() {
    if (!recoveryCode || recoveryCodeRevealUsed) return;
    setShowRecoveryCode(true);
    setRecoveryCodeRevealUsed(true);
  }

  function hideRecoveryCode() {
    setShowRecoveryCode(false);
  }

  async function rotateRecoveryCode() {
    if (!explorer) return;
    await runAction("rotate-recovery", async () => {
      const nextExplorer = createRotatedExplorerRecovery(explorer);
      const rotation: PendingExplorerRecoveryRotation = {
        previous: explorer,
        next: nextExplorer,
        idempotencyKey: idempotencyKey("web_rotate_recovery"),
      };
      await completeRecoveryRotation(rotation, false);
    });
  }

  async function resumePendingRecoveryRotation(rotation: PendingExplorerRecoveryRotation) {
    await runAction("resume-recovery-rotation", async () => {
      await completeRecoveryRotation(rotation, true);
    });
  }

  async function completeRecoveryRotation(
    rotation: PendingExplorerRecoveryRotation,
    resumeAfterReload: boolean,
  ) {
    await completeExplorerRecoveryRotationTransaction({
      rotation,
      resumeAfterReload,
      stagePending: () => savePendingExplorerRecoveryRotation(rotation),
      rotateOnServer: async () => {
        await rotateEpochRecovery({
          explorerId: rotation.previous.explorerId,
          recoveryCode: rotation.previous.recoveryCode,
          newRecoveryCode: rotation.next.recoveryCode,
          idempotencyKey: rotation.idempotencyKey,
        });
      },
      verifyNextCredential: async () => {
        await getEpochConfirmations({
          explorerId: rotation.next.explorerId,
          recoveryCode: rotation.next.recoveryCode,
          limit: 1,
        });
      },
      exposeAcceptedCredential: () => {
        setExplorer(rotation.next);
        setHasExplorerBackup(false);
        setShowRecoveryCode(true);
        setRecoveryCodeRevealUsed(true);
        setArchiveExportArmed(false);
      },
      persistAcceptedCredential: () => {
        saveExplorerIdentity(rotation.next);
        saveExplorerBackupStatus(rotation.next.explorerId, false);
      },
      clearPending: clearPendingExplorerRecoveryRotation,
    });
    setShowRecoveryCode(false);
    setRecoveryCodeRevealUsed(false);
    setExplorerProfile(await getEpochExplorerProfile(rotation.next.explorerId));
  }

  async function downloadExplorerArchive() {
    if (!explorer) return;
    if (!archiveExportArmed) {
      setArchiveExportArmed(true);
      setArchiveStatus("再次点击确认下载加密档案；不要截图恢复码。");
      return;
    }
    await runAction("export-archive", async () => {
      const archive = await exportEncryptedExplorerArchive(explorer, archivePassphrase);
      const blob = new Blob([archive], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `obsidian-epoch-${explorer.explorerId}.archive.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      setArchiveImportText(archive);
      setArchiveStatus("已生成加密档案");
      setArchiveExportArmed(false);
      saveExplorerBackupStatus(explorer.explorerId, true);
      setHasExplorerBackup(true);
    });
  }

  async function importExplorerArchive() {
    await runAction("import-archive", async () => {
      const previousExplorerId = explorer?.explorerId || "";
      const imported = await importEncryptedExplorerArchive(archiveImportText, archivePassphrase);
      saveExplorerIdentity(imported);
      saveExplorerBackupStatus(imported.explorerId, true);
      setExplorer(imported);
      setHasExplorerBackup(true);
      setShowRecoveryCode(false);
      setRecoveryCodeRevealUsed(false);
      setArchiveExportArmed(false);
      setArchiveImportText("");
      setArchiveStatus("已导入加密档案");
      setExplorerProfile(await getEpochExplorerProfile(imported.explorerId));
      if (previousExplorerId && previousExplorerId !== imported.explorerId) {
        localStorage.removeItem(CURRENT_AGENT_KEY);
        setCurrentAgentId("");
        setProgress(null);
        clearAgentScopedState();
      }
    });
  }

  async function switchIdentity(agentId: string) {
    if (!agentId || agentId === currentAgentId) return;
    await runAction("switch-identity", async () => {
      clearAgentScopedState();
      localStorage.setItem(CURRENT_AGENT_KEY, agentId);
      setCurrentAgentId(agentId);
      currentAgentIdRef.current = agentId;
      await refreshProgress(agentId);
      if (explorer) setExplorerProfile(await getEpochExplorerProfile(explorer.explorerId));
    });
  }

  async function archiveCurrentIdentity() {
    if (!currentAgentId || !explorer) return;
    await runAction("archive-identity", async () => {
      const archived = await archiveEpochIdentity({
        agentId: currentAgentId,
        archiveReason: "user_archived",
        recoveryCode: explorer.recoveryCode,
        idempotencyKey: idempotencyKey("web_archive_identity"),
      });
      await refreshProgress(archived.value.agentId);
      setExplorerProfile(await getEpochExplorerProfile(explorer.explorerId));
    });
  }

  async function reincarnateCurrentIdentity() {
    if (!currentAgentId || !explorer) return;
    await runAction("reincarnate-identity", async () => {
      const reincarnated = await reincarnateEpochIdentity({
        previousAgentId: currentAgentId,
        recoveryCode: explorer.recoveryCode,
        idempotencyKey: idempotencyKey("web_reincarnate_identity"),
      });
      localStorage.setItem(CURRENT_AGENT_KEY, reincarnated.value.agentId);
      setCurrentAgentId(reincarnated.value.agentId);
      currentAgentIdRef.current = reincarnated.value.agentId;
      clearAgentScopedState();
      await refreshProgress(reincarnated.value.agentId);
      setExplorerProfile(await getEpochExplorerProfile(explorer.explorerId));
    });
  }

  async function craftInventoryItem() {
    if (!canUseActiveIdentity || !explorer) return;
    await runAction("craft-item", async () => {
      await craftEpochInventoryItem({
        agentId: currentAgentId,
        recipeId: craftRecipeId,
        recoveryCode: explorer.recoveryCode,
        idempotencyKey: idempotencyKey("web_craft_item"),
      });
      await refreshProgress();
    });
  }

  async function loadShop() {
    await runAction("shop", async () => {
      setShopState(await getEpochShop(regionId));
    });
  }

  async function purchaseShopOffer() {
    if (!canUseActiveIdentity || !explorer || !shopOfferId) return;
    await runAction("purchase-shop-offer", async () => {
      await purchaseEpochShopOffer({
        agentId: currentAgentId,
        offerId: shopOfferId,
        regionId: regionId,
        recoveryCode: explorer.recoveryCode,
        idempotencyKey: idempotencyKey("web_shop_purchase"),
      });
      await refreshProgress();
      setShopState(await getEpochShop(regionId));
    });
  }

  async function startDowntime() {
    if (!canUseActiveIdentity || !explorer) return;
    await runAction("set-downtime", async () => {
      await setEpochDowntime({
        agentId: currentAgentId,
        mode: downtimeMode,
        regionId,
        recoveryCode: explorer.recoveryCode,
        idempotencyKey: idempotencyKey("web_downtime_set"),
      });
      await refreshProgress();
    });
  }

  async function startStarterCommission() {
    if (!canUseActiveIdentity || !explorer) return;
    const risk = selectedStarterRiskPreference;
    await runAction("starter-commission", async () => {
      const session = await startEpochHostedSession({
        agentId: currentAgentId,
        regionId,
        mandate: withLowStimulusGuidance(`${risk.mandate} ${STARTER_DEATH_PROTECTION.mandate} ${STARTER_REWARD_ISOLATION.mandate} ${STARTER_SECRET_EXPOSURE_POLICY.mandate}`, lowStimulusMode),
        recoveryCode: explorer.recoveryCode,
        idempotencyKey: idempotencyKey(`web_starter_commission_${risk.value}`),
      });
      setHostedSessions([session.value, ...(await getEpochHostedSessions(currentAgentId)).sessions.filter((item) => item.sessionId !== session.value.sessionId)]);
      setHostedMandate(risk.mandate);
      resetInterventionBudgetForNewRun();
      await refreshProgress();
    });
  }

  async function claimDowntime() {
    if (!canUseActiveIdentity || !explorer) return;
    await runAction("claim-downtime", async () => {
      await claimEpochDowntime({
        agentId: currentAgentId,
        recoveryCode: explorer.recoveryCode,
        idempotencyKey: idempotencyKey("web_downtime_claim"),
      });
      await refreshProgress();
    });
  }

  async function tickDowntime() {
    if (!canUseActiveIdentity) return;
    await runAction("tick-downtime", async () => {
      await tickEpochDowntime({
        agentId: currentAgentId,
        idempotencyKey: idempotencyKey("web_downtime_tick"),
      });
      await refreshProgress();
    });
  }

  async function saveNpcNote() {
    if (!canUseActiveIdentity || !explorer) return;
    await runAction("npc", async () => {
      await submitEpochNpcCandidate({
        agentId: currentAgentId,
        displayName: npcName,
        regionId,
        traits: ["web-note"],
        storyEvidence: `Agent Console submitted NPC candidate: ${npcName.trim()}`,
        recoveryCode: explorer.recoveryCode,
        idempotencyKey: idempotencyKey("web_npc_candidate"),
      });
      const nextRegion = await getEpochRegionInfo(regionId);
      commitRegionSnapshot(nextRegion);
    });
  }

  async function reviewRejectedNpcCandidate(candidateId: string) {
    if (!operatorKey.trim()) return;
    await runAction("review-npc-candidate", async () => {
      await reviewEpochNpcCandidate({
        operatorKey: operatorKey.trim(),
        candidateId,
        resolution: "promote",
        note: "Agent Console operator review",
        idempotencyKey: idempotencyKey("web_npc_candidate_review"),
      });
      const nextRegion = await getEpochRegionInfo(regionId);
      commitRegionSnapshot(nextRegion);
    });
  }

  async function loadRegion() {
    await runAction("region", async () => {
      const [nextRegion, messages] = await Promise.all([
        getEpochRegionInfo(regionId),
        getEpochMessages(regionId),
      ]);
      commitRegionSnapshot(nextRegion, { messages: messages.regionMessages });
    });
  }

  async function tickNpcLifecycle() {
    await runAction("npc-lifecycle", async () => {
      await tickEpochNpcLifecycle({
        regionId,
        limit: 4,
        idempotencyKey: idempotencyKey("web_npc_lifecycle"),
      });
      const nextRegion = await getEpochRegionInfo(regionId);
      commitRegionSnapshot(nextRegion);
    });
  }

  async function tickOrganizationPolitics() {
    await runAction("organization-politics", async () => {
      await tickEpochOrganizationPolitics({
        regionId,
        limit: 4,
        idempotencyKey: idempotencyKey("web_organization_politics"),
      });
      const nextRegion = await getEpochRegionInfo(regionId);
      commitRegionSnapshot(nextRegion);
    });
  }

  async function createOrganization() {
    if (!operatorKey.trim() || !organizationCreateName.trim()) return;
    await runAction("create-organization", async () => {
      await createEpochOrganization({
        operatorKey: operatorKey.trim(),
        regionId,
        displayName: organizationCreateName.trim(),
        idempotencyKey: idempotencyKey("web_organization_create"),
      });
      const nextRegion = await getEpochRegionInfo(regionId);
      commitRegionSnapshot(nextRegion);
    });
  }

  async function updateOrganizationMembership(
    organization: EpochRegionInfo["organizations"][number],
    status: "active" | "left",
  ) {
    if (!canUseActiveIdentity || !explorer) return;
    await runAction("organization-membership", async () => {
      await updateEpochOrganizationMembership({
        agentId: currentAgentId,
        organizationId: organization.organizationId,
        role: organizationMembershipRole,
        status,
        recoveryCode: explorer.recoveryCode,
        idempotencyKey: idempotencyKey("web_organization_membership"),
      });
      await refreshProgress();
      const nextRegion = await getEpochRegionInfo(regionId);
      commitRegionSnapshot(nextRegion);
    });
  }

  async function purchaseOrganizationUpgrade(organization: EpochRegionInfo["organizations"][number]) {
    if (!canUseActiveIdentity || !explorer) return;
    await runAction("organization-upgrade", async () => {
      await purchaseEpochOrganizationUpgrade({
        agentId: currentAgentId,
        organizationId: organization.organizationId,
        upgradeKey: organizationUpgradeKey,
        recoveryCode: explorer.recoveryCode,
        idempotencyKey: idempotencyKey("web_organization_upgrade"),
      });
      await refreshProgress();
      const nextRegion = await getEpochRegionInfo(regionId);
      commitRegionSnapshot(nextRegion);
    });
  }

  async function contributeOrganizationTreasury(organization: EpochRegionInfo["organizations"][number]) {
    if (!canUseActiveIdentity || !explorer) return;
    await runAction("organization-contribution", async () => {
      await contributeEpochOrganizationTreasury({
        agentId: currentAgentId,
        organizationId: organization.organizationId,
        resourceId: organizationContributionResourceId,
        amount: organizationContributionAmount,
        recoveryCode: explorer.recoveryCode,
        idempotencyKey: idempotencyKey("web_organization_contribution"),
      });
      await refreshProgress();
      const nextRegion = await getEpochRegionInfo(regionId);
      commitRegionSnapshot(nextRegion);
    });
  }

  async function proposeOrganizationBudget(organization: EpochRegionInfo["organizations"][number]) {
    if (!canUseActiveIdentity || !explorer || !organizationBudgetTitle.trim()) return;
    await runAction("organization-budget-propose", async () => {
      await proposeEpochOrganizationBudget({
        agentId: currentAgentId,
        organizationId: organization.organizationId,
        title: organizationBudgetTitle.trim(),
        description: organizationBudgetDescription.trim() || undefined,
        resourceId: organizationBudgetResourceId,
        amount: organizationBudgetAmount,
        recoveryCode: explorer.recoveryCode,
        idempotencyKey: idempotencyKey("web_organization_budget_propose"),
      });
      await refreshProgress();
      const nextRegion = await getEpochRegionInfo(regionId);
      commitRegionSnapshot(nextRegion);
    });
  }

  async function resolveOrganizationBudget(
    budgetId: string,
    resolution: "approved" | "rejected",
  ) {
    if (!canUseActiveIdentity || !explorer) return;
    await runAction(`organization-budget-${resolution}`, async () => {
      await resolveEpochOrganizationBudget({
        agentId: currentAgentId,
        budgetId,
        resolution,
        note: resolution === "approved" ? "批准组织预算。" : "暂缓组织预算。",
        recoveryCode: explorer.recoveryCode,
        idempotencyKey: idempotencyKey("web_organization_budget_resolve"),
      });
      await refreshProgress();
      const nextRegion = await getEpochRegionInfo(regionId);
      commitRegionSnapshot(nextRegion);
    });
  }

  async function postRegionMessage() {
    if (!canUseActiveIdentity || !messageBody.trim()) return;
    await runAction("post-message", async () => {
      const posted = await postEpochMessage({
        agentId: currentAgentId,
        scope: "region",
        regionId,
        body: messageBody,
        idempotencyKey: idempotencyKey("web_post_message"),
      });
      const sourceEventId = posted.events[0]?.eventId;
      if (sourceEventId) setNewsSourceEventId(sourceEventId);
      if (posted.value.moderationStatus === "queued" && operatorKey.trim()) {
        setModerationQueue(await getEpochModerationQueue({ operatorKey: operatorKey.trim(), status: "open" }));
      }
      setMessageBody("");
      const nextRegion = await getEpochRegionInfo(regionId);
      commitRegionSnapshot(nextRegion);
      await refreshProgress();
    });
  }

  async function postServerHostedRegionMessage() {
    if (!canUseActiveIdentity || !operatorKey.trim() || !messageBody.trim()) return;
    await runAction("server-hosted-region-message", async () => {
      const posted = await postEpochMessage({
        operatorKey: operatorKey.trim(),
        agentId: currentAgentId,
        scope: "region",
        regionId,
        body: messageBody,
        idempotencyKey: idempotencyKey("web_server_hosted_region_message"),
      });
      const sourceEventId = posted.events[0]?.eventId;
      if (sourceEventId) setNewsSourceEventId(sourceEventId);
      setMessageBody("");
      const nextRegion = await getEpochRegionInfo(regionId);
      commitRegionSnapshot(nextRegion);
      await refreshProgress();
    });
  }

  async function requestWorldConfirmation() {
    if (!canUseActiveIdentity || !messageBody.trim()) return;
    await runAction("request-confirmation", async () => {
      const requested = await requestEpochConfirmation({
        action: "world_message",
        agentId: currentAgentId,
        body: messageBody,
        summary: messageBody,
        idempotencyKey: idempotencyKey("web_request_confirmation"),
      });
      setHighValueConfirmation(requested.confirmation);
      setConfirmationToken("");
      await refreshHighValueConfirmations();
    });
  }

  async function requestTurnCardConfirmation() {
    if (!canUseActiveIdentity || !turnPrompt.trim()) return;
    await runAction("request-turn-confirmation", async () => {
      const requested = await requestEpochConfirmation({
        action: "turn_card",
        agentId: currentAgentId,
        regionId,
        prompt: withLowStimulusGuidance(turnPrompt, lowStimulusMode),
        summary: `回合卡 ${regionId}: ${withLowStimulusGuidance(turnPrompt, lowStimulusMode)}`,
        idempotencyKey: idempotencyKey("web_turn_confirmation"),
      });
      setHighValueConfirmation(requested.confirmation);
      setConfirmationToken("");
      await refreshHighValueConfirmations();
    });
  }

  async function refreshHighValueConfirmations() {
    if (!explorer) return;
    const inbox = await getEpochConfirmations({
      explorerId: explorer.explorerId,
      recoveryCode: explorer.recoveryCode,
      status: "pending",
      limit: 20,
    });
    setHighValueConfirmations(inbox.confirmations);
  }

  async function loadHighValueConfirmations() {
    await runAction("load-confirmations", async () => {
      await refreshHighValueConfirmations();
    });
  }

  async function confirmHighValueAction() {
    if (!highValueConfirmation || !explorer) return;
    await runAction("confirm-action", async () => {
      const confirmed = await confirmEpochAction({
        confirmationId: highValueConfirmation.confirmationId,
        explorerId: explorer.explorerId,
        recoveryCode: explorer.recoveryCode,
        idempotencyKey: idempotencyKey("web_confirm_action"),
      });
      setHighValueConfirmation(confirmed.confirmation);
      setConfirmationToken(confirmed.confirmationToken);
      await refreshHighValueConfirmations();
    });
  }

  async function postWorldMessage() {
    if (!canUseActiveIdentity || !messageBody.trim() || !confirmationToken.trim()) return;
    await runAction("post-world-message", async () => {
      await postEpochMessage({
        agentId: currentAgentId,
        scope: "world",
        body: messageBody,
        confirmationToken,
        idempotencyKey: idempotencyKey("web_post_world_message"),
      });
      setConfirmationToken("");
      setMessageBody("");
      await refreshProgress();
      const [nextRegion, messages] = await Promise.all([
        getEpochRegionInfo(regionId),
        getEpochMessages(regionId),
      ]);
      commitRegionSnapshot(nextRegion, { messages: messages.regionMessages });
    });
  }

  async function generateRegionNews() {
    if (!newsSourceEventId.trim()) return;
    await runAction("generate-news", async () => {
      const generated = await generateEpochRegionNews({
        regionId,
        sourceEventId: newsSourceEventId.trim(),
        idempotencyKey: idempotencyKey("web_generate_news"),
      });
      const nextRegion = await getEpochRegionInfo(regionId);
      commitRegionSnapshot(nextRegion);
      setNewsSourceEventId(generated.value.sourceEventIds[0] || newsSourceEventId);
    });
  }

  async function claimNewsLegend(newsId?: string) {
    const targetNewsId = newsId || progress?.claimableLegendNews[0]?.newsId || region?.news[0]?.newsId;
    if (!canUseActiveIdentity || !targetNewsId || !explorer) return;
    await runAction("claim-news-legend", async () => {
      await claimEpochNewsLegend({
        newsId: targetNewsId,
        agentId: currentAgentId,
        recoveryCode: explorer.recoveryCode,
        idempotencyKey: idempotencyKey("web_claim_news_legend"),
      });
      await refreshProgress();
    });
  }

  async function loadModerationQueue() {
    if (!operatorKey.trim()) return;
    await runAction("moderation", async () => {
      setModerationQueue(await getEpochModerationQueue({
        operatorKey: operatorKey.trim(),
        status: "open",
      }));
    });
  }

  async function loadRiskAudit() {
    await runAction("risk-audit", async () => {
      setRiskAudit(await getEpochAudit({
        riskOnly: true,
        eventType: "market_order_filled",
        limit: 8,
      }));
    });
  }

  async function loadPartyInviteAudit() {
    await runAction("party-invite-audit", async () => {
      setPartyInviteAudit(await getEpochAudit({
        eventType: "party_invite_updated",
        limit: 12,
      }));
    });
  }

  async function loadRejectedCommandAudit() {
    await runAction("rejected-audit", async () => {
      setRiskAudit(await getEpochAudit({
        eventType: "command_rejected",
        limit: 8,
      }));
    });
  }

  async function loadAbuseProfiles() {
    if (!operatorKey.trim()) return;
    await runAction("abuse-profiles", async () => {
      setAbuseProfiles(await getEpochAbuseProfiles({
        operatorKey: operatorKey.trim(),
        level: "restricted",
        limit: 8,
      }));
    });
  }

  async function loadOperatorOverview() {
    if (!operatorKey.trim()) return;
    await runAction("operator-overview", async () => {
      const overview = await getEpochOperatorOverview({
        operatorKey: operatorKey.trim(),
        limit: 8,
      });
      setOperatorOverview(overview);
      setModerationQueue(overview.moderation);
      setAbuseProfiles(overview.abuse);
      setMarketRiskRestrictions(overview.marketRiskRestrictions);
      setRiskAudit(overview.riskAudit);
    });
  }

  async function adjudicateLoreTarget() {
    const sourceContributionEventIds = loreAdjudicationSourceIds
      .split(/[\s,]+/)
      .map((eventId) => eventId.trim())
      .filter(Boolean);
    if (!operatorKey.trim() || !loreAdjudicationTargetId.trim() || !loreAdjudicationSummary.trim() || !sourceContributionEventIds.length) return;
    if (loreCanonCandidateRequested
      && (!loreCanonChapterReviewId.trim() || !loreCanonCuratorApprovedBy.trim() || !loreCanonMigrationSummary.trim())) return;
    await runAction("lore-adjudication", async () => {
      await adjudicateEpochLoreTarget({
        operatorKey: operatorKey.trim(),
        targetId: loreAdjudicationTargetId.trim(),
        status: loreAdjudicationStatus,
        summary: loreAdjudicationSummary.trim(),
        sourceContributionEventIds,
        canonCandidate: loreCanonCandidateRequested ? {
          requested: true,
          chapterReviewId: loreCanonChapterReviewId.trim(),
          curatorApprovedBy: loreCanonCuratorApprovedBy.trim(),
          migrationSummary: loreCanonMigrationSummary.trim(),
          adoptedText: loreCanonAdoptedText.trim(),
          boundaryNote: loreCanonBoundaryNote.trim(),
        } : undefined,
        idempotencyKey: idempotencyKey("web_lore_adjudication"),
      });
      setWorldOverview(await getEpochWorldOverview({ limit: 6 }));
    });
  }

  async function runMaintenance() {
    if (!operatorKey.trim()) return;
    await runAction("maintenance-run", async () => {
      const result = await runEpochMaintenance({
        operatorKey: operatorKey.trim(),
        npcRegionId: regionId,
        npcLimit: 4,
        marketMaxAgeSeconds: 24 * 60 * 60,
        marketLimit: 25,
        resourceNodeRegionIds: [regionId],
        resourceNodeLimit: 1,
        resourceNodeSettlementLimit: 3,
        anomalyRegionIds: [regionId],
        anomalyLimit: 1,
        anomalyTemplateKey: "obsidian_wyrm_boss",
        seasonRegionIds: [regionId],
        seasonLimit: 1,
        seasonKey: "gray_harbor_faction_season",
        seasonSettlementLimit: 3,
        serverHostedJobLimit: 3,
        abuseDecayLimit: 3,
        abuseDecayAmount: 1,
        idempotencyKey: idempotencyKey("web_maintenance_run"),
      });
      setMaintenanceRun(result.value);
      const overview = await getEpochOperatorOverview({
        operatorKey: operatorKey.trim(),
        limit: 8,
      });
      setOperatorOverview(overview);
      setModerationQueue(overview.moderation);
      setAbuseProfiles(overview.abuse);
      setMarketRiskRestrictions(overview.marketRiskRestrictions);
      setRiskAudit(overview.riskAudit);
      const nextRegion = await getEpochRegionInfo(regionId);
      commitRegionSnapshot(nextRegion);
      setMarketState(await getEpochMarket({ regionId }));
      await refreshProgress();
    });
  }

  async function resolveModerationItem(item: EpochModerationItem, resolution: EpochModerationResolution) {
    if (!operatorKey.trim()) return;
    await runAction(`moderation-${resolution}`, async () => {
      await resolveEpochModeration({
        operatorKey: operatorKey.trim(),
        moderationId: item.moderationId,
        resolution,
        note: moderationNote.trim() || undefined,
        idempotencyKey: idempotencyKey(`web_moderation_${resolution}`),
      });
      setModerationQueue(await getEpochModerationQueue({
        operatorKey: operatorKey.trim(),
        status: "open",
      }));
      setModerationNote("");
      if (item.regionId) {
        const nextRegion = await getEpochRegionInfo(item.regionId);
        commitRegionSnapshot(nextRegion);
      }
    });
  }

  async function recordRiskReview(event: EpochAuditInfo["events"][number], resolution: EpochRiskReviewResolution) {
    if (!operatorKey.trim()) return;
    await runAction(`risk-review-${resolution}`, async () => {
      await recordEpochRiskReview({
        operatorKey: operatorKey.trim(),
        sourceEventId: event.eventId,
        resolution,
        note: riskReviewNote.trim() || undefined,
        idempotencyKey: idempotencyKey(`web_risk_review_${resolution}`),
      });
      setRiskAudit(await getEpochAudit({
        riskOnly: true,
        eventType: "market_order_filled",
        limit: 8,
      }));
      setRiskReviewNote("");
    });
  }

  async function releaseMarketRiskRestriction() {
    if (!operatorKey.trim() || !currentMarketRestriction) return;
    await runAction("release-market-risk", async () => {
      await releaseEpochMarketRiskRestriction({
        operatorKey: operatorKey.trim(),
        agentId: currentMarketRestriction.agentId,
        note: riskReviewNote.trim() || undefined,
        idempotencyKey: idempotencyKey("web_market_risk_release"),
      });
      setMarketState(await getEpochMarket({ regionId }));
      setRiskAudit(await getEpochAudit({
        riskOnly: true,
        eventType: "market_order_filled",
        limit: 8,
      }));
      setRiskReviewNote("");
    });
  }

  async function releaseAbuseRestriction() {
    if (!operatorKey.trim() || !abuseStatus || abuseStatus.abuseLevel !== "restricted") return;
    await runAction("release-abuse-restriction", async () => {
      await releaseEpochAbuseRestriction({
        operatorKey: operatorKey.trim(),
        actorKey: abuseStatus.actorKey,
        agentId: currentAgentId || undefined,
        note: riskReviewNote.trim() || undefined,
        idempotencyKey: idempotencyKey("web_abuse_release"),
      });
      setAbuseStatus(await getEpochAbuseStatus({
        agentId: currentAgentId || undefined,
        explorerId: !currentAgentId ? explorer?.explorerId : undefined,
      }));
      setAbuseProfiles(await getEpochAbuseProfiles({
        operatorKey: operatorKey.trim(),
        level: "restricted",
        limit: 8,
      }));
      setRiskAudit(await getEpochAudit({
        eventType: "abuse_score_released",
        limit: 8,
      }));
      setRiskReviewNote("");
    });
  }

  async function loadObjectives() {
    await runAction("objectives", async () => {
      setObjectives((await getEpochObjectives(regionId)).objectives);
    });
  }

  async function loadCompetitiveLadder(mode = competitiveLadderMode) {
    await runAction("competitive-ladder", async () => {
      setCompetitiveLadder(await getEpochCompetitiveLadder({ mode, regionId, limit: 20 }));
    });
  }

  async function seedObjective() {
    if (!operatorKey.trim()) return;
    await runAction("seed-objective", async () => {
      await seedEpochObjective({
        operatorKey: operatorKey.trim(),
        regionId,
        objectiveKey: objectiveTemplateKey,
        idempotencyKey: idempotencyKey("web_seed_objective"),
      });
      setObjectives((await getEpochObjectives(regionId)).objectives);
    });
  }

  async function contributeObjective() {
    if (!canUseActiveIdentity || !primaryObjective || !explorer) return;
    await runAction("contribute-objective", async () => {
      await contributeEpochObjective({
        objectiveId: primaryObjective.objectiveId,
        agentId: currentAgentId,
        amount: objectiveAmount,
        recoveryCode: explorer.recoveryCode,
        idempotencyKey: idempotencyKey("web_contribute_objective"),
      });
      await refreshProgress();
      setObjectives((await getEpochObjectives(regionId)).objectives);
    });
  }

  async function settleObjective() {
    if (!operatorKey.trim() || !primaryObjective) return;
    await runAction("settle-objective", async () => {
      await settleEpochObjective({
        operatorKey: operatorKey.trim(),
        objectiveId: primaryObjective.objectiveId,
        idempotencyKey: idempotencyKey("web_settle_objective"),
      });
      await refreshProgress();
      setObjectives((await getEpochObjectives(regionId)).objectives);
    });
  }

  async function loadResourceNodes() {
    await runAction("resource-nodes", async () => {
      setResourceNodes((await getEpochResourceNodes({ regionId })).nodes);
    });
  }

  async function spawnResourceNode() {
    if (!operatorKey.trim()) return;
    await runAction("spawn-resource-node", async () => {
      await spawnEpochResourceNode({
        operatorKey: operatorKey.trim(),
        regionId,
        resourceId: "aether",
        rewardAmount: 2,
        idempotencyKey: idempotencyKey("web_spawn_resource_node"),
      });
      const nextRegion = await getEpochRegionInfo(regionId);
      const nextResourceNodes = (await getEpochResourceNodes({ regionId })).nodes;
      commitRegionSnapshot(nextRegion, { resourceNodes: nextResourceNodes });
    });
  }

  async function contestResourceNode() {
    if (!canUseActiveIdentity || !primaryResourceNode || !explorer) return;
    await runAction("contest-resource-node", async () => {
      await contestEpochResourceNode({
        nodeId: primaryResourceNode.nodeId,
        agentId: currentAgentId,
        staminaSpent: resourceNodeStamina,
        recoveryCode: explorer.recoveryCode,
        idempotencyKey: idempotencyKey("web_contest_resource_node"),
      });
      await refreshProgress();
      const nextRegion = await getEpochRegionInfo(regionId);
      const nextResourceNodes = (await getEpochResourceNodes({ regionId })).nodes;
      commitRegionSnapshot(nextRegion, { resourceNodes: nextResourceNodes });
    });
  }

  async function settleResourceNode() {
    if (!operatorKey.trim() || !primaryResourceNode) return;
    await runAction("settle-resource-node", async () => {
      await settleEpochResourceNode({
        operatorKey: operatorKey.trim(),
        nodeId: primaryResourceNode.nodeId,
        idempotencyKey: idempotencyKey("web_settle_resource_node"),
      });
      await refreshProgress();
      const nextRegion = await getEpochRegionInfo(regionId);
      const nextResourceNodes = (await getEpochResourceNodes({ regionId })).nodes;
      commitRegionSnapshot(nextRegion, { resourceNodes: nextResourceNodes });
    });
  }

  async function loadAnomalies() {
    await runAction("anomalies", async () => {
      setAnomalies((await getEpochAnomalies({ regionId })).anomalies);
    });
  }

  async function spawnAnomaly() {
    if (!operatorKey.trim()) return;
    await runAction("spawn-anomaly", async () => {
      await spawnEpochAnomaly({
        operatorKey: operatorKey.trim(),
        regionId,
        severity: "minor",
        targetScore: 6,
        rewardResourceId: "aether",
        rewardAmount: 2,
        lifetimeRisk: 1,
        idempotencyKey: idempotencyKey("web_spawn_anomaly"),
      });
      const nextRegion = await getEpochRegionInfo(regionId);
      const nextAnomalies = (await getEpochAnomalies({ regionId })).anomalies;
      commitRegionSnapshot(nextRegion, { anomalies: nextAnomalies });
    });
  }

  async function contestAnomaly() {
    if (!canUseActiveIdentity || !primaryAnomaly || !explorer) return;
    await runAction("contest-anomaly", async () => {
      await contestEpochAnomaly({
        anomalyId: primaryAnomaly.anomalyId,
        agentId: currentAgentId,
        focusSpent: anomalyFocus,
        recoveryCode: explorer.recoveryCode,
        idempotencyKey: idempotencyKey("web_contest_anomaly"),
      });
      await refreshProgress();
      const nextRegion = await getEpochRegionInfo(regionId);
      const nextAnomalies = (await getEpochAnomalies({ regionId })).anomalies;
      commitRegionSnapshot(nextRegion, { anomalies: nextAnomalies });
    });
  }

  async function resolveAnomaly() {
    if (!operatorKey.trim() || !primaryAnomaly) return;
    await runAction("resolve-anomaly", async () => {
      await resolveEpochAnomaly({
        operatorKey: operatorKey.trim(),
        anomalyId: primaryAnomaly.anomalyId,
        idempotencyKey: idempotencyKey("web_resolve_anomaly"),
      });
      await refreshProgress();
      const nextRegion = await getEpochRegionInfo(regionId);
      const nextAnomalies = (await getEpochAnomalies({ regionId })).anomalies;
      commitRegionSnapshot(nextRegion, { anomalies: nextAnomalies });
    });
  }

  async function loadSeasons() {
    await runAction("seasons", async () => {
      setSeasons((await getEpochSeasons({ regionId })).seasons);
    });
  }

  async function seedSeason() {
    if (!operatorKey.trim()) return;
    await runAction("seed-season", async () => {
      await seedEpochSeason({
        operatorKey: operatorKey.trim(),
        regionId,
        seasonKey: seasonTemplateKey,
        idempotencyKey: idempotencyKey("web_seed_season"),
      });
      setSeasons((await getEpochSeasons({ regionId })).seasons);
    });
  }

  async function contributeSeason() {
    if (!canUseActiveIdentity || !primarySeason || !explorer) return;
    await runAction("contribute-season", async () => {
      const result = await contributeEpochSeason({
        seasonId: primarySeason.seasonId,
        agentId: currentAgentId,
        factionId: seasonFactionId,
        amount: seasonAmount,
        recoveryCode: explorer.recoveryCode,
        idempotencyKey: idempotencyKey("web_contribute_season"),
      });
      const contributionEvent = result.events.find((event) => event.eventType === "season_contribution_recorded");
      const contribution = contributionEvent ? seasonContributionResultFromEvent(contributionEvent) : null;
      setLastSeasonContribution(contribution);
      if (contribution) {
        setSeasonContributionHistory((history) => [
          contribution,
          ...history.filter((item) => item.eventId !== contribution.eventId),
        ].slice(0, 8));
      }
      await refreshProgress();
      setSeasons((await getEpochSeasons({ regionId })).seasons);
    });
  }

  async function settleSeason() {
    if (!operatorKey.trim() || !primarySeason) return;
    await runAction("settle-season", async () => {
      await settleEpochSeason({
        operatorKey: operatorKey.trim(),
        seasonId: primarySeason.seasonId,
        idempotencyKey: idempotencyKey("web_settle_season"),
      });
      await refreshProgress();
      const nextSeasons = (await getEpochSeasons({ regionId })).seasons;
      const nextRegion = await getEpochRegionInfo(regionId);
      commitRegionSnapshot(nextRegion, { seasons: nextSeasons });
    });
  }

  async function loadMarket() {
    await runAction("market", async () => {
      setMarketState(await getEpochMarket({ regionId }));
    });
  }

  async function createMarketOrder() {
    if (!canUseActiveIdentity || !explorer) return;
    if (marketSellMode === "item" && !sellItemId) return;
    await runAction("create-market-order", async () => {
      await createEpochMarketOrder({
        sellerAgentId: currentAgentId,
        regionId,
        ...(marketSellMode === "item"
          ? { sellItemId: sellItemId }
          : { sellResourceId, sellAmount }),
        priceResourceId,
        priceAmount,
        recoveryCode: explorer.recoveryCode,
        idempotencyKey: idempotencyKey("web_market_create"),
      });
      await refreshProgress();
      setMarketState(await getEpochMarket({ regionId }));
      commitRegionSnapshot(await getEpochRegionInfo(regionId));
    });
  }

  async function fillMarketOrder(order: EpochMarketOrder) {
    if (!canUseActiveIdentity || !explorer) return;
    await runAction("fill-market-order", async () => {
      await fillEpochMarketOrder({
        orderId: order.orderId,
        buyerAgentId: currentAgentId,
        recoveryCode: explorer.recoveryCode,
        idempotencyKey: idempotencyKey("web_market_fill"),
      });
      await refreshProgress();
      setMarketState(await getEpochMarket({ regionId }));
      commitRegionSnapshot(await getEpochRegionInfo(regionId));
    });
  }

  async function cancelMarketOrder(order: EpochMarketOrder) {
    if (!canUseActiveIdentity || !explorer) return;
    await runAction("cancel-market-order", async () => {
      await cancelEpochMarketOrder({
        orderId: order.orderId,
        sellerAgentId: currentAgentId,
        recoveryCode: explorer.recoveryCode,
        idempotencyKey: idempotencyKey("web_market_cancel"),
      });
      await refreshProgress();
      setMarketState(await getEpochMarket({ regionId }));
      commitRegionSnapshot(await getEpochRegionInfo(regionId));
    });
  }

  async function tickMarketExpiry() {
    if (!operatorKey.trim()) return;
    await runAction("tick-market-expiry", async () => {
      await tickEpochMarketExpiry({
        operatorKey: operatorKey.trim(),
        maxAgeSeconds: 24 * 60 * 60,
        limit: 25,
        idempotencyKey: idempotencyKey("web_market_expiry"),
      });
      await refreshProgress();
      setMarketState(await getEpochMarket({ regionId }));
      commitRegionSnapshot(await getEpochRegionInfo(regionId));
    });
  }

  async function loadDirectTrades() {
    await runAction("direct-trades", async () => {
      setDirectTrades((await getEpochDirectTrades({
        agentId: currentAgentId || undefined,
        regionId,
        status: directTradeStatusFilter,
      })).trades);
    });
  }

  async function loadDirectTradeCounterpartyItems() {
    const counterpartyAgentId = directTradeCounterpartyAgentId.trim();
    if (!counterpartyAgentId) return;
    await runAction("direct-trade-counterparty-items", async () => {
      setDirectTradeCounterpartyItemStatus("正在加载对方可交易物品");
      try {
        const inventory = await getEpochInventory({ agentId: counterpartyAgentId, tradable: true });
        setDirectTradeCounterpartyItems(inventory.items);
        setDirectTradeRequestItemId(inventory.items[0]?.itemId || "");
        setDirectTradeCounterpartyItemStatus(
          inventory.items.length
            ? `已加载 ${inventory.items.length} 件可交易物品`
            : "对方暂无服务器判定可交易物品",
        );
      } catch (err: unknown) {
        setDirectTradeCounterpartyItemStatus(`加载失败：${errorMessage(err)}`);
        throw err;
      }
    });
  }

  async function loadDirectTradeAudit(trade: EpochDirectTrade) {
    await runAction("direct-trade-audit", async () => {
      const audit = await getEpochAudit({
        aggregateId: trade.tradeId,
        limit: 20,
      });
      setDirectTradeAuditTradeId(trade.tradeId);
      setDirectTradeAuditEvents(audit.events.filter((event) => {
        const payloadTradeId = typeof event.payload.tradeId === "string" ? event.payload.tradeId : "";
        return (payloadTradeId === trade.tradeId || event.aggregateId === trade.tradeId)
          && DIRECT_TRADE_AUDIT_EVENT_TYPES.includes(event.eventType as (typeof DIRECT_TRADE_AUDIT_EVENT_TYPES)[number]);
      }));
    });
  }

  async function createDirectTrade() {
    if (!canUseActiveIdentity || !explorer || !directTradeCounterpartyAgentId.trim()) return;
    if (directTradeOfferMode === "item" && !directTradeOfferItemId) return;
    if (directTradeRequestMode === "item" && !directTradeRequestItemId.trim()) return;
    await runAction("create-direct-trade", async () => {
      await createEpochDirectTrade({
        proposerAgentId: currentAgentId,
        counterpartyAgentId: directTradeCounterpartyAgentId.trim(),
        regionId,
        ...(directTradeOfferMode === "item"
          ? { offerItemId: directTradeOfferItemId }
          : { offerResourceId: directTradeOfferResourceId, offerAmount: directTradeOfferAmount }),
        ...(directTradeRequestMode === "item"
          ? { requestItemId: directTradeRequestItemId.trim() }
          : { requestResourceId: directTradeRequestResourceId, requestAmount: directTradeRequestAmount }),
        recoveryCode: explorer.recoveryCode,
        idempotencyKey: idempotencyKey("web_direct_trade_create"),
      });
      await refreshProgress();
      setDirectTrades((await getEpochDirectTrades({ agentId: currentAgentId, regionId, status: directTradeStatusFilter })).trades);
      commitRegionSnapshot(await getEpochRegionInfo(regionId));
    });
  }

  async function acceptDirectTrade(trade: EpochDirectTrade) {
    if (!canUseActiveIdentity || !explorer) return;
    await runAction("accept-direct-trade", async () => {
      await acceptEpochDirectTrade({
        tradeId: trade.tradeId,
        counterpartyAgentId: currentAgentId,
        recoveryCode: explorer.recoveryCode,
        idempotencyKey: idempotencyKey("web_direct_trade_accept"),
      });
      await refreshProgress();
      setDirectTrades((await getEpochDirectTrades({ agentId: currentAgentId, regionId, status: directTradeStatusFilter })).trades);
      commitRegionSnapshot(await getEpochRegionInfo(regionId));
    });
  }

  async function cancelDirectTrade(trade: EpochDirectTrade) {
    if (!canUseActiveIdentity || !explorer) return;
    await runAction("cancel-direct-trade", async () => {
      await cancelEpochDirectTrade({
        tradeId: trade.tradeId,
        recoveryCode: explorer.recoveryCode,
        idempotencyKey: idempotencyKey("web_direct_trade_cancel"),
      });
      await refreshProgress();
      setDirectTrades((await getEpochDirectTrades({ agentId: currentAgentId, regionId, status: directTradeStatusFilter })).trades);
      commitRegionSnapshot(await getEpochRegionInfo(regionId));
    });
  }

  async function tickDirectTradeExpiry() {
    if (!operatorKey.trim()) return;
    await runAction("tick-direct-trade-expiry", async () => {
      await tickEpochDirectTradeExpiry({
        operatorKey: operatorKey.trim(),
        maxAgeSeconds: 24 * 60 * 60,
        limit: 25,
        idempotencyKey: idempotencyKey("web_direct_trade_expiry"),
      });
      await refreshProgress();
      setDirectTrades((await getEpochDirectTrades({ agentId: currentAgentId || undefined, regionId, status: directTradeStatusFilter })).trades);
      commitRegionSnapshot(await getEpochRegionInfo(regionId));
    });
  }

  async function loadBounties() {
    await runAction("bounties", async () => {
      setBounties((await getEpochBounties({ regionId })).bounties);
    });
  }

  async function createBounty() {
    if (!canUseActiveIdentity || !explorer) return;
    await runAction("create-bounty", async () => {
      await createEpochBounty({
        sponsorAgentId: currentAgentId,
        regionId,
        title: bountyTitle,
        requiredItemKey: bountyRequiredItemKey.trim() || undefined,
        rewardResourceId: "coin",
        rewardAmount: bountyRewardAmount,
        recoveryCode: explorer.recoveryCode,
        idempotencyKey: idempotencyKey("web_bounty_create"),
      });
      await refreshProgress();
      setBounties((await getEpochBounties({ regionId })).bounties);
    });
  }

  async function claimBounty(bounty: EpochBounty) {
    if (!canUseActiveIdentity || !explorer) return;
    await runAction("claim-bounty", async () => {
      const fallbackItemId = tradableInventoryItems.find((item) =>
        !bounty.requiredItemKey || item.itemKey === bounty.requiredItemKey)?.itemId;
      await claimEpochBounty({
        bountyId: bounty.bountyId,
        claimantAgentId: currentAgentId,
        fulfillmentItemId: bounty.requiredItemKey ? (bountyFulfillmentItemId || fallbackItemId) : undefined,
        evidence: bountyEvidence,
        recoveryCode: explorer.recoveryCode,
        idempotencyKey: idempotencyKey("web_bounty_claim"),
      });
      await refreshProgress();
      setBounties((await getEpochBounties({ regionId })).bounties);
    });
  }

  async function loadPartyRuns() {
    await runAction("party-runs", async () => {
      setPartyRuns((await getEpochPartyRuns({ regionId })).partyRuns);
    });
  }

  async function createPartyRun() {
    if (!canUseActiveIdentity || !explorer) return;
    await runAction("create-party-run", async () => {
      await createEpochPartyRun({
        leaderAgentId: currentAgentId,
        regionId,
        title: partyTitle,
        objective: partyObjective,
        participantRole: "leader",
        recoveryCode: explorer.recoveryCode,
        idempotencyKey: idempotencyKey("web_party_create"),
      });
      await refreshProgress();
      setPartyRuns((await getEpochPartyRuns({ regionId })).partyRuns);
      commitRegionSnapshot(await getEpochRegionInfo(regionId));
    });
  }

  async function joinPartyRun(partyRun: EpochPartyRun) {
    if (!canUseActiveIdentity || !explorer) return;
    await runAction("join-party-run", async () => {
      await joinEpochPartyRun({
        partyRunId: partyRun.partyRunId,
        agentId: currentAgentId,
        participantRole,
        recoveryCode: explorer.recoveryCode,
        idempotencyKey: idempotencyKey("web_party_join"),
      });
      await refreshProgress();
      setPartyRuns((await getEpochPartyRuns({ regionId })).partyRuns);
      commitRegionSnapshot(await getEpochRegionInfo(regionId));
    });
  }

  async function requestPartyJoin(partyRun: EpochPartyRun) {
    if (!canUseActiveIdentity || !explorer) return;
    await runAction("request-party-join", async () => {
      await requestEpochPartyJoin({
        partyRunId: partyRun.partyRunId,
        agentId: currentAgentId,
        participantRole,
        requestNote: partyJoinRequestNote.trim() || undefined,
        recoveryCode: explorer.recoveryCode,
        idempotencyKey: idempotencyKey("web_party_request_join"),
      });
      await refreshProgress();
      setPartyRuns((await getEpochPartyRuns({ regionId })).partyRuns);
      commitRegionSnapshot(await getEpochRegionInfo(regionId));
    });
  }

  async function resolvePartyJoinRequest(
    partyRun: EpochPartyRun,
    requestId: string,
    resolution: "approved" | "rejected",
  ) {
    if (!canUseActiveIdentity || !explorer) return;
    await runAction("resolve-party-join-request", async () => {
      await resolveEpochPartyJoinRequest({
        partyRunId: partyRun.partyRunId,
        leaderAgentId: currentAgentId,
        requestId,
        resolution,
        recoveryCode: explorer.recoveryCode,
        idempotencyKey: idempotencyKey(`web_party_resolve_join_${resolution}`),
      });
      await refreshProgress();
      setPartyRuns((await getEpochPartyRuns({ regionId })).partyRuns);
      commitRegionSnapshot(await getEpochRegionInfo(regionId));
    });
  }

  async function rotatePartyInvite(partyRun: EpochPartyRun) {
    if (!canUseActiveIdentity || !explorer) return;
    const inviteToken = partyInviteToken.trim() || idempotencyKey("web_party_invite_token");
    await runAction("rotate-party-invite", async () => {
      await updateEpochPartyInvite({
        partyRunId: partyRun.partyRunId,
        leaderAgentId: currentAgentId,
        inviteToken,
        inviteTokenUseLimit: Math.max(1, partyInviteTokenUseLimit),
        inviteTokenExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        inviteRecipientAgentId: partyInviteRecipientAgentId.trim() || undefined,
        recoveryCode: explorer.recoveryCode,
        idempotencyKey: idempotencyKey("web_party_invite_rotate"),
      });
      setPartyInviteToken(inviteToken);
      await refreshProgress();
      setPartyRuns((await getEpochPartyRuns({ regionId })).partyRuns);
      commitRegionSnapshot(await getEpochRegionInfo(regionId));
    });
  }

  async function revokePartyInvite(partyRun: EpochPartyRun) {
    if (!canUseActiveIdentity || !explorer) return;
    await runAction("revoke-party-invite", async () => {
      await updateEpochPartyInvite({
        partyRunId: partyRun.partyRunId,
        leaderAgentId: currentAgentId,
        revoke: true,
        recoveryCode: explorer.recoveryCode,
        idempotencyKey: idempotencyKey("web_party_invite_revoke"),
      });
      await refreshProgress();
      setPartyRuns((await getEpochPartyRuns({ regionId })).partyRuns);
      commitRegionSnapshot(await getEpochRegionInfo(regionId));
    });
  }

  async function settlePartyRun(partyRun: EpochPartyRun) {
    if (!operatorKey.trim()) return;
    await runAction("settle-party-run", async () => {
      await settleEpochPartyRun({
        partyRunId: partyRun.partyRunId,
        operatorKey: operatorKey.trim(),
        idempotencyKey: idempotencyKey("web_party_settle"),
      });
      await refreshProgress();
      setPartyRuns((await getEpochPartyRuns({ regionId })).partyRuns);
      commitRegionSnapshot(await getEpochRegionInfo(regionId));
    });
  }

  async function loadRaids() {
    await runAction("raids", async () => {
      setRaids((await getEpochRaids(regionId)).raids);
    });
  }

  async function resolveRaid() {
    if (!canUseActiveIdentity || !defenderAgentId.trim() || !explorer) return;
    await runAction("resolve-raid", async () => {
      await resolveEpochRaid({
        regionId,
        attackerAgentId: currentAgentId,
        defenderAgentId: defenderAgentId.trim(),
        staminaSpent: raidStamina,
        recoveryCode: explorer.recoveryCode,
        idempotencyKey: idempotencyKey("web_raid_resolve"),
      });
      await refreshProgress();
      setRaids((await getEpochRaids(regionId)).raids);
    });
  }

  async function resolveRetaliation() {
    if (!canUseActiveIdentity || !primaryRetaliation || !explorer) return;
    await runAction("resolve-retaliation", async () => {
      await resolveEpochRetaliation({
        retaliationId: primaryRetaliation.retaliationId,
        opportunityAgentId: currentAgentId,
        staminaSpent: retaliationStamina,
        recoveryCode: explorer.recoveryCode,
        idempotencyKey: idempotencyKey("web_retaliation_resolve"),
      });
      await refreshProgress();
      commitRegionSnapshot(await getEpochRegionInfo(regionId));
    });
  }

  async function resolveRegionRevolt() {
    if (!canUseActiveIdentity || !primarySeason || !explorer) return;
    await runAction("resolve-region-revolt", async () => {
      await resolveEpochRegionRevolt({
        regionId,
        seasonId: primarySeason.seasonId,
        factionId: seasonFactionId,
        agentId: currentAgentId,
        staminaSpent: revoltStamina,
        recoveryCode: explorer.recoveryCode,
        idempotencyKey: idempotencyKey("web_region_revolt"),
      });
      await refreshProgress();
      const nextRegion = await getEpochRegionInfo(regionId);
      commitRegionSnapshot(nextRegion);
    });
  }

  async function loadRelationships() {
    await runAction("relationships", async () => {
      setRelationships((await getEpochRelationships(currentAgentId || undefined)).relationships);
    });
  }

  async function updateRelationship() {
    if (!canUseActiveIdentity || !relationshipTargetAgentId.trim() || !explorer) return;
    await runAction("update-relationship", async () => {
      await updateEpochRelationship({
        sourceAgentId: currentAgentId,
        targetAgentId: relationshipTargetAgentId.trim(),
        kind: relationshipKind,
        focusSpent: relationshipFocus,
        reason: `web_${relationshipKind}`,
        recoveryCode: explorer.recoveryCode,
        idempotencyKey: idempotencyKey("web_relationship_update"),
      });
      await refreshProgress();
      setRelationships((await getEpochRelationships(currentAgentId)).relationships);
    });
  }

  async function loadDiplomacy() {
    await runAction("diplomacy", async () => {
      setDiplomacy((await getEpochDiplomacy({
        regionId,
        agentId: currentAgentId || undefined,
      })).diplomacy);
    });
  }

  async function proposeDiplomacy() {
    if (!canUseActiveIdentity || !relationshipTargetAgentId.trim() || !explorer) return;
    await runAction("propose-diplomacy", async () => {
      await proposeEpochDiplomacy({
        regionId,
        sourceAgentId: currentAgentId,
        targetAgentId: relationshipTargetAgentId.trim(),
        kind: relationshipKind,
        focusSpent: relationshipFocus,
        terms: diplomacyTerms.trim() || `web_${relationshipKind}`,
        recoveryCode: explorer.recoveryCode,
        idempotencyKey: idempotencyKey("web_diplomacy_propose"),
      });
      await refreshProgress();
      const nextRegion = await getEpochRegionInfo(regionId);
      commitRegionSnapshot(nextRegion);
    });
  }

  async function respondDiplomacy(response: "accepted" | "rejected") {
    if (!primaryDiplomacy || !canUseActiveIdentity || !explorer) return;
    await runAction("respond-diplomacy", async () => {
      await respondEpochDiplomacy({
        diplomacyId: primaryDiplomacy.diplomacyId,
        responderAgentId: currentAgentId,
        response,
        focusSpent: response === "accepted" ? diplomacyResponseFocus : 0,
        note: `web_${response}`,
        recoveryCode: explorer.recoveryCode,
        idempotencyKey: idempotencyKey(`web_diplomacy_${response}`),
      });
      await refreshProgress();
      const nextRegion = await getEpochRegionInfo(regionId);
      commitRegionSnapshot(nextRegion);
      setRelationships((await getEpochRelationships(currentAgentId)).relationships);
    });
  }

  async function loadHostedSessions() {
    if (!currentAgentId) return;
    await runAction("hosted-sessions", async () => {
      setHostedSessions((await getEpochHostedSessions(currentAgentId)).sessions);
    });
  }

  async function startHostedSession() {
    if (!canUseActiveIdentity || !explorer) return;
    await runAction("hosted-start", async () => {
      const session = await startEpochHostedSession({
        agentId: currentAgentId,
        regionId,
        mandate: withLowStimulusGuidance(hostedMandate, lowStimulusMode),
        recoveryCode: explorer.recoveryCode,
        idempotencyKey: idempotencyKey("web_hosted_start"),
      });
      setHostedSessions([session.value, ...(await getEpochHostedSessions(currentAgentId)).sessions.filter((item) => item.sessionId !== session.value.sessionId)]);
      resetInterventionBudgetForNewRun();
      await refreshProgress();
    });
  }

  async function runCompleteExploration() {
    if (!canUseActiveIdentity || !explorer) return;
    await runAction("complete-exploration", async () => {
      const run = await runEpochExploration({
        agentId: currentAgentId,
        regionId,
        mandate: withLowStimulusGuidance("一次完整探索：连续推进多个安全探索节点，并生成可分享结果页。", lowStimulusMode),
        stepCount: 8,
        recoveryCode: explorer.recoveryCode,
        idempotencyKey: idempotencyKey("web_one_shot_run"),
      });
      const sessions = run.value.sessions || [];
      const completedSessionIds = new Set(sessions.map((session) => session.sessionId));
      setHostedSessions([
        ...sessions,
        ...(await getEpochHostedSessions(currentAgentId)).sessions.filter((session) => !completedSessionIds.has(session.sessionId)),
      ]);
      setSharedResultPage(run.value.resultPage);
      setLastExplorationMetrics(normalizeExplorationMetrics(run.value.metrics));
      if (run.value.resultPage.payload) setResultPage(normalizeResultPage(run.value.resultPage.payload));
      resetInterventionBudgetForNewRun();
      await refreshProgress();
    });
  }

  async function submitHostedAction(option: EpochHostedActionOption) {
    if (!canUseActiveIdentity || !explorer || !primaryHostedSession) return;
    await runAction("hosted-action", async () => {
      await submitEpochHostedAction({
        sessionId: primaryHostedSession.sessionId,
        actionOptionId: option.actionOptionId,
        visibleText: withLowStimulusGuidance(hostedVisibleText, lowStimulusMode),
        clientDeclaredOutcome: "ignored_by_server",
        recoveryCode: explorer.recoveryCode,
        idempotencyKey: idempotencyKey("web_hosted_action"),
      });
      setHostedSessions((await getEpochHostedSessions(currentAgentId)).sessions);
      await refreshProgress();
    });
  }

  async function runServerHostedAction() {
    if (!canUseActiveIdentity || !operatorKey.trim()) return;
    await runAction("server-hosted-action", async () => {
      const result = await runEpochServerHostedAction({
        operatorKey: operatorKey.trim(),
        agentId: currentAgentId,
        regionId,
        mandate: withLowStimulusGuidance(hostedMandate, lowStimulusMode),
        visibleText: withLowStimulusGuidance(hostedVisibleText, lowStimulusMode),
        optionKey: serverHostedOptionKey,
        idempotencyKey: idempotencyKey("web_server_hosted_action"),
      });
      setLastServerHostedRun(result.value);
      setHostedSessions((await getEpochHostedSessions(currentAgentId)).sessions);
      await refreshProgress();
    });
  }

  async function loadServerHostedJobs() {
    if (!operatorKey.trim()) return;
    await runAction("server-hosted-jobs", async () => {
      setServerHostedJobs((await getEpochServerHostedJobs({
        operatorKey: operatorKey.trim(),
        agentId: currentAgentId || undefined,
      })).jobs);
    });
  }

  async function queueServerHostedAction() {
    if (!canUseActiveIdentity || !operatorKey.trim()) return;
    await runAction("server-hosted-queue", async () => {
      await queueEpochServerHostedAction({
        operatorKey: operatorKey.trim(),
        agentId: currentAgentId,
        regionId,
        mandate: withLowStimulusGuidance(hostedMandate, lowStimulusMode),
        visibleText: withLowStimulusGuidance(hostedVisibleText, lowStimulusMode),
        optionKey: serverHostedOptionKey,
        idempotencyKey: idempotencyKey("web_server_hosted_queue"),
      });
      setServerHostedJobs((await getEpochServerHostedJobs({
        operatorKey: operatorKey.trim(),
        agentId: currentAgentId,
      })).jobs);
    });
  }

  async function runServerHostedJob(jobId?: string) {
    if (!operatorKey.trim()) return;
    await runAction("server-hosted-job", async () => {
      const result = await runEpochServerHostedJob({
        operatorKey: operatorKey.trim(),
        jobId,
        agentId: currentAgentId || undefined,
        idempotencyKey: idempotencyKey("web_server_hosted_job"),
      });
      setLastServerHostedRun(result.value.run || null);
      setServerHostedJobs((await getEpochServerHostedJobs({
        operatorKey: operatorKey.trim(),
        agentId: currentAgentId || result.value.job.agentId,
      })).jobs);
      setHostedSessions((await getEpochHostedSessions(result.value.job.agentId)).sessions);
      await refreshProgress(result.value.job.agentId);
    });
  }

  async function postServerHostedWorldMessage() {
    if (!canUseActiveIdentity || !operatorKey.trim() || !messageBody.trim()) return;
    await runAction("server-hosted-world-message", async () => {
      await postEpochMessage({
        operatorKey: operatorKey.trim(),
        agentId: currentAgentId,
        scope: "world",
        body: messageBody,
        idempotencyKey: idempotencyKey("web_server_hosted_world_message"),
      });
      setMessageBody("");
      await refreshProgress();
      const [nextRegion, messages] = await Promise.all([
        getEpochRegionInfo(regionId),
        getEpochMessages(regionId),
      ]);
      commitRegionSnapshot(nextRegion, { messages: messages.regionMessages });
    });
  }

  async function startWebBridgeTurn() {
    if (!canUseActiveIdentity || !explorer) return;
    await runAction("web-bridge-turn", async () => {
      const turn = await startEpochWebBridgeTurn({
        agentId: currentAgentId,
        regionId,
        mandate: withLowStimulusGuidance(hostedMandate, lowStimulusMode),
        recoveryCode: explorer.recoveryCode,
        idempotencyKey: idempotencyKey("web_bridge_turn"),
      });
      setWebBridgeTurn(turn.value);
      setHostedSessions((await getEpochHostedSessions(currentAgentId)).sessions);
      resetInterventionBudgetForNewRun();
      await refreshProgress();
    });
  }

  async function copyWebBridgePrompt() {
    if (!webBridgeTurn) return;
    await runAction("web-bridge-copy", async () => {
      await navigator.clipboard.writeText(webBridgeTurn.copyPrompt);
    });
  }

  async function submitWebBridgeAction(option: EpochWebBridgeActionOption) {
    if (!canUseActiveIdentity || !explorer || !webBridgeTurn) return;
    await runAction("web-bridge-action", async () => {
      const submitted = await submitEpochWebBridgeAction({
        sessionId: webBridgeTurn.sessionId,
        actionOptionId: option.actionOptionId,
        visibleText: withLowStimulusGuidance(hostedVisibleText, lowStimulusMode),
        clientDeclaredOutcome: "ignored_by_server",
        recoveryCode: explorer.recoveryCode,
        idempotencyKey: idempotencyKey("web_bridge_action"),
      });
      setLastWebBridgeAction(submitted.value);
      setWebBridgeTurn(null);
      setHostedSessions((await getEpochHostedSessions(currentAgentId)).sessions);
      await refreshProgress();
    });
  }

  async function createTurnCard() {
    if (!canUseActiveIdentity || !explorer) return;
    await runAction("turn-card", async () => {
      const result = await createEpochTurnCard({
        agentId: currentAgentId,
        regionId,
        prompt: withLowStimulusGuidance(turnPrompt, lowStimulusMode),
        recoveryCode: explorer.recoveryCode,
        idempotencyKey: idempotencyKey("web_turn_card"),
      });
      setCurrentTurnCard(result.value);
      resetInterventionBudgetForNewRun();
      await refreshProgress();
    });
  }

  async function createTurnCardWithConfirmation() {
    if (!canUseActiveIdentity || !confirmationToken.trim()) return;
    await runAction("turn-card-token", async () => {
      const result = await createEpochTurnCard({
        agentId: currentAgentId,
        regionId,
        prompt: withLowStimulusGuidance(turnPrompt, lowStimulusMode),
        confirmationToken,
        idempotencyKey: idempotencyKey("web_turn_card_token"),
      });
      setCurrentTurnCard(result.value);
      setConfirmationToken("");
      setHighValueConfirmation(null);
      resetInterventionBudgetForNewRun();
      await refreshProgress();
    });
  }

  async function resolveTurnCard(option: EpochTurnActionOption) {
    if (!canUseActiveIdentity || !explorer || !currentTurnCard) return;
    await runAction("resolve-turn", async () => {
      const result = await resolveEpochTurn({
        turnCardId: currentTurnCard.turnCardId,
        sequence: currentTurnCard.sequence,
        nonce: currentTurnCard.nonce,
        actionOptionId: option.actionOptionId,
        visibleText: withLowStimulusGuidance(turnVisibleText, lowStimulusMode),
        clientDeclaredOutcome: "ignored_by_server",
        recoveryCode: explorer.recoveryCode,
        idempotencyKey: idempotencyKey("web_resolve_turn"),
      });
      setCurrentTurnCard((previous) => previous ? {
        ...previous,
        status: "resolved",
        resolvedAt: result.value.resolvedAt,
        resolution: result.value,
      } : previous);
      await refreshProgress();
    });
  }

  async function requestResolveTurnConfirmation(option: EpochTurnActionOption) {
    if (!canUseActiveIdentity || !currentTurnCard || currentTurnCard.status !== "open") return;
    if (option.risk === "high" && !isRiskPackageAuthorized("resolve_turn")) {
      stageHighRiskPackage({
        kind: "resolve_turn",
        label: option.label,
      });
      return;
    }
    await runAction("request-resolve-confirmation", async () => {
      const requested = await requestEpochConfirmation({
        action: "resolve_turn",
        agentId: currentTurnCard.agentId,
        turnCardId: currentTurnCard.turnCardId,
        sequence: currentTurnCard.sequence,
        nonce: currentTurnCard.nonce,
        actionOptionId: option.actionOptionId,
        visibleText: withLowStimulusGuidance(turnVisibleText, lowStimulusMode),
        summary: `结算回合卡 ${option.label}: ${withLowStimulusGuidance(turnVisibleText, lowStimulusMode)}`,
        idempotencyKey: idempotencyKey("web_resolve_confirmation"),
      });
      setHighValueConfirmation(requested.confirmation);
      setConfirmationToken("");
    });
  }

  async function resolveTurnCardWithConfirmation(option: EpochTurnActionOption) {
    if (!canUseActiveIdentity || !currentTurnCard || !confirmationToken.trim()) return;
    await runAction("resolve-turn-token", async () => {
      const result = await resolveEpochTurn({
        turnCardId: currentTurnCard.turnCardId,
        sequence: currentTurnCard.sequence,
        nonce: currentTurnCard.nonce,
        actionOptionId: option.actionOptionId,
        visibleText: withLowStimulusGuidance(turnVisibleText, lowStimulusMode),
        clientDeclaredOutcome: "ignored_by_server",
        confirmationToken,
        idempotencyKey: idempotencyKey("web_resolve_turn_token"),
      });
      setCurrentTurnCard((previous) => previous ? {
        ...previous,
        status: "resolved",
        resolvedAt: result.value.resolvedAt,
        resolution: result.value,
      } : previous);
      setConfirmationToken("");
      setHighValueConfirmation(null);
      await refreshProgress();
    });
  }

  async function requestAttestationChallenge(option: EpochHostedActionOption) {
    if (!canUseActiveIdentity || !primaryHostedSession) return;
    await runAction("attestation-challenge", async () => {
      const nextChallenge = await createEpochAttestationChallenge({
        runnerId: attestedRunnerId,
        sessionId: primaryHostedSession.sessionId,
        actionOptionId: option.actionOptionId,
        transcriptHash: attestedTranscriptHash,
        idempotencyKey: idempotencyKey("web_attestation_challenge"),
      });
      setAttestationChallenge(nextChallenge.challenge);
    });
  }

  async function submitAttestedAction() {
    if (!canUseActiveIdentity || !attestationChallenge) return;
    await runAction("attested-action", async () => {
      await submitEpochAttestedAction({
        runnerId: attestationChallenge.runnerId,
        challengeId: attestationChallenge.challengeId,
        sessionId: attestationChallenge.sessionId,
        actionOptionId: attestationChallenge.actionOptionId,
        transcriptHash: attestationChallenge.transcriptHash,
        signature: attestedSignature,
        visibleText: withLowStimulusGuidance(hostedVisibleText, lowStimulusMode),
        idempotencyKey: idempotencyKey("web_attested_action"),
      });
      setAttestationChallenge(null);
      setAttestedSignature("");
      setHostedSessions((await getEpochHostedSessions(currentAgentId)).sessions);
      await refreshProgress();
    });
  }

  async function loadPublicWorld() {
    await runAction("world", async () => {
      setPublicWorld(await getPublicWorld());
    });
  }

  async function loadWorldOverview() {
    await runAction("world-overview", async () => {
      setWorldOverview(await getEpochWorldOverview({ limit: 6 }));
    });
  }

  async function loadResultPage() {
    if (!currentAgentId) return;
    await runAction("result", async () => {
      setResultPage(normalizeResultPage(await getEpochResultPage(currentAgentId)));
    });
  }

  async function publishResultPage() {
    if (!currentAgentId || !explorer) return;
    await runAction("publish-result", async () => {
      const preview = await getEpochResultPage(currentAgentId);
      const created = await createEpochResultPage({
        explorerId: explorer.explorerId,
        agentId: currentAgentId,
        publishToken: preview.publishToken,
        recoveryCode: explorer.recoveryCode,
        limit: 30,
        idempotencyKey: idempotencyKey("web_result_page"),
      });
      setSharedResultPage(created.page);
      if (created.page.payload) setResultPage(normalizeResultPage(created.page.payload));
    });
  }

  async function publishTurnResultPage() {
    if (!currentAgentId || !explorer || !currentTurnCard || currentTurnCard.status !== "resolved") return;
    await runAction("publish-turn-result", async () => {
      const preview = await getEpochResultPage({
        explorerId: explorer.explorerId,
        agentId: currentAgentId,
        turnCardId: currentTurnCard.turnCardId,
        limit: 30,
      });
      const created = await createEpochResultPage({
        explorerId: explorer.explorerId,
        agentId: currentAgentId,
        turnCardId: currentTurnCard.turnCardId,
        publishToken: preview.publishToken,
        recoveryCode: explorer.recoveryCode,
        limit: 30,
        idempotencyKey: idempotencyKey("web_turn_result_page"),
      });
      setSharedResultPage(created.page);
      if (created.page.payload) setResultPage(normalizeResultPage(created.page.payload));
    });
  }

  async function publishWebBridgeResultPage() {
    if (!currentAgentId || !explorer || !lastWebBridgeAction) return;
    await runAction("publish-web-bridge-result", async () => {
      const preview = await getEpochResultPage({
        explorerId: explorer.explorerId,
        agentId: currentAgentId,
        hostedSessionId: lastWebBridgeAction.action.sessionId,
        limit: 30,
      });
      const created = await createEpochResultPage({
        explorerId: explorer.explorerId,
        agentId: currentAgentId,
        hostedSessionId: lastWebBridgeAction.action.sessionId,
        publishToken: preview.publishToken,
        recoveryCode: explorer.recoveryCode,
        limit: 30,
        idempotencyKey: idempotencyKey("web_bridge_result_page"),
      });
      setSharedResultPage(created.page);
      if (created.page.payload) setResultPage(normalizeResultPage(created.page.payload));
    });
  }

  async function revokeSharedResultPage() {
    if (!sharedResultPage || !explorer || sharedResultPage.status === "revoked") return;
    await runAction("revoke-result", async () => {
      const revoked = await revokeEpochResultPage({
        pageId: sharedResultPage.pageId,
        recoveryCode: explorer.recoveryCode,
        reason: "owner_hidden_from_console",
        idempotencyKey: idempotencyKey("web_revoke_result_page"),
      });
      setSharedResultPage(revoked.page);
      if (revoked.page.payload) setResultPage(normalizeResultPage(revoked.page.payload));
      await loadWorldOverview();
    });
  }

  async function loadInstallManifest() {
    await runAction("install", async () => {
      const [status, manifest] = await Promise.all([
        getEpochInstallStatus(),
        getEpochInstallManifest(),
      ]);
      setInstallStatus(status);
      setInstallManifest(manifest);
    });
  }

  async function loadInstallStatus() {
    await runAction("install-status", async () => {
      setInstallStatus(await getEpochInstallStatus());
      setInstallStatusError("");
    });
  }

  async function downloadInstallManifest() {
    await runAction("download", async () => {
      const manifest = installManifest || await getEpochInstallManifest();
      setInstallManifest(manifest);
      downloadJson("obsidian-epoch-install-manifest.json", manifest);
    });
  }

  async function downloadPackage() {
    await runAction("download-package", async () => {
      const archive = await downloadEpochPackage();
      downloadBlob("obsidian-epoch-agent-world-0.1.0-alpha.tar.gz", archive);
    });
  }

  return (
    <main className="agent-explorer">
      <header className="agent-topbar">
        <div>
          <strong>黑曜纪元行动控制台</strong>
          <span>{AGENT_SERVER_BASE}</span>
        </div>
        <button type="button" onClick={onBack}>返回地图</button>
      </header>

      <section
        className={`agent-live-status${busyAction ? " is-busy" : ""}`}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        aria-label="行动实时状态"
      >
        <span className={currentAgentId ? "is-ready" : "is-waiting"}>
          <small>当前身份</small>
          <strong title={liveIdentityValue}>{liveIdentityValue}</strong>
        </span>
        <span className={installStatusError ? "is-blocked" : installStatus?.ok ? "is-ready" : "is-waiting"}>
          <small>安装连接</small>
          <strong title={installReadiness.server}>{installReadiness.server}</strong>
        </span>
        <span className={busyAction || activeHostedSession || progress?.downtime?.active || queuedServerHostedJobCount ? "is-ready" : "is-waiting"}>
          <small>{busyAction ? "当前操作" : "托管状态"}</small>
          <strong title={liveActivityValue}>{liveActivityValue}</strong>
        </span>
        <span className={error || installStatusError ? "is-blocked" : busyAction ? "is-ready" : "is-waiting"}>
          <small>最近请求</small>
          <strong title={lastAgentRequest}>{lastAgentRequest}</strong>
        </span>
      </section>

      {initialSurface === "web-bridge" ? (
        <WebBridgePlaySurface
          currentAgentId={currentAgentId}
          hostedMandate={hostedMandate}
          hostedVisibleText={hostedVisibleText}
          identityDisabledReason={playerIdentityActionDisabledReason}
          isBusy={isBusy}
          lastAction={lastWebBridgeAction}
          onCopyPrompt={copyWebBridgePrompt}
          onIssueIdentity={issueIdentity}
          onPublishResult={publishWebBridgeResultPage}
          onStartTurn={startWebBridgeTurn}
          onSubmitAction={submitWebBridgeAction}
          regionLabel={playerRegionLabel(regionId)}
          resultPublishAuthorizationCopy={RESULT_PUBLISH_AUTHORIZATION_COPY}
          setHostedMandate={setHostedMandate}
          setHostedVisibleText={setHostedVisibleText}
          webBridgeTurn={webBridgeTurn}
        />
      ) : null}

      {initialSurface !== "web-bridge" ? <section className="agent-player-mode" aria-labelledby="agent-player-mode-title">
        <div className="agent-player-copy" data-first-screen-block="intro">
          <span>黑曜纪元等候探索</span>
          <h1 id="agent-player-mode-title">等待写代码时，让你的行动身份在黑曜纪元行动</h1>
          <p>安装本地插件后，先开始身份，再选择托管行动。你可以随时回来查看身份、世界新闻、公开结果和服务器判定。</p>
        </div>
        <div className="agent-player-actions" aria-label="玩家常用操作" data-first-screen-block="actions">
          <div className="agent-player-action">
            <button
              type="button"
              aria-describedby={playerIdentityActionDisabledReason ? "agent-player-action-identity-reason" : undefined}
              disabled={Boolean(playerIdentityActionDisabledReason)}
              onClick={currentAgentId ? () => void runAction("refresh", () => refreshProgress()) : issueIdentity}
            >
              开始/继续身份
            </button>
            {playerIdentityActionDisabledReason ? (
              <small id="agent-player-action-identity-reason" className="agent-player-action-disabled-reason">
                {playerIdentityActionDisabledReason}
              </small>
            ) : null}
          </div>
          <div className="agent-player-action">
            <button
              type="button"
              aria-describedby={playerDowntimeActionDisabledReason ? "agent-player-action-downtime-reason" : undefined}
              disabled={Boolean(playerDowntimeActionDisabledReason)}
              onClick={startStarterCommission}
            >
              选择托管行动
            </button>
            {playerDowntimeActionDisabledReason ? (
              <small id="agent-player-action-downtime-reason" className="agent-player-action-disabled-reason">
                {playerDowntimeActionDisabledReason}
              </small>
            ) : null}
          </div>
          <div className="agent-player-action">
            <button
              id="epoch-one-shot-run"
              type="button"
              aria-describedby={playerCompleteRunActionDisabledReason ? "agent-player-action-complete-run-reason" : undefined}
              disabled={Boolean(playerCompleteRunActionDisabledReason)}
              onClick={runCompleteExploration}
            >
              一次跑完整局
            </button>
            {playerCompleteRunActionDisabledReason ? (
              <small id="agent-player-action-complete-run-reason" className="agent-player-action-disabled-reason">
                {playerCompleteRunActionDisabledReason}
              </small>
            ) : null}
          </div>
          <div className="agent-player-action">
            <button
              type="button"
              aria-describedby={playerResultActionDisabledReason ? "agent-player-action-result-reason" : undefined}
              disabled={Boolean(playerResultActionDisabledReason)}
              onClick={currentAgentId ? loadResultPage : loadWorldOverview}
            >
              查看结果/公开世界
            </button>
            {playerResultActionDisabledReason ? (
              <small id="agent-player-action-result-reason" className="agent-player-action-disabled-reason">
                {playerResultActionDisabledReason}
              </small>
            ) : null}
          </div>
          <div className="agent-player-action">
            <button
              type="button"
              aria-describedby={playerInstallStatusActionDisabledReason ? "agent-player-action-install-reason" : undefined}
              disabled={Boolean(playerInstallStatusActionDisabledReason)}
              onClick={loadInstallStatus}
            >
              检查安装状态
            </button>
            {playerInstallStatusActionDisabledReason ? (
              <small id="agent-player-action-install-reason" className="agent-player-action-disabled-reason">
                {playerInstallStatusActionDisabledReason}
              </small>
            ) : null}
          </div>
        </div>
        <section className="agent-player-watch" aria-label="玩家等候看板" data-first-screen-block="watch">
          <div className="agent-player-watch-next" aria-label="回访摘要">
            <span>单句下一步</span>
            <strong>
              {!currentAgentId
                ? "下一步：开始/继续身份，让服务器签发一个可托管的行动身份。"
                : !actionEligibility?.canUseActiveTools
                  ? `下一步：${actionEligibility?.reason || "等待身份恢复后再行动。"}`
                  : progress?.pendingDowntime
                    ? "下一步：领取托管收益，或继续等下一次服务器 tick。"
                    : primaryBriefingAction
                      ? `下一步：${primaryBriefingAction.label}，${primaryBriefingAction.reason}`
                    : primaryHostedSession?.status === "active"
                      ? "下一步：观察托管实况，满意后生成公开结果。"
                      : "下一步：选择托管行动，让行动身份在你等待时推进世界。"}
            </strong>
            <small>
              最近请求：{lastAgentRequest} · 连接状态：{installReadiness.lastRequest}
              {agentBriefing ? ` · 简报：${playerRegionLabel(agentBriefing.regionId || regionId)} · ${agentBriefing.regionalContext?.news.length || 0} 新闻 · ${agentBriefing.regionalContext?.messages.length || 0} 留言` : ""}
              {agentBriefingSyncedAt ? ` · 自动刷新 ${formatDate(agentBriefingSyncedAt)}` : ""}
            </small>
            <button
              type="button"
              className="agent-revisit-primary-action"
              aria-label={`回访主按钮：${revisitPrimaryAction.kind}`}
              disabled={revisitPrimaryAction.disabled}
              onClick={runRevisitPrimaryAction}
            >
              {revisitPrimaryAction.label}
            </button>
            {agentBriefing?.publicPages.agent ? (
              <a className="agent-player-watch-link" href={`${AGENT_SERVER_BASE}${agentBriefing.publicPages.agent}`} target="_blank" rel="noreferrer">
                公开进度页
              </a>
            ) : null}
          </div>
          {frontstageStatus?.worldAnnouncement.visible ? (
            <div className="agent-frontstage-announcement" role="status" aria-label="世界运行公告">
              <strong>{frontstageStatus?.worldAnnouncement.title || "档案馆审档暂停/只读维护"}</strong>
              <span>{frontstageStatus?.worldAnnouncement.body}</span>
              <small>
                {frontstageStatus?.allowedActions.localTrial ? "本地试玩可继续" : ""}
                {frontstageStatus?.allowedActions.localTrial && frontstageStatus?.allowedActions.archiveLocalReport ? " · " : ""}
                {frontstageStatus?.allowedActions.archiveLocalReport ? "本地封存可继续" : ""}
                {" · 数据没有丢失"}
              </small>
            </div>
          ) : null}
          <div className="agent-player-world-goals" aria-label="世界内目标">
            <b>世界内目标</b>
            {WORLD_INTERNAL_GOALS.map((goal) => (
              <span key={`${goal.scope}-${goal.title}`} className={goal.scope === "长期" ? "is-long" : undefined}>
                <em>{goal.scope}</em>
                <strong>{goal.title}</strong>
                <small>{goal.unlock} · {goal.proof}</small>
              </span>
            ))}
          </div>
          <div className="agent-player-watch-lights" aria-label="等待状态灯">
            <span className={installStatusError ? "is-blocked" : installStatus?.ok ? "is-ready" : installStatus ? "is-blocked" : "is-waiting"}>
              <b>安装</b>
              <em>{installStatusError ? "连接失败" : installStatus?.ok ? "已连接" : installStatus ? "需检查" : "待检查"}</em>
              <small>
                {installStatusError
                  ? installStatusError
                  : installStatus?.package.bytes !== undefined
                  ? "本地服务已连接；安装包可下载。"
                  : "检查后显示安装入口。"}
              </small>
              {installStatusError ? <button type="button" disabled={isBusy} onClick={loadInstallStatus}>重试安装状态</button> : null}
            </span>
            <span className={installStatus?.smoke.status === "not_run" ? "is-waiting" : installStatus ? "is-ready" : "is-waiting"}>
              <b>验收</b>
              <em>{installStatus?.smoke.status === "not_run" ? "待运行" : installStatus?.smoke.status ? "已记录" : "待检查"}</em>
              <small>{installStatus?.smoke.status === "not_run" ? "运行安装验收后显示状态。" : "安装链路已记录。"}</small>
            </span>
            <span className={actionEligibility?.canUseActiveTools ? "is-ready" : currentAgentId ? "is-waiting" : "is-blocked"}>
              <b>身份</b>
              <em>{actionEligibility?.canUseActiveTools ? "可行动" : currentAgentId ? playerIdentityStatusLabel(actionEligibility?.status) : "未签发"}</em>
              <small>{identity?.identityName || installReadiness.identityId}</small>
            </span>
            <span className={primaryHostedSession || progress?.downtime?.active || serverHostedJobs.some((job) => job.status === "queued") ? "is-ready" : "is-waiting"}>
              <b>托管</b>
              <em>{primaryHostedSession ? playerHostedStatusLabel(primaryHostedSession.status) : progress?.downtime?.active ? "托管中" : serverHostedJobs.some((job) => job.status === "queued") ? "排队中" : "待选择"}</em>
              <small>{primaryHostedSession?.mandate || (progress?.downtime?.active ? `托管：${playerDowntimeLabel(progress.downtime.mode)}` : `${serverHostedJobs.filter((job) => job.status === "queued").length} 条行动待执行`)}</small>
            </span>
            <span className={resultPage || sharedResultPage || worldOverview ? "is-ready" : "is-waiting"}>
              <b>公开结果</b>
              <em>{resultPage ? "已生成" : sharedResultPage ? "链接已生成" : worldOverview ? "世界可见" : "待刷新"}</em>
              <small>{resultPage ? `结果页 ${formatDate(resultPage.generatedAt)}` : worldOverview ? "公开世界可查看" : worldOverviewPage}</small>
            </span>
          </div>
          <div className="agent-player-watch-glimpse" aria-label="托管姿态与收益">
            <span>
              <b>{primaryHostedSession?.mandate || `当前姿态：${playerDowntimeLabel(progress?.downtime?.mode || downtimeMode)}`}</b>
              <small>
                {progress?.pendingDowntime
                  ? `${rewardSummary(progress.pendingDowntime.rewards)} · ${Math.floor(progress.pendingDowntime.elapsedSeconds / 60)} 分钟${progress.pendingDowntime.capped ? " · 已封顶" : ""}`
                  : primaryHostedSession
                    ? `${primaryHostedSession.actionOptions.length} 个选项 · ${primaryHostedSession.actions.length} 条行动`
                    : `${serverHostedJobs.filter((job) => job.status === "queued").length} 条行动待执行`}
              </small>
            </span>
            <span>
              <b>收益预览</b>
              <small>
                {progress?.pendingDowntime?.riskWarnings.length
                  ? progress.pendingDowntime.riskWarnings.slice(0, 2).join(" / ")
                  : progress?.pendingDowntime
                    ? "暂无额外风险提示"
                    : "开始托管后显示服务器预估收益。"}
              </small>
            </span>
          </div>
          <div className="agent-player-watch-live" aria-label="最近实况">
            <b>最近实况</b>
            {(agentBriefing?.pendingActions || []).slice(0, 2).map((action) => (
              <span key={action.actionId}>
                <em>{action.label}</em>
                <small>{playerToolLabel(action.toolName)} · {playerRegionLabel(action.regionId || agentBriefing?.regionId)}</small>
              </span>
            ))}
            {(progress?.downtimeDiaryEntries || []).slice(0, 2).map((entry) => (
              <span key={entry.diaryId}>
                <em>{entry.phase === "tick" ? "托管巡检" : "托管领取"}</em>
                <small>{entry.title} · {formatDate(entry.occurredAt)}</small>
              </span>
            ))}
            {(progress?.latestEvents || []).slice(0, Math.max(1, 3 - (progress?.downtimeDiaryEntries?.length || 0))).map((event) => (
              <span key={event.eventId}>
                <em>{playerEventLabel(event)}</em>
                <small>{playerEventDetail(event)}</small>
              </span>
            ))}
            {!(((agentBriefing?.pendingActions || []).length) || (progress?.downtimeDiaryEntries || []).length || (progress?.latestEvents || []).length) ? <span><em>待同步</em><small>刷新进度后显示服务器实况。</small></span> : null}
          </div>
        </section>
        <section className="agent-player-quick-panel" aria-label="首屏快速面板" data-first-screen-block="quick-panel">
          <div className="agent-player-key-proof" aria-label="模型密钥安全证明">
            <span>
              <b>模型密钥安全</b>
              <small>本地调用：浏览器 → 本地插件 → 你的模型；网络请求不含模型密钥。</small>
            </span>
            <span>
              <b>演示模式</b>
              <small>{DEMO_CONTRACT.mandate} · 本地样例 · 不可上传 · 不可结算 · 不进图谱。</small>
              <button type="button" aria-label="本地演示模式" onClick={runLocalDemoMode}>
                运行本地演示
              </button>
            </span>
          </div>
          <div className="agent-key-privacy-preflight" aria-label="首次模型调用隐私提示">
            <span>
              <b>首次模型调用前</b>
              <small>{SENSITIVE_KEY_CALL_NOTICE}</small>
            </span>
            <label className="agent-key-compliance-toggle">
              <input
                type="checkbox"
                aria-label="高刺激年龄地区合规"
                checked={highStimulusComplianceConfirmed}
                onChange={(event) => setHighStimulusComplianceConfirmed(event.currentTarget.checked)}
              />
              <span>
                <b>年龄/地区合规</b>
                <small>高刺激内容前确认年龄与所在地区规则；不确定时保持低刺激模式或停止外发。</small>
              </span>
            </label>
            <label className="agent-key-region-select">
              <span>地区</span>
              <select
                aria-label="内容合规地区"
                value={contentPolicyRegion}
                onChange={(event) => setContentPolicyRegion(event.currentTarget.value as typeof contentPolicyRegion)}
              >
                {HIGH_STIMULUS_COMPLIANCE_REGIONS.map((region) => (
                  <option key={region.value} value={region.value}>{region.label}</option>
                ))}
              </select>
            </label>
          </div>
          {demoModeReport ? (
            <div className="agent-player-demo-report" aria-label="本地演示样例">
              <span>
                <b>{demoModeReport.title}</b>
                <small>{demoModeReport.mandate}</small>
              </span>
              <span>
                <b>锚点</b>
                <small>{demoModeReport.anchors.join(" / ")}</small>
              </span>
              <span aria-label="可入档发现">
                <b>{FRONTSTAGE_LORE_OUTPUT_LABEL}</b>
                <small className="agent-frontstage-discovery">{frontstageDiscoverySummary(demoModeReport.discoveries)}</small>
              </span>
              <span>
                <b>隔离</b>
                <small>
                  {demoModeReport.isolation.uploadable ? "可上传" : "不可上传"} · {demoModeReport.isolation.settleable ? "可结算" : "不可结算"} · {demoModeReport.isolation.reputationEligible ? "获得声望" : "不获得声望"} · {demoModeReport.isolation.graphEligible ? "进入图谱" : "不进入图谱"}
                </small>
              </span>
            </div>
          ) : null}
          <div className="agent-player-starter-commission" aria-label="档案馆推荐委托">
            <span>
              <b>档案馆推荐委托</b>
              <small>{selectedStarterRiskPreference.mandate} · {STARTER_SECRET_EXPOSURE_POLICY.summary}</small>
            </span>
          </div>
          <div className="agent-player-starter-protection" aria-label="首局非永久死亡保护">
            <span>
              <b>{STARTER_DEATH_PROTECTION.label}</b>
              <small>{STARTER_DEATH_PROTECTION.summary}</small>
            </span>
            <span>
              <b>风险边界</b>
              <small>{STARTER_DEATH_PROTECTION.escalation}</small>
            </span>
          </div>
          <div className="agent-player-starter-reward-isolation" aria-label="首局收益隔离">
            <span>
              <b>{STARTER_REWARD_ISOLATION.label}</b>
              <small>{STARTER_REWARD_ISOLATION.summary}</small>
            </span>
            <span>
              <b>世界影响</b>
              <small>{STARTER_REWARD_ISOLATION.verification}</small>
            </span>
          </div>
          <div className="agent-player-risk-preferences" aria-label="首局风险偏好">
            {STARTER_RISK_PREFERENCE_OPTIONS.map((risk) => (
              <button
                key={risk.value}
                type="button"
                aria-pressed={starterRiskPreference === risk.value}
                disabled={isBusy}
                onClick={() => setStarterRiskPreference(risk.value)}
              >
                <b>{risk.label}</b>
                <small>{risk.caption}</small>
              </button>
            ))}
          </div>
          <div className="agent-player-downtime-modes" aria-label="托管行动选择">
            {PLAYER_DOWNTIME_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className="agent-player-downtime-card"
                aria-pressed={downtimeMode === option.value}
                disabled={isBusy}
                onClick={() => setDowntimeMode(option.value)}
              >
                <b>{option.label}</b>
                <small>{option.caption}</small>
              </button>
            ))}
          </div>
          <div className="agent-player-earnings" aria-label="托管收益">
            <span>
              <b>{progress?.pendingDowntime ? "预计托管收益" : "等待收益"}</b>
              <small>
                {progress?.pendingDowntime
                  ? `${rewardSummary(progress.pendingDowntime.rewards)} · 已托管 ${Math.floor(progress.pendingDowntime.elapsedSeconds / 60)} 分钟${progress.pendingDowntime.capped ? " · 已封顶" : ""}`
                  : "开始托管后，服务器会计算可领取资源和风险提示。"}
              </small>
            </span>
            <button type="button" disabled={isBusy || activeIdentityDisabled || !progress?.downtime?.active} onClick={claimDowntime}>
              领取托管收益
            </button>
          </div>
          <label className="agent-player-comfort">
            <input
              type="checkbox"
              aria-label="玩家模式低刺激模式"
              checked={lowStimulusMode}
              onChange={(event) => updateLowStimulusMode(event.currentTarget.checked)}
            />
            <span>
              <b>低刺激模式</b>
              <small>降低惊吓、闪烁和强恐怖描写，保留清晰退出路径。</small>
            </span>
          </label>
          <div className="agent-player-status" role="status" aria-label="玩家等待模式状态">
            <span>
              <b>身份</b>
              <em>{identity?.identityName || currentAgentId || "等待签发"}</em>
              <small>{identity ? playerIdentityStatusLabel(identity.status) : currentAgentId ? "同步中" : "系统将分配唯一身份"}</small>
            </span>
            <span>
              <b>托管</b>
              <em>{primaryHostedSession ? playerHostedStatusLabel(primaryHostedSession.status) : playerDowntimeLabel(downtimeMode)}</em>
              <small>{primaryHostedSession?.mandate || `当前姿态：${playerDowntimeLabel(downtimeMode)}`}</small>
            </span>
            <span>
              <b>公开世界</b>
              <em>{worldOverview ? `${worldOverview.totals.activeIdentities} 个活跃身份` : "待刷新"}</em>
              <small>{resultPage ? `结果页 ${formatDate(resultPage.generatedAt)}` : worldOverview ? "公开世界可查看" : worldOverviewPage}</small>
            </span>
          </div>
        </section>
      </section> : null}

      <details className="agent-operator-details">
        <summary>
          <span>高级与调试</span>
          <small>稍后查看：安装检查、世界图谱、设定账本、声望树、阵营树、详细身份字段、审计和维护工具</small>
        </summary>
        <section className="agent-grid">
        <article className="agent-panel agent-console">
          <div className="agent-panel-head">
            <span>本地插件</span>
            <b>连接状态</b>
          </div>
          <h1>行动身份、托管和世界进度</h1>
          <code className="agent-command">{MCP_COMMAND}</code>
          <div className="agent-action-row">
            <button type="button" disabled={isBusy} onClick={loadInstallStatus}>检查安装状态</button>
            <button type="button" disabled={isBusy || !explorer || progress?.identitySlots?.available === 0} onClick={issueIdentity}>签发身份</button>
            <button type="button" disabled={isBusy || !currentAgentId} onClick={() => void runAction("refresh", () => refreshProgress())}>刷新进度</button>
            <button type="button" disabled={isBusy || !explorer} onClick={loadExplorerProfile}>玩家档案</button>
            <button type="button" disabled={isBusy || !explorer} onClick={downloadPlayerDataExport}>导出游戏数据</button>
            <button type="button" disabled={isBusy || (!currentAgentId && !explorer)} onClick={loadAbuseStatus}>刷新冷却</button>
            <button type="button" disabled={isBusy} onClick={downloadPackage}>下载安装包</button>
          </div>
          <div className="agent-install-check" role="status" aria-label="安装连接状态">
            <span>
              <b>页面</b>
              <em>{installReadiness.page}</em>
              <small>{AGENT_SERVER_BASE}</small>
            </span>
            <span>
              <b>服务器</b>
              <em>{installReadiness.server}</em>
              <small>{installStatus?.serverBase || installReadiness.serverDetail}</small>
            </span>
            <span>
              <b>宿主工具</b>
              <em>{installReadiness.mcp}</em>
              <small>{installReadiness.mcpDetail}</small>
            </span>
            <span>
              <b>安装包</b>
              <em>{installReadiness.package}</em>
              <small>{installReadiness.signingTrust}</small>
            </span>
            <span>
              <b>验收</b>
              <em>{installReadiness.smoke}</em>
              <small>{installReadiness.smokeDetail}</small>
            </span>
            <span>
              <b>运营密钥</b>
              <em>{installReadiness.operatorKey}</em>
              <small>服务器代跑和运营操作需要</small>
            </span>
            <span>
              <b>身份编号</b>
              <em>{installReadiness.identityId}</em>
              <small>签发身份后写入本机</small>
            </span>
            <span>
              <b>写入去重</b>
              <em>{installReadiness.idempotencyKey}</em>
              <small>{installReadiness.idempotencyDetail}</small>
            </span>
            <span>
              <b>最近请求</b>
              <em>{installReadiness.lastRequest}</em>
              <small>失败会同步显示在底部错误条</small>
            </span>
            <span>
              <b>最近错误</b>
              <em>{installReadiness.lastError}</em>
              <small>无错误时可继续验收</small>
            </span>
          </div>
          <div className="agent-abuse-status">
            <span>滥用冷却</span>
            <b>{abuseStatus?.remaining !== undefined ? `${abuseStatus.remaining}/${abuseStatus.limit}` : "未读取"}</b>
            <em>
              {abuseStatus?.limited
                ? `冷却至 ${formatDate(abuseStatus.resetAt)}`
                : abuseStatus?.resetAt
                  ? `窗口至 ${formatDate(abuseStatus.resetAt)}`
                  : "可写入"}
            </em>
            <small>风险分 {abuseStatus?.abuseScore ?? 0} · {abuseStatus?.abuseLevel || "clear"}</small>
          </div>
          <label className="agent-comfort-mode">
            <input
              type="checkbox"
              aria-label="低刺激模式"
              checked={lowStimulusMode}
              onChange={(event) => updateLowStimulusMode(event.currentTarget.checked)}
            />
            <span>
              <b>低刺激模式</b>
              <small>首次进入和高刺激委托前可随时开启。开启后会要求 agent 避免惊吓、闪烁、身体异化、低语音效和过强恐怖描写，并保留清晰退出路径。</small>
            </span>
          </label>
          <div className="agent-content-safety-boundary" aria-label="世界观内容安全边界">
            <span>
              <b>世界观允许</b>
              <small>{CONTENT_SAFETY_BOUNDARY_COPY.allowed}</small>
            </span>
            <span>
              <b>现实边界</b>
              <small>{CONTENT_SAFETY_BOUNDARY_COPY.disallowed}</small>
            </span>
            <span>
              <b>误伤申诉</b>
              <small>{CONTENT_SAFETY_BOUNDARY_COPY.appeal}</small>
            </span>
          </div>
          <dl>
            <div><dt>Explorer</dt><dd>{explorer?.explorerId || "creating"}</dd></div>
            <div><dt>身份编号</dt><dd>{currentAgentId || "未签发"}</dd></div>
            <div className="agent-secret-row">
              <dt>恢复码</dt>
              <dd>
                <span className="agent-secret-value">{recoveryCode ? (showRecoveryCode ? recoveryCode : "************") : "等待生成"}</span>
                {recoveryCode ? (
                  <>
                    <button
                      type="button"
                      aria-label={showRecoveryCode ? "隐藏恢复码" : "显示恢复码"}
                      disabled={!showRecoveryCode && recoveryCodeRevealUsed}
                      onClick={showRecoveryCode ? hideRecoveryCode : revealRecoveryCodeOnce}
                    >
                      {showRecoveryCode ? "隐藏" : recoveryCodeRevealUsed ? "已显示一次" : "显示"}
                    </button>
                    <button
                      type="button"
                      aria-label="轮换恢复码"
                      disabled={isBusy || !explorer}
                      onClick={rotateRecoveryCode}
                    >
                      轮换
                    </button>
                  </>
                ) : null}
              </dd>
            </div>
          </dl>
          <div className="agent-archive-box">
            <input
              type="password"
              aria-label="加密档案口令"
              placeholder="档案口令"
              value={archivePassphrase}
              autoComplete="new-password"
              onChange={(event) => {
                setArchivePassphrase(event.target.value);
                setArchiveExportArmed(false);
              }}
            />
            <button
              type="button"
              aria-label={archiveExportArmed ? "确认下载加密身份档案" : "准备下载加密身份档案"}
              disabled={isBusy || !explorer || archivePassphrase.trim().length < 12}
              onClick={downloadExplorerArchive}
            >
              {archiveExportArmed ? "确认下载" : "导出档案"}
            </button>
            <button
              type="button"
              aria-label="导入加密身份档案"
              disabled={isBusy || !archiveImportText.trim() || archivePassphrase.trim().length < 12}
              onClick={importExplorerArchive}
            >
              导入档案
            </button>
            <textarea
              aria-label="加密身份档案"
              placeholder="加密档案 JSON"
              rows={3}
              value={archiveImportText}
              onChange={(event) => setArchiveImportText(event.target.value)}
            />
            <small>优先下载加密备份，不要截图恢复码。</small>
            {showBackupRisk ? (
              <div className="agent-backup-risk" role="status">
                <b>未备份风险</b>
                <span>完成首局后请导出加密档案；换宿主或清浏览器数据前先保存，否则本地恢复材料丢失后无法继续管理身份。</span>
              </div>
            ) : null}
            {archiveStatus ? <small>{archiveStatus}</small> : null}
          </div>
          {explorerProfile ? (
            <div className="agent-mini-list">
              <span>
                <b>玩家档案</b>
                <em>{explorerProfile.summary.totalIdentities} 身份 / {explorerProfile.summary.activeIdentities} 活跃 / {explorerProfile.summary.archivedIdentities} 定档</em>
                <small>
                  身份槽 {explorerProfile.identitySlots.active}/{explorerProfile.identitySlots.max}
                  {' · '}可用 {explorerProfile.identitySlots.available}
                  {' · '}{explorerProfile.identitySlots.capped
                    ? "已满"
                    : `下一槽还差 ${explorerProfile.identitySlots.legendToNextSlot} 传说，或由等级、阵营阶位、成就、特殊事件解锁`}
                </small>
                {explorerProfile.identitySlots.entitlementBreakdown ? (
                  <small>
                    解锁证据 · 等级 {explorerProfile.identitySlots.entitlementBreakdown.level.value}
                    {' / '}传说 {explorerProfile.identitySlots.entitlementBreakdown.legend.value}
                    {' / '}成就 {explorerProfile.identitySlots.entitlementBreakdown.legacyAchievement.value}
                    {' / '}阵营阶位 {explorerProfile.identitySlots.entitlementBreakdown.regionFactionRank.value}
                    {' / '}特殊事件 {explorerProfile.identitySlots.entitlementBreakdown.specialServerEvent.value}
                  </small>
                ) : null}
                <small>{explorerProfile.publicPages.explorer}</small>
              </span>
            </div>
          ) : null}
        </article>

        <article className="agent-panel agent-identity">
          <div className="agent-panel-head">
            <span>当前身份</span>
            <b>{identity?.status || "empty"}</b>
          </div>
          {progress?.identitySlots ? (
            <div className="agent-slot-strip">
              <span>身份槽</span>
              <b>{progress.identitySlots.active}/{progress.identitySlots.max}</b>
              <em>
                可用 {progress.identitySlots.available} · 传说 {progress.identitySlots.legend}
                {progress.identitySlots.capped ? " · 已满" : ` · 下一槽还差 ${progress.identitySlots.legendToNextSlot}`}
              </em>
            </div>
          ) : null}
          {actionEligibility ? (
            <div className={`agent-action-eligibility ${actionEligibility.canUseActiveTools ? "is-active" : "is-blocked"}`} role="status">
              <span>行动权限</span>
              <b>{actionEligibility.canUseActiveTools ? "可行动" : actionEligibility.status === "archived" ? "已定档" : "待签发"}</b>
              <em>{actionEligibility.reason}</em>
              <small>建议下一步 {actionEligibility.recommendedTools.map(playerToolLabel).join(" / ") || "等待进度"}</small>
              {!actionEligibility.canUseActiveTools && actionEligibility.blockedTools.length ? (
                <small>暂不可用 {actionEligibility.blockedTools.slice(0, 5).map(playerToolLabel).join(" / ")}{actionEligibility.blockedTools.length > 5 ? " / ..." : ""}</small>
              ) : null}
            </div>
          ) : null}
          {identity ? (
            <>
              <strong>{identity.identityName}</strong>
              {agentNarrativeProfile ? (
                <div className="agent-narrative-profile" aria-label="身份叙事档案首页">
                  <span className="agent-narrative-self">
                    <b>身份自述</b>
                    <strong>{agentNarrativeProfile.selfLine}</strong>
                  </span>
                  <span>
                    <b>经历年表</b>
                    {agentNarrativeProfile.timeline.map((entry) => <small key={entry}>{entry}</small>)}
                  </span>
                  <span>
                    <b>最近伤痕</b>
                    <small>{agentNarrativeProfile.scar}</small>
                  </span>
                  <span>
                    <b>关系变化</b>
                    <small>{agentNarrativeProfile.relationshipChange}</small>
                  </span>
                </div>
              ) : null}
              <details className="agent-structured-fields">
                <summary>结构化字段</summary>
                <div className="agent-lifetime">
                  <span style={{ width: `${lifetimePercent}%` }} />
                </div>
                <dl>
                  <div><dt>寿命</dt><dd>{identity.lifetime.remaining}/{identity.lifetime.max}</dd></div>
                  <div>
                    <dt>处境</dt>
                    <dd>
                      {progress?.custody?.custodyStatus === "imprisoned" ? "受押，托管暂停" : "自由行动"}
                      {progress?.custody ? ` · ${progress.custody.reason} · ${formatDate(progress.custody.changedAt)}` : ""}
                    </dd>
                  </div>
                  <div><dt>世代</dt><dd>第 {identity.generation} 世</dd></div>
                  <div><dt>创建</dt><dd>{formatDate(identity.createdAt)}</dd></div>
                  <div><dt>身份槽</dt><dd>{progress?.identitySlots ? `${progress.identitySlots.active}/${progress.identitySlots.max} · 可用 ${progress.identitySlots.available}` : "未加载"}</dd></div>
                  <div><dt>传说池</dt><dd>{progress?.identitySlots?.legend || 0}</dd></div>
                  <div><dt>下一槽</dt><dd>{progress?.identitySlots ? (progress.identitySlots.capped ? "已达上限" : `传说还差 ${progress.identitySlots.legendToNextSlot}，也可由等级、阵营阶位或特殊事件解锁`) : "未加载"}</dd></div>
                  {identity.inheritance ? (
                    <>
                      <div><dt>传说回响</dt><dd>{identity.inheritance.legendEcho}</dd></div>
                      <div><dt>前世区域</dt><dd>{(identity.inheritance.knownRegions || []).join(" / ") || "暂无"}</dd></div>
                      <div><dt>轮回伤痕</dt><dd>{identity.inheritance.scar || "无"}</dd></div>
                    </>
                  ) : null}
                </dl>
              </details>
              <div className="agent-action-row">
                <button type="button" disabled={isBusy || identity.status !== "active"} onClick={archiveCurrentIdentity}>身份定档</button>
                <button type="button" disabled={isBusy || identity.status !== "archived" || Boolean(identity.nextAgentId)} onClick={reincarnateCurrentIdentity}>领取下一世</button>
              </div>
              <div className="agent-mini-list">
                <span>
                  <b>性格漂移</b>
                  <em>{activePersonalityTraits.length ? activePersonalityTraits.join(" / ") : "暂无已写入特质"}</em>
                  <small>{activePersonalitySourceEventId ? `来源 ${activePersonalitySourceEventId}` : "重大伤痕、污染或背叛会生成服务器提案"}</small>
                </span>
                {identityPersonalityDrifts.map((drift) => (
                  <span key={drift.driftId}>
                    <b>{drift.suggestedTrait}</b>
                    <em>{drift.status === "confirmed" ? "已写入" : "待确认"} · {drift.summary}</em>
                    <small>{drift.trigger} · 来源 {playerRecordLabel(drift.sourceEventId, "记录")}</small>
                    {drift.status === "proposed" ? (
                      <div className="agent-option-actions">
                        <button
                          type="button"
                          disabled={isBusy || !explorer}
                          onClick={() => confirmPersonalityDrift(drift.driftId)}
                        >
                          确认
                        </button>
                      </div>
                    ) : null}
                  </span>
                ))}
              </div>
              <div className="agent-mini-list">
                <span>
                  <b>属性</b>
                  <em>{attributeEntries.length ? attributeEntries.map(([key, value]) => `${key} ${value}`).join(" / ") : "暂无服务器属性"}</em>
                  <small>服务器 attributes 字段；旧投影缺失时显示空态。</small>
                </span>
                <span>
                  <b>技能</b>
                  <em>
                    {skillEntries.length
                      ? skillEntries.map((skill) => `${skill.label || skill.name || skill.skillId || skill.id || "未命名技能"}${skill.level !== undefined ? ` Lv.${skill.level}` : ""}${skill.rank ? ` ${skill.rank}` : ""}`).join(" / ")
                      : "暂无服务器技能"}
                  </em>
                  <small>{skillEntries[0]?.summary || skillEntries[0]?.description || "能力数据返回后会在这里展示。"}</small>
                </span>
              </div>
            </>
          ) : (
            <p>签发系统身份后，这里会显示寿命、世代和定档状态。</p>
          )}
          {(progress?.identities || []).length ? (
            <div className="agent-mini-list agent-identity-list">
              {(progress?.identities || []).map((item) => (
                <span key={item.agentId}>
                  <b>{item.identityName}</b>
                  <em>{item.status} · 第 {item.generation} 世 · 寿命 {item.lifetime.remaining}/{item.lifetime.max}</em>
                  <div className="agent-option-actions">
                    <button type="button" disabled={isBusy || item.agentId === currentAgentId} onClick={() => switchIdentity(item.agentId)}>切换</button>
                  </div>
                </span>
              ))}
            </div>
          ) : null}
        </article>

        <article className="agent-panel">
          <div className="agent-panel-head">
            <span>记忆分层</span>
            <b>
              服务器确认 {agentMemoryTotals.confirmed} / 风险传闻 {agentMemoryTotals.rumor} / 私有经历 {agentMemoryTotals.privateRun}
            </b>
          </div>
          {lastExplorationMetrics?.memoryDelta ? (
            <p>
              本局记忆增量：确认 {signedDelta(lastExplorationMetrics.memoryDelta.confirmed)}
              {" / "}传闻 {signedDelta(lastExplorationMetrics.memoryDelta.rumor)}
              {" / "}私有 {signedDelta(lastExplorationMetrics.memoryDelta.private)}
            </p>
          ) : (
            <p>本局记忆增量：完整探索完成后显示；当前仅展示服务器总量。</p>
          )}
          <dl>
            <div><dt>服务器确认</dt><dd>{agentMemory?.guidance?.confirmed || "等待当前身份记忆"}</dd></div>
            <div><dt>风险传闻</dt><dd>{agentMemory?.guidance?.rumor || "待审 claims 不进入结算"}</dd></div>
            <div><dt>私有经历</dt><dd>{agentMemory?.guidance?.privateRun || "被拒故事只属于本局"}</dd></div>
          </dl>
          <div className="agent-mini-list">
            {(agentMemory?.confirmedMemory || []).slice(0, 2).map((item) => (
              <span key={`confirmed-${item.candidateId}`}>
                <b>{item.title}</b>
                <em>{playerCommonStatusLabel(item.reviewLevel)} · {playerRegionLabel(item.regionId)}</em>
              </span>
            ))}
            {(agentMemory?.rumorMemory || []).slice(0, 2).map((item) => (
              <span key={`rumor-${item.candidateId}`}>
                <b>{item.title}</b>
                <em>{item.reviewFlags.join(" / ") || item.reviewLevel}</em>
              </span>
            ))}
            {(agentMemory?.privateRunMemory || []).slice(0, 2).map((item) => (
              <span key={`private-${item.candidateId}`}>
                <b>{item.title}</b>
                <em>{item.rejectionReason || item.reviewLevel}</em>
              </span>
            ))}
            {agentMemoryTotals.confirmed + agentMemoryTotals.rumor + agentMemoryTotals.privateRun === 0 ? (
              <span>暂无记忆条目；完成探索或提交 NPC 线索后会写入分层记忆。</span>
            ) : null}
          </div>
        </article>

        <article className="agent-panel">
          <div className="agent-panel-head">
            <span>个人版本迁移</span>
            <b>
              保留 {personalMigrationSummary?.totals.retained || 0} / 降级 {personalMigrationSummary?.totals.downgraded || 0} / 需补证 {personalMigrationSummary?.totals.needs_evidence || 0}
            </b>
          </div>
          <div className="agent-mini-list">
            {[
              { key: "retained", label: "保留", count: personalMigrationSummary?.totals.retained || 0, items: personalMigrationSummary?.retained || [] },
              { key: "downgraded", label: "降级", count: personalMigrationSummary?.totals.downgraded || 0, items: personalMigrationSummary?.downgraded || [] },
              { key: "needs-evidence", label: "需补证", count: personalMigrationSummary?.totals.needs_evidence || 0, items: personalMigrationSummary?.needsEvidence || [] },
              { key: "adopted", label: "采纳", count: personalMigrationSummary?.totals.adopted || 0, items: personalMigrationSummary?.adopted || [] },
              { key: "sealed", label: "封存", count: personalMigrationSummary?.totals.sealed || 0, items: personalMigrationSummary?.sealed || [] },
            ].map((bucket) => {
              const item = bucket.items[0];
              return (
                <span key={`personal-migration-${bucket.key}`}>
                  <b>{bucket.label} {bucket.count}</b>
                  <em>{item ? `${item.targetId} · ${item.reason}` : "暂无记录"}</em>
                </span>
              );
            })}
          </div>
        </article>

        <ResourcePanel
          entries={resourceEntries(progress?.resources || {}, progress?.resourceMedia || {})}
          epochAssetUrl={epochAssetUrl}
        />

        <InventoryPanel
          activeIdentityDisabled={activeIdentityDisabled}
          craftRecipeId={craftRecipeId}
          craftRecipeOptions={CRAFT_RECIPE_OPTIONS}
          epochAssetUrl={epochAssetUrl}
          formatDate={formatDate}
          formatShopCosts={formatShopCosts}
          hasExplorer={Boolean(explorer)}
          isBusy={isBusy}
          onCraftInventoryItem={craftInventoryItem}
          onLoadShop={loadShop}
          onPurchaseShopOffer={purchaseShopOffer}
          progress={progress}
          selectedShopOffer={selectedShopOffer}
          setCraftRecipeId={setCraftRecipeId}
          setShopOfferId={setShopOfferId}
          shopOfferId={shopOfferId}
          shopOffers={shopOffers}
        />

        <article className="agent-panel">
          <div className="agent-panel-head">
            <span>托管</span>
            <b>{progress?.downtime?.active ? playerDowntimeLabel(progress.downtime.mode) : "待选择"}</b>
          </div>
          {progress?.downtimeMedia || progress?.pendingDowntime?.media ? (
            <div
              className="agent-downtime-media"
              style={{ borderColor: (progress.downtimeMedia || progress.pendingDowntime?.media)?.accentColor }}
            >
              <img
                className="agent-downtime-media-image"
                src={epochAssetUrl((progress.downtimeMedia || progress.pendingDowntime?.media)?.imageUrl || "")}
                alt={(progress.downtimeMedia || progress.pendingDowntime?.media)?.publicAlt || "托管姿态"}
              />
              <span>
                <b>{(progress.downtimeMedia || progress.pendingDowntime?.media)?.title}</b>
                <em>{(progress.downtimeMedia || progress.pendingDowntime?.media)?.subtitle}</em>
              </span>
            </div>
          ) : null}
          <select value={downtimeMode} onChange={(event) => setDowntimeMode(event.target.value as EpochDowntimeMode)}>
            {DOWNTIME_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <div className="agent-action-row">
            <button type="button" disabled={isBusy || activeIdentityDisabled} onClick={startDowntime}>开始</button>
            <button type="button" disabled={isBusy || activeIdentityDisabled || !progress?.downtime?.active} onClick={tickDowntime}>tick</button>
            <button type="button" disabled={isBusy || activeIdentityDisabled || !progress?.downtime?.active} onClick={claimDowntime}>领取</button>
          </div>
          <p>{progress?.downtime?.active ? `开始于 ${formatDate(progress.downtime.startedAt)}${progress.downtime.lastTickedAt ? ` · tick ${formatDate(progress.downtime.lastTickedAt)}` : ""}` : "无活动托管状态"}</p>
          {progress?.pendingDowntime ? (
            <div className="agent-mini-list">
              <b>预计托管收益</b>
              <span>
                {rewardSummary(progress.pendingDowntime.rewards)}
                <small>
                  已托管 {Math.floor(progress.pendingDowntime.elapsedSeconds / 60)} 分钟
                  {progress.pendingDowntime.nextRewardAt ? ` · 下次收益 ${formatDate(progress.pendingDowntime.nextRewardAt)}` : ""}
                  {progress.pendingDowntime.capped ? " · 已封顶" : ""}
                </small>
              </span>
              <b>风险提示</b>
              {progress.pendingDowntime.riskWarnings.map((warning) => (
                <span key={warning}>{warning}</span>
              ))}
              {!progress.pendingDowntime.riskWarnings.length ? <span>暂无额外风险提示</span> : null}
            </div>
          ) : null}
          <div className="agent-mini-list">
            <b>托管日志</b>
            {(progress?.downtimeDiaryEntries || []).slice(0, 3).map((entry) => (
              <span key={entry.diaryId}>
                {entry.title} · {entry.phase === "tick" ? "巡检" : "领取"} · {formatDate(entry.occurredAt)}
                <small>{entry.summary}</small>
              </span>
            ))}
            {!progress?.downtimeDiaryEntries?.length ? <span>暂无服务器托管日志</span> : null}
          </div>
        </article>

        <TurnHostedActionPanel
          activeIdentityDisabled={activeIdentityDisabled}
          agentServerBase={AGENT_SERVER_BASE}
          attestationChallenge={attestationChallenge}
          attestedRunnerId={attestedRunnerId}
          attestedSignature={attestedSignature}
          attestedTranscriptHash={attestedTranscriptHash}
          authorizeHighRiskPackage={authorizeHighRiskPackage}
          autonomyEvaluation={autonomyEvaluation}
          changeRiskStrategy={changeRiskStrategy}
          confirmationToken={confirmationToken}
          contentPolicyRegion={contentPolicyRegion}
          copyWebBridgePrompt={copyWebBridgePrompt}
          createTurnCard={createTurnCard}
          createTurnCardWithConfirmation={createTurnCardWithConfirmation}
          currentAgentId={currentAgentId}
          currentTurnCard={currentTurnCard}
          explorer={explorer}
          formatDate={formatDate}
          hasHighRiskAuthorization={hasHighRiskAuthorization}
          highRiskPackages={highRiskPackages}
          highRiskRequestLimit={HIGH_RISK_REQUEST_LIMIT}
          highStimulusComplianceConfirmed={highStimulusComplianceConfirmed}
          highValueConfirmation={highValueConfirmation}
          hostedMandate={hostedMandate}
          hostedOptionSummary={hostedOptionSummary}
          hostedRiskLabels={HOSTED_RISK_LABELS}
          hostedVisibleText={hostedVisibleText}
          interventionBudget={interventionBudget}
          interventionInstruction={interventionInstruction}
          interventionModeLabel={INTERVENTION_MODE_LABELS[interventionMode]}
          interventionRemaining={interventionRemaining}
          isBusy={isBusy}
          lastServerHostedRun={lastServerHostedRun}
          lastWebBridgeAction={lastWebBridgeAction}
          loadHighValueConfirmations={loadHighValueConfirmations}
          loadHostedSessions={loadHostedSessions}
          loadServerHostedJobs={loadServerHostedJobs}
          lowStimulusMode={lowStimulusMode}
          messageBody={messageBody}
          operatorKey={operatorKey}
          pauseExploration={pauseExploration}
          postServerHostedRegionMessage={postServerHostedRegionMessage}
          postServerHostedWorldMessage={postServerHostedWorldMessage}
          primaryHostedSession={primaryHostedSession}
          publishTurnResultPage={publishTurnResultPage}
          publishWebBridgeResultPage={publishWebBridgeResultPage}
          queueServerHostedAction={queueServerHostedAction}
          rejectHighRiskPackage={rejectHighRiskPackage}
          requestAttestationChallenge={requestAttestationChallenge}
          requestResolveTurnConfirmation={requestResolveTurnConfirmation}
          requestTurnCardConfirmation={requestTurnCardConfirmation}
          resolveTurnCard={resolveTurnCard}
          resolveTurnCardWithConfirmation={resolveTurnCardWithConfirmation}
          resultPublishAuthorizationCopy={RESULT_PUBLISH_AUTHORIZATION_COPY}
          riskStrategy={riskStrategy}
          runServerHostedAction={runServerHostedAction}
          runServerHostedJob={runServerHostedJob}
          serverHostedJobs={serverHostedJobs}
          serverHostedJobStatusLabel={serverHostedJobStatusLabel}
          serverHostedOptionKey={serverHostedOptionKey}
          serverHostedOptionLabel={serverHostedOptionLabel}
          serverHostedOptionOptions={SERVER_HOSTED_OPTION_KEYS}
          setAttestedRunnerId={setAttestedRunnerId}
          setAttestedSignature={setAttestedSignature}
          setAttestedTranscriptHash={setAttestedTranscriptHash}
          setHostedMandate={setHostedMandate}
          setHostedVisibleText={setHostedVisibleText}
          setInterventionInstruction={setInterventionInstruction}
          setServerHostedOptionKey={setServerHostedOptionKey}
          setTurnPrompt={setTurnPrompt}
          setTurnVisibleText={setTurnVisibleText}
          startHostedSession={startHostedSession}
          startWebBridgeTurn={startWebBridgeTurn}
          submitAttestedAction={submitAttestedAction}
          submitHostedAction={submitHostedAction}
          submitWebBridgeAction={submitWebBridgeAction}
          takeOverCurrentTurn={takeOverCurrentTurn}
          turnPrompt={turnPrompt}
          turnVisibleText={turnVisibleText}
          updateLowStimulusMode={updateLowStimulusMode}
          webBridgeTurn={webBridgeTurn}
          appendInterventionInstruction={appendInterventionInstruction}
        />

        <article className="agent-panel agent-mcp">
          <div className="agent-panel-head">
            <span>工具</span>
            <b>{AGENT_WORLD_TOOLS.length + EPOCH_TOOLS.length}</b>
          </div>
          <div className="agent-tool-list">
            {AGENT_WORLD_TOOLS.map(([name, label]) => (
              <span key={name} title={`agent_world.${name}`}><b>{label}</b><small>宿主工具</small></span>
            ))}
            {EPOCH_TOOLS.map(([name, label]) => (
              <span key={name} title={`obsidian_epoch.${name}`}><b>{label}</b><small>世界工具</small></span>
            ))}
          </div>
        </article>

        <RegionOverviewPanel
          activeIdentityDisabled={activeIdentityDisabled}
          agentServerBase={AGENT_SERVER_BASE}
          claimNewsLegend={claimNewsLegend}
          contributeOrganizationTreasury={contributeOrganizationTreasury}
          createOrganization={createOrganization}
          currentAgentId={currentAgentId}
          displayedRegionMessages={displayedRegionMessages}
          epochAssetUrl={epochAssetUrl}
          explorer={Boolean(explorer)}
          formatDate={formatDate}
          generateRegionNews={generateRegionNews}
          isBusy={isBusy}
          isOrganizationBudgetGovernanceRole={isOrganizationBudgetGovernanceRole}
          loadRegion={loadRegion}
          messageBody={messageBody}
          newsSourceEventId={newsSourceEventId}
          npcName={npcName}
          operatorKey={operatorKey}
          organizationBudgetAmount={organizationBudgetAmount}
          organizationBudgetDescription={organizationBudgetDescription}
          organizationBudgetResourceId={organizationBudgetResourceId}
          organizationBudgetTitle={organizationBudgetTitle}
          organizationBudgetVoteLabel={organizationBudgetVoteLabel}
          organizationContributionAmount={organizationContributionAmount}
          organizationContributionResourceId={organizationContributionResourceId}
          organizationCreateName={organizationCreateName}
          organizationMembershipRole={organizationMembershipRole}
          organizationMembershipRoleOptions={ORGANIZATION_MEMBERSHIP_ROLE_OPTIONS}
          organizationSearch={organizationSearch}
          organizationTreasuryReasonLabel={organizationTreasuryReasonLabel}
          organizationUpgradeKey={organizationUpgradeKey}
          organizationUpgradeOptions={ORGANIZATION_UPGRADE_OPTIONS}
          playerFactionLabel={playerFactionLabel}
          postRegionMessage={postRegionMessage}
          progress={progress}
          proposeOrganizationBudget={proposeOrganizationBudget}
          purchaseOrganizationUpgrade={purchaseOrganizationUpgrade}
          region={region}
          regionId={regionId}
          resolveOrganizationBudget={resolveOrganizationBudget}
          resourceAmountSummary={resourceAmountSummary}
          resourceLabels={PLAYER_RESOURCE_LABELS}
          reviewRejectedNpcCandidate={reviewRejectedNpcCandidate}
          saveNpcNote={saveNpcNote}
          setMessageBody={setMessageBody}
          setNewsSourceEventId={setNewsSourceEventId}
          setNpcName={setNpcName}
          setOrganizationBudgetAmount={setOrganizationBudgetAmount}
          setOrganizationBudgetDescription={setOrganizationBudgetDescription}
          setOrganizationBudgetResourceId={setOrganizationBudgetResourceId}
          setOrganizationBudgetTitle={setOrganizationBudgetTitle}
          setOrganizationContributionAmount={setOrganizationContributionAmount}
          setOrganizationContributionResourceId={setOrganizationContributionResourceId}
          setOrganizationCreateName={setOrganizationCreateName}
          setOrganizationMembershipRole={setOrganizationMembershipRole}
          setOrganizationSearch={setOrganizationSearch}
          setOrganizationUpgradeKey={(upgradeKey) => setOrganizationUpgradeKey(upgradeKey as (typeof ORGANIZATION_UPGRADE_OPTIONS)[number]["value"])}
          setRegionId={setRegionId}
          tickNpcLifecycle={tickNpcLifecycle}
          tickOrganizationPolitics={tickOrganizationPolitics}
          updateOrganizationMembership={updateOrganizationMembership}
          visibleOrganizations={visibleOrganizations}
        />

        <article className="agent-panel agent-confirmation">
          <div className="agent-panel-head">
            <span>高价值确认</span>
            <b>{playerCommonStatusLabel(highValueConfirmation?.status || "none")}</b>
          </div>
          <div className="agent-action-row">
            <button type="button" disabled={isBusy || activeIdentityDisabled || !messageBody.trim()} onClick={requestWorldConfirmation}>请求世界发言确认</button>
            <button type="button" disabled={isBusy || !explorer} onClick={loadHighValueConfirmations}>刷新待确认</button>
            <button type="button" disabled={isBusy || !highValueConfirmation || highValueConfirmation.status !== "pending"} onClick={confirmHighValueAction}>确认并生成一次性凭证</button>
            <button type="button" disabled={isBusy || activeIdentityDisabled || !messageBody.trim() || !confirmationToken} onClick={postWorldMessage}>发布世界发言</button>
          </div>
          <div className="agent-mini-list">
            {highValueConfirmations.map((confirmation) => (
              <span key={confirmation.confirmationId}>
                <b>{playerActionLabel(confirmation.action)}</b>
                <em>{confirmation.summary}</em>
                <small>{playerAgentLabel(confirmation.agentId)} · {formatDate(confirmation.expiresAt)}</small>
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => {
                    setHighValueConfirmation(confirmation);
                    setConfirmationToken("");
                  }}
                >
                  选择
                </button>
              </span>
            ))}
            {!highValueConfirmations.length ? (
              <span>暂无外部待确认</span>
            ) : null}
          </div>
          {highValueConfirmation ? (
            <dl>
              <div><dt>确认记录</dt><dd>{shortHash(highValueConfirmation.confirmationId)}</dd></div>
              <div><dt>动作</dt><dd>{playerActionLabel(highValueConfirmation.action)}</dd></div>
              <div><dt>状态</dt><dd>{playerCommonStatusLabel(highValueConfirmation.status)}</dd></div>
              <div><dt>身份</dt><dd>{playerAgentLabel(highValueConfirmation.agentId)}</dd></div>
              <div><dt>摘要</dt><dd>{highValueConfirmation.summary}</dd></div>
              <div><dt>过期</dt><dd>{formatDate(highValueConfirmation.expiresAt)}</dd></div>
            </dl>
          ) : (
            <p>世界频道发言和本地回合卡可以从网页确认后，把一次性口令交给本地工具使用。</p>
          )}
          {confirmationToken ? (
            <div className="agent-token">
              <b>一次性确认凭证</b>
              <code>{confirmationToken}</code>
            </div>
          ) : null}
        </article>

        <article className="agent-panel agent-operator">
          <div className="agent-panel-head">
            <span>运营审核</span>
            <b>{openModerationItems.length} open / {moderationQueue?.total || 0} total</b>
          </div>
          <input
            type="password"
            value={operatorKey}
            onChange={(event) => setOperatorKey(event.target.value)}
            placeholder="operator key"
            autoComplete="off"
          />
          <input
            value={moderationNote}
            onChange={(event) => setModerationNote(event.target.value)}
            placeholder="处理备注"
          />
          <input
            value={riskReviewNote}
            onChange={(event) => setRiskReviewNote(event.target.value)}
            placeholder="风险处置备注"
          />
          <div className="agent-market-form" aria-label="设定裁决">
            <input
              value={loreAdjudicationTargetId}
              onChange={(event) => setLoreAdjudicationTargetId(event.target.value)}
              placeholder="设定 targetId"
            />
            <select
              value={loreAdjudicationStatus}
              onChange={(event) => setLoreAdjudicationStatus(event.target.value as EpochLoreTargetStatus)}
            >
              {LORE_ADJUDICATION_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
          <textarea
            value={loreAdjudicationSummary}
            onChange={(event) => setLoreAdjudicationSummary(event.target.value)}
            placeholder="设定裁决摘要"
            rows={2}
          />
          <textarea
            value={loreAdjudicationSourceIds}
            onChange={(event) => setLoreAdjudicationSourceIds(event.target.value)}
            placeholder="贡献事件 ID，支持逗号、空格或换行分隔"
            rows={2}
          />
          <div className="agent-canon-candidate-path" aria-label="正史候选路径">
            <label>
              <input
                type="checkbox"
                checked={loreCanonCandidateRequested}
                onChange={(event) => setLoreCanonCandidateRequested(event.target.checked)}
              />
              正史候选路径
            </label>
            <input
              value={loreCanonChapterReviewId}
              onChange={(event) => setLoreCanonChapterReviewId(event.target.value)}
              placeholder="章节复审 ID"
              disabled={!loreCanonCandidateRequested}
            />
            <input
              value={loreCanonCuratorApprovedBy}
              onChange={(event) => setLoreCanonCuratorApprovedBy(event.target.value)}
              placeholder="主理人批准"
              disabled={!loreCanonCandidateRequested}
            />
            <textarea
              value={loreCanonMigrationSummary}
              onChange={(event) => setLoreCanonMigrationSummary(event.target.value)}
              placeholder="迁移说明"
              rows={2}
              disabled={!loreCanonCandidateRequested}
            />
            <textarea
              value={loreCanonAdoptedText}
              onChange={(event) => setLoreCanonAdoptedText(event.target.value)}
              placeholder="采纳文字"
              rows={2}
              disabled={!loreCanonCandidateRequested}
            />
            <textarea
              value={loreCanonBoundaryNote}
              onChange={(event) => setLoreCanonBoundaryNote(event.target.value)}
              placeholder="边界说明"
              rows={2}
              disabled={!loreCanonCandidateRequested}
            />
            <small>源出战报、探索者和 agent 署名由服务器从贡献事件保留。</small>
          </div>
          <div className="agent-action-row">
            <button type="button" disabled={isBusy || !operatorKey.trim()} onClick={loadOperatorOverview}>刷新总览</button>
            <button type="button" disabled={isBusy || !operatorKey.trim()} onClick={runMaintenance}>运行维护</button>
            <button type="button" disabled={isBusy || !operatorKey.trim()} onClick={loadModerationQueue}>刷新队列</button>
            <button
              type="button"
              disabled={isBusy
                || !operatorKey.trim()
                || !loreAdjudicationTargetId.trim()
                || !loreAdjudicationSummary.trim()
                || !loreAdjudicationSourceIds.trim()
                || (loreCanonCandidateRequested
                  && (!loreCanonChapterReviewId.trim() || !loreCanonCuratorApprovedBy.trim() || !loreCanonMigrationSummary.trim()))}
              onClick={adjudicateLoreTarget}
            >
              裁决设定
            </button>
          </div>
          {operatorOverview ? (
            <>
              <dl>
                <div><dt>运营总览</dt><dd>{operatorOverview.summary.openModeration} 待审 / {operatorOverview.summary.restrictedAbuseProfiles} 滥用限制 / {operatorOverview.summary.marketRiskRestrictions} 市场限制</dd></div>
                <div><dt>风险事件</dt><dd>{operatorOverview.summary.riskEvents} 风险 / {operatorOverview.summary.recentAbuseReleases} 解除 / 关注 {operatorOverview.summary.watchAbuseProfiles}</dd></div>
                <div><dt>候选风险</dt><dd>{operatorOverview.summary.npcCandidateWatch} 关注 / {operatorOverview.summary.npcCandidateBlocked} 已阻止</dd></div>
                <div><dt>待裁决设定</dt><dd>{operatorOverview.summary.loreTargetsPendingAdjudication} 待裁决 / {operatorOverview.loreAdjudication.adjudicated} 已裁决 / 队列 {operatorOverview.health.queues.loreTargetsPendingAdjudication}</dd></div>
                <div><dt>见证 Runner</dt><dd>{operatorOverview.summary.attestedRunnersConfigured} 已配置 / {operatorOverview.summary.attestedRunnerRecentAttestations} 近期见证</dd></div>
                <div><dt>运行健康</dt><dd>{OPERATOR_HEALTH_LABELS[operatorOverview.health.status]} · 警报 {operatorOverview.health.attentionReasons.length} · {formatDate(operatorOverview.health.checkedAt)}</dd></div>
                <div><dt>维护状态</dt><dd>{operatorOverview.summary.maintenanceEvents} 事件 / NPC {operatorOverview.maintenance.counts.npcLifecycle} / 政治 {operatorOverview.maintenance.counts.organizationPolitics} / 市场 {operatorOverview.maintenance.counts.marketExpired} / 滥用衰减 {operatorOverview.maintenance.counts.abuseDecayed} / 资源点生成 {operatorOverview.maintenance.counts.resourceNodeSpawned} / 资源点结算 {operatorOverview.maintenance.counts.resourceNodeSettled} / 异常 {operatorOverview.maintenance.counts.anomalySpawned} / 赛季启动 {operatorOverview.maintenance.counts.seasonStarted} / 赛季结算 {operatorOverview.maintenance.counts.seasonSettled}</dd></div>
                <div><dt>托管作业</dt><dd>{operatorOverview.summary.serverHostedJobsQueued} 待处理 / 完成 {operatorOverview.maintenance.counts.serverHostedJobsCompleted} / 跳过 {operatorOverview.maintenance.counts.serverHostedJobsSkipped} / 队列 {operatorOverview.health.queues.serverHostedJobsQueued}</dd></div>
                <div><dt>维护健康</dt><dd>NPC {MAINTENANCE_WORKER_HEALTH_LABELS[operatorOverview.maintenance.health.workers.npcLifecycle.status]} / 政治 {MAINTENANCE_WORKER_HEALTH_LABELS[operatorOverview.maintenance.health.workers.organizationPolitics.status]} / 市场 {MAINTENANCE_WORKER_HEALTH_LABELS[operatorOverview.maintenance.health.workers.marketExpiry.status]} / 滥用衰减 {MAINTENANCE_WORKER_HEALTH_LABELS[operatorOverview.maintenance.health.workers.abuseDecay.status]} / 资源点生成 {MAINTENANCE_WORKER_HEALTH_LABELS[operatorOverview.maintenance.health.workers.resourceNodeSpawn.status]} / 资源点结算 {MAINTENANCE_WORKER_HEALTH_LABELS[operatorOverview.maintenance.health.workers.resourceNodeSettle.status]} / 异常 {MAINTENANCE_WORKER_HEALTH_LABELS[operatorOverview.maintenance.health.workers.anomalySpawn.status]} / 赛季启动 {MAINTENANCE_WORKER_HEALTH_LABELS[operatorOverview.maintenance.health.workers.seasonStart.status]} / 赛季结算 {MAINTENANCE_WORKER_HEALTH_LABELS[operatorOverview.maintenance.health.workers.seasonSettle.status]} / 托管 {MAINTENANCE_WORKER_HEALTH_LABELS[operatorOverview.maintenance.health.workers.serverHostedJob.status]}</dd></div>
                {maintenanceRun ? (
                  <div><dt>本次维护</dt><dd>NPC {maintenanceRun.npc.events} / 政治 {maintenanceRun.organizationPolitics.events} / 市场 {maintenanceRun.market.events} / 滥用衰减 {maintenanceRun?.abuse.decayed} / 资源点生成 {maintenanceRun?.resourceNodes.spawned} / 资源点结算 {maintenanceRun?.resourceNodes.settled} / 异常 {maintenanceRun?.anomalies.spawned} / 赛季启动 {maintenanceRun?.seasons.started} / 赛季结算 {maintenanceRun?.seasons.settled} / 托管 {maintenanceRun?.serverHostedJobs.completed} / 跳过 {maintenanceRun.resourceNodes.skipped + maintenanceRun.anomalies.skipped + maintenanceRun.seasons.skipped + maintenanceRun.serverHostedJobs.skipped}</dd></div>
                ) : null}
              </dl>
              <div className="agent-mini-list">
                {operatorOverview.loreAdjudication.pendingTargets.slice(0, 3).map((target) => (
                  <span key={target.targetId}>
                    <b>待裁决设定 · {playerLoreAdjudicationStatusLabel(target.status)}</b>
                    <em>{target.targetId}</em>
                    <small>{playerLoreContributionCategoryLabel(target.latestContribution.category)} · {playerRecordLabel(target.latestContribution.eventId, "贡献记录")}</small>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => {
                        setLoreAdjudicationTargetId(target.targetId);
                        setLoreAdjudicationStatus(target.status);
                        setLoreAdjudicationSummary(target.latestContribution.summary);
                        setLoreAdjudicationSourceIds(target.latestContribution.eventId);
                      }}
                    >
                      填入裁决
                    </button>
                  </span>
                ))}
                {operatorOverview.attestedRunners.runners.slice(0, 3).map((runner) => (
                  <span key={runner.runnerId}>
                    <b>见证 Runner · {playerTrustClassLabel(runner.trustClass)}</b>
                    <em>{runner.label || runner.runnerId} · 密钥 {shortHash(runner.keyId)}</em>
                    <small>本地指纹 {shortHash(runner.secretFingerprint)} · 见证记录 {runner.latestAttestationId ? shortHash(runner.latestAttestationId) : "暂无"}{runner.latestVerifiedAt ? ` · ${formatDate(runner.latestVerifiedAt)}` : ""}</small>
                  </span>
                ))}
                {operatorOverview.maintenance.recentEvents.slice(0, 3).map((event) => (
                  <span key={event.eventId}>
                    <b>{playerEventTypeLabel(event.eventType)}</b>
                    <em>{event.regionId || event.agentId || event.aggregateId}</em>
                    <small>{formatDate(event.createdAt)} · {event.subjectId}</small>
                  </span>
                ))}
                {operatorOverview.marketRiskRestrictions.slice(0, 2).map((restriction) => (
                  <span key={restriction.agentId}>
                    <b>市场限制 · {playerAgentLabel(restriction.agentId)}</b>
                    <em>{MARKET_RESTRICTION_LABELS[restriction.reason]} · 评分 {restriction.reviewScore}</em>
                    <small>{formatDate(restriction.restrictedAt)} · {playerRecordLabel(restriction.sourceEventId, "来源记录")}</small>
                  </span>
                ))}
                {operatorOverview.npcCandidateReview.recent.slice(0, 3).map((candidate) => (
                  <span key={candidate.candidateId}>
                    <b>候选风险 · {candidate.reviewLevel}</b>
                    <em>{candidate.displayName} · score {candidate.reviewScore}</em>
                    <small>{candidate.reviewFlags.join(" / ") || "none"} · {candidate.regionId}</small>
                  </span>
                ))}
              </div>
            </>
          ) : null}
          <div className="agent-mini-list agent-moderation-list">
            {openModerationItems.slice(0, 4).map((item) => (
              <span key={item.moderationId}>
                <b>{item.subjectType} · {item.severity}</b>
                <em>{item.reason}</em>
                <small>{item.bodyPreview}</small>
                <div className="agent-option-actions">
                  <button type="button" disabled={isBusy} onClick={() => resolveModerationItem(item, "approved")}>批准</button>
                  <button type="button" disabled={isBusy} onClick={() => resolveModerationItem(item, "hidden")}>隐藏</button>
                </div>
              </span>
            ))}
          </div>
          {!openModerationItems.length ? <p>公开发言或区域新闻命中越权/奖励宣称时会进入这里。</p> : null}
          <div className="agent-action-row">
            <button type="button" disabled={isBusy} onClick={loadRiskAudit}>刷新风险审计</button>
            <button type="button" disabled={isBusy} onClick={loadRejectedCommandAudit}>拒绝审计</button>
            <button type="button" disabled={isBusy || !operatorKey.trim()} onClick={loadAbuseProfiles}>刷新滥用画像</button>
          </div>
          {riskAudit?.riskProfile ? (
            <dl>
              <div><dt>风险画像</dt><dd>{riskAudit.riskProfile.eventCount} events / score {riskAudit.riskProfile.reviewScore}</dd></div>
              <div><dt>旗标</dt><dd>{Object.entries(riskAudit.riskProfile.flags).map(([flag, count]) => `${flag}:${count}`).join(" / ") || "none"}</dd></div>
              <div><dt>重点身份</dt><dd>{riskAudit.riskProfile.agents.slice(0, 2).map((profile) => `${playerAgentLabel(profile.agentId)}(${profile.reviewScore})`).join(" / ") || "暂无"}</dd></div>
            </dl>
          ) : null}
          {abuseStatus?.abuseLevel === "restricted" ? (
            <div className="agent-restriction-banner">
              <p>滥用限制 · {abuseStatus.actorKey} · score {abuseStatus.abuseScore}</p>
              <button type="button" disabled={isBusy || !operatorKey.trim()} onClick={releaseAbuseRestriction}>解除滥用限制</button>
            </div>
          ) : null}
          {abuseProfiles ? (
            <>
              <dl>
                <div><dt>滥用画像</dt><dd>{abuseProfiles.total} total / {abuseProfiles.restricted} restricted / {abuseProfiles.watch} watch</dd></div>
              </dl>
              <div className="agent-mini-list">
                {abuseProfiles.profiles.slice(0, 4).map((profile) => (
                  <span key={profile.actorKey}>
                    <b>{profile.abuseLevel} · score {profile.score}</b>
                    <em>{profile.actorKey}</em>
                    <small>{Object.entries(profile.reasons).map(([reason, count]) => `${reason}:${count}`).join(" / ") || "none"}</small>
                    <small>{profile.latestEventId} · {formatDate(profile.updatedAt)}</small>
                  </span>
                ))}
              </div>
            </>
          ) : null}
          <div className="agent-mini-list">
            {riskAuditEvents.slice(0, 4).map((event) => (
              <span key={event.eventId}>
                <b>{playerEventTypeLabel(event.eventType)} · score {event.reviewScore}</b>
                <em>{event.reviewFlags.join(" / ") || "review"}</em>
                <small>{formatDate(event.createdAt)} · {event.agentId || event.aggregateId}</small>
                <small>
                  {event.riskReview
                    ? `${RISK_REVIEW_RESOLUTION_LABELS[event.riskReview.resolution]} · ${formatDate(event.riskReview.reviewedAt)}`
                    : "待处置"}
                </small>
                <a href={`${AGENT_SERVER_BASE}${event.publicPages.audit}`} target="_blank" rel="noreferrer">公开审计</a>
                <div className="agent-option-actions">
                  {RISK_REVIEW_RESOLUTIONS.map((resolution) => (
                    <button
                      key={resolution}
                      type="button"
                      disabled={isBusy || !operatorKey.trim()}
                      onClick={() => recordRiskReview(event, resolution)}
                    >
                      {RISK_REVIEW_RESOLUTION_LABELS[resolution]}
                    </button>
                  ))}
                </div>
              </span>
            ))}
          </div>
          {!riskAuditEvents.length ? <p>风险审计会列出带有 reviewFlags 的市场成交，也可查看服务器拒绝的写命令。</p> : null}
        </article>

        <EncounterPanel
          activeIdentityDisabled={activeIdentityDisabled}
          anomalyFocus={anomalyFocus}
          contestAnomaly={contestAnomaly}
          contestResourceNode={contestResourceNode}
          contributeObjective={contributeObjective}
          epochAssetUrl={epochAssetUrl}
          isBusy={isBusy}
          loadAnomalies={loadAnomalies}
          loadObjectives={loadObjectives}
          loadResourceNodes={loadResourceNodes}
          objectiveAmount={objectiveAmount}
          objectiveTemplateKey={objectiveTemplateKey}
          operatorKey={operatorKey}
          primaryAnomaly={primaryAnomaly}
          primaryObjective={primaryObjective}
          primaryResourceNode={primaryResourceNode}
          resolveAnomaly={resolveAnomaly}
          resourceLabels={PLAYER_RESOURCE_LABELS}
          resourceNodeStamina={resourceNodeStamina}
          seedObjective={seedObjective}
          setAnomalyFocus={setAnomalyFocus}
          setObjectiveAmount={setObjectiveAmount}
          setObjectiveTemplateKey={setObjectiveTemplateKey}
          setResourceNodeStamina={setResourceNodeStamina}
          settleObjective={settleObjective}
          settleResourceNode={settleResourceNode}
          spawnAnomaly={spawnAnomaly}
          spawnResourceNode={spawnResourceNode}
        />

        <SeasonPanel
          activeIdentityDisabled={activeIdentityDisabled}
          agentServerBase={AGENT_SERVER_BASE}
          contributeSeason={contributeSeason}
          epochAssetUrl={epochAssetUrl}
          formatDate={formatDate}
          hasOperatorKey={Boolean(operatorKey.trim())}
          isBusy={isBusy}
          lastSeasonContribution={lastSeasonContribution}
          loadSeasons={loadSeasons}
          playerFactionLabel={playerFactionLabel}
          playerRegionLabel={playerRegionLabel}
          primarySeason={primarySeason}
          resourceLabels={PLAYER_RESOURCE_LABELS}
          seasonAmount={seasonAmount}
          seasonContributionReceipts={seasonContributionReceipts}
          seasonFactionId={seasonFactionId}
          seasonObjectiveEventLabels={SEASON_OBJECTIVE_EVENT_LABELS}
          seasonPhaseLabels={SEASON_PHASE_LABELS}
          seasonTemplateKey={seasonTemplateKey}
          seasonTemplateOptions={SEASON_TEMPLATE_OPTIONS}
          seedSeason={seedSeason}
          setSeasonAmount={setSeasonAmount}
          setSeasonFactionId={setSeasonFactionId}
          setSeasonTemplateKey={(value) => setSeasonTemplateKey(value as typeof seasonTemplateKey)}
          settleSeason={settleSeason}
        />

        <CompetitiveLadderPanel
          isBusy={isBusy}
          ladder={competitiveLadder}
          mode={competitiveLadderMode}
          onLoad={() => loadCompetitiveLadder()}
          onModeChange={(mode) => {
            setCompetitiveLadderMode(mode);
            void loadCompetitiveLadder(mode);
          }}
        />

        <WorldOverviewPanel
          agentServerBase={AGENT_SERVER_BASE}
          epochAssetUrl={epochAssetUrl}
          formatDate={formatDate}
          isBusy={isBusy}
          onLoadWorldOverview={loadWorldOverview}
          worldOverview={worldOverview}
          worldOverviewPage={worldOverviewPage}
        />

        <PublicWorldPanel
          fallbackText={DEMO_CONTRACT.mandate}
          isBusy={isBusy}
          onLoadPublicWorld={loadPublicWorld}
          publicWorld={publicWorld}
        />

        <MarketPanel
          activeIdentityDisabled={activeIdentityDisabled}
          currentAgentId={currentAgentId}
          currentMarketRestriction={currentMarketRestriction}
          formatDate={formatDate}
          isBusy={isBusy}
          marketOrders={marketOrders}
          marketSellMode={marketSellMode}
          onCancelMarketOrder={cancelMarketOrder}
          onCreateMarketOrder={createMarketOrder}
          onFillMarketOrder={fillMarketOrder}
          onLoadMarket={loadMarket}
          onReleaseMarketRiskRestriction={releaseMarketRiskRestriction}
          onTickMarketExpiry={tickMarketExpiry}
          operatorKey={operatorKey}
          priceAmount={priceAmount}
          priceResourceId={priceResourceId}
          primaryMarketOrder={primaryMarketOrder}
          resourceLabels={PLAYER_RESOURCE_LABELS}
          sellAmount={sellAmount}
          sellItemId={sellItemId}
          sellResourceId={sellResourceId}
          setMarketSellMode={setMarketSellMode}
          setPriceAmount={setPriceAmount}
          setPriceResourceId={setPriceResourceId}
          setSellAmount={setSellAmount}
          setSellItemId={setSellItemId}
          setSellResourceId={setSellResourceId}
          tradableInventoryItems={tradableInventoryItems}
        />

        <DirectTradePanel
          acceptDirectTrade={acceptDirectTrade}
          actionableDirectTrades={actionableDirectTrades}
          activeIdentityDisabled={activeIdentityDisabled}
          agentServerBase={AGENT_SERVER_BASE}
          cancelDirectTrade={cancelDirectTrade}
          createDirectTrade={createDirectTrade}
          currentAgentId={currentAgentId}
          currentMarketRestriction={currentMarketRestriction}
          directTradeAssetLabel={directTradeAssetLabel}
          directTradeAuditEvents={directTradeAuditEvents}
          directTradeAuditTradeId={directTradeAuditTradeId}
          directTradeCounterpartyAgentId={directTradeCounterpartyAgentId}
          directTradeCounterpartyItemStatus={directTradeCounterpartyItemStatus}
          directTradeDirectionFilter={directTradeDirectionFilter}
          directTradeListSearch={directTradeListSearch}
          directTradeOfferAmount={directTradeOfferAmount}
          directTradeOfferItemId={directTradeOfferItemId}
          directTradeOfferItemSearch={directTradeOfferItemSearch}
          directTradeOfferMode={directTradeOfferMode}
          directTradeOfferResourceId={directTradeOfferResourceId}
          directTradeRequestAmount={directTradeRequestAmount}
          directTradeRequestItemId={directTradeRequestItemId}
          directTradeRequestItemSearch={directTradeRequestItemSearch}
          directTradeRequestMode={directTradeRequestMode}
          directTradeRequestResourceId={directTradeRequestResourceId}
          directTrades={directTrades}
          directTradeStatusFilter={directTradeStatusFilter}
          filteredDirectTradeCounterpartyItems={filteredDirectTradeCounterpartyItems}
          filteredDirectTradeOfferItems={filteredDirectTradeOfferItems}
          formatDate={formatDate}
          hasOperatorKey={Boolean(operatorKey.trim())}
          incomingDirectTradeCount={incomingDirectTradeCount}
          isBusy={isBusy}
          loadDirectTradeAudit={loadDirectTradeAudit}
          loadDirectTradeCounterpartyItems={loadDirectTradeCounterpartyItems}
          loadDirectTrades={loadDirectTrades}
          outgoingDirectTradeCount={outgoingDirectTradeCount}
          primaryDirectTrade={primaryDirectTrade}
          resourceLabels={PLAYER_RESOURCE_LABELS}
          setDirectTradeCounterpartyAgentId={setDirectTradeCounterpartyAgentId}
          setDirectTradeCounterpartyItemStatus={setDirectTradeCounterpartyItemStatus}
          setDirectTradeCounterpartyItems={setDirectTradeCounterpartyItems}
          setDirectTradeDirectionFilter={setDirectTradeDirectionFilter}
          setDirectTradeListSearch={setDirectTradeListSearch}
          setDirectTradeOfferAmount={setDirectTradeOfferAmount}
          setDirectTradeOfferItemId={setDirectTradeOfferItemId}
          setDirectTradeOfferItemSearch={setDirectTradeOfferItemSearch}
          setDirectTradeOfferMode={setDirectTradeOfferMode}
          setDirectTradeOfferResourceId={setDirectTradeOfferResourceId}
          setDirectTradeRequestAmount={setDirectTradeRequestAmount}
          setDirectTradeRequestItemId={setDirectTradeRequestItemId}
          setDirectTradeRequestItemSearch={setDirectTradeRequestItemSearch}
          setDirectTradeRequestMode={setDirectTradeRequestMode}
          setDirectTradeRequestResourceId={setDirectTradeRequestResourceId}
          setDirectTradeStatusFilter={setDirectTradeStatusFilter}
          tickDirectTradeExpiry={tickDirectTradeExpiry}
          visibleDirectTrades={visibleDirectTrades}
        />

        <BountyPanel
          activeIdentityDisabled={activeIdentityDisabled}
          bounties={bounties}
          bountyEvidence={bountyEvidence}
          bountyFulfillmentItemId={bountyFulfillmentItemId}
          bountyRequiredItemKey={bountyRequiredItemKey}
          bountyRewardAmount={bountyRewardAmount}
          bountyTitle={bountyTitle}
          claimBounty={claimBounty}
          createBounty={createBounty}
          currentAgentId={currentAgentId}
          isBusy={isBusy}
          loadBounties={loadBounties}
          primaryBounty={primaryBounty}
          resourceLabels={PLAYER_RESOURCE_LABELS}
          setBountyEvidence={setBountyEvidence}
          setBountyFulfillmentItemId={setBountyFulfillmentItemId}
          setBountyRequiredItemKey={setBountyRequiredItemKey}
          setBountyRewardAmount={setBountyRewardAmount}
          setBountyTitle={setBountyTitle}
          tradableInventoryItems={tradableInventoryItems}
        />

        <PartyRunPanel
          activeIdentityDisabled={activeIdentityDisabled}
          agentServerBase={AGENT_SERVER_BASE}
          createPartyRun={createPartyRun}
          currentAgentId={currentAgentId}
          formatDate={formatDate}
          hasOperatorKey={Boolean(operatorKey.trim())}
          isBusy={isBusy}
          joinPartyRun={joinPartyRun}
          loadPartyInviteAudit={loadPartyInviteAudit}
          loadPartyRuns={loadPartyRuns}
          participantRole={participantRole}
          partyInviteAuditEvents={partyInviteAuditEvents}
          partyInviteRecipientAgentId={partyInviteRecipientAgentId}
          partyInviteToken={partyInviteToken}
          partyInviteTokenUseLimit={partyInviteTokenUseLimit}
          partyJoinRequestNote={partyJoinRequestNote}
          partyObjective={partyObjective}
          partyRuns={partyRuns}
          partyTitle={partyTitle}
          pendingPartyJoinRequestCount={pendingPartyJoinRequestCount}
          primaryPartyRun={primaryPartyRun}
          requestPartyJoin={requestPartyJoin}
          resolvePartyJoinRequest={resolvePartyJoinRequest}
          resourceLabels={PLAYER_RESOURCE_LABELS}
          revokePartyInvite={revokePartyInvite}
          rotatePartyInvite={rotatePartyInvite}
          setParticipantRole={setParticipantRole}
          setPartyInviteRecipientAgentId={setPartyInviteRecipientAgentId}
          setPartyInviteToken={setPartyInviteToken}
          setPartyInviteTokenUseLimit={setPartyInviteTokenUseLimit}
          setPartyJoinRequestNote={setPartyJoinRequestNote}
          setPartyObjective={setPartyObjective}
          setPartyTitle={setPartyTitle}
          settlePartyRun={settlePartyRun}
        />

        <RaidRetaliationPanel
          activeIdentityDisabled={activeIdentityDisabled}
          canResolveRegionRevolt={Boolean(primarySeason)}
          currentAgentId={currentAgentId}
          defenderAgentId={defenderAgentId}
          isBusy={isBusy}
          loadRaids={loadRaids}
          primaryRaid={primaryRaid}
          primaryRetaliation={primaryRetaliation}
          raidStamina={raidStamina}
          raids={raids}
          resolveRaid={resolveRaid}
          resolveRegionRevolt={resolveRegionRevolt}
          resolveRetaliation={resolveRetaliation}
          retaliationStamina={retaliationStamina}
          revoltStamina={revoltStamina}
          setDefenderAgentId={setDefenderAgentId}
          setRaidStamina={setRaidStamina}
          setRetaliationStamina={setRetaliationStamina}
          setRevoltStamina={setRevoltStamina}
        />

        <RelationshipDiplomacyPanel
          activeIdentityDisabled={activeIdentityDisabled}
          currentAgentId={currentAgentId}
          diplomacy={diplomacy}
          diplomacyResponseFocus={diplomacyResponseFocus}
          diplomacyTerms={diplomacyTerms}
          epochAssetUrl={epochAssetUrl}
          hasExplorer={Boolean(explorer)}
          isBusy={isBusy}
          loadDiplomacy={loadDiplomacy}
          loadRelationships={loadRelationships}
          primaryDiplomacy={primaryDiplomacy}
          primaryRelationship={primaryRelationship}
          proposeDiplomacy={proposeDiplomacy}
          regionDiplomacy={region?.diplomacy || []}
          relationshipFocus={relationshipFocus}
          relationshipKind={relationshipKind}
          relationships={relationships}
          relationshipTargetAgentId={relationshipTargetAgentId}
          respondDiplomacy={respondDiplomacy}
          setDiplomacyResponseFocus={setDiplomacyResponseFocus}
          setDiplomacyTerms={setDiplomacyTerms}
          setRelationshipFocus={setRelationshipFocus}
          setRelationshipKind={setRelationshipKind}
          setRelationshipTargetAgentId={setRelationshipTargetAgentId}
          updateRelationship={updateRelationship}
        />

        <article className="agent-panel">
          <div className="agent-panel-head">
            <span>结果页</span>
            <b>{sharedResultPage ? sharedResultPage.pageId : resultPage ? formatDate(resultPage.generatedAt) : "preview"}</b>
          </div>
          <div className="agent-action-row">
            <button type="button" disabled={isBusy || !currentAgentId} onClick={loadResultPage}>生成预览</button>
            <button type="button" disabled={isBusy || !currentAgentId || !explorer} onClick={publishResultPage}>创建链接</button>
            <small>{RESULT_PUBLISH_AUTHORIZATION_COPY}</small>
            <button type="button" disabled={isBusy || !sharedResultPage || sharedResultPage.status === "revoked" || !explorer} onClick={revokeSharedResultPage}>隐藏链接</button>
          </div>
          {sharedResultPage && sharedResultPage.status !== "revoked" ? (
            <a className="agent-result-link" href={`${AGENT_SERVER_BASE}${sharedResultPage.urlPath}`} target="_blank" rel="noreferrer">
              打开共享结果
            </a>
          ) : null}
          {sharedResultPage?.status === "revoked" ? (
            <small>共享结果已隐藏 · {sharedResultPage.revokedAt ? formatDate(sharedResultPage.revokedAt) : "revoked"}</small>
          ) : null}
          {shareCardStatus ? (
            <div
              className={`agent-share-status-card ${shareCardStatus.visualState === "confirmed" ? "is-confirmed" : "is-provisional"}`}
              aria-label="分享卡状态标识"
            >
              <span>
                <b>设定层级</b>
                <em>{shareCardStatus.level}</em>
              </span>
              <span>
                <b>来源记录</b>
                <em>服务器已记录</em>
              </span>
              <span>
                <b>是否已证实</b>
                <em>{shareCardStatus.confirmedLabel}</em>
              </span>
              <small>{playerPublicSummaryText(shareCardStatus.publicSafeSummary.text)}</small>
              <small>{shareCardStatus.note}</small>
            </div>
          ) : null}
          {resultPage ? (
            <>
              <div className="agent-settlement-flow" aria-label="四屏结算">
                <div className="agent-settlement-tabs" role="tablist" aria-label="结算四屏导航">
                  {RESULT_SETTLEMENT_SCREENS.map((screen) => (
                    <button
                      key={screen.key}
                      type="button"
                      role="tab"
                      aria-selected={resultSettlementScreen === screen.key}
                      onClick={() => setResultSettlementScreen(screen.key)}
                    >
                      {screen.label}
                    </button>
                  ))}
                </div>
                <section className="agent-settlement-screen" aria-label={`结算屏：${activeSettlementScreen.label}`}>
                  <span>{activeSettlementScreen.label}</span>
                  <strong>{resultSettlementSummary}</strong>
                  <small>{activeSettlementScreen.caption}</small>
                  {activeSettlementScreen.key === "drop" ? (
                    <div className="agent-impact-minimap" aria-label="小地图影响切片">
                      {resultImpactItems.length ? resultImpactItems.map((item) => (
                        <span key={`${item.kind}-${item.label}-${item.detail}`}>
                          <b>{item.kind}</b>
                          <em>{item.label}</em>
                          <small>{item.detail}</small>
                        </span>
                      )) : (
                        <span>
                          <b>地点</b>
                          <em>{playerRegionLabel(resultPage?.regionalContext?.regionId || regionId)}</em>
                          <small>暂无本局影响切片</small>
                        </span>
                      )}
                    </div>
                  ) : null}
                  <button
                    type="button"
                    className="agent-settlement-primary-action"
                    disabled={isBusy || !resultPage}
                    onClick={runSettlementPrimaryAction}
                  >
                    {activeSettlementScreen.primaryAction}
                  </button>
                </section>
              </div>
              <dl>
                <div><dt>身份</dt><dd>{resultPage.progress.identity?.identityName || "未命名"}</dd></div>
                {resultPage.focusTurnCard?.resolution ? (
                  <div><dt>本回合</dt><dd>{resultPage.focusTurnCard.resolution.optionLabel} · {resultPage.focusTurnCard.resolution.outcomeSummary}</dd></div>
                ) : null}
                {resultPage.focusHostedSession?.actions.at(-1) ? (
                  <div><dt>托管/桥接</dt><dd>{resultPage.focusHostedSession.actions.at(-1)?.optionLabel} · {resultPage.focusHostedSession.actions.at(-1)?.outcomeSummary}</dd></div>
                ) : null}
                {resultPage.receipt ? (
                  <div><dt>校验证明</dt><dd>服务器已结算 · {(resultPage.receipt?.canonicalEvents || []).length} 条可校验记录</dd></div>
                ) : null}
                <div><dt>事件</dt><dd>{(resultPage.progress.latestEvents || []).length}</dd></div>
                <div><dt>资源</dt><dd>{resourceEntries(resultPage.progress.resources || {}).filter((item) => item.amount > 0).map((item) => `${item.label}${item.amount}`).join(" / ") || "无"}</dd></div>
                {lastExplorationMetrics ? (
                  <>
                    <div><dt>完整探索</dt><dd>战力 {lastExplorationMetrics.combatPower} · 评分 {lastExplorationMetrics.rating} · 强度 {lastExplorationMetrics.intensity}</dd></div>
                    <div><dt>风险分布</dt><dd>低 {lastExplorationMetrics.riskBreakdown.low} / 中 {lastExplorationMetrics.riskBreakdown.medium} / 高 {lastExplorationMetrics.riskBreakdown.high}</dd></div>
                    <div><dt>资源增量</dt><dd>{formatDeltaRecord(lastExplorationMetrics.resourceDelta)}</dd></div>
                    <div><dt>属性增量</dt><dd>{formatDeltaRecord(lastExplorationMetrics.attributeDelta)}</dd></div>
                    <div><dt>记忆增量</dt><dd>确认 {signedDelta(lastExplorationMetrics.memoryDelta.confirmed)} / 传闻 {signedDelta(lastExplorationMetrics.memoryDelta.rumor)} / 私有 {signedDelta(lastExplorationMetrics.memoryDelta.private)}</dd></div>
                  </>
                ) : (
                  <div><dt>完整探索</dt><dd>metrics 尚未返回；后端完成后会显示战力、评分、风险和增量。</dd></div>
                )}
                {resultPage.regionalContext ? (
                  <div><dt>区域上下文</dt><dd>{playerRegionLabel(resultPage.regionalContext.regionId)} · {resultPage.regionalContext.regionControl?.controllingFactionId ? "已有公开控制者" : "暂无阵营掌控"} · 发言 {(resultPage.regionalContext.messages || []).length} / 新闻 {(resultPage.regionalContext.news || []).length} / 委托 {(resultPage.regionalContext.commissions || []).length} / 对抗 {(resultPage.regionalContext.raids || []).length + (resultPage.regionalContext.retaliations || []).length + (resultPage.regionalContext.traces || []).length}</dd></div>
                ) : null}
              </dl>
              <PublicReceiptDisclosure
                agentServerBase={AGENT_SERVER_BASE}
                eventTypeLabel={playerEventTypeLabel}
                resultPage={resultPage}
              />
              <GameRunTimeline
                eventTypeLabel={playerEventTypeLabel}
                formatDate={formatDate}
                resultPage={resultPage}
              />
              <ResultNavigation
                assetUrl={epochAssetUrl}
                resultPage={resultPage}
                sourceTypeLabel={playerSourceTypeLabel}
                toolLabel={playerToolLabel}
              />
              {resultPage.regionalContext ? (
                <div className="agent-mini-list">
                  <span>
                    区域控制 · {resultPage.regionalContext.regionControl
                      ? `已有公开控制者 · 控制分 ${resultPage.regionalContext.regionControl.controlScore}`
                      : "暂无公开控制者"}
                  </span>
                  {resultPage.regionalContext.messages.slice(0, 2).map((message) => (
                    <span key={message.messageId}>发言 · {message.body}</span>
                  ))}
                  {resultPage.regionalContext.news.slice(0, 2).map((news) => (
                    <span className="agent-surface-media-row" key={news.newsId}>
                      <img
                        className="agent-surface-media-image"
                        src={epochAssetUrl(news.media.imageUrl)}
                        alt={news.media.publicAlt}
                        loading="lazy"
                      />
                      <span>新闻 · {news.headline}</span>
                    </span>
                  ))}
                  {resultPage.regionalContext.commissions.slice(0, 2).map((commission) => (
                    <span className={commission.media ? "agent-activity-media-row" : undefined} key={commission.commissionId}>
                      {commission.media ? (
                        <img
                          className="agent-activity-media-image"
                          src={epochAssetUrl(commission.media.imageUrl)}
                          alt={commission.media.publicAlt}
                          loading="lazy"
                        />
                      ) : null}
                      <span>委托 · {commission.actionLabel} · {commission.title}</span>
                    </span>
                  ))}
                  {resultPage.regionalContext.raids.slice(0, 2).map((raid) => (
                    <span key={raid.raidId}>对抗战报 · {playerCommonStatusLabel(raid.outcome)} · 进攻方 {shortHash(raid.attackerAgentId)} 对防守方 {shortHash(raid.defenderAgentId)}</span>
                  ))}
                  {resultPage.regionalContext.retaliations.slice(0, 2).map((retaliation) => (
                    <span key={retaliation.retaliationId}>复仇契机 · {playerCommonStatusLabel(retaliation.status)} · 发起者 {shortHash(retaliation.opportunityAgentId)} 对目标 {shortHash(retaliation.targetAgentId)}</span>
                  ))}
                  {resultPage.regionalContext.traces.slice(0, 2).map((trace) => (
                    <span key={trace.traceId}>冲突轨迹 · {playerEventTypeLabel(trace.sourceEventType)} · {trace.summary}</span>
                  ))}
                </div>
              ) : null}
            </>
          ) : (
            <p>一次性网页结果会使用这里的 share-safe payload。</p>
          )}
        </article>

        <article className="agent-panel">
          <div className="agent-panel-head">
            <span>安装包入口</span>
            <b>{installManifest?.version || "manifest"}</b>
          </div>
          <div className="agent-action-row">
            <button type="button" disabled={isBusy} onClick={loadInstallManifest}>查看</button>
            <button type="button" disabled={isBusy} onClick={downloadPackage}>下载包</button>
            <button type="button" disabled={isBusy} onClick={downloadInstallManifest}>下载配置</button>
          </div>
          <dl>
            <div><dt>宿主</dt><dd>{installManifest?.hosts.join(" / ") || "Claude Code / Codex / Cursor / Hermes / OpenClaw"}</dd></div>
            <div><dt>本地技能</dt><dd>{installManifest?.skill.name || "黑曜纪元"}</dd></div>
            <div><dt>世界</dt><dd>{installManifest?.publicPages.world || "/epoch/world"}</dd></div>
            <div><dt>上手</dt><dd>{installManifest?.playbooks.oneTurn || "obsidian-epoch/references/one-turn-playbook.md"}</dd></div>
            <div><dt>验收</dt><dd>{installManifest?.playbooks.smokeE2E || "obsidian-epoch/references/smoke-playbook.md"}</dd></div>
          </dl>
        </article>

        <article className="agent-panel">
          <div className="agent-panel-head">
            <span>最近事件</span>
            <b>{(progress?.latestEvents || []).length}</b>
          </div>
          <div className="agent-event-list">
            {(progress?.latestEvents || []).slice(0, 6).map((event) => (
              <span key={event.eventId}>
                <b>{playerEventTypeLabel(event.eventType)}</b>
                <em>{formatDate(event.createdAt)}</em>
              </span>
            ))}
          </div>
        </article>

        <article className="agent-panel">
          <div className="agent-panel-head">
            <span>默认 agent</span>
            <b>{DEFAULT_AGENT.riskPolicy}</b>
          </div>
          <strong>{DEFAULT_AGENT.name}</strong>
          <div className="agent-chip-row">
            {DEFAULT_AGENT.temperament.map((item) => <span key={item}>{item}</span>)}
          </div>
          <dl>
            <div><dt>锚点</dt><dd>{DEMO_CONTRACT.anchors.map((anchor) => anchor.label).join(" / ")}</dd></div>
            <div><dt>产出</dt><dd>{DEMO_CONTRACT.allowedClaimTypes.join(" / ")}</dd></div>
          </dl>
        </article>
        </section>
      </details>

      {error ? <section className="agent-error">世界连接：{error}</section> : null}
    </main>
  );
}
