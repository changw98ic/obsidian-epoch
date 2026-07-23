import {
  type EpochEvent,
  type BountyClaimedPayload,
  type BountyCreatedPayload,
  type ItemTransferredPayload,
  type RegionInfluenceChangedPayload,
  type ResourceGrantedPayload,
  type ResourceSpentPayload,
  type TraceCreatedPayload,
} from "./events.ts";
import type { EpochEventFactory } from "./eventFactory.ts";
import { itemTransferredEvent } from "./inventoryItemLedgerEvents.ts";
import { type EpochResourceId } from "./protocol.ts";
import { regionInfluenceChangedEvent, traceCreatedEvent } from "./regionEventLedgerEvents.ts";
import { resourceGrantedEvent, resourceSpentEvent } from "./resourceLedgerEvents.ts";

export interface BountyForRules {
  readonly bountyId: string;
  readonly regionId: string;
  readonly sponsorAgentId: string;
  readonly sponsorExplorerId: string;
  readonly title: string;
  readonly rewardResourceId: EpochResourceId;
  readonly rewardAmount: number;
  readonly requiredItemKey?: string;
}

export interface BountyStatusForRules {
  readonly status: string;
}

export interface BountyProjectionForRules<TBounty extends BountyStatusForRules = BountyStatusForRules> {
  readonly bounties: Readonly<Record<string, TBounty | undefined>>;
}

export interface BountyCreatedPayloadInput {
  readonly bountyId: string;
  readonly regionId: string;
  readonly sponsorAgentId: string;
  readonly sponsorExplorerId: string;
  readonly title: string;
  readonly description?: string;
  readonly rewardResourceId: EpochResourceId;
  readonly rewardAmount: number;
  readonly requiredItemKey?: string;
  readonly createdAt: string;
}

export interface BountyCreationEventsInput extends BountyCreatedPayloadInput {
  readonly sponsorBalanceBefore: number;
  readonly makeEvent: EpochEventFactory;
}

export interface BountyProjectionInput<TBounty extends BountyStatusForRules> {
  readonly projection: Pick<BountyProjectionForRules<TBounty>, "bounties">;
  readonly events: readonly EpochEvent[];
}

export interface BountyClaimedPayloadInput {
  readonly bountyId: string;
  readonly claimantAgentId: string;
  readonly claimantExplorerId: string;
  readonly transferredItemId?: string;
  readonly evidence: string;
  readonly claimedAt: string;
}

export interface BountyClaimEventsInput {
  readonly bounty: BountyForRules;
  readonly claimantAgentId: string;
  readonly claimantExplorerId: string;
  readonly claimantRewardBalanceBefore: number;
  readonly transferredItemId?: string;
  readonly evidence: string;
  readonly influenceId: string;
  readonly influenceScoreBefore: number;
  readonly traceId: string;
  readonly participantAgentIds: readonly string[];
  readonly participantExplorerIds: readonly string[];
  readonly parentTraceId?: string;
  readonly claimedAt: string;
  readonly makeEvent: EpochEventFactory;
}

export interface BountyFulfillmentItemTransferPayloadInput {
  readonly bounty: BountyForRules;
  readonly itemId: string;
  readonly claimantAgentId: string;
  readonly claimantExplorerId: string;
  readonly transferredAt: string;
}

export interface BountyClaimInfluencePayloadInput {
  readonly influenceId: string;
  readonly bounty: BountyForRules;
  readonly claimantAgentId: string;
  readonly claimantExplorerId: string;
  readonly influenceScoreAfter: number;
  readonly sourceEventId: string;
  readonly claimedAt: string;
}

export interface BountyClaimTracePayloadInput {
  readonly traceId: string;
  readonly bounty: BountyForRules;
  readonly claimantAgentId: string;
  readonly claimedEventId: string;
  readonly influenceEventId: string;
  readonly influenceId: string;
  readonly participantAgentIds: readonly string[];
  readonly participantExplorerIds: readonly string[];
  readonly parentTraceId?: string;
  readonly createdAt: string;
}

export function requireBounty<TBounty extends BountyStatusForRules>(
  projection: BountyProjectionForRules<TBounty>,
  bountyId: string,
): TBounty {
  const bounty = projection.bounties[bountyId];
  if (!bounty) throw new Error("bounty_not_found");
  return bounty;
}

export function requireOpenBounty<TBounty extends BountyStatusForRules>(
  projection: BountyProjectionForRules<TBounty>,
  bountyId: string,
): TBounty {
  const bounty = requireBounty(projection, bountyId);
  if (bounty.status !== "open") throw new Error("bounty_not_open");
  return bounty;
}

