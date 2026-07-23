export const CAUSAL_SCHEMA_REGISTRY_VERSION = 1;
export const CAUSAL_SCHEMA_REGISTRY_DOCUMENT_VERSION = "1.0.0" as const;

export type CausalSchemaFamily = "event" | "root_reason" | "source" | "sink" | "enforcement";
export type CausalSchemaStatus = "active" | "retired";

export interface CausalSchemaRegistryEntry {
  readonly schemaId: string;
  readonly family: CausalSchemaFamily;
  readonly version: number;
  readonly status: CausalSchemaStatus;
  readonly description: string;
  readonly replacedBy?: string;
  readonly deprecatedSince?: string;
}

export interface CausalEventPolicy {
  readonly eventType: string;
  readonly status: CausalSchemaStatus;
  readonly eventSchemaId: string;
  readonly rootReasonSchemaId: string;
  readonly sourceSchemaId: string;
  readonly sinkSchemaId: string;
  readonly enforcementSchemaId: string;
  readonly replacementEventType?: string;
  readonly deprecatedSince?: string;
  readonly retiredReason?: string;
}

export interface CausalSchemaRegistrySnapshot {
  readonly schemaVersion: typeof CAUSAL_SCHEMA_REGISTRY_VERSION;
  readonly documentVersion: typeof CAUSAL_SCHEMA_REGISTRY_DOCUMENT_VERSION;
  readonly entries: readonly CausalSchemaRegistryEntry[];
  readonly eventPolicies: readonly CausalEventPolicy[];
}

const SHARED_EVENT_POLICY = {
  rootReasonSchemaId: "causal.root_reason.command.v1",
  sourceSchemaId: "causal.source.event_ids.v1",
  sinkSchemaId: "causal.sink.aggregate.v1",
  enforcementSchemaId: "causal.enforcement.phase0.v1",
} as const;

export const CAUSAL_ACTIVE_EPOCH_EVENT_TYPES = [
  "causal_world_event_recorded",
  "world_clock_initialized",
  "world_clock_advanced",
  "world_simulation_initialized",
  "world_simulation_advanced",
  "world_simulation_content_migrated",
  "identity_issued",
  "explorer_recovery_rotated",
  "lifetime_adjusted",
  "identity_archived",
  "agent_custody_changed",
  "reincarnation_issued",
  "personality_drift_proposed",
  "personality_drift_confirmed",
  "attribute_gained",
  "resource_granted",
  "resource_spent",
  "downtime_set",
  "downtime_tick_resolved",
  "downtime_claimed",
  "npc_candidate_submitted",
  "npc_candidate_reviewed",
  "npc_canonicalized",
  "npc_lifecycle_recorded",
  "npc_relationship_recorded",
  "agent_npc_bond_updated",
  "npc_memory_recorded",
  "npc_household_recorded",
  "organization_created",
  "organization_membership_changed",
  "organization_politics_recorded",
  "organization_prestige_changed",
  "organization_treasury_changed",
  "organization_budget_proposed",
  "organization_budget_vote_recorded",
  "organization_budget_resolved",
  "organization_upgrade_purchased",
  "npc_career_changed",
  "npc_location_changed",
  "npc_asset_changed",
  "npc_health_recorded",
  "item_created",
  "item_bound",
  "item_transferred",
  "social_hook_created",
  "region_news_generated",
  "contested_objective_created",
  "contested_objective_contributed",
  "race_commission_completed",
  "contested_objective_settled",
  "resource_node_spawned",
  "resource_node_contested",
  "resource_node_settled",
  "anomaly_event_spawned",
  "anomaly_event_contested",
  "anomaly_event_resolved",
  "market_order_created",
  "market_order_filled",
  "market_order_cancelled",
  "market_order_expired",
  "direct_trade_created",
  "direct_trade_accepted",
  "direct_trade_cancelled",
  "direct_trade_expired",
  "bounty_created",
  "bounty_claimed",
  "party_run_created",
  "party_invite_updated",
  "party_join_requested",
  "party_join_request_resolved",
  "party_member_joined",
  "party_run_settled",
  "raid_resolved",
  "retaliation_opportunity_created",
  "retaliation_resolved",
  "region_revolt_resolved",
  "diplomacy_proposed",
  "diplomacy_responded",
  "relationship_updated",
  "turn_card_created",
  "turn_resolved",
  "server_hosted_job_queued",
  "server_hosted_job_completed",
  "server_hosted_job_skipped",
  "attestation_recorded",
  "high_value_confirmation_requested",
  "high_value_confirmation_confirmed",
  "high_value_confirmation_consumed",
  "lore_contribution_recorded",
  "lore_target_adjudicated",
  "hosted_session_started",
  "hosted_action_recorded",
  "message_posted",
  "legend_awarded",
  "moderation_queued",
  "moderation_resolved",
  "risk_review_recorded",
  "market_risk_restriction_released",
  "command_rejected",
  "abuse_score_changed",
  "abuse_score_released",
  "abuse_score_decayed",
  "season_campaign_created",
  "season_started",
  "season_objective_created",
  "season_contribution_recorded",
  "season_objective_completed",
  "season_campaign_resolved",
  "season_resolved",
  "agent_faction_standing_changed",
  "journey_world_solidified",
  "region_influence_changed",
  "trace_created",
  "trace_conflict_deployed",
  "trace_conflict_outcome",
  "trace_conflict_effect_applied",
  "trace_conflict_memory_recorded",
  "region_control_changed",
  "region_control_decayed",
  "region_control_released",
  "region_monument_built",
] as const;

