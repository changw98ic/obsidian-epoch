export const publicResourceLabels: Record<string, string> = {
  coin: "钱币",
  aether: "灵质",
  stamina: "体力",
  focus: "专注点",
  legend: "传说",
};

export const publicResourceDescriptions: Record<string, string> = {
  focus: "本局可用的行动注意力，用来观察、调查和处理风险",
  stamina: "用于移动、战斗和体力行动",
  aether: "用于异常、仪式和高阶事件",
  coin: "用于交易和补给",
  legend: "公开事迹带来的声望",
};

export const publicSourceTypeLabels: Record<string, string> = {
  objective: "区域目标",
  resource_node: "资源点",
  anomaly: "异常",
  bounty: "悬赏",
  party_run: "协同行动",
  social_hook: "人物事件",
  retaliation: "反击机会",
};

export const publicSecretTierLabels: Record<string, string> = {
  T0_public: "公开线索",
  T1_low_rumor: "传闻线索",
  T2_local_secret: "隐藏线索",
  T3_core_secret: "深层线索",
  T4_forbidden_core: "禁忌线索",
};

export const publicPlayModeLabels: Record<string, string> = {
  ranked: "正式",
  casual: "休闲",
  sandbox: "沙盒",
  verified: "已验证",
};

export const publicTrustTierLabels: Record<string, string> = {
  server_settled: "服务器结算",
  untrusted_capped: "浏览器提交，奖励受限",
  private_sandbox: "本地试玩",
  verified_autonomous: "可信托管",
};

export const publicReceiptFocusLabels: Record<string, string> = {
  turn_card: "探索节点",
  hosted_session: "托管历程",
  agent_snapshot: "身份快照",
  explorer_snapshot: "玩家快照",
};

export const publicTrustedRunnerLabels: Record<string, string> = {
  runner_http_remote: "远程受信运行器",
};

export const publicEventTypeLabels: Record<string, string> = {
  identity_issued: "身份入场",
  turn_card_created: "探索节点生成",
  turn_resolved: "完成行动",
  hosted_session_started: "探索节点生成",
  resource_granted: "收获入账",
  hosted_action_recorded: "托管行动",
  journey_world_solidified: "镜像对局固化",
  downtime_set: "托管设置",
  downtime_tick_resolved: "托管结算",
  downtime_claimed: "托管领取",
  identity_archived: "身份定档",
  reincarnation_issued: "下一世签发",
  relationship_updated: "关系变化",
  message_posted: "区域发言",
  raid_resolved: "对抗结算",
  retaliation_resolved: "反击结算",
  region_news_generated: "区域新闻",
  season_campaign_created: "赛季创建",
  season_started: "赛季开始",
  season_objective_created: "赛季目标创建",
  season_contribution_recorded: "赛季贡献",
  season_objective_completed: "赛季目标完成",
  season_campaign_resolved: "赛季结算",
  season_resolved: "赛季结算",
  contested_objective_contributed: "区域目标推进",
  contested_objective_settled: "区域目标结算",
  resource_node_contested: "资源点争夺",
  resource_node_settled: "资源点结算",
  anomaly_event_spawned: "异常出现",
  anomaly_event_resolved: "异常结算",
  anomaly_resolved: "异常结算",
  market_order_created: "市场挂单",
  market_order_filled: "市场成交",
  market_order_cancelled: "市场撤单",
  market_order_expired: "市场过期",
  direct_trade_created: "私下交易创建",
  direct_trade_accepted: "私下交易完成",
  direct_trade_cancelled: "私下交易取消",
  direct_trade_expired: "私下交易过期",
  party_run_created: "小队开启",
  party_member_joined: "小队加入",
  party_join_request_created: "小队申请",
  party_join_request_resolved: "小队申请处理",
  diplomacy_proposed: "外交提案",
  diplomacy_responded: "外交回应",
  server_hosted_job_queued: "代跑排队",
  server_hosted_job_completed: "代跑完成",
  server_hosted_job_skipped: "代跑跳过",
  social_hook_created: "人物事件",
  lore_contribution_recorded: "设定贡献",
  lore_target_adjudicated: "设定裁决",
};

