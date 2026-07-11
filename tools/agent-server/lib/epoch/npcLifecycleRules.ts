import type {
  EpochEvent,
  NpcAssetChangedPayload,
  NpcCareerChangedPayload,
  NpcHealthRecordedPayload,
  NpcHouseholdRecordedPayload,
  NpcLifecycleRecordedPayload,
  NpcLifecycleValue,
  NpcLocationChangedPayload,
  NpcMemoryRecordedPayload,
  NpcRelationshipRecordedPayload,
  OrganizationMembershipChangedPayload,
} from "./events.ts";
import {
  type EpochNpcMemoryImportance,
  type EpochNpcRelationshipKind,
  type EpochIdFactory,
  assertNonEmptyString,
  stableKey,
} from "./protocol.ts";
import type { EpochEventFactory } from "./eventFactory.ts";
import {
  socialHookCreatedPayload,
  socialHookDraftForLifecycle,
} from "./agentInteractionRules.ts";
import {
  normalizeTraits,
  npcCanonicalizedPayload,
} from "./npcCandidateRules.ts";
import { organizationMembershipChangedPayload } from "./organizationTreasuryRules.ts";

export interface NpcLifecycleRecordLike {
  readonly npcId: string;
  readonly displayName: string;
  readonly regionId: string;
  readonly lifecycle: readonly unknown[];
}

export interface LifecycleTickSelectionInput {
  readonly limit?: number;
  readonly regionId?: string;
}

export interface NpcLifecycleRecordedPayloadInput {
  readonly npcId: string;
  readonly occurredAt: string;
  readonly changes: Readonly<Record<string, NpcLifecycleValue>>;
  readonly sourceEventIds?: readonly string[];
}

export interface NpcMemoryRecordedPayloadInput {
  readonly memoryId: string;
  readonly npcId: string;
  readonly regionId: string;
  readonly summary: string;
  readonly importance: EpochNpcMemoryImportance;
  readonly sourceEventIds: readonly string[];
  readonly recordedAt: string;
}

export interface PlanNpcLifecycleRecordEventsInput extends NpcLifecycleRecordedPayloadInput {
  readonly makeEvent: EpochEventFactory;
}

export interface PlanNpcMemoryRecordEventsInput extends NpcMemoryRecordedPayloadInput {
  readonly makeEvent: EpochEventFactory;
}

export interface NpcRelationshipRecordedPayloadInput {
  readonly relationshipId: string;
  readonly sourceNpcId: string;
  readonly targetNpcId: string;
  readonly sourceRegionId: string;
  readonly targetRegionId: string;
  readonly kind: EpochNpcRelationshipKind;
  readonly score: number;
  readonly reason: string;
  readonly sourceEventIds: readonly string[];
  readonly recordedAt: string;
}

export interface NpcHouseholdRecordedPayloadInput {
  readonly householdId: string;
  readonly regionId: string;
  readonly memberNpcIds: readonly string[];
  readonly reason: string;
  readonly sourceEventIds: readonly string[];
  readonly recordedAt: string;
}

export interface NpcCareerChangedPayloadInput {
  readonly careerId: string;
  readonly npcId: string;
  readonly regionId: string;
  readonly title: string;
  readonly status: string;
  readonly organizationId?: string;
  readonly sourceEventIds: readonly string[];
  readonly recordedAt: string;
}

export interface NpcLocationChangedPayloadInput {
  readonly locationId: string;
  readonly npcId: string;
  readonly fromRegionId: string;
  readonly toRegionId: string;
  readonly reason: string;
  readonly sourceEventIds: readonly string[];
  readonly recordedAt: string;
}

export interface NpcAssetChangedPayloadInput {
  readonly assetId: string;
  readonly npcId: string;
  readonly regionId: string;
  readonly assetKey: string;
  readonly delta: number;
  readonly balanceAfter: number;
  readonly reason: string;
  readonly sourceEventIds: readonly string[];
  readonly recordedAt: string;
}

export interface NpcHealthRecordedPayloadInput {
  readonly healthId: string;
  readonly npcId: string;
  readonly regionId: string;
  readonly status: string;
  readonly reason: string;
  readonly sourceEventIds: readonly string[];
  readonly recordedAt: string;
}

export interface LifecycleHouseholdRecordLike {
  readonly householdId: string;
  readonly memberNpcIds: readonly string[];
  readonly sourceEventIds: readonly string[];
}

export interface LifecycleHouseholdNpcLike {
  readonly npcId: string;
  readonly regionId: string;
}

export interface LifecycleHouseholdRecordPayloadInput {
  readonly memberNpcIds: readonly string[];
  readonly householdsById: Readonly<Record<string, LifecycleHouseholdRecordLike | undefined>>;
  readonly householdIdsByNpc: Readonly<Record<string, readonly string[] | undefined>>;
  readonly npcsById: Readonly<Record<string, LifecycleHouseholdNpcLike | undefined>>;
  readonly householdIdFor: (regionId: string, firstMemberNpcId: string) => string;
  readonly reason: string;
  readonly sourceEventIds: readonly string[];
  readonly recordedAt: string;
}

