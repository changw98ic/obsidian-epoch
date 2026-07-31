/**
 * Economy / trade / bounty / party-run MCP tool handlers, extracted from
 * mcpTools.ts.
 *
 * `registerEconomyHandlers` adds all economy tool entries to the shared
 * handler Map.  Every handler is a thin delegate to the corresponding
 * `runtime.epochXxx(args)` method -- no helper closures are needed because
 * economy tools do not carry complex transport or persistence wrappers.
 */

type AnyRecord = Record<string, unknown>;

// ── Economy tool names ───────────────────────────────────────────────

export const ECONOMY_TOOL_NAMES: readonly string[] = [
  "obsidian_epoch.inventory",
  "obsidian_epoch.shop",
  "obsidian_epoch.create_item",
  "obsidian_epoch.craft_item",
  "obsidian_epoch.purchase_shop_offer",
  "obsidian_epoch.bind_item",
  "obsidian_epoch.market",
  "obsidian_epoch.direct_trades",
  "obsidian_epoch.create_market_order",
  "obsidian_epoch.fill_market_order",
  "obsidian_epoch.cancel_market_order",
  "obsidian_epoch.create_direct_trade",
  "obsidian_epoch.accept_direct_trade",
  "obsidian_epoch.cancel_direct_trade",
  "obsidian_epoch.tick_market_expiry",
  "obsidian_epoch.tick_direct_trade_expiry",
  "obsidian_epoch.bounties",
  "obsidian_epoch.create_bounty",
  "obsidian_epoch.claim_bounty",
  "obsidian_epoch.party_runs",
  "obsidian_epoch.create_party_run",
  "obsidian_epoch.update_party_invite",
  "obsidian_epoch.join_party_run",
  "obsidian_epoch.request_party_join",
  "obsidian_epoch.resolve_party_join_request",
  "obsidian_epoch.settle_party_run",
];

// ── Minimal runtime interface for the economy delegates ──────────────

interface EconomyRuntime {
  epochInventory(args: AnyRecord): unknown;
  epochShop(args: AnyRecord): unknown;
  epochCreateItem(args: AnyRecord): unknown;
  epochCraftItem(args: AnyRecord): unknown;
  epochPurchaseShopOffer(args: AnyRecord): unknown;
  epochBindItem(args: AnyRecord): unknown;
  epochMarket(args: AnyRecord): unknown;
  epochDirectTrades(args: AnyRecord): unknown;
  epochCreateMarketOrder(args: AnyRecord): unknown;
  epochFillMarketOrder(args: AnyRecord): unknown;
  epochCancelMarketOrder(args: AnyRecord): unknown;
  epochCreateDirectTrade(args: AnyRecord): unknown;
  epochAcceptDirectTrade(args: AnyRecord): unknown;
  epochCancelDirectTrade(args: AnyRecord): unknown;
  epochTickMarketExpiry(args: AnyRecord): unknown;
  epochTickDirectTradeExpiry(args: AnyRecord): unknown;
  epochBounties(args: AnyRecord): unknown;
  epochCreateBounty(args: AnyRecord): unknown;
  epochClaimBounty(args: AnyRecord): unknown;
  epochPartyRuns(args: AnyRecord): unknown;
  epochCreatePartyRun(args: AnyRecord): unknown;
  epochUpdatePartyInvite(args: AnyRecord): unknown;
  epochJoinPartyRun(args: AnyRecord): unknown;
  epochRequestPartyJoin(args: AnyRecord): unknown;
  epochResolvePartyJoinRequest(args: AnyRecord): unknown;
  epochSettlePartyRun(args: AnyRecord): unknown;
}

// ── Registration ─────────────────────────────────────────────────────

export function registerEconomyHandlers(
  handlers: Map<string, (args: AnyRecord) => unknown>,
  runtime: EconomyRuntime,
): void {
  // Inventory & items.
  handlers.set("obsidian_epoch.inventory", (args) => runtime.epochInventory(args));
  handlers.set("obsidian_epoch.shop", (args) => runtime.epochShop(args));
  handlers.set("obsidian_epoch.create_item", (args) => runtime.epochCreateItem(args));
  handlers.set("obsidian_epoch.craft_item", (args) => runtime.epochCraftItem(args));
  handlers.set("obsidian_epoch.purchase_shop_offer", (args) => runtime.epochPurchaseShopOffer(args));
  handlers.set("obsidian_epoch.bind_item", (args) => runtime.epochBindItem(args));

  // Market & direct trades.
  handlers.set("obsidian_epoch.market", (args) => runtime.epochMarket(args));
  handlers.set("obsidian_epoch.direct_trades", (args) => runtime.epochDirectTrades(args));
  handlers.set("obsidian_epoch.create_market_order", (args) => runtime.epochCreateMarketOrder(args));
  handlers.set("obsidian_epoch.fill_market_order", (args) => runtime.epochFillMarketOrder(args));
  handlers.set("obsidian_epoch.cancel_market_order", (args) => runtime.epochCancelMarketOrder(args));
  handlers.set("obsidian_epoch.create_direct_trade", (args) => runtime.epochCreateDirectTrade(args));
  handlers.set("obsidian_epoch.accept_direct_trade", (args) => runtime.epochAcceptDirectTrade(args));
  handlers.set("obsidian_epoch.cancel_direct_trade", (args) => runtime.epochCancelDirectTrade(args));
  handlers.set("obsidian_epoch.tick_market_expiry", (args) => runtime.epochTickMarketExpiry(args));
  handlers.set("obsidian_epoch.tick_direct_trade_expiry", (args) => runtime.epochTickDirectTradeExpiry(args));

  // Bounties.
  handlers.set("obsidian_epoch.bounties", (args) => runtime.epochBounties(args));
  handlers.set("obsidian_epoch.create_bounty", (args) => runtime.epochCreateBounty(args));
  handlers.set("obsidian_epoch.claim_bounty", (args) => runtime.epochClaimBounty(args));

  // Party runs.
  handlers.set("obsidian_epoch.party_runs", (args) => runtime.epochPartyRuns(args));
  handlers.set("obsidian_epoch.create_party_run", (args) => runtime.epochCreatePartyRun(args));
  handlers.set("obsidian_epoch.update_party_invite", (args) => runtime.epochUpdatePartyInvite(args));
  handlers.set("obsidian_epoch.join_party_run", (args) => runtime.epochJoinPartyRun(args));
  handlers.set("obsidian_epoch.request_party_join", (args) => runtime.epochRequestPartyJoin(args));
  handlers.set("obsidian_epoch.resolve_party_join_request", (args) => runtime.epochResolvePartyJoinRequest(args));
  handlers.set("obsidian_epoch.settle_party_run", (args) => runtime.epochSettlePartyRun(args));
}
