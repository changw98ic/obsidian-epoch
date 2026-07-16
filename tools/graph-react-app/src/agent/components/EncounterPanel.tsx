import type {
  EpochAnomalyEvent,
  EpochContestedObjective,
  EpochResourceId,
  EpochResourceNode,
} from "../../types";
import { playerExplorerLabel } from "../agentPlayerLabels";

interface EncounterPanelProps {
  readonly activeIdentityDisabled: boolean;
  readonly anomalyFocus: number;
  readonly contestAnomaly: () => void;
  readonly contestResourceNode: () => void;
  readonly contributeObjective: () => void;
  readonly epochAssetUrl: (pathOrUrl: string) => string;
  readonly isBusy: boolean;
  readonly loadAnomalies: () => void;
  readonly loadObjectives: () => void;
  readonly loadResourceNodes: () => void;
  readonly objectiveAmount: number;
  readonly objectiveTemplateKey: "supply_drive" | "archive_focus" | "trace_race";
  readonly operatorKey: string;
  readonly primaryAnomaly?: EpochAnomalyEvent | null;
  readonly primaryObjective?: EpochContestedObjective | null;
  readonly primaryResourceNode?: EpochResourceNode | null;
  readonly resolveAnomaly: () => void;
  readonly resourceLabels: Record<EpochResourceId, string>;
  readonly resourceNodeStamina: number;
  readonly seedObjective: () => void;
  readonly setAnomalyFocus: (focus: number) => void;
  readonly setObjectiveAmount: (amount: number) => void;
  readonly setObjectiveTemplateKey: (key: "supply_drive" | "archive_focus" | "trace_race") => void;
  readonly setResourceNodeStamina: (stamina: number) => void;
  readonly settleObjective: () => void;
  readonly settleResourceNode: () => void;
  readonly spawnAnomaly: () => void;
  readonly spawnResourceNode: () => void;
}

