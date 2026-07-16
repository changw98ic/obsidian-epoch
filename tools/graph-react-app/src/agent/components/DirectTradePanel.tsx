import type {
  EpochAuditEventSummary,
  EpochDirectTrade,
  EpochDirectTradeStatus,
  EpochInventoryItem,
  EpochMarketRiskRestriction,
  EpochMarketTradeRiskFlag,
  EpochResourceId,
} from "../../types";
import { playerEventTypeLabel, playerRegionLabel } from "../agentPlayerLabels";

type DirectTradeAssetSide = "offer" | "request";
type DirectTradeAssetMode = "resource" | "item";
type DirectTradeDirectionFilter = "all" | "incoming" | "outgoing";

const MARKET_TRADE_RISK_LABELS: Record<EpochMarketTradeRiskFlag, string> = {
  repeat_counterparty_trade: "重复对手方交易",
  suspicious_low_price: "异常低价",
  suspicious_high_price: "异常高价",
};

const DIRECT_TRADE_STATUS_LABELS: Record<EpochDirectTradeStatus, string> = {
  open: "待处理",
  accepted: "已成交",
  cancelled: "已撤回",
  expired: "已过期",
};

const DIRECT_TRADE_AUDIT_EVENT_TYPES = [
  "direct_trade_created",
  "direct_trade_accepted",
  "direct_trade_cancelled",
  "direct_trade_expired",
] as const;

const DIRECT_TRADE_AUDIT_LABELS: Record<(typeof DIRECT_TRADE_AUDIT_EVENT_TYPES)[number], string> = {
  direct_trade_created: "创建",
  direct_trade_accepted: "成交",
  direct_trade_cancelled: "撤回",
  direct_trade_expired: "过期",
};

interface DirectTradePanelProps {
  readonly acceptDirectTrade: (trade: EpochDirectTrade) => void;
  readonly actionableDirectTrades: readonly EpochDirectTrade[];
  readonly activeIdentityDisabled: boolean;
  readonly agentServerBase: string;
  readonly cancelDirectTrade: (trade: EpochDirectTrade) => void;
  readonly createDirectTrade: () => void;
  readonly currentAgentId?: string;
  readonly currentMarketRestriction?: EpochMarketRiskRestriction | null;
  readonly directTradeAssetLabel: (trade: EpochDirectTrade, side: DirectTradeAssetSide) => string;
  readonly directTradeAuditEvents: readonly EpochAuditEventSummary[];
  readonly directTradeAuditTradeId: string;
  readonly directTradeCounterpartyAgentId: string;
  readonly directTradeCounterpartyItemStatus: string;
  readonly directTradeDirectionFilter: DirectTradeDirectionFilter;
  readonly directTradeListSearch: string;
  readonly directTradeOfferAmount: number;
  readonly directTradeOfferItemId: string;
  readonly directTradeOfferItemSearch: string;
  readonly directTradeOfferMode: DirectTradeAssetMode;
  readonly directTradeOfferResourceId: EpochResourceId;
  readonly directTradeRequestAmount: number;
  readonly directTradeRequestItemId: string;
  readonly directTradeRequestItemSearch: string;
  readonly directTradeRequestMode: DirectTradeAssetMode;
  readonly directTradeRequestResourceId: EpochResourceId;
  readonly directTrades: readonly EpochDirectTrade[];
  readonly directTradeStatusFilter: EpochDirectTradeStatus;
  readonly filteredDirectTradeCounterpartyItems: readonly EpochInventoryItem[];
  readonly filteredDirectTradeOfferItems: readonly EpochInventoryItem[];
  readonly formatDate: (value?: string) => string;
  readonly hasOperatorKey: boolean;
  readonly incomingDirectTradeCount: number;
  readonly isBusy: boolean;
  readonly loadDirectTradeAudit: (trade: EpochDirectTrade) => void;
  readonly loadDirectTradeCounterpartyItems: () => void;
  readonly loadDirectTrades: () => void;
  readonly outgoingDirectTradeCount: number;
  readonly primaryDirectTrade?: EpochDirectTrade | null;
  readonly resourceLabels: Record<EpochResourceId, string>;
  readonly setDirectTradeCounterpartyAgentId: (agentId: string) => void;
  readonly setDirectTradeCounterpartyItemStatus: (status: string) => void;
  readonly setDirectTradeCounterpartyItems: (items: readonly EpochInventoryItem[]) => void;
  readonly setDirectTradeDirectionFilter: (filter: DirectTradeDirectionFilter) => void;
  readonly setDirectTradeListSearch: (search: string) => void;
  readonly setDirectTradeOfferAmount: (amount: number) => void;
  readonly setDirectTradeOfferItemId: (itemId: string) => void;
  readonly setDirectTradeOfferItemSearch: (search: string) => void;
  readonly setDirectTradeOfferMode: (mode: DirectTradeAssetMode) => void;
  readonly setDirectTradeOfferResourceId: (resourceId: EpochResourceId) => void;
  readonly setDirectTradeRequestAmount: (amount: number) => void;
  readonly setDirectTradeRequestItemId: (itemId: string) => void;
  readonly setDirectTradeRequestItemSearch: (search: string) => void;
  readonly setDirectTradeRequestMode: (mode: DirectTradeAssetMode) => void;
  readonly setDirectTradeRequestResourceId: (resourceId: EpochResourceId) => void;
  readonly setDirectTradeStatusFilter: (status: EpochDirectTradeStatus) => void;
  readonly tickDirectTradeExpiry: () => void;
  readonly visibleDirectTrades: readonly EpochDirectTrade[];
}

