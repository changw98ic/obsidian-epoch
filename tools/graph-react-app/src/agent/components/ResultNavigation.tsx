import type { EpochResultPage } from "../../types";

interface ResultNavigationProps {
  readonly assetUrl: (pathOrUrl: string) => string;
  readonly resultPage: EpochResultPage;
  readonly sourceTypeLabel: (sourceType: string) => string;
  readonly toolLabel: (toolName: string) => string;
}

export function ResultNavigation({
  assetUrl,
  resultPage,
  sourceTypeLabel,
  toolLabel,
}: ResultNavigationProps) {
  return (
    <div className="agent-mini-list" aria-label="结果页下一步">
      {resultPage.nextActions.length ? resultPage.nextActions.slice(0, 4).map((action) => (
        <span className={action.media ? "agent-activity-media-row" : undefined} key={action.actionId}>
          {action.media ? (
            <img
              className="agent-activity-media-image"
              src={assetUrl(action.media.imageUrl)}
              alt={action.media.publicAlt}
              loading="lazy"
            />
          ) : null}
          <span>
            下一步 · {action.label} · {toolLabel(action.toolName)}
            {action.sourceType ? ` · ${sourceTypeLabel(action.sourceType)}` : ""}
          </span>
        </span>
      )) : <span>暂无服务器建议行动</span>}
    </div>
  );
}
