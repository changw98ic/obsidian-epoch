import type {
  EpochInventoryItem,
  EpochMarketOrder,
  EpochMarketRiskRestriction,
  EpochMarketTradeRiskFlag,
  EpochResourceId,
} from "../../types";
import { playerRegionLabel } from "../agentPlayerLabels";

const MARKET_TRADE_RISK_LABELS: Record<EpochMarketTradeRiskFlag, string> = {
  repeat_counterparty_trade: "重复对手方交易",
  suspicious_low_price: "异常低价",
  suspicious_high_price: "异常高价",
};

const MARKET_RESTRICTION_LABELS: Record<EpochMarketRiskRestriction["reason"], string> = {
  risk_review_escalated: "风险升级",
};

function marketSellLabel(order: EpochMarketOrder, resourceLabels: Record<EpochResourceId, string>) {
  if (order.sellKind === "item") {
    return `${order.sellItemDisplayName || order.sellItemId || "未知物品"} · 物品`;
  }
  const resourceId = order.sellResourceId || "coin";
  return `${resourceLabels[resourceId]} ${order.sellAmount}`;
}

interface MarketPanelProps {
  readonly activeIdentityDisabled: boolean;
  readonly currentAgentId?: string;
  readonly currentMarketRestriction?: EpochMarketRiskRestriction | null;
  readonly formatDate: (value?: string) => string;
  readonly isBusy: boolean;
  readonly marketOrders: readonly EpochMarketOrder[];
  readonly marketSellMode: "resource" | "item";
  readonly onCancelMarketOrder: (order: EpochMarketOrder) => void;
  readonly onCreateMarketOrder: () => void;
  readonly onFillMarketOrder: (order: EpochMarketOrder) => void;
  readonly onLoadMarket: () => void;
  readonly onReleaseMarketRiskRestriction: () => void;
  readonly onTickMarketExpiry: () => void;
  readonly operatorKey: string;
  readonly priceAmount: number;
  readonly priceResourceId: EpochResourceId;
  readonly primaryMarketOrder?: EpochMarketOrder | null;
  readonly resourceLabels: Record<EpochResourceId, string>;
  readonly sellAmount: number;
  readonly sellItemId: string;
  readonly sellResourceId: EpochResourceId;
  readonly setMarketSellMode: (mode: "resource" | "item") => void;
  readonly setPriceAmount: (amount: number) => void;
  readonly setPriceResourceId: (resourceId: EpochResourceId) => void;
  readonly setSellAmount: (amount: number) => void;
  readonly setSellItemId: (itemId: string) => void;
  readonly setSellResourceId: (resourceId: EpochResourceId) => void;
  readonly tradableInventoryItems: readonly EpochInventoryItem[];
}