export function DirectTradePanel({
  acceptDirectTrade,
  actionableDirectTrades,
  activeIdentityDisabled,
  agentServerBase,
  cancelDirectTrade,
  createDirectTrade,
  currentAgentId,
  currentMarketRestriction,
  directTradeAssetLabel,
  directTradeAuditEvents,
  directTradeAuditTradeId,
  directTradeCounterpartyAgentId,
  directTradeCounterpartyItemStatus,
  directTradeDirectionFilter,
  directTradeListSearch,
  directTradeOfferAmount,
  directTradeOfferItemId,
  directTradeOfferItemSearch,
  directTradeOfferMode,
  directTradeOfferResourceId,
  directTradeRequestAmount,
  directTradeRequestItemId,
  directTradeRequestItemSearch,
  directTradeRequestMode,
  directTradeRequestResourceId,
  directTrades,
  directTradeStatusFilter,
  filteredDirectTradeCounterpartyItems,
  filteredDirectTradeOfferItems,
  formatDate,
  hasOperatorKey,
  incomingDirectTradeCount,
  isBusy,
  loadDirectTradeAudit,
  loadDirectTradeCounterpartyItems,
  loadDirectTrades,
  outgoingDirectTradeCount,
  primaryDirectTrade,
  resourceLabels,
  setDirectTradeCounterpartyAgentId,
  setDirectTradeCounterpartyItemStatus,
  setDirectTradeCounterpartyItems,
  setDirectTradeDirectionFilter,
  setDirectTradeListSearch,
  setDirectTradeOfferAmount,
  setDirectTradeOfferItemId,
  setDirectTradeOfferItemSearch,
  setDirectTradeOfferMode,
  setDirectTradeOfferResourceId,
  setDirectTradeRequestAmount,
  setDirectTradeRequestItemId,
  setDirectTradeRequestItemSearch,
  setDirectTradeRequestMode,
  setDirectTradeRequestResourceId,
  setDirectTradeStatusFilter,
  tickDirectTradeExpiry,
  visibleDirectTrades,
}: DirectTradePanelProps) {
  const resourceIds = Object.keys(resourceLabels) as EpochResourceId[];

  return (
    <article className="agent-panel agent-direct-trades">
      <div className="agent-panel-head">
        <span>私下交易</span>
        <b>{primaryDirectTrade ? DIRECT_TRADE_STATUS_LABELS[primaryDirectTrade.status] : "empty"}</b>
      </div>
      <div className="agent-action-row">
        <button type="button" disabled={isBusy} onClick={loadDirectTrades}>刷新私下交易</button>
        <button
          type="button"
          disabled={
            isBusy
            || activeIdentityDisabled
            || !directTradeCounterpartyAgentId.trim()
            || Boolean(currentMarketRestriction)
            || (directTradeOfferMode === "item" && !directTradeOfferItemId)
            || (directTradeRequestMode === "item" && !directTradeRequestItemId.trim())
          }
          onClick={createDirectTrade}
        >
          创建私下交易
        </button>
        {hasOperatorKey ? <button type="button" disabled={isBusy} onClick={tickDirectTradeExpiry}>过期扫描</button> : null}
      </div>
      <div className="agent-market-form">
        <input
          value={directTradeCounterpartyAgentId}
          onChange={(event) => {
            setDirectTradeCounterpartyAgentId(event.target.value);
            setDirectTradeCounterpartyItems([]);
            setDirectTradeRequestItemId("");
            setDirectTradeRequestItemSearch("");
            setDirectTradeCounterpartyItemStatus("");
          }}
          placeholder="对方 agentId"
        />
        <button type="button" disabled={isBusy || !directTradeCounterpartyAgentId.trim()} onClick={loadDirectTradeCounterpartyItems}>
          加载对方物品
        </button>
        <select value={directTradeStatusFilter} onChange={(event) => setDirectTradeStatusFilter(event.target.value as EpochDirectTradeStatus)}>
          <option value="open">待处理</option>
          <option value="accepted">已成交</option>
          <option value="cancelled">已撤回</option>
          <option value="expired">已过期</option>
        </select>
        <div className="agent-direct-trade-tabs" role="tablist" aria-label="私下交易视图">
          {[
            { value: "all", label: `全部 ${directTrades.length}` },
            { value: "incoming", label: `收到 ${incomingDirectTradeCount}` },
            { value: "outgoing", label: `发出 ${outgoingDirectTradeCount}` },
          ].map((option) => (
            <button
              key={option.value}
              type="button"
              role="tab"
              aria-selected={directTradeDirectionFilter === option.value}
              className={directTradeDirectionFilter === option.value ? "is-active" : ""}
              onClick={() => setDirectTradeDirectionFilter(option.value as DirectTradeDirectionFilter)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <input
          aria-label="搜索交易记录"
          value={directTradeListSearch}
          onChange={(event) => setDirectTradeListSearch(event.target.value)}
          placeholder="搜索交易记录"
        />
        <select value={directTradeOfferMode} onChange={(event) => setDirectTradeOfferMode(event.target.value as DirectTradeAssetMode)}>
          <option value="resource">我给资源</option>
          <option value="item">我给物品</option>
        </select>
        <select value={directTradeOfferResourceId} onChange={(event) => setDirectTradeOfferResourceId(event.target.value as EpochResourceId)} disabled={directTradeOfferMode !== "resource"}>
          {resourceIds.map((resourceId) => (
            <option key={resourceId} value={resourceId}>给 {resourceLabels[resourceId]}</option>
          ))}
        </select>
        <input type="number" min="1" value={directTradeOfferAmount} onChange={(event) => setDirectTradeOfferAmount(Math.max(1, Number(event.target.value || 1)))} disabled={directTradeOfferMode !== "resource"} />
        <input
          value={directTradeOfferItemSearch}
          onChange={(event) => setDirectTradeOfferItemSearch(event.target.value)}
          placeholder="搜索我方物品"
          disabled={directTradeOfferMode !== "item"}
        />
        <select value={directTradeOfferItemId} onChange={(event) => setDirectTradeOfferItemId(event.target.value)} disabled={directTradeOfferMode !== "item"}>
          <option value="">选择我方物品</option>
          {filteredDirectTradeOfferItems.map((item) => (
            <option key={item.itemId} value={item.itemId}>{item.displayName} · {item.rarity}</option>
          ))}
        </select>
        <select value={directTradeRequestMode} onChange={(event) => setDirectTradeRequestMode(event.target.value as DirectTradeAssetMode)}>
          <option value="resource">我收资源</option>
          <option value="item">我收物品</option>
        </select>
        <select value={directTradeRequestResourceId} onChange={(event) => setDirectTradeRequestResourceId(event.target.value as EpochResourceId)} disabled={directTradeRequestMode !== "resource"}>
          {resourceIds.map((resourceId) => (
            <option key={resourceId} value={resourceId}>收 {resourceLabels[resourceId]}</option>
          ))}
        </select>
        <input type="number" min="1" value={directTradeRequestAmount} onChange={(event) => setDirectTradeRequestAmount(Math.max(1, Number(event.target.value || 1)))} disabled={directTradeRequestMode !== "resource"} />
        <input
          value={directTradeRequestItemSearch}
          onChange={(event) => setDirectTradeRequestItemSearch(event.target.value)}
          placeholder="搜索对方物品"
          disabled={directTradeRequestMode !== "item"}
        />
        <select
          value={directTradeRequestItemId}
          onChange={(event) => setDirectTradeRequestItemId(event.target.value)}
          disabled={directTradeRequestMode !== "item"}
        >
          <option value="">选择对方可交易物品</option>
          {filteredDirectTradeCounterpartyItems.map((item) => (
            <option key={item.itemId} value={item.itemId}>{item.displayName} · {item.rarity} · {item.itemKey}</option>
          ))}
        </select>
      </div>
      <p className="agent-small-note">
        {directTradeCounterpartyItemStatus || "请求对方物品前先加载对方可交易物品；创建会锁定你提供的资源或物品。成交、撤回或过期都由服务器事件结算。"}
      </p>
      <div className="agent-mini-list">
        {visibleDirectTrades.slice(0, 5).map((trade) => (
          <span key={trade.tradeId}>
            {DIRECT_TRADE_STATUS_LABELS[trade.status]} · {trade.proposerAgentId === currentAgentId ? "我发出" : trade.counterpartyAgentId === currentAgentId ? "我收到" : "旁观"}
            {" "}· {directTradeAssetLabel(trade, "offer")} → {directTradeAssetLabel(trade, "request")}
            {" "}· {playerRegionLabel(trade.regionId)} · {formatDate(trade.createdAt)}
            {trade.tradeRiskFlags?.length ? (
              <> · 风险 {trade.tradeRiskFlags.map((flag) => MARKET_TRADE_RISK_LABELS[flag] || flag).join(" / ")}</>
            ) : null}
            <a
              href={`${agentServerBase}${trade.publicPages?.trade || `/epoch/direct-trade/${encodeURIComponent(trade.tradeId)}`}`}
              target="_blank"
              rel="noreferrer"
            >
              公开交易凭证
            </a>
            <button type="button" disabled={isBusy} onClick={() => loadDirectTradeAudit(trade)}>交易审计</button>
            {trade.status === "open" && trade.counterpartyAgentId === currentAgentId ? (
              <button type="button" disabled={isBusy || activeIdentityDisabled || Boolean(currentMarketRestriction)} onClick={() => acceptDirectTrade(trade)}>接受</button>
            ) : null}
            {trade.status === "open" && trade.proposerAgentId === currentAgentId ? (
              <button type="button" disabled={isBusy || activeIdentityDisabled} onClick={() => cancelDirectTrade(trade)}>撤回</button>
            ) : null}
          </span>
        ))}
      </div>
      {directTradeAuditTradeId ? (
        <div className="agent-mini-list">
          <span>
            交易审计 · {directTradeAuditTradeId}
            <b>{directTradeAuditEvents.length} 条服务器事件</b>
          </span>
          {directTradeAuditEvents.slice(0, 6).map((event) => {
            const eventType = event.eventType as (typeof DIRECT_TRADE_AUDIT_EVENT_TYPES)[number];
            const auditUrl = event.publicPages.audit || `/epoch/audit/${encodeURIComponent(event.eventId)}`;
            return (
              <span key={event.eventId}>
                {DIRECT_TRADE_AUDIT_LABELS[eventType] || playerEventTypeLabel(event.eventType)} · {formatDate(event.createdAt)}
                <b>{event.aggregateId}</b>
                <a href={`${agentServerBase}${auditUrl}`} target="_blank" rel="noreferrer">公开审计</a>
              </span>
            );
          })}
          {!directTradeAuditEvents.length ? <span>交易审计 · 暂无匹配事件</span> : null}
        </div>
      ) : null}
      {!directTrades.length ? <p>没有私下交易。收到的 open 交易可以接受，发出的 open 交易可以撤回。</p> : null}
      {directTrades.length && !visibleDirectTrades.length ? <p>当前视图没有私下交易。</p> : null}
      {actionableDirectTrades.length ? <p className="agent-small-note">待处理 {actionableDirectTrades.length} 条，服务器会保护托管资产。</p> : null}
    </article>
  );
}
