import type {
  CommunityAbuseContext,
  CommunityAbuseContextInput,
  CommunityAbuseContextResolver,
} from "./community.ts";
import { buildPublicWorldView } from "./community.ts";
import type { createLoreLedger } from "./lore.ts";
import type { createFactionLedger } from "./factions.ts";
import type { EpochOperationGateInput } from "./operationSwitches.ts";
import type { IdentityStrategyDisposition } from "./epoch/journeyStrategyRules.ts";
import type { ExpectedLifePattern } from "./epoch/journeyRoleplayRules.ts";

export type AnyRecord = Record<string, unknown>;

type ContextSnapshotRecord = AnyRecord & {
  readonly versions: AnyRecord;
  readonly retrievalParams: AnyRecord;
  readonly filteringReasons: string[];
  readonly settingCards: AnyRecord[];
};

type RuntimeOptions = AnyRecord & {
  submittedRuns?: readonly object[];
  repairTickets?: readonly object[];
  feedbackEvents?: readonly object[];
  transparencyEntries?: readonly object[];
  transparencyAnchors?: readonly object[];
  epochEvents?: readonly object[];
  resultPages?: readonly object[];
  contextSnapshots?: readonly object[];
  outbox?: object;
  outboxEvents?: readonly object[];
  journeyEvents?: readonly object[];
  infiniteWorld?: AnyRecord;
};

type McpToolDefinition = {
  readonly name: string;
  readonly description?: string;
  readonly inputSchema: AnyRecord & {
    readonly required: string[];
    readonly properties: Record<string, unknown>;
  };
  readonly annotations?: AnyRecord;
};

type McpToolResult = {
  readonly content: Array<{ readonly type: string; readonly text: string }>;
  readonly events: AnyRecord[];
};

// ─── Constants ──────────────────────────────────────────────────────────────

const LEGACY_EVENT_RISKS = new Set(["low", "medium", "high"]);
const LEGACY_RISK_ORDER = ["low", "medium", "high"];

const EPOCH_OWNER_RECOVERY_NON_ACTIVE_IDENTITY_TOOLS = [
  "obsidian_epoch.identity",
  "obsidian_epoch.rotate_recovery",
  "obsidian_epoch.reincarnate",
  "obsidian_epoch.player_data_export",
  "obsidian_epoch.player_panel",
  "obsidian_epoch.ten_run_audit",
  "obsidian_epoch.owner_trace_conflicts",
  "obsidian_epoch.owner_trace_conflict_memories",
  "obsidian_epoch.revoke_result_page",
  "obsidian_epoch.delete_result_page",
  "obsidian_epoch.agent_briefing",
  "obsidian_epoch.journey_status",
  "obsidian_epoch.journey_album",
] as const;

const EPOCH_OPERATOR_TARGET_ACTIVE_IDENTITY_TOOLS = [
  "obsidian_epoch.create_item",
  "obsidian_epoch.claim_region_control",
  "obsidian_epoch.run_server_hosted_action",
  "obsidian_epoch.queue_server_hosted_action",
  "obsidian_epoch.run_server_hosted_job",
] as const;

const EPOCH_NON_RECOVERY_TARGET_ACTIVE_IDENTITY_TOOLS = [
  "obsidian_epoch.post_message",
  "obsidian_epoch.request_confirmation",
  "obsidian_epoch.tick_downtime",
  "obsidian_epoch.submit_attested_action",
] as const;

const EPOCH_CORE_ACTIVE_IDENTITY_EXCLUDED_METHODS = [
  "adjustLifetime",
  "grantAttribute",
  "grantResource",
  "spendResource",
] as const;

