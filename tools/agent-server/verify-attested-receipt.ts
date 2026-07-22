import { readFileSync } from "node:fs";
import { verifyAttestedExecutionReceipt } from "./lib/attestationSigner.ts";
import { isDirectEntrypoint } from "./lib/cliEntrypoint.ts";

type UnknownRecord = Record<string, unknown>;

function valueAfter(flag: string) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function readSecret() {
  const direct = valueAfter("--secret");
  const directFile = valueAfter("--secret-file");
  const envName = valueAfter("--secret-env") || "AGENT_ATTESTED_RUNNER_SECRET";
  const envValue = process.env[envName];
  const envFile = process.env[`${envName}_FILE`];
  const sources = [direct?.trim(), directFile?.trim(), envValue?.trim(), envFile?.trim()].filter(Boolean);
  if (sources.length > 1) throw new Error("attestation_secret_source_ambiguous");
  if (typeof direct === "string" && direct.trim()) return direct;
  if (typeof envValue === "string" && envValue.trim()) return envValue;
  const filePath = directFile?.trim() || envFile?.trim();
  if (!filePath) throw new Error("attestation_secret_required");
  try {
    const value = readFileSync(filePath, "utf8").trim();
    if (!value) throw new Error("empty");
    return value;
  } catch {
    throw new Error("attestation_secret_file_unreadable");
  }
}

function readSignatureBase() {
  const direct = valueAfter("--signature-base");
  if (typeof direct === "string" && direct.trim()) return direct;
  const envName = valueAfter("--signature-base-env") || "OBSIDIAN_EPOCH_ATTESTED_SIGNATURE_BASE";
  const envValue = process.env[envName];
  if (typeof envValue === "string" && envValue.trim()) return envValue;
  throw new Error("attestation_signature_base_required");
}

function readSignatureHash() {
  const value = valueAfter("--signature-hash");
  if (typeof value === "string" && value.trim()) return value as `sha256:${string}`;
  throw new Error("attested_receipt_signature_hash_required");
}

function readOptionalSignatureBaseHash() {
  const value = valueAfter("--signature-base-hash");
  return typeof value === "string" && value.trim() ? value as `sha256:${string}` : undefined;
}

