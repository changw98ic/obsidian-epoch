import type {
  EpochCommandContext,
  EpochClock,
  EpochIdFactory,
  EpochNpcRelationshipKind,
  EpochPartyRunJoinPolicy,
  EpochPartyRole,
  EpochRelationshipKind,
  EpochTrustClass,
} from "./protocol.ts";
import type {
  EpochEvent,
  PartyJoinRequestResolution,
} from "./events.ts";
import type {
  EpochCommandResult,
  EpochProjection,
  EpochPartyRun,
  EpochRaidResult,
  EpochRetaliationOpportunity,
  EpochDiplomacyRecord,
  EpochRelationshipEdge,
  EpochAgentNpcBond,
  CreatePartyRunInput,
  JoinPartyRunInput,
  RequestPartyJoinInput,
  ResolvePartyJoinRequestInput,
  UpdatePartyInviteInput,
  SettlePartyRunInput,
  ResolveRaidInput,
  ResolveRetaliationInput,
  ProposeDiplomacyInput,
  RespondDiplomacyInput,
  UpdateRelationshipInput,
  UpdateAgentNpcBondInput,
} from "./gameCore.ts";
import {
  assertDiplomacyResponse,
  assertFiniteInteger,
  assertNonEmptyString,
  assertNpcRelationshipKind,
  assertPositiveInteger,
  assertRelationshipKind,
  normalizeTrustClass,
  serverIsoTime,
} from "./protocol.ts";
import { eventFactory } from "./eventFactory.ts";
import {
  requireActiveIdentity,
} from "./identityProjectionRules.ts";
import {
  assertIdentityOwner,
} from "./identityAuthorizationRules.ts";
import {
  currentBalance,
} from "./resourceRules.ts";
import {
  currentRegionInfluenceScore,
  latestTraceIdForRegion,
} from "./regionProjectionRules.ts";
import {
  agentSeasonStandingForRegion,
} from "./seasonCampaignRules.ts";
import {
  RAID_PAIR_REWARD_DECAY_WINDOW_SECONDS,
  RAID_REGION_HEAT_REWARD_DECAY_SCORE,
  RAID_REGION_HEAT_REWARD_DECAY_WINDOW_SECONDS,
  assertPartyJoinRequestResolution,
  assertPartyRole,
  assertPartyRunJoinPolicy,
  optionalInviteToken,
  partyInviteTokenExpiresAt,
  partyInviteTokenHash,
  partyInviteTokenUseLimit,
  partyRunMemberSettlementResults,
  partyRunTotalScore,
  planPartyInviteUpdateEvents,
  planPartyJoinRequestEvents,
  planPartyJoinRequestResolutionEvents,
  planPartyMemberJoinEvents,
  planPartyRunCreationEvents,
  planPartyRunSettlementEvents,
  projectPartyInviteUpdate,
  projectPartyJoinRequest,
  projectPartyJoinRequestResolution,
  projectPartyMemberJoin,
  projectPartyRunCreation,
  raidBattleSettlement,
  latestRaidPairResolvedAt,
  planRaidResolutionEvents,
  planRetaliationResolutionEvents,
  projectRaidResolution,
  projectRetaliationResolution,
  raidPairResolvedCountSince,
  regionRaidHeatScoreSince,
  requireOpenPartyRun,
  requireOpenRetaliationOpportunity,
  requirePartyRun,
  retaliationBattleSettlement,
  MAX_PARTY_RUN_MEMBERS,
  RAID_PAIR_COOLDOWN_SECONDS,
} from "./combatSettlementRules.ts";
import {
  assertChildNpcBondAllowed,
  diplomacySeed,
  planDiplomacyAcceptedRelationshipTraceEvents,
  planDiplomacyProposalEvents,
  planDiplomacyResponseEvents,
  planAgentNpcBondUpdateEvents,
  planRelationshipUpdateEvents,
  relationshipUpdatedPayload,
} from "./agentInteractionRules.ts";

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

