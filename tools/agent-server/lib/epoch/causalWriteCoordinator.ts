import {
  CAUSAL_EVENT_SCHEMA_VERSION,
  CAUSAL_RESULT_MANIFEST_VERSION,
  CausalValidationError,
  assertCommandIntentV1,
  assertCausalWorldEventV1,
  causalActorRefKey,
  isCausalValidationError,
  type CausalEnforcementMode,
  type CausalWorldEventCandidateV1,
  type CausalWorldEventV1,
  type CommandIntentV1,
  type CommandResultManifestV1,
} from "./causalContracts.ts";
import { causalCanonicalJsonHash } from "./causalCanonicalJson.ts";
import {
  causalSchemaRegistryHash,
  parseCausalEventPolicy,
  CAUSAL_SCHEMA_REGISTRY_VERSION,
} from "./causalSchemaRegistry.ts";
import {
  assertCausalIdempotencyReplay,
  causalIdempotencyScope,
  causalInputHash,
  committedCausalManifest,
  CausalIdempotencyFenceError,
  CausalIdempotencyPendingError,
  rejectedCausalManifest,
  type CausalIdempotencyManifest,
  type CausalIdempotencyManifestStore,
  type CausalIdempotencyReservation,
  type CausalAtomicCommitContext,
} from "./causalIdempotencyRules.ts";
import {
  validateCausalInvariantRules,
  type CausalEventReference,
  type CausalInvariantPolicy,
  type CausalStreamExpectation,
} from "./causalInvariantRules.ts";
import {
  validateCausalResourceRules,
  type CausalResourceBalanceSnapshot,
  type CausalResourcePolicy,
  type CausalTitleOwnershipSnapshot,
} from "./causalResourceRules.ts";
import { createCausalResourcePolicyFromCatalog } from "./causalResourceCatalog.ts";

export interface CausalWriteSnapshot {
  readonly knownEvents: Readonly<Record<string, CausalEventReference>>;
  readonly stream?: CausalStreamExpectation;
  readonly balances?: CausalResourceBalanceSnapshot;
  readonly ownership?: CausalTitleOwnershipSnapshot;
}

export interface CausalBuildContext {
  readonly inputHash: `sha256:${string}`;
  readonly registryVersion: string;
  readonly registryHash: `sha256:${string}`;
  readonly recordedAt: string;
}

export interface CausalCommitBundle {
  readonly event: CausalWorldEventV1;
  readonly idempotency: CausalIdempotencyManifest;
  readonly atomic?: CausalAtomicCommitContext;
}

export interface CausalWriteResult {
  readonly event: CausalWorldEventV1;
  readonly manifest: CommandResultManifestV1;
  readonly replayed: boolean;
  readonly violations: readonly CausalValidationError[];
}

export interface CreateCausalWriteCoordinatorOptions {
  readonly idempotencyStore: CausalIdempotencyManifestStore;
  readonly loadSnapshot: (command: CommandIntentV1) => CausalWriteSnapshot | Promise<CausalWriteSnapshot>;
  readonly buildEvent: (
    command: CommandIntentV1,
    snapshot: CausalWriteSnapshot,
    context: CausalBuildContext,
  ) => CausalWorldEventCandidateV1 | Promise<CausalWorldEventCandidateV1>;
  readonly commit: (bundle: CausalCommitBundle) => void | Promise<void>;
  readonly loadCommittedEvent: (eventId: string) => CausalWorldEventV1 | undefined | Promise<CausalWorldEventV1 | undefined>;
  readonly project?: (event: CausalWorldEventV1) => void | Promise<void>;
  readonly authorize?: (
    command: CommandIntentV1,
    snapshot: CausalWriteSnapshot,
  ) => void | readonly string[] | Promise<void | readonly string[]>;
  readonly invariantPolicy?: CausalInvariantPolicy;
  readonly resourcePolicy?: CausalResourcePolicy;
  readonly enforcementMode?: CausalEnforcementMode;
  readonly now?: () => string;
  readonly reservationLeaseMs?: number;
  readonly ownerId?: string;
}

export interface CausalWriteCoordinator {
  readonly execute: (command: CommandIntentV1 | unknown) => Promise<CausalWriteResult>;
  readonly drain: () => Promise<void>;
}

export const DEFAULT_CAUSAL_RESOURCE_POLICY: CausalResourcePolicy = createCausalResourcePolicyFromCatalog();

