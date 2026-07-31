export type Confidence = "high" | "medium" | "low";
export type Threat = "S" | "A" | "B" | "C" | "D" | "E" | "未知";
export type RankRole = "世界级" | "首领" | "头目" | "精英" | "普通" | "未知" | string;
export type OverlayMode = "ecology" | "faction" | "conflict";
export type LayerMode = "expanded" | "stacked" | "single";
export type ImageFilter = "all" | "ready" | "hasImage" | "missing";

export interface SourceStats {
  creatureUnits: number;
  legacyCreatures: number;
  worldSystems: number;
  races: number;
  places: number;
  factions: number;
  regions: number;
  habitats: number;
  entities: number;
  routes: number;
  assets: number;
}

export interface Layer {
  id: string;
  label: string;
  elevation: number;
  order: number;
  color: string;
  summary: string;
}

export interface Region {
  id: string;
  label: string;
  layer: string;
  position: [number, number, number];
  radius: number;
  terrain: string;
  confidence: Confidence;
  placementReason: string;
  sourcePath: string;
  summary: string;
  entityCount?: number;
  dominantThreat?: Threat;
}

export interface Habitat {
  id: string;
  label: string;
  layer: string;
  region: string;
  position: [number, number, number];
  entityCount: number;
  dominantThreat: Threat;
  dominantRankRole: RankRole;
  confidence: Confidence;
  placementReason: string;
  entities: string[];
}

export interface EntityDetails {
  summary?: string;
  serial?: string;
  seed_id?: string;
  source?: string;
  type?: string;
  base?: string[];
  habitat?: string;
  threat?: Threat;
  rank_role?: RankRole;
  alignment?: string;
  visual_tendency?: string;
  visual_style?: string;
  weakness?: string;
  status?: string;
  image_ready?: boolean;
  relation?: string;
  appearance?: string;
  ability?: string;
  behavior?: string;
  resources?: string;
}

export interface GalleryItem {
  label: string;
  image: string;
}

export interface Entity {
  id: string;
  label: string;
  kind: "place" | "world" | "race" | "faction" | "creature" | string;
  sourceKind: string;
  layer: string;
  region: string;
  habitat: string;
  position: [number, number, number];
  overlayRoles: OverlayMode[];
  confidence: Confidence;
  placementReason: string;
  sourcePath: string;
  details: EntityDetails;
  nodeImage?: string;
  panelImage?: string;
  cardImage?: string;
  gallery?: GalleryItem[];
  links?: string[];
  searchText?: string;
}

export interface Route {
  id: string;
  label: string;
  mode: string;
  kind: string;
  points: string[];
  endpointLabels: string[];
  confidence: Confidence;
  sourcePath: string;
  summary?: string;
}

export interface AssetManifestItem {
  sourcePath: string;
  targetPath: string;
}

export interface WorldMapData {
  schemaVersion: number;
  generatedAt: string;
  sourceStats: SourceStats;
  layers: Layer[];
  regions: Region[];
  habitats: Habitat[];
  entities: Entity[];
  routes: Route[];
  assetManifest?: AssetManifestItem[];
}

export interface WorldIndexes {
  layerById: Map<string, Layer>;
  regionById: Map<string, Region>;
  habitatById: Map<string, Habitat>;
  entityById: Map<string, Entity>;
  routeById: Map<string, Route>;
  entitiesByLayer: Map<string, Entity[]>;
  entitiesByRegion: Map<string, Entity[]>;
  entitiesByHabitat: Map<string, Entity[]>;
  placeByRegion: Map<string, Entity>;
}

export interface ViewState {
  overlayMode: OverlayMode;
  layerMode: LayerMode;
  activeLayer: string;
  hiddenLayers: Set<string>;
  query: string;
  threat: Threat | "all";
  rank: RankRole | "all";
  confidence: Confidence | "all";
  image: ImageFilter;
}

export interface VisibleWorld {
  visibleEntities: Entity[];
  visibleRegions: Region[];
  visibleRoutes: Route[];
  visibleLayers: Layer[];
  visibleEntityIds: Set<string>;
  visibleRegionIds: Set<string>;
}

export interface SelectedEntity {
  type: "entity";
  data: Entity;
}

export interface SelectedRoute {
  type: "route";
  data: Route;
}

export type SelectedItem = SelectedEntity | SelectedRoute | null;

export interface ExplorerPreferences {
  lowStimulusMode?: boolean;
}

export interface ExplorerIdentity {
  explorerId: string;
  displayName: string;
  localSecret: string;
  recoveryCode: string;
  createdAt: string;
  preferences?: ExplorerPreferences;
}

export type SchemaUnknown = "unknown";

export interface AgentWorldSummary {
  archiveRuns: number | SchemaUnknown;
  canonicalClaims: number | SchemaUnknown;
  disputedClaims: number | SchemaUnknown;
  openConflicts: number | SchemaUnknown;
  acceptedFactions: number | SchemaUnknown;
}

export interface AgentPublicWorld {
  summary: AgentWorldSummary;
  claims: unknown[];
  conflicts: unknown[];
  factions: unknown[];
  archive: unknown[];
  claimDetails: Record<string, unknown> | null;
  conflictDetails: Record<string, unknown> | null;
  factionDetails: Record<string, unknown> | null;
  sourceGraph: {
    nodes: unknown[];
    edges: unknown[];
    status?: "present" | SchemaUnknown;
  };
}

export interface EpochWorldOverviewRegionHighlight {
  regionId: string;
  worldScene?: EpochWorldSceneMedia;
  newsCount: number;
  messageCount: number;
  leaderAgentId?: string;
  leaderExplorerId?: string;
  publicPages: {
    region: string;
  };
}

export type EpochGameRunStatus =
  | "draft"
  | "running"
  | "settling"
  | "settled"
  | "published"
  | "archived";

export interface EpochGameRunAct {
  actIndex: number;
  title: string;
  summary: string;
  startedAt?: string;
  settledAt?: string;
  sourceKind: "journey_step" | "turn_card" | "hosted_action" | "event" | "snapshot";
  sourceId?: string;
  auditUrl?: string;
}

export interface EpochGameRunOutcome {
  summary: string;
  endingReason: EpochResultPageRunEndingReason;
  settledAt?: string;
}

export interface EpochGameRunReadModel {
  runId: string;
  agentId?: string;
  explorerId?: string;
  title: string;
  status: EpochGameRunStatus;
  startedAt: string;
  settledAt?: string;
  publishedAt?: string;
  stepCount: number;
  acts: readonly EpochGameRunAct[];
  finalOutcome?: EpochGameRunOutcome;
}

export interface EpochWorldOverviewRecentResult {
  pageId: string;
  createdAt: string;
  expiresAt?: string;
  urlPath: string;
  createdBy: string;
  agentId?: string;
  explorerId?: string;
  identityName?: string;
  publicSafeSummary?: EpochPublicSafeSummary;
  receiptHash: string;
  receiptFocus: EpochResultPageReceipt["focus"];
  canonicalEventCount: number;
  run?: EpochGameRunReadModel;
}

export interface EpochWorldOverviewLegendaryDeath {
  eventId: string;
  agentId: string;
  explorerId?: string;
  finalTitle?: string;
  archiveReason?: string;
  archivedAt: string;
  publicPages: {
    archive: string;
    audit: string;
  };
}

export type EpochWorldHonorCategory =
  | "exploration"
  | "confirmation"
  | "refutation"
  | "revision"
  | "high_risk_survival"
  | "low_risk_stability";

export interface EpochWorldHonorBoardEntry {
  agentId: string;
  explorerId?: string;
  identityName?: string;
  score: number;
  latestEventId?: string;
  latestEventType?: EpochEventType;
  latestAt?: string;
  publicPages: {
    agent: string;
    explorer?: string;
  };
}

export interface EpochWorldHonorBoard {
  category: EpochWorldHonorCategory;
  title: string;
  description: string;
  entries: readonly EpochWorldHonorBoardEntry[];
}

export type EpochLoreContributionCategory = "confirmation" | "refutation" | "revision";
export type EpochSourceAuthority = "core" | "official" | "derived" | "low-confidence";
export type EpochLoreAuthorityEvidenceQuality = "weak" | "mixed" | "strong";

export interface EpochLoreAuthorityReview {
  sourceAuthorities: readonly EpochSourceAuthority[];
  highAuthoritySourceEventIds: readonly string[];
  lowAuthoritySourceEventIds: readonly string[];
  evidenceQuality: EpochLoreAuthorityEvidenceQuality;
  canHardRefute: boolean;
  refutationStatus: "hard_refutation_allowed" | "review_required";
  oldestSourceRecordedAt?: string;
  latestSourceRecordedAt?: string;
  reason: string;
}

export interface EpochLoreSourceEventProvenance {
  eventId: string;
  eventType: EpochEventType;
  aggregateType: string;
  aggregateId: string;
  agentId?: string;
  actorExplorerId: string;
  trustClass: EpochDeliveryTrust;
  sourceAuthority: EpochSourceAuthority;
  createdAt: string;
  publicPages: {
    audit: string;
  };
}

export interface EpochLoreContributionProvenance {
  receiptType: "lore_contribution_provenance";
  contributionEventId?: string;
  targetId: string;
  sourceEventIds: readonly string[];
  sourceEventCount: number;
  sourceEventTypes: readonly EpochEventType[];
  sourceAgentIds: readonly string[];
  sourceAggregateIds: readonly string[];
  sourceTrustClasses: readonly EpochDeliveryTrust[];
  sourceEvents: readonly EpochLoreSourceEventProvenance[];
  evidenceHash: `sha256:${string}`;
  recordedAt: string;
}

export interface EpochLoreContributionEvidenceProvenance {
  eventId: string;
  contributionId: string;
  category: EpochLoreContributionCategory;
  agentId: string;
  targetId: string;
  trustClass: EpochDeliveryTrust;
  sourceAuthority: EpochSourceAuthority;
  recordedAt: string;
  evidenceHash: `sha256:${string}`;
  publicPages: {
    audit: string;
  };
}

export interface EpochLoreTargetAdjudicationProvenance {
  receiptType: "lore_target_adjudication_provenance";
  adjudicationEventId?: string;
  targetId: string;
  sourceContributionEventIds: readonly string[];
  sourceContributionEventCount: number;
  sourceAgentIds: readonly string[];
  sourceTrustClasses: readonly EpochDeliveryTrust[];
  sourceContributions: readonly EpochLoreContributionEvidenceProvenance[];
  evidenceHash: `sha256:${string}`;
  adjudicatedAt: string;
}

export interface EpochCanonAdoptionAttributionSourceContribution {
  contributionEventId: string;
  contributionId: string;
  agentId: string;
  explorerId: string;
  targetId: string;
  publicPages: {
    audit: string;
  };
}

export interface EpochCanonAdoptionAttributionSourceReport {
  eventId: string;
  eventType: EpochEventType;
  agentId?: string;
  explorerId?: string;
  publicPages: {
    audit: string;
  };
}

export interface EpochCanonAdoptionAttribution {
  sourceContributionEventIds: readonly string[];
  sourceReportEventIds: readonly string[];
  sourceAgentIds: readonly string[];
  sourceExplorerIds: readonly string[];
  sourceContributions: readonly EpochCanonAdoptionAttributionSourceContribution[];
  sourceReports: readonly EpochCanonAdoptionAttributionSourceReport[];
}

export interface EpochCanonCandidatePath {
  requested: true;
  status: "candidate";
  chapterReviewId: string;
  curatorApprovedBy: string;
  migrationSummary: string;
  adoptedText?: string;
  boundaryNote?: string;
  attribution: EpochCanonAdoptionAttribution;
  reason: string;
}

export type EpochCreatureBehaviorScope = "local" | "regional" | "cross_region" | "world";
export type EpochCreatureBehaviorScopeReviewStatus = "within_limit" | "explained_exception";
export type EpochCreatureBehaviorScopeExplanation = "external_pollution" | "group_event" | "higher_entity";

export interface EpochCreatureBehaviorScopeReview {
  subjectType: "creature_behavior";
  threat: string;
  rankRole: string;
  claimedScope: EpochCreatureBehaviorScope;
  allowedScope: EpochCreatureBehaviorScope;
  status: EpochCreatureBehaviorScopeReviewStatus;
  explanation?: EpochCreatureBehaviorScopeExplanation;
  reason: string;
}

export type EpochFuzzyTimeCongestionLevel = "low" | "medium" | "high";

export interface EpochFuzzyTimeIntervalReview {
  subjectType: "fuzzy_time";
  expression: string;
  intervalStartYear: number;
  intervalEndYear: number;
  occupancyWeight: number;
  overlapCount: number;
  congestionLevel: EpochFuzzyTimeCongestionLevel;
  reason: string;
}

export type EpochCrossRegionMechanismTier = "basic" | "high";
export type EpochCrossRegionMechanismKind = "dream_rift" | "rift" | "old_god_whisper" | "route" | "unknown";
export type EpochCrossRegionMechanismSupport = "chapter_permission" | "route_support" | "explicit_explanation";

export interface EpochCrossRegionMechanismReview {
  subjectType: "cross_region_mechanism";
  tier: EpochCrossRegionMechanismTier;
  mechanism: EpochCrossRegionMechanismKind;
  fromRegionId?: string;
  toRegionId?: string;
  support: EpochCrossRegionMechanismSupport;
  status: "supported";
  reason: string;
}

export interface EpochLoreContributionRecord {
  contributionId: string;
  claimId: string;
  claimType: EpochLoreContributionCategory;
  claimText: string;
  claimHash: `sha256:${string}`;
  category: EpochLoreContributionCategory;
  agentId: string;
  explorerId: string;
  targetId: string;
  summary: string;
  sourceEventIds: readonly string[];
  provenance: EpochLoreContributionProvenance;
  creatureBehaviorScopeReview?: EpochCreatureBehaviorScopeReview;
  fuzzyTimeIntervalReview?: EpochFuzzyTimeIntervalReview;
  crossRegionMechanismReview?: EpochCrossRegionMechanismReview;
  cost?: {
    resourceId: EpochResourceId;
    amount: number;
    reason: string;
  };
  recordedAt: string;
}

export interface EpochLoreContributionInfo extends EpochLoreContributionRecord {
  eventId: string;
  trustClass: EpochDeliveryTrust;
  identityName?: string;
  publicPages: {
    agent: string;
    explorer?: string;
    audit: string;
  };
}

export interface EpochLoreContributionsInfo {
  agentId?: string;
  category?: EpochLoreContributionCategory;
  targetId?: string;
  total: number;
  contributions: readonly EpochLoreContributionInfo[];
  publicPages: {
    world: string;
  };
}

