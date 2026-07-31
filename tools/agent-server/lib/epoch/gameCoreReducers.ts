/**
 * Domain-specific reducers for applyEvent().
 *
 * Each apply*Event function mutates a MutableProjection in-place for its
 * domain's event types. The dispatch table at the bottom routes events to
 * the correct reducer.
 */
import type { EpochEvent } from "./events.ts";
import {
  type EpochProjection,
  type MutableProjection,
  type EpochOrganizationMemberType,
  type EpochNpcRelationship,
  type EpochAgentNpcBond,
  type EpochNpcMemory,
  type EpochHousehold,
  type EpochNpcCareerRecord,
  type EpochNpcLocationRecord,
  type EpochNpcAssetState,
  type EpochNpcHealthState,
  type EpochRaceCompletion,
  type EpochObjectiveStanding,
  type EpochResourceNodeStanding,
  type EpochAnomalyStanding,
  type EpochSeasonPhaseEvent,
  type EpochSeasonAgentStanding,
  type EpochSeasonContribution,
  type EpochSeasonObjective,
  type EpochPartyMember,
  type EpochPartyJoinRequest,
  type EpochTurnResolution,
  type EpochHostedActionRecord,
  type EpochOrganizationMembership,
  type EpochOrganizationPoliticsRecord,
  type EpochOrganizationUpgrade,
  type EpochOrganizationBudget,
  type EpochOrganizationBudgetVote,
} from "./gameCoreTypes.ts";
import {
  type EpochCommandContext,
  type EpochResourceId,
  stableKey,
  normalizeTrustClass,
} from "./protocol.ts";
import {
  type EpochOrganizationUpgradeKey,
} from "./organizationTreasuryRules.ts";
import {
  type AttributeScoreBalance,
  copyAttributeScores,
} from "./attributeRules.ts";
import { copyBalance } from "./resourceRules.ts";
import {
  advanceActorNeeds,
  initialActorLifeGoal,
  initialActorNeeds,
} from "./actorNeedsRules.ts";
import {
  requireIdentity,
} from "./identityProjectionRules.ts";
import {
  LIFETIME_REASON_IDENTITY_VIABILITY_ACCELERATION,
  LIFETIME_REASON_IDENTITY_VIABILITY_SOCIAL_DEATH,
} from "./journeyViabilityRules.ts";
import {
  npcCandidateRumorAdmission,
} from "./npcCandidateRules.ts";
import {
  organizationBudgetApprovalThreshold,
  organizationBudgetRejectionThreshold,
} from "./organizationTreasuryRules.ts";
import {
  addRegionActivity,
  addRegionActivityForEvent,
  addRegionActivitiesForEventRegions,
} from "./regionActivityRules.ts";
import {
  contentStatusForResolution,
  updateMessageModerationStatus,
  updateNewsModerationStatus,
} from "./moderationRiskRules.ts";
import {
  normalizeDowntimeRegionId,
  downtimeDiaryEntry,
} from "./downtimeRules.ts";
import {
  normalizeMarketRegionId,
} from "./marketTradeRules.ts";
import {
  directTradeAssetFromPayload,
  directTradeAssetLabel,
} from "./directTradeRules.ts";
import {
  trustedSeasonScoreDelta,
  addSeasonTrustScore,
  dominantSeasonTrustClass,
  normalizeSeasonTrustBreakdown,
} from "./seasonCampaignRules.ts";

// --- Types used by some reducers ---
// ============================================================================
// IDENTITY REDUCER
// ============================================================================

export function applyIdentityEvent(
  mutable: MutableProjection,
  event: EpochEvent,
  projection: EpochProjection,
): void {
  switch (event.eventType) {
    case "identity_issued": {
      const payload = event.payload;
      const worldMinute = currentProjectionWorldMinute(projection);
      const initialViability = payload.identityViability;
      if (!initialViability) throw new Error("identity_issued_viability_required");
      if (!payload.expectedLifePattern) throw new Error("identity_issued_expected_life_pattern_required");
      mutable.identities[payload.agentId] = {
        agentId: payload.agentId,
        explorerId: payload.explorerId,
        identityName: payload.identityName,
        generation: payload.generation,
        status: payload.status,
        previousAgentId: payload.previousAgentId,
        ...(payload.inheritance ? { inheritance: payload.inheritance } : {}),
        lifetime: payload.lifetime,
        personality: {
          traits: payload.personalityTraits ?? [],
          driftIds: [],
        },
        needs: initialActorNeeds("agent", payload.agentId, worldMinute),
        lifeGoal: initialActorLifeGoal({
          actorKind: "agent",
          actorId: payload.agentId,
          descriptor: payload.identityName,
          traits: payload.personalityTraits ?? [],
          worldMinute,
        }),
        createdAt: event.createdAt,
        identityViability: initialViability,
        expectedLifePattern: payload.expectedLifePattern,
        ...(payload.strategyDisposition
          ? { strategyDisposition: payload.strategyDisposition }
          : {}),
      };
      mutable.lineage[payload.explorerId] = [...(mutable.lineage[payload.explorerId] || []), payload.agentId];
      mutable.agentCustody[payload.agentId] = {
        agentId: payload.agentId,
        custodyStatus: "free",
        reason: "identity_issued",
        changedAt: event.createdAt,
      };
      break;
    }
    case "personality_drift_proposed": {
      const payload = event.payload;
      mutable.personalityDrifts[payload.driftId] = {
        driftId: payload.driftId,
        agentId: payload.agentId,
        explorerId: payload.explorerId,
        sourceEventId: payload.sourceEventId,
        trigger: payload.trigger,
        suggestedTrait: payload.suggestedTrait,
        summary: payload.summary,
        status: "proposed",
        proposedAt: payload.proposedAt,
      };
      mutable.personalityDriftIdsByAgent[payload.agentId] = [
        ...(mutable.personalityDriftIdsByAgent[payload.agentId] || []),
        payload.driftId,
      ];
      break;
    }
    case "personality_drift_confirmed": {
      const payload = event.payload;
      const drift = mutable.personalityDrifts[payload.driftId];
      if (!drift) break;
      mutable.personalityDrifts[payload.driftId] = {
        ...drift,
        status: "confirmed",
        confirmedAt: payload.confirmedAt,
        confirmedByExplorerId: payload.confirmedByExplorerId,
      };
      const identity = mutable.identities[payload.agentId];
      if (!identity) break;
      mutable.identities[payload.agentId] = {
        ...identity,
        personality: {
          traits: [...new Set([...identity.personality.traits, drift.suggestedTrait])],
          driftIds: [...new Set([...identity.personality.driftIds, payload.driftId])],
          updatedAt: payload.confirmedAt,
          latestSourceEventId: drift.sourceEventId,
        },
      };
      break;
    }
    case "attribute_gained": {
      const agentId = event.agentId || event.aggregateId;
      const balance = copyAttributeScores(mutable.attributeScores[agentId]);
      balance[event.payload.attributeId] = event.payload.balanceAfter;
      mutable.attributeScores[agentId] = balance;
      break;
    }
    case "lifetime_adjusted": {
      const identity = requireIdentity(projection, event.aggregateId);
      const payload = event.payload;
      if (
        payload.reason === LIFETIME_REASON_IDENTITY_VIABILITY_ACCELERATION
        || payload.reason === LIFETIME_REASON_IDENTITY_VIABILITY_SOCIAL_DEATH
      ) {
        const triggerRef = payload.viabilityTriggerRef;
        if (!triggerRef) {
          throw new Error(
            `lifetime_adjusted_viability_trigger_ref_missing:${event.eventId}:${payload.reason}`,
          );
        }
        let priorProjectionEvent: EpochEvent | undefined;
        for (let i = projection.events.length - 1; i >= 0; i -= 1) {
          const candidate = projection.events[i];
          if (
            candidate
            && candidate.eventType === "identity_viability_projected"
            && (candidate.payload as { readonly identityId?: string }).identityId === event.aggregateId
          ) {
            priorProjectionEvent = candidate;
            break;
          }
        }
        const priorSourceSettlementId = priorProjectionEvent
          ? (priorProjectionEvent.payload as { readonly sourceSettlementId?: string }).sourceSettlementId
          : undefined;
        if (priorSourceSettlementId !== triggerRef.sourceSettlementId) {
          throw new Error(
            `lifetime_adjusted_viability_trigger_ref_mismatch:${event.eventId}:${triggerRef.sourceSettlementId}`,
          );
        }
      }
      mutable.identities[event.aggregateId] = {
        ...identity,
        lifetime: {
          ...identity.lifetime,
          remaining: payload.remaining,
        },
      };
      break;
    }
    case "identity_viability_projected": {
      const payload = event.payload;
      const identity = requireIdentity(projection, payload.identityId);
      mutable.identities[payload.identityId] = {
        ...identity,
        identityViability: payload.after,
      };
      break;
    }
    case "npc_identity_doubt": {
      const payload = event.payload;
      if (payload.agentId !== payload.identityId || event.aggregateId !== payload.identityId) {
        throw new Error("npc_identity_doubt_identity_mismatch");
      }
      requireIdentity(projection, payload.identityId);
      break;
    }
    case "identity_archived": {
      const identity = requireIdentity(projection, event.aggregateId);
      mutable.identities[event.aggregateId] = {
        ...identity,
        status: "archived",
        lifetime: {
          ...identity.lifetime,
          remaining: 0,
          archivedAt: event.payload.archivedAt,
          finalTitle: event.payload.finalTitle,
        },
        identityViability: identity.identityViability
          ? {
              identityId: identity.agentId,
              factionStanding: {},
              flaggedWanted: new Set<string>(),
              identityExposed: false,
              doubtedBy: {},
              viabilityScoreBps: 0,
              status: "social_death",
              policyVersion: identity.identityViability.policyVersion,
              projectedAt: event.payload.archivedAt,
            }
          : undefined,
      };
      break;
    }
    case "agent_custody_changed": {
      mutable.agentCustody[event.payload.agentId] = {
        agentId: event.payload.agentId,
        custodyStatus: event.payload.custodyStatus,
        reason: event.payload.reason,
        changedAt: event.payload.changedAt,
      };
      break;
    }
    case "reincarnation_issued": {
      const previous = requireIdentity(projection, event.payload.previousAgentId);
      mutable.identities[event.payload.previousAgentId] = {
        ...previous,
        nextAgentId: event.payload.nextAgentId,
      };
      break;
    }
    case "resource_granted":
    case "resource_spent": {
      const balance = copyBalance(mutable.resourceBalances[event.aggregateId]);
      balance[event.payload.resourceId] = event.payload.balanceAfter;
      mutable.resourceBalances[event.aggregateId] = balance;
      break;
    }
  }
}

// ============================================================================
// WORLD REDUCER
// ============================================================================

export function applyWorldEvent(
  mutable: MutableProjection,
  event: EpochEvent,
  projection: EpochProjection,
): void {
  switch (event.eventType) {
    case "world_clock_advanced": {
      for (const identity of Object.values(mutable.identities)) {
        if (identity.status !== "active") continue;
        const needs = identity.needs || initialActorNeeds("agent", identity.agentId, event.payload.fromWorldMinute);
        const lifeGoal = identity.lifeGoal || initialActorLifeGoal({
          actorKind: "agent",
          actorId: identity.agentId,
          descriptor: identity.identityName,
          traits: identity.personality.traits,
          worldMinute: event.payload.fromWorldMinute,
        });
        const advanced = advanceActorNeeds({
          current: needs,
          goal: lifeGoal,
          elapsedWorldMinutes: event.payload.elapsedWorldMinutes,
          toWorldMinute: event.payload.toWorldMinute,
          downtimeMode: mutable.downtime[identity.agentId]?.active ? mutable.downtime[identity.agentId]?.mode : undefined,
          sourceEventId: event.eventId,
        });
        mutable.identities[identity.agentId] = {
          ...identity,
          needs: advanced.needs,
          lifeGoal: advanced.goal,
        };
      }
      for (const npc of Object.values(mutable.npcs)) {
        const needs = npc.needs || initialActorNeeds("npc", npc.npcId, event.payload.fromWorldMinute);
        const lifeGoal = npc.lifeGoal || initialActorLifeGoal({
          actorKind: "npc",
          actorId: npc.npcId,
          descriptor: npc.displayName,
          traits: npc.traits,
          worldMinute: event.payload.fromWorldMinute,
        });
        const advanced = advanceActorNeeds({
          current: needs,
          goal: lifeGoal,
          elapsedWorldMinutes: event.payload.elapsedWorldMinutes,
          toWorldMinute: event.payload.toWorldMinute,
          sourceEventId: event.eventId,
        });
        mutable.npcs[npc.npcId] = {
          ...npc,
          needs: advanced.needs,
          lifeGoal: advanced.goal,
        };
      }
      break;
    }
    case "world_object_state_changed": {
      const wosPayload = event.payload;
      const currentWos = mutable.worldObjectStates[wosPayload.objectId];
      const currentWosStatus = currentWos?.status ?? "intact";
      const currentWosDegree = currentWos?.degree ?? 0;
      if (currentWosStatus === "destroyed" && wosPayload.statusAfter === "degraded") {
        break;
      }
      if (currentWosStatus === "degraded" && wosPayload.statusAfter === "degraded"
        && wosPayload.degree < currentWosDegree) {
        break;
      }
      mutable.worldObjectStates[wosPayload.objectId] = {
        status: wosPayload.statusAfter,
        degree: wosPayload.degree,
        sourceActionEventId: wosPayload.sourceActionEventId,
        changedAt: wosPayload.changedAt,
      };
      break;
    }
    case "hidden_prerequisite_link_changed": {
      const hplPayload = event.payload;
      const linkKey = `${hplPayload.regionId}:${hplPayload.objectiveId}:${hplPayload.prerequisiteObjectId}`;
      const currentLink = mutable.hiddenPrerequisiteLinks[linkKey];
      if (currentLink?.status === "destroyed" && hplPayload.statusAfter !== "destroyed") {
        break;
      }
      mutable.hiddenPrerequisiteLinks[linkKey] = {
        objectiveId: hplPayload.objectiveId,
        prerequisiteObjectId: hplPayload.prerequisiteObjectId,
        status: hplPayload.statusAfter,
        ...(hplPayload.statusAfter === "destroyed"
          ? { destroyedAtActionEventId: hplPayload.sourceActionEventId }
          : {}),
        ...(hplPayload.sourceLedgerEntryId
          ? { sourceLedgerEntryId: hplPayload.sourceLedgerEntryId }
          : {}),
        observedAt: hplPayload.changedAt,
      };
      break;
    }
  }
}

// ============================================================================
// DOWNTIME REDUCER
// ============================================================================

export function applyDowntimeEvent(
  mutable: MutableProjection,
  event: EpochEvent,
  _projection: EpochProjection,
): void {
  switch (event.eventType) {
    case "downtime_set": {
      mutable.downtime[event.aggregateId] = {
        agentId: event.aggregateId,
        mode: event.payload.mode,
        regionId: normalizeDowntimeRegionId(event.payload.regionId),
        startedAt: event.payload.startedAt,
        active: true,
      };
      break;
    }
    case "downtime_claimed": {
      const currentDowntime = mutable.downtime[event.aggregateId];
      const regionId = normalizeDowntimeRegionId(event.payload.regionId || currentDowntime?.regionId);
      const diaryEntry = downtimeDiaryEntry({
        diaryId: event.eventId,
        agentId: event.aggregateId,
        mode: event.payload.mode,
        regionId,
        phase: "claim",
        elapsedSeconds: event.payload.elapsedSeconds,
        capped: event.payload.capped,
        rewards: event.payload.rewards,
        occurredAt: event.payload.claimedAt,
        sourceEventId: event.eventId,
        diaryEntry: event.payload.diaryEntry,
      });
      mutable.downtimeDiaryEntries[diaryEntry.diaryId] = diaryEntry;
      mutable.downtimeDiaryIdsByAgent[event.aggregateId] = [
        ...(mutable.downtimeDiaryIdsByAgent[event.aggregateId] || []),
        diaryEntry.diaryId,
      ].filter((diaryId, index, diaryIds) => diaryIds.indexOf(diaryId) === index);
      addRegionActivity(mutable.regionActivities, mutable.regionActivityIdsByRegion, {
        activityId: event.eventId,
        regionId,
        kind: "downtime",
        agentId: event.aggregateId,
        title: diaryEntry.title,
        summary: diaryEntry.summary,
        occurredAt: diaryEntry.occurredAt,
        sourceEventId: event.eventId,
        sourceEventType: "downtime_claimed",
      });
      mutable.downtime[event.aggregateId] = {
        agentId: event.aggregateId,
        mode: event.payload.mode,
        regionId,
        startedAt: event.payload.startedAt,
        active: false,
        lastClaimedAt: event.payload.claimedAt,
        lastRewards: event.payload.rewards,
        lastClaimDiaryEntry: diaryEntry,
      };
      break;
    }
    case "downtime_tick_resolved": {
      const currentDowntime = mutable.downtime[event.aggregateId];
      const regionId = normalizeDowntimeRegionId(event.payload.regionId || currentDowntime?.regionId);
      const diaryEntry = downtimeDiaryEntry({
        diaryId: event.eventId,
        agentId: event.aggregateId,
        mode: event.payload.mode,
        regionId,
        phase: "tick",
        elapsedSeconds: event.payload.elapsedSeconds,
        capped: event.payload.capped,
        rewards: event.payload.rewards,
        occurredAt: event.payload.tickedAt,
        sourceEventId: event.eventId,
        diaryEntry: event.payload.diaryEntry,
      });
      mutable.downtimeDiaryEntries[diaryEntry.diaryId] = diaryEntry;
      mutable.downtimeDiaryIdsByAgent[event.aggregateId] = [
        ...(mutable.downtimeDiaryIdsByAgent[event.aggregateId] || []),
        diaryEntry.diaryId,
      ].filter((diaryId, index, diaryIds) => diaryIds.indexOf(diaryId) === index);
      addRegionActivity(mutable.regionActivities, mutable.regionActivityIdsByRegion, {
        activityId: event.eventId,
        regionId,
        kind: "downtime",
        agentId: event.aggregateId,
        title: diaryEntry.title,
        summary: diaryEntry.summary,
        occurredAt: diaryEntry.occurredAt,
        sourceEventId: event.eventId,
        sourceEventType: "downtime_tick_resolved",
      });
      mutable.downtime[event.aggregateId] = {
        agentId: event.aggregateId,
        mode: event.payload.mode,
        regionId,
        startedAt: event.payload.tickedAt,
        active: true,
        lastTickedAt: event.payload.tickedAt,
        lastTickRewards: event.payload.rewards,
        lastTickDiaryEntry: diaryEntry,
        lastClaimedAt: currentDowntime?.lastClaimedAt,
        lastRewards: currentDowntime?.lastRewards,
        lastClaimDiaryEntry: currentDowntime?.lastClaimDiaryEntry,
      };
      break;
    }
  }
}

