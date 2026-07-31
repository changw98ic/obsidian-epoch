import type {
  EpochAbilityEffectCluster,
  EpochLocationMotif,
  EpochMessageRecord,
  EpochNpcCandidateFlavorPublicationMode,
  EpochOrganization,
  EpochOrganizationBudgetResolution,
  EpochOrganizationMembershipStatus,
  EpochProgressView,
  EpochRegionInfo,
  EpochResourceId,
  EpochRumorAdmissionStatus,
} from "../../types";
import {
  playerAgentLabel,
  playerCommonStatusLabel,
  playerEventTypeLabel,
  playerExplorerLabel,
  playerFactionLabel,
  playerRecordLabel,
  playerRegionLabel,
  playerRelationshipKindLabel,
  playerSecretTierLabel,
  playerSourceTypeLabel,
  playerTrustClassLabel,
} from "../agentPlayerLabels";
import { OrganizationPanel } from "./OrganizationPanel";

const SECRET_REVEAL_BUDGET_COPY = {
  label: "公开线索",
  open: "可继续公开",
  locked: "暂未公开",
  remaining: "剩余可公开线索",
} as const;

const LOCATION_MOTIF_LABELS: Record<EpochLocationMotif, string> = {
  ecology: "生态",
  creature: "生物",
  faction: "阵营",
  anomaly: "异常",
  resource: "资源",
  character: "人物",
};

const LOCATION_MOTIF_DISPLAY_LABELS = {
  normal: "正常展示",
  aggregate: "聚合展示",
  downrank: "降低频率",
} as const;

const NPC_CANDIDATE_FLAVOR_POLICY_LABELS: Record<EpochNpcCandidateFlavorPublicationMode, string> = {
  shared_lore: "共享设定审核",
  personal_sealed: "个人封存",
};

const RUMOR_ADMISSION_LABELS: Record<EpochRumorAdmissionStatus, string> = {
  shared_candidate: "可入传闻池",
  personal_sealed: "个人封存",
};

const ABILITY_EFFECT_CLUSTER_LABELS = {
  effect: "效果",
  cost: "成本",
  medium: "媒介",
  location: "地点",
  trigger: "触发",
} as const satisfies Record<Exclude<keyof EpochAbilityEffectCluster, "clusterKey" | "summary">, string>;

interface OrganizationMembershipRoleOption {
  readonly value: string;
  readonly label: string;
}

interface OrganizationUpgradeOption {
  readonly value: string;
  readonly label: string;
  readonly cost: string;
  readonly effect: string;
}

interface RegionOverviewPanelProps {
  readonly activeIdentityDisabled: boolean;
  readonly agentServerBase: string;
  readonly claimNewsLegend: (newsId?: string) => void;
  readonly contributeOrganizationTreasury: (organization: EpochOrganization) => void;
  readonly createOrganization: () => void;
  readonly currentAgentId?: string;
  readonly displayedRegionMessages: readonly EpochMessageRecord[];
  readonly epochAssetUrl: (pathOrUrl: string) => string;
  readonly explorer: boolean;
  readonly formatDate: (value?: string) => string;
  readonly generateRegionNews: () => void;
  readonly isBusy: boolean;
  readonly isOrganizationBudgetGovernanceRole: (role?: string) => boolean;
  readonly loadRegion: () => void;
  readonly messageBody: string;
  readonly newsSourceEventId: string;
  readonly npcName: string;
  readonly operatorKey: string;
  readonly organizationBudgetAmount: number;
  readonly organizationBudgetDescription: string;
  readonly organizationBudgetResourceId: EpochResourceId;
  readonly organizationBudgetTitle: string;
  readonly organizationBudgetVoteLabel: (decision: EpochOrganizationBudgetResolution) => string;
  readonly organizationContributionAmount: number;
  readonly organizationContributionResourceId: EpochResourceId;
  readonly organizationCreateName: string;
  readonly organizationMembershipRole: string;
  readonly organizationMembershipRoleOptions: readonly OrganizationMembershipRoleOption[];
  readonly organizationSearch: string;
  readonly organizationTreasuryReasonLabel: (reason: string) => string;
  readonly organizationUpgradeKey: string;
  readonly organizationUpgradeOptions: readonly OrganizationUpgradeOption[];
  readonly playerFactionLabel: (value?: string | null) => string;
  readonly postRegionMessage: () => void;
  readonly progress?: EpochProgressView | null;
  readonly proposeOrganizationBudget: (organization: EpochOrganization) => void;
  readonly purchaseOrganizationUpgrade: (organization: EpochOrganization) => void;
  readonly region: EpochRegionInfo | null;
  readonly regionId: string;
  readonly resolveOrganizationBudget: (budgetId: string, resolution: EpochOrganizationBudgetResolution) => void;
  readonly resourceAmountSummary: (resources: Partial<Record<EpochResourceId, number>>) => string;
  readonly resourceLabels: Record<EpochResourceId, string>;
  readonly reviewRejectedNpcCandidate: (candidateId: string) => void;
  readonly saveNpcNote: () => void;
  readonly setMessageBody: (body: string) => void;
  readonly setNewsSourceEventId: (eventId: string) => void;
  readonly setNpcName: (name: string) => void;
  readonly setOrganizationBudgetAmount: (amount: number) => void;
  readonly setOrganizationBudgetDescription: (description: string) => void;
  readonly setOrganizationBudgetResourceId: (resourceId: EpochResourceId) => void;
  readonly setOrganizationBudgetTitle: (title: string) => void;
  readonly setOrganizationContributionAmount: (amount: number) => void;
  readonly setOrganizationContributionResourceId: (resourceId: EpochResourceId) => void;
  readonly setOrganizationCreateName: (name: string) => void;
  readonly setOrganizationMembershipRole: (role: string) => void;
  readonly setOrganizationSearch: (search: string) => void;
  readonly setOrganizationUpgradeKey: (upgradeKey: string) => void;
  readonly setRegionId: (regionId: string) => void;
  readonly tickNpcLifecycle: () => void;
  readonly tickOrganizationPolitics: () => void;
  readonly updateOrganizationMembership: (organization: EpochOrganization, status: EpochOrganizationMembershipStatus) => void;
  readonly visibleOrganizations: readonly EpochOrganization[];
}

