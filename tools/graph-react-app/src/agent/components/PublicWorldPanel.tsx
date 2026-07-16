import type { AgentPublicWorld } from "../../types";

interface PublicWorldPanelProps {
  readonly fallbackText: string;
  readonly isBusy: boolean;
  readonly onLoadPublicWorld: () => void;
  readonly publicWorld: AgentPublicWorld | null;
}

export function PublicWorldPanel({
  fallbackText,
  isBusy,
  onLoadPublicWorld,
  publicWorld,
}: PublicWorldPanelProps) {
  return (
    <article className="agent-panel agent-public-world">
      <div className="agent-panel-head">
        <span>公共大世界</span>
        <b>{publicWorld ? `${publicWorld.summary.archiveRuns} 战报` : "未加载"}</b>
      </div>
      <button type="button" disabled={isBusy} onClick={onLoadPublicWorld}>刷新公共索引</button>
      {publicWorld ? (
        <div className="agent-world-stats">
          <span>正典 {publicWorld.summary.canonicalClaims}</span>
          <span>争议 {publicWorld.summary.disputedClaims}</span>
          <span>冲突 {publicWorld.summary.openConflicts}</span>
          <span>阵营 {publicWorld.summary.acceptedFactions}</span>
          <span>节点 {publicWorld.sourceGraph.nodes.length}</span>
          <span>边 {publicWorld.sourceGraph.edges.length}</span>
        </div>
      ) : (
        <p>{fallbackText}</p>
      )}
    </article>
  );
}
