import type {
  EpochActionExplanation,
  EpochAttestationChallenge,
  EpochHostedActionOption,
  EpochHostedSession,
  EpochHighValueConfirmation,
  EpochServerHostedActionRun,
  EpochServerHostedJob,
  EpochTurnActionOption,
  EpochTurnCard,
  EpochWebBridgeActionOption,
  EpochWebBridgeActionResult,
  EpochWebBridgeTurn,
  ExplorerIdentity,
} from "../../types";
import { playerChannelClassLabel, playerCommonStatusLabel, playerTrustClassLabel } from "../agentPlayerLabels";

type RiskStrategy = "谨慎" | "均衡" | "冒险";
type HighRiskPackageKind = "turn_card" | "resolve_turn";
type HighRiskPackageStatus = "pending" | "authorized" | "rejected";

interface HighRiskPackage {
  readonly kind: HighRiskPackageKind;
  readonly label: string;
  readonly requestCount: number;
  readonly status: HighRiskPackageStatus;
  readonly strategy: RiskStrategy;
}

interface ServerHostedOption {
  readonly value: EpochServerHostedJob["optionKey"];
  readonly label: string;
}

interface TurnHostedActionPanelProps {
  readonly activeIdentityDisabled: boolean;
  readonly agentServerBase: string;
  readonly attestationChallenge: EpochAttestationChallenge | null;
  readonly attestedRunnerId: string;
  readonly attestedSignature: string;
  readonly attestedTranscriptHash: string;
  readonly authorizeHighRiskPackage: (kind: HighRiskPackageKind) => void;
  readonly autonomyEvaluation: string;
  readonly changeRiskStrategy: () => void;
  readonly confirmationToken: string;
  readonly contentPolicyRegion: string;
  readonly copyWebBridgePrompt: () => void;
  readonly createTurnCard: () => void;
  readonly createTurnCardWithConfirmation: () => void;
  readonly currentAgentId?: string;
  readonly currentTurnCard: EpochTurnCard | null;
  readonly explorer: ExplorerIdentity | null;
  readonly formatDate: (value?: string) => string;
  readonly hasHighRiskAuthorization: boolean;
  readonly highRiskPackages: readonly HighRiskPackage[];
  readonly highRiskRequestLimit: number;
  readonly highStimulusComplianceConfirmed: boolean;
  readonly highValueConfirmation: EpochHighValueConfirmation | null;
  readonly hostedMandate: string;
  readonly hostedOptionSummary: (option: EpochHostedActionOption) => string;
  readonly hostedRiskLabels: Record<EpochHostedActionOption["risk"], string>;
  readonly hostedVisibleText: string;
  readonly interventionBudget: number;
  readonly interventionInstruction: string;
  readonly interventionModeLabel: string;
  readonly interventionRemaining: number;
  readonly isBusy: boolean;
  readonly lastServerHostedRun: EpochServerHostedActionRun | null;
  readonly lastWebBridgeAction: EpochWebBridgeActionResult | null;
  readonly loadHighValueConfirmations: () => void;
  readonly loadHostedSessions: () => void;
  readonly loadServerHostedJobs: () => void;
  readonly lowStimulusMode: boolean;
  readonly messageBody: string;
  readonly operatorKey: string;
  readonly pauseExploration: () => void;
  readonly postServerHostedRegionMessage: () => void;
  readonly postServerHostedWorldMessage: () => void;
  readonly primaryHostedSession: EpochHostedSession | null;
  readonly publishTurnResultPage: () => void;
  readonly publishWebBridgeResultPage: () => void;
  readonly queueServerHostedAction: () => void;
  readonly rejectHighRiskPackage: (kind: HighRiskPackageKind) => void;
  readonly requestAttestationChallenge: (option: EpochHostedActionOption) => void;
  readonly requestResolveTurnConfirmation: (option: EpochTurnActionOption) => void;
  readonly requestTurnCardConfirmation: () => void;
  readonly resolveTurnCard: (option: EpochTurnActionOption) => void;
  readonly resolveTurnCardWithConfirmation: (option: EpochTurnActionOption) => void;
  readonly resultPublishAuthorizationCopy: string;
  readonly riskStrategy: RiskStrategy;
  readonly runServerHostedAction: () => void;
  readonly runServerHostedJob: (jobId?: string) => void;
  readonly serverHostedJobs: readonly EpochServerHostedJob[];
  readonly serverHostedJobStatusLabel: (value?: string | null) => string;
  readonly serverHostedOptionKey: EpochServerHostedJob["optionKey"];
  readonly serverHostedOptionLabel: (value?: string | null) => string;
  readonly serverHostedOptionOptions: readonly ServerHostedOption[];
  readonly setAttestedRunnerId: (value: string) => void;
  readonly setAttestedSignature: (value: string) => void;
  readonly setAttestedTranscriptHash: (value: string) => void;
  readonly setHostedMandate: (value: string) => void;
  readonly setHostedVisibleText: (value: string) => void;
  readonly setInterventionInstruction: (value: string) => void;
  readonly setServerHostedOptionKey: (value: EpochServerHostedJob["optionKey"]) => void;
  readonly setTurnPrompt: (value: string) => void;
  readonly setTurnVisibleText: (value: string) => void;
  readonly startHostedSession: () => void;
  readonly startWebBridgeTurn: () => void;
  readonly submitAttestedAction: () => void;
  readonly submitHostedAction: (option: EpochHostedActionOption) => void;
  readonly submitWebBridgeAction: (option: EpochWebBridgeActionOption) => void;
  readonly takeOverCurrentTurn: () => void;
  readonly turnPrompt: string;
  readonly turnVisibleText: string;
  readonly updateLowStimulusMode: (enabled: boolean) => void;
  readonly webBridgeTurn: EpochWebBridgeTurn | null;
  readonly appendInterventionInstruction: () => void;
}

