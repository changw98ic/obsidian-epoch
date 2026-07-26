import assert from "node:assert/strict";
import test from "node:test";

import type { EpochEvent } from "../lib/epoch/events.ts";
import { createEpochGameCore } from "../lib/epoch/gameCore.ts";
import { createSequentialEpochIdFactory } from "../lib/epoch/protocol.ts";
import { VIABILITY_POLICY_VERSION } from "../lib/epoch/journeyViabilityRules.ts";

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function mutableClock(initialIso: string) {
  let current = new Date(initialIso);
  const clock = () => new Date(current);
  return {
    clock,
    set: (iso: string) => {
      current = new Date(iso);
    },
  };
}

const SYSTEM = {
  actorExplorerId: "system",
  trustClass: "system_worker" as const,
  causationId: "sys",
  correlationId: "sys_corr",
};

function playerCtx(explorerId: string, seed: string) {
  return {
    actorExplorerId: explorerId,
    trustClass: "user_verified_web" as const,
    causationId: `${seed}_${explorerId}`,
    correlationId: `${seed}_corr`,
  };
}

// ---------------------------------------------------------------------------
// Test: archived identity has viability zeroed (social_death)
// ---------------------------------------------------------------------------

test("identity_archived zeroes viability to social_death", () => {
  const { clock, set } = mutableClock("2026-07-26T00:00:00.000Z");
  const core = createEpochGameCore({
    clock,
    idFactory: createSequentialEpochIdFactory("arch_viability"),
  });

  const issued = core.issueIdentity(
    { explorerId: "explorer_1", identityName: "初世" },
    playerCtx("explorer_1", "arch_viability"),
  );
  const agentId = issued.value.agentId;

  // Before archive: viability is healthy (from initialIdentityViability).
  const beforeArchive = core.project();
  const identityBefore = beforeArchive.identities[agentId];
  assert.ok(identityBefore);
  assert.ok(identityBefore.identityViability);
  assert.equal(identityBefore.identityViability.status, "healthy");
  assert.equal(identityBefore.identityViability.viabilityScoreBps, 10_000);
  assert.equal(identityBefore.identityViability.identityExposed, false);
  assert.deepEqual(identityBefore.identityViability.factionStanding, {});
  assert.equal(identityBefore.identityViability.flaggedWanted.size, 0);
  assert.deepEqual(identityBefore.identityViability.doubtedBy, {});

  // Archive the identity.
  set("2026-07-26T01:00:00.000Z");
  core.archiveIdentity(
    { agentId, archiveReason: "test_archive", finalTitle: "测试终章" },
    SYSTEM,
  );

  const afterArchive = core.project();
  const archived = afterArchive.identities[agentId];
  assert.ok(archived);
  assert.equal(archived.status, "archived");

  // Core assertion: viability is zeroed to social_death.
  assert.ok(archived.identityViability, "archived identity must retain viability snapshot");
  assert.equal(archived.identityViability.status, "social_death");
  assert.equal(archived.identityViability.viabilityScoreBps, 0);
  assert.equal(archived.identityViability.identityId, agentId);
  assert.equal(archived.identityViability.identityExposed, false);
  assert.deepEqual(archived.identityViability.factionStanding, {});
  assert.equal(archived.identityViability.flaggedWanted.size, 0);
  assert.deepEqual(archived.identityViability.doubtedBy, {});
  assert.equal(archived.identityViability.policyVersion, VIABILITY_POLICY_VERSION);
  assert.equal(archived.identityViability.projectedAt, "2026-07-26T01:00:00.000Z");
});

// ---------------------------------------------------------------------------
// Test: reincarnation creates fresh viability, NOT inherited
// ---------------------------------------------------------------------------

