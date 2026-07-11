import {
  type EpochNpcMemory,
  type EpochOrganizationMembership,
  type EpochOrganizationPoliticsRecord,
  type EpochProjection,
  type EpochSocialHook,
} from "./gameCore.ts";
import { canonicalRegionIdFromInput } from "./runtimeInputRules.ts";
import {
  organizationMembershipsView,
  organizationPoliticsView,
  organizationsView,
  type EpochOrganizationView,
} from "./organizationReadModel.ts";
import {
  npcAssetsView,
  npcCareersView,
  npcHealthView,
  npcLocationsView,
  npcMemoriesView,
  socialHooksView,
  type EpochNpcAssetStateView,
  type EpochNpcCareerView,
  type EpochNpcHealthStateView,
  type EpochNpcLocationView,
} from "./npcStateReadModel.ts";
import {
  agentNpcBondsView,
  householdsView,
  npcRelationshipsView,
  type EpochAgentNpcBondView,
  type EpochHouseholdView,
  type EpochNpcRelationshipView,
} from "./relationshipReadModel.ts";

type ReadInput = Record<string, unknown>;

function inputString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

export interface EpochOrganizationInfo {
  readonly regionId?: string;
  readonly npcId?: string;
  readonly agentId?: string;
  readonly organizationId?: string;
  readonly organizations: readonly EpochOrganizationView[];
  readonly memberships: readonly EpochOrganizationMembership[];
}

export interface EpochOrganizationPoliticsInfo {
  readonly regionId?: string;
  readonly npcId?: string;
  readonly organizationId?: string;
  readonly politics: readonly EpochOrganizationPoliticsRecord[];
}

export interface EpochNpcCareerInfo {
  readonly regionId?: string;
  readonly npcId?: string;
  readonly careers: readonly EpochNpcCareerView[];
}

export interface EpochNpcLocationInfo {
  readonly regionId?: string;
  readonly npcId?: string;
  readonly locations: readonly EpochNpcLocationView[];
}

export interface EpochNpcAssetInfo {
  readonly regionId?: string;
  readonly npcId?: string;
  readonly assetStates: readonly EpochNpcAssetStateView[];
}

export interface EpochNpcHealthInfo {
  readonly regionId?: string;
  readonly npcId?: string;
  readonly healthStates: readonly EpochNpcHealthStateView[];
}

export interface EpochSocialHookInfo {
  readonly regionId?: string;
  readonly npcId?: string;
  readonly socialHooks: readonly EpochSocialHook[];
}

export interface EpochHouseholdInfo {
  readonly regionId?: string;
  readonly npcId?: string;
  readonly households: readonly EpochHouseholdView[];
}

export interface EpochNpcMemoryInfo {
  readonly regionId?: string;
  readonly npcId?: string;
  readonly memories: readonly EpochNpcMemory[];
}

export interface EpochNpcRelationshipInfo {
  readonly regionId?: string;
  readonly npcId?: string;
  readonly relationships: readonly EpochNpcRelationshipView[];
}

export interface EpochAgentNpcBondInfo {
  readonly agentId?: string;
  readonly npcId?: string;
  readonly regionId?: string;
  readonly bonds: readonly EpochAgentNpcBondView[];
}

export function organizationInfoView(projection: EpochProjection, input: ReadInput = {}): EpochOrganizationInfo {
  const requestedRegionId = inputString(input.regionId);
  const regionId = canonicalRegionIdFromInput(input.regionId);
  const npcId = inputString(input.npcId);
  const agentId = inputString(input.agentId);
  const organizationId = inputString(input.organizationId);
  return {
    regionId: requestedRegionId,
    npcId,
    agentId,
    organizationId,
    organizations: organizationsView(projection, { regionId, npcId, agentId, organizationId }),
    memberships: organizationMembershipsView(projection, { regionId, npcId, agentId, organizationId }),
  };
}