function ActionExplanationDetails({
  explanation,
  alternativeOptions,
  autoOpen,
}: {
  readonly explanation: EpochActionExplanation;
  readonly alternativeOptions: readonly string[];
  readonly autoOpen?: boolean;
}) {
  const optionsSummary = alternativeOptions.length ? alternativeOptions.join(" / ") : "当前行动";
  return (
    <details className="agent-action-explanation" aria-label="结构化行动解释" open={autoOpen || undefined}>
      <summary>行动解释</summary>
      <dl>
        <div><dt>触发线索</dt><dd>{explanation.trigger}</dd></div>
        <div><dt>可选方案</dt><dd>{optionsSummary}</dd></div>
        <div><dt>选择原因</dt><dd>{explanation.choiceReason}</dd></div>
        <div><dt>放弃原因</dt><dd>{explanation.rejectedAlternatives.join(" / ")}</dd></div>
        <div><dt>风险</dt><dd>{explanation.risk}</dd></div>
        <div><dt>预计收益</dt><dd>{explanation.expectedBenefit}</dd></div>
      </dl>
    </details>
  );
}

export function TurnHostedActionPanel({
  activeIdentityDisabled,
  agentServerBase,
  attestationChallenge,
  attestedRunnerId,
  attestedSignature,
  attestedTranscriptHash,
  authorizeHighRiskPackage,
  autonomyEvaluation,
  changeRiskStrategy,
  confirmationToken,
  contentPolicyRegion,
  copyWebBridgePrompt,
  createTurnCard,
  createTurnCardWithConfirmation,
  currentAgentId,
  currentTurnCard,
  explorer,
  formatDate,
  hasHighRiskAuthorization,
  highRiskPackages,
  highRiskRequestLimit,
  highStimulusComplianceConfirmed,
  highValueConfirmation,
  hostedMandate,
  hostedOptionSummary,
  hostedRiskLabels,
  hostedVisibleText,
  interventionBudget,
  interventionInstruction,
  interventionModeLabel,
  interventionRemaining,
  isBusy,
  lastServerHostedRun,
  lastWebBridgeAction,
  loadHighValueConfirmations,
  loadHostedSessions,
  loadServerHostedJobs,
  lowStimulusMode,
  messageBody,
  operatorKey,
  pauseExploration,
  postServerHostedRegionMessage,
  postServerHostedWorldMessage,
  primaryHostedSession,
  publishTurnResultPage,
  publishWebBridgeResultPage,
  queueServerHostedAction,
  rejectHighRiskPackage,
  requestAttestationChallenge,
  requestResolveTurnConfirmation,
  requestTurnCardConfirmation,
  resolveTurnCard,
  resolveTurnCardWithConfirmation,
  resultPublishAuthorizationCopy,
  riskStrategy,
  runServerHostedAction,
  runServerHostedJob,
  serverHostedJobs,
  serverHostedJobStatusLabel,
  serverHostedOptionKey,
  serverHostedOptionLabel,
  serverHostedOptionOptions,
  setAttestedRunnerId,
  setAttestedSignature,
  setAttestedTranscriptHash,
  setHostedMandate,
  setHostedVisibleText,
  setInterventionInstruction,
  setServerHostedOptionKey,
  setTurnPrompt,
  setTurnVisibleText,
  startHostedSession,
  startWebBridgeTurn,
  submitAttestedAction,
  submitHostedAction,
  submitWebBridgeAction,
  takeOverCurrentTurn,
  turnPrompt,
  turnVisibleText,
  updateLowStimulusMode,
  webBridgeTurn,
  appendInterventionInstruction,
}: TurnHostedActionPanelProps) {
  return (
    <article className="agent-panel agent-hosted">
      <div className="agent-panel-head">
        <span>Hosted runner</span>
        <b>{primaryHostedSession ? primaryHostedSession.status : "empty"}</b>
      </div>
      <input value={hostedMandate} onChange={(event) => setHostedMandate(event.target.value)} />
      <input value={hostedVisibleText} onChange={(event) => setHostedVisibleText(event.target.value)} />
      <div className="agent-action-row">
        <button type="button" disabled={isBusy || activeIdentityDisabled || !explorer} onClick={startHostedSession}>开局</button>
        <button type="button" disabled={isBusy || activeIdentityDisabled || !explorer} onClick={startWebBridgeTurn}>网页桥接</button>
        <button type="button" disabled={isBusy || !currentAgentId} onClick={loadHostedSessions}>刷新</button>
      </div>
      {hasHighRiskAuthorization ? (
        <label className="agent-high-stimulus-preflight">
          <input
            type="checkbox"
            aria-label="高刺激委托前低刺激模式"
            checked={lowStimulusMode}
            onChange={(event) => updateLowStimulusMode(event.currentTarget.checked)}
          />
          <span>
            <b>高刺激委托前低刺激模式</b>
            <small>选择会持久保存到本地档案，并应用到高危授权、托管行动和回合结算。</small>
            <small>年龄/地区合规：{highStimulusComplianceConfirmed ? "已确认" : "未确认"} · {contentPolicyRegion}</small>
          </span>
        </label>
      ) : null}
      <div className="agent-intervention-bar" aria-label="常驻介入入口">
        {hasHighRiskAuthorization ? (
          <div className="agent-intervention-auth-panel" aria-label="高危授权面板">
            <span>
              <b>高危授权</b>
              <small>高危行动已展开完整解释；使用选项里的确认或挑战入口后再执行。</small>
            </span>
            <button type="button" disabled={isBusy || !explorer} onClick={loadHighValueConfirmations}>
              刷新授权请求
            </button>
          </div>
        ) : (
          <>
            <button type="button" disabled={isBusy} onClick={pauseExploration}>暂停</button>
            <input
              aria-label="追加指令文本"
              value={interventionInstruction}
              onChange={(event) => setInterventionInstruction(event.target.value)}
            />
            <button type="button" disabled={isBusy || !interventionInstruction.trim()} onClick={appendInterventionInstruction}>追加指令</button>
            <button type="button" disabled={isBusy || interventionRemaining <= 0} onClick={takeOverCurrentTurn}>接管本轮</button>
          </>
        )}
        <small className="agent-intervention-budget">
          介入状态：{interventionModeLabel} · 委托干预次数 {interventionRemaining}/{interventionBudget} · {autonomyEvaluation}
        </small>
      </div>
      <div className="agent-risk-package-panel" aria-label="高危风险包">
        <span>
          <b>风险包</b>
          <small>高危请求 {highRiskPackages.length}/{highRiskRequestLimit} · 当前策略 {riskStrategy}</small>
        </span>
        {highRiskPackages.map((item) => (
          <span key={item.kind}>
            <b>{item.label}</b>
            <small>{item.kind} · {item.status} · 合并 {item.requestCount} 次 · 策略 {item.strategy}</small>
            <button type="button" disabled={isBusy || item.status === "authorized"} onClick={() => authorizeHighRiskPackage(item.kind)}>授权</button>
            <button type="button" disabled={isBusy || item.status === "rejected"} onClick={() => rejectHighRiskPackage(item.kind)}>拒绝</button>
          </span>
        ))}
        <button type="button" disabled={isBusy} onClick={changeRiskStrategy}>改风险策略</button>
      </div>
      <div className="agent-attestation-box agent-server-hosted-box">
        <div className="agent-panel-head">
          <span>服务器权威行动</span>
          <b>{lastServerHostedRun ? "服务器已结算" : "待执行"}</b>
        </div>
        <div className="agent-action-row">
          <select
            value={serverHostedOptionKey}
            onChange={(event) => setServerHostedOptionKey(event.target.value as EpochServerHostedJob["optionKey"])}
          >
            {serverHostedOptionOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <button type="button" disabled={isBusy || activeIdentityDisabled || !operatorKey.trim()} onClick={runServerHostedAction}>服务器代跑</button>
          <button type="button" disabled={isBusy || activeIdentityDisabled || !operatorKey.trim()} onClick={queueServerHostedAction}>排队</button>
          <button type="button" disabled={isBusy || !operatorKey.trim()} onClick={loadServerHostedJobs}>刷新队列</button>
          <button type="button" disabled={isBusy || !operatorKey.trim() || !serverHostedJobs.some((job) => job.status === "queued")} onClick={() => runServerHostedJob()}>执行下一条</button>
          <button type="button" disabled={isBusy || activeIdentityDisabled || !operatorKey.trim() || !messageBody.trim()} onClick={postServerHostedRegionMessage}>托管区域发言</button>
          <button type="button" disabled={isBusy || activeIdentityDisabled || !operatorKey.trim() || !messageBody.trim()} onClick={postServerHostedWorldMessage}>托管世界发言</button>
        </div>
        {lastServerHostedRun ? (
          <dl>
            <div><dt>行动</dt><dd>{lastServerHostedRun.action.optionLabel}</dd></div>
            <div><dt>结果</dt><dd>{lastServerHostedRun.action.outcomeSummary}</dd></div>
            <div><dt>结算</dt><dd>{formatDate(lastServerHostedRun.action.recordedAt)}</dd></div>
          </dl>
        ) : null}
        <div className="agent-mini-list">
          <b>服务器作业队列</b>
          {serverHostedJobs.slice(0, 4).map((job) => (
            <span key={job.jobId}>
              <b>{serverHostedJobStatusLabel(job.status)} · {serverHostedOptionLabel(job.optionKey)}</b>
              <em>{job.mandate}</em>
              <small>
                {formatDate(job.queuedAt)}
                {job.completedAt ? ` · 完成 ${formatDate(job.completedAt)}` : ""}
                {job.skippedAt ? ` · 跳过 ${formatDate(job.skippedAt)}` : ""}
                {job.skipReason ? ` · ${job.skipReason}` : ""}
                {job.actionId ? ` · ${job.actionId}` : ""}
              </small>
              {job.status === "queued" ? (
                <div className="agent-option-actions">
                  <button type="button" disabled={isBusy || !operatorKey.trim()} onClick={() => runServerHostedJob(job.jobId)}>执行</button>
                </div>
              ) : null}
            </span>
          ))}
          {!serverHostedJobs.length ? <span>暂无服务器权威作业</span> : null}
        </div>
      </div>
      <div className="agent-turn-card">
        <div className="agent-panel-head">
          <span>服务器回合卡</span>
          <b>{playerCommonStatusLabel(currentTurnCard?.status || "none")}</b>
        </div>
        <input value={turnPrompt} onChange={(event) => setTurnPrompt(event.target.value)} />
        <input value={turnVisibleText} onChange={(event) => setTurnVisibleText(event.target.value)} />
        <div className="agent-action-row">
          <button type="button" disabled={isBusy || activeIdentityDisabled || !explorer} onClick={createTurnCard}>生成</button>
          <button type="button" disabled={isBusy || activeIdentityDisabled || !turnPrompt.trim()} onClick={requestTurnCardConfirmation}>请求回合卡确认</button>
          <button
            type="button"
            disabled={isBusy || activeIdentityDisabled || !confirmationToken || highValueConfirmation?.action !== "turn_card"}
            onClick={createTurnCardWithConfirmation}
          >
            使用确认凭证生成
          </button>
        </div>
        {currentTurnCard ? (
          <>
            <dl>
              <div><dt>身份</dt><dd>{currentTurnCard.visibleContext.identityName}</dd></div>
              <div><dt>区域</dt><dd>{currentTurnCard.visibleContext.regionId}</dd></div>
              <div><dt>创建</dt><dd>{formatDate(currentTurnCard.createdAt)}</dd></div>
              {currentTurnCard.expiresAt ? <div><dt>过期</dt><dd>{formatDate(currentTurnCard.expiresAt)}</dd></div> : null}
            </dl>
            <details className="agent-inline-proof">
              <summary>校验证明</summary>
              <dl>
                <div><dt>序列</dt><dd>{currentTurnCard.sequence}</dd></div>
                <div><dt>随机标记</dt><dd>{currentTurnCard.nonce}</dd></div>
                {currentTurnCard.signedEnvelope ? (
                  <>
                    <div><dt>证明编号</dt><dd>{currentTurnCard.signedEnvelope.envelopeId}</dd></div>
                    <div><dt>内容哈希</dt><dd>{currentTurnCard.signedEnvelope.contentHash}</dd></div>
                    <div><dt>服务器签名</dt><dd>{currentTurnCard.signedEnvelope.signature.slice(0, 32)}...</dd></div>
                  </>
                ) : null}
              </dl>
            </details>
            <div className="agent-mini-list">
              {currentTurnCard.status === "open" ? currentTurnCard.actionOptions.map((option) => (
                <span key={option.actionOptionId}>
                  <b>{option.label}</b>
                  <em>{hostedRiskLabels[option.risk]}</em>
                  <small>{option.explanation.brief}</small>
                  <ActionExplanationDetails
                    explanation={option.explanation}
                    alternativeOptions={currentTurnCard.actionOptions.map((candidate) => candidate.label)}
                    autoOpen={option.risk === "high"}
                  />
                  <div className="agent-option-actions">
                    <button type="button" disabled={isBusy || activeIdentityDisabled || !explorer} onClick={() => resolveTurnCard(option)}>选择</button>
                    <button type="button" disabled={isBusy || activeIdentityDisabled} onClick={() => requestResolveTurnConfirmation(option)}>请求结算确认</button>
                    <button
                      type="button"
                      disabled={isBusy || activeIdentityDisabled || !confirmationToken || highValueConfirmation?.action !== "resolve_turn"}
                      onClick={() => resolveTurnCardWithConfirmation(option)}
                    >
                      使用确认凭证结算
                    </button>
                  </div>
                </span>
              )) : currentTurnCard.resolution ? (
                <span>
                  <b>{currentTurnCard.resolution.optionLabel}</b>
                  <em>{currentTurnCard.resolution.outcomeSummary}</em>
                  <small>{currentTurnCard.resolution.explanation.brief}</small>
                  <ActionExplanationDetails
                    explanation={currentTurnCard.resolution.explanation}
                    alternativeOptions={currentTurnCard.actionOptions.map((candidate) => candidate.label)}
                    autoOpen={currentTurnCard.actionOptions.some((candidate) => candidate.actionOptionId === currentTurnCard.resolution?.actionOptionId && candidate.risk === "high")}
                  />
                  <small>{playerChannelClassLabel(currentTurnCard.resolution.channelClass)}</small>
                  <details className="agent-inline-proof">
                    <summary>结算校验证明</summary>
                    <small>{currentTurnCard.resolution.envelopeId}</small>
                    {currentTurnCard.resolution.signedEnvelope ? (
                      <>
                        <small>{currentTurnCard.resolution.signedEnvelope.envelopeId}</small>
                        <small>{currentTurnCard.resolution.signedEnvelope.contentHash}</small>
                        <small>{currentTurnCard.resolution.signedEnvelope.signature.slice(0, 32)}...</small>
                      </>
                    ) : null}
                  </details>
                </span>
              ) : null}
            </div>
            {currentTurnCard.status === "resolved" ? (
              <div className="agent-action-row">
                <button type="button" disabled={isBusy || !explorer} onClick={publishTurnResultPage}>发布本回合</button>
                <small>{resultPublishAuthorizationCopy}</small>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
      {primaryHostedSession ? (
        <>
          <strong>{primaryHostedSession.mandate}</strong>
          <dl>
            <div><dt>区域</dt><dd>{primaryHostedSession.regionId}</dd></div>
            <div><dt>信道</dt><dd>{playerChannelClassLabel(primaryHostedSession.channelClass || "server_hosted")}</dd></div>
            <div><dt>开始</dt><dd>{formatDate(primaryHostedSession.startedAt)}</dd></div>
          </dl>
          <div className="agent-action-row">
            <a
              className="agent-public-link"
              href={`${agentServerBase}/epoch/hosted/${encodeURIComponent(primaryHostedSession.sessionId)}`}
              target="_blank"
              rel="noreferrer"
            >
              公开观战页
            </a>
          </div>
          <div className="agent-mini-list">
            {primaryHostedSession.status === "active" && primaryHostedSession.actionOptions.length ? primaryHostedSession.actionOptions.map((option) => (
              <span key={option.actionOptionId}>
                <b>{option.label}</b>
                <em>{hostedOptionSummary(option)}</em>
                <small>{option.explanation.brief} · {option.explanation.expectedBenefit}</small>
                <ActionExplanationDetails
                  explanation={option.explanation}
                  alternativeOptions={primaryHostedSession.actionOptions.map((candidate) => candidate.label)}
                  autoOpen={option.risk === "high"}
                />
                <div className="agent-option-actions">
                  <button type="button" disabled={isBusy || activeIdentityDisabled || !explorer} onClick={() => submitHostedAction(option)}>选择</button>
                  <button type="button" disabled={isBusy || activeIdentityDisabled || !attestedRunnerId.trim()} onClick={() => requestAttestationChallenge(option)}>挑战</button>
                </div>
              </span>
            )) : primaryHostedSession.status === "active" ? (
              <span>
                <b>公开刷新已隐藏未结算选项</b>
                <em>重新开局或使用刚收到的开局响应继续选择；公开观战页不会泄露 action option IDs。</em>
              </span>
            ) : primaryHostedSession.actions.map((action) => (
              <span key={action.actionId}>
                <b>{action.optionLabel}</b>
                <em>{action.attestationId ? `${action.outcomeSummary} / attested` : action.outcomeSummary}</em>
                <small>{action.explanation.brief}</small>
                <ActionExplanationDetails
                  explanation={action.explanation}
                  alternativeOptions={primaryHostedSession.actions.map((candidate) => candidate.optionLabel)}
                  autoOpen={action.risk === "high"}
                />
              </span>
            ))}
          </div>
          {webBridgeTurn ? (
            <div className="agent-attestation-box agent-bridge-box">
              <strong>{playerChannelClassLabel(webBridgeTurn.channelClass)} / {playerTrustClassLabel(webBridgeTurn.deliveryTrust)}</strong>
              <textarea className="agent-bridge-prompt" readOnly value={webBridgeTurn.copyPrompt} />
              <div className="agent-action-row">
                <button type="button" disabled={isBusy} onClick={copyWebBridgePrompt}>复制</button>
              </div>
              <div className="agent-mini-list">
                {webBridgeTurn.actionOptions.map((option) => (
                  <span key={option.actionOptionId}>
                    <b>{option.label}</b>
                    <em>{hostedRiskLabels[option.risk]}</em>
                    <div className="agent-option-actions">
                      <button type="button" disabled={isBusy || activeIdentityDisabled || !explorer} onClick={() => submitWebBridgeAction(option)}>提交</button>
                    </div>
                  </span>
                ))}
              </div>
            </div>
          ) : null}
          {lastWebBridgeAction ? (
            <div className="agent-attestation-box agent-bridge-box">
              <strong>桥接结算 · {playerTrustClassLabel(lastWebBridgeAction.deliveryTrust)}</strong>
              <dl>
                <div><dt>行动</dt><dd>{lastWebBridgeAction.action.optionLabel}</dd></div>
                <div><dt>结果</dt><dd>{lastWebBridgeAction.action.outcomeSummary}</dd></div>
                <div><dt>记录</dt><dd>{lastWebBridgeAction.action.actionId}</dd></div>
              </dl>
              <div className="agent-action-row">
                <button type="button" disabled={isBusy || !explorer} onClick={publishWebBridgeResultPage}>发布桥接结果</button>
                <small>{resultPublishAuthorizationCopy}</small>
              </div>
            </div>
          ) : null}
          <div className="agent-attestation-box">
            <input value={attestedRunnerId} onChange={(event) => setAttestedRunnerId(event.target.value)} placeholder="runner id" />
            <input value={attestedTranscriptHash} onChange={(event) => setAttestedTranscriptHash(event.target.value)} placeholder="sha256:transcript" />
            {attestationChallenge ? (
              <>
                <code>{attestationChallenge.signatureBase}</code>
                <input value={attestedSignature} onChange={(event) => setAttestedSignature(event.target.value)} placeholder="runner signature hex" />
                <button type="button" disabled={isBusy || activeIdentityDisabled || !attestedSignature.trim()} onClick={submitAttestedAction}>提交见证</button>
              </>
            ) : null}
          </div>
        </>
      ) : (
        <p>开局后会出现服务器签发的行动选项。</p>
      )}
    </article>
  );
}
