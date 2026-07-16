import { attestationSignatureHex, attestedRunnerSecretFingerprint } from "../attestationSigner.ts";
import {
  EPOCH_PROTOCOL_VERSION,
  assertNonEmptyString,
  type EpochCommandContext,
  type EpochIdFactory,
} from "./protocol.ts";
import { idempotencySubjectHash } from "./idempotencyRules.ts";
import { type EpochHostedActionRecord, type EpochProjection, type SubmitHostedActionInput } from "./gameCore.ts";
import type { EpochRuntimeResult } from "./runtime.ts";
import { sha256Hex, signaturesMatch } from "./runtimeAuth.ts";

type AnyRecord = Readonly<Record<string, unknown>>;

export type EpochAttestedRunnerTrustClass = "host_attested" | "remote_attested_runner";

export interface EpochAttestedRunnerConfig {
  readonly runnerId: string;
  readonly label?: string;
  readonly secret: string;
  readonly keyId?: string;
  readonly secretFingerprint?: `sha256:${string}`;
  readonly trustClass?: EpochAttestedRunnerTrustClass;
  readonly challengeTtlMs?: number;
}

export interface EpochAttestationChallenge {
  readonly challengeId: string;
  readonly runnerId: string;
  readonly sessionId: string;
  readonly actionOptionId: string;
  readonly transcriptHash: string;
  readonly signatureBase: string;
  readonly issuedAt: string;
  readonly expiresAt: string;
}

export interface EpochAttestationChallengeResult {
  readonly challenge: EpochAttestationChallenge;
  readonly duplicate?: boolean;
}

interface StoredAttestationChallenge extends EpochAttestationChallenge {
  used: boolean;
  expiresAtMs: number;
}

export interface AttestationRuntime {
  readonly runners: () => readonly EpochAttestedRunnerConfig[];
  readonly issueChallenge: (input?: AnyRecord) => EpochAttestationChallengeResult;
  readonly submitAction: (input?: AnyRecord) => EpochRuntimeResult<EpochHostedActionRecord>;
}

export interface AttestationRuntimeOptions {
  readonly clock: () => Date;
  readonly defaultChallengeTtlMs: number;
  readonly idFactory: EpochIdFactory;
  readonly runners: readonly EpochAttestedRunnerConfig[];
  readonly project: () => EpochProjection;
  readonly assertAbuseAllowed: (input: AnyRecord) => void;
  readonly requireActiveIdentity: (agentId: string) => void;
  readonly submitHostedAction: (
    input: SubmitHostedActionInput,
    context: EpochCommandContext,
  ) => EpochRuntimeResult<EpochHostedActionRecord>;
}

export function attestedRunnerKeyId(runner: EpochAttestedRunnerConfig) {
  return runner.keyId || runner.secretFingerprint || attestedRunnerSecretFingerprint(runner.secret);
}

export function attestedRunnerTrustClass(runner: EpochAttestedRunnerConfig): EpochAttestedRunnerTrustClass {
  return runner.trustClass === "host_attested" ? "host_attested" : "remote_attested_runner";
}

export function attestationSignatureBase(input: Omit<EpochAttestationChallenge, "signatureBase">) {
  return JSON.stringify({
    protocol: EPOCH_PROTOCOL_VERSION,
    runnerId: input.runnerId,
    challengeId: input.challengeId,
    sessionId: input.sessionId,
    actionOptionId: input.actionOptionId,
    transcriptHash: input.transcriptHash,
    issuedAt: input.issuedAt,
    expiresAt: input.expiresAt,
  });
}

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function publicChallenge(challenge: StoredAttestationChallenge): EpochAttestationChallenge {
  return {
    challengeId: challenge.challengeId,
    runnerId: challenge.runnerId,
    sessionId: challenge.sessionId,
    actionOptionId: challenge.actionOptionId,
    transcriptHash: challenge.transcriptHash,
    signatureBase: challenge.signatureBase,
    issuedAt: challenge.issuedAt,
    expiresAt: challenge.expiresAt,
  };
}

