import type {
  EpochCompetitiveLadderMode,
  EpochCompetitiveLadderView,
} from "../../types";
import { playerExplorerLabel, playerTrustClassLabel } from "../agentPlayerLabels";

interface CompetitiveLadderPanelProps {
  readonly isBusy: boolean;
  readonly ladder: EpochCompetitiveLadderView | null;
  readonly mode: EpochCompetitiveLadderMode;
  readonly onLoad: () => void;
  readonly onModeChange: (mode: EpochCompetitiveLadderMode) => void;
}

const MODE_LABELS: Record<EpochCompetitiveLadderMode, string> = {
  casual: "休闲",
  ranked: "正式",
  verified: "验证",
};

export function CompetitiveLadderPanel({
  isBusy,
  ladder,
  mode,
  onLoad,
  onModeChange,
}: CompetitiveLadderPanelProps) {
  return (
    <article className="agent-panel agent-competitive-ladder">
      <div className="agent-panel-head">
        <span>区域竞技梯</span>
        <b>{ladder?.dimension.title || MODE_LABELS[mode]}</b>
      </div>
      <div className="agent-action-row agent-ladder-mode-row" role="group" aria-label="竞技梯模式">
        {(Object.keys(MODE_LABELS) as EpochCompetitiveLadderMode[]).map((item) => (
          <button
            key={item}
            type="button"
            aria-label={`切换到${MODE_LABELS[item]}竞技梯`}
            aria-pressed={mode === item}
            className={mode === item ? "is-active" : undefined}
            disabled={isBusy}
            onClick={() => onModeChange(item)}
          >
            {MODE_LABELS[item]}
          </button>
        ))}
        <button type="button" aria-label="刷新竞技梯" disabled={isBusy} onClick={onLoad}>刷新</button>
      </div>
      {ladder ? (
        <div className="agent-ladder-summary" aria-label="竞技梯摘要">
          <span>{ladder.dimension.kind}</span>
          <b>{ladder.total} 条记录</b>
          <em>{ladder.truncated ? `显示前 ${ladder.limit}` : "完整列表"}{ladder.dimension.status ? ` · ${ladder.dimension.status}` : ""}</em>
        </div>
      ) : null}
      <p>
        {mode === "verified"
          ? "仅服务器托管、宿主见证或远程见证行动计分。"
          : mode === "ranked"
            ? "只读服务器结算，同时保留交付可信度标记。"
            : "展示全部合法结算，不代表验证交付。"}
      </p>
      <div className="agent-mini-list">
        {ladder?.entries.map((entry) => (
          <span className="agent-ladder-entry" key={entry.agentId}>
            <b>#{entry.rank} {playerExplorerLabel(entry.explorerId)}</b>
            <em>{entry.score} 分 · {playerTrustClassLabel(entry.dominantTrustClass)}</em>
            <small>验证分 {entry.verifiedScore} · 入典分 {entry.canonicalScore} · 排除 {entry.excludedScore}</small>
            <small>{entry.deliveryClass} · {entry.eligibilityReasons.join(" / ") || "服务器已收录"} · 审计 {entry.auditLinks.length}</small>
          </span>
        ))}
        {ladder && !ladder.entries.length ? <span>当前模式暂无合资格记录。</span> : null}
      </div>
    </article>
  );
}
