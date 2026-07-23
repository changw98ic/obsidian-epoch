import type {
  CanonCandidatePath,
  CrossRegionMechanismKind,
  CrossRegionMechanismReview,
  CrossRegionMechanismSupport,
  CreatureBehaviorScope,
  CreatureBehaviorScopeExplanation,
  CreatureBehaviorScopeReview,
  EpochEvent,
  ExperimentMainRuleReview,
  FuzzyTimeIntervalReview,
  ResourceSpentPayload,
} from "./events.ts";
import type { EpochEventFactory } from "./eventFactory.ts";
import {
  EPOCH_LORE_ADJUDICATION_STATUSES,
  EPOCH_LORE_CONTRIBUTION_CATEGORIES,
  EPOCH_LORE_REVISION_MODES,
  type EpochLoreAdjudicationStatus,
  type EpochLoreContributionCategory,
  type EpochLoreRevisionMode,
  type EpochLoreRevisionPolicy,
  type EpochServerReward,
} from "./protocol.ts";
import type {
  EpochLoreContributionRecord,
  EpochLoreTargetAdjudication,
  RecordLoreContributionInput,
  RecordLoreTargetAdjudicationInput,
} from "./gameCore.ts";
import {
  auditPageForEventId,
  LOW_AUTHORITY_REFUTATION_AUTHORITIES,
  sourceAuthorityForEvent,
  sourceEventExplorerId,
  sourceEventIsNonEvidence,
  type SourceEventExplorerProjection,
} from "./sourceEventRules.ts";
import { resourceSpentEvent } from "./resourceLedgerEvents.ts";

export const LORE_REFUTATION_DAILY_QUOTA = 3;

export function assertLoreContributionCategory(category: string): EpochLoreContributionCategory {
  if (EPOCH_LORE_CONTRIBUTION_CATEGORIES.includes(category as EpochLoreContributionCategory)) {
    return category as EpochLoreContributionCategory;
  }
  throw new Error("lore_contribution_category_invalid");
}

export function assertLoreRevisionMode(value: unknown): EpochLoreRevisionMode {
  const mode = typeof value === "string" && value.trim() ? value.trim() : "suggestion";
  if (mode === "direct_edit") throw new Error("lore_revision_direct_edit_forbidden");
  if (EPOCH_LORE_REVISION_MODES.includes(mode as EpochLoreRevisionMode)) {
    return mode as EpochLoreRevisionMode;
  }
  throw new Error("lore_revision_mode_invalid");
}

export function assertLoreAdjudicationStatus(status: string): EpochLoreAdjudicationStatus {
  if (EPOCH_LORE_ADJUDICATION_STATUSES.includes(status as EpochLoreAdjudicationStatus)) {
    return status as EpochLoreAdjudicationStatus;
  }
  throw new Error("lore_adjudication_status_invalid");
}

export function optionalBoundedText(value: unknown, maxLength: number) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, maxLength) : undefined;
}

export function experimentalArtifactReview(input: {
  readonly experimentId?: unknown;
  readonly mainRuleReview?: unknown;
}): { readonly experimentId?: string; readonly mainRuleReview?: ExperimentMainRuleReview } {
  const experimentId = optionalBoundedText(input.experimentId, 120);
  if (!experimentId) return {};
  const review = input.mainRuleReview && typeof input.mainRuleReview === "object" && !Array.isArray(input.mainRuleReview)
    ? input.mainRuleReview as Record<string, unknown>
    : undefined;
  if (!review || review.status !== "passed") {
    throw new Error("experiment_main_rule_review_required");
  }
  const rulesetVersion = optionalBoundedText(review.rulesetVersion, 120);
  if (!rulesetVersion) throw new Error("experiment_main_rule_review_required");
  const reviewedBy = optionalBoundedText(review.reviewedBy, 120);
  const reviewedAt = optionalBoundedText(review.reviewedAt, 80);
  const note = optionalBoundedText(review.note, 240);
  return {
    experimentId,
    mainRuleReview: {
      status: "passed",
      rulesetVersion,
      ...(reviewedBy ? { reviewedBy } : {}),
      ...(reviewedAt ? { reviewedAt } : {}),
      ...(note ? { note } : {}),
    },
  };
}

