import type { JourneyProjection } from "./journeyReadModel.ts";
import { journeyNarrativeText } from "./journeyNarrativeRules.ts";

export const OBSIDIAN_WORLD_CALENDAR_VERSION = "obsidian-world-calendar-v1" as const;

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

export function buildJourneyAlbum(projection: JourneyProjection, agentId: string) {
  const journeys = Object.values(projection.journeys)
    .filter((record) => record.journey.agentId === agentId)
    .sort((left, right) => (left.journey.startedAtWorldTime || "").localeCompare(right.journey.startedAtWorldTime || ""));
  const postcards = journeyPostcards(projection, agentId);
  return {
    calendarVersion: OBSIDIAN_WORLD_CALENDAR_VERSION,
    agentId,
    journeys: journeys.map((record) => ({
      ...record,
      episodes: record.journey.episodeIds.map((episodeId) => projection.episodes[episodeId]).filter(Boolean),
      postcards: postcards.filter((postcard) => postcard.journeyId === record.journey.journeyId),
    })),
    postcards,
  };
}