test("reincarnation creates fresh viability not inherited from previous identity", () => {
  const { clock, set } = mutableClock("2026-07-26T00:00:00.000Z");
  const core = createEpochGameCore({
    clock,
    idFactory: createSequentialEpochIdFactory("reincarnation_fresh"),
  });

  const first = core.issueIdentity(
    { explorerId: "explorer_1", identityName: "初世" },
    playerCtx("explorer_1", "reincarnation_fresh"),
  );
  const firstAgentId = first.value.agentId;

  // Grant some legend so inheritance has content.
  core.grantResource(
    { agentId: firstAgentId, resourceId: "legend", amount: 5, reason: "seed" },
    SYSTEM,
  );

  // Archive first identity.
  set("2026-07-26T01:00:00.000Z");
  core.archiveIdentity(
    { agentId: firstAgentId, archiveReason: "lifetime_expired", finalTitle: "初世终章" },
    SYSTEM,
  );

  // Reincarnate.
  set("2026-07-26T02:00:00.000Z");
  const reincarnated = core.reincarnate(
    { previousAgentId: firstAgentId, identityName: "二世" },
    SYSTEM,
  );
  const secondAgentId = reincarnated.value.agentId;

  // New identity has a DIFFERENT agentId.
  assert.notEqual(secondAgentId, firstAgentId);

  // New identity has generation + 1.
  assert.equal(reincarnated.value.generation, first.value.generation + 1);

  // New identity has FRESH viability (not inherited).
  const secondViability = reincarnated.value.identityViability;
  assert.ok(secondViability);
  assert.equal(secondViability.identityId, secondAgentId);
  assert.equal(secondViability.status, "healthy");
  assert.equal(secondViability.viabilityScoreBps, 10_000);
  assert.equal(secondViability.identityExposed, false);
  assert.deepEqual(secondViability.factionStanding, {});
  assert.equal(secondViability.flaggedWanted.size, 0);
  assert.deepEqual(secondViability.doubtedBy, {});

  // Previous identity's archived viability is zeroed (from prior test logic).
  const proj = core.project();
  const archivedFirst = proj.identities[firstAgentId];
  assert.ok(archivedFirst);
  assert.ok(archivedFirst.identityViability);
  assert.equal(archivedFirst.identityViability.status, "social_death");
  assert.equal(archivedFirst.identityViability.viabilityScoreBps, 0);

  // Inheritance only carries legendEcho, knownRegions, scar.
  const inheritance = reincarnated.value.inheritance;
  assert.ok(inheritance);
  assert.equal(inheritance.legendEcho, 5);
  assert.ok(Array.isArray(inheritance.knownRegions));
  // No faction standing, no doubtedBy, no flaggedWanted in inheritance.
  assert.equal(Object.keys(inheritance).filter((k) => k !== "legendEcho" && k !== "knownRegions" && k !== "scar").length, 0);
});

// ---------------------------------------------------------------------------
// Test: canonical world_object_state_changed survives across identities
// ---------------------------------------------------------------------------

test("canonical world_object_state_changed visible to next identity after reincarnation", () => {
  const { clock, set } = mutableClock("2026-07-26T00:00:00.000Z");
  const core = createEpochGameCore({
    clock,
    idFactory: createSequentialEpochIdFactory("canonical_survive"),
  });

  // Issue identity A.
  const first = core.issueIdentity(
    { explorerId: "explorer_1", identityName: "初世" },
    playerCtx("explorer_1", "canonical_survive"),
  );
  const firstAgentId = first.value.agentId;

  // Ingest a canonical world_object_state_changed event (simulates solidify).
  const canonicalEvent: EpochEvent = {
    eventId: "canonical_wos_1",
    eventType: "world_object_state_changed",
    aggregateType: "world_object",
    aggregateId: "obj_bridge",
    actorExplorerId: "system",
    agentId: firstAgentId,
    trustClass: "system_worker",
    causationId: "cause_canonical",
    correlationId: "corr_canonical",
    createdAt: "2026-07-26T00:30:00.000Z",
    payload: {
      objectId: "obj_bridge",
      regionId: "region_gray_harbor",
      statusAfter: "destroyed" as const,
      degree: 3,
      sourceActionEventId: "action_1",
      sourceAggregateId: "action_1",
      changedAt: "2026-07-26T00:30:00.000Z",
      worldMinute: 100,
    },
  };
  core.ingestCanonicalEvents([canonicalEvent]);

  // Verify canonical state exists.
  const projBefore = core.project();
  assert.ok(projBefore.worldObjectStates["obj_bridge"]);
  assert.equal(projBefore.worldObjectStates["obj_bridge"].status, "destroyed");

  // Archive and reincarnate.
  set("2026-07-26T01:00:00.000Z");
  core.archiveIdentity(
    { agentId: firstAgentId, archiveReason: "lifetime_expired", finalTitle: "初世终章" },
    SYSTEM,
  );
  set("2026-07-26T02:00:00.000Z");
  const second = core.reincarnate(
    { previousAgentId: firstAgentId, identityName: "二世" },
    SYSTEM,
  );

  // Canonical world object state survives — NOT identity-scoped.
  const projAfter = core.project();
  assert.ok(projAfter.worldObjectStates["obj_bridge"]);
  assert.equal(projAfter.worldObjectStates["obj_bridge"].status, "destroyed");

  // New identity is active and distinct.
  assert.equal(second.value.status, "active");
  assert.notEqual(second.value.agentId, firstAgentId);
});