export function MarketPanel({
  activeIdentityDisabled,
  currentAgentId,
  currentMarketRestriction,
  formatDate,
  isBusy,
  marketOrders,
  marketSellMode,
  onCancelMarketOrder,
  onCreateMarketOrder,
  onFillMarketOrder,
  onLoadMarket,
  onReleaseMarketRiskRestriction,
  onTickMarketExpiry,
  operatorKey,
  priceAmount,
  priceResourceId,
  primaryMarketOrder,
  resourceLabels,
  sellAmount,
  sellItemId,
  sellResourceId,
  setMarketSellMode,
  setPriceAmount,
  setPriceResourceId,
  setSellAmount,
  setSellItemId,
  setSellResourceId,
  tradableInventoryItems,
}: MarketPanelProps) {
  const resourceIds = Object.keys(resourceLabels) as EpochResourceId[];

  return (
    <article className="agent-panel agent-market">
      <div className="agent-panel-head">
        <span>交易市场</span>
        <b>{currentMarketRestriction ? "restricted" : primaryMarketOrder ? primaryMarketOrder.status : "empty"}</b>
      </div>
      <div className="agent-action-row">
        <button type="button" disabled={isBusy} onClick={onLoadMarket}>刷新市场</button>
        <button
          type="button"
          disabled={isBusy || activeIdentityDisabled || Boolean(currentMarketRestriction) || (marketSellMode === "item" && !sellItemId)}
          onClick={onCreateMarketOrder}
        >
          创建卖单
        </button>
        {operatorKey.trim() ? <button type="button" disabled={isBusy} onClick={onTickMarketExpiry}>过期扫描</button> : null}
      </div>
      {currentMarketRestriction ? (
        <div className="agent-restriction-banner">
          <p>市场限制 · {MARKET_RESTRICTION_LABELS[currentMarketRestriction.reason]} · score {currentMarketRestriction.reviewScore} · {formatDate(currentMarketRestriction.restrictedAt)}</p>
          <button type="button" disabled={isBusy || !operatorKey.trim()} onClick={onReleaseMarketRiskRestriction}>解除限制</button>
        </div>
      ) : null}
      <div className="agent-market-form">
        <select value={marketSellMode} onChange={(event) => setMarketSellMode(event.target.value as "resource" | "item")}>
          <option value="resource">卖资源</option>
          <option value="item">卖物品</option>
        </select>
        <select value={sellResourceId} onChange={(event) => setSellResourceId(event.target.value as EpochResourceId)}>
          {resourceIds.map((resourceId) => (
            <option key={resourceId} value={resourceId}>卖 {resourceLabels[resourceId]}</option>
          ))}
        </select>
        <input type="number" min="1" value={sellAmount} onChange={(event) => setSellAmount(Math.max(1, Number(event.target.value || 1)))} />
        <select value={sellItemId} onChange={(event) => setSellItemId(event.target.value)} disabled={marketSellMode !== "item"}>
          <option value="">选择未绑定物品</option>
          {tradableInventoryItems.map((item) => (
            <option key={item.itemId} value={item.itemId}>{item.displayName} · {item.rarity}</option>
          ))}
        </select>
        <select value={priceResourceId} onChange={(event) => setPriceResourceId(event.target.value as EpochResourceId)}>
          {resourceIds.map((resourceId) => (
            <option key={resourceId} value={resourceId}>收 {resourceLabels[resourceId]}</option>
          ))}
        </select>
        <input type="number" min="1" value={priceAmount} onChange={(event) => setPriceAmount(Math.max(1, Number(event.target.value || 1)))} />
      </div>
      <div className="agent-mini-list">
        {marketOrders.slice(0, 4).map((order) => (
          <span key={order.orderId}>
            {marketSellLabel(order, resourceLabels)} → {resourceLabels[order.priceResourceId]} {order.priceAmount}
            {" "}· {playerRegionLabel(order.regionId)}
            {typeof order.marketFeeAmount === "number" ? (
              <> · 市场税 {resourceLabels[order.marketFeeResourceId || order.priceResourceId]} {order.marketFeeAmount} · 净收 {order.sellerProceedsAmount ?? order.priceAmount}</>
            ) : null}
            {order.tradeRiskFlags?.length ? (
              <> · 交易风险 {order.tradeRiskFlags.map((flag) => MARKET_TRADE_RISK_LABELS[flag] || flag).join(" / ")}</>
            ) : null}
            {order.status === "open" && order.sellerAgentId !== currentAgentId ? (
              <button type="button" disabled={isBusy || activeIdentityDisabled || Boolean(currentMarketRestriction)} onClick={() => onFillMarketOrder(order)}>买入</button>
            ) : null}
            {order.status === "open" && order.sellerAgentId === currentAgentId ? (
              <button type="button" disabled={isBusy || activeIdentityDisabled} onClick={() => onCancelMarketOrder(order)}>撤单</button>
            ) : null}
          </span>
        ))}
      </div>
      {!marketOrders.length ? <p>卖单会锁定卖方资源，成交时服务器原子转移双方余额。</p> : null}
    </article>
  );
}
