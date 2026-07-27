import type { JourneyGeneratedTaskObjective } from "./journeyGeneratedTaskRules.ts";
import type { JourneyEpisodeStoryBeat, ServerJourneyEpisodeFacts } from "./journeyNarrativeRules.ts";
import { publicText } from "./publicVocabulary.ts";

export interface JourneyInteractionLogEpisodeInput {
  readonly episodeId: string;
  readonly title: string;
  readonly phase?: "arrival" | "main" | "side" | "return";
  readonly generatedTaskObjective?: JourneyGeneratedTaskObjective;
  readonly serverFacts?: ServerJourneyEpisodeFacts;
}

export interface JourneyInteractionLogEntry {
  readonly sequence: number;
  readonly episodeId: string;
  readonly phase: JourneyEpisodeStoryBeat["phase"];
  readonly sceneTitle: string;
  readonly selectedAction: {
    readonly optionKey?: string;
    readonly label: string;
  };
  readonly outcomeSummary: string;
  readonly objective?: {
    readonly objectiveId: string;
    readonly kind: JourneyGeneratedTaskObjective["kind"];
    readonly title: string;
  };
  readonly sourceEventIds: readonly string[];
}

export interface JourneyInteractionLog {
  readonly kind: "journey_interaction_log";
  readonly version: 1;
  readonly journeyId: string;
  readonly entries: readonly JourneyInteractionLogEntry[];
}

function clean(value: string): string {
  return publicText(value).trim();
}

export function buildJourneyInteractionLog(input: {
  readonly journeyId: string;
  readonly episodes: readonly JourneyInteractionLogEpisodeInput[];
}): JourneyInteractionLog {
  const entries = input.episodes.flatMap((episode, index): readonly JourneyInteractionLogEntry[] => {
    const beat = episode.serverFacts?.storyBeat;
    if (!beat) return [];
    const objective = episode.generatedTaskObjective;
    return [{
      sequence: index + 1,
      episodeId: episode.episodeId,
      phase: beat.phase,
      sceneTitle: clean(beat.sceneTitle || episode.title),
      selectedAction: {
        ...(beat.selectedAction.optionKey ? { optionKey: beat.selectedAction.optionKey } : {}),
        label: clean(beat.selectedAction.label),
      },
      outcomeSummary: clean(beat.outcomeSummary),
      ...(objective ? { objective: {
        objectiveId: objective.objectiveId,
        kind: objective.kind,
        title: clean(objective.title),
      } } : {}),
      sourceEventIds: [...new Set(episode.serverFacts?.sourceEventIds || [])],
    }];
  });
  return {
    kind: "journey_interaction_log",
    version: 1,
    journeyId: input.journeyId,
    entries,
  };
}
