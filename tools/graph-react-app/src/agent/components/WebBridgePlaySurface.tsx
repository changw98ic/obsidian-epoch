import type {
  EpochAgentBriefingView,
  EpochWorldOverviewInfo,
} from "../../types";
import type { EpochInstallStatus } from "../api";

interface WebBridgePlaySurfaceProps {
  readonly agentBriefing: EpochAgentBriefingView | null;
  readonly currentAgentId?: string;
  readonly installStatus: EpochInstallStatus | null;
  readonly isRefreshing: boolean;
  readonly lastSyncedAt?: string;
  readonly onCopyInstruction: (instruction: string) => void;
  readonly onRefresh: () => void;
  readonly worldOverview: EpochWorldOverviewInfo | null;
}

function mcpInstruction(currentAgentId: string | undefined) {
  if (currentAgentId) {
    return "请连接黑曜纪元 MCP，读取 obsidian_epoch.agent_briefing；根据身份、资源、区域事件、行动限制和你的游戏计划，自行决定是否调用其他工具。";
  }
  return "请连接黑曜纪元 MCP，创建我的身份，再读取 obsidian_epoch.agent_briefing；依据服务器事实自主规划本局。";
}

export function WebBridgePlaySurface({
  agentBriefing,
  currentAgentId,
  installStatus,
  isRefreshing,
  lastSyncedAt,
  onCopyInstruction,
  onRefresh,
  worldOverview,
}: WebBridgePlaySurfaceProps) {
  const instruction = mcpInstruction(currentAgentId);

  return (
    <section className="agent-web-play-surface" aria-labelledby="agent-web-play-title">
      <header className="agent-web-play-head">
        <div>
          <span>MCP first</span>
          <h1 id="agent-web-play-title">MCP 行动观察</h1>
        </div>
        <div className="agent-web-play-status">
          <span>身份 <b>{currentAgentId ? "已同步到此浏览器" : "由 Agent 对话管理"}</b></span>
          <span>连接 <b>{installStatus?.ok ? "安装检查通过" : "等待检查"}</b></span>
          <span>世界 <b>{worldOverview ? "公开世界已读取" : "等待读取"}</b></span>
        </div>
      </header>

      <p className="agent-web-play-observer-note">
        网页只用于查看进度、凭证和安装信息，不会创建身份、发起行动、领取奖励或提交结果。
      </p>

      <div className="agent-web-play-columns">
        <section className="agent-web-play-stage" aria-label="给 Agent 的 MCP 指令">
          <div className="agent-web-play-stage-head">
            <span>交给 Agent 的上下文请求</span>
            <b>读取服务器事实</b>
          </div>
          <textarea className="agent-web-play-prompt" readOnly value={instruction} />
          <div className="agent-action-row">
            <button type="button" onClick={() => onCopyInstruction(instruction)}>复制给 Agent</button>
            <a href="/epoch/install">安装或重连 MCP</a>
          </div>
        </section>

        <section className="agent-web-play-stage" aria-label="服务器观察摘要">
          <div className="agent-web-play-stage-head">
            <span>服务器状态</span>
            <b>{agentBriefing ? "已同步" : "等待 Agent 读取"}</b>
          </div>
          {agentBriefing ? (
            <div className="agent-web-play-summary">
              <b>{agentBriefing.progress.actionEligibility.canUseActiveTools ? "身份可行动" : "行动权限受限"}</b>
              <p>{agentBriefing.progress.actionEligibility.reason}</p>
              <small>区域事实：{agentBriefing.regionalContext?.news.length || 0} 条新闻 / {agentBriefing.regionalContext?.commissions.length || 0} 个开放委托</small>
            </div>
          ) : (
            <p>Agent 读取简报后，这里只显示服务器签发的当前状态与限制。</p>
          )}
          <div className="agent-action-row">
            <button type="button" disabled={isRefreshing} onClick={onRefresh}>
              {isRefreshing ? "正在刷新观察数据" : "刷新观察数据"}
            </button>
            {lastSyncedAt ? <small>最近同步：{lastSyncedAt}</small> : null}
          </div>
        </section>
      </div>
    </section>
  );
}
