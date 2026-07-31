import { publicPartyRun } from "./bountyPartyReadModel.ts";
import type {
  DirectTradeAcceptedPayload,
  DirectTradeCreatedPayload,
  EpochEvent,
  ExplorerRecoveryRotatedPayload,
  IdentityIssuedPayload,
  PartyInviteUpdatedPayload,
  PartyRunCreatedPayload,
} from "./events.ts";
import type {
  EpochCommandResult,
  EpochDirectTrade,
  EpochPartyRun,
  EpochProjection,
} from "./gameCore.ts";

export interface EpochRuntimeResult<TValue> {
  readonly value: TValue;
  readonly events: readonly EpochEvent[];
  readonly projection: EpochProjection;
  readonly duplicate?: boolean;
}

const EPOCH_EVENTS_FOR_PERSISTENCE = Symbol("epochEventsForPersistence");
export const EPOCH_TRANSPORT_RESULT_MAX_BYTES = 1_000_000;

type ResultWithPersistenceEvents = {
  readonly [EPOCH_EVENTS_FOR_PERSISTENCE]?: readonly EpochEvent[];
  readonly events?: readonly EpochEvent[];
};

type EpochTransportCommandResult = {
  readonly value: unknown;
  readonly events: readonly unknown[];
  readonly projection: object;
  readonly [key: string]: unknown;
};

function isEpochTransportCommandResult(value: unknown): value is EpochTransportCommandResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return "value" in record
    && Array.isArray(record.events)
    && Boolean(record.projection)
    && typeof record.projection === "object"
    && !Array.isArray(record.projection);
}

export function boundedEpochTransportValue(value: unknown): unknown {
  if (!isEpochTransportCommandResult(value)) return value;
  const originalBytes = Buffer.byteLength(JSON.stringify(value));
  if (originalBytes <= EPOCH_TRANSPORT_RESULT_MAX_BYTES) return value;
  const { projection: _projection, ...result } = value;
  return {
    ...result,
    projectionOmitted: {
      reason: "response_size_limit",
      originalBytes,
      maxBytes: EPOCH_TRANSPORT_RESULT_MAX_BYTES,
      readTools: [
        "obsidian_epoch.progress",
        "obsidian_epoch.region_info",
        "obsidian_epoch.world_overview",
      ],
    },
  };
}

export function epochEventsForPersistence(result: unknown): readonly EpochEvent[] {
  if (!result || typeof result !== "object") return [];
  const record = result as ResultWithPersistenceEvents;
  return record[EPOCH_EVENTS_FOR_PERSISTENCE] || (Array.isArray(record.events) ? record.events : []);
}

export function attachEpochEventsForPersistence<TResult extends object>(
  result: TResult,
  events: readonly EpochEvent[],
): TResult {
  Object.defineProperty(result, EPOCH_EVENTS_FOR_PERSISTENCE, {
    value: events,
    enumerable: false,
  });
  return result;
}

/**
 * Public payload field whitelist per event type.
 * Default-deny: events not in this map only expose envelope fields.
 * Empty array means envelope-only (internal events).
 * Sentinel ["*"] means full pass-through (all payload fields public).
 */
