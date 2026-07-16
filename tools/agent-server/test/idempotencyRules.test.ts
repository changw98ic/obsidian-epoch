import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";

const modulePath = new URL("../lib/epoch/idempotencyRules.ts", import.meta.url);

test("idempotency rules strip volatile credentials before subject hashing", async () => {
  assert.ok(existsSync(modulePath), "idempotencyRules.ts should own idempotency subject normalization");
  const rules = await import("../lib/epoch/idempotencyRules.ts");

  assert.deepEqual(rules.stableIdempotencySubject({
    b: 2,
    a: {
      confirmationToken: "token",
      keep: "value",
      localSecret: "secret",
      nested: [{ recoveryCode: "old", visible: true }],
      omitted: undefined,
    },
    idempotencyKey: "request-key",
    newRecoveryCode: "new",
  }), {
    a: {
      keep: "value",
      nested: [{ visible: true }],
    },
    b: 2,
  });
});

test("idempotency rules hash stable subjects and scope owner keys", async () => {
  assert.ok(existsSync(modulePath), "idempotencyRules.ts should own idempotency hashing");
  const rules = await import("../lib/epoch/idempotencyRules.ts");

  const left = rules.idempotencySubjectHash("market_fill", "explorer_1", {
    idempotencyKey: "request-one",
    localSecret: "first-secret",
    payload: { b: 2, a: 1 },
  });
  const right = rules.idempotencySubjectHash("market_fill", "explorer_1", {
    localSecret: "second-secret",
    payload: { a: 1, b: 2 },
    recoveryCode: "rotated",
  });
  const changed = rules.idempotencySubjectHash("market_fill", "explorer_2", {
    payload: { a: 1, b: 2 },
  });

  assert.match(left, /^[a-f0-9]{64}$/);
  assert.equal(left, right);
  assert.notEqual(left, changed);
  assert.equal(
    rules.ownerIdempotencyKey("market_fill", "explorer_1", "request-one"),
    "market_fill:explorer_1:request-one",
  );
});