export interface LifecycleOrganizationMembershipRecordLike {
  readonly organizationId: string;
}

export interface LifecycleOrganizationMembershipNpcLike {
  readonly npcId: string;
  readonly regionId: string;
}

export interface LifecycleOrganizationMembershipRecordPayloadInput {
  readonly npc: LifecycleOrganizationMembershipNpcLike;
  readonly role: string;
  readonly membershipsById: Readonly<Record<string, LifecycleOrganizationMembershipRecordLike | undefined>>;
  readonly membershipIdsByNpc: Readonly<Record<string, readonly string[] | undefined>>;
  readonly organizationIdFor: (regionId: string, organizationName: string) => string;
  readonly membershipIdFor: (organizationId: string, npcId: string, role: string) => string;
  readonly sourceEventIds: readonly string[];
  readonly recordedAt: string;
}

export interface LifecycleOrganizationMembershipRecordPayloadPlan {
  readonly organizationId: string;
  readonly payload?: OrganizationMembershipChangedPayload;
}

export interface NpcLifecycleTickNpcLike extends NpcLifecycleRecordLike {
  readonly npcId: string;
  readonly displayName: string;
  readonly regionId: string;
}

export interface NpcLifecycleTickSocialHookLike {
  readonly sourceEventIds: readonly string[];
}

export interface NpcLifecycleTickProjectionLike {
  readonly npcs: Readonly<Record<string, NpcLifecycleTickNpcLike | undefined>>;
  readonly npcIdsByKey: Readonly<Record<string, string | undefined>>;
  readonly npcRelationships: Readonly<Record<string, unknown>>;
  readonly households: Readonly<Record<string, LifecycleHouseholdRecordLike | undefined>>;
  readonly householdIdsByNpc: Readonly<Record<string, readonly string[] | undefined>>;
  readonly organizationMemberships: Readonly<Record<string, LifecycleOrganizationMembershipRecordLike | undefined>>;
  readonly organizationMembershipIdsByNpc: Readonly<Record<string, readonly string[] | undefined>>;
  readonly npcAssetBalancesByNpc: Readonly<Record<string, Readonly<Record<string, number>> | undefined>>;
  readonly socialHooks: Readonly<Record<string, NpcLifecycleTickSocialHookLike | undefined>>;
}

export interface PlanNpcLifecycleTickEventsInput<TProjection extends NpcLifecycleTickProjectionLike> {
  readonly current: TProjection;
  readonly selectedNpcs: readonly NpcLifecycleTickNpcLike[];
  readonly tickedAt: string;
  readonly idFactory: EpochIdFactory;
  readonly makeEvent: EpochEventFactory;
  readonly applyEvents: (projection: TProjection, events: readonly EpochEvent[]) => TProjection;
}

export interface NpcLifecycleTickResultProjectionLike extends NpcLifecycleTickProjectionLike {
  readonly npcMemories: Readonly<Record<string, unknown>>;
  readonly npcCareerRecords: Readonly<Record<string, unknown>>;
  readonly npcLocationRecords: Readonly<Record<string, unknown>>;
  readonly npcAssetStates: Readonly<Record<string, unknown>>;
  readonly npcHealthStates: Readonly<Record<string, unknown>>;
}

type ProjectionRecordValue<TRecord> = TRecord extends Readonly<Record<string, infer TValue>>
  ? NonNullable<TValue>
  : never;

export interface ProjectNpcLifecycleTickResultInput<TProjection extends NpcLifecycleTickResultProjectionLike> {
  readonly tickedAt: string;
  readonly selectedNpcs: readonly Pick<NpcLifecycleTickNpcLike, "npcId">[];
  readonly events: readonly EpochEvent[];
  readonly projection: TProjection;
}

export interface ProjectedNpcLifecycleTickResult<TProjection extends NpcLifecycleTickResultProjectionLike> {
  readonly tickedAt: string;
  readonly updated: readonly ProjectionRecordValue<TProjection["npcs"]>[];
  readonly relationships: readonly ProjectionRecordValue<TProjection["npcRelationships"]>[];
  readonly memories: readonly ProjectionRecordValue<TProjection["npcMemories"]>[];
  readonly households: readonly ProjectionRecordValue<TProjection["households"]>[];
  readonly organizationMemberships: readonly ProjectionRecordValue<TProjection["organizationMemberships"]>[];
  readonly careers: readonly ProjectionRecordValue<TProjection["npcCareerRecords"]>[];
  readonly locations: readonly ProjectionRecordValue<TProjection["npcLocationRecords"]>[];
  readonly assetStates: readonly ProjectionRecordValue<TProjection["npcAssetStates"]>[];
  readonly healthStates: readonly ProjectionRecordValue<TProjection["npcHealthStates"]>[];
  readonly socialHooks: readonly ProjectionRecordValue<TProjection["socialHooks"]>[];
}