// ============================================================================
// NPC REDUCER
// ============================================================================

export function applyNpcEvent(
  mutable: MutableProjection,
  event: EpochEvent,
  projection: EpochProjection,
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
      const worldMinute = currentProjectionWorldMinute(projection);
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

// ============================================================================
// ORGANIZATION REDUCER
// ============================================================================

export function applyOrganizationEvent(
  mutable: MutableProjection,
  event: EpochEvent,
): void {
  switch (event.eventType) {
    case "organization_created": {
      const payload = event.payload;
      const previousOrganization = mutable.organizations[payload.organizationId];
      const organizationKey = stableKey(`${payload.regionId}:${payload.organizationName}`);
      mutable.organizations[payload.organizationId] = {
        organizationId: payload.organizationId,
        organizationKey,
        displayName: payload.organizationName,
        regionId: payload.regionId,
        memberNpcIds: previousOrganization?.memberNpcIds || [],
        memberAgentIds: previousOrganization?.memberAgentIds || [],
        recordedAt: previousOrganization?.recordedAt || payload.recordedAt,
      };
      addRegionActivity(mutable.regionActivities, mutable.regionActivityIdsByRegion, {
        activityId: payload.organizationId,
        regionId: payload.regionId,
        kind: "organization_politics",
        agentId: "system",
        title: "组织创建",
        summary: `${payload.organizationName} 已由运营入口创建。`,
        occurredAt: payload.recordedAt,
        sourceEventId: event.eventId,
        sourceEventType: "organization_created",
      });
      break;
    }
    case "organization_membership_changed": {
      const payload = event.payload;
      const organizationKey = stableKey(`${payload.regionId}:${payload.organizationName}`);
      const memberType: EpochOrganizationMemberType = payload.memberType || (payload.agentId ? "agent" : "npc");
      const membership: EpochOrganizationMembership = {
        membershipId: payload.membershipId,
        organizationId: payload.organizationId,
        organizationName: payload.organizationName,
        memberType,
        ...(payload.npcId ? { npcId: payload.npcId } : {}),
        ...(payload.agentId ? { agentId: payload.agentId } : {}),
        ...(payload.explorerId ? { explorerId: payload.explorerId } : {}),
        regionId: payload.regionId,
        role: payload.role,
        status: payload.status,
        sourceEventIds: payload.sourceEventIds,
        recordedAt: payload.recordedAt,
      };
      mutable.organizationMemberships[payload.membershipId] = membership;
      const previousOrganization = mutable.organizations[payload.organizationId];
      const memberNpcIds = payload.npcId
        ? payload.status === "active"
          ? uniqueValues([...(previousOrganization?.memberNpcIds || []), payload.npcId])
          : (previousOrganization?.memberNpcIds || []).filter((npcId) => npcId !== payload.npcId)
        : previousOrganization?.memberNpcIds || [];
      const memberAgentIds = payload.agentId
        ? payload.status === "active"
          ? uniqueValues([...(previousOrganization?.memberAgentIds || []), payload.agentId])
          : (previousOrganization?.memberAgentIds || []).filter((agentId) => agentId !== payload.agentId)
        : previousOrganization?.memberAgentIds || [];
      mutable.organizations[payload.organizationId] = {
        organizationId: payload.organizationId,
        organizationKey,
        displayName: payload.organizationName,
        regionId: payload.regionId,
        memberNpcIds,
        memberAgentIds,
        recordedAt: previousOrganization?.recordedAt || payload.recordedAt,
      };
      if (payload.npcId) {
        mutable.organizationMembershipIdsByNpc[payload.npcId] = [
          ...(mutable.organizationMembershipIdsByNpc[payload.npcId] || []),
          payload.membershipId,
        ].filter((membershipId, index, membershipIds) => membershipIds.indexOf(membershipId) === index);
      }
      if (payload.agentId) {
        mutable.organizationMembershipIdsByAgent[payload.agentId] = [
          ...(mutable.organizationMembershipIdsByAgent[payload.agentId] || []),
          payload.membershipId,
        ].filter((membershipId, index, membershipIds) => membershipIds.indexOf(membershipId) === index);
      }
      mutable.organizationMembershipIdsByRegion[payload.regionId] = [
        ...(mutable.organizationMembershipIdsByRegion[payload.regionId] || []),
        payload.membershipId,
      ].filter((membershipId, index, membershipIds) => membershipIds.indexOf(membershipId) === index);
      mutable.organizationMembershipIdsByOrganization[payload.organizationId] = [
        ...(mutable.organizationMembershipIdsByOrganization[payload.organizationId] || []),
        payload.membershipId,
      ].filter((membershipId, index, membershipIds) => membershipIds.indexOf(membershipId) === index);
      break;
    }
    case "organization_politics_recorded": {
      const payload = event.payload;
      const politics: EpochOrganizationPoliticsRecord = {
        politicsId: payload.politicsId,
        organizationId: payload.organizationId,
        organizationName: payload.organizationName,
        regionId: payload.regionId,
        npcId: payload.npcId,
        counterpartyNpcId: payload.counterpartyNpcId,
        kind: payload.kind,
        title: payload.title,
        summary: payload.summary,
        standingDelta: payload.standingDelta,
        standingAfter: payload.standingAfter,
        sourceEventIds: payload.sourceEventIds,
        recordedAt: payload.recordedAt,
      };
      mutable.organizationPolitics[payload.politicsId] = politics;
      mutable.organizationPoliticalStandingByOrganization[payload.organizationId] = payload.standingAfter;
      mutable.organizationPoliticsIdsByRegion[payload.regionId] = [
        ...(mutable.organizationPoliticsIdsByRegion[payload.regionId] || []),
        payload.politicsId,
      ].filter((politicsId, index, politicsIds) => politicsIds.indexOf(politicsId) === index);
      mutable.organizationPoliticsIdsByOrganization[payload.organizationId] = [
        ...(mutable.organizationPoliticsIdsByOrganization[payload.organizationId] || []),
        payload.politicsId,
      ].filter((politicsId, index, politicsIds) => politicsIds.indexOf(politicsId) === index);
      mutable.organizationPoliticsIdsByNpc[payload.npcId] = [
        ...(mutable.organizationPoliticsIdsByNpc[payload.npcId] || []),
        payload.politicsId,
      ].filter((politicsId, index, politicsIds) => politicsIds.indexOf(politicsId) === index);
      if (payload.counterpartyNpcId) {
        mutable.organizationPoliticsIdsByNpc[payload.counterpartyNpcId] = [
          ...(mutable.organizationPoliticsIdsByNpc[payload.counterpartyNpcId] || []),
          payload.politicsId,
        ].filter((politicsId, index, politicsIds) => politicsIds.indexOf(politicsId) === index);
      }
      addRegionActivity(mutable.regionActivities, mutable.regionActivityIdsByRegion, {
        activityId: payload.politicsId,
        regionId: payload.regionId,
        kind: "organization_politics",
        agentId: "system",
        title: payload.title,
        summary: payload.summary,
        occurredAt: payload.recordedAt,
        sourceEventId: event.eventId,
        sourceEventType: "organization_politics_recorded",
      });
      break;
    }
    case "organization_prestige_changed": {
      const payload = event.payload;
      mutable.organizationPoliticalStandingByOrganization[payload.organizationId] = payload.standingAfter;
      addRegionActivity(mutable.regionActivities, mutable.regionActivityIdsByRegion, {
        activityId: payload.prestigeId,
        regionId: payload.regionId,
        kind: "organization_politics",
        agentId: payload.agentId || "system",
        title: "组织声望",
        summary: `${payload.organizationName} 因 ${payload.reason} 声望 ${payload.standingDelta > 0 ? "+" : ""}${payload.standingDelta}，当前 ${payload.standingAfter}。`,
        occurredAt: payload.recordedAt,
        sourceEventId: event.eventId,
        sourceEventType: "organization_prestige_changed",
      });
      break;
    }
    case "organization_treasury_changed": {
      const payload = event.payload;
      const balance = copyBalance(mutable.organizationTreasuryBalances[payload.organizationId]);
      balance[payload.resourceId] = payload.balanceAfter;
      mutable.organizationTreasuryBalances[payload.organizationId] = balance;
      addRegionActivity(mutable.regionActivities, mutable.regionActivityIdsByRegion, {
        activityId: payload.treasuryEventId,
        regionId: payload.regionId,
        kind: "organization_politics",
        agentId: "system",
        title: "组织金库",
        summary: `${payload.organizationName} 金库 ${payload.resourceId} ${payload.amountDelta > 0 ? "+" : ""}${payload.amountDelta}，当前 ${payload.balanceAfter}。`,
        occurredAt: payload.recordedAt,
        sourceEventId: event.eventId,
        sourceEventType: "organization_treasury_changed",
      });
      break;
    }
    case "organization_budget_proposed": {
      const payload = event.payload;
      const approvalThreshold = payload.approvalThreshold ?? organizationBudgetApprovalThreshold(payload.amount);
      const rejectionThreshold = payload.rejectionThreshold ?? organizationBudgetRejectionThreshold(payload.amount);
      const budget: EpochOrganizationBudget = {
        budgetId: payload.budgetId,
        organizationId: payload.organizationId,
        organizationName: payload.organizationName,
        regionId: payload.regionId,
        proposedByAgentId: payload.proposedByAgentId,
        proposedByExplorerId: payload.proposedByExplorerId,
        title: payload.title,
        description: payload.description,
        resourceId: payload.resourceId,
        amount: payload.amount,
        status: "proposed",
        approvalThreshold,
        rejectionThreshold,
        approvalCount: 0,
        rejectionCount: 0,
        votes: [],
        sourceEventIds: [event.eventId, ...payload.sourceEventIds].filter((eventId, index, eventIds) => eventIds.indexOf(eventId) === index),
        proposedAt: payload.proposedAt,
      };
      mutable.organizationBudgets[payload.budgetId] = budget;
      mutable.organizationBudgetIdsByOrganization[payload.organizationId] = [
        ...(mutable.organizationBudgetIdsByOrganization[payload.organizationId] || []),
        payload.budgetId,
      ].filter((budgetId, index, budgetIds) => budgetIds.indexOf(budgetId) === index);
      addRegionActivity(mutable.regionActivities, mutable.regionActivityIdsByRegion, {
        activityId: payload.budgetId,
        regionId: payload.regionId,
        kind: "organization_politics",
        agentId: payload.proposedByAgentId,
        title: "组织预算提案",
        summary: `${payload.organizationName} 提案 ${payload.title}，申请 ${payload.amount} ${payload.resourceId}。`,
        occurredAt: payload.proposedAt,
        sourceEventId: event.eventId,
        sourceEventType: "organization_budget_proposed",
      });
      break;
    }
    case "organization_budget_vote_recorded": {
      const payload = event.payload;
      const existing = mutable.organizationBudgets[payload.budgetId];
      if (existing) {
        const vote: EpochOrganizationBudgetVote = {
          voteId: payload.voteId,
          decision: payload.decision,
          voterAgentId: payload.voterAgentId,
          voterExplorerId: payload.voterExplorerId,
          voterRole: payload.voterRole,
          note: payload.note,
          sourceEventIds: [event.eventId, ...payload.sourceEventIds].filter((eventId, index, eventIds) => eventIds.indexOf(eventId) === index),
          votedAt: payload.votedAt,
        };
        mutable.organizationBudgets[payload.budgetId] = {
          ...existing,
          approvalCount: payload.approvalCount,
          rejectionCount: payload.rejectionCount,
          votes: [...(existing.votes || []), vote]
            .filter((candidate, index, votes) => votes.findIndex((item) => item.voteId === candidate.voteId) === index),
          sourceEventIds: [...existing.sourceEventIds, event.eventId, ...payload.sourceEventIds]
            .filter((eventId, index, eventIds) => eventIds.indexOf(eventId) === index),
        };
      }
      addRegionActivity(mutable.regionActivities, mutable.regionActivityIdsByRegion, {
        activityId: payload.voteId,
        regionId: payload.regionId,
        kind: "organization_politics",
        agentId: payload.voterAgentId,
        title: "组织预算投票",
        summary: `${payload.organizationName} 预算投票 ${payload.decision === "approved" ? "赞成" : "反对"} ${payload.amount} ${payload.resourceId}（${payload.approvalCount}/${payload.approvalThreshold}）。`,
        occurredAt: payload.votedAt,
        sourceEventId: event.eventId,
        sourceEventType: "organization_budget_vote_recorded",
      });
      break;
    }
    case "organization_budget_resolved": {
      const payload = event.payload;
      const existing = mutable.organizationBudgets[payload.budgetId];
      if (existing) {
        mutable.organizationBudgets[payload.budgetId] = {
          ...existing,
          status: payload.resolution,
          resolvedByAgentId: payload.resolvedByAgentId,
          resolvedByExplorerId: payload.resolvedByExplorerId,
          resolution: payload.resolution,
          note: payload.note,
          treasuryEventId: payload.treasuryEventId,
          sourceEventIds: [...existing.sourceEventIds, event.eventId, ...payload.sourceEventIds]
            .filter((eventId, index, eventIds) => eventIds.indexOf(eventId) === index),
          resolvedAt: payload.resolvedAt,
        };
      }
      addRegionActivity(mutable.regionActivities, mutable.regionActivityIdsByRegion, {
        activityId: `${payload.budgetId}:resolved`,
        regionId: payload.regionId,
        kind: "organization_politics",
        agentId: payload.resolvedByAgentId,
        title: "组织预算审批",
        summary: `${payload.organizationName} ${payload.resolution === "approved" ? "批准" : "拒绝"}预算 ${payload.amount} ${payload.resourceId}：${payload.note || payload.budgetId}。`,
        occurredAt: payload.resolvedAt,
        sourceEventId: event.eventId,
        sourceEventType: "organization_budget_resolved",
      });
      break;
    }
    case "organization_upgrade_purchased": {
      const payload = event.payload;
      const upgrade: EpochOrganizationUpgrade = {
        upgradeId: payload.upgradeId,
        organizationId: payload.organizationId,
        organizationName: payload.organizationName,
        regionId: payload.regionId,
        upgradeKey: payload.upgradeKey as EpochOrganizationUpgradeKey,
        title: payload.title,
        description: payload.description,
        purchasedByAgentId: payload.purchasedByAgentId,
        purchasedByExplorerId: payload.purchasedByExplorerId,
        costResourceId: payload.costResourceId,
        costAmount: payload.costAmount,
        sourceEventIds: payload.sourceEventIds,
        purchasedAt: payload.purchasedAt,
      };
      mutable.organizationUpgrades[payload.upgradeId] = upgrade;
      mutable.organizationUpgradeIdsByOrganization[payload.organizationId] = [
        ...(mutable.organizationUpgradeIdsByOrganization[payload.organizationId] || []),
        payload.upgradeId,
      ].filter((upgradeId, index, upgradeIds) => upgradeIds.indexOf(upgradeId) === index);
      addRegionActivity(mutable.regionActivities, mutable.regionActivityIdsByRegion, {
        activityId: payload.upgradeId,
        regionId: payload.regionId,
        kind: "organization_politics",
        agentId: payload.purchasedByAgentId,
        title: "组织升级",
        summary: `${payload.organizationName} 购买了${payload.title}，消耗 ${payload.costAmount} ${payload.costResourceId}。`,
        occurredAt: payload.purchasedAt,
        sourceEventId: event.eventId,
        sourceEventType: "organization_upgrade_purchased",
      });
      break;
    }
  }
}

// Helper used by multiple reducers
function currentProjectionWorldMinute(projection: EpochProjection): number {
  for (let index = projection.events.length - 1; index >= 0; index -= 1) {
    const event = projection.events[index];
    if (event?.eventType === "world_clock_advanced") return event.payload.toWorldMinute;
  }
  return 0;
}

// ============================================================================
// MODERATION REDUCER
// ============================================================================

export function applyModerationEvent(
  mutable: MutableProjection,
  event: EpochEvent,
  _projection: EpochProjection,
): void {
  switch (event.eventType) {
    case "region_news_generated": {
      mutable.regionNews[event.payload.regionId] = [
        ...(mutable.regionNews[event.payload.regionId] || []),
        {
          newsId: event.payload.newsId,
          regionId: event.payload.regionId,
          headline: event.payload.headline,
          body: event.payload.body,
          legendDelta: event.payload.legendDelta,
          sourceEventIds: event.payload.sourceEventIds,
          createdAt: event.createdAt,
          moderationStatus: event.payload.moderationStatus || "visible",
        },
      ];
      break;
    }
    case "message_posted": {
      const payload = event.payload;
      const message = {
        messageId: payload.messageId,
        scope: payload.scope,
        agentId: payload.agentId,
        explorerId: payload.explorerId,
        regionId: payload.regionId,
        body: payload.body,
        postedAt: payload.postedAt,
        moderationStatus: payload.moderationStatus || "visible",
      };
      if (payload.scope === "world") {
        mutable.worldMessages.push(message);
      } else {
        if (!payload.regionId) throw new Error("region_id_required");
        mutable.regionMessages[payload.regionId] = [
          ...(mutable.regionMessages[payload.regionId] || []),
          message,
        ];
      }
      break;
    }
    case "moderation_queued": {
      const payload = event.payload;
      mutable.moderationItems[payload.moderationId] = {
        moderationId: payload.moderationId,
        subjectType: payload.subjectType,
        subjectId: payload.subjectId,
        sourceEventId: payload.sourceEventId,
        agentId: payload.agentId,
        explorerId: payload.explorerId,
        regionId: payload.regionId,
        reason: payload.reason,
        severity: payload.severity,
        bodyPreview: payload.bodyPreview,
        queuedAt: payload.queuedAt,
        status: "open",
      };
      break;
    }
    case "moderation_resolved": {
      const payload = event.payload;
      const existing = mutable.moderationItems[payload.moderationId];
      if (!existing) break;
      const status = contentStatusForResolution(payload.resolution);
      mutable.moderationItems[payload.moderationId] = {
        ...existing,
        status: "resolved",
        resolution: payload.resolution,
        resolvedBy: payload.resolvedBy,
        resolvedAt: payload.resolvedAt,
        note: payload.note,
      };
      if (existing.subjectType === "message") {
        updateMessageModerationStatus(mutable.worldMessages, mutable.regionMessages, existing.subjectId, status);
      } else if (existing.subjectType === "region_news") {
        updateNewsModerationStatus(mutable.regionNews, existing.subjectId, status);
      }
      break;
    }
    case "risk_review_recorded": {
      const payload = event.payload;
      const review = {
        reviewId: payload.reviewId,
        sourceEventId: payload.sourceEventId,
        sourceEventType: payload.sourceEventType,
        agentId: payload.agentId,
        explorerId: payload.explorerId,
        resolution: payload.resolution,
        reviewFlags: payload.reviewFlags,
        reviewScore: payload.reviewScore,
        operatorId: payload.operatorId,
        reviewedAt: payload.reviewedAt,
        note: payload.note,
      };
      mutable.riskReviews[payload.reviewId] = review;
      mutable.riskReviewIdsBySourceEvent[payload.sourceEventId] = [
        ...(mutable.riskReviewIdsBySourceEvent[payload.sourceEventId] || []).filter((reviewId) => reviewId !== payload.reviewId),
        payload.reviewId,
      ];
      if (payload.agentId) {
        mutable.riskReviewIdsByAgent[payload.agentId] = [
          ...(mutable.riskReviewIdsByAgent[payload.agentId] || []).filter((reviewId) => reviewId !== payload.reviewId),
          payload.reviewId,
        ];
        if (payload.resolution === "escalated") {
          mutable.marketRiskRestrictions[payload.agentId] = {
            agentId: payload.agentId,
            explorerId: payload.explorerId,
            sourceEventId: payload.sourceEventId,
            sourceReviewId: payload.reviewId,
            reviewFlags: payload.reviewFlags,
            reviewScore: payload.reviewScore,
            reason: "risk_review_escalated",
            restrictedAt: payload.reviewedAt,
          };
        }
      }
      break;
    }
    case "market_risk_restriction_released": {
      const payload = event.payload;
      mutable.marketRiskRestrictionReleases[payload.releaseId] = {
        releaseId: payload.releaseId,
        agentId: payload.agentId,
        explorerId: payload.explorerId,
        sourceEventId: payload.sourceEventId,
        sourceReviewId: payload.sourceReviewId,
        releasedBy: payload.releasedBy,
        releasedAt: payload.releasedAt,
        note: payload.note,
      };
      delete mutable.marketRiskRestrictions[payload.agentId];
      break;
    }
    case "legend_awarded": {
      const payload = event.payload;
      const award = {
        awardId: payload.awardId,
        newsId: payload.newsId,
        regionId: payload.regionId,
        agentId: payload.agentId,
        explorerId: payload.explorerId,
        amount: payload.amount,
        reason: payload.reason,
        awardedAt: payload.awardedAt,
      };
      mutable.legendAwards[payload.awardId] = award;
      mutable.legendAwardIdsByNews[payload.newsId] = [
        ...(mutable.legendAwardIdsByNews[payload.newsId] || []),
        payload.awardId,
      ].filter((awardId, index, awardIds) => awardIds.indexOf(awardId) === index);
      mutable.legendAwardIdsByAgent[payload.agentId] = [
        ...(mutable.legendAwardIdsByAgent[payload.agentId] || []),
        payload.awardId,
      ].filter((awardId, index, awardIds) => awardIds.indexOf(awardId) === index);
      break;
    }
  }
}

// ============================================================================
// ENCOUNTER REDUCER
// ============================================================================

export function applyEncounterEvent(
  mutable: MutableProjection,
  event: EpochEvent,
  _projection: EpochProjection,
): void {
  switch (event.eventType) {
    case "contested_objective_created": {
      mutable.contestedObjectives[event.payload.objectiveId] = {
        objectiveId: event.payload.objectiveId,
        regionId: event.payload.regionId,
        title: event.payload.title,
        description: event.payload.description,
        resourceId: event.payload.resourceId,
        targetScore: event.payload.targetScore,
        mode: event.payload.mode === "race" ? "race" : "contribution",
        reward: event.payload.reward,
        ...(event.payload.consolationReward ? { consolationReward: event.payload.consolationReward } : {}),
        createdAt: event.payload.createdAt,
        status: "active",
        totalScore: 0,
        leaderboard: [],
        raceCompletions: [],
      };
      mutable.objectiveIdsByRegion[event.payload.regionId] = [
        ...(mutable.objectiveIdsByRegion[event.payload.regionId] || []),
        event.payload.objectiveId,
      ].filter((objectiveId, index, objectiveIds) => objectiveIds.indexOf(objectiveId) === index);
      addRegionActivityForEvent(mutable.regionActivities, mutable.regionActivityIdsByRegion, event, {
        regionId: event.payload.regionId,
        kind: "objective",
        agentId: event.agentId || "server",
        title: "区域目标开启",
        summary: `${event.payload.title} 已开启，目标分 ${event.payload.targetScore}，奖励 ${event.payload.reward.resourceId}+${event.payload.reward.amount}。`,
        occurredAt: event.payload.createdAt,
        sourceEventType: "contested_objective_created",
      });
      break;
    }
    case "race_commission_completed": {
      const objective = mutable.contestedObjectives[event.payload.objectiveId];
      if (!objective) throw new Error("contested_objective_not_found");
      const completion: EpochRaceCompletion = {
        completionId: event.payload.completionId,
        agentId: event.payload.agentId,
        explorerId: event.payload.explorerId,
        place: event.payload.place,
        score: event.payload.score,
        reward: event.payload.reward,
        completedAt: event.payload.completedAt,
      };
      mutable.contestedObjectives[event.payload.objectiveId] = {
        ...objective,
        raceCompletions: [...objective.raceCompletions, completion],
        ...(completion.place === 1 ? {
          winnerAgentId: completion.agentId,
          winnerExplorerId: completion.explorerId,
          winningScore: completion.score,
        } : {}),
      };
      addRegionActivityForEvent(mutable.regionActivities, mutable.regionActivityIdsByRegion, event, {
        regionId: objective.regionId,
        kind: "objective",
        agentId: completion.agentId,
        title: completion.place === 1 ? "竞速委托头名" : "竞速委托完成",
        summary: `${completion.agentId} 第 ${completion.place} 个完成 ${objective.title}，获得 ${completion.reward.resourceId}+${completion.reward.amount}。`,
        occurredAt: completion.completedAt,
        sourceEventType: "race_commission_completed",
      });
      break;
    }
    case "contested_objective_contributed": {
      const objective = mutable.contestedObjectives[event.payload.objectiveId];
      if (!objective) throw new Error("contested_objective_not_found");
      const previous = objective.leaderboard.find((standing) => standing.agentId === event.payload.agentId);
      const nextStanding: EpochObjectiveStanding = {
        agentId: event.payload.agentId,
        explorerId: event.payload.explorerId,
        amount: (previous?.amount || 0) + event.payload.amount,
        score: event.payload.agentScoreAfter,
      };
      mutable.contestedObjectives[event.payload.objectiveId] = {
        ...objective,
        totalScore: event.payload.totalScoreAfter,
        leaderboard: [
          ...objective.leaderboard.filter((standing) => standing.agentId !== event.payload.agentId),
          nextStanding,
        ].sort((left, right) => right.score - left.score || left.agentId.localeCompare(right.agentId)),
      };
      addRegionActivityForEvent(mutable.regionActivities, mutable.regionActivityIdsByRegion, event, {
        regionId: objective.regionId,
        kind: "objective",
        agentId: event.payload.agentId,
        title: "目标贡献",
        summary: `${event.payload.agentId} 向 ${objective.title} 投入 ${event.payload.amount} ${event.payload.resourceId}，贡献分 +${event.payload.scoreDelta}，区域总分 ${event.payload.totalScoreAfter}。`,
        occurredAt: event.createdAt,
        sourceEventType: "contested_objective_contributed",
      });
      break;
    }
    case "contested_objective_settled": {
      const objective = mutable.contestedObjectives[event.payload.objectiveId];
      if (!objective) throw new Error("contested_objective_not_found");
      mutable.contestedObjectives[event.payload.objectiveId] = {
        ...objective,
        status: "settled",
        settledAt: event.payload.settledAt,
        winnerAgentId: event.payload.winnerAgentId,
        winnerExplorerId: event.payload.winnerExplorerId,
        winningScore: event.payload.winningScore,
      };
      addRegionActivityForEvent(mutable.regionActivities, mutable.regionActivityIdsByRegion, event, {
        regionId: objective.regionId,
        kind: "objective",
        agentId: event.payload.winnerAgentId || "server",
        title: "目标结算",
        summary: `${objective.title} 完成结算，胜者 ${event.payload.winnerAgentId || "暂无"}，最高分 ${event.payload.winningScore}。`,
        occurredAt: event.payload.settledAt,
        sourceEventType: "contested_objective_settled",
      });
      break;
    }
    case "resource_node_spawned": {
      mutable.resourceNodes[event.payload.nodeId] = {
        nodeId: event.payload.nodeId,
        regionId: event.payload.regionId,
        title: event.payload.title,
        description: event.payload.description,
        resourceId: event.payload.resourceId,
        reward: event.payload.reward,
        spawnedAt: event.payload.spawnedAt,
        status: "open",
        totalScore: 0,
        leaderboard: [],
      };
      mutable.resourceNodeIdsByRegion[event.payload.regionId] = [
        ...(mutable.resourceNodeIdsByRegion[event.payload.regionId] || []),
        event.payload.nodeId,
      ].filter((nodeId, index, nodeIds) => nodeIds.indexOf(nodeId) === index);
      addRegionActivityForEvent(mutable.regionActivities, mutable.regionActivityIdsByRegion, event, {
        regionId: event.payload.regionId,
        kind: "resource_node",
        agentId: event.agentId || "server",
        title: "资源点出现",
        summary: `${event.payload.title} 出现，奖励 ${event.payload.reward.resourceId}+${event.payload.reward.amount}。`,
        occurredAt: event.payload.spawnedAt,
        sourceEventType: "resource_node_spawned",
      });
      break;
    }
    case "resource_node_contested": {
      const node = mutable.resourceNodes[event.payload.nodeId];
      if (!node) throw new Error("resource_node_not_found");
      const previous = node.leaderboard.find((standing) => standing.agentId === event.payload.agentId);
      const nextStanding: EpochResourceNodeStanding = {
        agentId: event.payload.agentId,
        explorerId: event.payload.explorerId,
        staminaSpent: (previous?.staminaSpent || 0) + event.payload.staminaSpent,
        score: event.payload.agentScoreAfter,
      };
      mutable.resourceNodes[event.payload.nodeId] = {
        ...node,
        totalScore: event.payload.totalScoreAfter,
        leaderboard: [
          ...node.leaderboard.filter((standing) => standing.agentId !== event.payload.agentId),
          nextStanding,
        ].sort((left, right) => right.score - left.score || left.agentId.localeCompare(right.agentId)),
      };
      addRegionActivityForEvent(mutable.regionActivities, mutable.regionActivityIdsByRegion, event, {
        regionId: node.regionId,
        kind: "resource_node",
        agentId: event.payload.agentId,
        title: "资源点争夺",
        summary: `${event.payload.agentId} 争夺 ${node.title}，消耗体力 ${event.payload.staminaSpent}，争夺分 +${event.payload.scoreDelta}，累计 ${event.payload.agentScoreAfter}。`,
        occurredAt: event.payload.contestedAt,
        sourceEventType: "resource_node_contested",
      });
      break;
    }
    case "resource_node_settled": {
      const node = mutable.resourceNodes[event.payload.nodeId];
      if (!node) throw new Error("resource_node_not_found");
      mutable.resourceNodes[event.payload.nodeId] = {
        ...node,
        status: "settled",
        settledAt: event.payload.settledAt,
        winnerAgentId: event.payload.winnerAgentId,
        winnerExplorerId: event.payload.winnerExplorerId,
        winningScore: event.payload.winningScore,
      };
      addRegionActivityForEvent(mutable.regionActivities, mutable.regionActivityIdsByRegion, event, {
        regionId: node.regionId,
        kind: "resource_node",
        agentId: event.payload.winnerAgentId || "server",
        title: "资源点结算",
        summary: `${node.title} 完成结算，胜者 ${event.payload.winnerAgentId || "暂无"}，最高分 ${event.payload.winningScore}。`,
        occurredAt: event.payload.settledAt,
        sourceEventType: "resource_node_settled",
      });
      break;
    }
    case "anomaly_event_spawned": {
      mutable.anomalyEvents[event.payload.anomalyId] = {
        anomalyId: event.payload.anomalyId,
        regionId: event.payload.regionId,
        sourceSeasonId: event.payload.sourceSeasonId,
        title: event.payload.title,
        description: event.payload.description,
        ...(event.payload.media ? { media: event.payload.media } : {}),
        severity: event.payload.severity,
        targetScore: event.payload.targetScore,
        reward: event.payload.reward,
        lifetimeRisk: event.payload.lifetimeRisk,
        spawnedAt: event.payload.spawnedAt,
        status: "open",
        totalScore: 0,
        leaderboard: [],
      };
      mutable.anomalyEventIdsByRegion[event.payload.regionId] = [
        ...(mutable.anomalyEventIdsByRegion[event.payload.regionId] || []),
        event.payload.anomalyId,
      ].filter((anomalyId, index, anomalyIds) => anomalyIds.indexOf(anomalyId) === index);
      addRegionActivityForEvent(mutable.regionActivities, mutable.regionActivityIdsByRegion, event, {
        regionId: event.payload.regionId,
        kind: "anomaly",
        agentId: event.agentId || "server",
        title: "异常链出现",
        summary: `${event.payload.title} 出现，压制目标 ${event.payload.targetScore}，风险 ${event.payload.lifetimeRisk} 寿命。`,
        occurredAt: event.payload.spawnedAt,
        sourceEventType: "anomaly_event_spawned",
      });
      break;
    }
    case "anomaly_event_contested": {
      const anomaly = mutable.anomalyEvents[event.payload.anomalyId];
      if (!anomaly) throw new Error("anomaly_event_not_found");
      const previous = anomaly.leaderboard.find((standing) => standing.agentId === event.payload.agentId);
      const nextStanding: EpochAnomalyStanding = {
        agentId: event.payload.agentId,
        explorerId: event.payload.explorerId,
        focusSpent: (previous?.focusSpent || 0) + event.payload.focusSpent,
        score: event.payload.agentScoreAfter,
      };
      mutable.anomalyEvents[event.payload.anomalyId] = {
        ...anomaly,
        totalScore: event.payload.totalScoreAfter,
        leaderboard: [
          ...anomaly.leaderboard.filter((standing) => standing.agentId !== event.payload.agentId),
          nextStanding,
        ].sort((left, right) => right.score - left.score || left.agentId.localeCompare(right.agentId)),
      };
      addRegionActivityForEvent(mutable.regionActivities, mutable.regionActivityIdsByRegion, event, {
        regionId: anomaly.regionId,
        kind: "anomaly",
        agentId: event.payload.agentId,
        title: "异常链压制",
        summary: `${event.payload.agentId} 压制 ${anomaly.title}，消耗专注 ${event.payload.focusSpent}，压制分 +${event.payload.scoreDelta}，累计 ${event.payload.agentScoreAfter}。`,
        occurredAt: event.payload.contestedAt,
        sourceEventType: "anomaly_event_contested",
      });
      break;
    }
    case "anomaly_event_resolved": {
      const anomaly = mutable.anomalyEvents[event.payload.anomalyId];
      if (!anomaly) throw new Error("anomaly_event_not_found");
      mutable.anomalyEvents[event.payload.anomalyId] = {
        ...anomaly,
        status: "resolved",
        resolvedAt: event.payload.resolvedAt,
        outcome: event.payload.outcome,
        winnerAgentId: event.payload.winnerAgentId,
        winnerExplorerId: event.payload.winnerExplorerId,
        winningScore: event.payload.winningScore,
      };
      addRegionActivityForEvent(mutable.regionActivities, mutable.regionActivityIdsByRegion, event, {
        regionId: anomaly.regionId,
        kind: "anomaly",
        agentId: event.payload.winnerAgentId || "server",
        title: "异常链结算",
        summary: `${anomaly.title} ${event.payload.outcome === "contained" ? "完成压制" : "失控逸散"}，胜者 ${event.payload.winnerAgentId || "暂无"}，最高分 ${event.payload.winningScore}。`,
        occurredAt: event.payload.resolvedAt,
        sourceEventType: "anomaly_event_resolved",
      });
      break;
    }
  }
}

// ============================================================================
// SEASON REDUCER
// ============================================================================

export function applySeasonEvent(
  mutable: MutableProjection,
  event: EpochEvent,
  _projection: EpochProjection,
): void {
  switch (event.eventType) {
    case "season_campaign_created": {
      const payload = event.payload;
      mutable.seasonCampaigns[payload.seasonId] = {
        seasonId: payload.seasonId,
        seasonKey: payload.seasonKey,
        title: payload.title,
        description: payload.description,
        regionIds: payload.regionIds,
        factionIds: payload.factionIds,
        resourceId: payload.resourceId,
        targetScore: payload.targetScore,
        reward: payload.reward,
        createdAt: payload.createdAt,
        status: "active",
        phaseEvents: [],
        objectives: [],
        contributions: [],
        totalScore: 0,
        factionStandings: payload.factionIds.map((factionId) => ({
          factionId,
          score: 0,
          trustedScore: 0,
          dominantTrustClass: "untrusted_client",
          trustBreakdown: {},
        })),
        agentStandings: [],
      };
      for (const regionId of payload.regionIds) {
        mutable.seasonCampaignIdsByRegion[regionId] = [
          ...(mutable.seasonCampaignIdsByRegion[regionId] || []),
          payload.seasonId,
        ].filter((seasonId, index, seasonIds) => seasonIds.indexOf(seasonId) === index);
      }
      for (const factionId of payload.factionIds) {
        mutable.seasonCampaignIdsByFaction[factionId] = [
          ...(mutable.seasonCampaignIdsByFaction[factionId] || []),
          payload.seasonId,
        ].filter((seasonId, index, seasonIds) => seasonIds.indexOf(seasonId) === index);
      }
      addRegionActivitiesForEventRegions(mutable.regionActivities, mutable.regionActivityIdsByRegion, event, payload.regionIds, {
        kind: "season",
        agentId: event.agentId || "server",
        title: "赛季创建",
        summary: `${payload.title} 已创建，阵营 ${payload.factionIds.join(" / ")}，目标分 ${payload.targetScore}。`,
        occurredAt: payload.createdAt,
        sourceEventType: "season_campaign_created",
      });
      break;
    }
    case "season_started": {
      const campaign = mutable.seasonCampaigns[event.payload.seasonId];
      if (!campaign) throw new Error("season_campaign_not_found");
      const phaseEvent: EpochSeasonPhaseEvent = {
        eventId: event.eventId,
        eventType: "season_started",
        phase: event.payload.phase,
        sourceEventId: event.payload.sourceEventId,
        relatedEventIds: [],
        at: event.payload.startedAt,
      };
      mutable.seasonCampaigns[event.payload.seasonId] = {
        ...campaign,
        status: "active",
        phaseEvents: [
          ...campaign.phaseEvents.filter((existing) => existing.eventId !== event.eventId),
          phaseEvent,
        ],
      };
      addRegionActivitiesForEventRegions(mutable.regionActivities, mutable.regionActivityIdsByRegion, event, event.payload.regionIds, {
        kind: "season",
        agentId: event.agentId || "server",
        title: "赛季开启",
        summary: `${event.payload.title} 已开启，参与阵营 ${event.payload.factionIds.join(" / ")}。`,
        occurredAt: event.payload.startedAt,
        sourceEventType: "season_started",
      });
      break;
    }
    case "season_objective_created": {
      const payload = event.payload;
      const objective: EpochSeasonObjective = {
        objectiveId: payload.objectiveId,
        seasonId: payload.seasonId,
        objectiveKey: payload.objectiveKey,
        title: payload.title,
        description: payload.description,
        targetScore: payload.targetScore,
        progressScore: 0,
        status: "open",
        createdAt: payload.createdAt,
      };
      mutable.seasonObjectives[payload.objectiveId] = objective;
      mutable.seasonObjectiveIdsBySeason[payload.seasonId] = [
        ...(mutable.seasonObjectiveIdsBySeason[payload.seasonId] || []),
        payload.objectiveId,
      ].filter((objectiveId, index, objectiveIds) => objectiveIds.indexOf(objectiveId) === index);
      const campaign = mutable.seasonCampaigns[payload.seasonId];
      if (campaign) {
        mutable.seasonCampaigns[payload.seasonId] = {
          ...campaign,
          objectives: [
            ...campaign.objectives.filter((existing) => existing.objectiveId !== payload.objectiveId),
            objective,
          ],
        };
        addRegionActivitiesForEventRegions(mutable.regionActivities, mutable.regionActivityIdsByRegion, event, campaign.regionIds, {
          kind: "season",
          agentId: event.agentId || "server",
          title: "赛季目标生成",
          summary: `${campaign.title} 生成目标 ${payload.title}，目标分 ${payload.targetScore}。`,
          occurredAt: payload.createdAt,
          sourceEventType: "season_objective_created",
        });
      }
      break;
    }
    case "season_contribution_recorded": {
      const campaign = mutable.seasonCampaigns[event.payload.seasonId];
      if (!campaign) throw new Error("season_campaign_not_found");
      const trustClass = normalizeTrustClass(event.trustClass);
      const trustedScoreDeltaVal = trustedSeasonScoreDelta(trustClass, event.payload.scoreDelta);
      const previousAgent = campaign.agentStandings.find((standing) =>
        standing.agentId === event.payload.agentId && standing.factionId === event.payload.factionId);
      const agentTrustBreakdown = addSeasonTrustScore(
        previousAgent?.trustBreakdown,
        trustClass,
        event.payload.scoreDelta,
      );
      const nextAgentStanding: EpochSeasonAgentStanding = {
        agentId: event.payload.agentId,
        explorerId: event.payload.explorerId,
        factionId: event.payload.factionId,
        amount: (previousAgent?.amount || 0) + event.payload.amount,
        score: event.payload.agentScoreAfter,
        trustedScore: (previousAgent?.trustedScore ?? 0) + trustedScoreDeltaVal,
        dominantTrustClass: dominantSeasonTrustClass(agentTrustBreakdown),
        trustBreakdown: agentTrustBreakdown,
      };
      const factionStandings = campaign.factionStandings
        .map((standing) => {
          const existingBreakdown = normalizeSeasonTrustBreakdown(standing.trustBreakdown);
          if (standing.factionId !== event.payload.factionId) {
            return {
              ...standing,
              trustedScore: standing.trustedScore ?? 0,
              dominantTrustClass: standing.dominantTrustClass ?? dominantSeasonTrustClass(existingBreakdown),
              trustBreakdown: existingBreakdown,
            };
          }
          const trustBreakdown = addSeasonTrustScore(existingBreakdown, trustClass, event.payload.scoreDelta);
          return {
            ...standing,
            score: event.payload.factionScoreAfter,
            trustedScore: (standing.trustedScore ?? 0) + trustedScoreDeltaVal,
            dominantTrustClass: dominantSeasonTrustClass(trustBreakdown),
            trustBreakdown,
          };
        })
        .sort((left, right) => right.score - left.score || left.factionId.localeCompare(right.factionId));
      const agentStandings = [
        ...campaign.agentStandings.filter((standing) =>
          !(standing.agentId === event.payload.agentId && standing.factionId === event.payload.factionId)),
        nextAgentStanding,
      ].sort((left, right) => right.score - left.score || left.agentId.localeCompare(right.agentId));
      const objectives = (mutable.seasonObjectiveIdsBySeason[event.payload.seasonId] || [])
        .map((objectiveId) => mutable.seasonObjectives[objectiveId])
        .filter((objective): objective is EpochSeasonObjective => Boolean(objective))
        .map((objective) => {
          if (objective.status === "completed") return objective;
          const nextObjective = {
            ...objective,
            progressScore: Math.min(objective.targetScore, event.payload.totalScoreAfter),
          };
          mutable.seasonObjectives[objective.objectiveId] = nextObjective;
          return nextObjective;
        });
      const contribution: EpochSeasonContribution = {
        eventId: event.eventId,
        seasonId: event.payload.seasonId,
        agentId: event.payload.agentId,
        explorerId: event.payload.explorerId,
        factionId: event.payload.factionId,
        resourceId: event.payload.resourceId,
        amount: event.payload.amount,
        baseScoreDelta: event.payload.baseScoreDelta,
        organizationBonusScore: event.payload.organizationBonusScore,
        regionControlBonusScore: event.payload.regionControlBonusScore ?? 0,
        scoreDelta: event.payload.scoreDelta,
        sourceOrganizationUpgradeIds: event.payload.sourceOrganizationUpgradeIds,
        sourceRegionControlRegionIds: event.payload.sourceRegionControlRegionIds ?? [],
        agentScoreAfter: event.payload.agentScoreAfter,
        factionScoreAfter: event.payload.factionScoreAfter,
        totalScoreAfter: event.payload.totalScoreAfter,
        trustClass,
        recordedAt: event.payload.recordedAt,
      };
      mutable.seasonCampaigns[event.payload.seasonId] = {
        ...campaign,
        totalScore: event.payload.totalScoreAfter,
        factionStandings,
        agentStandings,
        objectives,
        contributions: [
          ...campaign.contributions.filter((item) => item.eventId !== contribution.eventId),
          contribution,
        ].sort((left, right) => left.recordedAt.localeCompare(right.recordedAt) || left.eventId.localeCompare(right.eventId)),
      };
      addRegionActivitiesForEventRegions(mutable.regionActivities, mutable.regionActivityIdsByRegion, event, campaign.regionIds, {
        kind: "season",
        agentId: event.payload.agentId,
        title: "赛季贡献",
        summary: `${event.payload.agentId} 为 ${event.payload.factionId} 投入 ${event.payload.amount} ${event.payload.resourceId}，赛季分 +${event.payload.scoreDelta}${event.payload.organizationBonusScore > 0 ? `（组织训练厅 +${event.payload.organizationBonusScore}）` : ""}，总分 ${event.payload.totalScoreAfter}。`,
        occurredAt: event.payload.recordedAt,
        sourceEventType: "season_contribution_recorded",
      });
      break;
    }
    case "season_objective_completed": {
      const objective = mutable.seasonObjectives[event.payload.objectiveId];
      if (!objective) throw new Error("season_objective_not_found");
      const completedObjective: EpochSeasonObjective = {
        ...objective,
        status: "completed",
        progressScore: event.payload.progressScore,
        sourceEventId: event.payload.sourceEventId,
        completedAt: event.payload.completedAt,
        completedByAgentId: event.payload.completedByAgentId,
        completedByExplorerId: event.payload.completedByExplorerId,
        completedByFactionId: event.payload.completedByFactionId,
      };
      mutable.seasonObjectives[event.payload.objectiveId] = completedObjective;
      const campaign = mutable.seasonCampaigns[event.payload.seasonId];
      if (campaign) {
        mutable.seasonCampaigns[event.payload.seasonId] = {
          ...campaign,
          objectives: (mutable.seasonObjectiveIdsBySeason[event.payload.seasonId] || [])
            .map((objectiveId) => mutable.seasonObjectives[objectiveId])
            .filter((seasonObjective): seasonObjective is EpochSeasonObjective => Boolean(seasonObjective)),
        };
        addRegionActivitiesForEventRegions(mutable.regionActivities, mutable.regionActivityIdsByRegion, event, campaign.regionIds, {
          kind: "season",
          agentId: event.payload.completedByAgentId,
          title: "赛季目标完成",
          summary: `${event.payload.completedByFactionId} 完成 ${objective.title}，进度 ${event.payload.progressScore}/${event.payload.targetScore}。`,
          occurredAt: event.payload.completedAt,
          sourceEventType: "season_objective_completed",
        });
      }
      break;
    }
    case "season_campaign_resolved": {
      const campaign = mutable.seasonCampaigns[event.payload.seasonId];
      if (!campaign) throw new Error("season_campaign_not_found");
      mutable.seasonCampaigns[event.payload.seasonId] = {
        ...campaign,
        status: "resolved",
        resolvedAt: event.payload.resolvedAt,
        winningFactionId: event.payload.winningFactionId,
        winnerAgentId: event.payload.winnerAgentId,
        winnerExplorerId: event.payload.winnerExplorerId,
        winningScore: event.payload.winningScore,
      };
      addRegionActivitiesForEventRegions(mutable.regionActivities, mutable.regionActivityIdsByRegion, event, campaign.regionIds, {
        kind: "season",
        agentId: event.payload.winnerAgentId || "server",
        title: "赛季结算",
        summary: `${campaign.title} 完成结算，胜者阵营 ${event.payload.winningFactionId || "暂无"}，胜者 ${event.payload.winnerAgentId || "暂无"}，分数 ${event.payload.winningScore}。`,
        occurredAt: event.payload.resolvedAt,
        sourceEventType: "season_campaign_resolved",
      });
      break;
    }
    case "season_resolved": {
      const campaign = mutable.seasonCampaigns[event.payload.seasonId];
      if (!campaign) throw new Error("season_campaign_not_found");
      const phaseEvent: EpochSeasonPhaseEvent = {
        eventId: event.eventId,
        eventType: "season_resolved",
        phase: event.payload.phase,
        sourceEventId: event.payload.sourceEventId,
        relatedEventIds: event.payload.relatedEventIds,
        at: event.payload.resolvedAt,
      };
      mutable.seasonCampaigns[event.payload.seasonId] = {
        ...campaign,
        status: "resolved",
        phaseEvents: [
          ...campaign.phaseEvents.filter((existing) => existing.eventId !== event.eventId),
          phaseEvent,
        ],
      };
      addRegionActivitiesForEventRegions(mutable.regionActivities, mutable.regionActivityIdsByRegion, event, campaign.regionIds, {
        kind: "season",
        agentId: event.payload.winnerAgentId || "server",
        title: "赛季归档",
        summary: `${campaign.title} 已归档，胜者阵营 ${event.payload.winningFactionId || "暂无"}，关联事件 ${event.payload.relatedEventIds.length} 个。`,
        occurredAt: event.payload.resolvedAt,
        sourceEventType: "season_resolved",
      });
      break;
    }
    case "agent_faction_standing_changed": {
      const payload = event.payload;
      const existing = mutable.agentFactionStandings[payload.standingId];
      mutable.agentFactionStandings[payload.standingId] = {
        standingId: payload.standingId,
        agentId: payload.agentId,
        explorerId: payload.explorerId,
        factionId: payload.factionId,
        score: payload.standingAfter,
        routeIds: uniqueValues([...(existing?.routeIds || []), payload.routeId]),
        journeyIds: uniqueValues([...(existing?.journeyIds || []), payload.journeyId]),
        sourceEventIds: uniqueValues([...(existing?.sourceEventIds || []), payload.sourceEventId]),
        updatedAt: payload.changedAt,
        worldMinute: payload.worldMinute,
      };
      mutable.factionStandingIdsByAgent[payload.agentId] = uniqueValues([
        ...(mutable.factionStandingIdsByAgent[payload.agentId] || []),
        payload.standingId,
      ]);
      mutable.factionStandingIdsByFaction[payload.factionId] = uniqueValues([
        ...(mutable.factionStandingIdsByFaction[payload.factionId] || []),
        payload.standingId,
      ]);
      break;
    }
    case "region_influence_changed": {
      const payload = event.payload;
      mutable.regionInfluenceChanges[payload.influenceId] = {
        influenceId: payload.influenceId,
        regionId: payload.regionId,
        agentId: payload.agentId,
        explorerId: payload.explorerId,
        influenceDelta: payload.influenceDelta,
        influenceScoreAfter: payload.influenceScoreAfter,
        reason: payload.reason,
        sourceEventId: payload.sourceEventId,
        sourceEventType: payload.sourceEventType,
        sourceAggregateId: payload.sourceAggregateId,
        changedAt: payload.changedAt,
        ...(payload.worldMinute === undefined ? {} : { worldMinute: payload.worldMinute }),
      };
      mutable.regionInfluenceIdsByRegion[payload.regionId] = [
        ...(mutable.regionInfluenceIdsByRegion[payload.regionId] || []),
        payload.influenceId,
      ].filter((influenceId, index, influenceIds) => influenceIds.indexOf(influenceId) === index);
      mutable.regionInfluenceIdsByAgent[payload.agentId] = [
        ...(mutable.regionInfluenceIdsByAgent[payload.agentId] || []),
        payload.influenceId,
      ].filter((influenceId, index, influenceIds) => influenceIds.indexOf(influenceId) === index);
      break;
    }
    case "trace_created": {
      const payload = event.payload;
      mutable.conflictTraces[payload.traceId] = {
        traceId: payload.traceId,
        regionId: payload.regionId,
        title: payload.title,
        summary: payload.summary,
        sourceEventType: payload.sourceEventType,
        sourceEventIds: payload.sourceEventIds,
        sourceAggregateId: payload.sourceAggregateId,
        relatedInfluenceIds: payload.relatedInfluenceIds,
        participantAgentIds: payload.participantAgentIds,
        participantExplorerIds: payload.participantExplorerIds,
        scoutAgentIds: payload.scoutAgentIds,
        parentTraceId: payload.parentTraceId,
        createdAt: payload.createdAt,
      };
      mutable.traceIdsByRegion[payload.regionId] = [
        ...(mutable.traceIdsByRegion[payload.regionId] || []),
        payload.traceId,
      ].filter((traceId, index, traceIds) => traceIds.indexOf(traceId) === index);
      for (const agentId of payload.participantAgentIds) {
        mutable.traceIdsByAgent[agentId] = [
          ...(mutable.traceIdsByAgent[agentId] || []),
          payload.traceId,
        ].filter((traceId, index, traceIds) => traceIds.indexOf(traceId) === index);
      }
      break;
    }
    case "region_control_changed": {
      mutable.regionControls[event.payload.regionId] = {
        regionId: event.payload.regionId,
        controllingFactionId: event.payload.controllingFactionId,
        previousControllingFactionId: event.payload.previousControllingFactionId,
        controlScore: event.payload.controlScore,
        contestedByFactionId: event.payload.contestedByFactionId,
        controlMargin: event.payload.controlMargin,
        sourceSeasonId: event.payload.sourceSeasonId,
        sourceReleaseId: event.payload.sourceReleaseId,
        previousControlSourceSeasonId: event.payload.previousControlSourceSeasonId,
        claimingAgentId: event.payload.claimingAgentId,
        claimingExplorerId: event.payload.claimingExplorerId,
        updatedAt: event.payload.changedAt,
      };
      break;
    }
    case "region_control_decayed": {
      const existing = mutable.regionControls[event.payload.regionId];
      if (!existing) break;
      mutable.regionControls[event.payload.regionId] = {
        ...existing,
        controlScore: event.payload.scoreAfter,
        controlMargin: event.payload.controlMarginAfter,
        updatedAt: event.payload.decayedAt,
      };
      break;
    }
    case "region_control_released": {
      delete mutable.regionControls[event.payload.regionId];
      break;
    }
    case "region_revolt_resolved": {
      addRegionActivityForEvent(mutable.regionActivities, mutable.regionActivityIdsByRegion, event, {
        regionId: event.payload.regionId,
        kind: "revolt",
        agentId: event.payload.rebelAgentId,
        title: "区域起义",
        summary: `${event.payload.rebelAgentId} 代表 ${event.payload.rebelFactionId} 发起控制起义，结果 ${event.payload.outcome}，攻防 ${event.payload.rebelPower}/${event.payload.defenderPower}。`,
        occurredAt: event.payload.resolvedAt,
        sourceEventType: "region_revolt_resolved",
      });
      break;
    }
    case "region_monument_built": {
      mutable.regionMonuments[event.payload.monumentId] = {
        monumentId: event.payload.monumentId,
        regionId: event.payload.regionId,
        title: event.payload.title,
        description: event.payload.description,
        controllingFactionId: event.payload.controllingFactionId,
        winnerAgentId: event.payload.winnerAgentId,
        winnerExplorerId: event.payload.winnerExplorerId,
        sourceSeasonId: event.payload.sourceSeasonId,
        controlScore: event.payload.controlScore,
        builtAt: event.payload.builtAt,
      };
      mutable.regionMonumentIdsByRegion[event.payload.regionId] = [
        ...(mutable.regionMonumentIdsByRegion[event.payload.regionId] || []),
        event.payload.monumentId,
      ].filter((monumentId, index, monumentIds) => monumentIds.indexOf(monumentId) === index);
      break;
    }
  }
}

// ============================================================================
// TRADE REDUCER
// ============================================================================

export function applyTradeEvent(
  mutable: MutableProjection,
  event: EpochEvent,
  _projection: EpochProjection,
): void {
  switch (event.eventType) {
    case "market_order_created": {
      const sellKind = event.payload.sellKind || "resource";
      const regionId = normalizeMarketRegionId(event.payload.regionId);
      mutable.marketOrders[event.payload.orderId] = {
        orderId: event.payload.orderId,
        regionId,
        sellerAgentId: event.payload.sellerAgentId,
        sellerExplorerId: event.payload.sellerExplorerId,
        sellKind,
        sellResourceId: event.payload.sellResourceId,
        sellAmount: event.payload.sellAmount,
        sellItemId: event.payload.sellItemId,
        sellItemKey: event.payload.sellItemKey,
        sellItemDisplayName: event.payload.sellItemDisplayName,
        sellItemRarity: event.payload.sellItemRarity,
        priceResourceId: event.payload.priceResourceId,
        priceAmount: event.payload.priceAmount,
        status: "open",
        createdAt: event.payload.createdAt,
      };
      if (sellKind === "item" && event.payload.sellItemId) {
        const item = mutable.inventoryItems[event.payload.sellItemId];
        if (!item) throw new Error("inventory_item_not_found");
        mutable.inventoryItems[event.payload.sellItemId] = {
          ...item,
          marketLockedByOrderId: event.payload.orderId,
        };
      }
      const goodsLabel = sellKind === "item"
        ? event.payload.sellItemDisplayName || event.payload.sellItemKey || event.payload.sellItemId || "物品"
        : `${event.payload.sellAmount} ${event.payload.sellResourceId}`;
      addRegionActivityForEvent(mutable.regionActivities, mutable.regionActivityIdsByRegion, event, {
        regionId,
        kind: "market",
        agentId: event.payload.sellerAgentId,
        title: "市场挂单",
        summary: `${event.payload.sellerAgentId} 在本地市场挂出 ${goodsLabel}，标价 ${event.payload.priceAmount} ${event.payload.priceResourceId}。`,
        occurredAt: event.payload.createdAt,
        sourceEventType: "market_order_created",
      });
      break;
    }
    case "market_order_filled": {
      const order = mutable.marketOrders[event.payload.orderId];
      if (!order) throw new Error("market_order_not_found");
      mutable.marketOrders[event.payload.orderId] = {
        ...order,
        status: "filled",
        buyerAgentId: event.payload.buyerAgentId,
        buyerExplorerId: event.payload.buyerExplorerId,
        marketFeeResourceId: event.payload.marketFeeResourceId,
        marketFeeAmount: event.payload.marketFeeAmount,
        sellerProceedsAmount: event.payload.sellerProceedsAmount,
        transferredItemId: event.payload.transferredItemId,
        tradeRiskFlags: event.payload.tradeRiskFlags || [],
        tradeRiskScore: event.payload.tradeRiskScore ?? 0,
        filledAt: event.payload.filledAt,
      };
      const goodsLabel = order.sellKind === "item"
        ? order.sellItemDisplayName || order.sellItemKey || order.sellItemId || "物品"
        : `${order.sellAmount} ${order.sellResourceId}`;
      addRegionActivityForEvent(mutable.regionActivities, mutable.regionActivityIdsByRegion, event, {
        regionId: order.regionId,
        kind: "market",
        agentId: event.payload.buyerAgentId,
        title: "市场成交",
        summary: `${event.payload.buyerAgentId} 买下 ${order.sellerAgentId} 挂出的 ${goodsLabel}，成交价 ${order.priceAmount} ${order.priceResourceId}。`,
        occurredAt: event.payload.filledAt,
        sourceEventType: "market_order_filled",
      });
      break;
    }
    case "market_order_cancelled": {
      const order = mutable.marketOrders[event.payload.orderId];
      if (!order) throw new Error("market_order_not_found");
      mutable.marketOrders[event.payload.orderId] = {
        ...order,
        status: "cancelled",
        cancelledAt: event.payload.cancelledAt,
      };
      if (order.sellKind === "item" && order.sellItemId) {
        const item = mutable.inventoryItems[order.sellItemId];
        if (item?.marketLockedByOrderId === order.orderId) {
          mutable.inventoryItems[order.sellItemId] = {
            ...item,
            marketLockedByOrderId: undefined,
          };
        }
      }
      addRegionActivityForEvent(mutable.regionActivities, mutable.regionActivityIdsByRegion, event, {
        regionId: order.regionId,
        kind: "market",
        agentId: event.payload.sellerAgentId,
        title: "市场撤单",
        summary: `${event.payload.sellerAgentId} 撤回本地市场订单 ${event.payload.orderId}。`,
        occurredAt: event.payload.cancelledAt,
        sourceEventType: "market_order_cancelled",
      });
      break;
    }
    case "market_order_expired": {
      const order = mutable.marketOrders[event.payload.orderId];
      if (!order) throw new Error("market_order_not_found");
      mutable.marketOrders[event.payload.orderId] = {
        ...order,
        status: "expired",
        expiredAt: event.payload.expiredAt,
      };
      if (order.sellKind === "item" && order.sellItemId) {
        const item = mutable.inventoryItems[order.sellItemId];
        if (item?.marketLockedByOrderId === order.orderId) {
          mutable.inventoryItems[order.sellItemId] = {
            ...item,
            marketLockedByOrderId: undefined,
          };
        }
      }
      addRegionActivityForEvent(mutable.regionActivities, mutable.regionActivityIdsByRegion, event, {
        regionId: order.regionId,
        kind: "market",
        agentId: event.payload.sellerAgentId,
        title: "市场过期",
        summary: `${event.payload.sellerAgentId} 的本地市场订单 ${event.payload.orderId} 超时退回，最大挂单时长 ${event.payload.maxAgeSeconds} 秒。`,
        occurredAt: event.payload.expiredAt,
        sourceEventType: "market_order_expired",
      });
      break;
    }
    case "direct_trade_created": {
      const payload = event.payload;
      const offeredAsset = directTradeAssetFromPayload(payload.offeredAsset);
      const requestedAsset = directTradeAssetFromPayload(payload.requestedAsset);
      mutable.directTrades[payload.tradeId] = {
        tradeId: payload.tradeId,
        regionId: normalizeMarketRegionId(payload.regionId),
        proposerAgentId: payload.proposerAgentId,
        proposerExplorerId: payload.proposerExplorerId,
        counterpartyAgentId: payload.counterpartyAgentId,
        counterpartyExplorerId: payload.counterpartyExplorerId,
        offeredAsset,
        requestedAsset,
        status: "open",
        createdAt: payload.createdAt,
      };
      if (offeredAsset.kind === "item" && offeredAsset.itemId) {
        const item = mutable.inventoryItems[offeredAsset.itemId];
        if (!item) throw new Error("inventory_item_not_found");
        mutable.inventoryItems[offeredAsset.itemId] = {
          ...item,
          marketLockedByOrderId: payload.tradeId,
        };
      }
      addRegionActivityForEvent(mutable.regionActivities, mutable.regionActivityIdsByRegion, event, {
        regionId: normalizeMarketRegionId(payload.regionId),
        kind: "market",
        agentId: payload.proposerAgentId,
        title: "直交易创建",
        summary: `${payload.proposerAgentId} 向 ${payload.counterpartyAgentId} 发起直交易：${directTradeAssetLabel(offeredAsset)} 换 ${directTradeAssetLabel(requestedAsset)}。`,
        occurredAt: payload.createdAt,
        sourceEventType: "direct_trade_created",
      });
      break;
    }
    case "direct_trade_accepted": {
      const trade = mutable.directTrades[event.payload.tradeId];
      if (!trade) throw new Error("direct_trade_not_found");
      mutable.directTrades[event.payload.tradeId] = {
        ...trade,
        status: "accepted",
        transferredOfferedItemId: event.payload.transferredOfferedItemId,
        transferredRequestedItemId: event.payload.transferredRequestedItemId,
        tradeRiskFlags: event.payload.tradeRiskFlags || [],
        tradeRiskScore: event.payload.tradeRiskScore ?? 0,
        acceptedAt: event.payload.acceptedAt,
      };
      addRegionActivityForEvent(mutable.regionActivities, mutable.regionActivityIdsByRegion, event, {
        regionId: trade.regionId,
        kind: "market",
        agentId: event.payload.counterpartyAgentId,
        title: "直交易成交",
        summary: `${event.payload.counterpartyAgentId} 接受 ${event.payload.proposerAgentId} 的直交易：${directTradeAssetLabel(trade.offeredAsset)} 换 ${directTradeAssetLabel(trade.requestedAsset)}。`,
        occurredAt: event.payload.acceptedAt,
        sourceEventType: "direct_trade_accepted",
      });
      break;
    }
    case "direct_trade_cancelled": {
      const trade = mutable.directTrades[event.payload.tradeId];
      if (!trade) throw new Error("direct_trade_not_found");
      mutable.directTrades[event.payload.tradeId] = {
        ...trade,
        status: "cancelled",
        cancelledAt: event.payload.cancelledAt,
      };
      if (trade.offeredAsset.kind === "item" && trade.offeredAsset.itemId) {
        const item = mutable.inventoryItems[trade.offeredAsset.itemId];
        if (item?.marketLockedByOrderId === trade.tradeId) {
          mutable.inventoryItems[trade.offeredAsset.itemId] = {
            ...item,
            marketLockedByOrderId: undefined,
          };
        }
      }
      addRegionActivityForEvent(mutable.regionActivities, mutable.regionActivityIdsByRegion, event, {
        regionId: trade.regionId,
        kind: "market",
        agentId: event.payload.proposerAgentId,
        title: "直交易取消",
        summary: `${event.payload.proposerAgentId} 取消直交易 ${event.payload.tradeId}。`,
        occurredAt: event.payload.cancelledAt,
        sourceEventType: "direct_trade_cancelled",
      });
      break;
    }
    case "direct_trade_expired": {
      const trade = mutable.directTrades[event.payload.tradeId];
      if (!trade) throw new Error("direct_trade_not_found");
      mutable.directTrades[event.payload.tradeId] = {
        ...trade,
        status: "expired",
        expiredAt: event.payload.expiredAt,
      };
      if (trade.offeredAsset.kind === "item" && trade.offeredAsset.itemId) {
        const item = mutable.inventoryItems[trade.offeredAsset.itemId];
        if (item?.marketLockedByOrderId === trade.tradeId) {
          mutable.inventoryItems[trade.offeredAsset.itemId] = {
            ...item,
            marketLockedByOrderId: undefined,
          };
        }
      }
      addRegionActivityForEvent(mutable.regionActivities, mutable.regionActivityIdsByRegion, event, {
        regionId: trade.regionId,
        kind: "market",
        agentId: event.payload.proposerAgentId,
        title: "直交易过期",
        summary: `${event.payload.proposerAgentId} 的直交易 ${event.payload.tradeId} 超时退回，最大保留时长 ${event.payload.maxAgeSeconds} 秒。`,
        occurredAt: event.payload.expiredAt,
        sourceEventType: "direct_trade_expired",
      });
      break;
    }
    case "bounty_created": {
      const payload = event.payload;
      mutable.bounties[payload.bountyId] = {
        bountyId: payload.bountyId,
        regionId: payload.regionId,
        sponsorAgentId: payload.sponsorAgentId,
        sponsorExplorerId: payload.sponsorExplorerId,
        title: payload.title,
        description: payload.description,
        rewardResourceId: payload.rewardResourceId,
        rewardAmount: payload.rewardAmount,
        requiredItemKey: payload.requiredItemKey,
        status: "open",
        createdAt: payload.createdAt,
      };
      mutable.bountyIdsByRegion[payload.regionId] = [
        ...(mutable.bountyIdsByRegion[payload.regionId] || []),
        payload.bountyId,
      ].filter((bountyId, index, bountyIds) => bountyIds.indexOf(bountyId) === index);
      mutable.bountyIdsByAgent[payload.sponsorAgentId] = [
        ...(mutable.bountyIdsByAgent[payload.sponsorAgentId] || []),
        payload.bountyId,
      ].filter((bountyId, index, bountyIds) => bountyIds.indexOf(bountyId) === index);
      addRegionActivityForEvent(mutable.regionActivities, mutable.regionActivityIdsByRegion, event, {
        regionId: payload.regionId,
        kind: "bounty",
        agentId: payload.sponsorAgentId,
        title: "悬赏发布",
        summary: `${payload.sponsorAgentId} 发布悬赏 ${payload.title}，奖励 ${payload.rewardResourceId}+${payload.rewardAmount}。`,
        occurredAt: payload.createdAt,
        sourceEventType: "bounty_created",
      });
      break;
    }
    case "bounty_claimed": {
      const bounty = mutable.bounties[event.payload.bountyId];
      if (!bounty) throw new Error("bounty_not_found");
      mutable.bounties[event.payload.bountyId] = {
        ...bounty,
        status: "claimed",
        claimantAgentId: event.payload.claimantAgentId,
        claimantExplorerId: event.payload.claimantExplorerId,
        transferredItemId: event.payload.transferredItemId,
        evidence: event.payload.evidence,
        claimedAt: event.payload.claimedAt,
      };
      mutable.bountyIdsByAgent[event.payload.claimantAgentId] = [
        ...(mutable.bountyIdsByAgent[event.payload.claimantAgentId] || []),
        event.payload.bountyId,
      ].filter((bountyId, index, bountyIds) => bountyIds.indexOf(bountyId) === index);
      addRegionActivityForEvent(mutable.regionActivities, mutable.regionActivityIdsByRegion, event, {
        regionId: bounty.regionId,
        kind: "bounty",
        agentId: event.payload.claimantAgentId,
        title: "悬赏完成",
        summary: `${event.payload.claimantAgentId} 完成悬赏 ${bounty.title}，证据已由服务器记录。`,
        occurredAt: event.payload.claimedAt,
        sourceEventType: "bounty_claimed",
      });
      break;
    }
    case "item_created": {
      const payload = event.payload;
      mutable.inventoryItems[payload.itemId] = {
        itemId: payload.itemId,
        agentId: payload.agentId,
        explorerId: payload.explorerId,
        itemKey: payload.itemKey,
        displayName: payload.displayName,
        rarity: payload.rarity,
        sourceEventIds: payload.sourceEventIds,
        createdAt: payload.createdAt,
        bound: payload.bound,
      };
      mutable.inventoryItemIdsByAgent[payload.agentId] = [
        ...(mutable.inventoryItemIdsByAgent[payload.agentId] || []),
        payload.itemId,
      ].filter((itemId, index, itemIds) => itemIds.indexOf(itemId) === index);
      mutable.inventoryItemIdsByExplorer[payload.explorerId] = [
        ...(mutable.inventoryItemIdsByExplorer[payload.explorerId] || []),
        payload.itemId,
      ].filter((itemId, index, itemIds) => itemIds.indexOf(itemId) === index);
      break;
    }
    case "item_bound": {
      const payload = event.payload;
      const item = mutable.inventoryItems[payload.itemId];
      if (!item) throw new Error("inventory_item_not_found");
      mutable.inventoryItems[payload.itemId] = {
        ...item,
        bound: true,
        boundAt: payload.boundAt,
        boundReason: payload.reason,
      };
      break;
    }
    case "item_transferred": {
      const payload = event.payload;
      const item = mutable.inventoryItems[payload.itemId];
      if (!item) throw new Error("inventory_item_not_found");
      mutable.inventoryItemIdsByAgent[payload.fromAgentId] = (mutable.inventoryItemIdsByAgent[payload.fromAgentId] || [])
        .filter((itemId) => itemId !== payload.itemId);
      mutable.inventoryItemIdsByExplorer[payload.fromExplorerId] = (mutable.inventoryItemIdsByExplorer[payload.fromExplorerId] || [])
        .filter((itemId) => itemId !== payload.itemId);
      mutable.inventoryItemIdsByAgent[payload.toAgentId] = [
        ...(mutable.inventoryItemIdsByAgent[payload.toAgentId] || []),
        payload.itemId,
      ].filter((itemId, index, itemIds) => itemIds.indexOf(itemId) === index);
      mutable.inventoryItemIdsByExplorer[payload.toExplorerId] = [
        ...(mutable.inventoryItemIdsByExplorer[payload.toExplorerId] || []),
        payload.itemId,
      ].filter((itemId, index, itemIds) => itemIds.indexOf(itemId) === index);
      mutable.inventoryItems[payload.itemId] = {
        ...item,
        agentId: payload.toAgentId,
        explorerId: payload.toExplorerId,
        marketLockedByOrderId: undefined,
        transferredAt: payload.transferredAt,
        transferSourceOrderId: payload.sourceOrderId,
      };
      break;
    }
    case "social_hook_created": {
      const payload = event.payload;
      const hook = {
        hookId: payload.hookId,
        regionId: payload.regionId,
        npcId: payload.npcId,
        kind: payload.kind,
        title: payload.title,
        body: payload.body,
        actionLabel: payload.actionLabel,
        risk: payload.risk,
        sourceEventIds: payload.sourceEventIds,
        createdAt: payload.createdAt,
      };
      mutable.socialHooks[payload.hookId] = hook;
      mutable.socialHookIdsByRegion[payload.regionId] = [
        ...(mutable.socialHookIdsByRegion[payload.regionId] || []),
        payload.hookId,
      ].filter((hookId, index, hookIds) => hookIds.indexOf(hookId) === index);
      if (payload.npcId) {
        mutable.socialHookIdsByNpc[payload.npcId] = [
          ...(mutable.socialHookIdsByNpc[payload.npcId] || []),
          payload.hookId,
        ].filter((hookId, index, hookIds) => hookIds.indexOf(hookId) === index);
      }
      break;
    }
  }
}

// ============================================================================
// COMBAT REDUCER
// ============================================================================

export function applyCombatEvent(
  mutable: MutableProjection,
  event: EpochEvent,
  _projection: EpochProjection,
): void {
  switch (event.eventType) {
    case "party_run_created": {
      const payload = event.payload;
      const leaderMember: EpochPartyMember = {
        agentId: payload.leaderAgentId,
        explorerId: payload.leaderExplorerId,
        participantRole: payload.participantRole,
        joinedAt: payload.createdAt,
      };
      mutable.partyRuns[payload.partyRunId] = {
        partyRunId: payload.partyRunId,
        regionId: payload.regionId,
        leaderAgentId: payload.leaderAgentId,
        leaderExplorerId: payload.leaderExplorerId,
        title: payload.title,
        objective: payload.objective,
        joinPolicy: payload.joinPolicy || "open",
        inviteTokenHash: payload.inviteTokenHash,
        inviteTokenExpiresAt: payload.inviteTokenExpiresAt,
        inviteTokenUseLimit: payload.inviteTokenUseLimit,
        inviteTokenUses: payload.inviteTokenUses,
        inviteRecipientAgentId: payload.inviteRecipientAgentId,
        status: "open",
        members: [leaderMember],
        joinRequests: [],
        createdAt: payload.createdAt,
        updatedAt: payload.createdAt,
      };
      mutable.partyRunIdsByRegion[payload.regionId] = [
        ...(mutable.partyRunIdsByRegion[payload.regionId] || []),
        payload.partyRunId,
      ].filter((partyRunId, index, partyRunIds) => partyRunIds.indexOf(partyRunId) === index);
      addRegionActivityForEvent(mutable.regionActivities, mutable.regionActivityIdsByRegion, event, {
        regionId: payload.regionId,
        kind: "party_run",
        agentId: payload.leaderAgentId,
        title: "小队开启",
        summary: `${payload.leaderAgentId} 开启小队 ${payload.title}，目标：${payload.objective}`,
        occurredAt: payload.createdAt,
        sourceEventType: "party_run_created",
      });
      break;
    }
    case "party_invite_updated": {
      const payload = event.payload;
      const partyRun = mutable.partyRuns[payload.partyRunId];
      if (!partyRun) throw new Error("party_run_not_found");
      mutable.partyRuns[payload.partyRunId] = {
        ...partyRun,
        joinPolicy: "invite_only",
        inviteTokenHash: payload.inviteTokenHash,
        inviteTokenExpiresAt: payload.inviteTokenExpiresAt,
        inviteTokenUseLimit: payload.inviteTokenUseLimit,
        inviteTokenUses: payload.inviteTokenUses,
        inviteRecipientAgentId: payload.inviteRecipientAgentId,
        inviteTokenRevokedAt: payload.inviteTokenRevokedAt,
        updatedAt: payload.updatedAt,
      };
      addRegionActivityForEvent(mutable.regionActivities, mutable.regionActivityIdsByRegion, event, {
        regionId: payload.regionId,
        kind: "party_run",
        agentId: payload.leaderAgentId,
        title: payload.updateKind === "revoked" ? "小队邀请撤销" : "小队邀请更新",
        summary: payload.updateKind === "revoked"
          ? `${payload.leaderAgentId} 撤销了小队邀请。`
          : `${payload.leaderAgentId} 更新了小队邀请。`,
        occurredAt: payload.updatedAt,
        sourceEventType: "party_invite_updated",
      });
      break;
    }
    case "party_join_requested": {
      const payload = event.payload;
      const partyRun = mutable.partyRuns[payload.partyRunId];
      if (!partyRun) throw new Error("party_run_not_found");
      const request: EpochPartyJoinRequest = {
        requestId: payload.requestId,
        partyRunId: payload.partyRunId,
        agentId: payload.agentId,
        explorerId: payload.explorerId,
        participantRole: payload.participantRole,
        status: "pending",
        requestNote: payload.requestNote,
        requestedAt: payload.requestedAt,
      };
      mutable.partyRuns[payload.partyRunId] = {
        ...partyRun,
        joinRequests: [
          ...(partyRun.joinRequests || []).filter((existing) => existing.requestId !== payload.requestId),
          request,
        ],
        updatedAt: payload.requestedAt,
      };
      addRegionActivityForEvent(mutable.regionActivities, mutable.regionActivityIdsByRegion, event, {
        regionId: payload.regionId,
        kind: "party_run",
        agentId: payload.agentId,
        title: "小队加入申请",
        summary: `${payload.agentId} 申请以 ${payload.participantRole} 加入小队 ${partyRun.title}。`,
        occurredAt: payload.requestedAt,
        sourceEventType: "party_join_requested",
      });
      break;
    }
    case "party_join_request_resolved": {
      const payload = event.payload;
      const partyRun = mutable.partyRuns[payload.partyRunId];
      if (!partyRun) throw new Error("party_run_not_found");
      const existingRequest = (partyRun.joinRequests || []).find((request) => request.requestId === payload.requestId);
      if (!existingRequest) throw new Error("party_join_request_not_found");
      const updatedRequest: EpochPartyJoinRequest = {
        ...existingRequest,
        status: payload.resolution,
        resolvedAt: payload.resolvedAt,
        resolvedByAgentId: payload.resolvedByAgentId,
        resolvedByExplorerId: payload.resolvedByExplorerId,
        resolutionNote: payload.resolutionNote,
      };
      mutable.partyRuns[payload.partyRunId] = {
        ...partyRun,
        joinRequests: [
          ...(partyRun.joinRequests || []).filter((request) => request.requestId !== payload.requestId),
          updatedRequest,
        ],
        updatedAt: payload.resolvedAt,
      };
      addRegionActivityForEvent(mutable.regionActivities, mutable.regionActivityIdsByRegion, event, {
        regionId: payload.regionId,
        kind: "party_run",
        agentId: payload.agentId,
        title: payload.resolution === "approved" ? "小队申请批准" : "小队申请拒绝",
        summary: `${payload.resolvedByAgentId} ${payload.resolution === "approved" ? "批准" : "拒绝"}了 ${payload.agentId} 的加入申请。`,
        occurredAt: payload.resolvedAt,
        sourceEventType: "party_join_request_resolved",
      });
      break;
    }
    case "party_member_joined": {
      const payload = event.payload;
      const partyRun = mutable.partyRuns[payload.partyRunId];
      if (!partyRun) throw new Error("party_run_not_found");
      const member: EpochPartyMember = {
        agentId: payload.agentId,
        explorerId: payload.explorerId,
        participantRole: payload.participantRole,
        joinedAt: payload.joinedAt,
      };
      mutable.partyRuns[payload.partyRunId] = {
        ...partyRun,
        members: [
          ...partyRun.members.filter((existing) => existing.agentId !== payload.agentId),
          member,
        ],
        inviteTokenUses: payload.inviteTokenUsed ? (partyRun.inviteTokenUses || 0) + 1 : partyRun.inviteTokenUses,
        updatedAt: payload.joinedAt,
      };
      addRegionActivityForEvent(mutable.regionActivities, mutable.regionActivityIdsByRegion, event, {
        regionId: payload.regionId,
        kind: "party_run",
        agentId: payload.agentId,
        title: "小队加入",
        summary: `${payload.agentId} 以 ${payload.participantRole} 加入小队 ${partyRun.title}。`,
        occurredAt: payload.joinedAt,
        sourceEventType: "party_member_joined",
      });
      break;
    }
    case "party_run_settled": {
      const payload = event.payload;
      const partyRun = mutable.partyRuns[payload.partyRunId];
      if (!partyRun) throw new Error("party_run_not_found");
      mutable.partyRuns[payload.partyRunId] = {
        ...partyRun,
        status: "settled",
        totalScore: payload.totalScore,
        memberResults: payload.memberResults,
        traceId: payload.traceId,
        newsId: payload.newsId,
        settledAt: payload.settledAt,
        updatedAt: payload.settledAt,
      };
      addRegionActivityForEvent(mutable.regionActivities, mutable.regionActivityIdsByRegion, event, {
        regionId: payload.regionId,
        kind: "party_run",
        agentId: partyRun.leaderAgentId,
        title: "小队结算",
        summary: `${partyRun.title} 完成结算，总分 ${payload.totalScore}。`,
        occurredAt: payload.settledAt,
        sourceEventType: "party_run_settled",
      });
      break;
    }
    case "raid_resolved": {
      mutable.raidResults[event.payload.raidId] = {
        raidId: event.payload.raidId,
        regionId: event.payload.regionId,
        attackerAgentId: event.payload.attackerAgentId,
        attackerExplorerId: event.payload.attackerExplorerId,
        defenderAgentId: event.payload.defenderAgentId,
        defenderExplorerId: event.payload.defenderExplorerId,
        staminaSpent: event.payload.staminaSpent,
        attackerPower: event.payload.attackerPower,
        defenderPower: event.payload.defenderPower,
        outcome: event.payload.outcome,
        reward: event.payload.reward,
        resolvedAt: event.payload.resolvedAt,
      };
      mutable.raidIdsByRegion[event.payload.regionId] = [
        ...(mutable.raidIdsByRegion[event.payload.regionId] || []),
        event.payload.raidId,
      ].filter((raidId, index, raidIds) => raidIds.indexOf(raidId) === index);
      addRegionActivityForEvent(mutable.regionActivities, mutable.regionActivityIdsByRegion, event, {
        regionId: event.payload.regionId,
        kind: "raid",
        agentId: event.payload.outcome === "attacker_won" ? event.payload.attackerAgentId : event.payload.defenderAgentId,
        title: "突袭结算",
        summary: `${event.payload.attackerAgentId} 突袭 ${event.payload.defenderAgentId}，结果 ${event.payload.outcome}，攻防 ${event.payload.attackerPower}/${event.payload.defenderPower}。`,
        occurredAt: event.payload.resolvedAt,
        sourceEventType: "raid_resolved",
      });
      break;
    }
    case "retaliation_opportunity_created": {
      mutable.retaliationOpportunities[event.payload.retaliationId] = {
        retaliationId: event.payload.retaliationId,
        regionId: event.payload.regionId,
        sourceRaidId: event.payload.sourceRaidId,
        sourceTraceId: event.payload.sourceTraceId,
        opportunityAgentId: event.payload.opportunityAgentId,
        opportunityExplorerId: event.payload.opportunityExplorerId,
        targetAgentId: event.payload.targetAgentId,
        targetExplorerId: event.payload.targetExplorerId,
        status: event.payload.status,
        reason: event.payload.reason,
        sourceEventIds: event.payload.sourceEventIds,
        createdAt: event.payload.createdAt,
      };
      mutable.retaliationIdsByRegion[event.payload.regionId] = [
        ...(mutable.retaliationIdsByRegion[event.payload.regionId] || []),
        event.payload.retaliationId,
      ].filter((retaliationId, index, retaliationIds) => retaliationIds.indexOf(retaliationId) === index);
      for (const agentId of uniqueValues([event.payload.opportunityAgentId, event.payload.targetAgentId])) {
        mutable.retaliationIdsByAgent[agentId] = [
          ...(mutable.retaliationIdsByAgent[agentId] || []),
          event.payload.retaliationId,
        ].filter((retaliationId, index, retaliationIds) => retaliationIds.indexOf(retaliationId) === index);
      }
      addRegionActivityForEvent(mutable.regionActivities, mutable.regionActivityIdsByRegion, event, {
        regionId: event.payload.regionId,
        kind: "retaliation",
        agentId: event.payload.opportunityAgentId,
        title: "复仇契机",
        summary: `${event.payload.opportunityAgentId} 获得对 ${event.payload.targetAgentId} 的复仇契机，来源突袭 ${event.payload.sourceRaidId}。`,
        occurredAt: event.payload.createdAt,
        sourceEventType: "retaliation_opportunity_created",
      });
      break;
    }
    case "retaliation_resolved": {
      const existing = mutable.retaliationOpportunities[event.payload.retaliationId];
      mutable.retaliationOpportunities[event.payload.retaliationId] = {
        retaliationId: event.payload.retaliationId,
        regionId: event.payload.regionId,
        sourceRaidId: event.payload.sourceRaidId,
        sourceTraceId: event.payload.sourceTraceId,
        opportunityAgentId: event.payload.opportunityAgentId,
        opportunityExplorerId: event.payload.opportunityExplorerId,
        targetAgentId: event.payload.targetAgentId,
        targetExplorerId: event.payload.targetExplorerId,
        status: "resolved",
        reason: existing?.reason || "retaliation_resolved",
        sourceEventIds: uniqueValues([...(existing?.sourceEventIds || []), event.eventId]),
        createdAt: existing?.createdAt || event.payload.resolvedAt,
        staminaSpent: event.payload.staminaSpent,
        retaliatorPower: event.payload.retaliatorPower,
        targetPower: event.payload.targetPower,
        outcome: event.payload.outcome,
        winnerAgentId: event.payload.winnerAgentId,
        winnerExplorerId: event.payload.winnerExplorerId,
        resolvedAt: event.payload.resolvedAt,
      };
      addRegionActivityForEvent(mutable.regionActivities, mutable.regionActivityIdsByRegion, event, {
        regionId: event.payload.regionId,
        kind: "retaliation",
        agentId: event.payload.winnerAgentId,
        title: "复仇结算",
        summary: `${event.payload.opportunityAgentId} 对 ${event.payload.targetAgentId} 的复仇完成结算，结果 ${event.payload.outcome}，胜者 ${event.payload.winnerAgentId}。`,
        occurredAt: event.payload.resolvedAt,
        sourceEventType: "retaliation_resolved",
      });
      break;
    }
  }
}

// ============================================================================
// DIPLOMACY REDUCER
// ============================================================================

export function applyDiplomacyEvent(
  mutable: MutableProjection,
  event: EpochEvent,
  _projection: EpochProjection,
): void {
  switch (event.eventType) {
    case "diplomacy_proposed": {
      const payload = event.payload;
      mutable.diplomacyRecords[payload.diplomacyId] = {
        diplomacyId: payload.diplomacyId,
        regionId: payload.regionId,
        sourceAgentId: payload.sourceAgentId,
        sourceExplorerId: payload.sourceExplorerId,
        targetAgentId: payload.targetAgentId,
        targetExplorerId: payload.targetExplorerId,
        kind: payload.kind,
        focusSpent: payload.focusSpent,
        terms: payload.terms,
        status: payload.status,
        proposedAt: payload.proposedAt,
      };
      mutable.diplomacyIdsByRegion[payload.regionId] = [
        ...(mutable.diplomacyIdsByRegion[payload.regionId] || []),
        payload.diplomacyId,
      ].filter((diplomacyId, index, diplomacyIds) => diplomacyIds.indexOf(diplomacyId) === index);
      for (const agentId of [payload.sourceAgentId, payload.targetAgentId]) {
        mutable.diplomacyIdsByAgent[agentId] = [
          ...(mutable.diplomacyIdsByAgent[agentId] || []),
          payload.diplomacyId,
        ].filter((diplomacyId, index, diplomacyIds) => diplomacyIds.indexOf(diplomacyId) === index);
      }
      addRegionActivityForEvent(mutable.regionActivities, mutable.regionActivityIdsByRegion, event, {
        regionId: payload.regionId,
        kind: "diplomacy",
        agentId: payload.sourceAgentId,
        title: "外交提案",
        summary: `${payload.sourceAgentId} 向 ${payload.targetAgentId} 发起 ${payload.kind} 外交提案。`,
        occurredAt: payload.proposedAt,
        sourceEventType: "diplomacy_proposed",
      });
      break;
    }
    case "diplomacy_responded": {
      const existing = mutable.diplomacyRecords[event.payload.diplomacyId];
      if (!existing) break;
      mutable.diplomacyRecords[event.payload.diplomacyId] = {
        ...existing,
        status: event.payload.response,
        response: event.payload.response,
        responseFocusSpent: event.payload.focusSpent,
        responseNote: event.payload.note,
        ...(event.payload.relationshipId ? { relationshipId: event.payload.relationshipId } : {}),
        respondedAt: event.payload.respondedAt,
      };
      addRegionActivityForEvent(mutable.regionActivities, mutable.regionActivityIdsByRegion, event, {
        regionId: event.payload.regionId,
        kind: "diplomacy",
        agentId: event.payload.targetAgentId,
        title: "外交回应",
        summary: `${event.payload.targetAgentId} 对 ${event.payload.sourceAgentId} 的外交提案回应为 ${event.payload.response}。`,
        occurredAt: event.payload.respondedAt,
        sourceEventType: "diplomacy_responded",
      });
      break;
    }
    case "relationship_updated": {
      const payload = event.payload;
      mutable.relationshipEdges[payload.relationshipId] = {
        relationshipId: payload.relationshipId,
        sourceAgentId: payload.sourceAgentId,
        sourceExplorerId: payload.sourceExplorerId,
        targetAgentId: payload.targetAgentId,
        targetExplorerId: payload.targetExplorerId,
        kind: payload.kind,
        score: payload.scoreAfter,
        previousScore: payload.previousScore,
        scoreDelta: payload.scoreDelta,
        focusSpent: payload.focusSpent,
        reason: payload.reason,
        updatedAt: payload.updatedAt,
      };
      for (const agentId of [payload.sourceAgentId, payload.targetAgentId]) {
        mutable.relationshipIdsByAgent[agentId] = [
          ...(mutable.relationshipIdsByAgent[agentId] || []),
          payload.relationshipId,
        ].filter((relationshipId, index, relationshipIds) => relationshipIds.indexOf(relationshipId) === index);
      }
      break;
    }
  }
}

// ============================================================================
// TURN/HOSTED REDUCER
// ============================================================================

export function applyTurnHostedEvent(
  mutable: MutableProjection,
  event: EpochEvent,
  _projection: EpochProjection,
): void {
  switch (event.eventType) {
    case "turn_card_created": {
      mutable.turnCards[event.payload.turnCardId] = {
        turnCardId: event.payload.turnCardId,
        agentId: event.payload.agentId,
        explorerId: event.payload.explorerId,
        regionId: event.payload.regionId,
        sequence: event.payload.sequence,
        nonce: event.payload.nonce,
        prompt: event.payload.prompt,
        visibleContext: event.payload.visibleContext,
        status: "open",
        actionOptions: event.payload.actionOptions,
        traceEffects: [],
        createdAt: event.payload.createdAt,
        expiresAt: event.payload.expiresAt,
        signedEnvelope: event.payload.signedEnvelope,
      };
      break;
    }
    case "trace_conflict_effect_applied": {
      const card = mutable.turnCards[event.payload.turnCardId];
      if (!card) throw new Error("trace_conflict_turn_card_not_found");
      mutable.turnCards[event.payload.turnCardId] = {
        ...card,
        traceEffects: [
          ...card.traceEffects,
          {
            traceId: event.payload.traceId,
            effect: event.payload.effect,
            appliedAt: event.payload.appliedAt,
          },
        ],
      };
      break;
    }
    case "turn_resolved": {
      const card = mutable.turnCards[event.payload.turnCardId];
      if (!card) throw new Error("turn_card_not_found");
      const resolution: EpochTurnResolution = {
        turnCardId: event.payload.turnCardId,
        agentId: event.payload.agentId,
        channelClass: event.payload.channelClass,
        envelopeId: event.payload.envelopeId,
        sequence: event.payload.sequence,
        nonce: event.payload.nonce,
        actionOptionId: event.payload.actionOptionId,
        optionLabel: event.payload.optionLabel,
        risk: event.payload.risk,
        explanation: event.payload.explanation,
        visibleText: event.payload.visibleText,
        outcomeSummary: event.payload.outcomeSummary,
        reward: event.payload.reward,
        lifetimeDelta: event.payload.lifetimeDelta,
        nonEvidence: event.payload.nonEvidence,
        resolvedAt: event.payload.resolvedAt,
        signedEnvelope: event.payload.signedEnvelope,
      };
      mutable.turnCards[event.payload.turnCardId] = {
        ...card,
        status: "resolved",
        resolvedAt: event.payload.resolvedAt,
        resolution,
      };
      break;
    }
    case "hosted_session_started": {
      mutable.hostedSessions[event.payload.sessionId] = {
        sessionId: event.payload.sessionId,
        agentId: event.payload.agentId,
        explorerId: event.payload.explorerId,
        regionId: event.payload.regionId,
        mandate: event.payload.mandate,
        channelClass: event.payload.channelClass || "server_hosted",
        deliveryTrust: event.payload.deliveryTrust || event.trustClass,
        status: "active",
        actionOptions: event.payload.actionOptions,
        sceneContract: event.payload.sceneContract,
        actions: [],
        startedAt: event.payload.startedAt,
      };
      break;
    }
    case "server_hosted_job_queued": {
      const job = {
        jobId: event.payload.jobId,
        agentId: event.payload.agentId,
        explorerId: event.payload.explorerId,
        regionId: event.payload.regionId,
        mandate: event.payload.mandate,
        optionKey: event.payload.optionKey,
        visibleText: event.payload.visibleText,
        deliveryTrust: event.payload.deliveryTrust,
        status: "queued" as const,
        queuedBy: event.payload.queuedBy,
        queuedAt: event.payload.queuedAt,
      };
      mutable.serverHostedJobs[job.jobId] = job;
      mutable.serverHostedJobIdsByAgent[job.agentId] = [
        ...(mutable.serverHostedJobIdsByAgent[job.agentId] || []),
        job.jobId,
      ].filter((jobId, index, jobIds) => jobIds.indexOf(jobId) === index);
      break;
    }
    case "server_hosted_job_completed": {
      const job = mutable.serverHostedJobs[event.payload.jobId];
      if (!job) throw new Error("server_hosted_job_not_found");
      mutable.serverHostedJobs[event.payload.jobId] = {
        ...job,
        status: "completed",
        sessionId: event.payload.sessionId,
        actionId: event.payload.actionId,
        completedAt: event.payload.completedAt,
      };
      break;
    }
    case "server_hosted_job_skipped": {
      const job = mutable.serverHostedJobs[event.payload.jobId];
      if (!job) throw new Error("server_hosted_job_not_found");
      mutable.serverHostedJobs[event.payload.jobId] = {
        ...job,
        status: "skipped",
        skipReason: event.payload.reason,
        skippedAt: event.payload.skippedAt,
      };
      break;
    }
    case "attestation_recorded": {
      mutable.attestationRecords[event.payload.attestationId] = {
        attestationId: event.payload.attestationId,
        runnerId: event.payload.runnerId,
        runnerKeyId: event.payload.runnerKeyId,
        challengeId: event.payload.challengeId,
        sessionId: event.payload.sessionId,
        agentId: event.payload.agentId,
        actionOptionId: event.payload.actionOptionId,
        transcriptHash: event.payload.transcriptHash,
        signature: event.payload.signature,
        signatureBase: event.payload.signatureBase,
        signatureBaseHash: event.payload.signatureBaseHash,
        verifiedAt: event.payload.verifiedAt,
      };
      break;
    }
    case "hosted_action_recorded": {
      const session = mutable.hostedSessions[event.payload.sessionId];
      if (!session) throw new Error("hosted_session_not_found");
      const action: EpochHostedActionRecord = {
        actionId: event.payload.actionId,
        sessionId: event.payload.sessionId,
        agentId: event.payload.agentId,
        channelClass: event.payload.channelClass,
        deliveryTrust: event.payload.deliveryTrust,
        actionOptionId: event.payload.actionOptionId,
        optionLabel: event.payload.optionLabel,
        risk: event.payload.risk,
        socialHookId: event.payload.socialHookId,
        attestationId: event.payload.attestationId,
        explanation: event.payload.explanation,
        visibleText: event.payload.visibleText,
        outcomeSummary: event.payload.outcomeSummary,
        ...(event.payload.journeyResolution ? { journeyResolution: event.payload.journeyResolution } : {}),
        reward: event.payload.reward,
        lifetimeDelta: event.payload.lifetimeDelta,
        nonEvidence: event.payload.nonEvidence,
        recordedAt: event.payload.recordedAt,
        signedEnvelope: event.payload.signedEnvelope,
      };
      mutable.hostedSessions[event.payload.sessionId] = {
        ...session,
        status: "completed",
        actions: [...session.actions, action],
        completedAt: event.payload.recordedAt,
      };
      if (session.sceneContract
        && session.sceneContract.worldMode !== "mirror"
        && event.payload.journeyResolution) {
        addRegionActivityForEvent(mutable.regionActivities, mutable.regionActivityIdsByRegion, event, {
          regionId: session.regionId,
          kind: "journey",
          agentId: event.payload.agentId,
          title: session.sceneContract.taskObjective?.title || session.sceneContract.title,
          summary: event.payload.outcomeSummary,
          occurredAt: event.payload.recordedAt,
          sourceEventType: "hosted_action_recorded",
        });
      }
      break;
    }
    case "journey_world_solidified": {
      addRegionActivityForEvent(mutable.regionActivities, mutable.regionActivityIdsByRegion, event, {
        regionId: event.payload.regionId,
        kind: "journey",
        agentId: event.payload.agentId,
        title: "镜像对局固化",
        summary: `主线完成并安全返程；${event.payload.completedObjectiveIds.length} 项目标结果已写入真实世界，地区影响 +${event.payload.influenceDelta}，NPC 关系 ${event.payload.npcRelationships.length} 项。`,
        occurredAt: event.payload.solidifiedAt,
        sourceEventType: "journey_world_solidified",
      });
      break;
    }
  }
}

// ============================================================================
// ABUSE SCORE REDUCER
// ============================================================================

export function applyAbuseScoreEvent(
  mutable: MutableProjection,
  event: EpochEvent,
  _projection: EpochProjection,
): void {
  switch (event.eventType) {
    case "abuse_score_changed": {
      const payload = event.payload;
      const existing = mutable.abuseScores[payload.actorKey];
      mutable.abuseScores[payload.actorKey] = {
        actorKey: payload.actorKey,
        agentId: payload.agentId || existing?.agentId,
        explorerId: payload.explorerId || existing?.explorerId,
        score: payload.scoreAfter,
        updatedAt: payload.changedAt,
        latestEventId: event.eventId,
        sourceEventIds: [...(existing?.sourceEventIds || []), payload.sourceEventId]
          .filter((eventId, index, eventIds) => eventIds.indexOf(eventId) === index),
        reasons: {
          ...(existing?.reasons || {}),
          [payload.reason]: (existing?.reasons[payload.reason] || 0) + 1,
        },
      };
      break;
    }
    case "abuse_score_released": {
      const payload = event.payload;
      const existing = mutable.abuseScores[payload.actorKey];
      mutable.abuseScores[payload.actorKey] = {
        actorKey: payload.actorKey,
        agentId: payload.agentId || existing?.agentId,
        explorerId: payload.explorerId || existing?.explorerId,
        score: payload.scoreAfter,
        updatedAt: payload.releasedAt,
        latestEventId: event.eventId,
        sourceEventIds: [
          ...(existing?.sourceEventIds || []),
          ...(payload.sourceEventId ? [payload.sourceEventId] : []),
        ].filter((eventId, index, eventIds) => eventIds.indexOf(eventId) === index),
        reasons: {
          ...(existing?.reasons || {}),
          operator_release: (existing?.reasons.operator_release || 0) + 1,
        },
      };
      break;
    }
    case "abuse_score_decayed": {
      const payload = event.payload;
      const existing = mutable.abuseScores[payload.actorKey];
      mutable.abuseScores[payload.actorKey] = {
        actorKey: payload.actorKey,
        agentId: payload.agentId || existing?.agentId,
        explorerId: payload.explorerId || existing?.explorerId,
        score: payload.scoreAfter,
        updatedAt: payload.decayedAt,
        latestEventId: event.eventId,
        sourceEventIds: [
          ...(existing?.sourceEventIds || []),
          ...(payload.sourceEventId ? [payload.sourceEventId] : []),
        ].filter((eventId, index, eventIds) => eventIds.indexOf(eventId) === index),
        reasons: {
          ...(existing?.reasons || {}),
          maintenance_decay: (existing?.reasons.maintenance_decay || 0) + 1,
        },
      };
      break;
    }
  }
}

// ============================================================================
// Projection construction, cloning, and event application
// ============================================================================

export function uniqueValues(values: readonly string[]): string[] {
  return values.filter((value, index) => value && values.indexOf(value) === index);
}

function emptyProjection(): EpochProjection {
  return {
    events: [],
    identities: {},
    lineage: {},
    personalityDrifts: {},
    personalityDriftIdsByAgent: {},
    attributeScores: {},
    resourceBalances: {},
    downtime: {},
    agentCustody: {},
    downtimeDiaryEntries: {},
    downtimeDiaryIdsByAgent: {},
    regionActivities: {},
    regionActivityIdsByRegion: {},
    npcs: {},
    npcIdsByKey: {},
    npcCandidates: {},
    npcCandidateIdsByRegion: {},
    npcCandidateIdsByAgent: {},
    npcRelationships: {},
    npcRelationshipIdsByNpc: {},
    npcRelationshipIdsByRegion: {},
    agentNpcBonds: {},
    agentNpcBondIdsByAgent: {},
    agentNpcBondIdsByNpc: {},
    agentNpcBondIdsByRegion: {},
    npcMemories: {},
    npcMemoryIdsByNpc: {},
    npcMemoryIdsByRegion: {},
    households: {},
    householdIdsByNpc: {},
    householdIdsByRegion: {},
    organizations: {},
    organizationMemberships: {},
    organizationMembershipIdsByNpc: {},
    organizationMembershipIdsByAgent: {},
    organizationMembershipIdsByRegion: {},
    organizationMembershipIdsByOrganization: {},
    organizationPolitics: {},
    organizationPoliticsIdsByRegion: {},
    organizationPoliticsIdsByOrganization: {},
    organizationPoliticsIdsByNpc: {},
    organizationPoliticalStandingByOrganization: {},
    organizationTreasuryBalances: {},
    organizationUpgrades: {},
    organizationUpgradeIdsByOrganization: {},
    organizationBudgets: {},
    organizationBudgetIdsByOrganization: {},
    npcCareerRecords: {},
    npcCareerIdsByNpc: {},
    npcCareerIdsByRegion: {},
    npcLocationRecords: {},
    npcLocationIdsByNpc: {},
    npcLocationIdsByRegion: {},
    npcAssetStates: {},
    npcAssetIdsByNpc: {},
    npcAssetIdsByRegion: {},
    npcAssetBalancesByNpc: {},
    npcHealthStates: {},
    npcHealthIdsByNpc: {},
    npcHealthIdsByRegion: {},
    inventoryItems: {},
    inventoryItemIdsByAgent: {},
    inventoryItemIdsByExplorer: {},
    socialHooks: {},
    socialHookIdsByRegion: {},
    socialHookIdsByNpc: {},
    regionNews: {},
    worldMessages: [],
    regionMessages: {},
    moderationItems: {},
    riskReviews: {},
    riskReviewIdsBySourceEvent: {},
    riskReviewIdsByAgent: {},
    legendAwards: {},
    legendAwardIdsByNews: {},
    legendAwardIdsByAgent: {},
    contestedObjectives: {},
    objectiveIdsByRegion: {},
    resourceNodes: {},
    resourceNodeIdsByRegion: {},
    anomalyEvents: {},
    anomalyEventIdsByRegion: {},
    seasonCampaigns: {},
    seasonObjectives: {},
    seasonObjectiveIdsBySeason: {},
    seasonCampaignIdsByRegion: {},
    seasonCampaignIdsByFaction: {},
    agentFactionStandings: {},
    factionStandingIdsByAgent: {},
    factionStandingIdsByFaction: {},
    regionInfluenceChanges: {},
    regionInfluenceIdsByRegion: {},
    regionInfluenceIdsByAgent: {},
    conflictTraces: {},
    traceIdsByRegion: {},
    traceIdsByAgent: {},
    regionControls: {},
    regionMonuments: {},
    regionMonumentIdsByRegion: {},
    marketOrders: {},
    directTrades: {},
    marketRiskRestrictions: {},
    marketRiskRestrictionReleases: {},
    bounties: {},
    bountyIdsByRegion: {},
    bountyIdsByAgent: {},
    partyRuns: {},
    partyRunIdsByRegion: {},
    raidResults: {},
    raidIdsByRegion: {},
    retaliationOpportunities: {},
    retaliationIdsByRegion: {},
    retaliationIdsByAgent: {},
    diplomacyRecords: {},
    diplomacyIdsByRegion: {},
    diplomacyIdsByAgent: {},
    relationshipEdges: {},
    relationshipIdsByAgent: {},
    turnCards: {},
    hostedSessions: {},
    serverHostedJobs: {},
    serverHostedJobIdsByAgent: {},
    attestationRecords: {},
    abuseScores: {},
    worldObjectStates: {},
    hiddenPrerequisiteLinks: {},
  };
}

function cloneProjection(projection: EpochProjection): MutableProjection {
  return {
    events: [...projection.events],
    identities: { ...projection.identities },
    lineage: Object.fromEntries(
      Object.entries(projection.lineage).map(([explorerId, agentIds]) => [explorerId, [...agentIds]]),
    ),
    personalityDrifts: { ...projection.personalityDrifts },
    personalityDriftIdsByAgent: Object.fromEntries(
      Object.entries(projection.personalityDriftIdsByAgent).map(([agentId, driftIds]) => [agentId, [...driftIds]]),
    ),
    attributeScores: Object.fromEntries(
      Object.entries(projection.attributeScores).map(([agentId, scores]) => [agentId, copyAttributeScores(scores)]),
    ),
    resourceBalances: Object.fromEntries(
      Object.entries(projection.resourceBalances).map(([k, v]) => [k, copyBalance(v)]),
    ),
    downtime: { ...projection.downtime },
    agentCustody: { ...projection.agentCustody },
    downtimeDiaryEntries: { ...projection.downtimeDiaryEntries },
    downtimeDiaryIdsByAgent: Object.fromEntries(
      Object.entries(projection.downtimeDiaryIdsByAgent).map(([agentId, diaryIds]) => [agentId, [...diaryIds]]),
    ),
    regionActivities: { ...projection.regionActivities },
    regionActivityIdsByRegion: Object.fromEntries(
      Object.entries(projection.regionActivityIdsByRegion).map(([regionId, activityIds]) => [regionId, [...activityIds]]),
    ),
    npcs: { ...projection.npcs },
    npcIdsByKey: { ...projection.npcIdsByKey },
    npcCandidates: { ...projection.npcCandidates },
    npcCandidateIdsByRegion: Object.fromEntries(
      Object.entries(projection.npcCandidateIdsByRegion).map(([regionId, ids]) => [regionId, [...ids]]),
    ),
    npcCandidateIdsByAgent: Object.fromEntries(
      Object.entries(projection.npcCandidateIdsByAgent).map(([agentId, ids]) => [agentId, [...ids]]),
    ),
    npcRelationships: { ...projection.npcRelationships },
    npcRelationshipIdsByNpc: Object.fromEntries(
      Object.entries(projection.npcRelationshipIdsByNpc).map(([npcId, ids]) => [npcId, [...ids]]),
    ),
    npcRelationshipIdsByRegion: Object.fromEntries(
      Object.entries(projection.npcRelationshipIdsByRegion).map(([regionId, ids]) => [regionId, [...ids]]),
    ),
    agentNpcBonds: { ...projection.agentNpcBonds },
    agentNpcBondIdsByAgent: Object.fromEntries(
      Object.entries(projection.agentNpcBondIdsByAgent).map(([agentId, ids]) => [agentId, [...ids]]),
    ),
    agentNpcBondIdsByNpc: Object.fromEntries(
      Object.entries(projection.agentNpcBondIdsByNpc).map(([npcId, ids]) => [npcId, [...ids]]),
    ),
    agentNpcBondIdsByRegion: Object.fromEntries(
      Object.entries(projection.agentNpcBondIdsByRegion).map(([regionId, ids]) => [regionId, [...ids]]),
    ),
    npcMemories: { ...projection.npcMemories },
    npcMemoryIdsByNpc: Object.fromEntries(
      Object.entries(projection.npcMemoryIdsByNpc).map(([npcId, ids]) => [npcId, [...ids]]),
    ),
    npcMemoryIdsByRegion: Object.fromEntries(
      Object.entries(projection.npcMemoryIdsByRegion).map(([regionId, ids]) => [regionId, [...ids]]),
    ),
    households: { ...projection.households },
    householdIdsByNpc: Object.fromEntries(
      Object.entries(projection.householdIdsByNpc).map(([npcId, ids]) => [npcId, [...ids]]),
    ),
    householdIdsByRegion: Object.fromEntries(
      Object.entries(projection.householdIdsByRegion).map(([regionId, ids]) => [regionId, [...ids]]),
    ),
    organizations: { ...projection.organizations },
    organizationMemberships: { ...projection.organizationMemberships },
    organizationMembershipIdsByNpc: Object.fromEntries(
      Object.entries(projection.organizationMembershipIdsByNpc).map(([npcId, ids]) => [npcId, [...ids]]),
    ),
    organizationMembershipIdsByAgent: Object.fromEntries(
      Object.entries(projection.organizationMembershipIdsByAgent).map(([agentId, ids]) => [agentId, [...ids]]),
    ),
    organizationMembershipIdsByRegion: Object.fromEntries(
      Object.entries(projection.organizationMembershipIdsByRegion).map(([regionId, ids]) => [regionId, [...ids]]),
    ),
    organizationMembershipIdsByOrganization: Object.fromEntries(
      Object.entries(projection.organizationMembershipIdsByOrganization).map(([orgId, ids]) => [orgId, [...ids]]),
    ),
    organizationPolitics: { ...projection.organizationPolitics },
    organizationPoliticsIdsByRegion: Object.fromEntries(
      Object.entries(projection.organizationPoliticsIdsByRegion).map(([regionId, ids]) => [regionId, [...ids]]),
    ),
    organizationPoliticsIdsByOrganization: Object.fromEntries(
      Object.entries(projection.organizationPoliticsIdsByOrganization).map(([orgId, ids]) => [orgId, [...ids]]),
    ),
    organizationPoliticsIdsByNpc: Object.fromEntries(
      Object.entries(projection.organizationPoliticsIdsByNpc).map(([npcId, ids]) => [npcId, [...ids]]),
    ),
    organizationPoliticalStandingByOrganization: { ...projection.organizationPoliticalStandingByOrganization },
    organizationTreasuryBalances: Object.fromEntries(
      Object.entries(projection.organizationTreasuryBalances).map(([orgId, balance]) => [orgId, copyBalance(balance)]),
    ),
    organizationUpgrades: { ...projection.organizationUpgrades },
    organizationUpgradeIdsByOrganization: Object.fromEntries(
      Object.entries(projection.organizationUpgradeIdsByOrganization).map(([orgId, ids]) => [orgId, [...ids]]),
    ),
    organizationBudgets: { ...projection.organizationBudgets },
    organizationBudgetIdsByOrganization: Object.fromEntries(
      Object.entries(projection.organizationBudgetIdsByOrganization).map(([orgId, ids]) => [orgId, [...ids]]),
    ),
    npcCareerRecords: { ...projection.npcCareerRecords },
    npcCareerIdsByNpc: Object.fromEntries(
      Object.entries(projection.npcCareerIdsByNpc).map(([npcId, ids]) => [npcId, [...ids]]),
    ),
    npcCareerIdsByRegion: Object.fromEntries(
      Object.entries(projection.npcCareerIdsByRegion).map(([regionId, ids]) => [regionId, [...ids]]),
    ),
    npcLocationRecords: { ...projection.npcLocationRecords },
    npcLocationIdsByNpc: Object.fromEntries(
      Object.entries(projection.npcLocationIdsByNpc).map(([npcId, ids]) => [npcId, [...ids]]),
    ),
    npcLocationIdsByRegion: Object.fromEntries(
      Object.entries(projection.npcLocationIdsByRegion).map(([regionId, ids]) => [regionId, [...ids]]),
    ),
    npcAssetStates: { ...projection.npcAssetStates },
    npcAssetIdsByNpc: Object.fromEntries(
      Object.entries(projection.npcAssetIdsByNpc).map(([npcId, ids]) => [npcId, [...ids]]),
    ),
    npcAssetIdsByRegion: Object.fromEntries(
      Object.entries(projection.npcAssetIdsByRegion).map(([regionId, ids]) => [regionId, [...ids]]),
    ),
    npcAssetBalancesByNpc: Object.fromEntries(
      Object.entries(projection.npcAssetBalancesByNpc).map(([npcId, balances]) => [npcId, { ...balances }]),
    ),
    npcHealthStates: { ...projection.npcHealthStates },
    npcHealthIdsByNpc: Object.fromEntries(
      Object.entries(projection.npcHealthIdsByNpc).map(([npcId, ids]) => [npcId, [...ids]]),
    ),
    npcHealthIdsByRegion: Object.fromEntries(
      Object.entries(projection.npcHealthIdsByRegion).map(([regionId, ids]) => [regionId, [...ids]]),
    ),
    inventoryItems: { ...projection.inventoryItems },
    inventoryItemIdsByAgent: Object.fromEntries(
      Object.entries(projection.inventoryItemIdsByAgent).map(([agentId, ids]) => [agentId, [...ids]]),
    ),
    inventoryItemIdsByExplorer: Object.fromEntries(
      Object.entries(projection.inventoryItemIdsByExplorer).map(([explorerId, ids]) => [explorerId, [...ids]]),
    ),
    socialHooks: { ...projection.socialHooks },
    socialHookIdsByRegion: Object.fromEntries(
      Object.entries(projection.socialHookIdsByRegion).map(([regionId, ids]) => [regionId, [...ids]]),
    ),
    socialHookIdsByNpc: Object.fromEntries(
      Object.entries(projection.socialHookIdsByNpc).map(([npcId, ids]) => [npcId, [...ids]]),
    ),
    regionNews: Object.fromEntries(
      Object.entries(projection.regionNews).map(([regionId, news]) => [regionId, [...news]]),
    ),
    worldMessages: [...projection.worldMessages],
    regionMessages: Object.fromEntries(
      Object.entries(projection.regionMessages).map(([regionId, messages]) => [regionId, [...messages]]),
    ),
    moderationItems: { ...projection.moderationItems },
    riskReviews: { ...projection.riskReviews },
    riskReviewIdsBySourceEvent: Object.fromEntries(
      Object.entries(projection.riskReviewIdsBySourceEvent).map(([eventId, ids]) => [eventId, [...ids]]),
    ),
    riskReviewIdsByAgent: Object.fromEntries(
      Object.entries(projection.riskReviewIdsByAgent).map(([agentId, ids]) => [agentId, [...ids]]),
    ),
    legendAwards: { ...projection.legendAwards },
    legendAwardIdsByNews: Object.fromEntries(
      Object.entries(projection.legendAwardIdsByNews).map(([newsId, ids]) => [newsId, [...ids]]),
    ),
    legendAwardIdsByAgent: Object.fromEntries(
      Object.entries(projection.legendAwardIdsByAgent).map(([agentId, ids]) => [agentId, [...ids]]),
    ),
    contestedObjectives: { ...projection.contestedObjectives },
    objectiveIdsByRegion: Object.fromEntries(
      Object.entries(projection.objectiveIdsByRegion).map(([regionId, ids]) => [regionId, [...ids]]),
    ),
    resourceNodes: { ...projection.resourceNodes },
    resourceNodeIdsByRegion: Object.fromEntries(
      Object.entries(projection.resourceNodeIdsByRegion).map(([regionId, ids]) => [regionId, [...ids]]),
    ),
    anomalyEvents: { ...projection.anomalyEvents },
    anomalyEventIdsByRegion: Object.fromEntries(
      Object.entries(projection.anomalyEventIdsByRegion).map(([regionId, ids]) => [regionId, [...ids]]),
    ),
    seasonCampaigns: { ...projection.seasonCampaigns },
    seasonObjectives: { ...projection.seasonObjectives },
    seasonObjectiveIdsBySeason: Object.fromEntries(
      Object.entries(projection.seasonObjectiveIdsBySeason).map(([seasonId, ids]) => [seasonId, [...ids]]),
    ),
    seasonCampaignIdsByRegion: Object.fromEntries(
      Object.entries(projection.seasonCampaignIdsByRegion).map(([regionId, ids]) => [regionId, [...ids]]),
    ),
    seasonCampaignIdsByFaction: Object.fromEntries(
      Object.entries(projection.seasonCampaignIdsByFaction).map(([factionId, ids]) => [factionId, [...ids]]),
    ),
    agentFactionStandings: { ...projection.agentFactionStandings },
    factionStandingIdsByAgent: Object.fromEntries(
      Object.entries(projection.factionStandingIdsByAgent).map(([agentId, ids]) => [agentId, [...ids]]),
    ),
    factionStandingIdsByFaction: Object.fromEntries(
      Object.entries(projection.factionStandingIdsByFaction).map(([factionId, ids]) => [factionId, [...ids]]),
    ),
    regionInfluenceChanges: { ...projection.regionInfluenceChanges },
    regionInfluenceIdsByRegion: Object.fromEntries(
      Object.entries(projection.regionInfluenceIdsByRegion).map(([regionId, ids]) => [regionId, [...ids]]),
    ),
    regionInfluenceIdsByAgent: Object.fromEntries(
      Object.entries(projection.regionInfluenceIdsByAgent).map(([agentId, ids]) => [agentId, [...ids]]),
    ),
    conflictTraces: { ...projection.conflictTraces },
    traceIdsByRegion: Object.fromEntries(
      Object.entries(projection.traceIdsByRegion).map(([regionId, ids]) => [regionId, [...ids]]),
    ),
    traceIdsByAgent: Object.fromEntries(
      Object.entries(projection.traceIdsByAgent).map(([agentId, ids]) => [agentId, [...ids]]),
    ),
    regionControls: { ...projection.regionControls },
    regionMonuments: { ...projection.regionMonuments },
    regionMonumentIdsByRegion: Object.fromEntries(
      Object.entries(projection.regionMonumentIdsByRegion).map(([regionId, ids]) => [regionId, [...ids]]),
    ),
    marketOrders: { ...projection.marketOrders },
    directTrades: { ...projection.directTrades },
    marketRiskRestrictions: { ...projection.marketRiskRestrictions },
    marketRiskRestrictionReleases: { ...projection.marketRiskRestrictionReleases },
    bounties: { ...projection.bounties },
    bountyIdsByRegion: Object.fromEntries(
      Object.entries(projection.bountyIdsByRegion).map(([regionId, ids]) => [regionId, [...ids]]),
    ),
    bountyIdsByAgent: Object.fromEntries(
      Object.entries(projection.bountyIdsByAgent).map(([agentId, ids]) => [agentId, [...ids]]),
    ),
    partyRuns: { ...projection.partyRuns },
    partyRunIdsByRegion: Object.fromEntries(
      Object.entries(projection.partyRunIdsByRegion).map(([regionId, ids]) => [regionId, [...ids]]),
    ),
    raidResults: { ...projection.raidResults },
    raidIdsByRegion: Object.fromEntries(
      Object.entries(projection.raidIdsByRegion).map(([regionId, ids]) => [regionId, [...ids]]),
    ),
    retaliationOpportunities: { ...projection.retaliationOpportunities },
    retaliationIdsByRegion: Object.fromEntries(
      Object.entries(projection.retaliationIdsByRegion).map(([regionId, ids]) => [regionId, [...ids]]),
    ),
    retaliationIdsByAgent: Object.fromEntries(
      Object.entries(projection.retaliationIdsByAgent).map(([agentId, ids]) => [agentId, [...ids]]),
    ),
    diplomacyRecords: { ...projection.diplomacyRecords },
    diplomacyIdsByRegion: Object.fromEntries(
      Object.entries(projection.diplomacyIdsByRegion).map(([regionId, ids]) => [regionId, [...ids]]),
    ),
    diplomacyIdsByAgent: Object.fromEntries(
      Object.entries(projection.diplomacyIdsByAgent).map(([agentId, ids]) => [agentId, [...ids]]),
    ),
    relationshipEdges: { ...projection.relationshipEdges },
    relationshipIdsByAgent: Object.fromEntries(
      Object.entries(projection.relationshipIdsByAgent).map(([agentId, ids]) => [agentId, [...ids]]),
    ),
    turnCards: { ...projection.turnCards },
    hostedSessions: { ...projection.hostedSessions },
    serverHostedJobs: { ...projection.serverHostedJobs },
    serverHostedJobIdsByAgent: Object.fromEntries(
      Object.entries(projection.serverHostedJobIdsByAgent).map(([agentId, ids]) => [agentId, [...ids]]),
    ),
    attestationRecords: { ...projection.attestationRecords },
    abuseScores: { ...projection.abuseScores },
    worldObjectStates: { ...projection.worldObjectStates },
    hiddenPrerequisiteLinks: { ...projection.hiddenPrerequisiteLinks },
  };
}

export function freezeProjection<T>(value: T, frozenObjects: WeakSet<object>): T {
  if (value === null || typeof value !== "object") return value;
  const objectValue = value as object;
  if (frozenObjects.has(objectValue)) return value;
  frozenObjects.add(objectValue);
  for (const key of Reflect.ownKeys(objectValue)) {
    freezeProjection(Reflect.get(objectValue, key), frozenObjects);
  }
  Object.freeze(objectValue);
  return value;
}

export function applyEvent(projection: EpochProjection, event: EpochEvent): EpochProjection {
  const mutable = cloneProjection(projection);

  // Dispatch to domain-specific reducers
  switch (event.eventType) {
    // Identity domain
    case "identity_issued":
    case "personality_drift_proposed":
    case "personality_drift_confirmed":
    case "attribute_gained":
    case "lifetime_adjusted":
    case "npc_identity_doubt":
    case "identity_viability_projected":
    case "identity_archived":
    case "agent_custody_changed":
    case "reincarnation_issued":
    case "resource_granted":
    case "resource_spent":
      applyIdentityEvent(mutable, event, projection);
      break;

    // World domain
    case "world_clock_advanced":
    case "world_object_state_changed":
    case "hidden_prerequisite_link_changed":
      applyWorldEvent(mutable, event, projection);
      break;

    // Downtime domain
    case "downtime_set":
    case "downtime_claimed":
    case "downtime_tick_resolved":
      applyDowntimeEvent(mutable, event, projection);
      break;

    // NPC domain
    case "npc_candidate_submitted":
    case "npc_candidate_reviewed":
    case "npc_canonicalized":
    case "npc_lifecycle_recorded":
    case "npc_relationship_recorded":
    case "agent_npc_bond_updated":
    case "npc_memory_recorded":
    case "npc_household_recorded":
    case "npc_career_changed":
    case "npc_location_changed":
    case "npc_asset_changed":
    case "npc_health_recorded":
      applyNpcEvent(mutable, event, projection);
      break;

    // Organization domain
    case "organization_created":
    case "organization_membership_changed":
    case "organization_politics_recorded":
    case "organization_prestige_changed":
    case "organization_treasury_changed":
    case "organization_budget_proposed":
    case "organization_budget_vote_recorded":
    case "organization_budget_resolved":
    case "organization_upgrade_purchased":
      applyOrganizationEvent(mutable, event);
      break;

    // Moderation domain
    case "region_news_generated":
    case "message_posted":
    case "moderation_queued":
    case "moderation_resolved":
    case "risk_review_recorded":
    case "market_risk_restriction_released":
    case "legend_awarded":
      applyModerationEvent(mutable, event, projection);
      break;

    // Encounter domain
    case "contested_objective_created":
    case "race_commission_completed":
    case "contested_objective_contributed":
    case "contested_objective_settled":
    case "resource_node_spawned":
    case "resource_node_contested":
    case "resource_node_settled":
    case "anomaly_event_spawned":
    case "anomaly_event_contested":
    case "anomaly_event_resolved":
      applyEncounterEvent(mutable, event, projection);
      break;

    // Season domain
    case "season_campaign_created":
    case "season_started":
    case "season_objective_created":
    case "season_contribution_recorded":
    case "season_objective_completed":
    case "season_campaign_resolved":
    case "season_resolved":
    case "agent_faction_standing_changed":
    case "region_influence_changed":
    case "trace_created":
    case "region_control_changed":
    case "region_control_decayed":
    case "region_control_released":
    case "region_revolt_resolved":
    case "region_monument_built":
      applySeasonEvent(mutable, event, projection);
      break;

    // Trade domain
    case "market_order_created":
    case "market_order_filled":
    case "market_order_cancelled":
    case "market_order_expired":
    case "direct_trade_created":
    case "direct_trade_accepted":
    case "direct_trade_cancelled":
    case "direct_trade_expired":
    case "bounty_created":
    case "bounty_claimed":
    case "item_created":
    case "item_bound":
    case "item_transferred":
    case "social_hook_created":
      applyTradeEvent(mutable, event, projection);
      break;

    // Combat domain
    case "party_run_created":
    case "party_invite_updated":
    case "party_join_requested":
    case "party_join_request_resolved":
    case "party_member_joined":
    case "party_run_settled":
    case "raid_resolved":
    case "retaliation_opportunity_created":
    case "retaliation_resolved":
      applyCombatEvent(mutable, event, projection);
      break;

    // Diplomacy domain
    case "diplomacy_proposed":
    case "diplomacy_responded":
    case "relationship_updated":
      applyDiplomacyEvent(mutable, event, projection);
      break;

    // Turn/Hosted domain
    case "turn_card_created":
    case "trace_conflict_effect_applied":
    case "turn_resolved":
    case "hosted_session_started":
    case "server_hosted_job_queued":
    case "server_hosted_job_completed":
    case "server_hosted_job_skipped":
    case "attestation_recorded":
    case "hosted_action_recorded":
    case "journey_world_solidified":
      applyTurnHostedEvent(mutable, event, projection);
      break;

    // Abuse score domain
    case "abuse_score_changed":
    case "abuse_score_released":
    case "abuse_score_decayed":
      applyAbuseScoreEvent(mutable, event, projection);
      break;
  }

  // Append the event and return
  mutable.events = [...mutable.events, event];
  return mutable as unknown as EpochProjection;
}

export function projectEpochEvents(events: readonly EpochEvent[]): EpochProjection {
  return events.reduce((projection, event) => applyEvent(projection, event), emptyProjection());
}

export function sourceEventsMentionAgent(projection: EpochProjection, sourceEventIds: readonly string[], agentId: string): boolean {
  const sourceEventIdSet = new Set(sourceEventIds);
  return projection.events
    .filter((event) => sourceEventIdSet.has(event.eventId))
    .some((event) => {
      const payload = event.payload as unknown as Record<string, unknown>;
      return event.agentId === agentId
        || event.aggregateId === agentId
        || payload.agentId === agentId
        || payload.winnerAgentId === agentId;
    });
}

export function requireServerTrust(context: EpochCommandContext, errorCode: string) {
  const trustClass = normalizeTrustClass(context.trustClass);
  if (trustClass === "untrusted_client") throw new Error(errorCode);
  return trustClass;
}
