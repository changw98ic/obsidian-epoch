import { projectEpochEvents, type EpochProjection } from "./gameCore.ts";
import type { EpochEvent } from "./events.ts";
import { progressView } from "./progressReadModel.ts";
import {
  resultPageFocusHostedSession,
  resultPageFocusTurnCard,
  resultPageRegionId,
  resultPageRegionalContext,
} from "./resultPageContextRules.ts";
import { resultPageNextActions } from "./resultPageNavigationRules.ts";
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
import { assertAttributeId, assertResourceId, type EpochResourceId } from "./protocol.ts";
import type { JourneyWorldCommit } from "./journeyRules.ts";
import type { JourneyRunReceipt } from "./journeyRunReceiptRules.ts";

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
    key !== "resources" && key !== "items" && key !== "attributes" && key !== "attributeProgression")
    || !Array.isArray(record.resources) || record.resources.length > 4
    || !Array.isArray(record.items) || record.items.length > 4
    || (record.attributes !== undefined && (!Array.isArray(record.attributes) || record.attributes.length > 6))) {
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
  const attributes = (Array.isArray(record.attributes) ? record.attributes : []).map((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error("result_page_journey_reward_bundle_invalid");
    }
    const attribute = entry as Record<string, unknown>;
    if (Object.keys(attribute).some((key) => key !== "attributeId" && key !== "amount")
      || typeof attribute.attributeId !== "string" || !attribute.attributeId.trim()
      || typeof attribute.amount !== "number" || !Number.isSafeInteger(attribute.amount) || attribute.amount < 1) {
      throw new Error("result_page_journey_reward_bundle_invalid");
    }
    return {
      attributeId: assertAttributeId(attribute.attributeId),
      amount: attribute.amount,
    };
  });
  const attributeProgression = record.attributeProgression === undefined
    ? undefined
    : (() => {
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
    attributes,
    ...(attributeProgression ? { attributeProgression } : {}),
  } as JourneyRewardBundle;
}

function resultPageWorldCommit(value: unknown): JourneyWorldCommit | undefined {
  if (value === undefined) return undefined;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("result_page_journey_world_commit_invalid");
  }
  const record = value as Record<string, unknown>;
  const status = record.status === "solidified" || record.status === "discarded" ? record.status : undefined;
  const reason = record.reason === "main_completed_and_returned"
    || record.reason === "main_incomplete_or_return_failed"
    || record.reason === "quality_below_canon_threshold"
    ? record.reason
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
  if (record.mode !== "mirror" || !status || !reason || !regionId || !committedAtWorldTime
    || influenceDelta === undefined || influenceDelta < 0 || !sourceEventIds || !factionStandings || !npcRelationships) {
    throw new Error("result_page_journey_world_commit_invalid");
  }
  if (status === "solidified") {
    if (reason !== "main_completed_and_returned" || !commitEventId || !sourceEventIds.includes(commitEventId)) {
      throw new Error("result_page_journey_world_commit_invalid");
    }
  } else if (!["main_incomplete_or_return_failed", "quality_below_canon_threshold"].includes(reason)
    || commitEventId || sourceEventIds.length
    || influenceDelta !== 0 || factionStandings.length || npcRelationships.length) {
    throw new Error("result_page_journey_world_commit_invalid");
  }
  return {
    mode: "mirror",
    status,
    reason,
    regionId,
    committedAtWorldTime,
    influenceDelta,
    factionStandings,
    npcRelationships,
    ...(commitEventId ? { commitEventId } : {}),
    sourceEventIds,
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
  const hiddenTaskSeal: JourneyHiddenTaskSeal | undefined = taskPlan
    ? resolveHiddenTaskSeal?.(journeyId, taskPlan)
    : undefined;
  if (taskPlan) deriveJourneyHiddenTask(taskPlan, hiddenTaskSeal);
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
  const groundedEventIds = [...new Set(episodes.flatMap((episode) => episode.serverFacts.sourceEventIds))];
  const episodePathComplete = taskPlan
    ? episodes.length >= 3 && !nextJourneyTaskObjective(taskPlan, episodes)
    : episodes.length === 3;
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
    identity,
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
  } as EpochResultPageJourney;
}

function sameIds(left: readonly string[], right: readonly string[]) {
  return left.length === right.length && new Set(left).size === left.length
    && left.every((id) => right.includes(id));
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
    const legacyUnsignedAction = session.payload.sceneContract?.actionOptions === undefined
      && event.payload.actionOptionId === undefined
      && event.payload.optionLabel === undefined
      && event.payload.outcomeSummary === undefined
      && event.payload.journeyResolution === undefined
      && episode.generatedTaskObjective === undefined
      && influenceEvents.length === 0
      && traceEvents.length === 0
      && factionStandingEvents.length === 0;
    if (!signedAction) {
      if (legacyUnsignedAction) continue;
      throw new Error("result_page_journey_provenance_invalid");
    }
    const completionKind = event.payload.journeyResolution?.completionKind ?? signedAction.completionKind;
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
      if (markers.length) throw new Error("result_page_journey_world_commit_invalid");
    } else {
      if (markers.length !== 1 || markers[0].eventId !== worldCommit.commitEventId
        || markers[0].correlationId !== journey.correlationId) {
        throw new Error("result_page_journey_world_commit_invalid");
      }
      const marker = markers[0];
      const expectedCommit: JourneyWorldCommit = {
        mode: "mirror",
        status: "solidified",
        reason: "main_completed_and_returned",
        regionId: marker.payload.regionId,
        committedAtWorldTime: marker.payload.committedAtWorldTime ?? marker.payload.mirrorEndedAtWorldTime,
        influenceDelta: marker.payload.influenceDelta,
        factionStandings: marker.payload.factionStandings,
        npcRelationships: marker.payload.npcRelationships,
        commitEventId: marker.eventId,
        sourceEventIds: [...marker.payload.effectEventIds, marker.eventId],
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
      ]);
      const effectEvents = marker.payload.effectEventIds.map((eventId) => eventsById.get(eventId));
      if (effectEvents.some((event) => !event
        || event.correlationId !== journey.correlationId
        || !allowedEffectTypes.has(event.eventType))) {
        throw new Error("result_page_journey_world_commit_invalid");
      }
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
    nextActions: resultPageNextActions({ progress, regionId, regionalContext }),
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
