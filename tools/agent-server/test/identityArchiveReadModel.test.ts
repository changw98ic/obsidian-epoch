import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";
import type { EpochProjection } from "../lib/epoch/gameCore.ts";

const modulePath = new URL("../lib/epoch/identityArchiveReadModel.ts", import.meta.url);

function eventFixture(input: {
  eventId: string;
  eventType: string;
  aggregateId: string;
  agentId?: string;
  createdAt: string;
}) {
  return {
    eventId: input.eventId,
    eventType: input.eventType,
    aggregateType: "identity",
    aggregateId: input.aggregateId,
    actorExplorerId: "explorer_archive",
    trustClass: "system_worker",
    payload: { agentId: input.agentId || input.aggregateId },
    createdAt: input.createdAt,
    ...(input.agentId ? { agentId: input.agentId } : {}),
  };
}

function projectionFixture(): EpochProjection {
  return {
    identities: {
      agent_old: {
        agentId: "agent_old",
        explorerId: "explorer_archive",
        identityName: "旧身份",
        status: "archived",
        generation: 1,
        lifetime: { current: 0, max: 10 },
        issuedAt: "2026-07-06T00:00:00.000Z",
        archivedAt: "2026-07-07T00:00:00.000Z",
        nextAgentId: "agent_new",
      },
      agent_new: {
        agentId: "agent_new",
        explorerId: "explorer_archive",
        identityName: "新身份",
        status: "active",
        generation: 2,
        lifetime: { current: 10, max: 10 },
        issuedAt: "2026-07-07T00:10:00.000Z",
        previousAgentId: "agent_old",
      },
    },
    lineage: {
      explorer_archive: ["agent_old", "agent_new", "agent_missing"],
    },
    resourceBalances: {
      agent_old: { coin: 3, legend: 1 },
    },
    events: [
      eventFixture({
        eventId: "event_resource",
        eventType: "resource_granted",
        aggregateId: "agent_old",
        agentId: "agent_old",
        createdAt: "2026-07-06T01:00:00.000Z",
      }),
      eventFixture({
        eventId: "event_archive",
        eventType: "identity_archived",
        aggregateId: "agent_old",
        createdAt: "2026-07-07T00:00:00.000Z",
      }),
      eventFixture({
        eventId: "event_reincarnation",
        eventType: "reincarnation_issued",
        aggregateId: "agent_old",
        createdAt: "2026-07-07T00:10:00.000Z",
      }),
      eventFixture({
        eventId: "event_other",
        eventType: "resource_granted",
        aggregateId: "agent_other",
        agentId: "agent_other",
        createdAt: "2026-07-07T00:20:00.000Z",
      }),
    ],
  } as unknown as EpochProjection;
}

test("identity archive read model projects archived lineage and events", async () => {
  assert.ok(existsSync(modulePath), "identityArchiveReadModel.ts should own identity archive projection");
  const readModel = await import("../lib/epoch/identityArchiveReadModel.ts");
  const projection = projectionFixture();

  const archive = readModel.identityArchiveView(projection, { agentId: "agent_old", limit: 2 });

  assert.equal(archive.agentId, "agent_old");
  assert.equal(archive.explorerId, "explorer_archive");
  assert.equal(archive.identity?.identityName, "旧身份");
  assert.equal(archive.nextIdentity?.agentId, "agent_new");
  assert.equal(archive.previousIdentity, undefined);
  assert.deepEqual(archive.lineage, ["agent_old", "agent_new", "agent_missing"]);
  assert.deepEqual(archive.lineageIdentities.map((identity) => identity.agentId), ["agent_old", "agent_new"]);
  assert.deepEqual(archive.resources, { coin: 3, legend: 1 });
  assert.deepEqual(archive.latestEvents.map((event) => event.eventId), ["event_reincarnation", "event_archive"]);
  assert.equal(archive.archiveEvent?.eventId, "event_archive");
  assert.equal(archive.reincarnationEvent?.eventId, "event_reincarnation");
  assert.deepEqual(archive.publicPages, {
    agent: "/epoch/agent/agent_old",
    archive: "/epoch/archive/agent_old",
    nextAgent: "/epoch/agent/agent_new",
  });
});

test("identity archive read model returns empty archive shell for missing identities", async () => {
  assert.ok(existsSync(modulePath), "identityArchiveReadModel.ts should handle missing identities");
  const readModel = await import("../lib/epoch/identityArchiveReadModel.ts");
  const projection = projectionFixture();

  const archive = readModel.identityArchiveView(projection, { agentId: "agent_missing" });

  assert.equal(archive.agentId, "agent_missing");
  assert.equal(archive.explorerId, undefined);
  assert.deepEqual(archive.lineage, []);
  assert.deepEqual(archive.lineageIdentities, []);
  assert.deepEqual(archive.resources, {});
  assert.deepEqual(archive.latestEvents, []);
  assert.deepEqual(archive.publicPages, {
    agent: "/epoch/agent/agent_missing",
    archive: "/epoch/archive/agent_missing",
    nextAgent: undefined,
  });
});