export function optionalStringArray(value: unknown, maxItems: number) {
  if (!Array.isArray(value)) return undefined;
  const strings = [...new Set(value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean))]
    .slice(0, maxItems);
  return strings.length ? strings : undefined;
}

export function loreContributionSourceEventIds(value: unknown): readonly string[] {
  return Array.isArray(value)
    ? [...new Set(value
        .filter((eventId): eventId is string => typeof eventId === "string")
        .map((eventId) => eventId.trim())
        .filter(Boolean))]
    : [];
}

export function loreContributionSourceEvents(input: {
  readonly category: EpochLoreContributionCategory;
  readonly events: readonly EpochEvent[];
  readonly explorerId: string;
  readonly projection: SourceEventExplorerProjection;
  readonly sourceEventIds: readonly string[];
}): readonly EpochEvent[] {
  if (!input.sourceEventIds.length) throw new Error("lore_contribution_source_event_required");
  const sourceEvents = input.sourceEventIds.map((sourceEventId) => {
    const sourceEvent = input.events.find((event) => event.eventId === sourceEventId);
    if (!sourceEvent) throw new Error("lore_contribution_source_event_not_found");
    return sourceEvent;
  });
  for (const sourceEvent of sourceEvents) {
    if (sourceEventIsNonEvidence(sourceEvent) && sourceEventExplorerId(input.projection, sourceEvent) !== input.explorerId) {
      throw new Error("lore_contribution_non_evidence_source");
    }
  }
  if (input.category === "refutation" && sourceEvents.every((sourceEvent) =>
    LOW_AUTHORITY_REFUTATION_AUTHORITIES.has(sourceAuthorityForEvent(sourceEvent)))) {
    throw new Error("lore_refutation_low_authority_source");
  }
  return sourceEvents;
}

export function loreTargetSourceContributionEventIds(value: unknown): readonly string[] {
  return Array.isArray(value)
    ? [...new Set(value
        .filter((eventId): eventId is string => typeof eventId === "string")
        .map((eventId) => eventId.trim())
        .filter(Boolean))]
    : [];
}

export function loreTargetSourceContributionEvents(input: {
  readonly events: readonly EpochEvent[];
  readonly sourceContributionEventIds: readonly string[];
  readonly targetId: string;
}): readonly EpochEvent[] {
  if (!input.sourceContributionEventIds.length) throw new Error("lore_adjudication_source_contribution_required");
  return input.sourceContributionEventIds.map((sourceEventId) => {
    const sourceEvent = input.events.find((event) => event.eventId === sourceEventId);
    if (!sourceEvent) throw new Error("lore_adjudication_source_event_not_found");
    if (sourceEvent.eventType !== "lore_contribution_recorded") {
      throw new Error("lore_adjudication_source_event_not_contribution");
    }
    const sourcePayload = sourceEvent.payload as EpochLoreContributionRecord;
    if (sourcePayload.targetId !== input.targetId) {
      throw new Error("lore_adjudication_source_target_mismatch");
    }
    return sourceEvent;
  });
}

export interface LoreContributionRevisionFields {
  readonly revisionMode?: EpochLoreRevisionMode;
  readonly revisionPolicy?: EpochLoreRevisionPolicy;
  readonly revisedClaimText?: string;
  readonly originalClaimExplorerId?: string;
  readonly parentClaimId?: string;
  readonly mergeTargetIds?: readonly string[];
  readonly downgradeReason?: string;
}

