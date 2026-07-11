import type {
  EpochCrossRegionMechanismReview,
  EpochCreatureBehaviorScopeReview,
  EpochDisputeArchiveGateStatus,
  EpochFuzzyTimeCongestionLevel,
  EpochLoreTargetStatus,
  EpochWorldOverviewInfo,
  EpochWorldviewGateCheckStatus,
} from "../../types";
import {
  playerAgentLabel,
  playerLoreAdjudicationStatusLabel,
  playerLoreContributionCategoryLabel,
  playerPublicSummaryText,
  playerRegionLabel,
} from "../agentPlayerLabels";
import { WorldOverviewRecentResults } from "./WorldOverviewRecentResults";

type LoreCardLayer = "canon" | "shared" | "verified" | "rumor" | "contested" | "sealed";

const LORE_CARD_LAYER_LABELS: Record<LoreCardLayer, string> = {
  canon: "正史",
  shared: "共享",
  verified: "证实",
  rumor: "传闻",
  contested: "争议",
  sealed: "封存",
};

const DISPUTE_ARCHIVE_GATE_LABELS: Record<EpochDisputeArchiveGateStatus, string> = {
  eligible: "可入争议档案",
  rejected_missing_bilateral_evidence: "双方证据不足",
  rejected_untestable: "不可后续检验",
  rejected_core_canon_hard_conflict: "核心正史硬冲突",
};

const WORLDVIEW_GATE_LABELS: Record<EpochWorldviewGateCheckStatus, string> = {
  passed: "通过",
  flagged: "已标记",
  needs_review: "需复核",
};

const CREATURE_BEHAVIOR_SCOPE_LABELS: Record<EpochCreatureBehaviorScopeReview["status"], string> = {
  within_limit: "范围内",
  explained_exception: "越界已解释",
};

const FUZZY_TIME_INTERVAL_LABELS: Record<EpochFuzzyTimeCongestionLevel, string> = {
  low: "低拥挤",
  medium: "中拥挤",
  high: "高拥挤",
};

const CROSS_REGION_MECHANISM_LABELS: Record<EpochCrossRegionMechanismReview["tier"], string> = {
  basic: "基础连接",
  high: "高阶连接",
};

const CROSS_REGION_MECHANISM_KIND_LABELS: Record<EpochCrossRegionMechanismReview["mechanism"], string> = {
  dream_rift: "梦隙",
  rift: "裂隙",
  old_god_whisper: "古神低语",
  route: "路线",
  unknown: "未明机制",
};

const CROSS_REGION_MECHANISM_SUPPORT_LABELS: Record<EpochCrossRegionMechanismReview["support"], string> = {
  chapter_permission: "章节允许",
  route_support: "路线支持",
  explicit_explanation: "解释充分",
};

interface WorldOverviewPanelProps {
  readonly agentServerBase: string;
  readonly epochAssetUrl: (pathOrUrl: string) => string;
  readonly formatDate: (value?: string) => string;
  readonly isBusy: boolean;
  readonly onLoadWorldOverview: () => void;
  readonly worldOverview: EpochWorldOverviewInfo | null;
  readonly worldOverviewPage: string;
}

function shortHash(value?: string) {
  if (!value) return "未记录";
  const [prefix, digest] = value.split(":");
  if (!digest) return value.length > 18 ? `${value.slice(0, 18)}...` : value;
  return `${prefix}:${digest.slice(0, 12)}`;
}

function yesNoLabel(value: boolean) {
  return value ? "满足" : "未满足";
}

function loreTargetStatusLayer(status: EpochLoreTargetStatus): LoreCardLayer {
  switch (status) {
    case "confirmed":
      return "verified";
    case "refuted":
      return "sealed";
    case "revised":
      return "shared";
    case "contested":
      return "contested";
    default:
      return "rumor";
  }
}

