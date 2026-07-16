export const EPOCH_PROTOCOL_VERSION = "obsidian-epoch-alpha1-2026-06-25";

export const EPOCH_TRUST_CLASSES = [
  "untrusted_client",
  "user_verified_web",
  "server_hosted_agent",
  "host_attested",
  "remote_attested_runner",
  "system_worker",
] as const;

export type EpochTrustClass = typeof EPOCH_TRUST_CLASSES[number];

export const EPOCH_SOURCE_AUTHORITIES = [
  "core",
  "official",
  "derived",
  "low-confidence",
] as const;

export type EpochSourceAuthority = typeof EPOCH_SOURCE_AUTHORITIES[number];
export type EpochLoreAuthorityEvidenceQuality = "weak" | "mixed" | "strong";

export interface EpochLoreAuthorityReview {
  readonly sourceAuthorities: readonly EpochSourceAuthority[];
  readonly highAuthoritySourceEventIds: readonly string[];
  readonly lowAuthoritySourceEventIds: readonly string[];
  readonly evidenceQuality: EpochLoreAuthorityEvidenceQuality;
  readonly canHardRefute: boolean;
  readonly recommendedStatus: "hard_refutation_allowed" | "review_required";
  readonly oldestSourceRecordedAt?: string;
  readonly latestSourceRecordedAt?: string;
  readonly reason: string;
}

export const EPOCH_CHANNEL_CLASSES = [
  "server_hosted",
  "browser_copy_paste",
] as const;

export type EpochChannelClass = typeof EPOCH_CHANNEL_CLASSES[number];

export const EPOCH_AGGREGATE_TYPES = [
  "explorer",
  "agent_identity",
  "resource_account",
  "downtime",
  "npc",
  "npc_candidate",
  "region",
  "region_monument",
  "trace",
  "resource_node",
  "anomaly_event",
  "objective",
  "market_order",
  "direct_trade",
  "bounty",
  "party_run",
  "raid",
  "retaliation",
  "relationship",
  "diplomacy",
  "turn_card",
  "hosted_session",
  "server_hosted_job",
  "attestation",
  "message",
  "legend_award",
  "moderation_item",
  "audit_record",
  "abuse_profile",
  "npc_relationship",
  "agent_npc_bond",
  "household",
  "organization",
  "organization_politics",
  "npc_career",
  "npc_location",
  "npc_asset",
  "npc_health",
  "inventory_item",
  "personality_drift",
  "social_hook",
  "season_campaign",
  "season_objective",
  "world_clock",
  "world_simulation",
] as const;

export type EpochAggregateType = typeof EPOCH_AGGREGATE_TYPES[number];

