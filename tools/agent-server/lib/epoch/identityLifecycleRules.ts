import { createHash } from "node:crypto";

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
import {
  buildExpectedLifePattern,
  type ExpectedLifePattern,
} from "./journeyRoleplayRules.ts";
import {
  LIFETIME_REASON_IDENTITY_VIABILITY_ACCELERATION,
  LIFETIME_REASON_IDENTITY_VIABILITY_SOCIAL_DEATH,
  VIABILITY_POLICY_VERSION,
  initialIdentityViability,
  type IdentityViability,
} from "./journeyViabilityRules.ts";
import {
  freezeIdentityStrategyDisposition,
  type IdentityStrategyDisposition,
  type StrategyProfile,
} from "./journeyStrategyRules.ts";

const PERSONALITY_DRIFT_SOURCE_EVENT_TYPES: ReadonlySet<EpochEvent["eventType"]> = new Set([
  "anomaly_event_resolved",
  "relationship_updated",
]);

export const PERSONALITY_DRIFT_COOLDOWN_SECONDS = 7 * 24 * 60 * 60;
export const RELATIONSHIP_PERSONALITY_DRIFT_HOSTILITY_THRESHOLD = -4;

const INITIAL_TEMPERAMENT_TRAITS = [
  "谨慎",
  "果断",
  "好奇",
  "耐心",
  "务实",
  "重情",
  "守序",
  "敢于冒险",
] as const;

function occupationalIdentityTrait(identityName: string): string {
  if (/救援|护送|照护|治疗|rescue|escort|medic|care/iu.test(identityName)) return "愿意帮助他人";
  if (/勘探|测绘|侦察|外勤|scout|explor|field/iu.test(identityName)) return "行动导向";
  if (/实验|研究|记录|档案|采样|测绘|research|archiv|record|sample/iu.test(identityName)) return "重视证据";
  if (/检修|工匠|维修|工程|repair|engineer|craft/iu.test(identityName)) return "讲求实用";
  if (/试炼|候补|学徒|见习|trial|novice|apprentice/iu.test(identityName)) return "渴望证明自己";
  if (/贸易|调度|补给|商|trade|supply|merchant/iu.test(identityName)) return "看重稳定收益";
  return "适应新环境";
}

export function initialIdentityTraits(input: {
  readonly agentId: string;
  readonly identityName: string;
  readonly generation: number;
}): readonly string[] {
  const digest = createHash("sha256")
    .update(`${input.agentId}\u001f${input.identityName}\u001f${input.generation}`, "utf8")
    .digest();
  const temperament = INITIAL_TEMPERAMENT_TRAITS[digest.readUInt32BE(0) % INITIAL_TEMPERAMENT_TRAITS.length];
  return [occupationalIdentityTrait(input.identityName), temperament];
}

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
  /**
   * PR5a additive. Initial viability snapshot to freeze onto the identity.
   * Callers SHOULD pass {@link initialIdentityViability}; legacy callers
   * may omit it and the payload helper synthesises a fresh snapshot at
   * {@link startedAt}. Reincarnation always passes a fresh snapshot — the
   * previous identity's viability history is NOT inherited.
   */
  readonly initialViability?: IdentityViability;
  /**
   * PR5b additive. Server-frozen {@link ExpectedLifePattern} to carry on the
   * identity payload. Callers MAY pre-build a pattern and pass it here; when
   * omitted the planner helpers ({@link planIdentityIssueEvents} /
   * {@link planIdentityReincarnationEvents}) build one deterministically from
   * the issuance inputs. The payload helper passes this through verbatim — it
   * does not build the pattern itself, preserving the pure-function boundary.
   */
  readonly expectedLifePattern?: ExpectedLifePattern;
  /**
   * PR6 additive. Server-frozen {@link IdentityStrategyDisposition} to carry on
   * the identity payload. When omitted, the identity has no frozen strategy
   * posture and strategy-consistency scoring defaults to normal (10000/0).
   * The payload helper passes this through verbatim.
   */
  readonly strategyDisposition?: IdentityStrategyDisposition;
}