const EPOCH_CORE_ACTIVE_IDENTITY_METHOD_TOOL_COVERAGE = [
  { coreMethod: "confirmPersonalityDrift", tools: ["obsidian_epoch.confirm_personality_drift"] },
  { coreMethod: "archiveIdentity", tools: ["obsidian_epoch.archive_identity"] },
  { coreMethod: "setDowntime", tools: ["obsidian_epoch.set_downtime"] },
  { coreMethod: "claimDowntime", tools: ["obsidian_epoch.claim_downtime"] },
  { coreMethod: "tickDowntime", tools: ["obsidian_epoch.tick_downtime"] },
  { coreMethod: "submitNpcCandidate", tools: ["obsidian_epoch.submit_npc_candidate"] },
  { coreMethod: "postMessage", tools: ["obsidian_epoch.post_message"] },
  { coreMethod: "claimNewsLegend", tools: ["obsidian_epoch.claim_news_legend"] },
  { coreMethod: "recordLoreContribution", tools: ["obsidian_epoch.record_lore_contribution"] },
  { coreMethod: "contributeContestedObjective", tools: ["obsidian_epoch.contribute_objective"] },
  { coreMethod: "contestResourceNode", tools: ["obsidian_epoch.contest_resource_node"] },
  { coreMethod: "contestAnomalyEvent", tools: ["obsidian_epoch.contest_anomaly"] },
  { coreMethod: "createInventoryItem", tools: ["obsidian_epoch.create_item"] },
  { coreMethod: "craftInventoryItem", tools: ["obsidian_epoch.craft_item"] },
  { coreMethod: "purchaseShopOffer", tools: ["obsidian_epoch.purchase_shop_offer"] },
  { coreMethod: "bindInventoryItem", tools: ["obsidian_epoch.bind_item"] },
  { coreMethod: "contributeSeasonCampaign", tools: ["obsidian_epoch.contribute_season"] },
  { coreMethod: "claimReleasedRegionControl", tools: ["obsidian_epoch.claim_region_control"] },
  { coreMethod: "createMarketOrder", tools: ["obsidian_epoch.create_market_order"] },
  { coreMethod: "fillMarketOrder", tools: ["obsidian_epoch.fill_market_order"] },
  { coreMethod: "cancelMarketOrder", tools: ["obsidian_epoch.cancel_market_order"] },
  { coreMethod: "createDirectTrade", tools: ["obsidian_epoch.create_direct_trade"] },
  { coreMethod: "acceptDirectTrade", tools: ["obsidian_epoch.accept_direct_trade"] },
  { coreMethod: "cancelDirectTrade", tools: ["obsidian_epoch.cancel_direct_trade"] },
  { coreMethod: "createBounty", tools: ["obsidian_epoch.create_bounty"] },
  { coreMethod: "claimBounty", tools: ["obsidian_epoch.claim_bounty"] },
  { coreMethod: "createPartyRun", tools: ["obsidian_epoch.create_party_run"] },
  { coreMethod: "updatePartyInvite", tools: ["obsidian_epoch.update_party_invite"] },
  { coreMethod: "joinPartyRun", tools: ["obsidian_epoch.join_party_run"] },
  { coreMethod: "requestPartyJoin", tools: ["obsidian_epoch.request_party_join"] },
  { coreMethod: "resolvePartyJoinRequest", tools: ["obsidian_epoch.resolve_party_join_request"] },
  { coreMethod: "resolveRaid", tools: ["obsidian_epoch.resolve_raid"] },
  { coreMethod: "resolveRegionRevolt", tools: ["obsidian_epoch.resolve_region_revolt"] },
  { coreMethod: "resolveRetaliation", tools: ["obsidian_epoch.resolve_retaliation"] },
  { coreMethod: "updateOrganizationMembership", tools: ["obsidian_epoch.update_organization_membership"] },
  { coreMethod: "purchaseOrganizationUpgrade", tools: ["obsidian_epoch.purchase_organization_upgrade"] },
  { coreMethod: "contributeOrganizationTreasury", tools: ["obsidian_epoch.contribute_organization_treasury"] },
  { coreMethod: "proposeOrganizationBudget", tools: ["obsidian_epoch.propose_organization_budget"] },
  { coreMethod: "resolveOrganizationBudget", tools: ["obsidian_epoch.resolve_organization_budget"] },
  { coreMethod: "proposeDiplomacy", tools: ["obsidian_epoch.propose_diplomacy"] },
  { coreMethod: "respondDiplomacy", tools: ["obsidian_epoch.respond_diplomacy"] },
  { coreMethod: "updateRelationship", tools: ["obsidian_epoch.update_relationship"] },
  { coreMethod: "updateAgentNpcBond", tools: ["obsidian_epoch.update_agent_npc_bond"] },
  { coreMethod: "deployTraceConflict", tools: ["obsidian_epoch.deploy_trace_conflict"] },
  { coreMethod: "createTurnCard", tools: ["obsidian_epoch.turn_card"] },
  { coreMethod: "resolveTurnCard", tools: ["obsidian_epoch.resolve_turn"] },
  { coreMethod: "startHostedSession", tools: ["obsidian_epoch.start_hosted_session", "obsidian_epoch.run_server_hosted_action", "obsidian_epoch.web_bridge_turn"] },
  { coreMethod: "submitHostedAction", tools: ["obsidian_epoch.submit_hosted_action", "obsidian_epoch.run_server_hosted_action", "obsidian_epoch.run_server_hosted_job", "obsidian_epoch.submit_web_bridge_action", "obsidian_epoch.submit_attested_action"] },
  { coreMethod: "queueServerHostedJob", tools: ["obsidian_epoch.queue_server_hosted_action"] },
  { coreMethod: "canRunServerHostedJobOption", tools: ["obsidian_epoch.run_server_hosted_job"] },
] as const;

