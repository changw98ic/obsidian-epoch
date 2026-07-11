import type {
  EpochDirectTrade,
  EpochMarketOrder,
  EpochMarketRiskRestriction,
  EpochProjection,
} from "./gameCore.ts";
import type { EpochResourceId } from "./protocol.ts";

export interface EpochRegionMarketResourceSummary {
  readonly resourceId: EpochResourceId;
  readonly amount: number;
  readonly orders: number;
}

export interface EpochRegionMarketSummary {
  readonly regionId: string;
  readonly totalOrders: number;
  readonly openOrders: number;
  readonly filledOrders: number;
  readonly cancelledOrders: number;
  readonly expiredOrders: number;
  readonly filledVolume: Partial<Record<EpochResourceId, number>>;
  readonly collectedFees: Partial<Record<EpochResourceId, number>>;
  readonly filledResources: readonly EpochRegionMarketResourceSummary[];
  readonly latestActivityAt?: string;
}

export interface EpochMarketInfo {
  readonly orders: readonly EpochMarketOrder[];
  readonly riskRestrictions: readonly EpochMarketRiskRestriction[];
}

export interface EpochDirectTradeInfo {
  readonly regionId?: string;
  readonly agentId?: string;
  readonly status?: string;
  readonly trades: readonly EpochDirectTradeView[];
}

export type EpochDirectTradeView = Omit<EpochDirectTrade, "proposerExplorerId" | "counterpartyExplorerId"> & {
  readonly publicPages: {
    readonly trade: string;
    readonly audit: string;
    readonly region: string;
    readonly proposer: string;
    readonly counterparty: string;
  };
};

export function marketOrdersView(
  projection: EpochProjection,
  input: { agentId?: string; regionId?: string; status?: string } = {},
) {
  return Object.values(projection.marketOrders)
    .filter((order) => !input.agentId || order.sellerAgentId === input.agentId || order.buyerAgentId === input.agentId)
    .filter((order) => !input.regionId || order.regionId === input.regionId)
    .filter((order) => !input.status || order.status === input.status)
    .sort((left, right) => {
      const statusScore = Number(left.status !== "open") - Number(right.status !== "open");
      if (statusScore !== 0) return statusScore;
      return right.createdAt.localeCompare(left.createdAt);
    });
}

export function directTradesView(
  projection: EpochProjection,
  input: { agentId?: string; regionId?: string; status?: string } = {},
): readonly EpochDirectTradeView[] {
  return Object.values(projection.directTrades)
    .filter((trade) => !input.agentId || trade.proposerAgentId === input.agentId || trade.counterpartyAgentId === input.agentId)
    .filter((trade) => !input.regionId || trade.regionId === input.regionId)
    .filter((trade) => !input.status || trade.status === input.status)
    .sort((left, right) => {
      const statusScore = Number(left.status !== "open") - Number(right.status !== "open");
      if (statusScore !== 0) return statusScore;
      return right.createdAt.localeCompare(left.createdAt);
    })
    .map((trade) => {
      const { proposerExplorerId: _proposerExplorerId, counterpartyExplorerId: _counterpartyExplorerId, ...publicTrade } = trade;
      return {
        ...publicTrade,
        publicPages: {
          trade: `/epoch/direct-trade/${encodeURIComponent(trade.tradeId)}`,
          audit: `/epoch/audit?aggregateId=${encodeURIComponent(trade.tradeId)}`,
          region: `/epoch/region/${encodeURIComponent(trade.regionId)}`,
          proposer: `/epoch/agent/${encodeURIComponent(trade.proposerAgentId)}`,
          counterparty: `/epoch/agent/${encodeURIComponent(trade.counterpartyAgentId)}`,
        },
      };
    });
}

function marketOrderActivityAt(order: EpochMarketOrder): string {
  return order.filledAt || order.cancelledAt || order.expiredAt || order.createdAt;
}

function addResourceAmount(
  target: Partial<Record<EpochResourceId, number>>,
  resourceId: EpochResourceId | undefined,
  amount: number,
) {
  if (!resourceId) return;
  target[resourceId] = (target[resourceId] || 0) + amount;
}

export function regionMarketSummaryView(projection: EpochProjection, regionId: string): EpochRegionMarketSummary {
  const orders = Object.values(projection.marketOrders).filter((order) => order.regionId === regionId);
  const filledVolume: Partial<Record<EpochResourceId, number>> = {};
  const collectedFees: Partial<Record<EpochResourceId, number>> = {};
  const filledResourceEntries = new Map<EpochResourceId, { resourceId: EpochResourceId; amount: number; orders: number }>();
  let latestActivityAt: string | undefined;

  for (const order of orders) {
    const activityAt = marketOrderActivityAt(order);
    latestActivityAt = !latestActivityAt || latestActivityAt.localeCompare(activityAt) < 0 ? activityAt : latestActivityAt;
    if (order.status !== "filled") continue;
    addResourceAmount(filledVolume, order.priceResourceId, order.priceAmount);
    addResourceAmount(collectedFees, order.marketFeeResourceId || order.priceResourceId, order.marketFeeAmount || 0);
    if (order.sellResourceId) {
      const current = filledResourceEntries.get(order.sellResourceId) || {
        resourceId: order.sellResourceId,
        amount: 0,
        orders: 0,
      };
      current.amount += order.sellAmount;
      current.orders += 1;
      filledResourceEntries.set(order.sellResourceId, current);
    }
  }

  return {
    regionId,
    totalOrders: orders.length,
    openOrders: orders.filter((order) => order.status === "open").length,
    filledOrders: orders.filter((order) => order.status === "filled").length,
    cancelledOrders: orders.filter((order) => order.status === "cancelled").length,
    expiredOrders: orders.filter((order) => order.status === "expired").length,
    filledVolume,
    collectedFees,
    filledResources: [...filledResourceEntries.values()]
      .sort((left, right) => right.amount - left.amount || left.resourceId.localeCompare(right.resourceId)),
    latestActivityAt,
  };
}

export function marketRiskRestrictionsView(projection: EpochProjection, input: { agentId?: string } = {}) {
  return Object.values(projection.marketRiskRestrictions)
    .filter((restriction) => !input.agentId || restriction.agentId === input.agentId)
    .sort((left, right) => right.restrictedAt.localeCompare(left.restrictedAt) || left.agentId.localeCompare(right.agentId));
}
