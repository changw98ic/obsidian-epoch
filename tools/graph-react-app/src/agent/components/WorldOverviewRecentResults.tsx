import type { EpochGameRunStatus, EpochWorldOverviewRecentResult } from "../../types";

interface WorldOverviewRecentResultsProps {
  readonly agentServerBase: string;
  readonly formatDate: (value?: string) => string;
  readonly publicSummaryText: (value?: string | null) => string;
  readonly results: readonly EpochWorldOverviewRecentResult[];
}

const RUN_STATUS_LABELS: Record<EpochGameRunStatus, string> = {
  draft: "草稿",
  running: "进行中",
  settling: "结算中",
  settled: "已结算",
  published: "已发布",
  archived: "已归档",
};

export function WorldOverviewRecentResults({
  agentServerBase,
  formatDate,
  publicSummaryText,
  results,
}: WorldOverviewRecentResultsProps) {
  return (
    <div className="agent-world-overview-list">
      <strong>最新结果页</strong>
      {results.slice(0, 3).map((page) => (
        <a
          className="agent-world-overview-link"
          href={`${agentServerBase}${page.urlPath}`}
          target="_blank"
          rel="noreferrer"
          key={page.pageId}
        >
          <span>{publicSummaryText(page.identityName || page.agentId || page.pageId)}</span>
          {page.publicSafeSummary ? <small> · {publicSummaryText(page.publicSafeSummary.text)}</small> : null}
          {page.run ? (
            <small>
              {page.run?.title} · {page.run?.stepCount} 段 · {RUN_STATUS_LABELS[page.run.status]}
            </small>
          ) : null}
          <small>可校验记录 {page.canonicalEventCount} 条 · 有效至 {formatDate(page.expiresAt)}</small>
        </a>
      ))}
      {results.length === 0 ? <small>暂无公开结果页</small> : null}
    </div>
  );
}
