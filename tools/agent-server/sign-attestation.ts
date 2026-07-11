import { readFileSync } from "node:fs";
import { attestationChallengeFromJson, signAttestationChallenge } from "./lib/attestationSigner.ts";

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

function readChallenge() {
  const challengeJson = valueAfter("--challenge-json");
  if (typeof challengeJson === "string" && challengeJson.trim()) {
    return attestationChallengeFromJson(challengeJson);
  }
  const signatureBase = valueAfter("--signature-base");
  if (typeof signatureBase !== "string" || !signatureBase.trim()) {
    throw new Error("attestation_signature_base_required");
  }
  return { signatureBase };
}

function renderHumanOutput(material: ReturnType<typeof signAttestationChallenge>) {
  return [
    "Obsidian Epoch attestation signature generated.",
    "",
    `Algorithm: ${material.algorithm}`,
    `Signature base hash: ${material.signatureBaseHash}`,
    `Signature: ${material.signature}`,
    "",
    "Submit these fields with obsidian_epoch.submit_attested_action:",
    JSON.stringify(material.submitFields, null, 2),
  ].join("\n");
}

function main() {
  const material = signAttestationChallenge(readChallenge(), readSecret());
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(material));
  } else {
    console.log(renderHumanOutput(material));
  }
}

if (process.argv[1] && import.meta.url === new URL(process.argv[1], "file:").href) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
