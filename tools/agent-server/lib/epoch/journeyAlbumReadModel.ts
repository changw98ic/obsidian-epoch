import type { JourneyProjection } from "./journeyReadModel.ts";
import { journeyNarrativeText } from "./journeyNarrativeRules.ts";
import { buildGroundedJourneyStoryReport } from "./journeyStoryReport.ts";
import { buildJourneyInteractionLog } from "./journeyInteractionLog.ts";
import { buildJourneyMission } from "./journeyMissionReadModel.ts";
import type { EpochJourney } from "./journeyRules.ts";
import type { GroundedJourneyStoryReport } from "./journeyStoryReport.ts";

export const OBSIDIAN_WORLD_CALENDAR_VERSION = "obsidian-world-calendar-v2" as const;

export interface JourneyPostcard {
  readonly postcardId: string;
  readonly journeyId: string;
  readonly episodeId: string;
  readonly title: string;
  readonly regionId: string;
  readonly worldTime: string;
  readonly participants: readonly { readonly id: string; readonly type: string; readonly label: string }[];
  readonly narrative: string;
  readonly outcomeKey: string;
  readonly sourceEventIds: readonly string[];
  readonly verificationUrl?: string;
}

function episodeEventId(projection: JourneyProjection, episodeId: string) {
  return projection.events.find((event) =>
    event.eventType === "journey_episode_recorded" && event.episode?.episodeId === episodeId)?.eventId;
}

export function journeyPostcards(projection: JourneyProjection, agentId: string): readonly JourneyPostcard[] {
  const postcards: JourneyPostcard[] = [];
  for (const record of Object.values(projection.journeys).filter((candidate) => candidate.journey.agentId === agentId)) {
    if (record.journey.status !== "settled") continue;
    for (const episodeId of record.journey.episodeIds) {
      const episode = projection.episodes[episodeId];
      if (!episode?.serverFacts || !episode.narrative) continue;
      const eventId = episodeEventId(projection, episodeId);
      const verificationUrl = record.journey.verification?.urlPath
        ? `${record.journey.verification.urlPath}#episode-${encodeURIComponent(episodeId)}`
        : undefined;
      postcards.push({
        postcardId: `postcard:${episodeId}`,
        journeyId: record.journey.journeyId,
        episodeId,
        title: episode.title,
        regionId: record.journey.destinationRegionId,
        worldTime: record.journey.startedAtWorldTime || record.journey.settledAtWorldTime || "unknown",
        participants: episode.worldObjectRefs
          .filter((ref) => ref.type === "agent" || ref.type === "npc")
          .map((ref) => ({ id: ref.id, type: ref.type, label: ref.label })),
        narrative: journeyNarrativeText(episode.narrative),
        outcomeKey: episode.outcomeKey,
        sourceEventIds: [...new Set([
          ...(eventId ? [eventId] : []),
          ...episode.serverFacts.sourceEventIds,
        ])],
        ...(verificationUrl ? { verificationUrl } : {}),
      });
    }
  }
  return postcards.sort((left, right) => left.worldTime.localeCompare(right.worldTime) || left.episodeId.localeCompare(right.episodeId));
}

export interface BuildJourneyAlbumOptions {
  readonly storyReportForJourney?: (journey: EpochJourney) => GroundedJourneyStoryReport | undefined;
}

export function buildJourneyAlbum(
  projection: JourneyProjection,
  agentId: string,
  options: BuildJourneyAlbumOptions = {},
) {
  const journeys = Object.values(projection.journeys)
    .filter((record) => record.journey.agentId === agentId)
    .sort((left, right) => (left.journey.startedAtWorldTime || "").localeCompare(right.journey.startedAtWorldTime || ""));
  const postcards = journeyPostcards(projection, agentId);
  return {
    calendarVersion: OBSIDIAN_WORLD_CALENDAR_VERSION,
    agentId,
    journeys: journeys.map((record) => {
      const episodes = record.journey.episodeIds.map((episodeId) => projection.episodes[episodeId]).filter(Boolean);
      if (!record.journey.taskPlan) throw new Error("journey_task_plan_required");
      const taskPlan = record.journey.taskPlan;
      const hiddenTaskSeal = projection.hiddenTaskSeals[record.journey.journeyId];
      if (!hiddenTaskSeal) throw new Error("journey_hidden_task_seal_missing");
      const mission = buildJourneyMission({
        journeyId: record.journey.journeyId,
        journeyStatus: record.journey.status,
        playerObjective: record.journey.mandate.objective,
        regionId: record.journey.destinationRegionId,
        episodes,
        taskPlan,
        hiddenTaskSeal,
        hiddenPrerequisiteLinks: [],
        completionTier: record.journey.worldCommit?.completionTier,
      });
      const storyReport = options.storyReportForJourney?.(record.journey) ?? buildGroundedJourneyStoryReport({
        journeyId: record.journey.journeyId,
        status: record.journey.status,
        objective: record.journey.mandate.objective,
        regionId: record.journey.destinationRegionId,
        startedAtWorldTime: record.journey.startedAtWorldTime,
        dueAtWorldTime: record.journey.dueAtWorldTime,
        worldCommit: record.journey.worldCommit,
        episodes,
        taskPlan,
        hiddenTaskSeal,
        hiddenPrerequisiteLinks: [],
      });
      return {
        ...record,
        episodes,
        mission,
        interactionLog: buildJourneyInteractionLog({
          journeyId: record.journey.journeyId,
          episodes,
        }),
        postcards: postcards.filter((postcard) => postcard.journeyId === record.journey.journeyId),
        ...(storyReport ? { storyReport } : {}),
      };
    }),
    postcards,
  };
}