export function lifecycleTickLimit(value: number | undefined): number {
  return Math.max(1, Math.min(Number(value || 10), 100));
}

export function selectLifecycleTickNpcs<TNpc extends Pick<NpcLifecycleRecordLike, "npcId" | "regionId">>(
  npcsById: Readonly<Record<string, TNpc>>,
  input: LifecycleTickSelectionInput,
): readonly TNpc[] {
  const limit = lifecycleTickLimit(input.limit);
  const regionId = input.regionId?.trim();
  return Object.values(npcsById)
    .filter((npc) => !regionId || npc.regionId === regionId)
    .sort((left, right) => left.npcId.localeCompare(right.npcId))
    .slice(0, limit);
}

export function lifecycleTickChanges(npc: NpcLifecycleRecordLike): Readonly<Record<string, NpcLifecycleValue>> {
  const suffix = stableKey(npc.npcId).slice(0, 10) || "npc";
  const step = npc.lifecycle.length % 4;
  if (step === 0) {
    return {
      assets_delta: 10_000,
      work_status: "working",
    };
  }
  if (step === 1) {
    return {
      married_to: `partner_${suffix}`,
      relationship_status: "married",
    };
  }
  if (step === 2) {
    return {
      child_id: `child_${suffix}`,
      household_size_delta: 1,
    };
  }
  return {
    health_status: "sick",
    assets_delta: -1_000,
  };
}

export function lifecycleMemorySummary(
  npc: Pick<NpcLifecycleRecordLike, "displayName">,
  changes: Readonly<Record<string, NpcLifecycleValue>>,
): string {
  if (typeof changes.work_status === "string") {
    return `${npc.displayName} 记住了一次区域工作状态变化：${changes.work_status}`;
  }
  if (typeof changes.relationship_status === "string") {
    return `${npc.displayName} 记住了一次家庭关系变化：${changes.relationship_status}`;
  }
  if (typeof changes.child_id === "string") {
    return `${npc.displayName} 记住了新家庭成员 ${changes.child_id}`;
  }
  if (typeof changes.health_status === "string") {
    return `${npc.displayName} 记住了一次健康状态变化：${changes.health_status}`;
  }
  return `${npc.displayName} 记住了一次服务器生命周期变化`;
}

function regionDisplayName(regionId: string): string {
  const withoutPrefix = regionId.replace(/^region_/, "");
  return withoutPrefix
    .split("_")
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ") || regionId;
}

export function lifecycleOrganizationName(regionId: string): string {
  return `${regionDisplayName(regionId)} Civic Ledger`;
}

export function lifecycleMigrationRegionId(npc: Pick<NpcLifecycleRecordLike, "npcId" | "regionId">): string {
  const suffix = stableKey(npc.npcId).slice(0, 8) || "npc";
  return `${npc.regionId}_waystation_${suffix}`;
}

export function normalizeLifecycleChanges(changes: Readonly<Record<string, NpcLifecycleValue>>): Readonly<Record<string, NpcLifecycleValue>> {
  const normalized: Record<string, NpcLifecycleValue> = {};
  for (const [key, value] of Object.entries(changes || {})) {
    const normalizedKey = stableKey(key);
    if (!normalizedKey) continue;
    if (["string", "number", "boolean"].includes(typeof value) || value === null) {
      normalized[normalizedKey] = value;
    }
  }
  if (Object.keys(normalized).length === 0) throw new Error("npc_lifecycle_changes_required");
  return normalized;
}

export function npcLifecycleRecordedPayload(input: NpcLifecycleRecordedPayloadInput): NpcLifecycleRecordedPayload {
  return {
    npcId: input.npcId,
    occurredAt: input.occurredAt,
    changes: normalizeLifecycleChanges(input.changes),
    sourceEventIds: input.sourceEventIds || [],
  };
}

export function planNpcLifecycleRecordEvents(input: PlanNpcLifecycleRecordEventsInput): readonly EpochEvent[] {
  const payload = npcLifecycleRecordedPayload(input);
  return [
    input.makeEvent("npc_lifecycle_recorded", input.npcId, payload, { aggregateType: "npc" }),
  ];
}

export function npcMemoryRecordedPayload(input: NpcMemoryRecordedPayloadInput): NpcMemoryRecordedPayload {
  return {
    memoryId: input.memoryId,
    npcId: input.npcId,
    regionId: input.regionId,
    summary: input.summary,
    importance: input.importance,
    sourceEventIds: input.sourceEventIds,
    recordedAt: input.recordedAt,
  };
}

