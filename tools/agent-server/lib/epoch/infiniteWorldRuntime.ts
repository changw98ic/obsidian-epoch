import {
  CAUSAL_COMMAND_SCHEMA_VERSION,
  CAUSAL_EVENT_SCHEMA_VERSION,
  CausalValidationError,
  isCausalRecord,
  type CausalActorRef,
  type CausalEffectV1,
  type CausalEntityRef,
  type CausalNamespace,
  type CausalWorldEventCandidateV1,
  type CausalWorldEventV1,
  type CommandIntentV1,
} from "./causalContracts.ts";
import {
  type CausalAtomicCommitContext,
  createInMemoryCausalIdempotencyManifestStore,
  type CausalIdempotencyManifest,
  type CausalIdempotencyManifestStore,
} from "./causalIdempotencyRules.ts";
import {
  DEFAULT_CAUSAL_INVARIANT_POLICY,
  DEFAULT_CAUSAL_RESOURCE_POLICY,
  createCausalWriteCoordinator,
  type CausalBuildContext,
  type CausalWriteResult,
  type CreateCausalWriteCoordinatorOptions,
} from "./causalWriteCoordinator.ts";
import {
  applyCausalEventToSnapshot,
  assertCausalWorldSnapshotV1,
  causalCheckpointMetadata,
  causalWriteSnapshotFromWorldSnapshot,
  emptyCausalWorldSnapshot,
  type CausalCheckpointMetadataV1,
  type CausalWorldSnapshotV1,
} from "./causalWorldSnapshot.ts";
import {
  createCausalObservabilityCollector,
  type CausalObservabilityCollector,
  type CausalObservabilitySnapshot,
  type CausalSloThresholds,
} from "./causalObservability.ts";
import {
  migrateCausalSnapshot,
  type CausalSnapshotMigrationOutput,
} from "./causalSnapshotMigration.ts";
import {
  proposeEconomyCraft,
  proposeEconomyPurchase,
  proposeEconomyRepair,
  proposeEconomySale,
  DEFAULT_ECONOMY_RESOURCES,
  UNIFIED_ECONOMY_DEFAULT_FEE_ACCOUNT_REF,
  UNIFIED_ECONOMY_CONTENT_VERSION,
  UNIFIED_ECONOMY_RULESET_VERSION,
  type EconomyCraftRecipe,
  type EconomyCraftInput,
  type EconomyEffectProposal,
  type EconomyPurchaseInput,
  type EconomyRepairInput,
  type EconomySellInput,
  type UnifiedEconomyState,
} from "./unifiedEconomyRules.ts";
import {
  convertRunReward,
  proposeAttributeEvidence,
  proposeBreakthrough,
  proposeExpandCarry,
  proposeRespec,
  proposeSkillUnlock,
  proposeTalentAllocation,
  PROGRESSION_CONTENT_VERSION,
  PROGRESSION_RULESET_VERSION,
  type AttributeEvidenceInput,
  type BreakthroughAttemptInput,
  type ExpandCarryInput,
  type ProgressionProposal,
  type ProgressionState,
  type RespecInput,
  type RunRewardConversionInput,
  type SkillUnlockInput,
  type TalentAllocationInput,
} from "./progressionRules.ts";
import {
  settleNarrativeCandidate,
  EPOCH_CAUSAL_NARRATIVE_RULE_VERSION,
  type SettleNarrativeCandidateInput,
} from "./causalNarrativeRules.ts";
import {
  proposeMissionConsequences,
  type MissionConsequenceInput,
} from "./missionConsequenceRules.ts";
import {
  advanceEcologyTick,
  applyGovernanceAction,
  deriveGovernancePressures,
  EPOCH_GOVERNANCE_ECOLOGY_RULE_VERSION,
  type EcologyTickInput,
  type GovernanceActionProposal,
  type GovernanceState,
} from "./governanceEcologyRules.ts";
import {
  advanceEpochWorldPressures,
  deriveEpochWorldPressuresFromFactSignals,
  EPOCH_WORLD_PRESSURE_RULE_VERSION,
  type EpochWorldPressure,
  type EpochWorldPressureFactSignal,
} from "./worldPressureRules.ts";
import {
  evaluateSupernaturalCast,
  settleMortalityAndLegacy,
  advanceLegacyProject,
  SUPERNATURAL_LEGACY_RULESET_VERSION,
  type LegacyProjectAdvanceInput,
  type MortalityLegacyIntent,
  type MortalityLegacySnapshot,
  type SupernaturalActorSnapshot,
  type SupernaturalCapabilityDef,
  type SupernaturalCastIntent,
} from "./supernaturalLegacyRules.ts";
import {
  assignResourceProduction,
  emptyResourceProductionRegistry,
  produceResource,
  registerResourceProductionNode,
  replenishResourceNode,
  resourceNodeInventoryAccountRef,
  type AssignResourceProductionInput,
  type ResourceProductionAssignment,
  type ResourceProductionNode,
  type RegisterResourceProductionNodeInput,
  type ResourceProductionRegistry,
} from "./resourceProductionRules.ts";
import {
  advanceLifeProfile,
  createLifeProfile,
  validateLifeProfile,
  type LifeProfileCreateInput,
  type LifeProfileResourceDelta,
  type LifeProfileResourceKey,
  type LifeProfileState,
} from "./lifeProfileRules.ts";
import {
  actionProposal,
  commitmentConflictRefs,
  selectActorGoals,
  type ActionProposalInput,
  type ActorMind,
  type ActorMindConfig,
  type CommitmentRef,
  type GoalCandidate,
  type GoalRef,
} from "./actorMindRules.ts";
import {
  CAUSAL_RESOURCE_SOURCE_REFS,
  createCausalResourcePolicyFromCatalog,
} from "./causalResourceCatalog.ts";
import { causalWorldEventToEpochEvent } from "./causalEpochAdapter.ts";
import type { EpochEvent } from "./events.ts";

export const INFINITE_WORLD_RUNTIME_COMMAND_SCHEMA_VERSION = "1.0.0" as const;
export const INFINITE_WORLD_RUNTIME_ADJUDICATOR_VERSION = "infinite-world-runtime.v1" as const;

export type InfiniteWorldCommandType =
  | "world_tick"
  | "resource_node_register"
  | "resource_production_assign"
  | "resource_produce"
  | "resource_node_replenish"
  | "life_profile_create"
  | "life_profile_advance"
  | "mission_settle"
  | "economy_buy"
  | "economy_sell"
  | "economy_craft"
  | "economy_repair"
  | "progression_reward"
  | "progression_breakthrough"
  | "progression_talent"
  | "progression_skill"
  | "progression_carry"
  | "progression_attribute_evidence"
  | "progression_respec"
  | "governance_action"
  | "supernatural_cast"
  | "legacy_transition"
  | "project_tick"
  | "narrative_settle"
  | "actor_mind_tick"
  | "actor_goal_select"
  | "actor_commitment_update";

interface InfiniteWorldCommandBase<TType extends InfiniteWorldCommandType, TPayload extends Readonly<Record<string, unknown>>> {
  readonly commandType: TType;
  readonly commandSchemaVersion?: typeof INFINITE_WORLD_RUNTIME_COMMAND_SCHEMA_VERSION;
  readonly commandId?: string;
  readonly worldId: string;
  readonly namespace?: CausalNamespace;
  readonly actor: CausalActorRef;
  readonly submittedAt?: string;
  readonly requestedWorldMinute?: number;
  readonly idempotencyKey: string;
  readonly expectedStreamVersions?: CommandIntentV1["expectedStreamVersions"];
  readonly authorizationRefs?: readonly string[];
  readonly causalParentEventIds?: readonly string[];
  readonly rootPressureIds?: readonly string[];
  readonly rootReason?: CommandIntentV1["rootReason"];
  readonly payload: TPayload;
}

export interface WorldTickPayload extends Readonly<Record<string, unknown>> {
  readonly pressures?: readonly EpochWorldPressure[];
  readonly currentWorldMinute?: number;
  readonly targetWorldMinute?: number;
  readonly sourceEventIds?: readonly string[];
  readonly ecology?: EcologyTickInput;
  readonly governance?: GovernanceState;
  readonly processLifeProfiles?: boolean;
}

export interface ResourceNodeRegisterPayload extends Readonly<Record<string, unknown>> {
  readonly input: RegisterResourceProductionNodeInput;
}

export interface ResourceProductionAssignPayload extends Readonly<Record<string, unknown>> {
  readonly input: AssignResourceProductionInput;
}

export interface ResourceProducePayload extends Readonly<Record<string, unknown>> {
  readonly nodeId: string;
  readonly resourceKey: string;
  readonly targetAccountRef: string;
  readonly sourceEventIds?: readonly string[];
  readonly authorizationRefs?: readonly string[];
  readonly effectId?: string;
}

export interface ResourceNodeReplenishPayload extends Readonly<Record<string, unknown>> {
  readonly input: {
    readonly nodeId: string;
    readonly amount: string;
    readonly worldTime: number;
  };
}

export interface LifeProfileCreatePayload extends Readonly<Record<string, unknown>> {
  readonly profileId: string;
  readonly input: LifeProfileCreateInput;
}

export interface LifeProfileAdvancePayload extends Readonly<Record<string, unknown>> {
  readonly profileId: string;
  readonly toWorldMinute: number;
}

