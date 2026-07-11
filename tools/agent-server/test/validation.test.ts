import assert from "node:assert/strict";
import test from "node:test";
import { parseAgentPublicWorld } from "../../graph-react-app/src/validation.ts";

test("parseAgentPublicWorld rejects malformed collection payloads", () => {
  assert.throws(
    () => parseAgentPublicWorld({
      summary: {
        canonicalClaims: 0,
        disputedClaims: 0,
        openConflicts: 0,
        acceptedFactions: 0,
        archiveRuns: 0,
      },
      claims: "not-an-array",
      conflicts: [],
      factions: [],
      archive: [],
      claimDetails: {},
      conflictDetails: {},
      factionDetails: {},
      sourceGraph: { nodes: [], edges: [] },
    }),
    /agent_world_claims_invalid/,
  );
});

test("parseAgentPublicWorld adapts legacy missing fields to explicit unknown and null defaults", () => {
  const world = parseAgentPublicWorld({
    summary: {
      canonicalClaims: 2,
    },
    claims: [],
    conflicts: [],
    factions: [],
    archive: [],
  });

  assert.equal(world.summary.canonicalClaims, 2);
  assert.equal(world.summary.disputedClaims, "unknown");
  assert.equal(world.summary.openConflicts, "unknown");
  assert.equal(world.summary.acceptedFactions, "unknown");
  assert.equal(world.summary.archiveRuns, "unknown");
  assert.equal(world.claimDetails, null);
  assert.equal(world.conflictDetails, null);
  assert.equal(world.factionDetails, null);
  assert.deepEqual(world.sourceGraph.nodes, []);
  assert.deepEqual(world.sourceGraph.edges, []);
  assert.equal(world.sourceGraph.status, "unknown");
});