export function planNpcMemoryRecordEvents(input: PlanNpcMemoryRecordEventsInput): readonly EpochEvent[] {
  const payload = npcMemoryRecordedPayload(input);
  return [
    input.makeEvent("npc_memory_recorded", input.memoryId, payload, { aggregateType: "npc" }),
  ];
}

export function npcRelationshipRecordedPayload(
  input: NpcRelationshipRecordedPayloadInput,
): NpcRelationshipRecordedPayload {
  return {
    relationshipId: input.relationshipId,
    sourceNpcId: input.sourceNpcId,
    targetNpcId: input.targetNpcId,
    sourceRegionId: input.sourceRegionId,
    targetRegionId: input.targetRegionId,
    kind: input.kind,
    score: input.score,
    reason: input.reason,
    sourceEventIds: input.sourceEventIds,
    recordedAt: input.recordedAt,
  };
}

export function npcHouseholdRecordedPayload(input: NpcHouseholdRecordedPayloadInput): NpcHouseholdRecordedPayload {
  return {
    householdId: input.householdId,
    regionId: input.regionId,
    memberNpcIds: input.memberNpcIds,
    reason: input.reason,
    sourceEventIds: input.sourceEventIds,
    recordedAt: input.recordedAt,
  };
}

function uniqueStrings(values: readonly string[]): readonly string[] {
  return values.filter((value, index, allValues) => allValues.indexOf(value) === index);
}

function existingLifecycleHouseholdForMembers(
  householdsById: Readonly<Record<string, LifecycleHouseholdRecordLike | undefined>>,
  householdIdsByNpc: Readonly<Record<string, readonly string[] | undefined>>,
  memberNpcIds: readonly string[],
): LifecycleHouseholdRecordLike | undefined {
  const householdIds = memberNpcIds.flatMap((npcId) => householdIdsByNpc[npcId] || []);
  return householdIds
    .map((householdId) => householdsById[householdId])
    .filter((household): household is LifecycleHouseholdRecordLike => Boolean(household))
    .sort((left, right) => right.memberNpcIds.length - left.memberNpcIds.length || left.householdId.localeCompare(right.householdId))[0];
}

export function lifecycleHouseholdRecordPayload(
  input: LifecycleHouseholdRecordPayloadInput,
): NpcHouseholdRecordedPayload | undefined {
  const directMembers = uniqueStrings(
    input.memberNpcIds.map((memberNpcId) => assertNonEmptyString(memberNpcId, "household_member_npc_id")),
  );
  const existingHousehold = existingLifecycleHouseholdForMembers(
    input.householdsById,
    input.householdIdsByNpc,
    directMembers,
  );
  const finalMemberNpcIds = uniqueStrings([...(existingHousehold?.memberNpcIds || []), ...directMembers]);
  if (finalMemberNpcIds.length === 0) throw new Error("household_members_required");

  const firstMember = input.npcsById[finalMemberNpcIds[0]];
  if (!firstMember) throw new Error("npc_not_found");
  for (const memberNpcId of finalMemberNpcIds) {
    if (!input.npcsById[memberNpcId]) throw new Error("npc_not_found");
  }

  const sameMembers = existingHousehold
    && existingHousehold.memberNpcIds.length === finalMemberNpcIds.length
    && existingHousehold.memberNpcIds.every((memberNpcId) => finalMemberNpcIds.includes(memberNpcId));
  if (sameMembers) return undefined;

  return npcHouseholdRecordedPayload({
    householdId: existingHousehold?.householdId || input.householdIdFor(firstMember.regionId, finalMemberNpcIds[0]),
    regionId: firstMember.regionId,
    memberNpcIds: finalMemberNpcIds,
    reason: input.reason,
    sourceEventIds: uniqueStrings([...(existingHousehold?.sourceEventIds || []), ...input.sourceEventIds]),
    recordedAt: input.recordedAt,
  });
}

export function lifecycleOrganizationMembershipRecordPayload(
  input: LifecycleOrganizationMembershipRecordPayloadInput,
): LifecycleOrganizationMembershipRecordPayloadPlan {
  const organizationName = lifecycleOrganizationName(input.npc.regionId);
  const organizationId = input.organizationIdFor(input.npc.regionId, organizationName);
  const existingMembership = (input.membershipIdsByNpc[input.npc.npcId] || [])
    .map((membershipId) => input.membershipsById[membershipId])
    .find((membership) => membership?.organizationId === organizationId);
  if (existingMembership) {
    return {
      organizationId,
      payload: undefined,
    };
  }

  return {
    organizationId,
    payload: organizationMembershipChangedPayload({
      membershipId: input.membershipIdFor(organizationId, input.npc.npcId, input.role),
      organizationId,
      organizationName,
      npcId: input.npc.npcId,
      regionId: input.npc.regionId,
      role: input.role,
      status: "active",
      sourceEventIds: input.sourceEventIds,
      recordedAt: input.recordedAt,
    }),
  };
}

