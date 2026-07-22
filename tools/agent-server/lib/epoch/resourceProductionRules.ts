import type {
  CausalEntityRef,
  ResourceLedgerEffectV1,
} from "./causalContracts.ts";
import { CausalValidationError } from "./causalContracts.ts";
import { parseQuantityMinor } from "./causalResourceRules.ts";

export const RESOURCE_PRODUCTION_RULESET_VERSION = "1.0.0" as const;
export const RESOURCE_NODE_INVENTORY_ACCOUNT_PREFIX = "resource_node_inventory" as const;

export interface ResourceProductionNode {
  readonly nodeId: string;
  readonly resourceKey: string;
  readonly resourceClass: string;
  readonly unit: string;
  readonly capacity: string;
  readonly remainingUnits: string;
  readonly yieldPerWorkUnit: string;
  readonly workerSlots: number;
  readonly registeredAtWorldTime: number;
  readonly depletedAtWorldTime?: number;
}

export interface ResourceProductionRegistry {
  readonly nodes: Readonly<Record<string, ResourceProductionNode | undefined>>;
}

export interface RegisterResourceProductionNodeInput {
  readonly nodeId: string;
  readonly resourceKey: string;
  readonly resourceClass: string;
  readonly unit: string;
  readonly capacity: string;
  readonly remainingUnits?: string;
  readonly yieldPerWorkUnit: string;
  readonly workerSlots: number;
  readonly worldTime: number;
}

export interface ResourceProductionAssignment {
  readonly assignmentId: string;
  readonly nodeId: string;
  readonly workerRef: string;
  readonly targetAccountRef: string;
  readonly workUnits: string;
  readonly assignedAtWorldTime: number;
  readonly sourceEventIds: readonly string[];
  readonly authorizationRefs?: readonly string[];
}

export interface AssignResourceProductionInput {
  readonly assignmentId: string;
  readonly nodeId: string;
  readonly workerRef: string;
  readonly targetAccountRef: string;
  readonly workUnits: string;
  readonly worldTime: number;
  readonly sourceEventIds: readonly string[];
  readonly authorizationRefs?: readonly string[];
}

export interface ProduceResourceInput {
  readonly registry: ResourceProductionRegistry;
  readonly assignments: readonly ResourceProductionAssignment[];
  readonly nodeId: string;
  readonly resourceKey: string;
  readonly targetAccountRef: string;
  readonly worldTime: number;
  readonly sourceEventIds?: readonly string[];
  readonly authorizationRefs?: readonly string[];
  readonly effectId?: string;
}

export interface ResourceProductionProposal {
  readonly rulesetVersion: typeof RESOURCE_PRODUCTION_RULESET_VERSION;
  readonly node: ResourceProductionNode;
  readonly assignmentIds: readonly string[];
  readonly workerRefs: readonly string[];
  readonly workUnitsApplied: string;
  readonly producedUnits: string;
  readonly sourceEventIds: readonly string[];
  readonly effects: readonly ResourceLedgerEffectV1[];
}

export interface ReplenishResourceNodeInput {
  readonly registry: ResourceProductionRegistry;
  readonly nodeId: string;
  readonly amount: string;
  readonly worldTime: number;
}

export function resourceNodeInventoryAccountRef(nodeId: string): string {
  assertNonEmptyText(nodeId, "nodeId");
  return `${RESOURCE_NODE_INVENTORY_ACCOUNT_PREFIX}:${nodeId}`;
}

export function emptyResourceProductionRegistry(): ResourceProductionRegistry {
  return { nodes: {} };
}

export function registerResourceProductionNode(
  registry: ResourceProductionRegistry,
  input: RegisterResourceProductionNodeInput,
): ResourceProductionRegistry {
  assertNonEmptyText(input.nodeId, "nodeId");
  assertNonEmptyText(input.resourceKey, "resourceKey");
  assertNonEmptyText(input.resourceClass, "resourceClass");
  assertNonEmptyText(input.unit, "unit");
  const capacity = assertPositiveMinor(input.capacity, "capacity");
  const remainingUnits = input.remainingUnits === undefined
    ? capacity
    : assertNonNegativeMinor(input.remainingUnits, "remainingUnits");
  const yieldPerWorkUnit = assertPositiveMinor(input.yieldPerWorkUnit, "yieldPerWorkUnit");
  assertPositiveSafeInteger(input.workerSlots, "workerSlots");
  assertWorldTime(input.worldTime, "worldTime");
  if (remainingUnits > capacity) {
    throw invalid("remainingUnits", "remainingUnits_exceeds_capacity");
  }
  if (registry.nodes[input.nodeId]) {
    throw invalid("nodeId", "resource_node_already_registered");
  }

  return {
    nodes: {
      ...registry.nodes,
      [input.nodeId]: {
        nodeId: input.nodeId,
        resourceKey: input.resourceKey,
        resourceClass: input.resourceClass,
        unit: input.unit,
        capacity: capacity.toString(),
        remainingUnits: remainingUnits.toString(),
        yieldPerWorkUnit: yieldPerWorkUnit.toString(),
        workerSlots: input.workerSlots,
        registeredAtWorldTime: input.worldTime,
        depletedAtWorldTime: remainingUnits === 0n ? input.worldTime : undefined,
      },
    },
  };
}

