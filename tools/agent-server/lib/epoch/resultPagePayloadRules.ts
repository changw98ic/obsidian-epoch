import { projectEpochEvents, type EpochProjection } from "./gameCore.ts";
import type { EpochEvent, JourneyWorldSolidifiedPayload } from "./events.ts";
import { progressView } from "./progressReadModel.ts";
import {
  resultPageFocusHostedSession,
  resultPageFocusTurnCard,
  resultPageRegionId,
  resultPageRegionalContext,
} from "./resultPageContextRules.ts";
import { resultPageReceipt } from "./resultPageReceiptRules.ts";
import {
  focusedResultPageProgress,
  resultPagePayloadAgentId,
  resultPagePublicPages,
  resultPagePublicSafeSummary,
  stableResultPageJson,
} from "./resultPageRuntimeRules.ts";
import { buildEpochResultPageRunSummary } from "./resultRunSummary.ts";
import type {
  EpochResultPageJourney,
  EpochResultPageJourneyEpisode,
  EpochResultPagePayload,
} from "./runtime.ts";
import { revalidatePersistedJourneyNarrative } from "./journeyNarrativeRules.ts";
import {
  buildGroundedJourneyStoryReport,
  type JourneyStoryIdentityInput,
} from "./journeyStoryReport.ts";
import { buildPhase6AuthoritativeCompletion } from "./phase6AuthoritativeCompletionRules.ts";
import { buildJourneyMission } from "./journeyMissionReadModel.ts";
import {
  deriveJourneyHiddenTask,
  nextJourneyTaskObjective,
  type JourneyGeneratedTaskObjective,
  type JourneyGeneratedTaskPlan,
  type JourneyHiddenTaskSeal,
  type JourneyHiddenTaskSealResolver,
  type JourneyRewardBundle,
} from "./journeyGeneratedTaskRules.ts";
import { sha256Hex } from "./runtimeAuth.ts";
import { assertResourceId, type EpochResourceId } from "./protocol.ts";
import type { JourneyWorldCommit } from "./journeyRules.ts";
import {
  CANON_THRESHOLD_BPS,
  SETTLEMENT_POLICY_VERSION,
  CONSEQUENCE_SCORE_POLICY_VERSION,
} from "./journeySettlementRules.ts";
import type { JourneyRunReceipt } from "./journeyRunReceiptRules.ts";
import type { RoleplayDeviationClassification, HiddenPrerequisiteStatus } from "./journeyRoleplayRules.ts";
import { ROLEPLAY_PATTERN_VERSION } from "./journeyRoleplayRules.ts";
import type { ViabilityStatus } from "./journeyViabilityRules.ts";
import { VIABILITY_POLICY_VERSION } from "./journeyViabilityRules.ts";
import { STRATEGY_POLICY_VERSION } from "./journeyStrategyRules.ts";

type AnyRecord = Readonly<Record<string, unknown>>;

function resultPageJourneyRunReceipt(value: unknown): JourneyRunReceipt | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return value as JourneyRunReceipt;
}

function resultPageRewardBundle(value: unknown): JourneyRewardBundle | undefined {
  if (value === undefined) return undefined;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("result_page_journey_reward_bundle_invalid");
  }
  const record = value as Record<string, unknown>;
  if (Object.keys(record).some((key) =>
    key !== "resources" && key !== "items" && key !== "attributeProgression")
    || !Array.isArray(record.resources) || record.resources.length > 4
    || !Array.isArray(record.items) || record.items.length > 4
    || record.attributeProgression === undefined) {
    throw new Error("result_page_journey_reward_bundle_invalid");
  }
  const resources = record.resources.map((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error("result_page_journey_reward_bundle_invalid");
    }
    const reward = entry as Record<string, unknown>;
    if (Object.keys(reward).some((key) => key !== "resourceId" && key !== "amount")
      || typeof reward.resourceId !== "string" || !reward.resourceId.trim()
      || typeof reward.amount !== "number" || !Number.isSafeInteger(reward.amount) || reward.amount < 1) {
      throw new Error("result_page_journey_reward_bundle_invalid");
    }
    return { resourceId: reward.resourceId as JourneyRewardBundle["resources"][number]["resourceId"], amount: reward.amount };
  });
  const items = record.items.map((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error("result_page_journey_reward_bundle_invalid");
    }
    const item = entry as Record<string, unknown>;
    if (Object.keys(item).some((key) => !["itemKey", "displayName", "rarity"].includes(key))
      || typeof item.itemKey !== "string" || !item.itemKey.trim()
      || typeof item.displayName !== "string" || !item.displayName.trim()
      || (item.rarity !== "common" && item.rarity !== "rare" && item.rarity !== "legendary")) {
      throw new Error("result_page_journey_reward_bundle_invalid");
    }
    const rarity: JourneyRewardBundle["items"][number]["rarity"] = item.rarity === "legendary"
      ? "legendary"
      : item.rarity === "rare"
        ? "rare"
        : "common";
    return {
      itemKey: item.itemKey,
      displayName: item.displayName,
      rarity,
    };
  });
  const attributeProgression = (() => {
        if (!record.attributeProgression || typeof record.attributeProgression !== "object"
          || Array.isArray(record.attributeProgression)) {
          throw new Error("result_page_journey_reward_bundle_invalid");
        }
        const progression = record.attributeProgression as Record<string, unknown>;
        if (Object.keys(progression).some((key) => !["mode", "evidenceSystem", "summary"].includes(key))
          || progression.mode !== "no-direct-gain"
          || progression.evidenceSystem !== "progressionRules.attributeEvidenceXp"
          || typeof progression.summary !== "string"
          || !progression.summary.trim()
          || progression.summary.length > 500) {
          throw new Error("result_page_journey_reward_bundle_invalid");
        }
        return {
          mode: "no-direct-gain" as const,
          evidenceSystem: "progressionRules.attributeEvidenceXp" as const,
          summary: progression.summary.trim(),
        };
      })();
  return {
    resources,
    items,
    attributeProgression,
  };
}

