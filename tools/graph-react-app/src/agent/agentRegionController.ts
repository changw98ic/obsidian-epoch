import type {
  EpochAnomalyEvent,
  EpochContestedObjective,
  EpochDiplomacyRecord,
  EpochMessageRecord,
  EpochRegionInfo,
  EpochResourceNode,
  EpochSeasonCampaign,
} from "../types";

export interface AgentRegionSnapshot {
  readonly region: EpochRegionInfo;
  readonly regionMessages: readonly EpochMessageRecord[];
  readonly objectives: readonly EpochContestedObjective[];
  readonly resourceNodes: readonly EpochResourceNode[];
  readonly anomalies: readonly EpochAnomalyEvent[];
  readonly seasons: readonly EpochSeasonCampaign[];
  readonly diplomacy: readonly EpochDiplomacyRecord[];
}

export interface AgentRegionSnapshotOptions {
  readonly messages?: readonly EpochMessageRecord[];
  readonly objectives?: readonly EpochContestedObjective[];
  readonly resourceNodes?: readonly EpochResourceNode[];
  readonly anomalies?: readonly EpochAnomalyEvent[];
  readonly seasons?: readonly EpochSeasonCampaign[];
  readonly diplomacy?: readonly EpochDiplomacyRecord[];
}

export interface AgentRegionSnapshotCommit {
  readonly setRegion: (region: EpochRegionInfo) => void;
  readonly setRegionMessages: (messages: readonly EpochMessageRecord[]) => void;
  readonly setObjectives: (objectives: readonly EpochContestedObjective[]) => void;
  readonly setResourceNodes: (resourceNodes: readonly EpochResourceNode[]) => void;
  readonly setAnomalies: (anomalies: readonly EpochAnomalyEvent[]) => void;
  readonly setSeasons: (seasons: readonly EpochSeasonCampaign[]) => void;
  readonly setDiplomacy?: (diplomacy: readonly EpochDiplomacyRecord[]) => void;
}

export function createAgentRegionSnapshot(
  region: EpochRegionInfo,
  options: AgentRegionSnapshotOptions = {},
): AgentRegionSnapshot {
  const regionMessages = options.messages || region.messages;
  const objectives = options.objectives || region.objectives;
  const resourceNodes = options.resourceNodes || region.resourceNodes;
  const anomalies = options.anomalies || region.anomalies;
  const seasons = options.seasons || region.seasons;
  const diplomacy = options.diplomacy || region.diplomacy;
  const hasSliceOverride = Boolean(
    options.messages
      || options.objectives
      || options.resourceNodes
      || options.anomalies
      || options.seasons
      || options.diplomacy,
  );
  const visibleRegion = hasSliceOverride
    ? { ...region, messages: regionMessages, objectives, resourceNodes, anomalies, seasons, diplomacy }
    : region;
  return {
    region: visibleRegion,
    regionMessages,
    objectives,
    resourceNodes,
    anomalies,
    seasons,
    diplomacy,
  };
}

export function applyAgentRegionSnapshot(
  snapshot: AgentRegionSnapshot,
  commit: AgentRegionSnapshotCommit,
) {
  commit.setRegion(snapshot.region);
  commit.setRegionMessages(snapshot.regionMessages);
  commit.setObjectives(snapshot.objectives);
  commit.setResourceNodes(snapshot.resourceNodes);
  commit.setAnomalies(snapshot.anomalies);
  commit.setSeasons(snapshot.seasons);
  commit.setDiplomacy?.(snapshot.diplomacy);
}
