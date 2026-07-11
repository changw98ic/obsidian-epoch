import {
  epochWorldSceneMedia,
  epochWorldScenesForRegion,
  type EpochWorldSceneMedia,
} from "../worldSceneAssets.ts";
import { createWorldContextVersions, type EpochWorldContextVersions } from "../worldContextVersions.ts";
import { assertNonEmptyString, serverIsoTime, type EpochEventType } from "./protocol.ts";
import type {
  EpochAgentIdentity,
  EpochHostedSession,
  EpochProjection,
} from "./gameCore.ts";
import type { EpochGameRunReadModel } from "./gameRunReadModel.ts";
import {
  buildWorldHonorBoards,
  loreContributionCategoryFromInput,
  loreContributionsView,
  loreTargetStatusFromInput,
  loreTargetStatusesView,
  type EpochLoreContributionInfo,
  type EpochLoreContributionsInfo,
  type EpochLoreTargetStatusInfo,
  type EpochLoreTargetsInfo,
  type EpochWorldHonorBoard,
} from "./loreReadModel.ts";
import type {
  EpochPublicSafeSummary,
  EpochResultPageNextAction,
  EpochResultPageReceipt,
} from "./runtime.ts";
import {
  agentSelfStatement,
  resultPageNextActions,
} from "./resultPageNavigationRules.ts";
import {
  resultPageRegionId,
  resultPageRegionalContext,
  type EpochResultPageRegionalContext,
} from "./resultPageContextRules.ts";
import {
  hostedSessionWatchActions,
  publicHostedSession,
  type EpochHostedSessionWatchAction,
} from "./hostedSessionReadModel.ts";
import {
  latestEvents,
  progressView,
  type EpochProgressView,
} from "./progressReadModel.ts";
import { messagesView } from "./regionActivityReadModel.ts";
import { regionLeaderboardView } from "./regionLeaderboardReadModel.ts";
import { regionNewsView, type EpochRegionNewsView } from "./regionNewsReadModel.ts";
import { seasonsView, type EpochSeasonCampaignView } from "./seasonReadModel.ts";

type AnyRecord = Readonly<Record<string, unknown>>;

const SHARED_LORE_SNAPSHOT_EVENT_TYPES = new Set<EpochEventType>([
  "lore_contribution_recorded",
  "lore_target_adjudicated",
]);

export interface EpochWorldOverviewRegionHighlight {
  readonly regionId: string;
  readonly worldScene?: EpochWorldSceneMedia;
  readonly newsCount: number;
  readonly messageCount: number;
  readonly leaderAgentId?: string;
  readonly leaderExplorerId?: string;
  readonly publicPages: {
    readonly region: string;
  };
}

export interface EpochWorldOverviewRecentResult {
  readonly pageId: string;
  readonly createdAt: string;
  readonly expiresAt?: string;
  readonly urlPath: string;
  readonly createdBy: string;
  readonly agentId?: string;
  readonly explorerId?: string;
  readonly identityName?: string;
  readonly publicSafeSummary?: EpochPublicSafeSummary;
  readonly receiptHash: string;
  readonly receiptFocus: EpochResultPageReceipt["focus"];
  readonly canonicalEventCount: number;
  readonly run?: EpochGameRunReadModel;
}

export interface EpochWorldOverviewLegendaryDeath {
  readonly eventId: string;
  readonly agentId: string;
  readonly explorerId?: string;
  readonly finalTitle?: string;
  readonly archiveReason?: string;
  readonly archivedAt: string;
  readonly publicPages: {
    readonly archive: string;
    readonly audit: string;
  };
}

export interface EpochWorldOverviewInfo extends EpochWorldContextVersions {
  readonly generatedAt: string;
  readonly totals: {
    readonly identities: number;
    readonly activeIdentities: number;
    readonly archivedIdentities: number;
    readonly regionsWithNews: number;
    readonly resultPages: number;
  };
  readonly publicPages: {
    readonly world: string;
    readonly install: string;
    readonly console: string;
  };
  readonly news: readonly EpochRegionNewsView[];
  readonly recentResults: readonly EpochWorldOverviewRecentResult[];
  readonly legendaryDeaths: readonly EpochWorldOverviewLegendaryDeath[];
  readonly honorBoards: readonly EpochWorldHonorBoard[];
  readonly recentLoreContributions: readonly EpochLoreContributionInfo[];
  readonly loreTargetStatuses: readonly EpochLoreTargetStatusInfo[];
  readonly activeSeasons: readonly EpochSeasonCampaignView[];
  readonly regionHighlights: readonly EpochWorldOverviewRegionHighlight[];
}

