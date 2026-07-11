import {
  type EpochEvent,
  type ExplorerRecoveryRotatedPayload,
  type IdentityArchivedPayload,
  type IdentityIssuedPayload,
  type LifetimeAdjustedPayload,
  type PersonalityDriftConfirmedPayload,
  type PersonalityDriftProposedPayload,
  type ReincarnationIssuedPayload,
} from "./events.ts";
import type { EpochEventFactory } from "./eventFactory.ts";
import type { EpochLineageInheritance } from "./protocol.ts";

const PERSONALITY_DRIFT_SOURCE_EVENT_TYPES: ReadonlySet<EpochEvent["eventType"]> = new Set([
  "anomaly_event_resolved",
  "relationship_updated",
]);

export const PERSONALITY_DRIFT_COOLDOWN_SECONDS = 7 * 24 * 60 * 60;
export const RELATIONSHIP_PERSONALITY_DRIFT_HOSTILITY_THRESHOLD = -4;

export interface PersonalityDriftStateForRules {
  readonly status?: string;
  readonly confirmedAt?: string;
}

export interface PersonalityDriftProjectionForRules<TDrift extends PersonalityDriftStateForRules> {
  readonly personalityDriftIdsByAgent: Readonly<Record<string, readonly string[]>>;
  readonly personalityDrifts: Readonly<Record<string, TDrift | undefined>>;
}

export interface IdentityProjectionForRules<TIdentity> {
  readonly identities: Readonly<Record<string, TIdentity | undefined>>;
}

export interface IdentityArchiveProjectionForRules<TIdentity> extends IdentityProjectionForRules<TIdentity> {}

export interface IdentityIssuedPayloadInput {
  readonly agentId: string;
  readonly explorerId: string;
  readonly explorerSecretHash?: string;
  readonly identityName: string;
  readonly generation: number;
  readonly previousAgentId?: string;
  readonly inheritance?: EpochLineageInheritance;
  readonly maxLifetime: number;
  readonly startedAt: string;
}

export interface IdentityIssueEventsInput extends IdentityIssuedPayloadInput {
  readonly makeEvent: EpochEventFactory;
}

export interface IdentityIssueProjectionInput<TIdentity> {
  readonly projection: IdentityProjectionForRules<TIdentity>;
  readonly events: readonly EpochEvent[];
}

export interface ExplorerRecoveryRotatedPayloadInput {
  readonly explorerId: string;
  readonly explorerSecretHash: string;
  readonly rotatedAt: string;
}

export interface ExplorerRecoveryRotationEventsInput extends ExplorerRecoveryRotatedPayloadInput {
  readonly makeEvent: EpochEventFactory;
}

export interface ExplorerRecoveryRotationProjectionInput {
  readonly events: readonly EpochEvent[];
}

export interface ExplorerRecoveryRotationResult {
  readonly explorerId: string;
  readonly rotated: true;
  readonly newRecoveryRegistered: true;
  readonly rotatedAt: string;
}

export interface LifetimeAdjustedPayloadInput {
  readonly delta: number;
  readonly reason: string;
  readonly previousRemaining: number;
  readonly remaining: number;
}

export interface LifetimeAdjustmentArchiveInput {
  readonly archivedAt: string;
  readonly finalTitle: string;
}

export interface LifetimeAdjustmentEventsInput extends LifetimeAdjustedPayloadInput {
  readonly agentId: string;
  readonly archive?: LifetimeAdjustmentArchiveInput;
  readonly makeEvent: EpochEventFactory;
}

export interface IdentityArchivedPayloadInput {
  readonly archiveReason: string;
  readonly archivedAt: string;
  readonly finalTitle: string;
}

export interface IdentityArchiveEventsInput extends IdentityArchivedPayloadInput {
  readonly agentId: string;
  readonly makeEvent: EpochEventFactory;
}

export interface IdentityArchiveProjectionInput<TIdentity> {
  readonly projection: IdentityArchiveProjectionForRules<TIdentity>;
  readonly events: readonly EpochEvent[];
}

export interface ReincarnationIssuedPayloadInput {
  readonly explorerId: string;
  readonly previousAgentId: string;
  readonly nextAgentId: string;
  readonly generation: number;
  readonly inheritance: EpochLineageInheritance;
}

export interface IdentityReincarnationEventsInput {
  readonly explorerId: string;
  readonly previousAgentId: string;
  readonly nextAgentId: string;
  readonly identityName: string;
  readonly generation: number;
  readonly inheritance: EpochLineageInheritance;
  readonly maxLifetime: number;
  readonly startedAt: string;
  readonly makeEvent: EpochEventFactory;
}

