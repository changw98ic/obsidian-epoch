import type {
  EpochOrganization,
  EpochOrganizationBudgetResolution,
  EpochOrganizationMembershipStatus,
  EpochRegionInfo,
  EpochResourceId,
} from "../../types";
import { playerAgentLabel, playerEventTypeLabel } from "../agentPlayerLabels";

interface OrganizationMembershipRoleOption {
  readonly value: string;
  readonly label: string;
}

interface OrganizationUpgradeOption {
  readonly value: string;
  readonly label: string;
  readonly cost: string;
  readonly effect: string;
}

interface OrganizationPanelProps {
  readonly activeIdentityDisabled: boolean;
  readonly contributeOrganizationTreasury: (organization: EpochOrganization) => void;
  readonly createOrganization: () => void;
  readonly currentAgentId?: string;
  readonly explorer: boolean;
  readonly formatDate: (value?: string) => string;
  readonly isBusy: boolean;
  readonly isOrganizationBudgetGovernanceRole: (role?: string) => boolean;
  readonly operatorKey: string;
  readonly organizationBudgetAmount: number;
  readonly organizationBudgetDescription: string;
  readonly organizationBudgetResourceId: EpochResourceId;
  readonly organizationBudgetTitle: string;
  readonly organizationBudgetVoteLabel: (decision: EpochOrganizationBudgetResolution) => string;
  readonly organizationContributionAmount: number;
  readonly organizationContributionResourceId: EpochResourceId;
  readonly organizationCreateName: string;
  readonly organizationMembershipRole: string;
  readonly organizationMembershipRoleOptions: readonly OrganizationMembershipRoleOption[];
  readonly organizationSearch: string;
  readonly organizationTreasuryReasonLabel: (reason: string) => string;
  readonly organizationUpgradeKey: string;
  readonly organizationUpgradeOptions: readonly OrganizationUpgradeOption[];
  readonly proposeOrganizationBudget: (organization: EpochOrganization) => void;
  readonly purchaseOrganizationUpgrade: (organization: EpochOrganization) => void;
  readonly region: EpochRegionInfo | null;
  readonly resolveOrganizationBudget: (budgetId: string, resolution: EpochOrganizationBudgetResolution) => void;
  readonly resourceAmountSummary: (resources: Partial<Record<EpochResourceId, number>>) => string;
  readonly resourceLabels: Record<EpochResourceId, string>;
  readonly setOrganizationBudgetAmount: (amount: number) => void;
  readonly setOrganizationBudgetDescription: (description: string) => void;
  readonly setOrganizationBudgetResourceId: (resourceId: EpochResourceId) => void;
  readonly setOrganizationBudgetTitle: (title: string) => void;
  readonly setOrganizationContributionAmount: (amount: number) => void;
  readonly setOrganizationContributionResourceId: (resourceId: EpochResourceId) => void;
  readonly setOrganizationCreateName: (name: string) => void;
  readonly setOrganizationMembershipRole: (role: string) => void;
  readonly setOrganizationSearch: (search: string) => void;
  readonly setOrganizationUpgradeKey: (upgradeKey: string) => void;
  readonly updateOrganizationMembership: (organization: EpochOrganization, status: EpochOrganizationMembershipStatus) => void;
  readonly visibleOrganizations: readonly EpochOrganization[];
}

