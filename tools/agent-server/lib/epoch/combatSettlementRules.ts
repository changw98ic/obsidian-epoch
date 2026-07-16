import { createHash } from "node:crypto";

import type {
  EpochEvent,
  PartyInviteUpdatedPayload,
  PartyJoinRequestedPayload,
  PartyJoinRequestResolution,
  PartyJoinRequestResolvedPayload,
  PartyMemberJoinedPayload,
  PartyMemberSettlementPayload,
  PartyRunCreatedPayload,
  PartyRunSettledPayload,
  RaidOutcome,
  RaidResolvedPayload,
  RegionInfluenceChangedPayload,
  RetaliationOpportunityCreatedPayload,
  RetaliationOutcome,
  RetaliationResolvedPayload,
  ResourceGrantedPayload,
  ResourceSpentPayload,
  TraceCreatedPayload,
} from "./events.ts";
import type { EpochEventFactory } from "./eventFactory.ts";
import {
  regionInfluenceChangedEvent,
  traceCreatedEvent,
} from "./regionEventLedgerEvents.ts";
import {
  resourceGrantedEvent,
  resourceSpentEvent,
} from "./resourceLedgerEvents.ts";
import { regionNewsGeneratedPayload } from "./moderationRiskRules.ts";
import {
  EPOCH_PARTY_ROLES,
  EPOCH_PARTY_RUN_JOIN_POLICIES,
  type EpochPartyRole,
  type EpochPartyRunJoinPolicy,
  type EpochIdFactory,
  type EpochServerReward,
  assertPositiveInteger,
} from "./protocol.ts";

export const PARTY_ROLE_SCORE: Record<EpochPartyRole, number> = {
  leader: 3,
  vanguard: 3,
  scout: 2,
  support: 2,
  scribe: 1,
};

const PARTY_VANGUARD_INFLUENCE_BONUS = 1;
const PARTY_SCRIBE_NEWS_BONUS = 1;

export const MAX_PARTY_RUN_MEMBERS = 4;
export const PARTY_INVITE_TOKEN_TTL_SECONDS = 24 * 60 * 60;
export const RAID_PAIR_COOLDOWN_SECONDS = 60 * 60;
export const RAID_PAIR_REWARD_DECAY_WINDOW_SECONDS = 24 * 60 * 60;
export const RAID_REGION_HEAT_REWARD_DECAY_WINDOW_SECONDS = 24 * 60 * 60;
export const RAID_REGION_HEAT_REWARD_DECAY_SCORE = 3;

const RAID_SEASON_STANDING_POWER_BONUS_DIVISOR = 2;
const RAID_SEASON_STANDING_POWER_BONUS_MAX = 3;

export interface PartyRoleMember {
  readonly participantRole: EpochPartyRole;
}

export interface PartyMemberSettlementScore extends PartyRoleMember {
  readonly score: number;
}

export interface PartyRunSettlementMemberInput extends PartyRoleMember {
  readonly agentId: string;
  readonly explorerId: string;
}

export interface PartyRunCreatedPayloadInput {
  readonly partyRunId: string;
  readonly regionId: string;
  readonly leaderAgentId: string;
  readonly leaderExplorerId: string;
  readonly title: string;
  readonly objective: string;
  readonly joinPolicy: EpochPartyRunJoinPolicy;
  readonly inviteTokenHash?: string;
  readonly inviteTokenExpiresAt?: string;
  readonly inviteTokenUseLimit?: number;
  readonly inviteRecipientAgentId?: string;
  readonly createdAt: string;
}

export interface PartyInviteUpdatedPayloadInput {
  readonly partyRunId: string;
  readonly regionId: string;
  readonly leaderAgentId: string;
  readonly leaderExplorerId: string;
  readonly updateKind: PartyInviteUpdatedPayload["updateKind"];
  readonly inviteTokenHash?: string;
  readonly inviteTokenExpiresAt?: string;
  readonly inviteTokenUseLimit?: number;
  readonly inviteRecipientAgentId?: string;
  readonly updatedAt: string;
}

export interface PartyMemberJoinedPayloadInput {
  readonly partyRunId: string;
  readonly regionId: string;
  readonly agentId: string;
  readonly explorerId: string;
  readonly participantRole: EpochPartyRole;
  readonly joinedAt: string;
  readonly inviteTokenUsed?: boolean;
}

export interface PartyJoinRequestedPayloadInput {
  readonly requestId: string;
  readonly partyRunId: string;
  readonly regionId: string;
  readonly agentId: string;
  readonly explorerId: string;
  readonly participantRole: EpochPartyRole;
  readonly requestNote?: string;
  readonly requestedAt: string;
}

export interface PartyJoinRequestResolvedPayloadInput {
  readonly requestId: string;
  readonly partyRunId: string;
  readonly regionId: string;
  readonly agentId: string;
  readonly explorerId: string;
  readonly participantRole: EpochPartyRole;
  readonly resolution: PartyJoinRequestResolution;
  readonly resolvedByAgentId: string;
  readonly resolvedByExplorerId: string;
  readonly resolutionNote?: string;
  readonly resolvedAt: string;
}

export interface RaidBattleSettlementInput {
  readonly staminaSpent: number;
  readonly defenderFocus: number;
  readonly defenderLegend: number;
  readonly crossFactionStandingBattle: boolean;
  readonly attackerStanding?: { readonly score: number };
  readonly defenderStanding?: { readonly score: number };
  readonly recentPairRaidCount: number;
  readonly regionHeatRewardDecayed: boolean;
}

export interface RaidResultForRules {
  readonly attackerAgentId: string;
  readonly defenderAgentId: string;
  readonly resolvedAt: string;
  readonly reward: EpochServerReward;
}

export interface RaidResultProjectionForRules<TRaidResult extends RaidResultForRules = RaidResultForRules> {
  readonly raidIdsByRegion: Readonly<Record<string, readonly string[]>>;
  readonly raidResults: Readonly<Record<string, TRaidResult | undefined>>;
}

export interface PartyRunStatusForRules {
  readonly status: string;
}

export interface PartyRunProjectionForRules<TPartyRun extends PartyRunStatusForRules = PartyRunStatusForRules> {
  readonly partyRuns: Readonly<Record<string, TPartyRun | undefined>>;
}

export interface PartyRunProjectionInput<TPartyRun extends PartyRunStatusForRules> {
  readonly projection: Pick<PartyRunProjectionForRules<TPartyRun>, "partyRuns">;
  readonly events: readonly EpochEvent[];
}

export interface PartyRunCreationEventsInput extends PartyRunCreatedPayloadInput {
  readonly makeEvent: EpochEventFactory;
}