export interface IdentityReincarnationProjectionInput<TIdentity> {
  readonly projection: IdentityProjectionForRules<TIdentity>;
  readonly events: readonly EpochEvent[];
}

export interface PersonalityDriftProposedPayloadInput {
  readonly driftId: string;
  readonly agentId: string;
  readonly explorerId: string;
  readonly sourceEventId: string;
  readonly trigger: string;
  readonly suggestedTrait: string;
  readonly summary: string;
  readonly proposedAt: string;
}

export interface PersonalityDriftProposalEventsInput extends PersonalityDriftProposedPayloadInput {
  readonly makeEvent: EpochEventFactory;
}

export interface PersonalityDriftConfirmedPayloadInput {
  readonly driftId: string;
  readonly agentId: string;
  readonly confirmedByExplorerId: string;
  readonly confirmedAt: string;
}

export interface PersonalityDriftConfirmationEventsInput extends PersonalityDriftConfirmedPayloadInput {
  readonly makeEvent: EpochEventFactory;
}

export interface PersonalityDriftConfirmationProjectionInput<TDrift extends PersonalityDriftStateForRules> {
  readonly projection: Pick<PersonalityDriftProjectionForRules<TDrift>, "personalityDrifts">;
  readonly events: readonly EpochEvent[];
}

export function identityIssuedPayload(input: IdentityIssuedPayloadInput): IdentityIssuedPayload {
  const includesExplorerSecretHash = Object.prototype.hasOwnProperty.call(input, "explorerSecretHash");
  return {
    agentId: input.agentId,
    explorerId: input.explorerId,
    ...(includesExplorerSecretHash ? { explorerSecretHash: input.explorerSecretHash } : {}),
    identityName: input.identityName,
    generation: input.generation,
    status: "active",
    previousAgentId: input.previousAgentId,
    ...(input.inheritance ? { inheritance: input.inheritance } : {}),
    lifetime: {
      max: input.maxLifetime,
      remaining: input.maxLifetime,
      startedAt: input.startedAt,
    },
  };
}

export function planIdentityIssueEvents(input: IdentityIssueEventsInput): readonly EpochEvent[] {
  const payload = identityIssuedPayload({
    agentId: input.agentId,
    explorerId: input.explorerId,
    explorerSecretHash: input.explorerSecretHash,
    identityName: input.identityName,
    generation: input.generation,
    previousAgentId: input.previousAgentId,
    inheritance: input.inheritance,
    maxLifetime: input.maxLifetime,
    startedAt: input.startedAt,
  });
  return [input.makeEvent("identity_issued", input.agentId, payload, { agentId: input.agentId })];
}

export function projectIdentityIssue<TIdentity>(input: IdentityIssueProjectionInput<TIdentity>): TIdentity {
  const issued = input.events.find((event) => event.eventType === "identity_issued");
  if (!issued || issued.eventType !== "identity_issued") {
    throw new Error("identity_issued_event_missing");
  }
  const identity = input.projection.identities[issued.agentId || issued.aggregateId];
  if (!identity) throw new Error("identity_issue_projection_failed");
  return identity;
}

export function explorerRecoveryRotatedPayload(
  input: ExplorerRecoveryRotatedPayloadInput,
): ExplorerRecoveryRotatedPayload {
  return {
    explorerId: input.explorerId,
    explorerSecretHash: input.explorerSecretHash,
    rotatedAt: input.rotatedAt,
  };
}

export function planExplorerRecoveryRotationEvents(
  input: ExplorerRecoveryRotationEventsInput,
): readonly EpochEvent[] {
  const payload = explorerRecoveryRotatedPayload({
    explorerId: input.explorerId,
    explorerSecretHash: input.explorerSecretHash,
    rotatedAt: input.rotatedAt,
  });
  return [input.makeEvent("explorer_recovery_rotated", input.explorerId, payload, {
    aggregateType: "explorer",
  })];
}

export function projectExplorerRecoveryRotation(
  input: ExplorerRecoveryRotationProjectionInput,
): ExplorerRecoveryRotationResult {
  const rotated = input.events.find((event) => event.eventType === "explorer_recovery_rotated");
  if (!rotated || rotated.eventType !== "explorer_recovery_rotated") {
    throw new Error("explorer_recovery_rotated_event_missing");
  }
  return {
    explorerId: rotated.payload.explorerId,
    rotated: true,
    newRecoveryRegistered: true,
    rotatedAt: rotated.payload.rotatedAt,
  };
}

export function lifetimeAdjustedPayload(input: LifetimeAdjustedPayloadInput): LifetimeAdjustedPayload {
  return {
    delta: input.delta,
    reason: input.reason,
    previousRemaining: input.previousRemaining,
    remaining: input.remaining,
  };
}

