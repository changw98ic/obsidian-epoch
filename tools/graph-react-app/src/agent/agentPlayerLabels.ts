import type {
  EpochChannelClass,
  EpochDeliveryTrust,
  EpochDowntimeMode,
  EpochEvent,
  EpochLoreContributionCategory,
  EpochLoreTargetStatus,
  EpochRelationshipKind,
  EpochResourceId,
  EpochSecretExposureTier,
} from "../types";

export const AGENT_WORLD_TOOLS: readonly (readonly [string, string])[] = [
  ["context_package", "上下文"],
  ["start_run", "票据"],
  ["submit_battle_report", "战报"],
  ["public_world", "世界"],
  ["progression_state", "声望"],
  ["transparency_verify", "校验"],
];

export const EPOCH_TOOLS: readonly (readonly [string, string])[] = [
  ["quickstart", "上手"],
  ["identity", "身份"],
  ["rotate_recovery", "轮换恢复"],
  ["progress", "进度"],
  ["agent_briefing", "简报"],
  ["world_overview", "世界总览"],
  ["agent_memory", "记忆分层"],
  ["confirm_personality_drift", "确认漂移"],
  ["abuse_status", "冷却"],
  ["abuse_profiles", "滥用画像"],
  ["operator_overview", "运营总览"],
  ["run_maintenance", "维护巡检"],
  ["set_downtime", "托管"],
  ["claim_downtime", "领取"],
  ["tick_downtime", "托管tick"],
  ["region_info", "区域"],
  ["messages", "发言"],
  ["post_message", "发言写入"],
  ["moderation_queue", "审核队列"],
  ["resolve_moderation", "审核处理"],
  ["record_risk_review", "风险处置"],
  ["release_market_risk_restriction", "解除限制"],
  ["release_abuse_restriction", "滥用解封"],
  ["generate_region_news", "区域新闻"],
  ["claim_news_legend", "传说领取"],
  ["lore_contributions", "设定贡献列表"],
  ["lore_targets", "设定状态"],
  ["adjudicate_lore_target", "设定裁决"],
  ["record_lore_contribution", "设定贡献"],
  ["objectives", "目标"],
  ["seed_objective", "开目标"],
  ["contribute_objective", "贡献"],
  ["settle_objective", "结算"],
  ["resource_nodes", "资源点"],
  ["spawn_resource_node", "开资源点"],
  ["contest_resource_node", "争抢资源"],
  ["settle_resource_node", "结算资源"],
  ["anomalies", "异常链"],
  ["spawn_anomaly", "开异常"],
  ["contest_anomaly", "压制异常"],
  ["resolve_anomaly", "结算异常"],
  ["inventory", "背包"],
  ["shop", "商店"],
  ["craft_item", "制作"],
  ["purchase_shop_offer", "购买"],
  ["bind_item", "绑定"],
  ["seasons", "赛季"],
  ["seed_season", "开赛季"],
  ["contribute_season", "赛季贡献"],
  ["settle_season", "赛季结算"],
  ["market", "市场"],
  ["create_market_order", "挂单"],
  ["fill_market_order", "成交"],
  ["cancel_market_order", "撤单"],
  ["tick_market_expiry", "市场tick"],
  ["bounties", "悬赏"],
  ["create_bounty", "发悬赏"],
  ["claim_bounty", "领悬赏"],
  ["party_runs", "小队"],
  ["create_party_run", "建小队"],
  ["update_party_invite", "邀请轮换"],
  ["join_party_run", "入小队"],
  ["request_party_join", "申请入队"],
  ["resolve_party_join_request", "审批入队"],
  ["settle_party_run", "结算小队"],
  ["raids", "对抗"],
  ["resolve_raid", "结算对抗"],
  ["resolve_region_revolt", "发动起义"],
  ["resolve_retaliation", "执行复仇"],
  ["relationship_graph", "关系图"],
  ["diplomacy", "外交链"],
  ["propose_diplomacy", "提外交"],
  ["respond_diplomacy", "回外交"],
  ["update_relationship", "更新关系"],
  ["turn_card", "回合卡"],
  ["resolve_turn", "回合结算"],
  ["hosted_sessions", "托管局"],
  ["start_hosted_session", "开托管"],
  ["submit_hosted_action", "行动"],
  ["run_server_hosted_action", "服务器代跑"],
  ["queue_server_hosted_action", "服务器排队"],
  ["server_hosted_jobs", "代跑队列"],
  ["run_server_hosted_job", "执行队列"],
  ["web_bridge_turn", "网页桥接"],
  ["submit_web_bridge_action", "网页行动"],
  ["attestation_challenge", "见证挑战"],
  ["submit_attested_action", "见证行动"],
  ["npc_note", "NPC"],
  ["submit_npc_candidate", "NPC候选"],
  ["review_npc_candidate", "候选复核"],
  ["tick_npc_lifecycle", "NPC tick"],
  ["npc_relationships", "NPC关系"],
  ["npc_memories", "NPC记忆"],
  ["households", "家庭"],
  ["organizations", "组织"],
  ["create_organization", "创建组织"],
  ["update_organization_membership", "组织身份"],
  ["purchase_organization_upgrade", "组织升级"],
  ["contribute_organization_treasury", "组织捐献"],
  ["propose_organization_budget", "预算提案"],
  ["resolve_organization_budget", "预算审批"],
  ["organization_politics", "组织政治"],
  ["tick_organization_politics", "政治tick"],
  ["npc_careers", "职业"],
  ["npc_locations", "迁徙"],
  ["npc_assets", "资产"],
  ["npc_health", "健康"],
  ["social_hooks", "人物事件"],
  ["result_page", "结果页"],
  ["create_result_page", "公开页"],
  ["revoke_result_page", "隐藏结果"],
  ["events", "事件"],
];