export type EpochLoreTargetStatus = "confirmed" | "refuted" | "revised" | "contested";
export type EpochLoreTargetStatusSource = "contribution_evidence" | "system_adjudication";
export type EpochDisputeArchiveGateStatus =
  | "eligible"
  | "rejected_missing_bilateral_evidence"
  | "rejected_untestable"
  | "rejected_core_canon_hard_conflict";

export interface EpochDisputeArchiveGate {
  status: EpochDisputeArchiveGateStatus;
  bilateralEvidence: boolean;
  futureTestable: boolean;
  coreCanonHardConflict: boolean;
  reason: string;
}

export type EpochWorldviewGateScope = "mvp_minimum";
export type EpochWorldviewGateDeferredRuleSet = "phase_two";
export type EpochWorldviewGateCheckKey =
  | "layer_label"
  | "secret_tier"
  | "anchor_integrity"
  | "core_vibe"
  | "duplicate_or_conflict"
  | "rumor_floor";
export type EpochWorldviewGateCheckStatus = "passed" | "flagged" | "needs_review";

export interface EpochWorldviewGateCheck {
  key: EpochWorldviewGateCheckKey;
  label: string;
  status: EpochWorldviewGateCheckStatus;
  enforced: true;
  reason: string;
}

export interface EpochWorldviewGate {
  scope: EpochWorldviewGateScope;
  deferredRuleSet: EpochWorldviewGateDeferredRuleSet;
  enforcedCheckKeys: readonly EpochWorldviewGateCheckKey[];
  checks: readonly EpochWorldviewGateCheck[];
  summary: string;
}

export interface EpochLoreTargetStatusCounts {
  confirmation: number;
  refutation: number;
  revision: number;
  total: number;
}

export interface EpochLoreTargetAdjudicationRecord {
  adjudicationId: string;
  targetId: string;
  status: EpochLoreTargetStatus;
  summary: string;
  sourceContributionEventIds: readonly string[];
  provenance: EpochLoreTargetAdjudicationProvenance;
  canonCandidate?: EpochCanonCandidatePath;
  authorityReview?: EpochLoreAuthorityReview;
  operatorId: string;
  adjudicatedAt: string;
}

export interface EpochLoreTargetAdjudicationInfo extends EpochLoreTargetAdjudicationRecord {
  eventId: string;
  trustClass: EpochDeliveryTrust;
  publicPages: {
    audit: string;
  };
}

export interface EpochLoreTargetStatusInfo {
  targetId: string;
  status: EpochLoreTargetStatus;
  statusSource: EpochLoreTargetStatusSource;
  counts: EpochLoreTargetStatusCounts;
  contributingAgentIds: readonly string[];
  contributingExplorerIds: readonly string[];
  sourceEventIds: readonly string[];
  latestContribution: EpochLoreContributionInfo;
  latestAdjudication?: EpochLoreTargetAdjudicationInfo;
  disputeArchiveGate?: EpochDisputeArchiveGate;
  worldviewGate: EpochWorldviewGate;
  publicPages: {
    audit: string;
  };
}

export type EpochPersonalMigrationDisposition =
  | "retained"
  | "downgraded"
  | "needs_evidence"
  | "adopted"
  | "sealed";

export interface EpochPersonalMigrationSummaryItem {
  disposition: EpochPersonalMigrationDisposition;
  targetId: string;
  status: EpochLoreTargetStatus;
  summary: string;
  reason: string;
  contributingAgentIds: readonly string[];
  contributingExplorerIds: readonly string[];
  sourceEventIds: readonly string[];
  latestContribution: EpochLoreContributionInfo;
  latestAdjudication?: EpochLoreTargetAdjudicationInfo;
  canonCandidate?: EpochCanonCandidatePath;
  publicPages: {
    audit: string;
  };
}

export interface EpochPersonalMigrationSummary {
  agentId?: string;
  explorerId?: string;
  totals: Record<EpochPersonalMigrationDisposition, number>;
  retained: readonly EpochPersonalMigrationSummaryItem[];
  downgraded: readonly EpochPersonalMigrationSummaryItem[];
  needsEvidence: readonly EpochPersonalMigrationSummaryItem[];
  adopted: readonly EpochPersonalMigrationSummaryItem[];
  sealed: readonly EpochPersonalMigrationSummaryItem[];
}

export interface EpochLoreTargetsInfo {
  targetId?: string;
  status?: EpochLoreTargetStatus;
  total: number;
  targets: readonly EpochLoreTargetStatusInfo[];
  publicPages: {
    world: string;
  };
}

export interface EpochWorldContextVersions {
  worldVersion: string;
  sharedLoreSnapshotVersion: string;
  adjudicatorVersion: string;
  contextPackVersion: string;
}

export interface AgentWorldContextSettingCard {
  cardId: string;
  version: string;
  category: string;
  selectionReason: string;
  weight: number;
  exposureLevel: "high" | "medium" | "low";
  sourceAuthority: EpochSourceAuthority;
  publicSummary: string;
  filteringReasons: readonly string[];
}

export interface AgentWorldContextSnapshot {
  snapshotId: string;
  contextVersion: string;
  versions: EpochWorldContextVersions;
  authorityPolicy: {
    levels: readonly EpochSourceAuthority[];
    hardRefutationAllowed: readonly EpochSourceAuthority[];
    hardRefutationForbidden: readonly EpochSourceAuthority[];
  };
  settingCards: readonly AgentWorldContextSettingCard[];
}

export interface AgentWorldContextPackage extends EpochWorldContextVersions {
  loopMode: "legacy_authored_report";
  contextVersion: string;
  versions: EpochWorldContextVersions;
  explorerId: string;
  agent: {
    agentId: string;
    name: string;
    temperament: readonly string[];
    riskPolicy: string;
    knownPlaces: readonly string[];
    traits: readonly string[];
    externalItems: readonly string[];
  };
  mandate: string;
  anchors: readonly unknown[];
  publicWorldBrief: readonly string[];
  publicRules: {
    modelAccess: string;
    credentialHandling: string;
    runTranscript: string;
    clientScore: string;
    demoWorldImpact: string;
  };
  authorization: {
    lowRisk: string;
    mediumRisk: string;
    highRisk: string;
    forbidden: readonly string[];
  };
  outputContract: {
    events: string;
    ending: string;
    candidateClaims: string;
  };
  canonicalProgress: {
    preferredTools: readonly string[];
    warning: string;
  };
  contextSnapshot?: AgentWorldContextSnapshot;
}

export interface EpochWorldOverviewInfo extends EpochWorldContextVersions {
  generatedAt: string;
  totals: {
    identities: number;
    activeIdentities: number;
    archivedIdentities: number;
    regionsWithNews: number;
    resultPages: number;
  };
  publicPages: {
    world: string;
    install: string;
    console: string;
  };
  news: readonly EpochRegionNews[];
  recentResults: readonly EpochWorldOverviewRecentResult[];
  legendaryDeaths: readonly EpochWorldOverviewLegendaryDeath[];
  honorBoards: readonly EpochWorldHonorBoard[];
  recentLoreContributions: readonly EpochLoreContributionInfo[];
  loreTargetStatuses: readonly EpochLoreTargetStatusInfo[];
  activeSeasons: readonly EpochSeasonCampaign[];
  regionHighlights: readonly EpochWorldOverviewRegionHighlight[];
}

export type EpochResourceId = "coin" | "aether" | "stamina" | "focus" | "legend";
export type EpochDowntimeMode = "meditation" | "cultivation" | "training" | "resting" | "slacking" | "travel" | "steward" | "socialize";
export type EpochIdentityStatus = "active" | "archived";
export type EpochEventType =
  | "identity_issued"
  | "explorer_recovery_rotated"
  | "lifetime_adjusted"
  | "identity_archived"
  | "reincarnation_issued"
  | "resource_granted"
  | "resource_spent"
  | "downtime_set"
  | "downtime_tick_resolved"
  | "downtime_claimed"
  | "npc_candidate_submitted"
  | "npc_candidate_reviewed"
  | "npc_canonicalized"
  | "npc_lifecycle_recorded"
  | "npc_relationship_recorded"
  | "npc_memory_recorded"
  | "npc_household_recorded"
  | "organization_membership_changed"
  | "organization_politics_recorded"
  | "organization_prestige_changed"
  | "organization_treasury_changed"
  | "organization_budget_proposed"
  | "organization_budget_vote_recorded"
  | "organization_budget_resolved"
  | "organization_upgrade_purchased"
  | "npc_career_changed"
  | "npc_location_changed"
  | "npc_asset_changed"
  | "npc_health_recorded"
  | "item_created"
  | "item_bound"
  | "social_hook_created"
  | "region_news_generated"
  | "contested_objective_created"
  | "contested_objective_contributed"
  | "contested_objective_settled"
  | "resource_node_spawned"
  | "resource_node_contested"
  | "resource_node_settled"
  | "anomaly_event_spawned"
  | "anomaly_event_contested"
  | "anomaly_event_resolved"
  | "market_order_created"
  | "market_order_filled"
  | "market_order_cancelled"
  | "market_order_expired"
  | "bounty_created"
  | "bounty_claimed"
  | "party_run_created"
  | "party_member_joined"
  | "party_run_settled"
  | "raid_resolved"
  | "region_revolt_resolved"
  | "retaliation_opportunity_created"
  | "retaliation_resolved"
  | "diplomacy_proposed"
  | "diplomacy_responded"
  | "relationship_updated"
  | "attestation_recorded"
  | "lore_contribution_recorded"
  | "lore_target_adjudicated"
  | "hosted_session_started"
  | "hosted_action_recorded"
  | "message_posted"
  | "legend_awarded"
  | "moderation_queued"
  | "moderation_resolved"
  | "risk_review_recorded"
  | "market_risk_restriction_released"
  | "command_rejected"
  | "abuse_score_changed"
  | "abuse_score_released"
  | "season_campaign_created"
  | "season_started"
  | "season_objective_created"
  | "season_contribution_recorded"
  | "season_objective_completed"
  | "season_campaign_resolved"
  | "season_resolved"
  | "journey_world_solidified"
  | "region_influence_changed"
  | "trace_created"
  | "region_control_changed"
  | "region_monument_built";

export type EpochMessageScope = "world" | "region";
export type EpochContentModerationStatus = "visible" | "queued" | "hidden";
export type EpochModerationSubjectType = "message" | "region_news";
export type EpochModerationItemStatus = "open" | "resolved";
export type EpochModerationResolution = "approved" | "hidden" | "rejected" | "converted_to_rumor";
export type EpochModerationSeverity = "low" | "medium" | "high";
export type EpochRiskReviewResolution = "cleared" | "watchlisted" | "escalated";

export interface EpochAgentIdentity {
  agentId: string;
  explorerId: string;
  identityName: string;
  generation: number;
  status: EpochIdentityStatus;
  previousAgentId?: string;
  nextAgentId?: string;
  inheritance?: {
    legendEcho: number;
    knownRegions: readonly string[];
    scar?: string;
  };
  lifetime: {
    max: number;
    remaining: number;
    startedAt: string;
    archivedAt?: string;
    finalTitle?: string;
  };
  personality: EpochAgentPersonality;
  createdAt: string;
}

export interface EpochAgentPersonality {
  traits: readonly string[];
  driftIds: readonly string[];
  updatedAt?: string;
  latestSourceEventId?: string;
}

export type EpochPersonalityDriftStatus = "proposed" | "confirmed";

export interface EpochPersonalityDrift {
  driftId: string;
  agentId: string;
  explorerId: string;
  sourceEventId: string;
  trigger: string;
  suggestedTrait: string;
  summary: string;
  status: EpochPersonalityDriftStatus;
  proposedAt: string;
  confirmedAt?: string;
  confirmedByExplorerId?: string;
}

export interface EpochIdentitySlotState {
  explorerId: string;
  active: number;
  max: number;
  available: number;
  legend: number;
  legendPerSlot: number;
  nextUnlockLegend?: number;
  legendToNextSlot: number;
  capped: boolean;
  entitlementBreakdown?: {
    legend: EpochIdentitySlotEntitlementEvidence;
    level: EpochIdentitySlotEntitlementEvidence;
    legacyAchievement: EpochIdentitySlotEntitlementEvidence;
    regionFactionRank: EpochIdentitySlotEntitlementEvidence;
    specialServerEvent: EpochIdentitySlotEntitlementEvidence;
    totalUnlockCount: number;
    appliedUnlockCount: number;
  };
}

export interface EpochIdentitySlotEntitlementEvidence {
  source: "legend" | "level" | "legacyAchievement" | "regionFactionRank" | "specialServerEvent";
  value: number;
  threshold: number;
  unlockCount: number;
  sourceEventIds: readonly string[];
}

export interface EpochRecoveryRotation {
  explorerId: string;
  rotated: boolean;
  newRecoveryRegistered: boolean;
  rotatedAt: string;
}

export interface EpochExplorerProfileSummary {
  totalIdentities: number;
  activeIdentities: number;
  archivedIdentities: number;
  totalLegend: number;
}

export interface EpochExplorerProfileInfo {
  explorerId: string;
  summary: EpochExplorerProfileSummary;
  identitySlots: EpochIdentitySlotState;
  totalResources: Partial<Record<EpochResourceId, number>>;
  identities: readonly EpochAgentIdentity[];
  activeIdentities: readonly EpochAgentIdentity[];
  archivedIdentities: readonly EpochAgentIdentity[];
  latestEvents: readonly EpochEvent[];
  publicPages: {
    explorer: string;
    agents: readonly string[];
    archives: readonly string[];
  };
}

export interface EpochEvent {
  eventId: string;
  eventType: EpochEventType;
  aggregateType: string;
  aggregateId: string;
  actorExplorerId: string;
  agentId?: string;
  trustClass: string;
  causationId: string;
  correlationId: string;
  idempotencyKey?: string;
  createdAt: string;
  payload: Record<string, unknown>;
}

export interface EpochAbuseStatus {
  actorKey: string;
  disabled: boolean;
  limit: number;
  windowMs: number;
  count: number;
  remaining: number;
  limited: boolean;
  resetAt?: string;
  abuseScore: number;
  abuseLevel: "clear" | "watch" | "restricted";
  latestAbuseEventId?: string;
}

export interface EpochAbuseScoreRelease {
  releaseId: string;
  actorKey: string;
  agentId?: string;
  explorerId?: string;
  previousScore: number;
  scoreAfter: number;
  sourceEventId?: string;
  releasedBy: string;
  releasedAt: string;
  note?: string;
}

