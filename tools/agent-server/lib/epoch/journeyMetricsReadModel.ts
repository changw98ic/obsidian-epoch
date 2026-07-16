import type { JourneyProjection } from "./journeyReadModel.ts";
import type { EpochEvent } from "./events.ts";

function percentile(values: readonly number[], fraction: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * fraction))];
}

export function journeyMetricsView(projection: JourneyProjection, epochEvents: readonly EpochEvent[] = []) {
  const journeys = Object.values(projection.journeys).map((record) => record.journey);
  const episodesPerJourney = journeys.map((journey) => journey.episodeIds.length);
  const interruptions = journeys.map((journey) => journey.synchronousQuestionCount);
  const pollIntervals = journeys.flatMap((journey) => {
    const started = projection.events.find((event) => event.journeyId === journey.journeyId && event.eventType === "journey_started");
    if (!journey.nextPollAt || !started) return [];
    const duration = Date.parse(journey.nextPollAt) - Date.parse(started.occurredAt);
    return Number.isFinite(duration) && duration >= 0 ? [duration] : [];
  });
  const fingerprints = Object.values(projection.episodes).map((episode) => JSON.stringify(episode.fingerprint));
  const uniqueFingerprints = new Set(fingerprints).size;
  const statuses = Object.fromEntries([...new Set(journeys.map((journey) => journey.status))]
    .map((status) => [status, journeys.filter((journey) => journey.status === status).length]));
  const socialEpisodes = Object.values(projection.episodes)
    .filter((episode) => episode.fingerprint.participantIds.length > 0).length;
  const episodes = Object.values(projection.episodes);
  const groundedEpisodes = episodes.filter((episode) => episode.serverFacts && episode.narrative).length;
  const canonicalEventIds = [...new Set(episodes.flatMap((episode) => episode.serverFacts?.sourceEventIds || []))];
  const epochEventsById = new Map(epochEvents.map((event) => [event.eventId, event]));
  const matchedCanonicalEvents = canonicalEventIds.filter((eventId) => epochEventsById.has(eventId));
  const correlatedCanonicalEvents = canonicalEventIds.filter((eventId) => {
    const event = epochEventsById.get(eventId);
    if (!event) return false;
    return journeys.some((journey) => journey.correlationId && event.correlationId === journey.correlationId);
  });
  const groundedEpisodeRate = episodes.length ? groundedEpisodes / episodes.length : 1;
  const canonicalEventCoverage = canonicalEventIds.length ? matchedCanonicalEvents.length / canonicalEventIds.length : 1;
  const correlationCoverage = canonicalEventIds.length ? correlatedCanonicalEvents.length / canonicalEventIds.length : 1;
  return {
    journeys: {
      total: journeys.length,
      statuses,
      active: journeys.filter((journey) => !["settled", "cancelled", "identity_ended"].includes(journey.status)).length,
      settled: journeys.filter((journey) => journey.status === "settled").length,
    },
    episodes: {
      total: projection ? Object.keys(projection.episodes).length : 0,
      social: socialEpisodes,
      perJourneyP50: percentile(episodesPerJourney, 0.5),
      perJourneyP95: percentile(episodesPerJourney, 0.95),
      repeatedTemplateRate: fingerprints.length ? (fingerprints.length - uniqueFingerprints) / fingerprints.length : 0,
    },
    interruptionsPerJourney: {
      p50: percentile(interruptions, 0.5),
      p95: percentile(interruptions, 0.95),
      max: interruptions.length ? Math.max(...interruptions) : 0,
    },
    pollIntervalMs: {
      p50: percentile(pollIntervals, 0.5),
      p95: percentile(pollIntervals, 0.95),
    },
    briefing: {
      maxExpandedInteractionItems: 1,
      lowPriorityAggregationEnabled: true,
    },
    propagation: {
      sharedEpisodeCandidates: socialEpisodes,
      canonicalEventIds: canonicalEventIds.length,
    },
    security: {
      groundedEpisodes,
      groundedEpisodeRate,
      canonicalEventCoverage,
      correlationCoverage,
    },
    errorBudget: {
      groundedNarrativeAlert: episodes.length > 0 && groundedEpisodeRate < 1,
      canonicalEventMissingAlert: canonicalEventIds.length > 0 && canonicalEventCoverage < 1,
      correlationBreakAlert: canonicalEventIds.length > 0 && correlationCoverage < 1,
    },
  };
}