function lifecycleSummary(lifecycle: EpochRegionInfo["npcs"][number]["lifecycle"]) {
  const latest = lifecycle.at(-1);
  if (!latest) return "";
  return Object.entries(latest.changes).map(([key, value]) => `${key}:${String(value)}`).join(" / ");
}

function npcDisplayName(region: EpochRegionInfo | null, npcId: string) {
  return region?.npcs.find((npc) => npc.npcId === npcId)?.displayName || npcId;
}

export function RegionOverviewPanel({
  activeIdentityDisabled,
  agentServerBase,
  claimNewsLegend,
  contributeOrganizationTreasury,
  createOrganization,
  currentAgentId,
  displayedRegionMessages,
  epochAssetUrl,
  explorer,
  formatDate,
  generateRegionNews,
  isBusy,
  isOrganizationBudgetGovernanceRole,
  loadRegion,
  messageBody,
  newsSourceEventId,
  npcName,
  operatorKey,
  organizationBudgetAmount,
  organizationBudgetDescription,
  organizationBudgetResourceId,
  organizationBudgetTitle,
  organizationBudgetVoteLabel,
  organizationContributionAmount,
  organizationContributionResourceId,
  organizationCreateName,
  organizationMembershipRole,
  organizationMembershipRoleOptions,
  organizationSearch,
  organizationTreasuryReasonLabel,
  organizationUpgradeKey,
  organizationUpgradeOptions,
  playerFactionLabel,
  postRegionMessage,
  progress,
  proposeOrganizationBudget,
  purchaseOrganizationUpgrade,
  region,
  regionId,
  resolveOrganizationBudget,
  resourceAmountSummary,
  resourceLabels,
  reviewRejectedNpcCandidate,
  saveNpcNote,
  setMessageBody,
  setNewsSourceEventId,
  setNpcName,
  setOrganizationBudgetAmount,
  setOrganizationBudgetDescription,
  setOrganizationBudgetResourceId,
  setOrganizationBudgetTitle,
  setOrganizationContributionAmount,
  setOrganizationContributionResourceId,
  setOrganizationCreateName,
  setOrganizationMembershipRole,
  setOrganizationSearch,
  setOrganizationUpgradeKey,
  setRegionId,
  tickNpcLifecycle,
  tickOrganizationPolitics,
  updateOrganizationMembership,
  visibleOrganizations,
}: RegionOverviewPanelProps) {
  return (
    <article className="agent-panel">
      <div className="agent-panel-head">
        <span>区域 / NPC</span>
        <b>{region?.commissions.length || 0} 委托 / {region?.partyRuns.length || 0} 小队 / {region?.npcs.length || 0} NPC / {region?.npcCandidates.length || 0} 候选 / {region?.organizations.length || 0} 组织 / {region?.organizationPolitics.length || 0} 政治 / {region?.assetStates.length || 0} 资产 / {region?.healthStates.length || 0} 健康 / {region?.socialHooks.length || 0} 钩子</b>
      </div>
      <input value={regionId} onChange={(event) => setRegionId(event.target.value)} />
      <input value={npcName} onChange={(event) => setNpcName(event.target.value)} />
      <textarea value={messageBody} onChange={(event) => setMessageBody(event.target.value)} rows={3} />
      <input value={newsSourceEventId} onChange={(event) => setNewsSourceEventId(event.target.value)} placeholder="source event id for news" />
      <div className="agent-action-row">
        <button type="button" disabled={isBusy} onClick={loadRegion}>读取区域</button>
        <button type="button" disabled={isBusy || activeIdentityDisabled || !npcName.trim()} onClick={saveNpcNote}>记录 NPC</button>
        <button type="button" disabled={isBusy} onClick={tickNpcLifecycle}>NPC tick</button>
        <button type="button" disabled={isBusy} onClick={tickOrganizationPolitics}>组织政治 tick</button>
        <button type="button" disabled={isBusy || activeIdentityDisabled || !messageBody.trim()} onClick={postRegionMessage}>区域发言</button>
        <button type="button" disabled={isBusy || !newsSourceEventId.trim()} onClick={generateRegionNews}>生成新闻</button>
        <button type="button" disabled={isBusy || activeIdentityDisabled || !((progress?.claimableLegendNews.length || 0) > 0 || region?.news[0])} onClick={() => claimNewsLegend()}>领取传说</button>
      </div>
      {progress?.claimableLegendNews.length ? (
        <div className="agent-mini-list">
          <b>上新闻提醒</b>
          {progress.claimableLegendNews.slice(0, 3).map((news) => (
            <span className="agent-surface-media-row" key={news.newsId}>
              <img
                className="agent-surface-media-image"
                src={epochAssetUrl(news.media.imageUrl)}
                alt={news.media.publicAlt}
                loading="lazy"
              />
              <span>
                {news.headline} · 传说 +{news.amount}
                <small>{playerRegionLabel(news.regionId)} · {formatDate(news.createdAt)}</small>
                <button type="button" disabled={isBusy || activeIdentityDisabled} onClick={() => claimNewsLegend(news.newsId)}>领取传说</button>
              </span>
            </span>
          ))}
        </div>
      ) : null}
      {region?.media ? (
        <div className="agent-region-media" style={{ borderColor: region.media.accentColor }}>
          <img
            className="agent-region-media-image"
            src={epochAssetUrl(region.media.imageUrl)}
            alt={region.media.publicAlt}
            loading="lazy"
          />
          <div>
            <b>{region.media.title}</b>
            <span>{region.media.subtitle}</span>
            <em>{region.media.publicAlt}</em>
          </div>
        </div>
      ) : null}
      {region?.campaignKeyArt.slice(0, 2).map((campaignArt) => (
        <div className="agent-region-media" style={{ borderColor: campaignArt.accentColor }} key={campaignArt.campaignKey}>
          <img
            className="agent-campaign-key-art-image"
            src={epochAssetUrl(campaignArt.imageUrl)}
            alt={campaignArt.publicAlt}
            loading="lazy"
          />
          <div>
            <b>{campaignArt.title}</b>
            <span>{campaignArt.subtitle}</span>
            <em>{campaignArt.campaignKey} · {campaignArt.assetPath}</em>
          </div>
        </div>
      ))}
      {region?.ambienceScenes.slice(0, 2).map((ambienceScene) => (
        <div className="agent-region-media" style={{ borderColor: ambienceScene.accentColor }} key={ambienceScene.sceneKey}>
          <img
            className="agent-ambience-scene-image"
            src={epochAssetUrl(ambienceScene.imageUrl)}
            alt={ambienceScene.publicAlt}
            loading="lazy"
          />
          <div>
            <b>{ambienceScene.title}</b>
            <span>{ambienceScene.subtitle}</span>
            <em>{ambienceScene.sceneKey} · {ambienceScene.assetPath}</em>
          </div>
        </div>
      ))}
      {region?.worldScenes.slice(0, 2).map((worldScene) => (
        <div className="agent-region-media" style={{ borderColor: worldScene.accentColor }} key={worldScene.sceneKey}>
          <img
            className="agent-world-scene-image"
            src={epochAssetUrl(worldScene.imageUrl)}
            alt={worldScene.publicAlt}
            loading="lazy"
          />
          <div>
            <b>{worldScene.title}</b>
            <span>{worldScene.subtitle}</span>
            <em>{worldScene.sceneKey} · {worldScene.assetPath}</em>
          </div>
        </div>
      ))}
      {region?.sceneVariants.slice(0, 2).map((sceneVariant) => (
        <div className="agent-region-media" style={{ borderColor: sceneVariant.accentColor }} key={sceneVariant.variantKey}>
          <img
            className="agent-scene-variant-image"
            src={epochAssetUrl(sceneVariant.imageUrl)}
            alt={sceneVariant.publicAlt}
            loading="lazy"
          />
          <div>
            <b>{sceneVariant.title}</b>
            <span>{sceneVariant.subtitle}</span>
            <em>{sceneVariant.variantKey} · {sceneVariant.timeOfDay} · {sceneVariant.weather} · {sceneVariant.assetPath}</em>
          </div>
        </div>
      ))}
      {region?.eventStateMedia.slice(0, 6).map((eventState) => (
        <div className="agent-region-media" style={{ borderColor: eventState.accentColor }} key={eventState.stateKey}>
          <img
            className="agent-event-state-image"
            src={epochAssetUrl(eventState.imageUrl)}
            alt={eventState.publicAlt}
            loading="lazy"
          />
          <div>
            <b>事件状态 · {eventState.title}</b>
            <span>{eventState.subtitle}</span>
            <em>{eventState.stateKey} · {eventState.assetPath}</em>
          </div>
        </div>
      ))}
      <div className="agent-mini-list">
        {region?.activeAgents.slice(0, 4).map((activeAgent) => (
          <a
            className="agent-inline-link"
            href={`${agentServerBase}${activeAgent.publicPages.agent}`}
            target="_blank"
            rel="noreferrer"
            key={activeAgent.agentId}
          >
            活动身份 · {activeAgent.identityName}
            <b>{playerAgentLabel(activeAgent.agentId)} / {playerEventTypeLabel(activeAgent.lastActivity.sourceEventType)} / {formatDate(activeAgent.lastActivity.occurredAt)}</b>
          </a>
        ))}
        {displayedRegionMessages.slice(0, 4).map((message) => (
          <span key={message.messageId}>
            {playerExplorerLabel(message.explorerId)}：{message.body}
          </span>
        ))}
        {region?.commissions.slice(0, 5).map((commission) => (
          <span className={commission.media ? "agent-activity-media-row" : undefined} key={commission.commissionId}>
            {commission.media ? (
              <img
                className="agent-activity-media-image"
                src={epochAssetUrl(commission.media.imageUrl)}
                alt={commission.media.publicAlt}
                loading="lazy"
              />
            ) : null}
            <span>
              区域委托 · {commission.title}
              <em className="agent-secret-tier-label">{playerSecretTierLabel(commission.secretExposureTier)}</em>
              <em className={`agent-secret-budget-lock ${commission.secretRevealBudget.chapterLocked ? "is-locked" : "is-open"}`}>
                {commission.secretRevealBudget.chapterLocked
                  ? `${SECRET_REVEAL_BUDGET_COPY.label} · ${SECRET_REVEAL_BUDGET_COPY.locked}`
                  : `${SECRET_REVEAL_BUDGET_COPY.label} · ${SECRET_REVEAL_BUDGET_COPY.open} · ${SECRET_REVEAL_BUDGET_COPY.remaining} ${commission.secretRevealBudget.remaining}`}
              </em>
              <em className={`agent-prefile-isolation is-${commission.prefileIsolation.layer}`}>
                {commission.prefileIsolation.futureHookOnly ? "后续线索已整理" : "当前章节可推进"}
              </em>
              <em className={`agent-location-motif-bias is-${commission.locationMotifBias.motif}`}>
                {commission.locationMotifBias.label}母题 · 奖励偏向 {resourceLabels[commission.locationMotifBias.rewardResourceId]}
              </em>
              <b>
                {commission.actionLabel} / {playerSourceTypeLabel(commission.sourceType)} / {playerCommonStatusLabel(commission.status)}
                {commission.progress ? ` / ${commission.progress.current}${commission.progress.target ? `/${commission.progress.target}` : ""}` : ""}
                {commission.reward ? ` / ${resourceLabels[commission.reward.resourceId]} +${commission.reward.amount}` : ""}
                {commission.canonical ? " / 已入典" : ""}
              </b>
              {commission.secretRevealBudget.chapterLocked ? (
                <small>本章隐藏线索暂不公开，继续推进故事后再揭示。</small>
              ) : null}
              {commission.prefileIsolation.futureHookOnly ? (
                <small>这条线索已为后续章节保留，当前只展示可行动部分。</small>
              ) : null}
              <small>{commission.locationMotifBias.summary}</small>
            </span>
          </span>
        ))}
        {region?.motifQuotas.length ? (
          <span className="agent-location-motif-quotas">
            地点母题配额
            <b>
              {region.motifQuotas.filter((motifQuota) => motifQuota.status === "dense").length
                ? "过密母题会聚合或降权"
                : "当前母题密度正常"}
            </b>
            <div className="agent-location-motif-quota-grid" aria-label="地点母题配额">
              {region.motifQuotas.map((motifQuota) => (
                <em
                  className={`agent-location-motif-quota ${motifQuota.status === "dense" ? "is-dense" : "is-normal"}`}
                  key={motifQuota.motif}
                >
                  {LOCATION_MOTIF_LABELS[motifQuota.motif]} {motifQuota.count}/{motifQuota.quota} · {LOCATION_MOTIF_DISPLAY_LABELS[motifQuota.displayMode]}
                </em>
              ))}
            </div>
          </span>
        ) : null}
        {region?.partyRuns.slice(0, 4).map((partyRun) => (
          <span key={partyRun.partyRunId}>
            小队 · {partyRun.title}
            <b>{playerCommonStatusLabel(partyRun.status)} / 成员 {partyRun.members.length} / 队长 {playerAgentLabel(partyRun.leaderAgentId)} / {partyRun.members.map((member) => member.participantRole).join(", ")}</b>
          </span>
        ))}
        {region?.leaderboard.slice(0, 4).map((entry, index) => (
          <span key={entry.agentId}>
            区域榜 #{index + 1} · {playerAgentLabel(entry.agentId)}
            <b>影响 {entry.influenceScore} / 可信 {entry.trustedInfluenceScore} / 信任 {playerTrustClassLabel(entry.dominantTrustClass)} / 目标 {entry.objectiveScore} / 资源点 {entry.resourceNodeScore} / 异常 {entry.anomalyScore} / 传说 {entry.legendScore} / 悬赏 {entry.bountyScore}</b>
          </span>
        ))}
        {region?.marketSummary ? (
          <span>
            区域市场 · 总单 {region.marketSummary.totalOrders}
            <b>
              打开 {region.marketSummary.openOrders} / 成交 {region.marketSummary.filledOrders} / 撤单 {region.marketSummary.cancelledOrders} / 过期 {region.marketSummary.expiredOrders}
              {" "}成交额 {resourceAmountSummary(region.marketSummary.filledVolume)}
              {" "}市场税 {resourceAmountSummary(region.marketSummary.collectedFees)}
            </b>
          </span>
        ) : null}
        {region?.raidHeat ? (
          <span>
            区域热度 · {playerCommonStatusLabel(region.raidHeat.status)}
            <b>
              热度 {region.raidHeat.heatScore} / 对抗 {region.raidHeat.recentRaidCount} / 对抗对 {region.raidHeat.activePairCount}
              {" "} / 重复 {region.raidHeat.repeatRaidCount}
              {region.raidHeat.latestRaidId ? ` / 最新 ${playerRecordLabel(region.raidHeat.latestRaidId, "对抗")}` : ""}
            </b>
          </span>
        ) : null}
        {region?.eligibleRaidTargets.slice(0, 4).map((target) => (
          <span key={target.eligibilityId}>
            可对抗目标 · {playerAgentLabel(target.attackerAgentId)} 对 {playerAgentLabel(target.targetAgentId)}
            <b>
              {playerFactionLabel(target.attackerFactionId)} 对 {playerFactionLabel(target.targetFactionId)}
              {" "} / 赛季 {target.targetSeasonScore} / 防御 {target.targetDefensePower}
            </b>
          </span>
        ))}
        {region?.factionPressure.slice(0, 4).map((pressure) => (
          <span key={pressure.factionId}>
            阵营压力 · {playerFactionLabel(pressure.factionId)}
            <b>
              {playerCommonStatusLabel(pressure.controlStatus)} / 总压 {pressure.pressureScore} / 赛季 {pressure.seasonScore} / 对抗 {pressure.raidPressure}
              {" "} / 活跃 {pressure.activeRaidCount} / 身份 {pressure.agentIds.length}
              {pressure.latestRaidId ? ` / 最新 ${playerRecordLabel(pressure.latestRaidId, "对抗")}` : ""}
            </b>
          </span>
        ))}
        {region?.influenceChanges.slice(0, 4).map((change) => (
          <span key={change.influenceId}>
            影响变动 · {playerAgentLabel(change.agentId)}
            <b>{playerEventTypeLabel(change.sourceEventType)} / +{change.influenceDelta} / 累计 {change.influenceScoreAfter}</b>
          </span>
        ))}
        {region?.activities.slice(0, 4).map((activity) => (
          <span key={activity.activityId}>
            区域活动 · {activity.title}
            <b>{playerAgentLabel(activity.agentId)} / {playerEventTypeLabel(activity.sourceEventType)} / {formatDate(activity.occurredAt)}</b>
          </span>
        ))}
        {region?.traces.slice(0, 4).map((trace) => (
          <span key={trace.traceId}>
            冲突轨迹 · {trace.title}
            <b>{trace.sourceEventIds.length} 事件 / {trace.participantAgentIds.length} 身份 / {playerEventTypeLabel(trace.sourceEventType)}</b>
          </span>
        ))}
        {region?.frontlines.slice(0, 4).map((frontline) => (
          <span key={frontline.frontlineId}>
            区域前线 · {playerAgentLabel(frontline.attackerAgentId)} 对 {playerAgentLabel(frontline.defenderAgentId)}
            <b>
              {playerCommonStatusLabel(frontline.status)} / 压力 {frontline.attackerPressure}:{frontline.defenderPressure} / 差值 {frontline.pressureDelta}
              {" "} / 进攻侧 {frontline.attackerSideAgentIds.length} / 防守侧 {frontline.defenderSideAgentIds.length}
              {" "} / 可复仇 {frontline.openRetaliationIds.length}
            </b>
          </span>
        ))}
        {region?.retaliations.slice(0, 4).map((retaliation) => (
          <span key={retaliation.retaliationId}>
            复仇契机 · {playerAgentLabel(retaliation.opportunityAgentId)}
            <b>目标 {playerAgentLabel(retaliation.targetAgentId)} / 来源 {playerRecordLabel(retaliation.sourceRaidId, "对抗")} / {playerCommonStatusLabel(retaliation.status)}</b>
          </span>
        ))}
        {region?.regionControl ? (
          <span>
            区域控制 · {playerFactionLabel(region.regionControl.controllingFactionId)}
            <b>
              控制分 {region.regionControl.controlScore} / 优势 {region.regionControl.controlMargin}
              {region.regionControl.sourceReleaseId ? " / 来源已记录" : ""}
              {region.regionControl.claimingAgentId ? " / 声明者已记录" : ""}
            </b>
          </span>
        ) : (
          <span>
            区域控制 · 暂无公开控制者
            <b>后续行动或赛季可能改变归属</b>
          </span>
        )}
        {region?.monuments.slice(0, 3).map((monument) => (
          <span key={monument.monumentId}>
            纪念碑 · {monument.title}
            <b>{playerFactionLabel(monument.controllingFactionId)} / 来源赛季已记录</b>
          </span>
        ))}
        {region?.resourceNodes.slice(0, 3).map((node) => (
          <span key={node.nodeId}>
            资源点 · {node.title}
            <b>{playerCommonStatusLabel(node.status)} / {node.totalScore}</b>
          </span>
        ))}
        {region?.anomalies.slice(0, 3).map((anomaly) => (
          <span key={anomaly.anomalyId}>
            异常链 · {anomaly.title}
            <b>{playerCommonStatusLabel(anomaly.status)} / {anomaly.totalScore}/{anomaly.targetScore} / {playerCommonStatusLabel(anomaly.outcome || anomaly.severity)}</b>
          </span>
        ))}
        {(region?.npcs || []).slice(0, 4).map((npc) => (
          <span className="agent-npc-media-row" key={npc.npcId}>
            {npc.media ? (
              <img
                className="agent-npc-media-image"
                src={epochAssetUrl(npc.media.imageUrl)}
                alt={npc.media.publicAlt}
                loading="lazy"
              />
            ) : null}
            <small>
              {npc.displayName}
              {lifecycleSummary(npc.lifecycle) ? ` · ${lifecycleSummary(npc.lifecycle)}` : ""}
            </small>
            <b>{npc.media ? "形象已记录" : "角色已入典"}</b>
          </span>
        ))}
        {region?.npcCandidates.slice(0, 4).map((candidate) => (
          <span key={candidate.candidateId}>
            NPC候选 · {candidate.displayName}
            <b>
              {playerCommonStatusLabel(candidate.status)} / {playerCommonStatusLabel(candidate.decision)}
              {candidate.canonicalNpcId ? ` / ${candidate.canonicalNpcId}` : ""}
              {candidate.reviewedBy ? ` / 已复核 ${candidate.reviewedBy}` : ""}
            </b>
            <small>
              审核风险 · {candidate.reviewLevel} / {candidate.reviewScore}
              {candidate.reviewFlags.length ? ` · ${candidate.reviewFlags.join(" / ")}` : ""}
            </small>
            <small className={`agent-flavor-policy-label ${candidate.flavorPublication.mode === "personal_sealed" ? "is-sealed" : "is-shared"}`}>
              气质策略 · {NPC_CANDIDATE_FLAVOR_POLICY_LABELS[candidate.flavorPublication.mode]}
              {candidate.flavorPublication.sharedWorldEligible ? " · 可进共享设定" : " · 不进共享设定"}
            </small>
            <small className={`agent-rumor-admission-label ${candidate.rumorAdmissionReview.status === "personal_sealed" ? "is-sealed" : "is-shared"}`}>
              候选传闻门槛 · {RUMOR_ADMISSION_LABELS[candidate.rumorAdmissionReview.status]}
              {" · 锚点 "}{candidate.rumorAdmissionReview.anchorCompleteness}/{candidate.rumorAdmissionReview.anchorThreshold}
              {" · 气质 "}{candidate.rumorAdmissionReview.coreVibeScore}/{candidate.rumorAdmissionReview.coreVibeThreshold}
            </small>
            {candidate.abilityEffectCluster ? (
              <small className="agent-ability-cluster-label" title={candidate.abilityEffectCluster.clusterKey}>
                效果聚类 · {ABILITY_EFFECT_CLUSTER_LABELS.effect}:{candidate.abilityEffectCluster.effect}
                {" / "}{ABILITY_EFFECT_CLUSTER_LABELS.cost}:{candidate.abilityEffectCluster.cost}
                {" / "}{ABILITY_EFFECT_CLUSTER_LABELS.medium}:{candidate.abilityEffectCluster.medium}
                {" / "}{ABILITY_EFFECT_CLUSTER_LABELS.location}:{candidate.abilityEffectCluster.location}
                {" / "}{ABILITY_EFFECT_CLUSTER_LABELS.trigger}:{candidate.abilityEffectCluster.trigger}
                {" / "}{candidate.abilityEffectCluster.clusterKey}
              </small>
            ) : null}
            {candidate.flavorPublication.mode === "personal_sealed" ? (
              <small>{candidate.flavorPublication.reason}</small>
            ) : null}
            {candidate.reviewNote ? <small>{candidate.reviewNote}</small> : null}
            {candidate.status === "rejected_flavor" ? (
              <button type="button" disabled={isBusy || !operatorKey.trim()} onClick={() => reviewRejectedNpcCandidate(candidate.candidateId)}>
                复核候选
              </button>
            ) : null}
          </span>
        ))}
        {region?.relationships.slice(0, 4).map((relationship) => (
          <span className={relationship.media ? "agent-relationship-media-row" : undefined} key={relationship.relationshipId}>
            {relationship.media ? (
              <img
                className="agent-relationship-media-image"
                src={epochAssetUrl(relationship.media.imageUrl)}
                alt={relationship.media.publicAlt}
                loading="lazy"
              />
            ) : null}
            <span>
              {npcDisplayName(region, relationship.sourceNpcId)} 与 {npcDisplayName(region, relationship.targetNpcId)}
              <b>{playerRelationshipKindLabel(relationship.kind)}</b>
            </span>
          </span>
        ))}
        {region?.agentNpcBonds.slice(0, 4).map((bond) => (
          <span className={bond.media ? "agent-relationship-media-row" : undefined} key={bond.bondId}>
            {bond.media ? (
              <img
                className="agent-relationship-media-image"
                src={epochAssetUrl(bond.media.imageUrl)}
                alt={bond.media.publicAlt}
                loading="lazy"
              />
            ) : null}
            <span>
              羁绊 · {playerAgentLabel(bond.agentId)} 与 {bond.npc.displayName || npcDisplayName(region, bond.npcId)}
              <b>{playerRelationshipKindLabel(bond.kind)} {bond.score > 0 ? "+" : ""}{bond.score}</b>
              <small>{bond.reason}</small>
            </span>
          </span>
        ))}
        {region?.memories.slice(0, 4).map((memory) => (
          <span key={memory.memoryId}>
            {npcDisplayName(region, memory.npcId)} · {memory.summary}
            <b>{memory.importance}</b>
          </span>
        ))}
        {region?.households.slice(0, 4).map((household) => (
          <span className={household.media ? "agent-relationship-media-row" : undefined} key={household.householdId}>
            {household.media ? (
              <img
                className="agent-relationship-media-image"
                src={epochAssetUrl(household.media.imageUrl)}
                alt={household.media.publicAlt}
                loading="lazy"
              />
            ) : null}
            <span>
              家庭 · {household.summary}
              <b>{household.memberNames.join(" / ") || household.memberNpcIds.map((npcId) => npcDisplayName(region, npcId)).join(" / ")}</b>
              <small>{household.reason}</small>
            </span>
          </span>
        ))}
        <OrganizationPanel
          activeIdentityDisabled={activeIdentityDisabled}
          contributeOrganizationTreasury={contributeOrganizationTreasury}
          createOrganization={createOrganization}
          currentAgentId={currentAgentId}
          explorer={explorer}
          formatDate={formatDate}
          isBusy={isBusy}
          isOrganizationBudgetGovernanceRole={isOrganizationBudgetGovernanceRole}
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
          organizationMembershipRoleOptions={organizationMembershipRoleOptions}
          organizationSearch={organizationSearch}
          organizationTreasuryReasonLabel={organizationTreasuryReasonLabel}
          organizationUpgradeKey={organizationUpgradeKey}
          organizationUpgradeOptions={organizationUpgradeOptions}
          proposeOrganizationBudget={proposeOrganizationBudget}
          purchaseOrganizationUpgrade={purchaseOrganizationUpgrade}
          region={region}
          resolveOrganizationBudget={resolveOrganizationBudget}
          resourceAmountSummary={resourceAmountSummary}
          resourceLabels={resourceLabels}
          setOrganizationBudgetAmount={setOrganizationBudgetAmount}
          setOrganizationBudgetDescription={setOrganizationBudgetDescription}
          setOrganizationBudgetResourceId={setOrganizationBudgetResourceId}
          setOrganizationBudgetTitle={setOrganizationBudgetTitle}
          setOrganizationContributionAmount={setOrganizationContributionAmount}
          setOrganizationContributionResourceId={setOrganizationContributionResourceId}
          setOrganizationCreateName={setOrganizationCreateName}
          setOrganizationMembershipRole={setOrganizationMembershipRole}
          setOrganizationSearch={setOrganizationSearch}
          setOrganizationUpgradeKey={setOrganizationUpgradeKey}
          updateOrganizationMembership={updateOrganizationMembership}
          visibleOrganizations={visibleOrganizations}
        />
        {region?.locations.slice(0, 3).map((location) => (
          <span key={location.locationId}>
            迁徙 · {location.summary}
            <b>{location.npcDisplayName}</b>
            <small>{location.reason}</small>
          </span>
        ))}
        {region?.assetStates.slice(0, 4).map((asset) => (
          <span key={asset.assetId}>
            资产 · {asset.summary}
            <b>{asset.npcDisplayName}</b>
            <small>{asset.delta} / {asset.balanceAfter}</small>
          </span>
        ))}
        {region?.healthStates.slice(0, 4).map((health) => (
          <span key={health.healthId}>
            健康 · {health.summary}
            <b>{health.npcDisplayName}</b>
            <small>{health.status} / {health.severity}</small>
          </span>
        ))}
        {region?.socialHooks.slice(0, 4).map((hook) => (
          <span key={hook.hookId}>
            钩子 · {hook.title}
            <b>{hook.kind} / {hook.risk}</b>
          </span>
        ))}
        {region?.news.slice(0, 2).map((news) => (
          <span className="agent-surface-media-row" key={news.newsId}>
            <img
              className="agent-surface-media-image"
              src={epochAssetUrl(news.media.imageUrl)}
              alt={news.media.publicAlt}
              loading="lazy"
            />
            <span>{news.headline}</span>
          </span>
        ))}
      </div>
    </article>
  );
}
