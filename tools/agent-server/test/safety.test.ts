import assert from "node:assert/strict";
import test from "node:test";
import {
  containsSecretMaterial,
  findSecretLeaks,
  redactApiKeys,
} from "../lib/safety.ts";

test("persistence redaction removes owner, operator, and bearer credentials", () => {
  const source = {
    recoveryCode: "eyJleHBsb3JlcklkIjoiZXhwbG9yZXJfMSIsImxvY2FsU2VjcmV0IjoibG9jYWxfc2VjcmV0XzEyMzQ1Njc4OTAifQ==",
    nested: {
      localSecret: "local_secret_1234567890",
      operatorKey: "operator-key-at-least-32-characters",
      authorization: "Bearer opaque-player-token-at-least-32-characters",
    },
    body: "safe public text",
  };

  const redacted = redactApiKeys(source) as Record<string, unknown>;
  const serialized = JSON.stringify(redacted);
  assert.equal(redacted.recoveryCode, "[REDACTED_SECRET]");
  assert.doesNotMatch(serialized, /local_secret_1234567890|operator-key|opaque-player-token|eyJleHBsb3Jlcklk/);
  assert.match(serialized, /safe public text/);
});

test("persistence redaction removes credentials from serialized JSON strings", () => {
  const source = JSON.stringify({
    recoveryCode: "encoded-recovery-value",
    localSecret: "local_secret_1234567890",
    message: "keep me",
  });
  const redacted = String(redactApiKeys(source));

  assert.doesNotMatch(redacted, /encoded-recovery-value|local_secret_1234567890/);
  assert.match(redacted, /keep me/);
});

test("unified secret detector and redactor cover bearer, token fields, and local secrets", () => {
  const secrets = [
    "opaque-bearer-token-1234567890",
    "access-token-value-1234567890",
    "bearer-token-value-1234567890",
    "share-token-value-1234567890",
    "publish-token-value-1234567890",
    "recovery-token-value-1234567890",
    "local_secret_value_1234567890",
  ];
  const source = [
    `Authorization: Bearer ${secrets[0]}`,
    `accessToken=${secrets[1]}`,
    `bearerToken: ${secrets[2]}`,
    `shareToken='${secrets[3]}'`,
    `publishToken="${secrets[4]}"`,
    JSON.stringify({
      publishToken: secrets[4],
      recoveryCode: secrets[5],
    }),
    secrets[6],
  ].join("\n");

  const leaks = findSecretLeaks(source);
  const redacted = String(redactApiKeys(source));

  assert.ok(leaks.length >= secrets.length);
  assert.ok(leaks.some((leak) => leak.kind === "bearer"));
  assert.ok(leaks.some((leak) => leak.kind === "secret_field"));
  assert.ok(leaks.some((leak) => leak.kind === "local_secret"));
  for (const secret of secrets) {
    assert.equal(leaks.some((leak) => leak.preview.includes(secret)), false);
    assert.equal(redacted.includes(secret), false);
  }
});

test("secret material matcher finds opaque request credentials without returning them", () => {
  const opaqueSecret = "opaque-request-secret-1234567890";
  assert.equal(containsSecretMaterial(`visible ${opaqueSecret}`, {
    nested: { accessToken: opaqueSecret },
  }), true);
  assert.equal(containsSecretMaterial("visible safe text", {
    nested: { accessToken: opaqueSecret },
  }), false);
});
