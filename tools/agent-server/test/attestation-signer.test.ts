import assert from "node:assert/strict";
import { createHmac, createHash } from "node:crypto";
import { once } from "node:events";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const graphAppRoot = resolve(repoRoot, "tools/graph-react-app");

async function runSigner(args: string[], env: NodeJS.ProcessEnv = {}) {
  const child = spawn("npm", ["run", "agent:sign-attestation", "--", ...args], {
    cwd: graphAppRoot,
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      ...env,
    },
  });
  const stdoutChunks: Buffer[] = [];
  const stderrChunks: Buffer[] = [];
  child.stdout.on("data", (chunk) => stdoutChunks.push(Buffer.from(chunk)));
  child.stderr.on("data", (chunk) => stderrChunks.push(Buffer.from(chunk)));
  const [code] = await once(child, "exit");
  return {
    code,
    stdout: Buffer.concat(stdoutChunks).toString("utf8"),
    stderr: Buffer.concat(stderrChunks).toString("utf8"),
  };
}

async function runReceiptVerifier(args: string[], env: NodeJS.ProcessEnv = {}) {
  const child = spawn("npm", ["run", "agent:verify-attested-receipt", "--", ...args], {
    cwd: graphAppRoot,
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      ...env,
    },
  });
  const stdoutChunks: Buffer[] = [];
  const stderrChunks: Buffer[] = [];
  child.stdout.on("data", (chunk) => stdoutChunks.push(Buffer.from(chunk)));
  child.stderr.on("data", (chunk) => stderrChunks.push(Buffer.from(chunk)));
  const [code] = await once(child, "exit");
  return {
    code,
    stdout: Buffer.concat(stdoutChunks).toString("utf8"),
    stderr: Buffer.concat(stderrChunks).toString("utf8"),
  };
}

function parseLastJsonLine(stdout: string) {
  return JSON.parse(stdout.trim().split(/\r?\n/).at(-1) || "{}");
}

function expectedSignature(secret: string, signatureBase: string) {
  return createHmac("sha256", secret).update(signatureBase).digest("hex");
}

function expectedSignatureHash(secret: string, signatureBase: string) {
  return `sha256:${createHash("sha256").update(expectedSignature(secret, signatureBase)).digest("hex")}`;
}

function trustedExecutionFixture(secret: string, signatureBase: string) {
  return {
    receiptType: "trusted_execution_receipt",
    attestationId: "attestation_fixture_1",
    runnerId: "runner_fixture_1",
    challengeId: "challenge_fixture_1",
    sessionId: "session_fixture_1",
    actionId: "action_fixture_1",
    actionOptionId: "action_fixture_observe",
    optionLabel: "Observe",
    transcriptHash: "sha256:fixture_transcript",
    signatureBase,
    signatureHash: expectedSignatureHash(secret, signatureBase),
    signatureBaseHash: `sha256:${createHash("sha256").update(signatureBase).digest("hex")}`,
    resultPagePayloadHash: "sha256:fixture_payload_hash",
  };
}

test("attestation signer emits the same HMAC signature the server verifies", async () => {
  const signatureBase = JSON.stringify({
    protocol: "obsidian-epoch.v1",
    runnerId: "runner_host_1",
    challengeId: "challenge_1",
    sessionId: "session_1",
    actionOptionId: "action_observe",
    transcriptHash: "sha256:transcript",
    issuedAt: "2026-06-29T00:00:00.000Z",
    expiresAt: "2026-06-29T00:05:00.000Z",
  });
  const secret = "host-runner-secret";
  const result = await runSigner(["--secret", secret, "--signature-base", signatureBase, "--json"]);
  assert.equal(result.code, 0, result.stderr || result.stdout);
  const body = parseLastJsonLine(result.stdout);

  assert.equal(body.type, "obsidian_epoch_attestation_signature");
  assert.equal(body.algorithm, "HMAC-SHA256");
  assert.equal(body.signature, expectedSignature(secret, signatureBase));
  assert.equal(body.signatureBaseHash, `sha256:${createHash("sha256").update(signatureBase).digest("hex")}`);
  assert.equal(body.submitFields.signature, body.signature);
  assert.equal(body.submitFields.signatureBaseHash, body.signatureBaseHash);
});

