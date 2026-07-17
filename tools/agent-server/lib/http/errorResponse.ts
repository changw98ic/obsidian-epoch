import { DOWNTIME_ELIGIBILITY_ERROR_CODES } from "../epoch/downtimeEligibilityRules.ts";

const BAD_REQUEST_HTTP_ERROR_CODES = new Set([
  "agent_identity_archived",
  "agent_identity_already_exists",
  "agent_identity_not_found",
  "agent_id_required",
  "abuse_profile_not_found",
  "abuse_release_projection_failed",
  "abuse_release_requires_server_trust",
  "abuse_release_score_not_lower",
  "actor_key_required",
  "attestation_challenge_already_used",
  "attestation_challenge_expired",
  "attestation_challenge_mismatch",
  "attestation_challenge_not_found",
  "attestation_signature_invalid",
  "attested_runner_not_found",
  "bounty_fulfillment_item_required",
  "bounty_item_key_mismatch",
  "contested_objective_not_found",
  "contested_objective_settled",
  "contested_objective_requires_server_trust",
  "contested_objective_settlement_requires_server_trust",
  "craft_recipe_id_required",
  "craft_recipe_not_found",
  "downtime_mode_invalid",
  "downtime_not_active",
  "downtime_tick_requires_server_trust",
  ...DOWNTIME_ELIGIBILITY_ERROR_CODES,
  "explorer_id_required",
  "hosted_action_option_not_found",
  "hosted_action_projection_failed",
  "hosted_session_not_active",
  "hosted_session_not_found",
  "hosted_session_requires_server_trust",
  "high_value_confirmation_action_invalid",
  "high_value_confirmation_already_used",
  "high_value_confirmation_expired",
  "high_value_confirmation_mismatch",
  "high_value_confirmation_not_confirmed",
  "high_value_confirmation_not_found",
  "high_value_confirmation_not_pending",
  "high_value_confirmation_owner_mismatch",
  "high_value_confirmation_required",
  "idempotency_key_conflict",
  "idempotency_key_required",
  "identity_already_reincarnated",
  "identity_name_invalid",
  "identity_lineage_mismatch",
  "identity_slot_limit_reached",
  "diplomacy_focus_spent_integer_required",
  "diplomacy_focus_spent_positive_integer_required",
  "diplomacy_not_found",
  "diplomacy_not_pending",
  "diplomacy_response_invalid",
  "diplomacy_responder_not_target",
  "diplomacy_self_target_not_allowed",
  "inventory_craft_owner_mismatch",
  "inventory_item_bound_not_tradable",
  "inventory_item_market_locked",
  "inventory_item_market_lock_mismatch",
  "inventory_item_not_found",
  "inventory_item_owner_mismatch",
  "inventory_item_source_agent_mismatch",
  "inventory_item_source_event_id_required",
  "item_display_name_required",
  "item_id_required",
  "item_key_required",
  "legend_news_agent_not_mentioned",
  "lore_contribution_category_invalid",
  "lore_contribution_owner_mismatch",
  "lore_contribution_non_evidence_source",
  "lore_contribution_source_event_required",
  "lore_contribution_source_event_not_found",
  "lore_contribution_summary_required",
  "lore_contribution_target_id_required",
  "lore_adjudication_requires_server_trust",
  "lore_adjudication_source_contribution_required",
  "lore_adjudication_source_event_not_contribution",
  "lore_adjudication_source_event_not_found",
  "lore_adjudication_source_target_mismatch",
  "lore_adjudication_status_invalid",
  "lore_adjudication_summary_required",
  "lore_adjudication_target_id_required",
  "market_risk_restriction_not_found",
  "market_risk_restriction_release_projection_failed",
  "market_risk_restriction_release_requires_server_trust",
  "market_order_not_found",
  "market_order_not_open",
  "market_order_owner_mismatch",
  "market_expiry_tick_requires_server_trust",
  "market_agent_restricted",
  "market_same_explorer_fill_not_allowed",
  "market_self_fill_not_allowed",
  "direct_trade_not_found",
  "direct_trade_not_open",
  "direct_trade_owner_mismatch",
  "direct_trade_proposer_owner_mismatch",
  "direct_trade_counterparty_owner_mismatch",
  "direct_trade_counterparty_mismatch",
  "direct_trade_self_not_allowed",
  "direct_trade_same_explorer_not_allowed",
  "direct_trade_offer_asset_required",
  "direct_trade_offer_asset_ambiguous",
  "direct_trade_request_asset_required",
  "direct_trade_request_asset_ambiguous",
  "direct_trade_resource_asset_invalid",
  "direct_trade_item_asset_invalid",
  "direct_trade_expiry_tick_requires_server_trust",
  "message_body_required",
  "message_body_too_long",
  "message_projection_failed",
  "message_scope_invalid",
  "moderation_item_already_resolved",
  "moderation_item_not_found",
  "moderation_resolution_invalid",
  "moderation_resolution_requires_server_trust",
  "npc_candidate_review_requires_rejected_candidate",
  "npc_display_name_required",
  "news_id_required",
  "npc_lifecycle_tick_requires_server_trust",
  "npc_not_found",
  "organization_id_required",
  "organization_contribution_amount_positive_integer_required",
  "organization_contribution_membership_required",
  "organization_contribution_owner_mismatch",
  "organization_budget_amount_positive_integer_required",
  "organization_budget_id_required",
  "organization_budget_membership_required",
  "organization_budget_not_found",
  "organization_budget_not_proposed",
  "organization_budget_owner_mismatch",
  "organization_budget_resolution_invalid",
  "organization_budget_resolution_required",
  "organization_budget_resolver_membership_required",
  "organization_budget_resolver_owner_mismatch",
  "organization_budget_resolver_role_required",
  "organization_budget_self_resolution_not_allowed",
  "organization_budget_title_required",
  "organization_budget_vote_already_recorded",
  "organization_membership_role_escalation_requires_authority",
  "organization_not_found",
  "organization_treasury_insufficient",
  "organization_upgrade_already_purchased",
  "organization_upgrade_key_required",
  "organization_upgrade_membership_required",
  "organization_upgrade_not_found",
  "organization_upgrade_owner_mismatch",
  "participant_role_invalid",
  "party_invite_exhausted",
  "party_invite_expired",
  "party_invite_expires_at_invalid",
  "party_invite_invalid",
  "party_invite_recipient_mismatch",
  "party_invite_required",
  "party_invite_use_limit_invalid",
  "party_invite_use_limit_positive_integer_required",
  "party_join_request_already_pending",
  "party_join_request_id_required",
  "party_join_request_leader_required",
  "party_join_request_not_found",
  "party_join_request_not_pending",
  "party_join_request_owner_mismatch",
  "party_join_request_resolution_invalid",
  "party_join_request_resolution_required",
  "party_leader_owner_mismatch",
  "party_member_already_joined",
  "party_member_owner_mismatch",
  "party_objective_required",
  "party_run_id_required",
  "party_run_not_found",
  "party_run_not_open",
  "party_run_settlement_requires_server_trust",
  "party_title_required",
  "previous_identity_not_archived",
  "region_id_required",
  "region_news_not_found",
  "region_news_source_region_mismatch",
  "raid_pair_cooldown_active",
  "raid_self_target_not_allowed",
  "relationship_kind_invalid",
  "relationship_self_target_not_allowed",
  "result_page_identity_required",
  "result_page_id_required",
  "result_page_not_found",
  "result_page_owner_not_found",
  "result_page_payload_missing",
  "result_page_publish_token_consumed",
  "result_page_publish_token_mismatch",
  "result_page_publish_token_not_found",
  "result_page_publish_token_required",
  "resource_id_invalid",
  "resource_insufficient",
  "resource_node_not_found",
  "resource_node_not_open",
  "resource_node_region_open",
  "resource_node_requires_server_trust",
  "resource_node_settlement_requires_server_trust",
  "resource_node_spawn_cooldown_active",
  "risk_review_projection_failed",
  "risk_review_resolution_invalid",
  "risk_review_requires_server_trust",
  "risk_review_source_event_id_required",
  "risk_review_source_event_not_found",
  "risk_review_source_event_not_reviewable",
  "season_campaign_not_found",
  "season_campaign_requires_server_trust",
  "season_campaign_resolved",
  "season_campaign_settlement_requires_server_trust",
  "season_faction_not_found",
  "season_factions_required",
  "season_regions_required",
  "secret_material_detected",
  "server_hosted_job_action_mismatch",
  "server_hosted_job_agent_mismatch",
  "server_hosted_job_not_found",
  "server_hosted_job_not_queued",
  "server_hosted_job_requires_server_trust",
  "server_hosted_job_session_mismatch",
  "server_hosted_option_key_invalid",
  "shop_offer_id_required",
  "shop_offer_not_found",
  "shop_purchase_owner_mismatch",
  "source_event_not_found",
  "source_event_id_required",
  "ticket_not_found",
  "ticket_payload_mismatch",
  "ticket_identity_required",
  "ticket_identity_mismatch",
  "ticket_identity_archived",
  "ticket_expired",
  "ticket_not_issued",
  "ticket_region_mismatch",
  "ticket_action_budget_exceeded",
  "ticket_risk_budget_exceeded",
  "ticket_high_risk_confirmation_required",
  "ticket_cooldown_rule_unverified",
  "ticket_canonical_action_unverified",
  "ticket_outcome_state_unverified",
  "ticket_event_schema_invalid",
  "ticket_event_sequence_invalid",
  "ticket_item_use_unverified",
  "ticket_context_version_required",
  "ticket_context_version_mismatch",
  "ticket_context_envelope_required",
  "ticket_context_envelope_mismatch",
  "ticket_sequence_mismatch",
  "ticket_sequence_required",
  "trace_conflict_authorized_agent_mismatch",
  "trace_conflict_child_npc_target_forbidden",
  "trace_conflict_owner_auth_required",
  "trace_conflict_owner_mismatch",
  "trace_conflict_protected_npc_target_forbidden",
  "trace_conflict_same_explorer_target_forbidden",
  "trace_conflict_self_target_forbidden",
  "trace_conflict_source_agent_id_required",
  "trace_conflict_source_agent_mismatch",
  "trace_conflict_source_event_id",
  "trace_conflict_source_event_id_required",
  "trace_conflict_source_identity_inactive",
  "trace_conflict_source_identity_not_found",
  "trace_conflict_target_agent_not_found",
  "trace_conflict_target_id_required",
  "trace_conflict_target_kind_invalid",
  "trace_conflict_target_npc_not_found",
  "trace_conflict_template_key_required",
  "trace_conflict_template_unknown",
  "turn_card_agent_mismatch",
  "turn_card_explorer_mismatch",
  "turn_card_not_resolved",
  "turn_action_option_not_found",
  "turn_card_already_open",
  "turn_card_not_found",
  "turn_card_not_open",
  "turn_card_expired",
  "turn_card_nonce_mismatch",
  "turn_card_nonce_required",
  "turn_card_requires_server_trust",
  "turn_card_sequence_mismatch",
  "turn_card_sequence_required",
  "turn_resolution_projection_failed",
  "web_bridge_session_required",
  "community_target_type_invalid",
  "community_target_id_required",
  "community_target_id_too_long",
  "community_target_id_invalid",
  "community_explorer_id_required",
  "community_explorer_id_too_long",
  "community_explorer_id_invalid",
  "community_token_id_too_long",
  "community_token_id_invalid",
  "community_reaction_required",
  "community_reaction_too_long",
  "community_reaction_invalid",
  "community_against_explorer_id_too_long",
  "community_against_explorer_id_invalid",
  "community_group_id_too_long",
  "community_group_id_invalid",
  "community_body_required",
  "community_body_too_long",
  "community_body_invalid",
  "community_reason_required",
  "community_reason_too_long",
  "community_reason_invalid",
  "community_idempotency_key_too_long",
  "community_idempotency_key_invalid",
  "community_idempotency_conflict",
  "community_target_not_found",
  "community_flag_id_required",
  "community_flag_id_too_long",
  "community_flag_id_invalid",
  "community_moderation_note_too_long",
  "community_moderation_note_invalid",
  "community_moderation_action_invalid",
  "community_moderation_item_not_found",
]);

