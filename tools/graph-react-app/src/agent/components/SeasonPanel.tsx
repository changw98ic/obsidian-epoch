import type {
  EpochResourceId,
  EpochSeasonCampaign,
  EpochSeasonContribution,
  EpochSeasonPhaseEventType,
} from "../../types";
import { playerCommonStatusLabel, playerExplorerLabel, playerFactionLabel, playerTrustClassLabel } from "../agentPlayerLabels";

interface SeasonTemplateOption {
  readonly value: string;
  readonly label: string;
}

interface SeasonPanelProps {
  readonly activeIdentityDisabled: boolean;
  readonly agentServerBase: string;
  readonly contributeSeason: () => void;
  readonly epochAssetUrl: (pathOrUrl: string) => string;
  readonly formatDate: (value?: string) => string;
  readonly hasOperatorKey: boolean;
  readonly isBusy: boolean;
  readonly lastSeasonContribution?: EpochSeasonContribution | null;
  readonly loadSeasons: () => void;
  readonly playerFactionLabel: (value?: string | null) => string;
  readonly playerRegionLabel: (value?: string | null) => string;
  readonly primarySeason?: EpochSeasonCampaign | null;
  readonly resourceLabels: Record<EpochResourceId, string>;
  readonly seasonAmount: number;
  readonly seasonContributionReceipts: readonly EpochSeasonContribution[];
  readonly seasonFactionId: string;
  readonly seasonObjectiveEventLabels: Record<"season_objective_created" | "season_objective_completed", string>;
  readonly seasonPhaseLabels: Record<EpochSeasonPhaseEventType, string>;
  readonly seasonTemplateKey: string;
  readonly seasonTemplateOptions: readonly SeasonTemplateOption[];
  readonly seedSeason: () => void;
  readonly setSeasonAmount: (amount: number) => void;
  readonly setSeasonFactionId: (factionId: string) => void;
  readonly setSeasonTemplateKey: (seasonKey: string) => void;
  readonly settleSeason: () => void;
}

