import {
  epochRelationshipMediaForKey,
  type EpochRelationshipAssetKey,
  type EpochRelationshipMedia,
} from "../relationshipAssets.ts";
import type {
  EpochAgentNpcBond,
  EpochHousehold,
  EpochNpcRelationship,
  EpochNpcRecord,
  EpochProjection,
  EpochRelationshipEdge,
} from "./gameCore.ts";

export interface EpochNpcRelationshipView extends EpochNpcRelationship {
  readonly media: EpochRelationshipMedia;
}

export interface EpochAgentNpcBondView extends EpochAgentNpcBond {
  readonly npc: EpochNpcRecord;
  readonly media: EpochRelationshipMedia;
}

export interface EpochHouseholdView extends EpochHousehold {
  readonly memberNames: readonly string[];
  readonly summary: string;
  readonly media: EpochRelationshipMedia;
}

export interface EpochRelationshipEdgeView extends EpochRelationshipEdge {
  readonly media: EpochRelationshipMedia;
}

export function relationshipMedia(relationshipKey: EpochRelationshipAssetKey): EpochRelationshipMedia {
  const media = epochRelationshipMediaForKey(relationshipKey);
  if (!media) throw new Error(`epoch_relationship_media_missing:${relationshipKey}`);
  return media;
}

export function withRelationshipEdgeMedia(relationship: EpochRelationshipEdge): EpochRelationshipEdgeView {
  return {
    ...relationship,
    media: relationshipMedia(relationship.kind),
  };
}

export function relationshipsView(
  projection: EpochProjection,
  input: { agentId?: string; kind?: string } = {},
): readonly EpochRelationshipEdgeView[] {
  const relationshipIds = input.agentId
    ? projection.relationshipIdsByAgent[input.agentId] || []
    : Object.keys(projection.relationshipEdges);
  return relationshipIds
    .map((relationshipId) => projection.relationshipEdges[relationshipId])
    .filter(Boolean)
    .filter((relationship) => !input.kind || relationship.kind === input.kind)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt) || left.relationshipId.localeCompare(right.relationshipId))
    .map(withRelationshipEdgeMedia);
}

export function withNpcRelationshipMedia(relationship: EpochNpcRelationship): EpochNpcRelationshipView {
  return {
    ...relationship,
    media: relationshipMedia(relationship.kind),
  };
}

export function npcRelationshipsView(
  projection: EpochProjection,
  input: { regionId?: string; npcId?: string } = {},
): readonly EpochNpcRelationshipView[] {
  const relationshipIds = input.npcId
    ? projection.npcRelationshipIdsByNpc[input.npcId] || []
    : input.regionId
      ? projection.npcRelationshipIdsByRegion[input.regionId] || []
      : Object.keys(projection.npcRelationships);
  return relationshipIds
    .map((relationshipId) => projection.npcRelationships[relationshipId])
    .filter(Boolean)
    .sort((left, right) => right.recordedAt.localeCompare(left.recordedAt) || left.relationshipId.localeCompare(right.relationshipId))
    .map(withNpcRelationshipMedia);
}

export function withAgentNpcBondMedia(
  projection: EpochProjection,
  bond: EpochAgentNpcBond,
): EpochAgentNpcBondView | undefined {
  const npc = projection.npcs[bond.npcId];
  if (!npc) return undefined;
  return {
    ...bond,
    npc,
    media: relationshipMedia(bond.kind),
  };
}

export function agentNpcBondsView(
  projection: EpochProjection,
  input: { agentId?: string; npcId?: string; regionId?: string; kind?: string } = {},
): readonly EpochAgentNpcBondView[] {
  const bondIds = input.agentId
    ? projection.agentNpcBondIdsByAgent[input.agentId] || []
    : input.npcId
      ? projection.agentNpcBondIdsByNpc[input.npcId] || []
      : input.regionId
        ? projection.agentNpcBondIdsByRegion[input.regionId] || []
        : Object.keys(projection.agentNpcBonds);
  return bondIds
    .map((bondId) => projection.agentNpcBonds[bondId])
    .filter(Boolean)
    .filter((bond) => !input.agentId || bond.agentId === input.agentId)
    .filter((bond) => !input.npcId || bond.npcId === input.npcId)
    .filter((bond) => !input.regionId || bond.npcRegionId === input.regionId)
    .filter((bond) => !input.kind || bond.kind === input.kind)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt) || left.bondId.localeCompare(right.bondId))
    .map((bond) => withAgentNpcBondMedia(projection, bond))
    .filter((bond): bond is EpochAgentNpcBondView => Boolean(bond));
}

export function npcDisplayName(projection: EpochProjection, npcId: string): string {
  return projection.npcs[npcId]?.displayName || npcId;
}

export function householdMemberNames(projection: EpochProjection, household: EpochHousehold): readonly string[] {
  return household.memberNpcIds.map((npcId) => npcDisplayName(projection, npcId));
}

export function householdSummary(household: EpochHousehold, memberNames: readonly string[]): string {
  const names = memberNames.length ? memberNames.join("、") : household.memberNpcIds.join("、");
  if (household.reason === "lifecycle_marriage") {
    return memberNames.length >= 2
      ? `${memberNames[0]} 与 ${memberNames[1]} 成为伴侣家庭。`
      : `${names} 建立伴侣家庭。`;
  }
  if (household.reason === "lifecycle_child") {
    return `${names} 有了新的家庭成员。`;
  }
  return `${names} 组成家庭记录。`;
}

export function withHouseholdMedia(projection: EpochProjection, household: EpochHousehold): EpochHouseholdView {
  const memberNames = householdMemberNames(projection, household);
  return {
    ...household,
    memberNames,
    summary: householdSummary(household, memberNames),
    media: relationshipMedia("household"),
  };
}

export function householdsView(
  projection: EpochProjection,
  input: { regionId?: string; npcId?: string } = {},
): readonly EpochHouseholdView[] {
  const householdIds = input.npcId
    ? projection.householdIdsByNpc[input.npcId] || []
    : input.regionId
      ? projection.householdIdsByRegion[input.regionId] || []
      : Object.keys(projection.households);
  return householdIds
    .map((householdId) => projection.households[householdId])
    .filter(Boolean)
    .sort((left, right) => right.recordedAt.localeCompare(left.recordedAt) || left.householdId.localeCompare(right.householdId))
    .map((household) => withHouseholdMedia(projection, household));
}
