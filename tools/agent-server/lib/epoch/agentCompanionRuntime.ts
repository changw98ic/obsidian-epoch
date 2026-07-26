import { createHash } from "node:crypto";
import { createJourneyRuntime, type JourneyRuntime, type JourneyRuntimeOptions } from "./journeyRuntime.ts";
import type { JourneyAvailableWorldObject, JourneyEpisodeFingerprint, JourneySceneEpisode } from "./journeySceneRules.ts";
import { attachJourneyEventsForPersistence, journeyEventsForPersistence } from "./journeyPersistence.ts";
import { createDurableAgentInteractionProjection } from "./agentInteractionEnvelopeRules.ts";
import type { EpochEvent } from "./events.ts";
import type { EpochAgentIdentity } from "./gameCore.ts";
import type { InternalQuestOffer } from "./journeyOfferRules.ts";
import type { JourneyOfferRuntime } from "./journeyOfferRuntime.ts";
import { buildJourneyAlbum } from "./journeyAlbumReadModel.ts";
import {
  buildGroundedJourneyStoryReport,
  type GroundedJourneyStoryReport,
} from "./journeyStoryReport.ts";
import { buildJourneyInteractionLog } from "./journeyInteractionLog.ts";
import { buildJourneyMission } from "./journeyMissionReadModel.ts";
import { buildAnnualLifeChronicle, monthlyLifeReports } from "./lifeChronicleReadModel.ts";
import { buildLineageChronicle, type LineageChronicleEventRef } from "./lineageChronicleReadModel.ts";
import { publicRegionLabel, publicText } from "./publicVocabulary.ts";
import { journeyScopedNpcObjects, journeyWorldCatalogForRegion } from "./journeyWorldCatalog.ts";
import { resolveEpochCanonicalRegionId } from "../regionAliases.ts";
import { currentMcpRequestAuthContext } from "../mcpRequestAuthContext.ts";
import type { EpochJourney, JourneyWorldCommit } from "./journeyRules.ts";
import {
  adjudicateJourneyTask,
  buildFallbackJourneyTaskPlan,
  deriveLegacyTerminalTierFromAdjudication,
  type JourneyFallbackRiskProfile,
  JOURNEY_TIER_REWARDS,
  journeyRewardBundleForPlan,
  nextJourneyTaskObjective,
  validateJourneyTaskProposal,
} from "./journeyGeneratedTaskRules.ts";
import {
  scrubJourneyForPublicView,
  scrubJourneyRecordForPublicView,
} from "./journeyReadModel.ts";
import { EPOCH_WORLD_CALENDAR_ORIGIN_YEAR, epochWorldCalendarMoment } from "./worldCalendar.ts";
import type { HiddenPrerequisiteLink } from "./journeyRoleplayRules.ts";

type UnknownRecord = Record<string, unknown>;

/**
 * PR4: re-attach the legacy tier / reward / rewardBundle to a public-facing
 * task adjudication projection. adjudicateJourneyTask itself no longer
 * derives these (spec: "adjudicateJourneyTask 不再算 tier"); the authority
 * tier for PR4 contract journeys lives on SettlementDecision.tier. The MCP
 * API contract still exposes `taskAdjudication.tier / reward / rewardBundle`
 * to clients, so this helper rebuilds them from the adjudication's physical
 * components via the legacy derivation. PR4-internal callers MUST read
 * SettlementDecision.tier directly and never touch this projection.
 */
function withLegacyTierProjection(
  taskPlan: Parameters<typeof journeyRewardBundleForPlan>[0],
  adjudication: ReturnType<typeof adjudicateJourneyTask>,
  revealHidden: boolean,
) {
  const tier = deriveLegacyTerminalTierFromAdjudication(adjudication, revealHidden);
  if (tier === "未及格") {
    return { ...adjudication, tier };
  }
  const reward = JOURNEY_TIER_REWARDS[tier];
  const rewardBundle = journeyRewardBundleForPlan(taskPlan, tier);
  return { ...adjudication, tier, reward, rewardBundle };
}

export interface AgentCompanionEpochSurface {
  readonly progress: (input?: UnknownRecord) => unknown;
  readonly verifyExplorerAuth: (input?: UnknownRecord) => unknown;
  readonly regionInfo: (input?: UnknownRecord) => unknown;
  readonly agentBriefing: (input?: UnknownRecord) => unknown;
  readonly publicIdentity?: (input?: UnknownRecord) => unknown;
  readonly events: (input?: UnknownRecord) => unknown;
  /** Returns the immutable result-page revision linked to a settled journey. */
  readonly getResultPage?: (input?: UnknownRecord) => unknown;
  /** Returns the unfiltered canonical suffix at this absolute offset; providers must never renumber it. */
  readonly interactionEvents?: (offset?: number) => readonly EpochEvent[];
  /**
   * PR5c additive. Returns the canonical world-object lifecycle states from the
   * epoch projection, keyed by objectId. Used to stamp canonicalStatusDigest on
   * available world objects and to gate hidden-prerequisite reachability.
   */
  readonly worldObjectStates?: () => unknown;
  /**
   * PR5c additive. Returns the canonical hidden-prerequisite link states from
   * the epoch projection, keyed by `${regionId}:${objectiveId}:${prerequisiteObjectId}`.
   * Used to pass into adjudicateJourneyTask so destroyed prerequisites gate
   * hidden tier reachability.
   */
  readonly hiddenPrerequisiteLinks?: () => unknown;
}

export interface AgentCompanionRuntimeOptions {
  readonly epoch: AgentCompanionEpochSurface;
  readonly journey?: JourneyRuntime;
  readonly journeyOptions?: JourneyRuntimeOptions;
  /**
   * PR3. Optional quest-offer runtime. When supplied, the companion can
   * resolve offer-driven prepare requests end-to-end (claim + resolve +
   * delegate to {@link JourneyRuntime.prepare}). When absent, offer-driven
   * prepare requests fail with `offer_runtime_unavailable`.
   */
  readonly offerRuntime?: JourneyOfferRuntime;
}

interface IdempotencyRecord {
  readonly subjectHash: string;
  readonly value: unknown;
}

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function phase6FallbackRiskProfile(value: unknown): JourneyFallbackRiskProfile | undefined {
  if (!isRecord(value)) return undefined;
  return value.intensity === "low" || value.intensity === "medium" || value.intensity === "high" || value.intensity === "dynamic"
    ? value.intensity
    : undefined;
}

function isEpochAgentIdentity(value: unknown): value is EpochAgentIdentity {
  if (!isRecord(value) || !isRecord(value.lifetime) || !isRecord(value.personality)) return false;
  return typeof value.agentId === "string"
    && typeof value.explorerId === "string"
    && typeof value.identityName === "string"
    && typeof value.generation === "number"
    && (value.status === "active" || value.status === "archived")
    && typeof value.lifetime.startedAt === "string";
}

function exactStringArray(value: unknown, expected: readonly string[]) {
  return Array.isArray(value)
    && value.length === expected.length
    && value.every((entry, index) => typeof entry === "string" && entry === expected[index]);
}

