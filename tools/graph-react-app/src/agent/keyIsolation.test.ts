import assert from "node:assert/strict";
import test from "node:test";
import {
  assertNoKeyMaterialInUserTextPayload,
  KEY_MATERIAL_REDACTION,
  findKeyMaterialInUserTextPayload,
  sanitizeKeyMaterialForErrorPayload,
  sanitizeKeyMaterialInText,
} from "./keyIsolation";

test("key isolation redacts key material from error payloads", () => {
  const recoveryCode = btoa(JSON.stringify({
    explorerId: "explorer_key_isolation",
    localSecret: "local_secret_should_not_escape",
  }));
  const sanitized = sanitizeKeyMaterialForErrorPayload({
    operatorKey: "operator-live-secret",
    recoveryCode,
    idempotencyKey: "web_safe_idempotency_key",
    nested: {
      message: `failed with ${recoveryCode} and sk-proj-abcdefghijklmnopqrstuvwxyz0123456789`,
      localSecret: "local_secret_should_not_escape",
    },
  }) as {
    operatorKey: string;
    recoveryCode: string;
    idempotencyKey: string;
    nested: {
      message: string;
      localSecret: string;
    };
  };

  assert.equal(sanitized.operatorKey, KEY_MATERIAL_REDACTION);
  assert.equal(sanitized.recoveryCode, KEY_MATERIAL_REDACTION);
  assert.equal(sanitized.idempotencyKey, "web_safe_idempotency_key");
  assert.equal(sanitized.nested.localSecret, KEY_MATERIAL_REDACTION);
  assert.doesNotMatch(sanitized.nested.message, /sk-proj-/);
  assert.doesNotMatch(sanitized.nested.message, /explorer_key_isolation/);
});

test("key isolation redacts key-shaped text before error display", () => {
  const recoveryCode = btoa(JSON.stringify({
    explorerId: "explorer_key_text",
    localSecret: "local_secret_text_escape",
  }));

  assert.equal(
    sanitizeKeyMaterialInText(`request failed recoveryCode=${recoveryCode}`),
    `request failed recoveryCode=${KEY_MATERIAL_REDACTION}`,
  );
  assert.equal(
    sanitizeKeyMaterialInText("operatorKey: operator-super-secret"),
    `operatorKey: ${KEY_MATERIAL_REDACTION}`,
  );
  assert.equal(
    sanitizeKeyMaterialInText("idempotencyKey: web_safe_idempotency_key"),
    "idempotencyKey: web_safe_idempotency_key",
  );
});

test("key isolation detects key-shaped user text without flagging auth fields", () => {
  const detections = findKeyMaterialInUserTextPayload({
    recoveryCode: btoa(JSON.stringify({
      explorerId: "explorer_auth_field",
      localSecret: "local_auth_field_secret",
    })),
    body: "用户误贴了 sk-proj-abcdefghijklmnopqrstuvwxyz0123456789",
    nested: {
      visibleText: "战报里出现 local_secret_should_block",
    },
  });

  assert.deepEqual(detections.map((detection) => detection.fieldPath), ["body", "nested.visibleText"]);
  assert.throws(
    () => assertNoKeyMaterialInUserTextPayload({ prompt: "追加指令 sk-proj-abcdefghijklmnopqrstuvwxyz0123456789" }),
    /api_key_detected/,
  );
  assert.doesNotThrow(() => assertNoKeyMaterialInUserTextPayload({
    recoveryCode: btoa(JSON.stringify({
      explorerId: "explorer_auth_field",
      localSecret: "local_auth_field_secret",
    })),
    operatorKey: "sk-proj-abcdefghijklmnopqrstuvwxyz0123456789",
    body: "安全正文",
  }));
});