export const DOWNTIME_OPTIONS: readonly { readonly value: EpochDowntimeMode; readonly label: string }[] = [
  { value: "meditation", label: "冥想" },
  { value: "cultivation", label: "修炼" },
  { value: "training", label: "锻炼" },
  { value: "resting", label: "休息" },
  { value: "slacking", label: "摸鱼" },
  { value: "travel", label: "外出" },
  { value: "steward", label: "看店" },
  { value: "socialize", label: "社交" },
];

export const PLAYER_DOWNTIME_OPTIONS: readonly {
  readonly value: EpochDowntimeMode;
  readonly label: string;
  readonly caption: string;
}[] = [
  { value: "meditation", label: "冥想 +专注点", caption: "安静恢复，适合长时间等待" },
  { value: "cultivation", label: "修炼 +灵质", caption: "提高成长感，收益偏世界资源" },
  { value: "training", label: "锻炼 +体力", caption: "为争抢、任务和行动准备" },
  { value: "steward", label: "看店 +钱币", caption: "低风险积累基础货币" },
];

export const PLAYER_RESOURCE_LABELS: Record<EpochResourceId, string> = {
  coin: "钱币",
  aether: "灵质",
  stamina: "体力",
  focus: "专注点",
  legend: "传说",
};

export const PLAYER_RESOURCE_CAPTIONS: Record<EpochResourceId, string> = {
  coin: "购买、交易和委托的基础货币",
  aether: "用于修炼、制作和超凡消耗",
  stamina: "行动、争夺和长线推进的体力",
  focus: "本局可用的行动注意力，用来推进探索或处理风险",
  legend: "公开事迹累积出的名望",
};

const PLAYER_LORE_ADJUDICATION_STATUS_LABELS: Record<EpochLoreTargetStatus, string> = {
  confirmed: "确认",
  refuted: "驳回",
  revised: "修订",
  contested: "争议",
};

const PLAYER_LORE_CONTRIBUTION_CATEGORY_LABELS: Record<EpochLoreContributionCategory, string> = {
  confirmation: "确认",
  refutation: "反驳",
  revision: "修订",
};