export interface EconomyCommandPayload<TInput> extends Readonly<Record<string, unknown>> {
  readonly state: UnifiedEconomyState;
  readonly input: TInput;
}

export interface ProgressionCommandPayload<TInput> extends Readonly<Record<string, unknown>> {
  readonly state?: ProgressionState;
  readonly input: TInput;
}

export interface MissionSettlePayload extends Readonly<Record<string, unknown>> {
  readonly input: MissionConsequenceInput;
}

export interface GovernanceActionPayload extends Readonly<Record<string, unknown>> {
  readonly state: GovernanceState;
  readonly action: GovernanceActionProposal;
}

export interface SupernaturalCastPayload extends Readonly<Record<string, unknown>> {
  readonly actorSnapshot: SupernaturalActorSnapshot;
  readonly intent: SupernaturalCastIntent;
  readonly capabilities: readonly SupernaturalCapabilityDef[];
}

export interface LegacyTransitionPayload extends Readonly<Record<string, unknown>> {
  readonly snapshot: MortalityLegacySnapshot;
  readonly intent: MortalityLegacyIntent;
}

export interface ProjectTickPayload extends Readonly<Record<string, unknown>> {
  readonly input: LegacyProjectAdvanceInput;
}

export interface ActorMindTickPayload extends Readonly<Record<string, unknown>> {
  readonly actorMind: ActorMind;
  readonly goalCandidates: readonly GoalCandidate[];
  readonly config?: Partial<ActorMindConfig>;
}

export interface ActorGoalSelectPayload extends Readonly<Record<string, unknown>> {
  readonly actorMind: ActorMind;
  readonly goal: GoalRef;
  readonly actionProposalInput?: ActionProposalInput;
}

export interface ActorCommitmentUpdatePayload extends Readonly<Record<string, unknown>> {
  readonly actorMind: ActorMind;
  readonly commitmentRef: string;
  readonly status: CommitmentRef["status"];
}

export type InfiniteWorldCommandV1 =
  | InfiniteWorldCommandBase<"world_tick", WorldTickPayload>
  | InfiniteWorldCommandBase<"resource_node_register", ResourceNodeRegisterPayload>
  | InfiniteWorldCommandBase<"resource_production_assign", ResourceProductionAssignPayload>
  | InfiniteWorldCommandBase<"resource_produce", ResourceProducePayload>
  | InfiniteWorldCommandBase<"resource_node_replenish", ResourceNodeReplenishPayload>
  | InfiniteWorldCommandBase<"life_profile_create", LifeProfileCreatePayload>
  | InfiniteWorldCommandBase<"life_profile_advance", LifeProfileAdvancePayload>
  | InfiniteWorldCommandBase<"mission_settle", MissionSettlePayload>
  | InfiniteWorldCommandBase<"economy_buy", EconomyCommandPayload<EconomyPurchaseInput>>
  | InfiniteWorldCommandBase<"economy_sell", EconomyCommandPayload<EconomySellInput>>
  | InfiniteWorldCommandBase<"economy_craft", EconomyCommandPayload<EconomyCraftInput>>
  | InfiniteWorldCommandBase<"economy_repair", EconomyCommandPayload<EconomyRepairInput>>
  | InfiniteWorldCommandBase<"progression_reward", ProgressionCommandPayload<RunRewardConversionInput>>
  | InfiniteWorldCommandBase<"progression_breakthrough", ProgressionCommandPayload<BreakthroughAttemptInput>>
  | InfiniteWorldCommandBase<"progression_talent", ProgressionCommandPayload<TalentAllocationInput>>
  | InfiniteWorldCommandBase<"progression_skill", ProgressionCommandPayload<SkillUnlockInput>>
  | InfiniteWorldCommandBase<"progression_carry", ProgressionCommandPayload<ExpandCarryInput>>
  | InfiniteWorldCommandBase<"governance_action", GovernanceActionPayload>
  | InfiniteWorldCommandBase<"supernatural_cast", SupernaturalCastPayload>
  | InfiniteWorldCommandBase<"legacy_transition", LegacyTransitionPayload>
  | InfiniteWorldCommandBase<"project_tick", ProjectTickPayload>
  | InfiniteWorldCommandBase<"actor_mind_tick", ActorMindTickPayload>
  | InfiniteWorldCommandBase<"actor_goal_select", ActorGoalSelectPayload>
  | InfiniteWorldCommandBase<"actor_commitment_update", ActorCommitmentUpdatePayload>;

export interface InfiniteWorldRuntimeResult extends CausalWriteResult {
  readonly epochEvents: readonly EpochEvent[];
}

export interface CreateInfiniteWorldRuntimeOptions {
  readonly worldId: string;
  readonly initialSnapshot?: unknown;
  readonly initialEvents?: readonly CausalWorldEventV1[];
  readonly initialIdempotencyManifests?: readonly CausalIdempotencyManifest[];
  readonly idempotencyStore?: CausalIdempotencyManifestStore;
  readonly atomicCommit?: (input: {
    readonly atomic?: CausalAtomicCommitContext;
    readonly event: CausalWorldEventV1;
    readonly epochEvents: readonly EpochEvent[];
  }) => void | Promise<void>;
  readonly now?: () => string;
  readonly nowMs?: () => number;
  readonly idFactory?: (kind: string, input: Readonly<Record<string, unknown>>) => string;
  readonly ingestCanonicalEvents?: (events: readonly EpochEvent[], causalEvents: readonly CausalWorldEventV1[]) => void | Promise<void>;
  readonly observability?: CausalObservabilityCollector;
  readonly healthThresholds?: CausalSloThresholds;
  readonly enforcementMode?: CreateCausalWriteCoordinatorOptions["enforcementMode"];
}

export interface InfiniteWorldRuntime {
  readonly execute: (command: InfiniteWorldCommandV1 | CommandIntentV1 | unknown) => Promise<InfiniteWorldRuntimeResult>;
  readonly snapshot: () => CausalWorldSnapshotV1;
  readonly checkpoint: () => CausalCheckpointMetadataV1;
  readonly migrate: (snapshot?: unknown, dryRun?: boolean) => CausalSnapshotMigrationOutput;
  readonly health: () => CausalObservabilitySnapshot;
  readonly events: () => readonly CausalWorldEventV1[];
  readonly resultForIdempotencyKey: (idempotencyKey: string) => CausalWriteResult | undefined;
  readonly drain: () => Promise<void>;
}

interface DomainProposal {
  readonly eventType: string;
  readonly namespace: CausalNamespace;
  readonly rulesetVersion: string;
  readonly contentVersion: string;
  readonly effects: readonly CausalEffectV1[];
  readonly payload: Readonly<Record<string, unknown>>;
  readonly subjectRefs?: readonly CausalEntityRef[];
  readonly regionRefs?: readonly string[];
  readonly warnings?: readonly string[];
}

const KNOWN_COMMAND_TYPES: ReadonlySet<string> = new Set<InfiniteWorldCommandType>([
  "world_tick",
  "resource_node_register",
  "resource_production_assign",
  "resource_produce",
  "resource_node_replenish",
  "life_profile_create",
  "life_profile_advance",
  "mission_settle",
  "economy_buy",
  "economy_sell",
  "economy_craft",
  "economy_repair",
  "progression_reward",
  "progression_breakthrough",
  "progression_talent",
  "progression_skill",
  "progression_carry",
  "progression_attribute_evidence",
  "progression_respec",
  "governance_action",
  "supernatural_cast",
  "legacy_transition",
  "project_tick",
  "narrative_settle",
  "actor_mind_tick",
  "actor_goal_select",
  "actor_commitment_update",
]);

const DEFAULT_RECORDED_AT = "1970-01-01T00:00:00.000Z";
const RUNTIME_PARENT_EVENT_IDS_FIELD = "runtimeCausalParentEventIds";

