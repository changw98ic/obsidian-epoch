import type {
  EpochBounty,
  EpochInventoryItem,
  EpochResourceId,
} from "../../types";

interface BountyPanelProps {
  readonly activeIdentityDisabled: boolean;
  readonly bounties: readonly EpochBounty[];
  readonly bountyEvidence: string;
  readonly bountyFulfillmentItemId: string;
  readonly bountyRequiredItemKey: string;
  readonly bountyRewardAmount: number;
  readonly bountyTitle: string;
  readonly claimBounty: (bounty: EpochBounty) => void;
  readonly createBounty: () => void;
  readonly currentAgentId?: string;
  readonly isBusy: boolean;
  readonly loadBounties: () => void;
  readonly primaryBounty?: EpochBounty | null;
  readonly resourceLabels: Record<EpochResourceId, string>;
  readonly setBountyEvidence: (evidence: string) => void;
  readonly setBountyFulfillmentItemId: (itemId: string) => void;
  readonly setBountyRequiredItemKey: (itemKey: string) => void;
  readonly setBountyRewardAmount: (amount: number) => void;
  readonly setBountyTitle: (title: string) => void;
  readonly tradableInventoryItems: readonly EpochInventoryItem[];
}

export function BountyPanel({
  activeIdentityDisabled,
  bounties,
  bountyEvidence,
  bountyFulfillmentItemId,
  bountyRequiredItemKey,
  bountyRewardAmount,
  bountyTitle,
  claimBounty,
  createBounty,
  currentAgentId,
  isBusy,
  loadBounties,
  primaryBounty,
  resourceLabels,
  setBountyEvidence,
  setBountyFulfillmentItemId,
  setBountyRequiredItemKey,
  setBountyRewardAmount,
  setBountyTitle,
  tradableInventoryItems,
}: BountyPanelProps) {
  return (
    <article className="agent-panel agent-bounties">
      <div className="agent-panel-head">
        <span>区域悬赏</span>
        <b>{primaryBounty ? primaryBounty.status : "empty"}</b>
      </div>
      <div className="agent-action-row">
        <button type="button" disabled={isBusy} onClick={loadBounties}>刷新悬赏</button>
        <button type="button" disabled={isBusy || activeIdentityDisabled} onClick={createBounty}>发布悬赏</button>
      </div>
      <div className="agent-market-form">
        <input value={bountyTitle} onChange={(event) => setBountyTitle(event.target.value)} placeholder="悬赏标题" />
        <input type="number" min="1" value={bountyRewardAmount} onChange={(event) => setBountyRewardAmount(Math.max(1, Number(event.target.value || 1)))} />
      </div>
      <div className="agent-market-form">
        <input value={bountyRequiredItemKey} onChange={(event) => setBountyRequiredItemKey(event.target.value)} placeholder="所需物品 key" />
        <select value={bountyFulfillmentItemId} onChange={(event) => setBountyFulfillmentItemId(event.target.value)}>
          <option value="">自动选择可交付物品</option>
          {tradableInventoryItems.map((item) => (
            <option key={item.itemId} value={item.itemId}>{item.displayName} · {item.itemKey}</option>
          ))}
        </select>
      </div>
      <input value={bountyEvidence} onChange={(event) => setBountyEvidence(event.target.value)} placeholder="领取证据" />
      <div className="agent-mini-list">
        {bounties.slice(0, 4).map((bounty) => (
          <span key={bounty.bountyId}>
            {bounty.title} · {resourceLabels[bounty.rewardResourceId]} {bounty.rewardAmount} · {bounty.status}
            {bounty.requiredItemKey ? <> · 需求 {bounty.requiredItemKey}</> : null}
            {bounty.transferredItemId ? <> · 已交付 {bounty.transferredItemId}</> : null}
            {bounty.status === "open" && bounty.sponsorAgentId !== currentAgentId ? (
              <button type="button" disabled={isBusy || activeIdentityDisabled} onClick={() => claimBounty(bounty)}>领取</button>
            ) : null}
          </span>
        ))}
      </div>
      {!bounties.length ? <p>悬赏会先锁定发布者赏金，领取时由服务器发放，不接受客户端自报奖励。</p> : null}
    </article>
  );
}
