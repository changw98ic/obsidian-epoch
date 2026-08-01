import type { EpochAgentIdentity } from "./gameCore.ts";

export type EpochActionEligibilityStatus = "active" | "archived" | "missing";

export const EPOCH_ACTIVE_IDENTITY_TOOL_NAMES = [
  "obsidian_epoch.command",
  "obsidian_epoch.confirm_personality_drift",
  "obsidian_epoch.archive_identity",
  "obsidian_epoch.turn_card",
  "obsidian_epoch.resolve_turn",
  "obsidian_epoch.resolve_turn_intent",
  "obsidian_epoch.set_downtime",
  "obsidian_epoch.claim_downtime",
  "obsidian_epoch.tick_downtime",
  "obsidian_epoch.post_message",
  "obsidian_epoch.request_confirmation",
  "obsidian_epoch.generate_region_news",
  "obsidian_epoch.record_lore_contribution",
  "obsidian_epoch.claim_news_legend",
  "obsidian_epoch.start_hosted_session",
  "obsidian_epoch.submit_hosted_action",
  "obsidian_epoch.submit_hosted_intent",
  "obsidian_epoch.run_server_hosted_action",
  "obsidian_epoch.queue_server_hosted_action",
  "obsidian_epoch.run_server_hosted_job",
  "obsidian_epoch.web_bridge_turn",
  "obsidian_epoch.submit_web_bridge_action",
  "obsidian_epoch.submit_web_bridge_intent",
  "obsidian_epoch.contribute_objective",
  "obsidian_epoch.contest_resource_node",
  "obsidian_epoch.contest_anomaly",
  "obsidian_epoch.create_item",
  "obsidian_epoch.craft_item",
  "obsidian_epoch.purchase_shop_offer",
  "obsidian_epoch.bind_item",
  "obsidian_epoch.contribute_season",
  "obsidian_epoch.claim_region_control",
  "obsidian_epoch.create_market_order",
  "obsidian_epoch.fill_market_order",
  "obsidian_epoch.cancel_market_order",
  "obsidian_epoch.create_direct_trade",
  "obsidian_epoch.accept_direct_trade",
  "obsidian_epoch.cancel_direct_trade",
  "obsidian_epoch.create_bounty",
  "obsidian_epoch.claim_bounty",
  "obsidian_epoch.create_party_run",
  "obsidian_epoch.update_party_invite",
  "obsidian_epoch.join_party_run",
  "obsidian_epoch.request_party_join",
  "obsidian_epoch.resolve_party_join_request",
  "obsidian_epoch.resolve_raid",
  "obsidian_epoch.resolve_region_revolt",
  "obsidian_epoch.resolve_retaliation",
  "obsidian_epoch.update_organization_membership",
  "obsidian_epoch.purchase_organization_upgrade",
  "obsidian_epoch.contribute_organization_treasury",
  "obsidian_epoch.propose_organization_budget",
  "obsidian_epoch.resolve_organization_budget",
  "obsidian_epoch.update_relationship",
  "obsidian_epoch.update_agent_npc_bond",
  "obsidian_epoch.deploy_trace_conflict",
  "obsidian_epoch.propose_diplomacy",
  "obsidian_epoch.respond_diplomacy",
  "obsidian_epoch.npc_note",
  "obsidian_epoch.submit_npc_candidate",
  "obsidian_epoch.submit_attested_action",
  "obsidian_epoch.prepare_journey",
  "obsidian_epoch.start_journey",
  "obsidian_epoch.start_journey_compact",
  "obsidian_epoch.propose_journey_step",
  "obsidian_epoch.propose_journey_step_compact",
  "obsidian_epoch.commit_journey_action",
  "obsidian_epoch.commit_journey_action_compact",
  "obsidian_epoch.commit_journey_intent",
  "obsidian_epoch.commit_journey_intent_compact",
  "obsidian_epoch.journey_status_compact",
  "obsidian_epoch.run_receipt_compact",
  "obsidian_epoch.recall_journey",
  "obsidian_epoch.begin_phase6_run",
  "obsidian_epoch.transition_to_gm",
  "obsidian_epoch.journey_gm_act",
  "obsidian_epoch.settle_gm_journey",
] as const;

export const EPOCH_ARCHIVED_IDENTITY_LIFECYCLE_TOOL_NAMES = [
  "obsidian_epoch.identity_archive",
  "obsidian_epoch.result_page",
  "obsidian_epoch.reincarnate",
] as const;

export interface EpochActionEligibilityInfo {
  readonly statusField: "progress.identity.status";
  readonly status: EpochActionEligibilityStatus;
  readonly canUseActiveTools: boolean;
  readonly reason: string;
  readonly activeOnlyTools: readonly string[];
  readonly blockedTools: readonly string[];
}

export function actionEligibilityView(identity?: EpochAgentIdentity): EpochActionEligibilityInfo {
  if (!identity) {
    return {
      statusField: "progress.identity.status",
      status: "missing",
      canUseActiveTools: false,
      reason: "No current identity is selected; active gameplay tools are unavailable.",
      activeOnlyTools: EPOCH_ACTIVE_IDENTITY_TOOL_NAMES,
      blockedTools: EPOCH_ACTIVE_IDENTITY_TOOL_NAMES,
    };
  }
  if (identity.status !== "active") {
    return {
      statusField: "progress.identity.status",
      status: "archived",
      canUseActiveTools: false,
      reason: "This identity is archived; active gameplay tools are unavailable.",
      activeOnlyTools: EPOCH_ACTIVE_IDENTITY_TOOL_NAMES,
      blockedTools: EPOCH_ACTIVE_IDENTITY_TOOL_NAMES,
    };
  }
  return {
    statusField: "progress.identity.status",
    status: "active",
    canUseActiveTools: true,
    reason: "This identity is active and can use owner-authorized active gameplay tools.",
    activeOnlyTools: EPOCH_ACTIVE_IDENTITY_TOOL_NAMES,
    blockedTools: [],
  };
}