const REMOVED_LEGACY_AGENT_WORLD_TOOLS = new Set([
  "agent_world.context_package",
  "agent_world.context_snapshots",
  "agent_world.start_run",
  "agent_world.run_heartbeat",
  "agent_world.submit_battle_report",
  "agent_world.archive_local_report",
  "agent_world.outbox",
  "agent_world.replay_outbox",
  "agent_world.review_queue",
  "agent_world.public_world",
  "agent_world.progression_state",
  "agent_world.operation_check",
]);

/**
 * PR6: Prompt narrative helpers.
 */
const APPROACH_LABEL_CN: Readonly<Record<string, string>> = Object.freeze({
  combat: "战斗",
  stealth: "潜行",
  diplomacy: "外交",
  support: "支援",
  logistics: "后勤",
  scout: "侦察",
  preservation: "保全",
});

// ─── Record utilities ───────────────────────────────────────────────────────

function isRecord(value: unknown): value is AnyRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function recordValue(value: unknown): AnyRecord {
  return isRecord(value) ? value : {};
}

function recordArray(value: unknown): AnyRecord[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function cloneRecords(value: unknown): AnyRecord[] {
  return recordArray(value).map((record) => ({ ...record }));
}

function requireObject(value: unknown, name: string): AnyRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${name}_object_required`);
  }
  return value as AnyRecord;
}

// ─── String / number utilities ──────────────────────────────────────────────

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" && value ? value : fallback;
}

function optionalString(value: unknown) {
  return typeof value === "string" && value ? value : undefined;
}

function stringRecord(value: unknown, error: string): Record<string, string> {
  const input = recordValue(value);
  const result: Record<string, string> = {};
  for (const [key, item] of Object.entries(input)) {
    if (!key.trim() || typeof item !== "string" || !item.trim()) throw new Error(error);
    result[key.trim()] = item.trim();
  }
  return result;
}

/**
 * PR4 helper: read a finite number from an unknown value, returning the
 * fallback when the value is not a finite number.
 */
function numberFrom(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function numberValue(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function positiveIntegerValue(value: unknown, fallback: number) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
}

function nonNegativeIntegerValue(value: unknown, fallback: number) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : fallback;
}

function positiveNumberValue(value: unknown, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

/**
 * PR4 helper: map a string item rarity label from a legacy
 * JourneyRewardBundle.items[number].rarity into the numeric 0..3
 * form expected by BaseRewardBundle.items[number].baseRarityTier.
 */
function rarityTierNumeric(rarity: string | undefined | null): 0 | 1 | 2 | 3 {
  switch (rarity) {
    case "common": return 1;
    case "rare": return 2;
    case "legendary": return 3;
    default: return 0;
  }
}

// ─── Normalization utilities ────────────────────────────────────────────────

function normalizeLegacyActionType(actionType: string) {
  return actionType
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/^obsidian_epoch_/, "");
}

// ─── Operation / risk helpers ───────────────────────────────────────────────

function legacyRunRiskLevel(run: AnyRecord) {
  const eventRisks = recordArray(run.events)
    .map((event) => optionalString(event.risk))
    .filter((risk): risk is string => typeof risk === "string" && LEGACY_EVENT_RISKS.has(risk));
  const highest = eventRisks
    .sort((left, right) => LEGACY_RISK_ORDER.indexOf(right) - LEGACY_RISK_ORDER.indexOf(left))[0];
  return highest || optionalString(run.riskLevel) || optionalString(run.risk);
}

function legacyRunOperationDimensions(run: AnyRecord): Omit<EpochOperationGateInput, "action" | "rewardType"> {
  return {
    commissionType: optionalString(run.commissionType),
    chapterId: optionalString(run.chapterId),
    locationId: optionalString(run.locationId) || optionalString(run.regionId),
    factionId: optionalString(run.factionId),
    riskLevel: legacyRunRiskLevel(run),
  };
}

function operationDimensionsFromInput(input: AnyRecord): Omit<EpochOperationGateInput, "action" | "rewardType"> {
  return {
    commissionType: optionalString(input.commissionType),
    chapterId: optionalString(input.chapterId),
    locationId: optionalString(input.locationId) || optionalString(input.regionId),
    factionId: optionalString(input.factionId),
    riskLevel: optionalString(input.riskLevel) || optionalString(input.risk),
  };
}

function operationSwitchActionValue(value: unknown): EpochOperationGateInput["action"] {
  if (value === "public_sharing" || value === "source_reward") return value;
  return "settlement";
}

function legacyPublicClaimGate(run: AnyRecord, adjudication: AnyRecord) {
  const requiresConfirmation = adjudication.worldImpact === "review_candidate"
    && Number(adjudication.claimSlots || 0) > 0;
  const confirmed = requiresConfirmation
    && (run.publicAdjudicationConfirmed === true || run.publicClaimConsent === true);
  return {
    scope: "shared_lore_claims",
    required: requiresConfirmation,
    confirmed,
    status: requiresConfirmation
      ? confirmed
        ? "confirmed_public_adjudication"
        : "withheld_pending_public_adjudication_confirmation"
      : "not_applicable",
    reason: requiresConfirmation
      ? "shared_claims_require_explicit_public_adjudication_confirmation"
      : "shared_claims_not_eligible_for_public_adjudication",
  };
}

// ─── Failure publication helpers ────────────────────────────────────────────

function legacyFailurePublication(adjudication: AnyRecord) {
  const publication = recordValue(adjudication.failurePublication);
  return stringValue(publication.selectedMode) ? publication : null;
}

function legacyFailureClaimPreview(run: AnyRecord) {
  return recordArray(run.candidateClaims).map((claim) => ({
    subject: stringValue(claim.subject),
    predicate: stringValue(claim.predicate),
    object: stringValue(claim.object),
  })).filter((claim) => claim.subject && claim.predicate && claim.object);
}

function legacyFailurePublicFields(run: AnyRecord, adjudication: AnyRecord) {
  const failurePublication = legacyFailurePublication(adjudication);
  if (!failurePublication) return {};
  return {
    failurePublication: { ...failurePublication },
    ...(failurePublication.selectedMode === "claim_only"
      ? { claimPreview: legacyFailureClaimPreview(run) }
      : {}),
  };
}

function legacyPublicIndexIdentityFields(run: AnyRecord, adjudication: AnyRecord) {
  const failurePublication = legacyFailurePublication(adjudication);
  const identityDisclosure = stringValue(failurePublication?.identityDisclosure);
  if (identityDisclosure === "anonymous" || identityDisclosure === "none") return {};
  return {
    explorerId: optionalString(run.explorerId),
    agentId: optionalString(run.agentId),
  };
}

// ─── PR6: Prompt narrative helpers ──────────────────────────────────────────

/**
 * Build a strategy-tendency narrative string for prompt injection.
 *
 * HARD CONTRACT: no numeric values (score/fitBps/affinity) are exposed.
 * Pure narrative text only.
 */
function buildStrategyPromptNarrative(
  disposition: IdentityStrategyDisposition | undefined,
): string {
  if (!disposition) return "";
  const STRATEGY_LABEL_CN: Readonly<Record<string, string>> = Object.freeze({
    combat: "战斗",
    cunning: "诡计",
    support: "支援",
    logistics: "后勤",
    exploration: "探索",
  });
  const primaryLabel = STRATEGY_LABEL_CN[disposition.primary];
  if (!primaryLabel) return "";
  const secondaryLabel = disposition.secondary
    ? STRATEGY_LABEL_CN[disposition.secondary]
    : undefined;
  const parts = [`你一贯擅长${primaryLabel}风格的行动`];
  if (secondaryLabel) {
    parts.push(`你偶尔也会运用${secondaryLabel}的手段`);
  }
  return parts.join("。");
}

/**
 * Build an expected-life-pattern narrative string for prompt injection.
 *
 * HARD CONTRACT: no bps/score/tier/affinity/fit values are exposed.
 * Pure narrative text only.
 */
function buildLifePatternPromptNarrative(
  pattern: ExpectedLifePattern | undefined,
): string {
  if (!pattern) return "";
  const parts: string[] = [];
  if (pattern.expectedApproaches.length > 0) {
    const labels = pattern.expectedApproaches
      .map((tag) => APPROACH_LABEL_CN[tag])
      .filter(Boolean);
    if (labels.length > 0) {
      parts.push(`你的行动风格倾向于${labels.join("与")}`);
    }
  }
  if (pattern.forbiddenApproaches.length > 0) {
    const labels = pattern.forbiddenApproaches
      .map((tag) => APPROACH_LABEL_CN[tag])
      .filter(Boolean);
    if (labels.length > 0) {
      parts.push(`避免${labels.join("与")}类的行为`);
    }
  }
  return parts.join("，");
}

// ─── World view / community helpers ────────────────────────────────────────

function publicWorldView({
  loreLedger,
  factionLedger,
  submittedRuns,
}: {
  readonly loreLedger: ReturnType<typeof createLoreLedger>;
  readonly factionLedger: ReturnType<typeof createFactionLedger>;
  readonly submittedRuns: readonly AnyRecord[];
}) {
  return buildPublicWorldView({
    loreState: recordValue(loreLedger.state()),
    factionState: recordValue(factionLedger.state()),
    runs: submittedRuns,
  });
}

function uniqueCommunityExplorerIds(values: readonly unknown[], excludedExplorerId: string) {
  return [...new Set(values
    .map((value) => stringValue(value))
    .filter((value) => value && value !== excludedExplorerId))];
}

function communityTargetExplorerIds({
  targetType,
  targetId,
  actorExplorerId,
  loreState,
  factionState,
  submittedRuns,
  communityState,
  relationshipGraph,
}: {
  readonly targetType: string;
  readonly targetId: string;
  readonly actorExplorerId: string;
  readonly loreState: AnyRecord;
  readonly factionState: AnyRecord;
  readonly submittedRuns: readonly AnyRecord[];
  readonly communityState: AnyRecord;
  readonly relationshipGraph: AnyRecord;
}) {
  const candidateExplorerIds: unknown[] = [];
  if (targetType === "run") {
    candidateExplorerIds.push(...submittedRuns
      .filter((run) => stringValue(run.runTicket) === targetId)
      .filter((run) => run.visibility === "public"
        || run.worldImpact === "review_candidate"
        || recordValue(run.failurePublication).publicArchive === true)
      .map((run) => run.explorerId));
  }
  const claims = recordArray(loreState.claims);
  if (targetType === "claim") {
    const claim = claims.find((item) => stringValue(item.claimId) === targetId);
    candidateExplorerIds.push(...recordArray(claim?.sources).map((source) => source.explorerId));
  }
  if (targetType === "conflict") {
    const conflict = recordArray(loreState.conflicts)
      .find((item) => stringValue(item.conflictId) === targetId);
    const claimIds = Array.isArray(conflict?.claimIds) ? conflict.claimIds.map(String) : [];
    for (const claim of claims) {
      if (!claimIds.includes(stringValue(claim.claimId))) continue;
      candidateExplorerIds.push(...recordArray(claim.sources).map((source) => source.explorerId));
    }
  }
  if (targetType === "faction") {
    const faction = recordArray(factionState.factions)
      .find((item) => stringValue(item.factionId) === targetId);
    candidateExplorerIds.push(...recordArray(faction?.sources).map((source) => source.explorerId));
  }
  if (targetType === "comment") {
    const comment = recordArray(communityState.comments)
      .find((item) => stringValue(item.commentId) === targetId);
    candidateExplorerIds.push(comment?.explorerId);
  }
  for (const relationship of recordArray(relationshipGraph.relationships)) {
    if (stringValue(relationship.sourceAgentId) === targetId) candidateExplorerIds.push(relationship.sourceExplorerId);
    if (stringValue(relationship.targetAgentId) === targetId) candidateExplorerIds.push(relationship.targetExplorerId);
  }
  return uniqueCommunityExplorerIds(candidateExplorerIds, actorExplorerId);
}

function runtimeCommunityAbuseContext({
  input,
  loreState,
  factionState,
  submittedRuns,
  communityState,
  relationshipGraph,
  configuredResolver,
}: {
  readonly input: CommunityAbuseContextInput;
  readonly loreState: AnyRecord;
  readonly factionState: AnyRecord;
  readonly submittedRuns: readonly AnyRecord[];
  readonly communityState: AnyRecord;
  readonly relationshipGraph: AnyRecord;
  readonly configuredResolver?: CommunityAbuseContextResolver;
}): CommunityAbuseContext | undefined {
  const configured = configuredResolver?.(input) || {};
  const targetExplorerIds = communityTargetExplorerIds({
    targetType: input.targetType,
    targetId: input.targetId,
    actorExplorerId: input.explorerId,
    loreState,
    factionState,
    submittedRuns,
    communityState,
    relationshipGraph,
  });
  const derivedAgainstExplorerId = targetExplorerIds.length === 1
    ? targetExplorerIds[0]
    : undefined;
  if (!derivedAgainstExplorerId && !configured.againstExplorerId && !configured.groupId) return undefined;
  return {
    ...(derivedAgainstExplorerId ? { againstExplorerId: derivedAgainstExplorerId } : {}),
    ...(configured.againstExplorerId ? { againstExplorerId: configured.againstExplorerId } : {}),
    ...(configured.groupId ? { groupId: configured.groupId } : {}),
  };
}

// ─── Journey decision world slice ────────────────────────────────────────────

export function compactJourneyDecisionWorldSlice(value: unknown) {
  const slice = recordValue(value);
  const sliceHash = optionalString(slice.sliceHash);
  if (!sliceHash) return undefined;
  const start = recordValue(slice.start);
  const end = recordValue(slice.end);
  const direction = recordValue(slice.direction);
  const strongestResourceTrends = (field: "stockDelta" | "priceDeltaMilliCoin") =>
    Object.entries(recordValue(direction[field]))
      .flatMap(([resourceId, amount]) => typeof amount === "number" && Number.isFinite(amount) && amount !== 0
        ? [{ resourceId, amount }]
        : [])
      .sort((left, right) => Math.abs(right.amount) - Math.abs(left.amount)
        || left.resourceId.localeCompare(right.resourceId))
      .slice(0, 6);
  const regionState = (state: AnyRecord) => ({
    controllerFactionId: optionalString(state.controllerFactionId),
    securityBps: numberValue(state.securityBps),
    unrestBps: numberValue(state.unrestBps),
    conflictPressureBps: numberValue(state.conflictPressureBps),
    conflictPhases: Array.isArray(state.conflictPhases)
      ? state.conflictPhases.filter((phase): phase is string => typeof phase === "string").slice(0, 6)
      : [],
  });
  return {
    authority: slice.authority,
    regionId: slice.regionId,
    startedAtWorldTime: slice.startedAtWorldTime,
    endedAtWorldTime: slice.endedAtWorldTime,
    sliceHash,
    start: regionState(start),
    end: regionState(end),
    direction: {
      controllerChanged: direction.controllerChanged === true,
      populationDelta: numberValue(direction.populationDelta),
      treasuryCoinDelta: numberValue(direction.treasuryCoinDelta),
      securityDeltaBps: numberValue(direction.securityDeltaBps),
      unrestDeltaBps: numberValue(direction.unrestDeltaBps),
      conflictPressureDeltaBps: numberValue(direction.conflictPressureDeltaBps),
      strongestStockDeltas: strongestResourceTrends("stockDelta"),
      strongestPriceDeltasMilliCoin: strongestResourceTrends("priceDeltaMilliCoin"),
    },
  };
}

// ─── Identity audit ─────────────────────────────────────────────────────────

function epochActiveIdentityToolAudit(agentWorldTools: readonly McpToolDefinition[] = []) {
  const excluded = new Set<string>(EPOCH_OWNER_RECOVERY_NON_ACTIVE_IDENTITY_TOOLS);
  const ownerRecoveryTools = agentWorldTools
    .filter((tool) =>
      tool.name.startsWith("obsidian_epoch.")
      && Boolean((tool.inputSchema.properties as AnyRecord | undefined)?.recoveryCode)
      && !excluded.has(tool.name))
    .map((tool) => tool.name)
    .sort();
  return {
    policy: "schema_derived_active_identity_write_coverage",
    ownerRecoveryTools,
    ownerRecoveryExcludedTools: EPOCH_OWNER_RECOVERY_NON_ACTIVE_IDENTITY_TOOLS,
    operatorTargetTools: EPOCH_OPERATOR_TARGET_ACTIVE_IDENTITY_TOOLS,
    nonRecoveryTargetTools: EPOCH_NON_RECOVERY_TARGET_ACTIVE_IDENTITY_TOOLS,
    coreOnlyExcludedMethods: EPOCH_CORE_ACTIVE_IDENTITY_EXCLUDED_METHODS,
    coreActiveMethodTools: EPOCH_CORE_ACTIVE_IDENTITY_METHOD_TOOL_COVERAGE,
  };
}

// ─── Exports ────────────────────────────────────────────────────────────────

export {
  // Types
  type ContextSnapshotRecord,
  type RuntimeOptions,
  type McpToolDefinition,
  type McpToolResult,
  // Constants
  EPOCH_OWNER_RECOVERY_NON_ACTIVE_IDENTITY_TOOLS,
  EPOCH_OPERATOR_TARGET_ACTIVE_IDENTITY_TOOLS,
  EPOCH_NON_RECOVERY_TARGET_ACTIVE_IDENTITY_TOOLS,
  EPOCH_CORE_ACTIVE_IDENTITY_EXCLUDED_METHODS,
  EPOCH_CORE_ACTIVE_IDENTITY_METHOD_TOOL_COVERAGE,
  REMOVED_LEGACY_AGENT_WORLD_TOOLS,
  APPROACH_LABEL_CN,
  LEGACY_EVENT_RISKS,
  LEGACY_RISK_ORDER,
  // Record utilities
  isRecord,
  recordValue,
  recordArray,
  cloneRecords,
  requireObject,
  // String / number utilities
  stringValue,
  optionalString,
  stringRecord,
  numberFrom,
  numberValue,
  positiveIntegerValue,
  nonNegativeIntegerValue,
  positiveNumberValue,
  rarityTierNumeric,
  // Normalization
  normalizeLegacyActionType,
  // Operation / risk helpers
  legacyRunRiskLevel,
  legacyRunOperationDimensions,
  operationDimensionsFromInput,
  operationSwitchActionValue,
  legacyPublicClaimGate,
  // Failure publication helpers
  legacyFailurePublication,
  legacyFailureClaimPreview,
  legacyFailurePublicFields,
  legacyPublicIndexIdentityFields,
  // Prompt narrative helpers
  buildStrategyPromptNarrative,
  buildLifePatternPromptNarrative,
  // World view / community helpers
  publicWorldView,
  uniqueCommunityExplorerIds,
  communityTargetExplorerIds,
  runtimeCommunityAbuseContext,
  // Identity audit
  epochActiveIdentityToolAudit,
};