function resultPageWorldCommit(value: unknown): JourneyWorldCommit | undefined {
  if (value === undefined) return undefined;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("result_page_journey_world_commit_invalid");
  }
  const record = value as Record<string, unknown>;
  const status = record.status === "solidified" || record.status === "discarded" ? record.status : undefined;
  const completionTier = record.completionTier === "未及格"
    || record.completionTier === "及格"
    || record.completionTier === "良好"
    || record.completionTier === "优秀"
    || record.completionTier === "惊世"
    ? record.completionTier
    : undefined;
  const reason = record.reason === "main_completed_and_above_threshold"
    || record.reason === "main_incomplete"
    || record.reason === "below_canon_threshold"
    ? record.reason as JourneyWorldCommit["reason"]
    : undefined;
  const regionId = typeof record.regionId === "string" && record.regionId.trim() ? record.regionId.trim() : undefined;
  const committedAtWorldTime = typeof record.committedAtWorldTime === "string"
    && Number.isFinite(Date.parse(record.committedAtWorldTime))
    ? new Date(Date.parse(record.committedAtWorldTime)).toISOString()
    : undefined;
  const sourceEventIds = Array.isArray(record.sourceEventIds)
    && record.sourceEventIds.every((eventId) => typeof eventId === "string" && Boolean(eventId.trim()))
    ? [...new Set(record.sourceEventIds as string[])]
    : undefined;
  const factionStandings = Array.isArray(record.factionStandings) ? record.factionStandings.map((value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error("result_page_journey_world_commit_invalid");
    }
    const standing = value as Record<string, unknown>;
    if (typeof standing.factionId !== "string" || !standing.factionId.trim()
      || typeof standing.routeId !== "string" || !standing.routeId.trim()
      || typeof standing.standingDelta !== "number" || !Number.isSafeInteger(standing.standingDelta)
      || standing.standingDelta <= 0
      || typeof standing.standingAfter !== "number" || !Number.isSafeInteger(standing.standingAfter)) {
      throw new Error("result_page_journey_world_commit_invalid");
    }
    return {
      factionId: standing.factionId.trim(),
      routeId: standing.routeId.trim(),
      standingDelta: standing.standingDelta,
      standingAfter: standing.standingAfter,
    };
  }) : undefined;
  const npcRelationships = Array.isArray(record.npcRelationships) ? record.npcRelationships.map((value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error("result_page_journey_world_commit_invalid");
    }
    const relationship = value as Record<string, unknown>;
    if (typeof relationship.npcId !== "string" || !relationship.npcId.trim()
      || typeof relationship.displayName !== "string" || !relationship.displayName.trim()
      || typeof relationship.bondId !== "string" || !relationship.bondId.trim()
      || typeof relationship.memoryId !== "string" || !relationship.memoryId.trim()
      || typeof relationship.scoreDelta !== "number" || !Number.isSafeInteger(relationship.scoreDelta)
      || relationship.scoreDelta <= 0
      || typeof relationship.scoreAfter !== "number" || !Number.isSafeInteger(relationship.scoreAfter)) {
      throw new Error("result_page_journey_world_commit_invalid");
    }
    return {
      npcId: relationship.npcId.trim(),
      displayName: relationship.displayName.trim(),
      bondId: relationship.bondId.trim(),
      scoreDelta: relationship.scoreDelta,
      scoreAfter: relationship.scoreAfter,
      memoryId: relationship.memoryId.trim(),
    };
  }) : undefined;
  const influenceDelta = typeof record.influenceDelta === "number" && Number.isSafeInteger(record.influenceDelta)
    ? record.influenceDelta
    : undefined;
  const commitEventId = typeof record.commitEventId === "string" && record.commitEventId.trim()
    ? record.commitEventId.trim()
    : undefined;
  if (record.mode !== "mirror" || !status || !completionTier || !reason || !regionId || !committedAtWorldTime
    || influenceDelta === undefined || influenceDelta < 0 || !sourceEventIds || !factionStandings || !npcRelationships) {
    throw new Error("result_page_journey_world_commit_invalid");
  }
  const completionScoreBps = typeof record.completionScoreBps === "number"
    && Number.isSafeInteger(record.completionScoreBps)
    && record.completionScoreBps >= 0
    && record.completionScoreBps <= 10_000
    ? record.completionScoreBps
    : undefined;
  const canonThresholdBps = record.canonThresholdBps === CANON_THRESHOLD_BPS
    ? CANON_THRESHOLD_BPS
    : undefined;
  const settlementPolicyVersion = record.settlementPolicyVersion === SETTLEMENT_POLICY_VERSION
    ? SETTLEMENT_POLICY_VERSION
    : undefined;
  const consequenceScorePolicyVersion = record.consequenceScorePolicyVersion === CONSEQUENCE_SCORE_POLICY_VERSION
    ? CONSEQUENCE_SCORE_POLICY_VERSION
    : undefined;
  const settlementId = typeof record.settlementId === "string" && record.settlementId.trim()
    ? record.settlementId.trim()
    : undefined;
  let consequenceScoreBreakdown: {
    readonly resultScoreBps: number;
    readonly selfLossScoreBps: number;
    readonly collateralScoreBps: number;
  } | undefined;
  const breakdownValue = record.consequenceScoreBreakdown;
  if (breakdownValue && typeof breakdownValue === "object" && !Array.isArray(breakdownValue)) {
    const breakdown = breakdownValue as Record<string, unknown>;
    const components = [
      breakdown.resultScoreBps,
      breakdown.selfLossScoreBps,
      breakdown.collateralScoreBps,
    ];
    if (components.every((entry) => typeof entry === "number"
      && Number.isSafeInteger(entry)
      && entry >= -10_000
      && entry <= 10_000)) {
      consequenceScoreBreakdown = {
        resultScoreBps: breakdown.resultScoreBps as number,
        selfLossScoreBps: breakdown.selfLossScoreBps as number,
        collateralScoreBps: breakdown.collateralScoreBps as number,
      };
    }
  }
  if (completionScoreBps === undefined
    || canonThresholdBps === undefined
    || settlementPolicyVersion === undefined
    || consequenceScorePolicyVersion === undefined
    || settlementId === undefined
    || consequenceScoreBreakdown === undefined) {
    throw new Error("result_page_journey_world_commit_invalid");
  }
  if (status === "solidified") {
    if (reason !== "main_completed_and_above_threshold"
      || !commitEventId
      || !sourceEventIds.includes(commitEventId)) {
      throw new Error("result_page_journey_world_commit_invalid");
    }
    if (completionScoreBps < canonThresholdBps) {
      throw new Error("result_page_world_commit_threshold_inconsistent");
    }
  } else {
    if ((reason !== "below_canon_threshold" && reason !== "main_incomplete")
      || commitEventId
      || sourceEventIds.length
      || influenceDelta !== 0 || factionStandings.length || npcRelationships.length) {
      throw new Error("result_page_journey_world_commit_invalid");
    }
    if (reason === "below_canon_threshold" && completionScoreBps >= canonThresholdBps) {
      throw new Error("result_page_world_commit_threshold_inconsistent");
    }
  }
  return {
    mode: "mirror",
    status,
    completionTier,
    reason,
    regionId,
    committedAtWorldTime,
    influenceDelta,
    factionStandings,
    npcRelationships,
    ...(commitEventId ? { commitEventId } : {}),
    sourceEventIds,
    completionScoreBps,
    canonThresholdBps,
    settlementPolicyVersion,
    consequenceScorePolicyVersion,
    settlementId,
    consequenceScoreBreakdown,
  };
}

// ── PR8: Settlement / Roleplay / Viability / Strategy / HiddenPrereq ────

function resultPageSettlementScoreBreakdown(value: unknown): {
  readonly resultScoreBps: number;
  readonly selfLossScoreBps: number;
  readonly collateralScoreBps: number;
  readonly totalBps: number;
} | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  const components = [record.resultScoreBps, record.selfLossScoreBps, record.collateralScoreBps, record.totalBps];
  if (components.some((entry) => typeof entry !== "number" || !Number.isSafeInteger(entry) || entry < -10_000 || entry > 10_000)) {
    throw new Error("result_page_settlement_score_breakdown_invalid");
  }
  return {
    resultScoreBps: record.resultScoreBps as number,
    selfLossScoreBps: record.selfLossScoreBps as number,
    collateralScoreBps: record.collateralScoreBps as number,
    totalBps: record.totalBps as number,
  };
}

function resultPageSettlementHiddenClamp(value: unknown): EpochResultPageJourney["settlement"] extends { readonly score?: infer S } ? S extends { readonly hiddenClamp?: infer H } ? H : never : never {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined as never;
  const record = value as Record<string, unknown>;
  const applied = record.applied === true;
  const reason = record.reason === "main_incomplete" || record.reason === "hidden_incomplete" ? record.reason : undefined;
  const tierCap = typeof record.tierCap === "string" ? record.tierCap : undefined;
  if (!tierCap) throw new Error("result_page_settlement_hidden_clamp_invalid");
  const sourceHiddenObjectiveIds = Array.isArray(record.sourceHiddenObjectiveIds)
    ? (record.sourceHiddenObjectiveIds as unknown[]).filter((id): id is string => typeof id === "string" && Boolean(id.trim()))
    : [];
  return {
    applied,
    ...(reason ? { reason } : {}),
    tierCap,
    sourceHiddenObjectiveIds,
  } as never;
}