// ---------------------------------------------------------------------------
// Test: canonical hidden_prerequisite_link_changed survives across identities
// ---------------------------------------------------------------------------

test("canonical hidden_prerequisite_link_changed survives across identities", () => {
  const core = createEpochGameCore({
    clock: () => new Date("2026-07-26T00:00:00.000Z"),
    idFactory: createSequentialEpochIdFactory("hpl_survive"),
  });

  const first = core.issueIdentity(
    { explorerId: "explorer_1", identityName: "初世" },
    playerCtx("explorer_1", "hpl_survive"),
  );

  const hplEvent: EpochEvent = {
    eventId: "canonical_hpl_1",
    eventType: "hidden_prerequisite_link_changed",
    aggregateType: "hidden_prerequisite",
    aggregateId: "hpl_link_1",
    actorExplorerId: "system",
    agentId: first.value.agentId,
    trustClass: "system_worker",
    causationId: "cause_hpl",
    correlationId: "corr_hpl",
    createdAt: "2026-07-26T00:30:00.000Z",
    payload: {
      regionId: "region_gray_harbor",
      objectiveId: "obj_sealed_gate",
      prerequisiteObjectId: "obj_crystal_key",
      statusAfter: "destroyed" as const,
      sourceActionEventId: "action_1",
      changedAt: "2026-07-26T00:30:00.000Z",
    },
  };
  core.ingestCanonicalEvents([hplEvent]);

  const linkKey = "region_gray_harbor:obj_sealed_gate:obj_crystal_key";
  const proj = core.project();
  assert.ok(proj.hiddenPrerequisiteLinks[linkKey]);
  assert.equal(proj.hiddenPrerequisiteLinks[linkKey].status, "destroyed");

  // Archive + reincarnate does NOT touch canonical links.
  core.archiveIdentity(
    { agentId: first.value.agentId, archiveReason: "test", finalTitle: "终" },
    SYSTEM,
  );
  core.reincarnate(
    { previousAgentId: first.value.agentId, identityName: "二世" },
    SYSTEM,
  );

  const projAfter = core.project();
  assert.ok(projAfter.hiddenPrerequisiteLinks[linkKey]);
  assert.equal(projAfter.hiddenPrerequisiteLinks[linkKey].status, "destroyed");
});

// ---------------------------------------------------------------------------
// Test: standing/wanted/exposed/doubtedBy isolation by identity
// ---------------------------------------------------------------------------