export interface EpochAbuseProfile {
  actorKey: string;
  agentId?: string;
  explorerId?: string;
  score: number;
  abuseLevel: EpochAbuseStatus["abuseLevel"];
  updatedAt: string;
  latestEventId: string;
  sourceEventIds: readonly string[];
  reasons: Readonly<Record<string, number>>;
}

export interface EpochAbuseProfilesInfo {
  total: number;
  restricted: number;
  watch: number;
  clear: number;
  profiles: readonly EpochAbuseProfile[];
}

export interface EpochOperatorOverviewSummary {
  openModeration: number;
  restrictedAbuseProfiles: number;
  watchAbuseProfiles: number;
  marketRiskRestrictions: number;
  attestedRunnersConfigured: number;
  attestedRunnerRecentAttestations: number;
  npcCandidateWatch: number;
  npcCandidateBlocked: number;
  serverHostedJobsQueued: number;
  loreTargetsPendingAdjudication: number;
  riskEvents: number;
  recentAbuseReleases: number;
  maintenanceEvents: number;
}

export interface EpochLoreAdjudicationOverview {
  pending: number;
  adjudicated: number;
  pendingTargets: readonly EpochLoreTargetStatusInfo[];
}

export interface EpochNpcCandidateReviewOverview {
  watch: number;
  blocked: number;
  recent: readonly EpochNpcCandidate[];
}

export interface EpochAttestedRunnerOverviewItem {
  runnerId: string;
  label?: string;
  trustClass: "host_attested" | "remote_attested_runner";
  keyId: string;
  secretFingerprint: `sha256:${string}`;
  challengeTtlMs?: number;
  attestationCount: number;
  latestAttestationId?: string;
  latestVerifiedAt?: string;
}

export interface EpochAttestedRunnersOverview {
  total: number;
  configured: number;
  recentAttestations: number;
  runners: readonly EpochAttestedRunnerOverviewItem[];
}

export type EpochMaintenanceEventType =
  | "npc_lifecycle_recorded"
  | "organization_politics_recorded"
  | "organization_prestige_changed"
  | "organization_treasury_changed"
  | "organization_upgrade_purchased"
  | "resource_node_spawned"
  | "resource_node_settled"
  | "anomaly_event_spawned"
  | "season_campaign_created"
  | "season_campaign_resolved"
  | "market_order_expired"
  | "abuse_score_decayed"
  | "region_control_decayed"
  | "region_control_released"
  | "server_hosted_job_completed"
  | "server_hosted_job_skipped";

export interface EpochMaintenanceEventSummary {
  eventId: string;
  eventType: EpochMaintenanceEventType;
  aggregateId: string;
  agentId?: string;
  regionId?: string;
  subjectId: string;
  createdAt: string;
  publicPages: {
    audit: string;
  };
}

export interface EpochMaintenanceInfo {
  total: number;
  latestRanAt?: string;
  counts: {
    npcLifecycle: number;
    organizationPolitics: number;
    resourceNodeSpawned: number;
    resourceNodeSettled: number;
    anomalySpawned: number;
    seasonStarted: number;
    seasonSettled: number;
    marketExpired: number;
    abuseDecayed: number;
    regionControlDecayed: number;
    regionControlReleased: number;
    serverHostedJobsCompleted: number;
    serverHostedJobsSkipped: number;
  };
  health: EpochMaintenanceHealthInfo;
  recentEvents: readonly EpochMaintenanceEventSummary[];
}

export type EpochOperatorHealthStatus = "ok" | "attention" | "critical";
export type EpochMaintenanceWorkerHealthStatus = "ok" | "stale" | "missing";
export type EpochMaintenanceWorkerKey =
  | "npcLifecycle"
  | "organizationPolitics"
  | "marketExpiry"
  | "resourceNodeSpawn"
  | "resourceNodeSettle"
  | "anomalySpawn"
  | "seasonStart"
  | "seasonSettle"
  | "abuseDecay"
  | "regionControlDecay"
  | "serverHostedJob";

export interface EpochMaintenanceWorkerHealth {
  key: EpochMaintenanceWorkerKey;
  eventType: EpochMaintenanceEventType;
  status: EpochMaintenanceWorkerHealthStatus;
  stale: boolean;
  staleAfterHours: number;
  eventCount: number;
  latestRanAt?: string;
  latestEventId?: string;
}

export interface EpochMaintenanceHealthInfo {
  checkedAt: string;
  latestRanAt?: string;
  status: EpochOperatorHealthStatus;
  stale: boolean;
  staleAfterHours: number;
  attentionReasons: readonly string[];
  workers: Record<EpochMaintenanceWorkerKey, EpochMaintenanceWorkerHealth>;
}

export interface EpochMaintenanceRunSummary {
  tickId: string;
  ranAt: string;
  npc: {
    events: number;
  };
  organizationPolitics: {
    events: number;
  };
  market: {
    events: number;
  };
  abuse: {
    events: number;
    decayed: number;
  };
  regionControls: {
    events: number;
    decayed: number;
  };
  resourceNodes: {
    events: number;
    spawned: number;
    settled: number;
    skipped: number;
  };
  anomalies: {
    events: number;
    spawned: number;
    skipped: number;
  };
  seasons: {
    events: number;
    started: number;
    settled: number;
    skipped: number;
  };
  serverHostedJobs: {
    events: number;
    completed: number;
    skipped: number;
  };
  persistedEvents: number;
}

export interface EpochOperatorHealthInfo {
  checkedAt: string;
  status: EpochOperatorHealthStatus;
  attentionReasons: readonly string[];
  maintenance: EpochMaintenanceHealthInfo;
  queues: {
    openModeration: number;
    restrictedAbuseProfiles: number;
    marketRiskRestrictions: number;
    npcCandidateWatch: number;
    npcCandidateBlocked: number;
    serverHostedJobsQueued: number;
    loreTargetsPendingAdjudication: number;
    riskEvents: number;
  };
}

export interface EpochOperatorOverview {
  summary: EpochOperatorOverviewSummary;
  health: EpochOperatorHealthInfo;
  moderation: EpochModerationInfo;
  abuse: EpochAbuseProfilesInfo;
  marketRiskRestrictions: readonly EpochMarketRiskRestriction[];
  attestedRunners: EpochAttestedRunnersOverview;
  npcCandidateReview: EpochNpcCandidateReviewOverview;
  loreAdjudication: EpochLoreAdjudicationOverview;
  maintenance: EpochMaintenanceInfo;
  riskAudit: EpochAuditInfo;
  releaseAudit: EpochAuditInfo;
}

export interface EpochDowntimeState {
  agentId: string;
  mode: EpochDowntimeMode;
  regionId: string;
  startedAt: string;
  active: boolean;
  lastClaimedAt?: string;
  lastRewards?: readonly {
    resourceId: EpochResourceId;
    amount: number;
    reason: string;
  }[];
  lastClaimDiaryEntry?: EpochDowntimeDiaryEntry;
  lastTickedAt?: string;
  lastTickRewards?: readonly {
    resourceId: EpochResourceId;
    amount: number;
    reason: string;
  }[];
  lastTickDiaryEntry?: EpochDowntimeDiaryEntry;
}

export interface EpochPendingDowntimePreview {
  agentId: string;
  mode: EpochDowntimeMode;
  regionId: string;
  startedAt: string;
  previewedAt: string;
  elapsedSecondsRaw: number;
  elapsedSeconds: number;
  maxSeconds: number;
  capped: boolean;
  rewards: readonly {
    resourceId: EpochResourceId;
    amount: number;
    reason: string;
  }[];
  riskWarnings: readonly string[];
  nextRewardAt?: string;
}

export type EpochDowntimeDiaryPhase = "tick" | "claim";

export interface EpochDowntimeDiaryEntry {
  diaryId: string;
  agentId: string;
  mode: EpochDowntimeMode;
  regionId: string;
  phase: EpochDowntimeDiaryPhase;
  title: string;
  summary: string;
  elapsedSeconds: number;
  capped: boolean;
  rewards: readonly {
    resourceId: EpochResourceId;
    amount: number;
    reason: string;
  }[];
  occurredAt: string;
  sourceEventId: string;
  sourceEventType: "downtime_tick_resolved" | "downtime_claimed";
}

export interface EpochRegionActivity {
  activityId: string;
  regionId: string;
  kind: "downtime" | "objective" | "resource_node" | "bounty" | "raid" | "revolt" | "retaliation" | "diplomacy" | "organization_politics" | "season" | "market";
  agentId: string;
  title: string;
  summary: string;
  occurredAt: string;
  sourceEventId: string;
  sourceEventType:
    | "downtime_tick_resolved"
    | "downtime_claimed"
    | "contested_objective_created"
    | "contested_objective_contributed"
    | "contested_objective_settled"
    | "resource_node_spawned"
    | "resource_node_contested"
    | "resource_node_settled"
    | "bounty_created"
    | "bounty_claimed"
    | "raid_resolved"
    | "region_revolt_resolved"
    | "retaliation_opportunity_created"
    | "retaliation_resolved"
    | "diplomacy_proposed"
    | "diplomacy_responded"
    | "organization_politics_recorded"
    | "organization_prestige_changed"
    | "organization_treasury_changed"
    | "organization_upgrade_purchased"
    | "market_order_created"
    | "market_order_filled"
    | "market_order_cancelled"
    | "market_order_expired"
    | "season_campaign_created"
    | "season_started"
    | "season_objective_created"
    | "season_contribution_recorded"
    | "season_objective_completed"
    | "season_campaign_resolved"
    | "season_resolved";
}

export interface EpochDowntimeTick {
  tickedAt: string;
  updated: readonly EpochDowntimeState[];
}

export interface EpochNpcRecord {
  npcId: string;
  npcKey: string;
  displayName: string;
  regionId: string;
  traits: readonly string[];
  createdAt: string;
  media?: EpochNpcMedia;
  lifecycle: readonly {
    occurredAt: string;
    changes: Readonly<Record<string, string | number | boolean | null>>;
    sourceEventIds: readonly string[];
  }[];
}

export type EpochNpcCandidateStatus = "promoted" | "merged" | "rejected_flavor" | "moderation_hold";
export type EpochNpcCandidateDecision = EpochNpcCandidateStatus;
export type EpochNpcCandidateReviewLevel = "clear" | "watch" | "blocked" | "moderation_hold";
export type EpochNpcCandidateReviewFlag =
  | "authority_claim"
  | "reward_claim"
  | "chosen_one_claim"
  | "world_scale_claim"
  | "real_ip_similarity"
  | "real_world_mapping"
  | "internet_meme_trace"
  | "parody_trace";

export type EpochNpcCandidateFlavorPublicationMode = "shared_lore" | "personal_sealed";

export interface EpochNpcCandidateFlavorPublication {
  mode: EpochNpcCandidateFlavorPublicationMode;
  sharedWorldEligible: boolean;
  reason: string;
}

export type EpochRumorAdmissionStatus = "shared_candidate" | "personal_sealed";

export interface EpochRumorAdmissionReview {
  status: EpochRumorAdmissionStatus;
  anchorCompleteness: number;
  anchorThreshold: number;
  coreVibeScore: number;
  coreVibeThreshold: number;
  reason: string;
}

export interface EpochAbilityEffectCluster {
  clusterKey: string;
  effect: string;
  cost: string;
  medium: string;
  location: string;
  trigger: string;
  summary: string;
}

export interface EpochNpcCandidate {
  candidateId: string;
  agentId: string;
  explorerId: string;
  regionId: string;
  displayName: string;
  npcKey: string;
  traits: readonly string[];
  storyEvidence: string;
  decision: EpochNpcCandidateDecision;
  status: EpochNpcCandidateStatus;
  reviewLevel: EpochNpcCandidateReviewLevel;
  reviewScore: number;
  reviewFlags: readonly EpochNpcCandidateReviewFlag[];
  flavorPublication: EpochNpcCandidateFlavorPublication;
  rumorAdmissionReview: EpochRumorAdmissionReview;
  abilityEffectCluster?: EpochAbilityEffectCluster;
  submittedAt: string;
  canonicalNpcId?: string;
  rejectionReason?: string;
  sourceEventId?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNote?: string;
}

export type EpochAgentMemoryLayer = "confirmed" | "rumor" | "privateRun";

export interface EpochAgentMemoryItem {
  layer: EpochAgentMemoryLayer;
  candidateId: string;
  agentId: string;
  regionId: string;
  displayName: string;
  title: string;
  summary: string;
  status: EpochNpcCandidateStatus;
  reviewLevel: EpochNpcCandidateReviewLevel;
  reviewFlags: readonly EpochNpcCandidateReviewFlag[];
  submittedAt: string;
  sourceEventIds: readonly string[];
  canonicalNpcId?: string;
  rejectionReason?: string;
  reviewedAt?: string;
  reviewNote?: string;
}

export interface EpochAgentMemoryInfo {
  agentId?: string;
  regionId?: string;
  totals?: {
    confirmed: number;
    rumor: number;
    privateRun: number;
  };
  guidance: {
    confirmed: string;
    rumor: string;
    privateRun: string;
  };
  confirmedMemory: readonly EpochAgentMemoryItem[];
  rumorMemory: readonly EpochAgentMemoryItem[];
  privateRunMemory: readonly EpochAgentMemoryItem[];
}

export interface EpochNpcMedia {
  archetypeKey: string;
  title: string;
  subtitle: string;
  palette: readonly string[];
  accentColor: string;
  publicAlt: string;
  assetPath: string;
  imageUrl: string;
  contentType: string;
  width: number;
  height: number;
}

export type EpochNpcRelationshipKind =
  | "spouse"
  | "parent"
  | "child"
  | "relative"
  | "friend"
  | "enemy"
  | "superior"
  | "subordinate"
  | "mentor"
  | "apprentice"
  | "creditor"
  | "debtor";
export type EpochRelationshipAssetKey = EpochNpcRelationshipKind | EpochRelationshipKind | "household";

export interface EpochRelationshipMedia {
  relationshipKey: EpochRelationshipAssetKey;
  title: string;
  subtitle: string;
  palette: readonly string[];
  accentColor: string;
  publicAlt: string;
  assetPath: string;
  imageUrl: string;
  contentType: string;
  width: number;
  height: number;
}

export interface EpochNpcRelationship {
  relationshipId: string;
  sourceNpcId: string;
  targetNpcId: string;
  sourceRegionId: string;
  targetRegionId: string;
  kind: EpochNpcRelationshipKind;
  score: number;
  reason: string;
  sourceEventIds: readonly string[];
  recordedAt: string;
  media: EpochRelationshipMedia;
}