export function OrganizationPanel({
  activeIdentityDisabled,
  contributeOrganizationTreasury,
  createOrganization,
  currentAgentId,
  explorer,
  formatDate,
  isBusy,
  isOrganizationBudgetGovernanceRole,
  operatorKey,
  organizationBudgetAmount,
  organizationBudgetDescription,
  organizationBudgetResourceId,
  organizationBudgetTitle,
  organizationBudgetVoteLabel,
  organizationContributionAmount,
  organizationContributionResourceId,
  organizationCreateName,
  organizationMembershipRole,
  organizationMembershipRoleOptions,
  organizationSearch,
  organizationTreasuryReasonLabel,
  organizationUpgradeKey,
  organizationUpgradeOptions,
  proposeOrganizationBudget,
  purchaseOrganizationUpgrade,
  region,
  resolveOrganizationBudget,
  resourceAmountSummary,
  resourceLabels,
  setOrganizationBudgetAmount,
  setOrganizationBudgetDescription,
  setOrganizationBudgetResourceId,
  setOrganizationBudgetTitle,
  setOrganizationContributionAmount,
  setOrganizationContributionResourceId,
  setOrganizationCreateName,
  setOrganizationMembershipRole,
  setOrganizationSearch,
  setOrganizationUpgradeKey,
  updateOrganizationMembership,
  visibleOrganizations,
}: OrganizationPanelProps) {
  const resourceIds = Object.keys(resourceLabels) as EpochResourceId[];

  return (
    <>
      <span>
        组织目录
        <b>{visibleOrganizations.length}/{region?.organizations.length || 0}</b>
        <input
          aria-label="搜索组织"
          value={organizationSearch}
          onChange={(event) => setOrganizationSearch(event.target.value)}
          placeholder="搜索组织"
        />
      </span>
      <span>
        创建组织
        <b>运营创建</b>
        <small>需要运营密钥，创建后进入本区域组织列表。</small>
        <div className="agent-market-form" aria-label="创建组织">
          <input
            aria-label="组织名称"
            value={organizationCreateName}
            onChange={(event) => setOrganizationCreateName(event.target.value)}
            placeholder="组织名称"
          />
          <button
            type="button"
            disabled={isBusy || !operatorKey.trim() || !organizationCreateName.trim()}
            onClick={() => createOrganization()}
          >
            创建组织
          </button>
        </div>
      </span>
      {region ? visibleOrganizations.slice(0, 5).map((organization) => {
        const currentAgentOrganizationMembership = region.organizationMemberships.find((membership) => (
          membership.organizationId === organization.organizationId
          && membership.memberType === "agent"
          && membership.agentId === currentAgentId
          && membership.status === "active"
        ));
        const currentAgentInOrganization = Boolean(currentAgentOrganizationMembership);
        const currentAgentCanResolveOrganizationBudget = isOrganizationBudgetGovernanceRole(currentAgentOrganizationMembership?.role);
        const organizationUpgradePurchased = organization.upgradeKeys.includes(organizationUpgradeKey);
        return (
          <span key={organization.organizationId}>
            组织 · {organization.displayName}
            <b>NPC {organization.memberNpcIds.length} / Agent {organization.memberAgentIds.length}</b>
            <small className={`agent-organization-influence-label ${organization.influenceScore.factionReviewRequired ? "is-review" : "is-local"}`}>
              组织影响力 {organization.influenceScore.total}/{organization.influenceScore.threshold}
              {organization.influenceScore.factionReviewRequired ? " · 阵营候选审档" : " · 普通小团体"}
            </small>
            <small>
              成员 {organization.influenceScore.memberScore} / 资源 {organization.influenceScore.resourceScore} / 武装 {organization.influenceScore.armedScore} / 领地 {organization.influenceScore.territoryScore} / 外交 {organization.influenceScore.diplomacyScore} / 超凡 {organization.influenceScore.supernaturalScore}
            </small>
            <small>
              声望 {organization.standing} · 金库 {resourceAmountSummary(organization.treasury)} · 升级 {organization.upgradeKeys.join(" / ") || "无"} · {currentAgentInOrganization ? `当前身份已加入 · 角色 ${currentAgentOrganizationMembership?.role || "未记录"}` : "当前身份未加入"}
              {currentAgentCanResolveOrganizationBudget ? " · 可治理预算" : " · 预算治理需先锋/书记/办事员"}
            </small>
            <div className="agent-organization-ledger" aria-label="组织金库流水">
              <strong>组织金库流水</strong>
              {organization.treasuryLedger.slice(0, 2).map((entry) => (
                <span className="agent-organization-ledger-row" key={entry.ledgerId}>
                  <b>
                    {new Date(entry.recordedAt).toLocaleString()} · {resourceLabels[entry.resourceId]} {entry.amountDelta > 0 ? "+" : ""}{entry.amountDelta} · 余额 {entry.balanceAfter}
                  </b>
                  <small>来源 {organizationTreasuryReasonLabel(entry.reason)} · 依据 {playerEventTypeLabel(entry.sourceEventType)}</small>
                </span>
              ))}
              {organization.treasuryLedger.length === 0 ? <small>暂无金库流水</small> : null}
            </div>
            <div className="agent-organization-ledger" aria-label="组织预算提案">
              <strong>组织预算提案</strong>
              {organization.budgets.slice(0, 3).map((budget) => {
                const approvalThreshold = budget.approvalThreshold || 1;
                const rejectionThreshold = budget.rejectionThreshold || 1;
                const latestVotes = budget.votes.slice(-3).reverse();
                return (
                  <span className="agent-organization-ledger-row" key={budget.budgetId}>
                    <b>
                      {budget.title} · {resourceLabels[budget.resourceId]} {budget.amount} · {budget.status === "proposed" ? "待审批" : budget.status === "approved" ? "已批准" : "已拒绝"}
                    </b>
                    <small>
                      同意 {budget.approvalCount}/{approvalThreshold} · 拒绝 {budget.rejectionCount}/{rejectionThreshold}
                      {budget.amount >= 5 ? " · 高价值预算需 2 票同向" : ""}
                    </small>
                    <small>
                      {formatDate(budget.proposedAt)} · 提案 {playerAgentLabel(budget.proposedByAgentId)}
                      {budget.note ? ` · ${budget.note}` : ""}
                    </small>
                    {latestVotes.length ? (
                      <small>
                        最近投票 · {latestVotes.map((vote) => `${organizationBudgetVoteLabel(vote.decision)} ${playerAgentLabel(vote.voterAgentId)}(${vote.voterRole}) ${formatDate(vote.votedAt)}`).join(" / ")}
                      </small>
                    ) : (
                      <small>最近投票 · 暂无</small>
                    )}
                    {budget.status === "proposed" ? (
                      <>
                        <button
                          type="button"
                          disabled={isBusy || activeIdentityDisabled || !explorer || !currentAgentCanResolveOrganizationBudget || budget.proposedByAgentId === currentAgentId}
                          onClick={() => resolveOrganizationBudget(budget.budgetId, "approved")}
                        >
                          批准预算
                        </button>
                        <button
                          type="button"
                          disabled={isBusy || activeIdentityDisabled || !explorer || !currentAgentCanResolveOrganizationBudget || budget.proposedByAgentId === currentAgentId}
                          onClick={() => resolveOrganizationBudget(budget.budgetId, "rejected")}
                        >
                          拒绝预算
                        </button>
                      </>
                    ) : null}
                  </span>
                );
              })}
              {organization.budgets.length === 0 ? <small>暂无预算提案</small> : null}
              {organization.budgets.length > 0 ? (
                <details className="agent-organization-budget-history">
                  <summary>组织预算历史</summary>
                  {organization.budgets.map((budget) => {
                    const approvalThreshold = budget.approvalThreshold || 1;
                    const rejectionThreshold = budget.rejectionThreshold || 1;
                    return (
                      <span className="agent-organization-ledger-row" key={`history-${budget.budgetId}`}>
                        <b>
                          {budget.title} · {resourceLabels[budget.resourceId]} {budget.amount} · {budget.status === "proposed" ? "待审批" : budget.status === "approved" ? "已批准" : "已拒绝"}
                        </b>
                        <small>
                          同意 {budget.approvalCount}/{approvalThreshold} · 拒绝 {budget.rejectionCount}/{rejectionThreshold}
                          {budget.resolvedAt ? ` · 结算 ${formatDate(budget.resolvedAt)}` : " · 未结算"}
                        </small>
                        <small>
                          提案 {playerAgentLabel(budget.proposedByAgentId)} · {formatDate(budget.proposedAt)}
                          {budget.note ? ` · ${budget.note}` : ""}
                        </small>
                        <span className="agent-organization-budget-votes">
                          {budget.votes.map((vote) => (
                            <small key={vote.voteId}>
                              {organizationBudgetVoteLabel(vote.decision)} · {playerAgentLabel(vote.voterAgentId)} · {vote.voterRole} · {formatDate(vote.votedAt)}
                              {vote.note ? ` · ${vote.note}` : ""}
                            </small>
                          ))}
                          {budget.votes.length === 0 ? <small>暂无投票记录</small> : null}
                        </span>
                      </span>
                    );
                  })}
                </details>
              ) : null}
            </div>
            <select
              aria-label="组织身份角色"
              value={organizationMembershipRole}
              onChange={(event) => setOrganizationMembershipRole(event.target.value)}
            >
              {organizationMembershipRoleOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <button
              type="button"
              disabled={isBusy || activeIdentityDisabled || !explorer || currentAgentInOrganization}
              onClick={() => updateOrganizationMembership(organization, "active")}
            >
              加入组织
            </button>
            <button
              type="button"
              disabled={isBusy || activeIdentityDisabled || !explorer || !currentAgentInOrganization}
              onClick={() => updateOrganizationMembership(organization, "left")}
            >
              离开组织
            </button>
            <select
              aria-label="组织升级"
              value={organizationUpgradeKey}
              onChange={(event) => setOrganizationUpgradeKey(event.target.value)}
            >
              {organizationUpgradeOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label} · {option.cost} · {option.effect}</option>
              ))}
            </select>
            <button
              type="button"
              disabled={isBusy || activeIdentityDisabled || !explorer || !currentAgentInOrganization || organizationUpgradePurchased}
              onClick={() => purchaseOrganizationUpgrade(organization)}
            >
              {organizationUpgradePurchased ? "已购买升级" : "购买升级"}
            </button>
            <select
              aria-label="组织金库捐献资源"
              value={organizationContributionResourceId}
              onChange={(event) => setOrganizationContributionResourceId(event.target.value as EpochResourceId)}
            >
              {resourceIds.map((resourceId) => (
                <option key={resourceId} value={resourceId}>{resourceLabels[resourceId]}</option>
              ))}
            </select>
            <input
              aria-label="组织金库捐献数量"
              min={1}
              type="number"
              value={organizationContributionAmount}
              onChange={(event) => setOrganizationContributionAmount(Math.max(1, Number(event.target.value) || 1))}
            />
            <button
              type="button"
              disabled={isBusy || activeIdentityDisabled || !explorer || !currentAgentInOrganization}
              onClick={() => contributeOrganizationTreasury(organization)}
            >
              捐入金库
            </button>
            <input
              aria-label="组织预算标题"
              value={organizationBudgetTitle}
              onChange={(event) => setOrganizationBudgetTitle(event.target.value)}
            />
            <input
              aria-label="组织预算说明"
              value={organizationBudgetDescription}
              onChange={(event) => setOrganizationBudgetDescription(event.target.value)}
            />
            <select
              aria-label="组织预算资源"
              value={organizationBudgetResourceId}
              onChange={(event) => setOrganizationBudgetResourceId(event.target.value as EpochResourceId)}
            >
              {resourceIds.map((resourceId) => (
                <option key={resourceId} value={resourceId}>{resourceLabels[resourceId]}</option>
              ))}
            </select>
            <input
              aria-label="组织预算数量"
              min={1}
              type="number"
              value={organizationBudgetAmount}
              onChange={(event) => setOrganizationBudgetAmount(Math.max(1, Number(event.target.value) || 1))}
            />
            <button
              type="button"
              disabled={isBusy || activeIdentityDisabled || !explorer || !currentAgentInOrganization || !organizationBudgetTitle.trim()}
              onClick={() => proposeOrganizationBudget(organization)}
            >
              提交预算
            </button>
          </span>
        );
      }) : null}
      {region?.organizations.length && !visibleOrganizations.length ? <p>当前搜索没有组织。</p> : null}
      {region?.careers.slice(0, 4).map((career) => (
        <span key={career.careerId}>
          职业 · {career.summary}
          <b>{career.npcDisplayName}</b>
          <small>{career.status}</small>
        </span>
      ))}
      {region?.organizationPolitics.slice(0, 4).map((politics) => (
        <span key={politics.politicsId}>
          组织政治 · {politics.title}
          <b>{politics.kind} / {politics.standingDelta > 0 ? "+" : ""}{politics.standingDelta} / standing {politics.standingAfter}</b>
        </span>
      ))}
    </>
  );
}
