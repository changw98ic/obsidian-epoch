import { readFileSync } from "node:fs";
import { type EpochAttestedRunnerConfig, type EpochAttestedRunnerTrustClass } from "./epoch/runtime.ts";
import { attestedRunnerSecretFingerprint } from "./attestationSigner.ts";

type EnvLike = Record<string, string | undefined>;

function trustClassFromEnv(value: unknown): EpochAttestedRunnerTrustClass | undefined {
  return value === "host_attested" ? "host_attested" : value === "remote_attested_runner" ? "remote_attested_runner" : undefined;
}

function runnerFromRecord(value: unknown): EpochAttestedRunnerConfig {
  if (!value || typeof value !== "object") throw new Error("attested_runner_object_required");
  const record = value as Record<string, unknown>;
  if (typeof record.runnerId !== "string" || record.runnerId.trim().length === 0) {
    throw new Error("attested_runner_id_required");
  }
  if (typeof record.secret !== "string" || record.secret.trim().length === 0) {
    throw new Error("attested_runner_secret_required");
  }
  const trustClass = trustClassFromEnv(record.trustClass);
  return {
    runnerId: record.runnerId.trim(),
    secret: record.secret,
    label: typeof record.label === "string" && record.label.trim() ? record.label.trim() : undefined,
    keyId: typeof record.keyId === "string" && record.keyId.trim() ? record.keyId.trim() : undefined,
    secretFingerprint: attestedRunnerSecretFingerprint(record.secret),
    trustClass,
    challengeTtlMs: typeof record.challengeTtlMs === "number" && Number.isFinite(record.challengeTtlMs)
      ? record.challengeTtlMs
      : undefined,
  };
}

export function attestedRunnersFromEnv(env: EnvLike): EpochAttestedRunnerConfig[] {
  const inlineJson = env.AGENT_SERVER_ATTESTED_RUNNERS?.trim();
  const jsonFile = env.AGENT_SERVER_ATTESTED_RUNNERS_FILE?.trim();
  const inlineSecret = env.AGENT_SERVER_ATTESTED_RUNNER_SECRET;
  const secretFile = env.AGENT_SERVER_ATTESTED_RUNNER_SECRET_FILE?.trim();
  if (inlineJson && jsonFile) throw new Error("attested_runners_source_ambiguous");
  if (inlineSecret?.trim() && secretFile) throw new Error("attested_runner_secret_source_ambiguous");
  if ((inlineJson || jsonFile) && (env.AGENT_SERVER_ATTESTED_RUNNER_ID?.trim() || inlineSecret?.trim() || secretFile)) {
    throw new Error("attested_runner_single_and_multi_source_ambiguous");
  }
  let json = inlineJson;
  if (jsonFile) {
    try {
      json = readFileSync(jsonFile, "utf8").trim();
    } catch {
      throw new Error("attested_runners_file_unreadable");
    }
    if (!json) throw new Error("attested_runners_file_empty");
  }
  if (json) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch {
      throw new Error("attested_runners_env_invalid_json");
    }
    if (!Array.isArray(parsed)) throw new Error("attested_runners_env_array_required");
    return parsed.map(runnerFromRecord);
  }

  const runnerId = env.AGENT_SERVER_ATTESTED_RUNNER_ID?.trim();
  let secret = inlineSecret;
  if (secretFile) {
    try {
      secret = readFileSync(secretFile, "utf8").trim();
    } catch {
      throw new Error("attested_runner_secret_file_unreadable");
    }
  }
  if (!runnerId && !secret) return [];
  if (!runnerId) throw new Error("attested_runner_id_required");
  if (!secret || !secret.trim()) throw new Error("attested_runner_secret_required");
  return [{
    runnerId,
    secret,
    label: env.AGENT_SERVER_ATTESTED_RUNNER_LABEL?.trim() || undefined,
    keyId: env.AGENT_SERVER_ATTESTED_RUNNER_KEY_ID?.trim() || undefined,
    secretFingerprint: attestedRunnerSecretFingerprint(secret),
    trustClass: trustClassFromEnv(env.AGENT_SERVER_ATTESTED_RUNNER_TRUST_CLASS),
  }];
}
