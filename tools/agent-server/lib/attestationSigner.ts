import { createHash, createHmac } from "node:crypto";

export interface AttestationChallengeLike {
  readonly challengeId?: string;
  readonly runnerId?: string;
  readonly sessionId?: string;
  readonly actionOptionId?: string;
  readonly transcriptHash?: string;
  readonly signatureBase: string;
}

export interface AttestationSignatureMaterial {
  readonly type: "obsidian_epoch_attestation_signature";
  readonly algorithm: "HMAC-SHA256";
  readonly runnerId?: string;
  readonly challengeId?: string;
  readonly sessionId?: string;
  readonly actionOptionId?: string;
  readonly transcriptHash?: string;
  readonly signatureBaseHash: `sha256:${string}`;
  readonly signature: string;
  readonly submitFields: {
    readonly runnerId?: string;
    readonly challengeId?: string;
    readonly sessionId?: string;
    readonly actionOptionId?: string;
    readonly transcriptHash?: string;
    readonly signature: string;
    readonly signatureBaseHash: `sha256:${string}`;
  };
}

export interface AttestedReceiptVerificationInput {
  readonly signatureBase: string;
  readonly signatureHash: `sha256:${string}`;
  readonly signatureBaseHash?: `sha256:${string}`;
}

export interface AttestedReceiptVerification {
  readonly type: "obsidian_epoch_attested_receipt_verification";
  readonly algorithm: "HMAC-SHA256";
  readonly verified: true;
  readonly signatureHash: `sha256:${string}`;
  readonly recomputedSignatureHash: `sha256:${string}`;
  readonly signatureHashMatches: true;
  readonly signatureBaseHash?: `sha256:${string}`;
  readonly recomputedSignatureBaseHash: `sha256:${string}`;
  readonly signatureBaseHashMatches?: true;
}

function sha256Hex(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function sha256Prefixed(value: string) {
  return `sha256:${sha256Hex(value)}` as const;
}

export function attestationSignatureHex(secret: string, signatureBase: string) {
  return createHmac("sha256", secret).update(signatureBase).digest("hex");
}

export function attestedRunnerSecretFingerprint(secret: string) {
  return `sha256:${sha256Hex(secret).slice(0, 16)}` as const;
}

export function signAttestationChallenge(
  input: AttestationChallengeLike,
  secret: string,
): AttestationSignatureMaterial {
  if (!secret.trim()) throw new Error("attestation_secret_required");
  if (!input.signatureBase.trim()) throw new Error("attestation_signature_base_required");
  const signature = attestationSignatureHex(secret, input.signatureBase);
  const signatureBaseHash = `sha256:${sha256Hex(input.signatureBase)}` as const;
  return {
    type: "obsidian_epoch_attestation_signature",
    algorithm: "HMAC-SHA256",
    runnerId: input.runnerId,
    challengeId: input.challengeId,
    sessionId: input.sessionId,
    actionOptionId: input.actionOptionId,
    transcriptHash: input.transcriptHash,
    signatureBaseHash,
    signature,
    submitFields: {
      runnerId: input.runnerId,
      challengeId: input.challengeId,
      sessionId: input.sessionId,
      actionOptionId: input.actionOptionId,
      transcriptHash: input.transcriptHash,
      signature,
      signatureBaseHash,
    },
  };
}

export function attestationSignatureHash(secret: string, signatureBase: string) {
  if (!secret.trim()) throw new Error("attestation_secret_required");
  if (!signatureBase.trim()) throw new Error("attestation_signature_base_required");
  return sha256Prefixed(attestationSignatureHex(secret, signatureBase));
}

export function verifyAttestedExecutionReceipt(
  input: AttestedReceiptVerificationInput,
  secret: string,
): AttestedReceiptVerification {
  if (!input.signatureHash.trim()) throw new Error("attested_receipt_signature_hash_required");
  const recomputedSignatureHash = attestationSignatureHash(secret, input.signatureBase);
  const recomputedSignatureBaseHash = sha256Prefixed(input.signatureBase);
  if (input.signatureHash !== recomputedSignatureHash) {
    throw new Error("attested_receipt_signature_hash_mismatch");
  }
  if (input.signatureBaseHash && input.signatureBaseHash !== recomputedSignatureBaseHash) {
    throw new Error("attested_receipt_signature_base_hash_mismatch");
  }
  return {
    type: "obsidian_epoch_attested_receipt_verification",
    algorithm: "HMAC-SHA256",
    verified: true,
    signatureHash: input.signatureHash,
    recomputedSignatureHash,
    signatureHashMatches: true,
    recomputedSignatureBaseHash,
    ...(input.signatureBaseHash ? {
      signatureBaseHash: input.signatureBaseHash,
      signatureBaseHashMatches: true,
    } : {}),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalString(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function attestationChallengeFromJson(json: string): AttestationChallengeLike {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("attestation_challenge_json_invalid");
  }
  const container = isRecord(parsed) && isRecord(parsed.challenge) ? parsed.challenge : parsed;
  if (!isRecord(container)) throw new Error("attestation_challenge_json_object_required");
  const signatureBase = optionalString(container, "signatureBase");
  if (!signatureBase) throw new Error("attestation_signature_base_required");
  return {
    challengeId: optionalString(container, "challengeId"),
    runnerId: optionalString(container, "runnerId"),
    sessionId: optionalString(container, "sessionId"),
    actionOptionId: optionalString(container, "actionOptionId"),
    transcriptHash: optionalString(container, "transcriptHash"),
    signatureBase,
  };
}
