import { type EpochProjection } from "./gameCore.ts";
import {
  agentMemoryView,
  type EpochAgentMemoryInfo,
} from "./agentMemoryReadModel.ts";
import {
  explorerProfileView,
  type EpochExplorerProfileInfo,
} from "./explorerProfileReadModel.ts";
import {
  identityArchiveView,
  type EpochIdentityArchiveInfo,
} from "./identityArchiveReadModel.ts";
import { loreTargetStatusesView } from "./loreReadModel.ts";
import {
  personalMigrationSummaryView,
  type EpochPersonalMigrationSummary,
} from "./personalMigrationReadModel.ts";
import { canonicalRegionIdFromInput } from "./runtimeInputRules.ts";

export type { EpochAgentMemoryInfo, EpochAgentMemoryItem, EpochAgentMemoryLayer } from "./agentMemoryReadModel.ts";
export type { EpochExplorerProfileInfo, EpochExplorerProfileSummary } from "./explorerProfileReadModel.ts";
export type { EpochIdentityArchiveInfo } from "./identityArchiveReadModel.ts";
export type {
  EpochPersonalMigrationDisposition,
  EpochPersonalMigrationSummary,
  EpochPersonalMigrationSummaryItem,
} from "./personalMigrationReadModel.ts";

type ReadInput = Record<string, unknown>;

function inputString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

export function agentMemoryInfoView(projection: EpochProjection, input: ReadInput = {}): EpochAgentMemoryInfo {
  return agentMemoryView(projection, {
    agentId: inputString(input.agentId),
    regionId: canonicalRegionIdFromInput(input.regionId),
    limit: Number(input.limit || 8),
  });
}

export function personalMigrationInfoView(
  projection: EpochProjection,
  input: ReadInput = {},
): EpochPersonalMigrationSummary {
  return personalMigrationSummaryView(loreTargetStatusesView(projection, { limit: 100 }), {
    agentId: inputString(input.agentId),
    explorerId: inputString(input.explorerId),
    limit: Number(input.limit || 8),
  });
}

export function identityArchiveInfoView(
  projection: EpochProjection,
  input: ReadInput = {},
): EpochIdentityArchiveInfo {
  return identityArchiveView(projection, {
    agentId: inputString(input.agentId),
    limit: Number(input.limit || 30),
  });
}

export function explorerProfileInfoView(
  projection: EpochProjection,
  input: ReadInput = {},
): EpochExplorerProfileInfo {
  return explorerProfileView(projection, {
    explorerId: inputString(input.explorerId),
    limit: Number(input.limit || 30),
  });
}
