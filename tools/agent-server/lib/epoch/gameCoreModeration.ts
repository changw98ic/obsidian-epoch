import type {
  EpochCommandContext,
  EpochClock,
  EpochContentModerationStatus,
  EpochEventType,
  EpochIdFactory,
  EpochMessageScope,
  EpochModerationResolution,
  EpochModerationSubjectType,
  EpochRiskReviewResolution,
} from "./protocol.ts";
import type { EpochEvent } from "./events.ts";
import {
  assertFiniteInteger,
  assertMessageScope,
  assertModerationResolution,
  assertNonEmptyString,
  assertRiskReviewResolution,
  normalizeTrustClass,
  serverIsoTime,
} from "./protocol.ts";
import { eventFactory } from "./eventFactory.ts";
import {
  assertKnownSourceEvents,
  riskReviewAnalysisForEvent,
  riskReviewSourceEvent,
} from "./sourceEventRules.ts";
import {
  normalizeMessageBody,
  planAbuseScoreDecayEvents,
  planAbuseScoreReleaseEvents,
  planMarketRiskRestrictionReleaseEvents,
  planMessagePostedEvents,
  planModerationResolvedEvents,
  planRegionNewsGenerationEvents,
  planRiskReviewRecordedEvents,
  projectAbuseScoreDecays,
  projectAbuseScoreRelease,
  projectGeneratedRegionNews,
  projectMarketRiskRestrictionRelease,
  projectModerationResolved,
  projectPostedMessage,
  projectRiskReviewRecorded,
  requireModerationItem,
} from "./moderationRiskRules.ts";
import {
  planCommandRejectedEvents,
  projectCommandRejectedEvent,
} from "./commandAbuseRules.ts";
import {
  requireActiveIdentity,
} from "./identityProjectionRules.ts";
import {
  assertClientIdentityOwner,
} from "./identityAuthorizationRules.ts";
import type {
  EpochCommandResult,
  EpochProjection,
} from "./gameCore.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EpochRegionNews {
  readonly newsId: string;
  readonly regionId: string;
  readonly headline: string;
  readonly body: string;
  readonly legendDelta: number;
  readonly sourceEventIds: readonly string[];
  readonly createdAt: string;
  readonly moderationStatus: EpochContentModerationStatus;
}

export interface EpochMessageRecord {
  readonly messageId: string;
  readonly scope: EpochMessageScope;
  readonly agentId: string;
  readonly explorerId: string;
  readonly regionId?: string;
  readonly body: string;
  readonly postedAt: string;
  readonly moderationStatus: EpochContentModerationStatus;
}

export type EpochModerationItemStatus = "open" | "resolved";

export interface EpochModerationItem {
  readonly moderationId: string;
  readonly subjectType: EpochModerationSubjectType;
  readonly subjectId: string;
  readonly sourceEventId: string;
  readonly agentId?: string;
  readonly explorerId?: string;
  readonly regionId?: string;
  readonly reason: string;
  readonly severity: "low" | "medium" | "high";
  readonly bodyPreview: string;
  readonly queuedAt: string;
  readonly status: EpochModerationItemStatus;
  readonly resolution?: EpochModerationResolution;
  readonly resolvedBy?: string;
  readonly resolvedAt?: string;
  readonly note?: string;
}

export interface EpochRiskReview {
  readonly reviewId: string;
  readonly sourceEventId: string;
  readonly sourceEventType: EpochEventType;
  readonly agentId?: string;
  readonly explorerId?: string;
  readonly resolution: EpochRiskReviewResolution;
  readonly reviewFlags: readonly string[];
  readonly reviewScore: number;
  readonly operatorId: string;
  readonly reviewedAt: string;
  readonly note?: string;
}

export interface EpochMarketRiskRestriction {
  readonly agentId: string;
  readonly explorerId?: string;
  readonly sourceEventId: string;
  readonly sourceReviewId: string;
  readonly reviewFlags: readonly string[];
  readonly reviewScore: number;
  readonly reason: "risk_review_escalated";
  readonly restrictedAt: string;
}

export interface EpochMarketRiskRestrictionRelease {
  readonly releaseId: string;
  readonly agentId: string;
  readonly explorerId?: string;
  readonly sourceEventId: string;
  readonly sourceReviewId: string;
  readonly releasedBy: string;
  readonly releasedAt: string;
  readonly note?: string;
}

