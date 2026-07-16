import type {
  EpochAnomalyEvent,
  EpochContestedObjective,
  EpochProjection,
  EpochResourceNode,
} from "./gameCore.ts";

export function objectivesView(
  projection: EpochProjection,
  input: { regionId?: string } = {},
): readonly EpochContestedObjective[] {
  const objectiveIds = input.regionId
    ? projection.objectiveIdsByRegion[input.regionId] || []
    : Object.keys(projection.contestedObjectives);
  return objectiveIds
    .map((objectiveId) => projection.contestedObjectives[objectiveId])
    .filter((objective): objective is EpochContestedObjective => Boolean(objective))
    .sort((left, right) => Number(left.status === "settled") - Number(right.status === "settled") || right.totalScore - left.totalScore);
}

export function resourceNodesView(
  projection: EpochProjection,
  input: { regionId?: string; agentId?: string; status?: string } = {},
): readonly EpochResourceNode[] {
  const nodeIds = input.regionId
    ? projection.resourceNodeIdsByRegion[input.regionId] || []
    : Object.keys(projection.resourceNodes);
  return nodeIds
    .map((nodeId) => projection.resourceNodes[nodeId])
    .filter((node): node is EpochResourceNode => Boolean(node))
    .filter((node) => !input.agentId || node.leaderboard.some((standing) => standing.agentId === input.agentId))
    .filter((node) => !input.status || node.status === input.status)
    .sort((left, right) => Number(left.status === "settled") - Number(right.status === "settled") || right.totalScore - left.totalScore || right.spawnedAt.localeCompare(left.spawnedAt));
}

export function anomaliesView(
  projection: EpochProjection,
  input: { regionId?: string; agentId?: string; status?: string } = {},
): readonly EpochAnomalyEvent[] {
  const anomalyIds = input.regionId
    ? projection.anomalyEventIdsByRegion[input.regionId] || []
    : Object.keys(projection.anomalyEvents);
  return anomalyIds
    .map((anomalyId) => projection.anomalyEvents[anomalyId])
    .filter((anomaly): anomaly is EpochAnomalyEvent => Boolean(anomaly))
    .filter((anomaly) => !input.agentId || anomaly.leaderboard.some((standing) => standing.agentId === input.agentId))
    .filter((anomaly) => !input.status || anomaly.status === input.status)
    .sort((left, right) => Number(left.status === "resolved") - Number(right.status === "resolved") || right.totalScore - left.totalScore || right.spawnedAt.localeCompare(left.spawnedAt));
}