export const DEFAULT_CAUSAL_INVARIANT_POLICY: CausalInvariantPolicy = {
  rootEventTypes: [
    "system_world_created",
    "world_clock_initialized",
    "world_simulation_initialized",
    "content_migration_applied",
    "world_simulation_content_migrated",
    "admin_correction_committed",
  ],
  rootReasonsByEventType: {
    system_world_created: ["world_genesis"],
    world_clock_initialized: ["external_clock", "deterministic_schedule"],
    world_simulation_initialized: ["world_genesis", "deterministic_schedule"],
    content_migration_applied: ["content_migration"],
    world_simulation_content_migrated: ["content_migration"],
    admin_correction_committed: ["authorized_admin_correction"],
  },
  eventTypeRequiresRootPressure: [
    "world_opportunity_opened",
    "journey_consequence_committed",
  ],
  allowEmptyEffectsForEventTypes: ["content_migration_applied"],
};

function stableCommandInput(command: CommandIntentV1) {
  return {
    commandType: command.commandType,
    worldId: command.worldId,
    namespace: command.namespace,
    actor: command.actor,
    requestedWorldMinute: command.requestedWorldMinute,
    expectedStreamVersions: command.expectedStreamVersions,
    authorizationRefs: command.authorizationRefs,
    causalParentEventIds: command.causalParentEventIds,
    rootPressureIds: command.rootPressureIds,
    ...(command.rootReason !== undefined ? { rootReason: command.rootReason } : {}),
    payload: command.payload,
  };
}

function eventForHash(
  event: Omit<CausalWorldEventV1, "proof">,
  payloadHash: `sha256:${string}`,
  effectsHash: `sha256:${string}`,
) {
  return {
    ...event,
    proof: {
      payloadHash,
      effectsHash,
    },
  };
}

function finalizeCandidate(
  command: CommandIntentV1,
  candidate: CausalWorldEventCandidateV1,
  context: CausalBuildContext,
): CausalWorldEventV1 {
  if (candidate.worldId !== command.worldId || candidate.namespace !== command.namespace) {
    throw new CausalValidationError("CAUSAL_SCHEMA_INVALID", {
      field: candidate.worldId !== command.worldId ? "worldId" : "namespace",
    });
  }
  const actorKey = causalActorRefKey(command.actor);
  if (!candidate.actorRefs.some((actor) => causalActorRefKey(actor) === actorKey)) {
    throw new CausalValidationError("AUTHORIZATION_DENIED", { actorRef: actorKey });
  }
  const { proof: _candidateProof, ...candidateWithoutProof } = candidate;
  const withoutProof: Omit<CausalWorldEventV1, "proof"> = {
    ...candidateWithoutProof,
    schemaVersion: CAUSAL_EVENT_SCHEMA_VERSION,
    registryVersion: context.registryVersion,
    registryHash: context.registryHash,
    recordedAt: context.recordedAt,
    command: {
      commandId: command.commandId,
      commandType: command.commandType,
      idempotencyKey: command.idempotencyKey,
      inputHash: context.inputHash,
    },
    causality: {
      causalParentEventIds: command.causalParentEventIds,
      rootPressureIds: command.rootPressureIds,
      ...(command.rootReason !== undefined ? { rootReason: command.rootReason } : {}),
    },
    authorizationRefs: command.authorizationRefs,
  };
  const payloadHash = causalCanonicalJsonHash(withoutProof.payload);
  const effectsHash = causalCanonicalJsonHash(withoutProof.effects);
  const eventHash = causalCanonicalJsonHash(eventForHash(withoutProof, payloadHash, effectsHash));
  return assertCausalWorldEventV1({
    ...withoutProof,
    proof: {
      payloadHash,
      effectsHash,
      eventHash,
    },
  });
}

function manifestFor(
  event: CausalWorldEventV1,
  warnings: readonly string[],
  projectionStatus: CommandResultManifestV1["projectionStatus"],
): CommandResultManifestV1 {
  return {
    manifestVersion: CAUSAL_RESULT_MANIFEST_VERSION,
    commandId: event.command.commandId,
    idempotencyKey: event.command.idempotencyKey,
    inputHash: event.command.inputHash,
    status: "committed",
    eventIds: [event.eventId],
    eventHashes: [event.proof.eventHash],
    committedAt: event.recordedAt,
    projectionStatus,
    warnings,
  };
}

