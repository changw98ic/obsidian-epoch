/**
 * World-events MCP tool handlers, extracted from mcpTools.ts.
 *
 * `registerWorldEventsHandlers` adds all world-events tool entries to the
 * shared handler Map.  Every handler is a thin delegate to the corresponding
 * `runtime.epochXxx(args)` method -- no helper closures are needed because
 * world-events tools do not carry complex transport or persistence wrappers.
 */

type AnyRecord = Record<string, unknown>;

// ── World-events tool names ────────────────────────────────────────────

export const WORLD_EVENTS_TOOL_NAMES: readonly string[] = [
  "obsidian_epoch.region_info",
  "obsidian_epoch.messages",
  "obsidian_epoch.post_message",
  "obsidian_epoch.request_confirmation",
  "obsidian_epoch.moderation_queue",
  "obsidian_epoch.resolve_moderation",
  "obsidian_epoch.record_risk_review",
  "obsidian_epoch.release_market_risk_restriction",
  "obsidian_epoch.release_abuse_restriction",
  "obsidian_epoch.generate_region_news",
  "obsidian_epoch.claim_news_legend",
  "obsidian_epoch.record_lore_contribution",
  "obsidian_epoch.objectives",
  "obsidian_epoch.seed_objective",
  "obsidian_epoch.contribute_objective",
  "obsidian_epoch.settle_objective",
  "obsidian_epoch.resource_nodes",
  "obsidian_epoch.spawn_resource_node",
  "obsidian_epoch.contest_resource_node",
  "obsidian_epoch.settle_resource_node",
  "obsidian_epoch.anomalies",
  "obsidian_epoch.spawn_anomaly",
  "obsidian_epoch.contest_anomaly",
  "obsidian_epoch.resolve_anomaly",
  "obsidian_epoch.lore_contributions",
  "obsidian_epoch.lore_targets",
  "obsidian_epoch.adjudicate_lore_target",
  "obsidian_epoch.set_downtime",
  "obsidian_epoch.claim_downtime",
  "obsidian_epoch.tick_downtime",
  "obsidian_epoch.seasons",
  "obsidian_epoch.season_archive",
  "obsidian_epoch.seed_season",
  "obsidian_epoch.contribute_season",
  "obsidian_epoch.settle_season",
  "obsidian_epoch.claim_region_control",
];

// ── Minimal runtime interface for the world-events delegates ───────────

interface WorldEventsRuntime {
  epochRegionInfo(args: AnyRecord): unknown;
  epochMessages(args: AnyRecord): unknown;
  epochPostMessage(args: AnyRecord): unknown;
  epochRequestConfirmation(args: AnyRecord): unknown;
  epochModerationQueue(args: AnyRecord): unknown;
  epochResolveModeration(args: AnyRecord): unknown;
  epochRecordRiskReview(args: AnyRecord): unknown;
  epochReleaseMarketRiskRestriction(args: AnyRecord): unknown;
  epochReleaseAbuseRestriction(args: AnyRecord): unknown;
  epochGenerateRegionNews(args: AnyRecord): unknown;
  epochClaimNewsLegend(args: AnyRecord): unknown;
  epochRecordLoreContribution(args: AnyRecord): unknown;
  epochObjectives(args: AnyRecord): unknown;
  epochSeedObjective(args: AnyRecord): unknown;
  epochContributeObjective(args: AnyRecord): unknown;
  epochSettleObjective(args: AnyRecord): unknown;
  epochResourceNodes(args: AnyRecord): unknown;
  epochSpawnResourceNode(args: AnyRecord): unknown;
  epochContestResourceNode(args: AnyRecord): unknown;
  epochSettleResourceNode(args: AnyRecord): unknown;
  epochAnomalies(args: AnyRecord): unknown;
  epochSpawnAnomaly(args: AnyRecord): unknown;
  epochContestAnomaly(args: AnyRecord): unknown;
  epochResolveAnomaly(args: AnyRecord): unknown;
  epochLoreContributions(args: AnyRecord): unknown;
  epochLoreTargets(args: AnyRecord): unknown;
  epochAdjudicateLoreTarget(args: AnyRecord): unknown;
  epochSetDowntime(args: AnyRecord): unknown;
  epochClaimDowntime(args: AnyRecord): unknown;
  epochTickDowntime(args: AnyRecord): unknown;
  epochSeasons(args: AnyRecord): unknown;
  epochSeasonArchive(args: AnyRecord): unknown;
  epochSeedSeason(args: AnyRecord): unknown;
  epochContributeSeason(args: AnyRecord): unknown;
  epochSettleSeason(args: AnyRecord): unknown;
  epochClaimRegionControl(args: AnyRecord): unknown;
}