export interface EpochAgentNpcBond {
  bondId: string;
  agentId: string;
  explorerId: string;
  npcId: string;
  npcRegionId: string;
  kind: EpochNpcRelationshipKind;
  score: number;
  previousScore: number;
  scoreDelta: number;
  focusSpent: number;
  reason: string;
  updatedAt: string;
  npc: EpochNpcRecord;
  media: EpochRelationshipMedia;
}

export type EpochNpcMemoryImportance = "low" | "medium" | "high";

export interface EpochNpcMemory {
  memoryId: string;
  npcId: string;
  regionId: string;
  summary: string;
  importance: EpochNpcMemoryImportance;
  sourceEventIds: readonly string[];
  recordedAt: string;
}

export interface EpochHousehold {
  householdId: string;
  regionId: string;
  memberNpcIds: readonly string[];
  memberNames: readonly string[];
  summary: string;
  reason: string;
  sourceEventIds: readonly string[];
  recordedAt: string;
  media: EpochRelationshipMedia;
}

export interface EpochOrganizationInfluenceScore {
  total: number;
  threshold: number;
  memberScore: number;
  resourceScore: number;
  armedScore: number;
  territoryScore: number;
  diplomacyScore: number;
  supernaturalScore: number;
  factionReviewRequired: boolean;
  reviewReason: string;
}

export interface EpochOrganization {
  organizationId: string;
  organizationKey: string;
  displayName: string;
  regionId: string;
  memberNpcIds: readonly string[];
  memberAgentIds: readonly string[];
  standing: number;
  treasury: Partial<Record<EpochResourceId, number>>;
  upgradeKeys: readonly string[];
  upgrades: readonly EpochOrganizationUpgrade[];
  budgets: readonly EpochOrganizationBudget[];
  treasuryLedger: readonly EpochOrganizationTreasuryLedgerEntry[];
  influenceScore: EpochOrganizationInfluenceScore;
  recordedAt: string;
}

export type EpochOrganizationBudgetStatus = "proposed" | "approved" | "rejected";
export type EpochOrganizationBudgetResolution = "approved" | "rejected";
export type EpochOrganizationBudgetVoteDecision = EpochOrganizationBudgetResolution;

export interface EpochOrganizationBudgetVote {
  voteId: string;
  budgetId: string;
  organizationId: string;
  organizationName: string;
  regionId: string;
  resourceId: EpochResourceId;
  amount: number;
  decision: EpochOrganizationBudgetVoteDecision;
  voterAgentId: string;
  voterExplorerId: string;
  voterRole: string;
  approvalCount: number;
  rejectionCount: number;
  approvalThreshold: number;
  rejectionThreshold: number;
  note?: string;
  sourceEventIds: readonly string[];
  votedAt: string;
}

export interface EpochOrganizationBudget {
  budgetId: string;
  organizationId: string;
  organizationName: string;
  regionId: string;
  proposedByAgentId: string;
  proposedByExplorerId: string;
  title: string;
  description?: string;
  resourceId: EpochResourceId;
  amount: number;
  status: EpochOrganizationBudgetStatus;
  approvalThreshold: number;
  rejectionThreshold: number;
  approvalCount: number;
  rejectionCount: number;
  votes: readonly EpochOrganizationBudgetVote[];
  resolvedByAgentId?: string;
  resolvedByExplorerId?: string;
  resolution?: EpochOrganizationBudgetResolution;
  note?: string;
  treasuryEventId?: string;
  sourceEventIds: readonly string[];
  proposedAt: string;
  resolvedAt?: string;
}

export interface EpochOrganizationTreasuryLedgerEntry {
  ledgerId: string;
  organizationId: string;
  organizationName: string;
  regionId: string;
  resourceId: EpochResourceId;
  amountDelta: number;
  balanceAfter: number;
  reason: string;
  sourceEventIds: readonly string[];
  sourceEventId: string;
  sourceEventType: "organization_treasury_changed";
  actorAgentId?: string;
  trustClass: EpochDeliveryTrust | string;
  recordedAt: string;
}

export interface EpochOrganizationTreasuryContribution {
  treasuryEventId: string;
  organizationId: string;
  organizationName: string;
  regionId: string;
  resourceId: EpochResourceId;
  amountDelta: number;
  balanceAfter: number;
  reason: string;
  sourceEventIds: readonly string[];
  recordedAt: string;
}

export interface EpochOrganizationUpgrade {
  upgradeId: string;
  organizationId: string;
  organizationName: string;
  regionId: string;
  upgradeKey: string;
  title: string;
  description: string;
  purchasedByAgentId: string;
  purchasedByExplorerId: string;
  costResourceId: EpochResourceId;
  costAmount: number;
  sourceEventIds: readonly string[];
  purchasedAt: string;
}

export type EpochOrganizationMemberType = "npc" | "agent";
export type EpochOrganizationMembershipStatus = "active" | "left";

export interface EpochOrganizationMembership {
  membershipId: string;
  organizationId: string;
  organizationName: string;
  memberType: EpochOrganizationMemberType;
  npcId?: string;
  agentId?: string;
  explorerId?: string;
  regionId: string;
  role: string;
  status: EpochOrganizationMembershipStatus | string;
  sourceEventIds: readonly string[];
  recordedAt: string;
}

export type EpochOrganizationPoliticsKind = "promotion" | "patronage" | "rivalry" | "scandal" | "reform";

export interface EpochOrganizationPoliticsRecord {
  politicsId: string;
  organizationId: string;
  organizationName: string;
  regionId: string;
  npcId: string;
  counterpartyNpcId?: string;
  kind: EpochOrganizationPoliticsKind;
  title: string;
  summary: string;
  standingDelta: number;
  standingAfter: number;
  sourceEventIds: readonly string[];
  recordedAt: string;
}

export interface EpochNpcCareerRecord {
  careerId: string;
  npcId: string;
  regionId: string;
  title: string;
  status: string;
  organizationId?: string;
  sourceEventIds: readonly string[];
  recordedAt: string;
  npcDisplayName: string;
  summary: string;
}

export interface EpochNpcLocationRecord {
  locationId: string;
  npcId: string;
  fromRegionId: string;
  toRegionId: string;
  reason: string;
  sourceEventIds: readonly string[];
  recordedAt: string;
  npcDisplayName: string;
  summary: string;
}

export interface EpochNpcAssetState {
  assetId: string;
  npcId: string;
  regionId: string;
  assetKey: string;
  delta: number;
  balanceAfter: number;
  reason: string;
  sourceEventIds: readonly string[];
  recordedAt: string;
  npcDisplayName: string;
  summary: string;
}

export interface EpochNpcHealthState {
  healthId: string;
  npcId: string;
  regionId: string;
  status: string;
  severity: string;
  reason: string;
  sourceEventIds: readonly string[];
  recordedAt: string;
  npcDisplayName: string;
  summary: string;
}

export interface EpochInventoryItem {
  itemId: string;
  agentId: string;
  explorerId: string;
  itemKey: string;
  displayName: string;
  rarity: string;
  sourceEventIds: readonly string[];
  createdAt: string;
  bound: boolean;
  media?: EpochItemMedia;
  boundAt?: string;
  boundReason?: string;
  marketLockedByOrderId?: string;
  transferredAt?: string;
  transferSourceOrderId?: string;
}

export interface EpochItemMedia {
  itemKey: string;
  title: string;
  subtitle: string;
  palette: readonly string[];
  accentColor: string;
  publicAlt: string;
  assetPath: string;
  imageUrl: string;
  contentType: string;
  width: number;
  height: number;
}

export interface EpochResourceMedia {
  resourceId: EpochResourceId;
  title: string;
  subtitle: string;
  palette: readonly string[];
  accentColor: string;
  publicAlt: string;
  assetPath: string;
  imageUrl: string;
  contentType: string;
  width: number;
  height: number;
}

export interface EpochDowntimeMedia {
  mode: EpochDowntimeMode;
  title: string;
  subtitle: string;
  palette: readonly string[];
  accentColor: string;
  publicAlt: string;
  assetPath: string;
  imageUrl: string;
  contentType: string;
  width: number;
  height: number;
}

export type EpochActivityAssetKey =
  | "objective"
  | "resource_node"
  | "anomaly"
  | "bounty"
  | "social_hook"
  | "retaliation"
  | "turn_card"
  | "downtime"
  | "reincarnation";

export interface EpochActivityMedia {
  activityKey: EpochActivityAssetKey;
  title: string;
  subtitle: string;
  palette: readonly string[];
  accentColor: string;
  publicAlt: string;
  assetPath: string;
  imageUrl: string;
  contentType: string;
  width: number;
  height: number;
}

export type EpochWorldSurfaceAssetKey =
  | "world_news"
  | "audit_replay"
  | "market_board"
  | "operator_watch"
  | "result_page"
  | "death_archive"
  | "install_portal"
  | "web_bridge";

export interface EpochWorldSurfaceMedia {
  surfaceKey: EpochWorldSurfaceAssetKey;
  title: string;
  subtitle: string;
  palette: readonly string[];
  accentColor: string;
  publicAlt: string;
  assetPath: string;
  imageUrl: string;
  contentType: string;
  width: number;
  height: number;
}

export interface EpochShopOffer {
  offerId: string;
  regionId?: string;
  priceRegionId?: string;
  itemKey: string;
  displayName: string;
  rarity: string;
  bindOnAcquire?: boolean;
  media?: EpochItemMedia;
  costs: readonly {
    resourceId: EpochResourceId;
    amount: number;
  }[];
  baseCosts?: readonly {
    resourceId: EpochResourceId;
    amount: number;
  }[];
}

export interface EpochEquipmentEffectInfo {
  itemId: string;
  itemKey: string;
  displayName: string;
  label: string;
  resourceNodeScoreBonus: number;
}

export type EpochSocialHookKind = "letter" | "gossip" | "scandal" | "obligation";

export interface EpochSocialHook {
  hookId: string;
  regionId: string;
  npcId?: string;
  kind: EpochSocialHookKind;
  title: string;
  body: string;
  actionLabel: string;
  risk: EpochHostedActionRisk;
  sourceEventIds: readonly string[];
  createdAt: string;
}

export interface EpochRegionNews {
  newsId: string;
  regionId: string;
  headline: string;
  body: string;
  legendDelta: number;
  sourceEventIds: readonly string[];
  createdAt: string;
  moderationStatus: EpochContentModerationStatus;
  media: EpochWorldSurfaceMedia;
}

export interface EpochClaimableLegendNews extends EpochRegionNews {
  amount: number;
}

export interface EpochMessageRecord {
  messageId: string;
  scope: EpochMessageScope;
  agentId: string;
  explorerId: string;
  regionId?: string;
  body: string;
  postedAt: string;
  moderationStatus: EpochContentModerationStatus;
}

export interface EpochModerationItem {
  moderationId: string;
  subjectType: EpochModerationSubjectType;
  subjectId: string;
  sourceEventId: string;
  agentId?: string;
  explorerId?: string;
  regionId?: string;
  reason: string;
  severity: EpochModerationSeverity;
  bodyPreview: string;
  queuedAt: string;
  status: EpochModerationItemStatus;
  resolution?: EpochModerationResolution;
  resolvedBy?: string;
  resolvedAt?: string;
  note?: string;
}

export interface EpochModerationInfo {
  status?: string;
  subjectType?: string;
  open: readonly EpochModerationItem[];
  resolved: readonly EpochModerationItem[];
  total: number;
}

export interface EpochAuditEventSummary {
  eventId: string;
  eventType: EpochEventType;
  aggregateType: string;
  aggregateId: string;
  actorExplorerId: string;
  agentId?: string;
  trustClass: string;
  causationId: string;
  correlationId: string;
  idempotencyKey?: string;
  createdAt: string;
  highImpact: boolean;
  reviewFlags: readonly string[];
  reviewScore: number;
  riskReview?: EpochAuditRiskReviewSummary;
  payload: Record<string, unknown>;
  publicPages: {
    audit: string;
  };
}

export interface EpochAuditRiskAgentProfile {
  agentId: string;
  explorerId: string;
  eventCount: number;
  reviewScore: number;
  flags: Readonly<Record<string, number>>;
  latestEventId: string;
  latestReviewedAt: string;
}

export interface EpochAuditRiskProfile {
  eventCount: number;
  reviewScore: number;
  flags: Readonly<Record<string, number>>;
  agents: readonly EpochAuditRiskAgentProfile[];
  latestEventId?: string;
  latestReviewedAt?: string;
}

export interface EpochAuditRiskReviewSummary {
  reviewId: string;
  sourceEventId: string;
  resolution: EpochRiskReviewResolution;
  reviewFlags: readonly string[];
  reviewScore: number;
  reviewedAt: string;
}

export interface EpochRiskReview {
  reviewId: string;
  sourceEventId: string;
  sourceEventType: EpochEventType;
  agentId?: string;
  explorerId?: string;
  resolution: EpochRiskReviewResolution;
  reviewFlags: readonly string[];
  reviewScore: number;
  operatorId: string;
  reviewedAt: string;
  note?: string;
}

export interface EpochAuditInfo {
  agentId?: string;
  eventType?: string;
  eventId?: string;
  aggregateId?: string;
  highImpactOnly: boolean;
  riskOnly: boolean;
  total: number;
  events: readonly EpochAuditEventSummary[];
  selectedEvent?: EpochAuditEventSummary;
  riskProfile: EpochAuditRiskProfile;
  replay: {
    eventIds: readonly string[];
    aggregateIds: readonly string[];
    trustClasses: readonly string[];
    highImpactEventTypes: readonly string[];
  };
  publicPages: {
    index: string;
    audit?: string;
  };
}

export interface EpochLegendAward {
  awardId: string;
  newsId: string;
  regionId: string;
  agentId: string;
  explorerId: string;
  amount: number;
  reason: string;
  awardedAt: string;
}

export type EpochContestedObjectiveStatus = "active" | "settled";

export interface EpochObjectiveStanding {
  agentId: string;
  explorerId: string;
  amount: number;
  score: number;
}

export interface EpochContestedObjective {
  objectiveId: string;
  regionId: string;
  title: string;
  description: string;
  resourceId: EpochResourceId;
  targetScore: number;
  mode: "contribution" | "race";
  reward: {
    resourceId: EpochResourceId;
    amount: number;
    reason: string;
  };
  consolationReward?: {
    resourceId: EpochResourceId;
    amount: number;
    reason: string;
  };
  createdAt: string;
  status: EpochContestedObjectiveStatus;
  totalScore: number;
  leaderboard: readonly EpochObjectiveStanding[];
  raceCompletions: readonly {
    completionId: string;
    agentId: string;
    explorerId: string;
    place: number;
    score: number;
    reward: {
      resourceId: EpochResourceId;
      amount: number;
      reason: string;
    };
    completedAt: string;
  }[];
  settledAt?: string;
  winnerAgentId?: string;
  winnerExplorerId?: string;
  winningScore?: number;
}