function resultPageSettlementScore(value: unknown): NonNullable<EpochResultPageJourney["settlement"]>["score"] | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  const breakdown = resultPageSettlementScoreBreakdown(record.breakdown);
  if (!breakdown) throw new Error("result_page_settlement_score_invalid");
  if (typeof record.mainLineSucceeded !== "boolean") throw new Error("result_page_settlement_score_invalid");
  if (typeof record.hiddenComplete !== "boolean") throw new Error("result_page_settlement_score_invalid");
  const hiddenClamp = resultPageSettlementHiddenClamp(record.hiddenClamp);
  const roleplaySummary = record.roleplaySummary && typeof record.roleplaySummary === "object" && !Array.isArray(record.roleplaySummary)
    ? (() => {
        const rp = record.roleplaySummary as Record<string, unknown>;
        if (typeof rp.deviationBps !== "number" || !Number.isSafeInteger(rp.deviationBps) || rp.deviationBps < 0 || rp.deviationBps > 10_000) {
          throw new Error("result_page_settlement_roleplay_summary_invalid");
        }
        if (typeof rp.doubtEventCount !== "number" || !Number.isSafeInteger(rp.doubtEventCount) || rp.doubtEventCount < 0) {
          throw new Error("result_page_settlement_roleplay_summary_invalid");
        }
        if (typeof rp.exposed !== "boolean") throw new Error("result_page_settlement_roleplay_summary_invalid");
        return { deviationBps: rp.deviationBps, doubtEventCount: rp.doubtEventCount, exposed: rp.exposed };
      })()
    : undefined;
  const viabilitySummary = record.viabilitySummary && typeof record.viabilitySummary === "object" && !Array.isArray(record.viabilitySummary)
    ? (() => {
        const vs = record.viabilitySummary as Record<string, unknown>;
        if (typeof vs.viabilityScoreBpsBefore !== "number" || !Number.isSafeInteger(vs.viabilityScoreBpsBefore) || vs.viabilityScoreBpsBefore < 0 || vs.viabilityScoreBpsBefore > 10_000) {
          throw new Error("result_page_settlement_viability_summary_invalid");
        }
        if (typeof vs.viabilityScoreBpsAfter !== "number" || !Number.isSafeInteger(vs.viabilityScoreBpsAfter) || vs.viabilityScoreBpsAfter < 0 || vs.viabilityScoreBpsAfter > 10_000) {
          throw new Error("result_page_settlement_viability_summary_invalid");
        }
        if (typeof vs.status !== "string") throw new Error("result_page_settlement_viability_summary_invalid");
        return { viabilityScoreBpsBefore: vs.viabilityScoreBpsBefore, viabilityScoreBpsAfter: vs.viabilityScoreBpsAfter, status: vs.status };
      })()
    : undefined;
  if (typeof record.policyVersion !== "number" || record.policyVersion !== CONSEQUENCE_SCORE_POLICY_VERSION) {
    throw new Error("result_page_settlement_score_policy_version_invalid");
  }
  if (typeof record.computedAt !== "string" || !Number.isFinite(Date.parse(record.computedAt))) {
    throw new Error("result_page_settlement_score_computed_at_invalid");
  }
  return {
    breakdown,
    mainLineSucceeded: record.mainLineSucceeded as boolean,
    hiddenComplete: record.hiddenComplete as boolean,
    ...(hiddenClamp !== undefined ? { hiddenClamp } : {}),
    ...(roleplaySummary ? { roleplaySummary } : {}),
    ...(viabilitySummary ? { viabilitySummary } : {}),
    policyVersion: record.policyVersion as number,
    computedAt: record.computedAt as string,
  };
}

function resultPageSettlementRewardModifier(value: unknown): NonNullable<EpochResultPageJourney["settlement"]>["reward"] extends { readonly modifier?: infer M } ? M : never {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("result_page_settlement_reward_modifier_invalid");
  const record = value as Record<string, unknown>;
  if (typeof record.modifierBps !== "number" || !Number.isSafeInteger(record.modifierBps)) {
    throw new Error("result_page_settlement_reward_modifier_invalid");
  }
  if (typeof record.multiplierBps !== "number" || !Number.isSafeInteger(record.multiplierBps) || record.multiplierBps < 5_000 || record.multiplierBps > 15_000) {
    throw new Error("result_page_settlement_reward_modifier_invalid");
  }
  if (record.reason !== "strategy_score_modifier" && record.reason !== "journey_grade") {
    throw new Error("result_page_settlement_reward_modifier_invalid");
  }
  return {
    modifierBps: record.modifierBps,
    multiplierBps: record.multiplierBps,
    reason: record.reason as "strategy_score_modifier" | "journey_grade",
  } as never;
}

function resultPageSettlementReward(value: unknown): NonNullable<EpochResultPageJourney["settlement"]>["reward"] | undefined {
  if (value === undefined) return undefined;
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("result_page_settlement_reward_invalid");
  const record = value as Record<string, unknown>;
  if (typeof record.tier !== "string" || !record.tier.trim()) throw new Error("result_page_settlement_reward_invalid");
  if (typeof record.baseBundleRef !== "string" || !record.baseBundleRef.trim()) throw new Error("result_page_settlement_reward_invalid");
  const modifier = resultPageSettlementRewardModifier(record.modifier);
  const resourceGrants = record.resourceGrants && typeof record.resourceGrants === "object" && !Array.isArray(record.resourceGrants)
    ? Object.freeze(record.resourceGrants as Readonly<Record<string, number>>)
    : undefined;
  const itemGrants = Array.isArray(record.itemGrants)
    ? record.itemGrants.map((entry) => {
        if (!entry || typeof entry !== "object" || Array.isArray(entry)) throw new Error("result_page_settlement_reward_invalid");
        const item = entry as Record<string, unknown>;
        if (typeof item.itemId !== "string" || !item.itemId.trim()) throw new Error("result_page_settlement_reward_invalid");
        if (typeof item.quantity !== "number" || !Number.isSafeInteger(item.quantity) || item.quantity < 1) throw new Error("result_page_settlement_reward_invalid");
        if (typeof item.rarityTier !== "number" || !Number.isSafeInteger(item.rarityTier) || item.rarityTier < 0 || item.rarityTier > 3) throw new Error("result_page_settlement_reward_invalid");
        return { itemId: item.itemId.trim(), quantity: item.quantity, rarityTier: item.rarityTier };
      })
    : undefined;
  if (typeof record.idempotencyKey !== "string" || !record.idempotencyKey.trim()) throw new Error("result_page_settlement_reward_invalid");
  if (record.negativeRewardForbidden !== true) throw new Error("result_page_settlement_reward_invalid");
  return {
    tier: record.tier.trim(),
    baseBundleRef: record.baseBundleRef.trim(),
    modifier,
    ...(resourceGrants ? { resourceGrants } : {}),
    ...(itemGrants ? { itemGrants } : {}),
    idempotencyKey: record.idempotencyKey.trim(),
    negativeRewardForbidden: true,
  } as NonNullable<EpochResultPageJourney["settlement"]>["reward"];
}

function resultPageSettlementWorldCommitDecision(value: unknown): NonNullable<EpochResultPageJourney["settlement"]>["worldCommitDecision"] | undefined {
  if (value === undefined) return undefined;
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("result_page_settlement_world_commit_decision_invalid");
  const record = value as Record<string, unknown>;
  const status = record.status === "solidified" || record.status === "discarded" ? record.status : undefined;
  if (!status) throw new Error("result_page_settlement_world_commit_decision_invalid");
  if (typeof record.canonEligible !== "boolean") throw new Error("result_page_settlement_world_commit_decision_invalid");
  if (typeof record.thresholdBps !== "number" || record.thresholdBps !== CANON_THRESHOLD_BPS) throw new Error("result_page_settlement_world_commit_decision_invalid");
  if (typeof record.policyVersion !== "number" || record.policyVersion !== SETTLEMENT_POLICY_VERSION) throw new Error("result_page_settlement_world_commit_decision_invalid");
  const reason = record.reason === "main_completed_and_above_threshold" || record.reason === "below_canon_threshold" || record.reason === "main_incomplete"
    ? record.reason : undefined;
  if (!reason) throw new Error("result_page_settlement_world_commit_decision_invalid");
  // Invariants: canonEligible iff solidified; threshold check for below_canon_threshold
  if (status === "solidified" && !record.canonEligible) throw new Error("result_page_settlement_world_commit_decision_inconsistent");
  if (reason === "main_incomplete" && record.canonEligible) throw new Error("result_page_settlement_world_commit_decision_inconsistent");
  return { status, canonEligible: record.canonEligible as boolean, thresholdBps: record.thresholdBps as number, policyVersion: record.policyVersion as number, reason };
}