export const publicStatusLabels: Record<string, string> = {
  active: "进行中",
  archived: "已定档",
  open: "开放",
  resolved: "已结算",
  settled: "已结算",
  completed: "已完成",
  pending: "待回应",
  queued: "排队中",
  skipped: "已跳过",
  filled: "已成交",
  cancelled: "已撤单",
  expired: "已过期",
  approved: "已通过",
  accepted: "已接受",
  rejected: "已驳回",
  controlling: "掌控中",
  challenging: "争夺中",
  attacker_advancing: "进攻推进",
  defender_holding: "防守稳住",
  contested: "争夺中",
  confirmed: "已证实",
  refuted: "已反证",
  revised: "已修订",
  contained: "已收束",
  escaped: "已外溢",
  quiet: "平静",
  warm: "升温",
  hot: "高热",
  within_quota: "正常密度",
  dense: "过密",
  left: "已离开",
  attacker_won: "进攻方胜出",
  defender_won: "防守方守住",
  low: "低风险",
  medium: "中风险",
  high: "高风险",
  minor: "轻微",
  major: "重大",
  cataclysm: "灾变",
};

export const publicFactionLabels: Record<string, string> = {
  gray_watch: "灰港守望",
  cinder_archive: "烬火档案馆",
  white_tower_compact: "白塔盟约",
};

export const publicRarityLabels: Record<string, string> = {
  common: "普通",
  uncommon: "少见",
  rare: "稀有",
  epic: "史诗",
  legendary: "传说",
};

export const publicTrustClassLabels: Record<string, string> = {
  user_verified_web: "玩家确认",
  untrusted_client: "浏览器提交",
  server_settled: "服务器结算",
  server_hosted_agent: "服务器托管",
  host_attested: "宿主验签",
  remote_attested_runner: "远程验签",
  system_worker: "系统结算",
};

export const publicKindLabels: Record<string, string> = {
  alliance: "同盟",
  hostility: "敌对",
  reputation: "声望",
  spouse: "伴侣",
  parent: "父母",
  child: "子女",
  relative: "亲属",
  friend: "友人",
  enemy: "敌人",
  superior: "上级",
  subordinate: "下属",
  mentor: "导师",
  apprentice: "学徒",
  creditor: "债主",
  debtor: "债务人",
  promotion: "晋升",
  patronage: "庇护",
  rivalry: "竞争",
  scandal: "丑闻",
  reform: "改革",
  household: "家庭",
  social_hook: "人物事件",
};

export const publicDowntimeModeLabels: Record<string, string> = {
  meditation: "冥想",
  cultivation: "修行",
  training: "训练",
  resting: "休息",
  slacking: "摸鱼",
  travel: "旅行",
  steward: "照管事务",
  socialize: "社交",
};

const publicRegionLabels: Record<string, string> = {
  region_gray_harbor: "灰港",
  region_salt_mirror: "盐镜",
  region_salt_mirror_coast: "盐镜海岸",
  region_ash_outpost: "灰烬哨站",
  region_glass_archive: "玻璃档案馆",
  region_moonwell_hollow: "月井空壳",
  region_blackharbor: "黑港",
  region_forest: "腐林",
  region_salt_gate: "盐门",
  region_ash: "灰烬荒原",
  region_ash_waste: "灰烬荒原",
  region_city_pipes: "管城",
  region_abandoned_mine: "废弃矿区",
  region_data_tower: "废弃数据塔",
  region_orbit_city: "轨道城",
  region_trench: "深沟",
  region_collective_dream_pool: "集体梦池",
  region_space_rift: "空间裂缝",
  region_non_euclidean_cave: "非欧洞穴",
  region_starship_graveyard: "星舰墓场",
  region_abandoned_subway: "废弃地铁",
  region_holographic_theater: "全息剧场",
  region_quantum_laboratory: "量子实验室",
  region_reflective_city: "镜面城",
  region_data_alley: "数据巷",
  region_prism_waters: "棱镜水域",
  region_probability_greenhouse: "概率温室",
  region_prophecy_server: "预言服务器",
  region_orbital_cathedral: "轨道圣堂",
};

export function publicRegionLabel(regionId: string | undefined): string {
  if (!regionId) return "未知区域";
  return publicRegionLabels[regionId] || regionId.replace(/^region_/, "").replace(/_/g, " ");
}