export function createInfiniteWorldRuntime(options: CreateInfiniteWorldRuntimeOptions): InfiniteWorldRuntime {
  const now = options.now || (() => DEFAULT_RECORDED_AT);
  const idFactory = options.idFactory || defaultIdFactory;
  const observability = options.observability || createCausalObservabilityCollector();
  const eventLog = new Map<string, CausalWorldEventV1>();
  const resultsByIdempotencyKey = new Map<string, CausalWriteResult>();
  const idempotencyStore = options.idempotencyStore
    || createInMemoryCausalIdempotencyManifestStore(options.initialIdempotencyManifests);
  let snapshot = assertCausalWorldSnapshotV1(options.initialSnapshot ?? emptyCausalWorldSnapshot(options.worldId));
  if (snapshot.worldId !== options.worldId) {
    throw new CausalValidationError("CAUSAL_SCHEMA_INVALID", {
      field: "initialSnapshot.worldId",
      expectedWorldId: options.worldId,
      actualWorldId: snapshot.worldId,
    });
  }

  for (const event of options.initialEvents || []) {
    eventLog.set(event.eventId, event);
    snapshot = applyCausalEventToSnapshot(snapshot, event, { allowDuplicate: true });
  }

  const catalogResourcePolicy = createCausalResourcePolicyFromCatalog();
  const coordinator = createCausalWriteCoordinator({
    idempotencyStore,
    now,
    enforcementMode: options.enforcementMode,
    invariantPolicy: {
      ...DEFAULT_CAUSAL_INVARIANT_POLICY,
      rootEventTypes: [
        ...refValues(DEFAULT_CAUSAL_INVARIANT_POLICY.rootEventTypes),
        "ecology_tick_resolved",
        "resource_node_registered",
        "resource_production_assigned",
        "resource_production_committed",
        "resource_node_replenished",
        "life_profile_created",
        "life_profile_advanced",
        "mission_outcome_settled",
        "economy_transaction_committed",
        "crafting_job_resolved",
        "progression_change_committed",
        "governance_action_resolved",
        "supernatural_action_resolved",
        "legacy_cycle_changed",
        "enterprise_tick_resolved",
        "narrative_settlement_committed",
        "actor_mind_updated",
        "actor_goal_committed",
        "actor_commitment_updated",
      ],
      rootReasonsByEventType: {
        ...(DEFAULT_CAUSAL_INVARIANT_POLICY.rootReasonsByEventType || {}),
        ecology_tick_resolved: ["deterministic_schedule", "external_clock"],
        resource_node_registered: ["external_verified_input"],
        resource_production_assigned: ["external_verified_input"],
        resource_production_committed: ["external_verified_input"],
        resource_node_replenished: ["external_verified_input"],
        life_profile_created: ["external_verified_input"],
        life_profile_advanced: ["external_verified_input"],
        mission_outcome_settled: ["external_verified_input"],
        economy_transaction_committed: ["external_verified_input"],
        crafting_job_resolved: ["external_verified_input"],
        progression_change_committed: ["external_verified_input"],
        governance_action_resolved: ["external_verified_input"],
        supernatural_action_resolved: ["external_verified_input"],
        legacy_cycle_changed: ["external_verified_input"],
        enterprise_tick_resolved: ["external_verified_input"],
        narrative_settlement_committed: ["external_verified_input"],
        actor_mind_updated: ["external_verified_input"],
        actor_goal_committed: ["external_verified_input"],
        actor_commitment_updated: ["external_verified_input"],
      },
    },
    loadSnapshot: (command) => runtimeWriteSnapshot(snapshot, command),
    loadCommittedEvent: (eventId) => eventLog.get(eventId),
    buildEvent: (command, _writeSnapshot, context) => buildRuntimeEvent(command, context, idFactory, snapshot),
    resourcePolicy: {
      ...DEFAULT_CAUSAL_RESOURCE_POLICY,
      creationSourceAllowed: (input) => catalogResourcePolicy.creationSourceAllowed?.(input) ?? false,
      destructionSinkAllowed: (input) => catalogResourcePolicy.destructionSinkAllowed?.(input) ?? false,
    },
    commit: ({ event, atomic }) => {
      if (options.atomicCommit) {
        return options.atomicCommit({
          atomic,
          event,
          epochEvents: [causalWorldEventToEpochEvent(event)],
        });
      }
    },
    project: async (event) => {
      if (!options.ingestCanonicalEvents) return;
      await options.ingestCanonicalEvents([causalWorldEventToEpochEvent(event)], [event]);
    },
  });

  return {
    async execute(input) {
      const command = normalizeRuntimeCommand(input, now, idFactory, options.worldId);
      try {
        const beforeSnapshot = snapshot;
        const result = await coordinator.execute(command);
        if (!result.replayed && !eventLog.has(result.event.eventId)) {
          snapshot = applyCausalEventToSnapshot(beforeSnapshot, result.event);
          eventLog.set(result.event.eventId, result.event);
        }
        resultsByIdempotencyKey.set(command.idempotencyKey, result);
        if (result.replayed) {
          observability.recordReplay({ at: now(), details: { commandType: command.commandType } });
        } else {
          observability.recordCommit({ at: result.event.recordedAt, details: { commandType: command.commandType } });
        }
        if (result.manifest.projectionStatus === "degraded") {
          observability.recordProjectionDegraded({ at: now(), details: { commandType: command.commandType } });
        }
        observability.recordValidationErrors(result.violations, { at: now(), details: { commandType: command.commandType } });
        observability.recordPressureBacklog(snapshot, { at: now() });
        observability.recordLodDistribution(snapshot, { at: now() });
        return {
          ...result,
          epochEvents: [causalWorldEventToEpochEvent(result.event)],
        };
      } catch (error) {
        const validationError = toValidationError(error);
        observability.recordReject({ at: now(), code: validationError.code, details: { commandType: command.commandType } });
        observability.recordValidationErrors([validationError], { at: now(), details: { commandType: command.commandType } });
        throw error;
      }
    },
    snapshot: () => snapshot,
    checkpoint: () => causalCheckpointMetadata(snapshot, { createdAt: now() }),
    migrate(inputSnapshot, dryRun = false) {
      const output = migrateCausalSnapshot({
        snapshot: inputSnapshot ?? snapshot,
        worldId: options.worldId,
        dryRun,
        nowMs: options.nowMs,
      });
      observability.recordMigration(output.report, { at: now() });
      if (output.snapshot && !dryRun) snapshot = output.snapshot;
      return output;
    },
    health: () => observability.snapshot(options.healthThresholds),
    events: () => [...eventLog.values()].sort((left, right) =>
      left.recordedAt.localeCompare(right.recordedAt) || left.eventId.localeCompare(right.eventId)),
    resultForIdempotencyKey: (idempotencyKey) => resultsByIdempotencyKey.get(idempotencyKey),
    drain: () => coordinator.drain(),
  };
}

function normalizeRuntimeCommand(
  input: InfiniteWorldCommandV1 | CommandIntentV1 | unknown,
  now: () => string,
  idFactory: CreateInfiniteWorldRuntimeOptions["idFactory"],
  defaultWorldId: string,
): CommandIntentV1 {
  if (!isCausalRecord(input)) throw new CausalValidationError("CAUSAL_SCHEMA_INVALID", { field: "command" });
  if (!KNOWN_COMMAND_TYPES.has(String(input.commandType))) {
    throw new CausalValidationError("CAUSAL_SCHEMA_UNKNOWN", { commandType: input.commandType });
  }
  const payload = assertRecord(input.payload, "payload");
  const commandId = typeof input.commandId === "string" && input.commandId
    ? input.commandId
    : (idFactory || defaultIdFactory)("command", {
      commandType: String(input.commandType),
      worldId: typeof input.worldId === "string" ? input.worldId : defaultWorldId,
      idempotencyKey: typeof input.idempotencyKey === "string" ? input.idempotencyKey : "",
    });
  const runtimeParentEventIds = stringArray(input.causalParentEventIds);
  const rootReason = typeof input.rootReason === "string"
    ? input.rootReason as CommandIntentV1["rootReason"]
    : runtimeParentEventIds.length > 0
      ? undefined
      : defaultRootReasonForCommand(String(input.commandType));
  const command: CommandIntentV1 = {
    commandId,
    commandType: String(input.commandType),
    commandSchemaVersion: CAUSAL_COMMAND_SCHEMA_VERSION,
    worldId: typeof input.worldId === "string" && input.worldId ? input.worldId : defaultWorldId,
    namespace: namespaceForCommand(String(input.commandType), input.namespace),
    actor: assertActor(input.actor),
    submittedAt: typeof input.submittedAt === "string" ? input.submittedAt : now(),
    ...(typeof input.requestedWorldMinute === "number" ? { requestedWorldMinute: input.requestedWorldMinute } : {}),
    idempotencyKey: typeof input.idempotencyKey === "string" && input.idempotencyKey ? input.idempotencyKey : commandId,
    expectedStreamVersions: Array.isArray(input.expectedStreamVersions) ? input.expectedStreamVersions as CommandIntentV1["expectedStreamVersions"] : [],
    authorizationRefs: stringArray(input.authorizationRefs),
    causalParentEventIds: runtimeParentEventIds,
    rootPressureIds: stringArray(input.rootPressureIds),
    ...(rootReason ? { rootReason } : {}),
    payload: cleanRecord({
      ...payload,
      [RUNTIME_PARENT_EVENT_IDS_FIELD]: runtimeParentEventIds,
    }),
  };
  return command;
}

function runtimeWriteSnapshot(snapshot: CausalWorldSnapshotV1, command: CommandIntentV1) {
  const base = causalWriteSnapshotFromWorldSnapshot(snapshot);
  const projected = projectedBalancesForCommand(command, snapshot);
  if (!projected) return base;
  return {
    ...base,
    balances: {
      balances: {
        ...(base.balances.balances || {}),
        ...projected.balances,
      },
      creditLimits: {
        ...(base.balances.creditLimits || {}),
        ...projected.creditLimits,
      },
    },
  };
}