const PUBLIC_PAYLOAD_FIELDS: Record<string, readonly string[] | "*"> = {
  "identity_issued": ["agentId", "explorerId", "identityName", "generation", "startedAt", "maxLifetime", "strategyProfile", "previousAgentId"],
  "explorer_recovery_rotated": ["explorerId", "rotatedAt"],
  "direct_trade_created": ["tradeId", "status", "createdAt", "proposerAgentId", "offerResourceId", "offerAmount", "requestResourceId", "requestAmount"],
  "direct_trade_accepted": ["tradeId", "status", "acceptedAt"],
  "direct_trade_cancelled": ["tradeId", "status", "cancelledAt"],
  "direct_trade_expired": ["tradeId", "status"],
  "party_run_created": ["partyRunId", "title", "regionId", "objective", "createdAt", "joinPolicy", "inviteRecipientAgentId", "inviteTokenExpiresAt", "inviteTokenUseLimit", "inviteTokenUses"],
  "party_invite_updated": ["partyRunId", "status", "updatedAt", "inviteRecipientAgentId", "inviteTokenExpiresAt", "inviteTokenUseLimit", "inviteTokenUses"],
  "npc_identity_doubt": [], // internal event, envelope only
  // --- default-deny: all remaining event types are registered ---
  // "*" = full pass-through (all payload fields public); [] = envelope-only
  "world_clock_initialized": "*",
  "world_clock_advanced": "*",
  "world_simulation_initialized": "*",
  "world_simulation_advanced": "*",
  "world_simulation_content_migrated": "*",
  "causal_world_event_recorded": "*",
  "lifetime_adjusted": "*",
  "identity_archived": "*",
  "agent_custody_changed": "*",
  "reincarnation_issued": "*",
  "personality_drift_proposed": "*",
  "personality_drift_confirmed": "*",
  "attribute_gained": "*",
  "resource_granted": "*",
  "resource_spent": "*",
  "downtime_set": "*",
  "downtime_tick_resolved": "*",
  "downtime_claimed": "*",
  "npc_candidate_submitted": "*",
  "npc_candidate_reviewed": "*",
  "npc_canonicalized": "*",
  "npc_lifecycle_recorded": "*",
  "npc_relationship_recorded": "*",
  "agent_npc_bond_updated": "*",
  "npc_memory_recorded": "*",
  "npc_household_recorded": "*",
  "organization_created": "*",
  "organization_membership_changed": "*",
  "organization_politics_recorded": "*",
  "organization_prestige_changed": "*",
  "organization_treasury_changed": "*",
  "organization_budget_proposed": "*",
  "organization_budget_vote_recorded": "*",
  "organization_budget_resolved": "*",
  "organization_upgrade_purchased": "*",
  "npc_career_changed": "*",
  "npc_location_changed": "*",
  "npc_asset_changed": "*",
  "npc_health_recorded": "*",
  "item_created": "*",
  "item_bound": "*",
  "item_transferred": "*",
  "social_hook_created": "*",
  "region_news_generated": "*",
  "contested_objective_created": "*",
  "contested_objective_contributed": "*",
  "race_commission_completed": "*",
  "contested_objective_settled": "*",
  "resource_node_spawned": "*",
  "resource_node_contested": "*",
  "resource_node_settled": "*",
  "anomaly_event_spawned": "*",
  "anomaly_event_contested": "*",
  "anomaly_event_resolved": "*",
  "market_order_created": "*",
  "market_order_filled": "*",
  "market_order_cancelled": "*",
  "market_order_expired": "*",
  "bounty_created": "*",
  "bounty_claimed": "*",
  "party_join_requested": "*",
  "party_join_request_resolved": "*",
  "party_member_joined": "*",
  "party_run_settled": "*",
  "raid_resolved": "*",
  "retaliation_opportunity_created": "*",
  "retaliation_resolved": "*",
  "region_revolt_resolved": "*",
  "diplomacy_proposed": "*",
  "diplomacy_responded": "*",
  "relationship_updated": "*",
  "turn_card_created": "*",
  "turn_resolved": "*",
  "server_hosted_job_queued": "*",
  "server_hosted_job_completed": "*",
  "server_hosted_job_skipped": "*",
  "attestation_recorded": "*",
  "high_value_confirmation_requested": "*",
  "high_value_confirmation_confirmed": "*",
  "high_value_confirmation_consumed": "*",
  "lore_contribution_recorded": "*",
  "lore_target_adjudicated": "*",
  "hosted_session_started": "*",
  "hosted_action_recorded": "*",
  "message_posted": "*",
  "legend_awarded": "*",
  "moderation_queued": "*",
  "moderation_resolved": "*",
  "risk_review_recorded": "*",
  "market_risk_restriction_released": "*",
  "command_rejected": "*",
  "abuse_score_changed": "*",
  "abuse_score_released": "*",
  "abuse_score_decayed": "*",
  "season_campaign_created": "*",
  "season_started": "*",
  "season_objective_created": "*",
  "season_contribution_recorded": "*",
  "season_objective_completed": "*",
  "season_campaign_resolved": "*",
  "season_resolved": "*",
  "agent_faction_standing_changed": "*",
  "journey_world_solidified": "*",
  "region_influence_changed": "*",
  "trace_created": "*",
  "trace_conflict_deployed": "*",
  "trace_conflict_outcome": "*",
  "trace_conflict_effect_applied": "*",
  "trace_conflict_memory_recorded": "*",
  "region_control_changed": "*",
  "region_control_decayed": "*",
  "region_control_released": "*",
  "region_monument_built": "*",
  "identity_viability_projected": [],
  "world_object_state_changed": [],
  "hidden_prerequisite_link_changed": [],
};