export interface EpochHostedSessionWatchIdentity {
  readonly agentId: string;
  readonly explorerId: string;
  readonly identityName: string;
  readonly status: EpochAgentIdentity["status"];
  readonly generation: number;
  readonly lifetime: EpochAgentIdentity["lifetime"];
}

export interface EpochHostedSessionWatchInfo {
  readonly generatedAt: string;
  readonly sessionId: string;
  readonly agentId?: string;
  readonly explorerId?: string;
  readonly regionId?: string;
  readonly identity?: EpochHostedSessionWatchIdentity;
  readonly session?: EpochHostedSession;
  readonly regionalContext?: EpochResultPageRegionalContext;
  readonly nextActions: readonly EpochHostedSessionWatchAction[];
  readonly publicPages: {
    readonly world: string;
    readonly console: string;
    readonly watch: string;
    readonly api: string;
    readonly agent?: string;
    readonly explorer?: string;
    readonly region?: string;
  };
}

export interface EpochAgentBriefingWorldSummary {
  readonly publicPages: EpochWorldOverviewInfo["publicPages"];
  readonly news: readonly EpochRegionNewsView[];
  readonly regionHighlights: readonly EpochWorldOverviewRegionHighlight[];
  readonly activeSeasons: readonly EpochSeasonCampaignView[];
}

export interface EpochAgentBriefingView {
  readonly generatedAt: string;
  readonly agentId?: string;
  readonly explorerId?: string;
  readonly regionId?: string;
  readonly agentSelfStatement: string;
  readonly progress: EpochProgressView;
  readonly regionalContext?: EpochResultPageRegionalContext;
  readonly pendingActions: readonly EpochResultPageNextAction[];
  readonly world: EpochAgentBriefingWorldSummary;
  readonly publicPages: {
    readonly world: string;
    readonly console: string;
    readonly agent?: string;
    readonly explorer?: string;
    readonly region?: string;
    readonly archive?: string;
  };
}

export interface EpochPublicWorldResultPages {
  readonly size: () => number;
  readonly recentResults: (input: { readonly limit: number }) => readonly EpochWorldOverviewRecentResult[];
}

export interface EpochPublicWorldReadModelRuntimeOptions {
  readonly clock: () => Date;
  readonly maxDowntimeSeconds?: number;
  readonly project: () => EpochProjection;
  readonly resultPages: EpochPublicWorldResultPages;
}

function isRecord(value: unknown): value is AnyRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function recordValue(value: unknown): AnyRecord {
  return isRecord(value) ? value : {};
}

export function publicReadLimit(input: AnyRecord, fallback = 8) {
  const value = Number(input.limit ?? fallback);
  if (!Number.isFinite(value)) return fallback;
  return Math.max(1, Math.min(Math.floor(value), 24));
}

export function worldContextVersionsForProjection(projection: EpochProjection): EpochWorldContextVersions {
  return createWorldContextVersions({
    sharedLoreSnapshotParts: projection.events
      .filter((event) => SHARED_LORE_SNAPSHOT_EVENT_TYPES.has(event.eventType))
      .map((event) => `${event.eventId}:${event.eventType}:${event.aggregateId}:${event.createdAt}`),
  });
}