export function loreContributionRevisionFields(input: Pick<
  RecordLoreContributionInput,
  "revisionMode" | "revisedClaimText" | "originalClaimExplorerId" | "parentClaimId" | "mergeTargetIds" | "downgradeReason"
> & {
  readonly category: EpochLoreContributionCategory;
}): LoreContributionRevisionFields {
  if (input.category !== "revision") return {};
  const revisionMode = assertLoreRevisionMode(input.revisionMode);
  const revisedClaimText = optionalBoundedText(input.revisedClaimText, 320);
  const originalClaimExplorerId = optionalBoundedText(input.originalClaimExplorerId, 120);
  const parentClaimId = optionalBoundedText(input.parentClaimId, 160);
  const mergeTargetIds = optionalStringArray(input.mergeTargetIds, 8);
  const downgradeReason = optionalBoundedText(input.downgradeReason, 240);
  return {
    revisionMode,
    revisionPolicy: revisionPolicyFor({
      mode: revisionMode,
      originalClaimExplorerId,
      parentClaimId,
      mergeTargetIds,
      downgradeReason,
    }),
    ...(revisedClaimText ? { revisedClaimText } : {}),
    ...(originalClaimExplorerId ? { originalClaimExplorerId } : {}),
    ...(parentClaimId ? { parentClaimId } : {}),
    ...(mergeTargetIds?.length ? { mergeTargetIds } : {}),
    ...(downgradeReason ? { downgradeReason } : {}),
  };
}

export function loreRefutationCountForRecordedDate(input: {
  readonly events: readonly EpochEvent[];
  readonly agentId: string;
  readonly recordedAt: string;
}): number {
  const recordedDate = input.recordedAt.slice(0, 10);
  return input.events.filter((event) => {
    if (event.eventType !== "lore_contribution_recorded") return false;
    const payload = event.payload as EpochLoreContributionRecord;
    return payload.agentId === input.agentId
      && payload.category === "refutation"
      && payload.recordedAt.slice(0, 10) === recordedDate;
  }).length;
}

export function assertLoreRefutationDailyQuota(input: {
  readonly category: EpochLoreContributionCategory;
  readonly events: readonly EpochEvent[];
  readonly agentId: string;
  readonly recordedAt: string;
  readonly quota?: number;
}) {
  if (input.category !== "refutation") return;
  if (loreRefutationCountForRecordedDate(input) >= (input.quota ?? LORE_REFUTATION_DAILY_QUOTA)) {
    throw new Error("lore_refutation_daily_quota_exceeded");
  }
}

export function loreContributionCost(input: {
  readonly category: EpochLoreContributionCategory;
}): EpochServerReward | undefined {
  return input.category === "confirmation"
    ? undefined
    : {
        resourceId: "focus",
        amount: 1,
        reason: `lore_${input.category}_cost`,
      };
}

export function loreContributionCostSpendPayload(input: {
  readonly agentId: string;
  readonly category: EpochLoreContributionCategory;
  readonly currentFocus: number;
}): ResourceSpentPayload | undefined {
  const cost = loreContributionCost({ category: input.category });
  if (!cost) return undefined;
  return {
    resourceId: cost.resourceId,
    amount: cost.amount,
    reason: cost.reason,
    balanceAfter: input.currentFocus - cost.amount,
    accountRef: `agent:${input.agentId}`,
    assetKey: `resource:${cost.resourceId}`,
    unit: "unit",
    quantityMinor: (BigInt(cost.amount) * 100n).toString(),
  };
}