test("attestation signer reads challenge JSON and runner secret from env", async () => {
  const challenge = {
    challengeId: "challenge_env_1",
    runnerId: "runner_env_1",
    sessionId: "session_env_1",
    actionOptionId: "action_env_1",
    transcriptHash: "sha256:env_transcript",
    signatureBase: "server-issued-signature-base",
    expiresAt: "2026-06-29T00:05:00.000Z",
  };
  const result = await runSigner([
    "--secret-env",
    "TEST_ATTESTED_RUNNER_SECRET",
    "--challenge-json",
    JSON.stringify({ challenge }),
    "--json",
  ], {
    TEST_ATTESTED_RUNNER_SECRET: "env-runner-secret",
  });
  assert.equal(result.code, 0, result.stderr || result.stdout);
  const body = parseLastJsonLine(result.stdout);

  assert.equal(body.runnerId, challenge.runnerId);
  assert.equal(body.challengeId, challenge.challengeId);
  assert.equal(body.sessionId, challenge.sessionId);
  assert.equal(body.actionOptionId, challenge.actionOptionId);
  assert.equal(body.transcriptHash, challenge.transcriptHash);
  assert.equal(body.signature, expectedSignature("env-runner-secret", challenge.signatureBase));
  assert.equal(body.submitFields.runnerId, challenge.runnerId);
  assert.equal(body.submitFields.challengeId, challenge.challengeId);
  assert.equal(body.submitFields.sessionId, challenge.sessionId);
  assert.equal(body.submitFields.actionOptionId, challenge.actionOptionId);
  assert.equal(body.submitFields.transcriptHash, challenge.transcriptHash);
});