export function SeasonPanel({
  activeIdentityDisabled,
  agentServerBase,
  contributeSeason,
  epochAssetUrl,
  formatDate,
  hasOperatorKey,
  isBusy,
  lastSeasonContribution,
  loadSeasons,
  playerFactionLabel,
  playerRegionLabel,
  primarySeason,
  resourceLabels,
  seasonAmount,
  seasonContributionReceipts,
  seasonFactionId,
  seasonObjectiveEventLabels,
  seasonPhaseLabels,
  seasonTemplateKey,
  seasonTemplateOptions,
  seedSeason,
  setSeasonAmount,
  setSeasonFactionId,
  setSeasonTemplateKey,
  settleSeason,
}: SeasonPanelProps) {
  return (
    <article className="agent-panel agent-objectives">
      <div className="agent-panel-head">
        <span>赛季阵营战</span>
        <b>{primarySeason ? primarySeason.status : "empty"}</b>
      </div>
      <div className="agent-action-row">
        <button type="button" disabled={isBusy || !hasOperatorKey} onClick={seedSeason}>启动赛季</button>
        <button type="button" disabled={isBusy} onClick={loadSeasons}>刷新赛季</button>
        {primarySeason ? (
          <a
            className="agent-public-link"
            href={`${agentServerBase}/epoch/season/${encodeURIComponent(primarySeason.seasonId)}`}
            target="_blank"
            rel="noreferrer"
          >
            赛季档案
          </a>
        ) : null}
      </div>
      <select value={seasonTemplateKey} onChange={(event) => setSeasonTemplateKey(event.target.value)}>
        {seasonTemplateOptions.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
      {primarySeason ? (
        <>
          {primarySeason.media?.banner ? (
            <img
              className="agent-season-banner-image"
              src={epochAssetUrl(primarySeason.media.banner.imageUrl)}
              alt={primarySeason.media.banner.publicAlt}
              loading="lazy"
            />
          ) : null}
          {primarySeason.media?.campaignKeyArt ? (
            <div className="agent-season-campaign-key-art" style={{ borderColor: primarySeason.media.campaignKeyArt.accentColor }}>
              <img
                className="agent-campaign-key-art-image"
                src={epochAssetUrl(primarySeason.media.campaignKeyArt.imageUrl)}
                alt={primarySeason.media.campaignKeyArt.publicAlt}
                loading="lazy"
              />
              <span>
                {primarySeason.media.campaignKeyArt.title}
                <b>{primarySeason.media.campaignKeyArt.campaignKey}</b>
                <small>{primarySeason.media.campaignKeyArt.subtitle}</small>
              </span>
            </div>
          ) : null}
          <strong>{primarySeason.title}</strong>
          <p>{primarySeason.description}</p>
          <dl>
            <div><dt>进度</dt><dd>{primarySeason.totalScore}/{primarySeason.targetScore}</dd></div>
            <div><dt>消耗</dt><dd>{resourceLabels[primarySeason.resourceId]}</dd></div>
            <div><dt>胜方</dt><dd>{playerFactionLabel(primarySeason.winningFactionId || primarySeason.factionStandings[0]?.factionId)}</dd></div>
          </dl>
          <select value={seasonFactionId} onChange={(event) => setSeasonFactionId(event.target.value)}>
            {(primarySeason.factionIds.length ? primarySeason.factionIds : ["gray_watch"]).map((factionId) => (
              <option key={factionId} value={factionId}>{playerFactionLabel(factionId)}</option>
            ))}
          </select>
          <input
            type="number"
            min="1"
            value={seasonAmount}
            onChange={(event) => setSeasonAmount(Math.max(1, Number(event.target.value || 1)))}
          />
          <div className="agent-action-row">
            <button type="button" disabled={isBusy || activeIdentityDisabled || primarySeason.status !== "active"} onClick={contributeSeason}>贡献</button>
            <button type="button" disabled={isBusy || !hasOperatorKey || primarySeason.status !== "active"} onClick={settleSeason}>结算</button>
          </div>
          {lastSeasonContribution?.seasonId === primarySeason.seasonId ? (
            <div className="agent-mini-list">
              <span>
                最近赛季贡献 · {playerFactionLabel(lastSeasonContribution.factionId)}
                <b>基础分 {lastSeasonContribution.baseScoreDelta} + 组织加成 {lastSeasonContribution.organizationBonusScore} + 控制加成 {lastSeasonContribution.regionControlBonusScore} = 最终分 {lastSeasonContribution.scoreDelta}</b>
                <small>
                  投入 {lastSeasonContribution.amount} {resourceLabels[lastSeasonContribution.resourceId]} · {lastSeasonContribution.sourceOrganizationUpgradeIds.length > 0
                    ? `升级证据 ${lastSeasonContribution.sourceOrganizationUpgradeIds.join(" / ")}`
                    : "无组织升级加成"}
                  {" "} · {lastSeasonContribution.sourceRegionControlRegionIds.length > 0
                    ? `控制区域 ${lastSeasonContribution.sourceRegionControlRegionIds.map(playerRegionLabel).join(" / ")}`
                    : "无区域控制加成"}
                </small>
              </span>
            </div>
          ) : null}
          {seasonContributionReceipts.length ? (
            <details className="agent-season-contribution-history">
              <summary>赛季贡献历史</summary>
              {seasonContributionReceipts.map((item) => (
                <span key={item.eventId}>
                  {formatDate(item.recordedAt)} · {playerFactionLabel(item.factionId)}
                  <b>基础分 {item.baseScoreDelta} + 组织加成 {item.organizationBonusScore} + 控制加成 {item.regionControlBonusScore} = 最终分 {item.scoreDelta}</b>
                  <small>
                    身份记录 / {playerTrustClassLabel(item.trustClass)} · 投入 {item.amount} {resourceLabels[item.resourceId]} · {item.sourceOrganizationUpgradeIds.length > 0
                      ? `升级证据 ${item.sourceOrganizationUpgradeIds.join(" / ")}`
                      : "无组织升级加成"}
                    {" "} · {item.sourceRegionControlRegionIds.length > 0
                      ? `控制区域 ${item.sourceRegionControlRegionIds.map(playerRegionLabel).join(" / ")}`
                      : "无区域控制加成"}
                  </small>
                </span>
              ))}
            </details>
          ) : null}
          <div className="agent-mini-list">
            {primarySeason.objectives.slice(0, 3).map((objective) => (
              <span key={objective.objectiveId}>
                赛季目标 · {objective.title}
                <b>
                  {playerCommonStatusLabel(objective.status)} / {objective.progressScore}/{objective.targetScore} / {objective.completedByFactionId ? playerFactionLabel(objective.completedByFactionId) : seasonObjectiveEventLabels.season_objective_created}
                  {objective.status === "completed" ? ` / ${seasonObjectiveEventLabels.season_objective_completed}` : ""}
                </b>
              </span>
            ))}
            {primarySeason.phaseEvents.slice(-3).map((phase) => (
              <span key={phase.eventId}>
                赛季阶段 · {seasonPhaseLabels[phase.eventType]}
                <b>{phase.phase} / 关联 {phase.relatedEventIds.length} 条 / 来源已记录</b>
              </span>
            ))}
            {primarySeason.factionStandings.slice(0, 4).map((standing) => (
              <span className={standing.media ? "agent-faction-media-row" : undefined} key={standing.factionId}>
                {standing.media ? (
                  <img
                    className="agent-faction-media-image"
                    src={epochAssetUrl(standing.media.imageUrl)}
                    alt={standing.media.publicAlt}
                    loading="lazy"
                  />
                ) : null}
                <span>
                  {playerFactionLabel(standing.factionId)}
                  <b>{standing.score} / 可信 {standing.trustedScore} / 信任 {playerTrustClassLabel(standing.dominantTrustClass)}</b>
                </span>
              </span>
            ))}
            {primarySeason.agentStandings.slice(0, 4).map((standing) => (
              <span key={`${standing.agentId}:${standing.factionId}`}>
                {playerExplorerLabel(standing.explorerId)} / {playerFactionLabel(standing.factionId)}
                <b>{standing.score} / 可信 {standing.trustedScore} / 信任 {playerTrustClassLabel(standing.dominantTrustClass)}</b>
              </span>
            ))}
          </div>
        </>
      ) : (
        <p>赛季会把多个身份的资源贡献汇总到阵营榜，结算由服务器事件完成。</p>
      )}
    </article>
  );
}