export function loreContributionRecordPayload(input: {
  readonly contributionId: string;
  readonly claimHash: EpochLoreContributionRecord["claimHash"];
  readonly category: EpochLoreContributionCategory;
  readonly agentId: string;
  readonly explorerId: string;
  readonly targetId: string;
  readonly summary: string;
  readonly revisionMode?: EpochLoreRevisionMode;
  readonly revisionPolicy?: EpochLoreRevisionPolicy;
  readonly revisedClaimText?: string;
  readonly originalClaimExplorerId?: string;
  readonly parentClaimId?: string;
  readonly mergeTargetIds?: readonly string[];
  readonly downgradeReason?: string;
  readonly sourceEventIds: readonly string[];
  readonly provenance: EpochLoreContributionRecord["provenance"];
  readonly experimentReview?: {
    readonly experimentId?: string;
    readonly mainRuleReview?: ExperimentMainRuleReview;
  };
  readonly creatureBehaviorScopeReview?: CreatureBehaviorScopeReview;
  readonly fuzzyTimeIntervalReview?: FuzzyTimeIntervalReview;
  readonly crossRegionMechanismReview?: CrossRegionMechanismReview;
  readonly cost?: EpochServerReward;
  readonly recordedAt: string;
}): EpochLoreContributionRecord {
  return {
    contributionId: input.contributionId,
    claimId: input.contributionId,
    claimType: input.category,
    claimText: input.summary,
    claimHash: input.claimHash,
    category: input.category,
    agentId: input.agentId,
    explorerId: input.explorerId,
    targetId: input.targetId,
    summary: input.summary,
    ...(input.revisionMode ? { revisionMode: input.revisionMode } : {}),
    ...(input.revisionPolicy ? { revisionPolicy: input.revisionPolicy } : {}),
    ...(input.revisedClaimText ? { revisedClaimText: input.revisedClaimText } : {}),
    ...(input.originalClaimExplorerId ? { originalClaimExplorerId: input.originalClaimExplorerId } : {}),
    ...(input.parentClaimId ? { parentClaimId: input.parentClaimId } : {}),
    ...(input.mergeTargetIds?.length ? { mergeTargetIds: [...input.mergeTargetIds] } : {}),
    ...(input.downgradeReason ? { downgradeReason: input.downgradeReason } : {}),
    sourceEventIds: [...input.sourceEventIds],
    provenance: input.provenance,
    ...(input.experimentReview || {}),
    ...(input.creatureBehaviorScopeReview ? { creatureBehaviorScopeReview: input.creatureBehaviorScopeReview } : {}),
    ...(input.fuzzyTimeIntervalReview ? { fuzzyTimeIntervalReview: input.fuzzyTimeIntervalReview } : {}),
    ...(input.crossRegionMechanismReview ? { crossRegionMechanismReview: input.crossRegionMechanismReview } : {}),
    ...(input.cost ? { cost: input.cost } : {}),
    recordedAt: input.recordedAt,
  };
}

export interface PlanLoreContributionRecordEventsInput {
  readonly makeEvent: EpochEventFactory;
  readonly contributionId: string;
  readonly agentId: string;
  readonly record: EpochLoreContributionRecord;
  readonly costSpendPayload?: ResourceSpentPayload;
}

export function planLoreContributionRecordEvents(input: PlanLoreContributionRecordEventsInput): readonly EpochEvent[] {
  const nextEvents: EpochEvent[] = [];
  if (input.costSpendPayload) {
    nextEvents.push(resourceSpentEvent(input.makeEvent, input.agentId, input.costSpendPayload));
  }
  nextEvents.push(input.makeEvent("lore_contribution_recorded", input.contributionId, input.record, {
    aggregateType: "audit_record",
    agentId: input.agentId,
  }));
  return nextEvents;
}

export function loreTargetAdjudicationIds(input: {
  readonly adjudicationId: string;
  readonly previousAdjudicationId?: string;
}): Pick<EpochLoreTargetAdjudication, "newAdjudicationId" | "previousAdjudicationId"> {
  return {
    ...(input.previousAdjudicationId ? { previousAdjudicationId: input.previousAdjudicationId } : {}),
    newAdjudicationId: input.adjudicationId,
  };
}

export function loreTargetAdjudicationStableKey(input: {
  readonly targetId: string;
  readonly status: EpochLoreAdjudicationStatus;
  readonly sourceContributionEventIds: readonly string[];
  readonly adjudicationSequence: number;
  readonly summary: string;
  readonly canonCandidate?: CanonCandidatePath;
}): string {
  return `${input.targetId}:${input.status}:${input.sourceContributionEventIds.join(",")}:review-${input.adjudicationSequence}:${input.summary}:${JSON.stringify(input.canonCandidate || {})}`;
}