export interface PartyInviteUpdateEventsInput extends PartyInviteUpdatedPayloadInput {
  readonly inviteEventId: string;
  readonly makeEvent: EpochEventFactory;
}

export interface PartyMemberJoinEventsInput extends PartyMemberJoinedPayloadInput {
  readonly makeEvent: EpochEventFactory;
}

export interface PartyJoinRequestEventsInput extends PartyJoinRequestedPayloadInput {
  readonly makeEvent: EpochEventFactory;
}

export interface PartyJoinRequestResolutionEventsInput extends PartyJoinRequestResolvedPayloadInput {
  readonly approvedMemberExplorerId?: string;
  readonly makeEvent: EpochEventFactory;
}

export interface RetaliationOpportunityStatusForRules {
  readonly status: string;
}

export interface RetaliationOpportunityProjectionForRules<
  TRetaliationOpportunity extends RetaliationOpportunityStatusForRules = RetaliationOpportunityStatusForRules,
> {
  readonly retaliationOpportunities: Readonly<Record<string, TRetaliationOpportunity | undefined>>;
}

export interface PartyRunSettledPayloadInput {
  readonly partyRunId: string;
  readonly regionId: string;
  readonly totalScore: number;
  readonly memberResults: readonly PartyMemberSettlementPayload[];
  readonly traceId: string;
  readonly newsId: string;
  readonly settledAt: string;
}

export interface PartyRunMemberInfluencePayloadInput {
  readonly influenceId: string;
  readonly partyRunId: string;
  readonly regionId: string;
  readonly member: PartyMemberSettlementPayload;
  readonly previousInfluenceScore: number;
  readonly sourceEventId: string;
  readonly changedAt: string;
}

export interface PartyRunMemberRewardGrantPayloadInput {
  readonly member: PartyMemberSettlementPayload;
  readonly balanceBefore: number;
}

export interface PartyRunTracePayloadInput {
  readonly traceId: string;
  readonly partyRunId: string;
  readonly regionId: string;
  readonly partyTitle: string;
  readonly totalScore: number;
  readonly memberResults: readonly PartyMemberSettlementPayload[];
  readonly sourceEventIds: readonly string[];
  readonly relatedInfluenceIds: readonly string[];
  readonly parentTraceId?: string;
  readonly createdAt: string;
}

export interface PartyRunSettlementEventsInput {
  readonly makeEvent: EpochEventFactory;
  readonly idFactory: EpochIdFactory;
  readonly partyRunId: string;
  readonly regionId: string;
  readonly leaderAgentId: string;
  readonly partyTitle: string;
  readonly partyObjective: string;
  readonly partyMemberCount: number;
  readonly memberResults: readonly PartyMemberSettlementPayload[];
  readonly totalScore: number;
  readonly traceId: string;
  readonly newsId: string;
  readonly parentTraceId?: string;
  readonly settledAt: string;
  readonly rewardBalanceBefore: (agentId: string, resourceId: EpochServerReward["resourceId"]) => number;
  readonly previousInfluenceScore: (agentId: string) => number;
}

export interface RaidBattleSettlement {
  readonly attackerPower: number;
  readonly defenderPower: number;
  readonly outcome: RaidOutcome;
  readonly reward: EpochServerReward;
}

export interface RaidAttackStaminaSpendPayloadInput {
  readonly raidId: string;
  readonly staminaSpent: number;
  readonly attackerStaminaBefore: number;
}

export interface RaidRewardGrantPayloadInput {
  readonly reward: EpochServerReward;
  readonly winnerRewardBalanceBefore: number;
}

export interface RetaliationBattleSettlementInput {
  readonly staminaSpent: number;
  readonly retaliatorLegend: number;
  readonly targetFocus: number;
  readonly targetLegend: number;
}

export interface RetaliationBattleSettlement {
  readonly retaliatorPower: number;
  readonly targetPower: number;
  readonly outcome: RetaliationOutcome;
  readonly reward: EpochServerReward;
}

export interface RetaliationStaminaSpendPayloadInput {
  readonly retaliationId: string;
  readonly staminaSpent: number;
  readonly retaliatorStaminaBefore: number;
}

export interface RetaliationRewardGrantPayloadInput {
  readonly reward: EpochServerReward;
  readonly winnerRewardBalanceBefore: number;
}

export interface RaidResolvedPayloadInput {
  readonly raidId: string;
  readonly regionId: string;
  readonly attackerAgentId: string;
  readonly attackerExplorerId: string;
  readonly defenderAgentId: string;
  readonly defenderExplorerId: string;
  readonly staminaSpent: number;
  readonly attackerPower: number;
  readonly defenderPower: number;
  readonly outcome: RaidOutcome;
  readonly reward: EpochServerReward;
  readonly resolvedAt: string;
}

export interface RaidSettlementInfluencePayloadInput {
  readonly influenceId: string;
  readonly raidId: string;
  readonly regionId: string;
  readonly winnerAgentId: string;
  readonly winnerExplorerId: string;
  readonly previousInfluenceScore: number;
  readonly reward: EpochServerReward;
  readonly sourceEventId: string;
  readonly changedAt: string;
}

export interface RaidSettlementTracePayloadInput {
  readonly traceId: string;
  readonly raidId: string;
  readonly regionId: string;
  readonly winnerAgentId: string;
  readonly outcome: RaidOutcome;
  readonly sourceEventIds: readonly string[];
  readonly relatedInfluenceIds: readonly string[];
  readonly attackerAgentId: string;
  readonly attackerExplorerId: string;
  readonly defenderAgentId: string;
  readonly defenderExplorerId: string;
  readonly parentTraceId?: string;
  readonly createdAt: string;
}

export interface RetaliationOpportunityCreatedPayloadInput {
  readonly retaliationId: string;
  readonly regionId: string;
  readonly sourceRaidId: string;
  readonly sourceTraceId: string;
  readonly opportunityAgentId: string;
  readonly opportunityExplorerId: string;
  readonly targetAgentId: string;
  readonly targetExplorerId: string;
  readonly reason: string;
  readonly sourceEventIds: readonly string[];
  readonly createdAt: string;
}

export interface RetaliationResolvedPayloadInput {
  readonly retaliationId: string;
  readonly regionId: string;
  readonly sourceRaidId: string;
  readonly sourceTraceId: string;
  readonly opportunityAgentId: string;
  readonly opportunityExplorerId: string;
  readonly targetAgentId: string;
  readonly targetExplorerId: string;
  readonly staminaSpent: number;
  readonly retaliatorPower: number;
  readonly targetPower: number;
  readonly outcome: RetaliationOutcome;
  readonly winnerAgentId: string;
  readonly winnerExplorerId: string;
  readonly reward: EpochServerReward;
  readonly resolvedAt: string;
}

