import type {
  EpochWebBridgeActionOption,
  EpochWebBridgeActionResult,
  EpochWebBridgeTurn,
} from "../../types";
import { playerChannelClassLabel, playerTrustClassLabel } from "../agentPlayerLabels";

interface WebBridgePlaySurfaceProps {
  readonly currentAgentId?: string;
  readonly hostedMandate: string;
  readonly hostedVisibleText: string;
  readonly identityDisabledReason?: string;
  readonly isBusy: boolean;
  readonly lastAction: EpochWebBridgeActionResult | null;
  readonly onCopyPrompt: () => void;
  readonly onIssueIdentity: () => void;
  readonly onPublishResult: () => void;
  readonly onStartTurn: () => void;
  readonly onSubmitAction: (option: EpochWebBridgeActionOption) => void;
  readonly regionLabel: string;
  readonly resultPublishAuthorizationCopy: string;
  readonly setHostedMandate: (value: string) => void;
  readonly setHostedVisibleText: (value: string) => void;
  readonly webBridgeTurn: EpochWebBridgeTurn | null;
}

export function WebBridgePlaySurface({
  currentAgentId,
  hostedMandate,
  hostedVisibleText,
  identityDisabledReason,
  isBusy,
  lastAction,
  onCopyPrompt,
  onIssueIdentity,
  onPublishResult,
  onStartTurn,
  onSubmitAction,
  regionLabel,
  resultPublishAuthorizationCopy,
  setHostedMandate,
  setHostedVisibleText,
  webBridgeTurn,
}: WebBridgePlaySurfaceProps) {
  return (
    <section className="agent-web-play-surface" aria-labelledby="agent-web-play-title">
      <header className="agent-web-play-head">
        <div>
          <span>Web LLM Relay</span>
          <h1 id="agent-web-play-title">网页大模型接力</h1>
        </div>
        <div className="agent-web-play-status">
          <span>身份 <b>{currentAgentId ? "已签发" : "待签发"}</b></span>
          <span>区域 <b>{regionLabel}</b></span>
          <span>结算 <b>服务器受限</b></span>
        </div>
      </header>

      {!currentAgentId ? (
        <div className="agent-web-play-stage">
          <span>身份</span>
          <button type="button" disabled={isBusy || Boolean(identityDisabledReason)} onClick={onIssueIdentity}>签发行动身份</button>
          {identityDisabledReason ? <small>{identityDisabledReason}</small> : null}
        </div>
      ) : null}

      {currentAgentId && !webBridgeTurn && !lastAction ? (
        <div className="agent-web-play-stage">
          <label>
            <span>本轮委托</span>
            <input value={hostedMandate} onChange={(event) => setHostedMandate(event.target.value)} />
          </label>
          <button type="button" disabled={isBusy || !hostedMandate.trim()} onClick={onStartTurn}>生成接力回合</button>
        </div>
      ) : null}

      {webBridgeTurn ? (
        <div className="agent-web-play-columns">
          <div className="agent-web-play-stage">
            <div className="agent-web-play-stage-head">
              <span>接力提示</span>
              <b>{playerChannelClassLabel(webBridgeTurn.channelClass)} · {playerTrustClassLabel(webBridgeTurn.deliveryTrust)}</b>
            </div>
            <textarea className="agent-web-play-prompt" readOnly value={webBridgeTurn.copyPrompt} />
            <button type="button" disabled={isBusy} onClick={onCopyPrompt}>复制提示</button>
          </div>
          <div className="agent-web-play-stage">
            <label>
              <span>网页模型输出</span>
              <textarea value={hostedVisibleText} onChange={(event) => setHostedVisibleText(event.target.value)} />
            </label>
            <div className="agent-web-play-options">
              {webBridgeTurn.actionOptions.map((option) => (
                <button
                  type="button"
                  key={option.actionOptionId}
                  disabled={isBusy || !hostedVisibleText.trim()}
                  onClick={() => onSubmitAction(option)}
                >
                  <b>{option.label}</b>
                  <span>{option.risk === "high" ? "高风险" : option.risk === "medium" ? "中风险" : "低风险"}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {lastAction && !webBridgeTurn ? (
        <div className="agent-web-play-stage agent-web-play-result">
          <div>
            <span>服务器结算</span>
            <h2>{lastAction.action.optionLabel}</h2>
            <p>{lastAction.action.outcomeSummary}</p>
          </div>
          <div className="agent-action-row">
            <button type="button" disabled={isBusy} onClick={onPublishResult}>发布结果</button>
            <button type="button" disabled={isBusy} onClick={onStartTurn}>下一回合</button>
            <small>{resultPublishAuthorizationCopy}</small>
          </div>
        </div>
      ) : null}
    </section>
  );
}