// ── Registration ───────────────────────────────────────────────────────

export function registerWorldEventsHandlers(
  handlers: Map<string, (args: AnyRecord) => unknown>,
  runtime: WorldEventsRuntime,
): void {
  // Region info.
  handlers.set("obsidian_epoch.region_info", (args) => runtime.epochRegionInfo(args));

  // Messages & communication.
  handlers.set("obsidian_epoch.messages", (args) => runtime.epochMessages(args));
  handlers.set("obsidian_epoch.post_message", (args) => runtime.epochPostMessage(args));
  handlers.set("obsidian_epoch.request_confirmation", (args) => runtime.epochRequestConfirmation(args));

  // Moderation & safety.
  handlers.set("obsidian_epoch.moderation_queue", (args) => runtime.epochModerationQueue(args));
  handlers.set("obsidian_epoch.resolve_moderation", (args) => runtime.epochResolveModeration(args));
  handlers.set("obsidian_epoch.record_risk_review", (args) => runtime.epochRecordRiskReview(args));
  handlers.set("obsidian_epoch.release_market_risk_restriction", (args) => runtime.epochReleaseMarketRiskRestriction(args));
  handlers.set("obsidian_epoch.release_abuse_restriction", (args) => runtime.epochReleaseAbuseRestriction(args));

  // News & lore.
  handlers.set("obsidian_epoch.generate_region_news", (args) => runtime.epochGenerateRegionNews(args));
  handlers.set("obsidian_epoch.claim_news_legend", (args) => runtime.epochClaimNewsLegend(args));
  handlers.set("obsidian_epoch.record_lore_contribution", (args) => runtime.epochRecordLoreContribution(args));
  handlers.set("obsidian_epoch.lore_contributions", (args) => runtime.epochLoreContributions(args));
  handlers.set("obsidian_epoch.lore_targets", (args) => runtime.epochLoreTargets(args));
  handlers.set("obsidian_epoch.adjudicate_lore_target", (args) => runtime.epochAdjudicateLoreTarget(args));

  // Objectives.
  handlers.set("obsidian_epoch.objectives", (args) => runtime.epochObjectives(args));
  handlers.set("obsidian_epoch.seed_objective", (args) => runtime.epochSeedObjective(args));
  handlers.set("obsidian_epoch.contribute_objective", (args) => runtime.epochContributeObjective(args));
  handlers.set("obsidian_epoch.settle_objective", (args) => runtime.epochSettleObjective(args));

  // Resource nodes.
  handlers.set("obsidian_epoch.resource_nodes", (args) => runtime.epochResourceNodes(args));
  handlers.set("obsidian_epoch.spawn_resource_node", (args) => runtime.epochSpawnResourceNode(args));
  handlers.set("obsidian_epoch.contest_resource_node", (args) => runtime.epochContestResourceNode(args));
  handlers.set("obsidian_epoch.settle_resource_node", (args) => runtime.epochSettleResourceNode(args));

  // Anomalies.
  handlers.set("obsidian_epoch.anomalies", (args) => runtime.epochAnomalies(args));
  handlers.set("obsidian_epoch.spawn_anomaly", (args) => runtime.epochSpawnAnomaly(args));
  handlers.set("obsidian_epoch.contest_anomaly", (args) => runtime.epochContestAnomaly(args));
  handlers.set("obsidian_epoch.resolve_anomaly", (args) => runtime.epochResolveAnomaly(args));

  // Downtime.
  handlers.set("obsidian_epoch.set_downtime", (args) => runtime.epochSetDowntime(args));
  handlers.set("obsidian_epoch.claim_downtime", (args) => runtime.epochClaimDowntime(args));
  handlers.set("obsidian_epoch.tick_downtime", (args) => runtime.epochTickDowntime(args));

  // Seasons & region control.
  handlers.set("obsidian_epoch.seasons", (args) => runtime.epochSeasons(args));
  handlers.set("obsidian_epoch.season_archive", (args) => runtime.epochSeasonArchive(args));
  handlers.set("obsidian_epoch.seed_season", (args) => runtime.epochSeedSeason(args));
  handlers.set("obsidian_epoch.contribute_season", (args) => runtime.epochContributeSeason(args));
  handlers.set("obsidian_epoch.settle_season", (args) => runtime.epochSettleSeason(args));
  handlers.set("obsidian_epoch.claim_region_control", (args) => runtime.epochClaimRegionControl(args));
}
