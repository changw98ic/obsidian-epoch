export interface ResourcePanelEntry {
  readonly amount: number;
  readonly caption: string;
  readonly label: string;
  readonly media?: {
    readonly accentColor: string;
    readonly imageUrl: string;
    readonly publicAlt: string;
  };
  readonly resourceId: string;
}

interface ResourcePanelProps {
  readonly entries: readonly ResourcePanelEntry[];
  readonly epochAssetUrl: (pathOrUrl: string) => string;
}

export function ResourcePanel({ entries, epochAssetUrl }: ResourcePanelProps) {
  return (
    <article className="agent-panel">
      <div className="agent-panel-head">
        <span>资源</span>
        <b>服务器结算</b>
      </div>
      <div className="agent-resource-grid">
        {entries.map((entry) => (
          <span
            className={entry.media ? "agent-resource-media-row" : undefined}
            key={entry.resourceId}
            style={entry.media ? { borderColor: entry.media.accentColor } : undefined}
          >
            {entry.media ? (
              <img
                className="agent-resource-media-image"
                src={epochAssetUrl(entry.media.imageUrl)}
                alt={entry.media.publicAlt}
              />
            ) : null}
            <b>{entry.amount}</b>
            <em>{entry.label}</em>
            <small>{entry.caption}</small>
          </span>
        ))}
      </div>
    </article>
  );
}
