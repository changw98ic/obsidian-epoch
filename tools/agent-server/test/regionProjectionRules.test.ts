import assert from "node:assert/strict";
import test from "node:test";

import {
  currentRegionInfluenceScore,
  latestTraceIdForRegion,
} from "../lib/epoch/regionProjectionRules.ts";

test("region projection rules read influence scores and latest traces", () => {
  const projection = {
    regionInfluenceIdsByAgent: {
      agent_1: ["influence_a", "missing", "influence_b", "influence_c"],
      agent_2: ["influence_d"],
    },
    regionInfluenceChanges: {
      influence_a: { regionId: "region_gray_harbor", influenceDelta: 3 },
      influence_b: { regionId: "region_cinder", influenceDelta: 9 },
      influence_c: { regionId: "region_gray_harbor", influenceDelta: -1 },
      influence_d: { regionId: "region_gray_harbor", influenceDelta: 5 },
    },
    traceIdsByRegion: {
      region_gray_harbor: ["trace_1", "trace_2"],
      region_cinder: [],
    },
  };

  assert.equal(currentRegionInfluenceScore(projection, "region_gray_harbor", "agent_1"), 2);
  assert.equal(currentRegionInfluenceScore(projection, "region_cinder", "agent_1"), 9);
  assert.equal(currentRegionInfluenceScore(projection, "region_gray_harbor", "agent_missing"), 0);
  assert.equal(latestTraceIdForRegion(projection, "region_gray_harbor"), "trace_2");
  assert.equal(latestTraceIdForRegion(projection, "region_cinder"), undefined);
  assert.equal(latestTraceIdForRegion(projection, "region_missing"), undefined);
});