export function loreTargetAdjudicationHistory(input: {
  readonly events: readonly EpochEvent[];
  readonly targetId: string;
}): {
  readonly adjudicationSequence: number;
  readonly previousAdjudication?: EpochLoreTargetAdjudication;
  readonly previousAdjudicationId?: string;
} {
  const adjudicationEvents = input.events.filter((event) => {
    if (event.eventType !== "lore_target_adjudicated") return false;
    return (event.payload as EpochLoreTargetAdjudication).targetId === input.targetId;
  });
  const previousAdjudication = adjudicationEvents.length
    ? adjudicationEvents[adjudicationEvents.length - 1].payload as EpochLoreTargetAdjudication
    : undefined;
  return {
    adjudicationSequence: adjudicationEvents.length + 1,
    ...(previousAdjudication ? { previousAdjudication } : {}),
    ...(previousAdjudication?.adjudicationId ? { previousAdjudicationId: previousAdjudication.adjudicationId } : {}),
  };
}

export function loreTargetAdjudicationPayload(input: {
  readonly adjudicationId: string;
  readonly previousAdjudicationId?: string;
  readonly targetId: string;
  readonly status: EpochLoreAdjudicationStatus;
  readonly summary: string;
  readonly sourceContributionEventIds: readonly string[];
  readonly provenance: EpochLoreTargetAdjudication["provenance"];
  readonly canonCandidate?: CanonCandidatePath;
  readonly authorityReview?: EpochLoreTargetAdjudication["authorityReview"];
  readonly operatorId: string;
  readonly adjudicatedAt: string;
}): EpochLoreTargetAdjudication {
  return {
    adjudicationId: input.adjudicationId,
    ...loreTargetAdjudicationIds({
      adjudicationId: input.adjudicationId,
      previousAdjudicationId: input.previousAdjudicationId,
    }),
    targetId: input.targetId,
    status: input.status,
    summary: input.summary,
    sourceContributionEventIds: [...input.sourceContributionEventIds],
    provenance: input.provenance,
    ...(input.canonCandidate ? { canonCandidate: input.canonCandidate } : {}),
    ...(input.authorityReview ? { authorityReview: input.authorityReview } : {}),
    operatorId: input.operatorId,
    adjudicatedAt: input.adjudicatedAt,
  };
}

export interface PlanLoreTargetAdjudicationEventsInput {
  readonly makeEvent: EpochEventFactory;
  readonly adjudicationId: string;
  readonly adjudication: EpochLoreTargetAdjudication;
}

export function planLoreTargetAdjudicationEvents(input: PlanLoreTargetAdjudicationEventsInput): readonly EpochEvent[] {
  return [input.makeEvent("lore_target_adjudicated", input.adjudicationId, input.adjudication, {
    aggregateType: "audit_record",
  })];
}

export function revisionPolicyFor(input: {
  readonly mode: EpochLoreRevisionMode;
  readonly originalClaimExplorerId?: string;
  readonly parentClaimId?: string;
  readonly mergeTargetIds?: readonly string[];
  readonly downgradeReason?: string;
}): EpochLoreRevisionPolicy {
  return {
    mode: input.mode,
    allowedRevisionModes: [...EPOCH_LORE_REVISION_MODES],
    originalClaimMutable: false,
    claimTextEffect: input.mode === "derived" ? "derived_version" : "proposal_only",
    requiresReview: true,
    ...(input.originalClaimExplorerId ? { originalClaimExplorerId: input.originalClaimExplorerId } : {}),
    ...(input.parentClaimId ? { parentClaimId: input.parentClaimId } : {}),
    ...(input.mergeTargetIds?.length ? { mergeTargetIds: [...input.mergeTargetIds] } : {}),
    ...(input.downgradeReason ? { downgradeReason: input.downgradeReason } : {}),
  };
}

const creatureScopeOrder: readonly CreatureBehaviorScope[] = ["local", "regional", "cross_region", "world"];

function creatureScopeRank(scope: CreatureBehaviorScope) {
  return creatureScopeOrder.indexOf(scope);
}

function maxCreatureScope(left: CreatureBehaviorScope, right: CreatureBehaviorScope): CreatureBehaviorScope {
  return creatureScopeRank(left) >= creatureScopeRank(right) ? left : right;
}