export interface RetaliationSettlementInfluencePayloadInput {
  readonly influenceId: string;
  readonly retaliationId: string;
  readonly regionId: string;
  readonly winnerAgentId: string;
  readonly winnerExplorerId: string;
  readonly previousInfluenceScore: number;
  readonly reward: EpochServerReward;
  readonly sourceEventId: string;
  readonly changedAt: string;
}

export interface RetaliationSettlementTracePayloadInput {
  readonly traceId: string;
  readonly retaliationId: string;
  readonly regionId: string;
  readonly winnerAgentId: string;
  readonly outcome: RetaliationOutcome;
  readonly sourceEventIds: readonly string[];
  readonly relatedInfluenceIds: readonly string[];
  readonly opportunityAgentId: string;
  readonly opportunityExplorerId: string;
  readonly targetAgentId: string;
  readonly targetExplorerId: string;
  readonly parentTraceId?: string;
  readonly createdAt: string;
}

export interface RaidResolutionEventsInput extends RaidResolvedPayloadInput {
  readonly makeEvent: EpochEventFactory;
  readonly attackerStaminaBefore: number;
  readonly winnerRewardBalanceBefore?: number;
  readonly influenceId?: string;
  readonly previousInfluenceScore?: number;
  readonly traceId: string;
  readonly parentTraceId?: string;
  readonly retaliationId: string;
}

export interface RaidResolutionProjectionInput<TRaidResult extends RaidResultForRules> {
  readonly projection: Pick<RaidResultProjectionForRules<TRaidResult>, "raidResults">;
  readonly events: readonly EpochEvent[];
}

export interface RetaliationResolutionEventsInput extends RetaliationResolvedPayloadInput {
  readonly makeEvent: EpochEventFactory;
  readonly retaliatorStaminaBefore: number;
  readonly winnerRewardBalanceBefore: number;
  readonly influenceId: string;
  readonly previousInfluenceScore: number;
  readonly traceId: string;
  readonly parentTraceId?: string;
}

export interface RetaliationResolutionProjectionInput<
  TRetaliationOpportunity extends RetaliationOpportunityStatusForRules,
> {
  readonly projection: Pick<
    RetaliationOpportunityProjectionForRules<TRetaliationOpportunity>,
    "retaliationOpportunities"
  >;
  readonly events: readonly EpochEvent[];
}

export function partyRoleSynergyBonus(members: readonly PartyRoleMember[]) {
  const hasSupport = members.some((member) => member.participantRole === "support");
  return hasSupport && members.length >= 3 ? 1 : 0;
}

export function partyMemberInfluenceDelta(member: PartyMemberSettlementScore) {
  return member.score + (member.participantRole === "vanguard" ? PARTY_VANGUARD_INFLUENCE_BONUS : 0);
}

export function partyNewsLegendDelta(totalScore: number, members: readonly PartyRoleMember[]) {
  const scribeBonus = members.some((member) => member.participantRole === "scribe") ? PARTY_SCRIBE_NEWS_BONUS : 0;
  return Math.max(1, Math.floor(totalScore / 3)) + scribeBonus;
}

export function partyRunMemberSettlementResults(
  partyRunId: string,
  members: readonly PartyRunSettlementMemberInput[],
): readonly PartyMemberSettlementPayload[] {
  const synergyBonus = partyRoleSynergyBonus(members);
  return members.map((member) => {
    const score = PARTY_ROLE_SCORE[member.participantRole] + synergyBonus;
    return {
      agentId: member.agentId,
      explorerId: member.explorerId,
      participantRole: member.participantRole,
      score,
      reward: {
        resourceId: "coin",
        amount: score,
        reason: `party_run_settlement:${partyRunId}`,
      },
    };
  });
}

export function partyRunTotalScore(memberResults: readonly PartyMemberSettlementPayload[]): number {
  return memberResults.reduce((sum, member) => sum + member.score, 0);
}

export function assertPartyRole(value: unknown, fieldName: string): EpochPartyRole {
  if (typeof value === "string" && EPOCH_PARTY_ROLES.includes(value as EpochPartyRole)) {
    return value as EpochPartyRole;
  }
  throw new Error(`${fieldName}_invalid`);
}

export function assertPartyRunJoinPolicy(value: unknown): EpochPartyRunJoinPolicy {
  if (value === undefined) return "open";
  if (typeof value === "string" && EPOCH_PARTY_RUN_JOIN_POLICIES.includes(value as EpochPartyRunJoinPolicy)) {
    return value as EpochPartyRunJoinPolicy;
  }
  throw new Error("party_join_policy_invalid");
}

export function requirePartyRun<TPartyRun extends PartyRunStatusForRules>(
  projection: PartyRunProjectionForRules<TPartyRun>,
  partyRunId: string,
): TPartyRun {
  const partyRun = projection.partyRuns[partyRunId];
  if (!partyRun) throw new Error("party_run_not_found");
  return partyRun;
}

export function requireOpenPartyRun<TPartyRun extends PartyRunStatusForRules>(
  projection: PartyRunProjectionForRules<TPartyRun>,
  partyRunId: string,
): TPartyRun {
  const partyRun = requirePartyRun(projection, partyRunId);
  if (partyRun.status !== "open") throw new Error("party_run_not_open");
  return partyRun;
}

export function requireRetaliationOpportunity<TRetaliationOpportunity extends RetaliationOpportunityStatusForRules>(
  projection: RetaliationOpportunityProjectionForRules<TRetaliationOpportunity>,
  retaliationId: string,
): TRetaliationOpportunity {
  const retaliation = projection.retaliationOpportunities[retaliationId];
  if (!retaliation) throw new Error("retaliation_not_found");
  return retaliation;
}

export function requireOpenRetaliationOpportunity<
  TRetaliationOpportunity extends RetaliationOpportunityStatusForRules,
>(
  projection: RetaliationOpportunityProjectionForRules<TRetaliationOpportunity>,
  retaliationId: string,
): TRetaliationOpportunity {
  const retaliation = requireRetaliationOpportunity(projection, retaliationId);
  if (retaliation.status !== "open") throw new Error("retaliation_not_open");
  return retaliation;
}

export function assertPartyJoinRequestResolution(
  value: unknown,
): PartyJoinRequestResolution {
  if (value === "approved" || value === "rejected") return value;
  throw new Error("party_join_request_resolution_invalid");
}

