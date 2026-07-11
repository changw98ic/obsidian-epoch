import { type EpochNpcCandidate, type EpochProjection } from "./gameCore.ts";

export function npcCandidatesView(
  projection: EpochProjection,
  input: { regionId?: string; agentId?: string; reviewLevel?: string; limit?: number } = {},
): readonly EpochNpcCandidate[] {
  const candidateIds = input.agentId
    ? projection.npcCandidateIdsByAgent[input.agentId] || []
    : input.regionId
      ? projection.npcCandidateIdsByRegion[input.regionId] || []
      : Object.keys(projection.npcCandidates);
  return candidateIds
    .map((candidateId) => projection.npcCandidates[candidateId])
    .filter(Boolean)
    .filter((candidate) => !input.regionId || candidate.regionId === input.regionId)
    .filter((candidate) => !input.reviewLevel || candidate.reviewLevel === input.reviewLevel)
    .sort((left, right) => right.submittedAt.localeCompare(left.submittedAt) || left.candidateId.localeCompare(right.candidateId))
    .slice(0, input.limit || candidateIds.length);
}

export function npcCandidateSourceEventIds(projection: EpochProjection, candidate: EpochNpcCandidate): readonly string[] {
  const eventIds = new Set<string>();
  if (candidate.sourceEventId) eventIds.add(candidate.sourceEventId);
  for (const event of projection.events) {
    if (
      (event.eventType === "npc_candidate_submitted" || event.eventType === "npc_candidate_reviewed")
      && (event.aggregateId === candidate.candidateId || event.payload.candidateId === candidate.candidateId)
    ) {
      eventIds.add(event.eventId);
    }
    if (
      event.eventType === "npc_canonicalized"
      && candidate.canonicalNpcId
      && event.aggregateId === candidate.canonicalNpcId
    ) {
      eventIds.add(event.eventId);
      if (event.payload.sourceEventId) eventIds.add(event.payload.sourceEventId);
    }
  }
  return [...eventIds];
}