export function createPublicWorldReadModelRuntime(options: EpochPublicWorldReadModelRuntimeOptions) {
  function worldOverview(input: AnyRecord = {}): EpochWorldOverviewInfo {
    const projection = options.project();
    const contextVersions = worldContextVersionsForProjection(projection);
    const limit = publicReadLimit(input);
    const news = regionNewsView(Object.values(projection.regionNews).flat()).slice(0, limit);
    const recentLoreContributions = loreContributionsView(projection, { limit });
    const loreTargetStatuses = loreTargetStatusesView(projection, { limit });
    const resultSummaries = options.resultPages.recentResults({ limit });
    const legendaryDeaths = latestEvents(projection, {
      eventType: "identity_archived",
      limit,
    }).map((event): EpochWorldOverviewLegendaryDeath => {
      const payload = recordValue(event.payload);
      const identity = projection.identities[event.aggregateId];
      return {
        eventId: event.eventId,
        agentId: event.agentId || event.aggregateId,
        explorerId: identity?.explorerId,
        finalTitle: typeof payload.finalTitle === "string" ? payload.finalTitle : identity?.lifetime.finalTitle,
        archiveReason: typeof payload.archiveReason === "string" ? payload.archiveReason : undefined,
        archivedAt: typeof payload.archivedAt === "string" ? payload.archivedAt : event.createdAt,
        publicPages: {
          archive: `/epoch/archive/${encodeURIComponent(event.aggregateId)}`,
          audit: `/epoch/audit/${encodeURIComponent(event.eventId)}`,
        },
      };
    });
    const highlightedRegionIds = [...new Set([
      ...news.map((item) => item.regionId),
      ...Object.keys(projection.regionControls),
      ...Object.keys(projection.regionMessages),
    ])].slice(0, limit);
    const regionHighlights = highlightedRegionIds.map((regionId): EpochWorldOverviewRegionHighlight => {
      const leader = regionLeaderboardView(projection, { regionId, limit: 1 })[0];
      const worldScene = epochWorldScenesForRegion(regionId)[0];
      return {
        regionId,
        worldScene: worldScene ? epochWorldSceneMedia(worldScene) : undefined,
        newsCount: regionNewsView(projection.regionNews[regionId] || []).length,
        messageCount: messagesView(projection, { regionId, limit: 24 }).regionMessages.length,
        leaderAgentId: leader?.agentId,
        leaderExplorerId: leader?.explorerId,
        publicPages: {
          region: `/epoch/region/${encodeURIComponent(regionId)}`,
        },
      };
    });
    const identities = Object.values(projection.identities);
    return {
      generatedAt: serverIsoTime(options.clock),
      ...contextVersions,
      totals: {
        identities: identities.length,
        activeIdentities: identities.filter((identity) => identity.status === "active").length,
        archivedIdentities: identities.filter((identity) => identity.status === "archived").length,
        regionsWithNews: Object.values(projection.regionNews).filter((items) => regionNewsView(items).length > 0).length,
        resultPages: options.resultPages.size(),
      },
      publicPages: {
        world: "/epoch/world",
        install: "/epoch/install",
        console: "/epoch/console",
      },
      news,
      recentResults: resultSummaries,
      legendaryDeaths,
      honorBoards: buildWorldHonorBoards(projection, limit),
      recentLoreContributions,
      loreTargetStatuses,
      activeSeasons: seasonsView(projection, { status: "active" }).slice(0, limit),
      regionHighlights,
    };
  }

  function agentBriefing(input: AnyRecord = {}): EpochAgentBriefingView {
    const projection = options.project();
    const generatedAt = serverIsoTime(options.clock);
    const limit = publicReadLimit(input, 6);
    const progress = progressView(projection, {
      agentId: typeof input.agentId === "string" ? input.agentId : undefined,
      explorerId: typeof input.explorerId === "string" ? input.explorerId : undefined,
      limit,
      now: generatedAt,
      maxDowntimeSeconds: options.maxDowntimeSeconds,
    });
    const identity = progress.identity || progress.identities.at(-1);
    const regionId = resultPageRegionId({ input, progress });
    const regionalContext = resultPageRegionalContext(projection, regionId);
    const pendingActions = resultPageNextActions({ progress, regionId, regionalContext });
    const overview = worldOverview({ limit });
    return {
      generatedAt,
      agentId: progress.agentId || identity?.agentId,
      explorerId: progress.explorerId || identity?.explorerId,
      regionId,
      agentSelfStatement: agentSelfStatement({ identity, progress, regionId }),
      progress,
      regionalContext,
      pendingActions,
      world: {
        publicPages: overview.publicPages,
        news: overview.news,
        regionHighlights: overview.regionHighlights,
        activeSeasons: overview.activeSeasons,
      },
      publicPages: {
        world: overview.publicPages.world,
        console: overview.publicPages.console,
        ...(identity ? { agent: `/epoch/agent/${encodeURIComponent(identity.agentId)}` } : {}),
        ...(identity?.explorerId ? { explorer: `/epoch/explorer/${encodeURIComponent(identity.explorerId)}` } : {}),
        ...(regionId ? { region: `/epoch/region/${encodeURIComponent(regionId)}` } : {}),
        ...(identity?.status === "archived" ? { archive: `/epoch/archive/${encodeURIComponent(identity.agentId)}` } : {}),
      },
    };
  }

  function hostedSessionWatch(input: AnyRecord = {}): EpochHostedSessionWatchInfo {
    const sessionId = assertNonEmptyString(input.sessionId, "hosted_session_id");
    if (sessionId.length > 160) throw new Error("hosted_session_id_invalid");
    const projection = options.project();
    const generatedAt = serverIsoTime(options.clock);
    const watchPath = `/epoch/hosted/${encodeURIComponent(sessionId)}`;
    const apiPath = `/api/epoch/hosted/watch?sessionId=${encodeURIComponent(sessionId)}`;
    const basePages = {
      world: "/epoch/world",
      console: "/epoch/console",
      watch: watchPath,
      api: apiPath,
    };
    const session = projection.hostedSessions[sessionId];
    if (!session) {
      return {
        generatedAt,
        sessionId,
        nextActions: [],
        publicPages: basePages,
      };
    }
    const identity = projection.identities[session.agentId];
    const publicSession = publicHostedSession(session);
    return {
      generatedAt,
      sessionId,
      agentId: session.agentId,
      explorerId: session.explorerId,
      regionId: session.regionId,
      ...(identity ? {
        identity: {
          agentId: identity.agentId,
          explorerId: identity.explorerId,
          identityName: identity.identityName,
          status: identity.status,
          generation: identity.generation,
          lifetime: identity.lifetime,
        },
      } : {}),
      session: publicSession,
      regionalContext: resultPageRegionalContext(projection, session.regionId),
      nextActions: hostedSessionWatchActions(session),
      publicPages: {
        ...basePages,
        agent: `/epoch/agent/${encodeURIComponent(session.agentId)}`,
        explorer: `/epoch/explorer/${encodeURIComponent(session.explorerId)}`,
        region: `/epoch/region/${encodeURIComponent(session.regionId)}`,
      },
    };
  }

  function loreContributions(input: AnyRecord = {}): EpochLoreContributionsInfo {
    const projection = options.project();
    const agentId = typeof input.agentId === "string" && input.agentId.trim()
      ? input.agentId.trim()
      : undefined;
    const category = loreContributionCategoryFromInput(input.category);
    const targetId = typeof input.targetId === "string" && input.targetId.trim()
      ? input.targetId.trim()
      : undefined;
    const contributions = loreContributionsView(projection, {
      agentId,
      category,
      targetId,
      limit: Number(input.limit || 20),
    });
    return {
      agentId,
      category,
      targetId,
      total: contributions.length,
      contributions,
      publicPages: {
        world: "/epoch/world",
      },
    };
  }

  function loreTargets(input: AnyRecord = {}): EpochLoreTargetsInfo {
    const targetId = typeof input.targetId === "string" && input.targetId.trim()
      ? input.targetId.trim()
      : undefined;
    const status = loreTargetStatusFromInput(input.status);
    const targets = loreTargetStatusesView(options.project(), {
      targetId,
      status,
      limit: Number(input.limit || 20),
    });
    return {
      targetId,
      status,
      total: targets.length,
      targets,
      publicPages: {
        world: "/epoch/world",
      },
    };
  }

  return {
    agentBriefing,
    hostedSessionWatch,
    loreContributions,
    loreTargets,
    worldContextVersions: () => worldContextVersionsForProjection(options.project()),
    worldOverview,
  };
}