function filedStoryReportFromPage(value: unknown, journey: EpochJourney): GroundedJourneyStoryReport | undefined {
  if (!isRecord(value)
    || value.pageId !== journey.verification?.pageId
    || value.status === "deleted"
    || !isRecord(value.payload)
    || !isRecord(value.payload.journey)) return undefined;
  const filedJourney = value.payload.journey;
  if (filedJourney.journeyId !== journey.journeyId || !Array.isArray(filedJourney.episodes)) return undefined;
  const filedEpisodeIds = filedJourney.episodes.flatMap((episode) =>
    isRecord(episode) && typeof episode.episodeId === "string" ? [episode.episodeId] : []);
  if (!exactStringArray(filedEpisodeIds, journey.episodeIds) || !isRecord(filedJourney.storyReport)) return undefined;
  const report = filedJourney.storyReport;
  if (report.kind !== "grounded_story_report"
    || report.version !== 3
    || report.journeyId !== journey.journeyId
    || typeof report.storyId !== "string"
    || typeof report.title !== "string"
    || typeof report.summary !== "string"
    || typeof report.storyContent !== "string"
    || typeof report.narrative !== "string"
    || !isRecord(report.profile)
    || !isRecord(report.storyElements)
    || !isRecord(report.evaluation)
    || !isRecord(report.structure)
    || !isRecord(report.resolution)
    || !Array.isArray(report.chapters)
    || !Array.isArray(report.sourceEventIds)
    || !report.sourceEventIds.every((eventId) => typeof eventId === "string")
    || !exactStringArray(report.episodeIds, journey.episodeIds)) return undefined;
  return report as unknown as GroundedJourneyStoryReport;
}

function requiredString(value: unknown, field: string) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`journey_${field}_required`);
  return value.trim();
}

function optionalNumber(value: unknown) {
  return typeof value === "number" ? value : undefined;
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!isRecord(value)) return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
}

const IDEMPOTENCY_SECRET_FIELDS = new Set(["recoveryCode", "localSecret", "confirmationToken", "operatorKey"]);

function idempotencySafeValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(idempotencySafeValue);
  if (!isRecord(value)) return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !IDEMPOTENCY_SECRET_FIELDS.has(key))
    .map(([key, entry]) => [key, idempotencySafeValue(entry)]));
}

function stableSubjectHash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(stableValue(idempotencySafeValue(value)))).digest("hex");
}