export function assignResourceProduction(
  registry: ResourceProductionRegistry,
  input: AssignResourceProductionInput,
): ResourceProductionAssignment {
  assertNonEmptyText(input.assignmentId, "assignmentId");
  assertNonEmptyText(input.workerRef, "workerRef");
  assertNonEmptyText(input.targetAccountRef, "targetAccountRef");
  const workUnits = assertPositiveMinor(input.workUnits, "workUnits");
  assertWorldTime(input.worldTime, "worldTime");
  assertSourceEventIds(input.sourceEventIds);
  const node = requireProductionNode(registry, input.nodeId);
  assertNodeAvailable(node, input.worldTime);

  return {
    assignmentId: input.assignmentId,
    nodeId: node.nodeId,
    workerRef: input.workerRef,
    targetAccountRef: input.targetAccountRef,
    workUnits: workUnits.toString(),
    assignedAtWorldTime: input.worldTime,
    sourceEventIds: [...input.sourceEventIds].sort(),
    authorizationRefs: input.authorizationRefs ? [...input.authorizationRefs].sort() : undefined,
  };
}

export function produceResource(input: ProduceResourceInput): ResourceProductionProposal {
  assertNonEmptyText(input.targetAccountRef, "targetAccountRef");
  assertNonEmptyText(input.resourceKey, "resourceKey");
  assertWorldTime(input.worldTime, "worldTime");
  const node = requireProductionNode(input.registry, input.nodeId);
  if (node.resourceKey !== input.resourceKey) throw invalid("resourceKey", "resource_key_mismatch");
  assertNodeAvailable(node, input.worldTime);

  const matchingAssignments = input.assignments
    .filter((assignment) =>
      assignment.nodeId === node.nodeId &&
      assignment.targetAccountRef === input.targetAccountRef &&
      assignment.assignedAtWorldTime <= input.worldTime
    )
    .sort((left, right) => left.assignmentId.localeCompare(right.assignmentId));
  if (!matchingAssignments.length) throw invalid("assignments", "resource_production_assignment_missing");

  const uniqueWorkers = new Set<string>();
  for (const assignment of matchingAssignments) {
    assertNonEmptyText(assignment.workerRef, "assignment.workerRef");
    uniqueWorkers.add(assignment.workerRef);
  }
  if (uniqueWorkers.size > node.workerSlots) throw invalid("assignments", "worker_slots_exceeded");

  const totalWorkUnits = matchingAssignments.reduce(
    (sum, assignment) => sum + assertPositiveMinor(assignment.workUnits, "assignment.workUnits"),
    0n,
  );
  const remainingUnits = assertNonNegativeMinor(node.remainingUnits, "remainingUnits");
  const yieldPerWorkUnit = assertPositiveMinor(node.yieldPerWorkUnit, "yieldPerWorkUnit");
  const requestedYield = totalWorkUnits * yieldPerWorkUnit;
  const producedUnits = requestedYield < remainingUnits ? requestedYield : remainingUnits;
  if (producedUnits <= 0n) throw invalid("remainingUnits", "resource_node_depleted");

  const nextRemainingUnits = remainingUnits - producedUnits;
  const sourceEventIds = uniqueSorted([
    ...(input.sourceEventIds || []),
    ...matchingAssignments.flatMap((assignment) => assignment.sourceEventIds),
  ]);
  assertSourceEventIds(sourceEventIds);
  const authorizationRefs = uniqueSorted([
    ...(input.authorizationRefs || []),
    ...matchingAssignments.flatMap((assignment) => assignment.authorizationRefs || []),
  ]);
  const nodeAccountRef = resourceNodeInventoryAccountRef(node.nodeId);
  const effect: ResourceLedgerEffectV1 = {
    effectId: input.effectId || resourceProductionEffectId(node.nodeId, input.targetAccountRef, input.worldTime),
    effectType: "resource_ledger",
    targetRef: resourceNodeEntityRef(node.nodeId),
    operation: "resource_node_produce",
    after: {
      resourceKey: node.resourceKey,
      resourceClass: node.resourceClass,
      unit: node.unit,
      entries: [
        { accountRef: nodeAccountRef, quantityMinor: `-${producedUnits.toString()}` },
        { accountRef: input.targetAccountRef, quantityMinor: producedUnits.toString() },
      ],
    },
    sourceEventIds,
    authorizationRefs,
  };

  return {
    rulesetVersion: RESOURCE_PRODUCTION_RULESET_VERSION,
    node: {
      ...node,
      remainingUnits: nextRemainingUnits.toString(),
      depletedAtWorldTime: nextRemainingUnits === 0n
        ? node.depletedAtWorldTime ?? input.worldTime
        : node.depletedAtWorldTime,
    },
    assignmentIds: matchingAssignments.map((assignment) => assignment.assignmentId),
    workerRefs: [...uniqueWorkers].sort(),
    workUnitsApplied: totalWorkUnits.toString(),
    producedUnits: producedUnits.toString(),
    sourceEventIds,
    effects: [effect],
  };
}