function toCausalValidationError(error: unknown): CausalValidationError {
  if (isCausalValidationError(error)) return error;
  if (error && typeof error === "object" && "code" in error) {
    if (error.code === "causal_idempotency_conflict") {
      return new CausalValidationError("IDEMPOTENCY_CONFLICT", {}, error);
    }
    if (error.code === "causal_event_policy_unknown" || error.code === "causal_schema_unknown") {
      return new CausalValidationError("CAUSAL_SCHEMA_UNKNOWN", {}, error);
    }
    if (error.code === "causal_idempotency_pending" || error.code === "causal_idempotency_fence_lost") {
      return new CausalValidationError("CANONICAL_APPEND_FAILED", {
        reason: String(error.code),
      }, error);
    }
    if (error.code === "causal_event_policy_retired" || error.code === "causal_schema_retired") {
      return new CausalValidationError("CAUSAL_SCHEMA_INVALID", { reason: "retired" }, error);
    }
  }
  return new CausalValidationError("CAUSAL_SCHEMA_INVALID", {}, error);
}

function enforcementWarnings(
  mode: CausalEnforcementMode,
  violations: readonly CausalValidationError[],
) {
  if (mode === "observe") return [];
  return violations.map((violation) => violation.code);
}

async function committedEventForReplay(
  manifest: CausalIdempotencyManifest,
  loadCommittedEvent: CreateCausalWriteCoordinatorOptions["loadCommittedEvent"],
) {
  const eventId = manifest.eventIds[0];
  if (!eventId) {
    throw new CausalValidationError("DETERMINISM_PROOF_FAILED", {
      reason: "committed_manifest_event_required",
    });
  }
  const event = await loadCommittedEvent(eventId);
  if (!event) {
    throw new CausalValidationError("CANONICAL_APPEND_FAILED", {
      reason: "committed_event_unavailable",
      eventId,
    });
  }
  return assertCausalWorldEventV1(event);
}