function recordId(record: UnknownRecord, keys: readonly string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

function recordLabel(record: UnknownRecord, fallback: string, keys: readonly string[]) {
  return publicText(recordId(record, keys) ?? fallback);
}

function publicBriefingProjection(value: unknown) {
  const identity = isRecord(value) ? value : {};
  const canonicalAgentId = typeof identity.canonicalAgentId === "string" && identity.canonicalAgentId.trim()
    ? identity.canonicalAgentId.trim()
    : undefined;
  const identityExists = identity.identityExists === true && Boolean(canonicalAgentId);
  const identityLabel = identityExists && typeof identity.identityLabel === "string"
    ? publicText(identity.identityLabel)
    : "未签发身份";
  const regionLabel = typeof identity.regionLabel === "string" && identity.regionLabel.trim()
    ? publicText(identity.regionLabel)
    : "黑曜纪元";
  const pages = isRecord(identity.publicPages) ? identity.publicPages : {};
  const publicPages = Object.fromEntries([
    "world",
    "console",
    "agent",
    "archive",
  ].flatMap((key) => typeof pages[key] === "string" ? [[key, pages[key]]] : []));
  const regionalContext = publicRegionalContextProjection(identity.regionalContext);
  return {
    identityExists,
    ...(typeof identity.generatedAt === "string" ? { generatedAt: identity.generatedAt } : {}),
    ...(identityExists ? {
      agentId: canonicalAgentId,
      canonicalAgentId,
      publicIdentity: {
        label: identityLabel,
        ...(identity.identityStatus === "active" || identity.identityStatus === "archived"
          ? { status: identity.identityStatus }
          : {}),
      },
      regionLabel,
      agentSelfStatement: `我是${identityLabel}，在${regionLabel}留下可公开验证的经历。`,
      ...(regionalContext ? { regionalContext } : {}),
    } : {}),
    ...(Object.keys(publicPages).length ? { publicPages } : {}),
  };
}

function publicRegionalContextProjection(value: unknown) {
  if (!isRecord(value)) return undefined;
  const messages = Array.isArray(value.messages)
    ? value.messages.filter(isRecord).flatMap((message) =>
      typeof message.body === "string" && typeof message.postedAt === "string"
        ? [{ body: publicText(message.body), postedAt: message.postedAt }]
        : [])
    : [];
  const news = Array.isArray(value.news)
    ? value.news.filter(isRecord).flatMap((item) =>
      typeof item.headline === "string" && typeof item.body === "string" && typeof item.createdAt === "string"
        ? [{ headline: publicText(item.headline), body: publicText(item.body), createdAt: item.createdAt }]
        : [])
    : [];
  const commissions = Array.isArray(value.commissions)
    ? value.commissions.filter(isRecord).flatMap((commission) => {
      if (typeof commission.title !== "string" || typeof commission.summary !== "string"
        || typeof commission.secretExposureTier !== "string" || !isRecord(commission.secretRevealBudget)
        || typeof commission.actionLabel !== "string") return [];
      const chapterLocked = commission.secretRevealBudget.chapterLocked;
      const remaining = commission.secretRevealBudget.remaining;
      if (typeof chapterLocked !== "boolean" || typeof remaining !== "number") return [];
      return [{
        title: publicText(commission.title),
        summary: publicText(commission.summary),
        secretExposureTier: commission.secretExposureTier,
        secretRevealBudget: { chapterLocked, remaining },
        actionLabel: publicText(commission.actionLabel),
      }];
    })
    : [];
  return { messages, news, commissions };
}

function isPublicBriefingAuthBoundary(error: unknown) {
  return error instanceof Error && [
    "agent_identity_not_found",
    "agent_identity_archived",
    "explorer_auth_required",
  ].includes(error.message);
}

const WORLD_COLLECTIONS = [
  { key: "npcs", type: "npc", ids: ["npcId"], labels: ["displayName", "name", "identityName"] },
  { key: "activeAgents", type: "agent", ids: ["agentId"], labels: ["identityName", "name"] },
  { key: "commissions", type: "commission", ids: ["commissionId", "sourceId"], labels: ["title", "summary"] },
  { key: "objectives", type: "objective", ids: ["objectiveId"], labels: ["title", "summary"] },
  { key: "resourceNodes", type: "resource_node", ids: ["nodeId", "resourceNodeId"], labels: ["title", "resourceId"] },
  { key: "organizations", type: "organization", ids: ["organizationId"], labels: ["displayName", "name", "title"] },
  { key: "news", type: "world_event", ids: ["newsId", "eventId"], labels: ["headline", "summary"] },
] as const;

function worldObjects(regionInfo: UnknownRecord, regionId: string): readonly JourneyAvailableWorldObject[] {
  const objects: JourneyAvailableWorldObject[] = [...journeyWorldCatalogForRegion(regionId)];
  const knownIds = new Set(objects.map((object) => object.id));
  const canonicalContent = isRecord(regionInfo.canonicalContent) ? regionInfo.canonicalContent : {};
  const canonicalFactions = Array.isArray(canonicalContent.factions) ? canonicalContent.factions : [];
  for (const value of canonicalFactions) {
    if (!isRecord(value) || typeof value.id !== "string" || typeof value.label !== "string"
      || knownIds.has(value.id)) continue;
    knownIds.add(value.id);
    objects.push({
      id: value.id,
      type: "faction",
      label: value.label,
      regionId,
      sourceFactIds: [typeof value.contentHash === "string"
        ? `world:content:${value.contentHash}`
        : `world:faction:${value.id}`],
      tags: ["faction", "canonical_jurisdiction"],
    });
  }
  for (const collection of WORLD_COLLECTIONS) {
    const values = regionInfo[collection.key];
    if (!Array.isArray(values)) continue;
    for (const value of values) {
      if (!isRecord(value)) continue;
      const id = recordId(value, collection.ids);
      if (!id || knownIds.has(id)) continue;
      knownIds.add(id);
      objects.push({
        id,
        type: collection.type,
        label: recordLabel(value, id, collection.labels),
        regionId,
        sourceFactIds: [`readmodel:${collection.type}:${id}`],
        participantIds: collection.type === "npc" || collection.type === "agent" ? [id] : [],
        tags: [collection.type],
      });
    }
  }
  return objects;
}

export class AgentCompanionRuntime {
  readonly #epoch: AgentCompanionEpochSurface;
  readonly #journey: JourneyRuntime;
  readonly #offer: JourneyOfferRuntime | undefined;
  readonly #idempotency = new Map<string, IdempotencyRecord>();
  readonly #interactionProjection = createDurableAgentInteractionProjection();
  #epochInteractionOffset = 0;
  #journeyInteractionOffset = 0;

  constructor(options: AgentCompanionRuntimeOptions) {
    this.#epoch = options.epoch;
    if (!options.journey && !options.journeyOptions) throw new Error("journey_runtime_options_required");
    this.#journey = options.journey ?? createJourneyRuntime(options.journeyOptions as JourneyRuntimeOptions);
    this.#offer = options.offerRuntime;
    this.#hydrateIdempotency();
    this.#refreshInteractionProjection();
  }

  journeyRuntime() {
    return this.#journey;
  }

  prepare(input: UnknownRecord = {}) {
    const agentId = requiredString(input.agentId, "agent_id");
    const { explorerId } = this.#authorizeAgent(input, agentId);
    return this.#idempotently("prepare", explorerId, input, () => {
      // PR3: offer-driven mode requires a pre-resolved InternalQuestOffer.
      // The HTTP layer (or prepareWithOffer below) runs claim+getInternalOffer
      // upstream and passes the result in. The companion runtime never
      // performs offer IO itself; the inner JourneyRuntime.prepare is sync.
      const questOfferId = typeof input.questOfferId === "string" && input.questOfferId.trim()
        ? input.questOfferId.trim()
        : undefined;
      const questOffer = input.questOffer as InternalQuestOffer | undefined;
      if (questOfferId !== undefined && questOffer === undefined) {
        throw new Error("journey_offer_resolution_required");
      }
      if (questOffer !== undefined && questOfferId !== undefined && questOffer.questOfferId !== questOfferId) {
        throw new Error("offer_id_mismatch");
      }
      // PR3 (Fix 3): when the client omits destinationRegionId in offer-driven
      // mode, derive it from the resolved offer's region. The schema permits
      // omission for offer-driven journeys; the runtime would otherwise throw
      // destination_region_id. Falls back to the canonical default otherwise.
      const offerRegionId = questOffer?.publicView.region.regionId;
      const destinationRegionId = resolveEpochCanonicalRegionId(
        typeof (input.destinationRegionId ?? input.regionId) === "string" && String(input.destinationRegionId ?? input.regionId).trim()
          ? String(input.destinationRegionId ?? input.regionId).trim()
          : offerRegionId ?? "region_gray_harbor",
      );
      const originRegionId = typeof input.originRegionId === "string" && input.originRegionId.trim()
        ? resolveEpochCanonicalRegionId(input.originRegionId.trim())
        : destinationRegionId;
      // PR3: when the client omits taskType in offer-driven mode, derive it
      // from the offer's publicView.taskTypeText. The offer is authoritative
      // for taskType per the prepare_journey schema contract; this avoids
      // the offer_task_type_mismatch path when both inputs are absent.
      const offerTaskType = questOffer?.publicView.taskTypeText;
      const taskType = typeof input.taskType === "string" && input.taskType.trim()
        ? input.taskType.trim()
        : offerRegionId !== undefined
          ? offerTaskType
          : undefined;
      const prepared = this.#journey.prepare({
        agentId,
        explorerId,
        originRegionId,
        destinationRegionId,
        taskType,
        mandate: input.mandate,
        policy: input.policy ?? { presetId: input.presetId ?? "cautious" },
        expectedReturn: input.expectedReturn as string | undefined,
        ...(questOfferId !== undefined ? { questOfferId } : {}),
        ...(questOffer !== undefined ? { questOffer } : {}),
        ...(typeof input.offerHash === "string" ? { offerHash: input.offerHash as `sha256:${string}` } : {}),
        ...(input.marketSnapshotVersion !== undefined
          ? { marketSnapshotVersion: Number(input.marketSnapshotVersion) }
          : {}),
      });
      // PR3: zero-bonus boundary — strip internal source-binding fields
      // (questOfferId/offerHash/marketSnapshotVersion/taskFamilyId/
      // expectedApproach) before crossing into the untrusted response.
      return { ...scrubJourneyRecordForPublicView(prepared), mission: this.#missionForJourney(prepared.journey) };
    });
  }

  /**
   * PR3. Async offer-driven prepare: claim the offer against the supplied
   * reservation, resolve the {@link InternalQuestOffer} server-side, then
   * delegate to the sync {@link prepare} with the resolved offer in input.
   *
   * The claim is idempotent on `(questOfferId, idempotencyKey)`, so a
   * network-retry of the whole prepare request hits the offer claim's
   * idempotency cache and re-returns the same claim — no double-claim. The
   * subsequent `prepare` is itself wrapped in the journey prepare idempotency
   * cache, so the journey-side response is also stable across retries.
   *
   * Throws `offer_runtime_unavailable` if no {@link JourneyOfferRuntime} is
   * wired. Throws `offer_hash_mismatch` if `offerHash` is supplied and does
   * not match the resolved internal offer.
   *
   * PR3 (audit round 2): prepare-failure rollback. Spec §4.2 only mandates
   * "replenish failure must NOT roll back claim"; prepare-failure rollback
   * is unspecified and the prior implementation chose leak-over-rollback.
   * This implementation rolls back a FRESH claim on any downstream throw
   * (offer_hash_mismatch, offer_region_mismatch, idempotency_key_conflict,
   * offer_resolution_failed, journey prepare errors, ...). Heuristic:
   *
   *   - Snapshot `lifecycle.status === "claimed"` BEFORE claiming.
   *   - Track whether `claimQuestOffer` itself threw in this call.
   *   - On any downstream throw, IF claim succeeded AND the lifecycle was
   *     NOT already `claimed` when this call started, best-effort release
   *     the offer (transition `claimed` -> `released`) and surface the
   *     original error.
   *
   * We do NOT roll back idempotent-replay claims: a claim that already
   * existed when this call started may belong to a prior successful
   * prepare that the caller is retrying past a transient network glitch,
   * and releasing it would orphan that prior journey. The check is
   * prior-state based; concurrent same-key retries with divergent inputs
   * remain a theoretical race — legitimate retries use identical inputs
   * and are handled correctly.
   *
   * Retry contract after a rolled-back failure: the offer is `released`
   * (terminal-bypass), so the SAME `questOfferId` cannot be reclaimed.
   * The client must reserve a fresh offer and retry with the new id
   * (`idempotencyKey` can be reused — it is scoped per questOfferId).
   */
  async prepareWithOffer(input: UnknownRecord = {}): Promise<ReturnType<AgentCompanionRuntime["prepare"]>> {
    if (this.#offer === undefined) throw new Error("offer_runtime_unavailable");
    const agentId = requiredString(input.agentId, "agent_id");
    const { explorerId } = this.#authorizeAgent(input, agentId);
    const questOfferId = requiredString(input.questOfferId, "quest_offer_id");
    const reservationToken = requiredString(input.reservationToken, "reservation_token");
    const idempotencyKey = requiredString(input.idempotencyKey, "idempotency_key");
    if (input.marketSnapshotVersion === undefined || input.marketSnapshotVersion === null) {
      throw new Error("market_snapshot_version_required");
    }
    const marketSnapshotVersion = Number(input.marketSnapshotVersion);
    if (!Number.isFinite(marketSnapshotVersion)) {
      throw new Error("market_snapshot_version_required");
    }
    // PR3 (audit round 2): snapshot prior lifecycle state so the catch
    // block can tell a FRESH claim (rollback eligible) from an idempotent
    // replay (must NOT roll back — would orphan a prior successful prepare
    // the caller is retrying past).
    const offerStore = this.#offer.getStore();
    const lifecycleBefore = offerStore.projection.lifecyclesById[questOfferId];
    const wasAlreadyClaimed = lifecycleBefore?.status === "claimed";
    let claimSucceededInThisCall = false;
    try {
      // Claim is idempotent on (questOfferId, idempotencyKey); replays return
      // the same claimId without re-advancing the lifecycle.
      await this.#offer.claimQuestOffer({
        questOfferId,
        reservationToken,
        explorerId,
        agentId,
        idempotencyKey,
        marketSnapshotVersion,
      });
      claimSucceededInThisCall = true;
      const internal = this.#offer.getInternalOffer(questOfferId);
      if (internal === undefined) {
        throw new Error("offer_resolution_failed");
      }
      if (typeof input.offerHash === "string" && internal.offerHash !== input.offerHash) {
        throw new Error("offer_hash_mismatch");
      }
      // Hand the resolved offer to the sync prepare path. Strip the raw offer
      // IO fields from the idempotency subject so the cache key is stable
      // across retries (the claim is already idempotent on its own key).
      const { reservationToken: _stripToken, questOffer: _stripPrior, ...rest } = input;
      void _stripToken;
      void _stripPrior;
      return this.prepare({ ...rest, questOffer: internal });
    } catch (error) {
      // Roll back a FRESH claim if anything downstream threw. Without this,
      // any prepare-side error leaks the offer as `claimed` with no
      // automatic cleanup — the client would have to explicitly invoke
      // releaseOrExpireQuestOffer. Best-effort: release errors are
      // swallowed so the original prepare-side error surfaces.
      if (claimSucceededInThisCall && !wasAlreadyClaimed) {
        try {
          await this.#offer.releaseOrExpireQuestOffer({
            questOfferId,
            reason: "released",
          });
        } catch {
          // Swallow — the original error is the actionable one.
        }
      }
      throw error;
    }
  }

  start(input: UnknownRecord = {}) {
    const journeyId = requiredString(input.journeyId, "id");
    const current = this.#journey.status(journeyId);
    this.#authorizeExplorer(input, current.journey.explorerId);
    return this.#idempotently("start", current.journey.explorerId, input, () => {
      let ready = this.#journey.status(journeyId);
      const generatedPlanRequested = input.taskProposal !== undefined
        || input.taskGenerationMode === "model_sampling"
        || input.taskGenerationMode === "server_fallback"
        || ready.journey.taskRequest?.generationRequested === true;
      if (!ready.journey.taskPlan && generatedPlanRequested) {
        const generation = this.#taskGenerationContext(ready.journey);
        const taskPlanInstallation = input.taskProposal === undefined
          ? buildFallbackJourneyTaskPlan({
              taskType: generation.taskType,
              scenarioMapId: generation.scenarioMapId,
              availableWorldObjects: generation.availableWorldObjects,
              riskProfile: phase6FallbackRiskProfile(input.phase6Scenario),
            })
          : validateJourneyTaskProposal({
              proposal: input.taskProposal,
              taskType: generation.taskType,
              scenarioMapId: generation.scenarioMapId,
              availableWorldObjects: generation.availableWorldObjects,
              source: "model_sampling",
            });
        ready = this.#journey.installTaskPlan({
          journeyId,
          expectedVersion: ready.journey.version,
          taskPlan: taskPlanInstallation.plan,
          hiddenTaskSeal: taskPlanInstallation.hiddenTaskSeal,
        });
      }
      const started = this.#journey.start({
        journeyId,
        expectedVersion: ready.journey.version,
        realDurationMs: optionalNumber(input.realDurationMs),
        worldDurationMs: optionalNumber(input.worldDurationMs),
      });
      const scenePlan = this.#composeThreePhasePlan(started.journey);
      const record = this.#journey.status(journeyId);
      return {
        ...scrubJourneyRecordForPublicView(record),
        mission: this.#missionForJourney(record.journey),
        scenePlan,
        nextPollAt: record.journey.nextPollAt,
      };
    });
  }

  reserveJourneyWorldWindow(input: UnknownRecord = {}) {
    const journeyId = requiredString(input.journeyId, "id");
    const current = this.#journey.status(journeyId);
    this.#authorizeExplorer(input, current.journey.explorerId);
    return this.#idempotently("reserve-world-window", current.journey.explorerId, input, () => {
      const reserved = this.#journey.reserveMirrorWindow({
        journeyId,
        expectedVersion: Number(input.expectedVersion),
      });
      return { ...scrubJourneyRecordForPublicView(reserved), mission: this.#missionForJourney(reserved.journey) };
    });
  }

  taskGenerationContext(input: UnknownRecord = {}) {
    const journeyId = requiredString(input.journeyId, "id");
    const current = this.#journey.status(journeyId);
    this.#authorizeExplorer(input, current.journey.explorerId);
    if (current.journey.status === "prepared" && current.journey.version !== Number(input.expectedVersion)) {
      throw new Error("journey_version_conflict");
    }
    return this.#taskGenerationContext(current.journey);
  }

  proposeStep(input: UnknownRecord = {}) {
    const journeyId = requiredString(input.journeyId, "id");
    const current = this.#journey.status(journeyId);
    this.#authorizeExplorer(input, current.journey.explorerId);
    if (input.expectedVersion !== undefined && current.journey.version !== Number(input.expectedVersion)) throw new Error("journey_version_conflict");
    if (!["traveling", "awaiting_agent", "returning"].includes(current.journey.status)) {
      throw new Error("journey_step_not_proposable");
    }
    const scenePlan = this.#composeThreePhasePlan(current.journey);
    const recordedEpisodes = current.journey.episodeIds
      .map((episodeId) => this.#journey.projection().episodes[episodeId])
      .filter(Boolean);
    const episode = current.journey.taskPlan
      ? current.journey.status === "returning"
        ? scenePlan.episodes.find((candidate) => candidate.phase === "return")
        : recordedEpisodes.length === 0
          ? scenePlan.episodes.find((candidate) => candidate.phase === "arrival")
          : (() => {
              const objective = nextJourneyTaskObjective(current.journey.taskPlan as NonNullable<EpochJourney["taskPlan"]>, recordedEpisodes);
              return objective
                ? scenePlan.episodes.find((candidate) =>
                    candidate.generatedTaskObjective?.objectiveId === objective.objectiveId)
                : undefined;
            })()
      : scenePlan.episodes[current.journey.episodeIds.length];
    if (!episode) throw new Error("journey_steps_complete");
    return {
      ...scrubJourneyRecordForPublicView(current),
      mission: this.#missionForJourney(current.journey),
      episode,
      scenePlan,
      stepNumber: current.journey.episodeIds.length + 1,
      totalSteps: scenePlan.episodes.length,
    };
  }

  commitEpisodes(input: UnknownRecord = {}) {
    const journeyId = requiredString(input.journeyId, "id");
    const current = this.#journey.status(journeyId);
    this.#authorizeExplorer(input, current.journey.explorerId);
    if (!Array.isArray(input.episodes) || input.episodes.length < 1 || input.episodes.length > 3) {
      throw new Error("journey_committed_episodes_invalid");
    }
    return this.#idempotently("commit_episodes", current.journey.explorerId, input, () => {
      const committed = this.#journey.commitEpisodes(
        journeyId,
        Number(input.expectedVersion),
        input.episodes as readonly JourneySceneEpisode[],
      );
      return { ...scrubJourneyRecordForPublicView(committed), mission: this.#missionForJourney(committed.journey) };
    });
  }

  awaitAgent(input: UnknownRecord = {}) {
    const journeyId = requiredString(input.journeyId, "id");
    const current = this.#journey.status(journeyId);
    this.#authorizeExplorer(input, current.journey.explorerId);
    return this.#idempotently("await_agent", current.journey.explorerId, input, () => {
      const awaiting = this.#journey.awaitAgent(journeyId, Number(input.expectedVersion));
      return { ...scrubJourneyRecordForPublicView(awaiting), mission: this.#missionForJourney(awaiting.journey) };
    });
  }

  beginReturn(input: UnknownRecord = {}) {
    const journeyId = requiredString(input.journeyId, "id");
    const current = this.#journey.status(journeyId);
    this.#authorizeExplorer(input, current.journey.explorerId);
    return this.#idempotently("begin_return", current.journey.explorerId, input, () => {
      const returning = this.#journey.beginReturn(journeyId, Number(input.expectedVersion));
      return { ...scrubJourneyRecordForPublicView(returning), mission: this.#missionForJourney(returning.journey) };
    });
  }

  settleCompleted(input: UnknownRecord = {}) {
    const journeyId = requiredString(input.journeyId, "id");
    const current = this.#journey.status(journeyId);
    this.#authorizeExplorer(input, current.journey.explorerId);
    return this.#idempotently("settle_completed", current.journey.explorerId, input, () => {
      const settled = this.#journey.settleCompleted(journeyId, Number(input.expectedVersion));
      return { ...scrubJourneyRecordForPublicView(settled), mission: this.#missionForJourney(settled.journey) };
    });
  }

  recordWorldCommit(input: UnknownRecord = {}) {
    const journeyId = requiredString(input.journeyId, "id");
    const current = this.#journey.status(journeyId);
    this.#authorizeExplorer(input, current.journey.explorerId);
    if (!input.worldCommit || typeof input.worldCommit !== "object" || Array.isArray(input.worldCommit)) {
      throw new Error("journey_world_commit_required");
    }
    return this.#idempotently("record_world_commit", current.journey.explorerId, input, () => {
      const recorded = this.#journey.recordWorldCommit({
        journeyId,
        expectedVersion: Number(input.expectedVersion),
        worldCommit: input.worldCommit as JourneyWorldCommit,
      });
      return { ...scrubJourneyRecordForPublicView(recorded), mission: this.#missionForJourney(recorded.journey) };
    });
  }

  status(input: UnknownRecord = {}) {
    return this.#captureEvents(() => {
      this.#journey.catchUp();
      const record = this.#journey.status(requiredString(input.journeyId, "id"));
      this.#authorizeExplorer(input, record.journey.explorerId);
      const projection = this.#journey.projection();
      const episodes = record.journey.episodeIds.map((episodeId) => projection.episodes[episodeId]).filter(Boolean);
      const hiddenTaskSeal = record.journey.taskPlan
        ? this.#journey.hiddenTaskSealForJourney(record.journey.journeyId, record.journey.taskPlan)
        : undefined;
      const identity = this.#identityForJourney(record.journey);
      const mission = buildJourneyMission({
        journeyId: record.journey.journeyId,
        journeyStatus: record.journey.status,
        playerObjective: record.journey.mandate.objective,
        regionId: record.journey.destinationRegionId,
        episodes,
        taskPlan: record.journey.taskPlan,
        hiddenTaskSeal,
      });
      const storyReport = this.#filedStoryReport(record.journey) ?? buildGroundedJourneyStoryReport({
        journeyId: record.journey.journeyId,
        status: record.journey.status,
        objective: record.journey.mandate.objective,
        regionId: record.journey.destinationRegionId,
        startedAtWorldTime: record.journey.startedAtWorldTime,
        dueAtWorldTime: record.journey.dueAtWorldTime,
        worldCommit: record.journey.worldCommit,
        episodes,
        taskPlan: record.journey.taskPlan,
        hiddenTaskSeal,
        identity,
      });
      const interactionLog = buildJourneyInteractionLog({
        journeyId: record.journey.journeyId,
        episodes,
      });
      const taskAdjudication = record.journey.taskPlan
        ? withLegacyTierProjection(
            record.journey.taskPlan,
            adjudicateJourneyTask({
              plan: record.journey.taskPlan,
              episodes,
              hiddenTaskSeal,
              revealHidden: ["settled", "cancelled", "identity_ended"].includes(record.journey.status),
              hiddenPrerequisiteLinks: this.#hiddenPrerequisiteLinksForPlan(record.journey.taskPlan),
            }),
            ["settled", "cancelled", "identity_ended"].includes(record.journey.status),
          )
        : undefined;
      return {
        ...scrubJourneyRecordForPublicView(record),
        episodes,
        mission,
        ...(taskAdjudication ? { taskAdjudication } : {}),
        interactionLog,
        ...(storyReport ? { storyReport } : {}),
        nextPollAt: record.journey.nextPollAt,
      };
    });
  }

  stepStatus(input: UnknownRecord = {}) {
    const record = this.#journey.status(requiredString(input.journeyId, "id"));
    this.#authorizeExplorer(input, record.journey.explorerId);
    const projection = this.#journey.projection();
    const episodes = record.journey.episodeIds
      .map((episodeId) => projection.episodes[episodeId])
      .filter(Boolean);
    const hiddenTaskSeal = record.journey.taskPlan
      ? this.#journey.hiddenTaskSealForJourney(record.journey.journeyId, record.journey.taskPlan)
      : undefined;
    return {
      ...scrubJourneyRecordForPublicView(record),
      episodes,
      mission: this.#missionForJourney(record.journey),
      interactionLog: buildJourneyInteractionLog({
        journeyId: record.journey.journeyId,
        episodes,
      }),
      ...(record.journey.taskPlan ? {
        taskAdjudication: withLegacyTierProjection(
          record.journey.taskPlan,
          adjudicateJourneyTask({
            plan: record.journey.taskPlan,
            episodes,
            hiddenTaskSeal,
            revealHidden: ["settled", "cancelled", "identity_ended"].includes(record.journey.status),
            hiddenPrerequisiteLinks: this.#hiddenPrerequisiteLinksForPlan(record.journey.taskPlan),
          }),
          ["settled", "cancelled", "identity_ended"].includes(record.journey.status),
        ),
      } : {}),
      nextPollAt: record.journey.nextPollAt,
    };
  }

  recall(input: UnknownRecord = {}) {
    const record = this.#journey.status(requiredString(input.journeyId, "id"));
    this.#authorizeExplorer(input, record.journey.explorerId);
    return this.#idempotently("recall", record.journey.explorerId, input, () => {
      const recalled = this.#journey.recall(record.journey.journeyId, Number(input.expectedVersion));
      return { ...scrubJourneyRecordForPublicView(recalled), mission: this.#missionForJourney(recalled.journey) };
    });
  }

  linkVerification(input: UnknownRecord = {}) {
    const record = this.#journey.status(requiredString(input.journeyId, "id"));
    this.#authorizeExplorer(input, record.journey.explorerId);
    return this.#idempotently("link_verification", record.journey.explorerId, input, () => {
      return this.#journey.linkVerification({
        journeyId: record.journey.journeyId,
        expectedVersion: Number(input.expectedVersion),
        pageId: requiredString(input.pageId, "verification_page_id"),
        urlPath: requiredString(input.urlPath, "verification_url"),
        createdAt: requiredString(input.createdAt, "verification_created_at"),
      });
    });
  }

  album(input: UnknownRecord = {}) {
    const agentId = requiredString(input.agentId, "agent_id");
    const { explorerId, identity, progress } = this.#authorizeOwnedAgent(input, agentId);
    const projection = this.#journey.projection();
    const album = buildJourneyAlbum(projection, agentId, {
      storyReportForJourney: (journey) => {
        const filed = this.#filedStoryReport(journey);
        if (filed) return filed;
        const episodes = journey.episodeIds
          .map((episodeId) => projection.episodes[episodeId])
          .filter(Boolean);
        const hiddenTaskSeal = journey.taskPlan
          ? this.#journey.hiddenTaskSealForJourney(journey.journeyId, journey.taskPlan)
          : undefined;
        return buildGroundedJourneyStoryReport({
          journeyId: journey.journeyId,
          status: journey.status,
          objective: journey.mandate.objective,
          regionId: journey.destinationRegionId,
          startedAtWorldTime: journey.startedAtWorldTime,
          dueAtWorldTime: journey.dueAtWorldTime,
          worldCommit: journey.worldCommit,
          episodes,
          taskPlan: journey.taskPlan,
          hiddenTaskSeal,
          identity: this.#identityForJourney(journey),
        });
      },
    });
    const nowWorld = this.#journey.nowWorld();
    const nowYear = epochWorldCalendarMoment(nowWorld)?.year;
    if (nowYear === undefined) throw new Error("world_time_invalid");
    const requestedYear = Number.isSafeInteger(Number(input.year))
      ? Number(input.year)
      : Math.max(EPOCH_WORLD_CALENDAR_ORIGIN_YEAR, nowYear - 1);
    const lifetime = isRecord(identity.lifetime) ? identity.lifetime : {};
    const identityStartedAt = typeof lifetime.startedAt === "string" ? lifetime.startedAt : nowWorld;
    const identityName = typeof identity.identityName === "string" ? identity.identityName : agentId;
    const lineageIdentities = Array.isArray(progress.identities)
      ? progress.identities.filter(isEpochAgentIdentity)
      : [];
    if (isEpochAgentIdentity(identity) && !lineageIdentities.some((candidate) => candidate.agentId === identity.agentId)) {
      lineageIdentities.push(identity);
    }
    const lifecycleEventsByAgent = Object.fromEntries(lineageIdentities.map((lineageIdentity) => {
      const lineageAgentId = lineageIdentity.agentId;
      const value = this.#epoch.events({ agentId: lineageAgentId, limit: 100 });
      const eventView = isRecord(value) ? value : {};
      const events = Array.isArray(eventView.events)
        ? eventView.events.filter(isRecord).flatMap((event): LineageChronicleEventRef[] => {
            const eventId = typeof event.eventId === "string" ? event.eventId : undefined;
            const eventType = typeof event.eventType === "string" ? event.eventType : undefined;
            const createdAt = typeof event.createdAt === "string" ? event.createdAt : undefined;
            return eventId && eventType && createdAt
              && ["identity_issued", "identity_archived", "reincarnation_issued"].includes(eventType)
              ? [{ eventId, eventType, createdAt }]
              : [];
          })
        : [];
      return [lineageAgentId, events];
    }));
    return {
      ...album,
      currentYear: nowYear,
      monthlyReports: monthlyLifeReports({ agentId, year: requestedYear, projection }),
      annualChronicle: buildAnnualLifeChronicle({
        agentId,
        identityName,
        identityStartedAtWorldTime: identityStartedAt,
        year: requestedYear,
        nowWorld,
        projection,
      }),
      lineageChronicle: buildLineageChronicle({
        explorerId,
        identities: lineageIdentities,
        projection,
        lifecycleEventsByAgent,
      }),
    };
  }

  briefing(input: UnknownRecord = {}) {
    return this.#captureEvents(() => {
      const agentId = requiredString(input.agentId, "agent_id");
      const publicBriefing = () => ({
          ...publicBriefingProjection(this.#epoch.publicIdentity?.({ agentId })),
          returnedJourneys: [],
          returnedJourneyReports: [],
          recentEpisodes: [],
          pendingDecisions: [],
          interactionInbox: [],
          interactionInboxSummaries: [],
          interactionInboxTotal: 0,
          agentWishes: [],
        });
      const hasOwnerCredential = typeof input.recoveryCode === "string" || typeof input.localSecret === "string";
      const playerRequest = currentMcpRequestAuthContext()?.kind === "player";
      if (!hasOwnerCredential && !playerRequest) return publicBriefing();
      let explorerId: string;
      try {
        explorerId = this.#authorizeAgent(input, agentId).explorerId;
      } catch (error) {
        if (!hasOwnerCredential && playerRequest && isPublicBriefingAuthBoundary(error)) return publicBriefing();
        throw error;
      }
      const baseBriefing = this.#epoch.agentBriefing(input);
      this.#journey.catchUp();
      const acknowledged = Array.isArray(input.acknowledgeReturnedJourneyIds)
        ? input.acknowledgeReturnedJourneyIds.filter((value): value is string => typeof value === "string" && Boolean(value.trim()))
        : [];
      if (acknowledged.length) this.#journey.deliverReturnedJourneys(explorerId, acknowledged);
      const returned = input.deferReturnDelivery === true
        ? this.#journey.pendingReturnedJourneys(explorerId)
        : this.#journey.claimReturnedJourneys(explorerId);
      const current = this.#journey.activeForAgent(agentId);
      const ownerForAgent = (targetAgentId: string) => {
        const value = this.#epoch.progress({ agentId: targetAgentId });
        const targetProgress = isRecord(value) ? value : {};
        const targetIdentity = isRecord(targetProgress.identity) ? targetProgress.identity : undefined;
        return targetIdentity && typeof targetIdentity.explorerId === "string" ? targetIdentity.explorerId : undefined;
      };
      const journeyProjection = this.#refreshInteractionProjection();
      const inbox = this.#interactionProjection.inbox({
        agentId,
        explorerId,
        nowWorld: this.#journey.nowWorld(),
        currentJourney: current?.journey,
        ownerForAgent,
      });
      const recentJourneyIds = new Set([
        ...(current ? [current.journey.journeyId] : []),
        ...returned.map((record) => record.journey.journeyId),
      ]);
      const recentEpisodeIds = new Set([...recentJourneyIds].flatMap((journeyId) =>
        journeyProjection.journeys[journeyId]?.journey.episodeIds || []));
      const returnedJourneyReports = returned.flatMap((record) => {
        const episodes = record.journey.episodeIds
          .map((episodeId) => journeyProjection.episodes[episodeId])
          .filter(Boolean);
        const storyReport = this.#filedStoryReport(record.journey) ?? buildGroundedJourneyStoryReport({
          journeyId: record.journey.journeyId,
          status: record.journey.status,
          objective: record.journey.mandate.objective,
          regionId: record.journey.destinationRegionId,
          startedAtWorldTime: record.journey.startedAtWorldTime,
          dueAtWorldTime: record.journey.dueAtWorldTime,
          worldCommit: record.journey.worldCommit,
          episodes,
          taskPlan: record.journey.taskPlan,
          hiddenTaskSeal: record.journey.taskPlan
            ? this.#journey.hiddenTaskSealForJourney(record.journey.journeyId, record.journey.taskPlan)
            : undefined,
          identity: this.#identityForJourney(record.journey),
        });
        return storyReport ? [{
          journeyId: record.journey.journeyId,
          storyReport,
          interactionLog: buildJourneyInteractionLog({
            journeyId: record.journey.journeyId,
            episodes,
          }),
        }] : [];
      });
      return {
        ...(isRecord(baseBriefing) ? baseBriefing : {}),
        identityExists: true,
        canonicalAgentId: agentId,
        currentJourney: current?.journey,
        returnedJourneys: returned.map((record) => record.journey),
        returnedJourneyReports,
        recentEpisodes: Object.values(journeyProjection.episodes)
          .filter((episode) => recentEpisodeIds.has(episode.episodeId)),
        pendingDecisions: [],
        interactionInbox: inbox.items,
        interactionInboxFeatured: inbox.featured,
        interactionInboxSummaries: inbox.summaries,
        interactionInboxTotal: inbox.total,
        agentWishes: [],
        nextPollAt: current?.journey.nextPollAt,
      };
    });
  }

  #refreshInteractionProjection() {
    const epochEventOffset = this.#epochInteractionOffset;
    const epochEvents = this.#epoch.interactionEvents?.(epochEventOffset) ?? [];
    this.#epochInteractionOffset += epochEvents.length;
    const journeyProjection = this.#journey.projection();
    const changedJourneyEvents = journeyProjection.events.slice(this.#journeyInteractionOffset);
    this.#journeyInteractionOffset += changedJourneyEvents.length;
    this.#interactionProjection.update({
      epochEvents,
      epochEventOffset,
      journeyProjection,
      changedJourneyIds: changedJourneyEvents.map((event) => event.journeyId),
    });
    return journeyProjection;
  }

  #filedStoryReport(journey: EpochJourney) {
    if (!journey.verification || !this.#epoch.getResultPage) return undefined;
    const report = filedStoryReportFromPage(
      this.#epoch.getResultPage({ pageId: journey.verification.pageId }),
      journey,
    );
    return report?.evaluation.warning === "该身份将无法保留" ? undefined : report;
  }

  #identityForJourney(journey: EpochJourney) {
    const value = this.#epoch.progress({ agentId: journey.agentId });
    const progress = isRecord(value) ? value : {};
    return isEpochAgentIdentity(progress.identity) ? progress.identity : undefined;
  }

  #authorizeAgent(input: UnknownRecord, agentId: string) {
    const result = this.#authorizeOwnedAgent(input, agentId);
    if (!isRecord(result.identity) || result.identity.status !== "active") throw new Error("agent_identity_archived");
    return result;
  }

  #authorizeOwnedAgent(input: UnknownRecord, agentId: string) {
    const progressValue = this.#epoch.progress({ agentId });
    const progress = isRecord(progressValue) ? progressValue : {};
    const identity = isRecord(progress.identity) ? progress.identity : undefined;
    const explorerId = identity && typeof identity.explorerId === "string" ? identity.explorerId : undefined;
    if (!identity || !explorerId) throw new Error("agent_identity_not_found");
    this.#authorizeExplorer(input, explorerId);
    return { explorerId, identity, progress };
  }

  #composeThreePhasePlan(journey: EpochJourney) {
    const canonicalRegionId = resolveEpochCanonicalRegionId(journey.destinationRegionId);
    const regionInfoValue = this.#epoch.regionInfo({
      regionId: canonicalRegionId,
      agentId: journey.agentId,
    });
    const regionInfo = isRecord(regionInfoValue) ? regionInfoValue : {};
    const progressValue = this.#epoch.progress({ agentId: journey.agentId });
    const progress = isRecord(progressValue) ? progressValue : {};
    const resources = isRecord(progress.resources)
      ? Object.fromEntries(Object.entries(progress.resources)
          .filter((entry): entry is [string, number] => typeof entry[1] === "number"))
      : {};
    const recentEpisodeFingerprints = Object.values(this.#journey.projection().episodes)
      .filter((episode) => !episode.episodeId.startsWith(`${journey.journeyId}:`))
      .slice(-2)
      .map((episode) => episode.fingerprint) as readonly JourneyEpisodeFingerprint[];
    return this.#journey.composeThreePhaseEpisodes(journey.journeyId, journey.version, {
      identityHistory: { recentEpisodeFingerprints },
      region: {
        id: canonicalRegionId,
        type: "region",
        label: publicRegionLabel(canonicalRegionId),
        sourceFactIds: [`world:region:${canonicalRegionId}`],
      },
      season: "current",
      resources,
      unresolvedClues: [],
      availableWorldObjects: journey.taskPlan
        ? this.#taskGenerationContext(journey).availableWorldObjects
        : worldObjects(regionInfo, canonicalRegionId),
      episodeCount: journey.taskPlan ? journey.taskPlan.objectives.length + 2 : 3,
    });
  }

  #taskGenerationContext(journey: EpochJourney) {
    const canonicalRegionId = resolveEpochCanonicalRegionId(journey.destinationRegionId);
    const regionInfoValue = this.#epoch.regionInfo({
      regionId: canonicalRegionId,
      agentId: journey.agentId,
    });
    const regionInfo = isRecord(regionInfoValue) ? regionInfoValue : {};
    const progressValue = this.#epoch.progress({ agentId: journey.agentId });
    const progress = isRecord(progressValue) ? progressValue : {};
    const identity = isRecord(progress.identity) ? progress.identity : {};
    const identityName = typeof identity.identityName === "string" && identity.identityName.trim()
      ? identity.identityName.trim()
      : journey.agentId;
    const personality = isRecord(identity.personality) ? identity.personality : {};
    const identityTraits = Array.isArray(personality.traits)
      ? personality.traits.filter((trait): trait is string => typeof trait === "string" && Boolean(trait.trim()))
      : [];
    const identityNeeds = isRecord(identity.needs) ? identity.needs : undefined;
    const lifeGoal = isRecord(identity.lifeGoal) ? identity.lifeGoal : undefined;
    const resources = isRecord(progress.resources)
      ? Object.fromEntries(Object.entries(progress.resources)
          .filter((entry): entry is [string, number] => typeof entry[1] === "number" && Number.isFinite(entry[1])))
      : {};
    const attributes = isRecord(progress.attributes)
      ? Object.fromEntries(Object.entries(progress.attributes)
          .filter((entry): entry is [string, number] => typeof entry[1] === "number" && Number.isFinite(entry[1])))
      : {};
    const carriedInventoryItems = Array.isArray(progress.inventoryItems)
      ? progress.inventoryItems
          .filter(isRecord)
          .map((item) => ({
            itemId: typeof item.itemId === "string" ? item.itemId : "",
            itemKey: typeof item.itemKey === "string" ? item.itemKey : "",
            displayName: typeof item.displayName === "string" ? item.displayName : "",
            rarity: typeof item.rarity === "string" ? item.rarity : "common",
            bound: item.bound === true,
          }))
          .filter((item) => item.itemId && item.displayName)
          .slice(0, 20)
      : [];
    const region: JourneyAvailableWorldObject = {
      id: canonicalRegionId,
      type: "region",
      label: publicRegionLabel(canonicalRegionId),
      regionId: canonicalRegionId,
      sourceFactIds: [`world:region:${canonicalRegionId}`],
      tags: ["region", "scenario_map"],
    };
    const taskType = journey.taskRequest?.taskType ?? journey.mandate.objective;
    const installedObjectIds = new Set(journey.taskPlan?.objectives.flatMap((objective) => objective.worldObjectIds) ?? []);
    const affiliationScores = new Map<string, number>((Array.isArray(progress.factionStandings)
      ? progress.factionStandings
      : []).flatMap((value) => {
        if (!isRecord(value) || typeof value.factionId !== "string" || typeof value.score !== "number") return [];
        return [[value.factionId, value.score] as const];
      }));
    const mapObjects = worldObjects(regionInfo, canonicalRegionId)
      .filter((object) =>
        object.id !== journey.agentId
        && (object.type !== "npc"
          || installedObjectIds.has(object.id)
          || !object.sourceFactIds.some((sourceFactId) => sourceFactId.startsWith("world:catalog:"))))
      .map((object) => affiliationScores.has(object.id)
        ? {
            ...object,
            tags: [...new Set([...(object.tags || []), "agent_affiliated"])],
          }
        : object)
      .sort((left, right) => (affiliationScores.get(right.id) || 0) - (affiliationScores.get(left.id) || 0));
    const taskCast = journeyScopedNpcObjects({
      journeyId: journey.journeyId,
      regionId: canonicalRegionId,
      taskType,
    });
    const rawObjects = [region, ...mapObjects, ...taskCast].filter((object, index, values) =>
      values.findIndex((candidate) => candidate.id === object.id) === index);
    // PR5c: stamp canonicalStatusDigest on each available world object from the
    // canonical projection's worldObjectStates. Objects whose id has no entry
    // in the projection are left with digest=undefined (intact by convention).
    const worldObjectStatesRaw = this.#epoch.worldObjectStates?.();
    const worldObjectStates = isRecord(worldObjectStatesRaw) ? worldObjectStatesRaw : {};
    const availableWorldObjects = rawObjects.map((object) => {
      const state = worldObjectStates[object.id];
      if (!isRecord(state)) return object;
      const status = typeof state.status === "string" ? state.status : undefined;
      const degree = typeof state.degree === "number" ? state.degree : undefined;
      if (!status || degree === undefined) return object;
      return {
        ...object,
        canonicalStatusDigest: {
          status: status as "intact" | "degraded" | "destroyed",
          degree,
          ...(typeof state.sourceActionEventId === "string"
            ? { sourceActionEventId: state.sourceActionEventId } : {}),
          ...(typeof state.changedAt === "string" ? { changedAt: state.changedAt } : {}),
        },
      };
    });
    return {
      taskType,
      identityName,
      identityTraits,
      ...(identityNeeds ? { identityNeeds } : {}),
      ...(lifeGoal ? { lifeGoal } : {}),
      resources,
      attributes,
      carriedInventoryItems,
      scenarioMapId: canonicalRegionId,
      generationRequested: journey.taskRequest?.generationRequested === true,
      region,
      availableWorldObjects,
      ...(journey.mirrorWindow ? { mirrorWindow: journey.mirrorWindow } : {}),
      ...(journey.worldSlice ? { worldSlice: journey.worldSlice } : {}),
    };
  }

  #missionForJourney(journey: EpochJourney) {
    const projection = this.#journey.projection();
    const episodes = journey.episodeIds.map((episodeId) => projection.episodes[episodeId]).filter(Boolean);
    return buildJourneyMission({
      journeyId: journey.journeyId,
      journeyStatus: journey.status,
      playerObjective: journey.mandate.objective,
      regionId: journey.destinationRegionId,
      episodes,
      taskPlan: journey.taskPlan,
      hiddenTaskSeal: journey.taskPlan
        ? this.#journey.hiddenTaskSealForJourney(journey.journeyId, journey.taskPlan)
        : undefined,
    });
  }

  #authorizeExplorer(input: UnknownRecord, explorerId: string) {
    return this.#epoch.verifyExplorerAuth({ ...input, explorerId });
  }

  /**
   * PR5c: extract canonical hidden-prerequisite links from the epoch
   * projection, filtered to the objectiveIds in the given plan. Returns an
   * empty array when the surface does not provide the accessor (backward
   * compat) or when no links match.
   */
  #hiddenPrerequisiteLinksForPlan(
    plan: { readonly objectives: readonly { readonly objectiveId: string }[] },
  ): readonly HiddenPrerequisiteLink[] {
    const raw = this.#epoch.hiddenPrerequisiteLinks?.();
    if (!isRecord(raw)) return [];
    const objectiveIds = new Set(plan.objectives.map((o) => o.objectiveId));
    const out: HiddenPrerequisiteLink[] = [];
    for (const value of Object.values(raw)) {
      if (!isRecord(value)) continue;
      const objectiveId = typeof value.objectiveId === "string" ? value.objectiveId : "";
      const prerequisiteObjectId = typeof value.prerequisiteObjectId === "string" ? value.prerequisiteObjectId : "";
      const regionId = typeof value.regionId === "string" ? value.regionId : "";
      const status = typeof value.status === "string" ? value.status : "";
      if (!objectiveId || !prerequisiteObjectId || !regionId || !status || !objectiveIds.has(objectiveId)) continue;
      out.push({
        objectiveId,
        prerequisiteObjectId,
        status: status as "intact" | "degraded" | "destroyed",
        ...(typeof value.destroyedAtActionEventId === "string"
          ? { destroyedAtActionEventId: value.destroyedAtActionEventId } : {}),
        ...(typeof value.degradedAtActionEventId === "string"
          ? { degradedAtActionEventId: value.degradedAtActionEventId } : {}),
        ...(typeof value.sourceLedgerEntryId === "string"
          ? { sourceLedgerEntryId: value.sourceLedgerEntryId } : {}),
        observedAt: typeof value.observedAt === "string" ? value.observedAt : "",
      });
    }
    return out;
  }

  #captureEvents<TValue extends object>(run: () => TValue): TValue {
    const before = new Set(this.#journey.projection().events.map((event) => event.eventId));
    const value = run();
    const events = this.#journey.projection().events.filter((event) => !before.has(event.eventId));
    return attachJourneyEventsForPersistence(value, events);
  }

  #idempotently<TValue extends object>(scope: string, ownerId: string, input: UnknownRecord, run: () => TValue): TValue {
    const key = requiredString(input.idempotencyKey, "idempotency_key");
    const cacheKey = `${scope}:${ownerId}:${key}`;
    const subjectHash = stableSubjectHash({ ownerId, input });
    const existing = this.#idempotency.get(cacheKey);
    if (existing) {
      if (existing.subjectHash !== subjectHash) throw new Error("idempotency_key_conflict");
      return attachJourneyEventsForPersistence({
        ...(existing.value as TValue),
        duplicate: true,
      }, []) as TValue;
    }
    const value = this.#captureEvents(run);
    const eventIds = new Set(journeyEventsForPersistence(value).map((event) => event.eventId));
    const taggedEvents = this.#journey.tagEvents(eventIds, { scope, ownerId, idempotencyKey: key, subjectHash });
    attachJourneyEventsForPersistence(value, taggedEvents);
    this.#idempotency.set(cacheKey, { subjectHash, value });
    return value;
  }

  #hydrateIdempotency() {
    const commands = new Map<string, { scope: string; key: string; subjectHash: string; journeyId: string }>();
    for (const event of this.#journey.projection().events) {
      if (!event.command) continue;
      const ownerId = event.command.ownerId || event.explorerId;
      commands.set(`${event.command.scope}:${ownerId}:${event.command.idempotencyKey}`, {
        scope: event.command.scope,
        key: event.command.idempotencyKey,
        subjectHash: event.command.subjectHash,
        journeyId: event.journeyId,
      });
    }
    for (const [cacheKey, command] of commands) {
      const record = this.#journey.projection().journeys[command.journeyId];
      if (!record) continue;
      const episodes = record.journey.episodeIds.map((episodeId) => this.#journey.projection().episodes[episodeId]).filter(Boolean);
      const value = command.scope === "start"
        ? {
            ...scrubJourneyRecordForPublicView(record),
            mission: this.#missionForJourney(record.journey),
            scenePlan: {
              status: episodes.length ? "ready" : "no_verifiable_world_object",
              candidates: [],
              episodes,
              usedRoutineFallback: episodes.some((episode) => episode.routine),
            },
            nextPollAt: record.journey.nextPollAt,
          }
        : { ...scrubJourneyRecordForPublicView(record), mission: this.#missionForJourney(record.journey) };
      this.#idempotency.set(cacheKey, { subjectHash: command.subjectHash, value });
    }
  }
}

export function createAgentCompanionRuntime(options: AgentCompanionRuntimeOptions) {
  return new AgentCompanionRuntime(options);
}
