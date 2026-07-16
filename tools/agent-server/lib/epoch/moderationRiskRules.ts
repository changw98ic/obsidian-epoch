import {
  type EpochEvent,
  type AbuseScoreDecayedPayload,
  type AbuseScoreReleasedPayload,
  type MarketRiskRestrictionReleasedPayload,
  type MessagePostedPayload,
  type ModerationQueuedPayload,
  type ModerationResolvedPayload,
  type RegionNewsGeneratedPayload,
  type RiskReviewRecordedPayload,
} from "./events.ts";
import {
  assertNonEmptyString,
  type EpochIdFactory,
  type EpochContentModerationStatus,
  type EpochCommandContext,
  type EpochEventType,
  type EpochMessageScope,
  type EpochModerationResolution,
  type EpochModerationSubjectType,
  type EpochRiskReviewResolution,
} from "./protocol.ts";
import type { EpochEventFactory } from "./eventFactory.ts";

export type EpochModerationSeverity = "low" | "medium" | "high";

export const AUTO_ESCALATED_RISK_REVIEW_OPERATOR_ID = "system";
export const AUTO_ESCALATED_RISK_REVIEW_NOTE = "auto_escalated_repeat_direct_trade";
export const MAX_MESSAGE_BODY_LENGTH = 500;

export interface RegionNewsGeneratedPayloadInput {
  readonly newsId: string;
  readonly regionId: string;
  readonly headline: string;
  readonly body: string;
  readonly legendDelta: number;
  readonly sourceEventIds: readonly string[];
  readonly moderationStatus?: EpochContentModerationStatus;
}

export interface PlanRegionNewsGenerationEventsInput {
  readonly projection: ModerationAssessmentProjection;
  readonly regionId: string;
  readonly headline: string;
  readonly body: string;
  readonly legendDelta: number;
  readonly sourceEventIds: readonly string[];
  readonly queuedAt: string;
  readonly idFactory: EpochIdFactory;
  readonly makeEvent: EpochEventFactory;
}

export interface RegionNewsProjectionRecordLike {
  readonly newsId: string;
}

export interface GeneratedRegionNewsProjection<TNews extends RegionNewsProjectionRecordLike = RegionNewsProjectionRecordLike> {
  readonly regionNews: Readonly<Record<string, readonly TNews[] | undefined>>;
}

export interface ProjectGeneratedRegionNewsInput<TNews extends RegionNewsProjectionRecordLike> {
  readonly projection: GeneratedRegionNewsProjection<TNews>;
  readonly events: readonly EpochEvent[];
}

export interface PlanMessagePostedEventsInput {
  readonly scope: EpochMessageScope;
  readonly agentId: string;
  readonly explorerId: string;
  readonly regionId?: string;
  readonly body: string;
  readonly postedAt: string;
  readonly idFactory: EpochIdFactory;
  readonly makeEvent: EpochEventFactory;
}

export interface PostedMessageProjectionRecordLike {
  readonly messageId: string;
}

export interface PostedMessageProjection<TMessage extends PostedMessageProjectionRecordLike = PostedMessageProjectionRecordLike> {
  readonly worldMessages: readonly TMessage[];
  readonly regionMessages: Readonly<Record<string, readonly TMessage[] | undefined>>;
}

export interface ProjectPostedMessageInput<TMessage extends PostedMessageProjectionRecordLike> {
  readonly projection: PostedMessageProjection<TMessage>;
  readonly events: readonly EpochEvent[];
}

export interface MessagePostedPayloadInput {
  readonly messageId: string;
  readonly scope: EpochMessageScope;
  readonly agentId: string;
  readonly explorerId: string;
  readonly regionId?: string;
  readonly body: string;
  readonly postedAt: string;
  readonly moderationStatus?: EpochContentModerationStatus;
}