function toPublicPayload(eventType: string, payload: unknown): Record<string, unknown> {
  const p = payload as Record<string, unknown>;
  const fields = PUBLIC_PAYLOAD_FIELDS[eventType];
  if (fields === "*") return p; // full pass-through
  if (!fields || fields.length === 0) return {}; // envelope-only
  const result: Record<string, unknown> = {};
  for (const field of fields) {
    if (field in p) result[field] = p[field];
  }
  return result;
}

export function publicEpochEvent(event: EpochEvent): EpochEvent {
  const fields = PUBLIC_PAYLOAD_FIELDS[event.eventType];
  // Default-deny: unregistered events strip payload entirely
  if (fields === undefined) {
    return { ...event, payload: {} } as unknown as EpochEvent;
  }
  return {
    ...event,
    payload: toPublicPayload(event.eventType, event.payload),
  } as unknown as EpochEvent;
}

export function publicProjection(projection: EpochProjection): EpochProjection {
  return {
    ...projection,
    events: projection.events.map(publicEpochEvent),
    partyRuns: Object.fromEntries(
      Object.entries(projection.partyRuns).map(([partyRunId, partyRun]) => [partyRunId, publicPartyRun(partyRun)]),
    ),
    directTrades: Object.fromEntries(
      Object.entries(projection.directTrades).map(([tradeId, trade]) => [tradeId, publicDirectTrade(trade)]),
    ),
  };
}

function publicDirectTrade(trade: EpochDirectTrade): EpochDirectTrade {
  return {
    ...trade,
    proposerExplorerId: "private",
    counterpartyExplorerId: "private",
  };
}

function isEpochDirectTradeValue(value: unknown): value is EpochDirectTrade {
  return typeof value === "object"
    && value !== null
    && !Array.isArray(value)
    && typeof (value as { readonly tradeId?: unknown }).tradeId === "string"
    && typeof (value as { readonly proposerAgentId?: unknown }).proposerAgentId === "string"
    && typeof (value as { readonly counterpartyAgentId?: unknown }).counterpartyAgentId === "string"
    && typeof (value as { readonly offeredAsset?: unknown }).offeredAsset === "object";
}

export function isEpochPartyRunValue(value: unknown): value is EpochPartyRun {
  return typeof value === "object"
    && value !== null
    && !Array.isArray(value)
    && typeof (value as { readonly partyRunId?: unknown }).partyRunId === "string"
    && typeof (value as { readonly regionId?: unknown }).regionId === "string"
    && typeof (value as { readonly leaderAgentId?: unknown }).leaderAgentId === "string"
    && Array.isArray((value as { readonly members?: unknown }).members);
}

export function publicCommandValue<TValue>(value: TValue): TValue {
  if (isEpochPartyRunValue(value)) return publicPartyRun(value) as TValue;
  if (isEpochDirectTradeValue(value)) return publicDirectTrade(value) as TValue;
  return value;
}

export function commandResult<TValue>(result: EpochCommandResult<TValue>): EpochRuntimeResult<TValue> {
  return attachEpochEventsForPersistence({
    value: publicCommandValue(result.value),
    events: result.events.map(publicEpochEvent),
    projection: publicProjection(result.projection),
  }, result.events);
}

export function withInternalEvents<TValue extends object>(result: TValue, events: readonly EpochEvent[]): TValue {
  Object.defineProperty(result, "events", {
    value: events,
    enumerable: false,
  });
  return result;
}