export function planLifetimeAdjustmentEvents(input: LifetimeAdjustmentEventsInput): readonly EpochEvent[] {
  const adjustedPayload = lifetimeAdjustedPayload({
    delta: input.delta,
    reason: input.reason,
    previousRemaining: input.previousRemaining,
    remaining: input.remaining,
  });
  const adjusted = input.makeEvent("lifetime_adjusted", input.agentId, adjustedPayload, {
    agentId: input.agentId,
  });
  if (!input.archive) return [adjusted];
  const archivePayload = identityArchivedPayload({
    archiveReason: input.reason,
    archivedAt: input.archive.archivedAt,
    finalTitle: input.archive.finalTitle,
  });
  return [
    adjusted,
    input.makeEvent("identity_archived", input.agentId, archivePayload, { agentId: input.agentId }),
  ];
}

export function identityArchivedPayload(input: IdentityArchivedPayloadInput): IdentityArchivedPayload {
  return {
    archiveReason: input.archiveReason,
    archivedAt: input.archivedAt,
    finalTitle: input.finalTitle,
  };
}

export function planIdentityArchiveEvents(input: IdentityArchiveEventsInput): readonly EpochEvent[] {
  const payload = identityArchivedPayload({
    archiveReason: input.archiveReason,
    archivedAt: input.archivedAt,
    finalTitle: input.finalTitle,
  });
  return [input.makeEvent("identity_archived", input.agentId, payload, { agentId: input.agentId })];
}

export function projectIdentityArchive<TIdentity>(
  input: IdentityArchiveProjectionInput<TIdentity>,
): TIdentity {
  const archived = input.events.find((event) => event.eventType === "identity_archived");
  if (!archived || archived.eventType !== "identity_archived") {
    throw new Error("identity_archived_event_missing");
  }
  const identity = input.projection.identities[archived.agentId || archived.aggregateId];
  if (!identity) throw new Error("identity_archive_projection_failed");
  return identity;
}

export function reincarnationIssuedPayload(
  input: ReincarnationIssuedPayloadInput,
): ReincarnationIssuedPayload {
  return {
    explorerId: input.explorerId,
    previousAgentId: input.previousAgentId,
    nextAgentId: input.nextAgentId,
    generation: input.generation,
    inheritance: input.inheritance,
  };
}

export function planIdentityReincarnationEvents(
  input: IdentityReincarnationEventsInput,
): readonly EpochEvent[] {
  const issuedPayload = identityIssuedPayload({
    agentId: input.nextAgentId,
    explorerId: input.explorerId,
    identityName: input.identityName,
    generation: input.generation,
    previousAgentId: input.previousAgentId,
    inheritance: input.inheritance,
    maxLifetime: input.maxLifetime,
    startedAt: input.startedAt,
  });
  const issued = input.makeEvent("identity_issued", input.nextAgentId, issuedPayload, {
    agentId: input.nextAgentId,
  });
  const reincarnationPayload = reincarnationIssuedPayload({
    explorerId: input.explorerId,
    previousAgentId: input.previousAgentId,
    nextAgentId: input.nextAgentId,
    generation: input.generation,
    inheritance: input.inheritance,
  });
  const reincarnation = input.makeEvent("reincarnation_issued", input.previousAgentId, reincarnationPayload, {
    agentId: input.previousAgentId,
  });
  return [issued, reincarnation];
}

export function projectIdentityReincarnation<TIdentity>(
  input: IdentityReincarnationProjectionInput<TIdentity>,
): TIdentity {
  const issued = input.events.find((event) => event.eventType === "identity_issued");
  if (!issued || issued.eventType !== "identity_issued") {
    throw new Error("identity_issued_event_missing");
  }
  const reincarnation = input.events.find((event) => event.eventType === "reincarnation_issued");
  if (!reincarnation || reincarnation.eventType !== "reincarnation_issued") {
    throw new Error("reincarnation_issued_event_missing");
  }
  const identity = input.projection.identities[issued.agentId || issued.aggregateId];
  if (!identity) throw new Error("identity_reincarnation_projection_failed");
  return identity;
}

export function personalityDriftProposedPayload(
  input: PersonalityDriftProposedPayloadInput,
): PersonalityDriftProposedPayload {
  return {
    driftId: input.driftId,
    agentId: input.agentId,
    explorerId: input.explorerId,
    sourceEventId: input.sourceEventId,
    trigger: input.trigger,
    suggestedTrait: input.suggestedTrait,
    summary: input.summary,
    proposedAt: input.proposedAt,
  };
}

