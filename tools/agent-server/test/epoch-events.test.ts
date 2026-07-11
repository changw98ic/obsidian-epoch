import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { createInMemoryEpochEventStore, createJsonlEpochEventStore } from "../lib/epoch/eventStore.ts";
import { createEpochGameCore } from "../lib/epoch/gameCore.ts";
import { createSequentialEpochIdFactory, type EpochClock } from "../lib/epoch/protocol.ts";

function fixedClock(iso: string): EpochClock {
  return () => new Date(iso);
}

function sampleEvents() {
  const core = createEpochGameCore({
    clock: fixedClock("2026-06-25T00:00:00.000Z"),
    idFactory: createSequentialEpochIdFactory("store"),
  });
  const identity = core.issueIdentity({
    explorerId: "explorer_store",
    identityName: "事件簿学徒",
  }, {
    actorExplorerId: "explorer_store",
    trustClass: "untrusted_client",
  });
  core.grantResource({
    agentId: identity.value.agentId,
    resourceId: "legend",
    amount: 1,
    reason: "first_canonical_event",
  }, {
    actorExplorerId: "system",
    trustClass: "system_worker",
  });
  return core.events();
}

test("in-memory epoch event store appends immutable canonical events", async () => {
  const events = sampleEvents();
  const store = createInMemoryEpochEventStore();

  await store.append(events);
  const stored = await store.readAll();

  assert.equal(stored.length, 2);
  assert.equal(stored[0].eventType, "identity_issued");
  assert.equal(stored[1].eventType, "resource_granted");
  assert.notEqual(stored, events);
});

test("seeded epoch ids stay deterministic without common-prefix collisions", () => {
  const factory = createSequentialEpochIdFactory("idsafe");

  const clerk = factory("npc", "region_gray_harbor:gray harbor clerk");
  const partner = factory("npc", "region_gray_harbor:gray harbor clerk partner");
  const sameClerk = factory("npc", "region_gray_harbor:gray harbor clerk");
  const longPrefixLeft = factory(
    "organization_membership",
    "epoch_organization_region_gray_harbor_civic_ledger:epoch_npc_region_gray_harbor_gray_harbor_clerk:regional_clerk",
  );
  const longPrefixRight = factory(
    "organization_membership",
    "epoch_organization_region_gray_harbor_civic_ledger:epoch_npc_region_gray_harbor_gray_harbor_clerk_child_3:regional_clerk",
  );

  assert.notEqual(clerk, partner);
  assert.notEqual(longPrefixLeft, longPrefixRight);
  assert.equal(clerk, sameClerk);
});

test("JSONL epoch event store round-trips event envelopes", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "epoch-events-"));
  const filePath = path.join(dir, "epoch-events.jsonl");
  try {
    const events = sampleEvents();
    const store = createJsonlEpochEventStore(filePath);

    await store.append(events);
    const stored = await store.readAll();

    assert.equal(stored.length, events.length);
    assert.deepEqual(stored.map((event) => event.eventType), ["identity_issued", "resource_granted"]);
    if (stored[0].eventType !== "identity_issued" || events[0].eventType !== "identity_issued") {
      throw new Error("expected_identity_issued_event");
    }
    assert.equal(stored[0].payload.agentId, events[0].payload.agentId);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