function resultPageSettlement(value: unknown): EpochResultPageJourney["settlement"] | undefined {
  if (value === undefined) return undefined;
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("result_page_settlement_invalid");
  const record = value as Record<string, unknown>;
  const score = resultPageSettlementScore(record.score);
  const tier = typeof record.tier === "string" && record.tier.trim() ? record.tier.trim() : undefined;
  const reward = resultPageSettlementReward(record.reward);
  const worldCommitDecision = resultPageSettlementWorldCommitDecision(record.worldCommitDecision);
  const policyVersion = typeof record.policyVersion === "number" && record.policyVersion === SETTLEMENT_POLICY_VERSION
    ? record.policyVersion : undefined;
  return {
    ...(score ? { score } : {}),
    ...(tier ? { tier } : {}),
    ...(reward ? { reward } : {}),
    ...(worldCommitDecision ? { worldCommitDecision } : {}),
    ...(policyVersion !== undefined ? { policyVersion } : {}),
  };
}

function resultPageRoleplay(value: unknown): EpochResultPageJourney["roleplay"] | undefined {
  if (value === undefined) return undefined;
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("result_page_roleplay_invalid");
  const record = value as Record<string, unknown>;
  if (typeof record.deviationBps !== "number" || !Number.isSafeInteger(record.deviationBps) || record.deviationBps < 0 || record.deviationBps > 10_000) {
    throw new Error("result_page_roleplay_invalid");
  }
  const validClassifications = new Set<string>(["aligned", "minor_deviation", "major_deviation", "forbidden_action"]);
  if (typeof record.classification !== "string" || !validClassifications.has(record.classification)) {
    throw new Error("result_page_roleplay_invalid");
  }
  const npcDoubtEvents = Array.isArray(record.npcDoubtEvents)
    ? record.npcDoubtEvents.map((entry) => {
        if (!entry || typeof entry !== "object" || Array.isArray(entry)) throw new Error("result_page_roleplay_doubt_event_invalid");
        const event = entry as Record<string, unknown>;
        if (typeof event.npcId !== "string" || !event.npcId.trim()) throw new Error("result_page_roleplay_doubt_event_invalid");
        if (typeof event.doubtStrength !== "string") throw new Error("result_page_roleplay_doubt_event_invalid");
        if (typeof event.reason !== "string") throw new Error("result_page_roleplay_doubt_event_invalid");
        return {
          npcId: event.npcId.trim(),
          ...(typeof event.factionId === "string" && event.factionId.trim() ? { factionId: event.factionId.trim() } : {}),
          doubtStrength: event.doubtStrength,
          reason: event.reason,
        };
      })
    : undefined;
  if (typeof record.exposed !== "boolean") throw new Error("result_page_roleplay_invalid");
  if (typeof record.patternVersion !== "number" || record.patternVersion !== ROLEPLAY_PATTERN_VERSION) {
    throw new Error("result_page_roleplay_pattern_version_invalid");
  }
  return {
    deviationBps: record.deviationBps as number,
    classification: record.classification as RoleplayDeviationClassification,
    ...(npcDoubtEvents ? { npcDoubtEvents } : {}),
    exposed: record.exposed as boolean,
    patternVersion: record.patternVersion as number,
  };
}

function resultPageViability(value: unknown): EpochResultPageJourney["viability"] | undefined {
  if (value === undefined) return undefined;
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("result_page_viability_invalid");
  const record = value as Record<string, unknown>;
  const before = record.before && typeof record.before === "object" && !Array.isArray(record.before)
    ? (() => {
        const b = record.before as Record<string, unknown>;
        if (typeof b.viabilityScoreBps !== "number" || !Number.isSafeInteger(b.viabilityScoreBps) || b.viabilityScoreBps < 0 || b.viabilityScoreBps > 10_000) {
          throw new Error("result_page_viability_before_invalid");
        }
        return { viabilityScoreBps: b.viabilityScoreBps };
      })()
    : undefined;
  const after = record.after && typeof record.after === "object" && !Array.isArray(record.after)
    ? (() => {
        const a = record.after as Record<string, unknown>;
        if (typeof a.viabilityScoreBps !== "number" || !Number.isSafeInteger(a.viabilityScoreBps) || a.viabilityScoreBps < 0 || a.viabilityScoreBps > 10_000) {
          throw new Error("result_page_viability_after_invalid");
        }
        return { viabilityScoreBps: a.viabilityScoreBps };
      })()
    : undefined;
  if (typeof record.deltaBps !== "number" || !Number.isSafeInteger(record.deltaBps)) {
    throw new Error("result_page_viability_invalid");
  }
  if (typeof record.status !== "string") throw new Error("result_page_viability_invalid");
  const lifetimeConsequence = typeof record.lifetimeConsequence === "string" && record.lifetimeConsequence.trim()
    ? record.lifetimeConsequence.trim() : undefined;
  return {
    ...(before ? { before } : {}),
    ...(after ? { after } : {}),
    deltaBps: record.deltaBps as number,
    status: record.status as string,
    ...(lifetimeConsequence ? { lifetimeConsequence } : {}),
  };
}

function resultPageStrategyConsistency(value: unknown): EpochResultPageJourney["strategyConsistency"] | undefined {
  if (value === undefined) return undefined;
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("result_page_strategy_consistency_invalid");
  const record = value as Record<string, unknown>;
  if (typeof record.matchBps !== "number" || !Number.isSafeInteger(record.matchBps) || record.matchBps < 0 || record.matchBps > 10_000) {
    throw new Error("result_page_strategy_consistency_invalid");
  }
  if (record.classification !== "normal" && record.classification !== "fully_violates") {
    throw new Error("result_page_strategy_consistency_invalid");
  }
  const snapshot = record.snapshot && typeof record.snapshot === "object" && !Array.isArray(record.snapshot)
    ? (() => {
        const s = record.snapshot as Record<string, unknown>;
        if (typeof s.journeyId !== "string" || !s.journeyId.trim()) throw new Error("result_page_strategy_consistency_snapshot_invalid");
        const entries = Array.isArray(s.entries)
          ? s.entries.map((entry) => {
              if (!entry || typeof entry !== "object" || Array.isArray(entry)) throw new Error("result_page_strategy_consistency_snapshot_invalid");
              const e = entry as Record<string, unknown>;
              if (typeof e.source !== "string" || !e.source.trim()) throw new Error("result_page_strategy_consistency_snapshot_invalid");
              if (typeof e.sourceId !== "string" || !e.sourceId.trim()) throw new Error("result_page_strategy_consistency_snapshot_invalid");
              if (!Array.isArray(e.approachTags)) throw new Error("result_page_strategy_consistency_snapshot_invalid");
              if (typeof e.recordedAt !== "string" || !Number.isFinite(Date.parse(e.recordedAt))) throw new Error("result_page_strategy_consistency_snapshot_invalid");
              return {
                source: e.source.trim(),
                sourceId: e.sourceId.trim(),
                approachTags: (e.approachTags as unknown[]).filter((t): t is string => typeof t === "string"),
                recordedAt: e.recordedAt,
              };
            })
          : undefined;
        if (typeof s.snapshotVersion !== "number") throw new Error("result_page_strategy_consistency_snapshot_invalid");
        return {
          journeyId: s.journeyId.trim(),
          ...(entries ? { entries } : {}),
          snapshotVersion: s.snapshotVersion,
        };
      })()
    : undefined;
  if (typeof record.strategyPolicyVersion !== "number" || record.strategyPolicyVersion !== STRATEGY_POLICY_VERSION) {
    throw new Error("result_page_strategy_consistency_policy_version_invalid");
  }
  return {
    matchBps: record.matchBps as number,
    classification: record.classification as string,
    ...(snapshot ? { snapshot } : {}),
    strategyPolicyVersion: record.strategyPolicyVersion as number,
  };
}