const PLAYER_REGION_LABELS: Record<string, string> = {
  region_gray_harbor: "灰港",
  region_salt_mirror: "盐镜",
  region_ash_outpost: "灰烬哨站",
  region_glass_archive: "玻璃档案馆",
  region_moonwell_hollow: "月井空壳",
};

const PLAYER_FACTION_LABELS: Record<string, string> = {
  gray_watch: "灰港守望会",
  cinder_archive: "余烬档案会",
  white_tower_compact: "白塔契约团",
  faction_echo: "回声派系",
  "腐林档案会": "腐林档案会",
  "云脑族": "云脑族",
  "赛博工业财团": "赛博工业财团",
};

const PLAYER_EVENT_LABELS: Record<string, string> = {
  identity_issued: "身份签发",
  turn_card_created: "探索节点生成",
  turn_resolved: "行动结算",
  hosted_session_started: "探索节点生成",
  hosted_action_recorded: "探索推进",
  hosted_action_resolved: "托管行动结算",
  server_hosted_job_queued: "服务器托管排队",
  server_hosted_job_completed: "服务器托管完成",
  server_hosted_job_skipped: "服务器托管跳过",
  server_hosted_action_recorded: "服务器托管行动",
  web_bridge_action_recorded: "网页行动结算",
  resource_granted: "收获入账",
  downtime_set: "托管设置",
  downtime_tick_resolved: "托管结算",
  downtime_claimed: "托管领取",
  identity_archived: "身份定档",
  reincarnation_issued: "下一世签发",
  relationship_updated: "关系变化",
  raid_resolved: "对抗结算",
  retaliation_resolved: "反击结算",
  region_news_generated: "区域新闻",
  region_revolt_resolved: "区域起义结算",
  direct_trade_created: "私下交易创建",
  direct_trade_accepted: "私下交易成交",
  direct_trade_cancelled: "私下交易撤回",
  direct_trade_expired: "私下交易过期",
  market_order_created: "市场挂单",
  market_order_filled: "市场成交",
  market_order_cancelled: "市场撤单",
  market_order_expired: "市场过期",
  season_contribution_recorded: "赛季贡献记录",
  season_objective_created: "赛季目标生成",
  season_objective_completed: "赛季目标完成",
  lore_contribution_recorded: "设定贡献记录",
  lore_target_adjudicated: "设定裁决记录",
  organization_created: "组织创建",
  organization_membership_updated: "组织身份更新",
  organization_budget_resolved: "组织预算结算",
  anomaly_spawned: "异常出现",
  anomaly_resolved: "异常结算",
  resource_node_spawned: "资源点出现",
  resource_node_settled: "资源点结算",
  bounty_created: "悬赏发布",
  bounty_claimed: "悬赏领取",
};

const PLAYER_SOURCE_TYPE_LABELS: Record<string, string> = {
  objective: "区域目标",
  resource_node: "资源点",
  anomaly: "异常",
  bounty: "悬赏",
  party_run: "协同行动",
  social_hook: "人物事件",
  retaliation: "反击机会",
};

const PLAYER_IDENTITY_STATUS_LABELS: Record<string, string> = {
  active: "可行动",
  archived: "已定档",
  dead: "已定档",
  missing: "失踪",
  polluted: "污染中",
};

const PLAYER_HOSTED_STATUS_LABELS: Record<string, string> = {
  active: "进行中",
  completed: "已完成",
  failed: "失败",
  none: "暂无",
  queued: "排队中",
  idle: "待选择",
};

const PLAYER_SECRET_TIER_LABELS: Record<EpochSecretExposureTier, string> = {
  T0_public: "公开线索",
  T1_low_rumor: "传闻线索",
  T2_local_secret: "隐藏线索",
  T3_core_secret: "深层线索",
  T4_forbidden_core: "禁忌线索",
};

const PLAYER_DELIVERY_TRUST_LABELS: Record<EpochDeliveryTrust, string> = {
  untrusted_client: "玩家提交",
  user_verified_web: "玩家确认",
  server_hosted_agent: "服务器托管",
  host_attested: "宿主见证",
  remote_attested_runner: "远程见证",
  system_worker: "系统维护",
};