export function createCausalWriteCoordinator(
  options: CreateCausalWriteCoordinatorOptions,
): CausalWriteCoordinator {
  const queues = new Map<string, Promise<void>>();
  const now = options.now || (() => new Date().toISOString());
  const ownerId = options.ownerId || `coordinator:${Math.random().toString(16).slice(2)}`;
  const reservationLeaseMs = options.reservationLeaseMs ?? 30_000;
  const invariantPolicy = options.invariantPolicy || DEFAULT_CAUSAL_INVARIANT_POLICY;
  const resourcePolicy = options.resourcePolicy || DEFAULT_CAUSAL_RESOURCE_POLICY;
  const enforcementMode = options.enforcementMode || "block";

  async function executeSerialized(command: CommandIntentV1): Promise<CausalWriteResult> {
    const actorRef = causalActorRefKey(command.actor);
    const stableInput = stableCommandInput(command);
    const idempotencyInput = {
      worldId: command.worldId,
      commandType: command.commandType,
      actorRef,
      idempotencyKey: command.idempotencyKey,
      input: stableInput,
    };
    const scope = causalIdempotencyScope(idempotencyInput);
    const inputHash = causalInputHash(stableInput);
    const recordedAt = now();
    const leaseExpiresAt = new Date(new Date(recordedAt).getTime() + reservationLeaseMs).toISOString();
    let reservation: CausalIdempotencyReservation | undefined;
    if (options.idempotencyStore.claimReservation) {
      const claim = await options.idempotencyStore.claimReservation(idempotencyInput, {
        ownerId,
        now: recordedAt,
        leaseExpiresAt,
      });
      if (claim.kind === "pending") {
        throw toCausalValidationError(new CausalIdempotencyPendingError(scope, claim.manifest.leaseExpiresAt));
      }
      if (claim.kind === "rejected") {
        throw new CausalValidationError(
          (claim.manifest.rejectionCode || "CAUSAL_SCHEMA_INVALID") as CausalValidationError["code"],
          { replayed: true },
        );
      }
      if (claim.kind === "committed") {
        const event = await committedEventForReplay(claim.manifest, options.loadCommittedEvent);
        return {
          event,
          manifest: manifestFor(event, [], "current"),
          replayed: true,
          violations: [],
        };
      }
      reservation = claim.reservation;
    } else {
      const existing = await options.idempotencyStore.read(scope);
      if (existing) {
        assertCausalIdempotencyReplay(existing, idempotencyInput);
        if (existing.status === "pending") {
          throw toCausalValidationError(new CausalIdempotencyPendingError(scope, existing.leaseExpiresAt));
        }
        if (existing.status === "rejected") {
          throw new CausalValidationError(
            (existing.rejectionCode || "CAUSAL_SCHEMA_INVALID") as CausalValidationError["code"],
            { replayed: true },
          );
        }
        const event = await committedEventForReplay(existing, options.loadCommittedEvent);
        return {
          event,
          manifest: manifestFor(event, [], "current"),
          replayed: true,
          violations: [],
        };
      }
    }

    async function finalizeRejected(rejection: CausalValidationError) {
      if (rejection.retryable) return;
      const manifest = rejectedCausalManifest({
        ...idempotencyInput,
        rejectionCode: rejection.code,
        createdAt: recordedAt,
        updatedAt: recordedAt,
      });
      if (reservation && options.idempotencyStore.finalizeReservation) {
        await options.idempotencyStore.finalizeReservation(reservation, manifest);
      } else {
        await options.idempotencyStore.write(manifest);
      }
    }

    const snapshot = await options.loadSnapshot(command);
    let authorizationWarnings: readonly string[] = [];
    try {
      authorizationWarnings = await options.authorize?.(command, snapshot) || [];
    } catch (error) {
      const rejection = toCausalValidationError(error);
      await finalizeRejected(rejection);
      throw rejection;
    }

    const context: CausalBuildContext = {
      inputHash,
      registryVersion: String(CAUSAL_SCHEMA_REGISTRY_VERSION),
      registryHash: causalSchemaRegistryHash(),
      recordedAt,
    };
    let event: CausalWorldEventV1;
    try {
      const candidate = await options.buildEvent(command, snapshot, context);
      parseCausalEventPolicy(candidate.eventType);
      event = finalizeCandidate(command, candidate, context);
    } catch (error) {
      const rejection = toCausalValidationError(error);
      await finalizeRejected(rejection);
      throw rejection;
    }

    const violations = [
      ...validateCausalInvariantRules({
        event,
        knownEvents: snapshot.knownEvents,
        policy: invariantPolicy,
        stream: snapshot.stream,
      }),
      ...validateCausalResourceRules({
        event,
        policy: resourcePolicy,
        balances: snapshot.balances,
        ownership: snapshot.ownership,
      }),
    ];
    if (enforcementMode === "retired") {
      violations.push(new CausalValidationError("CAUSAL_SCHEMA_INVALID", { reason: "writer_retired" }));
    }
    if ((enforcementMode === "block" || enforcementMode === "retired") && violations.length > 0) {
      const rejection = violations[0];
      await finalizeRejected(rejection);
      throw rejection;
    }

    const idempotency = committedCausalManifest({
      ...idempotencyInput,
      eventIds: [event.eventId],
      createdAt: recordedAt,
      updatedAt: recordedAt,
    });
    try {
      if (reservation && options.idempotencyStore.commitAtomically) {
        await options.idempotencyStore.commitAtomically(reservation, idempotency, (atomic) =>
          options.commit({ event, idempotency, atomic }));
      } else {
        await options.commit({ event, idempotency });
        if (reservation && options.idempotencyStore.finalizeReservation) {
          await options.idempotencyStore.finalizeReservation(reservation, idempotency);
        } else {
          await options.idempotencyStore.write(idempotency);
        }
      }
    } catch (error) {
      if (error instanceof CausalIdempotencyFenceError) throw toCausalValidationError(error);
      throw new CausalValidationError("CANONICAL_APPEND_FAILED", { eventId: event.eventId }, error);
    }

    let projectionStatus: CommandResultManifestV1["projectionStatus"] = "current";
    const warnings = [
      ...authorizationWarnings,
      ...enforcementWarnings(enforcementMode, violations),
    ];
    if (options.project) {
      try {
        await options.project(event);
      } catch {
        projectionStatus = "degraded";
        warnings.push("PROJECTION_LAGGING");
      }
    }
    return {
      event,
      manifest: manifestFor(event, warnings, projectionStatus),
      replayed: false,
      violations,
    };
  }

  return {
    async execute(input) {
      const command = assertCommandIntentV1(input);
      const scope = causalIdempotencyScope({
        worldId: command.worldId,
        commandType: command.commandType,
        actorRef: causalActorRefKey(command.actor),
        idempotencyKey: command.idempotencyKey,
      });
      const previous = queues.get(scope) || Promise.resolve();
      let release: () => void = () => undefined;
      const current = new Promise<void>((resolve) => {
        release = resolve;
      });
      const queued = previous.then(() => current);
      queues.set(scope, queued);
      await previous;
      try {
        return await executeSerialized(command);
      } finally {
        release();
        if (queues.get(scope) === queued) queues.delete(scope);
      }
    },
    async drain() {
      await Promise.all([...queues.values()]);
    },
  };
}