export function bountyEscrowSpendPayload(
  rewardResourceId: EpochResourceId,
  rewardAmount: number,
  bountyId: string,
  balanceAfter: number,
  agentId: string,
): ResourceSpentPayload {
  return {
    resourceId: rewardResourceId,
    amount: rewardAmount,
    reason: `bounty_lock:${bountyId}`,
    balanceAfter,
    accountRef: `agent:${agentId}`,
    assetKey: `resource:${rewardResourceId}`,
    unit: "unit",
    quantityMinor: (BigInt(rewardAmount) * 100n).toString(),
  };
}

export function bountyCreatedPayload(input: BountyCreatedPayloadInput): BountyCreatedPayload {
  return {
    bountyId: input.bountyId,
    regionId: input.regionId,
    sponsorAgentId: input.sponsorAgentId,
    sponsorExplorerId: input.sponsorExplorerId,
    title: input.title,
    description: input.description?.trim() || "区域悬赏",
    rewardResourceId: input.rewardResourceId,
    rewardAmount: input.rewardAmount,
    requiredItemKey: input.requiredItemKey,
    createdAt: input.createdAt,
  };
}

export function planBountyCreationEvents(input: BountyCreationEventsInput): readonly EpochEvent[] {
  const locked = resourceSpentEvent(
    input.makeEvent,
    input.sponsorAgentId,
    bountyEscrowSpendPayload(
      input.rewardResourceId,
      input.rewardAmount,
      input.bountyId,
      input.sponsorBalanceBefore - input.rewardAmount,
      input.sponsorAgentId,
    ),
  );
  const created = input.makeEvent("bounty_created", input.bountyId, bountyCreatedPayload({
    bountyId: input.bountyId,
    regionId: input.regionId,
    sponsorAgentId: input.sponsorAgentId,
    sponsorExplorerId: input.sponsorExplorerId,
    title: input.title,
    description: input.description,
    rewardResourceId: input.rewardResourceId,
    rewardAmount: input.rewardAmount,
    requiredItemKey: input.requiredItemKey,
    createdAt: input.createdAt,
  }), {
    aggregateType: "bounty",
    agentId: input.sponsorAgentId,
  });
  return [locked, created];
}

export function projectBountyCreation<TBounty extends BountyStatusForRules>(
  input: BountyProjectionInput<TBounty>,
): TBounty {
  const created = input.events.find((event) => event.eventType === "bounty_created");
  if (!created || created.eventType !== "bounty_created") throw new Error("bounty_created_event_missing");
  const bounty = input.projection.bounties[created.payload.bountyId];
  if (!bounty) throw new Error("bounty_projection_failed");
  return bounty;
}

export function bountyClaimRewardPayload(bounty: BountyForRules, balanceAfter: number, agentId: string): ResourceGrantedPayload {
  return {
    resourceId: bounty.rewardResourceId,
    amount: bounty.rewardAmount,
    reason: `bounty_claim:${bounty.bountyId}`,
    balanceAfter,
    accountRef: `agent:${agentId}`,
    assetKey: `resource:${bounty.rewardResourceId}`,
    unit: "unit",
    quantityMinor: (BigInt(bounty.rewardAmount) * 100n).toString(),
  };
}

export function bountyClaimedPayload(input: BountyClaimedPayloadInput): BountyClaimedPayload {
  return {
    bountyId: input.bountyId,
    claimantAgentId: input.claimantAgentId,
    claimantExplorerId: input.claimantExplorerId,
    transferredItemId: input.transferredItemId,
    evidence: input.evidence,
    claimedAt: input.claimedAt,
  };
}