export interface HttpErrorResponse {
  readonly statusCode: number;
  readonly body: {
    readonly error: string;
    readonly message?: string;
    readonly retryAfterMs?: number;
    readonly retryAt?: string;
  };
  readonly headers?: Readonly<Record<string, string>>;
}

function errorCode(error: unknown) {
  return error && typeof error === "object" && "code" in error ? error.code : undefined;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "internal_error";
}

function rateLimitRetry(error: unknown): { readonly retryAfterMs: number; readonly retryAt: string } | null {
  if (!error || typeof error !== "object") return null;
  const retryAfterMs = "retryAfterMs" in error ? error.retryAfterMs : undefined;
  const retryAt = "retryAt" in error ? error.retryAt : undefined;
  if (!Number.isSafeInteger(retryAfterMs) || Number(retryAfterMs) <= 0 || typeof retryAt !== "string") return null;
  return { retryAfterMs: Number(retryAfterMs), retryAt };
}

export function isBadRequestHttpErrorCode(message: string) {
  return BAD_REQUEST_HTTP_ERROR_CODES.has(message);
}

export function classifyHttpError(error: unknown): HttpErrorResponse {
  const message = errorMessage(error);
  const code = errorCode(error);

  if (code === "epoch_persistence_unavailable" || message === "epoch_persistence_unavailable") {
    return { statusCode: 503, body: { error: "epoch_persistence_unavailable" } };
  }

  if (code === "api_key_detected") {
    return {
      statusCode: 400,
      body: { error: "api_key_detected", message: "Remove secrets before submitting." },
    };
  }
  if (code === "json_body_too_large") {
    return { statusCode: 413, body: { error: "json_body_too_large" } };
  }
  if (message === "epoch_abuse_limit_exceeded") {
    return { statusCode: 429, body: { error: "epoch_abuse_limit_exceeded" } };
  }
  if (message === "legacy_run_submission_rate_limited") {
    return { statusCode: 429, body: { error: "legacy_run_submission_rate_limited" } };
  }
  if (message === "public_registration_rate_limited") {
    const retry = rateLimitRetry(error);
    const retryAfterMs = retry?.retryAfterMs || 1_000;
    return {
      statusCode: 429,
      body: {
        error: "public_registration_rate_limited",
        retryAfterMs,
        ...(retry ? { retryAt: retry.retryAt } : {}),
      },
      headers: { "retry-after": String(Math.max(1, Math.ceil(retryAfterMs / 1_000))) },
    };
  }
  if (message === "community_rate_limited") {
    const retry = rateLimitRetry(error);
    const retryAfterMs = retry?.retryAfterMs || 1_000;
    return {
      statusCode: 429,
      body: {
        error: "community_rate_limited",
        retryAfterMs,
        ...(retry ? { retryAt: retry.retryAt } : {}),
      },
      headers: { "retry-after": String(Math.max(1, Math.ceil(retryAfterMs / 1_000))) },
    };
  }
  if (message.startsWith("trace_conflict_deploy_rate_limited:")) {
    const retryAt = message.slice("trace_conflict_deploy_rate_limited:".length);
    const retryTimestamp = Date.parse(retryAt);
    const retryAfterMs = Number.isFinite(retryTimestamp)
      ? Math.max(1_000, retryTimestamp - Date.now())
      : 1_000;
    return {
      statusCode: 429,
      body: {
        error: "trace_conflict_deploy_rate_limited",
        retryAfterMs,
        ...(Number.isFinite(retryTimestamp) ? { retryAt: new Date(retryTimestamp).toISOString() } : {}),
      },
      headers: { "retry-after": String(Math.max(1, Math.ceil(retryAfterMs / 1_000))) },
    };
  }
  if (message.startsWith("trace_conflict_resource_insufficient:")) {
    return { statusCode: 400, body: { error: "trace_conflict_resource_insufficient" } };
  }
  if (message === "epoch_abuse_score_restricted") {
    return { statusCode: 403, body: { error: "epoch_abuse_score_restricted" } };
  }
  if (message === "operator_key_required") {
    return { statusCode: 403, body: { error: "operator_key_required" } };
  }
  if (message === "explorer_auth_required") {
    return { statusCode: 401, body: { error: "explorer_auth_required" } };
  }
  if (message === "explorer_auth_invalid") {
    return { statusCode: 403, body: { error: "explorer_auth_invalid" } };
  }
  if (message === "community_auth_required") {
    return {
      statusCode: 401,
      body: { error: "community_auth_required" },
      headers: { "www-authenticate": "Bearer realm=\"obsidian-epoch-community\"" },
    };
  }
  if (message === "community_auth_invalid" || message === "community_auth_player_required") {
    return { statusCode: 403, body: { error: message } };
  }
  if (message.startsWith("community_")) {
    return { statusCode: 400, body: { error: message } };
  }
  if (message === "player_mcp_access_token_not_found") {
    return { statusCode: 404, body: { error: "player_mcp_access_token_not_found" } };
  }
  if (message === "player_mcp_access_tokens_unavailable") {
    return { statusCode: 503, body: { error: "player_mcp_access_tokens_unavailable" } };
  }
  if (message === "pairing_origin_forbidden") {
    return { statusCode: 403, body: { error: "pairing_origin_forbidden" } };
  }
  if (message === "public_registration_protection_unavailable") {
    return { statusCode: 503, body: { error: "public_registration_protection_unavailable" } };
  }
  if (message === "public_registration_actor_metadata_invalid") {
    return { statusCode: 400, body: { error: "public_registration_actor_metadata_invalid" } };
  }
  if (message === "public_registration_device_challenge_invalid") {
    return { statusCode: 403, body: { error: "public_registration_device_challenge_invalid" } };
  }
  if (message === "public_registration_invite_invalid") {
    return { statusCode: 403, body: { error: "public_registration_invite_invalid" } };
  }
  if (isBadRequestHttpErrorCode(message)) {
    return { statusCode: 400, body: { error: message } };
  }
  if (message.includes("JSON")) {
    return { statusCode: 400, body: { error: "invalid_json" } };
  }
  return { statusCode: 500, body: { error: "internal_error" } };
}