export const EPOCH_EVENT_TYPES = [
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

export type EpochEventType = typeof EPOCH_EVENT_TYPES[number];

export interface EpochLoreSourceEventProvenance {
  readonly eventId: string;
  readonly eventType: EpochEventType;
  readonly aggregateType: EpochAggregateType;
  readonly aggregateId: string;
  readonly agentId?: string;
  readonly actorExplorerId: string;
  readonly trustClass: EpochTrustClass;
  readonly sourceAuthority: EpochSourceAuthority;
  readonly createdAt: string;
  readonly publicPages: {
    readonly audit: string;
  };
}

export interface EpochLoreContributionProvenance {
  readonly receiptType: "lore_contribution_provenance";
  readonly contributionEventId?: string;
  readonly targetId: string;
  readonly sourceEventIds: readonly string[];
  readonly sourceEventCount: number;
  readonly sourceEventTypes: readonly EpochEventType[];
  readonly sourceAgentIds: readonly string[];
  readonly sourceAggregateIds: readonly string[];
  readonly sourceTrustClasses: readonly EpochTrustClass[];
  readonly sourceEvents: readonly EpochLoreSourceEventProvenance[];
  readonly evidenceHash: `sha256:${string}`;
  readonly recordedAt: string;
}

export interface EpochLoreContributionEvidenceProvenance {
  readonly eventId: string;
  readonly contributionId: string;
  readonly category: EpochLoreContributionCategory;
  readonly revisionMode?: EpochLoreRevisionMode;
  readonly agentId: string;
  readonly targetId: string;
  readonly trustClass: EpochTrustClass;
  readonly sourceAuthority: EpochSourceAuthority;
  readonly recordedAt: string;
  readonly evidenceHash: `sha256:${string}`;
  readonly publicPages: {
    readonly audit: string;
  };
}

export interface EpochLoreTargetAdjudicationProvenance {
  readonly receiptType: "lore_target_adjudication_provenance";
  readonly adjudicationEventId?: string;
  readonly previousAdjudicationId?: string;
  readonly newAdjudicationId?: string;
  readonly targetId: string;
  readonly sourceContributionEventIds: readonly string[];
  readonly sourceContributionEventCount: number;
  readonly sourceAgentIds: readonly string[];
  readonly sourceTrustClasses: readonly EpochTrustClass[];
  readonly sourceContributions: readonly EpochLoreContributionEvidenceProvenance[];
  readonly evidenceHash: `sha256:${string}`;
  readonly adjudicatedAt: string;
}

export const EPOCH_PARTY_ROLES = [
  "leader",
  "vanguard",
  "scout",
  "support",
  "scribe",
] as const;

export type EpochPartyRole = typeof EPOCH_PARTY_ROLES[number];

export const EPOCH_PARTY_RUN_JOIN_POLICIES = ["open", "invite_only"] as const;

export type EpochPartyRunJoinPolicy = typeof EPOCH_PARTY_RUN_JOIN_POLICIES[number];

export const EPOCH_ANOMALY_SEVERITIES = ["minor", "major", "cataclysm"] as const;

export type EpochAnomalySeverity = typeof EPOCH_ANOMALY_SEVERITIES[number];

export const EPOCH_ANOMALY_OUTCOMES = ["contained", "escaped"] as const;

export type EpochAnomalyOutcome = typeof EPOCH_ANOMALY_OUTCOMES[number];

export const EPOCH_ORGANIZATION_BUDGET_STATUSES = ["proposed", "approved", "rejected"] as const;

export type EpochOrganizationBudgetStatus = typeof EPOCH_ORGANIZATION_BUDGET_STATUSES[number];

export const EPOCH_ORGANIZATION_BUDGET_RESOLUTIONS = ["approved", "rejected"] as const;

export type EpochOrganizationBudgetResolution = typeof EPOCH_ORGANIZATION_BUDGET_RESOLUTIONS[number];

export interface EpochAnomalyMedia {
  readonly variantLabel: string;
  readonly scenePrompt: string;
  readonly palette: readonly string[];
  readonly accentColor: string;
  readonly dangerColor: string;
  readonly sigil: string;
  readonly publicAlt: string;
  readonly assetPath?: string;
  readonly imageUrl?: string;
  readonly imageSha256?: string;
}

export const EPOCH_RESOURCE_IDS = [
  "coin",
  "aether",
  "stamina",
  "focus",
  "legend",
] as const;

export type EpochResourceId = typeof EPOCH_RESOURCE_IDS[number];

export const EPOCH_OBJECTIVE_MODES = ["contribution", "race"] as const;

export type EpochObjectiveMode = typeof EPOCH_OBJECTIVE_MODES[number];

export const EPOCH_MARKET_TRADE_RISK_FLAGS = [
  "repeat_counterparty_trade",
  "suspicious_low_price",
  "suspicious_high_price",
] as const;

export type EpochMarketTradeRiskFlag = typeof EPOCH_MARKET_TRADE_RISK_FLAGS[number];

export const EPOCH_DOWNTIME_MODES = [
  "meditation",
  "cultivation",
  "training",
  "resting",
  "slacking",
  "travel",
  "steward",
  "socialize",
] as const;

export type EpochDowntimeMode = typeof EPOCH_DOWNTIME_MODES[number];

export const EPOCH_IDENTITY_STATUSES = ["active", "archived"] as const;

export type EpochIdentityStatus = typeof EPOCH_IDENTITY_STATUSES[number];

export const EPOCH_RELATIONSHIP_KINDS = [
  "alliance",
  "hostility",
  "reputation",
] as const;

export type EpochRelationshipKind = typeof EPOCH_RELATIONSHIP_KINDS[number];

export const EPOCH_DIPLOMACY_RESPONSES = [
  "accepted",
  "rejected",
] as const;

export type EpochDiplomacyResponse = typeof EPOCH_DIPLOMACY_RESPONSES[number];

export const EPOCH_ORGANIZATION_POLITICS_KINDS = [
  "promotion",
  "patronage",
  "rivalry",
  "scandal",
  "reform",
] as const;

export type EpochOrganizationPoliticsKind = typeof EPOCH_ORGANIZATION_POLITICS_KINDS[number];

export const EPOCH_NPC_RELATIONSHIP_KINDS = [
  "spouse",
  "parent",
  "child",
  "relative",
  "friend",
  "enemy",
  "superior",
  "subordinate",
  "mentor",
  "apprentice",
  "creditor",
  "debtor",
] as const;

export type EpochNpcRelationshipKind = typeof EPOCH_NPC_RELATIONSHIP_KINDS[number];

export const EPOCH_NPC_MEMORY_IMPORTANCE = [
  "low",
  "medium",
  "high",
] as const;

export type EpochNpcMemoryImportance = typeof EPOCH_NPC_MEMORY_IMPORTANCE[number];

export const EPOCH_MESSAGE_SCOPES = ["world", "region"] as const;

export type EpochMessageScope = typeof EPOCH_MESSAGE_SCOPES[number];

export const EPOCH_MODERATION_SUBJECT_TYPES = ["message", "region_news"] as const;

export type EpochModerationSubjectType = typeof EPOCH_MODERATION_SUBJECT_TYPES[number];

export const EPOCH_MODERATION_STATUSES = ["visible", "queued", "hidden"] as const;

export type EpochContentModerationStatus = typeof EPOCH_MODERATION_STATUSES[number];

export const EPOCH_MODERATION_RESOLUTIONS = ["approved", "hidden", "rejected", "converted_to_rumor"] as const;

export type EpochModerationResolution = typeof EPOCH_MODERATION_RESOLUTIONS[number];

export const EPOCH_RISK_REVIEW_RESOLUTIONS = ["cleared", "watchlisted", "escalated"] as const;

export type EpochRiskReviewResolution = typeof EPOCH_RISK_REVIEW_RESOLUTIONS[number];

export const EPOCH_LORE_CONTRIBUTION_CATEGORIES = ["confirmation", "refutation", "revision"] as const;

export type EpochLoreContributionCategory = typeof EPOCH_LORE_CONTRIBUTION_CATEGORIES[number];

export const EPOCH_LORE_REVISION_MODES = ["suggestion", "derived", "merge", "downgrade"] as const;

export type EpochLoreRevisionMode = typeof EPOCH_LORE_REVISION_MODES[number];

export type EpochLoreRevisionClaimTextEffect = "proposal_only" | "derived_version";

export interface EpochLoreRevisionPolicy {
  readonly mode: EpochLoreRevisionMode;
  readonly allowedRevisionModes: readonly EpochLoreRevisionMode[];
  readonly originalClaimMutable: false;
  readonly claimTextEffect: EpochLoreRevisionClaimTextEffect;
  readonly requiresReview: true;
  readonly originalClaimExplorerId?: string;
  readonly parentClaimId?: string;
  readonly mergeTargetIds?: readonly string[];
  readonly downgradeReason?: string;
}

export const EPOCH_LORE_ADJUDICATION_STATUSES = ["confirmed", "refuted", "revised", "contested"] as const;

export type EpochLoreAdjudicationStatus = typeof EPOCH_LORE_ADJUDICATION_STATUSES[number];

export type EpochIdKind = "event" | "agent" | "personality_drift" | "npc" | "npc_candidate" | "news" | "page" | "objective" | "race_completion" | "resource_node" | "anomaly" | "order" | "direct_trade" | "bounty" | "party_run" | "party_join_request" | "raid" | "region_revolt" | "retaliation" | "relationship" | "diplomacy" | "turn_card" | "npc_relationship" | "agent_npc_bond" | "npc_memory" | "household" | "organization" | "organization_membership" | "organization_politics" | "npc_career" | "npc_location" | "npc_asset" | "npc_health" | "item" | "social_hook" | "season" | "season_objective" | "faction_standing" | "region_influence" | "region_control_decay" | "region_control_release" | "trace" | "monument" | "session" | "action" | "server_hosted_job" | "attestation" | "message" | "legend_award" | "moderation" | "risk_review" | "risk_restriction_release" | "abuse_release" | "abuse_decay" | "challenge" | "confirmation" | "confirm_token" | "lore_contribution" | "lore_adjudication" | "command" | "correlation";

export type EpochIdFactory = (kind: EpochIdKind, seed?: string) => string;

export type EpochClock = () => Date;

export interface EpochCommandContext {
  readonly actorExplorerId: string;
  readonly trustClass?: EpochTrustClass;
  readonly causationId?: string;
  readonly correlationId?: string;
  readonly idempotencyKey?: string;
}

export interface EpochLifetimeState {
  readonly max: number;
  readonly remaining: number;
  readonly startedAt: string;
  readonly archivedAt?: string;
  readonly finalTitle?: string;
}

export interface EpochLineageInheritance {
  readonly legendEcho: number;
  readonly knownRegions: readonly string[];
  readonly scar?: string;
}

export interface EpochResourceDelta {
  readonly resourceId: EpochResourceId;
  readonly amount: number;
}

export interface EpochServerReward {
  readonly resourceId: EpochResourceId;
  readonly amount: number;
  readonly reason: string;
}

export function createSequentialEpochIdFactory(
  prefix = "epoch",
  existingIds: readonly string[] = [],
): EpochIdFactory {
  const counters = new Map<string, number>();
  const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const sequentialIdPattern = new RegExp(`^${escapedPrefix}_(.+)_([0-9]+)$`);
  for (const existingId of existingIds) {
    const match = sequentialIdPattern.exec(existingId);
    if (!match) continue;
    const kind = match[1];
    const value = Number(match[2]);
    if (!Number.isSafeInteger(value)) continue;
    counters.set(kind, Math.max(counters.get(kind) || 0, value));
  }
  return (kind: EpochIdKind, seed?: string) => {
    const current = (counters.get(kind) || 0) + 1;
    counters.set(kind, current);
    const stableSeed = seed ? stableFullKey(seed) : "";
    const suffix = seed
      ? `_${stableSeed.slice(0, 40)}_${stableHash(stableSeed)}`
      : `_${String(current).padStart(6, "0")}`;
    return `${prefix}_${kind}${suffix}`;
  };
}

function stableFullKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFKC")
    .replace(/\s+/g, "_")
    .replace(/[^\p{Letter}\p{Number}_-]+/gu, "");
}