export const INFINITE_WORLD_RUNTIME_COMMAND_TYPES = [
  "world_tick",
  "resource_node_register",
  "resource_production_assign",
  "resource_produce",
  "resource_node_replenish",
  "life_profile_create",
  "life_profile_advance",
  "mission_settle",
  "economy_buy",
  "economy_sell",
  "economy_craft",
  "economy_repair",
  "progression_reward",
  "progression_breakthrough",
  "progression_talent",
  "progression_skill",
  "progression_carry",
  "progression_attribute_evidence",
  "progression_respec",
  "governance_action",
  "supernatural_cast",
  "legacy_transition",
  "project_tick",
  "narrative_settle",
  "actor_mind_tick",
  "actor_goal_select",
  "actor_commitment_update",
] as const;

export const INFINITE_WORLD_RUNTIME_EVENT_TYPES = [
  "ecology_tick_resolved",
  "resource_node_registered",
  "resource_production_assigned",
  "resource_production_committed",
  "resource_node_replenished",
  "life_profile_created",
  "life_profile_advanced",
  "mission_outcome_settled",
  "economy_transaction_committed",
  "crafting_job_resolved",
  "progression_change_committed",
  "governance_action_resolved",
  "supernatural_action_resolved",
  "legacy_cycle_changed",
  "enterprise_tick_resolved",
  "narrative_settlement_committed",
  "actor_mind_updated",
  "actor_goal_committed",
  "actor_commitment_updated",
] as const;

export const CAUSAL_ACTIVE_DOMAIN_EVENT_TYPES = [
  "world_pressure_opened",
  "world_pressure_updated",
  "world_pressure_transformed",
  "world_pressure_closed",
  "observation_acquired",
  "market_order_placed",
  ...INFINITE_WORLD_RUNTIME_EVENT_TYPES,
] as const;

export const CAUSAL_RETIRED_DOMAIN_EVENT_ALIASES = [
  {
    eventType: "world_pressure_detected",
    replacementEventType: "world_pressure_opened",
    retiredReason: "published_alias_replaced_by_world_pressure_opened",
  },
  {
    eventType: "world_pressure_changed",
    replacementEventType: "world_pressure_updated",
    retiredReason: "published_alias_replaced_by_world_pressure_updated",
  },
  {
    eventType: "world_pressure_mobilized",
    replacementEventType: "world_pressure_updated",
    retiredReason: "published_alias_replaced_by_world_pressure_updated",
  },
  {
    eventType: "world_pressure_resolving",
    replacementEventType: "world_pressure_updated",
    retiredReason: "published_alias_replaced_by_world_pressure_updated",
  },
  {
    eventType: "world_pressure_resolved",
    replacementEventType: "world_pressure_closed",
    retiredReason: "published_alias_replaced_by_world_pressure_closed",
  },
] as const;

