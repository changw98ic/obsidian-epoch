import assert from "node:assert/strict";
import test from "node:test";

import {
  canonicalRegionIdFromInput,
  canonicalRegionIdOrDefault,
  hostedSessionStatusFromInput,
  runtimeAbuseActorKey,
  runtimeObjectiveTemplate,
  runtimeSeasonTemplate,
} from "../lib/epoch/runtimeInputRules.ts";

test("runtime input rules normalize optional region ids", () => {
  assert.equal(canonicalRegionIdFromInput("灰港"), "region_gray_harbor");
  assert.equal(canonicalRegionIdFromInput(" region_cinder_archive "), "region_cinder_archive");
  assert.equal(canonicalRegionIdFromInput(""), undefined);
  assert.equal(canonicalRegionIdFromInput(42), undefined);
  assert.equal(canonicalRegionIdOrDefault(undefined, "region_gray_harbor"), "region_gray_harbor");
});

test("runtime input rules parse hosted session status", () => {
  assert.equal(hostedSessionStatusFromInput(" active "), "active");
  assert.equal(hostedSessionStatusFromInput("completed"), "completed");
  assert.equal(hostedSessionStatusFromInput(undefined), undefined);
  assert.throws(() => hostedSessionStatusFromInput("queued"), /hosted_session_status_invalid/);
});

test("runtime input rules choose objective and season templates", () => {
  assert.equal(runtimeObjectiveTemplate({ objectiveKey: "archive_focus" }).template.resourceId, "focus");
  assert.equal(runtimeObjectiveTemplate({ objectiveKey: "unknown" }).objectiveKey, "supply_drive");
  assert.equal(runtimeSeasonTemplate({ seasonKey: "white_tower_compact_season" }).template.resourceId, "focus");
  assert.equal(runtimeSeasonTemplate({ seasonKey: "unknown" }).seasonKey, "gray_harbor_faction_season");
});

test("runtime input rules choose stable abuse actor keys", () => {
  assert.equal(runtimeAbuseActorKey({ actorExplorerId: "explorer_a", agentId: "agent_b" }), "explorer_a");
  assert.equal(runtimeAbuseActorKey({ sellerAgentId: "agent_seller" }), "agent_seller");
  assert.equal(runtimeAbuseActorKey({ challengeId: "challenge_1" }), "challenge_1");
  assert.equal(runtimeAbuseActorKey({}), "system");
});
