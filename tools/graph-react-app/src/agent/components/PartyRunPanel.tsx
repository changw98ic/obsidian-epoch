import type {
  EpochAuditEventSummary,
  EpochPartyRun,
  EpochResourceId,
} from "../../types";
import { playerAgentLabel, playerCommonStatusLabel, playerRecordLabel } from "../agentPlayerLabels";

interface PartyRunPanelProps {
  readonly activeIdentityDisabled: boolean;
  readonly agentServerBase: string;
  readonly createPartyRun: () => void;
  readonly currentAgentId?: string;
  readonly formatDate: (value?: string) => string;
  readonly hasOperatorKey: boolean;
  readonly isBusy: boolean;
  readonly joinPartyRun: (partyRun: EpochPartyRun) => void;
  readonly loadPartyInviteAudit: () => void;
  readonly loadPartyRuns: () => void;
  readonly participantRole: string;
  readonly partyInviteAuditEvents: readonly EpochAuditEventSummary[];
  readonly partyInviteRecipientAgentId: string;
  readonly partyInviteToken: string;
  readonly partyInviteTokenUseLimit: number;
  readonly partyJoinRequestNote: string;
  readonly partyObjective: string;
  readonly partyRuns: readonly EpochPartyRun[];
  readonly partyTitle: string;
  readonly pendingPartyJoinRequestCount: number;
  readonly primaryPartyRun?: EpochPartyRun | null;
  readonly requestPartyJoin: (partyRun: EpochPartyRun) => void;
  readonly resolvePartyJoinRequest: (
    partyRun: EpochPartyRun,
    requestId: string,
    resolution: "approved" | "rejected",
  ) => void;
  readonly resourceLabels: Record<EpochResourceId, string>;
  readonly revokePartyInvite: (partyRun: EpochPartyRun) => void;
  readonly rotatePartyInvite: (partyRun: EpochPartyRun) => void;
  readonly setParticipantRole: (role: string) => void;
  readonly setPartyInviteRecipientAgentId: (agentId: string) => void;
  readonly setPartyInviteToken: (token: string) => void;
  readonly setPartyInviteTokenUseLimit: (useLimit: number) => void;
  readonly setPartyJoinRequestNote: (note: string) => void;
  readonly setPartyObjective: (objective: string) => void;
  readonly setPartyTitle: (title: string) => void;
  readonly settlePartyRun: (partyRun: EpochPartyRun) => void;
}

