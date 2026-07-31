import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { join, resolve, dirname } from "node:path";
import { tmpdir } from "node:os";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createJsonlCausalIdempotencyManifestStore } from "../lib/epoch/causalIdempotencyPersistence.ts";
import { causalIdempotencyScope, type CausalIdempotencyInput } from "../lib/epoch/causalIdempotencyRules.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));

function makeInput(key: string): CausalIdempotencyInput {
  return {
    worldId: "test-world",
    commandType: "test_command",
    actorRef: "actor-1",
    idempotencyKey: `key-${key}`,
    input: { test: true, key },
  };
}

describe("JSONL causal idempotency atomicity", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "atomicity-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("commitAtomically writes events and manifest together", async () => {
    const store = createJsonlCausalIdempotencyManifestStore(tempDir);
    const input = makeInput("scope-1");
    const now = new Date().toISOString();

    const claim = await store.claimReservation(input, {
      ownerId: "owner-1",
      now,
      leaseExpiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
    assert.equal(claim.kind, "reserved");

    const finalized = await store.commitAtomically(
      claim.reservation,
      { ...claim.reservation.manifest, status: "committed", eventIds: ["event-1", "event-2"], updatedAt: now },
      (_ctx) => {},
    );

    assert.equal(finalized.status, "committed");
    assert.deepEqual(finalized.eventIds, ["event-1", "event-2"]);

    const manifestContent = await readFile(join(tempDir, "causal-idempotency.jsonl"), "utf8");
    const lines = manifestContent.trim().split("\n").filter(Boolean);
    assert.ok(lines.length > 0);
    const lastLine = JSON.parse(lines[lines.length - 1]!);
    assert.equal(lastLine.manifest.status, "committed");
    assert.deepEqual(lastLine.manifest.eventIds, ["event-1", "event-2"]);
  });

  it("manifest recovery after commit", async () => {
    const store = createJsonlCausalIdempotencyManifestStore(tempDir);
    const input = makeInput("scope-2");
    const scope = causalIdempotencyScope(input);
    const now = new Date().toISOString();

    const claim = await store.claimReservation(input, {
      ownerId: "owner-1",
      now,
      leaseExpiresAt: new Date(Date.now() + 60_000).toISOString(),
    });

    await store.commitAtomically(
      claim.reservation,
      { ...claim.reservation.manifest, status: "committed", eventIds: ["event-3"], updatedAt: now },
      (_ctx) => {},
    );

    const recovered = await store.read(scope);
    assert.ok(recovered);
    assert.equal(recovered.status, "committed");
    assert.deepEqual(recovered.eventIds, ["event-3"]);
  });

  it("multiple commits to same scope keep latest manifest", async () => {
    const store = createJsonlCausalIdempotencyManifestStore(tempDir);
    const input = makeInput("scope-3");
    const scope = causalIdempotencyScope(input);
    const now = new Date().toISOString();

    const claim1 = await store.claimReservation(input, {
      ownerId: "owner-1",
      now,
      leaseExpiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
    await store.commitAtomically(
      claim1.reservation,
      { ...claim1.reservation.manifest, status: "committed", eventIds: ["event-4"], updatedAt: now },
      (_ctx) => {},
    );

    const claim2 = await store.claimReservation(input, {
      ownerId: "owner-1",
      now,
      leaseExpiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
    if (claim2.kind === "reserved") {
      await store.commitAtomically(
        claim2.reservation,
        { ...claim2.reservation.manifest, status: "committed", eventIds: ["event-4", "event-5"], updatedAt: now },
        (_ctx) => {},
      );
    }

    const recovered = await store.read(scope);
    assert.ok(recovered);
    assert.equal(recovered.status, "committed");
  });

  it("empty commit still writes manifest", async () => {
    const store = createJsonlCausalIdempotencyManifestStore(tempDir);
    const input = makeInput("scope-4");
    const scope = causalIdempotencyScope(input);
    const now = new Date().toISOString();

    const claim = await store.claimReservation(input, {
      ownerId: "owner-1",
      now,
      leaseExpiresAt: new Date(Date.now() + 60_000).toISOString(),
    });

    const finalized = await store.commitAtomically(
      claim.reservation,
      { ...claim.reservation.manifest, status: "committed", eventIds: [], updatedAt: now },
      (_ctx) => {},
    );

    assert.equal(finalized.status, "committed");
    assert.deepEqual(finalized.eventIds, []);

    const recovered = await store.read(scope);
    assert.ok(recovered);
    assert.equal(recovered.status, "committed");
  });

  it("concurrent commits are serialized by lock", async () => {
    const store = createJsonlCausalIdempotencyManifestStore(tempDir);
    const now = new Date().toISOString();

    const claim1 = await store.claimReservation(makeInput("scope-a"), {
      ownerId: "owner-1",
      now,
      leaseExpiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
    const claim2 = await store.claimReservation(makeInput("scope-b"), {
      ownerId: "owner-1",
      now,
      leaseExpiresAt: new Date(Date.now() + 60_000).toISOString(),
    });

    const p1 = store.commitAtomically(
      claim1.reservation,
      { ...claim1.reservation.manifest, status: "committed", eventIds: ["evt-a"], updatedAt: now },
      (_ctx) => {},
    );
    const p2 = store.commitAtomically(
      claim2.reservation,
      { ...claim2.reservation.manifest, status: "committed", eventIds: ["evt-b"], updatedAt: now },
      (_ctx) => {},
    );

    await Promise.all([p1, p2]);

    const scopeA = causalIdempotencyScope(makeInput("scope-a"));
    const scopeB = causalIdempotencyScope(makeInput("scope-b"));
    const recoveredA = await store.read(scopeA);
    const recoveredB = await store.read(scopeB);
    assert.ok(recoveredA);
    assert.ok(recoveredB);
    assert.equal(recoveredA.status, "committed");
    assert.equal(recoveredB.status, "committed");
  });

  it("commitAtomically uses the capture pattern in source (not direct writes)", () => {
    const sourcePath = resolve(__dirname, "../lib/epoch/causalIdempotencyPersistence.ts");
    const source = readFileSync(sourcePath, "utf-8");

    // Extract the commitAtomically method body to avoid false matches from other methods
    const commitBlock = source.match(/commitAtomically\([^)]*\)\s*\{([\s\S]*?)\n\s{4}\},\s*\n\s{2}\};/);
    assert.ok(commitBlock, "Could not find commitAtomically method in source");
    const body = commitBlock[1]!;

    // Verify the capture pattern exists: records are collected first, then written
    assert.ok(
      body.includes("capturedRecords"),
      "commitAtomically must use a capturedRecords array to collect records before writing",
    );
    assert.ok(
      body.includes("captureContext"),
      "commitAtomically must construct a captureContext with an appendJsonl method",
    );
    // Verify commit callback is invoked synchronously (not awaited) with the capture context
    assert.ok(
      body.includes("causal_idempotency_jsonl_atomic_commit_must_be_sync"),
      "commitAtomically must reject async commit callbacks to guarantee atomicity",
    );
    // Verify the write order: events first, manifest last
    const eventWriteIndex = body.indexOf("for (const { fileName, record } of capturedRecords)");
    const manifestWriteIndex = body.indexOf("await appendManifest(targetDataDir, finalized)");
    assert.ok(eventWriteIndex > 0, "commitAtomically must write captured event records");
    assert.ok(
      manifestWriteIndex > eventWriteIndex,
      "commitAtomically must write manifest AFTER event records (events-first ordering)",
    );
  });

  it("capture context writes records to the correct files", async () => {
    const store = createJsonlCausalIdempotencyManifestStore(tempDir);
    const input = makeInput("capture-test");
    const scope = causalIdempotencyScope(input);
    const now = new Date().toISOString();

    const claim = await store.claimReservation(input, {
      ownerId: "owner-1",
      now,
      leaseExpiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
    assert.equal(claim.kind, "reserved");

    const eventRecord = { eventType: "test_event", data: "payload-1" };
    const secondRecord = { eventType: "other_event", data: "payload-2" };

    const finalized = await store.commitAtomically(
      claim.reservation,
      { ...claim.reservation.manifest, status: "committed", eventIds: ["evt-1", "evt-2"], updatedAt: now },
      (ctx) => {
        ctx.appendJsonl("events.jsonl", eventRecord);
        ctx.appendJsonl("events.jsonl", secondRecord);
      },
    );

    assert.equal(finalized.status, "committed");

    // Verify the event records were written to the target file
    const eventsContent = await readFile(join(tempDir, "events.jsonl"), "utf8");
    const eventLines = eventsContent.trim().split("\n").filter(Boolean);
    assert.equal(eventLines.length, 2, "Both event records should be written");
    assert.deepEqual(JSON.parse(eventLines[0]!), eventRecord);
    assert.deepEqual(JSON.parse(eventLines[1]!), secondRecord);

    // Verify manifest was also written (after events)
    const manifestContent = await readFile(join(tempDir, "causal-idempotency.jsonl"), "utf8");
    const manifestLines = manifestContent.trim().split("\n").filter(Boolean);
    assert.ok(manifestLines.length > 0, "Manifest should be written");
    const lastManifest = JSON.parse(manifestLines[manifestLines.length - 1]!);
    assert.equal(lastManifest.manifest.status, "committed");

    // Verify recovery still works
    const recovered = await store.read(scope);
    assert.ok(recovered);
    assert.equal(recovered.status, "committed");
  });

  it("capture context supports multiple distinct files", async () => {
    const store = createJsonlCausalIdempotencyManifestStore(tempDir);
    const input = makeInput("multi-file");
    const scope = causalIdempotencyScope(input);
    const now = new Date().toISOString();

    const claim = await store.claimReservation(input, {
      ownerId: "owner-1",
      now,
      leaseExpiresAt: new Date(Date.now() + 60_000).toISOString(),
    });

    await store.commitAtomically(
      claim.reservation,
      { ...claim.reservation.manifest, status: "committed", eventIds: ["evt-x"], updatedAt: now },
      (ctx) => {
        ctx.appendJsonl("combat-log.jsonl", { round: 1, damage: 10 });
        ctx.appendJsonl("loot-log.jsonl", { item: "sword", rarity: "rare" });
      },
    );

    const combatLog = await readFile(join(tempDir, "combat-log.jsonl"), "utf8");
    assert.deepEqual(JSON.parse(combatLog.trim()), { round: 1, damage: 10 });

    const lootLog = await readFile(join(tempDir, "loot-log.jsonl"), "utf8");
    assert.deepEqual(JSON.parse(lootLog.trim()), { item: "sword", rarity: "rare" });

    const recovered = await store.read(scope);
    assert.ok(recovered);
    assert.equal(recovered.status, "committed");
  });
});
