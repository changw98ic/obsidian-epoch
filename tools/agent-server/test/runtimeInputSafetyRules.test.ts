import assert from "node:assert/strict";
import test from "node:test";

import {
  assertNoRequestSecretMaterialInPublicText,
  summarizeRejectedInput,
} from "../lib/epoch/runtimeInputSafetyRules.ts";

test("public text guard rejects request secret material echoed into visible text", () => {
  assert.throws(
    () => assertNoRequestSecretMaterialInPublicText({
      recoveryCode: "recover-secret-123",
    }, "玩家可见说明 recover-secret-123"),
    /secret_material_detected/,
  );
  assert.throws(
    () => assertNoRequestSecretMaterialInPublicText({
      confirmationToken: "confirm-token-123",
    }, "确认口令 confirm-token-123"),
    /secret_material_detected/,
  );
});

test("public text guard rejects standalone bearer and labeled token forms", () => {
  const unsafeTexts = [
    "Authorization: Bearer opaque-player-token-1234567890",
    "accessToken=opaque-access-token-1234567890",
    "bearerToken: opaque-bearer-token-1234567890",
    "shareToken='opaque-share-token-1234567890'",
    JSON.stringify({ publishToken: "opaque-publish-token-1234567890" }),
    "local_secret_value_1234567890",
  ];

  for (const unsafeText of unsafeTexts) {
    assert.throws(
      () => assertNoRequestSecretMaterialInPublicText({}, unsafeText),
      (error: unknown) => error instanceof Error && error.message === "secret_material_detected",
    );
  }
});

test("public text guard rejects all request credential fields without exposing their values", () => {
  const secrets = {
    accessToken: "opaque-access-token-1234567890",
    bearerToken: "opaque-bearer-token-1234567890",
    shareToken: "opaque-share-token-1234567890",
    publishToken: "opaque-publish-token-1234567890",
    recoveryCode: "opaque-recovery-code-1234567890",
    localSecret: "opaque-local-secret-1234567890",
  };

  for (const [key, secret] of Object.entries(secrets)) {
    let rejected: unknown;
    try {
      assertNoRequestSecretMaterialInPublicText({ [key]: secret }, `visible ${secret}`);
    } catch (error) {
      rejected = error;
    }
    assert.ok(rejected instanceof Error);
    assert.equal(rejected.message, "secret_material_detected");
    assert.equal(rejected.message.includes(secret), false);
  }
});

test("public text guard ignores short, absent, and non-string secret values", () => {
  assert.doesNotThrow(() => assertNoRequestSecretMaterialInPublicText({
    recoveryCode: "short",
    operatorKey: 123,
  }, "short 123"));
  assert.doesNotThrow(() => assertNoRequestSecretMaterialInPublicText({
    recoveryCode: "recover-secret-123",
  }, "公开说明没有包含密钥"));
  assert.doesNotThrow(() => assertNoRequestSecretMaterialInPublicText({
    recoveryCode: "recover-secret-123",
  }, null));
});

test("rejected input summary redacts sensitive keys", () => {
  const summary = summarizeRejectedInput({
    apiKey: "sk-proj-aaaaaaaaaaaaaaaaaaaa",
    operatorSecret: "operator-secret",
    confirmationToken: "confirm-token",
    visibleText: "contains raw transcript",
    privateNote: "hidden",
    transcript: "raw words",
  });

  assert.deepEqual(summary, {
    apiKey: "[redacted]",
    operatorSecret: "[redacted]",
    confirmationToken: "[redacted]",
    visibleText: "[redacted]",
    privateNote: "[redacted]",
    transcript: "[redacted]",
  });
});

test("rejected input summary preserves safe scalar shape and masks API keys inside text", () => {
  const longText = `prefix sk-proj-${"a".repeat(24)} ${"x".repeat(200)}`;
  const summary = summarizeRejectedInput({
    title: longText,
    amount: 3,
    enabled: true,
    missing: null,
    items: ["a", "b"],
    nested: { value: "x" },
    empty: undefined,
  });

  assert.equal(typeof summary.title, "string");
  assert.match(String(summary.title), /^prefix \[REDACTED_API_KEY\]/);
  assert.equal(String(summary.title).length, 160);
  assert.equal(summary.amount, 3);
  assert.equal(summary.enabled, true);
  assert.equal(summary.missing, null);
  assert.equal(summary.items, "[array:2]");
  assert.equal(summary.nested, "[object]");
  assert.equal(summary.empty, "undefined");
});

test("rejected input summary never records secrets hidden in ordinary text fields", () => {
  const secrets = [
    "opaque-bearer-token-1234567890",
    "opaque-access-token-1234567890",
    "local_secret_value_1234567890",
  ];
  const summary = summarizeRejectedInput({
    title: `Authorization: Bearer ${secrets[0]}`,
    note: `accessToken=${secrets[1]}`,
    body: `local value ${secrets[2]}`,
  });
  const serialized = JSON.stringify(summary);

  for (const secret of secrets) assert.equal(serialized.includes(secret), false);
  assert.match(serialized, /REDACTED_SECRET/);
});