function resultPageHiddenPrerequisites(value: unknown): EpochResultPageJourney["hiddenPrerequisites"] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw new Error("result_page_hidden_prerequisites_invalid");
  const validStatuses = new Set<string>(["intact", "destroyed", "degraded"]);
  return value.map((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) throw new Error("result_page_hidden_prerequisite_invalid");
    const record = entry as Record<string, unknown>;
    if (typeof record.objectiveId !== "string" || !record.objectiveId.trim()) throw new Error("result_page_hidden_prerequisite_invalid");
    if (typeof record.prerequisiteObjectId !== "string" || !record.prerequisiteObjectId.trim()) throw new Error("result_page_hidden_prerequisite_invalid");
    if (typeof record.status !== "string" || !validStatuses.has(record.status)) throw new Error("result_page_hidden_prerequisite_invalid");
    if (typeof record.observedAt !== "string" || !Number.isFinite(Date.parse(record.observedAt))) throw new Error("result_page_hidden_prerequisite_invalid");
    return {
      objectiveId: record.objectiveId.trim(),
      prerequisiteObjectId: record.prerequisiteObjectId.trim(),
      status: record.status as HiddenPrerequisiteStatus,
      ...(typeof record.destroyedAtActionEventId === "string" && record.destroyedAtActionEventId.trim() ? { destroyedAtActionEventId: record.destroyedAtActionEventId.trim() } : {}),
      ...(typeof record.degradedAtActionEventId === "string" && record.degradedAtActionEventId.trim() ? { degradedAtActionEventId: record.degradedAtActionEventId.trim() } : {}),
      ...(typeof record.sourceLedgerEntryId === "string" && record.sourceLedgerEntryId.trim() ? { sourceLedgerEntryId: record.sourceLedgerEntryId.trim() } : {}),
      observedAt: record.observedAt,
    };
  });
}

function resultPageWorldImpact(value: unknown): EpochResultPageJourney["worldImpact"] | undefined {
  if (value === undefined) return undefined;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("result_page_world_impact_invalid");
  }
  const record = value as Record<string, unknown>;
  const objectChanges = record.objectChanges === undefined
    ? undefined
    : Array.isArray(record.objectChanges)
      ? record.objectChanges.map((entry) => {
          if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
            throw new Error("result_page_world_impact_object_invalid");
          }
          const object = entry as Record<string, unknown>;
          if (typeof object.objectId !== "string" || !object.objectId.trim()
            || typeof object.regionId !== "string" || !object.regionId.trim()
            || !["intact", "degraded", "destroyed"].includes(String(object.status))
            || typeof object.degree !== "number" || !Number.isSafeInteger(object.degree)
            || object.degree < 1 || object.degree > 5
            || typeof object.sourceActionEventId !== "string" || !object.sourceActionEventId.trim()
            || typeof object.observedAt !== "string" || !Number.isFinite(Date.parse(object.observedAt))) {
            throw new Error("result_page_world_impact_object_invalid");
          }
          return {
            objectId: object.objectId.trim(),
            regionId: object.regionId.trim(),
            status: object.status as "intact" | "degraded" | "destroyed",
            degree: object.degree,
            sourceActionEventId: object.sourceActionEventId.trim(),
            observedAt: object.observedAt,
          };
        })
      : (() => {
          throw new Error("result_page_world_impact_object_invalid");
        })();
  const npcRelationships = record.npcRelationships === undefined
    ? undefined
    : Array.isArray(record.npcRelationships)
      ? record.npcRelationships.map((entry) => {
          if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
            throw new Error("result_page_world_impact_relationship_invalid");
          }
          const relationship = entry as Record<string, unknown>;
          if (typeof relationship.npcId !== "string" || !relationship.npcId.trim()
            || typeof relationship.scoreDelta !== "number" || !Number.isSafeInteger(relationship.scoreDelta)
            || typeof relationship.scoreAfter !== "number" || !Number.isSafeInteger(relationship.scoreAfter)
            || !Array.isArray(relationship.sourceEventIds)
            || relationship.sourceEventIds.length === 0
            || relationship.sourceEventIds.some((eventId) => typeof eventId !== "string" || !eventId.trim())
            || typeof relationship.observedAt !== "string"
            || !Number.isFinite(Date.parse(relationship.observedAt))) {
            throw new Error("result_page_world_impact_relationship_invalid");
          }
          return {
            npcId: relationship.npcId.trim(),
            scoreDelta: relationship.scoreDelta,
            scoreAfter: relationship.scoreAfter,
            sourceEventIds: relationship.sourceEventIds.map((eventId) => (eventId as string).trim()),
            observedAt: relationship.observedAt,
          };
        })
      : (() => {
          throw new Error("result_page_world_impact_relationship_invalid");
        })();
  const hiddenPrerequisiteLinks = record.hiddenPrerequisiteLinks === undefined
    ? undefined
    : resultPageHiddenPrerequisites(record.hiddenPrerequisiteLinks);
  if (objectChanges === undefined && npcRelationships === undefined && hiddenPrerequisiteLinks === undefined) {
    throw new Error("result_page_world_impact_invalid");
  }
  return {
    ...(objectChanges ? { objectChanges } : {}),
    ...(npcRelationships ? { npcRelationships } : {}),
    ...(hiddenPrerequisiteLinks ? { hiddenPrerequisiteLinks } : {}),
  };
}

export interface BuildEpochResultPagePayloadInput {
  readonly projection: EpochProjection;
  readonly input?: AnyRecord;
  readonly generatedAt: string;
  readonly maxDowntimeSeconds?: number;
  readonly resolveJourneyHiddenTaskSeal?: JourneyHiddenTaskSealResolver;
}

