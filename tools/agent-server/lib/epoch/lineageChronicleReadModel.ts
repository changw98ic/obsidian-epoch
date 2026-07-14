import type { EpochAgentIdentity } from "./gameCore.ts";
import type { JourneyProjection } from "./journeyReadModel.ts";
import { journeyPostcards, OBSIDIAN_WORLD_CALENDAR_VERSION } from "./journeyAlbumReadModel.ts";

export interface LineageChronicleEventRef {
  readonly eventId: string;
  readonly eventType: string;
  readonly createdAt: string;
}

export interface LineageChronicleGeneration {
  readonly generation: number;
  readonly agentId: string;
  readonly identityName: string;
  readonly status: EpochAgentIdentity["status"];
  readonly startedAt: string;
  readonly archivedAt?: string;
  readonly finalTitle?: string;
  readonly previousAgentId?: string;
  readonly nextAgentId?: string;
  readonly journeyIds: readonly string[];
  readonly postcardIds: readonly string[];
  readonly sourceEventIds: readonly string[];
  readonly narrative: string;
  readonly publicPages: { readonly agent: string; readonly archive?: string };
}

export interface LineageChronicle {
  readonly calendarVersion: typeof OBSIDIAN_WORLD_CALENDAR_VERSION;
  readonly explorerId: string;
  readonly generations: readonly LineageChronicleGeneration[];
  readonly transitions: readonly {
    readonly fromAgentId: string;
    readonly toAgentId: string;
    readonly sourceEventIds: readonly string[];
  }[];
  readonly sourceEventIds: readonly string[];
}

function unique(values: readonly string[]) {
  return [...new Set(values.filter(Boolean))];
}

export function buildLineageChronicle(input: {
  readonly explorerId: string;
  readonly identities: readonly EpochAgentIdentity[];
  readonly projection: JourneyProjection;
  readonly lifecycleEventsByAgent: Readonly<Record<string, readonly LineageChronicleEventRef[]>>;
}): LineageChronicle {
  const identities = [...input.identities]
    .filter((identity) => identity.explorerId === input.explorerId)
    .sort((left, right) => left.generation - right.generation || left.agentId.localeCompare(right.agentId));
  const generations = identities.map((identity): LineageChronicleGeneration => {
    const postcards = journeyPostcards(input.projection, identity.agentId);
    const journeyIds = unique(postcards.map((postcard) => postcard.journeyId));
    const lifecycleEvents = input.lifecycleEventsByAgent[identity.agentId] || [];
    const sourceEventIds = unique([
      ...postcards.flatMap((postcard) => postcard.sourceEventIds),
      ...lifecycleEvents.map((event) => event.eventId),
    ]);
    const end = identity.lifetime.archivedAt
      ? `于 ${identity.lifetime.archivedAt} 归档${identity.lifetime.finalTitle ? `，终章称号为「${identity.lifetime.finalTitle}」` : ""}`
      : "仍在继续";
    return {
      generation: identity.generation,
      agentId: identity.agentId,
      identityName: identity.identityName,
      status: identity.status,
      startedAt: identity.lifetime.startedAt,
      ...(identity.lifetime.archivedAt ? { archivedAt: identity.lifetime.archivedAt } : {}),
      ...(identity.lifetime.finalTitle ? { finalTitle: identity.lifetime.finalTitle } : {}),
      ...(identity.previousAgentId ? { previousAgentId: identity.previousAgentId } : {}),
      ...(identity.nextAgentId ? { nextAgentId: identity.nextAgentId } : {}),
      journeyIds,
      postcardIds: postcards.map((postcard) => postcard.postcardId),
      sourceEventIds,
      narrative: `第 ${identity.generation} 世「${identity.identityName}」自 ${identity.lifetime.startedAt} 起留下 ${journeyIds.length} 次可验证旅程、${postcards.length} 张事实明信片；${end}。`,
      publicPages: {
        agent: `/epoch/agent/${encodeURIComponent(identity.agentId)}`,
        ...(identity.status === "archived" ? { archive: `/epoch/archive/${encodeURIComponent(identity.agentId)}` } : {}),
      },
    };
  });
  const transitions = identities.flatMap((identity) => {
    if (!identity.nextAgentId) return [];
    const transitionIds = unique((input.lifecycleEventsByAgent[identity.agentId] || [])
      .filter((event) => event.eventType === "identity_archived" || event.eventType === "reincarnation_issued")
      .map((event) => event.eventId));
    return [{ fromAgentId: identity.agentId, toAgentId: identity.nextAgentId, sourceEventIds: transitionIds }];
  });
  return {
    calendarVersion: OBSIDIAN_WORLD_CALENDAR_VERSION,
    explorerId: input.explorerId,
    generations,
    transitions,
    sourceEventIds: unique([
      ...generations.flatMap((generation) => generation.sourceEventIds),
      ...transitions.flatMap((transition) => transition.sourceEventIds),
    ]),
  };
}