export interface ModerationQueuedPayloadInput {
  readonly moderationId: string;
  readonly subjectType: EpochModerationSubjectType;
  readonly subjectId: string;
  readonly sourceEventId: string;
  readonly agentId?: string;
  readonly explorerId?: string;
  readonly regionId?: string;
  readonly reason: string;
  readonly severity: EpochModerationSeverity;
  readonly bodyPreview: string;
  readonly queuedAt: string;
}

export interface ModerationResolvedPayloadInput {
  readonly moderationId: string;
  readonly resolution: EpochModerationResolution;
  readonly resolvedBy: string;
  readonly resolvedAt: string;
  readonly note?: string;
}

export interface PlanModerationResolvedEventsInput {
  readonly moderationId: string;
  readonly resolution: EpochModerationResolution;
  readonly resolvedBy: string;
  readonly resolvedAt: string;
  readonly note?: string;
  readonly makeEvent: EpochEventFactory;
}

export interface ProjectModerationResolvedInput<TModerationItem> {
  readonly projection: ModerationItemProjectionForRules<TModerationItem>;
  readonly events: readonly EpochEvent[];
}

export interface RiskReviewRecordedPayloadInput {
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

export interface PlanRiskReviewRecordedEventsInput {
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
  readonly makeEvent: EpochEventFactory;
}

export interface RiskReviewProjectionRecordLike {
  readonly reviewId: string;
}

export interface RiskReviewProjection<TReview extends RiskReviewProjectionRecordLike = RiskReviewProjectionRecordLike> {
  readonly riskReviews: Readonly<Record<string, TReview | undefined>>;
}

export interface ProjectRiskReviewRecordedInput<TReview extends RiskReviewProjectionRecordLike> {
  readonly projection: RiskReviewProjection<TReview>;
  readonly events: readonly EpochEvent[];
}

export interface AutoEscalatedRiskReviewPlanInput {
  readonly reviewId: string;
  readonly sourceEventId: string;
  readonly sourceEventType: EpochEventType;
  readonly agentId?: string;
  readonly explorerId?: string;
  readonly reviewFlags: readonly string[];
  readonly reviewScore: number;
  readonly reviewedAt: string;
  readonly correlationId?: string;
}

export interface AutoEscalatedRiskReviewPlan {
  readonly context: EpochCommandContext;
  readonly payload: RiskReviewRecordedPayload;
  readonly aggregateType: "moderation_item";
  readonly agentId?: string;
}

export interface MarketRiskRestrictionReleasedPayloadInput {
  readonly releaseId: string;
  readonly agentId: string;
  readonly explorerId?: string;
  readonly sourceEventId: string;
  readonly sourceReviewId: string;
  readonly releasedBy: string;
  readonly releasedAt: string;
  readonly note?: string;
}

export interface MarketRiskRestrictionForReleaseLike {
  readonly agentId: string;
  readonly explorerId?: string;
  readonly sourceEventId: string;
  readonly sourceReviewId: string;
}

export interface PlanMarketRiskRestrictionReleaseEventsInput {
  readonly releaseId: string;
  readonly restriction: MarketRiskRestrictionForReleaseLike;
  readonly releasedBy: string;
  readonly releasedAt: string;
  readonly note?: string;
  readonly makeEvent: EpochEventFactory;
}

export interface MarketRiskRestrictionReleaseProjectionRecordLike {
  readonly releaseId: string;
}

export interface MarketRiskRestrictionReleaseProjection<TRelease extends MarketRiskRestrictionReleaseProjectionRecordLike = MarketRiskRestrictionReleaseProjectionRecordLike> {
  readonly marketRiskRestrictionReleases: Readonly<Record<string, TRelease | undefined>>;
}

export interface ProjectMarketRiskRestrictionReleaseInput<TRelease extends MarketRiskRestrictionReleaseProjectionRecordLike> {
  readonly projection: MarketRiskRestrictionReleaseProjection<TRelease>;
  readonly events: readonly EpochEvent[];
}

export interface AbuseScoreReleasedPayloadInput {
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

export interface AbuseScoreDecayedPayloadInput {
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
}

export interface AbuseScoreReleaseProfileLike {
  readonly actorKey: string;
  readonly agentId?: string;
  readonly explorerId?: string;
  readonly score: number;
  readonly latestEventId: string;
}

export interface PlanAbuseScoreReleaseEventsInput {
  readonly profile: AbuseScoreReleaseProfileLike;
  readonly agentId?: string;
  readonly explorerId?: string;
  readonly scoreAfter: number;
  readonly releasedBy: string;
  readonly releasedAt: string;
  readonly note?: string;
  readonly idFactory: EpochIdFactory;
  readonly makeEvent: EpochEventFactory;
}

export interface AbuseScoreReleaseProjectionRecordLike {
  readonly latestEventId: string;
}

export interface AbuseScoreReleaseProjection<TProfile extends AbuseScoreReleaseProjectionRecordLike = AbuseScoreReleaseProjectionRecordLike> {
  readonly abuseScores: Readonly<Record<string, TProfile | undefined>>;
}

export interface ProjectAbuseScoreReleaseInput<TProfile extends AbuseScoreReleaseProjectionRecordLike> {
  readonly projection: AbuseScoreReleaseProjection<TProfile>;
  readonly events: readonly EpochEvent[];
}

export interface AbuseScoreDecaySelectionInput {
  readonly limit?: number;
  readonly minScore?: number;
}

export interface AbuseScoreDecayTargetLike {
  readonly actorKey: string;
  readonly score: number;
  readonly updatedAt: string;
}

export interface AbuseScoreDecayEventTarget extends AbuseScoreDecayTargetLike {
  readonly agentId?: string;
  readonly explorerId?: string;
  readonly latestEventId: string;
}

export interface PlanAbuseScoreDecayEventsInput {
  readonly profilesByActorKey: Readonly<Record<string, AbuseScoreDecayEventTarget>>;
  readonly selection: AbuseScoreDecaySelectionInput;
  readonly amount?: number;
  readonly decayedBy: string;
  readonly decayedAt: string;
  readonly idFactory: EpochIdFactory;
  readonly makeEvent: EpochEventFactory;
}

export interface ProjectAbuseScoreDecaysInput {
  readonly events: readonly EpochEvent[];
}

export interface MessageModerationStatusRecord {
  readonly messageId: string;
  readonly moderationStatus?: EpochContentModerationStatus;
}

export interface NewsModerationStatusRecord {
  readonly newsId: string;
  readonly moderationStatus?: EpochContentModerationStatus;
}

export interface ModerationAssessmentItem {
  readonly status: "open" | string;
  readonly sourceEventId: string;
}

export interface ModerationAssessmentProjection {
  readonly moderationItems: Readonly<Record<string, ModerationAssessmentItem>>;
}

export interface ModerationItemProjectionForRules<TModerationItem = unknown> {
  readonly moderationItems: Readonly<Record<string, TModerationItem | undefined>>;
}

function normalizedNote(note: string | undefined): string | undefined {
  const trimmed = typeof note === "string" ? note.trim() : "";
  return trimmed ? trimmed.slice(0, 240) : undefined;
}

export function requireModerationItem<TModerationItem>(
  projection: ModerationItemProjectionForRules<TModerationItem>,
  moderationId: string,
): TModerationItem {
  const item = projection.moderationItems[moderationId];
  if (!item) throw new Error("moderation_item_not_found");
  return item;
}

export function normalizeMessageBody(value: unknown): string {
  const body = assertNonEmptyString(value, "message_body");
  if (body.length > MAX_MESSAGE_BODY_LENGTH) throw new Error("message_body_too_long");
  return body;
}

export function bodyPreview(value: string): string {
  return value.trim().slice(0, 160);
}

export function moderationAssessment(value: string): { reason: string; severity: EpochModerationSeverity } | null {
  const normalized = value.toLowerCase().normalize("NFKC");
  const authorityClaim = /帝国统帅|统帅|皇帝|军团|服务器给我|给我金币|上新闻|传说|legend|grant|admin|root/.test(normalized);
  const resourceClaim = /金币|资源|奖励|寿命|身份|rank|title|coin|aether|stamina|focus/.test(normalized);
  if (authorityClaim && resourceClaim) {
    return { reason: "authority_or_reward_claim", severity: "high" };
  }
  if (authorityClaim) {
    return { reason: "authority_claim", severity: "medium" };
  }
  return null;
}

export function moderationAssessmentForNews(
  projection: ModerationAssessmentProjection,
  headline: string,
  body: string,
  sourceEventIds: readonly string[],
): { reason: string; severity: EpochModerationSeverity } | null {
  const assessment = moderationAssessment(`${headline}\n${body}`);
  if (assessment) return assessment;
  const hasOpenModeratedSource = Object.values(projection.moderationItems)
    .some((item) => item.status === "open" && sourceEventIds.includes(item.sourceEventId));
  return hasOpenModeratedSource ? { reason: "source_under_moderation", severity: "medium" } : null;
}

export function contentStatusForResolution(resolution: EpochModerationResolution): EpochContentModerationStatus {
  return resolution === "approved" ? "visible" : "hidden";
}

export function updateMessageModerationStatus<TMessage extends MessageModerationStatusRecord>(
  worldMessages: TMessage[],
  regionMessages: Record<string, TMessage[]>,
  messageId: string,
  moderationStatus: EpochContentModerationStatus,
): void {
  const replaceMessage = (message: TMessage): TMessage =>
    message.messageId === messageId ? { ...message, moderationStatus } as TMessage : message;
  for (let index = 0; index < worldMessages.length; index += 1) {
    worldMessages[index] = replaceMessage(worldMessages[index]);
  }
  for (const regionId of Object.keys(regionMessages)) {
    regionMessages[regionId] = regionMessages[regionId].map(replaceMessage);
  }
}

export function updateNewsModerationStatus<TNews extends NewsModerationStatusRecord>(
  regionNews: Record<string, TNews[]>,
  newsId: string,
  moderationStatus: EpochContentModerationStatus,
): void {
  for (const regionId of Object.keys(regionNews)) {
    regionNews[regionId] = regionNews[regionId].map((news) =>
      news.newsId === newsId ? { ...news, moderationStatus } as TNews : news,
    );
  }
}

export function abuseDecayLimit(value: number | undefined): number {
  return Math.max(0, Math.min(Math.floor(Number(value ?? 0)), 100));
}

export function abuseDecayAmount(value: number | undefined): number {
  return Math.max(1, Math.min(Math.floor(Number(value ?? 1)), 10));
}

export function abuseDecayMinScore(value: number | undefined): number {
  return Math.max(1, Math.floor(Number(value ?? 1)));
}

export function selectAbuseScoreDecayTargets<TProfile extends AbuseScoreDecayTargetLike>(
  profilesByActorKey: Readonly<Record<string, TProfile>>,
  input: AbuseScoreDecaySelectionInput,
): readonly TProfile[] {
  const limit = abuseDecayLimit(input.limit);
  const minScore = abuseDecayMinScore(input.minScore);
  return Object.values(profilesByActorKey)
    .filter((profile) => profile.score >= minScore)
    .sort((left, right) => right.score - left.score || left.updatedAt.localeCompare(right.updatedAt) || left.actorKey.localeCompare(right.actorKey))
    .slice(0, limit);
}

export function regionNewsGeneratedPayload(input: RegionNewsGeneratedPayloadInput): RegionNewsGeneratedPayload {
  return {
    newsId: input.newsId,
    regionId: input.regionId,
    headline: input.headline,
    body: input.body,
    legendDelta: input.legendDelta,
    sourceEventIds: input.sourceEventIds,
    moderationStatus: input.moderationStatus,
  };
}

export function planRegionNewsGenerationEvents(input: PlanRegionNewsGenerationEventsInput): readonly EpochEvent[] {
  const assessment = moderationAssessmentForNews(input.projection, input.headline, input.body, input.sourceEventIds);
  const moderationStatus: EpochContentModerationStatus = assessment ? "queued" : "visible";
  const newsId = input.idFactory("news", `${input.regionId}:${input.headline}`);
  const payload = regionNewsGeneratedPayload({
    newsId,
    regionId: input.regionId,
    headline: input.headline,
    body: input.body,
    legendDelta: input.legendDelta,
    sourceEventIds: input.sourceEventIds,
    moderationStatus,
  });
  const news = input.makeEvent("region_news_generated", input.regionId, payload, {
    aggregateType: "region",
  });
  const nextEvents: EpochEvent[] = [news];
  if (assessment) {
    const moderationId = input.idFactory("moderation", `region_news:${newsId}:${assessment.reason}`);
    const moderationPayload = moderationQueuedPayload({
      moderationId,
      subjectType: "region_news",
      subjectId: newsId,
      sourceEventId: news.eventId,
      regionId: input.regionId,
      reason: assessment.reason,
      severity: assessment.severity,
      bodyPreview: bodyPreview(`${input.headline} ${input.body}`),
      queuedAt: input.queuedAt,
    });
    nextEvents.push(input.makeEvent("moderation_queued", moderationId, moderationPayload, {
      aggregateType: "moderation_item",
    }));
  }
  return nextEvents;
}

export function projectGeneratedRegionNews<TNews extends RegionNewsProjectionRecordLike>(
  input: ProjectGeneratedRegionNewsInput<TNews>,
): TNews {
  const newsEvent = input.events.find((event) => event.eventType === "region_news_generated");
  if (!newsEvent || newsEvent.eventType !== "region_news_generated") throw new Error("region_news_projection_failed");
  const created = input.projection.regionNews[newsEvent.payload.regionId]
    ?.find((item) => item.newsId === newsEvent.payload.newsId);
  if (!created) throw new Error("region_news_projection_failed");
  return created;
}

export function messagePostedPayload(input: MessagePostedPayloadInput): MessagePostedPayload {
  return {
    messageId: input.messageId,
    scope: input.scope,
    agentId: input.agentId,
    explorerId: input.explorerId,
    regionId: input.regionId,
    body: input.body,
    postedAt: input.postedAt,
    moderationStatus: input.moderationStatus,
  };
}

export function planMessagePostedEvents(input: PlanMessagePostedEventsInput): readonly EpochEvent[] {
  const assessment = moderationAssessment(input.body);
  const moderationStatus: EpochContentModerationStatus = assessment ? "queued" : "visible";
  const messageId = input.idFactory("message", `${input.scope}:${input.regionId || "world"}:${input.agentId}:${input.postedAt}:${input.body}`);
  const payload = messagePostedPayload({
    messageId,
    scope: input.scope,
    agentId: input.agentId,
    explorerId: input.explorerId,
    regionId: input.regionId,
    body: input.body,
    postedAt: input.postedAt,
    moderationStatus,
  });
  const posted = input.makeEvent("message_posted", messageId, payload, {
    aggregateType: "message",
    agentId: input.agentId,
  });
  const nextEvents: EpochEvent[] = [posted];
  if (assessment) {
    const moderationId = input.idFactory("moderation", `message:${messageId}:${assessment.reason}`);
    const moderationPayload = moderationQueuedPayload({
      moderationId,
      subjectType: "message",
      subjectId: messageId,
      sourceEventId: posted.eventId,
      agentId: input.agentId,
      explorerId: input.explorerId,
      regionId: input.regionId,
      reason: assessment.reason,
      severity: assessment.severity,
      bodyPreview: bodyPreview(input.body),
      queuedAt: input.postedAt,
    });
    nextEvents.push(input.makeEvent("moderation_queued", moderationId, moderationPayload, {
      aggregateType: "moderation_item",
      agentId: input.agentId,
    }));
  }
  return nextEvents;
}

export function projectPostedMessage<TMessage extends PostedMessageProjectionRecordLike>(
  input: ProjectPostedMessageInput<TMessage>,
): TMessage {
  const postedEvent = input.events.find((event) => event.eventType === "message_posted");
  if (!postedEvent || postedEvent.eventType !== "message_posted") throw new Error("message_projection_failed");
  const messages = postedEvent.payload.scope === "world"
    ? input.projection.worldMessages
    : input.projection.regionMessages[postedEvent.payload.regionId || ""] || [];
  const message = messages.find((candidate) => candidate.messageId === postedEvent.payload.messageId);
  if (!message) throw new Error("message_projection_failed");
  return message;
}

export function moderationQueuedPayload(input: ModerationQueuedPayloadInput): ModerationQueuedPayload {
  return {
    moderationId: input.moderationId,
    subjectType: input.subjectType,
    subjectId: input.subjectId,
    sourceEventId: input.sourceEventId,
    agentId: input.agentId,
    explorerId: input.explorerId,
    regionId: input.regionId,
    reason: input.reason,
    severity: input.severity,
    bodyPreview: input.bodyPreview,
    queuedAt: input.queuedAt,
  };
}

export function moderationResolvedPayload(input: ModerationResolvedPayloadInput): ModerationResolvedPayload {
  return {
    moderationId: input.moderationId,
    resolution: input.resolution,
    resolvedBy: input.resolvedBy,
    resolvedAt: input.resolvedAt,
    note: normalizedNote(input.note),
  };
}

export function planModerationResolvedEvents(input: PlanModerationResolvedEventsInput): readonly EpochEvent[] {
  const payload = moderationResolvedPayload({
    moderationId: input.moderationId,
    resolution: input.resolution,
    resolvedBy: input.resolvedBy,
    resolvedAt: input.resolvedAt,
    note: input.note,
  });
  const resolved = input.makeEvent("moderation_resolved", input.moderationId, payload, {
    aggregateType: "moderation_item",
  });
  return [resolved];
}

export function projectModerationResolved<TModerationItem>(
  input: ProjectModerationResolvedInput<TModerationItem>,
): TModerationItem {
  const resolved = input.events.find((event) => event.eventType === "moderation_resolved");
  if (!resolved || resolved.eventType !== "moderation_resolved") {
    throw new Error("moderation_resolution_projection_failed");
  }
  return requireModerationItem(input.projection, resolved.payload.moderationId);
}

export function riskReviewRecordedPayload(input: RiskReviewRecordedPayloadInput): RiskReviewRecordedPayload {
  return {
    reviewId: input.reviewId,
    sourceEventId: input.sourceEventId,
    sourceEventType: input.sourceEventType,
    agentId: input.agentId,
    explorerId: input.explorerId,
    resolution: input.resolution,
    reviewFlags: input.reviewFlags,
    reviewScore: input.reviewScore,
    operatorId: input.operatorId,
    reviewedAt: input.reviewedAt,
    note: normalizedNote(input.note),
  };
}

export function planRiskReviewRecordedEvents(input: PlanRiskReviewRecordedEventsInput): readonly EpochEvent[] {
  const payload = riskReviewRecordedPayload({
    reviewId: input.reviewId,
    sourceEventId: input.sourceEventId,
    sourceEventType: input.sourceEventType,
    agentId: input.agentId,
    explorerId: input.explorerId,
    resolution: input.resolution,
    reviewFlags: input.reviewFlags,
    reviewScore: input.reviewScore,
    operatorId: input.operatorId,
    reviewedAt: input.reviewedAt,
    note: input.note,
  });
  const reviewed = input.makeEvent("risk_review_recorded", input.reviewId, payload, {
    aggregateType: "moderation_item",
    agentId: input.agentId,
  });
  return [reviewed];
}

export function projectRiskReviewRecorded<TReview extends RiskReviewProjectionRecordLike>(
  input: ProjectRiskReviewRecordedInput<TReview>,
): TReview {
  const reviewed = input.events.find((event) => event.eventType === "risk_review_recorded");
  if (!reviewed || reviewed.eventType !== "risk_review_recorded") throw new Error("risk_review_projection_failed");
  const review = input.projection.riskReviews[reviewed.payload.reviewId];
  if (!review) throw new Error("risk_review_projection_failed");
  return review;
}

export function autoEscalatedRiskReviewPlan(
  input: AutoEscalatedRiskReviewPlanInput,
): AutoEscalatedRiskReviewPlan | undefined {
  if (!input.reviewFlags.length && input.reviewScore <= 0) return undefined;
  return {
    context: {
      actorExplorerId: AUTO_ESCALATED_RISK_REVIEW_OPERATOR_ID,
      trustClass: "system_worker",
      causationId: input.sourceEventId,
      correlationId: input.correlationId || input.sourceEventId,
    },
    payload: riskReviewRecordedPayload({
      reviewId: input.reviewId,
      sourceEventId: input.sourceEventId,
      sourceEventType: input.sourceEventType,
      agentId: input.agentId,
      explorerId: input.explorerId,
      resolution: "escalated",
      reviewFlags: input.reviewFlags,
      reviewScore: input.reviewScore,
      operatorId: AUTO_ESCALATED_RISK_REVIEW_OPERATOR_ID,
      reviewedAt: input.reviewedAt,
      note: AUTO_ESCALATED_RISK_REVIEW_NOTE,
    }),
    aggregateType: "moderation_item",
    agentId: input.agentId,
  };
}

export function marketRiskRestrictionReleasedPayload(
  input: MarketRiskRestrictionReleasedPayloadInput,
): MarketRiskRestrictionReleasedPayload {
  return {
    releaseId: input.releaseId,
    agentId: input.agentId,
    explorerId: input.explorerId,
    sourceEventId: input.sourceEventId,
    sourceReviewId: input.sourceReviewId,
    releasedBy: input.releasedBy,
    releasedAt: input.releasedAt,
    note: normalizedNote(input.note),
  };
}

export function planMarketRiskRestrictionReleaseEvents(
  input: PlanMarketRiskRestrictionReleaseEventsInput,
): readonly EpochEvent[] {
  const payload = marketRiskRestrictionReleasedPayload({
    releaseId: input.releaseId,
    agentId: input.restriction.agentId,
    explorerId: input.restriction.explorerId,
    sourceEventId: input.restriction.sourceEventId,
    sourceReviewId: input.restriction.sourceReviewId,
    releasedBy: input.releasedBy,
    releasedAt: input.releasedAt,
    note: input.note,
  });
  const released = input.makeEvent("market_risk_restriction_released", input.releaseId, payload, {
    aggregateType: "moderation_item",
    agentId: input.restriction.agentId,
  });
  return [released];
}

export function projectMarketRiskRestrictionRelease<TRelease extends MarketRiskRestrictionReleaseProjectionRecordLike>(
  input: ProjectMarketRiskRestrictionReleaseInput<TRelease>,
): TRelease {
  const released = input.events.find((event) => event.eventType === "market_risk_restriction_released");
  if (!released || released.eventType !== "market_risk_restriction_released") {
    throw new Error("market_risk_restriction_release_projection_failed");
  }
  const release = input.projection.marketRiskRestrictionReleases[released.payload.releaseId];
  if (!release) throw new Error("market_risk_restriction_release_projection_failed");
  return release;
}

export function abuseScoreReleasedPayload(input: AbuseScoreReleasedPayloadInput): AbuseScoreReleasedPayload {
  return {
    releaseId: input.releaseId,
    actorKey: input.actorKey,
    agentId: input.agentId,
    explorerId: input.explorerId,
    previousScore: input.previousScore,
    scoreAfter: input.scoreAfter,
    sourceEventId: input.sourceEventId,
    releasedBy: input.releasedBy,
    releasedAt: input.releasedAt,
    note: normalizedNote(input.note),
  };
}

export function planAbuseScoreReleaseEvents(input: PlanAbuseScoreReleaseEventsInput): readonly EpochEvent[] {
  const payload = abuseScoreReleasedPayload({
    releaseId: input.idFactory("abuse_release", `${input.profile.actorKey}:${input.profile.latestEventId}:${input.scoreAfter}`),
    actorKey: input.profile.actorKey,
    agentId: input.agentId || input.profile.agentId,
    explorerId: input.explorerId || input.profile.explorerId,
    previousScore: input.profile.score,
    scoreAfter: input.scoreAfter,
    sourceEventId: input.profile.latestEventId,
    releasedBy: input.releasedBy,
    releasedAt: input.releasedAt,
    note: input.note,
  });
  const released = input.makeEvent("abuse_score_released", input.profile.actorKey, payload, {
    aggregateType: "abuse_profile",
    agentId: payload.agentId,
  });
  return [released];
}

export function projectAbuseScoreRelease<TProfile extends AbuseScoreReleaseProjectionRecordLike>(
  input: ProjectAbuseScoreReleaseInput<TProfile>,
): AbuseScoreReleasedPayload {
  const released = input.events.find((event) => event.eventType === "abuse_score_released");
  if (!released || released.eventType !== "abuse_score_released") throw new Error("abuse_release_projection_failed");
  const profile = input.projection.abuseScores[released.payload.actorKey];
  if (!profile || profile.latestEventId !== released.eventId) throw new Error("abuse_release_projection_failed");
  return released.payload;
}

export function abuseScoreDecayedPayload(input: AbuseScoreDecayedPayloadInput): AbuseScoreDecayedPayload {
  return {
    decayId: input.decayId,
    actorKey: input.actorKey,
    agentId: input.agentId,
    explorerId: input.explorerId,
    previousScore: input.previousScore,
    scoreAfter: input.scoreAfter,
    decayAmount: input.decayAmount,
    sourceEventId: input.sourceEventId,
    decayedBy: input.decayedBy,
    decayedAt: input.decayedAt,
    reason: "maintenance_decay",
  };
}

export function planAbuseScoreDecayEvents(input: PlanAbuseScoreDecayEventsInput): readonly EpochEvent[] {
  const amount = abuseDecayAmount(input.amount);
  return selectAbuseScoreDecayTargets(input.profilesByActorKey, input.selection)
    .map((profile) => {
      const scoreAfter = Math.max(0, profile.score - amount);
      const payload = abuseScoreDecayedPayload({
        decayId: input.idFactory("abuse_decay", `${profile.actorKey}:${profile.latestEventId}:${scoreAfter}`),
        actorKey: profile.actorKey,
        agentId: profile.agentId,
        explorerId: profile.explorerId,
        previousScore: profile.score,
        scoreAfter,
        decayAmount: profile.score - scoreAfter,
        sourceEventId: profile.latestEventId,
        decayedBy: input.decayedBy,
        decayedAt: input.decayedAt,
      });
      return input.makeEvent("abuse_score_decayed", profile.actorKey, payload, {
        aggregateType: "abuse_profile",
        agentId: payload.agentId,
      });
    });
}

export function projectAbuseScoreDecays(input: ProjectAbuseScoreDecaysInput): readonly AbuseScoreDecayedPayload[] {
  return input.events
    .filter((event): event is Extract<EpochEvent, { readonly eventType: "abuse_score_decayed" }> =>
      event.eventType === "abuse_score_decayed")
    .map((event) => event.payload);
}