export function replenishResourceNode(input: ReplenishResourceNodeInput): ResourceProductionRegistry {
  const node = requireProductionNode(input.registry, input.nodeId);
  const amount = assertPositiveMinor(input.amount, "amount");
  assertWorldTime(input.worldTime, "worldTime");
  const capacity = assertPositiveMinor(node.capacity, "capacity");
  const remainingUnits = assertNonNegativeMinor(node.remainingUnits, "remainingUnits");
  const nextRemainingUnits = remainingUnits + amount > capacity ? capacity : remainingUnits + amount;

  return {
    nodes: {
      ...input.registry.nodes,
      [node.nodeId]: {
        ...node,
        remainingUnits: nextRemainingUnits.toString(),
        depletedAtWorldTime: nextRemainingUnits > 0n ? undefined : node.depletedAtWorldTime ?? input.worldTime,
      },
    },
  };
}

export function applyResourceProductionProposal(
  registry: ResourceProductionRegistry,
  proposal: ResourceProductionProposal,
): ResourceProductionRegistry {
  return {
    nodes: {
      ...registry.nodes,
      [proposal.node.nodeId]: proposal.node,
    },
  };
}

export function resourceProductionBalanceSnapshot(
  registry: ResourceProductionRegistry,
): Readonly<Record<string, Readonly<Record<string, string>>>> {
  return Object.fromEntries(Object.values(registry.nodes)
    .filter((node): node is ResourceProductionNode => Boolean(node))
    .map((node) => [
      resourceNodeInventoryAccountRef(node.nodeId),
      { [`${node.resourceKey}:${node.unit}`]: node.remainingUnits },
    ]));
}

function requireProductionNode(registry: ResourceProductionRegistry, nodeId: string): ResourceProductionNode {
  assertNonEmptyText(nodeId, "nodeId");
  const node = registry.nodes[nodeId];
  if (!node) throw invalid("nodeId", "resource_node_not_found");
  return node;
}

function assertNodeAvailable(node: ResourceProductionNode, worldTime: number): void {
  if (worldTime < node.registeredAtWorldTime) throw invalid("worldTime", "world_time_before_node_registration");
  const remainingUnits = assertNonNegativeMinor(node.remainingUnits, "remainingUnits");
  if (remainingUnits === 0n || node.depletedAtWorldTime !== undefined) {
    throw invalid("nodeId", "resource_node_depleted");
  }
}

function resourceProductionEffectId(nodeId: string, targetAccountRef: string, worldTime: number): string {
  return `resource_production:${nodeId}:${targetAccountRef}:${worldTime}`;
}

function resourceNodeEntityRef(nodeId: string): CausalEntityRef {
  return { entityType: "resource_node", entityId: nodeId };
}

function assertNonEmptyText(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) throw invalid(field, "expected_non_empty_text");
  return value;
}

function assertWorldTime(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || Number(value) < 0) throw invalid(field, "expected_non_negative_safe_integer");
  return Number(value);
}

function assertPositiveSafeInteger(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || Number(value) <= 0) throw invalid(field, "expected_positive_safe_integer");
  return Number(value);
}

function assertPositiveMinor(value: string, field: string): bigint {
  const parsed = parseQuantityMinor(value);
  if (parsed === undefined || parsed <= 0n) throw invalid(field, "expected_positive_decimal_integer");
  return parsed;
}

function assertNonNegativeMinor(value: string, field: string): bigint {
  const parsed = parseQuantityMinor(value);
  if (parsed === undefined || parsed < 0n) throw invalid(field, "expected_non_negative_decimal_integer");
  return parsed;
}

function assertSourceEventIds(sourceEventIds: readonly string[]): void {
  if (!sourceEventIds.length) throw invalid("sourceEventIds", "source_event_ids_required");
  sourceEventIds.forEach((sourceEventId, index) => assertNonEmptyText(sourceEventId, `sourceEventIds[${index}]`));
}

function uniqueSorted(values: readonly string[]): readonly string[] {
  return [...new Set(values)].sort();
}

function invalid(field: string, reason: string): CausalValidationError {
  return new CausalValidationError("CAUSAL_SCHEMA_INVALID", { field, reason });
}