export interface EpochAbuseScoreProfile {
  readonly actorKey: string;
  readonly agentId?: string;
  readonly explorerId?: string;
  readonly score: number;
  readonly updatedAt: string;
  readonly latestEventId: string;
  readonly sourceEventIds: readonly string[];
  readonly reasons: Readonly<Record<string, number>>;
}

export interface EpochAbuseScoreRelease {
  readonly releaseId: string;
  readonly actorKey: string;
  readonly agentId?: string;
  readonly explorerId?: string;
  readonly previousScore: number;
  readonly scoreAfter: number;
  readonly sourceEventId?: string;
  readonly releasedBy: string;
  readonly releasedAt: string;
  readonly note?: string;
}

export interface EpochAbuseScoreDecay {
  readonly decayId: string;
  readonly actorKey: string;
  readonly agentId?: string;
  readonly explorerId?: string;
  readonly previousScore: number;
  readonly scoreAfter: number;
  readonly decayAmount: number;
  readonly sourceEventId?: string;
  readonly decayedBy: string;
  readonly decayedAt: string;
  readonly reason: "maintenance_decay";
}

export interface DecayAbuseScoresInput {
  readonly limit?: number;
  readonly amount?: number;
  readonly minScore?: number;
}

export interface GenerateRegionNewsInput {
  readonly regionId: string;
  readonly headline: string;
  readonly body: string;
  readonly legendDelta?: number;
  readonly sourceEventIds: readonly string[];
}

export interface PostMessageInput {
  readonly agentId: string;
  readonly scope: EpochMessageScope;
  readonly regionId?: string;
  readonly body: string;
}

export interface ResolveModerationItemInput {
  readonly moderationId: string;
  readonly resolution: EpochModerationResolution;
  readonly note?: string;
}

export interface RecordRiskReviewInput {
  readonly sourceEventId: string;
  readonly resolution: EpochRiskReviewResolution;
  readonly note?: string;
}

export interface ReleaseMarketRiskRestrictionInput {
  readonly agentId: string;
  readonly note?: string;
}

export interface ReleaseAbuseRestrictionInput {
  readonly actorKey?: string;
  readonly agentId?: string;
  readonly explorerId?: string;
  readonly scoreAfter?: number;
  readonly note?: string;
}

