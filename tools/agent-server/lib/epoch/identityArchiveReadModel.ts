import type {
  EpochAgentIdentity,
  EpochProjection,
} from "./gameCore.ts";
import { latestEvents } from "./progressReadModel.ts";
import type { EpochResourceId } from "./protocol.ts";

export interface EpochIdentityArchiveInfo {
  readonly agentId?: string;
  readonly explorerId?: string;
  readonly identity?: EpochAgentIdentity;
  readonly previousIdentity?: EpochAgentIdentity;
  readonly nextIdentity?: EpochAgentIdentity;
  readonly lineage: readonly string[];
  readonly lineageIdentities: readonly EpochAgentIdentity[];
  readonly resources: Partial<Record<EpochResourceId, number>>;
  readonly latestEvents: readonly EpochProjection["events"][number][];
  readonly archiveEvent?: EpochProjection["events"][number];
  readonly reincarnationEvent?: EpochProjection["events"][number];
  readonly publicPages: {
    readonly agent?: string;
    readonly archive?: string;
    readonly nextAgent?: string;
  };
}

export function identityArchiveView(
  projection: EpochProjection,
  input: { agentId?: string; limit?: number },
): EpochIdentityArchiveInfo {
  const agentId = input.agentId;
  const identity = agentId ? projection.identities[agentId] : undefined;
  const explorerId = identity?.explorerId;
  const lineage = explorerId ? projection.lineage[explorerId] || [] : [];
  const lineageIdentities = lineage.map((lineageAgentId) => projection.identities[lineageAgentId]).filter(Boolean);
  const latestIdentityEvents = agentId
    ? latestEvents(projection, { agentId, limit: input.limit || 30 })
    : [];
  const archiveEvent = agentId
    ? [...projection.events].reverse().find((event) => event.eventType === "identity_archived" && event.aggregateId === agentId)
    : undefined;
  const reincarnationEvent = agentId
    ? [...projection.events].reverse().find((event) => event.eventType === "reincarnation_issued" && event.aggregateId === agentId)
    : undefined;
  const nextIdentity = identity?.nextAgentId ? projection.identities[identity.nextAgentId] : undefined;
  return {
    agentId,
    explorerId,
    identity,
    previousIdentity: identity?.previousAgentId ? projection.identities[identity.previousAgentId] : undefined,
    nextIdentity,
    lineage,
    lineageIdentities,
    resources: agentId ? projection.resourceBalances[agentId] || {} : {},
    latestEvents: latestIdentityEvents,
    archiveEvent,
    reincarnationEvent,
    publicPages: {
      agent: agentId ? `/epoch/agent/${encodeURIComponent(agentId)}` : undefined,
      archive: agentId ? `/epoch/archive/${encodeURIComponent(agentId)}` : undefined,
      nextAgent: nextIdentity ? `/epoch/agent/${encodeURIComponent(nextIdentity.agentId)}` : undefined,
    },
  };
}