function claimedCreatureBehaviorScope(normalized: string): CreatureBehaviorScope {
  if (/全世界|整个世界|所有区域|诸天|world/.test(normalized)) return "world";
  if (/跨区|跨区域|多个区域|multi[-_\s]?region|cross[-_\s]?region/.test(normalized)) return "cross_region";
  if (/整座灰港|整个灰港|全港|区域|地区|region|灰港/.test(normalized)) return "regional";
  return "local";
}

function creatureBehaviorScopeExplanation(normalized: string): CreatureBehaviorScopeExplanation | undefined {
  if (/外部污染|污染放大|外来污染|external\s+pollution/.test(normalized)) return "external_pollution";
  if (/群体事件|群体迁徙|成群|群落|swarm|group\s+event/.test(normalized)) return "group_event";
  if (/更高实体|高阶实体|旧神|外神|higher\s+entity/.test(normalized)) return "higher_entity";
  return undefined;
}

function creatureThreatFromText(surface: string): string {
  const match = surface.match(/(?:威胁|threat)\s*[:=：]?\s*([SABCDE])|([SABCDE])\s*级/i);
  return (match?.[1] || match?.[2] || "未知").toUpperCase();
}

function creatureRankRoleFromText(surface: string): string {
  const match = surface.match(/世界级|首领|头目|精英|普通|rank[_\s-]?role\s*[:=：]?\s*(world|leader|boss|elite|normal)/i);
  if (!match) return "未知";
  const value = match[0].toLowerCase();
  if (value.includes("world") || value.includes("世界级")) return "世界级";
  if (value.includes("leader") || value.includes("首领")) return "首领";
  if (value.includes("boss") || value.includes("头目")) return "头目";
  if (value.includes("elite") || value.includes("精英")) return "精英";
  return "普通";
}

function allowedCreatureScope(threat: string, rankRole: string): CreatureBehaviorScope {
  const threatScope: CreatureBehaviorScope = threat === "S"
    ? "world"
    : threat === "A"
      ? "cross_region"
      : threat === "B"
        ? "regional"
        : "local";
  const rankScope: CreatureBehaviorScope = rankRole === "世界级"
    ? "world"
    : rankRole === "首领"
      ? "cross_region"
      : rankRole === "头目" || rankRole === "精英"
        ? "regional"
        : "local";
  return maxCreatureScope(threatScope, rankScope);
}

export function creatureBehaviorScopeReviewFor(input: {
  readonly targetId: string;
  readonly summary: string;
}): CreatureBehaviorScopeReview | undefined {
  const surface = `${input.targetId} ${input.summary}`;
  const normalized = surface.toLowerCase().normalize("NFKC");
  const creatureHint = /creature[:/]|生物|兽|虫|幼体|怪物|beast|monster/.test(normalized);
  const behaviorHint = /behavior|行为|捕食|迁徙|活动|影响/.test(normalized);
  if (!creatureHint || !behaviorHint) return undefined;
  const threat = creatureThreatFromText(surface);
  const rankRole = creatureRankRoleFromText(surface);
  const claimedScope = claimedCreatureBehaviorScope(normalized);
  const allowedScope = allowedCreatureScope(threat, rankRole);
  const exceedsLimit = creatureScopeRank(claimedScope) > creatureScopeRank(allowedScope);
  const explanation = creatureBehaviorScopeExplanation(normalized);
  if (exceedsLimit && !explanation) {
    throw new Error("creature_behavior_scope_explanation_required");
  }
  return {
    subjectType: "creature_behavior",
    threat,
    rankRole,
    claimedScope,
    allowedScope,
    status: exceedsLimit ? "explained_exception" : "within_limit",
    ...(explanation ? { explanation } : {}),
    reason: exceedsLimit
      ? "生物行为影响范围超过 threat/rank_role 上限，但已提供外部污染、群体事件或更高实体介入解释。"
      : "生物行为影响范围未超过 threat/rank_role 上限。",
  };
}