test("viability fields are identity-scoped: standing wanted exposed doubtedBy isolated", () => {
  const { clock, set } = mutableClock("2026-07-26T00:00:00.000Z");
  const core = createEpochGameCore({
    clock,
    idFactory: createSequentialEpochIdFactory("viability_isolation"),
  });

  const first = core.issueIdentity(
    { explorerId: "explorer_1", identityName: "初世" },
    playerCtx("explorer_1", "viability_isolation"),
  );
  const firstAgentId = first.value.agentId;

  // Archive first identity.
  set("2026-07-26T01:00:00.000Z");
  core.archiveIdentity(
    { agentId: firstAgentId, archiveReason: "test", finalTitle: "终" },
    SYSTEM,
  );

  // Reincarnate.
  set("2026-07-26T02:00:00.000Z");
  const second = core.reincarnate(
    { previousAgentId: firstAgentId, identityName: "二世" },
    SYSTEM,
  );
  const secondAgentId = second.value.agentId;

  const proj = core.project();

  // First identity archived viability: all transient fields empty.
  const archivedViability = proj.identities[firstAgentId]?.identityViability;
  assert.ok(archivedViability);
  assert.deepEqual(archivedViability.factionStanding, {});
  assert.equal(archivedViability.flaggedWanted.size, 0);
  assert.equal(archivedViability.identityExposed, false);
  assert.deepEqual(archivedViability.doubtedBy, {});
  assert.equal(archivedViability.status, "social_death");
  assert.equal(archivedViability.viabilityScoreBps, 0);

  // Second identity fresh viability: all transient fields empty, healthy.
  const freshViability = proj.identities[secondAgentId]?.identityViability;
  assert.ok(freshViability);
  assert.deepEqual(freshViability.factionStanding, {});
  assert.equal(freshViability.flaggedWanted.size, 0);
  assert.equal(freshViability.identityExposed, false);
  assert.deepEqual(freshViability.doubtedBy, {});
  assert.equal(freshViability.status, "healthy");
  assert.equal(freshViability.viabilityScoreBps, 10_000);

  // Viability identityId matches respective agentId.
  assert.equal(archivedViability.identityId, firstAgentId);
  assert.equal(freshViability.identityId, secondAgentId);
});

// ---------------------------------------------------------------------------
// Test: EpochLineageInheritance only carries legendEcho/knownRegions/scar
// ---------------------------------------------------------------------------

test("EpochLineageInheritance only carries legendEcho knownRegions scar", () => {
  const { clock, set } = mutableClock("2026-07-26T00:00:00.000Z");
  const core = createEpochGameCore({
    clock,
    idFactory: createSequentialEpochIdFactory("inheritance_fields"),
  });

  const first = core.issueIdentity(
    { explorerId: "explorer_1", identityName: "初世" },
    playerCtx("explorer_1", "inheritance_fields"),
  );
  const firstAgentId = first.value.agentId;

  // Grant legend to seed inheritance.
  core.grantResource(
    { agentId: firstAgentId, resourceId: "legend", amount: 8, reason: "seed" },
    SYSTEM,
  );

  // Archive (triggers a scar via reason).
  set("2026-07-26T01:00:00.000Z");
  core.archiveIdentity(
    { agentId: firstAgentId, archiveReason: "fatal_scar", finalTitle: "终" },
    SYSTEM,
  );

  // Reincarnate.
  set("2026-07-26T02:00:00.000Z");
  const second = core.reincarnate(
    { previousAgentId: firstAgentId, identityName: "二世" },
    SYSTEM,
  );

  const inheritance = second.value.inheritance;
  assert.ok(inheritance);

  // Verify only the allowed fields (scar is optional — present only when a
  // lifetime_adjusted event with negative delta precedes the archive).
  // Here we used archiveIdentity directly (no lifetime_adjusted), so no scar.
  const keys = Object.keys(inheritance).sort();
  assert.deepEqual(keys, ["knownRegions", "legendEcho"]);

  assert.equal(inheritance.legendEcho, 8);
  assert.ok(Array.isArray(inheritance.knownRegions));

  // No viability fields in inheritance.
  assert.equal((inheritance as Record<string, unknown>).factionStanding, undefined);
  assert.equal((inheritance as Record<string, unknown>).flaggedWanted, undefined);
  assert.equal((inheritance as Record<string, unknown>).identityExposed, undefined);
  assert.equal((inheritance as Record<string, unknown>).doubtedBy, undefined);
  assert.equal((inheritance as Record<string, unknown>).viabilityScoreBps, undefined);
});

// ---------------------------------------------------------------------------
// Test: reincarnation generates deterministic new identityId and generation
// ---------------------------------------------------------------------------

