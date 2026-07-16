import { resolveEpochCanonicalRegionId } from "../regionAliases.ts";
import type { EpochEvent } from "./events.ts";
import type {
  EpochConflictTrace,
  EpochHostedSession,
  EpochMessageRecord,
  EpochProjection,
  EpochRaidResult,
  EpochRegionControl,
  EpochRetaliationOpportunity,
  EpochTurnCard,
} from "./gameCore.ts";
import type { EpochProgressView } from "./progressReadModel.ts";
import { messagesView } from "./regionActivityReadModel.ts";
import { regionCommissionsView, type EpochRegionCommission } from "./regionCommissionReadModel.ts";
import { raidsView, retaliationsView, tracesView } from "./regionConflictReadModel.ts";
import { regionNewsView, type EpochRegionNewsView } from "./regionNewsReadModel.ts";

export interface EpochResultPageRegionalContext {
  readonly regionId: string;
  readonly regionControl: EpochRegionControl | null;
  readonly messages: readonly EpochMessageRecord[];
  readonly news: readonly EpochRegionNewsView[];
  readonly commissions: readonly EpochRegionCommission[];
  readonly raids: readonly EpochRaidResult[];
  readonly retaliations: readonly EpochRetaliationOpportunity[];
  readonly traces: readonly EpochConflictTrace[];
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export function canonicalResultPageRegionIdFromInput(regionId: unknown): string | undefined {
  if (typeof regionId !== "string") return undefined;
  const trimmed = regionId.trim();
  return trimmed ? resolveEpochCanonicalRegionId(trimmed) : undefined;
}

export function latestProgressRegionId(events: readonly EpochEvent[]): string | undefined {
  for (const event of events) {
    const payload = event.payload;
    if (!isRecord(payload)) continue;
    const regionId = canonicalResultPageRegionIdFromInput(payload.regionId);
    if (regionId) return regionId;
  }
  return undefined;
}

export function resultPageRegionId(input: {
  readonly input: { readonly regionId?: unknown };
  readonly progress: Pick<EpochProgressView, "downtime" | "latestEvents">;
  readonly focusTurnCard?: Pick<EpochTurnCard, "regionId">;
  readonly focusHostedSession?: Pick<EpochHostedSession, "regionId">;
}): string | undefined {
  const requestedRegionId = canonicalResultPageRegionIdFromInput(input.input.regionId);
  return input.focusTurnCard?.regionId
    || input.focusHostedSession?.regionId
    || requestedRegionId
    || input.progress.downtime?.regionId
    || latestProgressRegionId(input.progress.latestEvents);
}

export function resultPageFocusTurnCard(
  projection: Pick<EpochProjection, "turnCards">,
  input: {
    readonly turnCardId?: unknown;
    readonly focusTurnCardId?: unknown;
    readonly agentId?: unknown;
    readonly explorerId?: unknown;
  } = {},
): EpochTurnCard | undefined {
  const rawTurnCardId = typeof input.turnCardId === "string"
    ? input.turnCardId.trim()
    : typeof input.focusTurnCardId === "string"
      ? input.focusTurnCardId.trim()
      : "";
  if (!rawTurnCardId) return undefined;

  const card = projection.turnCards[rawTurnCardId];
  if (!card) throw new Error("turn_card_not_found");
  if (card.status !== "resolved" || !card.resolution) throw new Error("turn_card_not_resolved");

  const requestedAgentId = typeof input.agentId === "string" ? input.agentId.trim() : "";
  if (requestedAgentId && requestedAgentId !== card.agentId) throw new Error("turn_card_agent_mismatch");

  const requestedExplorerId = typeof input.explorerId === "string" ? input.explorerId.trim() : "";
  if (requestedExplorerId && requestedExplorerId !== card.explorerId) throw new Error("turn_card_explorer_mismatch");

  return card;
}

export function resultPageFocusHostedSession(
  projection: Pick<EpochProjection, "hostedSessions">,
  input: {
    readonly hostedSessionId?: unknown;
    readonly focusHostedSessionId?: unknown;
    readonly agentId?: unknown;
    readonly explorerId?: unknown;
  } = {},
): EpochHostedSession | undefined {
  const rawSessionId = typeof input.hostedSessionId === "string"
    ? input.hostedSessionId.trim()
    : typeof input.focusHostedSessionId === "string"
      ? input.focusHostedSessionId.trim()
      : "";
  if (!rawSessionId) return undefined;

  const session = projection.hostedSessions[rawSessionId];
  if (!session) throw new Error("hosted_session_not_found");
  if (session.status !== "completed" || !session.actions.length) throw new Error("hosted_session_not_completed");

  const requestedAgentId = typeof input.agentId === "string" ? input.agentId.trim() : "";
  if (requestedAgentId && requestedAgentId !== session.agentId) throw new Error("hosted_session_agent_mismatch");

  const requestedExplorerId = typeof input.explorerId === "string" ? input.explorerId.trim() : "";
  if (requestedExplorerId && requestedExplorerId !== session.explorerId) throw new Error("hosted_session_explorer_mismatch");

  return session;
}

export function resultPageRegionalContext(
  projection: EpochProjection,
  regionId?: string,
): EpochResultPageRegionalContext | undefined {
  if (!regionId) return undefined;
  return {
    regionId,
    regionControl: projection.regionControls[regionId] || null,
    messages: messagesView(projection, { regionId, limit: 6 }).regionMessages,
    news: regionNewsView(projection.regionNews[regionId] || []).slice(0, 6),
    commissions: regionCommissionsView(projection, { regionId }).slice(0, 6),
    raids: raidsView(projection, { regionId }).slice(0, 6),
    retaliations: retaliationsView(projection, { regionId }).slice(0, 6),
    traces: tracesView(projection, { regionId, limit: 6 }),
  };
}
