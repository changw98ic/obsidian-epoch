import type {
  EpochBounty,
  EpochPartyJoinRequest,
  EpochPartyMember,
  EpochPartyMemberResult,
  EpochPartyRun,
  EpochProjection,
} from "./gameCore.ts";

export function publicPartyRun(partyRun: EpochPartyRun): EpochPartyRun {
  const { inviteTokenHash: _inviteTokenHash, ...publicRun } = partyRun;
  return {
    ...publicRun,
    leaderExplorerId: "private",
    members: partyRun.members.map((member) => ({ ...member, explorerId: "private" })),
    joinRequests: partyRun.joinRequests?.map((request) => ({
      ...request,
      explorerId: "private",
      resolvedByExplorerId: request.resolvedByExplorerId ? "private" : undefined,
    })),
    memberResults: partyRun.memberResults?.map((result) => ({ ...result, explorerId: "private" })),
  };
}

export type EpochPartyMemberView = Omit<EpochPartyMember, "explorerId">;
export type EpochPartyJoinRequestView = Omit<EpochPartyJoinRequest, "explorerId" | "resolvedByExplorerId">;
export type EpochPartyMemberResultView = Omit<EpochPartyMemberResult, "explorerId">;
export type EpochPartyRunView = Omit<
  EpochPartyRun,
  "leaderExplorerId" | "inviteTokenHash" | "members" | "joinRequests" | "memberResults"
> & {
  readonly members: readonly EpochPartyMemberView[];
  readonly joinRequests?: readonly EpochPartyJoinRequestView[];
  readonly memberResults?: readonly EpochPartyMemberResultView[];
  readonly publicPages: {
    readonly partyRun: string;
    readonly audit: string;
    readonly region: string;
    readonly leader: string;
  };
};

function partyRunView(partyRun: EpochPartyRun): EpochPartyRunView {
  const {
    leaderExplorerId: _leaderExplorerId,
    inviteTokenHash: _inviteTokenHash,
    members,
    joinRequests,
    memberResults,
    ...publicRun
  } = partyRun;
  return {
    ...publicRun,
    members: members.map(({ explorerId: _explorerId, ...member }) => member),
    joinRequests: joinRequests?.map(({
      explorerId: _explorerId,
      resolvedByExplorerId: _resolvedByExplorerId,
      ...request
    }) => request),
    memberResults: memberResults?.map(({ explorerId: _explorerId, ...result }) => result),
    publicPages: {
      partyRun: `/epoch/party-run/${encodeURIComponent(partyRun.partyRunId)}`,
      audit: `/epoch/audit?aggregateId=${encodeURIComponent(partyRun.partyRunId)}`,
      region: `/epoch/region/${encodeURIComponent(partyRun.regionId)}`,
      leader: `/epoch/agent/${encodeURIComponent(partyRun.leaderAgentId)}`,
    },
  };
}

export function bountiesView(
  projection: EpochProjection,
  input: { regionId?: string; agentId?: string; status?: string } = {},
): readonly EpochBounty[] {
  const bountyIds = input.regionId
    ? projection.bountyIdsByRegion[input.regionId] || []
    : input.agentId
      ? projection.bountyIdsByAgent[input.agentId] || []
      : Object.keys(projection.bounties);
  return bountyIds
    .map((bountyId) => projection.bounties[bountyId])
    .filter((bounty): bounty is EpochBounty => Boolean(bounty))
    .filter((bounty) => !input.agentId || bounty.sponsorAgentId === input.agentId || bounty.claimantAgentId === input.agentId)
    .filter((bounty) => !input.status || bounty.status === input.status)
    .sort((left, right) => {
      const statusScore = Number(left.status !== "open") - Number(right.status !== "open");
      if (statusScore !== 0) return statusScore;
      return right.createdAt.localeCompare(left.createdAt) || left.bountyId.localeCompare(right.bountyId);
    });
}

export function partyRunsView(
  projection: EpochProjection,
  input: { regionId?: string; agentId?: string; status?: string } = {},
): readonly EpochPartyRunView[] {
  const partyRunIds = input.regionId
    ? projection.partyRunIdsByRegion[input.regionId] || []
    : Object.keys(projection.partyRuns);
  return partyRunIds
    .map((partyRunId) => projection.partyRuns[partyRunId])
    .filter((partyRun): partyRun is EpochPartyRun => Boolean(partyRun))
    .filter((partyRun) => !input.agentId || partyRun.members.some((member) => member.agentId === input.agentId))
    .filter((partyRun) => !input.status || partyRun.status === input.status)
    .sort((left, right) => {
      const statusScore = Number(left.status !== "open") - Number(right.status !== "open");
      if (statusScore !== 0) return statusScore;
      return right.updatedAt.localeCompare(left.updatedAt) || left.partyRunId.localeCompare(right.partyRunId);
    })
    .map(partyRunView);
}
