import { createHash } from "node:crypto";

import {
  OBSIDIAN_EPOCH_PACKAGE_SIGNATURE_ALGORITHM,
  obsidianEpochReleasePublicKey,
  signObsidianEpochReleasePayload,
} from "../packageArchive.ts";
import type {
  EpochChannelClass,
  EpochServerReward,
  EpochTrustClass,
} from "./protocol.ts";
import type {
  EpochActionExplanation,
  HostedActionRecordedPayload,
  HostedActionRisk,
  TurnActionOptionPayload,
  TurnCardCreatedPayload,
  TurnResolvedPayload,
} from "./events.ts";

export const TURN_CARD_ENVELOPE_PROTOCOL_VERSION = "obsidian-epoch.turn-card-envelope.v1";
export const TURN_RESOLUTION_ENVELOPE_PROTOCOL_VERSION = "obsidian-epoch.turn-resolution-envelope.v1";
export const HOSTED_ACTION_ENVELOPE_PROTOCOL_VERSION = "obsidian-epoch.hosted-action-envelope.v1";

export interface TurnCardSignedEnvelopeInput {
  readonly envelopeId: string;
  readonly trustClass: EpochTrustClass;
  readonly turnCardId: string;
  readonly agentId: string;
  readonly explorerId: string;
  readonly regionId: string;
  readonly sequence: number;
  readonly nonce: string;
  readonly expiresAt: string;
  readonly visibleContext: TurnCardCreatedPayload["visibleContext"];
  readonly actionOptions: readonly TurnActionOptionPayload[];
}

export interface TurnResolutionSignedEnvelopeInput {
  readonly envelopeId: string;
  readonly trustClass: EpochTrustClass;
  readonly turnCardId: string;
  readonly agentId: string;
  readonly originalEnvelopeId: string;
  readonly sequence: number;
  readonly nonce: string;
  readonly actionOptionId: string;
  readonly optionLabel: string;
  readonly explanation: EpochActionExplanation;
  readonly visibleText?: string;
  readonly outcomeSummary: string;
  readonly reward?: EpochServerReward;
  readonly lifetimeDelta?: number;
  readonly nonEvidence?: boolean;
  readonly resolvedAt: string;
}

export interface HostedActionSignedEnvelopeInput {
  readonly envelopeId: string;
  readonly trustClass: EpochTrustClass;
  readonly actionId: string;
  readonly sessionId: string;
  readonly agentId: string;
  readonly channelClass: EpochChannelClass;
  readonly deliveryTrust: EpochTrustClass;
  readonly actionOptionId: string;
  readonly optionLabel: string;
  readonly risk?: HostedActionRisk;
  readonly socialHookId?: string;
  readonly attestationId?: string;
  readonly explanation: EpochActionExplanation;
  readonly visibleText?: string;
  readonly outcomeSummary: string;
  readonly reward?: EpochServerReward;
  readonly lifetimeDelta?: number;
  readonly nonEvidence?: boolean;
  readonly recordedAt: string;
}

