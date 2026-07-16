import { assertNonEmptyString, type EpochResourceId } from "./protocol.ts";
import {
  identitySlotsForExplorer,
  type EpochAgentIdentity,
  type EpochIdentitySlotState,
  type EpochProjection,
} from "./gameCore.ts";

export interface EpochExplorerProfileSummary {
  readonly totalIdentities: number;
  readonly activeIdentities: number;
  readonly archivedIdentities: number;
  readonly totalLegend: number;
}

export interface EpochExplorerProfileInfo {
  readonly explorerId: string;
  readonly summary: EpochExplorerProfileSummary;
  readonly identitySlots: EpochIdentitySlotState;
  readonly totalResources: Partial<Record<EpochResourceId, number>>;
  readonly identities: readonly EpochAgentIdentity[];
  readonly activeIdentities: readonly EpochAgentIdentity[];
  readonly archivedIdentities: readonly EpochAgentIdentity[];
  readonly latestEvents: readonly EpochProjection["events"][number][];
  readonly publicPages: {
    readonly explorer: string;
    readonly agents: readonly string[];
    readonly archives: readonly string[];
  };
}

function eventIsForAgent(event: EpochProjection["events"][number], agentId: string) {
  return event.agentId === agentId || event.aggregateId === agentId;
}

function addResourceAmount(target: Partial<Record<EpochResourceId, number>>, resourceId: EpochResourceId | undefined, amount: number) {
  if (!resourceId) return;
  target[resourceId] = (target[resourceId] || 0) + amount;
}

export function explorerProfileView(
  projection: EpochProjection,
  input: { explorerId?: string; limit?: number },
): EpochExplorerProfileInfo {
  const explorerId = assertNonEmptyString(input.explorerId, "explorer_id");
  const lineage = projection.lineage[explorerId] || [];
  if (!lineage.length) throw new Error("explorer_profile_not_found");
  const identities = lineage
    .map((agentId) => projection.identities[agentId])
    .filter(Boolean);
  if (!identities.length) throw new Error("explorer_profile_not_found");
  const activeIdentities = identities.filter((identity) => identity.status === "active");
  const archivedIdentities = identities.filter((identity) => identity.status === "archived");
  const totalResources: Partial<Record<EpochResourceId, number>> = {};
  for (const identity of identities) {
    const balances = projection.resourceBalances[identity.agentId] || {};
    for (const [resourceId, amount] of Object.entries(balances)) {
      addResourceAmount(totalResources, resourceId as EpochResourceId, Number(amount || 0));
    }
  }
  const agentIds = new Set(identities.map((identity) => identity.agentId));
  const limit = Math.max(1, Math.min(Number(input.limit || 20), 100));
  const latestExplorerEvents = projection.events
    .filter((event) => Array.from(agentIds).some((agentId) => eventIsForAgent(event, agentId)))
    .slice(-limit)
    .reverse();
  return {
    explorerId,
    summary: {
      totalIdentities: identities.length,
      activeIdentities: activeIdentities.length,
      archivedIdentities: archivedIdentities.length,
      totalLegend: totalResources.legend || 0,
    },
    identitySlots: identitySlotsForExplorer(projection, explorerId),
    totalResources,
    identities,
    activeIdentities,
    archivedIdentities,
    latestEvents: latestExplorerEvents,
    publicPages: {
      explorer: `/epoch/explorer/${encodeURIComponent(explorerId)}`,
      agents: identities.map((identity) => `/epoch/agent/${encodeURIComponent(identity.agentId)}`),
      archives: archivedIdentities.map((identity) => `/epoch/archive/${encodeURIComponent(identity.agentId)}`),
    },
  };
}