const PLAYER_CHANNEL_CLASS_LABELS: Record<EpochChannelClass, string> = {
  server_hosted: "服务器托管",
  browser_copy_paste: "网页复制提交",
};

const PLAYER_STATUS_LABELS: Record<string, string> = {
  active: "进行中",
  completed: "已完成",
  failed: "失败",
  queued: "排队中",
  open: "待处理",
  accepted: "已接受",
  cancelled: "已撤回",
  expired: "已过期",
  filled: "已成交",
  pending: "待处理",
  approved: "已通过",
  hidden: "已隐藏",
  blocked: "已阻断",
  resolved: "已结算",
  settled: "已结算",
  claimed: "已领取",
  available: "可行动",
  contested: "争夺中",
  controlled: "已控制",
  depleted: "已采尽",
  suppressed: "已压制",
  rejected: "已驳回",
  rejected_flavor: "气质未通过",
  accepted_flavor: "气质已通过",
  draft: "草稿",
  dense: "偏密",
  normal: "正常",
  canonical: "已入典",
  watch: "观察中",
  restricted: "受限",
  severe: "高危",
  moderate: "中等",
  mild: "轻微",
  contained: "已封锁",
  escaped: "已失控",
  attacker_won: "进攻方胜",
  defender_won: "防守方守住",
  retaliator_won: "复仇成功",
  target_held: "目标守住",
  revolt_succeeded: "起义成功",
  revolt_defended: "起义被守住",
  low: "低风险",
  medium: "中风险",
  high: "高风险",
};

const PLAYER_ACTION_LABELS: Record<string, string> = {
  "complete-exploration": "完整探索",
  "set-downtime": "设置托管",
  "claim-downtime": "领取托管收益",
  "tick-downtime": "刷新托管",
  "start-hosted": "开始托管",
  "install-status": "检查安装状态",
  "issue-identity": "开始身份",
  "refresh-progress": "刷新进度",
  "create-result-page": "生成结果页",
  world_message: "世界发言",
  turn_card: "生成回合卡",
  resolve_turn: "结算回合卡",
};

const PLAYER_RELATIONSHIP_KIND_LABELS: Record<EpochRelationshipKind, string> = {
  alliance: "结盟",
  hostility: "敌对",
  reputation: "声望",
};

const TOOL_LABELS = new Map<string, string>([
  ...AGENT_WORLD_TOOLS.map(([name, label]): [string, string] => [`agent_world.${name || ""}`, label || name || "工具"]),
  ...EPOCH_TOOLS.map(([name, label]): [string, string] => [`obsidian_epoch.${name || ""}`, label || name || "工具"]),
]);

export function playerRegionLabel(value?: string | null) {
  if (!value) return "世界";
  return PLAYER_REGION_LABELS[value] || value.replace(/^region_/, "").replace(/_/g, " ");
}

export function playerFactionLabel(value?: string | null) {
  if (!value) return "待定";
  return PLAYER_FACTION_LABELS[value] || value.replace(/^faction_/, "").replace(/_/g, " ");
}

function compactInternalReference(value: string, fallback: string) {
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  const readable = trimmed
    .replace(/^epoch_/, "")
    .replace(/^(agent|explorer|event|raid|retaliation|party_run|party|trace|news|objective|resource_node|anomaly|bounty|direct_trade|market_order|organization|budget|season|confirmation|turn_card|session|action)[_:]/i, "")
    .replace(/[^a-z0-9]+/gi, "");
  const tail = (readable || trimmed).slice(-6);
  return tail ? `${fallback} ${tail}` : fallback;
}

export function playerAgentLabel(value?: string | null) {
  if (!value) return "身份未记录";
  return compactInternalReference(value, "身份");
}

export function playerExplorerLabel(value?: string | null) {
  if (!value) return "玩家未记录";
  return compactInternalReference(value, "玩家");
}

export function playerRecordLabel(value?: string | null, label = "记录") {
  if (!value) return `${label}已记录`;
  return compactInternalReference(value, label);
}