export function WorldOverviewPanel({
  agentServerBase,
  epochAssetUrl,
  formatDate,
  isBusy,
  onLoadWorldOverview,
  worldOverview,
  worldOverviewPage,
}: WorldOverviewPanelProps) {
  return (
    <article className="agent-panel agent-public-world">
      <div className="agent-panel-head">
        <span>Epoch 世界总览</span>
        <b>{worldOverview ? `${worldOverview.totals.activeIdentities}/${worldOverview.totals.identities} 身份` : "未加载"}</b>
      </div>
      <div className="agent-action-row">
        <button type="button" disabled={isBusy} onClick={onLoadWorldOverview}>刷新世界总览</button>
        <a
          className="agent-public-link"
          href={`${agentServerBase}${worldOverviewPage}`}
          target="_blank"
          rel="noreferrer"
        >
          打开公开世界
        </a>
      </div>
      {worldOverview ? (
        <>
          <div className="agent-world-stats">
            <span>活跃 {worldOverview.totals.activeIdentities}</span>
            <span>定档 {worldOverview.totals.archivedIdentities}</span>
            <span>新闻区 {worldOverview.totals.regionsWithNews}</span>
            <span>结果页 {worldOverview.totals.resultPages}</span>
          </div>
          <div className="agent-world-overview-list">
            <strong>世界新闻</strong>
            {worldOverview.news.slice(0, 3).map((news) => (
              <a
                className="agent-world-overview-link"
                href={`${agentServerBase}/epoch/region/${encodeURIComponent(news.regionId)}`}
                target="_blank"
                rel="noreferrer"
                key={news.newsId}
              >
                <span>{news.headline}</span>
                <small>{playerRegionLabel(news.regionId)} · 传说 +{news.legendDelta}</small>
              </a>
            ))}
            {worldOverview.news.length === 0 ? <small>暂无公开新闻</small> : null}
          </div>
          <div className="agent-world-overview-list">
            <strong>分类荣誉</strong>
            {worldOverview.honorBoards.slice(0, 6).map((honorBoard) => (
              <div className="agent-world-overview-link" key={honorBoard.category}>
                <span>{honorBoard.title}</span>
                <small>{honorBoard.description}</small>
                {honorBoard.entries.slice(0, 3).map((entry, index) => (
                  <a
                    className="agent-inline-link"
                    href={`${agentServerBase}${entry.publicPages.agent}`}
                    target="_blank"
                    rel="noreferrer"
                    key={`${honorBoard.category}:${entry.agentId}`}
                  >
                    {index + 1}. {entry.identityName || playerAgentLabel(entry.agentId)} · {entry.score}
                  </a>
                ))}
                {honorBoard.entries.length === 0 ? <small>暂无记录</small> : null}
              </div>
            ))}
          </div>
          <div className="agent-world-overview-list">
            <strong>设定贡献</strong>
            {worldOverview.recentLoreContributions.slice(0, 3).map((recentLoreContribution) => (
              <a
                className="agent-world-overview-link"
                href={`${agentServerBase}${recentLoreContribution.publicPages.audit}`}
                target="_blank"
                rel="noreferrer"
                key={recentLoreContribution.eventId}
              >
                <span className="agent-lore-card-title">
                  <b className="agent-lore-layer-label is-shared">{LORE_CARD_LAYER_LABELS.shared}</b>
                  <em>{recentLoreContribution.identityName || playerAgentLabel(recentLoreContribution.agentId)}</em>
                </span>
                <small>
                  {playerLoreContributionCategoryLabel(recentLoreContribution.claimType)} · {recentLoreContribution.targetId} · {recentLoreContribution.summary} · 声明 {shortHash(recentLoreContribution.claimHash)} · 证据 {shortHash(recentLoreContribution.provenance.evidenceHash)} · 来源 {recentLoreContribution.provenance.sourceEventCount} 条 · {formatDate(recentLoreContribution.recordedAt)}
                </small>
                {recentLoreContribution.creatureBehaviorScopeReview ? (
                  <small className={`agent-creature-scope-label is-${recentLoreContribution.creatureBehaviorScopeReview.status}`}>
                    行为范围 · {CREATURE_BEHAVIOR_SCOPE_LABELS[recentLoreContribution.creatureBehaviorScopeReview.status]}
                    {" · "}{recentLoreContribution.creatureBehaviorScopeReview.claimedScope}
                    {" / 上限 "}{recentLoreContribution.creatureBehaviorScopeReview.allowedScope}
                    {" · 威胁 "}{recentLoreContribution.creatureBehaviorScopeReview.threat}
                    {" · 阶位 "}{recentLoreContribution.creatureBehaviorScopeReview.rankRole}
                    {recentLoreContribution.creatureBehaviorScopeReview.explanation ? ` · ${recentLoreContribution.creatureBehaviorScopeReview.explanation}` : ""}
                  </small>
                ) : null}
                {recentLoreContribution.fuzzyTimeIntervalReview ? (
                  <small className={`agent-fuzzy-time-label is-${recentLoreContribution.fuzzyTimeIntervalReview.congestionLevel}`}>
                    时间区间 · {recentLoreContribution.fuzzyTimeIntervalReview.intervalStartYear}-{recentLoreContribution.fuzzyTimeIntervalReview.intervalEndYear}
                    {" · "}{FUZZY_TIME_INTERVAL_LABELS[recentLoreContribution.fuzzyTimeIntervalReview.congestionLevel]}
                    {" · 重叠 "}{recentLoreContribution.fuzzyTimeIntervalReview.overlapCount}
                    {" · 权重 "}{recentLoreContribution.fuzzyTimeIntervalReview.occupancyWeight}
                  </small>
                ) : null}
                {recentLoreContribution.crossRegionMechanismReview ? (
                  <small className={`agent-cross-region-label is-${recentLoreContribution.crossRegionMechanismReview.tier}`}>
                    跨区机制 · {CROSS_REGION_MECHANISM_LABELS[recentLoreContribution.crossRegionMechanismReview.tier]}
                    {" · "}{CROSS_REGION_MECHANISM_KIND_LABELS[recentLoreContribution.crossRegionMechanismReview.mechanism]}
                    {" · "}{CROSS_REGION_MECHANISM_SUPPORT_LABELS[recentLoreContribution.crossRegionMechanismReview.support]}
                    {recentLoreContribution.crossRegionMechanismReview.fromRegionId && recentLoreContribution.crossRegionMechanismReview.toRegionId
                      ? ` · ${playerRegionLabel(recentLoreContribution.crossRegionMechanismReview.fromRegionId)} 到 ${playerRegionLabel(recentLoreContribution.crossRegionMechanismReview.toRegionId)}`
                      : ""}
                  </small>
                ) : null}
              </a>
            ))}
            {worldOverview.recentLoreContributions.length === 0 ? <small>暂无设定贡献</small> : null}
          </div>
          <div className="agent-world-overview-list">
            <strong>设定状态</strong>
            {worldOverview.loreTargetStatuses.slice(0, 3).map((loreTargetStatus) => {
              const sourceLabel = loreTargetStatus.statusSource === "system_adjudication" ? "系统裁决" : "贡献态势";
              const targetSummary = loreTargetStatus.latestAdjudication?.summary || loreTargetStatus.latestContribution.summary;
              const evidenceHash = loreTargetStatus.latestAdjudication?.provenance.evidenceHash || loreTargetStatus.latestContribution.provenance.evidenceHash;
              const sourceCount = loreTargetStatus.latestAdjudication?.provenance.sourceContributionEventCount || loreTargetStatus.latestContribution.provenance.sourceEventCount;
              return (
                <a
                  className="agent-world-overview-link"
                  href={`${agentServerBase}${loreTargetStatus.publicPages.audit}`}
                  target="_blank"
                  rel="noreferrer"
                  key={loreTargetStatus.targetId}
                >
                  <span className="agent-lore-card-title">
                    <b className={`agent-lore-layer-label is-${loreTargetStatusLayer(loreTargetStatus.status)}`}>
                      {LORE_CARD_LAYER_LABELS[loreTargetStatusLayer(loreTargetStatus.status)]}
                    </b>
                    <em>{loreTargetStatus.targetId}</em>
                  </span>
                  <small>{sourceLabel} · {playerLoreAdjudicationStatusLabel(loreTargetStatus.status)} · {targetSummary} · 证据 {shortHash(evidenceHash)} · 来源 {sourceCount} 条 · 确认 {loreTargetStatus.counts.confirmation} / 反驳 {loreTargetStatus.counts.refutation} / 修订 {loreTargetStatus.counts.revision}</small>
                  {loreTargetStatus.disputeArchiveGate ? (
                    <small className={`agent-dispute-gate-label is-${loreTargetStatus.disputeArchiveGate.status}`}>
                      争议门槛 · {DISPUTE_ARCHIVE_GATE_LABELS[loreTargetStatus.disputeArchiveGate.status]}
                      {" · 双方证据 "}{yesNoLabel(loreTargetStatus.disputeArchiveGate.bilateralEvidence)}
                      {" · 可检验 "}{yesNoLabel(loreTargetStatus.disputeArchiveGate.futureTestable)}
                      {loreTargetStatus.disputeArchiveGate.coreCanonHardConflict ? " · 核心正史硬冲突" : ""}
                    </small>
                  ) : null}
                  <small className="agent-worldview-gate-label">
                    MVP 守门 · {loreTargetStatus.worldviewGate.checks
                      .map((check) => `${check.label}:${WORLDVIEW_GATE_LABELS[check.status]}`)
                      .join(" / ")}
                  </small>
                </a>
              );
            })}
            {worldOverview.loreTargetStatuses.length === 0 ? <small>暂无设定状态</small> : null}
          </div>
          <WorldOverviewRecentResults
            agentServerBase={agentServerBase}
            formatDate={formatDate}
            publicSummaryText={playerPublicSummaryText}
            results={worldOverview.recentResults}
          />
          <div className="agent-world-overview-list">
            <strong>活跃赛季</strong>
            {worldOverview.activeSeasons.slice(0, 2).map((season) => (
              <a
                className="agent-world-overview-link"
                href={`${agentServerBase}/epoch/season/${encodeURIComponent(season.seasonId)}`}
                target="_blank"
                rel="noreferrer"
                key={season.seasonId}
              >
                <span>{season.title}</span>
                <small>{season.totalScore}/{season.targetScore} · {season.status}</small>
              </a>
            ))}
            {worldOverview.activeSeasons.length === 0 ? <small>暂无活跃赛季</small> : null}
          </div>
          <div className="agent-world-overview-list">
            <strong>区域概况</strong>
            {worldOverview.regionHighlights.slice(0, 3).map((regionHighlight) => (
              <a
                className="agent-world-overview-link"
                href={`${agentServerBase}${regionHighlight.publicPages.region}`}
                target="_blank"
                rel="noreferrer"
                key={regionHighlight.regionId}
              >
                {regionHighlight.worldScene?.imageUrl ? (
                  <img
                    className="agent-world-overview-scene-image"
                    src={epochAssetUrl(regionHighlight.worldScene.imageUrl)}
                    alt={regionHighlight.worldScene.publicAlt}
                    loading="lazy"
                  />
                ) : null}
                <span>{regionHighlight.worldScene?.title || regionHighlight.regionId}</span>
                <small>新闻 {regionHighlight.newsCount} · 发言 {regionHighlight.messageCount}</small>
              </a>
            ))}
            {worldOverview.regionHighlights.length === 0 ? <small>暂无区域活动</small> : null}
          </div>
        </>
      ) : (
        <p>读取服务器公开世界、新闻、结果页、赛季和区域概况。</p>
      )}
    </article>
  );
}