export function npcCareerChangedPayload(input: NpcCareerChangedPayloadInput): NpcCareerChangedPayload {
  return {
    careerId: input.careerId,
    npcId: input.npcId,
    regionId: input.regionId,
    title: input.title,
    status: input.status,
    organizationId: input.organizationId,
    sourceEventIds: input.sourceEventIds,
    recordedAt: input.recordedAt,
  };
}

export function npcLocationChangedPayload(input: NpcLocationChangedPayloadInput): NpcLocationChangedPayload {
  return {
    locationId: input.locationId,
    npcId: input.npcId,
    fromRegionId: input.fromRegionId,
    toRegionId: input.toRegionId,
    reason: input.reason,
    sourceEventIds: input.sourceEventIds,
    recordedAt: input.recordedAt,
  };
}

export function npcAssetChangedPayload(input: NpcAssetChangedPayloadInput): NpcAssetChangedPayload {
  return {
    assetId: input.assetId,
    npcId: input.npcId,
    regionId: input.regionId,
    assetKey: input.assetKey,
    delta: input.delta,
    balanceAfter: input.balanceAfter,
    reason: input.reason,
    sourceEventIds: input.sourceEventIds,
    recordedAt: input.recordedAt,
  };
}

export function npcHealthRecordedPayload(input: NpcHealthRecordedPayloadInput): NpcHealthRecordedPayload {
  return {
    healthId: input.healthId,
    npcId: input.npcId,
    regionId: input.regionId,
    status: input.status,
    severity: input.status === "sick" ? "minor" : "stable",
    reason: input.reason,
    sourceEventIds: input.sourceEventIds,
    recordedAt: input.recordedAt,
  };
}