export type EpochResourceNodeStatus = "open" | "settled";

export interface EpochResourceNodeStanding {
  agentId: string;
  explorerId: string;
  staminaSpent: number;
  score: number;
}

export interface EpochResourceNode {
  nodeId: string;
  regionId: string;
  title: string;
  description: string;
  resourceId: EpochResourceId;
  reward: {
    resourceId: EpochResourceId;
    amount: number;
    reason: string;
  };
  spawnedAt: string;
  status: EpochResourceNodeStatus;
  totalScore: number;
  leaderboard: readonly EpochResourceNodeStanding[];
  settledAt?: string;
  winnerAgentId?: string;
  winnerExplorerId?: string;
  winningScore?: number;
}

export type EpochAnomalySeverity = "minor" | "major" | "cataclysm";
export type EpochAnomalyOutcome = "contained" | "escaped";
export type EpochAnomalyEventStatus = "open" | "resolved";

export interface EpochAnomalyMedia {
  variantLabel: string;
  scenePrompt: string;
  palette: readonly string[];
  accentColor: string;
  dangerColor: string;
  sigil: string;
  publicAlt: string;
  assetPath?: string;
  imageUrl?: string;
  imageSha256?: string;
}

export interface EpochAnomalyStanding {
  agentId: string;
  explorerId: string;
  focusSpent: number;
  score: number;
}

export interface EpochAnomalyEvent {
  anomalyId: string;
  regionId: string;
  sourceSeasonId?: string;
  title: string;
  description: string;
  media?: EpochAnomalyMedia;
  severity: EpochAnomalySeverity;
  targetScore: number;
  reward: {
    resourceId: EpochResourceId;
    amount: number;
    reason: string;
  };
  lifetimeRisk: number;
  spawnedAt: string;
  status: EpochAnomalyEventStatus;
  totalScore: number;
  leaderboard: readonly EpochAnomalyStanding[];
  resolvedAt?: string;
  outcome?: EpochAnomalyOutcome;
  winnerAgentId?: string;
  winnerExplorerId?: string;
  winningScore?: number;
}

export interface EpochRegionLeaderboardEntry {
  agentId: string;
  explorerId: string;
  influenceScore: number;
  trustedInfluenceScore: number;
  dominantTrustClass: EpochDeliveryTrust;
  trustBreakdown: Partial<Record<EpochDeliveryTrust, number>>;
  objectiveScore: number;
  resourceNodeScore: number;
  anomalyScore: number;
  seasonScore: number;
  legendScore: number;
  bountyScore: number;
  raidScore: number;
  lastActiveAt: string;
  sourceEventIds: readonly string[];
}

export type EpochCompetitiveLadderMode = "casual" | "ranked" | "verified";

export interface EpochCompetitiveLadderView {
  mode: EpochCompetitiveLadderMode;
  dimension: {
    kind: "region" | "season" | "tournament";
    id: string;
    title?: string;
    status?: string;
    serverSettled: true;
    serverTournament?: true;
  };
  limit: number;
  total: number;
  truncated: boolean;
  entries: readonly {
    rank: number;
    agentId: string;
    explorerId: string;
    score: number;
    canonicalScore: number;
    verifiedScore: number;
    excludedScore: number;
    deliveryClass: "verified" | "mixed" | "non_verified";
    dominantTrustClass: EpochDeliveryTrust;
    eligibilityReasons: readonly string[];
    sourceEventIds: readonly string[];
    auditLinks: readonly { eventId: string; audit: string }[];
  }[];
}

export interface EpochPlayerDataExport {
  schemaVersion: "obsidian-epoch.player-data-export.v1";
  exportedAt: string;
  explorerId: string;
  counts: Record<string, number>;
  profile: {
    summary: EpochExplorerProfileSummary;
    identitySlots: EpochIdentitySlotState;
    totalResources: Partial<Record<EpochResourceId, number>>;
  };
  identities: readonly EpochAgentIdentity[];
  replay: {
    limit: number;
    truncated: boolean;
    events: readonly {
      eventId: string;
      eventType: EpochEventType;
      createdAt: string;
      highImpact: boolean;
      publicPages: { audit: string };
    }[];
  };
}

export interface EpochRegionMedia {
  regionId: string;
  title: string;
  subtitle: string;
  palette: readonly string[];
  accentColor: string;
  publicAlt: string;
  assetPath: string;
  imageUrl: string;
}

export interface EpochFactionMedia {
  factionId: string;
  title: string;
  subtitle: string;
  palette: readonly string[];
  accentColor: string;
  publicAlt: string;
  assetPath: string;
  imageUrl: string;
  contentType: string;
  width: number;
  height: number;
}

export interface EpochSeasonBannerMedia {
  seasonKey: string;
  title: string;
  subtitle: string;
  palette: readonly string[];
  accentColor: string;
  publicAlt: string;
  assetPath: string;
  imageUrl: string;
  contentType: string;
  width: number;
  height: number;
}

export interface EpochCampaignKeyArtMedia {
  campaignKey: string;
  title: string;
  subtitle: string;
  palette: readonly string[];
  accentColor: string;
  publicAlt: string;
  assetPath: string;
  imageUrl: string;
  contentType: string;
  width: number;
  height: number;
}

export interface EpochAmbienceSceneMedia {
  sceneKey: string;
  title: string;
  subtitle: string;
  palette: readonly string[];
  accentColor: string;
  publicAlt: string;
  assetPath: string;
  imageUrl: string;
  contentType: string;
  width: number;
  height: number;
}

export interface EpochWorldSceneMedia {
  sceneKey: string;
  regionId: string;
  title: string;
  subtitle: string;
  palette: readonly string[];
  accentColor: string;
  publicAlt: string;
  assetPath: string;
  imageUrl: string;
  contentType: string;
  width: number;
  height: number;
}

export interface EpochSceneVariantMedia {
  variantKey: string;
  regionId: string;
  title: string;
  subtitle: string;
  palette: readonly string[];
  accentColor: string;
  publicAlt: string;
  assetPath: string;
  imageUrl: string;
  contentType: string;
  width: number;
  height: number;
  timeOfDay: string;
  weather: string;
}

export interface EpochEventStateMedia {
  stateKey: string;
  title: string;
  subtitle: string;
  palette: readonly string[];
  accentColor: string;
  publicAlt: string;
  assetPath: string;
  imageUrl: string;
  contentType: string;
  width: number;
  height: number;
}

export interface EpochSeasonCampaignMedia {
  banner?: EpochSeasonBannerMedia;
  campaignKeyArt?: EpochCampaignKeyArtMedia;
  factions: readonly EpochFactionMedia[];
}

export type EpochSeasonCampaignStatus = "active" | "resolved";
export type EpochSeasonPhase = "active" | "resolved";
export type EpochSeasonPhaseEventType = "season_started" | "season_resolved";

export interface EpochSeasonPhaseEvent {
  eventId: string;
  eventType: EpochSeasonPhaseEventType;
  phase: EpochSeasonPhase;
  sourceEventId: string;
  relatedEventIds: readonly string[];
  at: string;
}

export type EpochSeasonObjectiveStatus = "open" | "completed";

export interface EpochSeasonObjective {
  objectiveId: string;
  seasonId: string;
  objectiveKey: string;
  title: string;
  description: string;
  targetScore: number;
  progressScore: number;
  status: EpochSeasonObjectiveStatus;
  createdAt: string;
  sourceEventId?: string;
  completedAt?: string;
  completedByAgentId?: string;
  completedByExplorerId?: string;
  completedByFactionId?: string;
}

export interface EpochSeasonContribution {
  eventId: string;
  seasonId: string;
  agentId: string;
  explorerId: string;
  factionId: string;
  resourceId: EpochResourceId;
  amount: number;
  baseScoreDelta: number;
  organizationBonusScore: number;
  regionControlBonusScore: number;
  scoreDelta: number;
  sourceOrganizationUpgradeIds: readonly string[];
  sourceRegionControlRegionIds: readonly string[];
  agentScoreAfter: number;
  factionScoreAfter: number;
  totalScoreAfter: number;
  trustClass: EpochDeliveryTrust;
  recordedAt: string;
}

export interface EpochSeasonFactionStanding {
  factionId: string;
  score: number;
  trustedScore: number;
  dominantTrustClass: EpochDeliveryTrust;
  trustBreakdown: Partial<Record<EpochDeliveryTrust, number>>;
  media?: EpochFactionMedia;
}

export interface EpochSeasonAgentStanding {
  agentId: string;
  explorerId: string;
  factionId: string;
  amount: number;
  score: number;
  trustedScore: number;
  dominantTrustClass: EpochDeliveryTrust;
  trustBreakdown: Partial<Record<EpochDeliveryTrust, number>>;
}

export interface EpochSeasonCampaign {
  seasonId: string;
  seasonKey: string;
  title: string;
  description: string;
  regionIds: readonly string[];
  factionIds: readonly string[];
  resourceId: EpochResourceId;
  targetScore: number;
  reward: {
    resourceId: EpochResourceId;
    amount: number;
    reason: string;
  };
  createdAt: string;
  status: EpochSeasonCampaignStatus;
  media?: EpochSeasonCampaignMedia;
  phaseEvents: readonly EpochSeasonPhaseEvent[];
  objectives: readonly EpochSeasonObjective[];
  contributions: readonly EpochSeasonContribution[];
  totalScore: number;
  factionStandings: readonly EpochSeasonFactionStanding[];
  agentStandings: readonly EpochSeasonAgentStanding[];
  resolvedAt?: string;
  winningFactionId?: string;
  winnerAgentId?: string;
  winnerExplorerId?: string;
  winningScore?: number;
}

export interface EpochRegionControl {
  regionId: string;
  controllingFactionId: string;
  previousControllingFactionId?: string;
  controlScore: number;
  contestedByFactionId?: string;
  controlMargin: number;
  sourceSeasonId: string;
  sourceReleaseId?: string;
  previousControlSourceSeasonId?: string;
  claimingAgentId?: string;
  claimingExplorerId?: string;
  updatedAt: string;
}

export type EpochRegionFactionPressureStatus = "controlling" | "challenging" | "active";

export interface EpochRegionFactionPressure {
  regionId: string;
  factionId: string;
  pressureScore: number;
  seasonScore: number;
  raidPressure: number;
  activeRaidCount: number;
  controlStatus: EpochRegionFactionPressureStatus;
  agentIds: readonly string[];
  sourceSeasonIds: readonly string[];
  latestRaidId?: string;
  latestRaidAt?: string;
}

export type EpochRegionFrontlineStatus = "attacker_advancing" | "defender_holding" | "contested";

export interface EpochRegionFrontline {
  frontlineId: string;
  regionId: string;
  attackerAgentId: string;
  attackerExplorerId: string;
  defenderAgentId: string;
  defenderExplorerId: string;
  attackerSideAgentIds: readonly string[];
  defenderSideAgentIds: readonly string[];
  attackerPressure: number;
  defenderPressure: number;
  pressureDelta: number;
  status: EpochRegionFrontlineStatus;
  latestRaidId: string;
  latestTraceId?: string;
  latestEventAt: string;
  openRetaliationIds: readonly string[];
}

export type EpochRegionInfluenceSourceEventType =
  | "contested_objective_settled"
  | "resource_node_settled"
  | "anomaly_event_resolved"
  | "party_run_settled"
  | "bounty_claimed"
  | "hosted_action_recorded"
  | "raid_resolved"
  | "region_revolt_resolved"
  | "retaliation_resolved";

export interface EpochRegionInfluenceChange {
  influenceId: string;
  regionId: string;
  agentId: string;
  explorerId: string;
  influenceDelta: number;
  influenceScoreAfter: number;
  reason: string;
  sourceEventId: string;
  sourceEventType: EpochRegionInfluenceSourceEventType;
  sourceAggregateId: string;
  changedAt: string;
}

export type EpochTraceSourceEventType = EpochRegionInfluenceSourceEventType | "bounty_claimed";

export interface EpochConflictTrace {
  traceId: string;
  regionId: string;
  title: string;
  summary: string;
  sourceEventType: EpochTraceSourceEventType;
  sourceEventIds: readonly string[];
  sourceAggregateId: string;
  relatedInfluenceIds: readonly string[];
  participantAgentIds: readonly string[];
  participantExplorerIds: readonly string[];
  scoutAgentIds?: readonly string[];
  parentTraceId?: string;
  createdAt: string;
}

export interface EpochRegionMonument {
  monumentId: string;
  regionId: string;
  title: string;
  description: string;
  controllingFactionId: string;
  winnerAgentId: string;
  winnerExplorerId: string;
  sourceSeasonId: string;
  controlScore: number;
  builtAt: string;
}

export type EpochMarketOrderStatus = "open" | "filled" | "cancelled" | "expired";
export type EpochMarketSellKind = "resource" | "item";
export type EpochMarketTradeRiskFlag = "repeat_counterparty_trade" | "suspicious_low_price" | "suspicious_high_price";

export interface EpochMarketOrder {
  orderId: string;
  regionId: string;
  sellerAgentId: string;
  sellerExplorerId: string;
  sellKind: EpochMarketSellKind;
  sellResourceId?: EpochResourceId;
  sellAmount: number;
  sellItemId?: string;
  sellItemKey?: string;
  sellItemDisplayName?: string;
  sellItemRarity?: string;
  priceResourceId: EpochResourceId;
  priceAmount: number;
  status: EpochMarketOrderStatus;
  createdAt: string;
  buyerAgentId?: string;
  buyerExplorerId?: string;
  marketFeeResourceId?: EpochResourceId;
  marketFeeAmount?: number;
  sellerProceedsAmount?: number;
  transferredItemId?: string;
  tradeRiskFlags?: readonly EpochMarketTradeRiskFlag[];
  tradeRiskScore?: number;
  filledAt?: string;
  cancelledAt?: string;
  expiredAt?: string;
}

export interface EpochMarketRiskRestriction {
  agentId: string;
  explorerId?: string;
  sourceEventId: string;
  sourceReviewId: string;
  reviewFlags: readonly string[];
  reviewScore: number;
  reason: "risk_review_escalated";
  restrictedAt: string;
}