export interface RecordCommandRejectedInput {
  readonly surface: "http" | "mcp";
  readonly command: string;
  readonly errorCode: string;
  readonly statusCode?: number;
  readonly actorKey?: string;
  readonly agentId?: string;
  readonly explorerId?: string;
  readonly inputSummary?: Readonly<Record<string, unknown>>;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

export interface GameCoreModerationContext {
  readonly projection: () => EpochProjection;
  readonly commit: <T>(events: readonly EpochEvent[], value: T) => EpochCommandResult<T>;
  readonly applyEvents: (projection: EpochProjection, events: readonly EpochEvent[]) => EpochProjection;
  readonly clock: EpochClock;
  readonly idFactory: EpochIdFactory;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function requireServerTrust(context: EpochCommandContext, errorCode: string) {
  const trustClass = normalizeTrustClass(context.trustClass);
  if (trustClass === "untrusted_client") throw new Error(errorCode);
  return trustClass;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createModerationCommands(ctx: GameCoreModerationContext) {
  const { projection, commit, applyEvents, clock, idFactory } = ctx;

  function generateRegionNews(input: GenerateRegionNewsInput, context: EpochCommandContext): EpochCommandResult<EpochRegionNews> {
    const trustClass = requireServerTrust(context, "region_news_requires_server_trust");
    const current = projection();
    const sourceEventIds = [...input.sourceEventIds];
    if (sourceEventIds.length === 0) throw new Error("region_news_source_events_required");
    assertKnownSourceEvents(current, sourceEventIds);
    const regionId = assertNonEmptyString(input.regionId, "region_id");
    const headline = assertNonEmptyString(input.headline, "news_headline");
    const body = assertNonEmptyString(input.body, "news_body");
    const makeEvent = eventFactory(clock, idFactory, { ...context, trustClass });
    const nextEvents = planRegionNewsGenerationEvents({
      projection: current,
      regionId,
      headline,
      body,
      legendDelta: input.legendDelta === undefined ? 0 : assertFiniteInteger(input.legendDelta, "legend_delta"),
      sourceEventIds,
      queuedAt: serverIsoTime(clock),
      idFactory,
      makeEvent,
    });
    const nextProjection = applyEvents(current, nextEvents);
    return commit(nextEvents, projectGeneratedRegionNews({
      events: nextEvents,
      projection: nextProjection,
    }));
  }

  function postMessage(input: PostMessageInput, context: EpochCommandContext): EpochCommandResult<EpochMessageRecord> {
    const current = projection();
    const agentId = assertNonEmptyString(input.agentId, "agent_id");
    const identity = requireActiveIdentity(current, agentId);
    assertClientIdentityOwner(identity, context, "message_owner_mismatch");
    const scope = assertMessageScope(input.scope);
    const regionId = scope === "region" ? assertNonEmptyString(input.regionId, "region_id") : undefined;
    const body = normalizeMessageBody(input.body);
    const postedAt = serverIsoTime(clock);
    const makeEvent = eventFactory(clock, idFactory, context);
    const nextEvents = planMessagePostedEvents({
      scope,
      agentId,
      explorerId: identity.explorerId,
      regionId,
      body,
      postedAt,
      idFactory,
      makeEvent,
    });
    const nextProjection = applyEvents(current, nextEvents);
    return commit(nextEvents, projectPostedMessage({
      events: nextEvents,
      projection: nextProjection,
    }));
  }

  function resolveModerationItem(input: ResolveModerationItemInput, context: EpochCommandContext): EpochCommandResult<EpochModerationItem> {
    const trustClass = requireServerTrust(context, "moderation_resolution_requires_server_trust");
    const current = projection();
    const moderationId = assertNonEmptyString(input.moderationId, "moderation_id");
    const existing = requireModerationItem(current, moderationId);
    if (existing.status !== "open") throw new Error("moderation_item_already_resolved");
    const resolvedAt = serverIsoTime(clock);
    const makeEvent = eventFactory(clock, idFactory, { ...context, trustClass });
    const nextEvents = planModerationResolvedEvents({
      moderationId,
      resolution: assertModerationResolution(input.resolution),
      resolvedBy: assertNonEmptyString(context.actorExplorerId, "actor_explorer_id"),
      resolvedAt,
      note: input.note,
      makeEvent,
    });
    const nextProjection = applyEvents(current, nextEvents);
    return commit(nextEvents, projectModerationResolved({
      events: nextEvents,
      projection: nextProjection,
    }));
  }

  function recordRiskReview(input: RecordRiskReviewInput, context: EpochCommandContext): EpochCommandResult<EpochRiskReview> {
    const trustClass = requireServerTrust(context, "risk_review_requires_server_trust");
    const current = projection();
    const sourceEventId = assertNonEmptyString(input.sourceEventId, "risk_review_source_event_id");
    const sourceEvent = riskReviewSourceEvent({ events: current.events, sourceEventId });
    const existingReviewId = current.riskReviewIdsBySourceEvent[sourceEventId]?.[0];
    if (existingReviewId && current.riskReviews[existingReviewId]) {
      return { events: [], value: current.riskReviews[existingReviewId], projection: current };
    }
    const { reviewFlags, reviewScore } = riskReviewAnalysisForEvent(sourceEvent);
    const reviewedAt = serverIsoTime(clock);
    const reviewId = idFactory("risk_review", sourceEventId);
    const makeEvent = eventFactory(clock, idFactory, { ...context, trustClass });
    const nextEvents = planRiskReviewRecordedEvents({
      reviewId,
      sourceEventId,
      sourceEventType: sourceEvent.eventType,
      agentId: sourceEvent.agentId,
      explorerId: sourceEvent.actorExplorerId,
      resolution: assertRiskReviewResolution(input.resolution),
      reviewFlags,
      reviewScore,
      operatorId: assertNonEmptyString(context.actorExplorerId, "actor_explorer_id"),
      reviewedAt,
      note: input.note,
      makeEvent,
    });
    const nextProjection = applyEvents(current, nextEvents);
    return commit(nextEvents, projectRiskReviewRecorded({
      events: nextEvents,
      projection: nextProjection,
    }));
  }

  function releaseMarketRiskRestriction(input: ReleaseMarketRiskRestrictionInput, context: EpochCommandContext): EpochCommandResult<EpochMarketRiskRestrictionRelease> {
    const trustClass = requireServerTrust(context, "market_risk_restriction_release_requires_server_trust");
    const current = projection();
    const agentId = assertNonEmptyString(input.agentId, "agent_id");
    const restriction = current.marketRiskRestrictions[agentId];
    if (!restriction) throw new Error("market_risk_restriction_not_found");
    const releaseId = idFactory("risk_restriction_release", `${agentId}:${restriction.sourceReviewId}`);
    const existing = current.marketRiskRestrictionReleases[releaseId];
    if (existing) return { events: [], value: existing, projection: current };
    const releasedAt = serverIsoTime(clock);
    const makeEvent = eventFactory(clock, idFactory, { ...context, trustClass });
    const nextEvents = planMarketRiskRestrictionReleaseEvents({
      releaseId,
      restriction,
      releasedBy: assertNonEmptyString(context.actorExplorerId, "actor_explorer_id"),
      releasedAt,
      note: input.note,
      makeEvent,
    });
    const nextProjection = applyEvents(current, nextEvents);
    return commit(nextEvents, projectMarketRiskRestrictionRelease({
      events: nextEvents,
      projection: nextProjection,
    }));
  }

  function releaseAbuseRestriction(input: ReleaseAbuseRestrictionInput, context: EpochCommandContext): EpochCommandResult<EpochAbuseScoreRelease> {
    const trustClass = requireServerTrust(context, "abuse_release_requires_server_trust");
    const current = projection();
    const actorKey = assertNonEmptyString(input.actorKey || input.agentId || input.explorerId, "actor_key");
    const existing = current.abuseScores[actorKey];
    if (!existing) throw new Error("abuse_profile_not_found");
    const requestedScore = typeof input.scoreAfter === "number" && Number.isFinite(input.scoreAfter)
      ? input.scoreAfter
      : 0;
    const scoreAfter = Math.max(0, Math.min(existing.score, Math.floor(requestedScore)));
    if (scoreAfter >= existing.score) throw new Error("abuse_release_score_not_lower");
    const releasedAt = serverIsoTime(clock);
    const makeEvent = eventFactory(clock, idFactory, { ...context, trustClass });
    const nextEvents = planAbuseScoreReleaseEvents({
      profile: existing,
      agentId: input.agentId,
      explorerId: input.explorerId,
      scoreAfter,
      releasedBy: assertNonEmptyString(context.actorExplorerId, "actor_explorer_id"),
      releasedAt,
      note: input.note,
      idFactory,
      makeEvent,
    });
    const nextProjection = applyEvents(current, nextEvents);
    return commit(nextEvents, projectAbuseScoreRelease({
      events: nextEvents,
      projection: nextProjection,
    }));
  }

  function decayAbuseScores(input: DecayAbuseScoresInput, context: EpochCommandContext): EpochCommandResult<readonly EpochAbuseScoreDecay[]> {
    const trustClass = requireServerTrust(context, "abuse_decay_requires_server_trust");
    const current = projection();
    const decayedAt = serverIsoTime(clock);
    const makeEvent = eventFactory(clock, idFactory, { ...context, trustClass });
    const decayedEvents = planAbuseScoreDecayEvents({
      profilesByActorKey: current.abuseScores,
      selection: input,
      amount: input.amount,
      decayedBy: assertNonEmptyString(context.actorExplorerId, "actor_explorer_id"),
      decayedAt,
      idFactory,
      makeEvent,
    });
    if (decayedEvents.length === 0) return { events: [], value: [], projection: current };
    const values: readonly EpochAbuseScoreDecay[] = projectAbuseScoreDecays({ events: decayedEvents });
    return commit(decayedEvents, values);
  }

  function recordCommandRejected(input: RecordCommandRejectedInput, context: EpochCommandContext): EpochCommandResult<EpochEvent> {
    const trustClass = requireServerTrust(context, "command_rejected_record_requires_server_trust");
    const current = projection();
    const rejectedAt = serverIsoTime(clock);
    const makeEvent = eventFactory(clock, idFactory, { ...context, trustClass });
    const nextEvents = planCommandRejectedEvents({
      projection: current,
      surface: input.surface === "mcp" ? "mcp" : "http",
      command: input.command,
      errorCode: input.errorCode,
      statusCode: input.statusCode,
      actorKey: input.actorKey,
      agentId: input.agentId,
      explorerId: input.explorerId,
      actorExplorerId: context.actorExplorerId,
      rejectedAt,
      inputSummary: input.inputSummary,
      idFactory,
      makeEvent,
    });
    return commit(nextEvents, projectCommandRejectedEvent(nextEvents));
  }

  return {
    generateRegionNews,
    postMessage,
    resolveModerationItem,
    recordRiskReview,
    releaseMarketRiskRestriction,
    releaseAbuseRestriction,
    decayAbuseScores,
    recordCommandRejected,
  };
}