test("reincarnation produces deterministic new agentId and incremented generation", () => {
  const core = createEpochGameCore({
    clock: () => new Date("2026-07-26T00:00:00.000Z"),
    idFactory: createSequentialEpochIdFactory("deterministic_reincarnation"),
  });

  const first = core.issueIdentity(
    { explorerId: "explorer_1", identityName: "初世" },
    playerCtx("explorer_1", "deterministic_reincarnation"),
  );

  core.archiveIdentity(
    { agentId: first.value.agentId, archiveReason: "test", finalTitle: "终" },
    SYSTEM,
  );

  const second = core.reincarnate(
    { previousAgentId: first.value.agentId, identityName: "二世" },
    SYSTEM,
  );

  // Deterministic: new agentId is NOT the same as previous.
  assert.notEqual(second.value.agentId, first.value.agentId);
  assert.equal(second.value.generation, first.value.generation + 1);

  // New identity has new expectedLifePattern (different identityId → different hash).
  assert.ok(second.value.expectedLifePattern);
  assert.ok(first.value.expectedLifePattern);
  assert.notEqual(
    second.value.expectedLifePattern.inputHash,
    first.value.expectedLifePattern.inputHash,
    "reincarnation pattern inputHash must differ from previous identity",
  );

  // New identity has new personalityTraits (different agentId → different hash).
  assert.ok(second.value.personality);
  assert.ok(first.value.personality);
  // Traits are deterministic per agentId+name+generation, so they may or may
  // not differ — but the identity association is to the new agentId.
});

// ---------------------------------------------------------------------------
// Test: canonical events survive event store replay after restart
// ---------------------------------------------------------------------------

test("canonical events survive event store replay (restart simulation)", () => {
  const now = "2026-07-26T00:00:00.000Z";
  const idFactorySeed = "replay_canonical";

  // Phase 1: issue identity, ingest canonical event.
  const core1 = createEpochGameCore({
    clock: () => new Date(now),
    idFactory: createSequentialEpochIdFactory(idFactorySeed),
  });

  const issued = core1.issueIdentity(
    { explorerId: "explorer_1", identityName: "初世" },
    playerCtx("explorer_1", idFactorySeed),
  );

  const canonicalEvent: EpochEvent = {
    eventId: "canonical_replay_1",
    eventType: "world_object_state_changed",
    aggregateType: "world_object",
    aggregateId: "obj_replay_target",
    actorExplorerId: "system",
    agentId: issued.value.agentId,
    trustClass: "system_worker",
    causationId: "cause_replay",
    correlationId: "corr_replay",
    createdAt: now,
    payload: {
      objectId: "obj_replay_target",
      regionId: "region_test",
      statusAfter: "destroyed" as const,
      degree: 2,
      sourceActionEventId: "action_replay",
      sourceAggregateId: "action_replay",
      changedAt: now,
      worldMinute: 50,
    },
  };
  core1.ingestCanonicalEvents([canonicalEvent]);

  // Snapshot the event store.
  const persistedEvents = core1.events();
  assert.ok(persistedEvents.length > 0);
  assert.ok(persistedEvents.some((e) => e.eventType === "world_object_state_changed"));

  // Phase 2: restart from persisted events (simulates server restart).
  const core2 = createEpochGameCore({
    clock: () => new Date(now),
    idFactory: createSequentialEpochIdFactory(idFactorySeed),
    initialEvents: persistedEvents,
  });

  const proj2 = core2.project();

  // Canonical world object state survives replay.
  assert.ok(proj2.worldObjectStates["obj_replay_target"]);
  assert.equal(proj2.worldObjectStates["obj_replay_target"].status, "destroyed");

  // Identity survives replay.
  assert.ok(proj2.identities[issued.value.agentId]);
  assert.equal(proj2.identities[issued.value.agentId].status, "active");
});

// ---------------------------------------------------------------------------
// Test: canonical events NOT deleted when identity is archived
// ---------------------------------------------------------------------------