export function organizationPoliticsInfoView(
  projection: EpochProjection,
  input: ReadInput = {},
): EpochOrganizationPoliticsInfo {
  const requestedRegionId = inputString(input.regionId);
  const regionId = canonicalRegionIdFromInput(input.regionId);
  const npcId = inputString(input.npcId);
  const organizationId = inputString(input.organizationId);
  return {
    regionId: requestedRegionId,
    npcId,
    organizationId,
    politics: organizationPoliticsView(projection, { regionId, npcId, organizationId }),
  };
}

export function npcCareersInfoView(projection: EpochProjection, input: ReadInput = {}): EpochNpcCareerInfo {
  const npcId = inputString(input.npcId);
  return {
    regionId: inputString(input.regionId),
    npcId,
    careers: npcCareersView(projection, {
      regionId: canonicalRegionIdFromInput(input.regionId),
      npcId,
    }),
  };
}

export function npcLocationsInfoView(projection: EpochProjection, input: ReadInput = {}): EpochNpcLocationInfo {
  const npcId = inputString(input.npcId);
  return {
    regionId: inputString(input.regionId),
    npcId,
    locations: npcLocationsView(projection, {
      regionId: canonicalRegionIdFromInput(input.regionId),
      npcId,
    }),
  };
}

export function npcAssetsInfoView(projection: EpochProjection, input: ReadInput = {}): EpochNpcAssetInfo {
  const npcId = inputString(input.npcId);
  return {
    regionId: inputString(input.regionId),
    npcId,
    assetStates: npcAssetsView(projection, {
      regionId: canonicalRegionIdFromInput(input.regionId),
      npcId,
    }),
  };
}

export function npcHealthInfoView(projection: EpochProjection, input: ReadInput = {}): EpochNpcHealthInfo {
  const npcId = inputString(input.npcId);
  return {
    regionId: inputString(input.regionId),
    npcId,
    healthStates: npcHealthView(projection, {
      regionId: canonicalRegionIdFromInput(input.regionId),
      npcId,
    }),
  };
}

export function socialHooksInfoView(projection: EpochProjection, input: ReadInput = {}): EpochSocialHookInfo {
  const npcId = inputString(input.npcId);
  return {
    regionId: inputString(input.regionId),
    npcId,
    socialHooks: socialHooksView(projection, {
      regionId: canonicalRegionIdFromInput(input.regionId),
      npcId,
    }),
  };
}

export function householdsInfoView(projection: EpochProjection, input: ReadInput = {}): EpochHouseholdInfo {
  const npcId = inputString(input.npcId);
  return {
    regionId: inputString(input.regionId),
    npcId,
    households: householdsView(projection, {
      regionId: canonicalRegionIdFromInput(input.regionId),
      npcId,
    }),
  };
}

export function npcMemoriesInfoView(projection: EpochProjection, input: ReadInput = {}): EpochNpcMemoryInfo {
  const npcId = inputString(input.npcId);
  return {
    regionId: inputString(input.regionId),
    npcId,
    memories: npcMemoriesView(projection, {
      regionId: canonicalRegionIdFromInput(input.regionId),
      npcId,
    }),
  };
}

export function npcRelationshipsInfoView(projection: EpochProjection, input: ReadInput = {}): EpochNpcRelationshipInfo {
  const npcId = inputString(input.npcId);
  return {
    regionId: inputString(input.regionId),
    npcId,
    relationships: npcRelationshipsView(projection, {
      regionId: canonicalRegionIdFromInput(input.regionId),
      npcId,
    }),
  };
}

export function agentNpcBondsInfoView(projection: EpochProjection, input: ReadInput = {}): EpochAgentNpcBondInfo {
  const agentId = inputString(input.agentId);
  const npcId = inputString(input.npcId);
  return {
    agentId,
    npcId,
    regionId: inputString(input.regionId),
    bonds: agentNpcBondsView(projection, {
      agentId,
      npcId,
      regionId: canonicalRegionIdFromInput(input.regionId),
      kind: inputString(input.kind),
    }),
  };
}