export interface EpochMarketRiskRestrictionRelease {
  releaseId: string;
  agentId: string;
  explorerId?: string;
  sourceEventId: string;
  sourceReviewId: string;
  releasedBy: string;
  releasedAt: string;
  note?: string;
}

export interface EpochMarketExpiryTick {
  tickedAt: string;
  updated: readonly EpochMarketOrder[];
}

export type EpochDirectTradeStatus = "open" | "accepted" | "cancelled" | "expired";
export type EpochDirectTradeAssetKind = "resource" | "item";

export interface EpochDirectTradeAsset {
  kind: EpochDirectTradeAssetKind;
  resourceId?: EpochResourceId;
  amount?: number;
  itemId?: string;
  itemKey?: string;
  itemDisplayName?: string;
  itemRarity?: string;
}

export interface EpochDirectTrade {
  tradeId: string;
  regionId: string;
  proposerAgentId: string;
  counterpartyAgentId: string;
  offeredAsset: EpochDirectTradeAsset;
  requestedAsset: EpochDirectTradeAsset;
  status: EpochDirectTradeStatus;
  createdAt: string;
  acceptedAt?: string;
  cancelledAt?: string;
  expiredAt?: string;
  transferredOfferedItemId?: string;
  transferredRequestedItemId?: string;
  tradeRiskFlags?: readonly EpochMarketTradeRiskFlag[];
  tradeRiskScore?: number;
  publicPages?: {
    trade: string;
    audit: string;
    region: string;
    proposer: string;
    counterparty: string;
  };
}

export interface EpochDirectTradeInfo {
  regionId?: string;
  agentId?: string;
  status?: string;
  trades: readonly EpochDirectTrade[];
}

export interface EpochDirectTradeExpiryTick {
  tickedAt: string;
  updated: readonly EpochDirectTrade[];
}

export interface EpochRegionMarketResourceSummary {
  resourceId: EpochResourceId;
  amount: number;
  orders: number;
}

export interface EpochRegionMarketSummary {
  regionId: string;
  totalOrders: number;
  openOrders: number;
  filledOrders: number;
  cancelledOrders: number;
  expiredOrders: number;
  filledVolume: Partial<Record<EpochResourceId, number>>;
  collectedFees: Partial<Record<EpochResourceId, number>>;
  filledResources: readonly EpochRegionMarketResourceSummary[];
  latestActivityAt?: string;
}

export type EpochBountyStatus = "open" | "claimed";

export interface EpochBounty {
  bountyId: string;
  regionId: string;
  sponsorAgentId: string;
  sponsorExplorerId: string;
  title: string;
  description: string;
  rewardResourceId: EpochResourceId;
  rewardAmount: number;
  requiredItemKey?: string;
  status: EpochBountyStatus;
  createdAt: string;
  claimantAgentId?: string;
  claimantExplorerId?: string;
  transferredItemId?: string;
  evidence?: string;
  claimedAt?: string;
}

export type EpochPartyRole = "leader" | "vanguard" | "scout" | "support" | "scribe";
export type EpochPartyRunStatus = "open" | "settled";

export interface EpochPartyMember {
  agentId: string;
  participantRole: EpochPartyRole;
  joinedAt: string;
}

export interface EpochPartyMemberResult {
  agentId: string;
  participantRole: EpochPartyRole;
  score: number;
  reward: {
    resourceId: EpochResourceId;
    amount: number;
    reason: string;
  };
}

export interface EpochPartyJoinRequest {
  requestId: string;
  partyRunId: string;
  agentId: string;
  participantRole: EpochPartyRole;
  status: "pending" | "approved" | "rejected";
  requestNote?: string;
  requestedAt: string;
  resolvedAt?: string;
  resolvedByAgentId?: string;
  resolutionNote?: string;
}

export interface EpochPartyRun {
  partyRunId: string;
  regionId: string;
  leaderAgentId: string;
  title: string;
  objective: string;
  joinPolicy?: "open" | "invite_only";
  inviteTokenExpiresAt?: string;
  inviteTokenUseLimit?: number;
  inviteTokenUses?: number;
  inviteRecipientAgentId?: string;
  inviteTokenRevokedAt?: string;
  status: EpochPartyRunStatus;
  members: readonly EpochPartyMember[];
  joinRequests?: readonly EpochPartyJoinRequest[];
  totalScore?: number;
  memberResults?: readonly EpochPartyMemberResult[];
  traceId?: string;
  newsId?: string;
  settledAt?: string;
  createdAt: string;
  updatedAt: string;
  publicPages?: {
    partyRun: string;
    audit: string;
    region: string;
    leader: string;
  };
}

export type EpochRaidOutcome = "attacker_won" | "defender_won";

export interface EpochRaidResult {
  raidId: string;
  regionId: string;
  attackerAgentId: string;
  attackerExplorerId: string;
  defenderAgentId: string;
  defenderExplorerId: string;
  staminaSpent: number;
  attackerPower: number;
  defenderPower: number;
  outcome: EpochRaidOutcome;
  reward: {
    resourceId: EpochResourceId;
    amount: number;
    reason: string;
  };
  resolvedAt: string;
}

export type EpochRegionRevoltOutcome = "revolt_succeeded" | "revolt_defended";

export interface EpochRegionRevoltResult {
  revoltId: string;
  regionId: string;
  sourceReleaseId: string;
  previousControllingFactionId: string;
  previousControlSourceSeasonId: string;
  rebelAgentId: string;
  rebelExplorerId: string;
  rebelFactionId: string;
  sourceSeasonId: string;
  factionScore: number;
  staminaSpent: number;
  rebelPower: number;
  defenderPower: number;
  outcome: EpochRegionRevoltOutcome;
  resolvedAt: string;
}

export type EpochRetaliationOpportunityStatus = "open" | "resolved";
export type EpochRetaliationOutcome = "retaliator_won" | "target_held";

export interface EpochRetaliationOpportunity {
  retaliationId: string;
  regionId: string;
  sourceRaidId: string;
  sourceTraceId: string;
  opportunityAgentId: string;
  opportunityExplorerId: string;
  targetAgentId: string;
  targetExplorerId: string;
  status: EpochRetaliationOpportunityStatus;
  reason: string;
  sourceEventIds: readonly string[];
  createdAt: string;
  staminaSpent?: number;
  retaliatorPower?: number;
  targetPower?: number;
  outcome?: EpochRetaliationOutcome;
  winnerAgentId?: string;
  winnerExplorerId?: string;
  resolvedAt?: string;
}

export type EpochRelationshipKind = "alliance" | "hostility" | "reputation";

export type EpochDiplomacyStatus = "pending" | "accepted" | "rejected";
export type EpochDiplomacyResponse = "accepted" | "rejected";

export interface EpochDiplomacyRecord {
  diplomacyId: string;
  regionId: string;
  sourceAgentId: string;
  sourceExplorerId: string;
  targetAgentId: string;
  targetExplorerId: string;
  kind: EpochRelationshipKind;
  focusSpent: number;
  terms: string;
  status: EpochDiplomacyStatus;
  proposedAt: string;
  response?: EpochDiplomacyResponse;
  responseFocusSpent?: number;
  responseNote?: string;
  relationshipId?: string;
  respondedAt?: string;
}

export interface EpochRelationshipEdge {
  relationshipId: string;
  sourceAgentId: string;
  sourceExplorerId: string;
  targetAgentId: string;
  targetExplorerId: string;
  kind: EpochRelationshipKind;
  score: number;
  previousScore: number;
  scoreDelta: number;
  focusSpent: number;
  reason: string;
  updatedAt: string;
  media: EpochRelationshipMedia;
}

export type EpochHostedSessionStatus = "active" | "completed";
export type EpochHostedActionRisk = "low" | "medium" | "high";
export type EpochChannelClass = "server_hosted" | "browser_copy_paste";
export type EpochDeliveryTrust = "untrusted_client" | "user_verified_web" | "server_hosted_agent" | "host_attested" | "remote_attested_runner" | "system_worker";

export interface EpochHostedReward {
  resourceId: EpochResourceId;
  amount: number;
  reason: string;
}

export interface EpochActionExplanation {
  brief: string;
  trigger: string;
  choiceReason: string;
  rejectedAlternatives: readonly string[];
  risk: string;
  expectedBenefit: string;
}

export interface EpochHostedActionOption {
  actionOptionId: string;
  optionKey: string;
  label: string;
  risk: EpochHostedActionRisk;
  socialHookId?: string;
  explanation: EpochActionExplanation;
  outcomeSummary: string;
  reward?: EpochHostedReward;
  lifetimeDelta?: number;
}

export type EpochTurnCardStatus = "open" | "resolved";

export interface EpochTurnActionOption {
  actionOptionId: string;
  optionKey: string;
  label: string;
  risk: EpochHostedActionRisk;
  socialHookId?: string;
  explanation: EpochActionExplanation;
}

export interface EpochTurnCardSignedEnvelope {
  envelopeId: string;
  protocolVersion: "obsidian-epoch.turn-card-envelope.v1";
  signatureAlgorithm: "Ed25519";
  serverPublicKey: string;
  contentHash: `sha256:${string}`;
  signature: string;
  trustClass: EpochDeliveryTrust;
  runTicketId: string | null;
}

export interface EpochTurnResolutionSignedEnvelope {
  envelopeId: string;
  protocolVersion: "obsidian-epoch.turn-resolution-envelope.v1";
  signatureAlgorithm: "Ed25519";
  serverPublicKey: string;
  contentHash: `sha256:${string}`;
  signature: string;
  trustClass: EpochDeliveryTrust;
  runTicketId: string | null;
}

export interface EpochTurnResolution {
  turnCardId: string;
  agentId: string;
  channelClass: EpochDeliveryTrust;
  envelopeId: string;
  sequence: number;
  nonce: string;
  actionOptionId: string;
  optionLabel: string;
  visibleText?: string;
  explanation: EpochActionExplanation;
  outcomeSummary: string;
  reward?: EpochHostedReward;
  lifetimeDelta?: number;
  resolvedAt: string;
  signedEnvelope: EpochTurnResolutionSignedEnvelope;
}

export interface EpochTurnCard {
  turnCardId: string;
  agentId: string;
  explorerId: string;
  regionId: string;
  sequence: number;
  nonce: string;
  prompt: string;
  visibleContext: {
    regionId: string;
    prompt: string;
    identityName: string;
  };
  status: EpochTurnCardStatus;
  actionOptions: readonly EpochTurnActionOption[];
  createdAt: string;
  expiresAt?: string;
  signedEnvelope: EpochTurnCardSignedEnvelope;
  resolvedAt?: string;
  resolution?: EpochTurnResolution;
}

export interface EpochJourneyActionResolution {
  ruleVersion: "journey-action-resolution.v1";
  authority: "server";
  decisionKeyId: string;
  inputHash: `sha256:${string}`;
  outcome: "exceptional_success" | "success" | "partial_success" | "failure";
  completionKind: "complete" | "failed";
  score: number;
  difficulty: number;
  margin: number;
  factors: {
    baseCompetence: number;
    identity: number;
    resources: number;
    equipment: number;
    sceneSupport: number;
    deterministicVariance: number;
  };
  resourceCost?: {
    resourceId: "stamina";
    amount: 1;
    paid: boolean;
  };
  summary: string;
}

export interface EpochHostedActionRecord {
  actionId: string;
  sessionId: string;
  agentId: string;
  channelClass?: EpochChannelClass;
  deliveryTrust?: EpochDeliveryTrust;
  actionOptionId: string;
  optionLabel: string;
  risk?: EpochHostedActionRisk;
  socialHookId?: string;
  attestationId?: string;
  visibleText?: string;
  explanation: EpochActionExplanation;
  outcomeSummary: string;
  journeyResolution?: EpochJourneyActionResolution;
  reward?: EpochHostedReward;
  lifetimeDelta?: number;
  recordedAt: string;
  signedEnvelope: EpochHostedActionSignedEnvelope;
}

export interface EpochHostedActionSignedEnvelope {
  envelopeId: string;
  protocolVersion: "obsidian-epoch.hosted-action-envelope.v1";
  signatureAlgorithm: "Ed25519";
  serverPublicKey: string;
  contentHash: `sha256:${string}`;
  signature: string;
  trustClass: EpochDeliveryTrust;
  runTicketId: string | null;
}

export interface EpochAttestationRecord {
  attestationId: string;
  runnerId: string;
  runnerKeyId?: string;
  challengeId: string;
  sessionId: string;
  agentId: string;
  actionOptionId: string;
  transcriptHash: string;
  signature: string;
  signatureBaseHash: string;
  verifiedAt: string;
}

export interface EpochAttestationChallenge {
  challengeId: string;
  runnerId: string;
  sessionId: string;
  actionOptionId: string;
  transcriptHash: string;
  signatureBase: string;
  issuedAt: string;
  expiresAt: string;
}

export interface EpochAttestationChallengeResponse {
  challenge: EpochAttestationChallenge;
  duplicate?: boolean;
}

export interface EpochHostedSession {
  sessionId: string;
  agentId: string;
  explorerId: string;
  regionId: string;
  mandate: string;
  channelClass?: EpochChannelClass;
  deliveryTrust?: EpochDeliveryTrust;
  status: EpochHostedSessionStatus;
  actionOptions: readonly EpochHostedActionOption[];
  actions: readonly EpochHostedActionRecord[];
  startedAt: string;
  completedAt?: string;
}

export interface EpochHostedSessionWatchInfo {
  generatedAt: string;
  sessionId: string;
  agentId?: string;
  explorerId?: string;
  regionId?: string;
  identity?: {
    agentId: string;
    explorerId: string;
    identityName: string;
    status: EpochAgentIdentity["status"];
    generation: number;
    lifetime: EpochAgentIdentity["lifetime"];
  };
  session?: EpochHostedSession;
  regionalContext?: EpochResultPageRegionalContext;
  publicPages: {
    world: string;
    console: string;
    watch: string;
    api: string;
    agent?: string;
    explorer?: string;
    region?: string;
  };
}

export interface EpochServerHostedActionRun {
  session: EpochHostedSession;
  action: EpochHostedActionRecord;
}

export interface EpochExplorationRun {
  agentId: string;
  explorerId: string;
  regionId: string;
  mandate: string;
  stepCount: number;
  sessions: readonly EpochHostedSession[];
  actions: readonly EpochHostedActionRecord[];
  resultPage: EpochSharedResultPage;
  metrics?: EpochExplorationMetrics;
}