function resultPageJourney(
  value: unknown,
  resolveHiddenTaskSeal?: JourneyHiddenTaskSealResolver,
  identity?: JourneyStoryIdentityInput,
  explicitPhase6CompletionInput?: unknown,
): EpochResultPageJourney | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const source = value as Record<string, unknown>;
  const required = (entry: unknown, max = 200) => typeof entry === "string" && entry.trim() ? entry.trim().slice(0, max) : undefined;
  const journeyId = required(source.journeyId);
  const correlationId = required(source.correlationId);
  const status = required(source.status, 80);
  const objective = required(source.objective, 240);
  const regionId = required(source.regionId);
  if (!journeyId || !correlationId || !status || !objective || !regionId) return undefined;
  const worldMode = source.worldMode === "mirror" ? "mirror" as const : undefined;
  if (source.worldMode !== undefined && !worldMode) throw new Error("result_page_journey_world_mode_invalid");
  const worldCommit = resultPageWorldCommit(source.worldCommit);
  if (worldCommit && (worldMode !== "mirror" || worldCommit.regionId !== regionId)) {
    throw new Error("result_page_journey_world_commit_invalid");
  }
  const episodes = Array.isArray(source.episodes) ? source.episodes.slice(0, 12).map((value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("result_page_journey_episode_invalid");
    const episode = value as Record<string, unknown>;
    const episodeId = required(episode.episodeId);
    const title = required(episode.title, 240);
    const outcomeKey = required(episode.outcomeKey, 120);
    if (!episodeId || !title || !outcomeKey) throw new Error("result_page_journey_episode_invalid");
    const phase: EpochResultPageJourneyEpisode["phase"] = episode.phase === "arrival" || episode.phase === "main"
      || episode.phase === "side" || episode.phase === "return"
      ? episode.phase
      : undefined;
    if (episode.phase !== undefined && !phase) throw new Error("result_page_journey_episode_invalid");
    const participants = Array.isArray(episode.participants) ? episode.participants.slice(0, 12).flatMap((participantValue) => {
      if (!participantValue || typeof participantValue !== "object" || Array.isArray(participantValue)) return [];
      const participant = participantValue as Record<string, unknown>;
      const id = required(participant.id);
      const type = required(participant.type, 80);
      const label = required(participant.label, 160);
      return id && type && label ? [{ id, type, label }] : [];
    }) : [];
    const sourceEventIds = Array.isArray(episode.sourceEventIds)
      ? episode.sourceEventIds.filter((id): id is string => typeof id === "string" && Boolean(id.trim())).slice(0, 30)
      : [];
    const rawSettlement = episode.settlement && typeof episode.settlement === "object"
      && !Array.isArray(episode.settlement)
      ? episode.settlement as Record<string, unknown>
      : undefined;
    const rawSettlementReward = rawSettlement?.reward && typeof rawSettlement.reward === "object"
      && !Array.isArray(rawSettlement.reward)
      ? rawSettlement.reward as Record<string, unknown>
      : undefined;
    let settlementReward: { readonly resourceId: EpochResourceId; readonly amount: number } | undefined;
    if (rawSettlementReward) {
      if (typeof rawSettlementReward.amount !== "number"
        || !Number.isSafeInteger(rawSettlementReward.amount)
        || rawSettlementReward.amount <= 0) {
        throw new Error("result_page_journey_episode_reward_invalid");
      }
      settlementReward = {
        resourceId: assertResourceId(rawSettlementReward.resourceId),
        amount: rawSettlementReward.amount,
      };
    }
    const grounded = revalidatePersistedJourneyNarrative({
      serverFacts: episode.serverFacts,
      narrative: episode.narrative,
    });
    if (!grounded
      || grounded.serverFacts.journeyId !== journeyId
      || grounded.serverFacts.episodeId !== episodeId
      || !grounded.serverFacts.sourceEventIds.every((eventId) => sourceEventIds.includes(eventId))) {
      throw new Error("result_page_journey_grounding_invalid");
    }
    return {
      episodeId,
      title,
      outcomeKey,
      ...(phase ? { phase } : {}),
      participants,
      sourceEventIds,
      ...(settlementReward ? { settlement: { reward: settlementReward } } : {}),
      ...grounded,
      ...(episode.generatedTaskObjective && typeof episode.generatedTaskObjective === "object"
        && !Array.isArray(episode.generatedTaskObjective)
        ? { generatedTaskObjective: episode.generatedTaskObjective as JourneyGeneratedTaskObjective }
        : {}),
    };
  }) : [];
  const taskPlan = source.taskPlan && typeof source.taskPlan === "object" && !Array.isArray(source.taskPlan)
    ? source.taskPlan as JourneyGeneratedTaskPlan
    : undefined;
  if (!taskPlan || !resolveHiddenTaskSeal) throw new Error("result_page_journey_task_plan_required");
  const hiddenTaskSeal = resolveHiddenTaskSeal(journeyId, taskPlan);
  if (!hiddenTaskSeal) throw new Error("result_page_journey_hidden_task_seal_missing");
  deriveJourneyHiddenTask(taskPlan, hiddenTaskSeal);
  const canonicalEventIds = Array.isArray(source.canonicalEventIds)
    ? source.canonicalEventIds.filter((id): id is string => typeof id === "string" && Boolean(id.trim())).slice(0, 30)
    : [];
  const delta = source.stateDelta && typeof source.stateDelta === "object" && !Array.isArray(source.stateDelta)
    ? source.stateDelta as Record<string, unknown>
    : undefined;
  const reward = delta?.reward && typeof delta.reward === "object" && !Array.isArray(delta.reward)
    ? delta.reward as Record<string, unknown>
    : undefined;
  const publicReward = reward ? {
    ...(required(reward.resourceId, 120) ? { resourceId: required(reward.resourceId, 120) } : {}),
    ...(typeof reward.amount === "number" && Number.isFinite(reward.amount)
      ? { amount: reward.amount }
      : {}),
  } : undefined;
  const publicRewardBundle = resultPageRewardBundle(delta?.rewardBundle);
  const isSettled = ["settled", "completed"].includes(status);
  const settlement = isSettled ? resultPageSettlement(source.settlement) : undefined;
  const roleplay = isSettled ? resultPageRoleplay(source.roleplay) : undefined;
  const viability = isSettled ? resultPageViability(source.viability) : undefined;
  const strategyConsistency = isSettled ? resultPageStrategyConsistency(source.strategyConsistency) : undefined;
  const hiddenPrerequisites = isSettled ? resultPageHiddenPrerequisites(source.hiddenPrerequisites) : undefined;
  const worldImpact = isSettled ? resultPageWorldImpact(source.worldImpact) : undefined;
  if (hiddenPrerequisites && worldImpact?.hiddenPrerequisiteLinks
    && stableResultPageJson(hiddenPrerequisites) !== stableResultPageJson(worldImpact.hiddenPrerequisiteLinks)) {
    throw new Error("result_page_world_impact_hidden_prerequisites_mismatch");
  }
  const hiddenPrerequisiteLinks = hiddenPrerequisites ?? [];
  const groundedEventIds = [...new Set(episodes.flatMap((episode) => episode.serverFacts.sourceEventIds))];
  const episodePathComplete = episodes.length >= 3 && !nextJourneyTaskObjective(taskPlan, episodes);
  if (["settled", "completed"].includes(status)
    && (!episodePathComplete || !sameIds(canonicalEventIds, groundedEventIds))) {
    throw new Error("result_page_journey_grounding_invalid");
  }
  const storyReport = buildGroundedJourneyStoryReport({
    journeyId,
    status,
    objective,
    regionId,
    startedAtWorldTime: required(source.startedAtWorldTime),
    dueAtWorldTime: required(source.dueAtWorldTime),
    worldCommit,
    episodes,
    taskPlan,
    hiddenTaskSeal,
    hiddenPrerequisiteLinks,
    identity,
    ...(strategyConsistency ? {
      strategyConsistencySummary: {
        matchBps: strategyConsistency.matchBps,
        classification: strategyConsistency.classification === "fully_violates"
          ? "fully_violates" as const
          : "normal" as const,
      },
    } : {}),
    ...(roleplay ? {
      roleplaySummary: {
        deviationBps: roleplay.deviationBps,
        doubtEventCount: roleplay.npcDoubtEvents?.length ?? 0,
        exposed: roleplay.exposed,
      },
    } : {}),
    ...(viability ? { viabilityProjection: viability } : {}),
  });
  if (["settled", "completed"].includes(status) && !storyReport) {
    throw new Error("result_page_journey_grounding_invalid");
  }
  const mission = buildJourneyMission({
    journeyId,
    journeyStatus: status,
    playerObjective: objective,
    regionId,
    episodes,
    taskPlan,
    hiddenTaskSeal,
    hiddenPrerequisiteLinks,
    completionTier: worldCommit?.completionTier,
  });
  const phase6AuthoritativeCompletion = explicitPhase6CompletionInput !== undefined
    && ["settled", "completed"].includes(status)
    ? buildPhase6AuthoritativeCompletion(explicitPhase6CompletionInput)
    : undefined;
  return {
    journeyId,
    correlationId,
    status,
    objective,
    regionId,
    ...(worldMode ? { worldMode } : {}),
    ...(worldCommit ? { worldCommit } : {}),
    ...(required(source.startedAtWorldTime) ? { startedAtWorldTime: required(source.startedAtWorldTime) } : {}),
    ...(required(source.dueAtWorldTime) ? { dueAtWorldTime: required(source.dueAtWorldTime) } : {}),
    episodes,
    canonicalEventIds,
    ...(taskPlan ? { taskPlan } : {}),
    mission,
    ...(storyReport ? { storyReport } : {}),
    ...(phase6AuthoritativeCompletion ? { phase6AuthoritativeCompletion } : {}),
    ...(delta ? { stateDelta: {
      ...(required(delta.outcomeSummary, 400) ? { outcomeSummary: required(delta.outcomeSummary, 400) } : {}),
      ...(publicReward && Object.keys(publicReward).length > 0 ? { reward: publicReward } : {}),
      ...(publicRewardBundle ? { rewardBundle: publicRewardBundle } : {}),
    } } : {}),
    ...(settlement ? { settlement } : {}),
    ...(roleplay ? { roleplay } : {}),
    ...(viability ? { viability } : {}),
    ...(strategyConsistency ? { strategyConsistency } : {}),
    ...(hiddenPrerequisites ? { hiddenPrerequisites } : {}),
    ...(worldImpact ? { worldImpact } : {}),
  } as EpochResultPageJourney;
}

function sameIds(left: readonly string[], right: readonly string[]) {
  return left.length === right.length && new Set(left).size === left.length
    && left.every((id) => right.includes(id));
}

function sortedResultPageJson(value: readonly unknown[]): string {
  return stableResultPageJson([...value].sort((left, right) =>
    stableResultPageJson(left).localeCompare(stableResultPageJson(right))));
}