export function planNpcLifecycleTickEvents<TProjection extends NpcLifecycleTickProjectionLike>(
  input: PlanNpcLifecycleTickEventsInput<TProjection>,
): readonly EpochEvent[] {
  const { applyEvents, current, idFactory, makeEvent, selectedNpcs, tickedAt } = input;
  const nextEvents: EpochEvent[] = [];

  const ensureNpc = (
    displayName: string,
    regionId: string,
    traits: readonly string[],
    sourceEventId: string,
  ) => {
    const interimProjection = applyEvents(current, nextEvents);
    const npcKey = stableKey(`${regionId}:${displayName}`);
    const existingNpcId = interimProjection.npcIdsByKey[npcKey];
    if (existingNpcId) return existingNpcId;
    const npcId = idFactory("npc", npcKey);
    const payload = npcCanonicalizedPayload({
      npcId,
      npcKey,
      displayName,
      regionId,
      traits: normalizeTraits(traits),
      sourceEventId,
    });
    nextEvents.push(makeEvent("npc_canonicalized", npcId, payload, { aggregateType: "npc" }));
    return npcId;
  };

  const recordNpcRelationship = (
    sourceNpcId: string,
    targetNpcId: string,
    kind: EpochNpcRelationshipKind,
    score: number,
    reason: string,
    sourceEventIds: readonly string[],
  ) => {
    const interimProjection = applyEvents(current, nextEvents);
    const sourceNpc = interimProjection.npcs[sourceNpcId];
    const targetNpc = interimProjection.npcs[targetNpcId];
    if (!sourceNpc || !targetNpc) throw new Error("npc_not_found");
    const relationshipId = idFactory("npc_relationship", `${kind}:${sourceNpcId}:${targetNpcId}`);
    if (interimProjection.npcRelationships[relationshipId]) return;
    const payload = npcRelationshipRecordedPayload({
      relationshipId,
      sourceNpcId,
      targetNpcId,
      sourceRegionId: sourceNpc.regionId,
      targetRegionId: targetNpc.regionId,
      kind,
      score,
      reason,
      sourceEventIds,
      recordedAt: tickedAt,
    });
    nextEvents.push(makeEvent("npc_relationship_recorded", relationshipId, payload, {
      aggregateType: "npc_relationship",
    }));
  };

  const recordWorkplaceRelationships = (
    npcId: string,
    sourceEventIds: readonly string[],
  ) => {
    const interimProjection = applyEvents(current, nextEvents);
    const npc = interimProjection.npcs[npcId];
    if (!npc) throw new Error("npc_not_found");
    const supervisorNpcId = ensureNpc(`${npc.displayName} Supervisor`, npc.regionId, ["superior"], sourceEventIds[0] || tickedAt);
    const friendNpcId = ensureNpc(`${npc.displayName} Friend`, npc.regionId, ["friend"], sourceEventIds[0] || tickedAt);
    const mentorNpcId = ensureNpc(`${npc.displayName} Mentor`, npc.regionId, ["mentor"], sourceEventIds[0] || tickedAt);
    const creditorNpcId = ensureNpc(`${npc.displayName} Creditor`, npc.regionId, ["creditor"], sourceEventIds[0] || tickedAt);
    recordNpcRelationship(npcId, supervisorNpcId, "subordinate", 55, "lifecycle_workplace", sourceEventIds);
    recordNpcRelationship(supervisorNpcId, npcId, "superior", 55, "lifecycle_workplace", sourceEventIds);
    recordNpcRelationship(npcId, friendNpcId, "friend", 45, "lifecycle_work_friend", sourceEventIds);
    recordNpcRelationship(npcId, mentorNpcId, "apprentice", 50, "lifecycle_training", sourceEventIds);
    recordNpcRelationship(mentorNpcId, npcId, "mentor", 50, "lifecycle_training", sourceEventIds);
    recordNpcRelationship(npcId, creditorNpcId, "debtor", -20, "lifecycle_debt_obligation", sourceEventIds);
    recordNpcRelationship(creditorNpcId, npcId, "creditor", 20, "lifecycle_debt_obligation", sourceEventIds);
  };

  const recordRivalRelationship = (
    npcId: string,
    sourceEventIds: readonly string[],
  ) => {
    const interimProjection = applyEvents(current, nextEvents);
    const npc = interimProjection.npcs[npcId];
    if (!npc) throw new Error("npc_not_found");
    const rivalNpcId = ensureNpc(`${npc.displayName} Rival`, npc.regionId, ["rival", "enemy"], sourceEventIds[0] || tickedAt);
    recordNpcRelationship(npcId, rivalNpcId, "enemy", -35, "lifecycle_rivalry", sourceEventIds);
  };

  const recordHousehold = (
    memberNpcIds: readonly string[],
    reason: string,
    sourceEventIds: readonly string[],
  ) => {
    const interimProjection = applyEvents(current, nextEvents);
    const payload = lifecycleHouseholdRecordPayload({
      householdsById: interimProjection.households,
      householdIdsByNpc: interimProjection.householdIdsByNpc,
      npcsById: interimProjection.npcs,
      householdIdFor: (regionId, firstMemberNpcId) => idFactory("household", `${regionId}:${firstMemberNpcId}`),
      memberNpcIds,
      reason,
      sourceEventIds,
      recordedAt: tickedAt,
    });
    if (!payload) return;
    nextEvents.push(makeEvent("npc_household_recorded", payload.householdId, payload, {
      aggregateType: "household",
    }));
  };

  const recordOrganizationMembership = (
    npcId: string,
    role: string,
    sourceEventIds: readonly string[],
  ) => {
    const interimProjection = applyEvents(current, nextEvents);
    const npc = interimProjection.npcs[npcId];
    if (!npc) throw new Error("npc_not_found");
    const plan = lifecycleOrganizationMembershipRecordPayload({
      npc,
      role,
      membershipsById: interimProjection.organizationMemberships,
      membershipIdsByNpc: interimProjection.organizationMembershipIdsByNpc,
      organizationIdFor: (regionId, organizationName) => idFactory("organization", `${regionId}:${organizationName}`),
      membershipIdFor: (organizationId, memberNpcId, memberRole) =>
        idFactory("organization_membership", `${organizationId}:${memberNpcId}:${memberRole}`),
      sourceEventIds,
      recordedAt: tickedAt,
    });
    if (!plan.payload) return plan.organizationId;
    nextEvents.push(makeEvent("organization_membership_changed", plan.payload.membershipId, plan.payload, {
      aggregateType: "organization",
    }));
    return plan.organizationId;
  };

  const recordNpcCareer = (
    npcId: string,
    title: string,
    status: string,
    organizationId: string | undefined,
    sourceEventIds: readonly string[],
  ) => {
    const interimProjection = applyEvents(current, nextEvents);
    const npc = interimProjection.npcs[npcId];
    if (!npc) throw new Error("npc_not_found");
    const careerId = idFactory("npc_career", `${npcId}:${title}:${status}:${sourceEventIds.join(":")}`);
    const payload = npcCareerChangedPayload({
      careerId,
      npcId,
      regionId: npc.regionId,
      title,
      status,
      organizationId,
      sourceEventIds,
      recordedAt: tickedAt,
    });
    nextEvents.push(makeEvent("npc_career_changed", careerId, payload, {
      aggregateType: "npc_career",
    }));
  };

  const recordNpcLocation = (
    npcId: string,
    toRegionId: string,
    reason: string,
    sourceEventIds: readonly string[],
  ) => {
    const interimProjection = applyEvents(current, nextEvents);
    const npc = interimProjection.npcs[npcId];
    if (!npc) throw new Error("npc_not_found");
    const nextRegionId = assertNonEmptyString(toRegionId, "npc_location_region_id");
    if (npc.regionId === nextRegionId) return;
    const locationId = idFactory("npc_location", `${npcId}:${npc.regionId}:${nextRegionId}:${sourceEventIds.join(":")}`);
    const payload = npcLocationChangedPayload({
      locationId,
      npcId,
      fromRegionId: npc.regionId,
      toRegionId: nextRegionId,
      reason,
      sourceEventIds,
      recordedAt: tickedAt,
    });
    nextEvents.push(makeEvent("npc_location_changed", locationId, payload, {
      aggregateType: "npc_location",
    }));
  };

  const recordNpcAsset = (
    npcId: string,
    regionId: string,
    assetKey: string,
    delta: number,
    reason: string,
    sourceEventIds: readonly string[],
  ) => {
    const interimProjection = applyEvents(current, nextEvents);
    const npc = interimProjection.npcs[npcId];
    if (!npc) throw new Error("npc_not_found");
    const nextAssetKey = assertNonEmptyString(assetKey, "npc_asset_key");
    const assetDelta = Number(delta);
    if (!Number.isFinite(assetDelta) || assetDelta === 0) return;
    const previousBalance = interimProjection.npcAssetBalancesByNpc[npcId]?.[nextAssetKey] || 0;
    const balanceAfter = previousBalance + assetDelta;
    const assetId = idFactory("npc_asset", `${npcId}:${nextAssetKey}:${sourceEventIds.join(":")}`);
    const payload = npcAssetChangedPayload({
      assetId,
      npcId,
      regionId: assertNonEmptyString(regionId, "npc_asset_region_id"),
      assetKey: nextAssetKey,
      delta: assetDelta,
      balanceAfter,
      reason,
      sourceEventIds,
      recordedAt: tickedAt,
    });
    nextEvents.push(makeEvent("npc_asset_changed", assetId, payload, {
      aggregateType: "npc_asset",
    }));
  };

  const recordNpcHealth = (
    npcId: string,
    regionId: string,
    status: string,
    reason: string,
    sourceEventIds: readonly string[],
  ) => {
    const interimProjection = applyEvents(current, nextEvents);
    const npc = interimProjection.npcs[npcId];
    if (!npc) throw new Error("npc_not_found");
    const healthStatus = assertNonEmptyString(status, "npc_health_status");
    const healthRegionId = assertNonEmptyString(regionId, "npc_health_region_id");
    const healthId = idFactory("npc_health", `${npcId}:${healthStatus}:${sourceEventIds.join(":")}`);
    const payload = npcHealthRecordedPayload({
      healthId,
      npcId,
      regionId: healthRegionId,
      status: healthStatus,
      reason,
      sourceEventIds,
      recordedAt: tickedAt,
    });
    nextEvents.push(makeEvent("npc_health_recorded", healthId, payload, {
      aggregateType: "npc_health",
    }));
  };

  const recordSocialHook = (
    npcId: string,
    changes: Readonly<Record<string, NpcLifecycleValue>>,
    sourceEventIds: readonly string[],
  ) => {
    const interimProjection = applyEvents(current, nextEvents);
    const npc = interimProjection.npcs[npcId];
    if (!npc) throw new Error("npc_not_found");
    const draft = socialHookDraftForLifecycle(npc, changes);
    if (!draft) return;
    const existingHook = Object.values(interimProjection.socialHooks).find((hook) =>
      hook && sourceEventIds.some((sourceEventId) => hook.sourceEventIds.includes(sourceEventId)));
    if (existingHook) return;
    const hookId = idFactory("social_hook", `${npcId}:${draft.kind}:${sourceEventIds.join(":")}`);
    const payload = socialHookCreatedPayload({
      draft,
      hookId,
      regionId: npc.regionId,
      npcId,
      sourceEventIds,
      createdAt: tickedAt,
    });
    nextEvents.push(makeEvent("social_hook_created", hookId, payload, {
      aggregateType: "social_hook",
    }));
  };

  for (const npc of selectedNpcs) {
    const step = npc.lifecycle.length % 4;
    const changes = lifecycleTickChanges(npc);
    const lifecycle = makeEvent("npc_lifecycle_recorded", npc.npcId, npcLifecycleRecordedPayload({
      npcId: npc.npcId,
      occurredAt: tickedAt,
      changes,
    }), { aggregateType: "npc" });
    nextEvents.push(lifecycle);

    const memoryId = idFactory("npc_memory", `${npc.npcId}:${lifecycle.eventId}`);
    const memoryPayload = npcMemoryRecordedPayload({
      memoryId,
      npcId: npc.npcId,
      regionId: npc.regionId,
      summary: lifecycleMemorySummary(npc, changes),
      importance: step === 0 ? "low" : "medium",
      sourceEventIds: [lifecycle.eventId],
      recordedAt: tickedAt,
    });
    nextEvents.push(makeEvent("npc_memory_recorded", memoryId, memoryPayload, {
      aggregateType: "npc",
    }));

    const assetDelta = changes.assets_delta;
    if (typeof assetDelta === "number") {
      recordNpcAsset(npc.npcId, npc.regionId, "wealth", assetDelta, "lifecycle_assets", [lifecycle.eventId]);
    }

    if (step === 0) {
      const organizationId = recordOrganizationMembership(npc.npcId, "regional_clerk", [lifecycle.eventId]);
      recordNpcCareer(npc.npcId, "regional clerk", "working", organizationId, [lifecycle.eventId]);
      recordWorkplaceRelationships(npc.npcId, [lifecycle.eventId]);
    }
    if (step === 1) {
      const partnerNpcId = ensureNpc(`${npc.displayName} Partner`, npc.regionId, ["partner"], lifecycle.eventId);
      recordNpcRelationship(npc.npcId, partnerNpcId, "spouse", 80, "lifecycle_marriage", [lifecycle.eventId]);
      recordHousehold([npc.npcId, partnerNpcId], "lifecycle_marriage", [lifecycle.eventId]);
      recordSocialHook(npc.npcId, changes, [lifecycle.eventId]);
    }
    if (step === 2) {
      const childNpcId = ensureNpc(`${npc.displayName} Child ${npc.lifecycle.length + 1}`, npc.regionId, ["child"], lifecycle.eventId);
      recordNpcRelationship(npc.npcId, childNpcId, "parent", 70, "lifecycle_child", [lifecycle.eventId]);
      recordNpcRelationship(childNpcId, npc.npcId, "child", 70, "lifecycle_child", [lifecycle.eventId]);
      recordHousehold([npc.npcId, childNpcId], "lifecycle_child", [lifecycle.eventId]);
      recordSocialHook(npc.npcId, changes, [lifecycle.eventId]);
    }
    if (step === 3) {
      const healthStatus = changes.health_status;
      if (typeof healthStatus === "string") {
        recordNpcHealth(npc.npcId, npc.regionId, healthStatus, "lifecycle_health", [lifecycle.eventId]);
      }
      recordRivalRelationship(npc.npcId, [lifecycle.eventId]);
      recordNpcLocation(npc.npcId, lifecycleMigrationRegionId(npc), "lifecycle_relocation", [lifecycle.eventId]);
      recordSocialHook(npc.npcId, changes, [lifecycle.eventId]);
    }
  }

  return nextEvents;
}