export interface GameCoreCombatContext {
  readonly projection: () => EpochProjection;
  readonly commit: <T>(events: readonly EpochEvent[], value: T) => EpochCommandResult<T>;
  readonly applyEvents: (projection: EpochProjection, events: readonly EpochEvent[]) => EpochProjection;
  readonly clock: EpochClock;
  readonly idFactory: EpochIdFactory;
  readonly proposeRelationshipPersonalityDriftEvent: (
    projection: EpochProjection,
    relationship: ReturnType<typeof relationshipUpdatedPayload>,
    sourceEvent: EpochEvent,
    context: EpochCommandContext,
  ) => EpochEvent | undefined;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function requireServerTrust(context: EpochCommandContext, errorCode: string): EpochTrustClass {
  const trustClass = normalizeTrustClass(context.trustClass);
  if (trustClass === "untrusted_client") throw new Error(errorCode);
  return trustClass;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createCombatCommands(ctx: GameCoreCombatContext) {
  const { projection, commit, applyEvents, clock, idFactory, proposeRelationshipPersonalityDriftEvent } = ctx;

  function createPartyRun(input: CreatePartyRunInput, context: EpochCommandContext): EpochCommandResult<EpochPartyRun> {
    const current = projection();
    const leaderAgentId = assertNonEmptyString(input.leaderAgentId, "leader_agent_id");
    const leader = requireActiveIdentity(current, leaderAgentId);
    assertIdentityOwner(leader, context, "party_leader_owner_mismatch");
    const regionId = assertNonEmptyString(input.regionId, "region_id");
    const title = assertNonEmptyString(input.title, "party_title");
    const objective = assertNonEmptyString(input.objective, "party_objective");
    const joinPolicy = assertPartyRunJoinPolicy(input.joinPolicy);
    const inviteToken = optionalInviteToken(input.inviteToken);
    if (joinPolicy === "invite_only" && !inviteToken) throw new Error("party_invite_required");
    const createdAt = serverIsoTime(clock);
    const inviteTokenExpiresAt = joinPolicy === "invite_only"
      ? partyInviteTokenExpiresAt(input.inviteTokenExpiresAt, createdAt)
      : undefined;
    const inviteTokenUseLimit = joinPolicy === "invite_only"
      ? partyInviteTokenUseLimit(input.inviteTokenUseLimit)
      : undefined;
    const inviteRecipientAgentId = joinPolicy === "invite_only" && input.inviteRecipientAgentId
      ? assertNonEmptyString(input.inviteRecipientAgentId, "invite_recipient_agent_id")
      : undefined;
    const partyRunId = idFactory("party_run", `${regionId}:${title}:${createdAt}:${leaderAgentId}`);
    const makeEvent = eventFactory(clock, idFactory, context);
    const nextEvents = planPartyRunCreationEvents({
      partyRunId,
      regionId,
      leaderAgentId,
      leaderExplorerId: leader.explorerId,
      title,
      objective,
      joinPolicy,
      inviteTokenHash: inviteToken ? partyInviteTokenHash(inviteToken) : undefined,
      inviteTokenExpiresAt,
      inviteTokenUseLimit,
      inviteRecipientAgentId,
      createdAt,
      makeEvent,
    });
    const nextProjection = applyEvents(current, nextEvents);
    return commit(nextEvents, projectPartyRunCreation({ events: nextEvents, projection: nextProjection }));
  }

  function updatePartyInvite(input: UpdatePartyInviteInput, context: EpochCommandContext): EpochCommandResult<EpochPartyRun> {
    const current = projection();
    const partyRunId = assertNonEmptyString(input.partyRunId, "party_run_id");
    const partyRun = requireOpenPartyRun(current, partyRunId);
    const leaderAgentId = assertNonEmptyString(input.leaderAgentId, "leader_agent_id");
    const leader = requireActiveIdentity(current, leaderAgentId);
    assertIdentityOwner(leader, context, "party_invite_owner_mismatch");
    if (partyRun.leaderAgentId !== leaderAgentId || partyRun.leaderExplorerId !== leader.explorerId) {
      throw new Error("party_invite_leader_required");
    }
    const updatedAt = serverIsoTime(clock);
    const updateKind = input.revoke === true ? "revoked" : "rotated";
    const inviteToken = optionalInviteToken(input.inviteToken);
    if (updateKind === "rotated" && !inviteToken) throw new Error("party_invite_required");
    const inviteEventId = idFactory("party_run", `${partyRunId}:invite:${updateKind}:${updatedAt}`);
    const makeEvent = eventFactory(clock, idFactory, context);
    const nextEvents = planPartyInviteUpdateEvents({
      partyRunId,
      regionId: partyRun.regionId,
      leaderAgentId,
      leaderExplorerId: leader.explorerId,
      updateKind,
      inviteTokenHash: inviteToken ? partyInviteTokenHash(inviteToken) : undefined,
      inviteTokenExpiresAt: updateKind === "rotated"
        ? partyInviteTokenExpiresAt(input.inviteTokenExpiresAt, updatedAt)
        : undefined,
      inviteTokenUseLimit: updateKind === "rotated"
        ? partyInviteTokenUseLimit(input.inviteTokenUseLimit)
        : undefined,
      inviteRecipientAgentId: updateKind === "rotated" && input.inviteRecipientAgentId
        ? assertNonEmptyString(input.inviteRecipientAgentId, "invite_recipient_agent_id")
        : undefined,
      updatedAt,
      inviteEventId,
      makeEvent,
    });
    const nextProjection = applyEvents(current, nextEvents);
    return commit(nextEvents, projectPartyInviteUpdate({ events: nextEvents, projection: nextProjection }));
  }

  function joinPartyRun(input: JoinPartyRunInput, context: EpochCommandContext): EpochCommandResult<EpochPartyRun> {
    const current = projection();
    const partyRunId = assertNonEmptyString(input.partyRunId, "party_run_id");
    const partyRun = requireOpenPartyRun(current, partyRunId);
    const agentId = assertNonEmptyString(input.agentId, "agent_id");
    const identity = requireActiveIdentity(current, agentId);
    assertIdentityOwner(identity, context, "party_member_owner_mismatch");
    if (partyRun.members.some((member) => member.agentId === agentId)) throw new Error("party_member_already_joined");
    if (partyRun.members.length >= MAX_PARTY_RUN_MEMBERS) throw new Error("party_run_full");
    const joinedAt = serverIsoTime(clock);
    if (partyRun.joinPolicy === "invite_only") {
      const inviteToken = optionalInviteToken(input.inviteToken);
      if (!inviteToken) throw new Error("party_invite_required");
      if (!partyRun.inviteTokenHash || partyInviteTokenHash(inviteToken) !== partyRun.inviteTokenHash) {
        throw new Error("party_invite_invalid");
      }
      if (partyRun.inviteTokenExpiresAt && Date.parse(joinedAt) >= Date.parse(partyRun.inviteTokenExpiresAt)) {
        throw new Error("party_invite_expired");
      }
      if ((partyRun.inviteTokenUses || 0) >= (partyRun.inviteTokenUseLimit || MAX_PARTY_RUN_MEMBERS - 1)) {
        throw new Error("party_invite_exhausted");
      }
      if (partyRun.inviteRecipientAgentId && partyRun.inviteRecipientAgentId !== agentId) {
        throw new Error("party_invite_recipient_mismatch");
      }
    }
    const participantRole = assertPartyRole(input.participantRole, "participant_role");
    const makeEvent = eventFactory(clock, idFactory, context);
    const nextEvents = planPartyMemberJoinEvents({
      partyRunId,
      regionId: partyRun.regionId,
      agentId,
      explorerId: identity.explorerId,
      participantRole,
      joinedAt,
      inviteTokenUsed: partyRun.joinPolicy === "invite_only",
      makeEvent,
    });
    const nextProjection = applyEvents(current, nextEvents);
    return commit(nextEvents, projectPartyMemberJoin({ events: nextEvents, projection: nextProjection }));
  }

  function requestPartyJoin(input: RequestPartyJoinInput, context: EpochCommandContext): EpochCommandResult<EpochPartyRun> {
    const current = projection();
    const partyRunId = assertNonEmptyString(input.partyRunId, "party_run_id");
    const partyRun = requireOpenPartyRun(current, partyRunId);
    const agentId = assertNonEmptyString(input.agentId, "agent_id");
    const identity = requireActiveIdentity(current, agentId);
    assertIdentityOwner(identity, context, "party_join_request_owner_mismatch");
    if (partyRun.members.some((member) => member.agentId === agentId)) throw new Error("party_member_already_joined");
    if (partyRun.members.length >= MAX_PARTY_RUN_MEMBERS) throw new Error("party_run_full");
    if ((partyRun.joinRequests || []).some((request) => request.agentId === agentId && request.status === "pending")) {
      throw new Error("party_join_request_already_pending");
    }
    const participantRole = assertPartyRole(input.participantRole, "participant_role");
    const requestedAt = serverIsoTime(clock);
    const requestId = idFactory("party_join_request", `${partyRunId}:${agentId}:${requestedAt}`);
    const makeEvent = eventFactory(clock, idFactory, context);
    const nextEvents = planPartyJoinRequestEvents({
      requestId,
      partyRunId,
      regionId: partyRun.regionId,
      agentId,
      explorerId: identity.explorerId,
      participantRole,
      requestNote: input.requestNote,
      requestedAt,
      makeEvent,
    });
    const nextProjection = applyEvents(current, nextEvents);
    return commit(nextEvents, projectPartyJoinRequest({ events: nextEvents, projection: nextProjection }));
  }

  function resolvePartyJoinRequest(
    input: ResolvePartyJoinRequestInput,
    context: EpochCommandContext,
  ): EpochCommandResult<EpochPartyRun> {
    const current = projection();
    const partyRunId = assertNonEmptyString(input.partyRunId, "party_run_id");
    const partyRun = requireOpenPartyRun(current, partyRunId);
    const leaderAgentId = assertNonEmptyString(input.leaderAgentId, "leader_agent_id");
    const leader = requireActiveIdentity(current, leaderAgentId);
    assertIdentityOwner(leader, context, "party_join_request_owner_mismatch");
    if (partyRun.leaderAgentId !== leaderAgentId || partyRun.leaderExplorerId !== leader.explorerId) {
      throw new Error("party_join_request_leader_required");
    }
    const requestId = assertNonEmptyString(input.requestId, "party_join_request_id");
    const request = (partyRun.joinRequests || []).find((item) => item.requestId === requestId);
    if (!request) throw new Error("party_join_request_not_found");
    if (request.status !== "pending") throw new Error("party_join_request_not_pending");
    const resolution = assertPartyJoinRequestResolution(input.resolution);
    const resolvedAt = serverIsoTime(clock);
    const requester = resolution === "approved" ? requireActiveIdentity(current, request.agentId) : undefined;
    if (resolution === "approved") {
      if (partyRun.members.some((member) => member.agentId === request.agentId)) throw new Error("party_member_already_joined");
      if (partyRun.members.length >= MAX_PARTY_RUN_MEMBERS) throw new Error("party_run_full");
    }
    const makeEvent = eventFactory(clock, idFactory, context);
    const nextEvents = planPartyJoinRequestResolutionEvents({
      requestId,
      partyRunId,
      regionId: partyRun.regionId,
      agentId: request.agentId,
      explorerId: request.explorerId,
      participantRole: request.participantRole,
      resolution,
      resolvedByAgentId: leaderAgentId,
      resolvedByExplorerId: leader.explorerId,
      resolutionNote: input.resolutionNote,
      resolvedAt,
      approvedMemberExplorerId: requester?.explorerId,
      makeEvent,
    });
    const nextProjection = applyEvents(current, nextEvents);
    return commit(nextEvents, projectPartyJoinRequestResolution({ events: nextEvents, projection: nextProjection }));
  }

  function settlePartyRun(input: SettlePartyRunInput, context: EpochCommandContext): EpochCommandResult<EpochPartyRun> {
    const trustClass = requireServerTrust(context, "party_run_settlement_requires_server_trust");
    const current = projection();
    const partyRunId = assertNonEmptyString(input.partyRunId, "party_run_id");
    const partyRun = requirePartyRun(current, partyRunId);
    if (partyRun.status === "settled") return { events: [], value: partyRun, projection: current };
    const settledAt = serverIsoTime(clock);
    const memberResults = partyRunMemberSettlementResults(partyRunId, partyRun.members);
    const totalScore = partyRunTotalScore(memberResults);
    const traceId = idFactory("trace", `${partyRun.regionId}:${partyRunId}:party_run`);
    const newsId = idFactory("news", `${partyRun.regionId}:${partyRunId}:party_run`);
    const makeEvent = eventFactory(clock, idFactory, { ...context, trustClass });
    const nextEvents = planPartyRunSettlementEvents({
      makeEvent,
      idFactory,
      partyRunId,
      regionId: partyRun.regionId,
      leaderAgentId: partyRun.leaderAgentId,
      partyTitle: partyRun.title,
      partyObjective: partyRun.objective,
      partyMemberCount: partyRun.members.length,
      totalScore,
      memberResults,
      traceId,
      newsId,
      parentTraceId: latestTraceIdForRegion(current, partyRun.regionId),
      settledAt,
      rewardBalanceBefore: (agentId, resourceId) => currentBalance(current, agentId, resourceId),
      previousInfluenceScore: (agentId) => currentRegionInfluenceScore(current, partyRun.regionId, agentId),
    });
    const nextProjection = applyEvents(current, nextEvents);
    return commit(nextEvents, nextProjection.partyRuns[partyRunId]);
  }

  function resolveRaid(input: ResolveRaidInput, context: EpochCommandContext): EpochCommandResult<EpochRaidResult> {
    const current = projection();
    const regionId = assertNonEmptyString(input.regionId, "region_id");
    const attackerAgentId = assertNonEmptyString(input.attackerAgentId, "attacker_agent_id");
    const defenderAgentId = assertNonEmptyString(input.defenderAgentId, "defender_agent_id");
    if (attackerAgentId === defenderAgentId) throw new Error("raid_self_target_not_allowed");
    const attacker = requireActiveIdentity(current, attackerAgentId);
    const defender = requireActiveIdentity(current, defenderAgentId);
    if (attacker.explorerId === defender.explorerId) throw new Error("raid_same_explorer_not_allowed");
    assertIdentityOwner(attacker, context, "raid_attacker_owner_mismatch");
    const attackerStanding = agentSeasonStandingForRegion(current, { regionId, agentId: attackerAgentId });
    const defenderStanding = agentSeasonStandingForRegion(current, { regionId, agentId: defenderAgentId });
    const attackerFactionId = attackerStanding?.factionId;
    const defenderFactionId = defenderStanding?.factionId;
    if (attackerFactionId && defenderFactionId && attackerFactionId === defenderFactionId) {
      throw new Error("raid_same_faction_not_allowed");
    }
    const staminaSpent = assertPositiveInteger(input.staminaSpent, "raid_stamina_spent");
    const attackerStamina = currentBalance(current, attackerAgentId, "stamina");
    if (attackerStamina < staminaSpent) throw new Error("resource_insufficient");
    const resolvedAt = serverIsoTime(clock);
    const latestPairResolvedAt = latestRaidPairResolvedAt(current, regionId, attackerAgentId, defenderAgentId);
    if (latestPairResolvedAt) {
      const elapsedSeconds = Math.floor((Date.parse(resolvedAt) - Date.parse(latestPairResolvedAt)) / 1_000);
      if (elapsedSeconds < RAID_PAIR_COOLDOWN_SECONDS) {
        throw new Error("raid_pair_cooldown_active");
      }
    }
    const rewardDecayWindowStart = new Date(
      Date.parse(resolvedAt) - (RAID_PAIR_REWARD_DECAY_WINDOW_SECONDS * 1_000),
    ).toISOString();
    const recentPairRaidCount = raidPairResolvedCountSince(
      current,
      regionId,
      attackerAgentId,
      defenderAgentId,
      rewardDecayWindowStart,
    );
    const regionHeatWindowStart = new Date(
      Date.parse(resolvedAt) - (RAID_REGION_HEAT_REWARD_DECAY_WINDOW_SECONDS * 1_000),
    ).toISOString();
    const regionHeatRewardDecayed = regionRaidHeatScoreSince(current, regionId, regionHeatWindowStart) >= RAID_REGION_HEAT_REWARD_DECAY_SCORE;
    const crossFactionStandingBattle = Boolean(attackerFactionId && defenderFactionId && attackerFactionId !== defenderFactionId);
    const { attackerPower, defenderPower, outcome, reward } = raidBattleSettlement({
      staminaSpent,
      defenderFocus: currentBalance(current, defenderAgentId, "focus"),
      defenderLegend: currentBalance(current, defenderAgentId, "legend"),
      crossFactionStandingBattle,
      attackerStanding,
      defenderStanding,
      recentPairRaidCount,
      regionHeatRewardDecayed,
    });
    const winnerAgentId = outcome === "attacker_won" ? attackerAgentId : defenderAgentId;
    const loserAgentId = outcome === "attacker_won" ? defenderAgentId : attackerAgentId;
    const raidId = idFactory("raid", `${regionId}:${attackerAgentId}:${defenderAgentId}:${staminaSpent}:${resolvedAt}`);
    const makeEvent = eventFactory(clock, idFactory, context);
    const traceId = idFactory("trace", `${regionId}:${raidId}:raid`);
    const retaliationId = idFactory("retaliation", `${regionId}:${raidId}:${loserAgentId}:${winnerAgentId}`);
    const nextEvents = planRaidResolutionEvents({
      makeEvent,
      raidId,
      regionId,
      attackerAgentId,
      attackerExplorerId: attacker.explorerId,
      defenderAgentId,
      defenderExplorerId: defender.explorerId,
      staminaSpent,
      attackerPower,
      defenderPower,
      outcome,
      reward,
      resolvedAt,
      attackerStaminaBefore: attackerStamina,
      ...(reward.amount > 0
        ? {
            winnerRewardBalanceBefore: currentBalance(current, winnerAgentId, reward.resourceId),
            influenceId: idFactory("region_influence", `${regionId}:${raidId}:${winnerAgentId}:raid`),
            previousInfluenceScore: currentRegionInfluenceScore(current, regionId, winnerAgentId),
          }
        : {}),
      traceId,
      parentTraceId: latestTraceIdForRegion(current, regionId),
      retaliationId,
    });
    const nextProjection = applyEvents(current, nextEvents);
    return commit(nextEvents, projectRaidResolution({
      events: nextEvents,
      projection: nextProjection,
    }));
  }

  function resolveRetaliation(input: ResolveRetaliationInput, context: EpochCommandContext): EpochCommandResult<EpochRetaliationOpportunity> {
    const current = projection();
    const retaliationId = assertNonEmptyString(input.retaliationId, "retaliation_id");
    const retaliation = requireOpenRetaliationOpportunity(current, retaliationId);
    const opportunityAgentId = assertNonEmptyString(input.opportunityAgentId, "opportunity_agent_id");
    if (opportunityAgentId !== retaliation.opportunityAgentId) throw new Error("retaliation_owner_mismatch");
    const retaliator = requireActiveIdentity(current, opportunityAgentId);
    const target = requireActiveIdentity(current, retaliation.targetAgentId);
    assertIdentityOwner(retaliator, context, "retaliation_actor_owner_mismatch");
    const staminaSpent = assertPositiveInteger(input.staminaSpent, "retaliation_stamina_spent");
    const staminaBalance = currentBalance(current, opportunityAgentId, "stamina");
    if (staminaBalance < staminaSpent) throw new Error("resource_insufficient");
    const { retaliatorPower, targetPower, outcome, reward } = retaliationBattleSettlement({
      staminaSpent,
      retaliatorLegend: currentBalance(current, opportunityAgentId, "legend"),
      targetFocus: currentBalance(current, retaliation.targetAgentId, "focus"),
      targetLegend: currentBalance(current, retaliation.targetAgentId, "legend"),
    });
    const winnerAgentId = outcome === "retaliator_won" ? opportunityAgentId : retaliation.targetAgentId;
    const winnerExplorerId = outcome === "retaliator_won" ? retaliator.explorerId : target.explorerId;
    const resolvedAt = serverIsoTime(clock);
    const makeEvent = eventFactory(clock, idFactory, context);
    const influenceId = idFactory("region_influence", `${retaliation.regionId}:${retaliationId}:${winnerAgentId}:retaliation`);
    const traceId = idFactory("trace", `${retaliation.regionId}:${retaliationId}:retaliation`);
    const nextEvents = planRetaliationResolutionEvents({
      makeEvent,
      retaliationId,
      regionId: retaliation.regionId,
      sourceRaidId: retaliation.sourceRaidId,
      sourceTraceId: retaliation.sourceTraceId,
      opportunityAgentId,
      opportunityExplorerId: retaliator.explorerId,
      targetAgentId: retaliation.targetAgentId,
      targetExplorerId: target.explorerId,
      staminaSpent,
      retaliatorPower,
      targetPower,
      outcome,
      winnerAgentId,
      winnerExplorerId,
      reward,
      resolvedAt,
      retaliatorStaminaBefore: staminaBalance,
      winnerRewardBalanceBefore: currentBalance(current, winnerAgentId, reward.resourceId),
      influenceId,
      previousInfluenceScore: currentRegionInfluenceScore(current, retaliation.regionId, winnerAgentId),
      traceId,
      parentTraceId: latestTraceIdForRegion(current, retaliation.regionId),
    });
    const nextProjection = applyEvents(current, nextEvents);
    return commit(nextEvents, projectRetaliationResolution({
      events: nextEvents,
      projection: nextProjection,
    }));
  }

  function proposeDiplomacy(input: ProposeDiplomacyInput, context: EpochCommandContext): EpochCommandResult<EpochDiplomacyRecord> {
    const current = projection();
    const regionId = assertNonEmptyString(input.regionId, "region_id");
    const sourceAgentId = assertNonEmptyString(input.sourceAgentId, "source_agent_id");
    const targetAgentId = assertNonEmptyString(input.targetAgentId, "target_agent_id");
    if (sourceAgentId === targetAgentId) throw new Error("diplomacy_self_target_not_allowed");
    const source = requireActiveIdentity(current, sourceAgentId);
    const target = requireActiveIdentity(current, targetAgentId);
    assertIdentityOwner(source, context, "diplomacy_source_owner_mismatch");
    const kind = assertRelationshipKind(input.kind);
    const focusSpent = assertPositiveInteger(input.focusSpent, "diplomacy_focus_spent");
    const focusBalance = currentBalance(current, sourceAgentId, "focus");
    if (focusBalance < focusSpent) throw new Error("resource_insufficient");
    const terms = input.terms?.trim() || `diplomacy_${kind}`;
    const seed = diplomacySeed({ regionId, sourceAgentId, targetAgentId, kind, terms });
    const diplomacyId = idFactory("diplomacy", seed);
    const existing = current.diplomacyRecords[diplomacyId];
    if (existing) return { events: [], value: existing, projection: current };
    const proposedAt = serverIsoTime(clock);
    const makeEvent = eventFactory(clock, idFactory, context);
    const nextEvents = planDiplomacyProposalEvents({
      makeEvent,
      diplomacyId,
      regionId,
      sourceAgentId,
      sourceExplorerId: source.explorerId,
      targetAgentId,
      targetExplorerId: target.explorerId,
      kind,
      focusSpent,
      focusBalanceBefore: focusBalance,
      terms,
      proposedAt,
    });
    const nextProjection = applyEvents(current, nextEvents);
    return commit(nextEvents, nextProjection.diplomacyRecords[diplomacyId]);
  }

  function respondDiplomacy(input: RespondDiplomacyInput, context: EpochCommandContext): EpochCommandResult<EpochDiplomacyRecord> {
    const current = projection();
    const diplomacyId = assertNonEmptyString(input.diplomacyId, "diplomacy_id");
    const responderAgentId = assertNonEmptyString(input.responderAgentId, "responder_agent_id");
    const diplomacy = current.diplomacyRecords[diplomacyId];
    if (!diplomacy) throw new Error("diplomacy_not_found");
    if (diplomacy.status !== "pending") throw new Error("diplomacy_not_pending");
    if (responderAgentId !== diplomacy.targetAgentId) throw new Error("diplomacy_responder_not_target");
    const responder = requireActiveIdentity(current, responderAgentId);
    assertIdentityOwner(responder, context, "diplomacy_responder_owner_mismatch");
    const response = assertDiplomacyResponse(input.response);
    const focusSpent = response === "accepted"
      ? assertPositiveInteger(input.focusSpent ?? 1, "diplomacy_focus_spent")
      : Math.max(0, assertFiniteInteger(input.focusSpent ?? 0, "diplomacy_focus_spent"));
    const focusBalance = currentBalance(current, responderAgentId, "focus");
    if (focusBalance < focusSpent) throw new Error("resource_insufficient");
    const respondedAt = serverIsoTime(clock);
    const makeEvent = eventFactory(clock, idFactory, context);
    const relationshipId = response === "accepted" ? idFactory("relationship", diplomacySeed(diplomacy)) : undefined;
    const nextEvents: EpochEvent[] = [...planDiplomacyResponseEvents({
      makeEvent,
      diplomacyId,
      regionId: diplomacy.regionId,
      sourceAgentId: diplomacy.sourceAgentId,
      sourceExplorerId: diplomacy.sourceExplorerId,
      targetAgentId: diplomacy.targetAgentId,
      targetExplorerId: diplomacy.targetExplorerId,
      responderAgentId,
      kind: diplomacy.kind,
      response,
      focusSpent,
      focusBalanceBefore: focusBalance,
      note: input.note?.trim() || `diplomacy_${response}`,
      relationshipId,
      respondedAt,
    })];
    const responded = nextEvents.find(
      (event): event is Extract<EpochEvent, { readonly eventType: "diplomacy_responded" }> =>
        event.eventType === "diplomacy_responded",
    );
    if (!responded) throw new Error("diplomacy_response_projection_failed");
    if (response === "accepted" && relationshipId) {
      const acceptedEvents = planDiplomacyAcceptedRelationshipTraceEvents({
        makeEvent,
        traceId: idFactory("trace", `${diplomacy.regionId}:${diplomacyId}:diplomacy`),
        diplomacyId,
        relationshipId,
        regionId: diplomacy.regionId,
        sourceAgentId: diplomacy.sourceAgentId,
        sourceExplorerId: diplomacy.sourceExplorerId,
        targetAgentId: diplomacy.targetAgentId,
        targetExplorerId: responder.explorerId,
        kind: diplomacy.kind,
        focusSpent,
        previousScore: current.relationshipEdges[relationshipId]?.score || 0,
        respondedEventId: responded.eventId,
        parentTraceId: latestTraceIdForRegion(current, diplomacy.regionId),
        respondedAt,
      });
      const relationshipUpdated = acceptedEvents.find(
        (event): event is Extract<EpochEvent, { readonly eventType: "relationship_updated" }> =>
          event.eventType === "relationship_updated",
      );
      if (!relationshipUpdated) throw new Error("diplomacy_acceptance_projection_failed");
      nextEvents.push(relationshipUpdated);
      const afterRelationship = applyEvents(current, nextEvents);
      const driftProposed = proposeRelationshipPersonalityDriftEvent(afterRelationship, relationshipUpdated.payload, relationshipUpdated, context);
      if (driftProposed) nextEvents.push(driftProposed);
      const traceCreated = acceptedEvents.find(
        (event): event is Extract<EpochEvent, { readonly eventType: "trace_created" }> =>
          event.eventType === "trace_created",
      );
      if (!traceCreated) throw new Error("diplomacy_acceptance_trace_projection_failed");
      nextEvents.push(traceCreated);
    }
    const nextProjection = applyEvents(current, nextEvents);
    return commit(nextEvents, nextProjection.diplomacyRecords[diplomacyId]);
  }


  function updateRelationship(
    input: UpdateRelationshipInput,
    context: EpochCommandContext,
  ): EpochCommandResult<EpochRelationshipEdge> {
    const current = projection();
    const sourceAgentId = assertNonEmptyString(input.sourceAgentId, "source_agent_id");
    const targetAgentId = assertNonEmptyString(input.targetAgentId, "target_agent_id");
    if (sourceAgentId === targetAgentId) throw new Error("relationship_self_target_not_allowed");
    const source = requireActiveIdentity(current, sourceAgentId);
    const target = requireActiveIdentity(current, targetAgentId);
    assertIdentityOwner(source, context, "relationship_source_owner_mismatch");
    const kind = assertRelationshipKind(input.kind);
    const focusSpent = assertPositiveInteger(input.focusSpent, "relationship_focus_spent");
    const focusBalance = currentBalance(current, sourceAgentId, "focus");
    if (focusBalance < focusSpent) throw new Error("resource_insufficient");
    const relationshipId = idFactory("relationship", `${kind}:${sourceAgentId}:${targetAgentId}`);
    const previousScore = current.relationshipEdges[relationshipId]?.score || 0;
    const reason = input.reason?.trim() || `relationship_${kind}`;
    const updatedAt = serverIsoTime(clock);
    const makeEvent = eventFactory(clock, idFactory, context);
    const nextEvents: EpochEvent[] = [...planRelationshipUpdateEvents({
      makeEvent,
      relationshipId,
      sourceAgentId,
      sourceExplorerId: source.explorerId,
      targetAgentId,
      targetExplorerId: target.explorerId,
      kind,
      focusSpent,
      focusBalanceBefore: focusBalance,
      previousScore,
      reason,
      updatedAt,
    })];
    const relationshipUpdated = nextEvents.find(
      (event): event is Extract<EpochEvent, { readonly eventType: "relationship_updated" }> =>
        event.eventType === "relationship_updated",
    );
    if (!relationshipUpdated) throw new Error("relationship_update_projection_failed");
    const payload = relationshipUpdated.payload;
    const afterRelationship = applyEvents(current, nextEvents);
    const driftProposed = proposeRelationshipPersonalityDriftEvent(afterRelationship, payload, relationshipUpdated, context);
    if (driftProposed) nextEvents.push(driftProposed);
    const nextProjection = applyEvents(current, nextEvents);
    return commit(nextEvents, nextProjection.relationshipEdges[relationshipId]);
  }

  function updateAgentNpcBond(
    input: UpdateAgentNpcBondInput,
    context: EpochCommandContext,
  ): EpochCommandResult<EpochAgentNpcBond> {
    const current = projection();
    const agentId = assertNonEmptyString(input.agentId, "agent_id");
    const identity = requireActiveIdentity(current, agentId);
    const contextTrustClass = normalizeTrustClass(context.trustClass);
    if (identity.explorerId !== context.actorExplorerId && contextTrustClass !== "system_worker") {
      throw new Error("agent_npc_bond_owner_mismatch");
    }
    const npcId = assertNonEmptyString(input.npcId, "npc_id");
    const npc = current.npcs[npcId];
    if (!npc) throw new Error("npc_not_found");
    const kind = assertNpcRelationshipKind(input.kind);
    assertChildNpcBondAllowed(npc, kind);
    const focusSpent = assertPositiveInteger(input.focusSpent, "agent_npc_bond_focus_spent");
    const focusBalance = currentBalance(current, agentId, "focus");
    if (focusBalance < focusSpent) throw new Error("resource_insufficient");
    const bondId = idFactory("agent_npc_bond", `${agentId}:${npcId}:${kind}`);
    const previousScore = current.agentNpcBonds[bondId]?.score || 0;
    const reason = input.reason?.trim() || `agent_npc_bond_${kind}`;
    const updatedAt = serverIsoTime(clock);
    const makeEvent = eventFactory(clock, idFactory, context);
    const nextEvents = planAgentNpcBondUpdateEvents({
      makeEvent,
      bondId,
      agentId,
      explorerId: identity.explorerId,
      npcId,
      npcRegionId: npc.regionId,
      kind,
      focusSpent,
      focusBalanceBefore: focusBalance,
      previousScore,
      reason,
      updatedAt,
    });
    const nextProjection = applyEvents(current, nextEvents);
    return commit(nextEvents, nextProjection.agentNpcBonds[bondId]);
  }

  return {
    createPartyRun,
    updatePartyInvite,
    joinPartyRun,
    requestPartyJoin,
    resolvePartyJoinRequest,
    settlePartyRun,
    resolveRaid,
    resolveRetaliation,
    proposeDiplomacy,
    respondDiplomacy,
    updateRelationship,
    updateAgentNpcBond,
  };
}