export function createAttestationRuntime(options: AttestationRuntimeOptions): AttestationRuntime {
  const challengeIdempotency = new Map<string, string>();
  const challengeSubjects = new Map<string, { readonly subjectHash: string }>();
  const challenges = new Map<string, StoredAttestationChallenge>();
  const runners = new Map<string, EpochAttestedRunnerConfig>();

  for (const runner of options.runners) {
    if (runner?.runnerId && runner.secret) {
      runners.set(runner.runnerId, runner);
    }
  }

  function issueChallenge(input: AnyRecord = {}): EpochAttestationChallengeResult {
    if (typeof input.idempotencyKey !== "string" || input.idempotencyKey.trim().length === 0) {
      throw new Error("idempotency_key_required");
    }
    const key = `attestation_challenge:${input.idempotencyKey.trim()}`;
    const subjectHash = idempotencySubjectHash("attestation_challenge", "attestation", input);
    const existingChallengeId = challengeIdempotency.get(key);
    if (existingChallengeId) {
      const record = challengeSubjects.get(key);
      if (!record || record.subjectHash !== subjectHash) {
        throw new Error("idempotency_key_conflict");
      }
      const challenge = challenges.get(existingChallengeId);
      if (!challenge) throw new Error("attestation_challenge_not_found");
      return { challenge: publicChallenge(challenge), duplicate: true };
    }
    options.assertAbuseAllowed(input);
    const runnerId = assertNonEmptyString(input.runnerId, "attested_runner_id");
    const runner = runners.get(runnerId);
    if (!runner) throw new Error("attested_runner_not_found");
    const sessionId = assertNonEmptyString(input.sessionId, "hosted_session_id");
    const actionOptionId = assertNonEmptyString(input.actionOptionId, "hosted_action_option_id");
    const transcriptHash = assertNonEmptyString(input.transcriptHash, "attestation_transcript_hash");
    const session = options.project().hostedSessions[sessionId];
    if (!session) throw new Error("hosted_session_not_found");
    if (session.status !== "active") throw new Error("hosted_session_not_active");
    options.requireActiveIdentity(session.agentId);
    if (!session.actionOptions.some((option) => option.actionOptionId === actionOptionId)) {
      throw new Error("hosted_action_option_not_found");
    }
    const issuedAtMs = options.clock().getTime();
    const issuedAt = new Date(issuedAtMs).toISOString();
    const expiresAtMs = issuedAtMs + Math.max(1, Number(runner.challengeTtlMs || options.defaultChallengeTtlMs));
    const expiresAt = new Date(expiresAtMs).toISOString();
    const challengeId = options.idFactory(
      "challenge",
      `${runnerId}:${sessionId}:${actionOptionId}:${transcriptHash}:${input.idempotencyKey}`,
    );
    const signatureBaseInput = {
      challengeId,
      runnerId,
      sessionId,
      actionOptionId,
      transcriptHash,
      issuedAt,
      expiresAt,
    };
    const challenge: StoredAttestationChallenge = {
      ...signatureBaseInput,
      signatureBase: attestationSignatureBase(signatureBaseInput),
      expiresAtMs,
      used: false,
    };
    challenges.set(challengeId, challenge);
    challengeIdempotency.set(key, challengeId);
    challengeSubjects.set(key, { subjectHash });
    return { challenge: publicChallenge(challenge) };
  }

  function submitAction(input: AnyRecord = {}): EpochRuntimeResult<EpochHostedActionRecord> {
    const runnerId = assertNonEmptyString(input.runnerId, "attested_runner_id");
    const runner = runners.get(runnerId);
    if (!runner) throw new Error("attested_runner_not_found");
    const challengeId = assertNonEmptyString(input.challengeId, "attestation_challenge_id");
    const challenge = challenges.get(challengeId);
    if (!challenge) throw new Error("attestation_challenge_not_found");
    if (challenge.used) throw new Error("attestation_challenge_already_used");
    if (options.clock().getTime() > challenge.expiresAtMs) throw new Error("attestation_challenge_expired");
    const sessionId = assertNonEmptyString(input.sessionId, "hosted_session_id");
    const actionOptionId = assertNonEmptyString(input.actionOptionId, "hosted_action_option_id");
    const transcriptHash = assertNonEmptyString(input.transcriptHash, "attestation_transcript_hash");
    if (
      challenge.runnerId !== runnerId
      || challenge.sessionId !== sessionId
      || challenge.actionOptionId !== actionOptionId
      || challenge.transcriptHash !== transcriptHash
    ) {
      throw new Error("attestation_challenge_mismatch");
    }
    const signature = assertNonEmptyString(input.signature, "attestation_signature");
    const expectedSignature = attestationSignatureHex(runner.secret, challenge.signatureBase);
    if (!signaturesMatch(signature, expectedSignature)) {
      throw new Error("attestation_signature_invalid");
    }
    const attestationId = options.idFactory("attestation", `${runnerId}:${challengeId}:${signature}`);
    const result = options.submitHostedAction({
      sessionId,
      actionOptionId,
      visibleText: typeof input.visibleText === "string" ? input.visibleText : undefined,
      attestation: {
        attestationId,
        runnerId,
        runnerKeyId: attestedRunnerKeyId(runner),
        challengeId,
        transcriptHash,
        signature,
        signatureBase: challenge.signatureBase,
        signatureBaseHash: `sha256:${sha256Hex(challenge.signatureBase)}`,
      },
    }, {
      actorExplorerId: runnerId,
      trustClass: attestedRunnerTrustClass(runner),
      idempotencyKey: optionalString(input.idempotencyKey),
      causationId: typeof input.causationId === "string" ? input.causationId : undefined,
      correlationId: typeof input.correlationId === "string" ? input.correlationId : undefined,
    });
    challenge.used = true;
    return result;
  }

  return {
    runners: () => [...runners.values()],
    issueChallenge,
    submitAction,
  };
}