export function planPersonalityDriftProposalEvents(
  input: PersonalityDriftProposalEventsInput,
): readonly EpochEvent[] {
  const payload = personalityDriftProposedPayload({
    driftId: input.driftId,
    agentId: input.agentId,
    explorerId: input.explorerId,
    sourceEventId: input.sourceEventId,
    trigger: input.trigger,
    suggestedTrait: input.suggestedTrait,
    summary: input.summary,
    proposedAt: input.proposedAt,
  });
  return [input.makeEvent("personality_drift_proposed", input.driftId, payload, {
    aggregateType: "personality_drift",
    agentId: input.agentId,
  })];
}

export function personalityDriftConfirmedPayload(
  input: PersonalityDriftConfirmedPayloadInput,
): PersonalityDriftConfirmedPayload {
  return {
    driftId: input.driftId,
    agentId: input.agentId,
    confirmedByExplorerId: input.confirmedByExplorerId,
    confirmedAt: input.confirmedAt,
  };
}

export function planPersonalityDriftConfirmationEvents(
  input: PersonalityDriftConfirmationEventsInput,
): readonly EpochEvent[] {
  const payload = personalityDriftConfirmedPayload({
    driftId: input.driftId,
    agentId: input.agentId,
    confirmedByExplorerId: input.confirmedByExplorerId,
    confirmedAt: input.confirmedAt,
  });
  return [input.makeEvent("personality_drift_confirmed", input.driftId, payload, {
    aggregateType: "personality_drift",
    agentId: input.agentId,
  })];
}

export function projectPersonalityDriftConfirmation<TDrift extends PersonalityDriftStateForRules>(
  input: PersonalityDriftConfirmationProjectionInput<TDrift>,
): TDrift {
  const confirmed = input.events.find((event) => event.eventType === "personality_drift_confirmed");
  if (!confirmed || confirmed.eventType !== "personality_drift_confirmed") {
    throw new Error("personality_drift_confirmed_event_missing");
  }
  const drift = input.projection.personalityDrifts[confirmed.payload.driftId];
  if (!drift) throw new Error("personality_drift_confirmation_projection_failed");
  return drift;
}

export function personalityDriftSourceEvent(input: {
  readonly events: readonly EpochEvent[];
  readonly sourceEventId: string;
}): EpochEvent | undefined {
  const sourceEvent = input.events.find((event) => event.eventId === input.sourceEventId);
  if (!sourceEvent) return undefined;
  return PERSONALITY_DRIFT_SOURCE_EVENT_TYPES.has(sourceEvent.eventType) ? sourceEvent : undefined;
}

export function openPersonalityDriftForAgent<TDrift extends PersonalityDriftStateForRules>(input: {
  readonly projection: PersonalityDriftProjectionForRules<TDrift>;
  readonly agentId: string;
}): TDrift | undefined {
  return (input.projection.personalityDriftIdsByAgent[input.agentId] || [])
    .map((driftId) => input.projection.personalityDrifts[driftId])
    .find((drift): drift is TDrift => drift?.status === "proposed");
}

export function personalityDriftCooldownActive<TDrift extends PersonalityDriftStateForRules>(input: {
  readonly projection: PersonalityDriftProjectionForRules<TDrift>;
  readonly agentId: string;
  readonly nowMs: number;
  readonly cooldownSeconds?: number;
}): boolean {
  const cooldownSeconds = input.cooldownSeconds ?? PERSONALITY_DRIFT_COOLDOWN_SECONDS;
  return (input.projection.personalityDriftIdsByAgent[input.agentId] || [])
    .map((driftId) => input.projection.personalityDrifts[driftId])
    .filter((drift): drift is TDrift => Boolean(drift?.confirmedAt))
    .some((drift) => {
      const confirmedAtMs = Date.parse(drift.confirmedAt || "");
      if (!Number.isFinite(confirmedAtMs)) return false;
      const elapsedSeconds = Math.floor((input.nowMs - confirmedAtMs) / 1_000);
      return elapsedSeconds >= 0 && elapsedSeconds < cooldownSeconds;
    });
}

export function anomalyPersonalityDriftTrait(lifetimeRisk: number): string {
  return lifetimeRisk >= 3 ? "裂隙重压后仍会先确认退路" : "异常伤痕后更谨慎";
}

export function relationshipPersonalityDriftTrait(scoreAfter: number): string | undefined {
  if (scoreAfter > RELATIONSHIP_PERSONALITY_DRIFT_HOSTILITY_THRESHOLD) return undefined;
  return scoreAfter <= -6 ? "被深重敌意伤过后会先保留证据" : "被背誓刺伤后更谨慎地信任他人";
}