export function planBountyClaimEvents(input: BountyClaimEventsInput): readonly EpochEvent[] {
  const rewardGranted = resourceGrantedEvent(
    input.makeEvent,
    input.claimantAgentId,
    bountyClaimRewardPayload(
      input.bounty,
      input.claimantRewardBalanceBefore + input.bounty.rewardAmount,
      input.claimantAgentId,
    ),
  );
  const itemTransferred = input.transferredItemId
    ? itemTransferredEvent(
      input.makeEvent,
      input.transferredItemId,
      bountyFulfillmentItemTransferPayload({
        bounty: input.bounty,
        itemId: input.transferredItemId,
        claimantAgentId: input.claimantAgentId,
        claimantExplorerId: input.claimantExplorerId,
        transferredAt: input.claimedAt,
      }),
      input.bounty.sponsorAgentId,
    )
    : undefined;
  const claimed = input.makeEvent("bounty_claimed", input.bounty.bountyId, bountyClaimedPayload({
    bountyId: input.bounty.bountyId,
    claimantAgentId: input.claimantAgentId,
    claimantExplorerId: input.claimantExplorerId,
    transferredItemId: input.transferredItemId,
    evidence: input.evidence,
    claimedAt: input.claimedAt,
  }), {
    aggregateType: "bounty",
    agentId: input.claimantAgentId,
  });
  const influencePayload = bountyClaimInfluencePayload({
    influenceId: input.influenceId,
    bounty: input.bounty,
    claimantAgentId: input.claimantAgentId,
    claimantExplorerId: input.claimantExplorerId,
    influenceScoreAfter: input.influenceScoreBefore + bountyClaimInfluenceDelta(input.bounty),
    sourceEventId: claimed.eventId,
    claimedAt: input.claimedAt,
  });
  const influenceChanged = regionInfluenceChangedEvent(
    input.makeEvent,
    input.bounty.regionId,
    influencePayload,
    input.claimantAgentId,
  );
  const tracePayload = bountyClaimTracePayload({
    traceId: input.traceId,
    bounty: input.bounty,
    claimantAgentId: input.claimantAgentId,
    claimedEventId: claimed.eventId,
    influenceEventId: influenceChanged.eventId,
    influenceId: input.influenceId,
    participantAgentIds: input.participantAgentIds,
    participantExplorerIds: input.participantExplorerIds,
    parentTraceId: input.parentTraceId,
    createdAt: input.claimedAt,
  });
  const traceCreated = traceCreatedEvent(input.makeEvent, input.traceId, tracePayload, input.claimantAgentId);
  return [rewardGranted, itemTransferred, claimed, influenceChanged, traceCreated]
    .filter((event): event is EpochEvent => Boolean(event));
}

export function projectBountyClaim<TBounty extends BountyStatusForRules>(
  input: BountyProjectionInput<TBounty>,
): TBounty {
  const claimed = input.events.find((event) => event.eventType === "bounty_claimed");
  if (!claimed || claimed.eventType !== "bounty_claimed") throw new Error("bounty_claimed_event_missing");
  const bounty = input.projection.bounties[claimed.payload.bountyId];
  if (!bounty) throw new Error("bounty_projection_failed");
  return bounty;
}

export function bountyFulfillmentItemTransferPayload(
  input: BountyFulfillmentItemTransferPayloadInput,
): ItemTransferredPayload {
  return {
    itemId: input.itemId,
    fromAgentId: input.claimantAgentId,
    fromExplorerId: input.claimantExplorerId,
    toAgentId: input.bounty.sponsorAgentId,
    toExplorerId: input.bounty.sponsorExplorerId,
    sourceOrderId: input.bounty.bountyId,
    transferredAt: input.transferredAt,
  };
}

export function bountyClaimInfluenceDelta(bounty: BountyForRules): number {
  return bounty.rewardAmount;
}

export function bountyClaimInfluencePayload(input: BountyClaimInfluencePayloadInput): RegionInfluenceChangedPayload {
  return {
    influenceId: input.influenceId,
    regionId: input.bounty.regionId,
    agentId: input.claimantAgentId,
    explorerId: input.claimantExplorerId,
    influenceDelta: bountyClaimInfluenceDelta(input.bounty),
    influenceScoreAfter: input.influenceScoreAfter,
    reason: `bounty_claim:${input.bounty.bountyId}`,
    sourceEventId: input.sourceEventId,
    sourceEventType: "bounty_claimed",
    sourceAggregateId: input.bounty.bountyId,
    changedAt: input.claimedAt,
  };
}

export function bountyClaimTracePayload(input: BountyClaimTracePayloadInput): TraceCreatedPayload {
  return {
    traceId: input.traceId,
    regionId: input.bounty.regionId,
    title: `${input.bounty.title}完成`,
    summary: `${input.claimantAgentId} 领取了 ${input.bounty.title} 的悬赏。`,
    sourceEventType: "bounty_claimed",
    sourceEventIds: [input.claimedEventId, input.influenceEventId],
    sourceAggregateId: input.bounty.bountyId,
    relatedInfluenceIds: [input.influenceId],
    participantAgentIds: input.participantAgentIds,
    participantExplorerIds: input.participantExplorerIds,
    parentTraceId: input.parentTraceId,
    createdAt: input.createdAt,
  };
}
