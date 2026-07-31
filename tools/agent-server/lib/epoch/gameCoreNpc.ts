import {
  type EpochEvent,
} from "./events.ts";
import { initialActorNeeds, initialActorLifeGoal } from "./actorNeedsRules.ts";
import { npcCandidateRumorAdmission } from "./npcCandidateRules.ts";
import {
  type MutableProjection,
  type EpochProjection,
  type EpochNpcRelationship,
  type EpochAgentNpcBond,
  type EpochNpcMemory,
  type EpochHousehold,
  type EpochNpcCareerRecord,
  type EpochNpcLocationRecord,
  type EpochNpcAssetState,
  type EpochNpcHealthState,
  uniqueValues,
} from "./gameCore.ts";

export function applyNpcEvent(
  mutable: MutableProjection,
  event: EpochEvent,
  projection: EpochProjection,
  currentWorldMinute: number,
): void {
  switch (event.eventType) {
    case "npc_candidate_submitted": {
      mutable.npcCandidates[event.payload.candidateId] = {
        candidateId: event.payload.candidateId,
        agentId: event.payload.agentId,
        explorerId: event.payload.explorerId,
        regionId: event.payload.regionId,
        displayName: event.payload.displayName,
        npcKey: event.payload.npcKey,
        traits: event.payload.traits,
        storyEvidence: event.payload.storyEvidence,
        decision: event.payload.decision,
        status: event.payload.status,
        reviewLevel: event.payload.reviewLevel || "clear",
        reviewScore: event.payload.reviewScore || 0,
        reviewFlags: event.payload.reviewFlags || [],
        ipSimilarity: event.payload.ipSimilarity,
        flavorPublication: event.payload.flavorPublication,
        rumorAdmissionReview: event.payload.rumorAdmissionReview || npcCandidateRumorAdmission({
          displayName: event.payload.displayName,
          regionId: event.payload.regionId,
          traits: event.payload.traits || [],
          storyEvidence: event.payload.storyEvidence,
        }),
        abilityEffectCluster: event.payload.abilityEffectCluster,
        submittedAt: event.createdAt,
        canonicalNpcId: event.payload.canonicalNpcId,
        rejectionReason: event.payload.rejectionReason,
        sourceEventId: event.payload.sourceEventId,
        experimentId: event.payload.experimentId,
        mainRuleReview: event.payload.mainRuleReview,
      };
      mutable.npcCandidateIdsByRegion[event.payload.regionId] = uniqueValues([
        ...(mutable.npcCandidateIdsByRegion[event.payload.regionId] || []),
        event.payload.candidateId,
      ]);
      mutable.npcCandidateIdsByAgent[event.payload.agentId] = uniqueValues([
        ...(mutable.npcCandidateIdsByAgent[event.payload.agentId] || []),
        event.payload.candidateId,
      ]);
      break;
    }
    case "npc_candidate_reviewed": {
      const candidate = mutable.npcCandidates[event.payload.candidateId];
      if (!candidate) throw new Error("npc_candidate_not_found");
      mutable.npcCandidates[event.payload.candidateId] = {
        ...candidate,
        decision: event.payload.decision,
        status: event.payload.status,
        canonicalNpcId: event.payload.canonicalNpcId,
        rejectionReason: event.payload.rejectionReason,
        reviewedBy: event.payload.reviewedBy,
        reviewedAt: event.createdAt,
        reviewNote: event.payload.reviewNote,
      };
      break;
    }
    case "npc_canonicalized": {
      const worldMinute = currentWorldMinute;
      mutable.npcs[event.payload.npcId] = {
        npcId: event.payload.npcId,
        npcKey: event.payload.npcKey,
        displayName: event.payload.displayName,
        regionId: event.payload.regionId,
        traits: event.payload.traits,
        needs: initialActorNeeds("npc", event.payload.npcId, worldMinute),
        lifeGoal: initialActorLifeGoal({
          actorKind: "npc",
          actorId: event.payload.npcId,
          descriptor: event.payload.displayName,
          traits: event.payload.traits,
          worldMinute,
        }),
        createdAt: event.createdAt,
        lifecycle: [],
      };
      mutable.npcIdsByKey[event.payload.npcKey] = event.payload.npcId;
      break;
    }
    case "npc_lifecycle_recorded": {
      const npc = mutable.npcs[event.payload.npcId];
      if (!npc) throw new Error("npc_not_found");
      mutable.npcs[event.payload.npcId] = {
        ...npc,
        lifecycle: [
          ...npc.lifecycle,
          {
            occurredAt: event.payload.occurredAt,
            changes: event.payload.changes,
            sourceEventIds: event.payload.sourceEventIds,
          },
        ],
      };
      break;
    }
    case "npc_relationship_recorded": {
      const payload = event.payload;
      const relationship: EpochNpcRelationship = {
        relationshipId: payload.relationshipId,
        sourceNpcId: payload.sourceNpcId,
        targetNpcId: payload.targetNpcId,
        sourceRegionId: payload.sourceRegionId,
        targetRegionId: payload.targetRegionId,
        kind: payload.kind,
        score: payload.score,
        reason: payload.reason,
        sourceEventIds: payload.sourceEventIds,
        recordedAt: payload.recordedAt,
      };
      mutable.npcRelationships[payload.relationshipId] = relationship;
      for (const npcId of [payload.sourceNpcId, payload.targetNpcId]) {
        mutable.npcRelationshipIdsByNpc[npcId] = [
          ...(mutable.npcRelationshipIdsByNpc[npcId] || []),
          payload.relationshipId,
        ].filter((relationshipId, index, relationshipIds) => relationshipIds.indexOf(relationshipId) === index);
      }
      for (const regionId of [payload.sourceRegionId, payload.targetRegionId]) {
        mutable.npcRelationshipIdsByRegion[regionId] = [
          ...(mutable.npcRelationshipIdsByRegion[regionId] || []),
          payload.relationshipId,
        ].filter((relationshipId, index, relationshipIds) => relationshipIds.indexOf(relationshipId) === index);
      }
      break;
    }
    case "agent_npc_bond_updated": {
      const payload = event.payload;
      const bond: EpochAgentNpcBond = {
        bondId: payload.bondId,
        agentId: payload.agentId,
        explorerId: payload.explorerId,
        npcId: payload.npcId,
        npcRegionId: payload.npcRegionId,
        kind: payload.kind,
        score: payload.scoreAfter,
        previousScore: payload.previousScore,
        scoreDelta: payload.scoreDelta,
        focusSpent: payload.focusSpent,
        reason: payload.reason,
        updatedAt: payload.updatedAt,
      };
      mutable.agentNpcBonds[payload.bondId] = bond;
      mutable.agentNpcBondIdsByAgent[payload.agentId] = [
        ...(mutable.agentNpcBondIdsByAgent[payload.agentId] || []),
        payload.bondId,
      ].filter((bondId, index, bondIds) => bondIds.indexOf(bondId) === index);
      mutable.agentNpcBondIdsByNpc[payload.npcId] = [
        ...(mutable.agentNpcBondIdsByNpc[payload.npcId] || []),
        payload.bondId,
      ].filter((bondId, index, bondIds) => bondIds.indexOf(bondId) === index);
      mutable.agentNpcBondIdsByRegion[payload.npcRegionId] = [
        ...(mutable.agentNpcBondIdsByRegion[payload.npcRegionId] || []),
        payload.bondId,
      ].filter((bondId, index, bondIds) => bondIds.indexOf(bondId) === index);
      break;
    }
    case "npc_memory_recorded": {
      const payload = event.payload;
      const memory: EpochNpcMemory = {
        memoryId: payload.memoryId,
        npcId: payload.npcId,
        regionId: payload.regionId,
        summary: payload.summary,
        importance: payload.importance,
        sourceEventIds: payload.sourceEventIds,
        recordedAt: payload.recordedAt,
      };
      mutable.npcMemories[payload.memoryId] = memory;
      mutable.npcMemoryIdsByNpc[payload.npcId] = [
        ...(mutable.npcMemoryIdsByNpc[payload.npcId] || []),
        payload.memoryId,
      ].filter((memoryId, index, memoryIds) => memoryIds.indexOf(memoryId) === index);
      mutable.npcMemoryIdsByRegion[payload.regionId] = [
        ...(mutable.npcMemoryIdsByRegion[payload.regionId] || []),
        payload.memoryId,
      ].filter((memoryId, index, memoryIds) => memoryIds.indexOf(memoryId) === index);
      break;
    }
    case "npc_household_recorded": {
      const payload = event.payload;
      const household: EpochHousehold = {
        householdId: payload.householdId,
        regionId: payload.regionId,
        memberNpcIds: payload.memberNpcIds,
        reason: payload.reason,
        sourceEventIds: payload.sourceEventIds,
        recordedAt: payload.recordedAt,
      };
      mutable.households[payload.householdId] = household;
      for (const npcId of payload.memberNpcIds) {
        mutable.householdIdsByNpc[npcId] = [
          ...(mutable.householdIdsByNpc[npcId] || []),
          payload.householdId,
        ].filter((householdId, index, householdIds) => householdIds.indexOf(householdId) === index);
      }
      mutable.householdIdsByRegion[payload.regionId] = [
        ...(mutable.householdIdsByRegion[payload.regionId] || []),
        payload.householdId,
      ].filter((householdId, index, householdIds) => householdIds.indexOf(householdId) === index);
      break;
    }
    case "npc_career_changed": {
      const payload = event.payload;
      const career: EpochNpcCareerRecord = {
        careerId: payload.careerId,
        npcId: payload.npcId,
        regionId: payload.regionId,
        title: payload.title,
        status: payload.status,
        organizationId: payload.organizationId,
        sourceEventIds: payload.sourceEventIds,
        recordedAt: payload.recordedAt,
      };
      mutable.npcCareerRecords[payload.careerId] = career;
      mutable.npcCareerIdsByNpc[payload.npcId] = [
        ...(mutable.npcCareerIdsByNpc[payload.npcId] || []),
        payload.careerId,
      ].filter((careerId, index, careerIds) => careerIds.indexOf(careerId) === index);
      mutable.npcCareerIdsByRegion[payload.regionId] = [
        ...(mutable.npcCareerIdsByRegion[payload.regionId] || []),
        payload.careerId,
      ].filter((careerId, index, careerIds) => careerIds.indexOf(careerId) === index);
      break;
    }
    case "npc_location_changed": {
      const payload = event.payload;
      const npc = mutable.npcs[payload.npcId];
      if (!npc) throw new Error("npc_not_found");
      const location: EpochNpcLocationRecord = {
        locationId: payload.locationId,
        npcId: payload.npcId,
        fromRegionId: payload.fromRegionId,
        toRegionId: payload.toRegionId,
        reason: payload.reason,
        sourceEventIds: payload.sourceEventIds,
        recordedAt: payload.recordedAt,
      };
      mutable.npcLocationRecords[payload.locationId] = location;
      mutable.npcs[payload.npcId] = {
        ...npc,
        regionId: payload.toRegionId,
      };
      mutable.npcLocationIdsByNpc[payload.npcId] = [
        ...(mutable.npcLocationIdsByNpc[payload.npcId] || []),
        payload.locationId,
      ].filter((locationId, index, locationIds) => locationIds.indexOf(locationId) === index);
      for (const regionId of [payload.fromRegionId, payload.toRegionId]) {
        mutable.npcLocationIdsByRegion[regionId] = [
          ...(mutable.npcLocationIdsByRegion[regionId] || []),
          payload.locationId,
        ].filter((locationId, index, locationIds) => locationIds.indexOf(locationId) === index);
      }
      break;
    }
    case "npc_asset_changed": {
      const payload = event.payload;
      const asset: EpochNpcAssetState = {
        assetId: payload.assetId,
        npcId: payload.npcId,
        regionId: payload.regionId,
        assetKey: payload.assetKey,
        delta: payload.delta,
        balanceAfter: payload.balanceAfter,
        reason: payload.reason,
        sourceEventIds: payload.sourceEventIds,
        recordedAt: payload.recordedAt,
      };
      mutable.npcAssetStates[payload.assetId] = asset;
      mutable.npcAssetIdsByNpc[payload.npcId] = [
        ...(mutable.npcAssetIdsByNpc[payload.npcId] || []),
        payload.assetId,
      ].filter((assetId, index, assetIds) => assetIds.indexOf(assetId) === index);
      mutable.npcAssetIdsByRegion[payload.regionId] = [
        ...(mutable.npcAssetIdsByRegion[payload.regionId] || []),
        payload.assetId,
      ].filter((assetId, index, assetIds) => assetIds.indexOf(assetId) === index);
      mutable.npcAssetBalancesByNpc[payload.npcId] = {
        ...(mutable.npcAssetBalancesByNpc[payload.npcId] || {}),
        [payload.assetKey]: payload.balanceAfter,
      };
      break;
    }
    case "npc_health_recorded": {
      const payload = event.payload;
      const health: EpochNpcHealthState = {
        healthId: payload.healthId,
        npcId: payload.npcId,
        regionId: payload.regionId,
        status: payload.status,
        severity: payload.severity,
        reason: payload.reason,
        sourceEventIds: payload.sourceEventIds,
        recordedAt: payload.recordedAt,
      };
      mutable.npcHealthStates[payload.healthId] = health;
      mutable.npcHealthIdsByNpc[payload.npcId] = [
        ...(mutable.npcHealthIdsByNpc[payload.npcId] || []),
        payload.healthId,
      ].filter((healthId, index, healthIds) => healthIds.indexOf(healthId) === index);
      mutable.npcHealthIdsByRegion[payload.regionId] = [
        ...(mutable.npcHealthIdsByRegion[payload.regionId] || []),
        payload.healthId,
      ].filter((healthId, index, healthIds) => healthIds.indexOf(healthId) === index);
      break;
    }
  }
}