export function fuzzyTimeIntervalReviewFor(input: {
  readonly events: readonly EpochEvent[];
  readonly targetId: string;
  readonly summary: string;
}): FuzzyTimeIntervalReview | undefined {
  const surface = `${input.targetId} ${input.summary}`.normalize("NFKC");
  const match = surface.match(/(?:约|大约)?\s*(\d{1,4})\s*年\s*(左右|前后|上下|附近)/)
    || surface.match(/(?:约|大约)\s*(\d{1,4})\s*年/);
  if (!match) return undefined;
  const year = Number.parseInt(match[1], 10);
  if (!Number.isFinite(year)) return undefined;
  const intervalStartYear = year - 1;
  const intervalEndYear = year + 1;
  const expression = match[0].trim().replace(/\s+/g, " ");
  const overlapCount = input.events.filter((event) => {
    if (event.eventType !== "lore_contribution_recorded") return false;
    const payload = event.payload as EpochLoreContributionRecord;
    const review = payload.fuzzyTimeIntervalReview;
    if (!review || payload.targetId !== input.targetId) return false;
    return review.intervalStartYear <= intervalEndYear && intervalStartYear <= review.intervalEndYear;
  }).length;
  const occupiedCount = overlapCount + 1;
  return {
    subjectType: "fuzzy_time",
    expression,
    intervalStartYear,
    intervalEndYear,
    occupancyWeight: intervalEndYear - intervalStartYear + 1,
    overlapCount,
    congestionLevel: occupiedCount <= 1 ? "low" : occupiedCount <= 3 ? "medium" : "high",
    reason: "模糊年份已映射为时间区间，并计入同目标时间线拥挤度。",
  };
}

function uniqueValues(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function uniqueSortedStrings(values: readonly (string | undefined)[]): readonly string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))].sort((left, right) => left.localeCompare(right));
}

function regionIdMentions(surface: string): readonly string[] {
  const normalized = surface.toLowerCase().normalize("NFKC");
  const regions: string[] = [];
  if (/灰港|gray[-_\s]?harbor|region_gray_harbor/.test(normalized)) regions.push("region_gray_harbor");
  if (/废矿|弃矿|abandoned[-_\s]?mine|region_abandoned_mine/.test(normalized)) regions.push("region_abandoned_mine");
  if (/管城|管道城|city[-_\s]?pipes|region_city_pipes/.test(normalized)) regions.push("region_city_pipes");
  if (/腐林|腐烂森林|rot[-_\s]?forest|region_rot_forest/.test(normalized)) regions.push("region_rot_forest");
  return uniqueValues(regions);
}

function crossRegionMechanismKind(normalized: string): CrossRegionMechanismKind {
  if (/梦境.*裂隙|梦.*裂隙|dream.*rift/.test(normalized)) return "dream_rift";
  if (/旧神低语|旧神.*低语|old[-_\s]?god.*whisper/.test(normalized)) return "old_god_whisper";
  if (/裂隙|rift/.test(normalized)) return "rift";
  if (/路线|航线|商路|route/.test(normalized)) return "route";
  return "unknown";
}

function crossRegionMechanismSupport(normalized: string): CrossRegionMechanismSupport | undefined {
  if (/章节许可|章节授权|chapter\s+permission|chapter\s+permit/.test(normalized)) return "chapter_permission";
  if (/已有路线|路线支持|航线支持|商路连接|route\s+support|known\s+route/.test(normalized)) return "route_support";
  if (/解释|原因|因为|由于|锚点|anchor|explained|because/.test(normalized)) return "explicit_explanation";
  return undefined;
}