export function EncounterPanel({
  activeIdentityDisabled,
  anomalyFocus,
  contestAnomaly,
  contestResourceNode,
  contributeObjective,
  epochAssetUrl,
  isBusy,
  loadAnomalies,
  loadObjectives,
  loadResourceNodes,
  objectiveAmount,
  objectiveTemplateKey,
  operatorKey,
  primaryAnomaly,
  primaryObjective,
  primaryResourceNode,
  resolveAnomaly,
  resourceLabels,
  resourceNodeStamina,
  seedObjective,
  setAnomalyFocus,
  setObjectiveAmount,
  setObjectiveTemplateKey,
  setResourceNodeStamina,
  settleObjective,
  settleResourceNode,
  spawnAnomaly,
  spawnResourceNode,
}: EncounterPanelProps) {
  return (
    <>
      <article className="agent-panel agent-objectives">
        <div className="agent-panel-head">
          <span>区域目标</span>
          <b>{primaryObjective ? primaryObjective.status : "empty"}</b>
        </div>
        <div className="agent-action-row">
          <select
            aria-label="区域目标模板"
            value={objectiveTemplateKey}
            onChange={(event) => setObjectiveTemplateKey(event.target.value as typeof objectiveTemplateKey)}
          >
            <option value="supply_drive">补给贡献榜</option>
            <option value="archive_focus">档案贡献榜</option>
            <option value="trace_race">灰痕竞速委托</option>
          </select>
          <button type="button" disabled={isBusy || !operatorKey.trim()} onClick={seedObjective}>启动模板</button>
          <button type="button" disabled={isBusy} onClick={loadObjectives}>刷新榜单</button>
        </div>
        {primaryObjective ? (
          <>
            <strong>{primaryObjective.title}</strong>
            <p>{primaryObjective.description}</p>
            <dl>
              <div><dt>进度</dt><dd>{primaryObjective.totalScore}/{primaryObjective.targetScore}</dd></div>
              <div><dt>玩法</dt><dd>{primaryObjective.mode === "race" ? "竞速委托" : "贡献榜"}</dd></div>
              <div><dt>消耗</dt><dd>{resourceLabels[primaryObjective.resourceId]}</dd></div>
              <div><dt>奖励</dt><dd>{resourceLabels[primaryObjective.reward.resourceId]} {primaryObjective.reward.amount}</dd></div>
            </dl>
            <input
              type="number"
              aria-label="区域目标贡献数量"
              min="1"
              value={objectiveAmount}
              onChange={(event) => setObjectiveAmount(Math.max(1, Number(event.target.value || 1)))}
            />
            <div className="agent-action-row">
              <button type="button" disabled={isBusy || activeIdentityDisabled || primaryObjective.status !== "active"} onClick={contributeObjective}>贡献</button>
              <button type="button" disabled={isBusy || !operatorKey.trim() || primaryObjective.status !== "active"} onClick={settleObjective}>结算</button>
            </div>
            <div className="agent-mini-list">
              {primaryObjective.raceCompletions.slice(0, 4).map((completion) => (
                <span className="agent-race-commission-row" key={completion.completionId}>
                  <b>第 {completion.place} 名 · {playerExplorerLabel(completion.explorerId)}</b>
                  <em>{completion.score} 分 · {resourceLabels[completion.reward.resourceId]} +{completion.reward.amount}</em>
                  <small>{completion.reward.reason} · {completion.completedAt}</small>
                </span>
              ))}
              {primaryObjective.leaderboard.slice(0, 4).map((standing) => (
                <span key={standing.agentId}>
                  <b>{playerExplorerLabel(standing.explorerId)}</b>
                  <em>{standing.score} 分 · 贡献 {standing.amount}</em>
                </span>
              ))}
            </div>
          </>
        ) : (
          <p>启动服务器模板目标后，代理可以用真实资源争夺区域榜。</p>
        )}
      </article>

      <article className="agent-panel agent-objectives">
        <div className="agent-panel-head">
          <span>区域资源点</span>
          <b>{primaryResourceNode ? primaryResourceNode.status : "empty"}</b>
        </div>
        <div className="agent-action-row">
          <button type="button" disabled={isBusy || !operatorKey.trim()} onClick={spawnResourceNode}>生成资源点</button>
          <button type="button" disabled={isBusy} onClick={loadResourceNodes}>刷新资源点</button>
        </div>
        {primaryResourceNode ? (
          <>
            <strong>{primaryResourceNode.title}</strong>
            <p>{primaryResourceNode.description}</p>
            <dl>
              <div><dt>总分</dt><dd>{primaryResourceNode.totalScore}</dd></div>
              <div><dt>奖励</dt><dd>{resourceLabels[primaryResourceNode.reward.resourceId]} {primaryResourceNode.reward.amount}</dd></div>
              <div><dt>领先</dt><dd>{primaryResourceNode.leaderboard[0]?.explorerId || "暂无"}</dd></div>
            </dl>
            <input
              type="number"
              min="1"
              value={resourceNodeStamina}
              onChange={(event) => setResourceNodeStamina(Math.max(1, Number(event.target.value || 1)))}
            />
            <div className="agent-action-row">
              <button type="button" disabled={isBusy || activeIdentityDisabled || primaryResourceNode.status !== "open"} onClick={contestResourceNode}>争抢</button>
              <button type="button" disabled={isBusy || !operatorKey.trim() || primaryResourceNode.status !== "open"} onClick={settleResourceNode}>结算</button>
            </div>
            <div className="agent-mini-list">
              {primaryResourceNode.leaderboard.slice(0, 4).map((standing) => (
                <span key={standing.agentId}>{playerExplorerLabel(standing.explorerId)}：{standing.score}<b>体力 {standing.staminaSpent}</b></span>
              ))}
            </div>
          </>
        ) : (
          <p>资源点会按服务器体力消耗排名，结算时只发放服务器定义的奖励。</p>
        )}
      </article>

      <article className="agent-panel agent-objectives">
        <div className="agent-panel-head">
          <span>区域异常链</span>
          <b>{primaryAnomaly ? primaryAnomaly.status : "empty"}</b>
        </div>
        <div className="agent-action-row">
          <button type="button" disabled={isBusy || !operatorKey.trim()} onClick={spawnAnomaly}>生成异常</button>
          <button type="button" disabled={isBusy} onClick={loadAnomalies}>刷新异常</button>
        </div>
        {primaryAnomaly ? (
          <>
            <strong>{primaryAnomaly.title}</strong>
            <p>{primaryAnomaly.description}</p>
            {primaryAnomaly.media ? (
              <div className="agent-boss-media" style={{ borderColor: primaryAnomaly.media.accentColor }}>
                {primaryAnomaly.media.imageUrl ? (
                  <img
                    className="agent-boss-media-image"
                    src={epochAssetUrl(primaryAnomaly.media.imageUrl)}
                    alt={primaryAnomaly.media.publicAlt}
                    loading="lazy"
                  />
                ) : null}
                <span className="agent-boss-media-sigil" style={{ color: primaryAnomaly.media.dangerColor }}>
                  {primaryAnomaly.media.sigil}
                </span>
                <div>
                  <b>{primaryAnomaly.media.variantLabel}</b>
                  <p>{primaryAnomaly.media.publicAlt}</p>
                  <em>{primaryAnomaly.media.scenePrompt}</em>
                  <div className="agent-boss-palette">
                    {primaryAnomaly.media.palette.map((color) => (
                      <span key={color} style={{ background: color }} title={color} />
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
            <dl>
              <div><dt>压制</dt><dd>{primaryAnomaly.totalScore}/{primaryAnomaly.targetScore}</dd></div>
              <div><dt>奖励</dt><dd>{resourceLabels[primaryAnomaly.reward.resourceId]} {primaryAnomaly.reward.amount}</dd></div>
              <div><dt>寿命风险</dt><dd>{primaryAnomaly.lifetimeRisk}</dd></div>
              <div><dt>领先</dt><dd>{primaryAnomaly.leaderboard[0]?.explorerId || "暂无"}</dd></div>
            </dl>
            <input
              type="number"
              min="1"
              value={anomalyFocus}
              onChange={(event) => setAnomalyFocus(Math.max(1, Number(event.target.value || 1)))}
            />
            <div className="agent-action-row">
              <button type="button" disabled={isBusy || activeIdentityDisabled || primaryAnomaly.status !== "open"} onClick={contestAnomaly}>压制</button>
              <button type="button" disabled={isBusy || !operatorKey.trim() || primaryAnomaly.status !== "open"} onClick={resolveAnomaly}>结算</button>
            </div>
            <div className="agent-mini-list">
              {primaryAnomaly.leaderboard.slice(0, 4).map((standing) => (
                <span key={standing.agentId}>{playerExplorerLabel(standing.explorerId)}：{standing.score}<b>专注点 {standing.focusSpent}</b></span>
              ))}
            </div>
          </>
        ) : (
          <p>异常链按服务器 targetScore 和真实专注点消耗结算，胜者奖励与寿命风险都由服务器判定。</p>
        )}
      </article>
    </>
  );
}
