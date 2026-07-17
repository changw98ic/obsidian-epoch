import assert from "node:assert/strict";
import test from "node:test";

import { CommunityRateLimitError, createCommunityLedger } from "../lib/community.ts";

test("community quota covers the server-derived explorer across rotated player tokens", () => {
  let now = new Date("2026-01-01T00:00:00.000Z");
  const ledger = createCommunityLedger({
    now: () => now,
    rateLimit: { windowMs: 1_000, maxActions: 1 },
  });

  ledger.react({
    targetType: "claim",
    targetId: "claim_rotated_token",
    explorerId: "explorer_rotated",
    tokenId: "token_a",
    reaction: "useful",
  });

  assert.throws(
    () => ledger.comment({
      targetType: "claim",
      targetId: "claim_rotated_token",
      explorerId: "explorer_rotated",
      tokenId: "token_b",
      body: "rotating the bearer must not bypass the explorer budget",
    }),
    (error: unknown) => error instanceof CommunityRateLimitError
      && error.retryAfterMs === 1_000,
  );

  now = new Date(now.getTime() + 1_001);
  const afterWindow = ledger.comment({
    targetType: "claim",
    targetId: "claim_rotated_token",
    explorerId: "explorer_rotated",
    tokenId: "token_b",
    body: "the explorer budget resets with the window",
  }) as { readonly status?: string };
  assert.equal(afterWindow.status, "visible");
  assert.equal(ledger.state().comments.length, 1);
});

test("community quota reservation is atomic across token and explorer buckets", () => {
  let now = new Date("2026-01-01T00:00:00.000Z");
  const ledger = createCommunityLedger({
    now: () => now,
    rateLimit: { windowMs: 1_000, maxActions: 1 },
  });

  ledger.comment({
    targetType: "claim",
    targetId: "claim_atomic_quota",
    explorerId: "explorer_atomic",
    tokenId: "token_a",
    body: "first",
  });

  assert.throws(
    () => ledger.flag({
      targetType: "claim",
      targetId: "claim_atomic_quota",
      explorerId: "explorer_atomic",
      tokenId: "token_b",
      reason: "second",
    }),
    /community_rate_limited/,
  );

  now = new Date(now.getTime() + 1_001);
  const next = ledger.flag({
    targetType: "claim",
    targetId: "claim_atomic_quota",
    explorerId: "explorer_atomic",
    tokenId: "token_b",
    reason: "after-window",
  }) as { readonly status?: string };
  assert.equal(next.status, "queued");
  assert.equal(ledger.state().flags.length, 1);
});