test("attestation signer and receipt verifier read runner secrets from files", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "attestation-secret-file-"));
  const secretFile = join(tempDir, "runner-secret.txt");
  const secret = "runner-secret-loaded-from-file";
  const signatureBase = "server-issued-signature-base-from-file";
  await writeFile(secretFile, `${secret}\n`, { mode: 0o600 });
  try {
    const signed = await runSigner([
      "--secret-file",
      secretFile,
      "--signature-base",
      signatureBase,
      "--json",
    ]);
    assert.equal(signed.code, 0, signed.stderr || signed.stdout);
    assert.equal(parseLastJsonLine(signed.stdout).signature, expectedSignature(secret, signatureBase));
    const verified = await runReceiptVerifier([
      "--secret-file",
      secretFile,
      "--signature-base",
      signatureBase,
      "--signature-hash",
      expectedSignatureHash(secret, signatureBase),
      "--json",
    ]);
    assert.equal(verified.code, 0, verified.stderr || verified.stdout);
    assert.equal(parseLastJsonLine(verified.stdout).verified, true);
    assert.doesNotMatch(`${signed.stdout}${signed.stderr}${verified.stdout}${verified.stderr}`, new RegExp(secret));

    const ambiguous = await runSigner([
      "--secret",
      secret,
      "--secret-file",
      secretFile,
      "--signature-base",
      signatureBase,
      "--json",
    ]);
    assert.notEqual(ambiguous.code, 0);
    assert.match(ambiguous.stderr || ambiguous.stdout, /attestation_secret_source_ambiguous/);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("attestation signer refuses missing runner secrets", async () => {
  const result = await runSigner([
    "--secret-env",
    "MISSING_ATTESTED_RUNNER_SECRET",
    "--signature-base",
    "server-issued-signature-base",
    "--json",
  ], {
    MISSING_ATTESTED_RUNNER_SECRET: "",
  });
  assert.notEqual(result.code, 0);
  assert.match(result.stderr || result.stdout, /attestation_secret_required/);
});

test("attested receipt verifier recomputes public trusted execution hashes", async () => {
  const secret = "host-runner-secret";
  const signatureBase = JSON.stringify({
    protocol: "obsidian-epoch.v1",
    runnerId: "runner_host_1",
    challengeId: "challenge_receipt_1",
    sessionId: "session_receipt_1",
    actionOptionId: "action_observe",
    transcriptHash: "sha256:receipt_transcript",
    issuedAt: "2026-07-03T00:00:00.000Z",
    expiresAt: "2026-07-03T00:05:00.000Z",
  });
  const signatureBaseHash = `sha256:${createHash("sha256").update(signatureBase).digest("hex")}`;
  const signatureHash = expectedSignatureHash(secret, signatureBase);

  const result = await runReceiptVerifier([
    "--secret",
    secret,
    "--signature-base",
    signatureBase,
    "--signature-hash",
    signatureHash,
    "--signature-base-hash",
    signatureBaseHash,
    "--json",
  ]);
  assert.equal(result.code, 0, result.stderr || result.stdout);
  const body = parseLastJsonLine(result.stdout);

  assert.equal(body.type, "obsidian_epoch_attested_receipt_verification");
  assert.equal(body.algorithm, "HMAC-SHA256");
  assert.equal(body.verified, true);
  assert.equal(body.signatureHashMatches, true);
  assert.equal(body.signatureBaseHashMatches, true);
  assert.equal(body.recomputedSignatureHash, signatureHash);
  assert.equal(body.recomputedSignatureBaseHash, signatureBaseHash);
});

test("attested receipt verifier rejects mismatched signature hashes", async () => {
  const result = await runReceiptVerifier([
    "--secret",
    "host-runner-secret",
    "--signature-base",
    "server-issued-signature-base",
    "--signature-hash",
    "sha256:wrong",
    "--json",
  ]);

  assert.notEqual(result.code, 0);
  assert.match(result.stderr || result.stdout, /attested_receipt_signature_hash_mismatch/);
});

test("attested receipt verifier extracts trusted execution from result page JSON", async () => {
  const secret = "host-runner-secret";
  const correctSignatureBase = "server-issued-signature-base-for-full-result-json";
  const resultJson = {
    page: {
      payload: {
        receipt: {
          receiptType: "server_result_receipt",
          trustedExecution: [
            { ...trustedExecutionFixture(secret, "wrong-signature-base"), signatureHash: "sha256:wrong" },
            trustedExecutionFixture(secret, correctSignatureBase),
          ],
        },
      },
    },
  };

  const result = await runReceiptVerifier([
    "--secret",
    secret,
    "--result-json",
    JSON.stringify(resultJson),
    "--trusted-execution-index",
    "1",
    "--json",
  ]);
  assert.equal(result.code, 0, result.stderr || result.stdout);
  const body = parseLastJsonLine(result.stdout);

  assert.equal(body.verified, true);
  assert.equal(body.recomputedSignatureHash, expectedSignatureHash(secret, correctSignatureBase));
});

test("attested receipt verifier verifies every trusted execution in a result page JSON", async () => {
  const secret = "host-runner-secret";
  const firstSignatureBase = "server-issued-signature-base-for-batch-1";
  const secondSignatureBase = "server-issued-signature-base-for-batch-2";
  const resultJson = {
    page: {
      payload: {
        receipt: {
          receiptType: "server_result_receipt",
          trustedExecution: [
            trustedExecutionFixture(secret, firstSignatureBase),
            trustedExecutionFixture(secret, secondSignatureBase),
          ],
        },
      },
    },
  };

  const result = await runReceiptVerifier([
    "--secret",
    secret,
    "--result-json",
    JSON.stringify(resultJson),
    "--all-trusted-executions",
    "--json",
  ]);
  assert.equal(result.code, 0, result.stderr || result.stdout);
  const body = parseLastJsonLine(result.stdout);

  assert.equal(body.type, "obsidian_epoch_attested_receipt_verification_batch");
  assert.equal(body.verified, true);
  assert.equal(body.trustedExecutionCount, 2);
  assert.deepEqual(body.verifiedIndexes, [0, 1]);
  assert.equal(body.verifications[0].recomputedSignatureHash, expectedSignatureHash(secret, firstSignatureBase));
  assert.equal(body.verifications[1].recomputedSignatureHash, expectedSignatureHash(secret, secondSignatureBase));
});

test("attested receipt verifier fetches trusted execution from public result page URLs", async () => {
  const secret = "host-runner-secret";
  const signatureBase = "server-issued-signature-base-for-url";
  const receipt = {
    receiptType: "server_result_receipt",
    trustedExecution: [trustedExecutionFixture(secret, signatureBase)],
  };
  const server = createServer((_, response) => {
    response.setHeader("content-type", "text/html; charset=utf-8");
    response.end(`<!doctype html><script id="obsidian-epoch-result-receipt-json" type="application/json">${JSON.stringify(receipt).replace(/</g, "\\u003c")}</script>`);
  });
  await new Promise<void>((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
  try {
    const address = server.address() as AddressInfo;
    const result = await runReceiptVerifier([
      "--secret",
      secret,
      "--result-url",
      `http://127.0.0.1:${address.port}/epoch/result/page_fixture`,
      "--json",
    ]);
    assert.equal(result.code, 0, result.stderr || result.stdout);
    const body = parseLastJsonLine(result.stdout);

    assert.equal(body.verified, true);
    assert.equal(body.recomputedSignatureBaseHash, receipt.trustedExecution[0].signatureBaseHash);
  } finally {
    await new Promise<void>((resolveClose, rejectClose) => {
      server.close((error) => error ? rejectClose(error) : resolveClose());
    });
  }
});
