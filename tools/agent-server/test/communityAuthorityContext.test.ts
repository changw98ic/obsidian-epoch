import assert from "node:assert/strict";
import test from "node:test";

import { createCommunityLedger, type CommunityAbuseContextInput } from "../lib/community.ts";
import { createAgentWorldRuntime } from "../lib/mcpRuntimeCore.ts";

test("community abuse detection prefers a server-owned context over spoofed fields", () => {
  const ledger = createCommunityLedger({
    resolveAbuseContext: ({ targetId }: CommunityAbuseContextInput) => targetId === "claim_authoritative"
      ? { againstExplorerId: "explorer_target", groupId: "server_group" }
      : undefined,
  });

  const reaction = ledger.react({
    targetType: "claim",
    targetId: "claim_authoritative",
    explorerId: "explorer_actor",
    againstExplorerId: "explorer_forged",
    groupId: "client_group",
    reaction: "refute",
  });

  const internalReaction = reaction as Record<string, unknown>;
  assert.equal(internalReaction.againstExplorerId, "explorer_target");
  assert.equal(internalReaction.groupId, "server_group");
  assert.equal(ledger.state().reactions[0]?.againstExplorerId, "explorer_target");
  assert.equal(ledger.state().reactions[0]?.groupId, "server_group");
});

test("runtime derives community target ownership from canonical submitted runs", () => {
  const runtime = createAgentWorldRuntime({
    submittedRuns: [
      { runTicket: "run_author_a", explorerId: "explorer_a", visibility: "public" },
      { runTicket: "run_author_b", explorerId: "explorer_b", worldImpact: "review_candidate" },
    ],
  });

  runtime.communityReact({
    targetType: "run",
    targetId: "run_author_a",
    explorerId: "explorer_b",
    againstExplorerId: "explorer_forged",
    reaction: "refute",
  });
  const retaliation = runtime.communityReact({
    targetType: "run",
    targetId: "run_author_b",
    explorerId: "explorer_a",
    againstExplorerId: "explorer_forged",
    reaction: "refute",
  });

  const publicRetaliation = retaliation as Record<string, unknown>;
  assert.equal(publicRetaliation.visibility, "hidden_pending_review");
  assert.equal(Object.prototype.hasOwnProperty.call(publicRetaliation, "againstExplorerId"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(publicRetaliation, "groupId"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(publicRetaliation, "disputeAbuseFlags"), false);
  const state = runtime.communityState();
  assert.equal(state.reactions[0]?.againstExplorerId, "explorer_a");
  assert.equal(state.reactions[1]?.againstExplorerId, "explorer_b");
  assert.deepEqual(state.reactions[1]?.disputeAbuseFlags, ["bidirectional_retaliation"]);
});
