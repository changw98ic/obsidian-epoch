import type {
  EpochCommandContext,
  EpochClock,
  EpochIdFactory,
  EpochResourceId,
} from "./protocol.ts";
import type { EpochEvent, OrganizationTreasuryChangedPayload } from "./events.ts";
import {
  assertNonEmptyString,
  assertPositiveInteger,
  assertResourceId,
  normalizeTrustClass,
  serverIsoTime,
  stableKey,
} from "./protocol.ts";
import { eventFactory } from "./eventFactory.ts";
import {
  requireActiveIdentity,
} from "./identityProjectionRules.ts";
import {
  assertIdentityOwner,
} from "./identityAuthorizationRules.ts";
import { copyBalance, currentBalance } from "./resourceRules.ts";
import {
  activeAgentOrganizationMembership,
  activeOrganizationMembershipForExplorer,
  assertOrganizationBudgetResolution,
  assertOrganizationMembershipRole,
  assertOrganizationMembershipStatus,
  currentOrganizationTreasuryBalance,
  isOrganizationGovernanceRole,
  organizationBudgetApprovalThreshold,
  organizationBudgetDecisionStillPending,
  organizationBudgetRejectionThreshold,
  organizationBudgetRequiresVoteRecord,
  planOrganizationBudgetProposedEvents,
  planOrganizationBudgetResolutionEvents,
  planOrganizationCreatedEvents,
  planOrganizationMembershipChangedEvents,
  planOrganizationPoliticsTickEvents,
  planOrganizationTreasuryContributionEvents,
  planOrganizationUpgradePurchaseEvents,
  projectOrganizationPoliticsTickResult,
  requireOrganizationUpgradeCatalogEntry,
  selectOrganizationPoliticsTickTargets,
  type EpochOrganizationMembershipStatus,
  type EpochOrganizationUpgradeKey,
} from "./organizationTreasuryRules.ts";
import { addRegionActivity } from "./regionActivityRules.ts";
import type {
  EpochOrganization,
  EpochOrganizationBudget,
  EpochOrganizationMemberType,
  EpochOrganizationMembership,
  EpochOrganizationPoliticsRecord,
  EpochOrganizationUpgrade,
  MutableProjection,
  TickOrganizationPoliticsInput,
  TickOrganizationPoliticsResult,
  CreateOrganizationInput,
  UpdateOrganizationMembershipInput,
  ContributeOrganizationTreasuryInput,
  ProposeOrganizationBudgetInput,
  ResolveOrganizationBudgetInput,
  PurchaseOrganizationUpgradeInput,
} from "./gameCore.ts";
import type {
  EpochCommandResult,
  EpochProjection,
} from "./gameCore.ts";

export interface GameCoreOrganizationContext {
  readonly projection: () => EpochProjection;
  readonly commit: <T>(events: readonly EpochEvent[], value: T) => EpochCommandResult<T>;
  readonly applyEvents: (projection: EpochProjection, events: readonly EpochEvent[]) => EpochProjection;
  readonly clock: EpochClock;
  readonly idFactory: EpochIdFactory;
}

function requireServerTrust(context: EpochCommandContext, errorCode: string) {
  const trustClass = normalizeTrustClass(context.trustClass);
  if (trustClass === "untrusted_client") throw new Error(errorCode);
  return trustClass;
}