export function optionalInviteToken(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

export function partyInviteTokenHash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function partyInviteTokenExpiresAt(value: string | undefined, createdAt: string): string {
  if (value === undefined) {
    return new Date(Date.parse(createdAt) + PARTY_INVITE_TOKEN_TTL_SECONDS * 1_000).toISOString();
  }
  const expiresAtMs = Date.parse(value);
  if (!Number.isFinite(expiresAtMs)) throw new Error("party_invite_expires_at_invalid");
  if (expiresAtMs <= Date.parse(createdAt)) throw new Error("party_invite_expired");
  return new Date(expiresAtMs).toISOString();
}

export function partyInviteTokenUseLimit(value: number | undefined): number {
  const limit = value === undefined
    ? MAX_PARTY_RUN_MEMBERS - 1
    : assertPositiveInteger(value, "party_invite_use_limit");
  if (limit > MAX_PARTY_RUN_MEMBERS - 1) throw new Error("party_invite_use_limit_invalid");
  return limit;
}

export function partyRunCreatedPayload(input: PartyRunCreatedPayloadInput): PartyRunCreatedPayload {
  return {
    partyRunId: input.partyRunId,
    regionId: input.regionId,
    leaderAgentId: input.leaderAgentId,
    leaderExplorerId: input.leaderExplorerId,
    title: input.title,
    objective: input.objective,
    joinPolicy: input.joinPolicy,
    inviteTokenHash: input.joinPolicy === "invite_only" ? input.inviteTokenHash : undefined,
    inviteTokenExpiresAt: input.joinPolicy === "invite_only" ? input.inviteTokenExpiresAt : undefined,
    inviteTokenUseLimit: input.joinPolicy === "invite_only" ? input.inviteTokenUseLimit : undefined,
    inviteTokenUses: input.joinPolicy === "invite_only" ? 0 : undefined,
    inviteRecipientAgentId: input.joinPolicy === "invite_only" ? input.inviteRecipientAgentId : undefined,
    participantRole: "leader",
    createdAt: input.createdAt,
  };
}

export function planPartyRunCreationEvents(input: PartyRunCreationEventsInput): readonly EpochEvent[] {
  const created = input.makeEvent("party_run_created", input.partyRunId, partyRunCreatedPayload(input), {
    aggregateType: "party_run",
    agentId: input.leaderAgentId,
  });
  return [created];
}

export function projectPartyRunCreation<TPartyRun extends PartyRunStatusForRules>(
  input: PartyRunProjectionInput<TPartyRun>,
): TPartyRun {
  const created = input.events.find((event) => event.eventType === "party_run_created");
  if (!created || created.eventType !== "party_run_created") throw new Error("party_run_created_event_missing");
  const partyRun = input.projection.partyRuns[created.payload.partyRunId];
  if (!partyRun) throw new Error("party_run_projection_failed");
  return partyRun;
}

export function partyInviteUpdatedPayload(input: PartyInviteUpdatedPayloadInput): PartyInviteUpdatedPayload {
  return {
    partyRunId: input.partyRunId,
    regionId: input.regionId,
    leaderAgentId: input.leaderAgentId,
    leaderExplorerId: input.leaderExplorerId,
    updateKind: input.updateKind,
    inviteTokenHash: input.updateKind === "rotated" ? input.inviteTokenHash : undefined,
    inviteTokenExpiresAt: input.updateKind === "rotated" ? input.inviteTokenExpiresAt : undefined,
    inviteTokenUseLimit: input.updateKind === "rotated" ? input.inviteTokenUseLimit : 0,
    inviteTokenUses: 0,
    inviteRecipientAgentId: input.updateKind === "rotated" ? input.inviteRecipientAgentId : undefined,
    inviteTokenRevokedAt: input.updateKind === "revoked" ? input.updatedAt : undefined,
    updatedAt: input.updatedAt,
  };
}

export function planPartyInviteUpdateEvents(input: PartyInviteUpdateEventsInput): readonly EpochEvent[] {
  const updated = input.makeEvent("party_invite_updated", input.inviteEventId, partyInviteUpdatedPayload(input), {
    aggregateType: "party_run",
    agentId: input.leaderAgentId,
  });
  return [updated];
}

export function projectPartyInviteUpdate<TPartyRun extends PartyRunStatusForRules>(
  input: PartyRunProjectionInput<TPartyRun>,
): TPartyRun {
  const updated = input.events.find((event) => event.eventType === "party_invite_updated");
  if (!updated || updated.eventType !== "party_invite_updated") {
    throw new Error("party_invite_updated_event_missing");
  }
  const partyRun = input.projection.partyRuns[updated.payload.partyRunId];
  if (!partyRun) throw new Error("party_run_projection_failed");
  return partyRun;
}

export function partyMemberJoinedPayload(input: PartyMemberJoinedPayloadInput): PartyMemberJoinedPayload {
  return {
    partyRunId: input.partyRunId,
    regionId: input.regionId,
    agentId: input.agentId,
    explorerId: input.explorerId,
    participantRole: input.participantRole,
    joinedAt: input.joinedAt,
    inviteTokenUsed: input.inviteTokenUsed,
  };
}

export function planPartyMemberJoinEvents(input: PartyMemberJoinEventsInput): readonly EpochEvent[] {
  const joined = input.makeEvent("party_member_joined", input.partyRunId, partyMemberJoinedPayload(input), {
    aggregateType: "party_run",
    agentId: input.agentId,
  });
  return [joined];
}

export function projectPartyMemberJoin<TPartyRun extends PartyRunStatusForRules>(
  input: PartyRunProjectionInput<TPartyRun>,
): TPartyRun {
  const joined = input.events.find((event) => event.eventType === "party_member_joined");
  if (!joined || joined.eventType !== "party_member_joined") {
    throw new Error("party_member_joined_event_missing");
  }
  const partyRun = input.projection.partyRuns[joined.payload.partyRunId];
  if (!partyRun) throw new Error("party_run_projection_failed");
  return partyRun;
}

export function partyJoinRequestedPayload(input: PartyJoinRequestedPayloadInput): PartyJoinRequestedPayload {
  const requestNote = typeof input.requestNote === "string" && input.requestNote.trim()
    ? input.requestNote.trim()
    : undefined;
  return {
    requestId: input.requestId,
    partyRunId: input.partyRunId,
    regionId: input.regionId,
    agentId: input.agentId,
    explorerId: input.explorerId,
    participantRole: input.participantRole,
    requestNote,
    requestedAt: input.requestedAt,
  };
}

export function planPartyJoinRequestEvents(input: PartyJoinRequestEventsInput): readonly EpochEvent[] {
  const requested = input.makeEvent("party_join_requested", input.requestId, partyJoinRequestedPayload(input), {
    aggregateType: "party_run",
    agentId: input.agentId,
  });
  return [requested];
}

export function projectPartyJoinRequest<TPartyRun extends PartyRunStatusForRules>(
  input: PartyRunProjectionInput<TPartyRun>,
): TPartyRun {
  const requested = input.events.find((event) => event.eventType === "party_join_requested");
  if (!requested || requested.eventType !== "party_join_requested") {
    throw new Error("party_join_requested_event_missing");
  }
  const partyRun = input.projection.partyRuns[requested.payload.partyRunId];
  if (!partyRun) throw new Error("party_run_projection_failed");
  return partyRun;
}

export function partyJoinRequestResolvedPayload(
  input: PartyJoinRequestResolvedPayloadInput,
): PartyJoinRequestResolvedPayload {
  const resolutionNote = typeof input.resolutionNote === "string" && input.resolutionNote.trim()
    ? input.resolutionNote.trim()
    : undefined;
  return {
    requestId: input.requestId,
    partyRunId: input.partyRunId,
    regionId: input.regionId,
    agentId: input.agentId,
    explorerId: input.explorerId,
    participantRole: input.participantRole,
    resolution: input.resolution,
    resolvedByAgentId: input.resolvedByAgentId,
    resolvedByExplorerId: input.resolvedByExplorerId,
    resolutionNote,
    resolvedAt: input.resolvedAt,
  };
}

export function planPartyJoinRequestResolutionEvents(
  input: PartyJoinRequestResolutionEventsInput,
): readonly EpochEvent[] {
  const resolved = input.makeEvent(
    "party_join_request_resolved",
    input.requestId,
    partyJoinRequestResolvedPayload(input),
    {
      aggregateType: "party_run",
      agentId: input.resolvedByAgentId,
    },
  );
  if (input.resolution !== "approved") return [resolved];
  const joined = input.makeEvent("party_member_joined", input.partyRunId, partyMemberJoinedPayload({
    partyRunId: input.partyRunId,
    regionId: input.regionId,
    agentId: input.agentId,
    explorerId: input.approvedMemberExplorerId || input.explorerId,
    participantRole: input.participantRole,
    joinedAt: input.resolvedAt,
  }), {
    aggregateType: "party_run",
    agentId: input.agentId,
  });
  return [resolved, joined];
}

export function projectPartyJoinRequestResolution<TPartyRun extends PartyRunStatusForRules>(
  input: PartyRunProjectionInput<TPartyRun>,
): TPartyRun {
  const resolved = input.events.find((event) => event.eventType === "party_join_request_resolved");
  if (!resolved || resolved.eventType !== "party_join_request_resolved") {
    throw new Error("party_join_request_resolved_event_missing");
  }
  const partyRun = input.projection.partyRuns[resolved.payload.partyRunId];
  if (!partyRun) throw new Error("party_run_projection_failed");
  return partyRun;
}

export function partyRunSettledPayload(input: PartyRunSettledPayloadInput): PartyRunSettledPayload {
  return {
    partyRunId: input.partyRunId,
    regionId: input.regionId,
    totalScore: input.totalScore,
    memberResults: input.memberResults,
    traceId: input.traceId,
    newsId: input.newsId,
    settledAt: input.settledAt,
  };
}

export function partyRunMemberInfluencePayload(
  input: PartyRunMemberInfluencePayloadInput,
): RegionInfluenceChangedPayload {
  const influenceDelta = partyMemberInfluenceDelta(input.member);
  return {
    influenceId: input.influenceId,
    regionId: input.regionId,
    agentId: input.member.agentId,
    explorerId: input.member.explorerId,
    influenceDelta,
    influenceScoreAfter: input.previousInfluenceScore + influenceDelta,
    reason: `party_run_settlement:${input.partyRunId}`,
    sourceEventId: input.sourceEventId,
    sourceEventType: "party_run_settled",
    sourceAggregateId: input.partyRunId,
    changedAt: input.changedAt,
  };
}

export function partyRunMemberRewardGrantPayload(
  input: PartyRunMemberRewardGrantPayloadInput,
): ResourceGrantedPayload {
  return {
    resourceId: input.member.reward.resourceId,
    amount: input.member.reward.amount,
    reason: input.member.reward.reason,
    balanceAfter: input.balanceBefore + input.member.reward.amount,
  };
}

export function partyRunTracePayload(input: PartyRunTracePayloadInput): TraceCreatedPayload {
  return {
    traceId: input.traceId,
    regionId: input.regionId,
    title: `${input.partyTitle}结算`,
    summary: `${input.partyTitle} 完成小队行动，总分 ${input.totalScore}，成员 ${input.memberResults.length} 名。`,
    sourceEventType: "party_run_settled",
    sourceEventIds: input.sourceEventIds,
    sourceAggregateId: input.partyRunId,
    relatedInfluenceIds: input.relatedInfluenceIds,
    participantAgentIds: uniqueValues(input.memberResults.map((member) => member.agentId)),
    participantExplorerIds: uniqueValues(input.memberResults.map((member) => member.explorerId)),
    scoutAgentIds: uniqueValues(input.memberResults
      .filter((member) => member.participantRole === "scout")
      .map((member) => member.agentId)),
    parentTraceId: input.parentTraceId,
    createdAt: input.createdAt,
  };
}

export function planPartyRunSettlementEvents(input: PartyRunSettlementEventsInput): readonly EpochEvent[] {
  const settledPayload = partyRunSettledPayload({
    partyRunId: input.partyRunId,
    regionId: input.regionId,
    totalScore: input.totalScore,
    memberResults: input.memberResults,
    traceId: input.traceId,
    newsId: input.newsId,
    settledAt: input.settledAt,
  });
  const settled = input.makeEvent("party_run_settled", input.partyRunId, settledPayload, {
    aggregateType: "party_run",
    agentId: input.leaderAgentId,
  });
  const rewardEvents = input.memberResults.map((member) =>
    resourceGrantedEvent(input.makeEvent, member.agentId, partyRunMemberRewardGrantPayload({
      member,
      balanceBefore: input.rewardBalanceBefore(member.agentId, member.reward.resourceId),
    })));
  const influenceIds: string[] = [];
  const influenceEvents = input.memberResults.map((member) => {
    const influenceId = input.idFactory("region_influence", `${input.regionId}:${input.partyRunId}:${member.agentId}:party_run`);
    influenceIds.push(influenceId);
    const influencePayload = partyRunMemberInfluencePayload({
      influenceId,
      regionId: input.regionId,
      partyRunId: input.partyRunId,
      member,
      previousInfluenceScore: input.previousInfluenceScore(member.agentId),
      sourceEventId: settled.eventId,
      changedAt: input.settledAt,
    });
    return regionInfluenceChangedEvent(input.makeEvent, input.regionId, influencePayload, member.agentId);
  });
  const tracePayload = partyRunTracePayload({
    traceId: input.traceId,
    regionId: input.regionId,
    partyRunId: input.partyRunId,
    partyTitle: input.partyTitle,
    totalScore: input.totalScore,
    memberResults: input.memberResults,
    sourceEventIds: [settled.eventId, ...influenceEvents.map((event) => event.eventId)],
    relatedInfluenceIds: influenceIds,
    parentTraceId: input.parentTraceId,
    createdAt: input.settledAt,
  });
  const traceCreated = traceCreatedEvent(input.makeEvent, input.traceId, tracePayload, input.leaderAgentId);
  const newsPayload = regionNewsGeneratedPayload({
    newsId: input.newsId,
    regionId: input.regionId,
    headline: `${input.partyTitle}完成小队行动`,
    body: `${input.partyMemberCount} 名成员完成「${input.partyObjective}」，服务器结算总分 ${input.totalScore}。`,
    legendDelta: partyNewsLegendDelta(input.totalScore, input.memberResults),
    sourceEventIds: [settled.eventId, traceCreated.eventId],
  });
  const news = input.makeEvent("region_news_generated", input.regionId, newsPayload, {
    aggregateType: "region",
    agentId: input.leaderAgentId,
  });
  return [settled, ...rewardEvents, ...influenceEvents, traceCreated, news];
}

export function raidSeasonStandingPowerBonus(standing: { readonly score: number } | undefined): number {
  if (!standing) return 0;
  return Math.min(
    RAID_SEASON_STANDING_POWER_BONUS_MAX,
    Math.floor(standing.score / RAID_SEASON_STANDING_POWER_BONUS_DIVISOR),
  );
}

export function raidRegionalHeatScoreDelta(raid: { readonly reward: EpochServerReward }): number {
  return 1 + (raid.reward.reason === "raid_repeat_reward_decayed" ? 1 : 0);
}

export function latestRaidPairResolvedAt(
  projection: RaidResultProjectionForRules,
  regionId: string,
  attackerAgentId: string,
  defenderAgentId: string,
): string | undefined {
  const raidIds = projection.raidIdsByRegion[regionId] || [];
  for (let index = raidIds.length - 1; index >= 0; index -= 1) {
    const raid = projection.raidResults[raidIds[index]];
    if (!raid) continue;
    const sameDirection = raid.attackerAgentId === attackerAgentId && raid.defenderAgentId === defenderAgentId;
    const reverseDirection = raid.attackerAgentId === defenderAgentId && raid.defenderAgentId === attackerAgentId;
    if (sameDirection || reverseDirection) return raid.resolvedAt;
  }
  return undefined;
}

export function raidPairResolvedCountSince(
  projection: RaidResultProjectionForRules,
  regionId: string,
  attackerAgentId: string,
  defenderAgentId: string,
  sinceIso: string,
): number {
  const sinceMs = Date.parse(sinceIso);
  return (projection.raidIdsByRegion[regionId] || [])
    .map((raidId) => projection.raidResults[raidId])
    .filter((raid): raid is RaidResultForRules => Boolean(raid))
    .filter((raid) => {
      const sameDirection = raid.attackerAgentId === attackerAgentId && raid.defenderAgentId === defenderAgentId;
      const reverseDirection = raid.attackerAgentId === defenderAgentId && raid.defenderAgentId === attackerAgentId;
      return (sameDirection || reverseDirection) && Date.parse(raid.resolvedAt) >= sinceMs;
    }).length;
}

export function regionRaidHeatScoreSince(
  projection: RaidResultProjectionForRules,
  regionId: string,
  sinceIso: string,
): number {
  const sinceMs = Date.parse(sinceIso);
  return (projection.raidIdsByRegion[regionId] || [])
    .map((raidId) => projection.raidResults[raidId])
    .filter((raid): raid is RaidResultForRules => Boolean(raid))
    .filter((raid) => Date.parse(raid.resolvedAt) >= sinceMs)
    .reduce((score, raid) => score + raidRegionalHeatScoreDelta(raid), 0);
}

export function raidBattleSettlement(input: RaidBattleSettlementInput): RaidBattleSettlement {
  const attackerPower = (input.staminaSpent * 2)
    + (input.crossFactionStandingBattle ? raidSeasonStandingPowerBonus(input.attackerStanding) : 0);
  const defenderPower = (input.defenderFocus * 3)
    + input.defenderLegend
    + (input.crossFactionStandingBattle ? raidSeasonStandingPowerBonus(input.defenderStanding) : 0);
  const outcome: RaidOutcome = attackerPower > defenderPower ? "attacker_won" : "defender_won";
  const rewardAmount = input.recentPairRaidCount > 0 || input.regionHeatRewardDecayed ? 0 : 1;
  return {
    attackerPower,
    defenderPower,
    outcome,
    reward: {
      resourceId: "legend",
      amount: rewardAmount,
      reason: rewardAmount > 0
        ? outcome === "attacker_won" ? "raid_attack_success" : "raid_defense_success"
        : input.recentPairRaidCount > 0 ? "raid_repeat_reward_decayed" : "raid_region_heat_reward_decayed",
    },
  };
}

export function raidAttackStaminaSpendPayload(input: RaidAttackStaminaSpendPayloadInput): ResourceSpentPayload {
  return {
    resourceId: "stamina",
    amount: input.staminaSpent,
    reason: `raid_attack:${input.raidId}`,
    balanceAfter: input.attackerStaminaBefore - input.staminaSpent,
  };
}

export function raidRewardGrantPayload(input: RaidRewardGrantPayloadInput): ResourceGrantedPayload {
  return {
    resourceId: input.reward.resourceId,
    amount: input.reward.amount,
    reason: input.reward.reason,
    balanceAfter: input.winnerRewardBalanceBefore + input.reward.amount,
  };
}

export function raidResolvedPayload(input: RaidResolvedPayloadInput): RaidResolvedPayload {
  return {
    raidId: input.raidId,
    regionId: input.regionId,
    attackerAgentId: input.attackerAgentId,
    attackerExplorerId: input.attackerExplorerId,
    defenderAgentId: input.defenderAgentId,
    defenderExplorerId: input.defenderExplorerId,
    staminaSpent: input.staminaSpent,
    attackerPower: input.attackerPower,
    defenderPower: input.defenderPower,
    outcome: input.outcome,
    reward: input.reward,
    resolvedAt: input.resolvedAt,
  };
}

export function raidSettlementInfluencePayload(
  input: RaidSettlementInfluencePayloadInput,
): RegionInfluenceChangedPayload {
  const influenceDelta = input.reward.amount * 8;
  return {
    influenceId: input.influenceId,
    regionId: input.regionId,
    agentId: input.winnerAgentId,
    explorerId: input.winnerExplorerId,
    influenceDelta,
    influenceScoreAfter: input.previousInfluenceScore + influenceDelta,
    reason: `raid_settlement:${input.raidId}`,
    sourceEventId: input.sourceEventId,
    sourceEventType: "raid_resolved",
    sourceAggregateId: input.raidId,
    changedAt: input.changedAt,
  };
}

export function raidSettlementTracePayload(input: RaidSettlementTracePayloadInput): TraceCreatedPayload {
  return {
    traceId: input.traceId,
    regionId: input.regionId,
    title: `突袭结算 ${input.raidId}`,
    summary: `${input.winnerAgentId} 在突袭中胜出，结果为 ${input.outcome}。`,
    sourceEventType: "raid_resolved",
    sourceEventIds: input.sourceEventIds,
    sourceAggregateId: input.raidId,
    relatedInfluenceIds: input.relatedInfluenceIds,
    participantAgentIds: uniqueValues([input.attackerAgentId, input.defenderAgentId]),
    participantExplorerIds: uniqueValues([input.attackerExplorerId, input.defenderExplorerId]),
    parentTraceId: input.parentTraceId,
    createdAt: input.createdAt,
  };
}

export function retaliationOpportunityCreatedPayload(
  input: RetaliationOpportunityCreatedPayloadInput,
): RetaliationOpportunityCreatedPayload {
  return {
    retaliationId: input.retaliationId,
    regionId: input.regionId,
    sourceRaidId: input.sourceRaidId,
    sourceTraceId: input.sourceTraceId,
    opportunityAgentId: input.opportunityAgentId,
    opportunityExplorerId: input.opportunityExplorerId,
    targetAgentId: input.targetAgentId,
    targetExplorerId: input.targetExplorerId,
    status: "open",
    reason: input.reason,
    sourceEventIds: input.sourceEventIds,
    createdAt: input.createdAt,
  };
}

export function retaliationBattleSettlement(input: RetaliationBattleSettlementInput): RetaliationBattleSettlement {
  const retaliatorPower = (input.staminaSpent * 2) + input.retaliatorLegend;
  const targetPower = (input.targetFocus * 3) + input.targetLegend;
  const outcome: RetaliationOutcome = retaliatorPower > targetPower ? "retaliator_won" : "target_held";
  return {
    retaliatorPower,
    targetPower,
    outcome,
    reward: {
      resourceId: "legend",
      amount: 1,
      reason: outcome === "retaliator_won" ? "retaliation_success" : "retaliation_defended",
    },
  };
}

export function retaliationStaminaSpendPayload(input: RetaliationStaminaSpendPayloadInput): ResourceSpentPayload {
  return {
    resourceId: "stamina",
    amount: input.staminaSpent,
    reason: `retaliation:${input.retaliationId}`,
    balanceAfter: input.retaliatorStaminaBefore - input.staminaSpent,
  };
}

export function retaliationRewardGrantPayload(input: RetaliationRewardGrantPayloadInput): ResourceGrantedPayload {
  return {
    resourceId: input.reward.resourceId,
    amount: input.reward.amount,
    reason: input.reward.reason,
    balanceAfter: input.winnerRewardBalanceBefore + input.reward.amount,
  };
}

export function retaliationResolvedPayload(input: RetaliationResolvedPayloadInput): RetaliationResolvedPayload {
  return {
    retaliationId: input.retaliationId,
    regionId: input.regionId,
    sourceRaidId: input.sourceRaidId,
    sourceTraceId: input.sourceTraceId,
    opportunityAgentId: input.opportunityAgentId,
    opportunityExplorerId: input.opportunityExplorerId,
    targetAgentId: input.targetAgentId,
    targetExplorerId: input.targetExplorerId,
    staminaSpent: input.staminaSpent,
    retaliatorPower: input.retaliatorPower,
    targetPower: input.targetPower,
    outcome: input.outcome,
    winnerAgentId: input.winnerAgentId,
    winnerExplorerId: input.winnerExplorerId,
    reward: input.reward,
    resolvedAt: input.resolvedAt,
  };
}

export function retaliationSettlementInfluencePayload(
  input: RetaliationSettlementInfluencePayloadInput,
): RegionInfluenceChangedPayload {
  const influenceDelta = input.reward.amount * 6;
  return {
    influenceId: input.influenceId,
    regionId: input.regionId,
    agentId: input.winnerAgentId,
    explorerId: input.winnerExplorerId,
    influenceDelta,
    influenceScoreAfter: input.previousInfluenceScore + influenceDelta,
    reason: `retaliation_settlement:${input.retaliationId}`,
    sourceEventId: input.sourceEventId,
    sourceEventType: "retaliation_resolved",
    sourceAggregateId: input.retaliationId,
    changedAt: input.changedAt,
  };
}

export function retaliationSettlementTracePayload(input: RetaliationSettlementTracePayloadInput): TraceCreatedPayload {
  return {
    traceId: input.traceId,
    regionId: input.regionId,
    title: `复仇结算 ${input.retaliationId}`,
    summary: `${input.winnerAgentId} 在复仇中胜出，结果为 ${input.outcome}。`,
    sourceEventType: "retaliation_resolved",
    sourceEventIds: input.sourceEventIds,
    sourceAggregateId: input.retaliationId,
    relatedInfluenceIds: input.relatedInfluenceIds,
    participantAgentIds: uniqueValues([input.opportunityAgentId, input.targetAgentId]),
    participantExplorerIds: uniqueValues([input.opportunityExplorerId, input.targetExplorerId]),
    parentTraceId: input.parentTraceId,
    createdAt: input.createdAt,
  };
}

export function planRaidResolutionEvents(input: RaidResolutionEventsInput): readonly EpochEvent[] {
  const winnerAgentId = input.outcome === "attacker_won" ? input.attackerAgentId : input.defenderAgentId;
  const winnerExplorerId = input.outcome === "attacker_won" ? input.attackerExplorerId : input.defenderExplorerId;
  const loserAgentId = input.outcome === "attacker_won" ? input.defenderAgentId : input.attackerAgentId;
  const loserExplorerId = input.outcome === "attacker_won" ? input.defenderExplorerId : input.attackerExplorerId;
  const staminaSpentEvent = resourceSpentEvent(input.makeEvent, input.attackerAgentId, raidAttackStaminaSpendPayload({
    raidId: input.raidId,
    staminaSpent: input.staminaSpent,
    attackerStaminaBefore: input.attackerStaminaBefore,
  }));
  const rewardEvents: EpochEvent[] = [];
  if (input.reward.amount > 0) {
    if (typeof input.winnerRewardBalanceBefore !== "number") {
      throw new Error("raid_reward_balance_before_missing");
    }
    rewardEvents.push(resourceGrantedEvent(input.makeEvent, winnerAgentId, raidRewardGrantPayload({
      reward: input.reward,
      winnerRewardBalanceBefore: input.winnerRewardBalanceBefore,
    })));
  }
  const resolvedPayload = raidResolvedPayload(input);
  const raidResolved = input.makeEvent("raid_resolved", input.raidId, resolvedPayload, {
    aggregateType: "raid",
    agentId: input.attackerAgentId,
  });
  const influenceEvents: EpochEvent[] = [];
  const relatedInfluenceIds: string[] = [];
  if (input.reward.amount > 0) {
    if (!input.influenceId || typeof input.previousInfluenceScore !== "number") {
      throw new Error("raid_influence_input_missing");
    }
    const influencePayload = raidSettlementInfluencePayload({
      influenceId: input.influenceId,
      raidId: input.raidId,
      regionId: input.regionId,
      winnerAgentId,
      winnerExplorerId,
      previousInfluenceScore: input.previousInfluenceScore,
      reward: input.reward,
      sourceEventId: raidResolved.eventId,
      changedAt: input.resolvedAt,
    });
    influenceEvents.push(regionInfluenceChangedEvent(input.makeEvent, input.regionId, influencePayload, winnerAgentId));
    relatedInfluenceIds.push(input.influenceId);
  }
  const tracePayload = raidSettlementTracePayload({
    traceId: input.traceId,
    raidId: input.raidId,
    regionId: input.regionId,
    winnerAgentId,
    outcome: input.outcome,
    sourceEventIds: [raidResolved.eventId, ...influenceEvents.map((event) => event.eventId)],
    relatedInfluenceIds,
    attackerAgentId: input.attackerAgentId,
    attackerExplorerId: input.attackerExplorerId,
    defenderAgentId: input.defenderAgentId,
    defenderExplorerId: input.defenderExplorerId,
    parentTraceId: input.parentTraceId,
    createdAt: input.resolvedAt,
  });
  const traceCreated = traceCreatedEvent(input.makeEvent, input.traceId, tracePayload, winnerAgentId);
  const retaliationPayload = retaliationOpportunityCreatedPayload({
    retaliationId: input.retaliationId,
    regionId: input.regionId,
    sourceRaidId: input.raidId,
    sourceTraceId: input.traceId,
    opportunityAgentId: loserAgentId,
    opportunityExplorerId: loserExplorerId,
    targetAgentId: winnerAgentId,
    targetExplorerId: winnerExplorerId,
    reason: input.outcome === "attacker_won" ? "raid_defender_retaliation" : "raid_attacker_counter_retaliation",
    sourceEventIds: [raidResolved.eventId, ...influenceEvents.map((event) => event.eventId), traceCreated.eventId],
    createdAt: input.resolvedAt,
  });
  const retaliationCreated = input.makeEvent("retaliation_opportunity_created", input.retaliationId, retaliationPayload, {
    aggregateType: "retaliation",
    agentId: loserAgentId,
  });
  return [
    staminaSpentEvent,
    ...rewardEvents,
    raidResolved,
    ...influenceEvents,
    traceCreated,
    retaliationCreated,
  ];
}

export function projectRaidResolution<TRaidResult extends RaidResultForRules>(
  input: RaidResolutionProjectionInput<TRaidResult>,
): TRaidResult {
  const resolved = input.events.find((event) => event.eventType === "raid_resolved");
  if (!resolved || resolved.eventType !== "raid_resolved") throw new Error("raid_resolved_event_missing");
  const raidResult = input.projection.raidResults[resolved.payload.raidId];
  if (!raidResult) throw new Error("raid_projection_failed");
  return raidResult;
}

export function planRetaliationResolutionEvents(input: RetaliationResolutionEventsInput): readonly EpochEvent[] {
  const staminaSpentEvent = resourceSpentEvent(input.makeEvent, input.opportunityAgentId, retaliationStaminaSpendPayload({
    retaliationId: input.retaliationId,
    staminaSpent: input.staminaSpent,
    retaliatorStaminaBefore: input.retaliatorStaminaBefore,
  }));
  const rewardEvent = resourceGrantedEvent(input.makeEvent, input.winnerAgentId, retaliationRewardGrantPayload({
    reward: input.reward,
    winnerRewardBalanceBefore: input.winnerRewardBalanceBefore,
  }));
  const resolvedPayload = retaliationResolvedPayload(input);
  const retaliationResolved = input.makeEvent("retaliation_resolved", input.retaliationId, resolvedPayload, {
    aggregateType: "retaliation",
    agentId: input.opportunityAgentId,
  });
  const influencePayload = retaliationSettlementInfluencePayload({
    influenceId: input.influenceId,
    retaliationId: input.retaliationId,
    regionId: input.regionId,
    winnerAgentId: input.winnerAgentId,
    winnerExplorerId: input.winnerExplorerId,
    previousInfluenceScore: input.previousInfluenceScore,
    reward: input.reward,
    sourceEventId: retaliationResolved.eventId,
    changedAt: input.resolvedAt,
  });
  const influenceChanged = regionInfluenceChangedEvent(
    input.makeEvent,
    input.regionId,
    influencePayload,
    input.winnerAgentId,
  );
  const tracePayload = retaliationSettlementTracePayload({
    traceId: input.traceId,
    retaliationId: input.retaliationId,
    regionId: input.regionId,
    winnerAgentId: input.winnerAgentId,
    outcome: input.outcome,
    sourceEventIds: [retaliationResolved.eventId, influenceChanged.eventId],
    relatedInfluenceIds: [input.influenceId],
    opportunityAgentId: input.opportunityAgentId,
    opportunityExplorerId: input.opportunityExplorerId,
    targetAgentId: input.targetAgentId,
    targetExplorerId: input.targetExplorerId,
    parentTraceId: input.parentTraceId,
    createdAt: input.resolvedAt,
  });
  const traceCreated = traceCreatedEvent(input.makeEvent, input.traceId, tracePayload, input.winnerAgentId);
  return [staminaSpentEvent, rewardEvent, retaliationResolved, influenceChanged, traceCreated];
}

export function projectRetaliationResolution<
  TRetaliationOpportunity extends RetaliationOpportunityStatusForRules,
>(
  input: RetaliationResolutionProjectionInput<TRetaliationOpportunity>,
): TRetaliationOpportunity {
  const resolved = input.events.find((event) => event.eventType === "retaliation_resolved");
  if (!resolved || resolved.eventType !== "retaliation_resolved") {
    throw new Error("retaliation_resolved_event_missing");
  }
  const retaliation = input.projection.retaliationOpportunities[resolved.payload.retaliationId];
  if (!retaliation) throw new Error("retaliation_projection_failed");
  return retaliation;
}

function uniqueValues(values: readonly string[]): string[] {
  return values.filter((value, index) => value && values.indexOf(value) === index);
}
