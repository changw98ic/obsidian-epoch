import type {
  EpochBounty,
  EpochProjection,
} from "./gameCore.ts";
import { bountiesView, partyRunsView, type EpochPartyRunView } from "./bountyPartyReadModel.ts";
export type { EpochPartyRunView } from "./bountyPartyReadModel.ts";
import { raidsView, type EpochRaidInfo } from "./regionConflictReadModel.ts";
import { canonicalRegionIdFromInput } from "./runtimeInputRules.ts";

type AnyRecord = Record<string, unknown>;

export type { EpochRaidInfo } from "./regionConflictReadModel.ts";

export interface EpochPartyRunInfo {
  readonly regionId?: string;
  readonly agentId?: string;
  readonly status?: string;
  readonly partyRuns: readonly EpochPartyRunView[];
}

export interface EpochBountyInfo {
  readonly regionId?: string;
  readonly agentId?: string;
  readonly status?: string;
  readonly bounties: readonly EpochBounty[];
}

export function bountiesInfoView(
  projection: EpochProjection,
  input: AnyRecord = {},
): EpochBountyInfo {
  return {
    regionId: typeof input.regionId === "string" ? input.regionId : undefined,
    agentId: typeof input.agentId === "string" ? input.agentId : undefined,
    status: typeof input.status === "string" ? input.status : undefined,
    bounties: bountiesView(projection, {
      regionId: canonicalRegionIdFromInput(input.regionId),
      agentId: typeof input.agentId === "string" ? input.agentId : undefined,
      status: typeof input.status === "string" ? input.status : undefined,
    }),
  };
}

export function partyRunsInfoView(
  projection: EpochProjection,
  input: AnyRecord = {},
): EpochPartyRunInfo {
  return {
    regionId: typeof input.regionId === "string" ? input.regionId : undefined,
    agentId: typeof input.agentId === "string" ? input.agentId : undefined,
    status: typeof input.status === "string" ? input.status : undefined,
    partyRuns: partyRunsView(projection, {
      regionId: canonicalRegionIdFromInput(input.regionId),
      agentId: typeof input.agentId === "string" ? input.agentId : undefined,
      status: typeof input.status === "string" ? input.status : undefined,
    }),
  };
}

export function raidsInfoView(
  projection: EpochProjection,
  input: AnyRecord = {},
): EpochRaidInfo {
  return {
    regionId: typeof input.regionId === "string" ? input.regionId : undefined,
    raids: raidsView(projection, {
      regionId: canonicalRegionIdFromInput(input.regionId),
      agentId: typeof input.agentId === "string" ? input.agentId : undefined,
    }),
  };
}