export function createOrganizationCommands(ctx: GameCoreOrganizationContext) {
  function tickOrganizationPolitics(
    input: TickOrganizationPoliticsInput,
    context: EpochCommandContext,
  ): EpochCommandResult<TickOrganizationPoliticsResult> {
    const trustClass = requireServerTrust(context, "organization_politics_tick_requires_server_trust");
    const current = ctx.projection();
    const selectedOrganizations = selectOrganizationPoliticsTickTargets(current.organizations, input);
    const tickedAt = serverIsoTime(ctx.clock);
    const makeEvent = eventFactory(ctx.clock, ctx.idFactory, { ...context, trustClass });
    const nextEvents = planOrganizationPoliticsTickEvents({
      applyEvents: ctx.applyEvents,
      current,
      idFactory: ctx.idFactory,
      makeEvent,
      selectedOrganizations,
      tickedAt,
    });
    const nextProjection = ctx.applyEvents(current, nextEvents);
    return ctx.commit(nextEvents, projectOrganizationPoliticsTickResult({
      tickedAt,
      events: nextEvents,
      projection: nextProjection,
    }));
  }

  function createOrganization(
    input: CreateOrganizationInput,
    context: EpochCommandContext,
  ): EpochCommandResult<EpochOrganization> {
    requireServerTrust(context, "organization_create_operator_required");
    const current = ctx.projection();
    const regionId = assertNonEmptyString(input.regionId, "region_id");
    const displayName = assertNonEmptyString(input.displayName, "organization_name");
    const organizationId = ctx.idFactory("organization", `${regionId}:${stableKey(displayName)}`);
    const existing = current.organizations[organizationId];
    if (existing) return { events: [], value: existing, projection: current };
    const recordedAt = serverIsoTime(ctx.clock);
    const nextEvents = planOrganizationCreatedEvents({
      makeEvent: eventFactory(ctx.clock, ctx.idFactory, context),
      organizationId,
      organizationName: displayName,
      regionId,
      reason: input.reason,
      sourceEventIds: input.sourceEventIds,
      recordedAt,
    });
    const nextProjection = ctx.applyEvents(current, nextEvents);
    return ctx.commit(nextEvents, nextProjection.organizations[organizationId]);
  }

  function updateOrganizationMembership(
    input: UpdateOrganizationMembershipInput,
    context: EpochCommandContext,
  ): EpochCommandResult<EpochOrganizationMembership> {
    const current = ctx.projection();
    const agentId = assertNonEmptyString(input.agentId, "agent_id");
    const identity = requireActiveIdentity(current, agentId);
    const organizationId = assertNonEmptyString(input.organizationId, "organization_id");
    const organization = current.organizations[organizationId];
    if (!organization) throw new Error("organization_not_found");
    const role = assertOrganizationMembershipRole(input.role);
    const status = assertOrganizationMembershipStatus(input.status);
    const membershipId = ctx.idFactory("organization_membership", `${organizationId}:${agentId}`);
    const existing = current.organizationMemberships[membershipId];
    const contextTrustClass = normalizeTrustClass(context.trustClass);
    const actorMembership = activeOrganizationMembershipForExplorer(current, organizationId, context.actorExplorerId);
    const actorCanManageRoles = contextTrustClass === "system_worker"
      || Boolean(actorMembership && isOrganizationGovernanceRole(actorMembership.role));
    if (!actorCanManageRoles) {
      assertIdentityOwner(identity, context, "organization_membership_owner_mismatch");
      const currentRole = existing?.role;
      if (status === "active" && isOrganizationGovernanceRole(role) && !isOrganizationGovernanceRole(currentRole || "")) {
        throw new Error("organization_membership_role_escalation_requires_authority");
      }
    }
    if (existing && existing.role === role && existing.status === status) {
      return { events: [], value: existing, projection: current };
    }
    const recordedAt = serverIsoTime(ctx.clock);
    const nextEvents = planOrganizationMembershipChangedEvents({
      makeEvent: eventFactory(ctx.clock, ctx.idFactory, context),
      membershipId,
      organizationId,
      organizationName: organization.displayName,
      memberType: "agent",
      agentId,
      explorerId: identity.explorerId,
      regionId: organization.regionId,
      role,
      status,
      sourceEventIds: [],
      recordedAt,
    });
    const nextProjection = ctx.applyEvents(current, nextEvents);
    return ctx.commit(nextEvents, nextProjection.organizationMemberships[membershipId]);
  }

  function contributeOrganizationTreasury(
    input: ContributeOrganizationTreasuryInput,
    context: EpochCommandContext,
  ): EpochCommandResult<OrganizationTreasuryChangedPayload> {
    const current = ctx.projection();
    const agentId = assertNonEmptyString(input.agentId, "agent_id");
    const identity = requireActiveIdentity(current, agentId);
    assertIdentityOwner(identity, context, "organization_contribution_owner_mismatch");
    const organizationId = assertNonEmptyString(input.organizationId, "organization_id");
    const organization = current.organizations[organizationId];
    if (!organization) throw new Error("organization_not_found");
    const resourceId = assertResourceId(input.resourceId);
    const amount = assertPositiveInteger(input.amount, "organization_contribution_amount");
    const activeMembership = activeAgentOrganizationMembership(current, organizationId, agentId);
    if (!activeMembership) throw new Error("organization_contribution_membership_required");
    const memberBalanceBefore = currentBalance(current, agentId, resourceId);
    if (memberBalanceBefore < amount) throw new Error("resource_insufficient");
    const treasuryBalanceBefore = currentOrganizationTreasuryBalance(current, organizationId, resourceId);
    const contributedAt = serverIsoTime(ctx.clock);
    const treasuryEventId = ctx.idFactory("organization_politics", `${organizationId}:contribution:${agentId}:${resourceId}:${contributedAt}`);
    const nextEvents = planOrganizationTreasuryContributionEvents({
      makeEvent: eventFactory(ctx.clock, ctx.idFactory, context),
      treasuryEventId,
      organizationId,
      organizationName: organization.displayName,
      regionId: organization.regionId,
      resourceId,
      amount,
      memberBalanceBefore,
      treasuryBalanceBefore,
      contributingAgentId: agentId,
      contributedAt,
    });
    const treasuryChanged = nextEvents.find((
      event,
    ): event is Extract<EpochEvent, { readonly eventType: "organization_treasury_changed" }> =>
      event.eventType === "organization_treasury_changed"
    );
    if (!treasuryChanged) throw new Error("organization_contribution_projection_failed");
    return ctx.commit(nextEvents, treasuryChanged.payload);
  }

  function proposeOrganizationBudget(
    input: ProposeOrganizationBudgetInput,
    context: EpochCommandContext,
  ): EpochCommandResult<EpochOrganizationBudget> {
    const current = ctx.projection();
    const agentId = assertNonEmptyString(input.agentId, "agent_id");
    const identity = requireActiveIdentity(current, agentId);
    assertIdentityOwner(identity, context, "organization_budget_owner_mismatch");
    const organizationId = assertNonEmptyString(input.organizationId, "organization_id");
    const organization = current.organizations[organizationId];
    if (!organization) throw new Error("organization_not_found");
    const activeMembership = activeAgentOrganizationMembership(current, organizationId, agentId);
    if (!activeMembership) throw new Error("organization_budget_membership_required");
    const title = assertNonEmptyString(input.title, "organization_budget_title");
    const description = typeof input.description === "string" && input.description.trim().length > 0
      ? input.description.trim()
      : undefined;
    const resourceId = assertResourceId(input.resourceId);
    const amount = assertPositiveInteger(input.amount, "organization_budget_amount");
    const proposedAt = serverIsoTime(ctx.clock);
    const budgetId = ctx.idFactory("organization_politics", `${organizationId}:budget:${agentId}:${resourceId}:${title}:${proposedAt}`);
    const nextEvents = planOrganizationBudgetProposedEvents({
      makeEvent: eventFactory(ctx.clock, ctx.idFactory, context),
      budgetId,
      organizationId,
      organizationName: organization.displayName,
      regionId: organization.regionId,
      proposedByAgentId: agentId,
      proposedByExplorerId: identity.explorerId,
      title,
      description,
      resourceId,
      amount,
      sourceEventIds: activeMembership.sourceEventIds,
      proposedAt,
    });
    const nextProjection = ctx.applyEvents(current, nextEvents);
    return ctx.commit(nextEvents, nextProjection.organizationBudgets[budgetId]);
  }

  function resolveOrganizationBudget(
    input: ResolveOrganizationBudgetInput,
    context: EpochCommandContext,
  ): EpochCommandResult<EpochOrganizationBudget> {
    const current = ctx.projection();
    const agentId = assertNonEmptyString(input.agentId, "agent_id");
    const identity = requireActiveIdentity(current, agentId);
    assertIdentityOwner(identity, context, "organization_budget_resolver_owner_mismatch");
    const budgetId = assertNonEmptyString(input.budgetId, "organization_budget_id");
    const budget = current.organizationBudgets[budgetId];
    if (!budget) throw new Error("organization_budget_not_found");
    if (budget.status !== "proposed") throw new Error("organization_budget_not_proposed");
    const activeMembership = activeAgentOrganizationMembership(current, budget.organizationId, agentId);
    if (!activeMembership) throw new Error("organization_budget_resolver_membership_required");
    if (identity.explorerId === budget.proposedByExplorerId) throw new Error("organization_budget_self_resolution_not_allowed");
    if (!isOrganizationGovernanceRole(activeMembership.role)) throw new Error("organization_budget_resolver_role_required");
    const resolution = assertOrganizationBudgetResolution(input.resolution);
    const note = typeof input.note === "string" && input.note.trim().length > 0 ? input.note.trim() : undefined;
    const resolvedAt = serverIsoTime(ctx.clock);
    const makeEvent = eventFactory(ctx.clock, ctx.idFactory, context);
    const votes = budget.votes || [];
    const existingVote = votes.find((vote) => vote.voterExplorerId === identity.explorerId);
    if (existingVote) throw new Error("organization_budget_vote_already_recorded");
    const requiresVoteRecord = organizationBudgetRequiresVoteRecord(budget);
    const resolutionStillPending = requiresVoteRecord && organizationBudgetDecisionStillPending(budget, resolution);
    let treasuryBalanceBefore: number | undefined;
    if (resolution === "approved" && !resolutionStillPending) {
      const balanceBefore = currentOrganizationTreasuryBalance(current, budget.organizationId, budget.resourceId);
      if (balanceBefore < budget.amount) throw new Error("organization_treasury_insufficient");
      treasuryBalanceBefore = balanceBefore;
    }

    const nextEvents = planOrganizationBudgetResolutionEvents({
      makeEvent,
      idFactory: ctx.idFactory,
      budget,
      resolution,
      resolvedByAgentId: agentId,
      resolvedByExplorerId: identity.explorerId,
      resolverRole: activeMembership.role,
      note,
      treasuryBalanceBefore,
      resolvedAt,
    });
    const nextProjection = ctx.applyEvents(current, nextEvents);
    return ctx.commit(nextEvents, nextProjection.organizationBudgets[budgetId]);
  }

  function purchaseOrganizationUpgrade(
    input: PurchaseOrganizationUpgradeInput,
    context: EpochCommandContext,
  ): EpochCommandResult<EpochOrganizationUpgrade> {
    const current = ctx.projection();
    const agentId = assertNonEmptyString(input.agentId, "agent_id");
    const identity = requireActiveIdentity(current, agentId);
    assertIdentityOwner(identity, context, "organization_upgrade_owner_mismatch");
    const organizationId = assertNonEmptyString(input.organizationId, "organization_id");
    const organization = current.organizations[organizationId];
    if (!organization) throw new Error("organization_not_found");
    const catalogEntry = requireOrganizationUpgradeCatalogEntry(input.upgradeKey);
    const activeMembership = activeAgentOrganizationMembership(current, organizationId, agentId);
    if (!activeMembership) throw new Error("organization_upgrade_membership_required");
    const existingUpgrade = (current.organizationUpgradeIdsByOrganization[organizationId] || [])
      .map((upgradeId) => current.organizationUpgrades[upgradeId])
      .find((upgrade) => upgrade?.upgradeKey === catalogEntry.upgradeKey);
    if (existingUpgrade) throw new Error("organization_upgrade_already_purchased");
    const balanceBefore = currentOrganizationTreasuryBalance(current, organizationId, catalogEntry.costResourceId);
    if (balanceBefore < catalogEntry.costAmount) throw new Error("organization_treasury_insufficient");

    const purchasedAt = serverIsoTime(ctx.clock);
    const nextEvents = planOrganizationUpgradePurchaseEvents({
      makeEvent: eventFactory(ctx.clock, ctx.idFactory, context),
      idFactory: ctx.idFactory,
      organizationId,
      organizationName: organization.displayName,
      regionId: organization.regionId,
      catalogEntry,
      treasuryBalanceBefore: balanceBefore,
      sourceEventIds: activeMembership.sourceEventIds,
      purchasedByAgentId: agentId,
      purchasedByExplorerId: identity.explorerId,
      purchasedAt,
    });
    const nextProjection = ctx.applyEvents(current, nextEvents);
    const purchased = nextEvents.find((
      event,
    ): event is Extract<EpochEvent, { readonly eventType: "organization_upgrade_purchased" }> =>
      event.eventType === "organization_upgrade_purchased"
    );
    if (!purchased) throw new Error("organization_upgrade_projection_failed");
    return ctx.commit(nextEvents, nextProjection.organizationUpgrades[purchased.payload.upgradeId]);
  }

  return {
    tickOrganizationPolitics,
    createOrganization,
    updateOrganizationMembership,
    contributeOrganizationTreasury,
    proposeOrganizationBudget,
    resolveOrganizationBudget,
    purchaseOrganizationUpgrade,
  };
}

function uniqueValues(values: readonly string[]): string[] {
  return values.filter((value, index) => value && values.indexOf(value) === index);
}

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
        const vote = {
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
    default:
      break;
  }
}
