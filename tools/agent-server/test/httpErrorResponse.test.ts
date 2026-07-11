import assert from "node:assert/strict";
import test from "node:test";
import { classifyHttpError, isBadRequestHttpErrorCode } from "../lib/http/errorResponse.ts";
import { PublicRegistrationRateLimitError } from "../lib/playerMcpAccessTokenStore.ts";

function codedError(message: string, code: string) {
  return Object.assign(new Error(message), { code });
}

test("HTTP error response policy maps security and body-size errors", () => {
  assert.deepEqual(classifyHttpError(codedError("redacted", "api_key_detected")), {
    statusCode: 400,
    body: { error: "api_key_detected", message: "Remove secrets before submitting." },
  });
  assert.deepEqual(classifyHttpError(codedError("too large", "json_body_too_large")), {
    statusCode: 413,
    body: { error: "json_body_too_large" },
  });
});

test("HTTP error response policy keeps auth and rate-limit status codes", () => {
  assert.deepEqual(classifyHttpError(new Error("operator_key_required")), {
    statusCode: 403,
    body: { error: "operator_key_required" },
  });
  assert.deepEqual(classifyHttpError(new Error("explorer_auth_required")), {
    statusCode: 401,
    body: { error: "explorer_auth_required" },
  });
  assert.deepEqual(classifyHttpError(new Error("legacy_run_submission_rate_limited")), {
    statusCode: 429,
    body: { error: "legacy_run_submission_rate_limited" },
  });
  assert.deepEqual(
    classifyHttpError(new PublicRegistrationRateLimitError(30_001, "2026-01-01T00:00:30.001Z")),
    {
      statusCode: 429,
      body: {
        error: "public_registration_rate_limited",
        retryAfterMs: 30_001,
        retryAt: "2026-01-01T00:00:30.001Z",
      },
      headers: { "retry-after": "31" },
    },
  );
  assert.deepEqual(classifyHttpError(new Error("public_registration_protection_unavailable")), {
    statusCode: 503,
    body: { error: "public_registration_protection_unavailable" },
  });
  const retryAt = new Date(Date.now() + 30_000).toISOString();
  const traceConflictRateLimit = classifyHttpError(
    new Error(`trace_conflict_deploy_rate_limited:${retryAt}`),
  );
  assert.equal(traceConflictRateLimit.statusCode, 429);
  assert.equal(traceConflictRateLimit.body.error, "trace_conflict_deploy_rate_limited");
  assert.equal(traceConflictRateLimit.body.retryAt, retryAt);
  assert.ok((traceConflictRateLimit.body.retryAfterMs || 0) > 0);
  assert.ok(Number(traceConflictRateLimit.headers?.["retry-after"]) >= 1);
});

test("HTTP error response policy maps known business errors to 400", () => {
  assert.equal(isBadRequestHttpErrorCode("turn_card_not_found"), true);
  assert.deepEqual(classifyHttpError(new Error("turn_card_not_found")), {
    statusCode: 400,
    body: { error: "turn_card_not_found" },
  });
  assert.equal(isBadRequestHttpErrorCode("downtime_preparation_resource_insufficient"), true);
  assert.deepEqual(classifyHttpError(new Error("downtime_preparation_resource_insufficient")), {
    statusCode: 400,
    body: { error: "downtime_preparation_resource_insufficient" },
  });
  assert.deepEqual(classifyHttpError(new Error("trace_conflict_template_unknown")), {
    statusCode: 400,
    body: { error: "trace_conflict_template_unknown" },
  });
  assert.deepEqual(classifyHttpError(new Error("trace_conflict_resource_insufficient:aether")), {
    statusCode: 400,
    body: { error: "trace_conflict_resource_insufficient" },
  });
});

test("HTTP error response policy maps parse failures and unknown errors", () => {
  assert.deepEqual(classifyHttpError(new Error("Unexpected token in JSON at position 1")), {
    statusCode: 400,
    body: { error: "invalid_json" },
  });
  assert.deepEqual(classifyHttpError(new Error("database_on_fire")), {
    statusCode: 500,
    body: { error: "internal_error" },
  });
});
