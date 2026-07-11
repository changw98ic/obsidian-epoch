import assert from "node:assert/strict";
import test from "node:test";
import {
  constantTimeTextEqual,
  decodeExplorerRecoveryCode,
  explorerAuthCredentialFromInput,
  explorerSecretHash,
  hashValuesMatch,
  sha256Hex,
  signaturesMatch,
} from "../lib/epoch/runtimeAuth.ts";
import { createEpochRuntime } from "../lib/epoch/runtime.ts";

function recoveryCode(payload: unknown) {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64");
}

test("runtime auth hashes explorer local secrets with stable sha256 prefix", () => {
  const expected = `sha256:${sha256Hex("explorer_auth_1:local_secret_1")}`;
  assert.equal(explorerSecretHash("explorer_auth_1", "local_secret_1"), expected);
  assert.equal(hashValuesMatch(expected, expected.slice("sha256:".length)), true);
  assert.equal(hashValuesMatch(expected, "sha256:not-a-hash"), false);
});

test("runtime auth compares same-length signatures without accepting length mismatches", () => {
  const signature = sha256Hex("payload");
  assert.equal(signaturesMatch(signature, signature.toUpperCase()), true);
  assert.equal(signaturesMatch(signature, signature.slice(2)), false);
});

test("runtime auth compares arbitrary credential text without accepting mismatches", () => {
  const credential = "operator-key-with-unicode-黑曜-1234567890";
  assert.equal(constantTimeTextEqual(credential, credential), true);
  assert.equal(constantTimeTextEqual(credential, `${credential.slice(0, -1)}1`), false);
  assert.equal(constantTimeTextEqual(credential, `${credential}x`), false);
});

test("runtime operator authorization preserves its error contract with constant-time comparison", () => {
  const operatorKey = "runtime-operator-key-at-least-32-characters";
  const runtime = createEpochRuntime({ operatorKey });

  assert.doesNotThrow(() => runtime.operatorOverview({ operatorKey }));
  assert.throws(
    () => runtime.operatorOverview({ operatorKey: `${operatorKey.slice(0, -1)}x` }),
    /operator_key_required/,
  );
  assert.throws(
    () => runtime.operatorOverview({ operatorKey: `${operatorKey}x` }),
    /operator_key_required/,
  );
  assert.throws(() => runtime.operatorOverview({}), /operator_key_required/);
});

test("runtime auth decodes recovery code credentials", () => {
  const code = recoveryCode({ explorerId: "explorer_auth_2", localSecret: "local_secret_2" });
  assert.deepEqual(decodeExplorerRecoveryCode(code), {
    explorerId: "explorer_auth_2",
    localSecret: "local_secret_2",
  });
  assert.deepEqual(explorerAuthCredentialFromInput({ recoveryCode: code }, "explorer_auth_2"), {
    explorerId: "explorer_auth_2",
    explorerSecretHash: explorerSecretHash("explorer_auth_2", "local_secret_2"),
  });
});

test("runtime auth accepts localSecret credentials only when explorer id is known", () => {
  assert.deepEqual(explorerAuthCredentialFromInput({ localSecret: "local_secret_3" }, "explorer_auth_3"), {
    explorerId: "explorer_auth_3",
    explorerSecretHash: explorerSecretHash("explorer_auth_3", "local_secret_3"),
  });
  assert.equal(explorerAuthCredentialFromInput({}), null);
  assert.throws(() => explorerAuthCredentialFromInput({ localSecret: "local_secret_3" }), /explorer_auth_invalid/);
});

test("runtime auth rejects malformed or mismatched recovery credentials", () => {
  assert.throws(() => decodeExplorerRecoveryCode("not-base64-json"), /explorer_auth_invalid/);
  assert.throws(
    () => explorerAuthCredentialFromInput({ recoveryCode: recoveryCode({ explorerId: "other", localSecret: "secret" }) }, "expected"),
    /explorer_auth_invalid/,
  );
});