export function crossRegionMechanismReviewFor(input: {
  readonly targetId: string;
  readonly summary: string;
}): CrossRegionMechanismReview | undefined {
  const surface = `${input.targetId} ${input.summary}`;
  const normalized = surface.toLowerCase().normalize("NFKC");
  const regionIds = regionIdMentions(surface);
  const mentionsCrossRegion = regionIds.length >= 2 || /跨区|跨区域|跨地域|cross[-_\s]?region/.test(normalized);
  const mechanism = crossRegionMechanismKind(normalized);
  const highTier = mechanism === "dream_rift" || mechanism === "rift" || mechanism === "old_god_whisper";
  if (!mentionsCrossRegion && mechanism === "unknown") return undefined;
  const support = crossRegionMechanismSupport(normalized);
  if ((mentionsCrossRegion || highTier) && !support) {
    throw new Error("cross_region_mechanism_support_required");
  }
  return {
    subjectType: "cross_region_mechanism",
    tier: highTier ? "high" : "basic",
    mechanism,
    ...(regionIds[0] ? { fromRegionId: regionIds[0] } : {}),
    ...(regionIds[1] ? { toRegionId: regionIds[1] } : {}),
    support: support || "explicit_explanation",
    status: "supported",
    reason: highTier
      ? "高阶跨区机制已提供章节许可、路线支持或明确解释。"
      : "跨区机制已提供最小支持说明。",
  };
}

function canonAdoptionAttributionFrom(
  sourceContributionEvents: readonly EpochEvent[],
): CanonCandidatePath["attribution"] {
  const sourceContributions = sourceContributionEvents.map((event) => {
    const payload = event.payload as EpochLoreContributionRecord;
    return {
      contributionEventId: event.eventId,
      contributionId: payload.contributionId,
      agentId: payload.agentId,
      explorerId: payload.explorerId,
      targetId: payload.targetId,
      publicPages: {
        audit: auditPageForEventId(event.eventId),
      },
    };
  });
  const sourceReportsById = new Map<string, CanonCandidatePath["attribution"]["sourceReports"][number]>();
  for (const event of sourceContributionEvents) {
    const payload = event.payload as EpochLoreContributionRecord;
    for (const sourceEvent of payload.provenance?.sourceEvents || []) {
      sourceReportsById.set(sourceEvent.eventId, {
        eventId: sourceEvent.eventId,
        eventType: sourceEvent.eventType,
        ...(sourceEvent.agentId ? { agentId: sourceEvent.agentId } : {}),
        ...(sourceEvent.actorExplorerId !== "system" ? { explorerId: sourceEvent.actorExplorerId } : {}),
        publicPages: sourceEvent.publicPages,
      });
    }
  }
  const sourceReports = [...sourceReportsById.values()];
  return {
    sourceContributionEventIds: sourceContributions.map((contribution) => contribution.contributionEventId),
    sourceReportEventIds: sourceReports.map((report) => report.eventId),
    sourceAgentIds: uniqueSortedStrings([
      ...sourceContributions.map((contribution) => contribution.agentId),
      ...sourceReports.map((report) => report.agentId),
    ]),
    sourceExplorerIds: uniqueSortedStrings([
      ...sourceContributions.map((contribution) => contribution.explorerId),
      ...sourceReports.map((report) => report.explorerId),
    ]),
    sourceContributions,
    sourceReports,
  };
}

export function canonCandidatePathFromInput(
  input: RecordLoreTargetAdjudicationInput["canonCandidate"] | undefined,
  sourceContributionEvents: readonly EpochEvent[],
): CanonCandidatePath | undefined {
  if (!input?.requested) return undefined;
  const chapterReviewId = optionalBoundedText(input.chapterReviewId, 120);
  if (!chapterReviewId) throw new Error("lore_canon_candidate_chapter_review_required");
  const curatorApprovedBy = optionalBoundedText(input.curatorApprovedBy, 120);
  if (!curatorApprovedBy) throw new Error("lore_canon_candidate_curator_approval_required");
  const migrationSummary = optionalBoundedText(input.migrationSummary, 420);
  if (!migrationSummary) throw new Error("lore_canon_candidate_migration_summary_required");
  const adoptedText = optionalBoundedText(input.adoptedText, 500);
  const boundaryNote = optionalBoundedText(input.boundaryNote, 420);
  return {
    requested: true,
    status: "candidate",
    chapterReviewId,
    curatorApprovedBy,
    migrationSummary,
    ...(adoptedText ? { adoptedText } : {}),
    ...(boundaryNote ? { boundaryNote } : {}),
    attribution: canonAdoptionAttributionFrom(sourceContributionEvents),
    reason: "正史候选已具备章节复审、主理人批准和个人版本迁移说明。",
  };
}