export interface EpochExplorationMetrics {
  combatPower: number;
  rating: number;
  intensity: "low" | "medium" | "high";
  riskBreakdown: {
    low: number;
    medium: number;
    high: number;
  };
  resourceDelta: Record<string, number>;
  attributeDelta: Record<string, number>;
  memoryDelta: {
    confirmed: number;
    rumor: number;
    private: number;
  };
}

export type EpochServerHostedJobStatus = "queued" | "completed" | "skipped";

export interface EpochServerHostedJob {
  jobId: string;
  agentId: string;
  explorerId: string;
  regionId: string;
  mandate: string;
  optionKey: "observe" | "assist" | "anomaly";
  visibleText?: string;
  deliveryTrust: "server_hosted_agent";
  status: EpochServerHostedJobStatus;
  queuedBy: string;
  queuedAt: string;
  sessionId?: string;
  actionId?: string;
  completedAt?: string;
  skipReason?: "action_option_unavailable";
  skippedAt?: string;
}

export interface EpochServerHostedJobsInfo {
  agentId?: string;
  status?: string;
  jobs: readonly EpochServerHostedJob[];
}

export interface EpochServerHostedJobRun {
  job: EpochServerHostedJob;
  run?: EpochServerHostedActionRun;
}

export interface EpochWebBridgeActionOption {
  actionOptionId: string;
  label: string;
  risk: EpochHostedActionRisk;
  socialHookId?: string;
}

export interface EpochWebBridgeTurn {
  sessionId: string;
  agentId: string;
  regionId: string;
  mandate: string;
  channelClass: "browser_copy_paste";
  deliveryTrust: "untrusted_client";
  actionOptions: readonly EpochWebBridgeActionOption[];
  copyPrompt: string;
}

export interface EpochWebBridgeActionResult {
  channelClass: "browser_copy_paste";
  deliveryTrust: "untrusted_client";
  action: EpochHostedActionRecord;
}

export interface EpochProjection {
  events: readonly EpochEvent[];
  identities: Record<string, EpochAgentIdentity>;
  lineage: Record<string, readonly string[]>;
  resourceBalances: Record<string, Partial<Record<EpochResourceId, number>>>;
  downtime: Record<string, EpochDowntimeState>;
  downtimeDiaryEntries: Record<string, EpochDowntimeDiaryEntry>;
  downtimeDiaryIdsByAgent: Record<string, readonly string[]>;
  regionActivities: Record<string, EpochRegionActivity>;
  regionActivityIdsByRegion: Record<string, readonly string[]>;
  npcs: Record<string, EpochNpcRecord>;
  npcIdsByKey: Record<string, string>;
  npcCandidates: Record<string, EpochNpcCandidate>;
  npcCandidateIdsByRegion: Record<string, readonly string[]>;
  npcCandidateIdsByAgent: Record<string, readonly string[]>;
  npcRelationships: Record<string, EpochNpcRelationship>;
  npcRelationshipIdsByNpc: Record<string, readonly string[]>;
  npcRelationshipIdsByRegion: Record<string, readonly string[]>;
  agentNpcBonds: Record<string, EpochAgentNpcBond>;
  agentNpcBondIdsByAgent: Record<string, readonly string[]>;
  agentNpcBondIdsByNpc: Record<string, readonly string[]>;
  agentNpcBondIdsByRegion: Record<string, readonly string[]>;
  npcMemories: Record<string, EpochNpcMemory>;
  npcMemoryIdsByNpc: Record<string, readonly string[]>;
  npcMemoryIdsByRegion: Record<string, readonly string[]>;
  households: Record<string, EpochHousehold>;
  householdIdsByNpc: Record<string, readonly string[]>;
  householdIdsByRegion: Record<string, readonly string[]>;
  organizations: Record<string, EpochOrganization>;
  organizationMemberships: Record<string, EpochOrganizationMembership>;
  organizationMembershipIdsByNpc: Record<string, readonly string[]>;
  organizationMembershipIdsByRegion: Record<string, readonly string[]>;
  organizationMembershipIdsByOrganization: Record<string, readonly string[]>;
  organizationPolitics: Record<string, EpochOrganizationPoliticsRecord>;
  organizationPoliticsIdsByRegion: Record<string, readonly string[]>;
  organizationPoliticsIdsByOrganization: Record<string, readonly string[]>;
  organizationPoliticsIdsByNpc: Record<string, readonly string[]>;
  organizationPoliticalStandingByOrganization: Record<string, number>;
  organizationBudgets: Record<string, EpochOrganizationBudget>;
  organizationBudgetIdsByOrganization: Record<string, readonly string[]>;
  npcCareerRecords: Record<string, EpochNpcCareerRecord>;
  npcCareerIdsByNpc: Record<string, readonly string[]>;
  npcCareerIdsByRegion: Record<string, readonly string[]>;
  npcLocationRecords: Record<string, EpochNpcLocationRecord>;
  npcLocationIdsByNpc: Record<string, readonly string[]>;
  npcLocationIdsByRegion: Record<string, readonly string[]>;
  npcAssetStates: Record<string, EpochNpcAssetState>;
  npcAssetIdsByNpc: Record<string, readonly string[]>;
  npcAssetIdsByRegion: Record<string, readonly string[]>;
  npcAssetBalancesByNpc: Record<string, Record<string, number>>;
  npcHealthStates: Record<string, EpochNpcHealthState>;
  npcHealthIdsByNpc: Record<string, readonly string[]>;
  npcHealthIdsByRegion: Record<string, readonly string[]>;
  inventoryItems: Record<string, EpochInventoryItem>;
  inventoryItemIdsByAgent: Record<string, readonly string[]>;
  inventoryItemIdsByExplorer: Record<string, readonly string[]>;
  socialHooks: Record<string, EpochSocialHook>;
  socialHookIdsByRegion: Record<string, readonly string[]>;
  socialHookIdsByNpc: Record<string, readonly string[]>;
  regionNews: Record<string, readonly EpochRegionNews[]>;
  worldMessages: readonly EpochMessageRecord[];
  regionMessages: Record<string, readonly EpochMessageRecord[]>;
  legendAwards: Record<string, EpochLegendAward>;
  legendAwardIdsByNews: Record<string, readonly string[]>;
  legendAwardIdsByAgent: Record<string, readonly string[]>;
  contestedObjectives: Record<string, EpochContestedObjective>;
  objectiveIdsByRegion: Record<string, readonly string[]>;
  resourceNodes: Record<string, EpochResourceNode>;
  resourceNodeIdsByRegion: Record<string, readonly string[]>;
  anomalyEvents: Record<string, EpochAnomalyEvent>;
  anomalyEventIdsByRegion: Record<string, readonly string[]>;
  seasonCampaigns: Record<string, EpochSeasonCampaign>;
  seasonObjectives: Record<string, EpochSeasonObjective>;
  seasonObjectiveIdsBySeason: Record<string, readonly string[]>;
  seasonCampaignIdsByRegion: Record<string, readonly string[]>;
  seasonCampaignIdsByFaction: Record<string, readonly string[]>;
  regionInfluenceChanges: Record<string, EpochRegionInfluenceChange>;
  regionInfluenceIdsByRegion: Record<string, readonly string[]>;
  regionInfluenceIdsByAgent: Record<string, readonly string[]>;
  conflictTraces: Record<string, EpochConflictTrace>;
  traceIdsByRegion: Record<string, readonly string[]>;
  traceIdsByAgent: Record<string, readonly string[]>;
  regionControls: Record<string, EpochRegionControl>;
  regionMonuments: Record<string, EpochRegionMonument>;
  regionMonumentIdsByRegion: Record<string, readonly string[]>;
  marketOrders: Record<string, EpochMarketOrder>;
  directTrades: Record<string, EpochDirectTrade>;
  bounties: Record<string, EpochBounty>;
  bountyIdsByRegion: Record<string, readonly string[]>;
  bountyIdsByAgent: Record<string, readonly string[]>;
  partyRuns: Record<string, EpochPartyRun>;
  partyRunIdsByRegion: Record<string, readonly string[]>;
  raidResults: Record<string, EpochRaidResult>;
  raidIdsByRegion: Record<string, readonly string[]>;
  retaliationOpportunities: Record<string, EpochRetaliationOpportunity>;
  retaliationIdsByRegion: Record<string, readonly string[]>;
  retaliationIdsByAgent: Record<string, readonly string[]>;
  diplomacyRecords: Record<string, EpochDiplomacyRecord>;
  diplomacyIdsByRegion: Record<string, readonly string[]>;
  diplomacyIdsByAgent: Record<string, readonly string[]>;
  relationshipEdges: Record<string, EpochRelationshipEdge>;
  relationshipIdsByAgent: Record<string, readonly string[]>;
  turnCards: Record<string, EpochTurnCard>;
  hostedSessions: Record<string, EpochHostedSession>;
  serverHostedJobs: Record<string, EpochServerHostedJob>;
  serverHostedJobIdsByAgent: Record<string, readonly string[]>;
  attestationRecords: Record<string, EpochAttestationRecord>;
  moderationItems: Record<string, EpochModerationItem>;
}

export interface EpochRuntimeResult<TValue> {
  value: TValue;
  events: readonly EpochEvent[];
  projection: EpochProjection;
  duplicate?: boolean;
}

export interface EpochProgressView {
  agentId?: string;
  explorerId?: string;
  identity?: EpochAgentIdentity;
  lineage: readonly string[];
  identities: readonly EpochAgentIdentity[];
  attributes?: Record<string, number>;
  skills?: readonly EpochAgentSkillInfo[];
  resources: Partial<Record<EpochResourceId, number>>;
  resourceMedia: Partial<Record<EpochResourceId, EpochResourceMedia>>;
  inventoryItems: readonly EpochInventoryItem[];
  equipmentEffects: readonly EpochEquipmentEffectInfo[];
  downtime: EpochDowntimeState | null;
  custody: {
    agentId: string;
    custodyStatus: "free" | "imprisoned";
    reason: string;
    changedAt: string;
  } | null;
  downtimeMedia?: EpochDowntimeMedia;
  pendingDowntime: (EpochPendingDowntimePreview & { media?: EpochDowntimeMedia }) | null;
  actionEligibility: {
    statusField: "progress.identity.status";
    status: "active" | "archived" | "missing";
    canUseActiveTools: boolean;
    reason: string;
    activeOnlyTools: readonly string[];
    blockedTools: readonly string[];
  };
  claimableLegendNews: readonly EpochClaimableLegendNews[];
  downtimeDiaryEntries: readonly EpochDowntimeDiaryEntry[];
  personalityDrifts: readonly EpochPersonalityDrift[];
  identitySlots?: EpochIdentitySlotState;
  latestEvents: readonly EpochEvent[];
}

export interface EpochAgentSkillInfo {
  skillId?: string;
  id?: string;
  name?: string;
  label?: string;
  level?: number;
  rank?: string;
  summary?: string;
  description?: string;
  source?: string;
}

export type EpochRegionCommissionSourceType = "objective" | "resource_node" | "anomaly" | "bounty" | "party_run" | "social_hook";
export type EpochSecretExposureTier =
  | "T0_public"
  | "T1_low_rumor"
  | "T2_local_secret"
  | "T3_core_secret"
  | "T4_forbidden_core";

export type EpochPrefileIsolationLayer = "active" | "prefile";
export type EpochPrefileIsolationReason = "public" | "low_exposure" | "chapter_locked";

export interface EpochPrefileIsolation {
  layer: EpochPrefileIsolationLayer;
  reason: EpochPrefileIsolationReason;
  settlementEligible: boolean;
  rewardEligible: boolean;
  territoryEligible: boolean;
  battleEligible: boolean;
  futureHookOnly: boolean;
  futureHook: string;
}

export interface EpochLocationMotifBias {
  motif: EpochLocationMotif;
  label: string;
  taskBias: string;
  rewardResourceId: EpochResourceId;
  rewardBias: string;
  summary: string;
}

export interface EpochSecretRevealBudget {
  budgetKey: string;
  topic: EpochRegionCommissionSourceType;
  explorerId: string;
  agentId: string;
  locationId: string;
  chapterKey: string;
  threshold: number;
  spent: number;
  remaining: number;
  chapterLocked: boolean;
  lockReason?: string;
}

export interface EpochRegionCommission {
  commissionId: string;
  regionId: string;
  sourceType: EpochRegionCommissionSourceType;
  sourceId: string;
  secretExposureTier: EpochSecretExposureTier;
  secretRevealBudget: EpochSecretRevealBudget;
  prefileIsolation: EpochPrefileIsolation;
  locationMotifBias: EpochLocationMotifBias;
  media: EpochActivityMedia;
  title: string;
  summary: string;
  status: "open" | "settled";
  actionLabel: string;
  reward?: {
    resourceId: EpochResourceId;
    amount: number;
    reason: string;
  };
  risk?: EpochHostedActionRisk | EpochAnomalySeverity;
  progress?: {
    current: number;
    target?: number;
  };
  leaderAgentId?: string;
  canonical: true;
  createdAt: string;
}

export interface EpochRegionActiveAgent {
  agentId: string;
  explorerId: string;
  identityName: string;
  status: EpochAgentIdentity["status"];
  generation: number;
  lifetimeRemaining: number;
  legend: number;
  resources: Partial<Record<EpochResourceId, number>>;
  lastActivity: {
    sourceEventType: EpochEventType | "downtime_active";
    sourceEventId?: string;
    summary: string;
    occurredAt: string;
  };
  publicPages: {
    agent: string;
    explorer: string;
    archive?: string;
  };
}

export type EpochLocationMotif = "ecology" | "creature" | "faction" | "anomaly" | "resource" | "character";
export type EpochLocationMotifDensityStatus = "within_quota" | "dense";
export type EpochLocationMotifDisplayMode = "normal" | "aggregate" | "downrank";

export interface EpochLocationMotifQuota {
  regionId: string;
  motif: EpochLocationMotif;
  label: string;
  count: number;
  quota: number;
  status: EpochLocationMotifDensityStatus;
  displayMode: EpochLocationMotifDisplayMode;
  summary: string;
}