test("canonical events persist in event store after identity archival", () => {
  const now = "2026-07-26T00:00:00.000Z";
  const core = createEpochGameCore({
    clock: () => new Date(now),
    idFactory: createSequentialEpochIdFactory("canonical_persist"),
  });

  const issued = core.issueIdentity(
    { explorerId: "explorer_1", identityName: "初世" },
    playerCtx("explorer_1", "canonical_persist"),
  );
  const agentId = issued.value.agentId;

  // Ingest canonical event.
  const canonicalEvent: EpochEvent = {
    eventId: "canonical_persist_1",
    eventType: "world_object_state_changed",
    aggregateType: "world_object",
    aggregateId: "obj_persist",
    actorExplorerId: "system",
    agentId,
    trustClass: "system_worker",
    causationId: "cause_persist",
    correlationId: "corr_persist",
    createdAt: now,
    payload: {
      objectId: "obj_persist",
      regionId: "region_test",
      statusAfter: "degraded" as const,
      degree: 1,
      sourceActionEventId: "action_persist",
      sourceAggregateId: "action_persist",
      changedAt: now,
      worldMinute: 30,
    },
  };
  core.ingestCanonicalEvents([canonicalEvent]);

  // Archive identity.
  core.archiveIdentity(
    { agentId, archiveReason: "test", finalTitle: "终" },
    SYSTEM,
  );

  // Event store still contains the canonical event.
  const allEvents = core.events();
  const wosEvents = allEvents.filter((e) => e.eventType === "world_object_state_changed");
  assert.equal(wosEvents.length, 1);
  assert.equal(wosEvents[0]?.eventId, "canonical_persist_1");

  // Canonical state still present in projection.
  const proj = core.project();
  assert.ok(proj.worldObjectStates["obj_persist"]);
  assert.equal(proj.worldObjectStates["obj_persist"].status, "degraded");
});

// ---------------------------------------------------------------------------
// Test: lifetime_adjustment with remaining=0 triggers archive + reincarnation
// ---------------------------------------------------------------------------

test("lifetime adjustment to zero triggers archive with viability zeroed then reincarnation with fresh viability", () => {
  const { clock, set } = mutableClock("2026-07-26T00:00:00.000Z");
  const core = createEpochGameCore({
    clock,
    idFactory: createSequentialEpochIdFactory("lifetime_zero"),
    defaultLifetime: 10,
  });

  const first = core.issueIdentity(
    { explorerId: "explorer_1", identityName: "初世" },
    playerCtx("explorer_1", "lifetime_zero"),
  );
  const firstAgentId = first.value.agentId;

  // Adjust lifetime to zero (triggers archive + auto-reincarnation).
  set("2026-07-26T01:00:00.000Z");
  const result = core.adjustLifetime(
    { agentId: firstAgentId, delta: -10, reason: "fatal_test", finalTitle: "致命测试" },
    SYSTEM,
  );

  // Result events include lifetime_adjusted, identity_archived, identity_issued, reincarnation_issued.
  const eventTypes = result.events.map((e) => e.eventType);
  assert.ok(eventTypes.includes("lifetime_adjusted"));
  assert.ok(eventTypes.includes("identity_archived"));
  assert.ok(eventTypes.includes("identity_issued"));
  assert.ok(eventTypes.includes("reincarnation_issued"));

  const proj = core.project();

  // First identity archived with viability zeroed.
  const archived = proj.identities[firstAgentId];
  assert.ok(archived);
  assert.equal(archived.status, "archived");
  assert.ok(archived.identityViability);
  assert.equal(archived.identityViability.status, "social_death");
  assert.equal(archived.identityViability.viabilityScoreBps, 0);

  // Second identity has fresh viability.
  // Find the new identity via lineage.
  const lineage = proj.lineage["explorer_1"];
  assert.ok(lineage);
  assert.ok(lineage.length >= 2);
  const secondAgentId = lineage[1];
  assert.ok(secondAgentId);
  assert.notEqual(secondAgentId, firstAgentId);

  const secondIdentity = proj.identities[secondAgentId];
  assert.ok(secondIdentity);
  assert.equal(secondIdentity.status, "active");
  assert.ok(secondIdentity.identityViability);
  assert.equal(secondIdentity.identityViability.status, "healthy");
  assert.equal(secondIdentity.identityViability.viabilityScoreBps, 10_000);
  assert.equal(secondIdentity.identityViability.identityId, secondAgentId);
});