function canonicalHiddenPrerequisiteLinksFromEvents(
  events: readonly EpochEvent[],
): readonly NonNullable<EpochResultPageJourney["hiddenPrerequisites"]>[number][] {
  const latestByLink = new Map<string, NonNullable<EpochResultPageJourney["hiddenPrerequisites"]>[number]>();
  for (const event of events) {
    if (event.eventType !== "hidden_prerequisite_link_changed") continue;
    const key = `${event.payload.objectiveId}:${event.payload.prerequisiteObjectId}`;
    latestByLink.set(key, {
      objectiveId: event.payload.objectiveId,
      prerequisiteObjectId: event.payload.prerequisiteObjectId,
      status: event.payload.statusAfter,
      ...(event.payload.statusAfter === "destroyed"
        ? { destroyedAtActionEventId: event.payload.sourceActionEventId }
        : {}),
      sourceLedgerEntryId: event.payload.sourceLedgerEntryId,
      observedAt: event.payload.changedAt,
    });
  }
  return [...latestByLink.values()].sort((left, right) =>
    `${left.objectiveId}:${left.prerequisiteObjectId}`.localeCompare(
      `${right.objectiveId}:${right.prerequisiteObjectId}`,
    ));
}

function assertResultPageWorldImpactGrounding(
  journey: EpochResultPageJourney,
  effectEvents: readonly EpochEvent[],
): void {
  const worldImpact = journey.worldImpact;
  const expectedObjectChanges = effectEvents.flatMap((event) => event.eventType === "world_object_state_changed"
    ? [{
        objectId: event.payload.objectId,
        regionId: event.payload.regionId,
        status: event.payload.statusAfter,
        degree: event.payload.degree,
        sourceActionEventId: event.payload.sourceActionEventId,
        observedAt: event.payload.changedAt,
      }]
    : []);
  const expectedNpcRelationships = effectEvents.flatMap((event) => event.eventType === "agent_npc_bond_updated"
    ? [{
        npcId: event.payload.npcId,
        scoreDelta: event.payload.scoreDelta,
        scoreAfter: event.payload.scoreAfter,
        sourceEventIds: [event.eventId],
        observedAt: event.payload.updatedAt,
      }]
    : []);
  const expectedHiddenPrerequisiteLinks = canonicalHiddenPrerequisiteLinksFromEvents(effectEvents);
  const pageObjectChanges = worldImpact?.objectChanges ?? [];
  const pageNpcRelationships = worldImpact?.npcRelationships ?? [];
  const pageWorldHiddenLinks = worldImpact?.hiddenPrerequisiteLinks ?? [];
  const pageHiddenLinks = journey.hiddenPrerequisites ?? [];
  if (sortedResultPageJson(pageObjectChanges) !== sortedResultPageJson(expectedObjectChanges)
    || sortedResultPageJson(pageNpcRelationships) !== sortedResultPageJson(expectedNpcRelationships)
    || sortedResultPageJson(pageWorldHiddenLinks) !== sortedResultPageJson(expectedHiddenPrerequisiteLinks)
    || sortedResultPageJson(pageHiddenLinks) !== sortedResultPageJson(expectedHiddenPrerequisiteLinks)) {
    throw new Error("result_page_journey_world_impact_invalid");
  }
}