function escapePublicLabelPattern(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function replaceKnownPublicLabels(text: string, labels: Record<string, string>): string {
  return Object.entries(labels).reduce((next, [raw, label]) =>
    next.replace(new RegExp(`\\b${escapePublicLabelPattern(raw)}\\b`, "g"), label), text);
}

export function publicText(value: unknown): string {
  let text = replaceKnownPublicLabels(String(value ?? ""), publicRegionLabels);
  text = replaceKnownPublicLabels(text, publicEventTypeLabels);
  text = text
    .replace(/\bsha256:[a-f0-9]+\b/gi, "校验码已记录")
    .replace(/\bclaim:[a-z0-9:._-]+\b/gi, "设定条目")
    .replace(/\b(gray_watch|cinder_archive|white_tower_compact)\b/g, (match) => publicFactionLabels[match] || match)
    .replace(/\bassets_delta\b/g, "资产变化")
    .replace(/\bwork_status\b/g, "工作状态")
    .replace(/\bmarried_to\b/g, "伴侣关系")
    .replace(/\bworld_news\b/g, "世界新闻")
    .replace(/\blocal_alpha_fallback\b/g, "本地预览签名")
    .replace(/\blifecycle_training\b/g, "训练记录")
    .replace(/\blifecycle_debt_obligation\b/g, "债务记录")
    .replace(/\blifecycle_work_friend\b/g, "工作友谊")
    .replace(/\blifecycle_marriage\b/g, "婚姻记录")
    .replace(/\blifecycle_workplace\b/g, "职场记录")
    .replace(/\bpage-visible\b/g, "公开页可见")
    .replace(/\bworking\b/g, "工作中")
    .replace(/\bminor\b/g, "轻微")
    .replace(/\bmajor\b/g, "重大")
    .replace(/\bcritical\b/g, "危急")
    .replace(/\bsmoke_terminal_archive\b/gi, "终局归档")
    .replace(/smoke terminal archive/gi, "终局归档")
    .replace(/\b\d{10,}\b/g, "")
    .replace(/\b[a-z0-9]+(?:_[a-z0-9]+)*_agent_[a-z0-9_]+\b/gi, "行动身份")
    .replace(/\b[a-z0-9]+(?:_[a-z0-9]+)*_explorer_[a-z0-9_]+\b/gi, "玩家")
    .replace(/\b(epoch_agent|epoch_event|epoch_page|epoch_turn_card|epoch_agent_install|server_hosted_job|turn_card|session|action|npc|npc_candidate|news|objective|resource_node|anomaly|order|direct_trade|bounty|party_run|raid|retaliation|relationship|diplomacy|agent_npc_bond|npc_memory|household|organization|organization_membership|organization_politics|npc_career|npc_location|npc_asset|npc_health|item|social_hook|season|trace|monument|message|legend_award|moderation|risk_review|confirmation|lore_contribution|lore_adjudication|command|correlation)_[a-z0-9_]+\b/gi, "公开记录")
    .replace(/\b[a-z0-9]+(?:_[a-z0-9]+)*_(event|page|turn_card|install|job|session|action|order|trade|raid|retaliation|trace|objective|resource_node|anomaly|npc|message|season|party_run|party_join_request|lore_contribution|lore_adjudication)_[a-z0-9_]+\b/gi, "公开记录")
    .replace(/region_gray_harbor/g, "灰港")
    .replace(/region_salt_mirror/g, "盐镜")
    .replace(/region_salt_mirror_coast/g, "盐镜海岸")
    .replace(/region_ash_outpost/g, "灰烬哨站")
    .replace(/region_glass_archive/g, "玻璃档案馆")
    .replace(/region_moonwell_hollow/g, "月井空壳")
    .replace(/\bregion blackharbor\b/g, "黑港")
    .replace(/\bregion salt mirror coast\b/g, "盐镜海岸")
    .replace(/\bregion ash waste\b/g, "灰烬荒原")
    .replace(/\bregion city pipes\b/g, "管城")
    .replace(/\bregion abandoned mine\b/g, "废弃矿区")
    .replace(/\bregion data tower\b/g, "废弃数据塔")
    .replace(/Gray Harbor/g, "灰港")
    .replace(/Clerk Child/g, "书记员家属")
    .replace(/Clerk/g, "书记员")
    .replace(/Child/g, "子嗣")
    .replace(/Friend/g, "友人")
    .replace(/Supervisor/g, "督导")
    .replace(/local alpha fallback/g, "本地预览签名")
    .replace(/image\/png/g, "图片")
    .replace(/lifecycle training/g, "训练记录")
    .replace(/lifecycle debt obligation/g, "债务记录")
    .replace(/lifecycle work friend/g, "工作友谊")
    .replace(/lifecycle marriage/g, "婚姻记录")
    .replace(/lifecycle workplace/g, "职场记录")
    .replace(/server_hosted_agent/g, "服务器托管")
    .replace(/remote_attested_runner/g, "远程验签")
    .replace(/untrusted_capped/g, "浏览器提交，奖励受限")
    .replace(/trusted_execution_receipt/g, "受信执行凭据")
    .replace(/This identity is active and can use owner-authorized active gameplay tools\./g, "该行动身份可以继续使用需要拥有者确认的行动。")
    .replace(/预档未来钩子/g, "整理后续线索");
  text = replaceKnownPublicLabels(text, publicRegionLabels);
  text = replaceKnownPublicLabels(text, publicEventTypeLabels);
  text = text.replace(/_/g, " ");
  if (/^(epoch agent|explorer|epoch event|epoch page|epoch turn card|epoch agent install|server hosted job|turn card|session|action|npc|npc candidate|news|objective|resource node|anomaly|order|direct trade|bounty|party run|raid|retaliation|relationship|diplomacy|agent npc bond|npc memory|household|organization|organization membership|organization politics|npc career|npc location|npc asset|npc health|item|social hook|season|trace|monument|message|legend award|moderation|risk review|confirmation|lore contribution|lore adjudication|command|correlation)\s/i.test(text)) {
    return "已记录";
  }
  text = text
    .replace(/^[^·]+ · ([^·]+)的(探索节点|托管历程|探索历程)已整理为可分享的探索历程摘要。/, "$1$2已整理为可分享摘要。")
    .replace(/^[^·]+ · ([^·]+)(探索节点|托管历程|探索历程)已整理为可分享摘要。/, "$1$2已整理为可分享摘要。")
    .replace(/灰港\s+书记员\s+子嗣\s+\d+\s+友人/g, "灰港书记员的友人")
    .replace(/灰港\s+书记员\s+子嗣\s+\d+\s+督导/g, "灰港书记员的督导")
    .replace(/灰港\s+书记员\s+子嗣\s+\d+/g, "灰港书记员家属")
    .replace(/\s+/g, " ")
    .replace(/\s+的/g, "的")
    .replace(/\s+([，。；：！？])/g, "$1")
    .trim();
  return text;
}

export function publicMcpToolName(value: unknown): string {
  const toolName = String(value ?? "").trim();
  return /^obsidian_epoch\.[a-z][a-z0-9_]*$/u.test(toolName)
    ? toolName
    : publicText(toolName);
}

export function publicEventTypeLabel(value: string | undefined): string {
  return publicEventTypeLabels[value || ""] || publicText(value || "公开事件");
}

export function publicFactionLabel(value: string | undefined): string {
  return publicFactionLabels[value || ""] || publicText(value || "暂无阵营");
}

export function publicPlayModeLabel(value: string | undefined): string {
  return publicPlayModeLabels[value || ""] || publicText(value || "正式");
}

export function publicRarityLabel(value: string | undefined): string {
  return publicRarityLabels[value || ""] || publicText(value || "普通");
}

export function publicReceiptFocusLabel(value: string | undefined): string {
  return publicReceiptFocusLabels[value || ""] || publicText(value || "结果");
}

export function publicResourceLabel(value: string | undefined): string {
  return publicResourceLabels[value || ""] || publicText(value || "资源");
}

export function publicSecretTierLabel(value: string | undefined): string {
  return publicSecretTierLabels[value || ""] || publicText(value || "公开");
}

export function publicSourceTypeLabel(value: string | undefined): string {
  return publicSourceTypeLabels[value || ""] || publicText(value || "事件");
}

export function publicStatusLabel(value: string | undefined): string {
  return publicStatusLabels[value || ""] || publicText(value || "未记录");
}

export function publicTrustClassLabel(value: string | undefined): string {
  return publicTrustClassLabels[value || ""] || publicText(value || "服务器结算");
}

export function publicTrustedRunnerLabel(value: string | undefined): string {
  return publicTrustedRunnerLabels[value || ""] || "受信运行器";
}

export function publicTrustTierLabel(value: string | undefined): string {
  return publicTrustTierLabels[value || ""] || publicText(value || "服务器结算");
}

export function publicKindLabel(value: string | undefined): string {
  return publicKindLabels[value || ""] || publicText(value || "记录");
}

export function publicDowntimeModeLabel(value: string | undefined): string {
  return publicDowntimeModeLabels[value || ""] || publicText(value || "未托管");
}

export function publicActionLabel(value: unknown): string {
  return publicText(value || "行动");
}

export function publicCommissionSecretRevealLabel(
  commission: { readonly secretRevealBudget?: { readonly chapterLocked?: boolean; readonly remaining?: number } },
): string {
  if (commission.secretRevealBudget?.chapterLocked) return "隐藏线索暂未公开";
  const remaining = commission.secretRevealBudget?.remaining;
  return typeof remaining === "number" && remaining > 0
    ? `还可公开 ${remaining} 条线索`
    : "暂无额外公开线索";
}