function readTrustedExecutionIndex() {
  const value = valueAfter("--trusted-execution-index");
  if (typeof value !== "string" || !value.trim()) return 0;
  const index = Number.parseInt(value, 10);
  if (!Number.isInteger(index) || index < 0) throw new Error("attested_receipt_trusted_execution_index_invalid");
  return index;
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function recordAt(record: UnknownRecord, key: string) {
  const value = record[key];
  return isRecord(value) ? value : undefined;
}

function parseJsonPayload(json: string) {
  try {
    return JSON.parse(json) as unknown;
  } catch {
    throw new Error("attested_receipt_json_invalid");
  }
}

function htmlReceiptJson(html: string) {
  const match = html.match(/<script\b(?=[^>]*\bid=["']obsidian-epoch-result-receipt-json["'])(?=[^>]*\btype=["']application\/json["'])[^>]*>([\s\S]*?)<\/script>/i);
  if (!match?.[1]) throw new Error("attested_receipt_json_script_missing");
  return match[1].trim();
}

function jsonOrHtmlPayload(text: string) {
  const trimmed = text.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) return parseJsonPayload(trimmed);
  return parseJsonPayload(htmlReceiptJson(text));
}

async function fetchResultUrl(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`attested_receipt_url_fetch_failed:${response.status}`);
  return response.text();
}

function receiptCandidates(value: unknown): UnknownRecord[] {
  if (!isRecord(value)) return [];
  const payload = recordAt(value, "payload");
  const page = recordAt(value, "page");
  const pagePayload = page ? recordAt(page, "payload") : undefined;
  return [
    value,
    recordAt(value, "receipt"),
    payload ? recordAt(payload, "receipt") : undefined,
    pagePayload ? recordAt(pagePayload, "receipt") : undefined,
  ].filter((candidate): candidate is UnknownRecord => isRecord(candidate));
}

function trustedExecutionFromPayload(value: unknown, index: number): UnknownRecord {
  const trusted = trustedExecutionsFromPayload(value)[index];
  if (trusted) return trusted;
  throw new Error("attested_receipt_trusted_execution_missing");
}

function trustedExecutionsFromPayload(value: unknown): UnknownRecord[] {
  for (const candidate of receiptCandidates(value)) {
    const trustedExecution = candidate.trustedExecution;
    if (Array.isArray(trustedExecution)) {
      return trustedExecution.filter(isRecord);
    }
    if (typeof candidate.signatureBase === "string" && typeof candidate.signatureHash === "string") {
      return [candidate];
    }
  }
  throw new Error("attested_receipt_trusted_execution_missing");
}

function verificationInputFromTrustedExecution(trusted: UnknownRecord) {
  const signatureBase = trusted.signatureBase;
  const signatureHash = trusted.signatureHash;
  const signatureBaseHash = trusted.signatureBaseHash;
  if (typeof signatureBase !== "string" || !signatureBase.trim()) throw new Error("attestation_signature_base_required");
  if (typeof signatureHash !== "string" || !signatureHash.trim()) throw new Error("attested_receipt_signature_hash_required");
  return {
    signatureBase,
    signatureHash: signatureHash as `sha256:${string}`,
    ...(typeof signatureBaseHash === "string" && signatureBaseHash.trim()
      ? { signatureBaseHash: signatureBaseHash as `sha256:${string}` }
      : {}),
  };
}

async function readPayloadArgument() {
  const resultUrl = valueAfter("--result-url");
  if (typeof resultUrl === "string" && resultUrl.trim()) {
    return jsonOrHtmlPayload(await fetchResultUrl(resultUrl));
  }
  const resultJson = valueAfter("--result-json");
  if (typeof resultJson === "string" && resultJson.trim()) {
    return parseJsonPayload(resultJson);
  }
  const receiptJson = valueAfter("--receipt-json");
  if (typeof receiptJson === "string" && receiptJson.trim()) {
    return parseJsonPayload(receiptJson);
  }
  return undefined;
}

async function readVerificationInput() {
  const index = readTrustedExecutionIndex();
  const payload = await readPayloadArgument();
  if (payload) {
    return verificationInputFromTrustedExecution(trustedExecutionFromPayload(payload, index));
  }
  const signatureBaseHash = readOptionalSignatureBaseHash();
  return {
    signatureBase: readSignatureBase(),
    signatureHash: readSignatureHash(),
    ...(signatureBaseHash ? { signatureBaseHash } : {}),
  };
}

async function readAllVerificationInputs() {
  const payload = await readPayloadArgument();
  if (!payload) throw new Error("attested_receipt_json_required_for_batch");
  return trustedExecutionsFromPayload(payload).map(verificationInputFromTrustedExecution);
}

function renderHumanOutput(verification: ReturnType<typeof verifyAttestedExecutionReceipt>) {
  return [
    "Obsidian Epoch attested receipt verified.",
    "",
    `Algorithm: ${verification.algorithm}`,
    `Signature hash: ${verification.recomputedSignatureHash}`,
    `Signature base hash: ${verification.recomputedSignatureBaseHash}`,
  ].join("\n");
}

function renderBatchHumanOutput(batch: ReturnType<typeof verifyAllTrustedExecutions>) {
  return [
    "Obsidian Epoch attested receipt batch verified.",
    "",
    `Algorithm: ${batch.algorithm}`,
    `Trusted executions: ${batch.trustedExecutionCount}`,
    `Verified indexes: ${batch.verifiedIndexes.join(", ")}`,
  ].join("\n");
}

function verifyAllTrustedExecutions(
  inputs: readonly ReturnType<typeof verificationInputFromTrustedExecution>[],
  secret: string,
) {
  const verifications = inputs.map((input, index) => ({
    index,
    ...verifyAttestedExecutionReceipt(input, secret),
  }));
  return {
    type: "obsidian_epoch_attested_receipt_verification_batch",
    algorithm: "HMAC-SHA256",
    verified: true,
    trustedExecutionCount: verifications.length,
    verifiedIndexes: verifications.map((verification) => verification.index),
    verifications,
  } as const;
}

async function main() {
  const secret = readSecret();
  if (process.argv.includes("--all-trusted-executions")) {
    const batch = verifyAllTrustedExecutions(await readAllVerificationInputs(), secret);
    if (process.argv.includes("--json")) {
      console.log(JSON.stringify(batch));
    } else {
      console.log(renderBatchHumanOutput(batch));
    }
    return;
  }
  const verification = verifyAttestedExecutionReceipt(await readVerificationInput(), secret);
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(verification));
  } else {
    console.log(renderHumanOutput(verification));
  }
}

if (isDirectEntrypoint(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