function projectedBalancesForCommand(command: CommandIntentV1, snapshot: CausalWorldSnapshotV1): {
  readonly balances: Readonly<Record<string, Readonly<Record<string, string>>>>;
  readonly creditLimits: Readonly<Record<string, Readonly<Record<string, string>>>>;
} | undefined {
  const balances: Record<string, Record<string, string>> = {};
  const creditLimits: Record<string, Record<string, string>> = {};
  const addBalance = (accountRef: string, resourceKey: string, unit: string, quantityMinor: string) => {
    balances[accountRef] = {
      ...(balances[accountRef] || {}),
      [`${resourceKey}:${unit}`]: quantityMinor,
      [resourceKey]: quantityMinor,
    };
  };
  const addCreditLimit = (accountRef: string, resourceKey: string, unit: string, quantityMinor: string) => {
    creditLimits[accountRef] = {
      ...(creditLimits[accountRef] || {}),
      [`${resourceKey}:${unit}`]: quantityMinor,
      [resourceKey]: quantityMinor,
    };
  };
  if (command.commandType.startsWith("economy_")) {
    const state = normalizeEconomyState((command.payload as EconomyCommandPayload<unknown>).state);
    for (const account of Object.values(state.accounts)) {
      if (!account) continue;
      for (const balance of account.balances) {
        const resource = state.resources[balance.resourceKey];
        addBalance(`${account.accountRef}#${balance.bucket}`, balance.resourceKey, resource?.unit || "minor_unit", balance.quantityMinor);
      }
      for (const [resourceKey, limit] of Object.entries(account.creditLimits || {})) {
        if (typeof limit !== "string") continue;
        const resource = state.resources[resourceKey];
        addCreditLimit(`${account.accountRef}#available`, resourceKey, resource?.unit || "minor_unit", limit);
      }
    }
  } else if (command.commandType.startsWith("progression_")) {
    const payload = command.payload as ProgressionCommandPayload<Record<string, unknown>>;
    const state = payload.state;
    const input = payload.input;
    const identityId = state?.identityId || stringValue(input.identityId) || "identity";
    if (state) {
      const resources = state.resources || {};
      addBalance(`identity:${identityId}:progression`, "functional_xp", "xp", String(resources.functionalXp || 0));
      addBalance(`identity:${identityId}:skill_tree`, "skill_points", "point", String(Math.max(0, (state.functionalStage + 1) * 3)));
      addBalance(`identity:${identityId}:skill_tree`, "insight_points", "point", String(resources.insightPoints || 0));
      addBalance(`lineage:${state.lineageId || identityId}:progression`, "lineage_marks", "mark", String(resources.lineageMarks || 0));
      for (const material of resources.materials || []) {
        addBalance(`identity:${identityId}:inventory`, `material.${material.materialId}`, "count", String(material.quantity));
      }
    }
    for (const material of [
      ...recordArray(input.preparedMaterials),
      ...recordArray(input.availableMaterials),
    ]) {
      const materialId = stringValue(material.materialId);
      const quantity = numberValue(material.quantity);
      if (materialId && quantity !== undefined) {
        addBalance(`identity:${identityId}:inventory`, `material.${materialId}`, "count", String(quantity));
      }
    }
  } else if (command.commandType === "supernatural_cast") {
    const actor = (command.payload as SupernaturalCastPayload).actorSnapshot;
    for (const [key, quantityMinor] of Object.entries(actor.resourceBalancesMinor)) {
      if (typeof quantityMinor !== "string") continue;
      const [resourceKey, unit] = key.split(":");
      if (resourceKey && unit) addBalance(`account:${actor.actorRef.split(":").pop()}:aether`, resourceKey, unit, quantityMinor);
    }
  } else if (command.commandType === "project_tick") {
    const project = (command.payload as ProjectTickPayload).input.project;
    addBalance(project.treasuryAccountRef, project.treasuryResourceKey, project.treasuryUnit, project.treasuryBalanceMinor);
  }
  return Object.keys(balances).length || Object.keys(creditLimits).length ? { balances, creditLimits } : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function recordArray(value: unknown): readonly Readonly<Record<string, unknown>>[] {
  return Array.isArray(value) ? value.filter(isCausalRecord) : [];
}

function buildRuntimeEvent(
  command: CommandIntentV1,
  context: CausalBuildContext,
  idFactory: (kind: string, input: Readonly<Record<string, unknown>>) => string,
  currentSnapshot: CausalWorldSnapshotV1,
): CausalWorldEventCandidateV1 {
  const proposal = domainProposalFor(command, currentSnapshot);
  const effects = proposal.effects.map((effect) => cleanEffect(effect, command)) as CausalEffectV1[];
  const evidenceRefs = stringArray([
    ...runtimeParentEventIds(command),
    ...effects.flatMap((effect) => effect.sourceEventIds),
  ]);
  return {
    eventId: idFactory("event", {
      commandId: command.commandId,
      commandType: command.commandType,
      inputHash: context.inputHash,
    }),
    eventType: proposal.eventType,
    schemaVersion: CAUSAL_EVENT_SCHEMA_VERSION,
    registryVersion: context.registryVersion,
    registryHash: context.registryHash,
    worldId: command.worldId,
    namespace: proposal.namespace,
    stream: {
      streamType: proposal.namespace,
      streamId: streamIdFor(command, proposal.namespace),
      streamVersion: nextStreamVersion(command),
    },
    occurredAtWorldMinute: command.requestedWorldMinute ?? worldMinuteFromPayload(command.payload),
    recordedAt: context.recordedAt,
    actorRefs: [command.actor],
    subjectRefs: proposal.subjectRefs || [{ entityType: proposal.namespace, entityId: streamIdFor(command, proposal.namespace) }],
    regionRefs: proposal.regionRefs || [],
    command: {
      commandId: command.commandId,
      commandType: command.commandType,
      idempotencyKey: command.idempotencyKey,
      inputHash: context.inputHash,
    },
    causality: {
      causalParentEventIds: command.causalParentEventIds,
      rootPressureIds: command.rootPressureIds,
      ...(command.rootReason ? { rootReason: command.rootReason } : {}),
    },
    authorizationRefs: command.authorizationRefs,
    evidenceRefs,
    visibilityPolicyRef: "visibility:canonical_world",
    versions: {
      rulesetVersion: proposal.rulesetVersion,
      contentVersion: proposal.contentVersion,
      adjudicatorVersion: INFINITE_WORLD_RUNTIME_ADJUDICATOR_VERSION,
    },
    determinism: {
      seed: command.idempotencyKey,
      algorithmId: "infinite_world_runtime_thin_orchestration",
      algorithmVersion: "1",
    },
    payload: cleanRecord({
      ...proposal.payload,
      commandPayload: command.payload,
      warnings: proposal.warnings || [],
    }),
    effects,
  };
}

function domainProposalFor(command: CommandIntentV1, snapshot: CausalWorldSnapshotV1): DomainProposal {
  switch (command.commandType) {
    case "world_tick":
      return worldTickProposal(command, snapshot);
    case "resource_node_register":
      return resourceNodeRegisterProposal(command, snapshot);
    case "resource_production_assign":
      return resourceProductionAssignProposal(command, snapshot);
    case "resource_produce":
      return resourceProduceProposal(command, snapshot);
    case "resource_node_replenish":
      return resourceNodeReplenishProposal(command, snapshot);
    case "life_profile_create":
      return lifeProfileCreateProposal(command);
    case "life_profile_advance":
      return lifeProfileAdvanceProposal(command, snapshot);
    case "mission_settle":
      return missionProposal(command);
    case "economy_buy":
    case "economy_sell":
    case "economy_craft":
    case "economy_repair":
      return economyProposal(command);
    case "progression_reward":
    case "progression_breakthrough":
    case "progression_talent":
    case "progression_skill":
    case "progression_carry":
    case "progression_attribute_evidence":
    case "progression_respec":
      return progressionProposal(command);
    case "governance_action":
      return governanceProposal(command);
    case "supernatural_cast":
      return supernaturalCastProposal(command);
    case "legacy_transition":
      return legacyTransitionProposal(command);
    case "project_tick":
      return projectTickProposal(command);
    case "narrative_settle":
      return narrativeSettleProposal(command);
    case "actor_mind_tick":
      return actorMindTickProposal(command);
    case "actor_goal_select":
      return actorGoalSelectProposal(command);
    case "actor_commitment_update":
      return actorCommitmentUpdateProposal(command);
    default:
      throw new CausalValidationError("CAUSAL_SCHEMA_UNKNOWN", { commandType: command.commandType });
  }
}

function worldTickProposal(command: CommandIntentV1, snapshot: CausalWorldSnapshotV1): DomainProposal {
  const payload = command.payload as WorldTickPayload;
  const currentWorldMinute = payload.currentWorldMinute ?? command.requestedWorldMinute ?? 0;
  const targetWorldMinute = payload.targetWorldMinute ?? command.requestedWorldMinute ?? currentWorldMinute;
  const sourceEventIds = payload.sourceEventIds || command.causalParentEventIds;
  const governanceState = payload.governance || snapshotGovernanceState(snapshot);
  const governanceSignals: readonly EpochWorldPressureFactSignal[] = governanceState
    ? deriveGovernancePressures(governanceState, targetWorldMinute, sourceEventIds || [])
    : [];
  const basePressures = payload.pressures || [];
  const mergedPressures = governanceSignals.length > 0
    ? deriveEpochWorldPressuresFromFactSignals({
      signals: governanceSignals,
      existingPressures: basePressures,
      openedAtWorldMinute: targetWorldMinute,
    })
    : basePressures;
  const pressureResult = advanceEpochWorldPressures({
    pressures: mergedPressures,
    toWorldMinute: targetWorldMinute,
    sourceFactEventIds: sourceEventIds,
  });
  const ecologyResult = payload.ecology ? advanceEcologyTick(payload.ecology) : undefined;
  rejectIf(ecologyResult?.status === "rejected", ecologyResult?.errors, "world_tick.ecology");
  const lifeAdvances = payload.processLifeProfiles === false
    ? []
    : snapshot.domains.lifeProfiles
      .filter((profile) => profile.state.worldMinute < targetWorldMinute)
      .map((profile) => ({
        profileId: profile.profileId,
        state: advanceLifeProfile({ state: profile.state, toWorldMinute: targetWorldMinute }),
        previousDeltaCount: profile.state.resourceDeltas.length,
      }));
  return {
    eventType: "ecology_tick_resolved",
    namespace: "world",
    rulesetVersion: `${EPOCH_WORLD_PRESSURE_RULE_VERSION}+${EPOCH_GOVERNANCE_ECOLOGY_RULE_VERSION}`,
    contentVersion: "world-runtime-content.v1",
    effects: [
      worldTickEffect(command, targetWorldMinute),
      ...(ecologyResult?.effects || []),
      ...lifeAdvances.flatMap((profile) =>
        lifeProfileEffects(profile.state, command.authorizationRefs, profile.previousDeltaCount)),
    ],
    payload: cleanRecord({ pressureResult, ecologyResult, governanceSignals, lifeAdvances }),
    subjectRefs: [{ entityType: "world", entityId: command.worldId }],
  };
}

function resourceNodeRegisterProposal(command: CommandIntentV1, snapshot: CausalWorldSnapshotV1): DomainProposal {
  const input = (command.payload as ResourceNodeRegisterPayload).input;
  const registry = registryFromSnapshot(snapshot);
  const next = registerResourceProductionNode(registry, input);
  const node = next.nodes[input.nodeId]!;
  return {
    eventType: "resource_node_registered",
    namespace: "world",
    rulesetVersion: "resource-production-runtime.v1",
    contentVersion: "world-runtime-content.v1",
    effects: [{
      effectId: `resource_node_register:${node.nodeId}`,
      effectType: "resource_ledger",
      targetRef: { entityType: "resource_node", entityId: node.nodeId },
      operation: "resource_node_register",
      after: {
        resourceKey: node.resourceKey,
        resourceClass: node.resourceClass,
        unit: node.unit,
        entries: [{ accountRef: resourceNodeInventoryAccountRef(node.nodeId), quantityMinor: node.remainingUnits }],
        creationSourceRef: CAUSAL_RESOURCE_SOURCE_REFS.resourceNodeRegistration,
      },
      sourceEventIds: [command.commandId],
      authorizationRefs: command.authorizationRefs,
    }],
    payload: { node: resourceNodeSnapshotPayload(node) },
    subjectRefs: [{ entityType: "resource_node", entityId: node.nodeId }],
  };
}

function resourceProductionAssignProposal(command: CommandIntentV1, snapshot: CausalWorldSnapshotV1): DomainProposal {
  const input = (command.payload as ResourceProductionAssignPayload).input;
  const assignment = assignResourceProduction(registryFromSnapshot(snapshot), input);
  const assignmentForSnapshot = resourceProductionAssignmentSnapshotPayload(
    assignment,
    nextResourceProductionSlotIndex(snapshot, assignment.nodeId),
  );
  const assignmentEffect = resourceProductionPredicateEffect(
    `resource_assignment:${assignment.assignmentId}`,
    assignment.nodeId,
    "resource_production_assign",
    assignment.assignedAtWorldTime,
    command.authorizationRefs,
  );
  return {
    eventType: "resource_production_assigned",
    namespace: "world",
    rulesetVersion: "resource-production-runtime.v1",
    contentVersion: "world-runtime-content.v1",
    effects: [assignmentEffect],
    payload: { assignment: assignmentForSnapshot },
    subjectRefs: [{ entityType: "resource_node", entityId: assignment.nodeId }],
  };
}

function resourceProduceProposal(command: CommandIntentV1, snapshot: CausalWorldSnapshotV1): DomainProposal {
  const payload = command.payload as ResourceProducePayload;
  const proposal = produceResource({
    registry: registryFromSnapshot(snapshot),
    assignments: snapshot.domains.resourceProductionAssignments,
    nodeId: payload.nodeId,
    resourceKey: payload.resourceKey,
    targetAccountRef: payload.targetAccountRef,
    worldTime: command.requestedWorldMinute ?? worldMinuteFromPayload(command.payload),
    sourceEventIds: payload.sourceEventIds,
    authorizationRefs: payload.authorizationRefs || command.authorizationRefs,
    effectId: payload.effectId,
  });
  return {
    eventType: "resource_production_committed",
    namespace: "world",
    rulesetVersion: proposal.rulesetVersion,
    contentVersion: "world-runtime-content.v1",
    effects: proposal.effects,
    payload: proposal as unknown as Readonly<Record<string, unknown>>,
    subjectRefs: [{ entityType: "resource_node", entityId: proposal.node.nodeId }],
  };
}

function resourceNodeReplenishProposal(command: CommandIntentV1, snapshot: CausalWorldSnapshotV1): DomainProposal {
  const input = (command.payload as ResourceNodeReplenishPayload).input;
  const registry = registryFromSnapshot(snapshot);
  const before = registry.nodes[input.nodeId];
  const next = replenishResourceNode({ registry, ...input });
  const node = next.nodes[input.nodeId]!;
  const delta = String(BigInt(node.remainingUnits) - BigInt(before?.remainingUnits || "0"));
  return {
    eventType: "resource_node_replenished",
    namespace: "world",
    rulesetVersion: "resource-production-runtime.v1",
    contentVersion: "world-runtime-content.v1",
    effects: [
      resourceProductionPredicateEffect(
        `resource_node_replenish_state:${node.nodeId}:${input.worldTime}`,
        node.nodeId,
        "resource_node_replenish",
        input.worldTime,
        command.authorizationRefs,
      ),
      ...(delta === "0" ? [] : [{
      effectId: `resource_node_replenish:${node.nodeId}:${input.worldTime}`,
      effectType: "resource_ledger",
      targetRef: { entityType: "resource_node", entityId: node.nodeId },
      operation: "resource_node_replenish",
      after: {
        resourceKey: node.resourceKey,
        resourceClass: node.resourceClass,
        unit: node.unit,
        entries: [{ accountRef: resourceNodeInventoryAccountRef(node.nodeId), quantityMinor: delta }],
        creationSourceRef: CAUSAL_RESOURCE_SOURCE_REFS.resourceNodeReplenish,
      },
      sourceEventIds: [command.commandId],
      authorizationRefs: command.authorizationRefs,
    } as CausalEffectV1]),
    ],
    payload: { node: resourceNodeSnapshotPayload(node) },
    subjectRefs: [{ entityType: "resource_node", entityId: node.nodeId }],
  };
}

function lifeProfileCreateProposal(command: CommandIntentV1): DomainProposal {
  const payload = command.payload as LifeProfileCreatePayload;
  const state = createLifeProfile(payload.input);
  const errors = validateLifeProfile(state);
  rejectIf(errors.length > 0, errors, "life_profile_create");
  return {
    eventType: "life_profile_created",
    namespace: "identity",
    rulesetVersion: "life-profile-runtime.v1",
    contentVersion: "world-runtime-content.v1",
    effects: [
      lifeProfilePredicateEffect(`life_profile_create:${payload.profileId}`, payload.profileId, state.worldMinute, command.authorizationRefs),
      ...lifeProfileInitialEffects(state, command.authorizationRefs),
    ],
    payload: { profileId: payload.profileId, state },
    subjectRefs: state.actors.map((actor) => ({ entityType: "actor", entityId: actor.actorRef })),
  };
}

function lifeProfileAdvanceProposal(command: CommandIntentV1, snapshot: CausalWorldSnapshotV1): DomainProposal {
  const payload = command.payload as LifeProfileAdvancePayload;
  const current = snapshot.domains.lifeProfiles.find((profile) => profile.profileId === payload.profileId)?.state;
  if (!current) throw new CausalValidationError("CAUSAL_SCHEMA_INVALID", { field: "profileId", reason: "life_profile_not_found" });
  const state = advanceLifeProfile({ state: current, toWorldMinute: payload.toWorldMinute });
  const errors = validateLifeProfile(state);
  rejectIf(errors.length > 0, errors, "life_profile_advance");
  const newDeltas = state.resourceDeltas.slice(current.resourceDeltas.length);
  const newConsequences = state.consequences.slice(current.consequences.length);
  return {
    eventType: "life_profile_advanced",
    namespace: "identity",
    rulesetVersion: "life-profile-runtime.v1",
    contentVersion: "world-runtime-content.v1",
    effects: [
      lifeProfilePredicateEffect(`life_profile_advance:${payload.profileId}:${payload.toWorldMinute}`, payload.profileId, payload.toWorldMinute, command.authorizationRefs),
      ...lifeProfileEffects(state, command.authorizationRefs, current.resourceDeltas.length),
    ],
    payload: {
      profileId: payload.profileId,
      state,
      audit: {
        resourceDeltas: newDeltas,
        consequences: newConsequences,
        workedMinutes: workedMinutes(newDeltas),
        studiedMinutes: studiedMinutes(current, state),
        shortageCount: newConsequences.filter((item) => item.kind === "resource_shortage" || item.kind === "debt").length,
        bodyMind: state.actors.map((actor) => ({ actorRef: actor.actorRef, body: actor.body, mind: actor.mind })),
      },
    },
    subjectRefs: state.actors.map((actor) => ({ entityType: "actor", entityId: actor.actorRef })),
  };
}

function missionProposal(command: CommandIntentV1): DomainProposal {
  const input = (command.payload as MissionSettlePayload).input;
  const proposal = proposeMissionConsequences(input);
  return {
    eventType: "mission_outcome_settled",
    namespace: "run",
    rulesetVersion: proposal.rulesetVersion,
    contentVersion: "mission-content.v1",
    effects: proposal.causalEffects,
    payload: proposal as unknown as Readonly<Record<string, unknown>>,
    subjectRefs: [{ entityType: "mission", entityId: input.contract.contractId }],
  };
}

function economyProposal(command: CommandIntentV1): DomainProposal {
  const payload = command.payload as EconomyCommandPayload<EconomyPurchaseInput | EconomySellInput | EconomyCraftInput | EconomyRepairInput>;
  const state = normalizeEconomyState(payload.state);
  let result:
    | ReturnType<typeof proposeEconomyPurchase>
    | ReturnType<typeof proposeEconomySale>
    | ReturnType<typeof proposeEconomyCraft>
    | ReturnType<typeof proposeEconomyRepair>;
  if (command.commandType === "economy_buy") result = proposeEconomyPurchase(state, payload.input as EconomyPurchaseInput);
  else if (command.commandType === "economy_sell") result = proposeEconomySale(state, payload.input as EconomySellInput);
  else if (command.commandType === "economy_craft") result = proposeEconomyCraft(state, payload.input as EconomyCraftInput);
  else result = proposeEconomyRepair(state, payload.input as EconomyRepairInput);
  if (!result.ok) {
    throw new CausalValidationError("CAUSAL_SCHEMA_INVALID", { field: command.commandType, errors: result.errors });
  }
  const value = result.value as EconomyEffectProposal;
  return {
    eventType: command.commandType === "economy_craft" ? "crafting_job_resolved" : "economy_transaction_committed",
    namespace: "world",
    rulesetVersion: UNIFIED_ECONOMY_RULESET_VERSION,
    contentVersion: UNIFIED_ECONOMY_CONTENT_VERSION,
    effects: value.effects,
    payload: value as unknown as Readonly<Record<string, unknown>>,
    warnings: result.warnings.map((warning) => warning.code),
  };
}

function normalizeEconomyState(state: UnifiedEconomyState): UnifiedEconomyState {
  const resources = Object.fromEntries(Object.entries(state.resources).map(([resourceKey, resource]) => [
    resourceKey,
    resource && normalizeEconomyResource(resource),
  ]));
  const accounts = state.accounts[UNIFIED_ECONOMY_DEFAULT_FEE_ACCOUNT_REF]
    ? state.accounts
    : {
      ...state.accounts,
      [UNIFIED_ECONOMY_DEFAULT_FEE_ACCOUNT_REF]: {
        accountRef: UNIFIED_ECONOMY_DEFAULT_FEE_ACCOUNT_REF,
        ownerRef: "market:fee_collector",
        balances: [],
      },
    };
  const recipes = state.recipes
    ? Object.fromEntries(Object.entries(state.recipes).map(([recipeId, recipe]) => [
      recipeId,
      recipe && normalizeEconomyRecipe(recipe as unknown as Readonly<Record<string, unknown>>),
    ]))
    : state.recipes;
  return {
    ...state,
    resources,
    accounts,
    ...(recipes ? { recipes } : {}),
  };
}

function normalizeEconomyResource(resource: UnifiedEconomyState["resources"][string]) {
  if (!resource) return resource;
  const catalog = DEFAULT_ECONOMY_RESOURCES[resource.resourceKey];
  if (!catalog) return resource;
  return {
    ...catalog,
    ...resource,
    basePriceMinor: resource.basePriceMinor === "1" && catalog.basePriceMinor !== "1"
      ? catalog.basePriceMinor
      : resource.basePriceMinor,
    priceFloorMinor: resource.basePriceMinor === "1" && catalog.basePriceMinor !== "1"
      ? catalog.priceFloorMinor
      : resource.priceFloorMinor,
    priceCeilingMinor: resource.basePriceMinor === "1" && catalog.basePriceMinor !== "1"
      ? catalog.priceCeilingMinor
      : resource.priceCeilingMinor,
  };
}

function normalizeEconomyRecipe(recipe: Readonly<Record<string, unknown>>) {
  const inputMaterials = Array.isArray(recipe.requiredMaterials)
    ? recipe.requiredMaterials
    : Array.isArray(recipe.inputs)
      ? recipe.inputs
      : [];
  const byproduct = Array.isArray(recipe.byproducts)
    ? recipe.byproducts.find((entry): entry is Readonly<Record<string, unknown>> => isCausalRecord(entry))
    : undefined;
  return cleanRecord({
    ...recipe,
    discipline: typeof recipe.discipline === "string" ? recipe.discipline : "forging",
    outputQuantityMinor: typeof recipe.outputQuantityMinor === "string" ? recipe.outputQuantityMinor : "1",
    requiredMaterials: inputMaterials,
    minimumSkill: typeof recipe.minimumSkill === "number" ? recipe.minimumSkill : recipe.requiredSkill,
    baseFailureBasisPoints: typeof recipe.baseFailureBasisPoints === "string" ? recipe.baseFailureBasisPoints : "800",
    byproductResourceKey: typeof recipe.byproductResourceKey === "string" ? recipe.byproductResourceKey : byproduct?.resourceKey,
    byproductQuantityMinor: typeof recipe.byproductQuantityMinor === "string" ? recipe.byproductQuantityMinor : byproduct?.quantityMinor,
    repairDurabilityGain: recipe.repairDurabilityGain ?? (String(recipe.recipeId).startsWith("repair_") ? 25 : undefined),
  }) as unknown as EconomyCraftRecipe;
}

function cleanEffect(effect: CausalEffectV1, command: CommandIntentV1): CausalEffectV1 {
  const cleaned = cleanValue(effect) as CausalEffectV1;
  return cleaned.sourceEventIds.length > 0
    ? cleaned
    : { ...cleaned, sourceEventIds: [command.commandId] };
}

function progressionProposal(command: CommandIntentV1): DomainProposal {
  const payload = command.payload as ProgressionCommandPayload<
    RunRewardConversionInput | BreakthroughAttemptInput | TalentAllocationInput | SkillUnlockInput | ExpandCarryInput | AttributeEvidenceInput | RespecInput
  >;
  let proposal: ProgressionProposal;
  if (command.commandType === "progression_reward") proposal = convertRunReward(payload.input as RunRewardConversionInput);
  else {
    const state = payload.state;
    if (!state) throw new CausalValidationError("CAUSAL_SCHEMA_INVALID", { field: "payload.state" });
    if (command.commandType === "progression_breakthrough") proposal = proposeBreakthrough(state, payload.input as BreakthroughAttemptInput);
    else if (command.commandType === "progression_talent") proposal = proposeTalentAllocation(state, payload.input as TalentAllocationInput);
    else if (command.commandType === "progression_skill") proposal = proposeSkillUnlock(state, payload.input as SkillUnlockInput);
    else if (command.commandType === "progression_attribute_evidence") proposal = proposeAttributeEvidence(state, payload.input as AttributeEvidenceInput);
    else if (command.commandType === "progression_respec") proposal = proposeRespec(state, payload.input as RespecInput);
    else proposal = proposeExpandCarry(state, payload.input as ExpandCarryInput);
  }
  rejectIf(!proposal.ok, proposal.errors, command.commandType);
  return {
    eventType: "progression_change_committed",
    namespace: proposal.namespace,
    rulesetVersion: PROGRESSION_RULESET_VERSION,
    contentVersion: PROGRESSION_CONTENT_VERSION,
    effects: proposal.effects,
    payload: proposal as unknown as Readonly<Record<string, unknown>>,
  };
}

function narrativeSettleProposal(command: CommandIntentV1): DomainProposal {
  const payload = command.payload as { readonly input: SettleNarrativeCandidateInput };
  const result = settleNarrativeCandidate(payload.input);
  rejectIf(result.errors.length > 0, result.errors, "narrative_settle");
  return {
    eventType: "narrative_settlement_committed",
    namespace: "world",
    rulesetVersion: EPOCH_CAUSAL_NARRATIVE_RULE_VERSION,
    contentVersion: "causal-narrative-content.v1",
    effects: result.effects,
    payload: result as unknown as Readonly<Record<string, unknown>>,
  };
}

function governanceProposal(command: CommandIntentV1): DomainProposal {
  const payload = command.payload as GovernanceActionPayload;
  const result = applyGovernanceAction({ state: payload.state, action: payload.action });
  rejectIf(result.status === "rejected", result.errors, "governance_action");
  return {
    eventType: "governance_action_resolved",
    namespace: "world",
    rulesetVersion: EPOCH_GOVERNANCE_ECOLOGY_RULE_VERSION,
    contentVersion: "governance-ecology-content.v1",
    effects: result.effects,
    payload: result as unknown as Readonly<Record<string, unknown>>,
    subjectRefs: [{ entityType: "governance_action", entityId: result.actionId }],
  };
}

function supernaturalCastProposal(command: CommandIntentV1): DomainProposal {
  const payload = command.payload as SupernaturalCastPayload;
  const result = evaluateSupernaturalCast({
    actor: payload.actorSnapshot,
    intent: payload.intent,
    capabilities: payload.capabilities,
  });
  rejectIf(!result.ok, result.errors, "supernatural_cast");
  return {
    eventType: "supernatural_action_resolved",
    namespace: "world",
    rulesetVersion: SUPERNATURAL_LEGACY_RULESET_VERSION,
    contentVersion: "supernatural-legacy-content.v1",
    effects: result.value?.effects.map((effect) => effect.causalEffect) || [],
    payload: result as unknown as Readonly<Record<string, unknown>>,
    warnings: result.warnings,
    subjectRefs: [{ entityType: "supernatural_actor", entityId: payload.actorSnapshot.actorRef }],
  };
}

function legacyTransitionProposal(command: CommandIntentV1): DomainProposal {
  const payload = command.payload as LegacyTransitionPayload;
  const result = settleMortalityAndLegacy({ snapshot: payload.snapshot, intent: payload.intent });
  rejectIf(!result.ok, result.errors, "legacy_transition");
  return {
    eventType: "legacy_cycle_changed",
    namespace: "lineage",
    rulesetVersion: SUPERNATURAL_LEGACY_RULESET_VERSION,
    contentVersion: "supernatural-legacy-content.v1",
    effects: result.value?.effects.map((effect) => effect.causalEffect) || [],
    payload: result as unknown as Readonly<Record<string, unknown>>,
    warnings: result.warnings,
    subjectRefs: [{ entityType: "identity", entityId: payload.snapshot.identityRef }],
  };
}

function projectTickProposal(command: CommandIntentV1): DomainProposal {
  const result = advanceLegacyProject((command.payload as ProjectTickPayload).input);
  rejectIf(!result.ok, result.errors, "project_tick");
  return {
    eventType: "enterprise_tick_resolved",
    namespace: "world",
    rulesetVersion: SUPERNATURAL_LEGACY_RULESET_VERSION,
    contentVersion: "supernatural-legacy-content.v1",
    effects: result.value?.effects.map((effect) => effect.causalEffect) || [],
    payload: result as unknown as Readonly<Record<string, unknown>>,
    warnings: result.warnings,
  };
}

function actorMindTickProposal(command: CommandIntentV1): DomainProposal {
  const payload = command.payload as ActorMindTickPayload;
  const actorMind = payload.actorMind;
  const selection = selectActorGoals(actorMind, payload.goalCandidates, payload.config);
  const updatedMind: ActorMind = {
    ...actorMind,
    activeGoals: selection.activeGoals,
    queuedGoals: selection.queuedGoals,
  };
  return {
    eventType: "actor_mind_updated",
    namespace: "identity",
    rulesetVersion: "actor-mind-runtime.v1",
    contentVersion: "actor-mind-content.v1",
    effects: [
      actorMindPredicateEffect(`actor_mind_tick:${actorMind.actorRef}`, actorMind.actorRef, command.authorizationRefs),
    ],
    payload: { actorRef: actorMind.actorRef, mind: updatedMind, selection },
    subjectRefs: [{ entityType: "actor", entityId: actorMind.actorRef }],
  };
}

function actorGoalSelectProposal(command: CommandIntentV1): DomainProposal {
  const payload = command.payload as ActorGoalSelectPayload;
  const actorMind = payload.actorMind;
  const goal = payload.goal;
  const activeGoals = [...actorMind.activeGoals.filter((existing) => existing.goalRef !== goal.goalRef), goal]
    .sort((left, right) => right.score - left.score || left.goalRef.localeCompare(right.goalRef));
  const queuedGoals = actorMind.queuedGoals.filter((existing) => existing.goalRef !== goal.goalRef);
  const updatedMind: ActorMind = {
    ...actorMind,
    activeGoals,
    queuedGoals,
  };
  const proposal = payload.actionProposalInput
    ? actionProposal(payload.actionProposalInput)
    : undefined;
  const conflictingCommitmentRefs = commitmentConflictRefs(actorMind.commitments, {
    goalRef: goal.goalRef,
    label: goal.label,
    needRefs: [],
    valueRefs: [],
    roleDutyRefs: [],
    relationshipDutyRefs: [],
    commitmentRefs: [],
    beliefRefs: goal.supportingBeliefRefs,
    expectedGain: 0,
    identityFit: 0,
    urgency: 0,
    feasibility: 0,
    expectedRisk: 0,
    resourceCost: 0,
    legalCost: 0,
  });
  return {
    eventType: "actor_goal_committed",
    namespace: "identity",
    rulesetVersion: "actor-mind-runtime.v1",
    contentVersion: "actor-mind-content.v1",
    effects: [
      actorMindPredicateEffect(`actor_goal_select:${actorMind.actorRef}:${goal.goalRef}`, actorMind.actorRef, command.authorizationRefs),
    ],
    payload: cleanRecord({
      actorRef: actorMind.actorRef,
      mind: updatedMind,
      goal,
      proposal,
      conflictingCommitmentRefs,
    }),
    subjectRefs: [{ entityType: "actor", entityId: actorMind.actorRef }],
    warnings: conflictingCommitmentRefs.length > 0 ? ["commitment_conflict_detected"] : undefined,
  };
}

function actorCommitmentUpdateProposal(command: CommandIntentV1): DomainProposal {
  const payload = command.payload as ActorCommitmentUpdatePayload;
  const actorMind = payload.actorMind;
  const commitmentIndex = actorMind.commitments.findIndex(
    (commitment) => commitment.commitmentRef === payload.commitmentRef,
  );
  if (commitmentIndex < 0) {
    throw new CausalValidationError("CAUSAL_SCHEMA_INVALID", {
      field: "commitmentRef",
      reason: "commitment_not_found",
    });
  }
  const updatedCommitments = actorMind.commitments.map((commitment, index) =>
    index === commitmentIndex ? { ...commitment, status: payload.status } : commitment,
  );
  const updatedMind: ActorMind = {
    ...actorMind,
    commitments: updatedCommitments,
  };
  return {
    eventType: "actor_commitment_updated",
    namespace: "identity",
    rulesetVersion: "actor-mind-runtime.v1",
    contentVersion: "actor-mind-content.v1",
    effects: [
      actorMindPredicateEffect(`actor_commitment_update:${actorMind.actorRef}:${payload.commitmentRef}`, actorMind.actorRef, command.authorizationRefs),
    ],
    payload: {
      actorRef: actorMind.actorRef,
      mind: updatedMind,
      commitmentRef: payload.commitmentRef,
      status: payload.status,
    },
    subjectRefs: [{ entityType: "actor", entityId: actorMind.actorRef }],
  };
}

function actorMindPredicateEffect(
  effectId: string,
  actorRef: string,
  authorizationRefs: readonly string[],
): CausalEffectV1 {
  return {
    effectId,
    effectType: "world_predicate",
    targetRef: { entityType: "actor", entityId: actorRef },
    operation: "actor_mind_state_persisted",
    after: {
      predicateId: effectId,
      subjectRef: { entityType: "actor", entityId: actorRef },
      operator: "eq",
      expectedValue: 1,
      evaluationStatus: "true",
      evaluatedAtWorldMinute: 0,
    },
    sourceEventIds: [effectId],
    authorizationRefs,
  };
}

function snapshotGovernanceState(snapshot: CausalWorldSnapshotV1): GovernanceState | undefined {
  return snapshot.domains.governanceState;
}

function registryFromSnapshot(snapshot: CausalWorldSnapshotV1): ResourceProductionRegistry {
  return {
    ...emptyResourceProductionRegistry(),
    nodes: Object.fromEntries(snapshot.domains.resourceProductionNodes.map((node) => [node.nodeId, node])),
  };
}

function resourceNodeSnapshotPayload(node: ResourceProductionNode): Readonly<Record<string, unknown>> {
  return {
    ...node,
    capacity: Number(node.capacity),
    remaining: Number(node.remainingUnits),
    yield: Number(node.yieldPerWorkUnit),
  };
}

function resourceProductionAssignmentSnapshotPayload(
  assignment: ResourceProductionAssignment,
  fallbackSlotIndex = 0,
): Readonly<Record<string, unknown>> {
  return {
    ...assignment,
    slotIndex: fallbackSlotIndex,
  };
}

function nextResourceProductionSlotIndex(snapshot: CausalWorldSnapshotV1, nodeId: string): number {
  const node = snapshot.domains.resourceProductionNodes.find((item) => item.nodeId === nodeId) as Readonly<Record<string, unknown>> | undefined;
  const workerSlots = Number(node?.workerSlots ?? 0);
  const occupied = new Set(snapshot.domains.resourceProductionAssignments
    .filter((assignment) => assignment.nodeId === nodeId)
    .map((assignment) => {
      const record = assignment as unknown as Readonly<Record<string, unknown>>;
      return record.slotIndex ?? record.workerSlot;
    })
    .filter((slot): slot is number => Number.isInteger(slot)));
  for (let slotIndex = 0; slotIndex < workerSlots; slotIndex += 1) {
    if (!occupied.has(slotIndex)) return slotIndex;
  }
  return 0;
}

function resourceProductionPredicateEffect(
  effectId: string,
  nodeId: string,
  operation: string,
  worldMinute: number,
  authorizationRefs: readonly string[],
): CausalEffectV1 {
  return {
    effectId,
    effectType: "world_predicate",
    targetRef: { entityType: "resource_node", entityId: nodeId },
    operation,
    after: {
      predicateId: effectId,
      subjectRef: { entityType: "resource_node", entityId: nodeId },
      operator: "eq",
      expectedValue: 1,
      evaluationStatus: "true",
      evaluatedAtWorldMinute: worldMinute,
    },
    sourceEventIds: [effectId],
    authorizationRefs,
  };
}

function lifeProfileInitialEffects(state: LifeProfileState, authorizationRefs: readonly string[]): readonly CausalEffectV1[] {
  const effects: CausalEffectV1[] = [];
  for (const household of state.households) {
    for (const [resourceKey, quantity] of Object.entries(household.resources) as [LifeProfileResourceKey, number][]) {
      if (quantity <= 0) continue;
      effects.push(lifeProfileCreationEffect(`life_initial:${household.householdRef}:${resourceKey}`, household.resourceAccountRef, resourceKey, quantity, authorizationRefs));
    }
  }
  for (const [accountRef, resources] of Object.entries(state.externalAccounts)) {
    for (const [resourceKey, quantity] of Object.entries(resources) as [LifeProfileResourceKey, number][]) {
      if (quantity <= 0) continue;
      effects.push(lifeProfileCreationEffect(`life_initial:${accountRef}:${resourceKey}`, accountRef, resourceKey, quantity, authorizationRefs));
    }
  }
  return effects;
}

function lifeProfilePredicateEffect(
  effectId: string,
  profileId: string,
  worldMinute: number,
  authorizationRefs: readonly string[],
): CausalEffectV1 {
  return {
    effectId,
    effectType: "world_predicate",
    targetRef: { entityType: "life_profile", entityId: profileId },
    operation: "life_profile_state_persisted",
    after: {
      predicateId: effectId,
      subjectRef: { entityType: "life_profile", entityId: profileId },
      operator: "eq",
      expectedValue: 1,
      evaluationStatus: "true",
      evaluatedAtWorldMinute: worldMinute,
    },
    sourceEventIds: [effectId],
    authorizationRefs,
  };
}

function lifeProfileCreationEffect(
  effectId: string,
  accountRef: string,
  resourceKey: LifeProfileResourceKey,
  quantity: number,
  authorizationRefs: readonly string[],
): CausalEffectV1 {
  return {
    effectId,
    effectType: "resource_ledger",
    targetRef: { entityType: "life_profile_account", entityId: accountRef },
    operation: "life_profile_initial_balance",
    after: {
      resourceKey,
      resourceClass: "life_profile",
      unit: lifeProfileResourceUnit(resourceKey),
      entries: [{ accountRef, quantityMinor: String(quantity) }],
      creationSourceRef: CAUSAL_RESOURCE_SOURCE_REFS.lifeProfileInitialBalance,
    },
    sourceEventIds: [effectId],
    authorizationRefs,
  };
}

function lifeProfileEffects(
  state: LifeProfileState,
  authorizationRefs: readonly string[],
  startDeltaIndex = 0,
): readonly CausalEffectV1[] {
  return state.resourceDeltas.slice(startDeltaIndex).map((delta) => ({
    effectId: delta.deltaId,
    effectType: "resource_ledger",
    targetRef: {
      entityType: delta.actorRef ? "actor" : "household",
      entityId: delta.actorRef || delta.householdRef || delta.deltaId,
    },
    operation: `life_profile_${delta.reason}`,
    after: {
      resourceKey: delta.resourceKey,
      resourceClass: "life_profile",
      unit: delta.unit,
      entries: [
        { accountRef: delta.fromAccountRef, quantityMinor: `-${String(delta.quantity)}` },
        { accountRef: delta.toAccountRef, quantityMinor: String(delta.quantity) },
      ],
    },
    sourceEventIds: [delta.deltaId],
    authorizationRefs,
  }));
}

function lifeProfileResourceUnit(resourceKey: LifeProfileResourceKey): string {
  switch (resourceKey) {
    case "money":
      return "minor";
    case "food":
      return "portion";
    case "water":
      return "liter";
    case "tuition_credit":
      return "credit";
    case "skill_material":
      return "material";
  }
}

function workedMinutes(deltas: readonly LifeProfileResourceDelta[]): number {
  return deltas
    .filter((delta) => delta.reason === "wage")
    .reduce((sum, delta) => sum + delta.quantity, 0);
}

function studiedMinutes(before: LifeProfileState, after: LifeProfileState): number {
  const beforeMinutes = new Map(before.actors.flatMap((actor) =>
    actor.skills.map((skill) => [`${actor.actorRef}:${skill.skillRef}`, skill.studiedWorldMinutes] as const)));
  return after.actors.flatMap((actor) =>
    actor.skills.map((skill) => skill.studiedWorldMinutes - (beforeMinutes.get(`${actor.actorRef}:${skill.skillRef}`) || 0)))
    .reduce((sum, minutes) => sum + Math.max(0, minutes), 0);
}

function namespaceForCommand(commandType: string, namespace: unknown): CausalNamespace {
  if (namespace === "world" || namespace === "lineage" || namespace === "identity" || namespace === "run") return namespace;
  if (commandType === "mission_settle") return "run";
  if (commandType === "legacy_transition" || commandType === "progression_carry") return "lineage";
  if (commandType.startsWith("progression_") || commandType.startsWith("life_profile_") || commandType.startsWith("actor_")) return "identity";
  return "world";
}

function defaultRootReasonForCommand(commandType: string): CommandIntentV1["rootReason"] {
  return commandType === "world_tick" ? "deterministic_schedule" : "external_verified_input";
}

function runtimeParentEventIds(command: CommandIntentV1): readonly string[] {
  return stringArray(command.payload[RUNTIME_PARENT_EVENT_IDS_FIELD]);
}

function nextStreamVersion(command: CommandIntentV1): number {
  const expected = command.expectedStreamVersions[0]?.expectedVersion;
  return typeof expected === "number" ? expected : 1;
}

function streamIdFor(command: CommandIntentV1, namespace: CausalNamespace): string {
  const payload = command.payload;
  if (typeof payload.streamId === "string" && payload.streamId) return payload.streamId;
  if (namespace === "identity" && "state" in payload && isCausalRecord(payload.state) && typeof payload.state.identityId === "string") {
    return payload.state.identityId;
  }
  return command.worldId;
}

function worldMinuteFromPayload(payload: Readonly<Record<string, unknown>>): number {
  for (const key of ["targetWorldMinute", "worldMinute", "occurredAtWorldMinute", "toWorldMinute"]) {
    if (typeof payload[key] === "number" && Number.isSafeInteger(payload[key])) return Number(payload[key]);
  }
  const input = payload.input;
  if (isCausalRecord(input)) return worldMinuteFromPayload(input);
  return 0;
}

function rejectIf(condition: boolean, errors: unknown, field: string): void {
  if (!condition) return;
  throw new CausalValidationError("CAUSAL_SCHEMA_INVALID", { field, errors });
}

function toValidationError(error: unknown): CausalValidationError {
  return error instanceof CausalValidationError
    ? error
    : new CausalValidationError("CAUSAL_SCHEMA_INVALID", {}, error);
}

function assertRecord(value: unknown, field: string): Readonly<Record<string, unknown>> {
  if (!isCausalRecord(value)) throw new CausalValidationError("CAUSAL_SCHEMA_INVALID", { field });
  return value;
}

function assertActor(value: unknown): CausalActorRef {
  if (!isCausalRecord(value) || typeof value.actorType !== "string" || typeof value.actorId !== "string") {
    throw new CausalValidationError("CAUSAL_SCHEMA_INVALID", { field: "actor" });
  }
  return {
    actorType: value.actorType as CausalActorRef["actorType"],
    actorId: value.actorId,
  };
}

function stringArray(value: unknown): readonly string[] {
  return Array.isArray(value)
    ? [...new Set(value.filter((entry): entry is string => typeof entry === "string" && entry.length > 0))].sort()
    : [];
}

function cleanRecord(record: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> {
  return cleanValue(record) as Readonly<Record<string, unknown>>;
}

function cleanValue(value: unknown): unknown {
  if (value === undefined) return undefined;
  if (Array.isArray(value)) return value.map((entry) => cleanValue(entry)).filter((entry) => entry !== undefined);
  if (!value || typeof value !== "object") return value;
  const output: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Readonly<Record<string, unknown>>).sort(([left], [right]) => left.localeCompare(right))) {
    const cleaned = cleanValue(entry);
    if (cleaned !== undefined) output[key] = cleaned;
  }
  return output;
}

function worldTickEffect(command: CommandIntentV1, worldMinute: number): CausalEffectV1 {
  return {
    effectId: `world_tick:${command.commandId}`,
    effectType: "world_predicate",
    targetRef: { entityType: "world", entityId: command.worldId },
    operation: "advance_world_tick",
    after: {
      predicateId: `world_tick:${command.worldId}`,
      subjectRef: { entityType: "world", entityId: command.worldId },
      operator: "gte",
      expectedValue: worldMinute,
      evaluationStatus: "true",
      evaluatedAtWorldMinute: worldMinute,
    },
    sourceEventIds: [command.commandId],
    authorizationRefs: command.authorizationRefs,
  };
}

function refValues(refs: readonly string[] | ReadonlySet<string> | undefined): readonly string[] {
  if (!refs) return [];
  return Array.isArray(refs) ? refs : [...refs];
}

function defaultIdFactory(kind: string, input: Readonly<Record<string, unknown>>): string {
  const stable = JSON.stringify(input, Object.keys(input).sort());
  let hash = 0;
  for (let index = 0; index < stable.length; index += 1) {
    hash = (hash * 31 + stable.charCodeAt(index)) >>> 0;
  }
  return `${kind}_${hash.toString(16).padStart(8, "0")}`;
}