export function stableSignedEnvelopeJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((item) => stableSignedEnvelopeJson(item)).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableSignedEnvelopeJson(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function signedEnvelopeContentHash(value: unknown) {
  return `sha256:${createHash("sha256").update(stableSignedEnvelopeJson(value)).digest("hex")}` as const;
}

export function turnCardSignedEnvelopeContent(input: TurnCardSignedEnvelopeInput) {
  return {
    actionOptionIds: input.actionOptions.map((option) => option.actionOptionId),
    agentId: input.agentId,
    envelopeId: input.envelopeId,
    expiresAt: input.expiresAt,
    explorerId: input.explorerId,
    nonce: input.nonce,
    protocolVersion: TURN_CARD_ENVELOPE_PROTOCOL_VERSION,
    regionId: input.regionId,
    runTicketId: null,
    sequence: input.sequence,
    trustClass: input.trustClass,
    turnCardId: input.turnCardId,
    visibleContext: input.visibleContext,
  };
}

export function buildSignedTurnCardEnvelope(
  input: TurnCardSignedEnvelopeInput,
): TurnCardCreatedPayload["signedEnvelope"] {
  const contentHash = signedEnvelopeContentHash(turnCardSignedEnvelopeContent(input));
  return {
    envelopeId: input.envelopeId,
    protocolVersion: TURN_CARD_ENVELOPE_PROTOCOL_VERSION,
    signatureAlgorithm: OBSIDIAN_EPOCH_PACKAGE_SIGNATURE_ALGORITHM,
    serverPublicKey: obsidianEpochReleasePublicKey(),
    contentHash,
    signature: signObsidianEpochReleasePayload(Buffer.from(contentHash, "utf8")),
    trustClass: input.trustClass,
    runTicketId: null,
  };
}

export function turnResolutionSignedEnvelopeContent(input: TurnResolutionSignedEnvelopeInput) {
  return {
    actionOptionId: input.actionOptionId,
    agentId: input.agentId,
    channelClass: input.trustClass,
    envelopeId: input.envelopeId,
    explanation: input.explanation,
    lifetimeDelta: input.lifetimeDelta,
    nonEvidence: input.nonEvidence,
    nonce: input.nonce,
    optionLabel: input.optionLabel,
    originalEnvelopeId: input.originalEnvelopeId,
    outcomeSummary: input.outcomeSummary,
    protocolVersion: TURN_RESOLUTION_ENVELOPE_PROTOCOL_VERSION,
    reward: input.reward,
    resolvedAt: input.resolvedAt,
    runTicketId: null,
    sequence: input.sequence,
    trustClass: input.trustClass,
    turnCardId: input.turnCardId,
    visibleText: input.visibleText,
  };
}

export function buildSignedTurnResolutionEnvelope(
  input: TurnResolutionSignedEnvelopeInput,
): TurnResolvedPayload["signedEnvelope"] {
  const contentHash = signedEnvelopeContentHash(turnResolutionSignedEnvelopeContent(input));
  return {
    envelopeId: input.envelopeId,
    protocolVersion: TURN_RESOLUTION_ENVELOPE_PROTOCOL_VERSION,
    signatureAlgorithm: OBSIDIAN_EPOCH_PACKAGE_SIGNATURE_ALGORITHM,
    serverPublicKey: obsidianEpochReleasePublicKey(),
    contentHash,
    signature: signObsidianEpochReleasePayload(Buffer.from(contentHash, "utf8")),
    trustClass: input.trustClass,
    runTicketId: null,
  };
}

export function hostedActionSignedEnvelopeContent(input: HostedActionSignedEnvelopeInput) {
  return {
    actionId: input.actionId,
    actionOptionId: input.actionOptionId,
    agentId: input.agentId,
    attestationId: input.attestationId,
    channelClass: input.channelClass,
    deliveryTrust: input.deliveryTrust,
    envelopeId: input.envelopeId,
    explanation: input.explanation,
    lifetimeDelta: input.lifetimeDelta,
    nonEvidence: input.nonEvidence,
    optionLabel: input.optionLabel,
    outcomeSummary: input.outcomeSummary,
    protocolVersion: HOSTED_ACTION_ENVELOPE_PROTOCOL_VERSION,
    recordedAt: input.recordedAt,
    reward: input.reward,
    risk: input.risk,
    runTicketId: null,
    sessionId: input.sessionId,
    socialHookId: input.socialHookId,
    trustClass: input.trustClass,
    visibleText: input.visibleText,
  };
}

export function buildSignedHostedActionEnvelope(
  input: HostedActionSignedEnvelopeInput,
): HostedActionRecordedPayload["signedEnvelope"] {
  const contentHash = signedEnvelopeContentHash(hostedActionSignedEnvelopeContent(input));
  return {
    envelopeId: input.envelopeId,
    protocolVersion: HOSTED_ACTION_ENVELOPE_PROTOCOL_VERSION,
    signatureAlgorithm: OBSIDIAN_EPOCH_PACKAGE_SIGNATURE_ALGORITHM,
    serverPublicKey: obsidianEpochReleasePublicKey(),
    contentHash,
    signature: signObsidianEpochReleasePayload(Buffer.from(contentHash, "utf8")),
    trustClass: input.trustClass,
    runTicketId: null,
  };
}