export function assertEpochResultPagePayload(
  payload: EpochResultPagePayload,
  canonicalEpochEvents: readonly EpochEvent[],
  resolveJourneyHiddenTaskSeal?: JourneyHiddenTaskSealResolver,
) {
  const { receipt, ...body } = payload;
  const referencedEventIds = [
    ...receipt.canonicalEvents.map((event) => event.eventId),
    ...payload.progress.latestEvents.map((event) => event.eventId),
  ];
  let receiptEventBoundary = -1;
  for (const eventId of referencedEventIds) {
    const eventIndex = canonicalEpochEvents.findIndex((event) => event.eventId === eventId);
    if (eventIndex < 0 || canonicalEpochEvents[eventIndex]!.createdAt > payload.generatedAt) {
      throw new Error("result_page_receipt_invalid");
    }
    receiptEventBoundary = Math.max(receiptEventBoundary, eventIndex);
  }
  for (const event of payload.progress.latestEvents) {
    const canonicalEvent = canonicalEpochEvents.find((candidate) => candidate.eventId === event.eventId);
    if (!canonicalEvent || stableResultPageJson(canonicalEvent) !== stableResultPageJson(event)) {
      throw new Error("result_page_receipt_invalid");
    }
  }
  const expectedReceipt = resultPageReceipt(
    projectEpochEvents(canonicalEpochEvents.slice(0, receiptEventBoundary + 1)),
    body,
  );
  if (receipt.receiptType !== "server_result_receipt"
    || receipt.generatedAt !== payload.generatedAt
    || receipt.payloadHash !== `sha256:${sha256Hex(stableResultPageJson(body))}`
    || stableResultPageJson(receipt) !== stableResultPageJson(expectedReceipt)) {
    throw new Error("result_page_receipt_invalid");
  }
  if (!payload.journey) return;
  const journey = resultPageJourney(payload.journey, resolveJourneyHiddenTaskSeal);
  if (!journey) throw new Error("result_page_journey_grounding_invalid");
  const eventsById = new Map(canonicalEpochEvents.map((event) => [event.eventId, event]));
  const agentId = resultPagePayloadAgentId(payload);
  for (const episode of journey.episodes) {
    const episodeEventIds = episode.serverFacts?.sourceEventIds ?? [];
    const episodeEvents = episodeEventIds.map((eventId) => eventsById.get(eventId));
    if (episodeEvents.some((event) => !event || event.correlationId !== journey.correlationId)) {
      throw new Error("result_page_journey_provenance_invalid");
    }
    const hostedEvents = episodeEvents.filter((event): event is Extract<EpochEvent, { readonly eventType: "hosted_action_recorded" }> =>
      event?.eventType === "hosted_action_recorded");
    if (hostedEvents.length !== 1 || (agentId && hostedEvents[0].agentId !== agentId)) {
      throw new Error("result_page_journey_provenance_invalid");
    }
    const event = hostedEvents[0];
    const influenceEvents = episodeEvents.filter((candidate): candidate is Extract<EpochEvent, { readonly eventType: "region_influence_changed" }> =>
      candidate?.eventType === "region_influence_changed");
    const traceEvents = episodeEvents.filter((candidate): candidate is Extract<EpochEvent, { readonly eventType: "trace_created" }> =>
      candidate?.eventType === "trace_created");
    const factionStandingEvents = episodeEvents.filter((candidate): candidate is Extract<EpochEvent, { readonly eventType: "agent_faction_standing_changed" }> =>
      candidate?.eventType === "agent_faction_standing_changed");
    if (episodeEvents.some((candidate) => candidate && ![
      "hosted_action_recorded",
      "agent_faction_standing_changed",
      "region_influence_changed",
      "trace_created",
    ].includes(candidate.eventType))) {
      throw new Error("result_page_journey_provenance_invalid");
    }
    if (influenceEvents.some((candidate) =>
      candidate.payload.sourceEventId !== event.eventId
      || candidate.payload.sourceEventType !== "hosted_action_recorded"
      || (agentId && candidate.payload.agentId !== agentId))) {
      throw new Error("result_page_journey_provenance_invalid");
    }
    const influenceIds = new Set(influenceEvents.map((candidate) => candidate.payload.influenceId));
    if (traceEvents.some((candidate) =>
      !candidate.payload.sourceEventIds.includes(event.eventId)
      || candidate.payload.relatedInfluenceIds.some((influenceId) => !influenceIds.has(influenceId))
      || (agentId && !candidate.payload.participantAgentIds.includes(agentId)))) {
      throw new Error("result_page_journey_provenance_invalid");
    }
    if ((influenceEvents.length === 0) !== (traceEvents.length === 0)) {
      throw new Error("result_page_journey_provenance_invalid");
    }
    if (factionStandingEvents.length > 1 || factionStandingEvents.some((candidate) =>
      candidate.payload.sourceEventId !== event.eventId
      || candidate.payload.journeyId !== journey.journeyId
      || candidate.payload.episodeId !== episode.episodeId
      || candidate.payload.standingDelta <= 0
      || (agentId && candidate.payload.agentId !== agentId))) {
      throw new Error("result_page_journey_provenance_invalid");
    }
    const session = canonicalEpochEvents.find((candidate) => candidate.eventType === "hosted_session_started"
      && candidate.correlationId === journey.correlationId
      && (!agentId || candidate.agentId === agentId)
      && candidate.payload.sessionId === event.payload.sessionId
      && candidate.payload.sceneContract?.journeyId === journey.journeyId
      && candidate.payload.sceneContract.episodeId === episode.episodeId);
    if (!session || session.eventType !== "hosted_session_started") {
      throw new Error("result_page_journey_provenance_invalid");
    }
    const signedAction = session.payload.sceneContract?.actionOptions?.find((action) =>
      action.actionOptionId === event.payload.actionOptionId);
    if (!signedAction) {
      throw new Error("result_page_journey_provenance_invalid");
    }
    const completionKind = event.payload.journeyResolution?.completionKind;
    const recallOnlyMainEpisode = episode.phase === "main"
      && episode.serverFacts?.storyBeat?.selectedAction.optionKey === "recall_without_objective"
      && episode.serverFacts?.storyBeat?.selectedAction.taskObjectiveId === undefined;
    if (episode.generatedTaskObjective
      && !recallOnlyMainEpisode
      && completionKind !== "complete"
      && completionKind !== "failed") {
      throw new Error("result_page_journey_provenance_invalid");
    }
    const persistedResolution = episode.serverFacts?.storyBeat?.selectedAction.resolution;
    if (persistedResolution !== undefined
      && stableResultPageJson(persistedResolution) !== stableResultPageJson(event.payload.journeyResolution)) {
      throw new Error("result_page_journey_provenance_invalid");
    }
    const expectedFactionStanding = completionKind === "complete"
      && journey.worldMode !== "mirror"
      && episode.generatedTaskObjective?.kind === "choice"
      && Boolean(signedAction.routeSelection?.factionObjectId);
    if (journey.worldMode === "mirror"
      && (influenceEvents.length || traceEvents.length || factionStandingEvents.length)) {
      throw new Error("result_page_journey_provenance_invalid");
    }
    if (expectedFactionStanding !== (factionStandingEvents.length === 1)
      || (factionStandingEvents[0]
        && (factionStandingEvents[0].payload.routeId !== signedAction.routeSelection?.routeId
          || factionStandingEvents[0].payload.factionId !== signedAction.routeSelection?.factionObjectId))) {
      throw new Error("result_page_journey_provenance_invalid");
    }
  }
  if (journey.worldMode === "mirror" && ["settled", "completed"].includes(journey.status)) {
    const worldCommit = journey.worldCommit;
    if (!worldCommit) throw new Error("result_page_journey_world_commit_invalid");
    const markers = canonicalEpochEvents.filter((event): event is Extract<EpochEvent, {
      readonly eventType: "journey_world_solidified";
    }> => event.eventType === "journey_world_solidified"
      && event.payload.journeyId === journey.journeyId);
    if (worldCommit.status === "discarded") {
      if (markers.length || journey.worldImpact || (journey.hiddenPrerequisites?.length ?? 0) > 0) {
        throw new Error("result_page_journey_world_commit_invalid");
      }
    } else {
      if (markers.length !== 1 || markers[0].eventId !== worldCommit.commitEventId
        || markers[0].correlationId !== journey.correlationId) {
        throw new Error("result_page_journey_world_commit_invalid");
      }
      const marker = markers[0];
      const markerPayload = marker.payload as JourneyWorldSolidifiedPayload;
      const expectedCommit: JourneyWorldCommit = {
        mode: "mirror",
        status: "solidified",
        completionTier: markerPayload.completionTier,
        reason: "main_completed_and_above_threshold",
        regionId: markerPayload.regionId,
        committedAtWorldTime: markerPayload.committedAtWorldTime ?? markerPayload.mirrorEndedAtWorldTime,
        influenceDelta: markerPayload.influenceDelta,
        factionStandings: markerPayload.factionStandings,
        npcRelationships: markerPayload.npcRelationships,
        commitEventId: marker.eventId,
        sourceEventIds: [...markerPayload.effectEventIds, marker.eventId],
        completionScoreBps: markerPayload.completionScoreBps,
        canonThresholdBps: markerPayload.canonThresholdBps,
        settlementPolicyVersion: markerPayload.settlementPolicyVersion,
        consequenceScorePolicyVersion: markerPayload.consequenceScorePolicyVersion,
        ...(markerPayload.strategyPolicyVersion !== undefined ? { strategyPolicyVersion: markerPayload.strategyPolicyVersion } : {}),
        ...(markerPayload.questOfferId !== undefined ? { questOfferId: markerPayload.questOfferId } : {}),
        ...(markerPayload.offerHash !== undefined ? { offerHash: markerPayload.offerHash } : {}),
        settlementId: markerPayload.settlementId,
        consequenceScoreBreakdown: markerPayload.consequenceScoreBreakdown,
      };
      if (stableResultPageJson(expectedCommit) !== stableResultPageJson(worldCommit)
        || marker.payload.sourceEventIds.some((eventId) => !journey.canonicalEventIds.includes(eventId))) {
        throw new Error("result_page_journey_world_commit_invalid");
      }
      const allowedEffectTypes = new Set([
        "region_influence_changed",
        "trace_created",
        "agent_faction_standing_changed",
        "npc_canonicalized",
        "agent_npc_bond_updated",
        "npc_memory_recorded",
        "world_object_state_changed",
        "hidden_prerequisite_link_changed",
        "npc_identity_doubt",
        "identity_viability_projected",
        "lifetime_adjusted",
      ]);
      const effectEvents = marker.payload.effectEventIds.map((eventId) => eventsById.get(eventId));
      if (effectEvents.some((event) => !event
        || event.correlationId !== journey.correlationId
        || !allowedEffectTypes.has(event.eventType))) {
        throw new Error("result_page_journey_world_commit_invalid");
      }
      assertResultPageWorldImpactGrounding(journey, effectEvents.filter((event): event is EpochEvent => event !== undefined));
    }
  }
}

export function buildEpochResultPagePayload(options: BuildEpochResultPagePayloadInput): EpochResultPagePayload {
  const input = options.input || {};
  const focusTurnCard = resultPageFocusTurnCard(options.projection, input);
  const focusHostedSession = resultPageFocusHostedSession(options.projection, input);
  if (focusTurnCard && focusHostedSession) throw new Error("result_page_focus_conflict");

  const agentId = typeof input.agentId === "string" && input.agentId.trim()
    ? input.agentId.trim()
    : focusTurnCard?.agentId || focusHostedSession?.agentId;
  const explorerId = typeof input.explorerId === "string" && input.explorerId.trim()
    ? input.explorerId.trim()
    : focusTurnCard?.explorerId || focusHostedSession?.explorerId;
  const progress = focusedResultPageProgress(progressView(options.projection, {
    agentId,
    explorerId,
    limit: Number(input.limit || 30),
    now: options.generatedAt,
    maxDowntimeSeconds: options.maxDowntimeSeconds,
  }), input);
  const regionId = resultPageRegionId({
    input,
    progress,
    focusTurnCard,
    focusHostedSession,
  });
  const regionalContext = resultPageRegionalContext(options.projection, regionId);
  const journey = resultPageJourney(
    input.journeyVerification,
    options.resolveJourneyHiddenTaskSeal,
    progress.identity,
    input.phase6CompletionInput,
  );
  if (input.journeyVerification !== undefined && !journey) {
    throw new Error("result_page_journey_grounding_invalid");
  }
  const payload: Omit<EpochResultPagePayload, "receipt"> = {
    pageType: "agent_result",
    generatedAt: options.generatedAt,
    publicSafeSummary: resultPagePublicSafeSummary({
      progress,
      regionId,
      focusTurnCard,
      focusHostedSession,
    }),
    progress,
    runSummary: buildEpochResultPageRunSummary(input, {
      generatedAt: options.generatedAt,
      progress,
      focusTurnCard,
      focusHostedSession,
      journey,
    }),
    publicPages: resultPagePublicPages(progress),
    ...(regionalContext ? { regionalContext } : {}),
    ...(focusTurnCard ? { focusTurnCard } : {}),
    ...(focusHostedSession ? { focusHostedSession } : {}),
    ...(journey ? { journey } : {}),
  };
  return {
    ...payload,
    receipt: resultPageReceipt(options.projection, payload),
  };
}