function stableHash(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36).padStart(7, "0");
}

export function isEpochTrustClass(value: unknown): value is EpochTrustClass {
  return typeof value === "string" && EPOCH_TRUST_CLASSES.includes(value as EpochTrustClass);
}

export function normalizeTrustClass(value: unknown): EpochTrustClass {
  return isEpochTrustClass(value) ? value : "untrusted_client";
}

export function sourceAuthorityForTrustClass(value: unknown): EpochSourceAuthority {
  const trustClass = normalizeTrustClass(value);
  if (trustClass === "system_worker") return "core";
  if (trustClass === "untrusted_client") return "low-confidence";
  return "official";
}

export function isEpochEventType(value: unknown): value is EpochEventType {
  return typeof value === "string" && EPOCH_EVENT_TYPES.includes(value as EpochEventType);
}

export function assertNonEmptyString(value: unknown, name: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${name}_required`);
  }
  return value.trim();
}

export function assertPositiveInteger(value: unknown, name: string): number {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(numeric) || numeric <= 0) {
    throw new Error(`${name}_positive_integer_required`);
  }
  return numeric;
}

export function assertFiniteInteger(value: unknown, name: string): number {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(numeric) || !Number.isFinite(numeric)) {
    throw new Error(`${name}_integer_required`);
  }
  return numeric;
}

export function assertDowntimeMode(value: unknown): EpochDowntimeMode {
  if (typeof value !== "string" || !EPOCH_DOWNTIME_MODES.includes(value as EpochDowntimeMode)) {
    throw new Error("downtime_mode_invalid");
  }
  return value as EpochDowntimeMode;
}

export function assertResourceId(value: unknown): EpochResourceId {
  if (typeof value !== "string" || !EPOCH_RESOURCE_IDS.includes(value as EpochResourceId)) {
    throw new Error("resource_id_invalid");
  }
  return value as EpochResourceId;
}

export function assertRelationshipKind(value: unknown): EpochRelationshipKind {
  if (typeof value !== "string" || !EPOCH_RELATIONSHIP_KINDS.includes(value as EpochRelationshipKind)) {
    throw new Error("relationship_kind_invalid");
  }
  return value as EpochRelationshipKind;
}

export function assertDiplomacyResponse(value: unknown): EpochDiplomacyResponse {
  if (typeof value !== "string" || !EPOCH_DIPLOMACY_RESPONSES.includes(value as EpochDiplomacyResponse)) {
    throw new Error("diplomacy_response_invalid");
  }
  return value as EpochDiplomacyResponse;
}

export function assertNpcRelationshipKind(value: unknown): EpochNpcRelationshipKind {
  if (typeof value !== "string" || !EPOCH_NPC_RELATIONSHIP_KINDS.includes(value as EpochNpcRelationshipKind)) {
    throw new Error("npc_relationship_kind_invalid");
  }
  return value as EpochNpcRelationshipKind;
}

export function assertNpcMemoryImportance(value: unknown): EpochNpcMemoryImportance {
  if (typeof value !== "string" || !EPOCH_NPC_MEMORY_IMPORTANCE.includes(value as EpochNpcMemoryImportance)) {
    throw new Error("npc_memory_importance_invalid");
  }
  return value as EpochNpcMemoryImportance;
}

export function assertMessageScope(value: unknown): EpochMessageScope {
  if (typeof value !== "string" || !EPOCH_MESSAGE_SCOPES.includes(value as EpochMessageScope)) {
    throw new Error("message_scope_invalid");
  }
  return value as EpochMessageScope;
}

export function assertModerationResolution(value: unknown): EpochModerationResolution {
  if (typeof value !== "string" || !EPOCH_MODERATION_RESOLUTIONS.includes(value as EpochModerationResolution)) {
    throw new Error("moderation_resolution_invalid");
  }
  return value as EpochModerationResolution;
}

export function assertRiskReviewResolution(value: unknown): EpochRiskReviewResolution {
  if (typeof value !== "string" || !EPOCH_RISK_REVIEW_RESOLUTIONS.includes(value as EpochRiskReviewResolution)) {
    throw new Error("risk_review_resolution_invalid");
  }
  return value as EpochRiskReviewResolution;
}

export function stableKey(value: string): string {
  return stableFullKey(value).slice(0, 80);
}

export function serverIsoTime(clock: EpochClock): string {
  return clock().toISOString();
}