export function playerPublicSummaryText(value?: string | null) {
  const text = value?.trim() || "探索历程已整理为可分享摘要。";
  return text
    .replaceAll("region_gray_harbor", "灰港")
    .replaceAll("Gray Harbor", "灰港")
    .replaceAll("Install Smoke Runner", "安装验收身份")
    .replace(/服务器.{0,2}可校验/g, "校验证明可校验")
    .replace(/^[^·]+ · 灰港 的探索历程已整理为可分享的探索历程摘要。/, "灰港探索历程已整理为可分享摘要。")
    .replace(/灰港 的/g, "灰港的")
    .replace(/\bsha256:[a-f0-9]+\b/gi, "校验码已记录")
    .replace(/\bevents?\s+(\d+)\b/gi, "可校验记录 $1 条");
}

export function playerDowntimeLabel(value?: string | null) {
  return DOWNTIME_OPTIONS.find((option) => option.value === value)?.label || value || "待选择";
}

export function playerResourceLabel(value?: EpochResourceId | string | null) {
  return PLAYER_RESOURCE_LABELS[value as EpochResourceId] || "资源";
}

export function playerResourceCaption(value?: EpochResourceId | string | null) {
  return PLAYER_RESOURCE_CAPTIONS[value as EpochResourceId] || "可用于推进本局的资源";
}

export function playerIdentityStatusLabel(value?: string | null) {
  return PLAYER_IDENTITY_STATUS_LABELS[value || ""] || value || "同步中";
}

export function playerHostedStatusLabel(value?: string | null) {
  return PLAYER_HOSTED_STATUS_LABELS[value || ""] || value || "待选择";
}

export function playerSecretTierLabel(value?: string | null) {
  return PLAYER_SECRET_TIER_LABELS[value as EpochSecretExposureTier] || "线索";
}

export function playerTrustClassLabel(value?: string | null) {
  return PLAYER_DELIVERY_TRUST_LABELS[value as EpochDeliveryTrust] || "已记录";
}

export function playerChannelClassLabel(value?: string | null) {
  return PLAYER_CHANNEL_CLASS_LABELS[value as EpochChannelClass] || playerTrustClassLabel(value);
}

export function playerCommonStatusLabel(value?: string | null) {
  return PLAYER_STATUS_LABELS[value || ""] || "已记录";
}

export function playerLoreAdjudicationStatusLabel(value?: EpochLoreTargetStatus | string | null) {
  return PLAYER_LORE_ADJUDICATION_STATUS_LABELS[value as EpochLoreTargetStatus] || "待确认";
}

export function playerLoreContributionCategoryLabel(value?: EpochLoreContributionCategory | string | null) {
  return PLAYER_LORE_CONTRIBUTION_CATEGORY_LABELS[value as EpochLoreContributionCategory] || "设定贡献";
}

export function playerActionLabel(value?: string | null) {
  return PLAYER_ACTION_LABELS[value || ""] || "操作";
}

export function playerRelationshipKindLabel(value?: string | null) {
  return PLAYER_RELATIONSHIP_KIND_LABELS[value as EpochRelationshipKind] || "关系";
}

export function playerToolLabel(value?: string | null) {
  if (!value) return "继续探索";
  const direct = TOOL_LABELS.get(value);
  if (direct) return direct;
  const trimmed = value.replace(/^obsidian_epoch\./, "").replace(/^agent_world\./, "");
  return TOOL_LABELS.get(`obsidian_epoch.${trimmed}`)
    || TOOL_LABELS.get(`agent_world.${trimmed}`)
    || trimmed.replace(/_/g, " ");
}

export function playerEventLabel(event: EpochEvent) {
  return playerEventTypeLabel(event.eventType);
}

export function playerEventTypeLabel(value?: string | null) {
  return PLAYER_EVENT_LABELS[value || ""] || "事件记录";
}

export function playerSourceTypeLabel(value?: string | null) {
  return PLAYER_SOURCE_TYPE_LABELS[value || ""] || "来源记录";
}