export interface EpochRegionInfo {
  regionId: string;
  media?: EpochRegionMedia;
  campaignKeyArt: readonly EpochCampaignKeyArtMedia[];
  ambienceScenes: readonly EpochAmbienceSceneMedia[];
  worldScenes: readonly EpochWorldSceneMedia[];
  sceneVariants: readonly EpochSceneVariantMedia[];
  eventStateMedia: readonly EpochEventStateMedia[];
  activeAgents: readonly EpochRegionActiveAgent[];
  news: readonly EpochRegionNews[];
  messages: readonly EpochMessageRecord[];
  leaderboard: readonly EpochRegionLeaderboardEntry[];
  marketSummary: EpochRegionMarketSummary;
  marketOrders: readonly EpochMarketOrder[];
  directTrades: readonly EpochDirectTrade[];
  influenceChanges: readonly EpochRegionInfluenceChange[];
  activities: readonly EpochRegionActivity[];
  traces: readonly EpochConflictTrace[];
  retaliations: readonly EpochRetaliationOpportunity[];
  raidHeat: EpochRegionRaidHeat;
  eligibleRaidTargets: readonly EpochRegionEligibleRaidTarget[];
  factionPressure: readonly EpochRegionFactionPressure[];
  frontlines: readonly EpochRegionFrontline[];
  diplomacy: readonly EpochDiplomacyRecord[];
  regionControl?: EpochRegionControl;
  monuments: readonly EpochRegionMonument[];
  npcs: readonly EpochNpcRecord[];
  npcCandidates: readonly EpochNpcCandidate[];
  relationships: readonly EpochNpcRelationship[];
  agentNpcBonds: readonly EpochAgentNpcBond[];
  memories: readonly EpochNpcMemory[];
  households: readonly EpochHousehold[];
  organizations: readonly EpochOrganization[];
  organizationMemberships: readonly EpochOrganizationMembership[];
  organizationPolitics: readonly EpochOrganizationPoliticsRecord[];
  careers: readonly EpochNpcCareerRecord[];
  locations: readonly EpochNpcLocationRecord[];
  assetStates: readonly EpochNpcAssetState[];
  healthStates: readonly EpochNpcHealthState[];
  socialHooks: readonly EpochSocialHook[];
  partyRuns: readonly EpochPartyRun[];
  commissions: readonly EpochRegionCommission[];
  motifQuotas: readonly EpochLocationMotifQuota[];
  objectives: readonly EpochContestedObjective[];
  resourceNodes: readonly EpochResourceNode[];
  anomalies: readonly EpochAnomalyEvent[];
  seasons: readonly EpochSeasonCampaign[];
}

export type EpochRegionRaidHeatStatus = "quiet" | "warm" | "hot";

export interface EpochRegionRaidHeat {
  regionId: string;
  heatScore: number;
  recentRaidCount: number;
  activePairCount: number;
  repeatRaidCount: number;
  status: EpochRegionRaidHeatStatus;
  latestRaidId?: string;
  latestRaidAt?: string;
}

export interface EpochRegionEligibleRaidTarget {
  eligibilityId: string;
  regionId: string;
  attackerAgentId: string;
  attackerExplorerId: string;
  attackerFactionId: string;
  targetAgentId: string;
  targetExplorerId: string;
  targetFactionId: string;
  targetSeasonScore: number;
  targetDefensePower: number;
  sourceSeasonIds: readonly string[];
  latestPairRaidId?: string;
  latestPairRaidAt?: string;
}

export interface EpochNpcLifecycleTick {
  tickedAt: string;
  updated: readonly EpochNpcRecord[];
  relationships: readonly EpochNpcRelationship[];
  memories: readonly EpochNpcMemory[];
  households: readonly EpochHousehold[];
  organizationMemberships: readonly EpochOrganizationMembership[];
  careers: readonly EpochNpcCareerRecord[];
  locations: readonly EpochNpcLocationRecord[];
  assetStates: readonly EpochNpcAssetState[];
  healthStates: readonly EpochNpcHealthState[];
  socialHooks: readonly EpochSocialHook[];
}

export interface EpochOrganizationPoliticsTick {
  tickedAt: string;
  politics: readonly EpochOrganizationPoliticsRecord[];
}

export type EpochResultPageReceiptFocusKind = "turn_card" | "hosted_session" | "agent_snapshot" | "explorer_snapshot";

export interface EpochResultPageReceiptEvent {
  eventId: string;
  eventType: EpochEventType;
  aggregateType: string;
  aggregateId: string;
  trustClass: EpochDeliveryTrust | string;
  createdAt: string;
  auditUrl: string;
}

export interface EpochResultPageReceipt {
  receiptType: "server_result_receipt";
  payloadHash: string;
  generatedAt: string;
  channelClass?: EpochChannelClass | EpochDeliveryTrust | string;
  deliveryTrust?: EpochDeliveryTrust | string;
  agentId?: string;
  explorerId?: string;
  focus: {
    kind: EpochResultPageReceiptFocusKind;
    id: string;
  };
  trustClasses: readonly (EpochDeliveryTrust | string)[];
  canonicalEvents: readonly EpochResultPageReceiptEvent[];
}

export type EpochPublicSafeSummaryExcludedSourceClass =
  | "adjudication_verdict"
  | "review_reason"
  | "hidden_constraint_prompt"
  | "event_payload_body";

export interface EpochPublicSafeSummary {
  summaryType: "public_safe_summary";
  source: "server_public_summary";
  text: string;
  excludedSourceClasses: readonly EpochPublicSafeSummaryExcludedSourceClass[];
}

export interface EpochResultPageRegionalContext {
  regionId: string;
  regionControl?: EpochRegionControl | null;
  messages: readonly EpochMessageRecord[];
  news: readonly EpochRegionNews[];
  commissions: readonly EpochRegionCommission[];
  raids: readonly EpochRaidResult[];
  retaliations: readonly EpochRetaliationOpportunity[];
  traces: readonly EpochConflictTrace[];
}

export type EpochResultPageRunKind =
  | "single_turn"
  | "one_shot_journey"
  | "hosted_journey"
  | "agent_snapshot";

export type EpochResultPageRunEndingReason =
  | "completed"
  | "early_exit"
  | "archived"
  | "snapshot";

export interface EpochResultPageRunSummary {
  runKind: EpochResultPageRunKind;
  title: string;
  startedAt: string;
  settledAt: string;
  stepCount: number;
  endingReason: EpochResultPageRunEndingReason;
}

export interface EpochResultPage {
  pageType: "agent_result";
  generatedAt: string;
  publicSafeSummary: EpochPublicSafeSummary;
  progress: EpochProgressView;
  runSummary?: EpochResultPageRunSummary;
  receipt: EpochResultPageReceipt;
  regionalContext?: EpochResultPageRegionalContext;
  publishToken?: string;
  focusTurnCard?: EpochTurnCard;
  focusHostedSession?: EpochHostedSession;
}

export interface EpochAgentBriefingWorldSummary {
  publicPages: EpochWorldOverviewInfo["publicPages"];
  news: readonly EpochRegionNews[];
  regionHighlights: readonly EpochWorldOverviewRegionHighlight[];
  activeSeasons: readonly EpochSeasonCampaign[];
}

export interface EpochAgentBriefingView {
  generatedAt: string;
  agentId?: string;
  explorerId?: string;
  regionId?: string;
  progress: EpochProgressView;
  regionalContext?: EpochResultPageRegionalContext;
  world: EpochAgentBriefingWorldSummary;
  publicPages: {
    world: string;
    console: string;
    agent?: string;
    explorer?: string;
    region?: string;
    archive?: string;
  };
}

export type EpochDeletionRequestCategory =
  | "hide_body"
  | "anonymize_source"
  | "withdraw_unadmitted_candidate"
  | "request_de_admission_review";
export type EpochDeletionRequestCategoryStatus = "completed" | "available" | "not_applicable" | "review_required";

export interface EpochDeletionRequestCategoryInfo {
  category: EpochDeletionRequestCategory;
  label: string;
  status: EpochDeletionRequestCategoryStatus;
  summary: string;
}

export interface EpochDeletionRequestClassification {
  selectedCategory: EpochDeletionRequestCategory;
  selectedLabel: string;
  categories: readonly EpochDeletionRequestCategoryInfo[];
  sharedSettingRule: {
    referencedByMultiple: "request_de_admission_review_only";
    summary: string;
  };
}

export interface EpochDeletedResultPageReferenceFact {
  key: "pageId" | "focusKind" | "focusIdHash" | "canonicalEventCount";
  value: string | number;
}

export interface EpochDeletedResultPageMinimalReference {
  referenceType: "deleted_result_page_minimal_reference";
  anonymousSourceHash: string;
  claimFacts: readonly EpochDeletedResultPageReferenceFact[];
  removedBodyClasses: readonly string[];
}

export interface EpochResultPageDeletionSummary {
  pageId: string;
  createdAt: string;
  expiresAt?: string;
  createdBy: string;
  ownerExplorerId: string;
  agentId?: string;
  explorerId?: string;
  receiptFocus: EpochResultPageReceipt["focus"];
  receiptPayloadHash: string;
  fullPayloadHash: string;
  canonicalEventIds: readonly string[];
  minimalReference: EpochDeletedResultPageMinimalReference;
  deletedAt: string;
  deletedBy: string;
  deleteReason: string;
  deletionRequest?: EpochDeletionRequestClassification;
  retainedFacts: readonly string[];
}

export interface EpochSharedResultPage {
  pageId: string;
  createdAt: string;
  expiresAt?: string;
  urlPath: string;
  payload?: EpochResultPage;
  publicSafeSummary?: EpochPublicSafeSummary;
  createdBy: string;
  idempotencyKey: string;
  status?: "active" | "revoked" | "deleted";
  shareVersion?: number;
  shareTokenHash?: string;
  revokedAt?: string;
  revokedBy?: string;
  revokeReason?: string;
  deletedAt?: string;
  deletedBy?: string;
  deleteReason?: string;
  deletionSummary?: EpochResultPageDeletionSummary;
}

export type EpochHighValueConfirmationAction = "world_message" | "turn_card" | "resolve_turn";
export type EpochHighValueConfirmationStatus = "pending" | "confirmed" | "consumed" | "expired";

export interface EpochHighValueConfirmation {
  confirmationId: string;
  action: EpochHighValueConfirmationAction;
  agentId: string;
  explorerId: string;
  subjectHash: string;
  summary: string;
  status: EpochHighValueConfirmationStatus;
  createdAt: string;
  expiresAt: string;
  confirmedAt?: string;
  consumedAt?: string;
}

export interface EpochHighValueConfirmationRequestResult {
  confirmation: EpochHighValueConfirmation;
  duplicate?: boolean;
}

export interface EpochHighValueConfirmationConfirmResult {
  confirmation: EpochHighValueConfirmation;
  confirmationToken: string;
  duplicate?: boolean;
}

export interface EpochHighValueConfirmationListResult {
  explorerId: string;
  total: number;
  confirmations: readonly EpochHighValueConfirmation[];
}

export interface CreateEpochResultPageResponse {
  page: EpochSharedResultPage;
  duplicate?: boolean;
}

export interface EpochInstallManifest {
  name: string;
  version: string;
  serverBase: string;
  mcpCommand: string;
  packageUrl: string;
  publicPages: {
    console: string;
    install: string;
    world: string;
    explorer: string;
    agent: string;
    region: string;
    season: string;
    npc: string;
    archive: string;
    audit: string;
    result: string;
  };
  assets?: {
    bosses?: readonly {
      templateKey: string;
      title: string;
      path: string;
      url: string;
      contentType: string;
      width: number;
      height: number;
      sha256: string;
    }[];
    locations?: readonly {
      regionId: string;
      title: string;
      subtitle: string;
      path: string;
      url: string;
      contentType: string;
      width: number;
      height: number;
      sha256: string;
    }[];
    items?: readonly {
      itemKey: string;
      title: string;
      subtitle: string;
      path: string;
      url: string;
      contentType: string;
      width: number;
      height: number;
      sha256: string;
    }[];
    resources?: readonly {
      resourceId: string;
      title: string;
      subtitle: string;
      path: string;
      url: string;
      contentType: string;
      width: number;
      height: number;
      sha256: string;
    }[];
    downtimeModes?: readonly {
      mode: string;
      title: string;
      subtitle: string;
      path: string;
      url: string;
      contentType: string;
      width: number;
      height: number;
      sha256: string;
    }[];
    activities?: readonly {
      activityKey: string;
      title: string;
      subtitle: string;
      path: string;
      url: string;
      contentType: string;
      width: number;
      height: number;
      sha256: string;
    }[];
    relationships?: readonly {
      relationshipKey: string;
      title: string;
      subtitle: string;
      path: string;
      url: string;
      contentType: string;
      width: number;
      height: number;
      sha256: string;
    }[];
    worldSurfaces?: readonly {
      surfaceKey: string;
      title: string;
      subtitle: string;
      path: string;
      url: string;
      contentType: string;
      width: number;
      height: number;
      sha256: string;
    }[];
    pageScenes?: readonly {
      sceneKey: string;
      title: string;
      subtitle: string;
      path: string;
      url: string;
      contentType: string;
      width: number;
      height: number;
      sha256: string;
    }[];
    campaignKeyArt?: readonly {
      campaignKey: string;
      title: string;
      subtitle: string;
      path: string;
      url: string;
      contentType: string;
      width: number;
      height: number;
      sha256: string;
    }[];
    ambienceScenes?: readonly {
      sceneKey: string;
      title: string;
      subtitle: string;
      path: string;
      url: string;
      contentType: string;
      width: number;
      height: number;
      sha256: string;
    }[];
    eventStates?: readonly {
      stateKey: string;
      title: string;
      subtitle: string;
      path: string;
      url: string;
      contentType: string;
      width: number;
      height: number;
      sha256: string;
    }[];
    worldScenes?: readonly {
      sceneKey: string;
      regionId: string;
      title: string;
      subtitle: string;
      path: string;
      url: string;
      contentType: string;
      width: number;
      height: number;
      sha256: string;
    }[];
    sceneVariants?: readonly {
      variantKey: string;
      regionId: string;
      title: string;
      subtitle: string;
      path: string;
      url: string;
      contentType: string;
      width: number;
      height: number;
      timeOfDay: string;
      weather: string;
      sha256: string;
    }[];
    npcs?: readonly {
      archetypeKey: string;
      title: string;
      subtitle: string;
      path: string;
      url: string;
      contentType: string;
      width: number;
      height: number;
      sha256: string;
    }[];
    factions?: readonly {
      factionId: string;
      title: string;
      subtitle: string;
      path: string;
      url: string;
      contentType: string;
      width: number;
      height: number;
      sha256: string;
    }[];
    seasonBanners?: readonly {
      seasonKey: string;
      title: string;
      subtitle: string;
      path: string;
      url: string;
      contentType: string;
      width: number;
      height: number;
      sha256: string;
    }[];
  };
  playbooks: {
    oneTurn: string;
    smokeE2E: string;
  };
  hosts: readonly string[];
  tools: readonly string[];
  skill: {
    name: string;
    recommendedPath: string;
  };
}