export function PartyRunPanel({
  activeIdentityDisabled,
  agentServerBase,
  createPartyRun,
  currentAgentId,
  formatDate,
  hasOperatorKey,
  isBusy,
  joinPartyRun,
  loadPartyInviteAudit,
  loadPartyRuns,
  participantRole,
  partyInviteAuditEvents,
  partyInviteRecipientAgentId,
  partyInviteToken,
  partyInviteTokenUseLimit,
  partyJoinRequestNote,
  partyObjective,
  partyRuns,
  partyTitle,
  pendingPartyJoinRequestCount,
  primaryPartyRun,
  requestPartyJoin,
  resolvePartyJoinRequest,
  resourceLabels,
  revokePartyInvite,
  rotatePartyInvite,
  setParticipantRole,
  setPartyInviteRecipientAgentId,
  setPartyInviteToken,
  setPartyInviteTokenUseLimit,
  setPartyJoinRequestNote,
  setPartyObjective,
  setPartyTitle,
  settlePartyRun,
}: PartyRunPanelProps) {
  return (
    <article className="agent-panel agent-party-runs">
      <div className="agent-panel-head">
        <span>区域小队</span>
        <b>
          {primaryPartyRun ? `${primaryPartyRun.members.length} 成员` : "empty"}
          {pendingPartyJoinRequestCount ? ` · 待审批申请 ${pendingPartyJoinRequestCount}` : ""}
        </b>
      </div>
      <div className="agent-action-row">
        <button type="button" disabled={isBusy} onClick={loadPartyRuns}>刷新小队</button>
        <button type="button" disabled={isBusy} onClick={loadPartyInviteAudit}>邀请审计</button>
        <button type="button" disabled={isBusy || activeIdentityDisabled} onClick={createPartyRun}>创建小队</button>
      </div>
      <div className="agent-market-form">
        <input value={partyTitle} onChange={(event) => setPartyTitle(event.target.value)} placeholder="小队标题" />
        <select value={participantRole} onChange={(event) => setParticipantRole(event.target.value)}>
          <option value="vanguard">前锋</option>
          <option value="scout">斥候</option>
          <option value="support">支援</option>
          <option value="scribe">书记</option>
        </select>
      </div>
      <input value={partyObjective} onChange={(event) => setPartyObjective(event.target.value)} placeholder="小队目标" />
      <input value={partyJoinRequestNote} onChange={(event) => setPartyJoinRequestNote(event.target.value)} placeholder="入队申请备注" />
      <div className="agent-market-form">
        <input value={partyInviteToken} onChange={(event) => setPartyInviteToken(event.target.value)} placeholder="邀请口令" />
        <input value={partyInviteRecipientAgentId} onChange={(event) => setPartyInviteRecipientAgentId(event.target.value)} placeholder="绑定接收 agent id" />
        <input
          type="number"
          min={1}
          value={partyInviteTokenUseLimit}
          onChange={(event) => setPartyInviteTokenUseLimit(Math.max(1, Number(event.target.value) || 1))}
          placeholder="次数"
        />
      </div>
      <div className="agent-mini-list">
        {partyRuns.slice(0, 4).map((partyRun) => {
          const alreadyJoined = partyRun.members.some((member) => member.agentId === currentAgentId);
          const pendingJoinRequests = (partyRun.joinRequests || []).filter((request) => request.status === "pending");
          const hasPendingJoinRequest = pendingJoinRequests.some((request) => request.agentId === currentAgentId);
          const canResolveJoinRequests = partyRun.status === "open" && partyRun.leaderAgentId === currentAgentId;
          const canUpdatePartyInvite = canResolveJoinRequests;
          const settlementSummary = partyRun.memberResults?.map((member) =>
            `${member.participantRole}:${member.score}/${resourceLabels[member.reward.resourceId]}+${member.reward.amount}`)
            .join(" ");
          return (
            <span key={partyRun.partyRunId}>
              {partyRun.title} · {playerCommonStatusLabel(partyRun.status)} · 成员 {partyRun.members.length}
              <b>{partyRun.objective} {partyRun.totalScore !== undefined ? `· 总分 ${partyRun.totalScore}` : ""}</b>
              {settlementSummary ? <small>{settlementSummary}</small> : null}
              <a
                href={`${agentServerBase}${partyRun.publicPages?.partyRun || `/epoch/party-run/${encodeURIComponent(partyRun.partyRunId)}`}`}
                target="_blank"
                rel="noreferrer"
              >
                公开小队战报
              </a>
              {!alreadyJoined ? (
                <button type="button" disabled={isBusy || activeIdentityDisabled} onClick={() => joinPartyRun(partyRun)}>加入</button>
              ) : null}
              {!alreadyJoined && partyRun.status === "open" ? (
                <button
                  type="button"
                  disabled={isBusy || activeIdentityDisabled || hasPendingJoinRequest}
                  onClick={() => requestPartyJoin(partyRun)}
                >
                  {hasPendingJoinRequest ? "已申请" : "申请加入"}
                </button>
              ) : null}
              {pendingJoinRequests.length ? (
                <small>
                  待处理 {pendingJoinRequests.length} · 待审批 {pendingJoinRequests.map((request) =>
                    `${request.participantRole}:${playerAgentLabel(request.agentId)}`).join(" / ")}
                </small>
              ) : null}
              {canResolveJoinRequests ? pendingJoinRequests.map((request) => (
                <span className="agent-action-row" key={request.requestId}>
                  <span>{request.requestNote || playerAgentLabel(request.agentId)}</span>
                  <button type="button" disabled={isBusy || activeIdentityDisabled} onClick={() => resolvePartyJoinRequest(partyRun, request.requestId, "approved")}>批准</button>
                  <button type="button" disabled={isBusy || activeIdentityDisabled} onClick={() => resolvePartyJoinRequest(partyRun, request.requestId, "rejected")}>拒绝</button>
                </span>
              )) : null}
              {canUpdatePartyInvite ? (
                <span className="agent-action-row">
                  <small>
                    邀请 {partyRun.joinPolicy === "invite_only" ? "邀请制" : "开放加入"}
                    {partyRun.inviteTokenUseLimit !== undefined ? ` · ${partyRun.inviteTokenUses || 0}/${partyRun.inviteTokenUseLimit}` : ""}
                    {partyRun.inviteRecipientAgentId ? ` · ${playerAgentLabel(partyRun.inviteRecipientAgentId)}` : ""}
                  </small>
                  <button type="button" disabled={isBusy || activeIdentityDisabled} onClick={() => rotatePartyInvite(partyRun)}>轮换邀请</button>
                  <button type="button" disabled={isBusy || activeIdentityDisabled} onClick={() => revokePartyInvite(partyRun)}>撤销邀请</button>
                </span>
              ) : null}
              {partyRun.status === "open" ? (
                <button type="button" disabled={isBusy || !hasOperatorKey} onClick={() => settlePartyRun(partyRun)}>结算小队</button>
              ) : null}
            </span>
          );
        })}
      </div>
      {partyInviteAuditEvents.length ? (
        <div className="agent-mini-list">
          {partyInviteAuditEvents.slice(0, 5).map((event) => {
            const partyRunId = typeof event.payload.partyRunId === "string" ? event.payload.partyRunId : event.aggregateId;
            const updateKind = event.payload.updateKind === "revoked" ? "撤销" : "轮换";
            const recipient = typeof event.payload.inviteRecipientAgentId === "string" ? event.payload.inviteRecipientAgentId : "";
            const useLimit = typeof event.payload.inviteTokenUseLimit === "number" ? event.payload.inviteTokenUseLimit : undefined;
            return (
              <span key={event.eventId}>
                邀请审计 · {playerRecordLabel(partyRunId, "小队")} · {updateKind}
                <b>{formatDate(event.createdAt)}{recipient ? ` · 绑定 ${playerAgentLabel(recipient)}` : ""}{useLimit !== undefined ? ` · ${useLimit} 次` : ""}</b>
                <a href={`${agentServerBase}${event.publicPages.audit}`} target="_blank" rel="noreferrer">公开审计</a>
              </span>
            );
          })}
        </div>
      ) : null}
      {!partyRuns.length ? <p>小队只记录服务器确认的成员和角色，故事结果由后续裁判链结算。</p> : null}
    </article>
  );
}