export interface IdentityIssueEventsInput extends IdentityIssuedPayloadInput {
  readonly makeEvent: EpochEventFactory;
  /**
   * PR6 additive. When present, the planner freezes a strategy disposition
   * from the profile and forwards it into the issued payload. Legacy callers
   * that omit this still produce a valid payload (no disposition → strategy
   * consistency defaults to normal).
   */
  readonly strategyProfile?: StrategyProfile;
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
  /**
   * Reason for the adjustment. Two values are server-attested and reserved:
   *  - {@link LIFETIME_REASON_IDENTITY_VIABILITY_ACCELERATION} (`identity_viability_acceleration`)
   *  - {@link LIFETIME_REASON_IDENTITY_VIABILITY_SOCIAL_DEATH} (`identity_viability_social_death`)
   *
   * The payload helper refuses to attach the {@link viabilityTriggerRef}
   * for these reasons unless the caller passes it. MCP-originated calls
   * cannot supply a server-attested ref, so they are rejected upstream.
   */
  readonly reason: string;
  readonly previousRemaining: number;
  readonly remaining: number;
  /**
   * PR5a additive. Server-attested reference to the viability projection
   * that triggered this adjustment. Required when `reason` is one of the
   * two reserved viability reasons; ignored otherwise.
   */
  readonly viabilityTriggerRef?: {
    readonly sourceSettlementId: string;
    readonly lifetimeAccelerationBps: number;
    readonly socialDeathTriggered: boolean;
  };
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

/**
 * PR5a additive. Reserved reason values for the runtime viability path.
 * MCP callers cannot supply the {@link viabilityTriggerRef} that
 * {@link lifetimeAdjustedPayload} demands for these reasons, so they are
 * structurally barred from the reserved channel.
 */
export const LIFETIME_REASON_RESERVED_VIABILITY = Object.freeze([
  LIFETIME_REASON_IDENTITY_VIABILITY_ACCELERATION,
  LIFETIME_REASON_IDENTITY_VIABILITY_SOCIAL_DEATH,
] as const);

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
  const initialViability =
    input.initialViability ?? initialIdentityViability(input.agentId, input.startedAt);
  return {
    agentId: input.agentId,
    explorerId: input.explorerId,
    ...(includesExplorerSecretHash ? { explorerSecretHash: input.explorerSecretHash } : {}),
    identityName: input.identityName,
    generation: input.generation,
    status: "active",
    previousAgentId: input.previousAgentId,
    ...(input.inheritance ? { inheritance: input.inheritance } : {}),
    personalityTraits: initialIdentityTraits({
      agentId: input.agentId,
      identityName: input.identityName,
      generation: input.generation,
    }),
    lifetime: {
      max: input.maxLifetime,
      remaining: input.maxLifetime,
      startedAt: input.startedAt,
    },
    viabilityPolicyVersion: VIABILITY_POLICY_VERSION,
    identityViability: initialViability,
    // PR5b: transparently forward the caller-supplied pattern (if any). The
    // helper does not build the pattern — that is the planner's responsibility
    // so the helper stays pure and deterministic on its other inputs.
    ...(input.expectedLifePattern ? { expectedLifePattern: input.expectedLifePattern } : {}),
    // PR6: transparently forward the caller-supplied disposition (if any).
    // Legacy callers may omit it; the strategy-consistency pipeline defaults
    // to normal (10000/0) when no disposition is present.
    ...(input.strategyDisposition ? { strategyDisposition: input.strategyDisposition } : {}),
  };
}

export function planIdentityIssueEvents(input: IdentityIssueEventsInput): readonly EpochEvent[] {
  // PR5b: build the deterministic ExpectedLifePattern at issuance. The
  // builder is pure (same inputs → same pattern + same inputHash) so the
  // persisted pattern is replay-stable. We build from the SAME personality
  // traits the helper computes below so the pattern stays consistent with
  // the issued identity record. When the caller pre-supplies
  // `expectedLifePattern` it is forwarded verbatim and the builder is not
  // invoked — that path exists for tests / migration tools that need to
  // pin a specific pattern.
  const traits = initialIdentityTraits({
    agentId: input.agentId,
    identityName: input.identityName,
    generation: input.generation,
  });
  const expectedLifePattern = input.expectedLifePattern ?? buildExpectedLifePattern({
    identityId: input.agentId,
    identityName: input.identityName,
    explorerId: input.explorerId,
    generation: input.generation,
    personalityTraits: traits,
    frozenAt: input.startedAt,
  });
  // PR6: freeze strategy disposition when the caller supplies a strategy profile.
  const strategyDisposition = input.strategyDisposition
    ?? (input.strategyProfile
      ? freezeIdentityStrategyDisposition(
          input.agentId,
          input.strategyProfile.primary,
          input.strategyProfile.secondary,
          input.startedAt,
        )
      : undefined);
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
    expectedLifePattern,
    ...(strategyDisposition ? { strategyDisposition } : {}),
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
  const isViabilityReason =
    input.reason === LIFETIME_REASON_IDENTITY_VIABILITY_ACCELERATION
    || input.reason === LIFETIME_REASON_IDENTITY_VIABILITY_SOCIAL_DEATH;
  // Server-attested guard: the reserved viability reasons REQUIRE a
  // viabilityTriggerRef. MCP tools that call this helper with these reasons
  // but no ref are rejected here so the reserved channel cannot be forged.
  if (isViabilityReason && !input.viabilityTriggerRef) {
    throw new Error(`lifetime_adjusted_viability_trigger_ref_required:${input.reason}`);
  }
  return {
    delta: input.delta,
    reason: input.reason,
    previousRemaining: input.previousRemaining,
    remaining: input.remaining,
    ...(input.viabilityTriggerRef ? { viabilityTriggerRef: input.viabilityTriggerRef } : {}),
  };
}

export function planLifetimeAdjustmentEvents(input: LifetimeAdjustmentEventsInput): readonly EpochEvent[] {
  const adjustedPayload = lifetimeAdjustedPayload({
    delta: input.delta,
    reason: input.reason,
    previousRemaining: input.previousRemaining,
    remaining: input.remaining,
    ...(input.viabilityTriggerRef ? { viabilityTriggerRef: input.viabilityTriggerRef } : {}),
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
  // PR5b: reincarnation builds a FRESH pattern from nextAgentId + new
  // explorerId + generation + new identityName. The previous identity's
  // pattern (and doubtedBy) is NOT inherited — by construction the inputHash
  // differs and the new identity starts with a clean roleplay norm. This
  // mirrors the PR5a viability reset in `initialIdentityViability`.
  const reincarnationTraits = initialIdentityTraits({
    agentId: input.nextAgentId,
    identityName: input.identityName,
    generation: input.generation,
  });
  const expectedLifePattern = buildExpectedLifePattern({
    identityId: input.nextAgentId,
    identityName: input.identityName,
    explorerId: input.explorerId,
    generation: input.generation,
    personalityTraits: reincarnationTraits,
    frozenAt: input.startedAt,
  });
  const issuedPayload = identityIssuedPayload({
    agentId: input.nextAgentId,
    explorerId: input.explorerId,
    identityName: input.identityName,
    generation: input.generation,
    previousAgentId: input.previousAgentId,
    inheritance: input.inheritance,
    maxLifetime: input.maxLifetime,
    startedAt: input.startedAt,
    expectedLifePattern,
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