function aggregateIdsForEventType(
  events: readonly EpochEvent[],
  eventType: EpochEvent["eventType"],
): readonly string[] {
  return events
    .filter((event) => event.eventType === eventType)
    .map((event) => event.aggregateId);
}

function projectionValues<TRecord extends Readonly<Record<string, unknown>>>(
  ids: readonly string[],
  records: TRecord,
): readonly ProjectionRecordValue<TRecord>[] {
  const values: ProjectionRecordValue<TRecord>[] = [];
  for (const id of ids) {
    const value = records[id] as ProjectionRecordValue<TRecord> | undefined;
    if (value !== undefined) values.push(value);
  }
  return values;
}

export function projectNpcLifecycleTickResult<TProjection extends NpcLifecycleTickResultProjectionLike>(
  input: ProjectNpcLifecycleTickResultInput<TProjection>,
): ProjectedNpcLifecycleTickResult<TProjection> {
  const { events, projection, selectedNpcs, tickedAt } = input;
  type Result = ProjectedNpcLifecycleTickResult<TProjection>;
  return {
    tickedAt,
    updated: projectionValues(selectedNpcs.map((npc) => npc.npcId), projection.npcs) as Result["updated"],
    relationships: projectionValues(
      aggregateIdsForEventType(events, "npc_relationship_recorded"),
      projection.npcRelationships,
    ) as Result["relationships"],
    memories: projectionValues(
      aggregateIdsForEventType(events, "npc_memory_recorded"),
      projection.npcMemories,
    ) as Result["memories"],
    households: projectionValues(
      aggregateIdsForEventType(events, "npc_household_recorded"),
      projection.households,
    ) as Result["households"],
    organizationMemberships: projectionValues(
      aggregateIdsForEventType(events, "organization_membership_changed"),
      projection.organizationMemberships,
    ) as Result["organizationMemberships"],
    careers: projectionValues(
      aggregateIdsForEventType(events, "npc_career_changed"),
      projection.npcCareerRecords,
    ) as Result["careers"],
    locations: projectionValues(
      aggregateIdsForEventType(events, "npc_location_changed"),
      projection.npcLocationRecords,
    ) as Result["locations"],
    assetStates: projectionValues(
      aggregateIdsForEventType(events, "npc_asset_changed"),
      projection.npcAssetStates,
    ) as Result["assetStates"],
    healthStates: projectionValues(
      aggregateIdsForEventType(events, "npc_health_recorded"),
      projection.npcHealthStates,
    ) as Result["healthStates"],
    socialHooks: projectionValues(
      aggregateIdsForEventType(events, "social_hook_created"),
      projection.socialHooks,
    ) as Result["socialHooks"],
  };
}