export const CAUSAL_SCHEMA_REGISTRY_ENTRIES: readonly CausalSchemaRegistryEntry[] = Object.freeze([
  {
    schemaId: "causal.event.epoch.v1",
    family: "event",
    version: 1,
    status: "active",
    description: "Epoch event envelope canonical schema for Phase 0 causal hashing.",
  },
  {
    schemaId: "causal.event.domain.v1",
    family: "event",
    version: 1,
    status: "active",
    description: "Infinite-world domain event schema with explicit causes, effects, and proof hashes.",
  },
  {
    schemaId: "causal.root_reason.command.v1",
    family: "root_reason",
    version: 1,
    status: "active",
    description: "Command, causation, correlation, and idempotency reason fields.",
  },
  {
    schemaId: "causal.source.event_ids.v1",
    family: "source",
    version: 1,
    status: "active",
    description: "Ordered source event id references used to derive the event.",
  },
  {
    schemaId: "causal.sink.aggregate.v1",
    family: "sink",
    version: 1,
    status: "active",
    description: "Aggregate sink addressed by aggregateType and aggregateId.",
  },
  {
    schemaId: "causal.enforcement.phase0.v1",
    family: "enforcement",
    version: 1,
    status: "active",
    description: "Phase 0 enforcement policy: reject unknown and retired schemas.",
  },
  {
    schemaId: "causal.enforcement.legacy.v0",
    family: "enforcement",
    version: 0,
    status: "retired",
    description: "Pre-Phase 0 placeholder retained only to produce retired-schema errors.",
    replacedBy: "causal.enforcement.phase0.v1",
    deprecatedSince: CAUSAL_SCHEMA_REGISTRY_DOCUMENT_VERSION,
  },
] as const);

const domainEventTypeSet = new Set<string>(CAUSAL_ACTIVE_DOMAIN_EVENT_TYPES);

export const CAUSAL_EVENT_POLICIES: readonly CausalEventPolicy[] = Object.freeze([
  ...CAUSAL_ACTIVE_EPOCH_EVENT_TYPES.map((eventType) => Object.freeze({
    eventType,
    status: "active" as const,
    eventSchemaId: "causal.event.epoch.v1",
    ...SHARED_EVENT_POLICY,
  })),
  ...CAUSAL_ACTIVE_DOMAIN_EVENT_TYPES.map((eventType) => Object.freeze({
    eventType,
    status: "active" as const,
    eventSchemaId: "causal.event.domain.v1",
    ...SHARED_EVENT_POLICY,
  })),
  ...CAUSAL_RETIRED_DOMAIN_EVENT_ALIASES.map((alias) => Object.freeze({
    eventType: alias.eventType,
    status: "retired" as const,
    eventSchemaId: "causal.event.domain.v1",
    ...SHARED_EVENT_POLICY,
    replacementEventType: alias.replacementEventType,
    deprecatedSince: CAUSAL_SCHEMA_REGISTRY_DOCUMENT_VERSION,
    retiredReason: alias.retiredReason,
  })),
]);

export const CAUSAL_SCHEMA_REGISTRY: CausalSchemaRegistrySnapshot = Object.freeze({
  schemaVersion: CAUSAL_SCHEMA_REGISTRY_VERSION,
  documentVersion: CAUSAL_SCHEMA_REGISTRY_DOCUMENT_VERSION,
  entries: CAUSAL_SCHEMA_REGISTRY_ENTRIES,
  eventPolicies: CAUSAL_EVENT_POLICIES,
});

export function isCausalActiveDomainEventType(eventType: string): boolean {
  return domainEventTypeSet.has(eventType);
}
