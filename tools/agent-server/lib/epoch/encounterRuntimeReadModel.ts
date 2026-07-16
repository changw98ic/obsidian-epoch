import {
  type EpochAnomalyEvent,
  type EpochContestedObjective,
  type EpochProjection,
  type EpochResourceNode,
} from "./gameCore.ts";
import { canonicalRegionIdFromInput } from "./runtimeInputRules.ts";
import {
  anomaliesView,
  objectivesView,
  resourceNodesView,
} from "./encounterReadModel.ts";

type ReadInput = Record<string, unknown>;

function inputString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

export interface EpochObjectivesInfo {
  readonly regionId?: string;
  readonly objectives: readonly EpochContestedObjective[];
}

export interface EpochResourceNodeInfo {
  readonly regionId?: string;
  readonly agentId?: string;
  readonly status?: string;
  readonly nodes: readonly EpochResourceNode[];
}

export interface EpochAnomalyInfo {
  readonly regionId?: string;
  readonly agentId?: string;
  readonly status?: string;
  readonly anomalies: readonly EpochAnomalyEvent[];
}

export function objectivesInfoView(projection: EpochProjection, input: ReadInput = {}): EpochObjectivesInfo {
  return {
    regionId: inputString(input.regionId),
    objectives: objectivesView(projection, {
      regionId: canonicalRegionIdFromInput(input.regionId),
    }),
  };
}

export function resourceNodesInfoView(
  projection: EpochProjection,
  input: ReadInput = {},
): EpochResourceNodeInfo {
  const agentId = inputString(input.agentId);
  const status = inputString(input.status);
  return {
    regionId: inputString(input.regionId),
    agentId,
    status,
    nodes: resourceNodesView(projection, {
      regionId: canonicalRegionIdFromInput(input.regionId),
      agentId,
      status,
    }),
  };
}

export function anomaliesInfoView(projection: EpochProjection, input: ReadInput = {}): EpochAnomalyInfo {
  const agentId = inputString(input.agentId);
  const status = inputString(input.status);
  return {
    regionId: inputString(input.regionId),
    agentId,
    status,
    anomalies: anomaliesView(projection, {
      regionId: canonicalRegionIdFromInput(input.regionId),
      agentId,
      status,
    }),
  };
}
